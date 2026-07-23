/**
 * window.__BLIP_TEST_API__ — automation hooks for the top-down BLIP runtime.
 * Enabled only in dev builds or with ?test=1.
 */
import Phaser from 'phaser';
import { EVT, SCENES, type FilterId, type SweepEnemyKind } from '../config';
import { bus } from './EventBus';
import { settings } from './Settings';
import { getSave, resetSave, selectSkin, unlockSkin, updateSave } from './SaveSystem';
import { driveVirtualInput, resetVirtualInput } from './VirtualInput';
import { quests } from './QuestSystem';
import { rewards } from './RewardSystem';
import type { CacheType } from '../data/caches';
import { skinById } from '../data/skins';
import type { MainMenuScene } from '../scenes/MainMenuScene';

export interface VirtualInput {
  moveX?: number;
  moveY?: number;
  aimX?: number;
  aimY?: number;
  fire?: boolean;
  dash?: boolean;
  scan?: boolean;
  interact?: boolean;
}

const dir = (v: unknown): -1 | 0 | 1 => (typeof v === 'number' && v < -0.1 ? -1 : typeof v === 'number' && v > 0.1 ? 1 : 0);

interface SceneRegistry {
  menu?: MainMenuScene;
}

const scenes: SceneRegistry = {};
let gameRef: Phaser.Game | null = null;

const ARENA_BY_ZONE: Record<string, string> = {
  'miller-field': 'surface-z1',
  'motel-nowhere': 'circuit-z2',
  'tiger-stadium': 'town-z3',
  'pattersons-orchard': 'maze-z4',
  'skyline-array': 'anomaly-01',
};

const ZONE_BY_ARENA = Object.fromEntries(Object.entries(ARENA_BY_ZONE).map(([zone, arena]) => [arena, zone]));

const QUEST_BY_ZONE: Record<string, string> = {
  'miller-field': 'the-first-contact',
  'motel-nowhere': 'the-long-night',
  'tiger-stadium': 'friday-night-lights',
  'pattersons-orchard': 'the-endless-harvest',
  'skyline-array': 'the-sky-listens',
};

const FIRST_STEP_BY_ZONE: Record<string, string> = {
  'miller-field': 'wake',
  'motel-nowhere': 'arrive',
  'tiger-stadium': 'enterStadium',
  'pattersons-orchard': 'enterOrchard',
  'skyline-array': 'enterSkyline',
};

