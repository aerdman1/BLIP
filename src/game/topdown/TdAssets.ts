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
import { TD_ATLAS_FRAMES } from '../config';
import type { TdBiomeDef } from './TdBiomes';

const BASE = 'assets/topdown';

/** Phaser texture key for a biome's atlas. Namespaced per atlas so two biomes'
 *  art can be resident at once without clobbering each other. */
const atlasKey = (atlas: string) => `td-atlas:${atlas}`;

/**
 * Per-atlas failure state.
 *
 * This was a single module-level boolean, which meant ONE missing atlas
 * permanently disabled HD art for every biome for the life of the session —
 * including biomes whose art had loaded fine. Keyed per atlas, a zone with
 * missing art falls back alone.
 */
const loadFailed = new Map<string, boolean>();

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
export async function loadTopDown(scene: Phaser.Scene, biome: TdBiomeDef): Promise<boolean> {
  const KEY = atlasKey(biome.atlas);
  if (scene.textures.exists(KEY)) return true;
  if (loadFailed.get(biome.atlas)) return false; // already known bad — don't refetch
  try {
    // Default caching on purpose: `force-cache` can pin a stale *bad* response
    // (e.g. a dev server's HTML 404 page) and keep the art disabled for the
    // life of the cache entry. Let normal HTTP caching apply.
    const res = await fetch(`${BASE}/${biome.atlas}.json`);
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) throw new Error(`manifest is ${ct || 'untyped'}, not JSON`);
    const manifest = await res.json();
    if (!manifest?.frames) throw new Error('manifest has no frames');

    await new Promise<void>((resolve) => {
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
        loadFailed.set(biome.atlas, true);
        console.warn(`[TdAssets] "${file?.key}" failed — falling back to procedural art.`);
      });
      scene.load.atlas(KEY, `${BASE}/${biome.atlas}.webp`, manifest);
      // Tile files are per-biome and named by their texture key, so two biomes
      // never contend for the same key (see TdBiomes tile naming).
      for (const key of tileKeysOf(biome)) scene.load.image(key, `${BASE}/${key}.webp`);
      scene.load.start();
    });
    return !loadFailed.get(biome.atlas);
  } catch (err) {
    loadFailed.set(biome.atlas, true);
    console.warn(`[TdAssets] ${biome.atlas} unavailable (${String(err)}) — using procedural art.`);
    return false;
  }
}

/** The six tileSprite keys a biome needs as individual files. */
function tileKeysOf(biome: TdBiomeDef): string[] {
  const t = biome.tiles;
  return [t.ground, t.groundLit, t.groundDark, t.path, t.wallTop, t.wallFace];
}

/**
 * True only when every declared key resolves to REAL art — not Phaser's
 * __MISSING placeholder, and not a frame name that drifted out of the atlas.
 * This is the guard that turns a silent art failure into a clean fallback.
 */
export function tdArtReady(scene: Phaser.Scene, biome: TdBiomeDef): boolean {
  if (loadFailed.get(biome.atlas)) return false;
  const KEY = atlasKey(biome.atlas);
  if (!scene.textures.exists(KEY)) return false;

  const atlas = scene.textures.get(KEY);
  if (!atlas || atlas.key === '__MISSING') return false;
  for (const frame of framesOf(biome)) {
    if (!atlas.has(frame)) {
      console.warn(`[TdAssets] ${biome.atlas} frame "${frame}" missing — falling back.`);
      return false;
    }
  }
  for (const key of tileKeysOf(biome)) {
    const t = scene.textures.get(key);
    if (!t || t.key === '__MISSING') {
      console.warn(`[TdAssets] tile "${key}" missing — falling back.`);
      return false;
    }
  }
  return true;
}

/**
 * Every atlas frame this biome needs: the SHARED actor set (player, drones,
 * elite, node — identical across zones, since the cast does not change when the
 * scenery does) plus the biome's own props and landmarks.
 */
function framesOf(biome: TdBiomeDef): string[] {
  const own = [
    ...biome.skirt,
    ...biome.scatter,
    ...biome.bank,
    ...biome.landmarks.flatMap(([body, emis]) => (emis ? [body, emis] : [body])),
  ];
  if (biome.canopy) own.push(biome.canopy);
  return [...new Set([...TD_ATLAS_FRAMES, ...own])];
}

/**
 * Add an atlas frame as a standalone texture key so the rest of the code can
 * treat HD art and procedural art identically — `scene.add.image(x, y, key)`
 * works either way, and no call site needs to know about the atlas.
 */
export function bindAtlasFrames(scene: Phaser.Scene, biome: TdBiomeDef): void {
  const KEY = atlasKey(biome.atlas);
  if (!scene.textures.exists(KEY)) return;
  const atlas = scene.textures.get(KEY);
  const source = atlas.getSourceImage() as CanvasImageSource;

  for (const frameName of framesOf(biome)) {
    if (scene.textures.exists(frameName)) continue;
    if (!atlas.has(frameName)) continue;
    const f = scene.textures.getFrame(KEY, frameName);
    if (!f) continue;

    // Blit the frame into its own canvas texture.
    //
    // NOT addSpriteSheetFromAtlas: that ignores TRIM metadata, so a packed
    // (trimmed) frame resolves to a raw rectangle of the atlas — you get the
    // sprite plus slabs of whatever was packed next to it, rendered as an
    // opaque block. Blitting by the frame's cut rect is exact, handles trim,
    // and costs one canvas per sprite once at boot.
    const w = Math.max(1, Math.round(f.realWidth || f.cutWidth));
    const h = Math.max(1, Math.round(f.realHeight || f.cutHeight));
    const ct = scene.textures.createCanvas(frameName, w, h);
    if (!ct) continue;
    ct.context.clearRect(0, 0, w, h);
    ct.context.drawImage(
      source,
      f.cutX, f.cutY, f.cutWidth, f.cutHeight,
      f.x, f.y, f.cutWidth, f.cutHeight // f.x/f.y restore the trimmed offset
    );
    ct.refresh();
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

export function resolveTdArt(scene: Phaser.Scene, biome: TdBiomeDef): TdArt {
  const hd = tdArtReady(scene, biome);
  return { hd, ...(hd ? biome.tiles : biome.fallback) };
}
