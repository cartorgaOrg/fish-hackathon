// =============================================================================
//  JUMP & RUN — a 3D platformer built from engine primitives.
//
//  Controls: WASD / arrows move · Space jump (press again in the air = double jump,
//            release early = short hop) · Shift sprint · right-drag orbit · wheel zoom
//
//  Goal: reach the flag at the end of the course. Stomp enemies by landing on them,
//  avoid saws and spikes, bounce on springs, touch flags to save your progress.
//
//  How to change things:
//    • The course layout lives in ./level.js — add/move platforms, coins, enemies there.
//    • Feel (speed, jump height, gravity, lives…) lives in CONFIG below.
//    • Each kind of object is a small class further down (Coin, Enemy, Saw…). Copy one
//      to invent a new object, then add a `case` for it in buildLevel().
// =============================================================================
import {
  Game, Entity, CharacterController, FollowCamera, Animator, Health, setupEnvironment, tint,
  THREE, rand, pick,
} from '@engine';
import { LEVEL } from './level.js';

const CONFIG = {
  speed: 6,             // run speed (Shift = ×1.6)
  jumpSpeed: 11,        // jump strength
  maxJumps: 2,          // 2 = double jump
  gravity: -30,
  hearts: 3,            // hits per life
  lives: 3,
  bounceSpeed: 22,      // spring pad launch speed
  stompBounce: 12,      // bounce after stomping an enemy
  gemValue: 5,          // a gem counts as this many coins
  fallY: -15,           // below this height you lose a life
};

const A = '/assets/quaternius-platformer/';
const M = {
  hero: A + 'Character.glb', grass: A + 'Cube_Grass_Single.glb', bricks: A + 'Cube_Bricks.glb',
  coin: A + 'Coin.glb', gem: A + 'Gem_Green.glb', enemy: A + 'Enemy.glb', saw: A + 'Hazard_Saw.glb',
  spikes: A + 'Hazard_SpikeTrap.glb', bouncer: A + 'Bouncer.glb', flag: A + 'Goal_Flag.glb',
  tree: A + 'Tree.glb', bush: A + 'Bush.glb', cloud1: A + 'Cloud_1.glb', cloud2: A + 'Cloud_2.glb', cloud3: A + 'Cloud_3.glb',
};

// ----------------------------------------------------------------------------- setup
const game = new Game({ groundY: null, gravity: CONFIG.gravity }); // no floor: fall = lose a life
setupEnvironment(game, { sky: 'day', ground: false, fog: { near: 80, far: 260 } });
await game.load(Object.values(M));

const v = (a) => new THREE.Vector3(...a);
const box = (center, size) => new THREE.Box3().setFromCenterAndSize(center, size);

// ----------------------------------------------------------------------------- player
// The stock CharacterController + a blink effect. Springs, stomps and knockback use the
// built-in player.launch(vy), which isn't cut short when you let go of Space.
class Player extends CharacterController {
  update(dt) {
    super.update(dt);
    // blink while invulnerable after a hit
    this.model.visible = !health.invulnerable || Math.floor(game.time * 15) % 2 === 0;
  }
}

const heroModel = await game.assets.model(M.hero, { scale: 0.55 });
const player = new Player(game, heroModel, {
  speed: CONFIG.speed, jumpSpeed: CONFIG.jumpSpeed, maxJumps: CONFIG.maxJumps, height: 1.7, radius: 0.45,
});
const cam = game.add(new FollowCamera(game, player.object, { distance: 13, pitch: 0.42, height: 1.2, collide: false }));
player.camera = cam;

// ----------------------------------------------------------------------------- game state & HUD
let respawnPoint = new THREE.Vector3();
let lives = CONFIG.lives, coins = 0, totalCoins = 0, dying = false, finished = false;

const health = new Health(CONFIG.hearts, {
  invulnerableTime: 1.5,
  onDamage: () => { game.audio.play('hurt'); game.effects.shake(0.3); updateHud(); },
  onDeath: () => loseLife(),
});

