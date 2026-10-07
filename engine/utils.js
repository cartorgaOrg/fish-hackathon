// Small math + gameplay helpers. Everything here is a plain function: import what you need.
import * as THREE from 'three';

/** Random float in [min, max). */
export const rand = (min = 0, max = 1) => min + Math.random() * (max - min);
/** Random integer in [min, max] (inclusive). */
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
/** Random element of an array. */
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
/** true with the given probability (0..1). */
export const chance = (p) => Math.random() < p;

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Frame-rate independent smoothing. Use instead of `lerp(a, b, 0.1)` in update loops.
 * `lambda` ≈ how fast (higher = snappier, 5-15 is typical).
 */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Shortest signed difference between two angles (radians). */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
/** damp() for angles — turns the short way round. */
export const dampAngle = (a, b, lambda, dt) => a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));

/** Horizontal (XZ-plane) distance between two Vector3s. */
export const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Angle (for rotation.y) that makes an object at `from` face `to`. Models face +Z by default. */
export const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

/** Shorthand: v3(1,2,3) */
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/**
 * A reusable cooldown.
 *   const fire = cooldown(0.2);
 *   if (input.mouseDown(0) && fire.ready()) shoot();   // ready() also re-arms it
 */
export function cooldown(seconds) {
  let last = -Infinity;
  return {
    seconds,
    /** true if enough time passed; re-arms the cooldown when it returns true. */
    ready() {
      const now = performance.now() / 1000;
      if (now - last >= this.seconds) { last = now; return true; }
      return false;
    },
    /** 0..1 progress of the cooldown (1 = ready). Handy for UI. */
    progress() { return clamp((performance.now() / 1000 - last) / this.seconds, 0, 1); },
    reset() { last = -Infinity; },
  };
}

/** Tiny localStorage wrapper for high scores / save games. Never throws. */
export const storage = {
  save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  load(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
};
