/**
 * BLIP save system — one canonical localStorage save at `blip_save_v1`.
 * Migrates the legacy `beamline_save_v1` key into that single save. All writes
 * emit EVT.saveUpdated on the bus.
 */
import { BUILD_VERSION, EVT, LEGACY_SAVE_KEY, SAVE_KEY } from '../config';
import { SKINS } from '../data/skins';
import { UPGRADES } from '../data/upgrades';
import { bus } from './EventBus';

export interface SaveFlags {
  millerNodeCharged: boolean;
  motelNodeCharged: boolean;
  townNodeCharged: boolean;
  orchardNodeCharged: boolean;
  stormNodeCharged: boolean;
  willBadgeCollected: boolean;
  chipBadgeCollected: boolean;
  henryBadgeCollected: boolean;
  cameronBadgeCollected: boolean;
  dannyBadgeCollected: boolean;
  firstFragmentCollected: boolean;
  motelFragmentCollected: boolean;
  tigerFragmentCollected: boolean;
  orchardFragmentCollected: boolean;
  skylineFragmentCollected: boolean;
  motelBossDefeated: boolean;
  tigerBossDefeated: boolean;
  harvestPatternDefeated: boolean;
  listeningStationDefeated: boolean;
  endingSeen: boolean;
}

export interface PlayerStats {
  deaths: number;
  enemiesDefeated: number;
  scansUsed: number;
  weaponShotsFired: number;
  timePlayedSec: number;
}

export interface SaveData {
  saveVersion: 1;
  buildVersion: string;
  savedAt: string | null;
  currentZone: string;
  currentQuest: string;
  questStep: string;
  completedQuestSteps: string[];
  signalFragments: number;
  unlockedAbilities: string[];
  completedZones: string[];
  discoveredScoutBadges: string[];
  discoveredScoutLogs: string[];
  playerStats: PlayerStats;
  flags: SaveFlags;
  // Signal Skins (additive — old saves migrate via hydrate defaults)
  unlockedSkins: string[]; // 'contact47' always present
  selectedSkin: string;
  signalSets: Record<string, { badge: boolean; log: boolean; relic: boolean }>;
  earnedPortraits: string[]; // scout ids whose Signal Portrait card is recovered (Command Center gallery)
  foundSecrets: string[]; // scan-secret spot ids already claimed (shard caches / field-note pages)
  discoveredFieldNotes: string[]; // Scout Field Note ids recovered
  // Progression (additive) — Channel B economy + Workbench purchases
  shards: number; // Signal Shard balance
  purchasedUpgrades: string[]; // Workbench upgrade ids (with tier suffix, e.g. 'max-hull-2')
  finalClassificationChoice: string; // finale choice: '' until made — UNKNOWN|CONTACT|SIGNAL|FRIEND|REFUSE
  // Reward system (Signal Caches / Archive / Trophies) — additive, one nested blob
  rewards: RewardSave;
}

/** Persisted state for the reward system. Kept as one nested object so hydrate
 *  stays a single default-merge and old saves migrate cleanly. */
export interface RewardSave {
  caches: Record<string, number>; // unopened cache counts, keyed by cache type
  owned: string[]; // collectible reward ids the player has (deduped)
  seen: string[]; // reward ids the player has viewed in the Archive (NEW = owned − seen)
  dust: number; // Signal Dust balance (from duplicates)
  trophies: string[]; // unlocked trophy ids
  awarded: string[]; // internal: milestone keys already granted (dedupe triggers)
  recent: RecentReward[]; // rolling log of the last rewards earned (newest first)
  equipped: Record<string, string>; // loadout: reward category → equipped reward id
}

export interface RecentReward {
  id: string; // reward id, or 'trophy:<id>' / 'cache:<type>'
  rarity: string;
  at: string; // ISO timestamp
}

const defaultRewards = (): RewardSave => ({
  caches: {},
  owned: [],
  seen: [],
  dust: 0,
  trophies: [],
  awarded: [],
  recent: [],
  equipped: {},
});

export type SetPieceKey = 'badge' | 'log' | 'relic';