const hud = {
  hearts: game.ui.text('', { top: 16, left: 16 }, { size: 28 }),
  coins: game.ui.text('', { top: 56, left: 16 }, { size: 22 }),
  time: game.ui.text('', { top: 16, right: 16 }, { size: 22 }),
};
function updateHud() {
  hud.hearts.set('❤️'.repeat(health.hp) + '🖤'.repeat(health.max - health.hp) + `   lives × ${lives}`);
  hud.coins.set(`🪙 ${coins} / ${totalCoins}`);
}
game.onUpdate(() => { if (!finished) hud.time.set(`⏱ ${game.time.toFixed(1)}s`); });
game.ui.controls(['WASD — move', 'Space — jump / double jump', 'Shift — sprint', 'Land on enemies to stomp them', 'Right-drag — orbit camera']);

/** Take a hit, knocked away from `from`. */
function hurt(from) {
  if (dying || finished || !health.damage(1)) return;
  const away = player.position.clone().sub(from).setY(0).normalize().multiplyScalar(8);
  player.body.velocity.x = away.x;
  player.body.velocity.z = away.z;
  player.launch(8);
}

function loseLife() {
  if (dying) return;
  dying = true;
  lives--;
  player.locked = true;
  player.animator.once('Death');
  game.audio.play('death');
  updateHud();
  if (lives <= 0) {
    game.audio.play('lose');
    game.ui.message('Game Over', 0, { sub: 'Press Enter to try again' });
    addEventListener('keydown', (e) => { if (e.code === 'Enter') location.reload(); });
    return;
  }
  game.after(1.2, () => {
    player.teleport(respawnPoint);
    health.reset();
    player.locked = false;
    player.animator.play('Idle');
    dying = false;
    updateHud();
  });
}

// ----------------------------------------------------------------------------- level objects
/** Spinning collectible. value = how many coins it's worth. */
class Pickup extends Entity {
  constructor(model, value) { super(model, { tags: ['pickup'] }); this.value = value; this.baseY = model.position.y; }
  update(dt) {
    this.object.rotation.y += dt * 3;
    this.position.y = this.baseY + Math.sin(game.time * 3 + this.object.id) * 0.15;
    if (this.position.distanceTo(player.position.clone().setY(player.position.y + 0.9)) < 1.3) {
      coins += this.value;
      game.audio.play(this.value > 1 ? 'powerup' : 'coin');
      game.effects.burst(this.position, { color: this.value > 1 ? '#4dff88' : '#ffd84a', count: this.value > 1 ? 30 : 12 });
      game.ui.floatingText(this.position, `+${this.value}`, '#ffd84a');
      updateHud();
      this.destroy();
    }
  }
}

/** Platform sliding back and forth between two points. Riders are carried by the physics engine. */
class MovingPlatform extends Entity {
  constructor(model, from, to, period) { super(model, { tags: ['platform'] }); this.from = from; this.to = to; this.period = period; }
  update() {
    const t = (Math.sin((game.time / this.period) * Math.PI * 2) + 1) / 2;
    this.position.lerpVectors(this.from, this.to, t);
  }
}

/** Walks between two points. Landing on its head kills it; touching its side hurts you. */
class Enemy extends Entity {
  constructor(model, from, to, speed = 2) {
    super(model, { tags: ['enemy'] });
    this.from = from; this.to = to; this.speed = speed; this.dir = 1; this.dead = false;
    this.anim = new Animator(model);
    this.anim.play('Walk');
  }
  update(dt) {
    this.anim.update(dt);
    if (this.dead) return;
    const target = this.dir > 0 ? this.to : this.from;
    const step = target.clone().sub(this.position).setY(0);
    if (step.length() < 0.1) this.dir *= -1;
    else {
      step.setLength(Math.min(step.length(), this.speed * dt));
      this.position.add(step);
      this.rotation.y = Math.atan2(step.x, step.z);
    }
    // collision with the player
    const hitBox = box(this.position.clone().setY(this.position.y + 0.8), v([1.4, 1.6, 1.4]));
    if (!dying && player.body.box.intersectsBox(hitBox)) {
      if (player.body.velocity.y < 0 && player.position.y > this.position.y + 0.7) this.stomp();
      else hurt(this.position);
    }
  }
  stomp() {
    this.dead = true;
    player.launch(CONFIG.stompBounce);
    game.audio.play('hit');
    game.effects.burst(this.position.clone().setY(this.position.y + 0.8), { color: '#a35cff', count: 20 });
    game.ui.floatingText(this.position, 'STOMP!', '#fff');
    this.anim.once('Death');
    game.after(0.8, () => this.destroy());
  }
}

