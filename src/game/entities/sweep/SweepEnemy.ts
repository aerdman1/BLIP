/**
 * SweepEnemy — the Interpretation Engine's radar-scope agents. One class, many
 * behaviours (chase / gunner / diver / weaver / turret) driven by the uniform
 * SWEEP_ENEMIES cfg + a `behavior` tag. Fiction: they're trying to LABEL the blip.
 * Tuning + per-kind counters in config.SWEEP_ENEMIES.
 */
import Phaser from 'phaser';
import { PALETTE as P, SWEEP, SWEEP_ENEMIES, TEX, type SweepEnemyKind } from '../../config';

const TEX_FOR: Record<SweepEnemyKind, string> = {
  drifter: TEX.sweepDrifter,
  tagger: TEX.sweepTagger,
  diver: TEX.sweepDiver,
  warden: TEX.sweepWarden,
  sniper: TEX.sweepSniper,
  splitter: TEX.sweepSplitter,
  weaver: TEX.sweepWeaver,
  turret: TEX.sweepTurret,
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
  private faceAngle = 0; // angle toward the player (drives the warden's shield facing)
  private charging = false; // gunner/turret wind-up in progress
  private chargeEndAt = 0;
  private lockAngle = 0; // sniper aim locked at wind-up start (so you can dodge)
  private wobPhase = Math.random() * Math.PI * 2; // weaver sine offset

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
    this.fireAt = scene.time.now + 500 + Math.random() * 900; // stagger first volleys
  }

  /** how many shards this enemy bursts into when killed (REPLICATOR) — scene spawns them */
  get splitInto(): number {
    return this.cfg.splitInto;
  }

  /**
   * FIREWALL guard: true when an incoming player bolt strikes the warden's FRONT arc.
   * The warden always faces the player, so a bolt that arrives heading roughly opposite
   * to its facing is coming in the front and is deflected — flank it, dash through, or Scan it
   * (Scan/Overdrive are omni-directional and always land, so it can never be un-killable).
   */
  blocksShot(vx: number, vy: number): boolean {
    if (!this.cfg.shielded || !this.active) return false;
    const shotDir = Math.atan2(vy, vx);
    const diff = Math.abs(Phaser.Math.Angle.Wrap(shotDir - this.faceAngle));
    return diff > Math.PI * 0.6; // ~108° frontal shield arc
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
    // don't clear the tint while a wind-up blink is driving it
    if (this.isTinted && !this.charging && now >= this.flashUntil) this.clearTint();
    this.drawHp();

    const body = this.body as Phaser.Physics.Arcade.Body;
    const ang = Math.atan2(py - this.y, px - this.x);
    this.faceAngle = ang;
    if (this.cfg.shielded) this.setRotation(ang); // the FIREWALL turns its shield toward you
    // while being knocked back, let momentum carry — don't fight it with AI
    if (now < this.knockbackUntil) return;

    const spd = this.cfg.speed * aggro;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, px, py);

    switch (this.cfg.behavior) {
      case 'chase':
        body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
        break;

      case 'weaver': {
        // fast rush with a lateral sine so aimed shots slide off — lead it or Scan it
        const perp = ang + Math.PI / 2;
        const wob = Math.sin(now * 0.012 + this.wobPhase) * this.cfg.weave;
        body.setVelocity(Math.cos(ang) * spd + Math.cos(perp) * wob, Math.sin(ang) * spd + Math.sin(perp) * wob);
        break;
      }

      case 'gunner': {
        const pref = this.cfg.keepRange || 130;
        const s = dist > pref + 24 ? spd : dist < pref - 24 ? -spd : 0;
        if (this.cfg.telegraphMs > 0) {
          // PINPOINT: freeze, blink a tell, lock aim, then fire one fast line-shot
          if (this.charging) {
            body.setVelocity(0, 0);
            this.setTint(Math.floor(now / 80) % 2 ? P.warning : P.danger);
            if (now >= this.chargeEndAt) {
              this.charging = false;
              this.clearTint();
              this.fireAt = now + this.cfg.fireMs / aggro;
              fireBolt(this.x, this.y, Math.cos(this.lockAngle) * this.cfg.boltSpeed, Math.sin(this.lockAngle) * this.cfg.boltSpeed);
            }
          } else {
            body.setVelocity(Math.cos(ang) * s, Math.sin(ang) * s);
            if (now >= this.fireAt && dist < 340) {
              this.charging = true;
              this.chargeEndAt = now + this.cfg.telegraphMs;
              this.lockAngle = ang; // committed here → sidestep during the tell to dodge
            }
          }
        } else {
          body.setVelocity(Math.cos(ang) * s, Math.sin(ang) * s);
          if (now >= this.fireAt && dist < 300) {
            this.fireAt = now + this.cfg.fireMs / aggro;
            fireBolt(this.x, this.y, Math.cos(ang) * this.cfg.boltSpeed, Math.sin(ang) * this.cfg.boltSpeed);
          }
        }
        break;
      }

      case 'turret': {
        // PYLON: rooted; blink a tell, then loose a radial bolt-ring. Rush it between volleys.
        body.setVelocity(0, 0);
        if (this.charging) {
          this.setTint(Math.floor(now / 80) % 2 ? P.warning : P.danger);
          if (now >= this.chargeEndAt) {
            this.charging = false;
            this.clearTint();
            this.fireAt = now + this.cfg.fireMs / aggro;
            const n = Math.max(1, this.cfg.burst);
            for (let i = 0; i < n; i++) {
              const a2 = ang + (i / n) * Math.PI * 2; // ring anchored toward you
              fireBolt(this.x, this.y, Math.cos(a2) * this.cfg.boltSpeed, Math.sin(a2) * this.cfg.boltSpeed);
            }
          }
        } else if (now >= this.fireAt && dist < 260) {
          this.charging = true;
          this.chargeEndAt = now + this.cfg.telegraphMs;
        }
        break;
      }

      default: {
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
