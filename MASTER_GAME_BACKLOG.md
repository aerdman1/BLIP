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
Menu, shared player state across handoffs, three weapons, fast switching, Boost,
an explicit BOOST meter, restrained trailing boost echoes, a capped fading cyan hover-fire ground trail, named region goals, a clearer central mystery around CONTACT-47 being classified by the Interpretation Engine, hardened charge-plus-action route objectives, centralized Pulse/Arc/Kinetic/Blast damage affinities, tactical enemy
roles, enemy pursuit/stuck-recovery hardening, HD visual scale decoupled from
world-space hitboxes, safe marker resolution for authored spawns/exits, a first
Gravity Well beat, schematic-first expanded layouts across all five route
regions, a gameplay-design/content pass that gives each named area a purpose,
authored field-event reward pockets with visible purpose-labeled markers, early
weapon prototypes, optional ambush hooks, a first subtle discovered-area lighting
read, a tightened pickup-label/equip-message path, a weapon feel pass across
Pulse/Arc/Recall, Orchard Crop Circle gating through the
Gravity Well/raised-ridge step, a first meaningful route progression chain
(Miller mutation choice, Motel Phase Boost+, Town Scout Relay Pylon, Orchard
Scan Memory secret and Signal Storm relay gate), two first-pass Miller Boost washout crossings,
CRT scanlines defaulting off, CONTACT-47 aura defaulting off with a Settings toggle, settings screen filters that apply to the active top-down world camera, additive
environment-depth dressing with biome-specific ground wear, layered silhouettes,
foreground framing, built-roof service details, named-area identity dressing and
data-driven elevation zones with stronger follow-camera offset/zoom, staged Signal Storm phase labels, generated map
schematics, AI Lab smoke harness and focused campaign evidence, HD top-down renderer, the Tripo
CONTACT-47 eight-facing sprite fallback pipeline, and a main-menu radar hero that uses the Tripo CONTACT-47 render.
Miller now also has a playable cold-start crash-site onboarding beat: CONTACT-47 wakes at the impact site, reads Scout/kid evidence, scans Chip's Spark Line, recovers the first kit, sees a centered story reward card, and only then releases the first enemies.
The old Wardrobe / Signal Skin system is cut from active gameplay; legacy save
fields remain only for compatibility, cache rewards no longer roll skins, and
future Scout rewards should be explicit upgrades, abilities, lore or route tools.

The game is not yet a strong vertical slice. The biggest current gaps are:
manual feel review on the newly expanded purposeful layouts, objective/route
completion on short AI region runs, region variety still needing live encounter polish, incomplete
notification/reward consolidation, shallow loot presentation despite larger cache-like pickup art and stronger first-pass projectile/Arc VFX, progression
mutations that need testing/polish, crash-site onboarding needing manual tone/pacing review, weak full-route AI completion evidence, and
a finale that still needs a more authored climax despite the new relay gate. The latest automated sweep
added stricter `qa:maps` structural checks plus `qa:route` runtime checks for HD
rendering, objective copy, route-open guidance, pressure cleanup, Motel scanner
identity/offline cleanup, Ghost Check-In stealth-bonus gating, Orchard Gravity Well gating and Signal Storm finale
copy. Latest public AI evidence is `first-three-route-regression-v8`: 6
Miller→Motel→Town attempts, 6/6 completions, 0 deaths and 0 soft-lock-risk
stalls after nearest-useful route-marker targeting, objective-marker stuck
recovery and fair expanded-route timing. Reports include per-run time budgets,
objective target labels, decision traces and stall samples. Orchard-focused
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
| COMPLETE | 36 |
| PARTIAL | 59 |
| PLANNED | 16 |
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
4. Progression/motivation spine: verify the new Miller mutation choice, Motel
   Phase Boost+, Town Scout Relay Pylon, Orchard Scan Memory secret and Signal
   Storm relay gate in real play and focused automation.
5. Crash Site Onboarding polish: the playable first pass is live in Miller. Do
   a manual tone/pacing pass on the wake marker, Spark Line scan, first-kit
   reward modal and delayed enemy wake, but do not rebuild it unless playtesting
   proves it drags.
6. AI Player Lab safety and route guidance: continue before/after comparisons
   using visible perception only. The focused first-three sample
   `first-three-route-regression-v8` now reaches Town 6/6 with 0 deaths and 0
   soft locks; full-route and broader regression evidence are still pending.
7. First-route clarity: Miller -> Motel -> Town must remain understandable
   without hidden navigation. Current focused evidence is strong enough to move
   on to broader route regression and subjective live-feel review.
8. Unified notification and reward UI: one objective card, one activity feed,
   centered blocking read-and-continue major reward cards, no overlapping popups.
9. Major reward presentation: clear name, type, rarity/importance, behavior,
   equip/activate where relevant, and no generic diamond for important rewards.
10. Meaningful progression: test/polish the first live behavior hooks, then add
   additional mutations tied to region rewards, Scout caches, or secrets.
