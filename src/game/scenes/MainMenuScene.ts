/**
 * Title screen — a moonlit, slightly wrong Chagrin Falls, Ohio.
 * One continuous scene: storefront rows on a shared street line, the stone
 * bridge, the falls pouring from its arch into the gorge, warm windows,
 * street lamps — and the Five Signal Scouts on the lower ledge, watching.
 * CONTACT-47's radar emblem renders in the crisp HTML hero (ShellUI), above the logo/menu.
 */
import Phaser from 'phaser';
import { EVT, VIEW_H, VIEW_W, PALETTE as P, RENDER_ZOOM, SCENES, TEX } from '../config';
import { ZONE_ROUTES } from '../data/zones';
import { audio } from '../systems/AudioSystem';
import { bus } from '../systems/EventBus';
import { getSave, resetSave, updateSave } from '../systems/SaveSystem';
import { quests } from '../systems/QuestSystem';
import { restoreBase } from '../render/RenderScale';
import { registerScene, unregisterScene } from '../systems/TestAPI';
import { attachScreenFilter, nightVisionIntro } from '../systems/ScreenFilter';

const STREET_Y = 196; // the one baseline both sides of town share
const CX = VIEW_W / 2;
const scoutColor = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const MENU_SCOUTS = [
  { id: 'henry', name: 'Henry / ANCHOR', tex: TEX.kidHenry, x: 36, color: scoutColor(P.scoutHenry) },
  { id: 'cameron', name: 'Cameron / ECHO', tex: TEX.kidCameron, x: 53, color: scoutColor(P.scoutCameron) },
  { id: 'chip', name: 'Chip / SPARK', tex: TEX.kidChip, x: 70, color: scoutColor(P.scoutChip) },
  { id: 'will', name: 'Will / WILLOW', tex: TEX.kidWill, x: 86, color: scoutColor(P.scoutWill) },
  { id: 'danny', name: 'Danny / ROCKET', tex: TEX.kidDanny, x: 101, color: scoutColor(P.scoutDanny) },
] as const;

export class MainMenuScene extends Phaser.Scene {
  private starting = false;
  private unsubs: Array<() => void> = [];
  private fallsBase!: Phaser.GameObjects.TileSprite;
  private fallsMid!: Phaser.GameObjects.TileSprite;
  private fallsDashes!: Phaser.GameObjects.TileSprite;
  private river!: Phaser.GameObjects.TileSprite;
  private clouds!: Phaser.GameObjects.TileSprite;

  constructor() {
    super(SCENES.menu);
  }

