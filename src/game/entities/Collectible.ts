/**
 * Floating pickups: Will's scout badge, Signal Fragments, and Will's cyan
 * route markers (non-collectible, reveal-only). Hidden variants stay
 * invisible until a scan pulse finds them.
 */
import Phaser from 'phaser';
import { TEX } from '../config';

export type CollectibleKind =
  | 'badge-will'
  | 'badge-chip'
  | 'badge-henry'
  | 'badge-cameron'
  | 'badge-danny'
  | 'fragment'
  | 'route-marker'
  | 'relic-will'
  | 'relic-chip'
  | 'relic-henry'
  | 'relic-cameron'
  | 'relic-danny'
  | 'field-note'
  | 'cache';

const TEXTURE: Record<CollectibleKind, string> = {
  'badge-will': TEX.badgeWill,
  'badge-chip': TEX.badgeChip,
  'badge-henry': TEX.badgeHenry,
  'badge-cameron': TEX.badgeCameron,
  'badge-danny': TEX.badgeDanny,
  fragment: TEX.fragment,
  'route-marker': TEX.routeMarker,
  'relic-will': TEX.relicWill,
  'relic-chip': TEX.relicChip,
  'relic-henry': TEX.relicHenry,
  'relic-cameron': TEX.relicCameron,
  'relic-danny': TEX.relicDanny,
  'field-note': TEX.fieldNote,
  cache: TEX.lockerCache,
};

export class Collectible extends Phaser.Physics.Arcade.Sprite {
  readonly kind: CollectibleKind;
  revealed: boolean;
  collected = false;
  private glowImg: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: CollectibleKind, hiddenUntilScan: boolean, tint?: number) {
    super(scene, x, y, TEXTURE[kind]);
    this.kind = kind;
    this.revealed = !hiddenUntilScan;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(14, 14);
    this.setDepth(16);
    this.glowImg = scene.add
      .image(x, y, TEX.glow8)
      .setScale(2.4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(15)
      .setTint(tint ?? 0xffffff);
    if (tint !== undefined && kind === 'route-marker') this.setTint(tint);

    if (hiddenUntilScan) {
      this.setAlpha(0);
      this.glowImg.setAlpha(0);
      body.enable = false;
    } else {
      this.glowImg.setAlpha(0.5);
    }

    // float bob
    scene.tweens.add({
      targets: [this, this.glowImg],
      y: y - 3,
      duration: 900 + Math.random() * 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private magnetActive = false;

  /** short-range magnet: the pickup dives toward the player */
  magnetTo(x: number, y: number, dtSec: number, speed = 190): void {
    if (this.collected) return;
    if (!this.magnetActive) {
      this.magnetActive = true;
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.killTweensOf(this.glowImg);
    }
    const dx = x - this.x;
    const dy = y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = Math.min(speed * dtSec, d);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    this.glowImg.setPosition(this.x, this.y);
  }

  reveal(delayMs = 0): void {
    if (this.revealed) return;
    this.revealed = true;
    this.scene.time.delayedCall(delayMs, () => {
      if (!this.active) return;
      if (this.kind !== 'route-marker') (this.body as Phaser.Physics.Arcade.Body).enable = true;
      this.scene.tweens.add({ targets: this, alpha: 1, duration: 300 });
      this.scene.tweens.add({ targets: this.glowImg, alpha: 0.55, duration: 300 });
    });
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.scene.tweens.add({
      targets: [this, this.glowImg],
      y: this.y - 14,
      alpha: 0,
      scale: 1.6,
      duration: 350,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.glowImg.destroy();
        this.destroy();
      },
    });
  }

  destroy(fromScene?: boolean): void {
    this.glowImg?.destroy();
    super.destroy(fromScene);
  }
}
