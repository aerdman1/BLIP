/**
 * BESTIARY DATA — the Command Center's source of truth for enemy gameplay
 * data and replacement-art requirements.
 *
 * Numeric tuning fields reference the live `config.ts` constants directly
 * (e.g. `DRONE.hp`) rather than copying literal numbers, so this page can
 * never drift from the numbers the game actually runs — tune in config.ts,
 * this data (and the Bestiary panel built from it) follows automatically on
 * next build.
 *
 * Fields that describe RUNTIME RENDERING (hitbox size, origin, depth, facing,
 * rotation) are NOT centralized in config.ts — they're literals inside each
 * entity's source file. Those are captured here as of the commit noted by
 * `sourceRefs`; if an entity file changes those literals, this data must be
 * updated by hand (config-derived fields cannot go stale this way; these can
 * — that's why every entry cites exact file:line so it's checkable).
 */
import {
  BOSS,
  BOSS2,
  BOSS3,
  BOSS4,
  BOSS5,
  CLASSIFY,
  DRONE,
  MOTEL,
  SCANRIG,
  STADIUM,
  SWEEP,
  SWEEP_ELITE,
  SWEEP_ENEMIES,
  SWEEP_BOSS,
  LIGHTNING,
  DASHGATE,
  PLAYER,
  TD_VISUALS,
  TEX,
} from '../config';

export type BestiaryAssetKind = 'procedural-runtime' | 'hd-atlas' | 'composited-runtime';

export interface BestiaryAssetRef {
  kind: BestiaryAssetKind;
  /** Phaser texture key(s) this entry renders with. */
  textureKeys: string[];
  /** Where the draw code / atlas source lives. */
  sourceFile: string;
  /** For hd-atlas entries: the packed atlas + json BLIP actually loads at runtime. */
  atlasImage?: string;
  atlasJson?: string;
  /** For hd-atlas entries: the authored PNG(s) upstream of the atlas build. */
  originSource?: string[];
}

export interface BestiaryDims {
  /** native px the texture/frame is generated or authored at. */
  nativeW: number;
  nativeH: number;
  /** actual on-screen size after any runtime scale (e.g. TD_VISUALS.artScale / actorPx). */
  renderedNote: string;
}

export interface BestiaryHitbox {
  w: number;
  h: number;
  note: string;
}

export interface BestiaryReplacementSpec {
  dims: string;
  padding: string;
  directionalVariants: string;
  effectLayers: string;
}

export interface BestiaryEnemyEntry {
  id: string;
  name: string;
  internalId: string;
  zones: string[];
  chip: string;
  chipCls: string;
  behavior: string;
  movement: string;
  attackType: string;
  tuning: Record<string, string>;
  asset: BestiaryAssetRef;
  dims: BestiaryDims;
  origin: string;
  hitbox: BestiaryHitbox;
  perspective: string;
  facing: string;
  rotation: string;
  animation: string;
  shadow: string;
  playerOverlap: string;
  silhouetteIntent: string;
  implementationStatus: string;
  knownIssues: string[];
  replacement: BestiaryReplacementSpec;
  sourceRefs: string[];
}

export interface BestiaryHazardEntry {
  id: string;
  name: string;
  zones: string[];
  chip: string;
  desc: string;
  tuning: Record<string, string>;
  asset: BestiaryAssetRef;
  dims: BestiaryDims;
  behavior: string;
  knownIssues: string[];
  sourceRefs: string[];
}

export interface BestiarySystemEntry {
  id: string;
  name: string;
  desc: string;
  tuning: Record<string, string>;
  usedBy: string[];
  sourceRefs: string[];
}

const ms = (n: number) => `${n}ms`;
const px = (n: number) => `${n}px`;
const pxs = (n: number) => `${n}px/s`;
const deg = (n: number) => `${n}°`;

/* ============================== ENEMIES ================================= */
/* Every entry below needs a dedicated replacement art asset (or, for the HD
 * top-down set, already has one at art-src/sprites/ that this page audits). */

