# BLIP Human Playtest Handoff

## Current Status

**READY FOR HUMAN PLAYTESTING** — all **5 zones are built and playable end-to-end**, from Miller Field
through the **Skyline Array finale + EndingScene** (the classification choice — "REFUSE THE LABEL").
Full `qa:full` green: typecheck + build + Playwright suite
(smoke, movement, quest flow, command center, save/reload/slots, visual snapshots, UI + gamepad, Motel Nowhere,
progression, Signal Skins, **Signal Portraits, Field Notes, scan-stun, Echo Blink**).
Latest report: `test-results/qa-reports/latest.md` · history: `test-results/qa-reports/history.json`.

**The 5 zones (each: scene + quest + boss + Signal Scout + Signal Fragment):**
1. **Miller Field** — Will / WILLOW — boss The Scarecrow Antenna
2. **Motel Nowhere** — Chip / SPARK — boss The Vacancy Sign
3. **Chagrin Falls High / Tiger Stadium** — Henry / ANCHOR — boss The Weather Balloon (+ underwater Pool Mirror sub-level)
4. **Patterson's Orchard** — Cameron / ECHO — boss The Harvest Pattern (+ top-down "Fold" / Sweep maze)
5. **Skyline Array** — Danny / ROCKET — boss The Listening Station — **THE FINALE** → EndingScene

There are **5 Signal Fragments** total, one per zone.

**UI pass (2026-07-10 PM):** warm-midnight palette (cream/lime/amber/crimson), crisp HTML console
(menu with SVG pixel logo, objective bar, bottom status strip, pause overlay, settings page) over the
pixelated world; full Xbox/PlayStation controller support including menu navigation and rumble.

**Content pass (2026-07-10 late):**
- **Terrain overhaul** — Miller Field is now layered Chagrin-ravine soil (embedded rock/brick/roots, mossy
  ledges, chipped cliff faces), a sculpted floating island, a third parallax ridge, and BLIP mystery details
  (buried signal nodes, faint scan glyphs, a carved "47"). Collision unchanged.
- **Signal Skins** — full 5-scout skin system + Wardrobe (Command Center), Signal Sets (Will + Chip earnable
  in Miller Field), Scout Echo unlock encounters, and live signature abilities. Debug: **F6** to cycle.
- **Zone re-themes** — Zone 3 → Chagrin Falls High / Tiger Stadium, Zone 4 → Patterson's Orchard (both now fully built and playable).
- **Level Plans** — full roadmap for all 5 zones in Command Center ▸ LEVEL PLANS; all five are now BUILT and playable through the Skyline Array finale.
- **Button font** — menus/buttons now use a condensed technical display face (was mono).

**Content pass (2026-07-10 night) — 47/47 tests green:**
- **Meet the Scouts** — completing a scout's Signal Set now summons that kid's **procedural sprite with their name
  floating over its head** (e.g. `WILL / WILLOW`), not a generic orb — the "you meet them" beat.
- **Signal Portraits** — new Command Center gallery: each scout's painted **collectible card**
  (`public/assets/portraits/*.png`, all 5 in) unlocks when you complete their set. In-fiction: the Engine only sees a
  blip; the Signal renders them whole again.
- **Scan-stun** — a scan pulse now **freezes drones** caught in it (~1.5s: halt + no fire + violet tint). Scan is offense too.
- **Scan-secrets + Scout Field Notes** — scan hidden spots to claim **Signal Shard caches** or recover **notebook pages**
  the Scouts left (each teaches a trick, kids'-club voice), shown in a new Command Center ▸ **FIELD NOTES** gallery.
- **Echo Blink** (Cameron/ECHO prototype) — **F** / D-pad Up places a signal echo; tap again to snap back to it. While
  it's out, scanners read the echo (classification decoy). Gated behind `echo-blink` (ERD-grantable via "All Abilities");
  earn-wiring lands with Zone 4. Tuning in `config.ts → PLAYER.echo*`.
- **Music beat hook** — the audio step-sequencer emits `EVT.musicBeat`; Motel neon pulses on the downbeat, security
  lamps flare on the off-beat (ambience only).
- **Borrowed-ideas capture pass** — deferred ideas recorded as design guidance in Command Center ▸ LEVEL PLANS
  (`CAPTURED — WIRE WHEN BUILT`) + `PROGRESSION_PLAN.md` (death-remnant). No gameplay code for those — captured, not built.
- *(Since shipped: Zone 3 — Chagrin Falls High / Tiger Stadium — stadium + underwater Pool Mirror scenes, Henry's set, cache collectible — plus Zones 4 (Patterson's Orchard) and 5 (Skyline Array) and the EndingScene finale are all built.)*

