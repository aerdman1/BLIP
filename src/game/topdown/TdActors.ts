/**
 * TdActors — HD presentation for the things that move, and for the Node.
 *
 * A RIG WRAPS AN EXISTING ENTITY; it never replaces one. BlipCraft and
 * SweepEnemy keep their bodies, hitboxes, speeds, AI, damage and animation
 * timing exactly as they are — the rig only swaps what you SEE:
 *
 *   - the body sprite, base-anchored so it stands on the ground plane;
 *   - an emissive layer (visor / eye / core) on ADD blend, so it can pulse
 *     independently of the body's tint and survive hit-flashes;
 *   - y-sorted depth from the entity's feet.
 *
 * Shadows are handled by render/TopDownShadows (one pooled pass for all
 * casters), and lights by TdLighting — a rig just declares what it needs.
 */
import Phaser from 'phaser';
import { TD_PALETTE as C, TD_VISUALS, TEX } from '../config';
import { airDepth, DEPTH, sortedDepth } from '../render/Depth';
import type { LightHandle, TdLighting } from './TdLighting';

export interface RiggedHost extends Phaser.GameObjects.Components.Transform {
  active: boolean;
}

export class ActorRig {
  private emis?: Phaser.GameObjects.Image;
  private light?: LightHandle;
  private pulseT = Math.random() * Math.PI * 2;

  constructor(
    scene: Phaser.Scene,
    private host: RiggedHost & Phaser.GameObjects.Sprite,
    opts: {
      body: string;
      emissive?: string;
      emissiveColor?: number;
      /** px of air under it — drones hover, the player does not */
      lift?: number;
      /** target on-screen height in px — overrides the generic art scale */
      px?: number;
      lighting?: TdLighting;
      lightRadius?: number;
      lightColor?: number;
      lightIntensity?: number;
      /** base/pulse alpha for the emissive layer (default 0.72/0.18 = player look).
       *  Enemies dial this down — full-tint ADD-blend was amplifying the emissive
       *  art's scattered rim-light flecks into a noisy "red halo" around each drone. */
      emissiveAlpha?: number;
      emissivePulse?: number;
    }
  ) {
    this.emissiveAlpha = opts.emissiveAlpha ?? 0.72;
    this.emissivePulse = opts.emissivePulse ?? 0.18;
    this.lift = opts.lift ?? 0;

    // Swap the texture ONLY. Origin stays centred: these are physics sprites and
    // re-anchoring them would drag their bodies off the hitbox. We get the
    // base-anchored *sorting* from `feet()` below instead, which is the part
    // that actually matters for occlusion.
    if (scene.textures.exists(opts.body)) {
      host.setTexture(opts.body);
      // Size from the DECLARED on-screen height. The family sprites are authored
      // large and at differing sizes, so one global scale cannot serve them all.
      const src = scene.textures.getFrame(opts.body);
      const s = opts.px && src?.height ? opts.px / src.height : TD_VISUALS.artScale;
      host.setScale(s);
    }

    if (opts.emissive && scene.textures.exists(opts.emissive)) {
      this.emis = scene.add
        .image(host.x, host.y, opts.emissive)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(opts.emissiveColor ?? 0xffffff);
    }

    if (opts.lighting && opts.lightRadius) {
      this.light = opts.lighting.add({
        x: host.x,
        y: host.y,
        radius: opts.lightRadius,
        color: opts.lightColor ?? C.signal,
        intensity: opts.lightIntensity ?? 0.5,
        follow: host,
      });
    }
    this.lighting = opts.lighting;
  }

  private lift = 0;
  private lighting?: TdLighting;
  private emissiveAlpha: number;
  private emissivePulse: number;

  /** Called every frame by the scene. Cheap: position, depth, one sin(). */
  update(dtSec: number): void {
    const h = this.host;
    if (!h.active) {
      this.emis?.setVisible(false);
      return;
    }
    // Sort by FEET, not centre — the whole point of y-sorting. Sprites are
    // centre-origin, so feet = y + half the display height.
    const feet = h.y + h.displayHeight * 0.5;
    h.setDepth(this.lift > 0 ? airDepth(feet, this.lift) : sortedDepth(feet));

    if (this.emis) {
      this.pulseT += dtSec * 3.1;
      this.emis
        .setVisible(true)
        .setPosition(h.x, h.y)
        .setFlipX(h.flipX)
        .setScale(h.scaleX, h.scaleY)
        .setDepth(h.depth + 1)
        .setAlpha(this.emissiveAlpha + Math.sin(this.pulseT) * this.emissivePulse);
    }
  }