11. Motel identity: scanner/stealth section must feel intentionally different,
   with Phase Boost onboarding and combat fallback.
12. Town identity: cover routes, at least two approaches, hostile structure, and
   stronger Chagrin Falls exterior-landmark read.
13. Orchard identity: deepen the existing Gravity Well into a compact puzzle and
   make the raised ridge useful beyond a label.
14. Signal Storm finale: named multi-stage climax that combines weapons, Phase
   Shift, hazards, and reward/completion feedback.
15. Focused AI/regression campaigns after the layouts are stable; extended
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
| Dev region warps | COMPLETE | `ShellUI.devMode()`, `#menu-dev-warps`, `tests/smoke.spec.ts` | Local/test/god warps work and now render as a compact bottom-left DEV WARPS rail instead of full main-menu entries | Production hidden by design | P1 | Production default has no public warp buttons |
| Desktop/controller/touch input | PARTIAL | `InputSystem`, `TouchInput`, `PadBindings`, E2E | Core mapping exists; Boost is held across keyboard/controller/touch, iPad touch controls use separated FIRE/BOOST/SCAN/WPN/ECHO/ACT buttons, keyboard hint chips hide on touch, and tablet layout has a smoke regression | Needs more controller gameplay-specific tests | P1 | Add tests for weapon switch, menu/pause on touch/controller |
| Safe spawns/transitions | PARTIAL | arena spawn/breach markers, `nearestWalkableWorld()` | Main route transitions work in E2E; authored player/enemy/exit markers resolve to nearest walkable tile | Invalid spawn/soft-lock coverage is still shallow | P0 | Add invalid spawn and repeated-transition suite |
| Performance/memory repeated transitions | MISSING | no long-run evidence | Basic build runs | No memory-leak campaign yet | P2 | Overnight transition loop with browser restarts |
| More seamless geography | PLANNED | design docs | Separate scenes are retained | Needs better visual continuity/routes | P2 | Routes feel like roads/trails/gates, not level select |
| One giant scene rewrite | CUT / NO LONGER APPLICABLE | guardrails | Not desirable now | Would risk working maps | CUT | Keep separate Phaser regions |

### 2. Route Clarity and Objectives

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Named region objectives | COMPLETE | `src/game/data/regionGoals.ts` | Each region has named objective/reward copy | Some objectives still operate as charge loops underneath | P0 | HUD and Command Center show named goals |
| Visible progress | PARTIAL | HUD node stats, breach feedback, debug `objectiveActions`, field events | Node/route state visible; route opens require charge plus real progress actions; enlarged Miller/Town/Orchard thresholds now better match authored field-event pacing | Too much still reads as generic node charge | P0 | Players/AI know what action progresses objective |
| Completion feedback | PARTIAL | `awardRegionReward()`, banners/toasts, `RewardUI`, `UIScene` | Reward and route-open messages exist; center HUD callouts queue one at a time; major reward/trophy/weapon cards pause gameplay in a centered read-and-continue modal | Shell toasts/HUD banners still need one shared manager/showcase | P0 | Unified notification manager |
| Reward preview/delivery | PARTIAL | region goals, rewards save, weapon pickup labels, `RewardUI` | Rewards are named/persisted and important weapon drops show name/role in a blocking acquire card; random health drops no longer carry stale weapon ids | Presentation is not yet comparable/equippable enough | P0 | Major reward card shows effect and why it matters |
| Forward route clarity | PARTIAL | route signs, breach dwell, latest AI JSON, `tests/route-readiness.spec.ts` | Broad surprise warp removed; route markers simplified; visible field-event markers give players/AI more local goals; objective arrows now choose the nearest useful unvisited route marker instead of sending players backward to skipped signs; `first-three-route-regression-v8` reached 6/6 Town arrivals with 0 deaths/soft locks; Orchard-focused AI reaches 6/6 after Gravity Well objective-priority fix | Full-route evidence still missing; failed lower-road and Motel Check-Out breadcrumb experiments were reverted after worse samples | P0 | Focused first-three route campaign improves Motel/Town arrivals |
| No endless combat after complete | COMPLETE | `quietRoutePressure()`, `tests/route-readiness.spec.ts` | Enemies/bolts clear after breach opens; route-clear group mutation bug fixed by snapshotting enemy removal and using explicit live-enemy counts | Continue regression coverage | P1 | E2E route-open state has no endless spawns |
| Full-route AI completion | MISSING | `public/ai-playtest/latest.json` | AI harness exists; latest public sample is `first-three-route-regression-v8` at 6/6 Miller→Motel→Town completions with 0 deaths and 0 soft-lock-risk stalls; Orchard-focused sample remains 6/6 | No full-route completions in current shipped evidence | P1 | Overnight campaign after route clarity |

### 3. Region Gameplay Identities

