// Audio plumbing only: start/stop the call, render transcript and tool-call
// events, wire the event buttons to game.ts. No game logic here.
// Web SDK docs: https://docs.fish.audio/agents/deploy/web-sdk.md
import { AgentSession } from "@fishaudio/agent-client";
import { gameState, dynamicVariables, makeClientTools, gameEvents } from "./game";

const startBtn = document.getElementById("start") as HTMLButtonElement;
const stopBtn = document.getElementById("stop") as HTMLButtonElement;
const micStatus = document.getElementById("mic-status")!;
const stateEl = document.getElementById("state")!;
const transcriptEl = document.getElementById("transcript")!;
const toolsEl = document.getElementById("tools")!;
const eventsEl = document.getElementById("events")!;

let session: AgentSession | undefined;

const logTranscript = (line: string) => (transcriptEl.textContent += line + "\n");
const logTool = (line: string) => (toolsEl.textContent += line + "\n");
const renderState = () => (stateEl.textContent = JSON.stringify(gameState, null, 2));

renderState();

for (const event of gameEvents) {
  const btn = document.createElement("button");
  btn.textContent = event.label;
  btn.onclick = () => {
    if (!session) return;
    // Silent context injection: no `audio: true`, so this turn is not
    // spoken. The agent still "hears" it and can react on the next reply.
    // https://docs.fish.audio/agents/deploy/protocol.md
    session.sendUserMessage(event.text);
    logTranscript(`[event] ${event.text}`);
  };
  eventsEl.appendChild(btn);
}

startBtn.onclick = async () => {
  startBtn.disabled = true;
  micStatus.textContent = "connecting...";

  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dynamicVariables: dynamicVariables() }),
  });
  if (!res.ok) {
    micStatus.textContent = `error: ${(await res.json()).error ?? res.status}`;
    startBtn.disabled = false;
    return;
  }
  const sessionToken = await res.json();

  try {
    session = await AgentSession.start({
      sessionToken,
      clientTools: makeClientTools(renderState),
      callbacks: {
        onUserTranscript: ({ text, final }) => final && logTranscript(`You: ${text}`),
        onAgentResponse: ({ text }) => logTranscript(`Agent: ${text}`),
        onModeChange: (mode) => (micStatus.textContent = mode),
        onToolCallStarted: ({ toolName, input }) => logTool(`-> ${toolName} ${input}`),
        onToolCallCompleted: ({ toolName, output }) => logTool(`<- ${toolName} ${output}`),
        onToolCallFailed: ({ toolName, error }) => logTool(`x  ${toolName} ${error}`),
        onError: (err) => logTranscript(`[error] ${err.code}`),
        onDisconnect: ({ reason }) => {
          micStatus.textContent = `ended (${reason})`;
          startBtn.disabled = false;
          stopBtn.disabled = true;
        },
      },
    });
  } catch (err) {
    micStatus.textContent = `error: ${(err as Error).message ?? err}`;
    logTranscript(`[error] failed to start session: ${err}`);
    startBtn.disabled = false;
    return;
  }

  stopBtn.disabled = false;
};

stopBtn.onclick = () => session?.end();
