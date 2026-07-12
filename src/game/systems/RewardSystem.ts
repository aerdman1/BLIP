/**
 * RewardSystem — the earn/open/collect spine of BLIP's Signal Cache system.
 * Stateless singleton (mirrors ProgressionSystem): all state lives in the save
 * blob's `rewards` object via SaveSystem, all changes emit on the bus. The DOM
 * reward UI (ui/RewardUI.ts) and the Command Center render from here.
 *
 * Fantasy: intercept classified signals → crack caches → collect relics, glitch
 * shards, cosmetic frequencies, weird trophies. Duplicates melt to Signal Dust.
 * Cosmetic / collectible / lore only — never pay-to-win, no monetization.
 */
import { EVT } from '../config';
import { bus } from './EventBus';
import { addShards, getSave, updateSave } from './SaveSystem';
import type { RecentReward } from './SaveSystem';
import { CACHES, cacheById, type CacheDef, type CacheType } from '../data/caches';
import {
  COLLECTIBLE_REWARDS,
  RARITIES,
  RARITY_ORDER,
  REWARDS,
  isCurrency,
  rewardById,
  type RarityId,
  type RewardCategory,
  type RewardDef,
} from '../data/rewards';
import { TROPHIES, trophyById } from '../data/trophies';

/* --------------------------------- results --------------------------------- */

export interface OpenedReward {
  def: RewardDef;
  isNew: boolean; // first time owning a collectible
  dust: number; // Signal Dust gained (duplicate melt) — 0 if kept / currency
  amount: number; // currency amount applied (0 for collectibles)
}

export interface OpenResult {
  cacheType: CacheType;
  cache: CacheDef;
  rewards: OpenedReward[];
  dustTotal: number;
  newCount: number;
}

/* --------------------------------- rng utils ------------------------------- */

function weightedPick<T>(entries: Array<{ item: T; w: number }>): T {
  const total = entries.reduce((s, e) => s + Math.max(0, e.w), 0);
  if (total <= 0) return entries[0].item;
  let roll = Math.random() * total;
  for (const e of entries) {
    roll -= Math.max(0, e.w);
    if (roll <= 0) return e.item;
  }
  return entries[entries.length - 1].item;
}

function pickRarity(weights: Partial<Record<RarityId, number>>, floor?: RarityId): RarityId {
  const floorRank = floor ? RARITIES[floor].rank : 0;
  const entries = (Object.entries(weights) as Array<[RarityId, number]>)
    .filter(([id]) => RARITIES[id].rank >= floorRank)
    .map(([id, w]) => ({ item: id, w }));
  if (entries.length === 0) return floor ?? 'common';
  return weightedPick(entries);
}

function pickReward(rarity: RarityId, bias?: Partial<Record<RewardCategory, number>>): RewardDef {
  let rank = RARITIES[rarity].rank;
  let pool: RewardDef[] = [];
  while (pool.length === 0 && rank >= 1) {
    const rid = RARITY_ORDER.find((r) => RARITIES[r].rank === rank)!;
    pool = REWARDS.filter((r) => r.rarity === rid);
    rank--;
  }
  if (pool.length === 0) pool = REWARDS;
  return weightedPick(pool.map((r) => ({ item: r, w: bias?.[r.category] ?? 1 })));
}

/* ------------------------------- the service ------------------------------- */

