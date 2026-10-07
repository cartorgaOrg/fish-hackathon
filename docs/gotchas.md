# Gotchas

Things that will bite you. Read this once before you start, then again when something behaves
strangely.

## API and protocol

- **STT is batch only.** `POST /v1/asr` takes a whole file, returns a whole transcript — there is
  no streaming STT in the raw API. Detect end-of-speech with your own VAD first, then upload the
  clip. Fish **agents** run their own recognition internally; this limit only matters for an
  [own pipeline](00-choose-your-path.md).
- **`transcribe-1-pro` needs the `model` header on every request.** A missing or misspelled header
  (e.g. `Transcribe-1-Pro`, `transcribe-1pro`) silently falls back to `transcribe-1` — no error is
  returned. Send `model: transcribe-1-pro` exactly, lowercase, if you need speaker turns, long
  recordings, or emotion/vocal-event cues.
- **ASR timestamps are seconds.** The Python SDK's `ASRResponse` docstring says milliseconds for
  `segments[].start/end` and `duration` — that's wrong. Treat all ASR timing fields as seconds, in
  both the raw API and the SDK.
- **`s2.1-pro` isn't in the SDK's type hints.** Both SDKs only type `s1` and `s2-pro`, but forward
  any model string over the wire unvalidated. `s2.1-pro` works at runtime; add `# type: ignore`
  (Python) or an `as` cast (TS), or use the `fish-audio-api` skill for raw calls instead.
- **Python SDK `latency` has no `"low"`.** The SDK's `latency` kwarg only accepts `"normal"` or
  `"balanced"`. Use the raw WebSocket protocol (`fish-audio-api` skill) if you need `"low"`
  latency mode.
- **The WebSocket `stop` event, not `close`.** The literal event name to end a `/v1/tts/live`
  session is `{"event": "stop"}` — easy to get wrong by analogy with other streaming APIs.

## Account and concurrency

- **Starter-tier concurrency is 5 simultaneous requests** per account, shared across every API key
  on it. A hackathon team sharing one key will hit `429`s under modest parallel load — coordinate
  who's testing when, or top up (Elevated tier at ≥$100 paid = 15 concurrent, High Volume at
  ≥$1,000 = 50; check current pricing). Each `/v1/asr` request holds its slot until the response
  returns, which for a long `transcribe-1-pro` recording can be minutes.
- **No `Retry-After` header on 429.** Retry with exponential backoff, not a fixed delay.

## Secrets and hosting

- **Never expose `FISH_API_KEY` in the browser.** A key shipped to a client is a key anyone can
  steal from devtools or the network tab. Browser code talks to a small server you control; the
  server holds the key. For agents, mint a short-lived session token server-side instead of using
  the raw API key client-side — see [context-injection.md](concepts/context-injection.md).
- **Custom LLM needs a public HTTPS URL.** Fish's platform calls your endpoint over the internet —
  `localhost` doesn't resolve for them, and plain `http://` is rejected outright. Tunnel a local
  dev server with `cloudflared` or `ngrok` while hacking.
- **Custom LLM must answer fast.** Each request gets one retry and a 10 s cap; after 3 consecutive
  failed generations the agent apologizes and hangs up (`end_reason: llm_endpoint_failure`). Aim
  for time-to-first-token under 800 ms — a slow local LLM will end the call, not just feel
  sluggish.

## Browser specifics

- **Autoplay and mic access need a user gesture.** Browsers block audio playback and
  `getUserMedia()` until the user has clicked or tapped something on the page. Trigger `play()`
  calls and mic requests from a click handler, not on page load.
- **Mic access needs HTTPS or localhost.** `getUserMedia()` is refused on plain `http://` origins
  other than `localhost`. Serve your dev frontend over `localhost` (fine) or HTTPS (for anything
  else, including a tunnel URL you're testing from another device).

## Agent tools

- **Client-tool results must be small.** A result over ~60 KB serialized
  (`MAX_CLIENT_TOOL_RESULT_BYTES`) or that isn't JSON-serializable is rejected with an error
  instead of being sent, and the model re-reads the whole result on every turn anyway. Return a
  summary or an id, not a game-state dump. Default handler timeout is 15 s client-side
  (`clientToolTimeoutMs`), with a
  separate 30 s server-side deadline (settable 1–120 s per tool) that the client-side value can
  only tighten, never extend.
- **Up to 10 background webhook calls in flight per conversation.** Further calls fail
  immediately with an error the agent can react to in conversation.

## Fish Audio docs

- Speech to Text guide: https://docs.fish.audio/features/speech-to-text.md
- Pricing & rate limits (concurrency tiers): https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits.md
- Custom LLM (failure behavior, latency target): https://docs.fish.audio/agents/build/custom-llm.md
- Client tools (result size, timeouts): https://docs.fish.audio/agents/build/client-tools.md
- Authenticated sessions (keeping API keys server-side): https://docs.fish.audio/agents/deploy/authenticated-sessions.md
- WebSocket TTS streaming (event names): https://docs.fish.audio/api-reference/endpoint/websocket/tts-live.md

For exact SDK/API signatures behind each item above, see `.claude/skills/fish-audio-sdk/SKILL.md`
(installed SDK gotchas, verified against SDK source) and `.claude/skills/fish-audio-api/SKILL.md`
(raw REST/WebSocket). Reinstall or update either with `npx skills add https://docs.fish.audio`.
