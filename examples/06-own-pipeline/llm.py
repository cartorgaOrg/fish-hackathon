"""The "game brain": turn chat messages into a streamed text reply.

Any OpenAI-compatible `POST /chat/completions` endpoint works here - OpenAI, Groq,
OpenRouter, Together, or a local Ollama server (LLM_BASE_URL=http://localhost:11434/v1).
With LLM_API_KEY unset, falls back to a MOCKUP that streams a fixed line word by word, so
the whole pipeline (including TTS) is exercisable without any LLM key - only FISH_API_KEY
is required for a real run, per repo convention.

Swap this module for: any other OpenAI-compatible provider, or a direct SDK call to a
non-OpenAI-compatible provider (just keep the same `async for token in stream_reply(...)`
shape so server.py and game.py don't need to change).
"""

import asyncio
import os

from openai import AsyncOpenAI

MOCKUP_REPLY = (
    "Hmm, let me think. Fine, traveller, I suppose I can let you through. <action:open_gate>"
)


async def stream_reply(messages: list[dict]):
    """Yield text tokens/chunks for one LLM reply, as they are generated."""
    api_key = os.environ.get("LLM_API_KEY")
    if not api_key:
        print("[llm] [MOCKUP] LLM_API_KEY unset -> streaming fixed reply")
        for word in MOCKUP_REPLY.split(" "):
            await asyncio.sleep(0.05)  # simulate token-by-token pacing
            yield word + " "
        return

    client = AsyncOpenAI(api_key=api_key, base_url=os.environ.get("LLM_BASE_URL"))
    stream = await client.chat.completions.create(
        model=os.environ.get("LLM_MODEL", "gpt-4o-mini"),
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
