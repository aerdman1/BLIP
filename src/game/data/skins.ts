/**
 * SIGNAL SKINS — single source of truth for scout sidegrade skins.
 * Each skin recolors CONTACT-47 into a scout and grants that scout's signature
 * ability drawn from their zone mechanic. UNKNOWN / CONTACT-47 is the baseline
 * with no tradeoffs. ALL tuning lives here — Player/CC read, never hardcode.
 */
import { PALETTE as P } from '../config';

/** multiplicative/additive modifiers layered over the base config values */
export interface SkinMods {
  scanRadiusMul?: number;
  scanCooldownMul?: number;
  pulseDamageMul?: number;
  pulseCooldownMul?: number;
  energyMaxMul?: number;
  energyRegenMul?: number;
  runSpeedMul?: number;
  dashCooldownMul?: number;
  dashSpeedMul?: number;
  maxHpDelta?: number;
  classifyFillMul?: number;
}

export interface SkinAbilities {
  reconPing?: boolean; // WILLOW — scan outlines enemy cones/aggro
  keepRevealed?: boolean; // WILLOW — revealed stays revealed in-room
  surgeShot?: boolean; // SPARK — every 3rd pulse ×2 + trips switches
  machineRecharge?: boolean; // SPARK — recharge near signal boxes
  anchorField?: boolean; // ANCHOR — plant a healing/declassify zone
  slowRegen?: boolean; // ANCHOR — heal while still, out of cones
  echoShot?: boolean; // ECHO — pulses bounce once
  overdriveDash?: boolean; // ROCKET — dash kills feed the pressure loop
  phaseStrike?: boolean; // ROCKET — dashing through a drone damages it
}

export interface SkinDef {
  id: string;
  scoutId: string | null;
  name: string; // callsign / display (UI + HUD)
  scoutName: string;
  color: number;
  klass: string;
  fantasy: string;
  passive: string;
  signature: string;
  tradeoff: string;
  bestIn: string;
  mods: SkinMods;
  abilities: SkinAbilities;
}

export const SKINS: SkinDef[] = [
  {
    id: 'contact47',
    scoutId: null,
    name: 'CONTACT-47',
    scoutName: 'Unknown',
    color: P.shellWhite,
    klass: 'Baseline',
    fantasy: 'The thing on the radar. No tradeoffs.',
    passive: 'The true formless blip. Every stat at its honest baseline.',
    signature: '—',
    tradeoff: 'None. Fully viable everywhere.',
    bestIn: 'Anywhere. The sidegrade everything else measures against.',
    mods: {},
    abilities: {},
  },
  {
    id: 'will',
    scoutId: 'will',
    name: 'WILLOW',
    scoutName: 'Will',
    color: P.scoutWill,
    klass: 'Recon',
    fantasy: 'See the safe path and the enemy’s eyes.',
    passive: 'Wider, faster scan; revealed caches and route markers stay visible longer.',
    signature: 'Recon Ping — a scan also outlines every detection cone and aggro radius for a few seconds.',
    tradeoff: 'Pulse damage ×0.9 — a scout, not a fighter.',
    bestIn: 'Chagrin Falls High (stealth) and any hidden-route content.',
    mods: { scanRadiusMul: 1.4, scanCooldownMul: 0.75, pulseDamageMul: 0.9 },
    abilities: { reconPing: true, keepRevealed: true },
  },
  {
    id: 'chip',
    scoutId: 'chip',
    name: 'SPARK',
    scoutName: 'Chip',
    color: P.scoutChip,
    klass: 'Engineer',
    fantasy: 'Overcharged shots, machine logic, live off the circuit.',
    passive: 'Bigger overdrive economy and steadier fire tempo near signal machinery.',
    signature: 'Surge Shot — every 3rd pulse is a SURGE (×2 dmg, instantly trips node switches).',
    tradeoff: 'Dash cooldown ×1.15 — relies on thrusters, not dashes.',
    bestIn: 'Motel Circuit and node-charge fights.',
    mods: { energyMaxMul: 1.5, energyRegenMul: 1.4, dashCooldownMul: 1.15 },
    abilities: { surgeShot: true, machineRecharge: true },
  },
  {
    id: 'henry',
    scoutId: 'henry',
    name: 'ANCHOR',
    scoutName: 'Henry',
    color: P.scoutHenry,
    klass: 'Guardian',
    fantasy: 'Hard to kill, hard to classify, drop safe zones.',
    passive: '+1 max hull; the Engine reads you 40% slower; slow regen while still and out of any red cone.',
    signature: 'Anchor Field — plant a safe zone that decays classification and heals over a few seconds.',
    tradeoff: 'Run speed ×0.9 — heavy.',
    bestIn: 'Chagrin Falls High (detection-heavy) and boss fights.',
    mods: { maxHpDelta: 1, classifyFillMul: 0.6, runSpeedMul: 0.9 },
    abilities: { anchorField: true, slowRegen: true },
  },
  {
    id: 'cameron',
    scoutId: 'cameron',
    name: 'ECHO',
    scoutName: 'Cameron',
    color: P.scoutCameron,
    klass: 'Trickster',
    fantasy: 'Reflection timing and route memory.',
    passive: 'Faster weapon cadence. Scanned route markers linger longer.',
    signature: 'Echo Shot — signal shots bounce once off geometry.',
    tradeoff: 'Scan radius ×0.9 — reads patterns, not terrain.',
    bestIn: "Patterson's Orchard and tight route fights.",
    mods: { pulseCooldownMul: 0.9, scanRadiusMul: 0.9 },
    abilities: { echoShot: true },
  },
  {
    id: 'danny',
    scoutId: 'danny',
    name: 'ROCKET',
    scoutName: 'Danny',
    color: P.scoutDanny,
    klass: 'Speed',
    fantasy: 'Dash king / glass cannon.',
    passive: 'Much shorter dash cooldown, faster dash and movement, longer i-frames.',
    signature: 'Phase-Strike — dashing through a drone damages it and leaves a burning afterimage.',
    tradeoff: '−1 max hull (glass cannon); the Engine reads you 20% faster (you run hot).',
    bestIn: 'Signal Storm and speed challenges.',
    mods: { dashCooldownMul: 0.55, dashSpeedMul: 1.15, runSpeedMul: 1.15, maxHpDelta: -1, classifyFillMul: 1.2 },
    abilities: { overdriveDash: true, phaseStrike: true },
  },
];

export const DEFAULT_SKIN = 'contact47';
export const skinById = (id: string): SkinDef => SKINS.find((s) => s.id === id) ?? SKINS[0];
export const skinByScout = (scoutId: string): SkinDef | undefined => SKINS.find((s) => s.scoutId === scoutId);

/** The 3-piece Signal Set that unlocks each scout's skin. */
export const SET_PIECES = ['badge', 'log', 'relic'] as const;
export type SetPiece = (typeof SET_PIECES)[number];

export interface RelicDef {
  scoutId: string;
  name: string;
  color: number;
}

export const RELICS: RelicDef[] = [
  { scoutId: 'will', name: 'the Route Map', color: P.scoutWill },
  { scoutId: 'chip', name: 'the Power Cell', color: P.scoutChip },
  { scoutId: 'henry', name: 'the Signal Flare', color: P.scoutHenry },
  { scoutId: 'cameron', name: 'the Tuning Fork', color: P.scoutCameron },
  { scoutId: 'danny', name: 'the Cracked Goggles', color: P.scoutDanny },
];
