/**
 * Level data. Levels are 16px-tile character grids ("ASCII maps") built with a
 * small deterministic builder so geometry stays exact and editable.
 *
 * Legend:
 *  '#' solid ground (grass-topped dirt)   '=' floating platform
 *  'H' hidden platform (scan reveal)      'h' hidden platform on Will's badge path
 *  'm' Will route marker (scan reveal)    'f' fence (decor)
 *  'P' player spawn                       'd' scanner drone
 *  's' fixed scanner rig (red cone)       'x' Chip's signal box
 *  'b' Will's scout badge                 'g' crop-circle door anchor
 *  'n' Blipstream Node A portal           't' radio tower (decor anchor)
 *  '-' waveform platform                  '~' oscillating waveform platform
 *  '!' static hazard bar                  'o' node switch
 *  'E' Blipstream exit gate
 */
import { TILE } from '../config';

export interface LevelMeta {
  widthPx: number;
  heightPx: number;
  /** named trigger zones in px: [x0, x1] */
  zones: Record<string, { x0: number; x1: number }>;
  arena: { leftPx: number; rightPx: number; centerX: number; surfaceY: number };
  /** Blipstream: moving red scan line sweep range + period */
  scanLine?: { x0: number; x1: number; periodMs: number };
}

export interface LevelDef {
  id: string;
  rows: string[];
  cols: number;
  rowCount: number;
  meta: LevelMeta;
}

type Grid = string[][];

const blank = (cols: number, rows: number): Grid =>
  Array.from({ length: rows }, () => Array<string>(cols).fill(' '));

const set = (g: Grid, c: number, r: number, ch: string) => {
  if (r >= 0 && r < g.length && c >= 0 && c < g[0].length) g[r][c] = ch;
};

const hrun = (g: Grid, c0: number, c1: number, r: number, ch: string) => {
  for (let c = c0; c <= c1; c++) set(g, c, r, ch);
};

/** solid ground from surface row down to the bottom of the grid */
const ground = (g: Grid, c0: number, c1: number, surface: number) => {
  for (let c = c0; c <= c1; c++) for (let r = surface; r < g.length; r++) set(g, c, r, '#');
};

const finish = (g: Grid): string[] => g.map((row) => row.join(''));

/* ================================ MILLER FIELD ============================== */

/*
 * MILLER FIELD 3.0 — vertical topology, not a horizontal strip. A serpentine
 * main path that descends, explores low, climbs, branches high, rejoins, hits a
 * landmark, then a tiered boss bowl (Sonic/Ori/Celeste SHAPE, current physics):
 *   1 spawn HIGH ridge → 2 drop DEEP into the scan-dip → scan-climb OUT →
 *   3 high meadow → 4 scanner plateau (high hop-line above the cone) →
 *   5 DROP into the tiered drone valley (a lower basin = lower route) →
 *   6 Will's TALL secret climb high above (optional, rejoins) → 7 radio ridge →
 *   8 a deep RAVINE (mid pillar + a recovery shelf; void below = death) →
 *   9 climb the NODE MOUND landmark → crop-circle door → 10 tiered BOSS BOWL
 *   (drop-in, side tiers, upper recovery) → 11 road east → glowing signal-gate.
 * RULES: every intended jump-UP ≤ 2 rows (32px < 40px apex); climbs ALTERNATE
 * columns; drops can be any depth (no fall damage landing on ground).
 */
