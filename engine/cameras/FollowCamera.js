import * as THREE from 'three';
import { clamp, damp } from '../utils.js';

/**
 * Third-person camera that orbits and follows a target (RPGs, platformers, adventure games).
 *
 *   const cam = game.add(new FollowCamera(game, player.object, { distance: 8 }));
 *   // move the player relative to the camera:
 *   const dir = cam.toWorld(input.move());   // Vector3 on the ground plane
 *
 * Controls: hold right mouse (or left, if `dragButton: 0`) and drag to orbit, wheel to zoom.
 * With `pointerLock: true` the mouse always orbits (click to lock, Esc to release).
 */
export class FollowCamera {
  /**
   * @param {import('../Game.js').Game} game
   * @param {THREE.Object3D} target
   * @param {object} [opts]
   * @param {number} [opts.distance=8]
   * @param {number} [opts.minDistance=3]
   * @param {number} [opts.maxDistance=20]
   * @param {number} [opts.yaw=0]       horizontal angle (radians). 0 = camera sits on the +Z side, looking toward -Z
   * @param {number} [opts.pitch=0.45]  vertical angle (radians, 0 = level, π/2 = top-down)
   * @param {number} [opts.height=1.5]  look-at height above the target's origin
   * @param {number} [opts.smoothing=10] follow smoothing (higher = snappier, Infinity = rigid)
   * @param {boolean} [opts.orbit=true] allow mouse orbit
   * @param {number} [opts.dragButton=2] mouse button that orbits while held
   * @param {boolean} [opts.pointerLock=false]
   * @param {boolean} [opts.collide=true] pull in when a wall is between camera and target
   */
  constructor(game, target, opts = {}) {
    this.game = game;
    this.camera = game.camera;
    this.target = target;
    Object.assign(this, {
      distance: 8, minDistance: 3, maxDistance: 20, yaw: 0, pitch: 0.45, height: 1.5,
      smoothing: 10, orbit: true, dragButton: 2, pointerLock: false, collide: true,
      minPitch: -0.2, maxPitch: 1.4, sensitivity: 0.005,
    }, opts);
    this._focus = target.position.clone();
    this._dist = this.distance;
    this.alive = true;
    if (this.pointerLock) game.renderer.domElement.addEventListener('click', () => game.input.lockPointer());
  }

  /**
   * Convert a 2D input vector ({x, y} from input.move()) into a world direction on the XZ
   * plane, relative to where the camera is looking. Returns a Vector3 (length ≤ 1).
   */
  toWorld({ x, y }) {
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    return fwd.multiplyScalar(y).add(right.multiplyScalar(x));
  }

  update(dt) {
    const input = this.game.input;
    if (this.orbit && (this.pointerLock ? input.pointerLocked : input.mouseDown(this.dragButton))) {
      this.yaw -= input.mouse.dx * this.sensitivity;
      this.pitch = clamp(this.pitch + input.mouse.dy * this.sensitivity, this.minPitch, this.maxPitch);
    }
    if (input.wheel) this.distance = clamp(this.distance * (1 + input.wheel * 0.1), this.minDistance, this.maxDistance);

    const goal = this.target.position.clone();
    goal.y += this.height;
    if (this.smoothing === Infinity) this._focus.copy(goal);
    else this._focus.set(
      damp(this._focus.x, goal.x, this.smoothing, dt),
      damp(this._focus.y, goal.y, this.smoothing, dt),
      damp(this._focus.z, goal.z, this.smoothing, dt),
    );

    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    let dist = this.distance;
    if (this.collide) {
      const hit = this.game.physics.raycast(this._focus, offset, { maxDist: this.distance });
      if (hit) dist = Math.max(0.5, hit.distance - 0.3);
    }
    this._dist = dist < this._dist ? dist : damp(this._dist, dist, 4, dt);
    this.camera.position.copy(this._focus).addScaledVector(offset, this._dist);
    this.camera.lookAt(this._focus);
  }
}
