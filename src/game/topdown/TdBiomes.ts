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

/**
 * Registry. A biome absent from here simply never gets the HD treatment and
 * renders with the existing procedural pixel art — which is the correct,
 * non-crashing behaviour for any zone whose art has not been generated yet.
 */
export const TD_BIOMES: Partial<Record<SweepBiome, TdBiomeDef>> = {
  miller: MILLER,
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
