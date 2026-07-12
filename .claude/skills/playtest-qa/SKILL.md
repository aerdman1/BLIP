---
name: playtest-qa
description: BLIP playability checklist — run after each major feature; fix failures before adding new scope. Also governs the AI QA pipeline (Playwright tests, qa-loop, screenshot review).
---

# Playtest / QA

Purpose: after each major feature, verify the game is actually playable.

## Checklist (run after every major feature)

- Can the player spawn?
- Can the player move, jump, hover, dash?
- Can the player shoot (pulse shot)?
- Can the scan pulse reveal something?
- Can the player enter Blipstream Node A?
- Can the Blipstream puzzle be completed?
- Does returning unlock the main-world crop-circle gate?
- Does the boss spawn?
- Can the boss be defeated (scan → weak point → pulse)?
- Can the Signal Fragment be collected?
- Does save data update (localStorage `blip_save_v1`)?
- Does the Command Center reflect state?
- Does `npm run typecheck` pass?
- Does `npm run build` pass?

**If any item fails, fix it before adding new scope.**

## AI QA Pipeline Rules

- Automated tests live in `tests/` (Playwright), driven by `window.__BLIP_TEST_API__` (dev / `?test=1` only).
- `npm run qa:full` = typecheck + build + e2e. `npm run qa:loop` = bounded QA loop writing `test-results/qa-reports/latest.md` + `history.json`.
- When a test fails: read the error → inspect code → inspect screenshots if visual → fix the ROOT CAUSE → rerun the failing test → only then continue.
- Never weaken a test to make it pass (unless the test itself is clearly wrong). Never delete features to go green unless broken AND nonessential. Never expand the game while tests are failing.
- Screenshot review is strict: player visible, level readable, Blipstream visually distinct, boss/projectiles readable, HUD legible, Command Center polished, no old top-down/cow-abduction concept anywhere.
