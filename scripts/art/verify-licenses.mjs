#!/usr/bin/env node
/**
 * BLIP top-down art pipeline verification gate.
 *
 * Fails (exit 1) unless:
 *
 *  1. Every file under public/assets/topdown/ has a row in ASSET_SOURCES.md
 *     (external original) or GENERATED_ASSETS.md (PIL-produced), matched by
 *     exact path.
 *  2. Every ASSET_SOURCES.md row carries: source URL, license (in the CC0
 *     allowlist), attribution-required flag, retrieval date, SHA-256 of the
 *     downloaded original.
 *  3. Every GENERATED_ASSETS.md row names the producing script AND its input
 *     assets, so derived work traces back to a CC0 root.
 *  4. Any OpenGameArt-origin row additionally carries a per-asset license URL.
 *
 * Also asserts the committed byte budget for public/assets/topdown/.
 *
 * Usage: node scripts/art/verify-licenses.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ASSETS = path.join(ROOT, 'public', 'assets', 'topdown');
const SOURCES_MD = path.join(ROOT, 'ASSET_SOURCES.md');
const GENERATED_MD = path.join(ROOT, 'GENERATED_ASSETS.md');

const BUDGET_BYTES = 1.5 * 1024 * 1024;

/** Only these licenses may appear in ASSET_SOURCES.md. */
const CC0_ALLOWLIST = new Set(['CC0-1.0', 'CC0', 'PUBLIC-DOMAIN']);

const errors = [];
const err = (m) => errors.push(m);

function readTables(file) {
  if (!fs.existsSync(file)) {
    err(`${path.basename(file)} is missing`);
    return [];
  }
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|') || !t.endsWith('|')) continue;
    const cells = t.slice(1, -1).split('|').map((c) => c.trim());
    // Skip header separators (|---|---|) and header rows.
    if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
    rows.push(cells);
  }
  return rows;
}

/* -------------------- 2 + 4: ASSET_SOURCES.md integrity -------------------- */
// Columns: Original | Source URL | Direct File URL | License | Attribution Required
//          | Retrieved | SHA-256
const sourceRows = readTables(SOURCES_MD).filter(
  (r) => r.length >= 7 && !/^original$/i.test(r[0])
);
if (!sourceRows.length) err('ASSET_SOURCES.md contains no data rows');

const declaredOriginals = new Set();
for (const r of sourceRows) {
  const [orig, srcUrl, fileUrl, license, attribution, retrieved, sha] = r;
  const where = `ASSET_SOURCES.md row "${orig}"`;
  declaredOriginals.add(orig);

  if (!/^https?:\/\//.test(srcUrl)) err(`${where}: source URL missing or not http(s)`);
  if (!/^https?:\/\//.test(fileUrl)) err(`${where}: direct file URL missing or not http(s)`);
  if (!CC0_ALLOWLIST.has(license.toUpperCase()))
    err(`${where}: license "${license}" is not in the CC0 allowlist`);
  if (!/^(yes|no)$/i.test(attribution))
    err(`${where}: attribution-required flag must be yes/no, got "${attribution}"`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(retrieved))
    err(`${where}: retrieval date must be YYYY-MM-DD, got "${retrieved}"`);
  if (!/^[0-9a-f]{64}$/i.test(sha)) err(`${where}: SHA-256 missing or malformed`);

  // 4. OpenGameArt is per-asset licensed - it needs its own license URL.
  if (/opengameart/i.test(srcUrl) || /opengameart/i.test(orig)) {
    const rest = r.slice(7).join(' ');
    if (!/^https?:\/\//.test(rest.trim()) && !/https?:\/\//.test(rest))
      err(`${where}: OpenGameArt origin requires a per-asset license URL column`);
  }
}

/* ---------------- 3: GENERATED_ASSETS.md traces to a CC0 root -------------- */
// Columns: Output Path | Producing Script | Input Assets | Notes
const genRows = readTables(GENERATED_MD).filter(
  (r) => r.length >= 3 && r[0].startsWith('`public/assets/topdown/')
);
if (!genRows.length) err('GENERATED_ASSETS.md contains no output rows');

const declaredOutputs = new Map();
for (const r of genRows) {
  const outPath = r[0].replace(/`/g, '').trim();
  const script = r[1].replace(/`/g, '').trim();
  const inputs = r[2].trim();
  const where = `GENERATED_ASSETS.md row "${outPath}"`;
  declaredOutputs.set(outPath, true);

  if (!script) err(`${where}: no producing script named`);
  else if (!fs.existsSync(path.join(ROOT, script)))
    err(`${where}: producing script "${script}" does not exist`);

  if (!inputs) err(`${where}: no input assets named`);

  // Every named input must either be a declared CC0 original or an explicit
  // "procedural" marker - that is what makes the CC0 trace auditable.
  const tokens = inputs
    .replace(/`/g, '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const tok of tokens) {
    if (/^procedural\b/i.test(tok) || /^none\b/i.test(tok)) continue;
    if (declaredOriginals.has(tok)) continue;
    if (
      [...declaredOriginals].some((o) => tok.includes(o) || o.includes(tok))
    )
      continue;
    err(`${where}: input "${tok}" is not a declared ASSET_SOURCES.md original`);
  }
}

/* --------------- 1: every shipped file is accounted for -------------------- */
if (!fs.existsSync(ASSETS)) {
  err('public/assets/topdown/ does not exist');
} else {
  let total = 0;
  for (const f of fs.readdirSync(ASSETS)) {
    const rel = `public/assets/topdown/${f}`;
    total += fs.statSync(path.join(ASSETS, f)).size;
    if (!declaredOutputs.has(rel))
      err(`${rel} is shipped but has no ASSET_SOURCES.md / GENERATED_ASSETS.md row`);
  }
  for (const declared of declaredOutputs.keys()) {
    if (!fs.existsSync(path.join(ROOT, declared)))
      err(`${declared} is documented but not present on disk`);
  }
  if (total > BUDGET_BYTES)
    err(`asset budget blown: ${(total / 1024).toFixed(1)} KB > ${BUDGET_BYTES / 1024} KB`);
  console.log(
    `[licenses] public/assets/topdown/: ${(total / 1024).toFixed(1)} KB ` +
      `(budget ${BUDGET_BYTES / 1024} KB)`
  );
}

/* --------------------------------- report --------------------------------- */
if (errors.length) {
  console.error(`\n[licenses] FAILED - ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `[licenses] OK - ${sourceRows.length} CC0 originals, ${genRows.length} generated outputs, ` +
    'all traced.'
);
