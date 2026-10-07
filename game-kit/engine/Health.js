/**
 * Hit points for anything that can take damage.
 *
 *   enemy.health = new Health(30, {
 *     onDamage: (amount, source) => effects.flash(enemy.object),
 *     onDeath: () => enemy.destroy(),
 *   });
 *   enemy.health.damage(10, player);
 *   enemy.health.fraction   // 0..1 for health bars
 *
 * `invulnerableTime` gives a short grace period after each hit (great for players).
 */
export class Health {
  /**
   * @param {number} max
   * @param {{ onDamage?: (amount:number, source:any)=>void, onDeath?: (source:any)=>void, onHeal?: (amount:number)=>void, invulnerableTime?: number }} [opts]
   */
  constructor(max = 100, { onDamage, onDeath, onHeal, invulnerableTime = 0 } = {}) {
    this.max = max;
    this.hp = max;
    this.onDamage = onDamage;
    this.onDeath = onDeath;
    this.onHeal = onHeal;
    this.invulnerableTime = invulnerableTime;
    this._lastHit = -Infinity;
  }

  get dead() { return this.hp <= 0; }
  get fraction() { return this.hp / this.max; }
  get invulnerable() { return performance.now() / 1000 - this._lastHit < this.invulnerableTime; }

  /** Returns true if the damage was applied. */
  damage(amount, source = null) {
    if (this.dead || this.invulnerable || amount <= 0) return false;
    this._lastHit = performance.now() / 1000;
    this.hp = Math.max(0, this.hp - amount);
    this.onDamage?.(amount, source);
    if (this.hp === 0) this.onDeath?.(source);
    return true;
  }

  heal(amount) {
    if (this.dead) return;
    const before = this.hp;
    this.hp = Math.min(this.max, this.hp + amount);
    if (this.hp > before) this.onHeal?.(this.hp - before);
  }

  /** Back to full health (e.g. respawn). */
  reset(max = this.max) { this.max = max; this.hp = max; this._lastHit = -Infinity; }
}
