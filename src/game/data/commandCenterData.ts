/**
 * Command Center copy — mechanics, controls, build checklist, art direction.
 * Keep this file in sync with what is actually implemented (playtest-qa skill).
 */

export const PITCH =
  'BLIP is a side-scrolling pixel signal adventure: you are CONTACT-47, the thing on the radar, ' +
  'platforming through dreamlike rural dusk to collect Signal Fragments before the Interpretation Engine finishes deciding what you are.';

export const TAGLINE = 'You are the thing on the radar.';
export const SUBTITLE = 'A pixel signal adventure about staying unknown.';

export interface MechanicDef {
  name: string;
  description: string;
}

export const MECHANICS: MechanicDef[] = [
  { name: 'Run / Jump / Hover', description: 'Momentum platforming with coyote time and jump buffering. Hold JUMP in the air to hover on thrusters — it drains signal energy, which refills on the ground.' },
  { name: 'Phase Drift (Dash)', description: 'A short dash with afterimages and brief invulnerability. Dash through bolts, across pits, and out of red cones.' },
  { name: 'Pulse Shot', description: 'Your only weapon and your puzzle tool: damages drones, cracks the boss core, and activates Blipstream node switches.' },
  { name: 'Scan Pulse', description: 'An expanding ring that reveals what the Interpretation Engine cannot see: hidden platforms, Will’s route markers, scout caches — and the boss’s weak point.' },
  { name: 'Detection & Classification', description: 'Red cones do not see you — they decide you. Standing in one fills the classification meter: UNKNOWN → ANOMALY → THREAT. At THREAT, drones believe the label and attack harder. It decays when you stay out of the light.' },
  { name: 'Blipstream Nodes', description: 'Beam into the inside of the Signal: abstract waveform rooms of glowing platforms, red static and routing logic. Solving a node changes Miller Field outside.' },
  { name: 'Scout Trails', description: 'The Five Signal Scouts left badges, logs and markers. Scanning strange places reveals their paths; collecting their things unlocks their Command Center files.' },
  { name: 'Boss: Scan → Expose → Pulse', description: 'The Scarecrow Antenna hides its core. Scan to expose it for a few seconds, then hit it with pulse shots while dodging rotating beams and radial static.' },
  { name: 'Top-down Scan (combat mode)', description: 'The perspective-shift half of BLIP. The Interpretation Engine "surfaces" you onto its overhead SCAN — the same terrain seen from above — where the pressure becomes twin-stick combat: roam an open space (camera follows), AIM with the mouse, and blast the drones trying to tag you. Slain drones drop pickups (health / SPREAD / RAPID); a "heat" meter ramps the hunt the longer you linger. Reach the BREACH to Fold onward.' },
  { name: 'The Fold', description: 'BLIP’s signature transition between side-view and top-down. A flash-masked collapse (signal bloom + static + a camera punch) hands off between the two views — fiction: the Engine changing HOW it observes you. The game cold-opens in the top-down Scan, then Folds down into Miller Field.' },
  { name: 'Charge the Node', description: 'The top-down objective: the central Signal Node must be CHARGED before the BREACH opens. Killing drones charges it — kills right next to the node count double. Turns "walk to the exit" into a real fight for the middle of the arena.' },
  { name: 'Scout Boons', description: 'The Five Signal Scouts lend you their frequencies mid-fight. Scout-colored boons (dropped by the Elite) grant a run buff in that scout’s style: WILLOW wider scan + reveals every cache · SPARK rapid fire · ANCHOR heal + shield · ECHO spread shot · ROCKET fire-rate overdrive.' },
  { name: 'Signal Caches (Scan secrets)', description: 'Hidden caches lie buried in the top-down arena, invisible until a SCAN pulse reveals and grabs them for a shard payout — Scan does double duty as a treasure-finder, not just a stun.' },
  { name: 'The Classifier (Elite)', description: 'A tanky elite drone guards the node and sweeps a telegraphed scan-beam — an amber wind-up locks its aim, then a red beam fires; get caught and your heat spikes hard. Kill it for a guaranteed Scout Boon + shard cache. Dodge the beam with a well-timed dash.' },
  { name: 'Dash-chain (Phase flow)', description: 'A Phase-Strike kill (dashing through a drone with the ROCKET set) instantly refunds your dash — chain dashes through a whole pack for a euphoric flow, the way the best twin-stick shooters reward aggression.' },
  { name: 'Weapon Roster (top-down)', description: 'One gun forever is boring — the Scan mode carries a real arsenal, swapped by pickups dropped mid-fight. PULSE (accurate single bolt, the default) · SCATTER (shotgun spray — six short-range pellets) · REPEATER (machine-gun stream, fast + loose) · LANCE (piercing spear that skewers a whole line of drones) · ECHO ARC (ricochet bolt that bounces off walls). Grab a weapon pickup to equip it; PULSE is always your fallback. Scout Boons still layer buffs on top (SPARK→Repeater, ECHO→Arc).' },
  { name: 'Signal Overdrive (ultimate)', description: 'Your ultimate. The OVERDRIVE meter charges as you kill — combo kills charge it faster. At full, press [E] to detonate: a signal shockwave clears nearby drones instantly, then ~4 seconds of doubled fire-rate. The meter drains on use and rebuilds from the next kills. Save it for when the arena swarms.' },
];

