export type RegionGoalStatus = 'implemented' | 'partial' | 'planned' | 'missing';

export interface RegionGoal {
  arenaId: string;
  objective: string;
  activeHint: string;
  exitHint: string;
  rewardId: string;
  rewardName: string;
  rewardType: string;
  rewardDescription: string;
  completionBanner: string;
}

export const REGION_GOALS: Record<string, RegionGoal> = {
  'surface-z1': {
    arenaId: 'surface-z1',
    objective: 'Recover the Willow cache',
    activeHint: 'Clear the field node to triangulate Willow’s buried Scout cache.',
    exitHint: 'Road east open: stand in the motel breach.',
    rewardId: 'pulse-resonance',
    rewardName: 'Pulse Resonance',
    rewardType: 'Weapon mutation',
    rewardDescription: 'Charged Pulse Carbine shots arc into nearby exposed threats.',
    completionBanner: 'WILLOW CACHE RECOVERED',
  },
  'circuit-z2': {
    arenaId: 'circuit-z2',
    objective: 'Infiltrate the scanner grid',
    activeHint: 'Use Phase Shift through scanner pressure and disable the motel circuit.',
    exitHint: 'Motel circuit offline: stand in the River Road breach.',
    rewardId: 'emp-burst',
    rewardName: 'EMP Burst',
    rewardType: 'Scout tech',
    rewardDescription: 'Scan Pulse stuns nearby threats and clears hostile bolts.',
    completionBanner: 'SCANNER GRID OFFLINE',
  },
  'town-z3': {
    arenaId: 'town-z3',
    objective: 'Destroy the River Road tower',
    activeHint: 'Use alleys, cover and weapon switching to break the hostile tower.',
    exitHint: 'Town route clear: stand in the county trail breach.',
    rewardId: 'ghost-protocol',
    rewardName: 'Ghost Protocol',
    rewardType: 'Scout upgrade',
    rewardDescription: 'Detection builds slower after a Phase Shift.',
    completionBanner: 'RIVER ROAD TOWER DOWN',
  },
  'maze-z4': {
    arenaId: 'maze-z4',
    objective: 'Redirect the Orchard Gravity Well',
    activeHint: 'Activate the well, reach the raised ridge and break the Maze Heart.',
    exitHint: 'Storm passage open: enter the signal storm.',
    rewardId: 'pulse-ricochet',
    rewardName: 'Carbine Ricochet',
    rewardType: 'Weapon mutation',
    rewardDescription: 'Pulse shots bounce through tight lanes; Recall Disc returns with an electrical trail.',
    completionBanner: 'GRAVITY REGULATOR CLAIMED',
  },
  'anomaly-01': {
    arenaId: 'anomaly-01',
    objective: 'Break the Storm Classifier',
    activeHint: 'Survive the storm sequence and refuse the Engine’s classification.',
    exitHint: 'Vertical slice complete.',
    rewardId: 'refuse-label',
    rewardName: 'Refuse the Label',
    rewardType: 'Major story unlock',
    rewardDescription: 'Reject the read the Engine tries to pin on CONTACT-47.',
    completionBanner: 'THE CLASSIFICATION FAILS',
  },
};

export const SYSTEM_CHECKLIST: Array<{ name: string; status: RegionGoalStatus; note: string }> = [
  { name: 'True Phase Shift', status: 'implemented', note: 'SHIFT is now a short-range teleport with i-frames, start/end bursts and cooldown.' },
  { name: 'Signal Tubes', status: 'planned', note: 'Deferred until a later route needs fast conduit traversal.' },
  { name: 'Gravity Wells', status: 'partial', note: 'Playable introductory Orchard launch/raised-ridge interaction exists; deeper object/enemy redirection remains planned.' },
  { name: 'Phase Doors', status: 'planned', note: 'Tracked for future Phase Shift secrets and frequency gates.' },
  { name: 'Signal Rails', status: 'planned', note: 'Not required for this route pass.' },
  { name: 'Scout Contraptions', status: 'partial', note: 'Region rewards are Scout-tech named; dedicated authored contraption art remains later.' },
  { name: 'Raised areas', status: 'partial', note: 'Orchard raised ridge is a controlled destination with safe spawn and HUD feedback.' },
  { name: 'Underground areas', status: 'planned', note: 'Tracked for future Scout shelters and signal pockets.' },
  { name: 'Region-specific puzzles', status: 'partial', note: 'Orchard has the first Gravity Well puzzle; other regions use combat/stealth identities.' },
  { name: 'Stealth gameplay', status: 'partial', note: 'Motel scanner pressure and Phase Shift counterplay exist, but alert rules still need polish.' },
  { name: 'Weapon-specific secrets', status: 'partial', note: 'Town/Orchard cache hooks exist; bespoke weapon-only gates remain planned.' },
  { name: 'Weapon mutations', status: 'partial', note: 'Named region rewards are persisted; effects are intentionally light until the reward loop is expanded.' },
  { name: 'Major loot comparison/equip presentation', status: 'partial', note: 'Major rewards and weapon pickups show name/type/use; full compare/store/salvage is deferred.' },
  { name: 'Region-specific objectives', status: 'implemented', note: 'HUD, telemetry and rewards now use named region goals instead of generic node copy.' },
  { name: 'Distinct enemy combat roles', status: 'implemented', note: 'Drifter, tagger, diver, warden, turret, sniper, splitter and weaver are already active.' },
  { name: 'Memorable final encounter', status: 'partial', note: 'Maze Heart and Storm Classifier finale beats exist; future pass can add a larger boss presentation.' },
];

export function goalForArena(arenaId: string): RegionGoal {
  return REGION_GOALS[arenaId] ?? REGION_GOALS['surface-z1'];
}
