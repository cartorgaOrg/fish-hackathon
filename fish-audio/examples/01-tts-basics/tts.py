"""
Synthesize dialogue to MP3 files using Fish TTS.
https://docs.fish.audio/developer-guide/core-features/text-to-speech.md
"""

import os
import time
from pathlib import Path

from dotenv import find_dotenv, load_dotenv
from fishaudio import FishAudio
from fishaudio.utils import save

from game import LINES

load_dotenv(find_dotenv())

if not os.getenv("FISH_API_KEY"):
    print("[ERROR] FISH_API_KEY not set. Please add it to .env or export it.")
    exit(1)

out_dir = Path("out")
out_dir.mkdir(exist_ok=True)

client = FishAudio()
tts_model = os.getenv("FISH_TTS_MODEL") or "s2.1-pro"
default_voice_id = os.getenv("FISH_VOICE_ID") or None  # empty in .env -> Fish default voice

print(f"[tts] Converting {len(LINES)} lines")

for i, line in enumerate(LINES, 1):
    text = line.emotion_text()
    voice_id = line.voice_id or default_voice_id

    print(f"[tts] {i}. {line.speaker}: {text[:50]}...")

    start = time.time()
    audio = client.tts.convert(
        text=text,
        model=tts_model,  # type: ignore (SDK caveat: s2.1-pro not in type hints)
        reference_id=voice_id,
        format="mp3",
    )
    elapsed = time.time() - start

    filename = f"{i:02d}_{line.speaker.replace(' ', '_')}.mp3"
    save(audio, str(out_dir / filename))
    print(f"    -> {filename} ({len(audio) / 1024:.0f} KB, {elapsed:.1f}s)")

# Demo: HTTP streaming (show chunks arriving + time to first byte)
if LINES:
    print("\n[tts] Demo: HTTP streaming (first line)")
    line = LINES[0]
    text = line.emotion_text()
    voice_id = line.voice_id or default_voice_id

    start = time.time()
    first_byte = None
    total_bytes = 0

    for chunk in client.tts.stream(
        text=text, model=tts_model, reference_id=voice_id, format="mp3"  # type: ignore
    ):
        if first_byte is None:
            first_byte = time.time() - start
        total_bytes += len(chunk)

    total = time.time() - start
    print(f"    Time to first byte: {first_byte * 1000:.0f} ms")
    print(f"    Total: {total:.1f}s, {total_bytes / 1024:.0f} KB")
