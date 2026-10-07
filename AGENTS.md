# AGENTS.md: guidance for coding agents

You are helping a hackathon team build a **voice-driven game** with Fish Audio. Voice is the focus of the
hackathon; the game kit is a place to put it. This repo is a monorepo with two independent parts. Figure out which part the task touches, then read **that part's `AGENTS.md`** before
writing code. Its rules apply inside its folder.

| Folder | What it is | Read first |
|---|---|---|
| `fish-audio/` | Fish Audio voice examples: TTS, STT, hosted agents, own pipeline. Python (uv) + Node/TS. | [fish-audio/AGENTS.md](fish-audio/AGENTS.md) |
| `game-kit/` | 3D browser game kit: three.js engine, sample games, CC0 models. Plain JS ES modules, Vite. | [game-kit/AGENTS.md](game-kit/AGENTS.md) |

Claude Code also loads `fish-audio/CLAUDE.md` and `game-kit/CLAUDE.md` when you work on files in those folders.

## Rules that apply everywhere

1. **Run commands from the part's folder.** There is no root `package.json`. `npm run dev/check/smoke` run in
   `game-kit/`; Fish examples run in their own `fish-audio/examples/NN-name/` folder.
2. **Never put `FISH_API_KEY` in browser code**, and that includes everything under `game-kit/games/`. The
   game calls a small server (proxied by Vite under `/api`), and the server calls Fish Audio. Keys live in
   `fish-audio/.env` (template: `fish-audio/.env.example`), which is gitignored.
3. **Don't guess Fish Audio APIs.** Read the skills in `.claude/skills/` (repo root) and the docs links in
   [fish-audio/AGENTS.md](fish-audio/AGENTS.md) first.
4. **Don't guess asset paths or animation names.** Look them up in `game-kit/docs/ASSET_LIST.md`.
5. **Never add an asset without a known license.** Models, sounds, music, fonts and images must be CC0 or
   another license that allows the use (see [LICENSING.md](LICENSING.md)). Record the file, author, license and
   source URL in a `LICENSE.txt` next to the file, and tell the user about any credit requirement. Never fetch
   assets from random sites or other games. Prefer the bundled CC0 packs and the engine's synthesized sounds.
6. **Keep the parts independent.** No imports across `game-kit/` and `fish-audio/`. To use a Fish example in a
   game, copy the code you need into the game's folder (or a server next to it) and adapt it to the game kit's
   conventions (plain JS, no TypeScript in `game-kit/games/`).

## Putting the voice in a game

The table in the root [README.md → Putting the voice in your game](README.md#putting-the-voice-in-your-game) maps game
needs to Fish examples. In short:

- **Pre-generated lines:** generate MP3s with `fish-audio/examples/01-tts-basics` or `03-npc-voice-factory`,
  save them to `game-kit/public/sounds/`, then `await game.audio.load(name, '/sounds/<file>.mp3')` and
  `game.audio.play(name)`.
- **Live speech or conversation:** run a server from `fish-audio/examples/04`, `05` or `06`, and add a Vite proxy
  in `game-kit/vite.config.js` (`server: { proxy: { '/api': 'http://localhost:8787' } }`, as in
  `fish-audio/examples/04-agent-web/vite.config.ts`). Wire the game to the example's `GAME HOOK` points and
  delete its `MOCKUP` game.

## Verify

- Voice changes: run the example as its README says. Without a `FISH_API_KEY` you can only check the mock
  paths, so say so when you report back.
- Game changes: `npm run check` and `npm run smoke -- <game>` in `game-kit/`, then look at the screenshots in
  `game-kit/.smoke/` (see game-kit/AGENTS.md section 6).
