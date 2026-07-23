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
    activeHint: 'Find Willow’s buried proof that CONTACT-47 is not an invasion signal.',
    exitHint: 'Road east open: stand in the motel breach.',
    rewardId: 'pulse-resonance',
    rewardName: 'Willow Mutation Choice',
    rewardType: 'Build choice',
    rewardDescription: 'Choose the first permanent combat mutation: stronger Pulse chains, Arc parry shockwaves, or Recall return lightning.',
    completionBanner: 'WILLOW CACHE RECOVERED',
  },
  'circuit-z2': {
    arenaId: 'circuit-z2',
    objective: 'Infiltrate the scanner grid',
    activeHint: 'Hold Boost through the red scanner grid before it turns CONTACT-47 into a target file.',
    exitHint: 'Motel circuit offline: stand in the River Road breach.',
    rewardId: 'phase-drift-plus',
    rewardName: 'Phase Boost+',
    rewardType: 'Traversal upgrade',
    rewardDescription: 'Boost lasts longer, recovers faster, and burns hostile bolts out of your path.',
    completionBanner: 'SCANNER GRID OFFLINE',
  },
  'town-z3': {
    arenaId: 'town-z3',
    objective: 'Hold the River Road sync point',
    activeHint: 'Deploy Scout Relay cover, then survive the tower’s street push.',
    exitHint: 'Town route clear: stand in the county trail breach.',
    rewardId: 'relay-pylon',
    rewardName: 'Scout Relay Pylon',
    rewardType: 'Deployable tech',
    rewardDescription: 'Scout-built pylons can briefly defend a synchronization point by firing at nearby drones.',
    completionBanner: 'RIVER ROAD SYNC HELD',
  },
  'maze-z4': {
    arenaId: 'maze-z4',
    objective: 'Redirect the Orchard Gravity Well',
    activeHint: 'Activate the well, reach the raised ridge and open the Crop Circle route.',
    exitHint: 'Storm passage open: enter the signal storm.',
    rewardId: 'pulse-ricochet',
    rewardName: 'Gravity Conduit',
    rewardType: 'Traversal secret',
    rewardDescription: 'Pulse shots ricochet through tight rows and Recall Disc returns with a damaging electrical trail.',
    completionBanner: 'GRAVITY REGULATOR CLAIMED',
  },
  'anomaly-01': {
    arenaId: 'anomaly-01',
    objective: 'Break the Storm Classifier',
    activeHint: 'Prove every Scout signal, weapon and traversal trick before the Engine finishes naming you.',
    exitHint: 'Vertical slice complete.',
    rewardId: 'refuse-label',
    rewardName: 'Refuse the Label',
    rewardType: 'Major story unlock',
    rewardDescription: 'CONTACT-47 rejects the Engine’s final read: not weather, not weapon, not monster. Alive enough to choose.',
    completionBanner: 'THE CLASSIFICATION FAILS',
  },
};

export const SYSTEM_CHECKLIST: Array<{ name: string; status: RegionGoalStatus; note: string }> = [
  { name: 'Phase Boost', status: 'implemented', note: 'SHIFT/RB/touch Boost is now a held surge with boost energy, regeneration, i-frames and scanner crossing.' },
  { name: 'Signal Tubes', status: 'planned', note: 'Deferred until a later route needs fast conduit traversal.' },
  { name: 'Gravity Wells', status: 'partial', note: 'Playable introductory Orchard launch/raised-ridge interaction exists; deeper object/enemy redirection remains planned.' },
  { name: 'Phase Doors', status: 'planned', note: 'Tracked for future Phase Boost secrets and frequency gates.' },
  { name: 'Signal Rails', status: 'planned', note: 'Not required for this route pass.' },
  { name: 'Scout Contraptions', status: 'partial', note: 'Region rewards are Scout-tech named; dedicated authored contraption art remains later.' },
  { name: 'Raised areas', status: 'partial', note: 'Orchard raised ridge is a controlled destination with safe spawn and HUD feedback.' },
  { name: 'Underground areas', status: 'planned', note: 'Tracked for future Scout shelters and signal pockets.' },
  { name: 'Region-specific puzzles', status: 'partial', note: 'Orchard has the first Gravity Well puzzle; other regions use combat/stealth identities.' },
  { name: 'Stealth gameplay', status: 'partial', note: 'Motel scanner pressure and Boost counterplay exist, but alert rules still need polish.' },
  { name: 'Weapon-specific secrets', status: 'partial', note: 'Town/Orchard cache hooks exist; bespoke weapon-only gates remain planned.' },
  { name: 'Weapon mutations', status: 'partial', note: 'Miller now grants a first build choice between Pulse Overchain, Arc Reprisal and Recall Conduit; Orchard grants broader Gravity Conduit behavior.' },
  { name: 'Major loot comparison/equip presentation', status: 'partial', note: 'Major rewards and weapon pickups show name/type/use; full compare/store/salvage is deferred.' },
  { name: 'Region-specific objectives', status: 'implemented', note: 'HUD, telemetry and rewards now use named region goals instead of generic node copy.' },
  { name: 'Distinct enemy combat roles', status: 'implemented', note: 'Drifter, tagger, diver, warden, turret, sniper, splitter and weaver are already active.' },
  { name: 'Memorable final encounter', status: 'partial', note: 'Storm Classifier finale beats exist; dormant Maze Heart code is deferred until Orchard needs a separate boss.' },
];

export function goalForArena(arenaId: string): RegionGoal {
  return REGION_GOALS[arenaId] ?? REGION_GOALS['surface-z1'];
}
