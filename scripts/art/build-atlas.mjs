#!/usr/bin/env node
/**
 * BLIP top-down art pipeline - Phase 3, step 4.
 *
 * Packs every sprite PNG staged in `art-src/sprites/` into a single
 * Phaser JSON-Hash atlas:
 *
 *   public/assets/topdown/topdown-z1.webp
 *   public/assets/topdown/topdown-z1.json
 *
 * Ground and wall TILES are deliberately NOT in the atlas - Phaser's
 * `tileSprite` needs real texture wrap, which an atlas frame cannot provide.
 * They stay as individual .webp files written by process.py.
 *
 * Frame names are asserted against REQUIRED_FRAMES below. Those strings are the
 * `TEX.td*` registry values; atlas frame-name drift is the single most likely
 * silent failure in this overhaul, so a missing or unexpected frame fails hard
 * here rather than surfacing as Phaser's __MISSING texture at runtime.
 *
 * Layout is computed here; the pixel composite is done by PIL (the only image
 * library available in this environment). Frames are trimmed to their opaque
 * bounds and the trim offset is recorded in `spriteSourceSize`, so the runtime
 * can keep placing sprites by their untrimmed `sourceSize`.
 *
 * Usage: node scripts/art/build-atlas.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'public', 'assets', 'topdown');
const PAD = 2; // transparent gutter; prevents LINEAR filtering bleeding neighbours

/** Which biome to pack. `node build-atlas.mjs --biome motel` */
const argIdx = process.argv.indexOf('--biome');
const BIOME = argIdx > -1 ? process.argv[argIdx + 1] : 'miller';

const DRONES = [
  'drifter', 'tagger', 'diver', 'warden', 'sniper', 'splitter', 'weaver', 'turret',
];

/**
 * The SHARED cast — packed into EVERY biome's atlas.
 *
 * The player, drones, elite and Node do not change appearance from zone to
 * zone, so each atlas carries its own copy rather than the runtime juggling a
 * second "common" atlas. They cost ~40% of the sheet and buy a much simpler
 * load path: one atlas per arena, complete on its own.
 */
const ACTOR_FRAMES = [
  'td-blip', 'td-blip-emis',
  ...DRONES.map((d) => `td-${d}`),
  ...DRONES.map((d) => `td-${d}-emis`),
  'td-elite', 'td-elite-emis',
  'td-node', 'td-node-emis',
];

/**
 * Per-biome scenery. These MUST match the keys the matching TdBiomeDef
 * declares in src/game/topdown/TdBiomes.ts — frame-name drift between the two
 * is the single most likely silent failure in this pipeline, which is why a
 * mismatch fails hard here rather than surfacing as __MISSING at runtime.
 */
const BIOMES = {
  miller: {
    name: 'topdown-z1',
    prefix: 'td',
    scenery: [
      'td-rock', 'td-log', 'td-bush', 'td-fern', 'td-tuft', 'td-canopy',
      'td-debris', 'td-scrap',
      'td-lm-pod', 'td-lm-pod-emis', 'td-lm-relay', 'td-lm-relay-emis',
      'td-lm-roots', 'td-lm-pool', 'td-lm-pool-emis',
    ],
    tiles: ['ground', 'ground-lit', 'ground-dark', 'path', 'wall-top', 'wall-face']
      .map((t) => `td-${t}.webp`),
  },
  motel: {
    name: 'topdown-z2',
    prefix: 'td-z2',
    scenery: [
      'td-z2-rubble', 'td-z2-tire', 'td-z2-cone', 'td-z2-weed', 'td-z2-crate',
      'td-z2-scrap', 'td-z2-planter',
      'td-z2-lm-vending', 'td-z2-lm-vending-emis', 'td-z2-lm-sign',
      'td-z2-lm-sign-emis', 'td-z2-lm-car', 'td-z2-lm-lamp', 'td-z2-lm-lamp-emis',
    ],
    tiles: ['ground', 'ground-lit', 'ground-dark', 'path', 'wall-top', 'wall-face']
      .map((t) => `td-z2-${t}.webp`),
  },
};

