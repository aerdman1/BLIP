/**
 * TdTerrain — the HD top-down arena build.
 *
 * Replaces SweepScene.buildMap's flat passes for the overhauled arena. Three
 * ideas do all the work:
 *
 *  1. THE GROUND IS LAYERED TILING. Three full-arena tileSprites of the same
 *     materials at mutually mismatched periods, so there is no repeating grid
 *     for the eye to find — plus wall shadows baked once into a Graphics. A
 *     handful of draw calls for the whole terrain.
 *  2. WALLS ARE EXTRUSIONS, not flat tiles — a top cap plus a face strip rising
 *     from the wall's bottom edge, depth-sorted by its base y. This is the
 *     single change that makes a top-down arena read as 2.5D: you walk BEHIND
 *     walls above you and IN FRONT of walls below you.
 *  3. NO RECTANGLE IS EVER VISIBLE. The room/hall rects stay the collision
 *     truth, untouched; their visual edges are buried under organic skirts.
 *
 * Collision, layout and marker positions are not touched by anything here.
 */
import Phaser from 'phaser';
import { TD_PALETTE as C, TD_VISUALS, TEX } from '../config';
import { DEPTH, sortedDepth } from '../render/Depth';
import { OBLIQUE } from '../render/Oblique';
import { ensureShadowTexture } from '../render/TopDownShadows';
import type { TdArt } from './TdAssets';
import type { TdBiomeDef } from './TdBiomes';

export interface TerrainInput {
  arenaId?: string;
  tile: number;
  w: number;
  h: number;
  solid: boolean[][];
  halls: Array<{ x: number; y: number; w: number; h: number }>;
  floor: Array<{ tx: number; ty: number; edge: boolean }>;
  markers: Array<{ tx: number; ty: number }>;
  art: TdArt;
  /** which zone's vocabulary to build from — see TdBiomes */
  biome: TdBiomeDef;
}

