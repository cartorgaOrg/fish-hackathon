import * as THREE from 'three';

/**
 * HTML overlay on top of the canvas. HTML/CSS is the fastest way to make game UI, so this is
 * a thin helper — feel free to write your own DOM too (append to `ui.root`).
 *
 *   const score = ui.text('Score: 0', { top: 16, left: 16 });   score.set('Score: 10');
 *   const hp = ui.bar({ bottom: 24, left: 24 }, { color: '#e44' });  hp.set(0.5);   // 0..1
 *   ui.message('Level complete!', 2);                // big centred text for 2 s
 *   ui.floatingText(enemy.position, '-10', '#f44');  // damage number in the 3D world
 *   const label = ui.worldLabel(npc.object, 'Talk [E]', 2.2);  // follows a 3D object
 *   await ui.dialog('Old man', 'It is dangerous to go alone!', ['Thanks']);
 *   ui.crosshair();
 *   ui.buttons([{ label: 'Build House (50 wood)', onClick: build }], { bottom: 16, right: 16 });
 */
export class UI {
  constructor(game) {
    this.game = game;
    injectCss();
    this.root = document.createElement('div');
    this.root.className = 'fx-ui';
    document.body.appendChild(this.root);
    this._world = []; // elements that track 3D positions
  }

  /** Create an absolutely positioned element. `pos` = CSS like { top: 10, left: 10 } (numbers = px). */
  el(tag = 'div', { className = '', html = '', pos = {}, parent = this.root } = {}) {
    const e = document.createElement(tag);
    e.className = className;
    if (html) e.innerHTML = html;
    Object.assign(e.style, cssPos(pos));
    parent.appendChild(e);
    return e;
  }

  /** A text label. Returns { el, set(text), remove() }. */
  text(str, pos = { top: 16, left: 16 }, { size = 20, className = '' } = {}) {
    const e = this.el('div', { className: `fx-text ${className}`, pos });
    e.style.fontSize = size + 'px';
    e.textContent = str;
    return { el: e, set: (s) => { e.textContent = s; }, remove: () => e.remove() };
  }

  /** A progress/health bar. Returns { el, set(fraction 0..1, text?), remove() }. */
  bar(pos = { top: 16, left: 16 }, { width = 200, height = 16, color = '#4caf50', label = '' } = {}) {
    const e = this.el('div', { className: 'fx-bar', pos });
    e.style.width = width + 'px'; e.style.height = height + 'px';
    const fill = this.el('div', { className: 'fx-bar-fill', parent: e });
    fill.style.background = color;
    const txt = label ? this.el('span', { className: 'fx-bar-label', parent: e, html: label }) : null;
    return {
      el: e,
      set: (f, text) => { fill.style.width = `${Math.max(0, Math.min(1, f)) * 100}%`; if (txt && text != null) txt.textContent = text; },
      remove: () => e.remove(),
    };
  }

  /** Big centred message. duration in seconds (0 = stays until you call .remove()). */
  message(str, duration = 2, { size = 48, sub = '' } = {}) {
    const e = this.el('div', { className: 'fx-message', html: `<div style="font-size:${size}px">${str}</div>${sub ? `<div class="fx-sub">${sub}</div>` : ''}` });
    if (duration > 0) setTimeout(() => e.remove(), duration * 1000);
    return { el: e, remove: () => e.remove() };
  }

  /** Small notification in the top-right that fades out. */
  toast(str, duration = 2.5) {
    this._toasts ??= this.el('div', { className: 'fx-toasts' });
    const e = this.el('div', { className: 'fx-toast', html: str, parent: this._toasts });
    setTimeout(() => e.remove(), duration * 1000);
  }

  /** Text that pops up at a 3D position and floats away (damage numbers, +1 coin…). */
  floatingText(worldPos, str, color = '#fff', { size = 22, rise = 1.5, duration = 0.9 } = {}) {
    const e = this.el('div', { className: 'fx-float', html: str });
    e.style.color = color; e.style.fontSize = size + 'px';
    const pos = worldPos.clone();
    const start = performance.now();
    this._world.push({
      el: e, pos: () => pos,
      tick: () => {
        const t = (performance.now() - start) / 1000 / duration;
        pos.y += rise * 0.016;
        e.style.opacity = String(1 - t * t);
        if (t >= 1) { e.remove(); return false; }
        return true;
      },
    });
  }

