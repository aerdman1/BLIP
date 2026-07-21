# BLIP Vertical Slice Design

Status: current route-connected top-down arena foundation.

The current world is large enough for a focused 15-25 minute playable route now. It can become a 30-45 minute vertical slice only through better combat pacing, stronger rewards, secrets, objectives, and a few targeted layout adjustments. Do not expand every map or convert the route into one giant Phaser scene.

## Region Map

| Region | Purpose | Objective | Traversal | Combat | Secret / Reward | Connection | State |
|---|---|---|---|---|---|---|---|
| Miller Surface | Onboarding, exploration, first cache read | Wake CONTACT-47, recover a Scout cache, charge the first Signal Node | Road east into the Motel Circuit breach | Pulse Carbine basics against readable drones | Early Scout marker / Phase Door candidate | Miller road exits toward Motel Circuit | Playable; needs objective polish |
| Motel Circuit | Scanner avoidance and controlled pressure | Infiltrate the motel signal field and disable its node | Parking-lot route into town streets; Signal Tube candidate | Arc Blade parry timing and scanner beam counterplay | Stealth reward behind detection route | Motel access road feeds town | Playable; stealth rules need a scoped pass |
| Chagrin Falls Town | Cover-based street combat and weapon switching | Clear corrupted town streets and recover a prototype weapon signal | Town gate / bridge path toward the orchard | Mix Pulse pressure, Arc close control, Recall Disc pathing | Recall Disc distant switch / weapon-specific reward | Town edge road leads to orchard route | Playable; needs encounter composition polish |
| Patterson's Orchard | Traversal puzzle and route memory | Redirect the orchard signal and open the storm route | Gravity Well or raised-barn destination candidate | Recall Disc crowd-control lanes and moving pressure | Hidden Scout shelter or underground signal pocket | Orchard breach opens to Signal Storm | Playable; needs one traversal mechanic |
| Signal Storm | Memorable final encounter | Survive the storm, hold the synchronization node, refuse classification | Corrupted passage arrival; no menu return during route | Final mix of switching, stagger, parry, overdrive | Post-fight Scout transmission / archive reward | End of current slice | Playable finale base; needs bespoke encounter polish |

## Systems Status

- Playable: connected top-down route chain, single-save flow, dev region warps, three-weapon foundation, fast weapon switching, route-state persistence.
- Needs polish: major loot presentation, objective clarity, encounter composition, combat feedback pacing.
- Planned next: Phase Shift, one Signal Tube, one Gravity Well, one Phase Door, one Scout Contraption, one raised/underground destination, one stealth-focused sequence, one weapon-specific secret.
- Deferred: Signal Rail, full mutation trees, equip/store/salvage economy, large map expansion, complex dungeon layouts.

## Guardrails

- Keep the route as separate top-down arena maps unless there is a strong technical reason to merge.
- Add only the smallest enemy/hazard roles that improve the current weapons or Phase Shift.
- Every traversal mechanic must have safe spawn points, collision, camera handling, save/load behavior, and touch/controller support.
- Command Center is the live dashboard for this plan; update `src/game/data/commandCenterData.ts` when a system moves from planned to playable.
