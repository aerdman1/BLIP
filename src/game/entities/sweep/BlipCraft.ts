/**
 * BlipCraft — CONTACT-47 on the radar scope. Top-down, gravity-free, 8-directional
 * roam with a phase-drift dash. Twin-stick: you MOVE with one hand and AIM with the
 * mouse/right-stick (the scene drives aim + firing). Self-contained so The Sweep
 * can't perturb core platformer movement. Tuning in config.SWEEP.
 */
import Phaser from 'phaser';
import { EVT, FLY_SPEED, PALETTE as P, SWEEP, TEX } from '../../config';
import { audio } from '../../systems/AudioSystem';
import { bus } from '../../systems/EventBus';
import { activeSkin } from '../../systems/SkinState';
import { devState } from '../../systems/DevState';
import type { EffectsSystem } from '../../systems/EffectsSystem';
import type { PlayerInput } from '../../systems/InputSystem';

/** dev tools (god key) — dev server or ?test, matching Player.ts */
const DEV_TOOLS: boolean =
  import.meta.env.DEV ||
  (typeof location !== 'undefined' && new URLSearchParams(location.search).has('test'));

export class BlipCraft extends Phaser.Physics.Arcade.Sprite {
  hp: number = SWEEP.maxHp;
  aimAngle = 0; // radians — set by the scene from the mouse / right-stick
  private fx: EffectsSystem;
  private glow: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private barrel: Phaser.GameObjects.Rectangle;
  /** the gun sits this far BELOW body-center so it rides the lower torso and
   *  no longer covers CONTACT-47's face/visor when aiming upward (top-down). */
  private static readonly GUN_OFFSET_Y = 5;
  private invulnUntil = 0;
  private dashUntil = 0;
  private dashCdUntil = 0;
  private afterimageAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, fx: EffectsSystem) {
    // you ARE CONTACT-47 — dedicated top-down hero sprite
    super(scene, x, y, TEX.sweepBlipBody);
    this.fx = fx;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(11, 11);
    body.setOffset((this.width - 11) / 2, (this.height - 11) / 2);
    body.setDrag(SWEEP.drag, SWEEP.drag);
    body.setMaxVelocity(SWEEP.dashSpeed, SWEEP.dashSpeed);
    this.setDepth(20);
    this.shadow = scene.add.image(x, y + 10, TEX.sweepShadow).setDepth(6).setAlpha(0.9);
    this.glow = scene.add
      .image(x, y + 7, TEX.playerGlow)
      .setDepth(19)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(activeSkin().color) // the equipped skin's identity color
      .setAlpha(0.6)
      .setScale(1.4);
    // a stubby gun barrel that points where you're aiming
    this.barrel = scene.add.rectangle(x, y, 11, 4, activeSkin().color, 1).setOrigin(0, 0.5).setDepth(21);
    this.hp = this.maxHp; // ANCHOR +1 hull / ROCKET −1 hull etc. apply here

    // Fly mode (shared dev flag) — noclip through walls, driven by the dev panel
    // so it's reachable on touch/iPad. Apply on spawn + react to live toggles.
    if (devState.fly) this.setFly(true);
    const onFly = (p: unknown) => this.setFly((p as { on: boolean }).on);
    bus.on(EVT.flyMode, onFly);
    this.once('destroy', () => bus.off(EVT.flyMode, onFly));

    // G toggles god mode in the top-down too (shared devState with the side-view).
    // Live whenever dev tools are on OR god mode is already enabled via the console.
    if (DEV_TOOLS || devState.god) {
      scene.input.keyboard?.on('keydown-G', () => {
        devState.god = !devState.god;
        bus.emit(EVT.toast, { text: devState.god ? 'GOD MODE ON — invulnerable' : 'GOD MODE OFF', color: devState.god ? 'green' : 'orange' });
        bus.emit(EVT.godMode, { on: devState.god });
      });
    }
  }

  /** DEV noclip free-fly. Top-down is already gravity-free, so fly just lifts wall
   *  collision + moves at FLY_SPEED. Toggling off restores collision cleanly. */
  private flying = false;
  setFly(on: boolean): void {
    if (this.flying === on) return;
    this.flying = on;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAcceleration(0, 0);
    body.checkCollision.none = on; // noclip: pass through geometry
    this.setTint(on ? 0x8fdcff : 0xffffff);
    if (!on) this.clearTint();
  }

  get isDashing(): boolean {
    return this.scene.time.now < this.dashUntil;
  }
  get alive(): boolean {
    return this.hp > 0;
  }
  get invulnerable(): boolean {
    return devState.god || this.isDashing || this.scene.time.now < this.invulnUntil;
  }

  /* --- effective stats = SWEEP base × the active skin's mods (progression carries
     into the top-down mode, matching the side-view Player) --- */
  get maxHp(): number {
    return Math.max(1, SWEEP.maxHp + (activeSkin().mods.maxHpDelta ?? 0));
  }
  private get effMoveSpeed(): number {
    return SWEEP.moveSpeed * (activeSkin().mods.runSpeedMul ?? 1);
  }
  private get effDashSpeed(): number {
    return SWEEP.dashSpeed * (activeSkin().mods.dashSpeedMul ?? 1);
  }
  private get effDashCooldown(): number {
    return SWEEP.dashCooldownMs * (activeSkin().mods.dashCooldownMul ?? 1);
  }

  /** scene sets this each frame from the aim source (mouse world pos / right stick) */
  setAim(angle: number): void {
    this.aimAngle = angle;
  }

  /** call each frame from the scene */
  move(input: PlayerInput): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const now = this.scene.time.now;
    const ax = input.moveDir; // -1 / 0 / 1  (A / D / arrows / left-stick X / dpad)
    const ay = input.moveY; //  -1 up / 0 / 1 down (W/S / arrows / left-stick Y / dpad)
    const len = Math.hypot(ax, ay) || 1;

    // DEV free-fly: fly straight from the (touch) stick at FLY_SPEED, noclip.
    if (this.flying) {
      body.setAcceleration(0, 0);
      body.setVelocity((ax / len) * FLY_SPEED, (ay / len) * FLY_SPEED);
      this.setFlipX(Math.cos(this.aimAngle) < 0);
      this.shadow.setPosition(this.x, this.y + 10);
      this.glow.setPosition(this.x, this.y + 7);
      this.barrel.setPosition(this.x, this.y + BlipCraft.GUN_OFFSET_Y).setRotation(this.aimAngle);
      this.setAlpha(1);
      return;
    }

    // phase-drift dash — i-frames; toward movement, or toward aim if standing still
    if (input.dashJustDown && !this.isDashing && now >= this.dashCdUntil) {
      let dx = ax / len;
      let dy = ay / len;
      if (!ax && !ay) {
        dx = Math.cos(this.aimAngle);
        dy = Math.sin(this.aimAngle);
      }
      this.dashUntil = now + SWEEP.dashMs;
      this.dashCdUntil = now + SWEEP.dashMs + this.effDashCooldown;
      body.setVelocity(dx * this.effDashSpeed, dy * this.effDashSpeed);
      audio.dash();
      this.fx.sparks(this.x, this.y, P.signal, 6);
    }

    if (this.isDashing) {
      body.setAcceleration(0, 0);
      if (now >= this.afterimageAt) {
        this.afterimageAt = now + 40;
        this.fx.afterimage(this, P.signal);
      }
    } else {
      if (ax || ay) body.setAcceleration((ax / len) * SWEEP.accel, (ay / len) * SWEEP.accel);
      else body.setAcceleration(0, 0);
      const v = body.velocity;
      const sp = v.length();
      if (sp > this.effMoveSpeed) v.scale(this.effMoveSpeed / sp);
    }

    // face + point the barrel toward the aim
    this.setFlipX(Math.cos(this.aimAngle) < 0);
    this.shadow.setPosition(this.x, this.y + 10);
    this.glow.setPosition(this.x, this.y + 7);
    this.barrel.setPosition(this.x, this.y + BlipCraft.GUN_OFFSET_Y).setRotation(this.aimAngle);
    this.setAlpha(!this.invulnerable ? 1 : Math.sin(now * 0.04) > 0 ? 0.4 : 0.9);
  }

  /** muzzle position at the barrel tip (where bolts should spawn) */
  get muzzleX(): number {
    return this.x + Math.cos(this.aimAngle) * 10;
  }
  get muzzleY(): number {
    // spawn bolts from the lowered barrel line so visual + aim stay consistent
    return this.y + BlipCraft.GUN_OFFSET_Y + Math.sin(this.aimAngle) * 10;
  }

  /** returns true if a hit landed */
  damage(fromX: number, fromY: number): boolean {
    if (!this.alive || this.invulnerable) return false;
    this.hp = Math.max(0, this.hp - 1);
    this.invulnUntil = this.scene.time.now + SWEEP.invulnMs;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const ang = Math.atan2(this.y - fromY, this.x - fromX);
    body.setVelocity(Math.cos(ang) * SWEEP.knockback, Math.sin(ang) * SWEEP.knockback);
    audio.playerHit();
    this.fx.shake(0.008, 170);
    this.fx.explode(this.x, this.y, P.danger, 8);
    bus.emit(EVT.hudHp, { hp: this.hp, max: this.maxHp });
    return true;
  }

  heal(n: number): void {
    this.hp = Math.min(this.maxHp, this.hp + n);
    bus.emit(EVT.hudHp, { hp: this.hp, max: this.maxHp });
  }

  /** ANCHOR boon — temporary invulnerability shield */
  grantShield(ms: number): void {
    this.invulnUntil = Math.max(this.invulnUntil, this.scene.time.now + ms);
  }

  /** dash-chain flow — a Phase-Strike kill refunds the dash so you can chain */
  refreshDash(): void {
    this.dashCdUntil = this.scene.time.now;
  }

  setVisible(value: boolean): this {
    this.glow?.setVisible(value);
    this.barrel?.setVisible(value);
    this.shadow?.setVisible(value);
    return super.setVisible(value);
  }

  destroy(fromScene?: boolean): void {
    this.glow.destroy();
    this.barrel.destroy();
    this.shadow.destroy();
    super.destroy(fromScene);
  }
}
