import fs from 'node:fs';
import vm from 'node:vm';

const ARENA_FILE = 'src/game/data/sweepArenas.ts';

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

const src = fs.readFileSync(ARENA_FILE, 'utf8');
const arenas = extractExportedObject(src, 'SWEEP_ARENAS', '};\n\nexport const DEFAULT_ARENA');
const routeBeacons = extractExportedObject(src, 'SWEEP_ROUTE_BEACONS', '};');
const motelScanners = extractExportedArray(src, 'SWEEP_MOTEL_SCANNERS');
const gravityWells = extractExportedObject(src, 'SWEEP_GRAVITY_WELLS', '};');

const errors = [];
const warnings = [];
const TILE = 32;
const key = (x, y) => `${x},${y}`;

function buildWalkable(arena) {
  const walk = Array.from({ length: arena.grid.h }, () => Array(arena.grid.w).fill(false));
  const carve = (rect) => {
    for (let y = Math.max(0, rect.y); y < Math.min(arena.grid.h, rect.y + rect.h); y++) {
      for (let x = Math.max(0, rect.x); x < Math.min(arena.grid.w, rect.x + rect.w); x++) {
        walk[y][x] = true;
      }
    }
  };
  arena.rooms.forEach(carve);
  arena.halls.forEach(carve);
  return walk;
}

function checkMarker(arena, walk, name, marker) {
  if (!marker) return;
  const tx = Math.floor(marker.tx);
  const ty = Math.floor(marker.ty);
  if (tx < 0 || tx >= arena.grid.w || ty < 0 || ty >= arena.grid.h) {
    errors.push(`${arena.id}:${name} outside grid at ${key(marker.tx, marker.ty)}`);
  } else if (!walk[ty]?.[tx]) {
    errors.push(`${arena.id}:${name} is not walkable at ${key(marker.tx, marker.ty)}`);
  }
}

function reachable(arena, walk, from, to) {
  return routeDistance(arena, walk, from, to) < Infinity;
}

function routeDistance(arena, walk, from, to) {
  const q = [[Math.floor(from.tx), Math.floor(from.ty)]];
  const seen = new Set([key(q[0][0], q[0][1])]);
  const dist = new Map([[key(q[0][0], q[0][1]), 0]]);
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    const d = dist.get(key(x, y)) ?? 0;
    if (x === Math.floor(to.tx) && y === Math.floor(to.ty)) return d;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = key(nx, ny);
      if (nx < 0 || nx >= arena.grid.w || ny < 0 || ny >= arena.grid.h || seen.has(k) || !walk[ny][nx]) continue;
      seen.add(k);
      dist.set(k, d + 1);
      q.push([nx, ny]);
    }
  }
  return Infinity;
}

function roomCenter(room) {
  return { tx: room.x + room.w / 2, ty: room.y + room.h / 2 };
}

function rectsTouch(a, b) {
  const ax1 = a.x;
  const ay1 = a.y;
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx1 = b.x;
  const by1 = b.y;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

function roomGraph(arena) {
  const rects = arena.rooms.map((room, index) => ({ ...room, index, kind: 'room' }));
  const halls = arena.halls.map((hall, index) => ({ ...hall, index, kind: 'hall' }));
  const graph = arena.rooms.map(() => new Set());
  for (const hall of halls) {
    const touched = rects.filter((room) => rectsTouch(room, hall)).map((room) => room.index);
    for (const a of touched) for (const b of touched) if (a !== b) graph[a].add(b);
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsTouch(rects[i], rects[j])) {
        graph[i].add(j);
        graph[j].add(i);
      }
    }
  }
  return graph.map((edges) => [...edges]);
}

function roomIndexFor(arena, marker) {
  const tx = Math.floor(marker.tx);
  const ty = Math.floor(marker.ty);
  return arena.rooms.findIndex((room) => tx >= room.x && tx < room.x + room.w && ty >= room.y && ty < room.y + room.h);
}

function shortestRoomPath(graph, start, end) {
  if (start < 0 || end < 0) return [];
  const q = [start];
  const prev = new Map([[start, -1]]);
  for (let i = 0; i < q.length; i++) {
    const at = q[i];
    if (at === end) break;
    for (const next of graph[at] ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, at);
      q.push(next);
    }
  }
  if (!prev.has(end)) return [];
  const path = [];
  for (let at = end; at >= 0; at = prev.get(at)) path.push(at);
  return path.reverse();
}

