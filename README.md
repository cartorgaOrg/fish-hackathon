# 🐟 Fishathon Starter Kit

Build a game with **characters that talk, listen and hold conversations**, powered by [Fish Audio](https://fish.audio).
Voice is the heart of this hackathon. The repo gives you working voice examples first, and a 3D browser game kit
to put them in.

| | Folder | What it gives you | You need | Start here |
|---|---|---|---|---|
| 🔊 | [`fish-audio/`](fish-audio/) | **The voice (start here).** Working examples for making characters **speak** (text-to-speech), **listen** (speech-to-text) and **hold conversations** (voice agents), from a simple narrator to a full voice pipeline. | A Fish Audio API key, plus [uv](https://docs.astral.sh/uv/) (Python) and/or Node.js 20+ | [fish-audio/README.md](fish-audio/README.md) |
| 🎮 | [`game-kit/`](game-kit/) | **The game to put it in.** A small three.js engine, 8 playable sample games (RPG, platformer, fishing, shooter…) and 780+ free 3D models. Plain JavaScript, runs in the browser. | Node.js 20+ | [game-kit/README.md](game-kit/README.md) |

Each part has its own README, docs and `AGENTS.md`. The voice examples work with any game: the game kit, a
game engine like Unity or Godot, or your own code.

## 🤖 Building with an AI coding agent? Start here

Give your agent the official Fish Audio skills **before** it writes any voice code. Run this **from the repo root**:

```bash
npx skills add https://docs.fish.audio
```

Claude Code users already have them: they are committed in [`.claude/skills/`](.claude/skills/).
Then point your agent at [AGENTS.md](AGENTS.md). It explains the two parts and sends the agent to the right
`AGENTS.md` for whatever it's working on. Claude Code loads it automatically (via `CLAUDE.md`).

## Quick start

```bash
git clone https://github.com/cartorgaOrg/fish-hackathon.git my-team
cd my-team
```

**1. Hear your first voice** (needs a Fish Audio key from https://fish.audio/app/api-keys):

```bash
cd fish-audio
cp .env.example .env         # paste your FISH_API_KEY into .env
cd examples/01-tts-basics    # pick any example and follow its README
```

Then pick how your game will use voice in [fish-audio/docs/00-choose-your-path.md](fish-audio/docs/00-choose-your-path.md):
just speech, streaming speech, or a full conversation with an NPC.

**2. Run the game kit** (no keys needed, works offline). Open a new terminal in the `my-team` folder:

```bash
cd game-kit
npm install
npm run dev                  # keeps running; open the URL it prints (usually http://localhost:5173)
```

Leave that running. In a **second terminal**, inside `my-team/game-kit`, make your own game:

```bash
npm run new my-game          # then open /games/my-game/ and edit game-kit/games/my-game/main.js
```

New to making games? Read [game-kit/docs/GETTING_STARTED.md](game-kit/docs/GETTING_STARTED.md) (15 minutes).

## Putting the voice in your game

The game runs **in the browser**. Fish Audio needs your **secret API key**. A key in browser code can be
read by anyone who opens your game, so the browser never talks to Fish Audio with your key. Instead:

```
 your game (browser)                     small server (yours)                 Fish Audio
 ───────────────────                     ────────────────────                 ──────────
 games/my-game/main.js  ── /api/... ──▶  holds FISH_API_KEY      ── HTTPS ──▶  TTS / STT / agents
                        ◀── audio  ───   (from fish-audio/)      ◀──────────
```

Pick the simplest option that fits your game idea:

| | I want… | How | Copy from |
|---|---|---|---|
| 🔊 | **Pre-written lines** (narrator, NPC barks, cutscenes) | Generate MP3s once, put them in `game-kit/public/sounds/`, play them with `await game.audio.load('intro', '/sounds/intro.mp3')` then `game.audio.play('intro')`. No server at runtime. | [01-tts-basics](fish-audio/examples/01-tts-basics) · [03-npc-voice-factory](fish-audio/examples/03-npc-voice-factory) |
| 🗣️ | **An NPC the player can talk to** | Run the example's token server, then add `server: { proxy: { '/api': 'http://localhost:8787' } }` to `game-kit/vite.config.js` so your game can call `/api/session`. Port the browser code from `src/main.ts` into your game as plain JS. | [04-agent-web](fish-audio/examples/04-agent-web) |
| 🧠 | **NPC replies that depend on game state** | Same as above, plus your own "game master" server that decides what the NPC says. | [05-agent-custom-llm](fish-audio/examples/05-agent-custom-llm) |
| 🔧 | **Full control** (voice commands, custom turn-taking) | Your own server runs mic → STT → LLM → TTS; the game talks to it over a WebSocket. | [06-own-pipeline](fish-audio/examples/06-own-pipeline) |

Every Fish example marks its touch points with `GAME HOOK` (where a game plugs in) and `MOCKUP` (fake game
logic to replace). Find them with `grep -rn "GAME HOOK" fish-audio/examples/`.

### Ports when everything runs at once

| Port | What | Started by |
|---|---|---|
| 3000 | Fish voice playground (both conversation options in one page) | `node playground/start.mjs` in `fish-audio/` |
| 5174 | Hosted agent page (inside the playground) | the playground |
| 8787 | Agent token server | the playground, or `npm run server` in `fish-audio/examples/04-agent-web/` |
| 8001 | Own-pipeline server | the playground, or `fish-audio/examples/06-own-pipeline/` |
| 5173 | Game kit dev server | `npm run dev` in `game-kit/` |

## Repo layout

```
README.md            you are here
LICENSING.md         what you may use, sell and must credit (voices, models, code, your own assets)
AGENTS.md            map for AI coding agents (start here, then the part's own AGENTS.md)
.claude/skills/      official Fish Audio skills for Claude Code (shared by the whole repo)

fish-audio/          🔊 the voice part (Python with uv, and Node)
  examples/NN-name/    self-contained examples, from simple TTS to a full voice pipeline
  playground/          try both conversation options in one page
  docs/                choose your path, concepts, gotchas, links to the official docs
  .env.example         copy to fish-audio/.env and add your FISH_API_KEY

game-kit/            🎮 the game part (Node + Vite + three.js)
  engine/              reusable game primitives, imported as '@engine'
  games/<name>/        one folder per game: the samples, and yours
  public/assets/       780+ CC0 3D models
  docs/                getting started, engine API, recipes, assets, deploy, troubleshooting
  scripts/             new-game, check, smoke, package, asset tools
```

## Credits & license

**Read [LICENSING.md](LICENSING.md) before you add outside assets or sell your game.** In short:

- **Voices: [Fish Audio](https://fish.audio) terms.** Free accounts are for personal, non-commercial use, so selling a game with generated voices needs a paid plan. Only clone voices you have permission to use.
- **3D models: CC0** (public domain) by **Kay Lousberg** ([KayKit](https://kaylousberg.com)) and **[Quaternius](https://quaternius.com)**. Use them in anything, including games you sell. Credit is appreciated, not required.
- **Game kit code: MIT** (see [game-kit/LICENSE](game-kit/LICENSE)).
- **Anything you add** (models, sounds, music, fonts) needs a license that allows it. LICENSING.md has a table of what's OK.
