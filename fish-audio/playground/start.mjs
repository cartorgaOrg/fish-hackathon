// Starts both voice options and the playground page with one command:
//   node playground/start.mjs        (from fish-audio/) then open http://localhost:3000
// Needs Node 20+ and uv, plus a filled-in fish-audio/.env (see fish-audio/.env.example).
// The agent page runs on :5174 so it does not collide with the game kit (:5173).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const agentDir = resolve(root, "examples/04-agent-web");
const PORT = 3000;

if (!existsSync(resolve(root, ".env"))) console.warn("[playground] no fish-audio/.env yet; copy fish-audio/.env.example to fish-audio/.env first");
if (!existsSync(resolve(agentDir, "node_modules"))) {
  console.log("[playground] installing the hosted-agent example's npm packages ...");
  spawnSync("npm install", { cwd: agentDir, shell: true, stdio: "inherit" });
}

const services = [
  ["agent-token", "npm run server", agentDir],
  ["agent-ui", "npm run dev -- --port 5174 --strictPort", agentDir],
  ["pipeline", "uv run uvicorn server:app --port 8001", resolve(root, "examples/06-own-pipeline")],
];

let stopping = false; // set during Ctrl+C so planned exits aren't reported as failures
const children = services.map(([name, cmd, cwd]) => {
  // PORT=8787 pins the token server (a PORT inherited from a launcher would move it).
  const child = spawn(cmd, { cwd, shell: true, env: { ...process.env, PORT: "8787" } });
  const log = (data) => data.toString().trimEnd().split("\n").forEach((l) => console.log(`[${name}] ${l}`));
  child.stdout.on("data", log);
  child.stderr.on("data", log);
  // A service that dies early (usually a port already in use) would leave its tab showing the wrong page.
  child.on("exit", (code) => {
    if (!stopping) console.error(`\n[playground] ${name} stopped (exit code ${code}). Read its lines above: if a port is in use, free ports 5174, 8787 and 8001, then restart.\n`);
  });
  return child;
});

createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(readFileSync(resolve(root, "playground/index.html")));
}).listen(PORT, () => console.log(`\n[playground] open http://localhost:${PORT}\n`));

// Ctrl+C stops everything. On Windows a shell child doesn't take its own children with it, so kill the tree.
function shutdown() {
  stopping = true;
  for (const c of children) {
    if (process.platform === "win32") spawnSync(`taskkill /pid ${c.pid} /T /F`, { shell: true, stdio: "ignore" });
    else c.kill();
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
