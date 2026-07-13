/**
 * THE SWEEP — BLIP's top-down combat mode (the Interpretation Engine's SCAN of you).
 * Two modes (data-driven, see data/sweepArenas.ts):
 *  - 'traverse': ROAM an open space (camera follows), fight through drones, reach the
 *    BREACH → the Fold carries you onward. This is the core hybrid beat (Z1 cold-open,
 *    Z2 circuit).
 *  - 'waves': hold against escalating waves (F7 dev warp / future run mode).
 * Isolated scene (own physics world, gravity 0). Aim with the mouse (or right stick),
 * fire yourself. Tuning in config.SWEEP.
 */
import Phaser from 'phaser';
import { EVT, PALETTE as P, RENDER_ZOOM, SCENES, SWEEP, SWEEP_BOSS, SWEEP_ELITE, TEX, css, type SweepEnemyKind } from '../config';
import { buildSweepTextures } from '../art/sweepTextures';
import { BlipCraft } from '../entities/sweep/BlipCraft';
import { SweepEnemy } from '../entities/sweep/SweepEnemy';
import { Projectile, fireFrom, makeProjectileGroup } from '../entities/Projectile';
import { DEFAULT_ARENA, SWEEP_ARENAS, type SweepArena } from '../data/sweepArenas';
import { WEAPONS, WEAPON_PICKUPS, type SweepWeapon } from '../data/sweepWeapons';
import { audio } from '../systems/AudioSystem';
import { bus } from '../systems/EventBus';
import { touchInput } from '../systems/TouchInput';
import { EffectsSystem } from '../systems/EffectsSystem';
import { FOLD_FLAG, foldCollapse } from '../systems/FoldTransition';
import { PlayerInput } from '../systems/InputSystem';
import { readPad } from '../systems/PadSim';
import { addShards, updateSave } from '../systems/SaveSystem';
import { activeSkin } from '../systems/SkinState';
import { uiOverlayActive } from '../systems/UIState';

type PickupType = 'health' | 'weapon' | 'boon';

const SCOUT_TINT: Record<string, number> = {
  will: P.scoutWill,
  chip: P.scoutChip,
  henry: P.scoutHenry,
  cameron: P.scoutCameron,
  danny: P.scoutDanny,
};

