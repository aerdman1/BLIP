/**
 * window.__BLIP_TEST_API__ — automation hooks for the AI QA pipeline.
 * Enabled ONLY in dev builds or with ?test=1. Never required for gameplay.
 * Playwright drives quest flow through this instead of guessing from pixels.
 */
import type Phaser from 'phaser';
import { EVT, FRAGMENT_TOTAL, PAD, SCENES } from '../config';
import { ZONE_ROUTES } from '../data/zones';
import { bus } from './EventBus';
import { getSave, recordSetPiece, resetSave, selectSkin, unlockSkin, updateSave } from './SaveSystem';
import { quests } from './QuestSystem';
import { setSimulatedPad, type PadSnapshot } from './PadSim';
import { skinById } from '../data/skins';

// registered live scenes (import types only — avoids runtime cycles)
import type { FieldScene } from '../scenes/FieldScene';
import type { MotelScene } from '../scenes/MotelScene';
import type { StadiumScene } from '../scenes/StadiumScene';
import type { UnderwaterScene } from '../scenes/UnderwaterScene';
import type { OrchardScene } from '../scenes/OrchardScene';
import type { SkylineArrayScene } from '../scenes/SkylineArrayScene';
import type { BlipstreamScene } from '../scenes/BlipstreamScene';
import type { MainMenuScene } from '../scenes/MainMenuScene';

/** semantic virtual-controller input for the headless drive harness (setInput/play).
 *  Axes are -1..1; booleans are held until the next setInput/clearInput. */
export interface VirtualInput {
  moveX?: number; // -1 left … 1 right (side-view walk + top-down X)
  moveY?: number; // -1 up … 1 down (top-down only)
  aimX?: number; // -1..1 right-stick X → top-down aim
  aimY?: number; // -1..1 right-stick Y → top-down aim
  fire?: boolean;
  jump?: boolean;
  dash?: boolean;
  scan?: boolean;
  interact?: boolean;
}

interface SceneRegistry {
  field?: FieldScene;
  motel?: MotelScene;
  stadium?: StadiumScene;
  underwater?: UnderwaterScene;
  orchard?: OrchardScene;
  skyline?: SkylineArrayScene;
  blipstream?: BlipstreamScene;
  menu?: MainMenuScene;
}

const scenes: SceneRegistry = {};
let gameRef: Phaser.Game | null = null;

export function registerScene(
  key: keyof SceneRegistry,
  scene: FieldScene | MotelScene | StadiumScene | UnderwaterScene | OrchardScene | SkylineArrayScene | BlipstreamScene | MainMenuScene
): void {
  (scenes as Record<string, unknown>)[key] = scene;
}

/** the live overworld scene — the side-view playable zones */
function overworld(): FieldScene | MotelScene | StadiumScene | OrchardScene | SkylineArrayScene | undefined {
  return scenes.skyline ?? scenes.orchard ?? scenes.stadium ?? scenes.motel ?? scenes.field;
}

export function unregisterScene(key: keyof SceneRegistry): void {
  delete scenes[key];
}

export function isTestApiEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).has('test');
  } catch {
    return false;
  }
}

const CHECKPOINTS: Record<string, { x: number; y: number }> = {
  // Miller Field 3.0 (176×40 grid)
  spawn: { x: 72, y: 150 }, // spawn ridge (row 10 surface)
  dip: { x: 448, y: 372 }, // dip floor (row 24)
  highMeadow: { x: 592, y: 210 }, // meadow east rim (row 14)
  drones: { x: 1216, y: 400 }, // east valley floor (row 26) — open horizontal line to both drones
  badge: { x: 1360, y: 404 }, // badge field, base of Will's climb (row 26)
  door: { x: 2080, y: 118 }, // node mound top, near the door (row 8)
  node: { x: 2112, y: 118 }, // beside the Blipstream portal (row 8)
  bossArena: { x: 2304, y: 308 }, // boss bowl floor (row 20), 3 tiles WEST of the boss core → face east to shoot it
  // Motel Nowhere (Zone 2)
  motelSpawn: { x: 72, y: 270 },
  motelLot: { x: 328, y: 272 },
  motelDiner: { x: 712, y: 196 },
  motelFuse: { x: 800, y: 196 },
  motelWing: { x: 1000, y: 272 },
  motelBoss: { x: 1300, y: 104 },
};

