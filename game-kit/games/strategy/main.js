// =============================================================================
//  STRATEGY — a tiny Age-of-Empires. Gather, build, train, survive the raids.
//
//  Controls
//    Left click / drag ........ select units or a building (Shift = add to selection)
//    Right click .............. move · gather (tree / gold / farm) · build (site) · attack (enemy)
//                               with only a building selected: set its rally point
//    1 / 2 / 3 ................ place House / Farm / Barracks (villager selected)
//    V / K .................... train Villager (Town Center) / Knight (Barracks)
//    WASD · edges · wheel · Q/E  move / zoom / rotate the camera
//
//  How to change things
//    • All numbers (costs, HP, speeds, raid timing, map size) live in data.js
//    • New building? add an entry to BUILDINGS (data.js) + a button key — that's it
//    • Unit behaviour (gather / build / attack) lives in units.js
//    • Buildings, training queues and resource nodes live in buildings.js
//    • Map layout (forests, gold, start position) is in buildMap() below
// =============================================================================
import { Game, RTSCamera, Selection, NavGrid, GameMenu, TouchControls, setupEnvironment, THREE, rand, v3 } from '@engine';
import { CONFIG, RESOURCES, UNITS, BUILDINGS, ALL_MODELS } from './data.js';
import { world, canAfford, pay, costText, teamOf, population } from './world.js';
import { spawnUnit } from './units.js';
import { spawnBuilding, spawnNode } from './buildings.js';

const game = new Game();
world.game = game;
world.stock = { ...CONFIG.startStock };
window.world = world; // poke at it from the browser console
world.population = population;

setupEnvironment(game, { sky: 'day', ground: { size: 400, color: '#86b85c' }, fog: { near: 90, far: 260 }, shadowArea: 45 });
world.nav = new NavGrid({ size: CONFIG.mapSize + 10, cellSize: 1 });
await game.load(ALL_MODELS, 'Founding your village…');

const camera = game.add(new RTSCamera(game, { bounds: CONFIG.mapSize / 2, zoom: 32 }));
camera.focus(v3(0, 0, 8));

// ----------------------------------------------------------------------------- map
const HALF = CONFIG.mapSize / 2;
async function buildMap() {
  spawnBuilding('townCenter', 'player', { x: 0, z: 0 }, true);
  for (let i = 0; i < 3; i++) await spawnUnit('villager', 'player', { x: -2 + i * 2, z: 6 });
  await spawnUnit('knight', 'player', { x: 4, z: 5 });

  const tryNode = (kind, x, z) => {
    if (Math.hypot(x, z) < 11 || Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2) return;
    if (!world.nav.isFree({ x, z })) return;
    return spawnNode(kind, { x, z });
  };
  // forests: clumps of trees
  for (const [cx, cz] of [[-24, -14], [22, 18], [-18, 26], [28, -26], [0, -32], [-34, 6]]) {
    for (let i = 0; i < 16; i++) await tryNode('tree', cx + rand(-6, 6), cz + rand(-6, 6));
  }
  for (let i = 0; i < 20; i++) await tryNode('tree', rand(-HALF, HALF), rand(-HALF, HALF));
  for (const [x, z] of [[15, -12], [-14, 13], [31, 4], [-30, -30]]) await tryNode('gold', x, z);

  // scenery outside the playable area
  for (let a = 0; a < Math.PI * 2; a += 0.35) {
    const m = await game.assets.model('/assets/quaternius-rts/Mountain_Group_1.glb', { scale: rand(9, 14) });
    m.position.set(Math.cos(a) * (HALF + 18), 0, Math.sin(a) * (HALF + 18));
    m.rotation.y = rand(0, 6);
    game.scene.add(m);
  }
}
await buildMap();

// ----------------------------------------------------------------------------- selection
const selection = game.add(new Selection(game, {
  filter: (e) => e.team === 'player' && !e.health?.dead && (e.is('unit') || e.is('building')),
}));
world.selection = selection;
let fixing = false;
selection.onChange = (list) => {
  // dragging over units and buildings: keep only the units
  if (!fixing && list.length > 1 && list.some((e) => e.is('unit')) && list.some((e) => e.is('building'))) {
    fixing = true;
    selection.set(list.filter((e) => e.is('unit')));
    fixing = false;
  }
  refreshButtons();
};
const selected = () => [...selection.selected].filter((e) => e.alive && !e.health.dead);
const selectedUnits = () => selected().filter((e) => e.is('unit'));