export interface ControlRow {
  action: string;
  keys: string;
}

export const CONTROLS_FIELD: ControlRow[] = [
  { action: 'Move', keys: 'A / D or ← / →' },
  { action: 'Jump', keys: 'SPACE / W / ↑' },
  { action: 'Hover', keys: 'hold JUMP in the air' },
  { action: 'Dash (Phase Drift)', keys: 'SHIFT' },
  { action: 'Pulse Shot', keys: 'X or LEFT CLICK' },
  { action: 'Scan Pulse', keys: 'Q or RIGHT CLICK' },
  { action: 'Interact / Enter Node', keys: 'E' },
  { action: 'Echo Blink (place / return)', keys: 'F' },
  { action: 'Command Center', keys: 'C or TAB' },
  { action: 'Pause', keys: 'ESC' },
];

export const CONTROLS_BLIPSTREAM: ControlRow[] = [
  { action: 'Move / Jump / Hover / Dash', keys: 'same as field' },
  { action: 'Activate node switch', keys: 'PULSE SHOT [X]' },
  { action: 'Exit through the gate', keys: 'E at the open gate' },
];

export const CONTROLS_GAMEPAD: ControlRow[] = [
  { action: 'Move', keys: 'Left stick / D-pad' },
  { action: 'Jump / Hover', keys: 'A · ✕ (hold to hover)' },
  { action: 'Dash', keys: 'RB / LB · R1 / L1' },
  { action: 'Pulse Shot', keys: 'X / RT · ▢ / R2' },
  { action: 'Scan Pulse', keys: 'Y / LT · △ / L2' },
  { action: 'Interact / Enter Node', keys: 'B · ○' },
  { action: 'Echo Blink (place / return)', keys: 'D-pad Up' },
  { action: 'Pause', keys: 'START · OPTIONS' },
  { action: 'Command Center', keys: 'BACK · SHARE' },
  { action: 'Menus', keys: 'D-pad / stick + A · ✕' },
];

// On-screen touch controls (tablets). Appear automatically on touch devices;
// force on/off in Settings ▸ ON-SCREEN CONTROLS.
export const CONTROLS_TOUCH: ControlRow[] = [
  { action: 'Move', keys: 'virtual stick (bottom-left)' },
  { action: 'Jump / Hover', keys: 'JUMP button (hold to hover)' },
  { action: 'Pulse Shot', keys: '◎ button (hold to auto-fire)' },
  { action: 'Sonar (Scan)', keys: '((·)) button' },
  { action: 'Dash', keys: '» button' },
  { action: 'Interact / Enter Node', keys: 'E button' },
  { action: 'Pause', keys: '❚❚ pip (top-right)' },
  { action: 'Top-down fire', keys: 'large FIRE button; auto-aims nearest threat' },
];

// Top-down "Scan" mode (the Fold flips you here) — twin-stick.
export const CONTROLS_SWEEP: ControlRow[] = [
  { action: 'Move (8-directional)', keys: 'WASD / arrows · Left stick' },
  { action: 'Aim', keys: 'Mouse · Right stick' },
  { action: 'Fire (auto toward aim)', keys: 'LEFT CLICK / X · RT · ▢' },
  { action: 'Dash (Phase Drift, i-frames)', keys: 'SHIFT · RB / LB' },
  { action: 'Scan (clear / stun / reveal caches)', keys: 'Q / RIGHT CLICK · Y / LT' },
  { action: 'Signal Overdrive (when meter full)', keys: 'E · B / ○' },
  { action: 'Swap weapon', keys: 'walk over a weapon pickup' },
  { action: 'Reach the BREACH', keys: 'walk into it → the Fold' },
  { action: 'Pause', keys: 'ESC · START' },
];

