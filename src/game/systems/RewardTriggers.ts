/**
 * RewardTriggers — wires gameplay milestones to Signal Caches + Trophies.
 * Almost everything is driven by watching EVT.saveUpdated and reacting to save
 * flags/counters, so NO scene code needs to change. Cache grants are guarded by
 * `save.rewards.awarded` (awardOnce) so they fire exactly once ever — even
 * across reloads. Trophy unlocks are idempotent on their own.
 *
 * A couple of events that aren't reflected in the save (the Sweep clear) are
 * handled by their own bus listeners.
 */
import { EVT } from '../config';
import { bus } from './EventBus';
import { getSave, updateSave } from './SaveSystem';
import { rewards } from './RewardSystem';
import type { CacheType } from '../data/caches';

/** Do `fn` at most once, keyed by a stable milestone id (persisted). */
function awardOnce(key: string, fn: () => void): void {
  if (getSave().rewards.awarded.includes(key)) return;
  updateSave((s) => {
    if (!s.rewards.awarded.includes(key)) s.rewards.awarded.push(key);
  });
  fn();
}

const grantCache = (type: CacheType) => rewards.grantCache(type);

export function installRewardTriggers(): void {
  let evaluating = false;

  const evaluate = (): void => {
    if (evaluating) return; // guard: our own grants re-emit saveUpdated
    evaluating = true;
    try {
      const s = getSave();
      const f = s.flags;

      // --- first scan → a starter Small Cache + a trophy ---
      if (s.playerStats.scansUsed > 0) {
        rewards.unlockTrophy('first-scan');
        awardOnce('milestone:first-scan', () => grantCache('small-signal'));
      }

      // --- connected-world milestones ---
      if (f.willBadgeCollected) {
        rewards.unlockTrophy('will-route');
        awardOnce('flag:will-badge', () => grantCache('small-signal'));
      }
      if (f.millerNodeCharged) {
        rewards.unlockTrophy('drones-cleared');
        awardOnce('flag:miller-node', () => grantCache('small-signal'));
      }
      if (f.motelNodeCharged || f.townNodeCharged || f.orchardNodeCharged || f.stormNodeCharged) {
        rewards.unlockTrophy('signal-node-routed');
        awardOnce('flag:route-node', () => grantCache('scout'));
      }
      if (f.firstFragmentCollected) rewards.unlockTrophy('first-fragment');
      if (f.millerNodeCharged) rewards.unlockTrophy('scarecrow-down'); // grants a scout cache via trophy.reward

      // --- every Signal Fragment collected → a Scout Cache ---
      for (let n = 1; n <= s.signalFragments; n++) {
        awardOnce(`fragment:${n}`, () => grantCache('scout'));
      }

      // --- later-zone bosses → a cache each ---
      const bossFlags: Array<[boolean, string, CacheType]> = [
        [f.motelBossDefeated, 'boss:motel', 'scout'],
        [f.tigerBossDefeated, 'boss:tiger', 'scout'],
        [f.harvestPatternDefeated, 'boss:harvest', 'anomaly'],
        [f.listeningStationDefeated, 'boss:listening', 'broadcast'],
      ];
      bossFlags.forEach(([done, key, type]) => { if (done) awardOnce(key, () => grantCache(type)); });

      // --- zone cleared → an Anomaly Cache per zone ---
      for (const z of s.completedZones) awardOnce(`zone:${z}`, () => grantCache('anomaly'));

      // --- secrets found → a Small Cache + trophy ---
      if (s.foundSecrets.length > 0) rewards.unlockTrophy('secret-found');
      for (const sec of s.foundSecrets) awardOnce(`secret:${sec}`, () => grantCache('small-signal'));

      // --- completed Scout Signal Set → trophy (its reward grants a scout cache) ---
      const setsDone = Object.values(s.signalSets).filter((set) => set.badge && set.log && set.relic).length;
      if (setsDone > 0) rewards.unlockTrophy('scout-set');

      // --- finale ---
      if (f.endingSeen) rewards.unlockTrophy('refuse-label');

      // collection/dust trophies (also checked inside RewardSystem, belt + braces)
      rewards.checkCollectionTrophies();
      rewards.checkDustTrophy();
    } finally {
      evaluating = false;
    }
  };

  bus.on(EVT.saveUpdated, evaluate);

  // --- Signal Storm (Sweep) cleared — not a save flag, its own event ---
  bus.on(EVT.sweepCleared, (d) => {
    const info = (d as { combo?: number; noHit?: boolean }) ?? {};
    rewards.unlockTrophy('sweep-cleared');
    awardOnce('milestone:sweep-first', () => grantCache('anomaly'));
    // performance medal (dupes melt to dust automatically)
    const medal = info.noHit ? 'medal-gold' : (info.combo ?? 0) >= 4 ? 'medal-silver' : 'medal-bronze';
    rewards.grantReward(medal);
    if ((info.combo ?? 0) >= 5) rewards.unlockTrophy('sweep-combo');
    bus.emit(EVT.rewardBanner, {
      kind: 'medal', title: 'SWEEP MEDAL EARNED', sub: medal.replace('medal-', '').toUpperCase(),
      color: '#f2a93b', icon: 'medal', rarity: 'rare',
    });
  });

  // run once at boot to catch anything already true in a loaded save (idempotent)
  evaluate();
}
