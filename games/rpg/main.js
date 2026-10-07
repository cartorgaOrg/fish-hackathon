// =============================================================================
//  ACTION RPG — third-person hack & slash with a tiny quest line.
//
//  Controls: WASD move · Space jump · Shift sprint · Left click / F attack
//            E talk / open chests · 1 drink potion · right-drag orbit · wheel zoom
//
//  What's inside (and where to change it):
//    CONFIG          — player stats, spawn rates, levelling curve
//    WORLD           — every prop placed in the world (plain data, edit freely)
//    Hero            — the player: CharacterController + combat + XP
//    enemy.js        — Skeleton AI (StateMachine) and ENEMY_TYPES stats
//    QUEST           — talk to the wizard → kill skeletons → beat the Skeleton King
// =============================================================================
import {
  THREE, Game, Entity, Animator, CharacterController, FollowCamera, Health, GameMenu, TouchControls, setupEnvironment, setVisible,
  distXZ, rand, randInt, pick, v3, cooldown,
} from '@engine';
import { Skeleton, ENEMY_TYPES } from './enemy.js';

const CONFIG = {
  hero: { hp: 100, damage: 15, speed: 6, attackRange: 2.6, attackArc: 0.35 /* cos of half-angle */ },
  levelUp: { xpBase: 50, xpGrowth: 1.5, hpPerLevel: 20, damagePerLevel: 5 },
  spawn: { every: 4, maxAlive: 7, area: { x: 0, z: -38, radius: 14 }, types: ['minion', 'minion', 'warrior', 'rogue'] },
  quest: { killsNeeded: 6 },
  potionHeal: 40,
};

const M = {
  hero: '/assets/kaykit-adventurers/Knight.glb',
  wizard: '/assets/kaykit-adventurers/Mage.glb',
  coin: '/assets/kaykit-dungeon/coin_stack_small.glb',
  potion: '/assets/kaykit-dungeon/bottle_A_green.glb',
  chest: '/assets/kaykit-dungeon/chest.glb',
  wall: '/assets/kaykit-dungeon/wall.glb',
  wallBroken: '/assets/kaykit-dungeon/wall_broken.glb',
  pillar: '/assets/kaykit-dungeon/pillar.glb',
  torch: '/assets/kaykit-dungeon/torch_lit.glb',
  barrel: '/assets/kaykit-dungeon/barrel_large.glb',
  crates: '/assets/kaykit-dungeon/crates_stacked.glb',
  keg: '/assets/kaykit-dungeon/keg_decorated.glb',
  rubble: '/assets/kaykit-dungeon/rubble_large.glb',
  floor: '/assets/kaykit-dungeon/floor_dirt_large.glb',
  tree: '/assets/quaternius-nature/Tree2.glb',
  pine: '/assets/quaternius-nature/Tree3.glb',
  rock: '/assets/quaternius-nature/Rock2.glb',
  bush: '/assets/quaternius-nature/Bush1.glb',
};

// -----------------------------------------------------------------------------
// WORLD — [model, x, z, rotationY (degrees), solid?]. The village is around (0,0),
// the haunted ruins (skeleton spawn) are north, around z = -38.
// -----------------------------------------------------------------------------
const WORLD = [
  // village props
  ['barrel', 9, 5, 0, true], ['barrel', 10.5, 7, 40, true], ['crates', -9, 6, 15, true],
  ['torch', 4, -4, 0, false], ['torch', -4, -4, 0, false], ['keg', 8, -2, 30, true],
  // ruined walls around the graveyard (north)
  ['wall', -16, -24, 0, true], ['wallBroken', -12, -24, 0, true], ['wall', 12, -24, 0, true], ['wallBroken', 16, -24, 0, true],
  ['pillar', -8, -24, 0, true], ['pillar', 8, -24, 0, true],
  ['wall', -20, -30, 90, true], ['wall', -20, -38, 90, true], ['wallBroken', -20, -46, 90, true],
  ['wall', 20, -30, 90, true], ['wallBroken', 20, -38, 90, true], ['wall', 20, -46, 90, true],
  ['wall', -12, -52, 0, true], ['wall', -4, -52, 0, true], ['wall', 4, -52, 0, true], ['wall', 12, -52, 0, true],
  ['rubble', -6, -30, 0, false], ['rubble', 9, -42, 60, false], ['torch', -8, -26, 0, false], ['torch', 8, -26, 0, false],
  ['floor', -4, -36, 0, false], ['floor', 0, -36, 0, false], ['floor', 4, -36, 0, false], ['floor', 0, -40, 0, false],
];

