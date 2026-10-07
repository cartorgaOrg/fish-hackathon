// =============================================================================
//  FISH FRENZY — cast, wait for a bite, hook it, win the reeling tug-of-war.
//
//  Controls: A/D or mouse aim · hold SPACE / left click to charge, release to cast
//            SPACE / click to hook when the bobber dives · hold to reel (watch the tension!)
//            B shop · J fish journal · Esc pause
//
//  Where to change things:
//    data.js   — CONFIG, every fish species, rods, lures (prices, rarity, strength…)
//    fish.js   — how fish swim, approach the bobber and flee
//    main.js   — the scene, the fishing state machine, reel minigame, HUD, shop, journal
//
//  The whole fishing loop is one StateMachine (search for `const fishing =`):
//    ready → charging → casting → waiting → nibbling → bite → reeling → caught → ready
// =============================================================================
import {
  THREE, Game, Animator, FollowCamera, GameMenu, TouchControls, StateMachine, setupEnvironment, setVisible, attach,
  rand, randInt, pick, clamp, damp, lerp, v3, storage,
} from '@engine';
import { CONFIG, SPECIES, RODS, LURES, RARITY_COLOR, fishUrl, rollSpecies } from './data.js';
import { Fish, randomUnderwater } from './fish.js';

const { lake } = CONFIG;
const WATER_Y = lake.water;

// ---- save game (coins, gear, journal) — survives page reloads
const save = storage.load('fishing-save', { coins: 0, rod: 1, lure: 0, journal: {} });
const persist = () => storage.save('fishing-save', save);

const game = new Game();
setupEnvironment(game, { sky: 'day', ground: false, fog: { near: 80, far: 260 }, shadowArea: 45 });

const M = {
  hero: '/assets/kaykit-adventurers/Rogue.glb',
  dock: '/assets/quaternius-fish/Dock_Long.glb',
  boat: '/assets/quaternius-fish/Boat.glb',
  trees: ['/assets/quaternius-nature/Tree1.glb', '/assets/quaternius-nature/Tree2.glb', '/assets/quaternius-nature/Tree4.glb'],
  rocks: ['/assets/quaternius-nature/Rock1.glb', '/assets/quaternius-nature/Rock2.glb', '/assets/quaternius-nature/Rock3.glb'],
  bushes: ['/assets/quaternius-nature/Bush1.glb', '/assets/quaternius-nature/Bush2.glb', '/assets/quaternius-nature/Grass2.glb'],
  rod: (lvl) => `/assets/quaternius-fish/FishingRod_Lvl${lvl}.glb`,
  lure: (lvl) => `/assets/quaternius-fish/Lure_${lvl}.glb`,
};
await game.load([
  M.hero, M.dock, M.boat, ...M.trees, ...M.rocks, ...M.bushes, M.rod(save.rod),
  ...new Set(SPECIES.filter((s) => s.rarity === 'common' || s.rarity === 'uncommon').map((s) => fishUrl(s.name))),
], 'Heading to the lake…');

// =============================================================================
//  THE LAKE — ground with a round hole, a sandy bank, a lakebed and see-through water.
// =============================================================================
const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });
{
  const shape = new THREE.Shape();
  shape.moveTo(-300, -300); shape.lineTo(300, -300); shape.lineTo(300, 300); shape.lineTo(-300, 300);
  const hole = new THREE.Path();
  hole.absarc(0, 0, lake.radius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const ground = new THREE.Mesh(new THREE.ShapeGeometry(shape, 64).rotateX(-Math.PI / 2), mat('#6aa84f'));
  ground.receiveShadow = true;
  const bankR = lake.radius - 10;
  const bank = new THREE.Mesh(new THREE.CylinderGeometry(lake.radius, bankR, lake.depth, 64, 1, true), mat('#c9b27c', { side: THREE.DoubleSide }));
  bank.position.y = -lake.depth / 2;
  const bed = new THREE.Mesh(new THREE.CircleGeometry(bankR, 64).rotateX(-Math.PI / 2), mat('#7d6e4c'));
  bed.position.y = -lake.depth;
  bank.receiveShadow = bed.receiveShadow = true;
  game.scene.add(ground, bank, bed);
}
const water = new THREE.Mesh(
  new THREE.CircleGeometry(lake.radius + 0.5, 64).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: '#1f7fbf', transparent: true, opacity: 0.55, roughness: 0.12, metalness: 0.1, depthWrite: false }),
);
water.position.y = WATER_Y;
water.userData.noPick = true;
game.scene.add(water);
const waterColor = new THREE.Color('#1f7fbf'), waterAlt = new THREE.Color('#2a9bd0');
game.onUpdate(() => water.material.color.lerpColors(waterColor, waterAlt, 0.5 + 0.5 * Math.sin(game.time * 0.6)));

