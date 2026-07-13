import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// A single build stamp shared by the SW cache name and the client registration.
// Each build gets a fresh value, so every deploy invalidates old PWA caches.
const SW_VERSION = new Date().toISOString().replace(/[:.]/g, '-');

// Rewrites the __SW_VERSION__ token inside the emitted public/sw.js so the
// service worker's CACHE_NAME is unique per build (public/ files aren't touched
// by Vite's `define`, hence this small post-build stamp).
function stampServiceWorker(): Plugin {
  return {
    name: 'blip-stamp-sw',
    apply: 'build',
    closeBundle() {
      const swPath = resolve(__dirname, 'dist', 'sw.js');
      try {
        const src = readFileSync(swPath, 'utf8');
        writeFileSync(swPath, src.replace(/__SW_VERSION__/g, SW_VERSION));
      } catch {
        /* sw.js may be absent in unusual build configs — don't fail the build. */
      }
    },
  };
}

// BLIP is a fully static web game — no server runtime, Vercel-ready.
// Two entries: the game, and the standalone developer Command Center.
export default defineConfig({
  base: '/',
  define: {
    __SW_VERSION__: JSON.stringify(SW_VERSION),
  },
  plugins: [stampServiceWorker()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1600, // phaser is a single large vendor chunk
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        commandCenter: resolve(__dirname, 'command-center.html'),
      },
    },
  },
});