function buildMillerField(): LevelDef {
  const COLS = 176;
  const ROWS = 40;
  const g = blank(COLS, ROWS);

  // ---- 1 SPAWN RIDGE (high) ----
  ground(g, 0, 0, 4); // tall left wall
  ground(g, 1, 14, 10);
  // ---- 2 DEEP SCAN-DIP (drop down cascading ledges; sheer east wall). Depth is
  //      tuned so ONE scan from the floor reveals the whole climb-out ladder. ----
  ground(g, 15, 18, 14); // west upper ledge
  ground(g, 19, 22, 19); // west mid ledge
  ground(g, 23, 32, 24); // dip floor — 14 rows below the spawn ridge
  // ---- 3 HIGH MEADOW (col 33 wall = the scan-climb face out of the dip) ----
  ground(g, 33, 42, 14);
  // ---- 4 SCANNER PLATEAU ----
  ground(g, 43, 58, 16);
  // ---- 5 DROP INTO DRONE LOWLANDS (tiered valley + a lower basin route) ----
  ground(g, 59, 60, 20); // step down
  ground(g, 61, 66, 26); // valley floor (west)
  ground(g, 67, 74, 30); // LOWER BASIN — a lower playable route (4 rows down)
  ground(g, 75, 82, 26); // valley floor (east)
  ground(g, 83, 90, 26); // BADGE FIELD (base of Will's climb)
  // ---- 7 terraced climb UP to RADIO RIDGE (2-row steps) ----
  ground(g, 91, 91, 24);
  ground(g, 92, 92, 22);
  ground(g, 93, 93, 20);
  ground(g, 94, 94, 18);
  ground(g, 95, 95, 16);
  ground(g, 96, 104, 14); // RADIO RIDGE
  // ---- 8 RAVINE (west lip col 104 @ r14; void 105-113; mid pillar; shelf) ----
  ground(g, 107, 112, 30); // LOWER RECOVERY SHELF (void below = death)
  ground(g, 114, 120, 18); // EAST LIP — lower than the west (forgiving landing)
  // ---- 9 NODE MOUND landmark (climb r18 → r8, generous 2-col steps) ----
  ground(g, 121, 122, 16);
  ground(g, 123, 124, 14);
  ground(g, 125, 126, 12);
  ground(g, 127, 128, 10);
  ground(g, 129, 135, 8); // MOUND TOP (Blipstream node)
  ground(g, 136, 137, 2); // DOOR HILL — sheer face (door carved below)
  // ---- 10 TIERED BOSS BOWL (drop in from the door @ r8 → floor r20) ----
  ground(g, 138, 156, 20);
  // ---- 11 ROAD EAST (bowl floor continues; no wall — ends in the gate) ----
  ground(g, 157, 175, 20);

  // carve the doorway through the hill face (rows 6-8 = mound level)
  for (const r of [6, 7, 8]) {
    set(g, 136, r, ' ');
    set(g, 137, r, ' ');
  }

  // ---- 2 DIP scan-climb: a zigzag ladder up the east wall — rungs are ADJACENT
  //      (never stacked, so no underside blocks the ascent), 2-row steps, 3 wide
  //      for landing comfort. r24 floor → r14 meadow, all revealed by one scan. ----
  hrun(g, 27, 29, 22, 'H');
  hrun(g, 30, 32, 20, 'H');
  hrun(g, 27, 29, 18, 'H');
  hrun(g, 30, 32, 16, 'H'); // → step onto the meadow (col 33, r14)

  // ---- 3 a reachable reward ledge over the meadow — holds Will's Field Note (scan it up top) ----
  // stepping stone sits WEST of Chip's box (col 36) so it doesn't crowd it; the climb is
  // meadow r14 → stone r12 → ledge r10, each hop 2 rows / 32px, inside the ~40px base jump.
  hrun(g, 33, 35, 12, '=');
  hrun(g, 37, 39, 10, '=');

  // ---- 4 SCANNER PLATEAU: a high hop-line clears the sweep (r11 over r16) ----
  hrun(g, 45, 46, 12, '=');
  hrun(g, 49, 50, 11, '=');
  hrun(g, 53, 54, 12, '=');

  // ---- 5 DRONE LOWLANDS: combat tiers + the basin climb-out step ----
  hrun(g, 63, 65, 22, '='); // west high tier
  hrun(g, 77, 79, 22, '='); // east high tier
  hrun(g, 73, 74, 28, '='); // step: basin r30 → floor r26

  // ---- 6 WILL'S TALL SECRET CLIMB (hidden until scanned) — r24 up to r6 ----
  hrun(g, 84, 85, 24, 'h');
  hrun(g, 86, 87, 22, 'h');
  hrun(g, 84, 85, 20, 'h');
  hrun(g, 86, 87, 18, 'h');
  hrun(g, 84, 85, 16, 'h');
  hrun(g, 86, 87, 14, 'h');
  hrun(g, 84, 85, 12, 'h');
  hrun(g, 86, 87, 10, 'h');
  hrun(g, 84, 85, 8, 'h');
  hrun(g, 86, 88, 6, '='); // the badge ledge, way up high
  set(g, 87, 5, 'b'); // Will's scout badge
  set(g, 88, 5, 'W'); // Will's Folded Map relic → completes WILLOW
  for (const [mc, mr] of [
    [84, 25], [86, 23], [84, 21], [86, 19], [84, 17], [86, 15], [84, 13], [86, 11], [84, 9], [87, 7],
  ] as Array<[number, number]>) set(g, mc, mr, 'm');

  // ---- 8 RAVINE: a mid crossing pillar + the recovery ladder up the shelf ----
  hrun(g, 108, 110, 16, '='); // MID PILLAR — west lip → here → east lip
  hrun(g, 110, 111, 26, '='); // recovery ladder off the shelf…
  hrun(g, 108, 109, 22, '=');
  hrun(g, 111, 112, 19, '='); // → east lip (col 114, r18)

  // ---- 10 BOSS BOWL: two side tiers + a central upper recovery platform ----
  hrun(g, 141, 143, 16, '=');
  hrun(g, 151, 153, 16, '=');
  hrun(g, 146, 148, 13, '=');

  // ---- entities & props ----
  set(g, 4, 9, 'P'); // spawn ABOVE the ridge surface (r10) — never carve the floor
  set(g, 9, 9, 'f'); // above the ridge surface (r10) — never carve the floor
  set(g, 36, 13, 'x'); // Chip's SPARK signal box (badge+log tease; Power Cell in Motel)
  set(g, 41, 13, 'f');
  set(g, 50, 15, 's'); // scanner rig, mid-plateau
  set(g, 72, 28, 'd'); // LOW drone (west, down in the basin pit)
  set(g, 80, 23, 'd'); // HIGH drone (east, up by the tier) — both aggro the east floor
  set(g, 100, 13, 't'); // radio tower on the ridge
  set(g, 103, 13, 'f'); // warning post at the ravine's west lip
  set(g, 132, 7, 'n'); // Blipstream Node A on the mound top
  set(g, 136, 7, 'g'); // crop-circle door anchor (fills the carved doorway)
  set(g, 163, 19, 'f');
  set(g, 170, 19, 'f');

  return {
    id: 'miller-field',
    rows: finish(g),
    cols: COLS,
    rowCount: ROWS,
    meta: {
      widthPx: COLS * TILE,
      heightPx: ROWS * TILE,
      zones: {
        scanTutorial: { x0: 23 * TILE, x1: 31 * TILE },
        avoidCone: { x0: 44 * TILE, x1: 58 * TILE },
        droneField: { x0: 61 * TILE, x1: 82 * TILE },
        oddGrass: { x0: 83 * TILE, x1: 90 * TILE },
        reachDoor: { x0: 129 * TILE, x1: 136 * TILE },
        // trigger sits PAST the left arena wall (col 138) so the seal can never
        // spawn between the player and the fight
        bossTrigger: { x0: 140 * TILE, x1: 146 * TILE },
      },
      arena: { leftPx: 138 * TILE, rightPx: 156 * TILE, centerX: 147 * TILE, surfaceY: 20 * TILE },
    },
  };
}