// ---- dock, boat and shore decoration
const DECK_Y = 1.0;                                            // height we stand at
const dock = await game.assets.model(M.dock, { scale: CONFIG.dock.scale });
dock.position.set(0, DECK_Y - 3.83 * CONFIG.dock.scale, CONFIG.dock.z); // 3.83 = deck height of the native model
game.scene.add(dock);
const boat = await game.assets.model(M.boat, { scale: 0.7 });
boat.position.set(-14, WATER_Y - 0.3, 22);
boat.rotation.y = 0.5;
game.scene.add(boat);
game.onUpdate(() => { boat.position.y = WATER_Y - 0.35 + Math.sin(game.time * 1.3) * 0.08; boat.rotation.z = Math.sin(game.time) * 0.03; });

for (let i = 0; i < 60; i++) {
  const a = rand(0, Math.PI * 2), r = rand(lake.radius + 3, lake.radius + 35);
  if (Math.abs(a - Math.PI / 2) < 0.15 && r < lake.radius + 10) continue; // keep the path to the dock clear
  const list = i % 3 === 0 ? M.rocks : i % 3 === 1 ? M.trees : M.bushes;
  const prop = await game.assets.model(pick(list), { scale: rand(0.8, 1.6) });
  prop.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  prop.rotation.y = rand(0, 6);
  game.scene.add(prop);
}
for (let i = 0; i < 10; i++) {                                 // rocks on the lakebed
  const rock = await game.assets.model(pick(M.rocks), { scale: rand(0.6, 1.3) });
  const p = randomUnderwater(lake.radius - 12);
  rock.position.set(p.x, -lake.depth, p.z);
  game.scene.add(rock);
}

// =============================================================================
//  THE ANGLER — a KayKit Rogue holding a rod. They don't walk, they just aim.
// =============================================================================
const hero = await game.assets.model(M.hero);
setVisible(hero, { Knife_Offhand: false, '1H_Crossbow': false, '2H_Crossbow': false, Knife: false, Throwable: false });
hero.position.set(0, DECK_Y, CONFIG.dock.z - 5.5);
hero.rotation.y = Math.PI;                                     // face north, over the lake
game.scene.add(hero);
const anim = new Animator(hero);
anim.play('Idle');
game.onUpdate((dt) => anim.update(dt));

const rodHolder = new THREE.Group();                           // lets us swap rods without re-attaching
attach(hero, 'handslot.r', rodHolder);
const rodTip = new THREE.Object3D();                           // the line starts here
let rod = null;
async function equipRod(level) {
  rod?.removeFromParent();
  rod = await game.assets.model(M.rod(level), { shadows: false });
  rod.add(rodTip);
  rodTip.position.set(0, (level === 5 ? 6.9 : 4.9), 0);       // top of the rod in its own units
  rodHolder.add(rod);
  // Bones have their own rotation and scale, so instead of guessing numbers we work out the
  // rod's local transform from where we want it in the world: pointing forward and up, ~2.6 long.
  anim.update(0);
  hero.updateMatrixWorld(true);
  const boneQ = rodHolder.getWorldQuaternion(new THREE.Quaternion());
  const boneS = rodHolder.getWorldScale(v3());
  const want = v3(-0.15, 0.75, 0.65).normalize().applyQuaternion(hero.quaternion); // hero-local: up + forward
  const worldQ = new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), want);
  rod.quaternion.copy(boneQ.invert().multiply(worldQ));
  rod.scale.setScalar(0.42 / boneS.x);
}
await equipRod(save.rod);

