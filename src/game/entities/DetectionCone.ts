/**
 * A red detection cone — the Interpretation Engine's opinion beam.
 * Pure math for containment (apex + direction + half-angle + length),
 * with a tinted translucent triangle sprite for the visual.
 */
import Phaser from 'phaser';
import { PALETTE as P, TEX } from '../config';

export class DetectionCone {
  private image: Phaser.GameObjects.Image;
  private lengthPx: number;
  private halfAngleRad: number;
  apexX = 0;
  apexY = 0;
  angleRad = 0;
  playerInside = false;

  constructor(scene: Phaser.Scene, lengthPx: number, halfAngleDeg: number, tint: number = P.danger) {
    this.lengthPx = lengthPx;
    this.halfAngleRad = Phaser.Math.DegToRad(halfAngleDeg);
    this.image = scene.add
      .image(0, 0, TEX.cone)
      .setOrigin(0, 0.5)
      .setTint(tint)
      .setAlpha(0.4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(15);
    // source texture: 96 long, spreads to 64 tall at the far end
    const spread = 2 * lengthPx * Math.tan(this.halfAngleRad);
    this.image.setScale(lengthPx / 96, spread / 64);
  }

  setApex(x: number, y: number): void {
    this.apexX = x;
    this.apexY = y;
    this.image.setPosition(x, y);
  }

  setAngle(rad: number): void {
    this.angleRad = rad;
    this.image.setRotation(rad);
  }

  contains(px: number, py: number): boolean {
    const dx = px - this.apexX;
    const dy = py - this.apexY;
    const dist = Math.hypot(dx, dy);
    if (dist > this.lengthPx || dist < 2) return false;
    const diff = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - this.angleRad);
    return Math.abs(diff) <= this.halfAngleRad;
  }

  private forcedUntil = 0;

  /** WILLOW recon ping — hold the cone bright for a moment so it's readable. */
  pulseVisible(ms: number): void {
    this.forcedUntil = this.image.scene.time.now + ms;
  }

  /** update visual intensity; returns whether the player is inside */
  update(playerX: number, playerY: number): boolean {
    this.playerInside = this.contains(playerX, playerY);
    const forced = this.image.scene.time.now < this.forcedUntil;
    this.image.setAlpha(this.playerInside ? 0.75 : forced ? 0.7 : 0.4);
    return this.playerInside;
  }

  setVisible(v: boolean): void {
    this.image.setVisible(v);
  }

  destroy(): void {
    this.image.destroy();
  }
}
