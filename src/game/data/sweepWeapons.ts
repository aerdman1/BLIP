/**
 * Top-down weapon roster — real variety so it's not "one gun forever". Each is a
 * data-driven fire spec consumed by SweepScene.fire(). Signal-themed guns.
 */
import { PALETTE as P } from '../config';

export interface SweepWeapon {
  id: string;
  name: string;
  cooldownMs: number;
  count: number; // bolts per shot
  spreadRad: number; // fan (count>1) or inaccuracy (count==1)
  speed: number;
  damage: number;
  lifeMs: number;
  tint: number;
  glow: number;
  scaleX?: number; // stretch the bolt (Lance)
  pierce?: boolean; // passes through enemies
  bounce?: number; // ricochets off walls N times
}

export const WEAPONS: Record<string, SweepWeapon> = {
  pulse: { id: 'pulse', name: 'PULSE', cooldownMs: 200, count: 1, spreadRad: 0, speed: 340, damage: 1, lifeMs: 1100, tint: P.signal, glow: P.signal },
  scatter: { id: 'scatter', name: 'SCATTER', cooldownMs: 520, count: 6, spreadRad: 0.5, speed: 300, damage: 1, lifeMs: 420, tint: P.warning, glow: P.warning },
  repeater: { id: 'repeater', name: 'REPEATER', cooldownMs: 92, count: 1, spreadRad: 0.16, speed: 380, damage: 1, lifeMs: 900, tint: P.neonCyan, glow: P.neonCyan },
  lance: { id: 'lance', name: 'LANCE', cooldownMs: 340, count: 1, spreadRad: 0, speed: 540, damage: 2, lifeMs: 900, tint: P.violetGlitch, glow: P.violetGlitch, scaleX: 2.4, pierce: true },
  arc: { id: 'arc', name: 'ECHO ARC', cooldownMs: 300, count: 1, spreadRad: 0, speed: 320, damage: 1, lifeMs: 1500, tint: P.signalGreen, glow: P.signalGreen, bounce: 2 },
};

export const WEAPON_PICKUPS = ['scatter', 'repeater', 'lance', 'arc'];
