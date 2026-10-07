# Choose your path

Six ways to put a voice in your game, from "just read this line out loud" to "build the whole
pipeline yourself." Pick the lowest-effort path that still gives you the control your game idea
needs — you can always move to a more custom path later, and you can mix paths in one game.

> ## 🤖 Coding agents: start here
>
> Before writing any Fish Audio code, give your coding agent the official docs:
>
> ```bash
> npx skills add https://docs.fish.audio
> # non-interactive (CI / scripted / no TTY):
> npx skills add https://docs.fish.audio -s '*' -a <agent> --copy -y
> ```
>
> This installs two skills — `fish-audio-sdk` (Python/JS SDKs) and `fish-audio-api` (raw REST/WS) —
> already committed for Claude Code in `.claude/skills/` at the repo root. Also useful to an agent: the doc index
> [`llms.txt`](https://docs.fish.audio/llms.txt) and full dump
> [`llms-full.txt`](https://docs.fish.audio/llms-full.txt), and the MCP server
> `https://api.fish.audio/mcp` (gives tools — search voices, generate speech, transcribe — instead
> of docs). Full list: [docs/fish-audio-links.md](fish-audio-links.md).

## Decision tree

```
Does your game need a back-and-forth spoken CONVERSATION (the player talks, an NPC replies)?
│
├─ No — I just need lines spoken out loud (narrator, barks, cutscenes, pre-written dialogue)
│  │
│  ├─ Lines are known ahead of time / generated in one shot
│  │     → JUST SPEECH: examples/01-tts-basics, examples/03-npc-voice-factory
│  │
│  └─ Lines come from an LLM and should start playing before the LLM finishes
│        → STREAMING SPEECH: examples/02-streaming-tts
│
└─ Yes — the player speaks (or types) and an NPC/agent replies, turn after turn
   │
   ├─ I don't want to run any server; Fish can own STT + LLM + TTS + turn-taking
   │     → A. HOSTED FISH AGENT: examples/04-agent-web
   │
   ├─ I want Fish to handle voice, but MY server decides what the NPC says
   │  (custom memory, game-state logic, your own LLM/fine-tune)
   │     → B. HOSTED AGENT + CUSTOM LLM: examples/05-agent-custom-llm
   │
   └─ I want to own every piece (VAD, STT, LLM, TTS) — maximum control, maximum work
         → C. OWN PIPELINE: examples/06-own-pipeline
```

## Comparison

| | Just speech | Streaming speech | A. Hosted agent | B. Agent + custom LLM | C. Own pipeline |
|---|---|---|---|---|---|
| Control | Text + voice only | Text + voice, timing | Prompt, tools, voice | + full reply logic | Everything |
| Latency | N/A (not a turn) | Good (speaks as text arrives) | Good, Fish-tuned | Good if your LLM is fast | Depends entirely on you |
| Setup effort | Lowest | Low | Low (console + API) | Medium (public HTTPS server) | Highest |
| Hosting needs | None | None | None | A always-on HTTPS endpoint | Mic capture, VAD, STT, LLM, TTS glue |
| Cost drivers | TTS bytes | TTS bytes | Fish agent session + TTS/STT under the hood | Same, + your LLM compute | TTS bytes + STT hours + your LLM |
| What you can't do | No conversation, no listening | No listening (one-way) | Can't swap Fish's STT/LLM/turn-taking logic | Can't swap STT or turn-taking | Nothing — but you own every bug |

## Typical game ideas per path

- **Just speech** — narrator lines, ambient NPC barks, cutscene dialogue, item flavor text read
  aloud, a quest-giver with a fixed script.
- **Streaming speech** — a narrator whose commentary is generated live by an LLM reacting to game
  events (a roguelike run, a sports-style play-by-play).
- **A. Hosted Fish agent** — NPC interrogation scene, a tavern-keeper you can actually chat with, a
  tutorial companion that answers free-form questions about the game.
- **B. Hosted agent + custom LLM** — a companion that remembers your relationship across play
  sessions, a game master whose replies depend on persistent world state your server tracks.
- **C. Own pipeline** — voice-commanded strategy game ("units, advance!"), a live narrator reacting
  to telemetry from the game engine in ways no hosted agent API exposes, multi-NPC scenes with
  custom turn-taking rules (e.g. only the NPC facing the player may respond).

## Hybrids

Paths combine inside one game:

- **Agent for conversation + plain TTS for narration.** Use a hosted Fish agent (A or B) for NPCs
  the player talks to, and plain `POST /v1/tts` (just speech) for a narrator or cutscenes that
  never listen.
- **Own pipeline for voice commands + hosted agent for a companion.** Route short commands
  ("attack", "retreat") through your own lightweight VAD + ASR, while a chatty companion NPC runs
  on a hosted agent.
- **Streaming TTS for the first line, agent for the rest.** Play a pre-generated greeting instantly
  while a hosted agent session connects in the background.

Mixing adds moving parts — a game with one agent and one `s2.1-pro` TTS call is far easier to debug
than one with three different code paths producing speech. Default to the single simplest path;
reach for a hybrid only when a path's "what you can't do" column above is actually blocking your
game idea.

## Fish Audio docs

- Agents overview: https://docs.fish.audio/agents/overview.md
- Deployment overview (pick a channel): https://docs.fish.audio/agents/deploy/overview.md
- Custom LLM: https://docs.fish.audio/agents/build/custom-llm.md
- Real-time voice streaming: https://docs.fish.audio/developer-guide/best-practices/real-time-streaming.md
- Text to Speech guide: https://docs.fish.audio/developer-guide/core-features/text-to-speech.md
- Pricing & rate limits: https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits.md
