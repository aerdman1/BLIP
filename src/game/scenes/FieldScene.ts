/**
 * MILLER FIELD — the playable overworld of the vertical slice.
 * Dusk parallax, tile platforming, scan-revealed secrets, detection cones,
 * scanner drones, Blipstream Node A, the crop-circle door, the Scarecrow
 * Antenna, and the first Signal Fragment.
 */
import Phaser from 'phaser';
import {
  CAM,
  DRONE,
  EVT,
  FALL_DAMAGE_Y_PAD,
  VIEW_H,
  VIEW_W,
  PALETTE as P,
  PULSE,
  RENDER_ZOOM,
  SCAN,
  SCENES,
  SIGNATURE,
  TEX,
  TILE,
  css,
} from '../config';
import { MILLER_FIELD, cellAt, walkLevel } from '../data/levels';
import { logById } from '../data/scouts';
import { BlipstreamNodePortal } from '../entities/BlipstreamNodePortal';
import { Collectible } from '../entities/Collectible';
import { CropCircleDoor } from '../entities/CropCircleDoor';
import { ScoutEcho } from '../entities/ScoutEcho';
import { HiddenPlatform } from '../entities/HiddenPlatform';
import { Player } from '../entities/Player';
import { Projectile, chainToNextEnemy, clearBoltsInRadius, fireFrom, makeProjectileGroup, ricochetBolt } from '../entities/Projectile';
import { ScannerDrone } from '../entities/ScannerDrone';
import { ScannerRig } from '../entities/ScannerRig';
import { ScarecrowAntennaBoss } from '../entities/ScarecrowAntennaBoss';
import { SignalBox } from '../entities/SignalBox';
import { audio } from '../systems/AudioSystem';
import { ClassificationSystem } from '../systems/ClassificationSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { enteredViaFold, foldSettle } from '../systems/FoldTransition';
import { attachScreenFilter } from '../systems/ScreenFilter';
import { bus } from '../systems/EventBus';
import { PlayerInput } from '../systems/InputSystem';
import { quests } from '../systems/QuestSystem';
import { getSave, hasAbility, recordSetPiece, setProgress, unlockSkin, updateSave } from '../systems/SaveSystem';
import { placeSecretCues, resolveScanSecrets, retireSecretCue } from '../systems/Secrets';
import { ZONE_SECRETS } from '../data/fieldNotes';
import { progression } from '../systems/ProgressionSystem';
import { skinByScout } from '../data/skins';
import { activeSkin, skinAbilities } from '../systems/SkinState';
import { applyCameraLook } from '../systems/CameraLook';
import { registerScene, unregisterScene } from '../systems/TestAPI';
import { uiOverlayActive } from '../systems/UIState';

/** x of the glowing signal-gate at the east edge — the travel point to Zone 2 */
const FIELD_EXIT_X = 170 * TILE;

export class FieldScene extends Phaser.Scene {
  player!: Player;
  private input2!: PlayerInput;
  fx!: EffectsSystem;
  classify = new ClassificationSystem();

  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private hiddenGroup!: Phaser.Physics.Arcade.StaticGroup;
  private hiddenPlatforms: HiddenPlatform[] = [];
  private markers: Collectible[] = [];
  private badge?: Collectible;
  private willRelic?: Collectible;
  private fragment?: Collectible;
  playerBolts!: Phaser.Physics.Arcade.Group;
  enemyBolts!: Phaser.Physics.Arcade.Group;
  droneGroup!: Phaser.Physics.Arcade.Group;
  private rig?: ScannerRig;
  door!: CropCircleDoor;
  portal!: BlipstreamNodePortal;
  private signalBox!: SignalBox;
  private scanHints: Array<{ x: number; y: number; label: Phaser.GameObjects.Text; done: () => boolean }> = [];
  private secretCues: Record<string, Phaser.GameObjects.Image> = {};
  boss?: ScarecrowAntennaBoss;
  private arenaWalls: Phaser.Physics.Arcade.Image[] = [];

  private spawnPoint = { x: 0, y: 0 };
  private lastSafe = { x: 0, y: 0 };
  private clouds!: Phaser.GameObjects.TileSprite;
  private hillsBack!: Phaser.GameObjects.TileSprite;
  private stars!: Phaser.GameObjects.TileSprite;
  private hillsFar!: Phaser.GameObjects.TileSprite;
  private hillsMid!: Phaser.GameObjects.TileSprite;
  private fog!: Phaser.GameObjects.TileSprite;
  private fogDrift = 0;
  private camLookX = 0; // smoothed horizontal camera lookahead (leads facing dir)
  private towerLight?: Phaser.GameObjects.Image;
  private cloudDrift = 0;
  private isPaused = false;
  private gameOverShown = false;
  private statFlushAt = 0;
  private sessionStart = 0;
  private unsubs: Array<() => void> = [];
  private travelling = false;
  private roadHintShown = false;
  private exitGlow?: Phaser.GameObjects.Image;
  private exitArrow?: Phaser.GameObjects.Image;
  private exitCurtain?: Phaser.GameObjects.Image;
  private exitLit = false;

  constructor() {
    super(SCENES.field);
  }

  create(): void {
    const def = MILLER_FIELD;
    this.fx = new EffectsSystem(this);
    attachScreenFilter(this, true); // level screen filter (dialed down for gameplay)
    this.input2 = new PlayerInput(this);
    this.isPaused = false;
    this.gameOverShown = false;
    this.sessionStart = this.time.now;
    this.hiddenPlatforms = [];
    this.markers = [];
    this.arenaWalls = [];
    this.boss = undefined;
    this.fragment = undefined;
    this.exitLit = false;
    this.travelling = false;
    this.roadHintShown = false;
    this.camLookX = 0;

    this.buildParallax(def.meta.widthPx);
    this.buildWorld();
    this.buildFieldExit();
    this.dressPit();
    this.scatterMist();
    this.scatterFireflies();

    this.physics.world.setBounds(0, -VIEW_H, def.meta.widthPx, def.meta.heightPx + VIEW_H);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.cameras.main.setZoom(RENDER_ZOOM); // HD-2D: 960×540 buffer shows a 480×270 world
    this.cameras.main.setBounds(0, 0, def.meta.widthPx, def.meta.heightPx);
    // 3.0 is tall — a small vertical deadzone + a downward look-offset so big
    // descents (dip, ravine, boss-bowl drop) show the landing before you hit it
    this.cameras.main.startFollow(this.player, true, 0.12, 0.16);
    this.cameras.main.setDeadzone(40, 18);
    this.cameras.main.setFollowOffset(0, CAM.lookOffsetY);
    // dropped in from the top-down Surface? play the Fold "settle"; else normal fade.
    if (enteredViaFold(this)) foldSettle(this, this.fx);
    else this.cameras.main.fadeIn(500, 5, 7, 15);

    this.wireCollisions();
    this.applySaveState();

    if (!this.scene.isActive(SCENES.ui)) this.scene.launch(SCENES.ui);

    quests.init();
    this.player.refreshHud();
    audio.playMusic('field');
    bus.emit(EVT.fragmentCount, { count: getSave().signalFragments });
    bus.emit(EVT.sceneChanged, { scene: SCENES.field, zone: 'Miller Field' });

    // How-to-play card, once at the very start of a run (the 'wake' step only
    // exists at fresh spawn — returning from the Blipstream never re-shows it).
    if (quests.stepId === 'wake') {
      this.time.delayedCall(650, () => this.showHowToPlay());
    }

    // pause + debug + wake wiring
    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.unsubs.push(bus.on(EVT.uiResume, () => this.setPaused(false)));
    this.unsubs.push(bus.on(EVT.debugGotoBlipstream, () => this.enterBlipstream(true)));
    this.unsubs.push(bus.on(EVT.skinSelected, (d) => this.applySkinLive((d as { id: string }).id)));
    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.buildScanHints(); // Miller-Field-only tutorial: [Q] SCAN labels over scannable scout items
    registerScene('field', this);
  }

