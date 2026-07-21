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
  'All current route regions render through the HD top-down pipeline. Chagrin Falls Town currently reuses the hard-edge HD town/lot asset vocabulary until a dedicated topdown-z3 pack exists.',
  'One canonical save exists at localStorage blip_save_v1; no alternate save files or file picker are part of the game.',
  'Region transitions preserve runtime health, equipped weapon, overdrive, boons, inventory/save progress and world flags.',
  'Current weapon foundation is Pulse Carbine, Arc Blade and Recall Disc. Older weapon names are future mutation ideas, not live standalone weapons.',
  'Combat collision was corrected: HD-sized player/enemy/projectile hitboxes are live, enemy close-range pressure damages within a threat radius, and standing still in Miller now reaches Game Over instead of being harmless.',
  'Region objectives now use named goals and rewards instead of presenting every area as the same generic node loop.',
  'Phase Shift is the current SHIFT ability: a short-range teleport with i-frames, start/end bursts and cooldown. The label Dash should not be used for new design docs.',
  'Focused first-route AI testing is wired for Miller → Motel and Miller → Motel → Town arrivals, but extended AI validation is paused for the next overnight campaign. The latest retained-code 18-run sample was a heuristic playtest signal, not a deploy gate: 61.1% scenario completion overall, 0 soft-lock flags, 2 deaths, Miller → Motel at 83.3%, and Miller → Motel → Town still weak at 16.7%. A later experiment regressed and was not kept.',
  'Experimental Tripo CONTACT-47 model import is live as a rendered eight-facing transparent PNG set with the original HD CONTACT-47 atlas kept as fallback. CONTACT-47 now reads as a low-hover robot with cyan underside thrusters, which covers the missing leg animation. The GLB has a skin but no animation clips, so walk/shoot animation remains a future rigging/retarget pass.',
  'Tone target is stylized teen/young-adult sci-fi action: colorful and strange, but dangerous, mysterious, forceful and never toy-like.',
];

export interface MechanicDef {
  name: string;
  description: string;
}

export const MECHANICS: MechanicDef[] = [
  { name: 'Move / Aim / Fire', description: 'The whole game uses one top-down controller: 8-directional movement, mouse or right-stick aim, and responsive combat.' },
  { name: 'Combat Collision', description: 'HD-sized hitboxes, enemy contact pressure and shorter post-hit invulnerability make idle play punishable and shots land closer to what the player sees.' },
  { name: 'Phase Shift', description: 'A short-range blink with afterimages and brief invulnerability. Use it to reposition, cross scanner pressure and dodge Classifier beams.' },
  { name: 'Scan Pulse', description: 'An expanding ring that stuns nearby threats, reveals caches and scout marks, and makes hidden signal routes readable.' },
  { name: 'Route-Connected Areas', description: 'Miller Surface, Motel Circuit, Chagrin Falls Town, Patterson’s Orchard, and Signal Storm are separate top-down arena maps linked by gates, roads, trails, bridges, and signal breaches.' },
  { name: 'Region Goals', description: 'Each area now has named objective language, a visible reward and a route-opening payoff instead of generic node-only framing.' },
  { name: 'Scout Trails', description: 'The Five Signal Scouts left badges, logs, relics, portraits, and route hints. Their frequencies unlock sidegrade skins and in-run boons.' },
  { name: 'Signal Caches', description: 'Buried caches become collectible when scanned. They feed shards, cosmetics, trophy progress, and reward archive entries.' },
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
  { action: 'Phase Shift', keys: 'SHIFT' },
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
  { action: 'Phase Shift', keys: 'RB / LB · R1 / L1' },
  { action: 'Scan Pulse', keys: 'Y / LT · Triangle / L2' },
  { action: 'Interact / Overdrive', keys: 'B · Circle' },
  { action: 'Pause', keys: 'START · OPTIONS' },
  { action: 'Command Center', keys: 'BACK · SHARE' },
  { action: 'Menus', keys: 'D-pad / stick + A · Cross' },
];

export const CONTROLS_TOUCH: ControlRow[] = [
  { action: 'Move', keys: 'virtual stick' },
  { action: 'Fire', keys: 'large FIRE button' },
  { action: 'Fire / Carbine', keys: '◎ button' },
  { action: 'Switch weapon', keys: 'WPN button' },
  { action: 'Scan', keys: '((·)) button' },
  { action: 'Phase Shift', keys: '» button' },
  { action: 'Interact / Overdrive', keys: 'E button' },
  { action: 'Pause', keys: 'pause pip' },
];

export const CONTROLS_SWEEP: ControlRow[] = [
  { action: 'Move', keys: 'WASD / arrows · left stick' },
  { action: 'Aim', keys: 'Mouse · right stick' },
  { action: 'Fire', keys: 'Left click / X · RT' },
  { action: 'Switch weapon', keys: '1 / 2 / 3 · mouse wheel · R · stick-clicks · WPN' },
  { action: 'Phase Shift', keys: 'SHIFT · shoulder button' },
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
  { action: 'Cycle skins', keys: 'F6' },
  { action: 'God mode', keys: 'G' },
];

