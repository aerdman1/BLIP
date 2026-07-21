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
    this.buildWalls();
    this.dressEdges();
    this.scatterProps();
    this.buildCanopy(AW, AH);
    this.scatterAccents();
    this.placeLandmarks();
  }

  /* ------------------------------ 1. ground ---------------------------------- */
  private bakeGround(AW: number, AH: number): void {
    const { tile: T, w: W, h: H, solid, halls, art } = this.input;

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
    this.layers.push(base);

    // organic lit/shadow drift — soft blobs, no repeats, no edges
    const tints = this.input.biome.tints;
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
   * scatter. Placed on open floor well clear of spawn/node/breach so they never
   * intrude on the traversal route or a combat space.
   */
  private placeLandmarks(): void {
    const { tile: T, floor, markers, art, biome } = this.input;
    if (!art.hd) return;
    const set = biome.landmarks;
    const open = floor.filter(
      (p) => !p.edge && !markers.some((m) => Math.abs(p.tx - m.tx) + Math.abs(p.ty - m.ty) < 7)
    );
    for (let i = open.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [open[i], open[j]] = [open[j], open[i]];
    }
    const placed: Array<{ x: number; y: number }> = [];
    let idx = 0;
    for (const [key, emis, scale] of set) {
      const spot = open.find((p) => {
        const x = (p.tx + 0.5) * T;
        const y = (p.ty + 0.5) * T;
        return placed.every((q) => Math.hypot(q.x - x, q.y - y) > T * 7);
      });
      if (!spot) continue;
      const x = (spot.tx + 0.5) * T;
      const y = (spot.ty + 1) * T;
      placed.push({ x, y });
      const isPool = key === biome.flatLandmark;
      const img = this.scene.add
        .image(x, y, key)
        .setOrigin(0.5, isPool ? 0.5 : 1)
        .setDepth(isPool ? DEPTH.decal + 5 : sortedDepth(y))
        .setScale(scale);
      this.props.push(img);
      if (!isPool) this.contactAO(x, y - 2, img.displayWidth * 0.8);
      if (emis) {
        const e = this.scene.add
          .image(x, y, emis)
          .setOrigin(0.5, isPool ? 0.5 : 1)
          .setDepth((isPool ? DEPTH.decal + 6 : sortedDepth(y)) + 1)
          .setScale(scale)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.85);
        this.props.push(e);
      }
      // landmarks carry their own light so they read from across the arena.
      // second landmark in the set is the biome's warm/powered one (z1: the
      // relay); the flat one glows cool; the rest carry signal green.
      const lColor = key === set[1]?.[0] ? biome.accents.warm : isPool ? biome.accents.coolA : C.signal;
      // The signal-green landmark glow was a big part of the "too much green"
      // read, so green landmarks are kept much fainter than the biome's own
      // warm/cool accents.
      const lIntensity = lColor === C.signal ? 0.12 : 0.22;
      this.accentLights?.({ x, y: y - 8, radius: isPool ? 84 : 64, color: lColor, intensity: lIntensity });
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
      this.scene.add
        .image(x, y, biome.canopy)
        .setDepth(DEPTH.foreground)
        .setTint(biome.tints.canopy)
        .setAlpha(0.55)
        .setScale(TD_VISUALS.artScale * (0.55 + this.rng() * 0.35))
        .setAngle(this.rng() * 360);
    }
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
    this.layers = [];
    this.props = [];
  }
}
