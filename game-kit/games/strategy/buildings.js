// Buildings (construct → finished → train units) and resource nodes (trees, gold mines).
import { THREE, Entity, Health, pick, rand } from '@engine';
import { BUILDINGS, NODES, UNITS } from './data.js';
import { world, population, callForHelp } from './world.js';
import { spawnUnit } from './units.js';

export class Building extends Entity {
  constructor(type, team, built) {
    super(new THREE.Group(), { tags: ['building', team, type], name: BUILDINGS[type].name });
    this.type = type;
    this.team = team;
    this.def = BUILDINGS[type];
    this.radius = this.def.size / 2;
    this.gives = this.def.gives;   // farms are also a food source
    this.amount = this.gives ? Infinity : 0;
    if (this.gives) this.tags.add('resource');
    this.built = false;
    this.progress = 0;
    /** training queue: [{ type, time }] */
    this.queue = [];
    this.bar = world.game.ui.worldBar(this.object, 4, '#5ab0ff');
    this.health = new Health(this.def.hp, {
      onDamage: (amount, source) => { callForHelp(this, source); this.bar.set(this.built ? this.health.fraction : this.progress / this.def.buildTime); world.game.effects.flash(this.object, { color: '#ff5030' }); },
      onDeath: () => this.collapse(),
    });
    this.setModel(this.def.site);
    if (built) this.addProgress(Infinity);
    else this.bar.set(0);
  }

  async setModel(url) {
    const model = await world.game.assets.model(url, { scale: this.def.scale });
    this.object.clear();
    this.object.add(model);
  }

  /** Farms are an endless food source (villagers call this while harvesting). */
  take() {}

  /** Called by villagers every frame they hammer on it. */
  addProgress(dt) {
    if (this.built) return;
    this.progress = Math.min(this.def.buildTime, this.progress + dt);
    this.bar.set(this.progress / this.def.buildTime);
    if (this.progress >= this.def.buildTime) {
      this.built = true;
      this.setModel(this.def.model);
      this.bar.set(this.health.fraction);
      this.bar.el.querySelector('.fx-wbar > div').style.background = this.team === 'player' ? '#4dff88' : '#ff4d4d';
      if (world.game.time > 1) {
        world.game.audio.play('build');
        world.game.effects.burst(this.position.clone().setY(1), { color: '#c9a36a', count: 20 });
        world.game.ui.toast(`${this.def.name} finished`);
      }
    }
  }

  /** Queue a unit if affordable and there's housing. Returns an error string or null. */
  train(type) {
    const def = UNITS[type];
    const { used, cap } = population();
    if (used >= cap) return 'Need more houses!';
    if (this.queue.length >= 5) return 'Queue is full';
    for (const [k, v] of Object.entries(def.cost)) if (world.stock[k] < v) return `Not enough ${k}`;
    for (const [k, v] of Object.entries(def.cost)) world.stock[k] -= v;
    this.queue.push({ type, time: 0 });
    return null;
  }

  update(dt) {
    if (!this.built || !this.queue.length) return;
    const job = this.queue[0];
    job.time += dt;
    if (job.time >= UNITS[job.type].trainTime) {
      this.queue.shift();
      const door = this.position.clone().add(new THREE.Vector3(rand(-1, 1), 0, this.radius + 1));
      const spot = world.nav.nearestFree(door) ?? door;
      spawnUnit(job.type, this.team, spot).then((u) => {
        if (this.rally) u.moveTo(this.rally);
        else if (u.def.canGather) {               // new villagers go chop the nearest tree
          const node = u.findNode('wood');
          if (node) u.command({ type: 'gather', target: node });
        }
      });
      world.game.audio.play('powerup', { volume: 0.4 });
    }
  }

  collapse() {
    world.game.effects.burst(this.position.clone().setY(1.5), { color: '#776655', count: 40, speed: 8 });
    world.game.effects.shake(0.4);
    world.game.audio.play('explosion', { volume: 0.5 });
    if (!this.def.walkable) world.nav.blockBox(this.footprint(), false, 0.05);
    this.bar.remove();
    this.destroy();
  }

  /** The grid area this building covers. */
  footprint() {
    const h = this.def.size / 2;
    return new THREE.Box3(new THREE.Vector3(this.position.x - h, 0, this.position.z - h), new THREE.Vector3(this.position.x + h, 1, this.position.z + h));
  }
}

/** Place a building (snapped to the grid) and block it on the nav grid. */
export function spawnBuilding(type, team, pos, built = false) {
  const b = new Building(type, team, built);
  b.position.set(Math.round(pos.x), 0, Math.round(pos.z));
  if (!b.def.walkable) world.nav.blockBox(b.footprint(), true, 0.05);
  return world.game.add(b);
}

/** Trees and gold mines: villagers take from `amount` until it runs out. */
export class ResourceNode extends Entity {
  constructor(kind, model) {
    super(new THREE.Group(), { tags: ['resource', kind], name: kind === 'tree' ? 'Tree' : 'Gold mine' });
    this.object.add(model);
    this.def = NODES[kind];
    this.gives = this.def.gives;
    this.amount = this.def.amount;
    this.radius = kind === 'tree' ? 0.6 : 1.6;
  }

  take(n) {
    this.amount -= n;
    if (this.amount <= 0 && this.alive) {
      world.nav.blockBox(this._box, false, this._margin);
      world.game.effects.burst(this.position.clone().setY(1), { color: this.gives === 'wood' ? '#3f7a3a' : '#ffd84a' });
      this.destroy();
    }
  }
}

export async function spawnNode(kind, pos) {
  const def = NODES[kind];
  const model = await world.game.assets.model(pick(def.models), { scale: def.scale * rand(0.85, 1.15) });
  model.rotation.y = rand(0, Math.PI * 2);
  const node = new ResourceNode(kind, model);
  node.position.set(pos.x, 0, pos.z);
  world.game.add(node);
  node._margin = kind === 'tree' ? 0.5 : 0.4;
  node._box = world.nav.blockObject(node.object, true, node._margin);
  return node;
}