  /**
   * A label that follows a 3D object (name tags, "Press E", health bars over units).
   * Returns { el, set(html), remove() }.
   */
  worldLabel(object, html, heightOffset = 2, className = 'fx-label') {
    const e = this.el('div', { className, html });
    const p = new THREE.Vector3();
    const item = { el: e, pos: () => object.getWorldPosition(p).setY(p.y + heightOffset), tick: () => e.isConnected };
    this._world.push(item);
    return { el: e, set: (h) => { e.innerHTML = h; }, remove: () => e.remove() };
  }

  /** A small health bar floating over a 3D object. Returns { set(fraction), remove() }. */
  worldBar(object, heightOffset = 2.2, color = '#e33') {
    const label = this.worldLabel(object, `<div class="fx-wbar"><div style="background:${color}"></div></div>`, heightOffset, 'fx-label fx-nopad');
    const fill = label.el.querySelector('.fx-wbar > div');
    return { el: label.el, set: (f) => { fill.style.width = `${Math.max(0, Math.min(1, f)) * 100}%`; }, remove: label.remove };
  }

  /**
   * Modal dialog. Resolves with the index of the clicked choice (or number key 1-9).
   * Pauses the game while open.
   *   const i = await ui.dialog('Merchant', 'Buy a potion for 10 gold?', ['Yes', 'No']);
   */
  dialog(title, body, choices = ['OK']) {
    const wasPaused = this.game.paused;
    this.game.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    return new Promise((resolve) => {
      const box = this.el('div', { className: 'fx-dialog-wrap' });
      const panel = this.el('div', { className: 'fx-dialog', parent: box, html: `<h3>${title}</h3><p>${body}</p>` });
      const row = this.el('div', { className: 'fx-row', parent: panel });
      const close = (i) => { box.remove(); removeEventListener('keydown', onKey); this.game.paused = wasPaused; resolve(i); };
      choices.forEach((c, i) => {
        const b = this.el('button', { className: 'fx-btn', parent: row, html: `${choices.length > 1 ? `<small>${i + 1}</small> ` : ''}${c}` });
        b.onclick = () => close(i);
      });
      const onKey = (e) => {
        const n = Number(e.key) - 1;
        if (n >= 0 && n < choices.length) close(n);
        else if (choices.length === 1 && ['Enter', 'Space', 'KeyE', 'Escape'].includes(e.code)) close(0);
      };
      setTimeout(() => addEventListener('keydown', onKey), 150);
    });
  }

  /** A row/column of buttons. items: [{ label, onClick, key?, disabled? }]. Returns { el, update(items), remove() }. */
  buttons(items, pos = { bottom: 16, left: '50%' }, { vertical = false } = {}) {
    const e = this.el('div', { className: `fx-buttons ${vertical ? 'fx-vertical' : ''}`, pos });
    if (pos.left === '50%') e.style.transform = 'translateX(-50%)';
    const render = (list) => {
      e.innerHTML = '';
      for (const it of list) {
        const b = this.el('button', { className: 'fx-btn', parent: e, html: it.key ? `<small>${it.key}</small> ${it.label}` : it.label });
        b.disabled = !!it.disabled;
        b.onclick = (ev) => { ev.stopPropagation(); it.onClick?.(); };
      }
    };
    render(items);
    return { el: e, update: render, remove: () => e.remove() };
  }

  /** A "+" in the middle of the screen. */
  crosshair() { return this.el('div', { className: 'fx-crosshair' }); }

  /** Full-screen loading overlay. Returns { set(fraction), remove() }. */
  loading(title = 'Loading…') {
    const e = this.el('div', { className: 'fx-loading', html: `<div>${title}</div><div class="fx-bar" style="width:300px;height:10px;position:relative"><div class="fx-bar-fill" style="width:0"></div></div>` });
    const fill = e.querySelector('.fx-bar-fill');
    return { set: (f) => { fill.style.width = `${f * 100}%`; }, remove: () => e.remove() };
  }

  /** A help panel listing the controls; toggles with H. */
  controls(lines) {
    const e = this.el('div', { className: 'fx-controls', html: lines.map((l) => `<div>${l}</div>`).join('') + '<div class="fx-dim">H — hide/show help</div>' });
    addEventListener('keydown', (ev) => { if (ev.code === 'KeyH') e.classList.toggle('fx-hidden'); });
    return e;
  }

