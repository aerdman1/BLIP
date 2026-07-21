/**
 * Phaser game factory — 480×270 virtual pixel canvas, scaled to fit,
 * WebGL with automatic Canvas fallback (Phaser.AUTO).
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { ComicFX } from './systems/ComicFX';
import { GradeFX } from './systems/GradeFX';
import { RetroFX } from './systems/RetroFX';
import { HalftoneFX } from './systems/HalftoneFX';
import { SignalFX } from './systems/SignalFX';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SweepScene } from './scenes/SweepScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';

export function createGame(parent: string | HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#071126',
    pixelArt: true,
    roundPixels: true,
    // registered globally; applied only to the MainMenu camera. Cast bridges
    // Phaser's PipelineConfig type (assumes a `(config)` ctor) vs. PostFX
    // pipelines' conventional `(game)` ctor.
    pipeline: { ComicFX, GradeFX, RetroFX, HalftoneFX, SignalFX } as unknown as Phaser.Types.Core.PipelineConfig,
    input: { gamepad: true, touch: true },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MainMenuScene, SweepScene, UIScene, GameOverScene],
  });
}
