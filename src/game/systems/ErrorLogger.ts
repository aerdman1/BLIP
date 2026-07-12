/**
 * ErrorLogger — an ALWAYS-ON global runtime error catcher. Install it as the
 * very first thing at boot so nothing slips through.
 *
 * What it does:
 *  • Traps uncaught errors (window 'error', incl. throws inside the Phaser rAF
 *    loop) and unhandled promise rejections.
 *  • Logs each to the console with a clear `[BLIP ERROR]` prefix + stack.
 *  • Keeps a ring buffer + persists it to localStorage so a freeze/crash leaves
 *    a breadcrumb you can read AFTER the fact (survives a reload).
 *  • Notifies the player in-game via a red toast (rate-limited) and emits
 *    EVT.error so any UI can react.
 *  • De-dupes a repeating error (e.g. a per-frame throw) into a single entry
 *    with a count — so one bad frame can't flood the log or the toast stack.
 *
 * Inspect at runtime:  __BLIP_ERRORS__()      → array of logged errors
 *                      __BLIP_ERRORS_CLEAR__() → wipe the buffer + storage
 */
import { bus } from './EventBus';
import { EVT } from '../config';

export interface LoggedError {
  time: string; // ISO timestamp
  type: 'error' | 'promise';
  message: string;
  stack?: string;
  source?: string; // file:line:col when available
  count: number; // consecutive repeats collapsed into one entry
}

const MAX_ENTRIES = 60;
const STORE_KEY = 'blip_error_log_v1';
const TOAST_COOLDOWN_MS = 2500;

const buffer: LoggedError[] = [];
let lastSignature = '';
let lastToastAt = 0;
let installed = false;

function persist(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(buffer.slice(-MAX_ENTRIES)));
  } catch {
    /* storage full / unavailable — the console + in-memory buffer still hold it */
  }
}

function record(type: LoggedError['type'], message: string, stack?: string, source?: string): void {
  const msg = message || 'unknown error';
  const signature = `${type}|${msg}|${(stack ?? '').split('\n')[1] ?? ''}`;
  const now = Date.now();
  const last = buffer[buffer.length - 1];

  // collapse a repeating error (a per-frame throw) into the last entry + a count
  if (last && signature === lastSignature) {
    last.count++;
    last.time = new Date().toISOString();
    persist();
    return;
  }
  lastSignature = signature;

  const entry: LoggedError = { time: new Date().toISOString(), type, message: msg, stack, source, count: 1 };
  buffer.push(entry);
  while (buffer.length > MAX_ENTRIES) buffer.shift();
  persist();

  // console — always, with a loud prefix so it's grep-able
  console.error(`[BLIP ERROR] ${type}: ${msg}${source ? `  (${source})` : ''}`, stack ? `\n${stack}` : '');

  // in-game notification — rate-limited so a burst never spams the toast stack
  try {
    bus.emit(EVT.error, entry);
    if (now - lastToastAt > TOAST_COOLDOWN_MS) {
      lastToastAt = now;
      bus.emit(EVT.toast, { text: `⚠ ERROR: ${msg.slice(0, 64)}`, color: 'red' });
    }
  } catch {
    /* bus/UI not ready yet — the console + buffer already captured it */
  }
}

/** Install the global handlers. Idempotent — safe to call once at boot. */
export function installErrorLogger(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (ev: ErrorEvent) => {
    // ignore bare resource-load errors (no Error object, no message)
    if (!ev.error && !ev.message) return;
    const err = ev.error as Error | undefined;
    const source = ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined;
    record('error', err?.message ?? ev.message, err?.stack, source);
  });

  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    const r = ev.reason;
    const message = r instanceof Error ? r.message : typeof r === 'string' ? r : JSON.stringify(r);
    record('promise', message, r instanceof Error ? r.stack : undefined);
  });

  // runtime inspectors
  const w = window as unknown as Record<string, unknown>;
  w.__BLIP_ERRORS__ = () => buffer.slice();
  w.__BLIP_ERRORS_CLEAR__ = () => {
    buffer.length = 0;
    lastSignature = '';
    persist();
    return 'cleared';
  };
}

// self-install the moment this module is first evaluated, so it's active before
// any other subsystem imports run (import order in main.ts puts this first).
installErrorLogger();

/** The in-memory error buffer (most recent last). */
export function getErrorLog(): LoggedError[] {
  return buffer.slice();
}

/** Errors persisted from a PREVIOUS session (survives reload/crash). */
export function getPersistedErrorLog(): LoggedError[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as LoggedError[]) : [];
  } catch {
    return [];
  }
}
