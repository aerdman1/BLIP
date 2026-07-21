/**
 * Procedural pixel art — every texture in BLIP is generated here at boot.
 * Rules live in .claude/skills/procedural-pixel-art: locked palette, strong
 * silhouettes, symbolic shapes, native pixel scale (no sub-pixel drawing).
 */
import Phaser from 'phaser';
import { VIEW_H, VIEW_W, PALETTE as P, TEX } from '../config';

type G = Phaser.GameObjects.Graphics;

/** deterministic pseudo-random so textures are stable run-to-run */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

const px = (g: G, x: number, y: number, c: number, a = 1) => {
  g.fillStyle(c, a);
  g.fillRect(x, y, 1, 1);
};

const rect = (g: G, x: number, y: number, w: number, h: number, c: number, a = 1) => {
  g.fillStyle(c, a);
  g.fillRect(x, y, w, h);
};

/** scatter n single pixels inside a box */
function speckle(g: G, rng: () => number, x: number, y: number, w: number, h: number, c: number, n: number, a = 1) {
  for (let i = 0; i < n; i++) px(g, x + Math.floor(rng() * w), y + Math.floor(rng() * h), c, a);
}

/**
 * Mark a texture LINEAR (bilinear) so it stays SMOOTH when scaled — the way
 * AAA 2D games render light/glow/bloom: crisp nearest-filtered pixel sprites,
 * but a separate smooth lighting layer that never shows blocky "light squares".
 */