  /** @internal positions world-anchored elements; called by Game after rendering. */
  _update(camera) {
    const w = innerWidth, h = innerHeight, v = new THREE.Vector3();
    this._world = this._world.filter((it) => {
      if (!it.tick()) return false;
      v.copy(it.pos()).project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      it.el.style.display = visible ? '' : 'none';
      it.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
      return true;
    });
  }
}

function cssPos(pos) {
  const out = {};
  for (const [k, v] of Object.entries(pos)) out[k] = typeof v === 'number' ? `${v}px` : v;
  return out;
}

let cssInjected = false;
function injectCss() {
  if (cssInjected) return;
  cssInjected = true;
  const s = document.createElement('style');
  s.textContent = `
  .fx-ui { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #fff; user-select: none; z-index: 10; overflow: hidden; }
  .fx-ui > * { position: absolute; }
  .fx-text { font-weight: 700; text-shadow: 0 2px 4px #000a; white-space: pre; }
  .fx-bar { background: #0008; border: 2px solid #fff6; border-radius: 6px; overflow: hidden; }
  .fx-bar-fill { height: 100%; width: 100%; background: #4caf50; transition: width .15s; }
  .fx-bar-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; text-shadow: 0 1px 2px #000; }
  .fx-message { top: 40%; left: 50%; transform: translate(-50%, -50%); text-align: center; font-weight: 900; text-shadow: 0 4px 12px #000c; animation: fx-pop .3s ease-out; }
  .fx-sub { font-size: 20px; font-weight: 600; margin-top: 8px; opacity: .9 }
  @keyframes fx-pop { from { transform: translate(-50%, -50%) scale(.6); opacity: 0 } }
  .fx-toasts { top: 16px; right: 16px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
  .fx-toast { position: static; background: #000a; padding: 8px 14px; border-radius: 8px; font-weight: 600; animation: fx-fade 2.5s forwards; }
  @keyframes fx-fade { 0% { opacity: 0; transform: translateX(20px) } 10%, 80% { opacity: 1; transform: none } 100% { opacity: 0 } }
  .fx-float { top: 0; left: 0; font-weight: 900; text-shadow: 0 2px 3px #000; white-space: nowrap; }
  .fx-label { top: 0; left: 0; background: #000a; padding: 2px 8px; border-radius: 6px; font-size: 13px; font-weight: 600; white-space: nowrap; }
  .fx-nopad { padding: 0; background: none; }
  .fx-wbar { width: 50px; height: 6px; background: #000a; border-radius: 3px; overflow: hidden; border: 1px solid #0008; }
  .fx-wbar > div { height: 100%; width: 100%; }
  .fx-dialog-wrap { inset: 0; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 8vh; pointer-events: auto; background: #0004; }
  .fx-dialog { background: #1d1f2bee; border: 2px solid #fff3; border-radius: 12px; padding: 18px 24px; max-width: 560px; box-shadow: 0 10px 40px #000a; }
  .fx-dialog h3 { margin: 0 0 8px; color: #ffd76a; } .fx-dialog p { margin: 0 0 16px; line-height: 1.5; font-size: 17px; }
  .fx-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .fx-buttons { display: flex; gap: 8px; pointer-events: auto; } .fx-vertical { flex-direction: column; }
  .fx-btn { pointer-events: auto; font: inherit; font-size: 14px; font-weight: 700; color: #fff; background: #2c3e66; border: 2px solid #fff4; border-radius: 8px; padding: 8px 14px; cursor: pointer; }
  .fx-btn:hover:not(:disabled) { background: #3d5591; } .fx-btn:disabled { opacity: .45; cursor: default; }
  .fx-btn small { opacity: .6; font-size: 11px; border: 1px solid #fff6; border-radius: 3px; padding: 0 4px; margin-right: 4px; }
  .fx-crosshair { top: 50%; left: 50%; width: 22px; height: 22px; transform: translate(-50%, -50%);
    background: linear-gradient(#fff,#fff) center/2px 100% no-repeat, linear-gradient(#fff,#fff) center/100% 2px no-repeat; filter: drop-shadow(0 0 2px #000); opacity: .85 }
  .fx-loading { inset: 0; background: #12141c; display: flex; flex-direction: column; gap: 16px; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
  .fx-controls { bottom: 16px; left: 16px; background: #0009; padding: 10px 14px; border-radius: 8px; font-size: 13px; line-height: 1.6; }
  .fx-dim { opacity: .55 } .fx-hidden { display: none }
  .fx-panel { background: #000a; padding: 10px 14px; border-radius: 8px; font-weight: 600; }
  `;
  document.head.appendChild(s);
}
