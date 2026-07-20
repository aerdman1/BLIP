/**
 * CHAGRIN FALLS HIGH — Zone 3 overworld (Tiger Stadium).
 * Friday-night-lights stealth: rotating light-tower cones you time like rhythm,
 * a SCOREBOARD that tallies KNOWN vs UNKNOWN (the detection meter made diegetic),
 * and Henry ANCHOR safe zones that declassify + heal between sweeps. Dive through
 * the rec pool into the inverted underwater node, surface near the fifty, and
 * bring down THE WEATHER BALLOON. Mirrors the MotelScene structure/systems.
 */
import Phaser from 'phaser';
import {
  CLASSIFY,
  DRONE,
  EVT,
  FALL_DAMAGE_Y_PAD,
  PROGRESSION,
  STADIUM,
  VIEW_H,
  VIEW_W,
  PALETTE as P,
  PULSE,
  RENDER_ZOOM,
  SCENES,
  SIGNATURE,
  TEX,
  TILE,
  css,
} from '../config';
import { TIGER_STADIUM, cellAt, surfaceYAt, walkLevel } from '../data/levels';
import { BlipSideNode } from '../entities/BlipSideNode';
import { logById } from '../data/scouts';
import { skinByScout } from '../data/skins';
import { Collectible } from '../entities/Collectible';
import { DetectionCone } from '../entities/DetectionCone';
import { Player } from '../entities/Player';
import { Projectile, chainToNextEnemy, clearBoltsInRadius, fireFrom, makeProjectileGroup, ricochetBolt } from '../entities/Projectile';
import { ScannerDrone, type DroneDeps } from '../entities/ScannerDrone';
import { ScoutEcho } from '../entities/ScoutEcho';
import { Spotter } from '../entities/Spotter';
import { WeatherBalloonBoss } from '../entities/WeatherBalloonBoss';
import { audio } from '../systems/AudioSystem';
import { ClassificationSystem } from '../systems/ClassificationSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { attachScreenFilter } from '../systems/ScreenFilter';
import { bus } from '../systems/EventBus';
import { PlayerInput } from '../systems/InputSystem';
import { quests } from '../systems/QuestSystem';
import { addShards, getSave, hasAbility, recordSetPiece, setProgress, unlockSkin, updateSave } from '../systems/SaveSystem';
import { progression } from '../systems/ProgressionSystem';
import { activeSkin } from '../systems/SkinState';
import { registerScene, unregisterScene } from '../systems/TestAPI';
import { uiOverlayActive } from '../systems/UIState';

// local tuning (kept out of config.ts to avoid a merge conflict with the
// concurrent config edit)
const SWEEP_LOOKAHEAD_MS = 560; // how far ahead the ghost "next sweep" spot previews the beam
const TRACK_SURFACE_Y = TIGER_STADIUM.meta.arena.surfaceY; // track surface the cones sweep across

interface LightTower {
  cone: DetectionCone;
  headX: number;
  headY: number;
  phase: number;
  spot: Phaser.GameObjects.Image; // where the beam hits the track RIGHT NOW
  ghost: Phaser.GameObjects.Image; // where it will sweep to next (telegraph)
  curAng: number; // the angle actually being rendered (lerps when locked/unlocking)
  locked: boolean; // stage 1: stopped sweeping, tracking the player's x
  unblendMs: number; // >0 while easing back onto the sweep after a release
}
/**
 * A solid light-occluder. If the segment from a light head to the player crosses
 * one of these, the player is NOT lit — hiding becomes positional instead of
 * "stand on the green pad".
 */
interface CoverRect {
  rect: Phaser.Geom.Rectangle;
  label?: Phaser.GameObjects.Text;
}
interface SafeZone {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
  glow: Phaser.GameObjects.Image;
}

export class StadiumScene extends Phaser.Scene {
  player!: Player;
  private input2!: PlayerInput;
  fx!: EffectsSystem;
  classify = new ClassificationSystem();

  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private blipNode?: BlipSideNode;
  private lightTowers: LightTower[] = [];
  private safeZones: SafeZone[] = [];
  private coverRects: CoverRect[] = [];

  /* ---- threat ladder (SPOTTED → TRACKED → KNOWN) ---- */
  private threatStage = 0;
  private spotter?: Spotter;
  private beamMs = 0; // continuous time lit, drives the LIGHT BURNS ramp
  private lastLitAt = -99999; // for the post-exposure decay hold
  private floodUntil = 0; // >now while the stage-3 stadium flood is live
  private floodCooldownUntil = 0;
  private caughtUntil = 0; // brief lockout after being classified
  private lastUnseen = { x: 0, y: 0 }; // last grounded spot the lights could NOT read
  private vignette?: Phaser.GameObjects.Image; // hot-white edge glow that closes in
  private coverHintShown = false;
  private spotterHintShown = false;

  // scoreboard readout (the KNOWN/UNKNOWN detection meter, made diegetic)
  private scoreValue?: Phaser.GameObjects.Text;
  private scoreBar?: Phaser.GameObjects.Graphics;
  private scorePos = { x: 0, y: 0 };

  playerBolts!: Phaser.Physics.Arcade.Group;
  enemyBolts!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private ventDrones: ScannerDrone[] = [];

  boss?: WeatherBalloonBoss;
  private bossDeathHandled = false;
  private arenaWalls: Phaser.Physics.Arcade.Image[] = [];

  private badge?: Collectible;
  private relic?: Collectible;
  private lockerCache?: Collectible;
  private fragment?: Collectible;

  private poolPos = { x: 0, y: 0 };
  private healAt = 0;
  private crowdSwellUntil = 0;
  private exitToasted = false;

  // stealth-legibility feedback
  private alertIcon?: Phaser.GameObjects.Text; // floats over the player: SEEN vs HIDDEN
  private anchorHintShown = false;
  private poolHintShown = false;
  private crossedCleanToasted = false;

  private spawnPoint = { x: 0, y: 0 };
  private lastSafe = { x: 0, y: 0 };
  private sky!: Phaser.GameObjects.Image;
  private stars!: Phaser.GameObjects.TileSprite;
  private clouds!: Phaser.GameObjects.TileSprite;
  private skyline!: Phaser.GameObjects.TileSprite;
  private stands!: Phaser.GameObjects.TileSprite;
  private fog!: Phaser.GameObjects.TileSprite;
  private cloudDrift = 0;
  private fogDrift = 0;
  private isPaused = false;
  private gameOverShown = false;
  private statFlushAt = 0;
  private sessionStart = 0;
  private unsubs: Array<() => void> = [];

  constructor() {
    super(SCENES.stadium);
  }

