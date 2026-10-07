"""Run the pipeline once from the command line, no browser needed.

    uv run python cli_test.py [path/to/utterance.wav]

With no file given, generates a short tone WAV in memory (fine with MOCK_STT=1, since real
STT would just fail to find speech in it). Useful for exercising STT -> LLM -> TTS end to
end, including fully offline with MOCK_STT=1 MOCK_TTS=1 and no LLM_API_KEY.
"""

import asyncio
import math
import os
import re
import struct
import sys
import wave
from io import BytesIO
from pathlib import Path

from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))

from fishaudio import AsyncFishAudio

import game
import llm
import stt
import tts

SENTENCE_END = re.compile(r"(?<=[.!?])\s+")  # same split as server.py


def _tone_wav() -> bytes:
    sample_rate, seconds = 16000, 0.5
    frames = b"".join(
        struct.pack("<h", int(3000 * math.sin(2 * math.pi * 440 * i / sample_rate)))
        for i in range(int(sample_rate * seconds))
    )
    buf = BytesIO()
    with wave.open(buf, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(frames)
    return buf.getvalue()


async def main():
    wav_bytes = Path(sys.argv[1]).read_bytes() if len(sys.argv) > 1 else _tone_wav()

    transcript = await stt.transcribe(wav_bytes)
    print(f"transcript: {transcript!r}")
    if not transcript:
        return

    state = dict(game.GAME_STATE)
    game.on_player_utterance(transcript, state)
    messages = game.build_messages([], transcript, state)

    reply = ""
    async for token in llm.stream_reply(messages):
        reply += token
    print(f"reply: {reply!r}")

    clean_text, state = game.postprocess_reply(reply, state)
    print(f"state: {state}")

    out_dir = Path("out")
    out_dir.mkdir(exist_ok=True)
    client = None if os.environ.get("MOCK_TTS") == "1" else AsyncFishAudio()
    try:
        sentences = [s.strip() for s in SENTENCE_END.split(clean_text) if s.strip()]
        for i, sentence in enumerate(sentences):
            audio, fmt = await tts.synthesize_sentence(client, sentence, game.get_voice_for_npc())
            path = out_dir / f"cli_test_sentence_{i}.{fmt}"
            path.write_bytes(audio)
            print(f"wrote {path} ({len(audio)} bytes)")
    finally:
        if client:
            await client.close()


if __name__ == "__main__":
    asyncio.run(main())
