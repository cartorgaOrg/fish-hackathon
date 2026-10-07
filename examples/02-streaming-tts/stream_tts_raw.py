"""Same thing as stream_tts.py, but talking raw WebSocket + MessagePack, no SDK.

Useful if your game engine (Unity/Godot/etc.) can't pull in the Python/JS SDK and has to
speak the wire protocol directly. Protocol per the fish-audio-api skill / asyncapi.yml:

  client -> server: StartEvent {event:"start", request:<TTSRequest>} (once, first message)
                     TextEvent  {event:"text", text:"..."}           (one per text piece)
                     FlushEvent {event:"flush"}                      (optional, see below)
                     CloseEvent {event:"stop"}                       (final; literal is "stop")
  server -> client:  AudioEvent  {event:"audio", audio:<bytes>}      (many; concat in order)
                      FinishEvent {event:"finish", reason:"stop"|"error"} (exactly one, then closes)

All frames are MessagePack-encoded binary WebSocket messages.
Docs: https://docs.fish.audio/api-reference/endpoint/websocket/tts-live.md
"""

import asyncio
import os
import time

import msgpack
import websockets
from dotenv import find_dotenv, load_dotenv

from game import GAME_STATE, stream_npc_reply

load_dotenv(find_dotenv(usecwd=True))

URL = "wss://api.fish.audio/v1/tts/live"


async def speak_raw(player_text: str) -> None:
    api_key = os.environ.get("FISH_API_KEY")
    if not api_key:
        raise SystemExit("Missing FISH_API_KEY. Copy .env.example to .env and fill it in.")

    headers = {"Authorization": f"Bearer {api_key}", "model": os.environ.get("FISH_TTS_MODEL", "s2.1-pro")}
    start_event = {
        "event": "start",
        "request": {
            "text": "",
            "reference_id": os.environ.get("FISH_VOICE_ID") or None,
            "format": "mp3",
            "latency": "low",  # raw WS also accepts "low"; the Python SDK does not.
        },
    }

    t0 = time.monotonic()
    first_audio = None
    out_path = os.path.join(os.path.dirname(__file__), "out", "stream_raw.mp3")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    async with websockets.connect(URL, additional_headers=headers, max_size=None) as ws:
        await ws.send(msgpack.packb(start_event, use_bin_type=True))

        async def sender():
            # Each piece from game.py is sent as its own TextEvent. A FlushEvent would force
            # the server to synthesize whatever is buffered right now -- useful at a sentence
            # boundary (". " / "! " / "? ") so the player hears that clause without waiting
            # for the rest of the reply. We skip it here since our mock pieces are tiny words.
            async for piece in stream_npc_reply(player_text, GAME_STATE):
                await ws.send(msgpack.packb({"event": "text", "text": piece}, use_bin_type=True))
            await ws.send(msgpack.packb({"event": "stop"}, use_bin_type=True))

        send_task = asyncio.create_task(sender())
        with open(out_path, "wb") as f:
            async for raw in ws:
                msg = msgpack.unpackb(raw, raw=False)
                if msg["event"] == "audio":
                    if first_audio is None:
                        first_audio = time.monotonic()
                        print(f"[tts-raw] first audio chunk after {first_audio - t0:.3f}s")
                    f.write(msg["audio"])
                elif msg["event"] == "finish":
                    if msg["reason"] == "error":
                        raise RuntimeError("Fish TTS stream ended with an error")
                    break
        await send_task

    print(f"[tts-raw] done, total {time.monotonic() - t0:.3f}s, saved to {out_path}")


if __name__ == "__main__":
    import sys

    text = sys.argv[1] if len(sys.argv) > 1 else "Let me cross the bridge."
    asyncio.run(speak_raw(text))
