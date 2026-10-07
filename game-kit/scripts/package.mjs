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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { walk, writeZip } from './lib/zip.mjs';

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

// 3. zip it
const zipPath = path.join(ROOT, 'dist.zip');
await writeZip(zipPath, (await walk(DIST)).map((file) => ({ name: path.relative(DIST, file).split(path.sep).join('/'), file })));

const mb = ((await fs.stat(zipPath)).size / 1e6).toFixed(1);
console.log(`
✔ Packaged "${title}" (${full ? 'all models included' : 'models from cdn.manogames.com'})
    dist/      → upload this folder (Cloudflare Pages, Netlify, GitHub Pages…)
    dist.zip   → ${mb} MB, upload to itch.io as an HTML game ("This file will be played in the browser")
  Try it locally first:  npm run preview   (then open the URL it prints)
  More: docs/DEPLOY.md`);
