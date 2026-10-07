#!/usr/bin/env node
/**
 * Fast static checks — run before committing (agents: run this after every change).
 *
 *   npm run check
 *
 * 1. Every "/assets/…" path written literally in games/, engine/ or tools/ exists in public/assets/.
 *    (Paths built from variables, like P + 'Coin.glb', are only caught by `npm run smoke`.)
 * 2. Every game folder has index.html + main.js, and index.html uses relative links.
 * 3. `vite build` succeeds (catches syntax errors and broken imports).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

async function walk(dir, exts) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, exts)));
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}
const exists = (p) => fs.access(p).then(() => true, () => false);
const rel = (p) => path.relative(ROOT, p);

// 1. literal asset paths
let checked = 0;
for (const dir of ['games', 'engine', 'tools']) {
  for (const file of await walk(path.join(ROOT, dir), ['.js', '.html'])) {
    const src = await fs.readFile(file, 'utf8');
    for (const m of src.matchAll(/['"`](\/assets\/[^'"`$\s{}]+\.(?:glb|gltf|png|jpg|json))['"`]/g)) {
      const line = src.slice(0, m.index).split('\n').length;
      if (/^\s*(\/\/|\/?\*)/.test(src.split('\n')[line - 1])) continue; // examples in comments
      checked++;
      if (!(await exists(path.join(ROOT, 'public', m[1])))) {
        problems.push(`${rel(file)}:${line}  missing asset ${m[1]}  (look it up in docs/ASSET_LIST.md)`);
      }
    }
  }
}
console.log(`✔ checked ${checked} literal asset paths`);

// 2. game folders
const games = (await fs.readdir(path.join(ROOT, 'games'), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
for (const g of games) {
  const html = path.join(ROOT, 'games', g, 'index.html');
  if (!(await exists(html))) { problems.push(`games/${g}/ has no index.html (copy games/starter/index.html)`); continue; }
  if (!(await exists(path.join(ROOT, 'games', g, 'main.js')))) problems.push(`games/${g}/ has no main.js`);
  const src = await fs.readFile(html, 'utf8');
  if (/(href|src)="\/(?!\/)/.test(src)) problems.push(`games/${g}/index.html uses an absolute link ("/…"); use "../../…" so builds work in sub-folders`);
}
console.log(`✔ checked ${games.length} game folders (${games.join(', ')})`);

// 3. build
if (!process.argv.includes('--no-build')) {
  const outDir = path.join(ROOT, 'node_modules', '.check-dist');
  const res = spawnSync('npx', ['vite', 'build', '--mode', 'cdn', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (res.status !== 0) problems.push('vite build failed (see the error above)');
  else console.log('✔ vite build succeeded');
  await fs.rm(outDir, { recursive: true, force: true });
}

if (problems.length) {
  console.error(`\n✘ ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\nAll checks passed. Next: `npm run smoke` to load the games in a real browser.');
