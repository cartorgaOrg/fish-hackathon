# 04 - Agent Web

> 🤖 **Coding agent?** First run `npx skills add https://docs.fish.audio` (official Fish Audio skills) and read [AGENTS.md](../../AGENTS.md).

A hosted **Fish Agent** (STT + LLM + TTS + turn-taking, all run by Fish) talking to a browser page over
WebRTC. Your game injects events and dynamic variables, and receives tool calls when the agent decides to
act. There is no custom LLM here — see [05-agent-custom-llm](../05-agent-custom-llm) for that.

## Architecture

```
┌──────────────┐   mic / speaker audio    ┌───────────────┐
│   Browser    │ ◄──────────────────────► │  Fish Agent    │
│  (src/*.ts)  │   client-event / agent-  │  (hosted:      │
│              │   event data channels    │  STT+LLM+TTS)  │
└──────┬───────┘        (LiveKit/WebRTC)  └───────────────┘
       │ POST /api/session (no FISH_API_KEY in the browser)
       ▼
┌──────────────┐
│ server/       │  mints a short-lived session token with
│ server.mjs    │  FISH_API_KEY + FISH_AGENT_ID
└──────────────┘
```

- The browser never sees `FISH_API_KEY`. It asks `server/server.mjs` for a session; that server calls
  `POST /v1/agent/sessions` with the key and hands back a short-lived token.
- `@fishaudio/agent-client` (`AgentSession`) takes that token, opens the mic, and connects over WebRTC
  (LiveKit). See [Authenticated sessions](https://docs.fish.audio/agents/deploy/authentication.md) and the
  [Web SDK](https://docs.fish.audio/agents/deploy/web-sdk.md).

## Run it

```bash
cp -n ../../.env.example ../../.env   # creates fish-audio/.env if missing; fill in FISH_API_KEY
npm install
npm run create-agent               # creates a demo NPC agent, prints an agent id
# paste the printed id into FISH_AGENT_ID in your .env
npm run server                     # terminal 1: token server on :8787
npm run dev                        # terminal 2: Vite dev server, opens the page
```

`npm run create-agent` is **not idempotent**: every run creates a brand new agent and two new tools, it
never updates or reuses existing ones. Run it once, keep the printed `FISH_AGENT_ID`, and don't re-run it
unless you want another agent (clean up the extras in the [console](https://fish.audio/app/agents) if you
do).

Click **Start call**, allow the microphone, and talk. Use the **Game events** buttons to inject text the
agent reacts to without speaking it back. Tool calls (`open_gate`, `give_item`) show up in the Tool calls
log and update the Game state panel.

If `npm run create-agent` fails or you'd rather not run it, create the agent by hand in the
[console](https://fish.audio/app/agents): new agent, system prompt
`You are {{npc_name}}, a {{npc_role}} in a fantasy village. The player's reputation is {{player_reputation}}. Reply in 1-2 short sentences.`,
first message `Well now, look who's come knocking.`, then add two **client** tools under **Tools**:
`open_gate` (no arguments, "expects response" on) and `give_item` (one argument `item_name`, "expects
response" on). Publish, then copy the agent id into `FISH_AGENT_ID`.

## Connecting your real game

> **`src/game.ts` is a mockup, not where your game has to live.** It's a stand-in so this example runs
> end to end. Your real game can live anywhere (engine, browser, backend); it just has to provide
> the inputs and handle the outputs below. Then delete the mockup.

- **Your game provides:** facts for the prompt at session start (dynamic variables) and game events during the call (silent `sendUserMessage`).
- **Your game gets back:** client tool calls (`open_gate`, `give_item`) to apply to your game state, plus transcripts.

The mockup in [`src/game.ts`](src/game.ts) shows each touch point: the fake `gameState`, the dynamic variables derived from
it, the two client tool handlers, and the list of game-event buttons. Everything else
([`src/main.ts`](src/main.ts), [`server/server.mjs`](server/server.mjs)) is audio/session plumbing you
should rarely need to touch. `grep -n "GAME HOOK" src/game.ts` for the exact spots.

Dynamic variables render straight into the agent's system prompt, and this demo's `server/server.mjs`
forwards whatever `dynamicVariables` the browser sent. That's fine for a local demo but not safe for a
real game: build them server-side from trusted game state (keyed by the authenticated user), not from
client input.

## Concepts

- **Client tools vs. webhook tools vs. system tools.** Client tools (used here) run in your browser code,
  via the SDK — use them for anything only your frontend/game state can do. Webhook tools call your HTTP
  backend from Fish's servers. System tools (like hanging up) are built-in platform capabilities you just
  switch on. See [Tools](https://docs.fish.audio/agents/build/tools.md),
  [Client tools](https://docs.fish.audio/agents/build/client-tools.md),
  [System tools](https://docs.fish.audio/agents/build/system-tools.md).
- **Context injection via a silent `user.message`.** `session.sendUserMessage(text)` (no `{audio: true}`)
  tells the agent "the user said this" so it updates its understanding and can bring it up later, without
  synthesizing speech for that turn. This is how a game steers the conversation (e.g. "[GAME EVENT] night
  falls") without writing a custom LLM. See the
  [wire protocol](https://docs.fish.audio/agents/deploy/protocol.md#client-events-client-event).
- **Dynamic variables vs. overrides.** Dynamic variables (`{{npc_name}}`, ...) fill placeholders in the
  agent's existing prompt per session. Overrides replace whole fields (the entire system prompt, the first
  message, the voice) for one session. See
  [Dynamic variables](https://docs.fish.audio/agents/build/dynamic-variables.md).
- **When to move to a custom LLM.** If your game needs to see every player message before the agent
  replies (to run its own rules, inventory, or combat logic rather than just reacting to injected events
  and tool calls), move to [05-agent-custom-llm](../05-agent-custom-llm): Fish still handles voice, but your
  server owns the conversation.

## Docs used

- [Agents overview](https://docs.fish.audio/agents/overview.md) ·
  [Quickstart](https://docs.fish.audio/agents/quickstart.md) ·
  [Concepts](https://docs.fish.audio/agents/concepts.md)
- [Configuration](https://docs.fish.audio/agents/build/configuration.md) ·
  [Client tools](https://docs.fish.audio/agents/build/client-tools.md) ·
  [System tools](https://docs.fish.audio/agents/build/system-tools.md) ·
  [Dynamic variables](https://docs.fish.audio/agents/build/dynamic-variables.md)
- [Deploy overview](https://docs.fish.audio/agents/deploy/overview.md) ·
  [Authentication](https://docs.fish.audio/agents/deploy/authentication.md) ·
  [Public agents](https://docs.fish.audio/agents/deploy/public-agents.md) ·
  [Web SDK](https://docs.fish.audio/agents/deploy/web-sdk.md) ·
  [Wire protocol](https://docs.fish.audio/agents/deploy/protocol.md)

## Tested

- `npm install`, `npx tsc --noEmit`, and `npm run build` all pass.
- `npm run server` with no `FISH_API_KEY` starts and `/api/session` returns a clear JSON error.
- No `FISH_API_KEY` was available in this environment, so a real call was never placed: `create-agent.mjs`,
  the session REST call, and the live SDK event flow (transcripts, tool calls, silent `sendUserMessage`
  injection) are implemented per the docs above but unverified end-to-end. If you have a key, running
  through "Run it" above is the fastest way to confirm.