## How to Run

```bash
npm install
npm run dev        # → http://localhost:5173
```

## How to Run QA

```bash
npm run qa:full    # typecheck + build + full Playwright suite
npm run qa:loop    # bounded AI QA loop → report + Command Center panel data
```

## How to Play

- **Move** A/D · **Jump/Hover** SPACE (hold in air) · **Dash** SHIFT · **Pulse Shot** X / click · **Scan** Q · **Interact** E · **Command Center** C · **Pause** ESC
- The path: move right → scan the dip (hidden platforms) → over the high meadow, past the scanner rig's red cone → kill 2 drones → sealed crop-circle door → press E at the glowing node ("Enter the Blipstream") → shoot all 3 node switches, exit gate → the door opens → walk through, the SCARECROW ANTENNA rises → scan [Q] to expose its red core, jump-shot it, repeat → grab the Signal Fragment.
- Secrets: scan near the odd grass past the drones for **Will's badge trail** (climb it). Scan **Chip's humming box** on the high meadow.

## What AI Already Tested (automated, real inputs unless noted)

- Boot, menu, scene flow, zero console errors (production build)
- Run / jump (coyote + variable height) / hover / dash / shoot / scan — real keyboard
- Full quest flow: scan reveal → cone zone → **2 drone kills with real shots** → door → node entry (real E) → Blipstream node 1 activated with a real jump-shot (rest of routing via Test API) → return unlocks door → boss rises → **scan exposes core (real Q)** → **real jump-shot core hit** (grind finished via API) → fragment magnet-collect by walking → save flags
- Command Center: all sections, live data, scout card flips on badge, fragment decrypts the story bible, reset works, **no stale BEAMLINE/cow-abduction language**
- Save: persistence across reload, legacy `beamline_save_v1` migration, clean reset
- 10 canonical screenshots captured and visually reviewed (player visible, level readable, Blipstream distinct, boss/projectiles readable, HUD legible)

## What Humans Need To Test (newest)

- **Signal Skins feel** — equip WILLOW/SPARK/ANCHOR/ECHO/ROCKET (F6 to unlock+cycle, or Wardrobe) and judge
  whether each is a fun sidegrade, not a power ladder. Is UNKNOWN/CONTACT-47 still satisfying as baseline?
- **Will + Chip Signal Sets** — are the relic + badge + log satisfying to complete? Is the Scout Echo payoff good?
- **Terrain readability** — does the richer soil ever hurt platform/edge readability during play?

## What Humans Need To Test (since the UI pass)

- Play a full run **on a real Xbox or PlayStation controller** — automation verified the mapping layer
  via simulation, but real-stick feel (dead zone 0.28, hover on held A, dash on RB) needs human hands.
- Settings page: is anything missing you'd expect? (Remapping is roadmapped, not built.)
- Does the crisp HTML UI + pixel world combo read as intentional and premium?

## What Humans Need To Test

- Is movement **fun**? (run/jump/hover/dash timing and weight)
- Is the scan mechanic understandable without reading the hints?
- Is Will's badge discoverable but not too obvious?
- Is the Blipstream puzzle fun or confusing? Right length?
- Is the Scarecrow Antenna too easy / too hard? Is scan→expose→hit readable?
- Does classification (red cones) feel like a threat you manage or just decoration?
- Story tone: mysterious but warm? Do the Scouts land emotionally?
- Is the Command Center useful? Does the game feel unique?
- Audio mix: are the synthesized SFX pleasant at default volume?

## Known Issues / Limitations (honest list)

- Only the drone-area/badge/dip platforms use hidden-reveal; scan has no effect on most open field areas (by design, but may read as inconsistent).
- Blipstream nodes 2 and 3 were only automation-verified via the API shortcut after node 1 was proven with real input — a human should confirm the full room is comfortably beatable (hover makes the hazard jumps forgiving; falling costs 1 hp and respawns at entry).
- Scan-stun of drones is now **implemented** (a scan freezes nearby drones ~1.5s); scan still also reveals hidden geometry + exposes the boss core.
- Boss beams damage through terrain (no line-of-sight blocking) — dodge by moving, not hiding.
- Gamepad works (Xbox/PS standard mapping) but there is no button remapping yet; real-hardware feel is untested (simulation-verified only). No mobile/touch input. No custom shaders (CSS CRT overlay instead — toggleable in Settings). No service worker/offline.
- All five scouts' Signal **Sets** are now placed in their home zones (Henry at the stadium, Cameron in the orchard, Danny on the Skyline Array), their **portraits** are earnable/viewable in the gallery, and their kid sprites + skins exist.
- Pause menu music/sfx toggle lives in the top bar, not in the pause panel.

