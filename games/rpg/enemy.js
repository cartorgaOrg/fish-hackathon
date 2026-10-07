// =============================================================================
//  Skeleton enemy — a complete melee AI built from engine primitives:
//    Entity (lifecycle) + Body (collisions) + Animator + Health + StateMachine
//
//  Copy this file for any "walks to the player and hits them" enemy. To make a
//  new enemy type, just add an entry to ENEMY_TYPES below.
// =============================================================================
import { Entity, Body, Animator, Health, StateMachine, setVisible, distXZ, yawTo, dampAngle, rand, v3 } from '@engine';

/** Enemy stats. `model` is any animated KayKit skeleton/character. */
export const ENEMY_TYPES = {
  minion:  { model: '/assets/kaykit-skeletons/Skeleton_Minion.glb',  hp: 30,  damage: 8,  speed: 3.2, xp: 10, gold: [1, 3],  scale: 1 },
  warrior: { model: '/assets/kaykit-skeletons/Skeleton_Warrior.glb', hp: 60,  damage: 14, speed: 2.8, xp: 25, gold: [3, 6],  scale: 1,
             hide: ['Skeleton_Shield_Large_A', 'Skeleton_Shield_Large_B'] },
  rogue:   { model: '/assets/kaykit-skeletons/Skeleton_Rogue.glb',   hp: 25,  damage: 10, speed: 4.4, xp: 15, gold: [2, 4],  scale: 1 },
  king:    { model: '/assets/kaykit-skeletons/Skeleton_Warrior.glb', hp: 400, damage: 25, speed: 3.0, xp: 200, gold: [50, 50], scale: 1.6, boss: true },
};

const AGGRO_RANGE = 14;   // starts chasing inside this distance
const ATTACK_RANGE = 2.0; // swings inside this distance
const LEASH_RANGE = 30;   // gives up chasing beyond this distance from home

export class Skeleton extends Entity {
  /**
   * @param {import('@engine').Game} game
   * @param {keyof ENEMY_TYPES} type
   * @param {THREE.Vector3} position
   * @param {{ onDeath?: (e: Skeleton) => void }} [hooks]
   */
  static async spawn(game, type, position, hooks = {}) {
    const def = ENEMY_TYPES[type];
    const model = await game.assets.model(def.model, { scale: def.scale });
    if (def.hide) setVisible(model, Object.fromEntries(def.hide.map((n) => [n, false])));
    return game.add(new Skeleton(game, model, def, position, hooks));
  }

