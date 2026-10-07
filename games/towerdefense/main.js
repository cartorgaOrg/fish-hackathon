// =============================================================================
//  TOWER DEFENSE — build towers along the road, stop 10 waves reaching your castle.
//
//  Controls: 1/2/3 pick a tower, click grass to build · click a tower to select it
//            U upgrade · X sell · right click / Esc-less cancel · N next wave now (bonus gold)
//            F fast-forward · WASD / arrows / middle-drag pan · wheel zoom · Q/E rotate
//
//  What's inside (and where to change it):
//    MAP      — the level as ASCII art (S = spawn, = road, C = castle, T/R = trees/rocks)
//    TOWERS   — cost, range, damage, fire rate and model for every tower level
//    ENEMIES  — hp, speed, bounty and model for every enemy type
//    WAVES    — what spawns in each wave
//  Enemies walk the road with the engine's PathFollower; towers pick the enemy that is
//  furthest along ("first") in range and shoot projectiles at it.
// =============================================================================
import {
  THREE, Game, Entity, Animator, Health, PathFollower, RTSCamera, GameMenu, TouchControls,
  setupEnvironment, setVisible, tint, getBounds, rand, pick, v3, distXZ,
} from '@engine';

// -----------------------------------------------------------------------------
// MAP — one character = one 4×4 tile.  (space) = grass you can build on.
// -----------------------------------------------------------------------------
const MAP = `
TTTTTTTTTTTTTTTTTTTTTT
T                    T
S=====    ========   T
T    =    =      =   T
T    =    =  T   =   T
T    =    =      =   T
T    ======   R  =   T
T                =   T
T  T   ===========   T
T      =             T
T      =========  T  T
T              =     T
T     R        ======C
TTTTTTTTTTTTTTTTTTTTTT`;

const CONFIG = {
  startGold: 150,
  lives: 20,
  firstWaveDelay: 20,      // seconds to build before wave 1
  waveDelay: 12,           // seconds between waves
  hpGrowth: 0.12,          // enemies get +12% hp per wave
  sellRefund: 0.7,
};

const RTS = '/assets/quaternius-rts/', HEX = '/assets/kaykit-hexagon/buildings/blue/', SK = '/assets/kaykit-skeletons/';
const TOWERS = {
  archer: {
    name: 'Archer', key: 'Digit1', icon: '🏹',
    cost: [50, 60, 100], range: [12, 14, 16], damage: [9, 14, 22], rate: [0.8, 0.6, 0.45],
    models: [RTS + 'WatchTower_FirstAge_Level1.glb', RTS + 'WatchTower_FirstAge_Level2.glb', RTS + 'WatchTower_FirstAge_Level3.glb'],
    scale: [6, 6, 6], projectile: 'arrow',
  },
  cannon: {
    name: 'Cannon', key: 'Digit2', icon: '💣',
    cost: [90, 110, 170], range: [10, 11, 13], damage: [28, 45, 70], rate: [2.0, 1.8, 1.5], splash: [3, 3.5, 4.5],
    models: [HEX + 'building_tower_catapult_blue.gltf', HEX + 'building_tower_catapult_blue.gltf', HEX + 'building_tower_catapult_blue.gltf'],
    scale: [2.6, 2.8, 3.0], projectile: 'ball',
  },
  frost: {
    name: 'Frost', key: 'Digit3', icon: '❄️',
    cost: [70, 80, 130], range: [9, 10, 12], damage: [4, 7, 11], rate: [1.0, 0.85, 0.7], slow: [0.55, 0.45, 0.3],
    models: [HEX + 'building_tower_A_blue.gltf', HEX + 'building_tower_B_blue.gltf', HEX + 'building_tower_B_blue.gltf'],
    scale: [2.6, 2.6, 2.9], projectile: 'frost',
  },
};

