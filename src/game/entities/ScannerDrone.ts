/**
 * Scanner drone — a flying opinion of the Interpretation Engine.
 * Patrols with a red cone; chases and fires when you're close or when the
 * classification meter says THREAT (the label makes it brave).
 */
import Phaser from 'phaser';
import { DRONE, PALETTE as P, TEX } from '../config';
import { audio } from '../systems/AudioSystem';
import type { EffectsSystem } from '../systems/EffectsSystem';
import { DetectionCone } from './DetectionCone';

export interface DroneDeps {
  fx: EffectsSystem;
  fireBolt: (x: number, y: number, tx: number, ty: number) => void;
  getPlayer: () => { x: number; y: number; alive: boolean };
  isThreat: () => boolean;
  onDestroyed: (drone: ScannerDrone) => void;
}

export class ScannerDrone extends Phaser.Physics.Arcade.Sprite {
  hp = DRONE.hp;
  cone: DetectionCone;
  private deps: DroneDeps;
  private patrolX0: number;
  private patrolX1: number;
  private dir: 1 | -1 = 1;
  private bobT = Math.random() * Math.PI * 2;
  private fireCdUntil = 0;
  private flashUntil = 0;
  private stunnedUntil = 0;
  private glow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, patrolHalfRange: number, deps: DroneDeps) {
    super(scene, x, y, TEX.drone);
    this.deps = deps;
    this.patrolX0 = x - patrolHalfRange;
    this.patrolX1 = x + patrolHalfRange;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(14, 10);
    this.setDepth(18);
    // a soft red threat halo so drones read against the dark valley/hills
    this.glow = scene.add
      .image(x, y, TEX.glow8)
      .setTint(P.danger)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(1.3)
      .setAlpha(0.3)
      .setDepth(17);
    this.cone = new DetectionCone(scene, DRONE.coneLength, DRONE.coneHalfAngleDeg);
  }

  updateDrone(): void {
    if (!this.active) return;
    const now = this.scene.time.now;
    const dtSec = this.scene.game.loop.delta / 1000;
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.glow.setPosition(this.x, this.y);
    // scan-stun: frozen in place, no fire, violet glitch tint
    if (now < this.stunnedUntil) {
      body.setVelocity(0, 0);
      this.setTint(P.violetGlitch);
      this.glow.setTint(P.violetGlitch).setAlpha(0.5);
      return;
    }
    const player = this.deps.getPlayer();
    this.bobT += dtSec * 3;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const aggro = player.alive && (this.deps.isThreat() || dist < DRONE.aggroRange);

    if (aggro) {
      // keep a hover distance: approach when far, back off when crowded
      const want = dist > 72 ? DRONE.chaseSpeed : -DRONE.chaseSpeed * 0.5;
      body.setVelocityX(Math.sign(dx) * want);
      // align to the player's height quickly — threatening AND hittable
      body.setVelocityY(Phaser.Math.Clamp(dy * 2.2, -72, 72) + Math.sin(this.bobT) * 4);
      this.dir = dx >= 0 ? 1 : -1;
      // fire
      const cd = this.deps.isThreat() ? DRONE.threatFireCooldownMs : DRONE.fireCooldownMs;
      if (now >= this.fireCdUntil && dist < 190) {
        this.fireCdUntil = now + cd;
        this.deps.fireBolt(this.x, this.y + 4, player.x, player.y);
      }
    } else {
      body.setVelocityX(this.dir * DRONE.patrolSpeed);
      body.setVelocityY(Math.sin(this.bobT) * 10);
      if (this.x <= this.patrolX0) this.dir = 1;
      if (this.x >= this.patrolX1) this.dir = -1;
    }

    // threat halo brightens when the drone is actively hunting
    this.glow.setTint(P.danger).setAlpha(aggro ? 0.52 : 0.3);
    this.setFlipX(this.dir < 0);
    // cone points forward-down from the lens
    this.cone.setApex(this.x + this.dir * 6, this.y + 3);
    this.cone.setAngle(this.dir > 0 ? Phaser.Math.DegToRad(28) : Phaser.Math.DegToRad(152));
    if (now > this.flashUntil) this.clearTint();
  }

  /** a scan pulse froze this drone (Dead Cells double-duty: scan is offense too) */
  stun(sec: number): void {
    if (!this.active) return;
    this.stunnedUntil = this.scene.time.now + sec * 1000;
    this.setTint(P.violetGlitch);
    this.deps.fx.sparks(this.x, this.y, P.violetGlitch, 8);
  }

  get stunned(): boolean {
    return this.active && this.scene.time.now < this.stunnedUntil;
  }

  takeDamage(n: number): boolean {
    if (!this.active) return false;
    this.hp -= n;
    this.setTintFill(0xffffff);
    this.flashUntil = this.scene.time.now + 60;
    audio.enemyHit();
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  die(): void {
    this.deps.fx.explode(this.x, this.y, P.warning, 14);
    this.deps.fx.explode(this.x, this.y, P.danger, 8);
    this.deps.fx.shake(0.004, 110);
    audio.explode();
    this.cone.destroy();
    this.deps.onDestroyed(this);
    this.destroy();
  }

  destroy(fromScene?: boolean): void {
    this.cone?.destroy();
    this.glow?.destroy();
    super.destroy(fromScene);
  }
}
