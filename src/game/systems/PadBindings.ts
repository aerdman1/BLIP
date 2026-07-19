/**
 * Remappable gamepad bindings.
 *
 * Defaults are exactly the `PAD` constants, so out-of-the-box behaviour (and the
 * Playwright gamepad specs) are unchanged. Overrides are GLOBAL — stored in
 * localStorage under `blip_pad_bindings_v1`, not in the per-slot save.
 *
 * Each action keeps an optional `alt` button (the trigger/bumper fallbacks) so
 * shoot = X *or* RT, dash = RB *or* LB, scan = Y *or* LT keep working.
 */
import { PAD } from '../config';

export type PadAction = 'jump' | 'shoot' | 'dash' | 'scan' | 'interact' | 'echo' | 'pause' | 'commandCenter';

export interface PadBinding {
  /** primary standard-mapping button index */
  btn: number;
  /** optional secondary button index (trigger / bumper fallback) */
  alt?: number;
}

export const PAD_ACTIONS: { id: PadAction; label: string }[] = [
  { id: 'jump', label: 'Jump / Hover' },
  { id: 'shoot', label: 'Pulse Shot' },
  { id: 'dash', label: 'Dash' },
  { id: 'scan', label: 'Sonar (Scan Pulse)' },
  { id: 'interact', label: 'Interact / Enter Node' },
  { id: 'echo', label: 'Echo Blink' },
  { id: 'pause', label: 'Pause' },
  { id: 'commandCenter', label: 'Command Center' },
];

const DEFAULTS: Record<PadAction, PadBinding> = {
  jump: { btn: PAD.jump },
  shoot: { btn: PAD.shoot, alt: PAD.shootAlt },
  dash: { btn: PAD.dash, alt: PAD.dashAlt },
  scan: { btn: PAD.scan, alt: PAD.scanAlt },
  interact: { btn: PAD.interact },
  echo: { btn: PAD.dpadUp },
  pause: { btn: PAD.start },
  commandCenter: { btn: PAD.select },
};

export const PAD_BINDINGS_KEY = 'blip_pad_bindings_v1';

/** human label for a standard-mapping button index */
export function padButtonLabel(index: number): string {
  const names: Record<number, string> = {
    0: 'A · ✕',
    1: 'B · ○',
    2: 'X · ▢',
    3: 'Y · △',
    4: 'LB · L1',
    5: 'RB · R1',
    6: 'LT · L2',
    7: 'RT · R2',
    8: 'BACK · SHARE',
    9: 'START · OPTIONS',
    10: 'L-STICK',
    11: 'R-STICK',
    12: 'D-PAD ↑',
    13: 'D-PAD ↓',
    14: 'D-PAD ←',
    15: 'D-PAD →',
  };
  return names[index] ?? `BUTTON ${index}`;
}

const clone = (): Record<PadAction, PadBinding> => {
  const out = {} as Record<PadAction, PadBinding>;
  for (const a of PAD_ACTIONS) out[a.id] = { ...DEFAULTS[a.id] };
  return out;
};

let bindings: Record<PadAction, PadBinding> = clone();

function load(): void {
  try {
    const raw = localStorage.getItem(PAD_BINDINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<Record<PadAction, PadBinding>>;
    const next = clone();
    for (const a of PAD_ACTIONS) {
      const v = parsed[a.id];
      if (v && typeof v.btn === 'number' && v.btn >= 0 && v.btn < 32) {
        next[a.id] = { btn: v.btn, alt: typeof v.alt === 'number' ? v.alt : undefined };
      }
    }
    bindings = next;
  } catch {
    /* corrupt or unavailable storage — keep defaults */
  }
}
load();

function persist(): void {
  try {
    localStorage.setItem(PAD_BINDINGS_KEY, JSON.stringify(bindings));
  } catch {
    /* storage unavailable — session-only bindings */
  }
}

/** resolved binding for an action (never undefined) */
export function padBinding(action: PadAction): PadBinding {
  return bindings[action];
}

export function allPadBindings(): Record<PadAction, PadBinding> {
  return bindings;
}

export function isPadDefault(): boolean {
  return PAD_ACTIONS.every((a) => bindings[a.id].btn === DEFAULTS[a.id].btn && bindings[a.id].alt === DEFAULTS[a.id].alt);
}

/** which action (other than `except`) currently owns this button, if any */
export function padConflict(btn: number, except: PadAction): PadAction | null {
  for (const a of PAD_ACTIONS) {
    if (a.id === except) continue;
    if (bindings[a.id].btn === btn || bindings[a.id].alt === btn) return a.id;
  }
  return null;
}

export interface RebindResult {
  ok: boolean;
  swappedWith?: PadAction;
}

/**
 * Assign `btn` as the primary for `action`. If another action already owns it,
 * the two primaries are swapped — so no action is ever left unbound.
 */
export function setPadBinding(action: PadAction, btn: number): RebindResult {
  if (!Number.isInteger(btn) || btn < 0 || btn > 31) return { ok: false };
  if (bindings[action].btn === btn) return { ok: true };
  const other = padConflict(btn, action);
  if (other) {
    const mine = bindings[action].btn;
    if (bindings[other].btn === btn) bindings[other] = { ...bindings[other], btn: mine };
    else bindings[other] = { ...bindings[other], alt: mine };
  }
  bindings[action] = { ...bindings[action], btn };
  persist();
  return { ok: true, swappedWith: other ?? undefined };
}

export function resetPadBindings(): void {
  bindings = clone();
  try {
    localStorage.removeItem(PAD_BINDINGS_KEY);
  } catch {
    /* ignore */
  }
}
