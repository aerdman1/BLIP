# BLIP Deployment

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Production Build

```bash
npm run build
npm run preview
```

The build outputs a fully static site to `dist/`. Preview serves it at http://localhost:4173

## Vercel

Import the repo into Vercel as a Vite/static frontend project.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install`
- **Framework preset:** Vite

No server runtime is required — BLIP is a fully static, client-side game (a 5-zone
campaign ending in the Skyline Array finale + EndingScene).
Save data is stored locally in the browser via localStorage (`blip_save_v1`).

The build has two static entries: the game (`/`) and the standalone developer
dashboard (`/command-center.html`) — both ship in `dist/` automatically.

Notes:

- All assets are procedurally generated in the browser at boot — there are no
  image/audio files to host beyond `public/` (manifest, icon, qa-status.json).
- No environment variables, no APIs, no hardcoded localhost URLs.
- The Playwright/QA tooling is dev-only and does not ship in `dist`.
- The Test API (`window.__BLIP_TEST_API__`) is enabled only in dev or with
  `?test=1` — the deployed game stays clean by default.

## Verifying a Deploy

1. Game boots to the BLIP menu, starts, and plays through Miller Field (the first of five zones).
2. Save persists across a reload (localStorage).
3. Command Center opens (C) and renders all panels, including AI QA Lab
   (it reads `/qa-status.json` — committed from the last QA run).
