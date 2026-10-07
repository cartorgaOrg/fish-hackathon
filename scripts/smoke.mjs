#!/usr/bin/env node
/**
 * Smoke test: opens games in headless Chrome, presses Play, takes a screenshot and reports
 * every console error, uncaught exception and failed request. This is how an AI agent can
 * "see" the game: read the screenshots in .smoke/ after running it.
 *
 *   npm run smoke                       # every game in games/
 *   npm run smoke -- rpg fishing        # only these
 *   npm run smoke -- my-game --touch    # with on-screen touch controls (?touch)
 *   npm run smoke -- --offline          # block all internet requests: proves games work on bad Wi-Fi
 *   npm run smoke -- my-game --wait 8   # let it run 8 s before the screenshot (default 3)
 *   npm run smoke -- my-game --keys KeyW:1500,Space   # hold W for 1.5 s, then tap Space
 *   npm run smoke -- my-game --eval "game.find('player').position.set(0,0,20)"   # run JS in the page
 *        (--eval can be repeated; runs after --keys, result is printed. Use it to stage win/lose
 *         situations, e.g. call a debug hook your game exposes on window.)
 *
 * First time only:  npx playwright install chromium
 * Rendering is software-only (no GPU), so frame rates are low and game time runs slower than
 * real time — check for errors and look at the screenshots, don't judge performance here.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.smoke');

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const optNames = new Set(['--wait', '--keys', '--eval']);
const evals = args.flatMap((a, i) => (a === '--eval' ? [args[i + 1]] : []));
const names = args.filter((a, i) => !a.startsWith('--') && !optNames.has(args[i - 1]));
const touch = args.includes('--touch');
const offline = args.includes('--offline');
const waitSec = Number(opt('wait', 3));
const keys = (opt('keys', '') || '').split(',').filter(Boolean).map((k) => { const [code, ms] = k.split(':'); return { code, ms: Number(ms) || 0 }; });

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  console.error('Playwright is missing. Run: npm install && npx playwright install chromium');
  process.exit(1);
}

const all = (await fs.readdir(path.join(ROOT, 'games'), { withFileTypes: true }))
  .filter((d) => d.isDirectory()).map((d) => d.name);
const games = names.length ? names : all;
for (const g of games) if (!all.includes(g)) { console.error(`No such game: games/${g}`); process.exit(1); }

await fs.mkdir(OUT, { recursive: true });
const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, hmr: false } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');

let browser;
try {
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
} catch (e) {
  await server.close();
  console.error(`Could not start Chromium (${e.message.split('\n')[0]}).\nRun: npx playwright install chromium`);
  process.exit(1);
}

let failed = 0;
for (const g of games) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const issues = [];
  page.on('pageerror', (e) => issues.push(`exception: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|WebGL-/.test(m.text())) issues.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) issues.push(`HTTP ${r.status()}: ${r.url().replace(base, '')}`); });
  if (offline) {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      issues.push(`offline: blocked request to ${url}`);
      return route.abort();
    });
  }
  const started = Date.now();
  await page.goto(`${base}/games/${g}/${touch ? '?touch' : ''}`);
  const loaded = await page.waitForFunction(() => window.game && !document.querySelector('.fx-loading'), null, { timeout: 120_000 })
    .then(() => true, () => false);
  if (!loaded) issues.push('game never finished loading (window.game missing or loading screen stuck)');
  await page.screenshot({ path: path.join(OUT, `${g}-title.png`) });
  await page.keyboard.press('Enter'); // start through the GameMenu title screen, if there is one
  await page.waitForTimeout(500);
  for (const k of keys) {
    if (k.ms) { await page.keyboard.down(k.code); await page.waitForTimeout(k.ms); await page.keyboard.up(k.code); }
    else await page.keyboard.press(k.code);
  }
  for (const js of evals) {
    const result = await page.evaluate(js).then((r) => JSON.stringify(r) ?? 'undefined', (e) => `ERROR ${e.message.split('\n')[0].replace('page.evaluate: ', '')}`);
    console.log(`    eval ${js.length > 60 ? js.slice(0, 57) + '…' : js}  →  ${String(result).slice(0, 300)}`);
    if (result.startsWith('ERROR')) issues.push(`eval failed: ${result}`);
  }
  await page.waitForTimeout(waitSec * 1000);
  const info = await page.evaluate(() => ({
    entities: window.game?.entities.size ?? 0,
    paused: window.game?.paused,
    menu: document.querySelector('.fx-menu.open h1')?.textContent ?? null,
  })).catch(() => ({}));
  const shot = path.join(OUT, `${g}.png`);
  await page.screenshot({ path: shot });
  await page.close();
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  if (issues.length) failed++;
  console.log(`${issues.length ? '✘' : '✔'} ${g.padEnd(14)} ${secs.padStart(3)}s  entities=${info.entities}${info.menu ? `  menu="${info.menu}"` : ''}  → ${path.relative(ROOT, shot)}`);
  for (const i of [...new Set(issues)].slice(0, 12)) console.log(`    ${i}`);
}

await browser.close();
await server.close();
console.log(failed ? `\n${failed} game(s) had problems.` : `\nNo errors${offline ? ' (with all internet requests blocked)' : ''}. Look at the screenshots in .smoke/ to check that things look right.`);
process.exit(failed ? 1 : 0);
