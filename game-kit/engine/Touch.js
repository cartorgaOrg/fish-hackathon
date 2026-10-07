/**
 * On-screen controls for phones and tablets: a virtual joystick, action buttons, and
 * drag-to-look. They feed straight into game.input, so game code doesn't change at all:
 * the joystick shows up in input.move(), buttons press real key codes.
 *
 *   new TouchControls(game, {
 *     joystick: true,                         // left thumb → input.move()
 *     look: true,                             // drag anywhere else → camera look (FollowCamera / FirstPersonCamera)
 *     buttons: [
 *       { label: 'Jump', key: 'Space' },
 *       { label: '⚔️', key: 'KeyF' },
 *       { label: 'Fire', mouse: 0 },          // acts as the left mouse button (held while touching)
 *       { label: 'Order', tapAs: 2 },         // next tap on the 3D view counts as a right-click (RTS)
 *       { label: '+', wheel: -1 },            // zoom in
 *     ],
 *   });
 *
 * They only appear on touch devices. Add ?touch to the URL to test them on desktop.
 * `TouchControls.enabled` tells you whether they're active (e.g. to change hint texts).
 */
export class TouchControls {
  static get enabled() {
    return /[?&]touch\b/.test(location.search) || matchMedia('(pointer: coarse)').matches;
  }

  /**
   * @param {import('./Game.js').Game} game
   * @param {{ joystick?: boolean, look?: boolean, lookSensitivity?: number,
   *           buttons?: { label: string, key?: string, mouse?: number, tapAs?: number, wheel?: number }[],
   *           force?: boolean }} [opts]
   */
  constructor(game, { joystick = true, look = false, lookSensitivity = 1.6, buttons = [], force = false } = {}) {
    this.game = game;
    this.active = force || TouchControls.enabled;
    if (!this.active) return;
    const input = game.input;
    injectCss();
    document.body.classList.add('fx-touch');
    this.root = document.createElement('div');
    this.root.className = 'fx-touch-root';
    document.body.appendChild(this.root);

    // ---- joystick
    if (joystick) {
      const base = div('fx-stick', this.root);
      const knob = div('fx-knob', base);
      let id = null, cx = 0, cy = 0;
      const R = 50;
      const move = (e) => {
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx *= R / len; dy *= R / len; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        input.virtual.x = dx / R;
        input.virtual.y = -dy / R;
      };
      base.addEventListener('pointerdown', (e) => {
        id = e.pointerId;
        const r = base.getBoundingClientRect();
        cx = r.left + r.width / 2; cy = r.top + r.height / 2;
        base.setPointerCapture(id);
        move(e);
        e.preventDefault();
      });
      base.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
      const end = (e) => {
        if (e.pointerId !== id) return;
        id = null;
        knob.style.transform = '';
        input.virtual.x = input.virtual.y = 0;
      };
      base.addEventListener('pointerup', end);
      base.addEventListener('pointercancel', end);
    }

    // ---- buttons (bottom-right, stacked)
    const pad = div('fx-tbuttons', this.root);
    for (const b of buttons) {
      const el = div('fx-tbtn', pad);
      el.textContent = b.label;
      const down = (e) => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('on');
        if (b.key) input.pressKey(b.key);
        if (b.mouse != null) input.pressMouse(b.mouse);
        if (b.wheel) input.wheel += b.wheel;
        if (b.tapAs != null) { input.tapAs = input.tapAs === b.tapAs ? null : b.tapAs; }
      };
      const up = () => {
        if (b.tapAs == null) el.classList.remove('on');
        if (b.key) input.releaseKey(b.key);
        if (b.mouse != null) input.releaseMouse(b.mouse);
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      if (b.tapAs != null) game.onUpdate(() => el.classList.toggle('on', input.tapAs === b.tapAs));
    }

    // ---- drag-to-look on the 3D view
    if (look) {
      input.touch.lookMode = true;
      const canvas = game.renderer.domElement;
      const fingers = new Map();
      canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch') return;
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        input.touch.look = true;
      });
      canvas.addEventListener('pointermove', (e) => {
        const f = fingers.get(e.pointerId);
        if (!f) return;
        input.mouse.dx += (e.clientX - f.x) * lookSensitivity;
        input.mouse.dy += (e.clientY - f.y) * lookSensitivity;
        f.x = e.clientX; f.y = e.clientY;
      });
      const end = (e) => { fingers.delete(e.pointerId); input.touch.look = fingers.size > 0; };
      addEventListener('pointerup', end);
      addEventListener('pointercancel', end);
    }
  }

  /** Hide/show (e.g. while a menu is open). */
  setVisible(v) { if (this.root) this.root.style.display = v ? '' : 'none'; }
}

function div(className, parent) {
  const d = document.createElement('div');
  d.className = className;
  parent.appendChild(d);
  return d;
}

let cssDone = false;
function injectCss() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
  .fx-touch canvas { touch-action: none; }
  .fx-touch .fx-controls { display: none; }               /* keyboard help is useless on phones */
  .fx-touch-root { position: fixed; inset: 0; pointer-events: none; z-index: 15; user-select: none; -webkit-user-select: none; }
  .fx-stick { position: absolute; left: max(24px, env(safe-area-inset-left)); bottom: max(24px, env(safe-area-inset-bottom)); width: 130px; height: 130px;
    border-radius: 50%; background: #ffffff1a; border: 2px solid #ffffff40; pointer-events: auto; touch-action: none; }
  .fx-knob { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
    background: #ffffff70; box-shadow: 0 2px 8px #0006; }
  .fx-tbuttons { position: absolute; right: max(20px, env(safe-area-inset-right)); bottom: max(24px, env(safe-area-inset-bottom));
    display: flex; flex-wrap: wrap-reverse; flex-direction: row-reverse; gap: 12px; max-width: 220px; justify-content: flex-start; }
  .fx-tbtn { pointer-events: auto; touch-action: none; min-width: 64px; height: 64px; padding: 0 10px; border-radius: 32px; display: flex;
    align-items: center; justify-content: center; font: 700 16px system-ui, sans-serif; color: #fff; background: #ffffff26;
    border: 2px solid #ffffff55; text-shadow: 0 1px 3px #000; box-sizing: border-box; }
  .fx-tbtn.on { background: #ffffff66; }
  `;
  document.head.appendChild(s);
}
