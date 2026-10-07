// =============================================================================
//  LEVEL DATA — edit me! Every line is one thing in the world.
//
//  Coordinates: x = left/right, y = up, z = forward is NEGATIVE (the course runs
//  away from the camera, toward -z). Units ≈ metres; the hero is ~2 tall.
//  A single jump reaches ~2 high / ~4.5 far, a double jump ~4 high / ~8 far.
//
//  Types:
//    start      { pos }                          where you spawn (also first checkpoint)
//    platform   { pos:[x, top, z], size:[w,h,d], style?: 'grass'|'bricks' }   pos.y = TOP surface
//    moving     { from, to, size, period }       platform sliding between two points (seconds per round trip)
//    coin       { pos }        coins { from, to, count }   (a row of coins)
//    gem        { pos }                          worth CONFIG.gemValue coins
//    enemy      { from, to, speed? }             patrols between two points — stomp it!
//    spikes     { pos }                          floor trap: hurts when you touch it
//    saw        { from, to, period }             spinning blade that moves back and forth
//    bouncer    { pos }                          spring pad: land on it to launch upward
//    checkpoint { pos }                          touch it to set your respawn point
//    goal       { pos }                          the finish flag
//    tree / bush { pos, scale? }                 decoration
// =============================================================================
export const LEVEL = [
  { type: 'start', pos: [0, 0, 3] },

  // --- 1. Grassy start
  { type: 'platform', pos: [0, 0, 0], size: [10, 4, 14] },
  { type: 'tree', pos: [-3.5, 0, 4] },
  { type: 'bush', pos: [3.5, 0, 5] },
  { type: 'coins', from: [0, 1, -1], to: [0, 1, -5], count: 3 },

  // --- 2. First hops
  { type: 'platform', pos: [0, 0, -12], size: [6, 4, 6] },
  { type: 'coins', from: [0, 2.5, -9], to: [0, 2.5, -15], count: 3 },
  { type: 'platform', pos: [0, 1.5, -21], size: [6, 4, 6] },
  { type: 'gem', pos: [2.2, 2.5, -22] },

  // --- 3. Sliding platform over the void
  { type: 'moving', from: [-4, 1.5, -30], to: [4, 1.5, -30], size: [4, 1, 4], period: 4 },
  { type: 'coin', pos: [0, 3, -30] },

  // --- 4. Enemy arena + checkpoint
  { type: 'platform', pos: [0, 2, -40], size: [10, 4, 8] },
  { type: 'checkpoint', pos: [-3.5, 2, -37.5] },
  { type: 'enemy', from: [-3, 2, -41], to: [3, 2, -41], speed: 2 },
  { type: 'bush', pos: [4, 2, -43] },

  // --- 5. Staircase to the spring
  { type: 'platform', pos: [5, 4, -48], size: [4, 4, 4], style: 'bricks' },
  { type: 'platform', pos: [0, 2, -56], size: [6, 4, 6] },
  { type: 'coins', from: [5, 5.5, -48], to: [0, 4, -54], count: 3 },
  { type: 'bouncer', pos: [0, 2, -57] },
  { type: 'coins', from: [0, 7, -59], to: [0, 11, -63], count: 3 },

  // --- 6. High road: saws and spikes
  { type: 'platform', pos: [0, 10, -68], size: [8, 4, 8] },
  { type: 'checkpoint', pos: [-2.5, 10, -66] },
  { type: 'tree', pos: [3, 10, -66], scale: 0.3 },
  { type: 'platform', pos: [0, 10, -84], size: [5, 2, 22], style: 'bricks' },
  { type: 'saw', from: [-2.5, 11.4, -79], to: [2.5, 11.4, -79], period: 3 },
  { type: 'spikes', pos: [-1.2, 10, -86] },
  { type: 'spikes', pos: [1.2, 10, -90] },
  { type: 'coins', from: [0, 11, -76], to: [0, 11, -92], count: 6 },
  { type: 'gem', pos: [-1.2, 12.5, -86] },

  // --- 7. Elevator to the top
  { type: 'moving', from: [0, 10, -100], to: [0, 16, -100], size: [4, 1, 4], period: 5 },
  { type: 'gem', pos: [0, 19, -100] },

  // --- 8. Finish
  { type: 'platform', pos: [0, 16, -112], size: [10, 4, 12] },
  { type: 'enemy', from: [-3, 16, -110], to: [3, 16, -110], speed: 3 },
  { type: 'goal', pos: [0, 16, -116] },
  { type: 'tree', pos: [-4, 16, -116], scale: 0.3 },
  { type: 'tree', pos: [4, 16, -116], scale: 0.3 },
];
