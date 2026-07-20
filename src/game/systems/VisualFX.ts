/**
 * VisualFX — the "HD-2D" premium render treatment.
 *
 * A SPIKE, currently opted into by Miller Field (FieldScene) ONLY. Every other
 * zone is untouched because nothing else imports this module.
 *
 * What it adds, all on top of the existing 480×270 pixel world (the internal
 * resolution is NOT raised, collision/physics are NOT touched — this is a pure
 * render + perspective treatment):
 *
 *   1. POST-PROCESSING — camera bloom, a cinematic night colour grade
 *      (cool shadows / warm highlights), a soft vignette and drifting grain.
 *   2. LIGHTING + SHADOWS — a screen-space ambient-darkness multiply layer with
 *      additive radial lights punching holes in it, plus real contact shadows
 *      that ride the terrain under the player, drones and static props.
 *   3. DEEP PARALLAX + DEPTH-OF-FIELD — an 8-layer depth stack with progressive
 *      blur and atmospheric perspective (desaturate + blue-shift toward the back),
 *      and two dark foreground silhouette layers the player passes BEHIND.
 *   4. ANGLED 2.5D — every layer is offset + scaled by depth and gets vertical
 *      camera parallax, and the field reads as a receding ground plane via bands
 *      that compress toward the horizon.
 *   5. RICHER COLOUR — all textures generated here use multi-stop gradient ramps
 *      instead of flat single-colour slabs.
 *
 * REVERSIBLE: set `VISUAL_FX.enabled = false` and the scene renders exactly as
 * it did before (every entry point becomes a no-op).
 *
 * PERFORMANCE (this has to run on an iPad):
 *   - Textures are generated once and cached globally (`textures.exists` guard).
 *   - Every sprite is created up front; `update()` only mutates x/y/alpha/scale
 *     on pre-allocated objects — no per-frame allocation, no per-frame texture work.
 *   - Shadow ground heights come from a precomputed Int16Array, not raycasts.
 *   - Expensive effects (per-layer blur, bloom steps, grain) are gated behind
 *     `VISUAL_FX.quality`, which resolves to 'low' automatically on touch devices.
 *   - WebGL-only effects silently no-op under the Canvas fallback.
 */
import Phaser from 'phaser';
import { EVT, PALETTE as P, TILE, VIEW_H, VIEW_W } from '../config';
import { cellAt, surfaceYAt, type LevelDef } from '../data/levels';
import { bus } from './EventBus';

/* ================================== config ================================= */

export type VfxQuality = 'auto' | 'high' | 'low';

/** The single knob. Flip `enabled` to false to A/B the whole treatment off. */
export const VISUAL_FX = {
  /** MASTER TOGGLE — false ⇒ every VisualFX entry point becomes a no-op. */
  enabled: false,

  /** 'auto' ⇒ 'low' on touch/mobile GPUs, 'high' on desktop. */
  quality: 'auto' as VfxQuality,

  /** 1. post-processing */
  post: {
    /**
     * OFF BY DEFAULT — deliberately, after A/B measurement.
     *
     * Phaser's Bloom FX has NO luminance threshold: it blurs the WHOLE frame and
     * adds it back. On a dark scene that lifts the black point everywhere and
     * visibly greys out the terrain's browns and greens — the exact opposite of
     * the "better colours, less flat" goal. Even at strength 0.08 the wash was
     * obvious side-by-side.
     *
     * The halation you actually see instead comes from the additive light pools
     * (moon, farm window, player, drone eyes, signal props), which is both
     * cheaper and art-directable. Flip this to true to compare.
     */
    bloom: false,
    bloomStrength: 0.08,
    bloomBlur: 0.6,
    bloomStepsHigh: 4,
    bloomStepsLow: 2,
    grade: true,
    /** Saturation is pushed UP to fight the wash the bloom introduces. Contrast
     *  is kept LOW: Phaser's contrast() subtracts value/2 from every channel,
     *  which crushes an already-dark night scene into mud. `lift` puts that back. */
    saturation: 0.22,
    contrast: 0.07,
    lift: 0.05,
    vignette: true,
    vignetteRadius: 0.8,
    vignetteStrength: 0.4,
    grain: true,
    grainAlpha: 0.04,
  },

  /** 2. lighting + shadows */
  light: {
    /** strength of the ambient darkness multiply layer (0 = off, 1 = full).
     *  Modest on purpose — the lights and the vignette do the shaping; pushing
     *  this turns the terrain into flat grey. */
    ambient: 0.2,
    /** contact-shadow opacity directly under a grounded object */
    shadowAlpha: 0.46,
    /** shadows fade out this many px above the ground */
    shadowFadeHeight: 76,
    moonColor: 0xbcd4ff,
    windowColor: 0xffc06a,
    playerColor: 0xa8ff3e,
    droneColor: 0xd84a42,
  },

  /** 3 + 4. depth stack */
  depth: {
    /** background blur radius per layer index (index 0 = furthest). High only. */
    blurFar: 2.0,
    blurMid: 1.0,
    /** foreground silhouette blur (near-field DOF) — low: past ~1 the fronds
     *  stop reading as grass and turn into smeared blobs */
    blurNear: 0.6,
    /** how much each layer drifts vertically with the camera (0 = pinned) */
    verticalParallax: 0.34,
  },
} as const;

