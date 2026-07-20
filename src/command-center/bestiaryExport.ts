/**
 * BESTIARY ASSET EXPORT — packages current enemy source art, gameplay-scale
 * crops, a Contact-47 scale reference, technical metadata and a short
 * replacement-art brief into a downloadable ZIP.
 *
 * Two capture paths, used depending on where the Command Center is running:
 *  - `hd-atlas` entries (the real td-* sprites): cropped straight from the
 *    shipped atlas (public/assets/topdown/topdown-z1.{webp,json}) via fetch +
 *    canvas — works everywhere, including the standalone dashboard.
 *  - `procedural-runtime` / `composited-runtime` entries have no static image
 *    file; their pixels only exist once a live Phaser.Game has generated them
 *    (BootScene → ProceduralArt/sweepTextures). When the Command Center is
 *    mounted in-game we read the exact generated canvas back out of the
 *    TextureManager. In the standalone page (no Phaser instance) we can't —
 *    the export says so plainly instead of guessing.
 */
import JSZip from 'jszip';
import type Phaser from 'phaser';
import { BUILD_VERSION } from '../game/config';
import { CONTACT47_SCALE_REF, type BestiaryEnemyEntry, type BestiaryHazardEntry } from '../game/data/bestiaryData';

const ATLAS_IMAGE = '/assets/topdown/topdown-z1.webp';
const ATLAS_JSON = '/assets/topdown/topdown-z1.json';

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}
interface AtlasJson {
  frames: Record<string, AtlasFrame>;
}

let atlasCache: { image: HTMLImageElement; json: AtlasJson } | null | undefined;

async function loadAtlas(): Promise<{ image: HTMLImageElement; json: AtlasJson } | null> {
  if (atlasCache !== undefined) return atlasCache;
  try {
    const [json, image] = await Promise.all([
      fetch(ATLAS_JSON, { cache: 'no-store' }).then((r) => (r.ok ? (r.json() as Promise<AtlasJson>) : null)),
      new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = ATLAS_IMAGE;
      }),
    ]);
    atlasCache = json && image ? { image, json } : null;
  } catch {
    atlasCache = null;
  }
  return atlasCache;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** Crop one frame out of the shipped HD atlas. Works standalone (no game needed). */
async function cropAtlasFrame(frameName: string): Promise<Blob | null> {
  const atlas = await loadAtlas();
  const f = atlas?.json.frames[frameName];
  if (!atlas || !f) return null;
  const canvas = document.createElement('canvas');
  canvas.width = f.frame.w;
  canvas.height = f.frame.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(atlas.image, f.frame.x, f.frame.y, f.frame.w, f.frame.h, 0, 0, f.frame.w, f.frame.h);
  return canvasToBlob(canvas);
}

/** Read a procedurally-generated texture's actual pixels back out of a live Phaser.Game. */
function captureGeneratedTexture(game: Phaser.Game, key: string): Blob | null | Promise<Blob | null> {
  if (!game.textures.exists(key)) return null;
  const src = game.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = 'width' in src ? src.width : 0;
  const h = 'height' in src ? src.height : 0;
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(src as CanvasImageSource, 0, 0);
  return canvasToBlob(canvas);
}

/** A pure-canvas Contact-47 vs. enemy silhouette scale bar — no game instance required. */
function buildScaleReferenceCanvas(entry: BestiaryEnemyEntry): HTMLCanvasElement {
  const pad = 24;
  const baseline = 90;
  const scale = 4; // 4x so small (10-40px) sprites are legible as blocks
  const playerH = CONTACT47_SCALE_REF.hitboxH * scale;
  const playerW = CONTACT47_SCALE_REF.hitboxW * scale;
  const enemyH = Math.max(entry.dims.nativeH, entry.hitbox.h, 8) * scale;
  const enemyW = Math.max(entry.dims.nativeW, entry.hitbox.w, 8) * scale;
  const w = pad * 3 + playerW + enemyW;
  const h = pad * 2 + baseline;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#1c2a33';
  ctx.beginPath();
  ctx.moveTo(0, h - pad);
  ctx.lineTo(w, h - pad);
  ctx.stroke();
  // Contact-47 reference block
  ctx.fillStyle = '#35ffd5';
  ctx.fillRect(pad, h - pad - playerH, playerW, playerH);
  ctx.fillStyle = '#9fb0c0';
  ctx.font = '10px monospace';
  ctx.fillText(`CONTACT-47 ${CONTACT47_SCALE_REF.hitboxW}×${CONTACT47_SCALE_REF.hitboxH}px`, pad, h - pad + 14);
  // enemy reference block
  const ex = pad * 2 + playerW;
  ctx.fillStyle = '#ff4b5c';
  ctx.fillRect(ex, h - pad - enemyH, enemyW, enemyH);
  ctx.fillStyle = '#9fb0c0';
  ctx.fillText(`${entry.name} ${entry.dims.nativeW || entry.hitbox.w}×${entry.dims.nativeH || entry.hitbox.h}px`, ex, h - pad + 14);
  return canvas;
}

