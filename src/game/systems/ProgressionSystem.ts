/**
 * ProgressionSystem — the earn-loop spine.
 * Channel A: each zone's boss + Signal Fragment grants ONE signature ability.
 * Grants are idempotent and routed through SaveSystem.grantAbility (which emits
 * EVT.abilityUnlocked). Returns the granted upgrade so callers can render it
 * in reward cards.
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

  /** Grant a zone's SECONDARY reward (the second ability a boss hands over).
   *  Idempotent — returns the def only the first time. */
  grantSecondary(id: string): UpgradeDef | null {
    const wasNew = grantAbility(id);
    return wasNew ? upgradeById(id) ?? null : null;
  },
};

/** `◆ ABILITY UNLOCKED` reward-card lines for however many abilities landed. */
export function abilityUnlockLines(...abilities: Array<UpgradeDef | null>): string {
  return abilities
    .filter((a): a is UpgradeDef => a !== null)
    .map((a) => `\n\n◆ ABILITY UNLOCKED — ${a.name}\n${a.description}`)
    .join('');
}
