/**
 * UIScene — the in-world pixel HUD (zoom-1 layer, unaffected by the Sweep's
 * camera zoom). The live game uses the top-down combat HUD: HP, weapon,
 * objective/wave, enemies-left, combo, Signal Overdrive [E] meter, ability
 * prompts, and a centered banner driven by EVT.hudSweep / hudSweepStats /
 * hudBanner.
 * Everything with prose (objective text, toasts, boss name) still lives in the
 * HTML shell.
 */
import Phaser from 'phaser';
import { EVT, PALETTE as P, PLAYER, RENDER_ZOOM, SCENES, VIEW_H, VIEW_W } from '../config';
import { bus } from '../systems/EventBus';

interface SweepStats {
  region: string;
  objectiveTitle?: string;
  objectiveSub?: string;
  heat: number;
  node: number; // 0..1 node charge (1 when breach open)
  breachOpen: boolean;
  traverse: boolean; // traverse arena (node objective) vs wave arena
  enemies: number;
  wave: number;
  waves: number;
  combo: number;
  weapon: string;
  overdrive: number; // 0..1
  odReady: boolean;
  odActive: boolean;
}

export class UIScene extends Phaser.Scene {
  private bars!: Phaser.GameObjects.Graphics;
  private hp: number = PLAYER.maxHp;
  private hpMax: number = PLAYER.maxHp;
  private energy: number = PLAYER.energyMax;
  private cooldowns = { dash: 0, scan: 0 };
  private unsubs: Array<() => void> = [];

  // --- Sweep combat HUD ---
  private sweepActive = false;
  private sweepG!: Phaser.GameObjects.Graphics;
  private sweepGlow!: Phaser.GameObjects.Graphics;
  private sweepHudEl: HTMLElement | null = null;
  private sweepRegionEl: HTMLElement | null = null;
  private sweepObjectiveEl: HTMLElement | null = null;
  private sweepContactsEl: HTMLElement | null = null;
  private sweepNodeFillEl: HTMLElement | null = null;
  private sweepWeaponEl: HTMLElement | null = null;
  private sweepOverdriveEl: HTMLElement | null = null;
  private sweepOverdriveFillEl: HTMLElement | null = null;
  private sweepHpFillEl: HTMLElement | null = null;
  private sweepBannerEl: HTMLElement | null = null;
  private sweepBannerTimer: number | null = null;
  private sweepBannerQueue: string[] = [];
  private sweepBannerActive = false;
  private lastSweepBannerText = '';
  private lastSweepBannerAt = 0;
  private stats: SweepStats = {
    region: 'Miller Surface', heat: 0, node: 0, breachOpen: false, traverse: true, enemies: 0,
    wave: 0, waves: 0, combo: 0, weapon: 'PULSE', overdrive: 0, odReady: false, odActive: false,
  };
  private odPulseT = 0;

  constructor() {
    super(SCENES.ui);
  }

  /** Map the fixed 480×270 HUD layout space onto whatever the backbuffer is.
   *  SweepScene raises the buffer for HD top-down rendering; without this the
   *  entire HUD would collapse into a corner of the larger canvas. At base
   *  density this is exactly the old `setZoom(RENDER_ZOOM)`. */
  private fitHudCamera = (): void => {
    const cam = this.cameras?.main;
    if (!cam) return;
    cam.setZoom((this.scale.width / VIEW_W) * RENDER_ZOOM).centerOn(VIEW_W / 2, VIEW_H / 2);
  };