| Region / Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Region scale/layout first pass | PARTIAL | `src/game/data/sweepArenas.ts`, `SWEEP_ROUTE_BEACONS`, `SWEEP_MOTEL_SCANNERS`, `SWEEP_GRAVITY_WELLS`, `MAP_SCHEMATICS.md`, `scripts/validate-map-data.mjs`, `tests/route-readiness.spec.ts` | All five route regions have schematic-first larger authored layouts, named-area purpose passes, data-driven helper coordinates, regenerated schematics, strict static map validation and runtime route-readiness coverage | Only subjective live feel review remains; first-route AI still needs tuning | P0 | Travel feel, cover placement and reward excitement feel good enough to tune encounters |
| Map schematics | COMPLETE | `MAP_SCHEMATICS.md`, `docs/map-schematics/*.svg`, `scripts/generate-map-schematics.mjs` | Current arena data generates top-down planning SVGs plus coordinate notes for all five regions | Regenerate after coordinate changes | P0 | Future AI can inspect route layouts without rereading old prompts |
| AI safety after layout pass | PARTIAL | `scripts/ai-player-campaign.mjs`, `tests/ai-player-lab.spec.ts`, `debugAiPerception()` | Personas use visible perception snapshots, labeled objective hints, visible field-event markers, scanners, enemies and pickups; behavior fights/evades visible threats before resuming objectives; campaign runner uses process-specific strict preview ports, per-run time budgets and objective-marker stuck recovery; reports include decision traces/stall samples; Orchard Gravity Well routing is fixed in focused samples; first-three focused sample is 6/6 | Broad overnight/full-route campaign still pending | P1 | Continue comparing same personas/seeds using visible perception only |
| Miller Surface scale expansion | PARTIAL | `surface-z1`, `regionGoals.ts`, current route signs, `fieldEvents`, `weaponSpawns`, `boostGaps`, `MAP_SCHEMATICS.md` | Layout has Field Track, Willow Trail, Cache Grove, Old Mill Spur log/cache pocket, Substation Overlook power-shortcut beat, lower recovery lane shortcut, Scout Shelter pocket, early Arc/Disc prototypes, two optional red Boost washout crossings and far-east Motel Breach | Needs manual travel-time/readability review and possible terrain-detail/cover adjustments | P0 | Main route and optional branches make sense, same actor/prop/camera scale, screenshots and travel-time comparison |
| Miller Surface gameplay | PARTIAL | `surface-z1`, `regionGoals.ts`, `fieldEvents`, `first-three-route-regression-v8` | Preserved layout, named Willow cache, early combat, gentler onboarding math, no early elite beam, authored optional rewards/ambushes; route arrows no longer pull back to skipped signs; focused first-three sample reaches Town 6/6 | Subjective travel/readability review remains | P0 | New-player can complete Miller and enter Motel |
| Motel Circuit | PARTIAL | `SWEEP_MOTEL_SCANNERS`, expanded `circuit-z2`, `fieldEvents`, `MAP_SCHEMATICS.md`, `first-three-route-regression-v8`, `tests/route-readiness.spec.ts` | Layout has scanner main route, optional Room Row stealth branch, Boost-only Maintenance Pocket, Pool Courtyard crossing, Service Lot fallback loop, drainage shortcut, Motel Sign Ledge, early Safe Battery recovery, early Arc/Disc prototypes and Town breach. Ambiguous scanner/gate/circuit labels are removed; Scanner Core is the objective anchor; scanner endpoints use hardware sprites; HUD says scanners offline instead of gate wording; active beams read red; open-route scanners disappear from perception/visual state; all-scanners-offline/no-alert clears award Ghost Check-In | Needs live stealth feel review and broader route regression | P0 | Personas use Boost and reach Town legitimately |
| Chagrin Falls Town | PARTIAL | expanded `town-z3`, stadium biome, `fieldEvents`, `weaponSpawns`, `MAP_SCHEMATICS.md` | Layout has Main Street, Neighborhood Block/Market Alley upper route, Bridge Overlook sniper/cache beat, River Walk lower shortcut, River Road Tower objective, Stadium Road recovery space, stadium back alley, early Arc/Disc prototypes and Orchard Gate | Needs dedicated Chagrin Falls asset identity and live cover/readability review | P1 | Two readable approaches and cover combat are obvious |
| Patterson's Orchard | PARTIAL | `SWEEP_GRAVITY_WELLS`, expanded `maze-z4`, `fieldEvents`, `MAP_SCHEMATICS.md`, `orchard-ai-gravity-priority-v1` | Layout has tractor lane, Lower Creek secret puzzle pocket, required Gravity Well launch, Raised Ridge reward/switch step, West Rows Recall lane, East Rows pressure lane, Scout Shelter loop, storm-fence shortcut and Crop Circle gate. Focused AI now completes Orchard 6/6 with no soft locks/deaths | Gravity Well object/enemy/projectile redirection is still deferred; dormant Maze Heart boss gate is cut from the current route so Orchard stays traversal-focused | P1 | Gravity Well puzzle has purpose, reward, reset safety |
| Signal Storm | PARTIAL | expanded `anomaly-01` waves, Storm Classifier copy, `fieldEvents`, `MAP_SCHEMATICS.md` | Finale arena has entry recovery lane, Classifier Core phase-one objective, a hard relay-wing scan gate before later waves, North Rift phase-three anchor, coil pockets, pressure pockets, recovery pockets, field rewards and named phase banners | Needs authored boss behavior/presentation | P1 | Finale feels distinct from normal waves and completes slice clearly |

