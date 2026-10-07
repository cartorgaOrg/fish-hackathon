# Context injection

Two directions: telling the voice AI what's happening in the game (game → AI), and letting the AI
affect the game (AI → game).

## Game → AI: how the game tells the AI what's happening

| Mechanism | Path | When to use it |
|---|---|---|
| System prompt | All | Static persona and rules — see [npc-prompting.md](npc-prompting.md) |
| Dynamic variables `{{var}}` | Agents (A/B) | Per-session values known at session start (player name, difficulty) |
| Session overrides | Agents (A/B) | Replace the whole prompt/voice/first-message for one session |
| Silent `user.message` | Agents (A/B) | Inject game events mid-conversation without the NPC "hearing" them |
| Request body fields | Custom LLM (B) | Your server receives full context + your own extra data every turn |
| Message building | Own pipeline (C) | You construct the LLM message list yourself — full control |

### Dynamic variables (agents)

Write `{{name}}` placeholders in the system prompt or first message; supply values when you create
the session. Values are substituted once, when the session starts — not live-updated afterwards.

```json
// POST /v1/agent/sessions
{
  "agent_id": "YOUR_AGENT_ID",
  "dynamic_variables": { "player_name": "Ada", "location": "bridge" }
}
```

A placeholder with no matching variable is **not** removed — the literal `{{player_name}}` text
stays in the prompt, visible to the model. Always supply every variable you reference.

### Session overrides (agents)

`overrides` on the same request replaces whole fields (`system_prompt`, `first_message` or
`first_message_prompt`, `voice_id`, `language`) for one session — use this when the persona itself
changes per player, not just a value inside it. `first_message` is spoken verbatim;
`first_message_prompt` is instructions the agent generates its opener from instead — they're
mutually exclusive, sending both is rejected. Keyless (public-agent) sessions may override only
`voice_id` and `language`; prompt-shaping overrides need a session created from your backend.

### Silent `user.message` (agents, mid-conversation)

Send a text turn the agent reacts to without speaking it back as if the player said it, and
without synthesizing audio for that turn — useful for feeding game events ("the bridge collapses")
into an ongoing conversation:

```json
// client → agent, over the client-event channel
{ "type": "user.message", "text": "[event] The bridge is now on fire.", "audio": false }
```

`"audio": false` makes the agent answer in text only (no speech, reply arrives over transcription).
Omit it and the agent treats the message as spoken and replies out loud.

### Custom LLM: `fishaudio_extra_body` and `session_id`

With a [custom LLM](https://docs.fish.audio/agents/build/custom-llm.md) (path B), your server gets
the fully assembled context on every turn: the system prompt, full conversation history, and tools
in OpenAI function format — plus extra top-level fields:

| Field | Content |
|---|---|
| `session_id` | The Fish session id |
| `user_id` | Your `end_user_id`, if you set one |
| `fishaudio_extra_body` | Your `llm_extra_body` object, forwarded verbatim every request |

Set `llm_extra_body` when creating the session to carry your own identifiers (which save file, which
quest state) into every request your server receives:

```json
// POST /v1/agent/sessions
{ "agent_id": "...", "llm_extra_body": { "quest_id": "bridge_01", "player_hp": 40 } }
```

### Own pipeline: message building

With no agent, you build the LLM's `messages` array yourself each turn — typically
`[system_prompt, ...history, latest_user_turn]`. Inject game state the same way a custom LLM
receives it: as a system or tool message your code constructs from the game's state dict (the
`GAME HOOK` spot in `examples/06-own-pipeline/game.py`).

## AI → game: how the AI affects the game

| Mechanism | Path | Shape |
|---|---|---|
| Client tools | Agents (A/B) | Agent calls a tool name + args; your frontend code runs it and returns a result |
| Webhook tools | Agents (A/B) | Agent calls your HTTP endpoint; the platform makes the request server-side |
| Tool calls (OpenAI format) | Custom LLM (B) / own pipeline (C) | Your LLM returns `tool_calls`; you execute them |
| Action tags in text | Own pipeline (C) | Your NPC prompt asks the LLM to emit a marker your code parses out of the reply text |

### Client tools (agent calls your frontend)

Declare the tool on the agent; register a handler with the Web SDK. The agent calls it
mid-conversation and your handler's return value goes back into the conversation.

```js
const session = await AgentSession.start({
  agentId: "YOUR_AGENT_ID",
  clientTools: {
    open_door: async ({ door_id }) => {
      game.openDoor(door_id);       // GAME HOOK
      return { opened: true };
    },
  },
});
```

Keep results small — a result over ~60 KB serialized (`MAX_CLIENT_TOOL_RESULT_BYTES`) is rejected
instead of sent, and the model re-reads the whole result every turn anyway. Return a summary or an
id, not a game-state dump.

### Webhook tools (agent calls your server)

Same idea, but the platform calls your HTTP endpoint directly instead of your browser code — use
this when the action should happen server-side (persist to a save file, call another service).
`execution_mode` controls whether the agent waits (`blocking`), fires and forgets, or keeps talking
while it runs in the `background`.

### Action tags (own pipeline only)

With no tool-calling protocol in play, the simplest AI → game channel is to ask the LLM to emit a
parseable marker in its reply, then strip it before sending the rest to TTS:

```python
# NPC_PROMPT: "...If the player should receive the sword, end your reply with [GIVE:sword]."
reply = call_llm(player_text, state)
if "[GIVE:" in reply:
    item = reply.split("[GIVE:")[1].split("]")[0]
    game.give_item(item)              # GAME HOOK
    reply = reply.split("[GIVE:")[0]  # don't speak the tag
```

This is fragile compared to real tool calling (the model can mis-format the tag) but needs no
protocol support — it's the right default for `examples/06-own-pipeline`.

## Fish Audio docs

- Dynamic variables: https://docs.fish.audio/agents/build/dynamic-variables.md
- Authenticated sessions (overrides, `llm_extra_body`): https://docs.fish.audio/agents/deploy/authenticated-sessions.md
- Custom LLM: https://docs.fish.audio/agents/build/custom-llm.md
- Client tools: https://docs.fish.audio/agents/build/client-tools.md
- Webhook tools: https://docs.fish.audio/agents/build/webhook-tools.md
- Wire protocol (`user.message`, `client_tool.call`): https://docs.fish.audio/agents/deploy/protocol.md

For exact request/response shapes, see the `fish-audio-api` skill (raw protocol, custom-LLM request
body) or the `fish-audio-sdk` skill (`AgentSession`, client tool registration) in `.claude/skills/`.