  create(): void {
    this.fitHudCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitHudCamera);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitHudCamera)
    );
    this.bars = this.add.graphics().setDepth(10);
    this.buildSweepHud();
    this.buildSweepDom();

    const on = (evt: string, fn: (...args: unknown[]) => void) => this.unsubs.push(bus.on(evt, fn));
    on(EVT.hudHp, (d) => {
      const h = d as { hp: number; max?: number };
      this.hp = h.hp;
      if (typeof h.max === 'number') this.hpMax = h.max;
      if (this.sweepActive) this.drawSweepHud();
    });
    on(EVT.hudEnergy, (d) => {
      this.energy = (d as { energy: number }).energy;
    });
    on(EVT.hudCooldowns, (d) => {
      this.cooldowns = d as { dash: number; scan: number };
    });
    on(EVT.hudSweep, (d) => this.setSweepMode((d as { active: boolean }).active));
    on(EVT.hudSweepStats, (d) => {
      this.stats = d as SweepStats;
      if (this.sweepActive) this.drawSweepHud();
    });
    on(EVT.hudBanner, (d) => this.showBanner((d as { text: string }).text));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
      this.sweepHudEl?.remove();
      this.sweepHudEl = null;
    });
  }

  /* ------------------------------------------------------------------ sweep */

  /** The Sweep HUD is 100% DOM (see buildSweepDom) — readable text rendered by
   *  the browser, never block-scaled by Phaser, and unaffected by the HD
   *  backbuffer. Nothing is drawn in-canvas here any more; the Phaser text
   *  objects that used to live here were created and then permanently hidden. */
  private buildSweepHud(): void {
    this.sweepG = this.add.graphics().setDepth(30).setVisible(false);
    this.sweepGlow = this.add.graphics().setDepth(29).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }

  private buildSweepDom(): void {
    const frame = document.getElementById('game-frame');
    if (!frame || this.sweepHudEl) return;
    const el = document.createElement('div');
    el.id = 'sweep-hud-dom'; // id kept stable — the e2e suite asserts on it
    el.className = 'td-hud hidden';
    // Four panels, one concern each, and nothing permanent that isn't needed.
    // Contextual alerts are transient (the banner) — there is no instruction ticker.
    el.innerHTML = `
      <div class="td-objective">
        <div class="td-region">AREA · MILLER SURFACE</div>
        <div class="td-objective-title">CHARGE THE SIGNAL NODE</div>
        <div class="td-objective-sub">0 contacts left</div>
        <div class="td-objective-bar"><i></i></div>
      </div>
      <div class="td-vitals">
        <div class="td-vitals-chip" aria-hidden="true"></div>
        <div class="td-vitals-body">
          <div class="td-vitals-name">CONTACT-47</div>
          <div class="td-hp"><i></i></div>
          <div class="td-weapon"><span class="cap">1/2/3 WPN</span><span class="val">PULSE CARBINE</span></div>
        </div>
      </div>
      <div class="td-overdrive"><span>SIGNAL OVERDRIVE</span><div><i></i></div></div>
      <div class="td-abilities">
        <span data-k="SHIFT">SHIFT</span><span data-k="Q">SCAN</span>
        <span data-k="1-3">WPN</span><span data-k="E">ECHO</span><span data-k="LMB">FIRE</span>
      </div>
      <div class="sweep-hud-banner"></div>`;
    frame.appendChild(el);
    this.sweepHudEl = el;
    this.sweepRegionEl = el.querySelector('.td-region');
    this.sweepObjectiveEl = el.querySelector('.td-objective-title');
    this.sweepContactsEl = el.querySelector('.td-objective-sub');
    this.sweepNodeFillEl = el.querySelector('.td-objective-bar i');
    this.sweepWeaponEl = el.querySelector('.td-weapon .val');
    this.sweepOverdriveEl = el.querySelector('.td-overdrive span');
    this.sweepOverdriveFillEl = el.querySelector('.td-overdrive i');
    this.sweepHpFillEl = el.querySelector('.td-hp i');
    this.sweepBannerEl = el.querySelector('.sweep-hud-banner');
  }

  private setSweepMode(active: boolean): void {
    this.sweepActive = active;
    this.sweepHudEl?.classList.toggle('hidden', !active);
    // The world should own the screen: suppress the persistent shell chrome
    // (status strip, objective ticker) while the top-down arena is up.
    document.body.classList.toggle('td-hud-active', active);
    if (active) {
      this.bars.clear();
      this.drawSweepHud();
    } else {
      this.sweepG.clear();
      this.sweepGlow.clear();
      this.sweepBannerQueue = [];
      this.hideSweepBanner();
    }
  }

  /** redraw the sweep HUD — event-driven (on stat/hp change), not per frame */
  /** Health reads green (healthy) → amber → red (critical) so a full bar isn't an alarming wall of red. */
  private healthColor(ratio: number): number {
    if (ratio > 0.6) return P.signalGreen;
    if (ratio > 0.3) return P.warning;
    return P.danger;
  }

  /** Gentle brightness pulse when integrity is critical, so danger is felt. */
  private healthPulse(ratio: number): number {
    return ratio <= 0.25 ? 0.55 + 0.45 * Math.abs(Math.sin(this.time.now / 180)) : 1;
  }

  private drawSweepHud(): void {
    const s = this.stats;
    // Nothing is drawn in-canvas: the graphics layers stay cleared so no HUD
    // element is subject to the HD backbuffer's scaling.
    this.sweepG.clear();
    this.sweepGlow.clear();

    // ---- vitals: integrity + weapon ----
    const ratio = this.hpMax > 0 ? this.hp / this.hpMax : 0;
    if (this.sweepHpFillEl) {
      this.sweepHpFillEl.style.width = `${Math.round(ratio * 100)}%`;
      // green (healthy) → amber → red, so a full bar is never an alarming wall of red
      this.sweepHpFillEl.dataset.state = ratio > 0.6 ? 'ok' : ratio > 0.3 ? 'warn' : 'crit';
    }
    if (this.sweepWeaponEl) this.sweepWeaponEl.textContent = s.weapon;

    // ---- objective ----
    if (this.sweepRegionEl) this.sweepRegionEl.textContent = `AREA · ${s.region.toUpperCase()}`;
    if (this.sweepObjectiveEl) {
      this.sweepObjectiveEl.textContent = s.objectiveTitle ?? (s.traverse
        ? s.breachOpen ? 'BREACH OPEN' : 'CHARGE THE SIGNAL NODE'
        : `WAVE ${s.wave} / ${s.waves}`);
      this.sweepObjectiveEl.classList.toggle('ready', s.traverse && s.breachOpen);
    }
    if (this.sweepContactsEl) {
      // sentence case — uppercase is reserved for labels and the objective itself
      this.sweepContactsEl.textContent = s.objectiveSub ?? (
        s.enemies > 0 ? `${s.enemies} contact${s.enemies === 1 ? '' : 's'} left` : 'Area clear'
      );
      this.sweepContactsEl.classList.toggle('clear', s.enemies <= 0);
    }
    if (this.sweepNodeFillEl) this.sweepNodeFillEl.style.width = `${Math.round((s.breachOpen ? 1 : s.node) * 100)}%`;

    // ---- Signal Overdrive: restrained until it matters ----
    if (this.sweepOverdriveEl) {
      this.sweepOverdriveEl.textContent = s.odActive
        ? 'OVERDRIVE ACTIVE'
        : s.odReady ? 'OVERDRIVE READY · E' : 'SIGNAL OVERDRIVE';
      this.sweepOverdriveEl.classList.toggle('ready', s.odReady || s.odActive);
    }
    if (this.sweepOverdriveFillEl) this.sweepOverdriveFillEl.style.width = `${Math.round((s.odActive ? 1 : s.overdrive) * 100)}%`;
  }

  private showBanner(text: string): void {
    if (!this.sweepActive) return;
    const now = performance.now();
    if (text === this.lastSweepBannerText && now - this.lastSweepBannerAt < 1400) return;
    this.lastSweepBannerText = text;
    this.lastSweepBannerAt = now;
    if (this.sweepBannerQueue.length > 3) this.sweepBannerQueue.shift();
    this.sweepBannerQueue.push(text);
    this.pumpSweepBanner();
  }

  private pumpSweepBanner(): void {
    if (!this.sweepActive || this.sweepBannerActive || !this.sweepBannerEl || !this.sweepBannerQueue.length) return;
    const text = this.sweepBannerQueue.shift() as string;
    this.sweepBannerActive = true;
    if (this.sweepBannerEl) {
      this.sweepBannerEl.textContent = text;
      this.sweepBannerEl.classList.add('on');
      if (this.sweepBannerTimer != null) window.clearTimeout(this.sweepBannerTimer);
      this.sweepBannerTimer = window.setTimeout(() => this.hideSweepBanner(), 900);
    }
  }

  private hideSweepBanner(): void {
    if (this.sweepBannerTimer != null) {
      window.clearTimeout(this.sweepBannerTimer);
      this.sweepBannerTimer = null;
    }
    this.sweepBannerEl?.classList.remove('on');
    this.sweepBannerActive = false;
    this.sweepBannerTimer = window.setTimeout(() => {
      this.sweepBannerTimer = null;
      this.pumpSweepBanner();
    }, 180);
  }

  update(_t: number, dt: number): void {
    if (this.sweepActive) {
      // pulse the READY overdrive panel so it draws the eye — CSS drives the
      // look, this just keeps the phase so it breathes rather than blinks.
      if (this.stats.odReady && !this.stats.odActive) {
        this.odPulseT += dt;
        this.sweepOverdriveEl?.style.setProperty(
          '--td-pulse',
          `${0.6 + 0.4 * Math.abs(Math.sin(this.odPulseT * 0.006))}`
        );
      } else {
        this.sweepOverdriveEl?.style.setProperty('--td-pulse', '1');
      }
      return; // top-down HUD is event-driven
    }

    const g = this.bars;
    g.clear();

    // HP pips — same green→amber→red integrity language as the Sweep bar.
    // Use this.hpMax (skin-adjusted effective max from EVT.hudHp), NOT the raw
    // PLAYER.maxHp constant, so ANCHOR (+1 hull) / ROCKET (−1 hull) render right.
    const hpRatio = this.hpMax > 0 ? this.hp / this.hpMax : 0;
    const hc = this.healthColor(hpRatio);
    const hpp = this.healthPulse(hpRatio);
    for (let i = 0; i < this.hpMax; i++) {
      const px = 8 + i * 9;
      if (i < this.hp) {
        g.fillStyle(hc, hpp).fillRect(px, 8, 7, 5);
        g.fillStyle(0xffffff, 0.22).fillRect(px, 8, 7, 1); // top sheen
        g.fillStyle(P.black, 0.35).fillRect(px, 12, 7, 1); // base shade
      } else {
        g.fillStyle(P.black, 0.5).fillRect(px, 8, 7, 5); // empty = recessed
        g.fillStyle(P.uiDim, 0.2).fillRect(px, 8, 7, 1);
      }
    }
    // energy bar (lime) — labelled distinct from health by its lime hue + slimmer track
    g.fillStyle(P.signalDim, 0.4);
    g.fillRect(8, 16, 46, 3);
    g.fillStyle(P.signal, 1);
    g.fillRect(8, 16, Math.round((this.energy / PLAYER.energyMax) * 46), 3);
    // cooldowns: dash (lime) + scan (amber)
    g.fillStyle(this.cooldowns.dash <= 0 ? P.signal : P.uiDim, 1);
    g.fillRect(8, 22, this.cooldowns.dash <= 0 ? 10 : Math.round(10 * (1 - this.cooldowns.dash)), 2);
    g.fillStyle(this.cooldowns.scan <= 0 ? P.warning : P.uiDim, 1);
    g.fillRect(22, 22, this.cooldowns.scan <= 0 ? 10 : Math.round(10 * (1 - this.cooldowns.scan)), 2);
  }
}
