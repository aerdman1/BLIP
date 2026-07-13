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
  scale?: number; // uniform bolt scale (heavy shells read bigger)
  pierce?: boolean; // passes through enemies
  bounce?: number; // ricochets off walls N times
  homing?: boolean; // SEEKER: steers toward the nearest drone each update
  homingRate?: number; // steering rate (rad/sec) — how hard it curves
  explode?: { radius: number; damage: number }; // RUPTURE: AoE burst on impact (enemy or wall)
}

export const WEAPONS: Record<string, SweepWeapon> = {
  pulse: { id: 'pulse', name: 'PULSE', cooldownMs: 200, count: 1, spreadRad: 0, speed: 340, damage: 1, lifeMs: 1100, tint: P.signal, glow: P.signal },
  scatter: { id: 'scatter', name: 'SCATTER', cooldownMs: 520, count: 6, spreadRad: 0.5, speed: 300, damage: 1, lifeMs: 420, tint: P.warning, glow: P.warning },
  repeater: { id: 'repeater', name: 'REPEATER', cooldownMs: 92, count: 1, spreadRad: 0.16, speed: 380, damage: 1, lifeMs: 900, tint: P.neonCyan, glow: P.neonCyan },
  lance: { id: 'lance', name: 'LANCE', cooldownMs: 340, count: 1, spreadRad: 0, speed: 540, damage: 2, lifeMs: 900, tint: P.violetGlitch, glow: P.violetGlitch, scaleX: 2.4, pierce: true },
  arc: { id: 'arc', name: 'ECHO ARC', cooldownMs: 300, count: 1, spreadRad: 0, speed: 320, damage: 1, lifeMs: 1500, tint: P.signalGreen, glow: P.signalGreen, bounce: 2 },
  // SEEKER — fires a curving anomaly-bolt that hunts the nearest drone. Slower rounds,
  // but they chase weavers/divers around the corn. Steering is capped so it stays dodgeable-fair.
  seeker: { id: 'seeker', name: 'SEEKER', cooldownMs: 260, count: 1, spreadRad: 0.05, speed: 250, damage: 1, lifeMs: 1600, tint: P.violetGlitch, glow: P.violetGlitch, scale: 1.25, homing: true, homingRate: 6.5 },
  // RUPTURE — a heavy signal shell that detonates on contact, splashing AoE damage.
  // The finale's crowd-clearer: perfect for REPLICATOR shards and packed clearings.
  rupture: { id: 'rupture', name: 'RUPTURE', cooldownMs: 560, count: 1, spreadRad: 0, speed: 270, damage: 2, lifeMs: 900, tint: P.warning, glow: P.warning, scale: 1.9, explode: { radius: 62, damage: 2 } },
};

export const WEAPON_PICKUPS = ['scatter', 'repeater', 'lance', 'arc', 'seeker', 'rupture'];
