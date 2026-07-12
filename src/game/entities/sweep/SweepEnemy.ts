/**
 * SweepEnemy — the Interpretation Engine's radar-scope agents. One class, three
 * behaviours (drifter / tagger / diver) driven by the uniform SWEEP_ENEMIES cfg.
 * Fiction: they're trying to LABEL the blip. Tuning in config.SWEEP_ENEMIES.
 */
import Phaser from 'phaser';
import { PALETTE as P, SWEEP, SWEEP_ENEMIES, TEX, type SweepEnemyKind } from '../../config';

const TEX_FOR: Record<SweepEnemyKind, string> = {
  drifter: TEX.sweepDrifter,
  tagger: TEX.sweepTagger,
  diver: TEX.sweepDiver,
};

type FireBolt = (x: number, y: number, vx: number, vy: number) => void;
type DiveState = 'idle' | 'diving' | 'recover';

export class SweepEnemy extends Phaser.Physics.Arcade.Sprite {
  readonly kind: SweepEnemyKind;
  readonly points: number;
  hp: number;
  maxHp: number;
  private cfg: (typeof SWEEP_ENEMIES)[SweepEnemyKind];
  private fireAt = 0;
  private dive: DiveState = 'idle';
  private diveAng = 0;
  private diveEndAt = 0;
  private nextDiveAt = 0;
  private knockbackUntil = 0;
  private flashUntil = 0;
  private hpBar: Phaser.GameObjects.Graphics;
  private lastHp = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: SweepEnemyKind) {
    super(scene, x, y, TEX_FOR[kind]);
    this.kind = kind;
    this.cfg = SWEEP_ENEMIES[kind];
    this.hp = this.cfg.hp;
    this.maxHp = this.cfg.hp;
    this.points = this.cfg.points;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(11, 11);
    body.setDrag(600, 600);
    this.setDepth(15);
    this.hpBar = scene.add.graphics().setDepth(16);
    this.nextDiveAt = scene.time.now + 700 + Math.random() * 1400;
  }

  /** redraw the little HP bar only when hp changed; reposition above the drone */
  private drawHp(): void {
    const w = Math.max(12, this.displayWidth * 0.8);
    if (this.hp !== this.lastHp) {
      this.lastHp = this.hp;
      this.hpBar.clear();
      if (this.hp < this.maxHp && this.hp > 0) {
        this.hpBar.fillStyle(P.black, 0.6).fillRect(-w / 2 - 1, -1, w + 2, 4);
        const frac = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
        this.hpBar.fillStyle(frac > 0.5 ? P.signalGreen : frac > 0.25 ? P.warning : P.danger, 1).fillRect(-w / 2, 0, w * frac, 2);
      }
    }
    this.hpBar.setPosition(this.x, this.y - this.displayHeight / 2 - 5).setVisible(this.hp < this.maxHp && this.active);
  }

  /** called each frame by the scene. aggro (1..1.35) ramps with Sweep heat. */
  drive(px: number, py: number, now: number, fireBolt: FireBolt, aggro: number): void {
    if (!this.active) return;
    if (this.isTinted && now >= this.flashUntil) this.clearTint();
    this.drawHp();

    const body = this.body as Phaser.Physics.Arcade.Body;
    // while being knocked back, let momentum carry — don't fight it with AI
    if (now < this.knockbackUntil) return;

    const ang = Math.atan2(py - this.y, px - this.x);
    const spd = this.cfg.speed * aggro;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, px, py);

    if (this.kind === 'drifter') {
      body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
    } else if (this.kind === 'tagger') {
      const pref = 130; // keep a firing standoff
      const s = dist > pref + 24 ? spd : dist < pref - 24 ? -spd : 0;
      body.setVelocity(Math.cos(ang) * s, Math.sin(ang) * s);
      if (now >= this.fireAt && dist < 300) {
        this.fireAt = now + this.cfg.fireMs / aggro;
        fireBolt(this.x, this.y, Math.cos(ang) * this.cfg.boltSpeed, Math.sin(ang) * this.cfg.boltSpeed);
      }
    } else {
      // diver: circle in, then lock-on lunge, then recover
      if (this.dive === 'idle') {
        body.setVelocity(Math.cos(ang) * spd * 0.5, Math.sin(ang) * spd * 0.5);
        if (now >= this.nextDiveAt && dist < this.cfg.lockRange) {
          this.dive = 'diving';
          this.diveAng = ang;
          this.diveEndAt = now + 450;
        }
      } else if (this.dive === 'diving') {
        body.setVelocity(Math.cos(this.diveAng) * this.cfg.diveSpeed, Math.sin(this.diveAng) * this.cfg.diveSpeed);
        if (now >= this.diveEndAt) {
          this.dive = 'recover';
          this.nextDiveAt = now + 800 + Math.random() * 900;
        }
      } else {
        if (now >= this.nextDiveAt) this.dive = 'idle';
      }
    }
  }

  /** apply damage + knockback + white flash; returns true if this hit killed it */
  applyHit(dmg: number, fromX: number, fromY: number, force: number = SWEEP.enemyKnockback): boolean {
    this.hp -= dmg;
    const now = this.scene.time.now;
    this.setTint(0xffffff);
    this.flashUntil = now + 70;
    const ang = Math.atan2(this.y - fromY, this.x - fromX);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(Math.cos(ang) * force, Math.sin(ang) * force);
    this.knockbackUntil = now + 130;
    return this.hp <= 0;
  }

  destroy(fromScene?: boolean): void {
    this.hpBar?.destroy();
    super.destroy(fromScene);
  }
}