const defaultSave = (): SaveData => ({
  saveVersion: 1,
  buildVersion: BUILD_VERSION,
  savedAt: null,
  currentZone: 'miller-field',
  currentQuest: 'the-first-contact',
  questStep: 'wake',
  completedQuestSteps: [],
  signalFragments: 0,
  unlockedAbilities: ['move', 'dash', 'pulse-shot', 'scan-pulse', 'overdrive'],
  completedZones: [],
  discoveredScoutBadges: [],
  discoveredScoutLogs: [],
  playerStats: { deaths: 0, enemiesDefeated: 0, scansUsed: 0, weaponShotsFired: 0, timePlayedSec: 0 },
  flags: {
    millerNodeCharged: false,
    motelNodeCharged: false,
    townNodeCharged: false,
    orchardNodeCharged: false,
    stormNodeCharged: false,
    willBadgeCollected: false,
    chipBadgeCollected: false,
    henryBadgeCollected: false,
    cameronBadgeCollected: false,
    dannyBadgeCollected: false,
    firstFragmentCollected: false,
    motelBossDefeated: false,
    motelFragmentCollected: false,
    tigerBossDefeated: false,
    tigerFragmentCollected: false,
    harvestPatternDefeated: false,
    orchardFragmentCollected: false,
    listeningStationDefeated: false,
    skylineFragmentCollected: false,
    endingSeen: false,
  },
  unlockedSkins: ['contact47'],
  selectedSkin: 'contact47',
  signalSets: {},
  earnedPortraits: [],
  foundSecrets: [],
  discoveredFieldNotes: [],
  shards: 0,
  purchasedUpgrades: [],
  finalClassificationChoice: '',
  rewards: defaultRewards(),
});

let cache: SaveData | null = null;

function readRaw(key: string): Partial<SaveData> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<SaveData>) : null;
  } catch {
    return null;
  }
}

function writeRaw(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable (private mode etc.) — play session still works in memory
  }
}

function readStoredSave(): Partial<SaveData> | null {
  return readRaw(SAVE_KEY) ?? readRaw(LEGACY_SAVE_KEY);
}

/** Deep-ish merge onto defaults so old/partial saves never crash new builds. */
function hydrate(partial: Partial<SaveData>): SaveData {
  const base = defaultSave();
  const savedStats = partial.playerStats as (Partial<PlayerStats> & { pulseShotsFired?: number }) | undefined;
  const { pulseShotsFired, ...cleanSavedStats } = savedStats ?? {};
  const playerStats = {
    ...base.playerStats,
    ...cleanSavedStats,
    weaponShotsFired: cleanSavedStats.weaponShotsFired ?? pulseShotsFired ?? base.playerStats.weaponShotsFired,
  };
  return {
    ...base,
    ...partial,
    saveVersion: 1,
    buildVersion: BUILD_VERSION,
    playerStats,
    flags: { ...base.flags, ...(partial.flags ?? {}) },
    completedQuestSteps: partial.completedQuestSteps ?? [],
    unlockedAbilities: partial.unlockedAbilities ?? base.unlockedAbilities,
    discoveredScoutBadges: partial.discoveredScoutBadges ?? [],
    discoveredScoutLogs: partial.discoveredScoutLogs ?? [],
    completedZones: partial.completedZones ?? [],
    unlockedSkins: partial.unlockedSkins?.includes('contact47')
      ? partial.unlockedSkins
      : ['contact47', ...(partial.unlockedSkins ?? [])],
    selectedSkin: partial.selectedSkin ?? 'contact47',
    signalSets: partial.signalSets ?? {},
    earnedPortraits: partial.earnedPortraits ?? [],
    foundSecrets: partial.foundSecrets ?? [],
    discoveredFieldNotes: partial.discoveredFieldNotes ?? [],
    shards: partial.shards ?? 0,
    purchasedUpgrades: partial.purchasedUpgrades ?? [],
    rewards: { ...defaultRewards(), ...(partial.rewards ?? {}) },
  };
}

export function loadSave(): SaveData {
  if (cache) return cache;
  const stored = readStoredSave();
  cache = stored ? hydrate(stored) : defaultSave();
  if (stored) {
    writeRaw(cache);
    try {
      localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch {
      /* ignore */
    }
  }
  return cache;
}

export function getSave(): SaveData {
  return loadSave();
}

/** True if the player has any persisted progress worth continuing. */
export function hasProgress(): boolean {
  const s = loadSave();
  return s.savedAt !== null;
}

/** Mutate + persist + notify. The single write path for all progress. */
export function updateSave(mutator: (s: SaveData) => void): SaveData {
  const s = loadSave();
  mutator(s);
  s.savedAt = new Date().toISOString();
  writeRaw(s);
  bus.emit(EVT.saveUpdated, s);
  return s;
}

/** Erase the current run back to a fresh save. */
export function resetSave(): SaveData {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    /* ignore */
  }
  cache = defaultSave();
  bus.emit(EVT.saveUpdated, cache);
  return cache;
}

