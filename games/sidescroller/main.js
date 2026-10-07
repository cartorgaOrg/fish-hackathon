// =============================================================================
//  SIDE-SCROLLER — a classic "World 1-1" style 2.5D platformer.
//
//  Controls: A/D or ←/→ run · Space jump (hold for higher) · Shift run faster
//
//  What's inside (and where to change it):
//    CONFIG   — physics feel, scores, timer
//    LEVEL    — the whole level as ASCII art. Edit it and save: the level rebuilds instantly.
//    TILES    — which model each character uses
//    Player   — the stock CharacterController locked to the X axis, plus small/big power states
//    Walker   — the enemy: walks, turns at walls, gets stomped
//    Blocks   — "?" blocks give coins or a star, bricks break when you're big
//
//  The trick for 2.5D: it's a normal 3D game where everything lives on z = 0 and the
//  camera looks at it from the side.
// =============================================================================
import {
  Game, Entity, Body, Animator, CharacterController, GameMenu, TouchControls, setupEnvironment, tint, sphere,
  rand, pick, damp, v3, storage,
} from '@engine';

const CONFIG = {
  gravity: -60,          // snappy, Mario-like gravity (the default -30 feels floaty for this genre)
  runSpeed: 9,
  sprint: 1.5,           // Shift multiplier
  jumpSpeed: 28,         // ~3.5 tiles high
  stompBounce: 18,
  enemySpeed: 2.5,
  time: 300,             // seconds on the clock
  lives: 3,
  score: { coin: 200, stomp: 100, brick: 50, star: 1000, timeBonus: 50 },
};

// -----------------------------------------------------------------------------
// LEVEL — one character = one 2×2 tile. Rows are top → bottom.
//   #  ground        X  hard block     B  brick       ?  coin block    S  star block
//   [  pipe top      |  pipe body      o  coin        e  enemy         P  player start
//   F  goal flag     (space) = empty
// -----------------------------------------------------------------------------
const LEVEL = `


                ?                                              oooooo   BBB?B                  S

                                   ooo                                                                     X
                                                                                                          XX
          ?   B?BSB                                     ooo   BBBB?BBB             X  X     ?  ?  ?      XXX
                                    [         [                                   XX  XX                XXXX
                            [       |         |                                  XXX  XXX              XXXXX
  P                e        |   e   |    e e  |   e e           e  e      e e   XXXX  XXXX   e  e     XXXXXX      F
######################  ################################   #########################  ######################################
######################  ################################   #########################  ######################################`;

const P = '/assets/quaternius-platformer/';
const TILES = {
  grass: P + 'Cube_Grass_Single.glb',
  dirt: P + 'Cube_Dirt_Single.glb',
  hard: P + 'Cube_Default.glb',
  brick: P + 'Cube_Bricks.glb',
  question: P + 'Cube_Question.glb',
  used: P + 'Cube_Default.glb',
  pipeTop: P + 'Pipe_End.glb',
  pipe: P + 'Pipe_Straight.glb',
  coin: P + 'Coin.glb',
  star: P + 'Star.glb',
  enemy: P + 'Enemy.glb',
  hero: P + 'Character.glb',
  flag: P + 'Goal_Flag.glb',
  castle: P + 'Tower.glb',
  cloud: P + 'Cloud_1.glb',
  bush: P + 'Bush.glb',
  tree: P + 'Tree.glb',
};
const T = 2; // tile size in world units (Quaternius cubes are 2×2×2)

// -----------------------------------------------------------------------------
const game = new Game({ gravity: CONFIG.gravity, groundY: null, fov: 40 });
setupEnvironment(game, { sky: 'day', ground: false, fog: false, shadowArea: 30 });
await game.load(Object.values(TILES), 'World 1-1');

// ---- parse the map: rows[r][c], with row 0 at the top
const rows = LEVEL.replace(/^\n/, '').split('\n');
const H = rows.length, W = Math.max(...rows.map((r) => r.length));
const at = (c, r) => (rows[r] ?? '')[c] ?? ' ';
/** world position of the centre of tile (c, r). The bottom row sits on y = 0..2. */
const tilePos = (c, r) => v3(c * T, (H - 1 - r) * T + T / 2, 0);

async function place(url, pos, opts) {
  const m = await game.assets.model(url, opts);
  m.position.copy(pos);
  game.scene.add(m);
  return m;
}

// =============================================================================
//  LEVEL BUILDING
// =============================================================================
const blocks = [];      // bumpable blocks (bricks and "?")
let start = v3(4, 4, 0), flagX = W * T;
const spawns = { coins: [], enemies: [] };