/** Deterministic RNG so screenshots are reproducible across runs. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TdTerrain {
  private layers: Phaser.GameObjects.TileSprite[] = [];
  private shadowBake?: Phaser.GameObjects.Graphics;
  private maskImg?: Phaser.GameObjects.Image;
  private wallMaskImg?: Phaser.GameObjects.Image;
  private faceMaskImg?: Phaser.GameObjects.Image;
  private overlays: Phaser.GameObjects.Image[] = [];
  private props: Phaser.GameObjects.Image[] = [];
  private drawings: Phaser.GameObjects.Graphics[] = [];
  private rng = mulberry(0x5eed47);

  /** injected by the scene so terrain can register its own accent lights */
  accentLights?: (h: { x: number; y: number; radius: number; color: number; intensity: number }) => void;

  constructor(private scene: Phaser.Scene, private input: TerrainInput) {}

  build(): void {
    // The prop contact-AO below needs the shadow texture, and terrain builds
    // BEFORE TopDownShadows is constructed — without this every AO sprite
    // renders Phaser's __MISSING placeholder (bright green boxes on the grid).
    ensureShadowTexture(this.scene);
    const { tile: T, w: W, h: H } = this.input;
    const AW = W * T;
    const AH = H * T;

    this.bakeGround(AW, AH);
    this.buildGroundDepth(AW, AH);
    this.buildWalls();
    this.dressEdges();
    this.scatterProps();
    this.placeLayeredDepthProps();
    this.buildCanopy(AW, AH);
    this.scatterAccents();
    this.placeLandmarks();
    this.buildForegroundFrame(AW, AH);
  }

  private get visualStyle(): 'miller' | 'motel' | 'stadium' | 'orchard' | 'storm' {
    if (this.input.arenaId === 'anomaly-01') return 'storm';
    return this.input.biome.id;
  }

  /* ------------------------------ 1. ground ---------------------------------- */
  private bakeGround(AW: number, AH: number): void {
    const { tile: T, w: W, h: H, solid, halls, art } = this.input;
    const tints = this.input.biome.tints;

    // ONE SEAMLESS BASE + NON-REPEATING ORGANIC OVERLAYS.
    //
    // The first pass layered three tileSprites at MISMATCHED tile scales to
    // avoid a visible grid. That backfired: a non-integer tileScale makes the
    // GPU sample across the texture's wrap boundary, so every repeat edge
    // showed a 1px seam and the arena read as a field of rectangles — the exact
    // artefact this pass exists to remove.
    //
    // Now: the base tiles at a scale that keeps the seamless photoscan actually
    // seamless, and ALL variation comes from full-arena overlays that do not
    // repeat at all (one stretched cloud texture each), so there is no wrap
    // boundary anywhere to produce an edge.
    const scale = TD_VISUALS.groundCell / 512;

    const base = this.scene.add
      .tileSprite(0, 0, AW, AH, art.ground)
      .setOrigin(0)
      .setDepth(DEPTH.ground);
    base.tileScaleX = scale;
    base.tileScaleY = scale;
    if (tints.ground) base.setTint(tints.ground);
    this.layers.push(base);

    // organic lit/shadow drift — soft blobs, no repeats, no edges
    this.cloudOverlay(AW, AH, 'td-cloud-lit', art.groundLit, tints.cloudLit, 0.5, DEPTH.ground + 1, 0x000000);
    this.cloudOverlay(AW, AH, 'td-cloud-dark', art.groundDark, tints.cloudDark, 0.55, DEPTH.ground + 2, 0x000000);

    // Worn paths along the authored corridors — where the player actually walks.
    //
    // A tileSprite per hall rect would paint hard-edged tan RECTANGLES across
    // the arena, which is precisely the prototype look this overhaul exists to
    // kill. Instead: ONE full-arena path tileSprite, revealed through a bitmap
    // mask painted with soft overlapping blobs down each corridor. The worn
    // ground then fades into the grass with organic edges, and the authored
    // corridor layout is still exactly what the player reads.
    const maskTex = 'td-path-mask';
    if (this.scene.textures.exists(maskTex)) this.scene.textures.remove(maskTex);
    const mc = this.scene.textures.createCanvas(maskTex, Math.ceil(AW / 2), Math.ceil(AH / 2));
    if (mc) {
      const ctx = mc.context;
      ctx.clearRect(0, 0, mc.width, mc.height);
      for (const hl of halls) {
        const x0 = (hl.x * T) / 2;
        const y0 = (hl.y * T) / 2;
        const w = (hl.w * T) / 2;
        const h = (hl.h * T) / 2;
        const along = Math.max(w, h);
        const steps = Math.max(2, Math.round(along / 10));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const cx = x0 + (w > h ? t * w : w / 2) + (this.rng() - 0.5) * 6;
          const cy = y0 + (w > h ? h / 2 : t * h) + (this.rng() - 0.5) * 6;
          const r = (Math.min(w, h) / 2 + 6) * (0.75 + this.rng() * 0.5);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, 'rgba(255,255,255,0.85)');
          g.addColorStop(0.6, 'rgba(255,255,255,0.4)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }
      mc.refresh();
      const maskImg = this.scene.add
        .image(0, 0, maskTex)
        .setOrigin(0)
        .setScale(2)
        .setVisible(false);
      const pathLayer = this.scene.add
        .tileSprite(0, 0, AW, AH, art.path)
        .setOrigin(0)
        .setDepth(DEPTH.patch)
        .setAlpha(0.85);
      pathLayer.tileScaleX = scale;
      pathLayer.tileScaleY = scale;
      if (tints.path) pathLayer.setTint(tints.path);
      pathLayer.setMask(new Phaser.Display.Masks.BitmapMask(this.scene, maskImg));
      this.maskImg = maskImg;
      this.layers.push(pathLayer);
    }

    // BAKED STATIC SHADOWS — every wall lays a long shadow along the light dir.
    // Drawn once into a Graphics: zero per-frame cost, and the main source of
    // the "this is really lit" impression.
    const a = TD_VISUALS.lightAngle;
    const sx = -Math.cos(a) * OBLIQUE.wallH * TD_VISUALS.shadowLen;
    const sy = Math.sin(a) * OBLIQUE.wallH * TD_VISUALS.shadowLen * OBLIQUE.k;
    const shade = this.scene.add.graphics().setDepth(DEPTH.shadow - 1).setAlpha(0.5);
    shade.fillStyle(C.shadow, 1);
    for (let ty = 0; ty < H; ty++)
      for (let tx = 0; tx < W; tx++) {
        if (!solid[ty][tx]) continue;
        if (solid[ty + 1]?.[tx]) continue; // interior wall — its shadow is hidden
        shade.fillRect(tx * T + sx, (ty + 1) * T + sy, T, Math.abs(sy) + 6);
      }
    this.shadowBake = shade;
  }

  /**
   * A full-arena, NON-REPEATING soft-blob overlay. Generated once into a canvas
   * at 1/4 arena size and stretched, so it has no wrap boundary and therefore
   * cannot produce a seam. This is what gives the ground its large-scale
   * lit/shadow variation now that the tiled layers are gone.
   */
  private cloudOverlay(
    AW: number, AH: number, key: string, _srcKey: string, tint: number,
    alpha: number, depth: number, _unused: number
  ): void {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const w = Math.max(64, Math.ceil(AW / 4));
    const h = Math.max(64, Math.ceil(AH / 4));
    const ct = this.scene.textures.createCanvas(key, w, h);
    if (!ct) return;
    const ctx = ct.context;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 34; i++) {
      const cx = this.rng() * w;
      const cy = this.rng() * h;
      const r = (0.08 + this.rng() * 0.22) * Math.max(w, h);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,255,255,${0.16 + this.rng() * 0.2})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ct.refresh();
    this.scene.textures.get(key)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    const img = this.scene.add
      .image(0, 0, key)
      .setOrigin(0)
      .setDisplaySize(AW, AH)
      .setDepth(depth)
      .setTint(tint)
      .setAlpha(alpha);
    this.overlays.push(img);
  }

  /* ------------------------- 1b. readable ground depth ---------------------- */
  private isClearOfMarkers(x: number, y: number, radius: number): boolean {
    const { tile: T, markers } = this.input;
    return !markers.some((m) => Math.hypot(x - (m.tx + 0.5) * T, y - (m.ty + 0.5) * T) < radius);
  }

  private shuffledFloor(kind: 'edge' | 'interior' | 'any', clearTiles = 3): Array<{ tx: number; ty: number; edge: boolean }> {
    const { floor, markers } = this.input;
    const ok = (p: { tx: number; ty: number; edge: boolean }) => {
      if (kind === 'edge' && !p.edge) return false;
      if (kind === 'interior' && p.edge) return false;
      return !markers.some((m) => Math.abs(p.tx - m.tx) + Math.abs(p.ty - m.ty) < clearTiles);
    };
    const out = floor.filter(ok);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  private makeDrawing(depth: number, alpha = 1): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics().setDepth(depth).setAlpha(alpha);
    this.drawings.push(g);
    return g;
  }

  private buildGroundDepth(AW: number, AH: number): void {
    const { tile: T, art } = this.input;
    if (!art.hd) return;

    const style = this.visualStyle;
    const g = this.makeDrawing(DEPTH.decal, 0.92);
    const interior = this.shuffledFloor('interior', 4);
    const edge = this.shuffledFloor('edge', 4);

    const palette = {
      miller: { stain: 0x17251e, light: 0x7ba36f, line: 0x222a24, accent: 0x47685d },
      motel: { stain: 0x101018, light: 0x4ec7d6, line: 0x1c2430, accent: 0xf3a646 },
      stadium: { stain: 0x2f3138, light: 0xc8a45a, line: 0x20232a, accent: 0x6fa7d6 },
      orchard: { stain: 0x382718, light: 0xd0a24d, line: 0x2f2418, accent: 0x89543b },
      storm: { stain: 0x180d2c, light: 0xb06bff, line: 0x080811, accent: 0x43dff2 },
    }[style];

    // Broad non-blocking surface changes: puddles, damaged pavement, dirt/mud
    // shifts, row shadows. These are intentionally flat decals under gameplay.
    const patchCount = Math.min(style === 'storm' ? 34 : 46, Math.max(12, Math.floor(interior.length * 0.08)));
    for (let i = 0; i < patchCount && interior.length; i++) {
      const p = interior[i % interior.length];
      const x = (p.tx + 0.5) * T + (this.rng() - 0.5) * T * 0.8;
      const y = (p.ty + 0.5) * T + (this.rng() - 0.5) * T * 0.8;
      const w = T * (0.6 + this.rng() * 1.6);
      const h = T * (0.18 + this.rng() * 0.62);
      g.fillStyle(i % 3 === 0 ? palette.light : palette.stain, style === 'motel' ? 0.12 : 0.1);
      g.fillEllipse(x, y, w, h);
      if ((style === 'motel' || style === 'stadium') && this.rng() < 0.38) {
        g.lineStyle(1, palette.accent, 0.2);
        g.strokeRect(x - w * 0.35, y - h * 0.3, w * 0.7, h * 0.55);
      }
    }

    const crackCount = Math.min(style === 'storm' ? 38 : 28, Math.max(10, Math.floor(edge.length * 0.06)));
    for (let i = 0; i < crackCount && edge.length; i++) {
      const p = edge[i % edge.length];
      const x = (p.tx + 0.5) * T + (this.rng() - 0.5) * T;
      const y = (p.ty + 0.5) * T + (this.rng() - 0.5) * T;
      this.drawJaggedCrack(g, x, y, T * (0.5 + this.rng() * 1.2), palette.line, style === 'storm' ? 0.34 : 0.22);
      if (style === 'storm' && this.rng() < 0.35) {
        this.drawJaggedCrack(g, x + 1, y, T * (0.35 + this.rng() * 0.8), palette.light, 0.18);
      }
    }

    // Region-specific ground language at gameplay scale.
    if (style === 'motel' || style === 'stadium') {
      for (let i = 0; i < Math.min(30, interior.length); i++) {
        const p = interior[(i * 3) % interior.length];
        const x = (p.tx + 0.5) * T;
        const y = (p.ty + 0.5) * T;
        if (i % 2 === 0) {
          g.fillStyle(0x05070a, 0.18);
          g.fillRoundedRect(x - 13, y - 7, 26, 14, 2);
          g.lineStyle(1, 0xa8b2c0, 0.16);
          for (let k = -8; k <= 8; k += 5) g.lineBetween(x + k, y - 6, x + k, y + 6);
        } else {
          g.lineStyle(2, style === 'stadium' ? 0xd6a744 : 0x63d7e3, 0.16);
          g.lineBetween(x - 18, y, x + 18, y);
        }
      }
    } else if (style === 'orchard') {
      for (let i = 0; i < Math.min(44, interior.length); i++) {
        const p = interior[(i * 2) % interior.length];
        const x = (p.tx + 0.5) * T;
        const y = (p.ty + 0.5) * T;
        g.lineStyle(2, i % 2 ? 0x6d4a22 : 0x9d7634, 0.16);
        g.lineBetween(x - T * 0.45, y - T * 0.18, x + T * 0.45, y + T * 0.12);
      }
    } else {
      for (let i = 0; i < Math.min(24, interior.length); i++) {
        const p = interior[(i * 4) % interior.length];
        const x = (p.tx + 0.5) * T;
        const y = (p.ty + 0.5) * T;
        g.lineStyle(2, style === 'storm' ? palette.light : 0x42624b, style === 'storm' ? 0.16 : 0.11);
        g.beginPath();
        g.arc(x, y, T * (0.18 + this.rng() * 0.28), this.rng() * Math.PI, this.rng() * Math.PI + Math.PI * 1.3);
        g.strokePath();
      }
    }

    void AW;
    void AH;
  }

  private drawJaggedCrack(g: Phaser.GameObjects.Graphics, x: number, y: number, len: number, color: number, alpha: number): void {
    const angle = this.rng() * Math.PI * 2;
    const steps = 3 + Math.floor(this.rng() * 4);
    let px = x;
    let py = y;
    g.lineStyle(1 + Math.floor(this.rng() * 2), color, alpha);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const nx = x + Math.cos(angle) * len * (t - 0.5) + (this.rng() - 0.5) * 10;
      const ny = y + Math.sin(angle) * len * (t - 0.5) + (this.rng() - 0.5) * 10;
      g.lineBetween(px, py, nx, ny);
      if (this.rng() < 0.34) {
        const ba = angle + (this.rng() < 0.5 ? 1 : -1) * (0.55 + this.rng() * 0.7);
        g.lineBetween(nx, ny, nx + Math.cos(ba) * len * 0.18, ny + Math.sin(ba) * len * 0.18);
      }
      px = nx;
      py = ny;
    }
  }

  /* ------------------------------ 2. wall extrusion -------------------------- */
  /**
   * Walls as ROCK FORMATIONS, not rectangles.
   *
   * The previous version drew each merged wall run as an opaque tileSprite —
   * so every wall was literally a grey rectangle sitting on the ground, which
   * was the single largest source of the "assembled from square chunks" read.
   *
   * Now the rock surface is revealed through an irregular blob mask built from
   * the solid grid, and the silhouette is broken by rock/foliage sprites banked
   * along the exposed south edge. Collision is untouched: the merged static
   * bodies are still built from the same `solid` array in SweepScene.
   */
  private buildWalls(): void {
    const { tile: T, w: W, h: H, solid, art } = this.input;
    const AW = W * T;
    const AH = H * T;

    // --- irregular mask over every solid cell -------------------------------
    const key = 'td-wall-mask';
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const mw = Math.ceil(AW / 2);
    const mh = Math.ceil(AH / 2);
    const ct = this.scene.textures.createCanvas(key, mw, mh);
    if (!ct) return;
    const ctx = ct.context;
    ctx.clearRect(0, 0, mw, mh);
    ctx.fillStyle = '#fff';
    const hardEdge = this.input.biome.wallStyle === 'hardEdge';
    for (let ty = 0; ty < H; ty++)
      for (let tx = 0; tx < W; tx++) {
        if (!solid[ty][tx]) continue;
        if (hardEdge) {
          // BUILT walls: the cell is filled square, then bitten into at the
          // corners and along the edges. Erosion here is DAMAGE to a made
          // thing — chipped stucco, a broken breezeblock course — so the
          // straight run survives and the arena still reads as architecture.
          // (Running the 'rock' lobes over a motel dissolves it into geology.)
          ctx.fillRect((tx * T) / 2, (ty * T) / 2, T / 2, T / 2);
        } else {
          // three overlapping lobes per cell, jittered — the union across
          // neighbouring cells reads as an eroded rock bank, not a grid
          for (let k = 0; k < 3; k++) {
            const cx = ((tx + 0.5) * T + (this.rng() - 0.5) * T * 0.7) / 2;
            const cy = ((ty + 0.5) * T + (this.rng() - 0.5) * T * 0.7) / 2;
            const r = (T * (0.42 + this.rng() * 0.3)) / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    // Chip the built silhouette AFTER every cell is filled, so a bite taken at
    // a shared border is not painted back over by the neighbouring cell.
    if (hardEdge) {
      ctx.globalCompositeOperation = 'destination-out';
      for (let ty = 0; ty < H; ty++)
        for (let tx = 0; tx < W; tx++) {
          if (!solid[ty][tx]) continue;
          // only bite EXPOSED edges — an interior seam is not a silhouette
          const open = [
            [0, -1], [0, 1], [-1, 0], [1, 0],
          ].filter(([dx, dy]) => !solid[ty + dy]?.[tx + dx]);
          for (const [dx, dy] of open) {
            if (this.rng() < 0.45) continue;
            const cx = ((tx + 0.5 + dx * 0.5) * T + (this.rng() - 0.5) * T * 0.5) / 2;
            const cy = ((ty + 0.5 + dy * 0.5) * T + (this.rng() - 0.5) * T * 0.5) / 2;
            const r = (T * (0.1 + this.rng() * 0.16)) / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      ctx.globalCompositeOperation = 'source-over';
    }
    ct.refresh();
    const maskImg = this.scene.add.image(0, 0, key).setOrigin(0).setScale(2).setVisible(false);
    this.wallMaskImg = maskImg;

    const scale = TD_VISUALS.groundCell / 512;
    const cap = this.scene.add
      .tileSprite(0, 0, AW, AH, art.wallTop)
      .setOrigin(0)
      .setDepth(DEPTH.sorted - 2);
    cap.tileScaleX = scale;
    cap.tileScaleY = scale;
    if (this.input.biome.tints.wallTop) cap.setTint(this.input.biome.tints.wallTop);
    cap.setMask(new Phaser.Display.Masks.BitmapMask(this.scene, maskImg));
    this.layers.push(cap);

    // --- vertical faces along exposed south edges ---------------------------
    //
    // ONE masked full-arena face layer, not a rect per tile. Per-tile rects
    // butted together into continuous grey bands — the same rectangle problem
    // one level down. The mask is blobbed along exposed edges only, so the
    // face appears as an eroded vertical band of rock under the cap.
    const fKey = 'td-face-mask';
    if (this.scene.textures.exists(fKey)) this.scene.textures.remove(fKey);
    const fct = this.scene.textures.createCanvas(fKey, mw, mh);
    if (fct) {
      const fx2 = fct.context;
      fx2.clearRect(0, 0, mw, mh);
      fx2.fillStyle = '#fff';
      for (let ty = 0; ty < H; ty++)
        for (let tx = 0; tx < W; tx++) {
          if (!solid[ty][tx] || solid[ty + 1]?.[tx]) continue;
          const baseY = (ty + 1) * T;
          for (let k = 0; k < 3; k++) {
            const cx = ((tx + 0.5) * T + (this.rng() - 0.5) * T * 0.8) / 2;
            const cy = (baseY - OBLIQUE.wallH * (0.25 + this.rng() * 0.6)) / 2;
            const rx = (T * (0.4 + this.rng() * 0.3)) / 2;
            const ry = (OBLIQUE.wallH * (0.5 + this.rng() * 0.45)) / 2;
            fx2.beginPath();
            fx2.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            fx2.fill();
          }
        }
      fct.refresh();
      const fMask = this.scene.add.image(0, 0, fKey).setOrigin(0).setScale(2).setVisible(false);
      this.faceMaskImg = fMask;
      const faces = this.scene.add
        .tileSprite(0, 0, AW, AH, art.wallFace)
        .setOrigin(0)
        .setDepth(DEPTH.sorted - 3)
        .setTint(this.input.biome.tints.wallFace);
      faces.tileScaleX = scale;
      faces.tileScaleY = scale;
      faces.setMask(new Phaser.Display.Masks.BitmapMask(this.scene, fMask));
      this.layers.push(faces);
    }

    // rocks banked at the foot break the straight line of every base
    for (let ty = 0; ty < H; ty++)
      for (let tx = 0; tx < W; tx++) {
        if (!solid[ty][tx] || solid[ty + 1]?.[tx]) continue;
        const baseY = (ty + 1) * T;
        const cx = (tx + 0.5) * T;
        if (this.rng() < 0.8) {
          const bank = this.input.biome.bank;
          // preserves the original 0.65/0.35 rock:bush split for a 2-entry pool
          const pick = bank[this.rng() < 0.65 ? 0 : Math.min(1, bank.length - 1)];
          const rk = this.scene.add
            .image(cx + (this.rng() - 0.5) * T * 0.9, baseY + 2, pick)
            .setOrigin(0.5, 1)
            .setDepth(sortedDepth(baseY + 2))
            .setScale(TD_VISUALS.artScale * (0.7 + this.rng() * 0.8));
          if (this.rng() < 0.5) rk.setFlipX(true);
          this.props.push(rk);
          this.contactAO(rk.x, rk.y, rk.displayWidth);
        }
        this.scene.add
          .rectangle(tx * T, baseY - 3, T, 5, C.shadow, 0.4)
          .setOrigin(0, 0)
          .setDepth(sortedDepth(baseY) - 1);
      }
  }

  /* ------------------------------ 3. irregular edges ------------------------- */
  /** Bury every straight room/hall boundary under organic cover. */
  private dressEdges(): void {
    const { tile: T, floor, art, biome } = this.input;
    if (!art.hd) return;
    const skirt = biome.skirt;
    for (const p of floor) {
      if (!p.edge) continue;
      const n = 2 + Math.floor(this.rng() * 3);
      for (let i = 0; i < n; i++) {
        const x = (p.tx + 0.5) * T + (this.rng() - 0.5) * T * 1.4;
        const y = (p.ty + 1) * T + (this.rng() - 0.5) * T * 0.7;
        const tex = skirt[Math.floor(this.rng() * skirt.length)];
        const img = this.scene.add
          .image(x, y, tex)
          .setOrigin(0.5, 1)
          .setDepth(sortedDepth(y))
          .setScale(TD_VISUALS.artScale * (0.7 + this.rng() * 0.5))
          .setAlpha(0.9);
        if (this.rng() < 0.5) img.setFlipX(true);
        img.setTint(biome.tints.skirt);
        if (this.rng() < 0.45) this.contactAO(x, y - 1, img.displayWidth);
        this.props.push(img);
      }
    }
  }

  /* ------------------------------ 4. prop scatter ---------------------------- */
  /** A soft dark ellipse under a prop's base. Without it, cut-out foliage reads
   *  as a sticker floating on the terrain — the "pasted on" look in pass one. */
  private contactAO(x: number, y: number, w: number): void {
    const img = this.scene.add
      .image(x, y, TEX.tdShadow)
      .setDepth(DEPTH.shadow)
      .setScale((w / 46) * 1.1, (w / 46) * 1.1 * OBLIQUE.k)
      .setAlpha(0.5);
    this.props.push(img);
  }

  private scatterProps(): void {
    const { tile: T, floor, markers, art, biome } = this.input;
    if (!art.hd) return;
    const pool = biome.scatter;
    const clearOf = (tx: number, ty: number, d: number) =>
      !markers.some((m) => Math.abs(tx - m.tx) + Math.abs(ty - m.ty) < d);

    // edge-biased, marker-clearing — keeps combat lanes and the spawn→node→breach
    // route open, exactly as the original scatter did.
    const candidates = floor.filter((p) => p.edge && clearOf(p.tx, p.ty, 3));
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (let i = 0; i < Math.min(26, candidates.length); i++) {
      const p = candidates[i];
      const x = (p.tx + 0.5) * T + (this.rng() - 0.5) * 14;
      const y = (p.ty + 1) * T - 2;
      // Wide scale variance reads as ELEVATION: a few large silhouettes near
      // the camera against many small ones gives the flat plane a sense of
      // depth that uniform props never will.
      const big = this.rng() < 0.22;
      const sc = TD_VISUALS.artScale * (big ? 1.35 + this.rng() * 0.6 : 0.6 + this.rng() * 0.45);
      const img = this.scene.add
        .image(x, y, pool[Math.floor(this.rng() * pool.length)])
        .setOrigin(0.5, 1)
        .setDepth(sortedDepth(y))
        .setScale(sc);
      if (this.rng() < 0.5) img.setFlipX(true);
      // nearer/bigger props catch a touch more light; distant ones sink to haze
      img.setTint(big ? biome.tints.propNear : biome.tints.propFar);
      this.contactAO(x, y - 2, img.displayWidth);
      this.props.push(img);
    }
  }

  private placeLayeredDepthProps(): void {
    const { tile: T, art } = this.input;
    if (!art.hd) return;

    const style = this.visualStyle;
    const edge = this.shuffledFloor('edge', 5);
    const mid = this.shuffledFloor('interior', 5);
    const imagePool = this.depthImagePool().filter((key) => this.scene.textures.exists(key));
    const imageCount = Math.min(style === 'stadium' ? 22 : 18, edge.length, imagePool.length ? 99 : 0);

    for (let i = 0; i < imageCount; i++) {
      const p = edge[i];
      const tex = imagePool[i % imagePool.length];
      const x = (p.tx + 0.5) * T + (this.rng() - 0.5) * T * 0.72;
      const y = (p.ty + 0.92) * T + (this.rng() - 0.5) * T * 0.24;
      if (!this.isClearOfMarkers(x, y, T * 4.5)) continue;
      const tall = tex.includes('lm-') || tex.includes('lamp') || tex.includes('relay') || tex.includes('roots');
      const scaleBase = style === 'motel' || style === 'stadium' ? 0.28 : style === 'orchard' ? 0.34 : 0.38;
      const img = this.scene.add
        .image(x, y, tex)
        .setOrigin(0.5, 1)
        .setDepth(sortedDepth(y))
        .setScale(scaleBase * (tall ? 1.0 + this.rng() * 0.3 : 0.72 + this.rng() * 0.34))
        .setAlpha(style === 'storm' ? 0.78 : 0.88);
      if (this.rng() < 0.5) img.setFlipX(true);
      if (style === 'storm') img.setTint(this.rng() < 0.55 ? 0xb06bff : 0x60e8ff);
      this.props.push(img);
      this.contactAO(x, y - 2, img.displayWidth * 0.76);
    }

    const proceduralCount = Math.min(style === 'motel' || style === 'stadium' ? 14 : 10, edge.length);
    for (let i = 0; i < proceduralCount; i++) {
      const p = edge[(i * 3 + 1) % edge.length];
      const x = (p.tx + 0.5) * T + (this.rng() - 0.5) * T * 0.42;
      const y = (p.ty + 0.96) * T;
      if (!this.isClearOfMarkers(x, y, T * 4.5)) continue;
      if (style === 'motel' || style === 'stadium') this.addIndustrialStanchion(x, y, style === 'stadium');
      else if (style === 'orchard') this.addOrchardFenceOrStake(x, y);
      else this.addRuralPoleOrRoot(x, y, style === 'storm');
    }

    // A few medium details inside wider pockets, never enough to obstruct reads.
    const midCount = Math.min(12, mid.length);
    for (let i = 0; i < midCount; i++) {
      const p = mid[(i * 5) % mid.length];
      const x = (p.tx + 0.5) * T + (this.rng() - 0.5) * T * 0.5;
      const y = (p.ty + 0.75) * T;
      if (!this.isClearOfMarkers(x, y, T * 5)) continue;
      if (style === 'motel' || style === 'stadium') this.addLowBarrier(x, y, style);
      else if (style === 'orchard') this.addCropRowClump(x, y);
      else this.addBrokenGroundRib(x, y, style === 'storm');
    }
  }

  private depthImagePool(): string[] {
    switch (this.visualStyle) {
      case 'motel':
        return ['td-z2-lm-lamp', 'td-z2-lm-car', 'td-z2-lm-vending', 'td-z2-crate', 'td-z2-planter', 'td-z2-scrap'];
      case 'stadium':
        return ['td-z2-lm-car', 'td-z2-lm-lamp', 'td-z2-lm-sign', 'td-z2-crate', 'td-z2-planter', 'td-z2-rubble'];
      case 'orchard':
        return ['td-z4-lm-cart', 'td-z4-lm-scarecrow', 'td-z4-lm-hay', 'td-z4-hay', 'td-z4-crate', 'td-z4-pumpkin'];
      case 'storm':
        return [TEX.tdLmRelay, TEX.tdLmRoots, TEX.tdScrap, TEX.tdDebris, TEX.tdRock, TEX.tdBush];
      case 'miller':
      default:
        return [TEX.tdLmRelay, TEX.tdLmPod, TEX.tdLmRoots, TEX.tdLog, TEX.tdBush, TEX.tdRock];
    }
  }

  private addIndustrialStanchion(x: number, y: number, town = false): void {
    const h = 38 + this.rng() * (town ? 28 : 18);
    const g = this.makeDrawing(sortedDepth(y));
    g.lineStyle(5, town ? 0x2c3037 : 0x1a1f2a, 0.78);
    g.lineBetween(0, 0, 0, -h);
    g.lineStyle(2, town ? 0xc4a45c : 0x56e3f0, 0.48);
    g.lineBetween(0, -h + 3, 0, -h * 0.45);
    g.fillStyle(0x05070a, 0.64);
    g.fillRoundedRect(-7, -h - 5, 14, 7, 2);
    g.fillStyle(town ? 0xffc966 : 0x44dff0, 0.34);
    g.fillCircle(0, -h - 2, 4);
    g.setPosition(x, y);
    this.contactAO(x, y, 18);
    this.accentLights?.({
      x, y: y - h,
      radius: town ? 46 : 38,
      color: town ? 0xffc966 : 0x35e0d0,
      intensity: 0.1,
    });
  }

  private addOrchardFenceOrStake(x: number, y: number): void {
    const g = this.makeDrawing(sortedDepth(y));
    const w = 24 + this.rng() * 24;
    g.lineStyle(4, 0x5a3b1d, 0.62);
    g.lineBetween(-w * 0.5, -10, w * 0.5, -6);
    g.lineStyle(3, 0x8a612f, 0.54);
    for (let k = -1; k <= 1; k++) {
      const px = (k * w) / 3;
      g.lineBetween(px, 0, px + (this.rng() - 0.5) * 4, -22 - this.rng() * 14);
    }
    g.setPosition(x, y);
    this.contactAO(x, y, w);
  }

  private addRuralPoleOrRoot(x: number, y: number, corrupted = false): void {
    const g = this.makeDrawing(sortedDepth(y));
    if (corrupted) {
      g.lineStyle(4, 0x1a1028, 0.76);
      g.lineBetween(0, 0, -8, -42);
      g.lineStyle(2, 0xb06bff, 0.24);
      g.lineBetween(0, -6, -8, -42);
      g.lineBetween(-3, -22, 12, -34);
      this.accentLights?.({ x, y: y - 24, radius: 48, color: 0xb06bff, intensity: 0.11 });
    } else {
      g.lineStyle(4, 0x263424, 0.66);
      g.lineBetween(0, 0, 2, -40);
      g.lineStyle(2, 0x65755a, 0.42);
      g.lineBetween(2, -30, -15, -42);
      g.lineBetween(1, -24, 16, -34);
    }
    g.setPosition(x, y);
    this.contactAO(x, y, 22);
  }

  private addLowBarrier(x: number, y: number, style: 'motel' | 'stadium'): void {
    const g = this.makeDrawing(sortedDepth(y));
    const w = 38 + this.rng() * 36;
    g.fillStyle(style === 'stadium' ? 0x252933 : 0x10141d, 0.56);
    g.fillRoundedRect(-w * 0.5, -12, w, 14, 3);
    g.lineStyle(2, style === 'stadium' ? 0xd09b38 : 0x35e0d0, 0.22);
    g.lineBetween(-w * 0.42, -6, w * 0.42, -6);
    g.setPosition(x, y);
    this.contactAO(x, y, w);
  }

  private addCropRowClump(x: number, y: number): void {
    const g = this.makeDrawing(sortedDepth(y));
    for (let i = 0; i < 6; i++) {
      const ox = (this.rng() - 0.5) * 24;
      const h = 14 + this.rng() * 18;
      g.lineStyle(2, i % 2 ? 0x9e8d43 : 0x4c5a2d, 0.45);
      g.lineBetween(ox, 0, ox + (this.rng() - 0.5) * 9, -h);
    }
    g.setPosition(x, y);
    this.contactAO(x, y, 28);
  }

  private addBrokenGroundRib(x: number, y: number, corrupted = false): void {
    const g = this.makeDrawing(DEPTH.decal + 1, corrupted ? 0.72 : 0.58);
    const w = 30 + this.rng() * 30;
    g.lineStyle(3, corrupted ? 0x5d318c : 0x2c362e, corrupted ? 0.24 : 0.18);
    g.lineBetween(-w * 0.5, 0, w * 0.5, -4);
    g.lineStyle(1, corrupted ? 0x88efff : 0x68836c, corrupted ? 0.18 : 0.12);
    for (let k = -2; k <= 2; k++) g.lineBetween(k * 7, -2, k * 7 + (this.rng() - 0.5) * 8, -10 - this.rng() * 8);
    g.setPosition(x, y);
  }

  /**
   * Colour accents. The first pass was one hue end to end — green ground, green
   * light, green node — which reads as a filter rather than art direction.
   * IDEAL2 stays cool and desaturated overall and earns its richness from a few
   * SMALL saturated notes: teal bioluminescence in the undergrowth and warm
   * amber embers. Scarce on purpose (~5% coverage each), and never red — red
   * belongs to threat.
   */
  private scatterAccents(): void {
    const { tile: T, floor, art, biome } = this.input;
    if (!art.hd || !this.accentLights) return;
    const acc = biome.accents;
    const spots = floor.filter((p) => p.edge);
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    const picks = Math.min(acc.count, spots.length);
    for (let i = 0; i < picks; i++) {
      const p = spots[i];
      const x = (p.tx + 0.5) * T + (this.rng() - 0.5) * T;
      const y = (p.ty + 0.5) * T + (this.rng() - 0.5) * T;
      const warm = this.rng() < acc.warmChance;
      this.accentLights({
        x, y,
        radius: warm ? 34 + this.rng() * 22 : 26 + this.rng() * 20,
        color: warm ? acc.warm : this.rng() < 0.75 ? acc.coolA : acc.coolB,
        intensity: warm ? 0.2 + this.rng() * 0.12 : 0.16 + this.rng() * 0.14,
      });
    }
  }

  /**
   * A handful of real landmarks — navigation anchors and composition, NOT more
   * scatter. Keep them edge-biased and skip flat floor landmarks; central route
   * structures should be authored so they can get clear purpose/collision.
   */
  private placeLandmarks(): void {
    const { tile: T, floor, markers, art, biome } = this.input;
    if (!art.hd) return;
    const set = biome.landmarks;
    const candidates = floor.filter(
      (p) => p.edge && !markers.some((m) => Math.abs(p.tx - m.tx) + Math.abs(p.ty - m.ty) < 7)
    );
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const placed: Array<{ x: number; y: number }> = [];
    let idx = 0;
    for (const [key, emis, scale] of set) {
      if (key === biome.flatLandmark) continue;
      const spot = candidates.find((p) => {
        const x = (p.tx + 0.5) * T;
        const y = (p.ty + 0.5) * T;
        return placed.every((q) => Math.hypot(q.x - x, q.y - y) > T * 9);
      });
      if (!spot) continue;
      const x = (spot.tx + 0.5) * T;
      const y = (spot.ty + 1) * T;
      placed.push({ x, y });
      const img = this.scene.add
        .image(x, y, key)
        .setOrigin(0.5, 1)
        .setDepth(sortedDepth(y))
        .setScale(scale);
      this.props.push(img);
      this.contactAO(x, y - 2, img.displayWidth * 0.8);
      if (emis) {
        const e = this.scene.add
          .image(x, y, emis)
          .setOrigin(0.5, 1)
          .setDepth(sortedDepth(y) + 1)
          .setScale(scale)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.85);
        this.props.push(e);
      }
      // landmarks carry their own light so they read from across the arena.
      // second landmark in the set is the biome's warm/powered one (z1: the
      // relay); the rest carry signal green.
      const lColor = key === set[1]?.[0] ? biome.accents.warm : C.signal;
      // The signal-green landmark glow was a big part of the "too much green"
      // read, so green landmarks are kept much fainter than the biome's own
      // warm/cool accents.
      const lIntensity = lColor === C.signal ? 0.12 : 0.22;
      this.accentLights?.({ x, y: y - 8, radius: 64, color: lColor, intensity: lIntensity });
      idx++;
    }
    void idx;
  }

  /* ------------------------------ 5. canopy --------------------------------- */
  /** Dark out-of-focus foliage the player passes beneath. Frames the arena and
   *  hides the hard world-bounds edge without ever covering combat. */
  private buildCanopy(AW: number, AH: number): void {
    const { art, tile: T, markers, biome } = this.input;
    // A biome with no overhead cover (an open lot, a stadium bowl) declares
    // canopy: null and simply skips the frame — it must not fake one.
    if (!art.hd || !biome.canopy) return;
    // A FRAME, not a ceiling. Canopy sits only in a thin band hugging the arena
    // bounds, so it hides the hard world edge and adds depth without ever
    // covering combat. An earlier version scattered it across the arena at 2.4x
    // scale and effectively blacked out the play area.
    const BAND = T * 0.9;
    const clearOfMarkers = (x: number, y: number) =>
      !markers.some((m) => Math.hypot(x - (m.tx + 0.5) * T, y - (m.ty + 0.5) * T) < T * 4);

    for (let i = 0; i < 18; i++) {
      const onX = this.rng() < 0.5;
      const x = onX ? this.rng() * AW : this.rng() < 0.5 ? this.rng() * BAND : AW - this.rng() * BAND;
      const y = onX ? (this.rng() < 0.5 ? this.rng() * BAND : AH - this.rng() * BAND) : this.rng() * AH;
      if (!clearOfMarkers(x, y)) continue; // never obscure spawn / node / breach
      const img = this.scene.add
        .image(x, y, biome.canopy)
        .setDepth(DEPTH.foreground)
        .setTint(biome.tints.canopy)
        .setAlpha(0.55)
        .setScale(TD_VISUALS.artScale * (0.55 + this.rng() * 0.35))
        .setAngle(this.rng() * 360);
      this.props.push(img);
    }
  }

  private buildForegroundFrame(AW: number, AH: number): void {
    const { tile: T, art } = this.input;
    if (!art.hd) return;
    const style = this.visualStyle;
    const edgeBand = T * 1.15;
    const count = style === 'motel' || style === 'stadium' ? 12 : 14;

    for (let i = 0; i < count; i++) {
      const side = Math.floor(this.rng() * 4);
      const x = side === 0 ? this.rng() * AW : side === 1 ? this.rng() * AW : side === 2 ? this.rng() * edgeBand : AW - this.rng() * edgeBand;
      const y = side === 0 ? this.rng() * edgeBand : side === 1 ? AH - this.rng() * edgeBand : this.rng() * AH;
      if (!this.isClearOfMarkers(x, y, T * 5)) continue;
      if (style === 'motel' || style === 'stadium') this.addBuiltForeground(x, y, side, style);
      else if (style === 'orchard') this.addOrchardForeground(x, y, side);
      else this.addOrganicForeground(x, y, side, style === 'storm');
    }
  }

  private addBuiltForeground(x: number, y: number, side: number, style: 'motel' | 'stadium'): void {
    const g = this.makeDrawing(DEPTH.foreground, 0.42);
    const w = 92 + this.rng() * 80;
    const h = 18 + this.rng() * 22;
    const tint = style === 'stadium' ? 0x161b24 : 0x080a10;
    g.fillStyle(tint, 0.86);
    if (side <= 1) {
      g.fillRoundedRect(-w * 0.5, -h, w, h, 3);
      g.lineStyle(2, style === 'stadium' ? 0xc4913c : 0x35e0d0, 0.25);
      g.lineBetween(-w * 0.45, -h + 5, w * 0.45, -h + 5);
    } else {
      g.fillRoundedRect(-h * 0.5, -w * 0.5, h, w, 3);
      g.lineStyle(2, style === 'stadium' ? 0xc4913c : 0x35e0d0, 0.2);
      g.lineBetween(0, -w * 0.42, 0, w * 0.42);
    }
    g.setPosition(x, y);
  }

  private addOrchardForeground(x: number, y: number, side: number): void {
    const g = this.makeDrawing(DEPTH.foreground, 0.38);
    const spread = 86 + this.rng() * 64;
    for (let i = 0; i < 18; i++) {
      const t = (i / 17 - 0.5) * spread;
      const baseX = side <= 1 ? t : 0;
      const baseY = side <= 1 ? 0 : t;
      const h = 28 + this.rng() * 44;
      g.lineStyle(3, i % 2 ? 0x2e351d : 0x4d5a2d, 0.58);
      g.lineBetween(baseX, baseY, baseX + (this.rng() - 0.5) * 16, baseY - h);
    }
    g.setPosition(x, y);
  }

  private addOrganicForeground(x: number, y: number, side: number, corrupted = false): void {
    const g = this.makeDrawing(DEPTH.foreground, corrupted ? 0.36 : 0.42);
    const spread = 96 + this.rng() * 88;
    const colorA = corrupted ? 0x0b0714 : 0x0e1a13;
    const colorB = corrupted ? 0x43236d : 0x203b27;
    g.fillStyle(colorA, 0.72);
    for (let i = 0; i < 7; i++) {
      const t = (i / 6 - 0.5) * spread;
      const ex = side <= 1 ? t : (this.rng() - 0.5) * 20;
      const ey = side <= 1 ? (this.rng() - 0.5) * 20 : t;
      g.fillEllipse(ex, ey, 44 + this.rng() * 46, 20 + this.rng() * 32);
    }
    g.lineStyle(2, colorB, corrupted ? 0.28 : 0.2);
    for (let i = 0; i < 8; i++) {
      const t = (i / 7 - 0.5) * spread;
      const sx = side <= 1 ? t : 0;
      const sy = side <= 1 ? 0 : t;
      g.lineBetween(sx, sy, sx + (this.rng() - 0.5) * 40, sy - 24 - this.rng() * 36);
    }
    if (corrupted) {
      g.lineStyle(1, 0x88efff, 0.12);
      g.lineBetween(-spread * 0.3, -8, spread * 0.24, -26);
    }
    g.setPosition(x, y);
  }

  destroy(): void {
    this.layers.forEach((l) => l.destroy());
    this.shadowBake?.destroy();
    this.maskImg?.destroy();
    this.wallMaskImg?.destroy();
    this.faceMaskImg?.destroy();
    this.overlays.forEach((o) => o.destroy());
    this.overlays = [];
    this.props.forEach((p) => p.destroy());
    this.drawings.forEach((g) => g.destroy());
    this.layers = [];
    this.props = [];
    this.drawings = [];
  }
}
