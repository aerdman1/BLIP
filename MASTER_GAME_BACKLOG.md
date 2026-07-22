# BLIP Master Game Backlog

Last reconciled: 2026-07-22

This is the authoritative backlog for BLIP. It reconciles current code, assets,
tests, AI Player Lab evidence, Command Center data, and design docs. Future AI
sessions should use this file plus the in-game Command Center before relying on
old prompts or summaries.

Map planning source of truth: `MAP_SCHEMATICS.md` links generated top-down SVG
schematics under `docs/map-schematics/`. Regenerate them with
`node scripts/generate-map-schematics.mjs` after any arena coordinate changes.

Status key: COMPLETE, PARTIAL, PLANNED, MISSING, DEFERRED, CUT / NO LONGER
APPLICABLE, NEEDS DECISION.

## Current Truth Summary

BLIP is currently a top-down-only Phaser/Vite action game with five
route-connected regions:

1. Miller Surface
2. Motel Circuit
3. Chagrin Falls Town
4. Patterson's Orchard
5. Signal Storm

The regions are not one seamless open map. They are separate top-down arena maps
connected by charged breach handoffs. This is the correct architecture for now:
it preserves working regions, keeps state stable, and avoids a risky one-scene
rewrite.

The playable foundation is real: single save, Continue/New Game, pause Quit to
Menu, shared player state across handoffs, three weapons, fast switching, Phase
Shift, restrained trailing Phase Shift echoes, named region goals, hardened charge-plus-action route objectives, enemy
roles, enemy pursuit/stuck-recovery hardening, HD visual scale decoupled from
world-space hitboxes, safe marker resolution for authored spawns/exits, a first
Gravity Well beat, schematic-first expanded layouts across all five route
regions, a gameplay-design/content pass that gives each named area a purpose,
authored field-event reward pockets with visible scan/power markers, early
weapon prototypes, optional ambush hooks, a first subtle discovered-area lighting
read, a tightened pickup-label/equip-message path, a weapon feel pass across
Pulse/Arc/Recall, Orchard Crop Circle gating through the
Gravity Well/raised-ridge step, staged Signal Storm phase labels, generated map
schematics, AI Lab smoke harness and focused campaign evidence, HD top-down renderer, and the Tripo
CONTACT-47 eight-facing sprite fallback pipeline.

The game is not yet a strong vertical slice. The biggest current gaps are:
manual feel review on the newly expanded purposeful layouts, objective/route
completion on short AI region runs, region variety still needing live encounter polish, incomplete
notification/reward consolidation, shallow loot presentation, progression
mutations that need testing/polish, weak full-route AI completion evidence, and
a finale that still needs a more authored climax. The latest automated sweep
added stricter `qa:maps` structural checks plus `qa:route` runtime checks for HD
rendering, objective copy, route-open guidance, pressure cleanup, Motel scanner
identity/offline cleanup, Orchard Gravity Well gating and Signal Storm finale
copy. Latest public AI evidence is `first-three-route-focus-v3`: 6
Miller→Motel→Town attempts, 3/6 completions, 0 deaths and 1 soft-lock-risk
stall, mostly in Motel route-forwarding. Reports now include objective target
labels, decision traces and stall samples. Orchard-focused
`orchard-ai-gravity-priority-v1` remains 6/6 with 0 soft-lock risks/deaths.
These are design-friction signals, not hard deploy gates.

## Dev Warp Truth

Localhost shows main-menu warp buttons because Vite dev builds satisfy
`import.meta.env.DEV`. Production intentionally hides those buttons unless the
URL has `?test=1` or god/dev state is enabled.

Evidence:

- `src/ui/ShellUI.ts` gates menu warps through `devMode()`.
- `devMode()` returns true for `import.meta.env.DEV`, `?test=1`, or `devState.god`.
- `src/game/systems/TestAPI.ts` follows the same dev-or-test rule.

Decision: keep production warps hidden by default. If production tester warps are
needed, add an explicit tester-mode decision later rather than exposing them as
normal player UI.

## Status Counts

Audited backlog records in this file:

| Status | Count |
|---|---:|
| COMPLETE | 31 |
| PARTIAL | 57 |
| PLANNED | 17 |
| MISSING | 7 |
| DEFERRED | 13 |
| CUT / NO LONGER APPLICABLE | 4 |
| NEEDS DECISION | 2 |

## Vertical-Slice Critical Path

Only this sequence is required to make the existing five-region route feel like
a strong demo. Do not jump to later full-game systems until these are stable.

1. Automated route/layout checks are now the first gate. Run `npm run qa:maps`
   and `npm run qa:route` after map or objective edits. These cover walkability,
   route distances, purposeful optional branches, reward/event density, scanner
   label clarity, scanner and Gravity Well hooks, HD render readiness,
   objective/reward copy, route-open hints, route pressure cleanup, Motel
   scanner identity/offline cleanup, Orchard Gravity Well gating and Signal
   Storm finale copy.
2. Subjective feel review of the schematic-first route: Miller, Motel, Town,
   Orchard and Signal Storm now all have larger authored maps plus a named-area
   purpose and field-event content pass. Only taste/feel remains manual: travel
   feel, visual taste, cover quality, route readability by eye, reward
   excitement and encounter pacing.
3. Patch only targeted map problems from that review: do not blindly scale again.
   Adjust specific routes, branches, encounter spaces, loot pockets, signs or
   helper coordinates.
