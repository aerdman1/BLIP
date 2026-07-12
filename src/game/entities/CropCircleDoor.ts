/**
 * The crop-circle glyph door — seals the doorway through the hill.
 * Opens (glyph ignition + dissolve) when Blipstream Node A is routed.
 */
import Phaser from 'phaser';
import { PALETTE as P, TEX } from '../config';
import { audio } from '../systems/AudioSystem';
import type { EffectsSystem } from '../systems/EffectsSystem';

export class CropCircleDoor {
  sprite: Phaser.Physics.Arcade.Image;
  isOpen = false;
  private fx: EffectsSystem;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number, fx: EffectsSystem) {
    this.scene = scene;
    this.fx = fx;
    this.sprite = scene.physics.add.staticImage(x, y, TEX.doorGlyph).setDepth(11);
    // subtle idle shimmer on the glyph
    scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 1, to: 0.85 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
    });
  }

  /** silently set open (when restoring from save) */
  setOpenInstant(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    (this.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.sprite.setAlpha(0.18).setTint(P.signalGreen);
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    audio.doorUnlock();
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setTint(P.signal);
    this.fx.flash(P.signalGreen, 160);
    this.fx.sparks(this.sprite.x, this.sprite.y, P.signal, 18);
    this.fx.sparks(this.sprite.x, this.sprite.y - 14, P.signalGreen, 12);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.18,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        (this.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        this.sprite.setTint(P.signalGreen);
      },
    });
    // the body opens immediately so the player can walk through the light
    (this.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }
}
