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
  aimAngle?: number;
}

type Direction8 = 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest' | 'north' | 'northeast';

export class ActorRig {
  private emis?: Phaser.GameObjects.Image;
  private light?: LightHandle;
  private pulseT = Math.random() * Math.PI * 2;
  private bodyDirs?: Partial<Record<Direction8, string>>;
  private currentBody?: string;
  private targetPx?: number;
  private hoverFx?: {
    gfx: Phaser.GameObjects.Graphics;
    color: number;
  };

  constructor(
    scene: Phaser.Scene,
    private host: RiggedHost & Phaser.GameObjects.Sprite,
    opts: {
      body: string;
      bodyDirs?: Partial<Record<Direction8, string>>;
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
      hoverThrusters?: boolean;
      hoverColor?: number;
      /** Arcade physics hitbox size in world pixels. Visual sprites are scaled
       *  for HD presentation, so the body size must be inverse-scaled to keep
       *  collision honest in world space. */
      collisionPx?: { w: number; h: number };
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
    this.bodyDirs = opts.bodyDirs;
    this.targetPx = opts.px;
    this.collisionPx = opts.collisionPx;

    // Swap the texture ONLY. Origin stays centred: these are physics sprites and
    // re-anchoring them would drag their bodies off the hitbox. We get the
    // base-anchored *sorting* from `feet()` below instead, which is the part
    // that actually matters for occlusion.
    this.setBodyTexture(opts.body);

    if (opts.emissive && scene.textures.exists(opts.emissive)) {
      this.emis = scene.add
        .image(host.x, host.y, opts.emissive)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(opts.emissiveColor ?? 0xffffff);
    }

    if (opts.hoverThrusters) {
      const color = opts.hoverColor ?? C.rim;
      this.hoverFx = {
        gfx: scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD),
        color,
      };
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
  private collisionPx?: { w: number; h: number };

  private directionFromAngle(angle: number): Direction8 {
    const normalized = Phaser.Math.Angle.Wrap(angle);
    const index = Phaser.Math.Wrap(Math.round(normalized / (Math.PI / 4)), 0, 8);
    return (['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'] as const)[index];
  }

  private setBodyTexture(key?: string): void {
    if (!key || this.currentBody === key || !this.host.scene.textures.exists(key)) return;
    this.host.setTexture(key);
    this.currentBody = key;
    // Size from the DECLARED on-screen height. The family sprites are authored
    // large and at differing sizes, so one global scale cannot serve them all.
    const src = this.host.scene.textures.getFrame(key);
    const s = this.targetPx && src?.height ? this.targetPx / src.height : TD_VISUALS.artScale;
    this.host.setScale(s);
    this.applyCollisionSize();
  }

  private applyCollisionSize(): void {
    const body = (this.host as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body }).body;
    if (!body || !this.collisionPx) return;
    const sx = Math.max(0.001, Math.abs(this.host.scaleX));
    const sy = Math.max(0.001, Math.abs(this.host.scaleY));
    body.setSize(this.collisionPx.w / sx, this.collisionPx.h / sy, true);
  }

  /** Called every frame by the scene. Cheap: position, depth, one sin(). */
  update(dtSec: number): void {
    const h = this.host;
    if (!h.active) {
      this.emis?.setVisible(false);
      this.hoverFx?.gfx.clear().setVisible(false);
      return;
    }
    // Sort by FEET, not centre — the whole point of y-sorting. Sprites are
    // centre-origin, so feet = y + half the display height.
    if (this.bodyDirs && typeof h.aimAngle === 'number') {
      this.setBodyTexture(this.bodyDirs[this.directionFromAngle(h.aimAngle)]);
      h.setFlipX(false);
    }
    const feet = h.y + h.displayHeight * 0.5;
    h.setDepth(this.lift > 0 ? airDepth(feet, this.lift) : sortedDepth(feet));

    if (this.hoverFx) {
      const body = (h as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body }).body;
      const speed = body?.velocity ? body.velocity.length() : 0;
      const thrust = Phaser.Math.Clamp(speed / 165, 0, 1);
      const pulse = 0.5 + Math.sin(this.pulseT * 6.3) * 0.5;
      const feetY = h.y + h.displayHeight * 0.47;
      const footSpread = Math.max(5, h.displayWidth * 0.15);
      const flameLen = 8 + thrust * 11 + pulse * 3;
      const outerW = 4.5 + thrust * 2.4 + pulse;
      const innerW = 2.2 + thrust * 1.4;
      const alpha = 0.38 + thrust * 0.28 + pulse * 0.1;
      const vx = body?.velocity.x ?? 0;
      const vy = body?.velocity.y ?? 0;
      const aim = typeof h.aimAngle === 'number' ? h.aimAngle : Math.PI / 2;
      const faceX = Math.cos(aim);
      const sideFacing = Math.abs(faceX) > 0.62;
      const leanX = Phaser.Math.Clamp(-vx / 42 - faceX * 3.8, -8, 8);
      const leanY = Phaser.Math.Clamp(-vy / 80, -2, 4);
      const gfx = this.hoverFx.gfx.clear().setVisible(true).setDepth(h.depth - 0.25);

      gfx.fillStyle(this.hoverFx.color, 0.1 + thrust * 0.1);
      gfx.fillEllipse(h.x + leanX * 0.25, feetY + flameLen * 0.8, 24 + thrust * 10, 7 + thrust * 4);

      const plume = (x: number, skew: number, yOffset = 0, scale = 1): void => {
        const wOuter = outerW * scale;
        const wInner = innerW * scale;
        const len = flameLen * scale;
        const startY = feetY + yOffset - 3;
        const midY = feetY + yOffset + len * 0.45 + leanY;
        const tipY = feetY + yOffset + len + leanY;
        const waveA = Math.sin(this.pulseT * 8.4 + x * 0.13) * (1.1 + thrust);
        const waveB = Math.cos(this.pulseT * 7.1 + x * 0.09) * (0.9 + thrust * 0.8);
        const tipX = x + skew + leanX;
        gfx.fillStyle(0x1677ff, alpha * 0.58);
        gfx.fillPoints(
          [
            new Phaser.Geom.Point(x - wOuter, startY),
            new Phaser.Geom.Point(x + wOuter, startY + 0.5),
            new Phaser.Geom.Point(x + wOuter * 0.55 + waveA + leanX * 0.3, midY),
            new Phaser.Geom.Point(tipX + waveB, tipY),
            new Phaser.Geom.Point(x - wOuter * 0.5 + waveB + leanX * 0.2, midY + 1),
          ],
          true
        );
        gfx.fillStyle(this.hoverFx!.color, alpha);
        gfx.fillPoints(
          [
            new Phaser.Geom.Point(x - wInner, startY + 1.5),
            new Phaser.Geom.Point(x + wInner, startY + 2),
            new Phaser.Geom.Point(x + wInner * 0.45 + waveB * 0.35 + leanX * 0.25, midY - 1),
            new Phaser.Geom.Point(tipX * 0.35 + x * 0.65, tipY - 4),
            new Phaser.Geom.Point(x - wInner * 0.45 + waveA * 0.25 + leanX * 0.2, midY),
          ],
          true
        );
        gfx.lineStyle(1.2 * scale, 0xe7fbff, 0.3 + thrust * 0.18);
        gfx.lineBetween(x, startY + 2, x + leanX * 0.45 + skew * 0.3, tipY - 6);
        gfx.fillStyle(0xbff9ff, 0.28 + pulse * 0.14);
        gfx.fillCircle(tipX + waveB * 0.4, tipY - 2, (0.8 + thrust * 0.35) * scale);
      };

      if (sideFacing) {
        const side = Math.sign(faceX) || 1;
        plume(h.x - side * 1.5, -side * (1.6 + pulse * 0.7), -1, 0.95);
        plume(h.x - side * 6.5, -side * (2.4 - pulse * 0.4), 1.5, 0.58);
      } else {
        plume(h.x - footSpread, -1.2 + pulse * 0.9);
        plume(h.x + footSpread, 1.2 - pulse * 0.8);
      }
    }

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
    this.hoverFx?.gfx.destroy();
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
