/**
 * CONTACT-47 — the player probe. Run / coyote jump / hover / phase-drift dash.
 * The same entity is used in Miller Field and inside the Blipstream.
 * All tuning in config.PLAYER.
 */
import Phaser from 'phaser';
import { EVT, FLY_SPEED, PALETTE as P, PLAYER, PROGRESSION, PULSE, SCAN, SIGNATURE, SKIN_TEX, TEX, WORKBENCH_EFFECTS } from '../config';
import { bus } from '../systems/EventBus';
import { audio } from '../systems/AudioSystem';
import { rumble } from '../systems/PadSim';
import { activeSkin, setActiveSkin } from '../systems/SkinState';
import { devState } from '../systems/DevState';
import { hasAbility, ownsUpgrade } from '../systems/SaveSystem';
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
  private airDashesUsed = 0;
  pulseCount = 0; // for SPARK surge cadence

  private fx: EffectsSystem;
  private coyoteUntil = 0;
  private jumpBufferUntil = 0;
  private jumpHeld = false;
  private dashUntil = 0;
  private dashCdUntil = 0;
  private dashCloakUntil = 0; // Ghost Protocol: unreadable window after a dash
  private phaseGraceUntil = 0; // Phase Drift+: bolt-phase window (dash + exit grace)
  private cloakTinted = false;
  private shootCdUntil = 0;
  private scanCdUntil = 0;
  private invulnUntil = 0;
  private hoverEmitAt = 0;
  private afterimageAt = 0;
  private traceAt = 0; // Route Tracer emit clock
  private traceX = 0;
  private traceY = 0;
  private trace: Phaser.GameObjects.Image[] = []; // capped ring buffer
  private scanEchoes: Phaser.GameObjects.Image[] = []; // Scan Memory markers
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
    // headroom for skin dashSpeedMul + Phase Drift+ (SIGNATURE.phaseDrift)
    body.setMaxVelocity(PLAYER.dashSpeed * SIGNATURE.phaseDrift.dashSpeedMul * 1.25 + 20, 470);
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
    // apply god live when toggled from the ◇ GOD button / dev panel (not just on spawn)
    const onGod = (p: unknown) => { this.godMode = (p as { on: boolean }).on; };
    bus.on(EVT.godMode, onGod);
    this.once('destroy', () => bus.off(EVT.godMode, onGod));

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

  /** Ghost Protocol: for a beat after a dash the Engine can't get a read on you
   *  — detection cones lose their lock (scenes gate `inCone` on this). */
  get ghostCloaked(): boolean {
    return hasAbility('ghost-protocol') && this.scene.time.now < this.dashCloakUntil;
  }

  /** Multiplier the scenes feed ClassificationSystem.update: Echo Blink decoy
   *  (0.5) and Ghost Protocol's passive detection-slow stack here. */
  get detectionMul(): number {
    let m = this.isEchoActive ? 0.5 : 1;
    if (hasAbility('ghost-protocol')) m *= SIGNATURE.ghost.detectSlowMul;
    return m;
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
    this.shootCdUntil = this.scene.time.now + PULSE.cooldownMs * (activeSkin().mods.pulseCooldownMul ?? 1) * this.wbPulseCooldownMul;
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

  /* --- Workbench (Channel B) purchased-upgrade mods — stack ON TOP of skin mods,
   *     gated by ownsUpgrade(id). Effect values live in config.WORKBENCH_EFFECTS. --- */
  private get wbHoverDrainMul(): number {
    return ownsUpgrade('hover-cell-plus') ? WORKBENCH_EFFECTS['hover-cell-plus'].hoverDrainMul : 1;
  }
  private get wbPulseCooldownMul(): number {
    return ownsUpgrade('pulse-rapid') ? WORKBENCH_EFFECTS['pulse-rapid'].pulseCooldownMul : 1;
  }
  private get wbDashCooldownMul(): number {
    return ownsUpgrade('dash-recharge') ? WORKBENCH_EFFECTS['dash-recharge'].dashCooldownMul : 1;
  }

  get maxHp(): number {
    const wbHp = ownsUpgrade('max-hull-plus') ? WORKBENCH_EFFECTS['max-hull-plus'].maxHpDelta : 0;
    return Math.max(1, PLAYER.maxHp + (this.sm.maxHpDelta ?? 0) + wbHp);
  }
  get effEnergyMax(): number {
    return PLAYER.energyMax * (this.sm.energyMaxMul ?? 1);
  }
  get scanRadius(): number {
    const wbScan = ownsUpgrade('wide-scan') ? WORKBENCH_EFFECTS['wide-scan'].scanRadiusMul : 1;
    return SCAN.radius * (this.sm.scanRadiusMul ?? 1) * wbScan;
  }
  get pulseDamage(): number {
    return Math.max(1, Math.round(PULSE.damage * (this.sm.pulseDamageMul ?? 1)));
  }

  /** Scan Memory: the scan-ring FX (and every reveal it triggers) lingers. */
  get scanRevealMs(): number {
    return SCAN.durationMs * (hasAbility('scan-memory') ? SIGNATURE.scanMemory.ringMul : 1);
  }

  /** Phase Drift+: a dash phases clean through enemy bolts (hard immunity, not
   *  just the base i-frames) and holds a short grace window on the way out. */
  get boltPhased(): boolean {
    return hasAbility('phase-drift-plus') && (this.isDashing || this.scene.time.now < this.phaseGraceUntil);
  }

  /**
   * Scan Memory (Patterson's Orchard secondary): leave a lingering echo marker
   * on everything the pulse touched, so revealed geometry/objects stay readable
   * long after the ring fades. No-op unless the ability is owned. Cheap: plain
   * tinted glow images on a capped ring buffer, tween-faded then destroyed.
   */
  scanMemoryEcho(targets: Array<{ x: number; y: number }>, tint: number = P.signal): void {
    if (!hasAbility('scan-memory') || targets.length === 0) return;
    const cfg = SIGNATURE.scanMemory;
    for (const t of targets) {
      const img = this.scene.add
        .image(t.x, t.y, TEX.glow8)
        .setTint(tint)
        .setDepth(11)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(cfg.echoAlpha)
        .setScale(0.9);
      this.scanEchoes.push(img);
      while (this.scanEchoes.length > cfg.maxEchoes) this.scanEchoes.shift()?.destroy();
      this.scene.tweens.add({
        targets: img,
        alpha: { from: cfg.echoAlpha, to: cfg.echoAlpha * 0.45 },
        duration: 800,
        yoyo: true,
        repeat: -1,
      });
      this.scene.time.delayedCall(cfg.echoMs, () => {
        const i = this.scanEchoes.indexOf(img);
        if (i >= 0) this.scanEchoes.splice(i, 1);
        img.destroy();
      });
    }
  }

  /** Route Tracer (Will / WILLOW set): draw the map behind you as you move. */
  private updateRouteTrace(now: number): void {
    if (!hasAbility('route-tracer')) return;
    const cfg = SIGNATURE.routeTracer;
    if (now < this.traceAt) return;
    if (Phaser.Math.Distance.Between(this.traceX, this.traceY, this.x, this.y) < cfg.minMovePx) return;
    this.traceAt = now + cfg.emitEveryMs;
    this.traceX = this.x;
    this.traceY = this.y;
    const dot = this.scene.add
      .image(this.x, this.y + 2, TEX.glow8)
      .setTint(P.scoutWill)
      .setDepth(this.depth - 2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(cfg.alpha)
      .setScale(cfg.scale);
    this.trace.push(dot);
    while (this.trace.length > cfg.maxSegments) this.trace.shift()?.destroy();
    this.scene.tweens.add({
      targets: dot,
      alpha: 0,
      scale: cfg.scale * 0.4,
      duration: cfg.segmentMs,
      ease: 'Quad.easeIn',
      onComplete: () => {
        const i = this.trace.indexOf(dot);
        if (i >= 0) this.trace.splice(i, 1);
        dot.destroy();
      },
    });
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

    if (grounded) this.airDashesUsed = 0;
    this.updateRouteTrace(now);

    /* --- Echo Blink: tap to place a decoy echo, tap again to snap back to it --- */
    if (input.echoJustDown) this.toggleEcho();
    if (this.echoActive && this.scene.time.now > this.echoExpireAt) this.clearEcho();

    /* --- dash (ROCKET: shorter cooldown + one extra mid-air dash) --- */
    const phasePlus = hasAbility('phase-drift-plus');
    // Phase Drift+ stacks an extra mid-air dash on top of ROCKET's
    const maxAirDashes = (activeSkin().abilities.airDash ? 1 : 0) + (phasePlus ? SIGNATURE.phaseDrift.extraAirDashes : 0);
    const canGroundDash = now >= this.dashCdUntil;
    const canAirDash = this.sm && maxAirDashes > 0 && this.airDashesUsed < maxAirDashes && !grounded;
    if (input.dashJustDown && !this.isDashing && (canGroundDash || canAirDash)) {
      if (!canGroundDash && canAirDash) this.airDashesUsed += 1;
      const dashMs = PLAYER.dashMs * (phasePlus ? SIGNATURE.phaseDrift.dashMsMul : 1);
      this.dashUntil = now + dashMs;
      // phase window: bolts pass straight through the dash (+ a short exit grace)
      if (phasePlus) this.phaseGraceUntil = this.dashUntil + SIGNATURE.phaseDrift.boltGraceMs;
      this.dashCdUntil = now + dashMs + PLAYER.dashCooldownMs * (this.sm.dashCooldownMul ?? 1) * this.wbDashCooldownMul;
      // Ghost Protocol: the dash slips the read — stay unreadable past the dash itself
      if (hasAbility('ghost-protocol')) this.dashCloakUntil = this.dashUntil + SIGNATURE.ghost.dashCloakMs;
      body.setAllowGravity(false);
      audio.dash();
      this.fx.sparks(this.x, this.y, this.trailTint(), 6);
    }
    if (this.isDashing) {
      const phaseSpeed = hasAbility('phase-drift-plus') ? SIGNATURE.phaseDrift.dashSpeedMul : 1;
      body.setVelocity(this.facing * PLAYER.dashSpeed * (this.sm.dashSpeedMul ?? 1) * phaseSpeed, 0);
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
        this.energy = Math.max(0, this.energy - PLAYER.hoverDrainPerSec * (this.sm.hoverDrainMul ?? 1) * this.wbHoverDrainMul * dtSec);
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
    const cloaked = this.ghostCloaked;
    if (!this.godMode && now < this.invulnUntil) {
      this.setAlpha(Math.sin(now * 0.04) > 0 ? 0.35 : 0.9);
    } else if (cloaked) {
      // Ghost Protocol: a cool desat shimmer sells "the Engine can't read you"
      this.setAlpha(0.5 + 0.22 * Math.sin(now * 0.03));
    } else {
      this.setAlpha(1);
    }
    if (cloaked && !this.flying) {
      this.setTint(P.shellRim);
      this.cloakTinted = true;
    } else if (this.cloakTinted && !this.flying) {
      this.clearTint();
      this.cloakTinted = false;
    }

    /* --- throttled HUD state --- */
    if (now >= this.hudAt) {
      this.hudAt = now + 110;
      bus.emit(EVT.hudEnergy, { energy: Math.round(this.energy), max: Math.round(this.effEnergyMax) });
      bus.emit(EVT.hudCooldowns, {
        dash: Phaser.Math.Clamp((this.dashCdUntil - now) / (PLAYER.dashCooldownMs * (this.sm.dashCooldownMul ?? 1) * this.wbDashCooldownMul + PLAYER.dashMs), 0, 1),
        scan: Phaser.Math.Clamp((this.scanCdUntil - now) / SCAN.cooldownMs, 0, 1),
      });
    }
  }

  /** returns true if damage was applied */
  damage(amount: number, fromX?: number): boolean {
    if (!this.alive || this.invulnerable || this.boltPhased) return false;
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
