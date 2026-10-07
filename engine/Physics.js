import * as THREE from 'three';

/**
 * Deliberately simple physics: everything solid is an axis-aligned box (AABB), characters are
 * boxes too. It's predictable, easy to debug, and good enough for platformers, shooters, RPGs
 * and RTS games. (Need real rigid-body physics? Drop in @dimforge/rapier3d — see docs/RECIPES.md.)
 *
 *   physics.addCollider(wallMesh);                  // static box from any object's bounds
 *   physics.addBox(center, size);                   // invisible wall
 *   physics.addCollider(platform, { dynamic: true }); // moving platform: box follows the object
 *   const body = new Body(physics, { radius: 0.4, height: 1.8 });
 *   body.velocity.x = 5; body.move(dt);             // collides + gravity + ground
 *   physics.raycast(origin, dir, { maxDist: 100, entities: game.findAll('enemy') });
 */
export class Physics {
  /**
   * @param {{ gravity?: number, groundY?: number | null }} [opts]
   *   groundY: height of an infinite floor. `null` = no floor (fall into the void, e.g. platformers).
   */
  constructor({ gravity = -30, groundY = 0 } = {}) {
    this.gravity = gravity;
    this.groundY = groundY;
    /** @type {Collider[]} */
    this.colliders = [];
    this.debug = false;
    this._helpers = new Map();
  }

  /**
   * Make an object solid using its bounding box.
   * @param {THREE.Object3D} object
   * @param {{ dynamic?: boolean, tag?: string, padding?: number, oneWay?: boolean }} [opts]
   *   dynamic: recompute the box every frame (moving platforms, doors)
   *   oneWay:  can jump through from below, stand on top (classic platformer ledges)
   */
  addCollider(object, opts = {}) {
    const c = new Collider(object, opts);
    this.colliders.push(c);
    return c;
  }

  /** Invisible solid box. `center` and `size` are Vector3s (or [x,y,z] arrays). */
  addBox(center, size, opts = {}) {
    const c = new Collider(null, opts);
    const ctr = Array.isArray(center) ? new THREE.Vector3(...center) : center;
    const sz = Array.isArray(size) ? new THREE.Vector3(...size) : size;
    c.box.setFromCenterAndSize(ctr, sz);
    this.colliders.push(c);
    return c;
  }

  /** Remove a collider (or every collider created from an object). */
  remove(colliderOrObject) {
    this.colliders = this.colliders.filter((c) => c !== colliderOrObject && c.object !== colliderOrObject);
  }

  /** Colliders whose box intersects `box`. */
  query(box, filter) {
    return this.colliders.filter((c) => c.solid && c.box.intersectsBox(box) && (!filter || filter(c)));
  }

  /**
   * Cast a ray against solid colliders and (optionally) entities' meshes.
   * @param {THREE.Vector3} origin
   * @param {THREE.Vector3} dir  normalized direction
   * @param {{ maxDist?: number, entities?: import('./Entity.js').Entity[], walls?: boolean }} [opts]
   * @returns {{ point: THREE.Vector3, distance: number, entity?: any, collider?: Collider, normal?: THREE.Vector3 } | null}
   */
  raycast(origin, dir, { maxDist = 1000, entities = [], walls = true } = {}) {
    let best = null;
    if (walls) {
      const ray = new THREE.Ray(origin, dir);
      const p = new THREE.Vector3();
      for (const c of this.colliders) {
        if (!c.solid || c.oneWay) continue;
        if (c.box.containsPoint(origin)) continue;
        if (ray.intersectBox(c.box, p)) {
          const d = p.distanceTo(origin);
          if (d <= maxDist && (!best || d < best.distance)) best = { point: p.clone(), distance: d, collider: c };
        }
      }
    }
    if (entities.length) {
      const rc = new THREE.Raycaster(origin, dir, 0, best ? best.distance : maxDist);
      const hits = rc.intersectObjects(entities.filter((e) => e.alive).map((e) => e.object), true);
      if (hits.length) {
        const h = hits[0];
        best = { point: h.point, distance: h.distance, entity: entityOf(h.object), normal: h.face?.normal };
      }
    }
    return best;
  }

  /** @internal called by Game once per frame, before entities update. */
  update() {
    for (const c of this.colliders) if (c.dynamic) c.refresh();
    if (this.debug) this._drawDebug();
  }

  /** Toggle wireframe boxes for every collider (needs a scene). */
  showDebug(scene, on = true) {
    this.debug = on;
    this._scene = scene;
    if (!on) { for (const h of this._helpers.values()) h.removeFromParent(); this._helpers.clear(); }
  }

  _drawDebug() {
    for (const c of this.colliders) {
      let h = this._helpers.get(c);
      if (!h) {
        h = new THREE.Box3Helper(c.box, c.oneWay ? 0x00ffff : c.dynamic ? 0xffaa00 : 0xff00ff);
        this._helpers.set(c, h);
        this._scene.add(h);
      }
    }
    for (const [c, h] of this._helpers) if (!this.colliders.includes(c)) { h.removeFromParent(); this._helpers.delete(c); }
  }
}

/** A solid box in the world. Usually created via physics.addCollider / addBox. */
export class Collider {
  constructor(object, { dynamic = false, tag = '', padding = 0, oneWay = false, solid = true } = {}) {
    this.object = object;
    this.dynamic = dynamic;
    this.tag = tag;
    this.padding = padding;
    this.oneWay = oneWay;
    this.solid = solid;
    this.box = new THREE.Box3();
    /** how far the box moved since last frame (moving platforms carry riders by this) */
    this.delta = new THREE.Vector3();
    this._lastCenter = null;
    if (object) this.refresh();
  }

