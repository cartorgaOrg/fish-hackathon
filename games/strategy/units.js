// Units: villagers, knights, raiders. One class, behaviour driven by `order`:
//   { type: 'move', point }  { type: 'attack', target }  { type: 'gather', target }  { type: 'build', target }
// Idle units look for enemies on their own (see autoAcquire).
import { THREE, Entity, Animator, Health, PathFollower, setVisible, findNode, distXZ, yawTo } from '@engine';
import { UNITS, CONFIG, RESOURCES } from './data.js';
import { world, teamOf, nearest, approachPoint, callForHelp } from './world.js';

export class Unit extends Entity {
  constructor(type, team, model) {
    super(new THREE.Group(), { tags: ['unit', team, type], name: UNITS[type].name });
    this.object.add(model);
    this.type = type;
    this.team = team;
    this.def = UNITS[type];
    this.radius = 0.4;
    this.anim = new Animator(model);
    this.anim.play('Idle');
    this.mover = new PathFollower(this.object, { speed: this.def.speed });
    this.order = null;
    this.carry = { kind: null, amount: 0 };
    this._cooldown = 0;   // seconds until next attack
    this._work = 0;       // gather/build progress accumulator
    this._repath = 0;     // seconds until we recompute a chase path
    const game = world.game;
    this.bar = game.ui.worldBar(this.object, 2.2, team === 'player' ? '#4dff88' : '#ff4d4d');
    this.health = new Health(this.def.hp, {
      onDamage: (amount, source) => { callForHelp(this, source); this.bar.set(this.health.fraction); game.effects.flash(this.object, { color: '#ff3030' }); },
      onDeath: () => this.die(),
    });
  }

  // ------------------------------------------------------------- commands
  command(order) {
    if (this.health.dead) return;
    this.order = order;
    this._work = 0;
    this._pathTo(order.point ?? approachPoint(this.position, order.target));
  }
  moveTo(point) { this.command({ type: 'move', point }); }
  stop() { this.order = null; this.mover.stop(); }

  _pathTo(point) { this.mover.goTo(world.nav.findPath(this.position, point)); }
  _near(target, extra = 1.0) { return distXZ(this.position, target.position) <= (target.radius ?? 0) + extra; }
  _face(target) { this.object.rotation.y = yawTo(this.position, target.position); }

  die() {
    this.mover.stop();
    this.order = null;
    this.bar.remove();
    this.anim.once('Death_A');
    world.game.audio.play('death', { volume: 0.4 });
    world.game.after(2.5, () => this.destroy());
  }

  // ------------------------------------------------------------- per frame
  update(dt) {
    this.anim.update(dt);
    if (this.health.dead) return;
    this._cooldown -= dt;
    if (!this.order) this.autoAcquire();
    const o = this.order;
    if (o?.type === 'move' && !this.mover.moving) this.order = null;
    if (o?.type === 'attack') this.doAttack(dt, o);
    if (o?.type === 'gather') this.doGather(dt, o);
    if (o?.type === 'build') this.doBuild(dt, o);
    this.mover.update(dt);
    this.separate(dt);

    if (this.mover.moving) this.anim.play(this.carry.amount ? 'Walking_A' : 'Running_A');
    else if (!this.anim.busy && !this._working) this.anim.play('Idle');
  }

  /** Idle units fight anything that comes close. Raiders always hunt. */
  autoAcquire() {
    const enemyTeam = this.team === 'player' ? 'enemy' : 'player';
    let target = nearest(teamOf(enemyTeam, 'unit'), this.position);
    if (target && distXZ(target.position, this.position) > this.def.sight) target = null;
    if (!target && this.team === 'enemy') target = nearest(teamOf('player', 'building'), this.position);
    if (target) this.command({ type: 'attack', target });
  }

  doAttack(dt, o) {
    this._working = false;
    const t = o.target;
    if (!t.alive || t.health.dead) { this.order = null; return; }
    if (this._near(t, this.def.range + this.radius)) {
      this.mover.stop();
      this._face(t);
      if (this._cooldown <= 0) {
        this._cooldown = this.def.attackRate;
        this.anim.once('1H_Melee_Attack_Chop', { speed: 1.4 });
        world.game.audio.play('hit', { volume: 0.25 });
        t.health.damage(this.def.attack, this);
        // the victim fights back if it was just standing around
        if (t.order == null && t.command && !t.health.dead) t.command({ type: 'attack', target: this });
      }
    } else if ((this._repath -= dt) <= 0 || !this.mover.moving) {
      this._repath = 0.5;
      this._pathTo(approachPoint(this.position, t));
    }
  }

