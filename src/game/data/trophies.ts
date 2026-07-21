/**
 * TROPHIES — BLIP's achievement shelf. Each trophy has a locked/unlocked state
 * and fires a big unlock moment when earned. Unlocks are driven centrally by
 * systems/RewardTriggers.ts (mostly by diffing save flags) plus a few explicit
 * calls. DATA ONLY.
 */
import type { RarityId } from './rewards';

export interface TrophyDef {
  id: string;
  name: string;
  /** what you did to earn it (shown once unlocked) */
  description: string;
  /** teaser shown while locked; hidden trophies show '???' instead */
  hint: string;
  rarity: RarityId; // drives the shelf color + unlock intensity
  icon: string; // procedural icon seed
  /** secret trophies read '???' until earned */
  hidden?: boolean;
  /** optional cache awarded on unlock (a trophy that pays out) */
  reward?: { cache?: import('./caches').CacheType; dust?: number };
}

export const TROPHIES: TrophyDef[] = [
  {
    id: 'first-cache',
    name: 'First Contact',
    description: 'Cracked open your very first Signal Cache.',
    hint: 'Open a Signal Cache.',
    rarity: 'common',
    icon: 'trophy-cache',
  },
  {
    id: 'first-scan',
    name: 'Ping',
    description: 'Sent out your first scan pulse into the dark.',
    hint: 'Use a scan pulse.',
    rarity: 'common',
    icon: 'trophy-scan',
  },
  {
    id: 'first-fragment',
    name: 'Fragment Zero',
    description: 'Secured your first Signal Fragment.',
    hint: 'Collect a Signal Fragment.',
    rarity: 'uncommon',
    icon: 'trophy-fragment',
    reward: { dust: 40 },
  },
  {
    id: 'will-route',
    name: 'Will’s Route',
    description: 'Found the WILLOW badge on the hidden high climb.',
    hint: 'Find Will’s badge in Miller Field.',
    rarity: 'rare',
    icon: 'trophy-route',
  },
  {
    id: 'drones-cleared',
    name: 'Drone Lowlands, Cleared',
    description: 'Swept the Miller Field drone valley clean.',
    hint: 'Clear the drones in Miller Field.',
    rarity: 'uncommon',
    icon: 'trophy-drone',
  },
  {
    id: 'signal-node-routed',
    name: 'Node Routed',
    description: 'Charged a Signal Node and opened the next route.',
    hint: 'Charge a Signal Node.',
    rarity: 'rare',
    icon: 'trophy-node',
  },
  {
    id: 'scarecrow-down',
    name: 'The Antenna Falls',
    description: 'Defeated the Scarecrow Antenna over Miller Field.',
    hint: 'Beat the Miller Field boss.',
    rarity: 'superrare',
    icon: 'trophy-boss',
    reward: { cache: 'scout' },
  },
  {
    id: 'secret-found',
    name: 'Curiosity',
    description: 'Scanned out a hidden secret the scouts left behind.',
    hint: 'Find a hidden secret.',
    rarity: 'uncommon',
    icon: 'trophy-secret',
  },
  {
    id: 'sweep-cleared',
    name: 'Storm Chaser',
    description: 'Cleared a top-down Signal Storm route.',
    hint: 'Clear a Signal Storm arena.',
    rarity: 'rare',
    icon: 'trophy-storm',
  },
  {
    id: 'sweep-combo',
    name: 'Full Combo',
    description: 'Hit max combo in a Signal Storm.',
    hint: 'Reach max combo in the Sweep.',
    rarity: 'superrare',
    icon: 'trophy-combo',
    hidden: true,
  },
  {
    id: 'scout-set',
    name: 'Frequency Worn',
    description: 'Completed a full 3-piece Scout Signal Set.',
    hint: 'Complete a scout’s Signal Set.',
    rarity: 'epic',
    icon: 'trophy-skin',
    reward: { cache: 'scout' },
  },
  {
    id: 'collector-25',
    name: 'Archivist',
    description: 'Collected a quarter of everything the Signal has to offer.',
    hint: 'Reach 25% collection.',
    rarity: 'rare',
    icon: 'trophy-archive',
  },
  {
    id: 'collector-100',
    name: 'The Whole Signal',
    description: 'Collected every last intercepted reward. Impossible. Done.',
    hint: 'Reach 100% collection.',
    rarity: 'anomaly',
    icon: 'trophy-crown',
    hidden: true,
    reward: { cache: 'broadcast' },
  },
  {
    id: 'refuse-label',
    name: 'Refuse The Label',
    description: 'Reached the Skyline Array and refused to be classified.',
    hint: 'Finish the campaign.',
    rarity: 'mythic',
    icon: 'trophy-refuse',
    hidden: true,
    reward: { cache: 'broadcast' },
  },
  {
    id: 'dust-baron',
    name: 'Dust Baron',
    description: 'Banked 1,000 Signal Dust from duplicates.',
    hint: 'Accumulate 1,000 Signal Dust.',
    rarity: 'epic',
    icon: 'trophy-dust',
    hidden: true,
  },
];

const TROPHY_BY_ID: Record<string, TrophyDef> = Object.fromEntries(TROPHIES.map((t) => [t.id, t]));
export const trophyById = (id: string): TrophyDef | undefined => TROPHY_BY_ID[id];
