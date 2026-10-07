import * as THREE from 'three';
import { Input } from './Input.js';
import { Assets } from './Assets.js';
import { Physics, entityOf } from './Physics.js';
import { UI } from './UI.js';
import { Audio } from './Audio.js';
import { Effects } from './Effects.js';

/**
 * The heart of every game: owns the renderer, scene, camera, game loop and all the systems.
 *
 *   const game = new Game();
 *   game.add(myEntity);                 // anything with update(dt) — Entities, cameras, controllers
 *   game.onUpdate((dt) => { ... });     // quick per-frame logic without making a class
 *   game.after(2, () => spawnBoss());   // timers that respect pause
 *   game.every(5, () => spawnWave());
 *   game.start();
 *
 * Systems (all on the game object):
 *   game.scene / camera / renderer   — three.js basics
 *   game.input    — keyboard, mouse, gamepad          (engine/Input.js)
 *   game.assets   — load glTF models                  (engine/Assets.js)
 *   game.physics  — AABB collisions + raycasts        (engine/Physics.js)
 *   game.ui       — HTML HUD, dialogs, damage numbers (engine/UI.js)
 *   game.audio    — synthesized + file sound effects  (engine/Audio.js)
 *   game.effects  — particles, flashes, screen shake  (engine/Effects.js)
 */
export class Game {
  /**
   * @param {object} [opts]
   * @param {HTMLElement} [opts.container=document.body]
   * @param {number} [opts.fov=60]
   * @param {boolean} [opts.shadows=true]
   * @param {number} [opts.gravity=-30]
   * @param {number|null} [opts.groundY=0]  infinite floor height for physics (null = none)
   * @param {boolean} [opts.antialias=true]
   * @param {boolean} [opts.stats=false]    show an FPS counter
   */
  constructor({ container = document.body, fov = 60, shadows = true, gravity = -30, groundY = 0, antialias = true, stats = false } = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { display: 'block', touchAction: 'none' });

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(fov, innerWidth / innerHeight, 0.1, 1000);
    this.camera.position.set(0, 10, 15);
    this.camera.lookAt(0, 0, 0);

    this.input = new Input(this.renderer.domElement);
    this.assets = new Assets();
    this.physics = new Physics({ gravity, groundY });
    this.ui = new UI(this);
    this.audio = new Audio();
    this.effects = new Effects(this);

