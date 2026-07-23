import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs', 'map-schematics');
const ARENA_FILE = path.join(ROOT, 'src', 'game', 'data', 'sweepArenas.ts');
const README_FILE = path.join(ROOT, 'MAP_SCHEMATICS.md');

const LOCATION_NOTES = {
  'surface-z1': [
    ['Spawn Clearing', 10, 41, 'Start point, low-pressure read of the field.'],
    ['Field Track', 21, 41, 'Main readable road east from spawn.'],
    ['Willow Trail', 35, 38, 'Turn north toward the cache objective hub.'],
    ['Willow Cache Grove', 39, 26, 'Main objective / first Scout-cache beat.'],
    ['Old Mill Spur', 12, 12, 'Hidden Scout log plus a worthwhile cache off the low-pressure main route.'],
    ['Substation Overlook', 62, 10, 'Simple power puzzle beat that feeds the East Road shortcut.'],
    ['Power Gate Shortcut', 66, 30, 'Simple substation-power shortcut back toward East Road.'],
    ['East Road', 52, 25, 'Main route after the objective opens.'],
    ['Motel Bend', 67, 37, 'Lower route / recovery lane toward Motel.'],
    ['Lower-Lane Washout', 52, 45, 'First Boost-only cracked crossing on the lower shortcut lane.'],
    ['Scout Shelter Pocket', 76, 42, 'Best optional cache/reward pocket in Miller.'],
    ['Old Mill Crack', 12, 19, 'Optional Boost crossing on the hidden old-mill spur.'],
    ['Motel Breach', 76, 21, 'Only actual transition into Motel Circuit.'],
  ],
  'circuit-z2': [
    ['Motel Entry', 10, 44, 'Spawn from Miller on the roadside shoulder.'],
    ['Safe Shadow', 18, 35, 'Main stealth read in the parking lot.'],
    ['Check-In Office', 31, 35, 'Fallback combat route if stealth breaks.'],
    ['Room Row', 24, 15, 'Optional upper stealth branch with cache pressure.'],
    ['Pool Courtyard', 45, 23, 'Boost scanner crossing and breathing space.'],
    ['Scanner Core', 51, 34, 'Main infiltration objective: disable the scanner grid.'],
    ['Service Lot', 66, 36, 'Combat fallback and return loop.'],
    ['Motel Sign Ledge', 60, 15, 'Hidden overlook and reward pocket above the motel route.'],
    ['Dumpster Alcove', 36, 45, 'Small recovery pocket off the fallback route.'],
    ['Drainage Shortcut', 74, 46, 'Behind-the-lot loop back into the Service Lot.'],
    ['River Road', 73, 13, 'Exit approach toward Chagrin Falls.'],
    ['Town Breach', 75, 11, 'Transition into Chagrin Falls Town.'],
  ],
  'town-z3': [
    ['Town Entry', 10, 43, 'Spawn from Motel on the west road.'],
    ['Main Street', 25, 42, 'Primary storefront route and cover lane.'],
    ['Neighborhood Block', 18, 19, 'Optional upper approach through houses/alleys.'],
    ['Market Alley', 40, 17, 'Northern route toward the bridge and tower flank.'],
    ['River Road Tower', 51, 35, 'Main hostile-structure objective.'],
    ['Bridge Overlook', 71, 14, 'Chagrin Falls landmark / upper approach.'],
    ['River Walk', 45, 48, 'Lower shortcut and hidden cache path.'],
    ['Broken Bridge Pocket', 59, 50, 'Recovery bend on the lower route.'],
    ['Stadium Back Alley', 72, 50, 'Return loop behind Stadium Road toward Orchard Gate.'],
    ['Stadium Road', 67, 41, 'Expanded exit approach and combat recovery space.'],
    ['Orchard Gate', 83, 49, 'Transition toward Patterson’s Orchard.'],
  ],
  'maze-z4': [
    ['Orchard Entry', 10, 51, 'Spawn from Town on the tractor lane.'],
    ['West Rows', 12, 29, 'Recall Disc-focused lane with a Scout-cache reward.'],
    ['Lower Rows', 29, 50, 'Weapon pickup / combat route.'],
    ['Gravity Well', 35, 35, 'Traversal launcher to raised ridge.'],
    ['Lower Creek', 27, 16, 'Optional puzzle/secret pocket.'],
    ['Crop Circle', 50, 27, 'Maze Heart objective hub.'],
    ['Raised Ridge Cache', 50, 10, 'Gravity Well destination and Arc pickup.'],
    ['East Rows', 70, 28, 'Pressure lane toward the storm ridge.'],
    ['Scout Shelter', 76, 47, 'Hidden shelter / reward pocket.'],
    ['Pump Station Return Switch', 62, 46, 'Return-loop pocket connecting the shelter back to East Rows.'],
    ['Storm-Fence Shortcut', 80, 34, 'Ridge-side shortcut that loops between Scout Shelter and Storm Breach.'],
    ['Storm Breach', 80, 11, 'Transition into Signal Storm.'],
  ],
  'anomaly-01': [
    ['Storm Entry', 41, 47, 'Spawn from Orchard in a recovery lane.'],
    ['Classifier Core', 41, 29, 'Final survival/objective focus.'],
    ['West Pressure Pocket', 16, 30, 'Wave flank and cover break.'],
    ['East Pressure Pocket', 67, 30, 'Wave flank and cover break.'],
    ['North Rift', 41, 11, 'Future boss-stage anchor.'],
    ['West Relay Wing', 18, 14, 'Phase-two relay target with optional cache pressure.'],
    ['East Relay Wing', 63, 14, 'Phase-two relay target with optional cache pressure.'],
    ['West Classifier Coil', 36, 20, 'Phase-one side pocket around the central core.'],
    ['East Classifier Coil', 46, 20, 'Phase-one side pocket around the central core.'],
    ['Recovery Pockets', 29, 42, 'Southwest/southeast/far-side breathing areas between phases.'],
  ],
};

