# AGENTS.md: guide for AI coding assistants

You are working in a **browser game starter kit** for a hackathon. Teams build small 3D games quickly with plain JavaScript, three.js, a small engine of reusable primitives (`engine/`), and 780+ CC0 models (`public/assets/`).
Your job is usually to change or create a game under `games/<name>/`. Read this file first, then follow the links when you need detail.

This folder (`game-kit/`) is one half of a monorepo. Run every `npm` command from inside `game-kit/`, and read paths below as relative to it.
For voice (Fish Audio TTS, STT, talking NPCs) see [`../fish-audio/AGENTS.md`](../fish-audio/AGENTS.md); the [root AGENTS.md](../AGENTS.md) explains how the parts connect.

## 1. Golden rules

1. **Plain JavaScript ES modules.** No TypeScript, no React, no bundler config changes. Import from `'@engine'`, which also re-exports `THREE`.
2. **Never guess an asset path or an animation name.** Look them up in [`docs/ASSET_LIST.md`](docs/ASSET_LIST.md) (grep it). Model sizes vary a lot; see the table in [`docs/ASSETS.md`](docs/ASSETS.md#sizes-how-big-is-everything).
3. **Prefer engine primitives over hand-rolled code**, so check [`docs/ENGINE.md`](docs/ENGINE.md) first. If something is genuinely missing, add it in the game folder. Only change `engine/` for real bugs or broadly useful features, keep the API backwards compatible, and run the smoke test on **all** games afterwards.
4. **Copy patterns from the samples.** [`docs/GAMES.md`](docs/GAMES.md) explains every sample game and where things live.
5. **Every game has a `GameMenu` (title/pause/game over) and `TouchControls` (phones).** Keep them. Use `menu.gameOver()`/`menu.win()`/`menu.restart()`, never a bare `location.reload()`, and make every keyboard action reachable by a touch button.
6. **Put tuning numbers in a `CONFIG` object or data tables at the top of the file**, and keep comments beginner-friendly. Hackathon teammates will read your code.
7. **Only add assets with a known license** (CC0 preferred). Record each new file's author, license and source in a `LICENSE.txt` next to it, and see [`../LICENSING.md`](../LICENSING.md).
8. **Verify before you say you're done** (section 6). You can't see the screen, so run `npm run smoke` and read the screenshots.

## 2. Repository map

```
engine/                 the reusable primitives (≈2,900 lines, every file starts with a usage example)
  index.js              everything exported from '@engine' (start here to see what exists)
  Game.js               renderer, scene, camera, loop, entities, timers, mouse picking
  Entity.js             base class for things in the world (object, tags, update, destroy)
  Assets.js             model loading/caching + helpers: setVisible, attach, fitHeight, getBounds, tint, assetUrl
  Animator.js           animation clips by fuzzy name, cross-fades, once()
  Input.js              keyboard / mouse / gamepad / virtual joystick, pressKey() to simulate
  Physics.js            AABB colliders, Body (kinematic character), raycasts
  CharacterController.js  ready-made 3rd-person hero (extends Entity)
  cameras/              FollowCamera, FirstPersonCamera, RTSCamera
  Health.js  StateMachine.js  NavGrid.js (A* + PathFollower)  Selection.js (RTS)
  UI.js                 HTML HUD: text, bars, toasts, dialogs, world labels, buttons
  Menu.js               GameMenu: title, pause, game over, win, best score
  Touch.js              TouchControls: joystick, buttons, drag-to-look
  Audio.js              synthesized sound effects (no files needed) + file loading
  Effects.js            particles, flash, tracer, ring, screen shake
  Environment.js        setupEnvironment(): sky presets, sun + shadows, ground
  shapes.js  utils.js   primitive meshes; math/random/cooldown/storage helpers
games/<name>/           one folder per game: index.html + main.js (+ more modules)
  starter/              ~90-line minimal game: the default template for `npm run new`
  fishing/ rpg/ platformer/ sidescroller/ towerdefense/ shooter/ strategy/   full samples
public/assets/<pack>/   CC0 models (KayKit + Quaternius); catalog.json = machine-readable index
docs/                   ENGINE (API), GAMES (sample tour), RECIPES (how-tos), ASSETS, ASSET_LIST,
                        GETTING_STARTED, DEPLOY, TROUBLESHOOTING
scripts/                new-game, check, smoke, package, fetch-assets, build-catalog, upload-assets
tools/asset-browser.js  the /assets.html page
```

## 3. How a game works (the mental model)

```js
import { Game, CharacterController, FollowCamera, GameMenu, TouchControls, setupEnvironment } from '@engine';

const game = new Game();                                   // renderer, scene, camera, input, physics, ui, audio, effects
setupEnvironment(game, { sky: 'day' });                    // lights, sky, ground plane, shadows
await game.load([MODELS.hero, MODELS.coin]);               // preload behind a loading bar (top-level await is fine)
const hero = await game.assets.model(MODELS.hero);         // independent copy, safe to animate
const player = game.add(new CharacterController(game, hero));
player.camera = game.add(new FollowCamera(game, player.object));
const menu = new GameMenu(game, { title: 'My Game', controls: ['WASD — move'] });
new TouchControls(game, { joystick: true, look: true, buttons: [{ label: 'Jump', key: 'Space' }] });
game.start();
```

- **Entities.** `game.add(x)` takes anything with `update(dt)`. If it has `.object`, that object is added to the scene. Subclass `Entity` for game objects. Use `tags` plus `game.find(tag)`, `game.findAll(tag)` and `game.findNear(pos, r, tag)` for lookups. Remove with `entity.destroy()`.
- **Frame order:** input → `game.after/every` timers → `physics.update()` → every entity's `update(dt)` in insertion order → `game.onUpdate` callbacks → effects → render → UI positions.
- **Time:** `dt` is in seconds, clamped to 1/20. `game.paused` freezes updates (dt = 0), and `game.timeScale` speeds or slows the game. Use `game.time`, `game.after()` and `game.every()` for gameplay timing, because they respect pause. `cooldown()` from utils uses real time.
- **Menus pause the game.** The game is paused until the player presses Play, so put "start of game" logic in `GameMenu`'s `onStart`.
- **Coordinates:** Y is up, 1 unit ≈ 1 metre, the ground is at y = 0, and models face **+Z** (`rotation.y = Math.atan2(dx, dz)` faces a direction; `yawTo(from, to)` does this).
- **Physics:** every collider is an axis-aligned box. `Body` is a kinematic character box with its origin at the feet. There are no rotated boxes, no slopes and no rigid-body dynamics (see RECIPES for Rapier).
- **UI is HTML** layered over the canvas (`game.ui.*`). Labels attached to 3D objects are repositioned every frame.
- **Debugging:** `window.game` is always set. Some samples expose more, e.g. `window.td` in towerdefense.

## 4. Gotchas we already hit (read these)

| Symptom | Cause | Fix |
|---|---|---|
| Model is 100× too big / bounds nonsense | Quaternius rigs use scaled armatures; `Box3.setFromObject` is wrong before first render | Use `getBounds()`/`getSize()`/`fitHeight()` from the engine |
| Character shows every sword, shield and hat | KayKit characters ship with all accessories visible | `setVisible(model, { '2H_Sword': false, … })`; the asset browser generates this line |
| `attach(model, 'handslot.r', …)` | GLTFLoader strips dots from names | Fine: `findNode`/`attach` try the sanitized name (`handslotr`) automatically |
| Animation doesn't play, console warns "no clip matching" | Wrong clip name | Names are in ASSET_LIST.md. `play()` is fuzzy (`'run'` matches `Running_A`, `CharacterArmature|Run`) and accepts fallbacks `['Running_A','Run']` |
| Model floats or sinks | Origin isn't at the feet (Quaternius platformer cubes and coins are **centred**) | Offset `position.y`, or `assets.model(url, { center: true })` |
| Hiding a `ui.worldLabel` with `el.style.display` doesn't stick | UI manages `display` for off-screen culling | Use `el.style.visibility = 'hidden'` |
| Nothing happens before the player clicks Play | `GameMenu` pauses the game | Start timers/waves in `onStart` |
| Click on the Play button also fires a weapon | The same click | Ignore input unless `menu.playing` (see `games/shooter`) |
| Restart drops the player on the title screen | `location.reload()` | `menu.restart()` skips the title |
| Asset 404 / "Could not load" | Typo, or a path invented without checking | `npm run check` lists literal path mistakes; `npm run smoke` catches the rest |
| `new URL('…', import.meta.url)` breaks asset paths | Vite rewrites that exact pattern | Don't use it for assets; use `'/assets/…'` strings (resolved by `assetUrl`) |
| Pointer lock / audio don't work on page load | Browsers require a user gesture | Handled by `GameMenu` (`lockPointer: true`) and `Audio` (unlocks on first input) |
| Smoke test: things move slowly, timers seem off | Software rendering at low FPS, dt is clamped | Expected. Check for errors and look at screenshots, not timing. Use `game.timeScale` in tests |

## 5. Playbooks

**Create a new game**
1. `npm run new <name> -- --from <closest-sample>` (samples: starter, fishing, rpg, platformer, sidescroller, towerdefense, shooter, strategy).
2. Edit `games/<name>/main.js`. Change the `<title>` in `index.html` if needed. The launcher at `/` lists it automatically.
3. Verify (section 6).

**Add a model to a game**
1. `grep -i "<thing>" docs/ASSET_LIST.md` to find the URL (and animation names).
2. Check its native size in `docs/ASSETS.md` or measure it with `getSize(model)`. Pick `{ scale }` or `{ height }`.
3. Add it to the preload list (`game.load([...])`), then `await game.assets.model(url, opts)`.

**Add an enemy / NPC with AI**
Copy `games/rpg/enemy.js`. It's `Entity` + `Body` + `Animator` + `Health` + `StateMachine` (idle → wander → chase → attack → hit → dead) plus `ui.worldBar`. Add a type to its `ENEMY_TYPES` table. For enemies that walk a fixed path use `PathFollower` (`games/towerdefense`); for pathfinding around obstacles use `NavGrid` (`games/strategy`).

**Swimming / flying / free 3D movement**: `CharacterController` is for walking only. Use a `Body` with `gravityScale: 0` and your own vertical input; see RECIPES → *A swimming or flying player*.

**Add a pickup / trigger**: an `Entity` subclass whose `update()` checks `distXZ(this.position, player.position) < r`, then `destroy()` (see `Coin` in `games/starter/main.js`).

**Add a level**: data-driven levels are ASCII maps (`games/sidescroller` `LEVEL`, `games/towerdefense` `MAP`) or arrays of placements (`games/rpg` `WORLD`, `games/platformer/level.js`).

**Add UI**: `game.ui.text/bar/buttons/toast/message/dialog/worldLabel/worldBar` (see ENGINE.md → UI). For anything fancier, append your own HTML to `game.ui.root`.

**Add sound**: `game.audio.play('coin')`. Built-ins: jump coin powerup hit hurt shoot laser explosion click step swing death win lose build splash. Files go in `public/sounds/` and load with `game.audio.load(name, url)`.

**Ship it**: `npm run package -- <name>` → `dist/` + `dist.zip`; models load from the CDN. See [`docs/DEPLOY.md`](docs/DEPLOY.md).

## 6. Verify your work (always)

```bash
npm run check                          # asset paths, game folder layout, production build (≈10 s)
npm run smoke -- <game>                # headless Chrome: loads the game, presses Enter (Play), screenshots
npm run smoke -- <game> --keys KeyW:1500,Space --wait 5   # drive it a little first
npm run smoke -- <game> --eval "game.find('player').position.set(0, 0, 20)"   # stage a situation with JS
```

To test win/lose paths, expose a small debug hook in your game (e.g. `window.dbg = { win: () => menu.win({ score }) }`, like `window.td` in towerdefense) and call it with `--eval "dbg.win()"`. Then check that the `menu=` field in the output shows the right screen. Remember the default camera looks toward **-Z**, so holding W moves the player toward -Z.

- `smoke` prints every console error, uncaught exception and failed request, and exits non-zero if there are any.
- Screenshots land in `.smoke/<game>-title.png` (title screen) and `.smoke/<game>.png` (after Play). **Open and look at them**: they're your only view of the game. Check that models are visible, scaled sensibly, not floating, and that the HUD is readable.
- First run on a machine: `npx playwright install chromium`.
- If you changed `engine/`, run `npm run smoke` with no arguments to test every game.

## 7. Commands

| Command | What |
|---|---|
| `npm run dev` | Dev server with hot reload. Prints the URL (usually http://localhost:5173) |
| `npm run new <name> [-- --from <game>]` | Scaffold a game |
| `npm run check` | Static checks + build |
| `npm run smoke [-- <games…>] [--touch] [--wait s] [--keys …] [--eval js]` | Headless browser test + screenshots (`--eval` runs JS in the page, repeatable) |
| `npm run package -- <game> [--full]` | Deployable `dist/` + `dist.zip` for one game |
| `npm run build` / `build:cdn` / `preview` | Full builds of every game |
| `npm run smoke -- --offline` | Same, with all internet requests blocked (the kit must work on bad Wi-Fi) |
| `npm run catalog` | Regenerate `docs/ASSET_LIST.md` + `public/assets/catalog.json` after adding models |
| `npm run assets` / `assets:upload` | Maintainers: download packs / publish them to the CDN |
