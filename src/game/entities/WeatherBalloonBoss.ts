/**
 * THE WEATHER BALLOON — Chagrin Falls High (Zone 3) boss.
 * The classic UFO cover story made real: a bobbing "weather balloon" over the
 * fifty-yard line. It floats high and VENTS scanner drones from inside while an
 * armored skin keeps its core safe + a spotlight slams the field. Clear the
 * drones and it DEFLATES — sinking into a thrashing tangle that finally exposes
 * its valve core for a window. Pop the drones, then hit the valve. Repeat.
 *
 * Mirrors the VacancySignBoss / ScarecrowAntennaBoss lifecycle (dormant → rising
 * → fighting → dying → dead) so the scene wiring (arena walls + core overlap +
 * onScanned/hitCore/debugDamage) is identical to Zones 1–2.
 */
import Phaser from 'phaser';
import { BOSS3, EVT, PALETTE as P, TILE, TEX } from '../config';
import { audio } from '../systems/AudioSystem';
import { bus } from '../systems/EventBus';
import type { EffectsSystem } from '../systems/EffectsSystem';

export interface WeatherBalloonDeps {
  fx: EffectsSystem;
  /** vent `count` drones from inside the balloon at (x, y) */
  summonDrones: (count: number, x: number, y: number) => void;
  /** how many vented drones are still alive (the scene tracks them) */
  dronesAlive: () => number;
  damagePlayer: (amount: number, fromX: number) => void;
  getPlayer: () => { x: number; y: number; alive: boolean };
  onDefeated: () => void;
}

type BossState = 'dormant' | 'rising' | 'fighting' | 'dying' | 'dead';
type Mode = 'inflated' | 'deflating';
type Spot = 'idle' | 'telegraph' | 'slam';

export class WeatherBalloonBoss {
  state: BossState = 'dormant';
  hp = BOSS3.hp;
  exposed = false;

  core: Phaser.Physics.Arcade.Image;
  private scene: Phaser.Scene;
  private deps: WeatherBalloonDeps;
  private body: Phaser.GameObjects.Image;
  private tangle: Phaser.GameObjects.Image;
  private bodyGlow: Phaser.GameObjects.Image;
  private coreGlow: Phaser.GameObjects.Image;
  private spotlight: Phaser.GameObjects.Image;
  private readonly cx: number;
  private readonly floorY: number;
  private readonly arenaLeft: number;
  private readonly arenaRight: number;
  private readonly inflatedY: number;
  private readonly deflatedY: number;

  private mode: Mode = 'inflated';
  private bobPhase = 0;
  private deflateUntil = 0;
  private reinflateAt = 0;
  private staggerUntil = 0;
  private wave = 0;
  private waveVented = false;
  // spotlight slam
  private spot: Spot = 'idle';
  private spotAt = 0;
  private spotUntil = 0;
  private spotX = 0;

  constructor(scene: Phaser.Scene, x: number, floorY: number, arenaLeft: number, arenaRight: number, deps: WeatherBalloonDeps) {
    this.scene = scene;
    this.deps = deps;
    this.cx = x;
    this.floorY = floorY;
    this.arenaLeft = arenaLeft;
    this.arenaRight = arenaRight;
    this.inflatedY = floorY - 5 * TILE; // floats high (out of a level shot's reach)
    this.deflatedY = floorY - 2 * TILE; // sinks near the turf when it deflates

    this.bodyGlow = scene.add
      .image(x, this.inflatedY, TEX.glow8)
      .setScale(9)
      .setTint(P.nightBloom)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(13);
    this.tangle = scene.add.image(x, this.inflatedY, TEX.wbDeflate).setDepth(15).setAlpha(0);
    this.body = scene.add.image(x, this.inflatedY, TEX.wbBody).setDepth(16).setAlpha(0);

    // valve core hangs under the balloon; it only comes into a level shot's reach
    // once the balloon deflates and sinks toward the field.
    this.coreGlow = scene.add
      .image(x, this.inflatedY + 16, TEX.glow8)
      .setScale(3)
      .setTint(P.scoreboardKnown)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(16);
    this.core = scene.physics.add.staticImage(x, this.inflatedY + 16, TEX.wbValve).setDepth(17);
    (this.core.body as Phaser.Physics.Arcade.StaticBody).setCircle(10, -4, -4);
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.core.setAlpha(0);

    // telegraphed spotlight column (a tall vertical beam from the balloon to the turf)
    this.spotlight = scene.add
      .image(x, floorY - 3 * TILE, TEX.wbSpotlight)
      .setOrigin(0.5, 1)
      .setDepth(12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
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
    const parts = [this.body, this.bodyGlow];
    parts.forEach((p) => {
      p.setAlpha(p === this.bodyGlow ? 0 : 1);
      p.y += rise;
    });
    this.scene.tweens.add({
      targets: parts,
      y: `-=${rise}`,
      duration: 1000,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.state = 'fighting';
        this.bodyGlow.setAlpha(0.4);
        this.spotAt = this.scene.time.now + 1800;
        this.enterInflated();
        bus.emit(EVT.bossSpawn, { name: 'THE WEATHER BALLOON', hp: this.hp, max: BOSS3.hp });
      },
    });
  }

