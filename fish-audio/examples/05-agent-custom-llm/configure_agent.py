"""Create or update a Fish agent to use this server as its custom LLM.

Confirmed against https://docs.fish.audio/api-reference/openapi.json (components
`PublicAgentCreatePayload`, `PublicAgentConfigPatchPayload`, `PublicAgentLLMPatch`,
`PublicAgentLLMCustomConfig`) and https://docs.fish.audio/agents/build/custom-llm.md
and https://docs.fish.audio/agents/build/configuration.md on 2026-10-07. Fields used
below (base_url, model, api_key under llm.custom; name/description/config on create)
match those schemas exactly, so this script should not need the "uncertain" caveat
CONVENTIONS.md asks for — but Fish's API can change, so re-check the schema if a
request fails with 422.

Usage:
    uv run python configure_agent.py

Reads from .env (see .env.example):
    FISH_API_KEY     — required
    FISH_AGENT_ID     — optional; if set, PATCH that agent's config instead of
                        creating a new one
    PUBLIC_URL        — required; your server's public URL (see README "Expose
                        your server"), e.g. https://xxxx.trycloudflare.com
    CUSTOM_LLM_API_KEY — required; must match the server's own auth check

If FISH_AGENT_ID is unset, this creates a brand-new agent named
"05-agent-custom-llm demo" and prints its id — put that id into your .env as
FISH_AGENT_ID for subsequent runs (and for 04-agent-web / the Fish console).
"""

from __future__ import annotations

import os
import sys

import httpx
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))

FISH_API_BASE = "https://api.fish.audio"
AGENT_NAME = "05-agent-custom-llm demo"


def main() -> None:
    fish_api_key = os.environ.get("FISH_API_KEY")
    public_url = os.environ.get("PUBLIC_URL")
    custom_llm_api_key = os.environ.get("CUSTOM_LLM_API_KEY")

    missing = [
        name
        for name, val in [
            ("FISH_API_KEY", fish_api_key),
            ("PUBLIC_URL", public_url),
            ("CUSTOM_LLM_API_KEY", custom_llm_api_key),
        ]
        if not val
    ]
    if missing:
        print(f"Missing required env vars: {', '.join(missing)}. See .env.example.", file=sys.stderr)
        sys.exit(1)

    base_url = public_url.rstrip("/") + "/v1"  # Fish strips a trailing /chat/completions itself,
    # but we pass the clean /v1 base per the custom-llm docs.

    llm_config = {
        "llm": {
            "custom": {
                "base_url": base_url,
                "model": "game-master",  # arbitrary; sent verbatim as `model` in our requests
                "api_key": custom_llm_api_key,
            }
        }
    }

    headers = {"Authorization": f"Bearer {fish_api_key}", "Content-Type": "application/json"}
    agent_id = os.environ.get("FISH_AGENT_ID")

    with httpx.Client(base_url=FISH_API_BASE, headers=headers, timeout=30) as client:
        if agent_id:
            print(f"Updating existing agent {agent_id} to use custom LLM at {base_url} ...")
            resp = client.patch(f"/v1/agent/agents/{agent_id}/config", json=llm_config)
            resp.raise_for_status()
            print("Draft config updated:", resp.json())
            print(
                "Draft changes only take effect on new sessions after publishing. "
                f"Publish with: curl -X POST {FISH_API_BASE}/v1/agent/agents/{agent_id}/publish "
                f'-H "Authorization: Bearer $FISH_API_KEY"'
            )
        else:
            print(f"Creating new agent '{AGENT_NAME}' with custom LLM at {base_url} ...")
            create_payload = {
                "name": AGENT_NAME,
                "description": "Example 05: game master server as custom LLM",
                "config": llm_config,
            }
            resp = client.post("/v1/agent/agents", json=create_payload)
            resp.raise_for_status()
            data = resp.json()
            new_agent_id = data.get("agent_id")
            print("Created agent:", data)
            print(f"\nAdd this to your .env: FISH_AGENT_ID={new_agent_id}")
            print(
                "Then publish it before talking to it: "
                f"curl -X POST {FISH_API_BASE}/v1/agent/agents/{new_agent_id}/publish "
                f'-H "Authorization: Bearer $FISH_API_KEY"'
            )


if __name__ == "__main__":
    main()
