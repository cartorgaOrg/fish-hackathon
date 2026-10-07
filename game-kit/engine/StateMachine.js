/**
 * Minimal finite state machine — the easiest way to write enemy AI, game phases, menus…
 *
 *   const ai = new StateMachine({
 *     idle:   { enter: () => anim.play('Idle'),  update: (dt) => { if (seesPlayer()) ai.go('chase'); } },
 *     chase:  { enter: () => anim.play('Run'),   update: (dt) => { moveToward(player); if (close()) ai.go('attack'); } },
 *     attack: { enter: () => anim.once('Attack', { onEnd: () => ai.go('chase') }) },
 *     dead:   { enter: () => anim.once('Death') },
 *   }, 'idle');
 *   // every frame:
 *   ai.update(dt);
 *
 * `ai.time` = seconds spent in the current state (handy for "wait 2 seconds then…").
 */
export class StateMachine {
  /**
   * @param {Record<string, { enter?: (prev:string|null)=>void, update?: (dt:number)=>void, exit?: (next:string)=>void }>} states
   * @param {string} [initial]
   */
  constructor(states, initial) {
    this.states = states;
    this.state = null;
    this.time = 0;
    if (initial) this.go(initial);
  }

  /** Switch state (does nothing if already in it, unless force = true). */
  go(name, force = false) {
    if (!this.states[name]) throw new Error(`StateMachine: unknown state "${name}"`);
    if (name === this.state && !force) return;
    const prev = this.state;
    if (prev) this.states[prev].exit?.(name);
    this.state = name;
    this.time = 0;
    this.states[name].enter?.(prev);
  }

  is(name) { return this.state === name; }

  update(dt) {
    this.time += dt;
    this.states[this.state]?.update?.(dt);
  }
}