/** A hurt-zone: anything with a box that damages the player on contact. Saws move & spin. */
class Hazard extends Entity {
  constructor(model, size, { from, to, period = 3 } = {}) { super(model, { tags: ['hazard'] }); Object.assign(this, { size, from, to, period }); }
  update(dt) {
    if (this.from) {
      const t = (Math.sin((game.time / this.period) * Math.PI * 2) + 1) / 2;
      this.position.lerpVectors(this.from, this.to, t);
      this.rotation.z -= dt * 10; // spin the blade
    }
    const center = this.position.clone().setY(this.position.y + (this.from ? 0 : this.size.y / 2));
    if (player.body.box.intersectsBox(box(center, this.size))) hurt(this.position);
  }
}

/** Spring pad: standing on its collider launches you. */
class Bouncer extends Entity {
  constructor(model, collider) { super(model); this.collider = collider; this.anim = new Animator(model); this.anim.play('Bouncer_Idle'); }
  update(dt) {
    this.anim.update(dt);
    if (player.body.ground === this.collider && player.body.onGround) {
      player.launch(CONFIG.bounceSpeed);
      this.anim.once('Bouncer_Bounce', { then: 'Bouncer_Idle' });
      game.audio.play('jump', { pitch: 1.6 });
      game.effects.ring(this.position, { color: '#ffee55', size: 3 });
    }
  }
}

/** Touch to save progress. Grey until activated. */
class Checkpoint extends Entity {
  update() {
    if (this.active || this.position.distanceTo(player.position) > 1.8) return;
    this.active = true;
    respawnPoint = this.position.clone();
    game.assets.model(M.flag, { scale: 0.6 }).then((m) => { this.object.clear(); this.object.add(m); });
    game.audio.play('powerup');
    game.effects.burst(this.position.clone().setY(this.position.y + 1), { color: '#ff5555', count: 25 });
    game.ui.toast('🚩 Checkpoint!');
  }
}

class Goal extends Entity {
  update() {
    if (finished || this.position.distanceTo(player.position) > 2.2) return;
    finished = true;
    player.locked = true;
    player.anims.idle = 'Wave'; // celebrate on the spot
    game.audio.play('win');
    for (let i = 0; i < 5; i++) game.after(i * 0.25, () => game.effects.burst(this.position.clone().add(v([rand(-2, 2), 3, rand(-2, 2)])), { color: pick(['#ff5', '#5f8', '#f5a', '#5cf']), count: 30 }));
    game.ui.message('🏁 Course complete!', 0, { sub: `Time ${game.time.toFixed(1)}s · Coins ${coins} / ${totalCoins} · Press Enter to play again` });
    addEventListener('keydown', (e) => { if (e.code === 'Enter') location.reload(); });
  }
}

/** Slowly drifting background cloud. */
class Cloud extends Entity {
  update(dt) { this.position.x += dt * 0.6; if (this.position.x > 60) this.position.x = -60; }
}

// ----------------------------------------------------------------------------- build the level
/** Solid block whose TOP is at pos.y. */
async function addBlock(pos, size, style = 'grass') {
  const model = await game.assets.model(style === 'bricks' ? M.bricks : M.grass);
  model.scale.set(size.x / 2, size.y / 2, size.z / 2); // source cubes are 2×2×2, centered
  model.position.set(pos.x, pos.y - size.y / 2, pos.z);
  return model;
}

