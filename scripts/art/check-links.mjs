#!/usr/bin/env node
/**
 * BLIP top-down art pipeline - Phase 3 link gate.
 *
 * Per TOPDOWN_VISUAL_PLAN.md:
 *   1. HEAD-follow every URL in ASSET_SOURCES.md and GENERATED_ASSETS.md;
 *      a non-200 fails. (The plan's example of why: kenney.nl/assets/
 *      topdown-shooter is a 404 - the correct slug is top-down-shooter.)
 *   2. grep src/ for any remote URL reaching a Phaser loader - zero tolerance.
 *      Assets must be served same-origin from public/assets/topdown/.
 *
 * Exits non-zero on any failure.
 *
 * Usage: node scripts/art/check-links.mjs [--offline]
 *   --offline skips step 1 (useful on a plane / in a sandbox); step 2 still runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DOCS = ['ASSET_SOURCES.md', 'GENERATED_ASSETS.md'].map((f) => path.join(ROOT, f));
const OFFLINE = process.argv.includes('--offline');

const errors = [];

/* ------------------------ 1. every documented URL 200 --------------------- */
const urls = new Set();
for (const doc of DOCS) {
  if (!fs.existsSync(doc)) {
    errors.push(`${path.basename(doc)} is missing`);
    continue;
  }
  const text = fs.readFileSync(doc, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s)<>|`"']+/g)) {
    urls.add(m[0].replace(/[.,;]+$/, ''));
  }
}

if (OFFLINE) {
  console.log(`[links] offline mode - skipping ${urls.size} HTTP check(s)`);
} else {
  console.log(`[links] checking ${urls.size} URL(s)...`);
  for (const url of [...urls].sort()) {
    let code = '000';
    try {
      code = execFileSync(
        'curl',
        ['-sIL', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '30', url],
        { encoding: 'utf8' }
      ).trim();
    } catch {
      code = '000';
    }
    // Some CDNs reject HEAD; retry with a ranged GET before calling it dead.
    if (code !== '200') {
      try {
        code = execFileSync(
          'curl',
          ['-sL', '-o', '/dev/null', '-r', '0-0', '-w', '%{http_code}', '--max-time', '30', url],
          { encoding: 'utf8' }
        ).trim();
      } catch {
        /* keep the failing code */
      }
    }
    const ok = code === '200' || code === '206';
    console.log(`  ${ok ? 'ok ' : 'FAIL'} ${code}  ${url}`);
    if (!ok) errors.push(`${url} returned HTTP ${code}`);
  }
}

/* ---------------- 2. no remote URL reaching a Phaser loader --------------- */
// Zero tolerance: every runtime asset must be same-origin. A CDN URL inside a
// this.load.* call would work in dev and then break offline, break the service
// worker's cache-first strategy, and leak a third-party dependency into a
// shipped build.
const SRC = path.join(ROOT, 'src');
const LOADER_RE =
  /\b(?:this\.)?load\s*\.\s*(?:image|atlas|spritesheet|audio|json|binary|bitmapFont|svg|texture|multiatlas|video|glsl|scenePlugin|plugin|pack|html|css|xml|text|tilemapTiledJSON|obj|sceneFile)\s*\(/;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|jsx)$/.test(entry.name)) continue;
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/https?:\/\//.test(line)) return;
      // A URL in a comment is documentation, not a fetch.
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (!/https?:\/\//.test(code)) return;
      // Flag when a remote URL shares a line with a loader call, and also flag
      // any remote URL in the 2 lines preceding one (multi-line load calls).
      const window = lines.slice(i, i + 3).join('\n');
      if (LOADER_RE.test(window)) {
        errors.push(
          `${path.relative(ROOT, p)}:${i + 1} remote URL reaching a Phaser loader: ${code.trim()}`
        );
      }
    });
  }
}
if (fs.existsSync(SRC)) walk(SRC);
console.log('[links] src/ scanned for remote URLs in Phaser loader calls');

if (errors.length) {
  console.error(`\n[links] FAILED - ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('[links] OK');
