import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// BLIP is a fully static web game — no server runtime, Vercel-ready.
// Two entries: the game, and the standalone developer Command Center.
export default defineConfig({
  base: '/',
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