  destroy(): void {
    this.emis?.destroy();
    if (this.light && this.lighting) this.lighting.remove(this.light);
  }
}

/**
 * SignalNodeRig — the hero prop and the arena's primary light source.
 *
 * Everything here is driven by charge fraction: core brightness, the height of
 * the vertical beacon shaft, the ground rings, and the light pool radius. At
 * full charge it blooms out and shifts green → cyan. The gameplay logic
 * (addNodeCharge, chargeTarget, openBreach) is untouched — this only reads it.
 */
export class SignalNodeRig {
  private core?: Phaser.GameObjects.Image;
  private emis?: Phaser.GameObjects.Image;
  private shaft!: Phaser.GameObjects.Rectangle;
  private rings: Phaser.GameObjects.Image[] = [];
  private light?: LightHandle;
  private t = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    lighting?: TdLighting
  ) {
    const hasHd = scene.textures.exists(TEX.tdNode);

    // ground rings, projected onto the terrain (squashed by the oblique factor).
    // Kept faint on purpose — the node's green additive glow was overpowering
    // the scene in every arena, so the rings, shaft and light pool below are all
    // dialled well down from their original values.
    for (let i = 0; i < 3; i++) {
      const r = scene.add
        .image(x, y, TEX.tdLight)
        .setDepth(DEPTH.decal + i)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(C.signal)
        .setAlpha(0.07 - i * 0.02);
      this.rings.push(r);
    }

    // the vertical beacon shaft — visible from anywhere as a navigation cue
    this.shaft = scene.add
      .rectangle(x, y, 3, 120, C.signal, 0.22)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.air)
      .setBlendMode(Phaser.BlendModes.ADD);

    if (hasHd) {
      const nf = scene.textures.getFrame(TEX.tdNode);
      const ns = nf?.height ? TD_VISUALS.actorPx.node / nf.height : TD_VISUALS.artScale;
      this.core = scene.add.image(x, y, TEX.tdNode).setOrigin(0.5, 1).setDepth(sortedDepth(y)).setScale(ns);
      if (scene.textures.exists(TEX.tdNodeEmis)) {
        this.emis = scene.add
          .image(x, y, TEX.tdNodeEmis)
          .setOrigin(0.5, 1)
          .setDepth(sortedDepth(y) + 1)
          .setScale(ns)
          .setBlendMode(Phaser.BlendModes.ADD);
      }
    }

    if (lighting) {
      this.light = lighting.add({ x, y, radius: 150, color: C.signal, intensity: 0.34 });
    }
  }

  /** `frac` is nodeCharge / chargeTarget, 0..1. */
  update(dtSec: number, frac: number): void {
    this.t += dtSec;
    const f = Phaser.Math.Clamp(frac, 0, 1);
    const breathe = 0.86 + Math.sin(this.t * 1.8) * 0.14;
    const hue = f >= 1 ? C.signalCore : C.signal;

    this.shaft
      .setDisplaySize(3 + f * 3, (90 + f * 130) * breathe)
      .setFillStyle(hue, (0.16 + f * 0.22) * breathe);

    for (let i = 0; i < this.rings.length; i++) {
      const phase = (this.t * 0.5 + i / this.rings.length) % 1;
      this.rings[i]
        .setScale((1.4 + phase * 2.6) * (1 + f * 0.5), (1.4 + phase * 2.6) * 0.55 * (1 + f * 0.5))
        .setTint(hue)
        .setAlpha((1 - phase) * (0.05 + f * 0.09));
    }

    // node body glow (emissive sprite) trimmed, and the light pool cut hard —
    // the node stays clearly the objective without washing the arena green.
    this.emis?.setTint(hue).setAlpha(0.42 + f * 0.3 * breathe);
    if (this.light) {
      this.light.radius = 150 + f * 90;
      this.light.color = hue;
      this.light.intensity = (0.3 + f * 0.22) * breathe;
    }
  }

  destroy(): void {
    this.core?.destroy();
    this.emis?.destroy();
    this.shaft.destroy();
    this.rings.forEach((r) => r.destroy());
  }
}
