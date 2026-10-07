"""Streaming TTS: one sentence of text in, one complete audio clip (mp3 bytes) out.

Uses Fish's live WebSocket endpoint (`wss://api.fish.audio/v1/tts/live`) via the SDK's
`client.tts.stream_websocket()` so the model starts speaking before the whole sentence of
text has even been "sent" (it synthesizes as text chunks arrive). See
.claude/skills/fish-audio-sdk/references/websocket.md and the raw protocol in
.claude/skills/fish-audio-api/SKILL.md ("WebSocket TTS").

Design choice - one clip per sentence, not one continuous stream for the whole reply:
server.py splits the LLM's reply into sentences and calls `synthesize_sentence()` once per
sentence, collecting that sentence's audio into a single complete mp3 blob before sending it
to the browser. A true single continuous WebSocket stream (one socket for the whole reply,
flushed per sentence) would shave a little latency and avoid per-sentence connection
overhead, but would need the browser to play a sequence of raw MediaSource-appended audio
chunks, which is fiddly and MP3 doesn't fragment cleanly for MediaSource across browsers.
Whole-sentence clips played back-to-back with plain `<audio>` elements is the simplest robust
choice for a hackathon and still gets "first sentence speaks while the next is still being
generated" streaming behavior.

Swap this module for: Fish's HTTP `tts.convert()` (simpler, but waits for the full sentence
before any audio - higher latency), ElevenLabs, or a local TTS engine.
"""

import os

from fishaudio import AsyncFishAudio

TTS_MODEL = os.environ.get("FISH_TTS_MODEL", "s2.1-pro")


async def synthesize_sentence(
    client: AsyncFishAudio | None, text: str, voice_id: str | None
) -> tuple[bytes, str]:
    """Return one sentence's full audio as (bytes, format) - format is "mp3" unless mocked.

    `client` is a single `AsyncFishAudio` reused across a whole connection/turn (created by
    the caller) so each sentence doesn't pay for a fresh client/connection setup; pass `None`
    when MOCK_TTS=1, since no client is needed.
    """
    if os.environ.get("MOCK_TTS") == "1":
        print(f"[tts] [MOCKUP] MOCK_TTS=1 -> synthetic tone instead of {text!r}")
        return _tone_wav(), "wav"

    async def one_chunk():
        yield text

    chunks = []
    async for audio_chunk in client.tts.stream_websocket(
        one_chunk(),
        reference_id=voice_id,
        format="mp3",
        model=TTS_MODEL,  # type: ignore[arg-type]  # s2.1-pro works over the wire; SDK types only list s1/s2-pro
    ):
        chunks.append(audio_chunk)
    audio = b"".join(chunks)
    print(f"[tts] ({TTS_MODEL}) {len(audio)} bytes for {text!r}")
    return audio, "mp3"


def _tone_wav() -> bytes:
    """A short synthetic WAV tone, for exercising the pipeline with no Fish API key."""
    import math
    import struct
    import wave
    from io import BytesIO

    sample_rate = 16000
    seconds = 0.4
    n = int(sample_rate * seconds)
    frames = b"".join(
        struct.pack("<h", int(3000 * math.sin(2 * math.pi * 440 * i / sample_rate)))
        for i in range(n)
    )
    buf = BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(frames)
    return buf.getvalue()
