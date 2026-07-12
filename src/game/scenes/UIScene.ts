/**
 * UIScene — the in-world pixel HUD (zoom-1 layer, unaffected by the Sweep's
 * camera zoom). Two modes:
 *  • Side-view: the compact gauge cluster (hp pips, energy, cooldown pips).
 *  • Top-down "Sweep": a full integrated combat HUD (HP, weapon, objective/
 *    wave, enemies-left, combo, Signal Overdrive [E] meter, ability prompts,
 *    big centred banner) driven by EVT.hudSweep / hudSweepStats / hudBanner.
 * Everything with prose (objective text, toasts, boss name) still lives in the
 * HTML shell.
 */
import Phaser from 'phaser';
import { EVT, PALETTE as P, PLAYER, RENDER_ZOOM, SCENES, VIEW_H, VIEW_W, css } from '../config';
import { bus } from '../systems/EventBus';

interface SweepStats {
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
  private txtWeapon!: Phaser.GameObjects.Text;
  private txtObjective!: Phaser.GameObjects.Text;
  private txtEnemies!: Phaser.GameObjects.Text;
  private txtCombo!: Phaser.GameObjects.Text;
  private txtOd!: Phaser.GameObjects.Text;
  private txtPrompts!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private sweepHudEl: HTMLElement | null = null;
  private sweepObjectiveEl: HTMLElement | null = null;
  private sweepContactsEl: HTMLElement | null = null;
  private sweepNodeFillEl: HTMLElement | null = null;
  private sweepWeaponEl: HTMLElement | null = null;
  private sweepOverdriveEl: HTMLElement | null = null;
  private sweepOverdriveFillEl: HTMLElement | null = null;
  private sweepPromptsEl: HTMLElement | null = null;
  private sweepBannerEl: HTMLElement | null = null;
  private sweepBannerTimer: number | null = null;
  private stats: SweepStats = {
    heat: 0, node: 0, breachOpen: false, traverse: true, enemies: 0,
    wave: 0, waves: 0, combo: 0, weapon: 'PULSE', overdrive: 0, odReady: false, odActive: false,
  };
  private odPulseT = 0;

  constructor() {
    super(SCENES.ui);
  }

  create(): void {
    this.cameras.main.setZoom(RENDER_ZOOM).centerOn(VIEW_W / 2, VIEW_H / 2);
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

  private buildSweepHud(): void {
    const mono = (size: number, color: number) => ({
      fontFamily: 'monospace',
      fontSize: `${size}px`,
      fontStyle: 'bold' as const,
      color: css(color),
    });
    this.sweepG = this.add.graphics().setDepth(30).setVisible(false);
    this.sweepGlow = this.add.graphics().setDepth(29).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);

    // bottom-left: current weapon
    this.txtWeapon = this.add.text(11, VIEW_H - 16, 'PULSE', mono(8, P.signal)).setDepth(32).setVisible(false);
    // top-center: objective (node charge / wave)
    this.txtObjective = this.add.text(VIEW_W / 2, 7, '', mono(7, P.white)).setOrigin(0.5, 0).setDepth(32).setVisible(false);
    // top-center under objective: enemies remaining
    this.txtEnemies = this.add.text(VIEW_W / 2, 18, '', mono(7, P.uiDim)).setOrigin(0.5, 0).setDepth(32).setVisible(false);
    // top-right: combo
    this.txtCombo = this.add.text(VIEW_W - 10, 8, '', mono(9, P.warning)).setOrigin(1, 0).setDepth(32).setVisible(false);
    // bottom-center: overdrive label
    this.txtOd = this.add.text(VIEW_W / 2, VIEW_H - 20, 'SIGNAL OVERDRIVE  [E]', mono(6, P.uiDim)).setOrigin(0.5, 0).setDepth(32).setVisible(false);
    // bottom-right: ability prompts
    this.txtPrompts = this.add
      .text(VIEW_W - 10, VIEW_H - 15, '[SHIFT] DASH   [Q] SCAN', mono(6, P.uiDim))
      .setOrigin(1, 0)
      .setDepth(32)
      .setVisible(false);
    // center: big combat banner
    this.banner = this.add
      .text(VIEW_W / 2, VIEW_H / 2 - 40, '', { fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: css(P.signal) })
      .setOrigin(0.5)
      .setDepth(34)
      .setAlpha(0)
      .setVisible(false);
  }