/* ============================= BLIPSTREAM NODE A ============================ */

function buildNodeA(): LevelDef {
  const COLS = 80;
  const ROWS = 17;
  const g = blank(COLS, ROWS);

  // waveform platform runs
  hrun(g, 1, 8, 12, '-'); // entry shelf
  hrun(g, 11, 17, 11, '-'); // node 1 shelf
  hrun(g, 19, 24, 12, '-'); // scan-line corridor
  hrun(g, 27, 38, 12, '-'); // hazard run
  hrun(g, 52, 58, 10, '-'); // node 3 shelf
  hrun(g, 62, 66, 11, '-'); // descent shelf
  hrun(g, 70, 78, 12, '-'); // exit run

  // oscillating platforms bridge the mid gap
  set(g, 42, 11, '~');
  set(g, 47, 9, '~');

  // red static hazards (sit on top of runs — jump/hover over)
  hrun(g, 31, 34, 11, '!');
  hrun(g, 54, 55, 9, '!');

  // node switches (shoot to activate)
  set(g, 14, 10, 'o');
  set(g, 36, 10, 'o');
  set(g, 56, 8, 'o');

  set(g, 75, 10, 'E'); // exit gate
  set(g, 3, 11, 'P'); // spawn

  return {
    id: 'node-a',
    rows: finish(g),
    cols: COLS,
    rowCount: ROWS,
    meta: {
      widthPx: COLS * TILE,
      heightPx: ROWS * TILE,
      zones: {},
      arena: { leftPx: 0, rightPx: 0, centerX: 0, surfaceY: 0 },
      scanLine: { x0: 19 * TILE, x1: 26 * TILE, periodMs: 3400 },
    },
  };
}

/* ============================== MOTEL NOWHERE =============================== */
/*
 * Zone 2 legend (interpreted by MotelScene):
 *  '#' wet-asphalt ground / building block   '=' always-solid ledge (walkways/roof)
 *  'P' player spawn                          'p' reflective puddle (decor)
 *  'A' neon platform — circuit group A       '1' power switch → toggles group A
 *  'B' neon platform — group B (dead wing)   '3' power switch → toggles group C
 *  'C' neon platform — circuit group C       'L' security lamp (sweeping cone)
 *  'F' fuse box (Blipstream circuit)         'V' The Vacancy Sign (boss anchor)
 *  'c' Chip's SPARK badge                    'K' Chip's Power Cell relic
 *  'x' Chip's signal box (recharge)          'D' diner window (bloom decor)
 *  'I' ice machine (decor)                   'M' motel arrow sign (decor)
 * Group B is dark/gone until Chip's circuit is routed (motelWingPowered).
 */
