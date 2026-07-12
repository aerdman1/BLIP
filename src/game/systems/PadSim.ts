/**
 * Gamepad simulation hook for the AI QA pipeline.
 * Playwright cannot emulate HID gamepads, so tests inject a snapshot here via
 * the Test API; PlayerInput and the shell menu poller consume it exactly like
 * a real pad. Unused (null) outside tests.
 */

export interface PadSnapshot {
  connected: boolean;
  /** axes[0] = left stick X, axes[1] = left stick Y */
  axes: number[];
  /** standard-mapping button index → pressed */
  buttons: Record<number, boolean>;
  id?: string;
}

let simState: PadSnapshot | null = null;

export function setSimulatedPad(state: PadSnapshot | null): void {
  simState = state;
}

export function getSimulatedPad(): PadSnapshot | null {
  return simState;
}

/** read the live pad state: simulation first, then the real Gamepad API */
export function readPad(): PadSnapshot | null {
  if (simState) return simState;
  try {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (pad && pad.connected) {
        const buttons: Record<number, boolean> = {};
        pad.buttons.forEach((b, i) => {
          buttons[i] = b.pressed || b.value > 0.5;
        });
        return { connected: true, axes: [...pad.axes], buttons, id: pad.id };
      }
    }
  } catch {
    /* API unavailable */
  }
  return null;
}

/** best-effort rumble — never throws, never required */
export function rumble(durationMs: number, strong = 0.6, weak = 0.4): void {
  if (simState) return;
  try {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      const actuator = (pad as unknown as { vibrationActuator?: { playEffect?: (t: string, o: object) => void } })
        ?.vibrationActuator;
      actuator?.playEffect?.('dual-rumble', {
        duration: durationMs,
        strongMagnitude: strong,
        weakMagnitude: weak,
      });
    }
  } catch {
    /* no rumble support */
  }
}
