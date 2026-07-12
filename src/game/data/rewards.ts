/**
 * SIGNAL REWARDS — the collectible payload of the BLIP reward system.
 * Every cache spits out entries defined here. This is DATA ONLY — the roll
 * logic lives in systems/RewardSystem.ts, the visuals in ui/RewardUI.ts, and
 * the procedural icons in ui/rewardIcons.ts.
 *
 * Fantasy: CONTACT-47 is intercepting classified signals — Scout relics, glitch
 * shards, weird trophies and cosmetic "frequencies". NOT a mobile store. Rewards
 * are cosmetic / collectible / lore. Nothing here is pay-to-win.
 */

/* ------------------------------- rarity tiers ------------------------------ */

export type RarityId =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'superrare'
  | 'epic'
  | 'mythic'
  | 'anomaly';

export interface RarityDef {
  id: RarityId;
  name: string;
  /** primary color (hex string, DOM-ready) */
  color: string;
  /** softer glow/aura color */
  glow: string;
  /** ordering weight — higher = rarer (used for dust value + reveal intensity) */
  rank: number;
  /** 0..1 how BIG the reveal should feel (screen shake, beams, hold time) */
  intensity: number;
  /** Signal Dust granted when a duplicate of this rarity is converted */
  dupeDust: number;
  /** short label shown on the reveal flash */
  flash: string;
}

export const RARITIES: Record<RarityId, RarityDef> = {
  common: { id: 'common', name: 'COMMON', color: '#9fb0c4', glow: '#5c6d82', rank: 1, intensity: 0.12, dupeDust: 5, flash: 'SIGNAL' },
  uncommon: { id: 'uncommon', name: 'UNCOMMON', color: '#7cdc6a', glow: '#3f9a5f', rank: 2, intensity: 0.24, dupeDust: 10, flash: 'CLEAR SIGNAL' },
  rare: { id: 'rare', name: 'RARE', color: '#35d5ff', glow: '#2a86b0', rank: 3, intensity: 0.42, dupeDust: 25, flash: 'RARE SIGNAL' },
  superrare: { id: 'superrare', name: 'SUPER RARE', color: '#f2a93b', glow: '#a9701a', rank: 4, intensity: 0.6, dupeDust: 55, flash: 'SUPER RARE' },
  epic: { id: 'epic', name: 'EPIC', color: '#b06bff', glow: '#6f38c4', rank: 5, intensity: 0.78, dupeDust: 110, flash: 'EPIC INTERCEPT' },
  mythic: { id: 'mythic', name: 'MYTHIC', color: '#ff4d8d', glow: '#b02359', rank: 6, intensity: 0.92, dupeDust: 240, flash: 'MYTHIC BROADCAST' },
  anomaly: { id: 'anomaly', name: 'ANOMALY', color: '#a8ff3e', glow: '#5f9e2e', rank: 7, intensity: 1, dupeDust: 500, flash: '// ANOMALY //' },
};

export const RARITY_ORDER: RarityId[] = ['common', 'uncommon', 'rare', 'superrare', 'epic', 'mythic', 'anomaly'];

/* ------------------------------ reward categories -------------------------- */

// Non-currency categories count toward the collection %. Currencies (dust/shards)
// are pseudo-rewards that get added straight to a balance instead of the archive.
export type RewardCategory =
  | 'dust'      // Signal Dust (currency payout)
  | 'shards'    // Signal Shards (feeds the existing Workbench economy)
  | 'skin'      // cosmetic recolor / signal frequency
  | 'trail'     // motion trail cosmetic
  | 'ripple'    // scan ripple effect cosmetic
  | 'pulsefx'   // pulse-shot effect cosmetic
  | 'echofx'    // Echo Blink effect cosmetic
  | 'sticker'   // collectible sticker
  | 'badge'     // collectible badge
  | 'note'      // Field Note (lore card)
  | 'medal'     // mini-game medal
  | 'relic';    // weird trophy relic (collectible)