for (let r = 0; r < H; r++) {
  // solid runs of ground / hard blocks become ONE collider each (fewer boxes = faster physics)
  let runStart = -1;
  for (let c = 0; c <= W; c++) {
    const solid = '#X'.includes(at(c, r));
    if (solid && runStart < 0) runStart = c;
    if (!solid && runStart >= 0) {
      const a = tilePos(runStart, r), b = tilePos(c - 1, r);
      game.physics.addBox([(a.x + b.x) / 2, a.y, 0], [(c - runStart) * T, T, T]);
      runStart = -1;
    }
  }
  for (let c = 0; c < W; c++) {
    const ch = at(c, r), pos = tilePos(c, r);
    if (ch === '#') await place(at(c, r - 1) === '#' ? TILES.dirt : TILES.grass, pos);
    if (ch === 'X') tint(await place(TILES.hard, pos), '#a0603a', 0.5);
    if (ch === '[' || ch === '|') {
      const pipe = await place(ch === '[' ? TILES.pipeTop : TILES.pipe, pos);
      game.physics.addCollider(pipe);
    }
    if (ch === 'B' || ch === '?' || ch === 'S') {
      const model = await place(ch === 'B' ? TILES.brick : TILES.question, pos);
      const collider = game.physics.addBox(pos, [T, T, T]);
      const block = { kind: ch === 'B' ? 'brick' : 'question', gives: ch === 'S' ? 'star' : 'coin', model, collider, home: pos.y, bump: 0 };
      collider.block = block;         // so we can find the block when the player headbutts the collider
      blocks.push(block);
    }
    if (ch === 'o') spawns.coins.push(pos);
    if (ch === 'e') spawns.enemies.push(pos.clone().setY(pos.y - T / 2));
    if (ch === 'P') start = pos.clone().setY(pos.y - T / 2);
    if (ch === 'F') flagX = pos.x;
  }
}

// ---- scenery (pure decoration, no colliders)
const groundTop = 2 * T; // top of the 2-row ground at the bottom of the map
const flag = await place(TILES.flag, v3(flagX, groundTop, 0), { scale: 2.6 });
await place(TILES.castle, v3(flagX + 14, groundTop, -4), { scale: 0.55 });
for (let x = 0; x < W * T; x += rand(10, 22)) {
  const c = await place(TILES.cloud, v3(x, rand(groundTop + 14, groundTop + 22), rand(-14, -8)), { scale: rand(1.2, 2) });
  tint(c, '#ffffff', 0.8);
  c.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.material.emissive?.set('#8899aa'); } });
}
for (let x = 6; x < W * T; x += rand(8, 18)) {
  const c = Math.round(x / T);
  if (at(c, H - 2) !== '#') continue;                      // only on solid ground
  await place(pick([TILES.bush, TILES.bush, TILES.tree]), v3(x, groundTop, rand(-5, -3)), { scale: rand(0.5, 0.8) });
}
for (let x = 0; x < W * T; x += rand(25, 40)) {           // big soft hills far behind
  game.scene.add(sphere(rand(9, 14), '#6cbf63', [x, groundTop - 7, -30]));
}

// =============================================================================
//  PLAYER — the engine's CharacterController, with movement mapped onto the X axis.
// =============================================================================
// Losing a life reloads the page (the simplest possible restart). Lives, score and coins survive
// that reload through storage; a fresh visit or "Play again" starts a new run.
const run = storage.load('ss-run', { lives: CONFIG.lives, score: 0, coins: 0 });
storage.remove('ss-run');
const state = { score: run.score, coins: run.coins, lives: run.lives, time: CONFIG.time, over: false };

class Player extends CharacterController {
  constructor(model) {
    super(game, model, {
      // "camera" just tells the controller which way is right: input x → world +X, ignore up/down
      camera: { toWorld: ({ x }) => v3(x, 0, 0) },
      speed: CONFIG.runSpeed, sprintMultiplier: CONFIG.sprint, jumpSpeed: CONFIG.jumpSpeed,
      acceleration: 10, airControl: 0.85, radius: 0.5, height: 1.6, position: start,
      animations: { idle: 'Idle', walk: 'Walk', run: 'Run', jump: 'Jump', fall: 'Jump_Idle' },
    });
    this.big = false;
    this.invulnerable = 0;
    this.dead = false;
  }

  grow() {
    if (this.big) return;
    this.big = true;
    this.model.scale.setScalar(0.72);
    this.body.height = 2.3;
    game.audio.play('powerup');
  }

  hurt() {
    if (this.invulnerable > 0 || this.dead || state.over) return;
    if (this.big) {                              // lose the power-up instead of a life
      this.big = false;
      this.model.scale.setScalar(0.5);
      this.body.height = 1.6;
      this.invulnerable = 1.5;
      game.audio.play('hurt');
      return;
    }
    this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.locked = true;
    this.animator.once('Death');
    game.audio.play('hurt');
    this.body.velocity.set(0, 20, 0);            // the classic death hop, then fall through everything
    const lives = state.lives - 1;
    game.after(2.5, () => {
      if (lives > 0) {                           // reload into the same run (skips the title)
        storage.save('ss-run', { lives, score: state.score, coins: state.coins });
        menu.restart();
      }
      else { state.over = true; menu.gameOver({ text: 'Out of lives!', score: state.score }); }
    });
  }

