import { assetUrl } from './Assets.js';

/**
 * Sound effects with zero audio files: every built-in sound is synthesized with WebAudio.
 *
 *   sfx.play('coin');          // jump, coin, hit, hurt, shoot, explosion, click, powerup, death, step, swing, win, lose
 *   sfx.play('shoot', { volume: 0.3, pitch: 1.2 });
 *   await sfx.load('music', '/sounds/theme.mp3');   // your own files (put them in public/sounds/)
 *   sfx.play('music', { loop: true, volume: 0.4 });
 *   sfx.muted = true;
 *
 * Want nicer sounds? Free CC0 packs: kenney.nl/assets?q=audio — drop them in public/sounds/.
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.volume = 0.5;
    this.muted = false;
    // browsers only allow audio after a user gesture
    const unlock = () => { this._ensure(); this.ctx.resume(); };
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
  }

  _ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    this.master.gain.value = this.muted ? 0 : this.volume;
    return this.ctx;
  }

  /** Load an audio file under a name. */
  async load(name, url) {
    const ctx = this._ensure();
    const data = await (await fetch(assetUrl(url))).arrayBuffer();
    this.buffers.set(name, await ctx.decodeAudioData(data));
  }

  /**
   * Play a loaded or built-in sound.
   * @returns {{ stop(): void } | null}
   */
  play(name, { volume = 1, pitch = 1, loop = false } = {}) {
    if (this.muted) return null;
    const ctx = this._ensure();
    if (ctx.state !== 'running') return null;
    const out = ctx.createGain();
    out.gain.value = volume;
    out.connect(this.master);
    const buf = this.buffers.get(name);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = loop; src.playbackRate.value = pitch;
      src.connect(out); src.start();
      return { stop: () => src.stop() };
    }
    const synth = SYNTHS[name];
    if (!synth) { console.warn(`sfx: unknown sound "${name}". Built-ins: ${Object.keys(SYNTHS).join(', ')}`); return null; }
    synth(ctx, out, ctx.currentTime, pitch * (0.95 + Math.random() * 0.1));
    return { stop: () => out.disconnect() };
  }
}

// ---- tiny synth helpers ----
function tone(ctx, out, t, { type = 'square', from = 440, to = from, dur = 0.15, vol = 0.3, attack = 0.005 }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(ctx, out, t, { dur = 0.2, vol = 0.4, filter = 2000, filterTo = filter, type = 'lowpass' }) {
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = type;
  f.frequency.setValueAtTime(filter, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, filterTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

const SYNTHS = {
  jump:      (c, o, t, p) => tone(c, o, t, { type: 'square', from: 220 * p, to: 660 * p, dur: 0.15, vol: 0.15 }),
  coin:      (c, o, t, p) => { tone(c, o, t, { from: 988 * p, dur: 0.07, vol: 0.15 }); tone(c, o, t + 0.07, { from: 1319 * p, dur: 0.2, vol: 0.15 }); },
  powerup:   (c, o, t, p) => [0, 1, 2, 3].forEach((i) => tone(c, o, t + i * 0.07, { type: 'triangle', from: 440 * p * 2 ** (i / 4), dur: 0.12, vol: 0.2 })),
  hit:       (c, o, t, p) => { noise(c, o, t, { dur: 0.12, vol: 0.5, filter: 3000 * p, filterTo: 300 }); tone(c, o, t, { type: 'sine', from: 180 * p, to: 60, dur: 0.12, vol: 0.4 }); },
  hurt:      (c, o, t, p) => tone(c, o, t, { type: 'sawtooth', from: 300 * p, to: 80 * p, dur: 0.25, vol: 0.2 }),
  shoot:     (c, o, t, p) => { noise(c, o, t, { dur: 0.15, vol: 0.5, filter: 6000 * p, filterTo: 500 }); tone(c, o, t, { type: 'square', from: 900 * p, to: 100, dur: 0.08, vol: 0.12 }); },
  laser:     (c, o, t, p) => tone(c, o, t, { type: 'sawtooth', from: 1500 * p, to: 200 * p, dur: 0.18, vol: 0.15 }),
  explosion: (c, o, t, p) => { noise(c, o, t, { dur: 0.8, vol: 0.8, filter: 1200 * p, filterTo: 60 }); tone(c, o, t, { type: 'sine', from: 120 * p, to: 30, dur: 0.5, vol: 0.5 }); },
  click:     (c, o, t, p) => tone(c, o, t, { type: 'square', from: 1200 * p, dur: 0.03, vol: 0.1 }),
  step:      (c, o, t, p) => noise(c, o, t, { dur: 0.06, vol: 0.15, filter: 800 * p, filterTo: 200 }),
  swing:     (c, o, t, p) => noise(c, o, t, { dur: 0.18, vol: 0.3, filter: 600 * p, filterTo: 3000 * p, type: 'bandpass' }),
  death:     (c, o, t, p) => [0, 1, 2].forEach((i) => tone(c, o, t + i * 0.15, { type: 'triangle', from: 330 * p / (i + 1), to: 200 * p / (i + 1), dur: 0.2, vol: 0.25 })),
  win:       (c, o, t, p) => [523, 659, 784, 1047].forEach((f, i) => tone(c, o, t + i * 0.12, { type: 'triangle', from: f * p, dur: i === 3 ? 0.5 : 0.15, vol: 0.25 })),
  lose:      (c, o, t, p) => [392, 370, 349, 330].forEach((f, i) => tone(c, o, t + i * 0.2, { type: 'triangle', from: f * p, dur: 0.25, vol: 0.25 })),
  build:     (c, o, t, p) => [0, 0.12, 0.24].forEach((d) => noise(c, o, t + d, { dur: 0.08, vol: 0.4, filter: 900 * p, filterTo: 200 })),
  splash:    (c, o, t, p) => noise(c, o, t, { dur: 0.5, vol: 0.4, filter: 4000 * p, filterTo: 300, type: 'bandpass' }),
};
export const BUILTIN_SOUNDS = Object.keys(SYNTHS);