export const CATEGORY_LABEL: Record<RewardCategory, string> = {
  dust: 'Signal Dust',
  shards: 'Signal Shards',
  skin: 'Signal Skin',
  trail: 'Signal Trail',
  ripple: 'Scan Ripple',
  pulsefx: 'Pulse Effect',
  echofx: 'Echo Effect',
  sticker: 'Sticker',
  badge: 'Badge',
  note: 'Field Note',
  medal: 'Medal',
  relic: 'Relic',
};

/** categories that are currency (added to a balance, never stored as owned) */
export const CURRENCY_CATEGORIES: RewardCategory[] = ['dust', 'shards'];

export interface RewardDef {
  id: string;
  name: string;
  category: RewardCategory;
  rarity: RarityId;
  /** short lore / flavor line shown on the card + in the archive */
  flavor: string;
  /** icon shape seed consumed by rewardIcons.ts (procedural) */
  icon: string;
  /** for currency rewards: how much is granted */
  amount?: number;
  /** optional accent color override (else rarity color) */
  color?: string;
}

/* --------------------------------- the rewards ----------------------------- */
// 40+ definitions across every category + rarity. Add freely — the roll tables
// in caches.ts reference these by `category`/`rarity`, so new entries just work.

export const REWARDS: RewardDef[] = [
  /* ---- currency payouts ---- */
  { id: 'dust-small', name: 'Signal Dust', category: 'dust', rarity: 'common', amount: 20, icon: 'dust', flavor: 'Ground-down signal residue. Reforge it into anything.' },
  { id: 'dust-med', name: 'Signal Dust Cluster', category: 'dust', rarity: 'uncommon', amount: 50, icon: 'dust', flavor: 'A brighter pinch of dust — the good stuff clumps.' },
  { id: 'dust-big', name: 'Signal Dust Drift', category: 'dust', rarity: 'rare', amount: 120, icon: 'dust', flavor: 'A whole drift of the stuff. Chip would be proud.' },
  { id: 'shards-small', name: 'Salvage Shards', category: 'shards', rarity: 'common', amount: 10, icon: 'shard', flavor: 'Loose Signal Shards — spend them at the Workbench.' },
  { id: 'shards-med', name: 'Shard Cache', category: 'shards', rarity: 'uncommon', amount: 25, icon: 'shard', flavor: 'A tidy stack of Shards, still warm.' },
  { id: 'shards-big', name: 'Shard Trove', category: 'shards', rarity: 'rare', amount: 60, icon: 'shard', flavor: 'Enough Shards to actually upgrade something.' },

  /* ---- stickers (common/uncommon filler with charm) ---- */
  { id: 'sticker-blip', name: 'Blip Sticker', category: 'sticker', rarity: 'common', icon: 'blip', flavor: 'A little green dot. It IS you, technically.' },
  { id: 'sticker-antenna', name: 'Bent Antenna Sticker', category: 'sticker', rarity: 'common', icon: 'antenna', flavor: 'From the Scarecrow Antenna. Slightly cursed.' },
  { id: 'sticker-moon', name: 'Chagrin Moon Sticker', category: 'sticker', rarity: 'common', icon: 'moon', flavor: 'The moon over Miller Field, forever half-lit.' },
  { id: 'sticker-neon', name: 'VACANCY Sticker', category: 'sticker', rarity: 'uncommon', icon: 'neon', flavor: 'It still buzzes if you hold it to your ear.' },
  { id: 'sticker-tiger', name: 'Tiger Pennant Sticker', category: 'sticker', rarity: 'uncommon', icon: 'pennant', flavor: 'GO TIGERS. Under Friday-night lights.' },
  { id: 'sticker-corn', name: 'Crop Circle Sticker', category: 'sticker', rarity: 'rare', icon: 'crop', flavor: 'The pattern glows faintly in the dark.' },

  /* ---- badges (Scout + system) ---- */
  { id: 'badge-static', name: 'Static Badge', category: 'badge', rarity: 'uncommon', icon: 'badge', flavor: 'Awarded for surviving a full THREAT lock.' },
  { id: 'badge-ghost', name: 'Ghost Frequency Badge', category: 'badge', rarity: 'rare', icon: 'badge', flavor: 'For staying UNKNOWN when the world wanted a label.' },
  { id: 'badge-relay', name: 'Relay Operator Badge', category: 'badge', rarity: 'rare', icon: 'badge', flavor: 'You kept the scouts’ signal alive.' },
  { id: 'badge-firstlight', name: 'First Light Badge', category: 'badge', rarity: 'superrare', icon: 'badge', flavor: 'The first honest signal in a long dark valley.' },

  /* ---- field notes (lore) ---- */
  { id: 'note-radar', name: 'Field Note: On Being Seen', category: 'note', rarity: 'uncommon', icon: 'note', flavor: '“If they can read you, they can name you. Stay a rumor.”' },
  { id: 'note-scouts', name: 'Field Note: Five Kids', category: 'note', rarity: 'rare', icon: 'note', flavor: '“Will drew the map. Chip wired the lights. We just believed him.”' },
  { id: 'note-engine', name: 'Field Note: The Engine Lies', category: 'note', rarity: 'epic', icon: 'note', flavor: '“It doesn’t see the truth. It sees what it decided. Refuse the label.”' },
  { id: 'note-danny', name: "Field Note: Danny's Dare", category: 'note', rarity: 'rare', icon: 'note', flavor: '“Bet you can’t reach the array before the storm. I could. I did.”' },

  /* ---- signal trails (motion cosmetic) ---- */
  { id: 'trail-spark', name: 'Spark Trail', category: 'trail', rarity: 'uncommon', icon: 'trail', flavor: 'A stutter of amber sparks in your wake.' },
  { id: 'trail-comet', name: 'Comet Trail', category: 'trail', rarity: 'rare', icon: 'trail', flavor: 'A clean lime streak. You look fast even standing still.' },
  { id: 'trail-glitch', name: 'Glitch Trail', category: 'trail', rarity: 'epic', icon: 'trail', flavor: 'Violet static peels off you like torn film.' },
  { id: 'trail-aurora', name: 'Aurora Trail', category: 'trail', rarity: 'mythic', icon: 'trail', flavor: 'The whole northern sky, spooling out behind CONTACT-47.' },

  /* ---- scan ripple effects ---- */
  { id: 'ripple-classic', name: 'Clean Ping Ripple', category: 'ripple', rarity: 'uncommon', icon: 'ripple', flavor: 'A crisp concentric ping. Textbook radar.' },
  { id: 'ripple-square', name: 'Square-Wave Ripple', category: 'ripple', rarity: 'rare', icon: 'ripple', flavor: 'Your scan pulses in hard right angles now.' },
  { id: 'ripple-bloom', name: 'Bloom Ripple', category: 'ripple', rarity: 'epic', icon: 'ripple', flavor: 'The scan opens like a flower of light.' },
  { id: 'ripple-anomaly', name: 'Anomaly Ripple', category: 'ripple', rarity: 'anomaly', icon: 'ripple', flavor: 'Nobody agrees on what shape this ripple even is.' },

  /* ---- pulse-shot effects ---- */
  { id: 'pulse-dot', name: 'Round Pulse', category: 'pulsefx', rarity: 'common', icon: 'pulse', flavor: 'A friendly little dot of signal.' },
  { id: 'pulse-star', name: 'Starburst Pulse', category: 'pulsefx', rarity: 'rare', icon: 'pulse', flavor: 'Every shot pops like a tiny firework.' },
  { id: 'pulse-arrow', name: 'Chevron Pulse', category: 'pulsefx', rarity: 'superrare', icon: 'pulse', flavor: 'Sharp amber chevrons, all business.' },
  { id: 'pulse-heart', name: 'Signal-Heart Pulse', category: 'pulsefx', rarity: 'epic', icon: 'pulse', flavor: 'You fire little hearts. The drones hate it.' },

  /* ---- echo blink effects ---- */
  { id: 'echo-fade', name: 'Soft Echo', category: 'echofx', rarity: 'uncommon', icon: 'echo', flavor: 'Your echo fades gently, like a held breath.' },
  { id: 'echo-double', name: 'Double Echo', category: 'echofx', rarity: 'rare', icon: 'echo', flavor: 'Two after-images instead of one. Show-off.' },
  { id: 'echo-mirror', name: 'Mirror Echo', category: 'echofx', rarity: 'epic', icon: 'echo', flavor: 'The echo looks back at you. Cameron loved this.' },

  /* ---- skins (cosmetic frequencies) ---- */
  { id: 'skin-chalk', name: 'Chalk-Line Frequency', category: 'skin', rarity: 'rare', icon: 'skin', flavor: 'CONTACT-47 rendered in yard-line white.' },
  { id: 'skin-dusk', name: 'Dusk Frequency', category: 'skin', rarity: 'superrare', icon: 'skin', flavor: 'Burnt-orange harvest dusk, worn as a color.' },
  { id: 'skin-neon', name: 'Neon-Lot Frequency', category: 'skin', rarity: 'epic', icon: 'skin', flavor: 'Motel Nowhere’s pink-and-cyan buzz, bottled.' },
  { id: 'skin-storm', name: 'Storm-Surf Frequency', category: 'skin', rarity: 'mythic', icon: 'skin', flavor: 'Lightning-lit, straight off the Skyline Array.' },
  { id: 'skin-unknown', name: 'True Unknown Frequency', category: 'skin', rarity: 'anomaly', icon: 'skin', flavor: 'The color of a thing that refused to be classified.' },

  /* ---- relics (weird trophies) ---- */
  { id: 'relic-fold', name: 'The Folded Map', category: 'relic', rarity: 'superrare', icon: 'relic', flavor: "Will's map, folded so many ways it hums." },
  { id: 'relic-cell', name: 'The Power Cell', category: 'relic', rarity: 'superrare', icon: 'relic', flavor: "Chip's power cell, still holding a charge." },
  { id: 'relic-flare', name: 'The Signal Flare', category: 'relic', rarity: 'epic', icon: 'relic', flavor: "Henry's flare — light for when the lights lie." },
  { id: 'relic-fork', name: 'The Tuning Fork', category: 'relic', rarity: 'epic', icon: 'relic', flavor: "Cameron's fork rings a note the maze remembers." },
  { id: 'relic-goggles', name: 'The Cracked Goggles', category: 'relic', rarity: 'mythic', icon: 'relic', flavor: "Danny's goggles — cracked reaching the array first." },
  { id: 'relic-firstblip', name: 'The First Blip', category: 'relic', rarity: 'anomaly', icon: 'relic', flavor: 'The very first return the Engine ever logged. You.' },

  /* ---- medals (mini-game) ---- */
  { id: 'medal-bronze', name: 'Sweep Medal — Bronze', category: 'medal', rarity: 'uncommon', icon: 'medal', flavor: 'Cleared a Signal Storm. Barely. Loudly.' },
  { id: 'medal-silver', name: 'Sweep Medal — Silver', category: 'medal', rarity: 'rare', icon: 'medal', flavor: 'A clean storm run. The radar blinked twice.' },
  { id: 'medal-gold', name: 'Sweep Medal — Gold', category: 'medal', rarity: 'epic', icon: 'medal', flavor: 'Overdrive, no hits, combo unbroken. Gold.' },
];

/* ---------------------------------- helpers -------------------------------- */

const REWARD_BY_ID: Record<string, RewardDef> = Object.fromEntries(REWARDS.map((r) => [r.id, r]));
export const rewardById = (id: string): RewardDef | undefined => REWARD_BY_ID[id];

export const isCurrency = (r: RewardDef): boolean => CURRENCY_CATEGORIES.includes(r.category);

/** every collectible (non-currency) reward — the denominator for collection %. */
export const COLLECTIBLE_REWARDS: RewardDef[] = REWARDS.filter((r) => !isCurrency(r));

export const rewardsByCategory = (cat: RewardCategory): RewardDef[] => REWARDS.filter((r) => r.category === cat);

/** pick from a rarity + category pool (deterministic list; the roller chooses). */
export const rewardsMatching = (cat: RewardCategory, rarity: RarityId): RewardDef[] =>
  REWARDS.filter((r) => r.category === cat && r.rarity === rarity);

export const rarityOf = (r: RewardDef): RarityDef => RARITIES[r.rarity];
