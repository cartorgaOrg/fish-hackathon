import * as THREE from 'three';
import { clamp, damp } from '../utils.js';

/**
 * Top-down strategy camera (RTS, city builders, tactics, top-down shooters).
 *
 *   game.add(new RTSCamera(game, { bounds: 50 }));
 *
 * Controls: WASD / arrows / screen edges pan, mouse wheel zooms, Q/E rotate,
 * middle-mouse drag pans.
 */
export class RTSCamera {
  /**
   * @param {import('../Game.js').Game} game
   * @param {object} [opts]
   * @param {THREE.Vector3} [opts.target]  point on the ground the camera looks at
   * @param {number} [opts.zoom=25]        distance from target
   * @param {number} [opts.minZoom=8]
   * @param {number} [opts.maxZoom=60]
   * @param {number} [opts.pitch=0.95]     tilt (radians, π/2 = straight down)
   * @param {number} [opts.yaw=0]
   * @param {number} [opts.bounds=Infinity] clamp target to ±bounds on X/Z
   * @param {boolean} [opts.edgePan=true]  pan when the mouse touches the screen edge
   * @param {boolean} [opts.keys=true]     pan with WASD / arrows
   */
  constructor(game, opts = {}) {
    this.game = game;
    this.camera = game.camera;
    Object.assign(this, {
      target: new THREE.Vector3(), zoom: 25, minZoom: 8, maxZoom: 60, pitch: 0.95, yaw: 0,
      bounds: Infinity, edgePan: true, keys: true, panSpeed: 1.2,
    }, opts);
    this._zoom = this.zoom;
    this.alive = true;
  }

  /** Jump the camera to look at a position. */
  focus(pos) { this.target.set(pos.x, 0, pos.z); }

  update(dt) {
    const { input } = this.game;
    const speed = this._zoom * this.panSpeed * dt;
    let x = 0, y = 0;
    if (this.keys) ({ x, y } = input.move());
    if (this.edgePan && document.hasFocus() && input.mouse.x > 0) {
      const el = this.game.renderer.domElement, m = 12;
      if (input.mouse.x < m) x = -1; else if (input.mouse.x > el.clientWidth - m) x = 1;
      if (input.mouse.y < m) y = 1; else if (input.mouse.y > el.clientHeight - m) y = -1;
    }
    if (input.mouseDown(1)) { x -= input.mouse.dx * 0.08; y += input.mouse.dy * 0.08; }
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    this.target.addScaledVector(fwd, y * speed).addScaledVector(right, x * speed);
    this.target.x = clamp(this.target.x, -this.bounds, this.bounds);
    this.target.z = clamp(this.target.z, -this.bounds, this.bounds);

    if (input.down('KeyQ')) this.yaw += dt * 1.5;
    if (input.down('KeyE')) this.yaw -= dt * 1.5;
    if (input.wheel) this.zoom = clamp(this.zoom * (1 + input.wheel * 0.12), this.minZoom, this.maxZoom);
    this._zoom = damp(this._zoom, this.zoom, 10, dt);

    const off = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    ).multiplyScalar(this._zoom);
    this.camera.position.copy(this.target).add(off);
    this.camera.lookAt(this.target);
  }
}
