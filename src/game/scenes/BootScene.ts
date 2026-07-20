/**
 * BootScene — generates every procedural texture, then hands off to the menu.
 */
import Phaser from 'phaser';
import { SCENES, PALETTE as P, RENDER_ZOOM, VIEW_W, VIEW_H, css } from '../config';
import { generateAllTextures } from '../systems/ProceduralArt';
import { restoreBase } from '../render/RenderScale';
import { loadTopDown } from '../topdown/TdAssets';
import { loadSave } from '../systems/SaveSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    restoreBase(this); // defensive: never inherit a leaked hi-res buffer from the Sweep
    this.cameras.main.setZoom(RENDER_ZOOM).centerOn(VIEW_W / 2, VIEW_H / 2);
    const t = this.add
      .text(VIEW_W / 2, VIEW_H / 2, 'TUNING SIGNAL…', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: css(P.signal),
      })
      .setOrigin(0.5)
      .setResolution(2);

    generateAllTextures(this);
    // The HD top-down art set — the game's only file-loaded assets. Kicked off
    // here (not in SweepScene, which would re-fetch on every arena entry) and
    // deliberately NOT awaited: boot must never wait on art.
    void loadTopDown(this);
    loadSave(); // hydrate + migrate legacy key early

    this.time.delayedCall(80, () => {
      t.destroy();
      this.scene.start(SCENES.menu);
    });
  }
}