export const CONTROLS_DEBUG: ControlRow[] = [
  { action: 'Toggle debug overlay', keys: 'F1' },
  { action: 'Reset current quest', keys: 'F2' },
  { action: 'Give Signal Fragment', keys: 'F3' },
  { action: 'Jump to Blipstream node', keys: 'F4' },
  { action: 'Return to side-view (from Blipstream)', keys: 'F5' },
  { action: 'Cycle skins (unlock all)', keys: 'F6' },
  { action: 'Warp → Signal Storm (waves arena)', keys: 'F7' },
  { action: 'Warp → Miller Field (TOP-DOWN)', keys: 'F8' },
  { action: 'Warp → Miller Field (SIDE-VIEW)', keys: 'F9' },
  { action: 'Teleport to Breach (preview the Fold)', keys: 'F10' },
  { action: 'God mode (dev build)', keys: 'G' },
];

export interface TodoItem {
  label: string;
  done: boolean;
}

// Build TODO — updated as implementation lands. Do not let this go stale.
export const BUILD_TODO: TodoItem[] = [
  { label: 'Side-view movement (run/jump/hover/dash)', done: true },
  { label: 'Pulse shot + combat', done: true },
  { label: 'Scan pulse + hidden platform reveal', done: true },
  { label: 'Detection cones + classification meter', done: true },
  { label: 'Scanner drones (patrol/aggro/shoot)', done: true },
  { label: 'Miller Field level + parallax dusk background', done: true },
  { label: 'Quest system — THE FIRST CONTACT', done: true },
  { label: 'Blipstream Node A (waveform puzzle room)', done: true },
  { label: 'Crop-circle door unlock from node', done: true },
  { label: 'Mini-boss: The Scarecrow Antenna', done: true },
  { label: 'HYBRID: top-down Scan combat mode (SweepScene)', done: true },
  { label: 'HYBRID: the Fold transition (side-view ⇄ top-down)', done: true },
  { label: 'HYBRID: Z1 cold-open — top-down Surface → Fold → Miller Field', done: true },
  { label: 'HYBRID: Z2 fuse box → top-down circuit → Fold back (powers wing)', done: true },
  { label: 'HYBRID: top-down/alt beats — Z3 rec-pool dive + Z4 maze crop-draw (Fold → maze-z4); Z5–Z6 planned', done: true },
  { label: "Zone 4 — Patterson's Orchard: apple climb + shifting corn maze + cider cellar + Fold to maze-z4 + crop-circle bloom + FULL Harvest Pattern boss (read-glyph strike windows + low-HP harvest sweeps) + orchard music", done: true },
  { label: 'TOP-DOWN: twin-stick aim fix (mouse) + gamepad left-stick 2D move', done: true },
  { label: 'TOP-DOWN: god-mode [G] + debug warps F8/F9/F10 (top-down / side-view / breach)', done: true },
  { label: 'TOP-DOWN: skins/abilities carry over (mods + Surge Shot + Phase-Strike)', done: true },
  { label: 'TOP-DOWN: 5 features — Charge Node, Scout Boons, Scan Caches, Elite Classifier, Dash-chain', done: true },
  { label: 'TOP-DOWN: AAA visual overhaul — 1.4× camera, layered dark terrain, reshaded props/actors, depth/lighting, HP bars', done: true },
  { label: 'TOP-DOWN: weapon roster (Pulse/Scatter/Repeater/Lance/Echo Arc) + pickup swaps', done: true },
  { label: 'TOP-DOWN: Signal Overdrive ultimate [E] — kill-charged shockwave + rapid-fire', done: true },
  { label: 'TOP-DOWN: integrated pixel combat HUD (weapon, objective, enemies, combo, Overdrive, prompts, banner)', done: true },
  { label: 'Signal Fragment pickup', done: true },
  { label: 'Save/load (localStorage) + legacy migration', done: true },
  { label: 'Will badge + WILLOW scout log', done: true },
  { label: 'Chip SPARK signal box', done: true },
  { label: 'Command Center dashboard', done: true },
  { label: 'WebAudio procedural SFX + mute', done: true },
  { label: 'Debug overlay + debug keys', done: true },
  { label: 'AI QA pipeline (Playwright + qa-loop)', done: true },
  { label: 'Crisp HTML console UI — warm midnight pass', done: true },
  { label: 'Dev dashboard: Level Atlas + Bestiary + Arsenal + standalone /command-center.html', done: true },
  { label: 'Gamepad support (Xbox / PlayStation) + menu navigation', done: true },
  { label: 'Settings page (volume, CRT, shake, controls, pad status)', done: true },
  { label: 'Mobile/tablet hardening: compact gameplay chrome, no forced portrait blocker, smaller touch controls, iPhone/iPad Sweep layout pass', done: true },
  { label: 'PWA install/offline support: manifest + iOS home-screen metadata + service worker static cache', done: true },
  { label: 'Signal Skins: skin system + Wardrobe (all 5 scouts)', done: true },
  { label: 'Signal Sets: badge/log/relic collectibles (Will + Chip in Miller Field)', done: true },
  { label: 'Scout Echo encounters (unlock payoff + characters)', done: true },
  { label: 'Per-skin signature abilities + classification tie-in', done: true },
  { label: 'Scout characters you meet — kid sprite + name tag over head', done: true },
  { label: 'Signal Portrait cards + Command Center gallery (drop art in public/assets/portraits)', done: true },
  { label: 'LEVEL-PENDING: Henry/Cameron/Danny Signal Sets + portraits — wire when Zones 3–5 exist', done: false },
  { label: 'Scan-stun: a scan pulse freezes drones (Dead Cells double-duty verbs)', done: true },
  { label: 'Scan-secrets + Scout Field Notes (scan hidden spots → shards / notebook pages) + CC gallery', done: true },
  { label: 'Echo Blink prototype (ECHO decoy blink, F key) — ERD-grantable; earn-wiring LEVEL-PENDING (Zone 4)', done: true },
  { label: 'Music beat hook (EVT.musicBeat) → Motel neon flicker + lamp-sweep ambience', done: true },
  { label: 'Borrowed-ideas capture pass → Level Plans + Progression Plan (LEVEL-PENDING tags)', done: true },
  { label: 'Controller button remapping', done: false },
  { label: 'More Blipstream nodes', done: false },
  { label: 'Custom shader post-FX (CSS CRT overlay shipped instead)', done: false },
  { label: 'Zones 5–6 (playable) — see LEVEL PLANS', done: false },
];

