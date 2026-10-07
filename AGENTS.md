# Notes for AI coding assistants

This repo is a browser game starter kit: three.js + a small engine of primitives in `engine/` + CC0 models in `public/assets/`.

## Ground rules

- Plain JavaScript ES modules, no TypeScript, no framework. Import engine features from `'@engine'` (an alias for `engine/index.js`, which also re-exports `THREE`).
- Each game lives in `games/<name>/` with `index.html` + `main.js`. New games: `npm run new <name> [-- --from <sample>]`. Vite picks up new folders automatically, and the launcher lists them.
- **Read `docs/ENGINE.md` before writing code.** Prefer engine primitives over hand-rolled code: `Entity`, `CharacterController`, `FollowCamera` / `FirstPersonCamera` / `RTSCamera`, `Body` + `physics.addCollider`, `Animator`, `Health`, `StateMachine`, `NavGrid` + `PathFollower`, `Selection`, `game.ui.*`, `game.audio.play`, `game.effects.*`.
- The samples in `games/` are the best reference for idiomatic usage. Copy patterns from them.
- Prefer not to change `engine/` for one game's needs. Subclass or compose in the game folder instead. If you fix an engine bug, keep the API backwards compatible, because every sample depends on it.

## Assets

- Model URLs look like `/assets/<pack>/<file>.glb|.gltf`. **Look up real names in `docs/ASSET_LIST.md`; never guess a path.** It also lists every animation clip name.
- Load with `await game.assets.model(url, { scale | height })`. Preload with `await game.load([...urls])`.
- Native sizes vary a lot (Quaternius RTS buildings are ~1 unit wide, the platformer character is ~3.5 tall, KayKit characters ~2.5). See the size table in `docs/ASSETS.md`, or use `getSize(model)`.
- KayKit characters show every weapon by default. Hide extras with `setVisible(model, { Name: false })`. Their hand bones are `handslot.r` / `handslot.l`.
- `Animator.play()` matches names loosely (case-insensitive, ignores `Armature|` prefixes) and accepts arrays of fallbacks.

## Physics model

- All colliders are axis-aligned boxes (`physics.addCollider(obj)` uses the object's bounds; `{ dynamic: true }` for moving ones; `{ oneWay: true }` for jump-through).
- Characters use `Body` (position = feet). `new Game({ groundY: null })` removes the infinite floor.
- Raycasts: `game.physics.raycast(origin, dir, { maxDist, entities })`. Walls block hits on entities behind them.

## Checking your work

- `npm run dev`, then open the game. The browser console must stay free of errors.
- `window.game` is exposed for debugging. `game.physics.showDebug(game.scene)` draws colliders.
- `npm run build` must succeed.
