# Turn-taking and interruptions

Who decides when the player has finished talking, and what happens if they talk over the NPC?

## The three mechanisms

| Mechanism | What it does | Who implements it |
|---|---|---|
| VAD (voice activity detection) | Detects speech vs. silence in the raw audio stream | You (own pipeline) or Fish (agents) |
| Endpointing | Decides *when* silence means "the player is done," not just paused | Same as VAD |
| Barge-in | Lets the player interrupt the NPC mid-sentence and have it stop talking | Same as VAD |

## What Fish agents do for you

A hosted agent (paths A/B) runs VAD, endpointing, and barge-in internally as part of its realtime
pipeline (WebRTC/LiveKit). You don't tune thresholds — you consume the result:

- `user.interrupt` (client → agent) explicitly stops the agent's current speech.
- The agent's own barge-in also fires automatically when it detects the user talking over it.
- `lk.agent.state` (`initializing` / `idle` / `listening` / `thinking` / `speaking`) tells your UI
  what the agent is doing right now, so you can show a "listening" indicator without reimplementing
  VAD client-side.

```json
// client → agent, explicit interrupt
{ "type": "user.interrupt" }
```

## What you handle in your own pipeline (path C)

With no agent in the loop, you own all three:

- Run a VAD model (e.g. WebRTC VAD, Silero) on the mic stream to detect speech start/stop.
- Pick an endpointing timeout — long enough that a player's mid-sentence pause doesn't cut them
  off, short enough that the NPC doesn't sit waiting. 500–800 ms silence is a common starting
  point; tune per game pace.
- Decide what "interrupt" means for your game: stop TTS playback immediately, or let the current
  sentence finish? Fish's TTS streaming has no built-in interrupt signal — once you've sent text,
  you stop *playback* client-side and can send a `stop` event to end the WebSocket session.
- Remember Fish ASR is batch-only (see [latency.md](latency.md)): your VAD decides the clip
  boundaries; `/v1/asr` just transcribes whatever you send it.

## Push-to-talk: a valid game mechanic, not a workaround

Don't feel obligated to solve open-mic turn-taking. Push-to-talk (hold a key/button to speak, release
to send) sidesteps VAD and endpointing entirely and is a legitimate design choice:

- It removes false endpoints entirely — the player decides when their turn ends.
- It reads naturally in a game that already has an interact/talk button.
- It's the simplest way to ship a working voice feature in a hackathon timeframe.

Reach for continuous listening with VAD only when open-mic conversation is core to the pitch (a
companion you talk to hands-free, a voice-commanded strategy game).

## Fish Audio docs

- Wire protocol (user.interrupt, agent state, barge-in semantics): https://docs.fish.audio/agents/deploy/protocol.md
- Web SDK: https://docs.fish.audio/agents/deploy/web-sdk.md
- Speech to Text guide (why ASR is batch-only): https://docs.fish.audio/features/speech-to-text.md

For exact event shapes and SDK calls, see the `fish-audio-api` skill (raw wire protocol) or the
`fish-audio-sdk` skill (`AgentSession` / WebSocket helpers) in `.claude/skills/`.
