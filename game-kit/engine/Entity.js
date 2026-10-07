import * as THREE from 'three';

/**
 * Anything that lives in the game: player, enemy, coin, bullet, building…
 *
 * An Entity wraps a THREE.Object3D (`entity.object`) and gets `update(dt)` called every frame
 * once you `game.add(entity)`. Two ways to use it:
 *
 *   // 1) subclass
 *   class Coin extends Entity {
 *     update(dt) { this.object.rotation.y += dt * 3; }
 *   }
 *   game.add(new Coin(model, { tags: ['coin'] }));
 *
 *   // 2) plain entity + inline behaviour
 *   const coin = game.add(new Entity(model, { tags: ['coin'] }));
 *   coin.onUpdate((dt) => coin.object.rotation.y += dt * 3);
 *
 * Tags let you find things later: game.findAll('enemy'), entity.is('coin').
 */
export class Entity {
  /**
   * @param {THREE.Object3D} [object] the visual. Defaults to an empty Group.
   * @param {{ tags?: string[], name?: string }} [opts]
   */
  constructor(object = new THREE.Group(), { tags = [], name } = {}) {
    /** @type {THREE.Object3D} */
    this.object = object;
    this.object.userData.entity = this; // lets raycasts find the entity that owns a mesh
    this.tags = new Set(tags);
    this.name = name ?? object.name ?? '';
    /** @type {import('./Game.js').Game | null} set when added to a game */
    this.game = null;
    this.alive = true;
    /** @type {Array<(dt:number, e:Entity)=>void>} */
    this._updaters = [];
  }

  /** Shortcut for this.object.position */
  get position() { return this.object.position; }
  get rotation() { return this.object.rotation; }

  is(tag) { return this.tags.has(tag); }

  /** Add a per-frame callback (or a behaviour object with an update(dt, entity) method). */
  onUpdate(fnOrBehaviour) {
    const fn = typeof fnOrBehaviour === 'function' ? fnOrBehaviour : (dt, e) => fnOrBehaviour.update(dt, e);
    this._updaters.push(fn);
    return this;
  }

  /** Called once when added to the game. Override for setup. */
  onAdded(game) {}
  /** Called once when removed/destroyed. Override for cleanup. */
  onRemoved(game) {}
  /** Called every frame. Override in subclasses. */
  update(dt) {}

  /** Remove from the game (safe to call during update). */
  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.game?.remove(this);
  }

  /** @internal */
  _tick(dt) {
    this.update(dt);
    for (const fn of this._updaters) if (this.alive) fn(dt, this);
  }
}
