/**
 * MOTEL NOWHERE — Zone 2 overworld.
 * "The neon is the level": only LIT signs are solid. Shoot power switches to
 * flip circuit groups on/off, jack into Chip's fuse box (a Blipstream circuit)
 * to wake a dead wing, climb the staircase of light, and break the loop by
 * bringing down THE VACANCY SIGN. Wet-asphalt night, security-light detection.
 */
import Phaser from 'phaser';
import {
  DRONE,
  EVT,
  FALL_DAMAGE_Y_PAD,
  MOTEL,
  VIEW_H,
  VIEW_W,
  PALETTE as P,
  PULSE,
  RENDER_ZOOM,
  SCAN,
  SCENES,
  TEX,
  TILE,
} from '../config';
import { MOTEL_NOWHERE, walkLevel } from '../data/levels';
import { logById } from '../data/scouts';
import { skinByScout } from '../data/skins';
import { Collectible } from '../entities/Collectible';
import { DetectionCone } from '../entities/DetectionCone';
import { Player } from '../entities/Player';
import { Projectile, fireFrom, makeProjectileGroup } from '../entities/Projectile';
import { ScoutEcho } from '../entities/ScoutEcho';
import { VacancySignBoss } from '../entities/VacancySignBoss';
import { audio } from '../systems/AudioSystem';
import { applyCameraLook } from '../systems/CameraLook';
import { ClassificationSystem } from '../systems/ClassificationSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { foldCollapse } from '../systems/FoldTransition';
import { attachScreenFilter } from '../systems/ScreenFilter';
import { bus } from '../systems/EventBus';
import { PlayerInput } from '../systems/InputSystem';
import { quests } from '../systems/QuestSystem';
import { getSave, recordSetPiece, setProgress, unlockSkin, updateSave } from '../systems/SaveSystem';
import { placeSecretCues, resolveScanSecrets, retireSecretCue } from '../systems/Secrets';
import { progression } from '../systems/ProgressionSystem';
import { activeSkin, skinAbilities } from '../systems/SkinState';
import { registerScene, unregisterScene } from '../systems/TestAPI';
import { uiOverlayActive } from '../systems/UIState';

type Circuit = 'A' | 'B' | 'C';
const GROUP_COLOR: Record<Circuit, number> = { A: P.neonCyan, B: P.neonAmber, C: P.neonPink };

interface NeonPlat {
  img: Phaser.Physics.Arcade.Image;
  ghost: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  group: Circuit;
}
interface PowerSwitch {
  sprite: Phaser.Physics.Arcade.Image;
  glow: Phaser.GameObjects.Image;
  group: Circuit;
}
interface SecurityLamp {
  cone: DetectionCone;
}

export class MotelScene extends Phaser.Scene {
  player!: Player;
  private input2!: PlayerInput;
  fx!: EffectsSystem;
  classify = new ClassificationSystem();

  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private neonSolids!: Phaser.Physics.Arcade.StaticGroup;
  private neon: NeonPlat[] = [];
  private switches: PowerSwitch[] = [];
  private lamps: SecurityLamp[] = [];
  private secretCues: Record<string, Phaser.GameObjects.Image> = {};
  private powered: Record<Circuit, boolean> = { A: false, B: false, C: false };
  private fuseBoxPos = { x: 0, y: 0 };
  private fuseUsed = false;

  playerBolts!: Phaser.Physics.Arcade.Group;
  enemyBolts!: Phaser.Physics.Arcade.Group;
  boss?: VacancySignBoss;
  private bossDeathHandled = false;
  private arenaWalls: Phaser.Physics.Arcade.Image[] = [];

  private badge?: Collectible;
  private relic?: Collectible;
  private fragment?: Collectible;

  private spawnPoint = { x: 0, y: 0 };
  private lastSafe = { x: 0, y: 0 };
  private camLookX = 0; // smoothed horizontal camera lookahead (shared with Miller Field)
  private sky!: Phaser.GameObjects.Image;
  private stars!: Phaser.GameObjects.TileSprite;
  private hills!: Phaser.GameObjects.TileSprite;
  private fog!: Phaser.GameObjects.TileSprite;
  private rainDrift = 0;
  private isPaused = false;
  private travelling = false;
  private gameOverShown = false;
  private statFlushAt = 0;
  private sessionStart = 0;
  private unsubs: Array<() => void> = [];

