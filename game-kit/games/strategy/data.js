// =============================================================================
//  STRATEGY — game data. Tweak numbers here to rebalance the whole game.
//  Every model path can be swapped for anything in /assets.html.
// =============================================================================

export const CONFIG = {
  mapSize: 90,            // playable area is -mapSize/2 … +mapSize/2 on X and Z
  startStock: { wood: 150, gold: 60, food: 120 },
  firstRaidAt: 75,        // seconds until the first raid
  raidInterval: 55,       // seconds between raids
  raidSize: (wave) => 1 + wave * 2, // raiders per wave
  wavesToWin: 5,          // survive this many raids to win
  carryCapacity: 10,      // resources a villager carries per trip
};

/** Icons used in the HUD. Add a resource here + a node type below to invent a new one. */
export const RESOURCES = {
  wood: { icon: '🪵', color: '#c9905a' },
  gold: { icon: '🪙', color: '#ffd84a' },
  food: { icon: '🌾', color: '#9be36b' },
};

const KK = '/assets/kaykit-adventurers/';
const SK = '/assets/kaykit-skeletons/';
const RTS = '/assets/quaternius-rts/';

/**
 * Units. `hide` lists KayKit model parts to turn off (characters ship with every weapon).
 * gatherRate = resources per second, attack = damage per hit, attackRate = seconds between hits.
 */
export const UNITS = {
  villager: {
    name: 'Villager', model: KK + 'Rogue_Hooded.glb', scale: 0.75,
    hide: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Throwable'],
    hp: 40, speed: 4, attack: 3, attackRate: 1.2, range: 1.2, sight: 4,
    gatherRate: 2, canGather: true, canBuild: true,
    cost: { food: 50 }, trainTime: 6, pop: 1,
  },
  knight: {
    name: 'Knight', model: KK + 'Knight.glb', scale: 0.8,
    hide: ['2H_Sword', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '1H_Sword_Offhand'],
    hp: 120, speed: 4.5, attack: 12, attackRate: 1, range: 1.4, sight: 10,
    cost: { food: 60, gold: 30 }, trainTime: 9, pop: 1,
  },
  raider: {
    name: 'Skeleton Raider', model: SK + 'Skeleton_Warrior.glb', scale: 0.75,
    weapon: SK + 'Skeleton_Blade.gltf',
    hp: 70, speed: 3.6, attack: 8, attackRate: 1.1, range: 1.4, sight: 14,
  },
  raiderMinion: {
    name: 'Skeleton Minion', model: SK + 'Skeleton_Minion.glb', scale: 0.7,
    weapon: SK + 'Skeleton_Axe.gltf',
    hp: 40, speed: 4.2, attack: 5, attackRate: 0.9, range: 1.3, sight: 14,
  },
};

/**
 * Buildings. `size` = footprint in grid cells (keep it even). `site` = model shown while under
 * construction, `model` = finished building. `trains` = unit types it can produce.
 */
export const BUILDINGS = {
  townCenter: {
    name: 'Town Center', model: RTS + 'TownCenter_FirstAge_Level3.glb', site: RTS + 'TownCenter_FirstAge_Level1.glb',
    scale: 5, size: 6, hp: 600, buildTime: 30, cost: {}, trains: ['villager'], dropoff: true, popCap: 5,
  },
  house: {
    name: 'House', model: RTS + 'Houses_FirstAge_1_Level3.glb', site: RTS + 'Houses_FirstAge_1_Level1.glb',
    scale: 4, size: 4, hp: 150, buildTime: 8, cost: { wood: 30 }, popCap: 5, key: 'Digit1',
  },
  farm: {
    name: 'Farm', model: RTS + 'Farm_FirstAge_Level2_Wheat.glb', site: RTS + 'Farm_FirstAge_Level1.glb',
    scale: 3.6, size: 6, hp: 100, buildTime: 8, cost: { wood: 60 }, walkable: true, gives: 'food', key: 'Digit2',
  },
  barracks: {
    name: 'Barracks', model: RTS + 'Barracks_FirstAge_Level3.glb', site: RTS + 'Barracks_FirstAge_Level1.glb',
    scale: 2.6, size: 6, hp: 350, buildTime: 15, cost: { wood: 120 }, trains: ['knight'], key: 'Digit3',
  },
};

/** Resource nodes scattered on the map. */
export const NODES = {
  tree: { models: [RTS + 'Resource_PineTree.glb', RTS + 'Resource_Tree1.glb'], scale: 3.6, gives: 'wood', amount: 60 },
  gold: { models: [RTS + 'Resource_Gold_1.glb', RTS + 'Resource_Gold_2.glb'], scale: 4, gives: 'gold', amount: 400 },
};

/** Every model the game uses (preloaded behind the loading screen). */
export const ALL_MODELS = [
  ...Object.values(UNITS).flatMap((u) => [u.model, u.weapon].filter(Boolean)),
  ...Object.values(BUILDINGS).flatMap((b) => [b.model, b.site]),
  ...Object.values(NODES).flatMap((n) => n.models),
  RTS + 'Mountain_Group_1.glb', RTS + 'Rock_Group.glb',
];
