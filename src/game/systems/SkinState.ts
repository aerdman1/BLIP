/**
 * Legacy Signal Skin accessor. Wardrobe is cut from active gameplay, so all
 * callers receive CONTACT-47 baseline mods/abilities.
 */
import { DEFAULT_SKIN, skinById, type SkinAbilities, type SkinDef, type SkinMods } from '../data/skins';

let current: SkinDef = skinById(DEFAULT_SKIN);

/** Keep old callers safe while forcing CONTACT-47 baseline. */
export function setActiveSkin(id: string): void {
  void id;
  current = skinById(DEFAULT_SKIN);
}

export function activeSkin(): SkinDef {
  return current;
}

export function skinMods(): SkinMods {
  return current.mods;
}

export function skinAbilities(): SkinAbilities {
  return current.abilities;
}

/** apply a multiplier mod to a base value (undefined → ×1) */
export function withMod(base: number, mul: number | undefined): number {
  return base * (mul ?? 1);
}
