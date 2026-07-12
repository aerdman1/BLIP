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
    this.fromScene = data?.from ?? (this.registry.get('gameOverRetryScene') as string) ?? '';
    if (data?.from) this.registry.set('gameOverRetryScene', data.from);
  }

  create(): void {
    this.cameras.main.setZoom(RENDER_ZOOM).centerOn(VIEW_W / 2, VIEW_H / 2);
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x020308, 0.92);
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, 360, 160, 0x090d16, 0.94).setStrokeStyle(2, P.warning, 0.72);
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, 342, 142, 0x05080f, 0).setStrokeStyle(1, P.signal, 0.24);
    this.add
      .text(VIEW_W / 2, 58, 'CONNECTION LOST', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: css(P.danger),
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setLetterSpacing(2);
    const label = FALSE_LABELS[Math.floor(Math.random() * FALSE_LABELS.length)];
    this.add
      .text(VIEW_W / 2, 84, 'The signal dropped. Your save is intact.', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '11px',
        color: css(P.cream),
      })
      .setOrigin(0.5)
      .setResolution(2);
    this.add
      .text(VIEW_W / 2, 102, `Filed as: ${label}`, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10px',
        color: css(P.warning),
      })
      .setOrigin(0.5)
      .setResolution(2);

    this.makeButton(VIEW_W / 2, 134, 'CONTINUE FROM LAST SAVE', css(P.signal), () => this.retry());
    this.makeButton(VIEW_W / 2, 170, 'RETURN TO TITLE', css(P.cream), () => this.mainMenu());
    this.add
      .text(VIEW_W / 2, 204, 'R / ENTER / A = continue     M / B = title', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '8px',
        color: css(P.uiDim),
      })
      .setOrigin(0.5)
      .setResolution(2);
    this.input.keyboard?.on('keydown-R', () => this.retry());
    this.input.keyboard?.on('keydown-ENTER', () => this.retry());
    this.input.keyboard?.on('keydown-M', () => this.mainMenu());

    bus.emit(EVT.sceneChanged, { scene: SCENES.gameOver, zone: 'Connection Lost' });
    audio.bossWarning();
  }

  update(): void {
    // gamepad retry: A / Cross or START; title: B / Circle
    const pad = readPad();
    const pressed = (i: number) => pad?.buttons[i] === true && this.prevPadButtons[i] !== true;
    if (pressed(PAD.jump) || pressed(PAD.start)) this.retry();
    if (pressed(PAD.interact)) this.mainMenu();
    this.prevPadButtons = pad ? { ...pad.buttons } : {};
  }

  private prevPadButtons: Record<number, boolean> = {};

  private makeButton(x: number, y: number, text: string, color: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 240, 24, 0x111724, 0.96).setStrokeStyle(1, P.warning, 0.56).setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y, text, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color,
      })
      .setOrigin(0.5)
      .setResolution(2);
    const over = () => {
      bg.setStrokeStyle(2, P.signal, 0.9);
      label.setColor(css(P.signal));
    };
    const out = () => {
      bg.setStrokeStyle(1, P.warning, 0.56);
      label.setColor(color);
    };
    bg.on('pointerover', over);
    bg.on('pointerout', out);
    bg.on('pointerdown', onClick);
    label.setInteractive({ useHandCursor: true }).on('pointerdown', onClick).on('pointerover', over).on('pointerout', out);
  }

  private retry(): void {
    // stop whatever gameplay was running and restart the CURRENT zone fresh —
    // quest + flags come back from the save file (route by save.currentZone so
    // dying in Motel Nowhere re-establishes there, not back in Miller Field).
    const zone = getSave().currentZone;
    // died in a top-down section? re-attempt that same section (arena id is still
    // in the registry) rather than dumping the player into the side-view zone.
    const retryScene = (this.registry.get('gameOverRetryScene') as string) || this.fromScene;
    if (retryScene === SCENES.sweep) {
      const arenaId = this.registry.get('gameOverRetryArenaId') as string | undefined;
      if (arenaId) this.registry.set('sweepArenaId', arenaId);
    }
    const target =
      retryScene === SCENES.sweep ? SCENES.sweep : (ZONE_ROUTES[zone]?.scene ?? SCENES.field);
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

  private mainMenu(): void {
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
    this.scene.start(SCENES.menu);
    this.scene.stop();
  }
}
