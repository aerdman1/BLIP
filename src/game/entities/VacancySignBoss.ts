/**
 * THE VACANCY SIGN — Motel Nowhere boss.
 * A possessed roadside sign the Interpretation Engine kept lit forever. It
 * attacks by dropping falling neon LETTERS and sweeping a buzzing light-BAR.
 * Its filament core is shielded — a scan pulse exposes it, and it also
 * short-circuits into a self-exposing STUTTER every few seconds (a free opening).
 */
import Phaser from 'phaser';
import { BOSS2, EVT, PALETTE as P, TEX } from '../config';
import { audio } from '../systems/AudioSystem';
import { bus } from '../systems/EventBus';
import type { EffectsSystem } from '../systems/EffectsSystem';

export interface VacancyBossDeps {
  fx: EffectsSystem;
  fireLetter: (x: number, y: number, vx: number, vy: number) => void;
  damagePlayer: (amount: number, fromX: number) => void;
  getPlayer: () => { x: number; y: number; alive: boolean };
  onDefeated: () => void;
}

type BossState = 'dormant' | 'rising' | 'fighting' | 'dying' | 'dead';

export class VacancySignBoss {
  state: BossState = 'dormant';
  hp = BOSS2.hp;
  exposed = false;

  core: Phaser.Physics.Arcade.Image;
  private scene: Phaser.Scene;
  private deps: VacancyBossDeps;
  private frame: Phaser.GameObjects.Image;
  private frameGlow: Phaser.GameObjects.Image;
  private coreGlow: Phaser.GameObjects.Image;
  private bar: Phaser.GameObjects.Image;
  private readonly signX: number;
  private readonly signY: number;
  private readonly floorY: number;
  private readonly arenaLeft: number;
  private readonly arenaRight: number;
  private letterAt = 0;
  private stutterAt = 0;
  private exposedUntil = 0;
  private staggerUntil = 0;
  private barPhase = 0;

  constructor(scene: Phaser.Scene, x: number, floorY: number, arenaLeft: number, arenaRight: number, deps: VacancyBossDeps) {
    this.scene = scene;
    this.deps = deps;
    this.signX = x;
    this.floorY = floorY;
    this.arenaLeft = arenaLeft;
    this.arenaRight = arenaRight;
    this.signY = floorY - 44; // frame hangs above the walkway

    this.frameGlow = scene.add
      .image(x, this.signY, TEX.glow8)
      .setScale(7)
      .setTint(P.neonPink)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(14);
    this.frame = scene.add.image(x, this.signY, TEX.vsFrame).setDepth(16).setAlpha(0);

    // filament core sits LOW on the sign so a grounded pulse reaches it once exposed
    const coreY = floorY - 14;
    this.coreGlow = scene.add
      .image(x, coreY, TEX.glow8)
      .setScale(3)
      .setTint(P.filament)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(16);
    this.core = scene.physics.add.staticImage(x, coreY, TEX.vsCore).setDepth(17);
    (this.core.body as Phaser.Physics.Arcade.StaticBody).setCircle(9, -3, -3);
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.core.setAlpha(0);

    // the sweeping buzz light-bar (a tall vertical bar swept horizontally)
    this.bar = scene.add
      .image(x, floorY - 30, TEX.vsBar)
      .setDepth(13)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setRotation(Math.PI / 2) // stand the wide bar upright
      .setDisplaySize(6, 64);
  }

  get alive(): boolean {
    return this.state === 'fighting' || this.state === 'rising';
  }