  constructor() {
    super(SCENES.motel);
  }

  create(): void {
    const def = MOTEL_NOWHERE;
    this.fx = new EffectsSystem(this);
    attachScreenFilter(this, true); // level screen filter (dialed down for gameplay)
    this.input2 = new PlayerInput(this);
    this.isPaused = false;
    this.gameOverShown = false;
    this.sessionStart = this.time.now;
    this.neon = [];
    this.switches = [];
    this.lamps = [];
    this.powered = { A: false, B: false, C: false };
    this.arenaWalls = [];
    this.boss = undefined;
    this.bossDeathHandled = false;
    this.fragment = undefined;
    this.fuseUsed = false;
    this.travelling = false;
    this.camLookX = 0;

    this.buildParallax();
    this.buildWorld();
    this.secretCues = placeSecretCues(this, 'motel-nowhere');

    this.physics.world.setBounds(0, -VIEW_H, def.meta.widthPx, def.meta.heightPx + VIEW_H);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.cameras.main.setZoom(RENDER_ZOOM);
    this.cameras.main.setBounds(0, 0, def.meta.widthPx, def.meta.heightPx);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(52, 36);
    this.cameras.main.fadeIn(500, 6, 3, 12);

    this.wireCollisions();
    this.applySaveState();

    if (!this.scene.isActive(SCENES.ui)) this.scene.launch(SCENES.ui);

    quests.load('the-long-night');
    quests.init();
    this.player.refreshHud();
    audio.playMusic('motel');
    bus.emit(EVT.fragmentCount, { count: getSave().signalFragments });
    bus.emit(EVT.sceneChanged, { scene: SCENES.motel, zone: 'Motel Nowhere' });

    if (quests.stepId === 'arrive') this.time.delayedCall(650, () => this.showHowToPlay());

    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.unsubs.push(bus.on(EVT.uiResume, () => this.setPaused(false)));
    this.unsubs.push(bus.on(EVT.debugGotoBlipstream, () => this.enterCircuit(true)));
    this.unsubs.push(bus.on(EVT.skinSelected, (d) => this.applySkinLive((d as { id: string }).id)));
    this.unsubs.push(bus.on(EVT.musicBeat, (d) => this.onBeat(d as { bar: number; step: number })));
    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    registerScene('motel', this);
  }

  /* ------------------------------- construction ------------------------------ */

