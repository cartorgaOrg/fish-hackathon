# Expressive speech

Fish TTS reads emotion, tone, and sound-effect cues straight out of your `text` string. No
separate parameter — the tags live inline.

## S2 (current): free-form `[bracket]` tags

`s2.1-pro`, `s2-pro`, and `drama-3-preview` treat `[bracket]` text as a natural-language cue, not a
fixed vocabulary — the model learned a mapping from descriptions to acoustic delivery, so you can
write `[whispering]`, `[angry]`, `[laughing]`, `[sighing]`, `[break]`, or something more specific
like `[whispers sweetly]` or `[laughing nervously]`.

```text
[whispering] Over here... I don't want them to hear us.
[angry] You again? [sighing] Fine. What do you want.
```

**Rules of thumb:**

- Place sentence-level emotion cues (`[angry]`, `[sad]`) at the start of the sentence they govern.
- Tone (`[whispering]`, `[shouting]`) and sound-effect tags (`[laughing]`, `[sighing]`, `[break]`,
  `[long-break]`) can go anywhere in the text.
- **At most ~3 tags per sentence.** Stacking more makes delivery unnatural rather than more
  expressive: `[sad][whispering]` reads fine, `[sad][whispering][shaky][urgent]` doesn't.
- Tags don't count toward token limits and add no extra latency.
- 64+ named emotions are documented, but the tag set is open — any short natural-language
  description works. Full reference: see Fish docs link below.

## S1 (legacy): `(parentheses)`, fixed tag set

The older `s1` model uses the same idea but with `(parentheses)` and a closed vocabulary (same
emotion names, no free text):

```text
(happy) What a beautiful day!
(sad)(whispering) I'll miss you so much.
```

If you're on `s1` for an existing integration, stick to the documented tag list — unrecognized
`(tags)` won't be interpreted the way free-form `[tags]` are on S2.

## Multi-speaker dialogue

`s2-pro`, the S2.1-Pro family, and `drama-3-preview` support multiple voices in one request: pass
`reference_id` as an array and mark speakers inline with `<|speaker:N|>`.

```json
{
  "text": "<|speaker:0|>Good morning!<|speaker:1|>Good morning! How are you?",
  "reference_id": ["<voice-id-0>", "<voice-id-1>"]
}
```

Useful for a two-NPC exchange rendered in a single TTS call instead of stitching two separate audio
files together.

## Prompting an LLM to emit tags

If an LLM is generating your NPC's lines, ask it to add tags directly in its reply — don't
post-process plain text to guess emotion. One line in the system prompt is usually enough:

```
Mark delivery with at most 3 [bracket] tags per sentence (e.g. [angry], [whispering], [sighing]).
Place sentence-level emotion tags at the start of the sentence.
```

Validate the LLM didn't go overboard before sending to TTS — strip extra tags if a reply exceeds
~3 per sentence, since an LLM asked for "more emotion" will happily pile them on.

## Fine-grained control: pronunciation and phonemes

Beyond emotion, Fish supports exact pronunciation control for names, acronyms, and technical terms:

- **Phoneme tags** (`<|phoneme_start|>...<|phoneme_end|>`) replace one word/character inline with
  CMU Arpabet (English), tone-number pinyin (Chinese), or OpenJTalk romaji (Japanese).
- **Pronunciation dictionaries** let you define reusable `key → phoneme` rules in the web app
  (or inline per-request) so "Kubernetes" or your game's invented proper nouns are read consistently
  across every NPC line, without hand-tagging every occurrence.

Both exist and are documented — see the links below rather than guessing phoneme syntax from
memory, it's genuinely fiddly.

## Fish Audio docs

- Emotion control (full tag reference, S1 vs S2 syntax): https://docs.fish.audio/developer-guide/core-features/emotions.md
- Fine-grained control (phonemes, paralanguage): https://docs.fish.audio/developer-guide/core-features/fine-grained-control.md
- Pronunciation dictionaries: https://docs.fish.audio/developer-guide/core-features/fine-grained-control/pronunciation-dictionaries.md
- Text to Speech endpoint (`reference_id` arrays, `<|speaker:N|>`): https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech.md

For exact request fields and multi-speaker code, see the `fish-audio-api` skill (raw `/v1/tts`
body) or the `fish-audio-sdk` skill (`tts.convert` / `textToSpeech.convert`) in `.claude/skills/`.
