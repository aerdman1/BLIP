/**
 * Procedural textures for the top-down "Scan" arena — AAA visual pass.
 * Everything is illustrated pixel art: multiple shading tones, dark outlines,
 * top-left highlights, and baked ground shadows — NOT flat fills. Palette-locked
 * (see .claude/skills/procedural-pixel-art). Built once, lazily, idempotent.
 */
import Phaser from 'phaser';
import { PALETTE as P, TEX } from '../config';

function gfx(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({ x: 0, y: 0 }, false);
}
const V = (pts: number[][]) => pts.map(([x, y]) => ({ x, y })) as Phaser.Types.Math.Vector2Like[];
const rnd = (n: number) => Math.floor(Math.random() * n);

/** speckle a rect with weighted tones for organic ground */
function speckle(g: Phaser.GameObjects.Graphics, w: number, h: number, tones: [number, number][], count: number) {
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let acc = 0;
    let col = tones[0][0];
    for (const [c, wt] of tones) {
      acc += wt;
      if (r <= acc) { col = c; break; }
    }
    const x = rnd(w);
    const y = rnd(h);
    g.fillStyle(col, 1);
    if (Math.random() < 0.5) g.fillRect(x, y, 1, 2);
    else g.fillRect(x, y, 2, 1);
  }
}

