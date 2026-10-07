import { defineConfig } from "vite";

// The browser never talks to Fish Audio directly for session creation: Vite
// proxies /api to the tiny token server in server/server.mjs (see README).
export default defineConfig({
  server: {
    proxy: { "/api": "http://localhost:8787" },
  },
});
