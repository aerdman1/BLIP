# BLIP Vertical Slice Design

Status: current route-connected top-down arena foundation plus first real objective/reward differentiation pass, corrected combat collision pressure, active first-route clarity pass, and an experimental Tripo CONTACT-47 model import.

The current world is large enough for a focused 15-25 minute playable route now. It can become a 30-45 minute vertical slice only through better combat pacing, stronger rewards, secrets, objectives, and a few targeted layout adjustments. Do not expand every map or convert the route into one giant Phaser scene.

## Region Map

| Region | Purpose | Objective | Traversal | Combat | Secret / Reward | Connection | State |
|---|---|---|---|---|---|---|---|
| Miller Surface | Onboarding, exploration, first cache read | Recover the Willow cache and open the road east | Road east into the Motel Circuit breach | Pulse Carbine basics plus a small weapon-switching lesson | Pulse Resonance mutation | Miller road exits toward Motel Circuit | Playable; gentler onboarding math and no early elite beam, but AI still stalls after breach opens |
| Motel Circuit | Scanner avoidance and Phase Shift pressure | Infiltrate the scanner grid and disable the motel circuit | Parking-lot route into town streets; Signal Tube still later | Arc Blade parry timing, wardens, turret/scanner pressure | EMP Burst and Phase Shift onboarding | Motel access road feeds town | In development; scanner beams/alerts live, needs more legitimate arrivals before Town can be judged |
| Chagrin Falls Town | Cover-based street combat and route choice | Destroy the River Road scanner tower | Town gate / bridge path toward the orchard | Cover lanes, turret/warden/sniper pressure, alternate approaches | Ghost Protocol Scout upgrade | Town edge road leads to orchard route | Playable; dedicated Chagrin Falls HD asset pack still later |
| Patterson's Orchard | Traversal puzzle and route memory | Redirect the Orchard Gravity Well, reach the raised ridge and break the Maze Heart | Playable Gravity Well launch to raised ridge | Recall Disc crowd-control lanes and Maze Heart pressure | Carbine Ricochet mutation | Orchard breach opens to Signal Storm | Playable first traversal beat; deeper puzzle combinations deferred |
| Signal Storm | Memorable final encounter | Break the Storm Classifier and refuse classification | Corrupted passage arrival; no menu return during route | Final mix of switching, stagger, parry, overdrive | Refuse the Label story unlock | End of current slice | Playable finale base; larger boss presentation later |

## Systems Status

- Playable: connected top-down route chain, single-save flow, dev region warps, three-weapon foundation, fast weapon switching, route-state persistence, named region goals, Phase Shift with restrained trailing echoes, distinct enemy roles, major reward banners/save persistence.
- Route hardening: area transitions require standing inside the actual charged breach for a short dwell. Broad road/exit rectangle auto-warps are intentionally removed because they could feel like surprise teleports near East Road.
- Tested: combat hitboxes/contact pressure now punish idle play, HD sprite scaling no longer shrinks physics bodies, and the combat validation suite proves every enemy archetype can move or remain intentionally rooted and can be killed by real player projectiles.
- AI status: AI campaigns are useful playtest evidence, not the production deploy gate. The latest public JSON is a focused 6-run Miller → Motel sample with 0 technical soft-locks, 1 death and 0 arrivals. It confirms route-following after Miller breach opens still needs work before a longer first-route/full-route campaign will be meaningful.
- In development: Miller → Motel route-following after breach open, Motel → Town route clarity, stealth alert readability, Orchard Gravity Well polish, weapon-specific secrets, richer final encounter presentation.
- Character art status: `/Users/aerdman/Downloads/beige+robot+3d+model.glb` was optimized into `public/assets/characters/contact47-tripo.glb` and rendered into eight transparent full-body PNG facings. The old HD CONTACT-47 sprite remains fallback. The imported GLB has a skin but no animations, so walk/shoot animation is a future animation-retargeting pass.
- Planned later: Signal Tube, Phase Door, Scout Contraption art/device pass, underground Scout shelters.
- Deferred: Signal Rail, full mutation trees, equip/store/salvage economy, large map expansion, complex dungeon layouts.
- Backlog source of truth: `MASTER_GAME_BACKLOG.md` owns current status counts, critical path, cuts, deferred work and decision-needed items. Command Center mirrors the summary.

## Guardrails

- Keep the route as separate top-down arena maps unless there is a strong technical reason to merge.
- Add only the smallest enemy/hazard roles that improve the current weapons or Phase Shift.
- Every traversal mechanic must have safe spawn points, collision, camera handling, save/load behavior, and touch/controller support.
- Command Center is the live dashboard for this plan; update `src/game/data/commandCenterData.ts` when a system moves from planned to playable.