  create(): void {
    const def = TIGER_STADIUM;
    this.fx = new EffectsSystem(this);
    attachScreenFilter(this, true); // level screen filter (dialed down for gameplay)
    this.input2 = new PlayerInput(this);
    this.isPaused = false;
    this.gameOverShown = false;
    this.sessionStart = this.time.now;
    this.lightTowers = [];
    this.safeZones = [];
    this.coverRects = [];
    this.ventDrones = [];
    this.threatStage = 0;
    this.spotter = undefined;
    this.beamMs = 0;
    this.floodUntil = 0;
    this.floodCooldownUntil = 0;
    this.caughtUntil = 0;
    this.coverHintShown = false;
    this.spotterHintShown = false;
    this.arenaWalls = [];
    this.boss = undefined;
    this.bossDeathHandled = false;
    this.fragment = undefined;
    this.exitToasted = false;
    this.anchorHintShown = false;
    this.poolHintShown = false;
    this.crossedCleanToasted = false;

    this.buildParallax();
    this.buildWorld();
    this.dressPool();
    this.buildCover();
    this.lastUnseen = { ...this.spawnPoint };

    // LIGHT BURNS — a hot-white edge glow that physically closes in the longer
    // the Engine holds a read on you. Purely a readout of `classify.value`.
    this.vignette = this.add
      .image(VIEW_W / 2, VIEW_H / 2, TEX.stadiumVignette)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(P.scoreboardKnown)
      .setDisplaySize(VIEW_W, VIEW_H)
      .setAlpha(0);

    // alert badge that rides above the player — the single clearest read of
    // "the lights SEE you" vs "you're HIDDEN" (shadow / anchor / dash)
    this.alertIcon = this.add
      .text(this.player.x, this.player.y - 18, '', { fontFamily: 'monospace', fontSize: '9px', color: css(P.scoreboardKnown), fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(20)
      .setResolution(2)
      .setAlpha(0);

    this.physics.world.setBounds(0, -VIEW_H, def.meta.widthPx, def.meta.heightPx + VIEW_H);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.cameras.main.setZoom(RENDER_ZOOM);
    this.cameras.main.setBounds(0, 0, def.meta.widthPx, def.meta.heightPx);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.14);
    this.cameras.main.setDeadzone(46, 30); // small vertical deadzone for the bleacher/pool verticality
    this.cameras.main.setFollowOffset(0, -12); // look-down bias shows landings on the big drops
    this.cameras.main.fadeIn(500, 5, 7, 15);

    this.wireCollisions();
    this.applySaveState();
    this.setupBlipSideNode();

    if (!this.scene.isActive(SCENES.ui)) this.scene.launch(SCENES.ui);

    quests.load('friday-night-lights');
    quests.init();
    this.player.refreshHud();
    audio.playMusic('stadium');
    bus.emit(EVT.fragmentCount, { count: getSave().signalFragments });
    bus.emit(EVT.sceneChanged, { scene: SCENES.stadium, zone: 'Chagrin Falls High' });

    if (quests.stepId === 'arrive') this.time.delayedCall(650, () => this.showHowToPlay());

    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.unsubs.push(bus.on(EVT.uiResume, () => this.setPaused(false)));
    this.unsubs.push(bus.on(EVT.debugGotoBlipstream, () => this.enterUnderwater(true)));
    this.unsubs.push(bus.on(EVT.skinSelected, (d) => this.applySkinLive((d as { id: string }).id)));
    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    registerScene('stadium', this);
  }

  /* ------------------------------- construction ------------------------------ */

  /**
   * Depth-graded parallax: the further back, the more atmospheric/painterly
   * (smooth LINEAR gradients, aerial haze, soft bloom) — so crisp pixel
   * foreground reads against a realistic-feeling distance (HD-2D "pixel shot on
   * film"). Nearest layers stay pixel-sharp; the play surface is untouched.
   */
  private buildParallax(): void {
    // 0 — smooth atmospheric sky (painterly gradient + warm horizon bloom)
    this.sky = this.add.image(0, 0, TEX.stadiumSky).setOrigin(0).setScrollFactor(0).setDepth(0);
    this.sky.setDisplaySize(VIEW_W, VIEW_H);
    // soft moon + halo, high left
    this.add.image(92, 52, TEX.stadiumMoon).setScrollFactor(0.02, 0.02).setDepth(0).setAlpha(0.95);
    // 1 — crisp stars + drifting hazy clouds
    this.stars = this.add.tileSprite(0, 0, VIEW_W, 150, TEX.stadiumStars).setOrigin(0).setScrollFactor(0).setDepth(1).setAlpha(0.85);
    this.clouds = this.add.tileSprite(0, 16, VIEW_W, 110, TEX.stadiumClouds).setOrigin(0).setScrollFactor(0).setDepth(1).setAlpha(0.9);
    // 2 — aerial-perspective town skyline + atmospheric haze (distance softens)
    this.skyline = this.add.tileSprite(0, VIEW_H - 150, VIEW_W, 120, TEX.stadiumSkyline).setOrigin(0).setScrollFactor(0).setDepth(2).setAlpha(0.95);
    this.add.image(0, VIEW_H - 110, TEX.stadiumHaze).setOrigin(0).setScrollFactor(0).setDepth(2).setAlpha(0.62).setDisplaySize(VIEW_W, 84);
    // HERO — the distant Chagrin falls on the horizon (the town is a waterfall town)
    this.add.image(372, VIEW_H - 118, TEX.stadiumGorge).setOrigin(0.5, 1).setScrollFactor(0.05, 0.02).setDepth(2).setAlpha(0.6);
    // a cool rec-pool shimmer glowing low on the horizon past the fence
    this.add.image(300, VIEW_H - 120, TEX.glow8).setScale(7).setTint(P.poolShimmer).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.09).setScrollFactor(0.06, 0.02).setDepth(2);
    // 3 — mid-far stands + press box
    this.stands = this.add.tileSprite(0, VIEW_H - 132, VIEW_W, 92, TEX.stadiumBleachersFar).setOrigin(0).setScrollFactor(0).setDepth(3).setAlpha(0.92);
    // 4 — volumetric beams CRISSCROSSING up off the distant towers into the mist
    //     (the iconic Friday-night-lights read; drawn over the stands)
    const beams: Array<[number, number]> = [[58, -13], [196, 9], [330, -9], [452, 13]];
    for (const [bx, base] of beams) {
      const beam = this.add
        .image(bx, VIEW_H - 96, TEX.lightBeamUp)
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setDepth(4)
        .setAngle(base)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.6);
      this.tweens.add({ targets: beam, angle: { from: base - 4, to: base + 4 }, alpha: { from: 0.42, to: 0.78 }, duration: 3800 + Math.abs(bx) * 7, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // 5 — drifting low field-fog (merges the distance into the play space)
    this.fog = this.add.tileSprite(0, VIEW_H - 120, VIEW_W, 64, TEX.stadiumFog).setOrigin(0, 0).setScrollFactor(0).setDepth(5).setAlpha(0.5);
    // 11 — a light cinematic vignette (frames the edges; foreground stays bright)
    this.add.image(0, 0, TEX.stadiumVignette).setOrigin(0).setScrollFactor(0).setDepth(11).setDisplaySize(VIEW_W, VIEW_H).setAlpha(0.4);
  }

  private buildWorld(): void {
    const def = TIGER_STADIUM;
    this.solids = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();
    this.playerBolts = makeProjectileGroup(this, TEX.boltPlayer, PULSE.maxActive);
    this.enemyBolts = makeProjectileGroup(this, TEX.boltEnemy, DRONE.maxBolts + 20);

    walkLevel(def, (ch, col, row, x, y) => {
      switch (ch) {
        case '#': {
          const surface = cellAt(def, col, row - 1) !== '#';
          const t = this.solids.create(x, y, surface ? TEX.fieldTurf : TEX.fieldSoil) as Phaser.Physics.Arcade.Image;
          t.setDepth(6);
          (t.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 16);
          // chalk yard-line on the exposed turf surface (decor only)
          if (surface && col % 6 === 0) {
            this.add.image(x, y - 8, TEX.fieldStripe).setDepth(7).setAlpha(0.5);
          }
          break;
        }
        case '=': {
          const t = this.solids.create(x, y, TEX.bleacherRow) as Phaser.Physics.Arcade.Image;
          t.setDepth(6);
          (t.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 8).setOffset(0, 0);
          break;
        }
        case 'T': this.addLightTower(x, y); break;
        case 'S': this.addScoreboard(x, y); break;
        case 'G': this.addSafeZone(x, y); break;
        case 'n': this.addPoolNode(x, y); break;
        case 'B': /* Weather Balloon spawns on the boss trigger at arena.centerX */ break;
        case 'b': this.badge = new Collectible(this, x, y, 'badge-henry', false, P.scoutHenry); break;
        case 'V': this.relic = new Collectible(this, x, y, 'relic-henry', false, P.scoutHenry); break;
        case 'k': this.lockerCache = new Collectible(this, x, y, 'cache', false, P.warning); break;
        case 'r': this.addBanner(x, y); break;
        case 'f': this.add.image(x, y, TEX.fence).setDepth(5); break; // center-anchored: feet land on the surface one row below
        case 'P':
          this.spawnPoint = { x, y: y - 2 };
          this.lastSafe = { ...this.spawnPoint };
          this.player = new Player(this, x, y - 2, this.fx);
          this.player.setSkin(getSave().selectedSkin);
          this.emitSkin();
          break;
      }
    });
  }

  private addLightTower(x: number, y: number): void {
    // the pole stands on the field; the light HEAD sits high so the cone fans
    // down over the track where the player crosses
    this.add.image(x, y + 8, TEX.lightTower).setOrigin(0.5, 1).setDepth(9);
    const headY = y + 8 - STADIUM.poleHeight;
    this.add.image(x, headY, TEX.glow8).setScale(3).setTint(P.nightBloom).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setDepth(9);
    const cone = new DetectionCone(this, STADIUM.lightConeLength, STADIUM.lightConeHalfAngleDeg, P.nightBloom);
    cone.setApex(x, headY);
    // where the beam pools on the TRACK — a bright disc the player reads at foot
    // level (the cone shows the shape; the spot shows exactly where it bites now)
    const spot = this.add
      .image(x, TRACK_SURFACE_Y - 2, TEX.glow8)
      .setScale(1.8)
      .setTint(P.scoreboardKnown)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8)
      .setAlpha(0.5);
    // faint leading ghost = where the sweep is HEADED next (telegraph)
    const ghost = this.add
      .image(x, TRACK_SURFACE_Y - 2, TEX.glow8)
      .setScale(1.3)
      .setTint(P.warning)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8)
      .setAlpha(0.22);
    this.lightTowers.push({
      cone,
      headX: x,
      headY,
      phase: x * 0.7,
      spot,
      ghost,
      curAng: Math.PI / 2,
      locked: false,
      unblendMs: 0,
    });
  }

  /* --------------------------------- COVER ---------------------------------- */

