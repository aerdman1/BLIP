/**
 * COMMAND CENTER — the mission-control overlay.
 * Story bible, the Five Signal Scouts, mechanics, controls, progression,
 * zones, player-facing collection/status pages, plus dev-only playbook/QA
 * sections when running a dev build, standalone dashboard, ?test, or god mode.
 */
import './commandCenter.css';
import type Phaser from 'phaser';
import { BOSS, BUILD_VERSION, EVT, PLAYER, PULSE, SCAN, TILE } from '../game/config';
import { GAME_BIBLE } from '../game/data/gameBible';
import {
  BESTIARY_ALL_ENEMIES,
  BESTIARY_ASSET_ROADMAP,
  BESTIARY_HAZARDS,
  BESTIARY_SYSTEMS,
  CONTACT47_SCALE_REF,
  type BestiaryEnemyEntry,
  type BestiaryHazardEntry,
  type BestiaryRoadmapPhase,
  type BestiarySystemEntry,
  type CustomArtInfo,
} from '../game/data/bestiaryData';
// bestiaryExport pulls in JSZip — loaded on demand (see runExportButton) so it
// never ships in the base game bundle for players who never open dev exports.
import { MILLER_FIELD, MOTEL_NOWHERE, NODE_A, PATTERSONS_ORCHARD, POOL_MIRROR, TIGER_STADIUM, cellAt, type LevelDef } from '../game/data/levels';
import { SWEEP_ARENAS, type SweepArena } from '../game/data/sweepArenas';
import { SCOUTS, SCOUT_LOGS } from '../game/data/scouts';
import { FIELD_NOTES } from '../game/data/fieldNotes';
import { SKINS, skinById } from '../game/data/skins';
import { DESIGN_PILLARS, LEVEL_PLANS } from '../game/data/levelPlans';
import { ZONES } from '../game/data/zones';
import { UPGRADES } from '../game/data/upgrades';
import { selectSkin, setProgress } from '../game/systems/SaveSystem';
import { rewards } from '../game/systems/RewardSystem';
import { RARITIES, type RarityId } from '../game/data/rewards';
import { CACHES, CACHE_ORDER } from '../game/data/caches';
import { rewardById } from '../game/data/rewards';
import { trophyById } from '../game/data/trophies';
import { devState } from '../game/systems/DevState';
import {
  ART_DIRECTION,
  BUILD_TODO,
  CONTROLS_BLIPSTREAM,
  CONTROLS_DEBUG,
  CONTROLS_FIELD,
  CONTROLS_GAMEPAD,
  CONTROLS_SWEEP,
  CONTROLS_TOUCH,
  HUMAN_PLAYTEST_CHECKLIST,
  MECHANICS,
  PITCH,
  SUBTITLE,
  TAGLINE,
  WEB_TECH_NOTES,
  type ControlRow,
} from '../game/data/commandCenterData';
import { THE_FIRST_CONTACT } from '../game/data/quests';
import { bus } from '../game/systems/EventBus';
import { getSave, resetSave, saveAsJson } from '../game/systems/SaveSystem';

interface QaStatus {
  status: string;
  lastRun: string | null;
  iteration: number;
  result: string;
  categories: Record<string, string>;
  bugsFound: string[];
  bugsFixed: string[];
  remaining: string[];
  screenshots: string[];
  note?: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const colorHex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

export class CommandCenter {
  private root: HTMLElement;
  private lastScene = 'BootScene';
  private lastZone = 'Boot';
  private lastObjective = THE_FIRST_CONTACT.steps[0].objective;
  private refreshTimer: number | null = null;
  private qa: QaStatus | null = null;
  private readonly standalone: boolean;
  private readonly game?: Phaser.Game;
  private atlasesDrawn = false;

