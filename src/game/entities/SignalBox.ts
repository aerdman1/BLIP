/**
 * Chip's broken signal box — a homemade device with a tiny orange SPARK mark.
 * Scanning it logs a field note (Chip's trail starts here).
 */
import Phaser from 'phaser';
import { PALETTE as P, TEX } from '../config';

export class SignalBox {
  sprite: Phaser.GameObjects.Image;
  readonly x: number;
  readonly y: number;
  scanned = false;
  private sparkTween?: Phaser.Tweens.Tween;
  private spark: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.sprite = scene.add.image(x, y, TEX.signalBox).setDepth(12);
    this.spark = scene.add
      .image(x + 2, y - 2, TEX.glow8)
      .setTint(P.scoutChip)
      .setScale(1.4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.25)
      .setDepth(11);
    this.sparkTween = scene.tweens.add({
      targets: this.spark,
      alpha: { from: 0.15, to: 0.5 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
    });
  }

  markScanned(): void {
    this.scanned = true;
    this.sparkTween?.stop();
    // read clearly as "already scanned / logged": the box dims and the spark turns green
    this.sprite.setTint(0x7d8a7d);
    this.spark.setTint(P.signalGreen).setAlpha(0.32).setScale(1.4);
  }
}
