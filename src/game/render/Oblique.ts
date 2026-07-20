/**
 * Oblique — the fake three-quarter angle.
 *
 * The ground stays FLAT top-down (perspective-projecting it would break the 1:1
 * map between the top-down physics circle and the render). The 2.5D read comes
 * entirely from what stands on it:
 *
 *   - every prop is a base-anchored billboard, origin (0.5, 1), drawn at its
 *     FOOTPRINT y, showing its front face plus a hint of top surface;
 *   - one constant `k` says how much ground depth a given render height eats.
 *
 * k drives the shadow ellipse squash, the wall extrusion, and elevated sorting.
 */
import Phaser from 'phaser';
import { TD_VISUALS } from '../config';

export const OBLIQUE = {
  k: TD_VISUALS.obliqueK,
  tilt: TD_VISUALS.lensTilt,
  wallH: TD_VISUALS.wallHeight,
} as const;

/** Ground depth consumed by something rendered `h` px tall. */
export function groundDepthOf(h: number): number {
  return h * OBLIQUE.k;
}

/** Anchor a sprite at its footprint so it stands on the ground plane. */
export function standOn<T extends Phaser.GameObjects.Components.Origin>(obj: T): T {
  obj.setOrigin(0.5, 1);
  return obj;
}

/**
 * Subtle lens tilt: content further from the camera centre shifts slightly,
 * so the arena parallaxes as you move. Two lines, trivially reversible —
 * set TD_VISUALS.lensTilt to 0 to disable.
 */
export function tiltOffset(worldY: number, camMidY: number): number {
  return (worldY - camMidY) * OBLIQUE.tilt;
}

/**
 * Shadow ellipse dimensions for a caster of footprint width `w` sitting `lift`
 * px above the ground. Higher casters get a larger, softer, more offset shadow.
 */
export function shadowShape(w: number, lift = 0): { sx: number; sy: number; alpha: number } {
  const spread = 1 + lift / 40;
  return {
    sx: (w / 32) * spread,
    sy: (w / 32) * OBLIQUE.k * spread,
    alpha: Phaser.Math.Clamp(0.55 - lift / 90, 0.12, 0.55),
  };
}

/** Where a caster's shadow lands, given the global light direction. */
export function shadowOffset(lift: number): { dx: number; dy: number } {
  const a = TD_VISUALS.lightAngle;
  const d = lift * TD_VISUALS.shadowLen;
  return { dx: Math.cos(a) * d * -1, dy: Math.sin(a) * d * OBLIQUE.k };
}
