/**
 * SKYLINE ARRAY — Zone 5 overworld == THE FINALE ("The Broadcast" merged in).
 * A mostly-VERTICAL storm-surf ascent: dash-chain UP antenna spires on rising
 * updrafts, dodge a telegraphed lightning clock, dash through ROCKET gates —
 * the storm sea a mile below is the fail state. Skins are FREQUENCY KEYS (this
 * pass wires the climb spine; the five frequency beats, first-person summit,
 * mirror boss and ending land in later phases).
 */
import Phaser from 'phaser';
import {
  DRONE,
  EVT,
  PALETTE as P,
  PROGRESSION,
  PULSE,
  RENDER_ZOOM,
  SCENES,
  SKYCAM,
  LIGHTNING,
  UPDRAFT,
  DASHGATE,
  FREQSWAP,
  TEX,
  TILE,
  VIEW_H,
  VIEW_W,
} from '../config';
import { logById } from '../data/scouts';
import { SKYLINE_ARRAY, walkLevel } from '../data/levels';
import { skinById, skinByScout } from '../data/skins';
import { Collectible } from '../entities/Collectible';
import { ListeningStationBoss } from '../entities/ListeningStationBoss';
import { Player } from '../entities/Player';
import { Projectile, fireFrom, makeProjectileGroup } from '../entities/Projectile';
import { ScoutEcho } from '../entities/ScoutEcho';
import { audio } from '../systems/AudioSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { bus } from '../systems/EventBus';
import { PlayerInput } from '../systems/InputSystem';
import { progression } from '../systems/ProgressionSystem';
import { quests } from '../systems/QuestSystem';
import { addShards, getSave, grantAbility, recordSetPiece, setProgress, unlockSkin, updateSave } from '../systems/SaveSystem';
import { activeSkin } from '../systems/SkinState';
import { registerScene, unregisterScene } from '../systems/TestAPI';
import { uiOverlayActive } from '../systems/UIState';

// tile colours (hardcoded so the skeleton needs no new procedural textures yet)
const C_WALL = 0x4a5360;
const C_CATWALK = 0x7c8796;
const C_WIND = 0x8fff6a;
const C_WARN = 0xffb03b;
const C_BOLT = 0xf2ffd0;
const C_GATE = 0xff4b5c;
const C_SEA = 0x16324f;
const C_EXIT = 0x7cfc9b;

type Phase = 'idle' | 'warn' | 'active' | 'cooldown';
interface Strike {
  x: number;
  y0: number;
  y1: number;
  phaseOffset: number;
  warn: Phaser.GameObjects.Rectangle;
  bolt: Phaser.GameObjects.Rectangle;
}
interface Cell { col: number; row: number; }
interface Run { col: number; r0: number; r1: number; }

export class SkylineArrayScene extends Phaser.Scene {
  player!: Player;
  private input2!: PlayerInput;
  fx!: EffectsSystem;

  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private catwalks!: Phaser.Physics.Arcade.StaticGroup;
  playerBolts!: Phaser.Physics.Arcade.Group;
  enemyBolts!: Phaser.Physics.Arcade.Group;

  private updrafts: Phaser.Geom.Rectangle[] = [];
  private strikes: Strike[] = [];
  private dashGates: Phaser.Geom.Rectangle[] = [];

  private lastSafe = { x: 0, y: 0 };
  private stormSeaY = 0;
  private camLookY = 0;
  private bossPos = { x: 0, y: 0 };
  private summitStarted = false;
  private bossDeathHandled = false;
  private arenaWalls: Phaser.Physics.Arcade.Image[] = [];
  private freqDial: Phaser.GameObjects.Arc[] = [];
  private badge?: Collectible; // Danny / ROCKET scout badge (+ log)
  private relic?: Collectible; // Danny's relic — the Cracked Goggles
  private shardCache?: Collectible; // Signal Shard salvage cache
  boss?: ListeningStationBoss;

  private isPaused = false;
  private gameOverShown = false;
  private sessionStart = 0;
  private statFlushAt = 0;
  private unsubs: Array<() => void> = [];

  constructor() {
    super(SCENES.skyline);
  }

