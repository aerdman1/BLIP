/**
 * TdBiomes — what makes one HD top-down arena look different from another.
 *
 * TdTerrain builds the SAME structure for every arena: layered ground, masked
 * corridor wear, extruded walls, contact AO, y-sorted props, a canopy frame.
 * None of that is zone-specific. What IS zone-specific is the vocabulary —
 * which tiles, which props, which landmarks, which accent hues, and whether the
 * walls are eroded rock or built structure.
 *
 * All of that lives here, one record per `SweepBiome`, so adding a zone's HD
 * look is authoring a descriptor + generating its art, never editing TdTerrain.
 *
 * WHY THIS REPLACED THE ALLOWLIST: the old gate was `TD_VISUALS.arenas`, a
 * hardcoded ['surface-z1'] that had to agree with a separate `tdArt.hd` check.
 * Two sources of truth for one question. Now an arena gets the HD treatment iff
 * its biome has a descriptor AND that descriptor's atlas actually loaded —
 * one condition, resolved in one place (`tdBiomeFor`).
 */
import { TEX } from '../config';
import { TD_PALETTE as C } from '../config';
import { SWEEP_ARENAS, type SweepBiome } from '../data/sweepArenas';

/**
 * How a biome's walls are shaped.
 *
 *  'rock'     — three jittered lobes per solid cell; the union across neighbours
 *               reads as an eroded bank. Right for Miller Field's hedgerows and
 *               outcrops, where nothing should look surveyed.
 *  'hardEdge' — near-rectangular with chipped corners and edge wear. Right for
 *               anywhere the walls are BUILT (motel breezeblock, stucco, fence).
 *               Applying 'rock' to a motel dissolves architecture into geology.
 */
export type TdWallStyle = 'rock' | 'hardEdge';

export interface TdBiomeDef {
  id: SweepBiome;
  /** atlas basename under public/assets/topdown/ (no extension) */
  atlas: string;
  /** individual tile files — tileSprite needs real texture wrap, so never atlased */
  tiles: {
    ground: string;
    groundLit: string;
    groundDark: string;
    path: string;
    wallTop: string;
    wallFace: string;
  };
  /** procedural fallback tiles, used when the atlas is absent */
  fallback: {
    ground: string;
    groundLit: string;
    groundDark: string;
    path: string;
    wallTop: string;
    wallFace: string;
  };
  wallStyle: TdWallStyle;
  /** cover scattered along straight room/hall boundaries to bury them */
  skirt: readonly string[];
  /** general prop scatter, edge-biased and marker-clearing */
  scatter: readonly string[];
  /** props banked at the foot of each exposed wall base */
  bank: readonly string[];
  /** out-of-focus foreground frame; null ⇒ this biome has no overhead cover */
  canopy: string | null;
  /** navigation anchors: [body, emissive|null, scale] */
  landmarks: ReadonlyArray<readonly [string, string | null, number]>;
  /** which landmark key renders flat on the ground rather than upright */
  flatLandmark: string | null;
  accents: {
    warm: number;
    coolA: number;
    coolB: number;
    /** share of accent lights that are warm rather than cool */
    warmChance: number;
    /** how many accent lights to scatter — a lit parking lot is not a dark wood */
    count: number;
  };
  tints: {
    skirt: number;
    propNear: number;
    propFar: number;
    wallFace: number;
    cloudLit: number;
    cloudDark: number;
    canopy: number;
  };
  /**
   * Optional per-biome overrides of the global TD_VISUALS lighting curve.
   *
   * Those globals were measured against Miller Field's night-graded forest
   * albedos. A biome lit by its own practical light sources needs a different
   * curve — inheriting the forest's darkness buries it. Omitted ⇒ use globals.
   */
  light?: {
    darkness?: number;
    darknessLow?: number;
    ambientFloor?: number;
    vignette?: number;
  };
}

/* --------------------------------------------------------------------------
 * MILLER — night rural forest. The zone-1 look, transcribed verbatim from the
 * constants that were previously inline in TdTerrain. Do not "clean up" these
 * numbers: they are the output of three tuning passes (seams, blowout, palette,
 * depth) and this record existing must not change a single pixel of surface-z1.
 * -------------------------------------------------------------------------- */
const MILLER: TdBiomeDef = {
  id: 'miller',
  atlas: 'topdown-z1',
  tiles: {
    ground: TEX.tdGround,
    groundLit: TEX.tdGroundLit,
    groundDark: TEX.tdGroundDark,
    path: TEX.tdPath,
    wallTop: TEX.tdWallTop,
    wallFace: TEX.tdWallFace,
  },
  fallback: {
    ground: TEX.sweepGrass,
    groundLit: TEX.sweepGrass2,
    groundDark: TEX.sweepGrassDk,
    path: TEX.sweepPath,
    wallTop: TEX.sweepHedge,
    wallFace: TEX.sweepHedge,
  },
  wallStyle: 'rock',
  skirt: [TEX.tdTuft, TEX.tdFern, TEX.tdBush, TEX.tdRock],
  scatter: [TEX.tdRock, TEX.tdLog, TEX.tdBush, TEX.tdDebris, TEX.tdScrap, TEX.tdFern],
  bank: [TEX.tdRock, TEX.tdBush],
  canopy: TEX.tdCanopy,
  landmarks: [
    [TEX.tdLmPod, TEX.tdLmPodEmis, 0.34],
    [TEX.tdLmRelay, TEX.tdLmRelayEmis, 0.38],
    [TEX.tdLmRoots, null, 0.34],
    [TEX.tdLmPool, TEX.tdLmPoolEmis, 0.36],
  ],
  flatLandmark: TEX.tdLmPool,
  accents: {
    warm: C.emberWarm,
    coolA: C.bioTeal,
    coolB: C.bioBlue,
    warmChance: 0.3,
    count: 14,
  },
  tints: {
    skirt: 0xc4d6d4,
    propNear: 0xffffff,
    propFar: 0xcfe0dc,
    wallFace: 0x8a9098,
    cloudLit: 0x9fd8a8,
    cloudDark: 0x38505c,
    canopy: C.foliageNear,
  },
};

