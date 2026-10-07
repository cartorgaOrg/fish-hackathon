import * as THREE from 'three';
import { rand } from './utils.js';

/**
 * Juice! Cheap particle bursts, hit flashes, tracers and screen shake.
 *
 *   effects.burst(pos, { color: '#ffcc00', count: 20 });   // coin sparkle / explosion debris
 *   effects.flash(enemy.object);                          // flash white when hit
 *   effects.tracer(gunTip, hitPoint);                     // bullet line
 *   effects.shake(0.3);                                   // camera shake (0..1)
 *   effects.ring(pos, { color: '#7cf' });                 // expanding ring (click marker, shockwave)
 */
export class Effects {
  constructor(game) {
    this.game = game;
    this.particles = [];
    this._geo = new THREE.BoxGeometry(1, 1, 1);
    this._shake = 0;
  }

  /**
   * @param {THREE.Vector3} pos
   * @param {{ color?: THREE.ColorRepresentation, count?: number, speed?: number, size?: number, life?: number, gravity?: number, up?: number }} [o]
   */
  burst(pos, { color = '#ffffff', count = 14, speed = 5, size = 0.15, life = 0.7, gravity = -15, up = 3 } = {}) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this._geo, mat);
      m.position.copy(pos);
      m.scale.setScalar(size * rand(0.6, 1.4));
      m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1));
      v.y += up;
      this.game.scene.add(m);
      this.particles.push({ m, v, life, max: life, gravity, size: m.scale.x, mat });
    }
  }

  /** Expanding flat ring on the ground. */
  ring(pos, { color = '#ffffff', size = 1.5, life = 0.4 } = {}) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos).setY(pos.y + 0.05);
    this.game.scene.add(m);
    this.particles.push({ m, life, max: life, ring: size, mat });
  }

  /** A short-lived line from a to b (bullets, lasers). */
  tracer(a, b, { color = '#ffee88', life = 0.06 } = {}) {
    const mat = new THREE.LineBasicMaterial({ color, transparent: true });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat);
    this.game.scene.add(line);
    this.particles.push({ m: line, life, max: life, mat });
  }

  /** Flash every mesh of an object (default white) for `duration` seconds. */
  flash(object, { color = '#ffffff', duration = 0.1 } = {}) {
    object.traverse((o) => {
      if (!o.isMesh) return;
      const mats = [o.material].flat();
      if (!o.userData._flashMats) {
        o.userData._flashMats = mats.map((m) => m.clone());
        o.material = Array.isArray(o.material) ? o.userData._flashMats : o.userData._flashMats[0];
      }
      for (const m of o.userData._flashMats) {
        if (!m.emissive) continue;
        m.emissive.set(color);
        clearTimeout(m.userData.t);
        m.userData.t = setTimeout(() => m.emissive.set(0x000000), duration * 1000);
      }
    });
  }

  /** Shake the camera. amount ~0.1 (light) … 1 (huge). */
  shake(amount = 0.3) { this._shake = Math.max(this._shake, amount); }

  /** @internal called by Game every frame (after the camera has been positioned). */
  update(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      const t = 1 - p.life / p.max;
      if (p.v) {
        p.v.y += p.gravity * dt;
        p.m.position.addScaledVector(p.v, dt);
        p.m.rotation.x += dt * 5;
        p.m.scale.setScalar(p.size * (1 - t));
      } else if (p.ring) {
        p.m.scale.setScalar(0.2 + t * p.ring);
      }
      p.mat.opacity = 1 - t;
      if (p.life <= 0) p.m.removeFromParent();
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this._shake > 0) {
      const s = this._shake * this._shake * 0.4;
      this.game.camera.position.add(new THREE.Vector3(rand(-s, s), rand(-s, s), rand(-s, s)));
      this._shake = Math.max(0, this._shake - dt * 1.5);
    }
  }
}
