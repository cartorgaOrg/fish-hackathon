# 06 - Own pipeline

> 🤖 **Coding agent?** First run `npx skills add https://docs.fish.audio` (official Fish Audio skills) and read [AGENTS.md](../../AGENTS.md).

Full-control voice conversation pipeline: browser mic → VAD → STT → LLM → streaming TTS →
browser playback. Every stage is a small, swappable module. This is the highest-effort,
highest-control path in this folder (path **C** - see the [fish-audio README](../../README.md)).

## Pipeline

```
 browser mic
     |  Float32 PCM (16 kHz, from vad-web, or from push-to-talk capture)
     v
 VAD (client-side, @ricky0123/vad-web)  -- decides end-of-speech, no server round trip
     |  one WAV blob per utterance, over WebSocket
     v
 server.py  --receive_bytes-->  stt.py   Fish /v1/asr (batch; transcribe-1 or -pro)
     |                                        |  transcript (text)
     |                                        v
     |                                   game.py  build_messages() / on_player_utterance()
     |                                        |  chat messages
     |                                        v
     |                                   llm.py   OpenAI-compatible streaming chat completion
     |                                        |  text tokens -> sentence buffer
     |                                        v
     |                                   tts.py   Fish /v1/tts/live (WebSocket), per sentence
     |                                        |  mp3 bytes, one clip per sentence
     v                                        v
 browser <-- JSON status + binary audio frames, sentence by sentence
     |
     v
 <audio> element queue (one element per sentence, played back-to-back)
```

Why batch STT shapes this whole design: Fish's speech-to-text is **batch only**
(`POST /v1/asr`, whole file in, whole transcript out - no streaming). So end-of-speech
detection has to happen *before* any Fish API call, entirely in the browser. That's what the
VAD step is for. Fish's hosted **agents** (see [04](../04-agent-web),
[05](../05-agent-custom-llm)) do this STT segmentation for you; this example does it
yourself, which is why it's the highest-effort path.

## Latency budget (rough, tune for your game)

| Stage | What | Typical |
|---|---|---|
| VAD end-of-speech delay | silence needed before vad-web fires `onSpeechEnd` | ~300-500 ms (library default) |
| STT | `/v1/asr`, `transcribe-1`, short clip | a few hundred ms to ~1-2 s |
| LLM first token | time to first streamed token | depends on provider/model; mock is near-instant |
| TTS first audio | time to first audio byte for the first sentence | WebSocket streaming keeps this low vs. waiting for a full non-streamed clip |

The server reports the last three live, per turn, in the `timing` WebSocket message and in
the browser's "Timing" panel.

## Run it

```bash
cp -n ../../.env.example ../../.env   # creates fish-audio/.env if missing; fill in FISH_API_KEY
uv run uvicorn server:app --port 8001
# open http://localhost:8001
```

Only `FISH_API_KEY` is required for a full real run. Without `LLM_API_KEY`, the LLM step
uses a MOCKUP streamed reply (logged `[MOCKUP]`). For a fully offline run (no keys at all),
set `MOCK_STT=1` and `MOCK_TTS=1` - the pipeline still exercises every stage, with a fixed
transcript and a short synthetic tone standing in for Fish audio.

```bash
# fully offline smoke test, no browser:
MOCK_STT=1 MOCK_TTS=1 uv run python cli_test.py
```

## Swapping components

- **STT** (`stt.py`): swap for a local model (faster-whisper, whisper.cpp) for offline/zero
  network latency, or a streaming provider (Deepgram, AssemblyAI) if you want partial
  transcripts while the player is still talking - note this changes the pipeline shape, since
  STT would no longer wait for VAD's end-of-speech signal.
- **LLM** (`llm.py`): any OpenAI-compatible endpoint via `LLM_BASE_URL` / `LLM_MODEL`,
  including a local Ollama server.
- **TTS** (`tts.py`): Fish's WebSocket live endpoint (used here, lowest latency), Fish's plain
  `tts.convert()` (simpler, higher latency), or another provider entirely.
- **VAD** (`static/index.html`): `@ricky0123/vad-web` from a CDN, or the "push to talk" mode
  (button hold), already both wired up with a mode toggle in the page.

## Barge-in

If a new utterance arrives while a reply is still speaking, the server cancels the in-flight
pipeline task for that connection and sends `{"type": "barge_in"}`; the browser immediately
stops playback and clears its queued sentence audio. Kept intentionally simple - no attempt
to splice or resume a partial reply.

## Connecting your real game

> **`game.py` is a mockup, not where your game has to live.** It's a stand-in so this example runs
> end to end. Your real game can live anywhere (engine, browser, backend); it just has to provide
> the inputs and handle the outputs below. Then delete the mockup.

- **Your game provides:** the game state and the prompt/messages for each turn.
- **Your game gets back:** the player's transcript, the NPC's reply text and any `<action:...>` tags to apply to your game.

The mockup in `game.py` shows each touch point: `NPC_PROMPT`, `GAME_STATE`, `build_messages()`,
`on_player_utterance()`, `postprocess_reply()` (parses `<action:...>` tags out of the LLM
text and updates state), and per-NPC voice selection. Nothing else in this example needs to
change to plug in a different game.

```bash
grep -n "GAME HOOK" game.py
grep -n "MOCKUP" *.py
```

## Fish Audio docs used here

- https://docs.fish.audio/features/speech-to-text.md
- https://docs.fish.audio/api-reference/endpoint/openapi-v1/speech-to-text.md
- https://docs.fish.audio/developer-guide/best-practices/real-time-streaming.md
- WebSocket TTS protocol: `.claude/skills/fish-audio-api/SKILL.md` ("WebSocket TTS") and
  `.claude/skills/fish-audio-sdk/SKILL.md` (`stream_websocket`)
