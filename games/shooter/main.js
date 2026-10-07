// =============================================================================
//  ARENA SHOOTER — first-person wave survival.
//
//  Controls: click to capture the mouse · mouse = look · WASD = move · Space = jump
//            Shift = sprint · Left click = shoot · R = reload · 1 / 2 = switch weapon
//            Enter = restart after game over · Esc = release the mouse (pauses)
//
//  How to change things:
//    • Weapons (damage, fire rate, magazine…)  → CONFIG.weapons
//    • Enemy stats / wave size                 → CONFIG.enemies, CONFIG.waves
//    • The arena (cover, crates, barrels)      → LAYOUT
//    • Enemy brain                             → class Skeleton (a StateMachine)
//    • Shooting                                → function fire()
// =============================================================================
import {
  THREE, Game, Entity, Body, FirstPersonCamera, Health, StateMachine, Animator,
  setupEnvironment, attach, fitSize, getBounds, cooldown, rand, pick, damp, distXZ, yawTo, v3,
} from '@engine';

// ----------------------------------------------------------------- CONFIG
const CONFIG = {
  player: { health: 100, speed: 7, sprint: 1.5, jump: 9 },
  weapons: [
    { name: 'Rifle', model: '/assets/quaternius-scifi-guns/AR_1.glb', length: 0.6,
      damage: 18, fireRate: 10, mag: 30, reserve: 150, reload: 1.6, spread: 0.02, auto: true, kick: 0.012, pitch: 1.0 },
    { name: 'Pistol', model: '/assets/quaternius-scifi-guns/Pistol_1.glb', length: 0.3,
      damage: 35, fireRate: 4, mag: 12, reserve: Infinity, reload: 1.1, spread: 0.006, auto: false, kick: 0.03, pitch: 1.4 },
  ],
  headshotMultiplier: 2,
  enemies: {
    //        model file                                      hp  speed dmg  score weapon
    minion:  { url: '/assets/kaykit-skeletons/Skeleton_Minion.glb',  hp: 40, speed: 3.4, damage: 8,  score: 100, weapon: 'Skeleton_Axe' },
    rogue:   { url: '/assets/kaykit-skeletons/Skeleton_Rogue.glb',   hp: 30, speed: 4.8, damage: 6,  score: 150, weapon: 'Skeleton_Blade' },
    warrior: { url: '/assets/kaykit-skeletons/Skeleton_Warrior.glb', hp: 110, speed: 2.6, damage: 20, score: 300, weapon: 'Skeleton_Blade' },
  },
  waves: {
    first: 4,          // enemies in wave 1
    growth: 2,         // extra enemies per wave
    spawnInterval: 0.9, // seconds between spawns
    // which enemy types appear from which wave on
    pool: (wave) => ['minion', ...(wave >= 2 ? ['rogue'] : []), ...(wave >= 3 ? ['warrior'] : [])],
  },
  dropChance: 0.3,     // chance a kill drops a pickup
};

// ----------------------------------------------------------------- ARENA LAYOUT
// m = model key from PROPS, x/z = position, s = scale, r = rotation (degrees). Floor + outer walls are automatic.
const ARENA_HALF = 20; // arena goes from -20 to 20 on X and Z
const PROPS = {
  block:  { url: '/assets/kaykit-prototype/Cube_Prototype_Large_A.gltf', lift: 0 },   // 4×4×4
  cube:   { url: '/assets/kaykit-prototype/Primitive_Cube.gltf', lift: 0 },          // 4×4×4
  wall:   { url: '/assets/kaykit-prototype/Wall.gltf', lift: 0 },                     // 4×4×0.5
  barrel: { url: '/assets/kaykit-prototype/Barrel_A.gltf', lift: 0.5 },               // 1×1×1, centred
  box:    { url: '/assets/kaykit-prototype/Box_A.gltf', lift: 0 },                    // small crate
};
const LAYOUT = [
  { m: 'block', x: -8, z: -8, s: 0.5 }, { m: 'block', x: 8, z: -8, s: 0.5 },
  { m: 'block', x: -8, z: 8, s: 0.5 },  { m: 'block', x: 8, z: 8, s: 0.5 },
  { m: 'cube', x: 0, z: -12, s: 0.75 }, { m: 'cube', x: 0, z: 12, s: 0.75 },
  { m: 'wall', x: -13, z: 0, r: 90 },   { m: 'wall', x: 13, z: 0, r: 90 },
  { m: 'wall', x: 4, z: 3, s: 0.5 },    { m: 'wall', x: -4, z: -3, s: 0.5 },
  { m: 'barrel', x: -6, z: 2, s: 1.2 }, { m: 'barrel', x: 6, z: -2, s: 1.2 }, { m: 'barrel', x: 15, z: 15 },
  { m: 'box', x: -15, z: -14, s: 3 },   { m: 'box', x: 14, z: -15, s: 3 }, { m: 'box', x: -15, z: 15, s: 3 },
];
const SPAWNS = [[-17, -17], [17, -17], [-17, 17], [17, 17], [0, -18], [0, 18], [-18, 0], [18, 0]];