  private buildSweepDom(): void {
    const frame = document.getElementById('game-frame');
    if (!frame || this.sweepHudEl) return;
    const el = document.createElement('div');
    el.id = 'sweep-hud-dom';
    el.className = 'hidden';
    el.innerHTML = `
      <div class="sweep-hud-top">
        <div class="sweep-hud-objective">CHARGE THE SIGNAL NODE</div>
        <div class="sweep-hud-contacts">0 CONTACTS LEFT</div>
        <div class="sweep-hud-node"><i></i></div>
      </div>
      <div class="sweep-hud-weapon">PULSE</div>
      <div class="sweep-hud-overdrive">
        <span>SIGNAL OVERDRIVE</span>
        <div><i></i></div>
      </div>
      <div class="sweep-hud-prompts">DASH · SCAN · ECHO</div>
      <div class="sweep-hud-banner"></div>`;
    frame.appendChild(el);
    this.sweepHudEl = el;
    this.sweepObjectiveEl = el.querySelector('.sweep-hud-objective');
    this.sweepContactsEl = el.querySelector('.sweep-hud-contacts');
    this.sweepNodeFillEl = el.querySelector('.sweep-hud-node i');
    this.sweepWeaponEl = el.querySelector('.sweep-hud-weapon');
    this.sweepOverdriveEl = el.querySelector('.sweep-hud-overdrive span');
    this.sweepOverdriveFillEl = el.querySelector('.sweep-hud-overdrive i');
    this.sweepPromptsEl = el.querySelector('.sweep-hud-prompts');
    this.sweepBannerEl = el.querySelector('.sweep-hud-banner');
  }

  private setSweepMode(active: boolean): void {
    this.sweepActive = active;
    for (const o of [this.sweepG, this.sweepGlow]) {
      o.setVisible(active);
    }
    for (const o of [this.txtWeapon, this.txtObjective, this.txtEnemies, this.txtCombo, this.txtOd, this.txtPrompts]) {
      o.setVisible(false);
    }
    this.sweepHudEl?.classList.toggle('hidden', !active);
    if (active) {
      this.bars.clear(); // hide the side-view gauge cluster while in the Sweep
      this.drawSweepHud();
    } else {
      this.sweepG.clear();
      this.sweepGlow.clear();
      this.banner.setAlpha(0).setVisible(false);
      this.hideSweepBanner();
    }
  }