const ENEMIES = {
  minion:  { model: SK + 'Skeleton_Minion.glb',  scale: 0.9, hp: 32,   speed: 3.2, bounty: 5,   damage: 1 },
  rogue:   { model: SK + 'Skeleton_Rogue.glb',   scale: 0.9, hp: 24,   speed: 5.0, bounty: 6,   damage: 1 },
  warrior: { model: SK + 'Skeleton_Warrior.glb', scale: 1.0, hp: 100,  speed: 2.3, bounty: 12,  damage: 2, hide: ['Skeleton_Shield_Large_A', 'Skeleton_Shield_Large_B'] },
  spider:  { model: '/assets/quaternius-enemies/Spider.glb', scale: 0.32, hp: 48, speed: 4.2, bounty: 8, damage: 1 },
  wolf:    { model: '/assets/quaternius-animals/Wolf.glb',   scale: 0.45, hp: 38, speed: 6.2, bounty: 8, damage: 1 },
  king:    { model: SK + 'Skeleton_Warrior.glb', scale: 1.7, hp: 1500, speed: 1.6, bounty: 200, damage: 10, boss: true },
};

/** Each wave = groups spawned one after another: [enemy type, count, seconds between spawns]. */
const WAVES = [
  [['minion', 8, 1.0]],
  [['minion', 10, 0.8], ['rogue', 5, 0.7]],
  [['rogue', 12, 0.5]],
  [['warrior', 5, 1.5], ['minion', 10, 0.6]],
  [['spider', 14, 0.6]],
  [['wolf', 12, 0.5], ['warrior', 5, 1.2]],
  [['warrior', 10, 1.0], ['spider', 12, 0.5]],
  [['wolf', 24, 0.35]],
  [['warrior', 12, 0.8], ['rogue', 16, 0.4], ['spider', 10, 0.5]],
  [['minion', 16, 0.4], ['king', 1, 1], ['warrior', 10, 1.0], ['wolf', 15, 0.4]],
];

// -----------------------------------------------------------------------------
const game = new Game();
setupEnvironment(game, { sky: 'day', ground: { color: '#74b54f', size: 300 }, shadowArea: 60 });
const MODELS = [
  ...Object.values(TOWERS).flatMap((t) => t.models),
  ...Object.values(ENEMIES).map((e) => e.model),
  HEX + 'building_castle_blue.gltf', '/assets/kaykit-dungeon/floor_dirt_large.glb',
  '/assets/quaternius-nature/Tree1.glb', '/assets/quaternius-nature/Tree3.glb', '/assets/quaternius-nature/Rock2.glb',
  '/assets/kaykit-adventurers/arrow.gltf', '/assets/kaykit-hexagon/buildings/neutral/projectile_catapult.gltf',
];
await game.load(MODELS, 'Raising the walls…');

// ---- parse the map
const rows = MAP.replace(/^\n/, '').split('\n');
const H = rows.length, W = Math.max(...rows.map((r) => r.length));
const CELL = 4;
const at = (c, r) => (rows[r] ?? '')[c] ?? 'T';
const cellPos = (c, r) => v3((c - W / 2 + 0.5) * CELL, 0, (r - H / 2 + 0.5) * CELL);
const cellOf = (p) => ({ c: Math.floor(p.x / CELL + W / 2), r: Math.floor(p.z / CELL + H / 2) });

// ---- trace the road from S to C (each road tile has exactly one unvisited road neighbour)
const road = [];
{
  let cur = null;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (at(c, r) === 'S') cur = { c, r };
  const seen = new Set();
  while (cur) {
    road.push(cur);
    seen.add(`${cur.c},${cur.r}`);
    cur = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dc, dr]) => ({ c: cur.c + dc, r: cur.r + dr }))
      .find((n) => '=C'.includes(at(n.c, n.r)) && !seen.has(`${n.c},${n.r}`));
  }
}
const waypoints = road.map((t) => cellPos(t.c, t.r));
waypoints.unshift(waypoints[0].clone().add(v3(-CELL * 2, 0, 0))); // enemies walk in from off-map

// ---- build the scenery
const towers = new Map(); // "c,r" → Tower
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
  const ch = at(c, r), pos = cellPos(c, r);
  if (ch === '=' || ch === 'S') {
    const tile = await game.assets.model('/assets/kaykit-dungeon/floor_dirt_large.glb');
    tile.position.copy(pos).setY(0.02);
    game.scene.add(tile);
  }
  if (ch === 'T' || ch === 'R') {
    const m = await game.assets.model(ch === 'R' ? '/assets/quaternius-nature/Rock2.glb' : pick(['/assets/quaternius-nature/Tree1.glb', '/assets/quaternius-nature/Tree3.glb']), { scale: rand(0.8, 1.1) });
    m.position.copy(pos).add(v3(rand(-0.6, 0.6), 0, rand(-0.6, 0.6)));
    m.rotation.y = rand(0, 6);
    game.scene.add(m);
  }
  if (ch === 'C') {
    const castle = await game.assets.model(HEX + 'building_castle_blue.gltf', { scale: 2.6 });
    castle.position.copy(pos);
    castle.rotation.y = -Math.PI / 2;
    game.scene.add(castle);
  }
}
const isBuildable = (c, r) => at(c, r) === ' ' && !towers.has(`${c},${r}`);

