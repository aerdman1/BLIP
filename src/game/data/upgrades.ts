/**
 * Ability / upgrade ledger.
 * Three earn-channels: 'boss' (one signature per area), 'shop' (Chip's Workbench,
 * spend Signal Shards), 'scout-set' (complete a scout's 3-piece set). The base
 * kit is always owned. Costs/tuning live in config.PROGRESSION; the Command
 * Center renders this table live — keep `status` honest as things land.
 */

export type UnlockType = 'base' | 'boss' | 'shop' | 'scout-set';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  status: 'IMPLEMENTED' | 'UNLOCKED_PLACEHOLDER' | 'PLANNED';
  source: string;
  unlockType: UnlockType;
  zone?: string; // 'boss' signatures — which zone's boss grants it
  scout?: string; // 'scout-set' — which scout's set grants it
  cost?: number; // 'shop' — base-tier Shard cost (tiers in config.PROGRESSION)
  gatedBy?: string; // ability id that soft-gates a backtrack route to this
}

export const UPGRADES: UpgradeDef[] = [
  // --- base kit (always owned) ---
  { id: 'move', name: 'Signal Drive', description: 'Eight-direction top-down movement with responsive acceleration.', status: 'IMPLEMENTED', source: 'base kit', unlockType: 'base' },
  { id: 'dash', name: 'Phase Shift', description: 'Short-range blink with afterimages and brief invulnerability.', status: 'IMPLEMENTED', source: 'base kit', unlockType: 'base' },
  { id: 'pulse-shot', name: 'Pulse Carbine', description: 'Fast ranged signal fire with every fifth shot piercing clustered enemies.', status: 'IMPLEMENTED', source: 'base kit', unlockType: 'base' },
  { id: 'scan-pulse', name: 'Scan Pulse', description: 'Expanding ring that reveals caches, routes and weak points.', status: 'IMPLEMENTED', source: 'base kit', unlockType: 'base' },
  { id: 'overdrive', name: 'Signal Overdrive', description: 'Kill-charged shockwave plus rapid-fire window.', status: 'IMPLEMENTED', source: 'base kit', unlockType: 'base' },

  // --- Channel A: signature abilities (one per zone, from the boss) ---
  { id: 'pulse-resonance', name: 'Pulse Resonance', description: '+1 carbine damage against exposed signal cores.', status: 'IMPLEMENTED', source: 'Miller Surface node', unlockType: 'boss', zone: 'miller-field' },
  { id: 'emp-burst', name: 'EMP Burst', description: 'Your SCAN also fires an EMP shockwave that stuns enemies and clears bolts in a radius.', status: 'IMPLEMENTED', source: 'Motel Circuit node', unlockType: 'boss', zone: 'motel-nowhere' },
  { id: 'ghost-protocol', name: 'Ghost Protocol', description: 'Passive stealth — detection builds far slower, and for a beat after Phase Shift you are unreadable.', status: 'IMPLEMENTED', source: 'Chagrin Falls Town node', unlockType: 'boss', zone: 'tiger-stadium' },
  { id: 'pulse-ricochet', name: 'Carbine Ricochet', description: 'Carbine shots bounce off geometry and chain-deflect to nearby enemies.', status: 'IMPLEMENTED', source: 'Patterson’s Orchard node', unlockType: 'boss', zone: 'pattersons-orchard' },
  { id: 'scan-memory', name: 'Scan Memory', description: 'Your SCAN remembers — the ring lingers and everything it touched keeps a glowing echo marker for several seconds.', status: 'IMPLEMENTED', source: 'Patterson’s Orchard (secondary)', unlockType: 'boss', zone: 'pattersons-orchard' },
  { id: 'phase-drift-plus', name: 'Phase Shift+', description: 'Longer, faster blink that phases clean through enemy bolts.', status: 'IMPLEMENTED', source: 'Signal Storm (secondary)', unlockType: 'boss', zone: 'skyline-array' },
  { id: 'refuse-label', name: 'Refuse the Label', description: 'For a beat, reject whatever the Engine decided you are and clear the read it tried to pin on you.', status: 'IMPLEMENTED', source: 'Signal Storm node', unlockType: 'boss', zone: 'skyline-array' },

  // --- Channel B: Chip's Workbench (spend Signal Shards) ---
  { id: 'wide-scan', name: 'Wide Scan', description: 'Bigger Scan Pulse radius — reveal and EMP reach further.', status: 'IMPLEMENTED', source: 'Chip’s Workbench', unlockType: 'shop', cost: 120 },
  { id: 'max-hull-plus', name: 'Reinforced Hull', description: '+1 hull segment — take one more hit.', status: 'IMPLEMENTED', source: 'Chip’s Workbench', unlockType: 'shop', cost: 90 },
  { id: 'pulse-rapid', name: 'Carbine Capacitor', description: 'Faster Pulse Carbine cadence — fire more often.', status: 'IMPLEMENTED', source: 'Chip’s Workbench', unlockType: 'shop', cost: 110 },
  { id: 'dash-recharge', name: 'Shift Capacitor', description: 'Shorter Phase Shift cooldown — blink again sooner.', status: 'IMPLEMENTED', source: 'Chip’s Workbench', unlockType: 'shop', cost: 100 },

  // --- Channel C: scout Signal-Set completion ---
  { id: 'route-tracer', name: 'Route Tracer', description: 'A glowing line draws itself behind you as you move and fades a couple of seconds later — the way Will drew maps.', status: 'IMPLEMENTED', source: 'Will / WILLOW Signal Set', unlockType: 'scout-set', scout: 'will' },
  { id: 'echo-blink', name: 'Echo Blink', description: 'Place a signal echo, snap back to it. While it lives, scanners read the echo — not you (decoy).', status: 'IMPLEMENTED', source: 'Cameron / ECHO Signal Set', unlockType: 'scout-set', scout: 'cameron' },
];

/** the marquee signature ability a zone's boss grants (Channel A) */
export const ZONE_SIGNATURE: Record<string, string> = {
  'miller-field': 'pulse-resonance',
  'motel-nowhere': 'emp-burst',
  'tiger-stadium': 'ghost-protocol',
  'pattersons-orchard': 'pulse-ricochet',
  'skyline-array': 'refuse-label',
};

export const upgradeById = (id: string): UpgradeDef | undefined => UPGRADES.find((u) => u.id === id);