function buildEnemyMetadata(entry: BestiaryEnemyEntry) {
  return {
    id: entry.id,
    name: entry.name,
    internalId: entry.internalId,
    zones: entry.zones,
    asset: entry.asset,
    dims: entry.dims,
    origin: entry.origin,
    hitbox: entry.hitbox,
    perspective: entry.perspective,
    facing: entry.facing,
    rotation: entry.rotation,
    animation: entry.animation,
    shadow: entry.shadow,
    playerOverlap: entry.playerOverlap,
    tuning: entry.tuning,
    implementationStatus: entry.implementationStatus,
    knownIssues: entry.knownIssues,
    replacement: entry.replacement,
    sourceRefs: entry.sourceRefs,
    contact47ScaleRef: CONTACT47_SCALE_REF,
    buildVersion: BUILD_VERSION,
  };
}

function buildEnemyBriefMarkdown(entry: BestiaryEnemyEntry): string {
  return `# Replacement Art Brief — ${entry.name}

**Internal ID:** ${entry.internalId}
**Zones:** ${entry.zones.join(', ')}
**Implementation status:** ${entry.implementationStatus}

## Silhouette intent
${entry.silhouetteIntent}

## Required replacement dimensions
- Dimensions: ${entry.replacement.dims}
- Padding: ${entry.replacement.padding}
- Directional variants: ${entry.replacement.directionalVariants}
- Effect layers: ${entry.replacement.effectLayers}

## Current rendering facts (do not change without a code follow-up)
- Native texture size: ${entry.dims.nativeW}×${entry.dims.nativeH}px (${entry.dims.renderedNote})
- Origin: ${entry.origin}
- Hitbox: ${entry.hitbox.w}×${entry.hitbox.h}px — ${entry.hitbox.note}
- Perspective: ${entry.perspective}
- Facing: ${entry.facing}
- Rotation: ${entry.rotation}
- Animation: ${entry.animation}
- Shadow: ${entry.shadow}
- Player overlap / depth: ${entry.playerOverlap}

## Known visual issues to fix
${entry.knownIssues.length ? entry.knownIssues.map((i) => `- ${i}`).join('\n') : '- None flagged.'}

## Scale reference
Contact-47's hitbox is ${CONTACT47_SCALE_REF.hitboxW}×${CONTACT47_SCALE_REF.hitboxH}px. See scale-reference.png in this package.

## Source
${entry.sourceRefs.map((r) => `- ${r}`).join('\n')}

_Generated by the BLIP Command Center Bestiary — build ${BUILD_VERSION}._
`;
}

async function addEnemyAssetsToZip(zip: JSZip, entry: BestiaryEnemyEntry, game?: Phaser.Game): Promise<string[]> {
  const notes: string[] = [];
  const folder = zip.folder(entry.id)!;

  if (entry.asset.kind === 'hd-atlas') {
    for (const key of entry.asset.textureKeys) {
      const blob = await cropAtlasFrame(key);
      if (blob) folder.file(`${key}.png`, blob);
      else notes.push(`Could not crop atlas frame "${key}" — atlas fetch failed or frame missing.`);
    }
  } else if (game) {
    for (const key of entry.asset.textureKeys) {
      const blob = await captureGeneratedTexture(game, key);
      if (blob) folder.file(`${key}.png`, blob);
      else notes.push(`Texture "${key}" not found in the live TextureManager (scene may not have generated it yet).`);
    }
  } else {
    notes.push(
      `This enemy's art is generated at runtime (${entry.asset.sourceFile}) — no static source file exists. ` +
        `Open the Command Center IN-GAME (press C during play, not the standalone /command-center.html page) and re-run this export to capture the actual generated pixels.`
    );
  }

  const scaleBlob = await canvasToBlob(buildScaleReferenceCanvas(entry));
  if (scaleBlob) folder.file('scale-reference.png', scaleBlob);

  folder.file('metadata.json', JSON.stringify(buildEnemyMetadata(entry), null, 2));
  folder.file('REPLACEMENT_ART_BRIEF.md', buildEnemyBriefMarkdown(entry));
  if (notes.length) folder.file('NOTES.txt', notes.join('\n'));
  return notes;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Per-enemy "Asset Export" action — one ZIP for a single Bestiary entry. */
export async function exportEnemyAsset(entry: BestiaryEnemyEntry, game?: Phaser.Game): Promise<void> {
  const zip = new JSZip();
  await addEnemyAssetsToZip(zip, entry, game);
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `blip-${entry.id}-asset-export.zip`);
}

