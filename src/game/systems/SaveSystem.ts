/**
 * BLIP save system — 3 save slots in localStorage (slot 0 = `blip_save_v1` for
 * back-compat; slots 1–2 = `blip_save_v1_slot1/2`). One slot is active at a
 * time; getSave/updateSave/resetSave all operate on the active slot, so game
 * code is slot-agnostic. Migrates the legacy `beamline_save_v1` key into slot 0.
 * All writes emit EVT.saveUpdated on the bus.
 */
import { ACTIVE_SLOT_KEY, BUILD_VERSION, EVT, LEGACY_SAVE_KEY, SAVE_KEY, SLOT_COUNT, SLOT_NAMES_KEY } from '../config';
import { bus } from './EventBus';

export interface SaveFlags {
  revealedHiddenPath: boolean;
  willBadgeCollected: boolean;
  chipBoxScanned: boolean;
  dronesCleared: boolean;
  nodeACompleted: boolean;
  doorOpened: boolean;
  bossDefeated: boolean;
  firstFragmentCollected: boolean;
  // Zone 2 — Motel Nowhere
  motelWingPowered: boolean; // Chip's circuit routed → dead wing lights up
  motelBadgeCollected: boolean; // SPARK badge picked up
  motelBossDefeated: boolean; // The Vacancy Sign down
  motelFragmentCollected: boolean; // Signal Fragment #2 secured
  // Zone 3 — Chagrin Falls High (Tiger Stadium)
  poolNodeSolved: boolean; // rec-pool reflection route completed → boss path opens
  tigerBadgeCollected: boolean; // Henry / ANCHOR badge picked up
  tigerRelicCollected: boolean; // Signal Flare relic recovered
  tigerBossDefeated: boolean; // The Weather Balloon down
  tigerFragmentCollected: boolean; // Signal Fragment #3 secured
  // Zone 4 — Patterson's Orchard
  orchardMazeSolved: boolean; // the top-down maze crop circle drawn → gate open
  orchardCropBloomed: boolean; // the crop-circle bloom played
  cameronBadgeCollected: boolean; // Cameron / ECHO badge picked up
  cameronLoftFound: boolean; // Tuning Fork relic recovered (maze heart)
  harvestPatternDefeated: boolean; // The Harvest Pattern down
  orchardFragmentCollected: boolean; // Signal Fragment #4 secured
  // Zone 5 — Skyline Array (THE FINALE; "The Broadcast" merged in)
  skylineFreqWill: boolean; // WILLOW frequency lent (beat cleared)
  skylineFreqChip: boolean; // SPARK frequency lent
  skylineFreqHenry: boolean; // ANCHOR frequency lent
  skylineFreqCameron: boolean; // ECHO frequency lent
  skylineFreqDanny: boolean; // ROCKET frequency lent (the top-down Sweep beat)
  skylineSummitTuned: boolean; // first-person "tune the sky" convergence done → final gate
  crackedGogglesCollected: boolean; // Danny's Cracked Goggles relic (ROCKET set)
  dannyBadgeCollected: boolean; // ROCKET badge picked up
  listeningStationDefeated: boolean; // the mirror boss down
  skylineFragmentCollected: boolean; // Signal Fragment #5 secured
  endingSeen: boolean; // the finale ending card has been viewed
}

export interface PlayerStats {
  deaths: number;
  enemiesDefeated: number;
  scansUsed: number;
  pulseShotsFired: number;
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
}

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
  unlockedAbilities: ['run', 'jump', 'hover', 'dash', 'pulse-shot', 'scan-pulse'],
  completedZones: [],
  discoveredScoutBadges: [],
  discoveredScoutLogs: [],
  playerStats: { deaths: 0, enemiesDefeated: 0, scansUsed: 0, pulseShotsFired: 0, timePlayedSec: 0 },
  flags: {
    revealedHiddenPath: false,
    willBadgeCollected: false,
    chipBoxScanned: false,
    dronesCleared: false,
    nodeACompleted: false,
    doorOpened: false,
    bossDefeated: false,
    firstFragmentCollected: false,
    motelWingPowered: false,
    motelBadgeCollected: false,
    motelBossDefeated: false,
    motelFragmentCollected: false,
    poolNodeSolved: false,
    tigerBadgeCollected: false,
    tigerRelicCollected: false,
    tigerBossDefeated: false,
    tigerFragmentCollected: false,
    orchardMazeSolved: false,
    orchardCropBloomed: false,
    cameronBadgeCollected: false,
    cameronLoftFound: false,
    harvestPatternDefeated: false,
    orchardFragmentCollected: false,
    skylineFreqWill: false,
    skylineFreqChip: false,
    skylineFreqHenry: false,
    skylineFreqCameron: false,
    skylineFreqDanny: false,
    skylineSummitTuned: false,
    crackedGogglesCollected: false,
    dannyBadgeCollected: false,
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
});

let cache: SaveData | null = null;

/* -------------------------------- slot plumbing ---------------------------- */

