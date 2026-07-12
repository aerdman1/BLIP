/**
 * ScreenFilter — applies the player's chosen post-process "screen filter" to a
 * scene's main camera. Single source of truth for the filter-id -> pipeline map.
 *
 * The MENU uses full strength; LEVELS pass `gameplay: true`, which dials each
 * filter down to its FILTER_GAME_STRENGTH (heavy/unsafe filters become a light
 * overlay so play stays readable). WebGL only (no-ops under the Canvas fallback).
 */
import Phaser from 'phaser';
import { EVT, FILTER_GAME_STRENGTH } from '../config';
import { settings } from './Settings';
import { bus } from './EventBus';
import { ComicFX } from './ComicFX';
import { GradeFX } from './GradeFX';
import { RetroFX } from './RetroFX';
import { HalftoneFX } from './HalftoneFX';
import { SignalFX } from './SignalFX';

type FxClass = new (game: Phaser.Game) => Phaser.Renderer.WebGL.Pipelines.PostFXPipeline;

// filter id -> { pipeline class, preset }. 'none'/unknown has no entry (resets).
// Several ids share one parametric pipeline via its `preset` (the TLOU2 trick).
const FILTER_FX: Record<string, { fx: FxClass; preset: string }> = {
  comic: { fx: ComicFX, preset: 'comic' },
  sketch: { fx: ComicFX, preset: 'sketch' },
  crosshatch: { fx: ComicFX, preset: 'crosshatch' },
  noir: { fx: GradeFX, preset: 'noir' },
  sepia: { fx: GradeFX, preset: 'sepia' },
  moonlight: { fx: GradeFX, preset: 'moonlight' },
  dusk: { fx: GradeFX, preset: 'dusk' },
  cool: { fx: GradeFX, preset: 'cool' },
  vintage: { fx: GradeFX, preset: 'vintage' },
  negative: { fx: GradeFX, preset: 'negative' },
  gameboy: { fx: RetroFX, preset: 'gameboy' },
  dither: { fx: RetroFX, preset: 'dither' },
  lofi: { fx: RetroFX, preset: 'lofi' },
  crt: { fx: RetroFX, preset: 'crt' },
  halftone: { fx: HalftoneFX, preset: 'halftone' },
  popart: { fx: HalftoneFX, preset: 'popart' },
  nightvision: { fx: SignalFX, preset: 'nightvision' },
  thermal: { fx: SignalFX, preset: 'thermal' },
  hologram: { fx: SignalFX, preset: 'hologram' },
  interference: { fx: SignalFX, preset: 'interference' },
};

/** Apply (or clear) a screen filter on the scene's main camera. */
export function applyScreenFilter(scene: Phaser.Scene, id: string, gameplay: boolean): void {
  if (scene.game.renderer.type !== Phaser.WEBGL) return; // Canvas fallback: shaders unavailable
  const cam = scene.cameras.main;
  if (!cam) return;
  cam.resetPostPipeline();
  const e = FILTER_FX[id];
  if (!e) return; // 'none' or unknown -> camera stays reset
  cam.setPostPipeline(e.fx);
  const inst = cam.getPostPipeline(e.fx);
  const one = Array.isArray(inst) ? inst[0] : inst;
  if (one) {
    const p = one as unknown as { preset: string; strength: number };
    p.preset = e.preset;
    p.strength = gameplay ? (FILTER_GAME_STRENGTH[id] ?? 1) : 1;
  }
}

/** Title-screen intro: snap the NIGHT-VISION filter on at full strength, then
 *  slowly fade it out to the player's normal filter (usually none). WebGL only. */
export function nightVisionIntro(scene: Phaser.Scene, durationMs = 3200): void {
  if (scene.game.renderer.type !== Phaser.WEBGL) return;
  const cam = scene.cameras.main;
  if (!cam) return;
  cam.resetPostPipeline();
  cam.setPostPipeline(SignalFX);
  const inst = cam.getPostPipeline(SignalFX);
  const one = Array.isArray(inst) ? inst[0] : inst;
  if (!one) return;
  const p = one as unknown as { preset: string; strength: number };
  p.preset = 'nightvision';
  p.strength = 1;
  scene.tweens.add({
    targets: p,
    strength: 0,
    delay: 500, // hold on full night-vision for a beat, then fade
    duration: durationMs,
    ease: 'Sine.easeInOut',
    // land on whatever filter the player actually has set (normally 'none' → normal)
    onComplete: () => applyScreenFilter(scene, settings.get('filter'), false),
  });
}

/** Apply the current filter to a scene + keep it in sync with the setting.
 *  Auto-unsubscribes on scene shutdown. Menu passes gameplay=false (full). */
export function attachScreenFilter(scene: Phaser.Scene, gameplay: boolean): void {
  applyScreenFilter(scene, settings.get('filter'), gameplay);
  const off = bus.on(EVT.settingsChanged, (d) => {
    if ((d as { key?: string }).key === 'filter') applyScreenFilter(scene, settings.get('filter'), gameplay);
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
}