function buildMotelNowhere(): LevelDef {
  const COLS = 96;
  const ROWS = 22;
  const g = blank(COLS, ROWS);

  // --- terrain ---
  ground(g, 0, 0, 4); // left wall
  ground(g, 1, 39, 18); // wet parking lot
  ground(g, 40, 58, 13); // the diner block (raised — reach the roof via neon)
  ground(g, 59, 95, 18); // motel row base
  ground(g, 95, 95, 4); // right wall

  // --- BEAT 1: parking lot props ---
  set(g, 4, 17, 'P'); // spawn
  set(g, 8, 17, 'p');
  set(g, 18, 17, 'p');
  set(g, 24, 17, 'p');
  set(g, 12, 17, 'L'); // security lamp post
  set(g, 26, 17, 'L'); // security lamp post
  set(g, 33, 17, 'I'); // ice machine

  // --- BEAT 2: power the diner → group A staircase up to the roof ---
  set(g, 28, 17, '1'); // power switch (group A)
  hrun(g, 30, 31, 16, 'A');
  hrun(g, 33, 34, 15, 'A');
  hrun(g, 36, 37, 14, 'A'); // steps onto diner roof (row 13 top)
  set(g, 44, 12, 'D'); // diner window
  set(g, 43, 12, 'x'); // Chip's signal box (recharge near it)
  set(g, 50, 12, 'F'); // fuse box — jack into Chip's circuit

  // --- group C side-route (switch 3) up to Chip's SPARK badge ---
  set(g, 46, 12, '3'); // power switch (group C)
  hrun(g, 52, 53, 11, 'C');
  hrun(g, 55, 56, 9, 'C');
  hrun(g, 57, 58, 7, '='); // badge ledge (always solid once you're up)
  set(g, 58, 6, 'c'); // Chip's SPARK badge

  // --- BEAT 3: the dead motel wing — group B, lit only by the circuit ---
  set(g, 70, 17, 'M'); // motel arrow sign (decor)
  hrun(g, 62, 63, 16, 'B');
  hrun(g, 65, 66, 14, 'B');
  hrun(g, 68, 69, 12, 'B');
  hrun(g, 71, 72, 10, 'B');
  hrun(g, 74, 75, 8, 'B'); // steps up to the boss arena walkway
  hrun(g, 76, 90, 7, '='); // top walkway / boss arena floor
  set(g, 82, 6, 'V'); // The Vacancy Sign (boss)
  set(g, 88, 6, 'K'); // Chip's Power Cell relic (arena reward)

  return {
    id: 'motel-nowhere',
    rows: finish(g),
    cols: COLS,
    rowCount: ROWS,
    meta: {
      widthPx: COLS * TILE,
      heightPx: ROWS * TILE,
      zones: {
        crossLot: { x0: 8 * TILE, x1: 26 * TILE },
        powerDiner: { x0: 27 * TILE, x1: 35 * TILE },
        findFuse: { x0: 48 * TILE, x1: 52 * TILE },
        climbWing: { x0: 60 * TILE, x1: 67 * TILE },
        // trigger only once the player is on the arena walkway (col 76), PAST the
        // left arena wall (col 75) — otherwise the wall can spawn between the
        // player and the fight and wall them out.
        bossTrigger: { x0: 76 * TILE, x1: 82 * TILE },
      },
      arena: { leftPx: 75 * TILE, rightPx: 91 * TILE, centerX: 83 * TILE, surfaceY: 7 * TILE },
    },
  };
}

/* ========================== CHAGRIN FALLS HIGH (Z3) ======================== */
/*
 * Zone 3 legend (interpreted by StadiumScene):
 *  '#' turf / structure ground              '=' bleacher step / catwalk / arena tier
 *  'P' player spawn                         'T' light tower (rotating detection cone)
 *  'S' scoreboard landmark (KNOWN/UNKNOWN)  'G' Henry ANCHOR safe zone (declassify+heal)
 *  'n' rec-pool dive node (→ underwater)    'B' Weather Balloon boss anchor
 *  'b' Henry / ANCHOR badge                 'V' Signal Flare relic (top-bleacher route)
 *  'k' hidden locker cache                  'r' Tiger banner (decor)   'f' fence (decor)
 *
 * SHAPE (not a flat strip): gates/track (low) → light-cone stealth lane → a sunken
 * DUGOUT dip (safe zone + badge + hidden cache) → an optional BLEACHER climb high to
 * the press box (Signal Flare relic) → scoreboard landmark → a deep REC-POOL basin
 * (dive node) → surface/rejoin → a tiered WEATHER BALLOON arena → road east.
 * Rules honored: jump-UP ≤ 2 rows; climbs alternate/stagger columns; drops land on
 * ground (basin floor is solid, no death pit inside the pool); bossTrigger sits PAST
 * the left arena wall so the seal can't trap the player.
 */
