/**
 * Command Center copy — mechanics, controls, build checklist, art direction.
 * Keep this file in sync with what is actually implemented.
 */

export const PITCH =
  'BLIP is a top-down sci-fi action adventure: you are CONTACT-47, the thing on the radar, ' +
  'moving through route-connected Chagrin Falls-inspired signal zones before the Interpretation Engine finishes deciding what you are.';

export const TAGLINE = 'You are the thing on the radar.';
export const SUBTITLE = 'A top-down sci-fi action adventure about staying unknown.';

export const CURRENT_STATUS = [
  'Top-down-only route-connected arena chain is live: Miller Surface → Motel Circuit → Chagrin Falls Town → Patterson’s Orchard → Signal Storm.',
  'This is not a seamless single-map world yet. Areas still restart the same Phaser scene through fast breach handoffs.',
  'MASTER_GAME_BACKLOG.md is the authoritative backlog. The Command Center mirrors its summary, blockers and next critical path.',
  'MAP_SCHEMATICS.md is the authoritative top-down planning view for current route layouts. It links generated SVG schematics for each arena and should be regenerated with `node scripts/generate-map-schematics.mjs` after map coordinate changes.',
  'All current route regions render through the HD top-down pipeline. Chagrin Falls Town currently reuses the hard-edge HD town/lot asset vocabulary until a dedicated topdown-z3 pack exists.',
  'One canonical save exists at localStorage blip_save_v1; no alternate save files or file picker are part of the game.',
  'Region transitions preserve runtime health, equipped weapon, overdrive, boons, inventory/save progress and world flags.',
  'Main-menu dev warps are intentionally local/test/god-only. Production hides them by default unless an explicit tester mode is chosen later; in dev/test they live in a small bottom-left DEV WARPS rail instead of the main menu list.',
  'Current weapon foundation is Pulse Carbine, Arc Blade and Recall Disc. Pulse is faster and cleaner at range, Arc has a wider/stronger parry burst, and Recall Disc has a consistent out-and-back return trail. Older weapon names are future mutation ideas, not live standalone weapons.',
  'Combat collision was corrected: HD visual scaling no longer shrinks physics hitboxes, player/enemy/projectile bodies are world-space honest, enemy close-range pressure damages within a threat radius, and standing still in Miller now reaches Game Over instead of being harmless.',
  'Enemy pursuit is hardened with a shared walkable-tile distance field, line-of-sight fallback, ranged-drone strafing, collision stuck recovery, and safe snapping for authored player/enemy/exit markers.',
  'Route objective math is hardened: traverse breaches require both enough charge and enough distinct objective actions. Miller/Town/Orchard were retuned for the enlarged maps so authored field events and normal combat can open routes without excessive wandering.',
  'Region objectives now use named goals and rewards instead of presenting every area as the same generic node loop.',
  'The route now has a clearer motivation spine: CONTACT-47 is chasing Scout evidence before the Interpretation Engine permanently classifies it. Miller awards a Willow mutation choice, Motel awards Phase Boost+, Town awards Scout Relay Pylon tech, Orchard hides Scan Memory behind the Gravity Well/ridge chain, and Signal Storm now requires relay-wing actions before the North Rift finale proceeds.',
  'Miller now starts with a brief non-combat crash-site onboarding beat on fresh saves: CONTACT-47 wakes at the impact site, reads Scout/kid evidence, scans Chip’s Spark Line, recovers the first kit, then the field wakes and enemies seed into the route. Existing saves that already completed the intro skip it.',
  'Boost is the current SHIFT/RB/touch movement ability: hold it for a limited high-speed Phase Boost, drain the boost meter, then release to regenerate. It keeps scanner-crossing and brief i-frame counterplay without the old single-tap teleport.',
  'The top-down HUD now has an explicit BOOST meter in the vitals panel, with full/empty feedback. CONTACT-47 also leaves a capped, fading light-blue hover-fire trail on the ground to show recent travel path.',
  'Miller Surface now has the first authored Boost-only washout crossings: red corrupted cracks that block normal walking but can be crossed while holding Boost. These are a first-level traversal trial, not yet rolled out to every region.',
  'CRT scanlines now default OFF, the CONTACT-47 personal aura defaults OFF and can be toggled in Settings, and screen filters now apply to the title and active top-down world camera with a saved 0-100 intensity slider. Gameplay filters still cap at readability-safe strength; HUD/DOM overlays remain readable.',
  'Weapon affinities are live through one centralized system: Pulse Carbine is Pulse, Arc Blade/parries are Arc, Recall Disc is Kinetic, and explosions/Overdrive are Blast. New tactical-role enemies CIPHER, GRAVITON, UNDERTOW, DECOY and DORMANT are playable with per-state weakness/resistance feedback and per-region rosters; all five still need final custom HD enemy art.',
  'Focused AI campaigns are wired for region and route slices. Latest public AI JSON is `first-three-route-regression-v8`: 6 Miller→Motel→Town attempts, 6/6 completions, 0 deaths and 0 soft-lock-risk stalls after nearest-useful route-marker targeting, objective-marker stuck recovery and fair expanded-route timing. Reports include per-run time budgets, decision traces and stall samples so failures are inspectable. Orchard-focused `orchard-ai-gravity-priority-v1` remains 6/6. AI numbers are design evidence, not a hard deploy gate.',
  'Schematic-first expanded layouts are implemented across all five route regions. The latest gameplay-design/content pass gives every named area a purpose: main route, optional branch, secret pocket, shortcut/return loop, worthwhile reward pocket, intentional enemy spaces, field-event rewards, visible purpose-labeled markers, subtle discovered-area lighting, clear objective completion and satisfying exit approach. Motel scanner labels now explicitly read as scanner hazards, use scanner hardware endpoints, avoid stale gate/circuit wording, and disappear from player/AI perception once the route opens. Pickup/event labels reserve space around route signs, and qa:maps now catches obvious route-sign label crowding. Manual live feel review is still needed before calling the maps final.',
  'Focused environment-depth polish is live in the shared HD terrain path: biome-specific ground wear, cracks, grates, row marks, street markings, medium/tall edge silhouettes, foreground framing, roof/parapet/service-equipment detail, named-area dressing and data-driven elevation zones with stronger follow-camera offset/zoom now help signs like Main Street, Pool Courtyard, Orchard Rows, Raised Ridge and Classifier Core read as real places instead of labels on identical rooms. The ambiguous Motel/Town car landmark is no longer auto-placed until a clearer vehicle asset exists. This is additive dressing only; routes, collisions and encounters were preserved.',
  'Major weapon/reward/trophy cards now open as centered blocking read-and-continue modals. Gameplay pauses behind them and completion bursts batch into one grouped reward modal where possible, preventing reward text from overlapping route signs, combat HUD or pickup labels.',
  'Experimental Tripo CONTACT-47 model import is live as a rendered eight-facing transparent PNG set with the original HD CONTACT-47 atlas kept as fallback. CONTACT-47 now reads as a low-hover robot with cyan underside thrusters, and the main menu radar hero now uses the Tripo CONTACT-47 render instead of the old tiny procedural sprite. The GLB has a skin but no animation clips, so walk/shoot animation remains a future rigging/retarget pass.',
  'The old Wardrobe / Signal Skin system is cut from active gameplay. Scout collectibles remain useful as lore/progression hooks, but cache rewards, Command Center, dev tools and active player stats now treat CONTACT-47 as the only field-unit presentation.',
  'Tone target is stylized teen/young-adult sci-fi action: colorful and strange, but dangerous, mysterious, forceful and never toy-like.',
];