export const rewards = {
  /* ---------------------------------- reads -------------------------------- */

  state() {
    return getSave().rewards;
  },

  cacheCount(type: CacheType): number {
    return getSave().rewards.caches[type] ?? 0;
  },

  totalCaches(): number {
    return Object.values(getSave().rewards.caches).reduce((s, n) => s + n, 0);
  },

  dust(): number {
    return getSave().rewards.dust;
  },

  owns(id: string): boolean {
    return getSave().rewards.owned.includes(id);
  },

  hasTrophy(id: string): boolean {
    return getSave().rewards.trophies.includes(id);
  },

  isNew(id: string): boolean {
    const r = getSave().rewards;
    return r.owned.includes(id) && !r.seen.includes(id);
  },

  /** collection completion over all non-currency rewards (0..1). */
  collection(): { owned: number; total: number; percent: number } {
    const owned = getSave().rewards.owned.length;
    const total = COLLECTIBLE_REWARDS.length;
    return { owned, total, percent: total ? owned / total : 0 };
  },

  trophyProgress(): { unlocked: number; total: number } {
    return { unlocked: getSave().rewards.trophies.length, total: TROPHIES.length };
  },

  medals(): number {
    return getSave().rewards.owned.filter((id) => rewardById(id)?.category === 'medal').length;
  },

  recentRares(limit = 5): RecentReward[] {
    return getSave()
      .rewards.recent.filter((r) => RARITIES[r.rarity as RarityId]?.rank >= 3)
      .slice(0, limit);
  },

  /* --------------------------------- caches -------------------------------- */

  /** Grant an unopened cache. Fires the "cache acquired" popup + logs it. */
  grantCache(type: CacheType, opts: { silent?: boolean } = {}): void {
    const def = CACHES[type];
    if (!def) return;
    updateSave((s) => {
      s.rewards.caches[type] = (s.rewards.caches[type] ?? 0) + 1;
      pushRecent(s.rewards.recent, { id: `cache:${type}`, rarity: def.floor, at: new Date().toISOString() });
    });
    bus.emit(EVT.rewardCacheEarned, { cacheType: type, count: this.cacheCount(type) });
    if (!opts.silent) {
      bus.emit(EVT.rewardBanner, {
        kind: 'cache',
        title: 'SIGNAL CACHE ACQUIRED',
        sub: def.name.toUpperCase(),
        color: def.color,
        icon: def.icon,
        rarity: def.floor,
      });
    }
    bus.emit(EVT.rewardChanged, {});
  },

  /**
   * Open one cache of a type. Rolls its drops, converts duplicates to dust,
   * banks currency, records NEW collectibles, and returns a full OpenResult for
   * the reveal screen. Returns null if the player has none of that cache.
   */
  openCache(type: CacheType): OpenResult | null {
    const def = cacheById(type);
    if (!def || this.cacheCount(type) <= 0) return null;

    // roll BEFORE mutating so we can apply everything atomically
    const drops: RewardDef[] = [];
    for (let i = 0; i < def.drops; i++) {
      const rarity = pickRarity(def.rarityWeights, i === 0 ? def.floor : undefined);
      drops.push(pickReward(rarity, def.categoryBias));
    }

    const opened: OpenedReward[] = [];
    let dustTotal = 0;
    let newCount = 0;

    updateSave((s) => {
      s.rewards.caches[type] = Math.max(0, (s.rewards.caches[type] ?? 0) - 1);
      for (const r of drops) {
        if (isCurrency(r)) {
          const amount = r.amount ?? 0;
          if (r.category === 'dust') s.rewards.dust += amount;
          opened.push({ def: r, isNew: false, dust: 0, amount });
        } else if (s.rewards.owned.includes(r.id)) {
          const dust = RARITIES[r.rarity].dupeDust;
          s.rewards.dust += dust;
          dustTotal += dust;
          opened.push({ def: r, isNew: false, dust, amount: 0 });
        } else {
          s.rewards.owned.push(r.id);
          newCount++;
          opened.push({ def: r, isNew: true, dust: 0, amount: 0 });
        }
        pushRecent(s.rewards.recent, { id: r.id, rarity: r.rarity, at: new Date().toISOString() });
      }
    });

    // shard payouts route through the existing economy (emits shardsChanged + HUD)
    for (const r of drops) if (r.category === 'shards') addShards(r.amount ?? 0);

    const result: OpenResult = { cacheType: type, cache: def, rewards: opened, dustTotal, newCount };

    // convenience trophies
    this.unlockTrophy('first-cache');
    this.checkCollectionTrophies();
    this.checkDustTrophy();

    bus.emit(EVT.rewardOpened, result);
    bus.emit(EVT.rewardChanged, {});
    return result;
  },

  /* -------------------------------- trophies ------------------------------- */

  /** Unlock a trophy (idempotent). Fires the big unlock moment + any payout. */
  unlockTrophy(id: string): boolean {
    const def = trophyById(id);
    if (!def || this.hasTrophy(id)) return false;
    updateSave((s) => {
      s.rewards.trophies.push(id);
      pushRecent(s.rewards.recent, { id: `trophy:${id}`, rarity: def.rarity, at: new Date().toISOString() });
    });
    bus.emit(EVT.rewardTrophy, { id });
    bus.emit(EVT.rewardBanner, {
      kind: 'trophy',
      title: 'TROPHY UNLOCKED',
      sub: def.name.toUpperCase(),
      color: RARITIES[def.rarity].color,
      icon: def.icon,
      rarity: def.rarity,
      big: RARITIES[def.rarity].rank >= 5,
    });
    // payouts (granted silently so they don't stomp the trophy banner)
    if (def.reward?.dust) this.addDust(def.reward.dust);
    if (def.reward?.cache) this.grantCache(def.reward.cache, { silent: true });
    bus.emit(EVT.rewardChanged, {});
    return true;
  },

  checkCollectionTrophies(): void {
    const pct = this.collection().percent;
    if (pct >= 0.25) this.unlockTrophy('collector-25');
    if (pct >= 1) this.unlockTrophy('collector-100');
  },

  checkDustTrophy(): void {
    if (this.dust() >= 1000) this.unlockTrophy('dust-baron');
  },

  /* -------------------------------- loadout -------------------------------- */
  // Equip owned cosmetics. Only `trail` currently changes gameplay (the player's
  // afterimage color); the rest persist as a loadout the game can read later.

  equip(id: string): void {
    const def = rewardById(id);
    if (!def || !this.owns(id)) return;
    updateSave((s) => { s.rewards.equipped[def.category] = id; });
    bus.emit(EVT.rewardChanged, {});
  },

  equippedId(category: string): string | undefined {
    return getSave().rewards.equipped[category];
  },

  isEquipped(id: string): boolean {
    const def = rewardById(id);
    return !!def && getSave().rewards.equipped[def.category] === id;
  },

  /** the equipped trail color as a Phaser-friendly 0xRRGGBB number, or null. */
  equippedTrailColor(): number | null {
    const id = getSave().rewards.equipped.trail;
    if (!id) return null;
    const def = rewardById(id);
    const hex = def?.color ?? (def ? RARITIES[def.rarity].color : null);
    if (!hex) return null;
    const n = parseInt(hex.replace('#', ''), 16);
    return Number.isNaN(n) ? null : n;
  },

  /* --------------------------------- dust ---------------------------------- */

  addDust(n: number): number {
    let bal = 0;
    updateSave((s) => {
      s.rewards.dust = Math.max(0, s.rewards.dust + n);
      bal = s.rewards.dust;
    });
    this.checkDustTrophy();
    bus.emit(EVT.rewardChanged, {});
    return bal;
  },

  /* -------------------------------- archive -------------------------------- */

  /** Mark reward ids as seen (clears their NEW flag) — called by the Archive. */
  markSeen(ids: string[]): void {
    if (ids.length === 0) return;
    updateSave((s) => {
      for (const id of ids) if (!s.rewards.seen.includes(id)) s.rewards.seen.push(id);
    });
    bus.emit(EVT.rewardChanged, {});
  },

  /** Directly grant a specific reward id (dupe → dust). For scripted rewards. */
  grantReward(id: string): void {
    const def = rewardById(id);
    if (!def) return;
    if (isCurrency(def)) {
      if (def.category === 'dust') this.addDust(def.amount ?? 0);
      else addShards(def.amount ?? 0);
      return;
    }
    updateSave((s) => {
      if (s.rewards.owned.includes(id)) s.rewards.dust += RARITIES[def.rarity].dupeDust;
      else s.rewards.owned.push(id);
      pushRecent(s.rewards.recent, { id, rarity: def.rarity, at: new Date().toISOString() });
    });
    this.checkCollectionTrophies();
    bus.emit(EVT.rewardChanged, {});
  },
};

/* --------------------------------- helpers --------------------------------- */

const RECENT_CAP = 20;
function pushRecent(list: RecentReward[], entry: RecentReward): void {
  list.unshift(entry);
  if (list.length > RECENT_CAP) list.length = RECENT_CAP;
}