function buildTigerStadium(): LevelDef {
  const COLS = 200;
  const ROWS = 44;
  const FS = 30; // field/track surface row
  const g = blank(COLS, ROWS);

  // ---- base ground line ----
  ground(g, 0, 0, 4); // left wall
  ground(g, 1, 54, FS); // 1 gates + 2 light-cone track lane
  ground(g, 55, 77, FS + 4); // 3a sunken DUGOUT bowl (row 34) — drop in from the west lip
  ground(g, 78, 120, FS); // bleacher base + scoreboard + concession + pool west lip
  ground(g, 121, 150, FS + 10); // 6 REC-POOL basin floor (row 40; solid — no death pit)
  ground(g, 151, 199, FS); // 8 surface rejoin + 9 boss arena floor + 10 road east
  ground(g, 199, 199, 4); // right wall

  // dugout climb-out (r34 → field r30): a bridging step
  hrun(g, 76, 77, FS + 2, '='); // row 32

  // pool descent ledges (break the plunge) + east climb-out back to the field
  hrun(g, 122, 124, FS + 4, '='); // 34
  hrun(g, 126, 128, FS + 7, '='); // 37
  hrun(g, 143, 144, FS + 8, '='); // 38 — climb-out
  hrun(g, 145, 146, FS + 6, '='); // 36
  hrun(g, 147, 148, FS + 4, '='); // 34
  hrun(g, 149, 150, FS + 2, '='); // 32

  // ---- 3b BLEACHER CLIMB (optional upper route → press box + Signal Flare relic) ----
  hrun(g, 80, 81, 28, '=');
  hrun(g, 82, 83, 26, '=');
  hrun(g, 84, 85, 24, '=');
  hrun(g, 86, 87, 22, '=');
  hrun(g, 88, 89, 20, '=');
  hrun(g, 90, 91, 18, '=');
  hrun(g, 92, 93, 16, '=');
  hrun(g, 94, 95, 14, '=');
  hrun(g, 96, 106, 12, '='); // press-box catwalk (top route)
  hrun(g, 107, 113, 12, '='); // catwalk continues → drop east to the field

  // ---- 9 BOSS ARENA tiers (two side tiers + one upper recovery platform) ----
  hrun(g, 156, 158, 26, '=');
  hrun(g, 184, 186, 26, '=');
  hrun(g, 169, 173, 22, '=');

  // ---- entities & props ----
  set(g, 4, FS, 'P'); // spawn at the gates
  set(g, 8, FS - 1, 'r'); // Tiger banner
  set(g, 16, FS, 'T'); // intro light tower
  set(g, 26, FS, 'G'); // END ZONE safe zone (teaches the safe-zone idea)
  set(g, 30, FS, 'T');
  set(g, 40, FS, 'T');
  set(g, 50, FS, 'T');
  set(g, 52, 6, 'S'); // SCOREBOARD landmark (the KNOWN/UNKNOWN meter)
  // dugout contents (bowl floor r34)
  set(g, 60, FS + 3, 'b'); // Henry / ANCHOR badge
  set(g, 64, FS + 4, 'G'); // dugout safe zone
  set(g, 72, FS + 3, 'k'); // hidden locker cache
  // bleachers / under-stands / press box
  set(g, 88, FS, 'G'); // under-the-bleachers safe zone
  set(g, 102, 11, 'V'); // Signal Flare relic (reward of the top route)
  set(g, 104, 6, 'r'); // banner high on the press box
  // pool approach + rejoin
  set(g, 112, FS, 'T'); // late light tower near the pool approach
  set(g, 116, FS, 'G'); // concession safe zone
  set(g, 133, FS + 9, 'n'); // REC-POOL DIVE NODE (row 39, in the basin)
  set(g, 152, FS, 'G'); // surface / rejoin safe zone (regroup before the boss)
  // boss arena + road
  set(g, 160, FS - 1, 'r'); // banner
  set(g, 171, FS, 'B'); // Weather Balloon anchor (boss spawns on trigger)
  set(g, 195, FS - 1, 'f'); // road-east fence — one row ABOVE the surface so its feet rest on the track (not sunk into it)

  return {
    id: 'tiger-stadium',
    rows: finish(g),
    cols: COLS,
    rowCount: ROWS,
    meta: {
      widthPx: COLS * TILE,
      heightPx: ROWS * TILE,
      zones: {
        gates: { x0: 2 * TILE, x1: 10 * TILE },
        lightsGauntlet: { x0: 25 * TILE, x1: 52 * TILE },
        dugout: { x0: 55 * TILE, x1: 76 * TILE },
        bleachers: { x0: 80 * TILE, x1: 106 * TILE },
        poolDive: { x0: 125 * TILE, x1: 142 * TILE },
        rejoin: { x0: 148 * TILE, x1: 153 * TILE },
        // trigger sits PAST the left arena wall (col 154) so the seal never traps you
        bossTrigger: { x0: 156 * TILE, x1: 162 * TILE },
        exit: { x0: 190 * TILE, x1: 198 * TILE },
      },
      arena: { leftPx: 154 * TILE, rightPx: 188 * TILE, centerX: 171 * TILE, surfaceY: FS * TILE },
    },
  };
}

