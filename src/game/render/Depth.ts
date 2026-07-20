/**
 * Depth — the top-down draw-order contract.
 *
 * Replaces the hand-picked small integers that used to be scattered through
 * SweepScene.buildMap (0,1,2,6,7,8,9,10,11,12,30,31). Those were already
 * monotone in the intended order, so the mapping is 1:1 and behaviour-neutral.
 *
 * The point of the huge `sorted` band is y-sorting: anything standing on the
 * ground gets `sortedDepth(baseY)` — its FEET, not its centre — so a prop
 * further down the screen draws in front. That single rule is what produces
 * occlusion and makes a flat arena read as 2.5D.
 */

export const DEPTH = {
  ground: 0,
  patch: 1_000,
  decal: 2_000,
  shadow: 3_000,
  /** y-sorted band — 940k of headroom, far more than any arena's pixel height */
  sorted: 10_000,
  /** things above the ground plane (motes, bolts, beams, muzzle flashes) */
  air: 950_000,
  fxOverlay: 960_000,
  /** the multiply-darkness layer + additive lights ride just under the UI */
  lighting: 965_000,
  weather: 970_000,
  reticle: 980_000,
  foreground: 990_000,
} as const;

/** Depth for something standing on the ground at world-y `baseY` (its feet). */
export function sortedDepth(baseY: number): number {
  return DEPTH.sorted + Math.round(baseY);
}

/**
 * Depth for something hovering at `baseY` with `height` px of air under it.
 * Biased above ground contacts at the same y so a drone never sorts behind the
 * shadow it casts, while still sorting correctly against distant props.
 */
export function airDepth(baseY: number, height = 0): number {
  return DEPTH.sorted + Math.round(baseY) + Math.round(height) + 1;
}
