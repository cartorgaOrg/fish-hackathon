# 05 — Hosted Fish agent + your own LLM server ("game master")

> 🤖 **Coding agent?** First run `npx skills add https://docs.fish.audio` (official Fish Audio skills) and read [AGENTS.md](../../AGENTS.md).

Fish's hosted agent still does speech-to-text, turn-taking, and text-to-speech. Instead of
Fish's own hosted model deciding what the NPC says, **your server** does: Fish calls your
server as an OpenAI-compatible `POST /v1/chat/completions` endpoint for every conversational
turn, and your server owns the game state and the reply.

```
 player mic                    Fish agent                      your server
┌───────────┐   audio    ┌──────────────────────┐  POST /v1/chat/completions   ┌─────────────────┐
│  (voice)   │ ─────────▶ │ STT · turn-taking     │ ────────────────────────▶  │  server.py       │
└───────────┘             │ · TTS (S2 model)      │                             │  (this example)   │
      ▲                   │                        │ ◀──────────────────────── │  game.py (state,  │
      │  spoken audio     │  LiveKit / WebRTC      │   SSE: chat.completion     │  context, mock or │
      └───────────────────┤                        │   chunks, [DONE]           │  real LLM call)   │
                           └──────────────────────┘                             └─────────────────┘
                                                                                         │
                                                                                         ▼ (optional)
                                                                                  real OpenAI-compatible
                                                                                  LLM (LLM_API_KEY set)
```

## Why this instead of 04-agent-web?

[`04-agent-web`](../04-agent-web) lets Fish's hosted model drive the conversation; your game
reacts via injected text and tool calls. That's the lowest-effort path.

Use **this** example when you need:

- Full control over the system prompt and conversation history on every turn (not just at
  session start).
- Game state (quest flags, inventory, NPC mood) read and written on your own infrastructure,
  not just passed through Fish's dynamic variables.
- To swap in any LLM, including one you host yourself, with no platform model fallback.

The cost: you own a server that must reply fast (see "Latency" below) and must speak valid
OpenAI SSE, or the agent goes silent mid-turn.

## Connecting your real game

> **`game.py` is a mockup, not where your game has to live.** It's a stand-in so this example runs
> end to end. Your real game can live anywhere (engine, browser, backend); it just has to provide
> the inputs and handle the outputs below. Then delete the mockup.

- **Your game provides:** the current game state for each session (pushed via `POST /game/{id}/event` or read from your own store) and, if you like, your own reply logic.
- **Your game gets back:** every conversation turn (so you decide what the NPC says) and tool results to update your state.

The mockup in [`game.py`](game.py) shows each touch point, marked with `GAME HOOK` comments:

- `NPC_PROMPT` — the one-sentence persona.
- `get_state` / `apply_event` — the (MOCKUP, in-memory) game state store.
- `build_context(state)` — renders state into a system message injected before every turn.
- `mock_reply(messages, state)` — the MOCKUP reply used when `LLM_API_KEY` is unset.
- `on_tool_result(session_id, tool_name, tool_result)` — react to a tool call's result
  (quest progress, ending the conversation, changing mood/emotion tags).

`server.py` is audio/transport plumbing only: auth, SSE framing, and forwarding to a real
LLM when configured. It should not need game-specific edits.

## Run it

```bash
cp -n ../../.env.example ../../.env   # creates fish-audio/.env if missing
# in fish-audio/.env fill in FISH_API_KEY and set:
#   CUSTOM_LLM_API_KEY=<any long random string>
uv run uvicorn server:app --port 8000
```

With no `LLM_API_KEY` set, every reply is `game.mock_reply`'s MOCKUP line. Set `LLM_API_KEY`
(+ optionally `LLM_BASE_URL`, `LLM_MODEL`) to forward turns to a real OpenAI-compatible LLM
instead — context injection and tool-call handling work the same either way.

### New env var this example adds

| Var | Required | Purpose |
|---|---|---|
| `CUSTOM_LLM_API_KEY` | Yes (has an insecure dev default with a startup warning) | The Bearer token Fish must send on every `/v1/chat/completions` call. Set the same value in `configure_agent.py` / the Fish console's `llm.custom.api_key`. |

