# BLIP Top-Down Migration

Status: Phase 1 runtime pivot in progress.

## Current Decision

BLIP is now a top-down-only game. The side-scrolling campaign is removed from the live Phaser scene list and cannot be entered from the menu, game-over retry, ERD dev console, global debug hotkeys, or Test API zone entry.

The existing top-down arenas are retained as the playable foundation and are connected in this order:

1. `surface-z1` — Miller Field / Area 47
2. `circuit-z2` — Motel Nowhere circuit
3. `town-z3` — Chagrin Falls town and stadium-edge connector
4. `maze-z4` — Patterson's Orchard living maze
5. `anomaly-01` — Signal Storm combat holdout

These areas remain separate `SweepScene` arena loads internally, which keeps the working controller, camera, collision, weapon, enemy, cache, shard, skin, and save systems stable while making the route feel continuous to the player.

## Removed From Live Access

- Side-view Phaser scene registration for `FieldScene`, `MotelScene`, `StadiumScene`, `UnderwaterScene`, `OrchardScene`, `SkylineArrayScene`, `BlipstreamScene`, and `EndingScene`.
- Menu continue/new-game routing into side-view zones.
- Top-down breach return into side-view scenes.
- Game-over fallback into side-view zones.
- ERD side-view zone warp buttons.
- Global debug hotkeys that jumped into side-view Miller Field or Blipstream.
- Test API `enterZone()` side-view routing; it now maps zone ids to top-down arenas.

## Retained For Reuse

These remain valuable and should be ported or archived deliberately, not deleted blindly:

- Story, scouts, save data, upgrades, reward caches, skins, field notes, and Command Center collections.
- Procedural art textures that can be reused as top-down props, landmarks, UI, VFX, or boss silhouettes.
- Side-view boss concepts: Scarecrow Antenna, Vacancy Sign, Weather Balloon, Harvest Pattern, Listening Station.
- Side-view enemy concepts: drones, scanner rigs, cones, spotters, hidden signal objects.
- Existing top-down stack: `SweepScene`, `BlipCraft`, `SweepEnemy`, `sweepArenas`, `sweepWeapons`, `TdTerrain`, `TdLighting`, `TdActors`, `TopDownShadows`.

## Follow-Up Removal Pass

After the top-down baseline is playable and built, do a dedicated archive/delete pass for side-view-only source files and tests. The first runtime pivot intentionally unregisters them before deleting them so TypeScript/build failures identify hidden dependencies cleanly.

Likely side-view-only files:

- `src/game/scenes/FieldScene.ts`
- `src/game/scenes/MotelScene.ts`
- `src/game/scenes/StadiumScene.ts`
- `src/game/scenes/UnderwaterScene.ts`
- `src/game/scenes/OrchardScene.ts`
- `src/game/scenes/SkylineArrayScene.ts`
- `src/game/scenes/BlipstreamScene.ts`
- Side-view player/platforming entities such as `Player`, `HiddenPlatform`, `CropCircleDoor`, `BlipstreamNodePortal`, and side-view bosses.
- Playwright specs that assert side-view scene names, platforming beats, Blipstream rooms, or level progression.

## Phase 1 Validation Target

- New game starts in `SweepScene` at `surface-z1`.
- Each breach transitions to the next top-down arena.
- Health, shards, weapon pickups, skins, rewards, caches, and save state persist across area changes.
- Command Center opens and reports the new top-down world area maps.
- No UI or debug command starts side-scrolling content.
- `npm run typecheck` and `npm run build` pass.
