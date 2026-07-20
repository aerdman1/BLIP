#!/usr/bin/env node
/**
 * BLIP top-down art pipeline — Phase 3, step 1.
 *
 * Downloads the CC0 source originals used by `process.py` into `art-src/originals/`
 * and records a manifest (`art-src/manifest.json`) carrying, for every original:
 * source page URL, direct file URL, license, attribution-required flag, retrieval
 * date and SHA-256.
 *
 * `art-src/` is gitignored — the ORIGINALS are not committed, the PROCESSED outputs
 * under `public/assets/topdown/` are. The manifest IS committed (it is the input to
 * ASSET_SOURCES.md and to verify-licenses.mjs) via `art-src/manifest.json` being
 * copied to `scripts/art/source-manifest.json`.
 *
 * Every source below is site-wide CC0 (public domain dedication, no attribution
 * required). If a source is unreachable the entry is recorded with
 * `status: "unreachable"` and `process.py` falls back to a fully PIL-generated
 * equivalent — the pipeline never stalls on a dead host.
 *
 * Usage: node scripts/art/fetch-sources.mjs [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'art-src');
const ORIG = path.join(SRC, 'originals');
const FORCE = process.argv.includes('--force');
const TIMEOUT = 120_000;

const AMBIENTCG_API = 'https://ambientcg.com/api/v2/full_json';
const POLYHAVEN_API = 'https://api.polyhaven.com';

/** Site-wide CC0 sources. `license` values must be in verify-licenses.mjs' allowlist. */
const AMBIENTCG_IDS = ['Grass004', 'Ground037', 'Rock030'];
const POLYHAVEN_SLUGS = ['aerial_grass_rock', 'aerial_ground_rock', 'aerial_rocks_02'];
const KENNEY_PAGE = 'https://kenney.nl/assets/foliage-sprites';

const CC0 = {
  license: 'CC0-1.0',
  attributionRequired: false,
};

