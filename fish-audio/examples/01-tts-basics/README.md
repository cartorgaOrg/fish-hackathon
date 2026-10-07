# 01: Text-to-Speech Basics

> 🤖 **Coding agent?** First run `npx skills add https://docs.fish.audio` (official Fish Audio skills) and read [AGENTS.md](../../AGENTS.md).

**Pre-synthesize dialogue to audio: narrator lines, NPC barks, cutscenes.**

Good for static, scripted dialogue you control fully before runtime.

## Run

```bash
cp ../../.env .
uv run tts.py
```

Outputs `out/<n>_<speaker>.mp3` for each line. Also shows HTTP streaming demo (time to first byte).

## What it does

- `game.py`: List of dialogue lines (text, speaker, optional emotion tags, optional per-speaker voice ID).
- `tts.py`: Calls Fish TTS on each line, saves to MP3, prints timing.

## Emotion tags (S2.1-Pro)

Use `[brackets]` in text for prosody control. Max ~3 per sentence.

| Tag | Effect |
|---|---|
| `[angry]` | Harsh, angry tone |
| `[whispered]` | Soft, quiet |
| `[happy]`, `[laughing]` | Cheerful, amused |
| `[sad]`, `[disappointed]` | Sorrowful, sad |
| `[confused]` | Uncertain, questioning |
| `[excited]`, `[energetic]` | High energy, enthusiastic |
| `[calm]`, `[soothing]` | Peaceful, gentle, relaxed |
| `[nervous]`, `[panicked]` | Anxious, fearful |

Full list: [emotion tags](https://docs.fish.audio/developer-guide/core-features/emotions.md)

## Connecting your real game

> **`game.py` is a mockup, not where your game has to live.** It's a stand-in so this example runs
> end to end. Your real game can live anywhere (engine, browser, backend); it just has to provide
> the inputs and handle the outputs below. Then delete the mockup.

- **Your game provides:** lines to speak (speaker, text, optional `[emotion]` tags, optional voice id).
- **Your game gets back:** audio bytes (MP3 here), ready to play or cache.

The mockup shows the shape:
1. Replace `LINES` with your game's actual dialogue tree.
2. Add a per-speaker `voice_id` to each line to use a custom voice model (from example 03 or `FISH_VOICE_ID` env).

Example: `DialogueLine("Hello!", "Brom", voice_id="my_custom_voice_id", emotions=["gruff"])`

## Performance tips

- **Pre-generate at build time**: If dialogue is static, generate and cache MP3 files before shipping. TTS at runtime is slower than playback.
- **HTTP streaming**: This example shows both `convert()` (full audio) and `stream()` (chunks as they arrive). Streaming lets you start playback before synthesis finishes.

## Docs

- TTS concepts: [text-to-speech.md](https://docs.fish.audio/developer-guide/core-features/text-to-speech.md)
- Python SDK: [text-to-speech.md](https://docs.fish.audio/developer-guide/sdk-guide/python/text-to-speech.md)
- Create custom voices: [example 03](../03-npc-voice-factory)