const CFG = BIOMES[BIOME];
if (!CFG) {
  console.error(`[atlas] ERROR unknown biome "${BIOME}" (have: ${Object.keys(BIOMES).join(', ')})`);
  process.exit(1);
}
const SPRITES = path.join(ROOT, 'art-src', BIOME === 'miller' ? 'sprites' : `sprites-${BIOME}`);
const NAME = CFG.name;

/** Exactly the TEX.td* atlas keys the runtime will look up for this biome. */
export const REQUIRED_FRAMES = [...ACTOR_FRAMES, ...CFG.scenery];

/** Individual tile files (NOT atlas frames) that family.py must have written. */
export const REQUIRED_TILES = CFG.tiles;

function fail(msg) {
  console.error(`[atlas] ERROR ${msg}`);
  process.exit(1);
}

/* ------------------------- read sprite metadata --------------------------- */
// Two source dirs: the SHARED actor PNGs (authored once, packed into every
// biome atlas) and this biome's own scenery. Only frames REQUIRED_FRAMES asks
// for are read, so the shared dir's zone-1 scenery is simply ignored when
// packing another biome.
const SRC_DIRS = [path.join(ROOT, 'art-src', 'sprites')];
if (BIOME !== 'miller') SRC_DIRS.push(SPRITES);
for (const d of SRC_DIRS) {
  if (!fs.existsSync(d)) fail(`${d} missing - run family.py for this biome first`);
}

// PIL is the only image library here, so ask it for sizes and trim boxes.
const probe = `
import json, os, sys
from PIL import Image
out = {}
for d in sys.argv[1:]:
    for f in sorted(os.listdir(d)):
        if not f.endswith('.png'):
            continue
        im = Image.open(os.path.join(d, f)).convert('RGBA')
        bbox = im.split()[3].getbbox() or (0, 0, im.width, im.height)
        out[f[:-4]] = {'w': im.width, 'h': im.height, 'bbox': list(bbox),
                       'path': os.path.join(d, f)}
print(json.dumps(out))
`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blip-atlas-'));
const probePath = path.join(tmp, 'probe.py');
fs.writeFileSync(probePath, probe);
const meta = JSON.parse(execFileSync('python3', [probePath, ...SRC_DIRS]).toString());

const missing = REQUIRED_FRAMES.filter((f) => !meta[f]);
if (missing.length) fail(`missing sprite PNGs for frames: ${missing.join(', ')}`);
// Only assert on frames we were asked to pack. Unlike the single-biome version,
// a shared dir legitimately holds sprites this atlas does not want.
for (const k of Object.keys(meta)) if (!REQUIRED_FRAMES.includes(k)) delete meta[k];

/* ------------------------------- packing ---------------------------------- */
// Shelf packer, tallest-first. With ~30 frames this lands within a few percent
// of optimal and is trivially auditable - a MaxRects implementation would be
// more code than the saved bytes are worth.
const frames = REQUIRED_FRAMES.map((name) => {
  const m = meta[name];
  const [bx0, by0, bx1, by1] = m.bbox;
  return {
    name,
    src: m.path, // absolute — frames come from two dirs now, so carry the path
    srcW: m.w,
    srcH: m.h,
    trimX: bx0,
    trimY: by0,
    w: bx1 - bx0,
    h: by1 - by0,
  };
});

function pack(width) {
  const sorted = [...frames].sort((a, b) => b.h - a.h || b.w - a.w);
  let x = PAD;
  let y = PAD;
  let shelfH = 0;
  for (const f of sorted) {
    if (x + f.w + PAD > width) {
      x = PAD;
      y += shelfH + PAD;
      shelfH = 0;
    }
    if (f.w + PAD * 2 > width) return null;
    f.x = x;
    f.y = y;
    x += f.w + PAD;
    shelfH = Math.max(shelfH, f.h);
  }
  return y + shelfH + PAD;
}

