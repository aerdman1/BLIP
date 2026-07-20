import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// A single build stamp shared by the SW cache name and the client registration.
// Each build gets a fresh value, so every deploy invalidates old PWA caches.
const SW_VERSION = new Date().toISOString().replace(/[:.]/g, '-');

function gitValue(args: string[], fallback: string): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const BUILD_INFO = {
  app: 'BLIP',
  commit:
    process.env.VERCEL_GIT_COMMIT_SHA ||
    gitValue(['rev-parse', 'HEAD'], 'unknown'),
  branch:
    process.env.VERCEL_GIT_COMMIT_REF ||
    gitValue(['branch', '--show-current'], 'unknown'),
  message:
    process.env.VERCEL_GIT_COMMIT_MESSAGE ||
    gitValue(['log', '-1', '--pretty=%s'], 'unknown'),
  builtAt: new Date().toISOString(),
};

// Rewrites the __SW_VERSION__ token inside the emitted public/sw.js so the
// service worker's CACHE_NAME is unique per build (public/ files aren't touched
// by Vite's `define`, hence this small post-build stamp).
function stampDeployArtifacts(): Plugin {
  return {
    name: 'blip-stamp-deploy-artifacts',
    apply: 'build',
    transformIndexHtml() {
      return [
        { tag: 'meta', attrs: { name: 'blip-deploy-commit', content: BUILD_INFO.commit }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'blip-deploy-branch', content: BUILD_INFO.branch }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'blip-deploy-built-at', content: BUILD_INFO.builtAt }, injectTo: 'head' },
      ];
    },
    closeBundle() {
      const swPath = resolve(__dirname, 'dist', 'sw.js');
      try {
        const src = readFileSync(swPath, 'utf8');
        writeFileSync(swPath, src.replace(/__SW_VERSION__/g, SW_VERSION));
      } catch {
        /* sw.js may be absent in unusual build configs — don't fail the build. */
      }

      writeFileSync(
        resolve(__dirname, 'dist', 'deploy-version.json'),
        `${JSON.stringify(
          {
            ...BUILD_INFO,
            shortCommit: BUILD_INFO.commit.slice(0, 7),
          },
          null,
          2,
        )}\n`,
      );
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
  plugins: [stampDeployArtifacts()],
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