4. AI Player Lab safety and route guidance: continue before/after comparisons
   using visible perception only. Miller→Motel improved from 0/6 to 2/6 after
   the East Road breadcrumb fix, but first-route completion is still not strong.
5. First-route clarity: Miller -> Motel -> Town must be understandable without
   hidden navigation. Current focused evidence is 2/6 Miller→Motel completions
   with 0 soft locks/deaths. Next automated target is reducing remaining
   Miller→Motel stalls, then rerunning Miller→Motel→Town.
6. Unified notification and reward UI: one objective card, one activity feed,
   one major queued reward, no overlapping popups.
7. Major reward presentation: clear name, type, rarity/importance, behavior,
   equip/activate where relevant, and no generic diamond for important rewards.
8. Meaningful progression: test/polish the first live behavior hooks, then add
   additional mutations tied to region rewards, Scout caches, or secrets.
9. Motel identity: scanner/stealth section must feel intentionally different,
   with Phase Shift onboarding and combat fallback.
10. Town identity: cover routes, at least two approaches, hostile structure, and
   stronger Chagrin Falls exterior-landmark read.
11. Orchard identity: deepen the existing Gravity Well into a compact puzzle and
   make the raised ridge useful beyond a label.
12. Signal Storm finale: named multi-stage climax that combines weapons, Phase
   Shift, hazards, and reward/completion feedback.
13. Focused AI/regression campaigns after the layouts are stable; extended
   overnight campaign only after the route is stable enough to produce
   meaningful evidence.

## Master Audit Ledger

### 1. Core Game Foundation

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Top-down-only direction | COMPLETE | `CLAUDE.md`, `README.md`, scene registry, no side-scroll refs from audit search | Current docs/code describe only top-down BLIP | Continue preventing stale side-scroll language | P0 | Search for side-scroll/platforming refs before major docs pushes |
| Five-region route | COMPLETE | `src/game/data/sweepArenas.ts` | Five arenas exist and route in order | Not geographically seamless | P0 | E2E route transition test stays green |
| Separate scene handoffs | COMPLETE | `SweepScene`, `TestAPI.completeRoute()` | Fast breach handoffs preserve scene/runtime | Can still feel like levels | P1 | Handoffs preserve HP, weapon, save zone |
| Shared player state | COMPLETE | `tests/smoke.spec.ts` | HP/weapon persist through tested transitions | Need repeated-transition memory checks | P1 | Add long transition loop later |
| Single canonical save | COMPLETE | `SaveSystem`, menu copy | Continue/New Game only, no slots | Save migration edge cases only | P0 | Save/load tests stay green |
| Pause/Quit to Menu | COMPLETE | `ShellUI.confirmQuitToMenu()` | Warns return to autosave | No issue | P0 | E2E quit-to-menu test |
| Dev region warps | COMPLETE | `ShellUI.devMode()` | Local/test/god warps work | Production hidden by design | P1 | Production default has no public warp buttons |
| Desktop/controller/touch input | PARTIAL | `InputSystem`, `TouchInput`, `PadBindings`, E2E | Core mapping exists | Needs more touch/controller gameplay-specific tests | P1 | Add tests for Phase Shift, weapon switch, menu/pause on touch/controller |
| Safe spawns/transitions | PARTIAL | arena spawn/breach markers, `nearestWalkableWorld()` | Main route transitions work in E2E; authored player/enemy/exit markers resolve to nearest walkable tile | Invalid spawn/soft-lock coverage is still shallow | P0 | Add invalid spawn and repeated-transition suite |
| Performance/memory repeated transitions | MISSING | no long-run evidence | Basic build runs | No memory-leak campaign yet | P2 | Overnight transition loop with browser restarts |
| More seamless geography | PLANNED | design docs | Separate scenes are retained | Needs better visual continuity/routes | P2 | Routes feel like roads/trails/gates, not level select |
| One giant scene rewrite | CUT / NO LONGER APPLICABLE | guardrails | Not desirable now | Would risk working maps | CUT | Keep separate Phaser regions |

### 2. Route Clarity and Objectives

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Named region objectives | COMPLETE | `src/game/data/regionGoals.ts` | Each region has named objective/reward copy | Some objectives still operate as charge loops underneath | P0 | HUD and Command Center show named goals |
| Visible progress | PARTIAL | HUD node stats, breach feedback, debug `objectiveActions`, field events | Node/route state visible; route opens require charge plus real progress actions; enlarged Miller/Town/Orchard thresholds now better match authored field-event pacing | Too much still reads as generic node charge | P0 | Players/AI know what action progresses objective |
| Completion feedback | PARTIAL | `awardRegionReward()`, banners/toasts, `RewardUI`, `UIScene` | Reward and route-open messages exist; major reward rail and center HUD callouts queue one at a time | Shell toasts/HUD banners still need one shared manager/showcase | P0 | Unified notification manager |
| Reward preview/delivery | PARTIAL | region goals, rewards save, weapon pickup labels | Rewards are named/persisted and important weapon drops show name/role plus a queued weapon acquire card | Presentation is not yet comparable/equippable enough | P0 | Major reward card shows effect and why it matters |
| Forward route clarity | PARTIAL | route signs, breach dwell, latest AI JSON, `tests/route-readiness.spec.ts` | Broad surprise warp removed; route markers simplified; visible field-event markers give players/AI more local goals; Miller exit signs follow East Road → Breach Road → Motel Breach; `first-three-route-focus-v3` reached 3/6 Town arrivals with 0 deaths; Orchard-focused AI reaches 6/6 after Gravity Well objective-priority fix | First-three route remains partial at 3/6 with Motel route-forwarding stalls; failed lower-road breadcrumb relocation was reverted after a 0/6 sample; full-route evidence still missing | P0 | Focused first-three route campaign improves Motel/Town arrivals |
| No endless combat after complete | COMPLETE | `quietRoutePressure()`, `tests/route-readiness.spec.ts` | Enemies/bolts clear after breach opens; route-clear group mutation bug fixed by snapshotting enemy removal and using explicit live-enemy counts | Continue regression coverage | P1 | E2E route-open state has no endless spawns |
| Full-route AI completion | MISSING | `public/ai-playtest/latest.json` | AI harness exists; latest public sample is `first-three-route-focus-v3` at 3/6 Miller→Motel→Town completions with 0 deaths and 1 soft-lock-risk stall; Orchard-focused sample remains 6/6 | No full-route completions in current shipped evidence | P1 | Overnight campaign after route clarity |

