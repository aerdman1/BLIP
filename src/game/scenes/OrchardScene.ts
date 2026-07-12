/**
 * PATTERSON'S ORCHARD — Zone 4 overworld.
 * "THE MAZE THINKS": climb apple-tree pillar platforms (branch ledges + respawning
 * fruit), pass the white barn (hidden loft = Cameron's ECHO badge), read the corn
 * maze whose walls shift on a readable beat, then FOLD into the top-down maze-z4
 * Sweep arena. Charging its crop-circle node blooms the circle; you surface, the
 * gate opens, take the Tuning Fork at the maze heart, and face THE HARVEST PATTERN.
 * Mirrors the StadiumScene structure/systems + the shared Fold/Sweep engine.
 */
import Phaser from 'phaser';
import {
  BOSS4,
  DRONE,
  EVT,
  FALL_DAMAGE_Y_PAD,
  ORCHARD,
  PROGRESSION,
  VIEW_H,
  VIEW_W,
  PALETTE as P,
  PULSE,
  RENDER_ZOOM,
  SCAN,
  SCENES,
  TEX,
  TILE,
  css,
} from '../config';
import { PATTERSONS_ORCHARD, walkLevel } from '../data/levels';
import { logById } from '../data/scouts';
import { skinByScout } from '../data/skins';
import { Collectible } from '../entities/Collectible';
import { HiddenPlatform } from '../entities/HiddenPlatform';
import { HarvestPatternBoss } from '../entities/HarvestPatternBoss';
import { Player } from '../entities/Player';
import { Projectile, fireFrom, makeProjectileGroup } from '../entities/Projectile';
import { ScoutEcho } from '../entities/ScoutEcho';
import { audio } from '../systems/AudioSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { attachScreenFilter } from '../systems/ScreenFilter';
import { bus } from '../systems/EventBus';
import { foldCollapse } from '../systems/FoldTransition';
import { PlayerInput } from '../systems/InputSystem';
import { quests } from '../systems/QuestSystem';
import { addShards, getSave, recordSetPiece, setProgress, unlockSkin, updateSave } from '../systems/SaveSystem';
import { progression } from '../systems/ProgressionSystem';
import { activeSkin } from '../systems/SkinState';
import { registerScene, unregisterScene } from '../systems/TestAPI';
import { uiOverlayActive } from '../systems/UIState';

interface MazeWall {
  img: Phaser.Physics.Arcade.Image;
  phase: 'A' | 'B';
}

export class OrchardScene extends Phaser.Scene {
  player!: Player;
  private input2!: PlayerInput;
  fx!: EffectsSystem;

  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private mazeGroup!: Phaser.Physics.Arcade.StaticGroup;
  private fruitGroup!: Phaser.Physics.Arcade.StaticGroup;
  private gateGroup!: Phaser.Physics.Arcade.StaticGroup;
  private mazeWalls: MazeWall[] = [];
  private mazePhase: 'A' | 'B' = 'A';
  private fruitPlats: Phaser.Physics.Arcade.Image[] = [];
  private hiddenPlatforms: HiddenPlatform[] = [];
  private gateGlyph?: Phaser.GameObjects.Image;

  playerBolts!: Phaser.Physics.Arcade.Group;
  enemyBolts!: Phaser.Physics.Arcade.Group;
  boss?: HarvestPatternBoss;
  private bossDeathHandled = false;
  private arenaWalls: Phaser.Physics.Arcade.Image[] = [];

  private badge?: Collectible;
  private relic?: Collectible;
  private cellarCache?: Collectible;
  private fragment?: Collectible;

  private foldPos = { x: 0, y: 0 };
  private exitToasted = false;

  private spawnPoint = { x: 0, y: 0 };
  private lastSafe = { x: 0, y: 0 };
  private sky!: Phaser.GameObjects.Image;
  private stars!: Phaser.GameObjects.TileSprite;
  private hills!: Phaser.GameObjects.TileSprite;
  private fog!: Phaser.GameObjects.TileSprite;
  private fogDrift = 0;
  private isPaused = false;
  private travelling = false;
  private gameOverShown = false;
  private statFlushAt = 0;
  private sessionStart = 0;
  private unsubs: Array<() => void> = [];

  constructor() {
    super(SCENES.orchard);
  }

