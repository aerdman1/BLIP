/**
 * BLIP's top-down game world. Areas remain data-driven arenas internally, and
 * traversal breaches connect to the next top-down area.
 *  - 'waves': hold against escalating waves.
 * Isolated scene (own physics world, gravity 0). Aim with the mouse (or right stick),
 * fire yourself. Tuning in config.SWEEP.
 */
import Phaser from 'phaser';
import { EVT, PALETTE as P, RENDER_ZOOM, SCENES, SWEEP, SWEEP_BOSS, SWEEP_ELITE, SWEEP_ENEMIES, TD_ENEMY_TEX, TD_PALETTE, TD_VISUALS, TEX, TRIPO_CONTACT47_FRAMES, VIEW_W, css, type SweepEnemyKind } from '../config';
import { buildSweepTextures } from '../art/sweepTextures';
import { BlipCraft } from '../entities/sweep/BlipCraft';
import { SweepEnemy, type SweepEnemyDebugState } from '../entities/sweep/SweepEnemy';
import { Projectile, fireFrom, makeProjectileGroup } from '../entities/Projectile';
import { DEFAULT_ARENA, SWEEP_ARENAS, SWEEP_GRAVITY_WELLS, SWEEP_MOTEL_SCANNERS, SWEEP_ROUTE_BEACONS, type SweepArena, type SweepElevationZone, type SweepFieldEvent } from '../data/sweepArenas';
import { goalForArena, type RegionGoal } from '../data/regionGoals';
import { WEAPONS, WEAPON_PICKUPS, type SweepWeapon } from '../data/sweepWeapons';
import { audio } from '../systems/AudioSystem';
import { bus } from '../systems/EventBus';
import { touchInput } from '../systems/TouchInput';
import { EffectsSystem } from '../systems/EffectsSystem';
import { PlayerInput } from '../systems/InputSystem';
import { readPad } from '../systems/PadSim';
import { resetVirtualInput, virtualInput } from '../systems/VirtualInput';
import { attachScreenFilter } from '../systems/ScreenFilter';
import { affinityLabel, affinityMultiplier, damageFamilyForWeapon, type DamageFamily } from '../systems/DamageAffinity';
import { addShards, grantAbility, loadSave, updateSave } from '../systems/SaveSystem';
import { activeSkin } from '../systems/SkinState';
import { uiOverlayActive } from '../systems/UIState';
import { quests } from '../systems/QuestSystem';
import { enterHiRes, linearAllTd, restoreBase } from '../render/RenderScale';
import { DEPTH, sortedDepth } from '../render/Depth';
import { TopDownShadows } from '../render/TopDownShadows';
import { bindAtlasFrames, resolveTdArt, type TdArt } from '../topdown/TdAssets';
import { tdBiomeFor, type TdBiomeDef } from '../topdown/TdBiomes';
import { TdTerrain } from '../topdown/TdTerrain';
import { TdLighting } from '../topdown/TdLighting';
import { ActorRig, SignalNodeRig } from '../topdown/TdActors';

type PickupType = 'health' | 'weapon' | 'boon';
type ObjectiveKind = 'node' | 'breach' | 'survive' | 'gravity-well' | 'route-beacon' | 'field-event';
type ObjectiveTarget = { kind: ObjectiveKind; x: number; y: number; label?: string };
type WeaponAnnounce = 'switch' | 'pickup' | 'boon' | 'quiet';

interface SweepWorldHandoff {
  hp: number;
  weaponId: string;
  overdrive: number;
  boonScanMul: number;
  boonFireMul: number;
  shardsEarned: number;
  killCount: number;
  shotCount: number;
}

const WORLD_HANDOFF_KEY = 'sweepWorldHandoff';
const WEAPON_LOADOUT = ['pulse', 'arc', 'disc'] as const;
const BREACH_ENTRY_RADIUS = 66;
const BREACH_ENTRY_DWELL_MS = 180;
const MILLER_CRASH_INTRO_AWARD = 'intro:miller-crash-site';
const MILLER_CRASH_INTRO_EVENTS = ['crash-site-core', 'spark-line', 'first-kit-cache'] as const;
const MILLER_CRASH_INTRO_SET = new Set<string>(MILLER_CRASH_INTRO_EVENTS);

const SCOUT_TINT: Record<string, number> = {
  will: P.scoutWill,
  chip: P.scoutChip,
  henry: P.scoutHenry,
  cameron: P.scoutCameron,
  danny: P.scoutDanny,
};

const ROUTE_BEACONS = SWEEP_ROUTE_BEACONS;

