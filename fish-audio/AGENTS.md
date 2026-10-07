# AGENTS.md: guidance for coding agents

You are helping a hackathon team build a game that uses Fish Audio for voice. This folder (`fish-audio/`)
contains **audio starting blocks only**. The game lives in [`../game-kit/`](../game-kit/AGENTS.md) or wherever
the team builds it. The [root AGENTS.md](../AGENTS.md) explains how the two parts connect.
All paths below are relative to `fish-audio/` unless they say "repo root".

## Step 0: load the official Fish Audio skills (do this first)

```bash
# run these from the repo root (one level up), so the skills land in the shared .claude/skills/
npx skills add https://docs.fish.audio                 # interactive: choose your agent
npx skills add https://docs.fish.audio -s '*' -a claude-code --copy -y   # non-interactive (swap the agent: cursor, codex, ...)
```

Claude Code: they are already committed in `.claude/skills/` at the repo root, so read them before writing any Fish Audio code.
Note: the skill files mention a `references/` folder that is not shipped. For deeper detail, fetch
https://docs.fish.audio/llms-full.txt or the specific page from https://docs.fish.audio/llms.txt.

## Ground truth: always check the official Fish Audio docs

Do not guess Fish Audio APIs from memory. They change. Use, in order:

1. **Installed skills** (exact SDK signatures and the raw protocol):
   - `../.claude/skills/fish-audio-sdk/SKILL.md`: Python `fishaudio` (PyPI `fish-audio-sdk`) and JS `fish-audio`
   - `../.claude/skills/fish-audio-api/SKILL.md`: raw REST and WebSocket: auth, MessagePack, streaming protocol
   - Reinstall or update with: `npx skills add https://docs.fish.audio`
2. **Doc index for LLMs**: https://docs.fish.audio/llms.txt (every page also exists as `.md`)
   **Full dump**: https://docs.fish.audio/llms-full.txt
3. **API specs**: https://docs.fish.audio/api-reference/openapi.json (REST) and
   https://docs.fish.audio/api-reference/endpoint/websocket/tts-live.md (WebSocket TTS; the asyncapi.yml listed in llms.txt is a 404)
4. **MCP server** (gives tools rather than docs: search voices, generate speech, transcribe):
   `https://api.fish.audio/mcp` (OAuth)

Curated per-topic links: [docs/fish-audio-links.md](docs/fish-audio-links.md).

## Facts that are easy to get wrong

- Fish **speech-to-text is batch only** (`POST /v1/asr`, whole file in, whole transcript out). There is no
  streaming STT. Detect end of speech first (VAD), then upload the clip. Fish **agents** handle STT for you.
- TTS model IDs: `s2.1-pro` (recommended), `s2.1-pro-free` (free, no latency guarantees), `s2-pro`, `s1` (legacy).
  The SDK type hints only list `s1` and `s2-pro`, but `s2.1-pro` works over the wire (cast or `# type: ignore`).
- Emotion and delivery control on S2 models uses **[square brackets]** with free-form text, e.g.
  `[whispering] Over here.` (S1 used `(parentheses)`). Keep it to at most 3 tags per sentence.
- Python SDK `latency` only accepts `"normal"` or `"balanced"`. The raw WebSocket also accepts `"low"`.
- Fish agents run over **WebRTC (LiveKit)**. Client → server events include `user.message` (inject text;
  `"audio": false` makes it silent context) and `user.interrupt`. The server calls client tools via `client_tool.call`.
- A custom LLM for agents is an **OpenAI-compatible `POST /chat/completions` with `stream: true` (SSE)**.
  `llm_extra_body` set on the session arrives as `fishaudio_extra_body`.
- Starter-tier concurrency is **5 simultaneous requests** per account.

## Repo conventions (follow them when extending)

- Each example's `game.*` file is a **mockup harness** so the example runs; it is NOT where a team's game must live.
  When integrating a real game, keep the audio code, wire the game (engine, frontend, backend, wherever it is)
  to the `GAME HOOK` touch points, and delete the mockup. Don't grow the real game inside `game.*` by default.
- Placeholder behaviour is marked `MOCKUP`. When you replace a mockup, remove the marker.
- Config comes from env vars (see `.env.example`). Never hardcode keys. Never expose `FISH_API_KEY` to a browser:
  browser code must get tokens or audio through a small server.
- An LLM is optional. With `LLM_API_KEY` unset, examples use the mock. Any OpenAI-compatible provider works
  (`LLM_BASE_URL`, `LLM_MODEL`).

More detail in [CONVENTIONS.md](CONVENTIONS.md).