// -----------------------------------------------------------------------------
const game = new Game();
setupEnvironment(game, { sky: 'day', ground: { color: '#6a9a4a' } });
const CONTROLS = ['WASD — move · Space — jump · Shift — sprint', 'Left click / F — attack', 'E — talk / open · 1 — potion', 'Right-drag — orbit · Wheel — zoom', 'Esc — pause'];
game.ui.controls(CONTROLS);
await game.load([...Object.values(M), ...new Set(Object.values(ENEMY_TYPES).map((t) => t.model))], 'Entering the realm…');

// ---- world props
for (const [key, x, z, rotY, solid] of WORLD) {
  const obj = await game.assets.model(M[key]);
  obj.position.set(x, 0, z);
  obj.rotation.y = (rotY * Math.PI) / 180;
  game.scene.add(obj);
  if (solid) game.physics.addCollider(obj);
  if (key === 'torch') { // a little point light makes torches glow
    const light = new THREE.PointLight('#ff9a3c', 12, 10);
    light.position.set(x, 2.2, z);
    game.scene.add(light);
  }
}
// forest ring around the playable area (also blocks you from walking off forever)
for (let i = 0; i < 70; i++) {
  const a = (i / 70) * Math.PI * 2, r = rand(48, 60);
  const tree = await game.assets.model(pick([M.tree, M.pine, M.pine, M.rock]), { scale: rand(1.2, 2) });
  tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 10);
  tree.rotation.y = rand(0, 6);
  game.scene.add(tree);
}
const bounds = 46; // invisible walls
game.physics.addBox([0, 5, -10 - bounds], [bounds * 2, 10, 1]);
game.physics.addBox([0, 5, -10 + bounds], [bounds * 2, 10, 1]);
game.physics.addBox([-bounds, 5, -10], [1, 10, bounds * 2]);
game.physics.addBox([bounds, 5, -10], [1, 10, bounds * 2]);
for (let i = 0; i < 25; i++) {
  const bush = await game.assets.model(M.bush, { scale: rand(0.6, 1.1) });
  bush.position.set(rand(-40, 40), 0, rand(-50, 30));
  if (distXZ(bush.position, v3()) > 8) game.scene.add(bush);
}

// =============================================================================
//  HERO — the stock CharacterController + sword combat, HP, XP and inventory.
// =============================================================================
class Hero extends CharacterController {
  constructor(model) {
    super(game, model, { speed: CONFIG.hero.speed, radius: 0.5, height: 2.2, jumpSpeed: 9 });
    this.level = 1; this.xp = 0; this.gold = 0; this.potions = 1;
    this.damage = CONFIG.hero.damage;
    this.dead = false;
    this.attackCd = cooldown(0.55);
    this.combo = 0;
    this.health = new Health(CONFIG.hero.hp, {
      invulnerableTime: 0.5,
      onDamage: () => {
        game.audio.play('hurt');
        game.effects.flash(this.model, { color: '#ff2020' });
        game.effects.shake(0.25);
        if (!this.attacking) this.animator.once('Hit_A', { fade: 0.05 });
      },
      onDeath: () => this.die(),
    });
  }

  hurt(amount, source) { this.health.damage(amount, source); hud(); }

