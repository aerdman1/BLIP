/**
 * Tiny shared UI state: how many shell modals (Command Center, settings,
 * transmissions) currently cover the game. Scenes consult this so ESC/START
 * handling never fights the shell overlays.
 */

let overlayDepth = 0;

export function setOverlayDepth(depth: number): void {
  overlayDepth = depth;
}

export function uiOverlayActive(): boolean {
  return overlayDepth > 0;
}
