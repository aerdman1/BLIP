/**
 * TdLighting — night lighting for the Sweep, without Light2D.
 *
 * Light2D is the wrong tool here: it needs a normal map per texture (all our art
 * is procedural or photoscanned albedo), it is a per-GameObject pipeline that
 * fights tileSprites/Graphics/Text, and — decisively — IT CASTS NO SHADOWS. So
 * it costs a rewrite and does not deliver the thing we actually want.
 *
 * Instead, the approach VisualFX already proves in this codebase:
 *   one multiply-darkness layer over the arena, with additive radial lights
 *   punching holes in it.
 * Two draw calls plus one sprite per light, fully art-directable, and it
 * composes with the baked static shadows in TdTerrain.
 *
 * No bloom. Phaser's Bloom FX has no luminance threshold — it blurs the whole
 * frame and lifts the black point, greying out exactly the dark scene we want.
 * The halation you see comes from the additive pools instead.
 */
import Phaser from 'phaser';
import { TD_PALETTE as C, TD_VISUALS, TEX } from '../config';
import { DEPTH } from '../render/Depth';
import { tdQuality } from '../render/RenderScale';

/** Blend `b` into `a` by `t` (0..1), per channel. */
function mixToward(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const m = (x: number, y: number) => Math.round(x + (y - x) * t) & 0xff;
  return (m(ar, br) << 16) | (m(ag, bg) << 8) | m(ab, bb);
}

export interface LightHandle {
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity: number;
  /** followed target, if any */
  follow?: { x: number; y: number; active: boolean };
}

function ensureLightTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.tdLight)) return;
  const S = 128;
  const ct = scene.textures.createCanvas(TEX.tdLight, S, S);
  if (!ct) return;
  const ctx = ct.context;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // a soft, physically-plausible falloff — not a linear ramp, which reads as a disc
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.62)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ct.refresh();
  scene.textures.get(TEX.tdLight)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

function ensureFogTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.tdFog)) return;
  const S = 256;
  const ct = scene.textures.createCanvas(TEX.tdFog, S, S);
  if (!ct) return;
  const ctx = ct.context;
  ctx.clearRect(0, 0, S, S);
  for (let i = 0; i < 42; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 24 + Math.random() * 58;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(150,200,190,0.09)');
    g.addColorStop(1, 'rgba(150,200,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ct.refresh();
  scene.textures.get(TEX.tdFog)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

export class TdLighting {
  private darkness!: Phaser.GameObjects.Rectangle;
  private lights: Phaser.GameObjects.Image[] = [];
  private handles: LightHandle[] = [];
  private fog: Phaser.GameObjects.TileSprite[] = [];
  private cap: number;
  private t = 0;

  constructor(scene: Phaser.Scene, aw: number, ah: number) {
    const low = tdQuality() === 'low';
    this.cap = low ? TD_VISUALS.lightsLow : TD_VISUALS.lightsHigh;
    ensureLightTexture(scene);
    ensureFogTexture(scene);

    // 1 — the darkness. MULTIPLY over everything on the ground plane.
    //
    // Under MULTIPLY the FILL COLOUR is the transmission factor, not the amount
    // of darkness: white passes the scene through untouched, black kills it. So
    // the strength constant has to be baked into the colour rather than passed
    // as the alpha — Rectangle's 6th argument is *fill* alpha, which does not
    // attenuate a multiply and left the scene at ~3% brightness.
    const strength = low ? TD_VISUALS.darknessLow : TD_VISUALS.darkness;
    this.darkness = scene.add
      .rectangle(0, 0, aw, ah, mixToward(0xffffff, C.shadow, strength), 1)
      .setOrigin(0)
      .setDepth(DEPTH.lighting)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    // 2 — the light pool objects, pre-allocated. update() only mutates them.
    for (let i = 0; i < this.cap; i++) {
      this.lights.push(
        scene.add
          .image(0, 0, TEX.tdLight)
          .setDepth(DEPTH.lighting + 1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(false)
      );
    }

    // 2b — a faint cool ambient wash. The albedos are graded for night, so this
    // lifts the black point just enough to keep terrain readable where no light
    // pool reaches — the "ambient floor" the spec requires.
    scene.add
      .rectangle(0, 0, aw, ah, C.haze, TD_VISUALS.ambientFloor * 0.06)
      .setOrigin(0)
      .setDepth(DEPTH.lighting + 2)
      .setBlendMode(Phaser.BlendModes.ADD);

    // 3 — localized drifting fog. Sheets, not a full-screen wash.
    if (!low) {
      for (let i = 0; i < 2; i++) {
        this.fog.push(
          scene.add
            .tileSprite(0, 0, aw, ah, TEX.tdFog)
            .setOrigin(0)
            .setDepth(DEPTH.weather - 1 + i)
            .setAlpha(0.16 - i * 0.06)
            .setBlendMode(Phaser.BlendModes.ADD)
        );
      }
    }
  }

  /** Register a light. Returns the handle so callers can move/retune it live. */
  add(h: LightHandle): LightHandle {
    this.handles.push(h);
    return h;
  }

  update(dtSec: number): void {
    this.t += dtSec;
    let i = 0;
    for (const h of this.handles) {
      if (i >= this.cap) break;
      if (h.follow) {
        if (!h.follow.active) continue;
        h.x = h.follow.x;
        h.y = h.follow.y;
      }
      const img = this.lights[i++];
      img.setVisible(true);
      img.setPosition(h.x, h.y);
      img.setScale(h.radius / 64);
      img.setTint(h.color);
      // the ambient floor guarantees combat never drops below legibility
      img.setAlpha(Math.max(h.intensity, 0));
    }
    for (; i < this.cap; i++) if (this.lights[i].visible) this.lights[i].setVisible(false);

    for (let f = 0; f < this.fog.length; f++) {
      const sp = 5 + f * 7;
      this.fog[f].tilePositionX += dtSec * sp;
      this.fog[f].tilePositionY -= dtSec * sp * 0.35;
    }
  }

  /** Drop a light that is no longer needed (a dead drone, a spent flash). */
  remove(h: LightHandle): void {
    const i = this.handles.indexOf(h);
    if (i >= 0) this.handles.splice(i, 1);
  }

  destroy(): void {
    this.darkness.destroy();
    this.lights.forEach((l) => l.destroy());
    this.fog.forEach((f) => f.destroy());
    this.lights = [];
    this.fog = [];
    this.handles = [];
  }
}
