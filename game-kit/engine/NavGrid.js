import * as THREE from 'three';
import { getBounds } from './Assets.js';

/**
 * Grid-based A* pathfinding on the ground plane (RTS units, RPG enemies, tower defense…).
 *
 *   const nav = new NavGrid({ size: 100, cellSize: 1 });   // covers -50..50 on X and Z
 *   nav.blockObject(houseModel);                           // mark cells under an object as solid
 *   nav.blockBox(box3);  nav.setBlocked(x, z, true);       // or by box / world position
 *   const path = nav.findPath(unit.position, clickPoint);  // Vector3[] (empty if unreachable)
 *
 * Use `PathFollower` (below) to walk an entity along a path.
 */
export class NavGrid {
  /**
   * @param {{ size?: number, width?: number, depth?: number, cellSize?: number, center?: THREE.Vector3 }} [opts]
   */
  constructor({ size = 100, width = size, depth = size, cellSize = 1, center = new THREE.Vector3() } = {}) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(depth / cellSize);
    this.originX = center.x - width / 2;
    this.originZ = center.z - depth / 2;
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  /** World position → integer cell coords. */
  cellOf(pos) {
    return { cx: Math.floor((pos.x - this.originX) / this.cellSize), cz: Math.floor((pos.z - this.originZ) / this.cellSize) };
  }
  /** Cell → world position of the cell centre (y = 0). */
  worldOf(cx, cz) {
    return new THREE.Vector3(this.originX + (cx + 0.5) * this.cellSize, 0, this.originZ + (cz + 0.5) * this.cellSize);
  }
  inside(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.cols && cz < this.rows; }
  isBlocked(cx, cz) { return !this.inside(cx, cz) || this.blocked[cz * this.cols + cx] === 1; }
  /** Is the world position walkable? */
  isFree(pos) { const { cx, cz } = this.cellOf(pos); return !this.isBlocked(cx, cz); }

  /** Block/unblock the cell at a world position. */
  setBlocked(pos, value = true) {
    const { cx, cz } = this.cellOf(pos);
    if (this.inside(cx, cz)) this.blocked[cz * this.cols + cx] = value ? 1 : 0;
  }

  /** Block/unblock every cell overlapping a Box3 (optionally shrunk by `margin`). */
  blockBox(box, value = true, margin = 0) {
    const a = this.cellOf({ x: box.min.x + margin, z: box.min.z + margin });
    const b = this.cellOf({ x: box.max.x - margin, z: box.max.z - margin });
    for (let z = a.cz; z <= b.cz; z++) for (let x = a.cx; x <= b.cx; x++) {
      if (this.inside(x, z)) this.blocked[z * this.cols + x] = value ? 1 : 0;
    }
  }

  /** Block the footprint of an object (uses its bounding box). Returns the Box3 used. */
  blockObject(object, value = true, margin = 0.2) {
    const box = getBounds(object);
    this.blockBox(box, value, margin);
    return box;
  }