type Quality = 'high' | 'low';

/** Resolve `quality: 'auto'` against the device. */
export function vfxQuality(scene: Phaser.Scene): Quality {
  if (VISUAL_FX.quality !== 'auto') return VISUAL_FX.quality;
  const d = scene.game.device;
  const mobile = d.os.iOS || d.os.iPad || d.os.iPhone || d.os.android || d.input.touch;
  return mobile ? 'low' : 'high';
}

/** Enabled AND the renderer can actually do it. */
export function vfxEnabled(scene: Phaser.Scene): boolean {
  return VISUAL_FX.enabled && scene.game.renderer.type === Phaser.WEBGL;
}

/* =============================== depth budget ==============================
 * FieldScene's shipped parallax occupies exact integers:
 *   0 sky · 1 stars/moon/rays · 2 clouds + hillsBack · 3 island + hillsFar
 *   4 hillsMid + distHaze · 5 fog · 6–11 world/props/mist · 17–21 entities · 60 UI
 * The new layers slot into the FRACTIONAL gaps so nothing shipped is reordered:
 * two extra ridges peek out BEHIND the shipped hills (1.6/1.7), and the treeline,
 * farm and fences form a new MID-ground in front of them (4.5–4.8).
 * ------------------------------------------------------------------------- */
const D = {
  sky: 0.05,
  layer: [1.6, 1.7, 4.5, 4.6, 4.8],
  ground: 5.5,
  // Above the terrain (8–9) but BELOW the entities (17+), so the world is graded
  // while the player and drones stay crisp and readable. Kept weak on purpose —
  // pushing it turns the rich browns and greens into flat grey.
  ambient: 12,
  lights: 13,
  shadow: 15,
  foreground: 26,
  grain: 30,
} as const;

/* ============================== texture helpers ============================ */

const K = {
  sky: 'vfx-sky',
  light: 'vfx-light',
  shadow: 'vfx-shadow',
  ambient: 'vfx-ambient',
  grain: 'vfx-grain',
  ridge0: 'vfx-ridge0',
  ridge1: 'vfx-ridge1',
  treeline: 'vfx-treeline',
  farm: 'vfx-farm',
  fences: 'vfx-fences',
  ground: 'vfx-ground',
  fgGrass: 'vfx-fg-grass',
  fgWeeds: 'vfx-fg-weeds',
} as const;

const hex = (c: number, a = 1): string =>
  `rgba(${(c >> 16) & 0xff},${(c >> 8) & 0xff},${c & 0xff},${a})`;

/** channel-wise lerp between two packed colours */
function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (
    ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t)
  ) & 0xffffff;
}

/**
 * ATMOSPHERIC PERSPECTIVE: push a colour toward the night haze by distance.
 *
 * The haze is DARK, not mid-blue. At night distant land reads as a silhouette
 * against a lighter sky — hazing toward the sky's own value (the obvious
 * daytime instinct) makes every far layer vanish into the background.
 */
const NIGHT_HAZE = 0x16203d;

function aerial(c: number, dist: number): number {
  return mix(c, NIGHT_HAZE, Math.min(1, dist));
}

function canvasTex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return; // generated once per session, then reused
  const ct = scene.textures.createCanvas(key, w, h);
  if (!ct) return;
  draw(ct.context);
  ct.refresh();
}