### 4. Level Design and World Depth

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Multiple routes | PARTIAL | arena rooms/halls, discovered-room washes | Some route alternatives exist and unvisited HD rooms start subtly dimmer until entered | Not always readable as choice; needs live feel review | P2 | At least Town has two legible approaches |
| Bridges/hills/ridges/overlooks | PARTIAL | town bridge concept, Orchard ridge, `SweepElevationZone`, `tests/smoke.spec.ts` | All five route regions now have data-driven rise/drop/roofline/creek/rift zones with visible ground cues and stronger follow-camera offset/zoom; Orchard ridge beat exists | Manual feel review still needed; full 3D elevation/collision states remain deferred | P1 | Controlled 2.5D elevation with safe collision and no route rewrites |
| Lower paths/ravines/underground | PLANNED | design docs | None required now | Not implemented | P3 | Add only when route needs depth |
| Hidden Scout shelters | PLANNED | Scouts/rewards/docs | Scout lore exists | No authored shelters | P2 | One optional shelter later in slice if useful |
| Purposeful structures / landmarks | PARTIAL | `TdTerrain.placeLandmarks()`, authored field events | Random flat walk-through landmarks no longer spawn in central route spaces; decorative landmarks are edge-biased, while important objects should be authored | Existing authored set pieces still need manual readability/collision review | P1 | Every visible central structure is clearly decorative, interactive, blocked, or tied to a reward/objective |
| Boost washout crossings | PARTIAL | `boostGaps`, `SweepScene.buildBoostGaps()`, `tests/smoke.spec.ts`, `MAP_SCHEMATICS.md` | Miller has two red corrupted cracked gaps that block walking and allow held-Boost crossing; schematics mark them | Needs live readability/timing review before copying to other regions | P1 | Cracks look dangerous, branch naturally, and never hard-block the main route |
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
| Named mutation rewards | PARTIAL | `upgrades.ts`, region rewards, `SweepScene`, `RewardUI` | Miller now pauses gameplay for a real three-card mutation choice: Overchain Capacitor, Arc Reprisal or Recall Conduit. Rewards persist and behavior hooks are live: charged Pulse chain, Arc parry shockwave, Recall return trail | Needs focused tests, HUD clarity and more mutations | P0 | Each major reward changes playstyle |
| Two mutations per weapon | PARTIAL | `SweepScene` mutation hooks | One strong hook exists for each weapon family | Still short of two meaningful mutations per weapon | P0 | Six behavior-changing mutations |
| Progression chain | PARTIAL | `regionGoals.ts`, `upgrades.ts`, `SweepScene` field events | Route rewards now form a concrete chain: Miller mutation choice, Motel Phase Boost+, Town Scout Relay Pylon, Orchard Scan Memory behind the Gravity Well/Scout Shelter chain, Signal Storm Refuse the Label payoff | Needs full-route validation, HUD clarity and stronger story ceremony | P0 | Each region grants/reveals useful future-facing change |
| Full mutation trees | DEFERRED | docs | Not needed for demo | Too broad now | P3 | Later full-game system |
| Full crafting economy | DEFERRED | scope-control skill | Workbench exists | Full crafting would distract | P3 | Later only if progression needs it |

### 7. Loot and Reward Presentation

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Basic resources/caches | COMPLETE | `RewardSystem`, `rewards.ts` | Caches, shards, archive, trophies exist | Some charm rewards may still feel toy-like | P2 | Reward archive remains functional |
| Major reward cards | PARTIAL | toasts/modals, region goals, `RewardUI`, pickup labels, `sweepTextures.ts` | Name/type/description appears, major reward modals pause gameplay, completion bursts batch into one grouped card where possible, weapon pickups/equip messages resolve from the actual weapon id, health drops no longer have stale weapon ids, and pickup art is larger/glossy signal-vault-like instead of a cartoon chest | Not yet a single polished acquire/equip flow; final high-res loot art still needed | P0 | Major reward card is unmistakable and non-overlapping |
| Comparison/equip | PARTIAL | `RewardUI`, `rewards.equip()` | Cosmetic equip exists | Gameplay reward compare/equip shallow | P1 | Simple acquire/activate/equip flow |
| Store/salvage | DEFERRED | docs | Duplicate dust exists | Full inventory not needed now | P3 | Decide later |
| AI ignored reward tracking | PARTIAL | AI JSON loot fields | Loot seen/ignored counted | Current evidence is short and route-biased | P1 | Overnight report ranks ignored rewards |