  constructor(root: HTMLElement, opts?: { standalone?: boolean; game?: Phaser.Game }) {
    this.root = root;
    this.standalone = opts?.standalone === true;
    this.game = opts?.game;
    this.buildStatic();
    bus.on(EVT.sceneChanged, (d) => {
      const s = d as { scene: string; zone?: string };
      this.lastScene = s.scene;
      if (s.zone) this.lastZone = s.zone;
    });
    bus.on(EVT.questObjective, (d) => {
      this.lastObjective = (d as { objective: string }).objective;
    });
    bus.on(EVT.saveUpdated, () => {
      if (this.isOpen) this.refresh();
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  open(section?: string): void {
    this.applyDevMode();
    this.root.classList.remove('hidden');
    if (!this.atlasesDrawn) {
      this.atlasesDrawn = true;
      this.drawAtlases();
    }
    this.refresh();
    void this.loadQa();
    this.refreshTimer = window.setInterval(() => this.refresh(), 1200);
    if (section) {
      const target = this.root.querySelector(`#cc-${section}`);
      window.setTimeout(() => target?.scrollIntoView({ behavior: 'auto', block: 'start' }), 30);
    } else {
      (this.root.querySelector('.cc-content') as HTMLElement | null)?.scrollTo({ top: 0 });
    }
  }

  close(): void {
    this.root.classList.add('hidden');
    if (this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    bus.emit(EVT.ccClose + ':done', {});
  }

  /* --------------------------------- static DOM ------------------------------ */

  private buildStatic(): void {
    const navItems: Array<[string, string, boolean?]> = [
      ['overview', 'OVERVIEW'],
      ['story', 'STORY BIBLE'],
      ['scouts', 'SIGNAL SCOUTS'],
      ['portraits', 'SIGNAL PORTRAITS'],
      ['fieldnotes', 'FIELD NOTES'],
      ['rewards', 'SIGNAL ARCHIVE'],
      ['wardrobe', 'WARDROBE'],
      ['mechanics', 'MECHANICS'],
      ['controls', 'CONTROLS'],
      ['progression', 'PROGRESSION'],
      ['zones', 'ZONES'],
      ['levelplans', 'LEVEL PLANS', true],
      ['atlas', 'LEVEL ATLAS', true],
      ['sweeparenas', 'SWEEP ARENAS', true],
      ['bestiary', 'BESTIARY'],
      ['arsenal', 'ARSENAL'],
      ['debug', 'DEBUG / SAVE', true],
      ['todo', 'BUILD TODO', true],
      ['qa', 'AI QA LAB', true],
      ['webtech', 'WEB TECH', true],
      ['art', 'ART DIRECTION', true],
    ];

    this.root.innerHTML = `
      <div class="cc-frame">
        <header class="cc-header">
          <div class="cc-title">
            <span class="cc-dot"></span> BLIP // COMMAND CENTER
            <span class="cc-classified">${this.standalone ? 'STANDALONE DEV DASHBOARD' : 'CLASSIFIED — FIELD UNIT EYES ONLY'}</span>
          </div>
          <div class="cc-header-actions">
            <span class="cc-dev-chip cc-dev-only">DEV VIEW</span>
            ${
              this.standalone
                ? `<a class="cc-btn" href="/" title="Open the game">▶ OPEN GAME</a>`
                : `<a class="cc-btn" href="/command-center.html" target="_blank" rel="noopener" title="Open the dev dashboard in its own tab">⧉ OPEN AS PAGE</a>
                   <button id="cc-close" class="cc-btn">✕ RETURN TO FIELD [C]</button>`
            }
          </div>
        </header>
        <div class="cc-body">
          <nav class="cc-nav">
            ${navItems.map(([id, label, dev]) => `<a href="#cc-${id}" data-target="cc-${id}" class="${dev ? 'cc-dev-only' : ''}">${label}</a>`).join('')}
          </nav>
          <main class="cc-content" id="cc-content">
            ${this.sectionOverview()}
            ${this.sectionStory()}
            ${this.sectionScouts()}
            ${this.sectionPortraits()}
            ${this.sectionFieldNotes()}
            ${this.sectionRewards()}
            ${this.sectionWardrobe()}
            ${this.sectionMechanics()}
            ${this.sectionControls()}
            ${this.sectionProgression()}
            ${this.sectionZones()}
            ${this.sectionLevelPlans()}
            ${this.sectionAtlas()}
            ${this.sectionSweepArenas()}
            ${this.sectionBestiary()}
            ${this.sectionArsenal()}
            ${this.sectionDebug()}
            ${this.sectionTodo()}
            ${this.sectionQa()}
            ${this.sectionWebTech()}
            ${this.sectionArt()}
            <footer class="cc-footer">BLIP v${BUILD_VERSION} — transmission ends.</footer>
          </main>
        </div>
      </div>`;
    this.applyDevMode();

    const commitEl = this.root.querySelector('#cc-bestiary-commit');
    if (commitEl) commitEl.textContent = this.buildCommit().slice(0, 12);
    const generatedEl = this.root.querySelector('#cc-bestiary-generated');
    if (generatedEl) generatedEl.textContent = this.buildGeneratedAt();

    (this.root.querySelector('#cc-close') as HTMLButtonElement | null)?.addEventListener('click', () => {
      bus.emit(EVT.ccClose, {});
    });
    (this.root.querySelector('#cc-reset-save') as HTMLButtonElement).addEventListener('click', () => {
      if (window.confirm('Erase all BLIP progress?')) {
        resetSave();
        window.location.reload();
      }
    });
    // smooth-scroll nav
    this.root.querySelectorAll('.cc-nav a').forEach((a) => {
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const target = this.root.querySelector('#' + (a as HTMLElement).dataset.target);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    // reward system entry points
    (this.root.querySelector('#cc-open-archive') as HTMLButtonElement | null)?.addEventListener('click', () => {
      bus.emit(EVT.rewardOpenArchive, {});
    });
    (this.root.querySelector('#cc-open-cache') as HTMLButtonElement | null)?.addEventListener('click', () => {
      bus.emit(EVT.rewardOpenCache, {});
    });
    // wardrobe SELECT — delegated so it survives re-renders
    this.root.querySelector('#cc-wardrobe-grid')?.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest('.cc-skin-select') as HTMLElement | null;
      if (!btn) return;
      const id = btn.dataset.skin;
      if (!id) return;
      selectSkin(id);
      const skin = skinById(id);
      bus.emit(EVT.skinSelected, { id: skin.id, name: skin.name, color: skin.color, live: true });
      this.refresh();
    });
    // bestiary export actions — delegated (buttons live inside a static-rendered panel)
    this.root.addEventListener('click', (ev) => {
      const exportBtn = (ev.target as HTMLElement).closest('.cc-export-enemy') as HTMLButtonElement | null;
      if (exportBtn) {
        void this.runExportButton(exportBtn, async () => {
          const entry = BESTIARY_ALL_ENEMIES.find((e) => e.id === exportBtn.dataset.exportEnemy);
          if (!entry) return;
          const { exportEnemyAsset } = await import('./bestiaryExport');
          await exportEnemyAsset(entry, this.game);
        });
        return;
      }
      const briefBtn = (ev.target as HTMLElement).closest('#cc-export-brief') as HTMLButtonElement | null;
      if (briefBtn) {
        void this.runExportButton(briefBtn, async () => {
          const { exportEnemyArtBrief } = await import('./bestiaryExport');
          await exportEnemyArtBrief(BESTIARY_ALL_ENEMIES, BESTIARY_HAZARDS, this.buildCommit(), this.buildGeneratedAt(), this.game);
        });
      }
    });
  }

  private async runExportButton(btn: HTMLButtonElement, run: () => Promise<void>): Promise<void> {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⬇ EXPORTING…';
    try {
      await run();
    } catch (err) {
      console.error('[BLIP] Bestiary export failed', err);
      btn.textContent = '✕ EXPORT FAILED — SEE CONSOLE';
      window.setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
      }, 2200);
      return;
    }
    btn.textContent = original;
    btn.disabled = false;
  }

  private buildCommit(): string {
    return (document.querySelector('meta[name="blip-deploy-commit"]') as HTMLMetaElement | null)?.content || 'unknown (dev build — not stamped)';
  }

  private buildGeneratedAt(): string {
    const stamped = (document.querySelector('meta[name="blip-deploy-built-at"]') as HTMLMetaElement | null)?.content;
    return stamped ? new Date(stamped).toLocaleString() : new Date().toLocaleString() + ' (dev build — export time, not build time)';
  }

  private zoneOf(scoutId: string): string {
    return SCOUTS.find((s) => s.id === scoutId)?.zone ?? 'their home zone';
  }

  private devMode(): boolean {
    const testMode = new URLSearchParams(window.location.search).has('test');
    return this.standalone || import.meta.env.DEV || testMode || devState.god;
  }

  private applyDevMode(): void {
    this.root.classList.toggle('cc-dev-mode', this.devMode());
  }

  private panel(id: string, title: string, inner: string, cls = ''): string {
    return `<section class="cc-panel ${cls}" id="cc-${id}">
      <h2><span class="cc-panel-tag">▚</span> ${title}</h2>
      ${inner}
    </section>`;
  }

  private sectionOverview(): string {
    return this.panel(
      'overview',
      'OVERVIEW',
      `
      <div class="cc-hero">
        <div class="cc-hero-title">BLIP</div>
        <div class="cc-hero-tag">${esc(TAGLINE)}</div>
        <div class="cc-hero-sub">${esc(SUBTITLE)}</div>
      </div>
      <p class="cc-pitch">${esc(PITCH)}</p>
      <div class="cc-grid-2">
        <div class="cc-stat"><label>BUILD</label><b>v${BUILD_VERSION}</b></div>
        <div class="cc-stat"><label>PLAYABLE STATUS</label><b class="ok">VERTICAL SLICE — MILLER FIELD</b></div>
        <div class="cc-stat"><label>CURRENT SCENE</label><b id="cc-scene">—</b></div>
        <div class="cc-stat"><label>CURRENT ZONE</label><b id="cc-zone">—</b></div>
        <div class="cc-stat"><label>ACTIVE QUEST</label><b>${esc(THE_FIRST_CONTACT.name).toUpperCase()}</b></div>
        <div class="cc-stat"><label>CURRENT OBJECTIVE</label><b id="cc-objective">—</b></div>
        <div class="cc-stat"><label>SAVE STATUS</label><b id="cc-saved-at">—</b></div>
        <div class="cc-stat"><label>SIGNAL FRAGMENTS</label><b id="cc-fragments" class="ok">0 / ?</b></div>
      </div>`
    );
  }

  private sectionStory(): string {
    return this.panel(
      'story',
      'STORY BIBLE',
      `<div class="cc-cards" id="cc-bible">${GAME_BIBLE.map(
        (e) => `
        <article class="cc-card" data-bible="${e.id}">
          <header><b>${esc(e.title)}</b><span class="cc-chip">${esc(e.classification)}</span></header>
          <p class="cc-bible-body" data-locked="${e.lockedUntilFragment ? '1' : ''}">${esc(e.body)}</p>
        </article>`
      ).join('')}</div>`
    );
  }

  private sectionScouts(): string {
    return this.panel(
      'scouts',
      'THE FIVE SIGNAL SCOUTS',
      `
      <p class="cc-note">Five best friends found the first Signal event years before CONTACT-47 woke up.
      They left badges, logs and markers — as if they knew someone would need them.
      <b id="cc-scouts-count">0 / 5 DISCOVERED</b></p>
      <div class="cc-cards" id="cc-scouts-grid"></div>
      <div id="cc-scout-logs"></div>`
    );
  }

  private sectionPortraits(): string {
    return this.panel(
      'portraits',
      'SIGNAL PORTRAITS',
      `
      <p class="cc-note">The Interpretation Engine only ever sees a <i>blip</i> — a label. Recover a scout's full Signal Set and the Signal renders them whole again: a real kid, not a reading. The card is the anti-blip. <b id="cc-portraits-count">0 / 5 RECOVERED</b></p>
      <div class="cc-cards" id="cc-portraits-grid"></div>`
    );
  }

  private sectionFieldNotes(): string {
    return this.panel(
      'fieldnotes',
      'SCOUT FIELD NOTES',
      `
      <p class="cc-note">Notebook pages the Scouts left in the field — hidden until you scan the right spot. Each one teaches a trick in their own voice. <b id="cc-fieldnotes-count">0 / ${FIELD_NOTES.length} RECOVERED</b></p>
      <div class="cc-cards" id="cc-fieldnotes-grid"></div>`
    );
  }

  private sectionRewards(): string {
    return this.panel(
      'rewards',
      'SIGNAL ARCHIVE / REWARDS',
      `
      <p class="cc-note">Intercepted signals — Scout relics, glitch shards, cosmetic frequencies and weird trophies.
      Earn <b>Signal Caches</b> from play and crack them open in the flashy reveal screen. Duplicates melt into <b>Signal Dust</b>.</p>
      <div class="cc-grid-3">
        <div class="cc-stat"><label>UNOPENED CACHES</label><b id="cc-rw-caches" class="ok">0</b></div>
        <div class="cc-stat"><label>COLLECTION</label><b id="cc-rw-collection">0%</b></div>
        <div class="cc-stat"><label>TROPHIES</label><b id="cc-rw-trophies">0 / 0</b></div>
        <div class="cc-stat"><label>SIGNAL DUST</label><b id="cc-rw-dust" class="warn">0</b></div>
        <div class="cc-stat"><label>SWEEP MEDALS</label><b id="cc-rw-medals">0</b></div>
        <div class="cc-stat"><label>RECENT RARE</label><b id="cc-rw-recent-top">—</b></div>
      </div>
      <div class="cc-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0">
        <button id="cc-open-archive" class="cc-btn">▦ OPEN SIGNAL ARCHIVE</button>
        <button id="cc-open-cache" class="cc-btn">▸ OPEN A CACHE</button>
      </div>
      <h3>CACHES ON HAND</h3>
      <div class="cc-chips" id="cc-rw-cachechips"></div>
      <h3>RECENT REWARDS</h3>
      <div class="cc-chips" id="cc-rw-recent"></div>`
    );
  }

  private sectionWardrobe(): string {
    return this.panel(
      'wardrobe',
      'SIGNAL SKINS / WARDROBE',
      `
      <p class="cc-note">Gather a scout's 3-piece Signal Set (badge · log · relic) in their home zone to
      <b>wear their frequency</b> — a recolor plus that scout's signature ability. CONTACT-47 / UNKNOWN is the
      no-tradeoff baseline. Skins are sidegrades — one strength, one honest tradeoff. Equipped:
      <b id="cc-skin-current" class="ok">CONTACT-47</b></p>
      <div class="cc-cards" id="cc-wardrobe-grid"></div>`
    );
  }

  private sectionMechanics(): string {
    return this.panel(
      'mechanics',
      'CORE MECHANICS',
      `<div class="cc-cards">${MECHANICS.map(
        (m) => `<article class="cc-card"><header><b>${esc(m.name)}</b></header><p>${esc(m.description)}</p></article>`
      ).join('')}</div>`
    );
  }

  private controlTable(title: string, rows: ControlRow[]): string {
    return `<div class="cc-card">
      <header><b>${esc(title)}</b></header>
      <table class="cc-table">${rows
        .map((r) => `<tr><td>${esc(r.action)}</td><td class="key">${esc(r.keys)}</td></tr>`)
        .join('')}</table>
    </div>`;
  }

  private sectionControls(): string {
    return this.panel(
      'controls',
      'CONTROLS',
      `<div class="cc-cards">
        ${this.controlTable('KEYBOARD + MOUSE', CONTROLS_FIELD)}
        ${this.controlTable('GAMEPAD — XBOX · PLAYSTATION', CONTROLS_GAMEPAD)}
        ${this.controlTable('TOUCH — iPAD / TABLET', CONTROLS_TOUCH)}
        ${this.controlTable('TOP-DOWN / SCAN (twin-stick)', CONTROLS_SWEEP)}
        ${this.controlTable('BLIPSTREAM ROOMS', CONTROLS_BLIPSTREAM)}
        ${this.controlTable('DEBUG KEYS', CONTROLS_DEBUG)}
      </div>`
    );
  }

  private sectionProgression(): string {
    return this.panel(
      'progression',
      'PROGRESSION',
      `
      <div class="cc-grid-3">
        <div class="cc-stat"><label>SIGNAL FRAGMENTS</label><b id="cc-prog-fragments">0 / ?</b></div>
        <div class="cc-stat"><label>SIGNAL SHARDS</label><b id="cc-prog-shards">0</b></div>
        <div class="cc-stat"><label>NEXT OBJECTIVE</label><b id="cc-prog-next">—</b></div>
      </div>
      <p class="cc-note">Earn power three ways — <span class="cc-chip ok">ZONE BOSS</span> one signature ability per zone ·
      <span class="cc-chip warn">WORKBENCH</span> spend Signal Shards on tiered stat upgrades ·
      <span class="cc-chip">SCOUT SET</span> complete a scout's 3-piece set for their skin. The base kit clears every zone unaided.</p>
      <h3>QUEST — ${esc(THE_FIRST_CONTACT.name).toUpperCase()}</h3>
      <ul class="cc-check" id="cc-quest-steps"></ul>
      <h3>ABILITIES OWNED</h3>
      <div id="cc-abilities" class="cc-chips"></div>
      <h3>ABILITY LEDGER</h3>
      <table class="cc-table" id="cc-upgrades">
        <tr><th>ABILITY</th><th>EFFECT</th><th>CHANNEL</th><th>SOURCE</th><th>STATUS</th></tr>
        ${UPGRADES.map((u) => {
          const chan =
            u.unlockType === 'boss'
              ? '<span class="cc-chip ok">ZONE BOSS</span>'
              : u.unlockType === 'shop'
                ? `<span class="cc-chip warn">WORKBENCH · ${u.cost ?? '?'}◈</span>`
                : u.unlockType === 'scout-set'
                  ? '<span class="cc-chip">SCOUT SET</span>'
                  : '<span class="cc-chip">BASE KIT</span>';
          const st =
            u.status === 'IMPLEMENTED' ? 'ok' : u.status === 'UNLOCKED_PLACEHOLDER' ? 'warn' : '';
          return `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.description)}</td>
           <td>${chan}</td><td class="key">${esc(u.source)}</td>
           <td><span class="cc-chip ${st}">${u.status.replace('_', ' ')}</span></td></tr>`;
        }).join('')}
      </table>`
    );
  }