/* ===================== POOL MIRROR — Z3 underwater node ==================== */
/*
 * The rec-pool reflection dive: a cool, low-gravity mirror route (UnderwaterScene
 * flips physics + tint + a delayed reflection echo). Short & readable per the
 * blipstream-puzzle skill — route three sync nodes, then rise through the surface
 * gate. '-' water platform · '~' drifting platform · '!' slow static · 'o' sync
 * node · 'E' surface gate · 'P' dive-in spawn.
 */
function buildPoolMirror(): LevelDef {
  const COLS = 84;
  const ROWS = 24;
  const g = blank(COLS, ROWS);

  hrun(g, 2, 9, 14, '-'); // dive-in shelf
  hrun(g, 12, 18, 12, '-'); // node 1 shelf
  hrun(g, 22, 28, 14, '-'); // drift approach
  hrun(g, 33, 40, 12, '-'); // node 2 shelf
  hrun(g, 44, 50, 14, '-'); // mid run
  hrun(g, 54, 61, 11, '-'); // node 3 shelf
  hrun(g, 65, 72, 13, '-'); // descent
  hrun(g, 75, 82, 12, '-'); // surface-gate run

  // drifting platforms bridge the gaps (slow underwater bob)
  set(g, 30, 13, '~');
  set(g, 52, 12, '~');
  set(g, 63, 12, '~');

  // slow static hazards — float over them
  hrun(g, 25, 27, 13, '!');
  hrun(g, 46, 48, 13, '!');

  // three sync nodes (shoot to route; your reflection echoes your moves)
  set(g, 15, 11, 'o');
  set(g, 36, 11, 'o');
  set(g, 57, 10, 'o');

  set(g, 79, 11, 'E'); // SURFACE gate
  set(g, 4, 13, 'P'); // dive-in spawn

  return {
    id: 'pool-mirror',
    rows: finish(g),
    cols: COLS,
    rowCount: ROWS,
    meta: {
      widthPx: COLS * TILE,
      heightPx: ROWS * TILE,
      zones: {},
      arena: { leftPx: 0, rightPx: 0, centerX: 0, surfaceY: 0 },
      scanLine: { x0: 20 * TILE, x1: 30 * TILE, periodMs: 3800 },
    },
  };
}

/* ========================= PATTERSON'S ORCHARD (Z4) ======================= */
/*
 * Zone 4 legend (interpreted by OrchardScene):
 *  '#' orchard ground (soil + grass)        '=' branch / plank ledge
 *  '%' respawning fruit platform            'Y' apple-tree pillar (decor)
 *  'Q' corn-maze wall — phase A             'W' corn-maze wall — phase B
 *  'R' white barn + green roof (landmark)   'L' hanging orchard light (decor)
 *  'h' hidden platform (scan reveal)        'f' hay bale / signpost (decor)
 *  'c' Cameron/ECHO badge (grants log too)  'K' Tuning Fork relic (maze heart)
 *  'F' Fold mouth → top-down maze-z4        'g' crop-circle gate (opens after the Fold)
 *  'V' The Harvest Pattern (boss anchor)
 *
 * SHAPE: farm road → a TALL apple-tree pillar climb (branch ledges + respawning
 * fruit, 2-row steps, alternating columns) → the white barn + a hidden LOFT
 * (Cameron badge) → back down to the corn-maze approach whose walls shift on a
 * readable beat → the Fold mouth (into the top-down maze) → after the crop circle
 * blooms, the gate opens → maze heart (Tuning Fork) → tiered Harvest Pattern
 * arena → county-road exit. "THE MAZE THINKS."
 */
