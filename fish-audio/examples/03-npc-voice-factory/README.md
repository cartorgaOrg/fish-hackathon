# 03: NPC Voice Factory

> 🤖 **Coding agent?** First run `npx skills add https://docs.fish.audio` (official Fish Audio skills) and read [AGENTS.md](../../AGENTS.md).

**Text description → candidate voices → pick one → saved voice model → reuse forever.**

Create custom NPC voices from character descriptions. Build a library of unique, consistent voices without manual recording.

## Workflow

1. **Design** (`design_voices.py`): Describe a character (e.g., "gravelly, grumpy guard"). Get 2 voice candidates by default as WAV files (change `n` in the script for 1-4).
2. **Save** (`save_voice.py`): Pick a candidate, create a persistent voice model, get its ID.
3. **Speak** (`save_voice.py` demos this): Use the saved voice ID in TTS to speak any text.

## Run

```bash
# needs fish-audio/.env with your FISH_API_KEY (see the fish-audio README quick start)

# Step 1: Generate candidates
uv run design_voices.py "Brom the Guard"
# Outputs: out/Brom_the_Guard_candidate_1.wav, _candidate_2.wav

# Step 2: Save candidate 1 as a voice model
uv run save_voice.py "Brom the Guard" 1
# Prints the voice ID and demos speaking with it
```

## Cost

- **Voice Design**: $0.01 per request (any number of candidates).
- **Voice Cloning**: Free (just saving a model).
- **TTS with saved voice**: Normal TTS cost (per character synthesized).

## Connecting your real game

> **`game.py` is a mockup, not where your game has to live.** It's a stand-in so this example runs
> end to end. Your real game can live anywhere (engine, browser, backend); it just has to provide
> the inputs and handle the outputs below. Then delete the mockup.

- **Your game provides:** character descriptions (a voice description and a sample line per NPC), e.g. from your character sheets.
- **Your game gets back:** voice ids to pass as `reference_id` whenever that NPC speaks.

With the mockup:

1. Replace `CHARACTERS` with your game's actual NPCs.
2. For each NPC, provide a 1-2 sentence voice description and a sample line.

Then in your game build pipeline:

1. Run `design_voices.py` on each NPC character (once at design time, not at runtime).
2. Run `save_voice.py` to save your chosen candidates as persistent models.
3. Collect the voice IDs. Use them in example 01's TTS system via `FISH_VOICE_ID` env or per-character `voice_id`.

## Instant cloning (optional)

For one-off voices without saving a model, use raw HTTP with MessagePack (see `references` in [voice-cloning.md](https://docs.fish.audio/features/voice-cloning.md)). Example 01 shows TTS setup; the `fish-audio-api` skill covers raw HTTP requests.

## Docs

- Voice Design: [voice-design.md](https://docs.fish.audio/features/voice-design.md)
- Voice Cloning: [voice-cloning.md](https://docs.fish.audio/developer-guide/best-practices/voice-cloning.md)
- Voice Models: [creating-models.md](https://docs.fish.audio/developer-guide/core-features/creating-models.md)
- Fish Audio console: [voices](https://fish.audio/app/voices)