export interface TodoItem {
  label: string;
  done: boolean;
}

export interface SliceSystemItem {
  name: string;
  status: 'PLAYABLE' | 'IN DEVELOPMENT' | 'PLANNED' | 'NEEDS ASSETS' | 'NEEDS POLISH' | 'TESTED' | 'DEFERRED';
  note: string;
}

export const VERTICAL_SLICE_SYSTEMS: SliceSystemItem[] = [
  { name: 'Connected top-down route chain', status: 'TESTED', note: 'Separate arena maps linked by fast breach handoffs; not a seamless open map. Route changes require the actual charged breach, not broad road rectangles.' },
  { name: 'Single-save flow', status: 'TESTED', note: 'Main menu has Continue/New Game only; pause has Quit to Menu, which resumes from autosave.' },
  { name: 'Dev region warps', status: 'PLAYABLE', note: 'Local/test menu warp buttons jump to each current region for fast QA.' },
  { name: 'Pulse Carbine', status: 'PLAYABLE', note: 'Fast ranged fire; every fifth standard shot pierces.' },
  { name: 'Arc Blade', status: 'PLAYABLE', note: 'Close-range combo foundation with parry/reflection behavior.' },
  { name: 'Recall Disc', status: 'PLAYABLE', note: 'Outbound and return damage path for positioning-focused combat.' },
  { name: 'Fast weapon switching', status: 'PLAYABLE', note: 'Keyboard 1/2/3/R, mouse wheel, gamepad stick-clicks and touch WPN.' },
  { name: 'Combat collision / damage pressure', status: 'TESTED', note: 'Idle Miller test reaches GameOver; active firing test kills enemies and advances objective charge.' },
  { name: 'Tripo CONTACT-47 model import', status: 'IN DEVELOPMENT', note: 'Optimized GLB, eight full-body transparent rendered facings and cyan low-hover thrusters are live. Old CONTACT-47 remains fallback. No GLB animations exist yet.' },
  { name: 'Major loot presentation', status: 'NEEDS POLISH', note: 'Weapon pickups show names/roles; full compare/equip/store/salvage flow is not built yet.' },
  { name: 'Region-specific objectives', status: 'PLAYABLE', note: 'HUD, telemetry and rewards use named goals/rewards for each region.' },
  { name: 'Phase Shift', status: 'PLAYABLE', note: 'SHIFT is now a short-range teleport with i-frames, visual bursts and cooldown.' },
  { name: 'Motel stealth onboarding', status: 'IN DEVELOPMENT', note: 'Scanner beams, alert state, Phase Shift prompt and combat fallback are live. Alerts now add pressure without direct beam damage, but Motel still needs a focused clarity pass before claiming reliable Town arrivals.' },
  { name: 'First-route clarity', status: 'NEEDS POLISH', note: 'Phase-specific holographic route signposts are live. Broad road auto-warp zones were removed; transitions now require a short hold inside the actual charged breach. Miller → Motel is much more reliable; Motel → Town still needs a focused pass.' },
  { name: 'Enemy combat roles', status: 'PLAYABLE', note: 'Drifter, tagger, diver, warden, turret, sniper, splitter and weaver are live.' },
  { name: 'Signal Tube', status: 'PLANNED', note: 'One simple traversal route first; future branching deferred.' },
  { name: 'Gravity Well', status: 'IN DEVELOPMENT', note: 'Orchard has a playable introductory launch to a raised ridge; deeper object/enemy redirection is deferred.' },
  { name: 'Phase Door', status: 'PLANNED', note: 'Frequency barrier gated by scan/Phase Shift rules.' },
  { name: 'Signal Rail', status: 'DEFERRED', note: 'Track in the design, but do not build until the slice needs faster traversal.' },
  { name: 'Scout Contraptions', status: 'PLANNED', note: 'One story-tied route device or secret opener in the first slice.' },
  { name: 'Raised / underground spaces', status: 'IN DEVELOPMENT', note: 'Orchard raised ridge is playable; underground shelters remain planned.' },
  { name: 'AI Player Lab', status: 'TESTED', note: 'Personas, campaign runner, evidence JSON and E2E coverage are live. Overnight/full-route AI campaigns are intentionally deferred for now; current deployment relies on hard gates plus the retained focused sample notes.' },
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
    state: 'PLAYABLE; named objective/reward is live.',
  },
  {
    region: 'Motel Circuit',
    purpose: 'Scanner avoidance and controlled pressure',
    objective: 'Infiltrate the scanner grid using Phase Shift and disable the motel circuit.',
    traversal: 'Parking-lot route into town streets; Signal Tube candidate.',
    combat: 'Arc Blade parry timing and scanner beam counterplay.',
    secret: 'Stealth reward behind a detection route.',
    connection: 'Motel access road feeds Chagrin Falls Town.',
    state: 'IN DEVELOPMENT; scanner beams, alert state, Phase Shift prompt and softer combat fallback are live, but focused AI still stalls here most often.',
  },
  {
    region: 'Chagrin Falls Town',
    purpose: 'Cover-based street combat and weapon switching',
    objective: 'Destroy the River Road scanner tower using cover and alternate routes.',
    traversal: 'Town gate / bridge path toward Patterson’s Orchard.',
    combat: 'Mix Pulse pressure, Arc close control and Recall Disc pathing.',
    secret: 'Recall Disc distant switch / weapon-specific reward.',
    connection: 'Town edge road leads to orchard route.',
    state: 'PLAYABLE; cover/tower identity is clearer, dedicated town art still later.',
  },
  {
    region: "Patterson's Orchard",
    purpose: 'Traversal puzzle and route memory',
    objective: 'Redirect the Orchard Gravity Well, reach the raised ridge and break the Maze Heart.',
    traversal: 'Playable Gravity Well launch to a raised-ridge cache.',
    combat: 'Recall Disc crowd-control lanes and moving pressure.',
    secret: 'Hidden Scout shelter or underground signal pocket.',
    connection: 'Orchard breach opens to Signal Storm.',
    state: 'PLAYABLE; first traversal mechanic is live, deeper puzzle combinations deferred.',
  },
  {
    region: 'Signal Storm',
    purpose: 'Memorable final encounter for the slice',
    objective: 'Break the Storm Classifier and refuse the Engine’s classification.',
    traversal: 'Corrupted passage arrival; no menu return during route.',
    combat: 'Final mix of weapon switching, stagger, parry and overdrive.',
    secret: 'Post-fight Scout transmission / archive reward.',
    connection: 'End of current vertical slice.',
    state: 'PLAYABLE finale base; needs a larger bespoke boss presentation later.',
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
  { label: 'Signal Skins, Signal Sets, portraits and reward archive', done: true },
  { label: 'Smoke test for boot, play, Command Center, full route transition, quit-to-menu and dev warps', done: true },
  { label: 'Fast weapon switching across keyboard, mouse wheel, gamepad and touch', done: true },
  { label: 'Phase Shift as a scoped combat/exploration mechanic', done: true },
  { label: 'Region-specific objectives and first traversal identity pass', done: true },
  { label: 'Combat hitbox/contact-pressure fix: standing still can kill the player and visible hits register more reliably', done: true },
  { label: 'AI Player Lab campaign runner and latest evidence export', done: true },
  { label: 'Focused Miller → Motel → Town AI route scenarios and visible route beacons', done: true },
  { label: 'Holographic route signposts with phase-specific objective/exit visibility', done: true },
  { label: 'Experimental Tripo CONTACT-47 rendered sprite import with old-character fallback', done: true },
  { label: 'Route sign readability/depth polish: raised high-contrast foreground signs with proximity fade', done: true },
  { label: 'Next: improve route-following after breach=true, especially Motel exit to Town', done: false },
  { label: 'Next: AI full-route completion after the first three-region route stabilizes', done: false },
  { label: 'Next: deeper stealth alert rules and weapon-specific secret gates', done: false },
  { label: 'Next: weapon mutation tree and equip/store/salvage decisions', done: false },
];

