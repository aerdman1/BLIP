/**
 * A platform the Interpretation Engine never mapped — invisible and
 * intangible until a scan pulse reveals it. Badge-path variants glow in
 * Will's cyan; ordinary ones in signal green-cyan.
 */
import Phaser from 'phaser';
import { PALETTE as P, TEX } from '../config';

export class HiddenPlatform extends Phaser.Physics.Arcade.Image {
  revealed = false;
  readonly isBadgePath: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, isBadgePath: boolean) {
    super(scene, x, y, TEX.tileHidden);
    this.isBadgePath = isBadgePath;
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static
    this.setAlpha(0);
    this.setTint(isBadgePath ? P.scoutWill : P.signal);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(16, 10);
    body.setOffset(0, 0);
    body.enable = false;
  }

  reveal(delayMs = 0): void {
    if (this.revealed) return;
    this.revealed = true;
    this.scene.time.delayedCall(delayMs, () => {
      if (!this.active) return;
      (this.body as Phaser.Physics.Arcade.StaticBody).enable = true;
      this.scene.tweens.add({ targets: this, alpha: 0.92, duration: 260, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({
        targets: this,
        alpha: { from: 0.92, to: 0.75 },
        delay: 300,
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
    });
  }
}
