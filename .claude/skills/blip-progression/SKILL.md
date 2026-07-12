---
name: blip-progression
description: BLIP's earn-loop — how abilities, Signal Shards and skins are earned and wired. Read before touching progression, adding a zone's signature ability, the Workbench shop, or the ERD dev panel.
---

# BLIP — Progression (Earning Your Power)

Authoritative design: `PROGRESSION_PLAN.md`. This skill is the **wiring reference**.
Lean by rule: **3 channels, ~6 abilities, one currency, one hub, no skill tree.** The
base kit must beat every zone unaided — everything here is added power + optional routes.

## The 3 earn-channels
| Channel | Earn it by | Data source |
|---|---|---|
| **A — Signature ability** (1 per zone) | beating the zone's boss + collecting its Signal Fragment | `ZONE_SIGNATURE` in `src/game/data/upgrades.ts` |
| **B — Signal Shards → Chip's Workbench** | salvage from drones/caches, spend on tiered stat upgrades | `config.PROGRESSION.workbench` + `save.shards`/`purchasedUpgrades` |
| **C — Scout skins** | complete a scout's 3-piece Signal Set | `SCOUT_SKINS_PLAN.md`, `src/game/data/skins.ts` |

All ability ids live in `upgrades.ts` (each has `unlockType: 'base'|'boss'|'shop'|'scout-set'`,
plus `zone`/`scout`/`cost`). **Reuse existing ids — never invent parallel names.**

## Add a zone's signature ability (Channel A)
1. Confirm the id + `zone` in `ZONE_SIGNATURE` (upgrades.ts).
2. In that zone's scene `collectFragment()`, call `progression.grantZoneSignature(zoneId)`
   (from `src/game/systems/ProgressionSystem.ts`) and fold the returned `UpgradeDef` into
   the fragment reward card body (`◆ ABILITY UNLOCKED — …`). See `FieldScene.collectFragment`.
3. Grants are **idempotent** (`grantAbility` in SaveSystem, emits `EVT.abilityUnlocked`).
4. **Make the ability real** in the kit, gated by `hasAbility(id)`:
   - Combat scaling example — Pulse Resonance: `Player.get coreDamage` adds
     `PROGRESSION.pulseResonanceCoreBonus` when owned; boss `hitCore(amount)` takes the
     amount; the scene's boss-core overlap passes `player.coreDamage * (surge?2:1)`.
   - Traversal keys (emp-burst, ghost-protocol, phase-drift-plus…): read `hasAbility(id)`
     where the gated route/mechanic lives. Grant now even if the mechanic lands later.

## Signal Shards + Workbench (Channel B)
- Currency lives in `save.shards`; purchases in `save.purchasedUpgrades` (id + tier suffix,
  e.g. `max-hull-2`). Helpers: `addShards(n)`, `buyUpgrade(id, cost)`, `ownsUpgrade(id)`.
- Costs/tiers/effects: `config.PROGRESSION` (`shardsPerDrone`, `shardsPerCache`, `workbench`).
- The shop UI is the Command Center **PROGRESSION** panel. Apply purchased stat mods in
  `Player` alongside skin mods (coexist — don't overwrite).

## ERD dev panel (development only)
Type **`erd`** on the title screen → dev console (`ShellUI.showDevPanel`). Warp to any
of the 5 PLAYABLE zones, grant all abilities/skins, `+Fragments`/`+Shards`, toggle **God Mode**
(`DevState.god`, read by `Player` on spawn), reset save. Not persisted, not gameplay.

## Testing hooks (deterministic — avoid menu-fade / rAF flakes)
- `api.enterZone(zoneId)` — set save + start the scene directly (no menu fade). Use this,
  not inject-save-then-continue.
- `api.spawnBoss()` → poll `getBossState().state === 'fighting'` (boss rises ~1.1s) →
  `api.damageBoss(99)` → poll the zone's `bossDefeated` flag → `api.collectFragment()`.
- New-game tests must `api.dismissTransmission()` after `startGame` — the how-to-play card
  pauses the scene. (See [[blip-project-state]] QA-infra gotchas.)

## Phases (QA-gated: typecheck + build + qa:full green each)
Phase 0 data/save ✅ · Phase 1 Miller `pulse-resonance` end-to-end ✅ (Motel `emp-burst`
grant also wired) · **Phase 2** = Shards economy (drone drops + caches + HUD counter +
Workbench spend) · Phase 3 = soft ability-gating + backtrack rewards · Phase 4 = per-zone
signature rollout across all 5 zones through the **Skyline Array finale** (its boss grants
`phase-drift-plus`; the EndingScene / `refuse-label` classification choice closes the game).