// ---- bobber (red/white ball) + lure hanging below it + the fishing line
const bobber = new THREE.Group();
{
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e63946'));
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#f1faee'));
  bobber.add(top, bottom);
}
bobber.visible = false;
game.scene.add(bobber);
let lureModel = null;
async function equipLure(level) {
  lureModel?.removeFromParent();
  lureModel = null;
  if (level > 0) {
    lureModel = await game.assets.model(M.lure(level), { scale: 0.3, shadows: false });
    lureModel.position.y = -0.6;
    bobber.add(lureModel);
  }
}
await equipLure(save.lure);

const LINE_POINTS = 24;
const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: LINE_POINTS }, () => v3())), new THREE.LineBasicMaterial({ color: '#f5f5f5' }));
line.frustumCulled = false;
line.visible = false;
game.scene.add(line);
let lineSag = 1;
function updateLine() {
  const a = rodTip.getWorldPosition(v3()), b = bobber.position;
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= lineSag * Math.min(4, a.distanceTo(b) * 0.15);
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  line.geometry.setFromPoints(curve.getPoints(LINE_POINTS - 1));
}

// ---- camera: behind the angler, turning with the aim
const cam = game.add(new FollowCamera(game, hero, { distance: 8, pitch: 0.5, height: 2.5, orbit: false, collide: false, smoothing: 8 }));
let aim = 0;                                                   // radians, 0 = straight out over the lake
const aimDir = () => v3(Math.sin(Math.PI + aim), 0, Math.cos(Math.PI + aim));

// =============================================================================
//  AMBIENT FISH — they make the lake feel alive (and hint at what's down there)
// =============================================================================
for (let i = 0; i < CONFIG.ambientFish; i++) Fish.spawn(game, rollSpecies(0));

// ---- HUD pieces the state machine talks to
const pretty = (name) => name.replace(/([a-z])([A-Z])/g, '$1 $2');
const caughtCount = () => Object.keys(save.journal).length;

const stats = game.ui.text('', { top: 14, left: 16 }, { size: 18 });
function hud() {
  stats.set(`🪙 ${save.coins}    🎣 Rod Lv${save.rod}    🪝 ${LURES[save.lure].name}    📖 ${caughtCount()}/${SPECIES.length} species`);
}
hud();
const hintEl = game.ui.el('div', { className: 'fx-text', pos: { bottom: 70, left: '50%' } });
Object.assign(hintEl.style, { transform: 'translateX(-50%)', fontSize: '20px', textAlign: 'center' });
function hint(html) { hintEl.innerHTML = html; }
const toast = (s) => game.ui.toast(s);

const powerBar = game.ui.bar({ bottom: 110, left: '50%' }, { width: 260, height: 14, color: '#ffd166' });
powerBar.el.style.transform = 'translateX(-50%)';
powerBar.el.style.display = 'none';

// vertical tension meter with a red danger zone at the top
const tensionBar = (() => {
  const root = game.ui.el('div', { className: 'fx-bar', pos: { right: 40, top: '25%' } });
  Object.assign(root.style, { width: '26px', height: '50vh', position: 'absolute', display: 'none' });
  const danger = game.ui.el('div', { parent: root });
  Object.assign(danger.style, { position: 'absolute', top: 0, left: 0, right: 0, height: '20%', background: '#ff3b3b55' });
  const fill = game.ui.el('div', { parent: root });
  Object.assign(fill.style, { position: 'absolute', bottom: 0, left: 0, right: 0, height: '0%', background: '#6ee07a', transition: 'height .05s' });
  const label = game.ui.el('div', { parent: root, html: 'TENSION' });
  Object.assign(label.style, { position: 'absolute', top: '-22px', right: '-14px', fontSize: '11px', fontWeight: 700 });
  return {
    root,
    set(t) {
      fill.style.height = `${Math.min(1, t) * 100}%`;
      fill.style.background = t > 0.8 ? '#ff4d4d' : t > 0.55 ? '#ffd166' : '#6ee07a';
    },
  };
})();