// ----------------------------------------------------------------------------- right-click orders
function issueOrders() {
  const units = selectedUnits();
  const ground = game.mouseGround();
  const clickable = [...teamOf('enemy'), ...game.findAll('resource'), ...teamOf('player', 'building').filter((b) => !b.built)];
  const target = game.pickEntity(clickable);

  if (!units.length) {
    // only a building selected → rally point for newly trained units
    const b = selected().find((e) => e.is('building'));
    if (b && ground) { b.rally = ground; game.effects.ring(ground, { color: '#5ab0ff' }); }
    return;
  }
  if (target?.team === 'enemy') {
    units.forEach((u) => u.command({ type: 'attack', target }));
    game.effects.ring(target.position, { color: '#ff4d4d' });
  } else if (target && !target.built && target.is('building')) {
    units.forEach((u) => (u.def.canBuild ? u.command({ type: 'build', target }) : u.moveTo(target.position)));
    game.effects.ring(target.position, { color: '#ffd84a', size: 3 });
  } else if (target?.is('resource')) {
    units.forEach((u) => (u.def.canGather ? u.command({ type: 'gather', target }) : u.moveTo(target.position)));
    game.effects.ring(target.position, { color: RESOURCES[target.gives].color });
  } else if (ground) {
    // spread the group out in a little grid around the click
    const cols = Math.ceil(Math.sqrt(units.length));
    units.forEach((u, i) => {
      const off = v3((i % cols) - (cols - 1) / 2, 0, Math.floor(i / cols) - (cols - 1) / 2).multiplyScalar(1.3);
      u.moveTo(ground.clone().add(off));
    });
    game.effects.ring(ground, { color: '#4dff88' });
  }
  game.audio.play('click');
}

// ----------------------------------------------------------------------------- build placement
let placing = null; // { type, ghost, ok }
const ghostMat = new THREE.MeshBasicMaterial({ color: '#4dff88', transparent: true, opacity: 0.45, depthWrite: false });

async function startPlacing(type) {
  cancelPlacing();
  const def = BUILDINGS[type];
  if (!canAfford(def.cost)) { game.ui.toast(`Need ${costText(def.cost)}`); return; }
  const ghost = await game.assets.model(def.model, { scale: def.scale, shadows: false });
  ghost.traverse((o) => { if (o.isMesh) { o.material = ghostMat; o.userData.noPick = true; } });
  game.scene.add(ghost);
  placing = { type, ghost, ok: false };
}
function cancelPlacing() {
  placing?.ghost.removeFromParent();
  placing = null;
}
function footprintFree(x, z, size) {
  const h = size / 2;
  if (Math.abs(x) + h > HALF || Math.abs(z) + h > HALF) return false;
  for (let cz = z - h + 0.5; cz < z + h; cz++) for (let cx = x - h + 0.5; cx < x + h; cx++) {
    if (!world.nav.isFree({ x: cx, z: cz })) return false;
  }
  // walkable buildings (farms) don't block the nav grid, so check them separately
  const box = new THREE.Box3(v3(x - h + 0.1, 0, z - h + 0.1), v3(x + h - 0.1, 1, z + h - 0.1));
  return !teamOf('player', 'building').some((b) => b.footprint().intersectsBox(box));
}
function updatePlacing() {
  const p = game.mouseGround();
  if (!p) return;
  const def = BUILDINGS[placing.type];
  const x = Math.round(p.x), z = Math.round(p.z);
  placing.ghost.position.set(x, 0.02, z);
  placing.ok = canAfford(def.cost) && footprintFree(x, z, def.size);
  ghostMat.color.set(placing.ok ? '#4dff88' : '#ff4d4d');
  if (game.input.mousePressed(0) && placing.ok) {
    pay(def.cost);
    const site = spawnBuilding(placing.type, 'player', { x, z });
    selectedUnits().filter((u) => u.def.canBuild).forEach((u) => u.command({ type: 'build', target: site }));
    game.audio.play('build');
    if (!game.input.anyDown('ShiftLeft', 'ShiftRight')) cancelPlacing(); // Shift = place several
  }
  if (game.input.mousePressed(2) || game.input.pressed('Escape')) cancelPlacing();
}