// ----------------------------------------------------------------- SETUP
const game = new Game({ fov: 75 });
setupEnvironment(game, { sky: 'sunset', ground: false, fog: { near: 30, far: 90 } });
game.scene.add(game.camera); // the gun is a child of the camera, so the camera must be in the scene

const PICKUPS = { health: '/assets/quaternius-platformer/Heart.glb', ammo: '/assets/kaykit-prototype/Box_A.gltf' };
await game.load([
  '/assets/kaykit-prototype/Floor_Prototype.gltf',
  ...Object.values(PROPS).map((p) => p.url),
  ...CONFIG.weapons.map((w) => w.model),
  ...Object.values(CONFIG.enemies).map((e) => e.url),
  ...Object.values(PICKUPS),
], 'Loading arena…');

await buildArena();

// ----------------------------------------------------------------- PLAYER
const body = new Body(game.physics, { radius: 0.4, height: 1.8, position: v3(0, 0, 4) });
const fps = game.add(new FirstPersonCamera(game, body, { eyeHeight: 1.6 }));
const player = {
  health: new Health(CONFIG.player.health, {
    invulnerableTime: 0.4,
    onDamage: () => { game.audio.play('hurt'); game.effects.shake(0.35); hurtFlash = 0.6; },
    onDeath: () => gameOver(),
  }),
};

// One "slot" per weapon: its model on the camera + its ammo counters.
const slots = [];
for (const w of CONFIG.weapons) slots.push({ w, model: await makeGun(w), ammo: w.mag, reserve: w.reserve, cd: cooldown(1 / w.fireRate) });
let current = 0, reloading = 0, recoil = 0, flashTime = 0;
showWeapon(0);

// ----------------------------------------------------------------- HUD
game.ui.crosshair();
const hpBar = game.ui.bar({ bottom: 28, left: '50%' }, { width: 260, height: 22, color: '#e5484d', label: '100' });
hpBar.el.style.transform = 'translateX(-50%)';
const ammoText = game.ui.text('', { bottom: 24, right: 32 }, { size: 40 });
const weaponText = game.ui.text('', { bottom: 74, right: 32 }, { size: 18 });
const scoreText = game.ui.text('Score: 0', { top: 16, left: 16 }, { size: 24 });
const waveText = game.ui.text('', { top: 40, left: '50%' }, { size: 22 });
waveText.el.style.transform = 'translateX(-50%)';
const vignette = game.ui.el('div', { pos: { top: 0, left: 0, right: 0, bottom: 0 } });
Object.assign(vignette.style, { background: 'radial-gradient(ellipse at center, transparent 45%, #d00 120%)', opacity: 0 });
game.ui.controls(['Click — capture mouse', 'WASD — move · Space — jump', 'Left click — shoot', 'R — reload · 1/2 — weapons']);