export const BESTIARY_ENEMIES: BestiaryEnemyEntry[] = [
  {
    id: 'scanner-drone',
    name: 'SCANNER DRONE',
    internalId: 'ScannerDrone (src/game/entities/ScannerDrone.ts)',
    zones: ['Miller Field (Zone 1)', 'reused as Spotter body in Chagrin Falls High'],
    chip: 'COMMON — SIDE-VIEW',
    chipCls: 'warn',
    behavior:
      'Patrols a fixed horizontal range with a forward-down detection cone. Aggroes when the player is within DRONE.aggroRange OR the classification tier is THREAT; then hovers to match the player\'s height and fires static bolts on a cooldown.',
    movement:
      'Patrol: horizontal ping-pong between patrolX0/patrolX1 at DRONE.patrolSpeed with a sine bob. Chase: closes to ~72px then backs off, Y velocity clamps toward the player with an added bob — never lands, always airborne.',
    attackType: 'Ranged static bolt fired at the player position on a cooldown; contact also deals touch damage.',
    tuning: {
      HP: String(DRONE.hp),
      'PATROL SPEED': pxs(DRONE.patrolSpeed),
      'CHASE SPEED': pxs(DRONE.chaseSpeed),
      'AGGRO RANGE': px(DRONE.aggroRange),
      'FIRE CD (normal / THREAT)': `${ms(DRONE.fireCooldownMs)} / ${ms(DRONE.threatFireCooldownMs)}`,
      'BOLT SPEED / LIFE': `${pxs(DRONE.boltSpeed)} / ${ms(DRONE.boltLifeMs)}`,
      'DETECTION CONE': `${px(DRONE.coneLength)} · ±${deg(DRONE.coneHalfAngleDeg)}`,
      'TOUCH DAMAGE': String(DRONE.touchDamage),
      'SCAN STUN': `${DRONE.scanStunSec}s`,
      'MAX LIVE BOLTS': String(DRONE.maxBolts),
    },
    asset: {
      kind: 'procedural-runtime',
      textureKeys: [TEX.drone, TEX.glow8],
      sourceFile: 'src/game/systems/ProceduralArt.ts:841-851 (hull), :852-857 (shared cone sprite)',
    },
    dims: { nativeW: 16, nativeH: 12, renderedNote: 'rendered 1:1 — no runtime scale (side-view virtual canvas is native 480×270, RENDER_ZOOM=1)' },
    origin: 'default (0.5, 0.5) — Phaser.Physics.Arcade.Sprite default, not overridden',
    hitbox: { w: 14, h: 10, note: 'body.setSize(14, 10) — ScannerDrone.ts:42, centered, smaller than the 16×12 texture' },
    perspective: 'side-view, 2D profile silhouette (no 3/4 or top-down variant)',
    facing: 'this.setFlipX(dir < 0) — simple horizontal mirror of the whole sprite, no dedicated left/right art',
    rotation: 'none — never rotates; only flips',
    animation:
      'No sprite-sheet animation frames. "Animation" is entirely code-driven: tint flashes white on hit (60ms), violet (P.violetGlitch) while scan-stunned, a separate additive TEX.glow8 halo brightens (alpha 0.3→0.52) when aggroed, and a sine-wave Y bob while patrolling/hovering.',
    shadow: 'None — it flies, no ground shadow rendered.',
    playerOverlap: 'Depth 18 (glow halo at depth 17, beneath it) — always draws above ground/platform layers; no explicit anti-obstruction logic versus the player sprite (both are small, side-view).',
    silhouetteIntent: 'A small hostile drone — angular hull, single red "eye" lens, side pods, rotor nubs. Reads as a compact flying camera/turret.',
    implementationStatus: 'Shipped — 100% procedural placeholder art (Phaser Graphics → generateTexture), no static image asset exists.',
    knownIssues: [
      'Placeholder appearance: hand-drawn 16×12 rect-based silhouette, not a designed sprite — flat single-tone hull with no shading pass.',
      'Only 2 visual states (patrol/aggro tint + halo) — no distinct "about to fire" telegraph beyond the cone itself.',
      'No directional art — left/right is a mirror, so any asymmetric detail (an eye offset, an antenna) would look wrong on one side.',
    ],
    replacement: {
      dims: '16×12px minimum (native scale, no upscale planned) — texture keeps this hull footprint; hitbox should stay ≈14×10 to match tuning without an art-only rebalance.',
      padding: '1–2px transparent margin so the additive glow halo (TEX.glow8, scale 1.3) doesn\'t clip the new silhouette.',
      directionalVariants: 'Single base sprite is fine IF strictly left-right symmetric; otherwise needs a true mirrored pair (art currently assumes symmetry via setFlipX).',
      effectLayers: 'Keep the red "eye" as a separately-tintable pixel/region so hit-flash (full white) and aggro-glow (red halo) both still read; scan-stun needs a distinct violet-glitch look (current: whole-sprite tint).',
    },
    sourceRefs: ['src/game/entities/ScannerDrone.ts', 'src/game/systems/ProceduralArt.ts:841-857', 'src/game/config.ts:401-415'],
  },
  {
    id: 'spotter',
    name: 'SPOTTER',
    internalId: 'Spotter (src/game/entities/Spotter.ts)',
    zones: ['Chagrin Falls High / Tiger Stadium (Zone 3) — stage-2 threat ladder'],
    chip: 'STADIUM STAGE 2 — SIDE-VIEW',
    chipCls: 'warn',
    behavior:
      'Launched once the stadium threat ladder reaches TRACKED. Hunts by closing on a point hovering above the player\'s last known position; feeds classification while it has an unbroken sightline, gives up and retires after losing sight for spotterLoseSightMs.',
    movement: 'Free-floats (no physics body — plain x/y lerp toward a target point above the player) with a small sine bob; on retire, climbs straight up at 1.6× speed and fades out.',
    attackType: 'None — it never damages the player directly. Its only "attack" is feeding the classification/threat-ladder read via its own detection cone.',
    tuning: {
      SPEED: pxs(STADIUM.spotterSpeed),
      'HOVER HEIGHT ABOVE PLAYER': px(STADIUM.spotterHoverAbove),
      CONE: `${px(STADIUM.spotterConeLength)} · ±${deg(STADIUM.spotterConeHalfAngleDeg)}`,
      'LOSE-SIGHT RETIRE TIMER': ms(STADIUM.spotterLoseSightMs),
      'RETIRE CLIMB DURATION': ms(STADIUM.spotterRetireMs),
      'AGGRO/RELEASE THRESHOLD (shared ladder)': `${STADIUM.spotterAt} / ${STADIUM.spotterReleaseAt}`,
    },
    asset: {
      kind: 'procedural-runtime',
      textureKeys: [TEX.drone, TEX.glow8],
      sourceFile: 'Spotter.ts:57 — reuses TEX.drone (the Scanner Drone hull) tinted P.scoreboardKnown, plus a monospace "SPOTTER"/"SEARCHING…" text label',
    },
    dims: { nativeW: 16, nativeH: 12, renderedNote: 'same native drone hull, no dedicated Spotter sprite' },
    origin: 'default (0.5, 0.5) on the reused Image',
    hitbox: { w: 0, h: 0, note: 'no physics body at all — Spotter is a plain Phaser.GameObjects.Image driven by hand-rolled x/y math (Spotter.ts:28), not an Arcade Sprite; it cannot be touched or hit' },
    perspective: 'side-view',
    facing: 'no facing logic — never flips (would look identical either direction since it\'s the drone hull with no asymmetric detail)',
    rotation: 'none',
    animation: 'Tint + alpha driven: halo alpha tweens 0.3↔0.6 continuously; body/halo/label alpha fade to 0 over spotterRetireMs on retire; label text swaps "SPOTTER" ↔ "SEARCHING…" based on time-since-lost-sight.',
    shadow: 'None (airborne).',
    playerOverlap: 'Depth 13 (halo) / 14 (body + label) — sits below the drone\'s own depth (17/18); never collides with the player (no body).',
    silhouetteIntent: 'A distinct "eye in the sky" reads as visually different from the aggressive Scanner Drone (it\'s a watcher, not a shooter) — currently unmet, since it is literally the same texture with a different tint.',
    implementationStatus: 'Functional stub — reuses the Scanner Drone hull texture with a tint swap; no unique silhouette exists.',
    knownIssues: [
      'Unclear identity: visually indistinguishable in shape from the Scanner Drone (same 16×12 hull), differentiated only by color tint and a text label — easy to misread as "another drone" rather than "a non-damaging spotter."',
      'Poor readability at gameplay scale: the "SPOTTER"/"SEARCHING…" text label is the primary way players learn what this is, which only works if they stop to read 6px monospace text mid-chase.',
      'No dedicated art asset exists for this enemy at all — it is the single clearest "needs its own sprite" case in the roster.',
    ],
    replacement: {
      dims: '16×12–20×14px range to stay legible at the drone\'s scale, but with a shape that reads as "camera/eye" rather than "combat drone" (e.g. a lens/iris silhouette vs. the drone\'s gun-nose hull).',
      padding: '2px minimum for the halo glow layer.',
      directionalVariants: 'none required — it hovers and tracks, doesn\'t bank/turn in a way that demands a facing flip.',
      effectLayers: 'Needs its own "watching" tell independent of the text label — e.g. a visible iris that widens/narrows with sees/lostMs state, so the read doesn\'t depend on reading text at 6px.',
    },
    sourceRefs: ['src/game/entities/Spotter.ts', 'src/game/config.ts:633-684 (STADIUM)'],
  },
  {
    id: 'boss-scarecrow-antenna',
    name: 'THE SCARECROW ANTENNA',
    internalId: 'ScarecrowAntennaBoss (src/game/entities/ScarecrowAntennaBoss.ts)',
    zones: ['Miller Field (Zone 1) — boss'],
    chip: 'BOSS — ZONE 1',
    chipCls: 'bad',
    behavior:
      'A pole-and-wire idol; its signal core is caged mid-pole. Scan to expose the core for a window, then land jump-shots. Fires radial bolt bursts and spinning beams, and summons Scanner Drones at 66%/33% HP.',
    movement: 'Rooted — the pole does not translate; only the arms/head/beam rotate/animate in place.',
    attackType: 'Radial bolt bursts (BOSS.radialCount bolts), two spinning beams, drone summons at HP thresholds; touch damage on contact.',
    tuning: {
      HP: String(BOSS.hp),
      'CORE EXPOSE WINDOW': ms(BOSS.coreExposeMs),
      'RADIAL BURST': `${BOSS.radialCount} bolts @ ${pxs(BOSS.radialSpeed)} every ${ms(BOSS.radialPeriodMs)} (telegraph ${ms(BOSS.radialTelegraphMs)})`,
      BEAMS: `2 × ${px(BOSS.beamLength)} @ ${deg(BOSS.beamSpinDegPerSec)}/s`,
      SUMMONS: `drones at ${BOSS.summonAtFracs.map((f) => `${Math.round(f * 100)}%`).join(' / ')} hp`,
      'TOUCH / BEAM DAMAGE': String(BOSS.touchDamage),
      STAGGER: ms(BOSS.staggerMs),
    },
    asset: {
      kind: 'procedural-runtime',
      textureKeys: [TEX.bossPole, TEX.bossArms, TEX.bossHead, TEX.bossCore, TEX.bossBeam],
      sourceFile: 'src/game/systems/ProceduralArt.ts:913-953',
    },
    dims: { nativeW: 60, nativeH: 56, renderedNote: 'multi-part rig: pole 8×56, arms 60×12, head 24×20, core 12×12, beam 120×10 — composited, not a single sprite' },
    origin: 'pole setOrigin(0.5, 1) (feet-anchored); arms/head/core/beam default (0.5, 0.5) except beam setOrigin(0, 0.5) (pivots from its base)',
    hitbox: { w: 12, h: 12, note: 'core is a static physics image at native TEX.bossCore size (12×12) — no explicit setSize call in ScarecrowAntennaBoss.ts, so hitbox = texture size' },
    perspective: 'side-view, multi-part rig composited from 5 separate images at one world position',
    facing: 'no facing/flip logic — symmetric rig, always faces camera',
    rotation: 'arms + beam rotate continuously (beam at BOSS.beamSpinDegPerSec); head/pole/core are static orientation',
    animation: 'No sprite-sheet frames — entirely tween/property driven: core alpha fades in on expose, beam alpha/rotation animate, stagger flashes a white tint on hit, radial-burst telegraph is a separate converging-particle effect layered on top (not part of the boss sprite itself).',
    shadow: 'No dedicated ground shadow object found for this boss in the constructor — relies on the arena floor art beneath it.',
    playerOverlap: 'Depth-layered 13 (radial telegraph glow) → 14 (pole) → 15 (arms) → 16 (head) → 16 (core glow) → 17 (core) — core always draws above the rest of the rig so the exposed-hit target reads clearly over the player.',
    silhouetteIntent: 'A gaunt, wired scarecrow-on-a-pole "idol" the Interpretation Engine planted — spindly, agricultural-sinister, with a clearly separable caged core as the readable weak point.',
    implementationStatus: 'Shipped — fully procedural, no static art; the only Zone-1 boss and the model the other 4 zone bosses follow structurally.',
    knownIssues: [
      'Composited from 5 independently-drawn parts at runtime rather than one authored silhouette — any replacement needs to either match this 5-part rig exactly or the boss code needs updating alongside the art (this task explicitly excludes code changes).',
      'No idle "breathing"/ambient motion beyond the spinning beams — reads static between attack phases.',
    ],
    replacement: {
      dims: 'Match the 5-part footprint: pole 8×56, arms 60×12, head 24×20, core 12×12, beam 120×10 (or propose a single consolidated rig — requires a follow-up code task, out of scope here).',
      padding: '2px per part for glow/additive layering (core glow uses a scaled TEX.glow8 halo).',
      directionalVariants: 'none — boss is camera-facing/symmetric, never flips.',
      effectLayers: 'Core needs a distinct "exposed vs caged" visual state independent of alpha-only tweening; beam needs a bright additive-blend variant (currently ADD blend mode on a plain rectangle).',
    },
    sourceRefs: ['src/game/entities/ScarecrowAntennaBoss.ts', 'src/game/systems/ProceduralArt.ts:913-953', 'src/game/config.ts:436-449'],
  },
  {
    id: 'boss-vacancy-sign',
    name: 'THE VACANCY SIGN',
    internalId: 'VacancySignBoss (src/game/entities/VacancySignBoss.ts)',
    zones: ['Motel Nowhere (Zone 2) — boss'],
    chip: 'BOSS — ZONE 2',
    chipCls: 'bad',
    behavior: 'A buzzing neon motel sign. Drops neon letters, sweeps a light bar, and periodically short-circuits (stutters), self-exposing its core.',
    movement: 'Rooted at a fixed sign position; short-circuit stutter is the only positional "tell" (visual jitter, not translation).',
    attackType: 'Falling neon letters (volleys of BOSS2.letterCount), a sweeping light bar, touch damage.',
    tuning: {
      HP: String(BOSS2.hp),
      'CORE EXPOSE WINDOW': ms(BOSS2.coreExposeMs),
      LETTERS: `${BOSS2.letterCount} @ ${pxs(BOSS2.letterSpeed)} every ${ms(BOSS2.letterDropPeriodMs)}, life ${ms(BOSS2.letterLifeMs)}`,
      'LIGHT BAR': `sweep ${ms(BOSS2.barSweepPeriodMs)}, halfwidth ${px(BOSS2.barHalfWidth)}, dmg ${BOSS2.barDamage}`,
      'STUTTER (self-expose)': `every ${ms(BOSS2.stutterEveryMs)}, lasts ${ms(BOSS2.stutterMs)}`,
      'TOUCH DAMAGE': String(BOSS2.touchDamage),
      STAGGER: ms(BOSS2.staggerMs),
    },
    asset: {
      kind: 'procedural-runtime',
      textureKeys: [TEX.vsFrame, TEX.vsLetter, TEX.vsBar, TEX.vsCore, TEX.glow8],
      sourceFile: 'src/game/systems/ProceduralArt.ts:1589-1620',
    },
    dims: { nativeW: 52, nativeH: 30, renderedNote: 'frame 52×30, letter 9×11 (spawned per-volley), bar 120×6, core 12×12' },
    origin: 'frame/core default (0.5, 0.5); bar likely origin default centered on its sweep track (see VacancySignBoss.ts:81)',
    hitbox: { w: 12, h: 12, note: 'core static body defaults to TEX.vsCore native size (12×12) — no explicit setSize call found' },
    perspective: 'side-view, multi-part (frame + spawned letters + bar + core)',
    facing: 'none — static sign orientation',
    rotation: 'none observed',
    animation: 'Frame alpha fades in on spawn; core exposes/hides via alpha; letters are individually-spawned falling images (not frame animation) that despawn after letterLifeMs; stutter is a jitter/flicker effect layered on top.',
    shadow: 'No dedicated shadow — mounted sign, not a grounded actor.',
    playerOverlap: 'Depth-layered: bar 13, glow halos 14/16, frame 16, core 17 — core again always renders topmost of the rig.',
    silhouetteIntent: 'A dead motel sign (classic Americana neon) gone hostile — the "VACANCY" lettering motif is the read; letters falling as projectiles should visually connect to the sign shape.',
    implementationStatus: 'Shipped — fully procedural, no static art.',
    knownIssues: [
      'Placeholder geometric sign frame — no actual "VACANCY" letterform silhouette baked into the frame texture itself; the letter *projectiles* are separate small tiles, not obviously tied to the sign visually.',
      'Same multi-part composited-rig risk as other bosses: replacement art must match this part breakdown or trigger a code follow-up.',
    ],
    replacement: {
      dims: 'frame 52×30, letter 9×11 (needs to read individually as a flying "letter" projectile at gameplay scale), bar 120×6, core 12×12.',
      padding: '2px around letter sprites for their motion trail; frame needs enough margin for the glow halo layers.',
      directionalVariants: 'none.',
      effectLayers: 'Neon buzz/flicker as a distinct layer from the stutter self-expose tell, so players can read "short-circuiting, core is open" vs. ambient flicker.',
    },
    sourceRefs: ['src/game/entities/VacancySignBoss.ts', 'src/game/systems/ProceduralArt.ts:1589-1620', 'src/game/config.ts:452-466'],
  },
  {
    id: 'boss-weather-balloon',
    name: 'THE WEATHER BALLOON',
    internalId: 'WeatherBalloonBoss (src/game/entities/WeatherBalloonBoss.ts)',
    zones: ["Chagrin Falls High / Tiger Stadium (Zone 3) — boss"],
    chip: 'BOSS — ZONE 3',
    chipCls: 'bad',
    behavior: 'A bobbing decoy balloon that vents drones from inside; clearing the vented drones deflates it, exposing the valve core for a window before it reinflates.',
    movement: 'Bobs vertically (bobPeriodMs/bobAmp) at a fixed X; no horizontal travel.',
    attackType: 'Vents BOSS3.ventDroneCount Scanner Drones per inflate phase, sweeps a telegraphed spotlight beam, touch damage.',
    tuning: {
      HP: String(BOSS3.hp),
      'VENTED DRONES / PHASE': String(BOSS3.ventDroneCount),
      'DEFLATE EXPOSE WINDOW': ms(BOSS3.deflateExposeMs),
      'REINFLATE TIME': ms(BOSS3.reinflateMs),
      BOB: `${ms(BOSS3.bobPeriodMs)} period · ${px(BOSS3.bobAmp)} amplitude`,
      SPOTLIGHT: `every ${ms(BOSS3.spotlightPeriodMs)}, telegraph ${ms(BOSS3.spotlightTelegraphMs)}, halfwidth ${px(BOSS3.spotlightHalfWidth)}, dmg ${BOSS3.spotlightDamage}`,
      'TOUCH DAMAGE': String(BOSS3.touchDamage),
      STAGGER: ms(BOSS3.staggerMs),
    },
    asset: {
      kind: 'procedural-runtime',
      textureKeys: [TEX.wbBody, TEX.wbDeflate, TEX.wbValve, TEX.wbSpotlight],
      sourceFile: 'src/game/systems/ProceduralArt.ts:2050-2090 (wbBody is linearize()d for smooth bloom — the one boss body with a soft-shaded pass)',
    },
    dims: { nativeW: 40, nativeH: 46, renderedNote: 'body 40×46, deflated-tangle alt state 40×32, valve core 14×14, spotlight beam 28×200 (tall vertical shaft, origin(0.5,1))' },
    origin: 'body/tangle/valve default (0.5, 0.5); spotlight setOrigin(0.5, 1) — anchored at its base, extends upward/downward as a shaft',
    hitbox: { w: 14, h: 14, note: 'valve core static body defaults to TEX.wbValve native size (14×14) — no explicit setSize call found' },
    perspective: 'side-view, alt-state swap (inflated body ↔ deflated tangle) rather than a rigid multi-part rig like the other bosses',
    facing: 'none',
    rotation: 'none — bob is purely vertical translation',
    animation: 'Cross-fades between two full-body textures (inflated TEX.wbBody vs. deflated TEX.wbDeflate) via alpha, rather than a shared rig with independently animated parts — the closest thing to a "2-frame" state in the boss roster, but it is an alpha crossfade, not a spritesheet swap.',
    shadow: 'No dedicated shadow (airborne balloon).',
    playerOverlap: 'Depth-layered: spotlight shaft 12 (below everything, cast down onto the arena floor), glow 13, tangle 15, body 16, valve glow/core 16/17.',
    silhouetteIntent: 'A weather balloon repurposed as a surveillance decoy — should read as bulbous/tethered when inflated and visibly "popped/tangled" when deflated, with the valve as an obvious weak point once exposed.',
    implementationStatus: 'Shipped — fully procedural; the only boss with a `linearize()` smooth-shading pass applied to its main body texture.',
    knownIssues: [
      'The inflated/deflated crossfade is alpha-only — no shape deformation, so "deflating" reads mostly through the valve exposing rather than the balloon itself visibly changing form.',
      'Spotlight beam (28×200) is a very tall thin rectangle — at gameplay scale (270px tall viewport) this reads as an abstract light shaft rather than a spotlight cone; may need a designed gradient/falloff rather than a flat tint rect.',
    ],
    replacement: {
      dims: 'body 40×46, deflated 40×32, valve 14×14, spotlight shaft 28×200.',
      padding: '2px for the smooth-shaded body\'s bloom/glow pass to avoid hard clipping.',
      directionalVariants: 'none — camera-facing, no horizontal movement to flip for.',
      effectLayers: 'Keep body/deflated as two swappable full textures (or provide a real deform if the code is later extended to lerp between them); valve needs its own hit-glow layer separate from the body.',
    },
    sourceRefs: ['src/game/entities/WeatherBalloonBoss.ts', 'src/game/systems/ProceduralArt.ts:2050-2090', 'src/game/config.ts:471-484'],
  },
  {
    id: 'boss-harvest-pattern',
    name: 'THE HARVEST PATTERN',
    internalId: 'HarvestPatternBoss (src/game/entities/HarvestPatternBoss.ts)',
    zones: ["Patterson's Orchard (Zone 4) — boss"],
    chip: 'BOSS — ZONE 4',
    chipCls: 'bad',
    behavior: 'A living crop-circle glyph at the maze\'s heart. Rotates harvest symbols around itself and fires telegraphed radial volleys; the core is vulnerable while a "weak" symbol dips toward the player. Below lowHpFrac it enters a rage phase with faster spin and sweeping walls.',
    movement: 'Rooted at the maze-heart position; only the surrounding symbol ring rotates (spinDegPerSec, ramping to ×spinRageMul in rage phase).',
    attackType: 'Radial symbol volleys (BOSS4.symbolCount symbols), low-HP sweep attacks (sweepHalfWidth band), touch damage.',
    tuning: {
      HP: String(BOSS4.hp),
      'CORE EXPOSE WINDOW': ms(BOSS4.coreExposeMs),
      'SYMBOL RING': `${BOSS4.symbolCount} symbols @ ${deg(BOSS4.spinDegPerSec)}/s (align window ${deg(BOSS4.alignWindowDeg)})`,
      'SCAN SLOW': ms(BOSS4.scanSlowMs),
      'RAGE THRESHOLD': `below ${Math.round(BOSS4.lowHpFrac * 100)}% hp → spin ×${BOSS4.spinRageMul}`,
      VOLLEY: `every ${ms(BOSS4.volleyPeriodMs)} (telegraph ${ms(BOSS4.volleyTelegraphMs)}), symbol ${pxs(BOSS4.symbolSpeed)} / ${ms(BOSS4.symbolLifeMs)}`,
      'RAGE SWEEP': `every ${ms(BOSS4.sweepPeriodMs)} (telegraph ${ms(BOSS4.sweepTelegraphMs)}, active ${ms(BOSS4.sweepActiveMs)}), halfwidth ${px(BOSS4.sweepHalfWidth)}, dmg ${BOSS4.sweepDamage}`,
      'TOUCH DAMAGE': String(BOSS4.touchDamage),
      STAGGER: ms(BOSS4.staggerMs),
    },
    asset: {
      kind: 'procedural-runtime',
      textureKeys: [TEX.harvestGlyph, TEX.harvestCore],
      sourceFile: 'src/game/systems/ProceduralArt.ts:2261-2280',
    },
    dims: { nativeW: 44, nativeH: 44, renderedNote: 'glyph 44×44 (crop-circle motif, rotates as a whole), core 16×16 (physics body explicitly resized — see hitbox)' },
    origin: 'default (0.5, 0.5) on both glyph and core',
    hitbox: { w: 20, h: 60, note: 'core.body.setSize(20, 60) — HarvestPatternBoss.ts:98 — DELIBERATELY resized much taller/narrower than the 16×16 core texture, to cover the full vertical band the "weak symbol dips toward you" mechanic needs' },
    perspective: 'side-view, 2-part (rotating glyph ring + core)',
    facing: 'none — radially symmetric',
    rotation: 'the glyph texture rotates continuously as a whole sprite (not individually-rotating symbol sub-sprites) at spinDegPerSec, ramping in rage phase',
    animation: 'Glyph/core alpha fade in on spawn; marker (TEX.glow8-based) flashes to show the aligned weak point; sweepBar is a separate tinted rect that alpha-telegraphs before activating. Comment in config.ts explicitly flags this boss as "first pass ships as a labeled STUB — full read-the-glyph/match-symbol stun mechanic is a polish pass."',
    shadow: 'No dedicated shadow.',
    playerOverlap: 'Depth-layered: glow 13, glyph/core-glow 16, core 17, sweep bar 14 — sweep bar renders below the glyph/core so the boss silhouette stays legible through its own attack telegraph.',
    silhouetteIntent: 'A crop-circle come to life — should read as a rotating glyph/sigil, with the core visually distinct from the decorative symbol ring so the "weak symbol" alignment mechanic is readable at a glance.',
    implementationStatus: 'Shipped but explicitly labeled a design STUB in config.ts — the intended "match the symbol" read mechanic is not fully built; current core-expose gameplay is simpler than the design doc implies.',
    knownIssues: [
      'Weak silhouette risk: a single rotating 44×44 glyph texture must communicate 6 individually-meaningful "symbols" (symbolCount) plus a highlighted weak one — at 480×270 native resolution this is a tight readability budget for one flat sprite.',
      'Explicitly incomplete per its own code comment — any new art should be scoped WITH a design pass on the actual match-symbol mechanic, not just a reskin, or it will bake in the current stub\'s limitations.',
    ],
    replacement: {
      dims: 'glyph 44×44, core 16×16 (hitbox already overridden to 20×60 in code — art doesn\'t need to match the hitbox, just the visual core region).',
      padding: '2px for the glow marker layer that highlights the aligned weak symbol.',
      directionalVariants: 'none — radially symmetric, always faces camera.',
      effectLayers: 'Needs a way to render 6 distinct symbol positions with 1 visually "weak"/highlighted at a time — likely a symbol-ring approach (separate small sprites orbiting) rather than one baked rotating texture, which would also be a code change (flag for follow-up, out of scope here).',
    },
    sourceRefs: ['src/game/entities/HarvestPatternBoss.ts', 'src/game/systems/ProceduralArt.ts:2261-2280', 'src/game/config.ts:491-511'],
  },
  {
    id: 'boss-listening-station',
    name: 'THE LISTENING STATION',
    internalId: 'ListeningStationBoss (src/game/entities/ListeningStationBoss.ts)',
    zones: ['Skyline Array (Zone 5, finale) — boss'],
    chip: 'BOSS — FINALE',
    chipCls: 'bad',
    behavior:
      'An observatory-iris "rumor mirror" that copies the player\'s last-used frequency (skin). Damaged by REFUSING the label — swap to a different skin frequency, then scan to jam the iris open and hit the pupil-core. ~3 phases: eye-beam sweep → lightning barrage → rumor clones.',
    movement: 'Rooted at the observatory position; no translation.',
    attackType: 'Spinning eye-beam, telegraphed lightning-call barrages, low-HP rumor-static clones, touch damage.',
    tuning: {
      HP: String(BOSS5.hp),
      'PUPIL EXPOSE WINDOW': ms(BOSS5.coreExposeMs),
      BEAM: `${deg(BOSS5.beamSpinDegPerSec)}/s, length ${px(BOSS5.beamLength)}, on ${ms(BOSS5.beamOnMs)} / gap ${ms(BOSS5.beamGapMs)} (telegraph ${ms(BOSS5.beamTelegraphMs)})`,
      LIGHTNING: `${BOSS5.lightningCount} bolts every ${ms(BOSS5.lightningPeriodMs)} (telegraph ${ms(BOSS5.lightningTelegraphMs)}), dmg ${BOSS5.lightningDamage}`,
      'LOW-HP CLONES': `${BOSS5.cloneCount} below ${Math.round(BOSS5.lowHpFrac * 100)}% hp`,
      'TOUCH DAMAGE': String(BOSS5.touchDamage),
      STAGGER: ms(BOSS5.staggerMs),
    },
    asset: {
      kind: 'composited-runtime',
      textureKeys: [TEX.glow8, TEX.ring, TEX.px],
      sourceFile: 'src/game/entities/ListeningStationBoss.ts:68-79 — NO dedicated baked texture exists for this boss; it composites entirely from shared generic glow/ring/pixel primitives scaled up at runtime (iris = TEX.glow8 at scale 9, rim = TEX.ring at scale 2.4, beam = TEX.px stretched via setDisplaySize).',
    },
    dims: { nativeW: 0, nativeH: 0, renderedNote: 'no native art dims — iris/rim/beam/core are all runtime-scaled generic primitives, not a purpose-built sprite' },
    origin: 'iris/irisRim/core default (0.5, 0.5); beam setOrigin(0, 0.5)',
    hitbox: { w: 26, h: 26, note: 'core.body.setSize(26, 26) — ListeningStationBoss.ts:73 — explicit, since the underlying TEX.glow8 primitive has no meaningful "native" size to default to' },
    perspective: 'side-view, entirely composited (no dedicated art at all)',
    facing: 'none',
    rotation: 'beam rotates continuously at beamSpinDegPerSec',
    animation: 'Purely alpha/scale-tween driven on shared primitives — no unique frames of any kind.',
    shadow: 'None.',
    playerOverlap: 'Depth-layered: beam 12, iris 13, irisRim 14, rumor-copy label 16 (?), ring/telegraph 16, core 17.',
    silhouetteIntent: 'The finale boss and the thematic capstone (a "mirror" of the player) — currently has ZERO unique silhouette; this is the single biggest visual gap in the entire boss roster given it is the game\'s ending climax.',
    implementationStatus: 'Functional but visually unbuilt — the only boss with no dedicated procedural texture pass at all, running entirely on generic glow/ring primitives borrowed from VFX.',
    knownIssues: [
      'Placeholder appearance (most severe in the game): no custom silhouette whatsoever — reads as a glowing circle + ring, not an "observatory iris" or a mirror of the player as the design fiction describes.',
      'Weak silhouette: a scaled-up soft-glow blob has no readable edges at gameplay scale, unlike every other boss which at least has a hard-edged procedural hull.',
      'This is the finale boss (Skyline Array, the classification-choice climax) — the visual/narrative stakes of shipping placeholder-only art here are the highest of any entry in this Bestiary.',
    ],
    replacement: {
      dims: 'Needs a purpose-built rig: an observatory-iris housing (~40–60px) + a pupil/core (~16–20px) + a beam emitter — proposing roughly the same scale class as the other zone bosses (40–60px primary silhouette).',
      padding: '3–4px for the additive iris glow and beam bloom.',
      directionalVariants: 'none — camera-facing finale set-piece.',
      effectLayers: 'MUST visually "mirror" the player\'s currently-equipped skin color per the design fiction (rumor-static copy) — art needs a tintable/recolorable base layer, not a fixed-palette texture, since the copied-frequency mechanic is core to the fight.',
    },
    sourceRefs: ['src/game/entities/ListeningStationBoss.ts', 'src/game/config.ts:519-536'],
  },
];

