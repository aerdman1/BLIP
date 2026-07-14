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
import { EVT, HUD_HEALTH, PALETTE as P, PLAYER, RENDER_ZOOM, SCENES, VIEW_H, VIEW_W, css } from '../config';
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
      <div class="sweep-hud-weapon"><span class="cap">WEAPON</span><span class="val">PULSE</span></div>
      <div class="sweep-hud-overdrive">
        <span>SIGNAL OVERDRIVE</span>
        <div><i></i></div>
      </div>
      <div class="sweep-hud-prompts"><span class="cap">CONTROLS</span><span class="val">DASH · SCAN · ECHO</span></div>
      <div class="sweep-hud-banner"></div>`;
    frame.appendChild(el);
    this.sweepHudEl = el;
    this.sweepObjectiveEl = el.querySelector('.sweep-hud-objective');
    this.sweepContactsEl = el.querySelector('.sweep-hud-contacts');
    this.sweepNodeFillEl = el.querySelector('.sweep-hud-node i');
    this.sweepWeaponEl = el.querySelector('.sweep-hud-weapon .val');
    this.sweepOverdriveEl = el.querySelector('.sweep-hud-overdrive span');
    this.sweepOverdriveFillEl = el.querySelector('.sweep-hud-overdrive i');
    this.sweepPromptsEl = el.querySelector('.sweep-hud-prompts .val');
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
    const g = this.sweepG;
    g.clear();

    // ---- bottom-left: integrity (HP) bar + weapon plate ----
    const { x: bx, y: by, segW, segH, gap, iconW } = HUD_HEALTH;
    const barX = bx + iconW + 3; // segments start after the heart icon
    const barW = this.hpMax * segW + (this.hpMax - 1) * gap;
    g.fillStyle(P.black, 0.5).fillRect(bx - 2, by - 6, barW + iconW + 8, 34);

    const ratio = this.hpMax > 0 ? this.hp / this.hpMax : 0;
    const hc = this.healthColor(ratio);
    const hp = this.healthPulse(ratio);

    // leading heart icon (a tiny palette-locked pixel heart reads as "integrity"), tinted to state
    const hy = by;
    g.fillStyle(hc, hp);
    g.fillRect(bx, hy + 1, 3, 3);
    g.fillRect(bx + 4, hy + 1, 3, 3);
    g.fillRect(bx, hy + 2, iconW, 3);
    g.fillRect(bx + 1, hy + 5, iconW - 2, 1);
    g.fillStyle(0xffffff, 0.4).fillRect(bx + 1, hy + 1, 1, 1); // spec highlight

    // recessed track behind the segments, then filled/empty segments
    g.fillStyle(P.black, 0.6).fillRect(barX - 1, by - 1, barW + 2, segH + 2);
    for (let i = 0; i < this.hpMax; i++) {
      const on = i < this.hp;
      const sx = barX + i * (segW + gap);
      if (on) {
        g.fillStyle(hc, hp).fillRect(sx, by, segW, segH);
        g.fillStyle(0xffffff, 0.22).fillRect(sx, by, segW, 1); // top sheen
        g.fillStyle(P.black, 0.35).fillRect(sx, by + segH - 1, segW, 1); // base shade
      } else {
        g.fillStyle(P.black, 0.5).fillRect(sx, by, segW, segH); // empty = recessed, not a red block
        g.fillStyle(P.uiDim, 0.22).fillRect(sx, by, segW, 1);
        g.fillStyle(P.uiDim, 0.18).fillRect(sx, by, 1, segH);
      }
    }
    // weapon underline swatch
    g.fillStyle(P.signalDim, 0.9).fillRect(bx + 1, VIEW_H - 6, 96, 1);
    this.txtWeapon.setText(`▸ ${s.weapon}`);
    if (this.sweepWeaponEl) this.sweepWeaponEl.textContent = s.weapon;

    if (s.traverse) {
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
