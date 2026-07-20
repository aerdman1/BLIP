# BLIP — Project Instructions

**Always follow the local BLIP project skills/instructions before implementing features. BLIP is a playable, Vercel-ready, side-view procedural pixel-art game — a 5-zone campaign + classification-choice ending (Skyline Array is the finale).**

## Non-Negotiable Production Deploy Rule

- The production URL is **https://blip-chagrin.vercel.app/**. Do not call deployment work done until this URL is verified.
- There are two local BLIP checkouts. Do not edit both by hand. Use Git to sync them.
  - Canonical Vercel-linked deploy checkout: `/Users/aerdman/BLIP`
  - GitHub mirror checkout: `/Users/aerdman/ReadMe_Local/Github/BLIP`
- Before deploy, make sure the checkout being deployed is clean and at `origin/main`: `git fetch origin`, `git status -sb`, `git rev-parse HEAD`, and compare to `origin/main`.
- Deploy only from `/Users/aerdman/BLIP` unless `.vercel/project.json` in another checkout is confirmed to point to project `blip` with project id `prj_NSl22sZuspAp8SitcT6Nv0P7154n`.
- Standard production flow for committed changes: run `npm run ship` from `/Users/aerdman/BLIP`. This syncs `main`, runs checks, pushes GitHub, deploys Vercel, aliases `blip-chagrin`, and verifies the alias target.
- If changes are uncommitted, commit them intentionally first, then run `npm run ship`.
- `npm run deploy` must print the Vercel deployment URL, wait for it to be `READY`, alias it to `blip-chagrin.vercel.app`, and verify through Vercel that the alias points to that exact ready production deployment. Do not trust the dashboard alone.
- If GitHub Actions, GitHub API, Vercel, or account connection status is degraded, do not trust automatic deployments. Use the canonical local Vercel deploy flow and verify the alias target.
- If a Vercel deployment sits in `Initializing` and serves Vercel's placeholder page, do not alias `blip-chagrin` to it. Wait for `Ready` or remove the stuck deployment, then keep the alias pointed at the newest verified ready deployment.

## Local Project Skills (read before working on the relevant area)

| Skill | Path | Governs |
|---|---|---|
| BLIP Game Director | `.claude/skills/blip-game-director/SKILL.md` | Vision, tone, story, naming — consult before ANY feature |
| Phaser Pixel Platformer | `.claude/skills/phaser-pixel-platformer/SKILL.md` | Engine, rendering, code architecture rules |
| Procedural Pixel Art | `.claude/skills/procedural-pixel-art/SKILL.md` | All art/textures/palette decisions |
| Blipstream Puzzle | `.claude/skills/blipstream-puzzle/SKILL.md` | Blipstream Node room design |
| Playtest / QA | `.claude/skills/playtest-qa/SKILL.md` | Playability checklist + AI QA pipeline rules |
| Scope Control | `.claude/skills/scope-control/SKILL.md` | What NOT to build today |
| BLIP Progression | `.claude/skills/blip-progression/SKILL.md` | Earn-loop wiring — abilities, Signal Shards/Workbench, ERD dev panel, test hooks |

## Quick Facts

- Game: **BLIP** — "You are the thing on the radar." Player: **CONTACT-47**. Puzzle dimension: **Blipstream**. Villain/system: **The Interpretation Engine**. Story heart: **The Five Signal Scouts** (Will, Chip, Henry, Cameron, Danny).
- **5 playable zones**, one scout + boss + Signal Fragment each: 1 Miller Field (Will) · 2 Motel Nowhere (Chip) · 3 Chagrin Falls High / Tiger Stadium (Henry) · 4 Patterson's Orchard (Cameron) · 5 Skyline Array (Danny). **Skyline Array is the finale** — beating it launches **EndingScene**, a classification-choice climax ("REFUSE THE LABEL"). There is no Zone 6; "The Broadcast" was folded into Skyline (future stretch at most). Signal Fragments total **5** (one per zone).
- Side-view pixel platformer. Internal resolution 480×270, pixel-perfect upscale. Phaser 3 + Arcade physics + Vite 5 (Node 18 pin) + TypeScript.
- All art is procedural (generated textures). All tuning constants in `src/game/config.ts`. All content data in `src/game/data/`.
- Save: localStorage `blip_save_v1` (migrates legacy `beamline_save_v1` if found).
- Commands: `npm run dev` · `npm run typecheck` · `npm run build` · `npm run preview` · `npm run test:e2e` · `npm run qa:playtest` (fun-loop storyboard → `qa-reports/`) · `npm run qa:full` · `npm run qa:loop`
- No BEAMLINE branding anywhere user-facing (legacy save migration only).
