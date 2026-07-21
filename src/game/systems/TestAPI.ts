/**
 * window.__BLIP_TEST_API__ — automation hooks for the top-down BLIP runtime.
 * Enabled only in dev builds or with ?test=1.
 */
import type Phaser from 'phaser';
import { EVT, SCENES } from '../config';
import { bus } from './EventBus';
import { getSave, resetSave, selectSkin, unlockSkin, updateSave } from './SaveSystem';
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
        energy: 0,
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
      const sweep = sweepScene() as (Phaser.Scene & { debugRouteToBreach?: () => void }) | null;
      if (!sweep?.debugRouteToBreach) return false;
      sweep.debugRouteToBreach();
      return true;
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
    getSweepRuntimeState: () => {
      const sweep = sweepScene() as (Phaser.Scene & { debugRuntimeState?: () => unknown }) | null;
      return sweep?.debugRuntimeState?.() ?? null;
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