// "Click to play" overlay (browsers only allow mouse capture after a click)
const overlay = game.ui.el('div', { className: 'fx-dialog-wrap', html: '<div class="fx-dialog"><h3>Arena Shooter</h3><p>Survive the skeleton waves.<br>Click to play.</p></div>' });
overlay.style.alignItems = 'center';
game.paused = true; // frozen until the first click
overlay.onclick = () => { overlay.style.display = 'none'; game.paused = false; game.input.lockPointer(); };
document.addEventListener('pointerlockchange', () => {
  // Esc releases the mouse → pause and show the overlay again
  if (!game.input.pointerLocked && !state.over) { overlay.style.display = ''; game.paused = true; }
});

// ----------------------------------------------------------------- GAME STATE
const state = { score: 0, wave: 0, toSpawn: 0, loading: 0, over: false, between: false };
let hurtFlash = 0;
let spawnTimer = 0;
const muzzleWorld = new THREE.Vector3();

game.onUpdate((dt) => {
  updateHud(dt);
  if (state.over) return;
  movePlayer(dt);
  handleWeapon(dt);
  updateWaves(dt);
});

addEventListener('keydown', (e) => { if (e.code === 'Enter' && state.over) restart(); });
startWave();
game.start();

// ============================================================================ PLAYER

function movePlayer(dt) {
  const { input } = game;
  const sprint = input.anyDown('ShiftLeft', 'ShiftRight') ? CONFIG.player.sprint : 1;
  const wish = fps.toWorld(input.move()).multiplyScalar(CONFIG.player.speed * sprint);
  body.velocity.x = damp(body.velocity.x, wish.x, 12, dt);
  body.velocity.z = damp(body.velocity.z, wish.z, 12, dt);
  if (input.pressed('Space') && body.onGround) body.velocity.y = CONFIG.player.jump;
  body.move(dt);
}

// ============================================================================ WEAPONS

/** Load a gun model and set it up as a child of the camera, barrel pointing forward (-Z). */
async function makeGun(w) {
  const holder = new THREE.Group();
  const model = await game.assets.model(w.model, { shadows: false });
  fitSize(model, w.length);
  model.rotation.y = Math.PI / 2;               // these guns are modelled along +X; turn them to face -Z
  const box = getBounds(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);                   // centre the gun on the holder
  holder.add(model);
  const muzzle = new THREE.Object3D();          // where tracers and the flash come from
  muzzle.position.set(0, 0.04, box.min.z - center.z);
  holder.add(muzzle);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
  flash.add(new THREE.PointLight('#ffb347', 6, 6));
  flash.visible = false;
  muzzle.add(flash);
  holder.userData = { muzzle, flash, rest: new THREE.Vector3(0.22, -0.22, -0.5) };
  holder.position.copy(holder.userData.rest);
  game.camera.add(holder);
  return holder;
}

function showWeapon(i) {
  current = i;
  reloading = 0;
  slots.forEach((s, k) => { s.model.visible = k === i; });
  game.audio.play('click');
}

function handleWeapon(dt) {
  const { input } = game;
  const slot = slots[current];
  if (input.pressed('Digit1')) showWeapon(0);
  if (input.pressed('Digit2') && slots[1]) showWeapon(1);

  // reloading: count down, then move bullets from reserve into the magazine
  if (reloading > 0) {
    reloading -= dt;
    if (reloading <= 0) {
      const take = Math.min(slot.w.mag - slot.ammo, slot.reserve);
      slot.ammo += take;
      slot.reserve -= take;
    }
  } else if ((input.pressed('KeyR') || slot.ammo === 0) && slot.ammo < slot.w.mag && slot.reserve > 0) {
    reloading = slot.w.reload;
    game.audio.play('click', { pitch: 0.6 });
  }

  // shooting works with or without pointer lock (aim = centre of the screen)
  const trigger = input.mousePressed(0) || (slot.w.auto && input.mouseDown(0)); // auto weapons keep firing while held
  if (trigger && overlay.style.display === 'none' && reloading <= 0 && slot.ammo > 0 && slot.cd.ready()) fire(slot);
  else if (input.mousePressed(0) && slot.ammo === 0 && reloading <= 0) game.audio.play('click', { pitch: 2 });

  // gun animation: bob while walking, kick back on recoil, dip while reloading
  const gun = slot.model, rest = gun.userData.rest;
  const speed = Math.hypot(body.velocity.x, body.velocity.z);
  const bob = body.onGround ? Math.min(speed / 7, 1) : 0;
  recoil = damp(recoil, 0, 14, dt);
  const dip = reloading > 0 ? Math.sin((reloading / slot.w.reload) * Math.PI) * 0.25 : 0;
  gun.position.set(
    rest.x + Math.sin(game.time * 10) * 0.015 * bob,
    rest.y + Math.abs(Math.cos(game.time * 10)) * 0.015 * bob - dip,
    rest.z + recoil,
  );
  gun.rotation.x = recoil * 1.5 - dip;
  flashTime -= dt;
  gun.userData.flash.visible = flashTime > 0;
}