// =============================================================================
//  ENEMIES
// =============================================================================
const state = { gold: CONFIG.startGold, lives: CONFIG.lives, wave: 0, spawning: false, nextWaveAt: 0, kills: 0 };

class Enemy extends Entity {
  constructor(model, def, hp) {
    super(model, { tags: ['enemy'] });
    this.def = def;
    this.anim = new Animator(model);
    this.anim.play(def.speed > 4.5 ? ['Running_A', 'Gallop', 'Walk'] : ['Walking_A', 'Walk']);
    this.follower = new PathFollower(this.object, { speed: def.speed, turnSpeed: 10 });
    this.follower.goTo(waypoints, () => this.reachCastle());
    this.position.copy(waypoints[0]);
    this.progress = 0;     // distance walked — towers target the enemy furthest along
    this.slowUntil = 0;
    this.slowFactor = 1;
    this.health = new Health(hp, {
      onDamage: () => this.bar.set(this.health.fraction),
      onDeath: () => this.die(),
    });
    this.bar = game.ui.worldBar(this.object, def.boss ? 4.5 : 2.6 * Math.max(0.6, def.scale), def.boss ? '#c040ff' : '#e33');
  }

  /** Slow down to `factor` × speed for `seconds`. */
  slow(factor, seconds) {
    this.slowFactor = Math.min(this.slowUntil > game.time ? this.slowFactor : 1, factor);
    this.slowUntil = game.time + seconds;
  }

  update(dt) {
    this.anim.update(dt);
    if (!this.is('enemy')) return; // dying
    const slowed = this.slowUntil > game.time;
    this.follower.speed = this.def.speed * (slowed ? this.slowFactor : 1);
    const before = this.position.clone();
    this.follower.update(dt);
    this.progress += before.distanceTo(this.position);
    this.anim.action && (this.anim.action.timeScale = slowed ? this.slowFactor : 1);
  }

  reachCastle() {
    state.lives = Math.max(0, state.lives - this.def.damage);
    game.audio.play('hurt');
    game.effects.shake(0.2);
    game.ui.floatingText(this.position.clone().setY(3), `-${this.def.damage} ❤`, '#ff5555');
    this.destroy();
    if (state.lives <= 0) menu.gameOver({ text: `The castle fell on wave ${state.wave}.`, score: state.kills * 10 });
  }

  die() {
    this.tags.delete('enemy');
    this.bar.remove();
    state.gold += this.def.bounty;
    state.kills++;
    game.ui.floatingText(this.position.clone().setY(2.5), `+${this.def.bounty}`, '#ffd84a', { size: 18 });
    game.audio.play('death', { volume: 0.4, pitch: rand(0.9, 1.3) });
    this.anim.once(['Death_A', 'Death']);
    game.after(1.2, () => this.destroy());
  }

  onRemoved() { this.bar.remove(); }
}

async function spawnEnemy(type) {
  const def = ENEMIES[type];
  const model = await game.assets.model(def.model, { scale: def.scale });
  if (def.hide) setVisible(model, Object.fromEntries(def.hide.map((n) => [n, false])));
  const hp = Math.round(def.hp * (1 + CONFIG.hpGrowth * state.wave));
  game.add(new Enemy(model, def, hp));
  if (def.boss) game.ui.message('👑 The Skeleton King approaches!', 3);
}

// =============================================================================
//  WAVES
// =============================================================================
async function startWave() {
  if (state.spawning || state.wave >= WAVES.length) return;
  const bonus = Math.max(0, Math.round(state.nextWaveAt - game.time));
  if (state.wave > 0 && bonus > 0) { state.gold += bonus; game.ui.toast(`⏩ Early call bonus +${bonus} gold`); }
  state.spawning = true;
  state.wave++;
  game.ui.message(`Wave ${state.wave}`, 1.5);
  game.audio.play('powerup', { pitch: 0.7 });
  for (const [type, count, every] of WAVES[state.wave - 1]) {
    for (let i = 0; i < count; i++) {
      spawnEnemy(type);
      await new Promise((resolve) => game.after(every, resolve)); // game-time wait: respects pause & fast-forward
    }
  }
  state.spawning = false;
  state.nextWaveAt = game.time + CONFIG.waveDelay;
}

