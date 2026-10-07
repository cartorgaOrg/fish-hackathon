import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';

// Every folder in games/ with an index.html becomes its own page: /games/<name>/
const games = Object.fromEntries(
  readdirSync('games', { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`games/${d.name}/index.html`))
    .map((d) => [d.name, resolve(`games/${d.name}/index.html`)]),
);

export default defineConfig(({ mode }) => ({
  base: './', // relative URLs so the build works from any folder (itch.io, GitHub Pages…)
  // `npm run build:cdn` loads models from the CDN (VITE_ASSET_BASE in .env.cdn), so don't copy public/assets
  publicDir: mode === 'cdn' ? false : 'public',
  resolve: { alias: { '@engine': resolve('engine/index.js') } },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  server: { open: false, host: true },
  build: {
    target: 'es2022', // allows top-level await, which the games use for loading
    rollupOptions: { input: { main: resolve('index.html'), assets: resolve('assets.html'), ...games } },
    chunkSizeWarningLimit: 2000,
  },
}));