### 3. Region Gameplay Identities

| Region / Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Region scale/layout first pass | PARTIAL | `src/game/data/sweepArenas.ts`, `SWEEP_ROUTE_BEACONS`, `SWEEP_MOTEL_SCANNERS`, `SWEEP_GRAVITY_WELLS`, `MAP_SCHEMATICS.md`, `scripts/validate-map-data.mjs`, `tests/route-readiness.spec.ts` | All five route regions have schematic-first larger authored layouts, named-area purpose passes, data-driven helper coordinates, regenerated schematics, strict static map validation and runtime route-readiness coverage | Only subjective live feel review remains; first-route AI still needs tuning | P0 | Travel feel, cover placement and reward excitement feel good enough to tune encounters |
| Map schematics | COMPLETE | `MAP_SCHEMATICS.md`, `docs/map-schematics/*.svg`, `scripts/generate-map-schematics.mjs` | Current arena data generates top-down planning SVGs plus coordinate notes for all five regions | Regenerate after coordinate changes | P0 | Future AI can inspect route layouts without rereading old prompts |
| AI safety after layout pass | PARTIAL | `scripts/ai-player-campaign.mjs`, `tests/ai-player-lab.spec.ts`, `debugAiPerception()` | Personas use visible perception snapshots, labeled objective hints, visible field-event markers, scanners, enemies and pickups; behavior fights/evades visible threats before resuming objectives; campaign runner uses process-specific strict preview ports; reports include decision traces/stall samples; Orchard Gravity Well routing is fixed in focused samples | First-three route sample improved but remains partial; broad overnight campaign still pending | P1 | Continue comparing same personas/seeds using visible perception only |
| Miller Surface scale expansion | PARTIAL | `surface-z1`, `regionGoals.ts`, current route signs, `fieldEvents`, `weaponSpawns`, `MAP_SCHEMATICS.md` | Layout has Field Track, Willow Trail, Cache Grove, Old Mill Spur log/cache pocket, Substation Overlook power-shortcut beat, lower recovery lane shortcut, Scout Shelter pocket, early Arc/Disc prototypes and far-east Motel Breach | Needs manual travel-time/readability review and possible terrain-detail/cover adjustments | P0 | Main route and optional branches make sense, same actor/prop/camera scale, screenshots and travel-time comparison |
| Miller Surface gameplay | PARTIAL | `surface-z1`, `regionGoals.ts`, `fieldEvents`, `route-open-commit-scanner-v1` | Preserved layout, named Willow cache, early combat, gentler onboarding math, no early elite beam, authored optional rewards/ambushes; exit breadcrumb follows the real road; latest Miller→Motel sample is 2/6 with 0 deaths/soft locks | Remaining weaker/odd personas still stall after breach opens; subjective travel/readability review remains | P0 | New-player can complete Miller and enter Motel |
| Motel Circuit | PARTIAL | `SWEEP_MOTEL_SCANNERS`, expanded `circuit-z2`, `fieldEvents`, `MAP_SCHEMATICS.md`, `first-three-route-focus-v3` | Layout has scanner main route, optional Room Row stealth branch, Phase Shift-only Maintenance Pocket, Pool Courtyard crossing, Service Lot fallback loop, drainage shortcut, Motel Sign Ledge, early Arc/Disc prototypes and Town breach. Ambiguous scanner labels are removed; active beams read red; open-route scanners disappear from perception/visual state | Needs stronger route-forwarding into Town, stealth reward, and live feel review | P0 | Personas use Phase Shift and reach Town legitimately |
| Chagrin Falls Town | PARTIAL | expanded `town-z3`, stadium biome, `fieldEvents`, `weaponSpawns`, `MAP_SCHEMATICS.md` | Layout has Main Street, Neighborhood Block/Market Alley upper route, Bridge Overlook sniper/cache beat, River Walk lower shortcut, River Road Tower objective, Stadium Road recovery space, stadium back alley, early Arc/Disc prototypes and Orchard Gate | Needs dedicated Chagrin Falls asset identity and live cover/readability review | P1 | Two readable approaches and cover combat are obvious |
| Patterson's Orchard | PARTIAL | `SWEEP_GRAVITY_WELLS`, expanded `maze-z4`, `fieldEvents`, `MAP_SCHEMATICS.md`, `orchard-ai-gravity-priority-v1` | Layout has tractor lane, Lower Creek secret puzzle pocket, required Gravity Well launch, Raised Ridge reward/switch step, West Rows Recall lane, East Rows pressure lane, Scout Shelter loop, storm-fence shortcut and Crop Circle gate. Focused AI now completes Orchard 6/6 with no soft locks/deaths | Gravity Well object/enemy/projectile redirection is still deferred; dormant Maze Heart boss gate is cut from the current route so Orchard stays traversal-focused | P1 | Gravity Well puzzle has purpose, reward, reset safety |
| Signal Storm | PARTIAL | expanded `anomaly-01` waves, Storm Classifier copy, `fieldEvents`, `MAP_SCHEMATICS.md` | Finale arena has entry recovery lane, Classifier Core phase-one objective, West/East Relay Wing phase-two targets, North Rift phase-three anchor, coil pockets, pressure pockets, recovery pockets, field rewards and named phase banners | Needs authored boss behavior/presentation | P1 | Finale feels distinct from normal waves and completes slice clearly |