export function registerScene(key: keyof SceneRegistry, scene: MainMenuScene): void {
  scenes[key] = scene;
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

function activeSceneName(): string {
  if (!gameRef) return 'none';
  const order = [SCENES.gameOver, SCENES.sweep, SCENES.menu, SCENES.boot];
  for (const key of order) {
    if (gameRef.scene.isActive(key) || gameRef.scene.isPaused(key)) return key;
  }
  return gameRef.scene.getScenes(true)[0]?.scene.key ?? 'none';
}

function stopGameplayScenes(game: Phaser.Game): void {
  [SCENES.menu, SCENES.sweep, SCENES.gameOver].forEach((key) => {
    if (game.scene.isActive(key) || game.scene.isPaused(key)) game.scene.stop(key);
  });
}

function sweepScene(): Phaser.Scene | null {
  if (!gameRef) return null;
  if (!gameRef.scene.isActive(SCENES.sweep) && !gameRef.scene.isPaused(SCENES.sweep)) return null;
  return gameRef.scene.getScene(SCENES.sweep);
}

function startSweep(arenaId: string, zoneId = ZONE_BY_ARENA[arenaId] ?? 'miller-field'): boolean {
  if (!gameRef) return false;
  const quest = QUEST_BY_ZONE[zoneId] ?? 'the-first-contact';
  const step = FIRST_STEP_BY_ZONE[zoneId] ?? 'wake';
  updateSave((s) => {
    s.currentZone = zoneId;
    s.currentQuest = quest;
    s.questStep = step;
  });
  quests.load(quest);
  quests.init();
  if (quests.stepId !== step) quests.moveToStep(step);
  bus.emit(EVT.menuActive, { active: false });
  stopGameplayScenes(gameRef);
  gameRef.registry.set('sweepArenaId', arenaId);
  gameRef.registry.set('gameOverRetryScene', SCENES.sweep);
  gameRef.registry.set('gameOverRetryArenaId', arenaId);
  gameRef.scene.start(SCENES.sweep, { arenaId, zoneId });
  return true;
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
      const sweep = sweepScene() as (Phaser.Scene & {
        player?: Phaser.GameObjects.Sprite & { hp?: number; maxHp?: number; alive?: boolean; aimAngle?: number; godMode?: boolean };
      }) | null;
      const player = sweep?.player;
      if (!player || !player.active) return null;
      const body = player.body as Phaser.Physics.Arcade.Body | null;
      return {
        x: Math.round(player.x),
        y: Math.round(player.y),
        vx: Math.round(body?.velocity.x ?? 0),
        vy: Math.round(body?.velocity.y ?? 0),
        hp: player.hp ?? 0,
        energy: Math.round((player as { boostEnergyValue?: number }).boostEnergyValue ?? 0),
        grounded: true,
        facing: (player.aimAngle ?? 0) > Math.PI / 2 || (player.aimAngle ?? 0) < -Math.PI / 2 ? -1 : 1,
        god: player.godMode ?? false,
        echoActive: false,
        echoX: Math.round(player.x),
        echoY: Math.round(player.y),
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
    getRewardState: () => rewards.state(),

    grantCache: (cacheType: CacheType = 'small-signal', count = 1): boolean => {
      for (let i = 0; i < count; i++) rewards.grantCache(cacheType);
      return true;
    },
    openCache: (cacheType: CacheType = 'small-signal') => rewards.openCache(cacheType),
    forceOwnReward: (id: string): boolean => {
      rewards.grantReward(id);
      return rewards.owns(id);
    },
    showRewardBanner: (payload: Partial<{ kind: string; title: string; sub: string; desc: string; color: string; icon: string; rarity: string; big: boolean }> = {}): boolean => {
      bus.emit(EVT.rewardBanner, {
        kind: payload.kind ?? 'test',
        title: payload.title ?? 'TEST UNLOCK',
        sub: payload.sub ?? 'SIGNAL PRIZE',
        desc: payload.desc ?? 'Automation-only reward modal.',
        color: payload.color ?? '#a8ff3e',
        icon: payload.icon ?? 'trophy-cache',
        rarity: payload.rarity ?? 'rare',
        big: payload.big ?? false,
      });
      return true;
    },
    equipReward: (id: string): boolean => {
      rewards.equip(id);
      return true;
    },

    startGame: (continueRun = false): boolean => {
      if (scenes.menu) {
        scenes.menu.startGame(continueRun);
        return true;
      }
      return startSweep('surface-z1', 'miller-field');
    },
    enterZone: (zoneId: string): boolean => startSweep(ARENA_BY_ZONE[zoneId] ?? 'surface-z1', zoneId),
    enterSweep: (arenaId = 'surface-z1'): boolean => startSweep(arenaId),
    completeRoute: (): boolean => {
      const sweep = sweepScene() as (Phaser.Scene & { debugRouteToBreach?: (suppressRewardModal?: boolean) => void }) | null;
      if (!sweep?.debugRouteToBreach) return false;
      (window as unknown as { __BLIP_SUPPRESS_REWARD_MODALS_UNTIL?: number }).__BLIP_SUPPRESS_REWARD_MODALS_UNTIL = performance.now() + 1800;
      sweep.debugRouteToBreach(true);
      return true;
    },
    openRouteForInspection: (): boolean => {
      const sweep = sweepScene() as (Phaser.Scene & { debugOpenRouteForInspection?: () => boolean }) | null;
      return sweep?.debugOpenRouteForInspection?.() ?? false;
    },
    disableMotelScannersForInspection: (): boolean => {
      const sweep = sweepScene() as (Phaser.Scene & { debugDisableMotelScannersForInspection?: () => boolean }) | null;
      return sweep?.debugDisableMotelScannersForInspection?.() ?? false;
    },
    driveAi: (input: Partial<VirtualInput> & { dashQueued?: boolean; dashHeld?: boolean; scanQueued?: boolean; interactQueued?: boolean; weaponNextQueued?: boolean; weaponSlotQueued?: 0 | 1 | 2 | null } = {}): boolean => {
      driveVirtualInput({
        active: true,
        moveX: dir(input.moveX),
        moveY: dir(input.moveY),
        aimX: typeof input.aimX === 'number' ? input.aimX : undefined,
        aimY: typeof input.aimY === 'number' ? input.aimY : undefined,
        fire: input.fire === true,
        dashHeld: input.dashHeld === true || input.dash === true,
        dashQueued: input.dashQueued === true,
        scanQueued: input.scan === true || input.scanQueued === true,
        interactQueued: input.interact === true || input.interactQueued === true,
        weaponNextQueued: input.weaponNextQueued === true,
        weaponSlotQueued: input.weaponSlotQueued,
      });
      return true;
    },
    stopAi: (): boolean => {
      resetVirtualInput();
      return true;
    },
    getAiPerception: () => {
      const sweep = sweepScene() as (Phaser.Scene & { debugAiPerception?: () => unknown }) | null;
      return sweep?.debugAiPerception?.() ?? null;
    },
    getSweepRenderState: () => {
      const sweep = sweepScene() as (Phaser.Scene & {
        arena?: { id?: string; label?: string };
        td?: boolean;
        tdBiome?: {
          id?: string;
          atlas?: string;
          tiles?: Record<string, string>;
          skirt?: readonly string[];
          scatter?: readonly string[];
          bank?: readonly string[];
          landmarks?: ReadonlyArray<readonly [string, string | null, number]>;
          canopy?: string | null;
        };
        tdArt?: { hd?: boolean };
      }) | null;
      const biome = sweep?.tdBiome;
      const atlasKey = biome?.atlas ? `td-atlas:${biome.atlas}` : '';
      const atlas = atlasKey ? sweep?.textures.get(atlasKey) : null;
      const missingTiles = biome?.tiles ? Object.values(biome.tiles).filter((key) => !sweep?.textures.exists(key)) : [];
      const missingFrames = biome
        ? [
            ...(biome.skirt ?? []),
            ...(biome.scatter ?? []),
            ...(biome.bank ?? []),
            ...((biome.landmarks ?? []).flatMap(([body, emis]) => (emis ? [body, emis] : [body]))),
            ...(biome.canopy ? [biome.canopy] : []),
          ].filter((key, i, arr) => arr.indexOf(key) === i && !sweep?.textures.exists(key))
        : [];
      const missingAtlasFrames = biome
        ? [
            ...(biome.skirt ?? []),
            ...(biome.scatter ?? []),
            ...(biome.bank ?? []),
            ...((biome.landmarks ?? []).flatMap(([body, emis]) => (emis ? [body, emis] : [body]))),
            ...(biome.canopy ? [biome.canopy] : []),
          ].filter((key, i, arr) => arr.indexOf(key) === i && atlas && !atlas.has(key))
        : [];
      return sweep
        ? {
            hdActive: sweep.td === true,
            arenaId: sweep.arena?.id ?? '',
            arenaLabel: sweep.arena?.label ?? '',
            biome: biome?.id ?? '',
            atlas: biome?.atlas ?? '',
            artReady: sweep.tdArt?.hd === true,
            missingTiles,
            missingFrames,
            missingAtlasFrames,
          }
        : null;
    },
    setScreenFilter: (id: FilterId = 'none'): boolean => {
      settings.set('filter', id);
      return settings.get('filter') === id;
    },
    setScreenFilterIntensity: (value = 1): boolean => {
      settings.set('filterIntensity', Math.max(0, Math.min(1, value)));
      return Math.abs(settings.get('filterIntensity') - Math.max(0, Math.min(1, value))) < 0.001;
    },
    getScreenFilterState: () => {
      const scene = sweepScene() ?? (gameRef?.scene.isActive(SCENES.menu) ? gameRef.scene.getScene(SCENES.menu) : null);
      const cam = scene?.cameras.main;
      const postPipelines = ((cam as unknown as { postPipelines?: unknown[] })?.postPipelines ?? []) as unknown[];
      const first = postPipelines[0] as { strength?: number; preset?: string } | undefined;
      return scene && cam
        ? {
            scene: scene.scene.key,
            filter: settings.get('filter'),
            filterIntensity: settings.get('filterIntensity'),
            renderer: gameRef?.renderer.type ?? 0,
            webgl: gameRef?.renderer.type === Phaser.WEBGL,
            postPipelineCount: postPipelines.length,
            postPipelines: postPipelines.map((p) => (p as { constructor?: { name?: string } }).constructor?.name ?? 'unknown'),
            strength: first?.strength ?? 0,
            preset: first?.preset ?? '',
          }
        : null;
    },
    setSweepWeapon: (id = 'arc'): boolean => {
      const sweep = sweepScene() as (Phaser.Scene & { debugSetWeapon?: (id: string) => boolean }) | null;
      return sweep?.debugSetWeapon?.(id) ?? false;
    },
    switchSweepWeapon: (delta = 1): boolean => {
      const sweep = sweepScene() as (Phaser.Scene & { debugSwitchWeapon?: (delta: number) => boolean }) | null;
      return sweep?.debugSwitchWeapon?.(delta) ?? false;
    },
    damageSweepPlayer: (amount = 1): boolean => {
      const sweep = sweepScene() as (Phaser.Scene & { debugDamagePlayer?: (amount: number) => boolean }) | null;
      return sweep?.debugDamagePlayer?.(amount) ?? false;
    },
    setPlayerWorldPosition: (x: number, y: number): boolean => {
      const sweep = sweepScene() as (Phaser.Scene & { debugSetPlayerWorldPosition?: (x: number, y: number) => boolean }) | null;
      return sweep?.debugSetPlayerWorldPosition?.(x, y) ?? false;
    },
    getSweepRuntimeState: () => {
      const sweep = sweepScene() as (Phaser.Scene & { debugRuntimeState?: () => unknown }) | null;
      return sweep?.debugRuntimeState?.() ?? null;
    },
    startEnemyProbe: (kind: SweepEnemyKind): boolean => {
      const sweep = sweepScene() as (Phaser.Scene & { debugStartEnemyProbe?: (kind: SweepEnemyKind) => boolean }) | null;
      return sweep?.debugStartEnemyProbe?.(kind) ?? false;
    },
    getCombatSnapshot: () => {
      const sweep = sweepScene() as (Phaser.Scene & { debugCombatSnapshot?: () => unknown }) | null;
      return sweep?.debugCombatSnapshot?.() ?? null;
    },
    fireAtProbeEnemy: (): boolean => {
      const sweep = sweepScene() as (Phaser.Scene & { debugFireAtProbeEnemy?: () => boolean }) | null;
      return sweep?.debugFireAtProbeEnemy?.() ?? false;
    },
    forceSweepDeath: (): boolean => {
      const sweep = sweepScene() as (Phaser.Scene & { debugForceDeath?: () => boolean }) | null;
      return sweep?.debugForceDeath?.() ?? false;
    },

    resetSave: (): boolean => {
      quests.restart();
      resetSave();
      return true;
    },

    toggleGodMode: (enabled = true): boolean => {
      const sweep = sweepScene() as (Phaser.Scene & { player?: { godMode?: boolean } }) | null;
      if (sweep?.player) sweep.player.godMode = enabled;
      bus.emit(EVT.godMode, { on: enabled });
      return true;
    },

    unlockSkin: (id: string): boolean => {
      if (!skinById(id)) return false;
      unlockSkin(id);
      return true;
    },
    selectSkin: (id: string): boolean => {
      selectSkin(id);
      return true;
    },

    openCommandCenter: (): boolean => {
      bus.emit(EVT.ccOpen, {});
      return true;
    },
    closeCommandCenter: (): boolean => {
      bus.emit(EVT.ccClose, {});
      return true;
    },
    dismissTransmission: (): boolean => {
      bus.emit(EVT.transmissionClosed, {});
      return true;
    },

    getCameraState: () => {
      const sweep = sweepScene();
      const cam = sweep?.cameras.main;
      return cam
        ? { scrollX: Math.round(cam.scrollX), scrollY: Math.round(cam.scrollY), zoom: cam.zoom }
        : null;
    },
    getSweepState: () => {
      const sweep = sweepScene() as (Phaser.Scene & {
        arena?: { id: string; name: string };
        player?: { x: number; y: number; hp?: number; active?: boolean };
        enemies?: { countActive?: (active?: boolean) => number };
      }) | null;
      return sweep
        ? {
            arena: sweep.arena?.id ?? null,
            name: sweep.arena?.name ?? null,
            player: sweep.player
              ? { x: Math.round(sweep.player.x), y: Math.round(sweep.player.y), hp: sweep.player.hp ?? 0, active: sweep.player.active ?? true }
              : null,
            enemies: sweep.enemies?.countActive?.(true) ?? 0,
          }
        : null;
    },
    getTdVisualState: () => ({
      scene: activeSceneName(),
      width: gameRef?.scale.width ?? 0,
      height: gameRef?.scale.height ?? 0,
    }),
  };

  (window as unknown as { __BLIP_TEST_API__?: typeof api }).__BLIP_TEST_API__ = api;
}
