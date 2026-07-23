/**
 * Top-down maps. Each arena is a HAND-AUTHORED level: a grid where FLOOR is carved
 * out of a solid wall field by overlapping room + hall rectangles (tile units), so
 * you navigate real rooms, corridors and chokepoints — with multiple routes — that
 * feel human-made and are unique per zone. Markers place node/breach/spawn/elite/
 * enemies/caches. Two modes: 'traverse' (charge node → reach breach → route onward) and
 * 'waves' (hold, spawns from open floor).
 */
import type { SweepEnemyKind } from '../config';

export type SweepBiome = 'miller' | 'motel' | 'stadium' | 'orchard' | 'storm';

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
  label?: string;
}

export interface SweepRouteBeacon {
  tx: number;
  ty: number;
  label: string;
}
export interface SweepScannerLine {
  aTx: number;
  aTy: number;
  bTx: number;
  bTy: number;
  label: string;
}
export interface SweepGravityWellMarker {
  tx: number;
  ty: number;
  destTx: number;
  destTy: number;
  label: string;
  destLabel: string;
}
export interface SweepBoostGap {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  orientation?: 'horizontal' | 'vertical';
}
export interface SweepElevationZone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'rise' | 'drop' | 'roofline' | 'creek' | 'rift';
  cameraOffsetY?: number;
  cameraZoom?: number;
}
export interface SweepFieldEvent {
  id: string;
  label: string;
  tx: number;
  ty: number;
  radius?: number;
  trigger: 'enter' | 'scan';
  reward?: 'boon' | 'health' | 'weapon' | 'overdrive' | 'shards' | 'defense' | 'upgrade';
  scout?: 'will' | 'chip' | 'henry' | 'cameron' | 'danny';
  wid?: string;
  upgradeId?: string;
  upgradeName?: string;
  upgradeDescription?: string;
  shards?: number;
  charge?: number;
  message?: string;
  spawns?: SweepEnemyMarker[];
  requiresGravityWell?: boolean;
}