function contentsInRoom(arena, roomIndex) {
  const inRoom = (marker) => roomIndexFor(arena, marker) === roomIndex;
  return [
    ...(arena.caches ?? []).filter(inRoom).map(() => 'cache'),
    ...(arena.weaponSpawns ?? []).filter(inRoom).map((w) => `weapon:${w.wid}`),
    ...(arena.fieldEvents ?? []).filter(inRoom).map((event) => `event:${event.label}`),
    ...(arena.enemies ?? []).filter(inRoom).map((enemy) => `enemy:${enemy.type}`),
  ];
}

function assertMin(arena, label, actual, min) {
  if (actual < min) errors.push(`${arena.id}: ${label} ${actual} < ${min}`);
}

function assertRouteDistance(arena, label, actual, min, max) {
  if (actual < min) errors.push(`${arena.id}: ${label} too short (${actual} tiles < ${min})`);
  if (actual > max) errors.push(`${arena.id}: ${label} too long (${actual} tiles > ${max})`);
}

function labelRect(cx, cy, text, minW, lineH, padX = 10) {
  const lines = String(text).split('\n');
  const chars = Math.max(...lines.map((line) => line.length), 1);
  const width = Math.max(minW, chars * 6 + padX * 2);
  const height = Math.max(lineH, lines.length * lineH);
  return { x1: cx - width / 2, y1: cy - height / 2, x2: cx + width / 2, y2: cy + height / 2 };
}

function overlaps(a, b, pad = 4) {
  return a.x1 - pad < b.x2 && a.x2 + pad > b.x1 && a.y1 - pad < b.y2 && a.y2 + pad > b.y1;
}

function markerWorld(marker) {
  return { x: (marker.tx + 0.5) * TILE, y: (marker.ty + 0.5) * TILE };
}

function pickupLabelY(marker, baseOffset, routeSigns) {
  const p = markerWorld(marker);
  let y = p.y - baseOffset;
  for (const sign of routeSigns) {
    const s = markerWorld(sign);
    const signY = s.y - 31;
    if (Math.abs(p.x - s.x) < 118 && Math.abs(y - signY) < 44) y = p.y + 39;
  }
  return y;
}

function fieldEventActionLabel(event) {
  if (event.reward === 'health') return 'RECOVERY';
  if (event.reward === 'weapon') return event.wid ? `${String(event.wid).toUpperCase()} WEAPON` : 'WEAPON';
  if (event.reward === 'overdrive') return 'OVERDRIVE';
  if (event.reward === 'boon') return 'SCOUT TECH';
  if (event.reward === 'shards') return 'CACHE';
  return event.trigger === 'scan' ? 'SCAN' : 'ACTIVATE';
}

function checkLabelCrowding(arena, phaseName, routeSigns) {
  const routeRects = routeSigns.map((sign) => {
    const p = markerWorld(sign);
    return { label: sign.label, rect: labelRect(p.x, p.y - 31, sign.label, 50, 17, 7) };
  });
  const labelMarkers = [
    ...(arena.weaponSpawns ?? []).map((marker) => ({ marker, label: String(marker.wid).toUpperCase(), baseOffset: 25 })),
    ...(arena.fieldEvents ?? []).map((marker) => ({ marker, label: `${marker.label}\n${fieldEventActionLabel(marker)}`, baseOffset: 24 })),
  ];
  for (const item of labelMarkers) {
    const p = markerWorld(item.marker);
    const rect = labelRect(p.x, pickupLabelY(item.marker, item.baseOffset, routeSigns), item.label, 42, 13, 8);
    for (const route of routeRects) {
      if (overlaps(rect, route.rect)) {
        errors.push(`${arena.id}: ${phaseName} label crowding "${item.label.replace(/\n/g, ' ')}" overlaps route sign "${route.label}"`);
      }
    }
  }
}