export interface MechanicDef {
  name: string;
  description: string;
}

export const MECHANICS: MechanicDef[] = [
  { name: 'Move / Aim / Fire', description: 'The whole game uses one top-down controller: 8-directional movement, mouse or right-stick aim, and responsive combat.' },
  { name: 'Combat Collision', description: 'HD visual scale is decoupled from world-space hitboxes, so shots and contact damage match what the player sees.' },
  { name: 'Drone Pursuit Hardening', description: 'Enemies pursue through walkable lanes instead of pushing into walls, recover from blocked bodies, and ranged drones strafe while holding firing distance.' },
  { name: 'Phase Boost', description: 'Hold SHIFT/RB/touch Boost for a limited high-speed surge with restrained trailing echoes, a visible BOOST meter, brief invulnerability, scanner crossing and meter regeneration.' },
  { name: 'Hover-Fire Trail', description: 'CONTACT-47 leaves a subtle fading cyan ground residue while moving, giving players a recent-path read without creating permanent map clutter.' },
  { name: 'Boost Washouts', description: 'Miller has the first red cracked-gap traversal trial: normal walking is blocked, but holding Boost lets CONTACT-47 cross optional shortcut gaps.' },
  { name: 'Scan Pulse', description: 'An expanding ring that stuns nearby threats, reveals caches and scout marks, and makes hidden signal routes readable.' },
  { name: 'Route-Connected Areas', description: 'Miller Surface, Motel Circuit, Chagrin Falls Town, Patterson’s Orchard, and Signal Storm are separate top-down arena maps linked by gates, roads, trails, bridges, and signal breaches.' },
  { name: 'Map Schematics', description: 'MAP_SCHEMATICS.md plus docs/map-schematics/*.svg provide the current top-down planning view generated from arena data for map redesign prompts.' },
  { name: 'Region Goals', description: 'Each area now has named objective language, a visible reward and a route-opening payoff instead of generic node-only framing.' },
  { name: 'Field Events', description: 'Authored purpose-labeled markers add optional caches, overdrive charges, weapon prototypes, Scout boons and ambush beats so large map pockets do not feel empty.' },
  { name: 'Purposeful Landmarks', description: 'Random flat landmarks no longer spawn as unexplained walk-through route objects. Decorative landmarks are edge-biased; central structures must be authored, readable and either blocked, interactive or clearly ornamental.' },
  { name: 'Elevation Zones', description: 'Raised ridges, rooflines, creek lows and rift bowls are data-driven 2.5D zones with visible ground-layer cues and stronger follow-camera offset/zoom so maps feel less flat without changing collision architecture.' },
  { name: 'Weapon Affinities', description: 'Pulse, Arc, Kinetic and Blast damage flow through one centralized affinity table with WEAK/RESIST feedback and state-specific enemy vulnerabilities.' },
  { name: 'Motel Stealth Bonus', description: 'Clearing Motel with every scanner phased offline and zero alerts awards the one-time Ghost Check-In shard bonus. Debug route-open alone cannot trigger it.' },
  { name: 'Miller Mutation Choice', description: 'Recovering Willow’s cache opens a blocking three-card choice: Overchain Capacitor, Arc Reprisal, or Recall Conduit. Each changes a real weapon behavior.' },
  { name: 'Phase Boost+', description: 'Motel’s scanner-core reward increases Boost reserve/recharge and lets active Boost phase through nearby hostile bolts.' },
  { name: 'Scout Relay Pylon', description: 'Town’s Orchard Gate defense beat deploys temporary Scout pylons that fire at nearby drones, proving Scout tech can become active battlefield tools.' },
  { name: 'Scan Memory', description: 'The Orchard Scout Shelter upgrade is locked behind the Gravity Well/ridge step and makes Scan pulses leave lingering Scout echoes.' },
  { name: 'Signal Storm Relay Gate', description: 'After Classifier Core phase one, both Relay Wings must be scanned before the North Rift finale stages continue.' },
  { name: 'Scout Trails', description: 'The Five Signal Scouts left badges, logs, relics, portraits, route hints, field boons and gameplay upgrades. Old selectable body skins are cut from active play.' },
  { name: 'Signal Caches', description: 'Buried caches become collectible when scanned. They feed shards, Scout lore, trophy progress, upgrade hooks and reward archive entries.' },
  { name: 'Crash Site Onboarding', description: 'Miller cold-starts with a short non-combat crash recovery chain: wake at the impact site, scan Chip’s Spark Line, recover the first kit, learn that the Scouts believe CONTACT-47 can protect Chagrin Falls, then release field combat.' },
  { name: 'The Classifier', description: 'Elite signal drones patrol important areas with telegraphed beams. If the beam catches you, pressure spikes fast.' },
  { name: 'Weapon Roster', description: 'Pulse Carbine, Arc Blade, and Recall Disc create the current ranged, melee/parry, and positioning playstyles. Weapon pickups show their name and role in-world.' },
  { name: 'Signal Overdrive', description: 'Kills charge an ultimate shockwave and short rapid-fire window. Save it for swarms or node pushes.' },
];

export interface ControlRow {
  action: string;
  keys: string;
}

