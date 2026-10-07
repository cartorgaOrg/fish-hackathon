"""MOCKUP GAME: a stand-in so this example runs end to end. It is NOT where your real game has to live.
Keep the audio code, connect your real game (engine, frontend, backend, ...) to the GAME HOOK touch
points below, then delete the mock content.

The mock game behind the custom-LLM "game master" server.

Fish owns voice (STT, turn-taking, TTS). This file owns the game: who the NPC is,
what it currently knows about the world, and what it should say next. `server.py`
is audio/transport plumbing only — it should never contain game rules.

GAME HOOK: replace everything in this file with your own game. Keep the three
function signatures (`build_context`, `mock_reply`, `on_tool_result`) if you want
`server.py` to keep working unmodified.
"""

from __future__ import annotations

import threading

# GAME HOOK: your NPC's persona, one sentence as per CONVENTIONS.md.
NPC_PROMPT = (
    "You are Brom, a grumpy bridge guard in a fantasy village. "
    "Answer in one or two short sentences."
)

# MOCKUP: in-memory game state, keyed by Fish `session_id`. A real game would use
# a database or a session store shared with the rest of the backend.
# GAME HOOK: your real game state goes here (quest flags, inventory, NPC mood, ...).
_STATE_LOCK = threading.Lock()
_STATE: dict[str, dict] = {}

DEFAULT_STATE = {
    "player_has_sword": False,
    "bridge_open": False,
    "mood": "grumpy",
    "turns": 0,
}


def get_state(session_id: str) -> dict:
    """Return the game state for a session, creating it on first use."""
    with _STATE_LOCK:
        if session_id not in _STATE:
            _STATE[session_id] = dict(DEFAULT_STATE)
        return _STATE[session_id]


def apply_event(session_id: str, event: str, payload: dict | None = None) -> dict:
    """Mutate state in response to an out-of-band game event (see POST /game/{id}/event).

    GAME HOOK: this is where a game client's actions (combat, inventory, quest
    progress) turn into state the NPC's next line can react to.
    """
    state = get_state(session_id)
    payload = payload or {}

    if event == "sword_drawn":
        state["player_has_sword"] = True
    elif event == "sword_sheathed":
        state["player_has_sword"] = False
    elif event == "bridge_opened":
        state["bridge_open"] = True
    elif event == "set_mood":
        mood = payload.get("mood")
        if mood:
            state["mood"] = mood
    # Unknown events are stored verbatim so the mock/LLM can still see them happened.
    state["last_event"] = event
    return state


def build_context(state: dict) -> str:
    """Render game state into a short system message injected before the chat history.

    GAME HOOK: this is the main "context injection" point. Keep it short — it's
    added to every request and eats into the latency budget (see README).
    """
    lines = [NPC_PROMPT, ""]
    lines.append(
        f"Current game state: bridge_open={state['bridge_open']}, "
        f"player_has_sword={state['player_has_sword']}, mood={state['mood']}."
    )
    if state["player_has_sword"]:
        lines.append("The player is holding a drawn sword. Brom is wary of this.")
    if state["bridge_open"]:
        lines.append("The bridge is now open; Brom has already let the player cross.")
    last_event = state.get("last_event")
    if last_event:
        lines.append(f"Most recent game event: {last_event}.")
    return "\n".join(lines)


def mock_reply(messages: list[dict], state: dict) -> str:
    """MOCKUP: a fake "LLM" that always returns the same line, lightly aware of state.

    Replace with your own game logic, or set LLM_API_KEY to forward to a real
    OpenAI-compatible LLM instead (see server.py: call_llm).
    """
    state["turns"] += 1

    if state["player_has_sword"]:
        # [bracket] tags are spoken as emotion/delivery cues by Fish's S2 TTS models.
        return "[wary] Easy now, traveller — put that sword away before we talk business."
    if state["bridge_open"]:
        return "[MOCKUP] You're already through, friend. No need to loiter."
    return "[MOCKUP] Halt, traveller. The bridge is closed tonight. State your business."


def on_tool_result(session_id: str, tool_name: str, tool_result: dict) -> None:
    """GAME HOOK: steer the plot after a tool call resolves.

    Fish executes agent tools (webhook or client-side) and sends the result back
    to this server as a `role: "tool"` message (see README "Tool calls"). Use this
    hook to update quest state, end the conversation, or change the NPC's mood —
    e.g. `state["mood"] = "pleased"` which build_context then turns into an
    [pleased] emotion tag for the next TTS line.
    """
    state = get_state(session_id)
    state["last_event"] = f"tool:{tool_name}"
    # Example: a "pay_toll" tool succeeding opens the bridge and softens Brom's mood.
    if tool_name == "pay_toll" and tool_result.get("success"):
        state["bridge_open"] = True
        state["mood"] = "satisfied"