export function buildSweepTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.sweepBlipBody)) return; // idempotent (keyed on the new hero sprite)

  /* ============================== GROUND ============================== */
  // dark forest grass — base is deep, blades vary so it reads rich not flat
  {
    const g = gfx(scene);
    g.fillStyle(P.tdGround, 1).fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, [[P.tdGroundDeep, 0.4], [P.grassDark, 0.3], [P.moss, 0.2], [P.tdGroundLit, 0.1]], 60);
    // a few faint amber flecks (life)
    for (let i = 0; i < 3; i++) g.fillStyle(P.amberDim, 0.5).fillRect(rnd(32), rnd(32), 1, 1);
    g.generateTexture(TEX.sweepGrass, 32, 32);
    g.destroy();
  }
  // lit grass patch
  {
    const g = gfx(scene);
    g.fillStyle(P.tdGroundLit, 1).fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, [[P.tdGround, 0.45], [P.grass, 0.3], [P.grassLit, 0.25]], 56);
    g.generateTexture(TEX.sweepGrass2, 32, 32);
    g.destroy();
  }
  // dark grass patch (shadowed regions)
  {
    const g = gfx(scene);
    g.fillStyle(P.tdGroundDeep, 1).fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, [[P.foliageDark, 0.5], [P.grassDark, 0.3], [P.tdGround, 0.2]], 46);
    g.generateTexture(TEX.sweepGrassDk, 32, 32);
    g.destroy();
  }
  // worn dirt path / trampled clearing
  {
    const g = gfx(scene);
    g.fillStyle(P.tdSoil, 1).fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, [[P.tdSoilDark, 0.5], [P.dirtDark, 0.3], [P.stoneDark, 0.2]], 40);
    // a couple embedded pebbles
    for (let i = 0; i < 3; i++) {
      const x = rnd(28) + 2;
      const y = rnd(28) + 2;
      g.fillStyle(P.stoneDark, 1).fillRect(x, y + 1, 3, 2);
      g.fillStyle(P.stone, 1).fillRect(x, y, 3, 1);
    }
    g.generateTexture(TEX.sweepPath, 32, 32);
    g.destroy();
  }
  // motel wet asphalt (darker, with neon-spill puddles)
  {
    const g = gfx(scene);
    g.fillStyle(P.asphalt, 1).fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, [[P.slateDark, 0.5], [P.asphaltLit, 0.3], [P.asphaltPuddle, 0.2]], 34);
    g.fillStyle(P.neonCyanDim, 0.5).fillRect(rnd(20) + 4, rnd(20) + 4, 4, 2);
    g.fillStyle(P.neonPinkDim, 0.4).fillRect(rnd(20) + 4, rnd(20) + 4, 3, 2);
    g.generateTexture(TEX.sweepAsphalt, 32, 32);
    g.destroy();
  }
  // orchard tilled soil — corn-row furrows (Zone 4 biome ground)
  {
    const g = gfx(scene);
    g.fillStyle(P.dirtDark, 1).fillRect(0, 0, 32, 32);
    speckle(g, 32, 32, [[P.tdSoil, 0.4], [P.cornStalkDark, 0.3], [P.dirt, 0.2], [P.cornStalk, 0.1]], 46);
    g.fillStyle(P.tdSoilDark, 0.5);
    for (let x = 3; x < 32; x += 7) g.fillRect(x, 0, 1, 32); // furrow shadows
    g.fillStyle(P.cornStalkDark, 0.4);
    for (let x = 5; x < 32; x += 7) g.fillRect(x, 0, 1, 32); // ridge lit edge
    g.generateTexture(TEX.sweepCornGround, 32, 32);
    g.destroy();
  }

  /* ============================== DECALS ============================== */
  {
    const g = gfx(scene); // wildflowers on tiny stems
    g.fillStyle(P.grassDark, 1);
    [[2, 8], [6, 10], [9, 7], [4, 11]].forEach(([x, y]) => g.fillRect(x, y, 1, 3));
    [[2, 6, P.tdFlower], [6, 8, P.tdFlowerPink], [9, 5, P.tdFlower], [4, 9, P.white]].forEach(([x, y, c]) => {
      g.fillStyle(c as number, 1).fillRect(x - 1, y, 3, 2).fillRect(x, y - 1, 1, 3);
    });
    g.generateTexture(TEX.sweepFlower, 12, 12);
    g.destroy();
  }
  {
    const g = gfx(scene); // pebble scatter with tiny shadows
    [[1, 4], [5, 2], [8, 5], [11, 3], [3, 6]].forEach(([x, y]) => {
      g.fillStyle(P.black, 0.25).fillEllipse(x + 1, y + 3, 4, 2);
      g.fillStyle(P.stoneDark, 1).fillRect(x, y + 1, 3, 2);
      g.fillStyle(P.stone, 1).fillRect(x, y, 3, 1);
      g.fillStyle(P.bluestone, 0.7).fillRect(x, y, 1, 1);
    });
    g.generateTexture(TEX.sweepPebbles, 14, 10);
    g.destroy();
  }
  {
    const g = gfx(scene); // weed / grass tuft
    g.fillStyle(P.foliageDark, 1);
    [[5, 14, 5, 8], [3, 14, 6, 10], [7, 14, 4, 6], [6, 14, 8, 4]].forEach(([x1, y1, x2, y2]) =>
      g.lineStyle(2, P.grassDark, 1).lineBetween(x1, y1, x2, y2)
    );
    g.lineStyle(1, P.grassLit, 1).lineBetween(5, 14, 5, 7).lineBetween(3, 14, 6, 9);
    g.generateTexture(TEX.sweepWeed, 12, 15);
    g.destroy();
  }
  {
    const g = gfx(scene); // metal scrap / debris
    g.fillStyle(P.black, 0.3).fillEllipse(8, 10, 14, 5);
    g.fillStyle(P.slateDark, 1).fillPoints(V([[2, 8], [7, 5], [13, 7], [11, 10], [4, 10]]), true);
    g.fillStyle(P.slate, 1).fillPoints(V([[4, 7], [8, 6], [10, 8], [6, 9]]), true);
    g.fillStyle(P.trackRed, 0.7).fillRect(9, 6, 2, 1); // rust
    g.lineStyle(1, P.black, 0.5).strokePoints(V([[2, 8], [7, 5], [13, 7], [11, 10], [4, 10]]), true);
    g.generateTexture(TEX.sweepScrap, 16, 13);
    g.destroy();
  }
  {
    const g = gfx(scene); // signal contamination splotch (soft, additive-friendly)
    g.fillStyle(P.violetGlitch, 0.18).fillCircle(10, 10, 9);
    g.fillStyle(P.signal, 0.12).fillCircle(8, 9, 6);
    g.fillStyle(P.violetGlitch, 0.25).fillCircle(11, 11, 4);
    g.generateTexture(TEX.sweepContam, 20, 20);
    g.destroy();
  }

  /* ============================== PROPS ============================== */
  // boulder cluster — 3 stone tones, outline, baked shadow
  {
    const g = gfx(scene);
    g.fillStyle(P.black, 0.3).fillEllipse(12, 17, 22, 7);
    g.fillStyle(P.stoneDark, 1).fillPoints(V([[3, 15], [5, 6], [12, 3], [20, 6], [22, 14], [16, 18], [7, 18]]), true);
    g.fillStyle(P.stone, 1).fillPoints(V([[6, 12], [10, 6], [16, 8], [17, 14], [10, 15]]), true);
    g.fillStyle(P.bluestone, 0.8).fillPoints(V([[9, 8], [13, 7], [14, 10], [10, 11]]), true);
    g.fillStyle(P.white, 0.3).fillRect(11, 7, 2, 1);
    g.lineStyle(1, P.black, 0.55).strokePoints(V([[3, 15], [5, 6], [12, 3], [20, 6], [22, 14], [16, 18], [7, 18]]), true);
    g.generateTexture(TEX.sweepRock, 24, 21);
    g.destroy();
  }
  // bush / tree canopy — layered, light from top-left, outline, shadow
  {
    const g = gfx(scene);
    g.fillStyle(P.black, 0.3).fillEllipse(17, 27, 28, 7);
    const blobs = [[10, 16, 9], [22, 15, 9], [16, 10, 10], [24, 20, 8], [10, 21, 8], [17, 18, 9]];
    g.fillStyle(P.foliageDark, 1);
    blobs.forEach(([x, y, r]) => g.fillCircle(x, y, r));
    g.fillStyle(P.foliage, 1);
    [[12, 12, 6], [20, 12, 6], [16, 9, 5], [22, 16, 5]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
    g.fillStyle(P.grassDark, 1);
    [[13, 10, 4], [18, 8, 4]].forEach(([x, y, r]) => g.fillCircle(x, y, r));
    g.fillStyle(P.grassLit, 0.8);
    [[13, 9], [17, 7], [20, 10]].forEach(([x, y]) => g.fillCircle(x, y, 2));
    g.generateTexture(TEX.sweepBush, 34, 30);
    g.destroy();
  }
  // fallen log
  {
    const g = gfx(scene);
    g.fillStyle(P.black, 0.3).fillEllipse(14, 13, 26, 5);
    g.fillStyle(P.dirtDark, 1).fillRoundedRect(1, 3, 26, 8, 3);
    g.fillStyle(P.dirt, 1).fillRoundedRect(1, 3, 26, 4, 2);
    g.fillStyle(P.fence, 1).fillCircle(25, 7, 4).fillCircle(3, 7, 4);
    g.fillStyle(P.dirtDark, 1).fillCircle(25, 7, 2);
    g.lineStyle(1, P.dirtDark, 0.8).lineBetween(6, 5, 22, 5).lineBetween(5, 8, 23, 8);
    g.generateTexture(TEX.sweepLog, 28, 15);
    g.destroy();
  }
  // wooden crate
  {
    const g = gfx(scene);
    g.fillStyle(P.black, 0.3).fillEllipse(9, 17, 16, 4);
    g.fillStyle(P.dirtDark, 1).fillRect(1, 1, 16, 15);
    g.fillStyle(P.fence, 1).fillRect(2, 2, 14, 5);
    g.fillStyle(P.dirt, 1).fillRect(2, 2, 14, 2);
    g.lineStyle(1, P.dirtDark, 1).lineBetween(2, 8, 15, 15).lineBetween(15, 8, 2, 15).strokeRect(1, 1, 16, 15);
    g.generateTexture(TEX.sweepCrate, 18, 18);
    g.destroy();
  }
  // small concrete bunker (landmark)
  {
    const g = gfx(scene);
    g.fillStyle(P.black, 0.35).fillEllipse(22, 32, 42, 7);
    g.fillStyle(P.slateDark, 1).fillRect(3, 6, 38, 26);
    g.fillStyle(P.slate, 1).fillRect(3, 6, 38, 6); // lit roof band
    g.fillStyle(P.stoneDark, 1).fillRect(6, 16, 30, 14);
    g.fillStyle(P.windowLight, 0.9).fillRect(12, 20, 6, 5).fillRect(26, 20, 6, 5); // lit windows
    g.fillStyle(P.windowCore, 1).fillRect(13, 21, 2, 2).fillRect(27, 21, 2, 2);
    g.fillStyle(P.slateDark, 1).fillRect(20, 2, 3, 6); // antenna
    g.fillStyle(P.danger, 1).fillCircle(21, 2, 1.5);
    g.lineStyle(1, P.black, 0.5).strokeRect(3, 6, 38, 26);
    g.generateTexture(TEX.sweepBunker, 44, 34);
    g.destroy();
  }
  // radio tower — lattice, guy wires, beacon
  {
    const g = gfx(scene);
    g.fillStyle(P.black, 0.35).fillEllipse(14, 50, 22, 6);
    g.fillStyle(P.slateDark, 1).fillPoints(V([[10, 2], [18, 2], [24, 50], [4, 50]]), true);
    g.lineStyle(1, P.slate, 0.9);
    for (let y = 6; y < 50; y += 6) {
      const t = y / 50;
      const lx = 10 - t * 6;
      const rx = 18 + t * 6;
      g.lineBetween(lx, y, rx, y + 6);
      g.lineBetween(rx, y, lx, y + 6);
      g.lineBetween(lx, y, lx, y + 6);
      g.lineBetween(rx, y, rx, y + 6);
    }
    g.lineStyle(1, P.slateDark, 0.6).lineBetween(14, 4, 2, 48).lineBetween(14, 4, 26, 48); // guy wires
    g.fillStyle(P.danger, 1).fillCircle(14, 3, 2.5);
    g.fillStyle(P.white, 0.8).fillCircle(14, 3, 1);
    g.generateTexture(TEX.sweepTower, 28, 52);
    g.destroy();
  }
  // fence segment
  {
    const g = gfx(scene);
    g.fillStyle(P.black, 0.25).fillEllipse(14, 11, 24, 3);
    g.fillStyle(P.fence, 1).fillRect(0, 4, 28, 3);
    g.fillStyle(P.dirtDark, 1).fillRect(2, 1, 3, 9).fillRect(23, 1, 3, 9);
    g.fillStyle(P.dirt, 1).fillRect(2, 1, 3, 2).fillRect(23, 1, 3, 2);
    g.lineStyle(1, P.dirtDark, 0.8).strokeRect(2, 1, 3, 9).strokeRect(23, 1, 3, 9);
    g.generateTexture(TEX.sweepFence, 28, 12);
    g.destroy();
  }
  // sign board
  {
    const g = gfx(scene);
    g.fillStyle(P.black, 0.3).fillEllipse(20, 25, 20, 4);
    g.fillStyle(P.dirtDark, 1).fillRect(18, 16, 3, 9);
    g.fillStyle(P.fence, 1).fillRect(0, 0, 40, 16);
    g.fillStyle(P.dirt, 1).fillRect(1, 1, 38, 3);
    g.lineStyle(1, P.dirtDark, 1).strokeRect(0, 0, 40, 16);
    g.generateTexture(TEX.sweepSign, 40, 26);
    g.destroy();
  }
  // Signal Node — illustrated beacon with clear hierarchy
  {
    const g = gfx(scene);
    const c = 24;
    g.fillStyle(P.black, 0.35).fillEllipse(c, 40, 40, 8);
    g.fillStyle(P.fuseSteelDark, 1).fillCircle(c, c, 22);
    g.fillStyle(P.fuseSteel, 1).fillCircle(c, c, 18);
    g.lineStyle(2, P.slate, 1).strokeCircle(c, c, 18);
    g.lineStyle(1, P.signalDim, 0.8).strokeCircle(c, c, 14).strokeCircle(c, c, 10);
    // three emitter nubs
    [0, 120, 240].forEach((a) => {
      const rad = (a * Math.PI) / 180;
      g.fillStyle(P.slateDark, 1).fillCircle(c + Math.cos(rad) * 18, c + Math.sin(rad) * 18, 3);
      g.fillStyle(P.signalGreen, 1).fillCircle(c + Math.cos(rad) * 18, c + Math.sin(rad) * 18, 1.5);
    });
    g.fillStyle(P.signalDim, 1).fillCircle(c, c, 8);
    g.fillStyle(P.signalGreen, 1).fillCircle(c, c, 6);
    g.fillStyle(P.signal, 1).fillCircle(c, c, 3.5);
    g.fillStyle(P.white, 1).fillCircle(c, c, 1.5);
    g.generateTexture(TEX.sweepNode, 48, 48);
    g.destroy();
  }
  // crop-circle glyph decal
  {
    const g = gfx(scene);
    const c = 90;
    g.lineStyle(2, P.signalDim, 0.5);
    [30, 56, 82].forEach((r) => g.strokeCircle(c, c, r));
    g.lineStyle(1, P.signal, 0.4);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      g.lineBetween(c + Math.cos(a) * 26, c + Math.sin(a) * 26, c + Math.cos(a) * 86, c + Math.sin(a) * 86);
    }
    g.fillStyle(P.signal, 0.3).fillCircle(c, c, 8);
    g.generateTexture(TEX.sweepCrop, 180, 180);
    g.destroy();
  }
  // motel props (kept, mild upgrade)
  {
    const g = gfx(scene);
    g.fillStyle(P.slateDark, 1).fillRect(0, 2, 18, 14);
    g.fillStyle(P.fuseSteelDark, 1).fillRect(1, 3, 16, 12);
    g.lineStyle(1, P.neonCyan, 0.8).strokeRect(1, 3, 16, 12);
    g.fillStyle(P.neonAmber, 1).fillCircle(5, 9, 1.5);
    g.fillStyle(P.neonGreen, 1).fillCircle(9, 9, 1.5);
    g.fillStyle(P.neonPink, 1).fillCircle(13, 9, 1.5);
    g.generateTexture(TEX.sweepBlock, 18, 16);
    g.destroy();
  }
  {
    const g = gfx(scene);
    g.fillStyle(P.slateDark, 1).fillRect(9, 14, 3, 12);
    g.fillStyle(P.neonPinkDim, 1).fillRect(0, 0, 22, 14);
    g.lineStyle(2, P.neonPink, 1).strokeRect(1, 1, 20, 12);
    g.fillStyle(P.neonCyan, 0.9).fillRect(4, 5, 14, 3);
    g.generateTexture(TEX.sweepNeonSign, 22, 26);
    g.destroy();
  }

  /* ============================== WALLS ============================== */
  // hedgerow — dense, darker bottom edge for depth
  {
    const g = gfx(scene);
    g.fillStyle(P.foliageDark, 1).fillRect(0, 0, 32, 32);
    for (let i = 0; i < 48; i++) {
      const r = Math.random();
      g.fillStyle(r < 0.55 ? P.foliage : r < 0.8 ? P.grassDark : P.moss, 1);
      g.fillCircle(rnd(32), rnd(30), 2 + rnd(2));
    }
    g.fillStyle(P.tdGroundDeep, 0.5).fillRect(0, 27, 32, 5); // grounded shadow edge
    g.fillStyle(P.grassLit, 0.4);
    for (let i = 0; i < 8; i++) g.fillRect(rnd(32), rnd(10), 1, 1);
    g.generateTexture(TEX.sweepHedge, 32, 32);
    g.destroy();
  }
  // motel wall panel
  {
    const g = gfx(scene);
    g.fillStyle(P.slateDark, 1).fillRect(0, 0, 32, 32);
    g.fillStyle(P.fuseSteelDark, 1).fillRect(3, 3, 26, 26);
    g.lineStyle(1, P.neonCyanDim, 0.9).strokeRect(2, 2, 28, 28);
    g.fillStyle(P.neonCyanDim, 0.6).fillRect(0, 0, 32, 1).fillRect(0, 31, 32, 1);
    g.fillStyle(P.slate, 0.5).fillRect(6, 6, 6, 2);
    g.generateTexture(TEX.sweepWallMotel, 32, 32);
    g.destroy();
  }
  // orchard corn-stalk wall — packed tall stalks with silk tassels (Zone 4)
  {
    const g = gfx(scene);
    g.fillStyle(P.foliageDark, 1).fillRect(0, 0, 32, 32);
    for (let i = 0; i < 26; i++) {
      const x = rnd(32);
      const h = 18 + rnd(14);
      g.fillStyle(rnd(2) ? P.cornStalkDark : P.grassDark, 1).fillRect(x, 32 - h, 2, h);
    }
    for (let i = 0; i < 16; i++) {
      const x = rnd(32);
      const h = 14 + rnd(14);
      g.fillStyle(P.cornStalk, 0.9).fillRect(x, 32 - h, 1, h);
    }
    g.fillStyle(P.cornSilk, 0.7);
    for (let i = 0; i < 8; i++) g.fillRect(rnd(32), rnd(8), 1, 2); // tassels up top
    g.fillStyle(P.tdSoilDark, 0.5).fillRect(0, 28, 32, 4); // grounded shadow base
    g.generateTexture(TEX.sweepCornWall, 32, 32);
    g.destroy();
  }

  /* ============================== ACTORS ============================== */
  // CONTACT-47 top-down hero — cream shell, green eyes, outline, top highlight
  {
    const g = gfx(scene);
    // body — full form ramp (deep underside → midtone → lit crown), same
    // 14×16 rounded shell footprint so collision/aim math is unchanged.
    g.fillStyle(P.shellDeep, 1).fillRoundedRect(5, 9, 14, 14, 6); // underside shadow
    g.fillStyle(P.shellShade, 1).fillRoundedRect(5, 8, 14, 14, 6); // midtone
    g.fillStyle(P.shellMid, 1).fillRoundedRect(5, 7, 14, 12, 6); // lit shell base
    g.fillStyle(P.shellWhite, 1).fillRoundedRect(5, 7, 13, 6, 5); // top light band
    g.fillStyle(P.shellHi, 0.85).fillRoundedRect(6, 8, 6, 3, 2); // top-left catch-light
    // cool moonlit rim down the shaded right + bottom edges
    g.fillStyle(P.shellRim, 0.5).fillRect(18, 10, 1, 9);
    g.fillStyle(P.shellRim, 0.3).fillRect(7, 20, 10, 1);
    // visor faceplate with a glass sheen
    g.fillStyle(P.faceplate, 1).fillRoundedRect(6, 9, 12, 8, 3);
    g.fillStyle(P.faceplateLit, 0.9).fillRoundedRect(6, 9, 12, 2, 2);
    // eyes: soft inner bloom → bright accent → white catch-light + roundness shade
    g.fillStyle(P.visorGlow, 0.18).fillCircle(10, 13, 3.4).fillCircle(15, 13, 3.4);
    g.fillStyle(P.signal, 1).fillCircle(10, 13, 2.2).fillCircle(15, 13, 2.2);
    g.fillStyle(P.signalDim, 0.7).fillCircle(10, 13.9, 1.1).fillCircle(15, 13.9, 1.1);
    g.fillStyle(P.white, 1).fillCircle(10.4, 12.4, 0.9).fillCircle(15.4, 12.4, 0.9);
    g.fillStyle(P.visorGlow, 0.4).fillRect(12, 12, 1, 2); // scanner line between eyes
    // little feet — shaded, lit top lip
    g.fillStyle(P.shellDeep, 1).fillRect(7, 22, 4, 3).fillRect(13, 22, 4, 3);
    g.fillStyle(P.shellShade, 1).fillRect(7, 22, 4, 1).fillRect(13, 22, 4, 1);
    // antenna — shaded shaft + glowing signal bulb
    g.fillStyle(P.shellDeep, 1).fillRect(11, 3, 2, 5);
    g.fillStyle(P.shellShade, 1).fillRect(11, 3, 1, 5);
    g.fillStyle(P.signal, 1).fillCircle(12, 3, 1.8);
    g.fillStyle(P.white, 0.8).fillCircle(11.6, 2.6, 0.7);
    g.lineStyle(1, P.faceplate, 0.5).strokeRoundedRect(5, 7, 14, 16, 6);
    g.generateTexture(TEX.sweepBlipBody, 24, 27);
    g.destroy();
  }
  // drone builder — shaded saucer + red eye + accent
  const drone = (key: string, accent: number, variant: 'plain' | 'dome' | 'wings', size: number) => {
    const g = gfx(scene);
    const w = size;
    const cx = w / 2;
    g.fillStyle(P.black, 0.28).fillEllipse(cx, w - 2, w - 4, 4); // shadow
    if (variant === 'wings') {
      g.fillStyle(accent, 1).fillTriangle(0, cx, 5, cx - 2, 5, cx + 3).fillTriangle(w, cx, w - 5, cx - 2, w - 5, cx + 3);
    }
    // hull
    g.fillStyle(P.slateDark, 1).fillRoundedRect(3, 4, w - 6, w - 8, 4);
    g.fillStyle(P.slate, 1).fillRoundedRect(3, 3, w - 6, (w - 8) * 0.6, 4); // lit top rim
    g.fillStyle(P.bluestone, 0.5).fillRect(5, 4, 4, 1);
    if (variant === 'dome') g.fillStyle(accent, 1).fillRoundedRect(cx - 3, 1, 6, 4, 2);
    // eye/core
    g.fillStyle(P.dangerDark, 1).fillCircle(cx, cx, 3.4);
    g.fillStyle(P.danger, 1).fillCircle(cx, cx, 2.4);
    g.fillStyle(P.warning, 1).fillCircle(cx - 0.6, cx - 0.6, 0.9);
    if (variant === 'plain') g.fillStyle(accent, 1).fillRect(1, cx, 2, 3).fillRect(w - 3, cx, 2, 3);
    g.lineStyle(1, P.black, 0.5).strokeRoundedRect(3, 3, w - 6, w - 6, 4);
    g.generateTexture(key, w, w);
    g.destroy();
  };
  drone(TEX.sweepDrifter, P.danger, 'plain', 18);
  drone(TEX.sweepTagger, P.violetGlitch, 'dome', 18);
  drone(TEX.sweepDiver, P.warning, 'wings', 18);
  // Elite "Classifier" — bigger, menacing, warning stripes + big scan eye
  {
    const g = gfx(scene);
    const w = 28;
    const cx = w / 2;
    g.fillStyle(P.black, 0.35).fillEllipse(cx, w - 3, w - 4, 6);
    g.fillStyle(P.slateDark, 1).fillRoundedRect(3, 4, w - 6, w - 9, 5);
    g.fillStyle(P.slate, 1).fillRoundedRect(3, 3, w - 6, (w - 9) * 0.55, 5);
    // warning stripes
    g.fillStyle(P.warning, 0.9);
    for (let i = 0; i < 3; i++) g.fillRect(5 + i * 6, 5, 3, 3);
    // big scanning eye
    g.fillStyle(P.dangerDark, 1).fillCircle(cx, cx + 1, 6);
    g.fillStyle(P.danger, 1).fillCircle(cx, cx + 1, 4.5);
    g.fillStyle(P.warning, 1).fillCircle(cx - 1, cx, 1.6);
    // spikes/antennae
    g.fillStyle(P.slate, 1).fillRect(3, 2, 2, 4).fillRect(w - 5, 2, 2, 4);
    g.fillStyle(P.danger, 1).fillCircle(4, 2, 1.4).fillCircle(w - 4, 2, 1.4);
    g.lineStyle(1, P.black, 0.55).strokeRoundedRect(3, 3, w - 6, w - 6, 5);
    g.generateTexture(TEX.sweepElite, w, w);
    g.destroy();
  }
  // "MAZE HEART" — Zone-4 FINALE boss. A big octagonal Engine construct: dark armoured
  // hull, warning-striped shoulders, a glyph ring, and a pulsing crop-glow core eye.
  {
    const g = gfx(scene);
    const w = 40;
    const c = w / 2;
    g.fillStyle(P.black, 0.4).fillEllipse(c, w - 4, w - 6, 8); // grounded shadow
    // octagonal hull (two tones + outline)
    const oct = (r: number) =>
      V(Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return [c + Math.cos(a) * r, c + Math.sin(a) * r];
      }));
    g.fillStyle(P.fuseSteelDark, 1).fillPoints(oct(18), true);
    g.fillStyle(P.slateDark, 1).fillPoints(oct(15), true);
    g.fillStyle(P.slate, 0.9).fillPoints(V([[c - 9, c - 11], [c + 9, c - 11], [c, c - 2]]), true); // lit top facet
    // warning-striped shoulders
    g.fillStyle(P.warning, 0.85);
    for (let i = 0; i < 3; i++) { g.fillRect(6 + i * 3, 7, 2, 3); g.fillRect(w - 12 + i * 3, 7, 2, 3); }
    // glyph ring (crop-circle motif)
    g.lineStyle(1, P.signalDim, 0.7).strokeCircle(c, c, 12);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      g.fillStyle(P.cropGlow, 0.6).fillCircle(c + Math.cos(a) * 12, c + Math.sin(a) * 12, 1.4);
    }
    // core eye — layered danger→crop-glow→white bloom
    g.fillStyle(P.dangerDark, 1).fillCircle(c, c, 9);
    g.fillStyle(P.danger, 1).fillCircle(c, c, 6.5);
    g.fillStyle(P.cropGlow, 0.9).fillCircle(c, c, 4);
    g.fillStyle(P.white, 1).fillCircle(c - 1, c - 1, 1.6);
    // antennae spikes
    g.fillStyle(P.slate, 1).fillRect(c - 1, 1, 2, 5).fillRect(2, c - 1, 5, 2).fillRect(w - 7, c - 1, 5, 2);
    g.fillStyle(P.danger, 1).fillCircle(c, 1, 1.6);
    g.lineStyle(1, P.black, 0.6).strokePoints(oct(18), true);
    g.generateTexture(TEX.sweepMazeHeart, w, w);
    g.destroy();
  }
  // FIREWALL "warden" — armoured hull with a bright shield plate on its +x (front) edge.
  // The sprite ROTATES in-game so the plate always faces the player (shoot the back).
  {
    const g = gfx(scene);
    const w = 22;
    const cx = w / 2;
    g.fillStyle(P.black, 0.3).fillEllipse(cx, w - 2, w - 6, 4);
    // hull
    g.fillStyle(P.fuseSteelDark, 1).fillRoundedRect(3, 4, w - 8, w - 8, 4);
    g.fillStyle(P.slate, 1).fillRoundedRect(3, 3, w - 8, (w - 8) * 0.55, 4);
    // red core eye
    g.fillStyle(P.dangerDark, 1).fillCircle(cx - 1, cx, 3.2);
    g.fillStyle(P.danger, 1).fillCircle(cx - 1, cx, 2.2);
    // shield plate hugging the front (+x) edge — thick, lit cyan rim
    g.fillStyle(P.bluestone, 1).fillRoundedRect(w - 7, 2, 5, w - 4, 2);
    g.fillStyle(P.neonCyan, 1).fillRect(w - 3, 3, 2, w - 6);
    g.fillStyle(P.white, 0.7).fillRect(w - 3, 4, 2, 3);
    g.lineStyle(1, P.black, 0.5).strokeRoundedRect(3, 3, w - 8, w - 6, 4);
    g.generateTexture(TEX.sweepWarden, w, w);
    g.destroy();
  }
  // PINPOINT "sniper" — slim scope drone: dark body, long cyan lens, single sharp eye.
  {
    const g = gfx(scene);
    const w = 18;
    const cx = w / 2;
    g.fillStyle(P.black, 0.28).fillEllipse(cx, w - 2, w - 6, 4);
    g.fillStyle(P.slateDark, 1).fillRoundedRect(4, 5, w - 8, w - 9, 3);
    g.fillStyle(P.slate, 1).fillRoundedRect(4, 4, w - 8, 3, 3);
    // long lens barrel across the middle
    g.fillStyle(P.fuseSteel, 1).fillRect(2, cx - 1, w - 4, 3);
    g.fillStyle(P.neonCyan, 1).fillRect(w - 5, cx - 1, 3, 3); // glinting lens tip
    g.fillStyle(P.white, 0.8).fillRect(w - 4, cx - 1, 1, 1);
    // targeting eye
    g.fillStyle(P.dangerDark, 1).fillCircle(cx, cx + 3, 2.4);
    g.fillStyle(P.danger, 1).fillCircle(cx, cx + 3, 1.5);
    g.lineStyle(1, P.black, 0.5).strokeRoundedRect(4, 4, w - 8, w - 7, 3);
    g.generateTexture(TEX.sweepSniper, w, w);
    g.destroy();
  }
  // REPLICATOR "splitter" — a clustered pod that obviously breaks apart.
  {
    const g = gfx(scene);
    const w = 20;
    const cx = w / 2;
    g.fillStyle(P.black, 0.3).fillEllipse(cx, w - 2, w - 5, 4);
    const pods: [number, number, number][] = [[cx, cx - 3, 4], [cx - 4, cx + 3, 3.5], [cx + 4, cx + 3, 3.5]];
    pods.forEach(([x, y, r]) => {
      g.fillStyle(P.slateDark, 1).fillCircle(x, y, r);
      g.fillStyle(P.violetGlitch, 0.9).fillCircle(x, y, r - 1.5);
      g.fillStyle(P.dangerDark, 1).fillCircle(x, y, 1.4);
    });
    g.fillStyle(P.black, 0.4).lineStyle(1, P.black, 0.4);
    g.lineBetween(cx, cx - 1, cx - 3, cx + 2).lineBetween(cx, cx - 1, cx + 3, cx + 2); // seams
    g.fillStyle(P.white, 0.5).fillCircle(cx - 1, cx - 4, 0.9);
    g.generateTexture(TEX.sweepSplitter, w, w);
    g.destroy();
  }
  // JITTER "weaver" — sleek fast dart with swept fins; reads as speed.
  {
    const g = gfx(scene);
    const w = 16;
    const cx = w / 2;
    g.fillStyle(P.black, 0.26).fillEllipse(cx, w - 2, w - 6, 3);
    g.fillStyle(P.signalDim, 1).fillTriangle(1, cx - 3, 5, cx, 1, cx + 3); // swept fins
    g.fillStyle(P.signalDim, 1).fillTriangle(w - 1, cx - 3, w - 5, cx, w - 1, cx + 3);
    g.fillStyle(P.slateDark, 1).fillRoundedRect(4, 3, w - 8, w - 6, 4);
    g.fillStyle(P.slate, 1).fillRoundedRect(4, 3, w - 8, 3, 3);
    g.fillStyle(P.dangerDark, 1).fillCircle(cx, cx, 2.6);
    g.fillStyle(P.danger, 1).fillCircle(cx, cx, 1.7);
    g.fillStyle(P.signal, 0.8).fillRect(cx - 1, 1, 2, 2); // nose light
    g.lineStyle(1, P.black, 0.5).strokeRoundedRect(4, 3, w - 8, w - 6, 4);
    g.generateTexture(TEX.sweepWeaver, w, w);
    g.destroy();
  }
  // PYLON "turret" — rooted hex emitter with muzzles around the rim.
  {
    const g = gfx(scene);
    const w = 20;
    const cx = w / 2;
    g.fillStyle(P.black, 0.32).fillEllipse(cx, w - 2, w - 4, 5);
    // hex base
    const hex = V([[cx, 2], [w - 3, 6], [w - 3, w - 5], [cx, w - 1], [3, w - 5], [3, 6]]);
    g.fillStyle(P.fuseSteelDark, 1).fillPoints(hex, true);
    g.fillStyle(P.slate, 1).fillPoints(V([[cx, 2], [w - 3, 6], [cx, w / 2], [3, 6]]), true); // lit top facets
    // muzzles poking out at the cardinals
    g.fillStyle(P.slateDark, 1);
    [[cx, 1], [w - 1, cx], [cx, w - 1], [1, cx]].forEach(([x, y]) => g.fillCircle(x, y, 1.8));
    // charged core
    g.fillStyle(P.dangerDark, 1).fillCircle(cx, cx, 4);
    g.fillStyle(P.danger, 1).fillCircle(cx, cx, 2.6);
    g.fillStyle(P.warning, 1).fillCircle(cx - 0.6, cx - 0.6, 1);
    g.lineStyle(1, P.black, 0.5).strokePoints(hex, true);
    g.generateTexture(TEX.sweepTurret, w, w);
    g.destroy();
  }

  /* ============================== VFX / MISC ============================== */
  // player bolt — bright core + tapered tail
  {
    const g = gfx(scene);
    g.fillStyle(P.signalDim, 1).fillRect(0, 2, 4, 1);
    g.fillStyle(P.signal, 1).fillRect(3, 1, 4, 3);
    g.fillStyle(P.white, 1).fillRect(5, 1, 2, 3);
    g.generateTexture(TEX.sweepShotP, 8, 5);
    g.destroy();
  }
  // enemy bolt — red core + tail
  {
    const g = gfx(scene);
    g.fillStyle(P.dangerDark, 1).fillRect(0, 2, 3, 1);
    g.fillStyle(P.danger, 1).fillRect(2, 1, 4, 3);
    g.fillStyle(P.warning, 1).fillRect(4, 1, 2, 2);
    g.generateTexture(TEX.sweepShotE, 7, 5);
    g.destroy();
  }
  // soft bolt halo (additive)
  {
    const g = gfx(scene);
    g.fillStyle(0xffffff, 0.14).fillCircle(8, 8, 8);
    g.fillStyle(0xffffff, 0.22).fillCircle(8, 8, 5);
    g.fillStyle(0xffffff, 0.4).fillCircle(8, 8, 2.5);
    g.generateTexture(TEX.sweepBoltGlow, 16, 16);
    g.destroy();
  }
  // ground shadows
  {
    const g = gfx(scene);
    g.fillStyle(0x000000, 0.1).fillEllipse(12, 6, 24, 12);
    g.fillStyle(0x000000, 0.14).fillEllipse(12, 6, 17, 9);
    g.fillStyle(0x000000, 0.2).fillEllipse(12, 6, 11, 6);
    g.generateTexture(TEX.sweepShadow, 24, 12);
    g.destroy();
  }
  {
    const g = gfx(scene);
    g.fillStyle(0x000000, 0.12).fillEllipse(18, 9, 36, 18);
    g.fillStyle(0x000000, 0.18).fillEllipse(18, 9, 24, 12);
    g.generateTexture(TEX.sweepShadowLg, 36, 18);
    g.destroy();
  }
  // reticle
  {
    const g = gfx(scene);
    g.lineStyle(1, P.white, 1).strokeCircle(8, 8, 6);
    g.lineStyle(1, P.signal, 1);
    g.lineBetween(8, 0, 8, 3).lineBetween(8, 13, 8, 16).lineBetween(0, 8, 3, 8).lineBetween(13, 8, 16, 8);
    g.fillStyle(P.signal, 1).fillRect(7, 7, 2, 2);
    g.generateTexture(TEX.sweepReticle, 16, 16);
    g.destroy();
  }
  // pickup diamond — faceted + glow
  {
    const g = gfx(scene);
    g.fillStyle(0xffffff, 0.15).fillCircle(6, 6, 6);
    g.fillStyle(P.white, 1).fillPoints(V([[6, 0], [12, 6], [6, 12], [0, 6]]), true);
    g.fillStyle(P.black, 0.25).fillPoints(V([[6, 6], [12, 6], [6, 12]]), true);
    g.fillStyle(0xffffff, 0.6).fillPoints(V([[6, 1], [9, 5], [6, 6], [3, 5]]), true);
    g.generateTexture(TEX.sweepPickup, 12, 12);
    g.destroy();
  }
}
