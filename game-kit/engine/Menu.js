import { TouchControls } from './Touch.js';
import { storage } from './utils.js';

/**
 * Title screen, pause menu and game-over / win screens in one object, so every game feels finished.
 *
 *   const menu = new GameMenu(game, {
 *     title: 'Fish Frenzy',
 *     subtitle: 'Catch all 40 species!',
 *     controls: ['A/D — aim', 'Hold Space — cast'],
 *     onStart: () => spawnFirstWave(),        // runs when the player presses Play
 *   });
 *   // later:
 *   menu.gameOver({ text: 'You were eaten by a shark', score: 1234 });
 *   menu.win({ text: 'All fish caught!', score });
 *   menu.restart();                          // reloads straight into the game (skips the title)
 *
 * The game is paused while any menu is open. Esc / P (or the ⏸ button on phones) pauses.
 * Scores passed to gameOver()/win() are compared with a saved best score (per game).
 */
export class GameMenu {
  /**
   * @param {import('./Game.js').Game} game
   * @param {object} opts
   * @param {string} opts.title
   * @param {string} [opts.subtitle]
   * @param {string[]} [opts.controls]   lines shown on the title screen (keyboard help)
   * @param {string[]} [opts.touchControls]  lines shown instead on touch devices
   * @param {() => void} [opts.onStart]
   * @param {() => void} [opts.onPause]    e.g. cancel a half-finished action (building placement…)
   * @param {() => void} [opts.onResume]
   * @param {boolean} [opts.lockPointer=false]  FPS games: capture the mouse on Play/Resume
   * @param {boolean} [opts.showTitle=true]     false = skip the title screen entirely
   * @param {string} [opts.accent='#ffd166']
   */
  constructor(game, { title, subtitle = '', controls = [], touchControls, onStart, onPause, onResume, lockPointer = false, showTitle = true, accent = '#ffd166' }) {
    this.game = game;
    this.opts = { title, subtitle, controls, touchControls, onStart, onPause, onResume, lockPointer, accent };
    this.state = 'title'; // title | playing | paused | over
    this.bestKey = `fx-best:${location.pathname}`;
    injectCss(accent);
    document.body.classList.add('fx-has-menu');
    this.overlay = document.createElement('div');
    this.overlay.className = 'fx-menu';
    document.body.appendChild(this.overlay);

    if (TouchControls.enabled) {
      const b = document.createElement('button');
      b.className = 'fx-pausebtn';
      b.textContent = '⏸';
      b.onclick = () => this.pause();
      document.body.appendChild(b);
    }

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if ((e.code === 'Escape' || e.code === 'KeyP') && this.state === 'playing') this.pause();
      else if (e.code === 'Escape' && this.state === 'paused') this.resume();
      else if (e.code === 'Enter' && this.state === 'title') this.start();
      else if (e.code === 'Enter' && this.state === 'over') this.restart();
    });
    // FPS games: pressing Esc releases the mouse before we ever see the key, so pause on unlock
    document.addEventListener('pointerlockchange', () => {
      if (lockPointer && !document.pointerLockElement && this.state === 'playing') this.pause();
    });

    const skipKey = `fx-skip-title:${location.pathname}`;
    const skip = sessionStorage.getItem(skipKey);
    sessionStorage.removeItem(skipKey);
    if (!showTitle || skip) queueMicrotask(() => this.start());
    else this._showTitle();
  }

  get playing() { return this.state === 'playing'; }

  /** Begin playing (called by the Play button / Enter). */
  start() {
    if (this.state !== 'title') return;
    this._hide();
    this.state = 'playing';
    this.game.paused = false;
    if (this.opts.lockPointer) this.game.input.lockPointer();
    this.opts.onStart?.();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.game.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.opts.onPause?.();
    this._show(`
      <h1>Paused</h1>
      <div class="fx-menu-buttons">
        <button data-a="resume" class="primary">Resume</button>
        <button data-a="restart">Restart</button>
        <button data-a="mute">${this.game.audio.muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
        <button data-a="quit">Quit to menu</button>
      </div>
      ${this._controlsHtml()}`);
  }

  resume() {
    if (this.state !== 'paused') return;
    this._hide();
    this.state = 'playing';
    this.game.paused = false;
    if (this.opts.lockPointer) this.game.input.lockPointer();
    this.opts.onResume?.();
  }

  /** Show the game-over screen. `score` (optional) is compared with the saved best. */
  gameOver({ title = 'Game Over', text = '', score } = {}) { this._end(title, text, score, false); }

  /** Show the victory screen. */
  win({ title = 'You Win!', text = '', score } = {}) { this._end(title, text, score, true); }

  /** Reload the page and jump straight into the game (no title screen). */
  restart() {
    sessionStorage.setItem(`fx-skip-title:${location.pathname}`, '1');
    location.reload();
  }

  quit() { location.href = '../../'; }

  // ------------------------------------------------------------------ internals

  _end(title, text, score, won) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.game.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    let scoreHtml = '';
    if (score != null) {
      const best = storage.load(this.bestKey, 0);
      const record = score > best;
      if (record) storage.save(this.bestKey, score);
      scoreHtml = `<div class="fx-menu-score">${score}</div><div class="fx-menu-best">${record ? '🏆 New best!' : `Best: ${best}`}</div>`;
    }
    this.game.audio.play(won ? 'win' : 'lose');
    this._show(`
      <h1 class="${won ? 'won' : 'lost'}">${title}</h1>
      ${text ? `<p>${text}</p>` : ''}
      ${scoreHtml}
      <div class="fx-menu-buttons">
        <button data-a="restart" class="primary">Play again</button>
        <button data-a="quit">Quit to menu</button>
      </div>`);
  }

  _showTitle() {
    this.game.paused = true;
    const best = storage.load(this.bestKey, 0);
    this._show(`
      <h1 class="fx-menu-title">${this.opts.title}</h1>
      ${this.opts.subtitle ? `<p>${this.opts.subtitle}</p>` : ''}
      <div class="fx-menu-buttons"><button data-a="start" class="primary big">▶ Play</button></div>
      ${best ? `<div class="fx-menu-best">Best: ${best}</div>` : ''}
      ${this._controlsHtml()}
      <a class="fx-menu-back" href="../../">← all games</a>`);
  }

  _controlsHtml() {
    const lines = TouchControls.enabled && this.opts.touchControls ? this.opts.touchControls : this.opts.controls;
    return lines?.length ? `<div class="fx-menu-controls">${lines.map((l) => `<div>${l}</div>`).join('')}</div>` : '';
  }

  _show(html) {
    this.overlay.innerHTML = `<div class="fx-menu-panel">${html}</div>`;
    this.overlay.classList.add('open');
    for (const b of this.overlay.querySelectorAll('button[data-a]')) {
      b.onclick = () => {
        this.game.audio.play('click');
        const a = b.dataset.a;
        if (a === 'start') this.start();
        if (a === 'resume') this.resume();
        if (a === 'restart') this.restart();
        if (a === 'quit') this.quit();
        if (a === 'mute') { this.game.audio.muted = !this.game.audio.muted; b.textContent = this.game.audio.muted ? '🔇 Sound off' : '🔊 Sound on'; }
      };
    }
    this.overlay.querySelector('button.primary')?.focus();
  }

  _hide() { this.overlay.classList.remove('open'); this.overlay.innerHTML = ''; }
}

