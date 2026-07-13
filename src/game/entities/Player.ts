/**
 * CONTACT-47 — the player probe. Run / coyote jump / hover / phase-drift dash.
 * The same entity is used in Miller Field and inside the Blipstream.
 * All tuning in config.PLAYER.
 */
import Phaser from 'phaser';
import { EVT, FLY_SPEED, PALETTE as P, PLAYER, PROGRESSION, PULSE, SCAN, SKIN_TEX, TEX } from '../config';
import { bus } from '../systems/EventBus';
import { audio } from '../systems/AudioSystem';
import { rumble } from '../systems/PadSim';
import { activeSkin, setActiveSkin } from '../systems/SkinState';
import { devState } from '../systems/DevState';
import { hasAbility } from '../systems/SaveSystem';
import { rewards } from '../systems/RewardSystem';
import type { EffectsSystem } from '../systems/EffectsSystem';
import type { PlayerInput } from '../systems/InputSystem';

/** dev tools (fly / god keys) are available on the dev server or with ?test */
const DEV_TOOLS: boolean =
  import.meta.env.DEV ||
  (typeof location !== 'undefined' && new URLSearchParams(location.search).has('test'));

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number = PLAYER.maxHp;
  energy: number = PLAYER.energyMax;
  facing: 1 | -1 = 1;
  private baseTex: string = TEX.player;
  private skinColor: number = P.signal;
  private airDashUsed = false;
  pulseCount = 0; // for SPARK surge cadence

  private fx: EffectsSystem;
  private coyoteUntil = 0;
  private jumpBufferUntil = 0;
  private jumpHeld = false;
  private dashUntil = 0;
  private dashCdUntil = 0;
  private shootCdUntil = 0;
  private scanCdUntil = 0;
  private invulnUntil = 0;
  private hoverEmitAt = 0;
  private afterimageAt = 0;
  private echoImg?: Phaser.GameObjects.Image;
  private echoX = 0;
  private echoY = 0;
  private echoActive = false;
  private echoExpireAt = 0;
  private echoCdUntil = 0;
  private hudAt = 0;
  private glow: Phaser.GameObjects.Image;
  hovering = false;
  godMode = devState.god; // ERD dev-panel toggle applies on spawn

  constructor(scene: Phaser.Scene, x: number, y: number, fx: EffectsSystem) {
    super(scene, x, y, TEX.player);
    this.fx = fx;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // sprite is 16×20 (hero pass); collision stays the same 10×12 capsule
    body.setSize(PLAYER.width, PLAYER.height);
    body.setOffset((16 - PLAYER.width) / 2, 20 - PLAYER.height - 1);
    body.setMaxVelocity(PLAYER.dashSpeed + 20, 470);
    this.setDepth(20);
    this.glow = scene.add.image(x, y + 10, TEX.playerGlow).setDepth(19).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    this.antennaTip = scene.add
      .image(x, y - 10, TEX.glow8)
      .setDepth(21)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xa8ff3e)
      .setScale(0.45)
      .setAlpha(0.7);
    scene.tweens.add({ targets: this.antennaTip, alpha: { from: 0.35, to: 0.85 }, duration: 900, yoyo: true, repeat: -1 });

    // Fly mode can be toggled from the ERD dev panel (works on touch/iPad — no
    // keyboard needed). Apply the current dev flag on spawn and react to changes.
    if (devState.fly) this.setFly(true);
    const onFly = (p: unknown) => this.setFly((p as { on: boolean }).on);
    bus.on(EVT.flyMode, onFly);
    this.once('destroy', () => bus.off(EVT.flyMode, onFly));

    // DEV keys: F = fly-through (dev/test only), G = god mode. G stays live once
    // god mode is enabled (via the ERD console) so players can toggle it in-play.
    if (DEV_TOOLS || devState.god) {
      const kb = scene.input.keyboard;
      if (DEV_TOOLS) {
        kb?.on('keydown-F', () => {
          const on = this.toggleFly();
          devState.fly = on; // keep the shared dev flag + panel in sync
          bus.emit(EVT.toast, { text: on ? 'FLY MODE — noclip · WASD + ↑↓ · F to land' : 'FLY MODE OFF', color: on ? 'green' : 'orange' });
        });
      }
      kb?.on('keydown-G', () => {
        this.godMode = !this.godMode;
        devState.god = this.godMode; // keep the shared dev flag in sync (HUD indicator + DEV chrome)
        bus.emit(EVT.toast, { text: this.godMode ? 'GOD MODE ON — invulnerable' : 'GOD MODE OFF', color: this.godMode ? 'green' : 'orange' });
        bus.emit(EVT.godMode, { on: this.godMode });
      });
    }
  }

  private antennaTip: Phaser.GameObjects.Image;
  private hurtFaceUntil = 0;

  get isDashing(): boolean {
    return this.scene.time.now < this.dashUntil;
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get invulnerable(): boolean {
    return this.godMode || this.flying || this.isDashing || this.scene.time.now < this.invulnUntil;
  }

  /** DEV: noclip free-fly — WASD/arrows + ↑↓ to zoom through the level */
  flying = false;

  toggleFly(): boolean {
    return this.setFly(!this.flying);
  }

  /** Enter/leave noclip free-fly. Toggling off cleanly restores gravity +
   *  collision so normal play is unaffected. Independent of god mode. */
  setFly(on: boolean): boolean {
    if (this.flying === on) return this.flying;
    this.flying = on;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(!this.flying);
    body.setVelocity(0, 0);
    body.setAcceleration(0, 0);
    body.checkCollision.none = this.flying; // noclip: pass through geometry
    this.setAlpha(1);
    this.setTint(this.flying ? 0x8fdcff : 0xffffff);
    if (!this.flying) this.clearTint();
    return this.flying;
  }

  private updateFly(input: PlayerInput): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = FLY_SPEED;
    const dir = input.moveDir;
    if (dir !== 0) this.facing = dir;
    // Vertical: JUMP button / ↑ / stick-up climbs; ↓ / stick-down descends. The
    // touch thumbstick (moveY) drives up+down so fly works with no keyboard.
    const up = input.jumpDown || input.moveY < 0;
    const down = input.flyDownHeld || input.moveY > 0;
    const vy = up && !down ? -speed : down && !up ? speed : 0;
    body.setVelocity(dir * speed, vy);
    this.setFlipX(this.facing < 0);
    this.setDisplayOrigin(8, 10);
    this.glow.setPosition(this.x, this.y + 10).setAlpha(0.85).setScale(1.2);
    this.antennaTip.setPosition(this.x + this.facing * 3, this.y - 10);
  }

  canShoot(): boolean {
    return this.scene.time.now >= this.shootCdUntil;
  }

  markShoot(): void {
    this.shootCdUntil = this.scene.time.now + PULSE.cooldownMs * (activeSkin().mods.pulseCooldownMul ?? 1);
    this.pulseCount++;
  }

  /** SPARK: is this shot the surge? (every 3rd, only with the ability) */
  get isSurgeShot(): boolean {
    return activeSkin().abilities.surgeShot === true && this.pulseCount % 3 === 0;
  }

  canScan(): boolean {
    return this.scene.time.now >= this.scanCdUntil;
  }

  markScan(): void {
    this.scanCdUntil = this.scene.time.now + SCAN.cooldownMs * (activeSkin().mods.scanCooldownMul ?? 1);
  }

  /* --- skin-modified effective stats (base config × active skin mods) --- */
  private get sm() {
    return activeSkin().mods;
  }
  get maxHp(): number {
    return Math.max(1, PLAYER.maxHp + (this.sm.maxHpDelta ?? 0));
  }
  get effEnergyMax(): number {
    return PLAYER.energyMax * (this.sm.energyMaxMul ?? 1);
  }
  get scanRadius(): number {
    return SCAN.radius * (this.sm.scanRadiusMul ?? 1);
  }
  get pulseDamage(): number {
    return Math.max(1, Math.round(PULSE.damage * (this.sm.pulseDamageMul ?? 1)));
  }

  /** damage a pulse deals to an exposed boss core — Pulse Resonance adds +1 */
  get coreDamage(): number {
    return this.pulseDamage + (hasAbility('pulse-resonance') ? PROGRESSION.pulseResonanceCoreBonus : 0);
  }

  /** Equip a skin: swap body texture, recolor glow/antenna, apply hp/energy caps. */
  setSkin(id: string): void {
    setActiveSkin(id);
    const skin = activeSkin();
    this.skinColor = skin.color;
    this.baseTex = SKIN_TEX[id] ?? TEX.player;
    if (this.texture.key !== TEX.playerHurt) this.setTexture(this.baseTex);
    this.glow.setTint(skin.color);
    this.antennaTip.setTint(skin.color);
    this.hp = Math.min(this.hp, this.maxHp);
    this.energy = Math.min(this.energy, this.effEnergyMax);
    this.refreshHud();
  }

  private trailTint(): number {
    return rewards.equippedTrailColor() ?? this.skinColor;
  }

  /** main movement update — call from scene.update */
  /* -------------------------------- Echo Blink ------------------------------- */
  get isEchoActive(): boolean {
    return this.echoActive;
  }
  get echoPos(): { x: number; y: number } {
    return { x: this.echoX, y: this.echoY };
  }
  /** tap: place an echo at your feet; tap again: snap back to it (the decoy blink) */
  toggleEcho(): void {
    if (!hasAbility('echo-blink') || !this.alive) return;
    if (this.echoActive) {
      this.blinkToEcho();
      return;
    }
    const now = this.scene.time.now;
    if (now < this.echoCdUntil || this.energy < PLAYER.echoCost) return;
    this.echoActive = true;
    this.echoX = this.x;
    this.echoY = this.y;
    this.echoExpireAt = now + PLAYER.echoLifeMs;
    this.energy = Math.max(0, this.energy - PLAYER.echoCost);
    this.echoImg = this.scene.add
      .image(this.x, this.y, this.baseTex)
      .setTint(P.violetGlitch)
      .setAlpha(0.55)
      .setFlipX(this.flipX)
      .setDepth(this.depth - 1);
    this.scene.tweens.add({ targets: this.echoImg, alpha: { from: 0.55, to: 0.28 }, duration: 480, yoyo: true, repeat: -1 });
    this.fx.flash(P.violetGlitch, 110);
    this.fx.sparks(this.x, this.y, P.violetGlitch, 8);
    audio.transitionWarp();
    bus.emit(EVT.hudEnergy, { energy: Math.round(this.energy), max: Math.round(this.effEnergyMax) });
  }
  private blinkToEcho(): void {
    this.fx.afterimage(this, P.violetGlitch);
    this.setPosition(this.echoX, this.echoY);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.fx.flash(P.violetGlitch, 140);
    this.fx.sparks(this.echoX, this.echoY, P.violetGlitch, 10);
    audio.transitionWarp();
    this.echoCdUntil = this.scene.time.now + PLAYER.echoCooldownMs;
    this.clearEcho();
  }
  /** drop the echo (blinked, expired, or the run ended) */
  clearEcho(): void {
    this.echoActive = false;
    this.echoImg?.destroy();
    this.echoImg = undefined;
  }

  updatePlayer(input: PlayerInput): void {
    if (!this.alive) return;
    if (this.flying) return this.updateFly(input);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const now = this.scene.time.now;
    const dtSec = this.scene.game.loop.delta / 1000;
    const grounded = body.blocked.down;
    const dir = input.moveDir;

    if (dir !== 0) this.facing = dir;

    if (grounded) this.airDashUsed = false;

    /* --- Echo Blink: tap to place a decoy echo, tap again to snap back to it --- */
    if (input.echoJustDown) this.toggleEcho();
    if (this.echoActive && this.scene.time.now > this.echoExpireAt) this.clearEcho();

    /* --- dash (ROCKET: shorter cooldown + one extra mid-air dash) --- */
    const canGroundDash = now >= this.dashCdUntil;
    const canAirDash = this.sm && activeSkin().abilities.airDash && !this.airDashUsed && !grounded;
    if (input.dashJustDown && !this.isDashing && (canGroundDash || canAirDash)) {
      if (!canGroundDash && canAirDash) this.airDashUsed = true;
      this.dashUntil = now + PLAYER.dashMs;
      this.dashCdUntil = now + PLAYER.dashMs + PLAYER.dashCooldownMs * (this.sm.dashCooldownMul ?? 1);
      body.setAllowGravity(false);
      audio.dash();
      this.fx.sparks(this.x, this.y, this.trailTint(), 6);
    }
    if (this.isDashing) {
      body.setVelocity(this.facing * PLAYER.dashSpeed * (this.sm.dashSpeedMul ?? 1), 0);
      body.setAcceleration(0, 0);
      if (now >= this.afterimageAt) {
        this.afterimageAt = now + 40;
        this.fx.afterimage(this, this.trailTint());
      }
    } else {
      body.setAllowGravity(true);

      /* --- horizontal --- */
      const accel = grounded ? PLAYER.accel : PLAYER.airAccel;
      if (dir !== 0) {
        body.setAccelerationX(dir * accel);
        body.setDragX(0);
      } else {
        body.setAccelerationX(0);
        body.setDragX(grounded ? PLAYER.drag : PLAYER.drag * 0.35);
      }
      const runMax = PLAYER.runSpeed * (this.sm.runSpeedMul ?? 1);
      if (Math.abs(body.velocity.x) > runMax && !this.isDashing) {
        body.setVelocityX(Phaser.Math.Clamp(body.velocity.x, -runMax, runMax));
      }

      /* --- jump: buffer + coyote + variable height --- */
      if (grounded) this.coyoteUntil = now + PLAYER.coyoteMs;
      if (input.jumpJustDown) this.jumpBufferUntil = now + PLAYER.jumpBufferMs;
      if (now < this.jumpBufferUntil && (grounded || now < this.coyoteUntil)) {
        body.setVelocityY(-PLAYER.jumpVel);
        this.jumpBufferUntil = 0;
        this.coyoteUntil = 0;
        this.jumpHeld = true;
        audio.jump();
        this.fx.sparks(this.x, this.y + 6, P.uiDim, 3);
      }
      if (!input.jumpDown && this.jumpHeld && body.velocity.y < 0) {
        body.setVelocityY(body.velocity.y * PLAYER.jumpCutMult);
        this.jumpHeld = false;
      }
      if (grounded) this.jumpHeld = false;

      /* --- hover: hold jump while falling --- */
      this.hovering = !grounded && input.jumpDown && body.velocity.y > 0 && this.energy > 0;
      if (this.hovering) {
        body.setVelocityY(Math.min(body.velocity.y, PLAYER.hoverFallSpeed));
        this.energy = Math.max(0, this.energy - PLAYER.hoverDrainPerSec * (this.sm.hoverDrainMul ?? 1) * dtSec);
        if (now >= this.hoverEmitAt) {
          this.hoverEmitAt = now + 70;
          this.fx.sparks(this.x + Phaser.Math.Between(-3, 3), this.y + 8, this.skinColor, 1);
          audio.hover();
        }
      }
    }

    /* --- energy regen --- */
    if (grounded && !this.hovering) {
      this.energy = Math.min(this.effEnergyMax, this.energy + PLAYER.energyRegenPerSec * (this.sm.energyRegenMul ?? 1) * dtSec);
    }

    /* --- visuals ---
     * No rotation and no scaling: at 480×270 both re-rasterize the sprite
     * every frame and shimmer badly ("glitchy" motion). All movement flair
     * comes from whole-pixel offsets, flips, afterimages and glow instead. */
    this.setFlipX(this.facing < 0);
    const running = grounded && Math.abs(body.velocity.x) > 30;
    const bob = running && Math.floor(now / 130) % 2 === 0 ? 1 : 0;
    this.setDisplayOrigin(8, 10 + bob); // crisp 1px run bob
    this.glow.setPosition(this.x, this.y + 10);
    this.glow.setAlpha(this.hovering || this.isDashing ? 0.9 : grounded ? 0.35 : 0.6);
    this.glow.setScale(this.hovering ? 1.25 : 1);
    this.antennaTip.setPosition(this.x + this.facing * 3, this.y - 10);
    // hurt face window, then invulnerability blink
    if (now < this.hurtFaceUntil) {
      if (this.texture.key !== TEX.playerHurt) this.setTexture(TEX.playerHurt);
    } else if (this.texture.key !== this.baseTex) {
      this.setTexture(this.baseTex);
    }
    if (!this.godMode && now < this.invulnUntil) {
      this.setAlpha(Math.sin(now * 0.04) > 0 ? 0.35 : 0.9);
    } else {
      this.setAlpha(1);
    }

    /* --- throttled HUD state --- */
    if (now >= this.hudAt) {
      this.hudAt = now + 110;
      bus.emit(EVT.hudEnergy, { energy: Math.round(this.energy), max: Math.round(this.effEnergyMax) });
      bus.emit(EVT.hudCooldowns, {
        dash: Phaser.Math.Clamp((this.dashCdUntil - now) / (PLAYER.dashCooldownMs * (this.sm.dashCooldownMul ?? 1) + PLAYER.dashMs), 0, 1),
        scan: Phaser.Math.Clamp((this.scanCdUntil - now) / SCAN.cooldownMs, 0, 1),
      });
    }
  }

  /** returns true if damage was applied */
  damage(amount: number, fromX?: number): boolean {
    if (!this.alive || this.invulnerable) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = this.scene.time.now + PLAYER.invulnMs;
    this.hurtFaceUntil = this.scene.time.now + 340; // ✕ ✕ face beat
    const body = this.body as Phaser.Physics.Arcade.Body;
    const away = fromX === undefined ? -this.facing : this.x < fromX ? -1 : 1;
    body.setVelocity(away * PLAYER.knockback, -PLAYER.knockback * 0.75);
    audio.playerHit();
    rumble(140, 0.6, 0.3);
    this.fx.shake(0.006, 160);
    this.fx.explode(this.x, this.y, P.danger, 8);
    bus.emit(EVT.hudHp, { hp: this.hp, max: this.maxHp });
    return true;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    bus.emit(EVT.hudHp, { hp: this.hp, max: this.maxHp });
  }

  setVisible(value: boolean): this {
    this.glow?.setVisible(value);
    this.antennaTip?.setVisible(value);
    return super.setVisible(value);
  }

  refreshHud(): void {
    bus.emit(EVT.hudHp, { hp: this.hp, max: this.maxHp });
    bus.emit(EVT.hudEnergy, { energy: Math.round(this.energy), max: Math.round(this.effEnergyMax) });
  }

  destroy(fromScene?: boolean): void {
    this.glow.destroy();
    this.antennaTip.destroy();
    super.destroy(fromScene);
  }
}
