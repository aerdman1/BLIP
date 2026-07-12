/**
 * Phaser game factory — 480×270 virtual pixel canvas, scaled to fit,
 * WebGL with automatic Canvas fallback (Phaser.AUTO).
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PLAYER } from './config';
import { ComicFX } from './systems/ComicFX';
import { GradeFX } from './systems/GradeFX';
import { RetroFX } from './systems/RetroFX';
import { HalftoneFX } from './systems/HalftoneFX';
import { SignalFX } from './systems/SignalFX';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { FieldScene } from './scenes/FieldScene';
import { MotelScene } from './scenes/MotelScene';
import { StadiumScene } from './scenes/StadiumScene';
import { UnderwaterScene } from './scenes/UnderwaterScene';
import { OrchardScene } from './scenes/OrchardScene';
import { SkylineArrayScene } from './scenes/SkylineArrayScene';
import { EndingScene } from './scenes/EndingScene';
import { BlipstreamScene } from './scenes/BlipstreamScene';
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
        gravity: { x: 0, y: PLAYER.gravity },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MainMenuScene, FieldScene, MotelScene, StadiumScene, UnderwaterScene, OrchardScene, SkylineArrayScene, BlipstreamScene, SweepScene, UIScene, GameOverScene, EndingScene],
  });
}
