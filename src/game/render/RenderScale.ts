/**
 * RenderScale — scene-local high-resolution backbuffer.
 *
 * The game ships a 480×270 pixel-art canvas. The top-down Sweep needs real
 * resolution for HD art, so on entry it resizes the backbuffer to 480d × 270d
 * and multiplies the camera zoom by the SAME d — which means the VISIBLE WORLD
 * REGION IS UNCHANGED. No gameplay tuning (aimRange, scanRadius, follow lerp,
 * arena bounds) shifts; you simply get d² times the samples.
 *
 * DANGER — a leaked resize. If restoreBase() is missed on any exit path, the
 * next scene lays out 480-coordinate content inside a 1440×810 buffer and
 * renders tiny in the top-left. restoreBase() is therefore called from
 * SweepScene's SHUTDOWN (the one hook covering route transitions / death / quit)
 * AND defensively from Boot + MainMenu.
 */
import Phaser from 'phaser';
import { TD_VISUALS, VIEW_H, VIEW_W } from '../config';

const KEY = 'renderDensity';

/** Density this device should use. Touch GPUs get less. */
export function targetDensity(): number {
  const coarse =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  return coarse ? TD_VISUALS.density.touch : TD_VISUALS.density.desktop;
}

/** Current density (1 = the shipped 480×270 buffer). */
export function density(scene: Phaser.Scene): number {
  return (scene.registry.get(KEY) as number) ?? 1;
}

/** Quality tier, mirroring VISUAL_FX.quality's 'auto ⇒ low on touch' rule. */
export function tdQuality(): 'high' | 'low' {
  if (TD_VISUALS.quality !== 'auto') return TD_VISUALS.quality;
  const coarse =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  return coarse ? 'low' : 'high';
}

/**
 * Raise the backbuffer. MUST be called synchronously from create() — never from
 * a delayedCall, or an iOS rotation refit can interleave with the resize.
 */
export function enterHiRes(scene: Phaser.Scene, d = targetDensity()): number {
  if (d <= 1) return 1;
  scene.registry.set(KEY, d);
  scene.scale.resize(VIEW_W * d, VIEW_H * d);
  document.body.classList.add('td-hires');
  return d;
}

/** Restore the shipped 480×270 buffer. Safe to call when already restored. */
export function restoreBase(scene: Phaser.Scene): void {
  if (density(scene) === 1 && scene.scale.width === VIEW_W) return;
  scene.registry.set(KEY, 1);
  scene.scale.resize(VIEW_W, VIEW_H);
  document.body.classList.remove('td-hires');
}

/**
 * Give a texture LINEAR filtering so it upscales smoothly instead of blocky.
 * `pixelArt: true` only sets the DEFAULT filter; this overrides per texture.
 *
 * ONLY EVER call this on `td-*` keys. Shared procedural keys stay pixel-filtered.
 */
export function linearTd(scene: Phaser.Scene, key: string): void {
  if (!key.startsWith('td-')) {
    if (import.meta.env?.DEV) console.warn(`[RenderScale] refusing LINEAR on shared key "${key}"`);
    return;
  }
  scene.textures.get(key)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Apply LINEAR to every loaded td-* texture. Called once after the atlas loads. */
export function linearAllTd(scene: Phaser.Scene): void {
  for (const key of scene.textures.getTextureKeys()) {
    if (key.startsWith('td-')) linearTd(scene, key);
  }
}