### 8. Phase Boost

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Held boost movement | COMPLETE | `BlipCraft.move()`, `InputSystem`, `TouchInput`, `UIScene`, `tests/smoke.spec.ts` | Hold SHIFT/RB/touch Boost to surge, drain the boost meter, regenerate after release, leave restrained echoes and get brief i-frames. Top-down HUD now shows explicit BOOST full/empty feedback | Needs live tuning for speed/drain/regen feel | P0 | Boost drains, moves faster, regenerates and does not cover the player with huge ghost art |
| Hover-fire ground trail | COMPLETE | `SweepScene.updateHoverTrail()`, `tests/smoke.spec.ts` | Moving CONTACT-47 stamps a capped, fading cyan ground residue so recent travel path is visible | Needs manual visual taste review for brightness/duration | P1 | Trail shows where the player has been without obscuring combat |
| Keyboard/controller/touch input | PARTIAL | `InputSystem`, `TouchControls`, pad binding, `tests/smoke.spec.ts` | Inputs exist; touch cluster was cleaned up for iPad with distinct FIRE/BOOST/SCAN/WPN/ECHO/ACT buttons and non-overlap regression | Controller-specific gameplay tests remain incomplete | P1 | Input tests for all modes |
| Scanner interaction | PARTIAL | Motel scanner code, `SWEEP_MOTEL_SCANNERS`, `tests/route-readiness.spec.ts` | Holding Boost through a beam disables scanner/charges objective. Labels explicitly end in SCANNER; endpoints use scanner hardware sprites; active beams are red hazards; disabled scanners hide after the route opens so they do not look like random props. Ghost Check-In rewards all-scanners-offline/no-alert clears and debug route-open cannot trigger it | Tutorial/safe-zone presentation is still shallow | P0 | Player/AI uses Boost in Motel |
| Projectile/barrier/secret interactions | PARTIAL | `BlipCraft`, `SweepScene.updatePhaseBoostPlus()` | Phase Boost+ clears nearby hostile bolts while boosting; scanner crossing works | No phase doors/barrier secrets yet | P2 | Phase door/secret later |
| Weapon follow-up interactions | PLANNED | docs | Old Phase-strike skin hook is cut from active gameplay | Needs a real weapon/ability system if revived | P2 | Weapon-specific follow-up pass |

### 9. Traversal and Puzzle Systems

| System | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Gravity Well | PARTIAL | `buildRegionSetPieces()`, `tryGravityWell()`, `maybeCompleteTraverseObjective()`, Orchard field events | Orchard launch to ridge is playable, gates Crop Circle completion, and unlocks the Scout Shelter/Scan Memory secret chain | No object/enemy/projectile redirection yet | P1 | Puzzle has reset, safe spawn, reward |
| Signal Tubes | PLANNED | docs only | Concept retained | No implementation | P3 | Add only when route needs conduit travel |
| Phase Doors | PLANNED | docs only | Concept retained | No implementation | P2 | Use for secrets/frequency gates later |
| Signal Rails | DEFERRED | docs | Concept retained | Not needed now | P3 | Later spectacle/traversal |
| Scout Contraptions | PARTIAL | Scout rewards/lore, Town Orchard Gate field event | Story-connected tech exists and Town deploys temporary Scout Relay Pylons during the Orchard Gate defense beat | No reusable authored puzzle device yet | P2 | One device if it helps slice pacing |
| Puzzle reset/soft-lock prevention | MISSING | no focused tests | None yet beyond simple well | Needs architecture before complex puzzles | P1 | Puzzle can reset/retry safely |

