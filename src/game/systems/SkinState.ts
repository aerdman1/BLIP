/**
 * Active Signal Skin state — a tiny shared accessor so gameplay and UI read the
 * same equipped skin's modifiers/abilities without threading it through constructors.
 */
import { DEFAULT_SKIN, skinById, type SkinAbilities, type SkinDef, type SkinMods } from '../data/skins';

let current: SkinDef = skinById(DEFAULT_SKIN);

/** set the live skin state (no event — callers emit EVT.skinSelected at intent points) */
export function setActiveSkin(id: string): void {
  current = skinById(id);
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
