// MOCKUP GAME: a stand-in so this example runs end to end. It is NOT where your real game has to live.
// Keep the audio code, connect your real game (engine, frontend, backend, ...) to the GAME HOOK touch
// points below, then delete the mock content.
//
// The mock game for this example. src/main.ts only wires it up to the
// Fish Agent session and the DOM. See CONVENTIONS.md.
//
// This example shows surface **A**: a hosted Fish agent as the "game brain".
// Your game steers the conversation two ways, both demonstrated below:
//   1. Dynamic variables: facts baked into the agent's prompt at session start.
//      https://docs.fish.audio/agents/build/dynamic-variables.md
//   2. Silent context injection: `session.sendUserMessage(text)` without
//      `{audio: true}` tells the agent "the user said this" so it can react
//      and remember it, without synthesizing speech for that turn.
//      https://docs.fish.audio/agents/deploy/protocol.md#client-events-client-event

// MOCKUP: a real game would have a much richer state object (or read it from
// your actual game engine). This one is just enough to show the wiring.
// GAME HOOK: replace with your real game state.
export const gameState = {
  npcName: "Brom",
  npcRole: "grumpy bridge guard",
  playerReputation: "unknown",
  gateOpen: false,
  inventory: [] as string[],
};

// GAME HOOK: derive the agent's dynamic variables from your game state.
// These fill the `{{npc_name}}`, `{{npc_role}}`, `{{player_reputation}}`
// placeholders in the system prompt created by scripts/create-agent.mjs.
export function dynamicVariables(): Record<string, string> {
  return {
    npc_name: gameState.npcName,
    npc_role: gameState.npcRole,
    player_reputation: gameState.playerReputation,
  };
}

// Client tools: the agent calls these BY NAME mid-conversation; the SDK
// dispatches to the matching handler here, in the browser, and sends our
// return value back to the agent. Declared on the agent by create-agent.mjs.
// https://docs.fish.audio/agents/build/client-tools.md
export function makeClientTools(onChange: () => void) {
  return {
    // GAME HOOK: open_gate would unlock a door, advance a quest flag, etc.
    open_gate: async () => {
      gameState.gateOpen = true;
      onChange();
      return { opened: true };
    },
    // GAME HOOK: give_item would add to a real inventory system.
    give_item: async (params: Record<string, unknown>) => {
      const itemName = String(params.item_name ?? "mystery item");
      gameState.inventory.push(itemName);
      onChange();
      return { given: itemName };
    },
  };
}

// Buttons in the UI that inject a silent game event into the conversation.
// GAME HOOK: wire these to real triggers in your game (combat, cutscenes,
// time of day, ...) instead of a button click.
export const gameEvents: { label: string; text: string }[] = [
  { label: "Player draws sword", text: "[GAME EVENT] The player draws their sword." },
  { label: "Night falls", text: "[GAME EVENT] Night falls over the village." },
];