/** Fire one bullet: a hitscan ray from the camera through the crosshair. */
function fire(slot) {
  const w = slot.w;
  if (slot.ammo <= 0) return;
  slot.ammo--;
  recoil = 0.06;
  fps.kick += w.kick;
  flashTime = 0.05;
  game.audio.play('shoot', { volume: 0.5, pitch: w.pitch });

  const origin = game.camera.getWorldPosition(new THREE.Vector3());
  const dir = fps.forward().add(v3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(w.spread)).normalize();
  const hit = game.physics.raycast(origin, dir, { maxDist: 120, entities: game.findAll('enemy') });
  const end = hit ? hit.point : origin.clone().addScaledVector(dir, 120);

  slot.model.userData.muzzle.getWorldPosition(muzzleWorld);
  game.effects.tracer(muzzleWorld, end);
  if (!hit) return;
  if (hit.entity) {
    const head = hit.point.y > hit.entity.position.y + hit.entity.height * 0.7;
    hit.entity.takeHit(w.damage * (head ? CONFIG.headshotMultiplier : 1), hit.point, head);
  } else {
    game.effects.burst(hit.point, { color: '#cfc6b8', count: 5, speed: 2, size: 0.06, up: 1 }); // wall dust
  }
}

// ============================================================================ ENEMIES

class Skeleton extends Entity {
  constructor(type, model, pos) {
    super(new THREE.Group(), { tags: ['enemy'] });
    const cfg = CONFIG.enemies[type];
    this.cfg = cfg;
    this.object.add(model);
    this.height = getBounds(model).getSize(new THREE.Vector3()).y;
    model.traverse((o) => { if (o.isMesh) o.raycast = () => {}; }); // shoot the hitbox, not the skinned mesh (faster)
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1, this.height, 1), new THREE.MeshBasicMaterial());
    hitbox.position.y = this.height / 2;
    hitbox.visible = false;                                         // invisible but still hit by raycasts
    this.object.add(hitbox);

    this.body = new Body(game.physics, { radius: 0.45, height: this.height, position: pos });
    this.object.position.copy(pos);
    this.anim = new Animator(model);
    this.bar = game.ui.worldBar(this.object, this.height + 0.3);
    this.health = new Health(cfg.hp, {
      onDamage: () => this.bar.set(this.health.fraction),
      onDeath: () => this.ai.go('dead'),
    });

    // The brain: each state has enter() and/or update(dt). Add your own states here!
    this.ai = new StateMachine({
      spawn: {
        enter: () => this.anim.once('Spawn_Ground_Skeletons', { speed: 1.8, onEnd: () => this.ai.go('chase') }),
      },
      chase: {
        enter: () => this.anim.play('Running_A'),
        update: () => {
          if (distXZ(this.position, body.position) < 1.8) this.ai.go('attack');
          else this.steer(this.cfg.speed);
        },
      },
      attack: {
        enter: () => {
          this.anim.once('1H_Melee_Attack_Chop', { onEnd: () => this.ai.go('chase') });
          this.struck = false;
        },
        update: () => {
          this.steer(0);
          // deal damage mid-swing, if the player is still close
          if (!this.struck && this.ai.time > 0.45) {
            this.struck = true;
            if (distXZ(this.position, body.position) < 2.4) player.health.damage(this.cfg.damage, this);
          }
        },
      },
      cheer: { enter: () => this.anim.play('Cheer'), update: () => this.steer(0) }, // the player died 💀
      hit: {
        enter: () => this.anim.once('Hit_A', { speed: 1.6, onEnd: () => this.ai.go('chase') }),
        update: () => this.steer(0),
      },
      dead: {
        enter: () => {
          this.tags.delete('enemy');
          this.bar.remove();
          this.anim.once('Death_A');
          state.score += this.cfg.score;
          if (Math.random() < CONFIG.dropChance) spawnPickup(pick(['health', 'ammo']), this.position.clone());
          game.after(3, () => this.destroy());
        },
        update: () => this.steer(0),
      },
    }, 'spawn');
  }

  /** Face the player and run toward them (speed 0 = just stand and turn), pushing away from other skeletons. */
  steer(speed) {
    const yaw = yawTo(this.position, body.position);
    this.object.rotation.y = yaw;
    const v = v3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(speed);
    for (const other of game.findAll('enemy')) {                  // simple separation
      if (other === this) continue;
      const d = distXZ(this.position, other.position);
      if (d < 1.2 && d > 0.001) v.add(v3(this.position.x - other.position.x, 0, this.position.z - other.position.z).multiplyScalar((1.2 - d) * 4 / d));
    }
    this.body.velocity.x = v.x;
    this.body.velocity.z = v.z;
  }

  takeHit(dmg, point, head) {
    if (!this.health.damage(dmg)) return;
    game.audio.play('hit', { pitch: head ? 1.5 : 1 });
    game.effects.flash(this.object);
    game.effects.burst(point, { color: head ? '#ffe066' : '#e8e2d0', count: head ? 12 : 6, speed: 3, size: 0.08 });
    game.ui.floatingText(point, head ? `${Math.round(dmg)}!` : `${Math.round(dmg)}`, head ? '#ffe066' : '#fff');
    if (!this.health.dead && !this.ai.is('attack') && !this.ai.is('spawn') && Math.random() < 0.5) this.ai.go('hit', true);
  }

  update(dt) {
    this.ai.update(dt);
    this.body.move(dt);
    this.object.position.copy(this.body.position);
    this.anim.update(dt);
  }

  onRemoved() { this.bar.remove(); }
}

