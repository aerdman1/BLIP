/**
 * SIGNAL CACHES — the containers you earn and crack open.
 * Each cache is a weighted table for ONE meaningful reward. The roll logic in
 * systems/RewardSystem.ts reads these; the opening screen in ui/RewardUI.ts
 * reads them for color/feel.
 */
import type { RarityId, RewardCategory } from './rewards';

export type CacheType = 'small-signal' | 'scout' | 'anomaly' | 'broadcast';

export interface CacheDef {
  id: CacheType;
  name: string;
  tagline: string;
  /** primary shell color (DOM hex) */
  color: string;
  glow: string;
  /** always one reward per opening; kept data-driven for tooling/display */
  drops: number;
  /** relative weight per rarity (missing = 0 chance) */
  rarityWeights: Partial<Record<RarityId, number>>;
  /** at least ONE drop is guaranteed to be this rarity or better */
  floor: RarityId;
  /** relative category weighting (missing categories use weight 1) */
  categoryBias?: Partial<Record<RewardCategory, number>>;
  /** shape seed for the procedural cache icon */
  icon: string;
}

export const CACHES: Record<CacheType, CacheDef> = {
  'small-signal': {
    id: 'small-signal',
    name: 'Small Signal Cache',
    tagline: 'A stray return, snagged mid-sweep.',
    color: '#7cdc6a',
    glow: '#3f9a5f',
    drops: 1,
    floor: 'common',
    rarityWeights: { common: 60, uncommon: 30, rare: 9, superrare: 1 },
    categoryBias: { dust: 3, shards: 3, sticker: 3, pulsefx: 2 },
    icon: 'cache-small',
  },
  scout: {
    id: 'scout',
    name: 'Scout Cache',
    tagline: 'A sealed Scout drop, buried before the first blackout.',
    color: '#35d5ff',
    glow: '#2a86b0',
    drops: 1,
    floor: 'rare',
    rarityWeights: { common: 22, uncommon: 34, rare: 30, superrare: 11, epic: 3 },
    categoryBias: { badge: 4, note: 4, relic: 3, skin: 2, trail: 2 },
    icon: 'cache-scout',
  },
  anomaly: {
    id: 'anomaly',
    name: 'Anomaly Cache',
    tagline: 'The Engine can’t decide what this is. Good.',
    color: '#b06bff',
    glow: '#6f38c4',
    drops: 1,
    floor: 'epic',
    rarityWeights: { uncommon: 14, rare: 30, superrare: 30, epic: 18, mythic: 6, anomaly: 2 },
    categoryBias: { skin: 3, trail: 3, ripple: 3, echofx: 2, relic: 2, note: 2 },
    icon: 'cache-anomaly',
  },
  broadcast: {
    id: 'broadcast',
    name: 'Broadcast Cache',
    tagline: 'A full transmission. Everyone will hear this.',
    color: '#ff4d8d',
    glow: '#b02359',
    drops: 1,
    floor: 'mythic',
    rarityWeights: { rare: 12, superrare: 30, epic: 34, mythic: 18, anomaly: 6 },
    categoryBias: { skin: 3, relic: 3, trail: 2, ripple: 2, note: 2 },
    icon: 'cache-broadcast',
  },
};

export const CACHE_ORDER: CacheType[] = ['small-signal', 'scout', 'anomaly', 'broadcast'];

export const cacheById = (id: string): CacheDef | undefined => CACHES[id as CacheType];