  constructor(game, model, def, position, hooks) {
    super(model, { tags: ['enemy'] });
    this.def = def;
    this.hooks = hooks;
    this.home = position.clone();
    this.position.copy(position);
    this.body = new Body(game.physics, { radius: 0.5 * def.scale, height: 2 * def.scale, position });
    this.anim = new Animator(model);
    this.attackTimer = 0;

    this.health = new Health(def.hp, {
      onDamage: (amount) => {
        game.effects.flash(this.object, { color: '#ff4040' });
        game.ui.floatingText(this.position.clone().setY(2.4 * def.scale), `-${amount}`, '#ffdd55');
        this.bar.set(this.health.fraction);
        if (!this.health.dead && !def.boss) this.ai.go('hit', true); // bosses don't flinch
      },
      onDeath: () => this.ai.go('dead'),
    });
    this.bar = game.ui.worldBar(this.object, 2.8 * def.scale, def.boss ? '#c040ff' : '#e33');

    // ---- the brain. Each state = what to do on enter + every frame.
    const player = () => game.find('player');
    this.ai = new StateMachine({
      spawn: {
        enter: () => this.anim.once(['Spawn_Ground_Skeletons', 'Spawn_Ground'], { then: 'Idle' }),
        update: () => { if (this.ai.time > 1.2) this.ai.go('idle'); },
      },
      idle: {
        enter: () => this.anim.play(['Idle_Combat', 'Idle']),
        update: () => {
          const p = player();
          if (p && !p.dead && distXZ(p.position, this.position) < AGGRO_RANGE) this.ai.go('chase');
          else if (this.ai.time > rand(2, 4)) this.ai.go('wander');
        },
      },
      wander: {
        enter: () => { this.target = this.home.clone().add(v3(rand(-6, 6), 0, rand(-6, 6))); this.anim.play('Walking_A'); },
        update: (dt) => {
          const p = player();
          if (p && !p.dead && distXZ(p.position, this.position) < AGGRO_RANGE) return this.ai.go('chase');
          if (this.moveToward(this.target, def.speed * 0.4, dt) < 0.5 || this.ai.time > 5) this.ai.go('idle');
        },
      },
      chase: {
        enter: () => this.anim.play(['Running_A', 'Running_B']),
        update: (dt) => {
          const p = player();
          if (!p || p.dead || distXZ(this.position, this.home) > LEASH_RANGE) return this.ai.go('return');
          const d = this.moveToward(p.position, def.speed, dt);
          if (d < ATTACK_RANGE * def.scale) this.ai.go('attack');
        },
      },
      attack: {
        enter: () => {
          this.hasHit = false;
          this.anim.once(['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal'], { speed: 0.9 });
        },
        update: (dt) => {
          const p = player();
          this.stop(dt);
          if (p) this.object.rotation.y = dampAngle(this.object.rotation.y, yawTo(this.position, p.position), 8, dt);
          // the blade connects ~0.45s into the swing
          if (!this.hasHit && this.ai.time > 0.45) {
            this.hasHit = true;
            if (p && !p.dead && distXZ(p.position, this.position) < ATTACK_RANGE * def.scale + 0.4) p.hurt(def.damage, this);
          }
          if (this.ai.time > 1.1) this.ai.go(p && distXZ(p.position, this.position) < ATTACK_RANGE * def.scale ? 'attack' : 'chase', true);
        },
      },
      hit: {
        enter: () => this.anim.once(['Hit_A', 'Hit_B'], { speed: 1.4 }),
        update: (dt) => { this.stop(dt); if (this.ai.time > 0.4) this.ai.go('chase'); },
      },
      return: {
        enter: () => this.anim.play('Walking_A'),
        update: (dt) => {
          this.health.heal(dt * 10);
          this.bar.set(this.health.fraction);
          if (this.moveToward(this.home, def.speed, dt) < 1) this.ai.go('idle');
        },
      },
      dead: {
        enter: () => {
          this.anim.once(['Death_A', 'Death_B']);
          this.tags.delete('enemy');        // no longer a target
          this.bar.remove();
          game.audio.play('death', { pitch: def.boss ? 0.6 : 1 });
          this.hooks.onDeath?.(this);
        },
        update: (dt) => {
          this.stop(dt);
          if (this.ai.time > 2.5) this.object.position.y -= dt * 0.8; // sink into the ground
          if (this.ai.time > 4) this.destroy();
        },
      },
    }, 'spawn');
  }

  /** Walk toward a point; returns remaining distance. */
  moveToward(target, speed, dt) {
    const dx = target.x - this.position.x, dz = target.z - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.01) {
      this.body.velocity.x = (dx / d) * speed;
      this.body.velocity.z = (dz / d) * speed;
      this.object.rotation.y = dampAngle(this.object.rotation.y, Math.atan2(dx, dz), 10, dt);
    }
    return d;
  }

  stop() { this.body.velocity.x = this.body.velocity.z = 0; }

  update(dt) {
    this.ai.update(dt);
    // push away from other skeletons so they don't stack into one blob
    for (const other of this.game.findNear(this.position, 1.2, 'enemy')) {
      if (other === this) continue;
      const dx = this.position.x - other.position.x, dz = this.position.z - other.position.z;
      const d = Math.hypot(dx, dz) || 0.01;
      this.body.velocity.x += (dx / d) * 2;
      this.body.velocity.z += (dz / d) * 2;
    }
    this.body.move(dt);
    if (!this.ai.is('dead')) this.object.position.copy(this.body.position);
    this.anim.update(dt);
  }

  onRemoved() { this.bar.remove(); }
}