  /** redraw the sweep HUD — event-driven (on stat/hp change), not per frame */
  private drawSweepHud(): void {
    const s = this.stats;
    const g = this.sweepG;
    g.clear();

    // ---- bottom-left: HP pips + weapon plate ----
    const bx = 8;
    const by = VIEW_H - 30;
    g.fillStyle(P.black, 0.5).fillRect(bx - 2, by - 3, 108, 30);
    for (let i = 0; i < this.hpMax; i++) {
      const on = i < this.hp;
      g.fillStyle(on ? P.danger : P.dangerDark, on ? 1 : 0.5);
      g.fillRect(bx + i * 9, by, 7, 6);
    }
    // weapon underline swatch
    g.fillStyle(P.signalDim, 0.9).fillRect(bx + 1, VIEW_H - 6, 96, 1);
    this.txtWeapon.setText(`▸ ${s.weapon}`);
    if (this.sweepWeaponEl) this.sweepWeaponEl.textContent = s.weapon;

    // ---- top-center: objective panel ----
    g.fillStyle(P.black, 0.45).fillRect(VIEW_W / 2 - 66, 4, 132, 24);
    if (s.traverse) {
      // node charge meter
      const w = 120;
      const ox = VIEW_W / 2 - w / 2;
      g.fillStyle(P.signalDim, 0.35).fillRect(ox, 28, w, 3);
      g.fillStyle(s.breachOpen ? P.signal : P.signalGreen, 1).fillRect(ox, 28, Math.round(w * s.node), 3);
      this.txtObjective.setText(s.breachOpen ? 'BREACH OPEN ▸' : 'CHARGE THE SIGNAL NODE');
      this.txtObjective.setColor(css(s.breachOpen ? P.signal : P.white));
      if (this.sweepObjectiveEl) {
        this.sweepObjectiveEl.textContent = s.breachOpen ? 'BREACH OPEN' : 'CHARGE THE SIGNAL NODE';
        this.sweepObjectiveEl.classList.toggle('ready', s.breachOpen);
      }
    } else {
      this.txtObjective.setText(`WAVE ${s.wave} / ${s.waves}`);
      this.txtObjective.setColor(css(P.white));
      if (this.sweepObjectiveEl) {
        this.sweepObjectiveEl.textContent = `WAVE ${s.wave} / ${s.waves}`;
        this.sweepObjectiveEl.classList.remove('ready');
      }
    }
    this.txtEnemies.setText(s.enemies > 0 ? `◦ ${s.enemies} CONTACT${s.enemies === 1 ? '' : 'S'} LEFT` : 'AREA CLEAR');
    this.txtEnemies.setColor(css(s.enemies > 0 ? P.uiDim : P.signalGreen));
    if (this.sweepContactsEl) {
      this.sweepContactsEl.textContent = s.enemies > 0 ? `${s.enemies} CONTACT${s.enemies === 1 ? '' : 'S'} LEFT` : 'AREA CLEAR';
      this.sweepContactsEl.classList.toggle('clear', s.enemies <= 0);
    }
    if (this.sweepNodeFillEl) this.sweepNodeFillEl.style.width = `${Math.round((s.breachOpen ? 1 : s.node) * 100)}%`;

    // ---- top-right: combo ----
    this.txtCombo.setText(s.combo >= 2 ? `x${s.combo}` : '');

    // ---- bottom-center: Signal Overdrive meter ----
    const ow = 130;
    const ox = VIEW_W / 2 - ow / 2;
    const oy = VIEW_H - 11;
    g.fillStyle(P.black, 0.55).fillRect(ox - 2, oy - 2, ow + 4, 7);
    g.fillStyle(P.violetGlitch, 0.28).fillRect(ox, oy, ow, 3);
    const col = s.odActive ? P.signal : s.odReady ? P.neonCyan : P.violetGlitch;
    g.fillStyle(col, 1).fillRect(ox, oy, Math.round(ow * (s.odActive ? 1 : s.overdrive)), 3);
    // segment ticks
    g.fillStyle(P.black, 0.4);
    for (let i = 1; i < 4; i++) g.fillRect(ox + Math.round((ow * i) / 4), oy, 1, 3);
    this.txtOd
      .setText(s.odActive ? 'OVERDRIVE ACTIVE' : s.odReady ? 'SIGNAL OVERDRIVE READY — [E]' : 'SIGNAL OVERDRIVE  [E]')
      .setColor(css(s.odActive ? P.signal : s.odReady ? P.neonCyan : P.uiDim));
    if (this.sweepOverdriveEl) {
      this.sweepOverdriveEl.textContent = s.odActive ? 'OVERDRIVE ACTIVE' : s.odReady ? 'SIGNAL OVERDRIVE READY' : 'SIGNAL OVERDRIVE';
      this.sweepOverdriveEl.classList.toggle('ready', s.odReady || s.odActive);
    }
    if (this.sweepOverdriveFillEl) this.sweepOverdriveFillEl.style.width = `${Math.round((s.odActive ? 1 : s.overdrive) * 100)}%`;
    if (this.sweepPromptsEl) this.sweepPromptsEl.textContent = 'DASH · SCAN · ECHO · FIRE';
  }

  private showBanner(text: string): void {
    if (!this.sweepActive) return;
    if (this.sweepBannerEl) {
      this.sweepBannerEl.textContent = text;
      this.sweepBannerEl.classList.add('on');
      if (this.sweepBannerTimer != null) window.clearTimeout(this.sweepBannerTimer);
      this.sweepBannerTimer = window.setTimeout(() => this.hideSweepBanner(), 1200);
    }
  }

  private hideSweepBanner(): void {
    if (this.sweepBannerTimer != null) {
      window.clearTimeout(this.sweepBannerTimer);
      this.sweepBannerTimer = null;
    }
    this.sweepBannerEl?.classList.remove('on');
  }

  update(_t: number, dt: number): void {
    if (this.sweepActive) {
      // pulse the READY overdrive label so it draws the eye
      if (this.stats.odReady && !this.stats.odActive) {
        this.odPulseT += dt;
        this.txtOd.setAlpha(0.55 + 0.45 * Math.abs(Math.sin(this.odPulseT * 0.006)));
      } else {
        this.txtOd.setAlpha(1);
      }
      return; // sweep HUD is event-driven; skip the side-view gauges
    }

    const g = this.bars;
    g.clear();

    // HP pips
    for (let i = 0; i < PLAYER.maxHp; i++) {
      g.fillStyle(i < this.hp ? P.danger : P.dangerDark, i < this.hp ? 1 : 0.45);
      g.fillRect(8 + i * 9, 8, 7, 5);
    }
    // energy bar (lime)
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
