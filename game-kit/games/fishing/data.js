// =============================================================================
//  FISH FRENZY — all the numbers. Tweak freely: the game reads everything from here.
// =============================================================================

export const CONFIG = {
  lake: { radius: 40, depth: 6, water: -0.3 },
  dock: { z: 34, scale: 0.6 },            // the dock reaches from the south shore toward the middle
  ambientFish: 14,                        // decorative fish swimming around
  fishScale: 1.6,                         // multiplies every species' `scale` (bigger = easier to see)
  aimLimit: 1.2,                          // radians left/right of straight ahead
  chargeTime: 1.1,                        // seconds to fully charge a cast
  waitTime: [1.5, 5],                     // seconds before a fish shows up (better lures = faster)
  nibbles: [1, 3],                        // fake-out nibbles before the real bite
  biteWindow: 0.9,                        // seconds you have to hook the fish
  tournamentGoal: 10,                     // catch this many different species to win the tournament
  rarityWeight: { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 },
  lureBoost: { common: 0, uncommon: 0.15, rare: 0.35, epic: 0.6, legendary: 0.9 }, // per lure level
};

export const RARITY_COLOR = { common: '#d6d6d6', uncommon: '#6ee07a', rare: '#5ab8ff', epic: '#c77dff', legendary: '#ffb84d' };

/**
 * Every catchable fish. `kg` = weight range, `value` = coins for an average-weight fish,
 * `strength` = how hard it pulls (0.3 easy … 1.2 brutal), `scale` = model size.
 * The model is /assets/quaternius-fish/<name>.glb.
 */
export const SPECIES = [
  // common
  { name: 'Goldfish', rarity: 'common', kg: [0.1, 0.6], value: 10, strength: 0.3, scale: 0.13 },
  { name: 'BlueGoldfish', rarity: 'common', kg: [0.1, 0.7], value: 12, strength: 0.3, scale: 0.13 },
  { name: 'Tetra', rarity: 'common', kg: [0.05, 0.3], value: 8, strength: 0.25, scale: 0.12 },
  { name: 'Clownfish', rarity: 'common', kg: [0.1, 0.4], value: 14, strength: 0.35, scale: 0.13 },
  { name: 'CardinalFish', rarity: 'common', kg: [0.1, 0.5], value: 12, strength: 0.35, scale: 0.13 },
  { name: 'RoyalGramma', rarity: 'common', kg: [0.05, 0.3], value: 15, strength: 0.3, scale: 0.12 },
  { name: 'Betta', rarity: 'common', kg: [0.05, 0.2], value: 18, strength: 0.3, scale: 0.12 },
  { name: 'ButterflyFish', rarity: 'common', kg: [0.2, 0.8], value: 16, strength: 0.4, scale: 0.14 },
  // uncommon
  { name: 'Koi', rarity: 'uncommon', kg: [1, 6], value: 40, strength: 0.5, scale: 0.18 },
  { name: 'YellowTang', rarity: 'uncommon', kg: [0.3, 1.2], value: 35, strength: 0.5, scale: 0.16 },
  { name: 'BlueTang', rarity: 'uncommon', kg: [0.3, 1.2], value: 38, strength: 0.5, scale: 0.16 },
  { name: 'Tang', rarity: 'uncommon', kg: [0.3, 1.2], value: 32, strength: 0.5, scale: 0.16 },
  { name: 'MoorishIdol', rarity: 'uncommon', kg: [0.3, 1], value: 45, strength: 0.5, scale: 0.16 },
  { name: 'ZebraClownFish', rarity: 'uncommon', kg: [0.2, 0.6], value: 42, strength: 0.45, scale: 0.14 },
  { name: 'Cowfish', rarity: 'uncommon', kg: [0.5, 2], value: 40, strength: 0.55, scale: 0.17 },
  { name: 'Puffer', rarity: 'uncommon', kg: [0.5, 3], value: 50, strength: 0.6, scale: 0.17 },
  { name: 'Flatfish', rarity: 'uncommon', kg: [1, 5], value: 45, strength: 0.6, scale: 0.2 },
  // rare
  { name: 'RedSnapper', rarity: 'rare', kg: [2, 10], value: 90, strength: 0.7, scale: 0.22 },
  { name: 'ParrotFish', rarity: 'rare', kg: [2, 9], value: 95, strength: 0.7, scale: 0.22 },
  { name: 'Piranha', rarity: 'rare', kg: [0.5, 3], value: 110, strength: 0.85, scale: 0.18 },
  { name: 'Lionfish', rarity: 'rare', kg: [0.5, 1.5], value: 100, strength: 0.7, scale: 0.18 },
  { name: 'BlackLionFish', rarity: 'rare', kg: [0.5, 1.5], value: 120, strength: 0.75, scale: 0.18 },
  { name: 'MandarinFish', rarity: 'rare', kg: [0.1, 0.4], value: 130, strength: 0.6, scale: 0.15 },
  { name: 'ArmoredCatfish', rarity: 'rare', kg: [1, 4], value: 85, strength: 0.75, scale: 0.2 },
  { name: 'Turbot', rarity: 'rare', kg: [2, 12], value: 90, strength: 0.75, scale: 0.22 },
  { name: 'FlowerHorn', rarity: 'rare', kg: [0.5, 2], value: 115, strength: 0.7, scale: 0.18 },
  // epic
  { name: 'CoralGrouper', rarity: 'epic', kg: [5, 25], value: 220, strength: 0.9, scale: 0.27 },
  { name: 'Humphead', rarity: 'epic', kg: [20, 90], value: 280, strength: 1.0, scale: 0.32 },
  { name: 'Blobfish', rarity: 'epic', kg: [1, 9], value: 250, strength: 0.8, scale: 0.22 },
  { name: 'Anglerfish', rarity: 'epic', kg: [2, 20], value: 300, strength: 0.95, scale: 0.25 },
  { name: 'Sunfish', rarity: 'epic', kg: [100, 900], value: 320, strength: 1.0, scale: 0.36 },
  { name: 'Tuna', rarity: 'epic', kg: [20, 250], value: 260, strength: 1.05, scale: 0.3 },
  // legendary
  { name: 'Shark', rarity: 'legendary', kg: [100, 600], value: 700, strength: 1.15, scale: 0.4 },
  { name: 'Swordfish', rarity: 'legendary', kg: [50, 450], value: 800, strength: 1.2, scale: 0.38 },
  { name: 'GoblinShark', rarity: 'legendary', kg: [100, 200], value: 950, strength: 1.15, scale: 0.4 },
];

