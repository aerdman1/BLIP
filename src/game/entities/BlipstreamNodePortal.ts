/**
 * Blipstream Node A — the entrance into the inside of the Signal.
 * Stand close and press E ("Enter the Blipstream").
 */
import Phaser from 'phaser';
import { PALETTE as P, TEX, css } from '../config';

export class BlipstreamNodePortal {
  sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private prompt: Phaser.GameObjects.Text;
  private x: number;
  private y: number;
  completed = false;

  private label: string;

  constructor(scene: Phaser.Scene, x: number, groundY: number, label = 'NODE A') {
    this.x = x;
    this.y = groundY - 18;
    this.label = label;
    this.sprite = scene.add.image(this.x, this.y, TEX.nodePortal).setDepth(12);
    this.glow = scene.add
      .image(this.x, this.y, TEX.glow8)
      .setScale(5)
      .setTint(P.signal)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.4)
      .setDepth(11);
    this.prompt = scene.add
      .text(this.x, this.y - 30, '[E] ENTER THE BLIPSTREAM', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: css(P.signal),
        backgroundColor: 'rgba(5,7,15,0.7)',
        padding: { x: 3, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(60)
      .setResolution(2)
      .setVisible(false);
    scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.4, to: 0.7 },
      scale: { from: 5, to: 5.8 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
  }

  /** node routed — portal calms down */
  setCompleted(): void {
    this.completed = true;
    this.sprite.setTint(P.signalGreen);
    this.glow.setTint(P.signalGreen).setAlpha(0.25);
    this.prompt.setText(`[${this.label} — ROUTED]`);
  }

  playerNear(px: number, py: number): boolean {
    const near = Math.abs(px - this.x) < 22 && Math.abs(py - this.y) < 34;
    this.prompt.setVisible(near && !this.completed);
    return near;
  }
}
