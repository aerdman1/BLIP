# BLIP

**You are the thing on the radar.**
*A pixel signal adventure about staying unknown.*

BLIP is a side-scrolling pixel-art action-puzzle platformer. You are **CONTACT-47** — the forty-seventh logged contact event over Miller Field, a radar blip that woke up with a body. Platform through dreamlike rural dusk, scan for what the world refuses to map, dive into the **Blipstream**, and collect **Signal Fragments** before **The Interpretation Engine** finishes deciding what you are.

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
| Jump / Hover | SPACE (hold to hover) | A · ✕ (hold) |
| Dash (Phase Drift) | SHIFT | RB / LT · R1 / L2 |
| Pulse Shot | X or Left Click | X / RT · ▢ / R2 |
| Scan Pulse | Q | Y / LB · △ / L1 |
| Interact / Enter Node | E | B · ○ |
| Pause | ESC | START · OPTIONS |
| Command Center | C or TAB | BACK · SHARE |
| Menus | ↑ ↓ + ENTER | D-pad / stick + A |
| Debug overlay / tools | F1–F5 | — |
| Debug: cycle Signal Skin | F6 | — |

## The Campaign (5 playable zones)

BLIP is a **5-zone campaign** with a real ending. Each zone is a side-view spine plus one perspective shift routed through the shared **Fold** engine, and each ends with a boss, a Signal Fragment, and one of the Five Signal Scouts:

1. **Miller Field** (Will / WILLOW) — scan-reveal + Blipstream Node A · boss **The Scarecrow Antenna**
2. **Motel Nowhere** (Chip / SPARK) — neon-power routing + top-down circuit run · boss **The Vacancy Sign**
3. **Chagrin Falls High / Tiger Stadium** (Henry / ANCHOR) — Friday-night-lights stealth + an underwater Pool Mirror sub-level · boss **The Weather Balloon**
4. **Patterson's Orchard** (Cameron / ECHO) — the maze that thinks + a top-down crop-draw Fold · boss **The Harvest Pattern**
5. **Skyline Array** (Danny / ROCKET) — storm-surfing speedrun + first-person sky-tuning · boss **The Listening Station**

There are **5 Signal Fragments** in all — one per zone. Progress autosaves to localStorage. The **Command Center** (C) holds the story bible, the Five Signal Scouts, progression, zones, debug/save data, and the AI QA lab.

### Ending / Finale

**Skyline Array (Zone 5) is the finale.** Beating The Listening Station launches **EndingScene** — a classification-choice climax where CONTACT-47 decides what the radar is allowed to read them as (**REFUSE THE LABEL**). The Five Signal Scouts converge here. *(The Broadcast — once planned as a separate Zone 6 — was folded into Skyline; it survives only as a possible post-V1 stretch idea.)*

The first-zone loop, in detail: wake in Miller Field → learn to move → **scan** the dip to reveal unmapped platforms → slip past the old scanner rig (red cones *classify* you: UNKNOWN → ANOMALY → THREAT) → destroy two scanner drones → find the sealed crop-circle door → **enter Blipstream Node A** → route the signal through three node switches → return; the door answers → survive **THE SCARECROW ANTENNA** (scan to expose its core, jump-shot it) → collect the first **Signal Fragment**. Hidden along the way: **Will's scout badge** and **Chip's signal box**.

## Tech

- **Vite 5 + TypeScript + Phaser 3** (Arcade physics), 480×270 virtual pixel canvas, crisp upscale
- **Split rendering**: the *world* is pixelated canvas; the *console UI* (menu, objective, status strip, pause, settings, Command Center) is crisp native-resolution HTML in the warm-midnight palette (cream / lime / amber / crimson)
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

- **Level Plans / Roadmap** — full structure for all five zones (core loop, mechanics, sub-areas, Blipstream node, boss phases, scout Signal Set, art direction). All five zones are built and playable through the Skyline Array finale.
- **Wardrobe** — every Signal Skin with passive/signature/tradeoff, lock state, and live equip.
- **Level Atlas** — the real collision/entity grids from `src/game/data/levels.ts` painted as maps.
- **Bestiary / Arsenal** — every enemy + the CONTACT-47 kit with live tuning numbers from `config.ts`.
- Plus live save/quest state, zones, build TODO, and AI QA status — all reading the same data the game runs on, so it cannot go stale.

## AI QA Pipeline

This project is an experiment in AI-driven development: the game is built, played, screenshotted, debugged and re-verified by automation before a human tests it. Playwright drives a real browser through the full quest loop using real keyboard input plus a `?test=1` Test API (`window.__BLIP_TEST_API__`). Reports land in `test-results/qa-reports/` and surface in the Command Center's **AI QA / Playtest Lab** panel. Human handoff: [PLAYTEST.md](PLAYTEST.md).

## Project Guardrails

Development rules live in `.claude/skills/` (game vision, engine rules, art direction, puzzle rules, QA checklist, scope control) and are indexed from [CLAUDE.md](CLAUDE.md).

<!-- vercel-github-linked: 2026-07-12 -->
