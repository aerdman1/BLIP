# BLIP

**You are the thing on the radar.**
*A top-down sci-fi action adventure about staying unknown.*

BLIP is a top-down pixel-art sci-fi action game. You are **CONTACT-47** — the forty-seventh logged contact event over Miller Field, a radar blip that woke up with a body. Fight through dreamlike Chagrin Falls-inspired roads, lots, town streets, trails, and signal barriers before **The Interpretation Engine** finishes deciding what you are.

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
| Phase Boost | hold SHIFT | hold RB / LB · R1 / L1 |
| Fire | X or Left Click | X / RT · ▢ / R2 |
| Switch Weapon | 1 / 2 / 3 · mouse wheel · R | L-stick / R-stick click |
| Scan Pulse | Q / Right Click | Y / LT · △ / L2 |
| Interact / Enter Node | E | B · ○ |
| Pause | ESC | START · OPTIONS |
| Command Center | C or TAB | BACK · SHARE |
| Menus | ↑ ↓ + ENTER | D-pad / stick + A |
| Debug overlay / tools | F1–F3 | — |

## Current Route

BLIP currently plays as one route-connected top-down arena chain. It is not one seamless open map yet; each area is a separate top-down arena with fast breach handoffs and shared save/runtime state.

1. **Miller Surface** (`surface-z1`) — recover Willow's cache and choose the first weapon mutation
2. **Motel Circuit** (`circuit-z2`) — phase through scanners and earn Phase Boost+
3. **Chagrin Falls Town** (`town-z3`) — hold River Road with Scout Relay Pylon tech
4. **Patterson's Orchard Maze** (`maze-z4`) — use the Gravity Well and find the Scan Memory shelter secret
5. **Signal Storm** (`anomaly-01`) — break the Classifier Core, stabilize both Relay Wings, and refuse the label

Progress autosaves to localStorage. The **Command Center** (C) holds the story bible, the Five Signal Scouts, progression, route-area maps, debug/save data, and the AI QA lab.

### Ending / Finale

The finale path is the Signal Storm route. Story, bosses, Scouts, rewards, and Signal Fragment structure all build on the connected top-down foundation. Miller now opens with a short crash-site recovery beat where CONTACT-47 wakes up, follows Scout/kid evidence, restores movement power through a Spark Line, recovers the first kit, and then the field wakes into combat.

## Tech

- **Vite 5 + TypeScript + Phaser 3** (Arcade physics), 480×270 virtual pixel canvas, crisp upscale
- **Top-down rendering**: the world is pixelated canvas with selected higher-detail top-down arenas; the console UI (menu, objective, status strip, pause, settings, Command Center) is crisp native-resolution HTML in the warm-midnight palette (cream / lime / amber / crimson)
- **Hybrid procedural/authored art** — most world textures are generated at boot, while CONTACT-47 now uses the imported Tripo-derived transparent PNG facing set with the older procedural sprite kept as fallback
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

## Scout Signal Sets

Scout badges, logs, relics, and caches remain part of BLIP's mystery and progression loop. The old Wardrobe / Signal Skin system has been cut from active gameplay because the Tripo CONTACT-47 model is now the canonical player presentation and invisible stat sidegrades were confusing.

Future Scout rewards should become clear abilities, upgrades, route tools, lore, or major loot, not selectable body recolors.

## Developer Dashboard

The **Command Center** doubles as the dev/design dashboard — in-game via `C`, or standalone (no game, no Phaser) at **`/command-center.html`**. Beyond story/progression it includes:

- **Route Areas** — live maps for the route-connected top-down arenas.
- **Bestiary / Arsenal** — every enemy, the CONTACT-47 kit, and the live three-weapon foundation from game data.
- Plus live save/quest state, route-area maps, vertical-slice system status, region-purpose planning, the reconciled master backlog summary, build TODO, and the AI QA checklist — all reading the same data the game runs on.

Authoritative planning source: [`MASTER_GAME_BACKLOG.md`](MASTER_GAME_BACKLOG.md). Use it before old prompts or stale summaries.

## AI QA Pipeline

This project is an experiment in AI-driven development: the game is built, played, debugged and re-verified by automation before a human tests it. Playwright drives a real browser through the top-down smoke route using `?test=1` Test API (`window.__BLIP_TEST_API__`). Use `npm run qa:full` for the current gate.

Current testing distinction: `typecheck`, `build`, and `test:e2e` are hard pass/fail checks. `npm run ai:campaign` produces imperfect persona playtest evidence and friction signals; longer overnight campaigns are deferred until the next AI testing pass.

## Project Guardrails

Development rules live in `.claude/skills/` (game vision, engine rules, art direction, QA checklist, progression, scope control) and are indexed from [CLAUDE.md](CLAUDE.md).

<!-- vercel-github-linked: 2026-07-12 -->