/* --- semantic "beats" for fun-loop telemetry. px x-ranges mirror data/levels.ts.
 *     getCurrentBeat() maps the player's position to a named beat so QA reports can
 *     say WHERE something felt bad, not just an x-coordinate. --- */
const MILLER_BEATS: Array<{ name: string; x0: number; x1: number }> = [
  { name: 'spawn-ridge', x0: 0, x1: 240 },
  { name: 'scan-dip', x0: 240, x1: 528 },
  { name: 'high-meadow', x0: 528, x1: 688 },
  { name: 'scanner-plateau', x0: 688, x1: 944 },
  { name: 'drone-lowlands', x0: 944, x1: 1456 },
  { name: 'radio-ridge', x0: 1456, x1: 1680 },
  { name: 'ravine', x0: 1680, x1: 1936 },
  { name: 'node-mound', x0: 1936, x1: 2208 },
  { name: 'boss-arena', x0: 2208, x1: 2496 },
  { name: 'road-east', x0: 2496, x1: 2816 },
];
const MOTEL_BEATS: Array<{ name: string; x0: number; x1: number }> = [
  { name: 'motel-lot', x0: 0, x1: 624 },
  { name: 'diner-climb', x0: 624, x1: 800 },
  { name: 'fuse-box', x0: 800, x1: 944 },
  { name: 'dead-wing', x0: 944, x1: 1200 },
  { name: 'motel-boss-arena', x0: 1200, x1: 1536 },
];

function beatFor(scene: string, x: number, y: number): string {
  if (scene === SCENES.blipstream) return 'blipstream-node';
  if (scene === SCENES.underwater) return 'underwater-node';
  if (scene === SCENES.menu) return 'title';
  if (scene === SCENES.gameOver) return 'game-over';
  if (scene === SCENES.stadium) return 'stadium';
  if (scene === SCENES.orchard) return 'orchard';
  if (scene === SCENES.motel) return MOTEL_BEATS.find((b) => x >= b.x0 && x < b.x1)?.name ?? 'motel';
  if (scene === SCENES.field) {
    // Will's optional secret climb overlaps the badge field in x but sits high up
    if (x >= 1328 && x <= 1472 && y < 360) return 'will-climb';
    return MILLER_BEATS.find((b) => x >= b.x0 && x < b.x1)?.name ?? 'miller-field';
  }
  return scene;
}

/** teleportToBeat() targets: a named beat → checkpoint / quest-step / free xy. */
const BEAT_TP: Record<string, { cp?: string; step?: string; xy?: [number, number] }> = {
  'spawn-ridge': { cp: 'spawn' }, spawn: { cp: 'spawn' },
  'scan-dip': { cp: 'dip' }, dip: { cp: 'dip' },
  'high-meadow': { cp: 'highMeadow' },
  'scanner-plateau': { xy: [800, 248] },
  'drone-lowlands': { cp: 'drones' }, drones: { cp: 'drones' },
  'will-climb': { cp: 'badge' }, badge: { cp: 'badge' },
  'radio-ridge': { xy: [1600, 216] },
  ravine: { xy: [1668, 205] }, // west lip of the ravine (col 104 surface) — NOT the void gap
  'node-mound': { cp: 'node' }, node: { cp: 'node' },
  'crop-door': { cp: 'door' }, door: { cp: 'door' },
  'boss-arena': { cp: 'bossArena', step: 'bossFight' },
  'road-east': { xy: [2600, 308] },
  'motel-lot': { cp: 'motelLot' },
  'diner-climb': { cp: 'motelDiner' },
  'fuse-box': { cp: 'motelFuse' },
  'dead-wing': { cp: 'motelWing' },
  'motel-boss-arena': { cp: 'motelBoss' },
};

/** a scene the API may drive: running OR paused (e.g. Command Center open) */
function driveable(s: { scene: Phaser.Scenes.ScenePlugin } | undefined): boolean {
  return !!s && (s.scene.isActive() || s.scene.isPaused());
}

function activeSceneName(): string {
  if (!gameRef) return 'none';
  const order = [SCENES.gameOver, SCENES.sweep, SCENES.blipstream, SCENES.underwater, SCENES.field, SCENES.motel, SCENES.stadium, SCENES.orchard, SCENES.skyline, SCENES.menu, SCENES.boot];
  for (const key of order) {
    // a scene paused by a shell modal (tutorial card, Command Center) is still
    // the scene the player is "in" — count it as active
    if (gameRef.scene.isActive(key) || gameRef.scene.isPaused(key)) return key;
  }
  // sleeping field counts as background
  return gameRef.scene.getScenes(true)[0]?.scene.key ?? 'none';
}

