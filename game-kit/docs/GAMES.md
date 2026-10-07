# Sample games: a guided tour

Every folder in `games/` is a complete, playable game built only from the engine (`@engine` → `engine/index.js`) and the CC0 models in `public/assets/`.
Pick the sample closest to your idea, copy it with `npm run new <name> -- --from <sample>`, and change it.

This document describes what each sample contains, how it's wired together, and where to edit for the most common changes.
Every identifier below exists in the code. Paths are relative to `game-kit/`.

All samples share the same skeleton:

```js
const game = new Game(/* opts */);                 // renderer, scene, input, physics, ui, audio, effects
setupEnvironment(game, { sky: '…', ground: … });   // lights + sky (+ ground)
await game.load([...model urls]);                  // loading screen
/* … build the world, add entities … */
const menu = new GameMenu(game, { title, controls, touchControls, onStart });  // title / pause / win / game over
new TouchControls(game, { joystick, look, buttons });                          // phones only (or ?touch)
game.start();
```

`window.game` is always set (by `Game`), so `game.findAll('enemy')`, `game.timeScale = 0.3` or `game.paused = true` work in any sample's browser console.

## Comparison

| Game | Genre | Camera | Key primitives | Lines | Best starting point for… |
|---|---|---|---|---|---|
| 🌱 [Starter](#-starter--gamesstarter) | Collect-a-thon | `FollowCamera` (3rd person) | `CharacterController`, `Entity`, `physics.addCollider` | 86 | anything; the smallest complete game |
| 🎣 [Fish Frenzy](#-fish-frenzy--gamesfishing) | Fishing / collection | `FollowCamera` (fixed, aim-driven) | `StateMachine` (fishing loop), `attach`, `storage`, `ui.dialog` | 701 | fishing, cozy games, minigames, collection/progression |
| ⚔️ [Action RPG](#️-action-rpg--gamesrpg) | Hack & slash + quest | `FollowCamera` | `CharacterController` subclass, `StateMachine` AI, `Health`, `Body`, `ui.dialog` | 561 | RPG, adventure, survival, melee combat |
| 🍄 [3D Jump & Run](#-3d-jump--run--gamesplatformer) | 3D platformer | `FollowCamera` | `CharacterController` (`maxJumps: 2`), dynamic colliders, data-driven level | 445 | 3D platformers, obbies, collect-a-thons |
| 🧱 [Side-Scroller](#-side-scroller--gamessidescroller) | Mario-like 2.5D | custom side camera (`game.onUpdate`) | ASCII level, `Body.ceiling`, `CharacterController` locked to X | 423 | side-scrollers, endless runners, metroidvanias |
| 🗼 [Castle Defense](#-castle-defense--gamestowerdefense) | Tower defense | `RTSCamera` | `PathFollower`, projectiles, wave tables, `game.timeScale` | 528 | tower defense, lane/wave survival |
| 🎯 [Arena Shooter](#-arena-shooter--gamesshooter) | FPS wave survival | `FirstPersonCamera` | `Body`, `physics.raycast` hitscan, `StateMachine` AI, `GameMenu({ lockPointer })` | 474 | FPS, arena shooters, horde modes |
| 🏰 [Tiny Empires](#-tiny-empires--gamesstrategy) | RTS (AoE-like) | `RTSCamera` | `Selection`, `NavGrid` + `PathFollower`, order-driven units, training queues | 791 | RTS, city builders, colony sims, tactics |

---

## 🌱 Starter — `games/starter/`

The smallest complete game: walk around a field and collect 10 coins. URL: `/games/starter/`.

**Files**

| File | Responsibility |
|---|---|
| `games/starter/main.js` (~86 lines) | Everything, as numbered steps 1–9 |
| `games/starter/index.html` | Page shell (shared by all samples: loads `engine/base.css` + `./main.js`) |

**How it works**

- `MODELS` lists the 4 model URLs, which are preloaded with `game.load(Object.values(MODELS))`.
- Player: `new CharacterController(game, heroModel, { speed: 7 })` + `FollowCamera`; `player.camera = camera` makes WASD camera-relative.
- Scenery: 25 random trees/rocks, each made solid with `game.physics.addCollider(prop, { padding: -0.6 })`.
- `class Coin extends Entity` spins, bobs, and checks `distXZ(this.position, player.position) < 1.2` every frame to get collected.
- When `collected === TOTAL`: `menu.win({ text, score: Math.round(1000 - game.time * 5) })`.
- `GameMenu` (title "Coin Collector") + `TouchControls` (joystick, look, Jump).

**Tuning knobs**: `TOTAL` (coin count), `{ speed: 7 }` on the controller, `{ distance: 10 }` on the camera, the `for (let i = 0; i < 25; …)` scenery loop, `sky: 'day'` in `setupEnvironment` (try `'sunset'`, `'night'`, `'underwater'`).

**Common changes**

- *Different hero:* change `MODELS.hero` (any KayKit character works with the default animation names) and adjust the `setVisible(...)` loadout. For Quaternius `Character.glb` use `{ scale: 0.55 }` and pass `animations: { idle: 'Idle', run: 'Run', walk: 'Walk', jump: 'Jump', fall: 'Jump_Idle' }`.
- *Double jump:* `new CharacterController(game, heroModel, { speed: 7, maxJumps: 2 })`.
- *Time limit:* `game.after(60, () => menu.gameOver({ text: 'Out of time!', score: collected }))`.
- *Enemies:* copy `games/rpg/enemy.js` next to `main.js`; see [Mixing samples](#mixing-samples).
- *Start a new game from here:* `npm run new my-game` (copies this folder).

**Controls**: WASD move · Space jump · Shift sprint · right-drag orbit · wheel zoom · Esc pause. Touch: stick, drag to look, Jump button.

**Debug hooks**: only `game`. `game.find('player').teleport(game.find('player').position.clone().set(0, 0, 0))`, `game.findAll('coin').length`.

**Gotchas**

- `score` and `menu` are declared after the `Coin` class but used inside `update()`. That's fine at runtime, because `update` only runs after `game.start()`, but don't call those methods before the declarations.
- Coins spawn at random positions and may overlap trees.

---

## 🎣 Fish Frenzy — `games/fishing/`

Cast from a dock, wait for a bite, hook it, and win a line-tension tug-of-war. 35 species, 5 rarities, rod and lure shop, fish journal, saved progress. URL: `/games/fishing/`.

**Files**

| File | Responsibility |
|---|---|
| `games/fishing/data.js` (~98) | `CONFIG`, `SPECIES` (35 fish), `RODS`, `LURES`, `RARITY_COLOR`, `fishUrl(name)`, `rollSpecies(lureLevel)` |
| `games/fishing/fish.js` (~66) | `class Fish extends Entity` (modes `wander` / `approach` / `hooked` / `flee` / `caught`), `Fish.spawn(game, species, pos)`, `randomUnderwater(maxR)` |
| `games/fishing/main.js` (~537) | Lake geometry, dock, angler + rod, bobber and line, **the fishing `StateMachine`**, reel minigame, HUD, shop, journal, menu, touch |

**How it works**

- The whole loop is one `StateMachine` named `fishing` in `main.js`. Its states are `ready → charging → casting → waiting → nibbling → bite → reeling → caught → ready`, plus `retrieve` (bobber flies back after a miss or early reel-in). `lose()` makes the fish flee and goes to `retrieve`.
- Input is abstracted by `act()` / `actPressed()` / `actReleased()` (Space **or** left mouse), so the touch "🎣 Cast" button (`key: 'Space'`) works everywhere.
- The lake is built from raw three.js: a `ShapeGeometry` ground with a circular hole, an open `CylinderGeometry` bank, a lakebed disc, and a transparent water `CircleGeometry` at `CONFIG.lake.water` (`-0.3`). There's no physics here (`Game` keeps its default floor at y=0, but nothing uses it).
- Angler = KayKit `Rogue.glb`. The rod is attached via `attach(hero, 'handslot.r', rodHolder)`. `equipRod(level)` computes the rod's local rotation from the bone's world rotation so it points forward and up. The line runs from `rodTip` (an `Object3D` at the rod's top) to `bobber` along a `QuadraticBezierCurve3` (`updateLine()`, sag = `lineSag`).
- In `waiting`, after `rand(...CONFIG.waitTime) / (1 + save.lure * 0.15)` seconds, `rollSpecies(save.lure)` picks a species, `Fish.spawn` creates it 12 units away, and `fish.approach(castTo)`.
- Reeling (`reeling.update`): `reel.pull` bursts scaled by `species.strength`. `reel.tension` rises while reeling (divided by `rod.tension`) and falls otherwise. `≥ 1` snaps the line, `reel.distance > rod.range + 12` lets the fish escape, and `< 2` means `caught`.
- `caught` computes weight and value, updates `save.journal[name] = { count, best }` and `save.coins`, calls `persist()`, then `showCatchCard()` (a `game.ui.dialog`). `checkTournament(isNew)` calls `menu.win(...)` when `caughtCount() === CONFIG.tournamentGoal`.
- Shop and journal are `game.ui.dialog`s (`openShop()`, `openJournal()`), opened with B / J or the top-left `ui.buttons`.

**Tuning knobs** (all in `games/fishing/data.js`)

- `CONFIG.chargeTime`, `CONFIG.waitTime: [min, max]`, `CONFIG.nibbles: [min, max]`, `CONFIG.biteWindow` (seconds to hook), `CONFIG.aimLimit` (radians), `CONFIG.ambientFish`, `CONFIG.fishScale` (multiplies every species' `scale`), `CONFIG.tournamentGoal`.
- `CONFIG.rarityWeight` (base odds) and `CONFIG.lureBoost` (extra odds per lure level, per rarity).
- `SPECIES[]`: `{ name, rarity, kg: [min, max], value, strength, scale }`. `name` must be a file in `/assets/quaternius-fish/`.
- `RODS[]`: `{ level, cost, reel, tension, range }`. `LURES[]`: `{ level, name, cost }` (model `Lure_<level>.glb`).

**Common changes**

- *Add a fish:* append to `SPECIES` in `data.js`, e.g. `{ name: 'Barracuda', rarity: 'epic', kg: [5, 40], value: 260, strength: 1.0, scale: 0.3 }`. All 35 models of the Quaternius fish pack are already used, so a new `name` needs a new model at `public/assets/quaternius-fish/<name>.glb` (or change `fishUrl()` to look elsewhere). Names must be unique: the journal is keyed by `name`. The journal and HUD count update automatically.
- *Make reeling easier:* raise every `RODS[i].tension`, or lower the `0.9` pull factor in `reeling.update` (`reel.tension += (reeling ? 0.5 + reel.pull * 0.9 : -0.7) * dt / rod.tension`).
- *Longer hook window:* `CONFIG.biteWindow = 1.5`.
- *Sell fish instead of auto-coins:* in `caught.enter`, replace `save.coins += value` with your own inventory, then add a "Sell" choice to `openShop()`.
- *New gear type (e.g. bait):* add a table in `data.js`, a field to the `save` default object in `main.js` (`storage.load('fishing-save', { … })`), and an `items.push(...)` entry in `openShop()`.
- *Different location:* change `CONFIG.lake.radius` / `depth`, `setupEnvironment(game, { sky: 'sunset', … })`, and the prop lists in `M`.
- *Wipe the save while testing:* `localStorage.removeItem('fishing-save')`, then reload.

**Controls**: A/D or mouse aim · hold Space / left click to charge, release to cast · Space/click when the bobber dives to hook · hold to reel · B shop · J journal · Esc pause. Touch: stick aims, 🎣 Cast (hold/release), Shop, Journal.

**Debug hooks**: `window.fishingDebug = { fishing, save, reel, fish }` (`fish` is a getter for the current fish).
- `fishingDebug.fishing.state`: current state name.
- `fishingDebug.save.coins = 5000`: then press B to buy gear.
- `fishingDebug.reel.tension = 0`: rescue a fight.

**Gotchas**

- Only common and uncommon species are preloaded. Rarer fish load on demand when they bite (`Fish.spawn` awaits the model), which can delay their arrival slightly.
- `equipRod()` hardcodes the rod-tip height: `rodTip.position.set(0, (level === 5 ? 6.9 : 4.9), 0)`. New rod models need their own value.
- The dock height is hardcoded: `dock.position.set(0, DECK_Y - 3.83 * CONFIG.dock.scale, …)` (3.83 = native deck height of `Dock_Long.glb`).
- Fish face +Z (`Math.atan2(to.x, to.z)` in `fish.js`). They swim through dock posts (no collision).
- Progress persists in `localStorage['fishing-save']` across reloads and restarts.

---

## ⚔️ Action RPG — `games/rpg/`

Third-person hack & slash: talk to the wizard, slay skeletons in the ruins, defeat the Skeleton King. XP and levels, loot, potions, chests. URL: `/games/rpg/`.

**Files**

| File | Responsibility |
|---|---|
| `games/rpg/main.js` (~395) | `CONFIG`, model map `M`, `WORLD` prop list, `class Hero extends CharacterController`, `Pickup`, `Interactable`, chests, quest + wizard dialog, spawner, HUD, menu, touch |
| `games/rpg/enemy.js` (~166) | `ENEMY_TYPES` (`minion`, `warrior`, `rogue`, `king`) and `class Skeleton extends Entity` with its `StateMachine` AI |

**How it works**

- `WORLD` is an array of `[modelKey, x, z, rotationYDegrees, solid]`. Each entry is placed and, if `solid`, made solid with `game.physics.addCollider(obj)`. `torch` entries also get a `PointLight`. Four invisible `physics.addBox` walls bound the map.
- `Hero` extends the stock `CharacterController`. It adds `attack()` (sets `locked = true` and plays a 3-swing combo; after `0.18 s`, damages enemies within `CONFIG.hero.attackRange * enemy.def.scale` in front (`dot > CONFIG.hero.attackArc`), with a 15% crit), plus `hurt(amount, source)`, `gainXp()`, `drinkPotion()` and `die()` (respawn after 3 s, lose half your gold). The hero's `tags` include `'player'`, but it is removed while dead.
- `Skeleton` (enemy.js) has a `Body` for wall collisions, an `Animator`, `Health`, `ui.worldBar`, and `this.ai = new StateMachine(...)` with states `spawn → idle ⇄ wander → chase → attack / hit → return → dead`. It finds the player with `game.find('player')` and hits via `p.hurt(def.damage, this)`. Constants: `AGGRO_RANGE = 14`, `ATTACK_RANGE = 2.0`, `LEASH_RANGE = 30`.
- `Interactable extends Entity`: shows a `worldLabel` when the hero is within `range` and calls `onUse(self)` on E. It's used by chests (`placeChest(x, z, gold, potions)`) and the wizard.
- Quest: `quest.stage` goes `'start' → 'hunt' → 'return' → 'boss' → 'done'`, driven by `talkToWizard()` (dialogs) and `onEnemyKilled(enemy)`. Accepting the quest calls `startSpawning()`, which uses `game.every(CONFIG.spawn.every, spawnOne)` capped at `maxAlive`. Stage `'boss'` calls `spawnBoss()`. Killing the king calls `menu.win({ score: hero.level * 100 + hero.gold })`.
- HUD: `hpBar`, `xpBar` (`xpForLevel(lvl)`), `stats`, `questText`, all refreshed by `hud()`.

**Tuning knobs**

- `CONFIG.hero`: `hp`, `damage`, `speed`, `attackRange`, `attackArc`.
- `CONFIG.levelUp`: `xpBase`, `xpGrowth`, `hpPerLevel`, `damagePerLevel`.
- `CONFIG.spawn`: `every`, `maxAlive`, `area: { x, z, radius }`, `types`.
- `CONFIG.quest.killsNeeded`, `CONFIG.potionHeal`.
- `ENEMY_TYPES[type]` (enemy.js): `model`, `hp`, `damage`, `speed`, `xp`, `gold: [min, max]`, `scale`, optional `hide` (part names) and `boss: true` (no flinch, purple bar).

**Common changes**

- *New enemy type:* add to `ENEMY_TYPES` in `games/rpg/enemy.js`, e.g. `mage: { model: '/assets/kaykit-skeletons/Skeleton_Mage.glb', hp: 35, damage: 12, speed: 3, xp: 20, gold: [2, 5], scale: 1 }`, then add `'mage'` to `CONFIG.spawn.types`. Its model URL is preloaded automatically (`Object.values(ENEMY_TYPES).map((t) => t.model)`).
- *Ranged enemy:* add a state to `this.ai` in `Skeleton` (e.g. `shoot`) that spawns a projectile entity (see "Projectiles" in `docs/RECIPES.md`), and go to it from `chase` when `distXZ(...) < 10`.
- *New prop or building:* add a key to `M` and a row to `WORLD`, e.g. `['chest', 6, -10, 0, true]`.
- *New NPC:* `const npc = game.add(new Interactable(model, '💬 Talk [E]', async () => { await game.ui.dialog('Name', 'Text', ['OK']); }))`, then `npc.position.set(x, 0, z)` and an `Animator` updated via `npc.onUpdate(...)`, as the wizard does.
- *Longer quest:* add stages to the `if/else` in `talkToWizard()` and to the object in `hud()`, and advance them in `onEnemyKilled()`.
- *Ranged hero:* in `Hero.attack()`, replace the melee loop with `game.physics.raycast(origin, forward, { entities: game.findAll('enemy') })` and play `'1H_Ranged_Shoot'`.
- *Stronger start:* `CONFIG.hero.damage = 30`, or give potions with `hero.potions = 5` after `new Hero(...)`.

**Controls**: WASD move · Space jump · Shift sprint · left click / F attack · E talk/open · 1 potion · right-drag orbit · wheel zoom · Esc pause. Touch: stick, drag to look, ⚔️ (F), Jump, 💬 (E), 🧪 (1).

**Debug hooks**: only `game`.
- `game.find('player').gainXp(500)`
- `game.find('player').health.reset()`
- `game.find('player').gold = 999`
- `game.findAll('enemy').forEach(e => e.health.damage(999))`

**Gotchas**

- KayKit models show every weapon by default. Both `Hero` and the wizard call `setVisible(...)` to hide extras.
- Enemy reach scales with `def.scale` (the king at `1.6` hits from further away).
- The spawner (`startSpawning()` → `stopSpawning`) runs until the Skeleton King dies; `onEnemyKilled` calls `stopSpawning()` for the boss.
- The "👑 Skeleton King" `worldLabel` created in `spawnBoss()` is never removed when the king dies.

---

## 🍄 3D Jump & Run — `games/platformer/`

A 3D obstacle course: double jump, moving platforms, a spring, saws, spikes, stompable enemies, checkpoints and a goal flag. URL: `/games/platformer/`.

**Files**

| File | Responsibility |
|---|---|
| `games/platformer/level.js` (~75) | `LEVEL`: the whole course as an array of `{ type, … }` items (documented at the top of the file) |
| `games/platformer/main.js` (~370) | `CONFIG`, `Player`, hearts/lives, one class per object type, `buildLevel()`, menu, touch |

**How it works**

- `new Game({ groundY: null, gravity: CONFIG.gravity })` has no floor: falling below `CONFIG.fallY` calls `loseLife()`.
- `buildLevel()` `switch`es on `it.type`. Item types: `start`, `platform`, `moving`, `coin`, `coins`, `gem`, `enemy`, `spikes`, `saw`, `bouncer`, `checkpoint`, `goal`, `tree`, `bush`. Unknown types log `console.warn('Unknown level item', it)`.
- Platforms: `addBlock(pos, size, style)` scales a 2×2×2 Quaternius cube to `size`. `pos.y` is the **top** surface. Collision is `game.physics.addBox(center, size)`.
- `MovingPlatform` lerps between `from` and `to` with a sine (`period` seconds) and has `game.physics.addCollider(plat.object, { dynamic: true })`. Riders are carried by `Body`. `game.add(player)` happens **after** `buildLevel()` so platforms move first.
- `Enemy` patrols `from ↔ to` (pure lerp, no `Body`). Touching its hitbox while falling and above `position.y + 0.7` stomps it (`player.launch(CONFIG.stompBounce)`); otherwise `hurt(this.position)`.
- `Hazard` (spikes and saws) is a hurt box. `Bouncer` launches when `player.body.ground === this.collider`. `Checkpoint` sets `respawnPoint`. `Goal` calls `menu.win({ score: coins * 100 + max(0, (180 - game.time) * 10) })`.
- Damage: a shared `Health(CONFIG.hearts, { invulnerableTime: 1.5 })`. At 0 hearts, `loseLife()` respawns at `respawnPoint`; at 0 lives, `menu.gameOver(...)`. `Player.update` blinks the model while invulnerable.

**Tuning knobs**: `CONFIG.speed`, `jumpSpeed`, `maxJumps`, `gravity`, `hearts`, `lives`, `bounceSpeed`, `stompBounce`, `gemValue`, `fallY`. Per item: `moving.period`, `enemy.speed`, `saw.period`.

**Common changes**

- *Extend the course:* append to `LEVEL` in `level.js`, e.g. `{ type: 'platform', pos: [0, 16, -130], size: [6, 4, 6], style: 'bricks' }`. Per the comment there, a single jump reaches about 2 up and 4.5 across; a double jump about 4 up and 8 across.
- *A row of coins:* `{ type: 'coins', from: [0, 17, -125], to: [0, 17, -135], count: 5 }`.
- *New object type (e.g. a falling platform):* write `class Falling extends Entity { … }` in `main.js`, then add `case 'falling': { … game.add(new Falling(model, …)); break; }` to `buildLevel()`.
- *Triple jump / floatier feel:* `CONFIG.maxJumps = 3`, `CONFIG.gravity = -22`.
- *Different hero:* change `M.hero` and the `{ scale: 0.55 }` / `height: 1.7` passed to `new Player(...)`. For KayKit characters remove the scale (they're ~2.5 tall) and drop the `Wave` idle in `Goal`.
- *Timer-based score:* edit the `score` formula in `Goal.update()`.

**Controls**: WASD/arrows move · Space jump (again in the air = double jump, release early = short hop) · Shift sprint · right-drag orbit · Esc pause. Touch: stick, drag to look, Jump.

**Debug hooks**: only `game`.
- `game.find('player').teleport(game.find('player').position.clone().set(0, 17, -110))` jumps near the goal.
- `game.physics.showDebug(game.scene)` shows colliders (cyan = one-way, orange = dynamic).

**Gotchas**

- Enemy `from`/`to` y must equal the platform top: enemies don't fall or collide; they slide on a line.
- `Goal` sets `player.anims.idle = 'Wave'`. That clip exists in Quaternius `Character.glb`, but not in KayKit rigs (use `'Cheer'` there).
- Quaternius cubes are **centred** on their origin (bottom at y = −1). `addBlock` compensates with `model.position.set(pos.x, pos.y - size.y / 2, pos.z)`.
- Death by falling sets `health.hp = 0` directly, then calls `loseLife()`.

---

## 🧱 Side-Scroller — `games/sidescroller/`

A classic "World 1-1": ? blocks, breakable bricks, a star power-up, stompable walkers, pipes, pits, staircases, a flag and a 300-second clock. URL: `/games/sidescroller/`.

**Files**

| File | Responsibility |
|---|---|
| `games/sidescroller/main.js` (~423) | `CONFIG`, `LEVEL` (ASCII), `TILES`, level builder, `Player`, blocks/coins/`Star`, `Walker`, camera, goal, timer, HUD, menu, touch |

**How it works**

- It's a normal 3D scene where everything lives on z = 0 and the camera looks from +z (`game.camera.position.set(cam.x, cam.y + 2, 32)` in a `game.onUpdate`). `new Game({ gravity: CONFIG.gravity, groundY: null, fov: 40 })`.
- `LEVEL` is ASCII: one character = one 2×2 tile (`T = 2`), and rows are top → bottom. `tilePos(c, r)` = tile centre; the bottom row spans y 0–2. Legend: `#` ground, `X` hard block, `B` brick, `?` coin block, `S` star block, `[` pipe top, `|` pipe body, `o` coin, `e` enemy, `P` player start, `F` flag.
- Collision: horizontal runs of `#`/`X` in each row are merged into **one** `physics.addBox` (fewer boxes = faster). Bricks and ? blocks each get their own box with `collider.block = { kind, gives, model, collider, home, bump }`.
- `Player extends CharacterController`. A fake camera `{ toWorld: ({ x }) => v3(x, 0, 0) }` maps input to the X axis only. `update()` clamps z to 0, faces ±X, and checks `this.body.ceiling?.block` to call `bumpBlock(block)`. Power state: `grow()` (scale 0.72, `body.height = 2.3`), `hurt()` (shrink if big, else `die()`), `die()` (death hop, no collisions).
- `bumpBlock(block)`: a brick breaks only when `player.big` (it removes the collider and model); a `?` block swaps to the "used" model and calls `collectCoin(...)` or spawns a `Star` (which slides with its own `Body`, starting left).
- `Walker` (enemy) sleeps until `this.position.x - game.camera.position.x < 26`, walks with a `Body`, turns on `body.hitWall`, and is stomped if the player is falling and above half its height.
- Losing a life reloads the page: `die()` saves `{ lives, score, coins }` under `storage` key `'ss-run'` and calls `menu.restart()`; the next load reads and clears it. At 0 lives it calls `menu.gameOver`. Reaching `flagX` calls `winLevel()` (time bonus), then `menu.win`.

**Tuning knobs**: `CONFIG.gravity` (−60 is snappy), `runSpeed`, `sprint`, `jumpSpeed` (28 ≈ 3.5 tiles), `stompBounce`, `enemySpeed`, `time`, `lives`, and `CONFIG.score.{coin, stomp, brick, star, timeBonus}`. Swap tile models in `TILES`.

**Common changes**

- *Edit the level:* change the `LEVEL` string. Rows may have different lengths (they're padded). Keep the bottom two rows as ground, because `groundTop = 2 * T` is used for decoration and flag height.
- *New tile type (e.g. `^` spikes):* in the level-building loop, add `if (ch === '^') { … }` that places a model and registers a hurt check (e.g. an `Entity` whose `update` tests `player.body.box.intersectsBox(box)` and calls `player.hurt()`).
- *Coin block → 1-up:* in `bumpBlock`, branch on a new `gives` value (set it in the builder for a new character such as `L`) and do `state.lives++`.
- *Faster enemies:* `CONFIG.enemySpeed = 4`. For an enemy that doesn't fall off edges, check the ground ahead in `Walker.update` with `game.physics.query(box)` before moving.
- *Endless runner:* force `player.body.velocity.x = CONFIG.runSpeed` every frame in `Player.update` and generate tiles ahead of `cam.x`.
- *Second level:* make `LEVEL` an array of strings, store the index in `storage`, and call `menu.restart()` in `winLevel()` instead of `menu.win`.

**Controls**: A/D or ←/→ run · Space jump (hold = higher) · Shift run faster · Esc pause. Touch: stick, Jump, Run.

**Debug hooks**: only `game`.
- `game.find('player').grow()`
- `game.findAll('enemy').forEach(e => e.destroy())`
- `storage.remove('ss-run')` (forget a run in progress)

**Gotchas**

- Score and coins **reset** when you lose a life (the page reloads); only lives carry over.
- The camera never goes left of x = 20 (`Math.max(20, …)`), so the first ~10 columns are partly off-screen.
- Dying disables collisions by bypassing `Body.move()` in `Player.update` (`if (this.dead) …`).
- The star always starts sliding left (`this.body.velocity.x = -4`). A pit directly to the left eats it.

---

## 🗼 Castle Defense — `games/towerdefense/`

Classic tower defense: archer, cannon and frost towers with 3 upgrade levels each, 10 waves along a winding road, a boss, early-call bonus and 2× speed. URL: `/games/towerdefense/`.

**Files**

| File | Responsibility |
|---|---|
| `games/towerdefense/main.js` (~528) | `MAP`, `CONFIG`, `TOWERS`, `ENEMIES`, `WAVES`, road tracing, `Enemy`, waves, `Tower`, `Projectile`, build/select/upgrade/sell UI, camera, HUD, menu |

**How it works**

- `MAP`: ASCII with 4×4 tiles (`CELL = 4`). `S` spawn, `=` road, `C` castle, `T` tree, `R` rock, space = buildable. `cellPos(c, r)` / `cellOf(p)` convert between grid and world. The road is traced from `S` by following the one unvisited road neighbour, producing `waypoints` (plus one off-map start point).
- `Enemy extends Entity` uses `PathFollower` along `waypoints`; `onArrive` → `reachCastle()` (lose `def.damage` lives). `this.progress` = distance walked, used for targeting. `slow(factor, seconds)` lowers `follower.speed` and animation speed.
- Waves: `startWave()` walks `WAVES[state.wave - 1]` groups and awaits `game.after(every)` between spawns (game time, so it respects pause and 2× speed). A `game.onUpdate` starts the next wave when `game.time >= state.nextWaveAt` and declares the win when the last wave is done and no enemies are left.
- `Tower extends Entity`: `setLevel(level)` swaps the model and records `topY` (projectile origin). `update()` picks the enemy with the highest `progress` within `range` via `game.findNear(...)` and fires every `def.rate[level]` seconds.
- `Projectile extends Entity` has three behaviours keyed by `tower.def.projectile`: `'arrow'` (homing, speed 35), `'frost'` (homing, speed 22, calls `target.slow(def.slow[level], 2)`), and `'ball'` (lobbed at the target's current position over `flight` seconds, splash damage via `game.findNear(dest, def.splash[level], 'enemy')`).
- UI: `placing` (tower type being placed) and `selected` (Tower). A hover `highlight` square turns green or red; `rangeRing` shows range. `ui.buttons` `buildBar` / `towerPanel` are refreshed by `refreshButtons()` when gold changes.

**Tuning knobs**

- `CONFIG`: `startGold`, `lives`, `firstWaveDelay`, `waveDelay`, `hpGrowth` (+x% enemy hp per wave), `sellRefund`.
- `TOWERS[type]`: per-level arrays `cost`, `range`, `damage`, `rate` (seconds between shots), `models`, `scale`, plus `splash` (cannon) / `slow` (frost), `projectile`, `key`, `icon`.
- `ENEMIES[type]`: `model`, `scale`, `hp`, `speed`, `bounty`, `damage` (lives lost), optional `hide`, `boss`.
- `WAVES`: an array of waves. Each wave is a list of `[enemyType, count, secondsBetweenSpawns]` groups, spawned in order.

**Common changes**

- *New tower (e.g. poison):* add `TOWERS.poison = { name: 'Poison', key: 'Digit4', icon: '☠️', cost: [80, 90, 140], range: [10, 11, 12], damage: [2, 3, 5], rate: [0.5, 0.45, 0.4], models: [...3 urls], scale: [2.6, 2.6, 2.9], projectile: 'frost' }`. The build bar and hotkeys come from `TOWERS` automatically. For a new effect, add a branch in `Projectile.hit()`.
- *New enemy:* add to `ENEMIES` (e.g. `rat: { model: '/assets/quaternius-enemies/Rat.glb', scale: 0.4, hp: 20, speed: 7, bounty: 4, damage: 1 }`) and reference it in `WAVES`. Models are preloaded from `ENEMIES` automatically.
- *More waves:* push more arrays to `WAVES`. The HUD and win condition use `WAVES.length`.
- *New map:* edit `MAP`. Keep exactly one `S`, one `C`, and a road with no branches or adjacent parallel road tiles (the tracer follows the single unvisited neighbour).
- *Flying enemies that skip the road:* give `Enemy` a different `waypoints` list (e.g. `[spawn, castle]`) when `def.flying`.
- *Interest / economy:* in `startWave()`, add `state.gold += Math.floor(state.gold * 0.1)`.
- *Harder late game:* raise `CONFIG.hpGrowth`.

**Controls**: 1/2/3 pick a tower and click grass to build · click a tower to select · U upgrade · X sell · right click cancel · N next wave (bonus gold) · F 2× speed · WASD/arrows/middle-drag pan · wheel zoom · Q/E rotate · Esc pause. Touch: on-screen build buttons + tap grass, tap a tower to upgrade/sell, stick pans, +/− zoom.

**Debug hooks**: `window.td = { state, startWave, spawnEnemy, TOWERS, ENEMIES }`.
- `td.state.gold = 9999`
- `td.spawnEnemy('king')`
- `td.startWave()`
- `td.state.wave = 10` (wins once the field is clear)
- `game.timeScale = 4`

**Gotchas**

- `Tower.update()` doesn't shoot until `setLevel()` has loaded the model and set `topY`.
- Tower star labels are hidden with `style.visibility`, not `display` (the UI rewrites `display` every frame for world labels).
- Waves auto-start `CONFIG.waveDelay` seconds after the previous wave finishes **spawning**, even if enemies are still alive.
- Short `MAP` rows are fine: `at(c, r)` treats anything outside the text as `'T'` (unbuildable).
- Enemies enter from 2 tiles outside `S`, along the direction of the first road tile, so `S` can sit on any map edge.

---

## 🎯 Arena Shooter — `games/shooter/`

First-person wave survival in a grey-box arena: rifle and pistol, reloads, headshots, skeleton waves, health and ammo drops. URL: `/games/shooter/`.

**Files**

| File | Responsibility |
|---|---|
| `games/shooter/main.js` (~474) | `CONFIG` (player, weapons, enemies, waves), `PROPS` / `LAYOUT` / `SPAWNS`, player body + camera, weapons, `fire()`, `class Skeleton`, waves, pickups, HUD, game over, `buildArena()` |

**How it works**

- Player: `const body = new Body(game.physics, …)` + `const fps = game.add(new FirstPersonCamera(game, body, { eyeHeight: 1.6 }))`. `movePlayer(dt)` moves along `fps.toWorld(input.move())`.
- Weapons: `slots[]`, one per `CONFIG.weapons` entry: `{ w, model, ammo, reserve, cd: cooldown(1 / w.fireRate) }`. `makeGun(w)` loads the gun, turns it from +X to −Z, adds a `muzzle` `Object3D` + flash, and parents it to `game.camera`. That's why `game.scene.add(game.camera)` is called. `handleWeapon(dt)` handles switching (1/2/Q), reloads, trigger, bob, recoil and dip.
- `fire(slot)`: hitscan with `game.physics.raycast(origin, dir, { maxDist: 120, entities: game.findAll('enemy') })` from the camera. Walls block hits. A hit at `y > entity.position.y + entity.height * 0.7` is a headshot (`CONFIG.headshotMultiplier`).
- `Skeleton extends Entity` (separate from the RPG's). It adds an invisible box `hitbox` and disables raycasts on the skinned meshes (faster). `this.ai` states are `spawn` (rise from the ground) → `chase` → `attack` → `hit`, plus `cheer` and `dead`. `steer(speed)` faces the player and adds separation. Damage enters via `takeHit(dmg, point, head)`.
- Waves: `startWave()` sets `state.toSpawn = CONFIG.waves.first + (wave - 1) * growth`. `updateWaves(dt)` spawns every `spawnInterval` from `CONFIG.waves.pool(wave)` at a random `SPAWNS` point. A wave is cleared when nothing is left to spawn, nothing is loading (`state.loading`), and no enemies remain. The next wave starts 3 s later.
- Menu: `GameMenu({ lockPointer: true, onStart: () => startWave() })`. Play and Resume capture the mouse, and Esc (pointer unlock) pauses. `fire` only runs when `menu.playing`. Death: `gameOver()` makes all skeletons `cheer`, then `menu.gameOver({ score })` after 1.5 s.

**Tuning knobs**

- `CONFIG.player`: `health`, `speed`, `sprint`, `jump`.
- `CONFIG.weapons[]`: `name`, `model`, `length` (view-model size), `damage`, `fireRate` (shots/s), `mag`, `reserve` (`Infinity` allowed), `reload` (s), `spread`, `auto`, `kick`, `pitch` (sound).
- `CONFIG.enemies[type]`: `url`, `hp`, `speed`, `damage`, `score`, `weapon` (a file in `/assets/kaykit-skeletons/`).
- `CONFIG.waves`: `first`, `growth`, `spawnInterval`, `pool(wave)`. Also `CONFIG.dropChance` and `CONFIG.headshotMultiplier`.
- Arena: `ARENA_HALF`, `PROPS`, `LAYOUT` (`{ m, x, z, s?, r? }`), `SPAWNS`.

**Common changes**

- *New weapon (shotgun):* add to `CONFIG.weapons`: `{ name: 'Shotgun', model: '/assets/quaternius-scifi-guns/SMG_1.glb', length: 0.5, damage: 12, fireRate: 1.2, mag: 6, reserve: 36, reload: 2, spread: 0.08, auto: false, kick: 0.06, pitch: 0.7 }`. For pellets, loop `fire`'s raycast part several times. The `Digit2` hotkey only covers slot 2; Q cycles through all.
- *New enemy:* add to `CONFIG.enemies` (e.g. `mage: { url: '/assets/kaykit-skeletons/Skeleton_Mage.glb', hp: 50, speed: 3, damage: 10, score: 200, weapon: 'Skeleton_Staff' }`) and include it in `CONFIG.waves.pool`. Models are preloaded from `CONFIG.enemies`.
- *Move the arena:* edit `LAYOUT`. Each item is solid automatically (`placeProp` → `physics.addCollider`). Add a model under `PROPS` with its `lift` (half its height if it's centred on its origin).
- *Explosive barrels:* tag barrels as entities with `Health`, include them in `entities` in `fire()`, and on death call `game.findNear(pos, 4, 'enemy')` → `takeHit`, plus `game.effects.shake(0.6)`.
- *Projectile weapon:* in `fire()`, spawn a moving `Entity` instead of raycasting (see "Projectiles" in `docs/RECIPES.md`).
- *Top-down shooter:* replace `FirstPersonCamera` with `RTSCamera` and aim at `game.mouseGround()`.

**Controls**: click/Play captures the mouse · mouse look · WASD move · Space jump · Shift sprint · left click shoot · R reload · 1/2/Q weapons · Esc pause. Touch: stick, drag to aim, Fire (`mouse: 0`), Jump, Reload, Swap.

**Debug hooks**: `window.shooter = { state, player, slots, fire, fps, game }`.
- `shooter.player.health.heal(100)`
- `shooter.slots[0].reserve = 999`
- `shooter.state.score`
- `game.findAll('enemy').forEach(e => e.takeHit(999, e.position, false))`

**Gotchas**

- Pointer lock doesn't work in headless browsers. Shooting still works because the aim is `fps.forward()`, the screen centre.
- Guns are modelled along +X; `makeGun` applies `model.rotation.y = Math.PI / 2` to face −Z.
- `Floor_Prototype` tiles are placed at y = −0.5 so their top is the physics floor at y = 0.
- `spawnEnemy` is async: `state.loading` stops a wave from counting as cleared while models load.

---

## 🏰 Tiny Empires — `games/strategy/`

A small Age of Empires: gather wood, gold and food with villagers, build houses, farms and barracks, train knights, and survive 5 skeleton raids. URL: `/games/strategy/`.

**Files**

| File | Responsibility |
|---|---|
| `games/strategy/data.js` (~92) | `CONFIG`, `RESOURCES`, `UNITS`, `BUILDINGS`, `NODES`, `ALL_MODELS` |
| `games/strategy/world.js` (~53) | Shared `world` state (`game`, `nav`, `stock`, `wave`, `over`) + helpers `canAfford`, `pay`, `costText`, `teamOf`, `nearest`, `approachPoint`, `population`, `callForHelp` |
| `games/strategy/units.js` (~198) | `class Unit extends Entity` (order-driven AI), `spawnUnit(type, team, pos)` |
| `games/strategy/buildings.js` (~144) | `class Building` (construction, training queue, collapse), `spawnBuilding(type, team, pos, built)`, `class ResourceNode`, `spawnNode(kind, pos)` |
| `games/strategy/main.js` (~304) | Map (`buildMap()`), `Selection`, right-click `issueOrders()`, build placement ghost, HUD/buttons, raids, win/lose, menu, touch |

**How it works**

- Teams are tags: every unit and building is tagged `'player'` or `'enemy'` plus `'unit'` / `'building'` and its type. `teamOf(team, tag)` lists living members.
- Units are **order-driven**. `unit.command(order)` takes `{ type: 'move' | 'attack' | 'gather' | 'build', point?, target? }`, and `update()` dispatches to `doAttack` / `doGather` / `doBuild`. With no order, `autoAcquire()` engages enemies within `def.sight` (raiders also target buildings). Paths come from `world.nav.findPath(...)` (a shared `NavGrid`) and are walked by `PathFollower`.
- Gathering loop (`doGather`): walk to the node, work at `gatherRate`, and once `carry.amount ≥ CONFIG.carryCapacity`, return to the nearest built building with `def.dropoff` (only the Town Center) and add to `world.stock`. When a node runs out, `findNode(kind)` picks the next one within 30 units.
- Buildings: `spawnBuilding()` snaps to integer coordinates and blocks its `footprint()` on the nav grid (unless `def.walkable`, e.g. farms). Villagers call `addProgress(dt)` until `buildTime`, then the model swaps from `def.site` to `def.model`. `train(type)` checks population (`population()`), queue length (5) and cost. `update()` advances `queue[0]` and spawns at the door, then sends it to `rally`, or to gather wood if it's a villager.
- Farms are `Building`s tagged `'resource'` with `gives: 'food'` and infinite `amount`, so villagers gather from them like trees.
- `Selection` (filtered to the player's units and buildings) handles left-click and box select. A mixed box keeps only units. A right-click (`input.mousePressed(2)`) calls `issueOrders()`, which picks attack / build / gather / move from what's under the cursor (`game.pickEntity(clickable)`). It spreads groups in a grid and sets rally points for a lone selected building.
- Placement: `startPlacing(type)` creates a ghost model; `updatePlacing()` snaps it, checks `canAfford` + `footprintFree(x, z, size)`, and on click calls `pay` → `spawnBuilding` → selected villagers `build`. Shift places several; right-click or Esc cancels.
- Raids: `raid()` spawns `CONFIG.raidSize(wave)` raiders at a random edge, mixing `raiderMinion` and `raider`. The first raid is scheduled with `game.after(CONFIG.firstRaidAt, raid)`, and each raid schedules the next with `game.after(CONFIG.raidInterval, raid)` until `wavesToWin`. `checkEnd()` runs every 0.25 s: no `townCenter` → `menu.gameOver`; all `wavesToWin` raids survived and no enemies left → `menu.win`.

**Tuning knobs** (all in `games/strategy/data.js`)

- `CONFIG`: `mapSize`, `startStock`, `firstRaidAt`, `raidInterval`, `raidSize(wave)`, `wavesToWin`, `carryCapacity`.
- `UNITS[type]`: `model`, `scale`, `hide`, `weapon`, `hp`, `speed`, `attack`, `attackRate`, `range`, `sight`, `gatherRate`, `canGather`, `canBuild`, `cost`, `trainTime`, `pop`.
- `BUILDINGS[type]`: `model`, `site`, `scale`, `size` (footprint in cells, keep it even), `hp`, `buildTime`, `cost`, `trains`, `dropoff`, `popCap`, `walkable`, `gives`, `key` (build hotkey).
- `NODES[kind]`: `models`, `scale`, `gives`, `amount`. `RESOURCES`: an icon and colour per resource.

**Common changes**

- *New building (e.g. Lumber Camp drop-off):* add to `BUILDINGS`, e.g. `camp: { name: 'Lumber Camp', model: RTS + 'Storage_FirstAge_Level1.glb', site: RTS + 'Storage_FirstAge_Level1.glb', scale: 3, size: 4, hp: 150, buildTime: 8, cost: { wood: 50 }, dropoff: true, key: 'Digit4' }`. The build button, hotkey and preloading come from the table, and villagers use any built `dropoff`.
- *New unit (archer):* add `UNITS.archer = { name: 'Archer', model: KK + 'Rogue.glb', scale: 0.75, hide: [...], hp: 60, speed: 4.5, attack: 8, attackRate: 1.2, range: 8, sight: 12, cost: { wood: 40, gold: 20 }, trainTime: 8, pop: 1 }` and add `'archer'` to a building's `trains`. The train hotkey is `'Key' + name[0]` (here A, which also pans the camera; pick a name with an unused first letter, or set the code in `currentActions()`).
- *New resource (stone):* add `stone` to `RESOURCES` and `CONFIG.startStock`, a `NODES.stone` entry (e.g. `Resource_Rock_1.glb`), and spawn nodes in `buildMap()` with `tryNode('stone', x, z)`.
- *Bigger or smaller raids:* `CONFIG.raidSize = (wave) => 2 + wave * 3`. More raids to win: `CONFIG.wavesToWin`.
- *Tower defense mode:* remove the Town Center loss check in `checkEnd()` and give raiders a fixed path with `PathFollower`.
- *Enemy AI player:* spawn a `townCenter` for team `'enemy'` with `spawnBuilding('townCenter', 'enemy', pos, true)`. Units and buildings are team-agnostic; you'd write the economy logic.

**Controls**: left click/drag select (Shift adds) · right click move/gather/build/attack (or set a rally point) · 1/2/3 place House/Farm/Barracks (villager selected) · V/K train · WASD/edges/middle-drag pan · wheel zoom · Q/E rotate · Esc pause. Touch: tap/drag select, **Order** then tap = command, stick pans, +/− zoom, build and train buttons at top-right.

**Debug hooks**: `window.world` (plus `world.raid`, `world.selection`, `world.population`).
- `world.stock.wood = 999`
- `world.raid()` starts a raid now
- `world.population()`
- `world.nav.debugMesh(game.scene)` shows blocked cells

**Gotchas**

- Building `size` is in nav cells (1 unit each), and positions snap to integers, so keep sizes even.
- Pausing (Esc) cancels building placement via the menu's `onPause` hook.
- KayKit units are scaled to ~0.75; Quaternius RTS buildings are tiny natively (~1 unit), hence `scale: 2.6–5`.
- `findNode()` only searches within 30 units; villagers far from any resource go idle.

---

## Mixing samples

Every sample uses the same engine, so pieces move between games with small adapters:

- **RPG skeletons in another game.** Copy `games/rpg/enemy.js`. `Skeleton` expects a player entity found by `game.find('player')` with `.position`, `.dead` and `.hurt(amount, source)`. Any `CharacterController` subclass with a `hurt` method works (see `Hero` in `games/rpg/main.js`). Spawn with `await Skeleton.spawn(game, 'minion', v3(x, 0, z), { onDeath: (e) => … })`. To use them in the shooter, wrap the FPS player: `game.add(Object.assign(new Entity(), { tags: new Set(['player']), dead: false, hurt: (n) => player.health.damage(n) }))`, and keep that entity's `position` synced to `body.position`. Hitscan works if you raycast against them (`entities: game.findAll('enemy')`) and call `enemy.health.damage(dmg)`.
- **Shooter weapons in the RPG.** Port `makeGun` and `fire`, but parent the gun to the hero's hand (`attach(heroModel, 'handslot.r', gunModel)`) and aim along the hero's facing or `game.mouseGround()`.
- **Tower defense towers in the strategy game.** `Tower` and `Projectile` only need `game.findNear(pos, range, 'enemy')` and targets with `.health`, `.position`, `.progress` and `.is('enemy')`. Strategy raiders are tagged `'enemy'`; give them a `progress` (or change the targeting to nearest) and make towers a `BUILDINGS` entry.
- **Strategy units in other games.** `Unit` relies on the shared `world` object (`games/strategy/world.js`: `world.game`, `world.nav`, `world.stock`). Copy `world.js` + `units.js`, set `world.game = game` and `world.nav = new NavGrid({...})`, then `spawnUnit(type, team, pos)` and `unit.command({ type: 'move', point })`.
- **Fishing in any 3D world.** `games/fishing/fish.js` (`Fish`, `randomUnderwater`) and `data.js` (`SPECIES`, `rollSpecies`) are standalone. Copy the `fishing` `StateMachine` from `games/fishing/main.js` along with the `bobber`, `line`/`updateLine()`, `rodTip` and `castTo` pieces it uses. Replace the lake constants (`CONFIG.lake`) with your water's radius and height.
- **ASCII levels anywhere.** The side-scroller (`rows`/`at(c, r)`/`tilePos(c, r)`, merged horizontal colliders) and the tower defense (`cellPos`/`cellOf`, road tracing) parsers are each ~20 lines, and both work for top-down or side-view grids. See also "Build levels from a text map" in `docs/RECIPES.md`.
- **Platformer objects in other games.** `MovingPlatform`, `Hazard`, `Bouncer` and `Checkpoint` in `games/platformer/main.js` only need `player` (a `CharacterController`) plus the module-level `hurt()` / `respawnPoint`. Move those along with them.