export interface SweepArena {
  id: string;
  label: string;
  mode: 'traverse' | 'waves';
  biome: SweepBiome;
  zoneId?: string;
  questId?: string;
  nextArena?: string; // next arena in the route-connected top-down chain
  nextLabel?: string;
  completeZoneOnExit?: string;
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
  minObjectiveActions?: number; // minimum kills/scanner/puzzle actions before the route can open
  waves?: SweepWave[]; // waves mode
  // ── finale generosity / climax (scoped per-arena so earlier routes stay tuned) ──
  dropChance?: number; // override SWEEP.dropChance for THIS arena only (loot-rich finale)
  clearBonus?: number; // override SWEEP.shardsClearBonus granted on route completion
  weaponSpawns?: { tx: number; ty: number; wid: string }[]; // guaranteed weapon pickups
  bossFinale?: boolean; // optional dormant boss gate; current slice keeps Orchard traversal-focused
  boostGaps?: SweepBoostGap[]; // cracked washouts that normal movement cannot cross; hold Boost to pass
  elevationZones?: SweepElevationZone[]; // visual 2.5D areas that shift camera/ground read without changing collision
  fieldEvents?: SweepFieldEvent[]; // authored pocket rewards, ambushes and one-off power-ups
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
    zoneId: 'miller-field',
    questId: 'the-first-contact',
    nextArena: 'circuit-z2',
    nextLabel: 'Road East · Motel Nowhere',
    completeZoneOnExit: 'miller-field',
    grid: { w: 86, h: 52 },
    rooms: [
      { x: 4, y: 36, w: 14, h: 10 }, // A spawn clearing
      { x: 28, y: 35, w: 18, h: 9 }, // B field track / road bend
      { x: 31, y: 22, w: 16, h: 8 }, // C Willow cache grove / objective hub
      { x: 5, y: 8, w: 16, h: 9 }, // D old mill secret spur
      { x: 12, y: 23, w: 13, h: 8 }, // E ridge trail / optional approach
      { x: 65, y: 17, w: 17, h: 10 }, // F east road / Motel breach approach
      { x: 58, y: 34, w: 18, h: 9 }, // G motel bend / lower route
      { x: 54, y: 6, w: 16, h: 8 }, // H signal substation overlook
      { x: 37, y: 43, w: 16, h: 6 }, // I lower field / recovery space
      { x: 71, y: 38, w: 10, h: 8 }, // J hidden scout shelter pocket
      { x: 62, y: 28, w: 8, h: 5 }, // K power-gate shortcut pocket
    ],
    halls: [
      { x: 17, y: 40, w: 12, h: 4 }, // A↔B: Field Track leaves spawn
      { x: 38, y: 29, w: 5, h: 7 }, // B↔C: Willow trail turns north
      { x: 10, y: 16, w: 5, h: 21 }, // A↔D/E: old fence trail
      { x: 18, y: 27, w: 14, h: 4 }, // E↔C: optional ridge approach
      { x: 46, y: 24, w: 20, h: 4 }, // C↔F: East Road main route
      { x: 42, y: 12, w: 5, h: 11 }, // C↔H vertical climb
      { x: 46, y: 10, w: 9, h: 4 }, // H↔C/substation connector
      { x: 45, y: 38, w: 14, h: 4 }, // B↔G: motel bend lower route
      { x: 70, y: 26, w: 5, h: 9 }, // G↔F: road curls north to breach
      { x: 45, y: 43, w: 15, h: 4 }, // B/I↔G: lower recovery lane
      { x: 63, y: 32, w: 4, h: 3 }, // G↔K: power-gate shortcut entry
      { x: 66, y: 27, w: 3, h: 5 }, // K↔F: shortcut back to East Road
      { x: 59, y: 13, w: 4, h: 15 }, // H↔K: substation power puzzle link
    ],
    node: { tx: 39, ty: 26 },
    breach: { tx: 76, ty: 21 },
    spawn: { tx: 11, ty: 27 },
    chargeTarget: 50,
    minObjectiveActions: 2,
    weaponSpawns: [
      { tx: 34, ty: 38, wid: 'disc' }, // Willow Trail — teaches ranged positioning before the cache grove
      { tx: 64, ty: 30, wid: 'arc' }, // Power-gate shortcut — close-range answer for the ambush
    ],
    boostGaps: [
      { id: 'lower-lane-washout', label: 'BOOST WASHOUT', x: 50, y: 43, w: 5, h: 4, orientation: 'vertical' },
      { id: 'old-mill-crack', label: 'OLD MILL CRACK', x: 10, y: 18, w: 5, h: 3, orientation: 'horizontal' },
    ],
    elevationZones: [
      { id: 'substation-overlook-rise', label: 'SUBSTATION OVERLOOK', x: 51, y: 4, w: 23, h: 13, kind: 'rise', cameraOffsetY: -88, cameraZoom: 0.68 },
      { id: 'lower-field-dip', label: 'LOWER FIELD', x: 35, y: 41, w: 28, h: 9, kind: 'drop', cameraOffsetY: 44, cameraZoom: 0.82 },
      { id: 'old-mill-bank', label: 'OLD MILL BANK', x: 4, y: 7, w: 21, h: 13, kind: 'rise', cameraOffsetY: -64, cameraZoom: 0.76 },
    ],
    // ROSTER — "the open field": introductory pursuit/charge pressure plus one first deception beat.
    enemies: [
      { tx: 20, ty: 41, type: 'drifter' }, { tx: 35, ty: 38, type: 'tagger' }, { tx: 19, ty: 27, type: 'drifter' },
      { tx: 39, ty: 25, type: 'tagger' }, { tx: 56, ty: 25, type: 'diver' }, { tx: 68, ty: 20, type: 'tagger' },
      { tx: 73, ty: 24, type: 'diver' }, { tx: 58, ty: 10, type: 'drifter' }, { tx: 12, ty: 12, type: 'tagger' },
      { tx: 66, ty: 30, type: 'decoy' },
    ],
    caches: [{ tx: 8, ty: 11 }, { tx: 35, ty: 25 }, { tx: 64, ty: 9 }, { tx: 49, ty: 45 }, { tx: 76, ty: 42 }],
    fieldEvents: [
      {
        id: 'crash-site-core',
        label: 'CRASH SITE',
        tx: 11,
        ty: 27,
        radius: 58,
        trigger: 'enter',
        reward: 'shards',
        shards: 4,
        message: 'BOOT TRACE - Scout tags found: CONTACT-47 is not hostile.',
      },
      {
        id: 'spark-line',
        label: 'SPARK LINE',
        tx: 14,
        ty: 31,
        trigger: 'scan',
        reward: 'boon',
        scout: 'chip',
        shards: 4,
        message: 'CHIP RELAY - Movement power rerouted. Hold Boost to cross broken ground.',
      },
      {
        id: 'first-kit-cache',
        label: 'FIRST KIT',
        tx: 17,
        ty: 36,
        radius: 56,
        trigger: 'enter',
        reward: 'shards',
        scout: 'will',
        shards: 8,
        message: 'WILLOW CACHE - Five kids left this kit for the thing falling from the sky.',
      },
      {
        id: 'old-mill-log',
        label: 'OLD MILL LOG',
        tx: 12,
        ty: 12,
        trigger: 'scan',
        reward: 'shards',
        shards: 18,
        charge: 10,
        message: 'WILLOW LOG — “The mill wheel moved by itself after midnight.”',
        spawns: [{ tx: 15, ty: 12, type: 'drifter' }, { tx: 10, ty: 14, type: 'tagger' }],
      },
      {
        id: 'substation-switch',
        label: 'POWER SWITCH',
        tx: 64,
        ty: 10,
        radius: 50,
        trigger: 'enter',
        reward: 'boon',
        scout: 'chip',
        charge: 12,
        message: 'SPARK BOOST — Substation rerouted into the Carbine.',
        spawns: [{ tx: 61, ty: 13, type: 'warden' }],
      },
      {
        id: 'shelter-stash',
        label: 'SCOUT SHELTER',
        tx: 76,
        ty: 42,
        trigger: 'scan',
        reward: 'weapon',
        wid: 'disc',
        shards: 10,
        message: 'SCOUT SHELTER — Recall Disc prototype found.',
        spawns: [{ tx: 72, ty: 39, type: 'diver' }, { tx: 78, ty: 40, type: 'drifter' }],
      },
      {
        id: 'motel-bend-ambush',
        label: 'BEND SIGNAL',
        tx: 67,
        ty: 37,
        radius: 56,
        trigger: 'enter',
        reward: 'health',
        charge: 8,
        message: 'Roadside cache tripped a classifier ambush.',
        spawns: [{ tx: 69, ty: 35, type: 'tagger' }, { tx: 72, ty: 38, type: 'diver' }],
      },
    ],
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
    zoneId: 'motel-nowhere',
    questId: 'the-long-night',
    nextArena: 'town-z3',
    nextLabel: 'River Road · Chagrin Falls',
    completeZoneOnExit: 'motel-nowhere',
    grid: { w: 86, h: 52 },
    rooms: [
      { x: 4, y: 40, w: 14, h: 8 }, // A motel entry / roadside shoulder
      { x: 12, y: 31, w: 16, h: 8 }, // B parking lot / safe-shadow approach
      { x: 29, y: 31, w: 14, h: 8 }, // C check-in office / fallback combat
      { x: 18, y: 12, w: 18, h: 8 }, // D room-row wing / optional stealth branch
      { x: 38, y: 18, w: 16, h: 10 }, // E drained pool courtyard
      { x: 46, y: 30, w: 13, h: 8 }, // F scanner circuit core
      { x: 62, y: 32, w: 16, h: 10 }, // G service lot / combat fallback loop
      { x: 68, y: 7, w: 14, h: 9 }, // H River Road exit / town breach
      { x: 7, y: 15, w: 10, h: 8 }, // I hidden maintenance pocket
      { x: 55, y: 12, w: 10, h: 7 }, // J rooftop motel sign / overlook
      { x: 33, y: 43, w: 10, h: 5 }, // K dumpster alcove / recovery pocket
      { x: 70, y: 45, w: 9, h: 4 }, // L drainage shortcut behind service lot
    ],
    halls: [
      { x: 13, y: 37, w: 4, h: 4 }, // A↔B: motel driveway
      { x: 27, y: 34, w: 3, h: 4 }, // B↔C: check-in choke
      { x: 21, y: 19, w: 4, h: 13 }, // B↔D: room-row stairwell
      { x: 35, y: 16, w: 4, h: 4 }, // D↔E: upper stealth cut
      { x: 48, y: 27, w: 4, h: 4 }, // E↔F: pool to circuit
      { x: 42, y: 34, w: 5, h: 4 }, // C↔F: loud fallback route
      { x: 58, y: 34, w: 5, h: 4 }, // F↔G: service lot loop
      { x: 72, y: 16, w: 4, h: 17 }, // G↔H: River Road ramp
      { x: 53, y: 15, w: 4, h: 4 }, // E↔J: motel sign ledge
      { x: 64, y: 13, w: 5, h: 3 }, // J↔H: upper exit shortcut
      { x: 12, y: 18, w: 7, h: 3 }, // I↔D: maintenance crawl
      { x: 9, y: 22, w: 4, h: 19 }, // A↔I: hidden west service path
      { x: 35, y: 38, w: 4, h: 6 }, // C↔K: recovery alcove
      { x: 42, y: 45, w: 29, h: 3 }, // K↔L: drainage shortcut return
      { x: 73, y: 42, w: 4, h: 4 }, // L↔G: behind service lot
    ],
    node: { tx: 51, ty: 34 },
    breach: { tx: 75, ty: 11 },
    spawn: { tx: 36, ty: 45 },
    elite: { tx: 52, ty: 33 },
    chargeTarget: 62,
    minObjectiveActions: 2,
    weaponSpawns: [
      { tx: 31, ty: 35, wid: 'arc' }, // Check-In fallback route — encourages parry/close play in halls
      { tx: 59, ty: 15, wid: 'disc' }, // Motel Sign Ledge — rewards stealth/overlook exploration
    ],
    elevationZones: [
      { id: 'room-row-overhang', label: 'ROOM ROW ROOF EDGE', x: 17, y: 21, w: 19, h: 13, kind: 'roofline', cameraOffsetY: -62, cameraZoom: 0.74 },
      { id: 'pool-courtyard-low', label: 'POOL COURTYARD', x: 38, y: 17, w: 18, h: 13, kind: 'drop', cameraOffsetY: 40, cameraZoom: 0.82 },
      { id: 'river-ramp-rise', label: 'RIVER RAMP', x: 67, y: 16, w: 12, h: 12, kind: 'rise', cameraOffsetY: -78, cameraZoom: 0.68 },
    ],
    // ROSTER — "the firewall circuit": machinery, scanners, PYLON lanes, wardens and a first GRAVITON.
    enemies: [
      { tx: 18, ty: 35, type: 'decoy' }, { tx: 32, ty: 35, type: 'sniper' }, { tx: 24, ty: 15, type: 'warden' },
      { tx: 34, ty: 17, type: 'warden' }, { tx: 51, ty: 35, type: 'turret' }, { tx: 45, ty: 23, type: 'graviton' },
      { tx: 63, ty: 15, type: 'sniper' }, { tx: 56, ty: 34, type: 'turret' }, { tx: 13, ty: 19, type: 'decoy' },
      { tx: 70, ty: 36, type: 'warden' }, { tx: 72, ty: 11, type: 'sniper' }, { tx: 65, ty: 34, type: 'turret' },
      { tx: 44, ty: 45, type: 'sniper' },
    ],
    caches: [{ tx: 8, ty: 44 }, { tx: 10, ty: 18 }, { tx: 25, ty: 14 }, { tx: 59, ty: 15 }, { tx: 74, ty: 38 }, { tx: 74, ty: 46 }, { tx: 79, ty: 9 }],
    fieldEvents: [
      {
        id: 'safe-shadow-battery',
        label: 'SAFE BATTERY',
        tx: 16,
        ty: 35,
        radius: 52,
        trigger: 'enter',
        reward: 'health',
        charge: 6,
        message: 'Safe-shadow battery found — enough charge to survive a bad alert.',
      },
      {
        id: 'maintenance-cache',
        label: 'MAINTENANCE CACHE',
        tx: 10,
        ty: 18,
        trigger: 'scan',
        reward: 'boon',
        scout: 'henry',
        charge: 12,
        message: 'ANCHOR KIT — Shield cells hidden behind the vending breaker.',
      },
      {
        id: 'room-row-stash',
        label: 'ROOM ROW STASH',
        tx: 25,
        ty: 14,
        trigger: 'scan',
        reward: 'shards',
        shards: 20,
        charge: 8,
        message: 'Room Row stash recovered before the cameras could label it.',
        spawns: [{ tx: 24, ty: 17, type: 'warden' }, { tx: 28, ty: 15, type: 'decoy' }],
      },
      {
        id: 'pool-crossing',
        label: 'POOL CROSSING',
        tx: 45,
        ty: 23,
        radius: 50,
        trigger: 'enter',
        reward: 'overdrive',
        charge: 10,
        message: 'Pool lights discharge into Overdrive.',
        spawns: [{ tx: 48, ty: 24, type: 'graviton' }],
      },
      {
        id: 'service-lot-locker',
        label: 'SERVICE LOCKER',
        tx: 74,
        ty: 38,
        trigger: 'scan',
        reward: 'weapon',
        wid: 'arc',
        charge: 8,
        message: 'Service locker opened — Arc Blade tuned for close quarters.',
        spawns: [{ tx: 70, ty: 36, type: 'warden' }, { tx: 76, ty: 36, type: 'turret' }],
      },
      {
        id: 'sign-ledge-prize',
        label: 'SIGN LEDGE',
        tx: 59,
        ty: 15,
        trigger: 'scan',
        reward: 'health',
        shards: 12,
        charge: 6,
        message: 'Motel sign ledge cache recovered — emergency cells restored.',
      },
    ],
  },

  // ── Zone 3 connector: CHAGRIN FALLS TOWN / STADIUM ROUTE ────────────────
  // A compact town-street route built from the existing top-down grammar. The
  // walls are exterior building blocks, bridge rails, alleys, and stadium
  // fencing: readable town structure without enterable interiors.
  'town-z3': {
    id: 'town-z3',
    label: 'River Road · Chagrin Falls',
    mode: 'traverse',
    biome: 'stadium',
    zoneId: 'tiger-stadium',
    questId: 'friday-night-lights',
    nextArena: 'maze-z4',
    nextLabel: "County Trail · Patterson's Orchard",
    completeZoneOnExit: 'tiger-stadium',
    grid: { w: 92, h: 56 },
    rooms: [
      { x: 4, y: 39, w: 14, h: 9 }, // A motel road entry
      { x: 22, y: 38, w: 18, h: 8 }, // B Main Street storefronts
      { x: 43, y: 30, w: 16, h: 10 }, // C town square / scanner tower
      { x: 10, y: 14, w: 16, h: 11 }, // D north neighborhood
      { x: 34, y: 13, w: 14, h: 8 }, // E alley market / upper approach
      { x: 62, y: 10, w: 18, h: 9 }, // F bridge / falls overlook
      { x: 57, y: 23, w: 10, h: 7 }, // G service alley / tower flank
      { x: 64, y: 37, w: 18, h: 10 }, // H expanded Stadium Road
      { x: 78, y: 46, w: 10, h: 7 }, // I Orchard Gate
      { x: 37, y: 46, w: 15, h: 6 }, // J lower river walk secret route
      { x: 55, y: 48, w: 9, h: 5 }, // K broken bridge pocket / recovery
      { x: 68, y: 49, w: 9, h: 4 }, // L alley behind stadium wall
    ],
    halls: [
      { x: 17, y: 42, w: 6, h: 4 }, // A↔B: Main Street entry
      { x: 39, y: 35, w: 5, h: 4 }, // B↔C: central approach
      { x: 11, y: 24, w: 5, h: 16 }, // A↔D: side street
      { x: 25, y: 17, w: 10, h: 4 }, // D↔E: neighborhood alley
      { x: 47, y: 16, w: 16, h: 4 }, // E↔F: bridge approach
      { x: 65, y: 18, w: 5, h: 7 }, // F↔G: bridge ramp
      { x: 56, y: 27, w: 5, h: 6 }, // G↔C: tower flank
      { x: 58, y: 35, w: 7, h: 4 }, // C↔H: stadium road
      { x: 78, y: 43, w: 4, h: 4 }, // H↔I: orchard gate
      { x: 35, y: 44, w: 5, h: 5 }, // B↔J: lower river access
      { x: 52, y: 48, w: 13, h: 4 }, // J↔H: river walk shortcut
      { x: 63, y: 49, w: 6, h: 3 }, // K↔L: stadium back alley
      { x: 72, y: 47, w: 7, h: 3 }, // L↔I: final orchard-gate bend
      { x: 49, y: 40, w: 4, h: 7 }, // C↔J: stairs to river walk shortcut
    ],
    node: { tx: 51, ty: 35 },
    breach: { tx: 83, ty: 49 },
    spawn: { tx: 72, ty: 13 },
    elite: { tx: 52, ty: 34 },
    chargeTarget: 60,
    minObjectiveActions: 3,
    weaponSpawns: [
      { tx: 45, ty: 48, wid: 'disc' }, // River Walk — rewards the lower shortcut
      { tx: 59, ty: 50, wid: 'arc' }, // Broken Bridge pocket — close-range tool for Stadium Road
    ],
    elevationZones: [
      { id: 'market-upper-route', label: 'MARKET ALLEY RISE', x: 33, y: 12, w: 21, h: 13, kind: 'rise', cameraOffsetY: -78, cameraZoom: 0.72 },
      { id: 'river-walk-low', label: 'RIVER WALK', x: 49, y: 42, w: 26, h: 10, kind: 'creek', cameraOffsetY: 50, cameraZoom: 0.82 },
      { id: 'stadium-road-crown', label: 'STADIUM ROAD CROWN', x: 61, y: 36, w: 20, h: 12, kind: 'roofline', cameraOffsetY: -54, cameraZoom: 0.76 },
    ],
    enemies: [
      { tx: 18, ty: 43, type: 'tagger' }, { tx: 31, ty: 42, type: 'weaver' }, { tx: 40, ty: 17, type: 'sniper' },
      { tx: 56, ty: 35, type: 'cipher' }, { tx: 63, ty: 18, type: 'weaver' }, { tx: 64, ty: 26, type: 'dormant' },
      { tx: 78, ty: 42, type: 'cipher' }, { tx: 47, ty: 38, type: 'tagger' }, { tx: 19, ty: 18, type: 'tagger' },
      { tx: 45, ty: 49, type: 'dormant' }, { tx: 74, ty: 39, type: 'warden' }, { tx: 83, ty: 50, type: 'weaver' },
      { tx: 70, ty: 50, type: 'sniper' },
    ],
    caches: [{ tx: 13, ty: 17 }, { tx: 75, ty: 13 }, { tx: 45, ty: 48 }, { tx: 84, ty: 51 }, { tx: 39, ty: 15 }],
    fieldEvents: [
      {
        id: 'neighborhood-cache',
        label: 'NEIGHBORHOOD CACHE',
        tx: 13,
        ty: 17,
        trigger: 'scan',
        reward: 'boon',
        scout: 'will',
        charge: 10,
        message: 'WILLOW MARKERS — hidden route notes flood your scanner.',
      },
      {
        id: 'market-alley-trap',
        label: 'MARKET ALLEY',
        tx: 39,
        ty: 15,
        radius: 56,
        trigger: 'enter',
        reward: 'shards',
        shards: 16,
        charge: 10,
        message: 'Market Alley beacon exposed a flanking patrol.',
        spawns: [{ tx: 36, ty: 17, type: 'sniper' }, { tx: 42, ty: 18, type: 'weaver' }],
      },
      {
        id: 'bridge-overlook-cache',
        label: 'BRIDGE CACHE',
        tx: 75,
        ty: 13,
        trigger: 'scan',
        reward: 'weapon',
        wid: 'disc',
        charge: 8,
        message: 'Bridge Overlook cache — Recall Disc lines up the tower flank.',
        spawns: [{ tx: 71, ty: 14, type: 'sniper' }],
      },
      {
        id: 'river-walk-cache',
        label: 'RIVER WALK',
        tx: 45,
        ty: 48,
        trigger: 'scan',
        reward: 'health',
        charge: 8,
        message: 'River Walk recovery cache opened.',
      },
      {
        id: 'orchard-gate-stand',
        label: 'ORCHARD GATE',
        tx: 84,
        ty: 51,
        radius: 58,
        trigger: 'enter',
        reward: 'defense',
        charge: 12,
        message: 'Scout Relay Pylons deployed — hold River Road while they cover the gate.',
        spawns: [{ tx: 82, ty: 48, type: 'warden' }, { tx: 78, ty: 50, type: 'cipher' }, { tx: 85, ty: 49, type: 'weaver' }],
      },
    ],
  },

  // ── Zone 4: ORCHARD "THE LIVING MAZE" ────────────────────────────────────
  // The corn maze from above. Narrow hedgerow corridors and small clearings; the
  // NODE is the crop-circle glyph at the heart (charging it blooms the circle).
  // North route: spawn → west → node → north → breach. South/east route: spawn →
  // lower-mid -> node -> east-mid -> breach, with a southeast loop.
  'maze-z4': {
    id: 'maze-z4',
    label: 'The Living Maze · Patterson’s Orchard',
    mode: 'traverse',
    biome: 'orchard',
    zoneId: 'pattersons-orchard',
    questId: 'the-endless-harvest',
    nextArena: 'anomaly-01',
    nextLabel: 'Signal Storm · Area 47',
    completeZoneOnExit: 'pattersons-orchard',
    grid: { w: 92, h: 58 },
    rooms: [
      { x: 4, y: 47, w: 14, h: 8 }, // A orchard entry / tractor lane
      { x: 24, y: 45, w: 16, h: 8 }, // B lower rows / weapon practice
      { x: 6, y: 25, w: 14, h: 10 }, // C west rows / recall lane
      { x: 27, y: 31, w: 16, h: 8 }, // D Gravity Well pump field
      { x: 42, y: 22, w: 16, h: 10 }, // E crop-circle objective
      { x: 42, y: 6, w: 16, h: 9 }, // F raised ridge cache
      { x: 63, y: 24, w: 16, h: 10 }, // G east rows / pressure lane
      { x: 67, y: 43, w: 14, h: 8 }, // H hidden Scout shelter
      { x: 74, y: 7, w: 14, h: 10 }, // I storm breach ridge
      { x: 21, y: 13, w: 13, h: 7 }, // J lower creek / optional puzzle pocket
      { x: 58, y: 43, w: 8, h: 6 }, // K pump station return switch
      { x: 77, y: 31, w: 8, h: 6 }, // L storm-fence shortcut pocket
    ],
    halls: [
      { x: 17, y: 50, w: 8, h: 4 }, // A↔B: tractor track
      { x: 10, y: 34, w: 5, h: 14 }, // A↔C: west row climb
      { x: 19, y: 30, w: 9, h: 4 }, // C↔D: pump-house approach
      { x: 33, y: 38, w: 5, h: 8 }, // B↔D: lower-row approach
      { x: 39, y: 28, w: 5, h: 6 }, // D↔E: regulator lane
      { x: 48, y: 14, w: 5, h: 9 }, // E↔F: raised route
      { x: 57, y: 27, w: 7, h: 4 }, // E↔G: east rows
      { x: 77, y: 17, w: 5, h: 8 }, // G↔I: storm ridge climb
      { x: 40, y: 48, w: 28, h: 4 }, // B↔H: shelter shortcut
      { x: 71, y: 34, w: 4, h: 10 }, // H↔G: back into east rows
      { x: 19, y: 16, w: 4, h: 11 }, // C↔J: creek drop
      { x: 33, y: 15, w: 10, h: 4 }, // J↔F: hidden raised cut
      { x: 65, y: 46, w: 4, h: 3 }, // H↔K: shelter switch room
      { x: 63, y: 39, w: 4, h: 5 }, // K↔G: return from Scout shelter
      { x: 76, y: 34, w: 4, h: 10 }, // L↔H: storm-fence shortcut
      { x: 78, y: 17, w: 4, h: 15 }, // I↔L: ridge return loop
    ],
    node: { tx: 50, ty: 27 },
    breach: { tx: 80, ty: 11 },
    spawn: { tx: 80, ty: 47 },
    chargeTarget: 70,
    minObjectiveActions: 3,
    // ORCHARD FLAGS: loot-rich drops, a bumped clear payout and guaranteed
    // weapon pickups seeded along both routes. The authored finale is Signal
    // Storm; Orchard stays focused on Gravity Well traversal and route memory.
    dropChance: 0.55, // the campaign's most generous route clear — the finale should shower loot
    clearBonus: 45, // a fatter payout for clearing the last connected region
    bossFinale: false,
    weaponSpawns: [
      { tx: 12, ty: 50, wid: 'pulse' }, // A — reliable ranged pressure near spawn
      { tx: 12, ty: 29, wid: 'disc' }, // C — recall line for the west rows
      { tx: 50, ty: 10, wid: 'arc' }, // F — close-range answer on raised ridge
      { tx: 72, ty: 47, wid: 'disc' }, // H — positioning tool near Scout shelter
      { tx: 31, ty: 49, wid: 'arc' }, // B — risky burst option before the boss finale
    ],
    elevationZones: [
      { id: 'lower-creek-drop', label: 'LOWER CREEK', x: 19, y: 46, w: 21, h: 10, kind: 'creek', cameraOffsetY: 54, cameraZoom: 0.82 },
      { id: 'raised-ridge', label: 'RAISED RIDGE', x: 40, y: 4, w: 24, h: 15, kind: 'rise', cameraOffsetY: -96, cameraZoom: 0.68 },
      { id: 'crop-circle-bowl', label: 'CROP CIRCLE BOWL', x: 41, y: 21, w: 20, h: 14, kind: 'drop', cameraOffsetY: 42, cameraZoom: 0.82 },
    ],
    // ROSTER — "the hunting maze": open rows teach DIVER/DRIFTER movement pressure,
    // REPLICATOR splitters swarm clearings, UNDERTOW erupts from the soil, and DORMANT
    // machinery makes quiet orchard wreckage suspicious. One CIPHER is reserved for the
    // crop-circle signal beat only.
    enemies: [
      { tx: 12, ty: 27, type: 'diver' }, { tx: 14, ty: 32, type: 'drifter' }, { tx: 27, ty: 49, type: 'splitter' },
      { tx: 35, ty: 47, type: 'splitter' }, { tx: 36, ty: 35, type: 'undertow' }, { tx: 44, ty: 30, type: 'drifter' },
      { tx: 52, ty: 29, type: 'cipher' }, { tx: 45, ty: 10, type: 'undertow' }, { tx: 54, ty: 11, type: 'dormant' },
      { tx: 67, ty: 28, type: 'diver' }, { tx: 73, ty: 29, type: 'drifter' }, { tx: 73, ty: 47, type: 'splitter' },
      { tx: 76, ty: 24, type: 'dormant' }, { tx: 70, ty: 33, type: 'diver' }, { tx: 48, ty: 48, type: 'splitter' },
      { tx: 49, ty: 25, type: 'undertow' }, { tx: 62, ty: 46, type: 'drifter' },
    ],
    caches: [
      { tx: 9, ty: 28 }, { tx: 76, ty: 47 }, { tx: 82, ty: 10 }, { tx: 11, ty: 53 },
      { tx: 30, ty: 49 }, { tx: 52, ty: 10 }, { tx: 27, ty: 16 },
    ],
    fieldEvents: [
      {
        id: 'lower-creek-puzzle',
        label: 'LOWER CREEK',
        tx: 27,
        ty: 16,
        trigger: 'scan',
        reward: 'shards',
        shards: 24,
        charge: 12,
        message: 'Lower Creek glyph read — the maze briefly stops lying.',
        spawns: [{ tx: 24, ty: 17, type: 'undertow' }, { tx: 30, ty: 18, type: 'drifter' }],
      },
      {
        id: 'west-row-recall-cache',
        label: 'RECALL ROW',
        tx: 9,
        ty: 28,
        trigger: 'scan',
        reward: 'weapon',
        wid: 'disc',
        charge: 8,
        message: 'Recall Row cache: line the disc through the corn lanes.',
      },
      {
        id: 'tractor-lane-recovery',
        label: 'TRACTOR BATTERY',
        tx: 12,
        ty: 51,
        radius: 54,
        trigger: 'enter',
        reward: 'health',
        charge: 6,
        message: 'Tractor battery stabilized — safe charge recovered before the maze tightens.',
      },
      {
        id: 'raised-ridge-cache',
        label: 'RIDGE CACHE',
        tx: 52,
        ty: 10,
        radius: 54,
        trigger: 'enter',
        reward: 'boon',
        scout: 'danny',
        charge: 14,
        message: 'ROCKET BOOST — Ridge launch tuned your fire cycle.',
        spawns: [{ tx: 47, ty: 11, type: 'undertow' }, { tx: 55, ty: 12, type: 'dormant' }],
      },
      {
        id: 'scout-shelter-loop',
        label: 'SCOUT SHELTER',
        tx: 76,
        ty: 47,
        trigger: 'scan',
        reward: 'upgrade',
        upgradeId: 'scan-memory',
        upgradeName: 'Scan Memory',
        upgradeDescription: 'Scan pulses leave lingering blue Scout echoes on hidden routes, caches, and suspicious devices.',
        requiresGravityWell: true,
        charge: 10,
        message: 'CAMERON MAP — the Scout shelter only resolves after the Raised Ridge pattern is proven.',
        spawns: [{ tx: 73, ty: 47, type: 'splitter' }, { tx: 78, ty: 45, type: 'dormant' }],
      },
      {
        id: 'storm-fence-prize',
        label: 'STORM FENCE',
        tx: 82,
        ty: 10,
        trigger: 'scan',
        reward: 'overdrive',
        charge: 8,
        message: 'Storm fence overload primed.',
      },
    ],
  },

  // ── waves dev arena (F7) — simple open bordered field ────────────────────
  'anomaly-01': {
    id: 'anomaly-01',
    label: 'Signal Storm · Area 47',
    mode: 'waves',
    biome: 'storm',
    zoneId: 'skyline-array',
    questId: 'the-sky-listens',
    grid: { w: 82, h: 54 },
    rooms: [
      { x: 33, y: 43, w: 16, h: 8 }, // storm entry / recovery line
      { x: 31, y: 23, w: 20, h: 12 }, // classifier core
      { x: 7, y: 24, w: 18, h: 12 }, // west pressure pocket
      { x: 58, y: 24, w: 18, h: 12 }, // east pressure pocket
      { x: 30, y: 5, w: 22, h: 12 }, // north rift / stage two
      { x: 21, y: 38, w: 15, h: 8 }, // southwest recovery pocket
      { x: 47, y: 38, w: 15, h: 8 }, // southeast recovery pocket
      { x: 12, y: 10, w: 14, h: 8 }, // west relay wing
      { x: 56, y: 10, w: 14, h: 8 }, // east relay wing
      { x: 33, y: 18, w: 7, h: 4 }, // west classifier coil pocket
      { x: 43, y: 18, w: 7, h: 4 }, // east classifier coil pocket
      { x: 6, y: 39, w: 10, h: 6 }, // far west recovery pocket
      { x: 66, y: 39, w: 10, h: 6 }, // far east recovery pocket
    ],
    halls: [
      { x: 39, y: 34, w: 4, h: 10 }, // entry -> core
      { x: 24, y: 29, w: 8, h: 4 }, // west pocket -> core
      { x: 50, y: 29, w: 9, h: 4 }, // east pocket -> core
      { x: 39, y: 16, w: 4, h: 8 }, // core -> north rift
      { x: 25, y: 41, w: 9, h: 4 }, // entry -> west recovery
      { x: 48, y: 41, w: 10, h: 4 }, // entry -> east recovery
      { x: 25, y: 13, w: 6, h: 4 }, // west wing -> north rift
      { x: 51, y: 13, w: 6, h: 4 }, // east wing -> north rift
      { x: 18, y: 18, w: 4, h: 7 }, // west wing -> west pocket
      { x: 62, y: 18, w: 4, h: 7 }, // east wing -> east pocket
      { x: 16, y: 41, w: 6, h: 3 }, // far west recovery -> southwest pocket
      { x: 61, y: 41, w: 6, h: 3 }, // southeast pocket -> far east recovery
      { x: 36, y: 20, w: 4, h: 4 }, // west coil -> classifier core
      { x: 43, y: 20, w: 4, h: 4 }, // east coil -> classifier core
    ],
    node: { tx: 41, ty: 29 },
    spawn: { tx: 34, ty: 11 },
    caches: [{ tx: 18, ty: 14 }, { tx: 63, ty: 14 }, { tx: 24, ty: 42 }, { tx: 57, ty: 42 }],
    elevationZones: [
      { id: 'classifier-core-bowl', label: 'CLASSIFIER CORE BOWL', x: 29, y: 21, w: 24, h: 16, kind: 'rift', cameraOffsetY: 44, cameraZoom: 0.78 },
      { id: 'north-rift-rise', label: 'NORTH RIFT RISE', x: 27, y: 3, w: 28, h: 16, kind: 'rise', cameraOffsetY: -108, cameraZoom: 0.66 },
      { id: 'relay-wing-ledges', label: 'RELAY WING LEDGES', x: 10, y: 8, w: 62, h: 12, kind: 'roofline', cameraOffsetY: -72, cameraZoom: 0.74 },
    ],
    fieldEvents: [
      {
        id: 'west-relay-cache',
        label: 'WEST RELAY CACHE',
        tx: 18,
        ty: 14,
        trigger: 'scan',
        reward: 'boon',
        scout: 'cameron',
        message: 'ECHO RELAY — Arc harmonics stabilized.',
        spawns: [{ tx: 17, ty: 17, type: 'graviton' }, { tx: 21, ty: 14, type: 'turret' }],
      },
      {
        id: 'east-relay-cache',
        label: 'EAST RELAY CACHE',
        tx: 63,
        ty: 14,
        trigger: 'scan',
        reward: 'weapon',
        wid: 'pulse',
        message: 'East Relay cache — Carbine pressure restored.',
        spawns: [{ tx: 60, ty: 15, type: 'warden' }, { tx: 65, ty: 17, type: 'cipher' }],
      },
      {
        id: 'west-recovery-pocket',
        label: 'WEST RECOVERY',
        tx: 24,
        ty: 42,
        radius: 56,
        trigger: 'enter',
        reward: 'health',
        message: 'Recovery pocket online.',
      },
      {
        id: 'east-recovery-pocket',
        label: 'EAST RECOVERY',
        tx: 57,
        ty: 42,
        radius: 56,
        trigger: 'enter',
        reward: 'overdrive',
        message: 'Storm pocket discharged into Overdrive.',
        spawns: [{ tx: 61, ty: 41, type: 'weaver' }],
      },
      {
        id: 'north-rift-cache',
        label: 'NORTH RIFT',
        tx: 41,
        ty: 11,
        trigger: 'scan',
        reward: 'shards',
        shards: 35,
        message: 'North Rift memory recovered: CONTACT-47 refused the first label.',
        spawns: [{ tx: 37, ty: 12, type: 'cipher' }, { tx: 45, ty: 12, type: 'cipher' }, { tx: 41, ty: 15, type: 'graviton' }],
      },
    ],
    // showcase escalation — advanced battlefield control without dumping every old enemy into the finale
    waves: [
      { label: 'PHASE 1 · CLASSIFIER CORE', spawns: [{ type: 'turret', count: 2 }, { type: 'weaver', count: 3 }], interval: 0.55, clearDelay: 1.6 },
      { label: 'PHASE 2 · WEST RELAY WING', spawns: [{ type: 'graviton', count: 1 }, { type: 'turret', count: 2 }, { type: 'weaver', count: 3 }], interval: 0.5, clearDelay: 1.6 },
      { label: 'PHASE 2 · EAST RELAY WING', spawns: [{ type: 'cipher', count: 1 }, { type: 'warden', count: 2 }, { type: 'weaver', count: 2 }], interval: 0.48, clearDelay: 1.8 },
      { label: 'PHASE 3 · NORTH RIFT', spawns: [{ type: 'graviton', count: 1 }, { type: 'cipher', count: 2 }, { type: 'turret', count: 2 }, { type: 'warden', count: 2 }], interval: 0.42, clearDelay: 2.0 },
      { label: 'FINAL PHASE · REFUSE THE LABEL', spawns: [{ type: 'warden', count: 3 }, { type: 'graviton', count: 1 }, { type: 'cipher', count: 2 }, { type: 'turret', count: 2 }, { type: 'weaver', count: 4 }], interval: 0.38, clearDelay: 2.2 },
    ],
  },
};