// =============================================================================
//  THE FISHING STATE MACHINE
// =============================================================================
const rodStats = () => RODS[save.rod - 1];
const act = () => game.input.down('Space') || game.input.mouseDown(0);
const actPressed = () => game.input.pressed('Space') || game.input.mousePressed(0);
const actReleased = () => game.input.released('Space') || game.input.mouseReleased(0);

let power = 0, castFrom = v3(), castTo = v3(), fish = null, catchInfo = null;
const reel = { tension: 0, distance: 0, pull: 0, pullTimer: 0, dir: v3() };
let nibblesLeft = 0, dip = 0, biteLabel = null;

const fishing = new StateMachine({
  ready: {
    enter: () => { bobber.visible = line.visible = false; anim.play('Idle'); hint('Hold SPACE (or click) to charge a cast'); },
    update: () => { if (fishing.time > 0.3 && actPressed()) fishing.go('charging'); }, // (0.3s: ignore the key that closed a dialog)
  },
  charging: {
    enter: () => { power = 0; powerBar.el.style.display = ''; },
    update: (dt) => {
      // ping-pong 0 → 1 → 0 so you have to time your release
      const t = (fishing.time / CONFIG.chargeTime) % 2;
      power = t < 1 ? t : 2 - t;
      powerBar.set(power);
      hint(`Release to cast — ${Math.round(power * 100)}%`);
      if (!act() || actReleased()) fishing.go('casting');
    },
    exit: () => { powerBar.el.style.display = 'none'; },
  },
  casting: {
    enter: () => {
      anim.once('Throw', { then: 'Idle', speed: 1.4 });
      game.audio.play('swing');
      castFrom = rodTip.getWorldPosition(v3());
      const dist = rodStats().range * (0.3 + 0.7 * power);
      castTo = hero.position.clone().addScaledVector(aimDir(), dist).setY(WATER_Y);
      const r = Math.hypot(castTo.x, castTo.z);               // keep the bobber inside the lake
      if (r > lake.radius - 4) castTo.multiplyScalar((lake.radius - 4) / r).setY(WATER_Y);
      bobber.position.copy(castFrom);
      bobber.visible = line.visible = true;
      lineSag = 0.2;
      hint('');
    },
    update: () => {
      const t = Math.min(1, (fishing.time - 0.25) / 0.8);     // short delay so the throw anim leads
      if (t < 0) return;
      bobber.position.lerpVectors(castFrom, castTo, t);
      bobber.position.y = lerp(castFrom.y, castTo.y, t) + Math.sin(t * Math.PI) * 4;
      if (t >= 1) {
        game.audio.play('splash');
        game.effects.burst(castTo, { color: '#bfe9ff', count: 14, speed: 3, up: 4 });
        game.effects.ring(castTo, { color: '#ffffff', size: 2.5 });
        fishing.go('waiting');
      }
    },
  },
  waiting: {
    enter: () => {
      lineSag = 1;
      hint('Wait for a bite…');
      // after a while, a fish (picked by rarity + lure) swims over
      const [a, b] = CONFIG.waitTime;
      const delay = rand(a, b) / (1 + save.lure * 0.15);
      fishing.arrival = game.after(delay, async () => {
        if (!fishing.is('waiting')) return;
        const species = rollSpecies(save.lure);
        const from = castTo.clone().add(v3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(12));
        const r = Math.hypot(from.x, from.z);
        if (r > lake.radius - 8) from.multiplyScalar((lake.radius - 8) / r);
        from.y = -3;
        const f = await Fish.spawn(game, species, from);
        if (!fishing.is('waiting')) return f.flee();          // the player reeled in meanwhile
        fish = f;
        fish.approach(castTo);
      });
    },
    update: () => {
      if (actPressed()) return fishing.go('retrieve');        // reel in early
      if (fish && fish.position.distanceTo(fish.target) < 0.5) fishing.go('nibbling');
    },
    exit: () => fishing.arrival?.(),
  },
  nibbling: {
    enter: () => { nibblesLeft = randInt(...CONFIG.nibbles); fishing.nextNibble = rand(0.5, 1.2); },
    update: () => {
      if (actPressed()) { toast('Too early! It got scared.'); return lose(); }
      if (fishing.time > fishing.nextNibble) {
        dip = 0.15; game.audio.play('click', { volume: 0.4 });
        if (--nibblesLeft <= 0) return fishing.go('bite');
        fishing.nextNibble = fishing.time + rand(0.6, 1.4);
      }
    },
  },
  bite: {
    enter: () => {
      dip = 0.6;
      game.audio.play('splash', { pitch: 1.4 });
      game.effects.burst(bobber.position, { color: '#ffffff', count: 10, speed: 3 });
      biteLabel = game.ui.worldLabel(bobber, '<b style="font-size:28px;color:#ffd166">!</b>', 1.4, 'fx-label fx-nopad');
      hint('<b>SPACE / click NOW to hook it!</b>');
    },
    update: () => {
      dip = Math.max(dip, 0.4);
      if (actPressed()) return fishing.go('reeling');
      if (fishing.time > CONFIG.biteWindow) { toast('It got away…'); lose(); }
    },
    exit: () => biteLabel?.remove(),
  },
  reeling: {
    enter: () => {
      fish.hook();
      game.audio.play('hit');
      game.effects.shake(0.2);
      Object.assign(reel, { tension: 0.2, pull: 0, pullTimer: 0, distance: hero.position.distanceTo(castTo.clone().setY(DECK_Y)) });
      reel.dir = castTo.clone().sub(hero.position).setY(0).normalize();
      tensionBar.root.style.display = '';
      anim.play(['1H_Ranged_Reload', 'Interact']);
    },
    update: (dt) => {
      const s = fish.species, rod = rodStats();
      // the fish pulls in random bursts, stronger fish pull harder
      reel.pullTimer -= dt;
      if (reel.pullTimer <= 0) {
        const burst = Math.random() < 0.55;
        reel.pull = burst ? rand(0.5, 1) * s.strength : s.strength * 0.15;
        reel.pullTimer = burst ? rand(0.4, 1.1) : rand(0.5, 1.4);
        if (burst) { game.effects.burst(bobber.position, { color: '#d8f3ff', count: 5, speed: 2 }); dip = 0.3; }
      }
      const reeling = act();
      reel.tension += (reeling ? 0.5 + reel.pull * 0.9 : -0.7) * dt / rod.tension;
      reel.tension = Math.max(0, reel.tension);
      reel.distance += (reeling ? -rod.reel * (1 - reel.pull * 0.5) : reel.pull * 3) * dt;
      tensionBar.set(reel.tension);
      lineSag = 1 - Math.min(1, reel.tension);
      hint(reeling ? 'Reeling… ease off before the line snaps!' : 'Hold SPACE / click to reel in');
      if (reel.tension >= 1) { toast('💥 SNAP! The line broke.'); game.audio.play('hit', { pitch: 0.6 }); return lose(); }
      if (reel.distance > rod.range + 12) { toast('The fish swam off with the line…'); return lose(); }
      if (reel.distance < 2) return fishing.go('caught');
      // bobber + fish follow the line, wiggling side to side as the fish fights
      const side = v3(-reel.dir.z, 0, reel.dir.x).multiplyScalar(Math.sin(game.time * 2.3) * reel.pull * 2);
      castTo = hero.position.clone().setY(WATER_Y).addScaledVector(reel.dir, reel.distance).add(side);
      fish.position.set(castTo.x, -0.8, castTo.z);
      fish.object.rotation.y = Math.atan2(reel.dir.x, reel.dir.z) + Math.sin(game.time * 8) * 0.4;
    },
    exit: () => { tensionBar.root.style.display = 'none'; },
  },
  caught: {
    enter: () => {
      const s = fish.species;
      hint('');
      fish.mode = 'caught';
      fish.anim.play(['Out_Of_Water', 'Swimming_Fast']);
      fishing.jumpFrom = fish.position.clone();
      const dir = aimDir(), right = v3(-dir.z, 0, dir.x);
      fishing.jumpTo = hero.position.clone().add(v3(0, 1.2, 0)).addScaledVector(right, 1.8).addScaledVector(dir, 0.5); // beside the angler
      fishing.startScale = fish.object.scale.x;
      bobber.visible = line.visible = false;
      game.audio.play('splash');
      game.effects.burst(fish.position.clone().setY(WATER_Y), { color: '#bfe9ff', count: 25, speed: 5, up: 6 });
      anim.once('Cheer', { then: 'Idle' });
      // weigh it and log it
      const kg = +rand(...s.kg).toFixed(2);
      const avg = (s.kg[0] + s.kg[1]) / 2;
      const value = Math.max(1, Math.round(s.value * (0.6 + 0.4 * kg / avg)));
      const entry = save.journal[s.name];
      catchInfo = { s, kg, value, isNew: !entry, record: entry && kg > entry.best };
      save.journal[s.name] = { count: (entry?.count ?? 0) + 1, best: Math.max(entry?.best ?? 0, kg) };
      save.coins += value;
      persist();
      hud();
    },
    update: () => {
      const t = Math.min(1, fishing.time / 0.7);
      fish.position.lerpVectors(fishing.jumpFrom, fishing.jumpTo, t);
      fish.position.y += Math.sin(t * Math.PI) * 3;
      fish.object.rotation.z = t * Math.PI * 2;
      fish.object.scale.setScalar(fishing.startScale * (1 + t * 0.8)); // show it off like a trophy
      if (fishing.time > 0.9 && !fishing.shown) { fishing.shown = true; showCatchCard(); }
    },
    exit: () => { fishing.shown = false; },
  },
  retrieve: {   // pull the empty bobber back in
    enter: () => { fishing.from = bobber.position.clone(); hint(''); },
    update: () => {
      const t = Math.min(1, fishing.time / 0.4);
      bobber.position.lerpVectors(fishing.from, rodTip.getWorldPosition(v3()), t);
      if (t >= 1) fishing.go('ready');
    },
  },
}, 'ready');