  create(): void {
    const def = SKYLINE_ARRAY;
    this.fx = new EffectsSystem(this);
    this.input2 = new PlayerInput(this);
    this.isPaused = false;
    this.gameOverShown = false;
    this.sessionStart = this.time.now;
    this.updrafts = [];
    this.strikes = [];
    this.dashGates = [];
    this.freqDial = [];
    this.arenaWalls = [];
    this.summitStarted = false;
    this.bossDeathHandled = false;
    this.boss = undefined;
    this.camLookY = 0;
    // the lethal storm sea sits just below the launch deck (bottom of the grid)
    this.stormSeaY = def.meta.heightPx - 8 * TILE;

    this.cameras.main.setBackgroundColor(0x0a0e1a);
    this.buildParallax();
    this.buildWorld();

    this.playerBolts = makeProjectileGroup(this, TEX.boltPlayer, PULSE.maxActive);
    this.enemyBolts = makeProjectileGroup(this, TEX.boltEnemy, DRONE.maxBolts + 20);

    this.physics.world.setBounds(0, -VIEW_H, def.meta.widthPx, def.meta.heightPx + VIEW_H);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.cameras.main.setZoom(RENDER_ZOOM);
    this.cameras.main.setBounds(0, 0, def.meta.widthPx, def.meta.heightPx);
    this.cameras.main.startFollow(this.player, true, SKYCAM.followLerpX, SKYCAM.followLerpY);
    this.cameras.main.setDeadzone(SKYCAM.deadzoneW, SKYCAM.deadzoneH);
    this.cameras.main.setFollowOffset(0, SKYCAM.baseOffsetY);
    this.cameras.main.fadeIn(500, 6, 3, 12);

    this.wireCollisions();

    if (!this.scene.isActive(SCENES.ui)) this.scene.launch(SCENES.ui);

    quests.load('the-sky-listens');
    quests.init();
    this.player.refreshHud();
    audio.playMusic('field');
    bus.emit(EVT.fragmentCount, { count: getSave().signalFragments });
    bus.emit(EVT.sceneChanged, { scene: SCENES.skyline, zone: 'Skyline Array' });

    this.time.delayedCall(650, () => this.showHowToPlay());

    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.unsubs.push(bus.on(EVT.uiResume, () => this.setPaused(false)));
    this.unsubs.push(bus.on(EVT.skinSelected, (d) => this.applySkinLive((d as { id: string }).id)));

    // the finale LENDS you every Scout frequency for APPEARANCE ONLY — swap on the
    // fly with keys 1-5. Permanent ownership of each skin is still earned by
    // completing that Scout's Signal Set (badge + log + relic), not handed out here.
    (['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'] as const).forEach((k, i) => {
      this.input.keyboard?.on(`keydown-${k}`, () => this.swapFreq(i));
    });
    this.buildDial();

    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    registerScene('skyline', this);
  }

  /* ------------------------------- construction ------------------------------ */

  private buildParallax(): void {
    const def = SKYLINE_ARRAY;
    // distant storm-tower silhouettes + a stormy wash (cheap procedural depth)
    for (let i = 0; i < 5; i++) {
      const x = (i + 0.5) * (def.meta.widthPx / 5);
      this.add
        .rectangle(x, def.meta.heightPx, 26, def.meta.heightPx, 0x0e1424, 0.6)
        .setOrigin(0.5, 1)
        .setScrollFactor(0.3)
        .setDepth(0);
    }
  }

