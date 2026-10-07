import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync, existsSync, rmSync } from 'node:fs';

// Every folder in games/ with an index.html becomes its own page: /games/<name>/
const games = Object.fromEntries(
  readdirSync('games', { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`games/${d.name}/index.html`))
    .map((d) => [d.name, resolve(`games/${d.name}/index.html`)]),
);

// CDN builds (`--mode cdn`, see .env.cdn) load the shared packs from cdn.manogames.com, so drop
// the copied packs from dist/ after building. Your own files in public/ (sounds, models…) stay.
function dropSharedPacks() {
  let outDir;
  return {
    name: 'drop-shared-asset-packs',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    closeBundle() {
      for (const entry of readdirSync('public/assets')) rmSync(resolve(outDir, 'assets', entry), { recursive: true, force: true });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './', // relative URLs so the build works from any folder (itch.io, GitHub Pages…)
  plugins: mode === 'cdn' ? [dropSharedPacks()] : [],
  resolve: { alias: { '@engine': resolve('engine/index.js') } },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  server: { open: false, host: true },
  build: {
    target: 'es2022', // allows top-level await, which the games use for loading
    rollupOptions: { input: { main: resolve('index.html'), assets: resolve('assets.html'), ...games } },
    chunkSizeWarningLimit: 2000,
  },
}));
