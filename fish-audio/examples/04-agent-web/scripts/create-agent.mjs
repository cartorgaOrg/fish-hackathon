#!/usr/bin/env node
// Creates a demo NPC agent over the Agents REST API: two client tools, a
// one-sentence prompt with dynamic variables, and a first message. Publishes
// it and prints the agent id for FISH_AGENT_ID.
//
// Docs: https://docs.fish.audio/agents/quickstart.md
//       https://docs.fish.audio/agents/build/tools.md
//       https://docs.fish.audio/agents/build/client-tools.md
//       https://docs.fish.audio/agents/build/dynamic-variables.md
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
for (const dir of [here, resolve(here, ".."), resolve(here, "../.."), resolve(here, "../../..")]) {
  const envPath = resolve(dir, ".env");
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const FISH_API_KEY = process.env.FISH_API_KEY;
if (!FISH_API_KEY) {
  console.error("FISH_API_KEY is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const BASE = "https://api.fish.audio";
const headers = { Authorization: `Bearer ${FISH_API_KEY}`, "Content-Type": "application/json" };

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function patch(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: "PATCH", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// Two client tools: executed in the browser by src/game.ts, not on Fish's servers.
// https://docs.fish.audio/agents/build/client-tools.md
const openGate = await post("/v1/agent/tools", {
  tool_type: "client",
  name: "open_gate",
  description: "Open the village gate so the player can pass through.",
  arguments: [],
  expects_response: true,
});
console.log(`[create-agent] created tool open_gate (${openGate.tool_id})`);

const giveItem = await post("/v1/agent/tools", {
  tool_type: "client",
  name: "give_item",
  description: "Give an item from the NPC's inventory to the player.",
  arguments: [{ name: "item_name", description: "The item to hand over, e.g. 'rusty key'." }],
  expects_response: true,
});
console.log(`[create-agent] created tool give_item (${giveItem.tool_id})`);

// Agent: one-sentence prompt, dynamic variables filled in by src/game.ts per
// session. https://docs.fish.audio/agents/build/dynamic-variables.md
const agent = await post("/v1/agent/agents", { name: "Fish Game Audio Starter: NPC demo" });
console.log(`[create-agent] created agent ${agent.agent_id}`);

await patch(`/v1/agent/agents/${agent.agent_id}/config`, {
  prompt: {
    system_prompt:
      "You are {{npc_name}}, a {{npc_role}} in a fantasy village. The player's reputation is {{player_reputation}}. Reply in 1-2 short sentences.",
    first_message_mode: "fixed",
    first_message: "Well now, look who's come knocking.",
  },
  tools: { tool_ids: [openGate.tool_id, giveItem.tool_id] },
});
console.log("[create-agent] configured prompt and attached tools");

await post(`/v1/agent/agents/${agent.agent_id}/publish`, {});
console.log("[create-agent] published");

console.log(`\nSet this in your .env:\nFISH_AGENT_ID=${agent.agent_id}\n`);
