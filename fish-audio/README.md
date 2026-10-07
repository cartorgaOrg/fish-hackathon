# 🔊 Fish Audio: the voice part

Starting blocks for the **audio layer** of a voice-driven game, built on [Fish Audio](https://fish.audio).
This folder gives you working, copy-pasteable snippets for making characters **speak**, **listen** and
**hold conversations**, plus docs on the concepts behind them. The game itself lives next door in
[`../game-kit/`](../game-kit/) (or anywhere else you like). See the [root README](../README.md) for how the two fit together.

## 🤖 Building with an AI coding agent? Start here

Give your agent the official Fish Audio knowledge **before** it writes code:

```bash
npx skills add https://docs.fish.audio
```

This installs two official skills, **`fish-audio-sdk`** (Python and JS SDK signatures) and **`fish-audio-api`**
(raw REST and WebSocket protocol), for Claude Code, Cursor, Codex and others. Claude Code users already have them:
they are committed in [`.claude/skills/`](../.claude/skills/) at the repo root. Also point your agent at:

| Resource | URL |
|---|---|
| Doc index for LLMs | https://docs.fish.audio/llms.txt |
| Full docs in one file | https://docs.fish.audio/llms-full.txt |
| Fish Audio MCP server (tools: voices, TTS, STT) | `https://api.fish.audio/mcp` |
| This folder's rules for agents | [AGENTS.md](AGENTS.md) |

> Every example runs with only a `FISH_API_KEY`. The "game brain" in each example is a clearly marked
> **MOCKUP** (a one-sentence prompt or a fake LLM that always returns the same line). Replace it with
> your game.

## Quick start

```bash
cd fish-audio               # every command below runs from this folder
cp .env.example .env        # then paste your FISH_API_KEY (https://fish.audio/app/api-keys)
cd examples/01-tts-basics   # pick any example and follow its README
```

Python examples use [uv](https://docs.astral.sh/uv/) (`uv run ...`). Browser examples use Node 20+.

### Try both conversation options in one page

```bash
node playground/start.mjs   # then open http://localhost:3000 (needs FISH_API_KEY and FISH_AGENT_ID in .env)
```

The playground has two tabs, **Fish hosted agent** and **Own pipeline**, each with a short explanation of how
it's set up. Run `npm run create-agent` in `examples/04-agent-web` once to get a `FISH_AGENT_ID`.
Use Chrome and headphones.

## Pick a path

| | Path | Control | Effort | Start here |
|---|---|---|---|---|
| 🔊 | **Just speech**: narrator, NPC barks, cutscenes | — | Lowest | [01-tts-basics](examples/01-tts-basics) · [03-npc-voice-factory](examples/03-npc-voice-factory) |
| ⚡ | **Streaming speech**: an LLM's text spoken as it is generated | Medium | Low | [02-streaming-tts](examples/02-streaming-tts) |
| 🗣️ | **A. Hosted Fish agent**: Fish runs STT + LLM + TTS + turn-taking; your game injects events and receives tool calls | Medium | Low | [04-agent-web](examples/04-agent-web) |
| 🧠 | **B. Hosted agent + your own LLM server**: Fish handles voice, your "game master" server owns state and replies | High | Medium | [05-agent-custom-llm](examples/05-agent-custom-llm) |
| 🔧 | **C. Own pipeline**: mic → voice detection → STT → LLM → streaming TTS, every piece swappable | Full | Highest | [06-own-pipeline](examples/06-own-pipeline) |

Not sure which one fits? Read [docs/00-choose-your-path.md](docs/00-choose-your-path.md).

## Connecting your real game

Each example has a `game.py` / `game.ts` / `game.js` file. **It is a mockup, not the place your game has
to live.** It's a tiny fake game (one NPC, one prompt, a fixed `[MOCKUP]` reply) that exists only so the
example's audio pipeline runs end to end and you can test it.

What to take from it is the **interface**: what the audio code needs *from* a game (state, events, text
to speak) and what it hands *back* (transcripts, replies, tool calls or actions). Your real game can live
anywhere: a game engine, the browser, a separate backend service. Feed the audio code those same inputs
and handle the same outputs, and delete the mockup.

```bash
grep -rn "GAME HOOK" examples/     # the touch points between audio code and a game
grep -rn "MOCKUP" examples/        # fake behaviour standing in for a real game
```

See [CONVENTIONS.md](CONVENTIONS.md) for details.

## Docs

- [docs/00-choose-your-path.md](docs/00-choose-your-path.md): decision tree and trade-offs
- [docs/concepts/](docs/concepts/): latency, turn-taking, context injection, emotion tags, voices, NPC prompting
- [docs/gotchas.md](docs/gotchas.md): things that will bite you (read this one)
- [docs/fish-audio-links.md](docs/fish-audio-links.md): curated links into the official Fish Audio docs