  /** Closest walkable cell centre to a position (searches outward). */
  nearestFree(pos, maxRadius = 20) {
    const { cx, cz } = this.cellOf(pos);
    if (!this.isBlocked(cx, cz)) return this.worldOf(cx, cz);
    for (let r = 1; r <= maxRadius; r++) {
      let best = null, bestD = Infinity;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || this.isBlocked(cx + dx, cz + dz)) continue;
        const w = this.worldOf(cx + dx, cz + dz);
        const d = w.distanceToSquared(pos);
        if (d < bestD) { bestD = d; best = w; }
      }
      if (best) return best;
    }
    return null;
  }

  /**
   * A* from → to (world positions). Returns smoothed waypoints (Vector3[]), last one = `to`
   * (or the nearest free cell to it). Empty array if there's no path.
   */
  findPath(from, to, { maxIterations = 20000 } = {}) {
    const start = this.cellOf(from);
    let goalPos = to.clone ? to.clone().setY(0) : new THREE.Vector3(to.x, 0, to.z);
    let goal = this.cellOf(goalPos);
    if (this.isBlocked(goal.cx, goal.cz)) {
      const near = this.nearestFree(goalPos);
      if (!near) return [];
      goalPos = near;
      goal = this.cellOf(near);
    }
    if (this.isBlocked(start.cx, start.cz)) {
      const near = this.nearestFree(from);
      if (!near) return [];
      Object.assign(start, this.cellOf(near));
    }
    const cols = this.cols;
    const idx = (x, z) => z * cols + x;
    const startI = idx(start.cx, start.cz), goalI = idx(goal.cx, goal.cz);
    const g = new Float32Array(cols * this.rows).fill(Infinity);
    const came = new Int32Array(cols * this.rows).fill(-1);
    const closed = new Uint8Array(cols * this.rows);
    const h = (i) => { const x = i % cols, z = (i / cols) | 0; const dx = Math.abs(x - goal.cx), dz = Math.abs(z - goal.cz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const open = new MinHeap();
    g[startI] = 0;
    open.push(startI, h(startI));
    let iter = 0;
    while (open.size && iter++ < maxIterations) {
      const cur = open.pop();
      if (cur === goalI) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % cols, cz = (cur / cols) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (this.isBlocked(nx, nz)) continue;
        if (dx && dz && (this.isBlocked(cx + dx, cz) || this.isBlocked(cx, cz + dz))) continue; // no corner cutting
        const ni = idx(nx, nz);
        const cost = g[cur] + (dx && dz ? 1.414 : 1);
        if (cost < g[ni]) { g[ni] = cost; came[ni] = cur; open.push(ni, cost + h(ni)); }
      }
    }
    if (came[goalI] === -1 && goalI !== startI) return [];
    const cells = [];
    for (let i = goalI; i !== -1 && i !== startI; i = came[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map((i) => this.worldOf(i % cols, (i / cols) | 0));
    if (pts.length) pts[pts.length - 1] = goalPos; else pts.push(goalPos);
    return this._smooth(from, pts);
  }

  /** Remove waypoints that can be skipped with a straight line (string pulling). */
  _smooth(from, pts) {
    const out = [];
    let anchor = new THREE.Vector3(from.x, 0, from.z);
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineOfSight(anchor, pts[j])) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }

  /** true if a straight line between two world points crosses no blocked cell. */
  lineOfSight(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / (this.cellSize * 0.3));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      const { cx, cz } = this.cellOf(p);
      if (this.isBlocked(cx, cz)) return false;
    }
    return true;
  }

  /** Visualize blocked cells (debug). Returns the mesh; call again to refresh. */
  debugMesh(scene) {
    this._debug?.removeFromParent();
    const geo = new THREE.PlaneGeometry(this.cellSize * 0.9, this.cellSize * 0.9).rotateX(-Math.PI / 2);
    const count = this.blocked.reduce((a, b) => a + b, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.35 }), count);
    let k = 0;
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.blocked.length; i++) {
      if (!this.blocked[i]) continue;
      const p = this.worldOf(i % this.cols, (i / this.cols) | 0);
      mesh.setMatrixAt(k++, m.makeTranslation(p.x, 0.05, p.z));
    }
    scene.add(mesh);
    this._debug = mesh;
    return mesh;
  }
}

/**
 * Moves an Object3D along waypoints. Turns to face its direction of travel.
 *
 *   const mover = new PathFollower(unit.object, { speed: 4 });
 *   mover.goTo(nav.findPath(unit.position, target));
 *   // every frame:
 *   mover.update(dt);   mover.moving  // false once arrived
 */
export class PathFollower {
  constructor(object, { speed = 4, turnSpeed = 12, arriveDistance = 0.15 } = {}) {
    this.object = object;
    this.speed = speed;
    this.turnSpeed = turnSpeed;
    this.arriveDistance = arriveDistance;
    /** @type {THREE.Vector3[]} */
    this.path = [];
    this.onArrive = null;
  }

  get moving() { return this.path.length > 0; }
  get destination() { return this.path[this.path.length - 1] ?? null; }

  goTo(path, onArrive = null) { this.path = [...path]; this.onArrive = onArrive; }
  stop() { this.path = []; }

  update(dt) {
    const pos = this.object.position;
    let budget = this.speed * dt;
    while (this.path.length && budget > 0) {
      const wp = this.path[0];
      const dx = wp.x - pos.x, dz = wp.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d <= Math.max(this.arriveDistance, 1e-4)) { this.path.shift(); continue; }
      const step = Math.min(budget, d);
      pos.x += (dx / d) * step;
      pos.z += (dz / d) * step;
      budget -= step;
      const yaw = Math.atan2(dx, dz);
      let diff = yaw - this.object.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.object.rotation.y += diff * Math.min(1, this.turnSpeed * dt);
    }
    if (!this.path.length && this.onArrive) { const cb = this.onArrive; this.onArrive = null; cb(); }
  }
}

class MinHeap {
  constructor() { this.items = []; this.prios = []; }
  get size() { return this.items.length; }
  push(item, prio) {
    const a = this.items, p = this.prios;
    a.push(item); p.push(prio);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (p[parent] <= p[i]) break;
      [a[i], a[parent]] = [a[parent], a[i]]; [p[i], p[parent]] = [p[parent], p[i]];
      i = parent;
    }
  }
  pop() {
    const a = this.items, p = this.prios;
    const top = a[0];
    const lastI = a.pop(), lastP = p.pop();
    if (a.length) {
      a[0] = lastI; p[0] = lastP;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && p[l] < p[m]) m = l;
        if (r < a.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; [p[i], p[m]] = [p[m], p[i]];
        i = m;
      }
    }
    return top;
  }
}