  refresh() {
    this.object.updateWorldMatrix(true, true);
    this.box.setFromObject(this.object);
    if (this.padding) this.box.expandByScalar(this.padding);
    const c = this.box.getCenter(new THREE.Vector3());
    if (this._lastCenter) this.delta.subVectors(c, this._lastCenter);
    this._lastCenter = c;
  }
}

/**
 * A kinematic character: a box with velocity that slides along walls, lands on floors,
 * steps up small ledges and rides moving platforms.
 *
 *   const body = new Body(game.physics, { position: v3(0, 1, 0) });
 *   body.velocity.x = input.move().x * 6;
 *   if (input.pressed('Space') && body.onGround) body.velocity.y = 10;
 *   body.move(dt);
 *   model.position.copy(body.position);   // position = feet
 */
export class Body {
  /**
   * @param {Physics} physics
   * @param {{ radius?: number, height?: number, position?: THREE.Vector3, stepHeight?: number, gravityScale?: number }} [opts]
   */
  constructor(physics, { radius = 0.4, height = 1.8, position, stepHeight = 0.35, gravityScale = 1 } = {}) {
    this.physics = physics;
    this.radius = radius;
    this.height = height;
    this.stepHeight = stepHeight;
    this.gravityScale = gravityScale;
    /** feet position */
    this.position = position ? position.clone() : new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    /** @type {Collider | null} what we're standing on (null = ground plane or air) */
    this.ground = null;
    /** set true for one frame when we bump our head */
    this.hitCeiling = false;
    /** set true for one frame when blocked horizontally */
    this.hitWall = false;
    this._box = new THREE.Box3();
  }

  /** Current bounding box (world). */
  get box() {
    const p = this.position, r = this.radius;
    return this._box.set(new THREE.Vector3(p.x - r, p.y, p.z - r), new THREE.Vector3(p.x + r, p.y + this.height, p.z + r));
  }

  /** Apply gravity + velocity and resolve collisions. Call once per frame. */
  move(dt) {
    const ph = this.physics;
    if (this.ground?.dynamic) this.position.add(this.ground.delta); // ride moving platforms
    this.velocity.y += ph.gravity * this.gravityScale * dt;
    this.hitCeiling = this.hitWall = false;

    // sub-step so fast movers don't tunnel through thin walls
    const d = this.velocity.clone().multiplyScalar(dt);
    const steps = Math.max(1, Math.ceil(d.length() / (this.radius * 0.8)));
    d.divideScalar(steps);
    const wasOnGround = this.onGround;
    this.onGround = false;
    this.ground = null;
    for (let i = 0; i < steps; i++) {
      this._moveAxis('x', d.x, wasOnGround);
      this._moveAxis('z', d.z, wasOnGround);
      this._moveAxis('y', d.y, wasOnGround);
    }

    if (ph.groundY != null && this.position.y <= ph.groundY) {
      this.position.y = ph.groundY;
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.onGround = true;
    }
    // stick to the floor when walking down small steps
    if (!this.onGround && wasOnGround && this.velocity.y <= 0) {
      const probe = this.box.clone().translate(new THREE.Vector3(0, -this.stepHeight, 0));
      const below = ph.query(probe, (c) => c.box.max.y <= this.position.y + 0.01);
      if (below.length) {
        const top = Math.max(...below.map((c) => c.box.max.y));
        this.position.y = top;
        this.velocity.y = 0;
        this.onGround = true;
        this.ground = below.find((c) => c.box.max.y === top);
      }
    }
  }

  /** Strict overlap: boxes that only touch (standing on a floor, flush against a wall) don't count. */
  _overlaps(c) {
    const b = this.box, e = 1e-3;
    return b.max.x > c.box.min.x + e && b.min.x < c.box.max.x - e &&
           b.max.y > c.box.min.y + e && b.min.y < c.box.max.y - e &&
           b.max.z > c.box.min.z + e && b.min.z < c.box.max.z - e;
  }

  _moveAxis(axis, amount, wasOnGround) {
    if (!amount) return;
    const before = this.position.y;
    this.position[axis] += amount;
    const hits = this.physics.query(this.box);
    for (const c of hits) {
      if (!this._overlaps(c)) continue; // just touching (e.g. standing on it), or resolved by an earlier hit
      if (c.oneWay && !(axis === 'y' && amount < 0 && before >= c.box.max.y - 0.01)) continue;
      if (axis === 'y') {
        if (amount < 0) {
          this.position.y = c.box.max.y;
          this.onGround = true;
          this.ground = c;
        } else {
          this.position.y = c.box.min.y - this.height - 0.001;
          this.hitCeiling = true;
        }
        this.velocity.y = 0;
      } else {
        // try stepping up onto low obstacles (stairs, curbs)
        const rise = c.box.max.y - this.position.y;
        if (wasOnGround && rise > 0 && rise <= this.stepHeight) {
          const y = this.position.y;
          this.position.y = c.box.max.y + 0.001;
          if (!this.physics.query(this.box).some((o) => !o.oneWay && this._overlaps(o))) continue;
          this.position.y = y;
        }
        const r = this.radius + 0.001;
        this.position[axis] = amount > 0 ? c.box.min[axis] - r : c.box.max[axis] + r;
        this.velocity[axis] = 0;
        this.hitWall = true;
      }
    }
  }
}

/** Walk up the parent chain to find the Entity that owns a mesh. */
export function entityOf(object) {
  for (let o = object; o; o = o.parent) if (o.userData?.entity) return o.userData.entity;
  return null;
}
