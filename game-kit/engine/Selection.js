import * as THREE from 'three';

/**
 * RTS-style unit selection: click to select, drag a box to select many, shift to add.
 *
 *   const sel = new Selection(game, { filter: (e) => e.is('unit') && e.team === 'player' });
 *   sel.onChange = (units) => updatePanel(units);
 *   sel.selected   // Set<Entity>
 *
 * Each selected entity gets a ring under its feet. Selection listens to the LEFT mouse button;
 * use the RIGHT button for commands (see games/strategy).
 */
export class Selection {
  /**
   * @param {import('./Game.js').Game} game
   * @param {{ filter?: (e:any)=>boolean, ringColor?: THREE.ColorRepresentation, ringSize?: number }} [opts]
   */
  constructor(game, { filter = (e) => e.is('selectable'), ringColor = '#4dff88', ringSize = 0.8 } = {}) {
    this.game = game;
    this.filter = filter;
    /** @type {Set<any>} */
    this.selected = new Set();
    this.onChange = null;
    this.enabled = true;
    this._rings = new Map();
    this._ringGeo = new THREE.RingGeometry(ringSize * 0.85, ringSize, 32).rotateX(-Math.PI / 2);
    this._ringMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.9, depthWrite: false });
    this._box = game.ui.el('div');
    Object.assign(this._box.style, { border: '1px solid #7cf', background: '#7cf3', display: 'none' });
    this._start = null;
    this.alive = true;
  }

  update() {
    const { input } = this.game;
    if (!this.enabled) return;
    if (input.mousePressed(0) && !this._overUI()) this._start = { x: input.mouse.x, y: input.mouse.y };
    if (this._start && input.mouseDown(0)) {
      const { x, y } = input.mouse, s = this._start;
      Object.assign(this._box.style, {
        display: Math.hypot(x - s.x, y - s.y) > 6 ? 'block' : 'none',
        left: `${Math.min(x, s.x)}px`, top: `${Math.min(y, s.y)}px`,
        width: `${Math.abs(x - s.x)}px`, height: `${Math.abs(y - s.y)}px`,
      });
    }
    if (this._start && input.mouseReleased(0)) {
      const additive = input.anyDown('ShiftLeft', 'ShiftRight');
      const { x, y } = input.mouse, s = this._start;
      this._start = null;
      this._box.style.display = 'none';
      if (Math.hypot(x - s.x, y - s.y) > 6) this._selectRect(s, { x, y }, additive);
      else this._selectClick(additive);
    }
    // keep rings under feet, drop dead units
    for (const e of [...this.selected]) if (!e.alive) this.remove(e);
    for (const [e, ring] of this._rings) ring.position.set(e.position.x, e.position.y + 0.05, e.position.z);
  }

  set(list) {
    for (const e of [...this.selected]) if (!list.includes(e)) this.remove(e, false);
    for (const e of list) this.add(e, false);
    this.onChange?.([...this.selected]);
  }
  add(e, notify = true) {
    if (this.selected.has(e)) return;
    this.selected.add(e);
    const ring = new THREE.Mesh(this._ringGeo, this._ringMat);
    this.game.scene.add(ring);
    this._rings.set(e, ring);
    if (notify) this.onChange?.([...this.selected]);
  }
  remove(e, notify = true) {
    if (!this.selected.delete(e)) return;
    this._rings.get(e)?.removeFromParent();
    this._rings.delete(e);
    if (notify) this.onChange?.([...this.selected]);
  }
  clear() { this.set([]); }

  _candidates() { return [...this.game.entities].filter((e) => e.alive && this.filter(e)); }

  _selectClick(additive) {
    const hit = this.game.pickEntity(this._candidates());
    if (!hit) { if (!additive) this.clear(); return; }
    if (additive) this.selected.has(hit) ? this.remove(hit) : this.add(hit);
    else this.set([hit]);
  }

  _selectRect(a, b, additive) {
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x), minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    const el = this.game.renderer.domElement;
    const v = new THREE.Vector3();
    const inside = this._candidates().filter((e) => {
      v.copy(e.position).project(this.game.camera);
      const sx = (v.x * 0.5 + 0.5) * el.clientWidth, sy = (-v.y * 0.5 + 0.5) * el.clientHeight;
      return sx >= minX && sx <= maxX && sy >= minY && sy <= maxY;
    });
    this.set(additive ? [...new Set([...this.selected, ...inside])] : inside);
  }

  _overUI() {
    const { x, y } = this.game.input.mouse;
    const el = document.elementFromPoint(x, y);
    return el && el !== this.game.renderer.domElement && el.closest('.fx-buttons, .fx-btn, .fx-panel, .fx-dialog-wrap');
  }
}

