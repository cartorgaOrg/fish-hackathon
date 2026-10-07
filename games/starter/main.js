// =============================================================================
//  STARTER — the smallest complete game. Copy me: `npm run new my-game`
//
//  Walk around with WASD, jump with Space, collect all the coins.
//  Everything you see is built from engine primitives — read docs/ENGINE.md.
// =============================================================================
import {
  Game, Entity, CharacterController, FollowCamera, setupEnvironment, setVisible,
  rand, distXZ,
} from '@engine';

// 1. Create the game: renderer, scene, camera, input, physics, UI, audio… all in one.
const game = new Game();

// 2. Sky, sun, shadows and a ground plane in one call. Try sky: 'sunset' or 'night'.
setupEnvironment(game, { sky: 'day', ground: { color: '#6fae4f' } });

// 3. Preload the models we need (shows a loading bar).
const MODELS = {
  hero: '/assets/kaykit-adventurers/Knight.glb',
  coin: '/assets/quaternius-platformer/Coin.glb',
  tree: '/assets/quaternius-nature/Tree1.glb',
  rock: '/assets/quaternius-nature/Rock1.glb',
};
await game.load(Object.values(MODELS));

// 4. The player: a model + the ready-made third-person controller + a follow camera.
const heroModel = await game.assets.model(MODELS.hero);
// KayKit characters ship with every weapon visible — pick a loadout:
setVisible(heroModel, { '2H_Sword': false, Badge_Shield: false, Rectangle_Shield: false, Spike_Shield: false, '1H_Sword_Offhand': false });

const player = new CharacterController(game, heroModel, { speed: 7 });
const camera = game.add(new FollowCamera(game, player.object, { distance: 10 }));
player.camera = camera;        // makes WASD move relative to the camera
game.add(player);

// 5. Scenery: trees and rocks are solid thanks to physics.addCollider().
for (let i = 0; i < 25; i++) {
  const isTree = Math.random() < 0.7;
  const prop = await game.assets.model(isTree ? MODELS.tree : MODELS.rock, { scale: rand(0.8, 1.4) });
  prop.position.set(rand(-40, 40), 0, rand(-40, 40));
  if (prop.position.length() < 6) continue;      // keep the spawn clear
  prop.rotation.y = rand(0, Math.PI * 2);
  game.scene.add(prop);
  game.physics.addCollider(prop, { padding: -0.6 }); // shrink a bit so leaves don't block you
}

// 6. Coins: an Entity subclass with its own update().
class Coin extends Entity {
  update(dt) {
    this.object.rotation.y += dt * 3;
    this.object.position.y = 1 + Math.sin(game.time * 4 + this.object.id) * 0.2;
    if (distXZ(this.position, player.position) < 1.2) {
      game.audio.play('coin');
      game.effects.burst(this.position, { color: '#ffd84a' });
      game.ui.floatingText(this.position, '+1', '#ffd84a');
      this.destroy();
      score.set(`Coins: ${++collected} / ${TOTAL}`);
      if (collected === TOTAL) { game.audio.play('win'); game.ui.message('You win! 🎉', 0, { sub: 'Now make it your own — edit games/starter/main.js' }); }
    }
  }
}
const TOTAL = 10;
let collected = 0;
for (let i = 0; i < TOTAL; i++) {
  const coin = new Coin(await game.assets.model(MODELS.coin, { scale: 0.5 }), { tags: ['coin'] });
  coin.position.set(rand(-25, 25), 1, rand(-25, 25));
  game.add(coin);
}

// 7. UI is plain HTML on top of the canvas.
const score = game.ui.text(`Coins: 0 / ${TOTAL}`, { top: 16, left: 16 }, { size: 26 });
game.ui.controls(['WASD — move', 'Space — jump', 'Shift — sprint', 'Right-drag — orbit camera', 'Wheel — zoom']);

// 8. Go!
game.start();
