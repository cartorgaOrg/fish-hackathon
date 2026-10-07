import * as THREE from 'three';

/**
 * One-call lighting + sky + ground so a scene looks decent immediately.
 *
 *   const env = setupEnvironment(game, { ground: { size: 200, color: '#6aa84f' } });
 *   env.sun            // DirectionalLight — move it, change intensity…
 *   env.ground         // the ground Mesh (or null)
 *
 * Presets: 'day' (default), 'sunset', 'night', 'dungeon', 'space', 'underwater'.
 */
export const SKY_PRESETS = {
  day:        { top: '#4a90d9', bottom: '#cfe8ff', sun: 2.6, ambient: 1.1, sunColor: '#fff4e0', fog: '#cfe8ff' },
  sunset:     { top: '#2e3a6e', bottom: '#ff9e6b', sun: 2.0, ambient: 0.8, sunColor: '#ffb47a', fog: '#e8a07a' },
  night:      { top: '#05070f', bottom: '#1b2440', sun: 0.6, ambient: 0.35, sunColor: '#9fb4ff', fog: '#141a30' },
  dungeon:    { top: '#0b0a10', bottom: '#1e1a24', sun: 0.8, ambient: 0.5, sunColor: '#ffcc88', fog: '#100e14' },
  space:      { top: '#000000', bottom: '#0a0820', sun: 2.2, ambient: 0.4, sunColor: '#ffffff', fog: null },
  underwater: { top: '#04324a', bottom: '#0b7fa8', sun: 2.2, ambient: 2.2, sunColor: '#d8fbff', fog: '#0b6f94', groundLight: '#3a8fa8' },
};

/**
 * @param {import('./Game.js').Game} game
 * @param {object} [opts]
 * @param {keyof SKY_PRESETS} [opts.sky='day']
 * @param {false | { size?: number, color?: string, grid?: boolean }} [opts.ground]  pass false for no ground mesh
 * @param {false | { near?: number, far?: number }} [opts.fog]
 * @param {number} [opts.shadowArea=40]  half-size of the area that gets sharp shadows (follows the camera target)
 */
export function setupEnvironment(game, { sky = 'day', ground = {}, fog = {}, shadowArea = 40 } = {}) {
  const preset = SKY_PRESETS[sky] ?? SKY_PRESETS.day;
  const { scene } = game;

  scene.background = gradientTexture(preset.top, preset.bottom);
  if (fog && preset.fog) scene.fog = new THREE.Fog(preset.fog, fog.near ?? 60, fog.far ?? 220);

  const hemi = new THREE.HemisphereLight(preset.bottom, preset.groundLight ?? '#444433', preset.ambient);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(preset.sunColor, preset.sun);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera;
  s.left = s.bottom = -shadowArea;
  s.right = s.top = shadowArea;
  s.near = 1; s.far = 200;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // keep the shadow box centred on what the camera looks at
  const offset = sun.position.clone();
  game.onUpdate(() => {
    const look = new THREE.Vector3();
    game.camera.getWorldDirection(look);
    const focus = game.camera.position.clone().addScaledVector(look, 15);
    focus.y = 0;
    sun.target.position.copy(focus);
    sun.position.copy(focus).add(offset);
  });

  let groundMesh = null;
  if (ground) {
    const size = ground.size ?? 400;
    groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: ground.color ?? '#7cb45a', roughness: 1 }),
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    groundMesh.name = 'ground';
    scene.add(groundMesh);
    if (ground.grid) {
      const grid = new THREE.GridHelper(size, size, 0x000000, 0x000000);
      grid.material.opacity = 0.08;
      grid.material.transparent = true;
      grid.position.y = 0.01;
      scene.add(grid);
    }
  }
  return { sun, hemi, ground: groundMesh };
}

/** A vertical two-colour gradient usable as scene.background. */
export function gradientTexture(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, top);
  grd.addColorStop(1, bottom);
  g.fillStyle = grd;
  g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
