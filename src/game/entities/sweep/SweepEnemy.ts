/**
 * SweepEnemy — the Interpretation Engine's radar-scope agents. One class, many
 * behaviours (chase / gunner / diver / weaver / turret) driven by the uniform
 * SWEEP_ENEMIES cfg + a `behavior` tag. Fiction: they're trying to LABEL the blip.
 * Tuning + per-kind counters in config.SWEEP_ENEMIES.
 */
import Phaser from 'phaser';
import { PALETTE as P, SWEEP, SWEEP_ENEMIES, TEX, type SweepEnemyKind } from '../../config';
import type { AffinityState } from '../../systems/DamageAffinity';

const TEX_FOR: Record<SweepEnemyKind, string> = {
  drifter: TEX.sweepDrifter,
  tagger: TEX.sweepTagger,
  diver: TEX.sweepDiver,
  warden: TEX.sweepWarden,
  sniper: TEX.sweepSniper,
  splitter: TEX.sweepSplitter,
  weaver: TEX.sweepWeaver,
  turret: TEX.sweepTurret,
  cipher: TEX.sweepCipher,
  graviton: TEX.sweepGraviton,
  undertow: TEX.sweepUndertow,
  decoy: TEX.sweepDecoy,
  dormant: TEX.sweepDormant,
};