  /* ------------------------------- construction ------------------------------ */

  private buildParallax(worldW: number): void {
    this.add.image(0, 0, TEX.sky).setOrigin(0).setScrollFactor(0).setDepth(0);
    this.stars = this.add.tileSprite(0, 0, VIEW_W, 160, TEX.stars).setOrigin(0).setScrollFactor(0).setDepth(1).setAlpha(0.9);
    // warm moon, nearly fixed to the sky
    this.add.image(70, 46, TEX.moon).setScrollFactor(0.03, 0.02).setDepth(1);
    this.add.image(70, 46, TEX.glow8).setScale(10).setTint(P.moon).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.16).setScrollFactor(0.03, 0.02).setDepth(1);
    // moonlight god-rays fanning down from the moon (drifts subtly)
    const rays = this.add
      .image(70, 46, TEX.moonRays)
      .setOrigin(0.09, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0.04, 0.02)
      .setDepth(1)
      .setAlpha(0.5);
    this.tweens.add({ targets: rays, alpha: { from: 0.35, to: 0.6 }, duration: 5000, yoyo: true, repeat: -1 });
    this.clouds = this.add.tileSprite(0, 38, VIEW_W, 72, TEX.clouds).setOrigin(0).setScrollFactor(0).setDepth(2).setAlpha(0.6);
    // three layered ridges for atmospheric depth (furthest → nearest)
    this.hillsBack = this.add.tileSprite(0, VIEW_H - 128, VIEW_W, 70, TEX.hillsBack).setOrigin(0).setScrollFactor(0).setDepth(2).setAlpha(0.85);
    // the floating island nobody acknowledges, hovering over the tree line
    const island = this.add.image(VIEW_W * 0.62, 70, TEX.island).setScrollFactor(0.22, 0.1).setDepth(3);
    this.tweens.add({ targets: island, y: 74, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.image(island.x, 96, TEX.glow8).setScale(3).setTint(P.signal).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.08).setScrollFactor(0.22, 0.1).setDepth(3);
    this.hillsFar = this.add.tileSprite(0, VIEW_H - 116, VIEW_W, 80, TEX.hillsFar).setOrigin(0).setScrollFactor(0).setDepth(3);
    this.hillsMid = this.add.tileSprite(0, VIEW_H - 96, VIEW_W, 90, TEX.hillsMid).setOrigin(0).setScrollFactor(0).setDepth(4);
    // distance haze — fog fading the ridges into the horizon (atmospheric depth)
    this.add.tileSprite(0, VIEW_H - 130, VIEW_W, 56, TEX.distHaze).setOrigin(0).setScrollFactor(0).setDepth(4).setAlpha(0.9);
    // drifting low field-fog — merges the hazy distance into the play space
    this.fog = this.add.tileSprite(0, VIEW_H - 118, VIEW_W, 62, TEX.millerFog).setOrigin(0, 0).setScrollFactor(0).setDepth(5).setAlpha(0.42);
    // cinematic vignette (frames the edges; the foreground stays bright)
    this.add.image(0, 0, TEX.vignette).setOrigin(0).setScrollFactor(0).setDepth(11).setDisplaySize(VIEW_W, VIEW_H).setAlpha(0.38);
    void worldW;
  }