### 10. Enemies and Encounter Variety

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Distinct enemy roles | COMPLETE | `SWEEP_ENEMIES`, `SweepEnemy`, `DamageAffinity.ts`, `bestiaryData.ts` | Core enemies plus CIPHER, GRAVITON, UNDERTOW, DECOY and DORMANT are live with centralized affinities, state-specific weaknesses/resistances, readable telegraphs and per-level roster intent | Needs encounter tuning and final custom enemy art for the five new tactical roles | P1 | Roles are readable and counterable |
| Enemy pursuit reliability | COMPLETE | `SweepScene.buildEnemyPathField()`, `enemyDriveTarget()`, `SweepEnemy.updateStuckRecovery()`, `tests/combat-enemy-validation.spec.ts` | Drones use a walkable-tile distance field when line-of-sight is blocked; ranged enemies keep movement while firing; stuck bodies recover or snap to a safe path target after repeated failures | Longer AI campaign still needed for tuning confidence | P0 | Enemies do not freeze against walls or become unreachable blockers |
| Enemy killability / hitbox truth | COMPLETE | `ActorRig.collisionPx`, `tests/combat-enemy-validation.spec.ts` | HD sprite scaling no longer shrinks physics bodies; isolated combat probes no longer trigger route reward modals; every enemy archetype, including split children and new tactical enemies, is proven killable by real player projectiles | Continue tuning combat feel and shield readability | P0 | Combat validation remains green |
| Shield/charger/support/mine roles | PARTIAL | warden/diver/turret plus new tactical enemies | Some tactical variety exists: CIPHER delayed zones, GRAVITON displacement field, UNDERTOW burrow/eruption, DECOY pickup ambush and DORMANT wreck ambush | No support/mine-layer enemy; final balance/art pass pending | P2 | Add only if region needs it |
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
| Scanner beams/alerts | PARTIAL | `buildMotelScanners()` | Beams, labels, alert fallback exist | Alert/investigation/safe zones shallow | P0 | Motel feels like stealth/Phase Boost, not arena |
| Combat fallback | COMPLETE | alert spawns pressure, no soft fail | Detection does not end run | Needs tuning | P1 | Detection changes encounter but does not soft-lock |
| Stealth reward | PARTIAL | `maybeAwardMotelStealthBonus()`, route readiness tests | Ghost Check-In bonus awards shards for all-scanners-offline/no-alert Motel clears | Needs stronger presentation and broader manual proof | P1 | Optional reward for cleaner infiltration |
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
| Intro/finale payoff | PARTIAL | Main menu, Miller crash-site events, finale copy, `tests/smoke.spec.ts` | Miller has a playable non-combat crash recovery/first-kit beat before enemies wake; finale has identity copy and relay gate | Needs manual tone/pacing review and stronger finale authoring | P2 | Stronger opening/finale once gameplay stable |
| Willow naming | NEEDS DECISION | Will/Willow both appear | Could be nickname or mismatch | Needs canonical decision | P2 | Decide Will vs Willow and update docs/data |

### 15. Tone and Maturity

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Mature tone target | COMPLETE | `TONE_PASS_NOTES.md`, Command Center art direction | Direction documented | Must remain enforced | P1 | No cute/toy drift in new work |
| Combat force | PARTIAL | mechanical rupture, scorch, stronger hit pressure | Sparks/scorch/shake improved | Weapon-specific impact polish remains | P2 | Hits feel forceful without clutter |
| Atmosphere/environment damage | PARTIAL | HD biomes, fog, shadows, `TdTerrain.buildGroundDepth()`, `TdTerrain.buildSolidSurfaceDetails()`, `SweepScene.decorateNamedArea()`, `SweepElevationZone` | Biome-specific ground wear, cracks, grates, row marks, edge silhouettes, foreground framing, rooftop/parapet/service detail, named-area dressing and camera-reactive elevation zones are live without changing routes/collision; ambiguous Motel/Town car landmark is no longer auto-placed | Needs manual visual taste pass, stronger damaged buildings/vehicles/emergency cues and dedicated town asset pack | P2 | Tone pass per region |
| Optional blood setting | DEFERRED | prompt only | Not needed for mechanical enemies | Organic enemies not current focus | P3 | Decide only if organic enemies arrive |

### 16. UI and Notification System

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Objective card/HUD | PARTIAL | `UIScene`, HUD events | Region label/objective visible | Needs persistent priority design | P0 | Objective always readable, no overlap |
| Popup/toast/banners | PARTIAL | `ShellUI`, `RewardUI`, `SweepScene`, `UIScene` | Routine toasts dedupe and shrink; combat toasts cap at two with shorter routine dwell; important route/alert toasts stay readable; major reward/trophy/weapon cards queue one at a time as centered blocking modals; routine region entry no longer fires a giant center banner | Independent HUD/banner systems still need one manager/showcase | P0 | Shared notification manager |
| Major reward notification | PARTIAL | reward banners/toasts, weapon pickup flow, `tests/smoke.spec.ts` | Major rewards now pause gameplay in a centered read-and-continue modal, reveal one at a time, and avoid overlapping world signs or HUD text; important weapon pickups show a queued acquire card with weapon role; routine health pickups do not report stale weapon ids | Acquire/equip/comparison flow still shallow | P0 | One major reward at a time |
| Notification developer showcase | MISSING | no showcase | None | Needed after manager | P2 | Test all notification classes |

### 17. HUD, Menus, Settings, Accessibility

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Main/pause menu cleanup | COMPLETE | menu has Continue/New Game; pause Quit | Reset Save removed from in-game menu | None known | P0 | Smoke test |
| Region labels | COMPLETE | `UIScene` | Area name at top HUD | None known | P0 | Region names match routes |
| Phase cooldown/mutation HUD | PARTIAL | core HUD exists | Weapon visible | Mutation/cooldown clarity weak | P1 | Cooldowns/upgrades visible enough |
| Screen filters / player light | COMPLETE | `Settings.ts`, `ScreenFilter.ts`, `ShellUI.ts`, `SweepScene.ts`, `BlipCraft.ts`, `tests/smoke.spec.ts` | CRT scanlines default off, CONTACT-47 personal aura defaults off with a Settings toggle, filter dropdown affects the title and active top-down world camera, saved 0-100 intensity slider updates live, gameplay strength is capped for readability, and None clears the pipeline | Canvas renderer fallback no-ops shader filters by design | P1 | Smoke verifies filter pipeline and intensity changes in SweepScene |
| Accessibility settings | PARTIAL | audio/shake/settings exist | Core settings work | Blood toggle N/A; aim assist/readability sparse | P2 | Add only when feature exists |
| Production test warps | NEEDS DECISION | hidden by current dev gate | Default hidden is correct | Tester-mode option undecided | P2 | Decide if a production QA URL should expose warps |

