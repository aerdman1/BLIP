/**
 * Tiny shared UI state: how many shell modals (Command Center, settings,
 * transmissions) currently cover the game. Scenes consult this so ESC/START
 * handling never fights the shell overlays.
 */

let overlayDepth = 0;
let rewardDepth = 0; // independent counter owned by the reward layer (RewardUI)

export function setOverlayDepth(depth: number): void {
  overlayDepth = depth;
}

/** RewardUI pushes/pops its own modal depth so it never stomps ShellUI's. */
export function pushRewardOverlay(): void {
  rewardDepth++;
}
export function popRewardOverlay(): void {
  rewardDepth = Math.max(0, rewardDepth - 1);
}

export function uiOverlayActive(): boolean {
  return overlayDepth > 0 || rewardDepth > 0;
}
