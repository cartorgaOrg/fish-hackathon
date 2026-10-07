import * as THREE from 'three';

/**
 * Quick coloured primitives for prototyping before you pick real models.
 * All of them cast/receive shadows and accept a position.
 *
 *   scene.add(box(2, 1, 2, '#c84', [0, 0.5, 0]));
 *   scene.add(sphere(0.5, 'gold', [3, 1, 0]));
 */
const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 });

function finish(mesh, pos) {
  mesh.castShadow = mesh.receiveShadow = true;
  if (pos) mesh.position.set(...pos);
  return mesh;
}

/** @param {[number,number,number]} [pos] */
export const box = (w = 1, h = 1, d = 1, color = '#cccccc', pos) => finish(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)), pos);
export const sphere = (r = 0.5, color = '#cccccc', pos) => finish(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat(color)), pos);
export const cylinder = (r = 0.5, h = 1, color = '#cccccc', pos) => finish(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat(color)), pos);
export const cone = (r = 0.5, h = 1, color = '#cccccc', pos) => finish(new THREE.Mesh(new THREE.ConeGeometry(r, h, 24), mat(color)), pos);
export const capsule = (r = 0.4, h = 1.8, color = '#cccccc', pos) => {
  const m = finish(new THREE.Mesh(new THREE.CapsuleGeometry(r, h - r * 2, 8, 16), mat(color)), pos);
  m.geometry.translate(0, h / 2, 0); // origin at the feet, like characters
  return m;
};
/** Flat plane lying on the ground. */
export const plane = (w = 10, d = 10, color = '#88aa66', pos) => {
  const m = finish(new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color)), pos);
  m.geometry.rotateX(-Math.PI / 2);
  return m;
};
