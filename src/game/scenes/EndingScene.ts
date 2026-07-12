/**
 * ENDING — the finale's CLASSIFICATION CHOICE + ending card. Launched over the
 * paused Skyline scene once the Listening Station is down. The radar asks what it
 * should read you as; you answer (or refuse), it's recorded to the save, a short
 * card plays, and the broadcast ends → back to the title.
 */
import Phaser from 'phaser';
import { PALETTE as P, SCENES, VIEW_H, VIEW_W, css } from '../config';
import { audio } from '../systems/AudioSystem';
import { getSave, recordClassificationChoice, recordEndingSeen } from '../systems/SaveSystem';

interface Choice { key: string; label: string; blurb: string; color: number; }

const CHOICES: Choice[] = [
  { key: 'UNKNOWN', label: '1 · UNKNOWN', blurb: 'You stay off every list. The sky keeps listening — and never decides.', color: P.signal },
  { key: 'CONTACT', label: '2 · CONTACT', blurb: 'CONTACT-47, logged and known. The Engine files you and moves on.', color: P.scoutWill },
  { key: 'SIGNAL', label: '3 · SIGNAL', blurb: 'You were the leak in the machine all along. The message was always you.', color: P.scoutChip },
  { key: 'FRIEND', label: '4 · FRIEND', blurb: 'The fifth scout. Will, Chip, Henry, Cameron, Danny — and you.', color: P.scoutHenry },
  { key: 'REFUSE', label: '5 · REFUSE THE LABEL', blurb: 'You refuse the question itself. The broadcast ends undecided — and free.', color: P.scoutDanny },
];

export class EndingScene extends Phaser.Scene {
  private chosen = false;
  private rows: Phaser.GameObjects.Text[] = [];

  constructor() {
    super(SCENES.ending);
  }

  create(): void {
    this.chosen = false;
    this.rows = [];
    this.cameras.main.setBackgroundColor(0x05070d);
    this.cameras.main.fadeIn(600, 5, 7, 13);

    this.add.text(VIEW_W / 2, 40, 'THE SKY ANSWERS', { fontFamily: 'monospace', fontSize: '14px', color: css(P.signal) }).setOrigin(0.5);
    this.add
      .text(VIEW_W / 2, 62, 'CONTACT-47 — what does the radar read you as?', { fontFamily: 'monospace', fontSize: '9px', color: css(P.white) })
      .setOrigin(0.5);

    CHOICES.forEach((c, i) => {
      const t = this.add
        .text(VIEW_W / 2, 92 + i * 20, c.label, { fontFamily: 'monospace', fontSize: '11px', color: css(c.color) })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => !this.chosen && t.setScale(1.12));
      t.on('pointerout', () => t.setScale(1));
      t.on('pointerdown', () => this.choose(i));
      this.rows.push(t);
    });

    const hint = this.add
      .text(VIEW_W / 2, VIEW_H - 22, 'press 1-5 or click', { fontFamily: 'monospace', fontSize: '8px', color: css(P.white) })
      .setOrigin(0.5);
    hint.setAlpha(0.6);

    (['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'] as const).forEach((k, i) => {
      this.input.keyboard?.on(`keydown-${k}`, () => this.choose(i));
    });
    audio.transitionWarp();
  }

  private choose(i: number): void {
    if (this.chosen) return;
    this.chosen = true;
    const c = CHOICES[i];
    recordClassificationChoice(c.key);
    recordEndingSeen();
    audio.doorUnlock();

    this.rows.forEach((t, j) => t.setAlpha(j === i ? 1 : 0.15).setScale(j === i ? 1.15 : 1));

    const stats = getSave().playerStats;
    const mins = Math.floor(stats.timePlayedSec / 60);
    this.add
      .text(VIEW_W / 2, VIEW_H - 92, c.blurb, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: css(c.color),
        align: 'center',
        wordWrap: { width: VIEW_W - 60 },
      })
      .setOrigin(0.5);
    this.add
      .text(VIEW_W / 2, VIEW_H - 52, `THE END\nSignal Fragments ${getSave().signalFragments} · ${mins}m · ${stats.deaths} deaths\nbut the sky is still listening`, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: css(P.white),
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.85);

    const go = this.add
      .text(VIEW_W / 2, VIEW_H - 16, 'press ENTER — return to the sky', { fontFamily: 'monospace', fontSize: '8px', color: css(P.signal) })
      .setOrigin(0.5);
    this.tweens.add({ targets: go, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1 });

    const finish = () => this.toMenu();
    this.input.keyboard?.once('keydown-ENTER', finish);
    this.input.keyboard?.once('keydown-SPACE', finish);
    this.time.delayedCall(500, () => this.input.once(Phaser.Input.Events.POINTER_DOWN, finish));
  }

  private toMenu(): void {
    this.cameras.main.fadeOut(600, 5, 7, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop(SCENES.skyline);
      this.scene.stop(SCENES.ui);
      this.scene.start(SCENES.menu);
    });
  }
}