  private sectionZones(): string {
    return this.panel(
      'zones',
      'ZONES',
      `<div class="cc-cards">${ZONES.map(
        (z) => `
        <article class="cc-card zone">
          <header><b>${esc(z.name)}</b><span class="cc-chip ${z.status === 'PLAYABLE' ? 'ok' : ''}">${z.status}</span></header>
          <p class="cc-zone-tag">“${esc(z.tagline)}”</p>
          <p>${esc(z.description)}</p>
          <p class="cc-kv"><label>SCOUT TRAIL</label> ${esc(z.scout)} — ${esc(z.scoutHook)}</p>
          <p class="cc-kv"><label>BOSS</label> ${esc(z.boss)} — ${esc(z.bossDescription)}</p>
        </article>`
      ).join('')}</div>`
    );
  }

  private sectionLevelPlans(): string {
    const ul = (items: string[]) => `<ul class="cc-list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    const ol = (items: string[]) =>
      `<ol class="cc-steps">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`;
    return this.panel(
      'levelplans',
      'LEVEL PLANS / ROADMAP',
      `
      <p class="cc-note">Full structure for all six zones — <b>Miller Field is built</b>; Zones 2–6 are
      <b>design plans only</b> (not yet playable) for review. Each zone carries one signature system + one
      motivated perspective shift so none repeat. Re-themes follow LEVEL_RETHEMES.md; skins SCOUT_SKINS_PLAN.md;
      the full writeup + Phaser feasibility notes in LEVEL_DESIGN_DEEP.md.</p>
      <h3>DESIGN PILLARS</h3>
      <div class="cc-cards">${DESIGN_PILLARS.map(
        (d) => `<article class="cc-card"><header><b>${esc(d.title)}</b></header><p>${esc(d.body)}</p></article>`
      ).join('')}</div>
      <h3 style="margin-top:16px">THE ZONES</h3>
      <div class="cc-plan-list">${LEVEL_PLANS.map(
        (p) => `
        <article class="cc-plan ${p.status === 'BUILT' ? 'built' : ''}">
          <header>
            <b>ZONE ${p.order} · ${esc(p.name)}</b>
            <span class="cc-chip ${p.status === 'BUILT' ? 'ok' : ''}">${p.status}</span>
          </header>
          <p class="cc-plan-scope">${esc(p.scope)}</p>
          <p class="cc-plan-setting">${esc(p.setting)}</p>
          <p class="cc-plan-signature"><span class="cc-plan-flag">◆ SIGNATURE</span> ${esc(p.signature)}</p>
          <p class="cc-kv"><label>PERSPECTIVE</label> ${esc(p.perspective)}</p>
          <p class="cc-kv"><label>STANDOUT MOMENT</label> ${esc(p.standoutMoment)}</p>
          <p class="cc-kv"><label>THE SIGNAL’S ANSWER</label> ${esc(p.signalAnswer)}</p>
          <div class="cc-plan-cols">
            <div>
              <h4>STRUCTURE / CORE LOOP</h4>${ol(p.coreLoop)}
              <h4>WILD / STANDOUT MECHANICS</h4>${ul(p.wildMechanics)}
              <h4>CORE MECHANICS</h4>${ul(p.mechanics)}
              <h4>SUB-AREAS</h4>${ul(p.subAreas)}
            </div>
            <div>
              <h4>BLIPSTREAM NODE</h4><p>${esc(p.blipstream)}</p>
              <h4>BOSS — ${esc(p.boss.name)}</h4>${ul(p.boss.phases)}
              <p class="cc-kv"><label>WEAKNESS</label> ${esc(p.boss.weakness)}</p>
              <h4>SCOUT / SIGNAL SET</h4>
              <p class="cc-kv"><label>SCOUT</label> ${esc(p.scout)}</p>
              <p class="cc-kv"><label>SET</label> ${esc(p.signalSet)}</p>
              <p class="cc-kv"><label>SKIN PAYOFF</label> ${esc(p.skinPayoff)}</p>
              ${p.captured && p.captured.length ? `<h4>CAPTURED — WIRE WHEN BUILT</h4>${ul(p.captured)}` : ''}
              <h4>GRAPHICS IDENTITY (pixel + selective realism)</h4>${ul(p.graphicsHook)}
            </div>
          </div>
        </article>`
      ).join('')}</div>`,
      'cc-dev-only'
    );
  }

  /* ------------------------- developer birdseye sections ------------------------ */

  private sectionAtlas(): string {
    const legend: Array<[string, string]> = [
      ['#3f9a5f', 'ground / platform'],
      ['#a8ff3e', 'hidden (scan) / waveform / node'],
      ['#35d5ff', "Will's badge path + markers"],
      ['#fff3c9', 'player spawn / switches'],
      ['#d84a42', 'drones / hazards / arena band'],
      ['#f2a93b', 'scanner rig / Chip box / fuse box'],
      ['#7c5cff', 'crop-circle door'],
      ['#7cfc9b', 'exit gate'],
      ['#3df0ff', 'neon circuit A / ice'],
      ['#ffb03b', 'neon circuit B / SPARK'],
      ['#ff4d8d', 'neon circuit C / VACANCY'],
    ];
    return this.panel(
      'atlas',
      'LEVEL ATLAS — BIRDSEYE',
      `
      <p class="cc-note">Rendered live from <span class="key">src/game/data/levels.ts</span> — the actual collision/entity grids the game builds from. 1 cell = 1 tile (16px). Red band = boss arena.</p>
      <div class="cc-chips">${legend
        .map(([c, l]) => `<span class="cc-chip"><i class="cc-legend-swatch" style="background:${c}"></i>${esc(l)}</span>`)
        .join('')}</div>
      <h3>MILLER FIELD 3.0 — ${MILLER_FIELD.cols}×${MILLER_FIELD.rowCount} tiles (${MILLER_FIELD.meta.widthPx}×${MILLER_FIELD.meta.heightPx}px) · vertical route topology</h3>
      <div class="cc-chips">
        <span class="cc-chip"><i class="cc-legend-swatch" style="background:#f4f4f4"></i>main path</span>
        <span class="cc-chip"><i class="cc-legend-swatch" style="background:#35a7ff"></i>lower route</span>
        <span class="cc-chip"><i class="cc-legend-swatch" style="background:#35d5ff"></i>upper secret (Will)</span>
        <span class="cc-chip"><b style="color:#ff7a3b">▼</b> descent</span>
        <span class="cc-chip"><b style="color:#a8ff3e">▲</b> climb</span>
        <span class="cc-chip"><b style="color:#f4f4f4">◯</b> rejoin</span>
        <span class="cc-chip"><b style="color:#ffd54a">✳</b> secret badge</span>
        <span class="cc-chip"><b style="color:#ff5040">◎</b> boss arena</span>
        <span class="cc-chip"><b style="color:#fff3c9">▣</b> checkpoint</span>
        <span class="cc-chip"><b style="color:#ff5a48">▨</b> softlock void</span>
      </div>
      <div class="cc-atlas-wrap"><canvas id="cc-atlas-miller" class="cc-atlas"></canvas></div>
      <p class="cc-note"><b>Main path</b> (white, serpentine): high spawn ridge → <b>deep scan-dip</b> (descend cascading ledges; one scan reveals the climb-out ladder) → high meadow (Chip's box) → scanner plateau → <b>drop</b> into the tiered drone lowlands → terraced climb to the radio ridge → <b>ravine</b> crossing on the mid pillar → node-mound landmark → crop-circle door → <b>drop</b> into the tiered boss bowl → road east → glowing signal-gate. <b>Lower route</b> (blue): the basin pit under the drone valley + the ravine's recovery shelf (fall-safe). <b>Upper secret</b> (cyan): Will's tall hidden climb to the WILLOW badge. Red hatch = the ravine void (only real fall hazard).</p>
      <div class="cc-chips">
        <span class="cc-chip">SIZE: <b class="warn">${MILLER_FIELD.cols}×${MILLER_FIELD.rowCount} tiles · ${MILLER_FIELD.meta.widthPx}×${MILLER_FIELD.meta.heightPx}px</b></span>
        <span class="cc-chip">VERTICAL RANGE USED: <b class="warn">r5→r30 · 25 tiles (400px)</b></span>
        <span class="cc-chip">DESCENTS: <b class="warn">4</b></span>
        <span class="cc-chip">CLIMBS: <b class="warn">4 + 1 secret</b></span>
        <span class="cc-chip">OPTIONAL ROUTES: <b class="warn">2 (lower basin · Will's upper)</b></span>
        <span class="cc-chip">EST. PLAYTIME: <b class="warn">4–6 min</b></span>
      </div>
      <h3>MOTEL NOWHERE — ${MOTEL_NOWHERE.cols}×${MOTEL_NOWHERE.rowCount} tiles (${MOTEL_NOWHERE.meta.widthPx}×${MOTEL_NOWHERE.meta.heightPx}px)</h3>
      <div class="cc-atlas-wrap"><canvas id="cc-atlas-motel" class="cc-atlas"></canvas></div>
      <p class="cc-note">Flow: wet parking lot (security lamps) → power switch → circuit-A neon staircase → diner roof + fuse box (Blipstream circuit) → the wing wakes (circuit B) → climb → THE VACANCY SIGN (red band, arena walkway) → fragment. Optional circuit-C side route to Chip's SPARK badge.</p>
      <h3>CHAGRIN FALLS HIGH — ${TIGER_STADIUM.cols}×${TIGER_STADIUM.rowCount} tiles (${TIGER_STADIUM.meta.widthPx}×${TIGER_STADIUM.meta.heightPx}px) · Friday-night-lights stealth</h3>
      <div class="cc-atlas-wrap"><canvas id="cc-atlas-stadium" class="cc-atlas"></canvas></div>
      <p class="cc-note">Flow: school gates / track start → rotating <b>light-cone</b> stealth lane → a sunken <b>DUGOUT</b> dip (Henry ANCHOR safe zone + badge + a hidden locker cache) → optional <b>BLEACHER</b> climb high to the press box (Signal Flare relic) → the <b>SCOREBOARD</b> landmark (KNOWN/UNKNOWN meter) → a deep <b>REC-POOL</b> basin (dive node) → surface / rejoin near the fifty → the tiered <b>WEATHER BALLOON</b> arena (red band) → road east. Green safe zones declassify + heal between light sweeps.</p>
      ${this.statChips({
        SIZE: `${TIGER_STADIUM.cols}×${TIGER_STADIUM.rowCount} tiles · ${TIGER_STADIUM.meta.widthPx}×${TIGER_STADIUM.meta.heightPx}px`,
        'VERTICAL RANGE USED': 'r8→r40 · 32 tiles (512px)',
        DESCENTS: '2 (dugout · rec-pool) + boss drop',
        CLIMBS: '3 (bleachers → press box · relic · surface rejoin)',
        'OPTIONAL ROUTES': '3 (locker cache · top-bleacher relic · dugout)',
        'EST. PLAYTIME': '6–9 min',
      })}
      <h3>PATTERSON'S ORCHARD — ${PATTERSONS_ORCHARD.cols}×${PATTERSONS_ORCHARD.rowCount} tiles (${PATTERSONS_ORCHARD.meta.widthPx}×${PATTERSONS_ORCHARD.meta.heightPx}px) · living maze + the Fold</h3>
      <div class="cc-atlas-wrap"><canvas id="cc-atlas-orchard" class="cc-atlas"></canvas></div>
      <p class="cc-note">Flow: farm road → a TALL apple-tree pillar climb (branch ledges + <b>respawning fruit</b>) → the white barn + a hidden <b>LOFT</b> (Cameron/ECHO badge) → the corn-maze approach whose walls <b>shift on a readable beat</b> → the <b>FOLD</b> mouth [E] into the top-down <b>maze-z4</b> Sweep arena → charging the crop-circle node <b>BLOOMS</b> the circle → back through the opened gate to the maze heart (Tuning Fork) → the tiered <b>HARVEST PATTERN</b> arena (red band) → county road. Green = fruit platforms · tan = corn walls (Q/W shift) · purple = crop-circle gate.</p>
      ${this.statChips({
        SIZE: `${PATTERSONS_ORCHARD.cols}×${PATTERSONS_ORCHARD.rowCount} tiles · ${PATTERSONS_ORCHARD.meta.widthPx}×${PATTERSONS_ORCHARD.meta.heightPx}px`,
        'VERTICAL RANGE USED': 'r6→r44 · 38 tiles (608px)',
        CLIMBS: '1 tall apple-pillar climb + hidden loft',
        'PERSPECTIVE SHIFT': 'the Fold → top-down maze-z4 (Sweep)',
        'OPTIONAL ROUTES': '2 (barn-loft badge · maze-heart relic)',
        'EST. PLAYTIME': '6–9 min',
      })}
      <h3>THE REC POOL — inverted reflection node — ${POOL_MIRROR.cols}×${POOL_MIRROR.rowCount} tiles (${POOL_MIRROR.meta.widthPx}×${POOL_MIRROR.meta.heightPx}px)</h3>
      <div class="cc-atlas-wrap"><canvas id="cc-atlas-pool" class="cc-atlas"></canvas></div>
      <p class="cc-note">Dive through the pool and the world flips to a low-gravity, god-rayed underwater mirror where your delayed reflection echoes your moves. Route the three sync nodes (float over the slow static), then rise through the surface gate — the field above wakes for the boss.</p>
      <h3>BLIPSTREAM NODE A — ${NODE_A.cols}×${NODE_A.rowCount} tiles (${NODE_A.meta.widthPx}×${NODE_A.meta.heightPx}px)</h3>
      <div class="cc-atlas-wrap"><canvas id="cc-atlas-node" class="cc-atlas"></canvas></div>
      <p class="cc-note">Flow: entry shelf → node 1 → scan-line corridor → static-hazard run → node 2 → oscillating platforms → node 3 over hazard → descent → exit gate. (Reused as Chip's Circuit when jacked in from Motel Nowhere.)</p>`,
      'cc-dev-only'
    );
  }

  private statChips(stats: Record<string, string | number>): string {
    return `<div class="cc-chips">${Object.entries(stats)
      .map(([k, v]) => `<span class="cc-chip">${esc(k)}: <b class="warn">${esc(String(v))}</b></span>`)
      .join('')}</div>`;
  }

  private kv(label: string, value: string): string {
    return `<p class="cc-kv"><label>${esc(label)}</label> ${esc(value)}</p>`;
  }

  private customArtChip(info: CustomArtInfo | undefined): string {
    if (!info) return '';
    const label = info.status === 'shipped' ? '✓ CUSTOM ART — LIVE' : info.status === 'integrated-unplaced' ? '✓ CUSTOM ART — NOT PLACED' : '✕ NEEDS CUSTOM ART';
    const cls = info.status === 'shipped' ? 'ok' : info.status === 'integrated-unplaced' ? '' : 'bad';
    const order = info.roadmapOrder !== undefined ? ` · ROADMAP #${info.roadmapOrder}` : '';
    return `<span class="cc-chip ${cls}" title="${esc(info.note)}">${esc(label)}${esc(order)}</span>`;
  }

  private enemyCard(e: BestiaryEnemyEntry): string {
    const statusCls = /shipped — (fully|100%)|shipped — dual/i.test(e.implementationStatus)
      ? 'ok'
      : /stub|unbuilt|placeholder/i.test(e.implementationStatus)
        ? 'bad'
        : 'warn';
    return `<article class="cc-card cc-bestiary-card" data-enemy="${esc(e.id)}">
      <header><b>${esc(e.name)}</b><span class="cc-chip ${e.chipCls}">${esc(e.chip)}</span>${this.customArtChip(e.customArt)}</header>
      <p class="cc-zone-tag">${esc(e.zones.join(' · '))} — <span class="key">${esc(e.internalId)}</span></p>
      <p>${esc(e.behavior)}</p>
      ${this.kv('MOVEMENT', e.movement)}
      ${this.kv('ATTACK TYPE', e.attackType)}
      ${this.statChips(e.tuning)}
      <h4>ASSET</h4>
      ${this.kv('KIND', e.asset.kind)}
      <p class="cc-kv"><label>TEXTURE KEYS</label> <span class="key">${esc(e.asset.textureKeys.join(', '))}</span></p>
      ${this.kv('SOURCE', e.asset.sourceFile)}
      ${e.asset.atlasImage ? this.kv('ATLAS', `${e.asset.atlasImage} + ${e.asset.atlasJson}`) : ''}
      ${e.asset.originSource ? this.kv('ORIGIN SOURCE FILES', e.asset.originSource.join(', ')) : ''}
      <h4>RENDER</h4>
      ${this.kv('DIMS', `${e.dims.nativeW || '—'}×${e.dims.nativeH || '—'}px — ${e.dims.renderedNote}`)}
      ${this.kv('ORIGIN', e.origin)}
      ${this.kv('HITBOX', `${e.hitbox.w}×${e.hitbox.h}px — ${e.hitbox.note}`)}
      ${this.kv('PERSPECTIVE', e.perspective)}
      ${this.kv('FACING', e.facing)}
      ${this.kv('ROTATION', e.rotation)}
      ${this.kv('ANIMATION', e.animation)}
      ${this.kv('SHADOW', e.shadow)}
      ${this.kv('PLAYER OVERLAP / DEPTH', e.playerOverlap)}
      <h4>REPLACEMENT ART SPEC</h4>
      ${this.kv('DIMENSIONS', e.replacement.dims)}
      ${this.kv('PADDING', e.replacement.padding)}
      ${this.kv('DIRECTIONAL VARIANTS', e.replacement.directionalVariants)}
      ${this.kv('EFFECT LAYERS', e.replacement.effectLayers)}
      ${this.kv('SILHOUETTE INTENT', e.silhouetteIntent)}
      <p class="cc-kv"><label>STATUS</label> <span class="cc-chip ${statusCls}">${esc(e.implementationStatus)}</span></p>
      ${e.knownIssues.length ? `<h4>KNOWN VISUAL ISSUES</h4><ul class="cc-list cc-issues">${e.knownIssues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<h4>KNOWN VISUAL ISSUES</h4><p class="cc-note">None flagged.</p>'}
      <p class="cc-note">SOURCE: ${e.sourceRefs.map((r) => esc(r)).join(' · ')}</p>
      <button class="cc-btn cc-export-enemy cc-dev-only" data-export-enemy="${esc(e.id)}">⬇ ASSET EXPORT</button>
    </article>`;
  }

  private hazardCard(h: BestiaryHazardEntry): string {
    return `<article class="cc-card">
      <header><b>${esc(h.name)}</b><span class="cc-chip bad">${esc(h.chip)}</span>${this.customArtChip(h.customArt)}</header>
      <p class="cc-zone-tag">${esc(h.zones.join(' · '))}</p>
      <p>${esc(h.desc)}</p>
      ${this.statChips(h.tuning)}
      ${this.kv('BEHAVIOR', h.behavior)}
      ${this.kv('ASSET SOURCE', h.asset.sourceFile)}
      ${this.kv('DIMS', `${h.dims.nativeW || '—'}×${h.dims.nativeH || '—'}px — ${h.dims.renderedNote}`)}
      ${h.knownIssues.length ? `<h4>FLAGS</h4><ul class="cc-list cc-issues">${h.knownIssues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      <p class="cc-note">SOURCE: ${h.sourceRefs.map((r) => esc(r)).join(' · ')}</p>
    </article>`;
  }

  private roadmapPhase(p: BestiaryRoadmapPhase, nameById: Map<string, string>): string {
    const statusChip =
      p.status === 'done'
        ? '<span class="cc-chip ok">DONE</span>'
        : p.status === 'next'
          ? '<span class="cc-chip warn">NEXT UP</span>'
          : p.status === 'blocked'
            ? '<span class="cc-chip bad">BLOCKED</span>'
            : '<span class="cc-chip">PLANNED</span>';
    const mark = p.status === 'done' ? '☑' : p.status === 'next' ? '▸' : p.status === 'blocked' ? '⏸' : '☐';
    return `<li class="${p.status === 'done' ? 'done' : p.status === 'next' ? 'current' : ''}">
      ${mark} <b>#${p.order} — ${esc(p.title)}</b> ${statusChip}
      <div class="cc-note" style="margin:2px 0 0 18px">${esc(p.note)}</div>
      <div class="cc-chips" style="margin:4px 0 0 18px">${p.targetIds.map((id) => `<span class="cc-chip">${esc(nameById.get(id) ?? id)}</span>`).join('')}</div>
    </li>`;
  }

  private systemCard(s: BestiarySystemEntry): string {
    return `<article class="cc-card">
      <header><b>${esc(s.name)}</b><span class="cc-chip">SYSTEM</span></header>
      <p>${esc(s.desc)}</p>
      ${this.statChips(s.tuning)}
      ${this.kv('USED BY', s.usedBy.join(' · '))}
      <p class="cc-note">SOURCE: ${s.sourceRefs.map((r) => esc(r)).join(' · ')}</p>
    </article>`;
  }

  private sectionBestiary(): string {
    const nameById = new Map<string, string>();
    BESTIARY_ALL_ENEMIES.forEach((e) => nameById.set(e.id, e.name));
    BESTIARY_HAZARDS.forEach((h) => nameById.set(h.id, h.name));
    const shippedCount = BESTIARY_ALL_ENEMIES.filter((e) => e.customArt?.status === 'shipped').length;
    const needsArtCount = [...BESTIARY_ALL_ENEMIES, ...BESTIARY_HAZARDS].filter((e) => e.customArt?.status === 'needs-art').length;
    return this.panel(
      'bestiary',
      'BESTIARY',
      `<p class="cc-note">GENERATED <b id="cc-bestiary-generated">—</b> · COMMIT <b class="key" id="cc-bestiary-commit">—</b> — this page is the source of truth for enemy gameplay data and replacement-art requirements.
      Numbers read live from <span class="key">src/game/config.ts</span> (see <span class="key">src/game/data/bestiaryData.ts</span>) — tune in config, this page follows on next build.</p>
      <p class="cc-kv"><label>CONTACT-47 SCALE REFERENCE</label> ${esc(CONTACT47_SCALE_REF.note)}</p>
      <div class="cc-chips" style="margin:8px 0 4px">
        <span class="cc-chip ok">CUSTOM ART LIVE: ${shippedCount}</span>
        <span class="cc-chip bad">NEEDS CUSTOM ART: ${needsArtCount}</span>
      </div>
      <div class="cc-actions cc-dev-only" style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 18px">
        <button id="cc-export-brief" class="cc-btn">⬇ EXPORT ENEMY ART BRIEF</button>
      </div>
      <h3>1 · ENEMIES — REQUIRE VISUAL ASSETS (${BESTIARY_ALL_ENEMIES.length})</h3>
      <div class="cc-cards cc-bestiary-grid">${BESTIARY_ALL_ENEMIES.map((e) => this.enemyCard(e)).join('')}</div>
      <h3>2 · FIXED HAZARDS / ENVIRONMENTAL THREATS (${BESTIARY_HAZARDS.length})</h3>
      <div class="cc-cards">${BESTIARY_HAZARDS.map((h) => this.hazardCard(h)).join('')}</div>
      <h3>3 · GAMEPLAY SYSTEMS (${BESTIARY_SYSTEMS.length})</h3>
      <div class="cc-cards">${BESTIARY_SYSTEMS.map((s) => this.systemCard(s)).join('')}</div>
      <h3>4 · CUSTOM ART ROADMAP</h3>
      <p class="cc-note">The agreed ship order for replacement art — update <span class="key">CUSTOM_ART_STATUS</span> / <span class="key">BESTIARY_ASSET_ROADMAP</span> in <span class="key">src/game/data/bestiaryData.ts</span> as batches land.</p>
      <ul class="cc-check">${[...BESTIARY_ASSET_ROADMAP].sort((a, b) => a.order - b.order).map((p) => this.roadmapPhase(p, nameById)).join('')}</ul>`
    );
  }

  private sectionArsenal(): string {
    const jumpTiles = (PLAYER.jumpVel * PLAYER.jumpVel) / (2 * PLAYER.gravity) / TILE;
    const pulseRange = Math.round(PULSE.speed * (PULSE.lifeMs / 1000));
    const rows: Array<[string, string, string]> = [
      ['Run', `${PLAYER.runSpeed}px/s · accel ${PLAYER.accel}`, 'air accel ' + PLAYER.airAccel],
      ['Jump', `${PLAYER.jumpVel}px/s ≈ ${jumpTiles.toFixed(1)} tiles`, `coyote ${PLAYER.coyoteMs}ms · buffer ${PLAYER.jumpBufferMs}ms · release-cut ×${PLAYER.jumpCutMult}`],
      ['Hover', `fall capped @ ${PLAYER.hoverFallSpeed}px/s`, `drains ${PLAYER.hoverDrainPerSec}/s of ${PLAYER.energyMax} energy · regen ${PLAYER.energyRegenPerSec}/s grounded`],
      ['Phase Drift (dash)', `${PLAYER.dashSpeed}px/s for ${PLAYER.dashMs}ms`, `i-frames during dash · cooldown ${PLAYER.dashCooldownMs}ms · afterimages`],
      ['Pulse Shot', `${PULSE.damage} dmg · ${PULSE.speed}px/s · range ≈ ${pulseRange}px`, `auto-fire every ${PULSE.cooldownMs}ms · activates node switches · cracks the boss core`],
      ['Scan Pulse', `radius ${SCAN.radius}px`, `cooldown ${SCAN.cooldownMs}ms · reveals hidden platforms, scout trails, boss core (${BOSS.coreExposeMs}ms window)`],
      ['Hull', `${PLAYER.maxHp} hp`, `${PLAYER.invulnMs}ms invulnerability + knockback ${PLAYER.knockback} on hit`],
    ];
    return this.panel(
      'arsenal',
      'ARSENAL — CONTACT-47 TUNING',
      `<p class="cc-note">The full movement/combat kit with live numbers from <span class="key">config.ts → PLAYER / PULSE / SCAN</span>. Future abilities live in PROGRESSION ▸ upgrade roadmap.</p>
      <table class="cc-table">${rows
        .map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td class="key">${esc(b)}</td><td>${esc(c)}</td></tr>`)
        .join('')}</table>`
    );
  }

  /** paint the level grids onto the atlas canvases */
  private drawAtlases(): void {
    this.paintLevel('cc-atlas-miller', MILLER_FIELD, true, (ctx, cell) => this.paintMillerTopology(ctx, cell));
    this.paintLevel('cc-atlas-motel', MOTEL_NOWHERE, true);
    this.paintLevel('cc-atlas-stadium', TIGER_STADIUM, true);
    this.paintLevel('cc-atlas-orchard', PATTERSONS_ORCHARD, true);
    this.paintLevel('cc-atlas-pool', POOL_MIRROR, false);
    this.paintLevel('cc-atlas-node', NODE_A, false);
    // top-down Sweep arenas (the Fold's combat maps)
    Object.values(SWEEP_ARENAS).forEach((a) => this.paintSweepArena(`cc-sweep-${a.id}`, a));
  }

  private paintLevel(
    canvasId: string,
    def: LevelDef,
    markArena: boolean,
    overlay?: (ctx: CanvasRenderingContext2D, cell: number) => void
  ): void {
    const canvas = this.root.querySelector('#' + canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const CELL = 5;
    canvas.width = def.cols * CELL;
    canvas.height = def.rowCount * CELL;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0a1120';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const colorFor = (ch: string, col: number, row: number): string | null => {
      switch (ch) {
        case '#':
          return cellAt(def, col, row - 1) === '#' ? '#4a3a2b' : '#3f9a5f';
        case '=':
          return '#57b06b';
        case 'H':
          return '#a8ff3e';
        case 'h':
          return '#35d5ff';
        case 'm':
          return '#2b93b8';
        case 'b':
          return '#9feaff';
        case 'P':
          return '#fff3c9';
        case 'd':
          return '#d84a42';
        case 's':
          return '#f2a93b';
        case 'x':
          return '#ffb03b';
        case 'f':
          return '#5a4630';
        case 't':
          return '#8d97c4';
        case 'n':
          return '#a8ff3e';
        case 'g':
          return '#7c5cff';
        case 'W': // Will's Folded Map relic
          return '#9feaff';
        case '-':
          return '#a8ff3e';
        case '~':
          return '#7cdc6a';
        case '!':
          return '#d84a42';
        case 'o':
          return '#fff3c9';
        case 'E':
          return '#7cfc9b';
        // ---- Motel Nowhere (Zone 2) ----
        case 'A': // neon platform — circuit A
          return '#3df0ff';
        case 'B': // neon platform — circuit B (dead wing)
          return '#ffb03b';
        case 'C': // neon platform — circuit C
          return '#ff4d8d';
        case '1':
        case '3': // power switches
          return '#fff3c9';
        case 'L': // security lamp
          return '#f2a93b';
        case 'F': // fuse box (Blipstream entrance)
          return '#ffb03b';
        case 'V': // The Vacancy Sign boss
          return '#ff4d8d';
        case 'c': // Chip's SPARK badge
          return '#ffb03b';
        case 'K': // Chip's Power Cell relic
          return '#ffe9a8';
        case 'M': // motel arrow sign
          return '#ff4d8d';
        case 'D': // diner window
          return '#ffca6a';
        case 'I': // ice machine
          return '#3df0ff';
        case 'p': // puddle
          return '#241d33';
        // ---- Patterson's Orchard (Zone 4) ----
        case '%': // respawning fruit platform
          return '#4bd06a';
        case 'Q': // corn-maze wall (phase A / B shown together)
          return '#b89a4a';
        case 'Y': // apple-tree pillar
          return '#2f6b3e';
        case 'R': // white barn + green roof
          return '#e8e2d0';
        default:
          return null;
      }
    };

    def.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const color = colorFor(row[c], c, r);
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    });

    if (markArena) {
      const a = def.meta.arena;
      ctx.fillStyle = 'rgba(216, 74, 66, 0.12)';
      ctx.fillRect((a.leftPx / TILE) * CELL, 0, ((a.rightPx - a.leftPx) / TILE) * CELL, canvas.height);
    }

    overlay?.(ctx, CELL);
  }

  /* --------------------- top-down Sweep arenas (the Fold) -------------------- */

  private sectionSweepArenas(): string {
    const cards = Object.values(SWEEP_ARENAS)
      .filter((a) => a.mode === 'traverse')
      .map(
        (a) => `
      <h3>${esc(a.label)} — ${a.grid.w}×${a.grid.h} tiles · ${esc(a.biome)} biome · Fold → ${esc(a.next ?? '—')}</h3>
      <div class="cc-atlas-wrap"><canvas id="cc-sweep-${a.id}" class="cc-atlas"></canvas></div>`
      )
      .join('');
    return this.panel(
      'sweeparenas',
      'SWEEP ARENAS — TOP-DOWN (THE FOLD)',
      `
      <p class="cc-note">The top-down twin-stick combat maps you enter through <b>the Fold</b> (side-view ⇄ the Interpretation Engine's top-down scan). Floor is carved from a solid wall field by hand-authored rooms + corridors, so every zone's Sweep is a real, unique level.
      <span style="color:#a8ff3e">◉</span> signal node · <span style="color:#7cfc9b">◉</span> breach (exit) · <span style="color:#f2a93b">◉</span> elite Classifier · <span style="color:#d84a42">◉</span> drones · <span style="color:#7c5cff">◉</span> caches · <span style="color:#fff3c9">◉</span> spawn.</p>
      ${cards}
      <p class="cc-note"><b>maze-z4</b> is Patterson's Orchard's living corn maze — fight through, charge the crop-circle node, and it <b>blooms</b> the circle and Folds you back to open the maze-heart gate.</p>`,
      'cc-dev-only'
    );
  }

  private paintSweepArena(canvasId: string, arena: SweepArena): void {
    const canvas = this.root.querySelector('#' + canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const CELL = 7;
    const W = arena.grid.w;
    const H = arena.grid.h;
    canvas.width = W * CELL;
    canvas.height = H * CELL;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const wall = arena.biome === 'motel' ? '#22262f' : arena.biome === 'orchard' ? '#3a2e18' : '#12241a';
    const floor = arena.biome === 'motel' ? '#1a1620' : arena.biome === 'orchard' ? '#2e2114' : '#143a24';
    const solid: boolean[][] = Array.from({ length: H }, () => new Array<boolean>(W).fill(true));
    const carve = (r: { x: number; y: number; w: number; h: number }) => {
      for (let ty = r.y; ty < r.y + r.h && ty < H; ty++)
        for (let tx = r.x; tx < r.x + r.w && tx < W; tx++) if (tx >= 0 && ty >= 0) solid[ty][tx] = false;
    };
    arena.rooms.forEach(carve);
    arena.halls.forEach(carve);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        ctx.fillStyle = solid[y][x] ? wall : floor;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    const dot = (m: { tx: number; ty: number }, color: string, r = CELL * 0.7) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc((m.tx + 0.5) * CELL, (m.ty + 0.5) * CELL, r, 0, Math.PI * 2);
      ctx.fill();
    };
    (arena.enemies ?? []).forEach((e) => dot(e, '#d84a42', CELL * 0.42));
    (arena.caches ?? []).forEach((c) => dot(c, '#7c5cff', CELL * 0.42));
    dot(arena.node, '#a8ff3e');
    if (arena.breach) dot(arena.breach, '#7cfc9b');
    if (arena.elite) dot(arena.elite, '#f2a93b', CELL * 0.55);
    dot(arena.spawn, '#fff3c9');
  }

  /**
   * Route topology overlay for Miller Field 3.0 — draws the main serpentine
   * path, the two optional lower routes, Will's upper secret climb, and the
   * descent/climb/rejoin/secret/boss/checkpoint/softlock markers on top of the
   * live grid. Coordinates are (col, row) tile centers of the actual layout.
   */
  private paintMillerTopology(ctx: CanvasRenderingContext2D, CELL: number): void {
    const P = (col: number, row: number): [number, number] => [col * CELL + CELL / 2, row * CELL + CELL / 2];
    const H = MILLER_FIELD.rowCount * CELL;

    const line = (pts: Array<[number, number]>, color: string, width: number, dash: number[] = []): void => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(dash);
      ctx.shadowColor = color;
      ctx.shadowBlur = 3;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    };
    const tri = (col: number, row: number, up: boolean, color: string): void => {
      const [x, y] = P(col, row);
      const s = CELL;
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      if (up) {
        ctx.moveTo(x, y - s);
        ctx.lineTo(x - s * 0.85, y + s * 0.65);
        ctx.lineTo(x + s * 0.85, y + s * 0.65);
      } else {
        ctx.moveTo(x, y + s);
        ctx.lineTo(x - s * 0.85, y - s * 0.65);
        ctx.lineTo(x + s * 0.85, y - s * 0.65);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    };
    const circle = (col: number, row: number, color: string, rad: number, inner = false): void => {
      const [x, y] = P(col, row);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.stroke();
      if (inner) {
        ctx.beginPath();
        ctx.arc(x, y, rad * 0.42, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };
    const square = (col: number, row: number, color: string): void => {
      const [x, y] = P(col, row);
      const s = CELL * 0.82;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(x - s, y - s, s * 2, s * 2);
      ctx.fillStyle = color;
      ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      ctx.restore();
    };
    const spark = (col: number, row: number, color: string): void => {
      const [x, y] = P(col, row);
      const s = CELL * 1.25;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 3;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
        ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        ctx.stroke();
      }
      ctx.restore();
    };

    // ---- softlock danger: the ravine void (cols 105-113, below the shelf) ----
    ctx.save();
    ctx.fillStyle = 'rgba(255,64,48,0.12)';
    ctx.fillRect(105 * CELL, 31 * CELL, 8 * CELL, H - 31 * CELL);
    ctx.strokeStyle = 'rgba(255,90,72,0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(105 * CELL, 31 * CELL, 8 * CELL, H - 31 * CELL);
    ctx.restore();

    // ---- routes ----
    // MAIN serpentine path (white dashed): high → dip → meadow → plateau →
    // drone lowlands → radio ridge → ravine → mound → door → boss bowl → gate
    line(
      [
        [4, 9], [14, 9], [16, 13], [20, 18], [27, 23], // descend into the scan-dip
        [35, 13], [42, 13], // scan-climb out to the high meadow
        [50, 15], [58, 15], // scanner plateau
        [60, 19], [78, 25], // drop into the drone lowlands (open east floor)
        [91, 23], [95, 16], [100, 13], // terraced climb to the radio ridge
        [104, 13], [109, 15], [117, 17], // ravine crossing on the mid pillar
        [122, 15], [128, 9], [132, 7], [136, 7], // node mound + crop-circle door
        [147, 19], [170, 19], // boss bowl → road → gate
      ].map(([c, r]) => P(c, r)),
      '#f4f4f4',
      2.2,
      [CELL * 1.5, CELL]
    );
    // LOWER route A (blue): the basin pit beneath the drone valley
    line(
      [[60, 19], [63, 25], [68, 29], [74, 29], [78, 25]].map(([c, r]) => P(c, r)),
      '#35a7ff',
      1.8
    );
    // LOWER route B (blue): fall into the ravine → recovery shelf → climb the lip
    line(
      [[105, 14], [108, 29], [111, 25], [109, 22], [112, 19], [117, 17]].map(([c, r]) => P(c, r)),
      '#35a7ff',
      1.8
    );
    // UPPER secret (cyan): Will's tall hidden climb to the WILLOW badge
    line(
      [
        [84, 25], [85, 23], [86, 21], [85, 19], [86, 17], [85, 15], [86, 13], [85, 11], [86, 9], [85, 7], [87, 5],
      ].map(([c, r]) => P(c, r)),
      '#35d5ff',
      1.8
    );

    // ---- markers ----
    // descents ▼
    for (const [c, r] of [[15, 11], [59, 17], [105, 12], [137, 6]] as Array<[number, number]>) tri(c, r, false, '#ff7a3b');
    // climbs ▲
    for (const [c, r] of [[31, 19], [94, 18], [110, 23], [126, 11]] as Array<[number, number]>) tri(c, r, true, '#a8ff3e');
    tri(85, 14, true, '#35d5ff'); // Will's secret climb
    // rejoin ◯ (lower routes fold back into the main path)
    circle(80, 24, '#f4f4f4', CELL);
    circle(116, 16, '#f4f4f4', CELL);
    // secret ✳ (Will's WILLOW badge, top of the upper climb)
    spark(87, 5, '#ffd54a');
    // boss ◎
    circle(147, 18, '#ff5040', CELL * 1.4, true);
    // checkpoints ▣ (QA teleport anchors = the real beat waypoints)
    for (const [c, r] of [
      [4, 7], [27, 21], [38, 11], [76, 23], [86, 23], [132, 5], [150, 17],
    ] as Array<[number, number]>)
      square(c, r, '#fff3c9');
  }

  private sectionDebug(): string {
    return this.panel(
      'debug',
      'DEBUG / SAVE DATA',
      `
      <div class="cc-grid-2">
        <div class="cc-stat"><label>CURRENT SCENE</label><b id="cc-debug-scene">—</b></div>
        <div class="cc-stat"><label>TEST API</label><b id="cc-testapi">—</b></div>
      </div>
      <h3>PLAYER STATS</h3>
      <div class="cc-grid-2" id="cc-stats"></div>
      <h3>QUEST FLAGS</h3>
      <div class="cc-chips" id="cc-flags"></div>
      <h3>RAW SAVE (localStorage: blip_save_v1)</h3>
      <pre class="cc-json" id="cc-save-json"></pre>
      <button id="cc-reset-save" class="cc-btn danger">↺ RESET SAVE DATA</button>`,
      'cc-dev-only'
    );
  }

  private sectionTodo(): string {
    return this.panel(
      'todo',
      'BUILD TODO',
      `<ul class="cc-check">${BUILD_TODO.map(
        (t) => `<li class="${t.done ? 'done' : ''}">${t.done ? '☑' : '☐'} ${esc(t.label)}</li>`
      ).join('')}</ul>`,
      'cc-dev-only'
    );
  }

  private sectionQa(): string {
    return this.panel(
      'qa',
      'AI QA / PLAYTEST LAB',
      `
      <p class="cc-note">A core goal of this project: build and polish the game through AI-driven development —
      automated playtests, screenshot review, self-fixing loops — before any human has to test it.</p>
      <div id="cc-qa-panel"><p class="cc-note">Loading QA status…</p></div>
      <h3>HUMAN PLAYTEST CHECKLIST (what automation can't answer)</h3>
      <ul class="cc-check">${HUMAN_PLAYTEST_CHECKLIST.map((c) => `<li>☐ ${esc(c)}</li>`).join('')}</ul>
      <p class="cc-note">Run locally: <span class="key">npm run qa:full</span> · <span class="key">npm run qa:loop</span></p>`,
      'cc-dev-only'
    );
  }

  private sectionWebTech(): string {
    return this.panel(
      'webtech',
      'EXPERIMENTAL WEB TECH',
      `
      <div class="cc-grid-2">
        <div class="cc-stat"><label>WEBGPU (navigator.gpu)</label><b id="cc-webgpu">—</b></div>
        <div class="cc-stat"><label>RENDERER</label><b>Phaser 3 — WebGL w/ Canvas fallback</b></div>
      </div>
      <ul class="cc-list">${WEB_TECH_NOTES.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <p class="cc-note">WebGPU is detection-only — never part of the render path (scope-control skill).</p>`,
      'cc-dev-only'
    );
  }

  private sectionArt(): string {
    return this.panel(
      'art',
      'ART DIRECTION',
      `<ul class="cc-list">${ART_DIRECTION.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      <div class="cc-swatches">
        ${SCOUTS.map((s) => `<span class="cc-swatch" style="--sw:${colorHex(s.color)}" title="${esc(s.name)}">${esc(s.callsign)}</span>`).join('')}
      </div>`,
      'cc-dev-only'
    );
  }

  /* ------------------------------- live refresh ------------------------------ */

  refresh(): void {
    this.applyDevMode();
    const save = getSave();
    const set = (id: string, text: string) => {
      const el = this.root.querySelector('#' + id);
      if (el) el.textContent = text;
    };

    set('cc-scene', this.standalone ? 'STANDALONE PAGE (game not running here)' : this.lastScene);
    set('cc-zone', this.standalone ? '— open the game for live telemetry —' : this.lastZone);
    set('cc-objective', this.standalone ? `save says: ${save.questStep}` : this.lastObjective);
    set('cc-saved-at', save.savedAt ? new Date(save.savedAt).toLocaleString() : 'NO SAVE YET');
    set('cc-fragments', `${save.signalFragments} / ?`);
    set('cc-prog-fragments', `${save.signalFragments} / ?`);
    set('cc-prog-shards', `${save.shards ?? 0} ◈`);
    set('cc-prog-next', this.lastObjective);
    set('cc-debug-scene', this.standalone ? 'STANDALONE' : this.lastScene);
    set('cc-testapi', (window as unknown as Record<string, unknown>).__BLIP_TEST_API__ ? 'ACTIVE' : 'DISABLED (prod)');
    set('cc-webgpu', 'gpu' in navigator ? 'SUPPORTED ✦' : 'NOT AVAILABLE — game unaffected');

    // reward system status
    const col = rewards.collection();
    const tp = rewards.trophyProgress();
    set('cc-rw-caches', String(rewards.totalCaches()));
    set('cc-rw-collection', `${Math.round(col.percent * 100)}%`);
    set('cc-rw-trophies', `${tp.unlocked} / ${tp.total}`);
    set('cc-rw-dust', `${rewards.dust()} ✦`);
    set('cc-rw-medals', String(rewards.medals()));
    const topRare = rewards.recentRares(1)[0];
    set('cc-rw-recent-top', topRare ? (rewardById(topRare.id.replace(/^trophy:|^cache:/, ''))?.name ?? RARITIES[topRare.rarity as RarityId]?.name ?? '—') : '—');
    const cacheChips = this.root.querySelector('#cc-rw-cachechips');
    if (cacheChips) {
      const chips = CACHE_ORDER.map((t) => {
        const n = rewards.cacheCount(t);
        return `<span class="cc-chip${n > 0 ? ' ok' : ''}"><i class="cc-legend-swatch" style="background:${CACHES[t].color}"></i>${esc(CACHES[t].name)}: <b>${n}</b></span>`;
      }).join('');
      cacheChips.innerHTML = chips;
    }
    const recentEl = this.root.querySelector('#cc-rw-recent');
    if (recentEl) {
      const recent = save.rewards.recent.slice(0, 10);
      recentEl.innerHTML = recent.length
        ? recent
            .map((r) => {
              const rar = RARITIES[r.rarity as RarityId];
              const label = r.id.startsWith('trophy:')
                ? (trophyById(r.id.slice(7))?.name ?? 'Trophy')
                : r.id.startsWith('cache:')
                  ? (CACHES[r.id.slice(6) as keyof typeof CACHES]?.name ?? 'Cache')
                  : (rewardById(r.id)?.name ?? r.id);
              return `<span class="cc-chip" style="border-color:${rar?.color ?? '#8a5e20'}"><i class="cc-legend-swatch" style="background:${rar?.color ?? '#8a5e20'}"></i>${esc(label)}</span>`;
            })
            .join('')
        : `<span class="cc-chip">No rewards intercepted yet — play to earn caches.</span>`;
    }

    // story bible: decrypt fragment-locked entries
    this.root.querySelectorAll('.cc-bible-body[data-locked="1"]').forEach((el) => {
      const locked = !save.flags.firstFragmentCollected;
      const article = el.closest('.cc-card');
      if (locked) {
        el.textContent = '▓▓▓▓ ▓▓▓ ▓▓▓▓▓▓ — ENCRYPTED. Collect the first Signal Fragment to decrypt.';
        article?.classList.add('locked');
      } else {
        const entry = GAME_BIBLE.find((b) => b.id === (article as HTMLElement | null)?.dataset.bible);
        if (entry) el.textContent = entry.body;
        article?.classList.remove('locked');
      }
    });

    // scouts
    const discovered = new Set(save.discoveredScoutBadges);
    set('cc-scouts-count', `${discovered.size} / 5 DISCOVERED`);
    const grid = this.root.querySelector('#cc-scouts-grid');
    if (grid) {
      grid.innerHTML = SCOUTS.map((s) => {
        const known = discovered.has(s.id);
        if (!known) {
          return `<article class="cc-card scout unknown" style="--sw:${colorHex(s.color)}">
            <header><b>UNKNOWN SCOUT</b><span class="cc-chip">SIGNAL ${esc(s.colorName).toUpperCase()}</span></header>
            <p>A ${esc(s.colorName)} trace in the field data. Someone small, brave, and long gone from here.</p>
            <p class="cc-kv"><label>STATUS</label> Scan Miller Field for their trail.</p>
          </article>`;
        }
        return `<article class="cc-card scout" style="--sw:${colorHex(s.color)}">
          <header><b>${esc(s.name).toUpperCase()} / ${esc(s.callsign)}</b><span class="cc-chip ok">DISCOVERED</span></header>
          <p class="cc-zone-tag">${esc(s.role)}</p>
          <p>${esc(s.personality)}.</p>
          <p class="cc-kv"><label>THEME</label> ${esc(s.theme)}</p>
          <p class="cc-kv"><label>GAMEPLAY</label> ${esc(s.gameplay)}</p>
          <p class="cc-kv"><label>ZONE</label> ${esc(s.zone)}</p>
        </article>`;
      }).join('');
    }
    const logsEl = this.root.querySelector('#cc-scout-logs');
    if (logsEl) {
      const found = SCOUT_LOGS.filter((l) => save.discoveredScoutLogs.includes(l.id));
      logsEl.innerHTML = found.length
        ? `<h3>RECOVERED SCOUT LOGS</h3>` +
          found
            .map((l) => `<article class="cc-card log"><header><b>${esc(l.title)}</b></header><p>${esc(l.body)}</p></article>`)
            .join('')
        : `<p class="cc-note">No scout logs recovered yet. Will's trail starts where the grass looks wrong.</p>`;
    }

    // signal portraits (collectible cards — the painted art, Command Center only)
    const earnedPortraits = new Set(save.earnedPortraits);
    set('cc-portraits-count', `${earnedPortraits.size} / 5 RECOVERED`);
    const portraitsGrid = this.root.querySelector('#cc-portraits-grid');
    if (portraitsGrid) {
      portraitsGrid.innerHTML = SCOUTS.map((s) => {
        if (!earnedPortraits.has(s.id)) {
          return `<article class="cc-card portrait unknown" style="--sw:${colorHex(s.color)}">
            <header><b>UNKNOWN SCOUT</b><span class="cc-chip">SIGNAL ${esc(s.colorName).toUpperCase()}</span></header>
            <div class="cc-portrait-frame locked"><span>◍ SIGNAL TOO WEAK</span></div>
            <p class="cc-kv"><label>RECOVER</label> Complete ${esc(s.name)}’s Signal Set in ${esc(s.zone)}.</p>
          </article>`;
        }
        return `<article class="cc-card portrait" style="--sw:${colorHex(s.color)}">
          <header><b>${esc(s.name).toUpperCase()} / ${esc(s.callsign)}</b><span class="cc-chip ok">RECOVERED</span></header>
          <div class="cc-portrait-frame"><img class="cc-portrait-img" src="/assets/portraits/${s.id}.png" alt="${esc(s.name)}" loading="lazy" onerror="this.closest('.cc-portrait-frame').classList.add('missing')" /></div>
          <p class="cc-zone-tag">${esc(s.role)}</p>
        </article>`;
      }).join('');
    }

    // scout field notes
    const notes = new Set(save.discoveredFieldNotes);
    set('cc-fieldnotes-count', `${notes.size} / ${FIELD_NOTES.length} RECOVERED`);
    const notesGrid = this.root.querySelector('#cc-fieldnotes-grid');
    if (notesGrid) {
      notesGrid.innerHTML = FIELD_NOTES.map((n) => {
        const scout = SCOUTS.find((s) => s.id === n.scoutId);
        const sw = scout ? colorHex(scout.color) : '';
        if (!notes.has(n.id)) {
          return `<article class="cc-card note unknown" style="--sw:${sw}">
            <header><b>UNREAD PAGE</b><span class="cc-chip">${scout ? esc(scout.callsign) : 'SCOUT'}</span></header>
            <p>A folded notebook page. Scan where the ${scout ? esc(scout.colorName) : ''} trace runs strongest.</p>
          </article>`;
        }
        return `<article class="cc-card note" style="--sw:${sw}">
          <header><b>${esc(n.title)}</b><span class="cc-chip ok">${scout ? esc(scout.callsign) : ''}</span></header>
          <p class="cc-note-body">${esc(n.body)}</p>
          <p class="cc-kv"><label>TEACHES</label> ${esc(n.hint)}</p>
        </article>`;
      }).join('');
    }

    // wardrobe
    const wardrobe = this.root.querySelector('#cc-wardrobe-grid');
    if (wardrobe) {
      const selected = save.selectedSkin;
      set('cc-skin-current', skinById(selected).name);
      wardrobe.innerHTML = SKINS.map((skin) => {
        const unlocked = save.unlockedSkins.includes(skin.id);
        const isSel = skin.id === selected;
        const sw = colorHex(skin.color);
        const prog = skin.scoutId ? setProgress(skin.scoutId) : { count: 3 };
        const lockLine = skin.scoutId
          ? unlocked
            ? `<span class="cc-chip ok">UNLOCKED</span>`
            : `<span class="cc-chip">${prog.count}/3 PIECES</span>`
          : `<span class="cc-chip ok">BASELINE</span>`;
        const btn = isSel
          ? `<button class="cc-skin-select" data-skin="${skin.id}" disabled>◆ EQUIPPED</button>`
          : unlocked
            ? `<button class="cc-skin-select" data-skin="${skin.id}">SELECT</button>`
            : `<button class="cc-skin-select" data-skin="${skin.id}" disabled>LOCKED</button>`;
        return `<article class="cc-card skin ${unlocked ? '' : 'locked'} ${isSel ? 'equipped' : ''}" style="--sw:${sw}">
          <header><b>${esc(skin.name)}</b>${lockLine}</header>
          <p class="cc-zone-tag">${esc(skin.klass)} — ${esc(skin.fantasy)}</p>
          ${unlocked || !skin.scoutId ? `<p><b class="ok">PASSIVE</b> ${esc(skin.passive)}</p><p><b class="warn">SIGNATURE</b> ${esc(skin.signature)}</p><p><b class="bad">TRADEOFF</b> ${esc(skin.tradeoff)}</p>` : `<p>Wear ${esc(skin.scoutName)}’s frequency. Gather their Signal Set in ${esc(this.zoneOf(skin.scoutId))} to unlock.</p>`}
          <p class="cc-kv"><label>BEST IN</label> ${esc(skin.bestIn)}</p>
          ${btn}
        </article>`;
      }).join('');
    }

    // quest steps
    const stepsEl = this.root.querySelector('#cc-quest-steps');
    if (stepsEl) {
      const completed = new Set(save.completedQuestSteps);
      stepsEl.innerHTML = THE_FIRST_CONTACT.steps
        .map((s) => {
          const done = completed.has(s.id);
          const current = save.questStep === s.id;
          return `<li class="${done ? 'done' : ''} ${current ? 'current' : ''}">${done ? '☑' : current ? '▸' : '☐'} ${esc(s.objective)}</li>`;
        })
        .join('');
    }

    // abilities
    const abEl = this.root.querySelector('#cc-abilities');
    if (abEl) {
      abEl.innerHTML = save.unlockedAbilities.map((a) => `<span class="cc-chip ok">${esc(a)}</span>`).join('');
    }

    // stats + flags
    const statsEl = this.root.querySelector('#cc-stats');
    if (statsEl) {
      const st = save.playerStats;
      statsEl.innerHTML = Object.entries({
        deaths: st.deaths,
        'enemies defeated': st.enemiesDefeated,
        'scans used': st.scansUsed,
        'pulse shots': st.pulseShotsFired,
        'time played': `${Math.floor(st.timePlayedSec / 60)}m ${st.timePlayedSec % 60}s`,
      })
        .map(([k, v]) => `<div class="cc-stat"><label>${esc(k.toUpperCase())}</label><b>${esc(String(v))}</b></div>`)
        .join('');
    }
    const flagsEl = this.root.querySelector('#cc-flags');
    if (flagsEl) {
      flagsEl.innerHTML = Object.entries(save.flags)
        .map(([k, v]) => `<span class="cc-chip ${v ? 'ok' : ''}">${esc(k)}: ${v ? 'YES' : 'no'}</span>`)
        .join('');
    }

    const jsonEl = this.root.querySelector('#cc-save-json');
    if (jsonEl) jsonEl.textContent = saveAsJson();

    this.renderQa();
  }

  private async loadQa(): Promise<void> {
    try {
      const res = await fetch('/qa-status.json', { cache: 'no-store' });
      if (res.ok) this.qa = (await res.json()) as QaStatus;
    } catch {
      this.qa = null;
    }
    this.renderQa();
  }

  private renderQa(): void {
    const el = this.root.querySelector('#cc-qa-panel');
    if (!el) return;
    if (!this.qa) {
      el.innerHTML = `<div class="cc-stat"><label>STATUS</label><b class="warn">NO QA DATA — run npm run qa:loop</b></div>`;
      return;
    }
    const q = this.qa;
    const badgeCls = q.status === 'READY FOR HUMAN PLAYTESTING' ? 'ok' : q.status === 'NEEDS FIXES' ? 'bad' : 'warn';
    el.innerHTML = `
      <div class="cc-grid-2">
        <div class="cc-stat"><label>STATUS</label><b class="${badgeCls}">${esc(q.status)}</b></div>
        <div class="cc-stat"><label>LAST RUN</label><b>${q.lastRun ? esc(new Date(q.lastRun).toLocaleString()) : '—'}</b></div>
        <div class="cc-stat"><label>RESULT</label><b class="${q.result === 'PASS' ? 'ok' : 'bad'}">${esc(q.result)}</b></div>
        <div class="cc-stat"><label>ITERATION</label><b>${q.iteration}</b></div>
      </div>
      <h3>AUTOMATED CHECKS</h3>
      <div class="cc-chips">${Object.entries(q.categories)
        .map(([k, v]) => `<span class="cc-chip ${v === 'PASS' ? 'ok' : v === 'FAIL' ? 'bad' : ''}">${esc(k)}: ${esc(v)}</span>`)
        .join('')}</div>
      ${q.bugsFound.length ? `<h3>FINDINGS</h3><ul class="cc-list">${q.bugsFound.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${q.bugsFixed.length ? `<h3>FIXED THIS ITERATION</h3><ul class="cc-list">${q.bugsFixed.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${q.remaining.length ? `<h3>REMAINING</h3><ul class="cc-list">${q.remaining.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      ${q.screenshots.length ? `<h3>SNAPSHOTS</h3><div class="cc-chips">${q.screenshots.map((s) => `<span class="cc-chip">${esc(s)}</span>`).join('')}</div>` : ''}
      ${q.note ? `<p class="cc-note">${esc(q.note)}</p>` : ''}`;
  }
}
