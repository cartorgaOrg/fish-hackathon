import * as THREE from 'three';
import { clamp } from '../utils.js';

/**
 * First-person mouse look (shooters, walking sims). Click the canvas to capture the mouse.
 *
 *   const fps = game.add(new FirstPersonCamera(game, body, { eyeHeight: 1.6 }));
 *   const dir = fps.toWorld(input.move());   // WASD relative to where you look
 *   fps.forward()                            // Vector3 the camera looks along (for shooting)
 *
 * `follow` is anything with a `.position` (a physics Body, an Object3D…). The camera sits at
 * follow.position + eyeHeight.
 */
export class FirstPersonCamera {
  constructor(game, follow, { eyeHeight = 1.6, sensitivity = 0.0022, yaw = 0, pitch = 0, fov = 75 } = {}) {
    this.game = game;
    this.camera = game.camera;
    this.follow = follow;
    this.eyeHeight = eyeHeight;
    this.sensitivity = sensitivity;
    this.yaw = yaw;
    this.pitch = pitch;
    this.alive = true;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.camera.rotation.order = 'YXZ';
    /** recoil / screen-kick in radians, decays automatically */
    this.kick = 0;
    game.renderer.domElement.addEventListener('click', () => { if (!game.paused) game.input.lockPointer(); });
  }

  /** WASD-style 2D input → world direction on the ground (Vector3). */
  toWorld({ x, y }) {
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    return fwd.multiplyScalar(y).add(right.multiplyScalar(x));
  }

  /** Normalized look direction (includes pitch). */
  forward() { this.camera.updateMatrixWorld(); return this.camera.getWorldDirection(new THREE.Vector3()); }

  update(dt) {
    const input = this.game.input;
    if (input.pointerLocked) {
      this.yaw -= input.mouse.dx * this.sensitivity;
      this.pitch = clamp(this.pitch - input.mouse.dy * this.sensitivity, -1.5, 1.5);
    }
    this.kick *= Math.exp(-12 * dt);
    this.camera.position.copy(this.follow.position);
    this.camera.position.y += this.eyeHeight;
    this.camera.rotation.set(this.pitch + this.kick, this.yaw, 0);
  }
}
