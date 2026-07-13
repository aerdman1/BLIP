/**
 * THE LISTENING STATION — Zone 5 (finale) boss == "The Thing People Thought
 * They Saw". The observatory iris opens like an eye and becomes a rumor-static
 * MIRROR: it COPIES your last-used frequency (activeSkin()) and tints itself to
 * match. While it wears your face it is invulnerable. To wound it you REFUSE the
 * label — swap to a DIFFERENT frequency [1-5] — and then SCAN [Q] to jam the iris
 * open, exposing the pupil-core for a window; pulse the pupil to hit it. It keeps
 * re-reading you, so you must keep swapping + scanning.
 *
 * Mirrors the shared boss lifecycle (dormant → rising → fighting → dying → dead)
 * so the scene wiring (core overlap + onScanned/hitCore/debugDamage + bossSpawn/
 * bossHp/bossDead) matches Zones 1-4.
 */
import Phaser from 'phaser';
import { BOSS5, EVT, PALETTE as P, TEX, TILE, css } from '../config';
import { audio } from '../systems/AudioSystem';
import { bus } from '../systems/EventBus';
import { activeSkin } from '../systems/SkinState';
import type { EffectsSystem } from '../systems/EffectsSystem';

// local tuning (kept out of config.ts to avoid a merge conflict with the
// concurrent config edit) — the beam's amber "about to fire" telegraph window.
const BEAM_WARN_MS = 520;

export interface ListeningStationDeps {
  fx: EffectsSystem;
  damagePlayer: (amount: number, fromX: number) => void;
  getPlayer: () => { x: number; y: number; alive: boolean };
  onDefeated: () => void;
}

type BossState = 'dormant' | 'rising' | 'fighting' | 'dying' | 'dead';

export class ListeningStationBoss {
  state: BossState = 'dormant';
  hp = BOSS5.hp;
  exposed = false;
  telegraphing = false;

  core: Phaser.Physics.Arcade.Image;
  private scene: Phaser.Scene;
  private deps: ListeningStationDeps;
  private iris: Phaser.GameObjects.Image;
  private irisRim: Phaser.GameObjects.Image;
  private beam: Phaser.GameObjects.Image;
  private exposeRing: Phaser.GameObjects.Image; // green "HIT IT" halo over the exposed pupil
  private label: Phaser.GameObjects.Text; // live per-phase instruction floating over the eye
  private lastLabel = '';
  private readonly cx: number;
  private readonly cy: number;

