"""FastAPI server: serves the browser page and runs the voice pipeline over one WebSocket.

Protocol on /ws:
  browser -> server: one binary WS message per utterance = a WAV file (one VAD-detected
                      utterance, or one push-to-talk recording).
  server -> browser: JSON text messages for status/text, each immediately followed by a
                      binary WS message with that step's audio when relevant.
    {"type": "transcript", "text": ...}
    {"type": "reply_sentence", "text": ...}       -> next binary frame is that sentence's audio
    {"type": "audio_meta", "format": "mp3"|"wav"}
    {"type": "timing", "stt_ms", "llm_first_token_ms", "tts_first_audio_ms"}
    {"type": "state", "state": {...}}
    {"type": "done"}
    {"type": "barge_in"}   -> a new utterance arrived while a reply was still playing;
                               browser should stop playback immediately.

Barge-in: each connection tracks the asyncio task currently running the pipeline. A new
utterance cancels it before starting the next one - simple and good enough for a hackathon.
"""

import asyncio
import os
import re
import time

from dotenv import find_dotenv, load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

load_dotenv(find_dotenv(usecwd=True))

from fishaudio import AsyncFishAudio

import game
import llm
import stt
import tts

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
ACTION_TAG = re.compile(r"<action:\w+>")


@app.get("/")
async def index():
    return FileResponse("static/index.html")


async def run_pipeline(ws: WebSocket, wav_bytes: bytes, history: list[dict], state: dict):
    t0 = time.monotonic()
    transcript = await stt.transcribe(wav_bytes)
    stt_ms = (time.monotonic() - t0) * 1000
    await ws.send_json({"type": "transcript", "text": transcript})
    if not transcript:
        return

    game.on_player_utterance(transcript, state)
    messages = game.build_messages(history, transcript, state)
    voice_id = game.get_voice_for_npc()

    llm_first_token_ms = None
    tts_first_audio_ms = None
    buffer = ""
    full_reply = ""
    t_llm_start = time.monotonic()

    # One Fish client reused for every sentence in this turn, instead of opening a fresh
    # client/connection per sentence. None when MOCK_TTS=1, since no client is needed then.
    tts_client = None if os.environ.get("MOCK_TTS") == "1" else AsyncFishAudio()

    async def speak(sentence: str):
        nonlocal tts_first_audio_ms
        sentence = ACTION_TAG.sub("", sentence).strip()  # don't speak <action:...> tags
        if not sentence:
            return
        audio, fmt = await tts.synthesize_sentence(tts_client, sentence, voice_id)
        if tts_first_audio_ms is None:
            tts_first_audio_ms = (time.monotonic() - t_llm_start) * 1000
        await ws.send_json({"type": "reply_sentence", "text": sentence})
        await ws.send_json({"type": "audio_meta", "format": fmt})
        await ws.send_bytes(audio)

    try:
        async for token in llm.stream_reply(messages):
            if llm_first_token_ms is None:
                llm_first_token_ms = (time.monotonic() - t_llm_start) * 1000
            buffer += token
            full_reply += token
            parts = SENTENCE_END.split(buffer)
            if len(parts) > 1:
                for sentence in parts[:-1]:
                    if sentence.strip():
                        await speak(sentence.strip())
                buffer = parts[-1]
        if buffer.strip():
            await speak(buffer.strip())
    finally:
        if tts_client:
            await tts_client.close()

    clean_text, state = game.postprocess_reply(full_reply, state)
    history.append({"role": "user", "content": transcript})
    history.append({"role": "assistant", "content": clean_text})

    await ws.send_json(
        {
            "type": "timing",
            "stt_ms": round(stt_ms),
            "llm_first_token_ms": round(llm_first_token_ms or 0),
            "tts_first_audio_ms": round(tts_first_audio_ms or 0),
        }
    )
    await ws.send_json({"type": "state", "state": state})
    await ws.send_json({"type": "done"})


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    history: list[dict] = []
    state = dict(game.GAME_STATE)
    current_task = None
    try:
        while True:
            wav_bytes = await ws.receive_bytes()
            if current_task and not current_task.done():
                current_task.cancel()  # barge-in: new utterance interrupts current reply
                await asyncio.gather(current_task, return_exceptions=True)  # let it unwind
                await ws.send_json({"type": "barge_in"})
            current_task = asyncio.ensure_future(run_pipeline(ws, wav_bytes, history, state))
    except WebSocketDisconnect:
        if current_task:
            current_task.cancel()
