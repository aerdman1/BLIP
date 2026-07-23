/**
 * Unified poll-based input: keyboard + gamepad + on-screen touch (Xbox /
 * PlayStation standard mapping), shared by every gameplay scene.
 *
 * Keyboard: WASD + arrows · hold SHIFT boost · X/left-click pulse ·
 *           RIGHT-CLICK/Q sonar · E interact · 1/2/3 or R weapon · ESC pause
 * Gamepad:  stick/dpad move · A confirm/primary · X/RT pulse · B interact · Y/LT scan ·
 *           hold RB/LB boost · stick-click weapon swap · START pause · BACK command center
 * Touch:    on-screen D-pad + FIRE/SHOOT/SCAN/BOOST/INTERACT buttons feed the
 *           shared `touchInput` state (src/ui/TouchControls.ts writes it).
 *
 * Call update() ONCE at the top of scene.update() — it snapshots the pad and
 * computes just-pressed edges (pad + touch) for the frame.
 */
import Phaser from 'phaser';
import { EVT, PAD } from '../config';
import { bus } from './EventBus';
import { padBinding, type PadAction } from './PadBindings';
import { readPad, type PadSnapshot } from './PadSim';
import { touchInput } from './TouchInput';
import { virtualInput } from './VirtualInput';

type Key = Phaser.Input.Keyboard.Key;

let announcedPadId: string | null = null;

