import * as THREE from 'three';

/**
 * Plays a model's animation clips with smooth cross-fades and forgiving names.
 *
 *   const anim = new Animator(model);     // model from assets.model(...)
 *   anim.play('Idle');
 *   anim.play('run');                    // case-insensitive, ignores "Armature|" prefixes
 *   anim.play(['Running_A', 'Run', 'Walk']);  // first one that exists wins — works across packs
 *   anim.once('Attack', { then: 'Idle' });    // play once, then go back to Idle
 *   anim.update(dt);                     // call every frame (Character / Game helpers do this for you)
 *
 * Name lookup order: exact → case-insensitive → after "|" → starts/ends with → contains.
 * So 'run' finds 'Run', 'CharacterArmature|Run', 'Rat_Run' or 'Running_A'.
 */
export class Animator {
  /** @param {THREE.Object3D & {animations?: THREE.AnimationClip[]}} model */
  constructor(model, clips = model.animations ?? []) {
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    this.clips = clips;
    this.names = clips.map((c) => c.name);
    /** @type {THREE.AnimationAction | null} */
    this.action = null;
    /** name of the clip currently playing */
    this.current = null;
    this._onEnd = null;
    this.mixer.addEventListener('finished', (e) => {
      if (e.action !== this.action) return;
      const cb = this._onEnd;
      this._onEnd = null;
      cb?.();
    });
  }

  /** Resolve a friendly name (or list of names) to a real clip name, or null. */
  find(query) {
    for (const q of [query].flat()) {
      const hit = findClipName(this.names, q);
      if (hit) return hit;
    }
    return null;
  }

  has(query) { return this.find(query) != null; }

  /**
   * Play a clip (looping by default). Calling play() with the clip that's already playing does nothing,
   * so it's safe to call every frame.
   * @param {string | string[]} name
   * @param {{ fade?: number, loop?: boolean, speed?: number, restart?: boolean, onEnd?: () => void }} [opts]
   * @returns {THREE.AnimationAction | null}
   */
  play(name, { fade = 0.2, loop = true, speed = 1, restart = false, onEnd } = {}) {
    const clipName = this.find(name);
    if (!clipName) {
      if (!this._warned?.has(String(name))) {
        (this._warned ??= new Set()).add(String(name));
        console.warn(`Animator: no clip matching ${JSON.stringify(name)}. Available:`, this.names);
      }
      return null;
    }
    if (clipName === this.current && !restart) {
      this.action.timeScale = speed;
      return this.action;
    }
    const clip = this.clips.find((c) => c.name === clipName);
    const next = this.mixer.clipAction(clip);
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.timeScale = speed;
    next.enabled = true;
    if (this.action && this.action !== next) next.crossFadeFrom(this.action, fade, false);
    next.play();
    this.action = next;
    this.current = clipName;
    this._onEnd = onEnd ?? null;
    return next;
  }

  /**
   * Play a clip once. When it ends, `then` starts (if given) and `onEnd` is called.
   *   anim.once('Death_A');                       // stays on last frame
   *   anim.once(['Attack', 'Punch'], { then: 'Idle', onEnd: () => (attacking = false) });
   */
  once(name, { then, onEnd, fade = 0.1, speed = 1 } = {}) {
    return this.play(name, {
      loop: false, fade, speed, restart: true,
      onEnd: () => { if (then) this.play(then); onEnd?.(); },
    });
  }

  /** true while a once() clip is still running. */
  get busy() {
    return !!this.action && this.action.loop === THREE.LoopOnce && this.action.isRunning();
  }

  /** Duration in seconds of a clip (or 0). */
  duration(name) {
    const n = this.find(name);
    return n ? this.clips.find((c) => c.name === n).duration : 0;
  }

  update(dt) { this.mixer.update(dt); }
}

function norm(s) { return s.toLowerCase().replace(/^.*\|/, ''); }

function findClipName(names, query) {
  if (!query) return null;
  if (names.includes(query)) return query;
  const q = norm(query);
  const tests = [
    (n) => n.toLowerCase() === query.toLowerCase(),
    (n) => norm(n) === q,
    (n) => norm(n).startsWith(q) || norm(n).endsWith('_' + q),
    (n) => norm(n).includes(q),
  ];
  for (const t of tests) {
    const hit = names.find(t);
    if (hit) return hit;
  }
  return null;
}
