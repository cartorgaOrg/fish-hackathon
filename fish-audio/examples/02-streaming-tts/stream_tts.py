"""Stream an NPC's reply to Fish's live TTS WebSocket and speak it as it's generated.

This is the latency trick: instead of waiting for the whole LLM reply, then calling TTS,
we feed text to Fish as soon as each piece exists. The first audio chunk can come back
before the LLM has finished "thinking" the rest of the sentence.

Docs this relies on:
- Real-time streaming guide: https://docs.fish.audio/developer-guide/best-practices/real-time-streaming.md
- WebSocket TTS endpoint:    https://docs.fish.audio/api-reference/endpoint/websocket/tts-live.md
- Python SDK websocket:      https://docs.fish.audio/developer-guide/sdk-guide/python/websocket.md

Run: uv run stream_tts.py "Let me cross the bridge" [--play]
"""

import argparse
import asyncio
import os
import time

from dotenv import find_dotenv, load_dotenv
from fishaudio import AsyncFishAudio
from fishaudio.utils import play, save

from game import GAME_STATE, stream_npc_reply

load_dotenv(find_dotenv(usecwd=True))

OUT_PATH = os.path.join(os.path.dirname(__file__), "out", "stream.mp3")


async def dry_run(player_text: str) -> None:
    """Print the NPC token stream without ever touching the Fish API. No FISH_API_KEY needed."""
    print("[dry-run] streaming NPC tokens only, no TTS call will be made")
    async for piece in stream_npc_reply(player_text, GAME_STATE):
        print(f"[dry-run] piece: {piece!r}")


async def speak(player_text: str, do_play: bool) -> None:
    if not os.environ.get("FISH_API_KEY"):
        raise SystemExit(
            "Missing FISH_API_KEY. Copy fish-audio/.env.example to fish-audio/.env and add your key "
            "(https://fish.audio/app/api-keys)."
        )

    client = AsyncFishAudio()  # reads FISH_API_KEY
    text_stream = stream_npc_reply(player_text, GAME_STATE)

    # FISH_TTS_MODEL: the SDK's type hints only know "s1"/"s2-pro" (and legacy speech-1.x),
    # but "s2.1-pro" works fine over the wire -- hence the type: ignore. See AGENTS.md.
    model = os.environ.get("FISH_TTS_MODEL", "s2.1-pro")
    voice = os.environ.get("FISH_VOICE_ID") or None

    start = time.monotonic()
    first_chunk_at = None
    chunks: list[bytes] = []

    # latency="balanced" (the SDK's only options are "normal"/"balanced"; the raw WebSocket
    # protocol also accepts "low" -- see stream_tts_raw.py). The server also chunks text
    # internally and flushes at sentence-ish boundaries; see the comment in game.py's mock
    # generator for how text pieces arrive here.
    async for audio_chunk in client.tts.stream_websocket(
        text_stream,
        model=model,  # type: ignore[arg-type]
        reference_id=voice,
        format="mp3",
        latency="balanced",
    ):
        if first_chunk_at is None:
            first_chunk_at = time.monotonic()
            print(f"[tts] first audio chunk after {first_chunk_at - start:.3f}s")
        chunks.append(audio_chunk)

    total = time.monotonic() - start
    print(f"[tts] done, {len(chunks)} chunks, total {total:.3f}s")

    audio = b"".join(chunks)
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    save(audio, OUT_PATH)
    print(f"[tts] saved to {OUT_PATH}")

    if do_play:
        play(audio)  # needs ffmpeg/ffplay (or mpv) on PATH


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("player_text", nargs="?", default="Let me cross the bridge.")
    parser.add_argument("--play", action="store_true", help="play audio after saving")
    parser.add_argument(
        "--dry-run", action="store_true", help="print the mock NPC tokens, skip Fish entirely"
    )
    args = parser.parse_args()
    if args.dry_run:
        asyncio.run(dry_run(args.player_text))
    else:
        asyncio.run(speak(args.player_text, args.play))


if __name__ == "__main__":
    main()
