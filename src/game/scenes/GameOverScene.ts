/**
 * Connection lost. The Interpretation Engine files you under something
 * insulting and mundane; you re-establish and try again.
 */
import Phaser from 'phaser';
import { EVT, VIEW_H, VIEW_W, PAD, PALETTE as P, RENDER_ZOOM, SCENES, css } from '../config';
import { ZONE_ROUTES } from '../data/zones';
import { bus } from '../systems/EventBus';
import { audio } from '../systems/AudioSystem';
import { readPad } from '../systems/PadSim';
import { getSave } from '../systems/SaveSystem';

const FALSE_LABELS = ['SWAMP GAS', 'WEATHER BALLOON', 'THE PLANET VENUS', 'BIRDS, PROBABLY', 'LENS FLARE', 'A KITE'];

export class GameOverScene extends Phaser.Scene {
  private fromScene = '';

  constructor() {
    super(SCENES.gameOver);
  }

  init(data: { from?: string }): void {
    this.fromScene = data?.from ?? '';
  }

  create(): void {
    this.cameras.main.setZoom(RENDER_ZOOM).centerOn(VIEW_W / 2, VIEW_H / 2);
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x020308, 0.86);
    this.add
      .text(VIEW_W / 2, 92, 'CONNECTION LOST', {
        fontFamily: 'monospace',
        fontSize: '18px',
        fontStyle: 'bold',
        color: css(P.danger),
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setLetterSpacing(4);
    const label = FALSE_LABELS[Math.floor(Math.random() * FALSE_LABELS.length)];
    this.add
      .text(VIEW_W / 2, 118, `THE INTERPRETATION ENGINE ARCHIVED YOU AS:`, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: css(P.uiDim),
      })
      .setOrigin(0.5)
      .setResolution(2);
    this.add
      .text(VIEW_W / 2, 132, `“${label}”`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: css(P.warning),
      })
      .setOrigin(0.5)
      .setResolution(2);

    const retry = this.add
      .text(VIEW_W / 2, 168, 'RE-ESTABLISH CONTACT  [R / ENTER / Ⓐ]', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: css(P.cream),
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setInteractive({ useHandCursor: true });
    retry.on('pointerover', () => retry.setColor(css(P.signal)));
    retry.on('pointerout', () => retry.setColor(css(P.cream)));
    retry.on('pointerdown', () => this.retry());
    this.input.keyboard?.on('keydown-R', () => this.retry());
    this.input.keyboard?.on('keydown-ENTER', () => this.retry());

    bus.emit(EVT.sceneChanged, { scene: SCENES.gameOver, zone: 'Connection Lost' });
    audio.bossWarning();
  }

  update(): void {
    // gamepad retry: A / Cross or START
    const pad = readPad();
    const pressed = (i: number) => pad?.buttons[i] === true && this.prevPadButtons[i] !== true;
    if (pressed(PAD.jump) || pressed(PAD.start)) this.retry();
    this.prevPadButtons = pad ? { ...pad.buttons } : {};
  }

  private prevPadButtons: Record<number, boolean> = {};

  private retry(): void {
    // stop whatever gameplay was running and restart the CURRENT zone fresh —
    // quest + flags come back from the save file (route by save.currentZone so
    // dying in Motel Nowhere re-establishes there, not back in Miller Field).
    const zone = getSave().currentZone;
    // died in a top-down section? re-attempt that same section (arena id is still
    // in the registry) rather than dumping the player into the side-view zone.
    const target =
      this.fromScene === SCENES.sweep ? SCENES.sweep : (ZONE_ROUTES[zone]?.scene ?? SCENES.field);
    this.scene.stop(SCENES.blipstream);
    this.scene.stop(SCENES.sweep);
    this.scene.stop(SCENES.underwater);
    this.scene.stop(SCENES.field);
    this.scene.stop(SCENES.motel);
    this.scene.stop(SCENES.stadium);
    this.scene.stop(SCENES.orchard);
    this.scene.stop(SCENES.skyline);
    this.scene.stop(SCENES.ending);
    this.scene.stop(SCENES.ui);
    this.scene.start(target);
    this.scene.stop();
  }
}