  private buildWorld(): void {
    const def = SKYLINE_ARRAY;
    this.solids = this.physics.add.staticGroup();
    this.catwalks = this.physics.add.staticGroup();
    const updraftCells: Cell[] = [];
    const strikeCells: Cell[] = [];

    walkLevel(def, (ch, col, row, x, y) => {
      switch (ch) {
        case '#':
          this.addSolid(x, y);
          break;
        case '=':
          this.addCatwalk(x, y);
          break;
        case '^':
          updraftCells.push({ col, row });
          break;
        case '*':
          strikeCells.push({ col, row });
          break;
        case 'R': {
          this.dashGates.push(new Phaser.Geom.Rectangle(x - 8, y - 8, 16, 16));
          this.add.rectangle(x, y, 12, 16, C_GATE, 0.55).setDepth(6);
          break;
        }
        case 'S':
          this.add.rectangle(x, y, 16, 10, C_SEA, 0.5).setDepth(1);
          break;
        case 'P':
          this.lastSafe = { x, y: y - 4 };
          this.player = new Player(this, x, y - 2, this.fx);
          this.player.setSkin(getSave().selectedSkin);
          break;
        case 'V':
          this.bossPos = { x, y };
          break;
        case 'X':
          this.add.rectangle(x, y - 4, 14, 20, C_EXIT, 0.7).setDepth(6);
          break;
        case 'b':
          if (!getSave().flags.dannyBadgeCollected) this.badge = new Collectible(this, x, y, 'badge-danny', false, P.scoutDanny);
          break;
        case 'K':
          if (!getSave().flags.crackedGogglesCollected) this.relic = new Collectible(this, x, y, 'relic-danny', false, P.scoutDanny);
          break;
        case 'k':
          if (!getSave().foundSecrets.includes('skyline-array-cache')) this.shardCache = new Collectible(this, x, y, 'cache', false, P.warning);
          break;
        default:
          break;
      }
    });

    // merge '^' cells into vertical shaft runs -> lift rects + one wind visual each
    for (const run of this.mergeRuns(updraftCells)) {
      const x = run.col * TILE + TILE / 2;
      const yTop = run.r0 * TILE;
      const h = (run.r1 - run.r0 + 1) * TILE;
      this.updrafts.push(new Phaser.Geom.Rectangle(x - 8, yTop, 16, h));
      this.add
        .rectangle(x, yTop, 12, h, C_WIND, 0.12)
        .setOrigin(0.5, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(2);
    }

    // merge '*' cells into strike columns -> telegraphed hazard state machines
    this.mergeRuns(strikeCells).forEach((run, i) => {
      const x = run.col * TILE + TILE / 2;
      const yTop = run.r0 * TILE;
      const h = (run.r1 - run.r0 + 1) * TILE;
      const warn = this.add.rectangle(x, yTop, 3, h, C_WARN, 0.85).setOrigin(0.5, 0).setDepth(7).setVisible(false);
      const bolt = this.add
        .rectangle(x, yTop, 6, h, C_BOLT, 0.95)
        .setOrigin(0.5, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(8)
        .setVisible(false);
      this.strikes.push({ x, y0: yTop, y1: yTop + h, phaseOffset: i * LIGHTNING.phaseStepMs, warn, bolt });
    });
  }

  /** group same-column cells into contiguous vertical runs */
  private mergeRuns(cells: Cell[]): Run[] {
    const byCol = new Map<number, number[]>();
    for (const c of cells) {
      const arr = byCol.get(c.col) ?? [];
      arr.push(c.row);
      byCol.set(c.col, arr);
    }
    const runs: Run[] = [];
    for (const [col, rows] of byCol) {
      rows.sort((a, b) => a - b);
      let r0 = rows[0];
      let prev = rows[0];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i] === prev + 1) {
          prev = rows[i];
        } else {
          runs.push({ col, r0, r1: prev });
          r0 = rows[i];
          prev = rows[i];
        }
      }
      runs.push({ col, r0, r1: prev });
    }
    return runs;
  }

  private addSolid(x: number, y: number): void {
    const r = this.add.rectangle(x, y, 16, 16, C_WALL).setDepth(4);
    this.solids.add(r);
  }

  private addCatwalk(x: number, y: number): void {
    // a thin one-way top platform: pass UP through it, land on top
    const r = this.add.rectangle(x, y - 5, 16, 5, C_CATWALK).setDepth(5);
    this.catwalks.add(r);
  }

  private wireCollisions(): void {
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(
      this.player,
      this.catwalks,
      undefined,
      (playerObj, plat) => {
        const pb = (playerObj as Player).body as Phaser.Physics.Arcade.Body;
        const tb = (plat as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.StaticBody;
        // only solid when the player is descending onto the top face
        return pb.velocity.y >= 0 && pb.bottom <= tb.top + 6;
      },
      this,
    );
    this.physics.add.collider(this.playerBolts, this.solids, (bolt) => (bolt as Projectile).kill());
    this.physics.add.collider(this.enemyBolts, this.solids, (bolt) => (bolt as Projectile).kill());
    this.physics.add.overlap(this.enemyBolts, this.player, (_pl, bolt) => {
      const b = bolt as Projectile;
      if (!b.active || this.player.invulnerable) return;
      b.kill();
      this.hurtPlayer(1, b.x);
    });
  }

  private applySkinLive(id: string): void {
    if (!this.player?.active || activeSkin().id === id) return;
    this.player.setSkin(id);
  }

  /* ------------------------ Danny / ROCKET Signal Set ------------------------ */

  private checkPickups(): void {
    if (!this.player?.alive) return;
    const near = (o: { x: number; y: number }, r: number) =>
      Phaser.Math.Distance.Between(this.player.x, this.player.y, o.x, o.y) < r;

    // Danny / ROCKET badge (grants badge + log pieces)
    if (this.badge && !this.badge.collected && near(this.badge, 14)) {
      this.badge.collect();
      audio.badgePickup();
      this.fx.flash(P.scoutDanny, 120);
      this.fx.explode(this.badge.x, this.badge.y, P.scoutDanny, 14);
      const log = logById('danny-log-1');
      updateSave((s) => {
        s.flags.dannyBadgeCollected = true;
        if (!s.discoveredScoutBadges.includes('danny')) s.discoveredScoutBadges.push('danny');
        if (log && !s.discoveredScoutLogs.includes('danny-log-1')) s.discoveredScoutLogs.push('danny-log-1');
      });
      recordSetPiece('danny', 'badge');
      recordSetPiece('danny', 'log');
      if (log) bus.emit(EVT.scoutLog, { title: log.title, body: log.body, accent: 'danny' });
      bus.emit(EVT.toast, { text: 'SCOUT BADGE — DANNY / ROCKET (5/5)', color: 'green' });
      this.badge = undefined;
      this.checkSetComplete('danny');
    }
    // the Cracked Goggles relic
    if (this.relic && !this.relic.collected && near(this.relic, 15)) {
      this.relic.collect();
      audio.badgePickup();
      this.fx.flash(P.scoutDanny, 120);
      this.fx.explode(this.relic.x, this.relic.y, P.scoutDanny, 14);
      updateSave((s) => { s.flags.crackedGogglesCollected = true; });
      recordSetPiece('danny', 'relic');
      bus.emit(EVT.toast, { text: 'RELIC RECOVERED — THE CRACKED GOGGLES', color: 'green' });
      this.relic = undefined;
      this.checkSetComplete('danny');
    }
    // Signal Shard salvage cache
    if (this.shardCache && !this.shardCache.collected && near(this.shardCache, 15)) {
      this.shardCache.collect();
      audio.badgePickup();
      this.fx.flash(P.warning, 120);
      const bal = addShards(PROGRESSION.shardsPerCache);
      updateSave((s) => {
        if (!s.foundSecrets.includes('skyline-array-cache')) s.foundSecrets.push('skyline-array-cache');
      });
      bus.emit(EVT.toast, { text: `SALVAGE CACHE — +${PROGRESSION.shardsPerCache} SHARDS (${bal})`, color: 'orange' });
      this.shardCache = undefined;
    }
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
        accent: 'danny',
      });
    });
  }

  /* ------------------------------ frequency swap ----------------------------- */

  private swapFreq(i: number): void {
    const id = FREQSWAP.order[i];
    if (!id || activeSkin().id === id || !this.player?.alive) return;
    // appearance-only lend: change the live skin without persisting ownership.
    this.player.setSkin(id);
    const sk = skinById(id);
    bus.emit(EVT.skinSelected, { id: sk.id, name: sk.name, color: sk.color, live: true });
    this.updateDial();
  }

  private buildDial(): void {
    const cx = VIEW_W / 2 - (FREQSWAP.order.length - 1) * 7;
    FREQSWAP.order.forEach((id, i) => {
      const dot = this.add
        .circle(cx + i * 14, 10, 4, skinById(id).color, 0.85)
        .setScrollFactor(0)
        .setDepth(40)
        .setStrokeStyle(1, 0x0a0e1a, 0.9);
      this.freqDial.push(dot);
    });
    this.updateDial();
  }

  private updateDial(): void {
    const active = activeSkin().id;
    this.freqDial.forEach((dot, i) => {
      const on = FREQSWAP.order[i] === active;
      dot.setRadius(on ? 5.5 : 3.5).setFillStyle(skinById(FREQSWAP.order[i]).color, on ? 1 : 0.5);
    });
  }

  /* --------------------------------- the summit ------------------------------ */

  private beginSummit(): void {
    this.summitStarted = true;
    const arena = SKYLINE_ARRAY.meta.arena;
    bus.emit(EVT.toast, { text: 'THE FIVE ECHOES GATHER — THE SKY IS LISTENING', color: 'green' });
    this.fx.flash(P.signal, 160);
    FREQSWAP.order.forEach((id, i) => {
      const ex = arena.leftPx + ((arena.rightPx - arena.leftPx) * (i + 0.5)) / FREQSWAP.order.length;
      this.time.delayedCall(i * 260, () => ScoutEcho.summon(this, ex, arena.surfaceY - TILE, id, skinById(id).color, this.fx));
    });
    this.time.delayedCall(1900, () => this.spawnBoss());
  }

  /* ---------------------------------- the boss ------------------------------- */

  spawnBoss(): void {
    if (this.boss || getSave().flags.listeningStationDefeated) return;
    const arena = SKYLINE_ARRAY.meta.arena;
    const bx = this.bossPos.x || arena.centerX;
    this.boss = new ListeningStationBoss(this, bx, arena.surfaceY, {
      fx: this.fx,
      damagePlayer: (amount, fromX) => this.hurtPlayer(amount, fromX),
      getPlayer: () => ({ x: this.player.x, y: this.player.y, alive: this.player.alive }),
      onDefeated: () => this.onBossDefeated(),
    });
    // seal the arena so the fight can't dump you off the summit
    for (const wx of [arena.leftPx, arena.rightPx]) {
      const wall = this.physics.add.staticImage(wx, arena.surfaceY - 3 * TILE, TEX.px).setVisible(false);
      (wall.body as Phaser.Physics.Arcade.StaticBody).setSize(8, 140);
      this.physics.add.collider(this.player, wall);
      this.arenaWalls.push(wall as unknown as Phaser.Physics.Arcade.Image);
    }
    this.physics.add.overlap(this.playerBolts, this.boss.core, (_c, bolt) => {
      const b = bolt as Projectile;
      if (!b.active || !this.boss?.exposed) return;
      b.kill();
      this.boss.hitCore(1);
    });
    this.summitStarted = true;
    this.boss.spawn();
  }

  private onBossDefeated(): void {
    this.arenaWalls.forEach((w) => w.destroy());
    this.arenaWalls = [];
    const ability = progression.grantZoneSignature('skyline-array');
    updateSave((s) => {
      s.flags.listeningStationDefeated = true;
      s.playerStats.enemiesDefeated += 1;
    });
    bus.emit(EVT.toast, { text: 'THE LISTENING STATION GOES QUIET', color: 'green' });
    this.time.delayedCall(900, () => this.collectFragment(ability !== null));
  }

  private collectFragment(ability: boolean): void {
    if (!getSave().flags.skylineFragmentCollected) {
      audio.fragmentPickup();
      this.fx.flash(P.signal, 240);
      this.fx.shake(0.005, 220);
      updateSave((s) => {
        s.signalFragments = Math.max(5, s.signalFragments + 1);
        s.flags.skylineFragmentCollected = true;
        if (!s.completedZones.includes('skyline-array')) s.completedZones.push('skyline-array');
      });
      bus.emit(EVT.fragmentCount, { count: getSave().signalFragments });
      bus.emit(EVT.scoutLog, {
        title: 'FINAL SIGNAL FRAGMENT SECURED — 5 / 5',
        body:
          'The eye closes. The rumor that wore your face lets go, and the sky is just the sky again.\n\n' +
          'Every Scout is home.' +
          (ability ? '\n\n◆ ABILITY UNLOCKED — Refuse the Label\nReject whatever the Engine decided you are.' : '') +
          '\n\nOne question left — and it is yours to answer.',
        accent: 'chip',
      });
    }
    this.time.delayedCall(1400, () => this.openEnding());
  }

  private openEnding(): void {
    if (!this.scene.isActive(SCENES.ending)) {
      this.scene.launch(SCENES.ending);
      this.scene.pause();
    }
  }

  // ---- Test-API surface (parity with the other overworld scenes) ----
  apiCompleteSet(_scoutId: string): void { /* Danny's ROCKET set is a later-phase polish item */ }
  apiCollectFragment(): void {
    grantAbility('refuse-label');
    updateSave((s) => {
      s.signalFragments = Math.max(5, s.signalFragments + 1);
      s.flags.skylineFragmentCollected = true;
      s.flags.listeningStationDefeated = true;
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
    this.checkPickups();

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down && this.player.alive) this.lastSafe = { x: this.player.x, y: this.player.y - 4 };

    this.applyUpdrafts(dtSec);
    this.updateLightning(now);
    this.checkDashGates();
    this.updateCamera(dtSec);

    // shooting
    if (this.input2.shootDown && this.player.canShoot() && this.player.alive) {
      const aim = this.input2.shotVector(this.player.x, this.player.y - 1, this.player.facing);
      if (Math.abs(aim.x) > 0.25) this.player.facing = aim.x >= 0 ? 1 : -1;
      this.player.markShoot();
      fireFrom(this.playerBolts, this.player.x + aim.x * 8, this.player.y - 1 + aim.y * 4, aim.x * PULSE.speed, aim.y * PULSE.speed, PULSE.lifeMs)?.setTint(
        activeSkin().color,
      );
      audio.pulseShot();
    }
    // scanning — jams the Listening Station's iris (once you've refused its label)
    if (this.input2.scanJustDown && this.player.canScan() && this.player.alive) {
      this.player.markScan();
      this.fx.scanRing(this.player.x, this.player.y, 90, 420, activeSkin().color);
      audio.scanPulse();
      this.boss?.onScanned();
    }

    // reach + STAND ON the summit → the five echoes gather, then the boss wakes
    // (grounded-gated so it can't fire while you're still rising through shaft 2)
    if (
      !this.summitStarted &&
      !getSave().flags.listeningStationDefeated &&
      this.player.y <= SKYLINE_ARRAY.meta.arena.surfaceY + 2 * TILE &&
      (this.player.body as Phaser.Physics.Arcade.Body).blocked.down
    ) {
      this.beginSummit();
    }
    this.boss?.update(dtSec);
    if (this.boss?.state === 'dying' && !this.bossDeathHandled) {
      this.bossDeathHandled = true;
      (this.enemyBolts.getChildren() as Projectile[]).forEach((b) => b.active && b.kill());
    }

    // storm-sea fail — fall below the deck → respawn at the last catwalk, −1 HP
    if (this.player.y > this.stormSeaY && this.player.alive) {
      this.fx.flash(P.danger, 140);
      this.fx.shake(0.006, 220);
      this.hurtPlayer(1, this.player.x);
      if (this.player.alive) {
        this.player.setPosition(this.lastSafe.x, this.lastSafe.y - 6);
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
    }

    if (now > this.statFlushAt) { this.statFlushAt = now + 15000; this.flushTime(); }
  }

  /** ride the rising columns: ease velocity toward an upward target, gravity ON
   *  (so jump/dash still layer on top). Dash keeps its own straight line. */
  private applyUpdrafts(dtSec: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    // grounded → no lift: you rest ON the catwalk that spans the shaft top instead
    // of bobbing forever in the column (also kills the fall→respawn→bob soft-lock).
    if (!this.player.alive || this.player.isDashing || body.blocked.down) return;
    for (const r of this.updrafts) {
      if (r.contains(this.player.x, this.player.y)) {
        if (body.velocity.y > -UPDRAFT.riseSpeed) {
          body.velocity.y = Math.max(body.velocity.y - UPDRAFT.accel * dtSec, -UPDRAFT.riseSpeed);
        }
        // keep you centered in the shaft so the lift delivers you straight up onto
        // the catwalk that spans it (no precise steering required)
        const cx = r.centerX;
        body.velocity.x = Phaser.Math.Linear(body.velocity.x, (cx - this.player.x) * UPDRAFT.centerPull, 0.18);
        break;
      }
    }
  }

  /** telegraphed lightning clock: idle → warn (amber flicker) → active (bolt) → cooldown */
  private updateLightning(now: number): void {
    for (const s of this.strikes) {
      const t = (now + s.phaseOffset) % LIGHTNING.cycleMs;
      let phase: Phase;
      if (t < LIGHTNING.warnMs) phase = 'warn';
      else if (t < LIGHTNING.warnMs + LIGHTNING.activeMs) phase = 'active';
      else if (t < LIGHTNING.warnMs + LIGHTNING.activeMs + LIGHTNING.cooldownMs) phase = 'cooldown';
      else phase = 'idle';

      s.warn.setVisible(phase === 'warn');
      if (phase === 'warn') s.warn.setAlpha(Math.sin(now * 0.05) > 0 ? 0.85 : 0.3);
      s.bolt.setVisible(phase === 'active');

      if (
        phase === 'active' &&
        this.player.alive &&
        !this.player.invulnerable &&
        Math.abs(this.player.x - s.x) < LIGHTNING.hitHalfW &&
        this.player.y > s.y0 &&
        this.player.y < s.y1
      ) {
        audio.hazardZap();
        this.fx.flash(P.danger, 80);
        this.hurtPlayer(LIGHTNING.damage, s.x);
      }
    }
  }

  /** ROCKET dash-gates: a damaging membrane — walk in and it bites (+knockback),
   *  dash through it (invulnerable) and you phase clean. */
  private checkDashGates(): void {
    if (!this.player.alive || this.player.invulnerable) return;
    for (const g of this.dashGates) {
      if (g.contains(this.player.x, this.player.y)) {
        this.hurtPlayer(DASHGATE.damage, g.centerX);
        break;
      }
    }
  }

  /** vertical look-ahead: peek UP while rising fast, DOWN while falling; eased so
   *  a steady updraft never snaps the frame. */
  private updateCamera(_dtSec: number): void {
    const vy = (this.player.body as Phaser.Physics.Arcade.Body).velocity.y;
    const target = Phaser.Math.Clamp(vy * SKYCAM.lookAheadK, SKYCAM.lookUpMax, SKYCAM.lookDownMax);
    this.camLookY = Phaser.Math.Linear(this.camLookY, target, SKYCAM.lookLerp);
    this.cameras.main.setFollowOffset(0, SKYCAM.baseOffsetY + this.camLookY);
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
      this.scene.launch(SCENES.gameOver, { from: SCENES.skyline });
      this.scene.pause();
    });
  }

  private showHowToPlay(): void {
    bus.emit(EVT.tutorial, {
      title: 'SKYLINE ARRAY — STORM-SURF',
      accent: 'chip',
      html: `
        <p class="tut-lead">The ground is a mile down and the storm sea is patient. <b>Ride the updrafts UP</b> — momentum is everything.</p>
        <div class="tut-hero">
          <div class="tut-hero-key">UP<span>DASH&nbsp;+&nbsp;UPDRAFT</span></div>
          <div class="tut-hero-desc">Step into a rising <b>updraft</b> to storm-surf skyward. <b>Dash</b> through lightning and ROCKET gates — a dash phases you clean. Falling into the storm sea sends you back.</div>
        </div>
        <table class="tut-controls">
          <tr><td class="tut-k">SHIFT</td><td>Dash — i-frames slip the lightning</td></tr>
          <tr><td class="tut-k">SPACE</td><td>Jump — hold to hover</td></tr>
          <tr><td class="tut-k">X · LEFT CLICK</td><td>Pulse</td></tr>
          <tr><td class="tut-k">Q · RIGHT CLICK</td><td>Scan</td></tr>
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

  private onWake(): void {
    this.input.enabled = true;
    audio.playMusic('field');
    bus.emit(EVT.sceneChanged, { scene: SCENES.skyline, zone: 'Skyline Array' });
    this.player.refreshHud();
  }

  private flushTime(): void {
    const elapsed = Math.round((this.time.now - this.sessionStart) / 1000);
    if (elapsed <= 0) return;
    this.sessionStart = this.time.now;
    updateSave((s) => { s.playerStats.timePlayedSec += elapsed; });
  }

  private onShutdown(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
    unregisterScene('skyline');
  }
}
