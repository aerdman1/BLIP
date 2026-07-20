/**
 * SPOTTER — the press box's answer to a contact it can't drop.
 * Stage 2 of the Chagrin Falls High threat ladder: once the Engine has you
 * TRACKED, a spotter drone is launched to keep the read while the towers work.
 * It hunts by hovering over your last known position with its own small cone.
 *
 * It never damages you — it only feeds classification. The counter is the same
 * as everything else in this stadium: break its line of sight (cover) or stand
 * in an ANCHOR. Hold that for `spotterLoseSightMs` and it gives up and retires.
 */
import Phaser from 'phaser';
import { PALETTE as P, STADIUM, TEX } from '../config';
import { DetectionCone } from './DetectionCone';

export interface SpotterDeps {
  /** live player read */
  getPlayer: () => { x: number; y: number; alive: boolean };
  /** scene-owned check: is the sightline apex→player broken by cover / is the player anchored? */
  isHidden: (fromX: number, fromY: number, px: number, py: number) => boolean;
  /** fired once when it decides to leave (so the scene can toast/clear state) */
  onRetired: () => void;
}

type SpotterState = 'hunting' | 'retiring';

export class Spotter {
  private scene: Phaser.Scene;
  private body: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private cone: DetectionCone;
  private deps: SpotterDeps;

  x: number;
  y: number;
  state: SpotterState = 'hunting';
  /** true on the frame it has an unbroken read on the player */
  sees = false;

  private lostMs = 0;
  private retireMs = 0;
  private dead = false;

  constructor(scene: Phaser.Scene, x: number, y: number, deps: SpotterDeps) {
    this.scene = scene;
    this.deps = deps;
    this.x = x;
    this.y = y;

    this.halo = scene.add
      .image(x, y, TEX.glow8)
      .setScale(2.4)
      .setTint(P.scoreboardKnown)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(13)
      .setAlpha(0.45);
    this.body = scene.add.image(x, y, TEX.drone).setTint(P.scoreboardKnown).setDepth(14);
    this.label = scene.add
      .text(x, y - 12, 'SPOTTER', {
        fontFamily: 'monospace',
        fontSize: '6px',
        color: `#${P.scoreboardKnown.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(14)
      .setResolution(2)
      .setAlpha(0.85);

    this.cone = new DetectionCone(scene, STADIUM.spotterConeLength, STADIUM.spotterConeHalfAngleDeg, P.scoreboardKnown);
    this.cone.setApex(x, y);
    this.cone.setAngle(Math.PI / 2);

    scene.tweens.add({ targets: this.halo, alpha: { from: 0.3, to: 0.6 }, duration: 420, yoyo: true, repeat: -1 });
  }

  /** drive one frame; returns whether the spotter currently has a read on the player */
  update(dtSec: number): boolean {
    if (this.dead) return false;
    const pl = this.deps.getPlayer();

    if (this.state === 'retiring') {
      // climb out toward the press box and vanish
      this.y -= STADIUM.spotterSpeed * 1.6 * dtSec;
      this.retireMs += dtSec * 1000;
      const k = 1 - Math.min(1, this.retireMs / STADIUM.spotterRetireMs);
      this.halo.setAlpha(0.45 * k);
      this.body.setAlpha(k);
      this.label.setAlpha(0.85 * k);
      this.cone.setVisible(false);
      this.sync();
      if (this.retireMs >= STADIUM.spotterRetireMs) this.destroy();
      return false;
    }

    // hunt: close on a point hanging above the player
    const tx = pl.x;
    const ty = pl.y - STADIUM.spotterHoverAbove;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
      const step = Math.min(dist, STADIUM.spotterSpeed * dtSec);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
    // bob so it reads as airborne
    const bob = Math.sin(this.scene.time.now * 0.006) * 1.5;

    this.cone.setApex(this.x, this.y + bob);
    this.cone.setAngle(Math.atan2(pl.y - (this.y + bob), pl.x - this.x));
    const inCone = this.cone.update(pl.x, pl.y);
    const hidden = this.deps.isHidden(this.x, this.y + bob, pl.x, pl.y);
    this.sees = inCone && !hidden && pl.alive;

    if (this.sees) {
      this.lostMs = 0;
      this.label.setText('SPOTTER').setAlpha(0.9);
    } else {
      this.lostMs += dtSec * 1000;
      // it visibly loses confidence — the tell that hiding is working
      this.label.setText(this.lostMs > STADIUM.spotterLoseSightMs * 0.5 ? 'SEARCHING…' : 'SPOTTER').setAlpha(0.6);
      if (this.lostMs >= STADIUM.spotterLoseSightMs) this.retire();
    }

    this.sync(bob);
    return this.sees;
  }

  private sync(bob = 0): void {
    this.body.setPosition(this.x, this.y + bob);
    this.halo.setPosition(this.x, this.y + bob);
    this.label.setPosition(this.x, this.y + bob - 12);
  }

  /** give up the read and climb out (idempotent) */
  retire(): void {
    if (this.dead || this.state === 'retiring') return;
    this.state = 'retiring';
    this.retireMs = 0;
    this.deps.onRetired();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.cone.destroy();
    this.body.destroy();
    this.halo.destroy();
    this.label.destroy();
  }

  get active(): boolean {
    return !this.dead;
  }
}
