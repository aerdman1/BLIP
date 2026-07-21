---
name: blip-progression
description: BLIP's top-down earn-loop — abilities, Signal Shards, skins, rewards, and save wiring.
---

# BLIP — Top-Down Progression

Purpose: keep BLIP's power curve small, legible, and wired through the current top-down route.

## The 3 Earn-Channels

| Channel | Earn it by | Data source |
|---|---|---|
| **A — Signature ability** | clear a major Signal Node / area milestone | `ZONE_SIGNATURE` in `src/game/data/upgrades.ts` |
| **B — Signal Shards → Chip's Workbench** | salvage from drones, caches, route clears | `config.PROGRESSION.workbench` + `save.shards` / `purchasedUpgrades` |
| **C — Scout skins** | complete a scout's 3-piece Signal Set | `src/game/data/skins.ts` |

The base kit must beat every area unaided: move, dash, Pulse Carbine, Arc Blade, Recall Disc, scan pulse, and overdrive. Upgrades add options; they must not become mandatory unless the route explicitly marks the gate.

## Wiring Rules

1. Ability ids live in `src/game/data/upgrades.ts`; reuse them instead of inventing aliases.
2. Save state lives in `src/game/systems/SaveSystem.ts`; area milestones use top-down route flags and `completedZones`.
3. Route handoffs run through `SweepScene` and `sweepArenas.ts`; player state must persist across areas.
4. Command Center progression is a mirror of save/data state, not a separate source of truth.
5. Test hooks should use `api.enterZone(zoneId)`, `api.enterSweep(arenaId)`, and `api.completeRoute()`.

## QA Gate

Any progression change should pass:

- `npm run typecheck`
- `npm run build`
- `npm run test:e2e`