export const DEFAULT_ARENA = 'surface-z1';

export const SWEEP_ROUTE_BEACONS: Partial<Record<string, {
  toObjective: SweepRouteBeacon[];
  toExit: SweepRouteBeacon[];
}>> = {
  'surface-z1': {
    toObjective: [
      { tx: 13, ty: 27, label: 'OLD FENCE TRAIL' },
      { tx: 25, ty: 27, label: 'WILLOW TRAIL' },
      { tx: 39, ty: 26, label: 'CACHE GROVE' },
    ],
    toExit: [
      { tx: 43, ty: 28, label: 'EAST ROAD' },
      { tx: 52, ty: 25, label: 'ROAD BEND' },
      { tx: 70, ty: 25, label: 'BREACH ROAD' },
      { tx: 76, ty: 21, label: 'MOTEL BREACH' },
    ],
  },
  'circuit-z2': {
    toObjective: [
      { tx: 36, ty: 45, label: 'DUMPSTER CUT' },
      { tx: 31, ty: 35, label: 'CHECK-IN OFFICE' },
      { tx: 45, ty: 23, label: 'POOL COURTYARD' },
      { tx: 51, ty: 34, label: 'SCANNER CORE' },
    ],
    toExit: [
      { tx: 66, ty: 36, label: 'SERVICE LOT' },
      { tx: 73, ty: 24, label: 'RIVER RAMP' },
      { tx: 73, ty: 13, label: 'RIVER ROAD' },
      { tx: 75, ty: 11, label: 'TOWN BREACH' },
    ],
  },
  'town-z3': {
    toObjective: [
      { tx: 70, ty: 14, label: 'BRIDGE OVERLOOK' },
      { tx: 40, ty: 17, label: 'MARKET ALLEY' },
      { tx: 63, ty: 26, label: 'RIVER ROAD TOWER' },
      { tx: 51, ty: 35, label: 'TOWER LINE' },
    ],
    toExit: [
      { tx: 67, ty: 41, label: 'STADIUM ROAD' },
      { tx: 78, ty: 45, label: 'COUNTY TRAIL' },
      { tx: 83, ty: 49, label: 'ORCHARD GATE' },
    ],
  },
  'maze-z4': {
    toObjective: [
      { tx: 76, ty: 47, label: 'SCOUT SHELTER' },
      { tx: 70, ty: 28, label: 'EAST ROWS' },
      { tx: 35, ty: 35, label: 'GRAVITY WELL' },
      { tx: 50, ty: 27, label: 'CROP CIRCLE' },
    ],
    toExit: [
      { tx: 50, ty: 10, label: 'RAISED RIDGE' },
      { tx: 70, ty: 28, label: 'EAST ROWS' },
      { tx: 80, ty: 11, label: 'STORM BREACH' },
    ],
  },
};