/* ------------------ Top-down "Sweep" archetypes (config.SWEEP_ENEMIES) ------------------ */

const SWEEP_TEX_FOR: Record<string, string> = {
  drifter: TEX.sweepDrifter,
  tagger: TEX.sweepTagger,
  diver: TEX.sweepDiver,
  warden: TEX.sweepWarden,
  sniper: TEX.sweepSniper,
  splitter: TEX.sweepSplitter,
  weaver: TEX.sweepWeaver,
  turret: TEX.sweepTurret,
};
const SWEEP_TD_FOR: Record<string, { body: string; emis: string }> = {
  drifter: { body: TEX.tdDrifter, emis: TEX.tdDrifterEmis },
  tagger: { body: TEX.tdTagger, emis: TEX.tdTaggerEmis },
  diver: { body: TEX.tdDiver, emis: TEX.tdDiverEmis },
  warden: { body: TEX.tdWarden, emis: TEX.tdWardenEmis },
  sniper: { body: TEX.tdSniper, emis: TEX.tdSniperEmis },
  splitter: { body: TEX.tdSplitter, emis: TEX.tdSplitterEmis },
  weaver: { body: TEX.tdWeaver, emis: TEX.tdWeaverEmis },
  turret: { body: TEX.tdTurret, emis: TEX.tdTurretEmis },
};
const SWEEP_NATIVE_W: Record<string, number> = {
  drifter: 18, tagger: 18, diver: 18, warden: 22, sniper: 18, splitter: 20, weaver: 16, turret: 20,
};
const SWEEP_DISPLAY_NAME: Record<string, string> = {
  drifter: 'DRIFTER', tagger: 'TAGGER', diver: 'DIVER', warden: 'WARDEN (FIREWALL)',
  sniper: 'SNIPER (PINPOINT)', splitter: 'SPLITTER (REPLICATOR)', weaver: 'WEAVER (JITTER)', turret: 'TURRET (PYLON)',
};
const SWEEP_BEHAVIOR_DESC: Record<string, string> = {
  drifter: 'Simple chaser — closes to the standoff ring around the player and holds an orbit slot so packs fan out instead of stacking.',
  tagger: 'Gunner — holds a preferred range and fires aimed bolts on a cooldown once in range.',
  diver: 'Circles at half speed, then locks on and lunges in a fast committed dive when in range, followed by a recovery pause.',
  warden: 'FIREWALL: chases like a drifter but its shield always faces the player and BLOCKS frontal bolts (~108° arc) — must be flanked, dashed past, or hit with Scan/Overdrive (omni-directional).',
  sniper: 'PINPOINT gunner: holds range, freezes and visibly blinks before locking aim and firing one fast committed line-shot — the freeze is the dodge window.',
  splitter: 'REPLICATOR: chases like a drifter; on death, bursts into splitInto additional smaller shards.',
  weaver: 'JITTER: fast rush with a lateral sine-wave weave layered on its approach vector, so aimed shots slide off unless led.',
  turret: 'PYLON: stationary; blinks a telegraph, then fires a full radial ring of bolts (burst count) — rush it in the gap between volleys.',
};

