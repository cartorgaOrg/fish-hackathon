#!/usr/bin/env node
/**
 * Publish public/assets/ to the Cloudflare R2 bucket behind the CDN, as an immutable version.
 *
 *   npx wrangler login              # once
 *   npm run assets:upload           # uploads to <bucket>/<prefix>/<version>/…
 *   npm run assets:upload -- --version v2   # after adding or changing packs
 *
 * Versions are never overwritten (files are cached for a year), so already-deployed games
 * keep working. Bump the version, upload, then point ASSET_BASE in .env.cdn at it.
 *
 * Settings (env vars or flags):
 *   --bucket   ASSET_BUCKET           default mano-assets
 *   --prefix   ASSET_PREFIX           default fishathon-kit
 *   --version  ASSET_VERSION          default v1
 *   CLOUDFLARE_ACCOUNT_ID             default: the Mano Games account
 *   --force    re-upload every file, even into an existing version (only to repair a broken upload!)
 *
 * Interrupted? Just run it again: files already on the CDN are skipped.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'public', 'assets');
const CDN_HOST = 'https://cdn.manogames.com';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const bucket = flag('bucket', process.env.ASSET_BUCKET ?? 'mano-assets');
const prefix = flag('prefix', process.env.ASSET_PREFIX ?? 'fishathon-kit');
const version = flag('version', process.env.ASSET_VERSION ?? 'v1');
const force = args.includes('--force');
process.env.CLOUDFLARE_ACCOUNT_ID ??= 'f9264e6402496d116d81066613a3b8c3'; // Mano Games

const base = `${prefix}/${version}`;
const publicUrl = `${CDN_HOST}/${base}`;

// 1. never overwrite a published version
const probe = await fetch(`${publicUrl}/catalog.json`, { method: 'HEAD' });
if (probe.ok && !force) {
  console.error(`✘ ${publicUrl} already exists. Bump the version (--version v2) instead of overwriting.`);
  process.exit(1);
}

// 2. collect files
const TYPES = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};
async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}
const files = [];
for (const file of await walk(ASSETS)) {
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) continue;
  const rel = path.relative(ASSETS, file).split(path.sep).join('/');
  files.push({ file, rel, key: `${base}/${rel}`, type, size: (await fs.stat(file)).size });
}
// catalog.json goes last: its presence marks the version as complete
files.sort((a, b) => (a.rel === 'catalog.json') - (b.rel === 'catalog.json'));
const mb = (files.reduce((n, f) => n + f.size, 0) / 1e6).toFixed(1);
console.log(`Uploading ${files.length} files (${mb} MB) to r2://${bucket}/${base}/`);

// 3. upload with a small worker pool. Files already on the CDN are skipped, so an
//    interrupted upload can simply be re-run. (`wrangler r2 bulk put` is experimental
//    and kept failing on large batches, so we call `r2 object put` per file.)
function put(f) {
  return new Promise((resolve) => {
    const child = spawn('npx', [
      'wrangler', 'r2', 'object', 'put', `${bucket}/${f.key}`, '--remote',
      '--file', f.file, '--content-type', f.type,
      '--cache-control', 'public, max-age=31536000, immutable',
    ], { cwd: ROOT, shell: process.platform === 'win32', stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => resolve(code === 0 ? null : err.trim().split('\n').slice(-3).join(' ')));
  });
}
const exists = async (f) => (await fetch(`${CDN_HOST}/${encodeURI(f.key)}`, { method: 'HEAD' }).catch(() => ({}))).ok;

let done = 0, skipped = 0, failed = [];
const queue = files.filter((f) => f.rel !== 'catalog.json');
async function worker() {
  for (let f; (f = queue.shift()); ) {
    if (!force && (await exists(f))) { skipped++; done++; continue; }
    let error;
    for (let attempt = 1; attempt <= 3; attempt++) if (!(error = await put(f))) break;
    if (error) failed.push(`${f.rel}: ${error}`);
    if (++done % 50 === 0) console.log(`  ${done}/${files.length - 1}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
if (failed.length) {
  console.error(`✘ ${failed.length} files failed (re-run to resume):\n  ${failed.slice(0, 10).join('\n  ')}`);
  process.exit(1);
}
const err = await put(files.find((f) => f.rel === 'catalog.json'));
if (err) { console.error(`✘ catalog.json failed: ${err}`); process.exit(1); }

console.log(`\n✔ Published ${publicUrl}/ (${skipped} files were already there)
  Check:  ${publicUrl}/catalog.json
  Use it: set VITE_ASSET_BASE=${publicUrl} in .env.cdn, then npm run build:cdn`);