### 4. Level Design and World Depth

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Multiple routes | PARTIAL | arena rooms/halls, discovered-room washes | Some route alternatives exist and unvisited HD rooms start subtly dimmer until entered | Not always readable as choice; needs live feel review | P2 | At least Town has two legible approaches |
| Bridges/hills/ridges/overlooks | PARTIAL | town bridge concept, Orchard ridge | A ridge beat exists | Limited elevation vocabulary | P2 | Controlled 2.5D elevation with safe collision |
| Lower paths/ravines/underground | PLANNED | design docs | None required now | Not implemented | P3 | Add only when route needs depth |
| Hidden Scout shelters | PLANNED | Scouts/rewards/docs | Scout lore exists | No authored shelters | P2 | One optional shelter later in slice if useful |
| Purposeful structures / landmarks | PARTIAL | `TdTerrain.placeLandmarks()`, authored field events | Random flat walk-through landmarks no longer spawn in central route spaces; decorative landmarks are edge-biased, while important objects should be authored | Existing authored set pieces still need manual readability/collision review | P1 | Every visible central structure is clearly decorative, interactive, blocked, or tied to a reward/objective |
| Alternate-plane spectacle | PLANNED | story/docs | Signal Storm hints at it | Not implemented | P3 | Save for later full-game expansion |
| Full 3D physics | CUT / NO LONGER APPLICABLE | guardrails | Not needed | Would derail 2.5D design | CUT | Continue controlled layers/depth sorting |

### 5. Weapons

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Pulse Carbine | PARTIAL | `sweepWeapons.ts`, `SweepScene.fire()` | Faster ranged pressure, fifth-shot charged/pierce, stronger charged-shot feedback, ricochet hook | Charged-shot input/feedback is not a true held charge | P1 | Normal, fifth shot, mutation behavior test |
| Arc Blade | PARTIAL | `swingArcBlade()`, `dropWeaponPickup()`, AI perception | Wider melee cone, stronger knockback, parry/reflection and always-on parry shockwave; important Arc pickups advertise PARRY/CLOSE and AI can choose Arc against visible wardens/splitters/turrets | Combo/dash-slash not deep; audio reused | P1 | Parry and arc hit tests |
| Recall Disc | PARTIAL | recall disc projectile data | Faster outbound/return damage, catch behavior and consistent return-trail damage | Environmental switch interaction missing | P1 | Return damage and catch tests |
| Fast weapon switching | COMPLETE | `InputSystem`, `SweepScene`, tests | Keyboard/mouse/gamepad/touch hooks | Needs more gameplay balance evidence | P0 | E2E weapon switch remains green |
| Weapon HUD state | PARTIAL | `UIScene`, Command Center arsenal | Shows active weapon | Mutation state not clear | P1 | HUD shows mutation/equipped state |
| Weapon audio/VFX | PARTIAL | `AudioSystem`, `EffectsSystem` | Basic impacts/pulse sounds | Arc/disc need distinct sound identity | P2 | Each weapon recognizable blind/visually |
| Weapon-specific secrets | PLANNED | `regionGoals.ts` notes | Hooks planned | No strong gates yet | P2 | At least one secret requires a weapon |

### 6. Weapon Mutations and Progression

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Named mutation rewards | PARTIAL | `upgrades.ts`, region rewards, `SweepScene` | Rewards persist and first behavior hooks are live: charged Pulse chain, Arc parry shockwave, Recall return trail | Needs focused tests, HUD clarity and more mutations | P0 | Each major reward changes playstyle |
| Two mutations per weapon | PARTIAL | `SweepScene` mutation hooks | One strong hook exists for each weapon family | Still short of two meaningful mutations per weapon | P0 | Six behavior-changing mutations |
| Progression chain | PARTIAL | region rewards, workbench, Scout sets | Region rewards and Workbench exist | Motivation still disconnected | P0 | Each region grants/reveals useful future-facing change |
| Full mutation trees | DEFERRED | docs | Not needed for demo | Too broad now | P3 | Later full-game system |
| Full crafting economy | DEFERRED | scope-control skill | Workbench exists | Full crafting would distract | P3 | Later only if progression needs it |

