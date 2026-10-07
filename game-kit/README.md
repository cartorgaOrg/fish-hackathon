# 🎮 Game kit: the game part

Make a 3D browser game in a weekend. This folder is the **game** half of the starter kit; the **voice** half
is next door in [`../fish-audio/`](../fish-audio/). See the [root README](../README.md) for how the two fit together.

This kit gives you:

- **8 playable sample games** to copy from: 🌱 Starter · 🎣 Fishing · ⚔️ Action RPG · 🍄 3D Jump & Run · 🧱 Mario-style Side-Scroller · 🗼 Tower Defense · 🎯 FPS Arena Shooter · 🏰 Age-of-Empires-style Strategy. All have menus and work on phones.
- **A small engine of reusable primitives** (`engine/`, ~2,900 lines of commented JavaScript on [three.js](https://threejs.org)). It covers the game loop, entities, model loading, animation, input, collisions, a character controller, 3 cameras, health, AI state machines, pathfinding, HUD, menus, touch controls, sound effects and particles.
- **780+ free (CC0) 3D models** from [KayKit](https://kaylousberg.com) and [Quaternius](https://quaternius.com): heroes, monsters, dungeons, platformer kits, castles, guns, animals and 40+ animated fish, with a visual **asset browser**. They're bundled for offline development and served from `cdn.manogames.com` when you deploy.
- **Docs written for humans and AI assistants**, plus `check`/`smoke` commands so assistants can test their own work.

No engine to install. Edit a `.js` file, save, and the browser reloads. **Works fully offline** after `git clone` + `npm install`; there's also an offline USB kit for venues with bad Wi-Fi.

---

## Quick start

Requires [Node.js](https://nodejs.org) 20+.

```bash
cd game-kit                      # every command below runs from this folder
npm install
npm run dev                      # → open http://localhost:5173 (check the terminal for the URL)
npm run new my-game              # make your own game (copy of the starter)…
npm run new my-game -- --from rpg   # …or of the sample closest to your idea
```

Then open `http://localhost:5173/games/my-game/` and edit `games/my-game/main.js`.

**New here? Read [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md). It takes 15 minutes.**

## A whole game in 10 lines

```js
import { Game, CharacterController, FollowCamera, GameMenu, TouchControls, setupEnvironment } from '@engine';

const game = new Game();
setupEnvironment(game, { sky: 'sunset' });                          // lights, sky, ground, shadows
const model = await game.assets.model('/assets/kaykit-adventurers/Knight.glb');
const player = game.add(new CharacterController(game, model));     // WASD + jump + animations
player.camera = game.add(new FollowCamera(game, player.object));    // orbiting 3rd-person camera
new GameMenu(game, { title: 'My Game' });                           // title screen, pause, game over
new TouchControls(game, { joystick: true, look: true, buttons: [{ label: 'Jump', key: 'Space' }] });
game.start();
```

## Documentation map

| I want to… | Read |
|---|---|
| Get set up and make my first changes | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) |
| Pick a sample and know where everything is in it | [docs/GAMES.md](docs/GAMES.md) |
| Look up an engine class or function | [docs/ENGINE.md](docs/ENGINE.md) (starts with *Core concepts*) |
| Do a specific thing (projectiles, levels from text, save games, multiplayer…) | [docs/RECIPES.md](docs/RECIPES.md) |
| Find a model or animation name | `/assets.html` in the browser, or [docs/ASSET_LIST.md](docs/ASSET_LIST.md) |
| Understand model sizes, packs, the CDN, adding models | [docs/ASSETS.md](docs/ASSETS.md) |
| Put my game online (itch.io, Pages, Netlify…) | [docs/DEPLOY.md](docs/DEPLOY.md) |
| Fix something that's broken | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Run the event: pre-event email, offline USB kit, kickoff checklist | [docs/ORGANIZERS.md](docs/ORGANIZERS.md) |
| Let an AI assistant work on the code | [AGENTS.md](AGENTS.md) (Claude Code loads it automatically via `CLAUDE.md`) |
| Give my game a voice (talking NPCs, narrator) | [../fish-audio/](../fish-audio/) and the [root README](../README.md#using-both-parts-together) |

## Pages while `npm run dev` runs

| URL | |
|---|---|
| `/` | Launcher: every sample + your own games |
| `/games/<name>/` | A game. Add `?touch` to see the phone controls on desktop. |
| `/assets.html` | Asset browser: search, preview animations, hide parts, copy code |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (also prints a Network URL for testing on your phone) |
| `npm run new <name> [-- --from <game>]` | Create `games/<name>/` from the starter or any sample |
| `npm run check` | Fast checks: asset paths, game folders, production build |
| `npm run smoke [-- <game>…]` | Open games in headless Chrome, press Play, report errors, save screenshots to `.smoke/`. Options: `--keys`, `--eval`, `--wait`, `--touch` (first time: `npx playwright install chromium`) |
| `npm run package -- <game> [--full]` | Build one game into `dist/` + `dist.zip`, ready for itch.io and friends |
| `npm run build` / `npm run build:cdn` / `npm run preview` | Build every game (with models / models from CDN) and preview the build |
| `npm run catalog` | Rebuild the asset catalog after adding models |
| `npm run offline-kit` | Organizers: build a zip that installs with no internet (USB sticks) |
| `npm run assets` / `npm run assets:upload` | Maintainers: download the packs / publish them to the CDN |

## Project layout

```
engine/          reusable primitives: import from '@engine' (see docs/ENGINE.md)
games/<name>/    one folder per game: index.html + main.js (+ more modules)
public/assets/   the CC0 model packs (+ catalog.json); your own files go in public/<anything-else>/
docs/            all documentation
scripts/         new-game, check, smoke, package, asset tooling
tools/           the asset browser
infra/           CDN bucket settings
```

## Credits & license

- Code: MIT. Do whatever you want with it.
- Models: CC0 (public domain) by **Kay Lousberg** ([KayKit](https://kaylousberg.com)) and **[Quaternius](https://quaternius.com)**. You can use them in any game, including ones you sell. Credit is appreciated, not required.
- Adding your own models, sounds or music, or selling your game? Read [../LICENSING.md](../LICENSING.md) first.
- Built on [three.js](https://threejs.org) and [Vite](https://vitejs.dev).
