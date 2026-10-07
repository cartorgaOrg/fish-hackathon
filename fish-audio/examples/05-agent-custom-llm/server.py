"""Audio plumbing: the custom-LLM HTTP server Fish talks to.

Fish Audio agents can run their conversational turns against *your* OpenAI-compatible
endpoint instead of a platform-hosted model (see
https://docs.fish.audio/agents/build/custom-llm). Fish still does STT, turn-taking
and TTS; this server is the "brain" that decides what the NPC says, by owning game
state (see game.py) and either faking a reply (MOCKUP) or forwarding to a real LLM.

Protocol this server implements (from docs.fish.audio/agents/build/custom-llm):
  - POST {this server}/v1/chat/completions
    Headers:  Authorization: Bearer <CUSTOM_LLM_API_KEY>
    Body:     {"model", "stream": true, "messages": [...], "tools": [...]?,
               "session_id", "user_id"?, "fishaudio_extra_body"?}
  - Response: SSE stream of OpenAI `chat.completion.chunk` objects, ending with a
    chunk carrying finish_reason "stop" and then the literal line `data: [DONE]`.
  - If your reply is a tool call, Fish executes the tool and sends a follow-up
    request with the assistant tool_calls message and a `role: "tool"` result
    message appended to `messages` (see game.on_tool_result).

No FISH_API_KEY is needed to build or test this file: it's a plain HTTP server you
can curl directly (see README "Testing locally").
"""

from __future__ import annotations

import json
import logging
import os
import secrets
import time
import uuid
from typing import Any, AsyncIterator

from dotenv import find_dotenv, load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

import game

load_dotenv(find_dotenv(usecwd=True))

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("game-master")

DEV_DEFAULT_KEY = "dev-only-change-me"
# `or`, not a get() default: .env.example ships `CUSTOM_LLM_API_KEY=` empty, and an empty key would accept an empty token.
CUSTOM_LLM_API_KEY = os.environ.get("CUSTOM_LLM_API_KEY") or DEV_DEFAULT_KEY
if CUSTOM_LLM_API_KEY == DEV_DEFAULT_KEY:
    log.warning(
        "[auth] CUSTOM_LLM_API_KEY not set - using an insecure dev default (%s). "
        "Set CUSTOM_LLM_API_KEY in .env before exposing this server publicly.",
        DEV_DEFAULT_KEY,
    )

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")

app = FastAPI(title="fish-game-master")