  update(dt) {
    if (this.dead) {                             // no collisions while dying: just fly up and fall off-screen
      this.body.velocity.y += CONFIG.gravity * dt;
      this.object.position.addScaledVector(this.body.velocity, dt);
      this.animator.update(dt);
      return;
    }
    super.update(dt);
    // keep everything on the 2D plane
    this.body.position.z = 0; this.body.velocity.z = 0; this.object.position.z = 0;
    if (this.body.position.x < 1) { this.body.position.x = 1; this.object.position.x = 1; }
    // face left/right only
    if (Math.abs(this.body.velocity.x) > 0.3) this.object.rotation.y = this.body.velocity.x > 0 ? Math.PI / 2 : -Math.PI / 2;

    // headbutting blocks
    if (this.body.ceiling?.block) bumpBlock(this.body.ceiling.block);

    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.model.visible = this.invulnerable === 0 || Math.floor(game.time * 20) % 2 === 0;
    if (this.position.y < -8) this.die();       // fell into a pit
  }
}

const heroModel = await game.assets.model(TILES.hero, { scale: 0.5 });
const player = game.add(new Player(heroModel));
player.object.rotation.y = Math.PI / 2;

// =============================================================================
//  BLOCKS, COINS, STAR
// =============================================================================
async function bumpBlock(block) {
  if (block.bump > 0) return;
  block.bump = 0.2;                              // animated in game.onUpdate below
  if (block.kind === 'brick') {
    if (!player.big) { game.audio.play('click'); return; }
    game.physics.remove(block.collider);         // smash!
    block.model.removeFromParent();
    blocks.splice(blocks.indexOf(block), 1);
    game.effects.burst(block.model.position, { color: '#b5651d', count: 16, size: 0.35, speed: 7, up: 8 });
    game.audio.play('hit');
    addScore(CONFIG.score.brick);
    return;
  }
  if (block.kind !== 'question') { game.audio.play('click'); return; }
  block.kind = 'used';
  const pos = block.model.position.clone();
  block.model.removeFromParent();                // swap the "?" for a plain block
  block.model = tint(await place(TILES.used, pos), '#8a6a4a', 0.6);
  if (block.gives === 'coin') {
    collectCoin(pos.clone().setY(pos.y + T), true);
  } else {
    game.audio.play('powerup', { pitch: 0.8 });
    game.add(new Star(await game.assets.model(TILES.star, { scale: 0.8 }), pos.clone().setY(pos.y + T / 2 + 0.01)));
  }
}

game.onUpdate((dt) => {                          // little bounce animation for bumped blocks
  for (const b of blocks) {
    if (b.bump <= 0) continue;
    b.bump = Math.max(0, b.bump - dt);
    b.model.position.y = b.home + Math.sin((b.bump / 0.2) * Math.PI) * 0.5;
  }
});

function collectCoin(pos, popUp = false) {
  state.coins++;
  addScore(CONFIG.score.coin);
  game.audio.play('coin');
  if (popUp) game.ui.floatingText(pos, '+1', '#ffd84a', { size: 26 });
  else game.effects.burst(pos, { color: '#ffd84a', count: 8 });
}

class Coin extends Entity {
  update(dt) {
    this.object.rotation.y += dt * 4;
    if (this.position.distanceTo(player.position.clone().setY(player.position.y + 0.8)) < 1.4) {
      collectCoin(this.position);
      this.destroy();
    }
  }
}
for (const pos of spawns.coins) game.add(new Coin(await game.assets.model(TILES.coin, { scale: 0.45 }))).position.copy(pos);

/** The power-up slides along and falls off ledges, like the classic mushroom. */
class Star extends Entity {
  constructor(model, pos) {
    super(model, { tags: ['powerup'] });
    this.body = new Body(game.physics, { radius: 0.5, height: 1.2, position: pos });
    this.body.velocity.x = -4;   // slides toward where the player came from
  }
  update(dt) {
    if (this.body.hitWall) this.body.velocity.x *= -1;
    this.body.velocity.x = Math.sign(this.body.velocity.x || 1) * 4;
    this.body.move(dt);
    this.body.position.z = 0;
    this.object.position.copy(this.body.position).setY(this.body.position.y + 0.7); // model origin is its centre
    this.object.rotation.y += dt * 3;
    if (this.position.y < -8) return this.destroy();
    if (this.body.box.intersectsBox(player.body.box)) {
      const wasBig = player.big;
      if (wasBig) addScore(CONFIG.score.star); else player.grow();
      game.effects.burst(this.position, { color: '#ffe95c', count: 24 });
      game.ui.floatingText(this.position, wasBig ? `+${CONFIG.score.star}` : 'POWER UP!', '#ffe95c');
      this.destroy();
    }
  }
}

