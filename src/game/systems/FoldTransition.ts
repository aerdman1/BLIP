/**
 * THE FOLD — BLIP's signature perspective-shift transition. Phaser can't truly
 * rotate the camera, so the Fold is a stylized flash-masked collapse split across
 * two scenes: the OUTGOING scene plays `foldCollapse` (zoom-punch + signal flash +
 * static burst masking the swap) then starts the target; the INCOMING scene reads
 * the `foldIn` registry flag in create() and plays `foldSettle` (fade + un-zoom +
 * an "observation" scan ring). Fiction: the Interpretation Engine changes how it
 * observes you — side-on ⇄ its top-down scan.
 *
 * Reuses EffectsSystem (flash/staticBurst/shake/scanRing) + AudioSystem.transitionWarp.
 */
import Phaser from 'phaser';
import { PALETTE as P } from '../config';
import { audio } from './AudioSystem';
import type { EffectsSystem } from './EffectsSystem';

export const FOLD_FLAG = 'foldIn'; // registry key: set true before scene.start(target)

/** Outgoing half: collapse the current view, then fire `onMid` (do scene.start there). */
export function foldCollapse(scene: Phaser.Scene, fx: EffectsSystem, onMid: () => void): void {
  scene.input.enabled = false;
  audio.transitionWarp();
  fx.flash(P.signal, 180);
  fx.staticBurst(700);
  fx.shake(0.006, 260);
  const cam = scene.cameras.main;
  const z = cam.zoom;
  scene.tweens.add({ targets: cam, zoom: z * 1.3, duration: 300, ease: 'Quad.easeIn' });
  scene.time.delayedCall(300, () => fx.flash(P.white, 240));
  scene.time.delayedCall(440, onMid);
}

/** Incoming half: settle into the new view. Call from create() when registry FOLD_FLAG is set. */
export function foldSettle(scene: Phaser.Scene, fx: EffectsSystem): void {
  scene.registry.set(FOLD_FLAG, false);
  scene.input.enabled = true; // foldCollapse disabled the outgoing scene's input — restore
  const cam = scene.cameras.main;
  cam.fadeIn(380, 8, 10, 14);
  const z = cam.zoom;
  cam.setZoom(z * 1.18);
  scene.tweens.add({ targets: cam, zoom: z, duration: 460, ease: 'Quad.easeOut' });
  const cx = cam.midPoint?.x ?? cam.centerX;
  const cy = cam.midPoint?.y ?? cam.centerY;
  fx.scanRing(cx, cy, 220, 560, P.signal);
  audio.transitionWarp();
}

/** True if this scene was entered via a Fold (incoming should play foldSettle). */
export function enteredViaFold(scene: Phaser.Scene): boolean {
  return scene.registry.get(FOLD_FLAG) === true;
}
