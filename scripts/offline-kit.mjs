#!/usr/bin/env node
/**
 * Organizers: build a zip that installs WITHOUT internet, for USB sticks / a local file share.
 *
 *   npm run offline-kit          # → fishathon-offline-kit.zip
 *
 * Contents:
 *   fishathon-kit/              every file tracked by git (engine, games, docs, all 3D models)
 *   fishathon-kit/npm-cache/    every npm package from package-lock.json, for Windows, macOS and Linux
 *                               on x64/arm64 (esbuild/rollup ship native binaries per platform)
 *   fishathon-kit/OFFLINE-INSTALL.md   what participants do with it
 *
 * Participants then run, with no network:   npm ci --offline --cache ./npm-cache
 * Node.js itself is NOT included: put the installers from https://nodejs.org on the stick too.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { walk, writeZip } from './lib/zip.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT = 'fishathon-kit';
const shell = process.platform === 'win32';

// 1. the repo: every tracked file (so no node_modules, dist, .smoke…)
const git = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
if (git.status !== 0) { console.error('This needs to run inside the git repository.'); process.exit(1); }
const tracked = git.stdout.split('\0').filter(Boolean);
const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
if (dirty) console.warn('⚠ You have uncommitted changes — the kit contains the working-tree versions of tracked files.\n');

// 2. an npm cache with every locked package, for every platform
const lock = JSON.parse(await fs.readFile(path.join(ROOT, 'package-lock.json'), 'utf8'));
// skip native binaries for platforms nobody brings to a hackathon (android, freebsd, s390x…)
const OS = ['win32', 'darwin', 'linux'], CPU = ['x64', 'arm64', 'ia32'];
const wanted = (v) => (!v.os || v.os.some((o) => OS.includes(o))) && (!v.cpu || v.cpu.some((c) => CPU.includes(c)));
const tarballs = [...new Set(Object.entries(lock.packages).filter(([k, v]) => k && v.resolved && wanted(v)).map(([, v]) => v.resolved))];
const cache = await fs.mkdtemp(path.join(os.tmpdir(), 'offline-cache-'));
console.log(`Caching ${tarballs.length} npm packages (Windows, macOS, Linux)…`);
for (let i = 0; i < tarballs.length; i += 20) {
  const res = spawnSync('npm', ['cache', 'add', '--cache', cache, ...tarballs.slice(i, i + 20)], { stdio: 'inherit', shell });
  if (res.status !== 0) { console.error('✘ npm cache add failed (are you online?)'); process.exit(1); }
}

// 3. instructions
const guide = path.join(cache, '..', `OFFLINE-INSTALL-${path.basename(cache)}.md`);
await fs.writeFile(guide, `# Offline install (no internet needed)

You need **Node.js 20 or newer** installed. If you don't have it, use the installer on this USB stick / share,
or ask an organizer. Check with \`node -v\`.

1. Copy the \`${KIT}\` folder somewhere on your computer (e.g. your Desktop) and rename it to your team name.
2. Open a terminal in that folder and run:

       npm ci --offline --cache ./npm-cache

3. Start it:

       npm run dev

   and open http://localhost:5173 . Everything (all 3D models included) works without internet.

4. Optional, for version control:

       git init && git add -A && git commit -m "Start"

Then read **docs/GETTING_STARTED.md**. You can delete the \`npm-cache\` folder after step 2.

Note: \`npm run smoke\` (headless browser tests) needs a one-time download (\`npx playwright install chromium\`), so do it
later when you have a good connection. Everything else works offline.
`);

// 4. zip it
const entries = tracked.map((f) => ({ name: `${KIT}/${f}`, file: path.join(ROOT, f) }));
for (const file of await walk(cache)) entries.push({ name: `${KIT}/npm-cache/${path.relative(cache, file).split(path.sep).join('/')}`, file });
entries.push({ name: `${KIT}/OFFLINE-INSTALL.md`, file: guide });
const zipPath = path.join(ROOT, 'fishathon-offline-kit.zip');
console.log(`Zipping ${entries.length} files…`);
await writeZip(zipPath, entries);
await fs.rm(cache, { recursive: true, force: true });
await fs.rm(guide, { force: true });

const mb = ((await fs.stat(zipPath)).size / 1e6).toFixed(0);
console.log(`
✔ ${path.relative(ROOT, zipPath)} (${mb} MB)
  Put it on USB sticks / a local share together with the Node.js installers (Windows .msi, macOS .pkg).
  Participants: unzip → cd ${KIT} → npm ci --offline --cache ./npm-cache → npm run dev
  (The same instructions are inside the zip: ${KIT}/OFFLINE-INSTALL.md)`);