def _check_auth(authorization: str | None = Header(default=None)) -> None:
    """Validate the Bearer token Fish sends (set via llm.custom.api_key on the agent).

    Used as a FastAPI dependency so both the chat-completions and the game-event
    routes share the same check.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if not token or not secrets.compare_digest(token, CUSTOM_LLM_API_KEY):
        raise HTTPException(status_code=401, detail="invalid bearer token")


def _session_key(body: dict[str, Any]) -> str:
    """Resolve the game-state key for a request.

    Fish always sends `session_id`. A game client can additionally pass a
    `game_session_id` inside `llm_extra_body` (forwarded here as
    `fishaudio_extra_body`) to share state across multiple Fish sessions, e.g. one
    per reconnect. Fall back to `session_id` when it's absent.
    """
    extra = body.get("fishaudio_extra_body") or {}
    return str(extra.get("game_session_id") or body.get("session_id") or "default")


def _sse(chunk: dict[str, Any]) -> str:
    return f"data: {json.dumps(chunk)}\n\n"


def _chunk(request_id: str, model: str, delta: dict[str, Any], finish_reason: str | None) -> dict:
    # OpenAI-standard form: every chunk's choice carries "finish_reason", null until
    # the final one. The real-LLM passthrough path (_stream_real_llm) keeps the
    # same field from upstream, so both paths are shaped identically.
    return {
        "id": request_id,
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
    }


async def _stream_mock(messages: list[dict], state: dict, model: str) -> AsyncIterator[str]:
    """MOCKUP: fake an OpenAI SSE stream for game.mock_reply's one-shot string.

    Real LLM providers emit many small deltas; we only need one chunk with the
    whole line plus a closing chunk, which is a valid (if minimal) SSE stream.
    """
    request_id = f"chatcmpl-mock-{uuid.uuid4().hex[:12]}"
    reply = game.mock_reply(messages, state)
    log.info("[MOCKUP] reply: %s", reply)
    yield _sse(_chunk(request_id, model, {"role": "assistant", "content": reply}, None))
    yield _sse(_chunk(request_id, model, {}, "stop"))
    yield "data: [DONE]\n\n"


async def _stream_real_llm(
    messages: list[dict], tools: list[dict] | None, model: str
) -> AsyncIterator[str]:
    """Forward to a real OpenAI-compatible LLM and pass its SSE chunks through unchanged.

    Context (the system message from game.build_context) is already injected into
    `messages` by the caller. tool_calls in the upstream stream are forwarded as-is;
    Fish parses them the same way it would parse ours.
    """
    from openai import AsyncOpenAI  # imported lazily so the mock path has no dependency

    client = AsyncOpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)
    kwargs: dict[str, Any] = {"model": LLM_MODEL, "messages": messages, "stream": True}
    if tools:
        kwargs["tools"] = tools
    stream = await client.chat.completions.create(**kwargs)
    async for event in stream:
        # No exclude_none: keep "finish_reason": null on in-progress chunks, same
        # shape as _chunk() above, instead of omitting the key.
        yield _sse(event.model_dump())
    yield "data: [DONE]\n\n"


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "mode": "real-llm" if LLM_API_KEY else "mock"}


@app.post("/v1/chat/completions", dependencies=[Depends(_check_auth)])
async def chat_completions(request: Request) -> StreamingResponse:
    body = await request.json()

    session_id = body.get("session_id", "unknown")
    extra_body = body.get("fishaudio_extra_body") or {}
    log.info("[session %s] fishaudio_extra_body=%s", session_id, extra_body)

    messages: list[dict] = body.get("messages", [])
    tools: list[dict] | None = body.get("tools") or None
    model = body.get("model", "game-master")

    state = game.get_state(_session_key(body))

    # GAME HOOK (tool round-trip): a tool result arrives as the last message with
    # role "tool" when Fish calls back after executing one of our agent tools.
    if messages and messages[-1].get("role") == "tool":
        last_assistant = next(
            (m for m in reversed(messages[:-1]) if m.get("role") == "assistant" and m.get("tool_calls")),
            None,
        )
        tool_name = "unknown"
        if last_assistant:
            calls = last_assistant.get("tool_calls") or []
            matching = next((c for c in calls if c.get("id") == messages[-1].get("tool_call_id")), None)
            if matching:
                tool_name = matching.get("function", {}).get("name", "unknown")
        try:
            tool_result = json.loads(messages[-1].get("content") or "{}")
        except json.JSONDecodeError:
            tool_result = {"raw": messages[-1].get("content")}
        game.on_tool_result(_session_key(body), tool_name, tool_result)
        state = game.get_state(_session_key(body))

    # Inject our context as a system message right before the latest turn, after
    # whatever system prompt Fish already assembled (keep it short, see README).
    context_message = {"role": "system", "content": game.build_context(state)}
    if messages:
        messages_with_context = [*messages[:-1], context_message, messages[-1]]
    else:
        messages_with_context = [context_message]

    if LLM_API_KEY:
        log.info("[session %s] forwarding to real LLM (%s)", session_id, LLM_MODEL)
        generator = _stream_real_llm(messages_with_context, tools, model)
    else:
        generator = _stream_mock(messages_with_context, state, model)

    return StreamingResponse(generator, media_type="text/event-stream")


@app.post("/game/{game_session_id}/event", dependencies=[Depends(_check_auth)])
async def post_event(game_session_id: str, request: Request) -> dict:
    """Let a game client push an event into state ahead of the NPC's next turn.

    This is the context-injection demo: curl this, then send a chat completion
    request with a matching `game_session_id` and watch build_context react.
    Protected by the same CUSTOM_LLM_API_KEY bearer check as /v1/chat/completions —
    anyone who can reach this endpoint can rewrite your game state.
    """
    body = await request.json()
    event = body.get("event")
    if not event:
        raise HTTPException(status_code=422, detail="missing 'event'")
    payload = body.get("payload") or {}
    state = game.apply_event(game_session_id, event, payload)
    log.info("[event] session=%s event=%s payload=%s -> state=%s", game_session_id, event, payload, state)
    return {"ok": True, "state": state}