  spawn(): void {
    if (this.state !== 'dormant') return;
    this.state = 'rising';
    audio.bossWarning();
    this.deps.fx.shake(0.007, 500);
    this.deps.fx.staticBurst(500);
    const rise = 60;
    const parts: Phaser.GameObjects.Image[] = [this.frame, this.frameGlow];
    parts.forEach((p) => {
      p.setAlpha(p === this.frameGlow ? 0 : 1);
      p.y += rise;
    });
    this.scene.tweens.add({
      targets: parts,
      y: `-=${rise}`,
      duration: 1000,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.state = 'fighting';
        this.letterAt = this.scene.time.now + 1400;
        this.stutterAt = this.scene.time.now + BOSS2.stutterEveryMs;
        this.frameGlow.setAlpha(0.4);
        this.bar.setAlpha(0.8);
        bus.emit(EVT.bossSpawn, { name: 'THE VACANCY SIGN', hp: this.hp, max: BOSS2.hp });
      },
    });
  }

  /** scan pulse hit the sign — expose the filament core */
  onScanned(): void {
    if (this.state !== 'fighting' || this.exposed) return;
    this.expose(BOSS2.coreExposeMs, 'CORE EXPOSED');
    audio.bossStagger();
  }

  private expose(ms: number, label: string): void {
    this.exposed = true;
    this.exposedUntil = this.scene.time.now + ms;
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = true;
    this.core.setAlpha(1);
    this.coreGlow.setAlpha(0.9);
    this.deps.fx.floatText(this.signX, this.signY - 18, label, P.filament);
  }

  /** a player bolt reached the exposed core */
  hitCore(amount = 1): void {
    if (this.state !== 'fighting' || !this.exposed) return;
    this.hp -= amount;
    this.staggerUntil = this.scene.time.now + BOSS2.staggerMs;
    this.frame.setTintFill(0xffffff);
    this.core.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      this.frame.clearTint();
      this.core.clearTint();
    });
    this.deps.fx.explode(this.signX, this.floorY - 14, P.filament, 8);
    this.deps.fx.shake(0.005, 120);
    audio.enemyHit();
    bus.emit(EVT.bossHp, { hp: this.hp, max: BOSS2.hp });
    if (this.hp <= 0) this.die();
  }

  /** Test API: apply damage regardless of exposure */
  debugDamage(amount: number): void {
    if (this.state !== 'fighting') return;
    this.expose(500, 'CORE EXPOSED');
    for (let i = 0; i < amount && this.state === 'fighting'; i++) this.hitCore();
  }

  update(dtSec: number): void {
    if (this.state !== 'fighting') return;
    const now = this.scene.time.now;
    const player = this.deps.getPlayer();
    const staggered = now < this.staggerUntil;

    // exposure window close
    if (this.exposed && now > this.exposedUntil) {
      this.exposed = false;
      (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.core.setAlpha(0);
    }
    this.coreGlow.setAlpha(this.exposed ? 0.7 + Math.sin(now * 0.02) * 0.3 : 0);
    // the never-clearing sign flickers
    this.frameGlow.setAlpha(0.3 + Math.abs(Math.sin(now * 0.006)) * 0.25);

    // short-circuit STUTTER — self-exposes the core (a free opening)
    if (!staggered && now >= this.stutterAt) {
      this.stutterAt = now + BOSS2.stutterEveryMs;
      this.deps.fx.staticBurst(300);
      this.frame.setTint(P.neonCyan);
      this.scene.time.delayedCall(160, () => this.frame.clearTint());
      if (!this.exposed) this.expose(BOSS2.stutterMs, 'SHORT CIRCUIT');
    }

    // falling neon LETTERS
    if (!staggered && now >= this.letterAt) {
      this.letterAt = now + BOSS2.letterDropPeriodMs;
      for (let i = 0; i < BOSS2.letterCount; i++) {
        const lx = this.arenaLeft + 12 + Math.random() * (this.arenaRight - this.arenaLeft - 24);
        this.deps.fireLetter(lx, this.signY - 4, 0, BOSS2.letterSpeed);
      }
      audio.hazardZap();
    }

    // sweeping buzz light-BAR
    this.barPhase += dtSec * (Math.PI * 2) / (BOSS2.barSweepPeriodMs / 1000);
    const t = (Math.sin(this.barPhase) + 1) / 2;
    const bx = this.arenaLeft + 20 + (this.arenaRight - this.arenaLeft - 40) * t;
    this.bar.setPosition(bx, this.floorY - 30);
    this.bar.setAlpha(staggered ? 0.25 : 0.7 + Math.sin(now * 0.03) * 0.2);
    if (!staggered && player.alive && Math.abs(player.x - bx) < BOSS2.barHalfWidth && player.y > this.floorY - 60) {
      this.deps.damagePlayer(BOSS2.barDamage, bx);
    }
  }

  private die(): void {
    this.state = 'dying';
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.bar.setAlpha(0);
    audio.explode();
    this.deps.fx.staticBurst(700);
    this.deps.fx.shake(0.01, 600);
    // the sign dies letter by letter
    for (let i = 0; i < 6; i++) {
      this.scene.time.delayedCall(i * 130, () => {
        this.deps.fx.explode(this.signX + Phaser.Math.Between(-20, 20), this.signY + Phaser.Math.Between(-10, 10), i % 2 ? P.neonPink : P.neonCyan, 12);
        audio.enemyHit();
      });
    }
    this.scene.time.delayedCall(820, () => {
      this.deps.fx.explode(this.signX, this.signY, P.white, 24);
      this.deps.fx.flash(P.filament, 180);
      audio.explode();
      [this.frame, this.frameGlow, this.coreGlow, this.core, this.bar].forEach((p) => p.destroy());
      this.state = 'dead';
      bus.emit(EVT.bossDead, {});
      this.deps.onDefeated();
    });
  }

  destroy(): void {
    [this.frame, this.frameGlow, this.coreGlow, this.core, this.bar].forEach((p) => p?.destroy());
  }
}
