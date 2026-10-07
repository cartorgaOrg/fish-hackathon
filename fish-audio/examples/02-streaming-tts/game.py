"""MOCKUP GAME: a stand-in so this example runs end to end. It is NOT where your real game has to live.
Keep the audio code, connect your real game (engine, frontend, backend, ...) to the GAME HOOK touch
points below, then delete the mock content.

The mock NPC "brain". Everything else in this example is audio plumbing.

Replace stream_npc_reply with your real game/LLM logic. Keep it an async generator that
yields small text pieces as they become available -- that's what lets stream_tts.py start
speaking before the whole reply exists.
"""

import asyncio
import os

# One-sentence persona, per CONVENTIONS.md. GAME HOOK: swap in your NPC's real personality.
NPC_PROMPT = (
    "You are Brom, a grumpy bridge guard in a fantasy village. "
    "Answer in one or two short sentences. "
    "You may use at most one [bracketed emotion/delivery tag] per sentence, e.g. [sighs], "
    "[annoyed] -- Fish's S2 models render these as vocal delivery, not spoken words."
)

# GAME HOOK: your real game state goes here (quest flags, inventory, time of day, ...).
GAME_STATE = {"location": "bridge", "player_has_sword": False, "guard_mood": "annoyed"}

_MOCKUP_REPLY = (
    "[sighs] Halt, traveller. The bridge is closed tonight -- orders from the captain."
)


async def _mockup_stream():
    """MOCKUP: fakes an LLM emitting tokens one word at a time, with small gaps.

    Stands in for a real LLM so the example runs with only FISH_API_KEY. Replace the whole
    function (or point stream_npc_reply at a real LLM, see below) with your game's brain.
    """
    for word in _MOCKUP_REPLY.split(" "):
        print(f"[MOCKUP] token: {word!r}")
        yield word + " "
        await asyncio.sleep(0.1)  # simulate per-token LLM latency


async def _llm_stream(player_text: str, state: dict):
    """Real OpenAI-compatible streaming chat completion. Used when LLM_API_KEY is set."""
    from openai import AsyncOpenAI  # imported lazily so the mock path needs no extra deps

    client = AsyncOpenAI(
        base_url=os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1"),
        api_key=os.environ["LLM_API_KEY"],
    )
    model = os.environ.get("LLM_MODEL", "gpt-4o-mini")

    # GAME HOOK: inject game state into the prompt so the NPC reacts to the world.
    system_prompt = f"{NPC_PROMPT}\nGame state: {state}"

    stream = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": player_text},
        ],
        stream=True,
    )
    async for event in stream:
        delta = event.choices[0].delta.content
        if delta:
            print(f"[llm] token: {delta!r}")
            yield delta


def stream_npc_reply(player_text: str, state: dict):
    """Yield the NPC's reply piece by piece, as it's "thought up".

    GAME HOOK: choose a different voice per NPC here (map NPC id -> FISH_VOICE_ID) before
    calling the TTS layer in stream_tts.py.
    """
    if os.environ.get("LLM_API_KEY"):
        return _llm_stream(player_text, state)
    return _mockup_stream()


if __name__ == "__main__":
    # Quick manual check: prints the mock token stream without touching Fish at all.
    async def _demo():
        async for piece in stream_npc_reply("Let me cross.", GAME_STATE):
            pass

    asyncio.run(_demo())