/** shortest distance from point (px,py) to segment (ax,ay)-(bx,by) */
function pointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Phaser.Math.Clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function seededUnit(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSeeded<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)] ?? values[0];
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
  private objectiveArrow?: Phaser.GameObjects.Text;

  private arena!: SweepArena;
  private goal!: RegionGoal;
  private traverse = false;
  private breachPos = { x: 0, y: 0 };
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private floorTiles: Array<{ x: number; y: number }> = [];
  private walkableTiles: boolean[][] = [];
  private enemyPathDist: number[][] = [];
  private enemyPathBuiltAt = 0;
  private mapW = 0;
  private mapH = 0;
  private nodePos = { x: 0, y: 0 };
  private nodeCharge = 0;
  private chargeTarget = 100;
  private objectiveProgressCount = 0;
  private breachOpen = false;
  private breachEntryStartedAt = 0;
  private breachGlow?: Phaser.GameObjects.Image;
  private breachCore?: Phaser.GameObjects.Image;
  private breachLabel?: Phaser.GameObjects.Text;
  private boostGapWalls!: Phaser.Physics.Arcade.StaticGroup;

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
  private weaponIndex = 0;
  private boonScanMul = 1; // WILLOW boon
  private boonFireMul = 1; // ROCKET boon
  private caches: Phaser.GameObjects.Image[] = [];
  private fieldEventObjects: Array<{ def: SweepFieldEvent; x: number; y: number; marker: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; claimed: boolean }> = [];
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
  private routeMarkers: Phaser.GameObjects.GameObject[] = [];
  private routeVisited = new Set<string>();
  private exploredWashes: Array<{ area: Phaser.GameObjects.Rectangle; x: number; y: number; w: number; h: number; seen: boolean }> = [];
  private hoverTrail: Phaser.GameObjects.Graphics[] = [];
  private hoverTrailAt = 0;
  private hoverTrailLast = { x: 0, y: 0 };
  private motelScanners: Array<{
    ax: number;
    ay: number;
    bx: number;
    by: number;
    label: string;
    line: Phaser.GameObjects.Graphics;
    emitter: Phaser.GameObjects.Image;
    receiver: Phaser.GameObjects.Image;
    text: Phaser.GameObjects.Text;
    disabled?: boolean;
  }> = [];
  private motelAlertUntil = 0;
  private motelAlertCooldownUntil = 0;
  private motelAlertCount = 0;
  private motelPhaseSlipUntil = 0;
  private gravityWell?: {
    x: number;
    y: number;
    destX: number;
    destY: number;
    used: boolean;
    ring: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
  };
  private orchardGateWarnAt = 0;
  private stormRelaysActivated = new Set<string>();
  private stormRelayWarnAt = 0;
  private cipherZones: Array<{ x: number; y: number; radius: number; lockAt: number; explodeAt: number; gfx: Phaser.GameObjects.Graphics; caster?: SweepEnemy }> = [];
  private introEnemiesSeeded = false;

  /* ---- HD top-down visual treatment (per biome; see TdBiomes) ---- */
  private td = false; // is the HD treatment active for this arena?
  private tdBiome: TdBiomeDef | null = null;
  private tdArt!: TdArt;
  private tdTerrain?: TdTerrain;
  private tdLight?: TdLighting;
  private tdShadows?: TopDownShadows;
  private tdNodeRig?: SignalNodeRig;
  private tdRigs = new Map<Phaser.GameObjects.GameObject, ActorRig>();
  private tdPlayerRim?: Phaser.GameObjects.Image;
  private cameraBaseZoom = 1;
  private cameraElevationOffsetY = 0;
  private cameraElevationZoom = 1;
  private activeElevationLabel = '';
  private suppressRewardModalOnce = false;

  private exiting = false;
  private gameOverShown = false;
  private isPaused = false;
  private debugCombatProbeActive = false;
  private debugEmitAt = 0;
  private entryGraceUntil = 0;
  private unsubs: Array<() => void> = [];

  constructor() {
    super(SCENES.sweep);
  }

  create(): void {
    // Resolve the arena id FIRST — it decides whether this is the overhauled
    // arena, which in turn decides the backbuffer size. Must happen before any
    // camera or texture work.
    const arenaId = (this.registry.get('sweepArenaId') as string) ?? DEFAULT_ARENA;
    // Decide HD in ONE place, and only after confirming the art actually loaded.
    // Raising the backbuffer for an arena that then falls back to procedural art
    // would give us the cost of hi-res with none of the benefit.
    // ONE condition, not two: this arena's biome has an HD descriptor AND that
    // descriptor's art actually loaded. (Previously a hardcoded arena allowlist
    // had to agree with a separate art check — two sources of truth for one
    // question.) A biome with no descriptor renders procedurally, as before.
    this.tdBiome = TD_VISUALS.enabled ? tdBiomeFor(arenaId) : null;
    if (this.tdBiome) {
      bindAtlasFrames(this, this.tdBiome);
      this.tdArt = resolveTdArt(this, this.tdBiome);
      this.td = this.tdArt.hd;
    } else {
      this.td = false;
    }
    if (this.td) {
      // Raise the backbuffer synchronously — never in a delayedCall, or an iOS
      // rotation refit can interleave with the resize. Restored in onShutdown().
      enterHiRes(this);
      linearAllTd(this);
    }
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
    this.weaponIndex = 0;
    this.boonScanMul = 1;
    this.boonFireMul = 1;
    this.caches = [];
    this.fieldEventObjects = [];
    this.elite = undefined;
    this.eliteAura = undefined;
    this.eliteBeam = undefined;
    this.eliteState = 'idle';
    this.eliteCfg = SWEEP_ELITE;
    this.nodeFull = false;
    this.bossActive = false;
    this.bossAddsSpawned = false;
    this.routeMarkers = [];
    this.routeVisited = new Set<string>();
    this.exploredWashes = [];
    this.hoverTrail = [];
    this.hoverTrailAt = 0;
    this.hoverTrailLast = { x: 0, y: 0 };
    this.motelScanners = [];
    this.motelAlertUntil = 0;
    this.motelAlertCooldownUntil = 0;
    this.motelAlertCount = 0;
    this.motelPhaseSlipUntil = 0;
    this.gravityWell = undefined;
    this.orchardGateWarnAt = 0;
    this.stormRelaysActivated.clear();
    this.stormRelayWarnAt = 0;
    this.introEnemiesSeeded = false;

    this.arena = SWEEP_ARENAS[arenaId] ?? SWEEP_ARENAS[DEFAULT_ARENA];
    this.goal = goalForArena(this.arena.id);
    this.traverse = this.arena.mode === 'traverse';
    this.persistArenaEntry();

    const T = SWEEP.tile;
    const AW = this.arena.grid.w * T;
    const AH = this.arena.grid.h * T;
    this.mapW = AW;
    this.mapH = AH;

    // markers → world positions (tile centre)
    this.nodePos = { x: (this.arena.node.tx + 0.5) * T, y: (this.arena.node.ty + 0.5) * T };
    this.nodeCharge = 0;
    this.chargeTarget = this.arena.chargeTarget ?? SWEEP.nodeChargeDefault;
    this.objectiveProgressCount = 0;
    this.breachOpen = !this.traverse; // waves mode has no node gate

    this.cameras.main.setBackgroundColor(
      this.arena.biome === 'motel' ? '#080810' : this.arena.biome === 'orchard' ? '#0e0a16' : '#08130d'
    );
    const coarsePointer = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    // Multiply by the SAME density the backbuffer was raised by, so the visible
    // world region is identical to the 480x270 build — no gameplay retuning.
    const dens = this.scale.width / VIEW_W;
    this.cameras.main.setZoom(dens * RENDER_ZOOM * (coarsePointer ? SWEEP.touchCameraZoom : SWEEP.cameraZoom));
    this.cameraBaseZoom = this.cameras.main.zoom;
    this.cameraElevationOffsetY = 0;
    this.cameraElevationZoom = 1;
    this.activeElevationLabel = '';
    if (this.td) {
      // Pixel-snapping at a fractional zoom produces jitter, and y-sorted
      // shadows need sub-pixel continuity. Sweep camera only.
      this.cameras.main.setRoundPixels(false);
      this.cameras.main.setBackgroundColor(css(TD_PALETTE.groundDeep));
    }
    this.cameras.main.setBounds(0, 0, AW, AH);
    attachScreenFilter(this, true);

    this.physics.world.gravity.y = 0;
    this.physics.world.setBounds(0, 0, AW, AH);

    this.walls = this.physics.add.staticGroup();
    this.boostGapWalls = this.physics.add.staticGroup();
    this.buildMap(); // carves rooms/halls, builds floor + solid walls + floorTiles
    this.buildExplorationWashes();

    this.playerShots = makeProjectileGroup(this, TEX.sweepShotP, SWEEP.maxShots);
    this.enemyShots = makeProjectileGroup(this, TEX.sweepShotE, 72); // headroom for PYLON radial volleys
    this.enemies = this.physics.add.group();
    this.pickups = this.physics.add.group();

    const spawn = this.nearestWalkableWorld((this.arena.spawn.tx + 0.5) * T, (this.arena.spawn.ty + 0.5) * T);
    const spawnX = spawn.x;
    const spawnY = spawn.y;
    this.player = new BlipCraft(this, spawnX, spawnY, this.fx);
    this.hoverTrailLast = { x: spawnX, y: spawnY + 15 };
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.applyWorldHandoff();
    this.entryGraceUntil = this.time.now + 1600;
    this.player.grantShield(1600);
    this.cameras.main.startFollow(this.player, true, 0.16, 0.16);
    if (this.td) {
      const tripoReady = TRIPO_CONTACT47_FRAMES.every((frame) => this.textures.exists(frame.key));
      // sits just behind the player, invisible until a drone overlaps him
      this.tdPlayerRim = this.add
        .image(spawnX, spawnY, TEX.tdLight)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(TD_PALETTE.signal)
        .setScale(0.72)
        .setAlpha(0);
      this.tdRigs.set(
        this.player,
        new ActorRig(this, this.player, {
          body: tripoReady ? TEX.tripoContact47South : TEX.tdBlip,
          bodyDirs: tripoReady
            ? {
                south: TEX.tripoContact47South,
                southwest: TEX.tripoContact47Southwest,
                west: TEX.tripoContact47West,
                northwest: TEX.tripoContact47Northwest,
                north: TEX.tripoContact47North,
                northeast: TEX.tripoContact47Northeast,
                east: TEX.tripoContact47East,
                southeast: TEX.tripoContact47Southeast,
              }
            : undefined,
          emissive: tripoReady ? undefined : TEX.tdBlipEmis,
          emissiveColor: TD_PALETTE.signal,
          px: tripoReady ? 46 : TD_VISUALS.actorPx.player,
          hoverThrusters: tripoReady,
          hoverColor: 0x39dfff,
          collisionPx: { w: 24, h: 24 },
          lighting: this.tdLight,
          lightRadius: 92,
          lightColor: TD_PALETTE.rim,
          lightIntensity: 0.3,
        })
      );
    }

    this.reticle = this.add.image(spawnX, spawnY - 40, TEX.sweepReticle).setDepth(30).setTint(P.signal).setAlpha(0.9);
    this.objectiveArrow = this.add
      .text(spawnX, spawnY - 34, '◆', { fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: css(P.signal) })
      .setOrigin(0.5)
      .setDepth(31)
      .setAlpha(0.9);

    // walls stop the player, the drones, and every bolt
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(
      this.player,
      this.boostGapWalls,
      undefined,
      () => !this.player.isDashing,
      this
    );
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
    audio.playMusic('signal');
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
    this.input.on('wheel', this.onWeaponWheel, this);
    this.unsubs.push(bus.on(EVT.uiResume, () => this.setPaused(false)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    if (this.traverse) {
      this.buildBreach();
      this.buildCaches();
      this.buildRouteMarkers();
      this.buildFieldEvents();
      this.buildRegionSetPieces();
      if (this.isMillerCrashIntroPending()) {
        this.fx.floatText(this.player.x, this.player.y - 26, 'SYSTEM WAKE', P.scoutWill);
        bus.emit(EVT.toast, { text: 'CRASH SITE - recover the first kit before the field wakes up.', color: 'cyan' });
      } else {
        this.seedEnemies();
        this.introEnemiesSeeded = true;
      }
      this.seedWeaponPickups();
      if (this.arena.elite) this.spawnElite();
      // "surfaced" intro — a scan bloom + objective
      this.cameras.main.fadeIn(350, 2, 3, 8);
      this.fx.scanRing(this.player.x, this.player.y, 200, 620, P.signal);
      if (this.arena.id === 'circuit-z2' && grantAbility('phase-shift')) {
        bus.emit(EVT.toast, { text: 'BOOST ONLINE - hold SHIFT through scanner pressure', color: 'green' });
      }
      bus.emit(EVT.toast, { text: this.goal.activeHint, color: 'green' });
    } else {
      bus.emit(EVT.toast, { text: this.goal.activeHint, color: 'green' });
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
    this.walkableTiles = solid.map((row) => row.map((isSolid) => !isSolid));
    this.enemyPathDist = [];
    this.enemyPathBuiltAt = 0;

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

    // ── HD PATH ─────────────────────────────────────────────────────────────
    // The overhauled arena builds its ground, walls, edges, props and canopy in
    // TdTerrain instead. `solid`/`floorTiles` above are the shared collision
    // truth and are used by BOTH paths — nothing about layout changes.
    if (this.td) {
      this.tdTerrain = new TdTerrain(this, {
        arenaId: this.arena.id,
        tile: T, w: W, h: H, solid, halls: this.arena.halls,
        floor: floorCoords, markers: keyMarkers, art: this.tdArt,
        biome: this.tdBiome!,
      });
      this.tdLight = new TdLighting(this, AW, AH, this.tdBiome!);
      this.tdTerrain.accentLights = (h) => void this.tdLight?.add(h);
      this.tdTerrain.build();
      this.buildEnvironmentalBlockers(solid, floorCoords);
      // collision bodies — identical merged rects to the legacy path
      for (let y = 0; y < H; y++) {
        let x = 0;
        while (x < W) {
          if (!solid[y][x]) { x++; continue; }
          const x0 = x;
          while (x < W && solid[y][x]) x++;
          const ww = (x - x0) * T;
          const wall = this.walls.create(x0 * T + ww / 2, y * T + T / 2, TEX.px) as Phaser.Physics.Arcade.Image;
          wall.setDisplaySize(ww, T).setVisible(false).refreshBody();
        }
      }
      // HD rock/building faces visually overhang the walkable tile just below a
      // solid wall. Add a shallow invisible skirt so CONTACT-47 cannot stand
      // under the foreground art and look like he is hiding inside rocks.
      const skirtH = 14;
      for (let y = 0; y < H - 1; y++) {
        let x = 0;
        while (x < W) {
          if (!solid[y][x] || solid[y + 1]?.[x]) { x++; continue; }
          const x0 = x;
          while (x < W && solid[y][x] && !solid[y + 1]?.[x]) x++;
          const ww = (x - x0) * T;
          const skirt = this.walls.create(x0 * T + ww / 2, (y + 1) * T + skirtH / 2, TEX.px) as Phaser.Physics.Arcade.Image;
          skirt.setDisplaySize(ww, skirtH).setVisible(false).refreshBody();
        }
      }
      this.tdShadows = new TopDownShadows(this);
      this.tdNodeRig = new SignalNodeRig(this, node.x, node.y, this.tdLight);
      this.buildBoostGaps();
      return;
    }

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
    this.buildBoostGaps();

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

  private buildBoostGaps(): void {
    const gaps = this.arena.boostGaps ?? [];
    if (!gaps.length) return;
    const T = SWEEP.tile;
    gaps.forEach((gap) => {
      const x = gap.x * T;
      const y = gap.y * T;
      const w = gap.w * T;
      const h = gap.h * T;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rng = seededUnit(`boost-gap:${this.arena.id}:${gap.id}`);

      const wash = this.add
        .ellipse(cx, cy + 4, w * 1.04, h * 1.08, 0x05090b, 0.32)
        .setDepth(4.2)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
      const g = this.add.graphics().setDepth(4.5);
      const vertical = (gap.orientation ?? 'horizontal') === 'vertical';
      const spine: Array<{ x: number; y: number }> = [];
      const steps = 7;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const wobble = (rng() - 0.5) * (vertical ? w * 0.18 : h * 0.2);
        spine.push({
          x: vertical ? cx + wobble : x + t * w,
          y: vertical ? y + t * h : cy + wobble,
        });
      }
      const left: Array<{ x: number; y: number }> = [];
      const right: Array<{ x: number; y: number }> = [];
      spine.forEach((p, i) => {
        const width = (vertical ? w : h) * (0.12 + rng() * 0.08) + (i % 2 === 0 ? 5 : -2);
        left.push({ x: p.x + (vertical ? -width : 0), y: p.y + (vertical ? 0 : -width) });
        right.unshift({ x: p.x + (vertical ? width : 0), y: p.y + (vertical ? 0 : width) });
      });
      g.fillStyle(0x090306, 0.88);
      g.fillPoints([...left, ...right], true);
      g.lineStyle(7, P.danger, 0.12);
      for (let i = 1; i < spine.length; i++) g.lineBetween(spine[i - 1].x, spine[i - 1].y, spine[i].x, spine[i].y);
      g.lineStyle(4, P.danger, 0.42);
      for (let i = 1; i < spine.length; i++) g.lineBetween(spine[i - 1].x, spine[i - 1].y, spine[i].x, spine[i].y);
      g.lineStyle(2, 0xffb15a, 0.78);
      for (let i = 1; i < spine.length; i++) g.lineBetween(spine[i - 1].x, spine[i - 1].y, spine[i].x, spine[i].y);
      g.lineStyle(1, 0xfff0b0, 0.56);
      for (let i = 1; i < spine.length - 1; i += 2) {
        const p = spine[i];
        const len = vertical ? w * (0.18 + rng() * 0.18) : h * (0.18 + rng() * 0.18);
        const branchA = {
          x: p.x + (vertical ? len : (rng() - 0.5) * 18),
          y: p.y + (vertical ? (rng() - 0.5) * 18 : len),
        };
        const branchB = {
          x: p.x - (vertical ? len * 0.72 : (rng() - 0.5) * 18),
          y: p.y - (vertical ? (rng() - 0.5) * 18 : len * 0.72),
        };
        g.lineStyle(4, P.danger, 0.24);
        g.lineBetween(p.x, p.y, branchA.x, branchA.y);
        g.lineBetween(p.x, p.y, branchB.x, branchB.y);
        g.lineStyle(1, 0xfff0b0, 0.58);
        g.lineBetween(p.x, p.y, branchA.x, branchA.y);
        g.lineBetween(p.x, p.y, branchB.x, branchB.y);
        if (rng() < 0.8) {
          const twig = {
            x: branchA.x + (vertical ? len * 0.25 : (rng() - 0.5) * 12),
            y: branchA.y + (vertical ? (rng() - 0.5) * 12 : len * 0.25),
          };
          g.lineStyle(1, P.danger, 0.5);
          g.lineBetween(branchA.x, branchA.y, twig.x, twig.y);
        }
      }

      this.add
        .rectangle(cx, cy, w * 0.9, h * 0.48, P.danger, 0.18)
        .setDepth(4.35)
        .setBlendMode(Phaser.BlendModes.ADD);
      const labelY = y - 12;
      this.add
        .rectangle(cx, labelY, Math.max(104, gap.label.length * 8), 18, P.black, 0.82)
        .setStrokeStyle(1, P.danger, 0.78)
        .setDepth(12);
      this.add
        .text(cx, labelY, 'HOLD BOOST', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: css(0xff9a5c),
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(13);

      const wall = this.boostGapWalls.create(cx, cy, TEX.px) as Phaser.Physics.Arcade.Image;
      wall.setDisplaySize(Math.max(28, w * 0.86), Math.max(28, h * 0.78)).setVisible(false).refreshBody();
      wall.setData('boostGapId', gap.id);
      wash.setData('boostGapId', gap.id);
    });
  }

  private buildExplorationWashes(): void {
    if (!this.td) return;
    const T = SWEEP.tile;
    const spawnX = (this.arena.spawn.tx + 0.5) * T;
    const spawnY = (this.arena.spawn.ty + 0.5) * T;
    this.arena.rooms.forEach((r, i) => {
      const x = (r.x + r.w / 2) * T;
      const y = (r.y + r.h / 2) * T;
      const w = Math.max(1, r.w * T);
      const h = Math.max(1, r.h * T);
      const seen = Math.abs(spawnX - x) <= w / 2 + 20 && Math.abs(spawnY - y) <= h / 2 + 20;
      const area = this.add
        .rectangle(x, y, w + 8, h + 8, P.black, seen ? 0.02 : 0.14)
        .setDepth(5 + i * 0.001)
        .setBlendMode(Phaser.BlendModes.NORMAL);
      this.exploredWashes.push({ area, x, y, w, h, seen });
    });
  }

  private updateExplorationWashes(): void {
    if (!this.exploredWashes.length || !this.player?.active) return;
    this.exploredWashes.forEach((w) => {
      if (w.seen) return;
      const inside =
        Math.abs(this.player.x - w.x) <= w.w / 2 + 34 &&
        Math.abs(this.player.y - w.y) <= w.h / 2 + 34;
      if (!inside) return;
      w.seen = true;
      this.tweens.add({ targets: w.area, alpha: 0.025, duration: 520, ease: 'Sine.easeOut' });
    });
  }

  private updateHoverTrail(now: number): void {
    if (!this.td || !this.player?.active || !this.player.alive) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    const speed = body?.velocity.length() ?? 0;
    if (speed < 22) return;

    const boosted = this.player.isDashing;
    const interval = boosted ? 82 : 165;
    const x = this.player.x;
    const y = this.player.y + 18;
    const last = this.hoverTrailLast;
    const dist = Phaser.Math.Distance.Between(x, y, last.x, last.y);
    if (now < this.hoverTrailAt && dist < (boosted ? 18 : 28)) return;
    if (dist < 6 || dist > 150) {
      this.hoverTrailLast = { x, y };
      this.hoverTrailAt = now + interval;
      return;
    }

    this.hoverTrailAt = now + interval;
    this.hoverTrailLast = { x, y };
    const angle = Math.atan2(y - last.y, x - last.x);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const wobble = Math.sin(now * 0.017 + x * 0.013) * 1.8;
    const trail = this.add.graphics().setDepth(4.05).setBlendMode(Phaser.BlendModes.ADD);
    const sx = last.x + nx * wobble;
    const sy = last.y + ny * wobble;
    const ex = x - Math.cos(angle) * 5 - nx * wobble * 0.45;
    const ey = y - Math.sin(angle) * 5 - ny * wobble * 0.45;
    trail.lineStyle(boosted ? 16 : 10, P.neonCyan, boosted ? 0.08 : 0.045);
    trail.lineBetween(sx, sy, ex, ey);
    trail.lineStyle(boosted ? 7 : 4, 0x79f2ff, boosted ? 0.22 : 0.13);
    trail.lineBetween(sx, sy, ex, ey);
    trail.lineStyle(boosted ? 2 : 1, 0xe8ffff, boosted ? 0.46 : 0.24);
    trail.lineBetween(sx, sy, ex, ey);
    for (let i = 0; i < (boosted ? 3 : 1); i++) {
      const t = (i + 1) / (boosted ? 4 : 2);
      const px = Phaser.Math.Linear(sx, ex, t);
      const py = Phaser.Math.Linear(sy, ey, t);
      const flick = (i % 2 === 0 ? 1 : -1) * (boosted ? 7 : 4);
      trail.lineStyle(1, P.neonCyan, boosted ? 0.18 : 0.08);
      trail.lineBetween(px, py, px + nx * flick, py + ny * flick);
    }
    this.hoverTrail.push(trail);
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: boosted ? 24000 : 19000,
      ease: 'Sine.easeOut',
      onComplete: () => {
        Phaser.Utils.Array.Remove(this.hoverTrail, trail);
        trail.destroy();
      },
    });

    while (this.hoverTrail.length > 140) {
      const old = this.hoverTrail.shift();
      old?.destroy();
    }
  }

  private buildEnvironmentalBlockers(solid: boolean[][], floorCoords: Array<{ tx: number; ty: number; edge: boolean }>): void {
    if (!this.td || !this.tdBiome) return;
    const T = SWEEP.tile;
    const rng = seededUnit(`blockers:${this.arena.id}`);
    const markerClear = [this.arena.spawn, this.arena.node, this.arena.breach].filter(Boolean) as Array<{ tx: number; ty: number }>;
    const clearOfMarkers = (tx: number, ty: number, d = 4) =>
      !markerClear.some((m) => Math.abs(tx - m.tx) + Math.abs(ty - m.ty) < d);
    const blockedEdge: Array<{ tx: number; ty: number; openBelow: boolean; openLeft: boolean; openRight: boolean; openAbove: boolean }> = [];
    const seen = new Set<string>();
    for (const p of floorCoords) {
      if (!p.edge) continue;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const tx = p.tx + dx;
        const ty = p.ty + dy;
        const k = `${tx},${ty}`;
        if (seen.has(k) || !solid[ty]?.[tx] || !clearOfMarkers(tx, ty)) continue;
        seen.add(k);
        blockedEdge.push({
          tx,
          ty,
          openBelow: !solid[ty + 1]?.[tx],
          openLeft: !solid[ty]?.[tx - 1],
          openRight: !solid[ty]?.[tx + 1],
          openAbove: !solid[ty - 1]?.[tx],
        });
      }
    }

    const poolForArena = (): readonly string[] => {
      if (this.arena.id === 'circuit-z2') {
        return ['td-z2-rubble', 'td-z2-scrap', 'td-z2-tire', 'td-z2-cone', 'td-z2-crate', 'td-z2-planter'];
      }
      if (this.arena.id === 'town-z3') {
        return ['td-z2-lm-lamp', 'td-z2-lm-sign', 'td-z2-rubble', 'td-z2-planter', 'td-z2-crate', 'td-z2-cone'];
      }
      if (this.arena.id === 'maze-z4') {
        return ['td-z4-hay', 'td-z4-crate', 'td-z4-pumpkin', 'td-z4-gourd', 'td-z4-basket', 'td-z4-tuft'];
      }
      if (this.arena.id === 'anomaly-01') {
        return [TEX.tdScrap, TEX.tdRock, TEX.tdDebris, TEX.tdLmRelay, TEX.tdLmRoots, TEX.tdBush];
      }
      return [TEX.tdRock, TEX.tdBush, TEX.tdLog, TEX.tdFern, TEX.tdDebris, TEX.tdScrap];
    };
    const pool = poolForArena().filter((key) => this.textures.exists(key));
    if (!pool.length) return;
    for (let i = blockedEdge.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [blockedEdge[i], blockedEdge[j]] = [blockedEdge[j], blockedEdge[i]];
    }
    const max = Math.min(this.arena.id === 'town-z3' ? 52 : 44, blockedEdge.length);
    for (let i = 0; i < max; i++) {
      const edge = blockedEdge[i];
      const tex = pickSeeded(rng, pool);
      const horizontalOffset = (rng() - 0.5) * T * 0.62;
      const sideNudge = edge.openLeft ? -T * 0.2 : edge.openRight ? T * 0.2 : 0;
      const yBias = edge.openBelow ? 0.82 : edge.openAbove ? 0.34 : 0.58;
      const x = (edge.tx + 0.5) * T + horizontalOffset + sideNudge;
      const y = (edge.ty + yBias) * T;
      const large = tex.includes('lm-') || rng() < (this.arena.id === 'town-z3' ? 0.28 : 0.16);
      const baseScale = this.arena.id === 'town-z3' || this.arena.id === 'circuit-z2' ? 0.26 : 0.34;
      const scale = large ? baseScale * (1.05 + rng() * 0.35) : baseScale * (0.65 + rng() * 0.5);
      const img = this.add
        .image(x, y, tex)
        .setOrigin(0.5, 1)
        .setDepth(sortedDepth(y))
        .setScale(scale)
        .setAlpha(this.arena.id === 'anomaly-01' ? 0.78 : 0.9);
      if (rng() < 0.5) img.setFlipX(true);
      if (this.arena.id === 'anomaly-01') {
        img.setTint(rng() < 0.5 ? P.violetGlitch : P.neonCyan);
        if (rng() < 0.32) {
          this.tdLight?.add({ x, y: y - 12, radius: 34 + rng() * 36, color: rng() < 0.5 ? P.violetGlitch : P.danger, intensity: 0.16 });
        }
      }
    }
  }

  private orchardGateReady(): boolean {
    if (this.arena.id !== 'maze-z4') return true;
    return !this.gravityWell || this.gravityWell.used;
  }

  private maybeCompleteTraverseObjective(): boolean {
    if (!this.traverse || this.breachOpen || this.nodeFull) return false;
    const minActions = this.arena.minObjectiveActions ?? 0;
    if (this.nodeCharge < this.chargeTarget || this.objectiveProgressCount < minActions) return false;
    if (!this.orchardGateReady()) {
      this.fx.floatText(this.nodePos.x, this.nodePos.y - 26, 'RIDGE ROUTE FIRST', P.warning);
      bus.emit(EVT.toast, { text: 'Redirect the Gravity Well before the Crop Circle opens.', color: 'orange' });
      return false;
    }
    this.nodeFull = true;
    // FINALE: charging the Node wakes the Maze Heart; the breach stays sealed until it dies.
    if (this.arena.bossFinale) this.beginBossFinale();
    else this.openBreach();
    return true;
  }

  /* ------------------------------ traverse ------------------------------- */
  private buildBreach(): void {
    const T = SWEEP.tile;
    const m = this.arena.breach ?? { tx: this.arena.grid.w - 2, ty: 2 };
    const p = this.nearestWalkableWorld((m.tx + 0.5) * T, (m.ty + 0.5) * T);
    const bx = p.x;
    const by = p.y;
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

  private buildRouteMarkers(): void {
    const route = ROUTE_BEACONS[this.arena.id];
    if (!route) return;
    const T = SWEEP.tile;
    const signDepth = DEPTH.foreground - 180;
    const build = (m: { tx: number; ty: number; label: string }, phase: 'objective' | 'exit') => {
      const x = (m.tx + 0.5) * T;
      const y = (m.ty + 0.5) * T;
      const tint = phase === 'exit' ? P.warning : P.signal;
      const glow = this.add.image(x, y - 16, TEX.glow8).setDepth(signDepth).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(0.56).setAlpha(0.18);
      const stem = this.add.rectangle(x, y - 15, 2, 23, 0x1b1712, 0.95).setDepth(signDepth + 1);
      const postLight = this.add.rectangle(x + 1, y - 16, 1, 19, tint, 0.55).setDepth(signDepth + 2);
      const dot = this.add.image(x, y - 3, TEX.sweepPickup).setDepth(signDepth + 3).setTint(tint).setScale(0.32).setAngle(45).setAlpha(0.78);
      const label = this.add
        .text(x, y - 31, m.label, {
          fontFamily: 'monospace',
          fontSize: '6px',
          fontStyle: 'bold',
          color: '#f4e2ad',
          stroke: '#05080e',
          strokeThickness: 4,
          shadow: { offsetX: 0, offsetY: 1, color: '#000000', blur: 0, fill: true },
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(signDepth + 5);
      const back = this.add
        .rectangle(x, y - 31, Math.max(50, label.width + 14), 17, 0x07090d, 0.94)
        .setDepth(signDepth + 4)
        .setStrokeStyle(1, tint, 0.95);
      const cap = this.add.rectangle(x, y - 20, Math.max(44, label.width + 6), 2, tint, 0.72).setDepth(signDepth + 4);
      [glow, stem, postLight, dot, back, cap, label].forEach((obj) => {
        obj.setData('routePhase', phase);
        obj.setData('routeSign', true);
        obj.setData('routeLabel', m.label);
        obj.setData('routeSignX', x);
        obj.setData('routeSignY', y - 20);
        obj.setData('baseAlpha', obj.alpha);
      });
      this.tweens.add({ targets: glow, alpha: { from: 0.12, to: 0.28 }, scale: { from: 0.48, to: 0.7 }, duration: 900, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: dot, alpha: { from: 0.62, to: 0.98 }, duration: 700, yoyo: true, repeat: -1 });
      this.routeMarkers.push(glow, stem, postLight, dot, back, cap, label);
    };
    route.toObjective.forEach((m) => build(m, 'objective'));
    route.toExit.forEach((m) => build(m, 'exit'));
    this.buildAreaIdentityDressing();
    this.updateRouteMarkerVisibility();
  }

  private buildAreaIdentityDressing(): void {
    if (!this.td) return;
    const route = ROUTE_BEACONS[this.arena.id];
    if (!route) return;
    const T = SWEEP.tile;
    [...route.toObjective, ...route.toExit].forEach((m) => {
      this.decorateNamedArea(m.label, (m.tx + 0.5) * T, (m.ty + 0.5) * T);
    });
  }

  private decorateNamedArea(label: string, x: number, y: number): void {
    const T = SWEEP.tile;
    const key = label.toUpperCase();
    const g = this.add.graphics().setDepth(DEPTH.decal + 36).setAlpha(0.86);
    const line = (color: number, alpha: number, width = 2) => g.lineStyle(width, color, alpha);
    const fill = (color: number, alpha: number) => g.fillStyle(color, alpha);
    const addProp = (tex: string, ox: number, oy: number, scale: number, tint?: number) => {
      if (!this.textures.exists(tex)) return;
      const img = this.add.image(x + ox, y + oy, tex).setOrigin(0.5, 1).setDepth(sortedDepth(y + oy)).setScale(scale).setAlpha(0.88);
      if (tint) img.setTint(tint);
      if ((ox + oy) % 2) img.setFlipX(true);
    };
    const addPost = (ox: number, oy: number, color: number, h = 34) => {
      const pg = this.add.graphics().setDepth(sortedDepth(y + oy)).setAlpha(0.72);
      pg.lineStyle(4, 0x171716, 0.88);
      pg.lineBetween(0, 0, 0, -h);
      pg.lineStyle(1, color, 0.52);
      pg.lineBetween(1, -4, 1, -h + 4);
      pg.fillStyle(color, 0.32);
      pg.fillCircle(0, -h - 1, 4);
      pg.setPosition(x + ox, y + oy);
    };

    if (this.arena.id === 'surface-z1') {
      if (key.includes('FIELD') || key.includes('EAST') || key.includes('ROAD') || key.includes('BEND')) {
        fill(0x2d2519, 0.24);
        g.fillEllipse(x, y + 5, T * 2.3, T * 0.64);
        line(0x756247, 0.18, 2);
        g.lineBetween(x - T * 1.1, y + 6, x + T * 1.1, y - 4);
        addProp(TEX.tdLog, -34, 26, 0.25);
        addProp(TEX.tdRock, 34, 22, 0.25);
      }
      if (key.includes('WILLOW') || key.includes('CACHE') || key.includes('BREACH')) {
        line(P.signalGreen, 0.18, 2);
        g.strokeCircle(x, y + 4, 24);
        addProp(TEX.tdFern, -28, 18, 0.34, 0xb8d4c0);
        addProp(TEX.tdLmRoots, 32, 24, 0.2);
      }
      if (key.includes('MOTEL')) addPost(-30, 18, P.warning, 38);
    } else if (this.arena.id === 'circuit-z2') {
      if (key.includes('DRIVE') || key.includes('PARKING') || key.includes('SERVICE')) {
        line(0xd9b464, 0.2, 2);
        for (let i = -1; i <= 1; i++) g.lineBetween(x - 44, y + i * 13, x + 44, y + i * 13);
        addProp('td-z2-cone', -38, 20, 0.28);
        addProp('td-z2-tire', 38, 24, 0.26);
      }
      if (key.includes('CHECK-IN') || key.includes('ROOM')) {
        fill(0x080b12, 0.28);
        g.fillRoundedRect(x - 54, y - 16, 108, 24, 4);
        line(0x56e3f0, 0.18, 2);
        for (let i = -1; i <= 1; i++) g.strokeRect(x + i * 30 - 10, y - 12, 20, 15);
        addProp('td-z2-lm-vending', 42, 22, 0.22);
      }
      if (key.includes('POOL')) {
        fill(0x56e3f0, 0.14);
        g.fillEllipse(x, y + 5, 92, 42);
        line(0xd9f7ff, 0.25, 2);
        g.strokeEllipse(x, y + 5, 100, 50);
      }
      if (key.includes('SCANNER') || key.includes('RIVER') || key.includes('TOWN')) {
        addPost(-34, 22, P.danger, 42);
        addPost(34, 22, P.neonCyan, 36);
      }
    } else if (this.arena.id === 'town-z3') {
      if (key.includes('MAIN') || key.includes('STADIUM') || key.includes('COUNTY')) {
        fill(0x1a1d22, 0.2);
        g.fillRoundedRect(x - 70, y - 16, 140, 32, 5);
        line(0xf0c36a, 0.24, 2);
        g.lineBetween(x - 58, y, x - 14, y);
        g.lineBetween(x + 14, y, x + 58, y);
        addPost(-54, 22, 0xffc966, 44);
        addProp('td-z2-crate', 48, 24, 0.3);
        addProp('td-z2-planter', 66, 22, 0.28);
      }
      if (key.includes('MARKET')) {
        fill(0x5a2e2e, 0.16);
        for (let i = -1; i <= 1; i++) g.fillRoundedRect(x + i * 31 - 12, y - 18, 24, 18, 3);
        addProp('td-z2-crate', -36, 24, 0.28);
        addProp('td-z2-planter', 36, 22, 0.27);
      }
      if (key.includes('TOWER') || key.includes('ORCHARD')) {
        addPost(-36, 24, key.includes('TOWER') ? P.danger : P.signalGreen, 50);
        addProp('td-z2-lm-sign', 34, 24, 0.22);
      }
    } else if (this.arena.id === 'maze-z4') {
      if (key.includes('ROWS') || key.includes('CROP') || key.includes('RIDGE')) {
        line(0xaa7a34, 0.23, 3);
        for (let i = -3; i <= 3; i++) g.lineBetween(x - 66, y + i * 10, x + 66, y + i * 4);
        addProp('td-z4-hay', -44, 24, 0.28);
        addProp('td-z4-pumpkin', 44, 22, 0.24);
      }
      if (key.includes('GRAVITY')) {
        fill(P.cropGlow, 0.1);
        g.fillCircle(x, y, 42);
        line(P.cropGlow, 0.22, 2);
        g.strokeCircle(x, y, 50);
      }
      if (key.includes('LOWER') || key.includes('STORM')) {
        line(key.includes('STORM') ? P.danger : 0x5d8e9a, 0.22, 2);
        g.lineBetween(x - 54, y + 18, x - 18, y + 8);
        g.lineBetween(x - 18, y + 8, x + 28, y + 20);
        g.lineBetween(x + 28, y + 20, x + 58, y + 8);
      }
      if (key.includes('SHELTER')) addProp('td-z4-lm-cart', -32, 26, 0.24);
    } else if (this.arena.id === 'anomaly-01') {
      if (key.includes('CORE') || key.includes('RIFT') || key.includes('RELAY')) {
        fill(0x12091e, 0.28);
        g.fillCircle(x, y, key.includes('CORE') ? 58 : 42);
        line(key.includes('RIFT') ? P.danger : P.neonCyan, 0.28, 2);
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 * i) / 5;
          g.lineBetween(x, y, x + Math.cos(a) * 54, y + Math.sin(a) * 34);
        }
        addProp(TEX.tdLmRelay, -42, 26, 0.22, key.includes('RIFT') ? P.danger : P.neonCyan);
        addProp(TEX.tdScrap, 42, 24, 0.28, 0xb06bff);
      } else if (key.includes('RECOVERY')) {
        fill(P.signalGreen, 0.08);
        g.fillRoundedRect(x - 46, y - 20, 92, 40, 8);
        line(P.signalGreen, 0.18, 2);
        g.strokeRoundedRect(x - 50, y - 24, 100, 48, 8);
      }
    }
  }

  private updateRouteMarkerVisibility(): void {
    const activePhase = this.breachOpen ? 'exit' : 'objective';
    this.routeMarkers.forEach((obj) => {
      const phase = obj.getData?.('routePhase') as string | undefined;
      if (!phase) return;
      let visible = phase === activePhase;
      const label = obj.getData?.('routeLabel') as string | undefined;
      if (visible && this.arena.id === 'maze-z4' && phase === 'objective') {
        visible = this.gravityWell?.used ? label === 'CROP CIRCLE' : label !== 'CROP CIRCLE';
      }
      (obj as unknown as Phaser.GameObjects.Components.Visible).setVisible(visible);
    });
    this.updateRouteMarkerProximity();
  }

  private updateRouteMarkerProximity(): void {
    if (!this.player) return;
    this.routeMarkers.forEach((obj) => {
      if (!obj.getData?.('routeSign') || !(obj as unknown as Phaser.GameObjects.Components.Visible).visible) return;
      const x = Number(obj.getData('routeSignX') ?? 0);
      const y = Number(obj.getData('routeSignY') ?? 0);
      const baseAlpha = Number(obj.getData('baseAlpha') ?? 1);
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
      const nearFade = Phaser.Math.Clamp((d - 28) / 54, 0.38, 1);
      (obj as unknown as Phaser.GameObjects.Components.AlphaSingle).setAlpha(baseAlpha * nearFade);
    });
  }

  private buildRegionSetPieces(): void {
    if (this.arena.id === 'circuit-z2') this.buildMotelScanners();
    this.buildElevationZones();
    if (this.arena.id !== 'maze-z4') return;
    const T = SWEEP.tile;
    const well = SWEEP_GRAVITY_WELLS[this.arena.id];
    if (!well) return;
    const x = well.tx * T;
    const y = well.ty * T;
    const destX = well.destTx * T;
    const destY = well.destTy * T;
    const ring = this.add.image(x, y, TEX.glow8).setDepth(10).setTint(P.cropGlow).setBlendMode(Phaser.BlendModes.ADD).setScale(2.2).setAlpha(0.42);
    const label = this.add
      .text(x, y - 28, well.label, {
        fontFamily: 'monospace',
        fontSize: '7px',
        fontStyle: 'bold',
        color: css(P.cream),
        align: 'center',
        backgroundColor: 'rgba(5,8,14,0.78)',
        padding: { x: 4, y: 3 },
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(13);
    this.tweens.add({ targets: ring, scale: { from: 1.8, to: 3.0 }, alpha: { from: 0.28, to: 0.62 }, duration: 860, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.gravityWell = { x, y, destX, destY, used: false, ring, label };

    const ridge = this.add.image(destX, destY, TEX.sweepCrop).setDepth(3).setTint(P.cropGlow).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9).setAlpha(0.34);
    this.tweens.add({ targets: ridge, alpha: { from: 0.2, to: 0.5 }, duration: 1200, yoyo: true, repeat: -1 });
    this.add
      .text(destX, destY - 22, well.destLabel, {
        fontFamily: 'monospace',
        fontSize: '7px',
        fontStyle: 'bold',
        color: css(P.cropGlow),
        backgroundColor: 'rgba(5,8,14,0.72)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(13);
  }

  private buildElevationZones(): void {
    if (!this.td || !this.arena.elevationZones?.length) return;
    const T = SWEEP.tile;
    this.arena.elevationZones.forEach((zone) => {
      const x = zone.x * T;
      const y = zone.y * T;
      const w = zone.w * T;
      const h = zone.h * T;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const g = this.add.graphics().setDepth(DEPTH.decal + 52).setAlpha(0.9);
      const color = zone.kind === 'rise' || zone.kind === 'roofline'
        ? P.warning
        : zone.kind === 'rift'
          ? P.violetGlitch
          : P.neonCyan;
      const shadow = zone.kind === 'rift' ? P.danger : 0x030508;
      const raised = zone.kind === 'rise' || zone.kind === 'roofline';
      const low = zone.kind === 'drop' || zone.kind === 'creek' || zone.kind === 'rift';
      const innerX = x + 18;
      const innerY = y + 18;
      const innerW = w - 36;
      const innerH = h - 36;

      g.fillStyle(shadow, raised ? 0.2 : 0.13);
      g.fillRoundedRect(x + 16, y + h - 22, w - 32, 34, 14);
      g.fillStyle(shadow, low ? 0.18 : 0.08);
      g.fillRoundedRect(x + 10, y + 10, w - 20, h - 20, 18);

      if (raised) {
        g.fillStyle(this.arena.biome === 'motel' || this.arena.biome === 'stadium' ? 0x1c2224 : 0x26361f, 0.44);
        g.fillRoundedRect(innerX, innerY, innerW, innerH, 16);
        g.fillStyle(0x05070a, 0.42);
        g.fillRect(innerX, y + h - 34, innerW, 28);
        g.lineStyle(5, shadow, 0.48);
        g.lineBetween(innerX, y + h - 34, innerX + innerW, y + h - 30);
        g.lineStyle(3, color, 0.2);
        g.lineBetween(innerX + 4, innerY + 4, innerX + innerW - 4, innerY + 10);
        g.lineStyle(2, 0x9f8150, 0.24);
        for (let i = 0; i < 9; i++) {
          const t = i / 8;
          const rx = Phaser.Math.Linear(innerX + 18, innerX + innerW - 18, t);
          g.lineBetween(rx - 16, y + h - 28 + Math.sin(i) * 5, rx + 18, y + h - 42 + Math.cos(i) * 4);
        }
        const rampW = Math.min(150, innerW * 0.5);
        g.fillStyle(this.arena.biome === 'motel' || this.arena.biome === 'stadium' ? 0x2c3336 : 0x60432b, 0.5);
        g.fillTriangle(cx - rampW / 2, y + h - 8, cx + rampW / 2, y + h - 8, cx + rampW * 0.22, cy + innerH * 0.18);
        g.lineStyle(2, 0xe2c47a, 0.16);
        g.lineBetween(cx - rampW / 2, y + h - 10, cx + rampW * 0.18, cy + innerH * 0.18);
        g.lineBetween(cx + rampW / 2, y + h - 10, cx + rampW * 0.18, cy + innerH * 0.18);
      } else {
        g.fillStyle(zone.kind === 'rift' ? 0x110616 : zone.kind === 'creek' ? 0x102c2f : 0x171f1c, zone.kind === 'rift' ? 0.38 : 0.32);
        g.fillRoundedRect(innerX, innerY, innerW, innerH, 18);
        g.lineStyle(5, shadow, 0.42);
        g.strokeRoundedRect(innerX + 2, innerY + 2, innerW - 4, innerH - 4, 18);
        g.lineStyle(2, color, zone.kind === 'rift' ? 0.24 : 0.16);
        g.lineBetween(innerX + 12, innerY + 12, innerX + innerW - 14, innerY + 20);
        g.lineBetween(innerX + 10, innerY + innerH - 18, innerX + innerW - 12, innerY + innerH - 26);
      }

      const hatchCount = Math.max(6, Math.min(18, Math.floor(w / 54)));
      for (let i = 0; i < hatchCount; i++) {
        const t = i / Math.max(1, hatchCount - 1);
        const hx = Phaser.Math.Linear(innerX + 14, innerX + innerW - 14, t);
        const hy = cy + Math.sin(t * Math.PI * 2) * innerH * 0.22;
        const dir = raised ? -1 : 1;
        g.lineStyle(1, color, zone.kind === 'rift' ? 0.2 : 0.14);
        g.lineBetween(hx - 24, hy + 12 * dir, hx + 24, hy - 12 * dir);
      }
      if (zone.kind === 'creek') {
        g.lineStyle(2, P.neonCyan, 0.18);
        for (let i = 0; i < 3; i++) {
          const yy = innerY + innerH * (0.32 + i * 0.16);
          g.beginPath();
          g.moveTo(innerX + 14, yy);
          for (let step = 1; step <= 8; step++) {
            const xx = innerX + 14 + (innerW - 28) * (step / 8);
            g.lineTo(xx, yy + Math.sin(step * 1.4 + i) * 7);
          }
          g.strokePath();
        }
      }
      if (zone.kind === 'rift') {
        const core = this.add.image(cx, cy, TEX.glow8).setDepth(DEPTH.decal + 51).setTint(P.violetGlitch).setBlendMode(Phaser.BlendModes.ADD).setScale(Math.max(2.2, Math.min(4.8, w / 150))).setAlpha(0.12);
        this.tweens.add({ targets: core, alpha: { from: 0.08, to: 0.22 }, scale: { from: core.scale * 0.92, to: core.scale * 1.08 }, duration: 1400, yoyo: true, repeat: -1 });
      }
    });
  }

  private zoneContains(zone: SweepElevationZone, x: number, y: number): boolean {
    const T = SWEEP.tile;
    const left = zone.x * T;
    const top = zone.y * T;
    return x >= left && x <= left + zone.w * T && y >= top && y <= top + zone.h * T;
  }

  private currentElevationZone(): SweepElevationZone | null {
    const zones = this.arena.elevationZones ?? [];
    return zones.find((zone) => this.zoneContains(zone, this.player.x, this.player.y)) ?? null;
  }

  private updateCameraElevation(dt: number): void {
    if (!this.td || !this.player?.active) return;
    const zone = this.currentElevationZone();
    const targetOffsetY = zone?.cameraOffsetY ?? 0;
    const targetZoom = zone?.cameraZoom ?? 1;
    const t = Phaser.Math.Clamp(dt * 5.2, 0.05, 0.18);
    this.cameraElevationOffsetY = Phaser.Math.Linear(this.cameraElevationOffsetY, targetOffsetY, t);
    this.cameraElevationZoom = Phaser.Math.Linear(this.cameraElevationZoom, targetZoom, t);
    this.activeElevationLabel = zone?.label ?? '';
    this.cameras.main.setFollowOffset(0, this.cameraElevationOffsetY);
    this.cameras.main.setZoom(this.cameraBaseZoom * this.cameraElevationZoom);
  }

  private buildMotelScanners(): void {
    const T = SWEEP.tile;
    const addScanner = (aTx: number, aTy: number, bTx: number, bTy: number, label: string) => {
      const ax = (aTx + 0.5) * T;
      const ay = (aTy + 0.5) * T;
      const bx = (bTx + 0.5) * T;
      const by = (bTy + 0.5) * T;
      const line = this.add.graphics().setDepth(14);
      const emitter = this.add.image(ax, ay, TEX.scannerRig).setDepth(15).setTint(P.danger).setScale(0.66).setAlpha(0.9);
      const receiver = this.add.image(bx, by, TEX.scannerRig).setDepth(15).setTint(P.danger).setScale(0.66).setAlpha(0.9);
      const midX = (ax + bx) / 2;
      const midY = (ay + by) / 2;
      const text = this.add
        .text(midX, midY - 18, label, {
          fontFamily: 'monospace',
          fontSize: '6px',
          fontStyle: 'bold',
          color: css(P.danger),
          stroke: '#05080e',
          strokeThickness: 3,
          backgroundColor: 'rgba(5,8,14,0.76)',
          padding: { x: 3, y: 2 },
        })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(16);
      this.routeMarkers.push(text);
      this.motelScanners.push({ ax, ay, bx, by, label, line, emitter, receiver, text });
    };

    SWEEP_MOTEL_SCANNERS.forEach((s) => addScanner(s.aTx, s.aTy, s.bTx, s.bTy, s.label));
    bus.emit(EVT.toast, { text: 'MOTEL SECURITY - hold Boost through red beams or fight the alert.', color: 'orange' });
  }

  /** the Node is fully charged — light the breach and let the player route onward */
  private openBreach(): void {
    if (this.breachOpen) return;
    this.breachOpen = true;
    this.awardRegionReward();
    audio.doorUnlock();
    this.fx.flash(P.signalGreen, 150);
    this.breachCore?.setTint(P.signal);
    this.breachLabel?.setText('BREACH ▸').setColor(css(P.signal));
    if (this.breachGlow) {
      this.breachGlow.setTint(P.signal).setAlpha(0.4);
      this.tweens.add({ targets: this.breachGlow, scale: { from: 6, to: 9 }, alpha: { from: 0.3, to: 0.6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.updateRouteMarkerVisibility();
    this.quietRoutePressure();
    this.maybeAwardMotelStealthBonus();
    this.disableMotelScannersForRouteOpen();
    bus.emit(EVT.toast, { text: this.goal.exitHint, color: 'green' });
    this.showBanner(this.arena.nextLabel ? `ROUTE OPEN — ${this.arena.nextLabel.toUpperCase()}` : this.goal.completionBanner);
    // boss-finale arenas bloom the crop circle when the Node charges (see beginBossFinale),
    // not here — avoid a double bloom.
    if (this.arena.biome === 'orchard' && !this.arena.bossFinale) this.cropBloom();
  }

  private quietRoutePressure(): void {
    (this.enemyShots.getChildren() as Projectile[]).forEach((b) => b.active && b.kill());
    this.cipherZones.forEach((zone) => zone.gfx.destroy());
    this.cipherZones = [];
    ([...(this.enemies.getChildren() as SweepEnemy[])]).forEach((en) => {
      if (!en.active) return;
      this.fx.sparks(en.x, en.y, P.signalGreen, 4);
      this.removeEnemy(en);
    });
    this.eliteBeam?.clear();
    this.eliteAura?.destroy();
    this.eliteAura = undefined;
    this.elite = undefined;
    this.bossActive = false;
    this.fx.scanRing(this.nodePos.x, this.nodePos.y, 180, 560, P.signalGreen);
    this.fx.floatText(this.nodePos.x, this.nodePos.y - 20, 'ROUTE CLEAR', P.signalGreen);
    this.updateRouteMarkerVisibility();
  }

  private disableMotelScannersForRouteOpen(): void {
    if (this.arena.id !== 'circuit-z2') return;
    this.motelScanners.forEach((s) => {
      s.disabled = true;
      s.line.clear();
      s.text.setVisible(false);
      s.emitter.setVisible(false);
      s.receiver.setVisible(false);
    });
    this.motelAlertUntil = 0;
    this.motelAlertCooldownUntil = 0;
  }

  private maybeAwardMotelStealthBonus(): void {
    if (this.arena.id !== 'circuit-z2') return;
    const status = this.motelScannerStatus();
    if (status.total <= 0 || status.disabled < status.total || this.motelAlertCount > 0) return;
    const key = 'motel:ghost-checkin-bonus';
    let awarded = false;
    updateSave((s) => {
      if (s.rewards.awarded.includes(key)) return;
      s.rewards.awarded.push(key);
      awarded = true;
    });
    if (!awarded) return;
    const bonus = 25;
    addShards(bonus);
    audio.badgePickup();
    this.fx.scanRing(this.player.x, this.player.y, 76, 420, P.neonCyan);
    this.fx.floatText(this.player.x, this.player.y - 18, `GHOST CHECK-IN +${bonus}`, P.neonCyan);
    bus.emit(EVT.toast, { text: `GHOST CHECK-IN BONUS - all scanners phased offline without alert. +${bonus} shards.`, color: 'cyan' });
  }

  /** Zone 4 standout: charging the node blooms the route you traced into a giant
   *  glowing crop circle burned across the corn — "you drew the answer." */
  private cropBloom(): void {
    const { x, y } = this.nodePos;
    this.fx.flash(P.cropGlow, 220);
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

  private awardRegionReward(): void {
    const goal = this.goal;
    const now = new Date().toISOString();
    let newlyAwarded = false;
    updateSave((s) => {
      if (!s.purchasedUpgrades.includes(goal.rewardId)) {
        s.purchasedUpgrades.push(goal.rewardId);
        newlyAwarded = true;
      }
      if (!s.rewards.owned.includes(goal.rewardId)) s.rewards.owned.push(goal.rewardId);
      if (!s.rewards.awarded.includes(`region:${goal.rewardId}`)) s.rewards.awarded.push(`region:${goal.rewardId}`);
      s.rewards.recent = [
        { id: goal.rewardId, rarity: goal.rewardType, at: now },
        ...s.rewards.recent.filter((r) => r.id !== goal.rewardId),
      ].slice(0, 8);
      if ((goal.rewardId === 'emp-burst' || goal.rewardId === 'phase-drift-plus') && !s.unlockedAbilities.includes('phase-shift')) s.unlockedAbilities.push('phase-shift');
    });
    if (!newlyAwarded) return;
    audio.badgePickup();
    this.fx.flash(P.signal, 150);
    this.fx.scanRing(this.player.x, this.player.y, 96, 460, P.signal);
    this.fx.floatText(this.player.x, this.player.y - 16, goal.rewardName.toUpperCase(), P.signal);
    if (this.suppressRewardModalOnce) {
      this.suppressRewardModalOnce = false;
      return;
    }
    if (goal.rewardId === 'pulse-resonance') {
      this.openMillerMutationChoice();
      return;
    }
    bus.emit(EVT.rewardBanner, {
      kind: 'region-reward',
      title: goal.rewardName.toUpperCase(),
      sub: goal.rewardType.toUpperCase(),
      desc: goal.rewardDescription,
      color: this.regionRewardColor(),
      icon: this.regionRewardIcon(),
      rarity: goal.rewardType === 'Major story unlock' ? 'mythic' : 'epic',
      big: true,
    });
  }

  private openMillerMutationChoice(): void {
    bus.emit(EVT.rewardChoice, {
      title: 'Willow Cache Recovered',
      prompt: 'The Scouts left three unstable blueprints. Choose one permanent mutation now; the others can return later through secrets or the Workbench.',
      color: '#35d5ff',
      options: [
        {
          id: 'pulse-overchain',
          name: 'Overchain Capacitor',
          type: 'Pulse mutation',
          desc: 'Charged Pulse Carbine shots chain farther through exposed enemies. Best if you like ranged control.',
          icon: 'pulse',
          color: '#a8ff3e',
        },
        {
          id: 'arc-shockwave',
          name: 'Arc Reprisal',
          type: 'Arc mutation',
          desc: 'Arc Blade parries release a close shockwave. Best if you like risky timing and melee pressure.',
          icon: 'echo',
          color: '#b06bff',
        },
        {
          id: 'recall-conduit',
          name: 'Recall Conduit',
          type: 'Recall mutation',
          desc: 'Recall Disc leaves damaging blue lightning on the return path. Best if you like positioning.',
          icon: 'relic',
          color: '#f2a93b',
        },
      ],
      onChoose: (id: string) => this.grantMutationChoice(id),
    });
  }

  private grantMutationChoice(id: string): void {
    const allowed = new Set(['pulse-overchain', 'arc-shockwave', 'recall-conduit']);
    if (!allowed.has(id)) return;
    const names: Record<string, string> = {
      'pulse-overchain': 'OVERCHAIN CAPACITOR',
      'arc-shockwave': 'ARC REPRISAL',
      'recall-conduit': 'RECALL CONDUIT',
    };
    let newlyAwarded = false;
    updateSave((s) => {
      if (!s.purchasedUpgrades.includes(id)) {
        s.purchasedUpgrades.push(id);
        newlyAwarded = true;
      }
      if (!s.rewards.owned.includes(id)) s.rewards.owned.push(id);
      if (!s.rewards.awarded.includes(`mutation:${id}`)) s.rewards.awarded.push(`mutation:${id}`);
      s.rewards.recent = [
        { id, rarity: 'Weapon mutation', at: new Date().toISOString() },
        ...s.rewards.recent.filter((r) => r.id !== id),
      ].slice(0, 8);
    });
    if (!newlyAwarded) return;
    this.fx.scanRing(this.player.x, this.player.y, 108, 480, P.signal);
    this.fx.floatText(this.player.x, this.player.y - 22, names[id], P.signal);
    bus.emit(EVT.rewardBanner, {
      kind: 'mutation-choice',
      title: names[id],
      sub: 'PERMANENT MUTATION',
      desc: 'This choice changes how your current route plays. Future Scout caches can unlock the other branches.',
      color: id === 'pulse-overchain' ? '#a8ff3e' : id === 'arc-shockwave' ? '#b06bff' : '#f2a93b',
      icon: id === 'pulse-overchain' ? 'pulse' : id === 'arc-shockwave' ? 'echo' : 'relic',
      rarity: 'epic',
      big: true,
    });
  }

  private regionRewardColor(): string {
    if (this.goal.rewardId.includes('pulse') || this.goal.rewardId.includes('carbine')) return '#a8ff3e';
    if (this.goal.rewardId === 'emp-burst' || this.goal.rewardId === 'phase-drift-plus') return '#3df0ff';
    if (this.goal.rewardId === 'ghost-protocol' || this.goal.rewardId === 'relay-pylon') return '#b06bff';
    if (this.goal.rewardId === 'refuse-label') return '#ff4b5c';
    return '#f2a93b';
  }

  private regionRewardIcon(): string {
    if (this.goal.rewardId.includes('pulse') || this.goal.rewardId.includes('carbine')) return 'pulse';
    if (this.goal.rewardId === 'emp-burst' || this.goal.rewardId === 'phase-drift-plus') return 'badge';
    if (this.goal.rewardId === 'ghost-protocol' || this.goal.rewardId === 'relay-pylon') return 'echo';
    if (this.goal.rewardId === 'refuse-label') return 'trophy-refuse';
    return 'relic';
  }

  /** Single funnel for every enemy spawn — guarantees the HD rig is attached no
   *  matter which code path created the drone (waves, authored, splits, adds). */
  private addEnemy(e: SweepEnemy): SweepEnemy {
    this.enemies.add(e);
    if (this.td) {
      const art = TD_ENEMY_TEX[e.kind];
      const isBoss = e.getData('boss') === true;
      const isElite = e.getData('elite') === true;
      const hitbox = isBoss ? 36 : isElite ? 34 : 28;
      this.tdRigs.set(
        e,
        new ActorRig(this, e, {
          body: art.body,
          emissive: art.emis,
          emissiveColor: TD_PALETTE.danger,
          // dimmed from the 0.72/0.18 default (player look) — full-tint ADD-blend
          // was amplifying the new HD emissive art's scattered rim-light flecks
          // into a noisy red halo that visually oversold each drone's real
          // (unchanged, 11x11) hitbox. Enemy-only; player/node untouched.
          emissiveAlpha: 0.4,
          emissivePulse: 0.1,
          px: TD_VISUALS.actorPx.drone,
          collisionPx: { w: hitbox, h: hitbox },
          lift: 10, // drones hover — their shadow detaches and softens
          lighting: this.tdLight,
          // trimmed from 54/0.22 alongside the 2026-07 HD enemy art replacement —
          // the new sprites' own emissive layer already reads brighter, and
          // several drones' point-lights stacking at combat range was blowing
          // out into the player's sprite. Enemy-only knob (player/node untouched).
          lightRadius: 42,
          lightColor: TD_PALETTE.danger,
          lightIntensity: 0.16,
        })
      );
    }
    return e;
  }

  private removeEnemy(en: SweepEnemy): void {
    const rig = this.tdRigs.get(en);
    rig?.destroy();
    this.tdRigs.delete(en);
    (en.getData('gravitonGfx') as Phaser.GameObjects.Graphics | undefined)?.destroy();
    this.cipherZones = this.cipherZones.filter((zone) => {
      if (zone.caster !== en) return true;
      zone.gfx.destroy();
      return false;
    });
    const body = en.body as Phaser.Physics.Arcade.Body | null;
    body?.stop();
    if (body) body.enable = false;
    en.setActive(false).setVisible(false);
    this.enemies.remove(en, true, true);
  }

  private activeEnemyCount(): number {
    return (this.enemies.getChildren() as SweepEnemy[]).filter((en) => {
      const body = en.body as Phaser.Physics.Arcade.Body | null;
      return en.active && en.hp > 0 && body?.enable !== false;
    }).length;
  }

  /** charge the local objective; opens the breach only after enough distinct progress actions. */
  private addObjectiveProgress(x: number, y: number, amount: number, label = '+CHARGE'): void {
    if (!this.traverse || this.breachOpen || this.nodeFull) return;
    this.objectiveProgressCount++;
    const gravityLocked = this.arena.id === 'maze-z4' && this.gravityWell && !this.gravityWell.used;
    const preWellCap = gravityLocked ? Math.max(1, Math.floor(this.chargeTarget * 0.72)) : this.chargeTarget;
    this.nodeCharge = Math.min(preWellCap, this.nodeCharge + amount);
    if (label) this.fx.floatText(x, y - 6, label, P.signalGreen);
    if (gravityLocked && this.nodeCharge >= preWellCap && this.time.now >= this.orchardGateWarnAt) {
      this.orchardGateWarnAt = this.time.now + 2400;
      this.fx.floatText(this.nodePos.x, this.nodePos.y - 26, 'GRAVITY WELL FIRST', P.warning);
      bus.emit(EVT.toast, { text: 'The Crop Circle is primed. Enter the Gravity Well to open it.', color: 'orange' });
      this.emitHudStats();
      return;
    }
    const minActions = this.arena.minObjectiveActions ?? 0;
    if (this.maybeCompleteTraverseObjective()) {
      return;
    } else if (this.nodeCharge >= this.chargeTarget && minActions > 0) {
      this.fx.floatText(this.nodePos.x, this.nodePos.y - 26, `SIGNALS ${this.objectiveProgressCount}/${minActions}`, P.warning);
    }
  }

  /** charge the Node from a kill (double near the node). */
  private addNodeCharge(x: number, y: number): void {
    const near = Phaser.Math.Distance.Between(x, y, this.nodePos.x, this.nodePos.y) < SWEEP.nodeChargeRadius;
    this.addObjectiveProgress(x, y, SWEEP.nodeChargePerKill * (near ? 2 : 1), near ? '+CHARGE' : '');
  }

  private motelScannerStatus(): { disabled: number; total: number } {
    const total = this.motelScanners.length;
    const disabled = this.motelScanners.filter((s) => s.disabled === true).length;
    return { disabled, total };
  }

  /** Zone-4 finale — the charged Node wakes the Maze Heart boss; breach gates on its death. */
  private beginBossFinale(): void {
    audio.bossWarning();
    this.fx.flash(P.danger, 200);
    if (this.arena.biome === 'orchard') this.cropBloom();
    bus.emit(EVT.toast, { text: 'THE MAZE HEART AWAKENS — DESTROY IT', color: 'orange' });
    this.showBanner('THE MAZE HEART AWAKENS');
    this.breachLabel?.setText('BREACH · SEALED').setColor(css(P.danger));
    this.spawnBoss();
  }

  /** the Maze Heart — an enhanced Classifier construct (reuses the elite beam machinery). */
  private spawnBoss(): void {
    const p = this.nearestWalkableWorld(this.nodePos.x, this.nodePos.y);
    const e = new SweepEnemy(this, p.x, p.y, 'drifter');
    e.setTexture(TEX.sweepMazeHeart);
    e.hp = SWEEP_BOSS.hp;
    e.maxHp = SWEEP_BOSS.hp;
    e.setDepth(16);
    (e.body as Phaser.Physics.Arcade.Body).setSize(34, 34, true);
    e.setData('elite', true).setData('boss', true);
    this.eliteAura = this.add.image(e.x, e.y, TEX.glow8).setDepth(15).setTint(P.danger).setBlendMode(Phaser.BlendModes.ADD).setScale(3).setAlpha(0.45);
    this.tweens.add({ targets: this.eliteAura, alpha: { from: 0.3, to: 0.62 }, scale: { from: 2.6, to: 3.4 }, duration: 640, yoyo: true, repeat: -1 });
    this.addEnemy(e);
    this.elite = e;
    this.eliteBeam = this.add.graphics().setDepth(17);
    this.eliteCfg = SWEEP_BOSS;
    this.eliteState = 'idle';
    this.eliteStateAt = this.time.now + SWEEP_BOSS.beamPeriodMs;
    this.bossActive = true;
    this.bossAddsSpawned = false;
  }

  /** the Maze Heart is destroyed — the triumphant climax before the route opens. */
  private onBossDefeated(x: number, y: number): void {
    this.bossActive = false;
    this.eliteBeam?.clear();
    // triumphant climax — crop-glow flash, layered explosions + a signal ring
    this.fx.flash(P.cropGlow, 260);
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
    this.openBreach(); // now the breach lights -> reach it to route onward to the Orchard
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

  private buildFieldEvents(): void {
    const T = SWEEP.tile;
    (this.arena.fieldEvents ?? []).forEach((def) => {
      const p = this.nearestWalkableWorld((def.tx + 0.5) * T, (def.ty + 0.5) * T);
      const tint = this.fieldEventColor(def);
      const actionLabel = this.fieldEventActionLabel(def);
      const marker = this.add
        .image(p.x, p.y, TEX.glow8)
        .setDepth(11)
        .setTint(tint)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(def.trigger === 'scan' ? 0.82 : 0.96)
        .setAlpha(def.trigger === 'scan' ? 0.28 : 0.36);
      const label = this.add
        .text(p.x, this.pickupLabelY(p.x, p.y, 24), `${def.label}\n${actionLabel}`, {
          fontFamily: 'monospace',
          fontSize: '6px',
          fontStyle: 'bold',
          color: css(P.cream),
          align: 'center',
          backgroundColor: 'rgba(5,8,14,0.76)',
          padding: { x: 4, y: 3 },
        })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(13)
        .setAlpha(def.trigger === 'scan' ? 0.74 : 0.9);
      this.tweens.add({
        targets: marker,
        scale: { from: marker.scale * 0.84, to: marker.scale * 1.18 },
        alpha: { from: marker.alpha * 0.72, to: Math.min(0.72, marker.alpha * 1.34) },
        duration: def.trigger === 'scan' ? 1100 : 760,
        yoyo: true,
        repeat: -1,
      });
      this.fieldEventObjects.push({ def, x: p.x, y: p.y, marker, label, claimed: false });
    });
  }

  private fieldEventColor(def: SweepFieldEvent): number {
    if (def.scout) return SCOUT_TINT[def.scout];
    const weapon = def.wid ? (WEAPONS as Record<string, SweepWeapon>)[def.wid] : undefined;
    if (def.reward === 'weapon' && weapon) return weapon.tint;
    if (def.reward === 'health') return P.signalGreen;
    if (def.reward === 'overdrive') return P.warning;
    if (def.reward === 'defense') return P.scoutChip;
    if (def.reward === 'upgrade') return P.scoutCameron;
    return P.violetGlitch;
  }

  private fieldEventActionLabel(def: SweepFieldEvent): string {
    if (!this.fieldEventAvailable(def)) return 'RIDGE LOCKED';
    if (def.id === 'crash-site-core') return 'WAKE';
    if (def.id === 'spark-line') return 'SCAN TO JOLT';
    if (def.id === 'first-kit-cache') return 'RECOVER';
    if (def.reward === 'health') return 'RECOVERY';
    if (def.reward === 'weapon') return def.wid ? `${String(def.wid).toUpperCase()} WEAPON` : 'WEAPON';
    if (def.reward === 'overdrive') return 'OVERDRIVE';
    if (def.reward === 'boon') return 'SCOUT TECH';
    if (def.reward === 'shards') return 'CACHE';
    if (def.reward === 'defense') return 'DEFENSE KIT';
    if (def.reward === 'upgrade') return 'UPGRADE';
    return def.trigger === 'scan' ? 'SCAN' : 'ACTIVATE';
  }

  private fieldEventAvailable(def: SweepFieldEvent): boolean {
    if (def.requiresGravityWell && this.arena.id === 'maze-z4' && !this.gravityWell?.used) return false;
    return true;
  }

  private refreshFieldEventAvailability(): void {
    this.fieldEventObjects.forEach((event) => {
      if (event.claimed) return;
      event.label.setText(`${event.def.label}\n${this.fieldEventActionLabel(event.def)}`);
      event.marker.setAlpha(this.fieldEventAvailable(event.def) ? (event.def.trigger === 'scan' ? 0.28 : 0.36) : 0.16);
    });
  }

  private triggerScanFieldEvents(x: number, y: number, radius: number): void {
    this.fieldEventObjects.forEach((event) => {
      if (event.claimed || event.def.trigger !== 'scan') return;
      if (!this.fieldEventAvailable(event.def)) return;
      if (Phaser.Math.Distance.Between(x, y, event.x, event.y) <= radius) this.claimFieldEvent(event);
    });
  }

  private updateEnterFieldEvents(): void {
    this.fieldEventObjects.forEach((event) => {
      if (event.claimed || event.def.trigger !== 'enter') return;
      if (!this.fieldEventAvailable(event.def)) return;
      const r = event.def.radius ?? 52;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, event.x, event.y) <= r) this.claimFieldEvent(event);
    });
  }

  private claimFieldEvent(event: { def: SweepFieldEvent; x: number; y: number; marker: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; claimed: boolean }): void {
    if (event.claimed) return;
    event.claimed = true;
    const def = event.def;
    if (!this.fieldEventAvailable(def)) {
      event.claimed = false;
      this.fx.floatText(event.x, event.y - 14, 'LOCKED BY RIDGE SIGNAL', P.warning);
      bus.emit(EVT.toast, { text: 'The Scout shelter will not open until the Gravity Well proves the ridge route.', color: 'orange' });
      return;
    }
    const tint = this.fieldEventColor(def);
    audio.fragmentPickup();
    this.fx.scanRing(event.x, event.y, 82, 420, tint);
    this.fx.sparks(event.x, event.y, tint, 10);
    this.fx.floatText(event.x, event.y - 10, def.label, tint);
    if (def.message) bus.emit(EVT.toast, { text: def.message, color: def.reward === 'health' ? 'green' : def.reward === 'overdrive' ? 'orange' : 'cyan' });
    this.tweens.add({ targets: [event.marker, event.label], alpha: 0, scale: 1.9, duration: 320, onComplete: () => { event.marker.destroy(); event.label.destroy(); } });
    if (def.charge) this.addObjectiveProgress(event.x, event.y, def.charge, '+SIGNAL');
    if (def.shards) {
      addShards(def.shards);
      this.shardsEarned += def.shards;
      this.fx.floatText(event.x, event.y + 6, `+${def.shards} FRAGMENTS`, P.violetGlitch);
    }
    switch (def.reward) {
      case 'boon':
        this.time.delayedCall(140, () => this.dropBoon(event.x, event.y, def.scout));
        break;
      case 'health':
        this.time.delayedCall(140, () => this.dropHealthPickup(event.x, event.y, true));
        break;
      case 'weapon':
        this.time.delayedCall(140, () => this.dropWeaponPickup(event.x, event.y, def.wid ?? 'pulse', true));
        break;
      case 'overdrive':
        this.overdrive = SWEEP.overdriveMax;
        this.fx.floatText(event.x, event.y + 8, 'OVERDRIVE READY', P.warning);
        this.emitHudStats();
        break;
      case 'defense':
        this.deployScoutPylons(event.x, event.y);
        break;
      case 'upgrade':
        this.grantFieldUpgrade(def, event.x, event.y);
        break;
    }
    this.trackStormRelay(event);
    this.trackMillerCrashIntro(event);
    (def.spawns ?? []).forEach((m, i) => {
      this.time.delayedCall(240 + i * 160, () => {
        const T = SWEEP.tile;
        const p = this.nearestWalkableWorld((m.tx + 0.5) * T, (m.ty + 0.5) * T);
        this.fx.sparks(p.x, p.y, P.danger, 6);
        this.addEnemy(new SweepEnemy(this, p.x, p.y, m.type));
      });
    });
  }

  private isMillerCrashIntroComplete(): boolean {
    return loadSave().rewards.awarded.includes(MILLER_CRASH_INTRO_AWARD);
  }

  private isMillerCrashIntroPending(): boolean {
    return this.arena?.id === 'surface-z1' && !this.breachOpen && !this.isMillerCrashIntroComplete();
  }

  private currentMillerCrashIntroEvent(): { def: SweepFieldEvent; x: number; y: number; marker: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; claimed: boolean } | null {
    if (!this.isMillerCrashIntroPending()) return null;
    for (const id of MILLER_CRASH_INTRO_EVENTS) {
      const event = this.fieldEventObjects.find((candidate) => candidate.def.id === id && !candidate.claimed);
      if (event) return event;
    }
    return null;
  }

  private currentMillerCrashIntroHint(): string {
    const target = this.currentMillerCrashIntroEvent();
    switch (target?.def.id) {
      case 'crash-site-core':
        return 'Wake CONTACT-47 at the impact crater and read the Scout tag.';
      case 'spark-line':
        return 'Scan the broken Spark Line to restore movement power.';
      case 'first-kit-cache':
        return 'Recover the first kit, then follow Willow Trail toward the cache.';
      default:
        return 'Follow Willow Trail and find the buried Scout cache.';
    }
  }

  private trackMillerCrashIntro(event: { def: SweepFieldEvent; x: number; y: number }): void {
    if (this.arena.id !== 'surface-z1' || !MILLER_CRASH_INTRO_SET.has(event.def.id)) return;
    if (event.def.id !== 'first-kit-cache') {
      this.emitHudStats();
      return;
    }
    updateSave((s) => {
      if (!s.rewards.awarded.includes(MILLER_CRASH_INTRO_AWARD)) s.rewards.awarded.push(MILLER_CRASH_INTRO_AWARD);
      if (!s.completedQuestSteps.includes('crash-site-first-kit')) s.completedQuestSteps.push('crash-site-first-kit');
      s.questStep = 'recover-willow-cache';
      s.currentQuest = 'the-first-contact';
    });
    this.fx.scanRing(event.x, event.y, 150, 650, P.scoutWill);
    bus.emit(EVT.rewardBanner, {
      kind: 'story',
      title: 'FIRST KIT RECOVERED',
      sub: 'THE FIVE SIGNAL SCOUTS',
      desc: "Willow and Chip left proof that CONTACT-47 can protect Chagrin Falls. The field wakes up between you and Willow's cache.",
      color: css(P.scoutWill),
      icon: 'badge',
      rarity: 'story',
      big: true,
    });
    this.time.delayedCall(650, () => {
      if (!this.scene.isActive() || this.introEnemiesSeeded) return;
      this.seedEnemies();
      this.introEnemiesSeeded = true;
      this.fx.scanRing(this.player.x, this.player.y, 210, 620, P.danger);
      bus.emit(EVT.toast, { text: "FIELD WAKE - reach Willow's cache before the classifiers lock on.", color: 'orange' });
      this.emitHudStats();
    });
  }

  private deployScoutPylons(x: number, y: number): void {
    const offsets = [
      { x: -34, y: -12 },
      { x: 34, y: -12 },
      { x: 0, y: 34 },
    ];
    const pylons = offsets.map((o) => {
      const base = this.add.rectangle(x + o.x, y + o.y, 15, 22, P.scoutChip, 0.42).setDepth(13).setStrokeStyle(1, P.cream, 0.35);
      const core = this.add.image(x + o.x, y + o.y - 12, TEX.glow8).setDepth(14).setTint(P.scoutChip).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35);
      return { base, core, x: x + o.x, y: y + o.y - 12 };
    });
    this.fx.scanRing(x, y, 120, 520, P.scoutChip);
    this.fx.floatText(x, y - 24, 'SCOUT RELAY ONLINE', P.scoutChip);
    const zap = this.time.addEvent({
      delay: 340,
      repeat: 25,
      callback: () => {
        pylons.forEach((pylon) => {
          let target: SweepEnemy | null = null;
          let best = 230 * 230;
          (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
            if (!en.active) return;
            const d = Phaser.Math.Distance.Squared(pylon.x, pylon.y, en.x, en.y);
            if (d < best && this.hasWalkableLine(pylon.x, pylon.y, en.x, en.y)) {
              best = d;
              target = en;
            }
          });
          if (!target) return;
          const en = target as SweepEnemy;
          const line = this.add.line(0, 0, pylon.x, pylon.y, en.x, en.y, P.scoutChip, 0.55).setOrigin(0).setDepth(24);
          this.time.delayedCall(80, () => line.destroy());
          this.fx.sparks(en.x, en.y, P.scoutChip, 4);
          if (this.applyEnemyDamage(en, 0.65, pylon.x, pylon.y, 140, 'arc')) this.killEnemy(en);
        });
      },
    });
    this.time.delayedCall(9600, () => {
      zap.remove(false);
      pylons.forEach((pylon) => {
        this.tweens.add({ targets: [pylon.base, pylon.core], alpha: 0, duration: 220, onComplete: () => { pylon.base.destroy(); pylon.core.destroy(); } });
      });
    });
  }

  private grantFieldUpgrade(def: SweepFieldEvent, x: number, y: number): void {
    const id = def.upgradeId;
    if (!id) return;
    let newlyAwarded = false;
    updateSave((s) => {
      if (!s.purchasedUpgrades.includes(id)) {
        s.purchasedUpgrades.push(id);
        newlyAwarded = true;
      }
      if (!s.rewards.owned.includes(id)) s.rewards.owned.push(id);
      if (!s.rewards.awarded.includes(`field:${id}`)) s.rewards.awarded.push(`field:${id}`);
      s.rewards.recent = [
        { id, rarity: 'Scout upgrade', at: new Date().toISOString() },
        ...s.rewards.recent.filter((r) => r.id !== id),
      ].slice(0, 8);
    });
    if (!newlyAwarded) return;
    this.fx.scanRing(x, y, 112, 480, P.scoutCameron);
    this.fx.floatText(x, y - 18, String(def.upgradeName ?? id).toUpperCase(), P.scoutCameron);
    bus.emit(EVT.rewardBanner, {
      kind: 'field-upgrade',
      title: String(def.upgradeName ?? id).toUpperCase(),
      sub: 'SCOUT UPGRADE',
      desc: def.upgradeDescription ?? 'A Scout device permanently changes what CONTACT-47 can read in the world.',
      color: css(P.scoutCameron),
      icon: 'badge',
      rarity: 'epic',
      big: true,
    });
  }

  private trackStormRelay(event: { def: SweepFieldEvent; x: number; y: number }): void {
    if (this.arena.id !== 'anomaly-01') return;
    if (event.def.id !== 'west-relay-cache' && event.def.id !== 'east-relay-cache') return;
    this.stormRelaysActivated.add(event.def.id);
    const done = this.stormRelaysActivated.size;
    this.fx.floatText(event.x, event.y - 26, `RELAY ${done}/2`, P.neonCyan);
    bus.emit(EVT.toast, { text: `Relay Wing stabilized ${done}/2.`, color: done >= 2 ? 'green' : 'cyan' });
    this.emitHudStats();
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
    const p = this.nearestWalkableWorld((m.tx + 0.5) * T, (m.ty + 0.5) * T);
    const e = new SweepEnemy(this, p.x, p.y, 'drifter');
    e.setTexture(TEX.sweepElite);
    e.hp = SWEEP_ELITE.hp;
    e.maxHp = SWEEP_ELITE.hp;
    e.setDepth(16);
    (e.body as Phaser.Physics.Arcade.Body).setSize(32, 32, true);
    e.setData('elite', true);
    // menacing threat glow around the elite
    this.eliteAura = this.add.image(e.x, e.y, TEX.glow8).setDepth(15).setTint(P.danger).setBlendMode(Phaser.BlendModes.ADD).setScale(2).setAlpha(0.4);
    this.tweens.add({ targets: this.eliteAura, alpha: { from: 0.25, to: 0.55 }, scale: { from: 1.8, to: 2.4 }, duration: 700, yoyo: true, repeat: -1 });
    this.addEnemy(e);
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
      if (this.player.alive && !this.player.invulnerable && now >= this.entryGraceUntil) {
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
      const p = this.nearestWalkableWorld(x + Math.cos(a) * 34, y + Math.sin(a) * 34);
      this.fx.sparks(p.x, p.y, P.danger, 6);
      this.addEnemy(new SweepEnemy(this, p.x, p.y, kind as SweepEnemyKind));
    });
  }

  private dropBoon(x: number, y: number, scoutOverride?: string): void {
    const scout = scoutOverride ?? Phaser.Utils.Array.GetRandom(['will', 'chip', 'henry', 'cameron', 'danny']);
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
        this.setWeapon(WEAPONS.pulse, 'boon');
        this.fx.floatText(p.x, p.y - 10, 'SPARK', P.scoutChip);
        bus.emit(EVT.toast, { text: 'SPARK — “Carbine tuned. Go go go!”', color: 'orange' });
        break;
      case 'henry':
        p.heal(99);
        p.grantShield(SWEEP.boonShieldMs);
        this.fx.floatText(p.x, p.y - 10, 'ANCHOR', P.scoutHenry);
        bus.emit(EVT.toast, { text: 'ANCHOR — “I’ve got you. Catch your breath.”', color: 'green' });
        break;
      case 'cameron':
        this.setWeapon(WEAPONS.arc, 'boon');
        this.fx.floatText(p.x, p.y - 10, 'ECHO', P.scoutCameron);
        bus.emit(EVT.toast, { text: 'ECHO — “Arc Blade. Get close, then cut through.”', color: 'cyan' });
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
      const p = this.nearestWalkableWorld(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
      const shard = new SweepEnemy(this, p.x, p.y, 'drifter');
      shard.hp = 1;
      shard.maxHp = 1;
      shard.setScale(0.7).setTint(P.violetGlitch);
      (shard.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(a) * 90, Math.sin(a) * 90);
      this.addEnemy(shard);
    }
  }

  private seedEnemies(): void {
    const T = SWEEP.tile;
    // authored placements — enemies live in the rooms/corridors the designer chose
    (this.arena.enemies ?? []).forEach((m) => {
      const p = this.nearestWalkableWorld((m.tx + 0.5) * T, (m.ty + 0.5) * T);
      this.addEnemy(new SweepEnemy(this, p.x, p.y, m.type));
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
    this.showBanner(w.label ?? `WAVE ${this.waveIdx + 1} / ${waves.length}`);
  }

  private shouldHoldStormRelayPhase(now: number): boolean {
    if (this.arena.id !== 'anomaly-01' || this.waveIdx !== 0) return false;
    if (this.stormRelaysActivated.size >= 2) return false;
    if (now >= this.stormRelayWarnAt) {
      this.stormRelayWarnAt = now + 2600;
      const missing = 2 - this.stormRelaysActivated.size;
      this.fx.floatText(this.nodePos.x, this.nodePos.y - 28, `RELAY WINGS ${this.stormRelaysActivated.size}/2`, P.neonCyan);
      bus.emit(EVT.toast, { text: `Classifier Core exposed. Scan ${missing} Relay Wing${missing === 1 ? '' : 's'} before the North Rift opens.`, color: 'cyan' });
      this.emitHudStats();
    }
    return true;
  }

  private spawnEnemy(kind: SweepEnemyKind): void {
    // waves mode: spawn on a random open floor tile toward the map edges
    const edgeTiles = this.floorTiles.filter(
      (t) => t.x < this.mapW * 0.2 || t.x > this.mapW * 0.8 || t.y < this.mapH * 0.2 || t.y > this.mapH * 0.8
    );
    const pool = edgeTiles.length ? edgeTiles : this.floorTiles;
    const p = pool.length ? Phaser.Utils.Array.GetRandom(pool) : { x: this.mapW / 2, y: 20 };
    this.addEnemy(new SweepEnemy(this, p.x, p.y, kind));
  }

  private nearestWalkableWorld(x: number, y: number): { x: number; y: number } {
    const start = this.tileAt(x, y);
    if (this.isWalkableTile(start.tx, start.ty)) return this.tileCenter(start.tx, start.ty);

    const maxRadius = Math.max(this.arena.grid.w, this.arena.grid.h);
    let best: { tx: number; ty: number; d2: number } | null = null;
    for (let r = 1; r <= maxRadius && !best; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = start.tx + dx;
          const ty = start.ty + dy;
          if (!this.isWalkableTile(tx, ty)) continue;
          const c = this.tileCenter(tx, ty);
          const d2 = Phaser.Math.Distance.Squared(x, y, c.x, c.y);
          if (!best || d2 < best.d2) best = { tx, ty, d2 };
        }
      }
    }

    return best ? this.tileCenter(best.tx, best.ty) : { x: this.mapW / 2, y: this.mapH / 2 };
  }

  private debugCombatLane(): { player: { x: number; y: number }; enemy: { x: number; y: number } } {
    const W = this.arena.grid.w;
    const H = this.arena.grid.h;
    let best = { y: 0, x0: 0, x1: 0, len: 0 };
    for (let ty = 1; ty < H - 1; ty++) {
      let tx = 1;
      while (tx < W - 1) {
        while (tx < W - 1 && !this.isWalkableTile(tx, ty)) tx++;
        const x0 = tx;
        while (tx < W - 1 && this.isWalkableTile(tx, ty)) tx++;
        const len = tx - x0;
        if (len > best.len) best = { y: ty, x0, x1: tx - 1, len };
      }
    }

    if (best.len >= 7) {
      const enemyTx = Math.min(best.x1 - 1, best.x0 + 12);
      return {
        player: this.tileCenter(best.x0 + 1, best.y),
        enemy: this.tileCenter(enemyTx, best.y),
      };
    }
    return {
      player: this.nearestWalkableWorld((this.arena.spawn.tx + 0.5) * SWEEP.tile, (this.arena.spawn.ty + 0.5) * SWEEP.tile),
      enemy: this.nearestWalkableWorld(this.nodePos.x, this.nodePos.y),
    };
  }

  private tileAt(x: number, y: number): { tx: number; ty: number } {
    const T = SWEEP.tile;
    return {
      tx: Phaser.Math.Clamp(Math.floor(x / T), 0, this.arena.grid.w - 1),
      ty: Phaser.Math.Clamp(Math.floor(y / T), 0, this.arena.grid.h - 1),
    };
  }

  private tileCenter(tx: number, ty: number): { x: number; y: number } {
    const T = SWEEP.tile;
    return { x: (tx + 0.5) * T, y: (ty + 0.5) * T };
  }

  private isWalkableTile(tx: number, ty: number): boolean {
    return this.walkableTiles[ty]?.[tx] === true;
  }

  private hasWalkableLine(x1: number, y1: number, x2: number, y2: number): boolean {
    const steps = Math.max(1, Math.ceil(Phaser.Math.Distance.Between(x1, y1, x2, y2) / (SWEEP.tile * 0.45)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = this.tileAt(Phaser.Math.Linear(x1, x2, t), Phaser.Math.Linear(y1, y2, t));
      if (!this.isWalkableTile(p.tx, p.ty)) return false;
    }
    return true;
  }

  private buildEnemyPathField(now: number): number[][] {
    if (this.enemyPathDist.length && now - this.enemyPathBuiltAt < 160) return this.enemyPathDist;
    const W = this.arena.grid.w;
    const H = this.arena.grid.h;
    const dist = Array.from({ length: H }, () => new Array<number>(W).fill(Infinity));
    const start = this.tileAt(this.player.x, this.player.y);
    if (!this.isWalkableTile(start.tx, start.ty)) {
      this.enemyPathDist = dist;
      this.enemyPathBuiltAt = now;
      return dist;
    }

    const qx: number[] = [start.tx];
    const qy: number[] = [start.ty];
    dist[start.ty][start.tx] = 0;
    for (let qi = 0; qi < qx.length; qi++) {
      const tx = qx[qi];
      const ty = qy[qi];
      const next = dist[ty][tx] + 1;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
      for (const [dx, dy] of dirs) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (!this.isWalkableTile(nx, ny) || dist[ny][nx] <= next) continue;
        dist[ny][nx] = next;
        qx.push(nx);
        qy.push(ny);
      }
    }
    this.enemyPathDist = dist;
    this.enemyPathBuiltAt = now;
    return dist;
  }

  private enemyDriveTarget(en: SweepEnemy, pathDist: number[][]): { x: number; y: number; pathing: boolean } {
    if (this.hasWalkableLine(en.x, en.y, this.player.x, this.player.y)) return { x: this.player.x, y: this.player.y, pathing: false };
    const here = this.tileAt(en.x, en.y);
    let bestTx = here.tx;
    let bestTy = here.ty;
    let best = pathDist[here.ty]?.[here.tx] ?? Infinity;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    for (const [dx, dy] of dirs) {
      const tx = here.tx + dx;
      const ty = here.ty + dy;
      const d = pathDist[ty]?.[tx] ?? Infinity;
      if (!this.isWalkableTile(tx, ty) || d >= best) continue;
      best = d;
      bestTx = tx;
      bestTy = ty;
    }
    if (!Number.isFinite(best)) return { x: this.player.x, y: this.player.y, pathing: false };
    return { ...this.tileCenter(bestTx, bestTy), pathing: true };
  }

  private get aggro(): number {
    return this.heat >= SWEEP.heatRampAt[1] ? 1.35 : this.heat >= SWEEP.heatRampAt[0] ? 1.15 : 1;
  }

  /* ------------------------------- firing -------------------------------- */
  setWeapon(wp: SweepWeapon, announce: WeaponAnnounce = 'switch'): void {
    this.weapon = wp;
    const idx = WEAPON_LOADOUT.findIndex((id) => id === wp.id);
    if (idx >= 0) this.weaponIndex = idx;
    if (announce !== 'quiet') {
      const prefix = announce === 'pickup' ? 'EQUIPPED' : announce === 'boon' ? 'TUNED' : 'WEAPON';
      bus.emit(EVT.toast, { text: `${prefix}: ${wp.name}`, color: announce === 'pickup' ? 'cyan' : 'green' });
      this.fx.floatText(this.player.x, this.player.y - 18, wp.name, wp.glow);
    }
    this.emitHudStats();
  }

  debugSetWeapon(id: string): boolean {
    const wp = WEAPONS[id];
    if (!wp) return false;
    this.setWeapon(wp);
    return true;
  }

  debugSwitchWeapon(delta = 1): boolean {
    this.switchWeapon(delta);
    return true;
  }

  debugDamagePlayer(amount = 1): boolean {
    if (!this.player?.active) return false;
    this.player.hp = Math.max(1, this.player.hp - Math.max(0, amount));
    bus.emit(EVT.hudHp, { hp: this.player.hp, max: this.player.maxHp });
    return true;
  }

  debugStartEnemyProbe(kind: SweepEnemyKind): boolean {
    if (!this.player?.active || !SWEEP_ENEMIES[kind]) return false;
    this.debugCombatProbeActive = true;
    resetVirtualInput();
    this.enemies.clear(true, true);
    (this.playerShots.getChildren() as Projectile[]).forEach((b) => b.active && b.kill());
    (this.enemyShots.getChildren() as Projectile[]).forEach((b) => b.active && b.kill());
    this.eliteBeam?.clear();
    this.eliteAura?.destroy();
    this.eliteAura = undefined;
    this.elite = undefined;
    this.bossActive = false;
    this.bossAddsSpawned = false;
    this.heat = 0;
    this.combo = 0;
    this.fireAt = 0;
    this.setWeapon(WEAPONS.pulse);

    const lane = this.debugCombatLane();
    this.player.setPosition(lane.player.x, lane.player.y);
    this.player.setAim(Math.atan2(lane.enemy.y - lane.player.y, lane.enemy.x - lane.player.x));
    this.player.hp = 99;
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setVelocity(0, 0);
    playerBody.setAcceleration(0, 0);
    bus.emit(EVT.hudHp, { hp: this.player.hp, max: this.player.maxHp });

    this.addEnemy(new SweepEnemy(this, lane.enemy.x, lane.enemy.y, kind));
    return true;
  }

  debugCombatSnapshot(): {
    arenaId: string;
    player: { x: number; y: number; hp: number };
    enemies: SweepEnemyDebugState[];
    playerShots: number;
    enemyShots: number;
  } | null {
    if (!this.player?.active) return null;
    return {
      arenaId: this.arena.id,
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y), hp: this.player.hp },
      enemies: (this.enemies.getChildren() as SweepEnemy[]).filter((en) => en.active).map((en) => en.debugState()),
      playerShots: (this.playerShots.getChildren() as Projectile[]).filter((b) => b.active).length,
      enemyShots: (this.enemyShots.getChildren() as Projectile[]).filter((b) => b.active).length,
    };
  }

  debugFireAtProbeEnemy(): boolean {
    if (!this.player?.active) return false;
    const en = (this.enemies.getChildren() as SweepEnemy[]).find((candidate) => candidate.active);
    if (!en) return false;
    this.player.setAim(Math.atan2(en.y - this.player.y, en.x - this.player.x));
    const now = this.time.now;
    if (now >= this.fireAt) this.fire(now);
    return true;
  }

  debugForceDeath(): boolean {
    if (!this.player?.active || this.gameOverShown) return false;
    this.player.hp = 0;
    bus.emit(EVT.hudHp, { hp: 0, max: this.player.maxHp });
    this.onDeath();
    return true;
  }

  debugRuntimeState(): {
    hp: number;
    maxHp: number;
    weaponId: string;
    weaponIndex: number;
    overdrive: number;
    shardsEarned: number;
    nodeCharge: number;
    chargeTarget: number;
      objectiveActions: number;
      objectiveActionsRequired: number;
      gravityWellUsed?: boolean;
      gravityWellRequired?: boolean;
      breachOpen: boolean;
      enemiesActive: number;
      motelAlerts?: number;
      motelScanners?: { disabled: number; total: number };
      boostGaps?: number;
      hoverTrailCount?: number;
      elevationLabel?: string;
      cameraElevationOffsetY?: number;
      cameraElevationZoom?: number;
      elevationZones?: number;
      stormRelays?: { activated: number; required: number };
      crashIntroPending?: boolean;
  } | null {
    if (!this.player?.active) return null;
    const motelScanners = this.motelScannerStatus();
    return {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      weaponId: this.weapon.id,
      weaponIndex: this.weaponIndex,
      overdrive: this.overdrive,
      shardsEarned: this.shardsEarned,
      nodeCharge: this.nodeCharge,
      chargeTarget: this.chargeTarget,
      objectiveActions: this.objectiveProgressCount,
      objectiveActionsRequired: this.arena.minObjectiveActions ?? 0,
      gravityWellUsed: this.gravityWell?.used,
      gravityWellRequired: this.arena.id === 'maze-z4' ? true : undefined,
      breachOpen: this.breachOpen,
      enemiesActive: this.activeEnemyCount(),
      motelAlerts: this.arena.id === 'circuit-z2' ? this.motelAlertCount : undefined,
      motelScanners: motelScanners.total ? motelScanners : undefined,
      boostGaps: this.arena.boostGaps?.length,
      hoverTrailCount: this.hoverTrail.length,
      elevationLabel: this.activeElevationLabel || undefined,
      cameraElevationOffsetY: Math.round(this.cameraElevationOffsetY),
      cameraElevationZoom: Number(this.cameraElevationZoom.toFixed(3)),
      elevationZones: this.arena.elevationZones?.length,
      stormRelays: this.arena.id === 'anomaly-01' ? { activated: this.stormRelaysActivated.size, required: 2 } : undefined,
      crashIntroPending: this.arena.id === 'surface-z1' ? this.isMillerCrashIntroPending() : undefined,
    };
  }

  debugSetPlayerWorldPosition(x: number, y: number): boolean {
    if (!this.player?.active) return false;
    const p = this.nearestWalkableWorld(x, y);
    this.player.setPosition(p.x, p.y);
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    body?.setVelocity(0, 0);
    body?.setAcceleration(0, 0);
    this.cameras.main.centerOn(p.x, p.y);
    return true;
  }

  debugOpenRouteForInspection(): boolean {
    if (!this.traverse || !this.player?.active || this.exiting) return false;
    if (!this.breachOpen) this.openBreach();
    return true;
  }

  debugDisableMotelScannersForInspection(): boolean {
    if (this.arena.id !== 'circuit-z2' || !this.motelScanners.length) return false;
    this.motelScanners.forEach((s) => { s.disabled = true; });
    return true;
  }

  debugAiPerception(): unknown {
    if (!this.player?.active) return null;
    const cam = this.cameras.main;
    const margin = 28;
    const inView = (x: number, y: number): boolean =>
      x >= cam.worldView.x - margin &&
      x <= cam.worldView.right + margin &&
      y >= cam.worldView.y - margin &&
      y <= cam.worldView.bottom + margin;
    const player = { x: Math.round(this.player.x), y: Math.round(this.player.y), hp: this.player.hp, maxHp: this.player.maxHp };
    const seenEnemies = (this.enemies.getChildren() as SweepEnemy[])
      .filter((en) => en.active && inView(en.x, en.y))
      .map((en) => ({
        kind: en.kind,
        x: Math.round(en.x),
        y: Math.round(en.y),
        distance: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, en.x, en.y)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
    const seenPickups = (this.pickups.getChildren() as Phaser.Physics.Arcade.Image[])
      .filter((pk) => pk.active && inView(pk.x, pk.y))
      .map((pk) => ({
        x: Math.round(pk.x),
        y: Math.round(pk.y),
        type: pk.getData('ptype') as string,
        weapon: (pk.getData('wid') as string | undefined) ?? '',
        distance: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, pk.x, pk.y)),
      }))
      .sort((a, b) => a.distance - b.distance);
    const seenCaches = this.caches
      .filter((c) => c.active && c.visible && c.alpha > 0.1 && inView(c.x, c.y))
      .map((c) => ({
        x: Math.round(c.x),
        y: Math.round(c.y),
        distance: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y)),
      }));
    const seenFieldEvents = this.fieldEventObjects
      .filter((event) => !event.claimed && inView(event.x, event.y))
      .map((event) => ({
        x: Math.round(event.x),
        y: Math.round(event.y),
        label: event.def.label,
        trigger: event.def.trigger,
        reward: event.def.reward ?? '',
        distance: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, event.x, event.y)),
      }))
      .sort((a, b) => a.distance - b.distance);
    const seenScanners = this.motelScanners
      .filter((s) => !(this.breachOpen && s.disabled) && inView((s.ax + s.bx) / 2, (s.ay + s.by) / 2))
      .map((s) => {
        const x = (s.ax + s.bx) / 2;
        const y = (s.ay + s.by) / 2;
        return {
          x: Math.round(x),
          y: Math.round(y),
          label: s.disabled ? 'SCANNER OFFLINE' : s.label,
          disabled: s.disabled === true,
          alert: this.time.now < this.motelAlertUntil,
          distance: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y)),
        };
      })
      .sort((a, b) => a.distance - b.distance);
    const objectiveTarget = this.currentObjectiveTarget();
    return {
      arena: { id: this.arena.id, label: this.arena.label, mode: this.arena.mode, zoneId: this.arena.zoneId ?? '' },
      player,
      weapon: { id: this.weapon.id, name: this.weapon.name },
      progress: {
        node: Math.round(Phaser.Math.Clamp(this.nodeCharge / this.chargeTarget, 0, 1) * 100),
        objectiveActions: this.objectiveProgressCount,
        objectiveActionsRequired: this.arena.minObjectiveActions ?? 0,
        gravityWellUsed: this.gravityWell?.used,
        gravityWellRequired: this.arena.id === 'maze-z4' ? true : undefined,
        stormRelays: this.arena.id === 'anomaly-01' ? { activated: this.stormRelaysActivated.size, required: 2 } : undefined,
        breachOpen: this.breachOpen,
        enemiesActive: this.activeEnemyCount(),
        overdrive: Math.round(Phaser.Math.Clamp(this.overdrive / SWEEP.overdriveMax, 0, 1) * 100),
      },
      objective: {
        title: this.isMillerCrashIntroPending()
          ? 'Crash-site recovery'
          : this.traverse ? (this.breachOpen ? 'Route open' : this.goal.objective) : this.goal.objective,
        hint: this.isMillerCrashIntroPending()
          ? this.currentMillerCrashIntroHint()
          : this.breachOpen ? this.goal.exitHint : this.goal.activeHint,
        reward: this.goal.rewardName,
      },
      visible: {
        enemies: seenEnemies,
        pickups: seenPickups,
        caches: seenCaches,
        signals: seenFieldEvents,
        scanners: seenScanners,
        node: inView(this.nodePos.x, this.nodePos.y)
          ? { x: Math.round(this.nodePos.x), y: Math.round(this.nodePos.y), distance: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, this.nodePos.x, this.nodePos.y)) }
          : null,
        breach: this.arena.breach && inView(this.breachPos.x, this.breachPos.y)
          ? { x: Math.round(this.breachPos.x), y: Math.round(this.breachPos.y), open: this.breachOpen, distance: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, this.breachPos.x, this.breachPos.y)) }
          : null,
      },
      objectiveHint: objectiveTarget
        ? {
            kind: objectiveTarget.kind,
            label: objectiveTarget.label ?? '',
            x: Math.round(objectiveTarget.x),
            y: Math.round(objectiveTarget.y),
            distance: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, objectiveTarget.x, objectiveTarget.y)),
          }
        : null,
    };
  }

  private currentObjectiveTarget(): ObjectiveTarget | null {
    if (!this.traverse && this.arena.id === 'anomaly-01' && this.waveIdx === 0 && this.awaitingWave && this.stormRelaysActivated.size < 2) {
      const relay = this.fieldEventObjects.find((event) =>
        !event.claimed &&
        (event.def.id === 'west-relay-cache' || event.def.id === 'east-relay-cache')
      );
      if (relay) return { kind: 'field-event', label: relay.def.label, x: relay.x, y: relay.y };
    }
    if (!this.traverse) return { kind: 'survive', x: this.nodePos.x, y: this.nodePos.y };
    const introEvent = this.currentMillerCrashIntroEvent();
    if (introEvent) return { kind: 'field-event', label: introEvent.def.label, x: introEvent.x, y: introEvent.y };
    const route = ROUTE_BEACONS[this.arena.id];
    if (this.gravityWell && !this.gravityWell.used && this.arena.id === 'maze-z4') {
      const routedToWell = route ? this.routeBeaconTarget('objective', route.toObjective.filter((m) => m.label !== 'CROP CIRCLE')) : null;
      if (routedToWell) return routedToWell;
      return { kind: 'gravity-well', x: this.gravityWell.x, y: this.gravityWell.y };
    }
    if (this.gravityWell?.used && this.arena.id === 'maze-z4' && !this.breachOpen) {
      const routedToCrop = route ? this.routeBeaconTarget('objective', route.toObjective.filter((m) => m.label === 'CROP CIRCLE')) : null;
      if (routedToCrop) return routedToCrop;
      return { kind: 'node', x: this.nodePos.x, y: this.nodePos.y };
    }
    const nearbyEvent = this.nearbyFieldEventTarget();
    if (nearbyEvent) return nearbyEvent;
    if (this.breachOpen) {
      const breachDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.breachPos.x, this.breachPos.y);
      if (breachDistance < 260) return { kind: 'breach', label: this.arena.nextLabel ?? 'OPEN BREACH', x: this.breachPos.x, y: this.breachPos.y };
    }
    if (route) {
      const routed = this.routeBeaconTarget(this.breachOpen ? 'exit' : 'objective', this.breachOpen ? route.toExit : route.toObjective);
      if (routed) return routed;
    }
    if (this.breachOpen) return { kind: 'breach', label: this.arena.nextLabel ?? 'OPEN BREACH', x: this.breachPos.x, y: this.breachPos.y };
    if (this.gravityWell && !this.gravityWell.used) return { kind: 'gravity-well', label: 'GRAVITY WELL', x: this.gravityWell.x, y: this.gravityWell.y };
    return { kind: 'node', label: this.goal.objective, x: this.nodePos.x, y: this.nodePos.y };
  }

  private nearbyFieldEventTarget(): ObjectiveTarget | null {
    if (!this.fieldEventObjects.length || this.breachOpen) return null;
    let best: { kind: ObjectiveKind; label: string; x: number; y: number; d: number } | null = null;
    for (const event of this.fieldEventObjects) {
      if (event.claimed) continue;
      if (!this.fieldEventAvailable(event.def)) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, event.x, event.y);
      const reach = event.def.trigger === 'scan' ? 170 : event.def.radius ?? 72;
      if (d > reach) continue;
      if (!best || d < best.d) best = { kind: 'field-event', label: event.def.label, x: event.x, y: event.y, d };
    }
    return best ? { kind: best.kind, label: best.label, x: best.x, y: best.y } : null;
  }

  private routeBeaconTarget(phase: 'objective' | 'exit', markers: Array<{ tx: number; ty: number; label: string }>): ObjectiveTarget | null {
    const candidates: Array<{ m: { tx: number; ty: number; label: string }; x: number; y: number; d: number }> = [];
    for (const m of markers) {
      const x = (m.tx + 0.5) * SWEEP.tile;
      const y = (m.ty + 0.5) * SWEEP.tile;
      const key = `${phase}:${m.label}`;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
      const visitRadius = m.label === 'GRAVITY WELL' ? 46 : phase === 'exit' ? 140 : 110;
      if (d <= visitRadius) {
        this.routeVisited.add(key);
        continue;
      }
      if (!this.routeVisited.has(key)) {
        candidates.push({ m, x, y, d });
      }
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.d - b.d);
    const best = candidates[0];
    return { kind: 'route-beacon', label: best.m.label, x: best.x, y: best.y };
  }

  private isHoldingAtOpenBreach(now: number): boolean {
    if (!this.breachOpen || !this.player.alive) {
      this.breachEntryStartedAt = 0;
      return false;
    }
    const inside = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.breachPos.x, this.breachPos.y) < BREACH_ENTRY_RADIUS;
    if (!inside) {
      this.breachEntryStartedAt = 0;
      return false;
    }
    if (!this.breachEntryStartedAt) this.breachEntryStartedAt = now;
    return now - this.breachEntryStartedAt >= BREACH_ENTRY_DWELL_MS;
  }

  private switchWeapon(delta: number): void {
    const next = (this.weaponIndex + delta + WEAPON_LOADOUT.length) % WEAPON_LOADOUT.length;
    this.selectWeaponIndex(next);
  }

  private selectWeaponIndex(index: number): void {
    const id = WEAPON_LOADOUT[index];
    if (!id || this.weaponIndex === index) return;
    this.setWeapon(WEAPONS[id]);
    audio.uiToggle();
    this.fx.sparks(this.player.x, this.player.y, this.weapon.glow, 5);
  }

  private onWeaponWheel(_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number): void {
    if (this.isPaused || this.gameOverShown || this.exiting || uiOverlayActive()) return;
    this.switchWeapon(dy > 0 ? 1 : -1);
  }

  private fire(now: number): void {
    const wp = this.weapon;
    const save = loadSave();
    const ownsPulseOverchain = save.purchasedUpgrades.includes('pulse-overchain');
    const ownsRicochet = save.purchasedUpgrades.includes('pulse-ricochet');
    const cd = wp.cooldownMs * (activeSkin().mods.pulseCooldownMul ?? 1) * this.boonFireMul * (this.odActive ? SWEEP.overdriveFireMul : 1);
    this.fireAt = now + cd;
    this.shotCount++;
    if (wp.id === 'arc') {
      this.swingArcBlade(wp);
      return;
    }
    const surge = activeSkin().abilities.surgeShot === true && this.shotCount % 3 === 0; // SPARK Surge Shot
    const charged = wp.id === 'pulse' && this.shotCount % 5 === 0;
    const base = this.player.aimAngle;
    const mx = this.player.muzzleX;
    const my = this.player.muzzleY;
    for (let i = 0; i < wp.count; i++) {
      const off = wp.count > 1 ? (i / (wp.count - 1) - 0.5) * wp.spreadRad * 2 : (Math.random() - 0.5) * wp.spreadRad;
      const a = base + off;
      const b = fireFrom(this.playerShots, mx, my, Math.cos(a) * wp.speed, Math.sin(a) * wp.speed, wp.lifeMs);
      if (b) {
        const uni = wp.scale ?? 1; // heavy shells (RUPTURE) read bigger
        b.setTint(charged || surge ? P.warning : wp.tint);
        b.setScale((charged ? 1.75 : (wp.scaleX ?? 1.08)) * uni, (charged ? 1.15 : 1.02) * uni);
        b.setData('dmg', wp.damage * (surge || charged ? 2 : 1));
        b.setData('damageFamily', damageFamilyForWeapon(wp.id));
        b.setData('pierce', wp.pierce === true || charged);
        b.setData('bounce', wp.id === 'pulse' && ownsRicochet ? Math.max(1, wp.bounce ?? 0) : wp.bounce ?? 0);
        b.setData('chain', wp.id === 'pulse' && ownsPulseOverchain && charged ? 3 : 0);
        b.setData('hits', null);
        b.setData('recallDisc', wp.id === 'disc');
        b.setData('returnAt', now + 420);
        b.setData('discPhase', 'out');
        b.setData('returnTrail', wp.id === 'disc');
        b.setData('trailAt', 0);
        b.setData('shotTrailAt', 0);
        b.setData('trailColor', charged || surge ? P.warning : wp.glow);
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
    this.fx.sparks(mx, my, wp.glow, charged || surge || wp.id === 'disc' ? 5 : 2);
    if (charged) {
      this.fx.scanRing(mx + Math.cos(base) * 12, my + Math.sin(base) * 12, 38, 180, P.warning);
    } else if (wp.id === 'disc') {
      this.fx.scanRing(mx, my, 26, 160, wp.glow);
    }
    audio.pulseShot();
  }

  private swingArcBlade(wp: SweepWeapon): void {
    const base = this.player.aimAngle;
    const range = 72;
    const arc = Math.PI * 0.88;
    const px = this.player.x;
    const py = this.player.y;
    const blade = this.add.graphics().setDepth(26);
    blade.fillStyle(wp.glow, 0.16);
    blade.slice(px, py, range + 8, base - arc / 2, base + arc / 2, false);
    blade.fillPath();
    blade.lineStyle(10, wp.glow, 0.34);
    blade.beginPath();
    blade.arc(px, py, range - 5, base - arc / 2, base + arc / 2, false);
    blade.strokePath();
    blade.lineStyle(5, wp.glow, 0.9);
    blade.beginPath();
    blade.arc(px, py, range, base - arc / 2, base + arc / 2, false);
    blade.strokePath();
    blade.lineStyle(2, P.white, 0.86);
    blade.lineBetween(px + Math.cos(base - arc / 2) * 22, py + Math.sin(base - arc / 2) * 22, px + Math.cos(base) * (range + 6), py + Math.sin(base) * (range + 6));
    blade.lineBetween(px + Math.cos(base + arc / 2) * 22, py + Math.sin(base + arc / 2) * 22, px + Math.cos(base) * (range + 6), py + Math.sin(base) * (range + 6));
    this.tweens.add({ targets: blade, alpha: 0, scaleX: 1.08, scaleY: 1.08, duration: 155, onComplete: () => blade.destroy() });
    this.fx.sparks(px + Math.cos(base) * 28, py + Math.sin(base) * 28, wp.glow, 9);
    this.fx.scanRing(px + Math.cos(base) * 28, py + Math.sin(base) * 28, 34, 160, wp.glow);
    audio.pulseShot();

    let hit = false;
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
      if (!en.active) return;
      const d = Phaser.Math.Distance.Between(px, py, en.x, en.y);
      const a = Math.atan2(en.y - py, en.x - px);
      const inside = d <= range && Math.abs(Phaser.Math.Angle.Wrap(a - base)) <= arc / 2;
      if (!inside) return;
      hit = true;
      this.impactFx(en.x, en.y, wp.glow);
      if (this.applyEnemyDamage(en, wp.damage, px, py, 430, 'arc')) this.killEnemy(en);
    });

    let reflected = 0;
    (this.enemyShots.getChildren() as Projectile[]).forEach((bolt) => {
      if (!bolt.active) return;
      const d = Phaser.Math.Distance.Between(px, py, bolt.x, bolt.y);
      const a = Math.atan2(bolt.y - py, bolt.x - px);
      if (d > range || Math.abs(Phaser.Math.Angle.Wrap(a - base)) > arc / 2) return;
      bolt.kill();
      const rb = fireFrom(this.playerShots, bolt.x, bolt.y, Math.cos(base) * 420, Math.sin(base) * 420, 650);
      if (rb) {
        rb.setTint(wp.glow).setScale(1.2);
        rb.setData('dmg', 1);
        rb.setData('damageFamily', 'arc');
        rb.setData('pierce', true);
        rb.setData('bounce', 0);
        rb.setData('hits', null);
        rb.setData('recallDisc', false);
        rb.setData('returnTrail', false);
        rb.setData('shotTrailAt', 0);
        rb.setData('trailColor', wp.glow);
        rb.setData('chain', 0);
        rb.setData('homing', 0);
        rb.setData('explode', null);
      }
      reflected++;
    });
    if (reflected && loadSave().purchasedUpgrades.includes('arc-shockwave')) this.arcParryShockwave(px, py, wp);
    else if (reflected) this.fx.scanRing(px, py, 42, 170, wp.glow);
    if (hit || reflected) audio.enemyHit();
    if (reflected) this.fx.floatText(px, py - 12, `PARRY x${reflected}`, wp.glow);
  }

  private arcParryShockwave(x: number, y: number, wp: SweepWeapon): void {
    this.fx.scanRing(x, y, 74, 260, wp.glow);
    this.fx.sparks(x, y, wp.glow, 10);
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
      if (!en.active) return;
      const d = Phaser.Math.Distance.Between(x, y, en.x, en.y);
      if (d > 74) return;
      if (this.applyEnemyDamage(en, 1, x, y, 260, 'arc')) this.killEnemy(en);
    });
  }

  private applyEnemyDamage(en: SweepEnemy, baseDamage: number, fromX: number, fromY: number, force: number = SWEEP.enemyKnockback, family: DamageFamily = 'pulse'): boolean {
    const mult = affinityMultiplier(en.kind, en.affinityState(), family);
    const dmg = Math.max(0.25, baseDamage * mult);
    const label = affinityLabel(mult);
    if (label) {
      const color = label === 'WEAK' ? P.warning : P.bluestone;
      this.fx.floatText(en.x, en.y - 18, label, color);
      if (label === 'WEAK') this.fx.sparks(en.x, en.y, color, 5);
      else this.fx.sparks(en.x, en.y, color, 2);
    }
    return en.applyHit(dmg, fromX, fromY, force * Phaser.Math.Clamp(mult, 0.55, 1.45));
  }

  private spawnCipherZone(caster: SweepEnemy, data: { x: number; y: number; radius: number; lockMs: number; explodeMs: number }): void {
    const p = this.nearestWalkableWorld(data.x, data.y);
    const gfx = this.add.graphics().setDepth(DEPTH.decal + 78);
    this.cipherZones.push({
      x: p.x,
      y: p.y,
      radius: data.radius,
      lockAt: this.time.now + data.lockMs,
      explodeAt: this.time.now + data.explodeMs,
      gfx,
      caster,
    });
  }

  private updateCipherZones(now: number): void {
    this.cipherZones = this.cipherZones.filter((zone) => {
      const locked = now >= zone.lockAt;
      const remain = Math.max(0, zone.explodeAt - now);
      const t = 1 - remain / Math.max(1, zone.explodeAt - zone.lockAt);
      zone.gfx.clear();
      zone.gfx.fillStyle(P.danger, locked ? 0.17 + t * 0.16 : 0.08).fillCircle(zone.x, zone.y, zone.radius);
      zone.gfx.lineStyle(2, locked ? P.warning : P.danger, locked ? 0.72 : 0.38).strokeCircle(zone.x, zone.y, zone.radius * (locked ? 1 : 0.75 + Math.sin(now * 0.012) * 0.08));
      zone.gfx.lineStyle(1, P.white, locked ? 0.24 : 0.12).lineBetween(zone.x - zone.radius, zone.y, zone.x + zone.radius, zone.y).lineBetween(zone.x, zone.y - zone.radius, zone.x, zone.y + zone.radius);
      if (now < zone.explodeAt) return true;

      zone.gfx.destroy();
      this.fx.mechanicalRupture(zone.x, zone.y, P.danger, 18);
      this.fx.scorch(zone.x, zone.y, 18);
      audio.explode();
      if (this.time.now >= this.entryGraceUntil && Phaser.Math.Distance.Between(zone.x, zone.y, this.player.x, this.player.y) <= zone.radius + 8) {
        if (this.player.damage(zone.x, zone.y)) this.onPlayerHurt();
      }
      (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
        if (!en.active || en === zone.caster) return;
        if (Phaser.Math.Distance.Between(zone.x, zone.y, en.x, en.y) > zone.radius + 8) return;
        if (this.applyEnemyDamage(en, 1.25, zone.x, zone.y, 220, 'blast')) this.killEnemy(en);
      });
      return false;
    });
  }

  private pulseGroundMarker(x: number, y: number, radius: number, tint: number, ms = 520): void {
    const g = this.add.graphics().setDepth(DEPTH.decal + 77);
    g.fillStyle(tint, 0.12).fillCircle(x, y, radius);
    g.lineStyle(2, tint, 0.65).strokeCircle(x, y, radius);
    this.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => g.destroy() });
  }

  private updateEnemySpecials(now: number, dt: number): void {
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
      if (!en.active) return;
      const cipher = en.getData('cipherMarkerRequest') as { x: number; y: number; radius: number; lockMs: number; explodeMs: number } | undefined;
      if (cipher) {
        en.setData('cipherMarkerRequest', null);
        this.spawnCipherZone(en, cipher);
      }

      const activeUntil = Number(en.getData('gravitonActiveUntil')) || 0;
      const gravitonGfx = en.getData('gravitonGfx') as Phaser.GameObjects.Graphics | undefined;
      if (now < activeUntil && en.kind === 'graviton') {
        let gfx = gravitonGfx;
        if (!gfx) {
          gfx = this.add.graphics().setDepth(DEPTH.decal + 76);
          en.setData('gravitonGfx', gfx);
        }
        const r = 168;
        gfx.clear();
        gfx.fillStyle(P.neonCyan, 0.08).fillCircle(en.x, en.y, r);
        gfx.lineStyle(2, P.neonCyan, 0.36).strokeCircle(en.x, en.y, r * (0.94 + Math.sin(now * 0.008) * 0.04));
        gfx.lineStyle(1, P.white, 0.18).lineBetween(en.x, en.y, this.player.x, this.player.y);
        const d = Phaser.Math.Distance.Between(en.x, en.y, this.player.x, this.player.y);
        if (d > 20 && d < r && this.hasWalkableLine(en.x, en.y, this.player.x, this.player.y)) {
          const body = this.player.body as Phaser.Physics.Arcade.Body;
          const pull = 185 * Phaser.Math.Clamp(1 - d / r, 0.22, 0.72);
          body.velocity.x += ((en.x - this.player.x) / d) * pull * dt;
          body.velocity.y += ((en.y - this.player.y) / d) * pull * dt;
        }
      } else if (gravitonGfx) {
        gravitonGfx.destroy();
        en.setData('gravitonGfx', null);
      }

      const lock = en.getData('undertowLockRequest') as { x: number; y: number; radius: number; eruptAt: number } | undefined;
      if (lock) {
        en.setData('undertowLockRequest', null);
        this.pulseGroundMarker(lock.x, lock.y, lock.radius, P.warning, Math.max(220, lock.eruptAt - now));
      }
      const erupt = en.getData('undertowEruptRequest') as { x: number; y: number; radius: number } | undefined;
      if (erupt) {
        en.setData('undertowEruptRequest', null);
        this.fx.mechanicalRupture(erupt.x, erupt.y, P.warning, 14);
        this.fx.scorch(erupt.x, erupt.y, 14);
        if (this.time.now >= this.entryGraceUntil && Phaser.Math.Distance.Between(erupt.x, erupt.y, this.player.x, this.player.y) <= erupt.radius) {
          if (this.player.damage(erupt.x, erupt.y)) this.onPlayerHurt();
        }
      }
      const ambush = en.getData('ambushBurstRequest') as { x: number; y: number; radius: number } | undefined;
      if (ambush) {
        en.setData('ambushBurstRequest', null);
        this.fx.scanRing(ambush.x, ambush.y, ambush.radius, 220, P.danger);
        if (this.time.now >= this.entryGraceUntil && Phaser.Math.Distance.Between(ambush.x, ambush.y, this.player.x, this.player.y) <= ambush.radius) {
          if (this.player.damage(ambush.x, ambush.y)) this.onPlayerHurt();
        }
      }
    });
    this.updateCipherZones(now);
  }

  /* ---------------------------- collisions ------------------------------- */
  private onShotHitEnemy(shot: Projectile, en: SweepEnemy): void {
    if (!shot.active || !en.active) return;
    const pierce = shot.getData('pierce') === true;
    // FIREWALL: a bolt into the warden's front shield is deflected (flank / dash / Scan instead)
    const b = shot.body as Phaser.Physics.Arcade.Body;
    const blockState = en.shotBlockState(b.velocity.x, b.velocity.y);
    if (blockState === 'blocked') {
      this.impactFx(shot.x, shot.y, P.neonCyan);
      this.fx.sparks(shot.x, shot.y, P.neonCyan, 3);
      this.fx.floatText(en.x, en.y - 14, 'SHIELD', P.neonCyan);
      audio.enemyHit();
      if (!pierce) shot.kill();
      return;
    } else if (blockState === 'overloaded') {
      this.impactFx(en.x, en.y, P.warning);
      this.fx.scanRing(en.x, en.y, 42, 240, P.warning);
      this.fx.floatText(en.x, en.y - 16, 'SHIELD BREAK', P.warning);
      audio.enemyHit();
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
    const chain = (shot.getData('chain') as number) ?? 0;
    const ix = en.x;
    const iy = en.y;
    if (!pierce) shot.kill();
    this.impactFx(en.x, en.y, shot.getData('bounce') ? P.signalGreen : P.warning);
    audio.enemyHit();
    const family = (shot.getData('damageFamily') as DamageFamily | undefined) ?? 'pulse';
    if (this.applyEnemyDamage(en, dmg, sx, sy, SWEEP.enemyKnockback, family)) this.killEnemy(en);
    if (chain > 0) this.pulseResonanceChain(ix, iy, chain);
    if (explode) this.explodeShot(ix, iy, explode);
  }

  private pulseResonanceChain(x: number, y: number, chains: number): void {
    let origin = { x, y };
    for (let i = 0; i < chains; i++) {
      let best: SweepEnemy | null = null;
      let bestD = Infinity;
      (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
        if (!en.active) return;
        const d = Phaser.Math.Distance.Squared(origin.x, origin.y, en.x, en.y);
        if (d < bestD && d <= 120 * 120) {
          best = en;
          bestD = d;
        }
      });
      if (!best) return;
      const target = best as SweepEnemy;
      this.fx.sparks(target.x, target.y, P.signal, 7);
      const line = this.add
        .line(0, 0, origin.x, origin.y, target.x, target.y, P.signal, 0.5)
        .setOrigin(0)
        .setDepth(24);
      this.time.delayedCall(90, () => line.destroy());
      if (this.applyEnemyDamage(target, 1, origin.x, origin.y, 180, 'pulse')) this.killEnemy(target);
      origin = { x: target.x, y: target.y };
    }
  }

  /** RUPTURE detonation — AoE damage + palette-locked burst on impact (enemy or wall). */
  private explodeShot(x: number, y: number, ex: { radius: number; damage: number }): void {
    this.fx.mechanicalRupture(x, y, P.warning, 22);
    this.fx.scorch(x, y, Math.max(12, ex.radius * 0.18));
    audio.explode();
    const ring = this.add.image(x, y, TEX.glow8).setDepth(24).setTint(P.warning).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.9);
    this.tweens.add({ targets: ring, scale: Math.max(1, ex.radius / 20), alpha: 0, duration: 220, onComplete: () => ring.destroy() });
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
      if (!en.active) return;
      if (Phaser.Math.Distance.Between(x, y, en.x, en.y) <= ex.radius) {
        if (this.applyEnemyDamage(en, ex.damage, x, y, 240, 'blast')) this.killEnemy(en);
      }
    });
  }

  /** SEEKER: curve every homing bolt toward its nearest live drone (rate-capped → fair). */
  private steerHomingShots(dt: number): void {
    const save = loadSave();
    const ownsRecallTrail = save.purchasedUpgrades.includes('pulse-ricochet') || save.purchasedUpgrades.includes('recall-conduit');
    (this.playerShots.getChildren() as Projectile[]).forEach((b) => {
      if (!b.active) return;
      this.renderProjectileTrail(b);
      if (b.getData('recallDisc') === true) {
        const body = b.body as Phaser.Physics.Arcade.Body;
        const phase = b.getData('discPhase') as string;
        const far = Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y) > 190;
        if (phase !== 'return' && (this.time.now >= ((b.getData('returnAt') as number) ?? 0) || far)) {
          b.setData('discPhase', 'return');
          b.setData('hits', null);
        }
        if (b.getData('discPhase') === 'return') {
          const speed = Math.hypot(body.velocity.x, body.velocity.y) || this.weapon.speed || 310;
          const want = Math.atan2(this.player.y - b.y, this.player.x - b.x);
          body.setVelocity(Math.cos(want) * speed, Math.sin(want) * speed);
          b.setRotation(want);
          if (ownsRecallTrail && b.getData('returnTrail') === true) this.recallReturnTrail(b);
          if (Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y) < 18) {
            this.fx.sparks(this.player.x, this.player.y, P.warning, 3);
            b.kill();
          }
        }
        return;
      }
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

  private recallReturnTrail(b: Projectile): void {
    const now = this.time.now;
    if (now < ((b.getData('trailAt') as number) ?? 0)) return;
    b.setData('trailAt', now + 130);
    this.fx.sparks(b.x, b.y, P.neonCyan, 3);
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
      if (!en.active) return;
      if (Phaser.Math.Distance.Between(b.x, b.y, en.x, en.y) > 30) return;
      if (this.applyEnemyDamage(en, 1, b.x, b.y, 120, 'kinetic')) this.killEnemy(en);
    });
  }

  private renderProjectileTrail(b: Projectile): void {
    const now = this.time.now;
    if (now < ((b.getData('shotTrailAt') as number) ?? 0)) return;
    b.setData('shotTrailAt', now + 44);
    const body = b.body as Phaser.Physics.Arcade.Body;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed < 8) return;
    const color = (b.getData('trailColor') as number | undefined) ?? P.signal;
    const ax = Math.atan2(body.velocity.y, body.velocity.x);
    const tail = b.getData('recallDisc') === true ? 30 : 24;
    const g = this.add.graphics().setDepth(23).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(b.getData('recallDisc') === true ? 5 : 4, color, 0.36);
    g.lineBetween(b.x - Math.cos(ax) * tail, b.y - Math.sin(ax) * tail, b.x, b.y);
    g.lineStyle(1, P.white, 0.6);
    g.lineBetween(b.x - Math.cos(ax) * (tail * 0.48), b.y - Math.sin(ax) * (tail * 0.48), b.x + Math.cos(ax) * 6, b.y + Math.sin(ax) * 6);
    this.tweens.add({ targets: g, alpha: 0, duration: 130, onComplete: () => g.destroy() });
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
    if (b.getData('recallDisc') === true) {
      b.setData('discPhase', 'return');
      b.setData('hits', null);
      this.fx.sparks(b.x, b.y, P.warning, 3);
      return;
    }
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
    this.fx.sparks(x, y, P.white, 5);
    this.fx.sparks(x, y, tint, 7);
    const fl = this.add.image(x, y, TEX.glow8).setDepth(23).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(0.76).setAlpha(0.9);
    this.tweens.add({ targets: fl, scale: 0.12, alpha: 0, duration: 145, onComplete: () => fl.destroy() });
  }

  private killEnemy(en: SweepEnemy): void {
    const now = this.time.now;
    const ex = en.x;
    const ey = en.y;
    this.fx.mechanicalRupture(ex, ey, P.warning, 18);
    this.fx.scorch(ex, ey, 14);
    // Mechanical death read: sparks, a hard discharge ring, then lingering damage.
    const ring = this.add.image(ex, ey, TEX.glow8).setDepth(23).setTint(P.warning).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.95);
    this.tweens.add({ targets: ring, scale: 2.05, alpha: 0, duration: 270, onComplete: () => ring.destroy() });
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
    this.removeEnemy(en);
    if (splitN > 0) this.spawnSplitShards(ex, ey, splitN);
    // kills charge the Node (double near it); isolated combat probes skip this
    // so reward modals cannot pause enemy validation mid-shot.
    if (!this.debugCombatProbeActive) this.addNodeCharge(ex, ey);
    // the finale boss triggers the climax; the Elite drops a Boon + cache; grunts drop by chance
    if (isBoss) {
      this.onBossDefeated(ex, ey);
    } else if (isElite) {
      this.fx.mechanicalRupture(ex, ey, P.danger, 30);
      this.fx.scorch(ex, ey, 22);
      this.dropBoon(ex, ey);
      addShards(SWEEP.eliteCacheShards);
      this.shardsEarned += SWEEP.eliteCacheShards;
      this.fx.floatText(ex, ey - 10, '+CACHE', P.warning);
    } else if (Math.random() < (this.arena.dropChance ?? SWEEP.dropChance)) {
      // per-arena override lets only the finale route clear be extra loot-generous
      this.dropPickup(ex, ey);
    }
  }

  private onEnemyBoltHit(bolt: Projectile): void {
    if (!bolt.active || !this.player.alive) return;
    const bx = bolt.x;
    const by = bolt.y;
    bolt.kill();
    if (this.time.now < this.entryGraceUntil) return;
    if (this.player.damage(bx, by)) this.onPlayerHurt();
  }

  private onTouch(en: SweepEnemy): void {
    if (!en.active || !this.player.alive) return;
    if (this.time.now < this.entryGraceUntil) return;
    // ROCKET Phase-Strike: dashing through a drone damages IT (you're invulnerable mid-dash)
    if (this.player.isDashing && activeSkin().abilities.phaseStrike === true) {
      this.fx.sparks(en.x, en.y, P.scoutDanny, 4);
      if (this.applyEnemyDamage(en, SWEEP.shotDmg, this.player.x, this.player.y, SWEEP.enemyKnockback, 'pulse')) {
        this.killEnemy(en);
        if (SWEEP.dashRefundOnPhaseKill) this.player.refreshDash(); // dash-chain flow
      }
      return;
    }
    if (this.player.damage(en.x, en.y)) this.onPlayerHurt();
  }

  private applyEnemyContactPressure(): void {
    if (this.time.now < this.entryGraceUntil) return;
    if (!this.player.alive || this.player.invulnerable) return;
    const r = SWEEP.enemyContactRadius;
    for (const en of this.enemies.getChildren() as SweepEnemy[]) {
      if (!en.active) continue;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, en.x, en.y) > r) continue;
      this.onTouch(en);
      return;
    }
  }

  private onPlayerHurt(): void {
    this.fx.sparks(this.player.x, this.player.y, P.danger, 8);
    this.fx.shake(0.0032, 80);
    this.heat = Math.min(100, this.heat + SWEEP.heatFillOnHit);
    if (this.player.hp <= 0) this.onDeath();
  }

  /* ------------------------------ pickups -------------------------------- */
  private pickupLabelY(x: number, y: number, baseOffset: number): number {
    let nearbyLabels = 0;
    let labelY = y - baseOffset;
    const route = ROUTE_BEACONS[this.arena.id];
    const activePhase = this.breachOpen ? 'toExit' : 'toObjective';
    const activeRouteSigns = route?.[activePhase] ?? [];
    for (const sign of activeRouteSigns) {
      const sx = (sign.tx + 0.5) * SWEEP.tile;
      const sy = (sign.ty + 0.5) * SWEEP.tile - 31;
      if (Math.abs(x - sx) < 118 && Math.abs(labelY - sy) < 44) labelY = y + 39;
    }
    this.routeMarkers.forEach((obj) => {
      if (!obj.getData?.('routeSign') || !(obj as unknown as Phaser.GameObjects.Components.Visible).visible) return;
      const sx = Number(obj.getData('routeSignX') ?? 0);
      const sy = Number(obj.getData('routeSignY') ?? 0);
      if (Math.abs(x - sx) < 118 && Math.abs(labelY - sy) < 44) labelY = y + 39;
    });
    (this.pickups?.getChildren?.() as Phaser.Physics.Arcade.Image[] | undefined)?.forEach((pk) => {
      if (!pk.active) return;
      if (!pk.getData('label')) return;
      if (Phaser.Math.Distance.Between(x, y, pk.x, pk.y) < 46) nearbyLabels++;
    });
    return labelY - Math.min(2, nearbyLabels) * 13;
  }

  private dropPickup(x: number, y: number): void {
    // half the time a health orb, otherwise a random WEAPON pickup
    const isWeapon = Math.random() > 0.5;
    const wid = Phaser.Utils.Array.GetRandom(WEAPON_PICKUPS);
    const type = isWeapon ? 'weapon' : 'health';
    const tint = isWeapon ? WEAPONS[wid].tint : P.signalGreen;
    const pk = this.pickups.create(x, y, TEX.sweepPickup) as Phaser.Physics.Arcade.Image;
    pk.setTint(tint).setScale(isWeapon ? 1.05 : 0.78).setDepth(12).setData('ptype', type);
    if (isWeapon) pk.setData('wid', wid);
    (pk.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    // a soft light pool so pickups read against the dark ground
    const glow = this.add.image(x, y, TEX.glow8).setDepth(11).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(isWeapon ? 2.1 : 1.35).setAlpha(isWeapon ? 0.5 : 0.32);
    pk.setData('glow', glow);
    let label: Phaser.GameObjects.Text | undefined;
    if (isWeapon) {
      const wp = WEAPONS[wid];
      label = this.add
        .text(x, this.pickupLabelY(x, y, 25), this.weaponPickupLabel(wp, false), {
          fontFamily: 'monospace',
          fontSize: '6px',
          fontStyle: 'bold',
          color: css(P.cream),
          align: 'center',
          backgroundColor: 'rgba(5,8,14,0.82)',
          padding: { x: 4, y: 3 },
        })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(13);
      pk.setData('label', label);
    }
    this.tweens.add({ targets: [pk], scale: { from: pk.scale * 0.92, to: pk.scale * 1.08 }, duration: 620, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: glow, alpha: { from: isWeapon ? 0.32 : 0.18, to: isWeapon ? 0.62 : 0.42 }, duration: 720, yoyo: true, repeat: -1 });
    this.time.delayedCall(11000, () => { if (pk.active) { glow.destroy(); label?.destroy(); pk.destroy(); } });
  }

  private dropHealthPickup(x: number, y: number, persist = false): void {
    const pk = this.pickups.create(x, y, TEX.sweepPickup) as Phaser.Physics.Arcade.Image;
    pk.setTint(P.signalGreen).setScale(0.82).setDepth(12).setData('ptype', 'health');
    (pk.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    const glow = this.add.image(x, y, TEX.glow8).setDepth(11).setTint(P.signalGreen).setBlendMode(Phaser.BlendModes.ADD).setScale(1.35).setAlpha(0.3);
    const label = this.add
      .text(x, this.pickupLabelY(x, y, 23), 'RECOVERY', {
        fontFamily: 'monospace',
        fontSize: '6px',
        fontStyle: 'bold',
        color: css(P.cream),
        backgroundColor: 'rgba(5,8,14,0.76)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(13);
    pk.setData('glow', glow);
    pk.setData('label', label);
    this.tweens.add({ targets: pk, scale: { from: 0.72, to: 0.92 }, duration: 600, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: glow, alpha: { from: 0.18, to: 0.42 }, duration: 720, yoyo: true, repeat: -1 });
    if (!persist) this.time.delayedCall(11000, () => { if (pk.active) { glow.destroy(); label.destroy(); pk.destroy(); } });
  }

  /** place a specific WEAPON pickup (guaranteed finale loot / boss payout). */
  private dropWeaponPickup(x: number, y: number, wid: string, persist: boolean): void {
    const wp = WEAPONS[wid] ?? WEAPONS.pulse;
    const pk = this.pickups.create(x, y, TEX.sweepPickup) as Phaser.Physics.Arcade.Image;
    pk.setTint(wp.tint).setScale(persist ? 1.34 : 1.04).setDepth(12).setData('ptype', 'weapon').setData('wid', wp.id).setData('major', persist);
    (pk.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    const glow = this.add.image(x, y, TEX.glow8).setDepth(11).setTint(wp.tint).setBlendMode(Phaser.BlendModes.ADD).setScale(persist ? 2.65 : 2.05).setAlpha(persist ? 0.58 : 0.46);
    const label = this.add
      .text(x, this.pickupLabelY(x, y, 25), this.weaponPickupLabel(wp, persist), {
        fontFamily: 'monospace',
        fontSize: '6px',
        fontStyle: 'bold',
        color: css(P.cream),
        align: 'center',
        backgroundColor: 'rgba(5,8,14,0.78)',
        padding: { x: 4, y: 3 },
      })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(13);
    pk.setData('glow', glow);
    pk.setData('label', label);
    this.tweens.add({ targets: [pk], scale: { from: pk.scale * 0.92, to: pk.scale * 1.08 }, duration: 620, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: glow, alpha: { from: persist ? 0.35 : 0.28, to: persist ? 0.7 : 0.58 }, duration: 720, yoyo: true, repeat: -1 });
    if (!persist) this.time.delayedCall(14000, () => { if (pk.active) { glow.destroy(); label.destroy(); pk.destroy(); } });
  }

  private weaponPickupLabel(wp: SweepWeapon, major: boolean): string {
    const role = wp.id === 'pulse' ? 'RANGED' : wp.id === 'arc' ? 'PARRY · CLOSE' : 'RETURN PATH';
    return major ? `${wp.name}\n${role}` : `${wp.name}\nEQUIP`;
  }

  private weaponRewardIcon(wp: SweepWeapon): string {
    return wp.id === 'pulse' ? 'pulse' : wp.id === 'arc' ? 'echo' : 'relic';
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
    const wid = pk.getData('wid') as string | undefined;
    const scout = pk.getData('scout') as string | undefined;
    (pk.getData('glow') as Phaser.GameObjects.Image | undefined)?.destroy();
    (pk.getData('label') as Phaser.GameObjects.Text | undefined)?.destroy();
    this.impactFx(this.player.x, this.player.y, P.signalGreen); // collect pop
    if (type === 'boon') {
      pk.destroy();
      this.applyBoon(scout ?? 'will');
      return;
    }
    pk.destroy();
    audio.badgePickup();
    if (type === 'health') {
      this.player.heal(SWEEP.healAmount);
      this.fx.floatText(this.player.x, this.player.y - 10, '+HP', P.signalGreen);
    } else {
      const wp = wid ? WEAPONS[wid] : undefined;
      const resolved = wp ?? WEAPONS.pulse;
      this.setWeapon(resolved, 'pickup');
      if (pk.getData('major') === true) {
        bus.emit(EVT.rewardBanner, {
          kind: 'weapon-pickup',
          title: resolved.name,
          sub: `WEAPON · ${resolved.id === 'arc' ? 'PARRY / CLOSE RANGE' : resolved.id === 'disc' ? 'POSITIONING / RETURN DAMAGE' : 'RANGED PRESSURE'}`,
          desc: resolved.role,
          color: css(resolved.glow),
          icon: this.weaponRewardIcon(resolved),
          rarity: 'epic',
        });
      }
    }
  }

  /* ------------------------------- scan ---------------------------------- */
  private doScan(): void {
    audio.scanPulse();
    // scan radius honors the active skin (WILLOW wider, ECHO narrower) + WILLOW boon
    const r = SWEEP.scanRadius * (activeSkin().mods.scanRadiusMul ?? 1) * this.boonScanMul;
    this.fx.scanRing(this.player.x, this.player.y, r, 460, P.signal);
    if (loadSave().purchasedUpgrades.includes('scan-memory')) this.createScanMemoryEcho(this.player.x, this.player.y, r);
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
      if (!en.active) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, en.x, en.y) <= r) {
        if (this.applyEnemyDamage(en, SWEEP.scanDmg, this.player.x, this.player.y, 260, 'arc')) this.killEnemy(en);
      }
    });
    if (loadSave().purchasedUpgrades.includes('emp-burst')) {
      let cleared = 0;
      (this.enemyShots.getChildren() as Projectile[]).forEach((bolt) => {
        if (!bolt.active) return;
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, bolt.x, bolt.y) <= r) {
          cleared++;
          this.fx.sparks(bolt.x, bolt.y, P.neonCyan, 3);
          bolt.kill();
        }
      });
      if (cleared) {
        this.fx.floatText(this.player.x, this.player.y - 16, `EMP x${cleared}`, P.neonCyan);
        audio.hazardZap();
      }
    }
    // double-duty Scan: reveal + grab buried Signal Caches in range
    this.revealCaches(this.player.x, this.player.y, r);
    this.triggerScanFieldEvents(this.player.x, this.player.y, r);
  }

  private createScanMemoryEcho(x: number, y: number, radius: number): void {
    const g = this.add.graphics().setDepth(DEPTH.decal + 74).setAlpha(0.56);
    g.lineStyle(2, P.scoutCameron, 0.42).strokeCircle(x, y, radius * 0.42);
    g.lineStyle(1, P.neonCyan, 0.24).strokeCircle(x, y, radius * 0.78);
    g.fillStyle(P.scoutCameron, 0.05).fillCircle(x, y, radius * 0.78);
    this.tweens.add({ targets: g, alpha: 0, duration: 3600, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
  }

  private updatePhaseBoostPlus(now: number): void {
    if (!this.player.isDashing || !loadSave().purchasedUpgrades.includes('phase-drift-plus')) return;
    if (now < this.motelPhaseSlipUntil) return;
    let cleared = 0;
    (this.enemyShots.getChildren() as Projectile[]).forEach((bolt) => {
      if (!bolt.active) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, bolt.x, bolt.y) > 38) return;
      cleared++;
      this.fx.sparks(bolt.x, bolt.y, P.neonCyan, 4);
      bolt.kill();
    });
    if (!cleared) return;
    this.motelPhaseSlipUntil = now + 220;
    this.fx.floatText(this.player.x, this.player.y - 18, `PHASED x${cleared}`, P.neonCyan);
    audio.hazardZap();
  }

  private tryGravityWell(maxDistance = 88): boolean {
    const well = this.gravityWell;
    if (!well || well.used) return false;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, well.x, well.y) > maxDistance) return false;
    well.used = true;
    audio.hazardZap();
    this.fx.flash(P.cropGlow, 140);
    this.fx.scanRing(well.x, well.y, 126, 520, P.cropGlow);
    this.fx.afterimage(this.player, P.cropGlow);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    this.tweens.add({
      targets: this.player,
      x: well.destX,
      y: well.destY,
      duration: 420,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        this.fx.scanRing(well.destX, well.destY, 96, 420, P.cropGlow);
        this.fx.floatText(well.destX, well.destY - 18, 'RAISED RIDGE', P.cropGlow);
        this.revealCaches(well.destX, well.destY, 96);
        this.awardRegionReward();
        well.ring.setTint(P.signalGreen);
        well.label.setText('GRAVITY WELL\nRIDGE ROUTE OPEN').setColor(css(P.signalGreen));
        this.refreshFieldEventAvailability();
        this.updateRouteMarkerVisibility();
        this.fx.floatText(this.nodePos.x, this.nodePos.y - 28, 'CROP CIRCLE UNLOCKED', P.cropGlow);
        bus.emit(EVT.toast, { text: 'Raised Ridge reached — the Crop Circle can open now.', color: 'green' });
        this.emitHudStats();
        this.maybeCompleteTraverseObjective();
      },
    });
    bus.emit(EVT.toast, { text: 'GRAVITY WELL REDIRECTED — ridge route opening', color: 'green' });
    this.showBanner('GRAVITY WELL REDIRECTED');
    return true;
  }

  private updateMotelScanners(now: number): void {
    if (!this.motelScanners.length) return;
    const alert = now < this.motelAlertUntil;
    this.motelScanners.forEach((s, i) => {
      const pulse = 0.45 + Math.abs(Math.sin((now + i * 180) * 0.006)) * 0.35;
      const disabled = s.disabled === true;
      s.line.clear();
      if (disabled && this.breachOpen) {
        s.text.setVisible(false);
        s.emitter.setVisible(false);
        s.receiver.setVisible(false);
        return;
      }
      s.line.lineStyle(alert ? 7 : 5, P.dangerDark, alert ? 0.42 : 0.24);
      if (!disabled) s.line.lineBetween(s.ax, s.ay, s.bx, s.by);
      s.line.lineStyle(alert ? 4 : 3, disabled ? P.neonCyan : P.danger, disabled ? 0 : alert ? 0.9 : 0.58 + pulse * 0.18);
      if (!disabled) s.line.lineBetween(s.ax, s.ay, s.bx, s.by);
      s.line.lineStyle(1, P.white, disabled ? 0 : alert ? 0.38 : 0.16);
      if (!disabled) s.line.lineBetween(s.ax, s.ay, s.bx, s.by);
      s.text
        .setVisible(true)
        .setText(disabled ? 'SCANNER OFFLINE' : s.label)
        .setColor(css(disabled ? P.neonCyan : P.danger))
        .setAlpha(disabled ? 0.55 : 0.92);
      [s.emitter, s.receiver].forEach((endpoint) => endpoint
        .setVisible(true)
        .setTint(disabled ? P.neonCyan : P.danger)
        .setAlpha(disabled ? 0.34 : alert ? 0.98 : 0.72 + pulse * 0.14)
        .setScale(disabled ? 0.5 : alert ? 0.76 : 0.64 + pulse * 0.04));

      if (this.breachOpen || !this.player.alive) return;
      const d = pointToSegment(this.player.x, this.player.y, s.ax, s.ay, s.bx, s.by);
      if (d < 18 && this.player.isDashing) {
        if (now >= this.motelPhaseSlipUntil) {
          this.motelPhaseSlipUntil = now + 700;
          this.fx.sparks(this.player.x, this.player.y, P.neonCyan, 4);
          this.fx.floatText(this.player.x, this.player.y - 18, 'PHASE SLIP', P.neonCyan);
        }
        if (!s.disabled) {
          s.disabled = true;
          const scannerCharge = Math.ceil(this.chargeTarget / Math.max(1, this.motelScanners.length));
          this.addObjectiveProgress((s.ax + s.bx) / 2, (s.ay + s.by) / 2, scannerCharge, '+GRID');
          this.fx.floatText((s.ax + s.bx) / 2, (s.ay + s.by) / 2 - 10, 'SCANNER DISABLED', P.neonCyan);
          this.fx.scanRing((s.ax + s.bx) / 2, (s.ay + s.by) / 2, 36, 260, P.neonCyan);
          const status = this.motelScannerStatus();
          bus.emit(EVT.toast, { text: `SCANNERS ${status.disabled}/${status.total} OFFLINE`, color: status.disabled >= status.total ? 'green' : 'orange' });
        }
        return;
      }
      if (!disabled && d < 15 && now >= this.motelAlertCooldownUntil) this.triggerMotelAlert(s);
    });
  }

  private triggerMotelAlert(scanner: { ax: number; ay: number; bx: number; by: number; label: string }): void {
    const now = this.time.now;
    this.motelAlertCount++;
    this.motelAlertUntil = now + 2600;
    this.motelAlertCooldownUntil = now + 2200;
    this.heat = Math.min(100, this.heat + 16);
    audio.bossWarning();
    this.fx.flash(P.danger, 110);
    this.fx.floatText(this.player.x, this.player.y - 18, 'SCANNER ALERT', P.danger);
    bus.emit(EVT.toast, { text: 'SCANNER ALERT - fight through or Boost out.', color: 'orange' });
    if (this.motelAlertCount <= 1) {
      const mx = (scanner.ax + scanner.bx) / 2;
      const my = (scanner.ay + scanner.by) / 2;
      const p = this.nearestWalkableWorld(mx + Phaser.Math.Between(-22, 22), my + Phaser.Math.Between(-22, 22));
      this.addEnemy(new SweepEnemy(this, p.x, p.y, 'drifter'));
    }
  }

  /* ------------------------------- update -------------------------------- */
  update(_time: number, delta: number): void {
    this.input2.update();
    if (this.input2.pauseJustDown && !this.isPaused && !uiOverlayActive() && !this.gameOverShown) this.setPaused(true);
    if (this.isPaused || this.gameOverShown || this.exiting) return;
    const weaponSlot = this.input2.weaponSlotJustDown;
    if (weaponSlot !== null) this.selectWeaponIndex(weaponSlot);
    else if (this.input2.weaponNextJustDown) this.switchWeapon(1);
    else if (this.input2.weaponPrevJustDown) this.switchWeapon(-1);
    const now = this.time.now;
    const dt = delta / 1000;
    this.updateObjectiveArrow();
    this.updateRouteMarkerProximity();
    this.updateExplorationWashes();
    this.updateMotelScanners(now);
    this.updateEnterFieldEvents();

    // ── aim: right stick if pushed · touch auto-aims nearest · else the mouse ──
    let firing = false;
    const pad = readPad();
    const rx = pad?.axes?.[2] ?? 0;
    const ry = pad?.axes?.[3] ?? 0;
    if (Math.hypot(rx, ry) > 0.35) {
      this.player.setAim(Math.atan2(ry, rx));
      this.reticle.setPosition(this.player.x + Math.cos(this.player.aimAngle) * 64, this.player.y + Math.sin(this.player.aimAngle) * 64);
      firing = true;
    } else if (virtualInput.active) {
      const len = Math.hypot(virtualInput.aimX, virtualInput.aimY);
      if (len > 0.2) this.player.setAim(Math.atan2(virtualInput.aimY, virtualInput.aimX));
      this.reticle.setPosition(this.player.x + Math.cos(this.player.aimAngle) * 64, this.player.y + Math.sin(this.player.aimAngle) * 64);
      firing = virtualInput.fire;
    } else if (touchInput.active) {
      // no second stick on a tablet — auto-aim the nearest threat; keep the
      // current aim (or movement heading) when the arena is momentarily clear.
      const ang = this.nearestEnemyAngle();
      if (ang !== null) this.player.setAim(ang);
      this.reticle.setPosition(this.player.x + Math.cos(this.player.aimAngle) * 64, this.player.y + Math.sin(this.player.aimAngle) * 64);
      firing = touchInput.shootHeld || touchInput.primaryHeld;
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

    const wasShifting = this.player.isDashing;
    this.player.move(this.input2);
    this.updatePhaseBoostPlus(now);
    this.updateHoverTrail(now);
    this.updateCameraElevation(dt);
    if (!wasShifting && this.player.isDashing && loadSave().purchasedUpgrades.includes('ghost-protocol')) {
      this.heat = Math.max(0, this.heat - 18);
      this.fx.sparks(this.player.x, this.player.y, P.scoutCameron, 4);
    }
    const interactJustDown = this.input2.interactJustDown;
    if (this.input2.scanJustDown) this.doScan();
    const autoGravityWell = this.tryGravityWell(52);
    const usedGravityWell = autoGravityWell || (interactJustDown ? this.tryGravityWell() : false);

    if (firing && now >= this.fireAt && this.player.alive) this.fire(now);

    // drive enemies
    const aggro = this.aggro;
    const fireBolt = (x: number, y: number, vx: number, vy: number) => {
      const b = fireFrom(this.enemyShots, x, y, vx, vy, 3000);
      if (b) b.setTint(P.violetGlitch);
    };
    if (this.traverse && this.breachOpen) {
      (this.enemyShots.getChildren() as Projectile[]).forEach((b) => b.active && b.kill());
      (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
        if (!en.active) return;
        (en.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      });
    } else {
      const pathDist = this.buildEnemyPathField(now);
      (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
        const target = this.enemyDriveTarget(en, pathDist);
        en.drive(target.x, target.y, now, fireBolt, aggro, target.pathing);
      });
      this.updateEnemySpecials(now, dt);
      this.applyEnemyContactPressure();
    }
    if (!(this.traverse && this.breachOpen)) this.updateElite(now);
    else this.eliteBeam?.clear();
    this.steerHomingShots(dt);
    if (this.td) this.updateTdVisuals(dt);

    if (this.traverse) {
      // reach the open breach and route onward. Locked until the Node is charged.
      if (
        this.breachOpen &&
        this.player.alive &&
        this.isHoldingAtOpenBreach(now)
      ) {
        this.routeOnward();
      }
    } else {
      // waves mode
      if (this.waveActive && this.spawnQueue.length && now >= this.spawnAt) {
        this.spawnAt = now + (this.spawnInterval * 1000) / aggro;
        this.spawnEnemy(this.spawnQueue.shift()!);
      }
      if (this.waveActive && !this.spawnQueue.length && this.activeEnemyCount() === 0) {
        this.waveActive = false;
        this.awaitingWave = true;
        this.nextWaveAt = now + (this.arena.waves?.[this.waveIdx]?.clearDelay ?? 2) * 1000;
      }
      if (this.awaitingWave && now >= this.nextWaveAt) {
        if (this.shouldHoldStormRelayPhase(now)) {
          this.nextWaveAt = now + 450;
        } else {
          this.awaitingWave = false;
          this.startNextWave();
        }
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
    if (interactJustDown && !usedGravityWell && !this.odActive && this.overdrive >= SWEEP.overdriveMax) this.activateOverdrive();
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
        enemies: this.activeEnemyCount(),
        heat: Math.round(this.heat),
        shards: this.shardsEarned,
      });
    }
  }

  /** push the top-down combat HUD state to UIScene (rendered zoom-1, screen-fixed) */
  private emitHudStats(): void {
    let objectiveTitle = this.traverse
      ? this.breachOpen ? 'Route open' : this.goal.objective
      : this.goal.objective;
    let objectiveSub = this.traverse
      ? this.breachOpen ? this.goal.exitHint : `${this.goal.activeHint} Reward: ${this.goal.rewardName}.`
      : `${this.arena.waves?.[this.waveIdx]?.label ?? `Wave ${this.waveIdx + 1} / ${this.arena.waves?.length ?? 0}`} · Reward: ${this.goal.rewardName}.`;
    if (this.isMillerCrashIntroPending()) {
      objectiveTitle = 'Crash-site recovery';
      objectiveSub = `${this.currentMillerCrashIntroHint()} Reward: Willow Mutation Choice.`;
    } else if (this.arena.id === 'circuit-z2' && !this.breachOpen) {
      const status = this.motelScannerStatus();
      const scannerCopy = status.total ? `Scanners offline ${status.disabled}/${status.total}. ` : '';
      objectiveSub = this.motelAlertUntil > this.time.now
        ? `${scannerCopy}ALERT ACTIVE · fight through it or Boost out. Reward: ${this.goal.rewardName}.`
        : `${scannerCopy}Avoid red scanners or hold Boost through them. Reward: ${this.goal.rewardName}.`;
    } else if (this.arena.id === 'maze-z4' && !this.breachOpen) {
      objectiveSub = this.gravityWell && !this.gravityWell.used
        ? 'Follow LOWER ROWS to the Gravity Well, enter the launch ring, then finish the Crop Circle route.'
        : `Raised Ridge reached. Return to the Crop Circle and finish opening the storm passage. Reward: ${this.goal.rewardName}.`;
    } else if (this.arena.id === 'anomaly-01' && this.waveIdx === 0 && this.awaitingWave && this.stormRelaysActivated.size < 2) {
      objectiveSub = `Classifier Core phase one cleared. Scan Relay Wings ${this.stormRelaysActivated.size}/2 to open the North Rift finale. Reward: ${this.goal.rewardName}.`;
    }
    bus.emit(EVT.hudSweepStats, {
      region: this.arena.label,
      objectiveTitle,
      objectiveSub,
      heat: Math.round(this.heat),
      node: this.breachOpen ? 1 : Phaser.Math.Clamp(this.nodeCharge / this.chargeTarget, 0, 1),
      breachOpen: this.breachOpen,
      traverse: this.traverse,
      enemies: this.activeEnemyCount(),
      wave: this.traverse ? 0 : this.waveIdx + 1,
      waves: this.arena.waves?.length ?? 0,
      combo: this.combo,
      weapon: this.weapon.name,
      overdrive: Phaser.Math.Clamp(this.overdrive / SWEEP.overdriveMax, 0, 1),
      odReady: this.overdrive >= SWEEP.overdriveMax,
      odActive: this.odActive,
    });
  }

  private updateObjectiveArrow(): void {
    if (!this.objectiveArrow || !this.player?.active) return;
    const target = this.currentObjectiveTarget();
    if (!target) {
      this.objectiveArrow.setVisible(false);
      return;
    }
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < BREACH_ENTRY_RADIUS + 10) {
      this.objectiveArrow.setVisible(false);
      return;
    }
    const a = Math.atan2(dy, dx);
    this.objectiveArrow
      .setVisible(true)
      .setText(target.kind === 'breach' ? '◇' : target.kind === 'gravity-well' ? '◎' : target.kind === 'route-beacon' ? '›' : '◆')
      .setColor(css(target.kind === 'breach' ? P.signalGreen : target.kind === 'gravity-well' ? P.cropGlow : target.kind === 'route-beacon' ? P.warning : P.signal))
      .setPosition(this.player.x + Math.cos(a) * 28, this.player.y + Math.sin(a) * 28 - 10)
      .setRotation(a + Math.PI / 4);
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
    this.fx.scanRing(this.player.x, this.player.y, SWEEP.overdriveShockRadius, 520, P.signal);
    bus.emit(EVT.toast, { text: '⚡ SIGNAL OVERDRIVE ⚡', color: 'green' });
    this.showBanner('SIGNAL OVERDRIVE');
    // shockwave clears/damages nearby drones
    (this.enemies.getChildren() as SweepEnemy[]).forEach((en) => {
      if (!en.active) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, en.x, en.y) <= SWEEP.overdriveShockRadius) {
        if (this.applyEnemyDamage(en, SWEEP.overdriveShockDmg, this.player.x, this.player.y, 320, 'blast')) this.killEnemy(en);
      }
    });
  }

  /* ------------------------------ outcomes ------------------------------- */
  private persistArenaEntry(): void {
    if (!this.arena.zoneId && !this.arena.questId) return;
    updateSave((s) => {
      if (this.arena.zoneId) s.currentZone = this.arena.zoneId;
      if (this.arena.questId) {
        s.currentQuest = this.arena.questId;
        const first = quests.quest.id === this.arena.questId ? quests.quest.steps[0]?.id : undefined;
        if (first) s.questStep = first;
      }
    });
    if (this.arena.questId) {
      quests.load(this.arena.questId);
      quests.init();
    }
  }

  private captureWorldHandoff(): SweepWorldHandoff {
    return {
      hp: this.player.hp,
      weaponId: this.weapon.id,
      overdrive: this.overdrive,
      boonScanMul: this.boonScanMul,
      boonFireMul: this.boonFireMul,
      shardsEarned: this.shardsEarned,
      killCount: this.killCount,
      shotCount: this.shotCount,
    };
  }

  private applyWorldHandoff(): void {
    const handoff = this.registry.get(WORLD_HANDOFF_KEY) as SweepWorldHandoff | undefined;
    this.registry.remove(WORLD_HANDOFF_KEY);
    if (!handoff) return;
    const recoveryFloor = Math.ceil(this.player.maxHp * 0.6);
    const recoveredHp = Math.max(handoff.hp, recoveryFloor);
    this.player.hp = Phaser.Math.Clamp(recoveredHp, 1, this.player.maxHp);
    if (recoveredHp > handoff.hp) {
      this.time.delayedCall(420, () => {
        if (!this.player?.active) return;
        this.fx.floatText(this.player.x, this.player.y - 22, 'SYNC RECOVERY', P.signalGreen);
        bus.emit(EVT.toast, { text: 'SYNC RECOVERY — hull stabilized at the route checkpoint.', color: 'green' });
      });
    }
    this.weapon = WEAPONS[handoff.weaponId] ?? WEAPONS.pulse;
    const idx = WEAPON_LOADOUT.findIndex((id) => id === this.weapon.id);
    this.weaponIndex = idx >= 0 ? idx : 0;
    this.overdrive = Phaser.Math.Clamp(handoff.overdrive, 0, SWEEP.overdriveMax);
    this.boonScanMul = handoff.boonScanMul > 0 ? handoff.boonScanMul : 1;
    this.boonFireMul = handoff.boonFireMul > 0 ? handoff.boonFireMul : 1;
    this.shardsEarned = Math.max(0, handoff.shardsEarned);
    this.killCount = Math.max(0, handoff.killCount);
    this.shotCount = Math.max(0, handoff.shotCount);
  }

  /** DEV: move straight to the breach so the route transition fires next update. */
  debugRouteToBreach(suppressRewardModal = false): void {
    if (!this.traverse || !this.player || this.exiting) return;
    this.suppressRewardModalOnce = suppressRewardModal;
    if (!this.breachOpen) this.openBreach();
    this.suppressRewardModalOnce = false;
    this.player.setPosition(this.breachPos.x, this.breachPos.y);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.breachEntryStartedAt = this.time.now - BREACH_ENTRY_DWELL_MS;
  }

  /** traverse complete — move to the next connected top-down area. */
  private routeOnward(): void {
    if (this.exiting) return;
    this.exiting = true;
    const clearBonus = this.arena.clearBonus ?? SWEEP.shardsClearBonus;
    addShards(clearBonus);
    this.shardsEarned += clearBonus;
    if (this.arena.completeZoneOnExit) {
      updateSave((s) => {
        if (!s.completedZones.includes(this.arena.completeZoneOnExit!)) s.completedZones.push(this.arena.completeZoneOnExit!);
        if (this.arena.completeZoneOnExit === 'miller-field') s.flags.millerNodeCharged = true;
        if (this.arena.completeZoneOnExit === 'motel-nowhere') s.flags.motelNodeCharged = true;
        if (this.arena.completeZoneOnExit === 'tiger-stadium') s.flags.townNodeCharged = true;
        if (this.arena.completeZoneOnExit === 'pattersons-orchard') s.flags.orchardNodeCharged = true;
      });
    }
    const nextArena = this.arena.nextArena;
    bus.emit(EVT.toast, { text: nextArena ? `ROUTE — ${this.arena.nextLabel ?? 'NEXT AREA'}` : 'ROUTE COMPLETE', color: 'green' });
    this.fx.staticBurst(360);
    this.fx.flash(P.white, 160);
    this.time.delayedCall(360, () => {
      if (nextArena) {
        this.registry.set(WORLD_HANDOFF_KEY, this.captureWorldHandoff());
        this.registry.set('sweepArenaId', nextArena);
        this.registry.set('gameOverRetryScene', SCENES.sweep);
        this.registry.set('gameOverRetryArenaId', nextArena);
        this.scene.restart();
      } else {
        this.victory();
      }
    });
  }

  private victory(): void {
    if (this.exiting) return;
    this.exiting = true;
    this.awardRegionReward();
    addShards(SWEEP.shardsClearBonus);
    this.shardsEarned += SWEEP.shardsClearBonus;
    audio.doorUnlock();
    this.fx.flash(P.signalGreen, 180);
    bus.emit(EVT.toast, { text: `STORM CLEARED — +${this.shardsEarned} SHARDS`, color: 'green' });
    this.showBanner('SIGNAL HELD');
    updateSave((s) => {
      if (!s.completedZones.includes('skyline-array')) s.completedZones.push('skyline-array');
      s.flags.stormNodeCharged = true;
    });
    // reward system: a Signal Storm was cleared → medal + cache (RewardTriggers)
    bus.emit(EVT.sweepCleared, { combo: this.combo, noHit: this.player.hp >= this.player.maxHp });
    this.time.delayedCall(1200, () => this.exitToMenu());
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

  private exitToMenu(): void {
    audio.transitionRoute();
    this.fx.staticBurst(400);
    this.fx.flash(P.white, 160);
    this.time.delayedCall(350, () => {
      this.scene.stop();
      this.scene.start(SCENES.menu);
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

  /** Per-frame HD visual work. Deliberately cheap: no allocation, no texture
   *  work — only position/depth/alpha on pre-allocated objects. */
  private updateTdVisuals(dt: number): void {
    for (const [host, rig] of this.tdRigs) {
      if (!host.active) { rig.destroy(); this.tdRigs.delete(host); continue; }
      rig.update(dt);
    }
    // one pooled pass places every dynamic shadow
    const casters: Array<{ x: number; y: number; active: boolean; tdShadowW?: number; tdLift?: number }> = [];
    if (this.player.active) casters.push({ x: this.player.x, y: this.player.y + 8, active: true, tdShadowW: 26 });
    (this.enemies.getChildren() as SweepEnemy[]).forEach((e) => {
      if (e.active) casters.push({ x: e.x, y: e.y + 8, active: true, tdShadowW: 22, tdLift: 10 });
    });
    this.tdShadows?.update(casters);

    // ---- close-combat readability -----------------------------------------
    // Pairwise separation so no two drones occupy the same visual position,
    // and a hard push-off ring around the player so a drone can never sit on
    // top of CONTACT-47. This runs AFTER the AI drives, as a position
    // correction only — velocities, damage and aggression are untouched.
    const live = (this.enemies.getChildren() as SweepEnemy[]).filter((e) => e.active);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        live[j].separate(live[i].x, live[i].y, SWEEP.droneSpacing);
      }
      live[i].separate(this.player.x, this.player.y, SWEEP.closeStandoff * 0.82);
    }

    // Readability fallback: a subtle rim behind the player, faded in ONLY while
    // something overlaps his bounds. Not a permanent outline, and not a depth
    // override — he keeps sorting honestly against the world.
    if (this.tdPlayerRim) {
      const near = live.some(
        (e) => Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 30
      );
      const target = near ? 0.55 : 0;
      this.tdPlayerRim.setAlpha(Phaser.Math.Linear(this.tdPlayerRim.alpha, target, 0.18));
      this.tdPlayerRim.setPosition(this.player.x, this.player.y + 2);
      this.tdPlayerRim.setDepth(this.player.depth - 1);
    }
    this.tdNodeRig?.update(dt, this.chargeTarget > 0 ? this.nodeCharge / this.chargeTarget : 0);
    this.tdLight?.update(dt);
  }

  private onShutdown(): void {
    // Restore the 480x270 backbuffer. THIS IS LOAD-BEARING: SHUTDOWN is the one
    // hook that covers every exit path (breach, death, quit-to-menu).
    // Miss it and the next scene lays out 480-coord content in a 1440x810 buffer.
    restoreBase(this);
    resetVirtualInput();
    this.tdPlayerRim?.destroy();
    this.objectiveArrow?.destroy();
    this.exploredWashes.forEach((w) => w.area.destroy());
    this.exploredWashes = [];
    this.hoverTrail.forEach((t) => t.destroy());
    this.hoverTrail = [];
    this.objectiveArrow = undefined;
    this.tdPlayerRim = undefined;
    this.tdRigs.forEach((r) => r.destroy());
    this.tdRigs.clear();
    this.tdNodeRig?.destroy();
    this.tdShadows?.destroy();
    this.tdLight?.destroy();
    this.tdTerrain?.destroy();
    this.tdNodeRig = undefined;
    this.tdShadows = undefined;
    this.tdLight = undefined;
    this.tdTerrain = undefined;
    bus.emit(EVT.hudSweep, { active: false });
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.input.off('wheel', this.onWeaponWheel, this);
  }
}
