import { type SweepEnemyKind } from '../config';

export type DamageFamily = 'kinetic' | 'pulse' | 'arc' | 'blast';
export type AffinityState = 'normal' | 'field-active' | 'burrowed' | 'surfaced' | 'disguised' | 'active';

export const WEAPON_DAMAGE_FAMILY: Record<string, DamageFamily> = {
  pulse: 'pulse',
  arc: 'arc',
  disc: 'kinetic',
};

const normal = (overrides: Partial<Record<DamageFamily, number>> = {}): Record<DamageFamily, number> => ({
  kinetic: 1,
  pulse: 1,
  arc: 1,
  blast: 1,
  ...overrides,
});

export const ENEMY_AFFINITIES: Partial<Record<SweepEnemyKind, Partial<Record<AffinityState, Record<DamageFamily, number>>>>> = {
  cipher: { normal: normal({ kinetic: 1.5, arc: 0.65 }) },
  graviton: {
    normal: normal({ arc: 1.5, blast: 0.65 }),
    'field-active': normal({ kinetic: 1.5, arc: 2, blast: 0.65 }),
  },
  undertow: {
    burrowed: normal({ kinetic: 0.25, pulse: 0.35, arc: 0.75, blast: 1.75 }),
    surfaced: normal({ arc: 1.25, blast: 1.25 }),
  },
  decoy: {
    disguised: normal({ kinetic: 0.35, pulse: 0.65, arc: 1.75, blast: 1.4 }),
    active: normal({ arc: 1.5, blast: 1.15 }),
  },
  dormant: {
    disguised: normal({ kinetic: 0.35, pulse: 0.65, arc: 1.75, blast: 1.5 }),
    active: normal({ arc: 1.25, blast: 1.15 }),
  },
};

export function damageFamilyForWeapon(weaponId: string): DamageFamily {
  return WEAPON_DAMAGE_FAMILY[weaponId] ?? 'pulse';
}

export function affinityMultiplier(kind: SweepEnemyKind, state: AffinityState, family: DamageFamily): number {
  const matrix = ENEMY_AFFINITIES[kind];
  return matrix?.[state]?.[family] ?? matrix?.normal?.[family] ?? 1;
}

export function affinityLabel(multiplier: number): 'WEAK' | 'RESIST' | '' {
  if (multiplier >= 1.45) return 'WEAK';
  if (multiplier <= 0.7) return 'RESIST';
  return '';
}
