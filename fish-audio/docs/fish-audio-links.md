# Fish Audio links

Curated, categorized index into the official docs. Pulled from
[`llms.txt`](https://docs.fish.audio/llms.txt) — if a link below looks stale, that file is the
source of truth; every page there also exists as `<page>.md`.

> ## 🤖 Coding agents: start here
>
> ```bash
> npx skills add https://docs.fish.audio
> # non-interactive (CI / scripted / no TTY):
> npx skills add https://docs.fish.audio -s '*' -a <agent> --copy -y
> ```
>
> Installs the two official skills — **`fish-audio-sdk`** (Python/JS SDK method signatures) and
> **`fish-audio-api`** (raw REST/WebSocket) — already committed for Claude Code in
> `.claude/skills/`. Read them before writing any Fish Audio call; they're more precise than this
> page or model memory.
>
> | Resource | URL | Use for |
> |---|---|---|
> | Doc index | https://docs.fish.audio/llms.txt | Finding the right page fast (this file's source) |
> | Full doc dump | https://docs.fish.audio/llms-full.txt | One fetch, every page, when you need to grep broadly |
> | OpenAPI spec | https://docs.fish.audio/api-reference/openapi.json | Exact REST schema, codegen |
> | WebSocket reference | https://docs.fish.audio/api-reference/endpoint/websocket/tts-live.md | Exact WebSocket schema and event sequence |
> | MCP server | https://api.fish.audio/mcp | Tools, not docs: search voices, generate speech, transcribe, OAuth sign-in |
> | Pricing & rate limits | https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits.md | Current prices and concurrency tiers (plans: https://fish.audio/plan) |

## Start here

| Page | When to read it |
|---|---|
| [Coding Assistant Quickstart](https://docs.fish.audio/developer-guide/resources/agent-quickstart.md) | Minimal-noise entry point built for AI agents |
| [Quick Start](https://docs.fish.audio/developer-guide/getting-started/quickstart.md) | First TTS call, human-oriented walkthrough |
| [AI Coding Assistants](https://docs.fish.audio/developer-guide/resources/coding-agents.md) | The skills-install flow in full, including `--list` / `--skill` / `-a` flags |

## Core REST & WebSocket API

| Page | When to read it |
|---|---|
| [API Introduction](https://docs.fish.audio/api-reference/introduction.md) | Auth, base URL, general conventions |
| [Text to Speech endpoint](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech.md) | Every `POST /v1/tts` field |
| [Speech to Text endpoint](https://docs.fish.audio/api-reference/endpoint/openapi-v1/speech-to-text.md) | Every `POST /v1/asr` field, `transcribe-1-pro` vs `transcribe-1` |
| [Voice Design endpoint](https://docs.fish.audio/api-reference/endpoint/openapi-v1/voice-design.md) | `POST /v1/voice-design` fields |
| [WebSocket TTS Streaming](https://docs.fish.audio/api-reference/endpoint/websocket/tts-live.md) | `wss://.../v1/tts/live` event protocol |
| [List/Create/Get/Update/Delete Model](https://docs.fish.audio/api-reference/endpoint/model/list-models.md) | Voice model CRUD (`/model` family) |

## SDKs

| Page | When to read it |
|---|---|
| [Python SDK overview](https://docs.fish.audio/developer-guide/sdk-guide/python/overview.md) | `fishaudio` package setup |
| [Python TTS](https://docs.fish.audio/developer-guide/sdk-guide/python/text-to-speech.md) / [Voice cloning](https://docs.fish.audio/developer-guide/sdk-guide/python/voice-cloning.md) / [WebSocket](https://docs.fish.audio/developer-guide/sdk-guide/python/websocket.md) | Task-specific Python SDK usage |
| [JavaScript install](https://docs.fish.audio/developer-guide/sdk-guide/javascript/installation.md) | `fish-audio` npm package setup |
| [JavaScript TTS](https://docs.fish.audio/developer-guide/sdk-guide/javascript/text-to-speech.md) / [Voice cloning](https://docs.fish.audio/developer-guide/sdk-guide/javascript/voice-cloning.md) / [WebSocket](https://docs.fish.audio/developer-guide/sdk-guide/javascript/websocket.md) | Task-specific JS SDK usage |

## Product guides (concepts)

| Page | When to read it |
|---|---|
| [Text to Speech guide](https://docs.fish.audio/developer-guide/core-features/text-to-speech.md) | Formats, prosody, model choice |
| [Speech to Text guide](https://docs.fish.audio/features/speech-to-text.md) | Batch-only ASR, speaker turns, limits |
| [Voice Design guide](https://docs.fish.audio/features/voice-design.md) | Generating voices from a prompt |
| [Creating voice models](https://docs.fish.audio/developer-guide/core-features/creating-models.md) | Persistent clones via `POST /model` |
| [Emotion Control](https://docs.fish.audio/developer-guide/core-features/emotions.md) | `[bracket]`/`(parenthesis)` tag reference |
| [Fine-grained Control](https://docs.fish.audio/developer-guide/core-features/fine-grained-control.md) | Phonemes, paralanguage |
| [Pronunciation Dictionaries](https://docs.fish.audio/developer-guide/core-features/fine-grained-control/pronunciation-dictionaries.md) | Reusable name/term pronunciation rules |
| [Voice Cloning Best Practices](https://docs.fish.audio/developer-guide/best-practices/voice-cloning.md) | Recording a good reference clip |
| [Real-time Voice Streaming](https://docs.fish.audio/developer-guide/best-practices/real-time-streaming.md) | Streaming TTS patterns and tuning |

## Voice Agents (paths A/B)

| Page | When to read it |
|---|---|
| [Agents Overview](https://docs.fish.audio/agents/overview.md) / [Quickstart](https://docs.fish.audio/agents/quickstart.md) / [Concepts](https://docs.fish.audio/agents/concepts.md) | Starting from zero |
| [Configuration](https://docs.fish.audio/agents/build/configuration.md) / [Voice & Language](https://docs.fish.audio/agents/build/voice-language.md) | System prompt, first message, voice |
| [Dynamic Variables](https://docs.fish.audio/agents/build/dynamic-variables.md) | `{{var}}` personalization |
| [Tools Overview](https://docs.fish.audio/agents/build/tools.md) / [Webhook Tools](https://docs.fish.audio/agents/build/webhook-tools.md) / [Client Tools](https://docs.fish.audio/agents/build/client-tools.md) / [System Tools](https://docs.fish.audio/agents/build/system-tools.md) | AI → game actions |
| [Custom LLM](https://docs.fish.audio/agents/build/custom-llm.md) | Path B: your server owns the replies |
| [Authentication & Session Tokens](https://docs.fish.audio/agents/deploy/authentication.md) / [Authenticated Sessions](https://docs.fish.audio/agents/deploy/authenticated-sessions.md) | Server-minted tokens, overrides |
| [Public Agents](https://docs.fish.audio/agents/deploy/public-agents.md) | Credential-free browser access |
| [Web SDK](https://docs.fish.audio/agents/deploy/web-sdk.md) / [React SDK](https://docs.fish.audio/agents/deploy/react-sdk.md) / [Widget](https://docs.fish.audio/agents/deploy/widget.md) | Client integration |
| [Wire Protocol](https://docs.fish.audio/agents/deploy/protocol.md) | Non-SDK / custom-client realtime contract |
| [Conversation History](https://docs.fish.audio/agents/monitor/conversation-history.md) / [Webhooks](https://docs.fish.audio/agents/monitor/webhooks.md) | Transcripts, tool timelines, `call.ended` events |

## Operational

| Page | When to read it |
|---|---|
| [Models Overview](https://docs.fish.audio/developer-guide/models-pricing/models-overview.md) | Full model lineup and capabilities |
| [Choosing a Model](https://docs.fish.audio/developer-guide/models-pricing/choosing-a-model.md) | `s2.1-pro` vs `s2.1-pro-free` vs legacy |
| [Pricing & Rate Limits](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits.md) | Prices, concurrency tiers — see [gotchas.md](gotchas.md) |
| [Model Deprecations](https://docs.fish.audio/developer-guide/models-pricing/deprecations.md) | Before you build on a legacy model |

## Fish Audio docs

(Meta-note: this whole file *is* the curated Fish Audio docs list for this folder. For the raw
machine-readable index, see https://docs.fish.audio/llms.txt — for everything in one fetch,
https://docs.fish.audio/llms-full.txt.)