export class PlayerInput {
  private scene: Phaser.Scene;
  private k: Record<string, Key>;
  private pad: PadSnapshot | null = null;
  private prevPad: PadSnapshot | null = null;
  private rightScanQueued = false;
  private weaponSlotQueued: 0 | 1 | 2 | null = null;
  private weaponNextQueued = false;
  private rightJust = false;
  // one-shot touch edges, consumed each frame in update() (mirrors rightJust)
  private tDashJust = false;
  private tScanJust = false;
  private tInteractJust = false;
  private tEchoJust = false;
  private tWeaponNextJust = false;
  private tPauseJust = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('keyboard plugin unavailable');
    // right-click fires the sonar — swallow the browser context menu, and queue
    // the press on the pointerdown edge so fast taps register between frames.
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) this.rightScanQueued = true;
    });
    this.k = kb.addKeys(
      {
        left: 'A', right: 'D', aleft: 'LEFT', aright: 'RIGHT', up: 'SPACE', upW: 'W', upArrow: 'UP',
        down: 'S', adown: 'DOWN', dash: 'SHIFT', shoot: 'X', scan: 'Q', interact: 'E', echo: 'F',
        weapon1: 'ONE', weapon2: 'TWO', weapon3: 'THREE', weaponNext: 'R',
      },
      true,
      true
    ) as Record<string, Key>;
    kb.on('keydown-ONE', () => { this.weaponSlotQueued = 0; });
    kb.on('keydown-TWO', () => { this.weaponSlotQueued = 1; });
    kb.on('keydown-THREE', () => { this.weaponSlotQueued = 2; });
    kb.on('keydown-R', () => { this.weaponNextQueued = true; });
  }

  /** snapshot the gamepad + mouse buttons once per frame (before reading getters) */
  update(): void {
    this.prevPad = this.pad;
    this.pad = readPad();
    // consume any right-click queued since the last frame (sonar)
    this.rightJust = this.rightScanQueued;
    this.rightScanQueued = false;
    // consume queued on-screen touch edges (set by the DOM controls overlay)
    this.tDashJust = touchInput.dashQueued;
    this.tScanJust = touchInput.scanQueued;
    this.tInteractJust = touchInput.interactQueued;
    this.tEchoJust = touchInput.echoQueued;
    this.tWeaponNextJust = touchInput.weaponNextQueued;
    this.tPauseJust = touchInput.pauseQueued;
    touchInput.primaryQueued = false;
    touchInput.dashQueued = false;
    touchInput.scanQueued = false;
    touchInput.interactQueued = false;
    touchInput.echoQueued = false;
    touchInput.weaponNextQueued = false;
    touchInput.pauseQueued = false;
    // announce newly-seen controllers (HUD toast + settings panel)
    const id = this.pad?.id ?? null;
    if (id && id !== announcedPadId) {
      announcedPadId = id;
      bus.emit(EVT.padStatus, { connected: true, id });
      bus.emit(EVT.toast, { text: 'CONTROLLER LINKED', color: 'green' });
    }
  }

  private padDown(index: number): boolean {
    return this.pad?.buttons[index] === true;
  }

  private padJust(index: number): boolean {
    return this.pad?.buttons[index] === true && this.prevPad?.buttons[index] !== true;
  }

  /** held — resolved through the remappable binding (primary or alt) */
  private actDown(action: PadAction): boolean {
    const b = padBinding(action);
    return this.padDown(b.btn) || (b.alt !== undefined && this.padDown(b.alt));
  }

  /** just-pressed — resolved through the remappable binding (primary or alt) */
  private actJust(action: PadAction): boolean {
    const b = padBinding(action);
    return this.padJust(b.btn) || (b.alt !== undefined && this.padJust(b.alt));
  }

  private get padAxisX(): number {
    const x = this.pad?.axes[0] ?? 0;
    return Math.abs(x) > PAD.deadZone ? x : 0;
  }

  private get padAxisY(): number {
    const y = this.pad?.axes[1] ?? 0;
    return Math.abs(y) > PAD.deadZone ? y : 0;
  }

  private get padAimX(): number {
    const x = this.pad?.axes[2] ?? 0;
    return Math.abs(x) > PAD.deadZone ? x : 0;
  }

  private get padAimY(): number {
    const y = this.pad?.axes[3] ?? 0;
    return Math.abs(y) > PAD.deadZone ? y : 0;
  }

  get moveDir(): -1 | 0 | 1 {
    const l = this.k.left.isDown || this.k.aleft.isDown || this.padDown(PAD.dpadLeft) || this.padAxisX < 0 || touchInput.moveX < 0 || (virtualInput.active && virtualInput.moveX < 0);
    const r = this.k.right.isDown || this.k.aright.isDown || this.padDown(PAD.dpadRight) || this.padAxisX > 0 || touchInput.moveX > 0 || (virtualInput.active && virtualInput.moveX > 0);
    if (l && !r) return -1;
    if (r && !l) return 1;
    return 0;
  }

  /** Vertical move for top-down control: -1 up / 0 / 1 down. */
  get moveY(): -1 | 0 | 1 {
    const up = this.k.up.isDown || this.k.upW.isDown || this.k.upArrow.isDown || this.padDown(PAD.dpadUp) || this.padAxisY < 0 || touchInput.moveY < 0 || (virtualInput.active && virtualInput.moveY < 0);
    const down = this.k.down.isDown || this.k.adown.isDown || this.padDown(PAD.dpadDown) || this.padAxisY > 0 || touchInput.moveY > 0 || (virtualInput.active && virtualInput.moveY > 0);
    if (up && !down) return -1;
    if (down && !up) return 1;
    return 0;
  }

  /** DEV fly-mode: descend (S / ↓ / left-stick down) */
  get flyDownHeld(): boolean {
    return this.k.down.isDown || this.k.adown.isDown || (this.pad?.axes[1] ?? 0) > PAD.deadZone;
  }

  get dashJustDown(): boolean {
    const queued = virtualInput.dashQueued;
    virtualInput.dashQueued = false;
    return Phaser.Input.Keyboard.JustDown(this.k.dash) || this.actJust('dash') || this.tDashJust || queued;
  }

  get dashDown(): boolean {
    return this.k.dash.isDown || this.actDown('dash') || touchInput.dashHeld || (virtualInput.active && virtualInput.dashHeld);
  }

  /** held — shots auto-fire on the pulse cooldown */
  get shootDown(): boolean {
    const p = this.scene.input.activePointer;
    const pointerShoot = !touchInput.active && p.isDown && p.leftButtonDown();
    return (
      this.k.shoot.isDown ||
      pointerShoot ||
      this.actDown('shoot') ||
      touchInput.shootHeld ||
      (virtualInput.active && virtualInput.fire)
    );
  }

  shotVector(originX: number, originY: number, fallbackFacing: 1 | -1): { x: number; y: number } {
    if (touchInput.active && touchInput.shootHeld) {
      const len = Math.hypot(touchInput.aimX, touchInput.aimY);
      if (len > 0.2) return { x: touchInput.aimX / len, y: touchInput.aimY / len };
    }

    const padLen = Math.hypot(this.padAimX, this.padAimY);
    if (padLen > 0.2) return { x: this.padAimX / padLen, y: this.padAimY / padLen };

    const p = this.scene.input.activePointer;
    if (!touchInput.active && p.isDown && p.leftButtonDown()) {
      const wx = p.worldX || p.x;
      const wy = p.worldY || p.y;
      const dx = wx - originX;
      const dy = wy - originY;
      const len = Math.hypot(dx, dy);
      if (len > 8) return { x: dx / len, y: dy / len };
    }

    return { x: fallbackFacing, y: 0 };
  }

  get scanJustDown(): boolean {
    const queued = virtualInput.scanQueued;
    virtualInput.scanQueued = false;
    return this.rightJust || Phaser.Input.Keyboard.JustDown(this.k.scan) || this.actJust('scan') || this.tScanJust || queued;
  }

  get interactJustDown(): boolean {
    const queued = virtualInput.interactQueued;
    virtualInput.interactQueued = false;
    return Phaser.Input.Keyboard.JustDown(this.k.interact) || this.actJust('interact') || this.tInteractJust || queued;
  }

  get echoJustDown(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.k.echo) || this.actJust('echo') || this.tEchoJust;
  }

  get weaponNextJustDown(): boolean {
    const queued = this.weaponNextQueued;
    this.weaponNextQueued = false;
    const virtualQueued = virtualInput.weaponNextQueued;
    virtualInput.weaponNextQueued = false;
    return queued || virtualQueued || Phaser.Input.Keyboard.JustDown(this.k.weaponNext) || this.actJust('weaponNext') || this.tWeaponNextJust;
  }

  get weaponPrevJustDown(): boolean {
    return this.actJust('weaponPrev');
  }

  get weaponSlotJustDown(): 0 | 1 | 2 | null {
    if (this.weaponSlotQueued !== null) {
      const slot = this.weaponSlotQueued;
      this.weaponSlotQueued = null;
      return slot;
    }
    if (virtualInput.weaponSlotQueued !== null) {
      const slot = virtualInput.weaponSlotQueued;
      virtualInput.weaponSlotQueued = null;
      return slot;
    }
    if (Phaser.Input.Keyboard.JustDown(this.k.weapon1)) return 0;
    if (Phaser.Input.Keyboard.JustDown(this.k.weapon2)) return 1;
    if (Phaser.Input.Keyboard.JustDown(this.k.weapon3)) return 2;
    return null;
  }

  /** START — pause toggle (poll before any early-return in scene.update) */
  get pauseJustDown(): boolean {
    return this.actJust('pause') || this.tPauseJust;
  }

  /** BACK/SELECT — command center toggle */
  get commandCenterJustDown(): boolean {
    return this.actJust('commandCenter');
  }
}