  create(): void {
    restoreBase(this); // defensive: the Sweep raises the backbuffer; never inherit it
    this.starting = false;
    this.cameras.main.setZoom(RENDER_ZOOM).centerOn(VIEW_W / 2, VIEW_H / 2);
    attachScreenFilter(this, false); // keeps the title camera in sync with the filter setting
    this.buildSky();
    this.buildGorgeAndRiver();
    this.buildTown();
    this.buildForeground();
    this.buildAtmosphere();
    // title-screen flourish: boot up in NIGHT-VISION, then slowly fade to normal
    nightVisionIntro(this, 3400);

    audio.playMusic('menu'); // the title theme (sounds once audio unlocks on first input)
    bus.emit(EVT.sceneChanged, { scene: SCENES.menu, zone: 'Chagrin Falls, OH' });
    bus.emit(EVT.menuActive, { active: true });
    bus.emit(EVT.questObjective, { objective: 'AWAITING TRANSMISSION — the town below is listening.', hint: '' });
    this.unsubs.push(
      bus.on(EVT.uiStartGame, (d) => this.startGame((d as { continueRun?: boolean })?.continueRun === true))
    );
    registerScene('menu', this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
      bus.emit(EVT.menuActive, { active: false });
      unregisterScene('menu');
    });
  }

  /* --------------------------------- layers --------------------------------- */

  private buildSky(): void {
    this.add.image(0, 0, TEX.sky).setOrigin(0);
    const stars = this.add.tileSprite(0, 0, VIEW_W, 150, TEX.stars).setOrigin(0).setAlpha(0.85);
    this.tweens.add({ targets: stars, alpha: { from: 0.7, to: 1 }, duration: 2600, yoyo: true, repeat: -1 });

    // brighter foreground stars for density (the shared star strip is faint) —
    // a few dozen crisp twinkles, deterministic so they don't reshuffle
    const starRng = ((s: number) => () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff))(0x51ff);
    for (let i = 0; i < 46; i++) {
      const sx = Math.floor(starRng() * VIEW_W);
      const sy = Math.floor(starRng() * 150);
      const big = starRng() > 0.82;
      const star = this.add.image(sx, sy, TEX.px).setTint(0xfff3c9).setScale(big ? 1 : 0.7).setAlpha(big ? 0.95 : 0.6);
      this.tweens.add({ targets: star, alpha: { from: big ? 0.4 : 0.2, to: big ? 1 : 0.7 }, duration: 1400 + (sx % 9) * 260, yoyo: true, repeat: -1, delay: (sy % 7) * 300 });
    }

    const moon = this.add.image(52, 36, TEX.moon);
    this.add.image(52, 36, TEX.glow8).setScale(15).setTint(P.moon).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.05); // wide halo
    this.add.image(52, 36, TEX.glow8).setScale(9).setTint(P.moon).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.15);
    this.add.image(52, 36, TEX.glow8).setScale(4.5).setTint(0xfff6d8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.16); // tight bright halo
    this.scheduleShootingStar();
    this.tweens.add({ targets: moon, y: 38, duration: 7000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.clouds = this.add.tileSprite(0, 30, VIEW_W, 72, TEX.clouds).setOrigin(0).setAlpha(0.55);

    // wooded hills close the composition behind the whole town
    this.add.tileSprite(0, 98, VIEW_W, 48, TEX.townHills).setOrigin(0);
    this.add.image(334, 120, TEX.steeple).setOrigin(0.5, 1); // church over the trees
    this.add.image(333, 98, TEX.glow8).setTint(P.windowCore).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25).setScale(0.8);
    for (const [tx, ty] of [
      [150, 128],
      [196, 132],
      [287, 130],
      [110, 124],
      [62, 128],
      [78, 132],
      [255, 128],
    ] as Array<[number, number]>) {
      this.add.image(tx, ty, TEX.pineTree).setOrigin(0.5, 1).setAlpha(0.9);
    }
  }

  private buildGorgeAndRiver(): void {
    const g = this.add.graphics();
    // embankment faces under both storefront rows, down to the frame edge
    g.fillStyle(0x131828, 1);
    g.fillRect(0, STREET_Y + 2, 148, VIEW_H - STREET_Y - 2);
    g.fillRect(332, STREET_Y + 2, VIEW_W - 332, VIEW_H - STREET_Y - 2);
    // the dark under-arch void the falls pours out of
    g.fillStyle(0x05070f, 1);
    g.fillRect(200, STREET_Y + 2, 80, 26);

    // gorge walls flanking the falls
    this.add.tileSprite(148, STREET_Y + 2, 62, VIEW_H - STREET_Y - 2, TEX.gorgeWall).setOrigin(0);
    this.add.tileSprite(270, STREET_Y + 2, 62, VIEW_H - STREET_Y - 2, TEX.gorgeWall).setOrigin(0);

    // river pool at the bottom of the gorge
    this.river = this.add.tileSprite(148, 246, 184, 24, TEX.riverGlint).setOrigin(0);
    const bankLine = this.add.graphics();
    bankLine.fillStyle(P.waterDeep, 0.9);
    bankLine.fillRect(148, 245, 184, 1);

    // shimmering vertical reflections in the plunge pool (bridge lamps + falls +
    // warm town light) — soft, additive, gently breathing for a living surface
    const reflections: Array<[number, number, number]> = [
      [172, P.windowLight, 0.17],
      [308, P.windowLight, 0.17],
      [240, P.waterPale, 0.2],
      [200, P.windowLight, 0.1],
      [278, P.windowLight, 0.1],
    ];
    for (const [rx, tint, a] of reflections) {
      const refl = this.add
        .image(rx, 258, TEX.glow8)
        .setTint(tint)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.7, 2.4)
        .setAlpha(a);
      this.tweens.add({
        targets: refl,
        alpha: { from: a * 0.55, to: a },
        scaleY: { from: 2.1, to: 2.9 },
        duration: 1700 + rx * 2,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // the falls (three animated layers at different speeds) — the hero landmark
    this.fallsBase = this.add.tileSprite(202, 204, 76, 44, TEX.waterfallBase).setOrigin(0);
    this.fallsMid = this.add
      .tileSprite(202, 204, 76, 44, TEX.waterfallDashes)
      .setOrigin(0)
      .setTint(P.waterMid)
      .setAlpha(0.55);
    this.fallsDashes = this.add.tileSprite(202, 204, 76, 44, TEX.waterfallDashes).setOrigin(0).setAlpha(0.95);
    // soft luminous sheet over the water (moonlight through spray)
    this.add
      .image(240, 224, TEX.glow8)
      .setTint(P.waterPale)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(6.5, 3.4)
      .setAlpha(0.07);
    const lip = this.add.graphics();
    lip.fillStyle(0xffffff, 0.9);
    lip.fillRect(202, 203, 76, 1);
    lip.fillStyle(P.waterPale, 0.55);
    lip.fillRect(202, 204, 76, 2);
    lip.fillStyle(0xffffff, 0.35);
    lip.fillRect(206, 206, 68, 1); // turbulence curl under the lip

    // foam + mist + rippling plunge pool
    const foam = this.add.image(240, 248, TEX.waterFoam).setDisplaySize(76, 8).setAlpha(0.85);
    this.tweens.add({ targets: foam, alpha: { from: 0.65, to: 0.95 }, duration: 900, yoyo: true, repeat: -1 });
    for (const [mx, my, s] of [
      [222, 244, 4],
      [258, 240, 5],
    ] as Array<[number, number, number]>) {
      const mist = this.add.image(mx, my, TEX.glow8).setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setScale(s).setAlpha(0.05);
      this.tweens.add({ targets: mist, alpha: { from: 0.03, to: 0.08 }, duration: 1600 + mx, yoyo: true, repeat: -1 });
    }
    for (const [rx, ry, delay] of [
      [226, 249, 0],
      [252, 251, 700],
      [240, 253, 1400],
    ] as Array<[number, number, number]>) {
      const ripple = this.add.image(rx, ry, TEX.ring).setTint(0xffffff).setAlpha(0).setScale(0.08, 0.03);
      this.tweens.add({
        targets: ripple,
        scaleX: 0.5,
        scaleY: 0.14,
        alpha: { from: 0.35, to: 0 },
        duration: 2100,
        repeat: -1,
        delay,
      });
    }
    // spray motes drifting up off the pool
    for (let i = 0; i < 4; i++) {
      const sprayX = 218 + i * 15;
      const mote = this.add.image(sprayX, 247, TEX.px).setTint(0xffffff).setScale(0.5).setAlpha(0);
      this.tweens.add({
        targets: mote,
        y: 236 - i * 2,
        alpha: { from: 0.5, to: 0 },
        duration: 1300 + i * 240,
        repeat: -1,
        delay: i * 380,
      });
    }
  }

  private buildTown(): void {
    // one continuous street ties both halves together: moonlit curb,
    // asphalt, gutter shadow — with zebra crosswalks at the bridge approaches
    const walk = this.add.graphics();
    walk.fillStyle(0x1d222e, 1);
    walk.fillRect(0, STREET_Y - 2, VIEW_W, 6); // asphalt
    walk.fillStyle(0x6a7690, 1);
    walk.fillRect(0, STREET_Y - 2, VIEW_W, 1); // curb catch-light
    walk.fillStyle(0x0b0e16, 0.8);
    walk.fillRect(0, STREET_Y + 3, VIEW_W, 1); // gutter
    for (const cx of [86, 386]) {
      for (let sx = cx - 12; sx <= cx + 12; sx += 4) {
        walk.fillStyle(0xd8d2c2, 0.5);
        walk.fillRect(sx, STREET_Y - 1, 2, 4); // zebra stripes
      }
    }

    // LEFT block — brick storefront row
    this.add.image(23, STREET_Y, TEX.brickA).setOrigin(0.5, 1);
    this.add.image(66, STREET_Y, TEX.brickB).setOrigin(0.5, 1);
    this.add.image(108, STREET_Y, TEX.brickC).setOrigin(0.5, 1);
    this.add.image(148, STREET_Y, TEX.brickD).setOrigin(0.5, 1);

    // RIGHT block — brick neighbors + the Sweet & Salty corner store.
    // Reused facades get a flip + subtle tint so no two buildings read identical.
    this.add.image(334, STREET_Y, TEX.brickC).setOrigin(0.5, 1).setFlipX(true).setTint(0xe2d6c8);
    this.add.image(441, STREET_Y, TEX.brickA).setOrigin(0.5, 1).setFlipX(true).setTint(0xd8cfc6);
    this.add.image(474, STREET_Y, TEX.brickB).setOrigin(0.5, 1).setTint(0xe8e0d4);
    this.add.image(387, STREET_Y, TEX.shopFront).setOrigin(0.5, 1);

    // flags catching the night breeze
    for (const [fx, fy] of [
      [100, 111],
      [412, 137],
    ] as Array<[number, number]>) {
      this.add.rectangle(fx - 1, fy + 3, 1, 7, P.hairDark).setOrigin(0.5, 1);
      const flag = this.add.image(fx + 3, fy, TEX.flagUs).setOrigin(0.5);
      this.tweens.add({ targets: flag, scaleX: { from: 1, to: 0.85 }, duration: 900 + fx, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // the bridge spans the gorge, deck level with the street
    this.add.image(240, 202, TEX.bridgeSpan); // 184×36 → x148..332, y184..220

    // street trees soften the seams where blocks meet the bridge
    this.add.image(12, STREET_Y + 2, TEX.roundTree).setOrigin(0.5, 1);
    this.add.image(153, STREET_Y + 1, TEX.roundTree).setOrigin(0.5, 1).setScale(0.8);
    this.add.image(327, STREET_Y + 1, TEX.roundTree).setOrigin(0.5, 1).setScale(0.86).setFlipX(true);
    this.add.image(468, STREET_Y + 2, TEX.roundTree).setOrigin(0.5, 1).setFlipX(true);

    // ambient occlusion: buildings sit INTO the street, not on top of it
    const ao = this.add.graphics();
    ao.fillStyle(0x000000, 0.22);
    ao.fillRect(0, STREET_Y - 2, 148, 3);
    ao.fillRect(332, STREET_Y - 2, VIEW_W - 332, 3);

    // street lamps — on the blocks and on the bridge itself
    const lamps: Array<[number, number]> = [
      [40, STREET_Y],
      [124, STREET_Y],
      [364, STREET_Y],
      [452, STREET_Y],
      [172, 192],
      [308, 192],
    ];
    for (const [lx, ly] of lamps) {
      this.add.image(lx, ly, TEX.streetLamp).setOrigin(0.5, 1);
      const glow = this.add
        .image(lx, ly - 27, TEX.glow8)
        .setTint(P.windowLight)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(2.2)
        .setAlpha(0.3);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.24, to: 0.36 },
        duration: 1400 + lx * 3,
        yoyo: true,
        repeat: -1,
      });
      // warm pool of lamplight on the pavement below
      this.add
        .image(lx, ly - 1, TEX.glow8)
        .setTint(P.windowLight)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(3.2, 0.9)
        .setAlpha(0.13);
    }

    // spill from the shop's big display windows onto the sidewalk
    this.add
      .image(387, STREET_Y - 1, TEX.glow8)
      .setTint(P.windowCore)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(4.2, 1)
      .setAlpha(0.1);

    // string lights under the Sweet & Salty awning
    for (let i = 0; i < 6; i++) {
      const bulb = this.add
        .image(363 + i * 9, 172, TEX.px)
        .setTint(P.windowCore)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.7)
        .setAlpha(0.8);
      this.tweens.add({
        targets: bulb,
        alpha: { from: 0.45, to: 0.95 },
        duration: 700 + i * 130,
        yoyo: true,
        repeat: -1,
      });
    }

    // warm interior BLOOM over each storefront's window band — the biggest
    // "premium lit-town" lever. Soft, additive, low-alpha; a few flicker.
    const blooms: Array<[number, number, number, number, boolean]> = [
      // x, y, scaleX, alpha, flicker
      [23, 152, 3.4, 0.13, true],
      [66, 158, 3.0, 0.1, false],
      [108, 146, 3.4, 0.13, true],
      [148, 168, 2.8, 0.1, false],
      [334, 148, 3.4, 0.12, false],
      [387, 168, 4.2, 0.16, true],
      [441, 156, 3.0, 0.11, true],
      [474, 162, 2.8, 0.1, false],
    ];
    for (const [bx, by, bs, ba, flick] of blooms) {
      const glow = this.add
        .image(bx, by, TEX.glow8)
        .setTint(P.windowLight)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(bs, bs * 1.5)
        .setAlpha(ba);
      if (flick) this.tweens.add({ targets: glow, alpha: { from: ba * 0.72, to: ba }, duration: 1900 + bx * 5, yoyo: true, repeat: -1 });
    }
  }

  private buildForeground(): void {
    const g = this.add.graphics();
    // riverside ledges (walkways) in both lower corners
    for (const [x0, x1] of [
      [0, 140],
      [340, VIEW_W],
    ] as Array<[number, number]>) {
      g.fillStyle(P.bluestone, 1);
      g.fillRect(x0, 236, x1 - x0, 4);
      g.fillStyle(0x6a7690, 1);
      g.fillRect(x0, 236, x1 - x0, 1);
      g.fillStyle(0x161b2a, 1);
      g.fillRect(x0, 240, x1 - x0, VIEW_H - 240);
    }

    // ---- the Five Signal Scouts, shoulder to shoulder, watching the falls ----
    // Henry (11, tall), Cam + Chip (9), Will (smaller Chip), Danny (7, capped)
    for (const scout of MENU_SCOUTS) {
      const kx = scout.x;
      this.add.ellipse(kx, 237, 10, 2, 0x000000, 0.3);
      const kid = this.add.image(kx, 237, scout.tex).setOrigin(0.5, 1);
      const hit = this.add.rectangle(kx, 224, 16, 30, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => kid.setTint(0xfff3c9));
      hit.on('pointerout', () => kid.clearTint());
      hit.on('pointerup', () => {
        kid.clearTint();
        bus.emit(EVT.scoutPortrait, { id: scout.id, name: scout.name, color: scout.color });
      });
    }
    // Will's homemade radio: a lime blink at his hand, answering the probe
    const radio = this.add.image(91, 229, TEX.px).setTint(P.signal).setScale(0.7);
    this.tweens.add({ targets: radio, alpha: { from: 1, to: 0.15 }, duration: 700, yoyo: true, repeat: -1 });

    // iron railings along both ledges (drawn after the kids → they lean on it)
    for (let rx = 8; rx < 136; rx += 32) this.add.image(rx + 16, 241, TEX.railing).setOrigin(0.5, 1);
    for (let rx = 344; rx < 472; rx += 32) this.add.image(rx + 16, 241, TEX.railing).setOrigin(0.5, 1);

    // shrubs + tiny flower boxes
    this.add.image(8, 237, TEX.bushSmall).setOrigin(0.5, 1);
    this.add.image(126, 238, TEX.bushSmall).setOrigin(0.5, 1).setScale(0.8);
    this.add.image(354, 238, TEX.bushSmall).setOrigin(0.5, 1);
    this.add.image(470, 237, TEX.bushSmall).setOrigin(0.5, 1).setFlipX(true);
    const flowers = this.add.graphics();
    for (const [fx, fy] of [
      [352, 233],
      [357, 234],
      [468, 232],
      [472, 233],
      [6, 232],
    ] as Array<[number, number]>) {
      flowers.fillStyle(fx % 2 ? P.shopRed : P.scoutCameron, 0.9);
      flowers.fillRect(fx, fy, 1, 1);
    }

    this.addMenuCat(372, 236, 'black');
    this.addMenuCat(430, 236, 'spotted');

    // fireflies over the water and along the ledges
    for (let i = 0; i < 10; i++) {
      const fx = 130 + Math.random() * 220;
      const fy = 210 + Math.random() * 50;
      const fly = this.add
        .image(fx, fy, TEX.glow8)
        .setTint(P.windowLight)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.6 + Math.random() * 0.5)
        .setAlpha(0.4);
      this.tweens.add({
        targets: fly,
        x: fx + (Math.random() * 22 - 11),
        y: fy - (3 + Math.random() * 9),
        alpha: { from: 0.1 + Math.random() * 0.2, to: 0.55 },
        duration: 1700 + Math.random() * 1900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1600,
      });
    }
  }

  private addMenuCat(x: number, groundY: number, variant: 'black' | 'spotted'): void {
    const g = this.add.graphics().setDepth(12);
    const black = 0x04050a;
    const blackLit = 0x20243a;
    const white = 0xf0ead9;
    const whiteShade = 0xc8bea7;
    const outline = 0x251d18;
    const amber = 0xffd36a;
    const eyeGreen = 0xb8ff5f;
    const scale = 0.58;
    const sx = (dx: number) => x + dx * scale;
    const sy = (dy: number) => groundY + dy * scale;
    const ss = (v: number) => v * scale;
    const ell = (dx: number, dy: number, w: number, h: number, color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillEllipse(sx(dx), sy(dy), ss(w), ss(h));
    };
    const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillTriangle(sx(ax), sy(ay), sx(bx), sy(by), sx(cx), sy(cy));
    };
    const line = (width: number, color: number, points: Array<[number, number]>, alpha = 1) => {
      g.lineStyle(ss(width), color, alpha);
      g.beginPath();
      g.moveTo(sx(points[0][0]), sy(points[0][1]));
      for (let i = 1; i < points.length; i++) {
        g.lineTo(sx(points[i][0]), sy(points[i][1]));
      }
      g.strokePath();
    };

    ell(1, 1, 34, 4, 0x000000, 0.25);

    if (variant === 'black') {
      // Smooth seated black cat with a connected tail.
      line(5, blackLit, [
        [-3, -8],
        [-13, -8],
        [-19, -12],
        [-16, -18],
        [-10, -18],
      ], 0.9);
      line(4, black, [
        [-4, -7],
        [-13, -7],
        [-17, -11],
        [-15, -15],
        [-10, -15],
      ]);
      ell(-4, -9, 18, 18, blackLit, 0.92);
      ell(6, -14, 12, 19, blackLit, 0.92);
      ell(10, -25, 13, 11, blackLit, 0.95);
      tri(5, -28, 8, -36, 11, -28, blackLit, 0.95);
      tri(13, -28, 18, -35, 18, -27, blackLit, 0.95);
      ell(-3, -8, 15, 16, black);
      ell(7, -13, 9, 17, black);
      ell(11, -25, 11, 9, black);
      tri(6, -28, 8, -34, 10, -28, black);
      tri(14, -28, 17, -33, 17, -27, black);
      line(2, blackLit, [
        [5, -9],
        [5, -1],
      ], 0.85);
      ell(-5, 0, 7, 2, blackLit, 0.95);
      ell(9, 0, 7, 2, blackLit, 0.95);
      ell(14, -25, 1.4, 1.1, amber);
    } else {
      // Smooth low side-profile white cat with two body spots.
      line(4, outline, [
        [-11, -10],
        [-20, -13],
        [-18, -19],
      ], 0.85);
      ell(-3, -12, 26, 12, outline, 0.9);
      ell(12, -17, 13, 10, outline, 0.95);
      tri(7, -20, 10, -27, 13, -20, outline, 0.95);
      tri(14, -20, 18, -26, 19, -19, outline, 0.95);
      line(3, outline, [
        [-10, -6],
        [-10, -1],
      ], 0.9);
      line(3, outline, [
        [0, -6],
        [0, -1],
      ], 0.9);
      line(3, outline, [
        [9, -6],
        [9, -1],
      ], 0.9);

      line(3, white, [
        [-10, -10],
        [-18, -13],
        [-16, -17],
      ]);
      ell(-3, -12, 23, 10, white);
      ell(12, -17, 11, 8, white);
      tri(8, -20, 10, -25, 12, -20, white);
      tri(14, -20, 17, -24, 18, -20, white);
      line(2, white, [
        [-10, -6],
        [-10, -1],
      ]);
      line(2, white, [
        [0, -6],
        [0, -1],
      ]);
      line(2, white, [
        [9, -6],
        [9, -1],
      ]);
      ell(-10, 0, 6, 2, whiteShade);
      ell(0, 0, 6, 2, whiteShade);
      ell(9, 0, 6, 2, whiteShade);

      ell(-6, -14, 10, 7, black);
      ell(3, -12, 5, 4, black);
      ell(15, -18, 4, 2.6, outline);
      ell(15, -18, 2.2, 1.4, eyeGreen);
      ell(18, -15, 1.3, 1, 0x8f6a60);
      line(1, whiteShade, [
        [14, -13],
        [17, -13],
      ], 0.9);
    }
  }

  /** cohesion pass: a warm ambient wash over the town + a gentle edge vignette
   *  that frames the composition toward the center (a premium title-screen look). */
  private buildAtmosphere(): void {
    // warm ambient wash low over the street — ties the lit town together
    this.add
      .image(CX, STREET_Y + 6, TEX.glow8)
      .setTint(0xffd08a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(30, 5)
      .setAlpha(0.06)
      .setDepth(18);

    // edge + bottom vignette (dark, fading inward) — focuses the eye center
    const vig = this.add.graphics().setDepth(19);
    const D = 0x04060d;
    vig.fillGradientStyle(D, D, D, D, 0.5, 0, 0.5, 0);
    vig.fillRect(0, 0, 110, VIEW_H); // left
    vig.fillGradientStyle(D, D, D, D, 0, 0.5, 0, 0.5);
    vig.fillRect(VIEW_W - 110, 0, 110, VIEW_H); // right
    vig.fillGradientStyle(D, D, D, D, 0, 0, 0.5, 0.5);
    vig.fillRect(0, VIEW_H - 40, VIEW_W, 40); // bottom
    vig.fillGradientStyle(D, D, D, D, 0.32, 0.32, 0, 0);
    vig.fillRect(0, 0, VIEW_W, 30); // top (settles the sky behind the logo)
  }

  /* --------------------------------- flow ----------------------------------- */

  /** public for the Test API + shell menu */
  startGame(continueRun: boolean): void {
    if (this.starting) return;
    this.starting = true;
    if (!continueRun) {
      resetSave();
      updateSave((s) => {
        s.flags.introSweepCleared = false;
        s.currentZone = 'miller-field';
        s.currentQuest = 'the-first-contact';
        s.questStep = 'wake';
      });
    }
    // Continue drops you into whichever zone the save is in. A FRESH START does the
    // canon cold-open (levelPlans.ts / Command Center): the top-down "Surface" Scan
    // — Area 47 from above — then THE FOLD flips you down into side-view Miller Field.
    quests.load(getSave().currentQuest);
    if (!continueRun) quests.restart();
    audio.unlock();
    bus.emit(EVT.menuActive, { active: false });
    this.cameras.main.fadeOut(350, 7, 17, 38);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (continueRun) {
        const save = getSave();
        if (!save.flags.introSweepCleared) {
          this.registry.set('sweepReturnScene', SCENES.field);
          this.registry.set('sweepArenaId', 'surface-z1');
          this.scene.start(SCENES.sweep);
          return;
        }
        const zone = save.currentZone;
        this.scene.start(ZONE_ROUTES[zone]?.scene ?? SCENES.field);
        return;
      }
      // cold-open: the surface-z1 traverse Scan → reach the Breach → Fold → Miller Field
      this.registry.set('sweepReturnScene', SCENES.field);
      this.registry.set('sweepArenaId', 'surface-z1');
      this.scene.start(SCENES.sweep);
    });
  }

  /** a brief streak across the upper sky, then a long quiet wait */
  private scheduleShootingStar(): void {
    this.time.delayedCall(6000 + Math.random() * 12000, () => {
      if (!this.scene.isActive()) return;
      const sx = 80 + Math.random() * 300;
      const sy = 12 + Math.random() * 40;
      const star = this.add.image(sx, sy, TEX.px).setTint(0xffffff).setAlpha(0.9).setScale(1, 0.5);
      const trail = this.add.image(sx - 5, sy - 2, TEX.px).setTint(P.waterPale).setAlpha(0.4).setScale(2.4, 0.4);
      this.tweens.add({
        targets: [star, trail],
        x: '+=64',
        y: '+=16',
        alpha: 0,
        duration: 650,
        ease: 'Quad.easeOut',
        onComplete: () => {
          star.destroy();
          trail.destroy();
        },
      });
      this.scheduleShootingStar();
    });
  }

  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    // the falls flow DOWNWARD (negative scroll moves the pattern down-screen);
    // the river shimmers; clouds drift
    this.fallsBase.tilePositionY -= dt * 16;
    this.fallsMid.tilePositionY -= dt * 27;
    this.fallsDashes.tilePositionY -= dt * 46;
    this.river.tilePositionX += dt * 6;
    this.clouds.tilePositionX += dt * 0.8;
  }
}