/** Rods: better reel speed, more tension tolerance, longer casts. Model = FishingRod_Lvl<level>.glb */
export const RODS = [
  { level: 1, cost: 0, reel: 4, tension: 1.0, range: 18 },
  { level: 2, cost: 150, reel: 5, tension: 1.25, range: 22 },
  { level: 3, cost: 450, reel: 6, tension: 1.5, range: 26 },
  { level: 4, cost: 1000, reel: 7.5, tension: 1.85, range: 30 },
  { level: 5, cost: 2200, reel: 9, tension: 2.3, range: 34 },
];

/** Lures: level 0 = plain hook. Higher lures attract rarer fish, and faster. Model = Lure_<level>.glb */
export const LURES = [
  { level: 0, name: 'Plain hook', cost: 0 },
  { level: 1, name: 'Spoon', cost: 60 },
  { level: 2, name: 'Spinner', cost: 180 },
  { level: 3, name: 'Popper', cost: 400 },
  { level: 4, name: 'Jig', cost: 800 },
  { level: 5, name: 'Crankbait', cost: 1500 },
  { level: 6, name: 'Golden Lure', cost: 3000 },
];

export const fishUrl = (name) => `/assets/quaternius-fish/${name}.glb`;

/** Roll a species, weighted by rarity and boosted by the current lure. */
export function rollSpecies(lureLevel) {
  const weights = SPECIES.map((s) => CONFIG.rarityWeight[s.rarity] * (1 + lureLevel * CONFIG.lureBoost[s.rarity]));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < SPECIES.length; i++) if ((r -= weights[i]) <= 0) return SPECIES[i];
  return SPECIES[0];
}