### Expose your server and point an agent at it

Fish needs a public HTTPS URL. For local dev, tunnel port 8000:

```bash
cloudflared tunnel --url http://localhost:8000
# or: ngrok http 8000
```

Set the printed URL as `PUBLIC_URL` in `.env`, then create or update the agent:

```bash
uv run python configure_agent.py
```

This `PATCH`es (or creates, then prints the new `FISH_AGENT_ID` to save) the agent's
`llm.custom` config to `{base_url: "$PUBLIC_URL/v1", model: "game-master", api_key: $CUSTOM_LLM_API_KEY}`.
**Draft config changes only reach live calls after a publish** — the script prints the
`POST .../publish` curl command to run next.

Then talk to the agent either via the Fish console's preview call, or with
[`04-agent-web`](../04-agent-web)'s web client pointed at the same `FISH_AGENT_ID`.

## Testing locally (no FISH_API_KEY needed)

This server is fully testable without any Fish credentials — it's a plain HTTP service.

```bash
uv run pytest
```

Or run it and curl it directly, shaped like Fish's real request:

```bash
uv run uvicorn server:app --port 8000 &
export CUSTOM_LLM_API_KEY=<the same value as in fish-audio/.env>

curl -N -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer $CUSTOM_LLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "game-master",
    "stream": true,
    "messages": [{"role": "user", "content": "Hello, guard."}],
    "session_id": "sess_demo",
    "fishaudio_extra_body": {"game_session_id": "demo"}
  }'
```

Push a game event, then watch the next reply react to it (context injection demo).
`/game/{id}/event` is protected by the same `CUSTOM_LLM_API_KEY` bearer check as
`/v1/chat/completions`, so send the header here too:

```bash
curl -X POST http://localhost:8000/game/demo/event \
  -H "Authorization: Bearer $CUSTOM_LLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event": "sword_drawn"}'
# re-run the curl above with the same game_session_id — the reply changes to the "wary" line
```

## Latency

Fish's turn-taking expects your **first token fast**. Every millisecond here is added to the
round trip the player hears as silence. Concretely:

- Keep `game.build_context` short — it's injected on every single turn.
- With a real LLM, prefer small/fast models for latency-critical NPCs; save large models for
  turns where quality matters more than speed.
- If your real LLM call itself is slow to produce a first token, consider streaming a short
  filler line (e.g. "[thinking]...") as the first chunk while the real completion is still
  being generated, then correcting it — Fish's S2 TTS speaks `[bracket]` tags as delivery cues,
  so a filler can double as a natural pause.

## Tool calls

When the agent has tools configured and the model (mock or real) returns `tool_calls`, Fish
executes the tool and sends a follow-up request with the assistant's `tool_calls` message and
a `role: "tool"` result message appended to `messages`. `server.py` detects this and calls
`game.on_tool_result` so your game logic can react (see the `pay_toll` example in `game.py`).

## Docs this relies on

- [Custom LLM](https://docs.fish.audio/agents/build/custom-llm.md) — the request/response
  contract this server implements.
- [Agent configuration](https://docs.fish.audio/agents/build/configuration.md) — `llm.custom`
  and the rest of the agent config schema.
- [Tools](https://docs.fish.audio/agents/build/tools.md) and
  [Webhook tools](https://docs.fish.audio/agents/build/webhook-tools.md).
- [Dynamic variables](https://docs.fish.audio/agents/build/dynamic-variables.md) and
  [Deploy overview](https://docs.fish.audio/agents/deploy/overview.md) — starting a session,
  `dynamic_variables`, `llm_extra_body`.
- [`api-reference/openapi.json`](https://docs.fish.audio/api-reference/openapi.json) — exact
  schemas for `PATCH /v1/agent/agents/{id}/config` (`PublicAgentLLMPatch`,
  `PublicAgentLLMCustomConfig`) and `POST /v1/agent/sessions` (`llm_extra_body`,
  `dynamic_variables`), used in `configure_agent.py`.