game.onUpdate(() => {
  if (!menu.playing) return;
  const alive = game.findAll('enemy').length;
  if (state.wave >= WAVES.length && !state.spawning && alive === 0 && state.lives > 0) {
    menu.win({ text: `All ${WAVES.length} waves defeated with ${state.lives} lives left!`, score: state.lives * 100 + state.gold + state.kills * 10 });
  } else if (!state.spawning && state.wave < WAVES.length && game.time >= state.nextWaveAt) {
    startWave();
  }
});

// =============================================================================
//  TOWERS & PROJECTILES
// =============================================================================
class Tower extends Entity {
  constructor(type, c, r) {
    super(new THREE.Group(), { tags: ['tower'] });
    this.type = type;
    this.def = TOWERS[type];
    this.c = c; this.r = r;
    this.level = 0;
    this.spent = 0;
    this.cooldown = 0;
    this.position.copy(cellPos(c, r));
    this.stars = null;   // "★★" label, shown while selected
  }

  get range() { return this.def.range[this.level]; }

  async setLevel(level) {
    this.level = level;
    this.spent += this.def.cost[level];
    const model = await game.assets.model(this.def.models[level], { scale: this.def.scale[level] });
    if (this.type === 'cannon' && level === 2) tint(model, '#ffcc55', 0.35);
    this.object.clear();
    this.object.add(model);
    this.topY = getBounds(model).max.y - 0.5;          // projectiles leave from the top
    this.stars?.remove();
    this.stars = game.ui.worldLabel(this.object, '★'.repeat(level + 1), this.topY + 1.5);
    this.stars.el.style.visibility = selected === this ? 'visible' : 'hidden';
    game.effects.burst(this.position.clone().setY(1), { color: '#ffffff', count: 16, up: 5 });
  }

  update(dt) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    // target = enemy in range that is furthest along the road
    let target = null;
    for (const e of game.findNear(this.position, this.range, 'enemy')) if (!target || e.progress > target.progress) target = e;
    if (!target) return;
    this.cooldown = this.def.rate[this.level];
    const from = this.position.clone().setY(this.topY);
    game.add(new Projectile(this, from, target));
  }

  onRemoved() { this.stars?.remove(); }
}

/** One class for all three projectile kinds; behaviour comes from the tower's `projectile` field. */
class Projectile extends Entity {
  constructor(tower, from, target) {
    const kind = tower.def.projectile;
    super(makeProjectileMesh(kind), { tags: ['projectile'] });
    this.kind = kind;
    this.tower = tower;
    this.level = tower.level;
    this.target = target;
    this.position.copy(from);
    this.from = from.clone();
    this.t = 0;
    if (kind === 'ball') {                     // lobbed at where the enemy is now (splash hides the miss)
      this.dest = target.position.clone();
      this.flight = Math.max(0.6, from.distanceTo(this.dest) / 16);
      game.audio.play('explosion', { volume: 0.15, pitch: 2 });
    } else {
      game.audio.play(kind === 'arrow' ? 'swing' : 'laser', { volume: 0.25, pitch: kind === 'arrow' ? 2 : 1.6 });
    }
  }

  update(dt) {
    if (this.kind === 'ball') {
      this.t += dt / this.flight;
      const p = this.from.clone().lerp(this.dest, Math.min(1, this.t));
      p.y += Math.sin(Math.min(1, this.t) * Math.PI) * 6;
      this.position.copy(p);
      if (this.t >= 1) this.explode();
      return;
    }
    // homing arrow / frost bolt
    const aim = this.target.position.clone().setY(this.target.position.y + 1.2);
    const step = (this.kind === 'arrow' ? 35 : 22) * dt;
    const d = this.position.distanceTo(aim);
    if (d <= step || !this.target.is('enemy')) return this.hit();
    this.object.lookAt(aim);
    this.position.add(aim.sub(this.position).normalize().multiplyScalar(step));
  }

  hit() {
    const def = this.tower.def;
    if (this.target.is('enemy')) {
      this.target.health.damage(def.damage[this.level], this.tower);
      if (this.kind === 'frost') {
        this.target.slow(def.slow[this.level], 2);
        game.effects.burst(this.position, { color: '#9be7ff', count: 8, speed: 2 });
      }
    }
    this.destroy();
  }