  doGather(dt, o) {
    let node = o.target;
    this._working = false;
    // returning a full load to the nearest drop-off (Town Center)
    if (o.returning) {
      const drop = nearest(teamOf('player', 'building').filter((b) => b.built && b.def.dropoff), this.position);
      if (!drop) { this.order = null; return; }
      if (this._near(drop, 1.5)) {
        world.stock[this.carry.kind] += this.carry.amount;
        world.game.ui.floatingText(this.position.clone().setY(2), `+${this.carry.amount}${RESOURCES[this.carry.kind].icon}`, RESOURCES[this.carry.kind].color);
        this.carry.amount = 0;
        o.returning = false;
        if (!node.alive) node = o.target = this.findNode(o.kind);
        if (!node) { this.order = null; return; }
        this._pathTo(approachPoint(this.position, node));
      } else if (!this.mover.moving) this._pathTo(approachPoint(this.position, drop));
      return;
    }
    if (!node?.alive || node.amount <= 0) {
      node = o.target = this.findNode(o.kind ?? node?.gives);
      if (!node) { this.order = null; return; }
      this._pathTo(approachPoint(this.position, node));
      return;
    }
    o.kind = node.gives;
    if (!this._near(node, 1.2)) { if (!this.mover.moving) this._pathTo(approachPoint(this.position, node)); return; }
    // at the node: work!
    this.mover.stop();
    this._face(node);
    this._working = true;
    this.anim.play(o.kind === 'food' ? 'PickUp' : '1H_Melee_Attack_Chop');
    if (this.carry.kind !== o.kind) this.carry = { kind: o.kind, amount: 0 };
    this._work += dt * this.def.gatherRate;
    while (this._work >= 1) {
      this._work -= 1;
      this.carry.amount++;
      node.take(1);
    }
    if (this.carry.amount >= CONFIG.carryCapacity || node.amount <= 0) {
      o.returning = true;
      this._working = false;
      this.mover.stop(); // next frame the `returning` branch above walks us to the drop-off
    }
  }

  doBuild(dt, o) {
    const b = o.target;
    this._working = false;
    if (!b.alive || b.built) {
      this.order = null;
      // a finished farm puts its builder straight to work
      if (b.alive && b.gives) this.command({ type: 'gather', target: b });
      return;
    }
    if (!this._near(b, 1.2)) { if (!this.mover.moving) this._pathTo(approachPoint(this.position, b)); return; }
    this.mover.stop();
    this._face(b);
    this._working = true;
    this.anim.play('1H_Melee_Attack_Chop');
    b.addProgress(dt);
  }

  /** Nearest resource of a kind (trees, gold, or one of our farms). */
  findNode(kind) {
    const nodes = world.game.findAll('resource').filter((n) => n.gives === kind && n.amount > 0 && (n.built ?? true));
    const n = nearest(nodes, this.position);
    return n && distXZ(n.position, this.position) < 30 ? n : null;
  }

  /** Push overlapping units apart so groups don't stack into one blob. */
  separate(dt) {
    for (const other of world.game.findAll('unit')) {
      if (other === this) continue;
      const dx = this.position.x - other.position.x, dz = this.position.z - other.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 0.8) {
        const push = (0.8 - d) * 3 * dt;
        const nx = this.position.x + (dx / d) * push, nz = this.position.z + (dz / d) * push;
        if (world.nav.isFree({ x: nx, z: nz })) { this.position.x = nx; this.position.z = nz; }
      }
    }
  }
}

/** Create a unit of `type` for `team` at `pos` and add it to the game. */
export async function spawnUnit(type, team, pos) {
  const def = UNITS[type];
  const model = await world.game.assets.model(def.model, { scale: def.scale });
  if (def.hide) setVisible(model, Object.fromEntries(def.hide.map((n) => [n, false])));
  if (def.weapon) {
    findNode(model, 'handslot.r')?.add(await world.game.assets.model(def.weapon)); // KayKit right-hand bone
  }
  const unit = new Unit(type, team, model);
  unit.position.set(pos.x, 0, pos.z);
  return world.game.add(unit);
}
