/**
 * On-screen touch controls for tablets — a crisp DOM overlay (like ShellUI)
 * layered over the pixel canvas. Buttons write the shared `touchInput` state,
 * which PlayerInput reads each frame (see src/game/systems/TouchInput.ts).
 *
 * Layout: a 4-way D-pad bottom-left, an action cluster bottom-right
 * (JUMP · SHOOT · SCAN · DASH · INTERACT), and a small PAUSE pip top-right.
 * Visibility is driven by ShellUI (only during unobstructed gameplay).
 */
import { touchInput, resetTouchInput } from '../game/systems/TouchInput';
import { audio } from '../game/systems/AudioSystem';

export class TouchControls {
  private root: HTMLElement;
  private visible = false;
  private left = false;
  private right = false;
  private up = false;
  private down = false;
  private anyPointerDown = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'touch-controls';
    this.root.className = 'hidden';
    parent.appendChild(this.root);
    // a global "is any finger down" flag lets the D-pad support thumb-slides
    // (pointerenter while pressed activates the button the finger moves onto)
    window.addEventListener('pointerdown', () => (this.anyPointerDown = true));
    window.addEventListener('pointerup', () => (this.anyPointerDown = false));
    window.addEventListener('pointercancel', () => (this.anyPointerDown = false));
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
      this.left = this.right = this.up = this.down = false;
      resetTouchInput();
      this.root.querySelectorAll('.tc-btn.active').forEach((el) => el.classList.remove('active'));
    }
  }

  private syncMove(): void {
    touchInput.moveX = this.left && !this.right ? -1 : this.right && !this.left ? 1 : 0;
    touchInput.moveY = this.up && !this.down ? -1 : this.down && !this.up ? 1 : 0;
  }

  private build(): void {
    // ── D-pad (bottom-left) ──────────────────────────────────────────────
    const dpad = document.createElement('div');
    dpad.className = 'tc-dpad';
    const dirs: Array<{ cls: string; glyph: string; set: (on: boolean) => void }> = [
      { cls: 'tc-up', glyph: '▲', set: (on) => (this.up = on) },
      { cls: 'tc-left', glyph: '◀', set: (on) => (this.left = on) },
      { cls: 'tc-right', glyph: '▶', set: (on) => (this.right = on) },
      { cls: 'tc-down', glyph: '▼', set: (on) => (this.down = on) },
    ];
    for (const d of dirs) {
      const b = this.makeButton(`tc-btn tc-dir ${d.cls}`, d.glyph);
      const on = () => {
        d.set(true);
        b.classList.add('active');
        this.syncMove();
      };
      const off = () => {
        d.set(false);
        b.classList.remove('active');
        this.syncMove();
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        on();
      });
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
      // thumb-slide: entering a direction while a finger is already down engages it
      b.addEventListener('pointerenter', () => {
        if (this.anyPointerDown) on();
      });
      dpad.appendChild(b);
    }
    this.root.appendChild(dpad);

    // ── action cluster (bottom-right) ────────────────────────────────────
    const actions = document.createElement('div');
    actions.className = 'tc-actions';
    // held buttons: level-triggered (hold JUMP to hover, hold SHOOT to autofire)
    actions.appendChild(this.heldButton('tc-btn tc-jump', 'JUMP', 'jumpHeld', true));
    actions.appendChild(this.heldButton('tc-btn tc-shoot', '◎', 'shootHeld', false));
    // tap buttons: one-shot edges
    actions.appendChild(this.tapButton('tc-btn tc-scan', '((·))', 'scanQueued'));
    actions.appendChild(this.tapButton('tc-btn tc-dash', '»', 'dashQueued'));
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

  /** A hold-to-act button: sets a boolean held flag true on press, false on release. */
  private heldButton(className: string, glyph: string, flag: 'jumpHeld' | 'shootHeld', alsoQueueJump: boolean): HTMLElement {
    const b = this.makeButton(className, glyph);
    const down = (e: Event) => {
      e.preventDefault();
      touchInput[flag] = true;
      if (alsoQueueJump) touchInput.jumpQueued = true; // edge for jumpJustDown
      b.classList.add('active');
      audio.unlock();
    };
    const up = () => {
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
  private tapButton(className: string, glyph: string, flag: 'scanQueued' | 'dashQueued' | 'interactQueued' | 'pauseQueued'): HTMLElement {
    const b = this.makeButton(className, glyph);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      touchInput[flag] = true;
      b.classList.add('active');
      audio.unlock();
    });
    const clear = () => b.classList.remove('active');
    b.addEventListener('pointerup', clear);
    b.addEventListener('pointercancel', clear);
    b.addEventListener('pointerleave', clear);
    return b;
  }
}
