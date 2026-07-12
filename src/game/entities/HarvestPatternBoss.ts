/**
 * THE HARVEST PATTERN — Patterson's Orchard (Zone 4) boss.
 * A living crop-circle glyph at the maze's heart. Read the PATTERN, not your
 * reflexes:
 *  - The glyph rotates a ring of harvest symbols; ONE is the WEAK symbol (a bright
 *    lime pip). The core is only vulnerable while that weak symbol dips DOWN toward
 *    you — a telegraphed "STRIKE" window. Pulse the core in the window to wound it;
 *    each hit jumps the weak symbol to a new spoke so the next window is elsewhere.
 *  - A SCAN briefly SLOWS the rotation — ECHO's pattern-reading gift makes the
 *    window easy to read.
 *  - Between windows it fires telegraphed radial harvest-symbol volleys (dodge).
 *  - Below a third HP the maze "closes in": the rotation rages and a telegraphed
 *    HARVEST SWEEP scythes across the arena.
 *
 * Mirrors the WeatherBalloon / VacancySign lifecycle (dormant → rising → fighting →
 * dying → dead) so the scene wiring (arena walls + core overlap + onScanned/hitCore/
 * debugDamage) is identical to Zones 1–3.
 */
import Phaser from 'phaser';
import { BOSS4, EVT, PALETTE as P, TILE, TEX } from '../config';
import { audio } from '../systems/AudioSystem';
import { bus } from '../systems/EventBus';
import type { EffectsSystem } from '../systems/EffectsSystem';

export interface HarvestPatternDeps {
  fx: EffectsSystem;
  /** fire one harvest symbol from (x,y) with velocity (vx,vy) — routed to enemyBolts */
  fireSymbol: (x: number, y: number, vx: number, vy: number) => void;
  damagePlayer: (amount: number, fromX: number) => void;
  getPlayer: () => { x: number; y: number; alive: boolean };
  onDefeated: () => void;
}

type BossState = 'dormant' | 'rising' | 'fighting' | 'dying' | 'dead';
type Sweep = 'idle' | 'telegraph' | 'active';

const RING_R = 18; // radius of the symbol ring around the glyph

export class HarvestPatternBoss {
  state: BossState = 'dormant';
  hp = BOSS4.hp;
  exposed = false;
  telegraphing = false;

  core: Phaser.Physics.Arcade.Image;
  private scene: Phaser.Scene;
  private deps: HarvestPatternDeps;
  private glyph: Phaser.GameObjects.Image;
  private glyphGlow: Phaser.GameObjects.Image;
  private coreGlow: Phaser.GameObjects.Image;
  private marker: Phaser.GameObjects.Image; // the bright pip on the weak symbol
  private sweepBar: Phaser.GameObjects.Image;
  private readonly cx: number;
  private readonly cy: number;
  private readonly floorY: number;
  private readonly arenaLeft: number;
  private readonly arenaRight: number;

  private spin = 0;
  private weakIndex = 0;
  private slowUntil = 0;
  private volleyAt = 0;
  private telegraphUntil = 0;
  private staggerUntil = 0;
  private strikeFloatAt = 0;
  // low-HP harvest sweep
  private sweep: Sweep = 'idle';
  private sweepAt = 0;
  private sweepUntil = 0;
  private sweepFromLeft = true;

