/**
 * BLIP — central configuration.
 * ALL tuning constants, colors, texture keys and scene keys live here
 * (see .claude/skills/phaser-pixel-platformer). No magic numbers elsewhere.
 */

/**
 * Render scale. RENDER_ZOOM=1 renders the 480×270 world 1:1 (the shipped,
 * fully-tested look). The VIEW_W/VIEW_H + RENDER_ZOOM scaffolding is kept so a
 * future dedicated "HD-2D" effort can bump this cleanly (a 960×540 buffer at
 * zoom 2 needs the parallax backgrounds reworked to cover a zoomed camera —
 * that's its own carefully-tested pass, not a one-liner).
 */
export const RENDER_ZOOM = 1;
export const VIEW_W = 480;
export const VIEW_H = 270;
export const GAME_WIDTH = VIEW_W * RENDER_ZOOM;
export const GAME_HEIGHT = VIEW_H * RENDER_ZOOM;
export const TILE = 16;

export const BUILD_VERSION = '0.1.0-slice';
export const SAVE_KEY = 'blip_save_v1'; // slot 0 keeps this exact key (back-compat)
export const LEGACY_SAVE_KEY = 'beamline_save_v1'; // pre-rename key, migrated on load
export const SETTINGS_KEY = 'blip_settings_v1';
export const ACTIVE_SLOT_KEY = 'blip_active_slot';
export const SLOT_NAMES_KEY = 'blip_slot_names_v1'; // per-slot player-chosen names
export const SLOT_COUNT = 3;

/* ---------------------------------- scenes --------------------------------- */
export const SCENES = {
  boot: 'BootScene',
  menu: 'MainMenuScene',
  field: 'FieldScene',
  motel: 'MotelScene',
  stadium: 'StadiumScene', // Zone 3 — Chagrin Falls High
  underwater: 'UnderwaterScene', // Zone 3 rec-pool reflection node
  orchard: 'OrchardScene', // Zone 4 — Patterson's Orchard
  skyline: 'SkylineArrayScene', // Zone 5 — Skyline Array (the finale)
  ending: 'EndingScene', // finale classification choice + ending card
  blipstream: 'BlipstreamScene',
  sweep: 'SweepScene', // top-down bonus arena — "The Sweep" (Signal Storm)
  ui: 'UIScene',
  gameOver: 'GameOverScene',
} as const;

/* --------------------------------- palette --------------------------------- */
// "Dreamlike Rural Pixel Sci-Fi" — WARM MIDNIGHT revision (2026-07-10 UI pass).
// Direction: cream text, electric-lime signal, amber chrome, crimson danger.
// Teal/cyan retired except as Will's scout identity color.
export const PALETTE = {
  skyTop: 0x071126, // midnight
  skyMid: 0x101a3a, // deep indigo
  skyHorizon: 0x2a3566,
  duskGlow: 0xb96a3c,
  star: 0xfff3c9, // soft white (warm)
  moon: 0xe8c76a,
  moonDark: 0xc9a24b,
  cloud: 0x8d97c4,
  cloudDark: 0x5c6693,
  hillFar: 0x0e1830,
  hillMid: 0x13223f,
  islandRock: 0x1c2b3f,
  grass: 0x2e7d4f,
  grassLit: 0x3f9a5f,
  grassDark: 0x1f5c3a,
  moss: 0x27684a,
  dirt: 0x4a3a2b,
  dirtDark: 0x2b2015,
  fence: 0x33261a,
  windowLight: 0xffc966, // warm lit windows / fireflies
  windowCore: 0xffe9a8,
  // Chagrin Falls town kit
  brick: 0x6d382c,
  brickShade: 0x452720,
  brickWarm: 0x7d4a34,
  brownstone: 0x5a4632,
  trimCream: 0xd9c9a3,
  slate: 0x3c4356,
  slateDark: 0x262d3d,
  stone: 0x55483a,
  stoneDark: 0x37302a,
  bluestone: 0x46536a,
  shopBlue: 0x3b6ea5,
  shopBlueDark: 0x28517d,
  shopRed: 0xb33a3a,
  foliage: 0x1b3a2a,
  foliageDark: 0x102418,
  // top-down "night arena" ground tones (deep forest so signal-green pops)
  tdGroundDeep: 0x0c2416, // darkest base
  tdGround: 0x143a24, // mid base
  tdGroundLit: 0x1e5236, // lit patch
  tdSoil: 0x2e2114, // worn dirt/path
  tdSoilDark: 0x1d150c,
  tdFlower: 0xe6c14a, // amber wildflower
  tdFlowerPink: 0xd86a9a,
  waterPale: 0xc9dcf2,
  waterMid: 0x8fa8d0,
  waterDeep: 0x22304f,
  riverDark: 0x111c33,
  skin: 0xd8a37a,
  hairBrown: 0x4a3120,
  hairDark: 0x241a12,
  shellWhite: 0xf2ead8, // CONTACT-47's casing
  shellHi: 0xfffbef, // brightest catch-light (top-left)
  shellMid: 0xddd1b7, // casing midtone (form ramp)
  shellShade: 0xc9bda4,
  shellDeep: 0x9a8c70, // deep casing shadow (belly / underside)
  shellRim: 0x74dbe4, // cool moonlit rim light down the shaded edge
  faceplate: 0x161d24,
  faceplateLit: 0x24384a, // visor upper sheen
  visorGlow: 0xc9ffe0, // faint inner-visor bloom around the eyes
  signal: 0xa8ff3e, // electric lime — the player's color
  signalGreen: 0x7cdc6a,
  signalDim: 0x5f9e2e,
  danger: 0xd84a42,
  dangerDark: 0x5a171a,
  warning: 0xf2a93b, // amber
  amberDim: 0x8a5e20,
  violetGlitch: 0x7c5cff, // anomaly/static accent
  white: 0xfff3c9, // soft white
  cream: 0xf6e7b4,
  black: 0x05070f,
  uiDim: 0xafa27c, // muted warm text
  // Five Signal Scouts (identity colors — unchanged)
  scoutWill: 0x35d5ff,
  scoutChip: 0xffb03b,
  scoutHenry: 0x4bff8f,
  scoutCameron: 0xb06bff,
  scoutDanny: 0xff4b5c,
  // Zone 2 — Motel Nowhere (neon night)
  motelSkyTop: 0x120a1e, // bruised purple night
  motelSkyMid: 0x1d1030,
  motelSkyHorizon: 0x3a1f4a,
  motelHaze: 0x4a2a55,
  asphalt: 0x1a1620, // wet blacktop
  asphaltLit: 0x2a2333,
  asphaltPuddle: 0x241d33,
  neonPink: 0xff4d8d, // VACANCY sign
  neonPinkDim: 0x6e2440,
  neonCyan: 0x3df0ff, // motel trim / arrow
  neonCyanDim: 0x1a5a63,
  neonAmber: 0xffb03b, // SPARK / diner glow (== scoutChip)
  neonAmberDim: 0x6e4a18,
  neonGreen: 0x6bff8f, // OPEN / go signals
  dinerWarm: 0xffca6a, // diner window bloom
  fuseSteel: 0x3a3f4d, // fuse-box / breaker housing
  fuseSteelDark: 0x22262f,
  filament: 0xffe9a8, // the boss's exposed core glow
  // Zone 3 — Chagrin Falls High (Tiger Stadium): warm field lights above, cool
  // underwater reflection below, green ANCHOR safe glow.
  stadiumSkyTop: 0x0a1226,
  stadiumSkyMid: 0x14203f,
  stadiumSkyHorizon: 0x2b3b63,
  fieldGreen: 0x2c6b3f, // turf
  fieldGreenDark: 0x1d4a2c,
  fieldLine: 0xe8f0e0, // chalk yard-lines
  trackRed: 0x8f3b2e, // red-cinder track
  trackRedDark: 0x5e2419,
  bleacher: 0x46506a, // aluminium stands
  bleacherDark: 0x2a3145,
  pressBox: 0x39415a,
  tigerOrange: 0xf2871e, // the mundane town color (banners)
  tigerOrangeDark: 0x9a5210,
  nightBloom: 0xfff0c0, // Friday-night light-tower bloom (warm)
  scoreboardFrame: 0x23283a,
  scoreboardKnown: 0xff5a4a, // KNOWN warning readout
  poolWater: 0x3f7fb8, // rec-pool surface
  poolShimmer: 0xbfe0ff,
  anchorGreen: 0x4bff8f, // == scoutHenry — ANCHOR safe-zone glow
  anchorGreenDim: 0x1f7a45,
  // Zone 3 underwater (inverted reflection node)
  underTintTop: 0x0d3352,
  underTintDeep: 0x061a30,
  godRay: 0xbfe6ff,
  bubble: 0xcdeeff,
  // Zone 4 — Patterson's Orchard (harvest dusk: purple/red orchard lights,
  // white barn + green metal roof, tan corn maze, glowing lime crop circles)
  orchardSkyTop: 0x201830, // deep dusk purple
  orchardSkyMid: 0x3a2440,
  orchardSkyHorizon: 0x8a4438, // burnt-orange harvest horizon
  orchardHazePurple: 0x4a2c55,
  barnWhite: 0xe8e2d0, // warm off-white barn body (NOT pure white)
  barnWhiteShade: 0xc3b89e,
  barnRoofGreen: 0x3f7d54, // the green metal roof
  barnRoofGreenDark: 0x275036,
  cornStalk: 0xb89a4a, // tan/gold corn
  cornStalkDark: 0x7d6a2f,
  cornSilk: 0xe4cf7a,
  appleRed: 0xc23a34,
  appleLeaf: 0x2f6b3e,
  orchardLightPurple: 0xb06bff, // == scoutCameron (Cameron/ECHO accent lights)
  orchardLightRed: 0xd8524a,
  cropGlow: 0xa8ff3e, // == signal — the burned-in crop-circle glow
} as const;