### 18. CONTACT-47 Character

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Tripo GLB import | COMPLETE | `public/assets/characters/contact47-tripo.glb` | Source model in repo | GLB not animated | P1 | Asset loads/fallback works |
| Eight facings rendered | COMPLETE | eight PNGs plus sheet | Directional aiming works | Needs visual QA per angle | P1 | Sprite faces aimer cleanly |
| Main menu CONTACT-47 hero | COMPLETE | `ShellUI.buildHero()`, `src/style.css` | Main menu radar hero uses the Tripo CONTACT-47 render when loaded, with old art fallback | Needs visual QA across screen sizes | P1 | Home screen no longer shows the old tiny procedural CONTACT-47 as the primary hero |
| Hover thrusters | PARTIAL | `TdActors.ts` | Low-hover read exists | Needs final polish against all directions | P2 | Thrusters align and do not overlap body badly |
| Collision separate from visual | COMPLETE | `ActorRig.collisionPx`, combat validation tests | Gameplay hitboxes stay world-space honest even when HD sprites are scaled | Continue tuning feel only | P0 | No visual/collision mismatch complaints |
| Full skeletal animation | DEFERRED | no clips | Not current blocker | Retargeting would be expensive | P3 | Revisit only with clean clips |

### 19. Art and Asset Pipeline

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| HD top-down region assets | PARTIAL | `public/assets/topdown` | z1/z2/z4 packs exist, town uses hard-edge HD vocabulary | Dedicated town pack missing | P1 | No pixelated fallback maps in route |
| Dedicated Chagrin Falls pack | PLANNED | docs | Need recognized town identity | Not built | P2 | Town landmarks/streets read immediately |
| Environment-depth dressing | PARTIAL | `src/game/topdown/TdTerrain.ts`, `src/game/scenes/SweepScene.ts`, `src/game/topdown/TdBiomes.ts`, `src/game/data/sweepArenas.ts` | Shared HD renderer adds region-specific ground wear, medium/tall edge silhouettes, foreground framing, roof/parapet/service-equipment details, local dressing around route-beacon names and camera-reactive elevation zones so signs better match their areas; unclear car landmark removed from auto-placement; default camera is pulled back for more readable scale | Manual camera-distance review still needed; future art pack should replace procedural dressing where it matters | P1 | Every named area has visible local identity without blocking gameplay readability |
| Enemy/boss/hazard assets | PARTIAL | procedural/bestiary data | Current enemies render and the five new tactical roles have non-pixelated procedural fallback sprites | CIPHER, GRAVITON, UNDERTOW, DECOY and DORMANT need final custom HD replacement art; boss/finale asset polish still pending | P2 | Important enemies not placeholder-looking |
| Traversal device assets | PLANNED | Gravity Well procedural | Well exists | Tubes/doors/rails/contraptions missing | P3 | Add with mechanics |
| Transparent PNG pipeline | COMPLETE | character PNG assets | Tripo output is transparent | Maintain asset checks | P1 | No checkerboard backgrounds |

### 20. Weapon and Combat Visual Polish

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Pulse polish | PARTIAL | pulse bolts/charged fifth shot/projectile trail | Faster fire, bigger charged-shot feedback, stronger muzzle response and brighter laser-slug trail are live | Needs held charge/recoil/audio identity | P2 | Pulse feels distinct and forceful |
| Arc polish | PARTIAL | graphics arc/parry text/slash wedge | Wider arc, stronger knockback, always-on parry shockwave and a heavier slash wedge are live | Needs combo/dash-slash depth and distinct audio | P2 | Arc feels like melee, not a line effect |
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
| JSON/Command Center report | COMPLETE | `public/ai-playtest/latest.json`, Command Center | Report displays/export link; latest public sample is `first-three-route-regression-v8` at 6/6 Miller→Motel→Town completions with 0 deaths and 0 soft-lock-risk stalls; reports include per-run time budgets, decision traces and stall samples; Orchard-focused `orchard-ai-gravity-priority-v1` remains 6/6 | No full-route completions in current shipped evidence | P1 | Command Center loads JSON |
| 500-run campaign | MISSING | no evidence | Not run | Deferred overnight until route/objective clarity improves | P1 | 500 meaningful runs with restarts and summary |
| Screenshot review | PARTIAL | screenshot paths in JSON | Paths recorded | Not all evidence committed/captured for production | P2 | Representative visual review notes |

### 23. Automated Testing

