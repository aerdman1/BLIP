/**
 * Shared horizontal camera lookahead — one implementation for every overworld
 * so the feel never drifts between zones. Eases a follow-offset toward the
 * facing direction so the view leads where CONTACT-47 is going (drops, enemies,
 * gaps visible before arrival) and relaxes to center when essentially idle.
 * Phaser tracks (target − followOffset), so a NEGATIVE x offset leads right.
 */
import Phaser from 'phaser';
import { CAM } from '../config';

/** Ease + apply the lookahead for one frame; returns the new smoothed offset
 *  (store it on the scene and pass it back next frame). `offsetY` lets a scene
 *  keep its own vertical framing (Miller Field looks down; Motel stays level). */
export function applyCameraLook(
  cam: Phaser.Cameras.Scene2D.Camera,
  prev: number,
  facing: number,
  vx: number,
  dtSec: number,
  offsetY: number = CAM.lookOffsetY
): number {
  const target = Math.abs(vx) > CAM.moveGate ? -facing * CAM.lookaheadX : 0;
  const t = 1 - Math.exp(-CAM.lookaheadEase * dtSec);
  const next = Phaser.Math.Linear(prev, target, t);
  cam.setFollowOffset(next, offsetY);
  return next;
}
