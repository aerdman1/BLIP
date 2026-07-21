/**
 * Top-down weapon roster — real variety so it's not "one gun forever". Each is a
 * data-driven fire spec consumed by SweepScene.fire(). Signal-themed guns.
 */
import { PALETTE as P } from '../config';

export interface SweepWeapon {
  id: string;
  name: string;
  role: string;
  cooldownMs: number;
  count: number; // bolts per shot
  spreadRad: number; // fan (count>1) or inaccuracy (count==1)
  speed: number;
  damage: number;
  lifeMs: number;
  tint: number;
  glow: number;
  scaleX?: number; // stretch a bolt for charged/piercing shots
  scale?: number; // uniform bolt scale (heavy shells read bigger)
  pierce?: boolean; // passes through enemies
  bounce?: number; // ricochets off walls N times
  homing?: boolean; // reserved for future seeking mutations
  homingRate?: number; // steering rate (rad/sec) — how hard it curves
  explode?: { radius: number; damage: number }; // reserved for future explosive mutations
}

export const WEAPONS: Record<string, SweepWeapon> = {
  pulse: {
    id: 'pulse',
    name: 'PULSE CARBINE',
    role: 'fast ranged fire · every fifth shot pierces',
    cooldownMs: 150,
    count: 1,
    spreadRad: 0.03,
    speed: 390,
    damage: 1,
    lifeMs: 1050,
    tint: P.signal,
    glow: P.signal,
  },
  arc: {
    id: 'arc',
    name: 'ARC BLADE',
    role: 'close cone combo · reflects nearby bolts',
    cooldownMs: 280,
    count: 0,
    spreadRad: 0,
    speed: 0,
    damage: 2,
    lifeMs: 120,
    tint: P.scoutCameron,
    glow: P.scoutCameron,
  },
  disc: {
    id: 'disc',
    name: 'RECALL DISC',
    role: 'thrown line · hits again on return',
    cooldownMs: 620,
    count: 1,
    spreadRad: 0,
    speed: 310,
    damage: 1,
    lifeMs: 1700,
    tint: P.warning,
    glow: P.warning,
    scale: 1.5,
    pierce: true,
  },
};

export const WEAPON_PICKUPS = ['pulse', 'arc', 'disc'];