/** smooth (non-blocky) sampling — for lights, shadows and gradient ramps */
function linear(scene: Phaser.Scene, key: string): void {
  scene.textures.get(key)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/**
 * A seamless ridge silhouette with a TONAL RAMP instead of a flat fill.
 * Contour = sum of sine harmonics with integer periods across the width, so the
 * tile wraps exactly (same trick the shipped ProceduralArt ridges use).
 */
function ridgeTex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  base: number,
  harmonics: Array<[number, number, number]>,
  topColor: number,
  bottomColor: number,
  rim: number,
): void {
  canvasTex(scene, key, w, h, (ctx) => {
    const contour = (x: number): number => {
      let y = base;
      for (const [k, amp, ph] of harmonics) y += Math.sin((Math.PI * 2 * k * x) / w + ph) * amp;
      return y;
    };
    ctx.beginPath();
    ctx.moveTo(0, contour(0));
    for (let x = 1; x <= w; x++) ctx.lineTo(x, contour(x));
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    // one gradient fill = a real tonal ramp, no flat slab
    const g = ctx.createLinearGradient(0, base - 14, 0, h);
    g.addColorStop(0, hex(topColor));
    g.addColorStop(0.45, hex(mix(topColor, bottomColor, 0.55)));
    g.addColorStop(1, hex(bottomColor));
    ctx.fillStyle = g;
    ctx.fill();
    // moonlit rim so the landscape edge reads against the sky
    ctx.beginPath();
    ctx.moveTo(0, contour(0));
    for (let x = 1; x <= w; x++) ctx.lineTo(x, contour(x));
    ctx.strokeStyle = hex(rim, 0.75);
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

/* ---------------------------- texture generation --------------------------- */

function ensureTextures(scene: Phaser.Scene): void {
  const W = VIEW_W;

  /* 5. RICHER COLOUR — a 9-stop night sky instead of a 5-stop one. */
  canvasTex(scene, K.sky, W, VIEW_H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0.0, '#04060f');
    g.addColorStop(0.16, '#080d24');
    g.addColorStop(0.34, '#0e1738');
    g.addColorStop(0.5, '#16244f');
    g.addColorStop(0.64, '#1f3163');
    g.addColorStop(0.76, '#2c3d6e');
    g.addColorStop(0.86, '#4a4468');
    g.addColorStop(0.94, '#7a4f5c');
    g.addColorStop(1.0, '#b8683c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, VIEW_H);
    // a warm glow pooling where the moon sits, blended into the ramp
    const m = ctx.createRadialGradient(70, 46, 4, 70, 46, 140);
    m.addColorStop(0, hex(P.moon, 0.16));
    m.addColorStop(0.5, hex(P.moon, 0.05));
    m.addColorStop(1, hex(P.moon, 0));
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, W, VIEW_H);
  });
  linear(scene, K.sky);

  /* universal light sprite — many stops so the falloff is buttery, not banded */
  canvasTex(scene, K.light, 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.12, 'rgba(255,255,255,0.72)');
    g.addColorStop(0.28, 'rgba(255,255,255,0.42)');
    g.addColorStop(0.48, 'rgba(255,255,255,0.2)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.07)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  linear(scene, K.light);

  /* contact shadow — a soft squashed ellipse (multiplied onto the ground) */
  canvasTex(scene, K.shadow, 96, 40, (ctx) => {
    const g = ctx.createRadialGradient(48, 20, 0, 48, 20, 48);
    g.addColorStop(0, 'rgba(8,10,20,0.92)');
    g.addColorStop(0.4, 'rgba(8,10,20,0.55)');
    g.addColorStop(0.72, 'rgba(8,10,20,0.18)');
    g.addColorStop(1, 'rgba(8,10,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 96, 40);
  });
  linear(scene, K.shadow);

  /* AMBIENT DARKNESS — drawn with MULTIPLY, so this colour IS the multiplier.
   * Cool + dark up high, a warm lift at the horizon, dark cool again down low. */
  canvasTex(scene, K.ambient, 8, VIEW_H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0.0, '#6d7ca8');
    g.addColorStop(0.32, '#8290b6');
    g.addColorStop(0.58, '#b3a4ab'); // horizon warms — the moonlit band
    g.addColorStop(0.78, '#9a9cb6');
    g.addColorStop(1.0, '#6a7292');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, VIEW_H);
  });
  linear(scene, K.ambient);

  /* film grain */
  canvasTex(scene, K.grain, 64, 64, (ctx) => {
    const img = ctx.createImageData(64, 64);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + Math.floor(Math.random() * 135);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });

  /* ---- 3 + 4. THE DEPTH STACK (furthest → nearest) ---- */

  // furthest hills — heavily hazed, almost sky-coloured
  ridgeTex(scene, K.ridge0, W, 72, 30, [[1, 6, 1.2], [3, 8, 2.9], [7, 3, 0.4]],
    aerial(0x1b2748, 0.62), aerial(0x121a35, 0.5), aerial(0x3d5289, 0.5));
  // second ridge — a touch more contrast + colour
  ridgeTex(scene, K.ridge1, W, 78, 34, [[2, 8, 0.6], [5, 6, 2.1], [9, 3, 3.3]],
    aerial(0x1d2c4e, 0.44), aerial(0x111a33, 0.3), aerial(0x44598f, 0.35));

  // treeline — a dense band of pine silhouettes on a graded base
  canvasTex(scene, K.treeline, W, 64, (ctx) => {
    // deliberately DARKER than the sky so it reads as a silhouette band
    const g = ctx.createLinearGradient(0, 22, 0, 64);
    g.addColorStop(0, hex(0x142a2c));
    g.addColorStop(1, hex(0x081517));
    ctx.fillStyle = g;
    for (let i = 0; i < 90; i++) {
      // deterministic-ish spread; stamped at x±W so the tile wraps cleanly
      const x = (i * 71) % W;
      const hgt = 16 + ((i * 37) % 18);
      const wid = 5 + ((i * 13) % 5);
      for (const off of [-W, 0, W]) {
        ctx.beginPath();
        ctx.moveTo(x + off, 40 - hgt);
        ctx.lineTo(x + off - wid, 46);
        ctx.lineTo(x + off + wid, 46);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillRect(0, 44, W, 20);
  });

  // MID: the farm — barn + silo + outbuilding, the zone's landmark silhouette,
  // with a warm lit window (which gets a real light pool attached to it).
  canvasTex(scene, K.farm, 200, 96, (ctx) => {
    // The barn is the zone LANDMARK — a moonlit off-white that reads BRIGHT
    // against the dark treeline behind it. Tonal separation is what sells depth;
    // hazing this into the background is what made it disappear.
    const body = ctx.createLinearGradient(0, 40, 0, 96);
    body.addColorStop(0, hex(mix(P.barnWhite, 0x8fa2c8, 0.34))); // moonlit face
    body.addColorStop(0.55, hex(mix(P.barnWhiteShade, 0x6d7ea6, 0.4)));
    body.addColorStop(1, hex(mix(0x3d4560, 0x232b40, 0.5))); // grounded shadow
    ctx.fillStyle = body;
    ctx.fillRect(40, 48, 72, 48);
    // gambrel roof
    ctx.fillStyle = hex(mix(P.barnRoofGreenDark, NIGHT_HAZE, 0.3));
    ctx.beginPath();
    ctx.moveTo(36, 48);
    ctx.lineTo(58, 34);
    ctx.lineTo(94, 34);
    ctx.lineTo(116, 48);
    ctx.closePath();
    ctx.fill();
    // moonlit ridge line along the roof
    ctx.fillStyle = hex(mix(P.barnRoofGreen, 0xbcd4ff, 0.45), 0.85);
    ctx.fillRect(36, 47, 80, 2);
    ctx.fillRect(58, 33, 36, 1);
    // silo — a cylinder shaded with a horizontal ramp (round, not a slab)
    const cyl = ctx.createLinearGradient(124, 0, 154, 0);
    cyl.addColorStop(0, hex(0x28304a));
    cyl.addColorStop(0.34, hex(0x8593ba)); // the moonlit side
    cyl.addColorStop(0.62, hex(0x515d80));
    cyl.addColorStop(1, hex(0x1b2233));
    ctx.fillStyle = cyl;
    ctx.fillRect(124, 26, 30, 70);
    ctx.beginPath();
    ctx.ellipse(139, 26, 15, 7, 0, Math.PI, 0);
    ctx.fill();
    // outbuilding
    ctx.fillStyle = hex(0x39415e);
    ctx.fillRect(4, 66, 30, 30);
    ctx.fillStyle = hex(0x232a40);
    ctx.beginPath();
    ctx.moveTo(2, 66);
    ctx.lineTo(19, 56);
    ctx.lineTo(36, 66);
    ctx.closePath();
    ctx.fill();
    // the lit window
    ctx.fillStyle = hex(P.windowLight, 0.9);
    ctx.fillRect(68, 60, 8, 8);
    ctx.fillStyle = hex(P.windowLight, 0.35);
    ctx.fillRect(66, 58, 12, 12);
  });

  // MID: a run of fence posts + wire, receding
  canvasTex(scene, K.fences, W, 26, (ctx) => {
    ctx.fillStyle = hex(aerial(0x1a2033, 0.22));
    for (let x = 6; x < W; x += 24) {
      ctx.fillRect(x, 6, 2, 18);
      ctx.fillRect(x - 1, 6, 4, 2);
    }
    ctx.fillStyle = hex(aerial(0x232b41, 0.22), 0.8);
    ctx.fillRect(0, 11, W, 1);
    ctx.fillRect(0, 17, W, 1);
  });

  /* 4. THE RECEDING GROUND PLANE — bands that compress toward the horizon.
   * Thin, hazy, desaturated bands at the top (far away) growing thicker and
   * greener toward the bottom (near the camera). This is what stops the field
   * reading as one flat slab of grass. */
  const GROUND_H = 58;
  canvasTex(scene, K.ground, W, GROUND_H, (ctx) => {
    const BANDS = 13;
    // band heights grow quadratically => the plane compresses toward the horizon
    const raw: number[] = [];
    let total = 0;
    for (let i = 0; i < BANDS; i++) {
      const h = 1 + (i / (BANDS - 1)) ** 2 * 12;
      raw.push(h);
      total += h;
    }
    let y = 0;
    for (let i = 0; i < BANDS; i++) {
      const t = i / (BANDS - 1);
      const h = Math.max(1, Math.round((raw[i] / total) * GROUND_H));
      const near = i % 2 === 0 ? P.grass : P.grassDark;
      const c = mix(aerial(P.grassDark, 0.62), aerial(near, (1 - t) * 0.5), t);
      // ALPHA ENVELOPE: transparent at the horizon, peaks mid, fades out at the
      // bottom so the plane dissolves into the real terrain — never a hard slab
      const env = Math.sin(Math.min(1, t * 1.08) * Math.PI) ** 0.7;
      const g = ctx.createLinearGradient(0, y, 0, y + h + 1);
      g.addColorStop(0, hex(c, 0.5 * env));
      g.addColorStop(1, hex(mix(c, P.grassLit, t * 0.3), 0.62 * env));
      ctx.fillStyle = g;
      ctx.fillRect(0, y, W, h + 1);
      // furrows — wrap-safe dashes on a period that divides the width
      if (t > 0.25) {
        ctx.fillStyle = hex(aerial(P.grassDark, 0.25), 0.3 * t * env);
        const step = 24;
        for (let x = (i * 7) % step; x < W; x += step) ctx.fillRect(x, y, Math.round(5 + t * 9), 1);
      }
      y += h;
    }
  });

  /* 3. FOREGROUND SILHOUETTES — near-black, the player passes BEHIND these. */
  canvasTex(scene, K.fgGrass, W, 40, (ctx) => {
    ctx.strokeStyle = 'rgba(3,5,11,0.94)';
    for (let i = 0; i < 170; i++) {
      const x = (i * 53) % W;
      const hgt = 14 + ((i * 29) % 24);
      const bend = ((i * 17) % 11) - 5;
      ctx.lineWidth = 1 + ((i * 7) % 2);
      for (const off of [-W, 0, W]) {
        ctx.beginPath();
        ctx.moveTo(x + off, 40);
        ctx.quadraticCurveTo(x + off + bend * 0.5, 40 - hgt * 0.6, x + off + bend, 40 - hgt);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(3,5,11,0.96)';
    ctx.fillRect(0, 36, W, 4);
  });

  // Taller, NARROWER fronds. Wide blobs here just read as blurry mud smeared
  // across the play area rather than as grass the player is standing behind.
  canvasTex(scene, K.fgWeeds, W, 72, (ctx) => {
    ctx.strokeStyle = 'rgba(2,3,8,0.97)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 64; i++) {
      const x = (i * 97) % W;
      const hgt = 30 + ((i * 43) % 40);
      const bend = ((i * 23) % 19) - 9;
      ctx.lineWidth = 2 + ((i * 5) % 3);
      for (const off of [-W, 0, W]) {
        ctx.beginPath();
        ctx.moveTo(x + off, 72);
        ctx.quadraticCurveTo(x + off + bend * 0.4, 72 - hgt * 0.62, x + off + bend, 72 - hgt);
        ctx.stroke();
      }
    }
  });
}

/* ================================ the rig ================================== */

interface DepthLayer {
  obj: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image;
  /** horizontal scroll rate */
  rate: number;
  /** Images (the farm) slide horizontally; TileSprites scroll their tilePosition.
   *  A pinned Image (the sky) must do neither — hence the explicit x anchor. */
  baseX: number;
  slides: boolean;
  /** vertical camera-parallax factor (0 = pinned to the view) */
  vRate: number;
  baseY: number;
  /** self-drift speed (clouds/haze), px/sec */
  drift: number;
}

interface TrackedLight {
  img: Phaser.GameObjects.Image;
  src: { x: number; y: number; active?: boolean };
  offY: number;
}

/**
 * The live treatment attached to one scene. `createVisualFX` returns `undefined`
 * when the toggle is off, so callers use `this.vfx?.update(dt)` and the scene
 * falls back to its original look with zero other changes.
 */
export class VisualFXRig {
  private scene: Phaser.Scene;
  private quality: Quality;
  private def: LevelDef;

  private layers: DepthLayer[] = [];
  private grain?: Phaser.GameObjects.TileSprite;
  private trackedLights: TrackedLight[] = [];

  /** ground top (px) per tile column — precomputed, drives contact shadows */
  private groundY: Int16Array;

  /** pre-allocated shadow pool (player + drones + boss) */
  private shadowPool: Phaser.GameObjects.Image[] = [];
  private playerShadow?: Phaser.GameObjects.Image;
  private playerLight?: Phaser.GameObjects.Image;
  private player?: { x: number; y: number; active: boolean };
  private droneGroup?: Phaser.Physics.Arcade.Group;
  private dronePool: Array<{ shadow: Phaser.GameObjects.Image; light: Phaser.GameObjects.Image }> = [];

  private drift = 0;
  private refScrollY = 0;
  private unsub?: () => void;

  constructor(scene: Phaser.Scene, def: LevelDef) {
    this.scene = scene;
    this.def = def;
    this.quality = vfxQuality(scene);

    ensureTextures(scene);

    this.groundY = new Int16Array(def.cols);
    for (let c = 0; c < def.cols; c++) {
      const y = surfaceYAt(def, c);
      this.groundY[c] = y === null ? -1 : Math.round(y);
    }

    this.buildDepthStack();
    this.buildGroundPlane();
    this.buildForeground();
    this.buildLighting();
    this.applyCameraFX();

    // The player's screen filter resets the camera's post pipelines, which would
    // wipe our grade. We subscribe AFTER ScreenFilter did, so we re-apply last.
    this.unsub = bus.on(EVT.settingsChanged, (d) => {
      if ((d as { key?: string }).key === 'filter') this.applyCameraFX();
    });
  }

  /* ------------------------ 3 + 4: depth + perspective ---------------------- */

  private addLayer(
    obj: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image,
    depth: number,
    rate: number,
    vRate: number,
    drift = 0,
  ): DepthLayer {
    obj.setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
    const layer: DepthLayer = { obj, rate, baseX: obj.x, slides: false, vRate, baseY: obj.y, drift };
    this.layers.push(layer);
    return layer;
  }

  /** progressive DOF — the further back, the blurrier. High quality only. */
  private blur(obj: Phaser.GameObjects.GameObject & { postFX?: Phaser.GameObjects.Components.FX }, strength: number): void {
    if (this.quality !== 'high' || !obj.postFX) return;
    // quality 0 = the cheap 5-tap kernel; 2 steps is plenty at 480×270
    obj.postFX.addBlur(0, 2, 2, strength, 0xffffff, 2);
  }

  private buildDepthStack(): void {
    const s = this.scene;
    // The play surface sits around screen y≈152 for most of Miller Field, and the
    // shipped ridge stack tops out at VIEW_H-128. Everything below is anchored to
    // that line so the mid-ground reads ABOVE the grass instead of behind it.
    const horizon = VIEW_H - 128;

    // L0 — the graded sky (sits over the shipped flat sky, same footprint)
    this.addLayer(s.add.image(0, 0, K.sky), D.sky, 0, 0.04);

    // L1/L2 — two EXTRA ridges further back than anything shipped. Sat high so
    // their silhouettes crest above the shipped hills instead of hiding behind.
    const r0 = s.add.tileSprite(0, horizon - 34, VIEW_W, 72, K.ridge0).setAlpha(0.85);
    this.blur(r0, VISUAL_FX.depth.blurFar);
    this.addLayer(r0, D.layer[0], 0.06, 0.05);

    const r1 = s.add.tileSprite(0, horizon - 22, VIEW_W, 78, K.ridge1).setAlpha(0.9);
    this.blur(r1, VISUAL_FX.depth.blurFar * 0.6);
    this.addLayer(r1, D.layer[1], 0.11, 0.08);

    // L3 — treeline: the new MID-ground, in FRONT of every shipped ridge
    const tl = s.add.tileSprite(0, horizon - 30, VIEW_W, 64, K.treeline).setAlpha(0.95);
    this.blur(tl, VISUAL_FX.depth.blurMid);
    this.addLayer(tl, D.layer[2], 0.26, 0.16);

    // L4 — the farm: the zone's mid-ground landmark, standing ON the horizon line
    const farm = s.add.image(VIEW_W * 0.32, horizon + 8, K.farm).setOrigin(0.5, 1).setScale(0.62);
    farm.setScrollFactor(0).setDepth(D.layer[3]);
    this.layers.push({ obj: farm, rate: 0.38, baseX: farm.x, slides: true, vRate: 0.22, baseY: farm.y, drift: 0 });
    // ...and the warm light spilling out of its window
    this.staticLight(farm.x + 4, horizon - 8, VISUAL_FX.light.windowColor, 1.5, 0.36, D.layer[3] + 0.05, 0.38);

    // L5 — fence run, closest background element
    const fen = s.add.tileSprite(0, horizon - 10, VIEW_W, 26, K.fences).setAlpha(0.85);
    this.addLayer(fen, D.layer[4], 0.56, 0.3);
  }

  /** 4. the ground plane — compressed bands receding to the horizon */
  private buildGroundPlane(): void {
    const g = this.scene.add
      .tileSprite(0, VIEW_H - 134, VIEW_W, 58, K.ground)
      .setAlpha(0.62);
    this.addLayer(g, D.ground, 0.72, VISUAL_FX.depth.verticalParallax);
  }

  /** 3. two dark silhouette layers scrolling FASTER than the play layer */
  private buildForeground(): void {
    const s = this.scene;
    // Kept LOW in frame — a bottom-edge frame, not a band across the play area.
    const weeds = s.add.tileSprite(0, VIEW_H - 46, VIEW_W, 72, K.fgWeeds).setAlpha(0.85);
    this.blur(weeds, VISUAL_FX.depth.blurNear);
    this.addLayer(weeds, D.foreground, 1.26, 0.62);

    const grass = s.add.tileSprite(0, VIEW_H - 22, VIEW_W, 40, K.fgGrass).setAlpha(0.94);
    this.blur(grass, VISUAL_FX.depth.blurNear * 1.3);
    this.addLayer(grass, D.foreground + 0.5, 1.55, 0.78);
  }

  /* ----------------------------- 2: lighting -------------------------------- */

  private staticLight(
    x: number,
    y: number,
    color: number,
    scale: number,
    alpha: number,
    depth: number,
    scrollFactor: number,
  ): Phaser.GameObjects.Image {
    const img = this.scene.add
      .image(x, y, K.light)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(scale)
      .setAlpha(alpha)
      .setDepth(depth)
      .setScrollFactor(scrollFactor);
    return img;
  }

  private buildLighting(): void {
    const s = this.scene;
    const L = VISUAL_FX.light;

    // ambient darkness the lights punch holes in (MULTIPLY: colour = multiplier)
    s.add
      .image(0, 0, K.ambient)
      .setOrigin(0, 0)
      .setDisplaySize(VIEW_W, VIEW_H)
      .setScrollFactor(0)
      .setDepth(D.ambient)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setAlpha(L.ambient);

    // COOL moonlight, fixed near the moon, spilling down the sky
    this.staticLight(70, 46, L.moonColor, 5.5, 0.2, D.lights, 0.03);
    // a wide cool wash across the horizon (the light the field is actually lit by)
    this.staticLight(VIEW_W * 0.3, VIEW_H - 96, L.moonColor, 7, 0.09, D.lights, 0.06);

    // player light + contact shadow (created once, moved every frame)
    this.playerLight = this.staticLight(0, 0, L.playerColor, 1.5, 0.3, D.lights, 1).setVisible(false);
    this.playerShadow = this.mkShadow();

    // pooled drone shadow + eye light (fixed pool ⇒ no per-frame allocation)
    for (let i = 0; i < 8; i++) {
      this.dronePool.push({
        shadow: this.mkShadow(),
        light: this.staticLight(0, 0, L.droneColor, 0.9, 0.34, D.lights, 1).setVisible(false),
      });
    }

    // baked shadows under the static props that sit ON the ground plane
    this.bakePropShadows();
  }

  private mkShadow(): Phaser.GameObjects.Image {
    const img = this.scene.add
      .image(0, 0, K.shadow)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(D.shadow)
      .setVisible(false);
    this.shadowPool.push(img);
    return img;
  }

  /** every fence / tower / node / door tile gets a soft grounded shadow so the
   *  props read as standing ON the plane instead of stickered onto it */
  private bakePropShadows(): void {
    const def = this.def;
    for (let c = 0; c < def.cols; c++) {
      for (let r = 0; r < def.rowCount; r++) {
        const ch = cellAt(def, c, r);
        if (ch !== 'f' && ch !== 't' && ch !== 'n' && ch !== 'g' && ch !== 's' && ch !== 'x') continue;
        const gy = this.groundY[c];
        if (gy < 0) continue;
        const wide = ch === 't' ? 1.1 : ch === 'g' ? 0.9 : 0.5;
        this.scene.add
          .image(c * TILE + TILE / 2 + 3, gy + 1, K.shadow)
          .setBlendMode(Phaser.BlendModes.MULTIPLY)
          .setDepth(D.shadow - 0.5)
          .setScale(wide, 0.28)
          .setAlpha(0.4);
      }
    }
  }

  /* --------------------------- 1: post-processing --------------------------- */

  private applyCameraFX(): void {
    const cam = this.scene.cameras.main;
    if (!cam || !cam.postFX) return;
    const C = VISUAL_FX.post;

    if (C.bloom) {
      cam.postFX.addBloom(
        0xffffff,
        1,
        1,
        C.bloomBlur,
        C.bloomStrength,
        this.quality === 'high' ? C.bloomStepsHigh : C.bloomStepsLow,
      );
    }

    if (C.grade) {
      const cm = cam.postFX.addColorMatrix();
      // cinematic night split-tone: warm the highlights (R gain), cool the
      // shadows (blue offset lifts the black point toward indigo)
      cm.set([
        1.07, 0.0, 0.0, 0, 0.0,
        0.0, 1.0, 0.02, 0, 0.0,
        0.02, 0.03, 1.05, 0, 0.022,
        0, 0, 0, 1, 0,
      ]);
      cm.saturate(C.saturation, true);
      cm.contrast(C.contrast, true);
      cm.brightness(1 + C.lift, true);
    }

    if (C.vignette) {
      cam.postFX.addVignette(0.5, 0.5, C.vignetteRadius, C.vignetteStrength);
    }

    // grain: one drifting tile, not a shader — cheapest possible film texture
    if (C.grain && this.quality === 'high' && !this.grain) {
      this.grain = this.scene.add
        .tileSprite(0, 0, VIEW_W, VIEW_H, K.grain)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(D.grain)
        .setBlendMode(Phaser.BlendModes.SCREEN)
        .setAlpha(C.grainAlpha);
    }
  }

  /* ------------------------------- wiring ----------------------------------- */

  /** Hand the rig the player + the live drone group so it can light + ground them. */
  trackActors(player: { x: number; y: number; active: boolean }, drones: Phaser.Physics.Arcade.Group): void {
    this.player = player;
    this.droneGroup = drones;
  }

  /** Attach an additive light that follows a moving object (portal, gate, boss…). */
  trackLight(
    src: { x: number; y: number; active?: boolean },
    color: number,
    scale = 1.4,
    alpha = 0.3,
    offY = 0,
  ): void {
    this.trackedLights.push({
      img: this.staticLight(src.x, src.y + offY, color, scale, alpha, D.lights, 1),
      src,
      offY,
    });
  }

  /* -------------------------------- per frame -------------------------------- */

  update(dtSec: number): void {
    const cam = this.scene.cameras.main;
    const sx = cam.scrollX;
    const sy = cam.scrollY;
    if (this.refScrollY === 0) this.refScrollY = sy;
    this.drift += dtSec * 3;

    // 3 + 4: horizontal parallax + VERTICAL camera parallax (the "angle")
    const dy = (sy - this.refScrollY) * VISUAL_FX.depth.verticalParallax;
    for (const l of this.layers) {
      const o = l.obj;
      if ('tilePositionX' in o) o.tilePositionX = sx * l.rate + l.drift * this.drift;
      else if (l.slides) o.x = l.baseX - sx * l.rate * 0.35;
      o.y = l.baseY - dy * l.vRate;
    }

    if (this.grain) {
      // jitter on a coarse grid so the grain shimmers without swimming
      this.grain.tilePositionX = (this.grain.tilePositionX + 17) % 64;
      this.grain.tilePositionY = (this.grain.tilePositionY + 11) % 64;
    }

    // 2: contact shadows + moving lights
    if (this.player && this.playerShadow && this.playerLight) {
      this.placeShadow(this.playerShadow, this.player.x, this.player.y, this.player.active, 0.85);
      this.playerLight.setVisible(this.player.active).setPosition(this.player.x, this.player.y);
    }

    if (this.droneGroup) {
      const kids = this.droneGroup.getChildren();
      for (let i = 0; i < this.dronePool.length; i++) {
        const slot = this.dronePool[i];
        const d = kids[i] as (Phaser.GameObjects.Sprite | undefined);
        if (!d || !d.active) {
          slot.shadow.setVisible(false);
          slot.light.setVisible(false);
          continue;
        }
        this.placeShadow(slot.shadow, d.x, d.y, true, 0.6);
        slot.light.setVisible(true).setPosition(d.x, d.y);
      }
    }

    for (const t of this.trackedLights) {
      t.img.setPosition(t.src.x, t.src.y + t.offY);
      if (t.src.active !== undefined) t.img.setVisible(t.src.active);
    }
  }

  /** Drop a shadow onto the terrain below (x, y), fading + shrinking with height. */
  private placeShadow(
    img: Phaser.GameObjects.Image,
    x: number,
    y: number,
    active: boolean,
    size: number,
  ): void {
    if (!active) {
      img.setVisible(false);
      return;
    }
    const col = (x / TILE) | 0;
    const gy = col >= 0 && col < this.groundY.length ? this.groundY[col] : -1;
    if (gy < 0 || gy < y - 4) {
      img.setVisible(false); // nothing underneath (a pit) — no shadow to cast
      return;
    }
    const h = gy - y;
    const t = 1 - Math.min(1, h / VISUAL_FX.light.shadowFadeHeight);
    if (t <= 0.02) {
      img.setVisible(false);
      return;
    }
    img
      .setVisible(true)
      .setPosition(x + h * 0.06, gy + 1)
      .setScale(size * (0.55 + t * 0.5), size * (0.16 + t * 0.14))
      .setAlpha(VISUAL_FX.light.shadowAlpha * t);
  }

  destroy(): void {
    this.unsub?.();
    this.unsub = undefined;
    this.layers.length = 0;
    this.trackedLights.length = 0;
    this.shadowPool.length = 0;
    this.dronePool.length = 0;
    this.grain = undefined;
    this.player = undefined;
    this.droneGroup = undefined;
  }
}

/**
 * Build the treatment for a scene, or return `undefined` when it's switched off
 * (or under the Canvas fallback). Callers use `this.vfx?.…` throughout, so the
 * disabled path is byte-for-byte the original render.
 */
export function createVisualFX(scene: Phaser.Scene, def: LevelDef): VisualFXRig | undefined {
  if (!vfxEnabled(scene)) return undefined;
  return new VisualFXRig(scene, def);
}