type FireBolt = (x: number, y: number, vx: number, vy: number) => void;
type DiveState = 'idle' | 'diving' | 'recover';
type ShotBlockState = 'none' | 'blocked' | 'overloaded';
type AmbushState = 'hidden' | 'waking' | 'active';
type UndertowState = 'burrowed' | 'locking' | 'surfaced';
export interface SweepEnemyDebugState {
  kind: SweepEnemyKind;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bodyW: number;
  bodyH: number;
  rooted: boolean;
  shielded: boolean;
  charging: boolean;
  pathRecovering: boolean;
}

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
  private lastMoveX = 0;
  private lastMoveY = 0;
  private lastMoveCheckAt = 0;
  private stuckSince = 0;
  private unstuckUntil = 0;
  private unstuckVx = 0;
  private unstuckVy = 0;
  private stuckRecoveries = 0;
  private shieldHits = 0;
  private shieldBrokenUntil = 0;
  private readonly anchorX: number;
  private readonly anchorY: number;
  private ambushState: AmbushState = 'hidden';
  private ambushAt = 0;
  private undertowState: UndertowState = 'burrowed';
  private undertowAt = 0;
  private undertowTargetX = 0;
  private undertowTargetY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: SweepEnemyKind) {
    super(scene, x, y, TEX_FOR[kind]);
    this.kind = kind;
    this.cfg = SWEEP_ENEMIES[kind];
    this.anchorX = x;
    this.anchorY = y;
    this.hp = this.cfg.hp;
    this.maxHp = this.cfg.hp;
    this.points = this.cfg.points;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    // HD drone sprites read around 26px tall. A smaller legacy body made edge
    // hits look like direct hits but register as misses.
    body.setSize(24, 24, true);
    body.setDrag(600, 600);
    if (this.cfg.behavior === 'turret') body.setImmovable(true);
    this.setDepth(15);
    this.hpBar = scene.add.graphics().setDepth(16);
    this.nextDiveAt = scene.time.now + 700 + Math.random() * 1400;
    this.fireAt = scene.time.now + 500 + Math.random() * 900; // stagger first volleys
    this.lastMoveX = x;
    this.lastMoveY = y;
    this.lastMoveCheckAt = scene.time.now;
    if (this.cfg.behavior === 'decoy') {
      this.setAlpha(0.86).setTint(P.signal);
      body.setImmovable(true);
    } else if (this.cfg.behavior === 'dormant') {
      this.setAlpha(0.82).setTint(0x6c7278);
      body.setImmovable(true);
    } else if (this.cfg.behavior === 'undertow') {
      this.setAlpha(0.58).setTint(P.warning);
      this.undertowAt = scene.time.now + 900 + Math.random() * 800;
    }
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
  shotBlockState(vx: number, vy: number): ShotBlockState {
    if (!this.cfg.shielded || !this.active) return 'none';
    const now = this.scene.time.now;
    if (now < this.shieldBrokenUntil) return 'none';
    const shotDir = Math.atan2(vy, vx);
    const diff = Math.abs(Phaser.Math.Angle.Wrap(shotDir - this.faceAngle));
    const blocked = diff > Math.PI * 0.6; // ~108° frontal shield arc
    if (!blocked) {
      this.shieldHits = 0;
      return 'none';
    }
    this.shieldHits++;
    if (this.shieldHits >= 3) {
      this.shieldHits = 0;
      this.shieldBrokenUntil = now + 1600;
      return 'overloaded';
    }
    return 'blocked';
  }

  debugState(): SweepEnemyDebugState {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return {
      kind: this.kind,
      hp: this.hp,
      maxHp: this.maxHp,
      x: Math.round(this.x),
      y: Math.round(this.y),
      vx: Math.round(body.velocity.x),
      vy: Math.round(body.velocity.y),
      bodyW: Math.round(body.width),
      bodyH: Math.round(body.height),
      rooted: this.cfg.behavior === 'turret',
      shielded: this.cfg.shielded,
      charging: this.charging,
      pathRecovering: this.scene.time.now < this.unstuckUntil,
    };
  }

  affinityState(): AffinityState {
    if (this.cfg.behavior === 'graviton' && this.scene.time.now < (Number(this.getData('gravitonActiveUntil')) || 0)) return 'field-active';
    if (this.cfg.behavior === 'undertow') return this.undertowState === 'surfaced' ? 'surfaced' : 'burrowed';
    if (this.cfg.behavior === 'decoy' || this.cfg.behavior === 'dormant') return this.ambushState === 'hidden' || this.ambushState === 'waking' ? 'disguised' : 'active';
    return 'normal';
  }

  /** redraw the little HP bar only when hp changed; reposition above the drone */
  /** slot angles drift slowly so a held position never looks frozen */
  private slotDrift(): void {
    this.slot += this.wobPhase > Math.PI ? 0.006 : -0.006;
    if (this.slot > Math.PI * 2) this.slot -= Math.PI * 2;
    if (this.slot < 0) this.slot += Math.PI * 2;
  }

  /** Nudge away from a neighbour that is too close. Applied by the scene after
   *  all drives, as a position correction — velocity is left to the AI. */
  separate(ox: number, oy: number, minDist: number): void {
    const dx = this.x - ox;
    const dy = this.y - oy;
    const d = Math.hypot(dx, dy);
    if (d >= minDist || d < 0.001) return;
    const push = (minDist - d) * 0.5;
    this.setPosition(this.x + (dx / d) * push, this.y + (dy / d) * push);
  }

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
  /**
   * A per-drone orbit slot around the player. Chasers aim for the RING at
   * `standoff`, offset to their slot angle, instead of all converging on the
   * player's exact position — which is what made them stack into one blob and
   * sit on top of CONTACT-47. Damage, speed and aggression are unchanged; only
   * the point they steer toward moves.
   */
  private slot = Math.random() * Math.PI * 2;

  private updateStuckRecovery(now: number, body: Phaser.Physics.Arcade.Body, px: number, py: number, speed: number, pathing: boolean): boolean {
    if (now < this.unstuckUntil) {
      body.setVelocity(this.unstuckVx, this.unstuckVy);
      return true;
    }
    if (now - this.lastMoveCheckAt < 260) return false;

    const moved = Phaser.Math.Distance.Between(this.x, this.y, this.lastMoveX, this.lastMoveY);
    const wantedSpeed = Math.hypot(body.velocity.x, body.velocity.y);
    const blocked =
      body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down ||
      body.touching.left || body.touching.right || body.touching.up || body.touching.down ||
      body.embedded;
    if ((blocked || wantedSpeed > 18) && moved < 1.5) {
      if (!this.stuckSince) this.stuckSince = now;
    } else {
      this.stuckSince = 0;
      this.stuckRecoveries = 0;
    }

    this.lastMoveX = this.x;
    this.lastMoveY = this.y;
    this.lastMoveCheckAt = now;

    if (!this.stuckSince || now - this.stuckSince < 520) return false;

    this.stuckRecoveries++;
    if (pathing && this.stuckRecoveries >= 3) {
      this.setPosition(px, py);
      body.setVelocity(0, 0);
      this.stuckRecoveries = 0;
      this.stuckSince = 0;
      return true;
    }

    const dx = px - this.x;
    const dy = py - this.y;
    const horizontalFirst = Math.abs(dx) > Math.abs(dy);
    const flip = Math.floor(now / 700 + this.wobPhase) % 2 === 0;
    const useHorizontal = flip ? horizontalFirst : !horizontalFirst;
    const dirX = Math.sign(dx) || (this.wobPhase > Math.PI ? 1 : -1);
    const dirY = Math.sign(dy) || (this.wobPhase > Math.PI ? -1 : 1);
    const s = Math.max(34, speed * 0.9);
    this.unstuckVx = useHorizontal ? dirX * s : 0;
    this.unstuckVy = useHorizontal ? 0 : dirY * s;
    this.unstuckUntil = now + 420;
    this.stuckSince = 0;
    body.setVelocity(this.unstuckVx, this.unstuckVy);
    return true;
  }

  drive(px: number, py: number, now: number, fireBolt: FireBolt, aggro: number, pathing = false): void {
    if (!this.active) return;
    // don't clear the tint while a wind-up blink is driving it
    if (this.isTinted && !this.charging && now >= this.flashUntil) this.clearTint();
    this.drawHp();

    const body = this.body as Phaser.Physics.Arcade.Body;
    const ang = Math.atan2(py - this.y, px - this.x);
    this.faceAngle = ang;
    if (this.cfg.shielded) this.setRotation(0); // HD shielded drones should not visually roll onto their side
    if (this.cfg.behavior === 'turret') {
      if (Phaser.Math.Distance.Squared(this.x, this.y, this.anchorX, this.anchorY) > 0.25) {
        this.setPosition(this.anchorX, this.anchorY);
      }
      body.setVelocity(0, 0);
    }
    // while being knocked back, let momentum carry — don't fight it with AI
    if (now < this.knockbackUntil) return;

    const spd = this.cfg.speed * aggro;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, px, py);
    this.slotDrift();
    if (this.updateStuckRecovery(now, body, px, py, spd, pathing)) return;
    const specialPathing = this.cfg.behavior === 'cipher' || this.cfg.behavior === 'graviton' || this.cfg.behavior === 'undertow' || this.cfg.behavior === 'decoy' || this.cfg.behavior === 'dormant';
    if (pathing && this.cfg.behavior !== 'turret' && !specialPathing) {
      if (dist > 5) body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
      else body.setVelocity(0, 0);
      return;
    }

    switch (this.cfg.behavior) {
      case 'chase': {
        // Close in, but stop BESIDE the player at the standoff ring rather than
        // on top of them. Past the ring the drone slides tangentially into its
        // slot, so a pack fans out around the player instead of piling up.
        const stand = SWEEP.closeStandoff;
        if (dist > stand) {
          body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
        } else {
          const slotAng = this.slot;
          const tx = px + Math.cos(slotAng) * stand;
          const ty = py + Math.sin(slotAng) * stand;
          const a2 = Math.atan2(ty - this.y, tx - this.x);
          const d2 = Phaser.Math.Distance.Between(this.x, this.y, tx, ty);
          const s2 = Math.min(spd, d2 * 3);
          body.setVelocity(Math.cos(a2) * s2, Math.sin(a2) * s2);
        }
        break;
      }

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
          const inBand = s === 0;
          const strafe = inBand ? Math.sin(now * 0.004 + this.wobPhase) * spd * 0.42 : 0;
          const perp = ang + Math.PI / 2;
          body.setVelocity(Math.cos(ang) * s + Math.cos(perp) * strafe, Math.sin(ang) * s + Math.sin(perp) * strafe);
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

      case 'cipher': {
        const pref = this.cfg.keepRange || 205;
        const s = dist > pref + 30 ? spd : dist < pref - 26 ? -spd : 0;
        const strafe = Math.sin(now * 0.0035 + this.wobPhase) * spd * 0.5;
        const perp = ang + Math.PI / 2;
        if (this.charging) {
          body.setVelocity(0, 0);
          this.setTint(Math.floor(now / 90) % 2 ? P.warning : P.danger);
          if (now >= this.chargeEndAt) {
            this.charging = false;
            this.clearTint();
            this.fireAt = now + this.cfg.fireMs / aggro;
            this.setData('cipherMarkerRequest', {
              x: px + Math.cos(ang) * 24,
              y: py + Math.sin(ang) * 24,
              radius: 56,
              lockMs: 360,
              explodeMs: 930,
            });
          }
        } else {
          body.setVelocity(Math.cos(ang) * s + Math.cos(perp) * strafe, Math.sin(ang) * s + Math.sin(perp) * strafe);
          if (now >= this.fireAt && dist < this.cfg.lockRange) {
            this.charging = true;
            this.chargeEndAt = now + this.cfg.telegraphMs;
          }
        }
        break;
      }

      case 'graviton': {
        const activeUntil = Number(this.getData('gravitonActiveUntil')) || 0;
        if (now < activeUntil) {
          body.setVelocity(0, 0);
          this.setTint(Math.floor(now / 100) % 2 ? P.neonCyan : P.white);
          break;
        }
        if (this.charging) {
          body.setVelocity(0, 0);
          this.setTint(Math.floor(now / 90) % 2 ? P.neonCyan : P.warning);
          if (now >= this.chargeEndAt) {
            this.charging = false;
            this.clearTint();
            this.fireAt = now + this.cfg.fireMs / aggro;
            this.setData('gravitonActiveUntil', now + 1750);
            this.setData('gravitonPulseAt', now);
          }
        } else {
          const pref = this.cfg.keepRange || 155;
          const s = dist > pref + 28 ? spd : dist < pref - 20 ? -spd : 0;
          body.setVelocity(Math.cos(ang) * s, Math.sin(ang) * s);
          if (now >= this.fireAt && dist < this.cfg.lockRange) {
            this.charging = true;
            this.chargeEndAt = now + this.cfg.telegraphMs;
          }
        }
        break;
      }

      case 'undertow': {
        if (this.undertowState === 'burrowed') {
          this.setAlpha(0.48);
          this.setTint(P.warning);
          const lead = 0.28;
          const tx = px + Math.cos(ang) * dist * lead;
          const ty = py + Math.sin(ang) * dist * lead;
          const chase = Math.atan2(ty - this.y, tx - this.x);
          body.setVelocity(Math.cos(chase) * this.cfg.diveSpeed, Math.sin(chase) * this.cfg.diveSpeed);
          if (now >= this.undertowAt && dist < this.cfg.lockRange) {
            this.undertowState = 'locking';
            this.undertowAt = now + this.cfg.telegraphMs;
            this.undertowTargetX = px + Math.cos(ang) * 28;
            this.undertowTargetY = py + Math.sin(ang) * 28;
            this.setData('undertowLockRequest', { x: this.undertowTargetX, y: this.undertowTargetY, radius: 46, eruptAt: this.undertowAt });
          }
        } else if (this.undertowState === 'locking') {
          body.setVelocity(0, 0);
          this.setAlpha(0.66).setTint(Math.floor(now / 100) % 2 ? P.warning : P.danger);
          if (now >= this.undertowAt) {
            this.undertowState = 'surfaced';
            this.undertowAt = now + 1150;
            this.setAlpha(1).clearTint();
            this.setPosition(this.undertowTargetX, this.undertowTargetY);
            this.setData('undertowEruptRequest', { x: this.x, y: this.y, radius: 46 });
          }
        } else {
          body.setVelocity(Math.cos(ang) * spd * 0.55, Math.sin(ang) * spd * 0.55);
          if (now >= this.undertowAt) {
            this.undertowState = 'burrowed';
            this.undertowAt = now + this.cfg.fireMs;
          }
        }
        break;
      }

      case 'decoy':
      case 'dormant': {
        const wakeDist = this.cfg.lockRange || 72;
        if (this.ambushState === 'hidden') {
          body.setVelocity(0, 0);
          if (dist < wakeDist || this.hp < this.maxHp) {
            this.ambushState = 'waking';
            this.ambushAt = now + this.cfg.telegraphMs;
            this.setAlpha(1);
            this.setTint(this.cfg.behavior === 'decoy' ? P.warning : P.danger);
          }
        } else if (this.ambushState === 'waking') {
          body.setVelocity(0, 0);
          this.setTint(Math.floor(now / 80) % 2 ? P.warning : P.danger);
          if (now >= this.ambushAt) {
            this.ambushState = 'active';
            this.ambushAt = now + 460;
            body.setImmovable(false);
            this.clearTint();
            body.setVelocity(Math.cos(ang) * this.cfg.diveSpeed, Math.sin(ang) * this.cfg.diveSpeed);
            this.setData('ambushBurstRequest', { x: this.x, y: this.y, radius: this.cfg.behavior === 'dormant' ? 50 : 42 });
          }
        } else {
          const burst = now < this.ambushAt;
          body.setVelocity(Math.cos(ang) * (burst ? this.cfg.diveSpeed : spd), Math.sin(ang) * (burst ? this.cfg.diveSpeed : spd));
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
    if (this.cfg.behavior === 'turret') {
      this.setPosition(this.anchorX, this.anchorY);
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return this.hp <= 0;
    }
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