  private copiedId = 'contact47';
  private copiedColor: number = P.white;
  private copyAt = 0;
  private beamAngle = 0;
  private beamOn = false;
  private beamToggleAt = 0;
  private beamLiveAt = 0; // beam is only DAMAGING after its amber telegraph elapses
  private exposeUntil = 0;
  private staggerUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, deps: ListeningStationDeps) {
    this.scene = scene;
    this.deps = deps;
    this.cx = x;
    this.cy = y - 2 * TILE;

    this.iris = scene.add.image(this.cx, this.cy, TEX.glow8).setScale(9).setTint(P.white).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(13);
    this.irisRim = scene.add.image(this.cx, this.cy, TEX.ring ?? TEX.glow8).setScale(2.4).setTint(P.white).setAlpha(0).setDepth(14);
    this.beam = scene.add.image(this.cx, this.cy, TEX.px).setOrigin(0, 0.5).setDisplaySize(BOSS5.beamLength, BOSS5.beamHalfWidth * 2).setTint(P.danger).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(12);

    this.core = scene.physics.add.staticImage(this.cx, this.cy, TEX.glow8).setScale(2).setTint(P.white).setDepth(17);
    (this.core.body as Phaser.Physics.Arcade.StaticBody).setSize(26, 26);
    (this.core.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.core.setAlpha(0);

    // green "target" halo — only shown while the pupil is exposed & hittable
    this.exposeRing = scene.add
      .image(this.cx, this.cy, TEX.ring ?? TEX.glow8)
      .setScale(3.4)
      .setTint(P.signal)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(16)
      .setAlpha(0);

    // per-phase instruction, pinned above the eye so "what to do RIGHT NOW" is
    // always legible without hunting the HUD
    this.label = scene.add
      .text(this.cx, this.cy - 40, '', { fontFamily: 'monospace', fontSize: '8px', color: css(P.warning), fontStyle: 'bold', align: 'center' })
      .setOrigin(0.5)
      .setDepth(20)
      .setResolution(2)
      .setAlpha(0);
  }

  private setPrompt(text: string, color: number): void {
    if (text !== this.lastLabel) {
      this.lastLabel = text;
      this.label.setText(text);
    }
    this.label.setColor(css(color)).setAlpha(1);
  }

  get alive(): boolean {
    return this.state === 'fighting' || this.state === 'rising';
  }

  spawn(): void {
    if (this.state !== 'dormant') return;
    this.state = 'rising';
    audio.bossWarning();
    this.deps.fx.shake(0.008, 500);
    this.deps.fx.staticBurst(600);
    this.iris.setAlpha(0.6).setScale(0.5);
    this.irisRim.setAlpha(0.8);
    this.scene.tweens.add({
      targets: this.iris,
      scale: 9,
      alpha: 0.5,
      duration: 900,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.state = 'fighting';
        this.copyFrequency();
        this.copyAt = this.scene.time.now + 2600;
        this.beamToggleAt = this.scene.time.now + BOSS5.beamOnMs;
        this.beamOn = true;
        bus.emit(EVT.bossSpawn, { name: 'THE LISTENING STATION', hp: this.hp, max: BOSS5.hp });
        bus.emit(EVT.toast, { text: 'IT WEARS YOUR FACE — REFUSE THE LABEL: SWAP FREQUENCY [1-5], THEN SCAN [Q]', color: 'orange' });
      },
    });
  }

  /** the eye reads you and becomes your frequency — now invulnerable to that label */
  private copyFrequency(): void {
    const sk = activeSkin();
    this.copiedId = sk.id;
    this.copiedColor = sk.color;
    this.iris.setTint(sk.color);
    this.irisRim.setTint(sk.color);
    this.deps.fx.floatText(this.cx, this.cy - 26, `CLASSIFIED: ${sk.name}`, sk.color);
  }

  /** SCAN jams the iris — but ONLY if you're no longer the frequency it copied */
  onScanned(): void {
    if (this.state !== 'fighting') return;
    if (activeSkin().id === this.copiedId) {
      this.deps.fx.floatText(this.cx, this.cy - 26, 'IT IS STILL YOU', P.danger);
      return;
    }
    this.exposeUntil = this.scene.time.now + BOSS5.coreExposeMs;
    this.setExposed(true);
    this.deps.fx.floatText(this.cx, this.cy - 26, 'LABEL REFUSED — IRIS JAMMED', P.signal);
    this.deps.fx.flash(P.signal, 90);
  }

  hitCore(amount = 1): void {
    if (this.state !== 'fighting' || !this.exposed) return;
    this.hp -= amount;
    this.staggerUntil = this.scene.time.now + BOSS5.staggerMs;
    this.core.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.core.setTint(P.white));
    this.deps.fx.explode(this.core.x, this.core.y, P.signal, 12);
    this.deps.fx.shake(0.006, 140);
    audio.enemyHit();
    bus.emit(EVT.bossHp, { hp: Math.max(0, this.hp), max: BOSS5.hp });
    if (this.hp <= 0) this.die();
  }

  /** Test API: force the exposure + damage (bypasses the refuse+scan gate) */
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
  }

  update(dtSec: number): void {
    if (this.state !== 'fighting') return;
    const now = this.scene.time.now;

    // the exposure window closes on its own
    if (this.exposed && now > this.exposeUntil) this.setExposed(false);

    // re-read the player's frequency on a cadence (unless jammed open right now)
    if (!this.exposed && now >= this.copyAt) {
      this.copyFrequency();
      this.copyAt = now + 2600;
    }

    this.iris.setScale(9 + Math.sin(now * 0.004) * 0.4).setAlpha(this.exposed ? 0.25 : 0.5);

    // exposed pupil telegraph — bright green pulsing halo says "HIT IT NOW"
    if (this.exposed) {
      this.exposeRing.setAlpha(0.55 + Math.sin(now * 0.02) * 0.3).setScale(3.0 + Math.sin(now * 0.02) * 0.5);
    } else {
      this.exposeRing.setAlpha(0);
    }

    // sweeping eye-beam: OFF (gap) → WARN (amber telegraph) → LIVE (damaging).
    const staggered = now < this.staggerUntil;
    if (now >= this.beamToggleAt) {
      this.beamOn = !this.beamOn;
      this.beamToggleAt = now + (this.beamOn ? BOSS5.beamOnMs : BOSS5.beamGapMs);
      if (this.beamOn) this.beamLiveAt = now + BEAM_WARN_MS; // amber wind-up before it bites
    }
    this.beamAngle += dtSec * Phaser.Math.DegToRad(BOSS5.beamSpinDegPerSec);
    const warning = this.beamOn && now < this.beamLiveAt;
    const live = this.beamOn && !warning && !staggered && !this.exposed;
    // amber + thin while telegraphing, hot red when live, dark in the gap
    this.beam
      .setRotation(this.beamAngle)
      .setTint(warning ? P.warning : P.danger)
      .setAlpha(live ? 0.85 : warning ? 0.3 + (Math.sin(now * 0.04) > 0 ? 0.15 : 0) : 0);

    if (live) {
      const p = this.deps.getPlayer();
      const ex = this.cx + Math.cos(this.beamAngle) * BOSS5.beamLength;
      const ey = this.cy + Math.sin(this.beamAngle) * BOSS5.beamLength;
      if (p.alive && this.distToSegment(p.x, p.y, this.cx, this.cy, ex, ey) < BOSS5.beamHalfWidth + 5) {
        this.deps.damagePlayer(BOSS5.touchDamage, this.cx);
      }
    }

    // per-phase instruction over the eye — the win condition, always on screen
    if (this.exposed) this.setPrompt('PUPIL OPEN — PULSE [X] IT!', P.signal);
    else if (activeSkin().id !== this.copiedId) this.setPrompt('LABEL REFUSED — SCAN [Q] TO JAM', P.poolShimmer);
    else this.setPrompt('IT WEARS YOUR FACE\nSWAP FREQUENCY [1-5]', P.warning);
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  private die(): void {
    this.state = 'dying';
    this.setExposed(false);
    this.beam.setAlpha(0);
    this.exposeRing.setAlpha(0);
    this.label.setAlpha(0);
    audio.explode();
    this.deps.fx.staticBurst(800);
    this.deps.fx.shake(0.012, 700);
    for (let i = 0; i < 7; i++) {
      this.scene.time.delayedCall(i * 130, () => {
        this.deps.fx.explode(this.cx + Phaser.Math.Between(-24, 24), this.cy + Phaser.Math.Between(-20, 20), i % 2 ? P.signal : this.copiedColor, 12);
        audio.enemyHit();
      });
    }
    this.scene.time.delayedCall(940, () => {
      this.deps.fx.explode(this.cx, this.cy, P.white, 28);
      this.deps.fx.flash(P.white, 220);
      audio.explode();
      [this.iris, this.irisRim, this.beam, this.core, this.exposeRing, this.label].forEach((o) => o.destroy());
      this.state = 'dead';
      bus.emit(EVT.bossDead, {});
      this.deps.onDefeated();
    });
  }

  destroy(): void {
    [this.iris, this.irisRim, this.beam, this.core, this.exposeRing, this.label].forEach((o) => o?.destroy());
  }
}
