# Troubleshooting & FAQ

First step for any problem: **open the browser console** (F12 → Console). Most problems print a clear error there.
Second step: run `npm run check`, and `npm run smoke -- <game>` for a headless run with a screenshot in `.smoke/`.

## Setup

| Problem | Fix |
|---|---|
| `npm install` fails / old Node | Install Node.js 20+ (`node -v`). On Windows use the official installer, then reopen the terminal. |
| "Port 5173 is in use" | Vite picks the next free port. Read the URL in the terminal. |
| Can't open the game on my phone | Use the **Network** URL that `npm run dev` prints, on the same Wi-Fi. Corporate or guest Wi-Fi often blocks device-to-device traffic, so use a phone hotspot. |
| `npm run smoke` says Chromium is missing | Run `npx playwright install chromium` once. |
| Changes don't show up | Save the file, and check the terminal for a build error. Hard-reload with Ctrl/Cmd+Shift+R. |

## Black screen / nothing loads

| Symptom | Cause / fix |
|---|---|
| Loading bar never finishes | A model URL is wrong. The console says `Could not load "/assets/…"`. Look the name up in `docs/ASSET_LIST.md`, and run `npm run check`. |
| Title screen never appears, console shows a red error | A JavaScript error in your `main.js`. The console shows the file and line. |
| Sky but no world | Camera is inside or under something. Log `game.camera.position` in the console, or add `setupEnvironment(game)` if you removed it. |
| Everything dark | No lights. Call `setupEnvironment(game, { sky: 'day' })`, or add your own `THREE.HemisphereLight` + `DirectionalLight`. |

## Models

| Problem | Fix |
|---|---|
| Model is huge or tiny | Packs use different scales. See the size table in [ASSETS.md](ASSETS.md#sizes-how-big-is-everything); use `assets.model(url, { height: 1.8 })` to fit a height. |
| Character holds every weapon | KayKit characters have all accessories visible. Use `setVisible(model, { … })`; the asset browser generates the line when you click parts. |
| Model floats above or sinks into the ground | Its origin isn't at the bottom (Quaternius platformer cubes/coins are centred). Use `{ center: true }` or offset `position.y`. |
| Model faces the wrong way | Models face +Z. Use `object.rotation.y = Math.atan2(dx, dz)` or `yawTo(from, to)`. If a model natively faces another way, wrap it in a `THREE.Group` and rotate the inner model once. |
| Animation doesn't play | Check the console for `Animator: no clip matching …`. It lists the real names. Also check that you call `anim.update(dt)` every frame (CharacterController does it for you). |
| Two copies animate together | Use `game.assets.model(url)` for each copy; it clones skeletons properly. |
| My own `.glb` won't load | Put it in `public/models/` (**not** `public/assets/`) and load `'/models/thing.glb'`. FBX/OBJ: convert to glb in Blender first. |

## Gameplay & physics

| Problem | Fix |
|---|---|
| Walk through walls | Add `game.physics.addCollider(wallModel)`. Show all colliders with `game.physics.showDebug(game.scene)`. |
| Stuck on invisible things | A collider bigger than it looks, e.g. a tree's leaves. Use `addCollider(obj, { padding: -0.5 })`, or `addBox` with a smaller box. |
| Character falls through the world | `new Game({ groundY: null })` removes the floor, so add floor colliders. Very fast objects can tunnel; keep speeds reasonable. |
| Sloped or rotated surfaces don't collide properly | All colliders are axis-aligned boxes. Use stairs or steps, or see *Add real physics (Rapier)* in RECIPES.md. |
| Nothing moves until I click | The `GameMenu` title screen pauses the game until Play. Put start logic in `onStart`. |
| Timers run while the game is paused | Use `game.after`/`game.every`/`game.time` (they pause) instead of `setTimeout` or `cooldown()` (real time). |
| Clicks on my HTML buttons also click the game | Use `game.ui.buttons()`, which stops propagation. For custom HTML, add `pointer-events: auto` and stop pointerdown propagation. |
| Mouse look doesn't work (FPS) | Pointer lock needs a click: use `GameMenu` with `lockPointer: true` (Play captures the mouse). |
| No sound | Browsers block audio until the first user input. Pressing Play counts. Also check `game.audio.muted`. |

## Phones

| Problem | Fix |
|---|---|
| No touch controls | They only appear on touch devices. Add `?touch` to the URL to force them on desktop. Make sure your game creates `new TouchControls(game, …)`. |
| Page scrolls/zooms instead of playing | Make sure your `index.html` includes the `viewport` meta tag and `engine/base.css` (copy from `games/starter/index.html`). |
| Too slow on phones | Fewer shadow-casting lights and objects (`setupEnvironment(game, { shadowArea: 25 })`), fewer animated characters, smaller levels. |

## Building & deploying

See [DEPLOY.md](DEPLOY.md#troubleshooting-a-deployed-game).

## FAQ

**Can I use TypeScript / React / another framework?** You can, but the kit (and everyone's teammates) assume plain JS. In a 48-hour jam, plain JS is the right call.

**Can I use 2D sprites instead of 3D models?** Yes: use `THREE.Sprite` or textured planes with an orthographic or fixed camera. The engine's input, UI, audio, menus and timers all still apply.

**Can I add more models?** Yes: see [ASSETS.md → Adding more packs](ASSETS.md#adding-more-packs), or drop `.glb` files into `public/models/`.

**Multiplayer?** See *Multiplayer* in [RECIPES.md](RECIPES.md#multiplayer). It's possible, but budget a full day for it.

**Is the art really free?** Yes. Everything in `public/assets/` is CC0 (public domain). Crediting Kay Lousberg and Quaternius is appreciated but not required.