let cssDone = false;
function injectCss(accent) {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
  .fx-has-menu .fx-back { display: none; }
  .fx-menu { position: fixed; inset: 0; z-index: 50; display: none; align-items: center; justify-content: center; padding: 16px;
    background: radial-gradient(ellipse at center, #0b1020aa, #05070fe6); backdrop-filter: blur(3px); font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #fff; }
  .fx-menu.open { display: flex; }
  .fx-menu-panel { text-align: center; max-width: 640px; width: 100%; animation: fx-menu-in .25s ease-out; }
  @keyframes fx-menu-in { from { opacity: 0; transform: scale(.95) } }
  .fx-menu h1 { margin: 0 0 8px; font-size: clamp(36px, 8vw, 72px); font-weight: 900; letter-spacing: -0.02em; text-shadow: 0 6px 24px #000a; }
  .fx-menu h1.fx-menu-title { color: ${accent}; }
  .fx-menu h1.won { color: #7dffa1; } .fx-menu h1.lost { color: #ff7b7b; }
  .fx-menu p { margin: 0 0 20px; font-size: 18px; opacity: .85; line-height: 1.5; }
  .fx-menu-buttons { display: flex; flex-direction: column; gap: 10px; align-items: center; margin: 18px 0; }
  .fx-menu button { font: 700 18px system-ui, sans-serif; color: #fff; background: #ffffff1a; border: 2px solid #ffffff40; border-radius: 12px;
    padding: 12px 28px; min-width: 240px; cursor: pointer; }
  .fx-menu button:hover, .fx-menu button:focus-visible { background: #ffffff33; outline: none; }
  .fx-menu button.primary { background: ${accent}; color: #1a1a1a; border-color: ${accent}; }
  .fx-menu button.primary:hover { filter: brightness(1.1); }
  .fx-menu button.big { font-size: 24px; padding: 16px 40px; }
  .fx-menu-score { font-size: 56px; font-weight: 900; color: ${accent}; }
  .fx-menu-best { opacity: .75; font-weight: 600; }
  .fx-menu-controls { display: inline-block; text-align: left; margin-top: 16px; background: #ffffff10; border-radius: 10px; padding: 12px 18px; font-size: 14px; line-height: 1.7; opacity: .85; }
  .fx-menu-back { display: block; margin-top: 20px; color: #fff8; font-size: 13px; }
  .fx-pausebtn { position: fixed; top: 40%; left: max(8px, env(safe-area-inset-left)); z-index: 20; width: 44px; height: 44px; border-radius: 22px;
    border: 2px solid #ffffff55; background: #0006; color: #fff; font-size: 18px; }
  `;
  document.head.appendChild(s);
}
