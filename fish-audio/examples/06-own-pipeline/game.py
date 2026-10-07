"""MOCKUP GAME: a stand-in so this example runs end to end. It is NOT where your real game has to live.
Keep the audio code, connect your real game (engine, frontend, backend, ...) to the GAME HOOK touch
points below, then delete the mock content.

The mock game for this pipeline. Everything else in this example is audio plumbing.

Swap the mock NPC_PROMPT, GAME_STATE and hooks below for calls into your real game. Nothing in
server.py / stt.py / llm.py / tts.py needs to change to support a different game.
"""

import os
import re

NPC_PROMPT = (
    "You are Brom, a grumpy bridge guard in a fantasy village. "
    "Answer in one or two short sentences. "
    "If the player convinces you to let them through, end your reply with <action:open_gate>."
)

# GAME HOOK: your real game state goes here (quest flags, inventory, NPC mood, ...).
# MOCKUP: a tiny dict is enough to demonstrate state flowing through the pipeline.
GAME_STATE = {"gate_open": False, "turns": 0}

# GAME HOOK: pick a voice per NPC. Falls back to the account default voice if unset.
NPC_VOICES = {"brom": os.environ.get("FISH_VOICE_ID") or None}


def get_voice_for_npc(npc_id: str = "brom") -> str | None:
    return NPC_VOICES.get(npc_id)


def on_player_utterance(transcript: str, state: dict) -> None:
    """GAME HOOK: react to the raw transcript before the LLM sees it (e.g. keyword triggers)."""
    state["turns"] += 1


def build_messages(history: list[dict], transcript: str, state: dict) -> list[dict]:
    """GAME HOOK: inject game state into the LLM context however your game needs."""
    system = f"{NPC_PROMPT}\nCurrent state: gate_open={state['gate_open']}."
    return [{"role": "system", "content": system}, *history, {"role": "user", "content": transcript}]


def postprocess_reply(reply_text: str, state: dict) -> tuple[str, dict]:
    """GAME HOOK: parse `<action:...>` tags out of the LLM text and update state."""
    for action in re.findall(r"<action:(\w+)>", reply_text):
        if action == "open_gate":
            state["gate_open"] = True
    clean_text = re.sub(r"<action:\w+>", "", reply_text).strip()
    return clean_text, state