  /**
   * REAL COVER — promote the stadium's decorative geometry into functional
   * light-occluders, plus two sideline props on the gauntlet. Each entry is a
   * solid box; a light head can't read through one. Cheap segment-vs-rect only.
   */
  private buildCover(): void {
    // dugout roof over the sunken bowl (cols 56–64), press-box overhang, the
    // under-stand gap on the bleacher base, and two sideline props on the run.
    const slabs: Array<{ x0: number; y0: number; x1: number; y1: number; label: string }> = [
      { x0: 56 * TILE, y0: 484, x1: 65 * TILE, y1: 502, label: 'DUGOUT ROOF' },
      { x0: 80 * TILE, y0: 446, x1: 96 * TILE, y1: 462, label: 'UNDER THE STANDS' },
      { x0: 96 * TILE, y0: 166, x1: 107 * TILE, y1: 182, label: 'PRESS-BOX OVERHANG' },
    ];
    for (const s of slabs) {
      const w = s.x1 - s.x0;
      const h = s.y1 - s.y0;
      this.add
        .tileSprite(s.x0, s.y0, w, h, TEX.coverSlab)
        .setOrigin(0, 0)
        .setDepth(7);
      this.pushCover(s.x0, s.y0, s.x1, s.y1, s.label, s.x0 + w / 2, s.y1 + 10);
    }

    // sideline props on the LIGHTS gauntlet — the two towers there (cols 40, 50)
    // can be broken by putting one of these between you and the beam.
    const props: Array<{ x: number; tex: string; w: number; h: number; label: string }> = [
      { x: 35 * TILE + 8, tex: TEX.equipCart, w: 26, h: 26, label: 'EQUIPMENT CART' },
      { x: 45 * TILE + 8, tex: TEX.blockSled, w: 26, h: 22, label: 'BLOCKING SLED' },
    ];
    for (const p of props) {
      // stand it on the track surface; it is decor + occluder, never a collider
      const bottom = TRACK_SURFACE_Y;
      this.add.image(p.x, bottom, p.tex).setOrigin(0.5, 1).setDepth(8);
      this.pushCover(p.x - p.w / 2, bottom - p.h, p.x + p.w / 2, bottom, p.label, p.x, bottom - p.h - 9);
    }
  }

