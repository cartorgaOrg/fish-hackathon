#!/usr/bin/env node
/**
 * Organizers: build a zip that installs WITHOUT internet, for USB sticks / a local file share.
 *
 *   npm run offline-kit                          # → fishathon-offline-kit.zip
 *   npm run offline-kit -- --remote <git url>    # upstream participants will `git pull` from
 *                                                  (default: this repo's `origin`)
 *
 * Contents:
 *   fishathon-kit/              a git clone of the latest commit of the whole monorepo (game-kit/ with all
 *                               3D models, plus fish-audio/),
 *                               with `origin` pointing at the upstream repo, so `git pull` later
 *                               fetches only what changed (kilobytes)
 *   fishathon-kit/game-kit/npm-cache/   every npm package from package-lock.json, for Windows, macOS and Linux
 *                               on x64/arm64 (esbuild/rollup ship native binaries per platform)
 *   fishathon-kit/OFFLINE-INSTALL.md   what participants do with it
 *
 * Participants then run, with no network:   cd game-kit && npm ci --offline --cache ./npm-cache
 * Node.js itself is NOT included: put the installers from https://nodejs.org on the stick too.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { walk, writeZip } from './lib/zip.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUBDIR = 'game-kit'; // this kit's folder inside the monorepo; the whole repo is cloned
const KIT = 'fishathon-kit';
const shell = process.platform === 'win32';

// 1. the repo: a fresh clone of the latest commit, connected to upstream
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
const top = run('git', ['rev-parse', '--show-toplevel'], { cwd: ROOT });
if (top.status !== 0) { console.error('This needs to run inside the git repository.'); process.exit(1); }
const REPO_ROOT = top.stdout.trim();
if (run('git', ['status', '--porcelain'], { cwd: ROOT }).stdout.trim()) console.warn('⚠ You have uncommitted changes. The kit contains the last COMMIT only.\n');
const flagIdx = process.argv.indexOf('--remote');
const remote = flagIdx > 0 ? process.argv[flagIdx + 1] : run('git', ['remote', 'get-url', 'origin'], { cwd: ROOT }).stdout.trim();
const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'offline-repo-'));
if (run('git', ['clone', '--quiet', '--no-local', REPO_ROOT, repo]).status !== 0) { console.error('✘ git clone failed'); process.exit(1); }
if (remote) run('git', ['remote', 'set-url', 'origin', remote], { cwd: repo });
else {
  run('git', ['remote', 'remove', 'origin'], { cwd: repo });
  console.warn('⚠ No upstream URL (no `origin`, no --remote). Kit users get the code but can\'t `git pull` updates.\n');
}

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

       cd ${SUBDIR}
       npm ci --offline --cache ./npm-cache

3. Start it (still inside \`${SUBDIR}\`):

       npm run dev

   and open http://localhost:5173 . Everything (all 3D models included) works without internet.

4. It's a normal git repository. When you have internet again, \`git pull\` fetches organizer updates
   (only what changed, usually a few KB). To push to your own team repo instead:

       git remote rename origin upstream
       git remote add origin <your team's repo URL>

Then read **${SUBDIR}/docs/GETTING_STARTED.md**. The voice examples are in \`fish-audio/\` (they need internet and a Fish Audio API key). You can delete the \`npm-cache\` folder after step 2.

Note: \`npm run smoke\` (headless browser tests) needs a one-time download (\`npx playwright install chromium\`), so do it
later when you have a good connection. Everything else works offline.
`);

// 4. zip it
const entries = (await walk(repo)).map((file) => ({ name: `${KIT}/${path.relative(repo, file).split(path.sep).join('/')}`, file }));
for (const file of await walk(cache)) entries.push({ name: `${KIT}/${SUBDIR}/npm-cache/${path.relative(cache, file).split(path.sep).join('/')}`, file });
entries.push({ name: `${KIT}/OFFLINE-INSTALL.md`, file: guide });
const zipPath = path.join(ROOT, 'fishathon-offline-kit.zip');
console.log(`Zipping ${entries.length} files…`);
await writeZip(zipPath, entries);
await fs.rm(cache, { recursive: true, force: true });
await fs.rm(repo, { recursive: true, force: true });
await fs.rm(guide, { force: true });

const mb = ((await fs.stat(zipPath)).size / 1e6).toFixed(0);
console.log(`
✔ ${path.relative(ROOT, zipPath)} (${mb} MB)
  Put it on USB sticks / a local share together with the Node.js installers (Windows .msi, macOS .pkg).
  Participants: unzip → cd ${KIT}/${SUBDIR} → npm ci --offline --cache ./npm-cache → npm run dev
  (The same instructions are inside the zip: ${KIT}/OFFLINE-INSTALL.md)
  Upstream for \`git pull\`: ${remote || '(none: pass --remote <url>)'}`);