export const CONTROLS_FIELD: ControlRow[] = [
  { action: 'Move', keys: 'WASD / arrows' },
  { action: 'Aim', keys: 'Mouse' },
  { action: 'Fire', keys: 'Left click / X' },
  { action: 'Switch weapon', keys: '1 / 2 / 3 · mouse wheel · R' },
  { action: 'Boost', keys: 'hold SHIFT' },
  { action: 'Scan Pulse', keys: 'Q / right click' },
  { action: 'Interact / Overdrive', keys: 'E' },
  { action: 'Scout Echo', keys: 'F' },
  { action: 'Command Center', keys: 'C or TAB' },
  { action: 'Pause', keys: 'ESC' },
];

export const CONTROLS_ROUTES: ControlRow[] = [
  { action: 'Signal routes', keys: 'stand inside the charged breach' },
  { action: 'Area handoff', keys: 'save, health, weapons, inventory and flags persist' },
];

export const CONTROLS_GAMEPAD: ControlRow[] = [
  { action: 'Move', keys: 'Left stick / D-pad' },
  { action: 'Aim', keys: 'Right stick' },
  { action: 'Fire', keys: 'X / RT · Square / R2' },
  { action: 'Switch weapon', keys: 'L-stick / R-stick click' },
  { action: 'Boost', keys: 'hold RB / LB · R1 / L1' },
  { action: 'Scan Pulse', keys: 'Y / LT · Triangle / L2' },
  { action: 'Interact / Overdrive', keys: 'B · Circle' },
  { action: 'Pause', keys: 'START · OPTIONS' },
  { action: 'Command Center', keys: 'BACK · SHARE' },
  { action: 'Menus', keys: 'D-pad / stick + A · Cross' },
];

export const CONTROLS_TOUCH: ControlRow[] = [
  { action: 'Move', keys: 'virtual stick' },
  { action: 'Fire', keys: 'large FIRE button' },
  { action: 'Switch weapon', keys: 'WPN button' },
  { action: 'Scan', keys: 'SCAN button' },
  { action: 'Boost', keys: 'hold BOOST button' },
  { action: 'Interact / Overdrive', keys: 'ACT button' },
  { action: 'Pause', keys: 'pause pip' },
];

export const CONTROLS_SWEEP: ControlRow[] = [
  { action: 'Move', keys: 'WASD / arrows · left stick' },
  { action: 'Aim', keys: 'Mouse · right stick' },
  { action: 'Fire', keys: 'Left click / X · RT' },
  { action: 'Switch weapon', keys: '1 / 2 / 3 · mouse wheel · R · stick-clicks · WPN' },
  { action: 'Boost', keys: 'hold SHIFT · shoulder button' },
  { action: 'Scan', keys: 'Q / right click · Y / LT' },
  { action: 'Overdrive', keys: 'E · B / Circle' },
  { action: 'Swap weapon', keys: 'walk over a weapon pickup' },
  { action: 'Advance route', keys: 'stand inside the open breach' },
  { action: 'Pause', keys: 'ESC · START' },
];

export const CONTROLS_DEBUG: ControlRow[] = [
  { action: 'Toggle debug overlay', keys: 'F1' },
  { action: 'Reset current quest', keys: 'F2' },
  { action: 'Give Signal Fragment', keys: 'F3' },
  { action: 'God mode', keys: 'G' },
];

export interface TodoItem {
  label: string;
  done: boolean;
}

export interface BacklogCountItem {
  status: string;
  count: number;
}

export interface BacklogPathItem {
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'CUT';
  item: string;
  status: string;
  note: string;
}

export const MASTER_BACKLOG_COUNTS: BacklogCountItem[] = [
  { status: 'COMPLETE', count: 36 },
  { status: 'PARTIAL', count: 59 },
  { status: 'PLANNED', count: 16 },
  { status: 'MISSING', count: 7 },
  { status: 'DEFERRED', count: 13 },
  { status: 'CUT / NO LONGER APPLICABLE', count: 4 },
  { status: 'NEEDS DECISION', count: 2 },
];