for (const arena of Object.values(arenas)) {
  const walk = buildWalkable(arena);
  checkMarker(arena, walk, 'spawn', arena.spawn);
  checkMarker(arena, walk, 'node', arena.node);
  checkMarker(arena, walk, 'breach', arena.breach);
  checkMarker(arena, walk, 'elite', arena.elite);

  for (const [i, enemy] of (arena.enemies ?? []).entries()) checkMarker(arena, walk, `enemy[${i}] ${enemy.type}`, enemy);
  for (const [i, cache] of (arena.caches ?? []).entries()) checkMarker(arena, walk, `cache[${i}]`, cache);
  for (const [i, weapon] of (arena.weaponSpawns ?? []).entries()) checkMarker(arena, walk, `weapon[${i}] ${weapon.wid}`, weapon);
  for (const [i, event] of (arena.fieldEvents ?? []).entries()) {
    checkMarker(arena, walk, `fieldEvent[${i}] ${event.id}`, event);
    for (const [j, spawn] of (event.spawns ?? []).entries()) checkMarker(arena, walk, `fieldEvent[${i}] spawn[${j}] ${spawn.type}`, spawn);
  }
  for (const beacon of [...(routeBeacons[arena.id]?.toObjective ?? []), ...(routeBeacons[arena.id]?.toExit ?? [])]) {
    checkMarker(arena, walk, `route sign ${beacon.label}`, beacon);
  }
  if (arena.id === 'circuit-z2') {
    for (const scanner of motelScanners) {
      checkMarker(arena, walk, `scanner ${scanner.label} A`, { tx: scanner.aTx, ty: scanner.aTy });
      checkMarker(arena, walk, `scanner ${scanner.label} B`, { tx: scanner.bTx, ty: scanner.bTy });
      if (!/SCANNER$/.test(scanner.label)) {
        errors.push(`${arena.id}: scanner label "${scanner.label}" must explicitly end with SCANNER so it reads as a hazard/device, not a random prop`);
      }
      if (/GATE|BREACH|EXIT$/i.test(scanner.label)) {
        errors.push(`${arena.id}: scanner label "${scanner.label}" is ambiguous with route exits; use a scanner/device name instead`);
      }
    }
  }
  if (gravityWells[arena.id]) {
    const well = gravityWells[arena.id];
    checkMarker(arena, walk, 'gravity well', { tx: well.tx, ty: well.ty });
    checkMarker(arena, walk, 'gravity destination', { tx: well.destTx, ty: well.destTy });
  }

  const seenEnemies = new Set();
  for (const enemy of arena.enemies ?? []) {
    const k = key(enemy.tx, enemy.ty);
    if (seenEnemies.has(k)) errors.push(`${arena.id}: duplicate enemy tile ${k}`);
    seenEnemies.add(k);
    const spawnDist = Math.hypot(enemy.tx - arena.spawn.tx, enemy.ty - arena.spawn.ty);
    if (spawnDist < 5) errors.push(`${arena.id}: ${enemy.type} too close to spawn at ${k} (${spawnDist.toFixed(1)})`);
  }

  const spawnToNodeDist = routeDistance(arena, walk, arena.spawn, arena.node);
  const nodeToBreachDist = arena.breach ? routeDistance(arena, walk, arena.node, arena.breach) : 0;
  const spawnToNode = spawnToNodeDist < Infinity;
  const nodeToBreach = arena.breach ? nodeToBreachDist < Infinity : true;
  console.log(`${arena.id}: ${arena.grid.w}x${arena.grid.h}, floor=${walk.flat().filter(Boolean).length}, route=${spawnToNodeDist}${arena.breach ? `/${nodeToBreachDist}` : ''}`);
  if (!spawnToNode) errors.push(`${arena.id}: spawn cannot reach node`);
  if (arena.breach && !nodeToBreach) errors.push(`${arena.id}: node cannot reach breach`);

  const mainRouteDist = spawnToNodeDist + nodeToBreachDist;
  if (arena.mode === 'traverse') {
    assertRouteDistance(arena, 'main route distance', mainRouteDist, 38, 125);
    assertMin(arena, 'field events', arena.fieldEvents?.length ?? 0, 4);
    assertMin(arena, 'caches', arena.caches?.length ?? 0, 4);
    assertMin(arena, 'weapon spawns', arena.weaponSpawns?.length ?? 0, 2);
    assertMin(arena, 'enemy placements', arena.enemies?.length ?? 0, 8);
    assertMin(arena, 'objective route signs', routeBeacons[arena.id]?.toObjective?.length ?? 0, 3);
    assertMin(arena, 'exit route signs', routeBeacons[arena.id]?.toExit?.length ?? 0, 3);
    checkLabelCrowding(arena, 'objective-phase', routeBeacons[arena.id]?.toObjective ?? []);
    checkLabelCrowding(arena, 'exit-phase', routeBeacons[arena.id]?.toExit ?? []);
  }

  const graph = roomGraph(arena);
  const spawnRoom = roomIndexFor(arena, arena.spawn);
  const nodeRoom = roomIndexFor(arena, arena.node);
  const breachRoom = arena.breach ? roomIndexFor(arena, arena.breach) : nodeRoom;
  const mainRoomPath = new Set([
    ...shortestRoomPath(graph, spawnRoom, nodeRoom),
    ...shortestRoomPath(graph, nodeRoom, breachRoom),
  ]);
  const branchRooms = arena.rooms.map((_, i) => i).filter((i) => !mainRoomPath.has(i));
  const purposefulBranches = branchRooms.filter((i) => contentsInRoom(arena, i).length > 0);
  const emptyBranches = branchRooms.filter((i) => contentsInRoom(arena, i).length === 0);
  if (arena.mode === 'traverse') {
    assertMin(arena, 'purposeful optional branch rooms', purposefulBranches.length, 2);
    if (emptyBranches.length > Math.max(1, Math.floor(arena.rooms.length * 0.12))) {
      errors.push(`${arena.id}: too many optional branch rooms without content (${emptyBranches.join(', ')})`);
    }
  }

  const eventRewards = new Set((arena.fieldEvents ?? []).map((event) => event.reward ?? 'none'));
  if (arena.mode === 'traverse' && !eventRewards.has('weapon')) warnings.push(`${arena.id}: no authored field-event weapon reward`);
  if (arena.mode === 'traverse' && !eventRewards.has('health')) warnings.push(`${arena.id}: no authored field-event recovery reward`);

  if (arena.id === 'circuit-z2') {
    assertMin(arena, 'scanner beams', motelScanners.length, 5);
    if (!(arena.fieldEvents ?? []).some((event) => /maintenance/i.test(event.id) && event.trigger === 'scan')) {
      errors.push(`${arena.id}: missing Phase Shift/maintenance secret scan event`);
    }
    const motelGoalCopy = `${arena.label} ${(routeBeacons[arena.id]?.toObjective ?? []).map((b) => b.label).join(' ')} ${(routeBeacons[arena.id]?.toExit ?? []).map((b) => b.label).join(' ')}`;
    if (/CIRCUIT GATE|SCANNER GATE|GATE DOWN/i.test(motelGoalCopy)) {
      errors.push(`${arena.id}: stale gate wording remains in Motel route labels`);
    }
  }

  if (arena.id === 'maze-z4') {
    const well = gravityWells[arena.id];
    if (!well) errors.push(`${arena.id}: missing Gravity Well marker`);
    else {
      const wellToDest = routeDistance(arena, walk, { tx: well.tx, ty: well.ty }, { tx: well.destTx, ty: well.destTy });
      if (wellToDest < 10) errors.push(`${arena.id}: Gravity Well destination too close to source (${wellToDest} tiles)`);
    }
    if (!(routeBeacons[arena.id]?.toObjective ?? []).some((b) => b.label === 'GRAVITY WELL')) errors.push(`${arena.id}: missing Gravity Well route sign`);
    if (!(routeBeacons[arena.id]?.toObjective ?? []).some((b) => b.label === 'CROP CIRCLE')) errors.push(`${arena.id}: missing post-well Crop Circle route sign`);
  }

  if (arena.id === 'town-z3') {
    const townEvents = (arena.fieldEvents ?? []).map((event) => event.id);
    for (const required of ['bridge-overlook-cache', 'river-walk-cache', 'orchard-gate-stand']) {
      if (!townEvents.includes(required)) errors.push(`${arena.id}: missing required town identity event ${required}`);
    }
  }

  if (arena.id === 'anomaly-01') {
    if ((arena.waves ?? []).length < 5) errors.push(`${arena.id}: finale needs at least five named phases`);
    for (const wave of arena.waves ?? []) {
      if (!wave.label || !/PHASE|FINAL/i.test(wave.label)) errors.push(`${arena.id}: unnamed or generic finale wave`);
    }
    assertMin(arena, 'finale reward/recovery field events', arena.fieldEvents?.length ?? 0, 4);
  }
}

if (errors.length) {
  console.error('\nMap validation errors:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

if (warnings.length) {
  console.warn('\nMap validation warnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}