const REGION_SUMMARY = {
  'surface-z1': 'Miller is the schematic template: readable main road, objective grove, optional old-mill/substation/shelter branches, power-gate shortcut, and one far-east Motel breach.',
  'circuit-z2': 'Motel is now a stealth/infiltration graph with scanner route, upper room-row branch, hidden maintenance path, service-lot fallback, drainage loop and River Road exit.',
  'town-z3': 'Town is now a street/cover connector with Main Street, neighborhood/market upper approach, bridge overlook, river-walk shortcut, stadium back alley and Orchard Gate.',
  'maze-z4': 'Orchard is now a traversal/puzzle graph with Gravity Well gate, raised ridge, lower creek secret, Scout shelter loop, pump-station return and storm-ridge exit.',
  'anomaly-01': 'Signal Storm is now a staged finale arena with Classifier Core, relay wings, coil pockets, north rift, pressure pockets and real recovery pockets instead of anonymous waves.',
};

const COLORS = {
  bg: '#101820',
  grid: '#20313a',
  room: '#2f564b',
  hall: '#466f61',
  marker: '#9dff57',
  exit: '#67d8ff',
  cache: '#ffd166',
  enemy: '#ff5d73',
  weapon: '#b86dff',
  event: '#ffb84d',
  boostGap: '#ff4d5e',
  note: '#f5efe0',
  text: '#e8f5de',
  wall: '#18252c',
};

function extractExportedObject(src, exportName, stopBefore) {
  const start = src.indexOf(`export const ${exportName}`);
  if (start < 0) throw new Error(`Missing export ${exportName}`);
  const eq = src.indexOf('=', start);
  const open = src.indexOf('{', eq);
  const end = src.indexOf(stopBefore, open);
  if (end < 0) throw new Error(`Could not find end marker for ${exportName}`);
  return vm.runInNewContext(`(${src.slice(open, end + 1)})`);
}

function extractExportedArray(src, exportName) {
  const start = src.indexOf(`export const ${exportName}`);
  if (start < 0) throw new Error(`Missing export ${exportName}`);
  const eq = src.indexOf('=', start);
  const open = src.indexOf('[', eq);
  const end = src.indexOf('];', open);
  if (end < 0) throw new Error(`Could not find array end for ${exportName}`);
  return vm.runInNewContext(`(${src.slice(open, end + 1)})`);
}

