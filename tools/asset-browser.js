// The asset browser page (/assets.html): preview every model, play its animations, copy the code.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Assets, Animator, getSize, getBounds, assetUrl } from '@engine';

const main = document.querySelector('main');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
main.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a2e40');
scene.add(new THREE.HemisphereLight('#ffffff', '#445', 1.4));
const sun = new THREE.DirectionalLight('#fff', 2.2);
sun.position.set(5, 10, 7);
scene.add(sun);
const grid = new THREE.GridHelper(20, 20, 0x8899bb, 0x445066);
scene.add(grid);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 500);
camera.position.set(4, 3, 6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

function resize() {
  const { clientWidth: w, clientHeight: h } = main;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const assets = new Assets();
let current = null, animator = null;
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  animator?.update(dt);
  controls.update();
  renderer.render(scene, camera);
});

const $ = (s) => document.querySelector(s);
const catalog = await (await fetch(assetUrl('/assets/catalog.json'))).json();

function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const animOnly = $('#animOnly').checked;
  const list = $('#list');
  list.innerHTML = '';
  for (const pack of catalog) {
    const models = pack.models.filter((m) =>
      (!animOnly || m.animations.length) &&
      (!q || m.name.toLowerCase().includes(q) || pack.id.includes(q) || m.animations.some((a) => a.toLowerCase().includes(q))));
    if (!models.length) continue;
    const h = document.createElement('div');
    h.className = 'pack';
    h.innerHTML = `${pack.name} <small>(${models.length})</small>`;
    h.title = pack.notes;
    list.appendChild(h);
    for (const m of models) {
      const it = document.createElement('div');
      it.className = 'item';
      it.dataset.url = m.url;
      it.innerHTML = `${m.name}${m.animations.length ? `<span>▶ ${m.animations.length}</span>` : ''}`;
      it.onclick = () => show(m, pack);
      list.appendChild(it);
    }
  }
}
$('#search').oninput = renderList;
$('#animOnly').onchange = renderList;
renderList();

async function show(m, pack) {
  document.querySelectorAll('.item.on').forEach((e) => e.classList.remove('on'));
  document.querySelector(`.item[data-url="${CSS.escape(m.url)}"]`)?.classList.add('on');
  location.hash = m.url;
  $('#title').textContent = m.name;
  $('#meta').textContent = 'loading…';
  if (current) scene.remove(current);
  animator = null;
  const model = await assets.model(m.url);
  current = model;
  scene.add(model);
  const size = getSize(model);
  const box = getBounds(model);
  const fit = Math.max(size.x, size.y, size.z) || 1;
  controls.target.copy(box.getCenter(new THREE.Vector3()));
  camera.position.copy(controls.target).add(new THREE.Vector3(1, 0.5, 1.4).multiplyScalar(fit * 1.6));
  grid.scale.setScalar(Math.max(1, Math.ceil(fit / 10)));
  $('#meta').textContent = `${pack.name} · size ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} (w×h×d) · ${pack.license}`;

  const isChar = m.animations.length > 0;
  const hidden = new Set();
  const idle = isChar ? (new Animator(model).find(['Idle', 'Swimming_Normal', 'Flying', 'Walk']) ?? m.animations[0]) : null;
  const updateCode = () => {
    const lines = [`const model = await game.assets.model('${m.url}');`];
    if (hidden.size) lines.push(`setVisible(model, { ${[...hidden].map((n) => `${/^[A-Za-z_$][\w$]*$/.test(n) ? n : `'${n}'`}: false`).join(', ')} });`);
    if (isChar) lines.push('const anim = new Animator(model);', `anim.play('${shortName(idle)}');   // remember: anim.update(dt) every frame`);
    else lines.push('model.position.set(0, 0, 0);', 'game.scene.add(model);');
    $('#code').textContent = lines.join('\n');
  };
  updateCode();

  // parts: named meshes you can hide (e.g. KayKit weapons/hats) — handy for picking a loadout
  const parts = $('#parts');
  parts.innerHTML = '';
  const meshes = [];
  model.traverse((o) => { if (o.isMesh && o.name) meshes.push(o); });
  // group multi-material pieces under their parent name (Quaternius "Body_1, Body_2…")
  const named = [...new Map(meshes.map((o) => {
    const node = /_\d+$/.test(o.name) && o.parent?.name && o.parent !== model ? o.parent : o;
    return [node.name, node];
  })).values()];
  if (named.length > 1) {
    parts.innerHTML = '<b>Parts</b>';
    for (const node of named) {
      const b = document.createElement('button');
      b.textContent = node.name;
      b.onclick = () => {
        node.visible = !node.visible;
        b.classList.toggle('off', !node.visible);
        node.visible ? hidden.delete(node.name) : hidden.add(node.name);
        updateCode();
      };
      parts.appendChild(b);
    }
  }

  const box2 = $('#anims');
  box2.innerHTML = '';
  if (isChar) {
    box2.innerHTML = '<b>Animations</b>';
    animator = new Animator(model);
    const buttons = m.animations.map((a) => {
      const b = document.createElement('button');
      b.textContent = shortName(a);
      b.title = a;
      b.onclick = () => { animator.play(a, { restart: true }); buttons.forEach((x) => x.classList.toggle('on', x === b)); };
      box2.appendChild(b);
      return b;
    });
    buttons[m.animations.indexOf(idle)]?.click();
  }
}
const shortName = (a) => a.replace(/^.*\|/, '');

$('#code').onclick = async () => {
  await navigator.clipboard?.writeText($('#code').textContent);
  $('#copied').style.opacity = 1;
  setTimeout(() => ($('#copied').style.opacity = 0), 900);
};

// deep link: /assets.html#/assets/kaykit-adventurers/Knight.glb
const fromHash = decodeURIComponent(location.hash.slice(1));
for (const p of catalog) for (const m of p.models) if (m.url === fromHash) show(m, p);
