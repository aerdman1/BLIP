/**
 * Unified poll-based input: keyboard + gamepad + on-screen touch (Xbox /
 * PlayStation standard mapping), shared by every gameplay scene.
 *
 * Keyboard: A/D + arrows · SPACE/W/↑ jump-hover · SHIFT dash · X/left-click pulse ·
 *           RIGHT-CLICK/Q sonar · E interact · ESC pause (scene-level key event)
 * Gamepad:  stick/dpad move · A jump-hover · X/RT pulse · B interact · Y/LT scan ·
 *           RB/LB dash · START pause · BACK command center
 * Touch:    on-screen D-pad + JUMP/SHOOT/SCAN/DASH/INTERACT buttons feed the
 *           shared `touchInput` state (src/ui/TouchControls.ts writes it).
 *
 * Call update() ONCE at the top of scene.update() — it snapshots the pad and
 * computes just-pressed edges (pad + touch) for the frame.
 */
import Phaser from 'phaser';
import { EVT, PAD } from '../config';
import { bus } from './EventBus';
import { readPad, type PadSnapshot } from './PadSim';
import { touchInput } from './TouchInput';

type Key = Phaser.Input.Keyboard.Key;

let announcedPadId: string | null = null;

export class PlayerInput {
  private scene: Phaser.Scene;
  private k: Record<string, Key>;
  private pad: PadSnapshot | null = null;
  private prevPad: PadSnapshot | null = null;
  private rightScanQueued = false;
  private rightJust = false;
  // one-shot touch edges, consumed each frame in update() (mirrors rightJust)
  private tJumpJust = false;
  private tDashJust = false;
  private tScanJust = false;
  private tInteractJust = false;
  private tEchoJust = false;
  private tPauseJust = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('keyboard plugin unavailable');
    // right-click fires the sonar — swallow the browser context menu, and queue
    // the press on the pointerdown edge so even a fast mid-jump click registers.
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) this.rightScanQueued = true;
    });
    this.k = kb.addKeys(
      { left: 'A', right: 'D', aleft: 'LEFT', aright: 'RIGHT', jump: 'SPACE', jumpW: 'W', jumpUp: 'UP', down: 'S', adown: 'DOWN', dash: 'SHIFT', shoot: 'X', scan: 'Q', interact: 'E', echo: 'F' },
      true,
      true
    ) as Record<string, Key>;
  }

  /** snapshot the gamepad + mouse buttons once per frame (before reading getters) */
  update(): void {
    this.prevPad = this.pad;
    this.pad = readPad();
    // consume any right-click queued since the last frame (sonar)
    this.rightJust = this.rightScanQueued;
    this.rightScanQueued = false;
    // consume queued on-screen touch edges (set by the DOM controls overlay)
    this.tJumpJust = touchInput.jumpQueued;
    this.tDashJust = touchInput.dashQueued;
    this.tScanJust = touchInput.scanQueued;
    this.tInteractJust = touchInput.interactQueued;
    this.tEchoJust = touchInput.echoQueued;
    this.tPauseJust = touchInput.pauseQueued;
    touchInput.jumpQueued = false;
    touchInput.dashQueued = false;
    touchInput.scanQueued = false;
    touchInput.interactQueued = false;
    touchInput.echoQueued = false;
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

  private get padAxisX(): number {
    const x = this.pad?.axes[0] ?? 0;
    return Math.abs(x) > PAD.deadZone ? x : 0;
  }

  private get padAxisY(): number {
    const y = this.pad?.axes[1] ?? 0;
    return Math.abs(y) > PAD.deadZone ? y : 0;
  }

  get moveDir(): -1 | 0 | 1 {
    const l = this.k.left.isDown || this.k.aleft.isDown || this.padDown(PAD.dpadLeft) || this.padAxisX < 0 || touchInput.moveX < 0;
    const r = this.k.right.isDown || this.k.aright.isDown || this.padDown(PAD.dpadRight) || this.padAxisX > 0 || touchInput.moveX > 0;
    if (l && !r) return -1;
    if (r && !l) return 1;
    return 0;
  }

  /** Vertical move for TOP-DOWN twin-stick: -1 up / 0 / 1 down. W/S/↑/↓ + D-pad +
   *  LEFT-STICK Y. (Side-view movement ignores this and uses jump/hover instead.) */
  get moveY(): -1 | 0 | 1 {
    const up = this.k.jump.isDown || this.k.jumpW.isDown || this.k.jumpUp.isDown || this.padDown(PAD.dpadUp) || this.padAxisY < 0 || touchInput.moveY < 0;
    const down = this.k.down.isDown || this.k.adown.isDown || this.padDown(PAD.dpadDown) || this.padAxisY > 0 || touchInput.moveY > 0;
    if (up && !down) return -1;
    if (down && !up) return 1;
    return 0;
  }

  get jumpDown(): boolean {
    return this.k.jump.isDown || this.k.jumpW.isDown || this.k.jumpUp.isDown || this.padDown(PAD.jump) || touchInput.jumpHeld;
  }

  /** DEV fly-mode: descend (S / ↓ / left-stick down) */
  get flyDownHeld(): boolean {
    return this.k.down.isDown || this.k.adown.isDown || (this.pad?.axes[1] ?? 0) > PAD.deadZone;
  }

  get jumpJustDown(): boolean {
    return (
      Phaser.Input.Keyboard.JustDown(this.k.jump) ||
      Phaser.Input.Keyboard.JustDown(this.k.jumpW) ||
      Phaser.Input.Keyboard.JustDown(this.k.jumpUp) ||
      this.padJust(PAD.jump) ||
      this.tJumpJust
    );
  }

  get dashJustDown(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.k.dash) || this.padJust(PAD.dash) || this.padJust(PAD.dashAlt) || this.tDashJust;
  }

  /** held — shots auto-fire on the pulse cooldown */
  get shootDown(): boolean {
    const p = this.scene.input.activePointer;
    const pointerShoot = !touchInput.active && p.isDown && p.leftButtonDown();
    return (
      this.k.shoot.isDown ||
      pointerShoot ||
      this.padDown(PAD.shoot) ||
      this.padDown(PAD.shootAlt) ||
      touchInput.shootHeld
    );
  }

  get scanJustDown(): boolean {
    return this.rightJust || Phaser.Input.Keyboard.JustDown(this.k.scan) || this.padJust(PAD.scan) || this.padJust(PAD.scanAlt) || this.tScanJust;
  }

  get interactJustDown(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.k.interact) || this.padJust(PAD.interact) || this.tInteractJust;
  }

  get echoJustDown(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.k.echo) || this.padJust(PAD.dpadUp) || this.tEchoJust;
  }

  /** START — pause toggle (poll before any early-return in scene.update) */
  get pauseJustDown(): boolean {
    return this.padJust(PAD.start) || this.tPauseJust;
  }

  /** BACK/SELECT — command center toggle */
  get commandCenterJustDown(): boolean {
    return this.padJust(PAD.select);
  }
}