function buildPattersonsOrchard(): LevelDef {
  const COLS = 150;
  const ROWS = 50;
  const FS = 44; // orchard floor surface row
  const g = blank(COLS, ROWS);

  // ---- base: a forgiving orchard floor (a missed climb just drops you to retry) ----
  ground(g, 0, 0, 4); // left wall
  ground(g, 1, 148, FS);
  ground(g, 149, 149, 4); // right wall

  // ---- APPLE-TREE PILLAR CLIMB (row 42 → 14, 2-row steps, alternating cols) ----
  hrun(g, 15, 17, 42, '=');
  hrun(g, 20, 22, 40, '%');
  hrun(g, 15, 17, 38, '=');
  hrun(g, 20, 22, 36, '%');
  hrun(g, 15, 17, 34, '=');
  hrun(g, 20, 22, 32, '%');
  hrun(g, 15, 17, 30, '=');
  hrun(g, 20, 22, 28, '%');
  hrun(g, 15, 17, 26, '=');
  hrun(g, 20, 22, 24, '%');
  hrun(g, 15, 17, 22, '=');
  hrun(g, 20, 22, 20, '%');
  hrun(g, 15, 17, 18, '=');
  hrun(g, 20, 22, 16, '%');
  hrun(g, 22, 24, 14, '='); // step onto the barn level

  // ---- BARN LANDMARK + hidden LOFT (Cameron badge) ----
  hrun(g, 24, 46, 14, '='); // barn-level platform
  set(g, 35, 13, 'R'); // the white barn + green metal roof (drawn above)
  hrun(g, 30, 31, 12, 'h'); // loft climb (hidden until scanned)
  hrun(g, 33, 34, 10, 'h');
  hrun(g, 36, 37, 8, 'h'); // loft ledge
  set(g, 37, 7, 'c'); // Cameron / ECHO badge (+ its log) up in the loft

  // ---- descend back to the orchard floor (optional catch ledges) ----
  hrun(g, 47, 48, 20, '=');
  hrun(g, 49, 50, 28, '=');
  hrun(g, 51, 52, 36, '=');

  // ---- CORN-MAZE APPROACH: walls shift on a readable beat (Q=phase A, W=phase B) ----
  for (let r = 36; r <= 43; r++) {
    for (const c of [61, 66, 71, 76, 81, 86]) set(g, c, r, 'Q');
    for (const c of [63, 68, 73, 78, 83]) set(g, c, r, 'W');
  }

  // ---- the Fold mouth (into the top-down maze) then the crop-circle gate ----
  set(g, 90, 43, 'F'); // enter the top-down maze-z4 here
  set(g, 95, 43, 'g'); // crop-circle gate — sealed until the Fold blooms the circle

  // ---- MAZE HEART (Tuning Fork relic) ----
  set(g, 102, 43, 'K'); // the Tuning Fork relic

  // ---- HARVEST PATTERN arena (tiers) + boss ----
  hrun(g, 114, 116, 40, '=');
  hrun(g, 128, 130, 40, '=');
  hrun(g, 120, 124, 37, '=');
  set(g, 122, 43, 'V'); // Harvest Pattern boss anchor (spawns on trigger)

  // ---- decor: apple trees, hanging orchard lights, hay/signposts ----
  for (const [c, r] of [[12, 43], [25, 43], [55, 43], [58, 43]] as Array<[number, number]>) set(g, c, r, 'Y');
  for (const [c, r] of [[8, 40], [30, 40], [56, 38], [100, 40], [140, 40]] as Array<[number, number]>) set(g, c, r, 'L');
  for (const [c, r] of [[18, 43], [50, 43], [144, 43]] as Array<[number, number]>) set(g, c, r, 'f');

  // ---- hidden CIDER CELLAR — a pocket under the road (drop in, grab the cache) ----
  for (let r = 45; r <= 48; r++) for (let c = 26; c <= 33; c++) set(g, c, r, ' ');
  set(g, 26, 44, ' ');
  set(g, 27, 44, ' '); // 2-wide entrance hole in the road
  set(g, 29, 48, 'k'); // cider-cellar cache (Signal Shards)
  hrun(g, 30, 31, 47, '='); // climb-out steps back up to the road
  hrun(g, 32, 33, 45, '=');
  set(g, 28, 47, 'L'); // a cellar lantern (decor)

  set(g, 4, 43, 'P'); // spawn on the farm road

  return {
    id: 'pattersons-orchard',
    rows: finish(g),
    cols: COLS,
    rowCount: ROWS,
    meta: {
      widthPx: COLS * TILE,
      heightPx: ROWS * TILE,
      zones: {
        climb: { x0: 14 * TILE, x1: 26 * TILE },
        mazeApproach: { x0: 60 * TILE, x1: 88 * TILE },
        foldMouth: { x0: 89 * TILE, x1: 92 * TILE },
        mazeHeart: { x0: 96 * TILE, x1: 108 * TILE },
        // trigger sits PAST the left arena wall (col 110) so the seal can't trap you
        bossTrigger: { x0: 112 * TILE, x1: 118 * TILE },
        exit: { x0: 140 * TILE, x1: 147 * TILE },
      },
      arena: { leftPx: 110 * TILE, rightPx: 134 * TILE, centerX: 122 * TILE, surfaceY: FS * TILE },
    },
  };
}

