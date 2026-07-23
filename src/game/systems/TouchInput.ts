/**
 * Shared touch-input state — the bridge between the DOM on-screen controls
 * (src/ui/TouchControls.ts) and the poll-based PlayerInput (InputSystem.ts).
 *
 * The overlay WRITES here on pointer events; PlayerInput READS here each frame.
 * Held flags (move/primary/shoot) are level-triggered; the *Queued flags are
 * one-shot edges that PlayerInput.update() consumes and clears — mirroring the
 * existing rightScanQueued pattern so tap timing never gets lost between frames.
 *
 * No DOM or Phaser imports here on purpose: gameplay stays decoupled from the UI.
 */
export interface TouchInputState {
  active: boolean; // true only while the on-screen controls are engaged
  moveX: -1 | 0 | 1; // D-pad left/right
  moveY: -1 | 0 | 1; // D-pad up/down
  aimX: number; // analog stick vector, -1..1
  aimY: number;
  primaryHeld: boolean; // primary touch action
  shootHeld: boolean; // hold to auto-fire
  dashHeld: boolean; // hold to boost
  // one-shot edges (set by overlay, cleared by PlayerInput.update)
  primaryQueued: boolean;
  dashQueued: boolean;
  scanQueued: boolean;
  interactQueued: boolean;
  echoQueued: boolean;
  weaponNextQueued: boolean;
  pauseQueued: boolean;
}

export const touchInput: TouchInputState = {
  active: false,
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  primaryHeld: false,
  shootHeld: false,
  dashHeld: false,
  primaryQueued: false,
  dashQueued: false,
  scanQueued: false,
  interactQueued: false,
  echoQueued: false,
  weaponNextQueued: false,
  pauseQueued: false,
};

/** Clear all input (used when the overlay hides mid-press so nothing sticks). */
export function resetTouchInput(): void {
  touchInput.moveX = 0;
  touchInput.moveY = 0;
  touchInput.aimX = 0;
  touchInput.aimY = 0;
  touchInput.primaryHeld = false;
  touchInput.shootHeld = false;
  touchInput.dashHeld = false;
  touchInput.primaryQueued = false;
  touchInput.dashQueued = false;
  touchInput.scanQueued = false;
  touchInput.interactQueued = false;
  touchInput.echoQueued = false;
  touchInput.weaponNextQueued = false;
  touchInput.pauseQueued = false;
}
