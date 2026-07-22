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
  const q = [[Math.floor(from.tx), Math.floor(from.ty)]];
  const seen = new Set([key(q[0][0], q[0][1])]);
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    if (x === Math.floor(to.tx) && y === Math.floor(to.ty)) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = key(nx, ny);
      if (nx < 0 || nx >= arena.grid.w || ny < 0 || ny >= arena.grid.h || seen.has(k) || !walk[ny][nx]) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return false;
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

  const spawnToNode = reachable(arena, walk, arena.spawn, arena.node);
  const nodeToBreach = arena.breach ? reachable(arena, walk, arena.node, arena.breach) : true;
  console.log(`${arena.id}: ${arena.grid.w}x${arena.grid.h}, floor=${walk.flat().filter(Boolean).length}, route=${spawnToNode}${arena.breach ? `/${nodeToBreach}` : ''}`);
  if (!spawnToNode) errors.push(`${arena.id}: spawn cannot reach node`);
  if (arena.breach && !nodeToBreach) errors.push(`${arena.id}: node cannot reach breach`);
}

if (errors.length) {
  console.error('\nMap validation errors:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