/* --------------------------------------------------------------------------
 * MOTEL — the zone-2 lot, "Inside the Circuit".
 *
 * Deliberately NOT a recolour of Miller Field. Three things invert:
 *   * WALLS ARE BUILT ('hardEdge'). Running zone 1's erosion over a motel
 *     dissolves architecture into geology.
 *   * NO CANOPY. An open lot has nothing overhead; faking a frame here would
 *     read as trees that aren't there.
 *   * LIGHT IS WARM AND PLENTIFUL. Miller Field is scarce cool bioluminescence
 *     in a dark wood (14 accents, 30% warm). A lot under sodium lamps is the
 *     opposite: more pools, mostly warm. Cool is the neon sign's job.
 * -------------------------------------------------------------------------- */
const MOTEL: TdBiomeDef = {
  id: 'motel',
  atlas: 'topdown-z2',
  tiles: {
    ground: 'td-z2-ground',
    groundLit: 'td-z2-ground-lit',
    groundDark: 'td-z2-ground-dark',
    path: 'td-z2-path',
    wallTop: 'td-z2-wall-top',
    wallFace: 'td-z2-wall-face',
  },
  fallback: {
    ground: TEX.sweepGrass,
    groundLit: TEX.sweepGrass2,
    groundDark: TEX.sweepGrassDk,
    path: TEX.sweepPath,
    wallTop: TEX.sweepHedge,
    wallFace: TEX.sweepHedge,
  },
  wallStyle: 'hardEdge',
  // SKIRT IS GROUND COVER, not objects. dressEdges lays 2-4 of these on every
  // edge tile to bury the straight room boundaries, so anything with a strong
  // recognisable silhouette (a traffic cone) turns the lot into a cone farm.
  // Skirt buries straight boundaries. Rubble/scrap (hard debris) do that job;
  // weed appears ONCE here so crack-growth stays sparse and never reads as lawn.
  skirt: ['td-z2-rubble', 'td-z2-scrap', 'td-z2-rubble', 'td-z2-weed'],
  scatter: ['td-z2-rubble', 'td-z2-tire', 'td-z2-crate', 'td-z2-cone', 'td-z2-weed', 'td-z2-planter'],
  bank: ['td-z2-rubble', 'td-z2-crate'],
  canopy: null,
  landmarks: [
    ['td-z2-lm-vending', 'td-z2-lm-vending-emis', 0.34],
    // index 1 is the biome's warm/powered anchor — see TdTerrain.placeLandmarks
    ['td-z2-lm-lamp', 'td-z2-lm-lamp-emis', 0.40],
    ['td-z2-lm-car', null, 0.30],
    ['td-z2-lm-sign', 'td-z2-lm-sign-emis', 0.38],
  ],
  flatLandmark: null, // nothing here lies flat on the ground the way a pool does
  accents: {
    warm: 0xffb14a, // sodium vapour
    coolA: 0xff4d9e, // neon pink
    coolB: 0x35e0d0, // neon cyan
    warmChance: 0.66,
    count: 20,
  },
  tints: {
    skirt: 0x9fb0c4,
    propNear: 0xffffff,
    propFar: 0xa8b6c8,
    // The panel face is already dark steel in the albedo; tinting it down
    // again crushes the louvre detail that makes it read as equipment.
    wallFace: 0xdfe6f0,
    cloudLit: 0x8fe4f0, // spill on wet blacktop reads cyan, not warm
    // NOTE: cloudDark is a NORMAL-blend tint at 0.55 alpha, not a multiply —
    // its own luminance sets the scene's floor. Seeding it with the literal
    // asphaltPuddle value (0x241d33, luma ~38) halved the whole arena before
    // any lighting ran. It has to sit near zone 1's 0x38505c to behave.
    cloudDark: 0x4a4266, // violet-shifted, but at a usable luminance
    canopy: 0xffffff, // unused (canopy: null)
  },
  // Wet blacktop is a very dark albedo (0x1a1620) AND the neon spill is baked
  // into the tiles as reflection. Stacking Miller Field's darkness curve on
  // top of that rendered the arena near-black, so this biome carries far less
  // multiply and a much higher ambient floor — the light here is already in
  // the ground, and the runtime layer only needs to shape it.
  light: {
    darkness: 0.1,
    darknessLow: 0.06,
    ambientFloor: 0.85,
    vignette: 0.34,
  },
};

/**
 * Registry. A biome absent from here simply never gets the HD treatment and
 * renders with the existing procedural pixel art — which is the correct,
 * non-crashing behaviour for any zone whose art has not been generated yet.
 */
export const TD_BIOMES: Partial<Record<SweepBiome, TdBiomeDef>> = {
  miller: MILLER,
  motel: MOTEL,
};

/** The HD descriptor for an arena, or null if that arena stays procedural. */
export function tdBiomeFor(arenaId: string): TdBiomeDef | null {
  const arena = SWEEP_ARENAS[arenaId];
  if (!arena) return null;
  return TD_BIOMES[arena.biome] ?? null;
}

/** Every atlas that has HD art, for preload/verification tooling. */
export function tdAtlases(): string[] {
  return [...new Set(Object.values(TD_BIOMES).map((b) => b.atlas))];
}