  /** THE PIT: visual depth inside the ravine — fog pooling below, dark rocks,
   *  a few fireflies rising out of the dark. Reads as a real drop, not a hole. */
  private dressPit(): void {
    const x0 = 105 * TILE;
    const x1 = 113 * TILE;
    const cx = (x0 + x1) / 2;
    const floorY = 30 * TILE; // the recovery shelf; death void below it
    const bottomY = 40 * TILE;
    // darkness gradient plunging below the shelf
    const dark = this.add.graphics().setDepth(6);
    dark.fillGradientStyle(0x05070f, 0x05070f, 0x05070f, 0x05070f, 0, 0, 0.9, 0.9);
    dark.fillRect(x0, floorY, x1 - x0, bottomY - floorY);
    // jagged rock silhouettes far down at the bottom
    dark.fillStyle(0x0d1120, 1);
    dark.fillTriangle(x0 + 12, bottomY, x0 + 30, bottomY - 26, x0 + 48, bottomY);
    dark.fillTriangle(x0 + 54, bottomY, x0 + 76, bottomY - 34, x0 + 98, bottomY);
    // a faint signal glow deep in the cut (something is down there)
    this.add.image(cx, bottomY - 30, TEX.glow8).setTint(P.signal).setBlendMode(Phaser.BlendModes.ADD).setScale(3, 2).setAlpha(0.05).setDepth(6);
    // fog banks pooling in the ravine
    for (const [fx, fy, s] of [
      [cx - 26, floorY + 22, 2.8],
      [cx + 22, floorY + 44, 3.4],
      [cx, floorY + 70, 3.0],
    ] as Array<[number, number, number]>) {
      const fog = this.add.image(fx, fy, TEX.groundMist).setBlendMode(Phaser.BlendModes.ADD).setDepth(7).setAlpha(0.32).setScale(s, 1.5);
      this.tweens.add({ targets: fog, x: fx + 16, alpha: { from: 0.2, to: 0.4 }, duration: 5200 + (fx % 900), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // fireflies drifting up out of the dark
    for (let i = 0; i < 5; i++) {
      const fx = x0 + 16 + i * 20;
      const fy = floorY + 20 + (i % 3) * 26;
      const fly = this.add.image(fx, fy, TEX.glow8).setTint(P.windowLight).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.35).setDepth(8);
      this.tweens.add({ targets: fly, y: fy - 18, alpha: { from: 0.12, to: 0.5 }, duration: 2100 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 400 });
    }
  }

  /** low ground mist drifting through the field — soft, additive, atmospheric */
  private scatterMist(): void {
    const def = MILLER_FIELD;
    for (let i = 0; i < 10; i++) {
      const col = 6 + i * 16 + ((i * 5) % 7);
      let surfaceRow = -1;
      for (let r = 0; r < def.rowCount; r++) {
        if (cellAt(def, col, r) === '#') {
          surfaceRow = r;
          break;
        }
      }
      if (surfaceRow < 0) continue;
      const mx = col * TILE;
      const my = surfaceRow * TILE - 3;
      const mist = this.add
        .image(mx, my, TEX.groundMist)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(11)
        .setAlpha(0.5)
        .setScale(1.4, 1);
      this.tweens.add({ targets: mist, x: mx + 24, alpha: { from: 0.28, to: 0.6 }, duration: 6000 + i * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** amber fireflies drifting over the grass line */
  private scatterFireflies(): void {
    const def = MILLER_FIELD;
    for (let i = 0; i < 22; i++) {
      const col = 4 + i * 7 + ((i * 3) % 4);
      let surfaceRow = -1;
      for (let r = 0; r < def.rowCount; r++) {
        if (cellAt(def, col, r) === '#') {
          surfaceRow = r;
          break;
        }
      }
      if (surfaceRow < 0) continue;
      const fx = col * TILE + 8;
      const fy = surfaceRow * TILE - 10 - Math.random() * 14;
      const fly = this.add
        .image(fx, fy, TEX.glow8)
        .setTint(P.windowLight)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.7 + Math.random() * 0.5)
        .setAlpha(0.4)
        .setDepth(7);
      this.tweens.add({
        targets: fly,
        x: fx + (Math.random() * 20 - 10),
        y: fy - (3 + Math.random() * 8),
        alpha: { from: 0.12 + Math.random() * 0.25, to: 0.6 },
        duration: 1500 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1500,
      });
    }
  }

  private buildWorld(): void {
    const def = MILLER_FIELD;
    this.solids = this.physics.add.staticGroup();
    this.hiddenGroup = this.physics.add.staticGroup();
    this.playerBolts = makeProjectileGroup(this, TEX.boltPlayer, PULSE.maxActive);
    this.enemyBolts = makeProjectileGroup(this, TEX.boltEnemy, DRONE.maxBolts + 16);
    this.droneGroup = this.physics.add.group({ allowGravity: false, immovable: false });

    const dronePos: Array<{ x: number; y: number }> = [];
    const cliffFaces: Array<{ x: number; y: number }> = []; // right-facing exposed faces (visible)

    walkLevel(def, (ch, col, row, x, y) => {
      switch (ch) {
        case '#': {
          const above = cellAt(def, col, row - 1) === '#';
          const left = cellAt(def, col - 1, row) === '#';
          const right = cellAt(def, col + 1, row) === '#';
          const below = cellAt(def, col, row + 1) === '#';
          // surface = grass; body = one of four deterministic soil variants
          let key: string = TEX.tileGrass;
          if (above) {
            // mostly plain soil; occasional feature tile, masonry the most common
            const roll = (((col * 73856093) ^ (row * 19349663)) >>> 0) % 100;
            key =
              roll < 6 ? TEX.tileDirtRock : roll < 20 ? TEX.tileDirtBrick : roll < 30 ? TEX.tileDirtRoot : TEX.tileDirt;
          }
          const t = this.solids.create(x, y, key) as Phaser.Physics.Arcade.Image;
          t.setDepth(8);
          // grass tuft on some surface tiles
          if (!above && (col * 7) % 3 === 0) {
            this.add.image(x + ((col % 5) - 2) * 2, y - 10, TEX.grassTuft).setDepth(9);
          }
          // chipped, mossy edges on exposed cliff faces
          if (!left) this.add.image(x - TILE / 2, y, TEX.cliffEdge).setOrigin(0, 0.5).setDepth(9);
          if (!right) {
            this.add.image(x + TILE / 2, y, TEX.cliffEdge).setOrigin(1, 0.5).setFlipX(true).setDepth(9);
            if (!above) cliffFaces.push({ x: x + 6, y });
          }
          // grass/moss spilling over a ledge lip
          if (!above && (!below || !left || !right)) {
            this.add.image(x, y + TILE / 2, TEX.grassOverhang).setOrigin(0.5, 0).setDepth(9);
            // a lush vine dangles from some cliff-top lips
            if ((!left || !right) && (col * 13) % 4 === 0) {
              this.add.image(x + (!left ? -4 : 4), y + TILE / 2, TEX.vine).setOrigin(0.5, 0).setDepth(9);
            }
          }
          // roots drooping from an overhang underside (sparse)
          if (!below && above && col % 5 === 0) {
            this.add.image(x, y + TILE / 2, TEX.rootDrip).setOrigin(0.5, 0).setDepth(7);
          }
          break;
        }
        case '=': {
          const t = this.solids.create(x, y, TEX.tilePlatform) as Phaser.Physics.Arcade.Image;
          t.setDepth(8);
          (t.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 10).setOffset(0, 0);
          break;
        }
        case 'H':
        case 'h': {
          const hp = new HiddenPlatform(this, x, y, ch === 'h');
          this.hiddenGroup.add(hp);
          this.hiddenPlatforms.push(hp);
          break;
        }
        case 'm':
          this.markers.push(new Collectible(this, x, y, 'route-marker', true, P.scoutWill));
          break;
        case 'b':
          this.badge = new Collectible(this, x, y, 'badge-will', true, P.scoutWill);
          break;
        case 'W':
          this.willRelic = new Collectible(this, x, y, 'relic-will', true, P.scoutWill);
          break;
        case 'P':
          this.spawnPoint = { x, y: y - 4 };
          break;
        case 'd':
          dronePos.push({ x, y });
          break;
        case 's':
          this.rig = new ScannerRig(this, x, y - 3, 30);
          break;
        case 'x':
          this.signalBox = new SignalBox(this, x, y + 2);
          break;
        case 'f':
          this.add.image(x, y, TEX.fence).setDepth(9);
          break;
        case 't': {
          this.add.image(x, y - 62, TEX.towerSilhouette).setDepth(5).setAlpha(0.9);
          this.towerLight = this.add
            .image(x, y - 130, TEX.glow8)
            .setTint(P.danger)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(6);
          break;
        }
        case 'n':
          this.portal = new BlipstreamNodePortal(this, x, y + TILE / 2);
          break;
        case 'g':
          this.door = new CropCircleDoor(this, x + TILE / 2, y + TILE * 1.5, this.fx);
          break;
      }
    });

    this.addTerrainPersonality(cliffFaces);
    this.secretCues = placeSecretCues(this, 'miller-field');

    this.lastSafe = { ...this.spawnPoint };
    this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.fx);
    this.player.setSkin(getSave().selectedSkin);
    this.emitSkin();

    for (const d of dronePos) this.spawnDrone(d.x, d.y, 52);
  }

  /** BLIP mystery details embedded in the cliff faces — buried nodes, faint
   *  scan glyphs, and a carved "47" marker. Placed on real exposed faces so
   *  they never float; kept sparse and readable per the art skills. */
  private addTerrainPersonality(faces: Array<{ x: number; y: number }>): void {
    if (faces.length === 0) return;
    faces.sort((a, b) => a.x - b.x);
    const at = (frac: number) => faces[Math.min(faces.length - 1, Math.floor(frac * faces.length))];

    // two buried signal nodes, slowly pulsing
    for (const frac of [0.28, 0.72]) {
      const f = at(frac);
      const node = this.add.image(f.x, f.y, TEX.buriedNode).setDepth(9);
      const glow = this.add
        .image(f.x, f.y, TEX.glow8)
        .setTint(P.signal)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(2)
        .setAlpha(0.18)
        .setDepth(9);
      this.tweens.add({ targets: glow, alpha: { from: 0.1, to: 0.3 }, duration: 1500, yoyo: true, repeat: -1 });
      void node;
    }
    // faint scan glyphs on a couple of faces
    for (const frac of [0.46, 0.9]) {
      const f = at(frac);
      this.add.image(f.x, f.y - 8, TEX.scanGlyph).setDepth(9).setAlpha(0.55);
    }
    // the "47" marker on the cliff nearest the boss arena
    const arenaX = MILLER_FIELD.meta.arena.centerX;
    const marker = faces.reduce((best, f) => (Math.abs(f.x - arenaX) < Math.abs(best.x - arenaX) ? f : best), faces[0]);
    this.add.image(marker.x + 2, marker.y - 10, TEX.marker47).setDepth(9);
  }

  private spawnDrone(x: number, y: number, halfRange: number): ScannerDrone {
    const drone = new ScannerDrone(this, x, y, halfRange, {
      fx: this.fx,
      fireBolt: (bx, by, tx, ty) => {
        const angle = Math.atan2(ty - by, tx - bx);
        fireFrom(this.enemyBolts, bx, by, Math.cos(angle) * DRONE.boltSpeed, Math.sin(angle) * DRONE.boltSpeed, DRONE.boltLifeMs);
        audio.hazardZap();
      },
      getPlayer: () => ({ x: this.player.x, y: this.player.y, alive: this.player.alive }),
      isThreat: () => this.classify.isThreat,
      onDestroyed: () => this.onDroneDestroyed(),
    });
    this.droneGroup.add(drone);
    (drone.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    return drone;
  }

  private wireCollisions(): void {
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.hiddenGroup);
    if (this.door) this.physics.add.collider(this.player, this.door.sprite);

    this.physics.add.collider(this.playerBolts, this.solids, (bolt) => {
      const b = bolt as Projectile;
      // Pulse Ricochet signature multiplies the bounce; ECHO skin still bounces once.
      const maxB = hasAbility('pulse-ricochet') ? SIGNATURE.ricochet.wallBounces : skinAbilities().echoShot ? 1 : 0;
      if (maxB > 0 && ricochetBolt(b, maxB)) {
        this.fx.sparks(b.x, b.y, P.scoutCameron, 3);
        return;
      }
      this.fx.sparks(b.x, b.y, P.signal, 3);
      b.kill();
    });
    this.physics.add.collider(this.enemyBolts, this.solids, (bolt) => (bolt as Projectile).kill());

    this.physics.add.overlap(this.playerBolts, this.droneGroup, (bolt, droneObj) => {
      const b = bolt as Projectile;
      const drone = droneObj as ScannerDrone;
      if (!b.active || !drone.active) return;
      this.fx.sparks(drone.x, drone.y, P.warning, 5);
      drone.takeDamage(this.player.pulseDamage * ((b as unknown as { surge?: boolean }).surge ? 2 : 1));
      // Pulse Ricochet: deflect toward the next drone instead of dying
      if (
        hasAbility('pulse-ricochet') &&
        chainToNextEnemy(b, drone, this.droneGroup.getChildren(), SIGNATURE.ricochet.chainHops, SIGNATURE.ricochet.chainRange)
      ) {
        this.fx.sparks(b.x, b.y, P.scoutCameron, 3);
        return;
      }
      b.kill();
    });

    this.physics.add.overlap(this.enemyBolts, this.player, (_pl, bolt) => {
      const b = bolt as Projectile;
      if (!b.active) return;
      if (this.player.invulnerable) return;
      b.kill();
      this.hurtPlayer(1, b.x);
    });

    this.physics.add.overlap(this.player, this.droneGroup, (_pl, droneObj) => {
      const drone = droneObj as ScannerDrone;
      if (!drone.active) return;
      // ROCKET Phase-Strike: dashing through a drone damages it (i-frames protect you)
      if (this.player.isDashing && skinAbilities().phaseStrike) {
        this.fx.afterimage(this.player, P.scoutDanny);
        drone.takeDamage(this.player.pulseDamage * 2);
        return;
      }
      this.hurtPlayer(DRONE.touchDamage, drone.x);
    });
  }

  /** restore world state from the save file (continue / respawn) */
  private applySaveState(): void {
    const save = getSave();
    if (save.flags.doorOpened) {
      this.door.setOpenInstant();
      this.portal.setCompleted();
    }
    if (save.flags.willBadgeCollected && this.badge) {
      this.badge.destroy();
      this.badge = undefined;
    }
    if (save.flags.chipBoxScanned) this.signalBox.markScanned();
    if (save.signalSets.will?.relic && this.willRelic) {
      this.willRelic.destroy();
      this.willRelic = undefined;
    }
    if (save.flags.bossDefeated && !save.flags.firstFragmentCollected) {
      this.spawnFragment();
    }
  }

  /** completing a scout's 3-piece Signal Set → unlock skin + Scout Echo payoff */
  private checkSetComplete(scoutId: string): void {
    const skin = skinByScout(scoutId);
    if (!skin) return;
    if (getSave().unlockedSkins.includes(skin.id)) return;
    if (setProgress(scoutId).count < 3) return;
    unlockSkin(skin.id);
    updateSave((s) => {
      if (!s.earnedPortraits.includes(scoutId)) s.earnedPortraits.push(scoutId);
    });
    ScoutEcho.summon(this, this.player.x, this.player.y - 8, scoutId, skin.color, this.fx, `${skin.scoutName.toUpperCase()} / ${skin.name}`);
    this.time.delayedCall(700, () => {
      bus.emit(EVT.scoutLog, {
        title: `SIGNAL SET COMPLETE — ${skin.name} UNLOCKED`,
        body:
          `${skin.scoutName}’s echo hands you their signal.\n\n"${skin.fantasy}"\n\n` +
          `Equip ${skin.name} in the Command Center ▸ WARDROBE. ${skin.passive}`,
        accent: scoutId === 'will' ? 'will' : scoutId === 'chip' ? 'chip' : 'fragment',
      });
    });
  }

  /* --------------------------------- gameplay -------------------------------- */

  update(_time: number, delta: number): void {
    this.input2.update(); // pad snapshot + edges, before any early-return
    if (this.input2.pauseJustDown && !this.isPaused && !uiOverlayActive() && !this.gameOverShown) {
      this.setPaused(true);
    }
    if (this.isPaused || this.gameOverShown) return;
    const dtSec = delta / 1000;

    this.player.updatePlayer(this.input2);
    this.updateCameraLook(dtSec);
    this.updateParallax(dtSec);

    // track last safe ground for pit respawns
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down && this.player.alive) {
      this.lastSafe = { x: this.player.x, y: this.player.y - 4 };
    }

    // shooting
    if (this.input2.shootDown && this.player.canShoot() && this.player.alive) {
      const aim = this.input2.shotVector(this.player.x, this.player.y - 1, this.player.facing);
      if (Math.abs(aim.x) > 0.25) this.player.facing = aim.x >= 0 ? 1 : -1;
      this.player.markShoot();
      const surge = this.player.isSurgeShot; // SPARK: every 3rd pulse
      const bolt = fireFrom(
        this.playerBolts,
        this.player.x + aim.x * 8,
        this.player.y - 1 + aim.y * 4,
        aim.x * PULSE.speed,
        aim.y * PULSE.speed,
        PULSE.lifeMs
      );
      if (bolt) {
        (bolt as unknown as { surge?: boolean; bounced?: boolean }).surge = surge;
        (bolt as unknown as { bounced?: boolean }).bounced = false;
        if (surge) bolt.setTint(0xffffff).setScale(1.5);
        else bolt.setTint(activeSkin().color).setScale(1); // pulse reads in the skin's color
      }
      audio.pulseShot();
      this.fx.sparks(this.player.x + aim.x * 9, this.player.y - 1 + aim.y * 4, surge ? P.warning : P.signal, surge ? 5 : 2);
      this.bumpStat('pulseShotsFired');
    }

    // scanning
    if (this.input2.scanJustDown && this.player.canScan() && this.player.alive) this.doScan();

    // interact — Blipstream portal
    const nearPortal = this.portal.playerNear(this.player.x, this.player.y);
    if (this.input2.interactJustDown && nearPortal && !this.portal.completed && quests.isAtOrPast('enterNode')) {
      this.enterBlipstream(false);
    }

    // enemies + cones
    let inCone = false;
    (this.droneGroup.getChildren() as ScannerDrone[]).forEach((d) => {
      d.updateDrone();
      if (d.active && d.cone.update(this.player.x, this.player.y)) inCone = true;
    });
    if (this.rig && this.rig.update(dtSec, this.player.x, this.player.y)) inCone = true;
    this.classify.update(dtSec, inCone && this.player.alive && !this.player.isDashing && !this.player.ghostCloaked, this.player.detectionMul);

    this.updateSkinPassives(dtSec, inCone, body);
    this.updateScanHints();

    // boss
    this.boss?.update(dtSec);

    // quest zone triggers
    this.updateQuestTriggers();

    // pit fall
    if (this.player.y > MILLER_FIELD.meta.heightPx + FALL_DAMAGE_Y_PAD && this.player.alive) {
      this.hurtPlayer(1, this.player.x + 1);
      if (this.player.alive) {
        this.player.setPosition(this.lastSafe.x, this.lastSafe.y - 6);
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
    }

    // pickups
    this.checkPickups();

    // tower blink
    if (this.towerLight) this.towerLight.setAlpha(0.3 + (Math.sin(this.time.now * 0.004) > 0.6 ? 0.6 : 0));

    // periodic stat flush
    if (this.time.now > this.statFlushAt) {
      this.statFlushAt = this.time.now + 15000;
      this.flushTime();
    }

    this.pushDebug();
  }

  /** Horizontal camera lookahead: lead the view in the facing direction so
   *  drops, drones and the ravine are visible before you arrive. Relaxes to
   *  center when essentially idle (no drift when you stop, turned around).
   *  Phaser tracks (target − followOffset), so a NEGATIVE x offset leads the
   *  view right — mirroring the shipped negative Y that shows the landing
   *  below (both verified empirically via getCameraState). */
  private updateCameraLook(dtSec: number): void {
    const vx = (this.player.body as Phaser.Physics.Arcade.Body).velocity.x;
    this.camLookX = applyCameraLook(this.cameras.main, this.camLookX, this.player.facing, vx, dtSec);
  }

  private updateParallax(dtSec: number): void {
    const sx = this.cameras.main.scrollX;
    this.cloudDrift += dtSec * 0.9;
    this.fogDrift += dtSec * 6;
    this.stars.tilePositionX = sx * 0.05;
    this.clouds.tilePositionX = sx * 0.16 + this.cloudDrift;
    this.hillsBack.tilePositionX = sx * 0.2;
    this.hillsFar.tilePositionX = sx * 0.32;
    this.hillsMid.tilePositionX = sx * 0.52;
    this.fog.tilePositionX = sx * 0.62 + this.fogDrift;
  }

  private updateQuestTriggers(): void {
    const zones = MILLER_FIELD.meta.zones;
    const x = this.player.x;

    if (quests.stepId === 'wake' && Math.abs(x - this.spawnPoint.x) > 52) quests.complete('wake');
    if (quests.stepId === 'avoidCone' && x > zones.avoidCone.x1 + TILE) quests.complete('avoidCone');
    if (quests.stepId === 'reachDoor' && x >= zones.reachDoor.x0) quests.complete('reachDoor');

    // boss trigger: past the opened door
    if (quests.stepId === 'bossFight' && !this.boss && x >= zones.bossTrigger.x0 && this.door.isOpen) {
      this.spawnBoss();
    }

    // once the field is done, the road east lights up and leads to Motel Nowhere
    if (quests.isComplete() && !this.travelling) {
      this.lightExit();
      if (!this.roadHintShown && x > FIELD_EXIT_X - 96) {
        this.roadHintShown = true;
        bus.emit(EVT.toast, { text: 'THE ROAD OUT — FOLLOW THE SIGN EAST TO MOTEL NOWHERE', color: 'orange' });
      }
      if (x >= FIELD_EXIT_X) this.travelToMotel();
    }
  }

  /** the "road out of town" — a dirt road + signpost that runs into a glowing
   *  SIGNAL GATE at the map's edge (no boundary wall). The gate's energy curtain
   *  is dormant until the field is complete, then it wakes and pulses you east. */
  private buildFieldExit(): void {
    const surfaceY = 20 * TILE; // road surface row
    const roadX0 = 157 * TILE;
    const roadX1 = 176 * TILE; // run the road clean off the east edge
    const road = this.add.graphics().setDepth(8);
    road.fillStyle(P.dirt, 1);
    road.fillRect(roadX0, surfaceY, roadX1 - roadX0, 4);
    road.fillStyle(0x5c4a33, 0.55);
    road.fillRect(roadX0, surfaceY, roadX1 - roadX0, 1); // moonlit ruts
    road.fillStyle(P.dirtDark, 0.7);
    road.fillRect(roadX0, surfaceY + 4, roadX1 - roadX0, 2);
    for (let rx = roadX0 + 8; rx < roadX1; rx += 15) {
      road.fillStyle(0x2b2015, 0.5);
      road.fillRect(rx, surfaceY + 2, 3, 1);
    }
    // pines flanking the road as it leaves town (softens the map edge — no wall)
    for (const [tx, s] of [[160 * TILE, 1], [174 * TILE, 1.1], [175 * TILE + 8, 0.9]] as Array<[number, number]>) {
      this.add.image(tx, surfaceY + 1, TEX.pineTree).setOrigin(0.5, 1).setScale(s).setDepth(4).setAlpha(0.9);
    }

    // signpost a little before the gate, pointing you at it
    const sx = 163 * TILE;
    this.add.image(sx, surfaceY, TEX.signpost).setOrigin(0.5, 1).setDepth(10);
    this.exitArrow = this.add
      .image(sx + 17, surfaceY - 22, TEX.routeMarker)
      .setRotation(Math.PI / 2) // chevron → points east
      .setTint(P.warning)
      .setDepth(11)
      .setVisible(false);

    // ---- the SIGNAL GATE: two posts + a glowing energy curtain ----
    const gx = FIELD_EXIT_X;
    const topY = surfaceY - 40;
    const gate = this.add.graphics().setDepth(9);
    // stone posts
    for (const px of [gx - 15, gx + 15]) {
      gate.fillStyle(P.stoneDark, 1);
      gate.fillRect(px - 3, topY, 6, 40);
      gate.fillStyle(P.stone, 1);
      gate.fillRect(px - 3, topY, 2, 40); // moonlit face
      gate.fillStyle(0x0d0f18, 0.6);
      gate.fillRect(px + 1, topY, 1, 40);
    }
    // lintel beam across the top
    gate.fillStyle(P.stoneDark, 1);
    gate.fillRect(gx - 18, topY - 4, 36, 6);
    gate.fillStyle(P.trimCream, 0.25);
    gate.fillRect(gx - 18, topY - 4, 36, 1);
    // a small signal glyph on the lintel
    gate.fillStyle(P.signalDim, 0.9);
    gate.fillRect(gx - 1, topY - 3, 2, 4);

    // the energy curtain filling the arch (crisp reveal-image, tinted; pulses)
    this.exitCurtain = this.add
      .image(gx, surfaceY - 19, TEX.px)
      .setDisplaySize(26, 38)
      .setTint(P.signal)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.06)
      .setDepth(9);
    // smooth wide glow behind the gate (the light spilling out toward you)
    this.exitGlow = this.add
      .image(gx, surfaceY - 20, TEX.glow8)
      .setTint(P.signal)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(3.4, 4)
      .setAlpha(0.08)
      .setDepth(8);
  }

  private lightExit(): void {
    if (this.exitLit) return;
    this.exitLit = true;
    if (this.exitGlow) {
      this.exitGlow.setAlpha(0.4);
      this.tweens.add({ targets: this.exitGlow, alpha: { from: 0.28, to: 0.6 }, scaleX: { from: 3.4, to: 4.2 }, duration: 1300, yoyo: true, repeat: -1 });
    }
    if (this.exitCurtain) {
      this.exitCurtain.setAlpha(0.4);
      this.tweens.add({ targets: this.exitCurtain, alpha: { from: 0.3, to: 0.7 }, duration: 900, yoyo: true, repeat: -1 });
    }
    if (this.exitArrow) {
      this.exitArrow.setVisible(true);
      this.tweens.add({ targets: this.exitArrow, x: '+=5', alpha: { from: 0.6, to: 1 }, duration: 650, yoyo: true, repeat: -1 });
    }
  }

  /** leave Miller Field for Zone 2 — persist the zone switch, load the new quest */
  private travelToMotel(): void {
    this.travelling = true;
    this.flushTime();
    updateSave((s) => {
      s.currentZone = 'motel-nowhere';
      s.currentQuest = 'the-long-night';
      if (!s.completedZones.includes('miller-field')) s.completedZones.push('miller-field');
    });
    quests.load('the-long-night');
    quests.restart(); // → 'arrive'
    audio.transitionWarp();
    bus.emit(EVT.toast, { text: 'MOTEL NOWHERE — VACANCY', color: 'orange' });
    this.cameras.main.fadeOut(500, 6, 3, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.motel);
    });
  }

  private emitSkin(): void {
    const s = activeSkin();
    bus.emit(EVT.skinSelected, { id: s.id, name: s.name, color: s.color, live: false });
  }

  private regenAt = 0;

  /** ANCHOR slow-regen + SPARK machine-recharge passives (per-frame). */
  private updateSkinPassives(dtSec: number, inCone: boolean, body: Phaser.Physics.Arcade.Body): void {
    const ab = skinAbilities();
    // ANCHOR: heal +1 while grounded, still, out of any red cone
    if (ab.slowRegen && this.player.alive && body.blocked.down && !inCone && Math.abs(body.velocity.x) < 6) {
      if (this.time.now >= this.regenAt && this.player.hp < this.player.maxHp) {
        this.regenAt = this.time.now + 2500;
        this.player.heal(1);
        this.fx.floatText(this.player.x, this.player.y - 12, '+1', P.scoutHenry);
      }
    } else {
      this.regenAt = this.time.now + 2500;
    }
    // SPARK: standing near a signal box fast-recharges energy
    if (ab.machineRecharge && this.signalBox && Math.abs(this.player.x - this.signalBox.x) < 24) {
      this.player.energy = Math.min(this.player.effEnergyMax, this.player.energy + 40 * dtSec);
    }
  }

  /** Command Center live-swap → re-skin the current player without respawning. */
  private applySkinLive(id: string): void {
    if (!this.player?.active) return;
    if (activeSkin().id === id) return; // already wearing it (avoids re-entrancy)
    this.player.setSkin(id);
  }

  /** WILLOW signature: a scan outlines every drone's aggro radius + the rig cone. */
  private reconPing(): void {
    (this.droneGroup.getChildren() as ScannerDrone[]).forEach((d) => {
      if (!d.active) return;
      const ring = this.add.image(d.x, d.y, TEX.ring).setTint(P.scoutWill).setDepth(17).setAlpha(0.5);
      ring.setScale((DRONE.aggroRange * 2) / 64);
      this.tweens.add({ targets: ring, alpha: 0, duration: 3000, onComplete: () => ring.destroy() });
      d.cone.pulseVisible(3000);
    });
    if (this.rig) this.rig.cone.pulseVisible(3000);
    bus.emit(EVT.toast, { text: 'RECON PING — EYES MAPPED', color: 'cyan' });
  }

  /** EMP Burst signature (Motel/Chip): the SCAN also emits a shockwave — a cyan
   *  ring that STUNS drones and clears enemy bolts in a radius. */
  private empBurst(px: number, py: number): void {
    const r = SIGNATURE.emp.radius;
    this.fx.scanRing(px, py, r, SIGNATURE.emp.ringMs, P.neonCyan);
    this.fx.flash(P.neonCyan, 80, 0.22);
    clearBoltsInRadius(this.enemyBolts, px, py, r);
    for (const d of this.droneGroup.getChildren() as ScannerDrone[]) {
      if (d.active && Phaser.Math.Distance.Between(px, py, d.x, d.y) <= r) d.stun(SIGNATURE.emp.stunMs / 1000);
    }
    audio.hazardZap();
  }

  private doScan(): void {
    this.player.markScan();
    audio.scanPulse();
    const radius = this.player.scanRadius;
    this.fx.scanRing(this.player.x, this.player.y, radius, SCAN.durationMs);
    this.bumpStat('scansUsed');
    if (skinAbilities().reconPing) this.reconPing();

    const px = this.player.x;
    const py = this.player.y;
    if (hasAbility('emp-burst')) this.empBurst(px, py);
    const within = (x: number, y: number) => Phaser.Math.Distance.Between(px, py, x, y) <= radius;

    let revealedAny = false;
    let revealedBadgePath = false;
    for (const hp of this.hiddenPlatforms) {
      if (!hp.revealed && within(hp.x, hp.y)) {
        hp.reveal(Phaser.Math.Distance.Between(px, py, hp.x, hp.y) * 1.6);
        revealedAny = true;
        if (hp.isBadgePath) revealedBadgePath = true;
      }
    }
    let revealedCue = false;
    for (const m of this.markers) if (!m.revealed && within(m.x, m.y)) { m.reveal(120); revealedCue = true; }
    if (this.badge && !this.badge.revealed && within(this.badge.x, this.badge.y)) { this.badge.reveal(200); revealedCue = true; }
    if (this.willRelic && !this.willRelic.revealed && within(this.willRelic.x, this.willRelic.y)) { this.willRelic.reveal(240); revealedCue = true; }

    if (revealedBadgePath) {
      updateSave((s) => {
        s.flags.revealedHiddenPath = true;
      });
      bus.emit(EVT.toast, { text: 'WILLOW ROUTE MARKERS DETECTED', color: 'cyan' });
    } else if (revealedAny) {
      bus.emit(EVT.toast, { text: 'UNMAPPED PLATFORMS REVEALED', color: 'green' });
    }

    // Chip's signal box — the SPARK badge + log of Chip's Signal Set
    const boxScannedNow = !this.signalBox.scanned && within(this.signalBox.x, this.signalBox.y);
    if (boxScannedNow) {
      this.signalBox.markScanned();
      const log = logById('chip-box-1');
      updateSave((s) => {
        s.flags.chipBoxScanned = true;
        if (!s.discoveredScoutBadges.includes('chip')) s.discoveredScoutBadges.push('chip');
        if (!s.discoveredScoutLogs.includes('chip-box-1')) s.discoveredScoutLogs.push('chip-box-1');
      });
      recordSetPiece('chip', 'badge');
      recordSetPiece('chip', 'log');
      if (log) bus.emit(EVT.scoutLog, { title: log.title, body: log.body, accent: 'chip' });
      this.fx.sparks(this.signalBox.x, this.signalBox.y, P.scoutChip, 10);
      this.checkSetComplete('chip');
    }

    // scan-stun: any drone caught in the pulse freezes briefly (scan is offense too)
    let stunnedAny = false;
    for (const d of this.droneGroup.getChildren() as ScannerDrone[]) {
      if (d.active && within(d.x, d.y)) {
        d.stun(DRONE.scanStunSec);
        stunnedAny = true;
      }
    }

    // scan-secrets: hidden field notes & shard caches revealed near the pulse
    const claimedSecrets = resolveScanSecrets('miller-field', px, py, radius, this.fx);
    for (const id of claimedSecrets) retireSecretCue(this, this.secretCues, id);
    const secretsFound = claimedSecrets.length > 0;

    // boss core exposure
    let bossPinged = false;
    if (this.boss?.alive && Phaser.Math.Distance.Between(px, py, this.boss.core.x, this.boss.core.y) < radius + 30) {
      this.boss.onScanned();
      bossPinged = true;
    }

    // SONAR always answers: if nothing at all was in range, say so (never a silent no-op)
    if (!revealedAny && !revealedCue && !boxScannedNow && !stunnedAny && !secretsFound && !bossPinged) {
      this.fx.floatText(px, py - 14, 'NO ANOMALIES', P.uiDim);
    }

    if (quests.stepId === 'scanTutorial' && revealedAny) quests.complete('scanTutorial');
  }

  /** test hook: fire a scan pulse (bypasses cooldown) */
  apiScan(): void {
    if (this.player?.alive) this.doScan();
  }

  /** test hook: live drone positions + stun state */
  apiDroneStates(): Array<{ x: number; y: number; stunned: boolean }> {
    return (this.droneGroup.getChildren() as ScannerDrone[])
      .filter((d) => d.active)
      .map((d) => ({ x: d.x, y: d.y, stunned: d.stunned }));
  }

  /** test hook: toggle Echo Blink (place / return) */
  apiEchoToggle(): void {
    this.player?.toggleEcho();
  }

  /** test hook: where a pit-fall would respawn the player (last safe ground) */
  get apiLastSafe(): { x: number; y: number } {
    return this.lastSafe;
  }

  /* --- Miller-Field tutorial: a "[Q] SCAN" label floats over scannable scout items
   *     (Chip's box, Will's Field Note, shard caches) when you're near + it's unclaimed.
   *     First level only — Motel/other zones don't build these. --- */
  private buildScanHints(): void {
    this.scanHints = [];
    const mk = (x: number, y: number, done: () => boolean) => {
      const label = this.add
        .text(x, y - 16, '[Q] SCAN', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: css(P.signal),
          backgroundColor: 'rgba(5,7,15,0.7)',
          padding: { x: 3, y: 2 },
        })
        .setOrigin(0.5, 1)
        .setDepth(60)
        .setResolution(2)
        .setVisible(false);
      this.scanHints.push({ x, y, label, done });
    };
    if (this.signalBox) mk(this.signalBox.x, this.signalBox.y - 6, () => this.signalBox.scanned);
    for (const sec of ZONE_SECRETS['miller-field'] ?? []) {
      mk(sec.x, sec.y, () => getSave().foundSecrets.includes(sec.id));
    }
  }

