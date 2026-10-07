# Getting started (hackathon edition)

From zero to your own playable game in about 15 minutes. No game-engine experience needed. If you can write a little JavaScript, you can do this.

- [1. Install (5 min)](#1-install-5-min)
- [2. Look around (5 min)](#2-look-around-5-min)
- [3. Make your game (5 min)](#3-make-your-game-5-min)
- [4. Your first three changes](#4-your-first-three-changes)
- [5. Working as a team](#5-working-as-a-team)
- [6. Working with an AI assistant](#6-working-with-an-ai-assistant)
- [7. A plan for the weekend](#7-a-plan-for-the-weekend)
- [8. Submitting](#8-submitting)
- [Cheat sheet](#cheat-sheet)

---

## 1. Install (5 min)

You need:
- **[Node.js](https://nodejs.org) 20 or newer.** Check with `node -v`.
- **git**, a code editor (VS Code works well), and Chrome, Edge or Firefox.

```bash
git clone https://github.com/playmanogames/game-starter-kit.git my-team   # or your team's fork
cd my-team
npm install
npm run dev
```

Open the URL it prints, usually **http://localhost:5173**. That's it.

> **Bad Wi-Fi?** Only `git clone` (~27 MB) and `npm install` (~19 MB) need internet. Later `git pull`s are just a few KB. After that, everything, including all 780 models, works fully offline, so **do these two steps at home before the event**. No internet at all? Ask an organizer for the **offline kit** (a zip on USB) and follow its `OFFLINE-INSTALL.md`: `npm ci --offline --cache ./npm-cache`.

> Port taken? Vite picks the next free one; the terminal shows which. Anything else odd: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## 2. Look around (5 min)

| Open | Why |
|---|---|
| **http://localhost:5173/** | The launcher. Play each sample for a minute and note which one is closest to your idea. |
| **http://localhost:5173/assets.html** | The **asset browser**: 780+ free models. Search ("knight", "fish", "tree"), click to preview, press the animation buttons, and click the code box to copy the loading code. |
| Any game + **`?touch`** (e.g. `/games/rpg/?touch`) | The phone controls, on your laptop |
| The **Network** URL from `npm run dev`, on your phone | Real phone testing (same Wi-Fi) |

The samples, and what they're good starting points for:

| Sample | Start here if you're making… |
|---|---|
| 🌱 `starter` | Anything. It's the smallest complete game (~90 lines). |
| 🎣 `fishing` | Fishing, cozy, collection or "minigame + progression" games |
| ⚔️ `rpg` | Action RPG, adventure, hack & slash, survival |
| 🍄 `platformer` | 3D platformer, obstacle course, collect-a-thon |
| 🧱 `sidescroller` | Mario-like, endless runner, metroidvania |
| 🗼 `towerdefense` | Tower defense, lane defense, wave survival |
| 🎯 `shooter` | FPS, arena or wave shooter |
| 🏰 `strategy` | RTS, city builder, colony sim |

Each one is explained in detail in [GAMES.md](GAMES.md).

## 3. Make your game (5 min)

```bash
npm run new my-game                    # copy of the starter
npm run new my-game -- --from rpg      # …or copy the sample closest to your idea
```

Open **http://localhost:5173/games/my-game/** and edit `games/my-game/main.js`. The page reloads every time you save.

Every game is just `index.html` + `main.js` (+ more `.js` files if you like) importing from `@engine`:

```js
import { Game, CharacterController, FollowCamera, GameMenu, setupEnvironment } from '@engine';

const game = new Game();
setupEnvironment(game, { sky: 'sunset' });
const hero = await game.assets.model('/assets/kaykit-adventurers/Knight.glb');
const player = game.add(new CharacterController(game, hero));
player.camera = game.add(new FollowCamera(game, player.object));
new GameMenu(game, { title: 'My Game' });
game.start();
```

## 4. Your first three changes

Do these in `games/my-game/main.js` (copied from the starter) to get a feel for the kit.

**a) Change the world's mood.** Find `setupEnvironment` and try:
```js
setupEnvironment(game, { sky: 'night', ground: { color: '#3a5f3a' } });   // or 'sunset', 'dungeon', 'underwater', 'space'
```

**b) Swap the hero.** In the asset browser, search "barbarian" and click it. Hide the parts you don't want by clicking them, copy the code, and replace `MODELS.hero`:
```js
hero: '/assets/kaykit-adventurers/Barbarian.glb',
```
Then adjust the `setVisible(...)` line, which says which weapons and hats are shown.

**c) Make coins worth something.** In the `Coin` class, play with the sound and effects:
```js
game.audio.play('powerup');                                   // try: coin, jump, hit, explosion, win…
game.effects.burst(this.position, { color: '#ff44aa', count: 40 });
game.effects.shake(0.3);
```

Now read [ENGINE.md](ENGINE.md) once from top to bottom (15 minutes). It's the whole toolbox.

## 5. Working as a team

- **One repo per team.** Fork or copy this kit, and everyone clones it.
- **Split by file, not by function.** Give each person their own module (`enemies.js`, `level.js`, `ui.js`, `player.js`) imported by `main.js`. Merge conflicts mostly happen when two people edit the same lines.
- **Commit small and often**, then `git pull --rebase` before you push.
- **Keep numbers in a `CONFIG` object** at the top of the file, so designers can tune things without reading code.
- **Playtest on someone else's machine early**, and on a phone using the Network URL.
- **Levels as text maps** (see `games/sidescroller` and `games/towerdefense`) let non-programmers build levels in any text editor.

## 6. Working with an AI assistant

The kit is written to be easy for AI coding assistants (Claude Code, Cursor, Copilot, …) to work with:

- **[`AGENTS.md`](../AGENTS.md)** at the repo root is their manual. Claude Code reads it automatically via `CLAUDE.md`; other tools often do too. If yours doesn't, tell it: *"Read AGENTS.md first."*
- **`docs/ASSET_LIST.md`** lists every model path and animation name, so the assistant doesn't have to guess paths.
- **`npm run check`** and **`npm run smoke`** let it test its own work. `smoke` opens your game in a hidden browser and saves screenshots to `.smoke/`. One-time setup: `npx playwright install chromium`.

Good prompts are specific and point at a sample:

> "In games/my-game, add skeleton enemies that chase the player, like games/rpg/enemy.js. Spawn one every 5 seconds near the forest edge. When they touch the player, take 10 HP and show a health bar. Run `npm run check` and `npm run smoke -- my-game` and look at the screenshot."

> "Replace the coins with fish from the quaternius-fish pack that swim in circles. Look up the names in docs/ASSET_LIST.md."

> "The player is too slow and jumps too low. Make movement snappier, like games/sidescroller."

Always play the result yourself. The assistant can see screenshots but can't feel whether it's fun.

## 7. A plan for the weekend

| When | Goal |
|---|---|
| **First hour** | Pick a sample, `npm run new`, and get the core action working with placeholder models. |
| **Hours 2–6** | The core loop: what the player does over and over, and why it's fun. Playtest every hour. |
| **Middle** | Goals and failure (score, timer, enemies, lives), then `menu.win()` / `menu.gameOver()`. |
| **Second-to-last block** | Juice: sounds, `effects.shake/burst/flash`, floating numbers, music, a nice title. |
| **Last 2 hours** | **Feature freeze.** Fix bugs, test on a phone, `npm run package`, upload, and write the submission text. |

Cut scope early. A small game that feels great beats a big one that's half finished.

## 8. Submitting

```bash
npm run package -- my-game
```

This builds your game into `dist/` and `dist.zip` (about 1 MB; the models stream from our CDN). Upload `dist.zip` to itch.io as an HTML game, or deploy `dist/` anywhere. Step-by-step instructions: [DEPLOY.md](DEPLOY.md).

---

## Cheat sheet

```js
// ---------- setup
const game = new Game({ gravity: -30, groundY: 0 });        // groundY: null = no floor
setupEnvironment(game, { sky: 'day' });                     // day | sunset | night | dungeon | space | underwater
await game.load([url1, url2]);                              // preload with a loading bar
const model = await game.assets.model(url, { scale: 2 });   // or { height: 1.8 }
game.start();

// ---------- things in the world
class Thing extends Entity { update(dt) { /* every frame */ } }
const t = game.add(new Thing(model, { tags: ['enemy'] }));
t.position.set(0, 0, 5);  t.destroy();
game.findAll('enemy');  game.findNear(pos, 10, 'enemy');
game.after(2, fn);  game.every(5, fn);  game.onUpdate((dt) => {});

// ---------- input
game.input.down('KeyW');  game.input.pressed('Space');  game.input.move();   // {x, y}
game.input.mousePressed(0);  game.mouseGround();                              // click → ground point

// ---------- animation, health, AI
const anim = new Animator(model);  anim.play('Run');  anim.once('Attack', { then: 'Idle' });  anim.update(dt);
const hp = new Health(100, { onDeath: () => {} });  hp.damage(10);
const ai = new StateMachine({ idle: { update() {} }, chase: { enter() {} } }, 'idle');  ai.update(dt);

// ---------- physics
game.physics.addCollider(wallModel);                        // solid box
const body = new Body(game.physics, { radius: 0.4, height: 1.8 });  body.move(dt);
game.physics.raycast(origin, dir, { entities: game.findAll('enemy') });

// ---------- feedback
game.audio.play('coin');  game.effects.burst(pos);  game.effects.shake(0.3);
game.ui.text('Score: 0', { top: 16, left: 16 });  game.ui.floatingText(pos, '+10');
const menu = new GameMenu(game, { title: 'My Game' });  menu.win({ score });  menu.gameOver({ score });
new TouchControls(game, { joystick: true, buttons: [{ label: 'Jump', key: 'Space' }] });
```
