# 02 - Streaming TTS

> 🤖 **Coding agent?** First run `npx skills add https://docs.fish.audio` (official Fish Audio
> skills) and read [AGENTS.md](../../AGENTS.md).

Speaks an LLM's reply **while it's still being generated**, using Fish's live TTS WebSocket.
This is the key latency trick for responsive NPC dialogue: instead of `LLM finishes -> TTS
starts`, text streams into Fish token-by-token and audio starts coming back before the whole
sentence exists.

## Why streaming matters

A player's perceived response time is `(time to first LLM token) + (time to first audio
chunk)`, not the time for the whole reply. Calling TTS only after the LLM finishes adds the
*entire* LLM generation time to that budget. Streaming overlaps the two: Fish starts
synthesizing as soon as it has enough text, in parallel with the LLM still generating the
rest.

## Run it

```bash
cp ../../.env.example ../../.env   # creates fish-audio/.env; then add FISH_API_KEY
uv run stream_tts.py "Let me cross the bridge"       # saves out/stream.mp3
uv run stream_tts.py "Let me cross the bridge" --play # also plays it (needs ffmpeg/ffplay)
uv run stream_tts.py --dry-run                        # prints mock NPC tokens, no Fish call
```

With no `LLM_API_KEY` set, `game.py` uses a **MOCKUP** reply (fixed line, yielded word by
word with small delays, to simulate an LLM's token stream). Set `LLM_API_KEY` (+ optionally
`LLM_BASE_URL`, `LLM_MODEL`) to use a real OpenAI-compatible model instead.

Console output logs latency so you can tune it:

```
[MOCKUP] token: '[sighs]'
[tts] first audio chunk after 0.412s
[tts] done, 7 chunks, total 1.203s
[tts] saved to out/stream.mp3
```

## Chunking and flush tips

- Fish's `/v1/tts/live` buffers incoming text and starts synthesizing in sentence-ish-sized
  pieces; you don't need to send whole sentences at once, just send text as it arrives.
- Send a `FlushEvent` when you want to force whatever's buffered to synthesize *now* --
  typically right after a sentence boundary (`. `, `! `, `? `) -- so the player hears that
  clause without waiting on the rest of the reply. See the comment in `stream_tts_raw.py`.
- Don't send single characters; a few words per piece is a good balance of latency vs.
  how natural the prosody sounds.

## Files

- `game.py`: the NPC's "brain" -- `NPC_PROMPT`, `GAME_STATE`, and `stream_npc_reply()`
  (the async generator of text pieces). **This is a mockup**: your real game can live anywhere and only needs to hand over an async stream of
  text pieces (from your LLM or dialogue system), which then gets spoken while it's still arriving.
- `stream_tts.py`: wires `game.py`'s generator into Fish's WebSocket TTS via the Python SDK
  (`client.tts.stream_websocket`). Logs time-to-first-audio and total time.
- `stream_tts_raw.py`: the same thing over the raw WebSocket + MessagePack protocol, no SDK
  dependency -- useful if your game engine (Unity, Godot, ...) can't pull in the Python SDK
  but can speak WebSocket + MessagePack directly.
- `js/`: a tiny Node.js port of `stream_tts.py` using the `fish-audio` npm package's
  `convertRealtime`. Node-only (the realtime JS client uses Node's `ws`).

## Fish docs

- Real-time streaming best practices: https://docs.fish.audio/developer-guide/best-practices/real-time-streaming.md
- WebSocket TTS endpoint reference: https://docs.fish.audio/api-reference/endpoint/websocket/tts-live.md
- Python SDK WebSocket guide: https://docs.fish.audio/developer-guide/sdk-guide/python/websocket.md
- JavaScript SDK WebSocket guide: https://docs.fish.audio/developer-guide/sdk-guide/javascript/websocket.md

## For game engines

Both scripts here save `mp3` for simplicity. In a real game engine, request
`format="pcm"` instead -- it skips encode/decode overhead entirely, which matters when
you're trying to start playback the instant the first bytes arrive.
