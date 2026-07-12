/**
 * ProgressionSystem — the earn-loop spine (PROGRESSION_PLAN.md).
 * Channel A: each zone's boss + Signal Fragment grants ONE signature ability.
 * Grants are idempotent and routed through SaveSystem.grantAbility (which emits
 * EVT.abilityUnlocked). Returns the granted upgrade so the caller can fold it
 * into the fragment reward card.
 */
import { ZONE_SIGNATURE, upgradeById, type UpgradeDef } from '../data/upgrades';
import { grantAbility } from './SaveSystem';

export const progression = {
  /** Grant a zone's signature ability. Returns the def if newly granted, else null. */
  grantZoneSignature(zoneId: string): UpgradeDef | null {
    const id = ZONE_SIGNATURE[zoneId];
    if (!id) return null;
    const wasNew = grantAbility(id);
    return wasNew ? upgradeById(id) ?? null : null;
  },
};