### 7. Loot and Reward Presentation

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Basic resources/caches | COMPLETE | `RewardSystem`, `rewards.ts` | Caches, shards, archive, trophies exist | Some charm rewards may still feel toy-like | P2 | Reward archive remains functional |
| Major reward cards | PARTIAL | toasts/banners, region goals, `RewardUI`, pickup labels | Name/type/description appears, major reward banners queue one at a time, and weapon pickups/equip messages resolve from the actual weapon id | Not yet a single polished acquire/equip flow | P0 | Major reward card is unmistakable and non-overlapping |
| Comparison/equip | PARTIAL | `RewardUI`, `rewards.equip()` | Cosmetic equip exists | Gameplay reward compare/equip shallow | P1 | Simple acquire/activate/equip flow |
| Store/salvage | DEFERRED | docs | Duplicate dust exists | Full inventory not needed now | P3 | Decide later |
| AI ignored reward tracking | PARTIAL | AI JSON loot fields | Loot seen/ignored counted | Current evidence is short and route-biased | P1 | Overnight report ranks ignored rewards |

### 8. Phase Shift

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| True short-range teleport | COMPLETE | `BlipCraft.move()`, `EffectsSystem.afterimage()` | Instant blink, i-frames, bursts, cooldown, smaller behind-the-player visual echo | Destination collision validation could improve | P0 | Phase Shift cannot put player in walls or cover the player with a full-size ghost |
| Keyboard/controller/touch input | PARTIAL | `InputSystem`, touch button, pad binding | Inputs exist | Dedicated tests incomplete | P1 | Input tests for all modes |
| Scanner interaction | PARTIAL | Motel scanner code, `SWEEP_MOTEL_SCANNERS`, `tests/route-readiness.spec.ts` | Phase Shift through a beam disables scanner/charges objective. Labels explicitly end in SCANNER; active beams are red hazards; disabled scanners hide after the route opens so they do not look like random props | Tutorial/safe-zone rules and stealth reward still shallow | P0 | Player/AI uses Shift in Motel |
| Projectile/barrier/secret interactions | PLANNED | docs | Projectile phasing partly via i-frames | No phase doors/barrier secrets | P2 | Phase door/secret later |
| Weapon follow-up interactions | PLANNED | docs | Phase-strike skin hook exists | Not a general weapon system | P2 | Weapon-specific follow-up pass |

### 9. Traversal and Puzzle Systems

| System | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Gravity Well | PARTIAL | `buildRegionSetPieces()`, `tryGravityWell()`, `maybeCompleteTraverseObjective()` | Orchard launch to ridge is playable and gates Crop Circle completion | No object/enemy/projectile redirection yet | P1 | Puzzle has reset, safe spawn, reward |
| Signal Tubes | PLANNED | docs only | Concept retained | No implementation | P3 | Add only when route needs conduit travel |
| Phase Doors | PLANNED | docs only | Concept retained | No implementation | P2 | Use for secrets/frequency gates later |
| Signal Rails | DEFERRED | docs | Concept retained | Not needed now | P3 | Later spectacle/traversal |
| Scout Contraptions | PARTIAL | Scout rewards/lore | Story-connected tech exists | No authored contraption puzzle device | P2 | One device if it helps slice pacing |
| Puzzle reset/soft-lock prevention | MISSING | no focused tests | None yet beyond simple well | Needs architecture before complex puzzles | P1 | Puzzle can reset/retry safely |

### 10. Enemies and Encounter Variety

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Distinct enemy roles | COMPLETE | `SWEEP_ENEMIES`, `SweepEnemy` | Drifter, tagger, diver, warden, sniper, splitter, weaver, turret | Needs encounter tuning | P1 | Roles are readable and counterable |
| Enemy pursuit reliability | COMPLETE | `SweepScene.buildEnemyPathField()`, `enemyDriveTarget()`, `SweepEnemy.updateStuckRecovery()`, `tests/combat-enemy-validation.spec.ts` | Drones use a walkable-tile distance field when line-of-sight is blocked; ranged enemies keep movement while firing; stuck bodies recover or snap to a safe path target after repeated failures | Longer AI campaign still needed for tuning confidence | P0 | Enemies do not freeze against walls or become unreachable blockers |
| Enemy killability / hitbox truth | COMPLETE | `ActorRig.collisionPx`, `tests/combat-enemy-validation.spec.ts` | HD sprite scaling no longer shrinks physics bodies; every enemy archetype is proven killable by real player projectiles | Continue tuning combat feel and shield readability | P0 | Combat validation remains green |
| Shield/charger/support/mine roles | PARTIAL | warden/diver/turret cover some roles | Some tactical variety exists | No support/mine-layer/scanner enemy | P2 | Add only if region needs it |
| Environmental hazards | PARTIAL | scanners, turrets, elite beams | Motel scanners/turrets/Classifier exist | Minefields, laser barriers, destructibles shallow | P2 | Each hazard has readable counterplay |
| Player deployables | PLANNED | decoy assets/comments exist | Echo Blink decoy concept | No land mines/traps/drones system | P3 | Only add when tactical need is proven |
| Filler stat-only enemies | CUT / NO LONGER APPLICABLE | guardrails | Avoided | Do not add | CUT | New enemies require role/counterplay |

### 11. Encounter Pacing and Fun Factor

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Region-specific encounter grammar | PARTIAL | arena enemy placements | Some role mixtures by region | Still repetitive route loop | P0 | Each region has one clear combat/pacing identity |
| Recovery windows | PARTIAL | quietRoutePressure, pickups | Route clears pressure | Moment-to-moment pacing not authored enough | P1 | No long empty/no-progress stretches |
| Encounter Director Lite | PLANNED | prompts/docs | Useful concept | No implementation | P2 | Only if static encounter tuning is insufficient |
| Hidden rubber-banding | CUT / NO LONGER APPLICABLE | guardrails | Not used | Avoid | CUT | Use authored tuning instead |