/** Top-level "Export Enemy Art Brief" — everything needed to commission replacement art in one ZIP. */
export async function exportEnemyArtBrief(
  enemies: BestiaryEnemyEntry[],
  hazards: BestiaryHazardEntry[],
  commit: string,
  generatedAt: string,
  game?: Phaser.Game
): Promise<void> {
  const zip = new JSZip();
  const allNotes: string[] = [];

  for (const entry of enemies) {
    const notes = await addEnemyAssetsToZip(zip, entry, game);
    notes.forEach((n) => allNotes.push(`[${entry.id}] ${n}`));
  }

  const hazardsFolder = zip.folder('hazards')!;
  hazardsFolder.file(
    'hazards.json',
    JSON.stringify(
      hazards.map((h) => ({
        id: h.id, name: h.name, zones: h.zones, chip: h.chip, desc: h.desc, tuning: h.tuning,
        asset: h.asset, dims: h.dims, behavior: h.behavior, knownIssues: h.knownIssues, sourceRefs: h.sourceRefs,
      })),
      null,
      2
    )
  );

  const scaleFolder = zip.folder('scale-reference')!;
  scaleFolder.file(
    'contact-47.json',
    JSON.stringify({ ...CONTACT47_SCALE_REF, buildVersion: BUILD_VERSION }, null, 2)
  );
  scaleFolder.file('signal-node.json', JSON.stringify({ note: 'Signal/Blipstream node scale reference — see src/game/data/levels.ts NODE_A for the node room grid; no single fixed node sprite dimension exists (waveform platform layout is per-room).' }, null, 2));

  if (game) {
    try {
      const shotBlob: Blob | null = await new Promise((resolve) => {
        (game.canvas as HTMLCanvasElement).toBlob((b) => resolve(b), 'image/png');
      });
      if (shotBlob) zip.file('gameplay-screenshot.png', shotBlob);
      else allNotes.push('Could not capture a gameplay screenshot (canvas.toBlob returned null).');
    } catch {
      allNotes.push('Could not capture a gameplay screenshot (canvas capture threw — likely a cross-origin texture in the frame).');
    }
  } else {
    allNotes.push('No live game session — open the Command Center IN-GAME (press C during play) to include a real gameplay screenshot.');
  }

  const briefLines = [
    `# BLIP — Enemy Art Asset Brief`,
    ``,
    `Generated: ${generatedAt}`,
    `Commit: ${commit}`,
    `Build: ${BUILD_VERSION}`,
    ``,
    `This package audits every enemy requiring replacement/upgraded art, packaged from the`,
    `Command Center Bestiary (single source of truth: src/game/data/bestiaryData.ts, which`,
    `pulls tuning numbers live from src/game/config.ts).`,
    ``,
    `## Contents`,
    `- One folder per enemy (\`<enemy-id>/\`): current source art (where capturable), a`,
    `  gameplay-scale crop, a Contact-47 scale reference, \`metadata.json\`, and a short`,
    `  \`REPLACEMENT_ART_BRIEF.md\`.`,
    `- \`hazards/hazards.json\` — fixed/environmental hazards (not requiring the same replacement`,
    `  treatment as mobile enemies, included for completeness).`,
    `- \`scale-reference/\` — Contact-47 and signal-node scale anchors.`,
    `- \`gameplay-screenshot.png\` — a live full-game capture, if this export ran in-game.`,
    `- \`enemies.json\` — flat technical metadata for every enemy in this package.`,
    ``,
    `## Roster`,
    ...enemies.map((e) => `- **${e.name}** (\`${e.id}\`) — ${e.zones.join(', ')} — ${e.implementationStatus}`),
    ``,
    allNotes.length ? `## Export notes / gaps\n${allNotes.map((n) => `- ${n}`).join('\n')}` : `## Export notes / gaps\nNone — every asset in this package was captured live.`,
    ``,
    `_Do not hand-edit gameplay tuning from this package — it is a read-only export. Tune in`,
    `src/game/config.ts and re-export._`,
  ];
  zip.file('ENEMY_ASSET_BRIEF.md', briefLines.join('\n'));
  zip.file('enemies.json', JSON.stringify(enemies.map(buildEnemyMetadata), null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `blip-enemy-art-brief-${commit.slice(0, 7)}.zip`);
}
