/**
 * BLIP bootstrap — creates the Phaser game, the Command Center, the crisp
 * ShellUI console, the Test API, and the global debug hotkeys.
 * All DOM/UI behavior lives in src/ui/ShellUI.ts.
 */
import './style.css';
import { installErrorLogger, getPersistedErrorLog } from './game/systems/ErrorLogger';

// FIRST: catch every runtime error from here on (incl. throws inside the game loop)
installErrorLogger();

import { createGame } from './game/BlipGame';
import type { SweepScene } from './game/scenes/SweepScene';
import { EVT, SCENES } from './game/config';
import { audio } from './game/systems/AudioSystem';
import { bus } from './game/systems/EventBus';
import { getSave, selectSkin, unlockSkin, updateSave } from './game/systems/SaveSystem';
import { SKINS } from './game/data/skins';
import { quests } from './game/systems/QuestSystem';
import { installTestAPI, isTestApiEnabled } from './game/systems/TestAPI';
import { CommandCenter } from './command-center/CommandCenter';
import { ShellUI } from './ui/ShellUI';
import { RewardUI } from './ui/RewardUI';
import { installRewardTriggers } from './game/systems/RewardTriggers';
import { registerServiceWorker } from './registerServiceWorker';

const game = createGame('game-root');
registerServiceWorker();
installTestAPI(game);
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__BLIP_GAME__ = game;

const commandCenter = new CommandCenter(document.getElementById('command-center') as HTMLElement, { game });
new ShellUI(game, {
  open: (section) => {
    updateSave(() => {}); // autosave on open (flushes pending stat bumps)
    commandCenter.open(section);
  },
  close: () => commandCenter.close(),
});

// Signal Cache reward system — DOM reward layer + gameplay milestone triggers.
new RewardUI(game);
installRewardTriggers();

/* ------------------------------ debug hotkeys ------------------------------ */

window.addEventListener('keydown', (ev) => {
  audio.unlock(); // first interaction unlocks WebAudio
  switch (ev.code) {
    case 'F2':
      ev.preventDefault();
      quests.restart();
      break;
    case 'F3': {
      ev.preventDefault();
      const s2 = updateSave((s) => {
        s.signalFragments += 1;
      });
      bus.emit(EVT.fragmentCount, { count: s2.signalFragments });
      bus.emit(EVT.toast, { text: 'DEBUG: FRAGMENT GRANTED', color: 'orange' });
      break;
    }
    case 'F4':
      ev.preventDefault();
      bus.emit(EVT.toast, { text: 'DEBUG: SIDE-VIEW BLIPSTREAM REMOVED', color: 'orange' });
      break;
    case 'F5':
      ev.preventDefault();
      bus.emit(EVT.toast, { text: 'DEBUG: SIDE-VIEW RETURN REMOVED', color: 'orange' });
      break;
    case 'F6': {
      // debug: unlock all skins + cycle to the next one (applies live)
      ev.preventDefault();
      SKINS.forEach((s) => unlockSkin(s.id));
      const cur = getSave().selectedSkin;
      const idx = SKINS.findIndex((s) => s.id === cur);
      const next = SKINS[(idx + 1) % SKINS.length];
      selectSkin(next.id);
      bus.emit(EVT.skinSelected, { id: next.id, name: next.name, color: next.color, live: true });
      bus.emit(EVT.toast, { text: `SKIN: ${next.name}`, color: 'green' });
      break;
    }
    case 'F7': {
      // WARP → Signal Storm top-down arena.
      ev.preventDefault();
      if (game.scene.isActive(SCENES.sweep)) break; // already there
      game.registry.set('sweepArenaId', 'anomaly-01');
      if (!game.scene.isActive(SCENES.ui)) game.scene.run(SCENES.ui);
      bus.emit(EVT.toast, { text: 'DEBUG: WARP → SIGNAL STORM', color: 'orange' });
      game.scene.start(SCENES.sweep);
      break;
    }
    case 'F8': {
      // WARP → Miller Field top-down.
      ev.preventDefault();
      if (game.scene.isActive(SCENES.sweep)) break;
      game.registry.set('sweepArenaId', 'surface-z1');
      if (!game.scene.isActive(SCENES.ui)) game.scene.run(SCENES.ui);
      bus.emit(EVT.toast, { text: 'DEBUG: WARP → MILLER FIELD (TOP-DOWN)', color: 'orange' });
      game.scene.start(SCENES.sweep);
      break;
    }
    case 'F10': {
      // TELEPORT TO ROUTE EXIT — preview the top-down area transition instantly
      ev.preventDefault();
      const sweep = game.scene.getScene(SCENES.sweep) as SweepScene | null;
      if (sweep && game.scene.isActive(SCENES.sweep)) {
        sweep.debugSkipToBreach();
        bus.emit(EVT.toast, { text: 'DEBUG: SKIP → BREACH', color: 'orange' });
      }
      break;
    }
  }
});

window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

if (isTestApiEnabled()) {
  console.info('[BLIP] Test API active: window.__BLIP_TEST_API__');
}
console.info('[BLIP] you are the thing on the radar');

// surface any errors carried over from a previous session (survives reload/crash)
const priorErrors = getPersistedErrorLog();
if (priorErrors.length) {
  console.warn(`[BLIP] ${priorErrors.length} error(s) logged in a previous session — __BLIP_ERRORS__() for details`, priorErrors);
}