| Item | Status | Evidence | Works | Missing / Risk | Priority | Acceptance / Tests |
|---|---|---|---|---|---|---|
| Typecheck/build/E2E | COMPLETE | last run passed 6/6 | Deploy gates pass | Keep current | P0 | `npm run qa:full` |
| Route transitions/save | COMPLETE | `tests/smoke.spec.ts` | Main chain covered by debug route | Needs natural-route tests | P1 | Natural completion suite |
| Weapon behavior tests | PARTIAL | E2E switch only | Switching covered | Attack/parry/return not fully covered | P1 | Unit/E2E for each weapon behavior |
| Phase Boost tests | PARTIAL | AI use, input code, smoke tests | Basic boost drain/regeneration and washout crossing are covered | Projectile-phasing and broader controller/touch coverage still missing | P1 | Test cooldown, hostile-bolt phasing and blocked destination |
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
- Boost: SHIFT/RB/touch Boost is now held movement with a draining/regenerating
  meter, not the old tap blink. Old "dash" language remains only for internal
  input/config ids. Player-facing copy should say Boost or Phase Boost, and
  the visual should be a restrained trail behind CONTACT-47, not a large
  tinted duplicate over the actor.
- Boost gaps: Miller has the first red corrupted cracked washout crossings as a
  live traversal trial. They are not yet global level requirements and should be
  reviewed manually before copying to Motel/Town/Orchard/Signal Storm.
- Screen filters: the settings filters are active for the title and top-down
  world camera, with a saved 0-100 intensity slider. Gameplay filters are capped
  by `FILTER_GAME_STRENGTH`; DOM HUD/menu overlays stay readable.
- Chagrin Falls Town: it is HD-rendered, but does not yet have a dedicated
  Chagrin Falls asset pack. It reuses current HD town/lot vocabulary.
- Rewards: named region rewards exist and persist, but the broader mutation and
  loot-presentation loop is not complete.
- AI campaign: the 500-run overnight campaign was not completed. Current public
  JSON is `first-three-route-regression-v8`: 6 Miller→Motel→Town attempts, 6/6
  completions, 0 deaths and 0 soft-lock-risk stalls. Reports include per-run
  time budgets, objective target labels, decision traces and stall samples.
  Orchard-focused
  `orchard-ai-gravity-priority-v1` remains
  6/6 with 0 soft-lock risks/deaths. These are route/objective-friction
  signals, not full-route completion benchmarks.
- CONTACT-47 animation: the Tripo directional sprite is acceptable for now. Full
  skeletal animation is deferred.
- Willow/Will: the docs/code use both. Decide whether Willow is Will's Scout
  frequency/callsign or an accidental rename, then normalize.

## Proposed Next Work Package

Next package: full-route regression and subjective feel review, including the new crash-site opening.

Scope:

1. Validate the playable crash-site opening:
   - CONTACT-47 wakes at a crash scar near Miller Field
   - visible Scout/kid evidence explains that the town is in danger and CONTACT-47 is not just an enemy signal
   - Chip's Spark Line scan and the first-kit recovery are clear, quick and worth reading
   - the player understands Boost/first-kit recovery before combat starts
   - then the current Miller route begins normally
2. Continue automated route-following:
   - use `first-three-route-regression-v8` as the current first-three baseline
   - preserve visible-perception-only AI behavior
   - broaden to full-route and multi-region regression before overnight campaigns
3. Keep the new automated gates green:
   - `npm run qa:maps`
   - `npm run qa:route`
   - typecheck/build/E2E as appropriate
4. Subjective play-feel review the expanded maps using `MAP_SCHEMATICS.md` and live gameplay:
   - Miller spawn -> objective -> Motel exit
   - Field Track, Willow Trail, East Road, Breach Road and Motel Breach signage
   - optional Old Mill, Substation and Scout Shelter branches
   - excessive empty walking, cover placement, enemy spacing, field-event value and cache motivation
   - Motel scanner path -> Town exit
   - Town streets/bridge/stadium-edge route
   - Orchard Gravity Well/ridge route
   - Signal Storm arena scale
5. Patch only obvious problems from the expanded pass:
   - excessive empty walking
   - unclear signs/landmarks
   - route signs, pickup labels or field-event labels that overlap in normal play
   - cover or enemies placed where they no longer support the larger spaces
   - rewards or field events that are visible but not worth diverting for
   - stale helper coordinates
6. After full-route route-following, resume deeper mutation HUD, loot comparison, and Signal Storm boss-presentation work.

Acceptance:

- The opening gives the player a reason to continue before the first fight.
- The first tool is earned through a quick readable action, not an arbitrary pickup.
- The expanded route feels larger without changing actor scale, camera zoom or
  prop scale.
- Original region layout identities remain recognizable.
- Expansion does not create excessive empty walking time or unreadable routes.
- A normal player can still understand spawn -> objective -> Motel exit through
  visible world composition and markers.
- No surprise East Road or Motel exit warps.
- Command Center and this file remain in sync after the package.