let best = null;
for (const w of [256, 384, 512, 640, 768, 1024, 1280, 2048]) {
  const h = pack(w);
  if (h === null) continue;
  const area = w * h;
  if (!best || area < best.area) {
    best = { w, h, area, placed: frames.map((f) => ({ ...f })) };
  }
}
if (!best) fail('could not pack sprites into any candidate atlas size');
// Re-run the winning width so `frames` carries the winning coordinates.
pack(best.w);
const atlasW = best.w;
const atlasH = best.h;

/* ------------------------------ composite --------------------------------- */
const placements = frames.map((f) => ({
  name: f.name, src: f.src, x: f.x, y: f.y, w: f.w, h: f.h, trimX: f.trimX, trimY: f.trimY,
}));

const comp = `
import json, os, sys, warnings
from PIL import Image
warnings.filterwarnings('ignore')
spec = json.load(open(sys.argv[1]))
sheet = Image.new('RGBA', (spec['w'], spec['h']), (0, 0, 0, 0))
for p in spec['frames']:
    im = Image.open(p['src']).convert('RGBA')
    im = im.crop((p['trimX'], p['trimY'], p['trimX'] + p['w'], p['trimY'] + p['h']))
    sheet.paste(im, (p['x'], p['y']))
# Lossless: actor sprites have hard alpha edges and emissive layers, both of
# which lossy WebP smears into visible halos at these sizes.
sheet.save(spec['out'], 'WEBP', lossless=True, quality=100, method=6, exact=True)
print(os.path.getsize(spec['out']))
`;
fs.mkdirSync(OUT, { recursive: true });
const specPath = path.join(tmp, 'spec.json');
fs.writeFileSync(
  specPath,
  JSON.stringify({
    w: atlasW,
    h: atlasH,
    frames: placements,
    out: path.join(OUT, `${NAME}.webp`),
  })
);
const compPath = path.join(tmp, 'comp.py');
fs.writeFileSync(compPath, comp);
const bytes = parseInt(execFileSync('python3', [compPath, specPath]).toString().trim(), 10);

/* -------------------------------- JSON ------------------------------------ */
const json = { frames: {}, meta: {} };
for (const f of frames) {
  json.frames[f.name] = {
    frame: { x: f.x, y: f.y, w: f.w, h: f.h },
    rotated: false,
    trimmed: f.w !== f.srcW || f.h !== f.srcH,
    spriteSourceSize: { x: f.trimX, y: f.trimY, w: f.w, h: f.h },
    sourceSize: { w: f.srcW, h: f.srcH },
  };
}
json.meta = {
  app: 'scripts/art/build-atlas.mjs',
  version: '1.0',
  image: `${NAME}.webp`,
  format: 'RGBA8888',
  size: { w: atlasW, h: atlasH },
  scale: '1',
  note:
    'Authored at ~2x intended on-screen size. Apply LINEAR filtering to td* keys ' +
    'ONLY - never to the shared TEX.glow8/px/spark/ring textures.',
};
fs.writeFileSync(path.join(OUT, `${NAME}.json`), JSON.stringify(json, null, 1));

/* ------------------------------ verify ------------------------------------ */
const tilesMissing = REQUIRED_TILES.filter((t) => !fs.existsSync(path.join(OUT, t)));
if (tilesMissing.length) fail(`missing tile files: ${tilesMissing.join(', ')}`);

fs.rmSync(tmp, { recursive: true, force: true });

const used = frames.reduce((s, f) => s + f.w * f.h, 0);
const total = fs
  .readdirSync(OUT)
  .reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);

console.log(`[atlas] ${NAME}.webp  ${atlasW}x${atlasH}  ${(bytes / 1024).toFixed(1)} KB`);
console.log(`[atlas] ${frames.length} frames, ${((used / (atlasW * atlasH)) * 100).toFixed(1)}% fill`);
console.log(`[atlas] public/assets/topdown total: ${(total / 1024).toFixed(1)} KB`);
if (total > 1.5 * 1024 * 1024) fail(`asset budget blown: ${(total / 1024).toFixed(1)} KB > 1536 KB`);
