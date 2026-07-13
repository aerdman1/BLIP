/**
 * Top-down maps. Each arena is a HAND-AUTHORED level: a grid where FLOOR is carved
 * out of a solid wall field by overlapping room + hall rectangles (tile units), so
 * you navigate real rooms, corridors and chokepoints — with multiple routes — that
 * feel human-made and are unique per zone. Markers place node/breach/spawn/elite/
 * enemies/caches. Two modes: 'traverse' (charge node → reach breach → Fold) and
 * 'waves' (hold, spawns from open floor).
 */
import type { SweepEnemyKind } from '../config';

export type SweepBiome = 'miller' | 'motel' | 'stadium' | 'orchard';

/** rectangle in TILE units (carves floor) */
export interface SweepRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface SweepMarker {
  tx: number;
  ty: number;
}
export interface SweepEnemyMarker extends SweepMarker {
  type: SweepEnemyKind;
}

export interface SweepWave {
  spawns: { type: SweepEnemyKind; count: number }[];
  interval: number;
  clearDelay: number;
}

export interface SweepArena {
  id: string;
  label: string;
  mode: 'traverse' | 'waves';
  biome: SweepBiome;
  next?: string; // where the Fold leads (a SCENES key)
  grid: { w: number; h: number }; // map size in tiles
  rooms: SweepRect[]; // carved floor (open areas)
  halls: SweepRect[]; // carved floor (corridors)
  node: SweepMarker; // objective anchor
  breach?: SweepMarker; // exit (traverse)
  spawn: SweepMarker; // player start
  elite?: SweepMarker; // presence spawns the Classifier here
  enemies?: SweepEnemyMarker[]; // authored placements (traverse)
  caches?: SweepMarker[]; // hidden scan caches
  chargeTarget?: number;
  waves?: SweepWave[]; // waves mode
}

