/**
 * THE SCARECROW ANTENNA — Miller Field mini-boss.
 * A pole-and-wire idol the Interpretation Engine planted to listen.
 * Rotating scan beams + radial static bursts + drone summons.
 * Its red core is shielded until a scan pulse exposes it for a few seconds.
 */
import Phaser from 'phaser';
import { BOSS, EVT, PALETTE as P, TEX } from '../config';
import { audio } from '../systems/AudioSystem';
import { bus } from '../systems/EventBus';
import type { EffectsSystem } from '../systems/EffectsSystem';

export interface BossDeps {
  fx: EffectsSystem;
  fireRadialBolt: (x: number, y: number, vx: number, vy: number) => void;
  summonDrones: (count: number) => void;
  damagePlayer: (amount: number, fromX: number) => void;
  getPlayer: () => { x: number; y: number; alive: boolean };
  onDefeated: () => void;
}

type BossState = 'dormant' | 'rising' | 'fighting' | 'dying' | 'dead';

export class ScarecrowAntennaBoss {
  state: BossState = 'dormant';
  hp = BOSS.hp;
  exposed = false;

  core: Phaser.Physics.Arcade.Image;
  private scene: Phaser.Scene;
  private deps: BossDeps;
  private pole: Phaser.GameObjects.Image;
  private arms: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private coreGlow: Phaser.GameObjects.Image;
  private beams: Phaser.GameObjects.Image[] = [];
  private beamAngle = 0;
  private radialAt = 0;
  private radialTelegraphing = false;
  private exposedUntil = 0;
  private staggerUntil = 0;
  private summoned = new Set<number>();
  private readonly headX: number;
  private readonly headY: number;

  constructor(scene: Phaser.Scene, x: number, groundY: number, deps: BossDeps) {
    this.scene = scene;
    this.deps = deps;
    this.headX = x;
    this.headY = groundY - 62;

    this.pole = scene.add.image(x, groundY, TEX.bossPole).setOrigin(0.5, 1).setDepth(14);
    this.arms = scene.add.image(x, this.headY + 16, TEX.bossArms).setDepth(15);
    this.head = scene.add.image(x, this.headY, TEX.bossHead).setDepth(16);
    // the signal core sits low on the pole — a standing pulse shot from the
    // arena floor lands on it once a scan exposes it (first boss = accessible),
    // with a generous hitbox so the hit reads reliably.
    const coreY = groundY - 22;
    this.coreGlow = scene.add
      .image(x, coreY, TEX.glow8)
      .setScale(3)
      .setTint(P.danger)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(16);
    this.core = scene.physics.add.staticImage(x, coreY, TEX.bossCore).setDepth(17);
    (this.core.body as Phaser.Physics.Arcade.StaticBody).setCircle(9, -3, -3);
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.core.setAlpha(0);

    for (let i = 0; i < 2; i++) {
      this.beams.push(
        scene.add.image(x, this.headY + 8, TEX.bossBeam).setOrigin(0, 0.5).setDepth(13).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
      );
    }

    // buried until spawn
    const parts = [this.pole, this.arms, this.head];
    parts.forEach((p) => p.setAlpha(0));
  }

  get alive(): boolean {
    return this.state === 'fighting' || this.state === 'rising';
  }

  /** QA hook: true during the amber wind-up before a radial burst */
  get telegraphing(): boolean {
    return this.radialTelegraphing;
  }

