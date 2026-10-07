// Node-only (fish-audio's realtime WebSocket client uses Node's `ws`). Mirrors stream_tts.py.
// Docs: https://docs.fish.audio/developer-guide/sdk-guide/javascript/websocket.md
//
// Run: node stream-tts.mjs "Let me cross the bridge"

import dotenv from "dotenv";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { FishAudioClient, RealtimeEvents } from "fish-audio";
import { GAME_STATE, streamNpcReply } from "./game.mjs";

// Load .env from this folder or the nearest parent (fish-audio/ keeps one shared .env).
for (let dir = process.cwd(); ; dir = dirname(dir)) {
  if (existsSync(resolve(dir, ".env"))) { dotenv.config({ path: resolve(dir, ".env"), quiet: true }); break; }
  if (dirname(dir) === dir) break;
}

if (!process.env.FISH_API_KEY) {
  console.error("Missing FISH_API_KEY. Copy fish-audio/.env.example to fish-audio/.env and add your key.");
  process.exit(1);
}

const client = new FishAudioClient({ apiKey: process.env.FISH_API_KEY });
const playerText = process.argv[2] ?? "Let me cross the bridge.";

const request = {
  text: "", // real text streams in below, piece by piece
  reference_id: process.env.FISH_VOICE_ID || undefined,
  format: "mp3",
  latency: "balanced",
};
// backend/model: SDK types only know a few model ids; "s2.1-pro" still works over the wire
// (see AGENTS.md's typing caveat). Cast with `as any`-equivalent if you add TypeScript here.
const backend = process.env.FISH_TTS_MODEL || "s2.1-pro";

const chunks = [];
const t0 = performance.now();
let firstChunkAt = null;

const connection = await client.textToSpeech.convertRealtime(
  request,
  streamNpcReply(playerText, GAME_STATE),
  backend
);

connection.on(RealtimeEvents.AUDIO_CHUNK, (audio) => {
  if (firstChunkAt === null) {
    firstChunkAt = performance.now();
    console.log(`[tts] first audio chunk after ${((firstChunkAt - t0) / 1000).toFixed(3)}s`);
  }
  chunks.push(audio);
});

connection.on(RealtimeEvents.ERROR, (err) => {
  console.error("[tts] error:", err);
  process.exit(1);
});

connection.on(RealtimeEvents.CLOSE, () => {
  console.log(`[tts] done, total ${((performance.now() - t0) / 1000).toFixed(3)}s`);
  mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
  writeFileSync(new URL("./out/stream.mp3", import.meta.url), Buffer.concat(chunks));
  console.log("[tts] saved to out/stream.mp3");
});