export const ART_DIRECTION: string[] = [
  'Dreamlike Rural Pixel Sci-Fi: lush dusk fields, huge dithered clouds, lonely radio towers, a floating island nobody acknowledges.',
  'Internal resolution 480×270, integer-ish upscale with image-rendering: pixelated. Every texture is generated in code at boot (no image assets).',
  'Palette is locked in src/game/config.ts: dusk blues/cyan sky, moss-green ground, cyan/green = signal & friendly, red/orange = danger & classification.',
  'Scout colors: Will cyan · Chip orange · Henry green · Cameron purple · Danny red.',
  'Silhouettes and glow instead of detail. Motion sells everything: hover bob, cloud drift, scan ripples, afterimages, screen shake, glitch flashes.',
  'Blipstream rooms are the visual inverse of the field: black space, waveform bars, routing wires, red static.',
];

export const HUMAN_PLAYTEST_CHECKLIST: string[] = [
  'Is movement fun? (run/jump/hover/dash timing)',
  'Is the scan mechanic understandable without reading anything?',
  'Is Will’s badge discoverable but not too obvious?',
  'Is the Blipstream puzzle fun or confusing?',
  'Is the Scarecrow Antenna too easy / too hard?',
  'Does classification (red cones) read as a threat you manage?',
  'Is the story tone working — mysterious but warm?',
  'Is the Command Center useful?',
  'Does the game feel unique?',
  'Does it remain playable on iPhone and iPad in landscape and portrait?',
  'Can the installed PWA launch after airplane-mode/offline reload once it has been opened online?',
];

export const WEB_TECH_NOTES: string[] = [
  'Phaser 3 WebGL renderer with automatic Canvas fallback (Phaser.AUTO).',
  'All art procedural: Graphics → generateTexture + canvas noise textures at boot.',
  'WebAudio-synthesized SFX (oscillators + noise buffers) — zero audio assets.',
  'CRT/scanline/vignette via CSS overlays — zero-cost, fails nowhere.',
  'localStorage saves (blip_save_v1) with automatic legacy-key migration from the pre-rename build.',
  'PWA install/offline: manifest.webmanifest + PNG/SVG icons + /sw.js static cache. iPad/iPhone users can Add to Home Screen; first online load warms the cache for offline play.',
  'Mobile/tablet gameplay chrome: compact mode hides desktop shell during play, keeps touch controls large enough, and no longer blocks portrait with a rotate gate.',
  'WebGPU: detection badge only — NOT in the render path (see scope-control skill).',
  'Static Vite build → Vercel-ready, no server runtime.',
];
