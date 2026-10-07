# Voices

Three ways to get a voice for an NPC, from "pick one off the shelf" to "generate one from a
description."

## Three sources

| Source | What it is | Setup effort | Reuse |
|---|---|---|---|
| Voice library | Browse existing public voices, use their `reference_id` | None | Immediate, shared with everyone |
| Instant cloning | Send reference audio inline with each TTS request | None (no persistent model) | Per-request only |
| Persistent voice model | Upload reference audio once via `POST /model`, reuse the returned `_id` | One-time | Reuse across your whole game |
| Voice design | Generate candidate voices from a text description | None | Pick one, then clone/save it |

### Voice library

Browse `https://fish.audio/app/discovery`, copy a voice's id, pass it as `reference_id`. Simplest
path — no audio of your own needed. Good default for prototyping before you've recorded or
designed anything.

### Instant cloning (zero-shot, per-request)

Send 10–30 seconds of reference audio inline with the request (`references: [{audio, text}]`,
MessagePack-encoded since JSON can't carry raw bytes). No voice model is created — you resend the
clip (or hold it in memory) every time you want that voice.

```python
payload = {
    "text": "Halt, traveller.",
    "references": [{"audio": clip_bytes, "text": "Transcript of the clip."}],
}
# Content-Type: application/msgpack — required for inline audio
```

Use this for a one-off voice you'll never need again, or while iterating on a reference clip
before committing to a persistent model.

### Persistent voice model

`POST /model` uploads reference audio once and returns a model `_id` you reuse as `reference_id`
in every later TTS call — this is what "one voice per NPC" should mean in practice: create the
model when you build the NPC, store its id in your game's voice config, done.

```bash
curl --request POST https://api.fish.audio/model \
  --header "Authorization: Bearer $FISH_API_KEY" \
  --form "type=tts" --form "train_mode=fast" --form "title=Brom the Guard" \
  --form "visibility=private" --form "voices=@brom_sample.wav"
```

See `examples/03-npc-voice-factory` for a script that turns a folder of NPC definitions into a
batch of persistent voice models.

### Voice design (generate from a description)

`POST /v1/voice-design` generates 1–4 candidate voice clips from a natural-language `instruction`
(and optional `reference_text` so every candidate reads the same line). **$0.01 per successful
request**, regardless of how many candidates it returns — check current pricing before relying on
this number.

```json
{ "instruction": "Gruff middle-aged bridge guard, tired of travelers", "n": 3 }
```

Use this to explore a voice direction before recording anything or committing to a clone — pick
the candidate that fits, then either keep using `reference_id`-free voice design output directly or
feed a chosen candidate's audio into a persistent voice model.

## Reference clip best practices

- **One speaker only**, steady volume and tone, no background noise/music, small pauses between
  sentences.
- **15–20 seconds each, across 2–3 clips** reading a natural paragraph beats one long rushed take.
  10 seconds is the minimum for studio-quality results.
- Record somewhere quiet and soft-furnished (bedroom, parked car) — avoid open windows, running
  appliances, other people talking.
- A phone voice recorder or gaming headset mic is fine; you don't need studio gear.
- If the clone sounds robotic or doesn't resemble the source, the usual fix is a longer, calmer,
  more consistent recording — not a different model.

## One voice per NPC

Give every NPC with a name and personality its own persistent voice model id, stored next to its
persona in your game's NPC config — not one shared voice reused for every character with the
`reference_id` swapped at random. This also makes multi-speaker dialogue
(see [expressive-speech.md](expressive-speech.md)) straightforward: each speaker slot is just
another NPC's stored id.

## Licensing and consent

<!-- markdownlint-disable-next-line -->
> **Only clone a voice you have the right to clone:** your own voice, or someone who gave written
> permission. Never clone a voice pulled from the internet, and never clone a celebrity or public
> figure's voice without their permission. This applies to your own game's NPCs too, if you're
> tempted to clone a real person (a friend, a streamer, a public figure) for a bit — get consent
> first, every time.

**Commercial use:** Fish Audio's [terms](https://fish.audio/terms) limit free accounts to personal,
non-commercial use. Commercial use is licensed for paid plans. Fine for a hackathon demo, but generate the final
audio on a paid account before you sell or monetize the game. Public community voice models can be imitations
of real people, so designing your own voices ([03-npc-voice-factory](../../examples/03-npc-voice-factory)) is
the safest choice. More: [LICENSING.md](../../../LICENSING.md#voices-fish-audio).

## Fish Audio docs

- Voice cloning best practices: https://docs.fish.audio/developer-guide/best-practices/voice-cloning.md
- Creating voice models: https://docs.fish.audio/developer-guide/core-features/creating-models.md
- Voice Design guide: https://docs.fish.audio/features/voice-design.md
- Create Model endpoint: https://docs.fish.audio/api-reference/endpoint/model/create-model.md
- Pricing (voice design cost): https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits.md

For exact request fields for cloning, voice design, and model management, see the `fish-audio-api`
skill (raw `/model`, `/v1/voice-design`) or the `fish-audio-sdk` skill (`client.voices.*`) in
`.claude/skills/`.