function lose() {
  fish?.flee();
  fish = null;
  fishing.go('retrieve');
}

async function showCatchCard() {
  const { s, kg, value, isNew, record } = catchInfo;
  const color = RARITY_COLOR[s.rarity];
  game.audio.play(s.rarity === 'legendary' || s.rarity === 'epic' ? 'win' : 'coin');
  game.ui.floatingText(hero.position.clone().setY(3.5), `+${value} 🪙`, '#ffd166', { size: 30 });
  await game.ui.dialog(
    `${isNew ? '✨ NEW! ' : ''}${pretty(s.name)}`,
    `<span style="color:${color};font-weight:800;text-transform:uppercase;letter-spacing:.05em">${s.rarity}</span><br>
     ⚖️ <b>${kg} kg</b>${record ? ' — new personal record!' : ''}<br>
     🪙 <b>+${value}</b> coins`,
    ['Keep fishing'],
  );
  fish?.destroy();
  fish = null;
  Fish.spawn(game, rollSpecies(0));                           // keep the lake stocked
  fishing.go('ready');
  checkTournament(isNew);
}

game.onUpdate((dt) => {
  if (!menu.playing) return;
  // ---- aiming: keys / joystick, or the mouse when it moves
  if (fishing.is('ready') || fishing.is('charging')) {
    const mx = game.input.move().x;
    if (mx) aim -= mx * 1.4 * dt;
    else if (game.input.mouse.dx && !game.input.touch.lookMode) aim = -game.input.mouse.ndc.x * CONFIG.aimLimit;
    aim = clamp(aim, -CONFIG.aimLimit, CONFIG.aimLimit);
  }
  hero.rotation.y = Math.PI + aim;
  cam.yaw = damp(cam.yaw, aim, 6, dt);
  fishing.update(dt);

  // bobber floats on the little waves and dips when something tugs it
  dip = Math.max(0, dip - dt * 1.5);
  if (['waiting', 'nibbling', 'bite', 'reeling'].includes(fishing.state)) {
    bobber.position.set(castTo.x, WATER_Y + 0.05 + Math.sin(game.time * 2.5) * 0.05 - dip, castTo.z);
  }
  if (line.visible) updateLine();
  if (game.input.pressed('KeyB')) openShop();
  if (game.input.pressed('KeyJ')) openJournal();
});

