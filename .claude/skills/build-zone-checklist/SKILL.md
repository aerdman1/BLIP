---
name: build-zone-checklist
description: Turn-key process for building or extending a BLIP zone. All 5 campaign zones (Miller Field, Motel Nowhere, Chagrin Falls High, Patterson's Orchard, Skyline Array — the finale) are built; use this when the user says "build zone N" or reworks an existing zone. Ensures the side-view level, the top-down "Fold" beat, progression, docs and registration all land together and consistently.
---

# Build-Zone Checklist

When the user says **"build zone N"**, follow this end-to-end so nothing is missed. Each zone is a
side-view spine PLUS one perspective shift routed through the shared **Fold** engine.

## 0. Load the plan + guardrails first
- **Zone 4 → `~/.claude/plans/plan-and-build-the-staged-reef.md`** (Patterson's Orchard, Cameron/ECHO, top-down crop-draw). Comprehensive 9-phase spec.
- **Zone 5 → `~/.claude/plans/plan-and-build-the-splendid-wolf.md`** (Skyline Array, Danny/ROCKET, first-person sky-tuning). Comprehensive 11-phase spec. **Skyline Array is the finale** — its boss (The Listening Station) launches **EndingScene**, the classification-choice climax ("REFUSE THE LABEL") where the five scouts converge.
- **There is no Zone 6.** "The Broadcast" (once a planned genre-melding capstone with a five-scout convergence and a rumor-static mirror boss) was **folded into the Skyline Array finale**. If ever revived as a post-V1 stretch, commission a planning pass FIRST (per-room genre scenes, boss state machine); do not start blind.
- Also read: `blip-game-director`, `scope-control`, `blip-progression`, `procedural-pixel-art`,
  `phaser-pixel-platformer`, `blipstream-puzzle`, and this project's `CLAUDE.md`.

## 1. The perspective shift = the Fold (shared architecture — DO NOT reinvent)
Every zone's view-shift reuses the SAME engine we built for Z1/Z2. Do not build a bespoke top-down
scene per zone unless the lens is genuinely different (Z5 first-person, Z3 underwater already exist).
- **Top-down combat beats** (Z4 crop-draw is top-down; any "scan" beat) → reuse
  `src/game/scenes/SweepScene.ts` + add a `data/sweepArenas.ts` entry (`mode: 'traverse'`, a `theme`,
  `enemySeed`, a `breach`, and `next` = the return scene key).
- **The transition** is always `src/game/systems/FoldTransition.ts`:
  - Outgoing scene: `foldCollapse(scene, fx, () => scene.switch(SCENES.sweep))` (sleep the overworld).
  - Return: `SweepScene.foldOnward()` sets `nodeJustSolved` (if theme circuit-like) and WAKES the
    slept overworld; the overworld's `onWake` must re-enable input (`this.input.enabled = true`) and
    read `nodeJustSolved` to apply the world change. (Cold-open Z1 uses `scene.start` + `foldSettle`.)
- Bespoke lenses (Z5 first-person dish-tuning, Z4's crop-DRAW mechanic) get their own scene, but still
  bookend with the Fold (`foldCollapse`/`foldSettle`) for a consistent transition feel.

## 2. Data + canon (keep all files in agreement)
For zone id `<zid>` (e.g. `pattersons-orchard`), update ALL of:
- `src/game/data/zones.ts` — set the `ZoneDef` status `PLANNED → PLAYABLE`.
- `src/game/data/levelPlans.ts` — the `LevelPlan` status `PLANNED → BUILT`; make the `perspective`
  field name the Fold + the top-down/lens beat.
- `src/game/data/gameBible.ts` — the zone's `BibleEntry` exists (all 5 zones have one).
- `src/game/data/scouts.ts` — the scout's `SCOUT_LOGS` entry exists (`cameron-log-1`, `danny-log-1`
  are written). Wire the 3-piece Signal Set (badge + log + relic) → skin unlock.
- `src/game/data/upgrades.ts` — the zone's signature ability is in `UPGRADES` + `ZONE_SIGNATURE`
  (Z4 `pulse-ricochet`, Z5 `phase-drift-plus`; `refuse-label` belongs to the Skyline
  Array finale / EndingScene). Flip its `status` to IMPLEMENTED when the boss grants it.
  See `blip-progression` for the earn-loop.
- `src/game/data/commandCenterData.ts` — tick the relevant `BUILD_TODO` items.
- `src/game/data/levels.ts` — add the ascii level def (the plan file has the grid).

## 3. Register the scene (the 6-file gotcha)
A new scene must be added in ALL of:
`src/game/BlipGame.ts` (scene array) · `src/game/config.ts` (`SCENES` + any `TEX`/tuning) ·
`src/game/scenes/GameOverScene.ts` (stop-list) · `src/game/scenes/MainMenuScene.ts` (zone routing in
`startGame`) · `src/game/systems/TestAPI.ts` (registerScene + any test hooks) · `src/ui/ShellUI.ts`
(if it needs shell wiring). Wire the previous zone's exit → this zone (`scene.start(SCENES.<next>)`).

## 4. Top-down ability parity (already supported — keep it)
`BlipCraft`/`SweepScene` already apply the active skin's mods (maxHp, move/dash/fire/scan) + SPARK
Surge Shot + ROCKET Phase-Strike. When a zone's scout skin lands, its top-down behavior comes for
free. If a zone needs a NEW top-down ability (e.g. ECHO bounce shots), add it behind
`activeSkin().abilities.<name>` / `hasAbility(id)` in `SweepScene`, matching the side-view `Player.ts`.

## 5. Verify
- `npm run typecheck` + `npm run build` MUST pass.
- Preview: enter the zone (Test API `startGame`/`enterZone`, or the debug warp), play the side-view
  beat → trigger the Fold → top-down beat → Fold back → confirm the world change.
- ⚠️ **Preview rAF throttle:** the headless preview often freezes Phaser's loop at boot
  (`requestAnimationFrame` ~1 frame/1.5s). If the game is stuck on "TUNING SIGNAL", it's the
  environment, not the code — confirm via build + code review and have the human playtest in a
  focused browser.
- Update deferred-work tracking in `blip-next-steps.md` memory + `BUILD_TODO` + `LEVEL_DESIGN_DEEP.md`.

## 6. Atlas + Command Center
The LEVEL ATLAS tab auto-renders from `levels.ts` once the level def lands (canvas id per the plan,
e.g. `cc-atlas-orchard`). Confirm the zone card + level plan show correctly in the Command Center.