/** how many Signal Fragments exist across the playable campaign (HUD "0 / 5") */
export const FRAGMENT_TOTAL = 5;

/* --------------------- screen filters (title screen only) ------------------ */
/** Post-process "screen filters" on the MainMenu camera. Add an entry here (+ a
 *  group for the dropdown), then map its id -> {pipeline, preset} in
 *  MainMenuScene's FILTER_FX. Per-filter tuning lives in the *_PRESETS tables. */
export const FILTERS = [
  { id: 'none', label: 'None', group: '' },
  // Comic / Ink
  { id: 'comic', label: 'Comic / Cel', group: 'Comic / Ink' },
  { id: 'sketch', label: 'Ink Sketch', group: 'Comic / Ink' },
  { id: 'crosshatch', label: 'Cross-Hatch', group: 'Comic / Ink' },
  // Tone / Grade
  { id: 'noir', label: 'Noir', group: 'Tone / Grade' },
  { id: 'sepia', label: 'Sepia', group: 'Tone / Grade' },
  { id: 'moonlight', label: 'Moonlight', group: 'Tone / Grade' },
  { id: 'dusk', label: 'Warm Dusk', group: 'Tone / Grade' },
  { id: 'cool', label: 'Cool', group: 'Tone / Grade' },
  { id: 'vintage', label: 'Vintage', group: 'Tone / Grade' },
  { id: 'negative', label: 'Negative', group: 'Tone / Grade' },
  // Retro / Pixel
  { id: 'gameboy', label: 'Game Boy', group: 'Retro / Pixel' },
  { id: 'dither', label: '1-Bit Dither', group: 'Retro / Pixel' },
  { id: 'lofi', label: 'Lo-Fi', group: 'Retro / Pixel' },
  { id: 'crt', label: 'CRT Scanline', group: 'Retro / Pixel' },
  // Comic Print
  { id: 'halftone', label: 'Halftone', group: 'Comic Print' },
  { id: 'popart', label: 'Pop Art', group: 'Comic Print' },
  // Signal / Sci-Fi (on-brand)
  { id: 'nightvision', label: 'Night-Vision', group: 'Signal / Sci-Fi' },
  { id: 'thermal', label: 'Thermal', group: 'Signal / Sci-Fi' },
  { id: 'hologram', label: 'Hologram', group: 'Signal / Sci-Fi' },
  { id: 'interference', label: 'Interference', group: 'Signal / Sci-Fi' },
] as const;
export type FilterId = (typeof FILTERS)[number]['id'];

/* ---- filter tuning tables (one row per preset — edit freely) ---- */

/** Comic/ink pipeline (ComicFX). fill=0 draws ink on paper (sketch); hatch=1 adds
 *  diagonal shading. Outlines kept THIN for 480x270 (high thresh, low strength). */
export const COMIC_FX: Record<string, {
  levels: number; outline: number; threshLo: number; threshHi: number;
  grain: number; contrast: number; saturation: number; hatch: number; fill: number;
}> = {
  comic: { levels: 6, outline: 0.5, threshLo: 0.34, threshHi: 0.62, grain: 0.04, contrast: 1.1, saturation: 1.15, hatch: 0, fill: 1 },
  sketch: { levels: 6, outline: 0.75, threshLo: 0.28, threshHi: 0.55, grain: 0.07, contrast: 1.05, saturation: 0.0, hatch: 0, fill: 0 },
  crosshatch: { levels: 4, outline: 0.55, threshLo: 0.3, threshHi: 0.58, grain: 0.04, contrast: 1.1, saturation: 0.7, hatch: 1, fill: 1 },
};

/** Tone / color-grade pipeline (GradeFX). duo=1 → duotone(low,high); else tint. */
export const GRADE_PRESETS: Record<string, {
  duo: number; duoLow: readonly [number, number, number]; duoHigh: readonly [number, number, number];
  tint: readonly [number, number, number]; sat: number; contrast: number; invert: number; grain: number;
}> = {
  noir: { duo: 1, duoLow: [0.02, 0.02, 0.03], duoHigh: [0.95, 0.95, 0.98], tint: [1, 1, 1], sat: 0, contrast: 1.32, invert: 0, grain: 0.03 },
  sepia: { duo: 1, duoLow: [0.12, 0.07, 0.03], duoHigh: [1.0, 0.86, 0.62], tint: [1, 1, 1], sat: 0, contrast: 1.12, invert: 0, grain: 0.04 },
  moonlight: { duo: 0, duoLow: [0, 0, 0], duoHigh: [1, 1, 1], tint: [0.6, 0.78, 1.28], sat: 0.5, contrast: 1.05, invert: 0, grain: 0.02 },
  dusk: { duo: 0, duoLow: [0, 0, 0], duoHigh: [1, 1, 1], tint: [1.3, 0.86, 0.55], sat: 0.95, contrast: 1.05, invert: 0, grain: 0.02 },
  cool: { duo: 0, duoLow: [0, 0, 0], duoHigh: [1, 1, 1], tint: [0.72, 0.98, 1.14], sat: 0.85, contrast: 1.0, invert: 0, grain: 0.02 },
  vintage: { duo: 0, duoLow: [0, 0, 0], duoHigh: [1, 1, 1], tint: [1.14, 0.98, 0.76], sat: 0.6, contrast: 0.95, invert: 0, grain: 0.07 },
  negative: { duo: 0, duoLow: [0, 0, 0], duoHigh: [1, 1, 1], tint: [1, 1, 1], sat: 1, contrast: 1.0, invert: 1, grain: 0.0 },
};