### 12. Stealth

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Scanner beams/alerts | PARTIAL | `buildMotelScanners()` | Beams, labels, alert fallback exist | Alert/investigation/safe zones shallow | P0 | Motel feels like stealth/Phase Shift, not arena |
| Combat fallback | COMPLETE | alert spawns pressure, no soft fail | Detection does not end run | Needs tuning | P1 | Detection changes encounter but does not soft-lock |
| Stealth reward | PLANNED | region reward copy | Ghost Protocol exists later | No clear avoid-detection reward | P1 | Optional reward for cleaner infiltration |
| Decoys/tools | PLANNED | Echo Blink concept | Not active in Motel | No reliable decoy stealth loop | P3 | Later if stealth needs more choice |

### 13. Secrets and Discovery

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Scout caches | COMPLETE | arena caches, Scan Pulse | Caches exist and reveal with scan | Need stronger reward preview | P1 | Caches motivate exploration |
| Scout logs/badges/relics | PARTIAL | scouts/field notes/rewards, `fieldEvents` | Data/archive exist; several authored scan markers now deliver Scout/log-style rewards | Placement/payoff still need live curation | P2 | Each important find has context/reward |
| Weapon/Phase/Gravity secrets | PARTIAL | docs/region notes, `fieldEvents`, `weaponSpawns` | Weapon prototypes and Phase/Gravity-adjacent pockets exist | Strong authored gated secrets are still shallow | P2 | One weapon-specific and one Phase/Gravity secret |
| Shortcuts/alternate routes | PARTIAL | map halls/routes, `MAP_SCHEMATICS.md` | Physical alternate routes/loops exist in every region | Shortcut feedback/unlocks need stronger player read | P2 | One meaningful shortcut after progress |

### 14. Story and Motivation

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| CONTACT-47 / Scouts / Engine | COMPLETE | `gameBible.ts`, `scouts.ts`, docs | Core story survived pivot | Continue cleaning stale wording | P1 | No side-scroll story assumptions |
| Region story reasons | PARTIAL | `regionGoals.ts`, quests | Named objectives exist | Objective why/payoff still thin in-game | P0 | Player knows why each region matters |
| Intro/finale payoff | PARTIAL | Main menu, finale copy | Identity exists | Needs cinematic/authoring pass | P2 | Stronger opening/finale once gameplay stable |
| Willow naming | NEEDS DECISION | Will/Willow both appear | Could be nickname or mismatch | Needs canonical decision | P2 | Decide Will vs Willow and update docs/data |

### 15. Tone and Maturity

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Mature tone target | COMPLETE | `TONE_PASS_NOTES.md`, Command Center art direction | Direction documented | Must remain enforced | P1 | No cute/toy drift in new work |
| Combat force | PARTIAL | mechanical rupture, scorch, stronger hit pressure | Sparks/scorch/shake improved | Weapon-specific impact polish remains | P2 | Hits feel forceful without clutter |
| Atmosphere/environment damage | PARTIAL | HD biomes, fog, shadows | Some darker mood exists | Need damaged buildings/vehicles/emergency cues | P2 | Tone pass per region |
| Optional blood setting | DEFERRED | prompt only | Not needed for mechanical enemies | Organic enemies not current focus | P3 | Decide only if organic enemies arrive |

### 16. UI and Notification System

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Objective card/HUD | PARTIAL | `UIScene`, HUD events | Region label/objective visible | Needs persistent priority design | P0 | Objective always readable, no overlap |
| Popup/toast/banners | PARTIAL | `ShellUI`, `RewardUI`, `SweepScene`, `UIScene` | Routine toasts dedupe and shrink; reward banners and center HUD callouts queue one at a time; routine region entry no longer fires a giant center banner | Independent HUD/banner systems still need one manager/showcase | P0 | Shared notification manager |
| Major reward notification | PARTIAL | reward banners/toasts, weapon pickup flow | One major reward banner at a time; important weapon pickups show a queued acquire card with weapon role | Acquire/equip/comparison flow still shallow | P0 | One major reward at a time |
| Notification developer showcase | MISSING | no showcase | None | Needed after manager | P2 | Test all notification classes |

### 17. HUD, Menus, Settings, Accessibility

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Main/pause menu cleanup | COMPLETE | menu has Continue/New Game; pause Quit | Reset Save removed from in-game menu | None known | P0 | Smoke test |
| Region labels | COMPLETE | `UIScene` | Area name at top HUD | None known | P0 | Region names match routes |
| Phase cooldown/mutation HUD | PARTIAL | core HUD exists | Weapon visible | Mutation/cooldown clarity weak | P1 | Cooldowns/upgrades visible enough |
| Accessibility settings | PARTIAL | audio/shake/settings exist | Core settings work | Blood toggle N/A; aim assist/readability sparse | P2 | Add only when feature exists |
| Production test warps | NEEDS DECISION | hidden by current dev gate | Default hidden is correct | Tester-mode option undecided | P2 | Decide if a production QA URL should expose warps |