// ----------------------------------------------------------------------------- HUD
const topBar = game.ui.el('div', { className: 'fx-panel', pos: { top: 36, left: '50%' } });
topBar.style.transform = 'translateX(-50%)';
topBar.style.fontSize = '18px';
const info = game.ui.el('div', { className: 'fx-panel', pos: { bottom: 16, left: '50%' } });
info.style.transform = 'translateX(-50%)';
info.style.minWidth = '260px';
let buttons = null, actions = [], lastSignature = '';
let nextRaidAt = CONFIG.firstRaidAt;

/** Which buttons to show for the current selection. Each has a hotkey `code`. */
function currentActions() {
  const sel = selected();
  const list = [];
  if (sel.some((e) => e.def.canBuild)) {
    for (const [type, def] of Object.entries(BUILDINGS)) {
      if (!def.key) continue;
      list.push({ code: def.key, key: def.key.slice(-1), label: `${def.name} ${costText(def.cost)}`, disabled: !canAfford(def.cost), onClick: () => startPlacing(type) });
    }
  }
  const b = sel.length === 1 && sel[0].is('building') && sel[0].built ? sel[0] : null;
  for (const type of b?.def.trains ?? []) {
    const def = UNITS[type];
    const code = 'Key' + def.name[0].toUpperCase();
    list.push({ code, key: def.name[0], label: `Train ${def.name} ${costText(def.cost)}`, disabled: !canAfford(def.cost),
      onClick: () => { const err = b.train(type); if (err) game.ui.toast(err); else game.audio.play('click'); refreshButtons(); } });
  }
  return list;
}
function refreshButtons() {
  actions = currentActions();
  const sig = actions.map((a) => a.label + a.disabled).join('|');
  if (sig === lastSignature) return; // only rebuild the DOM when something changed (keeps clicks reliable)
  lastSignature = sig;
  buttons?.remove();
  // on phones the bottom-right corner belongs to the touch buttons, so stack these top-right instead
  const touch = TouchControls.enabled;
  buttons = actions.length ? game.ui.buttons(actions, touch ? { top: 64, right: 12 } : { bottom: 16, right: 16 }, { vertical: touch }) : null;
}

function updateHud() {
  const s = world.stock, pop = population();
  const raid = world.wave >= CONFIG.wavesToWin ? 'Last raid!' : `Raid ${world.wave + 1}/${CONFIG.wavesToWin} in ${Math.max(0, Math.ceil(nextRaidAt - game.time))}s`;
  topBar.innerHTML = Object.entries(RESOURCES).map(([k, r]) => `${r.icon} ${Math.floor(s[k])}`).join(' &nbsp; ') +
    ` &nbsp; 👥 ${pop.used}/${pop.cap} &nbsp; <span style="color:#ff8a7a">⚔️ ${raid}</span>`;

  const sel = selected();
  if (!sel.length) { info.innerHTML = '<span class="fx-dim">Nothing selected — left-click or drag over your units</span>'; return; }
  if (sel.length > 1) {
    const counts = {};
    sel.forEach((e) => (counts[e.name] = (counts[e.name] ?? 0) + 1));
    info.innerHTML = `<b>${sel.length} selected</b><br>` + Object.entries(counts).map(([n, c]) => `${c} × ${n}`).join('<br>');
    return;
  }
  const e = sel[0];
  let html = `<b>${e.name}</b> &nbsp; ❤ ${Math.ceil(e.health.hp)}/${e.health.max}`;
  if (e.is('unit')) {
    html += `<br><span class="fx-dim">${e.order ? e.order.type : 'idle'}</span>`;
    if (e.carry?.amount) html += ` · carrying ${e.carry.amount}${RESOURCES[e.carry.kind].icon}`;
  } else if (!e.built) {
    html += `<br>🔨 under construction ${Math.floor((e.progress / e.def.buildTime) * 100)}% — right-click it with villagers`;
  } else if (e.queue.length) {
    const job = e.queue[0];
    html += `<br>Training ${UNITS[job.type].name}: ${Math.floor((job.time / UNITS[job.type].trainTime) * 100)}%` + (e.queue.length > 1 ? ` (+${e.queue.length - 1} queued)` : '');
  }
  info.innerHTML = html;
}