export const MASTER_BACKLOG_CRITICAL_PATH: BacklogPathItem[] = [
  { priority: 'P0', item: 'Region scale/layout creation', status: 'PARTIAL', note: 'Schematic-first expanded layouts are implemented for all five route regions. qa:maps now checks route distances, purposeful branches, reward density, mechanic hooks and obvious route-sign label crowding; qa:route checks HD rendering/objective/route-open state. Only subjective feel review remains.' },
  { priority: 'P0', item: 'Miller Surface gameplay/content pass', status: 'PARTIAL', note: 'Old Mill Spur, Substation Overlook, Scout Shelter Pocket, lower recovery shortcut, far-east Motel breach, authored purpose-labeled events, early weapon pickups, ambush rewards and two optional Boost washout crossings are live. Route arrows now target the nearest unvisited useful marker instead of pulling players back to skipped signs; the current focused first-three sample reaches Town 6/6.' },
  { priority: 'P0', item: 'Progression and motivation spine', status: 'PARTIAL', note: 'Central mystery copy is live, Miller now grants a real mutation choice, Motel grants Phase Boost+, Town demonstrates Scout Relay Pylons, Orchard hides Scan Memory behind Gravity Well/ridge progression, and Signal Storm requires Relay Wings before the North Rift finale. Needs full-route playtest evidence and HUD mutation clarity.' },
  { priority: 'P0', item: 'Crash Site Onboarding', status: 'PLAYABLE / NEEDS POLISH', note: 'Fresh Miller saves now start quiet at a crash-site chain: CRASH SITE wake marker, scan-only SPARK LINE, FIRST KIT recovery, blocking story reward modal, then delayed enemy seeding. Smoke coverage verifies zero enemies before the kit, visible objective guidance, persistence and enemy wake. Needs manual pacing/copy review.' },
  { priority: 'P0', item: 'Remaining-region gameplay/content pass', status: 'PARTIAL', note: 'Motel, Town, Orchard and Signal Storm now have purposeful named branches/loops/pockets plus field-event rewards, ambushes and progression beats. Orchard Crop Circle gates on Gravity Well/ridge completion, the Scout Shelter is a traversal-gated upgrade, and Signal Storm now has a relay-wing gate before the North Rift finale. Needs live feel review and encounter tuning.' },
  { priority: 'P1', item: 'AI safety and route guidance after layouts', status: 'PARTIAL', note: 'AI personas use visible signal markers, labeled objective hints, scanners, enemies, visible enemy roles and pickups from perception snapshots. Campaign runner uses isolated strict preview ports, fair per-scenario time budgets, objective-marker stuck recovery and decision traces/stall samples. Orchard-focused AI remains 6/6; current first-three baseline is `first-three-route-regression-v8` at 6/6. Broader regression and full-route evidence remain pending.' },
  { priority: 'P0', item: 'First-route clarity after layout pass', status: 'PARTIAL', note: '`first-three-route-regression-v8` reached 6/6 Miller→Motel→Town completions with 0 deaths and 0 soft-lock-risk stalls after nearest-useful route-marker targeting, objective-marker stuck recovery, fair expanded-route timing, earlier Motel recovery and route sign cleanup. Failed lower-road and Check-Out breadcrumb experiments were reverted after worse samples. Needs broader regression plus subjective live feel review.' },
  { priority: 'P0', item: 'Unified notification/reward UI', status: 'PARTIAL', note: 'Objective card is the primary instruction surface, routine toasts dedupe into a smaller activity feed, combat toasts are capped at two with shorter dwell, center HUD banners queue one at a time, and major reward/trophy/weapon cards now open as centered blocking read-and-continue modals. A single shared notification manager/showcase is still unfinished.' },
  { priority: 'P0', item: 'Major reward presentation', status: 'PARTIAL', note: 'Named region rewards use centered blocking major reward modals and important weapon drops show name, combat role and a queued weapon reward card. Random health drops no longer carry stale weapon ids, fixing pickup telemetry/UI mismatches. Full compare/equip/store/salvage flow is still deferred.' },
  { priority: 'P0', item: 'Meaningful weapon progression', status: 'PARTIAL', note: 'Miller now presents a real choice between Overchain Capacitor, Arc Reprisal and Recall Conduit. Behavior hooks are live: charged Pulse chain, Arc parry shockwave, and Recall return trail. Needs focused tests, clearer mutation HUD, and additional mutations.' },
  { priority: 'P0', item: 'Motel stealth identity', status: 'PARTIAL', note: 'Scanner beams, alert, Boost onboarding and a Ghost Check-In no-alert/all-scanners-offline bonus exist. Ambiguous route/scanner labels were replaced with place/task names and explicit scanner-device names; active beams read as red hazards, scanner endpoints use hardware sprites, and open-route scanners disappear instead of remaining as confusing props. Safe/danger zone presentation and broader route regression still need work.' },
  { priority: 'P1', item: 'Town identity', status: 'PARTIAL', note: 'Cover/tower/street route exists and Orchard Gate now has a Scout Relay defense beat. Dedicated Chagrin Falls HD identity and clearer cover language still need work.' },
  { priority: 'P1', item: 'Orchard puzzle identity', status: 'PARTIAL', note: 'Gravity Well launch/raised ridge gates the Crop Circle route, and the Scout Shelter/Scan Memory reward is only available after that traversal proof. Deeper object/enemy/projectile redirection remains planned.' },
  { priority: 'P1', item: 'Signal Storm finale', status: 'PARTIAL', note: 'Wave finale now presents Classifier Core phase one, requires both Relay Wings before continuing, then escalates into North Rift and Refuse the Label phases. Still needs stronger boss behavior/presentation.' },
  { priority: 'P1', item: 'AI Player Lab extended campaign', status: 'MISSING', note: 'Harness exists; 500-run overnight campaign has not been completed and should wait until the route is stable.' },
];

export const MASTER_BACKLOG_DEFERRED: BacklogPathItem[] = [
  { priority: 'P3', item: 'Signal Rails', status: 'DEFERRED', note: 'Not needed for the current five-region slice.' },
  { priority: 'P3', item: 'Full inventory/store/salvage/crafting', status: 'DEFERRED', note: 'Simple acquire/activate/equip is the near-term target.' },
  { priority: 'P3', item: 'Full CONTACT-47 skeletal animation', status: 'DEFERRED', note: 'The Tripo eight-facing hover sprite is acceptable until clean animation clips exist.' },
  { priority: 'P3', item: 'Additional regions and large world expansion', status: 'DEFERRED', note: 'Polish the existing five-region route first.' },
  { priority: 'P3', item: 'Every building enterable', status: 'CUT', note: 'Buildings should mostly be exterior obstacles, cover, landmarks and route boundaries.' },
  { priority: 'CUT', item: 'Side-scroller return', status: 'CUT / NO LONGER APPLICABLE', note: 'Do not revive side-scrolling code, controls, cameras, scenes, docs or level-select ideas.' },
];

export interface SliceSystemItem {
  name: string;
  status: 'PLAYABLE' | 'IN DEVELOPMENT' | 'PLANNED' | 'NEEDS ASSETS' | 'NEEDS POLISH' | 'TESTED' | 'DEFERRED';
  note: string;
}