async function buildLevel() {
  for (const it of LEVEL) {
    const pos = it.pos && v(it.pos);
    switch (it.type) {
      case 'start':
        respawnPoint = pos.clone();
        player.teleport(pos);
        break;
      case 'platform': {
        const size = v(it.size);
        game.scene.add(await addBlock(pos, size, it.style));
        game.physics.addBox(pos.clone().setY(pos.y - size.y / 2), size);
        break;
      }
      case 'moving': {
        const size = v(it.size);
        const model = await addBlock(v(it.from), size, 'bricks');
        const offset = new THREE.Vector3(0, -size.y / 2, 0); // entity position = block centre
        const plat = game.add(new MovingPlatform(model, v(it.from).add(offset), v(it.to).add(offset), it.period));
        game.physics.addCollider(plat.object, { dynamic: true });
        break;
      }
      case 'coin': case 'gem': {
        const isGem = it.type === 'gem';
        const model = await game.assets.model(isGem ? M.gem : M.coin, { scale: isGem ? 0.5 : 0.4 });
        model.position.copy(pos);
        game.add(new Pickup(model, isGem ? CONFIG.gemValue : 1));
        totalCoins += isGem ? CONFIG.gemValue : 1;
        break;
      }
      case 'coins':
        for (let i = 0; i < it.count; i++) {
          const p = v(it.from).lerp(v(it.to), it.count > 1 ? i / (it.count - 1) : 0);
          const model = await game.assets.model(M.coin, { scale: 0.4 });
          model.position.copy(p);
          game.add(new Pickup(model, 1));
          totalCoins++;
        }
        break;
      case 'enemy': {
        const model = await game.assets.model(M.enemy);
        model.position.copy(v(it.from));
        game.add(new Enemy(model, v(it.from), v(it.to), it.speed));
        break;
      }
      case 'spikes': {
        const model = await game.assets.model(M.spikes, { scale: 0.9 });
        model.position.copy(pos);
        game.add(new Hazard(model, v([1.6, 0.6, 1.6])));
        break;
      }
      case 'saw': {
        const model = await game.assets.model(M.saw, { scale: 0.8 });
        model.position.copy(v(it.from));
        game.add(new Hazard(model, v([2.0, 2.0, 0.6]), { from: v(it.from), to: v(it.to), period: it.period }));
        break;
      }
      case 'bouncer': {
        const model = await game.assets.model(M.bouncer, { scale: 0.7 });
        model.position.copy(pos);
        const collider = game.physics.addBox(pos.clone().setY(pos.y + 0.4), v([1.4, 0.8, 1.4]));
        game.add(new Bouncer(model, collider));
        break;
      }
      case 'checkpoint': {
        const model = tint(await game.assets.model(M.flag, { scale: 0.6 }), '#888888', 0.8);
        const cp = new Checkpoint(new THREE.Group());
        cp.object.add(model);
        cp.position.copy(pos);
        game.add(cp);
        break;
      }
      case 'goal': {
        const model = await game.assets.model(M.flag, { scale: 1.3 });
        model.position.copy(pos);
        game.add(new Goal(model));
        break;
      }
      case 'tree': case 'bush': {
        const model = await game.assets.model(it.type === 'tree' ? M.tree : M.bush, { scale: it.scale ?? (it.type === 'tree' ? 0.35 : 0.4) });
        model.position.copy(pos);
        model.rotation.y = rand(0, Math.PI * 2);
        game.scene.add(model);
        break;
      }
      default:
        console.warn('Unknown level item', it);
    }
  }
  // background clouds
  for (let i = 0; i < 25; i++) {
    const model = tint(await game.assets.model(pick([M.cloud1, M.cloud2, M.cloud3]), { scale: rand(1.5, 3), shadows: false }), '#ffffff', 0.6);
    model.position.set(rand(-60, 60), rand(-10, 30), rand(-140, 20));
    if (Math.abs(model.position.x) < 20) model.position.x += Math.sign(model.position.x || 1) * 20; // keep the course clear
    game.add(new Cloud(model));
  }
}

await buildLevel();
game.add(player); // added last so it moves after the platforms each frame

// fell off the world?
game.onUpdate(() => { if (!dying && player.position.y < CONFIG.fallY) { health.hp = 0; loseLife(); } });

updateHud();
game.start();