/** shortest distance from point (px,py) to segment (ax,ay)-(bx,by) */
function pointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Phaser.Math.Clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export class SweepScene extends Phaser.Scene {
  private player!: BlipCraft;
  private input2!: PlayerInput;
  private fx!: EffectsSystem;
  private playerShots!: Phaser.Physics.Arcade.Group;
  private enemyShots!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private reticle!: Phaser.GameObjects.Image;

  private arena!: SweepArena;
  private traverse = false;
  private breachPos = { x: 0, y: 0 };
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private floorTiles: Array<{ x: number; y: number }> = [];
  private mapW = 0;
  private mapH = 0;
  private nodePos = { x: 0, y: 0 };
  private nodeCharge = 0;
  private chargeTarget = 100;
  private breachOpen = false;
  private breachGlow?: Phaser.GameObjects.Image;
  private breachCore?: Phaser.GameObjects.Image;
  private breachLabel?: Phaser.GameObjects.Text;

  private waveIdx = -1;
  private spawnQueue: SweepEnemyKind[] = [];
  private spawnInterval = 0.6;
  private spawnAt = 0;
  private waveActive = false;
  private awaitingWave = false;
  private nextWaveAt = 0;

  private heat = 0;
  private combo = 0;
  private comboUntil = 0;
  private overdrive = 0;
  private odActive = false;
  private odUntil = 0;
  private hudAt = 0;
  private shardsEarned = 0;
  private killCount = 0;
  private fireAt = 0;
  private shotCount = 0;
  private weapon: SweepWeapon = WEAPONS.pulse;
  private boonScanMul = 1; // WILLOW boon
  private boonFireMul = 1; // ROCKET boon
  private caches: Phaser.GameObjects.Image[] = [];
  private elite?: SweepEnemy;
  private eliteAura?: Phaser.GameObjects.Image;
  private eliteBeam?: Phaser.GameObjects.Graphics;
  private eliteState: 'idle' | 'charge' | 'fire' = 'idle';
  private eliteStateAt = 0;
  private eliteAngle = 0;
  // the Classifier beam is shared by the mini-elite AND the finale boss (different tuning)
  private eliteCfg: typeof SWEEP_ELITE | typeof SWEEP_BOSS = SWEEP_ELITE;
  private nodeFull = false; // Node fully charged (gates the boss-finale trigger once)
  private bossActive = false; // the Maze Heart is alive and gating the breach
  private bossAddsSpawned = false; // one-time reinforcement wave fired

  private exiting = false;
  private gameOverShown = false;
  private isPaused = false;
  private debugEmitAt = 0;
  private unsubs: Array<() => void> = [];

  constructor() {
    super(SCENES.sweep);
  }

  create(): void {
    buildSweepTextures(this);
    this.fx = new EffectsSystem(this);
    this.input2 = new PlayerInput(this);
    this.heat = 0;
    this.combo = 0;
    this.overdrive = 0;
    this.odActive = false;
    this.odUntil = 0;
    this.hudAt = 0;
    this.shardsEarned = 0;
    this.killCount = 0;
    this.waveIdx = -1;
    this.shotCount = 0;
    this.waveActive = false;
    this.awaitingWave = false;
    this.exiting = false;
    this.gameOverShown = false;
    this.isPaused = false;
    this.weapon = WEAPONS.pulse;
    this.boonScanMul = 1;
    this.boonFireMul = 1;
    this.caches = [];
    this.elite = undefined;
    this.eliteAura = undefined;
    this.eliteBeam = undefined;
    this.eliteState = 'idle';
    this.eliteCfg = SWEEP_ELITE;
    this.nodeFull = false;
    this.bossActive = false;
    this.bossAddsSpawned = false;

    const id = (this.registry.get('sweepArenaId') as string) ?? DEFAULT_ARENA;
    this.arena = SWEEP_ARENAS[id] ?? SWEEP_ARENAS[DEFAULT_ARENA];
    this.traverse = this.arena.mode === 'traverse';

    const T = SWEEP.tile;
    const AW = this.arena.grid.w * T;
    const AH = this.arena.grid.h * T;
    this.mapW = AW;
    this.mapH = AH;

    // markers → world positions (tile centre)
    this.nodePos = { x: (this.arena.node.tx + 0.5) * T, y: (this.arena.node.ty + 0.5) * T };
    this.nodeCharge = 0;
    this.chargeTarget = this.arena.chargeTarget ?? SWEEP.nodeChargeDefault;
    this.breachOpen = !this.traverse; // waves mode has no node gate

    this.cameras.main.setBackgroundColor(
      this.arena.biome === 'motel' ? '#080810' : this.arena.biome === 'orchard' ? '#0e0a16' : '#08130d'
    );
    const coarsePointer = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    this.cameras.main.setZoom(RENDER_ZOOM * (coarsePointer ? SWEEP.touchCameraZoom : SWEEP.cameraZoom));
    this.cameras.main.setBounds(0, 0, AW, AH);

    this.physics.world.gravity.y = 0;
    this.physics.world.setBounds(0, 0, AW, AH);

    this.walls = this.physics.add.staticGroup();
    this.buildMap(); // carves rooms/halls, builds floor + solid walls + floorTiles

    this.playerShots = makeProjectileGroup(this, TEX.sweepShotP, SWEEP.maxShots);
    this.enemyShots = makeProjectileGroup(this, TEX.sweepShotE, 72); // headroom for PYLON radial volleys
    this.enemies = this.physics.add.group();
    this.pickups = this.physics.add.group();

    const spawnX = (this.arena.spawn.tx + 0.5) * T;
    const spawnY = (this.arena.spawn.ty + 0.5) * T;
    this.player = new BlipCraft(this, spawnX, spawnY, this.fx);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.cameras.main.startFollow(this.player, true, 0.16, 0.16);

    this.reticle = this.add.image(spawnX, spawnY - 40, TEX.sweepReticle).setDepth(30).setTint(P.signal).setAlpha(0.9);

    // walls stop the player, the drones, and every bolt
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.playerShots, this.walls, (b) => this.onShotHitWall(b as Projectile));
    this.physics.add.collider(this.enemyShots, this.walls, (b) => (b as Projectile).kill());

    this.physics.add.overlap(this.playerShots, this.enemies, (shot, en) =>
      this.onShotHitEnemy(shot as Projectile, en as SweepEnemy)
    );
    // NOTE: sprite must be arg1 — Phaser's collideSpriteVsGroup always calls the
    // callback as (sprite, groupChild), so passing the group first hands you the
    // PLAYER as `bolt` and player.kill() throws every frame → hard freeze.
    this.physics.add.overlap(this.player, this.enemyShots, (_pl, bolt) => this.onEnemyBoltHit(bolt as Projectile));
    this.physics.add.overlap(this.player, this.enemies, (_pl, en) => this.onTouch(en as SweepEnemy));
    this.physics.add.overlap(this.player, this.pickups, (_pl, pk) => this.onPickup(pk as Phaser.Physics.Arcade.Image));

    bus.emit(EVT.sceneChanged, { scene: SCENES.sweep, zone: this.arena.label });
    bus.emit(EVT.hudHp, { hp: this.player.hp, max: this.player.maxHp });
    audio.playMusic('blipstream');
    const uiWasActive = this.scene.isActive(SCENES.ui);
    if (!uiWasActive) this.scene.launch(SCENES.ui);
    const enterHud = () => {
      bus.emit(EVT.hudSweep, { active: true }); // switch the HUD into top-down combat mode
      bus.emit(EVT.hudHp, { hp: this.player.hp, max: this.player.maxHp });
      this.emitHudStats();
    };
    enterHud();
    // a cold-open launches UIScene fresh (its listeners aren't up yet) — re-emit once it's created
    if (!uiWasActive) this.time.delayedCall(40, enterHud);

    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.unsubs.push(bus.on(EVT.uiResume, () => this.setPaused(false)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    if (this.traverse) {
      this.buildBreach();
      this.buildCaches();
      this.seedEnemies();
      this.seedWeaponPickups();
      if (this.arena.elite) this.spawnElite();
      // "surfaced" intro — a scan bloom + objective
      this.cameras.main.fadeIn(350, 2, 3, 8);
      this.fx.scanRing(this.player.x, this.player.y, 200, 620, P.signal);
      bus.emit(EVT.toast, { text: 'SIGNAL SURFACED — CHARGE THE NODE ◎', color: 'green' });
      this.showBanner('CHARGE THE SIGNAL NODE');
    } else {
      bus.emit(EVT.toast, { text: 'RENDER ACTIVE — MOUSE AIMS · CLICK FIRES', color: 'green' });
      this.cameras.main.fadeIn(350, 2, 3, 8);
      this.startNextWave();
    }
  }

  /** Build the authored map into a layered, atmospheric arena: base ground, tonal
   *  patches, worn dirt paths, decals, solid walls, clustered props, lighting,
   *  drifting motes and foreground framing. Fills floorTiles. */
  private buildMap(): void {
    const T = SWEEP.tile;
    const W = this.arena.grid.w;
    const H = this.arena.grid.h;
    const motel = this.arena.biome === 'motel';
    const orchard = this.arena.biome === 'orchard';
    const groundTex = motel ? TEX.sweepAsphalt : orchard ? TEX.sweepCornGround : TEX.sweepGrass;
    const wallTex = motel ? TEX.sweepWallMotel : orchard ? TEX.sweepCornWall : TEX.sweepHedge;
    const glowTint = motel ? P.neonCyan : orchard ? P.cropGlow : P.signalGreen;
    const AW = W * T;
    const AH = H * T;
    const node = this.nodePos;

    // 1 — base ground
    this.add.tileSprite(0, 0, AW, AH, groundTex).setOrigin(0).setDepth(0);

    // carve floor from rooms + halls
    const solid: boolean[][] = Array.from({ length: H }, () => new Array<boolean>(W).fill(true));
    const carve = (r: { x: number; y: number; w: number; h: number }) => {
      for (let ty = r.y; ty < r.y + r.h && ty < H; ty++)
        for (let tx = r.x; tx < r.x + r.w && tx < W; tx++) if (tx >= 0 && ty >= 0) solid[ty][tx] = false;
    };
    this.arena.rooms.forEach(carve);
    this.arena.halls.forEach(carve);

    // floor tile lists (world centres + tile coords + wall-adjacency)
    this.floorTiles = [];
    const floorCoords: Array<{ tx: number; ty: number; edge: boolean }> = [];
    for (let ty = 0; ty < H; ty++)
      for (let tx = 0; tx < W; tx++) {
        if (solid[ty][tx]) continue;
        this.floorTiles.push({ x: (tx + 0.5) * T, y: (ty + 0.5) * T });
        const edge =
          ty === 0 || tx === 0 || ty === H - 1 || tx === W - 1 ||
          solid[ty - 1]?.[tx] || solid[ty + 1]?.[tx] || solid[ty][tx - 1] || solid[ty][tx + 1];
        floorCoords.push({ tx, ty, edge: !!edge });
      }
    const near = (tx: number, ty: number, m: { tx: number; ty: number }, d: number) =>
      Math.abs(tx - m.tx) + Math.abs(ty - m.ty) < d;
    const keyMarkers = [this.arena.spawn, this.arena.node, this.arena.breach].filter(Boolean) as Array<{ tx: number; ty: number }>;
    const clearOf = (tx: number, ty: number, d = 2) => !keyMarkers.some((m) => near(tx, ty, m, d));

    // 2 — tonal ground patches (lit + shadow) so it never reads as one flat field
    const patch = (tex: string, alpha: number, count: number, wt: number, ht: number) => {
      for (let i = 0; i < count && floorCoords.length; i++) {
        const p = floorCoords[Phaser.Math.Between(0, floorCoords.length - 1)];
        this.add.tileSprite((p.tx + 0.5) * T, (p.ty + 0.5) * T, wt * T, ht * T, tex).setDepth(1).setAlpha(alpha);
      }
    };
    if (!motel) {
      patch(TEX.sweepGrass2, 0.5, 5, 3, 2);
      patch(TEX.sweepGrassDk, 0.55, 7, 2, 2);
    } else {
      patch(TEX.sweepGrassDk, 0.35, 6, 2, 2);
    }

    // 3 — worn dirt paths along corridors + a trampled clearing at the node
    this.arena.halls.forEach((h) =>
      this.add.tileSprite(h.x * T, h.y * T, h.w * T, h.h * T, TEX.sweepPath).setOrigin(0).setDepth(1).setAlpha(motel ? 0.5 : 0.8)
    );
    this.add.image(node.x, node.y, TEX.sweepCrop).setDepth(1).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD).setTint(glowTint);
    // No large rectangular path decal here: on phone zoom levels it read as a
    // dark "screen tint" square around the player/node. Use broken-up scuffs.
    for (let i = 0; i < 18; i++) {
      const ox = Phaser.Math.Between(-82, 82);
      const oy = Phaser.Math.Between(-52, 52);
      const scuff = this.add
        .image(node.x + ox, node.y + oy, TEX.sweepPath)
        .setDepth(1)
        .setAlpha(motel ? 0.12 : 0.2)
        .setScale(Phaser.Math.FloatBetween(0.45, 0.85));
      scuff.setAngle(Phaser.Math.Between(0, 3) * 90);
    }

    // 4 — walls (visual tiles + merged collision bodies)
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        if (!solid[y][x]) { x++; continue; }
        const x0 = x;
        while (x < W && solid[y][x]) x++;
        const ww = (x - x0) * T;
        this.add.tileSprite(x0 * T, y * T, ww, T, wallTex).setOrigin(0, 0).setDepth(7);
        const wall = this.walls.create(x0 * T + ww / 2, y * T + T / 2, TEX.px) as Phaser.Physics.Arcade.Image;
        wall.setDisplaySize(ww, T).setVisible(false).refreshBody();
      }
    }

    // 5 — decals in deliberate clusters (life + wear), biased to edges
    const decals = motel
      ? [TEX.sweepScrap, TEX.sweepPebbles, TEX.sweepContam]
      : [TEX.sweepFlower, TEX.sweepWeed, TEX.sweepPebbles, TEX.sweepScrap, TEX.sweepContam];
    for (let c = 0; c < 11 && floorCoords.length; c++) {
      const base = Phaser.Utils.Array.GetRandom(floorCoords.filter((p) => (c % 3 === 0 ? true : p.edge)) as typeof floorCoords) ?? floorCoords[0];
      const n = Phaser.Math.Between(2, 4);
      for (let i = 0; i < n; i++) {
        const dx = (base.tx + 0.5) * T + Phaser.Math.Between(-18, 18);
        const dy = (base.ty + 0.5) * T + Phaser.Math.Between(-14, 14);
        const tex = Phaser.Utils.Array.GetRandom(decals);
        const dec = this.add.image(dx, dy, tex).setDepth(2);
        if (tex === TEX.sweepContam) dec.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
      }
    }

    // 6 — clustered props on wall-adjacent floor (frames the space; combat lanes stay open)
    const propPool = motel ? [TEX.sweepCrate, TEX.sweepRock, TEX.sweepScrap] : [TEX.sweepBush, TEX.sweepRock, TEX.sweepLog, TEX.sweepBush];
    const edges = floorCoords.filter((p) => p.edge && clearOf(p.tx, p.ty, 3));
    Phaser.Utils.Array.Shuffle(edges);
    for (let i = 0; i < Math.min(14, edges.length); i++) {
      const p = edges[i];
      this.add.image((p.tx + 0.5) * T + Phaser.Math.Between(-6, 6), (p.ty + 0.5) * T - 2, Phaser.Utils.Array.GetRandom(propPool)).setDepth(6);
    }
    // one structural landmark near a corner
    const corner = floorCoords.find((p) => p.tx > W * 0.62 && p.ty > H * 0.6 && clearOf(p.tx, p.ty, 3));
    if (corner && !motel) this.add.image((corner.tx + 0.5) * T, (corner.ty + 0.5) * T, TEX.sweepBunker).setDepth(6);

    // 7 — node landmark + light pool + biome tower/sign
    const nodeGlow = this.add.image(node.x, node.y, TEX.glow8).setDepth(9).setTint(glowTint).setBlendMode(Phaser.BlendModes.ADD).setScale(7).setAlpha(0.35);
    this.tweens.add({ targets: nodeGlow, scale: { from: 6, to: 8.5 }, alpha: { from: 0.28, to: 0.5 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.image(node.x, node.y, TEX.sweepNode).setDepth(8).setTint(motel ? P.neonCyan : 0xffffff);
    const beacon = motel ? this.add.image(node.x, node.y - 30, TEX.sweepNeonSign) : this.add.image(node.x, node.y - 28, TEX.sweepTower);
    beacon.setOrigin(0.5, 1).setDepth(8);
    const beaconGlow = this.add.image(beacon.x, beacon.y - beacon.height + 4, TEX.glow8).setDepth(9).setTint(P.danger).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setAlpha(0.5);
    this.tweens.add({ targets: beaconGlow, alpha: { from: 0.2, to: 0.7 }, duration: 620, yoyo: true, repeat: -1 });

    // 8 — drifting signal motes / fireflies (atmosphere)
    for (let i = 0; i < 14; i++) {
      const mx = Phaser.Math.Between(30, AW - 30);
      const my = Phaser.Math.Between(30, AH - 30);
      const mote = this.add.image(mx, my, TEX.glow8).setDepth(10).setBlendMode(Phaser.BlendModes.ADD)
        .setTint(i % 4 === 0 ? P.tdFlower : glowTint).setScale(0.28 + Math.random() * 0.3).setAlpha(0.12);
      this.tweens.add({
        targets: mote, x: mx + Phaser.Math.Between(-24, 24), y: my - Phaser.Math.Between(12, 34),
        alpha: { from: 0.08, to: 0.4 }, duration: 2600 + Math.random() * 2600, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: Math.random() * 1800,
      });
    }

    // 9 — foreground framing (dark canopy over the outer edges; never covers combat)
    const frameTex = motel ? TEX.sweepBlock : TEX.sweepBush;
    for (let i = 0; i < 22; i++) {
      const onX = Math.random() < 0.5;
      const fx = onX ? Phaser.Math.Between(0, AW) : Math.random() < 0.5 ? Phaser.Math.Between(0, 24) : Phaser.Math.Between(AW - 24, AW);
      const fy = onX ? (Math.random() < 0.5 ? Phaser.Math.Between(0, 20) : Phaser.Math.Between(AH - 20, AH)) : Phaser.Math.Between(0, AH);
      this.add.image(fx, fy, frameTex).setDepth(31).setTint(P.black).setAlpha(0.5).setScale(1.3);
    }

    // 10 — no fixed vignette in Sweep. With pulled-back/mobile camera zooms a
    // fixed-size overlay can cover only part of the viewport and look broken.
  }

  /* ------------------------------ traverse ------------------------------- */
  private buildBreach(): void {
    const T = SWEEP.tile;
    const m = this.arena.breach ?? { tx: this.arena.grid.w - 2, ty: 2 };
    const bx = (m.tx + 0.5) * T;
    const by = (m.ty + 0.5) * T;
    this.breachPos = { x: bx, y: by };
    // starts DORMANT (grey, no pulse) — charging the Node opens it (openBreach)
    this.breachGlow = this.add.image(bx, by, TEX.glow8).setDepth(11).setTint(P.uiDim).setBlendMode(Phaser.BlendModes.ADD).setScale(6).setAlpha(0.16);
    this.breachCore = this.add.image(bx, by, TEX.sweepNode).setDepth(12).setTint(P.uiDim).setScale(1.15);
    this.breachLabel = this.add
      .text(bx, by - 26, 'BREACH · LOCKED', { fontFamily: 'monospace', fontSize: '7px', fontStyle: 'bold', color: css(P.uiDim) })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(12);
  }

  /** the Node is fully charged — light the breach and let the player Fold onward */
  private openBreach(): void {
    if (this.breachOpen) return;
    this.breachOpen = true;
    audio.doorUnlock();
    this.fx.flash(P.signalGreen, 150);
    this.breachCore?.setTint(P.signal);
    this.breachLabel?.setText('BREACH ▸').setColor(css(P.signal));
    if (this.breachGlow) {
      this.breachGlow.setTint(P.signal).setAlpha(0.4);
      this.tweens.add({ targets: this.breachGlow, scale: { from: 6, to: 9 }, alpha: { from: 0.3, to: 0.6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    bus.emit(EVT.toast, { text: 'NODE CHARGED — BREACH OPEN ▸', color: 'green' });
    this.showBanner('BREACH OPEN — GET OUT');
    // reward system: a Signal Storm was cleared → medal + cache (RewardTriggers)
    bus.emit(EVT.sweepCleared, { combo: this.combo, noHit: this.player.hp >= this.player.maxHp });
    // boss-finale arenas bloom the crop circle when the Node charges (see beginBossFinale),
    // not here — avoid a double bloom.
    if (this.arena.biome === 'orchard' && !this.arena.bossFinale) this.cropBloom();
  }

  /** Zone 4 standout: charging the node blooms the route you traced into a giant
   *  glowing crop circle burned across the corn — "you drew the answer." */
  private cropBloom(): void {
    const { x, y } = this.nodePos;
    this.fx.flash(P.cropGlow, 220);
    this.fx.shake(0.01, 320);
    this.fx.scanRing(x, y, 280, 900, P.cropGlow);
    const glyph = this.add
      .image(x, y, TEX.sweepCrop)
      .setDepth(20)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(P.cropGlow)
      .setAlpha(0)
      .setScale(0.2);
    this.tweens.add({ targets: glyph, scale: 1.7, alpha: 0.7, duration: 900, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: glyph, alpha: 0.35, duration: 1400, delay: 900, yoyo: true, repeat: -1 });
    bus.emit(EVT.toast, { text: 'THE PATTERN BLOOMS — YOU DREW THE ANSWER', color: 'green' });
    this.showBanner('CROP CIRCLE COMPLETE');
  }

  /** charge the Node from a kill (double near the node); opens the breach at target */
  private addNodeCharge(x: number, y: number): void {
    if (!this.traverse || this.breachOpen || this.nodeFull) return;
    const near = Phaser.Math.Distance.Between(x, y, this.nodePos.x, this.nodePos.y) < SWEEP.nodeChargeRadius;
    this.nodeCharge = Math.min(this.chargeTarget, this.nodeCharge + SWEEP.nodeChargePerKill * (near ? 2 : 1));
    if (near) this.fx.floatText(x, y - 6, '+CHARGE', P.signalGreen);
    if (this.nodeCharge >= this.chargeTarget) {
      this.nodeFull = true;
      // FINALE: charging the Node wakes the Maze Heart; the breach stays sealed until it dies.
      if (this.arena.bossFinale) this.beginBossFinale();
      else this.openBreach();
    }
  }

  /** Zone-4 finale — the charged Node wakes the Maze Heart boss; breach gates on its death. */
  private beginBossFinale(): void {
    audio.bossWarning();
    this.fx.flash(P.danger, 200);
    this.fx.shake(0.014, 420);
    if (this.arena.biome === 'orchard') this.cropBloom();
    bus.emit(EVT.toast, { text: 'THE MAZE HEART AWAKENS — DESTROY IT ◎', color: 'orange' });
    this.showBanner('THE MAZE HEART AWAKENS');
    this.breachLabel?.setText('BREACH · SEALED').setColor(css(P.danger));
    this.spawnBoss();
  }

  /** the Maze Heart — an enhanced Classifier construct (reuses the elite beam machinery). */
  private spawnBoss(): void {
    const e = new SweepEnemy(this, this.nodePos.x, this.nodePos.y, 'drifter');
    e.setTexture(TEX.sweepMazeHeart);
    e.hp = SWEEP_BOSS.hp;
    e.maxHp = SWEEP_BOSS.hp;
    e.setDepth(16);
    (e.body as Phaser.Physics.Arcade.Body).setSize(24, 24);
    e.setData('elite', true).setData('boss', true);
    this.eliteAura = this.add.image(e.x, e.y, TEX.glow8).setDepth(15).setTint(P.danger).setBlendMode(Phaser.BlendModes.ADD).setScale(3).setAlpha(0.45);
    this.tweens.add({ targets: this.eliteAura, alpha: { from: 0.3, to: 0.62 }, scale: { from: 2.6, to: 3.4 }, duration: 640, yoyo: true, repeat: -1 });
    this.enemies.add(e);
    this.elite = e;
    this.eliteBeam = this.add.graphics().setDepth(17);
    this.eliteCfg = SWEEP_BOSS;
    this.eliteState = 'idle';
    this.eliteStateAt = this.time.now + SWEEP_BOSS.beamPeriodMs;
    this.bossActive = true;
    this.bossAddsSpawned = false;
  }

  /** the Maze Heart is destroyed — the triumphant climax before the Fold onward. */
  private onBossDefeated(x: number, y: number): void {
    this.bossActive = false;
    this.eliteBeam?.clear();
    // triumphant climax — big shake, a crop-glow flash, layered explosions + a signal ring
    this.fx.flash(P.cropGlow, 260);
    this.fx.shake(0.02, 520);
    for (let i = 0; i < 3; i++)
      this.time.delayedCall(i * 120, () =>
        this.fx.explode(x + Phaser.Math.Between(-24, 24), y + Phaser.Math.Between(-24, 24), i % 2 ? P.warning : P.danger, 22)
      );
    this.fx.scanRing(x, y, 260, 900, P.cropGlow);
    audio.doorUnlock();
    // burst of loot — a fan of weapon pickups + a Scout Boon + a fat one-time shard payout
    for (let i = 0; i < SWEEP_BOSS.lootDrops; i++) {
      const a = (i / SWEEP_BOSS.lootDrops) * Math.PI * 2;
      this.dropWeaponPickup(x + Math.cos(a) * 26, y + Math.sin(a) * 26, Phaser.Utils.Array.GetRandom(WEAPON_PICKUPS), false);
    }
    this.dropBoon(x, y);
    addShards(SWEEP_BOSS.clearShards);
    this.shardsEarned += SWEEP_BOSS.clearShards;
    this.fx.floatText(x, y - 14, `+${SWEEP_BOSS.clearShards} HEART CORE`, P.cropGlow);
    this.revealCaches(this.nodePos.x, this.nodePos.y, 99999); // grant every remaining cache
    bus.emit(EVT.toast, { text: 'THE MAZE HEART FALLS — THE PATTERN IS YOURS', color: 'green' });
    this.showBanner('THE MAZE HEART FALLS');
    this.openBreach(); // now the breach lights → reach it to Fold onward to the Orchard
  }

  /* --------------------------- caches (secrets) -------------------------- */
  private buildCaches(): void {
    const T = SWEEP.tile;
    // hidden caches at authored marker tiles (fallback: a few random floor tiles)
    const marks = this.arena.caches?.length
      ? this.arena.caches.map((m) => ({ x: (m.tx + 0.5) * T, y: (m.ty + 0.5) * T }))
      : Phaser.Utils.Array.Shuffle(this.floorTiles.slice()).slice(0, SWEEP.cacheCount);
    marks.forEach((p) => {
      const c = this.add.image(p.x, p.y, TEX.sweepPickup).setDepth(6).setTint(P.violetGlitch).setAlpha(0).setScale(1.1);
      this.caches.push(c);
    });
  }

  /** Scan reveals + auto-collects nearby hidden caches (double-duty Scan). */
  private revealCaches(x: number, y: number, radius: number): void {
    this.caches.forEach((c) => {
      if (!c.active || c.getData('collected')) return;
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d <= radius) {
        c.setData('collected', true);
        addShards(SWEEP.cacheShards);
        this.shardsEarned += SWEEP.cacheShards;
        this.fx.sparks(c.x, c.y, P.violetGlitch, 10);
        this.fx.floatText(c.x, c.y - 8, `+${SWEEP.cacheShards} CACHE`, P.violetGlitch);
        audio.fragmentPickup();
        this.tweens.add({ targets: c, alpha: 0, scale: 2, duration: 300, onComplete: () => c.destroy() });
      } else if (!c.getData('revealed') && d <= radius * 1.9) {
        c.setData('revealed', true); // graze — a faint glint hints there's more nearby
        c.setAlpha(0.5);
        this.tweens.add({ targets: c, alpha: 0.18, duration: 700, yoyo: true, repeat: -1 });
      }
    });
  }

  /* ------------------------------- boons --------------------------------- */
  private spawnElite(): void {
    // Elite "Classifier" — tanky drone guarding the node; sweeps a telegraphed scan-beam
    // (getting caught spikes heat); drops a guaranteed Scout Boon + shard cache.
    const T = SWEEP.tile;
    const m = this.arena.elite ?? this.arena.node;
    const e = new SweepEnemy(this, (m.tx + 0.5) * T, (m.ty + 0.5) * T, 'drifter');
    e.setTexture(TEX.sweepElite);
    e.hp = SWEEP_ELITE.hp;
    e.maxHp = SWEEP_ELITE.hp;
    e.setDepth(16);
    (e.body as Phaser.Physics.Arcade.Body).setSize(16, 16);
    e.setData('elite', true);
    // menacing threat glow around the elite
    this.eliteAura = this.add.image(e.x, e.y, TEX.glow8).setDepth(15).setTint(P.danger).setBlendMode(Phaser.BlendModes.ADD).setScale(2).setAlpha(0.4);
    this.tweens.add({ targets: this.eliteAura, alpha: { from: 0.25, to: 0.55 }, scale: { from: 1.8, to: 2.4 }, duration: 700, yoyo: true, repeat: -1 });
    this.enemies.add(e);
    this.elite = e;
    this.eliteBeam = this.add.graphics().setDepth(17);
    this.eliteCfg = SWEEP_ELITE;
    this.eliteState = 'idle';
    this.eliteStateAt = this.time.now + SWEEP_ELITE.beamPeriodMs;
  }

  /** the Classifier's telegraphed scan-beam: amber wind-up → red sweep. i-frames gate the hit. */
  private updateElite(now: number): void {
    const e = this.elite;
    const g = this.eliteBeam;
    if (!e || !e.active) {
      g?.clear();
      this.eliteAura?.destroy();
      this.eliteAura = undefined;
      this.elite = undefined;
      this.bossActive = false;
      return;
    }
    this.eliteAura?.setPosition(e.x, e.y);
    // FINALE: below half HP the Maze Heart calls in a one-time reinforcement wave.
    if (this.bossActive && !this.bossAddsSpawned && e.hp <= e.maxHp * SWEEP_BOSS.addsAtHpFrac) {
      this.bossAddsSpawned = true;
      this.spawnBossAdds(e.x, e.y);
    }
    if (!g) return;
    const cfg = this.eliteCfg;
    g.clear();
    const ex = e.x;
    const ey = e.y;
    const a = this.eliteAngle;
    const tx = ex + Math.cos(a) * cfg.beamLength;
    const ty = ey + Math.sin(a) * cfg.beamLength;

    if (this.eliteState === 'idle') {
      if (now >= this.eliteStateAt) {
        this.eliteState = 'charge';
        this.eliteStateAt = now + cfg.beamChargeMs;
        this.eliteAngle = Math.atan2(this.player.y - ey, this.player.x - ex); // lock aim → dodgeable
        audio.bossWarning();
      }
    } else if (this.eliteState === 'charge') {
      const blink = Math.floor(now / 90) % 2 === 0 ? 0.9 : 0.35;
      g.lineStyle(2, P.warning, blink).lineBetween(ex, ey, tx, ty);
      if (now >= this.eliteStateAt) {
        this.eliteState = 'fire';
        this.eliteStateAt = now + cfg.beamActiveMs;
        audio.hazardZap();
      }
    } else {
      g.lineStyle(cfg.beamHalfWidth * 2, P.danger, 0.85).lineBetween(ex, ey, tx, ty);
      g.lineStyle(2, P.white, 0.9).lineBetween(ex, ey, tx, ty);
      if (this.player.alive && !this.player.invulnerable) {
        const d = pointToSegment(this.player.x, this.player.y, ex, ey, tx, ty);
        if (d < cfg.beamHalfWidth + 4) {
          this.heat = Math.min(100, this.heat + cfg.beamHeatOnHit);
          if (this.player.damage(ex, ey)) this.onPlayerHurt();
        }
      }
      if (now >= this.eliteStateAt) {
        this.eliteState = 'idle';
        this.eliteStateAt = now + cfg.beamPeriodMs;
      }
    }
  }

  /** the Maze Heart's mid-fight reinforcement wave — a telegraphed burst of fast drones. */
  private spawnBossAdds(x: number, y: number): void {
    audio.bossWarning();
    this.fx.scanRing(x, y, 120, 480, P.danger);
    bus.emit(EVT.toast, { text: 'THE HEART CALLS ITS SWARM', color: 'orange' });
    SWEEP_BOSS.addsKinds.forEach((kind, i) => {
      const a = (i / SWEEP_BOSS.addsKinds.length) * Math.PI * 2 + Math.random();
      const sx = x + Math.cos(a) * 34;
      const sy = y + Math.sin(a) * 34;
      this.fx.sparks(sx, sy, P.danger, 6);
      this.enemies.add(new SweepEnemy(this, sx, sy, kind as SweepEnemyKind));
    });
  }

  private dropBoon(x: number, y: number): void {
    const scout = Phaser.Utils.Array.GetRandom(['will', 'chip', 'henry', 'cameron', 'danny']);
    const pk = this.pickups.create(x, y, TEX.sweepPickup) as Phaser.Physics.Arcade.Image;
    pk.setTint(SCOUT_TINT[scout]).setScale(1.7).setDepth(12).setData('ptype', 'boon').setData('scout', scout);
    (pk.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.tweens.add({ targets: pk, scale: { from: 1.4, to: 2 }, duration: 520, yoyo: true, repeat: -1 });
    this.time.delayedCall(12000, () => pk.active && pk.destroy());
  }

  private applyBoon(scout: string): void {
    const p = this.player;
    switch (scout) {
      case 'will':
        this.boonScanMul *= SWEEP.boonScanMul;
        this.revealCaches(this.nodePos.x, this.nodePos.y, 99999);
        this.fx.floatText(p.x, p.y - 10, 'WILLOW', P.scoutWill);
        bus.emit(EVT.toast, { text: 'WILLOW — “I marked the whole field for you.”', color: 'cyan' });
        break;
      case 'chip':
        this.setWeapon(WEAPONS.repeater);
        this.fx.floatText(p.x, p.y - 10, 'SPARK', P.scoutChip);
        bus.emit(EVT.toast, { text: 'SPARK — “Built you a repeater. Go go go!”', color: 'orange' });
        break;
      case 'henry':
        p.heal(99);
        p.grantShield(SWEEP.boonShieldMs);
        this.fx.floatText(p.x, p.y - 10, 'ANCHOR', P.scoutHenry);
        bus.emit(EVT.toast, { text: 'ANCHOR — “I’ve got you. Catch your breath.”', color: 'green' });
        break;
      case 'cameron':
        this.setWeapon(WEAPONS.arc);
        this.fx.floatText(p.x, p.y - 10, 'ECHO', P.scoutCameron);
        bus.emit(EVT.toast, { text: 'ECHO — “Echo Arc. It bounces. Watch.”', color: 'cyan' });
        break;
      case 'danny':
        this.boonFireMul *= SWEEP.boonFireMul;
        this.fx.floatText(p.x, p.y - 10, 'ROCKET', P.scoutDanny);
        bus.emit(EVT.toast, { text: 'ROCKET — “Faster! Nobody catches us up here.”', color: 'orange' });
        break;
    }
    audio.badgePickup();
  }

  /** REPLICATOR death → two small chasing shards (drifter minis; they never re-split). */
  private spawnSplitShards(x: number, y: number, n: number): void {
    this.fx.sparks(x, y, P.violetGlitch, 8);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const shard = new SweepEnemy(this, x + Math.cos(a) * 8, y + Math.sin(a) * 8, 'drifter');
      shard.hp = 1;
      shard.maxHp = 1;
      shard.setScale(0.7).setTint(P.violetGlitch);
      (shard.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(a) * 90, Math.sin(a) * 90);
      this.enemies.add(shard);
    }
  }

  private seedEnemies(): void {
    const T = SWEEP.tile;
    // authored placements — enemies live in the rooms/corridors the designer chose
    (this.arena.enemies ?? []).forEach((m) => {
      this.enemies.add(new SweepEnemy(this, (m.tx + 0.5) * T, (m.ty + 0.5) * T, m.type));
    });
  }

  /* ------------------------------- waves --------------------------------- */
  private startNextWave(): void {
    const waves = this.arena.waves ?? [];
    this.waveIdx++;
    if (this.waveIdx >= waves.length) {
      this.victory();
      return;
    }
    const w = waves[this.waveIdx];
    this.spawnQueue = [];
    w.spawns.forEach((s) => {
      for (let i = 0; i < s.count; i++) this.spawnQueue.push(s.type);
    });
    Phaser.Utils.Array.Shuffle(this.spawnQueue);
    this.spawnInterval = w.interval;
    this.spawnAt = this.time.now + 300;
    this.waveActive = true;
    this.showBanner(`WAVE ${this.waveIdx + 1} / ${waves.length}`);
  }

  private spawnEnemy(kind: SweepEnemyKind): void {
    // waves mode: spawn on a random open floor tile toward the map edges
    const edgeTiles = this.floorTiles.filter(
      (t) => t.x < this.mapW * 0.2 || t.x > this.mapW * 0.8 || t.y < this.mapH * 0.2 || t.y > this.mapH * 0.8
    );
    const pool = edgeTiles.length ? edgeTiles : this.floorTiles;
    const p = pool.length ? Phaser.Utils.Array.GetRandom(pool) : { x: this.mapW / 2, y: 20 };
    this.enemies.add(new SweepEnemy(this, p.x, p.y, kind));
  }

  private get aggro(): number {
    return this.heat >= SWEEP.heatRampAt[1] ? 1.35 : this.heat >= SWEEP.heatRampAt[0] ? 1.15 : 1;
  }

  /* ------------------------------- firing -------------------------------- */
  setWeapon(wp: SweepWeapon): void {
    this.weapon = wp;
    bus.emit(EVT.toast, { text: `WEAPON: ${wp.name}`, color: 'green' });
  }

  private fire(now: number): void {
    const wp = this.weapon;
    const cd = wp.cooldownMs * (activeSkin().mods.pulseCooldownMul ?? 1) * this.boonFireMul * (this.odActive ? SWEEP.overdriveFireMul : 1);
    this.fireAt = now + cd;
    this.shotCount++;
    const surge = activeSkin().abilities.surgeShot === true && this.shotCount % 3 === 0; // SPARK Surge Shot
    const base = this.player.aimAngle;
    const mx = this.player.muzzleX;
    const my = this.player.muzzleY;
    for (let i = 0; i < wp.count; i++) {
      const off = wp.count > 1 ? (i / (wp.count - 1) - 0.5) * wp.spreadRad * 2 : (Math.random() - 0.5) * wp.spreadRad;
      const a = base + off;
      const b = fireFrom(this.playerShots, mx, my, Math.cos(a) * wp.speed, Math.sin(a) * wp.speed, wp.lifeMs);
      if (b) {
        const uni = wp.scale ?? 1; // heavy shells (RUPTURE) read bigger
        b.setTint(surge ? P.warning : wp.tint);
        b.setScale((wp.scaleX ?? 1) * uni, uni);
        b.setData('dmg', wp.damage * (surge ? 2 : 1));
        b.setData('pierce', wp.pierce === true);
        b.setData('bounce', wp.bounce ?? 0);
        b.setData('hits', null);
        // reset per-shot specials every fire — the pool reuses sprites, so stale
        // homing/explode data from a previous weapon must be cleared.
        b.setData('homing', wp.homing ? (wp.homingRate ?? 5) : 0);
        b.setData('explode', wp.explode ?? null);
        (b.body as Phaser.Physics.Arcade.Body).setBounce(wp.bounce ? 1 : 0);
      }
    }
    // muzzle flash
    const mf = this.add.image(mx, my, TEX.glow8).setDepth(22).setTint(wp.glow).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9).setAlpha(0.9);
    this.tweens.add({ targets: mf, scale: 0.15, alpha: 0, duration: 90, onComplete: () => mf.destroy() });
    this.fx.sparks(mx, my, wp.glow, surge ? 4 : 2);
    audio.pulseShot();
  }

  /* ---------------------------- collisions ------------------------------- */
  private onShotHitEnemy(shot: Projectile, en: SweepEnemy): void {
    if (!shot.active || !en.active) return;
    const pierce = shot.getData('pierce') === true;
    // FIREWALL: a bolt into the warden's front shield is deflected (flank / dash / Scan instead)
    const b = shot.body as Phaser.Physics.Arcade.Body;
    if (en.blocksShot(b.velocity.x, b.velocity.y)) {
      this.impactFx(shot.x, shot.y, P.neonCyan);
      this.fx.sparks(shot.x, shot.y, P.neonCyan, 3);
      audio.enemyHit();
      if (!pierce) shot.kill();
      return;
    }
    if (pierce) {
      let hits = shot.getData('hits') as Set<SweepEnemy> | null;
      if (!hits) { hits = new Set(); shot.setData('hits', hits); }
      if (hits.has(en)) return;
      hits.add(en);
    }
    const sx = shot.x;
    const sy = shot.y;
    const dmg = (shot.getData('dmg') as number) ?? SWEEP.shotDmg;
    const explode = shot.getData('explode') as { radius: number; damage: number } | null;
    const ix = en.x;
    const iy = en.y;
    if (!pierce) shot.kill();
    this.impactFx(en.x, en.y, shot.getData('bounce') ? P.signalGreen : P.warning);
    audio.enemyHit();
    if (en.applyHit(dmg, sx, sy)) this.killEnemy(en);
    if (explode) this.explodeShot(ix, iy, explode);
  }

  /** RUPTURE detonation — AoE damage + palette-locked burst on impact (enemy or wall). */
  private explodeShot(x: number, y: number, ex: { radius: number; damage: number }): void {
    this.fx.explode(x, y, P.warning, 16);
    this.fx.shake(0.006, 120);
    audio.explode();
    const ring = this.add.image(x, y, TEX.glow8).setDepth(24).setTint(P.warning).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.9);
    this.tweens.add({ targets: ring, scale: Math.max(1, ex.radius / 20), alpha: 0, duration: 220, onComplete: () => ring.destroy() });
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
      if (!en.active) return;
      if (Phaser.Math.Distance.Between(x, y, en.x, en.y) <= ex.radius) {
        if (en.applyHit(ex.damage, x, y, 240)) this.killEnemy(en);
      }
    });
  }

  /** SEEKER: curve every homing bolt toward its nearest live drone (rate-capped → fair). */
  private steerHomingShots(dt: number): void {
    (this.playerShots.getChildren() as Projectile[]).forEach((b) => {
      if (!b.active) return;
      const rate = (b.getData('homing') as number) ?? 0;
      if (!rate) return;
      let best: SweepEnemy | null = null;
      let bestD = Infinity;
      (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
        if (!en.active) return;
        const d = Phaser.Math.Distance.Squared(b.x, b.y, en.x, en.y);
        if (d < bestD) { bestD = d; best = en; }
      });
      if (!best) return;
      const body = b.body as Phaser.Physics.Arcade.Body;
      const speed = Math.hypot(body.velocity.x, body.velocity.y) || 1;
      const cur = Math.atan2(body.velocity.y, body.velocity.x);
      const want = Math.atan2((best as SweepEnemy).y - b.y, (best as SweepEnemy).x - b.x);
      const na = Phaser.Math.Angle.RotateTo(cur, want, rate * dt);
      body.setVelocity(Math.cos(na) * speed, Math.sin(na) * speed);
      b.setRotation(na);
    });
  }

  /** angle from the player to the nearest live enemy, or null if none (touch auto-aim) */
  private nearestEnemyAngle(): number | null {
    let best: SweepEnemy | null = null;
    let bestD = Infinity;
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
      if (!en.active) return;
      const d = Phaser.Math.Distance.Squared(this.player.x, this.player.y, en.x, en.y);
      if (d < bestD) {
        bestD = d;
        best = en;
      }
    });
    return best ? Math.atan2((best as SweepEnemy).y - this.player.y, (best as SweepEnemy).x - this.player.x) : null;
  }

  /** a bolt hit a wall: ricochet if it has bounces left, else die */
  private onShotHitWall(b: Projectile): void {
    const explode = b.getData('explode') as { radius: number; damage: number } | null;
    if (explode) {
      this.explodeShot(b.x, b.y, explode);
      b.kill();
      return;
    }
    const bounce = (b.getData('bounce') as number) ?? 0;
    if (bounce > 0) {
      b.setData('bounce', bounce - 1);
      this.fx.sparks(b.x, b.y, P.signalGreen, 2);
    } else {
      b.kill();
    }
  }

  private impactFx(x: number, y: number, tint: number): void {
    this.fx.sparks(x, y, P.white, 3);
    const fl = this.add.image(x, y, TEX.glow8).setDepth(23).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.85);
    this.tweens.add({ targets: fl, scale: 0.1, alpha: 0, duration: 130, onComplete: () => fl.destroy() });
  }

  private killEnemy(en: SweepEnemy): void {
    const now = this.time.now;
    const ex = en.x;
    const ey = en.y;
    this.fx.explode(ex, ey, P.warning, 12);
    this.fx.shake(0.004, 90);
    // death pop — a quick expanding ring + flash so kills read
    const ring = this.add.image(ex, ey, TEX.glow8).setDepth(23).setTint(P.warning).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4).setAlpha(0.9);
    this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 240, onComplete: () => ring.destroy() });
    audio.explode();
    this.killCount++;
    this.combo = now < this.comboUntil ? Math.min(SWEEP.comboMax, this.combo + 1) : 1;
    this.comboUntil = now + SWEEP.comboWindowMs;
    if (!this.odActive) this.overdrive = Math.min(SWEEP.overdriveMax, this.overdrive + SWEEP.overdrivePerKill * Math.min(this.combo, 3));
    const gained = SWEEP.shardsPerKill * this.combo;
    this.shardsEarned += gained;
    addShards(gained);
    if (this.combo >= 2) this.fx.floatText(ex, ey - 8, `x${this.combo}`, P.warning);
    const isElite = en.getData('elite') === true;
    const isBoss = en.getData('boss') === true;
    const splitN = en.splitInto; // REPLICATOR bursts into chasing shards
    en.destroy();
    if (splitN > 0) this.spawnSplitShards(ex, ey, splitN);
    // kills charge the Node (double near it); the breach opens at full charge
    this.addNodeCharge(ex, ey);
    // the finale boss triggers the climax; the Elite drops a Boon + cache; grunts drop by chance
    if (isBoss) {
      this.onBossDefeated(ex, ey);
    } else if (isElite) {
      this.fx.explode(ex, ey, P.danger, 20);
      this.fx.shake(0.008, 220);
      this.dropBoon(ex, ey);
      addShards(SWEEP.eliteCacheShards);
      this.shardsEarned += SWEEP.eliteCacheShards;
      this.fx.floatText(ex, ey - 10, '+CACHE', P.warning);
    } else if (Math.random() < (this.arena.dropChance ?? SWEEP.dropChance)) {
      // per-arena override lets ONLY the finale Fold be extra loot-generous
      this.dropPickup(ex, ey);
    }
  }

  private onEnemyBoltHit(bolt: Projectile): void {
    if (!bolt.active || !this.player.alive) return;
    const bx = bolt.x;
    const by = bolt.y;
    bolt.kill();
    if (this.player.damage(bx, by)) this.onPlayerHurt();
  }

  private onTouch(en: SweepEnemy): void {
    if (!en.active || !this.player.alive) return;
    // ROCKET Phase-Strike: dashing through a drone damages IT (you're invulnerable mid-dash)
    if (this.player.isDashing && activeSkin().abilities.phaseStrike === true) {
      this.fx.sparks(en.x, en.y, P.scoutDanny, 4);
      if (en.applyHit(SWEEP.shotDmg, this.player.x, this.player.y)) {
        this.killEnemy(en);
        if (SWEEP.dashRefundOnPhaseKill) this.player.refreshDash(); // dash-chain flow
        this.fx.shake(0.006, 90);
      }
      return;
    }
    if (this.player.damage(en.x, en.y)) this.onPlayerHurt();
  }

  private onPlayerHurt(): void {
    this.heat = Math.min(100, this.heat + SWEEP.heatFillOnHit);
    if (this.player.hp <= 0) this.onDeath();
  }

  /* ------------------------------ pickups -------------------------------- */
  private dropPickup(x: number, y: number): void {
    // half the time a health orb, otherwise a random WEAPON pickup
    const isWeapon = Math.random() > 0.5;
    const wid = Phaser.Utils.Array.GetRandom(WEAPON_PICKUPS);
    const type = isWeapon ? 'weapon' : 'health';
    const tint = isWeapon ? WEAPONS[wid].tint : P.signalGreen;
    const pk = this.pickups.create(x, y, TEX.sweepPickup) as Phaser.Physics.Arcade.Image;
    pk.setTint(tint).setScale(isWeapon ? 1.5 : 1.1).setDepth(12).setData('ptype', type).setData('wid', wid);
    (pk.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    // a soft light pool so pickups read against the dark ground
    const glow = this.add.image(x, y, TEX.glow8).setDepth(11).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4).setAlpha(0.4);
    pk.setData('glow', glow);
    this.tweens.add({ targets: [pk], scale: { from: pk.scale * 0.85, to: pk.scale * 1.15 }, duration: 520, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: glow, alpha: { from: 0.25, to: 0.55 }, duration: 640, yoyo: true, repeat: -1 });
    this.time.delayedCall(11000, () => { if (pk.active) { glow.destroy(); pk.destroy(); } });
  }

  /** place a specific WEAPON pickup (guaranteed finale loot / boss payout). */
  private dropWeaponPickup(x: number, y: number, wid: string, persist: boolean): void {
    const wp = WEAPONS[wid] ?? WEAPONS.pulse;
    const pk = this.pickups.create(x, y, TEX.sweepPickup) as Phaser.Physics.Arcade.Image;
    pk.setTint(wp.tint).setScale(1.5).setDepth(12).setData('ptype', 'weapon').setData('wid', wid);
    (pk.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    const glow = this.add.image(x, y, TEX.glow8).setDepth(11).setTint(wp.tint).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4).setAlpha(0.4);
    pk.setData('glow', glow);
    this.tweens.add({ targets: [pk], scale: { from: 1.3, to: 1.7 }, duration: 520, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: glow, alpha: { from: 0.25, to: 0.55 }, duration: 640, yoyo: true, repeat: -1 });
    if (!persist) this.time.delayedCall(14000, () => { if (pk.active) { glow.destroy(); pk.destroy(); } });
  }

  /** seed the finale's guaranteed weapon pickups (arena.weaponSpawns) so gun variety is assured. */
  private seedWeaponPickups(): void {
    const T = SWEEP.tile;
    (this.arena.weaponSpawns ?? []).forEach((m) => {
      if (!WEAPONS[m.wid]) return;
      this.dropWeaponPickup((m.tx + 0.5) * T, (m.ty + 0.5) * T, m.wid, true);
    });
  }

  private onPickup(pk: Phaser.Physics.Arcade.Image): void {
    if (!pk.active) return;
    const type = pk.getData('ptype') as PickupType;
    (pk.getData('glow') as Phaser.GameObjects.Image | undefined)?.destroy();
    this.impactFx(this.player.x, this.player.y, P.signalGreen); // collect pop
    if (type === 'boon') {
      const scout = pk.getData('scout') as string;
      pk.destroy();
      this.applyBoon(scout);
      return;
    }
    pk.destroy();
    audio.badgePickup();
    if (type === 'health') {
      this.player.heal(SWEEP.healAmount);
      this.fx.floatText(this.player.x, this.player.y - 10, '+HP', P.signalGreen);
    } else {
      this.setWeapon(WEAPONS[pk.getData('wid') as string] ?? WEAPONS.pulse);
    }
  }

  /* ------------------------------- scan ---------------------------------- */
  private doScan(): void {
    audio.scanPulse();
    // scan radius honors the active skin (WILLOW wider, ECHO narrower) + WILLOW boon
    const r = SWEEP.scanRadius * (activeSkin().mods.scanRadiusMul ?? 1) * this.boonScanMul;
    this.fx.scanRing(this.player.x, this.player.y, r, 460, P.signal);
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
      if (!en.active) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, en.x, en.y) <= r) {
        if (en.applyHit(SWEEP.scanDmg, this.player.x, this.player.y, 260)) this.killEnemy(en);
      }
    });
    // double-duty Scan: reveal + grab buried Signal Caches in range
    this.revealCaches(this.player.x, this.player.y, r);
  }

  /* ------------------------------- update -------------------------------- */
  update(_time: number, delta: number): void {
    this.input2.update();
    if (this.input2.pauseJustDown && !this.isPaused && !uiOverlayActive() && !this.gameOverShown) this.setPaused(true);
    if (this.isPaused || this.gameOverShown || this.exiting) return;
    const now = this.time.now;
    const dt = delta / 1000;

    // ── aim: right stick if pushed · touch auto-aims nearest · else the mouse ──
    let firing = false;
    const pad = readPad();
    const rx = pad?.axes?.[2] ?? 0;
    const ry = pad?.axes?.[3] ?? 0;
    if (Math.hypot(rx, ry) > 0.35) {
      this.player.setAim(Math.atan2(ry, rx));
      this.reticle.setPosition(this.player.x + Math.cos(this.player.aimAngle) * 64, this.player.y + Math.sin(this.player.aimAngle) * 64);
      firing = true;
    } else if (touchInput.active) {
      // no second stick on a tablet — auto-aim the nearest threat; keep the
      // current aim (or movement heading) when the arena is momentarily clear.
      const ang = this.nearestEnemyAngle();
      if (ang !== null) this.player.setAim(ang);
      this.reticle.setPosition(this.player.x + Math.cos(this.player.aimAngle) * 64, this.player.y + Math.sin(this.player.aimAngle) * 64);
      firing = touchInput.shootHeld || touchInput.jumpHeld;
    } else {
      const p = this.input.activePointer;
      // the camera FOLLOWS the player across the arena, so activePointer.worldX/Y
      // (default-camera space) drift by the scroll amount. getWorldPoint uses THIS
      // camera's inverse transform → the reticle sits exactly under the cursor.
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.player.setAim(Math.atan2(w.y - this.player.y, w.x - this.player.x));
      this.reticle.setPosition(w.x, w.y);
      firing = p.isDown || this.input2.shootDown;
    }

    this.player.move(this.input2);
    if (this.input2.scanJustDown) this.doScan();

    if (firing && now >= this.fireAt && this.player.alive) this.fire(now);

    // drive enemies
    const aggro = this.aggro;
    const fireBolt = (x: number, y: number, vx: number, vy: number) => {
      const b = fireFrom(this.enemyShots, x, y, vx, vy, 3000);
      if (b) b.setTint(P.violetGlitch);
    };
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => en.drive(this.player.x, this.player.y, now, fireBolt, aggro));
    this.updateElite(now);
    this.steerHomingShots(dt);

    if (this.traverse) {
      // reach the (open) breach → Fold onward. Locked until the Node is charged.
      if (this.breachOpen && this.player.alive && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.breachPos.x, this.breachPos.y) < 22) {
        this.foldOnward();
      }
    } else {
      // waves mode
      if (this.waveActive && this.spawnQueue.length && now >= this.spawnAt) {
        this.spawnAt = now + (this.spawnInterval * 1000) / aggro;
        this.spawnEnemy(this.spawnQueue.shift()!);
      }
      if (this.waveActive && !this.spawnQueue.length && this.enemies.countActive(true) === 0) {
        this.waveActive = false;
        this.awaitingWave = true;
        this.nextWaveAt = now + (this.arena.waves?.[this.waveIdx]?.clearDelay ?? 2) * 1000;
      }
      if (this.awaitingWave && now >= this.nextWaveAt) {
        this.awaitingWave = false;
        this.startNextWave();
      }
    }

    // heat decays; combo lapses; overdrive ticks
    this.heat = Math.max(0, this.heat - SWEEP.heatDecayPerSec * dt);
    if (now >= this.comboUntil) this.combo = 0;
    if (this.odActive && now >= this.odUntil) {
      this.odActive = false;
      bus.emit(EVT.toast, { text: 'OVERDRIVE OFFLINE', color: 'orange' });
    }
    // [E] / interact → unleash Signal Overdrive when charged
    if (this.input2.interactJustDown && !this.odActive && this.overdrive >= SWEEP.overdriveMax) this.activateOverdrive();
    if (now >= this.hudAt) {
      this.hudAt = now + 100;
      this.emitHudStats();
    }

    if (now >= this.debugEmitAt) {
      this.debugEmitAt = now + 200;
      bus.emit(EVT.debugState, {
        fps: Math.round(this.game.loop.actualFps),
        scene: 'SweepScene',
        mode: this.arena.mode,
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        hp: this.player.hp,
        enemies: this.enemies.countActive(true),
        heat: Math.round(this.heat),
        shards: this.shardsEarned,
      });
    }
  }

  /** push the top-down combat HUD state to UIScene (rendered zoom-1, screen-fixed) */
  private emitHudStats(): void {
    bus.emit(EVT.hudSweepStats, {
      heat: Math.round(this.heat),
      node: this.breachOpen ? 1 : Phaser.Math.Clamp(this.nodeCharge / this.chargeTarget, 0, 1),
      breachOpen: this.breachOpen,
      traverse: this.traverse,
      enemies: this.enemies.countActive(true),
      wave: this.traverse ? 0 : this.waveIdx + 1,
      waves: this.arena.waves?.length ?? 0,
      combo: this.combo,
      weapon: this.weapon.name,
      overdrive: Phaser.Math.Clamp(this.overdrive / SWEEP.overdriveMax, 0, 1),
      odReady: this.overdrive >= SWEEP.overdriveMax,
      odActive: this.odActive,
    });
  }

  private showBanner(text: string): void {
    bus.emit(EVT.hudBanner, { text });
  }

  /** Signal Overdrive: rapid-fire window + an opening signal shockwave */
  private activateOverdrive(): void {
    this.odActive = true;
    this.odUntil = this.time.now + SWEEP.overdriveDurationMs;
    this.overdrive = 0;
    audio.doorUnlock();
    this.fx.flash(P.signal, 200);
    this.fx.shake(0.01, 260);
    this.fx.scanRing(this.player.x, this.player.y, SWEEP.overdriveShockRadius, 520, P.signal);
    bus.emit(EVT.toast, { text: '⚡ SIGNAL OVERDRIVE ⚡', color: 'green' });
    this.showBanner('SIGNAL OVERDRIVE');
    // shockwave clears/damages nearby drones
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
      if (!en.active) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, en.x, en.y) <= SWEEP.overdriveShockRadius) {
        if (en.applyHit(SWEEP.overdriveShockDmg, this.player.x, this.player.y, 320)) this.killEnemy(en);
      }
    });
  }

  /* ------------------------------ outcomes ------------------------------- */
  /** DEV: jump straight to the breach so the Fold fires next update (preview the transition). */
  debugSkipToBreach(): void {
    if (!this.traverse || !this.player || this.exiting) return;
    if (!this.breachOpen) this.openBreach(); // force it so the Fold can fire
    this.player.setPosition(this.breachPos.x, this.breachPos.y);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  /** traverse complete — the Fold carries you into the next (side-view) scene. */
  private foldOnward(): void {
    if (this.exiting) return;
    this.exiting = true;
    addShards(this.arena.clearBonus ?? SWEEP.shardsClearBonus); // finale Fold pays out more
    // circuit beats (Z2 → Motel) report "node solved" so the overworld powers its wing.
    if (this.arena.next === SCENES.motel || this.arena.next === SCENES.orchard) this.registry.set('nodeJustSolved', true);
    bus.emit(EVT.toast, { text: 'BREACH — DROPPING BACK IN', color: 'green' });
    const next = this.arena.next ?? SCENES.field;
    foldCollapse(this, this.fx, () => {
      this.scene.stop();
      if (this.scene.isSleeping(next)) {
        this.scene.wake(next); // Z2: the overworld resumes via its onWake return beat
      } else {
        this.registry.set(FOLD_FLAG, true); // Z1: the fresh scene plays foldSettle in create()
        this.scene.start(next);
      }
    });
  }

  private victory(): void {
    if (this.exiting) return;
    this.exiting = true;
    addShards(SWEEP.shardsClearBonus);
    this.shardsEarned += SWEEP.shardsClearBonus;
    audio.doorUnlock();
    this.fx.flash(P.signalGreen, 180);
    bus.emit(EVT.toast, { text: `STORM CLEARED — +${this.shardsEarned} SHARDS`, color: 'green' });
    this.showBanner('SIGNAL HELD');
    this.time.delayedCall(1200, () => this.exitToOverworld());
  }

  private onDeath(): void {
    if (this.gameOverShown) return;
    this.gameOverShown = true;
    this.registry.set('gameOverRetryScene', SCENES.sweep);
    this.registry.set('gameOverRetryArenaId', this.arena.id);
    bus.emit(EVT.hudSweep, { active: false });
    this.fx.staticBurst(500);
    this.player.setVisible(false);
    this.physics.pause();
    this.time.delayedCall(700, () => {
      this.scene.launch(SCENES.gameOver, { from: SCENES.sweep });
      this.scene.pause();
    });
  }

  private exitToOverworld(): void {
    audio.transitionWarp();
    this.fx.staticBurst(400);
    this.fx.flash(P.white, 160);
    const returnScene = (this.registry.get('sweepReturnScene') as string) ?? SCENES.field;
    this.time.delayedCall(350, () => {
      if (this.arena.id === 'surface-z1' && returnScene === SCENES.field) {
        updateSave((s) => { s.flags.introSweepCleared = true; });
      }
      this.scene.stop();
      if (this.scene.isSleeping(returnScene)) this.scene.wake(returnScene);
      else this.scene.start(returnScene);
    });
  }

  /* ------------------------------ pause/shutdown ------------------------- */
  private togglePause(): void {
    if (uiOverlayActive()) return;
    this.setPaused(!this.isPaused);
  }

  setPaused(v: boolean): void {
    if (this.gameOverShown) return;
    this.isPaused = v;
    if (v) {
      this.physics.pause();
      bus.emit(EVT.gamePaused, {});
    } else {
      this.physics.resume();
      bus.emit(EVT.gameResumed, {});
    }
  }

  private onShutdown(): void {
    bus.emit(EVT.hudSweep, { active: false });
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
  }
}