export const BESTIARY_SWEEP_ENEMIES: BestiaryEnemyEntry[] = (Object.keys(SWEEP_ENEMIES) as Array<keyof typeof SWEEP_ENEMIES>).map((kind) => {
  const cfg = SWEEP_ENEMIES[kind];
  const w = SWEEP_NATIVE_W[kind];
  const hasHd = kind in SWEEP_TD_FOR;
  return {
    id: `sweep-${kind}`,
    name: SWEEP_DISPLAY_NAME[kind],
    internalId: `SweepEnemy (kind: '${kind}') — src/game/entities/sweep/SweepEnemy.ts`,
    zones: ['Sweep arenas (top-down "The Fold") — all zones', 'surface-z1 (Miller Field Fold) uses the HD art variant; other arenas use the procedural variant'],
    chip: 'SWEEP ARCHETYPE — TOP-DOWN',
    chipCls: cfg.shielded ? 'bad' : 'warn',
    behavior: SWEEP_BEHAVIOR_DESC[kind],
    movement: `behavior='${cfg.behavior}' in SWEEP_ENEMIES — speed ${pxs(cfg.speed)}${'weave' in cfg && cfg.weave ? `, weave amplitude ${cfg.weave}` : ''}${'keepRange' in cfg && cfg.keepRange ? `, keep-range ${px(cfg.keepRange)}` : ''}${'lockRange' in cfg && cfg.lockRange ? `, dive lock-range ${px(cfg.lockRange)}` : ''}`,
    attackType: cfg.fireMs
      ? `Ranged bolt @ ${pxs(cfg.boltSpeed)}, fire every ${ms(cfg.fireMs)}${cfg.telegraphMs ? ` (telegraph ${ms(cfg.telegraphMs)})` : ''}${cfg.burst ? `, burst of ${cfg.burst}` : ''}`
      : kind === 'diver'
        ? `Contact lunge @ ${pxs(cfg.diveSpeed)} once locked within ${px(cfg.lockRange)}`
        : 'Contact/touch damage only (no ranged attack)',
    tuning: {
      HP: String(cfg.hp),
      SPEED: pxs(cfg.speed),
      POINTS: String(cfg.points),
      SHIELDED: cfg.shielded ? 'YES — blocks frontal bolts' : 'no',
      'SPLITS ON DEATH': cfg.splitInto ? `${cfg.splitInto} shards` : 'no',
      ...(cfg.fireMs ? { 'FIRE CD': ms(cfg.fireMs), 'BOLT SPEED': pxs(cfg.boltSpeed) } : {}),
      ...(cfg.telegraphMs ? { TELEGRAPH: ms(cfg.telegraphMs) } : {}),
      ...(cfg.weave ? { WEAVE: String(cfg.weave) } : {}),
      ...(cfg.keepRange ? { 'KEEP RANGE': px(cfg.keepRange) } : {}),
      ...(cfg.diveSpeed ? { 'DIVE SPEED': pxs(cfg.diveSpeed), 'LOCK RANGE': px(cfg.lockRange) } : {}),
      ...(cfg.burst ? { 'BURST COUNT': String(cfg.burst) } : {}),
      'CLOSE-COMBAT STANDOFF (shared)': px(SWEEP.closeStandoff),
      'ENEMY KNOCKBACK (shared)': pxs(SWEEP.enemyKnockback),
    },
    asset: hasHd
      ? {
          kind: 'hd-atlas',
          textureKeys: [SWEEP_TEX_FOR[kind], SWEEP_TD_FOR[kind].body, SWEEP_TD_FOR[kind].emis],
          sourceFile: 'src/game/art/sweepTextures.ts (procedural fallback, used in motel/orchard/stadium biomes) + src/game/topdown/TdActors.ts (HD rig, surface-z1 only)',
          atlasImage: 'public/assets/topdown/topdown-z1.webp',
          atlasJson: 'public/assets/topdown/topdown-z1.json',
          originSource: [`art-src/sprites/td-${kind}.png`, `art-src/sprites/td-${kind}-emis.png`],
        }
      : {
          kind: 'procedural-runtime',
          textureKeys: [SWEEP_TEX_FOR[kind]],
          sourceFile: 'src/game/art/sweepTextures.ts',
        },
    dims: {
      nativeW: w,
      nativeH: w,
      renderedNote: hasHd
        ? `procedural fallback native ${w}×${w}px; HD variant (surface-z1 only) authored at 2× intended size, displayed at TD_VISUALS.actorPx.drone = ${TD_VISUALS.actorPx.drone}px on-screen height (scale = actorPx/frame native height, computed in TdActors.ts)`
        : `native ${w}×${w}px, no runtime upscale in the pixel-art Sweep arenas (motel/stadium/orchard biomes)`,
    },
    origin: 'default (0.5, 0.5) — SweepEnemy.ts does not override origin',
    hitbox: { w: 11, h: 11, note: 'body.setSize(11, 11) — SweepEnemy.ts:56 — uniform across ALL 8 archetypes regardless of their native texture size (16–22px), so hitbox is deliberately smaller/looser than the visible sprite for every kind' },
    perspective: hasHd ? 'top-down — procedural (motel/orchard/stadium) OR HD photoreal-styled art (surface-z1 only, per TOPDOWN_VISUAL_SPEC.md)' : 'top-down — procedural only (no HD variant exists for this archetype in any arena)',
    facing: 'No setFlipX/flipY anywhere in SweepEnemy.ts — top-down sprites are drawn radially symmetric (viewed from above) and never mirror.',
    rotation: cfg.shielded
      ? 'setRotation(angleToPlayer) every frame — the ONLY sweep archetype that visibly rotates; its shield-plate art must stay aligned to the +x edge of the texture for this to read correctly'
      : 'none — SweepEnemy.ts never calls setRotation for non-shielded kinds (movement direction is not visually indicated by rotation)',
    animation: 'No sprite-sheet frames. All "animation" is tint (white flash on hit, telegraph blink alternating warning/danger tint every 80ms during charge windows) plus an HP bar (Graphics, redrawn only when HP changes) drawn above the sprite.',
    shadow: hasHd
      ? 'HD variant: dynamic-caster soft shadow via TopDownShadows.ts (pooled, max 24 concurrent), offset/squashed per Oblique.ts using TD_VISUALS.obliqueK; procedural variant: static TEX.sweepShadow (24×12 ellipse) or none depending on scene wiring.'
      : 'TEX.sweepShadow (24×12 soft ellipse, 3-layer alpha) is available in the procedural art set for ground props, but SweepEnemy.ts itself does not attach one automatically — shadow wiring is scene-level.',
    playerOverlap: 'Depth 15 (HP bar at 16, drawn above); in the HD rig (surface-z1) depth is instead y-sort computed from feet position via ActorRig (TdActors.ts) so overlap with the player and terrain resolves by vertical position, not a fixed layer.',
    silhouetteIntent: `Each archetype's silhouette encodes its counter per the design comment in config.ts: ${kind === 'warden' ? 'a visibly shielded front plate' : kind === 'sniper' ? 'a long lens/barrel reads "aims, don\'t stand still"' : kind === 'splitter' ? 'a clustered, obviously-breakable pod' : kind === 'weaver' ? 'swept fins reading "fast/erratic"' : kind === 'turret' ? 'a rooted hex base with cardinal muzzles' : 'a simple drone silhouette distinguished mainly by accent color/variant shape'}.`,
    implementationStatus: hasHd ? 'Shipped — dual-pipeline: procedural (all arenas) + real HD atlas art (surface-z1 only).' : 'Shipped — procedural only, no HD variant built for this archetype in any arena.',
    knownIssues: [
      'Two parallel visual identities for the same gameplay archetype (procedural vs. HD) must be kept silhouette-consistent per TOPDOWN_VISUAL_SPEC.md §5 ("every actor must be identifiable in pure black silhouette at 50% size") — a mismatch reads as a different enemy between arenas.',
      'Hitbox (11×11, uniform) does not scale with the visible sprite (16–22px procedural, 30px-tall HD) — larger archetypes (warden 22px, splitter 20px, turret 20px) read visually bigger than their actual hit/collision footprint.',
    ],
    replacement: {
      dims: hasHd
        ? `Procedural fallback: ${w}×${w}px. HD pass: author at 2× target (target on-screen height ${TD_VISUALS.actorPx.drone}px), matching the existing td-${kind} body+emissive pair convention.`
        : `${w}×${w}px, matching the existing procedural silhouette scale.`,
      padding: '2–3px for the additive emissive/glow layer (HD) or hit-flash tint (procedural).',
      directionalVariants: cfg.shielded ? 'Must render correctly at any rotation (0–360°) since it visibly rotates to face the player — a single top-down sprite authored radially, not a directional set.' : 'None — top-down, never flips or rotates; a single overhead silhouette suffices.',
      effectLayers: hasHd ? 'body + separate ADD-blend emissive layer (matches existing td-*-emis convention) so the "red eye" reads through the darkness pass.' : 'Needs a distinct color-tint region for the white hit-flash and (for gunner/turret kinds) the amber/danger telegraph blink to read clearly.',
    },
    sourceRefs: [
      'src/game/entities/sweep/SweepEnemy.ts',
      'src/game/art/sweepTextures.ts',
      `src/game/config.ts:863-879 (SWEEP_ENEMIES.${kind})`,
      ...(hasHd ? ['src/game/config.ts:1216-1225 (TD_ENEMY_TEX)', 'src/game/topdown/TdActors.ts'] : []),
    ],
  };
});