export const VERTICAL_SLICE_SYSTEMS: SliceSystemItem[] = [
  { name: 'Connected top-down route chain', status: 'TESTED', note: 'Separate arena maps linked by fast breach handoffs; not a seamless open map. Route changes require the actual charged breach, not broad road rectangles.' },
  { name: 'Single-save flow', status: 'TESTED', note: 'Main menu has Continue/New Game only; pause has Quit to Menu, which resumes from autosave.' },
  { name: 'Dev region warps', status: 'PLAYABLE', note: 'Local/test/god warp chips jump to each current region for fast QA. They now render as a compact bottom-left DEV WARPS rail instead of full main-menu entries.' },
  { name: 'Pulse Carbine', status: 'PLAYABLE', note: 'Faster ranged pressure; every fifth standard shot pierces. Overchain Capacitor makes charged shots chain through exposed enemies.' },
  { name: 'Arc Blade', status: 'PLAYABLE', note: 'Wider close-range burst with stronger knockback and parry/reflection. Arc Reprisal makes parries release a shockwave. Important Arc pickups advertise PARRY/CLOSE.' },
  { name: 'Recall Disc', status: 'PLAYABLE', note: 'Faster out-and-back cutter for positioning combat. Recall Conduit makes return paths leave damaging blue lightning.' },
  { name: 'Fast weapon switching', status: 'PLAYABLE', note: 'Keyboard 1/2/3/R, mouse wheel, gamepad stick-clicks and touch WPN. The iPad touch cluster now uses separated FIRE, BOOST, SCAN, WPN, ECHO and ACT buttons with no redundant aim-fire symbol.' },
  { name: 'Combat collision / damage pressure', status: 'TESTED', note: 'HD rig preserves world-space body sizes; isolated combat validation proves every enemy archetype, including new tactical enemies and split children, can be killed by real player projectiles.' },
  { name: 'Route objective gating', status: 'TESTED', note: 'Traverse arenas require charge plus minimum objective actions before opening a breach; Orchard also requires the Gravity Well/raised-ridge step before the Crop Circle route fully opens.' },
  { name: 'Tripo CONTACT-47 model import', status: 'IN DEVELOPMENT', note: 'Optimized GLB, eight full-body transparent rendered facings, cyan low-hover thrusters and main-menu Tripo hero art are live. Old CONTACT-47 remains fallback. No GLB animations exist yet.' },
  { name: 'Major loot presentation', status: 'NEEDS POLISH', note: 'Region rewards and important weapon pickups open centered blocking read-and-continue reward modals with resolved names/roles from the actual equipped weapon id, and completion bursts batch together. Health pickups no longer carry stale weapon ids; pickup art is larger and reads as a glossy sealed signal vault, not a cartoon chest. Full compare/equip/store/salvage flow is not built yet.' },
  { name: 'Region-specific objectives', status: 'PLAYABLE', note: 'HUD, telemetry and rewards use named goals/rewards for each region.' },
  { name: 'Crash Site Onboarding', status: 'PLAYABLE', note: 'Fresh Miller saves start with non-combat crash recovery: CONTACT-47 wakes at the impact marker, scans Chip’s Spark Line, recovers the first kit and sees a centered story reward card before enemies wake. Existing completed saves skip the intro. Needs manual tone/pacing polish.' },
  { name: 'Phase Boost', status: 'PLAYABLE', note: 'Hold SHIFT/RB/touch Boost for a limited high-speed surge with boost-energy drain, regeneration, brief i-frames, restrained behind-the-player echoes and an explicit BOOST meter. Phase Boost+ adds more reserve/recharge and nearby hostile-bolt phasing.' },
  { name: 'Hover-Fire Trail', status: 'PLAYABLE', note: 'Movement stamps a capped, fading cyan ground trail so recent travel is visible without permanent clutter.' },
  { name: 'Boost Washouts', status: 'IN DEVELOPMENT', note: 'Miller has two authored red corrupted washouts that block normal walking and allow held-Boost crossing. Rollout to other regions should wait for live feel review.' },
  { name: 'Motel stealth onboarding', status: 'IN DEVELOPMENT', note: 'Scanner beams, alert state, Boost prompt, combat fallback and a visible entrance DUMPSTER SCANNER are live. Alerts add pressure without direct beam damage; route readiness verifies scanner perception and River Road exit guidance.' },
  { name: 'First-route clarity', status: 'NEEDS POLISH', note: 'Phase-specific holographic route signposts are live and simplified. Broad road auto-warp zones were removed; transitions require a short hold inside the actual charged breach. Route arrows now choose the nearest unvisited useful marker, which fixed backward-sign stalls in focused AI. `first-three-route-regression-v8` reaches Town 6/6 with 0 deaths/soft locks; continue broader regression and subjective route feel review.' },
  { name: 'Region scale/layout pass', status: 'IN DEVELOPMENT', note: 'Schematic-first expanded layouts, named-area purpose pass, field-event content pass and subtle discovered-room dimming are live across all five regions. qa:maps and qa:route now automate structural/readability checks; remaining review is subjective feel/taste.' },
  { name: 'Elevation and visual depth', status: 'IN DEVELOPMENT', note: 'All five route regions have data-driven rise/drop/roofline/creek/rift zones with ground-layer cues and stronger camera offset/zoom. Default camera zoom is pulled back globally for better readable scale.' },
  { name: 'Field-event reward pockets', status: 'PLAYABLE', note: 'All five route regions have visible purpose-labeled events that grant shards, health, overdrive, weapon prototypes, Scout boons, Scout Relay defense or traversal-gated upgrades, with optional ambush spawns and AI-visible perception markers. Markers now read as CACHE, RECOVERY, SCOUT TECH, WEAPON, DEFENSE KIT or UPGRADE instead of generic action plates.' },
  { name: 'Enemy combat roles', status: 'PLAYABLE', note: 'Core roster plus CIPHER, GRAVITON, UNDERTOW, DECOY and DORMANT are live with centralized weapon affinities, state-specific weaknesses, per-level rosters and combat validation. New tactical-role art is procedural fallback and needs final custom HD replacement.' },
  { name: 'Signal Tube', status: 'PLANNED', note: 'One simple traversal route first; future branching deferred.' },
  { name: 'Gravity Well', status: 'IN DEVELOPMENT', note: 'Orchard has a playable introductory launch to a raised ridge, Crop Circle completion depends on that traversal step, and the Scout Shelter/Scan Memory secret is locked until the ridge signal is proven. Deeper object/enemy redirection is deferred.' },
  { name: 'Phase Door', status: 'PLANNED', note: 'Frequency barrier gated by scan/Phase Boost rules.' },
  { name: 'Signal Rail', status: 'DEFERRED', note: 'Track in the design, but do not build until the slice needs faster traversal.' },
  { name: 'Scout Contraptions', status: 'PLANNED', note: 'One story-tied route device or secret opener in the first slice.' },
  { name: 'Raised / underground spaces', status: 'IN DEVELOPMENT', note: 'Orchard raised ridge is playable; underground shelters remain planned.' },
  { name: 'AI Player Lab', status: 'TESTED', note: 'Personas, campaign runner, evidence JSON and E2E coverage are live. Latest public run `first-three-route-regression-v8` reached 6/6 Miller→Motel→Town completions with 0 deaths and 0 soft-lock-risk stalls. Reports include per-run time budgets, decision traces and stall samples. Orchard-focused `orchard-ai-gravity-priority-v1` remains 6/6.' },
];

export interface RegionPlanItem {
  region: string;
  purpose: string;
  objective: string;
  traversal: string;
  combat: string;
  secret: string;
  connection: string;
  state: string;
}