/** Retro / pixel pipeline (RetroFX). mode: 0 gameboy, 1 dither(1-bit), 2 lofi, 3 crt. */
export const RETRO_PRESETS: Record<string, {
  mode: number; levels: number; dither: number; scan: number;
  loCol: readonly [number, number, number]; hiCol: readonly [number, number, number];
}> = {
  gameboy: { mode: 0, levels: 4, dither: 1, scan: 0, loCol: [0.06, 0.22, 0.06], hiCol: [0.61, 0.74, 0.06] },
  dither: { mode: 1, levels: 2, dither: 1, scan: 0, loCol: [0.05, 0.06, 0.09], hiCol: [0.9, 0.92, 0.85] },
  lofi: { mode: 2, levels: 4, dither: 1, scan: 0, loCol: [0, 0, 0], hiCol: [1, 1, 1] },
  crt: { mode: 3, levels: 10, dither: 0, scan: 1, loCol: [0, 0, 0], hiCol: [1, 1, 1] },
};

/** Halftone print pipeline (HalftoneFX). popart=1 keeps bold posterized color. */
export const HALFTONE_FX: Record<string, {
  cell: number; popart: number; ink: readonly [number, number, number]; paper: readonly [number, number, number];
}> = {
  halftone: { cell: 4.5, popart: 0, ink: [0.05, 0.06, 0.09], paper: [0.96, 0.94, 0.86] },
  popart: { cell: 5.0, popart: 1, ink: [0.05, 0.06, 0.09], paper: [1, 1, 1] },
};

/** Signal / sci-fi pipeline (SignalFX). mode: 0 night-vision, 1 thermal, 2 hologram, 3 interference. */
export const SIGNAL_PRESETS: Record<string, {
  mode: number; tint: readonly [number, number, number];
}> = {
  nightvision: { mode: 0, tint: [0.2, 1.0, 0.35] },
  thermal: { mode: 1, tint: [1, 1, 1] },
  hologram: { mode: 2, tint: [0.35, 0.9, 1.0] },
  interference: { mode: 3, tint: [1, 1, 1] },
};

/** Blend strength (0..1) each filter uses DURING GAMEPLAY — the menu always uses
 *  1.0 (full). Heavy / not-gameplay-safe filters are dialed down to a light
 *  overlay so levels stay readable. Missing id => 1.0. Tune freely. */
export const FILTER_GAME_STRENGTH: Record<string, number> = {
  // comic / ink — outlines fine, posterize/paper reduce readability
  comic: 0.7, sketch: 0.45, crosshatch: 0.6,
  // tone / grade — structure-preserving, can stay strong
  noir: 0.85, sepia: 0.85, moonlight: 0.9, dusk: 0.9, cool: 0.9, vintage: 0.85, negative: 0.5,
  // retro / pixel — heavy
  gameboy: 0.4, dither: 0.35, lofi: 0.6, crt: 0.7,
  // comic print — heavy
  halftone: 0.4, popart: 0.5,
  // signal / sci-fi — heavy
  nightvision: 0.45, thermal: 0.4, hologram: 0.45, interference: 0.3,
};

