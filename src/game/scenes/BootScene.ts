/**
 * BootScene — generates every procedural texture, then hands off to the menu.
 */
import Phaser from 'phaser';
import { SCENES, PALETTE as P, RENDER_ZOOM, VIEW_W, VIEW_H, css } from '../config';
import { generateAllTextures } from '../systems/ProceduralArt';
import { restoreBase } from '../render/RenderScale';
import { loadTopDown } from '../topdown/TdAssets';
import { TD_BIOMES } from '../topdown/TdBiomes';
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
    // The HD top-down art sets — the game's only file-loaded assets. Kicked off
    // here (not in SweepScene, which would re-fetch on every arena entry) and
    // deliberately NOT awaited: boot must never wait on art. One set per biome
    // that has HD art; a biome whose atlas is absent falls back on its own.
    // SEQUENTIALLY, not in parallel: every biome shares this scene's single
    // Phaser loader, so two concurrent loads would both attach once(COMPLETE)
    // to it and the first completion would resolve both — the second biome
    // reporting ready before its files had actually arrived.
    void (async () => {
      for (const biome of Object.values(TD_BIOMES)) await loadTopDown(this, biome);
    })();
    loadSave(); // hydrate + migrate legacy key early

    this.time.delayedCall(80, () => {
      t.destroy();
      this.scene.start(SCENES.menu);
    });
  }
}