  constructor(scene: Phaser.Scene, x: number, floorY: number, arenaLeft: number, arenaRight: number, deps: HarvestPatternDeps) {
    this.scene = scene;
    this.deps = deps;
    this.cx = x;
    this.floorY = floorY;
    this.cy = floorY - 2 * TILE; // low enough that floor/tier pulses reach the core
    this.arenaLeft = arenaLeft;
    this.arenaRight = arenaRight;

    this.glyphGlow = scene.add
      .image(this.cx, this.cy, TEX.glow8)
      .setScale(7)
      .setTint(P.orchardLightPurple)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(13);
    this.glyph = scene.add.image(this.cx, this.cy, TEX.harvestGlyph).setDepth(16).setAlpha(0);
    this.coreGlow = scene.add
      .image(this.cx, this.cy, TEX.glow8)
      .setScale(2.6)
      .setTint(P.cropGlow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(16);
    this.core = scene.physics.add.staticImage(this.cx, this.cy, TEX.harvestCore).setDepth(17);
    // a tall, generous hit area so horizontal pulses connect from the floor OR a tier
    (this.core.body as Phaser.Physics.Arcade.StaticBody).setSize(20, 60);
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.core.setAlpha(0);

    this.marker = scene.add.image(this.cx, this.cy - RING_R, TEX.glow8).setScale(1.1).setTint(P.cropGlow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(17);
    this.sweepBar = scene.add.image(this.cx, floorY, TEX.px).setOrigin(0.5, 1).setDisplaySize(BOSS4.sweepHalfWidth * 2, 7 * TILE).setTint(P.warning).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(14);
  }

  get alive(): boolean {
    return this.state === 'fighting' || this.state === 'rising';
  }

  private get raging(): boolean {
    return this.hp <= BOSS4.hp * BOSS4.lowHpFrac;
  }

  spawn(): void {
    if (this.state !== 'dormant') return;
    this.state = 'rising';
    audio.bossWarning();
    this.deps.fx.shake(0.007, 500);
    this.deps.fx.staticBurst(500);
    this.glyph.setAlpha(1).setScale(0.2);
    this.scene.tweens.add({
      targets: this.glyph,
      scale: 1,
      duration: 900,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.state = 'fighting';
        this.glyphGlow.setAlpha(0.4);
        this.volleyAt = this.scene.time.now + 1600;
        this.sweepAt = this.scene.time.now + BOSS4.sweepPeriodMs;
        this.weakIndex = Phaser.Math.Between(0, BOSS4.symbolCount - 1);
        bus.emit(EVT.bossSpawn, { name: 'THE HARVEST PATTERN', hp: this.hp, max: BOSS4.hp });
        bus.emit(EVT.toast, { text: 'READ THE GLYPH — STRIKE THE CORE WHEN THE LIME SYMBOL DIPS DOWN', color: 'orange' });
      },
    });
  }

  /** a scan slows the rotation so the strike window is easy to read (ECHO's gift) */
  onScanned(): void {
    if (this.state !== 'fighting') return;
    this.slowUntil = this.scene.time.now + BOSS4.scanSlowMs;
    this.deps.fx.floatText(this.cx, this.cy - 22, 'PATTERN READ', P.scoutCameron);
    this.glyphGlow.setTint(P.scoutCameron);
  }

  /** a player pulse reached the exposed core — only lands during the strike window */
  hitCore(amount = 1): void {
    if (this.state !== 'fighting' || !this.exposed) return;
    this.hp -= amount;
    this.staggerUntil = this.scene.time.now + BOSS4.staggerMs;
    this.glyph.setTintFill(0xffffff);
    this.core.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      this.glyph.clearTint();
      this.core.clearTint();
    });
    this.deps.fx.explode(this.core.x, this.core.y, P.cropGlow, 10);
    this.deps.fx.shake(0.006, 140);
    audio.enemyHit();
    // the weak symbol jumps to a NEW spoke — re-read the pattern
    this.weakIndex = (this.weakIndex + Phaser.Math.Between(1, BOSS4.symbolCount - 1)) % BOSS4.symbolCount;
    this.setExposed(false);
    bus.emit(EVT.bossHp, { hp: Math.max(0, this.hp), max: BOSS4.hp });
    if (this.hp <= 0) this.die();
  }

  /** Test API: force a strike window and apply damage */
  debugDamage(amount: number): void {
    if (this.state !== 'fighting') return;
    for (let i = 0; i < amount && this.state === 'fighting'; i++) {
      this.setExposed(true);
      this.hitCore();
    }
  }

  private setExposed(on: boolean): void {
    this.exposed = on;
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = on;
    this.core.setAlpha(on ? 1 : 0);
    this.coreGlow.setAlpha(on ? 0.9 : 0);
  }

  update(dtSec: number): void {
    if (this.state !== 'fighting') return;
    const now = this.scene.time.now;
    const staggered = now < this.staggerUntil;

    // rotate — slowed by a recent scan, raging at low HP
    const slow = now < this.slowUntil;
    const mul = staggered ? 0 : slow ? 0.35 : this.raging ? BOSS4.spinRageMul : 1;
    this.spin += dtSec * Phaser.Math.DegToRad(BOSS4.spinDegPerSec) * mul;
    this.glyph.setRotation(this.spin);
    if (!slow) this.glyphGlow.setTint(this.raging ? P.orchardLightRed : P.orchardLightPurple);
    this.glyphGlow.setAlpha(0.3 + Math.abs(Math.sin(now * 0.004)) * 0.2);

    // the WEAK symbol orbits; the core opens while it dips toward the floor (down)
    const n = BOSS4.symbolCount;
    const weakAngle = this.spin + (this.weakIndex / n) * Math.PI * 2;
    const mx = this.cx + Math.cos(weakAngle) * RING_R;
    const my = this.cy + Math.sin(weakAngle) * RING_R;
    const diff = Math.abs(Phaser.Math.Angle.Wrap(weakAngle - Math.PI / 2));
    const aligned = !staggered && diff < Phaser.Math.DegToRad(BOSS4.alignWindowDeg);
    this.marker.setPosition(mx, my).setAlpha(aligned ? 1 : 0.5 + Math.sin(now * 0.02) * 0.2).setScale(aligned ? 1.5 : 1.0);

    if (aligned !== this.exposed) this.setExposed(aligned);
    if (aligned) {
      this.glyph.setTint(P.cropGlow);
      this.coreGlow.setAlpha(0.6 + Math.sin(now * 0.03) * 0.3);
      if (now > this.strikeFloatAt) {
        this.strikeFloatAt = now + 700;
        this.deps.fx.floatText(this.cx, this.cy - 24, 'STRIKE', P.cropGlow);
      }
    } else if (!staggered) {
      this.glyph.clearTint();
    }

    if (staggered) return;

    // telegraphed radial volley (never fires during a strike window — fair)
    if (!this.telegraphing && !aligned && now >= this.volleyAt) {
      this.telegraphing = true;
      this.telegraphUntil = now + BOSS4.volleyTelegraphMs;
      this.deps.fx.floatText(this.cx, this.cy - 20, 'HARVEST', P.orchardLightRed);
    } else if (this.telegraphing && now >= this.telegraphUntil) {
      this.telegraphing = false;
      this.volley();
      this.volleyAt = now + BOSS4.volleyPeriodMs;
    }

    // low-HP: the maze closes in — telegraphed harvest sweeps
    if (this.raging) this.updateSweep(now);
  }

  private volley(): void {
    audio.hazardZap();
    this.deps.fx.sparks(this.cx, this.cy, P.orchardLightRed, 8);
    const n = BOSS4.symbolCount;
    const base = this.spin;
    for (let i = 0; i < n; i++) {
      const a = base + (i / n) * Math.PI * 2;
      this.deps.fireSymbol(this.cx, this.cy, Math.cos(a) * BOSS4.symbolSpeed, Math.sin(a) * BOSS4.symbolSpeed);
    }
  }

  private updateSweep(now: number): void {
    const p = this.deps.getPlayer();
    if (this.sweep === 'idle') {
      if (now < this.sweepAt) return;
      this.sweep = 'telegraph';
      this.sweepUntil = now + BOSS4.sweepTelegraphMs;
      this.sweepFromLeft = p.x < this.cx; // scythes toward the player's side
      this.sweepBar.setTint(P.warning);
    } else if (this.sweep === 'telegraph') {
      const startX = this.sweepFromLeft ? this.arenaLeft + 8 : this.arenaRight - 8;
      this.sweepBar.setPosition(startX, this.floorY).setAlpha(0.2 + Math.abs(Math.sin(now * 0.02)) * 0.2);
      if (now >= this.sweepUntil) {
        this.sweep = 'active';
        this.sweepUntil = now + BOSS4.sweepActiveMs;
        this.sweepBar.setTint(P.danger).setAlpha(0.8);
        audio.hazardZap();
      }
    } else {
      const t = 1 - (this.sweepUntil - now) / BOSS4.sweepActiveMs;
      const x = this.sweepFromLeft
        ? this.arenaLeft + 8 + (this.arenaRight - this.arenaLeft - 16) * t
        : this.arenaRight - 8 - (this.arenaRight - this.arenaLeft - 16) * t;
      this.sweepBar.setPosition(x, this.floorY);
      if (p.alive && Math.abs(p.x - x) < BOSS4.sweepHalfWidth) this.deps.damagePlayer(BOSS4.sweepDamage, x);
      if (now >= this.sweepUntil) {
        this.sweep = 'idle';
        this.sweepAt = now + BOSS4.sweepPeriodMs;
        this.sweepBar.setAlpha(0);
      }
    }
  }

  private die(): void {
    this.state = 'dying';
    this.setExposed(false);
    this.sweepBar.setAlpha(0);
    this.marker.setAlpha(0);
    audio.explode();
    this.deps.fx.staticBurst(700);
    this.deps.fx.shake(0.01, 600);
    for (let i = 0; i < 6; i++) {
      this.scene.time.delayedCall(i * 130, () => {
        this.deps.fx.explode(this.cx + Phaser.Math.Between(-20, 20), this.cy + Phaser.Math.Between(-16, 16), i % 2 ? P.cropGlow : P.orchardLightPurple, 12);
        audio.enemyHit();
      });
    }
    this.scene.time.delayedCall(820, () => {
      this.deps.fx.explode(this.cx, this.cy, P.white, 24);
      this.deps.fx.flash(P.white, 180);
      audio.explode();
      [this.glyph, this.glyphGlow, this.coreGlow, this.core, this.marker, this.sweepBar].forEach((p) => p.destroy());
      this.state = 'dead';
      bus.emit(EVT.bossDead, {});
      this.deps.onDefeated();
    });
  }

  destroy(): void {
    [this.glyph, this.glyphGlow, this.coreGlow, this.core, this.marker, this.sweepBar].forEach((p) => p?.destroy());
  }
}
