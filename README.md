# BLIP

**You are the thing on the radar.**
*A pixel signal adventure about staying unknown.*

BLIP is a top-down pixel-art action game. You are **CONTACT-47** — the forty-seventh logged contact event over Miller Field, a radar blip that woke up with a body. Fight through dreamlike Chagrin Falls-inspired roads, lots, town streets, trails, and signal barriers before **The Interpretation Engine** finishes deciding what you are.

Five kids figured all of this out years before you did. They left you a trail.

![status](https://img.shields.io/badge/campaign-5%20zones%20playable-35ffd5) ![ending](https://img.shields.io/badge/ending-Refuse%20the%20Label-2e7d4f)

## Quick Start

```bash
npm install
npm run dev        # → http://localhost:5173
```

## Controls

Full controller support (Xbox / PlayStation, standard mapping) including menu navigation. A live controls reference lives in **Settings** and the Command Center.

| Action | Keyboard / Mouse | Xbox · PlayStation |
|---|---|---|
| Move | A / D or ← / → | Left stick · D-pad |
| Move Up / Down | W / S or ↑ / ↓ | Left stick · D-pad |
| Dash (Phase Drift) | SHIFT | RB / LT · R1 / L2 |
| Pulse Shot | X or Left Click | X / RT · ▢ / R2 |
| Scan Pulse | Q | Y / LB · △ / L1 |
| Interact / Enter Node | E | B · ○ |
| Pause | ESC | START · OPTIONS |
| Command Center | C or TAB | BACK · SHARE |
| Menus | ↑ ↓ + ENTER | D-pad / stick + A |
| Debug overlay / tools | F1–F5 | — |
| Debug: cycle Signal Skin | F6 | — |

## The Current Top-Down Route

BLIP is being pivoted into one connected top-down game. The current playable route preserves the existing top-down areas and links them together:

1. **Miller Surface** (`surface-z1`) — rural Area 47 combat/traversal
2. **Motel Circuit** (`circuit-z2`) — tight neon corridors and powered routes
3. **Chagrin Falls Town** (`town-z3`) — streets, alleys, bridge lanes, and stadium-edge cover
4. **Patterson's Orchard Maze** (`maze-z4`) — living corn-maze combat route
5. **Signal Storm** (`anomaly-01`) — wave-based combat holdout

Progress autosaves to localStorage. The **Command Center** (C) holds the story bible, the Five Signal Scouts, progression, world-area maps, debug/save data, and the AI QA lab.

### Ending / Finale

The previous side-scrolling campaign has been removed from live access. Story, bosses, scouts, rewards, and Signal Fragment structure are being ported onto the top-down foundation after the connected route is stable.

## Tech

- **Vite 5 + TypeScript + Phaser 3** (Arcade physics), 480×270 virtual pixel canvas, crisp upscale
- **Top-down rendering**: the world is pixelated canvas with selected higher-detail top-down arenas; the console UI (menu, objective, status strip, pause, settings, Command Center) is crisp native-resolution HTML in the warm-midnight palette (cream / lime / amber / crimson)
- **100% procedural art** — every texture is generated at boot (no image assets); the BLIP logo is an inline pixel-grid SVG
- **WebAudio-synthesized SFX** — no audio assets; volume/mute in Settings
- **Gamepad**: Web Gamepad API via Phaser + a shell navigator (menus), with a simulation hook so the QA suite verifies the whole mapping layer
- localStorage saves (`blip_save_v1`, with legacy-key migration)
- Static build, Vercel-ready — see [DEPLOYMENT.md](DEPLOYMENT.md)

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build → `dist/` |
| `npm run preview` | serve the production build |
| `npm run typecheck` | strict TypeScript check |
| `npm run test:e2e` | Playwright suite vs the production build |
| `npm run qa:playtest` | fun-loop storyboard playtest → `qa-reports/` |
| `npm run qa:full` | typecheck + build + e2e |
| `npm run qa:loop` | bounded AI QA loop → `test-results/qa-reports/latest.md` |

## Signal Skins

Gather a scout's 3-piece **Signal Set** (badge · log · relic) in their home zone to **wear their frequency** — CONTACT-47 recolors into that kid and gains their signature ability. Completing a set triggers a **Scout Echo** (the kid, as a character) who hands you the signal. UNKNOWN / CONTACT-47 is the no-tradeoff baseline; each skin is a sidegrade (one strength, one honest tradeoff):

- **WILLOW** (Will, Recon) — wider scan + Recon Ping (outlines enemy cones)
- **SPARK** (Chip, Engineer) — endless hover + Surge Shot (every 3rd pulse trips switches)
- **ANCHOR** (Henry, Guardian) — +1 hull, reads slower, drops safe zones
- **ECHO** (Cameron, Trickster) — bouncing shots, Blipstream master
- **ROCKET** (Danny, Speed) — air-dash, Phase-Strike, glass cannon

Manage them in **Command Center ▸ Wardrobe**. All five scouts have their Signal Sets placed across the five zones (Will in Miller Field, Chip in Motel Nowhere, Henry at the stadium, Cameron in the orchard, Danny on the Skyline Array). Debug: **F6** unlocks + cycles skins.

## Developer Dashboard

The **Command Center** doubles as the dev/design dashboard — in-game via `C`, or standalone (no game, no Phaser) at **`/command-center.html`**. Beyond story/progression it includes:

- **World Areas** — live maps for the connected top-down arenas.
- **Wardrobe** — every Signal Skin with passive/signature/tradeoff, lock state, and live equip.
- **Level Atlas** — the real collision/entity grids from `src/game/data/levels.ts` painted as maps.
- **Bestiary / Arsenal** — every enemy + the CONTACT-47 kit with live tuning numbers from `config.ts`.
- Plus live save/quest state, zones, build TODO, and AI QA status — all reading the same data the game runs on, so it cannot go stale.

## AI QA Pipeline

This project is an experiment in AI-driven development: the game is built, played, screenshotted, debugged and re-verified by automation before a human tests it. Playwright drives a real browser through the full quest loop using real keyboard input plus a `?test=1` Test API (`window.__BLIP_TEST_API__`). Reports land in `test-results/qa-reports/` and surface in the Command Center's **AI QA / Playtest Lab** panel. Human handoff: [PLAYTEST.md](PLAYTEST.md).

## Project Guardrails

Development rules live in `.claude/skills/` (game vision, engine rules, art direction, puzzle rules, QA checklist, scope control) and are indexed from [CLAUDE.md](CLAUDE.md).

<!-- vercel-github-linked: 2026-07-12 -->