export function installTestAPI(game: Phaser.Game): void {
  gameRef = game;
  if (!isTestApiEnabled()) return;

  const api = {
    ready: (): boolean => activeSceneName() !== 'none',
    getSceneName: (): string => activeSceneName(),

    getState: () => ({
      scene: activeSceneName(),
      quest: { id: quests.quest.id, step: quests.stepId, dronesDestroyed: quests.dronesDestroyed },
      save: getSave(),
      player: api.getPlayerState(),
    }),

    getPlayerState: () => {
      const s = driveable(scenes.blipstream)
        ? scenes.blipstream
        : driveable(scenes.underwater)
          ? scenes.underwater
          : overworld();
      const p = s?.player;
      if (!p || !p.active) return null;
      const body = p.body as Phaser.Physics.Arcade.Body | null;
      return {
        x: Math.round(p.x),
        y: Math.round(p.y),
        vx: Math.round(body?.velocity.x ?? 0),
        vy: Math.round(body?.velocity.y ?? 0),
        hp: p.hp,
        energy: Math.round(p.energy),
        grounded: body?.blocked.down ?? false,
        facing: p.facing,
        god: p.godMode,
        echoActive: p.isEchoActive,
        echoX: Math.round(p.echoPos.x),
        echoY: Math.round(p.echoPos.y),
      };
    },

    getQuestState: () => ({
      quest: quests.quest.id,
      step: quests.stepId,
      objective: quests.step.objective,
      completed: getSave().completedQuestSteps,
    }),

    getSaveData: () => getSave(),
    getDebugFlags: () => getSave().flags,

    startGame: (continueRun = false): boolean => {
      if (driveable(scenes.menu)) {
        if (!continueRun && gameRef) {
          api.enterZone('miller-field');
          return true;
        }
        scenes.menu?.startGame(continueRun);
        return true;
      }
      return false;
    },

    /** deterministic zone entry for tests: set the save + start the scene
     *  directly (no menu camera-fade, which can hang under headless rAF). */
    enterZone: (zoneId: string): boolean => {
      if (!gameRef) return false;
      const route = ZONE_ROUTES[zoneId];
      const FIRST_STEP: Record<string, string> = { 'motel-nowhere': 'arrive', 'tiger-stadium': 'arrive', 'pattersons-orchard': 'arrive' };
      const quest = route?.quest ?? 'the-first-contact';
      const firstStep = FIRST_STEP[zoneId] ?? 'wake';
      updateSave((s) => {
        s.currentZone = zoneId;
        s.currentQuest = quest;
        s.questStep = firstStep;
        s.completedQuestSteps = [];
      });
      quests.load(quest);
      quests.restart();
      const target = route?.scene ?? SCENES.field;
      // stop EVERY gameplay scene (incl. the Sweep + a lingering Game Over) so
      // zone entry is deterministic no matter what mode we were in before.
      [SCENES.menu, SCENES.field, SCENES.motel, SCENES.stadium, SCENES.orchard, SCENES.skyline, SCENES.underwater, SCENES.blipstream, SCENES.sweep, SCENES.gameOver].forEach((k) => {
        if (gameRef!.scene.isActive(k)) gameRef!.scene.stop(k);
      });
      gameRef.scene.start(target);
      return true;
    },

    /** deterministic top-down arena entry for retry/death routing QA. */
    enterSweep: (arenaId = 'surface-z1', returnScene = SCENES.field): boolean => {
      if (!gameRef) return false;
      updateSave((s) => {
        s.currentZone = 'miller-field';
        s.currentQuest = 'the-first-contact';
      });
      gameRef.registry.set('sweepArenaId', arenaId);
      gameRef.registry.set('sweepReturnScene', returnScene);
      gameRef.registry.set('gameOverRetryScene', SCENES.sweep);
      gameRef.registry.set('gameOverRetryArenaId', arenaId);
      [SCENES.menu, SCENES.field, SCENES.motel, SCENES.stadium, SCENES.orchard, SCENES.skyline, SCENES.underwater, SCENES.blipstream, SCENES.sweep, SCENES.gameOver].forEach((k) => {
        if (gameRef!.scene.isActive(k) || gameRef!.scene.isPaused(k)) gameRef!.scene.stop(k);
      });
      gameRef.scene.start(SCENES.sweep);
      return true;
    },

    /** force a Sweep death through the real GameOver path. */
    killSweepPlayer: (): boolean => {
      if (!gameRef || !(gameRef.scene.isActive(SCENES.sweep) || gameRef.scene.isPaused(SCENES.sweep))) return false;
      const sc = gameRef.scene.getScene(SCENES.sweep) as unknown as {
        player?: { hp: number };
        onDeath?: () => void;
      };
      if (!sc?.player || typeof sc.onDeath !== 'function') return false;
      sc.player.hp = 0;
      sc.onDeath();
      return true;
    },

    teleportToCheckpoint: (id: string): boolean => {
      const cp = CHECKPOINTS[id];
      const f = overworld();
      if (!cp || !f || !driveable(f)) return false;
      f.player.setPosition(cp.x, cp.y);
      (f.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return true;
    },

    listCheckpoints: (): string[] => Object.keys(CHECKPOINTS),

    /** free-position teleport for level QA (probes geometry between checkpoints) */
    teleportTo: (x: number, y: number): boolean => {
      const f = overworld();
      if (!f || !driveable(f)) return false;
      f.player.setPosition(x, y);
      (f.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return true;
    },

    giveAbility: (id: string): void => {
      updateSave((s) => {
        if (!s.unlockedAbilities.includes(id)) s.unlockedAbilities.push(id);
      });
    },

    setQuestStep: (stepId: string): boolean => {
      const ok = quests.jumpTo(stepId);
      if (!ok) return false;
      const f = scenes.field;
      // steps past the puzzle imply an opened door — mirror the world state
      if (quests.isAtOrPast('bossFight')) {
        updateSave((s) => {
          s.flags.nodeACompleted = true;
          s.flags.doorOpened = true;
        });
        if (driveable(f)) {
          f?.door.setOpenInstant();
          f?.portal.setCompleted();
        }
      }
      return true;
    },

    resetSave: (): void => {
      // restart quest memory FIRST — its autosave would otherwise re-create
      // the storage key we are about to wipe
      quests.restart();
      resetSave();
    },

    toggleGodMode: (enabled: boolean): boolean => {
      const s = driveable(scenes.blipstream) ? scenes.blipstream : overworld();
      if (!s?.player) return false;
      s.player.godMode = enabled;
      return enabled;
    },

    completeBlipstreamPuzzle: (): boolean => {
      if (gameRef && (gameRef.scene.isActive(SCENES.sweep) || gameRef.scene.isPaused(SCENES.sweep))) {
        const sweep = gameRef.scene.getScene(SCENES.sweep) as unknown as { debugSkipToBreach?: () => void };
        sweep.debugSkipToBreach?.();
        return true;
      }
      if (driveable(scenes.blipstream)) {
        scenes.blipstream?.solveAndExit();
        return true;
      }
      if (driveable(scenes.underwater)) {
        scenes.underwater?.solveAndExit();
        return true;
      }
      if (driveable(scenes.field)) {
        scenes.field?.applyNodeSolved();
        return true;
      }
      if (driveable(scenes.motel)) {
        scenes.motel?.applyWingPowered();
        return true;
      }
      if (driveable(scenes.stadium)) {
        scenes.stadium?.applyPoolSolved();
        return true;
      }
      if (driveable(scenes.orchard)) {
        scenes.orchard?.applyCropDrawn();
        return true;
      }
      return false;
    },

    spawnBoss: (): boolean => {
      if (driveable(scenes.motel) && scenes.motel) {
        scenes.motel.spawnBoss();
        return true;
      }
      if (driveable(scenes.stadium) && scenes.stadium) {
        scenes.stadium.spawnBoss();
        return true;
      }
      if (driveable(scenes.orchard) && scenes.orchard) {
        scenes.orchard.spawnBoss();
        return true;
      }
      const f = scenes.field;
      if (!driveable(f) || !f) return false;
      if (!f.door.isOpen) f.door.setOpenInstant();
      f.spawnBoss();
      return true;
    },

    getBossState: (): { state: string; hp: number; exposed: boolean; telegraphing: boolean } | null => {
      const b = overworld()?.boss;
      if (!b) return null;
      return { state: b.state, hp: b.hp, exposed: b.exposed, telegraphing: (b as unknown as { telegraphing?: boolean }).telegraphing ?? false };
    },

    /** Zone 2 debug: neon-circuit power + detection state (null outside Motel) */
    getMotelDebug: () => (driveable(scenes.motel) ? scenes.motel?.debugState ?? null : null),

    /** shortcut for CC tests: award a scout badge through the same save path as pickup */
    giveScoutBadge: (scoutId: string, logId: string): void => {
      updateSave((s) => {
        if (scoutId === 'will') s.flags.willBadgeCollected = true;
        if (!s.discoveredScoutBadges.includes(scoutId)) s.discoveredScoutBadges.push(scoutId);
        if (logId && !s.discoveredScoutLogs.includes(logId)) s.discoveredScoutLogs.push(logId);
      });
    },

    /* ---- Signal Skins ---- */
    getSkinState: () => {
      const s = getSave();
      return { selected: s.selectedSkin, unlocked: s.unlockedSkins, sets: s.signalSets };
    },
    unlockSkin: (id: string): void => unlockSkin(id),
    unlockAllSkins: (): void => ['will', 'chip', 'henry', 'cameron', 'danny'].forEach(unlockSkin),
    selectSkin: (id: string): boolean => {
      selectSkin(id);
      const applied = getSave().selectedSkin === id;
      if (applied) {
        const skin = skinById(id);
        bus.emit(EVT.skinSelected, { id: skin.id, name: skin.name, color: skin.color, live: true });
      }
      return applied;
    },
    recordSetPiece: (scoutId: string, piece: 'badge' | 'log' | 'relic'): boolean => recordSetPiece(scoutId, piece),
    completeSet: (scoutId: string): boolean => {
      const f = overworld();
      if (!driveable(f) || !f) return false;
      f.apiCompleteSet(scoutId);
      return getSave().unlockedSkins.includes(scoutId);
    },
    scan: (): void => {
      const f = overworld();
      if (driveable(f) && f) (f as unknown as { apiScan?: () => void }).apiScan?.();
    },
    echoToggle: (): void => {
      const f = overworld();
      if (driveable(f) && f) (f as unknown as { apiEchoToggle?: () => void }).apiEchoToggle?.();
    },
    getDroneStates: (): Array<{ x: number; y: number; stunned: boolean }> => {
      const f = overworld();
      return driveable(f) && f
        ? (f as unknown as { apiDroneStates?: () => Array<{ x: number; y: number; stunned: boolean }> }).apiDroneStates?.() ?? []
        : [];
    },

    damageBoss: (amount: number): boolean => {
      const b = overworld()?.boss;
      if (!b) return false;
      b.debugDamage(amount);
      return true;
    },

    collectFragment: (): boolean => {
      const f = overworld();
      if (!driveable(f) || !f) return false;
      f.apiCollectFragment();
      return true;
    },

    /** Zone 3: dive into the rec pool (→ UnderwaterScene) deterministically */
    divePool: (): boolean => {
      if (driveable(scenes.stadium) && scenes.stadium) {
        scenes.stadium.enterUnderwater(true);
        return true;
      }
      return false;
    },

    openCommandCenter: (): void => bus.emit(EVT.ccOpen, {}),
    closeCommandCenter: (): void => bus.emit(EVT.ccClose, {}),
    dismissTransmission: (): void => bus.emit(EVT.transmissionClosed, { force: true }),

    /* ---- QA fun-loop inspectors (read-only) + beat navigation ---- */
    getCameraState: () => {
      const s = driveable(scenes.blipstream)
        ? scenes.blipstream
        : driveable(scenes.underwater)
          ? scenes.underwater
          : overworld();
      const cam = s?.cameras?.main;
      if (!cam) return null;
      const dz = cam.deadzone;
      const b = cam.getBounds();
      return {
        scrollX: Math.round(cam.scrollX),
        scrollY: Math.round(cam.scrollY),
        midX: Math.round(cam.midPoint.x),
        midY: Math.round(cam.midPoint.y),
        zoom: cam.zoom,
        followOffsetX: Math.round(cam.followOffset.x),
        followOffsetY: Math.round(cam.followOffset.y),
        deadzone: dz ? { x: Math.round(dz.x), y: Math.round(dz.y), width: Math.round(dz.width), height: Math.round(dz.height) } : null,
        worldView: { x: Math.round(cam.worldView.x), y: Math.round(cam.worldView.y), width: Math.round(cam.worldView.width), height: Math.round(cam.worldView.height) },
        worldWidth: Math.round(b.width),
        worldHeight: Math.round(b.height),
      };
    },

    getCurrentBeat: (): string => {
      const p = api.getPlayerState();
      return beatFor(activeSceneName(), p?.x ?? 0, p?.y ?? 0);
    },

    getLevelProgress: () => {
      const p = api.getPlayerState();
      const save = getSave();
      const cam = overworld()?.cameras?.main;
      const worldW = cam ? Math.round(cam.getBounds().width) : 0;
      const x = p?.x ?? 0;
      return {
        zone: save.currentZone,
        quest: quests.quest.id,
        step: quests.stepId,
        beat: api.getCurrentBeat(),
        playerX: x,
        worldWidth: worldW,
        percent: worldW > 0 ? Math.round((x / worldW) * 100) : 0,
        completedSteps: save.completedQuestSteps,
        fragments: save.signalFragments,
        flags: save.flags,
      };
    },

    getCollectiblesState: () => {
      const save = getSave();
      return {
        fragments: save.signalFragments,
        fragmentTotal: FRAGMENT_TOTAL,
        discoveredBadges: save.discoveredScoutBadges,
        discoveredLogs: save.discoveredScoutLogs,
        willBadgeCollected: save.flags.willBadgeCollected,
        firstFragmentCollected: save.flags.firstFragmentCollected,
        revealedHiddenPath: save.flags.revealedHiddenPath,
        signalSets: save.signalSets,
        unlockedSkins: save.unlockedSkins,
      };
    },

    getCheckpointState: () => {
      const f = overworld();
      const save = getSave();
      const p = api.getPlayerState();
      let nearest: string | null = null;
      let best = Infinity;
      if (p) {
        for (const [id, cp] of Object.entries(CHECKPOINTS)) {
          const d = Math.abs(cp.x - p.x) + Math.abs(cp.y - p.y);
          if (d < best) {
            best = d;
            nearest = id;
          }
        }
      }
      const ls = (f as unknown as { apiLastSafe?: { x: number; y: number } })?.apiLastSafe;
      return {
        lastSafe: ls ? { x: Math.round(ls.x), y: Math.round(ls.y) } : null,
        nearestCheckpoint: nearest,
        deaths: save.playerStats.deaths,
      };
    },

    /** semantic beat navigation: maps a beat name → checkpoint / quest-step / free xy */
    teleportToBeat: (name: string): boolean => {
      const spec = BEAT_TP[name];
      if (!spec) return false;
      if (spec.step) api.setQuestStep(spec.step);
      if (spec.cp) return api.teleportToCheckpoint(spec.cp);
      if (spec.xy) return api.teleportTo(spec.xy[0], spec.xy[1]);
      return false;
    },

    enableGodMode: (): boolean => api.toggleGodMode(true),
    disableGodMode: (): boolean => api.toggleGodMode(false),

    /** one-call bundle of every inspector — the fun-loop telemetry snapshot */
    collectDebugSnapshot: () => ({
      scene: activeSceneName(),
      fps: gameRef ? Math.round(gameRef.loop.actualFps) : 0,
      player: api.getPlayerState(),
      camera: api.getCameraState(),
      quest: api.getQuestState(),
      level: api.getLevelProgress(),
      beat: api.getCurrentBeat(),
      boss: api.getBossState(),
      collectibles: api.getCollectiblesState(),
      checkpoint: api.getCheckpointState(),
    }),

    /**
     * Gamepad simulation for automated tests (Playwright cannot emulate HID
     * pads). The snapshot feeds PlayerInput + shell navigation exactly like a
     * real controller. Pass null to disconnect.
     * Example: api.simulatePad({ connected:true, axes:[1,0], buttons:{0:true} })
     */
    simulatePad: (state: PadSnapshot | null): void => setSimulatedPad(state),

    /* ================= HEADLESS DRIVE HARNESS =================================
     * The preview/AI tab runs in the BACKGROUND, where the browser suspends
     * requestAnimationFrame — so Phaser's own loop can't advance and you can't
     * "watch" the game run. advanceFrames() drives the loop BY HAND with a fixed
     * timestep: deterministic, focus-independent. Combine with setInput() (a
     * virtual controller) to actually PLAY the game end-to-end from automation.
     *   api.setInput({ moveX: 1, fire: true }); api.advanceFrames(90);
     *   api.play({ dash: true }, 12);            // one dash, ~0.2s of frames
     * ========================================================================= */

    /** Advance the game loop N frames at a fixed dt, ignoring browser rAF throttling.
     *  Returns how many frames ran + fps + any error thrown mid-loop (which would
     *  otherwise be swallowed inside the loop). Hard 8s real-time wall as a backstop. */
    advanceFrames: (frames = 60, dtMs = 1000 / 60): { framesRun: number; fps: number; scene: string; error: string | null } => {
      if (!gameRef) return { framesRun: 0, fps: 0, scene: 'none', error: 'no game' };
      const loop = gameRef.loop as unknown as { step: (t: number) => void };
      let t = performance.now();
      let run = 0;
      let error: string | null = null;
      const startReal = performance.now();
      try {
        for (let i = 0; i < frames; i++) {
          t += dtMs;
          loop.step(t);
          run++;
          if (performance.now() - startReal > 8000) {
            error = `time-wall (8s) after ${run} frames`;
            break;
          }
        }
      } catch (e) {
        error = (e as Error)?.message ?? String(e);
      }
      return { framesRun: run, fps: Math.round(gameRef.loop.actualFps), scene: activeSceneName(), error };
    },

    /** Virtual controller: semantic input → a FRESH pad snapshot (a new object so
     *  just-pressed edges register). Held until the next setInput/clearInput. Edge
     *  actions (dash/scan/jump/interact) fire once per press — set true, step a
     *  frame, then set false to press again. */
    setInput: (input: VirtualInput): void => {
      const buttons: Record<number, boolean> = {};
      if (input.fire) {
        buttons[PAD.shoot] = true;
        buttons[PAD.shootAlt] = true;
      }
      if (input.jump) buttons[PAD.jump] = true;
      if (input.dash) buttons[PAD.dash] = true;
      if (input.scan) buttons[PAD.scan] = true;
      if (input.interact) buttons[PAD.interact] = true;
      setSimulatedPad({
        connected: true,
        axes: [input.moveX ?? 0, input.moveY ?? 0, input.aimX ?? 0, input.aimY ?? 0],
        buttons,
        id: 'blip-ai-virtual-pad',
      });
    },

    /** release every virtual input (neutral sticks, no buttons) */
    clearInput: (): void => setSimulatedPad({ connected: true, axes: [0, 0, 0, 0], buttons: {}, id: 'blip-ai-virtual-pad' }),

    /** The core "play" primitive: apply input, advance N frames, return a snapshot
     *  of what happened (works in side-view AND top-down scenes). */
    play: (input: VirtualInput, frames = 60, dtMs = 1000 / 60) => {
      api.setInput(input);
      const r = api.advanceFrames(frames, dtMs);
      return { ...r, player: api.getPlayerState() ?? api.getSweepState() };
    },

    /** Top-down (SweepScene) player state — getPlayerState() covers the side-view
     *  scenes; this covers the Sweep/Fold combat where the player is a BlipCraft. */
    getSweepState: () => {
      if (!gameRef || !(gameRef.scene.isActive(SCENES.sweep) || gameRef.scene.isPaused(SCENES.sweep))) return null;
      const sc = gameRef.scene.getScene(SCENES.sweep) as unknown as {
        player?: { x: number; y: number; hp: number; alive: boolean; aimAngle?: number; active: boolean; body: Phaser.Physics.Arcade.Body | null };
        enemies?: { countActive?: (a: boolean) => number };
      } | null;
      const p = sc?.player;
      if (!p || !p.active) return null;
      const body = p.body;
      return {
        scene: 'sweep',
        x: Math.round(p.x),
        y: Math.round(p.y),
        vx: Math.round(body?.velocity.x ?? 0),
        vy: Math.round(body?.velocity.y ?? 0),
        hp: p.hp,
        alive: p.alive,
        aimAngle: +(p.aimAngle ?? 0).toFixed(2),
        enemies: sc?.enemies?.countActive?.(true) ?? 0,
      };
    },
  };

  (window as unknown as Record<string, unknown>).__BLIP_TEST_API__ = api;
}