/** Raw JSON for the Command Center save viewer. */
export function saveAsJson(): string {
  return JSON.stringify(loadSave(), null, 2);
}

/* ------------------------------- Signal Skins ------------------------------ */

export function unlockSkin(id: string): void {
  updateSave((s) => {
    if (!s.unlockedSkins.includes(id)) s.unlockedSkins.push(id);
  });
  grantScoutSetAbility(id);
}

/**
 * Channel C payoff: completing a scout's Signal Set (which is the only thing
 * that unlocks their skin) also hands over that scout's `scout-set` ability —
 * e.g. Will / WILLOW → Route Tracer. Idempotent via grantAbility.
 */
function grantScoutSetAbility(skinId: string): void {
  const scoutId = SKINS.find((s) => s.id === skinId)?.scoutId;
  if (!scoutId) return;
  const def = UPGRADES.find((u) => u.unlockType === 'scout-set' && u.scout === scoutId);
  if (!def) return;
  if (grantAbility(def.id)) {
    bus.emit(EVT.toast, { text: `◆ ABILITY UNLOCKED — ${def.name.toUpperCase()}`, color: 'cyan' });
  }
}

export function selectSkin(id: string): void {
  updateSave((s) => {
    if (s.unlockedSkins.includes(id)) s.selectedSkin = id;
  });
}

/** Record a collected Signal-Set piece for a scout. Returns true if that
 *  completed the set (badge+log+relic) — the caller fires the unlock/echo. */
export function recordSetPiece(scoutId: string, piece: SetPieceKey): boolean {
  let completed = false;
  updateSave((s) => {
    const set = s.signalSets[scoutId] ?? { badge: false, log: false, relic: false };
    set[piece] = true;
    s.signalSets[scoutId] = set;
    completed = set.badge && set.log && set.relic;
  });
  return completed;
}

/** Record the finale classification choice (UNKNOWN|CONTACT|SIGNAL|FRIEND|REFUSE). */
export function recordClassificationChoice(choice: string): void {
  updateSave((s) => {
    s.finalClassificationChoice = choice;
  });
}

/** Mark the finale ending card as seen. */
export function recordEndingSeen(): void {
  updateSave((s) => {
    s.flags.endingSeen = true;
  });
}

/* ------------------------------- Progression ------------------------------- */

/** Grant an ability id (idempotent). Returns true if it was newly granted. */
export function grantAbility(id: string): boolean {
  let granted = false;
  updateSave((s) => {
    if (!s.unlockedAbilities.includes(id)) {
      s.unlockedAbilities.push(id);
      granted = true;
    }
  });
  if (granted) bus.emit(EVT.abilityUnlocked, { id });
  return granted;
}

export function hasAbility(id: string): boolean {
  return loadSave().unlockedAbilities.includes(id);
}

/** Add (or subtract) Signal Shards, clamped at 0. */
export function addShards(n: number): number {
  let balance = 0;
  updateSave((s) => {
    s.shards = Math.max(0, (s.shards ?? 0) + n);
    balance = s.shards;
  });
  bus.emit(EVT.shardsChanged, { shards: balance });
  return balance;
}

/** Buy a Workbench upgrade if affordable + not owned. Returns true on success. */
export function buyUpgrade(id: string, cost: number): boolean {
  const s = loadSave();
  if (s.purchasedUpgrades.includes(id) || s.shards < cost) return false;
  updateSave((sv) => {
    sv.shards -= cost;
    sv.purchasedUpgrades.push(id);
  });
  bus.emit(EVT.shardsChanged, { shards: loadSave().shards });
  bus.emit(EVT.upgradePurchased, { id });
  return true;
}

export function ownsUpgrade(id: string): boolean {
  return loadSave().purchasedUpgrades.includes(id);
}

export function setProgress(scoutId: string): { badge: boolean; log: boolean; relic: boolean; count: number } {
  const set = loadSave().signalSets[scoutId] ?? { badge: false, log: false, relic: false };
  const count = (set.badge ? 1 : 0) + (set.log ? 1 : 0) + (set.relic ? 1 : 0);
  return { ...set, count };
}