### 18. CONTACT-47 Character

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Tripo GLB import | COMPLETE | `public/assets/characters/contact47-tripo.glb` | Source model in repo | GLB not animated | P1 | Asset loads/fallback works |
| Eight facings rendered | COMPLETE | eight PNGs plus sheet | Directional aiming works | Needs visual QA per angle | P1 | Sprite faces aimer cleanly |
| Hover thrusters | PARTIAL | `TdActors.ts` | Low-hover read exists | Needs final polish against all directions | P2 | Thrusters align and do not overlap body badly |
| Collision separate from visual | COMPLETE | `ActorRig.collisionPx`, combat validation tests | Gameplay hitboxes stay world-space honest even when HD sprites are scaled | Continue tuning feel only | P0 | No visual/collision mismatch complaints |
| Full skeletal animation | DEFERRED | no clips | Not current blocker | Retargeting would be expensive | P3 | Revisit only with clean clips |

### 19. Art and Asset Pipeline

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| HD top-down region assets | PARTIAL | `public/assets/topdown` | z1/z2/z4 packs exist, town uses hard-edge HD vocabulary | Dedicated town pack missing | P1 | No pixelated fallback maps in route |
| Dedicated Chagrin Falls pack | PLANNED | docs | Need recognized town identity | Not built | P2 | Town landmarks/streets read immediately |
| Enemy/boss/hazard assets | PARTIAL | procedural/bestiary data | Current enemies render | Replacement art roadmap not complete | P2 | Important enemies not placeholder-looking |
| Traversal device assets | PLANNED | Gravity Well procedural | Well exists | Tubes/doors/rails/contraptions missing | P3 | Add with mechanics |
| Transparent PNG pipeline | COMPLETE | character PNG assets | Tripo output is transparent | Maintain asset checks | P1 | No checkerboard backgrounds |

### 20. Weapon and Combat Visual Polish

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Pulse polish | PARTIAL | pulse bolts/charged fifth shot | Faster fire, bigger charged-shot feedback and stronger muzzle response | Needs held charge/recoil/audio identity | P2 | Pulse feels distinct and forceful |
| Arc polish | PARTIAL | graphics arc/parry text | Wider arc, stronger knockback and always-on parry shockwave are live | Needs combo/dash-slash depth and distinct audio | P2 | Arc feels like melee, not a line effect |
| Recall polish | PARTIAL | disc projectile/return | Faster disc and consistent return trail are live | Needs stronger physical disc/catch presentation and switch interactions | P2 | Return path readable and satisfying |
| Hit pause/knockback/camera | PARTIAL | impact FX, damage-only shake | Routine camera shake removed; only CONTACT-47 damage triggers a restrained camera shake | Needs non-shake impact polish through animation/sound/VFX | P2 | Shooting/impacts/kills do not shake camera; player damage shake is readable but not intense |

### 21. Audio and Atmosphere

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Synth audio system | COMPLETE | `AudioSystem.ts` | Region ambience and SFX exist | Generated-only limitations | P2 | No audio errors |
| Weapon-specific sounds | PARTIAL | pulse/enemy/explosion sounds | Basic sounds work | Arc/disc/Phase/loot identities need separation | P2 | Each weapon and major action recognizable |
| Danger atmosphere | PARTIAL | tone notes, ambience | Tension exists | Needs more region-specific stingers/distortion | P3 | Motel/finale audio support identity |

### 22. AI Player Lab

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Persona harness | COMPLETE | `tests/ai-player-lab.spec.ts`, `scripts/ai-player-campaign.mjs` | Multiple personas, seeds, virtual input | Imperfection tuning needs review | P1 | Lab smoke test passes |
| No hidden-state rule | PARTIAL | guardrails, perception API | Uses perception snapshots, objective hints and nearby visible field-event markers | Need audit before overnight campaign | P1 | Confirm bots do not use hidden coordinates |
| JSON/Command Center report | COMPLETE | `public/ai-playtest/latest.json`, Command Center | Report displays/export link; latest public sample is `first-three-route-focus-v3` at 3/6 Miller→Motel→Town completions with 0 deaths and 1 soft-lock-risk stall; reports include decision traces and stall samples; Orchard-focused `orchard-ai-gravity-priority-v1` remains 6/6 | No full-route completions in current shipped evidence | P1 | Command Center loads JSON |
| 500-run campaign | MISSING | no evidence | Not run | Deferred overnight until route/objective clarity improves | P1 | 500 meaningful runs with restarts and summary |
| Screenshot review | PARTIAL | screenshot paths in JSON | Paths recorded | Not all evidence committed/captured for production | P2 | Representative visual review notes |

### 23. Automated Testing

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Typecheck/build/E2E | COMPLETE | last run passed 6/6 | Deploy gates pass | Keep current | P0 | `npm run qa:full` |
| Route transitions/save | COMPLETE | `tests/smoke.spec.ts` | Main chain covered by debug route | Needs natural-route tests | P1 | Natural completion suite |
| Weapon behavior tests | PARTIAL | E2E switch only | Switching covered | Attack/parry/return not fully covered | P1 | Unit/E2E for each weapon behavior |
| Phase Shift tests | PARTIAL | AI use, input code | Basic smoke | Collision/cooldown tests missing | P1 | Test cooldown and blocked destination |
| Gravity Well tests | MISSING | no focused test | Manual/code only | Needs test | P1 | Entry/exit/spawn/save support |
| Signal Tube/Phase Door tests | PLANNED | systems unimplemented | N/A | Mark planned, not failed | P3 | Add with systems |
| Notification queue tests | MISSING | no manager yet | N/A | Needed after UI manager | P1 | No overlap and priority order |