async function spawnEnemy(type) {
  const cfg = CONFIG.enemies[type];
  state.loading++; // models load asynchronously — don't count the wave as cleared meanwhile
  const model = await game.assets.model(cfg.url);
  if (cfg.weapon) attach(model, 'handslot.r', await game.assets.model(`/assets/kaykit-skeletons/${cfg.weapon}.gltf`));
  const [x, z] = pick(SPAWNS);
  state.loading--;
  if (!state.over) game.add(new Skeleton(type, model, v3(x + rand(-1, 1), 0, z + rand(-1, 1))));
}

// ============================================================================ WAVES

let cancelNextWave = null;
function startWave() {
  state.wave++;
  state.toSpawn = CONFIG.waves.first + (state.wave - 1) * CONFIG.waves.growth;
  state.between = false;
  spawnTimer = 0;
  game.ui.message(`Wave ${state.wave}`, 1.6, { sub: `${state.toSpawn} skeletons incoming` });
  game.audio.play('powerup');
}

function updateWaves(dt) {
  if (state.between) return;
  spawnTimer -= dt;
  if (state.toSpawn > 0 && spawnTimer <= 0) {
    state.toSpawn--;
    spawnTimer = CONFIG.waves.spawnInterval;
    spawnEnemy(pick(CONFIG.waves.pool(state.wave)));
  }
  if (state.toSpawn === 0 && state.loading === 0 && game.findAll('enemy').length === 0) {
    state.between = true;
    game.audio.play('win');
    game.ui.message('Wave cleared!', 2);
    cancelNextWave = game.after(3, () => { if (!state.over) startWave(); });
  }
}

// ============================================================================ PICKUPS

