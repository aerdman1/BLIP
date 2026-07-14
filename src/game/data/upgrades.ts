/**
 * Ability / upgrade roadmap — now with EARN-metadata (PROGRESSION_PLAN.md).
 * Three earn-channels: 'boss' (one signature per zone), 'shop' (Chip's Workbench,
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
  { id: 'run', name: 'Locomotion', description: 'Ground movement with real acceleration.', status: 'IMPLEMENTED', source: 'base kit', unlockType: 'base' },
  { id: 'jump', name: 'Hop Vector', description: 'Variable-height jump with coyote time.', status: 'IMPLEMENTED', source: 'base kit', unlockType: 'base' },
  { id: 'hover', name: 'Hover Cell', description: 'Hold jump in the air to feather your fall. Drains energy.', status: 'IMPLEMENTED', source: 'base kit', unlockType: 'base' },
  { id: 'dash', name: 'Phase Drift', description: 'Short dash with afterimages and brief invulnerability.', status: 'IMPLEMENTED', source: 'base kit', unlockType: 'base' },
  { id: 'pulse-shot', name: 'Pulse Shot', description: 'Fast signal bolt. Hurts drones, activates node switches.', status: 'IMPLEMENTED', source: 'base kit', unlockType: 'base' },
  { id: 'scan-pulse', name: 'Scan Pulse', description: 'Expanding ring that reveals hidden platforms, routes and weak points.', status: 'IMPLEMENTED', source: 'base kit', unlockType: 'base' },

  // --- Channel A: signature abilities (one per zone, from the boss) ---
  { id: 'pulse-resonance', name: 'Pulse Resonance', description: '+1 pulse damage against exposed boss cores.', status: 'IMPLEMENTED', source: 'Fragment 1 — Scarecrow Antenna', unlockType: 'boss', zone: 'miller-field' },
  { id: 'emp-burst', name: 'EMP Burst', description: 'Your SCAN also fires an EMP shockwave — stuns enemies and clears their bolts in a radius.', status: 'IMPLEMENTED', source: 'Fragment 2 — The Vacancy Sign', unlockType: 'boss', zone: 'motel-nowhere' },
  { id: 'ghost-protocol', name: 'Ghost Protocol', description: 'Passive stealth — detection builds far slower, and for a beat after a dash you are unreadable.', status: 'IMPLEMENTED', source: 'Fragment 3 — The Weather Balloon', unlockType: 'boss', zone: 'tiger-stadium' },
  { id: 'pulse-ricochet', name: 'Pulse Ricochet', description: 'PULSE shots bounce off geometry and chain-deflect to nearby enemies.', status: 'IMPLEMENTED', source: 'Fragment 4 — The Harvest Pattern', unlockType: 'boss', zone: 'pattersons-orchard' },
  { id: 'scan-memory', name: 'Scan Memory', description: 'Revealed objects stay visible far longer.', status: 'PLANNED', source: 'Patterson’s Orchard (secondary)', unlockType: 'boss', zone: 'pattersons-orchard' },
  { id: 'phase-drift-plus', name: 'Phase Drift+', description: 'Longer dash that phases through bolts (air-dash to high routes).', status: 'PLANNED', source: 'Skyline Array (secondary)', unlockType: 'boss', zone: 'skyline-array' },
  { id: 'refuse-label', name: 'Refuse the Label', description: 'The finale power: for a beat, reject whatever the Engine decided you are — clear your classification and pass through the read it tried to pin on you.', status: 'IMPLEMENTED', source: 'Fragment 5 — The Listening Station', unlockType: 'boss', zone: 'skyline-array' },

  // --- Channel B: Chip's Workbench (spend Signal Shards) ---
  { id: 'hover-cell-plus', name: 'Hover Cell+', description: 'Longer hover, slower drain.', status: 'PLANNED', source: 'Chip’s Workbench', unlockType: 'shop', cost: 120 },
  { id: 'wide-scan', name: 'Wide Scan', description: 'Bigger scan radius.', status: 'PLANNED', source: 'Chip’s Workbench', unlockType: 'shop', cost: 120 },

  // --- Channel C: scout Signal-Set completion ---
  { id: 'route-tracer', name: 'Route Tracer', description: 'Draw a glowing path as you move, the way Will drew maps.', status: 'PLANNED', source: 'Will / WILLOW Signal Set', unlockType: 'scout-set', scout: 'will' },
  { id: 'echo-blink', name: 'Echo Blink', description: 'Place a signal echo, snap back to it. While it lives, scanners read the echo — not you (decoy).', status: 'IMPLEMENTED', source: 'Cameron / ECHO Signal Set (earn-wiring lands with Zone 4)', unlockType: 'scout-set', scout: 'cameron' },
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
