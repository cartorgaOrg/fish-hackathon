// Game-side logic (JS port of ../game.py). See that file for the full comments.

export const NPC_PROMPT =
  "You are Brom, a grumpy bridge guard in a fantasy village. Answer in one or two short " +
  "sentences. You may use at most one [bracketed emotion tag] per sentence.";

// GAME HOOK: your real game state goes here.
export const GAME_STATE = { location: "bridge", playerHasSword: false };

const MOCKUP_REPLY = "[sighs] Halt, traveller. The bridge is closed tonight.";

// MOCKUP: fakes an LLM emitting tokens one word at a time. Replace with a real streaming
// chat completion (e.g. the `openai` npm package pointed at LLM_BASE_URL) when you're ready.
async function* mockupStream() {
  for (const word of MOCKUP_REPLY.split(" ")) {
    console.log(`[MOCKUP] token: ${JSON.stringify(word)}`);
    yield word + " ";
    await new Promise((r) => setTimeout(r, 100));
  }
}

// GAME HOOK: choose a voice per NPC here before calling the TTS layer.
export function streamNpcReply(playerText, state) {
  // No LLM_API_KEY branch wired up in this tiny JS port -- see game.py for the real one.
  return mockupStream();
}