async function spawnPickup(kind, pos) {
  const model = await game.assets.model(PICKUPS[kind], { height: kind === 'health' ? 0.6 : 0.7 });
  const p = new Entity(model, { tags: ['pickup'] });
  p.position.set(pos.x, 0.6, pos.z);
  p.onUpdate((dt) => {
    p.object.rotation.y += dt * 2;
    p.position.y = 0.6 + Math.sin(game.time * 3) * 0.15;
    if (distXZ(p.position, body.position) < 1.3) {
      if (kind === 'health') { player.health.heal(30); game.ui.toast('+30 health'); }
      else { for (const s of slots) if (Number.isFinite(s.reserve)) s.reserve += s.w.mag * 2; game.ui.toast('+ammo'); }
      game.audio.play('powerup');
      game.effects.burst(p.position, { color: kind === 'health' ? '#ff5a6a' : '#ffd84a' });
      p.destroy();
    }
  });
  game.add(p);
}

// ============================================================================ HUD / GAME OVER

function updateHud(dt) {
  const slot = slots[current];
  hpBar.set(player.health.fraction, String(Math.ceil(player.health.hp)));
  ammoText.set(reloading > 0 ? 'Reloading…' : `${slot.ammo} / ${Number.isFinite(slot.reserve) ? slot.reserve : '∞'}`);
  weaponText.set(`${current + 1} · ${slot.w.name}`);
  scoreText.set(`Score: ${state.score}`);
  waveText.set(`Wave ${state.wave} · ${game.findAll('enemy').length + state.toSpawn} left`);
  hurtFlash = Math.max(0, hurtFlash - dt);
  vignette.style.opacity = String(Math.max(hurtFlash, player.health.fraction < 0.3 ? 0.35 : 0));
}

let overMsg = null;
function gameOver() {
  state.over = true;
  game.audio.play('lose');
  if (document.pointerLockElement) document.exitPointerLock();
  for (const e of game.findAll('enemy')) e.ai.go('cheer');
  overMsg = game.ui.message('Game Over', 0, { sub: `Wave ${state.wave} · Score ${state.score} — press Enter to restart` });
}

function restart() {
  for (const tag of ['enemy', 'pickup']) game.findAll(tag).forEach((e) => e.destroy());
  [...game.entities].filter((e) => e instanceof Skeleton).forEach((e) => e.destroy()); // corpses too
  overMsg?.remove();
  cancelNextWave?.();
  player.health.reset();
  body.position.set(0, 0, 4);
  body.velocity.set(0, 0, 0);
  fps.yaw = fps.pitch = 0;
  for (const s of slots) { s.ammo = s.w.mag; s.reserve = s.w.reserve; }
  Object.assign(state, { score: 0, wave: 0, over: false });
  startWave();
}

// ============================================================================ ARENA

async function buildArena() {
  const floorUrl = '/assets/kaykit-prototype/Floor_Prototype.gltf';
  for (let x = -ARENA_HALF + 2; x < ARENA_HALF; x += 4) {
    for (let z = -ARENA_HALF + 2; z < ARENA_HALF; z += 4) {
      const tile = await game.assets.model(floorUrl);
      tile.position.set(x, -0.5, z); // tile is 0.5 thick → its top sits at y = 0 (the physics floor)
      game.scene.add(tile);
    }
  }
  // outer walls: 4-wide wall pieces around the edge, two stacked for height
  for (let i = -ARENA_HALF + 2; i < ARENA_HALF; i += 4) {
    for (const [x, z, r] of [[i, -ARENA_HALF, 0], [i, ARENA_HALF, 0], [-ARENA_HALF, i, 90], [ARENA_HALF, i, 90]]) {
      await placeProp({ m: 'wall', x, z, r });
      await placeProp({ m: 'wall', x, z, r, y: 4 });
    }
  }
  for (const item of LAYOUT) await placeProp(item);
}

async function placeProp({ m, x, z, s = 1, r = 0, y = 0 }) {
  const def = PROPS[m];
  const obj = await game.assets.model(def.url, { scale: s });
  obj.position.set(x, y + def.lift * s, z);
  obj.rotation.y = THREE.MathUtils.degToRad(r);
  game.scene.add(obj);
  game.physics.addCollider(obj);
  return obj;
}

// handy in the browser console: shooter.state, shooter.fire()
window.shooter = { state, player, slots, fire: () => fire(slots[current]), fps, game };