  /** inflated: armored, floats high, vents a fresh wave of drones */
  private enterInflated(): void {
    this.mode = 'inflated';
    this.exposed = false;
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.core.setAlpha(0);
    this.coreGlow.setAlpha(0);
    this.tangle.setAlpha(0);
    this.body.setAlpha(1);
    this.waveVented = false;
    this.wave++;
  }

  /** deflating: sinks toward the turf, thrashing, valve core exposed */
  private enterDeflate(ms = BOSS3.deflateExposeMs): void {
    this.mode = 'deflating';
    this.exposed = true;
    this.deflateUntil = this.scene.time.now + ms;
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = true;
    this.core.setAlpha(1);
    this.coreGlow.setAlpha(0.9);
    this.body.setAlpha(0);
    this.tangle.setAlpha(1);
    this.deps.fx.floatText(this.cx, this.inflatedY - 14, 'VALVE EXPOSED', P.scoreboardKnown);
    this.deps.fx.staticBurst(260);
    audio.bossStagger();
    // sink the balloon so the valve drops into a level shot's reach
    this.scene.tweens.add({ targets: [this.tangle, this.bodyGlow], y: this.deflatedY, duration: 420, ease: 'Sine.easeIn' });
  }

  /** a scan pulse on the balloon while it's deflating pops the valve open longer */
  onScanned(): void {
    if (this.state !== 'fighting' || this.mode !== 'deflating') return;
    this.deflateUntil = Math.max(this.deflateUntil, this.scene.time.now + 900);
    this.coreGlow.setTint(P.white);
  }

  /** a player bolt reached the exposed valve */
  hitCore(amount = 1): void {
    if (this.state !== 'fighting' || !this.exposed) return;
    this.hp -= amount;
    this.staggerUntil = this.scene.time.now + BOSS3.staggerMs;
    this.tangle.setTintFill(0xffffff);
    this.core.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => {
      this.tangle.clearTint();
      this.core.clearTint();
      this.coreGlow.setTint(P.scoreboardKnown);
    });
    this.deps.fx.explode(this.core.x, this.core.y, P.scoreboardKnown, 8);
    this.deps.fx.shake(0.005, 120);
    audio.enemyHit();
    bus.emit(EVT.bossHp, { hp: Math.max(0, this.hp), max: BOSS3.hp });
    if (this.hp <= 0) {
      this.die();
      return;
    }
    // popped early — snap shut and re-inflate with a fresh wave
    if (this.hp > 0) {
      this.reinflateAt = this.scene.time.now + 260;
      this.exposed = false;
      (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    }
  }