export const REGION_VERTICAL_SLICE_PLAN: RegionPlanItem[] = [
  {
    region: 'Miller Surface',
    purpose: 'Onboarding, exploration and first cache read',
    objective: 'Recover the Willow cache, learn weapon switching and open the road east.',
    traversal: 'Road east into the Motel Circuit breach.',
    combat: 'Pulse Carbine fundamentals against readable drones.',
    secret: 'Early Scout marker / Phase Door candidate.',
    connection: 'Miller road exits toward Motel Circuit.',
    state: 'IN DEVELOPMENT; gameplay-design/content pass is live with Field Track, Willow Trail, Cache Grove, Old Mill Spur hidden log/cache, Substation Overlook power-shortcut beat, lower recovery lane shortcut, Scout Shelter pocket, early Arc/Disc prototypes, field-event rewards/ambushes and far-east Motel Breach. Route arrows target the nearest useful unvisited marker instead of stale skipped signs, and focused first-three AI now reaches Town 6/6; remaining review is subjective feel plus broader route regression.',
  },
  {
    region: 'Motel Circuit',
    purpose: 'Scanner avoidance and controlled pressure',
    objective: 'Infiltrate the scanner grid using Boost and disable the Scanner Core.',
    traversal: 'Parking-lot route into town streets; Signal Tube candidate.',
    combat: 'Arc Blade parry timing and scanner beam counterplay.',
    secret: 'Ghost Check-In bonus for phasing every scanner offline without alert.',
    connection: 'Motel access road feeds Chagrin Falls Town.',
    state: 'IN DEVELOPMENT; gameplay-design/content pass is live with motel entry, safe-shadow parking, optional Room Row stealth branch, Boost-only Maintenance Pocket, Pool Courtyard scanner crossing, Service Lot fallback, motel sign ledge recovery cache, early Safe Battery recovery, field-event rewards/ambushes, early Arc/Disc prototypes and River Road/Town breach. Route signs now use place/task names such as Scanner Core instead of ambiguous gate/circuit copy. Scanner labels read as scanner hazards, endpoints use scanner hardware sprites, HUD progress says scanners offline instead of gate wording, scanners disappear after route-open, and all-scanners-offline/no-alert clears award Ghost Check-In. Needs subjective stealth feel review.',
  },
  {
    region: 'Chagrin Falls Town',
    purpose: 'Cover-based street combat and weapon switching',
    objective: 'Destroy the River Road scanner tower using cover and alternate routes.',
    traversal: 'Town gate / bridge path toward Patterson’s Orchard.',
    combat: 'Mix Pulse pressure, Arc close control and Recall Disc pathing.',
    secret: 'Recall Disc distant switch / weapon-specific reward.',
    connection: 'Town edge road leads to orchard route.',
    state: 'IN DEVELOPMENT; gameplay-design/content pass is live with Main Street, Neighborhood Block/Market Alley upper route, Bridge Overlook sniper/cache beat, River Walk lower shortcut, River Road Tower objective, expanded Stadium Road recovery space, stadium back alley, field-event rewards/ambushes, early Arc/Disc prototypes and Orchard Gate reward/transition. Dedicated town art still later.',
  },
  {
    region: "Patterson's Orchard",
    purpose: 'Traversal puzzle and route memory',
    objective: 'Redirect the Orchard Gravity Well, reach the raised ridge and open the Crop Circle route.',
    traversal: 'Playable Gravity Well launch to a raised-ridge cache.',
    combat: 'Recall Disc crowd-control lanes and moving orchard pressure.',
    secret: 'Hidden Scout shelter or underground signal pocket.',
    connection: 'Orchard breach opens to Signal Storm.',
    state: 'IN DEVELOPMENT; gameplay-design/content pass is live with tractor lane, Lower Creek secret puzzle pocket, required Gravity Well launch, Raised Ridge reward/switch step, West Rows Recall lane, East Rows pressure lane, Scout Shelter loop, storm-fence shortcut, field-event rewards/ambushes and Crop Circle gate. HUD copy and phased signs now guide Gravity Well first, then Crop Circle; focused Orchard AI reached 6/6 completions. Deeper puzzle combinations deferred.',
  },
  {
    region: 'Signal Storm',
    purpose: 'Memorable final encounter for the slice',
    objective: 'Break the Storm Classifier and refuse the Engine’s classification.',
    traversal: 'Corrupted passage arrival; no menu return during route.',
    combat: 'Final mix of weapon switching, stagger, parry and overdrive.',
    secret: 'Post-fight Scout transmission / archive reward.',
    connection: 'End of current vertical slice.',
    state: 'IN DEVELOPMENT; gameplay-design/content pass is live with entry recovery lane, Classifier Core phase-one objective, West/East Relay Wing phase-two targets, North Rift phase-three/finale anchor, coil pockets, pressure pockets, real recovery pockets and field-event rewards/ambushes. Needs authored boss behavior/presentation later.',
  },
];