  private pushCover(x0: number, y0: number, x1: number, y1: number, label: string, lx: number, ly: number): void {
    const text = this.add
      .text(lx, ly, label, { fontFamily: 'monospace', fontSize: '6px', color: css(P.bleacher), fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(10)
      .setResolution(2)
      .setAlpha(0);
    this.coverRects.push({ rect: new Phaser.Geom.Rectangle(x0, y0, x1 - x0, y1 - y0), label: text });
  }

  /** does any cover box sit on the segment from (ax,ay) to (bx,by)? */
  private isOccluded(ax: number, ay: number, bx: number, by: number): boolean {
    const line = new Phaser.Geom.Line(ax, ay, bx, by);
    for (const c of this.coverRects) {
      if (Phaser.Geom.Intersects.LineToRectangle(line, c.rect)) return true;
    }
    return false;
  }

  /** shared with the Spotter: is this sightline broken, or is the player anchored? */
  private sightlineBroken(ax: number, ay: number, px: number, py: number): boolean {
    return this.isOccluded(ax, ay, px, py) || this.isInSafeZone(px, py);
  }

  private isInSafeZone(px: number, py: number): boolean {
    return this.safeZones.some((z) => Math.abs(px - z.x) < z.halfW && Math.abs(py - z.y) < z.halfH);
  }

  /** true while the player's body is tucked inside/behind a cover box */
  private isUnderCover(): boolean {
    const px = this.player.x;
    const py = this.player.y;
    return this.coverRects.some((c) => Phaser.Geom.Rectangle.Contains(c.rect, px, py - 10) || Phaser.Geom.Rectangle.Contains(c.rect, px, py));
  }

  /** subtle proximity labels — teach cover the same way ANCHOR zones teach themselves */
  private updateCoverLabels(): void {
    const px = this.player.x;
    const py = this.player.y;
    for (const c of this.coverRects) {
      if (!c.label) continue;
      const d = Phaser.Math.Distance.Between(px, py, c.rect.centerX, c.rect.centerY);
      const want = d < STADIUM.coverLabelRange ? 0.55 : 0;
      const cur = c.label.alpha;
      if (Math.abs(cur - want) > 0.01) c.label.setAlpha(Phaser.Math.Linear(cur, want, 0.12));
    }
  }

  /** angle of a tower's sweep at time t (mirrors the update() cone drive) */
  private sweepAngleAt(l: LightTower, t: number): number {
    return Math.PI / 2 + Phaser.Math.DegToRad(STADIUM.lightSweepDeg / 2) * Math.sin((t / STADIUM.lightSweepPeriodMs) * Math.PI * 2 + l.phase);
  }

  /** x where a tower's centerline meets the track surface, at angle `ang` */
  private sweepGroundX(l: LightTower, ang: number): number {
    const dirY = Math.sin(ang);
    if (dirY < 0.05) return l.headX; // near-horizontal: clamp to the pole
    const tt = (TRACK_SURFACE_Y - l.headY) / dirY;
    return l.headX + Math.cos(ang) * tt;
  }

  private addScoreboard(x: number, y: number): void {
    this.add.image(x, y, TEX.scoreboard).setDepth(3);
    // support poles down to the field (decor)
    this.add.rectangle(x - 12, y + 60, 4, 120, P.scoreboardFrame).setDepth(2);
    this.add.rectangle(x + 12, y + 60, 4, 120, P.scoreboardFrame).setDepth(2);
    this.add.text(x, y - 14, 'CONTACT-47', { fontFamily: 'monospace', fontSize: '7px', color: css(P.uiDim) }).setOrigin(0.5).setDepth(5).setResolution(2);
    this.scoreValue = this.add
      .text(x, y - 2, 'UNKNOWN', { fontFamily: 'monospace', fontSize: '9px', color: css(P.anchorGreen), fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(5)
      .setResolution(2);
    this.scoreBar = this.add.graphics().setDepth(5);
    this.scorePos = { x, y };
  }

  private addSafeZone(x: number, y: number): void {
    const halfW = 26;
    const halfH = 22;
    const glow = this.add
      .image(x, y - 4, TEX.safeZoneGlow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(P.anchorGreen)
      .setAlpha(0.28)
      .setDepth(5);
    this.add.image(x, y - halfH - 4, TEX.anchorMarker).setDepth(9).setAlpha(0.9);
    this.add
      .text(x, y - halfH - 13, 'ANCHOR', { fontFamily: 'monospace', fontSize: '6px', color: css(P.anchorGreen), fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(9)
      .setResolution(2)
      .setAlpha(0.9);
    this.add
      .text(x, y + 2, 'SAFE', { fontFamily: 'monospace', fontSize: '6px', color: css(P.anchorGreen) })
      .setOrigin(0.5)
      .setDepth(9)
      .setResolution(2)
      .setAlpha(0.65);
    this.tweens.add({ targets: glow, alpha: { from: 0.18, to: 0.4 }, duration: 1300, yoyo: true, repeat: -1 });
    this.safeZones.push({ x, y: y - 6, halfW, halfH, glow });
  }

  private addPoolNode(x: number, y: number): void {
    this.poolPos = { x, y };
    this.add.image(x, y, TEX.poolNode).setDepth(7);
    const glow = this.add.image(x, y, TEX.glow8).setScale(2.8).setTint(P.poolShimmer).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setAlpha(0.35);
    this.tweens.add({ targets: glow, alpha: { from: 0.2, to: 0.5 }, duration: 1100, yoyo: true, repeat: -1 });
    this.add.text(x, y - 16, 'DIVE [E]', { fontFamily: 'monospace', fontSize: '7px', color: css(P.poolShimmer) }).setOrigin(0.5).setDepth(11).setResolution(2).setAlpha(0.85);
  }

  private addBanner(x: number, y: number): void {
    this.add.image(x, y - 6, TEX.tigerBanner).setDepth(4);
  }

  /** paint the rec-pool basin water + shimmer (decor; the basin floor is solid) */
  private dressPool(): void {
    const def = TIGER_STADIUM;
    const pool = def.meta.zones.poolDive;
    const surfaceY = 31 * TILE;
    const w = pool.x1 - pool.x0 + 4 * TILE;
    const cx = (pool.x0 + pool.x1) / 2;
    const water = this.add.rectangle(cx, surfaceY + 4.5 * TILE, w, 9 * TILE, P.poolWater).setDepth(5).setAlpha(0.42);
    void water;
    // shimmering surface line
    const shimmer = this.add.rectangle(cx, surfaceY, w, 3, P.poolShimmer).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setAlpha(0.4);
    this.tweens.add({ targets: shimmer, alpha: { from: 0.2, to: 0.55 }, duration: 1400, yoyo: true, repeat: -1 });
  }


  /* ------------------- optional Blipstream side node (side content) ---------- */

  /** Pure side content: never gates a quest, Fold, boss or fragment. Solving the
   *  room lights a persistent signal bridge here and pays Signal Shards. */
  private setupBlipSideNode(): void {
    const groundY = surfaceYAt(TIGER_STADIUM, 10);
    if (groundY === null) return;
    this.blipNode = new BlipSideNode(this, this.solids, {
      roomId: 'node-stadium',
      flag: 'blipStadiumSolved',
      label: 'REFLECTION',
      zoneLabel: 'Blipstream — Reflection',
      returnScene: SCENES.stadium,
      x: 10 * TILE,
      groundY,
      bridge: { x: (10 + 4) * TILE, y: groundY - 34 },
      bridgeToast: 'THE ECHO HOLDS — A LIT SHORTCUT OPENS',
    });
  }

  private wireCollisions(): void {
    this.physics.add.collider(this.player, this.solids);

    this.physics.add.collider(this.playerBolts, this.solids, (bolt) => {
      const b = bolt as Projectile;
      // Pulse Ricochet: bounce off geometry before dying
      if (hasAbility('pulse-ricochet') && ricochetBolt(b, SIGNATURE.ricochet.wallBounces)) {
        this.fx.sparks(b.x, b.y, P.scoutCameron, 3);
        return;
      }
      this.fx.sparks(b.x, b.y, activeSkin().color, 3);
      b.kill();
    });
    this.physics.add.collider(this.enemyBolts, this.solids, (bolt) => (bolt as Projectile).kill());

    // player pulses vs vented drones
    this.physics.add.overlap(this.playerBolts, this.enemies, (boltObj, droneObj) => {
      const b = boltObj as Projectile;
      const d = droneObj as ScannerDrone;
      if (!b.active || !d.active) return;
      const surge = (b as unknown as { surge?: boolean }).surge ? 2 : 1;
      d.takeDamage(this.player.pulseDamage * surge);
      // Pulse Ricochet: chain-deflect toward the next drone instead of dying
      if (
        hasAbility('pulse-ricochet') &&
        chainToNextEnemy(b, d, this.enemies.getChildren(), SIGNATURE.ricochet.chainHops, SIGNATURE.ricochet.chainRange)
      ) {
        this.fx.sparks(b.x, b.y, P.scoutCameron, 3);
        return;
      }
      b.kill();
    });

    // drone touch + enemy bolts hurt the player
    this.physics.add.overlap(this.player, this.enemies, (_pl, droneObj) => {
      const d = droneObj as ScannerDrone;
      if (!d.active || this.player.invulnerable) return;
      this.hurtPlayer(DRONE.touchDamage, d.x);
    });
    this.physics.add.overlap(this.enemyBolts, this.player, (_pl, bolt) => {
      const b = bolt as Projectile;
      if (!b.active || this.player.invulnerable) return;
      b.kill();
      this.hurtPlayer(1, b.x);
    });
  }

  private applySaveState(): void {
    const s = getSave();
    if (s.flags.tigerBadgeCollected && this.badge) { this.badge.destroy(); this.badge = undefined; }
    if (s.signalSets.henry?.relic && this.relic) { this.relic.destroy(); this.relic = undefined; }
    if (s.foundSecrets.includes('tiger-locker-cache') && this.lockerCache) { this.lockerCache.destroy(); this.lockerCache = undefined; }
    if (s.flags.tigerBossDefeated && !s.flags.tigerFragmentCollected) this.spawnFragment();
  }

  private emitSkin(): void {
    const sk = activeSkin();
    bus.emit(EVT.skinSelected, { id: sk.id, name: sk.name, color: sk.color, live: false });
  }
  private applySkinLive(id: string): void {
    if (!this.player?.active || activeSkin().id === id) return;
    this.player.setSkin(id);
  }

  private checkSetComplete(scoutId: string): void {
    const skin = skinByScout(scoutId);
    if (!skin || getSave().unlockedSkins.includes(skin.id) || setProgress(scoutId).count < 3) return;
    unlockSkin(skin.id);
    ScoutEcho.summon(this, this.player.x, this.player.y - 8, scoutId, skin.color, this.fx, `${skin.scoutName.toUpperCase()} / ${skin.name}`);
    this.time.delayedCall(700, () => {
      bus.emit(EVT.scoutLog, {
        title: `SIGNAL SET COMPLETE — ${skin.name} UNLOCKED`,
        body: `${skin.scoutName}’s echo hands you their signal.\n\n"${skin.fantasy}"\n\nEquip ${skin.name} in the Command Center ▸ WARDROBE. ${skin.passive}`,
        accent: 'henry',
      });
    });
  }

  /* --------------------------------- gameplay -------------------------------- */

  update(_t: number, delta: number): void {
    this.input2.update();
    if (this.input2.pauseJustDown && !this.isPaused && !uiOverlayActive() && !this.gameOverShown) this.setPaused(true);
    if (this.isPaused || this.gameOverShown) return;
    const dtSec = delta / 1000;
    const now = this.time.now;

    this.player.updatePlayer(this.input2);
    this.updateParallax(dtSec);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down && this.player.alive) this.lastSafe = { x: this.player.x, y: this.player.y - 4 };

    // shooting
    if (this.input2.shootDown && this.player.canShoot() && this.player.alive) {
      const aim = this.input2.shotVector(this.player.x, this.player.y - 1, this.player.facing);
      if (Math.abs(aim.x) > 0.25) this.player.facing = aim.x >= 0 ? 1 : -1;
      this.player.markShoot();
      const surge = this.player.isSurgeShot;
      const bolt = fireFrom(
        this.playerBolts,
        this.player.x + aim.x * 8,
        this.player.y - 1 + aim.y * 4,
        aim.x * PULSE.speed,
        aim.y * PULSE.speed,
        PULSE.lifeMs
      );
      if (bolt) {
        (bolt as unknown as { surge?: boolean }).surge = surge;
        if (surge) bolt.setTint(0xffffff).setScale(1.5);
        else bolt.setTint(activeSkin().color).setScale(1);
      }
      audio.pulseShot();
      this.bumpStat('pulseShotsFired');
    }

    // scanning — expose the boss valve, stun nearby drones
    if (this.input2.scanJustDown && this.player.canScan() && this.player.alive) this.doScan();

    this.blipNode?.tryEnter(this.player.x, this.player.y, this.input2);

    // dive into the rec pool
    if (
      this.input2.interactJustDown &&
      Math.abs(this.player.x - this.poolPos.x) < 20 &&
      Math.abs(this.player.y - this.poolPos.y) < 40
    ) {
      this.enterUnderwater(false);
    }

    this.updateStealth(dtSec, now);

    // boss + vented drones
    this.boss?.update(dtSec);
    for (const d of this.ventDrones) d.updateDrone();
    if (this.boss?.state === 'dying' && !this.bossDeathHandled) {
      this.bossDeathHandled = true;
      this.ventDrones.forEach((d) => d.active && d.destroy());
      this.ventDrones = [];
      (this.enemyBolts.getChildren() as Projectile[]).forEach((b) => b.active && b.kill());
    }

    this.updateQuestTriggers();

    // pit fall (fell below the world)
    if (this.player.y > TIGER_STADIUM.meta.heightPx + FALL_DAMAGE_Y_PAD && this.player.alive) {
      this.hurtPlayer(1, this.player.x + 1);
      if (this.player.alive) {
        this.player.setPosition(this.lastSafe.x, this.lastSafe.y - 6);
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
    }

    this.checkPickups();

    if (now > this.statFlushAt) { this.statFlushAt = now + 15000; this.flushTime(); }
    this.pushDebug();
  }

  private updateParallax(dtSec: number): void {
    const sx = this.cameras.main.scrollX;
    this.cloudDrift += dtSec * 3; // slow ambient cloud drift
    this.fogDrift += dtSec * 7; // low fog rolls a touch faster (nearer)
    this.stars.tilePositionX = sx * 0.03;
    this.clouds.tilePositionX = sx * 0.05 + this.cloudDrift;
    this.skyline.tilePositionX = sx * 0.12;
    this.stands.tilePositionX = sx * 0.3;
    this.fog.tilePositionX = sx * 0.42 + this.fogDrift;
  }

  /* ================= STEALTH: light burns · threat ladder · cover ============ */

  /**
   * One pass of the Friday-night-lights stealth loop:
   *   towers (sweep / lock / flood) → is the player LIT → LIGHT BURNS fill ramp
   *   → threat-ladder stage transitions → readouts.
   * Everything the player can do about it lives here: shadow, cover, ANCHOR,
   * dash i-frames, Ghost Protocol / Echo (via `detectionMul`), god mode.
   */
  private updateStealth(dtSec: number, now: number): void {
    const px = this.player.x;
    const py = this.player.y;
    if (this.floodUntil > 0 && now >= this.floodUntil) this.resolveFlood();
    const flooding = now < this.floodUntil;
    const lookRange = Phaser.Math.DegToRad(STADIUM.lightSweepDeg / 2 + 16);

    // ---- 1. drive every tower, and ask whether it actually has a clean read ----
    let towerLit = false;
    let occludedRead = false; // a tower is pointed AT you but something solid is in the way
    for (const l of this.lightTowers) {
      const sweepAng = this.sweepAngleAt(l, now);
      const hunting = l.locked || flooding;
      if (hunting) {
        // STOP sweeping and track the player's x (clamped to the tower's arc, so
        // you can still run out from under a lock)
        const want = Phaser.Math.Clamp(
          Math.atan2(TRACK_SURFACE_Y - l.headY, px - l.headX),
          Math.PI / 2 - lookRange,
          Math.PI / 2 + lookRange
        );
        l.curAng = Phaser.Math.Linear(l.curAng, want, flooding ? 0.22 : STADIUM.lockTrackLerp);
      } else if (l.unblendMs > 0) {
        l.unblendMs -= dtSec * 1000;
        l.curAng = Phaser.Math.Linear(l.curAng, sweepAng, 0.14);
      } else {
        l.curAng = sweepAng;
      }
      l.cone.setAngle(l.curAng);
      const inside = l.cone.update(px, py);
      if (inside) {
        if (this.isOccluded(l.headX, l.headY, px, py)) occludedRead = true;
        else towerLit = true;
      }
      l.cone.boostAlpha = flooding ? 0.95 : l.locked ? 0.68 : 0;
      // telegraph: the live ground spot, and (only while sweeping) the lookahead ghost
      l.spot
        .setX(this.sweepGroundX(l, l.curAng))
        .setTint(hunting ? P.white : P.scoreboardKnown)
        .setAlpha(hunting ? 0.8 : 0.42 + Math.sin(now * 0.012 + l.phase) * 0.12);
      l.ghost.setVisible(!hunting).setX(this.sweepGroundX(l, this.sweepAngleAt(l, now + SWEEP_LOOKAHEAD_MS)));
    }

    // ---- 2. the Spotter (stage 2) gets its own read ----
    let spotterLit = false;
    if (this.spotter?.active) spotterLit = this.spotter.update(dtSec);
    if (this.spotter && !this.spotter.active) this.spotter = undefined;

    // ---- 3. resolve LIT, honouring every counter the player owns ----
    const sheltered = this.updateSafeZones(dtSec, now);
    const dashHidden = this.player.isDashing || this.player.ghostCloaked;
    const immune = this.player.godMode || !this.player.alive || now < this.caughtUntil;
    const lit = (towerLit || spotterLit) && !sheltered && !dashHidden && !immune;

    // remember the last honest hiding place — that's where a stage-3 catch drops you
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down && this.player.alive && !lit) this.lastUnseen = { x: px, y: py - 4 };

    // ---- 4. LIGHT BURNS: grace, then a hard ramp ----
    if (lit) this.beamMs += dtSec * 1000;
    else this.beamMs = Math.max(0, this.beamMs - dtSec * 1000 * STADIUM.burnGraceBleedMul);
    const burning = lit && this.beamMs >= STADIUM.burnGraceMs;
    const overMs = Math.max(0, this.beamMs - STADIUM.burnGraceMs);
    const burnMul = burning ? Math.min(STADIUM.burnRampMax, 1 + (overMs / 1000) * STADIUM.burnRampPerSec) : 0;

    // ---- 5. bleed-off is EARNED: cover or an ANCHOR, not just a gap in the sweep ----
    // `trulyHidden` = the lights are looking for you and can't resolve you.
    const trulyHidden = sheltered || occludedRead || this.isUnderCover() || dashHidden;
    if (lit) this.lastLitAt = now;
    const holding = !lit && !trulyHidden && now - this.lastLitAt < STADIUM.decayHoldMs;

    if (flooding) {
      this.classify.value = CLASSIFY.max; // the read is pinned while the stadium floods
    } else if (holding) {
      // the Engine keeps its read for a beat — standing in the next shadow over
      // is NOT hiding. This is what stops "stand under a light forever".
      this.classify.update(dtSec, false, 0);
      this.classify.value = Math.min(CLASSIFY.max, this.classify.value + CLASSIFY.decayPerSec * dtSec);
    } else {
      // `burnMul` 0 during the grace window = brushing a beam is genuinely free
      this.classify.update(dtSec, burning, this.player.detectionMul * burnMul);
      if (!lit && trulyHidden) {
        this.classify.value = Math.max(0, this.classify.value - STADIUM.hiddenDecayBonusPerSec * dtSec);
      }
    }

    this.updateThreatLadder(now, sheltered);
    this.updateAlertIcon(lit, sheltered, burning, now);
    this.updateVignette(flooding, now);
    this.updateCoverLabels();
    this.updateScoreboard();
  }

  /** SPOTTED → TRACKED → KNOWN, with hysteresis so the stages don't chatter */
  private updateThreatLadder(now: number, sheltered: boolean): void {
    if (now < this.floodUntil) return; // the flood owns the ladder until it resolves
    const v = this.classify.value;

    // ---- stage 1: SPOTTED — a tower stops sweeping and locks on ----
    if (this.threatStage < 1 && v >= STADIUM.lockOnAt) this.enterSpotted();
    else if (this.threatStage >= 1 && v < STADIUM.lockReleaseAt) this.releaseToStage(0);

    // ---- stage 2: TRACKED — the press box launches a Spotter ----
    if (this.threatStage === 1 && v >= STADIUM.spotterAt) this.enterTracked();
    else if (this.threatStage >= 2 && v < STADIUM.spotterReleaseAt) this.releaseToStage(1);

    // ---- stage 3: KNOWN — the stadium floods ----
    if (this.threatStage >= 2 && v >= CLASSIFY.max && now >= this.floodCooldownUntil && !sheltered) {
      this.enterFlood(now);
    }
  }

  private enterSpotted(): void {
    this.threatStage = 1;
    // the tower with the best angle on you takes the lock
    let best: LightTower | undefined;
    let bestD = Infinity;
    for (const l of this.lightTowers) {
      const d = Phaser.Math.Distance.Between(l.headX, l.headY, this.player.x, this.player.y);
      if (d < bestD) { bestD = d; best = l; }
    }
    if (best) {
      best.locked = true;
      best.cone.setTintColor(P.scoreboardKnown);
      best.cone.pulseVisible(900);
    }
    audio.hazardZap(); // the lock chirp
    this.fx.floatText(this.player.x, this.player.y - 26, 'SPOTTED', P.scoreboardKnown);
    this.fx.flash(P.scoreboardKnown, 90, 0.2);
    bus.emit(EVT.toast, { text: 'SPOTTED — A TOWER STOPS SWEEPING', color: 'orange' });
    if (!this.coverHintShown) {
      this.coverHintShown = true;
      this.time.delayedCall(1100, () => {
        if (this.threatStage >= 1) {
          bus.emit(EVT.toast, { text: 'PUT SOMETHING SOLID BETWEEN YOU AND THE LIGHT', color: 'orange' });
        }
      });
    }
  }

  private enterTracked(): void {
    this.threatStage = 2;
    if (!this.spotter?.active) {
      // launched from the press box — but never so far away it can't arrive
      const pressBoxX = 101 * TILE;
      const sx = Phaser.Math.Clamp(
        pressBoxX,
        this.player.x - STADIUM.spotterSpawnMaxOffset,
        this.player.x + STADIUM.spotterSpawnMaxOffset
      );
      this.spotter = new Spotter(this, sx, STADIUM.spotterSpawnY, {
        getPlayer: () => ({ x: this.player.x, y: this.player.y, alive: this.player.alive }),
        isHidden: (ax, ay, px, py) => this.sightlineBroken(ax, ay, px, py) || this.player.isDashing || this.player.ghostCloaked || this.player.godMode,
        onRetired: () => bus.emit(EVT.toast, { text: 'THE SPOTTER LOSES YOU', color: 'green' }),
      });
    }
    audio.bossWarning();
    this.fx.shake(0.003, 160);
    bus.emit(EVT.toast, { text: 'TRACKED — THE PRESS BOX SENDS A SPOTTER', color: 'orange' });
    if (!this.spotterHintShown) {
      this.spotterHintShown = true;
      this.fx.floatText(this.player.x, this.player.y - 30, 'break its line of sight', P.warning);
    }
  }

  private enterFlood(now: number): void {
    this.threatStage = 3;
    this.floodUntil = now + STADIUM.floodWindowMs;
    this.crowdSwellUntil = now + STADIUM.crowdSwellMs;
    for (const l of this.lightTowers) {
      l.cone.setTintColor(P.white);
      l.cone.setLength(STADIUM.floodConeLength);
    }
    audio.bossWarning();
    this.fx.flash(P.white, 220, 0.5);
    this.fx.shake(0.005, 300);
    bus.emit(EVT.toast, { text: 'KNOWN — THE STADIUM FLOODS. GET UNDER SOMETHING.', color: 'orange' });
    this.fx.floatText(this.player.x, this.player.y - 30, 'HIDE', P.white);
    // resolved from update() (not a timer) so a scene switch mid-flood can't strand it
  }

  /** the flood window closes: under cover / anchored = you stayed unknown */
  private resolveFlood(): void {
    const px = this.player.x;
    const py = this.player.y;
    const safe =
      this.player.godMode ||
      !this.player.alive ||
      this.isInSafeZone(px, py) ||
      this.isUnderCover() ||
      !this.lightTowers.some(
        (l) =>
          l.cone.contains(px, py) && !this.isOccluded(l.headX, l.headY, px, py)
      );

    this.floodUntil = 0;
    this.floodCooldownUntil = this.time.now + STADIUM.floodCooldownMs;
    for (const l of this.lightTowers) {
      l.cone.setLength(STADIUM.lightConeLength);
      l.cone.setTintColor(P.nightBloom);
      l.cone.boostAlpha = 0;
    }
    this.releaseToStage(0);

    if (safe) {
      this.classify.reset();
      audio.doorUnlock();
      this.fx.flash(P.anchorGreen, 160);
      bus.emit(EVT.toast, { text: 'THE LIGHTS FIND NOTHING — STILL UNKNOWN', color: 'green' });
      this.fx.floatText(px, py - 26, 'UNKNOWN', P.anchorGreen);
    } else {
      this.onClassified();
    }
  }

  /**
   * Caught in the flood. A SETBACK, never a death: the Engine logs a reading,
   * the crowd roars, and you wake up at the last place the lights couldn't
   * read you with a clean sheet.
   */
  private onClassified(): void {
    this.crowdSwellUntil = this.time.now + STADIUM.crowdSwellMs;
    this.caughtUntil = this.time.now + STADIUM.caughtStunMs;
    audio.bossWarning();
    audio.transitionWarp();
    this.fx.flash(P.scoreboardKnown, 260, 0.7);
    this.fx.staticBurst(520);
    this.fx.shake(0.006, 320);
    bus.emit(EVT.toast, { text: 'CLASSIFIED — THE CROWD ROARS. FALL BACK.', color: 'orange' });
    const to = this.lastUnseen.x ? this.lastUnseen : this.lastSafe;
    this.player.setPosition(to.x, to.y - 6);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.classify.reset();
    this.beamMs = 0;
  }

  /** wipe the ladder back to a clean sheet (scene wake, dive-out, respawn) */
  private resetStealth(): void {
    this.floodUntil = 0;
    this.floodCooldownUntil = 0;
    this.beamMs = 0;
    this.spotter?.destroy();
    this.spotter = undefined;
    for (const l of this.lightTowers) {
      l.locked = false;
      l.unblendMs = 0;
      l.cone.setLength(STADIUM.lightConeLength);
      l.cone.setTintColor(P.nightBloom);
      l.cone.boostAlpha = 0;
    }
    this.threatStage = 0;
    this.classify.reset();
    this.vignette?.setAlpha(0);
  }

  /** de-escalate: towers ease back onto the sweep, the Spotter retires */
  private releaseToStage(stage: number): void {
    if (stage >= this.threatStage) return;
    if (stage < 2 && this.spotter?.active) this.spotter.retire();
    if (stage < 1) {
      let released = false;
      for (const l of this.lightTowers) {
        if (!l.locked) continue;
        l.locked = false;
        l.unblendMs = STADIUM.lockUnblendMs;
        l.cone.setTintColor(P.nightBloom);
        l.cone.boostAlpha = 0;
        released = true;
      }
      if (released && this.threatStage >= 1) {
        bus.emit(EVT.toast, { text: 'LOST YOU — THE SWEEP RESUMES', color: 'green' });
      }
    }
    this.threatStage = stage;
  }

  /** hot-white edge glow that closes in the longer the Engine holds a read */
  private updateVignette(flooding: boolean, now: number): void {
    const v = this.vignette;
    if (!v) return;
    const k = flooding ? 1 : Math.pow(Phaser.Math.Clamp(this.classify.value / CLASSIFY.max, 0, 1), 1.5);
    const pulse = flooding ? 0.85 + Math.sin(now * 0.03) * 0.15 : 1;
    v.setTint(flooding ? P.white : P.scoreboardKnown);
    v.setAlpha(k * STADIUM.vignetteMaxAlpha * pulse);
    const zoom = 1 + (STADIUM.vignetteMaxZoom - 1) * k;
    v.setDisplaySize(VIEW_W * zoom, VIEW_H * zoom);
  }

  /** the player-worn state read: SEEN (burning in a beam) vs SAFE vs hidden */
  private updateAlertIcon(lit: boolean, sheltered: boolean, burning: boolean, now: number): void {
    const icon = this.alertIcon;
    if (!icon) return;
    icon.setPosition(this.player.x, this.player.y - 18);
    if (!this.player.alive) { icon.setAlpha(0); return; }
    if (sheltered) {
      icon.setText('SAFE').setColor(css(P.anchorGreen)).setAlpha(0.9);
    } else if (this.threatStage >= 3 || now < this.floodUntil) {
      icon.setText('!! KNOWN').setColor(css(P.white)).setAlpha(0.8 + (Math.sin(now * 0.04) > 0 ? 0.2 : 0));
    } else if (lit && burning) {
      // past the grace window — you are actively cooking
      icon.setText(this.threatStage >= 2 ? '!! TRACKED' : '! SEEN').setColor(css(P.scoreboardKnown)).setAlpha(0.7 + (Math.sin(now * 0.02) > 0 ? 0.3 : 0));
    } else if (lit) {
      // inside the grace window — a warning, not a penalty yet
      icon.setText('· lit').setColor(css(P.warning)).setAlpha(0.55);
    } else if (this.threatStage >= 1) {
      icon.setText('HIDDEN').setColor(css(P.anchorGreen)).setAlpha(0.6);
    } else {
      icon.setAlpha(0);
    }
  }

  /** heal + fast-declassify while sheltered and roughly still; returns sheltered */
  private updateSafeZones(dtSec: number, now: number): boolean {
    const px = this.player.x;
    const py = this.player.y;
    let sheltered = false;
    for (const z of this.safeZones) {
      if (Math.abs(px - z.x) < z.halfW && Math.abs(py - z.y) < z.halfH) {
        sheltered = true;
        z.glow.setAlpha(0.5);
      }
    }
    if (sheltered) {
      if (!this.anchorHintShown) {
        this.anchorHintShown = true;
        this.fx.floatText(px, py - 24, 'ANCHOR — the lights can’t read you here', P.anchorGreen);
        bus.emit(EVT.toast, { text: 'ANCHOR ZONE — stand in the green to shed the label + heal', color: 'green' });
      }
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const still = body.velocity.length() < 24;
      // ANCHOR bleeds classification fast inside a safe zone
      this.classify.value = Math.max(0, this.classify.value - STADIUM.safeZoneDeclassifyPerSec * dtSec);
      if (still && now > this.healAt && this.player.hp < this.player.maxHp) {
        this.healAt = now + STADIUM.safeZoneHealEveryMs;
        this.player.heal(1);
        this.fx.sparks(px, py - 6, P.anchorGreen, 5);
      }
    }
    return sheltered;
  }

  private updateScoreboard(): void {
    if (!this.scoreValue || !this.scoreBar) return;
    const t = this.classify.tier;
    const known = t === 'THREAT';
    const color = t === 'THREAT' ? P.scoreboardKnown : t === 'ANOMALY' ? P.warning : P.anchorGreen;
    const label = known ? 'KNOWN' : t === 'ANOMALY' ? 'ANOMALY' : 'UNKNOWN';
    if (this.scoreValue.text !== label) this.scoreValue.setText(label);
    this.scoreValue.setColor(css(color));
    const g = this.scoreBar;
    g.clear();
    const bx = this.scorePos.x - 22;
    const by = this.scorePos.y + 10;
    g.fillStyle(P.scoreboardFrame, 1).fillRect(bx - 1, by - 1, 46, 5);
    g.fillStyle(color, 1).fillRect(bx, by, Math.round(44 * (this.classify.value / 100)), 3);
  }

  private updateQuestTriggers(): void {
    const zones = TIGER_STADIUM.meta.zones;
    const x = this.player.x;
    const step = quests.stepId;
    if (step === 'arrive' && Math.abs(x - this.spawnPoint.x) > 56) quests.complete('arrive');
    if (step === 'timeLights' && x > zones.lightsGauntlet.x1 + TILE) {
      quests.complete('timeLights');
      if (!this.crossedCleanToasted) {
        this.crossedCleanToasted = true;
        bus.emit(EVT.toast, { text: 'CROSSED THE LIGHTS — STILL UNKNOWN', color: 'green' });
      }
    }
    if (step === 'reachDugout' && x > zones.dugout.x0 && x < zones.dugout.x1) quests.complete('reachDugout');
    // first time you approach the rec pool, spell out the DIVE goal
    if (
      !this.poolHintShown &&
      quests.isAtOrPast('poolDive') &&
      !getSave().flags.poolNodeSolved &&
      Math.abs(x - this.poolPos.x) < 60
    ) {
      this.poolHintShown = true;
      this.fx.floatText(this.poolPos.x, this.poolPos.y - 26, 'DIVE [E] — flip the world through the pool', P.poolShimmer);
    }
    // spawn the boss once you've surfaced from the pool and reached the arena
    if (
      step === 'bossFight' &&
      !this.boss &&
      getSave().flags.poolNodeSolved &&
      x >= zones.bossTrigger.x0 &&
      x <= zones.bossTrigger.x1
    ) {
      this.spawnBoss();
    }
    // road east → PATTERSON'S ORCHARD (Zone 4)
    if (getSave().flags.tigerFragmentCollected && !this.exitToasted && x > zones.exit.x0) {
      this.exitToasted = true;
      this.travelToOrchard();
    }
  }

  private doScan(): void {
    this.player.markScan();
    audio.scanPulse();
    this.fx.scanRing(this.player.x, this.player.y, this.player.scanRadius, this.player.scanRevealMs);
    this.bumpStat('scansUsed');
    const px = this.player.x;
    const py = this.player.y;
    // EMP Burst signature: shockwave stuns drones + clears enemy bolts in a radius
    if (hasAbility('emp-burst')) {
      const r = SIGNATURE.emp.radius;
      this.fx.scanRing(px, py, r, SIGNATURE.emp.ringMs, P.neonCyan);
      this.fx.flash(P.neonCyan, 80, 0.22);
      clearBoltsInRadius(this.enemyBolts, px, py, r);
      for (const d of this.ventDrones) {
        if (d.active && Phaser.Math.Distance.Between(px, py, d.x, d.y) <= r) d.stun(SIGNATURE.emp.stunMs / 1000);
      }
      audio.hazardZap();
    }
    const tagged: Array<{ x: number; y: number }> = [];
    for (const d of this.ventDrones) {
      if (d.active && Phaser.Math.Distance.Between(px, py, d.x, d.y) < this.player.scanRadius) {
        d.stun(DRONE.scanStunSec);
        tagged.push({ x: d.x, y: d.y });
      }
    }
    // Scan Memory: scanned eyes stay marked on the field long after the ping
    this.player.scanMemoryEcho(tagged, P.scoutHenry);
    if (this.boss && this.boss.state === 'fighting' && Phaser.Math.Distance.Between(px, py, this.boss.core.x, this.boss.core.y) < this.player.scanRadius + 40) {
      this.boss.onScanned();
    }
  }

  private checkPickups(): void {
    const near = (o: { x: number; y: number }, r: number) => Phaser.Math.Distance.Between(this.player.x, this.player.y, o.x, o.y) < r;
    // Henry / ANCHOR badge (grants badge + log pieces)
    if (this.badge && !this.badge.collected && near(this.badge, 14)) {
      this.badge.collect();
      audio.badgePickup();
      this.fx.flash(P.scoutHenry, 120);
      this.fx.explode(this.badge.x, this.badge.y, P.scoutHenry, 14);
      const log = logById('henry-log-1');
      updateSave((s) => {
        s.flags.tigerBadgeCollected = true;
        if (!s.discoveredScoutBadges.includes('henry')) s.discoveredScoutBadges.push('henry');
        if (log && !s.discoveredScoutLogs.includes('henry-log-1')) s.discoveredScoutLogs.push('henry-log-1');
      });
      recordSetPiece('henry', 'badge');
      recordSetPiece('henry', 'log');
      if (log) bus.emit(EVT.scoutLog, { title: log.title, body: log.body, accent: 'henry' });
      bus.emit(EVT.toast, { text: 'SCOUT BADGE — HENRY / ANCHOR (3/5)', color: 'green' });
      this.badge = undefined;
      this.checkSetComplete('henry');
    }
    // Signal Flare relic (top-bleacher route)
    if (this.relic && !this.relic.collected && near(this.relic, 15)) {
      this.relic.collect();
      audio.badgePickup();
      this.fx.flash(P.scoutHenry, 120);
      this.fx.explode(this.relic.x, this.relic.y, P.scoutHenry, 14);
      updateSave((s) => { s.flags.tigerRelicCollected = true; });
      recordSetPiece('henry', 'relic');
      bus.emit(EVT.toast, { text: 'RELIC RECOVERED — SIGNAL FLARE', color: 'green' });
      this.relic = undefined;
      this.checkSetComplete('henry');
    }
    // hidden locker cache (Signal Shards + fragment dust)
    if (this.lockerCache && !this.lockerCache.collected && near(this.lockerCache, 15)) {
      this.lockerCache.collect();
      audio.badgePickup();
      this.fx.flash(P.warning, 120);
      const bal = addShards(PROGRESSION.shardsPerCache);
      updateSave((s) => { if (!s.foundSecrets.includes('tiger-locker-cache')) s.foundSecrets.push('tiger-locker-cache'); });
      bus.emit(EVT.toast, { text: `LOCKER CACHE — +${PROGRESSION.shardsPerCache} SHARDS (${bal})`, color: 'orange' });
      this.lockerCache = undefined;
    }
    // Signal Fragment #3
    if (this.fragment && !this.fragment.collected) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.fragment.x, this.fragment.y);
      if (d < 64) this.fragment.magnetTo(this.player.x, this.player.y, this.game.loop.delta / 1000);
      if (d < 16) this.collectFragment();
    }
  }

  /* ------------------------------ rec-pool dive ------------------------------ */

  enterUnderwater(viaDebug: boolean): void {
    if (this.isPaused || this.gameOverShown) return;
    if (quests.stepId === 'poolDive' && !viaDebug) quests.complete('poolDive');
    audio.transitionWarp();
    this.fx.staticBurst(520);
    this.fx.flash(P.poolShimmer, 200);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.flushTime();
    this.registry.set('blipReturnScene', SCENES.stadium);
    this.registry.set('blipZoneLabel', 'The Rec Pool');
    this.registry.set('nodeJustSolved', false);
    this.time.delayedCall(430, () => {
      bus.emit(EVT.sceneChanged, { scene: SCENES.underwater, zone: 'The Rec Pool' });
      this.scene.switch(SCENES.underwater);
    });
  }

  private onWake(): void {
    // you surfaced somewhere else entirely — the Engine's read does not carry over
    this.resetStealth();
    this.blipNode?.applyIfSolved();
    audio.playMusic('stadium');
    bus.emit(EVT.sceneChanged, { scene: SCENES.stadium, zone: 'Chagrin Falls High' });
    quests.emitObjective();
    this.player.refreshHud();
    this.fx.staticBurst(300);
    if (this.registry.get('nodeJustSolved') === true) {
      this.registry.set('nodeJustSolved', false);
      this.applyPoolSolved();
    }
  }

  /** the reflection route is routed — surface near the fifty; the boss can wake */
  applyPoolSolved(): void {
    updateSave((s) => { s.flags.poolNodeSolved = true; });
    if (quests.stepId === 'routeMirror') quests.complete('routeMirror');
    audio.doorUnlock();
    this.fx.flash(P.anchorGreen, 200);
    this.fx.shake(0.004, 250);
    bus.emit(EVT.toast, { text: 'YOU SURFACE NEAR THE FIFTY — THE FIELD IS AWAKE', color: 'green' });
  }

  private travelToOrchard(): void {
    this.flushTime();
    updateSave((s) => {
      s.currentZone = 'pattersons-orchard';
      s.currentQuest = 'the-endless-harvest';
      s.questStep = 'arrive';
      s.completedQuestSteps = [];
      if (!s.completedZones.includes('tiger-stadium')) s.completedZones.push('tiger-stadium');
    });
    quests.load('the-endless-harvest');
    quests.restart();
    audio.transitionWarp();
    bus.emit(EVT.toast, { text: 'THE COUNTY ROAD — PATTERSON’S ORCHARD', color: 'green' });
    this.cameras.main.fadeOut(500, 6, 3, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.orchard);
    });
  }

  /* --------------------------------- boss ------------------------------------ */

  spawnBoss(): void {
    if (this.boss) return;
    if (quests.stepId === 'routeMirror') quests.complete('routeMirror'); // safety if arriving pre-surfaced via debug
    const arena = TIGER_STADIUM.meta.arena;
    this.boss = new WeatherBalloonBoss(this, arena.centerX, arena.surfaceY, arena.leftPx, arena.rightPx, {
      fx: this.fx,
      summonDrones: (count, x, y) => this.ventDrones.push(...this.spawnVentDrones(count, x, y)),
      dronesAlive: () => this.ventDrones.filter((d) => d.active).length,
      damagePlayer: (amount, fromX) => this.hurtPlayer(amount, fromX),
      getPlayer: () => ({ x: this.player.x, y: this.player.y, alive: this.player.alive }),
      onDefeated: () => this.onBossDefeated(),
    });

    for (const wx of [arena.leftPx, arena.rightPx]) {
      const wall = this.physics.add.staticImage(wx, arena.surfaceY - 4 * TILE, TEX.px).setVisible(false);
      (wall.body as Phaser.Physics.Arcade.StaticBody).setSize(8, 160);
      this.physics.add.collider(this.player, wall);
      this.arenaWalls.push(wall as unknown as Phaser.Physics.Arcade.Image);
    }

    this.physics.add.overlap(this.playerBolts, this.boss.core, (_c, bolt) => {
      const b = bolt as Projectile;
      if (!b.active || !this.boss?.exposed) return;
      b.kill();
      const dmg = this.player.coreDamage * ((b as unknown as { surge?: boolean }).surge ? 2 : 1);
      this.boss.hitCore(dmg);
    });

    this.boss.spawn();
  }

  private spawnVentDrones(count: number, x: number, y: number): ScannerDrone[] {
    const deps: DroneDeps = {
      fx: this.fx,
      fireBolt: (bx, by, tx, ty) => {
        const dx = tx - bx;
        const dy = ty - by;
        const d = Math.hypot(dx, dy) || 1;
        fireFrom(this.enemyBolts, bx, by, (dx / d) * DRONE.boltSpeed, (dy / d) * DRONE.boltSpeed, DRONE.boltLifeMs);
      },
      getPlayer: () => ({ x: this.player.x, y: this.player.y, alive: this.player.alive }),
      isThreat: () => this.classify.isThreat,
      onDestroyed: (drone) => {
        this.ventDrones = this.ventDrones.filter((d) => d !== drone);
        addShards(PROGRESSION.shardsPerDrone);
        updateSave((s) => { s.playerStats.enemiesDefeated += 1; });
      },
    };
    const made: ScannerDrone[] = [];
    for (let i = 0; i < count; i++) {
      const dx = (i - (count - 1) / 2) * 26;
      const drone = new ScannerDrone(this, x + dx, y, 44, deps);
      this.enemies.add(drone);
      made.push(drone);
    }
    return made;
  }

  private onBossDefeated(): void {
    this.arenaWalls.forEach((w) => w.destroy());
    this.arenaWalls = [];
    this.ventDrones.forEach((d) => d.active && d.destroy());
    this.ventDrones = [];
    (this.enemyBolts.getChildren() as Projectile[]).forEach((b) => b.active && b.kill());
    updateSave((s) => {
      s.flags.tigerBossDefeated = true;
      s.playerStats.enemiesDefeated += 1;
    });
    if (quests.stepId === 'bossFight') quests.complete('bossFight');
    this.spawnFragment();
    bus.emit(EVT.toast, { text: 'THE BALLOON POPS — THE GAME IS OVER', color: 'green' });
  }

  spawnFragment(): void {
    const arena = TIGER_STADIUM.meta.arena;
    this.fragment = new Collectible(this, arena.centerX, arena.surfaceY - 3 * TILE, 'fragment', false);
  }

  /* ------------------------------- TestAPI hooks ----------------------------- */

  get debugState(): {
    classify: number;
    tier: string;
    poolSolved: boolean;
    drones: number;
    threatStage: number;
    spotter: boolean;
    flooding: boolean;
    underCover: boolean;
  } {
    return {
      classify: Math.round(this.classify.value),
      tier: this.classify.tier,
      poolSolved: getSave().flags.poolNodeSolved,
      drones: this.ventDrones.filter((d) => d.active).length,
      threatStage: this.threatStage,
      spotter: !!this.spotter?.active,
      flooding: this.time.now < this.floodUntil,
      underCover: !!this.player && this.isUnderCover(),
    };
  }

  apiCompleteSet(scoutId: string): void {
    recordSetPiece(scoutId, 'badge');
    recordSetPiece(scoutId, 'log');
    recordSetPiece(scoutId, 'relic');
    this.checkSetComplete(scoutId);
  }
  apiCollectFragment(): void {
    if (getSave().flags.tigerFragmentCollected) return;
    if (!this.fragment) this.spawnFragment();
    this.collectFragment();
  }
  /** deterministic test hook: mark the pool route solved without the dive */
  apiSolvePool(): void {
    this.applyPoolSolved();
  }

  private collectFragment(): void {
    if (!this.fragment) return;
    this.fragment.collect();
    this.fragment = undefined;
    audio.fragmentPickup();
    this.fx.flash(P.anchorGreen, 220);
    this.fx.shake(0.004, 200);
    updateSave((s) => {
      s.signalFragments = Math.max(3, s.signalFragments + 1);
      s.flags.tigerFragmentCollected = true;
      if (!s.completedZones.includes('tiger-stadium')) s.completedZones.push('tiger-stadium');
    });
    const ability = progression.grantZoneSignature('tiger-stadium');
    bus.emit(EVT.fragmentCount, { count: getSave().signalFragments });
    if (quests.stepId === 'collectFragment') quests.complete('collectFragment');
    bus.emit(EVT.scoutLog, {
      title: 'SIGNAL FRAGMENT SECURED — 3 / ?',
      body:
        'The lights finally cut. Somewhere a scoreboard goes dark and stays dark; the home side can walk off the field.\n\n' +
        'Fragment archived. Henry’s file is no longer UNKNOWN — ANCHOR’s signal is yours.' +
        (ability ? `\n\n◆ ABILITY UNLOCKED — ${ability.name}\n${ability.description}` : '') +
        '\n\nDirective unchanged: stay unknown.',
      accent: 'henry',
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
    updateSave((s) => { s.playerStats.deaths += 1; });
    this.fx.explode(this.player.x, this.player.y, activeSkin().color, 22);
    this.fx.staticBurst(600);
    this.player.setVisible(false);
    this.physics.pause();
    this.time.delayedCall(700, () => {
      this.scene.launch(SCENES.gameOver, { from: SCENES.stadium });
      this.scene.pause();
    });
  }

  private showHowToPlay(): void {
    bus.emit(EVT.tutorial, {
      title: 'CHAGRIN FALLS HIGH — FRIDAY NIGHT',
      accent: 'henry',
      html: `
        <p class="tut-lead">The lights never cut. The <b>scoreboard</b> stopped counting points — now it reads <b>KNOWN / UNKNOWN</b>, and that’s <b>you</b>.</p>
        <div class="tut-hero">
          <div class="tut-hero-key">HIDE<span>GET&nbsp;BEHIND&nbsp;SOMETHING</span></div>
          <div class="tut-hero-desc">Crossing a beam is <b>free</b> — standing in one is not. Linger and the read <b>burns</b>: the edges go hot white and the Engine climbs the ladder — <b>SPOTTED</b> (a tower quits sweeping and locks onto you) → <b>TRACKED</b> (the press box launches a <b>SPOTTER</b>) → <b>KNOWN</b> (the whole stadium floods; you have four seconds). Break it with <b>solid cover</b> — the equipment cart, the blocking sled, the dugout roof, under the stands. A light can’t read through a thing. <b>Henry’s green ANCHOR zones</b> still shed the label and heal.</div>
        </div>
        <table class="tut-controls">
          <tr><td class="tut-k">A / D · SPACE</td><td>Move · jump (hold to hover)</td></tr>
          <tr><td class="tut-k">SHIFT</td><td>Dash — its i-frames slip a light beam</td></tr>
          <tr><td class="tut-k">X · LEFT CLICK</td><td>Pulse — pop drones, hit the valve</td></tr>
          <tr><td class="tut-k">Q · RIGHT CLICK</td><td>Scan — expose the boss valve</td></tr>
          <tr><td class="tut-k">E</td><td>Dive into the rec pool</td></tr>
        </table>`,
    });
  }

  private togglePause(): void {
    if (uiOverlayActive()) return;
    this.setPaused(!this.isPaused);
  }
  setPaused(v: boolean): void {
    if (this.gameOverShown) return;
    this.isPaused = v;
    if (v) { this.physics.pause(); bus.emit(EVT.gamePaused, {}); }
    else { this.physics.resume(); bus.emit(EVT.gameResumed, {}); }
  }

  private bumpStat(key: 'pulseShotsFired' | 'scansUsed' | 'enemiesDefeated'): void {
    getSave().playerStats[key] += 1;
  }
  private flushTime(): void {
    const elapsed = Math.round((this.time.now - this.sessionStart) / 1000);
    if (elapsed <= 0) return;
    this.sessionStart = this.time.now;
    updateSave((s) => { s.playerStats.timePlayedSec += elapsed; });
  }

  private debugEmitAt = 0;
  private pushDebug(): void {
    if (this.time.now < this.debugEmitAt) return;
    this.debugEmitAt = this.time.now + 200;
    bus.emit(EVT.debugState, {
      fps: Math.round(this.game.loop.actualFps),
      scene: 'StadiumScene',
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      quest: quests.stepId,
      playerBolts: this.playerBolts.countActive(true),
      classify: `${Math.round(this.classify.value)} ${this.classify.tier}`,
      energy: Math.round(this.player.energy),
      hp: this.player.hp,
      drones: this.ventDrones.filter((d) => d.active).length,
      boss: this.boss ? `${this.boss.state} ${this.boss.hp}hp` : '—',
    });
    void this.crowdSwellUntil;
  }

  private onShutdown(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.lightTowers.forEach((l) => { l.cone.destroy(); l.spot.destroy(); l.ghost.destroy(); });
    this.coverRects.forEach((c) => c.label?.destroy());
    this.coverRects = [];
    this.spotter?.destroy();
    this.spotter = undefined;
    this.vignette?.destroy();
    this.alertIcon?.destroy();
    this.ventDrones.forEach((d) => d.active && d.destroy());
    this.boss?.destroy();
    unregisterScene('stadium');
  }
}