  create(): void {
    const def = PATTERSONS_ORCHARD;
    this.fx = new EffectsSystem(this);
    attachScreenFilter(this, true);
    this.input2 = new PlayerInput(this);
    this.isPaused = false;
    this.gameOverShown = false;
    this.sessionStart = this.time.now;
    this.mazeWalls = [];
    this.mazePhase = 'A';
    this.fruitPlats = [];
    this.hiddenPlatforms = [];
    this.arenaWalls = [];
    this.boss = undefined;
    this.bossDeathHandled = false;
    this.fragment = undefined;
    this.exitToasted = false;
    this.travelling = false;

    this.buildParallax();
    this.buildWorld();

    this.physics.world.setBounds(0, -VIEW_H, def.meta.widthPx, def.meta.heightPx + VIEW_H);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.cameras.main.setZoom(RENDER_ZOOM);
    this.cameras.main.setBounds(0, 0, def.meta.widthPx, def.meta.heightPx);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.14);
    this.cameras.main.setDeadzone(46, 30); // room for the tall apple-tree climb
    this.cameras.main.setFollowOffset(0, -12);
    this.cameras.main.fadeIn(500, 5, 7, 12);

    this.wireCollisions();
    this.applySaveState();

    if (!this.scene.isActive(SCENES.ui)) this.scene.launch(SCENES.ui);

    quests.load('the-endless-harvest');
    quests.init();
    this.player.refreshHud();
    audio.playMusic('orchard');
    bus.emit(EVT.fragmentCount, { count: getSave().signalFragments });
    bus.emit(EVT.sceneChanged, { scene: SCENES.orchard, zone: "Patterson's Orchard" });

    if (quests.stepId === 'arrive') this.time.delayedCall(650, () => this.showHowToPlay());