export const BESTIARY_SWEEP_BOSSES: BestiaryEnemyEntry[] = [
  {
    id: 'sweep-elite',
    name: 'THE CLASSIFIER (ELITE)',
    internalId: "SweepEnemy analog — dedicated elite entity, config: SWEEP_ELITE — see arena `elite` marker in sweepArenas.ts",
    zones: ['Sweep arenas — one Classifier elite per arena (spawns at the arena\'s `elite` marker)'],
    chip: 'SWEEP MINI-BOSS — TOP-DOWN',
    chipCls: 'bad',
    behavior: 'A mini-boss that charges and fires a wide beam attack on a period, dealing heat (classification) on hit; slow but dangerous at range.',
    movement: `speed ${pxs(SWEEP_ELITE.speed)} — slow, deliberate repositioning between beam attacks`,
    attackType: `Charged beam: length ${px(SWEEP_ELITE.beamLength)}, halfwidth ${px(SWEEP_ELITE.beamHalfWidth)}, charge ${ms(SWEEP_ELITE.beamChargeMs)} → active ${ms(SWEEP_ELITE.beamActiveMs)}, repeats every ${ms(SWEEP_ELITE.beamPeriodMs)}`,
    tuning: {
      HP: String(SWEEP_ELITE.hp),
      SPEED: pxs(SWEEP_ELITE.speed),
      'BEAM CHARGE / ACTIVE / PERIOD': `${ms(SWEEP_ELITE.beamChargeMs)} / ${ms(SWEEP_ELITE.beamActiveMs)} / ${ms(SWEEP_ELITE.beamPeriodMs)}`,
      'BEAM LENGTH / HALFWIDTH': `${px(SWEEP_ELITE.beamLength)} / ${px(SWEEP_ELITE.beamHalfWidth)}`,
      'HEAT ON HIT': String(SWEEP_ELITE.beamHeatOnHit),
      'TOUCH DAMAGE': String(SWEEP_ELITE.touchDamage),
      POINTS: String(SWEEP_ELITE.points),
    },
    asset: {
      kind: 'procedural-runtime',
      textureKeys: [TEX.sweepElite, TEX.tdElite, TEX.tdEliteEmis],
      sourceFile: 'src/game/art/sweepTextures.ts:429-449 (procedural, all arenas) + td-elite / td-elite-emis (HD, surface-z1 only)',
      atlasImage: 'public/assets/topdown/topdown-z1.webp',
      atlasJson: 'public/assets/topdown/topdown-z1.json',
      originSource: ['art-src/sprites/td-elite.png', 'art-src/sprites/td-elite-emis.png'],
    },
    dims: { nativeW: 28, nativeH: 28, renderedNote: 'procedural native 28×28; HD variant displayed at TD_VISUALS.actorPx.elite = ' + TD_VISUALS.actorPx.elite + 'px on-screen height' },
    origin: 'default (0.5, 0.5)',
    hitbox: { w: 11, h: 11, note: 'shares the uniform SweepEnemy body.setSize(11, 11) despite its larger 28px silhouette (SweepEnemy.ts:56)' },
    perspective: 'top-down — procedural (all arenas) + HD (surface-z1 only)',
    facing: 'none — no flip logic',
    rotation: 'none observed beyond the standard tint-based charge telegraph',
    animation: 'Warning-stripe tint blink during beam charge (shared telegraph pattern with gunner/turret kinds); no sprite-sheet frames.',
    shadow: 'Same shadow pipeline as the standard archetypes (HD: dynamic caster; procedural: TEX.sweepShadow / TEX.sweepShadowLg for larger props).',
    playerOverlap: 'Depth 15 (standard SweepEnemy layer) or y-sorted in the HD rig, same as other archetypes.',
    silhouetteIntent: 'Bigger, more menacing than the standard 8 archetypes — warning stripes + an oversized scanning eye per the procedural draw code; should read immediately as "the dangerous one" in an arena at a glance.',
    implementationStatus: 'Shipped — dual pipeline (procedural + HD), same as the 8 base archetypes.',
    knownIssues: [
      'Same hitbox-vs-silhouette mismatch as the base archetypes, more pronounced here: 28px visible sprite vs. an 11×11 hitbox (~40% of the visible width).',
    ],
    replacement: {
      dims: `Procedural: 28×28px. HD: author at 2× target on-screen height ${TD_VISUALS.actorPx.elite}px, matching td-elite/-emis convention.`,
      padding: '3px for glow/emissive layering.',
      directionalVariants: 'None — top-down, no flip/rotate.',
      effectLayers: 'body + emissive (HD); needs a strong charge-telegraph read distinct from the base archetypes\' telegraph tint, given its higher threat tier.',
    },
    sourceRefs: ['src/game/art/sweepTextures.ts:429-449', 'src/game/config.ts:822-833 (SWEEP_ELITE)', 'src/game/entities/sweep/SweepEnemy.ts'],
  },
  {
    id: 'sweep-maze-heart',
    name: 'THE MAZE HEART',
    internalId: "Zone-4 finale boss — config: SWEEP_BOSS — see sweepArenas.ts `bossFinale` marker (maze-z4 arena)",
    zones: ["Patterson's Orchard (Zone 4) — Fold finale, arena maze-z4"],
    chip: 'SWEEP BOSS — ZONE 4 FOLD FINALE',
    chipCls: 'bad',
    behavior: 'Enhanced Classifier: a large octagonal Engine construct with a longer, wider beam and mid-fight adds (weavers + a diver) spawned at half HP.',
    movement: `speed ${pxs(SWEEP_BOSS.speed)} — slower than the base Classifier, reads as a heavier construct`,
    attackType: `Charged beam: length ${px(SWEEP_BOSS.beamLength)}, halfwidth ${px(SWEEP_BOSS.beamHalfWidth)}, charge ${ms(SWEEP_BOSS.beamChargeMs)} → active ${ms(SWEEP_BOSS.beamActiveMs)}, repeats every ${ms(SWEEP_BOSS.beamPeriodMs)}; spawns adds (${SWEEP_BOSS.addsKinds.join(', ')}) at ${Math.round(SWEEP_BOSS.addsAtHpFrac * 100)}% hp`,
    tuning: {
      HP: String(SWEEP_BOSS.hp),
      SPEED: pxs(SWEEP_BOSS.speed),
      'BEAM CHARGE / ACTIVE / PERIOD': `${ms(SWEEP_BOSS.beamChargeMs)} / ${ms(SWEEP_BOSS.beamActiveMs)} / ${ms(SWEEP_BOSS.beamPeriodMs)}`,
      'BEAM LENGTH / HALFWIDTH': `${px(SWEEP_BOSS.beamLength)} / ${px(SWEEP_BOSS.beamHalfWidth)}`,
      'HEAT ON HIT': String(SWEEP_BOSS.beamHeatOnHit),
      'ADDS AT HP FRACTION': `${Math.round(SWEEP_BOSS.addsAtHpFrac * 100)}% → ${SWEEP_BOSS.addsKinds.join(', ')}`,
      'CLEAR PAYOUT': `${SWEEP_BOSS.clearShards} shards, ${SWEEP_BOSS.lootDrops} loot drops`,
    },
    asset: {
      kind: 'procedural-runtime',
      textureKeys: [TEX.sweepMazeHeart],
      sourceFile: 'src/game/art/sweepTextures.ts:452-479 — no HD variant exists (maze-z4 is not one of TD_VISUALS.arenas, so this boss always renders procedural)',
    },
    dims: { nativeW: 40, nativeH: 40, renderedNote: 'native 40×40, no runtime upscale (procedural-only arena)' },
    origin: 'default (0.5, 0.5)',
    hitbox: { w: 11, h: 11, note: 'shares the uniform SweepEnemy body.setSize(11, 11) — the most extreme silhouette/hitbox mismatch in the roster: 40px visible sprite vs. an 11×11 hitbox (~27% of the visible width)' },
    perspective: 'top-down — procedural only (no HD art pipeline reaches this arena)',
    facing: 'none',
    rotation: 'none observed beyond charge-telegraph tint blink',
    animation: 'Warning-stripe tint blink during beam charge; octagonal hull + glyph ring + pulsing core eye are all static-geometry (no animated frames) per the procedural draw code.',
    shadow: 'Procedural TEX.sweepShadowLg (36×18, the larger prop shadow variant) is available for large actors like this one; wiring is scene-level.',
    playerOverlap: 'Depth 15 (standard SweepEnemy layer).',
    silhouetteIntent: 'The Zone 4 Fold finale boss — an "Engine construct" with a crop-circle glyph ring motif tying it to Patterson\'s Orchard\'s crop-circle theme; should read as the largest, most heavily-armored threat in any Sweep arena.',
    implementationStatus: 'Shipped — procedural only; this is the one boss-tier Sweep entity with no HD art pass planned (maze-z4 is outside TD_VISUALS.arenas scope).',
    knownIssues: [
      'Largest silhouette-vs-hitbox mismatch in the roster (40px sprite, 11×11 hitbox) — most likely to visually read as "should have hit that" misses.',
      'No HD variant, unlike the base 8 archetypes and the Classifier elite — if the HD pass ever extends beyond surface-z1, this is the next candidate and currently has zero asset started.',
    ],
    replacement: {
      dims: '40×40px minimum to preserve its "biggest threat" read; consider a larger canvas (e.g. 48–56px) given how undersized the current hitbox already makes it feel.',
      padding: '3–4px for the glyph-ring glow and core-eye bloom layers.',
      directionalVariants: 'None — top-down, no flip/rotate beyond the charge-telegraph tint.',
      effectLayers: 'Octagonal hull base + separate glyph-ring layer (could pulse independently) + core-eye layer (currently 3-layer color stack: dangerDark → danger → cropGlow → white highlight) — worth preserving as distinct paintable layers.',
    },
    sourceRefs: ['src/game/art/sweepTextures.ts:452-479', 'src/game/config.ts:840-853 (SWEEP_BOSS)', 'src/game/entities/sweep/SweepEnemy.ts'],
  },
];