  private buildParallax(): void {
    this.sky = this.add.image(0, 0, TEX.motelSky).setOrigin(0).setScrollFactor(0).setDepth(0);
    this.sky.setDisplaySize(VIEW_W, VIEW_H);
    this.stars = this.add.tileSprite(0, 0, VIEW_W, 160, TEX.motelStars).setOrigin(0).setScrollFactor(0).setDepth(1).setAlpha(0.9);
    // a low waning moon behind haze
    this.add.image(392, 44, TEX.glow8).setScale(9).setTint(P.motelHaze).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.2).setScrollFactor(0.03, 0.02).setDepth(1);
    // distant highway billboard
    this.add.image(VIEW_W * 0.5, 96, TEX.motelBillboard).setScrollFactor(0.18, 0.08).setDepth(2);
    this.hills = this.add.tileSprite(0, VIEW_H - 118, VIEW_W, 70, TEX.motelHills).setOrigin(0).setScrollFactor(0).setDepth(2).setAlpha(0.9);
    // a faint neon haze glow on the horizon (the motel's endless light)
    this.add.image(VIEW_W * 0.72, VIEW_H - 96, TEX.glow8).setScale(8).setTint(P.neonPink).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.07).setScrollFactor(0.3, 0.1).setDepth(3);
    // drifting neon-lot fog rolling across the wet asphalt
    this.fog = this.add.tileSprite(0, VIEW_H - 108, VIEW_W, 60, TEX.motelFog).setOrigin(0, 0).setScrollFactor(0).setDepth(5).setAlpha(0.4);
    // cinematic vignette (frames the edges; foreground stays bright)
    this.add.image(0, 0, TEX.vignette).setOrigin(0).setScrollFactor(0).setDepth(11).setDisplaySize(VIEW_W, VIEW_H).setAlpha(0.42);
  }

  private buildWorld(): void {
    const def = MOTEL_NOWHERE;
    this.solids = this.physics.add.staticGroup();
    this.neonSolids = this.physics.add.staticGroup();
    this.playerBolts = makeProjectileGroup(this, TEX.boltPlayer, PULSE.maxActive);
    this.enemyBolts = makeProjectileGroup(this, TEX.boltEnemy, DRONE.maxBolts + 20);

    walkLevel(def, (ch, _col, _row, x, y) => {
      switch (ch) {
        case '#': {
          const t = this.solids.create(x, y, TEX.wetGround) as Phaser.Physics.Arcade.Image;
          t.setDepth(6);
          (t.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 16);
          break;
        }
        case '=': {
          const t = this.solids.create(x, y, TEX.motelWall) as Phaser.Physics.Arcade.Image;
          t.setDepth(6);
          (t.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 8).setOffset(0, 0);
          break;
        }
        case 'A': this.addNeon(x, y, 'A'); break;
        case 'B': this.addNeon(x, y, 'B'); break;
        case 'C': this.addNeon(x, y, 'C'); break;
        case '1': this.addSwitch(x, y, 'A'); break;
        case '3': this.addSwitch(x, y, 'C'); break;
        case 'L': this.addLamp(x, y); break;
        case 'F': this.addFuseBox(x, y); break;
        case 'V': /* boss anchor — spawned on trigger */ break;
        case 'c':
          this.badge = new Collectible(this, x, y, 'badge-chip', false, P.scoutChip);
          break;
        case 'K':
          this.relic = new Collectible(this, x, y, 'relic-chip', false, P.scoutChip);
          break;
        case 'x': this.addSignalBox(x, y); break;
        case 'D': this.addDinerWindow(x, y); break;
        case 'I': this.add.image(x, y - 1, TEX.iceMachine).setDepth(5); break;
        case 'M': this.addMotelSign(x, y); break;
        case 'p': this.add.image(x, y + 6, TEX.puddle).setDepth(6).setAlpha(0.8); break;
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

  private addNeon(x: number, y: number, group: Circuit): void {
    const img = this.neonSolids.create(x, y, TEX.neonPlatform) as Phaser.Physics.Arcade.Image;
    img.setDepth(8).setTint(GROUP_COLOR[group]);
    (img.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 8).setOffset(0, 0);
    const glow = this.add.image(x, y, TEX.glow8).setScale(2.2).setTint(GROUP_COLOR[group]).setBlendMode(Phaser.BlendModes.ADD).setDepth(7).setAlpha(0);
    const ghost = this.add.image(x, y, TEX.neonPlatformDark).setDepth(7).setTint(GROUP_COLOR[group]).setAlpha(0.4);
    this.neon.push({ img, ghost, glow, group });
    // start unpowered
    img.setVisible(false);
    (img.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }

  private addSwitch(x: number, y: number, group: Circuit): void {
    const sprite = this.physics.add.staticImage(x, y, TEX.powerSwitch).setDepth(9);
    (sprite.body as Phaser.Physics.Arcade.StaticBody).setSize(12, 16);
    const glow = this.add.image(x, y - 5, TEX.glow8).setScale(1.1).setTint(P.danger).setBlendMode(Phaser.BlendModes.ADD).setDepth(10).setAlpha(0.6);
    this.switches.push({ sprite, glow, group });
  }

  private addLamp(x: number, y: number): void {
    // pole stands on the walkway (cell bottom); the lamp HEAD is up high so its
    // cone fans down over the ground where the player crosses
    this.add.image(x, y + 8, TEX.securityLamp).setOrigin(0.5, 1).setDepth(9);
    const headY = y + 8 - 34; // the overhead bulb
    const cone = new DetectionCone(this, MOTEL.securityConeLength, MOTEL.securityConeHalfAngleDeg);
    cone.setApex(x, headY);
    this.lamps.push({ cone });
  }

  private addFuseBox(x: number, y: number): void {
    this.fuseBoxPos = { x, y };
    this.add.image(x, y, TEX.fuseBox).setDepth(9);
    const glow = this.add.image(x, y, TEX.glow8).setScale(2.4).setTint(P.scoutChip).setBlendMode(Phaser.BlendModes.ADD).setDepth(8).setAlpha(0.25);
    this.tweens.add({ targets: glow, alpha: { from: 0.15, to: 0.4 }, duration: 900, yoyo: true, repeat: -1 });
    this.add.text(x, y - 18, 'JACK IN [E]', { fontFamily: 'monospace', fontSize: '7px', color: '#ffb03b' }).setOrigin(0.5).setDepth(11).setResolution(2).setAlpha(0.85);
  }

  private addSignalBox(x: number, y: number): void {
    this.add.image(x, y, TEX.signalBox).setDepth(6);
    this.add.image(x, y, TEX.glow8).setScale(1.6).setTint(P.scoutChip).setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setAlpha(0.3);
  }

  private addDinerWindow(x: number, y: number): void {
    this.add.image(x, y, TEX.dinerWindow).setDepth(5);
    this.add.image(x, y, TEX.glow8).setScale(3.2).setTint(P.dinerWarm).setBlendMode(Phaser.BlendModes.ADD).setDepth(4).setAlpha(0.18);
    this.add.image(x - 14, y - 2, TEX.neonSignDiner).setDepth(5);
  }

  private addMotelSign(x: number, y: number): void {
    this.add.image(x, y - 30, TEX.neonSignMotel).setDepth(5);
    this.add.image(x + 16, y - 30, TEX.neonArrow).setDepth(5);
    this.add.image(x + 4, y - 30, TEX.glow8).setScale(3).setTint(P.neonPink).setBlendMode(Phaser.BlendModes.ADD).setDepth(4).setAlpha(0.14);
  }

  /* ----------------------------- neon-power system --------------------------- */

  private setGroupPowered(group: Circuit, on: boolean, surge = false): void {
    this.powered[group] = on;
    for (const n of this.neon) {
      if (n.group !== group) continue;
      (n.img.body as Phaser.Physics.Arcade.StaticBody).enable = on;
      n.img.setVisible(on);
      n.ghost.setAlpha(on ? 0 : 0.4);
      n.glow.setAlpha(on ? 0.55 : 0);
      if (on && surge) {
        n.img.setScale(1.3, 1.6);
        this.tweens.add({ targets: n.img, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
      }
    }
    // switch indicators
    for (const s of this.switches) if (s.group === group) s.glow.setTint(on ? P.neonGreen : P.danger);
  }

  private toggleGroup(group: Circuit): void {
    const on = !this.powered[group];
    this.setGroupPowered(group, on);
    audio.nodeActivate();
    this.fx.flash(GROUP_COLOR[group], 90);
    bus.emit(EVT.toast, { text: on ? `CIRCUIT ${group} — LIT` : `CIRCUIT ${group} — DARK`, color: 'green' });
    if (on && group === 'A' && quests.stepId === 'powerDiner') quests.complete('powerDiner');
  }

  private wireCollisions(): void {
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.neonSolids);

    this.physics.add.collider(this.playerBolts, this.solids, (bolt) => {
      const b = bolt as Projectile;
      this.fx.sparks(b.x, b.y, activeSkin().color, 3);
      b.kill();
    });
    this.physics.add.collider(this.playerBolts, this.neonSolids, (bolt) => (bolt as Projectile).kill());
    this.physics.add.collider(this.enemyBolts, this.solids, (bolt) => (bolt as Projectile).kill());

    // shoot a power switch → flip its circuit
    this.switches.forEach((sw) => {
      this.physics.add.overlap(this.playerBolts, sw.sprite, (_s, bolt) => {
        const b = bolt as Projectile;
        if (!b.active) return;
        b.kill();
        this.fx.sparks(sw.sprite.x, sw.sprite.y, P.warning, 8);
        this.toggleGroup(sw.group);
      });
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
    if (s.flags.motelWingPowered) this.setGroupPowered('B', true);
    // reaching findFuse or later means the diner circuit was already powered —
    // restore the group-A staircase so a Continue doesn't leave the route dark
    if (['findFuse', 'routeCircuit', 'climbWing', 'bossFight', 'collectFragment', 'complete'].includes(s.questStep)) {
      this.setGroupPowered('A', true);
    }
    if (s.flags.motelBadgeCollected && this.badge) { this.badge.destroy(); this.badge = undefined; }
    if (s.signalSets.chip?.relic && this.relic) { this.relic.destroy(); this.relic = undefined; }
    if (s.flags.motelBossDefeated && !s.flags.motelFragmentCollected) this.spawnFragment();
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
    updateSave((s) => {
      if (!s.earnedPortraits.includes(scoutId)) s.earnedPortraits.push(scoutId);
    });
    ScoutEcho.summon(this, this.player.x, this.player.y - 8, scoutId, skin.color, this.fx, `${skin.scoutName.toUpperCase()} / ${skin.name}`);
    this.time.delayedCall(700, () => {
      bus.emit(EVT.scoutLog, {
        title: `SIGNAL SET COMPLETE — ${skin.name} UNLOCKED`,
        body: `${skin.scoutName}’s echo hands you their signal.\n\n"${skin.fantasy}"\n\nEquip ${skin.name} in the Command Center ▸ WARDROBE. ${skin.passive}`,
        accent: 'chip',
      });
    });
  }

  /* --------------------------------- gameplay -------------------------------- */

  /** ambience only (Rayman beat hook): lit neon pulses on the musical downbeat */
  private onBeat(b: { step: number }): void {
    if (b.step % 8 === 0) {
      // downbeat: lit neon pulses
      for (const n of this.neon) {
        if (!this.powered[n.group]) continue;
        this.tweens.add({ targets: n.glow, alpha: { from: Math.min(1, n.glow.alpha + 0.35), to: n.glow.alpha }, duration: 140 });
      }
    }
    if (b.step % 8 === 4) {
      // off-beat: security lamps flare
      for (const l of this.lamps) l.cone.pulseVisible(160);
    }
  }

  update(_t: number, delta: number): void {
    this.input2.update();
    if (this.input2.pauseJustDown && !this.isPaused && !uiOverlayActive() && !this.gameOverShown) this.setPaused(true);
    if (this.isPaused || this.gameOverShown) return;
    const dtSec = delta / 1000;
    const now = this.time.now;

    this.player.updatePlayer(this.input2);
    this.updateCameraLook(dtSec);
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

    // scanning
    if (this.input2.scanJustDown && this.player.canScan() && this.player.alive) this.doScan();

    // jack into the fuse box
    if (
      this.input2.interactJustDown &&
      !this.fuseUsed &&
      quests.isAtOrPast('findFuse') &&
      !getSave().flags.motelWingPowered &&
      Math.abs(this.player.x - this.fuseBoxPos.x) < 18 &&
      Math.abs(this.player.y - this.fuseBoxPos.y) < 26
    ) {
      this.enterCircuit(false);
    }

    // security-light detection
    let inCone = false;
    for (const l of this.lamps) {
      l.cone.setAngle(Math.PI / 2 + Phaser.Math.DegToRad(MOTEL.securitySweepDeg / 2) * Math.sin(now / MOTEL.securitySweepPeriodMs * Math.PI * 2));
      if (l.cone.update(this.player.x, this.player.y)) inCone = true;
    }
    this.classify.update(dtSec, inCone && this.player.alive && !this.player.isDashing, this.player.isEchoActive ? 0.5 : 1);
    // security lights have teeth: linger in the cones → the Engine FLAGS you →
    // take a hit + knockback, then it resets (dash i-frames slip the beams)
    if (this.classify.isThreat && this.player.alive && !this.player.invulnerable) {
      bus.emit(EVT.toast, { text: 'SECURITY FLAG — SPOTTED', color: 'orange' });
      this.fx.flash(P.danger, 120);
      this.hurtPlayer(1, this.player.x + (this.player.facing > 0 ? -6 : 6));
      this.classify.reset();
    }

    // SPARK machine-recharge near the fuse box / signal box
    if (skinAbilities().machineRecharge && Math.abs(this.player.x - this.fuseBoxPos.x) < 26) {
      this.player.energy = Math.min(this.player.effEnergyMax, this.player.energy + 40 * dtSec);
    }

    this.boss?.update(dtSec);
    // clear in-flight neon letters the instant the boss starts dying (so a
    // corpse can't still tag you during its death cascade)
    if (this.boss?.state === 'dying' && !this.bossDeathHandled) {
      this.bossDeathHandled = true;
      (this.enemyBolts.getChildren() as Projectile[]).forEach((b) => b.active && b.kill());
    }
    this.updateQuestTriggers();

    // pit fall
    if (this.player.y > MOTEL_NOWHERE.meta.heightPx + FALL_DAMAGE_Y_PAD && this.player.alive) {
      this.hurtPlayer(1, this.player.x + 1);
      if (this.player.alive) {
        this.player.setPosition(this.lastSafe.x, this.lastSafe.y - 6);
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
    }

    this.checkPickups();

    // once the loop is broken, walking off the east edge takes the road to
    // Chagrin Falls High (guarded so it can never fire mid-zone)
    if (!this.travelling && getSave().flags.motelFragmentCollected && this.player.x > 92 * TILE) {
      this.travelToStadium();
    }

    if (now > this.statFlushAt) { this.statFlushAt = now + 15000; this.flushTime(); }
    this.pushDebug();
  }

  private travelToStadium(): void {
    this.travelling = true;
    this.flushTime();
    updateSave((s) => {
      s.currentZone = 'tiger-stadium';
      s.currentQuest = 'friday-night-lights';
      s.questStep = 'arrive';
      s.completedQuestSteps = [];
      if (!s.completedZones.includes('motel-nowhere')) s.completedZones.push('motel-nowhere');
    });
    quests.load('friday-night-lights');
    quests.restart();
    audio.transitionWarp();
    this.cameras.main.fadeOut(500, 6, 3, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.stadium);
    });
  }

  /** shared horizontal camera lookahead — Motel keeps its level vertical framing (offsetY 0) */
  private updateCameraLook(dtSec: number): void {
    const vx = (this.player.body as Phaser.Physics.Arcade.Body).velocity.x;
    this.camLookX = applyCameraLook(this.cameras.main, this.camLookX, this.player.facing, vx, dtSec, 0);
  }

  private updateParallax(dtSec: number): void {
    const sx = this.cameras.main.scrollX;
    this.rainDrift += dtSec * 2;
    this.stars.tilePositionX = sx * 0.05;
    this.hills.tilePositionX = sx * 0.28;
    this.fog.tilePositionX = sx * 0.5 + this.rainDrift * 4;
  }

  private updateQuestTriggers(): void {
    const zones = MOTEL_NOWHERE.meta.zones;
    const x = this.player.x;
    const step = quests.stepId;
    if (step === 'arrive' && Math.abs(x - this.spawnPoint.x) > 56) quests.complete('arrive');
    if (step === 'crossLot' && x > zones.crossLot.x1 + TILE) quests.complete('crossLot');
    // powerDiner completes when circuit A is lit (handled in toggleGroup)
    if (step === 'climbWing' && this.powered.B && x >= zones.bossTrigger.x0 && !this.boss) {
      quests.complete('climbWing');
      this.spawnBoss();
    }
  }

  private doScan(): void {
    this.player.markScan();
    audio.scanPulse();
    this.fx.scanRing(this.player.x, this.player.y, this.player.scanRadius, SCAN.durationMs);
    this.bumpStat('scansUsed');
    const px = this.player.x;
    const py = this.player.y;
    // scan pings dark neon platforms so you can read the route before powering it
    for (const n of this.neon) {
      if (!this.powered[n.group] && Phaser.Math.Distance.Between(px, py, n.img.x, n.img.y) <= this.player.scanRadius) {
        n.ghost.setAlpha(0.85);
        this.tweens.add({ targets: n.ghost, alpha: 0.4, duration: 900 });
      }
    }
    if (this.boss?.alive && Phaser.Math.Distance.Between(px, py, this.boss.core.x, this.boss.core.y) < this.player.scanRadius + 30) {
      this.boss.onScanned();
    }

    // scan-secrets: hidden field notes & shard caches revealed near the pulse
    for (const id of resolveScanSecrets('motel-nowhere', px, py, this.player.scanRadius, this.fx))
      retireSecretCue(this, this.secretCues, id);
  }

  private checkPickups(): void {
    const near = (o: { x: number; y: number }, r: number) => Phaser.Math.Distance.Between(this.player.x, this.player.y, o.x, o.y) < r;
    // Chip's SPARK badge (grants badge + log pieces; safe if already earned in Miller Field)
    if (this.badge && !this.badge.collected && near(this.badge, 14)) {
      this.badge.collect();
      audio.badgePickup();
      this.fx.flash(P.scoutChip, 120);
      this.fx.explode(this.badge.x, this.badge.y, P.scoutChip, 14);
      const log = logById('chip-box-1');
      updateSave((s) => {
        s.flags.motelBadgeCollected = true;
        if (!s.discoveredScoutBadges.includes('chip')) s.discoveredScoutBadges.push('chip');
        if (log && !s.discoveredScoutLogs.includes('chip-box-1')) s.discoveredScoutLogs.push('chip-box-1');
      });
      recordSetPiece('chip', 'badge');
      recordSetPiece('chip', 'log');
      if (log) bus.emit(EVT.scoutLog, { title: log.title, body: log.body, accent: 'chip' });
      bus.emit(EVT.toast, { text: 'SCOUT BADGE — CHIP / SPARK (2/5)', color: 'orange' });
      this.badge = undefined;
      this.checkSetComplete('chip');
    }
    // Chip's Power Cell relic
    if (this.relic && !this.relic.collected && near(this.relic, 15)) {
      this.relic.collect();
      audio.badgePickup();
      this.fx.flash(P.scoutChip, 120);
      this.fx.explode(this.relic.x, this.relic.y, P.scoutChip, 14);
      recordSetPiece('chip', 'relic');
      bus.emit(EVT.toast, { text: 'RELIC RECOVERED — POWER CELL', color: 'green' });
      this.relic = undefined;
      this.checkSetComplete('chip');
    }
    // Signal Fragment #2
    if (this.fragment && !this.fragment.collected) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.fragment.x, this.fragment.y);
      if (d < 64) this.fragment.magnetTo(this.player.x, this.player.y, this.game.loop.delta / 1000);
      if (d < 16) this.collectFragment();
    }
  }

  /* ------------------------------ circuit / wing ----------------------------- */

  enterCircuit(viaDebug: boolean): void {
    if (this.isPaused || this.fuseUsed) return;
    this.fuseUsed = true;
    if (quests.stepId === 'findFuse' && !viaDebug) quests.complete('findFuse');
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.flushTime();
    // jack into the fuse box → the Fold flips to the TOP-DOWN circuit (Z2 hybrid
    // beat). Reaching the breach reports nodeJustSolved and wakes us to power the wing.
    this.registry.set('sweepArenaId', 'circuit-z2');
    this.registry.set('nodeJustSolved', false);
    foldCollapse(this, this.fx, () => {
      this.scene.switch(SCENES.sweep);
    });
  }

  private onWake(): void {
    this.input.enabled = true; // the Fold (enterCircuit) disabled input — restore on return
    audio.playMusic('motel'); // restore motel music after the circuit
    bus.emit(EVT.sceneChanged, { scene: SCENES.motel, zone: 'Motel Nowhere' });
    quests.emitObjective();
    this.player.refreshHud();
    this.fx.staticBurst(300);
    if (this.registry.get('nodeJustSolved') === true) {
      this.registry.set('nodeJustSolved', false);
      this.applyWingPowered();
    } else {
      this.fuseUsed = false; // bailed out — let them try again
    }
  }

  /** Chip's circuit routed — the dead wing wakes up in a cascade of light */
  applyWingPowered(): void {
    updateSave((s) => { s.flags.motelWingPowered = true; });
    if (quests.stepId === 'routeCircuit') quests.complete('routeCircuit');
    this.setGroupPowered('B', true, true);
    audio.doorUnlock();
    this.fx.flash(P.neonAmber, 200);
    this.fx.shake(0.004, 250);
    bus.emit(EVT.toast, { text: 'THE WING WAKES UP — A STAIRCASE OF LIGHT', color: 'orange' });
  }

  /* --------------------------------- boss ------------------------------------ */

  spawnBoss(): void {
    const arena = MOTEL_NOWHERE.meta.arena;
    const floorY = arena.surfaceY; // top walkway surface (from level meta)
    this.boss = new VacancySignBoss(this, arena.centerX, floorY, arena.leftPx, arena.rightPx, {
      fx: this.fx,
      fireLetter: (x, y, vx, vy) => {
        const b = fireFrom(this.enemyBolts, x, y, vx, vy, 4200);
        if (b) { b.setTexture(TEX.vsLetter); b.setTint(0xffffff); }
      },
      damagePlayer: (amount, fromX) => this.hurtPlayer(amount, fromX),
      getPlayer: () => ({ x: this.player.x, y: this.player.y, alive: this.player.alive }),
      onDefeated: () => this.onBossDefeated(),
    });

    for (const wx of [arena.leftPx, arena.rightPx]) {
      const wall = this.physics.add.staticImage(wx, 4 * TILE, TEX.px).setVisible(false);
      (wall.body as Phaser.Physics.Arcade.StaticBody).setSize(8, 130);
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
      s.flags.motelBossDefeated = true;
      s.playerStats.enemiesDefeated += 1;
    });
    if (quests.stepId === 'bossFight') quests.complete('bossFight');
    this.spawnFragment();
    bus.emit(EVT.toast, { text: 'THE SIGN GOES DARK — VACANCY CLEARED', color: 'green' });
  }

  spawnFragment(): void {
    const arena = MOTEL_NOWHERE.meta.arena;
    this.fragment = new Collectible(this, arena.centerX, 6 * TILE, 'fragment', false);
  }

  /* ------------------------------- TestAPI hooks ----------------------------- */

  /** Test/debug: live neon-circuit + detection state */
  get debugState(): { circuits: Record<Circuit, boolean>; classify: number; wingPowered: boolean } {
    return { circuits: { ...this.powered }, classify: Math.round(this.classify.value), wingPowered: getSave().flags.motelWingPowered };
  }

  apiCompleteSet(scoutId: string): void {
    recordSetPiece(scoutId, 'badge');
    recordSetPiece(scoutId, 'log');
    recordSetPiece(scoutId, 'relic');
    this.checkSetComplete(scoutId);
  }
  apiCollectFragment(): void {
    if (getSave().flags.motelFragmentCollected) return;
    if (!this.fragment) this.spawnFragment();
    this.collectFragment();
  }

  private collectFragment(): void {
    if (!this.fragment) return;
    this.fragment.collect();
    this.fragment = undefined;
    audio.fragmentPickup();
    this.fx.flash(P.neonAmber, 220);
    this.fx.shake(0.004, 200);
    updateSave((s) => {
      s.signalFragments = Math.max(2, s.signalFragments + 1);
      s.flags.motelFragmentCollected = true;
      if (!s.completedZones.includes('motel-nowhere')) s.completedZones.push('motel-nowhere');
    });
    const ability = progression.grantZoneSignature('motel-nowhere');
    bus.emit(EVT.fragmentCount, { count: getSave().signalFragments });
    if (quests.stepId === 'collectFragment') quests.complete('collectFragment');
    bus.emit(EVT.scoutLog, {
      title: 'SIGNAL FRAGMENT SECURED — 2 / ?',
      body:
        'The VACANCY sign finally clears. The loop lets go; somewhere a clock starts again.\n\n' +
        'Fragment archived. Chip’s file is no longer UNKNOWN — SPARK’s signal is yours.' +
        (ability ? `\n\n◆ ABILITY UNLOCKED — ${ability.name}\n${ability.description}` : '') +
        '\n\nDirective unchanged: stay unknown.',
      accent: 'chip',
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
      this.scene.launch(SCENES.gameOver, { from: SCENES.motel });
      this.scene.pause();
    });
  }

  private showHowToPlay(): void {
    bus.emit(EVT.tutorial, {
      title: 'MOTEL NOWHERE — NIGHT SHIFT',
      accent: 'chip',
      html: `
        <p class="tut-lead">The neon never agrees with the clock here. <b>Only LIT signs are solid</b> — the neon <b>is</b> the level.</p>
        <div class="tut-hero">
          <div class="tut-hero-key">POWER<span>SHOOT&nbsp;THE&nbsp;SWITCH</span></div>
          <div class="tut-hero-desc"><b>Pulse a power switch</b> to flip a circuit — dark signs snap into solid platforms. Jack into Chip’s <b>fuse box [E]</b> to wake the dead wing.</div>
        </div>
        <table class="tut-controls">
          <tr><td class="tut-k">RIGHT CLICK · Q</td><td>Sonar — read a dark route</td></tr>
          <tr><td class="tut-k">X · LEFT CLICK</td><td>Pulse / trip switches</td></tr>
          <tr><td class="tut-k">SPACE</td><td>Jump — hold to hover</td></tr>
          <tr><td class="tut-k">E</td><td>Jack into the fuse box</td></tr>
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
      scene: 'MotelScene',
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      quest: quests.stepId,
      playerBolts: this.playerBolts.countActive(true),
      classify: `${Math.round(this.classify.value)} ${this.classify.tier}`,
      energy: Math.round(this.player.energy),
      hp: this.player.hp,
      circuits: `A:${this.powered.A ? 1 : 0} B:${this.powered.B ? 1 : 0} C:${this.powered.C ? 1 : 0}`,
      boss: this.boss ? `${this.boss.state} ${this.boss.hp}hp` : '—',
    });
  }

  private onShutdown(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.lamps.forEach((l) => l.cone.destroy());
    this.boss?.destroy();
    unregisterScene('motel');
  }
}
