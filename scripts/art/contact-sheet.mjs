#!/usr/bin/env node
/**
 * BLIP top-down art pipeline - Phase 3 review gate.
 *
 * Emits `art-src/contact-sheet.html`: every produced asset on a dark background
 * at 1x and 3x, so palette coherence and light direction can actually be
 * REVIEWED before any integration happens. Per the plan, a captured screenshot
 * is not a passed checkpoint - this page exists to be looked at.
 *
 * - Ground and wall tiles are shown 2x2-repeated so a seam would be obvious.
 * - Actors are shown body-only AND with their additive emissive layer
 *   composited, because a body that reads well unlit can still blow out once
 *   the emissive lands on it.
 * - Everything is inlined as data: URIs, so the file opens straight from disk.
 *
 * Usage: node scripts/art/contact-sheet.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'topdown');
const SPRITES = path.join(ROOT, 'art-src', 'sprites');
const DEST = path.join(ROOT, 'art-src', 'contact-sheet.html');

const TILES = [
  ['td-ground.webp', 'ground base'],
  ['td-ground-lit.webp', 'moonlit pool'],
  ['td-ground-dark.webp', 'wet / shadowed'],
  ['td-path.webp', 'dirt path'],
  ['td-wall-top.webp', 'wall top cap'],
  ['td-wall-face.webp', 'wall face strip'],
];

const ACTORS = [
  'td-blip', 'td-drifter', 'td-tagger', 'td-diver', 'td-warden',
  'td-sniper', 'td-splitter', 'td-weaver', 'td-turret', 'td-elite', 'td-node',
];
const PROPS = ['td-rock', 'td-log', 'td-debris', 'td-scrap',
               'td-tuft', 'td-fern', 'td-bush', 'td-canopy'];

function dataUri(file) {
  const ext = path.extname(file).slice(1);
  const mime = ext === 'webp' ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

/** PNG intrinsic size straight from the IHDR - avoids a `zoom` hack in CSS. */
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function need(file) {
  if (!fs.existsSync(file)) {
    console.error(`[contact-sheet] ERROR missing ${path.relative(ROOT, file)}`);
    console.error('[contact-sheet] run process.py, author-actors.py and build-atlas.mjs first');
    process.exit(1);
  }
  return file;
}

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1);

/* --------------------------------- html ---------------------------------- */
const tileCards = TILES.map(([f, label]) => {
  const p = need(path.join(OUT_DIR, f));
  const uri = dataUri(p);
  return `
  <figure class="card">
    <div class="tile" style="background-image:url('${uri}')"></div>
    <figcaption><b>${f}</b><span>${label} &middot; ${kb(p)} KB &middot; shown 2&times;2 repeated</span></figcaption>
  </figure>`;
}).join('');

function spriteCard(name, withEmissive) {
  const body = need(path.join(SPRITES, `${name}.png`));
  const uri = dataUri(body);
  const emisPath = path.join(SPRITES, `${name}-emis.png`);
  const hasEmis = withEmissive && fs.existsSync(emisPath);
  const { w, h } = pngSize(body);
  const emisUri = hasEmis ? dataUri(emisPath) : null;
  const at = (scale) => {
    const iw = w * scale;
    const ih = h * scale;
    const e = hasEmis
      ? `<img class="emis" src="${emisUri}" width="${iw}" height="${ih}" alt="">`
      : '';
    return `<div class="stage" style="min-width:${iw + 16}px;min-height:${ih + 16}px">` +
      `<img src="${uri}" width="${iw}" height="${ih}" alt="">${e}</div>`;
  };
  return `
  <figure class="card">
    <div class="row">${at(1)}${at(3)}</div>
    <figcaption><b>${name}</b><span>${kb(body)} KB &middot; 1&times; and 3&times;${
      hasEmis ? ' &middot; + additive emissive' : ''
    }</span></figcaption>
  </figure>`;
}

const atlasWebp = need(path.join(OUT_DIR, 'topdown-z1.webp'));
const atlasJson = JSON.parse(
  fs.readFileSync(need(path.join(OUT_DIR, 'topdown-z1.json')), 'utf8')
);
const totalKb = fs
  .readdirSync(OUT_DIR)
  .reduce((s, f) => s + fs.statSync(path.join(OUT_DIR, f)).size, 0) / 1024;

const html = `<!doctype html>
<meta charset="utf-8">
<title>BLIP &middot; top-down asset contact sheet</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; padding: 32px 28px 64px;
    background: #0b0e10; color: #cfd8d4;
    font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  h1 { font-size: 20px; letter-spacing: .04em; margin: 0 0 4px; color: #7cdc6a; }
  h2 { font-size: 13px; letter-spacing: .14em; text-transform: uppercase;
       color: #6f8078; margin: 40px 0 14px;
       border-bottom: 1px solid #1b2225; padding-bottom: 8px; }
  .meta { color: #6f8078; margin: 0 0 8px; }
  .grid { display: flex; flex-wrap: wrap; gap: 16px; }
  .card { margin: 0; background: #14181b; border: 1px solid #1e2529;
          border-radius: 8px; padding: 12px; }
  figcaption { margin-top: 10px; font-size: 12px; }
  figcaption b { display: block; color: #e6efe9; font-weight: 600; }
  figcaption span { color: #6f8078; }
  .tile { width: 256px; height: 256px; background-size: 128px 128px;
          background-repeat: repeat; border-radius: 4px; }
  .row { display: flex; align-items: flex-end; gap: 18px; }
  .stage { position: relative; display: grid; place-items: end center;
           background: #0e1214; border-radius: 4px; padding: 8px; }
  .stage img { display: block; image-rendering: auto; }
  .stage .emis { position: absolute; left: 8px; bottom: 8px;
                 mix-blend-mode: screen; }
  .atlas { max-width: 100%; border: 1px solid #1e2529; border-radius: 4px;
           background: repeating-conic-gradient(#1a1f22 0% 25%, #14181b 0% 50%) 0/16px 16px; }
  code { background: #10161a; padding: 1px 5px; border-radius: 3px; color: #9fd8c0; }
</style>

<h1>BLIP &middot; top-down asset contact sheet</h1>
<p class="meta">
  <code>public/assets/topdown/</code> &middot; ${totalKb.toFixed(1)} KB total &middot;
  ${Object.keys(atlasJson.frames).length} atlas frames &middot;
  atlas ${atlasJson.meta.size.w}&times;${atlasJson.meta.size.h}
</p>
<p class="meta">
  Review for: palette coherence (deep desaturated forest green-black, value 0.06&ndash;0.22),
  a single consistent <b>upper-left</b> light on every object, red reserved for enemies,
  no visible tile seam, and no asset that reads as a placeholder.
</p>

<h2>Ground &amp; wall tiles &mdash; individual files, tileSprite wrap</h2>
<div class="grid">${tileCards}</div>

<h2>Actors &mdash; body + additive emissive layer</h2>
<div class="grid">${ACTORS.map((n) => spriteCard(n, true)).join('')}</div>

<h2>Props &amp; foliage</h2>
<div class="grid">${PROPS.map((n) => spriteCard(n, false)).join('')}</div>

<h2>Packed atlas &mdash; topdown-z1.webp</h2>
<img class="atlas" src="${dataUri(atlasWebp)}" alt="packed atlas">
`;

fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.writeFileSync(DEST, html);
console.log(
  `[contact-sheet] ${path.relative(ROOT, DEST)}  ${(fs.statSync(DEST).size / 1024).toFixed(1)} KB`
);
console.log('[contact-sheet] open it and review before integrating.');
