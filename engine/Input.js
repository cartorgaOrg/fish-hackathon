import * as THREE from 'three';

/**
 * Keyboard, mouse and gamepad in one place. Poll it inside update():
 *
 *   input.down('KeyW')        // held this frame
 *   input.pressed('Space')    // went down this frame (one-shot)
 *   input.released('KeyE')    // went up this frame
 *   input.move()              // {x, y} from WASD / arrows / left stick, length ≤ 1
 *   input.mouse.ndc           // mouse in -1..1 (for raycasting)
 *   input.mouseDown(0)        // 0 = left, 1 = middle, 2 = right
 *   input.mousePressed(2)
 *   input.mouse.dx / dy       // movement this frame (works with pointer lock)
 *   input.wheel               // scroll delta this frame
 *
 * Key names are KeyboardEvent.code values: 'KeyA'…'KeyZ', 'Digit1', 'Space', 'ShiftLeft',
 * 'ArrowUp', 'Escape', 'Enter', 'Tab'… (layout independent, so WASD works on AZERTY too).
 */
export class Input {
  constructor(element) {
    this.element = element;
    this._down = new Set();
    this._pressed = new Set();
    this._released = new Set();
    this._mouseDown = new Set();
    this._mousePressed = new Set();
    this._mouseReleased = new Set();
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, ndc: new THREE.Vector2() };
    this.wheel = 0;
    this.gamepad = null;
    this._padPrev = [];

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      // don't steal keys from text inputs in your UI
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this._down.add(e.code);
      this._pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this._down.delete(e.code); this._released.add(e.code); });
    addEventListener('blur', () => { this._down.clear(); this._mouseDown.clear(); });

    element.addEventListener('pointerdown', (e) => { this._mouseDown.add(e.button); this._mousePressed.add(e.button); });
    addEventListener('pointerup', (e) => { this._mouseDown.delete(e.button); this._mouseReleased.add(e.button); });
    addEventListener('pointermove', (e) => {
      const r = element.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.ndc.set((this.mouse.x / r.width) * 2 - 1, -(this.mouse.y / r.height) * 2 + 1);
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    element.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    element.addEventListener('contextmenu', (e) => e.preventDefault()); // right-click is for gameplay
  }

  // (a press + release inside one frame still counts as "down" for that frame)
  down(code) { return this._down.has(code) || this._pressed.has(code); }
  pressed(code) { return this._pressed.has(code); }
  released(code) { return this._released.has(code); }
  /** true if any of the codes is held. */
  anyDown(...codes) { return codes.some((c) => this._down.has(c)); }
  anyPressed(...codes) { return codes.some((c) => this._pressed.has(c)); }

  mouseDown(button = 0) { return this._mouseDown.has(button) || this._mousePressed.has(button); }
  mousePressed(button = 0) { return this._mousePressed.has(button); }
  mouseReleased(button = 0) { return this._mouseReleased.has(button); }

  /** -1, 0 or 1 from two keys. */
  axis(negative, positive) { return (this.down(positive) ? 1 : 0) - (this.down(negative) ? 1 : 0); }

  /**
   * Movement vector from WASD + arrow keys + gamepad left stick.
   * x: right is +1, y: forward (W / up) is +1. Length is at most 1.
   */
  move() {
    let x = this.axis('KeyA', 'KeyD') + this.axis('ArrowLeft', 'ArrowRight');
    let y = this.axis('KeyS', 'KeyW') + this.axis('ArrowDown', 'ArrowUp');
    if (this.gamepad) {
      const [gx, gy] = this.gamepad.axes;
      if (Math.hypot(gx, gy) > 0.2) { x += gx; y -= gy; }
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  /** Gamepad button (standard mapping: 0 = A, 1 = B, 2 = X, 3 = Y, 9 = Start). */
  padDown(i) { return !!this.gamepad?.buttons[i]?.pressed; }
  padPressed(i) { return this.padDown(i) && !this._padPrev[i]; }

  /** Lock the mouse for FPS-style look. Must be called from a click. */
  lockPointer() { this.element.requestPointerLock?.(); }
  get pointerLocked() { return document.pointerLockElement === this.element; }

  /** @internal called by Game at the start of every frame */
  _beginFrame() {
    const pads = navigator.getGamepads?.() ?? [];
    this.gamepad = [...pads].find(Boolean) ?? null;
  }

  /** @internal called by Game at the end of every frame */
  _endFrame() {
    this._pressed.clear();
    this._released.clear();
    this._mousePressed.clear();
    this._mouseReleased.clear();
    this.mouse.dx = this.mouse.dy = 0;
    this.wheel = 0;
    this._padPrev = this.gamepad ? this.gamepad.buttons.map((b) => b.pressed) : [];
  }
}
