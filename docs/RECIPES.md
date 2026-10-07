# Recipes

Short, copy-pasteable answers to "how do I…?". They all assume:

```js
import { Game, Entity, /* … */ } from '@engine';
const game = new Game();
```

- [Start a new game](#start-a-new-game)
- [Swap the player character](#swap-the-player-character)
- [Put a weapon in a character's hand](#put-a-weapon-in-a-characters-hand)
- [Pickups and collectibles](#pickups-and-collectibles)
- [Spawn enemies on a timer](#spawn-enemies-on-a-timer)
- [A simple chasing enemy](#a-simple-chasing-enemy)
- [Projectiles (arrows, fireballs, bullets you can see)](#projectiles)
- [Trigger zones (do something when the player walks into an area)](#trigger-zones)
- [Click to move](#click-to-move)
- [Build levels from a text map](#build-levels-from-a-text-map)
- [Moving platforms and doors](#moving-platforms-and-doors)
- [Game states: title screen, game over, restart](#game-states-title-screen-game-over-restart)
- [Phones & touch](#phones--touch)
- [Save a high score](#save-a-high-score)
- [An underwater / fish scene 🐟](#an-underwater--fish-scene)
- [Team colours](#team-colours)
- [Use your own models or sounds](#use-your-own-models-or-sounds)
- [Add real physics (Rapier)](#add-real-physics-rapier)
- [Multiplayer](#multiplayer)
- [Debugging](#debugging)
- [Performance](#performance)
- [Deploy / share your game](#deploy--share-your-game)

---

## Start a new game

```bash
npm run new my-game                 # copy of games/starter
npm run new my-game -- --from rpg   # or start from any sample
```

Open `http://localhost:5173/games/my-game/`. It also appears on the home page under *Your games*.

## Swap the player character

Any animated model works. Only the clip names differ between packs, so tell the controller what they are
(look them up in `/assets.html`):

```js
// KayKit (Knight, Barbarian, Mage, Rogue, Skeletons): the defaults already match
const hero = await game.assets.model('/assets/kaykit-adventurers/Barbarian.glb');

// Quaternius platformer character: about 3.5 units tall, so scale it down
const blob = await game.assets.model('/assets/quaternius-platformer/Character.glb', { height: 2 });
const player = game.add(new CharacterController(game, blob, {
  animations: { idle: 'Idle', run: 'Run', walk: 'Walk', jump: 'Jump', fall: 'Jump_Idle' },
}));
```

KayKit characters include every weapon and hat. Hide what you don't want:
`setVisible(hero, { '2H_Axe': false, Barbarian_Hat: false })`. In the asset browser, click the parts to hide them and it writes this line for you.

## Put a weapon in a character's hand

```js
import { attach } from '@engine';
const sword = await game.assets.model('/assets/kaykit-adventurers/sword_2handed.gltf');
attach(hero, 'handslot.r', sword);   // KayKit bones: handslot.r, handslot.l, head
```

For Quaternius rigs, find the hand bone name in `/assets.html` (often `Fist.R` or `Hand.R`) and use `findNode` to check it exists.

## Pickups and collectibles

```js
class Pickup extends Entity {
  update(dt) {
    this.object.rotation.y += dt * 2;
    if (distXZ(this.position, player.position) < 1.2) {
      game.audio.play('coin');
      game.effects.burst(this.position, { color: 'gold' });
      game.ui.floatingText(this.position, '+10', 'gold');
      score += 10;
      this.destroy();
    }
  }
}
const coin = game.add(new Pickup(await game.assets.model('/assets/quaternius-platformer/Coin.glb', { scale: 0.5 })));
coin.position.set(5, 1, 0);
```

## Spawn enemies on a timer

```js
const stop = game.every(3, async () => {
  if (game.findAll('enemy').length >= 10) return;
  const model = await game.assets.model('/assets/kaykit-skeletons/Skeleton_Minion.glb');
  const e = game.add(new Enemy(model, { tags: ['enemy'] }));
  e.position.set(rand(-20, 20), 0, rand(-20, 20));
});
// later: stop();
```

`games/shooter` adds waves on top of this, and `games/rpg` keeps a spawn area topped up.

## A simple chasing enemy

The full version, with idle, wander, chase, attack, hit, dead and return-home states, is `games/rpg/enemy.js`. The minimum is:

```js
class Enemy extends Entity {
  constructor(model) {
    super(model, { tags: ['enemy'] });
    this.anim = new Animator(model);
    this.health = new Health(30, { onDeath: () => { this.anim.once('Death_A'); game.after(2, () => this.destroy()); } });
  }
  update(dt) {
    this.anim.update(dt);
    if (this.health.dead) return;
    const d = distXZ(this.position, player.position);
    if (d > 1.5) {
      this.object.rotation.y = yawTo(this.position, player.position);
      this.position.x += Math.sin(this.object.rotation.y) * 3 * dt;
      this.position.z += Math.cos(this.object.rotation.y) * 3 * dt;
      this.anim.play('Running_A');
    } else this.anim.play('Idle');
  }
}
```

If enemies should collide with walls, give them a `Body` (see `games/rpg/enemy.js`). If they need to path around buildings, use `NavGrid` and `PathFollower` (see `games/strategy`).

## Projectiles

```js
class Arrow extends Entity {
  constructor(model, dir) { super(model, { tags: ['projectile'] }); this.vel = dir.clone().multiplyScalar(30); this.life = 3; }
  update(dt) {
    this.life -= dt;
    this.vel.y -= 9.8 * dt;                                  // a little gravity
    const step = this.vel.clone().multiplyScalar(dt);
    const hit = game.physics.raycast(this.position, step.clone().normalize(), { maxDist: step.length(), entities: game.findAll('enemy') });
    if (hit) {
      hit.entity?.health.damage(10);
      game.effects.burst(hit.point, { color: '#fa0' });
      return this.destroy();
    }
    this.position.add(step);
    this.object.lookAt(this.position.clone().add(this.vel));
    if (this.life <= 0) this.destroy();
  }
}
```

Raycasting along each frame's step means fast projectiles can't tunnel through walls.

## Trigger zones

```js
const zone = new THREE.Box3().setFromCenterAndSize(v3(10, 1, 0), v3(4, 2, 4));
let inside = false;
game.onUpdate(() => {
  const now = zone.containsPoint(player.position);
  if (now && !inside) game.ui.toast('You found the secret cave!');
  inside = now;
});
```

For a circle, use `distXZ(player.position, center) < radius`.

## Click to move

```js
const nav = new NavGrid({ size: 100 });
const mover = new PathFollower(hero.object, { speed: 5 });
game.onUpdate((dt) => {
  if (game.input.mousePressed(2)) {
    const p = game.mouseGround();
    if (p) { mover.goTo(nav.findPath(hero.position, p)); game.effects.ring(p); }
  }
  mover.update(dt);
  anim.play(mover.moving ? 'Running_A' : 'Idle');
});
```

## Build levels from a text map

`games/sidescroller` is a complete example: the whole level is one ASCII string.

Text maps are easy to edit, easy to diff, and anyone on the team can make levels:

```js
const MAP = `
##########
#..C...E.#
#.####...#
#P...#.C.#
##########`;
const TILE = 4;
const rows = MAP.trim().split('\n');
for (const [z, row] of rows.entries()) for (const [x, ch] of [...row].entries()) {
  const pos = v3(x * TILE, 0, z * TILE);
  if (ch === '#') { const w = await game.assets.model('/assets/kaykit-dungeon/wall.glb'); w.position.copy(pos); game.scene.add(w); game.physics.addCollider(w); }
  if (ch === 'C') spawnCoin(pos);
  if (ch === 'E') spawnEnemy(pos);
  if (ch === 'P') player.teleport(pos);
}
```

## Moving platforms and doors

```js
const platform = await game.assets.model('/assets/kaykit-prototype/Floor_Prototype.gltf');
game.scene.add(platform);
game.physics.addCollider(platform, { dynamic: true });  // box follows the object; riders are carried
game.onUpdate(() => { platform.position.x = Math.sin(game.time) * 6; });
```

A door works the same way: animate `door.position.y` upwards when the player has the key.

## Game states: title screen, game over, restart

Use `GameMenu` (see `docs/ENGINE.md`). It handles the title screen, pause, game over, win, restart and the best score:

```js
const menu = new GameMenu(game, { title: 'My Game', controls: ['WASD — move'], onStart: () => spawnEnemies() });
// when the player dies:
menu.gameOver({ text: 'You fell in the lava', score });
// when they win:
menu.win({ text: 'All coins collected!', score });
```

For custom phases inside a run (build phase → wave phase → shop), use a `StateMachine`.

## Phones & touch

```js
new TouchControls(game, { joystick: true, look: true, buttons: [{ label: 'Jump', key: 'Space' }, { label: '⚔️', key: 'KeyF' }] });
```

Test on your laptop with `?touch` in the URL. To play on a real phone on the same Wi-Fi, `npm run dev` prints a *Network* URL; open that on the phone.
Keep buttons to 4 or fewer, and make anything the keyboard can do reachable from a button or an on-screen `ui.buttons()` panel.
`GameMenu` adds a ⏸ button automatically on touch devices.

## Save a high score

```js
const best = storage.load('my-game-best', 0);
if (score > best) storage.save('my-game-best', score);
```

## An underwater / fish scene 🐟

```js
setupEnvironment(game, { sky: 'underwater', ground: { color: '#c2b280' }, fog: { near: 10, far: 70 } });
const FISH = ['Clownfish', 'BlueTang', 'Koi', 'Puffer', 'Shark', 'Anglerfish', 'Tuna'];
for (let i = 0; i < 30; i++) {
  const fish = await game.assets.model(`/assets/quaternius-fish/${pick(FISH)}.glb`, { scale: 0.2 });
  const anim = new Animator(fish);
  anim.play('Swimming_Normal');
  const e = game.add(new Entity(fish, { tags: ['fish'] }));
  const center = v3(rand(-20, 20), rand(2, 8), rand(-20, 20)), r = rand(3, 8), speed = rand(0.2, 0.6);
  e.onUpdate((dt) => {
    const t = game.time * speed;
    e.position.set(center.x + Math.cos(t) * r, center.y + Math.sin(t * 2) * 0.5, center.z + Math.sin(t) * r);
    e.rotation.y = -t;            // face along the circle
    anim.update(dt);
  });
}
```

The fish pack also has fishing rods (`FishingRod_Lvl1..5`), lures, docks and a boat.
Fish clips: `Swimming_Normal`, `Swimming_Fast`, `Swimming_Impulse`, `Attack`, `Death`, `Out_Of_Water`.
Physics has no water, so swimming is just a `Body` with `gravityScale: 0` (or 0.1 for slow sinking).

## Team colours

```js
tint(unitModel, '#3070ff', 0.4);   // blend 40% blue into every material (copies the materials)
```

The KayKit hexagon pack also ships `building_*_blue` and `building_*_red` variants.

## Use your own models or sounds

- Put files in `public/` (for example `public/models/boat.glb` or `public/sounds/theme.mp3`) and load them as `'/models/boat.glb'`.
- Free CC0 sources: [poly.pizza](https://poly.pizza), [kenney.nl](https://kenney.nl/assets), [quaternius.com](https://quaternius.com), [kaylousberg.itch.io](https://kaylousberg.itch.io).
- Animations from Mixamo work too: export as FBX, then convert to glb in Blender.
- To add a whole pack to the kit, see `docs/ASSETS.md`.

## Add real physics (Rapier)

The built-in AABB physics covers characters and level geometry. For stacking, rolling, ragdolls or vehicles:

```bash
npm i @dimforge/rapier3d-compat
```
```js
import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50));                       // ground
const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0));
world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5), body);
game.onUpdate(() => { world.step(); crate.position.copy(body.translation()); crate.quaternion.copy(body.rotation()); });
```

Both systems can run side by side: keep the player on `Body` and use Rapier for props.

## Multiplayer

Out of scope for the kit, but the quickest routes are:

- **[PeerJS](https://peerjs.com)** for 2–4 players peer-to-peer with no server. Send `{x, z, rotY, anim}` 10–20 times a second and lerp the remote players.
- **[Colyseus](https://colyseus.io)** or **[Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)** for an authoritative server with rooms.

Keep game state in plain objects so it's easy to serialize.

## Debugging

- `game` is on `window`. Try `game.findAll('enemy')`, `game.timeScale = 0.2` or `game.paused = true` in the console.
- `game.physics.showDebug(game.scene)` draws every collider. Pink is static, orange is dynamic, cyan is one-way.
- `nav.debugMesh(game.scene)` shows blocked pathfinding cells.
- `new Game({ stats: true })` adds an FPS counter.
- The Animator warns in the console, listing the available clips, when a name doesn't match.

## Performance

- Load each model once with `game.load([...])` at the start. `assets.model()` copies are cheap.
- Hundreds of identical static props (grass, rocks)? Use `THREE.InstancedMesh`, or merge them.
- Shadows are the most expensive part. Lower `shadowArea` in `setupEnvironment`, or turn off `castShadow` on small props.
- Skinned (animated) characters cost the most. A few dozen is fine; for hundreds, see the strategy sample's tips.

## Deploy / share your game

```bash
npm run build      # → dist/ (all games + asset browser)
npm run preview    # test the build locally
```

`dist/` is static files. It works from any folder because the kit uses relative paths (`base: './'`):

- **itch.io**: zip the *contents* of `dist/` and upload it as an HTML game. Set the launch file to `games/<your-game>/index.html`, or keep `index.html` for the launcher.
- **GitHub Pages / Netlify / Vercel / Cloudflare Pages**: publish the `dist/` folder.

The build copies all ~95 MB of assets. To ship less, delete the packs you don't use from `public/assets/` before building.
