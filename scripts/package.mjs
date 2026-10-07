#!/usr/bin/env node
/**
 * Build ONE game ready to upload anywhere (itch.io, Cloudflare Pages, Netlify, GitHub Pages…).
 *
 *   npm run package -- my-game          # → dist/ + dist.zip, models load from the CDN (tiny upload)
 *   npm run package -- my-game --full   # bundle all models into the zip instead (~95 MB, works offline)
 *
 * dist/index.html opens your game directly (no launcher), so the zip is a valid itch.io HTML game.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const args = process.argv.slice(2);
const game = args.find((a) => !a.startsWith('--'));
const full = args.includes('--full');

if (!game) { console.error('Usage: npm run package -- <game-folder> [--full]'); process.exit(1); }
try { await fs.access(path.join(ROOT, 'games', game, 'index.html')); } catch {
  console.error(`games/${game}/index.html not found. Your games: ${(await fs.readdir(path.join(ROOT, 'games'))).join(', ')}`);
  process.exit(1);
}

// 1. build
const res = spawnSync('npx', ['vite', 'build', ...(full ? [] : ['--mode', 'cdn']), '--emptyOutDir', '--logLevel', 'warn'],
  { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
if (res.status !== 0) process.exit(res.status ?? 1);

// 2. make dist/index.html open the game directly
const title = (await fs.readFile(path.join(ROOT, 'games', game, 'index.html'), 'utf8')).match(/<title>(.*?)<\/title>/)?.[1] ?? game;
await fs.writeFile(path.join(DIST, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta http-equiv="refresh" content="0; url=games/${game}/">
</head><body><a href="games/${game}/">Play ${title}</a></body></html>
`);

// 3. zip it (store-only zip writer: no dependencies; models are already compressed)
const crc32 = zlib.crc32 ?? ((buf) => {
  let c, crc = 0xffffffff;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
});
async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else out.push(p);
  }
  return out;
}
const chunks = [], central = [];
let offset = 0;
for (const file of await walk(DIST)) {
  const name = Buffer.from(path.relative(DIST, file).split(path.sep).join('/'));
  const data = await fs.readFile(file);
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); // utf-8 names
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
  chunks.push(local, name, data);
  central.push(cen, name);
  offset += 30 + name.length + data.length;
}
const cenSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
end.writeUInt32LE(cenSize, 12); end.writeUInt32LE(offset, 16);
const zipPath = path.join(ROOT, 'dist.zip');
await fs.writeFile(zipPath, Buffer.concat([...chunks, ...central, end]));

const mb = ((await fs.stat(zipPath)).size / 1e6).toFixed(1);
console.log(`
✔ Packaged "${title}" (${full ? 'all models included' : 'models from cdn.manogames.com'})
    dist/      → upload this folder (Cloudflare Pages, Netlify, GitHub Pages…)
    dist.zip   → ${mb} MB, upload to itch.io as an HTML game ("This file will be played in the browser")
  Try it locally first:  npm run preview   (then open the URL it prints)
  More: docs/DEPLOY.md`);
