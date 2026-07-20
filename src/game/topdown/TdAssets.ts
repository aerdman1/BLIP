/**
 * TdAssets — loading and integrity for the HD top-down art set.
 *
 * These are the game's first real binary assets; everything else is procedural.
 * They are served same-origin from /assets/topdown/ (Vite copies public/
 * verbatim). NOTHING is ever hotlinked at runtime.
 *
 * Loading is non-fatal by design: if the atlas is missing or a frame name
 * drifts, `tdArtReady()` returns false and SweepScene renders with the existing
 * procedural pixel art instead of crashing or showing green __MISSING boxes.
 */
import Phaser from 'phaser';
import { TD_ATLAS_FRAMES, TD_TILE_KEYS, TEX } from '../config';

const BASE = 'assets/topdown';
const ATLAS = 'td-atlas';

let loadFailed = false;

/**
 * Load the top-down art in the BACKGROUND. Never blocks boot.
 *
 * Two hard-won rules are encoded here:
 *
 *  1. PROBE BEFORE QUEUEING. A dev server answers a missing file with 200 +
 *     index.html, so Phaser "loads" it, fails to parse, and retries forever —
 *     which hangs the boot screen. Fetching and validating the manifest first
 *     means a missing/!corrupt asset set is detected once, cheaply, and we
 *     simply never queue the load.
 *  2. NEVER BLOCK. This runs off create(), not preload(). If the art is slow or
 *     absent the menu still appears and the Sweep falls back to procedural art;
 *     the player is never stranded on a loading screen by an art problem.
 */
export async function loadTopDown(scene: Phaser.Scene): Promise<boolean> {
  if (scene.textures.exists(ATLAS)) return true;
  try {
    // Default caching on purpose: `force-cache` can pin a stale *bad* response
    // (e.g. a dev server's HTML 404 page) and keep the art disabled for the
    // life of the cache entry. Let normal HTTP caching apply.
    const res = await fetch(`${BASE}/topdown-z1.json`);
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) throw new Error(`manifest is ${ct || 'untyped'}, not JSON`);
    const manifest = await res.json();
    if (!manifest?.frames) throw new Error('manifest has no frames');

    await new Promise<void>((resolve) => {
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
        loadFailed = true;
        console.warn(`[TdAssets] "${file?.key}" failed — falling back to procedural art.`);
      });
      scene.load.atlas(ATLAS, `${BASE}/topdown-z1.webp`, manifest);
      for (const key of TD_TILE_KEYS) scene.load.image(key, `${BASE}/${key}.webp`);
      scene.load.start();
    });
    return !loadFailed;
  } catch (err) {
    loadFailed = true;
    console.warn(`[TdAssets] top-down art unavailable (${String(err)}) — using procedural art.`);
    return false;
  }
}

/**
 * True only when every declared key resolves to REAL art — not Phaser's
 * __MISSING placeholder, and not a frame name that drifted out of the atlas.
 * This is the guard that turns a silent art failure into a clean fallback.
 */
export function tdArtReady(scene: Phaser.Scene): boolean {
  if (loadFailed) return false;
  if (!scene.textures.exists(ATLAS)) return false;

  const atlas = scene.textures.get(ATLAS);
  if (!atlas || atlas.key === '__MISSING') return false;
  for (const frame of TD_ATLAS_FRAMES) {
    if (!atlas.has(frame)) {
      console.warn(`[TdAssets] atlas frame "${frame}" missing — falling back.`);
      return false;
    }
  }
  for (const key of TD_TILE_KEYS) {
    const t = scene.textures.get(key);
    if (!t || t.key === '__MISSING') {
      console.warn(`[TdAssets] tile "${key}" missing — falling back.`);
      return false;
    }
  }
  return true;
}

/**
 * Add an atlas frame as a standalone texture key so the rest of the code can
 * treat HD art and procedural art identically — `scene.add.image(x, y, key)`
 * works either way, and no call site needs to know about the atlas.
 */
export function bindAtlasFrames(scene: Phaser.Scene): void {
  if (!scene.textures.exists(ATLAS)) return;
  for (const frame of TD_ATLAS_FRAMES) {
    if (scene.textures.exists(frame)) continue;
    if (!scene.textures.get(ATLAS).has(frame)) continue;
    scene.textures.addSpriteSheetFromAtlas(frame, {
      atlas: ATLAS,
      frame,
      frameWidth: scene.textures.getFrame(ATLAS, frame).width,
      frameHeight: scene.textures.getFrame(ATLAS, frame).height,
    });
  }
}

/** Registry of which texture key to use for a role, HD or procedural fallback. */
export interface TdArt {
  hd: boolean;
  ground: string;
  groundLit: string;
  groundDark: string;
  path: string;
  wallTop: string;
  wallFace: string;
}

export function resolveTdArt(scene: Phaser.Scene): TdArt {
  const hd = tdArtReady(scene);
  return hd
    ? {
        hd,
        ground: TEX.tdGround,
        groundLit: TEX.tdGroundLit,
        groundDark: TEX.tdGroundDark,
        path: TEX.tdPath,
        wallTop: TEX.tdWallTop,
        wallFace: TEX.tdWallFace,
      }
    : {
        hd,
        ground: TEX.sweepGrass,
        groundLit: TEX.sweepGrass2,
        groundDark: TEX.sweepGrassDk,
        path: TEX.sweepPath,
        wallTop: TEX.sweepHedge,
        wallFace: TEX.sweepHedge,
      };
}
