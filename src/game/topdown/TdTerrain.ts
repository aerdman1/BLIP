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
import type { TdArt } from './TdAssets';

export interface TerrainInput {
  tile: number;
  w: number;
  h: number;
  solid: boolean[][];
  halls: Array<{ x: number; y: number; w: number; h: number }>;
  floor: Array<{ tx: number; ty: number; edge: boolean }>;
  markers: Array<{ tx: number; ty: number }>;
  art: TdArt;
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
  private props: Phaser.GameObjects.Image[] = [];
  private rng = mulberry(0x5eed47);

  constructor(private scene: Phaser.Scene, private input: TerrainInput) {}

  build(): void {
    const { tile: T, w: W, h: H } = this.input;
    const AW = W * T;
    const AH = H * T;

    this.bakeGround(AW, AH);
    this.buildWalls();
    this.dressEdges();
    this.scatterProps();
    this.buildCanopy(AW, AH);
  }

  /* ------------------------------ 1. ground ---------------------------------- */
  private bakeGround(AW: number, AH: number): void {
    const { tile: T, w: W, h: H, solid, halls, art } = this.input;

    // LAYERED TILING, NOT CELL STAMPING.
    //
    // Stamping material per cell (any cell size) leaves a visible rectangular
    // grid across the whole arena — which fails the spec's "no rectangular edge
    // is ever visible" outright. Instead three full-arena tileSprites of the
    // SAME materials at DIFFERENT tile scales and offsets are layered: their
    // repeat periods are mutually irrational, so the eye finds no grid, and
    // varying alpha gives organic lit/shadow drift. Cost is 3 draw calls for
    // the entire ground instead of hundreds.
    const scale = TD_VISUALS.groundCell / 512; // photoscan → world material size

    const layer = (key: string, s: number, alpha: number, ox: number, oy: number, depth: number) => {
      const ts = this.scene.add
        .tileSprite(0, 0, AW, AH, key)
        .setOrigin(0)
        .setDepth(depth)
        .setAlpha(alpha);
      ts.tileScaleX = s;
      ts.tileScaleY = s;
      ts.tilePositionX = ox;
      ts.tilePositionY = oy;
      return ts;
    };

    this.layers.push(layer(art.ground, scale, 1, 0, 0, DEPTH.ground));
    // lit + dark drift at deliberately mismatched periods
    this.layers.push(layer(art.groundLit, scale * 1.61, 0.4, 137, 61, DEPTH.ground + 1));
    this.layers.push(layer(art.groundDark, scale * 0.83, 0.34, 311, 199, DEPTH.ground + 2));

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
      const pathLayer = layer(art.path, scale, 0.85, 0, 0, DEPTH.patch);
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

  /* ------------------------------ 2. wall extrusion -------------------------- */
  private buildWalls(): void {
    const { tile: T, w: W, h: H, solid, art } = this.input;
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        if (!solid[y][x]) { x++; continue; }
        const x0 = x;
        while (x < W && solid[y][x]) x++;
        const ww = (x - x0) * T;
        const baseY = (y + 1) * T; // the wall's contact line with the ground

        // face strip rises from the base — only where the tile below is open,
        // otherwise you would draw a facade inside a solid block.
        const exposed = !solid[y + 1]?.slice(x0, x).every(Boolean);
        if (exposed) {
          this.scene.add
            .tileSprite(x0 * T, baseY - OBLIQUE.wallH, ww, OBLIQUE.wallH, art.wallFace)
            .setOrigin(0, 0)
            .setDepth(sortedDepth(baseY) - 1);
        }
        // top cap
        this.scene.add
          .tileSprite(x0 * T, y * T - OBLIQUE.wallH, ww, T, art.wallTop)
          .setOrigin(0, 0)
          .setDepth(sortedDepth(baseY));
      }
    }
  }

  /* ------------------------------ 3. irregular edges ------------------------- */
  /** Bury every straight room/hall boundary under organic cover. */
  private dressEdges(): void {
    const { tile: T, floor, art } = this.input;
    if (!art.hd) return;
    const skirt = [TEX.tdTuft, TEX.tdFern, TEX.tdBush, TEX.tdRock];
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
        this.props.push(img);
      }
    }
  }

  /* ------------------------------ 4. prop scatter ---------------------------- */
  private scatterProps(): void {
    const { tile: T, floor, markers, art } = this.input;
    if (!art.hd) return;
    const pool = [TEX.tdRock, TEX.tdLog, TEX.tdBush, TEX.tdDebris, TEX.tdScrap, TEX.tdFern];
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
      const img = this.scene.add
        .image(x, y, pool[Math.floor(this.rng() * pool.length)])
        .setOrigin(0.5, 1)
        .setDepth(sortedDepth(y))
        .setScale(TD_VISUALS.artScale * (0.85 + this.rng() * 0.45));
      if (this.rng() < 0.5) img.setFlipX(true);
      this.props.push(img);
    }
  }

  /* ------------------------------ 5. canopy --------------------------------- */
  /** Dark out-of-focus foliage the player passes beneath. Frames the arena and
   *  hides the hard world-bounds edge without ever covering combat. */
  private buildCanopy(AW: number, AH: number): void {
    const { art, tile: T, markers } = this.input;
    if (!art.hd) return;
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
      this.scene.add
        .image(x, y, TEX.tdCanopy)
        .setDepth(DEPTH.foreground)
        .setTint(C.foliageNear)
        .setAlpha(0.55)
        .setScale(TD_VISUALS.artScale * (0.55 + this.rng() * 0.35))
        .setAngle(this.rng() * 360);
    }
  }

  destroy(): void {
    this.layers.forEach((l) => l.destroy());
    this.shadowBake?.destroy();
    this.maskImg?.destroy();
    this.props.forEach((p) => p.destroy());
    this.layers = [];
    this.props = [];
  }
}