// =============================================================================
//  ENEMIES — walk, turn around at walls, sleep until they're near the camera.
// =============================================================================
class Walker extends Entity {
  constructor(model, pos) {
    super(model, { tags: ['enemy'] });
    this.position.copy(pos);
    this.body = new Body(game.physics, { radius: 0.6, height: 1.1, position: pos });
    this.dir = -1;
    this.awake = false;
    this.anim = new Animator(model);
    this.anim.play('Walk');
  }
  update(dt) {
    this.anim.update(dt);
    if (this.squashed) return;
    if (!this.awake) { this.awake = this.position.x - game.camera.position.x < 26; return; }
    this.body.velocity.x = this.dir * CONFIG.enemySpeed;
    this.body.move(dt);
    if (this.body.hitWall) this.dir *= -1;
    this.body.position.z = 0;
    this.object.position.copy(this.body.position);
    this.object.rotation.y = this.dir * Math.PI / 2;
    if (this.position.y < -8) return this.destroy();

    // touching the player?
    if (player.dead || !this.body.box.intersectsBox(player.body.box)) return;
    const falling = player.body.velocity.y < 0;
    const above = player.position.y > this.position.y + this.body.height * 0.5;
    if (falling && above) this.stomp();
    else player.hurt();
  }
  stomp() {
    this.squashed = true;
    this.tags.delete('enemy');
    this.object.scale.y *= 0.3;                  // squish!
    game.audio.play('hit');
    player.launch(CONFIG.stompBounce);
    addScore(CONFIG.score.stomp, this.position);
    game.after(0.6, () => this.destroy());
  }
}
for (const pos of spawns.enemies) game.add(new Walker(await game.assets.model(TILES.enemy, { scale: 0.65 }), pos));

// =============================================================================
//  CAMERA — follows the player sideways, never scrolls past the start.
// =============================================================================
const cam = { x: 20, y: start.y + 4 };
game.onUpdate((dt) => {
  cam.x = damp(cam.x, Math.max(20, player.position.x + 3), 6, dt);   // 20 = don't show the left edge
  cam.y = damp(cam.y, Math.max(groundTop + 5, player.position.y + 3), 3, dt);
  game.camera.position.set(cam.x, cam.y + 2, 32);
  game.camera.lookAt(cam.x, cam.y, 0);
});

// =============================================================================
//  GOAL, TIMER, HUD
// =============================================================================
let won = false;
game.onUpdate((dt) => {
  if (state.over || won || player.dead) return;
  state.time -= dt;
  if (state.time <= 0) player.die();
  if (player.position.x >= flagX - 0.5) winLevel();
  hud();
});

function winLevel() {
  won = true;
  player.locked = true;
  player.body.velocity.x = 0;
  const bonus = Math.ceil(state.time) * CONFIG.score.timeBonus;
  addScore(bonus);
  flag.position.y = groundTop;
  game.effects.burst(flag.position.clone().setY(groundTop + 6), { color: '#ff5555', count: 40, up: 8 });
  state.over = true;
  hud();
  game.after(1.5, () => menu.win({ title: 'COURSE CLEAR!', text: `Time bonus +${bonus}`, score: state.score }));
}

function addScore(n, pos) {
  state.score += n;
  if (pos) game.ui.floatingText(pos.clone().setY(pos.y + 1.5), `${n}`, '#fff', { size: 18 });
}

const hudText = game.ui.text('', { top: 14, left: '50%' }, { size: 22 });
hudText.el.style.transform = 'translateX(-50%)';
hudText.el.style.fontFamily = 'ui-monospace, Menlo, Consolas, monospace';
function hud() {
  hudText.set(`SCORE ${String(state.score).padStart(6, '0')}    🪙×${String(state.coins).padStart(2, '0')}    WORLD 1-1    TIME ${Math.max(0, Math.ceil(state.time))}    ♥×${state.lives}`);
}
hud();
const CONTROLS = ['A/D or ←/→ — run', 'Space — jump (hold = higher)', 'Shift — run faster', 'Stomp enemies · bump ? blocks', 'Esc — pause'];
game.ui.controls(CONTROLS);

// title screen / pause / game over + phone controls
const menu = new GameMenu(game, {
  title: 'WORLD 1-1',
  subtitle: 'Reach the flag before the clock runs out!',
  controls: CONTROLS,
  touchControls: ['Stick — run left / right', 'Jump (hold = higher) · Run = faster'],
  accent: '#ff6b5a',
});
new TouchControls(game, { joystick: true, buttons: [{ label: 'Jump', key: 'Space' }, { label: 'Run', key: 'ShiftLeft' }] });

game.start();
