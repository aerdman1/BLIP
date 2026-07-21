/**
 * TopDownShadows — ground contact shadows for the Sweep.
 *
 * Static geometry gets its shadow BAKED into the ground RenderTexture at map
 * build (see topdown/GroundBake) — long, directional, zero runtime cost, and
 * the main source of the "real shadows" impression. This module handles only
 * the DYNAMIC casters: player, drones, pickups.
 *
 * Pooled and preallocated: update() only mutates x/y/scale/alpha.
 */
import Phaser from 'phaser';
import { TD_VISUALS, TEX } from '../config';
import { DEPTH } from './Depth';
import { shadowOffset, shadowShape } from './Oblique';

export interface ShadowCaster {
  x: number;
  y: number;
  active: boolean;
  /** footprint width in px */
  tdShadowW?: number;
  /** px of air under it (0 = on the ground) */
  tdLift?: number;
}

/** Soft radial blob, generated once. LINEAR so it never reads as a pixel disc. */
export function ensureShadowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.tdShadow)) return;
  const S = 64;
  const ct = scene.textures.createCanvas(TEX.tdShadow, S, S);
  if (!ct) return;
  const ctx = ct.context;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(4,10,16,0.85)');
  g.addColorStop(0.55, 'rgba(4,10,16,0.42)');
  g.addColorStop(1, 'rgba(4,10,16,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ct.refresh();
  scene.textures.get(TEX.tdShadow)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

export class TopDownShadows {
  private pool: Phaser.GameObjects.Image[] = [];
  private cap: number;

  constructor(scene: Phaser.Scene, cap = TD_VISUALS.maxDynamicShadows) {
    this.cap = cap;
    ensureShadowTexture(scene);
    for (let i = 0; i < cap; i++) {
      const img = scene.add
        .image(0, 0, TEX.tdShadow)
        .setDepth(DEPTH.shadow)
        .setVisible(false)
        .setActive(false);
      this.pool.push(img);
    }
  }

  /** Place shadows under every live caster. Call once per frame. */
  update(casters: ReadonlyArray<ShadowCaster>): void {
    let i = 0;
    for (const c of casters) {
      if (i >= this.cap) break;
      if (!c || !c.active) continue;
      const lift = c.tdLift ?? 0;
      const { sx, sy, alpha } = shadowShape(c.tdShadowW ?? 26, lift);
      const { dx, dy } = shadowOffset(lift);
      const img = this.pool[i++];
      img.setVisible(true).setActive(true);
      img.setPosition(c.x + dx, c.y + dy);
      img.setScale(sx, sy);
      img.setAlpha(alpha);
    }
    for (; i < this.cap; i++) {
      const img = this.pool[i];
      if (img.visible) img.setVisible(false).setActive(false);
    }
  }

  destroy(): void {
    this.pool.forEach((p) => p.destroy());
    this.pool = [];
  }
}