export const ART_DIRECTION: string[] = [
  'Dreamlike Rural Pixel Sci-Fi: dusk streets, wooded routes, signal-lit terrain, lonely towers, motel neon, orchard paths, and town landmarks.',
  'The playable world renders through the top-down Phaser scene with y-sorted actors, readable cover, environmental obstacles, and signal-colored affordances.',
  'Palette remains warm midnight with electric-lime signal, amber chrome, red classification danger, and Scout identity colors.',
  'Color stays vivid, but threat areas need harder contrast: deeper shadows, dirty terrain, broken streets, damaged machinery, emergency light, smoke and corrupted signal scars.',
  'Combat effects should read as forceful machine damage: sparks, debris, oil-dark scorch, electrical discharge, short hit pause/shake and heavier enemy stagger.',
  'Avoid childish presentation: no confetti-like ordinary actions, toy-like important rewards, bubbly UI motion, or jokes that deflate serious threats.',
  'Most Chagrin Falls structures are exterior obstacles, cover, streets, alleys, landmarks, and route boundaries.',
  'Silhouettes, shadow, glow, scan ripples, afterimages, screen shake, and glitch flashes sell motion without needing heavy asset churn.',
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
  'CRT/scanline/vignette via CSS overlays.',
  'Single-run localStorage save with legacy-key migration.',
  'PWA install/offline: manifest, icons and static service worker cache.',
  'Responsive shell UI with touch controls for phone and tablet play.',
  'Static Vite build ready for GitHub/Vercel deployment.',
];
