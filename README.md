# 🐟 Fishathon Starter Kit

A batteries-included starting point for hackathon games in the browser:

- **7 playable sample games** (🎣 Fishing, Action RPG, 3D Jump & Run, Mario-style Side-Scroller, Tower Defense, FPS Arena Shooter and an Age-of-Empires-style Strategy game) plus a tiny **starter**. Copy whichever is closest to your idea. Every sample has a title screen, a pause menu, game-over and win screens, and on-screen touch controls for phones.
- **Reusable primitives** in `engine/` (~2,400 lines of commented JavaScript on top of [three.js](https://threejs.org)): game loop, entities, model loading, animation, input, AABB physics, character controller, 3 camera rigs, health, state machines, A* pathfinding, RTS selection, HUD/dialogs, menus (title/pause/game over), touch controls, synthesized sound effects and particles.
- **780+ CC0 3D models** from [KayKit](https://kaylousberg.com) and [Quaternius](https://quaternius.com): heroes, skeletons, dungeons, platformer kits, RTS buildings, guns, animals and 40+ animated fish. They're already downloaded and include a visual **asset browser**.

No game engine to install, no build step to learn: edit a `.js` file, save, and the browser reloads.

---

## Quick start

You need [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm run dev
```

Open **http://localhost:5173** (Vite picks the next free port if 5173 is taken; check the terminal).

| Page | |
|---|---|
| `/` | Launcher with every game |
| `/games/starter/` | Smallest complete game (~80 lines) |
| `/games/fishing/` | Fish Frenzy (fishing) |
| `/games/rpg/` | Action RPG |
| `/games/platformer/` | 3D Jump & Run |
| `/games/sidescroller/` | Side-Scroller (Mario-style) |
| `/games/towerdefense/` | Tower Defense |
| `/games/shooter/` | Arena Shooter |
| `/games/strategy/` | Strategy (AoE-like) |
| `/assets.html` | **Asset browser**: search models, preview animations, copy code |

## Make your own game

```bash
npm run new my-game                  # copies games/starter
npm run new my-game -- --from rpg    # or start from any sample
```

Then open `/games/my-game/` and edit `games/my-game/main.js`.

A complete game is about this much code:

```js
import { Game, CharacterController, FollowCamera, setupEnvironment } from '@engine';

const game = new Game();
setupEnvironment(game, { sky: 'sunset' });                          // lights, sky, ground, shadows

const model = await game.assets.model('/assets/kaykit-adventurers/Knight.glb');
const player = game.add(new CharacterController(game, model));     // WASD + jump + animations
player.camera = game.add(new FollowCamera(game, player.object));    // orbiting 3rd-person camera

game.start();
```

## Which sample should I start from?

| You want to make… | Start from | Key primitives it shows |
|---|---|---|
| Anything / not sure yet | `starter` | `Game`, `Entity`, `CharacterController`, `FollowCamera`, UI |
| Action RPG, adventure, hack & slash, survival | `rpg` | Melee combat, `StateMachine` enemy AI, `Health`, dialog, quests, XP, loot, interactables |
| 3D platformer, collect-a-thon, obby | `platformer` | Double jump, moving platforms, hazards, stomping, checkpoints, data-driven level |
| Side-scroller, Mario-like, metroidvania, endless runner | `sidescroller` | ASCII-map levels, 2.5D camera, `body.ceiling` block bumps, power-up states, stomping, timer |
| Tower defense, lane or wave survival | `towerdefense` | ASCII-map road + `PathFollower`, tower targeting, homing/lobbed projectiles, splash & slow, upgrades/sell, wave tables, fast-forward |
| FPS, arena or wave shooter | `shooter` | `FirstPersonCamera`, hitscan raycasts, weapons table, waves, pickups, screen shake |
| RTS, city builder, tower defense, tactics | `strategy` | `RTSCamera`, `Selection`, `NavGrid` pathfinding, gathering economy, building placement, unit training |
| Fishing, cozy or collection game 🎣 | `fishing` | Cast/bite/reel `StateMachine`, tension minigame, rarity tables, shop, journal, save data |
| Underwater game 🐟 | `starter` + the fish recipe | See *An underwater / fish scene* in [docs/RECIPES.md](docs/RECIPES.md) |

Mixing genres is easy: every primitive is independent. A top-down shooter is `RTSCamera` plus the shooter's weapons.

## Project layout

```
engine/            reusable primitives (import from '@engine'); every file starts with a usage example
  Game.js            loop, entities, timers, mouse picking
  Entity.js          base class for everything in the world
  Assets.js          model loading + helpers (setVisible, attach, fitHeight, tint…)
  Animator.js        animation clips with forgiving names and cross-fades
  Input.js           keyboard / mouse / gamepad
  Physics.js         AABB colliders, kinematic Body, raycasts
  CharacterController.js   ready-made 3rd-person hero
  cameras/           FollowCamera, FirstPersonCamera, RTSCamera
  Menu.js            title / pause / game-over screens
  Touch.js           on-screen joystick + buttons for phones
  Health.js  StateMachine.js  NavGrid.js  Selection.js
  UI.js  Audio.js  Effects.js  Environment.js  shapes.js  utils.js
games/<name>/      one folder per game: index.html + main.js (+ more modules)
public/assets/     the CC0 model packs (+ catalog.json)
tools/             the asset browser
scripts/           fetch-assets, build-catalog, new-game
docs/              ENGINE.md, RECIPES.md, ASSETS.md, ASSET_LIST.md
```

## Documentation

- **[docs/ENGINE.md](docs/ENGINE.md)** covers every primitive with examples.
- **[docs/RECIPES.md](docs/RECIPES.md)** answers how-tos: pickups, projectiles, trigger zones, click-to-move, text-map levels, title/game-over screens, high scores, underwater scenes, real physics, multiplayer pointers, debugging, deployment.
- **[docs/ASSETS.md](docs/ASSETS.md)** describes the packs, their sizes and scales, gotchas, and how to add more.
- **[docs/ASSET_LIST.md](docs/ASSET_LIST.md)** lists every model URL and animation name.
- **[AGENTS.md](AGENTS.md)** holds conventions for AI coding assistants (Claude Code, Cursor, Copilot…). Point yours at it.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run new <name> [-- --from <game>]` | Scaffold a new game |
| `npm run build` / `npm run preview` | Production build into `dist/` (relative paths, so it works on itch.io or GitHub Pages) |
| `npm run assets` | (Re-)download asset packs (already included) |
| `npm run catalog` | Rebuild the asset catalog after adding models |

## Tips for the hackathon

- **Get something playable in the first hour.** Copy a sample, swap the models, change one mechanic.
- Keep tuning numbers in a `CONFIG` object at the top of the file, like the samples do.
- `game` is on `window`. Use the browser console to inspect things (`game.findAll('enemy')`) or try slow motion (`game.timeScale = 0.3`).
- `game.physics.showDebug(game.scene)` shows colliders when something feels off.
- Test on your phone: `npm run dev` prints a Network URL. Add `?touch` on desktop to see the touch controls.
- Sound matters more than you think: `game.audio.play('coin')` works without any audio files.
- Juice: `game.effects.shake()`, `burst()`, `flash()` and `ui.floatingText()` make hits feel good.

## Credits & license

- Code: MIT. Do whatever you want with it.
- Models: CC0 by **Kay Lousberg** ([KayKit](https://kaylousberg.com)) and **[Quaternius](https://quaternius.com)**. Credit isn't required but is appreciated.
- Built on [three.js](https://threejs.org) and [Vite](https://vitejs.dev).
