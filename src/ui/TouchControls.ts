/**
 * On-screen touch controls for tablets — a crisp DOM overlay (like ShellUI)
 * layered over the pixel canvas. Buttons write the shared `touchInput` state,
 * which PlayerInput reads each frame (see src/game/systems/TouchInput.ts).
 *
 * Layout: a virtual thumbstick bottom-left, an action cluster bottom-right
 * (JUMP · SHOOT · SCAN · DASH · ECHO · INTERACT), and a small PAUSE pip top-right.
 * Visibility is driven by ShellUI (only during unobstructed gameplay).
 */
import { touchInput, resetTouchInput } from '../game/systems/TouchInput';
import { audio } from '../game/systems/AudioSystem';

export class TouchControls {
  private root: HTMLElement;
  private visible = false;
  private stickPointer: number | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'touch-controls';
    this.root.className = 'hidden';
    parent.appendChild(this.root);
    this.build();
  }

  get isVisible(): boolean {
    return this.visible;
  }

  setVisible(v: boolean): void {
    if (this.visible === v) return;
    this.visible = v;
    this.root.classList.toggle('hidden', !v);
    touchInput.active = v;
    if (!v) {
      // clear everything so nothing sticks when the overlay hides mid-press
      this.stickPointer = null;
      resetTouchInput();
      this.root.querySelectorAll('.tc-btn.active').forEach((el) => el.classList.remove('active'));
      this.root.querySelector<HTMLElement>('.tc-stick-knob')?.style.removeProperty('transform');
    }
  }

  private build(): void {
    // ── Virtual thumbstick (bottom-left) ────────────────────────────────
    const stick = document.createElement('div');
    stick.className = 'tc-stick';
    stick.setAttribute('role', 'application');
    stick.setAttribute('aria-label', 'Move');
    const knob = document.createElement('div');
    knob.className = 'tc-stick-knob';
    stick.appendChild(knob);
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.stickPointer = e.pointerId;
      stick.setPointerCapture?.(e.pointerId);
      this.updateStick(stick, knob, e);
      audio.unlock();
    });
    stick.addEventListener('pointermove', (e) => {
      if (this.stickPointer !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      this.updateStick(stick, knob, e);
    });
    const releaseStick = (e: PointerEvent) => {
      if (this.stickPointer !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      this.stickPointer = null;
      touchInput.moveX = 0;
      touchInput.moveY = 0;
      touchInput.aimX = 0;
      touchInput.aimY = 0;
      knob.style.removeProperty('transform');
    };
    stick.addEventListener('pointerup', releaseStick);
    stick.addEventListener('pointercancel', releaseStick);
    this.root.appendChild(stick);

    // ── action cluster (bottom-right) ────────────────────────────────────
    const actions = document.createElement('div');
    actions.className = 'tc-actions';
    // held buttons: level-triggered (hold JUMP to hover, hold SHOOT to autofire)
    actions.appendChild(this.heldButton('tc-btn tc-jump', 'JUMP', 'jumpHeld', true));
    actions.appendChild(this.aimFireButton('tc-btn tc-shoot', '◎'));
    // tap buttons: one-shot edges
    actions.appendChild(this.tapButton('tc-btn tc-scan', '((·))', 'scanQueued'));
    actions.appendChild(this.tapButton('tc-btn tc-dash', '»', 'dashQueued'));
    actions.appendChild(this.tapButton('tc-btn tc-echo', 'ECHO', 'echoQueued'));
    actions.appendChild(this.tapButton('tc-btn tc-interact', 'E', 'interactQueued'));
    this.root.appendChild(actions);

    // ── pause pip (top-right) ────────────────────────────────────────────
    const pause = this.tapButton('tc-btn tc-pause', '❚❚', 'pauseQueued');
    this.root.appendChild(pause);
  }

  private makeButton(className: string, glyph: string): HTMLElement {
    const b = document.createElement('div');
    b.className = className;
    b.setAttribute('role', 'button');
    b.textContent = glyph;
    return b;
  }

  private updateStick(stick: HTMLElement, knob: HTMLElement, e: PointerEvent): void {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const max = Math.max(24, Math.min(r.width, r.height) * 0.34);
    const rawX = e.clientX - cx;
    const rawY = e.clientY - cy;
    const len = Math.hypot(rawX, rawY);
    const scale = len > max ? max / len : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    knob.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;

    const nx = x / max;
    const ny = y / max;
    // Left stick is MOVEMENT ONLY. Aiming lives on the drag-aim SHOOT button so the
    // gun can be aimed independently of where you're moving/facing. (Top-down Sweep
    // auto-aims the nearest enemy, so it ignores aimX/aimY regardless.)
    touchInput.moveX = nx < -0.25 ? -1 : nx > 0.25 ? 1 : 0;
    touchInput.moveY = ny < -0.25 ? -1 : ny > 0.25 ? 1 : 0;
  }

  /** SHOOT doubles as an aim control: hold to fire, DRAG in any direction to aim
   *  the shot there (360°). A small tap = fire along the current facing. */
  private aimFireButton(className: string, glyph: string): HTMLElement {
    const b = this.makeButton(className, glyph);
    let pid: number | null = null;
    let cx = 0;
    let cy = 0;
    const DEAD = 16; // px drag before directional aim kicks in
    const setAim = (e: PointerEvent) => {
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len < DEAD) {
        touchInput.aimX = 0;
        touchInput.aimY = 0;
        return;
      }
      touchInput.aimX = dx / len;
      touchInput.aimY = dy / len;
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pid = e.pointerId;
      try {
        b.setPointerCapture?.(e.pointerId);
      } catch {
        /* capture can fail (e.g. stale pointer) — drag-aim still works via move events */
      }
      const r = b.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      touchInput.shootHeld = true;
      setAim(e);
      b.classList.add('active');
      audio.unlock();
    };
    const move = (e: PointerEvent) => {
      if (pid !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      setAim(e); // pointer is captured, so this keeps tracking outside the button
    };
    const up = (e: PointerEvent) => {
      if (pid !== null && pid !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      pid = null;
      touchInput.shootHeld = false;
      touchInput.aimX = 0;
      touchInput.aimY = 0;
      b.classList.remove('active');
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointermove', move);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    return b;
  }

  /** A hold-to-act button: sets a boolean held flag true on press, false on release. */
  private heldButton(className: string, glyph: string, flag: 'jumpHeld' | 'shootHeld', alsoQueueJump: boolean): HTMLElement {
    const b = this.makeButton(className, glyph);
    const down = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      touchInput[flag] = true;
      if (alsoQueueJump) touchInput.jumpQueued = true; // edge for jumpJustDown
      b.classList.add('active');
      audio.unlock();
    };
    const up = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      touchInput[flag] = false;
      b.classList.remove('active');
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
    return b;
  }

  /** A tap button: queues a one-shot edge consumed by PlayerInput.update(). */
  private tapButton(className: string, glyph: string, flag: 'scanQueued' | 'dashQueued' | 'echoQueued' | 'interactQueued' | 'pauseQueued'): HTMLElement {
    const b = this.makeButton(className, glyph);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      touchInput[flag] = true;
      b.classList.add('active');
      audio.unlock();
    });
    const clear = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      b.classList.remove('active');
    };
    b.addEventListener('pointerup', clear);
    b.addEventListener('pointercancel', clear);
    b.addEventListener('pointerleave', clear);
    return b;
  }
}
