/**
 * Scout Echo — the payoff when you complete a scout's 3-piece Signal Set.
 * A soft apparition of the kid (in their scout color) rises from the field,
 * "hands you their signal," and unlocks that skin. This is the moment the Five
 * Scouts become characters, and it seeds The Broadcast finale (all five converge).
 */
import Phaser from 'phaser';
import { PALETTE as P, TEX, css } from '../config';
import { audio } from '../systems/AudioSystem';
import type { EffectsSystem } from '../systems/EffectsSystem';

/** the distinct kid sprite for each scout (built in ProceduralArt) */
const KID_TEX: Record<string, string> = {
  will: TEX.kidWill,
  chip: TEX.kidChip,
  henry: TEX.kidHenry,
  cameron: TEX.kidCameron,
  danny: TEX.kidDanny,
};

export class ScoutEcho {
  /**
   * Summon a scout's echo: the kid themselves (procedural sprite) rises with
   * their name over their head, holds a beat so you actually MEET them, then
   * dissolves. `label` is the floating nameplate, e.g. "WILL / WILLOW".
   */
  static summon(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scoutId: string,
    color: number,
    fx: EffectsSystem,
    label?: string,
    onDone?: () => void
  ): void {
    audio.fragmentPickup();
    fx.flash(color, 220);
    fx.staticBurst(320);
    fx.explode(x, y, color, 18);

    const halo = scene.add
      .image(x, y, TEX.glow8)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(4)
      .setAlpha(0.5)
      .setDepth(60);

    // the kid themselves — feet on the summon point, ghostly but recognizable
    const echo = scene.add
      .image(x, y + 8, KID_TEX[scoutId] ?? TEX.scoutEcho)
      .setOrigin(0.5, 1)
      .setDepth(61)
      .setAlpha(0);

    // name tag floating above their head, fades in/out with the echo
    const name = scene.add
      .text(x, y - 22, label ?? '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: css(color),
        backgroundColor: 'rgba(5,7,15,0.72)',
        padding: { x: 3, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(62)
      .setResolution(2)
      .setAlpha(0);

    // rise + brighten
    scene.tweens.add({ targets: echo, alpha: 0.92, y: y - 2, duration: 500, ease: 'Sine.easeOut' });
    scene.tweens.add({ targets: name, alpha: 1, y: y - 26, duration: 500, ease: 'Sine.easeOut' });
    scene.tweens.add({ targets: halo, scale: 6, alpha: 0.7, y: y - 4, duration: 500, yoyo: true, repeat: 1 });
    for (let i = 0; i < 8; i++) {
      scene.time.delayedCall(300 + i * 90, () => fx.sparks(x + Phaser.Math.Between(-8, 8), y - i * 2, color, 2));
    }

    // hold ~1.6s so you meet them, then dissolve upward
    scene.time.delayedCall(1600, () => {
      scene.tweens.add({
        targets: [echo, halo, name],
        y: '-=18',
        alpha: 0,
        duration: 700,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          echo.destroy();
          halo.destroy();
          name.destroy();
          onDone?.();
        },
      });
    });
    void P;
  }
}