// =============================================================================
//  SHOP & JOURNAL (both are just dialogs)
// =============================================================================
async function openShop() {
  if (!fishing.is('ready')) return toast('Finish this cast first!');
  const nextRod = RODS[save.rod], nextLure = LURES[save.lure + 1];
  const items = [];
  if (nextRod) items.push({ label: `🎣 Rod Lv${nextRod.level} — ${nextRod.cost} 🪙`, cost: nextRod.cost, buy: async () => { save.rod = nextRod.level; await equipRod(save.rod); } });
  if (nextLure) items.push({ label: `🪝 ${nextLure.name} lure — ${nextLure.cost} 🪙`, cost: nextLure.cost, buy: async () => { save.lure = nextLure.level; await equipLure(save.lure); } });
  const rod = rodStats();
  const i = await game.ui.dialog('Tackle Shop',
    `You have <b>${save.coins} 🪙</b>.<br>Better rods reel faster, cast further and hold more tension.<br>Better lures attract rarer fish, and faster.<br>
     <small>Current: Rod Lv${rod.level} (reel ${rod.reel}, range ${rod.range}) · ${LURES[save.lure].name}</small>`,
    [...items.map((it) => it.label), 'Leave']);
  const item = items[i];
  if (!item) return;
  if (save.coins < item.cost) { game.audio.play('click'); return toast(`Not enough coins (need ${item.cost - save.coins} more)`); }
  save.coins -= item.cost;
  await item.buy();
  persist();
  game.audio.play('powerup');
  toast('Purchased!');
  hud();
}