function extractData() {
  const src = fs.readFileSync(ARENA_FILE, 'utf8');
  return {
    arenas: extractExportedObject(src, 'SWEEP_ARENAS', '};\n\nexport const DEFAULT_ARENA'),
    routeBeacons: extractExportedObject(src, 'SWEEP_ROUTE_BEACONS', '};'),
    motelScanners: extractExportedArray(src, 'SWEEP_MOTEL_SCANNERS'),
    gravityWells: extractExportedObject(src, 'SWEEP_GRAVITY_WELLS', '};'),
  };
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildWalkable(arena) {
  const walk = Array.from({ length: arena.grid.h }, () => Array(arena.grid.w).fill(false));
  const carve = (rect) => {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (walk[y]?.[x] !== undefined) walk[y][x] = true;
      }
    }
  };
  arena.rooms.forEach(carve);
  arena.halls.forEach(carve);
  return walk;
}

function rectSvg(rect, tile, offsetX, offsetY, fill, opacity = 1) {
  return `<rect x="${offsetX + rect.x * tile}" y="${offsetY + rect.y * tile}" width="${rect.w * tile}" height="${rect.h * tile}" fill="${fill}" opacity="${opacity}" rx="2" />`;
}

function markerSvg(marker, tile, offsetX, offsetY, color, label, shape = 'circle') {
  const x = offsetX + (marker.tx + 0.5) * tile;
  const y = offsetY + (marker.ty + 0.5) * tile;
  const mark = shape === 'diamond'
    ? `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${color}" transform="rotate(45 ${x} ${y})" />`
    : `<circle cx="${x}" cy="${y}" r="5" fill="${color}" />`;
  return `${mark}<text x="${x + 7}" y="${y - 7}" font-size="10" fill="${COLORS.text}" font-family="monospace">${esc(label)}</text>`;
}

function eventLabel(event) {
  const reward = event.reward ? ` ${String(event.reward).toUpperCase()}` : '';
  return `${String(event.label ?? event.id).toUpperCase()}${reward}`;
}

function scannerSvg(scanner, tile, offsetX, offsetY) {
  const ax = offsetX + (scanner.aTx + 0.5) * tile;
  const ay = offsetY + (scanner.aTy + 0.5) * tile;
  const bx = offsetX + (scanner.bTx + 0.5) * tile;
  const by = offsetY + (scanner.bTy + 0.5) * tile;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#ff4d5e" stroke-width="4" opacity="0.84" />
<circle cx="${ax}" cy="${ay}" r="5" fill="#ff4d5e" />
<text x="${mx + 7}" y="${my - 7}" font-size="10" fill="#ff9aa5" font-family="monospace">${esc(scanner.label)}</text>`;
}

function gravitySvg(well, tile, offsetX, offsetY) {
  const x = offsetX + well.tx * tile;
  const y = offsetY + well.ty * tile;
  const dx = offsetX + well.destTx * tile;
  const dy = offsetY + well.destTy * tile;
  return `<line x1="${x}" y1="${y}" x2="${dx}" y2="${dy}" stroke="#8cffd2" stroke-width="3" opacity="0.72" stroke-dasharray="8 5" />
<circle cx="${x}" cy="${y}" r="8" fill="#8cffd2" opacity="0.9" />
<rect x="${dx - 6}" y="${dy - 6}" width="12" height="12" fill="#8cffd2" transform="rotate(45 ${dx} ${dy})" />
<text x="${x + 10}" y="${y - 10}" font-size="10" fill="#8cffd2" font-family="monospace">GRAVITY WELL</text>
<text x="${dx + 10}" y="${dy - 10}" font-size="10" fill="#8cffd2" font-family="monospace">RAISED RIDGE</text>`;
}

function boostGapSvg(gap, tile, offsetX, offsetY) {
  const x = offsetX + gap.x * tile;
  const y = offsetY + gap.y * tile;
  const w = gap.w * tile;
  const h = gap.h * tile;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const vertical = (gap.orientation ?? 'horizontal') === 'vertical';
  const crack = vertical
    ? `M ${cx - 2} ${y} L ${cx + 5} ${y + h * 0.22} L ${cx - 4} ${y + h * 0.48} L ${cx + 4} ${y + h * 0.72} L ${cx - 3} ${y + h}`
    : `M ${x} ${cy - 2} L ${x + w * 0.22} ${cy + 4} L ${x + w * 0.48} ${cy - 5} L ${x + w * 0.72} ${cy + 3} L ${x + w} ${cy - 2}`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${COLORS.boostGap}" opacity="0.16" stroke="${COLORS.boostGap}" stroke-width="2" stroke-dasharray="5 4" />
<path d="${crack}" fill="none" stroke="${COLORS.boostGap}" stroke-width="3" opacity="0.9" />
<path d="${vertical ? `M ${cx} ${cy} L ${cx - w * 0.34} ${cy - h * 0.18} M ${cx} ${cy} L ${cx + w * 0.3} ${cy + h * 0.2}` : `M ${cx} ${cy} L ${cx - w * 0.18} ${cy - h * 0.34} M ${cx} ${cy} L ${cx + w * 0.2} ${cy + h * 0.3}`}" fill="none" stroke="#ffb15a" stroke-width="2" opacity="0.82" />
<text x="${cx + 8}" y="${cy - 8}" font-size="10" fill="${COLORS.boostGap}" font-family="monospace">${esc(gap.label)}</text>`;
}