  attack() {
    if (this.dead || !this.attackCd.ready()) return;
    this.attacking = true;
    this.locked = true;                               // stand still while swinging
    const swing = ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Chop'][this.combo++ % 3];
    this.animator.once(swing, { speed: 1.6, onEnd: () => { this.attacking = false; this.locked = false; } });
    game.audio.play('swing');
    // the hit lands a moment into the animation
    game.after(0.18, () => {
      const forward = v3(Math.sin(this.rotation.y), 0, Math.cos(this.rotation.y));
      for (const enemy of game.findNear(this.position, CONFIG.hero.attackRange * 1.5, 'enemy')) {
        const to = enemy.position.clone().sub(this.position).setY(0);
        const reach = CONFIG.hero.attackRange * enemy.def.scale;
        if (to.length() > reach || to.normalize().dot(forward) < CONFIG.hero.attackArc) continue;
        const crit = Math.random() < 0.15;
        enemy.health.damage(crit ? this.damage * 2 : this.damage, this);
        enemy.body.velocity.addScaledVector(forward, 8);        // knockback
        game.effects.burst(enemy.position.clone().setY(1.4), { color: crit ? '#ffcc00' : '#dddddd', count: crit ? 20 : 10 });
        game.audio.play('hit');
        game.effects.shake(crit ? 0.3 : 0.12);
      }
    });
  }

  gainXp(amount) {
    this.xp += amount;
    let needed = xpForLevel(this.level);
    while (this.xp >= needed) {
      this.xp -= needed;
      this.level++;
      this.health.reset(this.health.max + CONFIG.levelUp.hpPerLevel);
      this.damage += CONFIG.levelUp.damagePerLevel;
      game.audio.play('powerup');
      game.ui.message(`Level ${this.level}!`, 1.5, { sub: `+${CONFIG.levelUp.hpPerLevel} max HP · +${CONFIG.levelUp.damagePerLevel} damage` });
      game.effects.burst(this.position.clone().setY(1), { color: '#7fd4ff', count: 40, up: 6 });
      needed = xpForLevel(this.level);
    }
    hud();
  }

  drinkPotion() {
    if (this.potions <= 0 || this.dead || this.health.hp === this.health.max) return;
    this.potions--;
    this.health.heal(CONFIG.potionHeal);
    this.animator.once('Use_Item', { speed: 1.5 });
    game.audio.play('powerup', { pitch: 1.5 });
    game.ui.floatingText(this.position.clone().setY(2.6), `+${CONFIG.potionHeal}`, '#5f5');
    hud();
  }

  die() {
    this.dead = true;
    this.locked = true;
    this.tags.delete('player');                       // enemies stop targeting us
    this.animator.once('Death_A');
    game.audio.play('lose');
    const lost = Math.floor(this.gold / 2);
    this.gold -= lost;
    game.ui.message('You died', 3, { sub: lost ? `Lost ${lost} gold. Respawning…` : 'Respawning…' });
    game.after(3, () => {
      this.dead = false;
      this.locked = false;
      this.tags.add('player');
      this.health.reset();
      this.teleport(v3(0, 0, 4));
      this.animator.play('Idle');
      hud();
    });
  }

  update(dt) {
    const { input } = game;
    if (!this.dead && !this.talking) {
      if (input.mousePressed(0) || input.pressed('KeyF')) this.attack();
      if (input.pressed('Digit1')) this.drinkPotion();
    }
    super.update(dt);
  }
}
const xpForLevel = (lvl) => Math.round(CONFIG.levelUp.xpBase * CONFIG.levelUp.xpGrowth ** (lvl - 1));

const heroModel = await game.assets.model(M.hero);
setVisible(heroModel, { '2H_Sword': false, Badge_Shield: false, Rectangle_Shield: false, Spike_Shield: false, '1H_Sword_Offhand': false });
const hero = game.add(new Hero(heroModel));
hero.teleport(v3(0, 0, 4));
hero.object.rotation.y = Math.PI;
const cam = game.add(new FollowCamera(game, hero.object, { distance: 9, pitch: 0.5, height: 1.8 }));
hero.camera = cam;