### 24. Full-Game Features

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Additional regions/larger world | DEFERRED | docs | Current five-region route is enough for now | Expansion would dilute polish | P3 | Only after slice is fun |
| World map/fast travel | DEFERRED | prompt backlog | Not needed now | Could become menu clutter | P3 | Later after geography expands |
| Interiors | DEFERRED | docs | Buildings are exterior obstacles | Full interiors too costly now | P3 | Only selected story interiors later |
| More bosses | DEFERRED | finale needs one first | Not current | Add after Storm Classifier improves | P3 | Later boss roadmap |
| Additional weapons | DEFERRED | current three incomplete | Not needed | Would worsen unfinished systems | P3 | Finish three weapons first |
| Difficulty modes/New Game Plus | DEFERRED | not present | Not needed | Too early | P3 | Later after balance |
| Full inventory | DEFERRED | reward docs | Archive/equip exists | Full store/salvage too much now | P3 | Decide after simple loot flow |

## Later Full-Game Backlog

- Additional regions beyond the current five.
- More seamless regional geography and world/discovery map.
- Fast travel only after the world grows enough to justify it.
- Selected interiors, not every building.
- Larger underground Scout shelters and alternate-plane regions.
- More bosses after the Storm Classifier is authored properly.
- Deeper mutation trees and additional weapons after the first three weapons are
  genuinely distinct.
- Signal Rails, more Signal Tubes, deeper Phase Door chains, and more complex
  Scout Contraptions.
- Full CONTACT-47 skeletal animation if clean clips become available.
- Dedicated final art passes and expanded story campaign.

## Recommended Cuts

- Any return of side-scrolling, platform physics, side-view cameras, old level
  select, side-level skips, or side-scroll-specific cheats.
- One giant Phaser scene rewrite.
- Full 3D physics for elevation.
- Full inventory/store/salvage/crafting before a simple acquire/equip reward
  loop works.
- Every building becoming enterable.
- Stat-only enemy variants.
- Public production dev warps as normal menu UI.
- Full CONTACT-47 skeletal animation as a current blocker.

## Contradictions Resolved

- Dev warps: local/test/god only is correct. Production hiding them is not a bug.
- AI "passing": hard gates are typecheck/build/E2E. AI campaign percentages are
  design evidence, not deploy pass/fail.
- World connection: the world is route-connected through separate scenes, not a
  seamless open map. This remains the safest architecture.
- Phase Shift: SHIFT is now Phase Shift, not Phase Drift. Old "dash" language
  remains only for internal input/config ids. Player-facing copy should say
  Phase Shift, and the visual should be a restrained trail behind CONTACT-47,
  not a large tinted duplicate over the actor.
- Chagrin Falls Town: it is HD-rendered, but does not yet have a dedicated
  Chagrin Falls asset pack. It reuses current HD town/lot vocabulary.
- Rewards: named region rewards exist and persist, but the broader mutation and
  loot-presentation loop is not complete.
- AI campaign: the 500-run overnight campaign was not completed. Current public
  JSON is `first-three-route-focus-v3`: 6 Miller→Motel→Town attempts, 3/6
  completions, 0 deaths and 1 soft-lock-risk stall, mostly in Motel
  route-forwarding. Reports include objective target labels, decision traces
  and stall samples. Orchard-focused `orchard-ai-gravity-priority-v1` remains
  6/6 with 0 soft-lock risks/deaths. These are route/objective-friction
  signals, not full-route completion benchmarks.
- CONTACT-47 animation: the Tripo directional sprite is acceptable for now. Full
  skeletal animation is deferred.
- Willow/Will: the docs/code use both. Decide whether Willow is Will's Scout
  frequency/callsign or an accidental rename, then normalize.

## Proposed Next Work Package

Next package: Motel/Town route-forwarding clarity, then subjective feel review.

Scope:

1. Continue automated first-route route-following:
   - use `first-three-route-focus-v3` as the current first-three baseline
   - reduce remaining Motel/Town stalls without hidden AI coordinates
   - rerun the same six personas/seeds after each focused change
   - then rerun Miller→Motel→Town
2. Keep the new automated gates green:
   - `npm run qa:maps`
   - `npm run qa:route`
   - typecheck/build/E2E as appropriate
3. Subjective play-feel review the expanded maps using `MAP_SCHEMATICS.md` and live gameplay:
   - Miller spawn -> objective -> Motel exit
   - Field Track, Willow Trail, East Road, Breach Road and Motel Breach signage
   - optional Old Mill, Substation and Scout Shelter branches
   - excessive empty walking, cover placement, enemy spacing, field-event value and cache motivation
   - Motel scanner path -> Town exit
   - Town streets/bridge/stadium-edge route
   - Orchard Gravity Well/ridge route
   - Signal Storm arena scale
4. Patch only obvious problems from the expanded pass:
   - excessive empty walking
   - unclear signs/landmarks
   - cover or enemies placed where they no longer support the larger spaces
   - rewards or field events that are visible but not worth diverting for
   - stale helper coordinates
5. After first-route route-following, resume Motel stealth identity and notification/reward UI work.

Acceptance:

- The expanded route feels larger without changing actor scale, camera zoom or
  prop scale.
- Original region layout identities remain recognizable.
- Expansion does not create excessive empty walking time or unreadable routes.
- A normal player can still understand spawn -> objective -> Motel exit through
  visible world composition and markers.
- No surprise East Road or Motel exit warps.
- Command Center and this file remain in sync after the package.
