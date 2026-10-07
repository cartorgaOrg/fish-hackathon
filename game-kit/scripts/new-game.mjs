#!/usr/bin/env node
/**
 * Create a new game from a template.
 *
 *   npm run new my-game                 # copies games/starter
 *   npm run new my-game -- --from rpg   # copies any existing game (rpg, platformer, shooter, strategy…)
 *
 * Then open http://localhost:5173/games/my-game/ (it also shows up on the home page).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const fromIdx = args.indexOf('--from');
const from = fromIdx >= 0 ? args[fromIdx + 1] : 'starter';

if (!name || !/^[a-z0-9][a-z0-9-_]*$/i.test(name)) {
  console.error('Usage: npm run new <name> [-- --from <template>]   (name: letters, numbers, - or _)');
  process.exit(1);
}
const src = path.join(ROOT, 'games', from);
const dest = path.join(ROOT, 'games', name);
try { await fs.access(src); } catch { console.error(`Template "games/${from}" not found.`); process.exit(1); }
try { await fs.access(dest); console.error(`games/${name} already exists.`); process.exit(1); } catch {}

await fs.cp(src, dest, { recursive: true });
const html = path.join(dest, 'index.html');
const title = name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
await fs.writeFile(html, (await fs.readFile(html, 'utf8')).replace(/<title>.*<\/title>/, `<title>${title}</title>`));

console.log(`✔ Created games/${name} (from games/${from})

  npm run dev
  open http://localhost:5173/games/${name}/

Edit games/${name}/main.js — the page reloads as you save.`);