  spawn(): void {
    if (this.state !== 'dormant') return;
    this.state = 'rising';
    audio.bossWarning();
    this.deps.fx.shake(0.007, 500);
    this.deps.fx.staticBurst(500);
    const rise = 70;
    const parts: Phaser.GameObjects.Image[] = [this.pole, this.arms, this.head, this.coreGlow];
    parts.forEach((p) => {
      p.setAlpha(p === this.coreGlow ? 0 : 1);
      p.y += rise;
    });
    this.scene.tweens.add({
      targets: parts,
      y: `-=${rise}`,
      duration: 1100,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.state = 'fighting';
        this.radialAt = this.scene.time.now + 1200;
        bus.emit(EVT.bossSpawn, { name: 'THE SCARECROW ANTENNA', hp: this.hp, max: BOSS.hp });
        this.beams.forEach((b) => b.setAlpha(0.85));
      },
    });
  }

  /** scan pulse hit the boss — expose the core */
  onScanned(): void {
    if (this.state !== 'fighting' || this.exposed) return;
    this.exposed = true;
    this.exposedUntil = this.scene.time.now + BOSS.coreExposeMs;
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = true;
    this.core.setAlpha(1);
    this.coreGlow.setAlpha(0.9).setTint(P.white);
    this.deps.fx.floatText(this.headX, this.headY - 18, 'CORE EXPOSED', P.signal);
    audio.bossStagger();
  }

  /** a player bolt reached the exposed core */
  hitCore(amount = 1): void {
    if (this.state !== 'fighting' || !this.exposed) return;
    this.hp -= amount;
    this.staggerUntil = this.scene.time.now + BOSS.staggerMs;
    this.head.setTintFill(0xffffff);
    this.core.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      this.head.clearTint();
      this.core.clearTint();
    });
    this.deps.fx.explode(this.headX, this.headY + 8, P.danger, 8);
    this.deps.fx.shake(0.005, 120);
    audio.enemyHit();
    bus.emit(EVT.bossHp, { hp: this.hp, max: BOSS.hp });

    // summon checkpoints
    for (const frac of BOSS.summonAtFracs) {
      const threshold = Math.round(BOSS.hp * frac);
      if (this.hp <= threshold && !this.summoned.has(threshold)) {
        this.summoned.add(threshold);
        this.deps.summonDrones(2);
        this.deps.fx.floatText(this.headX, this.headY - 26, 'SIGNAL SPIKE', P.warning);
      }
    }

    if (this.hp <= 0) this.die();
  }

  /** Test API: apply damage regardless of exposure */
  debugDamage(amount: number): void {
    if (this.state !== 'fighting') return;
    this.exposed = true;
    this.exposedUntil = this.scene.time.now + 500;
    for (let i = 0; i < amount && this.state === 'fighting'; i++) this.hitCore();
  }

  update(dtSec: number): void {
    if (this.state !== 'fighting') return;
    const now = this.scene.time.now;
    const player = this.deps.getPlayer();
    const staggered = now < this.staggerUntil;

    // exposure window
    if (this.exposed && now > this.exposedUntil) {
      this.exposed = false;
      (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.core.setAlpha(0);
      this.coreGlow.setTint(P.danger);
    }
    this.coreGlow.setAlpha(this.exposed ? 0.7 + Math.sin(now * 0.02) * 0.3 : 0.25 + Math.sin(now * 0.004) * 0.1);

    // rotating scan beams
    if (!staggered) this.beamAngle += Phaser.Math.DegToRad(BOSS.beamSpinDegPerSec) * dtSec;
    this.beams.forEach((beam, i) => {
      const a = this.beamAngle + i * Math.PI;
      beam.setRotation(a);
      beam.setAlpha(staggered ? 0.25 : 0.85);
      // segment vs player distance
      if (!staggered && player.alive) {
        const ex = this.headX + Math.cos(a) * BOSS.beamLength;
        const ey = this.headY + 8 + Math.sin(a) * BOSS.beamLength;
        const d = this.distToSegment(player.x, player.y, this.headX, this.headY + 8, ex, ey);
        if (d < BOSS.beamHalfWidth + 6) this.deps.damagePlayer(BOSS.touchDamage, this.headX);
      }
    });

    // radial static bursts — an amber converging wind-up warns before the volley
    if (!staggered) {
      const untilBurst = this.radialAt - now;
      if (untilBurst <= BOSS.radialTelegraphMs && !this.radialTelegraphing && this.state === 'fighting') {
        this.radialTelegraphing = true;
        this.showRadialTelegraph(Math.max(120, untilBurst));
      }
      if (now >= this.radialAt) {
        this.radialTelegraphing = false;
        this.radialAt = now + BOSS.radialPeriodMs;
        const offset = Math.random() * Math.PI * 2;
        for (let i = 0; i < BOSS.radialCount; i++) {
          const a = offset + (i / BOSS.radialCount) * Math.PI * 2;
          this.deps.fireRadialBolt(this.headX, this.headY + 8, Math.cos(a) * BOSS.radialSpeed, Math.sin(a) * BOSS.radialSpeed);
        }
        this.deps.fx.sparks(this.headX, this.headY + 8, P.danger, 10);
        audio.hazardZap();
      }
    }
  }

  /** Converging amber ring at the core: telegraphs the incoming radial volley so
   *  the burst is dodgeable, and reads distinctly from the red beams/core. */
  private showRadialTelegraph(ms: number): void {
    const ring = this.scene.add
      .image(this.headX, this.headY + 8, TEX.ring)
      .setTint(P.warning)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(15)
      .setAlpha(0)
      .setScale(2.8);
    this.scene.tweens.add({
      targets: ring,
      scale: 0.5,
      alpha: { from: 0.5, to: 0.85 },
      duration: ms,
      ease: 'Sine.easeIn',
      onComplete: () => ring.destroy(),
    });
    // a warning pip on the head so the tell reads even off-screen-edge of the ring
    this.deps.fx.floatText(this.headX, this.headY - 12, '!', P.warning);
    audio.bossWarning();
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Phaser.Math.Clamp(t, 0, 1);
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  private die(): void {
    this.state = 'dying';
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.beams.forEach((b) => b.setAlpha(0));
    audio.explode();
    this.deps.fx.staticBurst(700);
    this.deps.fx.shake(0.01, 600);
    // cascading pops up the pole
    for (let i = 0; i < 6; i++) {
      this.scene.time.delayedCall(i * 130, () => {
        this.deps.fx.explode(this.headX + Phaser.Math.Between(-14, 14), this.headY + 40 - i * 9, i % 2 ? P.danger : P.warning, 12);
        audio.enemyHit();
      });
    }
    this.scene.time.delayedCall(820, () => {
      this.deps.fx.explode(this.headX, this.headY + 8, P.white, 24);
      this.deps.fx.flash(P.white, 180);
      audio.explode();
      [this.pole, this.arms, this.head, this.coreGlow, this.core, ...this.beams].forEach((p) => p.destroy());
      this.state = 'dead';
      bus.emit(EVT.bossDead, {});
      this.deps.onDefeated();
    });
  }

  destroy(): void {
    [this.pole, this.arms, this.head, this.coreGlow, this.core, ...this.beams].forEach((p) => p?.destroy());
  }
}
