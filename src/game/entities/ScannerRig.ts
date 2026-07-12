/**
 * Fixed scanner rig — old government scan equipment on a tripod.
 * Its red cone sweeps a slow arc over the path below. Pure detection hazard.
 */
import Phaser from 'phaser';
import { SCANRIG, TEX } from '../config';
import { DetectionCone } from './DetectionCone';

export class ScannerRig {
  sprite: Phaser.GameObjects.Image;
  cone: DetectionCone;
  private baseAngleRad: number;
  private t = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, aimDegrees = 30) {
    this.sprite = scene.add.image(x, y, TEX.scannerRig).setDepth(12);
    this.baseAngleRad = Phaser.Math.DegToRad(aimDegrees);
    this.cone = new DetectionCone(scene, SCANRIG.coneLength, SCANRIG.coneHalfAngleDeg);
    this.cone.setApex(x + 7, y - 4);
  }

  update(dtSec: number, playerX: number, playerY: number): boolean {
    this.t += (dtSec * Math.PI * 2) / (SCANRIG.sweepPeriodMs / 1000);
    const sweep = Phaser.Math.DegToRad(SCANRIG.sweepDeg / 2) * Math.sin(this.t);
    this.cone.setAngle(this.baseAngleRad + sweep);
    return this.cone.update(playerX, playerY);
  }

  destroy(): void {
    this.sprite.destroy();
    this.cone.destroy();
  }
}
