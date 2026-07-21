/**
 * Connection lost. The Interpretation Engine files you under something
 * insulting and mundane; you re-establish and try again.
 */
import Phaser from 'phaser';
import { EVT, VIEW_H, VIEW_W, PAD, RENDER_ZOOM, SCENES } from '../config';
import { bus } from '../systems/EventBus';
import { audio } from '../systems/AudioSystem';
import { readPad } from '../systems/PadSim';
import { getSave } from '../systems/SaveSystem';

const FALSE_LABELS = ['SWAMP GAS', 'WEATHER BALLOON', 'THE PLANET VENUS', 'BIRDS, PROBABLY', 'LENS FLARE', 'A KITE'];

export class GameOverScene extends Phaser.Scene {
  private fromScene = '';
  private overlayEl: HTMLElement | null = null;

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
    this.renderDomOverlay();
    this.input.keyboard?.on('keydown-R', () => this.retry());
    this.input.keyboard?.on('keydown-ENTER', () => this.retry());
    this.input.keyboard?.on('keydown-M', () => this.mainMenu());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeDomOverlay());

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

  private renderDomOverlay(): void {
    this.removeDomOverlay();
    const frame = document.getElementById('game-frame');
    if (!frame) return;
    const label = FALSE_LABELS[Math.floor(Math.random() * FALSE_LABELS.length)];
    const el = document.createElement('div');
    el.id = 'game-over-dom';
    el.innerHTML = `
      <section class="go-panel" role="dialog" aria-label="Connection lost">
        <div class="go-title">CONNECTION LOST</div>
        <div class="go-copy">The signal dropped. Your save is intact.</div>
        <div class="go-filed">Filed as: ${label}</div>
        <button class="go-btn primary" data-act="continue">CONTINUE FROM LAST SAVE</button>
        <button class="go-btn" data-act="title">RETURN TO TITLE</button>
        <div class="go-hint">R / ENTER / A = continue · M / B = title</div>
      </section>`;
    el.querySelector('[data-act="continue"]')?.addEventListener('click', () => this.retry());
    el.querySelector('[data-act="title"]')?.addEventListener('click', () => this.mainMenu());
    frame.appendChild(el);
    this.overlayEl = el;
  }

  private removeDomOverlay(): void {
    this.overlayEl?.remove();
    this.overlayEl = null;
  }

  private retry(): void {
    this.removeDomOverlay();
    // Top-down-only retry: re-attempt the current/saved arena.
    const arenaByZone: Record<string, string> = {
      'miller-field': 'surface-z1',
      'motel-nowhere': 'circuit-z2',
      'tiger-stadium': 'town-z3',
      'pattersons-orchard': 'maze-z4',
      'skyline-array': 'anomaly-01',
    };
    const retryScene = (this.registry.get('gameOverRetryScene') as string) || this.fromScene;
    let arenaId = this.registry.get('gameOverRetryArenaId') as string | undefined;
    if (retryScene === SCENES.sweep) {
      if (arenaId) this.registry.set('sweepArenaId', arenaId);
    } else {
      arenaId = arenaByZone[getSave().currentZone] ?? 'surface-z1';
      this.registry.set('sweepArenaId', arenaId);
    }
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
    this.scene.start(SCENES.sweep);
    this.scene.stop();
  }

  private mainMenu(): void {
    this.removeDomOverlay();
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