## AI Fun-Factor Loop — 2026-07-11 (shipped, tested)

A 5-pass automated fun/QA loop ran the slice and shipped these (each behind a permanent regression test; final gate 56/56 green). Full per-loop reports + storyboards + telemetry in **`qa-reports/`** (`overnight-summary.md`, `loop-00..05.md`, `history.json`). Overall fun 7→8; readability 7→9; boss 6→8.
- ✅ **Camera lookahead** — the view leads the direction you face (`config.CAM`); shared `systems/CameraLook.ts` covers Miller Field **and** Motel.
- ✅ **Boss radial-burst telegraph** — amber converging wind-up (`BOSS.radialTelegraphMs`) before the volley; fixes fairness + red-on-red.
- ✅ **Scan "NO ANOMALIES"** — SONAR always answers on empty ground.
- ✅ **Drone threat halos** — drones read against the dark valley.
- ✅ **Blipstream** — ambient motes + a glow on the sweeping scan-line hazard.

## Next Best Fixes (prioritized)

1. Human tuning pass on movement constants (`src/game/config.ts` → `PLAYER`) — telemetry says values are healthy; subjective feel still un-tuned. **Now safe to tune boldly** (all in config).
2. A bigger Signal Fragment payoff moment (the slice's one mandatory reward).
3. A second Blipstream node in Miller Field to cement the loop before Zone 2 (Motel Nowhere / Chip).
4. Zone 3 (Stadium) camera to adopt the shared `CameraLook` lookahead (one line).
5. ~~Boss telegraph before radial bursts~~ ✅ done · ~~Scan "NO ANOMALIES" ping~~ ✅ done (above).

## Miller Field 3.0 checklist (vertical-topology rebuild, 2026-07-10)

The layout was rebuilt into a serpentine route-topology (176×40 grid, 2816×640px,
25 tiles of vertical play): high spawn ridge → **descend** the deep scan-dip (cascading
ledges) → scan-climb out to the high meadow (Chip's box) → scanner plateau → **drop**
into the tiered drone lowlands (open east floor + optional basin pit) → terraced climb
to the radio ridge → **ravine** crossing on a mid pillar (optional lower recovery shelf) →
node-mound landmark + crop-circle door → **drop** into the tiered boss bowl → road east →
glowing signal-gate. Optional routes: the basin pit (lower) and Will's tall secret climb
to the WILLOW badge (upper). The Command Center **Level Atlas** renders this live with a
route overlay (main/lower/upper) + descent/climb/rejoin/secret/boss/checkpoint/softlock
markers + a stats note. Automated suite (37 tests) is green on this layout.

Verify on every pass:
- [ ] Full run start→fragment→road east completes with the base kit only
- [ ] Spawn: player rests on the ridge and runs right freely (no wedging — the spawn/fence sit ABOVE the floor row)
- [ ] Camera follows climbs/drops smoothly (deadzone 40×18, y-lerp 0.16, offset -10) — no snapping on the dip, Will climb, ravine, or boss drop
- [ ] Camera lookahead leads the facing direction (`config.CAM.lookaheadX=100`) — feels like it shows where you're going, not too aggressive on fast reversals
- [ ] Dip: one scan from the floor reveals the whole climb-out ladder (r24→r14, 2-row zigzag); you cannot escape west (intended — scan is the lesson)
- [ ] Scanner plateau: cone sweeps the crossing; dash-through and the high hop-line both work
- [ ] Both drones die to real pulse shots from the east valley floor (one low in the basin, one high by the east tier — both aggro and align to the gun line)
- [ ] Will's climb: markers + platforms reveal on scan; badge + relic reachable; every hop ≤2 rows (mid-climb re-scan expected — it's taller than one scan radius)
- [ ] Ravine: hover/mid-pillar clears it; falling in lands on the recovery shelf and the ladder climbs out east; only the void past the shelf damages + respawns at last safe ground
- [ ] Node mound → door: portal E works; routing the node opens the door; camera pan reveal plays
- [ ] Boss: trigger fires only PAST the left arena wall; side tiers + central recovery ledge usable; scan→expose→shoot loop lands (stand to one side, the core sits low); summons fine
- [ ] Fragment collects; Pulse Resonance card shows; signpost lights; walking to it travels to Zone 2
- [ ] No softlocks: dip (pre-scan), ravine shelf, behind-boss-walls, door corridor
