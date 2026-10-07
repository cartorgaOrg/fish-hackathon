import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Site root, worked out from where this file is served. In dev that's "/", in a build it's
// wherever dist/ is hosted (itch.io, GitHub Pages sub-folders…). It lets games use
// simple "/assets/…" paths that still work after `npm run build`.
// In dev the site root is simply "/". In a build the engine lives in dist/assets/*.js, so the
// root is one folder up from this file. (import.meta.url is kept in a variable so Vite
// doesn't rewrite the `new URL()` call.)
const here = import.meta.url;
const ROOT = import.meta.env?.DEV ? new URL('/', location.href) : new URL('../', here);

// Optional CDN: `npm run build:cdn` sets VITE_ASSET_BASE (see .env.cdn), so "/assets/…" is
// loaded from e.g. https://cdn.manogames.com/fishathon-kit/v1/… instead of shipping 95 MB in dist/.
const CDN = (import.meta.env?.VITE_ASSET_BASE ?? '').replace(/\/$/, '');

/** Turn "/assets/x.glb" into a URL that works in dev, in a deployed build, and from the CDN. */
export function assetUrl(path) {
  if (CDN && path.startsWith('/assets/')) return CDN + path.slice('/assets'.length);
  return path.startsWith('/') ? new URL('.' + path, ROOT).href : path;
}

/**
 * Loads .glb / .gltf models once and hands out cheap copies.
 *
 *   const knight = await assets.model('/assets/kaykit-adventurers/Knight.glb', { height: 2 });
 *   scene.add(knight);
 *   knight.animations   // AnimationClip[] — pass the model to `new Animator(knight)`
 *
 * Browse every available model + animation name at /assets.html or in docs/ASSET_LIST.md.
 */
export class Assets {
  constructor() {
    this.loader = new GLTFLoader();
    /** @type {Map<string, Promise<import('three/addons/loaders/GLTFLoader.js').GLTF>>} */
    this.cache = new Map();
  }

  /** Load (and cache) the raw glTF. Most of the time you want `model()` instead. */
  load(url) {
    if (!this.cache.has(url)) {
      this.cache.set(url, this.loader.loadAsync(assetUrl(url)).catch((err) => {
        this.cache.delete(url);
        throw new Error(`Could not load "${url}" — check the path in /assets.html (${err.message ?? err})`);
      }));
    }
    return this.cache.get(url);
  }

  /**
   * Load many models up front (e.g. behind a loading screen).
   * @param {string[]} urls
   * @param {(fraction:number)=>void} [onProgress]
   */
  async preload(urls, onProgress) {
    let done = 0;
    await Promise.all(urls.map((u) => this.load(u).then(() => onProgress?.(++done / urls.length))));
  }

  /**
   * A fresh, independent copy of a model (safe to animate separately).
   * @param {string} url
   * @param {object} [opts]
   * @param {number} [opts.scale]     uniform scale
   * @param {number} [opts.height]    scale so the model is this tall (world units). Overrides `scale`.
   * @param {boolean} [opts.shadows=true] cast + receive shadows
   * @param {boolean} [opts.center=false] center on X/Z and put the bottom at y=0
   * @returns {Promise<THREE.Object3D & { animations: THREE.AnimationClip[] }>}
   */
  async model(url, { scale, height, shadows = true, center = false } = {}) {
    const gltf = await this.load(url);
    const obj = SkeletonUtils.clone(gltf.scene);
    obj.animations = gltf.animations;
    obj.name ||= url.split('/').pop().replace(/\.(glb|gltf)$/, '');
    if (shadows) setShadows(obj, true, true);
    if (height) fitHeight(obj, height);
    else if (scale) obj.scale.setScalar(scale);
    if (center) centerOnGround(obj);
    return obj;
  }
}

/** Turn shadow casting / receiving on for every mesh inside obj. */
export function setShadows(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

/**
 * World-space bounding box of an object. Unlike `new Box3().setFromObject()` this is correct
 * for skinned (animated) models whose bones haven't been rendered yet.
 */
export function getBounds(obj) {
  obj.updateWorldMatrix(true, false);
  obj.updateMatrixWorld(true); // (this variant also refreshes SkinnedMesh bind matrices)
  obj.traverse((o) => { if (o.isSkinnedMesh) o.boundingBox = null; });
  return new THREE.Box3().setFromObject(obj);
}

/** World-space size of an object (Vector3). */
export function getSize(obj) {
  return getBounds(obj).getSize(new THREE.Vector3());
}

/** Uniformly scale obj so its height is `h`. */
export function fitHeight(obj, h) {
  obj.scale.setScalar(1);
  const size = getSize(obj);
  if (size.y > 0 && Number.isFinite(size.y)) obj.scale.setScalar(h / size.y);
  return obj;
}

/** Uniformly scale obj so its largest dimension is `s`. */
export function fitSize(obj, s) {
  obj.scale.setScalar(1);
  const size = getSize(obj);
  const m = Math.max(size.x, size.y, size.z);
  if (m > 0 && Number.isFinite(m)) obj.scale.setScalar(s / m);
  return obj;
}

/** Shift the object's children so it is centered on X/Z with its bottom at y = 0. */
export function centerOnGround(obj) {
  const box = getBounds(obj);
  const c = box.getCenter(new THREE.Vector3());
  const offset = new THREE.Vector3(c.x - obj.position.x, box.min.y - obj.position.y, c.z - obj.position.z);
  offset.divide(obj.scale);
  for (const child of obj.children) child.position.sub(offset);
  return obj;
}

/** Find a node (bone, mesh, group) by exact name inside a model. */
export function findNode(obj, name) {
  // GLTFLoader strips characters like "." from node names ("handslot.r" → "handslotr"), so try both
  return obj.getObjectByName(name) ?? obj.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name)) ?? null;
}

/**
 * Parent `child` to a named bone/node, e.g. put a sword in a KayKit hand:
 *   attach(knight, 'handslot.r', await assets.model('/assets/kaykit-adventurers/sword_1handed.gltf'));
 * (KayKit rigs: 'handslot.r', 'handslot.l', 'head'. Quaternius rigs: look for 'Fist.R' / 'Hand.R' in /assets.html.)
 */
export function attach(obj, nodeName, child) {
  const node = findNode(obj, nodeName);
  if (!node) throw new Error(`attach(): no node named "${nodeName}" in ${obj.name}`);
  node.add(child);
  return child;
}

/**
 * Show/hide named parts of a model. KayKit characters come with every weapon/hat visible —
 * use this to pick a loadout:
 *   setVisible(knight, { '2H_Sword': false, Round_Shield: false, Spike_Shield: false });
 */
export function setVisible(obj, map) {
  for (const [name, visible] of Object.entries(map)) {
    const node = findNode(obj, name);
    if (node) node.visible = visible;
  }
  return obj;
}

/** Tint every material of a model (clones materials so other copies are unaffected). */
export function tint(obj, color, amount = 0.5) {
  const c = new THREE.Color(color);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    for (const m of [o.material].flat()) m.color?.lerp(c, amount);
  });
  return obj;
}