  explode() {
    const def = this.tower.def;
    for (const e of game.findNear(this.dest, def.splash[this.level], 'enemy')) e.health.damage(def.damage[this.level], this.tower);
    game.effects.burst(this.dest.clone().setY(0.5), { color: '#ffaa33', count: 18, speed: 6 });
    game.effects.ring(this.dest, { color: '#ffaa33', size: def.splash[this.level] });
    game.effects.shake(0.08);
    this.destroy();
  }
}

function makeProjectileMesh(kind) {
  if (kind === 'ball') return new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: '#222' }));
  if (kind === 'frost') return new THREE.Mesh(new THREE.IcosahedronGeometry(0.3), new THREE.MeshBasicMaterial({ color: '#9be7ff' }));
  const g = new THREE.Group();                 // arrow: a thin stick pointing along +Z (lookAt aims +Z)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), new THREE.MeshBasicMaterial({ color: '#8b5a2b' }));
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);
  return g;
}

// =============================================================================
//  BUILDING, SELECTING, UPGRADING — mouse/tap on the grid
// =============================================================================
let placing = null;     // tower type being placed
let selected = null;    // selected Tower

const highlight = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.95, CELL * 0.95).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
highlight.position.y = 0.06;
const rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }));
rangeRing.position.y = 0.08;
game.scene.add(highlight, rangeRing);

function choose(type) {
  placing = placing === type ? null : type;
  select(null);
  game.audio.play('click');
}

function select(tower) {
  selected = tower;
  for (const t of towers.values()) if (t.stars) t.stars.el.style.visibility = t === tower ? 'visible' : 'hidden';
  refreshButtons();
}

async function build(type, c, r) {
  const cost = TOWERS[type].cost[0];
  if (state.gold < cost) { game.ui.toast('Not enough gold'); game.audio.play('click'); return; }
  state.gold -= cost;
  const tower = game.add(new Tower(type, c, r));
  towers.set(`${c},${r}`, tower);
  await tower.setLevel(0);
  game.audio.play('build');
}

async function upgrade() {
  if (!selected || selected.level >= 2) return;
  const cost = selected.def.cost[selected.level + 1];
  if (state.gold < cost) { game.ui.toast('Not enough gold'); return; }
  state.gold -= cost;
  await selected.setLevel(selected.level + 1);
  game.audio.play('powerup');
  refreshButtons();
}

function sell() {
  if (!selected) return;
  const refund = Math.round(selected.spent * CONFIG.sellRefund);
  state.gold += refund;
  game.ui.floatingText(selected.position.clone().setY(3), `+${refund}`, '#ffd84a');
  towers.delete(`${selected.c},${selected.r}`);
  selected.destroy();
  game.audio.play('coin');
  select(null);
}

game.onUpdate(() => {
  const { input } = game;
  // hotkeys
  for (const [type, def] of Object.entries(TOWERS)) if (input.pressed(def.key)) choose(type);
  if (input.pressed('KeyU')) upgrade();
  if (input.pressed('KeyX')) sell();
  if (input.pressed('KeyN')) startWave();
  if (input.pressed('KeyF')) toggleSpeed();
  if (input.mousePressed(2)) { placing = null; select(null); }

  // hover + click on the grid
  const p = game.mouseGround();
  const cell = p && cellOf(p);
  const hoveredTower = cell && towers.get(`${cell.c},${cell.r}`);
  highlight.visible = !!cell && at(cell.c, cell.r) !== 'T';
  if (cell) {
    highlight.position.set(cellPos(cell.c, cell.r).x, 0.06, cellPos(cell.c, cell.r).z);
    const ok = placing ? isBuildable(cell.c, cell.r) && state.gold >= TOWERS[placing].cost[0] : !!hoveredTower;
    highlight.material.color.set(placing ? (ok ? '#7dff8a' : '#ff5555') : hoveredTower ? '#ffffff' : '#000000');
    highlight.material.opacity = placing || hoveredTower ? 0.35 : 0.08;
  }
  // range ring: for the tower being placed, else the selected tower
  const ringFor = placing && cell ? { pos: cellPos(cell.c, cell.r), range: TOWERS[placing].range[0] } : selected ? { pos: selected.position, range: selected.range } : null;
  rangeRing.visible = !!ringFor;
  if (ringFor) { rangeRing.position.set(ringFor.pos.x, 0.08, ringFor.pos.z); rangeRing.scale.setScalar(ringFor.range); }

  if (input.mousePressed(0) && cell && menu.playing) {
    if (placing && isBuildable(cell.c, cell.r)) build(placing, cell.c, cell.r);
    else if (hoveredTower) { placing = null; select(hoveredTower); }
    else select(null);
  }
});