export const BESTIARY_ALL_ENEMIES: BestiaryEnemyEntry[] = [
  ...BESTIARY_ENEMIES,
  ...BESTIARY_SWEEP_ENEMIES,
  ...BESTIARY_SWEEP_BOSSES,
];

/* ============================== FIXED HAZARDS ============================ */

export const BESTIARY_HAZARDS: BestiaryHazardEntry[] = [
  {
    id: 'scanner-rig',
    name: 'SCANNER RIG',
    zones: ['Miller Field (Zone 1)'],
    chip: 'FIXED HAZARD',
    desc: 'Abandoned government scan equipment on a tripod. Deals no damage — its cone feeds the classification meter, and drones believe whatever it decides you are.',
    tuning: {
      CONE: `${px(SCANRIG.coneLength)} · ±${deg(SCANRIG.coneHalfAngleDeg)}`,
      SWEEP: `±${deg(SCANRIG.sweepDeg / 2)} over ${ms(SCANRIG.sweepPeriodMs)}`,
      DAMAGE: 'none — classification only',
    },
    asset: { kind: 'procedural-runtime', textureKeys: [TEX.scannerRig], sourceFile: 'src/game/systems/ProceduralArt.ts:313-327' },
    dims: { nativeW: 22, nativeH: 22, renderedNote: 'native 22×22, no runtime scale' },
    behavior: 'Fixed position, sweeps its cone in a sine arc around a base aim angle set per-placement; no physics body (static Image), depth 12.',
    knownIssues: ['Tripod silhouette is small (22×22) relative to its cone (128px) — the emitter itself can be easy to miss while the cone dominates the read, which is probably fine but worth confirming during an art pass.'],
    sourceRefs: ['src/game/entities/ScannerRig.ts', 'src/game/systems/ProceduralArt.ts:313-327', 'src/game/config.ts:417-422'],
  },
  {
    id: 'blipstream-hazards',
    name: 'BLIPSTREAM NODE HAZARDS',
    zones: ['Blipstream Node rooms (all zones)'],
    chip: 'NODE ROOMS',
    desc: 'Red static bars sit on waveform platforms; a sweeping scan line patrols the corridor. Falling out of the waveform costs 1 hp and resets to the room entry.',
    tuning: {
      'STATIC BAR': '1 dmg + knockback',
      'SCAN LINE SWEEP': `per-room NODE_A.meta.scanLine.periodMs (default 3400ms if unset)`,
      'VOID FALL': '1 dmg + respawn at room entry',
    },
    asset: { kind: 'procedural-runtime', textureKeys: ['TEX.hazardBar', 'TEX.scanLine'], sourceFile: 'src/game/systems/ProceduralArt.ts (Blipstream hazard textures) — see BLIP_ROOM config for room-level timing' },
    dims: { nativeW: 0, nativeH: 0, renderedNote: 'varies per room — bars/scan-line are stretched to room-specific spans, not a fixed sprite size' },
    behavior: 'Static bars are placed hazards (no motion); the scan line sweeps the corridor on a period; void is a fall-through trigger zone, not a rendered sprite.',
    knownIssues: [],
    sourceRefs: ['src/game/data/levels.ts (NODE_A)', 'src/game/config.ts:381-392 (BLIP_ROOM)'],
  },
  {
    id: 'motel-security-lamps',
    name: 'SECURITY LAMPS',
    zones: ['Motel Nowhere (Zone 2)'],
    chip: 'FIXED HAZARD',
    desc: 'Wide, near-static lit pools along the walkway — barely drift, so lingering (not just crossing) is what triggers THREAT.',
    tuning: {
      CONE: `${px(MOTEL.securityConeLength)} · ±${deg(MOTEL.securityConeHalfAngleDeg)}`,
      SWEEP: `±${deg(MOTEL.securitySweepDeg / 2)} over ${ms(MOTEL.securitySweepPeriodMs)}`,
      'NEON FLICKER (powered platforms)': ms(MOTEL.neonFlickerMs),
    },
    asset: { kind: 'procedural-runtime', textureKeys: ['shared DetectionCone TEX.cone + a lamp fixture texture'], sourceFile: 'src/game/entities/DetectionCone.ts, ProceduralArt.ts (Zone 2 fixture textures)' },
    dims: { nativeW: 0, nativeH: 0, renderedNote: 'lamp fixture dims not confirmed in this pass — verify against ProceduralArt.ts Zone 2 section before an art brief ships' },
    behavior: 'Fixed position, near-static wide cone with a very small sweep drift; reused DetectionCone primitive shared with drones/rigs/spotters.',
    knownIssues: ['Dimensions not verified in this data pass (flagged rather than guessed) — confirm the exact fixture texture key/size in ProceduralArt.ts before generating a replacement-art brief for this entry.'],
    sourceRefs: ['src/game/config.ts:622-628 (MOTEL)', 'src/game/entities/DetectionCone.ts'],
  },
  {
    id: 'stadium-light-towers',
    name: 'STADIUM LIGHT TOWERS',
    zones: ['Chagrin Falls High / Tiger Stadium (Zone 3)'],
    chip: 'FIXED HAZARD — THREAT LADDER',
    desc: 'Rotating light-tower cones that "burn" on prolonged exposure rather than instantly classifying — a brief graze is free, standing in one cooks the classification meter fast. Escalates through the stadium threat ladder (see CLASSIFICATION SYSTEMS).',
    tuning: {
      'LIGHT CONE': `${px(STADIUM.lightConeLength)} · ±${deg(STADIUM.lightConeHalfAngleDeg)}`,
      'FLOOD CONE (stage 3)': px(STADIUM.floodConeLength),
      SWEEP: `${deg(STADIUM.lightSweepDeg)} over ${ms(STADIUM.lightSweepPeriodMs)}`,
      'POLE HEIGHT': px(STADIUM.poleHeight),
      'BURN GRACE': `${ms(STADIUM.burnGraceMs)} free, then ramps ×${STADIUM.burnRampPerSec}/s to a cap of ×${STADIUM.burnRampMax}`,
      'SAFE-ZONE (ANCHOR) DECLASSIFY': `${STADIUM.safeZoneDeclassifyPerSec}/s, heal tick every ${ms(STADIUM.safeZoneHealEveryMs)}`,
    },
    asset: { kind: 'procedural-runtime', textureKeys: ['shared DetectionCone TEX.cone + a light-tower/pole fixture texture'], sourceFile: 'src/game/entities/DetectionCone.ts, ProceduralArt.ts (Zone 3 stadium fixtures)' },
    dims: { nativeW: 0, nativeH: 0, renderedNote: `pole height ${STADIUM.poleHeight}px per config; exact fixture sprite dims not confirmed in this pass` },
    behavior: 'Fixed towers, cones sweep continuously; feeds the same classification value as drones but with the "burn" grace/ramp curve layered on top (STADIUM config), and drives the Spotter escalation at stage 2.',
    knownIssues: ['Fixture sprite dimensions not verified in this pass — confirm exact ProceduralArt.ts Zone 3 texture key/size before an art brief ships.'],
    sourceRefs: ['src/game/config.ts:633-684 (STADIUM)', 'src/game/entities/DetectionCone.ts'],
  },
  {
    id: 'skyline-lightning',
    name: 'LIGHTNING STRIKES',
    zones: ['Skyline Array (Zone 5, finale)'],
    chip: 'ENVIRONMENTAL HAZARD',
    desc: 'Telegraphed lightning strikes on a readable barrage clock. Dash-through-able: the active damaging window (260ms) is shorter than the player dash (~210ms), so a well-timed dash clears it.',
    tuning: {
      'WARN / ACTIVE / COOLDOWN / IDLE': `${ms(LIGHTNING.warnMs)} / ${ms(LIGHTNING.activeMs)} / ${ms(LIGHTNING.cooldownMs)} / ${ms(LIGHTNING.idleMs)}`,
      'FULL CYCLE': ms(LIGHTNING.cycleMs),
      'PER-STRIKE OFFSET': ms(LIGHTNING.phaseStepMs),
      'HIT HALFWIDTH': px(LIGHTNING.hitHalfW),
      DAMAGE: String(LIGHTNING.damage),
    },
    asset: { kind: 'procedural-runtime', textureKeys: ['a lightning-bolt VFX texture (Zone 5 section of ProceduralArt.ts)'], sourceFile: 'src/game/systems/ProceduralArt.ts (Zone 5 section)' },
    dims: { nativeW: 0, nativeH: 0, renderedNote: 'VFX-scale, spans the strike zone rather than a fixed small sprite' },
    behavior: 'Cyclical telegraph → active → cooldown → idle state machine per strike point, offset per-strike to build a readable barrage pattern.',
    knownIssues: [],
    sourceRefs: ['src/game/config.ts:713-722 (LIGHTNING)'],
  },
  {
    id: 'skyline-dashgate',
    name: 'DASH GATES',
    zones: ['Skyline Array (Zone 5, finale)'],
    chip: 'ENVIRONMENTAL HAZARD',
    desc: 'Gate hazards along the summit climb — pass through cleanly with the right timing/ability or take contact damage.',
    tuning: { DAMAGE: String(DASHGATE.damage), 'HALF-EXTENTS': `${px(DASHGATE.halfW)} × ${px(DASHGATE.halfH)}` },
    asset: { kind: 'procedural-runtime', textureKeys: ['a gate/barrier VFX texture (Zone 5 section of ProceduralArt.ts)'], sourceFile: 'src/game/systems/ProceduralArt.ts (Zone 5 section)' },
    dims: { nativeW: DASHGATE.halfW * 2, nativeH: DASHGATE.halfH * 2, renderedNote: 'hitbox-derived footprint; exact visual texture size not confirmed in this pass' },
    behavior: 'Static placed hazard along the Skyline Array climb route.',
    knownIssues: ['Visual texture dims not verified in this pass — only the hitbox half-extents are config-confirmed.'],
    sourceRefs: ['src/game/config.ts:724 (DASHGATE)'],
  },
];

