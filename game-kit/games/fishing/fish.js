// =============================================================================
//  Fish — one swimming fish. It wanders around the lake until the game tells it to
//  approach the bobber (approach), get hooked (follow the line) or flee.
// =============================================================================
import { Entity, Animator, rand, v3, dampAngle } from '@engine';
import { CONFIG, fishUrl } from './data.js';

const { lake } = CONFIG;

/** A random point under water, inside the lake. */
export function randomUnderwater(maxR = lake.radius - 8) {
  const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * maxR;
  return v3(Math.cos(a) * r, rand(-lake.depth + 1.5, -1.2), Math.sin(a) * r);
}

export class Fish extends Entity {
  /** Load a model for `species` and add the fish to the game. */
  static async spawn(game, species, pos = randomUnderwater()) {
    const model = await game.assets.model(fishUrl(species.name), { scale: species.scale * CONFIG.fishScale, shadows: false });
    const fish = game.add(new Fish(model, species));
    fish.position.copy(pos);
    return fish;
  }

  constructor(model, species) {
    super(model, { tags: ['fish'] });
    this.species = species;
    this.anim = new Animator(model);
    this.anim.play('Swimming_Normal', { speed: rand(0.8, 1.2) });
    this.mode = 'wander';          // wander | approach | hooked | flee | caught
    this.target = randomUnderwater();
    this.speed = rand(1, 2);
  }

  /** Swim toward the bobber and hover just below it. */
  approach(point) { this.mode = 'approach'; this.target = point.clone().setY(-0.9); this.anim.play('Swimming_Normal', { speed: 1.5 }); }

  /** Dart away and disappear. */
  flee() {
    this.mode = 'flee';
    const away = this.position.clone().setY(0).normalize().multiplyScalar(-1);
    this.target = this.position.clone().addScaledVector(away.lengthSq() ? away : v3(1, 0, 0), 25).setY(-lake.depth + 1);
    this.anim.play('Swimming_Fast');
  }

  hook() { this.mode = 'hooked'; this.anim.play(['Swimming_Fast', 'Swimming_Impulse']); }

  update(dt) {
    this.anim.update(dt);
    if (this.mode === 'hooked' || this.mode === 'caught') return; // main.js moves it
    const speed = this.mode === 'flee' ? 7 : this.mode === 'approach' ? 3 : this.speed;
    const to = this.target.clone().sub(this.position);
    const d = to.length();
    if (d < 0.4) {
      if (this.mode === 'wander') this.target = randomUnderwater();
      if (this.mode === 'flee') return this.destroy();
      return;                                    // 'approach' just hovers under the bobber
    }
    this.position.addScaledVector(to, Math.min(1, (speed * dt) / d));
    // Quaternius fish face +Z, so the yaw that points along `to` is atan2(x, z)
    this.object.rotation.y = dampAngle(this.object.rotation.y, Math.atan2(to.x, to.z), 4, dt);
    // stay inside the lake while wandering
    const r = Math.hypot(this.position.x, this.position.z);
    if (this.mode === 'wander' && r > lake.radius - 6) this.target = randomUnderwater();
  }
}
