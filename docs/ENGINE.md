# Engine reference

The engine is a thin layer of **reusable game primitives** on top of [three.js](https://threejs.org/docs/).
It is ~2,400 lines of plain JavaScript in `engine/`, so when the docs aren't enough, read the source.
Every file starts with a usage example.

```js
import { Game, Entity, Animator, CharacterController, FollowCamera, /* … */ } from '@engine';
```

`@engine` is an alias for `engine/index.js`. Everything below is exported from it, including `THREE` itself.

**Contents**

- [Game](#game): loop, entities, timers, picking
- [Entity](#entity): things that live in the game
- [Assets](#assets): load models, plus helpers (`setVisible`, `attach`, `fitHeight`…)
- [Animator](#animator): play animation clips by friendly name
- [Input](#input): keyboard, mouse, gamepad
- [Physics & Body](#physics--body): AABB collisions, raycasts, kinematic characters
- [CharacterController](#charactercontroller): ready-made third-person hero
- [Cameras](#cameras): `FollowCamera`, `FirstPersonCamera`, `RTSCamera`
- [Health](#health)
- [StateMachine](#statemachine): AI, game phases
- [NavGrid & PathFollower](#navgrid--pathfollower): A* pathfinding
- [Selection](#selection): RTS click and box select
- [UI](#ui): HUD, bars, dialogs, damage numbers, world labels
- [Audio](#audio): built-in synth sounds and your own files
- [Effects](#effects): particles, flashes, tracers, screen shake
- [setupEnvironment](#setupenvironment): sky, sun, shadows, ground
- [shapes](#shapes): coloured primitives for prototyping
- [utils](#utils): math and gameplay helpers

---

## Game

`engine/Game.js` owns the renderer, scene, camera and loop, and holds every system.

```js
const game = new Game({ groundY: 0 });   // options: fov, shadows, gravity, groundY (null = no floor), stats
setupEnvironment(game);                  // lights + sky + ground (optional, see below)
game.add(somethingWithUpdate);
game.start();
```

| Member | What it is |
|---|---|
| `game.scene`, `game.camera`, `game.renderer` | Plain three.js objects |
| `game.input` / `assets` / `physics` / `ui` / `audio` / `effects` | The systems below |
| `game.add(thing)` | Add anything with `update(dt)`. If it has `.object`, that object is added to the scene. Returns `thing`. |
| `game.remove(thing)` | Remove it. Prefer `entity.destroy()`. |
| `game.find(tag)` / `findAll(tag)` | Look up entities by tag |
| `game.findNear(pos, radius, tag)` | Entities within a radius, nearest first |
| `game.onUpdate(fn)` | Per-frame callback without writing a class. Returns an unsubscribe function. |
| `game.after(sec, fn)` / `game.every(sec, fn)` | Timers that pause with the game. Both return a cancel function. |
| `game.time` | Game seconds since start |
| `game.paused`, `game.timeScale` | Freeze the game, or run it in slow motion |
| `game.mouseGround(y=0)` | Point on a horizontal plane under the mouse (click-to-move, placing buildings) |
| `game.mousePick(objects?)` | three.js raycast hit under the mouse, with `.entity` filled in |
| `game.pickEntity(candidates)` | Which of these entities is under the mouse |
| `game.mouseRay()` | `THREE.Ray` through the cursor (or screen centre when the pointer is locked) |
| `await game.load(urls)` | Preload models behind a loading screen |

Frame order: input → timers → `physics.update()` → every entity's `update(dt)` → `onUpdate` callbacks → effects → render → UI.

`window.game` is set so you can poke at the game from the browser console, e.g. `game.findAll('enemy')`.

## Entity

`engine/Entity.js`. An Entity wraps a `THREE.Object3D` (`entity.object`) and gets `update(dt)` every frame.

```js
class Coin extends Entity {
  update(dt) { this.object.rotation.y += dt * 3; }
}
const coin = game.add(new Coin(model, { tags: ['coin', 'pickup'] }));
coin.position.set(3, 1, 0);   // shortcut for coin.object.position
coin.is('coin');              // true
coin.destroy();               // removes it from the game and the scene

// no subclass needed for small things:
const spinner = game.add(new Entity(model));
spinner.onUpdate((dt) => (spinner.object.rotation.y += dt));
```

Hooks you can override: `onAdded(game)`, `onRemoved(game)`, `update(dt)`. `entity.game` is set once the entity is added.
`object.userData.entity` points back at the entity, which is how raycast hits find their owner (`entityOf(mesh)`).

## Assets

`engine/Assets.js`. Loads `.glb`/`.gltf` once and hands out independent copies, so animations and materials aren't shared.

```js
const knight = await game.assets.model('/assets/kaykit-adventurers/Knight.glb');      // native size
const tree   = await game.assets.model('/assets/quaternius-nature/Tree1.glb', { scale: 1.5 });
const house  = await game.assets.model('/assets/quaternius-rts/Houses_FirstAge_1_Level1.glb', { height: 4 });
// options: scale, height (fit to this height), shadows (default true), center (centre on X/Z, bottom at y=0)
knight.animations;   // AnimationClip[]; pass the model to new Animator(knight)
await game.assets.preload([url1, url2], (fraction) => …);
```

Find model URLs and animation names in the **asset browser** (`/assets.html`) or `docs/ASSET_LIST.md`.

Helpers:

| Function | Use |
|---|---|
| `setVisible(model, { Name: false })` | Hide parts by name. KayKit characters ship with **every** weapon visible, so use this to pick a loadout. The asset browser writes this line for you. |
| `attach(model, 'handslot.r', child)` | Parent a model to a bone, e.g. a sword in a hand. KayKit hands are `handslot.r` / `handslot.l`. |
| `findNode(model, name)` | Get a bone or mesh by name |
| `fitHeight(obj, h)` / `fitSize(obj, s)` | Rescale to a target height, or a target largest dimension |
| `getBounds(obj)` / `getSize(obj)` | World box/size. Correct for skinned models, unlike `Box3.setFromObject`. |
| `centerOnGround(obj)` | Recentre so the bottom sits at y=0 |
| `tint(obj, color, amount)` | Recolour a copy (team colours!) |
| `setShadows(obj, cast, receive)` | Toggle shadows |

## Animator

`engine/Animator.js`. Plays clips with cross-fades and **forgiving names**.

```js
const anim = new Animator(model);
anim.play('Idle');                          // loops; calling it every frame is fine
anim.play('run');                           // case-insensitive, ignores "Armature|" prefixes
anim.play(['Running_A', 'Run', 'Walk']);    // first match wins, so it works across asset packs
anim.once('Attack', { then: 'Idle', onEnd: () => {}, speed: 1.5 });
anim.busy;                                  // true while a once() clip is playing
anim.duration('Death_A');                   // seconds
anim.update(dt);                            // every frame! (CharacterController does this for you)
```

Lookup order: exact → case-insensitive → after `|` → starts or ends with → contains.
Unknown names log a warning once, listing the available clips.

## Input

`engine/Input.js`. Poll it in `update()`. Keys use `KeyboardEvent.code` names: `KeyW`, `Space`, `ShiftLeft`, `Digit1`, `ArrowUp`, `Escape`…

```js
const { input } = game;
input.down('KeyW');        input.pressed('Space');    input.released('KeyE');
input.anyDown('ShiftLeft', 'ShiftRight');
input.move();              // { x, y } from WASD + arrows + gamepad stick, length ≤ 1 (y = forward)
input.axis('KeyA', 'KeyD');// -1 / 0 / 1
input.mouseDown(0);  input.mousePressed(2);   // 0 left, 1 middle, 2 right
input.mouse.x / .y (px) / .ndc (-1..1) / .dx / .dy (movement this frame)
input.wheel;               // scroll this frame (-1 / 0 / 1)
input.padDown(0);  input.padPressed(0);       // gamepad buttons (0 = A)
input.lockPointer();  input.pointerLocked;
```

Right-click's context menu is disabled on the canvas so you can use it for gameplay.

## Physics & Body

`engine/Physics.js`. Deliberately simple: **everything solid is an axis-aligned box**.
Bodies slide along walls, land on floors, step up small ledges and ride moving platforms.
It is predictable and easy to debug. (Rotated colliders aren't supported; a box rotated 90° is fine because its bounding box is exact.)

```js
const { physics } = game;          // gravity -30, infinite floor at y=0 (new Game({ groundY: null }) for none)
physics.addCollider(wallModel);                         // solid box from the object's bounds
physics.addCollider(platform, { dynamic: true });       // box follows the object every frame (moving platforms)
physics.addCollider(ledge, { oneWay: true });           // jump through from below
physics.addCollider(tree, { padding: -0.5 });           // shrink/grow the box
physics.addBox([0, 2, -20], [40, 4, 1]);                // invisible wall: center, size
physics.remove(colliderOrObject);
physics.showDebug(game.scene);                          // draw every collider

const body = new Body(physics, { radius: 0.4, height: 1.8, position: v3(0, 0, 0), stepHeight: 0.35 });
body.velocity.set(x, body.velocity.y, z);
body.move(dt);                     // gravity + collisions
body.onGround; body.hitWall; body.hitCeiling; body.ground /* the collider under you */
model.position.copy(body.position);  // body.position = feet

physics.raycast(origin, dir, { maxDist: 100, entities: game.findAll('enemy') });
// → { point, distance, entity?, collider? } or null. Walls block entities behind them.
```

Need real rigid bodies (stacking crates, ragdolls, cars)? See *Add real physics* in `docs/RECIPES.md`.

## CharacterController

`engine/CharacterController.js`. A complete third-person hero, and an `Entity` (tagged `player`).

```js
const player = game.add(new CharacterController(game, model, {
  speed: 6, sprintMultiplier: 1.6, jumpSpeed: 11, maxJumps: 2 /* double jump */,
  acceleration: 14, airControl: 0.6, radius: 0.4, height: 1.8,
  animations: { idle: 'Idle', run: ['Running_A', 'Run'], jump: 'Jump_Start', fall: 'Jump_Idle', walk: 'Walking_A' },
}));
player.camera = followCam;    // WASD relative to the camera
player.locked = true;         // ignore input (attacks, cutscenes, dialogs)
player.teleport(v3(0, 0, 0));
player.lookAt(target);
player.body;  player.animator;  player.model;
player.onJump = () => {};
```

It includes coyote time, jump buffering, variable jump height (release Space early) and sprint.
Subclass it to add combat; see `Hero` in `games/rpg/main.js`.

## Cameras

All cameras drive `game.camera`. Add them with `game.add(...)` so they update after your player moves.

**FollowCamera** is third-person orbit: right-drag to orbit, wheel to zoom. It pulls in when a wall is in the way.
```js
const cam = game.add(new FollowCamera(game, player.object, { distance: 8, pitch: 0.45, yaw: 0, height: 1.5, pointerLock: false }));
cam.toWorld(input.move());   // camera-relative direction on the ground
```

**FirstPersonCamera** is mouse look. Click the canvas to capture the mouse.
```js
const fps = game.add(new FirstPersonCamera(game, body, { eyeHeight: 1.6, sensitivity: 0.0022 }));
fps.toWorld(input.move());  fps.forward();  fps.kick = 0.05; // recoil
```

**RTSCamera** is top-down: WASD or screen-edge pan, wheel zoom, Q/E rotate, middle-drag pan.
```js
const rts = game.add(new RTSCamera(game, { zoom: 30, bounds: 60, pitch: 0.95 }));
rts.focus(townCenter.position);
```

## Health

```js
enemy.health = new Health(50, { onDamage: (amount, source) => {}, onDeath: (source) => {}, invulnerableTime: 0 });
enemy.health.damage(10, player);  enemy.health.heal(5);  enemy.health.reset(newMax);
enemy.health.hp / max / fraction / dead / invulnerable
```

## StateMachine

The easiest way to write enemy AI, game phases (`menu → playing → gameover`) or animation logic.

```js
const ai = new StateMachine({
  idle:   { enter: () => anim.play('Idle'), update: (dt) => { if (seesPlayer()) ai.go('chase'); } },
  chase:  { enter: () => anim.play('Run'),  update: (dt) => { … if (close) ai.go('attack'); } },
  attack: { enter: () => anim.once('Attack'), update: () => { if (ai.time > 1) ai.go('chase'); } },
}, 'idle');
ai.update(dt);  ai.state;  ai.is('chase');  ai.time /* seconds in the current state */;  ai.go('attack', true /* re-enter */);
```

## NavGrid & PathFollower

Grid A* on the ground plane, with diagonal moves, no corner cutting and string-pulled (smoothed) paths.

```js
const nav = new NavGrid({ size: 120, cellSize: 1 });   // covers -60..60
nav.blockObject(houseModel);           // footprint becomes unwalkable
nav.blockBox(box3);  nav.setBlocked(pos, true);
const path = nav.findPath(from, to);   // Vector3[] ([] if unreachable). Blocked targets snap to the nearest free cell.
nav.nearestFree(pos);  nav.lineOfSight(a, b);  nav.debugMesh(game.scene);

const mover = new PathFollower(unit.object, { speed: 4 });
mover.goTo(path, () => console.log('arrived'));
mover.update(dt);  mover.moving;  mover.stop();
```

## Selection

RTS selection: left-click to select, drag a box for many, Shift to add. Selected entities get a ring.

```js
const sel = game.add(new Selection(game, { filter: (e) => e.is('unit') && e.team === 'blue' }));
sel.onChange = (list) => {};
sel.selected;  sel.set([a, b]);  sel.clear();  sel.enabled = false;  // e.g. while placing a building
```

## UI

`engine/UI.js`. An HTML overlay. HTML and CSS are the quickest way to make game UI.

```js
const score = game.ui.text('Score: 0', { top: 16, left: 16 }, { size: 24 });  score.set('Score: 5');
const hp = game.ui.bar({ bottom: 20, left: 20 }, { width: 200, color: '#e33', label: ' ' });  hp.set(0.5, '50 / 100');
game.ui.message('Wave 3', 2, { sub: 'Here they come!' });   // big centred text (0 = until .remove())
game.ui.toast('Quest updated');
game.ui.floatingText(pos, '-12', '#f44');                    // damage numbers
const label = game.ui.worldLabel(npc.object, 'Talk [E]', 2.5);  // follows a 3D object
const bar = game.ui.worldBar(enemy.object, 2.4);  bar.set(0.7);
const choice = await game.ui.dialog('Merchant', 'Buy a potion?', ['Yes', 'No']);  // pauses the game; keys 1-9 work
const btns = game.ui.buttons([{ label: 'Build', key: 'B', onClick, disabled }], { bottom: 16, right: 16 });  btns.update(newItems);
game.ui.crosshair();  game.ui.controls(['WASD — move', …]);  game.ui.loading('…');
game.ui.el('div', { className: 'fx-panel', html: '…', pos: { top: 10, right: 10 } });  // raw element
```

Positions are CSS: numbers mean px, strings pass through (`'50%'`).

## Audio

Built-in sounds are **synthesized**, so no files are needed:
`jump coin powerup hit hurt shoot laser explosion click step swing death win lose build splash`.

```js
game.audio.play('coin', { volume: 0.5, pitch: 1.2 });
await game.audio.load('music', '/sounds/theme.mp3');  // put files in public/sounds/
const music = game.audio.play('music', { loop: true, volume: 0.3 });  music.stop();
game.audio.muted = true;  game.audio.volume = 0.5;
```

## Effects

```js
game.effects.burst(pos, { color: '#fc0', count: 20, speed: 5, size: 0.15, life: 0.7, gravity: -15, up: 3 });
game.effects.ring(pos, { color: '#7cf', size: 1.5 });   // click marker or shockwave
game.effects.tracer(from, to, { color: '#ff8' });       // bullet line
game.effects.flash(enemy.object, { color: '#fff', duration: 0.1 });
game.effects.shake(0.3);                                // 0.1 light … 1 huge
```

## setupEnvironment

```js
const { sun, hemi, ground } = setupEnvironment(game, {
  sky: 'day',               // day | sunset | night | dungeon | space | underwater
  ground: { size: 400, color: '#7cb45a', grid: false },   // or false for no ground mesh
  fog: { near: 60, far: 220 },                            // or false
  shadowArea: 40,           // half-size of the sharp-shadow area (it follows the camera)
});
```

## shapes

For prototyping before you pick models. All cast and receive shadows; `pos` is `[x, y, z]`.

```js
game.scene.add(box(2, 1, 2, '#c84', [0, 0.5, 0]));
sphere(r, color, pos)  cylinder(r, h, color, pos)  cone(r, h, color, pos)  capsule(r, h, color, pos)  plane(w, d, color, pos)
```

## utils

```js
rand(min, max)  randInt(min, max)  pick(array)  chance(0.3)
clamp(v, a, b)  lerp(a, b, t)  damp(a, b, lambda, dt)  dampAngle(a, b, lambda, dt)  angleDiff(a, b)
distXZ(a, b)  yawTo(from, to)  v3(x, y, z)
const fire = cooldown(0.2);  if (fire.ready()) shoot();  fire.progress();
storage.save('highscore', 42);  storage.load('highscore', 0);
```

`damp` is the frame-rate-independent version of `lerp(a, b, 0.1)`. Use it for anything smooth.
