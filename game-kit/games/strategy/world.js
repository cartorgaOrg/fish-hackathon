// Shared game state + small helpers used by units.js, buildings.js and main.js.
import { THREE, distXZ } from '@engine';
import { RESOURCES } from './data.js';

export const world = {
  /** @type {import('@engine').Game} */ game: null,
  /** @type {import('@engine').NavGrid} */ nav: null,
  stock: { wood: 0, gold: 0, food: 0 },
  wave: 0,
  over: false,
};

export const canAfford = (cost) => Object.entries(cost).every(([k, v]) => world.stock[k] >= v);
export function pay(cost) { for (const [k, v] of Object.entries(cost)) world.stock[k] -= v; }
export const costText = (cost) => Object.entries(cost).map(([k, v]) => `${v}${RESOURCES[k].icon}`).join(' ') || 'free';

/** Living things on a team ('player' / 'enemy'), optionally filtered by tag. */
export function teamOf(team, tag) {
  return world.game.findAll(team).filter((e) => !e.health?.dead && (!tag || e.is(tag)));
}

export function nearest(list, pos) {
  let best = null, bestD = Infinity;
  for (const e of list) {
    const d = distXZ(e.position, pos) - (e.radius ?? 0);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/** A walkable spot next to `target` on the side facing `from` (so units don't walk around buildings). */
export function approachPoint(from, target) {
  const dir = new THREE.Vector3(from.x - target.position.x, 0, from.z - target.position.z);
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
  dir.normalize().multiplyScalar((target.radius ?? 0) + 0.8);
  return target.position.clone().add(dir);
}

/** Population: units alive + units in training queues, vs. housing provided by finished buildings. */
export function population() {
  const used = teamOf('player', 'unit').length +
    teamOf('player', 'building').reduce((n, b) => n + b.queue.length, 0);
  const cap = teamOf('player', 'building').filter((b) => b.built).reduce((n, b) => n + (b.def.popCap ?? 0), 0);
  return { used, cap };
}

/** Something of ours got hit: idle fighters nearby rush to help. */
export function callForHelp(victim, attacker) {
  if (!attacker?.alive || victim.team !== 'player') return;
  for (const u of teamOf('player', 'unit')) {
    if (!u.order && !u.def.canGather && distXZ(u.position, victim.position) < 18) u.command({ type: 'attack', target: attacker });
  }
}