function generateArenaSvg(arena, routeBeacons, motelScanners, gravityWells) {
  const tile = arena.grid.w > 70 ? 11 : 13;
  const offsetX = 22;
  const offsetY = 54;
  const legendW = 330;
  const width = offsetX * 2 + arena.grid.w * tile + legendW;
  const height = Math.max(360, offsetY + arena.grid.h * tile + 24);
  const notes = LOCATION_NOTES[arena.id] ?? [];
  const beacons = routeBeacons[arena.id] ?? { toObjective: [], toExit: [] };
  const roomLayers = [
    ...arena.halls.map((r) => rectSvg(r, tile, offsetX, offsetY, COLORS.hall, 0.88)),
    ...arena.rooms.map((r) => rectSvg(r, tile, offsetX, offsetY, COLORS.room, 0.92)),
  ].join('\n');
  const grid = [];
  for (let x = 0; x <= arena.grid.w; x += 4) {
    grid.push(`<line x1="${offsetX + x * tile}" y1="${offsetY}" x2="${offsetX + x * tile}" y2="${offsetY + arena.grid.h * tile}" stroke="${COLORS.grid}" stroke-width="1" opacity="0.45" />`);
  }
  for (let y = 0; y <= arena.grid.h; y += 4) {
    grid.push(`<line x1="${offsetX}" y1="${offsetY + y * tile}" x2="${offsetX + arena.grid.w * tile}" y2="${offsetY + y * tile}" stroke="${COLORS.grid}" stroke-width="1" opacity="0.45" />`);
  }
  const markers = [
    ...(arena.id === 'circuit-z2' ? motelScanners.map((s) => scannerSvg(s, tile, offsetX, offsetY)) : []),
    ...(gravityWells[arena.id] ? [gravitySvg(gravityWells[arena.id], tile, offsetX, offsetY)] : []),
    ...(arena.boostGaps ?? []).map((g) => boostGapSvg(g, tile, offsetX, offsetY)),
    markerSvg(arena.spawn, tile, offsetX, offsetY, '#ffffff', 'SPAWN', 'circle'),
    markerSvg(arena.node, tile, offsetX, offsetY, COLORS.marker, 'OBJECTIVE', 'diamond'),
    arena.breach ? markerSvg(arena.breach, tile, offsetX, offsetY, COLORS.exit, 'EXIT', 'diamond') : '',
    ...(arena.elite ? [markerSvg(arena.elite, tile, offsetX, offsetY, '#ff9f1c', 'ELITE', 'diamond')] : []),
    ...(arena.caches ?? []).map((m, i) => markerSvg(m, tile, offsetX, offsetY, COLORS.cache, `CACHE ${i + 1}`)),
    ...(arena.fieldEvents ?? []).map((m) => markerSvg(m, tile, offsetX, offsetY, COLORS.event, eventLabel(m), 'diamond')),
    ...(arena.weaponSpawns ?? []).map((m) => markerSvg(m, tile, offsetX, offsetY, COLORS.weapon, `WPN ${String(m.wid).toUpperCase()}`)),
    ...beacons.toObjective.map((m) => markerSvg(m, tile, offsetX, offsetY, '#bcff72', m.label)),
    ...beacons.toExit.map((m) => markerSvg(m, tile, offsetX, offsetY, COLORS.exit, m.label)),
    ...(arena.enemies ?? []).map((m) => markerSvg(m, tile, offsetX, offsetY, COLORS.enemy, m.type.toUpperCase())),
  ].join('\n');
  const noteX = offsetX + arena.grid.w * tile + 28;
  const noteRows = notes.map(([name, tx, ty, description], i) => {
    const y = 106 + i * 43;
    return `<text x="${noteX}" y="${y}" font-size="12" fill="${COLORS.text}" font-family="monospace" font-weight="700">${esc(name)} (${tx},${ty})</text>
<text x="${noteX}" y="${y + 16}" font-size="10" fill="${COLORS.note}" font-family="monospace">${esc(description)}</text>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${COLORS.bg}" />
  <text x="22" y="26" font-size="18" fill="${COLORS.marker}" font-family="monospace" font-weight="700">${esc(arena.label)}</text>
  <text x="22" y="43" font-size="11" fill="${COLORS.note}" font-family="monospace">${esc(arena.id)} · ${arena.grid.w}x${arena.grid.h} tiles · mode: ${arena.mode}</text>
  <rect x="${offsetX}" y="${offsetY}" width="${arena.grid.w * tile}" height="${arena.grid.h * tile}" fill="${COLORS.wall}" stroke="${COLORS.grid}" stroke-width="2" />
  ${grid.join('\n')}
  ${roomLayers}
  ${markers}
  <text x="${noteX}" y="26" font-size="14" fill="${COLORS.marker}" font-family="monospace" font-weight="700">Schematic Notes</text>
  <text x="${noteX}" y="47" font-size="10" fill="${COLORS.note}" font-family="monospace">${esc(REGION_SUMMARY[arena.id] ?? '')}</text>
  <text x="${noteX}" y="75" font-size="11" fill="${COLORS.note}" font-family="monospace">Legend: white spawn · green objective/sign · cyan exit · yellow cache · red enemy/scanner · purple weapon · red dashed boost gap · teal gravity</text>
  ${noteRows}
</svg>
`;
}

function generateRouteSvg(arenas) {
  const width = 1240;
  const height = 360;
  const nodes = [
    ['Miller Surface', 'surface-z1', 110, 170],
    ['Motel Circuit', 'circuit-z2', 350, 170],
    ['Chagrin Falls Town', 'town-z3', 590, 170],
    ["Patterson's Orchard", 'maze-z4', 830, 170],
    ['Signal Storm', 'anomaly-01', 1070, 170],
  ];
  const cards = nodes.map(([name, id, x, y]) => {
    const arena = arenas[id];
    return `<rect x="${x - 86}" y="${y - 44}" width="172" height="88" fill="#18252c" stroke="${COLORS.marker}" stroke-width="2" rx="4" />
<text x="${x}" y="${y - 12}" text-anchor="middle" font-size="14" fill="${COLORS.text}" font-family="monospace" font-weight="700">${esc(name)}</text>
<text x="${x}" y="${y + 7}" text-anchor="middle" font-size="10" fill="${COLORS.note}" font-family="monospace">${esc(id)}</text>
<text x="${x}" y="${y + 24}" text-anchor="middle" font-size="10" fill="${COLORS.note}" font-family="monospace">${arena.grid.w}x${arena.grid.h} tiles</text>`;
  }).join('\n');
  const lines = nodes.slice(0, -1).map((n, i) => {
    const [, , x1, y1] = n;
    const [, , x2, y2] = nodes[i + 1];
    return `<line x1="${x1 + 86}" y1="${y1}" x2="${x2 - 86}" y2="${y2}" stroke="${COLORS.exit}" stroke-width="4" />
<polygon points="${x2 - 96},${y2 - 7} ${x2 - 86},${y2} ${x2 - 96},${y2 + 7}" fill="${COLORS.exit}" />`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${COLORS.bg}" />
  <text x="32" y="40" font-size="22" fill="${COLORS.marker}" font-family="monospace" font-weight="700">BLIP Current Route Overview</text>
  <text x="32" y="62" font-size="12" fill="${COLORS.note}" font-family="monospace">Separate Phaser arena scenes connected by charged breach handoffs. Not a seamless single world map yet.</text>
  ${lines}
  ${cards}
</svg>
`;
}

function markdownFor(arenas) {
  const order = ['surface-z1', 'circuit-z2', 'town-z3', 'maze-z4', 'anomaly-01'];
  const sections = order.map((id, index) => {
    const arena = arenas[id];
    const notes = LOCATION_NOTES[id] ?? [];
    const enemies = (arena.enemies ?? []).reduce((acc, enemy) => {
      acc[enemy.type] = (acc[enemy.type] ?? 0) + 1;
      return acc;
    }, {});
    return `## ${index + 1}. ${arena.label}

![${arena.label}](docs/map-schematics/${id}.svg)

- Arena id: \`${id}\`
- Grid: \`${arena.grid.w}x${arena.grid.h}\` tiles
- Spawn: \`${arena.spawn.tx},${arena.spawn.ty}\`
- Objective: \`${arena.node.tx},${arena.node.ty}\`
- Exit: ${arena.breach ? `\`${arena.breach.tx},${arena.breach.ty}\`` : '`none / waves finale`'}
- Enemies: ${Object.entries(enemies).map(([type, count]) => `${count} ${type}`).join(', ') || 'none'}
- Caches: ${(arena.caches ?? []).map((c) => `\`${c.tx},${c.ty}\``).join(', ') || 'none'}
- Field events: ${(arena.fieldEvents ?? []).map((e) => `\`${e.label}@${e.tx},${e.ty}:${e.trigger}${e.reward ? `:${e.reward}` : ''}\``).join(', ') || 'none'}
- Weapon pickups: ${(arena.weaponSpawns ?? []).map((w) => `\`${w.wid}@${w.tx},${w.ty}\``).join(', ') || 'none'}
- Boost gaps: ${(arena.boostGaps ?? []).map((g) => `\`${g.label}@${g.x},${g.y}:${g.w}x${g.h}\``).join(', ') || 'none'}
- Current intent: ${REGION_SUMMARY[id] ?? 'See schematic.'}

Key locations:

${notes.map(([name, tx, ty, description]) => `- \`${tx},${ty}\` ${name}: ${description}`).join('\n')}
`;
  }).join('\n');

  return `# BLIP Map Schematics

Generated from the current arena data in \`src/game/data/sweepArenas.ts\`.

These schematics are planning artifacts for map redesign prompts. They show the authored tile graph from a true top-down view: rooms, halls, spawn points, objectives, exits, caches, weapon pickups, boost gaps, route signs and enemy placements. They do not show every decorative rock/tree generated by the HD terrain renderer.

![Route overview](docs/map-schematics/00-route-overview.svg)

## Current Map Direction

- Keep the five-region route architecture: Miller Surface -> Motel Circuit -> Chagrin Falls Town -> Patterson's Orchard -> Signal Storm.
- Do not blindly scale rectangles. Use schematic-first authoring: main route, optional branch, secret pocket, return/shortcut logic, then enemies and rewards.
- Miller is the template: bigger physical space with named branches and one real far-east Motel transition.
- Motel, Town, Orchard and Signal Storm now have schematic-first expanded layouts too. They still need live feel review and gameplay/puzzle polish.
- Current design pass: every region now tracks a clear main route, optional branch, secret pocket, shortcut/return loop, purposeful enemy spaces, reward pocket and explicit exit approach.
- AI route-guidance tuning should wait until the map schematics are stable enough that bots are not trained around temporary coordinates.

${sections}
`;
}

const { arenas, routeBeacons, motelScanners, gravityWells } = extractData();
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, '00-route-overview.svg'), generateRouteSvg(arenas));
for (const arena of Object.values(arenas)) {
  fs.writeFileSync(path.join(OUT_DIR, `${arena.id}.svg`), generateArenaSvg(arena, routeBeacons, motelScanners, gravityWells));
}
fs.writeFileSync(README_FILE, markdownFor(arenas));

console.log(`Wrote ${README_FILE}`);
console.log(`Wrote SVG schematics to ${OUT_DIR}`);