/* ------------------------------ gamepad mapping ----------------------------- */
// Standard-layout indices (Xbox: A B X Y / PlayStation: Cross Circle Square Triangle)
export const PAD = {
  deadZone: 0.28,
  jump: 0, // A / Cross (hold = hover)
  interact: 1, // B / Circle
  shoot: 2, // X / Square
  scan: 3, // Y / Triangle
  scanAlt: 6, // LT / L2 — SONAR on the left trigger
  dash: 5, // RB / R1
  dashAlt: 4, // LB / L1
  shootAlt: 7, // RT / R2 — shoot on the right trigger
  select: 8, // Back / Share — Command Center
  start: 9, // Start / Options — Pause
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

/** number color -> css string */
export const css = (c: number): string => '#' + c.toString(16).padStart(6, '0');

/* ------------------------------ player tuning ------------------------------ */
export const PLAYER = {
  width: 10,
  height: 12,
  runSpeed: 112,
  accel: 1500,
  airAccel: 1050,
  drag: 1500,
  gravity: 900,
  jumpVel: 268,
  jumpCutMult: 0.42,
  coyoteMs: 95,
  jumpBufferMs: 120,
  hoverFallSpeed: 26,      // terminal fall speed while hovering
  hoverDrainPerSec: 32,
  energyMax: 100,
  energyRegenPerSec: 30,
  dashSpeed: 252,
  dashMs: 210,
  dashCooldownMs: 750,
  maxHp: 5,
  invulnMs: 950,
  knockback: 130,
  // Echo Blink (Cameron/ECHO scout-set ability): place a signal echo, snap back to it
  echoLifeMs: 5000,
  echoCost: 25, // energy to place an echo
  echoCooldownMs: 600, // lockout after a blink
} as const;

/** DEV free-fly / noclip speed (px/sec) — shared by side-view + top-down fly mode. */
export const FLY_SPEED = 360;

/* ------------------------------ camera feel -------------------------------- */
// Follow-camera tuning. lookaheadX leads the view in the direction CONTACT-47
// faces so drops, drones and the ravine are visible BEFORE you reach them;
// lookOffsetY keeps the existing downward bias so big descents show the landing.
export const CAM = {
  // Focus offset must overcome the 40px deadzone + follow lag before the view
  // actually leads, so this reads larger than the net on-screen lead (~50px).
  lookaheadX: 100, // px the focus leads ahead of the player in the facing dir
  lookaheadEase: 2.8, // ease rate toward the lookahead target (higher = snappier)
  moveGate: 8, // px/s of |vx| below which lookahead relaxes toward center (no idle drift)
  lookOffsetY: -10, // downward look bias (unchanged from the shipped feel)
} as const;

export const PULSE = {
  speed: 310,
  cooldownMs: 180,
  lifeMs: 750,
  damage: 1,
  maxActive: 14,
} as const;

export const SCAN = {
  radius: 150,
  durationMs: 520,
  cooldownMs: 2400,
} as const;

/* --------------------------------- enemies --------------------------------- */
export const DRONE = {
  hp: 2,
  patrolSpeed: 30,
  chaseSpeed: 62,
  fireCooldownMs: 1500,
  threatFireCooldownMs: 850,
  boltSpeed: 118,
  boltLifeMs: 2600,
  coneLength: 82,
  coneHalfAngleDeg: 22,
  aggroRange: 130,
  maxBolts: 24,
  touchDamage: 1,
  scanStunSec: 1.5, // a scan pulse briefly freezes any drone caught in it (scan = offense too)
} as const;

export const SCANRIG = {
  coneLength: 128,
  coneHalfAngleDeg: 15,
  sweepDeg: 34,
  sweepPeriodMs: 5200,
} as const;

/* ------------------------ classification (the enemy) ----------------------- */
export const CLASSIFY = {
  fillPerSec: 36,   // while inside a detection cone
  decayPerSec: 11,
  anomalyAt: 34,
  threatAt: 70,
  max: 100,
} as const;

export type ClassifyTier = 'UNKNOWN' | 'ANOMALY' | 'THREAT';

/* ----------------------------------- boss ---------------------------------- */
export const BOSS = {
  hp: 14,
  coreExposeMs: 3400,
  radialCount: 10,
  radialSpeed: 92,
  radialPeriodMs: 2700,
  radialTelegraphMs: 750, // amber converging wind-up before each radial burst (fairness)
  beamLength: 118,
  beamHalfWidth: 5,
  beamSpinDegPerSec: 42,
  summonAtFracs: [0.66, 0.33],
  touchDamage: 1,
  staggerMs: 650,
} as const;

/* --------------------- Zone 2: The Vacancy Sign boss ----------------------- */
export const BOSS2 = {
  hp: 16,
  coreExposeMs: 3200,
  letterDropPeriodMs: 1500, // cadence of falling neon letters
  letterCount: 3, // letters per volley
  letterSpeed: 70,
  letterLifeMs: 4200,
  barSweepPeriodMs: 4200, // buzzing light-bar sweep
  barHalfWidth: 6,
  barDamage: 1,
  stutterEveryMs: 6000, // short-circuit stutter (self-exposes core briefly)
  stutterMs: 1200,
  touchDamage: 1,
  staggerMs: 620,
} as const;

/* --------------------- Zone 3: The Weather Balloon boss -------------------- */
// A bobbing decoy that vents drones from inside; clear the drones and it
// DEFLATES, exposing the valve core for a window. Repeat until it pops.
export const BOSS3 = {
  hp: 18,
  ventDroneCount: 2, // drones vented each inflate phase
  deflateExposeMs: 3200, // valve core hittable while deflated
  reinflateMs: 1700, // armored bob before it vents again
  bobPeriodMs: 2600,
  bobAmp: 10,
  spotlightPeriodMs: 4400, // telegraphed spotlight-slam cadence
  spotlightTelegraphMs: 850,
  spotlightHalfWidth: 14,
  spotlightDamage: 1,
  touchDamage: 1,
  staggerMs: 620,
} as const;

/* --------------------- Zone 4: The Harvest Pattern boss -------------------- */
// A living crop-circle glyph at the maze's heart. Rotates harvest symbols and
// fires telegraphed radial volleys; scan exposes the core between volleys.
// NOTE: first pass ships as a labeled STUB — full read-the-glyph/match-symbol
// stun mechanic is a polish pass. Defeat still grants Fragment 4/7.
export const BOSS4 = {
  hp: 16,
  coreExposeMs: 3400,
  symbolCount: 6, // rotating harvest symbols around the glyph
  spinDegPerSec: 40, // glyph rotation speed
  alignWindowDeg: 28, // the core is vulnerable while the WEAK symbol dips toward you
  scanSlowMs: 2200, // a scan slows the rotation — ECHO's pattern-reading aid
  lowHpFrac: 0.34, // below this HP fraction: rotation speeds up + harvest sweeps begin
  spinRageMul: 1.7, // rotation multiplier in the low-HP rage phase
  volleyPeriodMs: 2600, // cadence of the radial symbol volley
  volleyTelegraphMs: 750, // purple wind-up before each volley (fairness)
  symbolSpeed: 88,
  symbolLifeMs: 3200,
  sweepPeriodMs: 3200, // low-HP "walls close in" harvest sweep cadence
  sweepTelegraphMs: 750,
  sweepActiveMs: 1000,
  sweepHalfWidth: 12,
  sweepDamage: 1,
  touchDamage: 1,
  staggerMs: 620,
} as const;

/* --------------- Zone 5 (finale): The Listening Station boss --------------- */
// The observatory iris = a rumor-static MIRROR ("The Thing People Thought They
// Saw"). It COPIES your last-used frequency (activeSkin()); you hurt it by
// REFUSING the label — swap to a DIFFERENT frequency, then SCAN to jam the iris
// open and hit the pupil-core. ~3 phases: eye-beam sweep -> lightning barrage ->
// rumor clones. Defeat grants `refuse-label` (the capstone signature).
export const BOSS5 = {
  hp: 20,
  coreExposeMs: 3000, // pupil hittable window after a valid refuse+scan
  beamSpinDegPerSec: 34,
  beamLength: 140,
  beamHalfWidth: 6,
  beamGapMs: 900, // beam blinks off — dash the gap
  beamOnMs: 2600,
  beamTelegraphMs: 500,
  lightningPeriodMs: 3200, // lightning-call barrage cadence
  lightningTelegraphMs: 650,
  lightningCount: 3,
  lightningDamage: 1,
  cloneCount: 2, // low-HP rumor-static clones
  lowHpFrac: 0.34,
  touchDamage: 1,
  staggerMs: 620,
} as const;

/* ------------------------------ progression -------------------------------- */
// The earn-loop economy + per-ability tuning (PROGRESSION_PLAN.md). All numbers
// live here; the Command Center Workbench renders costs from this + upgrades.ts.
export const PROGRESSION = {
  shardsPerDrone: 3, // Signal Shards dropped by a destroyed drone
  shardsPerCache: 15, // hidden salvage cache
  // Channel A tuning
  pulseResonanceCoreBonus: 1, // +damage vs exposed boss cores (Miller signature)
  // Channel B — Chip's Workbench, tiered stat upgrades (id → per-tier costs + effect)
  workbench: {
    'max-hull': { name: 'Max Hull', tiers: [80, 180], perTier: 1, unit: 'HP' },
    'energy-regen': { name: 'Energy Regen', tiers: [70, 150], perTier: 0.2, unit: '×' },
    'pulse-rate': { name: 'Pulse Rate', tiers: [70, 150], perTier: 0.15, unit: 'faster' },
    'dash-cooldown': { name: 'Dash Cooldown', tiers: [70, 150], perTier: 0.15, unit: 'shorter' },
  },
} as const;

/* -------------------------- Zone 2: Motel Nowhere -------------------------- */
export const MOTEL = {
  securityConeLength: 130,
  securityConeHalfAngleDeg: 30, // a wide, near-static lit POOL on the walkway
  securitySweepDeg: 10, // barely drifts — linger in a pool → THREAT; cross fast → safe
  securitySweepPeriodMs: 4200,
  neonFlickerMs: 220, // brief flicker before a powered platform state settles
} as const;

/* -------------------------- Zone 3: Chagrin Falls High -------------------- */
// Friday-night-lights stealth: rotating light-tower cones you time like rhythm.
// Henry ANCHOR safe zones bleed classification + heal between sweeps.
export const STADIUM = {
  lightConeLength: 140,
  lightConeHalfAngleDeg: 24, // volumetric light-tower pool over the track
  lightSweepDeg: 52, // a wide rotating Friday-night sweep — time your crossings
  lightSweepPeriodMs: 5200,
  poleHeight: 46, // the light head sits high above the field
  safeZoneDeclassifyPerSec: 44, // ANCHOR zone bleeds classification fast
  safeZoneHealEveryMs: 1400, // slow heal tick while sheltered + roughly still
  crowdSwellMs: 1600, // phantom-crowd stub swell after a THREAT flag
} as const;

/* -------------------------- Zone 4: Patterson's Orchard ------------------- */
// "THE MAZE THINKS": respawning fruit platforms + a side-view maze-approach
// whose walls shift on a readable, telegraphed beat (never random). The real
// maze traversal happens in the top-down `maze-z4` Sweep arena (see the Fold).
export const ORCHARD = {
  fruitRespawnMs: 2600, // fruit platform solid↔gone cycle
  fruitTelegraphMs: 600, // blink before a fruit platform toggles
  mazeShiftPeriodMs: 2600, // side-view maze-approach wall-shift cadence
  mazeTelegraphMs: 700, // purple ECHO glyph preview before a shift
  fold: {
    arenaId: 'maze-z4', // the top-down Sweep arena this zone Folds into
  },
} as const;

/* -------------------------- Zone 5: Skyline Array ------------------------- */
// The finale climb: storm-surf UP antenna spires on rising updrafts, dodging a
// telegraphed lightning clock; the storm sea below is the fail state. Skins are
// FREQUENCY KEYS — swap (1–5) to pass each Scout's beat. First-person summit +
// mirror boss. Updrafts LIFT without killing jump/dash (gravity stays on).
export const UPDRAFT = {
  riseSpeed: 220, // terminal upward speed — high enough that the crest CLEARS the catwalk
  // that spans the shaft so you drop onto it (still below dashSpeed 252, so dash reads faster)
  accel: 1500, // MUST exceed PLAYER.gravity (900) so the shaft actually lifts (net upward)
  centerPull: 4.0, // keep you centered so the lift delivers you straight up onto the catwalk
  windStreakMs: 60,
} as const;

export const LIGHTNING = {
  warnMs: 450, // amber telegraph before the bolt
  activeMs: 260, // bolt live + damaging (dash-through-able: dashMs ~210)
  cooldownMs: 260,
  idleMs: 1400,
  cycleMs: 2370, // warn+active+cooldown+idle
  phaseStepMs: 220, // per-strike offset -> a readable barrage "clock"
  hitHalfW: 7,
  damage: 1,
} as const;

export const DASHGATE = { damage: 1, halfW: 10, halfH: 12 } as const;

export const SKYCAM = {
  followLerpX: 0.1,
  followLerpY: 0.14,
  deadzoneW: 48,
  deadzoneH: 24,
  baseOffsetY: -14, // rest looking slightly UP
  lookAheadK: 0.22, // vy -> follow-offset gain (look up rising, down falling)
  lookUpMax: -70,
  lookDownMax: 40,
  lookLerp: 0.08, // ease so updrafts don't snap the camera
} as const;

export const TUNE = {
  markerCount: 5, // five frequencies (one per Scout) aligned at the summit
  tolerancePx: 12,
  holdMs: 800,
  reticleSpeed: 90,
  driftSpeed: 0.4,
  starCount: 90,
} as const;

export const FREQSWAP = {
  order: ['will', 'chip', 'henry', 'cameron', 'danny'], // keys 1–5 -> Scout skin ids
  swapLockMs: 120, // tiny debounce between swaps
} as const;

/* -------------------- The Sweep (top-down bonus arena) --------------------- */
// A separate top-down "radar scope" mode you WARP into for a Signal Storm — you
// finally see yourself as the blip. Isolated scene (own physics world, gravity 0);
// never touches the platformer. Rewards feed the existing Signal Shard economy.
export const SWEEP = {
  tile: 32, // top-down map grid tile size (rooms/corridors authored in tiles)
  cameraZoom: 0.82, // pulled-back top-down view: see more arena, still readable
  touchCameraZoom: 0.72, // phones/tablets need more tactical context around controls
  maxHp: 5,
  moveSpeed: 118, // top-down roam speed (clamped; dash exceeds it)
  accel: 1600,
  drag: 1400,
  dashMs: 180,
  dashSpeed: 300,
  dashCooldownMs: 700,
  invulnMs: 900,
  knockback: 150,
  fireCooldownMs: 200, // auto-aim cadence
  shotSpeed: 340,
  shotDmg: 1,
  maxShots: 24,
  aimRange: 230, // auto-aim acquisition radius
  scanRadius: 92, // Scan = radial clear/stun pulse (double-duty verb)
  scanDmg: 1,
  heatFillOnHit: 16, // "Sweep heat" (Classification reused) — the radar locks onto you
  heatDecayPerSec: 6,
  heatRampAt: [40, 75], // thresholds: +spawn rate, +enemy aggression
  shardsPerKill: 1,
  shardsClearBonus: 20,
  comboWindowMs: 2000,
  comboMax: 5,
  // open-arena twin-stick tuning (you roam + aim + fire yourself)
  arenaW: 960, // arena is bigger than the 480×270 viewport — the camera follows
  arenaH: 540,
  fireCooldownRapid: 110, // with the RAPID pickup
  spreadAngleRad: 0.2, // fan angle per side with the SPREAD pickup
  enemyKnockback: 175, // punch enemies take when shot
  dropChance: 0.26, // chance a slain enemy drops a pickup
  healAmount: 1,
  // "Charge the Node" objective — the breach stays LOCKED until the Signal Node is
  // charged. Kills add charge; kills NEAR the node count double.
  nodeChargeDefault: 100,
  nodeChargePerKill: 10,
  nodeChargeRadius: 130, // within this of the node → double charge
  // dash-chain flow: a Phase-Strike kill refunds the dash cooldown (chain through packs)
  dashRefundOnPhaseKill: true,
  hitStopMs: 45, // brief freeze on a phase-strike kill for punch
  // Scout Boons (the five scouts as pickups) + hidden Signal Caches revealed by Scan
  eliteCacheShards: 15,
  boonShieldMs: 3000, // ANCHOR boon shield duration
  boonFireMul: 0.7, // ROCKET boon fire-rate multiplier (for the run)
  boonScanMul: 1.5, // WILLOW boon scan-radius multiplier (for the run)
  cacheCount: 3, // hidden caches per arena
  cacheShards: 12, // shards per revealed cache
  // Signal Overdrive ultimate: charge by fighting, [E] to unleash
  overdriveMax: 100,
  overdrivePerKill: 9, // charge per kill (×combo, capped)
  overdriveDurationMs: 4200,
  overdriveFireMul: 0.45, // fire cooldown multiplier while active (rapid fire)
  overdriveShockRadius: 150, // opening shockwave that clears/damages nearby drones
  overdriveShockDmg: 3,
} as const;

// Elite "Classifier" drone — a telegraphed mini-boss beat before the breach.
export const SWEEP_ELITE = {
  hp: 14,
  speed: 34,
  beamChargeMs: 900, // amber wind-up
  beamActiveMs: 550, // red beam sweep
  beamPeriodMs: 4200,
  beamLength: 150,
  beamHalfWidth: 9,
  beamHeatOnHit: 40, // getting caught spikes heat hard
  touchDamage: 1,
  points: 6,
} as const;

// "The Maze Heart" — Zone-4 FINALE boss (an enhanced Classifier construct). Reuses the
// Elite's telegraphed scan-beam machinery (amber wind-up → red sweep) with beefier tuning,
// plus a one-time reinforcement wave at half health. Charging the Node wakes it; the breach
// stays SEALED until it is destroyed. Always killable (normal hits + Scan/Overdrive land),
// so it can never soft-lock; god mode still gates every hit.
export const SWEEP_BOSS = {
  hp: 46,
  speed: 26,
  beamChargeMs: 780, // amber wind-up (a touch snappier than the mini-elite)
  beamActiveMs: 620, // red beam sweep
  beamPeriodMs: 3200, // faster cadence than the elite → sustained pressure
  beamLength: 190,
  beamHalfWidth: 11,
  beamHeatOnHit: 44,
  addsAtHpFrac: 0.5, // once below this HP, calls in reinforcements (one time)
  addsKinds: ['weaver', 'weaver', 'diver'],
  clearShards: 60, // triumphant one-time payout on defeat
  lootDrops: 3, // weapon pickups that burst out on death
} as const;

// Enemy archetypes — the Interpretation Engine's labelling constructs. UNIFORM shape
// (every kind carries every field) so one drive() path can read any of them; a `behavior`
// tag picks the movement/attack style. Counters are in the comments (keep the roster fair).
//   behavior: 'chase' straight rush · 'gunner' standoff + aimed bolt · 'diver' lock-on lunge
//             'weaver' fast sine rush · 'turret' rooted radial emitter
//   shielded : blocks player bolts on its FRONT arc (it rotates to face you) → flank / dash / scan
//   telegraphMs: charge/wind-up (blinks) before a gunner/turret volley → a readable tell
//   splitInto: shards spawned on death (mini drifters) → clear with Scan / Overdrive
export const SWEEP_ENEMIES = {
  // ── grunts (Zone-1 vocabulary) ──────────────────────────────────────────
  drifter:  { behavior: 'chase',  hp: 2, speed: 40, points: 1, fireMs: 0,    boltSpeed: 0,   keepRange: 0,   diveSpeed: 0,   lockRange: 0,   weave: 0,  telegraphMs: 0,   burst: 0, shielded: false, splitInto: 0 }, // stray interpretation drone
  tagger:   { behavior: 'gunner', hp: 2, speed: 52, points: 2, fireMs: 1600, boltSpeed: 130, keepRange: 130, diveSpeed: 0,   lockRange: 0,   weave: 0,  telegraphMs: 0,   burst: 0, shielded: false, splitInto: 0 }, // fires aimed "labels"
  diver:    { behavior: 'diver',  hp: 1, speed: 44, points: 2, fireMs: 0,    boltSpeed: 0,   keepRange: 0,   diveSpeed: 300, lockRange: 200, weave: 0,  telegraphMs: 0,   burst: 0, shielded: false, splitInto: 0 }, // THREAT-tag lunge
  // ── new archetypes (per-zone variety) ───────────────────────────────────
  // FIREWALL — armoured; frontal shield blocks bolts, so flank it, dash through, or Scan it.
  warden:   { behavior: 'chase',  hp: 5, speed: 30, points: 3, fireMs: 0,    boltSpeed: 0,   keepRange: 0,   diveSpeed: 0,   lockRange: 0,   weave: 0,  telegraphMs: 0,   burst: 0, shielded: true,  splitInto: 0 },
  // PINPOINT — keeps its distance, blinks a wind-up, then fires ONE fast locked line-shot. Sidestep it / break line of sight behind a wall.
  sniper:   { behavior: 'gunner', hp: 2, speed: 40, points: 3, fireMs: 2400, boltSpeed: 300, keepRange: 200, diveSpeed: 0,   lockRange: 0,   weave: 0,  telegraphMs: 620, burst: 0, shielded: false, splitInto: 0 },
  // REPLICATOR — splits into two chasing shards on death. Finish it near a wall or clear the shards with an AoE.
  splitter: { behavior: 'chase',  hp: 3, speed: 34, points: 3, fireMs: 0,    boltSpeed: 0,   keepRange: 0,   diveSpeed: 0,   lockRange: 0,   weave: 0,  telegraphMs: 0,   burst: 0, shielded: false, splitInto: 2 },
  // JITTER — fast zig-zag interceptor; weaves so aimed shots miss. Lead it, or catch it with a Scan pulse.
  weaver:   { behavior: 'weaver', hp: 2, speed: 68, points: 3, fireMs: 0,    boltSpeed: 0,   keepRange: 0,   diveSpeed: 0,   lockRange: 0,   weave: 88, telegraphMs: 0,   burst: 0, shielded: false, splitInto: 0 },
  // PYLON — rooted emitter; blinks, then fires a radial bolt-ring. Rush it and kill it between volleys.
  turret:   { behavior: 'turret', hp: 4, speed: 0,  points: 3, fireMs: 2200, boltSpeed: 118, keepRange: 0,   diveSpeed: 0,   lockRange: 0,   weave: 0,  telegraphMs: 520, burst: 8, shielded: false, splitInto: 0 },
} as const;
export type SweepEnemyKind = keyof typeof SWEEP_ENEMIES;

/* --------------------------------- textures -------------------------------- */
// Central asset key registry — procedural today, swappable for real art later.
export const TEX = {
  px: 'px',
  spark: 'spark',
  glow8: 'glow8',
  ring: 'ring',
  noise: 'noise',
  vignette: 'vignette', // shared cinematic edge-framing (all zones)
  millerFog: 'miller-fog', // drifting dusk field-fog
  motelFog: 'motel-fog', // drifting neon-lot fog
  // terrain
  tileGrass: 'tile-grass',
  tileDirt: 'tile-dirt',
  tileDirtRock: 'tile-dirt-rock',
  tileDirtBrick: 'tile-dirt-brick',
  tileDirtRoot: 'tile-dirt-root',
  tilePlatform: 'tile-platform',
  tileHidden: 'tile-hidden',
  cliffEdge: 'cliff-edge',
  grassOverhang: 'grass-overhang',
  rootDrip: 'root-drip',
  buriedNode: 'buried-node',
  scanGlyph: 'scan-glyph',
  marker47: 'marker-47',
  hillsBack: 'hills-back',
  moonRays: 'moon-rays',
  distHaze: 'dist-haze',
  groundMist: 'ground-mist',
  vine: 'vine',
  fence: 'fence',
  towerBase: 'tower-base',
  scannerRig: 'scanner-rig',
  signalBox: 'signal-box',
  doorGlyph: 'door-glyph',
  nodePortal: 'node-portal',
  grassTuft: 'grass-tuft',
  // parallax
  sky: 'sky',
  stars: 'stars',
  clouds: 'clouds',
  hillsFar: 'hills-far',
  hillsMid: 'hills-mid',
  island: 'island',
  towerSilhouette: 'tower-silhouette',
  moon: 'moon',
  windmillTower: 'windmill-tower',
  windmillBlades: 'windmill-blades',
  telephonePole: 'telephone-pole',
  // Chagrin Falls title scene
  townHills: 'town-hills',
  steeple: 'steeple',
  brickA: 'brick-a',
  brickB: 'brick-b',
  brickC: 'brick-c',
  brickD: 'brick-d',
  shopFront: 'shop-front',
  bridgeSpan: 'bridge-span',
  gorgeWall: 'gorge-wall',
  waterfallBase: 'waterfall-base',
  waterfallDashes: 'waterfall-dashes',
  waterFoam: 'water-foam',
  riverGlint: 'river-glint',
  streetLamp: 'street-lamp',
  pineTree: 'pine-tree',
  roundTree: 'round-tree',
  bushSmall: 'bush-small',
  railing: 'railing',
  flagUs: 'flag-us',
  kidWill: 'kid-will',
  kidChip: 'kid-chip',
  kidHenry: 'kid-henry',
  kidCameron: 'kid-cameron',
  kidDanny: 'kid-danny',
  // actors
  player: 'player',
  playerHurt: 'player-hurt',
  playerGlow: 'player-glow',
  // per-skin player bodies (contact47 uses `player` above)
  playerWill: 'player-will',
  playerChip: 'player-chip',
  playerHenry: 'player-henry',
  playerCameron: 'player-cameron',
  playerDanny: 'player-danny',
  // scout relics (the power piece of each Signal Set)
  relicWill: 'relic-will',
  relicChip: 'relic-chip',
  relicHenry: 'relic-henry',
  relicCameron: 'relic-cameron',
  relicDanny: 'relic-danny',
  scoutEcho: 'scout-echo',
  fieldNote: 'field-note',
  drone: 'drone',
  cone: 'cone',
  boltPlayer: 'bolt-player',
  boltEnemy: 'bolt-enemy',
  // pickups / markers
  badgeWill: 'badge-will',
  fragment: 'fragment',
  routeMarker: 'route-marker',
  signpost: 'signpost', // "road out" exit marker at the east edge of Miller Field
  // boss
  bossPole: 'boss-pole',
  bossArms: 'boss-arms',
  bossHead: 'boss-head',
  bossCore: 'boss-core',
  bossBeam: 'boss-beam',
  // blipstream
  wavePlatform: 'wave-platform',
  hazardBar: 'hazard-bar',
  nodeSwitch: 'node-switch',
  exitGate: 'exit-gate',
  scanLine: 'scan-line',
  gridBg: 'grid-bg',
  // Zone 2 — Motel Nowhere
  motelSky: 'motel-sky',
  motelStars: 'motel-stars',
  motelHills: 'motel-hills',
  motelBillboard: 'motel-billboard', // distant highway sign (parallax)
  neonPlatform: 'neon-platform', // powered sign platform (lit state tinted at runtime)
  neonPlatformDark: 'neon-platform-dark', // unpowered ghost outline
  powerSwitch: 'power-switch', // shoot to toggle a circuit
  fuseBox: 'fuse-box', // Blipstream circuit entrance
  neonSignVacancy: 'neon-vacancy', // the boss sign face
  neonSignDiner: 'neon-diner',
  neonSignMotel: 'neon-motel',
  neonArrow: 'neon-arrow',
  iceMachine: 'ice-machine',
  dinerWindow: 'diner-window',
  securityLamp: 'security-lamp',
  wetGround: 'wet-ground', // asphalt tile
  wetGroundEdge: 'wet-ground-edge',
  puddle: 'puddle', // reflective puddle
  motelWall: 'motel-wall', // motel room wall block
  badgeChip: 'badge-chip',
  // Vacancy Sign boss
  vsFrame: 'vs-frame', // sign frame/housing
  vsLetter: 'vs-letter', // a falling neon letter projectile
  vsBar: 'vs-bar', // sweeping buzz light-bar
  vsCore: 'vs-core', // exposed filament core
  // Zone 3 — Chagrin Falls High (Tiger Stadium)
  stadiumSky: 'stadium-sky', // rich atmospheric gradient (smooth, LINEAR)
  stadiumStars: 'stadium-stars',
  stadiumClouds: 'stadium-clouds', // soft volumetric cloud band (far, hazy)
  stadiumMoon: 'stadium-moon', // soft moon disc + halo
  stadiumSkyline: 'stadium-skyline', // aerial-perspective town/hills skyline
  stadiumGorge: 'stadium-gorge', // distant Chagrin waterfall + gorge (hero landmark)
  stadiumFog: 'stadium-fog', // drifting low field-fog
  stadiumHaze: 'stadium-haze', // atmospheric distance haze (depth cue)
  lightBeamUp: 'light-beam-up', // volumetric light-tower beam into the sky
  stadiumVignette: 'stadium-vignette', // cinematic foreground framing
  stadiumHills: 'stadium-hills',
  stadiumBleachersFar: 'stadium-bleachers-far', // parallax stand silhouette
  fieldTurf: 'field-turf', // '#' ground surface (lit turf top)
  fieldSoil: 'field-soil', // buried '#' (plain earth — no per-tile top band)
  fieldStripe: 'field-stripe', // yard-line decor
  trackTile: 'track-tile', // red-cinder track lane
  bleacherRow: 'bleacher-row', // '=' platform (bleacher step / catwalk)
  pressBox: 'press-box',
  lightTower: 'light-tower', // sweeping-cone anchor
  scoreboard: 'scoreboard', // KNOWN/UNKNOWN threat-meter landmark
  tigerBanner: 'tiger-banner',
  goalpost: 'goalpost',
  poolNode: 'pool-node', // rec-pool dive portal
  poolSurface: 'pool-surface',
  safeZoneGlow: 'safe-zone-glow', // ANCHOR green field
  anchorMarker: 'anchor-marker', // green ANCHOR icon
  lockerCache: 'locker-cache', // hidden salvage cache
  badgeHenry: 'badge-henry',
  badgeCameron: 'badge-cameron',
  badgeDanny: 'badge-danny',
  // Zone 3 underwater reflection node
  underwaterBg: 'underwater-bg',
  godRay: 'god-ray',
  bubble: 'bubble',
  echoBody: 'echo-body', // the delayed reflection sprite
  syncPad: 'sync-pad', // echo-sync gate pad
  // Weather Balloon boss
  wbBody: 'wb-body', // inflated armored decoy
  wbDeflate: 'wb-deflate', // deflated / thrashing tangle
  wbValve: 'wb-valve', // exposed valve core
  wbSpotlight: 'wb-spotlight', // telegraphed slam column
  // The Sweep — top-down bonus arena (generated on scene entry)
  sweepBg: 'sweep-bg', // radar grid tile
  sweepBlip: 'sweep-blip', // the player as a signal blip (top-down)
  sweepDrifter: 'sweep-drifter',
  sweepTagger: 'sweep-tagger',
  sweepDiver: 'sweep-diver',
  sweepWarden: 'sweep-warden', // FIREWALL — rotating frontal shield
  sweepSniper: 'sweep-sniper', // PINPOINT — long-lens line-shot drone
  sweepSplitter: 'sweep-splitter', // REPLICATOR — clustered shards
  sweepWeaver: 'sweep-weaver', // JITTER — fast zig-zag interceptor
  sweepTurret: 'sweep-turret', // PYLON — rooted radial emitter
  sweepShotP: 'sweep-shot-p', // player pulse
  sweepShotE: 'sweep-shot-e', // enemy label bolt
  sweepReticle: 'sweep-reticle', // mouse aim crosshair
  sweepPickup: 'sweep-pickup', // dropped pickup (tinted per type)
  // The Render — top-down Area 47 field ("a simulated copy of the terrain")
  sweepGrass: 'sweep-grass', // ground tile
  sweepDirt: 'sweep-dirt', // dirt patch / clearing tile
  sweepCrop: 'sweep-crop', // crop-circle glyph rings decal
  sweepRock: 'sweep-rock',
  sweepBush: 'sweep-bush', // tree/bush canopy silhouette
  sweepFence: 'sweep-fence', // fence segment
  sweepNode: 'sweep-node', // central Signal Node (objective anchor)
  sweepShadow: 'sweep-shadow', // soft ground shadow
  sweepTower: 'sweep-tower', // radio tower prop
  sweepSign: 'sweep-sign', // wooden sign board (text drawn over it)
  // per-biome layout art (distinct top-down levels)
  sweepAsphalt: 'sweep-asphalt', // motel biome ground (wet blacktop)
  sweepBlock: 'sweep-block', // motel biome cover (circuit/utility block)
  sweepNeonSign: 'sweep-neon-sign', // motel biome landmark
  sweepHedge: 'sweep-hedge', // miller biome WALL tile (hedgerow)
  sweepWallMotel: 'sweep-wall-motel', // motel biome WALL tile (neon-edged panel)
  // AAA overhaul: ground variants, decals, new props, better actors, VFX
  sweepGrass2: 'sweep-grass2', // lit grass patch variant
  sweepGrassDk: 'sweep-grass-dk', // dark grass patch variant
  sweepPath: 'sweep-path', // worn dirt path/clearing tile
  sweepFlower: 'sweep-flower', // wildflower decal cluster
  sweepPebbles: 'sweep-pebbles', // pebble/gravel decal
  sweepWeed: 'sweep-weed', // grass tuft/weed decal
  sweepScrap: 'sweep-scrap', // scrap/debris decal
  sweepContam: 'sweep-contam', // signal-contamination splotch decal
  sweepLog: 'sweep-log', // fallen log prop
  sweepCrate: 'sweep-crate', // crate prop
  sweepBunker: 'sweep-bunker', // small structure landmark
  sweepBlipBody: 'sweep-blip-body', // dedicated top-down CONTACT-47 sprite
  sweepElite: 'sweep-elite', // menacing Classifier elite sprite
  sweepMazeHeart: 'sweep-maze-heart', // Zone-4 finale boss: the Maze Heart construct
  sweepShadowLg: 'sweep-shadow-lg', // larger prop ground shadow
  sweepBoltGlow: 'sweep-bolt-glow', // additive halo behind bolts
  // Zone 4 — Patterson's Orchard (side-view)
  orchardSky: 'orchard-sky', // dusk gradient
  orchardStars: 'orchard-stars',
  orchardHills: 'orchard-hills', // distant orchard-row silhouette (parallax)
  orchardBarn: 'orchard-barn', // white barn + green metal roof (parallax landmark)
  appleTree: 'apple-tree', // apple-tree pillar (trunk + foliage + red apples)
  orchardTrunk: 'orchard-trunk', // tileable apple-tree trunk (backdrop behind the fruit-platform climb)
  fruitPlatform: 'fruit-platform', // respawning fruit platform ('%')
  cornWall: 'corn-wall', // side-view corn-maze wall segment (shifts on the beat)
  orchardGround: 'orchard-ground', // '#' ground tile (soil + grass top)
  orchardPlatform: 'orchard-platform', // '=' branch/plank ledge
  orchardLight: 'orchard-light', // hanging orchard light (purple/red glow)
  cropGlyph: 'crop-glyph', // glowing crop-circle glyph (side-view decor / maze heart)
  chaff: 'chaff', // drifting chaff mote
  hayBale: 'hay-bale',
  harvestGlyph: 'harvest-glyph', // Harvest Pattern boss rotating crop-symbol
  harvestCore: 'harvest-core', // boss exposed core
  // Zone 4 — top-down orchard biome (Sweep `maze-z4`)
  sweepCornGround: 'sweep-corn-ground', // orchard biome ground (corn rows)
  sweepCornWall: 'sweep-corn-wall', // orchard biome WALL tile (corn stalks)
} as const;

/* ---------------------------------- events --------------------------------- */
// EventBus channel names — shared between Phaser scenes and the HTML shell.
export const EVT = {
  hudHp: 'hud:hp',
  hudEnergy: 'hud:energy',
  hudCooldowns: 'hud:cooldowns',
  hudClassify: 'hud:classify',
  // top-down combat HUD channels (SweepScene → UIScene)
  hudSweep: 'hud:sweep', // {active} — enter/leave top-down HUD mode
  hudSweepStats: 'hud:sweep-stats', // {heat, node, target, enemies, mode, combo, weapon, overdrive, odReady}
  hudBanner: 'hud:banner', // {text} — big centred combat callout
  questObjective: 'quest:objective',
  questStep: 'quest:step',
  toast: 'toast',
  error: 'error', // {type, message, stack, count} — a runtime error was logged
  fragmentCount: 'fragment:count',
  bossSpawn: 'boss:spawn',
  bossHp: 'boss:hp',
  bossDead: 'boss:dead',
  sceneChanged: 'scene:changed',
  saveUpdated: 'save:updated',
  scoutLog: 'scout:log',          // opens the HTML transmission modal
  scoutPortrait: 'scout:portrait', // opens the menu portrait easter egg
  tutorial: 'tutorial',           // opens the how-to-play card (rich HTML body)
  transmissionClosed: 'transmission:closed',
  ccOpen: 'cc:open',
  ccClose: 'cc:close',
  ccRefresh: 'cc:refresh',
  audioMute: 'audio:mute',
  debugToggle: 'debug:toggle',
  gamePaused: 'game:paused',
  gameResumed: 'game:resumed',
  statTick: 'stat:tick',
  uiResume: 'ui:resume',
  uiMainMenu: 'ui:mainmenu',
  uiReset: 'ui:reset',
  uiOpenSettings: 'ui:open-settings',
  uiStartGame: 'ui:start-game',
  debugGotoBlipstream: 'debug:goto-blipstream',
  debugGotoField: 'debug:goto-field',
  debugState: 'debug:state',
  settingsChanged: 'settings:changed',
  padStatus: 'pad:status',
  menuActive: 'menu:active',
  collectiblePicked: 'collectible:picked',
  skinUnlocked: 'skin:unlocked',
  skinSelected: 'skin:selected',
  scoutEcho: 'scout:echo',
  musicBeat: 'music:beat', // {bar, step} — AudioSystem step-sequencer → ambience (neon flicker, lamp sweep)
  // progression (earn-loop)
  abilityUnlocked: 'ability:unlocked',
  shardsChanged: 'shards:changed',
  upgradePurchased: 'upgrade:purchased',
  // reward system (Signal Caches / Archive / Trophies)
  rewardCacheEarned: 'reward:cache-earned', // {cacheType, count} — a cache was granted
  rewardOpened: 'reward:opened', // OpenResult — a cache finished opening
  rewardTrophy: 'reward:trophy', // {id} — a trophy just unlocked
  rewardChanged: 'reward:changed', // reward save state changed (refresh UIs)
  rewardBanner: 'reward:banner', // {kind, title, sub, color, icon, rarity} — juicy popup
  rewardOpenArchive: 'reward:open-archive', // request: open the Signal Archive
  rewardOpenCache: 'reward:open-cache', // {cacheType?} — request: open the cache-opening screen
  sweepCleared: 'sweep:cleared', // {combo, noHit} — a Signal Storm arena was cleared
  godMode: 'dev:god-mode', // {on:boolean} — god mode toggled; drives HUD indicator + dev chrome
  flyMode: 'dev:fly-mode', // {on:boolean} — free-fly / noclip toggled from the dev panel
} as const;

/** TEX key for a skin's player body ('' → use TEX.player for contact47) */
export const SKIN_TEX: Record<string, string> = {
  contact47: 'player',
  will: 'player-will',
  chip: 'player-chip',
  henry: 'player-henry',
  cameron: 'player-cameron',
  danny: 'player-danny',
};

/* ------------------------------- HUD layout -------------------------------- */
// Segmented integrity (HP) bar drawn on the Scan HUD canvas (UIScene.drawSweepHud).
export const HUD_HEALTH = {
  x: 8,
  y: VIEW_H - 30,
  segW: 11, // width of one integrity segment
  segH: 7, // height of the bar
  gap: 3, // space between segments
  iconW: 7, // leading heart icon column
} as const;

/* ---------------------------- misc gameplay values -------------------------- */
export const FALL_DAMAGE_Y_PAD = 60;   // px below world bottom before respawn-damage
export const TOAST_MS = 3200;
export const HIDDEN_REVEAL_STAGGER = 40; // ms per px distance-ish stagger feel

/* Reward banners show ONE AT A TIME — earned trophies/caches queue and each gets
   its own spotlight (enter → hold → exit → next). Never stack multiple on screen. */
export const REWARD_BANNER = {
  enterMs: 480,   // entrance animation length (slide/scale + shine sweep)
  holdMs: 1900,   // normal on-screen dwell before it animates out
  bigHoldMs: 2600, // dwell for a `big` (mythic+) trophy — extra spotlight
  exitMs: 420,    // exit animation length
  gapMs: 140,     // beat between one banner leaving and the next entering
  // When a backlog builds up, keep the cadence snappy so the player isn't stuck
  // watching a parade — shorten the dwell (but still one-at-a-time, never stacked).
  backlogThreshold: 2, // queued-after-this many → use the snappier dwell
  backlogHoldMs: 1050,
} as const;