/** localStorage key for a slot (slot 0 keeps the original key for back-compat) */
function slotKey(i: number): string {
  return i === 0 ? SAVE_KEY : `${SAVE_KEY}_slot${i}`;
}

let activeSlot = readActiveSlot();

function readActiveSlot(): number {
  try {
    const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isInteger(n) && n >= 0 && n < SLOT_COUNT ? n : 0;
  } catch {
    return 0;
  }
}

export function getActiveSlot(): number {
  return activeSlot;
}

/* ------------------------------- slot names -------------------------------- */
// Player-chosen names live in their own localStorage map (keyed by slot index),
// decoupled from the save blob so a fresh new-game write can't wipe them.

const MAX_SLOT_NAME = 14;

function readSlotNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SLOT_NAMES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** The player-chosen name for a slot, or '' if unnamed. */
export function getSlotName(i: number): string {
  const name = readSlotNames()[String(i)];
  return typeof name === 'string' ? name.trim() : '';
}

/** Set (or, with an empty string, clear) a slot's name. Trimmed + length-clamped. */
export function setSlotName(i: number, name: string): void {
  // eslint-disable-next-line no-control-regex
  const clean = name.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, MAX_SLOT_NAME);
  const map = readSlotNames();
  if (clean) map[String(i)] = clean;
  else delete map[String(i)];
  try {
    localStorage.setItem(SLOT_NAMES_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — name is best-effort */
  }
}

/** Switch the active slot (used by the menu slot picker). Clears the cache. */
export function setActiveSlot(i: number): void {
  if (i < 0 || i >= SLOT_COUNT) return;
  activeSlot = i;
  cache = null;
  try {
    localStorage.setItem(ACTIVE_SLOT_KEY, String(i));
  } catch {
    /* ignore */
  }
}

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
    localStorage.setItem(slotKey(activeSlot), JSON.stringify(data));
  } catch {
    // storage unavailable (private mode etc.) — play session still works in memory
  }
}

/** Deep-ish merge onto defaults so old/partial saves never crash new builds. */
function hydrate(partial: Partial<SaveData>): SaveData {
  const base = defaultSave();
  return {
    ...base,
    ...partial,
    saveVersion: 1,
    buildVersion: BUILD_VERSION,
    playerStats: { ...base.playerStats, ...(partial.playerStats ?? {}) },
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
  };
}

export function loadSave(): SaveData {
  if (cache) return cache;
  let stored = readRaw(slotKey(activeSlot));
  if (!stored && activeSlot === 0) {
    // Legacy migration (slot 0 only): the project was briefly named BEAMLINE.
    const legacy = readRaw(LEGACY_SAVE_KEY);
    if (legacy) {
      stored = legacy;
      try {
        localStorage.removeItem(LEGACY_SAVE_KEY);
      } catch {
        /* ignore */
      }
    }
  }
  cache = stored ? hydrate(stored) : defaultSave();
  if (stored) writeRaw(cache); // persist migrated/hydrated form under the slot key
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

/** Erase the ACTIVE slot back to a fresh save. */
export function resetSave(): SaveData {
  try {
    localStorage.removeItem(slotKey(activeSlot));
    if (activeSlot === 0) localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    /* ignore */
  }
  cache = defaultSave();
  bus.emit(EVT.saveUpdated, cache);
  return cache;
}

/* --------------------------------- save slots ------------------------------ */

export interface SlotSummary {
  index: number;
  exists: boolean;
  name: string; // player-chosen name ('' if unnamed)
  savedAt: string | null;
  zone: string;
  questStep: string;
  fragments: number;
  timePlayedSec: number;
  selectedSkin: string;
}

/** Peek at a slot without disturbing the active cache (menu slot picker). */
export function slotSummary(i: number): SlotSummary {
  const raw = i === 0 ? readRaw(slotKey(0)) ?? readRaw(LEGACY_SAVE_KEY) : readRaw(slotKey(i));
  const exists = !!raw && raw.savedAt != null;
  return {
    index: i,
    exists,
    name: getSlotName(i),
    savedAt: raw?.savedAt ?? null,
    zone: raw?.currentZone ?? 'miller-field',
    questStep: raw?.questStep ?? 'wake',
    fragments: raw?.signalFragments ?? 0,
    timePlayedSec: raw?.playerStats?.timePlayedSec ?? 0,
    selectedSkin: raw?.selectedSkin ?? 'contact47',
  };
}

export function allSlotSummaries(): SlotSummary[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => slotSummary(i));
}

/** Erase a specific slot (from the menu). Resets the cache if it's active. */
export function resetSlot(i: number): void {
  try {
    localStorage.removeItem(slotKey(i));
    if (i === 0) localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    /* ignore */
  }
  setSlotName(i, ''); // an erased slot forgets its owner
  if (i === activeSlot) {
    cache = defaultSave();
    bus.emit(EVT.saveUpdated, cache);
  }
}

/** True if ANY slot has progress (used to decide whether to show top-bar reset). */
export function hasAnySave(): boolean {
  return allSlotSummaries().some((s) => s.exists);
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