const log = (...a) => console.log('[fetch]', ...a);
const warn = (...a) => console.warn('[fetch] WARN', ...a);

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function getJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function getText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function download(url, dest) {
  if (fs.existsSync(dest) && !FORCE) {
    log('cached', path.basename(dest));
    return dest;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  log('got', path.basename(dest), `${(buf.length / 1024).toFixed(0)} KB`);
  return dest;
}

/* ------------------------------- ambientCG -------------------------------- */
// API confirmed live: /api/v2/full_json?id=<ID>&include=downloadData returns
// downloadFolders.default.downloadFiletypeCategories.zip.downloads[] with an
// `attribute` like "1K-JPG" and a `downloadLink`.
async function fetchAmbientCG(id, entries) {
  const pageUrl = `https://ambientcg.com/view?id=${id}`;
  const apiUrl = `${AMBIENTCG_API}?id=${id}&include=downloadData`;
  try {
    const j = await getJSON(apiUrl);
    const asset = j.foundAssets?.[0];
    if (!asset) throw new Error(`asset id not found: ${id}`);
    const zips = asset.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads ?? [];
    const pick = zips.find((d) => d.attribute === '1K-JPG') ?? zips[0];
    if (!pick?.downloadLink) throw new Error(`no 1K-JPG download for ${id}`);

    const zipPath = path.join(SRC, 'zips', `${id}_1K-JPG.zip`);
    await download(pick.downloadLink, zipPath);

    // Extract only the albedo/colour map.
    const outDir = path.join(SRC, 'unzip', id);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    execFileSync('unzip', ['-qo', zipPath, '-d', outDir]);
    const found = fs
      .readdirSync(outDir)
      .filter((f) => /_Color\.(jpg|jpeg|png)$/i.test(f));
    if (!found.length) throw new Error(`no _Color map inside ${id} zip`);
    const dest = path.join(ORIG, `ambientcg_${id.toLowerCase()}_color.jpg`);
    fs.mkdirSync(ORIG, { recursive: true });
    fs.copyFileSync(path.join(outDir, found[0]), dest);

    entries.push({
      id: `ambientcg:${id}`,
      file: path.relative(ROOT, dest),
      sourcePage: pageUrl,
      fileUrl: pick.downloadLink,
      apiUrl,
      ...CC0,
      retrieved: new Date().toISOString().slice(0, 10),
      sha256: sha256(dest),
      bytes: fs.statSync(dest).size,
      status: 'ok',
    });
  } catch (err) {
    warn(`ambientCG ${id}: ${err.message}`);
    entries.push({
      id: `ambientcg:${id}`,
      file: null,
      sourcePage: pageUrl,
      apiUrl,
      ...CC0,
      retrieved: new Date().toISOString().slice(0, 10),
      status: 'unreachable',
      error: String(err.message),
    });
  }
}

/* ------------------------------- Poly Haven ------------------------------- */
async function fetchPolyHaven(slug, entries) {
  const pageUrl = `https://polyhaven.com/a/${slug}`;
  const apiUrl = `${POLYHAVEN_API}/files/${slug}`;
  try {
    const j = await getJSON(apiUrl);
    const url = j?.Diffuse?.['1k']?.jpg?.url;
    if (!url) throw new Error(`no Diffuse/1k/jpg for ${slug}`);
    const dest = path.join(ORIG, `polyhaven_${slug}_diff_1k.jpg`);
    await download(url, dest);
    entries.push({
      id: `polyhaven:${slug}`,
      file: path.relative(ROOT, dest),
      sourcePage: pageUrl,
      fileUrl: url,
      apiUrl,
      ...CC0,
      retrieved: new Date().toISOString().slice(0, 10),
      sha256: sha256(dest),
      bytes: fs.statSync(dest).size,
      status: 'ok',
    });
  } catch (err) {
    warn(`Poly Haven ${slug}: ${err.message}`);
    entries.push({
      id: `polyhaven:${slug}`,
      file: null,
      sourcePage: pageUrl,
      apiUrl,
      ...CC0,
      retrieved: new Date().toISOString().slice(0, 10),
      status: 'unreachable',
      error: String(err.message),
    });
  }
}

/* --------------------------------- Kenney --------------------------------- */
// The download link is not in a stable API; scrape the asset page for its zip.
async function fetchKenney(entries) {
  try {
    const html = await getText(KENNEY_PAGE);
    // The download button is JS-driven; the real zip lives in a /media/pages/ URL
    // embedded in the page source rather than in an href.
    const m =
      html.match(/(https?:\/\/[^"'\s<>]*\.zip)/i) ||
      html.match(/href="([^"]*\.zip)"/i);
    if (!m) throw new Error('no zip link found on asset page');
    const url = new URL(m[1], KENNEY_PAGE).toString();
    const zipPath = path.join(SRC, 'zips', 'kenney_foliage-sprites.zip');
    await download(url, zipPath);
    const outDir = path.join(SRC, 'unzip', 'kenney-foliage');
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    execFileSync('unzip', ['-qo', zipPath, '-d', outDir]);
    entries.push({
      id: 'kenney:foliage-sprites',
      file: path.relative(ROOT, outDir),
      sourcePage: KENNEY_PAGE,
      fileUrl: url,
      ...CC0,
      retrieved: new Date().toISOString().slice(0, 10),
      sha256: sha256(zipPath),
      bytes: fs.statSync(zipPath).size,
      status: 'ok',
    });
  } catch (err) {
    warn(`Kenney foliage-sprites: ${err.message}`);
    entries.push({
      id: 'kenney:foliage-sprites',
      file: null,
      sourcePage: KENNEY_PAGE,
      ...CC0,
      retrieved: new Date().toISOString().slice(0, 10),
      status: 'unreachable',
      error: String(err.message),
    });
  }
}

/* ---------------------------------- main ---------------------------------- */
const entries = [];
fs.mkdirSync(ORIG, { recursive: true });

for (const id of AMBIENTCG_IDS) await fetchAmbientCG(id, entries);
for (const slug of POLYHAVEN_SLUGS) await fetchPolyHaven(slug, entries);
await fetchKenney(entries);

const manifest = {
  generatedAt: new Date().toISOString(),
  note: 'All sources are site-wide CC0 (public domain). No attribution required.',
  entries,
};
fs.writeFileSync(path.join(SRC, 'manifest.json'), JSON.stringify(manifest, null, 2));
// Committed copy — ASSET_SOURCES.md and verify-licenses.mjs read this, not art-src/.
fs.writeFileSync(
  path.join(ROOT, 'scripts/art/source-manifest.json'),
  JSON.stringify(manifest, null, 2)
);

const ok = entries.filter((e) => e.status === 'ok').length;
log(`done — ${ok}/${entries.length} sources retrieved`);
if (ok === 0) {
  console.error('[fetch] ERROR: no sources retrieved at all; process.py will fully generate.');
}
