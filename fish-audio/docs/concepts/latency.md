# Latency

A voice conversation feels broken above roughly 1 second of silence between "player stops talking"
and "NPC starts talking." Everything in this doc is about keeping that gap small.

## The latency budget of one voice turn

```
player stops talking
        │
        ▼
[1] end-of-speech detection (VAD / endpointing)   ~100-500 ms
        │
        ▼
[2] speech-to-text (STT)                          whole-request latency; Fish ASR is batch-only
        │
        ▼
[3] LLM time-to-first-token (TTFT)                depends entirely on your LLM/provider
        │
        ▼
[4] TTS time-to-first-audio (TTFA)                ~100-500ms depending on model/latency mode
        │
        ▼
[5] network + client playback buffering           tens of ms, more on bad networks
        │
        ▼
player hears the first sound
```

Each stage adds up. A hosted Fish agent (path A/B in
[00-choose-your-path.md](../00-choose-your-path.md)) collapses stages 1, 2 and 4 into Fish's own
pipeline and gives you one number to optimize: your LLM's TTFT (stage 3). An own-pipeline game
(path C) owns, and must measure, every stage.

Note stage 2: Fish **speech-to-text is batch only** (`POST /v1/asr` — whole file in, whole
transcript out). There is no streaming STT in the raw API. In your own pipeline, detect end-of-speech
with VAD first, then send the clip; don't expect partial transcripts mid-utterance. Fish agents run
their own (not batch) recognition internally — that complexity is exactly what you're paying for
by using the hosted platform.

## How to measure it

- **Log a timestamp at each stage boundary.** `CONVENTIONS.md` asks every example to print lines
  like `[tts] first audio after 412 ms` — do this for VAD-trip, STT-return, LLM-first-token, and
  TTS-first-byte too, so you can see which stage actually dominates for your game.
- **For TTS alone**, time from request-sent to first audio byte/chunk received, not to full
  response — that's what the player perceives as "it started talking."
- **For a hosted agent**, Fish's own [conversation history](https://docs.fish.audio/agents/monitor/conversation-history.md)
  attributes turn latency per session, which also lets you tell "your custom LLM was slow" from
  "the platform was slow" when using a [custom LLM](context-injection.md).
- Measure under the conditions you'll actually ship with (same network, same text length) — a
  32-word NPC line and a 4-word bark have very different TTS latency.

## Tricks that actually move the number

- **Streaming TTS** (`wss://api.fish.audio/v1/tts/live`, or an agent's built-in streaming) starts
  playback on the first sentence instead of waiting for the whole reply. This is the single
  biggest win when your reply text is more than a few words. See
  [02-streaming-tts](../../examples/02-streaming-tts).
- **Sentence chunking.** Send text to streaming TTS as soon as a sentence (or clause) is complete,
  rather than buffering the whole LLM response. The WebSocket protocol's `FlushEvent` forces the
  server to synthesize whatever's buffered immediately — useful at a turn boundary.
- **Latency modes.** TTS requests take a `latency` field: `normal` (best quality, default),
  `balanced` (faster), and, raw-API/WebSocket only, `low`. The Python SDK's `latency` argument
  accepts only `"normal"` or `"balanced"` — `"low"` requires the raw WebSocket protocol.
- **Short prompts and short replies.** Tell your NPC's LLM to answer in one or two sentences (see
  [npc-prompting.md](npc-prompting.md)) — less text to generate, less text to synthesize, in both
  directions.
- **Fast LLM providers.** Stage 3 is usually the biggest and least Fish-controlled part of the
  budget. If you're wiring a [custom LLM](context-injection.md) into a hosted agent, Fish gives
  each request one retry and a 10-second cap and recommends aiming for **time-to-first-token under
  800 ms**; pick a provider/model that can hit that under load, not just in a demo.
- **Filler / acknowledgement lines.** A short "Hmm, let me think..." or "One moment..." played
  immediately (pre-generated or trivially fast to synthesize) buys you a second or two to run the
  real LLM call without the player perceiving silence.
- **Pre-generate and cache fixed lines.** Any line that doesn't depend on game state (greetings,
  common barks, menu prompts) should be synthesized once at build/setup time, not on every
  playthrough. See [03-npc-voice-factory](../../examples/03-npc-voice-factory).
- **Audio format.** The TTS `format` field accepts `mp3` (default), `wav`, `pcm`, or `opus`. `pcm`
  has no encode/decode step; `opus` is small and fast to transmit; `mp3`/`wav` need encoding on
  the server and decoding on the client. For the lowest end-to-end latency over a real network,
  prefer `pcm` or `opus` — see the TTS endpoint reference below.

## Fish Audio docs

- Real-time voice streaming: https://docs.fish.audio/developer-guide/best-practices/real-time-streaming.md
- WebSocket TTS streaming endpoint: https://docs.fish.audio/api-reference/endpoint/websocket/tts-live.md
- Speech to Text guide (batch-only ASR): https://docs.fish.audio/features/speech-to-text.md
- Custom LLM (TTFT guidance, failure/retry behavior): https://docs.fish.audio/agents/build/custom-llm.md
- Conversation history (per-session latency attribution): https://docs.fish.audio/agents/monitor/conversation-history.md

For exact request/response shapes and SDK call signatures mentioned above, see the
`fish-audio-api` skill (raw WebSocket protocol) or the `fish-audio-sdk` skill (`stream_websocket` /
`convertRealtime`) in `.claude/skills/`.