async function openJournal() {
  const rows = SPECIES.map((s) => {
    const e = save.journal[s.name];
    return e
      ? `<span style="color:${RARITY_COLOR[s.rarity]}">■</span> ${pretty(s.name)} — best ${e.best} kg (×${e.count})`
      : `<span style="opacity:.35">■ ??? (${s.rarity})</span>`;
  });
  const i = await game.ui.dialog(`Fish Journal — ${caughtCount()}/${SPECIES.length}`,
    `<span style="display:block;max-height:45vh;overflow:auto;font-size:14px;line-height:1.6">${rows.join('<br>')}</span>`,
    ['Close', 'Reset progress']);
  if (i === 1 && (await game.ui.dialog('Reset?', 'Delete all coins, gear and journal entries?', ['Keep my stuff', 'Reset'])) === 1) {
    storage.save('fishing-save', null);
    menu.restart();
  }
}

// =============================================================================
//  HUD, MENU, TOUCH
// =============================================================================

game.ui.buttons([
  { label: 'Shop', key: 'B', onClick: () => openShop() },
  { label: 'Journal', key: 'J', onClick: () => openJournal() },
], { top: 50, left: 16 });

function checkTournament(isNew) {
  if (isNew && caughtCount() === CONFIG.tournamentGoal) {
    menu.win({ title: 'Tournament Champion!', text: `You caught ${CONFIG.tournamentGoal} different species. Keep going for all ${SPECIES.length}!`, score: save.coins });
  }
}

const CONTROLS = [
  'A/D or mouse — aim', 'Hold SPACE / left click — charge, release to cast',
  'SPACE when the bobber dives — hook', 'Hold SPACE — reel (watch the tension!)', 'B — shop · J — journal · Esc — pause',
];
const menu = new GameMenu(game, {
  title: 'Fish Frenzy 🎣',
  subtitle: `Catch all ${SPECIES.length} species in the lake. Land ${CONFIG.tournamentGoal} different ones to win the tournament!`,
  controls: CONTROLS,
  touchControls: ['Stick — aim', 'Cast button — hold to charge, release to cast', 'Cast button — hook & hold to reel', 'Shop / Journal buttons'],
  accent: '#4cc9f0',
});
game.ui.controls(CONTROLS);
new TouchControls(game, {
  joystick: true,
  buttons: [{ label: '🎣 Cast', key: 'Space' }, { label: 'Shop', key: 'KeyB' }, { label: 'Journal', key: 'KeyJ' }],
});

// handy for testing in the console: fishingDebug.state, fishingDebug.save
window.fishingDebug = { fishing, save, reel, get fish() { return fish; } };

game.start();