// =============================================================================
//  PICKUPS & CHESTS
// =============================================================================
class Pickup extends Entity {
  constructor(model, kind, amount) { super(model, { tags: ['pickup'] }); this.kind = kind; this.amount = amount; this.t = rand(0, 6); }
  update(dt) {
    this.t += dt;
    this.object.rotation.y += dt * 2;
    this.object.position.y = 0.3 + Math.sin(this.t * 3) * 0.15;
    if (hero.dead || distXZ(this.position, hero.position) > 1.4) return;
    if (this.kind === 'gold') { hero.gold += this.amount; game.audio.play('coin'); game.ui.floatingText(this.position, `+${this.amount} gold`, '#ffd84a'); }
    if (this.kind === 'potion') { hero.potions++; game.audio.play('powerup'); game.ui.toast('🧪 Picked up a potion (press 1)'); }
    this.destroy();
    hud();
  }
}
async function dropLoot(pos, gold, potionChance = 0.15) {
  if (gold > 0) {
    const coin = game.add(new Pickup(await game.assets.model(M.coin), 'gold', gold));
    coin.position.set(pos.x + rand(-0.5, 0.5), 0.3, pos.z + rand(-0.5, 0.5));
  }
  if (Math.random() < potionChance) {
    const potion = game.add(new Pickup(await game.assets.model(M.potion, { scale: 1.5 }), 'potion', 1));
    potion.position.set(pos.x + rand(-1, 1), 0.3, pos.z + rand(-1, 1));
  }
}

/** Something you can press E next to: chests, NPCs… */
class Interactable extends Entity {
  constructor(model, label, onUse, range = 3) {
    super(model, { tags: ['interactable'] });
    this.onUse = onUse;
    this.range = range;
    this.label = game.ui.worldLabel(this.object, label, 3.2);
  }
  update() {
    const near = !hero.dead && distXZ(this.position, hero.position) < this.range;
    this.label.el.style.visibility = near ? 'visible' : 'hidden';
    if (near && game.input.pressed('KeyE')) this.onUse(this);
  }
  onRemoved() { this.label.remove(); }
}

async function placeChest(x, z, gold, potions) {
  const model = await game.assets.model(M.chest);
  const chest = game.add(new Interactable(model, 'Open [E]', async (self) => {
    self.destroy();
    game.scene.add(self.object);                     // keep the (now empty) chest visible
    game.audio.play('powerup');
    game.effects.burst(self.position.clone().setY(1), { color: '#ffd84a', count: 30, up: 5 });
    hero.animator.once('Interact');
    for (let i = 0; i < potions; i++) dropLoot(self.position, 0, 1);
    dropLoot(self.position, gold, 0);
  }));
  chest.position.set(x, 0, z);
  chest.rotation.y = rand(-0.5, 0.5);
  game.physics.addCollider(chest.object);
}
await placeChest(-12, 6, 15, 1);
await placeChest(14, -46, 40, 2);

// =============================================================================
//  QUEST — a tiny linear quest driven by the wizard's dialog.
// =============================================================================
const quest = { stage: 'start', kills: 0 };

const wizardModel = await game.assets.model(M.wizard);
setVisible(wizardModel, { Spellbook: false, Spellbook_open: false, '1H_Wand': false });
const wizard = game.add(new Interactable(wizardModel, '💬 Talk [E]', () => talkToWizard()));
wizard.position.set(0, 0, -3);
wizard.rotation.y = 0;
game.physics.addBox([0, 1, -3], [1, 2, 1]);
const wizardAnim = new Animator(wizardModel);
wizardAnim.play('Idle');
wizard.onUpdate((dt) => wizardAnim.update(dt));

async function talkToWizard() {
  hero.talking = true;
  wizardAnim.once('Interact', { then: 'Idle' });
  if (quest.stage === 'start') {
    const yes = await game.ui.dialog('Wizard Albus',
      `Skeletons have risen in the old ruins to the north! Please, destroy ${CONFIG.quest.killsNeeded} of them and I shall reward you.`,
      ['I will help!', 'Not now']);
    if (yes === 0) { quest.stage = 'hunt'; game.ui.toast('📜 New quest: The Restless Dead'); startSpawning(); }
  } else if (quest.stage === 'hunt') {
    await game.ui.dialog('Wizard Albus', `You have slain ${quest.kills} of ${CONFIG.quest.killsNeeded}. The ruins are north — follow the torches.`);
  } else if (quest.stage === 'return') {
    await game.ui.dialog('Wizard Albus', 'Splendid! Take these potions. But beware… the Skeleton King has awoken. End him, and the realm is saved!', ['For glory!']);
    hero.potions += 3; hero.gainXp(50);
    quest.stage = 'boss';
    spawnBoss();
  } else if (quest.stage === 'boss') {
    await game.ui.dialog('Wizard Albus', 'The King waits in the ruins. Drink potions with 1 if you get hurt!');
  } else {
    await game.ui.dialog('Wizard Albus', 'You are a true hero. Feel free to keep exploring — and maybe add your own quests in games/rpg/main.js!');
  }
  hero.talking = false;
  hud();
}