  /** Test API: force-expose and apply damage regardless of the drone gate */
  debugDamage(amount: number): void {
    if (this.state !== 'fighting') return;
    this.mode = 'deflating';
    this.exposed = true;
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = true;
    for (let i = 0; i < amount && this.state === 'fighting'; i++) {
      this.exposed = true;
      (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = true;
      this.hitCore();
    }
  }

  update(dtSec: number): void {
    if (this.state !== 'fighting') return;
    const now = this.scene.time.now;
    const player = this.deps.getPlayer();
    const staggered = now < this.staggerUntil;

    if (this.mode === 'inflated') {
      // bob high overhead
      this.bobPhase += dtSec * ((Math.PI * 2) / (BOSS3.bobPeriodMs / 1000));
      const y = this.inflatedY + Math.sin(this.bobPhase) * BOSS3.bobAmp;
      this.body.setPosition(this.cx, y);
      this.bodyGlow.setPosition(this.cx, y).setAlpha(0.3 + Math.abs(Math.sin(now * 0.004)) * 0.25);

      // vent a wave of drones once per inflate
      if (!this.waveVented) {
        this.waveVented = true;
        this.scene.time.delayedCall(500, () => {
          if (this.state !== 'fighting' || this.mode !== 'inflated') return;
          this.deps.summonDrones(BOSS3.ventDroneCount, this.cx, y + 8);
          this.deps.fx.floatText(this.cx, this.inflatedY - 20, 'VENTING', P.warning);
          this.deps.fx.sparks(this.cx, y + 10, P.warning, 10);
          audio.hazardZap();
        });
      }
      // deflate once the vented drones are cleared
      else if (this.deps.dronesAlive() === 0) {
        this.enterDeflate();
      }

      if (!staggered) this.updateSpotlight(now, player);
    } else {
      // deflating: valve exposed; thrash near the turf
      this.tangle.setPosition(this.cx + Math.sin(now * 0.03) * 3, this.deflatedY + Math.sin(now * 0.05) * 2);
      this.core.setPosition(this.cx, this.deflatedY + 14);
      this.coreGlow.setPosition(this.cx, this.deflatedY + 14).setAlpha(this.exposed ? 0.7 + Math.sin(now * 0.02) * 0.3 : 0);

      if (this.reinflateAt && now >= this.reinflateAt) {
        this.reinflateAt = 0;
        this.rise();
      } else if (this.exposed && now > this.deflateUntil) {
        // survived the window — re-inflate and vent again
        this.rise();
      }
    }
  }

  /** float the balloon back up and start a fresh inflated wave */
  private rise(): void {
    if (this.state !== 'fighting') return;
    this.body.setAlpha(1).setPosition(this.cx, this.deflatedY);
    this.tangle.setAlpha(0);
    this.scene.tweens.add({
      targets: [this.body, this.bodyGlow],
      y: this.inflatedY,
      duration: 460,
      ease: 'Sine.easeOut',
      onComplete: () => this.enterInflated(),
    });
    this.exposed = false;
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.core.setAlpha(0);
    this.coreGlow.setAlpha(0);
  }

  private updateSpotlight(now: number, player: { x: number; y: number; alive: boolean }): void {
    if (this.spot === 'idle') {
      if (now < this.spotAt) return;
      this.spot = 'telegraph';
      this.spotUntil = now + BOSS3.spotlightTelegraphMs;
      this.spotX = Phaser.Math.Clamp(player.x, this.arenaLeft + 10, this.arenaRight - 10);
      this.spotlight.setPosition(this.spotX, this.floorY).setAlpha(0.18);
    } else if (this.spot === 'telegraph') {
      this.spotlight.setAlpha(0.18 + Math.abs(Math.sin(now * 0.02)) * 0.12);
      if (now >= this.spotUntil) {
        this.spot = 'slam';
        this.spotUntil = now + 150;
        this.spotlight.setAlpha(0.85);
        this.deps.fx.shake(0.004, 120);
        audio.hazardZap();
      }
    } else {
      // slam — a lit column; catches anyone standing under it
      if (player.alive && Math.abs(player.x - this.spotX) < BOSS3.spotlightHalfWidth) {
        this.deps.damagePlayer(BOSS3.spotlightDamage, this.spotX);
      }
      if (now >= this.spotUntil) {
        this.spot = 'idle';
        this.spotAt = now + BOSS3.spotlightPeriodMs;
        this.spotlight.setAlpha(0);
      }
    }
  }

  private die(): void {
    this.state = 'dying';
    this.exposed = false;
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.spotlight.setAlpha(0);
    audio.explode();
    this.deps.fx.staticBurst(700);
    this.deps.fx.shake(0.01, 600);
    for (let i = 0; i < 6; i++) {
      this.scene.time.delayedCall(i * 130, () => {
        this.deps.fx.explode(this.cx + Phaser.Math.Between(-22, 22), this.deflatedY + Phaser.Math.Between(-10, 10), i % 2 ? P.nightBloom : P.scoreboardKnown, 12);
        audio.enemyHit();
      });
    }
    this.scene.time.delayedCall(820, () => {
      this.deps.fx.explode(this.cx, this.deflatedY, P.white, 24);
      this.deps.fx.flash(P.white, 180);
      audio.explode();
      [this.body, this.tangle, this.bodyGlow, this.coreGlow, this.core, this.spotlight].forEach((p) => p.destroy());
      this.state = 'dead';
      bus.emit(EVT.bossDead, {});
      this.deps.onDefeated();
    });
  }

  destroy(): void {
    [this.body, this.tangle, this.bodyGlow, this.coreGlow, this.core, this.spotlight].forEach((p) => p?.destroy());
  }
}
