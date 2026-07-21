/**
 * Per-scene juice helpers: particle bursts, afterimages, shake, flashes,
 * floating text and the glitch/static transition burst.
 * Emitter instances are cached per tint and capped.
 */
import Phaser from 'phaser';
import { PALETTE as P, TEX, css } from '../config';
import { settings } from './Settings';

export class EffectsSystem {
  private scene: Phaser.Scene;
  private emitters = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.emitters.clear());
  }

  private getEmitter(tint: number): Phaser.GameObjects.Particles.ParticleEmitter {
    let e = this.emitters.get(tint);
    if (!e) {
      e = this.scene.add.particles(0, 0, TEX.px, {
        speed: { min: 30, max: 140 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 180, max: 480 },
        scale: { start: 1, end: 0 },
        tint,
        emitting: false,
      });
      e.setDepth(50);
      this.emitters.set(tint, e);
    }
    return e;
  }

  explode(x: number, y: number, tint: number = P.warning, count = 16): void {
    this.getEmitter(tint).explode(Math.min(count, 40), x, y);
  }

  sparks(x: number, y: number, tint: number = P.signal, count = 6): void {
    this.getEmitter(tint).explode(Math.min(count, 20), x, y);
  }

  mechanicalRupture(x: number, y: number, tint: number = P.warning, count = 18): void {
    this.explode(x, y, tint, count);
    this.getEmitter(P.white).explode(Math.min(10, Math.ceil(count * 0.45)), x, y);
    this.getEmitter(P.dangerDark).explode(Math.min(12, Math.ceil(count * 0.55)), x, y);
  }

  scorch(x: number, y: number, radius = 15): void {
    const g = this.scene.add.graphics({ x, y }).setDepth(5).setAlpha(0.62);
    g.fillStyle(P.black, 0.5);
    g.fillEllipse(0, 2, radius * 1.35, radius * 0.78);
    g.fillStyle(P.dangerDark, 0.22);
    g.fillEllipse(-2, -1, radius * 0.78, radius * 0.44);
    g.lineStyle(1, P.warning, 0.2);
    g.strokeEllipse(0, 1, radius * 1.18, radius * 0.62);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      delay: 5200,
      duration: 2400,
      ease: 'Cubic.easeIn',
      onComplete: () => g.destroy(),
    });
  }

  shake(intensity = 0.0045, duration = 130): void {
    if (!settings.get('shake')) return;
    this.scene.cameras.main.shake(duration, intensity);
  }

  flash(color: number = P.white, duration = 90, alpha = 0.6): void {
    const c = Phaser.Display.Color.IntegerToColor(color);
    this.scene.cameras.main.flash(duration, c.red, c.green, c.blue, false);
    void alpha;
  }

  /** dash afterimage ghost */
  afterimage(source: Phaser.GameObjects.Sprite, tint: number = P.signal): void {
    const ghost = this.scene.add
      .image(source.x, source.y, source.texture.key)
      .setFlipX(source.flipX)
      .setTint(tint)
      .setAlpha(0.32)
      .setDepth(source.depth - 1);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 150,
      onComplete: () => ghost.destroy(),
    });
  }

  /** small floating pixel text (e.g. "PING", "+1") */
  floatText(x: number, y: number, msg: string, color: number = P.signal): void {
    const t = this.scene.add
      .text(x, y, msg, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: css(color),
      })
      .setOrigin(0.5, 1)
      .setDepth(90)
      .setResolution(2);
    this.scene.tweens.add({
      targets: t,
      y: y - 16,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /** full-screen static burst for route transitions and boss glitches */
  staticBurst(durationMs = 420): void {
    const cam = this.scene.cameras.main;
    const ts = this.scene.add
      .tileSprite(0, 0, cam.width, cam.height, TEX.noise)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(200)
      .setAlpha(0.55);
    const timer = this.scene.time.addEvent({
      delay: 40,
      repeat: Math.floor(durationMs / 40),
      callback: () => {
        ts.tilePositionX = Math.random() * 64;
        ts.tilePositionY = Math.random() * 64;
        ts.setAlpha(0.2 + Math.random() * 0.4);
      },
    });
    this.scene.time.delayedCall(durationMs, () => {
      timer.remove();
      ts.destroy();
    });
  }

  /** expanding scan ring visual (returns the image so caller can track radius) */
  scanRing(x: number, y: number, radius: number, durationMs: number, tint: number = P.signal): void {
    const ring = this.scene.add.image(x, y, TEX.ring).setTint(tint).setDepth(80).setAlpha(0.9);
    ring.setScale(0.1);
    this.scene.tweens.add({
      targets: ring,
      scale: (radius * 2) / 64,
      alpha: 0,
      duration: durationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}