function linearize(scene: Phaser.Scene, key: string): void {
  const t = scene.textures.get(key);
  if (t) t.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** A high-res, smooth radial glow (white → transparent), LINEAR-filtered. */
function radialGlow(scene: Phaser.Scene, key: string, size: number, stops: Array<[number, number]>): void {
  if (scene.textures.exists(key)) return;
  const ct = scene.textures.createCanvas(key, size, size);
  if (!ct) return;
  const ctx = ct.context;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [pos, alpha] of stops) grad.addColorStop(pos, `rgba(255,255,255,${alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ct.refresh();
  linearize(scene, key);
}

/* ---- shared ATMOSPHERE helpers (depth-graded realism, reused per zone) ---- */
/** hex int → css rgba string */
const rgba = (c: number, a: number): string => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
/** paint onto a smooth (LINEAR-filtered) canvas texture — for painterly distance */
function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const ct = scene.textures.createCanvas(key, w, h);
  if (!ct) return;
  paint(ct.context);
  ct.refresh();
  linearize(scene, key);
}
/** a drifting fog/haze BAND: soft, low-lying, tileable (color at bottom, clear at top) */
function fogBandTex(scene: Phaser.Scene, key: string, w: number, h: number, color: number, maxA: number): void {
  canvasTex(scene, key, w, h, (ctx) => {
    // a few soft blobs so it isn't a flat wash, over a bottom-weighted gradient
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(1, rgba(color, maxA * 0.6));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    let seed = (w * 131 + h * 17) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff);
    for (let i = 0; i < 14; i++) {
      const cx = rnd() * w;
      const cy = h * 0.5 + rnd() * h * 0.5;
      const r = h * 0.4 + rnd() * h * 0.5;
      const blob = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      blob.addColorStop(0, rgba(color, maxA * 0.5));
      blob.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = blob;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
/** a soft cinematic vignette (transparent center → dark edges) over the full view */
function vignetteTex(scene: Phaser.Scene, key: string, w: number, h: number, edge: number, strength: number): void {
  canvasTex(scene, key, w, h, (ctx) => {
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 0.92);
    v.addColorStop(0, rgba(edge, 0));
    v.addColorStop(1, rgba(edge, strength));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  });
}

/* ============================== master generate ============================= */

export function generateAllTextures(scene: Phaser.Scene): void {
  const rng = makeRng(0x47b11f);

  /* ---- primitives ---- */
  tex(scene, TEX.px, 2, 2, (g) => rect(g, 0, 0, 2, 2, P.white));
  tex(scene, TEX.spark, 3, 3, (g) => {
    px(g, 1, 0, P.white); px(g, 0, 1, P.white); px(g, 1, 1, P.white); px(g, 2, 1, P.white); px(g, 1, 2, P.white);
  });
  // GLOW — the game's universal light sprite. Kept SMALL (16px) so every
  // use-site's scale stays the size it was designed for, and LINEAR-filtered so
  // it's SMOOTH (never blocky "light squares") no matter how far it's scaled.
  radialGlow(scene, TEX.glow8, 16, [
    [0, 0.95],
    [0.35, 0.5],
    [0.7, 0.14],
    [1, 0],
  ]);
  tex(scene, TEX.ring, 64, 64, (g) => {
    g.lineStyle(2, P.white, 1); g.strokeCircle(32, 32, 30);
    g.lineStyle(1, P.white, 0.4); g.strokeCircle(32, 32, 27);
  });
  linearize(scene, TEX.ring); // scan rings stay smooth as they expand

  // noise canvas (static bursts / glitch)
  if (!scene.textures.exists(TEX.noise)) {
    const ct = scene.textures.createCanvas(TEX.noise, 64, 64);
    if (ct) {
      const ctx = ct.context;
      const img = ctx.createImageData(64, 64);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(rng() * 255);
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
        img.data[i + 3] = rng() > 0.55 ? 190 : 0;
      }
      ctx.putImageData(img, 0, 0);
      ct.refresh();
    }
  }

  /* ---- terrain tiles (layered Chagrin ravine soil, moonlit from the left) ---- */
  const ROCK = 0x565f70;
  const ROCK_DK = 0x3a4152;
  const ROOT = 0x3a2a1a;

  /** shared soil body: a moonlit top-down gradient (warm-lit top → cool-dark
   *  depth) with striations, pebbles and dithered band transitions. The
   *  gradient is what makes the ground read as lit earth, not a flat tile. */
  const soilBody = (g: G) => {
    rect(g, 0, 0, 16, 16, P.dirt);
    // vertical light gradient: brighter/warmer near the surface, cool-dark below
    rect(g, 0, 0, 16, 2, 0x5c4a33); // moonlit topsoil
    rect(g, 0, 2, 16, 2, 0x4f3e2b);
    rect(g, 0, 10, 16, 3, 0x3a2c1d, 0.6); // deepening
    rect(g, 0, 13, 16, 3, 0x2b2015, 0.75); // cool shadow at the bottom
    // striation courses with dithered edges (reads as compressed strata)
    for (const [y, a] of [[4, 0.3], [8, 0.35], [12, 0.4]] as Array<[number, number]>) {
      rect(g, 0, y, 16, 1, P.dirtDark, a);
      for (let x = (y % 3) as number; x < 16; x += 3) px(g, x, y - 1, 0x54432f, 0.4); // dither above the band
    }
    speckle(g, rng, 0, 2, 16, 12, P.dirtDark, 8);
    speckle(g, rng, 0, 1, 16, 6, 0x64513a, 5, 0.5); // lit grit up top
  };

  tex(scene, TEX.tileGrass, 16, 16, (g) => {
    soilBody(g);
    // grass cap with a bright moonlit rim on the very top row
    rect(g, 0, 0, 16, 5, P.grass);
    rect(g, 0, 1, 16, 1, P.grassLit);
    rect(g, 0, 0, 16, 1, 0xbfeeb0, 0.85); // sharp moonlight rim (reads as lit edge)
    rect(g, 0, 4, 16, 1, P.grassDark);
    // mossy overhang tongues dipping into the soil (breaks the flat line)
    for (const mx of [2, 7, 11]) {
      rect(g, mx, 5, 2, 2, P.grassDark);
      px(g, mx, 6, P.moss);
    }
    px(g, 5, 5, P.grass); px(g, 13, 5, P.grass);
    speckle(g, rng, 0, 0, 16, 2, 0x9fe0a0, 6, 0.8); // dewy blade highlights
    speckle(g, rng, 1, 2, 14, 3, P.moss, 5, 0.7);
  });

  tex(scene, TEX.tileDirt, 16, 16, (g) => soilBody(g));
  tex(scene, TEX.tileDirtRock, 16, 16, (g) => {
    soilBody(g);
    g.fillStyle(ROCK_DK, 1); g.fillEllipse(6, 10, 7, 6); // embedded stone
    g.fillStyle(ROCK, 0.85); g.fillEllipse(6, 10, 5, 4);
    px(g, 4, 8, 0x6b7488, 0.55); // top-left moonlight
  });
  tex(scene, TEX.tileDirtBrick, 16, 16, (g) => {
    soilBody(g);
    // old ravine masonry poking through the soil
    rect(g, 2, 5, 12, 7, P.brickShade);
    rect(g, 3, 6, 5, 2, P.brick); rect(g, 9, 6, 4, 2, P.brickWarm);
    rect(g, 3, 9, 4, 2, P.brickWarm); rect(g, 8, 9, 5, 2, P.brick);
    rect(g, 2, 8, 12, 1, P.brickShade); // mortar course
    rect(g, 8, 5, 1, 7, P.brickShade);
    px(g, 3, 6, 0x8a5a44, 0.7);
  });
  tex(scene, TEX.tileDirtRoot, 16, 16, (g) => {
    soilBody(g);
    // a root threading down through the soil
    for (const [rx, ry] of [[10, 2], [10, 3], [9, 4], [9, 5], [8, 6], [8, 7], [7, 8], [7, 9], [6, 10], [6, 11], [5, 12], [5, 13]] as Array<[number, number]>) {
      px(g, rx, ry, ROOT);
    }
    px(g, 11, 4, ROOT); px(g, 8, 8, ROOT); px(g, 4, 12, ROOT); // hairs
    px(g, 10, 2, 0x4d3a26, 0.8);
  });

  // mossy shelf: grass top, rocky underside, dangling root
  tex(scene, TEX.mossShelf, 16, 16, (g) => {
    rect(g, 0, 0, 16, 4, P.grass);
    rect(g, 0, 0, 16, 1, P.grassLit);
    rect(g, 0, 3, 16, 1, P.grassDark);
    for (const mx of [3, 9, 13]) rect(g, mx, 4, 2, 1, P.grassDark);
    rect(g, 0, 4, 16, 3, P.dirt);
    rect(g, 0, 7, 16, 3, ROCK_DK); // rocky underside
    rect(g, 0, 7, 16, 1, P.dirtDark);
    px(g, 3, 8, ROCK, 0.7); px(g, 11, 8, ROCK, 0.6);
    rect(g, 7, 10, 1, 4, ROOT); px(g, 6, 12, ROOT); px(g, 8, 13, ROOT); // hanging root
    speckle(g, rng, 0, 0, 16, 2, P.grassLit, 4);
  });

  tex(scene, TEX.tileHidden, 16, 16, (g) => {
    rect(g, 0, 0, 16, 10, P.signal, 0.22);
    rect(g, 0, 0, 16, 1, P.signal, 0.95);
    rect(g, 0, 9, 16, 1, P.signal, 0.5);
    rect(g, 0, 0, 1, 10, P.signal, 0.6);
    rect(g, 15, 0, 1, 10, P.signal, 0.6);
    px(g, 7, 4, P.white, 0.9); px(g, 8, 4, P.white, 0.9);
  });

  /* ---- terrain edge & personality decorations ---- */
  // chipped cliff face (drawn on the LEFT edge; flip for right). Ragged, mossy.
  tex(scene, TEX.cliffEdge, 4, 16, (g) => {
    rect(g, 0, 0, 4, 16, 0x000000, 0.28); // ambient-occlusion shade
    rect(g, 0, 0, 1, 16, P.dirtDark, 0.7);
    for (let y = 1; y < 16; y += 3) px(g, (y % 6 === 1 ? 1 : 2), y, ROCK, 0.5); // pebble chips
    px(g, 1, 2, P.moss, 0.8); px(g, 2, 5, P.moss, 0.7); px(g, 1, 11, P.moss, 0.6); // moss clumps
    px(g, 2, 8, 0x4d3a26, 0.6);
  });
  // grass fringe that hangs off a surface tile's front over a drop
  tex(scene, TEX.grassOverhang, 16, 6, (g) => {
    for (let x = 0; x < 16; x += 2) {
      const len = 2 + Math.floor(rng() * 3);
      rect(g, x, 0, 1, len, P.grassDark);
      if (rng() < 0.5) px(g, x, len, P.moss, 0.8);
      if (rng() < 0.4) px(g, x, 0, P.grassLit);
    }
    px(g, 4, 3, P.moss); px(g, 10, 4, P.moss);
  });
  // roots/vines drooping from an overhang underside
  tex(scene, TEX.rootDrip, 8, 12, (g) => {
    rect(g, 2, 0, 1, 9, ROOT); px(g, 2, 9, 0x4d3a26);
    rect(g, 5, 0, 1, 6, ROOT); px(g, 3, 4, ROOT); px(g, 5, 6, P.moss, 0.7);
    px(g, 2, 3, P.moss, 0.6);
  });
  // a buried signal node embedded in the soil — pulses at runtime
  tex(scene, TEX.buriedNode, 12, 12, (g) => {
    g.fillStyle(ROCK_DK, 1); g.fillCircle(6, 6, 6);
    g.fillStyle(0x0a1410, 1); g.fillCircle(6, 6, 4);
    g.lineStyle(1, P.signalDim, 0.9); g.strokeCircle(6, 6, 4);
    rect(g, 5, 3, 2, 6, P.signal, 0.9); rect(g, 3, 5, 6, 2, P.signal, 0.9); // plus-glyph core
    px(g, 5, 5, P.white); px(g, 6, 6, P.white);
  });
  // faint scan glyph decal for cliff faces (revealed by moonlight/scan)
  tex(scene, TEX.scanGlyph, 14, 14, (g) => {
    g.lineStyle(1, P.signalDim, 0.55);
    g.strokeCircle(7, 7, 5);
    g.strokeCircle(7, 7, 2);
    g.lineBetween(7, 0, 7, 2); g.lineBetween(7, 12, 7, 14);
    g.lineBetween(0, 7, 2, 7); g.lineBetween(12, 7, 14, 7);
    px(g, 7, 7, P.signal, 0.7);
  });
  // a small carved "47" marker plate
  tex(scene, TEX.marker47, 14, 12, (g) => {
    rect(g, 0, 0, 14, 12, P.stoneDark);
    rect(g, 0, 0, 14, 1, 0x6b7488, 0.6);
    rect(g, 1, 1, 12, 10, 0x2a3140);
    // "4"
    rect(g, 3, 3, 1, 4, P.signal); rect(g, 3, 5, 3, 1, P.signal); rect(g, 5, 2, 1, 7, P.signal);
    // "7"
    rect(g, 8, 3, 3, 1, P.signal); rect(g, 10, 3, 1, 6, P.signal); px(g, 9, 6, P.signal);
  });
  tex(scene, TEX.grassTuft, 7, 6, (g) => {
    px(g, 1, 2, P.grassLit); px(g, 1, 3, P.grass); px(g, 1, 4, P.grass); px(g, 1, 5, P.grassDark);
    px(g, 3, 0, P.grassLit); px(g, 3, 1, P.grass); px(g, 3, 2, P.grass); px(g, 3, 3, P.grass); px(g, 3, 4, P.grassDark); px(g, 3, 5, P.grassDark);
    px(g, 5, 1, P.grassLit); px(g, 5, 2, P.grass); px(g, 5, 3, P.grass); px(g, 5, 4, P.grassDark); px(g, 5, 5, P.grassDark);
  });
  tex(scene, TEX.fence, 16, 16, (g) => {
    rect(g, 2, 4, 2, 12, P.fence);
    rect(g, 12, 4, 2, 12, P.fence);
    rect(g, 0, 6, 16, 2, P.fence);
    rect(g, 0, 11, 16, 2, P.fence);
    px(g, 2, 4, P.dirtDark); px(g, 12, 4, P.dirtDark);
  });

  /* ---- props ---- */
  tex(scene, TEX.scannerRig, 22, 22, (g) => {
    // tripod
    rect(g, 10, 8, 2, 12, P.hillMid);
    rect(g, 5, 16, 2, 6, P.hillMid);
    rect(g, 15, 16, 2, 6, P.hillMid);
    // dish head
    rect(g, 4, 3, 14, 6, P.islandRock);
    rect(g, 5, 2, 12, 1, P.uiDim);
    rect(g, 6, 9, 10, 1, P.dirtDark);
    // red lens
    rect(g, 15, 5, 3, 2, P.danger);
    px(g, 17, 5, P.white);
    // little dials
    px(g, 6, 5, P.warning); px(g, 8, 5, P.signalDim);
  });
  tex(scene, TEX.signalBox, 15, 13, (g) => {
    rect(g, 1, 3, 13, 9, P.islandRock);
    rect(g, 1, 3, 13, 1, P.uiDim);
    rect(g, 2, 12, 11, 1, P.dirtDark);
    // panel + wires
    rect(g, 3, 5, 4, 4, P.dirtDark);
    px(g, 4, 6, P.signalGreen); px(g, 5, 7, P.danger);
    // antenna
    rect(g, 11, 0, 1, 3, P.uiDim);
    px(g, 11, 0, P.scoutChip);
    // Chip's tiny orange spark mark
    px(g, 9, 6, P.scoutChip); px(g, 10, 7, P.scoutChip); px(g, 9, 8, P.scoutChip); px(g, 8, 7, P.scoutChip); px(g, 9, 7, P.white);
  });
  tex(scene, TEX.doorGlyph, 32, 48, (g) => {
    rect(g, 0, 0, 32, 48, P.islandRock);
    rect(g, 0, 0, 32, 2, P.hillMid);
    rect(g, 0, 0, 2, 48, P.hillMid);
    rect(g, 30, 0, 2, 48, P.dirtDark);
    // crop-circle glyph
    g.lineStyle(1, P.signalDim, 1);
    g.strokeCircle(16, 22, 10);
    g.strokeCircle(16, 22, 5);
    g.strokeCircle(16, 40, 3);
    g.lineBetween(16, 32, 16, 37);
    g.lineBetween(6, 22, 2, 22);
    g.lineBetween(26, 22, 30, 22);
    px(g, 16, 22, P.signal);
    speckle(g, rng, 2, 2, 28, 44, P.dirtDark, 16, 0.7);
  });
  tex(scene, TEX.nodePortal, 26, 36, (g) => {
    g.fillStyle(P.black, 0.9);
    g.fillEllipse(13, 18, 20, 32);
    g.lineStyle(2, P.signal, 0.9);
    g.strokeEllipse(13, 18, 20, 32);
    g.lineStyle(1, P.signalGreen, 0.5);
    g.strokeEllipse(13, 18, 14, 24);
    // waveform squiggle
    for (let i = 0; i < 12; i++) px(g, 7 + i, 18 + Math.round(Math.sin(i * 1.1) * 3), P.signal, 0.9);
  });

  /* ---- parallax layers ---- */
  if (!scene.textures.exists(TEX.sky)) {
    const ct = scene.textures.createCanvas(TEX.sky, VIEW_W, VIEW_H);
    if (ct) {
      const ctx = ct.context;
      const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, '#070a1e');
      grad.addColorStop(0.45, '#101b3e');
      grad.addColorStop(0.78, '#27356b');
      grad.addColorStop(0.93, '#4b3a58');
      grad.addColorStop(1, '#b96a3c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ct.refresh();
    }
  }
  // shared depth-grade layers: a cinematic vignette (all zones) + Miller's dusk fog
  vignetteTex(scene, TEX.vignette, VIEW_W, VIEW_H, 0x05070f, 0.5);
  fogBandTex(scene, TEX.millerFog, 480, 62, 0x4a5578, 0.42);
  tex(scene, TEX.stars, 128, 128, (g) => {
    for (let i = 0; i < 42; i++) {
      const x = Math.floor(rng() * 128);
      const y = Math.floor(rng() * 128);
      px(g, x, y, P.star, 0.25 + rng() * 0.75);
    }
  });
  /*
   * SEAMLESS PARALLAX LAYERS.
   * Every scrolling strip is 480px wide and mathematically tileable:
   *  - ridge contours are sums of sine harmonics whose periods divide the
   *    texture width exactly (integer k in sin(2πkx/W)) → the loop closes;
   *  - every blob/tree near an edge is stamped three times at x, x±W so
   *    shapes flow across the wrap instead of clipping at it.
   * The repeat boundary is therefore invisible in both Field and Menu scenes.
   */
  const W = 480;
  const TAU = Math.PI * 2;

  tex(scene, TEX.clouds, W, 76, (g) => {
    // Clean, solid moonlit clouds — a soft opaque body with a lit top rim.
    // Bottoms sit on a shared line so they read as horizontal clouds, not wavy
    // blobs; NO hard base rule and NO dark under-shadow (that made a "line").
    const puff = (cx: number, cy: number, r: number, c: number, a: number) => {
      g.fillStyle(c, a);
      for (const off of [-W, 0, W]) g.fillCircle(cx + off, cy, r);
    };
    // lumpy on top, flat along the bottom (all base puffs share dy≈0)
    const shape: Array<[number, number, number]> = [
      [-26, 0, 11],
      [-13, 0, 13],
      [0, 0, 14],
      [13, 0, 13],
      [26, 0, 11],
      [-8, -8, 11],
      [9, -7, 10],
      [0, -13, 8],
    ];
    for (let i = 0; i < 6; i++) {
      const cx = (i * 92 + rng() * 26) % W;
      const cy = 26 + rng() * 18;
      const s = 0.8 + rng() * 0.4;
      // body — fully opaque so it never looks translucent/blurry
      for (const [dx, dy, r] of shape) puff(cx + dx * s, cy + dy * s, r * s, P.cloud, 1);
      // moonlit top rim only (upper puffs), a thin lighter cap
      for (const [dx, dy, r] of shape)
        if (dy < 0) puff(cx + dx * s, cy + dy * s - 1, r * s * 0.66, 0xc4cfee, 1);
    }
  });

  /** seamless ridge: harmonics k must be integers so the curve loops */
  const ridge = (
    g: G,
    base: number,
    texH: number,
    color: number,
    rim: number,
    harmonics: Array<[number, number, number]> // [k, amplitude, phase]
  ) => {
    for (let x = 0; x < W; x++) {
      let y = base;
      for (const [k, amp, ph] of harmonics) y += Math.sin((TAU * k * x) / W + ph) * amp;
      const yi = Math.round(y);
      g.fillStyle(color, 1);
      g.fillRect(x, yi, 1, texH - yi);
      g.fillStyle(rim, 0.8); // faint moonlit rim so the landscape reads
      g.fillRect(x, yi, 1, 1);
    }
  };

  // furthest ridge — a faint blue-violet layer for atmospheric depth
  tex(scene, TEX.hillsBack, W, 70, (g) => {
    ridge(g, 24, 70, 0x18213f, 0x2a3a63, [
      [1, 7, 2.2],
      [4, 9, 0.3],
      [9, 4, 3.6],
    ]);
  });
  tex(scene, TEX.hillsFar, W, 80, (g) => {
    ridge(g, 32, 80, P.hillFar, 0x1c2a4c, [
      [2, 9, 1.1],
      [5, 7, 2.4],
      [11, 3, 0.7],
    ]);
  });
  tex(scene, TEX.hillsMid, W, 90, (g) => {
    ridge(g, 44, 90, P.hillMid, 0x25355c, [
      [3, 8, 0.4],
      [7, 6, 1.9],
      [13, 3, 4.2],
    ]);
    // tree silhouettes along the ridge, stamped wrap-safe
    for (let i = 0; i < 14; i++) {
      const tx = Math.floor(rng() * W);
      let ty = 44;
      for (const [k, amp, ph] of [
        [3, 8, 0.4],
        [7, 6, 1.9],
        [13, 3, 4.2],
      ] as Array<[number, number, number]>) {
        ty += Math.sin((TAU * k * tx) / W + ph) * amp;
      }
      ty = Math.round(ty) + 1;
      g.fillStyle(P.hillFar, 1);
      for (const off of [-W, 0, W]) {
        g.fillTriangle(tx + off, ty - 9, tx - 4 + off, ty, tx + 4 + off, ty);
        g.fillRect(tx + off, ty, 1, 4);
      }
    }
  });
  tex(scene, TEX.island, 92, 70, (g) => {
    // sculpted floating land chunk — uneven rocky underside, mossy cap, roots
    const rockTop = 12;
    // craggy underside: taper the width toward the bottom point, jaggedly
    for (let y = rockTop; y < 60; y++) {
      const t = (y - rockTop) / (60 - rockTop);
      const half = Math.round((40 - t * 34) + Math.sin(y * 0.9) * (1 - t) * 3);
      const cx = 46 + Math.round(Math.sin(y * 0.5) * 2);
      g.fillStyle(t > 0.6 ? 0x141d2c : P.islandRock, 1);
      g.fillRect(cx - half, y, half * 2, 1);
      if (y % 4 === 0) { g.fillStyle(P.dirtDark, 0.5); g.fillRect(cx - half, y, half * 2, 1); } // strata
    }
    // soil band + mossy grass cap (moonlit)
    rect(g, 6, rockTop - 2, 80, 3, P.dirt);
    rect(g, 6, rockTop - 4, 80, 3, P.grassDark);
    rect(g, 8, rockTop - 5, 76, 2, P.grass);
    rect(g, 8, rockTop - 5, 76, 1, P.grassLit);
    speckle(g, rng, 8, rockTop - 6, 76, 2, P.grassLit, 10);
    // overhang moss tongues around the rim
    for (let mx = 10; mx < 82; mx += 7) rect(g, mx, rockTop - 1, 2, 2, P.grassDark);
    // hanging roots + vines of varied length
    for (let i = 0; i < 9; i++) {
      const x = 12 + i * 8 + Math.floor(rng() * 3);
      const len = 5 + Math.floor(rng() * 12);
      rect(g, x, rockTop + 6, 1, len, 0x2a2016);
      if (rng() < 0.5) px(g, x, rockTop + 6 + len, P.moss, 0.8);
    }
    // faint buried signal glyph on top (this is a Signal-touched place)
    g.lineStyle(1, P.signalDim, 0.5);
    g.strokeCircle(58, rockTop - 8, 3);
    px(g, 58, rockTop - 8, P.signal, 0.7);
  });

  /* ---- atmosphere: light, haze, mist (the "realism" layer, per the design doc) ---- */
  // soft moonlight god-ray shafts — drawn on a blurred canvas with per-shaft
  // gradients that fade to nothing, then LINEAR-filtered → smooth, never blocky.
  if (!scene.textures.exists(TEX.moonRays)) {
    const RW = 240;
    const RH = 210;
    const ct = scene.textures.createCanvas(TEX.moonRays, RW, RH);
    if (ct) {
      const ctx = ct.context;
      ctx.save();
      ctx.filter = 'blur(5px)'; // feathered edges = smooth light
      const ox = 22;
      const oy = -12;
      for (let i = 0; i < 6; i++) {
        const ang = 0.66 + i * 0.13;
        const far = 280;
        const spread = 5;
        const x1 = ox + Math.cos(ang) * far;
        const y1 = oy + Math.sin(ang) * far;
        const nx = -Math.sin(ang) * spread;
        const ny = Math.cos(ang) * spread;
        const grad = ctx.createLinearGradient(ox, oy, x1, y1);
        grad.addColorStop(0, 'rgba(255,243,201,0.11)');
        grad.addColorStop(0.6, 'rgba(255,243,201,0.05)');
        grad.addColorStop(1, 'rgba(255,243,201,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(x1 + nx, y1 + ny);
        ctx.lineTo(x1 - nx, y1 - ny);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ct.refresh();
      linearize(scene, TEX.moonRays);
    }
  }
  // distance haze — a horizon fog band (transparent top → cool blue → fade)
  if (!scene.textures.exists(TEX.distHaze)) {
    const ct = scene.textures.createCanvas(TEX.distHaze, 8, 48);
    if (ct) {
      const ctx = ct.context;
      const grad = ctx.createLinearGradient(0, 0, 0, 48);
      grad.addColorStop(0, 'rgba(42,58,99,0)');
      grad.addColorStop(0.55, 'rgba(42,58,99,0.5)');
      grad.addColorStop(1, 'rgba(30,42,74,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 8, 48);
      ct.refresh();
    }
  }
  // low ground mist — a soft wispy fog strip that drifts through the gorge
  tex(scene, TEX.groundMist, 96, 18, (g) => {
    for (let i = 0; i < 5; i++) {
      const cx = rng() * 96;
      const cy = 9 + Math.sin(i) * 3;
      g.fillStyle(0xc9dcf2, 0.06);
      for (const off of [-96, 0, 96]) g.fillEllipse(cx + off, cy, 40 + rng() * 40, 10);
    }
  });
  // a lush hanging vine with little leaves (ledge decoration)
  tex(scene, TEX.vine, 8, 26, (g) => {
    let x = 3;
    for (let y = 0; y < 26; y++) {
      if (y % 5 === 2) x += rng() < 0.5 ? 1 : -1;
      x = Math.max(1, Math.min(6, x));
      px(g, x, y, 0x2a3a26);
      if (y % 4 === 0) px(g, x + (y % 8 === 0 ? 1 : -1), y, P.foliage, 0.9); // leaves
      if (rng() < 0.12) px(g, x, y, P.moss, 0.9);
    }
  });

  // warm dithered moon with craters
  tex(scene, TEX.moon, 44, 44, (g) => {
    g.fillStyle(P.moon, 1);
    g.fillCircle(22, 22, 20);
    g.fillStyle(P.moonDark, 1);
    g.fillCircle(15, 14, 4);
    g.fillCircle(29, 24, 3);
    g.fillCircle(18, 31, 2.5);
    g.fillCircle(31, 12, 2);
    // dither shading along the lower-left limb
    for (let i = 0; i < 90; i++) {
      const a = Math.PI * 0.4 + rng() * Math.PI * 0.75;
      const r = 12 + rng() * 8;
      px(g, Math.round(22 + Math.cos(a) * r), Math.round(22 + Math.sin(a) * r), P.moonDark, 0.7);
    }
  });

  // windmill: tower + separate blades (rotated at runtime)
  tex(scene, TEX.windmillTower, 30, 66, (g) => {
    const c = P.hillMid;
    g.lineStyle(2, c, 1);
    g.lineBetween(4, 66, 13, 4);
    g.lineBetween(26, 66, 17, 4);
    g.lineStyle(1, c, 1);
    for (let i = 1; i < 6; i++) {
      const y = 66 - i * 11;
      const half = 11 - i * 1.6;
      g.lineBetween(15 - half, y, 15 + half, y);
    }
    rect(g, 12, 0, 6, 7, c);
    px(g, 14, 2, P.windowLight); // little warm light in the head
  });
  tex(scene, TEX.windmillBlades, 46, 46, (g) => {
    const c = P.hillMid;
    g.lineStyle(2, c, 1);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      g.lineBetween(23, 23, 23 + Math.cos(a) * 20, 23 + Math.sin(a) * 20);
      // blade paddle
      const bx = 23 + Math.cos(a) * 14;
      const by = 23 + Math.sin(a) * 14;
      g.lineStyle(4, c, 0.85);
      g.lineBetween(bx, by, 23 + Math.cos(a) * 20, 23 + Math.sin(a) * 20);
      g.lineStyle(2, c, 1);
    }
    rect(g, 21, 21, 4, 4, P.dirtDark);
  });

  // telephone pole (wires drawn at runtime between poles)
  tex(scene, TEX.telephonePole, 20, 46, (g) => {
    const c = P.hillMid;
    rect(g, 9, 2, 2, 44, c);
    rect(g, 2, 4, 16, 2, c); // crossarm
    rect(g, 4, 8, 12, 1, c); // lower arm
    px(g, 3, 3, P.windowLight, 0.9);
    px(g, 16, 3, P.windowLight, 0.9);
    px(g, 9, 1, P.dirtDark);
  });

  tex(scene, TEX.towerSilhouette, 56, 140, (g) => {
    const c = P.hillMid;
    // legs narrowing upward + cross braces
    g.lineStyle(2, c, 1);
    g.lineBetween(6, 140, 24, 12);
    g.lineBetween(50, 140, 32, 12);
    g.lineStyle(1, c, 1);
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      const y = 140 - t * 128;
      const halfw = 22 - t * 18;
      g.lineBetween(28 - halfw, y, 28 + halfw, y);
      if (i < 7) {
        const y2 = 140 - (i + 1) * 16;
        const hw2 = 22 - ((i + 1) / 8) * 18;
        g.lineBetween(28 - halfw, y, 28 + hw2, y2);
        g.lineBetween(28 + halfw, y, 28 - hw2, y2);
      }
    }
    // mast + dish
    rect(g, 27, 2, 2, 12, c);
    rect(g, 24, 6, 3, 3, c);
    px(g, 28, 1, P.danger); // aircraft light (blinks via overlay glow at runtime)
  });

  /* ---- CONTACT-47: the signal-being (16×20 hero sprite, design-sheet pass) ----
   * `accent` = the eye/antenna/signal color; for scout skins it's the scout
   * color plus a small chest emblem, so each skin reads at a glance while
   * staying recognizably CONTACT-47 wearing that frequency. */
  const drawContact47 = (g: G, hurt: boolean, accent: number = P.signal, emblem = false) => {
    // curved antenna with a signal tip (glow added at runtime)
    rect(g, 9, 1, 1, 3, P.slate);
    px(g, 9, 1, P.slateDark, 0.6); // antenna base shade
    px(g, 8, 2, P.shellRim, 0.4); // antenna catch-light
    px(g, 10, 1, P.slate);
    px(g, 10, 0, hurt ? P.uiDim : accent);
    /* rounded cream shell — full 3-tone FORM ramp: light crown, midtone body,
       deep belly shadow, plus a cool moonlit rim down the shaded edge. Same
       silhouette as before (crown y4, body y5-16, hip y17) so nothing breaks. */
    rect(g, 4, 4, 8, 1, P.shellMid); // crown base
    rect(g, 3, 5, 10, 12, P.shellMid); // body midtone base
    rect(g, 4, 17, 8, 1, P.shellMid); // hip round
    rect(g, 3, 5, 10, 4, P.shellWhite); // lit upper band (light from top)
    rect(g, 4, 4, 6, 1, P.shellHi); // crown catch-light
    rect(g, 3, 5, 1, 9, P.shellWhite); // lit left edge
    px(g, 3, 5, P.shellHi); // top-left brightest pixel
    px(g, 4, 5, P.shellHi, 0.8);
    rect(g, 12, 6, 1, 10, P.shellShade); // shaded right edge
    rect(g, 11, 10, 1, 7, P.shellShade, 0.55); // inner shade falloff
    rect(g, 4, 16, 8, 1, P.shellDeep, 0.55); // belly shadow
    rect(g, 4, 17, 8, 1, P.shellDeep, 0.85); // hip underside shadow
    px(g, 12, 7, P.shellRim, 0.8); // cool rim light, upper
    px(g, 12, 8, P.shellRim, 0.45);
    px(g, 12, 14, P.shellRim, 0.7); // cool rim light, lower
    px(g, 12, 15, P.shellRim, 0.4);
    px(g, 4, 4, P.shellDeep, 0.5); // corner rounding
    px(g, 11, 4, P.shellDeep, 0.5);
    // dark rounded visor faceplate with an upper sheen
    rect(g, 4, 7, 8, 4, P.faceplate);
    rect(g, 5, 6, 6, 1, P.faceplate);
    rect(g, 5, 11, 6, 1, P.faceplate);
    rect(g, 5, 6, 6, 1, P.faceplateLit, 0.9); // glass sheen along the top
    px(g, 4, 7, P.faceplateLit, 0.6);
    if (hurt) {
      // ✕ ✕ — the "archived as swamp gas" face
      for (const ex of [5, 9]) {
        px(g, ex, 7, accent); px(g, ex + 1, 8, accent); px(g, ex, 9, accent);
        px(g, ex + 1, 7, accent, 0.5); px(g, ex, 8, accent, 0.4); px(g, ex + 1, 9, accent, 0.5);
      }
    } else {
      // big expressive eyes: soft inner bloom → bright accent → white catch-light
      rect(g, 4, 8, 3, 2, P.visorGlow, 0.16);
      rect(g, 9, 8, 3, 2, P.visorGlow, 0.16);
      rect(g, 5, 7, 2, 3, accent);
      rect(g, 9, 7, 2, 3, accent);
      px(g, 6, 9, P.signalDim, 0.7); // lower-eye shadow (roundness)
      px(g, 10, 9, P.signalDim, 0.7);
      px(g, 5, 7, 0xffffff, 0.95); // glints
      px(g, 9, 7, 0xffffff, 0.95);
      px(g, 8, 8, P.visorGlow, 0.35); // faint scanner line between the eyes
    }
    // little side arms — with a lit top and shaded underside
    rect(g, 2, 9, 1, 4, P.slate);
    rect(g, 13, 9, 1, 4, P.slate);
    px(g, 2, 9, P.shellRim, 0.4);
    px(g, 13, 9, P.slateDark);
    px(g, 2, 8, P.slateDark);
    px(g, 13, 8, P.slateDark);
    // casing seam + panel line; scout skins wear a colored chest emblem
    rect(g, 4, 13, 8, 1, P.shellShade, 0.5);
    rect(g, 4, 12, 8, 1, P.shellWhite, 0.25); // seam highlight above the line
    if (emblem) {
      rect(g, 6, 13, 4, 2, accent, 0.9); // scout badge on the chest
      px(g, 7, 13, 0xffffff, 0.8);
    } else {
      px(g, 5, 14, P.warning, 0.9); // small hazard fleck (panel light)
      px(g, 6, 14, P.warning, 0.45);
      px(g, 10, 14, P.shellRim, 0.5); // tiny cool indicator
    }
    // thruster skirt (glow rendered live underneath)
    rect(g, 4, 18, 8, 1, P.slate);
    rect(g, 5, 19, 6, 1, P.slateDark);
    px(g, 4, 18, P.shellRim, 0.35); // rim catch on the skirt edge
  };
  tex(scene, TEX.player, 16, 20, (g) => drawContact47(g, false));
  tex(scene, TEX.playerHurt, 16, 20, (g) => drawContact47(g, true));
  // per-skin bodies — same silhouette, scout-colored accent + chest emblem
  ([
    [TEX.playerWill, P.scoutWill],
    [TEX.playerChip, P.scoutChip],
    [TEX.playerHenry, P.scoutHenry],
    [TEX.playerCameron, P.scoutCameron],
    [TEX.playerDanny, P.scoutDanny],
  ] as Array<[string, number]>).forEach(([key, col]) => {
    tex(scene, key, 16, 20, (g) => drawContact47(g, false, col, true));
  });

  /* ---- scout relics (Signal-Set power piece) + scout echo apparition ---- */
  const relic = (key: string, col: number, draw: (g: G) => void) => {
    tex(scene, key, 14, 14, (g) => {
      draw(g);
      px(g, 6, 6, 0xffffff, 0.5);
      void col;
    });
  };
  relic(TEX.relicWill, P.scoutWill, (g) => {
    // route map
    rect(g, 2, 3, 10, 8, P.scoutWill, 0.9); rect(g, 2, 3, 10, 1, 0xffffff, 0.5);
    for (let x = 3; x < 12; x += 3) rect(g, x, 4, 1, 6, 0x0a2530, 0.6); // grid marks
    rect(g, 4, 5, 6, 4, 0x0a2530, 0.3); px(g, 7, 7, 0xffffff); // route dot
  });
  relic(TEX.relicChip, P.scoutChip, (g) => {
    // power cell
    rect(g, 4, 2, 6, 10, P.scoutChip); rect(g, 4, 2, 1, 10, 0xffffff, 0.5);
    rect(g, 5, 0, 4, 2, P.slateDark); rect(g, 5, 4, 4, 1, 0x6d221e); rect(g, 5, 8, 4, 1, 0x6d221e);
    rect(g, 6, 5, 2, 3, 0xffffff, 0.7);
  });
  relic(TEX.relicHenry, P.scoutHenry, (g) => {
    // signal flare / anchor stake
    rect(g, 6, 1, 2, 11, P.slate); g.fillStyle(P.scoutHenry, 1); g.fillCircle(7, 3, 3);
    g.fillStyle(0xffffff, 0.7); g.fillCircle(7, 3, 1.4);
    rect(g, 4, 11, 6, 1, P.slate); px(g, 4, 12, P.slate); px(g, 9, 12, P.slate);
  });
  relic(TEX.relicCameron, P.scoutCameron, (g) => {
    // tuning fork
    rect(g, 4, 2, 1, 6, P.scoutCameron); rect(g, 9, 2, 1, 6, P.scoutCameron);
    rect(g, 4, 8, 6, 1, P.scoutCameron); rect(g, 6, 9, 2, 4, P.scoutCameron);
    px(g, 4, 2, 0xffffff, 0.7); px(g, 9, 2, 0xffffff, 0.7);
  });
  relic(TEX.relicDanny, P.scoutDanny, (g) => {
    // cracked goggles
    g.lineStyle(1, P.scoutDanny, 1); g.strokeCircle(4, 7, 2.4); g.strokeCircle(10, 7, 2.4);
    rect(g, 6, 7, 2, 1, P.scoutDanny); rect(g, 1, 6, 1, 2, P.scoutDanny); rect(g, 12, 6, 1, 2, P.scoutDanny);
    px(g, 4, 6, 0xffffff, 0.8); px(g, 5, 8, 0x000000, 0.6); // crack
  });
  // scout echo — a soft apparition orb (tinted per scout at runtime)
  tex(scene, TEX.scoutEcho, 16, 22, (g) => {
    g.fillStyle(0xffffff, 0.16); g.fillEllipse(8, 10, 14, 20);
    g.fillStyle(0xffffff, 0.3); g.fillEllipse(8, 9, 8, 12);
    // suggestion of a small kid silhouette
    g.fillStyle(0xffffff, 0.55); g.fillEllipse(8, 5, 5, 5);
    rect(g, 5, 8, 6, 8, 0xffffff, 0.5);
    speckle(g, rng, 2, 2, 12, 18, 0xffffff, 14, 0.6);
  });
  // scout field note — a torn notebook page (tinted per scout at runtime)
  tex(scene, TEX.fieldNote, 12, 14, (g) => {
    rect(g, 1, 0, 10, 14, 0xf2ead8); // cream page
    rect(g, 1, 0, 10, 1, 0xffffff, 0.5);
    rect(g, 10, 0, 1, 14, 0x000000, 0.18); // page-edge shade
    for (let y = 3; y < 12; y += 2) rect(g, 3, y, 6, 1, P.slate, 0.5); // ruled lines
    g.fillStyle(P.signal, 0.9);
    g.fillTriangle(8, 0, 12, 0, 12, 4); // dog-ear corner
    px(g, 3, 2, P.danger, 0.7); // a doodle
  });
  tex(scene, TEX.playerGlow, 12, 6, (g) => {
    g.fillStyle(P.white, 0.32); g.fillEllipse(6, 3, 12, 6);
    g.fillStyle(P.white, 0.6); g.fillEllipse(6, 3, 7, 3);
  });
  linearize(scene, TEX.playerGlow); // small smooth thruster glow (tinted per skin at runtime)
  tex(scene, TEX.drone, 16, 12, (g) => {
    rect(g, 2, 4, 12, 5, P.islandRock);       // hull
    rect(g, 4, 3, 8, 1, P.uiDim);             // top plate
    rect(g, 2, 8, 12, 1, P.black);            // underside
    rect(g, 0, 5, 2, 2, P.hillMid);           // side pods
    rect(g, 14, 5, 2, 2, P.hillMid);
    rect(g, 6, 5, 4, 3, P.black);             // lens housing
    rect(g, 7, 6, 2, 1, P.danger);            // red eye
    px(g, 7, 6, P.white);
    px(g, 4, 2, P.uiDim); px(g, 11, 2, P.uiDim); // rotor nubs
  });
  tex(scene, TEX.cone, 96, 64, (g) => {
    // white detection cone (tinted at runtime), apex at left-middle
    g.fillStyle(P.white, 0.14); g.fillTriangle(0, 32, 96, 0, 96, 64);
    g.fillStyle(P.white, 0.16); g.fillTriangle(0, 32, 96, 12, 96, 52);
    g.fillStyle(P.white, 0.2); g.fillTriangle(0, 32, 96, 24, 96, 40);
  });
  tex(scene, TEX.boltPlayer, 8, 3, (g) => {
    rect(g, 0, 0, 8, 3, P.signal, 0.5);
    rect(g, 1, 1, 6, 1, P.signal);
    rect(g, 4, 1, 3, 1, P.white);
  });
  tex(scene, TEX.boltEnemy, 5, 5, (g) => {
    px(g, 2, 0, P.danger); px(g, 1, 1, P.danger); px(g, 2, 1, P.warning); px(g, 3, 1, P.danger);
    px(g, 0, 2, P.danger); px(g, 1, 2, P.warning); px(g, 2, 2, P.white); px(g, 3, 2, P.warning); px(g, 4, 2, P.danger);
    px(g, 1, 3, P.danger); px(g, 2, 3, P.warning); px(g, 3, 3, P.danger); px(g, 2, 4, P.danger);
  });

  /* ---- pickups & markers ---- */
  tex(scene, TEX.badgeWill, 11, 12, (g) => {
    // scout badge: cyan shield with a W-ish chevron
    rect(g, 1, 0, 9, 8, P.scoutWill);
    g.fillStyle(P.scoutWill, 1); g.fillTriangle(1, 8, 10, 8, 5.5, 12);
    rect(g, 2, 1, 7, 6, P.black, 0.55);
    px(g, 3, 3, P.white); px(g, 4, 5, P.white); px(g, 5, 3, P.white); px(g, 6, 5, P.white); px(g, 7, 3, P.white);
    rect(g, 1, 0, 9, 1, P.white, 0.7);
  });
  tex(scene, TEX.fragment, 12, 15, (g) => {
    g.fillStyle(P.signalGreen, 1);
    g.fillTriangle(6, 0, 1, 6, 11, 6);
    g.fillTriangle(1, 6, 11, 6, 6, 14);
    g.fillStyle(P.signal, 1);
    g.fillTriangle(6, 2, 3, 6, 9, 6);
    px(g, 5, 4, P.white); px(g, 6, 4, P.white); px(g, 6, 8, P.white, 0.8);
    g.lineStyle(1, P.white, 0.35);
    g.strokeTriangle(6, 0, 1, 6, 11, 6);
  });
  tex(scene, TEX.routeMarker, 9, 9, (g) => {
    // Will's chevron pointing up
    g.fillStyle(P.scoutWill, 1);
    g.fillTriangle(4.5, 0, 0, 4, 9, 4);
    rect(g, 3, 3, 3, 2, P.scoutWill);
    g.fillStyle(P.scoutWill, 0.6);
    g.fillTriangle(4.5, 4, 1, 8, 8, 8);
  });
  // roadside signpost: a weathered board with a cream EAST arrow (the road out)
  tex(scene, TEX.signpost, 20, 30, (g) => {
    rect(g, 9, 8, 2, 22, P.fence); // post
    rect(g, 9, 8, 1, 22, 0x5c4a33, 0.5); // moonlit edge
    rect(g, 8, 28, 4, 2, P.dirtDark); // base
    // board
    rect(g, 2, 7, 16, 8, P.brownstone);
    rect(g, 2, 7, 16, 1, P.trimCream, 0.4); // top catch-light
    rect(g, 2, 14, 16, 1, 0x2b2015); // bottom shade
    rect(g, 2, 7, 1, 8, P.trimCream, 0.25);
    // painted east arrow
    g.fillStyle(P.cream, 0.92);
    g.fillTriangle(16, 11, 11, 7.5, 11, 14.5); // arrowhead →
    rect(g, 4, 10, 8, 2, P.cream, 0.92); // shaft
    px(g, 3, 8, 0x241a12); px(g, 16, 8, 0x241a12); // nails
  });

  /* ---- boss: The Scarecrow Antenna ---- */
  tex(scene, TEX.bossPole, 8, 56, (g) => {
    rect(g, 3, 0, 3, 56, P.fence);
    rect(g, 3, 0, 1, 56, P.dirtDark);
    for (let y = 6; y < 56; y += 9) { rect(g, 2, y, 5, 1, P.dirtDark); px(g, 6, y, P.danger, 0.8); }
  });
  tex(scene, TEX.bossArms, 60, 12, (g) => {
    rect(g, 0, 5, 60, 2, P.fence);
    rect(g, 0, 5, 60, 1, P.dirtDark);
    // antenna fingers
    for (const x of [2, 10, 48, 56]) { rect(g, x, 0, 1, 5, P.uiDim); px(g, x, 0, P.danger); }
    for (const x of [5, 52]) { rect(g, x, 7, 1, 5, P.uiDim); px(g, x, 11, P.warning); }
    // straw tufts
    px(g, 20, 7, P.warning); px(g, 24, 8, P.duskGlow); px(g, 36, 7, P.warning); px(g, 39, 8, P.duskGlow);
  });
  tex(scene, TEX.bossHead, 24, 20, (g) => {
    rect(g, 3, 2, 18, 14, P.islandRock);      // sack head
    rect(g, 3, 2, 18, 2, P.hillMid);
    rect(g, 3, 14, 18, 2, P.dirtDark);
    rect(g, 7, 6, 3, 3, P.dangerDark);        // stitched eyes (dim until angry)
    rect(g, 15, 6, 3, 3, P.dangerDark);
    px(g, 8, 7, P.danger); px(g, 16, 7, P.danger);
    rect(g, 8, 12, 8, 1, P.dirtDark);         // stitched mouth
    px(g, 9, 11, P.dirtDark); px(g, 12, 13, P.dirtDark); px(g, 15, 11, P.dirtDark);
    rect(g, 11, 0, 2, 2, P.uiDim);            // antenna stub
    px(g, 11, 0, P.danger);
    // little dish on the side
    rect(g, 0, 7, 3, 4, P.uiDim);
    px(g, 0, 8, P.warning);
  });
  tex(scene, TEX.bossCore, 12, 12, (g) => {
    g.fillStyle(P.dangerDark, 1); g.fillCircle(6, 6, 6);
    g.fillStyle(P.danger, 1); g.fillCircle(6, 6, 4);
    g.fillStyle(P.warning, 1); g.fillCircle(6, 6, 2.4);
    px(g, 5, 4, P.white); px(g, 6, 4, P.white);
  });
  tex(scene, TEX.bossBeam, 120, 10, (g) => {
    rect(g, 0, 2, 120, 6, P.danger, 0.28);
    rect(g, 0, 4, 120, 2, P.danger, 0.85);
    rect(g, 0, 4, 60, 1, P.white, 0.5);
  });

  /* ---- signal node kit ---- */
  tex(scene, TEX.waveLedge, 16, 8, (g) => {
    rect(g, 0, 0, 16, 1, P.white, 0.9);
    rect(g, 0, 1, 16, 2, P.signal, 0.95);
    rect(g, 0, 3, 16, 3, P.signalDim, 0.8);
    rect(g, 0, 6, 16, 2, P.signal, 0.25);
  });
  tex(scene, TEX.hazardBar, 16, 8, (g) => {
    rect(g, 0, 0, 16, 8, P.dangerDark, 0.85);
    rect(g, 0, 0, 16, 1, P.danger);
    rect(g, 0, 7, 16, 1, P.danger);
    speckle(g, rng, 0, 1, 16, 6, P.danger, 10);
    speckle(g, rng, 0, 1, 16, 6, P.black, 8);
    px(g, 3, 3, P.white, 0.9); px(g, 11, 5, P.white, 0.9);
  });
  tex(scene, TEX.nodeSwitch, 16, 16, (g) => {
    // diamond socket — dim by default, tinted bright when active
    g.lineStyle(1, P.signal, 0.9);
    g.strokeRect(4, 4, 8, 8);
    g.fillStyle(P.signalDim, 0.9);
    g.fillTriangle(8, 2, 2, 8, 8, 14);
    g.fillTriangle(8, 2, 14, 8, 8, 14);
    px(g, 7, 7, P.white); px(g, 8, 7, P.white); px(g, 7, 8, P.white); px(g, 8, 8, P.white);
  });
  tex(scene, TEX.exitGate, 28, 44, (g) => {
    g.lineStyle(2, P.signalGreen, 0.9);
    g.strokeRoundedRect(2, 2, 24, 40, 8);
    g.lineStyle(1, P.signal, 0.5);
    g.strokeRoundedRect(5, 5, 18, 34, 6);
    g.fillStyle(P.black, 0.8);
    g.fillRoundedRect(6, 6, 16, 32, 6);
    for (let i = 0; i < 5; i++) rect(g, 8, 9 + i * 6, 12, 1, P.signalGreen, 0.25 + i * 0.12);
  });
  tex(scene, TEX.scanLine, 6, 136, (g) => {
    rect(g, 0, 0, 6, 136, P.danger, 0.2);
    rect(g, 2, 0, 2, 136, P.danger, 0.8);
    rect(g, 2, 0, 1, 136, P.white, 0.4);
  });
  tex(scene, TEX.gridBg, 64, 64, (g) => {
    g.lineStyle(1, P.signalDim, 0.18);
    for (let i = 0; i <= 64; i += 16) {
      g.lineBetween(i, 0, i, 64);
      g.lineBetween(0, i, 64, i);
    }
    px(g, 16, 16, P.signalDim, 0.5); px(g, 48, 48, P.signalDim, 0.5);
  });

  generateTownTextures(scene);
  generateMotelTextures(scene);
  generateStadiumTextures(scene);
}

/* ====================== Chagrin Falls title-screen kit ====================== */
/**
 * Modular town pieces for the title screen: storefront rows, the Popcorn-Shop
 * style corner store, the stone bridge, the falls, gorge walls, lamps, trees,
 * the steeple — and the Five Signal Scouts watching from the ledge.
 * Moonlight comes from the upper-left: left edges catch a cream highlight,
 * right edges fall into shade.
 */
function generateTownTextures(scene: Phaser.Scene): void {
  const rng = makeRng(0xc4a6f1);

  /* ---- a reusable brick/storefront building ---- */
  const building = (
    key: string,
    w: number,
    h: number,
    face: number,
    awning: number,
    litFrac: number,
    stepParapet: boolean
  ) => {
    tex(scene, key, w, h, (g) => {
      rect(g, 0, 0, w, h, face);
      // subtle vertical brick banding for texture (kept crisp, not noisy)
      speckle(g, rng, 0, 0, w, h, P.brickShade, Math.floor(w * h * 0.018), 0.55);
      speckle(g, rng, 0, 0, w, h, P.brickWarm, Math.floor(w * h * 0.01), 0.3);
      // cornice + optional stepped parapet — a crisp lit roofline
      rect(g, 0, 0, w, 1, P.trimCream, 0.85); // sharp top highlight
      rect(g, 0, 1, w, 1, P.trimCream, 0.4);
      rect(g, 0, 2, w, 1, P.brickShade);
      if (stepParapet) {
        rect(g, Math.floor(w / 2) - 5, 0, 10, 1, P.trimCream, 0.9);
        rect(g, Math.floor(w / 2) - 6, 1, 12, 1, P.brickShade, 0.6);
      }
      // moonlit left edge / shaded right edge (stronger separation)
      rect(g, 0, 0, 1, h, P.trimCream, 0.3);
      rect(g, w - 1, 0, 1, h, P.brickShade, 0.9);
      rect(g, w - 2, 3, 1, h - 3, 0x000000, 0.25);

      // window grid (upper floors) — crisp frames, warm-blooming lit panes
      for (let wy = 8; wy <= h - 30; wy += 13) {
        for (let wx = 4; wx <= w - 10; wx += 10) {
          const lit = rng() < litFrac;
          rect(g, wx - 1, wy - 1, 8, 10, P.brickShade, 0.85); // recess halo
          rect(g, wx, wy, 6, 8, 0x0d1018); // dark frame (crisp edge)
          if (lit) {
            rect(g, wx + 1, wy + 1, 4, 6, P.windowLight);
            rect(g, wx + 1, wy + 1, 4, 3, P.windowCore); // bright upper pane
            px(g, wx + 2, wy + 2, 0xfff4cf); // hot spot
            rect(g, wx + 1, wy + 4, 4, 1, 0xcaa25a, 0.55); // mullion (crisp)
            rect(g, wx + 3, wy + 1, 1, 6, 0xcaa25a, 0.4); // muntin
          } else {
            rect(g, wx + 1, wy + 1, 4, 6, P.slateDark);
            rect(g, wx + 1, wy + 1, 4, 2, 0x2a3346); // faint sky sheen on glass
            rect(g, wx + 1, wy + 4, 4, 1, 0x141b2a, 0.9);
          }
          rect(g, wx - 1, wy + 8, 8, 1, P.trimCream, 0.45); // bright sill
          rect(g, wx - 1, wy + 9, 8, 1, 0x000000, 0.3); // sill drop-shadow
        }
      }

      // storefront: sign band, awning, display glass, door
      const sy = h - 18;
      rect(g, 1, sy, w - 2, 4, P.slateDark);
      for (let dx = 4; dx < w - 8; dx += 9) rect(g, dx, sy + 1, 4, 1, P.trimCream, 0.75);
      rect(g, 1, sy + 4, w - 2, 4, awning);
      rect(g, 1, sy + 4, w - 2, 1, P.trimCream, 0.35);
      for (let dx = 2; dx < w - 2; dx += 4) px(g, dx, sy + 8, awning, 0.9); // scallops
      const glassW = Math.floor(w * 0.55);
      rect(g, 3, sy + 9, glassW, 8, P.windowLight);
      rect(g, 4, sy + 10, Math.floor(glassW / 2), 3, P.windowCore);
      rect(g, 2, sy + 9, 1, 8, P.brickShade);
      rect(g, 3 + glassW, sy + 9, 1, 8, P.brickShade);
      // door with lit transom
      const doorX = w - 10;
      rect(g, doorX, sy + 9, 6, 9, P.hairDark);
      rect(g, doorX + 1, sy + 9, 4, 2, P.windowLight, 0.9);
      px(g, doorX + 4, sy + 13, P.trimCream, 0.9);
    });
  };

  building(TEX.brickA, 46, 78, P.brick, P.foliage, 0.5, true);
  building(TEX.brickB, 40, 64, P.brownstone, P.shopRed, 0.42, false);
  building(TEX.brickC, 44, 84, P.brickWarm, P.slate, 0.5, true);
  building(TEX.brickD, 38, 58, P.slate, P.brick, 0.38, false);

  /* ---- the Popcorn-Shop-style corner store (the town's jewel) ---- */
  tex(scene, TEX.shopFront, 62, 58, (g) => {
    rect(g, 0, 0, 62, 58, P.trimCream); // cream facade
    speckle(g, rng, 0, 0, 62, 58, 0xc4b490, 40, 0.5);
    rect(g, 0, 0, 62, 3, P.slate); // roof cornice
    rect(g, 0, 3, 62, 1, P.slateDark);
    rect(g, 0, 0, 2, 58, P.shopBlue); // corner pilasters
    rect(g, 60, 0, 2, 58, P.shopBlueDark);
    // second-floor windows (warm)
    for (const wx of [8, 26, 44]) {
      rect(g, wx, 7, 8, 9, P.shopBlueDark);
      rect(g, wx + 1, 8, 6, 7, wx === 26 ? P.windowLight : P.slateDark);
      if (wx === 26) rect(g, wx + 2, 9, 3, 3, P.windowCore);
      rect(g, wx, 16, 8, 1, P.shopBlue);
    }
    // sign band — blue with cream "lettering" dashes
    rect(g, 2, 20, 58, 6, P.shopBlue);
    rect(g, 2, 20, 58, 1, 0x5d8cc0);
    for (let dx = 6; dx < 54; dx += 5) rect(g, dx, 22, 3, 2, P.trimCream, 0.92);
    // striped awning, scalloped
    for (let dx = 2; dx < 60; dx += 6) {
      rect(g, dx, 26, 3, 7, P.shopRed);
      rect(g, dx + 3, 26, 3, 7, 0xe8e2d2);
    }
    rect(g, 2, 26, 58, 1, 0xffffff, 0.5);
    for (let dx = 3; dx < 59; dx += 3) px(g, dx, 33, dx % 6 < 3 ? P.shopRed : 0xe8e2d2);
    // big glowing display windows + door
    rect(g, 4, 36, 24, 16, P.windowLight);
    rect(g, 6, 38, 9, 6, P.windowCore);
    rect(g, 17, 42, 8, 4, P.windowCore, 0.8);
    rect(g, 30, 36, 12, 16, P.windowLight, 0.95);
    rect(g, 32, 39, 5, 5, P.windowCore);
    rect(g, 28, 36, 2, 16, P.shopBlueDark); // mullion
    rect(g, 3, 36, 1, 16, P.shopBlueDark);
    rect(g, 42, 36, 1, 16, P.shopBlueDark);
    rect(g, 45, 36, 12, 16, P.hairDark); // door
    rect(g, 46, 37, 10, 4, P.windowLight, 0.9);
    px(g, 54, 45, P.trimCream);
    rect(g, 2, 52, 58, 2, P.slateDark); // base
    rect(g, 2, 54, 58, 4, P.stoneDark);
  });

  /* ---- stone bridge with arch ---- */
  tex(scene, TEX.bridgeSpan, 184, 36, (g) => {
    // iron railing
    for (let x = 2; x < 184; x += 8) rect(g, x, 1, 1, 7, 0x10131c);
    rect(g, 0, 0, 184, 1, 0x10131c);
    rect(g, 0, 0, 184, 1, P.trimCream, 0.18);
    rect(g, 0, 4, 184, 1, 0x10131c);
    // deck / sidewalk
    rect(g, 0, 8, 184, 6, P.bluestone);
    rect(g, 0, 8, 184, 1, 0x6a7690);
    rect(g, 0, 13, 184, 1, P.slateDark);
    // stone face with mortar courses
    rect(g, 0, 14, 184, 22, P.stone);
    for (let y = 17; y < 36; y += 5) {
      rect(g, 0, y, 184, 1, P.stoneDark, 0.7);
      for (let x = (y % 10 === 2 ? 5 : 0); x < 184; x += 11) rect(g, x, y - 4, 1, 4, P.stoneDark, 0.5);
    }
    // arch opening (the falls pours out of this)
    g.fillStyle(0x05070f, 1);
    g.fillEllipse(92, 37, 66, 42);
    g.lineStyle(2, P.stoneDark, 1);
    g.strokeEllipse(92, 37, 68, 44);
    g.lineStyle(1, P.trimCream, 0.2);
    g.strokeEllipse(92, 37, 70, 46);
    rect(g, 88, 14, 8, 4, P.stoneDark); // keystone
    rect(g, 89, 14, 6, 1, P.trimCream, 0.35);
    rect(g, 0, 14, 1, 22, P.trimCream, 0.15);
  });

  /* ---- gorge wall stone ---- */
  tex(scene, TEX.gorgeWall, 48, 48, (g) => {
    rect(g, 0, 0, 48, 48, P.stoneDark);
    for (let y = 0; y < 48; y += 6) {
      rect(g, 0, y, 48, 1, 0x0d0f18, 0.8);
      for (let x = (y % 12 === 0 ? 6 : 0); x < 48; x += 12) {
        rect(g, x, y, 1, 6, 0x0d0f18, 0.6);
        if (rng() < 0.3) rect(g, x + 2, y + 2, 3, 2, P.stone, 0.35);
      }
    }
    speckle(g, rng, 0, 0, 48, 48, P.foliage, 10, 0.5); // moss
  });

  /* ---- the falls — defined vertical sheets (crisp, not noisy static) ---- */
  tex(scene, TEX.waterfallBase, 64, 64, (g) => {
    rect(g, 0, 0, 64, 64, 0x1b2942, 0.6); // deep water sheet backing
    // regular pale streaks with slight jitter → reads as distinct falling water
    for (let x = 1; x < 64; x += 3) {
      const j = ((x * 7) % 5) - 2;
      rect(g, x + (j > 0 ? 1 : 0), 0, 1, 64, P.waterPale, 0.68);
    }
    // mid channels between the pale streaks
    for (let x = 2; x < 64; x += 6) rect(g, x, 0, 1, 64, P.waterMid, 0.45);
    // a few brightest cores for sparkle spine
    for (const sx of [8, 20, 31, 43, 55]) {
      rect(g, sx, 0, 1, 64, 0xffffff, 0.85);
      rect(g, sx + 1, 0, 1, 64, P.waterPale, 0.5);
    }
  });
  tex(scene, TEX.waterfallDashes, 64, 64, (g) => {
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(rng() * 64);
      const y = Math.floor(rng() * 64);
      const len = 3 + Math.floor(rng() * 5);
      rect(g, x, y, 1, len, 0xffffff, 0.75);
      rect(g, x, y - 64, 1, len, 0xffffff, 0.75); // seamless wrap
    }
  });
  tex(scene, TEX.waterFoam, 64, 8, (g) => {
    speckle(g, rng, 0, 0, 64, 4, 0xffffff, 70, 0.9);
    speckle(g, rng, 0, 2, 64, 5, P.waterPale, 50, 0.7);
    speckle(g, rng, 0, 5, 64, 3, P.waterMid, 26, 0.5);
  });
  tex(scene, TEX.riverGlint, 96, 22, (g) => {
    rect(g, 0, 0, 96, 22, P.riverDark);
    for (let i = 0; i < 30; i++) {
      rect(g, Math.floor(rng() * 92), Math.floor(rng() * 22), 2 + Math.floor(rng() * 3), 1, P.waterPale, 0.4 + rng() * 0.35);
    }
    for (let i = 0; i < 8; i++) {
      rect(g, Math.floor(rng() * 92), Math.floor(rng() * 22), 2, 1, P.windowLight, 0.4); // lamp reflections
    }
    for (let i = 0; i < 5; i++) {
      px(g, Math.floor(rng() * 94), Math.floor(rng() * 22), 0xffffff, 0.6);
    }
  });

  /* ---- street furniture + greenery ---- */
  tex(scene, TEX.streetLamp, 12, 32, (g) => {
    rect(g, 5, 6, 2, 24, 0x11141d);
    rect(g, 4, 29, 4, 2, 0x11141d);
    rect(g, 3, 2, 6, 5, P.windowCore);
    rect(g, 4, 3, 2, 2, 0xffffff, 0.9);
    rect(g, 3, 1, 6, 1, P.slateDark);
    px(g, 5, 0, P.slateDark);
    rect(g, 3, 7, 6, 1, P.slateDark);
  });
  tex(scene, TEX.pineTree, 16, 26, (g) => {
    g.fillStyle(P.foliageDark, 1);
    g.fillTriangle(8, 0, 2, 10, 14, 10);
    g.fillTriangle(8, 5, 1, 17, 15, 17);
    g.fillTriangle(8, 11, 0, 23, 16, 23);
    speckle(g, rng, 3, 4, 9, 16, P.foliage, 10, 0.8);
    rect(g, 7, 23, 2, 3, P.hairDark);
  });
  tex(scene, TEX.roundTree, 26, 30, (g) => {
    g.fillStyle(P.foliageDark, 1);
    g.fillCircle(13, 11, 10);
    g.fillCircle(7, 15, 7);
    g.fillCircle(19, 15, 7);
    speckle(g, rng, 4, 3, 14, 10, P.foliage, 14, 0.85); // moonlit top-left
    rect(g, 12, 22, 3, 8, P.hairDark);
    rect(g, 12, 22, 1, 8, 0x120d08);
  });
  tex(scene, TEX.bushSmall, 14, 9, (g) => {
    g.fillStyle(P.foliageDark, 1);
    g.fillCircle(4, 6, 3.5);
    g.fillCircle(9, 5, 4);
    g.fillCircle(12, 7, 2.5);
    speckle(g, rng, 2, 2, 10, 4, P.foliage, 6, 0.8);
  });
  tex(scene, TEX.railing, 32, 10, (g) => {
    rect(g, 0, 0, 32, 1, 0x0d0f16);
    rect(g, 0, 0, 32, 1, P.trimCream, 0.14);
    rect(g, 0, 4, 32, 1, 0x0d0f16);
    for (let x = 1; x < 32; x += 6) rect(g, x, 0, 1, 10, 0x0d0f16);
  });
  tex(scene, TEX.flagUs, 8, 6, (g) => {
    for (let y = 0; y < 6; y++) rect(g, 0, y, 8, 1, y % 2 === 0 ? P.shopRed : 0xe8e2d2);
    rect(g, 0, 0, 4, 3, 0x2c3e6b);
    px(g, 1, 1, 0xffffff, 0.9);
    px(g, 3, 1, 0xffffff, 0.7);
  });
  tex(scene, TEX.steeple, 26, 64, (g) => {
    rect(g, 3, 40, 20, 24, P.slateDark); // church body
    rect(g, 9, 14, 8, 50, P.slateDark); // tower
    rect(g, 9, 14, 1, 50, P.trimCream, 0.2); // moonlit edge
    g.fillStyle(P.slateDark, 1);
    g.fillTriangle(13, 0, 7, 16, 19, 16); // spire
    g.fillStyle(0x0d1120, 1);
    for (const wy of [44, 52]) rect(g, 5, wy, 3, 5, 0x0d1120);
    rect(g, 11, 30, 4, 6, 0x0d1120); // louver
    rect(g, 11, 31, 4, 1, P.slate);
    rect(g, 11, 33, 4, 1, P.slate);
    rect(g, 11, 21, 4, 4, P.windowCore); // lit clock
    px(g, 12, 22, P.hairDark);
    px(g, 13, 23, P.hairDark);
  });

  /* ---- the Five Signal Scouts, watching the falls (back view, BOYS) ----
   * Each boy has his own build: Henry (11) tall and thin; Cam and Chip (9)
   * the same height with Cam a touch broader; Will a smaller Chip with darker
   * hair; Danny (7) the youngest but with Cam's stocky frame — and the cap.
   * All textures are 13×23, feet on the bottom row, so origin(0.5,1) lines
   * everyone up on the ledge.
   */
  const kid = (
    key: string,
    shirt: number,
    hair: number,
    o: { w: number; shirtH: number; jeansH: number }
  ) => {
    tex(scene, key, 13, 23, (g) => {
      const TW = 13;
      const TH = 23;
      const total = 3 + 2 + o.shirtH + o.jeansH + 1; // hair + neck + shirt + jeans + shoes
      const top = TH - total;
      const bl = Math.floor((TW - o.w) / 2); // body left
      const br = bl + o.w - 1;
      const headW = Math.max(5, o.w - 2);
      const hl = Math.floor((TW - headW) / 2);

      // tight boy crop with rounded crown, moonlit left / shaded right
      rect(g, hl + 1, top, headW - 2, 1, hair);
      rect(g, hl, top + 1, headW, 2, hair);
      rect(g, hl + 1, top, 3, 1, 0xffffff, 0.16);
      rect(g, hl + headW - 1, top + 1, 1, 2, 0x000000, 0.28); // head shade side
      px(g, hl, top + 2, P.skin); // ears
      px(g, hl + headW - 1, top + 2, P.skin);
      rect(g, hl + 1, top + 3, headW - 2, 1, P.skin); // nape
      rect(g, hl + headW - 2, top + 3, 1, 1, 0xb98a63); // nape shade
      rect(g, 5, top + 4, 3, 1, P.skin); // neck

      // t-shirt: sloped shoulders, tapered waist, lit/shaded sides
      const sy = top + 5;
      rect(g, bl + 1, sy, o.w - 2, 1, shirt); // shoulder slope row
      rect(g, bl, sy + 1, o.w, o.shirtH - 2, shirt);
      rect(g, bl + 1, sy + o.shirtH - 1, o.w - 2, 1, shirt); // tapered hem
      rect(g, 5, sy, 3, 1, 0x000000, 0.22); // collar shadow
      rect(g, bl, sy + 1, 1, o.shirtH - 2, 0xffffff, 0.12); // moonlit side
      rect(g, br, sy + 1, 1, o.shirtH - 2, 0x000000, 0.26); // shaded side
      rect(g, bl + 1, sy + o.shirtH - 1, o.w - 2, 1, 0x000000, 0.2); // hem shade

      // short sleeves + bare forearms resting on the railing
      const armLen = Math.max(2, o.shirtH - 3);
      rect(g, bl - 1, sy + 1, 1, 2, shirt); // sleeves
      rect(g, br + 1, sy + 1, 1, 2, shirt);
      rect(g, br + 1, sy + 1, 1, 2, 0x000000, 0.18);
      rect(g, bl - 1, sy + 3, 1, armLen - 1, P.skin); // forearms
      rect(g, br + 1, sy + 3, 1, armLen - 1, P.skin);
      rect(g, bl - 1, sy + o.shirtH, 1, 1, P.skin); // hands over the rail
      rect(g, br + 1, sy + o.shirtH, 1, 1, P.skin);

      // jeans: narrower than the shirt, shaded seam, split legs
      const jy = sy + o.shirtH;
      rect(g, bl + 1, jy, o.w - 2, o.jeansH, 0x2a3140);
      rect(g, bl + 1, jy, o.w - 2, 1, 0x39445e); // waistband catch-light
      rect(g, br - 1, jy + 1, 1, o.jeansH - 1, 0x000000, 0.25); // shaded leg side
      if (o.jeansH > 1) rect(g, 6, jy + 1, 1, o.jeansH - 1, 0x05070f, 0.9); // leg gap

      // sneakers: light tops over a darker sole edge
      rect(g, bl + 1, TH - 1, 2, 1, 0xd8d2c2);
      rect(g, br - 2, TH - 1, 2, 1, 0xd8d2c2);
      px(g, bl + 2, TH - 1, 0x8f887a);
      px(g, br - 1, TH - 1, 0x8f887a);
    });
  };
  kid(TEX.kidHenry, P.scoutHenry, P.hairDark, { w: 7, shirtH: 9, jeansH: 6 }); // 11 — tall + thin
  kid(TEX.kidCameron, P.scoutCameron, P.hairBrown, { w: 9, shirtH: 7, jeansH: 4 }); // 9 — a bit broader
  kid(TEX.kidChip, P.scoutChip, 0xb5924f, { w: 8, shirtH: 7, jeansH: 4 }); // 9 — skinnier, dirty blond
  kid(TEX.kidWill, P.scoutWill, P.hairDark, { w: 7, shirtH: 6, jeansH: 3 }); // smallest — a mini Chip, darker hair
  kid(TEX.kidDanny, P.scoutDanny, P.hairBrown, { w: 8, shirtH: 6, jeansH: 4 }); // 7 — Cam's brown hair, no cap, taller than Will

  /* ---- wooded hills behind town (seamless: integer harmonics + wrap-safe pines) ---- */
  tex(scene, TEX.townHills, 480, 48, (g) => {
    const W = 480;
    const TAU = Math.PI * 2;
    const contour = (x: number) =>
      16 + Math.sin((TAU * 4 * x) / W + 0.8) * 5 + Math.sin((TAU * 9 * x) / W + 3.1) * 6 + Math.sin((TAU * 17 * x) / W + 1.7) * 2;
    g.fillStyle(0x0e1930, 1);
    for (let x = 0; x < W; x++) {
      const y = Math.round(contour(x));
      g.fillRect(x, y, 1, 48 - y);
    }
    for (let i = 0; i < 90; i++) {
      const tx = Math.floor(rng() * W);
      const ty = Math.round(contour(tx));
      const th = 3 + Math.floor(rng() * 5);
      g.fillStyle(0x0c1526, 1);
      for (const off of [-W, 0, W]) g.fillTriangle(tx + 2 + off, ty - th, tx + off, ty + 1, tx + 4 + off, ty + 1);
    }
  });
}

/* ========================= Zone 2 — Motel Nowhere ========================== */
/**
 * Neon-night roadside motel kit. The look: dark wet-asphalt silhouettes lit
 * ENTIRELY by neon — signs, switches and powered bridges are the light AND
 * the level. Crisp pixel bodies; smooth LINEAR glows layered separately.
 */
function generateMotelTextures(scene: Phaser.Scene): void {
  const rng = makeRng(0x5c0ffee);
  const W = VIEW_W;

  /* ---- sky: a bruised-purple night gradient (banded + dithered) ---- */
  canvasTex(scene, TEX.motelSky, 16, VIEW_H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, rgba(0x0a0616, 1));
    g.addColorStop(0.32, rgba(P.motelSkyTop, 1));
    g.addColorStop(0.6, rgba(P.motelSkyMid, 1));
    g.addColorStop(0.82, rgba(P.motelSkyHorizon, 1));
    g.addColorStop(1, rgba(P.motelHaze, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, VIEW_H);
    // a faint pink neon glow bleeding up from the strip below the horizon
    const ng = ctx.createLinearGradient(0, VIEW_H - 80, 0, VIEW_H);
    ng.addColorStop(0, rgba(P.neonPink, 0));
    ng.addColorStop(1, rgba(P.neonPink, 0.15));
    ctx.fillStyle = ng;
    ctx.fillRect(0, VIEW_H - 80, 16, 80);
  });
  // neon-lot fog band
  fogBandTex(scene, TEX.motelFog, 480, 60, 0x3a2a55, 0.4);

  /* ---- stars + a few colored neon glints on the horizon ---- */
  tex(scene, TEX.motelStars, W, 160, (g) => {
    speckle(g, rng, 0, 0, W, 150, P.star, 90, 0.8);
    speckle(g, rng, 0, 0, W, 150, P.star, 40, 0.4);
    for (let i = 0; i < 8; i++) px(g, Math.floor(rng() * W), 120 + Math.floor(rng() * 30), i % 2 ? P.neonPink : P.neonCyan, 0.6);
  });

  /* ---- distant purple hill ridge ---- */
  tex(scene, TEX.motelHills, W, 70, (g) => {
    for (let x = 0; x < W; x++) {
      const y = 30 + Math.sin((x / W) * Math.PI * 2 * 2 + 0.6) * 8 + Math.sin((x / W) * Math.PI * 2 * 5) * 4;
      const yi = Math.round(y);
      g.fillStyle(0x241634, 1);
      g.fillRect(x, yi, 1, 70 - yi);
      px(g, x, yi, P.motelHaze, 0.5);
    }
  });

  /* ---- distant highway billboard (parallax silhouette + faint glow) ---- */
  tex(scene, TEX.motelBillboard, 34, 40, (g) => {
    rect(g, 15, 18, 4, 22, 0x1a1220); // post
    rect(g, 0, 0, 34, 18, 0x120c1c); // board back
    rect(g, 1, 1, 32, 16, 0x1e1430);
    g.lineStyle(1, P.neonPink, 0.7); g.strokeRect(2, 3, 30, 12);
    rect(g, 5, 6, 24, 2, P.neonPink, 0.6); // abstract sign line
    rect(g, 5, 10, 14, 2, P.neonCyan, 0.5);
  });

  /* ---- wet asphalt ground tile: dark blacktop with a cool sheen + lit top ---- */
  tex(scene, TEX.wetGround, 16, 16, (g) => {
    rect(g, 0, 0, 16, 16, P.asphalt);
    rect(g, 0, 0, 16, 2, P.asphaltLit); // moonlit/neon-lit surface skin
    rect(g, 0, 2, 16, 1, 0x201a2b);
    // faint reflected-neon streaks
    speckle(g, rng, 0, 3, 16, 12, P.asphaltPuddle, 10, 0.5);
    px(g, 3, 6, P.neonCyan, 0.18); px(g, 11, 9, P.neonPink, 0.16);
    rect(g, 0, 15, 16, 1, 0x0e0b14);
  });
  tex(scene, TEX.wetGroundEdge, 16, 16, (g) => {
    rect(g, 0, 0, 16, 16, P.asphalt);
    rect(g, 0, 0, 16, 2, 0x342a44);
    speckle(g, rng, 0, 3, 16, 12, P.asphaltPuddle, 8, 0.4);
  });

  /* ---- reflective puddle (smooth) ---- */
  tex(scene, TEX.puddle, 22, 6, (g) => {
    g.fillStyle(P.asphaltPuddle, 0.85); g.fillEllipse(11, 3, 22, 6);
    g.fillStyle(P.neonCyan, 0.22); g.fillEllipse(11, 3, 16, 3);
    g.fillStyle(P.neonPink, 0.14); g.fillEllipse(8, 3, 8, 2);
    px(g, 6, 2, P.white, 0.4); px(g, 15, 3, P.white, 0.3);
  });
  linearize(scene, TEX.puddle);

  /* ---- NEON BRIDGE (powered = passable). Dark frame stays dark under tint;
         white tube core takes the group color via setTint at runtime. ---- */
  tex(scene, TEX.neonBridge, 16, 8, (g) => {
    rect(g, 0, 0, 16, 8, 0x0a0a12); // housing (near-black: survives tint)
    rect(g, 1, 1, 14, 6, 0x14141f);
    rect(g, 1, 1, 14, 2, P.white); // bright tube top (tinted to group color)
    rect(g, 2, 3, 12, 1, P.white, 0.7);
    px(g, 1, 6, P.white, 0.5); px(g, 14, 6, P.white, 0.5);
  });
  /* unpowered ghost: a dim dashed outline so you can read the route ---- */
  tex(scene, TEX.neonBridgeDark, 16, 8, (g) => {
    g.lineStyle(1, 0xffffff, 0.5);
    for (let x = 0; x < 16; x += 4) g.lineBetween(x, 1, x + 2, 1);
    for (let x = 0; x < 16; x += 4) g.lineBetween(x, 7, x + 2, 7);
    px(g, 0, 4, 0xffffff, 0.3); px(g, 15, 4, 0xffffff, 0.3);
  });

  /* ---- power switch / breaker (indicator tinted red-off / green-on) ---- */
  tex(scene, TEX.powerSwitch, 12, 16, (g) => {
    rect(g, 1, 0, 10, 16, P.fuseSteelDark);
    rect(g, 2, 1, 8, 14, P.fuseSteel);
    rect(g, 3, 2, 6, 5, 0x14171d); // indicator window (tinted at runtime)
    rect(g, 4, 3, 4, 3, P.white); // lamp (tint)
    rect(g, 4, 9, 4, 5, 0x0c0e12); // lever slot
    rect(g, 5, 9, 2, 3, P.warning); // lever knob
    g.lineStyle(1, 0x000000, 0.4); g.strokeRect(1, 0, 10, 16);
  });

  /* ---- fuse box: Chip's rewired circuit entrance (orange spark decal) ---- */
  tex(scene, TEX.fuseBox, 18, 22, (g) => {
    rect(g, 0, 0, 18, 22, P.fuseSteelDark);
    rect(g, 1, 1, 16, 20, P.fuseSteel);
    // breaker slots
    for (let i = 0; i < 3; i++) { rect(g, 3, 3 + i * 5, 5, 3, 0x0c0e12); rect(g, 4, 4 + i * 5, 3, 1, P.neonGreen, 0.8); }
    for (let i = 0; i < 3; i++) { rect(g, 10, 3 + i * 5, 5, 3, 0x0c0e12); rect(g, 11, 4 + i * 5, 3, 1, P.neonAmber, 0.8); }
    // orange spark decal (Chip's mark)
    g.fillStyle(P.scoutChip, 1);
    g.fillTriangle(9, 8, 6, 13, 9, 12); g.fillTriangle(9, 12, 12, 11, 9, 16);
    g.lineStyle(1, 0x000000, 0.4); g.strokeRect(1, 1, 16, 20);
    // cables
    rect(g, 4, 20, 1, 2, 0x0c0e12); rect(g, 13, 20, 1, 2, 0x0c0e12);
  });

  /* ---- neon signs (abstract tube glyphs — read as signage, not literal text) ---- */
  const tubeSign = (key: string, w: number, h: number, col: number, dim: number) => {
    tex(scene, key, w, h, (g) => {
      rect(g, 0, 0, w, h, 0x0b0810); // dark board
      g.lineStyle(1, dim, 0.9); g.strokeRect(1, 1, w - 2, h - 2);
      // tube "letters": vertical + horizontal segments
      const n = Math.max(3, Math.floor((w - 4) / 5));
      for (let i = 0; i < n; i++) {
        const x = 3 + i * 5;
        rect(g, x, 3, 1, h - 6, col);
        if (i % 2 === 0) rect(g, x, 3, 3, 1, col); else rect(g, x, h - 4, 3, 1, col);
        rect(g, x, Math.floor(h / 2), 3, 1, col);
      }
    });
    linearize(scene, key); // signs get a smooth bloom when scaled slightly
  };
  tubeSign(TEX.neonSignDiner, 26, 11, P.neonCyan, P.neonCyanDim);
  tubeSign(TEX.neonSignMotel, 26, 11, P.neonPink, P.neonPinkDim);
  tubeSign(TEX.neonSignVacancy, 30, 12, P.neonPink, P.neonPinkDim);

  /* ---- classic motel arrow (points to the office) ---- */
  tex(scene, TEX.neonArrow, 18, 11, (g) => {
    rect(g, 0, 4, 12, 3, P.neonAmber);
    g.fillStyle(P.neonAmber, 1); g.fillTriangle(11, 0, 11, 10, 18, 5);
    rect(g, 1, 5, 10, 1, P.white, 0.5);
  });
  linearize(scene, TEX.neonArrow);

  /* ---- ice machine (cool box glow) ---- */
  tex(scene, TEX.iceMachine, 14, 18, (g) => {
    rect(g, 0, 0, 14, 18, 0x14171d);
    rect(g, 1, 1, 12, 16, 0x1d222b);
    rect(g, 2, 2, 10, 6, P.neonCyanDim); // ICE panel
    rect(g, 3, 3, 8, 4, P.neonCyan, 0.5);
    rect(g, 2, 10, 10, 5, 0x0c0e12); // dispenser
    px(g, 4, 12, P.neonCyan, 0.7); px(g, 8, 12, P.neonCyan, 0.7);
  });

  /* ---- diner window: warm booth silhouette + bloom ---- */
  tex(scene, TEX.dinerWindow, 22, 15, (g) => {
    rect(g, 0, 0, 22, 15, 0x2a1c12);
    rect(g, 1, 1, 20, 13, P.dinerWarm);
    rect(g, 1, 1, 20, 3, P.windowCore); // brighter top
    // booth + counter silhouettes
    rect(g, 3, 8, 4, 6, 0x6e4a24);
    rect(g, 10, 6, 3, 8, 0x6e4a24);
    rect(g, 15, 9, 5, 5, 0x6e4a24);
    g.lineStyle(1, 0x1a1008, 0.8); g.strokeRect(0, 0, 22, 15);
    rect(g, 11, 1, 1, 13, 0x2a1c12, 0.7); // mullion
  });
  linearize(scene, TEX.dinerWindow);

  /* ---- security lamp: a tall pole with an OVERHEAD lamp head so its
         detection cone fans down over the walkway (emitter; cone via DetectionCone) ---- */
  tex(scene, TEX.securityLamp, 14, 44, (g) => {
    rect(g, 6, 6, 2, 38, P.fuseSteel); // pole
    rect(g, 6, 6, 1, 38, 0x565f70, 0.6); // moonlit edge
    rect(g, 4, 42, 6, 2, P.fuseSteelDark); // base
    // overhead arm + lamp housing angled down
    rect(g, 3, 5, 6, 2, P.fuseSteelDark); // arm
    rect(g, 1, 6, 6, 4, P.fuseSteelDark); // housing
    rect(g, 2, 9, 4, 2, P.dinerWarm); // bulb (shines down)
    rect(g, 2, 10, 4, 1, 0xffffff, 0.85);
    rect(g, 2, 11, 4, 1, P.danger, 0.7); // red detection lens
  });

  /* ---- motel wall block (used for building fills, subtle stucco) ---- */
  tex(scene, TEX.motelWall, 16, 16, (g) => {
    rect(g, 0, 0, 16, 16, 0x1a141f);
    rect(g, 0, 0, 16, 1, 0x2a2233);
    speckle(g, rng, 0, 2, 16, 13, 0x221a2b, 8, 0.5);
    px(g, 2, 5, P.neonPink, 0.08); px(g, 12, 10, P.neonCyan, 0.08);
  });

  /* ---- SPARK badge: orange shield with a lightning bolt ---- */
  tex(scene, TEX.badgeChip, 11, 12, (g) => {
    rect(g, 1, 0, 9, 8, P.scoutChip);
    g.fillStyle(P.scoutChip, 1); g.fillTriangle(1, 8, 10, 8, 5.5, 12);
    rect(g, 2, 1, 7, 6, P.black, 0.55);
    g.fillStyle(P.filament, 1); // lightning bolt
    g.fillTriangle(6, 1, 3, 6, 6, 5); g.fillTriangle(6, 5, 8, 5, 5, 11);
    rect(g, 1, 0, 9, 1, P.white, 0.7);
  });

  /* ================= boss: The Vacancy Sign ================= */
  // sign housing / frame (dark; letters + core drawn on top by the entity)
  tex(scene, TEX.vsFrame, 52, 30, (g) => {
    rect(g, 0, 0, 52, 30, 0x0b0810);
    rect(g, 2, 2, 48, 26, 0x160f1e);
    g.lineStyle(2, P.neonPinkDim, 1); g.strokeRect(2, 2, 48, 26);
    // dead tube segments (the sign that never clears) — dim pink
    for (let i = 0; i < 6; i++) { const x = 6 + i * 7; rect(g, x, 6, 1, 8, P.neonPinkDim); rect(g, x, 6, 4, 1, P.neonPinkDim); }
    rect(g, 6, 18, 40, 1, P.neonPinkDim, 0.7);
    // mounting posts
    rect(g, 10, 28, 3, 2, P.fuseSteelDark); rect(g, 39, 28, 3, 2, P.fuseSteelDark);
  });
  // a falling neon letter (projectile) — a bright tube block
  tex(scene, TEX.vsLetter, 9, 11, (g) => {
    rect(g, 0, 0, 9, 11, 0x0b0810);
    rect(g, 1, 1, 7, 9, P.neonPink);
    rect(g, 2, 2, 5, 7, 0x2a0f1c);
    rect(g, 2, 2, 5, 1, P.white, 0.8);
    rect(g, 2, 5, 5, 1, P.neonPink);
  });
  linearize(scene, TEX.vsLetter);
  // sweeping buzz light-bar
  tex(scene, TEX.vsBar, 120, 6, (g) => {
    rect(g, 0, 2, 120, 2, P.neonPink);
    rect(g, 0, 1, 120, 1, P.white, 0.5);
    for (let x = 0; x < 120; x += 6) px(g, x, 3, P.white, 0.5);
  });
  linearize(scene, TEX.vsBar);
  // exposed filament core (warm — the thing keeping the room lit)
  tex(scene, TEX.vsCore, 12, 12, (g) => {
    g.fillStyle(P.filament, 1); g.fillCircle(6, 6, 5);
    g.fillStyle(P.warning, 1); g.fillCircle(6, 6, 3);
    g.fillStyle(P.white, 1); g.fillCircle(6, 6, 1.5);
    // filament zigzag
    g.lineStyle(1, P.white, 0.8); g.beginPath(); g.moveTo(4, 4); g.lineTo(6, 6); g.lineTo(4, 8); g.strokePath();
  });
}

/* ===================== Chagrin Falls High (Zone 3) kit ===================== */
/**
 * Friday-night stadium above, cool underwater reflection below. Silhouette
 * bleachers + press box, volumetric light-tower cones, an orange/black Tiger
 * banner under a green ANCHOR glow, the KNOWN/UNKNOWN scoreboard, and the
 * Weather Balloon. Per the art skill: symbolic shapes, additive glow, no blur.
 */
function generateStadiumTextures(scene: Phaser.Scene): void {
  const rng = makeRng(0x71b3a0);
  const W = VIEW_W;

  /* ---- rich atmospheric sky: a smooth night gradient with a warm horizon
         bloom from the never-cut stadium lights (painterly, not banded) ---- */
  canvasTex(scene, TEX.stadiumSky, W, VIEW_H, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, rgba(0x060c1e, 1));
    sky.addColorStop(0.34, rgba(P.stadiumSkyTop, 1));
    sky.addColorStop(0.62, rgba(P.stadiumSkyMid, 1));
    sky.addColorStop(0.82, rgba(P.stadiumSkyHorizon, 1));
    sky.addColorStop(1, rgba(0x243357, 1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, VIEW_H);
    // warm sodium glow rising off the field along the whole horizon
    const glow = ctx.createLinearGradient(0, VIEW_H - 120, 0, VIEW_H);
    glow.addColorStop(0, rgba(P.nightBloom, 0));
    glow.addColorStop(0.6, rgba(0xffb85a, 0.12));
    glow.addColorStop(1, rgba(0xffcf7a, 0.3));
    ctx.fillStyle = glow;
    ctx.fillRect(0, VIEW_H - 120, W, 120);
  });

  /* ---- stars (crisp pixels — they stay sharp; the sky behind is smooth) ---- */
  tex(scene, TEX.stadiumStars, W, 150, (g) => {
    speckle(g, rng, 0, 0, W, 130, P.star, 90, 0.8);
    speckle(g, rng, 0, 0, W, 130, P.star, 40, 0.4);
    for (let i = 0; i < 6; i++) px(g, Math.floor(rng() * W), 100 + Math.floor(rng() * 24), P.nightBloom, 0.6);
  });

  /* ---- soft moon disc + halo (smooth) ---- */
  canvasTex(scene, TEX.stadiumMoon, 72, 72, (ctx) => {
    const halo = ctx.createRadialGradient(36, 36, 4, 36, 36, 36);
    halo.addColorStop(0, rgba(0xfff4d6, 0.7));
    halo.addColorStop(0.4, rgba(0xf0d488, 0.26));
    halo.addColorStop(1, rgba(0xe8c76a, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 72, 72);
    const disc = ctx.createRadialGradient(30, 30, 2, 36, 36, 16);
    disc.addColorStop(0, rgba(0xfffdf2, 1));
    disc.addColorStop(1, rgba(0xe6ce86, 1));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(36, 36, 15, 0, Math.PI * 2);
    ctx.fill();
    // faint maria for a real moon read
    ctx.fillStyle = rgba(0xd8bd72, 0.4);
    ctx.beginPath(); ctx.arc(40, 33, 3, 0, Math.PI * 2); ctx.arc(32, 40, 2.4, 0, Math.PI * 2); ctx.fill();
  });

  /* ---- drifting cloud band: soft warm-lit puffs (very hazy, far) ---- */
  canvasTex(scene, TEX.stadiumClouds, W, 110, (ctx) => {
    for (let i = 0; i < 26; i++) {
      const cx = rng() * W;
      const cy = 24 + rng() * 60;
      const r = 22 + rng() * 46;
      const puff = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      const warm = rng() > 0.6;
      puff.addColorStop(0, rgba(warm ? 0x5a5170 : 0x3a4468, 0.22));
      puff.addColorStop(1, rgba(0x3a4468, 0));
      ctx.fillStyle = puff;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  /* ---- aerial-perspective town skyline: 3 ridges softening into haze +
         a Chagrin-Falls rooftop line with a steeple + warm window lights ---- */
  tex(scene, TEX.stadiumSkyline, W, 120, (g) => {
    // integer-harmonic sines keep the strip seamless when it wraps
    const ridge = (yBase: number, amp: number, k: number, col: number, a: number) => {
      g.fillStyle(col, a);
      for (let x = 0; x < W; x++) {
        const y = yBase + Math.sin((x / W) * Math.PI * 2 * k) * amp + Math.sin((x / W) * Math.PI * 2 * (k * 2)) * amp * 0.35;
        g.fillRect(x, Math.round(y), 1, 120 - Math.round(y));
      }
    };
    ridge(46, 10, 2, 0x2b3a5c, 0.9); // farthest — lightest/bluest (aerial haze)
    ridge(62, 9, 3, 0x1f2c48, 0.95);
    ridge(78, 7, 5, 0x15203a, 1); // nearer — darker
    // town rooftop line on the near ridge + a steeple + a water-tower
    let x = 0;
    while (x < W) {
      const w = 8 + Math.floor(rng() * 16);
      const h = 8 + Math.floor(rng() * 16);
      rect(g, x, 92 - h, w, h + 28, 0x16203a);
      // warm Chagrin-Falls windows (brighter + a soft bloom on some)
      for (let wx = x + 2; wx < x + w - 1; wx += 3) {
        if (rng() > 0.42) {
          const wy = 92 - h + 2 + Math.floor(rng() * (h - 3));
          px(g, wx, wy, 0xffce76, 1);
          if (rng() > 0.7) { g.fillStyle(0xffce76, 0.35); g.fillCircle(wx + 0.5, wy + 0.5, 1.6); }
        }
      }
      x += w + 2;
    }
    // steeple
    rect(g, 150, 66, 8, 54, 0x16203a);
    g.fillStyle(0x16203a, 1); g.fillTriangle(148, 66, 160, 66, 154, 52);
    g.fillStyle(0xffce76, 1); g.fillCircle(154, 60, 1.4);
    g.fillStyle(0xffce76, 0.3); g.fillCircle(154, 60, 3);
    // distant light-tower silhouettes with a warm crown
    for (const tx of [70, 300]) {
      rect(g, tx, 40, 2, 52, 0x223049);
      g.fillStyle(P.nightBloom, 0.5); g.fillCircle(tx + 1, 40, 4);
    }
  });
  linearize(scene, TEX.stadiumSkyline);

  /* ---- HERO: the distant Chagrin falls + gorge on the horizon (the town is
         a waterfall town) — a cliff notch, a pouring falls, and rising mist ---- */
  canvasTex(scene, TEX.stadiumGorge, 150, 112, (ctx) => {
    // gorge cliffs, hazed blue by distance (aerial perspective)
    ctx.fillStyle = rgba(0x1a2540, 1);
    ctx.beginPath(); ctx.moveTo(0, 38); ctx.lineTo(58, 44); ctx.lineTo(66, 112); ctx.lineTo(0, 112); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(150, 34); ctx.lineTo(92, 44); ctx.lineTo(84, 112); ctx.lineTo(150, 112); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(0x111a30, 0.55);
    ctx.fillRect(0, 44, 60, 68); ctx.fillRect(90, 44, 60, 68);
    // the falls pouring through the notch
    const wf = ctx.createLinearGradient(0, 44, 0, 98);
    wf.addColorStop(0, rgba(0xe6f1fc, 0.9));
    wf.addColorStop(1, rgba(0xbfe0ff, 0.45));
    ctx.fillStyle = wf;
    ctx.fillRect(60, 44, 30, 54);
    ctx.strokeStyle = rgba(0xffffff, 0.4);
    ctx.lineWidth = 1;
    for (let sx = 63; sx < 88; sx += 3) { ctx.beginPath(); ctx.moveTo(sx, 46); ctx.lineTo(sx - 1, 96); ctx.stroke(); }
    // foam pool + rising mist
    const mist = ctx.createRadialGradient(75, 96, 3, 75, 94, 42);
    mist.addColorStop(0, rgba(0xe6f1fc, 0.5));
    mist.addColorStop(1, rgba(0xe6f1fc, 0));
    ctx.fillStyle = mist;
    ctx.beginPath(); ctx.arc(75, 92, 42, 0, Math.PI * 2); ctx.fill();
    const rise = ctx.createLinearGradient(0, 98, 0, 24);
    rise.addColorStop(0, rgba(0xcfe4f5, 0.32));
    rise.addColorStop(1, rgba(0xcfe4f5, 0));
    ctx.fillStyle = rise;
    ctx.fillRect(56, 24, 38, 74);
  });

  /* ---- drifting low field-fog (cool grey, tileable) ---- */
  fogBandTex(scene, TEX.stadiumFog, W, 64, 0x9fb4d0, 0.5);

  /* ---- atmospheric haze band (sits over the skyline → distance softens) ---- */
  canvasTex(scene, TEX.stadiumHaze, W, 90, (ctx) => {
    const h = ctx.createLinearGradient(0, 0, 0, 90);
    h.addColorStop(0, rgba(0x2a3b5a, 0));
    h.addColorStop(0.7, rgba(0x2a3b5a, 0.28));
    h.addColorStop(1, rgba(0x33456a, 0.42));
    ctx.fillStyle = h;
    ctx.fillRect(0, 0, W, 90);
  });

  /* ---- volumetric light-tower BEAM rising into the misty sky (origin bottom) ---- */
  canvasTex(scene, TEX.lightBeamUp, 72, 230, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(36, 230);
    ctx.lineTo(2, 0);
    ctx.lineTo(70, 0);
    ctx.closePath();
    const beam = ctx.createLinearGradient(0, 230, 0, 0);
    beam.addColorStop(0, rgba(0xfff3cc, 0.8));
    beam.addColorStop(0.35, rgba(0xfff0c0, 0.3));
    beam.addColorStop(0.75, rgba(0xfff0c0, 0.08));
    beam.addColorStop(1, rgba(0xfff0c0, 0));
    ctx.fillStyle = beam;
    ctx.fill();
    // a brighter hot core up the center
    ctx.beginPath();
    ctx.moveTo(36, 230); ctx.lineTo(26, 0); ctx.lineTo(46, 0); ctx.closePath();
    const core = ctx.createLinearGradient(0, 230, 0, 0);
    core.addColorStop(0, rgba(0xfffbe8, 0.6));
    core.addColorStop(1, rgba(0xfffbe8, 0));
    ctx.fillStyle = core;
    ctx.fill();
  });

  /* ---- distant stands + press box (mid-far layer, softened by LINEAR) ---- */
  tex(scene, TEX.stadiumBleachersFar, W, 92, (g) => {
    for (let i = 0; i < 9; i++) {
      const y = 40 + i * 5;
      rect(g, 0, y, W, 3, i % 2 ? P.bleacherDark : 0x333a4e, 0.9);
    }
    rect(g, 0, 84, W, 8, P.bleacherDark);
    for (const bx of [80, 320]) {
      rect(g, bx, 20, 44, 22, P.pressBox);
      rect(g, bx + 3, 24, 38, 6, 0x22283a);
      for (let k = 0; k < 4; k++) px(g, bx + 6 + k * 9, 27, P.nightBloom, 0.5);
    }
    for (const tx of [30, 200, 400]) {
      rect(g, tx, 8, 2, 40, 0x2a3040);
      rect(g, tx - 6, 6, 14, 6, 0x22283a);
      g.fillStyle(P.nightBloom, 0.6); g.fillCircle(tx + 1, 9, 4);
    }
  });
  linearize(scene, TEX.stadiumBleachersFar);

  /* ---- cinematic vignette (darkens the frame edges over the whole view) ---- */
  vignetteTex(scene, TEX.stadiumVignette, VIEW_W, VIEW_H, 0x05070f, 0.55);

  /* ---- turf ground tile (lit top, green depth, faint blades) ---- */
  tex(scene, TEX.fieldTurf, 16, 16, (g) => {
    rect(g, 0, 0, 16, 16, P.fieldGreenDark);
    rect(g, 0, 0, 16, 3, P.fieldGreen); // moonlit/lit turf skin
    rect(g, 0, 3, 16, 1, 0x246039);
    speckle(g, rng, 0, 1, 16, 5, 0x3f9a5f, 8, 0.5); // lit blades up top
    speckle(g, rng, 0, 5, 16, 10, 0x163a22, 10, 0.5); // shadowed depth
    rect(g, 0, 15, 16, 1, 0x102a18);
  });

  /* ---- buried sub-turf earth (no per-tile top band → no underground stripes) ---- */
  tex(scene, TEX.fieldSoil, 16, 16, (g) => {
    rect(g, 0, 0, 16, 16, 0x18351f);
    rect(g, 0, 0, 16, 6, 0x1d4a2c, 0.5); // gentle top-lit blend into the turf above
    speckle(g, rng, 0, 2, 16, 12, 0x102a18, 10, 0.6);
    speckle(g, rng, 0, 3, 16, 11, 0x28603a, 5, 0.35);
  });

  /* ---- chalk yard-line (faint vertical stripe on the turf) ---- */
  tex(scene, TEX.fieldStripe, 4, 14, (g) => {
    rect(g, 1, 0, 2, 14, P.fieldLine, 0.85);
    px(g, 1, 2, P.white, 0.5); px(g, 2, 8, P.white, 0.4);
  });
  linearize(scene, TEX.fieldStripe);

  /* ---- bleacher/catwalk plank (aluminium bench) ---- */
  tex(scene, TEX.bleacherRow, 16, 8, (g) => {
    rect(g, 0, 0, 16, 8, P.bleacherDark);
    rect(g, 0, 0, 16, 3, P.bleacher); // lit tread
    rect(g, 0, 3, 16, 1, 0x1c2233);
    for (let x = 2; x < 16; x += 5) px(g, x, 1, P.white, 0.4); // rivets
    rect(g, 0, 7, 16, 1, 0x141926);
  });

  /* ---- light tower (pole + bank of Friday-night bulbs), origin bottom ---- */
  tex(scene, TEX.lightTower, 20, 60, (g) => {
    rect(g, 9, 8, 2, 52, P.slate); // pole
    rect(g, 8, 30, 4, 2, P.slateDark); // cross-brace
    rect(g, 3, 0, 14, 9, 0x2a3040); // light bank housing
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      rect(g, 5 + c * 4, 2 + r * 4, 3, 3, P.nightBloom, 0.9); // bulbs
    }
    g.fillStyle(P.nightBloom, 0.3); g.fillCircle(10, 4, 8); // soft halo
  });
  linearize(scene, TEX.lightTower);

  /* ---- scoreboard housing (the KNOWN/UNKNOWN readout is drawn in-scene) ---- */
  tex(scene, TEX.scoreboard, 64, 40, (g) => {
    rect(g, 0, 0, 64, 40, P.scoreboardFrame);
    rect(g, 2, 2, 60, 36, 0x0e1118); // dark panel
    rect(g, 0, 0, 64, 3, P.tigerOrange); // Tiger trim
    rect(g, 0, 0, 64, 1, P.tigerOrangeDark);
    g.lineStyle(1, P.scoreboardFrame, 1); g.strokeRect(4, 6, 56, 12); // readout window
    g.lineStyle(1, P.scoreboardFrame, 1); g.strokeRect(4, 22, 56, 12);
    // faint indicator dots
    for (let i = 0; i < 6; i++) px(g, 8 + i * 3, 36, i % 2 ? P.tigerOrange : P.uiDim, 0.6);
  });

  /* ---- Tiger banner (orange pennant, black stripe + claw) ---- */
  tex(scene, TEX.tigerBanner, 14, 24, (g) => {
    g.fillStyle(P.tigerOrange, 1); g.fillTriangle(0, 0, 14, 0, 0, 20); // pennant
    g.fillStyle(P.tigerOrangeDark, 1); g.fillTriangle(0, 6, 8, 6, 0, 14);
    rect(g, 0, 0, 14, 2, 0x120a05); // top black bar
    // claw slashes
    g.lineStyle(1, 0x120a05, 0.9);
    g.lineBetween(3, 4, 6, 12); g.lineBetween(5, 3, 8, 11); g.lineBetween(7, 4, 10, 12);
  });

  /* ---- rec-pool dive node (swirling water portal) ---- */
  tex(scene, TEX.poolNode, 16, 16, (g) => {
    g.fillStyle(P.poolWater, 0.9); g.fillCircle(8, 8, 7);
    g.fillStyle(P.waterMid, 1); g.fillCircle(8, 8, 5);
    g.fillStyle(P.poolShimmer, 0.9); g.fillCircle(8, 8, 2.5);
    g.lineStyle(1, P.poolShimmer, 0.7); g.strokeCircle(8, 8, 6);
    px(g, 5, 5, P.white, 0.7);
  });
  linearize(scene, TEX.poolNode);

  /* ---- ANCHOR safe-zone glow (soft green field, tinted + added in-scene) ---- */
  radialGlow(scene, TEX.safeZoneGlow, 56, [
    [0, 0.7],
    [0.5, 0.32],
    [0.8, 0.1],
    [1, 0],
  ]);

  /* ---- ANCHOR marker glyph (a stylized green anchor) ---- */
  tex(scene, TEX.anchorMarker, 12, 12, (g) => {
    g.lineStyle(2, P.anchorGreen, 1);
    g.strokeCircle(6, 2, 1.5); // ring
    g.lineBetween(6, 3, 6, 10); // shank
    g.lineBetween(3, 6, 9, 6); // stock
    g.beginPath(); g.moveTo(2, 8); g.lineTo(6, 11); g.lineTo(10, 8); g.strokePath(); // flukes
    px(g, 6, 6, P.white, 0.8);
  });
  linearize(scene, TEX.anchorMarker);

  /* ---- hidden locker cache (metal box, green latch + salvage spark) ---- */
  tex(scene, TEX.lockerCache, 14, 14, (g) => {
    rect(g, 1, 1, 12, 12, P.slateDark);
    rect(g, 2, 2, 10, 10, P.slate);
    rect(g, 2, 2, 10, 3, 0x565f70); // lit top
    rect(g, 6, 5, 2, 6, 0x1c2233); // door seam
    rect(g, 5, 7, 4, 2, P.anchorGreen, 0.9); // latch light
    g.fillStyle(P.warning, 1); g.fillTriangle(3, 3, 2, 6, 4, 5); // spark decal
  });

  /* ---- sideline EQUIPMENT CART — solid enough to kill a light beam ---- */
  tex(scene, TEX.equipCart, 26, 26, (g) => {
    rect(g, 0, 4, 26, 18, P.slateDark); // crate stack body
    rect(g, 1, 5, 24, 6, P.slate); // lit upper crate
    rect(g, 1, 12, 24, 9, 0x2a3145);
    rect(g, 0, 2, 26, 3, P.bleacher); // pushed-back canopy lip (the bit that eats the beam)
    rect(g, 0, 2, 26, 1, 0x565f70);
    rect(g, 3, 13, 8, 5, P.tigerOrangeDark, 0.8); // helmet bin decal
    rect(g, 14, 14, 8, 4, P.tigerOrange, 0.5);
    for (let x = 2; x < 26; x += 6) px(g, x, 11, 0x1c2233, 0.8); // crate seams
    rect(g, 2, 22, 4, 4, 0x141926); // wheels
    rect(g, 20, 22, 4, 4, 0x141926);
  });
  linearize(scene, TEX.equipCart);

  /* ---- tarp'd BLOCKING SLED — low, wide, opaque ---- */
  tex(scene, TEX.blockSled, 26, 22, (g) => {
    g.fillStyle(0x2a3145, 1); // draped tarp silhouette
    g.beginPath(); g.moveTo(1, 21); g.lineTo(3, 4); g.lineTo(23, 2); g.lineTo(25, 21); g.closePath(); g.fillPath();
    g.fillStyle(P.slate, 1);
    g.beginPath(); g.moveTo(3, 12); g.lineTo(4, 5); g.lineTo(22, 3); g.lineTo(23, 12); g.closePath(); g.fillPath();
    rect(g, 4, 6, 18, 1, 0x565f70, 0.7); // tarp fold highlight
    rect(g, 2, 13, 22, 1, 0x1c2233);
    rect(g, 6, 16, 4, 4, P.tigerOrangeDark, 0.7); // stencilled tiger mark
    rect(g, 0, 20, 26, 2, 0x141926); // steel base rail
  });
  linearize(scene, TEX.blockSled);

  /* ---- underside slab: dugout roof / press-box overhang / bleacher understand ---- */
  tex(scene, TEX.coverSlab, 16, 16, (g) => {
    rect(g, 0, 0, 16, 16, 0x1b2130); // shadowed underside
    rect(g, 0, 0, 16, 4, P.bleacherDark); // structural top edge
    rect(g, 0, 0, 16, 1, P.bleacher, 0.7);
    rect(g, 0, 5, 16, 1, 0x11151f);
    for (let x = 1; x < 16; x += 7) px(g, x, 2, P.white, 0.28); // rivets
    px(g, 4, 10, 0x232a3c, 1); px(g, 11, 12, 0x232a3c, 1);
  });
  linearize(scene, TEX.coverSlab);

  /* ---- Henry / ANCHOR scout badge (green shield + anchor) ---- */
  tex(scene, TEX.badgeHenry, 11, 12, (g) => {
    g.fillStyle(0x0e2a19, 1); g.fillRoundedRect(0, 0, 11, 12, 2);
    g.fillStyle(P.scoutHenry, 1); g.beginPath();
    g.moveTo(1, 1); g.lineTo(10, 1); g.lineTo(10, 7); g.lineTo(5.5, 11); g.lineTo(1, 7); g.closePath(); g.fillPath(); // shield
    g.fillStyle(0x0e2a19, 1);
    g.fillRect(5, 3, 1, 5); g.fillRect(3, 4, 5, 1); // anchor cross
    g.fillStyle(P.white, 0.8); px(g, 3, 2, P.white, 0.8); px(g, 8, 2, P.white, 0.6);
  });

  // Cameron / ECHO badge — purple shield + a little echo-waveform mark
  tex(scene, TEX.badgeCameron, 11, 12, (g) => {
    g.fillStyle(0x241533, 1); g.fillRoundedRect(0, 0, 11, 12, 2);
    g.fillStyle(P.scoutCameron, 1); g.beginPath();
    g.moveTo(1, 1); g.lineTo(10, 1); g.lineTo(10, 7); g.lineTo(5.5, 11); g.lineTo(1, 7); g.closePath(); g.fillPath(); // shield
    g.fillStyle(0x241533, 1); // ECHO waveform bars
    g.fillRect(3, 6, 1, 2); g.fillRect(5, 4, 1, 4); g.fillRect(7, 5, 1, 3);
    g.fillStyle(P.white, 0.8); px(g, 3, 2, P.white, 0.8); px(g, 8, 2, P.white, 0.6);
  });

  // Danny / ROCKET badge — cyan shield + an upward rocket chevron
  tex(scene, TEX.badgeDanny, 11, 12, (g) => {
    g.fillStyle(0x0a2833, 1); g.fillRoundedRect(0, 0, 11, 12, 2);
    g.fillStyle(P.scoutDanny, 1); g.beginPath();
    g.moveTo(1, 1); g.lineTo(10, 1); g.lineTo(10, 7); g.lineTo(5.5, 11); g.lineTo(1, 7); g.closePath(); g.fillPath(); // shield
    g.fillStyle(0x0a2833, 1); // ROCKET chevrons (pointing up)
    g.fillTriangle(5.5, 2.5, 3, 5.5, 8, 5.5); g.fillTriangle(5.5, 5, 3.5, 7.5, 7.5, 7.5);
    g.fillStyle(P.white, 0.8); px(g, 3, 2, P.white, 0.8); px(g, 8, 2, P.white, 0.6);
  });

  /* =========================== underwater node =========================== */

  /* ---- deep water backdrop (vertical gradient + caustics; stretched wide) ---- */
  tex(scene, TEX.underwaterBg, 32, 256, (g) => {
    const top = Phaser.Display.Color.ValueToColor(P.underTintTop);
    const deep = Phaser.Display.Color.ValueToColor(P.underTintDeep);
    for (let y = 0; y < 256; y++) {
      const t = y / 256;
      const r = Math.round(top.red + (deep.red - top.red) * t);
      const gr = Math.round(top.green + (deep.green - top.green) * t);
      const b = Math.round(top.blue + (deep.blue - top.blue) * t);
      g.fillStyle(Phaser.Display.Color.GetColor(r, gr, b), 1);
      g.fillRect(0, y, 32, 1);
    }
    // faint caustic flecks
    speckle(g, rng, 0, 0, 32, 200, P.godRay, 30, 0.16);
  });
  linearize(scene, TEX.underwaterBg);

  /* ---- god-ray shaft (soft white beam, brighter up top), tinted in-scene ---- */
  tex(scene, TEX.godRay, 20, 220, (g) => {
    for (let y = 0; y < 220; y++) {
      const a = (1 - y / 220) * 0.5;
      const w = 4 + (y / 220) * 12; // widens downward
      g.fillStyle(0xffffff, a);
      g.fillRect(10 - w / 2, y, w, 1);
    }
  });
  linearize(scene, TEX.godRay);

  /* ---- drifting bubble ---- */
  tex(scene, TEX.bubble, 6, 6, (g) => {
    g.lineStyle(1, 0xffffff, 0.9); g.strokeCircle(3, 3, 2);
    px(g, 2, 2, P.white, 0.9);
  });
  linearize(scene, TEX.bubble);

  /* =========================== Weather Balloon =========================== */

  /* ---- inflated decoy balloon (lit latex oval + WEATHER stripe + valve nub) ---- */
  tex(scene, TEX.wbBody, 40, 46, (g) => {
    g.fillStyle(0xe9e4d6, 1); g.fillEllipse(20, 20, 38, 40); // latex body
    g.fillStyle(P.nightBloom, 0.9); g.fillEllipse(15, 14, 16, 16); // top-lit highlight
    g.fillStyle(0xbfb8a6, 0.7); g.fillEllipse(26, 30, 20, 18); // underside shade
    rect(g, 4, 20, 32, 3, P.tigerOrange, 0.85); // WEATHER stripe
    rect(g, 4, 23, 32, 1, P.tigerOrangeDark, 0.7);
    // gore seams
    g.lineStyle(1, 0xbfb8a6, 0.6);
    g.lineBetween(20, 2, 20, 38); g.lineBetween(10, 6, 12, 34); g.lineBetween(30, 6, 28, 34);
    rect(g, 17, 38, 6, 5, 0x9a9484); // valve nub
  });
  linearize(scene, TEX.wbBody);

  /* ---- deflated thrashing tangle (saggy, wrinkled, darker) ---- */
  tex(scene, TEX.wbDeflate, 40, 32, (g) => {
    g.fillStyle(0xbfb8a6, 1); g.fillEllipse(20, 18, 36, 22); // collapsed sack
    g.fillStyle(0x9a9484, 0.9); g.fillEllipse(24, 22, 22, 14);
    // wrinkles + drooping tendrils
    g.lineStyle(1, 0x726c5e, 0.8);
    g.lineBetween(6, 14, 16, 20); g.lineBetween(34, 14, 24, 22); g.lineBetween(12, 22, 20, 16);
    for (const tx of [10, 18, 26, 32]) g.lineBetween(tx, 26, tx + 2, 32);
    rect(g, 4, 12, 32, 2, P.tigerOrange, 0.6); // remnant stripe
  });
  linearize(scene, TEX.wbDeflate);

  /* ---- valve core (exposed nozzle — red glow) ---- */
  tex(scene, TEX.wbValve, 14, 14, (g) => {
    g.fillStyle(0x726c5e, 1); g.fillCircle(7, 7, 6); // metal ring
    g.fillStyle(0x3a352c, 1); g.fillCircle(7, 7, 4);
    g.fillStyle(P.scoreboardKnown, 1); g.fillCircle(7, 7, 3); // hot valve
    g.fillStyle(P.white, 1); g.fillCircle(7, 7, 1.2);
    g.lineStyle(1, 0x9a9484, 0.8); g.strokeCircle(7, 7, 6);
  });
  linearize(scene, TEX.wbValve);

  /* ---- spotlight slam column (warm beam, origin bottom in-scene) ---- */
  tex(scene, TEX.wbSpotlight, 28, 200, (g) => {
    for (let y = 0; y < 200; y++) {
      const a = (1 - y / 200) * 0.6 + 0.1;
      const w = 6 + (y / 200) * 18;
      g.fillStyle(0xffffff, a * 0.5);
      g.fillRect(14 - w / 2, y, w, 1);
    }
  });
  linearize(scene, TEX.wbSpotlight);

  /* ======================= ZONE 4 — PATTERSON'S ORCHARD ====================== */
  // Harvest dusk: purple/red orchard lights, a white barn with a green metal
  // roof, tan corn-maze walls, glowing lime crop circles, drifting chaff.
  canvasTex(scene, TEX.orchardSky, VIEW_W, VIEW_H, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grd.addColorStop(0, rgba(P.orchardSkyTop, 1));
    grd.addColorStop(0.58, rgba(P.orchardSkyMid, 1));
    grd.addColorStop(1, rgba(P.orchardSkyHorizon, 1));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // low harvest-moon glow at the horizon
    const m = ctx.createRadialGradient(VIEW_W * 0.78, VIEW_H * 0.52, 4, VIEW_W * 0.78, VIEW_H * 0.52, 80);
    m.addColorStop(0, rgba(P.warning, 0.45));
    m.addColorStop(1, rgba(P.warning, 0));
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  });

  tex(scene, TEX.orchardStars, VIEW_W, 120, (g) => {
    const r = makeRng(0x0c4a17);
    for (let i = 0; i < 70; i++) px(g, Math.floor(r() * VIEW_W), Math.floor(r() * 120), P.star, 0.45 + r() * 0.5);
  });

  tex(scene, TEX.orchardHills, 176, 64, (g) => {
    rect(g, 0, 26, 176, 38, P.orchardHazePurple);
    g.fillStyle(P.hillMid, 1);
    for (let x = -8; x < 184; x += 22) g.fillEllipse(x, 34, 32, 26);
    g.fillStyle(P.foliageDark, 1);
    for (let x = 6; x < 176; x += 11) {
      g.fillCircle(x, 26, 3);
      g.fillRect(x - 0.5, 26, 1, 5);
    }
  });

  // white barn + green metal roof (parallax landmark silhouette — NOT illustrated)
  tex(scene, TEX.orchardBarn, 72, 62, (g) => {
    rect(g, 6, 26, 60, 34, P.barnWhite); // body
    g.fillStyle(P.barnWhiteShade, 0.5);
    for (let x = 10; x < 66; x += 6) g.fillRect(x, 29, 1, 30); // plank shading
    g.fillStyle(P.barnRoofGreen, 1);
    g.fillTriangle(2, 28, 36, 4, 70, 28); // green metal roof
    g.fillStyle(P.barnRoofGreenDark, 1);
    g.fillTriangle(2, 28, 36, 12, 70, 28); // roof underside band
    rect(g, 35, 4, 2, 24, P.barnRoofGreenDark); // ridge line
    rect(g, 28, 38, 16, 22, P.brownstone); // barn doors
    g.lineStyle(1, P.barnWhiteShade, 0.8);
    g.lineBetween(28, 38, 44, 60);
    g.lineBetween(44, 38, 28, 60); // X-brace
    rect(g, 33, 17, 6, 6, P.windowLight); // hay-loft window (warm)
    px(g, 35, 19, P.windowCore);
  });

  // apple-tree pillar (decor silhouette + red apples)
  tex(scene, TEX.appleTree, 30, 74, (g) => {
    rect(g, 13, 34, 5, 40, P.dirtDark); // trunk
    rect(g, 13, 34, 2, 40, P.dirt);
    g.lineStyle(2, P.dirtDark, 1);
    g.lineBetween(15, 44, 7, 38);
    g.lineBetween(15, 50, 23, 44);
    g.fillStyle(P.foliageDark, 1);
    for (const [x, y, r] of [[15, 20, 15], [7, 27, 9], [23, 27, 9], [15, 10, 11]] as Array<[number, number, number]>) g.fillCircle(x, y, r);
    g.fillStyle(P.appleLeaf, 1);
    for (const [x, y, r] of [[12, 16, 7], [19, 18, 7], [15, 9, 6]] as Array<[number, number, number]>) g.fillCircle(x, y, r);
    g.fillStyle(P.grassLit, 0.5);
    g.fillCircle(12, 12, 3);
    g.fillStyle(P.appleRed, 1);
    for (const [x, y] of [[9, 22], [20, 20], [14, 28], [24, 24], [6, 25]] as Array<[number, number]>) g.fillCircle(x, y, 2);
  });

  // tileable apple-tree trunk backdrop
  // climb so the '%' shelves read as fruit hanging on a real tree, not floating.
  tex(scene, TEX.orchardTrunk, 14, 16, (g) => {
    rect(g, 3, 0, 8, 16, P.dirtDark); // bark core
    rect(g, 3, 0, 3, 16, P.dirt); // moonlit left edge
    rect(g, 10, 0, 1, 16, P.black, 0.35); // right shade
    g.fillStyle(P.dirtDark, 0.9);
    px(g, 6, 4, P.dirt); // knot flecks
    px(g, 8, 11, P.dirt);
  });

  // leafy shelf with hanging apples
  tex(scene, TEX.fruitShelf, 16, 12, (g) => {
    g.fillStyle(P.appleLeaf, 1);
    g.fillEllipse(8, 5, 16, 9);
    g.fillStyle(P.foliageDark, 1);
    g.fillEllipse(8, 7, 16, 7);
    g.fillStyle(P.grassLit, 0.4);
    g.fillEllipse(6, 4, 7, 3);
    g.fillStyle(P.appleRed, 1);
    g.fillCircle(4, 9, 2);
    g.fillCircle(11, 10, 2);
    g.fillCircle(8, 9, 1.6);
  });

  // corn-maze wall tile
  tex(scene, TEX.cornWall, 16, 16, (g) => {
    rect(g, 0, 0, 16, 16, P.cornStalkDark);
    g.fillStyle(P.cornStalk, 1);
    for (const x of [2, 5, 8, 11, 14]) g.fillRect(x, 0, 2, 16);
    g.fillStyle(P.cornSilk, 0.7);
    for (const x of [3, 9, 13]) g.fillRect(x, 1, 1, 4);
    g.fillStyle(P.grassDark, 1);
    for (const x of [4, 7, 12]) g.fillRect(x, 6, 1, 10);
  });

  // '#' orchard ground (soil + grass top)
  tex(scene, TEX.orchardGround, 16, 16, (g) => {
    rect(g, 0, 0, 16, 16, P.dirt);
    rect(g, 0, 0, 16, 4, P.grass);
    rect(g, 0, 0, 16, 1, P.grassLit);
    rect(g, 0, 4, 16, 1, P.grassDark);
    speckle(g, makeRng(0x0c11), 0, 5, 16, 11, P.dirtDark, 10);
    speckle(g, makeRng(0x0c12), 0, 0, 16, 4, P.grassLit, 4);
  });

  // '=' branch / plank ledge
  tex(scene, TEX.orchardWalkway, 16, 8, (g) => {
    rect(g, 0, 0, 16, 6, P.dirtDark);
    rect(g, 0, 0, 16, 2, P.dirt);
    rect(g, 0, 5, 16, 1, P.black, 0.4);
    px(g, 4, 3, P.dirtDark);
    px(g, 11, 2, P.dirt);
  });

  // hanging orchard light (tinted purple/red per instance in-scene)
  tex(scene, TEX.orchardLight, 10, 18, (g) => {
    rect(g, 4, 0, 1, 8, P.fence);
    g.fillStyle(P.warning, 1);
    g.fillCircle(5, 11, 3);
    g.fillStyle(P.white, 0.8);
    g.fillCircle(4, 10, 1);
  });

  // glowing crop-circle glyph (maze heart / gate decor)
  tex(scene, TEX.cropGlyph, 48, 48, (g) => {
    const c = 24;
    g.lineStyle(1, P.cropGlow, 0.75);
    [8, 15, 22].forEach((r) => g.strokeCircle(c, c, r));
    g.lineStyle(1, P.signalGreen, 0.5);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) g.lineBetween(c + Math.cos(a) * 6, c + Math.sin(a) * 6, c + Math.cos(a) * 22, c + Math.sin(a) * 22);
    g.fillStyle(P.cropGlow, 0.4);
    g.fillCircle(c, c, 4);
  });
  linearize(scene, TEX.cropGlyph);

  // drifting chaff mote
  tex(scene, TEX.chaff, 3, 3, (g) => {
    px(g, 1, 1, P.cornSilk, 0.9);
    px(g, 0, 1, P.cornStalk, 0.6);
  });

  // hay bale (decor)
  tex(scene, TEX.hayBale, 18, 13, (g) => {
    rect(g, 0, 2, 18, 11, P.cornStalkDark);
    rect(g, 0, 2, 18, 3, P.cornStalk);
    g.lineStyle(1, P.cornStalkDark, 1);
    g.strokeRect(0, 2, 18, 11);
    g.lineStyle(1, P.dirtDark, 0.8);
    g.lineBetween(6, 2, 6, 13);
    g.lineBetween(12, 2, 12, 13);
    g.fillStyle(P.cornSilk, 0.5);
    for (const x of [2, 8, 14]) g.fillRect(x, 3, 1, 2);
  });

  // Harvest Pattern boss — rotating crop-symbol glyph + exposed core
  tex(scene, TEX.harvestGlyph, 44, 44, (g) => {
    const c = 22;
    g.lineStyle(2, P.orchardLightPurple, 0.9);
    g.strokeCircle(c, c, 18);
    g.lineStyle(1, P.cropGlow, 0.8);
    g.strokeCircle(c, c, 12);
    g.fillStyle(P.orchardLightPurple, 1);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.fillCircle(c + Math.cos(a) * 18, c + Math.sin(a) * 18, 3);
    }
    g.fillStyle(P.cropGlow, 0.5);
    g.fillCircle(c, c, 6);
  });
  linearize(scene, TEX.harvestGlyph);

  tex(scene, TEX.harvestCore, 16, 16, (g) => {
    g.fillStyle(P.dirtDark, 1);
    g.fillCircle(8, 8, 7);
    g.fillStyle(P.dangerDark, 1);
    g.fillCircle(8, 8, 5);
    g.fillStyle(P.cropGlow, 1);
    g.fillCircle(8, 8, 3);
    g.fillStyle(P.white, 1);
    g.fillCircle(8, 8, 1.2);
  });
}