export const SWEEP_ARENAS: Record<string, SweepArena> = {
  // ── Zone 1: MILLER "SURFACE" ─────────────────────────────────────────────
  // Rural clearings joined by hedgerow lanes. Two routes to the breach: a NORTH
  // lane (node → ntop → breach) and a SOUTH lane (node → east room → breach).
  'surface-z1': {
    id: 'surface-z1',
    label: 'The Surface · Area 47',
    mode: 'traverse',
    biome: 'miller',
    next: 'FieldScene',
    grid: { w: 34, h: 20 },
    rooms: [
      { x: 2, y: 12, w: 9, h: 7 }, // A spawn (SW)
      { x: 2, y: 2, w: 9, h: 7 }, // D west (NW)
      { x: 13, y: 7, w: 9, h: 7 }, // B node (centre)
      { x: 13, y: 1, w: 9, h: 4 }, // F north-mid
      { x: 24, y: 2, w: 8, h: 7 }, // C breach (NE)
      { x: 24, y: 11, w: 8, h: 7 }, // E east (SE)
    ],
    halls: [
      { x: 9, y: 12, w: 6, h: 3 }, // A↔B (spawn → node)
      { x: 3, y: 6, w: 4, h: 7 }, // A↔D (left column)
      { x: 9, y: 5, w: 6, h: 3 }, // D↔B (west → node)
      { x: 15, y: 4, w: 4, h: 4 }, // B↔F (node → north-mid)
      { x: 20, y: 2, w: 6, h: 3 }, // F↔C (north route → breach)
      { x: 21, y: 10, w: 5, h: 3 }, // B↔E (node → east)
      { x: 28, y: 7, w: 3, h: 5 }, // E↔C (south route → breach)
    ],
    node: { tx: 17, ty: 10 },
    breach: { tx: 28, ty: 4 },
    spawn: { tx: 6, ty: 15 },
    elite: { tx: 19, ty: 9 },
    chargeTarget: 100,
    // ROSTER — "the open field": the fundamentals (drifter/tagger/diver) plus a first
    // taste of the JITTER weaver so Zone 1 teaches the verbs before later zones twist them.
    enemies: [
      { tx: 6, ty: 4, type: 'drifter' }, { tx: 9, ty: 6, type: 'tagger' }, { tx: 16, ty: 2, type: 'diver' },
      { tx: 17, ty: 5, type: 'weaver' }, { tx: 22, ty: 11, type: 'tagger' }, { tx: 27, ty: 13, type: 'diver' },
      { tx: 29, ty: 9, type: 'drifter' }, { tx: 15, ty: 12, type: 'tagger' }, { tx: 11, ty: 13, type: 'weaver' },
      { tx: 18, ty: 8, type: 'diver' },
    ],
    caches: [{ tx: 3, ty: 3 }, { tx: 30, ty: 16 }, { tx: 30, ty: 3 }],
  },

  // ── Zone 2: MOTEL "CIRCUIT" ──────────────────────────────────────────────
  // Small rooms linked by NARROW corridors in a circuit-board grid. Route 1: node
  // → north room → breach. Route 2 (longer): node → south room → far-right corridor
  // up to breach.
  'circuit-z2': {
    id: 'circuit-z2',
    label: 'Inside the Circuit · Motel Nowhere',
    mode: 'traverse',
    biome: 'motel',
    next: 'MotelScene',
    grid: { w: 34, h: 20 },
    rooms: [
      { x: 2, y: 14, w: 6, h: 4 }, // A spawn (SW)
      { x: 2, y: 7, w: 6, h: 4 }, // B (W)
      { x: 14, y: 8, w: 7, h: 5 }, // G node (centre)
      { x: 14, y: 2, w: 7, h: 4 }, // J north
      { x: 26, y: 2, w: 6, h: 5 }, // I breach (NE)
      { x: 24, y: 13, w: 8, h: 5 }, // H south-east
    ],
    halls: [
      { x: 3, y: 10, w: 2, h: 5 }, // A↔B
      { x: 6, y: 8, w: 9, h: 2 }, // B↔G (main corridor)
      { x: 16, y: 5, w: 2, h: 4 }, // G↔J
      { x: 20, y: 3, w: 7, h: 2 }, // J↔I  (route 1)
      { x: 20, y: 10, w: 6, h: 2 }, // G↔ east
      { x: 24, y: 11, w: 2, h: 3 }, // ↓ down to H
      { x: 29, y: 6, w: 2, h: 8 }, // H↔I  far-right corridor (route 2)
    ],
    node: { tx: 17, ty: 10 },
    breach: { tx: 28, ty: 4 },
    spawn: { tx: 4, ty: 15 },
    elite: { tx: 18, ty: 9 },
    chargeTarget: 90,
    // ROSTER — "the firewall circuit": tight corridors reward flanking, so FIREWALL wardens
    // clog the halls (dash through / hit their backs) and a rooted PYLON turret guards the node.
    enemies: [
      { tx: 4, ty: 8, type: 'warden' }, { tx: 10, ty: 8, type: 'tagger' }, { tx: 16, ty: 3, type: 'diver' },
      { tx: 23, ty: 3, type: 'warden' }, { tx: 17, ty: 11, type: 'turret' }, { tx: 26, ty: 15, type: 'diver' },
      { tx: 29, ty: 9, type: 'tagger' }, { tx: 19, ty: 10, type: 'drifter' }, { tx: 4, ty: 12, type: 'drifter' },
      { tx: 30, ty: 12, type: 'warden' },
    ],
    caches: [{ tx: 3, ty: 7 }, { tx: 30, ty: 17 }, { tx: 30, ty: 2 }],
  },

  // ── Zone 4: ORCHARD "THE LIVING MAZE" ────────────────────────────────────
  // The corn maze from above. Narrow hedgerow corridors and small clearings; the
  // NODE is the crop-circle glyph at the heart (charging it blooms the circle).
  // North route: spawn → west → node → north → breach. South/east route: spawn →
  // lower-mid → node → east-mid → breach (with a SE loop). Folds back to OrchardScene.
  'maze-z4': {
    id: 'maze-z4',
    label: 'The Living Maze · Patterson’s Orchard',
    mode: 'traverse',
    biome: 'orchard',
    next: 'OrchardScene',
    grid: { w: 36, h: 22 },
    rooms: [
      { x: 2, y: 16, w: 7, h: 5 }, // A spawn (SW)
      { x: 12, y: 15, w: 6, h: 5 }, // B lower-mid
      { x: 15, y: 8, w: 7, h: 6 }, // C node (centre — the crop circle)
      { x: 2, y: 8, w: 6, h: 5 }, // D west-mid
      { x: 14, y: 1, w: 7, h: 5 }, // E north-mid
      { x: 27, y: 2, w: 7, h: 6 }, // F breach (NE)
      { x: 27, y: 11, w: 7, h: 6 }, // G east-mid
      { x: 20, y: 16, w: 8, h: 5 }, // H south-east loop
    ],
    halls: [
      { x: 8, y: 17, w: 5, h: 2 }, // A↔B
      { x: 3, y: 12, w: 3, h: 5 }, // A↔D (left column)
      { x: 7, y: 10, w: 9, h: 2 }, // D↔C (west → node)
      { x: 15, y: 12, w: 3, h: 4 }, // B↔C (lower-mid → node)
      { x: 16, y: 5, w: 3, h: 4 }, // C↔E (node → north)
      { x: 20, y: 2, w: 8, h: 2 }, // E↔F (north route → breach)
      { x: 21, y: 12, w: 7, h: 2 }, // C↔G (node → east-mid)
      { x: 30, y: 7, w: 3, h: 5 }, // G↔F (east route → breach)
      { x: 17, y: 17, w: 4, h: 2 }, // B↔H
      { x: 27, y: 15, w: 3, h: 2 }, // H↔G
    ],
    node: { tx: 18, ty: 10 },
    breach: { tx: 30, ty: 4 },
    spawn: { tx: 5, ty: 18 },
    elite: { tx: 18, ty: 9 },
    chargeTarget: 110,
    // ROSTER — "the hunting maze": long corn lanes let PINPOINT snipers line up telegraphed
    // shots (break line-of-sight around a hedge), JITTER weavers dart the rows, and REPLICATOR
    // splitters lurk in the clearings — the densest, most varied fight of the campaign.
    enemies: [
      { tx: 5, ty: 10, type: 'sniper' }, { tx: 10, ty: 10, type: 'weaver' }, { tx: 14, ty: 17, type: 'splitter' },
      { tx: 18, ty: 12, type: 'weaver' }, { tx: 17, ty: 3, type: 'sniper' }, { tx: 24, ty: 2, type: 'tagger' },
      { tx: 29, ty: 13, type: 'sniper' }, { tx: 24, ty: 18, type: 'splitter' }, { tx: 31, ty: 14, type: 'weaver' },
      { tx: 16, ty: 9, type: 'diver' }, { tx: 9, ty: 18, type: 'splitter' },
    ],
    caches: [{ tx: 3, ty: 9 }, { tx: 32, ty: 16 }, { tx: 32, ty: 3 }],
  },

  // ── waves dev arena (F7) — simple open bordered field ────────────────────
  'anomaly-01': {
    id: 'anomaly-01',
    label: 'Signal Storm · Area 47',
    mode: 'waves',
    biome: 'miller',
    grid: { w: 30, h: 17 },
    rooms: [{ x: 1, y: 1, w: 28, h: 15 }],
    halls: [],
    node: { tx: 15, ty: 8 },
    spawn: { tx: 15, ty: 12 },
    // showcase escalation — introduces each new archetype one wave at a time, then a mixed finale
    waves: [
      { spawns: [{ type: 'drifter', count: 8 }], interval: 0.55, clearDelay: 1.6 },
      { spawns: [{ type: 'drifter', count: 6 }, { type: 'weaver', count: 3 }, { type: 'tagger', count: 3 }], interval: 0.5, clearDelay: 1.6 },
      { spawns: [{ type: 'warden', count: 3 }, { type: 'tagger', count: 4 }, { type: 'splitter', count: 2 }], interval: 0.48, clearDelay: 1.8 },
      { spawns: [{ type: 'sniper', count: 3 }, { type: 'weaver', count: 4 }, { type: 'turret', count: 2 }, { type: 'diver', count: 3 }], interval: 0.42, clearDelay: 2.0 },
      { spawns: [{ type: 'drifter', count: 8 }, { type: 'warden', count: 3 }, { type: 'splitter', count: 3 }, { type: 'turret', count: 2 }], interval: 0.38, clearDelay: 2.2 },
    ],
  },
};

export const DEFAULT_ARENA = 'surface-z1';
