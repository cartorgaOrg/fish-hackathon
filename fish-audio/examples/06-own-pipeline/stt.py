"""Speech-to-text: one WAV utterance in, one transcript string out.

Fish STT is BATCH ONLY (`POST /v1/asr`) - no streaming. That's why the browser's VAD
decides end-of-speech and ships one whole clip here. Docs:
https://docs.fish.audio/features/speech-to-text.md

FISH_STT_MODEL (header, default "transcribe-1"): "transcribe-1" is faster and enough for
short, single-speaker VAD utterances. Switch to "transcribe-1-pro" (.env) for longer or
multi-speaker clips / diarization - see .claude/skills/fish-audio-sdk/SKILL.md.

Swap this module for a local model (faster-whisper) or a streaming STT provider (Deepgram).
"""

import os

from fishaudio import AsyncFishAudio
from fishaudio.core.request_options import RequestOptions

STT_MODEL = os.environ.get("FISH_STT_MODEL", "transcribe-1")


async def transcribe(wav_bytes: bytes) -> str:
    if os.environ.get("MOCK_STT") == "1":
        print("[stt] [MOCKUP] MOCK_STT=1 -> fixed transcript")
        return "Hey, can you open the gate for me?"

    async with AsyncFishAudio() as client:  # reads FISH_API_KEY from env
        response = await client.asr.transcribe(
            audio=wav_bytes,
            include_timestamps=False,  # we only need the text, not word timings
            request_options=RequestOptions(additional_headers={"model": STT_MODEL}),
        )
    print(f"[stt] ({STT_MODEL}) -> {response.text!r}")
    return (response.text or "").strip()