export const SWEEP_MOTEL_SCANNERS: SweepScannerLine[] = [
  { aTx: 34.0, aTy: 44.0, bTx: 40.0, bTy: 44.0, label: 'DUMPSTER SCANNER' },
  { aTx: 13.0, aTy: 40.0, bTx: 16.0, bTy: 40.0, label: 'ENTRY SCANNER' },
  { aTx: 22.0, aTy: 23.0, bTx: 22.0, bTy: 30.0, label: 'ROOM ROW SCANNER' },
  { aTx: 41.0, aTy: 21.0, bTx: 51.0, bTy: 21.0, label: 'POOL SCANNER' },
  { aTx: 49.0, aTy: 32.0, bTx: 57.0, bTy: 32.0, label: 'SERVICE SCANNER' },
  { aTx: 72.0, aTy: 20.0, bTx: 75.0, bTy: 20.0, label: 'RIVER ROAD SCANNER' },
];

export const SWEEP_GRAVITY_WELLS: Partial<Record<string, SweepGravityWellMarker>> = {
  'maze-z4': {
    tx: 35.5,
    ty: 35.5,
    destTx: 50.5,
    destTy: 10.5,
    label: 'GRAVITY WELL\nENTER · LAUNCH TO RIDGE',
    destLabel: 'RAISED RIDGE CACHE',
  },
};