/* ============================ SKYLINE ARRAY (Z5) ========================== */
/*
 * Zone 5 = THE FINALE (interpreted by SkylineArrayScene). A mostly-VERTICAL
 * storm-surf ascent: ride updrafts up antenna spires, dodge a telegraphed
 * lightning clock, dash through gates; the storm sea below is the fail state.
 *  '#' tower steel / wall (full solid)      '=' catwalk (one-way top platform)
 *  '^' updraft shaft cell (lifts you up)    '*' lightning strike column
 *  'R' ROCKET dash-gate (dash-through only) 'S' storm-sea crest (visual)
 *  'P' spawn (launch deck)                  'V' Listening Station boss anchor
 *  'X' sky-breach exit                      'b' Danny/ROCKET badge (+log)
 *  'K' Danny relic (Cracked Goggles)        'k' Signal Shard cache
 */
function buildSkylineArray(): LevelDef {
  const COLS = 56;
  const ROWS = 112;
  const g = blank(COLS, ROWS);

  // full-height storm-tower frame walls (keep the climb contained)
  ground(g, 2, 2, 0);
  ground(g, 53, 53, 0);

  // launch deck + spawn (near the bottom)
  hrun(g, 4, 26, 100, '=');
  set(g, 7, 99, 'P');
  set(g, 22, 99, 'b'); // Danny / ROCKET scout badge (+ log) — sits on the launch deck

  // storm-sea crest marker (the lethal floor lives just below the deck)
  hrun(g, 3, 52, 108, 'S');

  // --- Rung 1: JUMP off the deck into the updraft (cols 13-16); it centers you and
  // rides you straight up, cresting just above the WIDE mid catwalk (cols 8-46,
  // spans the shaft) so you drop right onto it — no precise steering needed.
  for (let c = 13; c <= 16; c++) for (let r = 39; r <= 99; r++) set(g, c, r, '^');
  hrun(g, 8, 46, 38, '='); // mid catwalk — spans the shaft + runs across to shaft 2
  set(g, 12, 37, 'K'); // Danny's relic — the Cracked Goggles (west end of the catwalk)
  set(g, 44, 37, 'k'); // Signal Shard salvage cache (east end of the catwalk)
  for (let r = 34; r <= 37; r++) set(g, 24, r, '*'); // lightning over the catwalk
  for (let r = 34; r <= 37; r++) set(g, 32, r, 'R'); // ROCKET dash-gate on the catwalk

  // --- Rung 2: jump into the second updraft (cols 34-37) -> crests onto the summit ---
  for (let c = 34; c <= 37; c++) for (let r = 13; r <= 37; r++) set(g, c, r, '^');
  hrun(g, 18, 46, 12, '='); // summit / boss-arena floor — spans shaft 2

  set(g, 40, 11, 'V'); // The Listening Station (boss anchor, on the summit)
  set(g, 22, 11, 'X'); // sky-breach exit

  return {
    id: 'skyline-array',
    rows: finish(g),
    cols: COLS,
    rowCount: ROWS,
    meta: {
      widthPx: COLS * TILE,
      heightPx: ROWS * TILE,
      zones: {
        launch: { x0: 4 * TILE, x1: 24 * TILE },
        summit: { x0: 20 * TILE, x1: 46 * TILE },
      },
      arena: { leftPx: 19 * TILE, rightPx: 47 * TILE, centerX: 33 * TILE, surfaceY: 12 * TILE },
    },
  };
}

export const MILLER_FIELD: LevelDef = buildMillerField();
export const NODE_A: LevelDef = buildNodeA();
export const MOTEL_NOWHERE: LevelDef = buildMotelNowhere();
export const TIGER_STADIUM: LevelDef = buildTigerStadium();
export const POOL_MIRROR: LevelDef = buildPoolMirror();
export const PATTERSONS_ORCHARD: LevelDef = buildPattersonsOrchard();
export const SKYLINE_ARRAY: LevelDef = buildSkylineArray();

/** iterate every non-space cell; (x, y) is the CELL CENTER in px */
export function walkLevel(
  def: LevelDef,
  cb: (ch: string, col: number, row: number, x: number, y: number) => void
): void {
  def.rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch !== ' ') cb(ch, c, r, c * TILE + TILE / 2, r * TILE + TILE / 2);
    }
  });
}

/** what character sits at (col,row), ' ' when out of bounds */
export function cellAt(def: LevelDef, col: number, row: number): string {
  return def.rows[row]?.[col] ?? ' ';
}