export const BUILD_TODO: TodoItem[] = [
  { label: 'Top-down-only scene registry', done: true },
  { label: 'Unified top-down player controller', done: true },
  { label: 'Unified top-down camera', done: true },
  { label: 'Route-connected Miller Surface → Motel Circuit → Town → Orchard → Signal Storm arena chain', done: true },
  { label: 'Shared save state across area transitions', done: true },
  { label: 'Single-save main menu flow: Continue / New Game only', done: true },
  { label: 'Named region goals with visible reward/route feedback', done: true },
  { label: 'Enemy waves, elites, pickups, caches and overdrive', done: true },
  { label: 'Three-weapon foundation: Pulse Carbine, Arc Blade, Recall Disc', done: true },
  { label: 'In-world weapon pickup names and role descriptions', done: true },
  { label: 'Vertical-slice scope audit documented', done: true },
  { label: 'Command Center world-area tracking', done: true },
  { label: 'Touch, keyboard, mouse and gamepad controls', done: true },
  { label: 'Signal Sets, portraits and reward archive; Wardrobe / Signal Skins cut from active gameplay', done: true },
  { label: 'Smoke test for boot, play, Command Center, full route transition, quit-to-menu and dev warps', done: true },
  { label: 'Fast weapon switching across keyboard, mouse wheel, gamepad and touch', done: true },
  { label: 'Phase Boost as a held movement mechanic with boost meter drain/regeneration, scanner crossing and brief i-frame counterplay', done: true },
  { label: 'Region-specific objectives and first traversal identity pass', done: true },
  { label: 'Combat hitbox/contact-pressure fix: standing still can kill the player and visible hits register more reliably', done: true },
  { label: 'Enemy archetype validation: every enemy moves or is intentionally rooted, and every enemy can be killed by real projectiles', done: true },
  { label: 'Route objective hardening: charge plus minimum progress actions before breach opens', done: true },
  { label: 'Enemy AI hardening: walkable path field, stuck recovery, ranged strafe and safe spawn/exit marker resolution', done: true },
  { label: 'AI Player Lab campaign runner and latest evidence export', done: true },
  { label: 'Focused Miller → Motel → Town AI route scenarios and visible route beacons', done: true },
  { label: 'Holographic route signposts with phase-specific objective/exit visibility', done: true },
  { label: 'Experimental Tripo CONTACT-47 rendered sprite import with old-character fallback', done: true },
  { label: 'Route sign readability/depth polish: raised high-contrast foreground signs with proximity fade', done: true },
  { label: 'First pass: expand all five route regions while preserving camera, actor size and prop scale', done: true },
  { label: 'Miller schematic-first larger map with main route, optional branches, secret pockets and coherent Motel breach', done: true },
  { label: 'Motel schematic-first larger map with scanner route, optional room-row branch, maintenance pocket, service-lot loop and Town breach', done: true },
  { label: 'Town schematic-first larger map with Main Street, neighborhood/market approach, bridge, river-walk shortcut, Stadium Road and Orchard Gate', done: true },
  { label: 'Orchard schematic-first larger map with Gravity Well, lower creek, raised ridge, Scout shelter loop and storm breach', done: true },
  { label: 'Signal Storm schematic-first finale arena with Classifier core, north rift, relay wings, pressure pockets and recovery pockets', done: true },
  { label: 'Generated top-down map schematics in MAP_SCHEMATICS.md and docs/map-schematics/*.svg', done: true },
  { label: 'First pass: update route signs, Motel scanners and Orchard Gravity Well coordinates for expanded layouts', done: true },
  { label: 'Gameplay-design pass: every map has main route, optional branch, secret pocket, shortcut/return loop, reward pocket and intentional enemy spaces', done: true },
  { label: 'Orchard Crop Circle now requires the Gravity Well/raised-ridge traversal beat before fully opening', done: true },
  { label: 'Signal Storm finale waves now use named staged phases instead of anonymous wave banners', done: true },
  { label: 'HD environmental blocker dressing added so solid edges read more like woods, motel service clutter, town streets, orchard rows or signal wreckage', done: true },
  { label: 'Authored field-event reward pockets added across all five route maps with purpose-labeled markers, shards, health, overdrive, weapon prototypes, Scout boons and ambush hooks', done: true },
  { label: 'Weapon feel pass: faster Pulse pressure, wider Arc Blade parry burst, consistent Recall Disc return trail and stronger shared hit feedback', done: true },
  { label: 'Pickup correctness pass: weapon pickup labels/equip messages now resolve from the actual weapon id and stack labels to reduce overlap', done: true },
  { label: 'Sign/label clearance pass: field-event and pickup labels avoid active route signs instead of stacking over road wording', done: true },
  { label: 'Subtle explored-area lighting pass: unvisited HD rooms start slightly dim and fade open as CONTACT-47 reaches them', done: true },
  { label: 'AI Player Lab visible perception now includes nearby field-event signal markers so bots can investigate rewards without hidden trigger knowledge', done: true },
  { label: 'Focused AI route-fix campaign run: prior 100-run motel-orchard sample had 37% objective completion, 0 soft-lock risks, 2 deaths, Arc underuse, 60 ignored-reward events, and confirmed Orchard closure/reward clarity as major friction', done: true },
  { label: 'Random structure cleanup: flat nonfunctional landmarks no longer spawn as confusing walk-through objects in central route spaces', done: true },
  { label: 'AI human-behavior pass: personas now fight/evade visible threats before resuming visible objectives, rewards, scanners and route signs', done: true },
  { label: 'Objective tuning pass: Miller/Motel/Town/Orchard thresholds are less brittle; rebuilt 24-run region campaign improved to 45.8% with 0 soft locks/deaths', done: true },
  { label: 'Orchard Gravity Well clarity pass: auto-entry launch, wider interact range and tighter GRAVITY WELL sign visit radius are live; Orchard still needs stronger in-world route clarity', done: true },
  { label: 'Damage-only camera shake pass: routine shooting, impacts, kills, rewards, scanners, overdrive and traversal no longer shake the camera; player damage uses one restrained shake', done: true },
  { label: 'Orchard HUD clarity pass: objective copy now explicitly guides LOWER ROWS → Gravity Well before launch and Raised Ridge → Crop Circle after launch', done: true },
  { label: 'Notification/reward cleanup: routine objective entry no longer fires a giant center banner, center HUD callouts queue briefly, and important weapon pickups fire queued reward cards', done: true },
  { label: 'Activity-feed cleanup: combat toasts are capped at two with shorter routine dwell, while important route/reward/alert toasts stay readable', done: true },
  { label: 'Pickup correctness fix: random health drops no longer retain random weapon ids in telemetry or pickup labels', done: true },
  { label: 'Arc incentive pass: important Arc pickups advertise PARRY/CLOSE and AI personas can prefer Arc against visible warden/splitter/turret roles without hidden navigation state', done: true },
  { label: 'AI campaign runner fix: singular/plural scenario env aliases and report-label aliases are supported, quick campaigns print progress every run, and Orchard objective telemetry now records Gravity Well required/used state', done: true },
  { label: 'Orchard Gravity Well order pass: Crop Circle pre-well charge caps at 72%, CROP CIRCLE signs hide until the well is used, and `orchard-ai-gravity-priority-v1` improved focused Orchard AI completion from 2/6 to 6/6', done: true },
  { label: 'First pass: validate expanded route geometry, combat archetypes, smoke route, typecheck and production build', done: true },
  { label: 'Next: manual feel pass for travel time, empty space, cover placement, route readability and reward motivation on expanded maps', done: false },
  { label: 'Miller exit breadcrumb fix: East Road → Road Bend → Breach Road → Motel Breach supports the current 6/6 focused first-three AI baseline', done: true },
  { label: 'Motel scanner readability pass: ambiguous gate-style wording removed, active scanners read as red security hazards, and scanners vanish from player/AI perception once the route opens', done: true },
  { label: 'AI campaign isolation pass: campaign runner uses process-specific strict preview ports so parallel/leftover servers cannot contaminate results', done: true },
  { label: 'AI Player Lab trace pass: reports now include objective target labels, decision traces and stall samples, and recovered stuck events no longer automatically count as soft locks', done: true },
  { label: 'First-three route regression evidence: `first-three-route-regression-v8` reached 6/6 Miller→Motel→Town completions with 0 deaths and 0 soft-lock-risk stalls', done: true },
  { label: 'Route-marker targeting fix: objective arrows now pick the nearest unvisited useful route marker instead of sending players back to skipped signs', done: true },
  { label: 'Field-event marker purpose pass: reward markers now read as CACHE, RECOVERY, SCOUT TECH, WEAPON or OVERDRIVE instead of generic action plates', done: true },
  { label: 'Motel purpose/readability pass: ambiguous Circuit/Gate wording replaced with Scanner Core/place names, scanner endpoints now look like devices, active beams read red, and perfect scanner clearance awards Ghost Check-In', done: true },
  { label: 'Movement update: old tap dash/teleport replaced with hold-to-boost on keyboard, controller, touch and AI input; boost energy now drains and regenerates in HUD/tests', done: true },
  { label: 'Boost HUD/trail readability: top-down HUD shows a BOOST meter with full/empty feedback, and CONTACT-47 leaves a capped fading cyan hover-fire trail while moving', done: true },
  { label: 'Miller Boost washout trial: two red corrupted traversal cracks block normal walking and allow held-Boost crossing, with smoke coverage and schematic markers', done: true },
  { label: 'Gameplay screen filters: settings dropdown plus 0-100 intensity slider now applies to the top-down world camera at reduced gameplay strength, with smoke coverage', done: true },
  { label: 'Environment-depth pass: shared HD terrain now adds biome-specific ground wear, medium/tall silhouettes, foreground framing, local named-area dressing and data-driven elevation zones with stronger follow-camera offset/zoom without changing collision/routes', done: true },
  { label: 'Motel/Town roof readability fix: ambiguous car landmark removed from auto-placement and hard-edge solid areas now get parapets, vents, pipes, service boxes and roof damage', done: true },
  { label: 'Major reward modal pass: weapon, trophy and major reward cards now pause gameplay in a centered read-and-continue modal and queue one at a time', done: true },
  { label: 'Tactical enemy pass: CIPHER, GRAVITON, UNDERTOW, DECOY and DORMANT are live with centralized Pulse/Arc/Kinetic/Blast affinities, WEAK/RESIST feedback, per-level rosters, bestiary entries and killability validation', done: true },
  { label: 'Camera/settings/title pass: global gameplay camera is pulled farther back, CRT defaults off, CONTACT light defaults off with a settings toggle, and the main menu radar hero uses the Tripo CONTACT-47 render', done: true },
  { label: 'Loot/projectile VFX pass: important pickup art is larger and glossy signal-vault-like, Pulse bolts have brighter laser trails, Arc Blade draws a stronger slash wedge, and grouped reward cards reduce end-of-level modal spam', done: true },
  { label: 'Progression/motivation package: Miller mutation choice, Motel Phase Boost+, Town Scout Relay Pylon defense beat, Orchard Scan Memory secret chain and Signal Storm relay gate', done: true },
  { label: 'Crash Site Onboarding package: Miller cold-start now has non-combat recovery, Scout/kid context, Spark Line scan, first-kit recovery, delayed enemy wake and smoke coverage', done: true },
  { label: 'iPad UI cleanup: touch controls now use separated FIRE/BOOST/SCAN/WPN/ECHO/ACT buttons, hide keyboard hint chips, lift vitals above the stick, and keep dev warps in a compact side rail with tablet regression coverage', done: true },
  { label: 'Rejected route experiments documented: lower-road relocation and Motel Check-Out breadcrumb both produced worse focused samples and were reverted', done: true },
  { label: 'Rejected breadcrumb experiment: moving Miller exit routing to the lower road collapsed first-three completion to 0/6, so it was reverted', done: true },
  { label: 'Next: continue automated first-route route-following and reduce remaining Motel/Town route-forwarding stalls', done: false },
  { label: 'Later: resume AI Player Lab route-guidance safety after all route layouts are stable', done: false },
  { label: 'Next: AI full-route completion after the first three-region route stabilizes', done: false },
  { label: 'Next: deeper stealth alert rules and weapon-specific secret gates', done: false },
  { label: 'Next: test and polish the first live mutation hooks before adding more', done: false },
];