    // the maze "thinks": walls rearrange on a readable, telegraphed beat
    this.time.addEvent({ delay: ORCHARD.mazeShiftPeriodMs, loop: true, callback: () => this.shiftMaze() });
    this.scheduleFruitCycle();

    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.unsubs.push(bus.on(EVT.uiResume, () => this.setPaused(false)));
    this.unsubs.push(bus.on(EVT.debugGotoBlipstream, () => this.enterMaze(true)));
    this.unsubs.push(bus.on(EVT.skinSelected, (d) => this.applySkinLive((d as { id: string }).id)));
    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    registerScene('orchard', this);
  }

  /* ------------------------------- construction ------------------------------ */

  private buildParallax(): void {
    this.sky = this.add.image(0, 0, TEX.orchardSky).setOrigin(0).setScrollFactor(0).setDepth(0);
    this.sky.setDisplaySize(VIEW_W, VIEW_H);
    this.stars = this.add.tileSprite(0, 0, VIEW_W, 120, TEX.orchardStars).setOrigin(0).setScrollFactor(0).setDepth(1).setAlpha(0.8);
    // distant orchard-row hills
    this.hills = this.add.tileSprite(0, VIEW_H - 116, VIEW_W, 64, TEX.orchardHills).setOrigin(0).setScrollFactor(0).setDepth(2).setAlpha(0.9);
    // a distant barn silhouette on the horizon (the landmark reads from afar too)
    this.add.image(340, VIEW_H - 108, TEX.orchardBarn).setOrigin(0.5, 1).setScrollFactor(0.08, 0.03).setDepth(2).setAlpha(0.5);
    // warm harvest haze low on the horizon
    this.add.image(VIEW_W * 0.7, VIEW_H - 96, TEX.glow8).setScale(8).setTint(P.warning).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.06).setScrollFactor(0.3, 0.1).setDepth(3);
    // drifting chaff-laden fog rolling across the rows
    this.fog = this.add.tileSprite(0, VIEW_H - 108, VIEW_W, 60, TEX.millerFog).setOrigin(0, 0).setScrollFactor(0).setDepth(5).setAlpha(0.34);
    this.add.image(0, 0, TEX.vignette).setOrigin(0).setScrollFactor(0).setDepth(11).setDisplaySize(VIEW_W, VIEW_H).setAlpha(0.4);
  }

  private buildWorld(): void {
    const def = PATTERSONS_ORCHARD;
    this.solids = this.physics.add.staticGroup();
    this.mazeGroup = this.physics.add.staticGroup();
    this.fruitGroup = this.physics.add.staticGroup();
    this.gateGroup = this.physics.add.staticGroup();
    this.playerBolts = makeProjectileGroup(this, TEX.boltPlayer, PULSE.maxActive);
    this.enemyBolts = makeProjectileGroup(this, TEX.boltEnemy, DRONE.maxBolts + 20);

    walkLevel(def, (ch, col, row, x, y) => {
      switch (ch) {
        case '#': {
          const t = this.solids.create(x, y, TEX.orchardGround) as Phaser.Physics.Arcade.Image;
          t.setDepth(6);
          (t.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 16);
          break;
        }
        case '=': {
          const t = this.solids.create(x, y, TEX.orchardPlatform) as Phaser.Physics.Arcade.Image;
          t.setDepth(6);
          (t.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 8).setOffset(0, 0);
          break;
        }
        case '%': {
          const t = this.fruitGroup.create(x, y, TEX.fruitPlatform) as Phaser.Physics.Arcade.Image;
          t.setDepth(6);
          (t.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 8).setOffset(0, 0);
          this.fruitPlats.push(t);
          break;
        }
        case 'Q': this.addMazeWall(x, y, 'A'); break;
        case 'W': this.addMazeWall(x, y, 'B'); break;
        case 'Y': this.add.image(x, y + 8, TEX.appleTree).setOrigin(0.5, 1).setDepth(3); break;
        case 'R': this.add.image(x, y + 15, TEX.orchardBarn).setOrigin(0.5, 1).setDepth(4).setScale(1.4); break;
        case 'L': this.addOrchardLight(x, y, col); break;
        case 'h': {
          const hp = new HiddenPlatform(this, x, y, false);
          this.hiddenPlatforms.push(hp);
          break;
        }
        case 'f':
          this.add.image(x, y + 8, col > 138 ? TEX.signpost : TEX.hayBale).setOrigin(0.5, 1).setDepth(5);
          break;
        case 'c': this.badge = new Collectible(this, x, y, 'badge-cameron', false, P.scoutCameron); break;
        case 'K': this.relic = new Collectible(this, x, y, 'relic-cameron', false, P.scoutCameron); break;
        case 'k': {
          this.cellarCache = new Collectible(this, x, y, 'cache', false, P.warning);
          this.add.text(x, y - 14, 'CIDER CELLAR', { fontFamily: 'monospace', fontSize: '6px', color: css(P.warning) }).setOrigin(0.5).setDepth(11).setResolution(2).setAlpha(0.8);
          break;
        }
        case 'F': this.addFoldMouth(x, y); break;
        case 'g': this.buildCropGate(col, row); break;
        case 'V': /* Harvest Pattern spawns on the boss trigger at arena.centerX */ break;
        case 'P':
          this.spawnPoint = { x, y: y - 2 };
          this.lastSafe = { ...this.spawnPoint };
          this.player = new Player(this, x, y - 2, this.fx);
          this.player.setSkin(getSave().selectedSkin);
          this.emitSkin();
          break;
      }
    });

    this.addClimbTrunks();
  }

  /**
   * The apple-tree-pillar climb: two trunks rise behind the '=' / '%' shelf
   * columns so the fruit platforms read as apples ON a tree rather than as
   * bunches floating in the air. Pure decor (no bodies), drawn behind the
   * shelves (depth 2.6 < platform depth 6) and capped with a foliage crown.
   */
  private addClimbTrunks(): void {
    const floorY = 44 * TILE; // orchard floor surface (row 44 → 704)
    // [trunk center x, crown-top surface y] for the left ('=') and right ('%') pillars
    const pillars: Array<[number, number]> = [
      [16 * TILE + TILE / 2, 14 * TILE + TILE / 2], // left shelves, up to the barn level (row 14)
      [21 * TILE + TILE / 2, 16 * TILE + TILE / 2], // right fruit shelves (row 16)
    ];
    for (const [cx, topY] of pillars) {
      this.add
        .tileSprite(cx, floorY, 14, floorY - topY, TEX.orchardTrunk)
        .setOrigin(0.5, 1)
        .setDepth(2.6);
      this.add.image(cx, topY + 6, TEX.appleTree).setOrigin(0.5, 1).setDepth(3); // leafy crown
    }
  }

  private addMazeWall(x: number, y: number, phase: 'A' | 'B'): void {
    const img = this.mazeGroup.create(x, y, TEX.cornWall) as Phaser.Physics.Arcade.Image;
    img.setDepth(7);
    (img.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 16);
    const solid = phase === 'A'; // start on phase A
    (img.body as Phaser.Physics.Arcade.StaticBody).enable = solid;
    img.setAlpha(solid ? 1 : 0.12);
    this.mazeWalls.push({ img, phase });
  }

  private addOrchardLight(x: number, y: number, col: number): void {
    const purple = col % 2 === 0;
    const tint = purple ? P.orchardLightPurple : P.orchardLightRed;
    this.add.image(x, y, TEX.orchardLight).setDepth(5).setTint(tint);
    const glow = this.add.image(x, y + 4, TEX.glow8).setScale(1.6).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(4).setAlpha(0.4);
    this.tweens.add({ targets: glow, alpha: { from: 0.22, to: 0.5 }, duration: 900 + x, yoyo: true, repeat: -1 });
  }

  private addFoldMouth(x: number, y: number): void {
    this.foldPos = { x, y };
    const glow = this.add.image(x, y - 6, TEX.glow8).setScale(3.4).setTint(P.cropGlow).setBlendMode(Phaser.BlendModes.ADD).setDepth(5).setAlpha(0.3);
    this.tweens.add({ targets: glow, alpha: { from: 0.2, to: 0.5 }, scale: { from: 3, to: 4 }, duration: 1100, yoyo: true, repeat: -1 });
    this.add.image(x, y - 6, TEX.cropGlyph).setDepth(6).setAlpha(0.7);
    this.add.text(x, y - 26, 'INTO THE MAZE [E]', { fontFamily: 'monospace', fontSize: '7px', color: css(P.cropGlow) }).setOrigin(0.5).setDepth(11).setResolution(2).setAlpha(0.85);
  }

  /** the crop-circle gate: a corn barrier sealed until the Fold blooms the circle */
  private buildCropGate(col: number, row: number): void {
    const cx = col * TILE + TILE / 2;
    this.gateGlyph = this.add.image(cx, (row - 3) * TILE + TILE / 2, TEX.cropGlyph).setDepth(7).setTint(P.orchardLightPurple).setAlpha(0.8);
    if (getSave().flags.orchardMazeSolved) return; // already opened on a prior visit
    for (let r = row - 6; r <= row; r++) {
      const gy = r * TILE + TILE / 2;
      const img = this.gateGroup.create(cx, gy, TEX.cornWall) as Phaser.Physics.Arcade.Image;
      img.setDepth(7).setTint(P.orchardLightPurple);
      (img.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 16);
    }
  }

  private wireCollisions(): void {
    for (const grp of [this.solids, this.mazeGroup, this.fruitGroup, this.gateGroup]) {
      this.physics.add.collider(this.player, grp);
      this.physics.add.collider(this.enemyBolts, grp, (bolt) => (bolt as Projectile).kill());
    }
    this.hiddenPlatforms.forEach((hp) => this.physics.add.collider(this.player, hp));

    this.physics.add.collider(this.playerBolts, this.solids, (bolt) => {
      const b = bolt as Projectile;
      this.fx.sparks(b.x, b.y, activeSkin().color, 3);
      b.kill();
    });
    for (const grp of [this.mazeGroup, this.fruitGroup, this.gateGroup]) {
      this.physics.add.collider(this.playerBolts, grp, (bolt) => (bolt as Projectile).kill());
    }

    this.physics.add.overlap(this.enemyBolts, this.player, (_pl, bolt) => {
      const b = bolt as Projectile;
      if (!b.active || this.player.invulnerable) return;
      b.kill();
      this.hurtPlayer(1, b.x);
    });
  }

  private applySaveState(): void {
    const s = getSave();
    if (s.flags.cameronBadgeCollected && this.badge) { this.badge.destroy(); this.badge = undefined; }
    if (s.signalSets.cameron?.relic && this.relic) { this.relic.destroy(); this.relic = undefined; }
    if (s.foundSecrets.includes('orchard-cider-cellar') && this.cellarCache) { this.cellarCache.destroy(); this.cellarCache = undefined; }
    if (s.flags.orchardMazeSolved && this.gateGlyph) this.gateGlyph.setTint(P.cropGlow).setAlpha(0.5);
    if (s.flags.harvestPatternDefeated && !s.flags.orchardFragmentCollected) this.spawnFragment();
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
        accent: 'cameron',
      });
    });
  }

  /* --------------------------- the maze that thinks -------------------------- */

  /** telegraph the incoming walls, then flip the phase on the beat */
  private shiftMaze(): void {
    if (this.isPaused || this.gameOverShown) return;
    const next: 'A' | 'B' = this.mazePhase === 'A' ? 'B' : 'A';
    this.mazeWalls
      .filter((w) => w.phase === next)
      .forEach((w) => {
        w.img.setTint(P.orchardLightPurple).setVisible(true);
        this.tweens.add({ targets: w.img, alpha: { from: 0.12, to: 0.6 }, duration: ORCHARD.mazeTelegraphMs / 2, yoyo: true, repeat: 1 });
      });
    this.time.delayedCall(ORCHARD.mazeTelegraphMs, () => this.setMazePhase(next));
  }

  private setMazePhase(phase: 'A' | 'B'): void {
    this.mazePhase = phase;
    audio.hazardZap();
    for (const w of this.mazeWalls) {
      const solid = w.phase === phase;
      (w.img.body as Phaser.Physics.Arcade.StaticBody).enable = solid;
      w.img.clearTint().setAlpha(solid ? 1 : 0.12);
      // soft corn — never trap the player: nudge them clear of a wall that just closed
      if (solid && this.player?.active && Math.abs(this.player.x - w.img.x) < 12 && Math.abs(this.player.y - w.img.y) < 22) {
        const pbody = this.player.body as Phaser.Physics.Arcade.Body;
        this.player.setPosition(w.img.x - 14, this.player.y);
        pbody.setVelocity(0, pbody.velocity.y);
        this.fx.sparks(w.img.x, this.player.y, P.cornSilk, 4);
      }
    }
  }

  /** respawning fruit platforms: solid for a while, blink, vanish briefly, regrow */
  private scheduleFruitCycle(): void {
    this.setFruit(true);
    this.time.delayedCall(ORCHARD.fruitRespawnMs, () => {
      if (!this.scene.isActive()) return;
      // telegraph the drop
      this.fruitPlats.forEach((f) => this.tweens.add({ targets: f, alpha: { from: 1, to: 0.4 }, duration: ORCHARD.fruitTelegraphMs / 2, yoyo: true, repeat: 1 }));
      this.time.delayedCall(ORCHARD.fruitTelegraphMs, () => {
        if (!this.scene.isActive()) return;
        this.setFruit(false);
        this.time.delayedCall(Math.round(ORCHARD.fruitRespawnMs * 0.55), () => {
          if (!this.scene.isActive()) return;
          this.scheduleFruitCycle();
        });
      });
    });
  }

  private setFruit(present: boolean): void {
    for (const f of this.fruitPlats) {
      (f.body as Phaser.Physics.Arcade.StaticBody).enable = present;
      f.setAlpha(present ? 1 : 0.14);
    }
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

    if (this.input2.shootDown && this.player.canShoot() && this.player.alive) {
      this.player.markShoot();
      const dir = this.player.facing;
      const surge = this.player.isSurgeShot;
      const bolt = fireFrom(this.playerBolts, this.player.x + dir * 8, this.player.y - 1, dir * PULSE.speed, 0, PULSE.lifeMs);
      if (bolt) {
        (bolt as unknown as { surge?: boolean }).surge = surge;
        if (surge) bolt.setTint(0xffffff).setScale(1.5);
        else bolt.setTint(activeSkin().color).setScale(1);
      }
      audio.pulseShot();
      this.bumpStat('pulseShotsFired');
    }

    if (this.input2.scanJustDown && this.player.canScan() && this.player.alive) this.doScan();

    // interact at the Fold mouth → the top-down maze
    if (
      this.input2.interactJustDown &&
      !getSave().flags.orchardMazeSolved &&
      Math.abs(this.player.x - this.foldPos.x) < 20 &&
      Math.abs(this.player.y - this.foldPos.y) < 34
    ) {
      this.enterMaze(false);
    }

    this.boss?.update(dtSec);
    if (this.boss?.state === 'dying' && !this.bossDeathHandled) {
      this.bossDeathHandled = true;
      (this.enemyBolts.getChildren() as Projectile[]).forEach((b) => b.active && b.kill());
    }

    this.updateQuestTriggers();

    if (this.player.y > PATTERSONS_ORCHARD.meta.heightPx + FALL_DAMAGE_Y_PAD && this.player.alive) {
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
    this.fogDrift += dtSec * 6;
    this.stars.tilePositionX = sx * 0.03;
    this.hills.tilePositionX = sx * 0.14;
    this.fog.tilePositionX = sx * 0.42 + this.fogDrift;
  }

  private updateQuestTriggers(): void {
    const zones = PATTERSONS_ORCHARD.meta.zones;
    const x = this.player.x;
    const step = quests.stepId;
    if (step === 'arrive' && Math.abs(x - this.spawnPoint.x) > 56) quests.complete('arrive');
    if (step === 'climb' && x > zones.mazeApproach.x0) quests.complete('climb');
    // boss wakes once the crop circle is drawn and you reach the arena
    if (
      step === 'bossFight' &&
      !this.boss &&
      getSave().flags.orchardMazeSolved &&
      x >= zones.bossTrigger.x0 &&
      x <= zones.bossTrigger.x1
    ) {
      this.spawnBoss();
    }
    // county-road exit → the finale. The road runs UP into the storm.
    if (getSave().flags.orchardFragmentCollected && !this.exitToasted && x > zones.exit.x0) {
      this.exitToasted = true;
      bus.emit(EVT.toast, { text: 'THE COUNTY ROAD RUNS ON — SKYLINE ARRAY AHEAD', color: 'green' });
      updateSave((s) => {
        s.currentZone = 'skyline-array';
        s.currentQuest = 'the-sky-listens';
        s.questStep = 'launch';
        s.completedQuestSteps = [];
        if (!s.completedZones.includes('pattersons-orchard')) s.completedZones.push('pattersons-orchard');
      });
      quests.load('the-sky-listens');
      quests.restart();
      audio.transitionWarp();
      this.cameras.main.fadeOut(500, 6, 3, 12);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.skyline));
    }
  }

  private doScan(): void {
    this.player.markScan();
    audio.scanPulse();
    this.fx.scanRing(this.player.x, this.player.y, this.player.scanRadius, SCAN.durationMs);
    this.bumpStat('scansUsed');
    const px = this.player.x;
    const py = this.player.y;
    this.hiddenPlatforms.forEach((hp, i) => {
      if (!hp.revealed && Phaser.Math.Distance.Between(px, py, hp.x, hp.y) < this.player.scanRadius * 1.2) hp.reveal(i * 40);
    });
    if (this.boss && this.boss.state === 'fighting' && Phaser.Math.Distance.Between(px, py, this.boss.core.x, this.boss.core.y) < this.player.scanRadius + 40) {
      this.boss.onScanned();
    }
  }

  private checkPickups(): void {
    const near = (o: { x: number; y: number }, r: number) => Phaser.Math.Distance.Between(this.player.x, this.player.y, o.x, o.y) < r;
    // Cameron / ECHO badge (grants badge + log pieces)
    if (this.badge && !this.badge.collected && near(this.badge, 14)) {
      this.badge.collect();
      audio.badgePickup();
      this.fx.flash(P.scoutCameron, 120);
      this.fx.explode(this.badge.x, this.badge.y, P.scoutCameron, 14);
      const log = logById('cameron-log-1');
      updateSave((s) => {
        s.flags.cameronBadgeCollected = true;
        if (!s.discoveredScoutBadges.includes('cameron')) s.discoveredScoutBadges.push('cameron');
        if (log && !s.discoveredScoutLogs.includes('cameron-log-1')) s.discoveredScoutLogs.push('cameron-log-1');
      });
      recordSetPiece('cameron', 'badge');
      recordSetPiece('cameron', 'log');
      if (log) bus.emit(EVT.scoutLog, { title: log.title, body: log.body, accent: 'cameron' });
      bus.emit(EVT.toast, { text: 'SCOUT BADGE — CAMERON / ECHO (4/5)', color: 'green' });
      this.badge = undefined;
      this.checkSetComplete('cameron');
    }
    // the Tuning Fork relic (maze heart)
    if (this.relic && !this.relic.collected && near(this.relic, 15)) {
      this.relic.collect();
      audio.badgePickup();
      this.fx.flash(P.scoutCameron, 120);
      this.fx.explode(this.relic.x, this.relic.y, P.scoutCameron, 14);
      updateSave((s) => { s.flags.cameronLoftFound = true; });
      recordSetPiece('cameron', 'relic');
      bus.emit(EVT.toast, { text: 'RELIC RECOVERED — THE TUNING FORK', color: 'green' });
      this.relic = undefined;
      this.checkSetComplete('cameron');
    }
    // hidden cider-cellar cache (Signal Shards)
    if (this.cellarCache && !this.cellarCache.collected && near(this.cellarCache, 15)) {
      this.cellarCache.collect();
      audio.badgePickup();
      this.fx.flash(P.warning, 120);
      const bal = addShards(PROGRESSION.shardsPerCache);
      updateSave((s) => {
        if (!s.foundSecrets.includes('orchard-cider-cellar')) s.foundSecrets.push('orchard-cider-cellar');
      });
      bus.emit(EVT.toast, { text: `CIDER CELLAR — +${PROGRESSION.shardsPerCache} SHARDS (${bal})`, color: 'orange' });
      this.cellarCache = undefined;
    }
    // Signal Fragment #4
    if (this.fragment && !this.fragment.collected) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.fragment.x, this.fragment.y);
      if (d < 64) this.fragment.magnetTo(this.player.x, this.player.y, this.game.loop.delta / 1000);
      if (d < 16) this.collectFragment();
    }
  }

  /* ------------------------------ the Fold + maze ---------------------------- */

  enterMaze(viaDebug: boolean): void {
    if (this.isPaused || this.gameOverShown || getSave().flags.orchardMazeSolved) return;
    void viaDebug;
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.flushTime();
    this.registry.set('sweepArenaId', ORCHARD.fold.arenaId); // 'maze-z4'
    this.registry.set('sweepReturnScene', SCENES.orchard);
    this.registry.set('nodeJustSolved', false);
    foldCollapse(this, this.fx, () => {
      bus.emit(EVT.sceneChanged, { scene: SCENES.sweep, zone: 'The Living Maze' });
      this.scene.switch(SCENES.sweep);
    });
  }

  private onWake(): void {
    audio.playMusic('orchard');
    bus.emit(EVT.sceneChanged, { scene: SCENES.orchard, zone: "Patterson's Orchard" });
    quests.emitObjective();
    this.player.refreshHud();
    this.fx.staticBurst(300);
    if (this.registry.get('nodeJustSolved') === true) {
      this.registry.set('nodeJustSolved', false);
      this.applyCropDrawn();
    }
  }

  /** the crop circle bloomed in the maze — the sealed gate to the heart opens */
  applyCropDrawn(): void {
    updateSave((s) => {
      s.flags.orchardMazeSolved = true;
      s.flags.orchardCropBloomed = true;
    });
    if (quests.stepId === 'maze') quests.complete('maze');
    this.openCropGate();
    audio.doorUnlock();
    this.fx.flash(P.cropGlow, 200);
    this.fx.shake(0.004, 250);
    bus.emit(EVT.toast, { text: 'THE CROP CIRCLE OPENS THE WAY — THE MAZE HEART AWAITS', color: 'green' });
  }

  private openCropGate(): void {
    (this.gateGroup.getChildren() as Phaser.Physics.Arcade.Image[]).forEach((img) => {
      this.fx.sparks(img.x, img.y, P.cropGlow, 4);
      img.destroy();
    });
    this.gateGlyph?.setTint(P.cropGlow).setAlpha(0.5);
  }

  /* --------------------------------- boss ------------------------------------ */

  spawnBoss(): void {
    if (this.boss) return;
    const arena = PATTERSONS_ORCHARD.meta.arena;
    this.boss = new HarvestPatternBoss(this, arena.centerX, arena.surfaceY, arena.leftPx, arena.rightPx, {
      fx: this.fx,
      fireSymbol: (x, y, vx, vy) => {
        const b = fireFrom(this.enemyBolts, x, y, vx, vy, BOSS4.symbolLifeMs);
        if (b) b.setTint(P.orchardLightRed);
      },
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

  private onBossDefeated(): void {
    this.arenaWalls.forEach((w) => w.destroy());
    this.arenaWalls = [];
    (this.enemyBolts.getChildren() as Projectile[]).forEach((b) => b.active && b.kill());
    updateSave((s) => {
      s.flags.harvestPatternDefeated = true;
      s.playerStats.enemiesDefeated += 1;
    });
    if (quests.stepId === 'bossFight') quests.complete('bossFight');
    this.spawnFragment();
    bus.emit(EVT.toast, { text: 'THE PATTERN UNRAVELS — THE HARVEST CAN END', color: 'green' });
  }

  spawnFragment(): void {
    const arena = PATTERSONS_ORCHARD.meta.arena;
    this.fragment = new Collectible(this, arena.centerX, arena.surfaceY - 3 * TILE, 'fragment', false);
  }

  /* ------------------------------- TestAPI hooks ----------------------------- */

  get apiLastSafe(): { x: number; y: number } {
    return this.lastSafe;
  }

  apiCompleteSet(scoutId: string): void {
    recordSetPiece(scoutId, 'badge');
    recordSetPiece(scoutId, 'log');
    recordSetPiece(scoutId, 'relic');
    this.checkSetComplete(scoutId);
  }
  apiCollectFragment(): void {
    if (getSave().flags.orchardFragmentCollected) return;
    if (!this.fragment) this.spawnFragment();
    this.collectFragment();
  }
  /** deterministic test hook: bloom the crop circle without the Fold */
  apiCropDrawn(): void {
    this.applyCropDrawn();
  }

  private collectFragment(): void {
    if (!this.fragment) return;
    this.fragment.collect();
    this.fragment = undefined;
    audio.fragmentPickup();
    this.fx.flash(P.cropGlow, 220);
    this.fx.shake(0.004, 200);
    updateSave((s) => {
      s.signalFragments = Math.max(4, s.signalFragments + 1);
      s.flags.orchardFragmentCollected = true;
      if (!s.completedZones.includes('pattersons-orchard')) s.completedZones.push('pattersons-orchard');
    });
    const ability = progression.grantZoneSignature('pattersons-orchard');
    bus.emit(EVT.fragmentCount, { count: getSave().signalFragments });
    if (quests.stepId === 'collectFragment') quests.complete('collectFragment');
    bus.emit(EVT.scoutLog, {
      title: 'SIGNAL FRAGMENT SECURED — 4 / ?',
      body:
        'The maze stops re-drawing itself. Somewhere a harvest is finally allowed to end, and the apples let go of the branch.\n\n' +
        'Fragment archived. Cameron’s file is no longer UNKNOWN — ECHO’s signal is yours.' +
        (ability ? `\n\n◆ ABILITY UNLOCKED — ${ability.name}\n${ability.description}` : '') +
        '\n\nDirective unchanged: stay unknown.',
      accent: 'cameron',
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
      this.scene.launch(SCENES.gameOver, { from: SCENES.orchard });
      this.scene.pause();
    });
  }

  private showHowToPlay(): void {
    bus.emit(EVT.tutorial, {
      title: "PATTERSON'S ORCHARD — THE MAZE THINKS",
      accent: 'cameron',
      html: `
        <p class="tut-lead">The harvest won’t end. Apples regrow mid-fall, and the corn maze <b>re-draws itself</b> — on a <b>readable beat</b>, not at random. Read the rhythm.</p>
        <div class="tut-hero">
          <div class="tut-hero-key">READ<span>THE&nbsp;PATTERN</span></div>
          <div class="tut-hero-desc">Climb the <b>apple-tree pillars</b> (fruit platforms regrow — mind the timing). Watch the corn walls <b>telegraph</b> before they shift. At the maze mouth, press <b>[E]</b> to drop into the top-down maze and draw the crop circle.</div>
        </div>
        <table class="tut-controls">
          <tr><td class="tut-k">A / D · SPACE</td><td>Move · jump (hold to hover)</td></tr>
          <tr><td class="tut-k">SHIFT</td><td>Dash</td></tr>
          <tr><td class="tut-k">X · LEFT CLICK</td><td>Pulse — hit the boss core</td></tr>
          <tr><td class="tut-k">Q · RIGHT CLICK</td><td>Scan — reveal hidden platforms · expose the core</td></tr>
          <tr><td class="tut-k">E</td><td>Into the maze (the Fold)</td></tr>
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
      scene: 'OrchardScene',
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      quest: quests.stepId,
      playerBolts: this.playerBolts.countActive(true),
      maze: this.mazePhase,
      energy: Math.round(this.player.energy),
      hp: this.player.hp,
      boss: this.boss ? `${this.boss.state} ${this.boss.hp}hp` : '—',
    });
    void this.travelling;
  }

  private onShutdown(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.boss?.destroy();
    unregisterScene('orchard');
  }
}
