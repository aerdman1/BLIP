/**
 * Top-down bestiary data for the Command Center.
 * Numeric values point at live config constants so this page follows tuning.
 */
import { SWEEP, SWEEP_ELITE, SWEEP_ENEMIES, TEX, TD_VISUALS } from '../config';

export type BestiaryAssetKind = 'procedural-runtime' | 'hd-atlas' | 'composited-runtime';

export interface BestiaryAssetRef {
  kind: BestiaryAssetKind;
  textureKeys: string[];
  sourceFile: string;
  atlasImage?: string;
  atlasJson?: string;
  originSource?: string[];
}

export interface BestiaryDims {
  nativeW: number;
  nativeH: number;
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

export type CustomArtStatus = 'shipped' | 'integrated-unplaced' | 'needs-art';

export interface CustomArtInfo {
  status: CustomArtStatus;
  roadmapOrder?: number;
  note: string;
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
  customArt?: CustomArtInfo;
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
  customArt?: CustomArtInfo;
}

export interface BestiarySystemEntry {
  id: string;
  name: string;
  desc: string;
  tuning: Record<string, string>;
  usedBy: string[];
  sourceRefs: string[];
}

export interface BestiaryRoadmapPhase {
  order: number;
  title: string;
  targetIds: string[];
  status: 'done' | 'next' | 'planned' | 'blocked';
  note: string;
}

const px = (n: number) => `${n}px`;
const ms = (n: number) => `${n}ms`;
const actorRender = (size: number) => `${size}px target, scaled by TD_VISUALS.artScale (${TD_VISUALS.artScale})`;

const sharedReplacement: BestiaryReplacementSpec = {
  dims: 'Keep the silhouette readable at 26-50px on screen.',
  padding: 'Leave transparent padding for glow/emissive layers.',
  directionalVariants: 'Top-down rotation handles aim; add variants only when silhouette clarity requires it.',
  effectLayers: 'Body plus optional emissive frame for signal eyes, cores, and beam tells.',
};

const enemy = (
  id: string,
  name: string,
  tex: string[],
  behavior: string,
  movement: string,
  tuning: Record<string, string>,
  chip = 'TOP-DOWN'
): BestiaryEnemyEntry => ({
  id,
  name,
  internalId: `SweepEnemy:${id}`,
  zones: ['Miller Surface', 'Motel Circuit', 'Chagrin Falls Town', "Patterson's Orchard", 'Signal Storm'],
  chip,
  chipCls: 'ok',
  behavior,
  movement,
  attackType: 'Pulse bolts, contact pressure, or telegraphed beam depending on type.',
  tuning,
  asset: { kind: 'hd-atlas', textureKeys: tex, sourceFile: 'src/game/art/sweepTextures.ts and public/assets/topdown atlases' },
  dims: { nativeW: 30, nativeH: 30, renderedNote: actorRender(TD_VISUALS.actorPx.drone) },
  origin: '0.5, 0.5',
  hitbox: { w: 11, h: 11, note: 'Default SweepEnemy Arcade body; special variants resize in SweepScene.' },
  perspective: 'top-down with readable height cue and soft ground shadow',
  facing: 'rotates or aims toward movement/target vector',
  rotation: 'runtime-driven by movement or beam aim',
  animation: 'procedural bob, hit flash, emissive pulse, and y-sorted shadow',
  shadow: 'soft detached ground shadow via top-down actor renderer',
  playerOverlap: 'Y-sorted actor depth keeps close encounters readable.',
  silhouetteIntent: 'Readable signal-machine silhouette at combat distance.',
  implementationStatus: 'shipped',
  knownIssues: [],
  replacement: sharedReplacement,
  sourceRefs: ['src/game/entities/sweep/SweepEnemy.ts', 'src/game/scenes/SweepScene.ts', 'src/game/config.ts'],
  customArt: { status: 'shipped', note: 'Live top-down actor art or procedural fallback exists.' },
});

export const BESTIARY_ENEMIES: BestiaryEnemyEntry[] = [
  enemy('drifter', 'DRIFTER', [TEX.tdDrifter, TEX.tdDrifterEmis, TEX.sweepDrifter], 'Basic chaser that pressures the player off the node.', 'Direct pursuit with small separation jitter.', {
    HP: String(SWEEP_ENEMIES.drifter.hp),
    SPEED: px(SWEEP_ENEMIES.drifter.speed),
    POINTS: String(SWEEP_ENEMIES.drifter.points),
  }),
  enemy('tagger', 'TAGGER', [TEX.tdTagger, TEX.tdTaggerEmis, TEX.sweepTagger], 'Keeps pressure by firing label bolts while circling.', 'Keeps range and drifts laterally.', {
    HP: String(SWEEP_ENEMIES.tagger.hp),
    SPEED: px(SWEEP_ENEMIES.tagger.speed),
    FIRE: ms(SWEEP_ENEMIES.tagger.fireMs),
  }),
  enemy('diver', 'DIVER', [TEX.tdDiver, TEX.tdDiverEmis, TEX.sweepDiver], 'Telegraphs, then dives hard through the player lane.', 'Lock, wind up, lunge, recover.', {
    HP: String(SWEEP_ENEMIES.diver.hp),
    SPEED: px(SWEEP_ENEMIES.diver.speed),
    DIVE: px(SWEEP_ENEMIES.diver.diveSpeed),
  }),
  enemy('warden', 'WARDEN', [TEX.tdWarden, TEX.tdWardenEmis, TEX.sweepWarden], 'Shielded blocker that makes node approaches less direct.', 'Slow guard movement with frontal pressure.', {
    HP: String(SWEEP_ENEMIES.warden.hp),
    SPEED: px(SWEEP_ENEMIES.warden.speed),
    SHIELDED: String(SWEEP_ENEMIES.warden.shielded),
  }),
  enemy('sniper', 'PINPOINT', [TEX.tdSniper, TEX.tdSniperEmis, TEX.sweepSniper], 'Long-lens drone with a sharp line shot.', 'Holds distance and tracks lanes.', {
    HP: String(SWEEP_ENEMIES.sniper.hp),
    RANGE: px(SWEEP_ENEMIES.sniper.lockRange),
    FIRE: ms(SWEEP_ENEMIES.sniper.fireMs),
  }),
  enemy('splitter', 'REPLICATOR', [TEX.tdSplitter, TEX.tdSplitterEmis, TEX.sweepSplitter], 'Breaks into smaller threats and punishes careless overdrive timing.', 'Cluster movement with split-on-death behavior.', {
    HP: String(SWEEP_ENEMIES.splitter.hp),
    SPEED: px(SWEEP_ENEMIES.splitter.speed),
    SPLIT: String(SWEEP_ENEMIES.splitter.splitInto),
  }),
  enemy('weaver', 'JITTER', [TEX.tdWeaver, TEX.tdWeaverEmis, TEX.sweepWeaver], 'Fast zig-zag interceptor for late-route pressure.', 'Weaving pursuit with high lateral variance.', {
    HP: String(SWEEP_ENEMIES.weaver.hp),
    SPEED: px(SWEEP_ENEMIES.weaver.speed),
    WEAVE: String(SWEEP_ENEMIES.weaver.weave),
  }),
  enemy('turret', 'PYLON', [TEX.tdTurret, TEX.tdTurretEmis, TEX.sweepTurret], 'Rooted radial emitter that turns rooms into positional puzzles.', 'Stationary.', {
    HP: String(SWEEP_ENEMIES.turret.hp),
    BURST: String(SWEEP_ENEMIES.turret.burst),
    FIRE: ms(SWEEP_ENEMIES.turret.fireMs),
  }),
  {
    ...enemy('classifier', 'THE CLASSIFIER', [TEX.tdElite, TEX.tdEliteEmis, TEX.sweepElite], 'Elite node guard with amber wind-up and red scan beam.', 'Slow boss-like pressure near the objective node.', {
      HP: String(SWEEP_ELITE.hp),
      SPEED: px(SWEEP_ELITE.speed),
      'BEAM WINDUP': ms(SWEEP_ELITE.beamChargeMs),
      'BEAM ACTIVE': ms(SWEEP_ELITE.beamActiveMs),
    }, 'ELITE'),
    dims: { nativeW: 54, nativeH: 54, renderedNote: actorRender(TD_VISUALS.actorPx.elite) },
    hitbox: { w: 24, h: 24, note: 'Large top-down elite collision set in SweepScene.' },
  },
];

export const BESTIARY_HAZARDS: BestiaryHazardEntry[] = [
  {
    id: 'classifier-beam',
    name: 'CLASSIFIER BEAM',
    zones: ['all charged-node arenas'],
    chip: 'SCAN HAZARD',
    desc: 'Amber telegraph followed by a red beam that spikes pressure and forces a dash or sidestep.',
    tuning: { WINDUP: ms(SWEEP_ELITE.beamChargeMs), ACTIVE: ms(SWEEP_ELITE.beamActiveMs), HEAT: String(SWEEP_ELITE.beamHeatOnHit) },
    asset: { kind: 'procedural-runtime', textureKeys: [TEX.tdLight, TEX.tdRing], sourceFile: 'src/game/scenes/SweepScene.ts' },
    dims: { nativeW: 1, nativeH: 1, renderedNote: 'Runtime line and glow scaled to arena distance.' },
    behavior: 'Locks direction, telegraphs, then fires.',
    knownIssues: [],
    sourceRefs: ['src/game/scenes/SweepScene.ts', 'src/game/config.ts'],
    customArt: { status: 'shipped', note: 'Runtime beam with clear telegraph is live.' },
  },
  {
    id: 'signal-swarm',
    name: 'SIGNAL SWARM',
    zones: ['all connected areas'],
    chip: 'ARENA PRESSURE',
    desc: 'Enemy budget rises until the node is charged or the route is cleared.',
    tuning: { CHARGE: String(SWEEP.nodeChargeDefault), NODE_RADIUS: px(SWEEP.nodeChargeRadius), CACHE_COUNT: String(SWEEP.cacheCount) },
    asset: { kind: 'procedural-runtime', textureKeys: [TEX.sweepShotE, TEX.sweepBoltGlow], sourceFile: 'src/game/scenes/SweepScene.ts' },
    dims: { nativeW: 16, nativeH: 16, renderedNote: 'Runtime bullets, pickups, flashes and rings.' },
    behavior: 'Keeps the player moving and rewards control of the node center.',
    knownIssues: [],
    sourceRefs: ['src/game/scenes/SweepScene.ts', 'src/game/config.ts'],
    customArt: { status: 'shipped', note: 'Top-down pressure loop is live.' },
  },
];

export const BESTIARY_SYSTEMS: BestiarySystemEntry[] = [
  {
    id: 'node-charge',
    name: 'SIGNAL NODE CHARGE',
    desc: 'Kills charge the central node; kills near the node count more. Charged nodes open the next route.',
    tuning: { RADIUS: px(SWEEP.nodeChargeRadius), REQUIRED: String(SWEEP.nodeChargeDefault) },
    usedBy: ['All connected areas'],
    sourceRefs: ['src/game/scenes/SweepScene.ts', 'src/game/data/sweepArenas.ts'],
  },
  {
    id: 'overdrive',
    name: 'SIGNAL OVERDRIVE',
    desc: 'Kill-charged ultimate that clears nearby threats and grants a short rapid-fire window.',
    tuning: { DURATION: ms(SWEEP.overdriveDurationMs), RADIUS: px(SWEEP.overdriveShockRadius), DAMAGE: String(SWEEP.overdriveShockDmg) },
    usedBy: ['CONTACT-47'],
    sourceRefs: ['src/game/scenes/SweepScene.ts', 'src/game/config.ts'],
  },
];

export const BESTIARY_ASSET_ROADMAP: BestiaryRoadmapPhase[] = [
  { order: 1, title: 'Top-down actor set', targetIds: ['drifter', 'tagger', 'diver', 'warden', 'sniper', 'splitter', 'weaver', 'turret', 'classifier'], status: 'done', note: 'Shared top-down actors and fallbacks are live.' },
  { order: 2, title: 'Route hazards', targetIds: ['classifier-beam', 'signal-swarm'], status: 'done', note: 'Runtime telegraphs and pressure systems are live.' },
];

export const BESTIARY_ALL_ENEMIES = BESTIARY_ENEMIES;

export const CONTACT47_SCALE_REF = {
  note: `CONTACT-47 renders around ${TD_VISUALS.actorPx.player}px in top-down play; enemy silhouettes should remain readable at ${TD_VISUALS.actorPx.drone}px and elite silhouettes at ${TD_VISUALS.actorPx.elite}px.`,
};