  private updateScanHints(): void {
    if (!this.player?.active) return;
    const px = this.player.x;
    const py = this.player.y;
    for (const h of this.scanHints) {
      h.label.setVisible(!h.done() && Math.abs(px - h.x) < 46 && Math.abs(py - h.y) < 54);
    }
  }

  private checkPickups(): void {
    // Will's badge
    if (this.badge && this.badge.revealed && !this.badge.collected) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.badge.x, this.badge.y) < 14) {
        this.badge.collect();
        audio.badgePickup();
        this.fx.flash(P.scoutWill, 120);
        this.fx.explode(this.badge.x, this.badge.y, P.scoutWill, 14);
        const log = logById('will-log-1');
        updateSave((s) => {
          s.flags.willBadgeCollected = true;
          if (!s.discoveredScoutBadges.includes('will')) s.discoveredScoutBadges.push('will');
          if (!s.discoveredScoutLogs.includes('will-log-1')) s.discoveredScoutLogs.push('will-log-1');
        });
        if (log) bus.emit(EVT.scoutLog, { title: log.title, body: log.body, accent: 'will' });
        bus.emit(EVT.toast, { text: 'SCOUT BADGE — WILL / WILLOW (1/5)', color: 'cyan' });
        recordSetPiece('will', 'badge');
        recordSetPiece('will', 'log');
        this.badge = undefined;
        this.checkSetComplete('will');
      }
    }
    // scout relics (the power piece of a Signal Set) — Will's here; Chip's
    // Power Cell lives in Motel Nowhere (his home zone), where SPARK completes
    this.tryRelicPickup('will', this.willRelic, () => (this.willRelic = undefined));
    // Signal Fragment — magnetizes to the player, then collects
    if (this.fragment && this.fragment.revealed && !this.fragment.collected) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.fragment.x, this.fragment.y);
      if (d < 64) this.fragment.magnetTo(this.player.x, this.player.y, this.game.loop.delta / 1000);
      if (d < 16) this.collectFragment();
    }
  }

  private tryRelicPickup(scoutId: string, relic: Collectible | undefined, clear: () => void): void {
    if (!relic || !relic.revealed || relic.collected) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, relic.x, relic.y) >= 15) return;
    const skin = skinByScout(scoutId);
    const color = skin?.color ?? P.signal;
    relic.collect();
    audio.badgePickup();
    this.fx.flash(color, 120);
    this.fx.explode(relic.x, relic.y, color, 14);
    recordSetPiece(scoutId, 'relic');
    bus.emit(EVT.toast, { text: `RELIC RECOVERED — ${skin?.name ?? scoutId.toUpperCase()}`, color: 'green' });
    clear();
    this.checkSetComplete(scoutId);
  }

  /* ------------------------------ quest set-pieces ---------------------------- */

  private onDroneDestroyed(): void {
    this.bumpStat('enemiesDefeated');
    if (quests.stepId === 'destroyDrones') {
      quests.dronesDestroyed++;
      bus.emit(EVT.toast, { text: `DRONE DOWN — ${Math.min(quests.dronesDestroyed, 2)}/2`, color: 'orange' });
      if (quests.dronesDestroyed >= 2) {
        updateSave((s) => {
          s.flags.dronesCleared = true;
        });
        quests.complete('destroyDrones');
      }
    }
  }

  enterBlipstream(viaDebug: boolean): void {
    if (this.isPaused) return;
    if (quests.stepId === 'enterNode' && !viaDebug) quests.complete('enterNode');
    audio.transitionWarp();
    this.fx.staticBurst(520);
    this.fx.flash(P.signal, 200);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.flushTime();
    this.registry.set('blipReturnScene', SCENES.field);
    this.registry.set('blipZoneLabel', 'Blipstream Node A');
    this.time.delayedCall(430, () => {
      bus.emit(EVT.sceneChanged, { scene: SCENES.blipstream, zone: 'Blipstream Node A' });
      this.scene.switch(SCENES.blipstream);
    });
  }

  private onWake(): void {
    audio.playMusic('field'); // restore field music after a Blipstream visit
    bus.emit(EVT.sceneChanged, { scene: SCENES.field, zone: 'Miller Field' });
    quests.emitObjective();
    this.player.refreshHud();
    this.fx.staticBurst(300);

    if (this.registry.get('nodeJustSolved') === true) {
      this.registry.set('nodeJustSolved', false);
      this.applyNodeSolved();
    }
  }

  /** node A routed — persist flags, open the door, advance the quest */
  applyNodeSolved(): void {
    updateSave((s) => {
      s.flags.nodeACompleted = true;
      s.flags.doorOpened = true;
    });
    if (quests.stepId === 'solvePuzzle') quests.complete('solvePuzzle');
    this.portal.setCompleted();
    this.time.delayedCall(500, () => {
      this.door.open();
      this.cameras.main.pan(this.door.sprite.x, this.door.sprite.y, 700, 'Sine.easeInOut', false, (_c, prog) => {
        if (prog === 1) {
          this.time.delayedCall(600, () => {
            this.cameras.main.pan(this.player.x, this.player.y, 500, 'Sine.easeInOut');
            this.cameras.main.once(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, () => {
              this.cameras.main.startFollow(this.player, true, 0.12, 0.16);
              this.cameras.main.setFollowOffset(0, CAM.lookOffsetY);
            });
          });
        }
      });
      bus.emit(EVT.toast, { text: 'THE DOOR RESPONDS', color: 'green' });
    });
  }

  spawnBoss(): void {
    const arena = MILLER_FIELD.meta.arena;
    const groundY = arena.surfaceY; // arena floor (from level meta)
    this.boss = new ScarecrowAntennaBoss(this, arena.centerX, groundY, {
      fx: this.fx,
      fireRadialBolt: (x, y, vx, vy) => {
        fireFrom(this.enemyBolts, x, y, vx, vy, 3200);
      },
      summonDrones: (count) => {
        for (let i = 0; i < count; i++) {
          const sx = arena.centerX + (i === 0 ? -70 : 70);
          this.spawnDrone(sx, groundY - 70, 40);
        }
        audio.bossWarning();
      },
      damagePlayer: (amount, fromX) => this.hurtPlayer(amount, fromX),
      getPlayer: () => ({ x: this.player.x, y: this.player.y, alive: this.player.alive }),
      onDefeated: () => this.onBossDefeated(),
    });

    // seal the arena (walls sized off the arena floor)
    for (const wx of [arena.leftPx, arena.rightPx]) {
      const wall = this.physics.add.staticImage(wx, groundY - 4 * TILE, TEX.px).setVisible(false);
      (wall.body as Phaser.Physics.Arcade.StaticBody).setSize(8, 160);
      this.physics.add.collider(this.player, wall);
      this.arenaWalls.push(wall as unknown as Phaser.Physics.Arcade.Image);
    }

    // core takes pulse hits when exposed (Pulse Resonance + SPARK surge scale it)
    this.physics.add.overlap(this.playerBolts, this.boss.core, (_core, bolt) => {
      const b = bolt as Projectile;
      if (!b.active || !this.boss?.exposed) return;
      b.kill();
      const dmg = this.player.coreDamage * ((b as unknown as { surge?: boolean }).surge ? 2 : 1);
      this.boss.hitCore(dmg);
    });

    this.boss.spawn();
  }

  private onBossDefeated(): void {
    this.arenaWalls.forEach((w) => w.destroy());
    this.arenaWalls = [];
    // clear leftover hostile bolts + summoned drones
    (this.enemyBolts.getChildren() as Projectile[]).forEach((b) => b.active && b.kill());
    (this.droneGroup.getChildren() as ScannerDrone[]).slice().forEach((d) => d.active && d.die());
    updateSave((s) => {
      s.flags.bossDefeated = true;
      s.playerStats.enemiesDefeated += 1;
    });
    if (quests.stepId === 'bossFight') quests.complete('bossFight');
    this.spawnFragment();
    bus.emit(EVT.toast, { text: 'SIGNAL SOURCE COLLAPSED', color: 'green' });
  }

  spawnFragment(): void {
    const arena = MILLER_FIELD.meta.arena;
    this.fragment = new Collectible(this, arena.centerX, arena.surfaceY - 2 * TILE, 'fragment', false);
  }

  /** Test API: drive the real set-complete → unlock + Scout Echo path. */
  apiCompleteSet(scoutId: string): void {
    recordSetPiece(scoutId, 'badge');
    recordSetPiece(scoutId, 'log');
    recordSetPiece(scoutId, 'relic');
    this.checkSetComplete(scoutId);
  }

  /** Test API: force-collect the fragment (spawning it if needed, never twice) */
  apiCollectFragment(): void {
    if (getSave().flags.firstFragmentCollected) return;
    if (!this.fragment) this.spawnFragment();
    this.collectFragment();
  }

  private collectFragment(): void {
    if (!this.fragment) return;
    this.fragment.collect();
    this.fragment = undefined;
    audio.fragmentPickup();
    this.fx.flash(P.signalGreen, 220);
    this.fx.shake(0.004, 200);
    updateSave((s) => {
      s.signalFragments = Math.max(1, s.signalFragments + 1);
      s.flags.firstFragmentCollected = true;
    });
    // Channel A: the zone's signature ability is earned with the fragment
    const ability = progression.grantZoneSignature('miller-field');
    bus.emit(EVT.fragmentCount, { count: getSave().signalFragments });
    if (quests.stepId === 'collectFragment') quests.complete('collectFragment');
    bus.emit(EVT.scoutLog, {
      title: 'SIGNAL FRAGMENT SECURED — 1 / ?',
      body:
        'The field exhales. Static settles into ordinary dusk.\n\nFragment archived. New Command Center entry decrypted: FRAGMENT ANALYSIS 01.' +
        (ability ? `\n\n◆ ABILITY UNLOCKED — ${ability.name}\n${ability.description}` : '') +
        '\n\nDirective unchanged: stay unknown.',
      accent: 'fragment',
    });
    this.flushTime();
  }

  /* --------------------------------- plumbing -------------------------------- */

  hurtPlayer(amount: number, fromX: number): void {
    if (!this.player.alive) return;
    const applied = this.player.damage(amount, fromX);
    if (applied && this.player.hp <= 0) this.onPlayerDeath();
  }

  private onPlayerDeath(): void {
    if (this.gameOverShown) return;
    this.gameOverShown = true;
    updateSave((s) => {
      s.playerStats.deaths += 1;
    });
    this.fx.explode(this.player.x, this.player.y, P.signal, 22);
    this.fx.staticBurst(600);
    this.player.setVisible(false);
    this.physics.pause();
    this.time.delayedCall(700, () => {
      this.scene.launch(SCENES.gameOver, { from: SCENES.field });
      this.scene.pause();
    });
  }

  /** first-run how-to-play card — leads with SONAR, the core mechanic */
  private showHowToPlay(): void {
    bus.emit(EVT.tutorial, {
      title: 'FIELD BRIEFING',
      accent: 'will',
      html: `
        <p class="tut-lead">You are <b>CONTACT-47</b> — a blip the Interpretation Engine wants to label. Move through Miller Field and stay unknown.</p>
        <div class="tut-hero">
          <div class="tut-hero-key">SONAR<span>RIGHT&nbsp;CLICK&nbsp;·&nbsp;Q&nbsp;·&nbsp;LT</span></div>
          <div class="tut-hero-desc"><b>Right-click</b> anytime — even mid-jump — to reveal <b>hidden platforms</b>, route markers and watching eyes. <b>Stuck? Sonar first.</b></div>
        </div>
        <table class="tut-controls">
          <tr><td class="tut-k">A / D&nbsp;&nbsp;·&nbsp;&nbsp;← →</td><td>Move</td></tr>
          <tr><td class="tut-k">SPACE&nbsp;&nbsp;·&nbsp;&nbsp;A</td><td>Jump — <b>hold to hover</b></td></tr>
          <tr><td class="tut-k">X&nbsp;&nbsp;·&nbsp;&nbsp;LEFT CLICK</td><td>Pulse shot</td></tr>
          <tr><td class="tut-k">SHIFT&nbsp;&nbsp;·&nbsp;&nbsp;RB / LB</td><td>Dash</td></tr>
          <tr><td class="tut-k">E&nbsp;&nbsp;·&nbsp;&nbsp;B</td><td>Interact / enter nodes</td></tr>
        </table>`,
    });
  }

  private togglePause(): void {
    if (uiOverlayActive()) return; // a shell modal owns ESC right now
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

  private bumpStat(key: 'pulseShotsFired' | 'scansUsed' | 'enemiesDefeated'): void {
    // cheap in-memory bump; persisted on the next autosave/updateSave call
    const s = getSave();
    s.playerStats[key] += 1;
  }

  private flushTime(): void {
    const elapsed = Math.round((this.time.now - this.sessionStart) / 1000);
    if (elapsed <= 0) return;
    this.sessionStart = this.time.now;
    updateSave((s) => {
      s.playerStats.timePlayedSec += elapsed;
    });
  }

  private debugEmitAt = 0;

  private pushDebug(): void {
    if (this.time.now < this.debugEmitAt) return;
    this.debugEmitAt = this.time.now + 200;
    bus.emit(EVT.debugState, {
      fps: Math.round(this.game.loop.actualFps),
      scene: 'FieldScene',
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      quest: quests.stepId,
      enemies: this.droneGroup.countActive(true),
      playerBolts: this.playerBolts.countActive(true),
      enemyBolts: this.enemyBolts.countActive(true),
      classify: `${Math.round(this.classify.value)} ${this.classify.tier}`,
      energy: Math.round(this.player.energy),
      hp: this.player.hp,
      boss: this.boss ? `${this.boss.state} ${this.boss.hp}hp` : '—',
    });
  }

  private onShutdown(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.rig?.destroy();
    this.boss?.destroy();
    unregisterScene('field');
  }
}