export const ART_DIRECTION: string[] = [
  'Dreamlike Rural Pixel Sci-Fi: dusk streets, wooded routes, signal-lit terrain, lonely towers, motel neon, orchard paths, and town landmarks.',
  'The playable world renders through the top-down Phaser scene with y-sorted actors, readable cover, environmental obstacles, signal-colored affordances, layered low/medium/tall environment dressing and data-driven elevation zones that subtly shift follow-camera offset/zoom.',
  'Named areas must visibly earn their labels: Main Street needs street language, Motel pockets need parking/rooms/pool/service hardware, Orchard rows need crop/ridge/creek structure, and Signal Storm spaces need core/relay/rift staging.',
  'Palette remains warm midnight with electric-lime signal, amber chrome, red classification danger, and Scout identity colors.',
  'Color stays vivid, but threat areas need harder contrast: deeper shadows, dirty terrain, broken streets, damaged machinery, emergency light, smoke and corrupted signal scars.',
  'Combat effects should read as forceful machine damage: sparks, debris, oil-dark scorch, electrical discharge, short hit pause/shake and heavier enemy stagger.',
  'Avoid childish presentation: no confetti-like ordinary actions, toy-like important rewards, bubbly UI motion, or jokes that deflate serious threats.',
  'Most Chagrin Falls structures are exterior obstacles, cover, streets, alleys, landmarks, and route boundaries.',
  'Silhouettes, shadow, glow, scan ripples, restrained Phase Boost echoes, damage-only camera shake, and glitch flashes sell motion without needing heavy asset churn.',
];

export const HUMAN_PLAYTEST_CHECKLIST: string[] = [
  'Does the top-down movement feel responsive on keyboard, mouse, touch, and gamepad?',
  'Do Pulse Carbine, Arc Blade, and Recall Disc feel meaningfully different?',
  'If the player stands still near enemies, do contact pressure and enemy bolts kill at a fair but dangerous pace?',
  'Do visible player shots reliably hit enemies at the apparent sprite scale?',
  'Do major weapon pickups explain what they are before collection?',
  'Do area transitions read as one route instead of a level-select sequence?',
  'Does save/continue preserve the current area and player progress?',
  'Are Signal Nodes, breaches, caches, enemies, and pickups readable without extra text?',
  'Does the Command Center describe only the current top-down structure?',
  'Does the game remain playable on iPhone and iPad in landscape and portrait?',
  'Does the installed PWA launch after an offline reload once it has been opened online?',
];

export const WEB_TECH_NOTES: string[] = [
  'Phaser 3 WebGL renderer with automatic Canvas fallback.',
  'Hybrid procedural art and authored top-down assets loaded at boot.',
  'WebAudio-synthesized SFX with no required audio asset pipeline.',
  'CRT/scanline/vignette via CSS overlays, plus WebGL post-process screen filters on title and top-down world cameras.',
  'Single-run localStorage save with legacy-key migration.',
  'PWA install/offline: manifest, icons and static service worker cache.',
  'Responsive shell UI with touch controls for phone and tablet play.',
  'Static Vite build ready for GitHub/Vercel deployment.',
];
