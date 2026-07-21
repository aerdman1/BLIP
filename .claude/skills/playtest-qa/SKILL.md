---
name: playtest-qa
description: BLIP playability checklist — run after each major feature; fix failures before adding new scope. Also governs the AI QA pipeline (Playwright tests, qa-loop, screenshot review).
---

# Playtest / QA

Purpose: after each major feature, verify the game is actually playable.

## Checklist (run after every major feature)

- Can the player spawn in `SweepScene`?
- Can the player move in 4 directions, Phase Shift, aim, and shoot?
- Can scan pulse reveal caches and damage/stun nearby threats?
- Can the player charge a signal node?
- Does a charged breach/route transition to the next top-down arena?
- Do health, shards, weapon pickups, skins, rewards, and save state persist across arena transitions?
- Can the player clear Signal Storm?
- Does save data update (localStorage `blip_save_v1`)?
- Does the Command Center reflect the top-down world state?
- Does `npm run typecheck` pass?
- Does `npm run build` pass?

**If any item fails, fix it before adding new scope.**

## AI QA Pipeline Rules

- Automated tests live in `tests/` (Playwright), driven by `window.__BLIP_TEST_API__` (dev / `?test=1` only).
- `npm run qa:full` = typecheck + build + e2e. `npm run qa:loop` = bounded QA loop writing `test-results/qa-reports/latest.md` + `history.json`.
- When a test fails: read the error → inspect code → inspect screenshots if visual → fix the ROOT CAUSE → rerun the failing test → only then continue.
- Never weaken a test to make it pass (unless the test itself is clearly wrong). Never delete features to go green unless broken AND nonessential. Never expand the game while tests are failing.
- Screenshot review is strict: player visible, region readable, projectiles readable, HUD legible, Command Center polished, connected top-down route intact, no old cow-abduction concept anywhere.