    /** @type {Set<any>} everything with an update(dt) */
    this.entities = new Set();
    this._callbacks = [];
    this._timers = [];
    /** seconds of game time since start (stops while paused) */
    this.time = 0;
    /** set true to freeze updates (rendering continues) */
    this.paused = false;
    /** slow-motion / fast-forward multiplier */
    this.timeScale = 1;
    this.clock = new THREE.Clock();
    this._raycaster = new THREE.Raycaster();

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    if (stats) this._fps = this.ui.text('', { top: 4, right: 8 }, { size: 12 });
    // expose for poking around in the browser console: `game.findAll('enemy')`
    window.game = this;
  }

  // ------------------------------------------------------------------ entities

  /**
   * Add something to the game. Anything with `update(dt)` works. If it has an `.object`
   * (Entity, CharacterController) that object is added to the scene too. Returns what you passed.
   * @template T
   * @param {T} thing
   * @returns {T}
   */
  add(thing) {
    this.entities.add(thing);
    thing.game = this;
    if (thing.object && !thing.object.parent) this.scene.add(thing.object);
    thing.onAdded?.(this);
    return thing;
  }

  /** Remove an entity (also removes its object from the scene). Prefer entity.destroy(). */
  remove(thing) {
    if (!this.entities.delete(thing)) return;
    thing.alive = false;
    thing.object?.removeFromParent();
    thing.onRemoved?.(this);
  }

  /** First entity with this tag. */
  find(tag) {
    for (const e of this.entities) if (e.alive !== false && e.tags?.has(tag)) return e;
    return null;
  }

  /** All entities with this tag. */
  findAll(tag) {
    return [...this.entities].filter((e) => e.alive !== false && e.tags?.has(tag));
  }

  /** Entities with `tag` within `radius` of `pos` (XZ distance), nearest first. */
  findNear(pos, radius, tag) {
    return this.findAll(tag)
      .map((e) => [e, Math.hypot(e.position.x - pos.x, e.position.z - pos.z)])
      .filter(([, d]) => d <= radius)
      .sort((a, b) => a[1] - b[1])
      .map(([e]) => e);
  }

  // ------------------------------------------------------------------ time

  /** Run fn(dt) every frame. Returns a function that unsubscribes. */
  onUpdate(fn) {
    this._callbacks.push(fn);
    return () => { this._callbacks = this._callbacks.filter((f) => f !== fn); };
  }

  /** Call fn once after `seconds` of game time. Returns a cancel function. */
  after(seconds, fn) {
    const t = { at: this.time + seconds, fn };
    this._timers.push(t);
    return () => { t.cancelled = true; };
  }

  /** Call fn every `seconds` of game time. Returns a cancel function. */
  every(seconds, fn) {
    const t = { at: this.time + seconds, fn, repeat: seconds };
    this._timers.push(t);
    return () => { t.cancelled = true; };
  }

  // ------------------------------------------------------------------ picking

  /** A ray from the camera through the mouse cursor (or through screen centre if pointer-locked). */
  mouseRay() {
    const ndc = this.input.pointerLocked ? new THREE.Vector2(0, 0) : this.input.mouse.ndc;
    this._raycaster.setFromCamera(ndc, this.camera);
    return this._raycaster.ray;
  }

  /**
   * Where the mouse points on a horizontal plane (default y = 0). Great for click-to-move,
   * placing buildings, aiming in top-down games. Returns Vector3 or null.
   */
  mouseGround(y = 0) {
    const p = new THREE.Vector3();
    return this.mouseRay().intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
  }

  /**
   * Raycast from the mouse against objects. Returns the first three.js hit (with `.entity`
   * filled in if the mesh belongs to an Entity) or null.
   * @param {THREE.Object3D[]} [objects]  defaults to the whole scene
   */
  mousePick(objects = this.scene.children) {
    this.mouseRay();
    const hits = this._raycaster.intersectObjects(objects, true).filter((h) => h.object.visible && !h.object.userData.noPick);
    if (!hits.length) return null;
    return Object.assign(hits[0], { entity: entityOf(hits[0].object) });
  }

  /** The entity (from `candidates`) under the mouse, or null. */
  pickEntity(candidates) {
    const hit = this.mousePick(candidates.map((e) => e.object));
    return hit?.entity ?? null;
  }

  // ------------------------------------------------------------------ loading

  /**
   * Show a loading screen while preloading model URLs.
   *   await game.load(['/assets/kaykit-adventurers/Knight.glb', ...]);
   */
  async load(urls, title = 'Loading…') {
    const screen = this.ui.loading(title);
    try { await this.assets.preload(urls, (f) => screen.set(f)); } finally { screen.remove(); }
  }

  // ------------------------------------------------------------------ loop

  /** Start the game loop. */
  start() {
    this.clock.start();
    this.renderer.setAnimationLoop(() => this._frame());
    return this;
  }

  /** Stop the loop entirely (use `paused` to just freeze gameplay). */
  stop() { this.renderer.setAnimationLoop(null); }

  _frame() {
    const raw = Math.min(this.clock.getDelta(), 1 / 20); // clamp: tab switches shouldn't teleport things
    const dt = this.paused ? 0 : raw * this.timeScale;
    this.input._beginFrame();
    if (!this.paused) {
      this.time += dt;
      for (const t of this._timers) {
        if (t.cancelled || this.time < t.at) continue;
        t.fn();
        if (t.repeat) t.at += t.repeat; else t.cancelled = true;
      }
      this._timers = this._timers.filter((t) => !t.cancelled);
      this.physics.update();
      for (const e of [...this.entities]) if (e.alive !== false) (e._tick ? e._tick(dt) : e.update(dt));
      for (const fn of [...this._callbacks]) fn(dt);
    }
    this.effects.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.ui._update(this.camera);
    this.input._endFrame();
    if (this._fps) this._fps.set(`${Math.round(1 / Math.max(raw, 1e-3))} fps`);
  }
}