/* ============================== GAMEPLAY SYSTEMS ========================= */

export const BESTIARY_SYSTEMS: BestiarySystemEntry[] = [
  {
    id: 'classification',
    name: 'CLASSIFICATION',
    desc: 'The real enemy. Standing in any detection cone fills the meter; the label changes what the world does to you. UNKNOWN → nothing. ANOMALY → drones get nervous. THREAT → all drones aggro and fire faster until the label decays. Implemented in ClassificationSystem.ts.',
    tuning: {
      'FILL RATE (in cone)': `${CLASSIFY.fillPerSec}/s`,
      'DECAY RATE (outside)': `${CLASSIFY.decayPerSec}/s`,
      'ANOMALY THRESHOLD': `≥ ${CLASSIFY.anomalyAt}`,
      'THREAT THRESHOLD': `≥ ${CLASSIFY.threatAt}`,
      MAX: String(CLASSIFY.max),
    },
    usedBy: ['Scanner Drone aggro/fire-rate gating', 'Scanner Rig', 'all zone bosses (indirectly, via drone summons)'],
    sourceRefs: ['src/game/systems/ClassificationSystem.ts', 'src/game/config.ts:425-431 (CLASSIFY)'],
  },
  {
    id: 'sweep-heat',
    name: 'SWEEP HEAT (Classification, reused)',
    desc: 'The top-down Sweep combat mode reuses the Classification concept as "heat" — the radar locks onto you the longer you\'re exposed to fire, ramping enemy aggression.',
    tuning: {
      'HEAT ON HIT': String(SWEEP.heatFillOnHit),
      'HEAT DECAY': `${SWEEP.heatDecayPerSec}/s`,
      'AGGRO RAMP THRESHOLDS': SWEEP.heatRampAt.join(' / '),
    },
    usedBy: ['All Sweep archetypes (drive the `aggro` multiplier passed into SweepEnemy.drive())'],
    sourceRefs: ['src/game/config.ts:756-819 (SWEEP)', 'src/game/entities/sweep/SweepEnemy.ts'],
  },
  {
    id: 'stadium-threat-ladder',
    name: 'STADIUM THREAT LADDER (Classification, reskinned)',
    desc: 'Chagrin Falls High\'s zone-specific reskin of Classification: a 3-stage escalation (SPOTTED → TRACKED → KNOWN) with hysteresis, cover-breaking, and a dedicated Spotter drone launched at stage 2.',
    tuning: {
      'LOCK-ON / RELEASE': `${STADIUM.lockOnAt} / ${STADIUM.lockReleaseAt}`,
      'SPOTTER LAUNCH / RELEASE': `${STADIUM.spotterAt} / ${STADIUM.spotterReleaseAt}`,
      'FLOOD WINDOW / COOLDOWN (stage 3)': `${ms(STADIUM.floodWindowMs)} / ${ms(STADIUM.floodCooldownMs)}`,
      'CAUGHT STUN': ms(STADIUM.caughtStunMs),
    },
    usedBy: ['Stadium light towers', 'Spotter'],
    sourceRefs: ['src/game/config.ts:633-684 (STADIUM)', 'src/game/entities/Spotter.ts'],
  },
];

/* ============================ scale reference ============================ */
export const CONTACT47_SCALE_REF = {
  hitboxW: PLAYER.width,
  hitboxH: PLAYER.height,
  note: `Contact-47's Arcade physics hitbox is ${PLAYER.width}×${PLAYER.height}px (config.ts:329-355). The rendered player sprite reads roughly the size of a side-view tile (16px) — use this as the scale anchor for any enemy replacement art in the side-view world.`,
};