const CONTROLS = [
  'Left click / drag — select', 'Right click — move · gather · build · attack',
  '1 2 3 — build (villager selected) · V / K — train', 'WASD / edges — pan · wheel — zoom · Q/E — rotate', 'Esc — pause',
];
game.ui.controls(CONTROLS);

// ----------------------------------------------------------------------------- raids
async function raid() {
  if (world.over) return;
  world.wave++;
  const angle = rand(0, Math.PI * 2);
  const origin = v3(Math.cos(angle) * (HALF - 3), 0, Math.sin(angle) * (HALF - 3));
  const dir = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? (Math.cos(angle) > 0 ? 'east' : 'west') : (Math.sin(angle) > 0 ? 'south' : 'north');
  game.ui.message(`⚔️ Raid ${world.wave}!`, 2.5, { sub: `Skeletons attack from the ${dir}` });
  game.audio.play('lose', { volume: 0.4 });
  for (let i = 0; i < CONFIG.raidSize(world.wave); i++) {
    const spot = world.nav.nearestFree(origin.clone().add(v3(rand(-4, 4), 0, rand(-4, 4)))) ?? origin;
    await spawnUnit(i % 3 === 2 ? 'raider' : 'raiderMinion', 'enemy', spot);
  }
  if (world.wave < CONFIG.wavesToWin) {
    nextRaidAt = game.time + CONFIG.raidInterval;
    game.after(CONFIG.raidInterval, raid);
  }
}
game.after(CONFIG.firstRaidAt, raid);
world.raid = raid; // type `world.raid()` in the browser console to test a raid right now

function checkEnd() {
  if (world.over) return;
  if (!game.find('townCenter')) {
    world.over = true;
    menu.gameOver({ title: 'Defeat 💀', text: `Your Town Center has fallen during raid ${world.wave}.` });
  } else if (world.wave >= CONFIG.wavesToWin && !teamOf('enemy').length) {
    world.over = true;
    // score: everything you still own (resources + 50 per unit)
    const score = Math.floor(Object.values(world.stock).reduce((a, b) => a + b, 0)) + population().used * 50;
    menu.win({ title: 'Victory! 🏰', text: `You survived ${CONFIG.wavesToWin} raids.`, score });
  }
}

// ----------------------------------------------------------------------------- main loop
game.every(0.25, () => { refreshButtons(); checkEnd(); });
game.onUpdate(() => {
  const { input } = game;
  if (placing) updatePlacing();
  else if (input.mousePressed(2)) issueOrders();
  for (const a of actions) if (input.pressed(a.code) && !a.disabled) a.onClick();
  selection.enabled = !placing; // left clicks place buildings instead of selecting
  updateHud();
});

// ----------------------------------------------------------------------------- menus + touch
// The game is paused until Play, so the raid timers (game.time based) only start counting then.
const menu = new GameMenu(game, {
  onPause: () => cancelPlacing(), // Esc pauses — don't leave a ghost building hanging around
  title: 'Tiny Empires',
  subtitle: `Gather, build, train — and survive ${CONFIG.wavesToWin} skeleton raids.`,
  controls: CONTROLS,
  touchControls: [
    'Tap / drag — select units', 'Order, then tap — move · gather · build · attack',
    'Stick — pan camera · + / − — zoom', 'Build & train with the buttons at the bottom right',
  ],
});
new TouchControls(game, {
  joystick: true,          // pans the RTS camera (it reads input.move())
  look: false,             // taps must select units, not rotate the camera
  buttons: [
    { label: 'Order', tapAs: 2 },   // next tap on the map = right-click command
    { label: '+', wheel: -1 },
    { label: '−', wheel: 1 },
  ],
});

game.start();