// =============================================================================
//  CAMERA, HUD, MENUS, TOUCH
// =============================================================================
const camera = game.add(new RTSCamera(game, { zoom: 62, minZoom: 20, maxZoom: 85, pitch: 1.0, bounds: 40, edgePan: false }));
camera.focus(v3(2, 0, 3));

function toggleSpeed() {
  game.timeScale = game.timeScale === 1 ? 2 : 1;
  refreshButtons();
}

const hud = game.ui.text('', { top: 14, left: 16 }, { size: 22 });
const buildBar = game.ui.buttons([], { bottom: 16, right: 16 });
const towerPanel = game.ui.buttons([], { bottom: 76, right: 16 });

function refreshButtons() {
  buildBar.update([
    ...Object.entries(TOWERS).map(([type, def], i) => ({
      key: String(i + 1), label: `${def.icon} ${def.name} ${def.cost[0]}g${placing === type ? ' ✓' : ''}`,
      disabled: state.gold < def.cost[0], onClick: () => choose(type),
    })),
    { key: 'N', label: state.spawning ? 'Wave in progress' : '⚔️ Next wave', disabled: state.spawning || state.wave >= WAVES.length, onClick: startWave },
    { key: 'F', label: game.timeScale === 2 ? '⏩ 2×' : '▶ 1×', onClick: toggleSpeed },
  ]);
  towerPanel.update(selected ? [
    { label: `${selected.def.icon} ${selected.def.name} ${'★'.repeat(selected.level + 1)}`, disabled: true },
    selected.level < 2
      ? { key: 'U', label: `Upgrade ${selected.def.cost[selected.level + 1]}g`, disabled: state.gold < selected.def.cost[selected.level + 1], onClick: upgrade }
      : { label: 'Max level', disabled: true },
    { key: 'X', label: `Sell +${Math.round(selected.spent * CONFIG.sellRefund)}g`, onClick: sell },
  ] : []);
}

let lastGold = -1, lastSpawning = null;
game.onUpdate(() => {
  const wait = Math.max(0, Math.ceil(state.nextWaveAt - game.time));
  const next = !state.spawning && state.wave < WAVES.length ? `   ⏱ next wave in ${wait}s` : '';
  hud.set(`❤ ${state.lives}   🪙 ${state.gold}   🌊 Wave ${state.wave}/${WAVES.length}${next}`);
  if (state.gold !== lastGold || state.spawning !== lastSpawning) { lastGold = state.gold; lastSpawning = state.spawning; refreshButtons(); }
});

const CONTROLS = [
  '1 / 2 / 3 — pick a tower, click grass to build',
  'Click a tower — select · U upgrade · X sell',
  'Right click — cancel · N — next wave (bonus gold) · F — 2× speed',
  'WASD / arrows / middle-drag — pan · Wheel — zoom · Q/E — rotate',
];
game.ui.controls(CONTROLS);
const menu = new GameMenu(game, {
  title: 'Castle Defense',
  subtitle: `Hold the road for ${WAVES.length} waves. Archers shoot fast, cannons splash, frost towers slow.`,
  controls: CONTROLS,
  touchControls: ['Tap a tower button, then tap grass to build', 'Tap a tower to upgrade or sell', 'Stick — pan · +/− — zoom'],
  accent: '#7fc8ff',
  onStart: () => { state.nextWaveAt = game.time + CONFIG.firstWaveDelay; game.ui.toast(`First wave in ${CONFIG.firstWaveDelay}s — build some towers!`, 4); },
});
new TouchControls(game, { joystick: true, buttons: [{ label: '+', wheel: -1 }, { label: '−', wheel: 1 }] });
state.nextWaveAt = Infinity; // set when Play is pressed
window.td = { state, startWave, spawnEnemy, TOWERS, ENEMIES }; // poke at it from the browser console
refreshButtons();

game.start();