function onEnemyKilled(enemy) {
  hero.gainXp(enemy.def.xp);
  dropLoot(enemy.position, randInt(...enemy.def.gold));
  if (quest.stage === 'hunt' && ++quest.kills >= CONFIG.quest.killsNeeded) {
    quest.stage = 'return';
    game.ui.toast('📜 Quest updated: return to the wizard');
    game.audio.play('win');
  }
  if (enemy.def.boss) {
    quest.stage = 'done';
    game.audio.play('win');
    game.after(2.5, () => menu.win({
      title: 'Victory! 👑',
      text: `The Skeleton King is defeated. You reached level ${hero.level} with ${hero.gold} gold.`,
      score: hero.level * 100 + hero.gold,
    }));
  }
  hud();
}

// ---- spawner: keeps the ruins populated once the quest starts
let stopSpawning = null;
function startSpawning() {
  const { every, maxAlive, area, types } = CONFIG.spawn;
  const spawnOne = () => {
    if (game.findAll('enemy').length >= maxAlive) return;
    const a = rand(0, Math.PI * 2), r = rand(0, area.radius);
    Skeleton.spawn(game, pick(types), v3(area.x + Math.cos(a) * r, 0, area.z + Math.sin(a) * r), { onDeath: onEnemyKilled });
  };
  for (let i = 0; i < 4; i++) spawnOne();
  stopSpawning = game.every(every, spawnOne);
}
async function spawnBoss() {
  const king = await Skeleton.spawn(game, 'king', v3(0, 0, -42), { onDeath: onEnemyKilled });
  game.ui.worldLabel(king.object, '👑 Skeleton King', 4.6, 'fx-label');
}

// =============================================================================
//  HUD
// =============================================================================
const hpBar = game.ui.bar({ bottom: 56, left: '50%' }, { width: 320, height: 20, color: '#d33', label: ' ' });
hpBar.el.style.transform = 'translateX(-50%)';
const xpBar = game.ui.bar({ bottom: 40, left: '50%' }, { width: 320, height: 8, color: '#5bf' });
xpBar.el.style.transform = 'translateX(-50%)';
const stats = game.ui.text('', { top: 16, left: 16 }, { size: 18 });
const questText = game.ui.text('', { top: 16, right: 16 }, { size: 16 });
function hud() {
  hpBar.set(hero.health.fraction, `${Math.ceil(hero.health.hp)} / ${hero.health.max}`);
  xpBar.set(hero.xp / xpForLevel(hero.level));
  stats.set(`⚔️ Level ${hero.level}   💰 ${hero.gold}   🧪 ${hero.potions}`);
  questText.set({
    start: '📜 Talk to the wizard',
    hunt: `📜 Slay skeletons in the ruins: ${quest.kills}/${CONFIG.quest.killsNeeded}`,
    return: '📜 Return to the wizard',
    boss: '📜 Defeat the Skeleton King',
    done: '📜 Realm saved! 🎉',
  }[quest.stage]);
}
hud();

// =============================================================================
//  MENUS & TOUCH — title screen, pause (Esc), victory screen, phone controls
// =============================================================================
const menu = new GameMenu(game, {
  title: 'The Restless Dead',
  subtitle: 'Skeletons have risen in the ruins. The wizard needs a hero.',
  controls: CONTROLS,
  touchControls: ['Left stick — move · drag — look', '⚔️ attack · 💬 talk/open · 🧪 potion'],
  onStart: () => game.ui.message('The Restless Dead', 2.5, { sub: 'Talk to the wizard (E)' }),
});
new TouchControls(game, {
  joystick: true, look: true,
  buttons: [{ label: '⚔️', key: 'KeyF' }, { label: 'Jump', key: 'Space' }, { label: '💬', key: 'KeyE' }, { label: '🧪', key: 'Digit1' }],
});

game.start();
