/**
 * COMMAND CENTER — the mission-control overlay.
 * Story bible, the Five Signal Scouts, mechanics, controls, progression,
 * zones, player-facing collection/status pages, plus dev-only playbook/QA
 * sections when running a dev build, standalone dashboard, ?test, or god mode.
 */
import './commandCenter.css';
import type Phaser from 'phaser';
import { BUILD_VERSION, EVT, SWEEP } from '../game/config';
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
import { SWEEP_ARENAS, type SweepArena } from '../game/data/sweepArenas';
import { SCOUTS, SCOUT_LOGS } from '../game/data/scouts';
import { FIELD_NOTES } from '../game/data/fieldNotes';
import { UPGRADES } from '../game/data/upgrades';
import { rewards } from '../game/systems/RewardSystem';
import { RARITIES, type RarityId } from '../game/data/rewards';
import { CACHES, CACHE_ORDER } from '../game/data/caches';
import { rewardById } from '../game/data/rewards';
import { trophyById } from '../game/data/trophies';
import { devState } from '../game/systems/DevState';
import {
  ART_DIRECTION,
  BUILD_TODO,
  CONTROLS_ROUTES,
  CONTROLS_DEBUG,
  CONTROLS_FIELD,
  CONTROLS_GAMEPAD,
  CONTROLS_SWEEP,
  CONTROLS_TOUCH,
  CURRENT_STATUS,
  HUMAN_PLAYTEST_CHECKLIST,
  MASTER_BACKLOG_COUNTS,
  MASTER_BACKLOG_CRITICAL_PATH,
  MASTER_BACKLOG_DEFERRED,
  MECHANICS,
  PITCH,
  REGION_VERTICAL_SLICE_PLAN,
  SUBTITLE,
  TAGLINE,
  VERTICAL_SLICE_SYSTEMS,
  WEB_TECH_NOTES,
  type ControlRow,
} from '../game/data/commandCenterData';
import { THE_FIRST_CONTACT } from '../game/data/quests';
import { WEAPONS } from '../game/data/sweepWeapons';
import { bus } from '../game/systems/EventBus';
import { getSave, resetSave, saveAsJson } from '../game/systems/SaveSystem';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const colorHex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

interface AiLabReport {
  generatedAt: string;
  label: string;
  runMs: number;
  seeds: number[];
  guardrails: string[];
  summary: {
    completionRate: number;
    fullRouteCompletionRate?: number;
    objectiveCompleteRate?: number;
    leastUsedWeapon: string;
    mostIgnoredRewards: number;
    mostConfusingObjective: string;
    mostRepetitiveEncounter: string;
    likelyBoredomFlags: string[];
    likelyFrustrationFlags: string[];
    personas: Record<string, { completionRate: number; averageDeaths: number; averageStuckEvents: number }>;
  };
  runs: Array<{
    persona: string;
    seed: number;
    result: string;
    durationMs: number;
    regionsReached: string[];
    regionsCompleted: string[];
    deaths: number;
    stuckEvents: number;
    objectiveFailures: number;
    weaponUsage: Record<string, number>;
    weaponSwitches: number;
    phaseShiftUses: number;
    secretsFound: number;
    maxNode?: number;
    breachOpened?: boolean;
    lootSeen: number;
    lootIgnored: number;
    lootCollected: number;
    boredomFlags: string[];
    frustrationFlags: string[];
    screenshots: string[];
  }>;
}

export class CommandCenter {
  private root: HTMLElement;
  private lastScene = 'BootScene';
  private lastZone = 'Boot';
  private lastObjective = THE_FIRST_CONTACT.steps[0].objective;
  private refreshTimer: number | null = null;
  private readonly standalone: boolean;
  private atlasesDrawn = false;
  private aiLabReport: AiLabReport | null = null;

  constructor(root: HTMLElement, opts?: { standalone?: boolean; game?: Phaser.Game }) {
    this.root = root;
    this.standalone = opts?.standalone === true;
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
    void this.loadAiLabReport();
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
      ['mechanics', 'MECHANICS'],
      ['controls', 'CONTROLS'],
      ['progression', 'PROGRESSION'],
      ['sweeparenas', 'WORLD AREAS'],
      ['bestiary', 'BESTIARY'],
      ['arsenal', 'ARSENAL'],
      ['debug', 'DEBUG / SAVE', true],
      ['todo', 'BUILD TODO', true],
      ['qa', 'AI QA LAB', true],
      ['aiplayerlab', 'AI PLAYER LAB', true],
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
            ${this.sectionMechanics()}
            ${this.sectionControls()}
            ${this.sectionProgression()}
            ${this.sectionSweepArenas()}
            ${this.sectionBestiary()}
            ${this.sectionArsenal()}
            ${this.sectionDebug()}
            ${this.sectionTodo()}
            ${this.sectionQa()}
            ${this.sectionAiPlayerLab()}
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
    (this.root.querySelector('#cc-clear-local-save') as HTMLButtonElement).addEventListener('click', () => {
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
  }

  private buildCommit(): string {
    return (document.querySelector('meta[name="blip-deploy-commit"]') as HTMLMetaElement | null)?.content || 'unknown (dev build — not stamped)';
  }

  private buildGeneratedAt(): string {
    const stamped = (document.querySelector('meta[name="blip-deploy-built-at"]') as HTMLMetaElement | null)?.content;
    return stamped ? new Date(stamped).toLocaleString() : new Date().toLocaleString() + ' (dev build — export time, not build time)';
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
        <div class="cc-stat"><label>PLAYABLE STATUS</label><b class="ok">ROUTE-CONNECTED ARENA FOUNDATION</b></div>
        <div class="cc-stat"><label>CURRENT SCENE</label><b id="cc-scene">—</b></div>
        <div class="cc-stat"><label>CURRENT ZONE</label><b id="cc-zone">—</b></div>
        <div class="cc-stat"><label>ACTIVE QUEST</label><b>${esc(THE_FIRST_CONTACT.name).toUpperCase()}</b></div>
        <div class="cc-stat"><label>CURRENT OBJECTIVE</label><b id="cc-objective">—</b></div>
        <div class="cc-stat"><label>SAVE STATUS</label><b id="cc-saved-at">—</b></div>
        <div class="cc-stat"><label>SIGNAL FRAGMENTS</label><b id="cc-fragments" class="ok">0 / ?</b></div>
      </div>
      <h3>CURRENT IMPLEMENTATION SNAPSHOT</h3>
      <ul class="cc-check">${CURRENT_STATUS.map((s) => `<li>☑ ${esc(s)}</li>`).join('')}</ul>`
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
        ${this.controlTable('TOP-DOWN COMBAT', CONTROLS_SWEEP)}
        ${this.controlTable('AREA ROUTES', CONTROLS_ROUTES)}
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
    const weaponRows = Object.values(WEAPONS).map((w) => [
      w.name,
      w.role,
      `${w.damage} dmg · ${w.cooldownMs}ms cadence · ${w.speed ? `${w.speed}px/s` : 'melee arc'}`,
    ] as [string, string, string]);
    const rows: Array<[string, string, string]> = [
      ['Move', `${SWEEP.moveSpeed}px/s · accel ${SWEEP.accel}`, `drag ${SWEEP.drag} · camera zoom ${SWEEP.cameraZoom}`],
      ['Phase Shift', `${SWEEP.dashSpeed}px/s for ${SWEEP.dashMs}ms`, `cooldown ${SWEEP.dashCooldownMs}ms · phase-chain refund ${SWEEP.dashRefundOnPhaseKill ? 'on' : 'off'}`],
      ['Scan Pulse', `radius ${SWEEP.scanRadius}px`, `${SWEEP.scanDmg} dmg · reveals hidden Signal Caches`],
      ['Signal Node', `${SWEEP.nodeChargeDefault} charge target`, `${SWEEP.nodeChargePerKill} per kill · double within ${SWEEP.nodeChargeRadius}px`],
      ['Signal Overdrive', `${SWEEP.overdriveDurationMs}ms duration`, `shock radius ${SWEEP.overdriveShockRadius}px · ${SWEEP.overdriveShockDmg} dmg`],
      ['Hull', `${SWEEP.maxHp} hp`, `${SWEEP.invulnMs}ms invulnerability · knockback ${SWEEP.knockback}`],
      ['Caches / Shards', `${SWEEP.cacheShards} shards per cache`, `${SWEEP.shardsPerKill} shard per kill · ${SWEEP.shardsClearBonus} clear bonus`],
    ];
    return this.panel(
      'arsenal',
      'ARSENAL — CONTACT-47 TUNING',
      `<p class="cc-note">The live top-down movement/combat kit. Weapons read from <span class="key">sweepWeapons.ts</span>; movement, node, cache and overdrive numbers read from <span class="key">config.ts → SWEEP</span>.</p>
      <h3>LIVE WEAPONS</h3>
      <table class="cc-table">${weaponRows
        .map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td class="key">${esc(c)}</td></tr>`)
        .join('')}</table>
      <h3>CORE KIT</h3>
      <table class="cc-table">${rows
        .map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td class="key">${esc(b)}</td><td>${esc(c)}</td></tr>`)
        .join('')}</table>`
    );
  }

  /** paint the route-connected top-down area grids onto the atlas canvases */
  private drawAtlases(): void {
    Object.values(SWEEP_ARENAS).forEach((a) => this.paintSweepArena(`cc-sweep-${a.id}`, a));
  }

  /* --------------------- top-down route-connected areas -------------------- */

  private sectionSweepArenas(): string {
    const cards = Object.values(SWEEP_ARENAS)
      .filter((a) => a.mode === 'traverse')
      .map(
        (a) => `
      <h3>${esc(a.label)} — ${a.grid.w}×${a.grid.h} tiles · ${esc(a.biome)} biome · route → ${esc(a.nextLabel ?? 'end')}</h3>
      <div class="cc-atlas-wrap"><canvas id="cc-sweep-${a.id}" class="cc-atlas"></canvas></div>`
      )
      .join('');
    return this.panel(
      'sweeparenas',
      'TOP-DOWN ROUTE AREAS',
      `
      <p class="cc-note">The current BLIP world is top-down only. These are route-connected arena maps, not one seamless open map yet. Fast breach handoffs preserve save and runtime player state so the chain plays as one route.
      <span style="color:#a8ff3e">◉</span> signal node · <span style="color:#7cfc9b">◉</span> breach (exit) · <span style="color:#f2a93b">◉</span> elite Classifier · <span style="color:#d84a42">◉</span> drones · <span style="color:#7c5cff">◉</span> caches · <span style="color:#fff3c9">◉</span> spawn.</p>
      ${cards}
      <p class="cc-note"><b>town-z3</b> is the first Chagrin Falls connector pass: exterior buildings, town streets, bridge lanes, and stadium-edge cover without enterable interiors.</p>`,
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
      <button id="cc-clear-local-save" class="cc-btn danger">↺ CLEAR LOCAL SAVE DATA</button>`,
      'cc-dev-only'
    );
  }

  private sectionTodo(): string {
    return this.panel(
      'todo',
      'BUILD TODO',
      `<h3>MASTER BACKLOG RECONCILIATION</h3>
      <p class="cc-note"><span class="key">MASTER_GAME_BACKLOG.md</span> is the source of truth. This panel mirrors its status counts, current critical path, and deferred/cut systems so future sessions do not chase stale prompts.</p>
      <div class="cc-grid-3">
        ${MASTER_BACKLOG_COUNTS.map((c) => `<div class="cc-stat"><label>${esc(c.status)}</label><b>${c.count}</b></div>`).join('')}
      </div>
      <h3>VERTICAL-SLICE CRITICAL PATH</h3>
      <table class="cc-table cc-status-table">
        <tr><th>PRIORITY</th><th>ITEM</th><th>STATUS</th><th>NOTE</th></tr>
        ${MASTER_BACKLOG_CRITICAL_PATH.map(
          (i) => `<tr><td class="key">${esc(i.priority)}</td><td><b>${esc(i.item)}</b></td><td>${esc(i.status)}</td><td>${esc(i.note)}</td></tr>`
        ).join('')}
      </table>
      <h3>DEFERRED / CUT GUARDRAILS</h3>
      <table class="cc-table cc-status-table">
        ${MASTER_BACKLOG_DEFERRED.map(
          (i) => `<tr><td class="key">${esc(i.priority)}</td><td><b>${esc(i.item)}</b></td><td>${esc(i.status)}</td><td>${esc(i.note)}</td></tr>`
        ).join('')}
      </table>
      <h3>IMPLEMENTATION CHECKLIST</h3>
      <ul class="cc-check">${BUILD_TODO.map(
        (t) => `<li class="${t.done ? 'done' : ''}">${t.done ? '☑' : '☐'} ${esc(t.label)}</li>`
      ).join('')}</ul>
      <h3>VERTICAL SLICE SYSTEM STATUS</h3>
      <table class="cc-table cc-status-table">
        ${VERTICAL_SLICE_SYSTEMS.map(
          (s) => `<tr><td><b>${esc(s.name)}</b></td><td class="key">${esc(s.status)}</td><td>${esc(s.note)}</td></tr>`
        ).join('')}
      </table>
      <h3>REGION PURPOSE MAP</h3>
      <table class="cc-table cc-region-plan">
        <tr><th>REGION</th><th>PURPOSE</th><th>OBJECTIVE</th><th>TRAVERSAL / COMBAT / SECRET</th><th>CONNECTION</th><th>STATE</th></tr>
        ${REGION_VERTICAL_SLICE_PLAN.map(
          (r) => `<tr>
            <td><b>${esc(r.region)}</b></td>
            <td>${esc(r.purpose)}</td>
            <td>${esc(r.objective)}</td>
            <td>${esc(r.traversal)}<br>${esc(r.combat)}<br>${esc(r.secret)}</td>
            <td>${esc(r.connection)}</td>
            <td class="key">${esc(r.state)}</td>
          </tr>`
        ).join('')}
      </table>`,
      'cc-dev-only'
    );
  }

  private sectionQa(): string {
    return this.panel(
      'qa',
      'AI QA / PLAYTEST LAB',
      `
      <p class="cc-note">A core goal of this project: build and polish the game through AI-driven development —
      automated checks and browser smoke tests before any human has to test it.</p>
      <div class="cc-grid-2">
        <div class="cc-stat"><label>TYPECHECK</label><b class="ok">npm run typecheck</b></div>
        <div class="cc-stat"><label>BUILD</label><b class="ok">npm run build</b></div>
        <div class="cc-stat"><label>SMOKE</label><b class="ok">npm run test:e2e</b></div>
        <div class="cc-stat"><label>FULL GATE</label><b class="ok">npm run qa:full</b></div>
      </div>
      <h3>HUMAN PLAYTEST CHECKLIST (what automation can't answer)</h3>
      <ul class="cc-check">${HUMAN_PLAYTEST_CHECKLIST.map((c) => `<li>☐ ${esc(c)}</li>`).join('')}</ul>
      <p class="cc-note">Run locally: <span class="key">npm run qa:full</span> · <span class="key">npm run qa:loop</span></p>`,
      'cc-dev-only'
    );
  }

  private sectionAiPlayerLab(): string {
    return this.panel(
      'aiplayerlab',
      'AI PLAYER LAB',
      `
      <p class="cc-note">Persona bots use limited visible perception and imperfect virtual inputs. These metrics are warning signals, not proof of fun.</p>
      <div class="cc-grid-3" id="cc-ai-lab-summary">
        <div class="cc-stat"><label>REPORT</label><b>loading…</b></div>
      </div>
      <h3>GUARDRAILS</h3>
      <ul class="cc-check" id="cc-ai-lab-guardrails"><li>loading…</li></ul>
      <h3>PERSONA SUMMARY</h3>
      <table class="cc-table" id="cc-ai-lab-personas"><tr><td>loading…</td></tr></table>
      <h3>RUN EVIDENCE</h3>
      <table class="cc-table cc-ai-runs" id="cc-ai-lab-runs"><tr><td>loading…</td></tr></table>
      <p class="cc-note"><a class="cc-btn" href="/ai-playtest/latest.json" target="_blank" rel="noopener">EXPORT JSON</a></p>`,
      'cc-dev-only'
    );
  }

  private async loadAiLabReport(): Promise<void> {
    try {
      const res = await fetch('/ai-playtest/latest.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.aiLabReport = (await res.json()) as AiLabReport;
    } catch {
      this.aiLabReport = null;
    }
    this.renderAiLabReport();
  }

  private renderAiLabReport(): void {
    const summaryEl = this.root.querySelector('#cc-ai-lab-summary');
    const guardsEl = this.root.querySelector('#cc-ai-lab-guardrails');
    const personasEl = this.root.querySelector('#cc-ai-lab-personas');
    const runsEl = this.root.querySelector('#cc-ai-lab-runs');
    if (!summaryEl || !guardsEl || !personasEl || !runsEl) return;
    const report = this.aiLabReport;
    if (!report) {
      summaryEl.innerHTML = `<div class="cc-stat"><label>REPORT</label><b class="warn">NO REPORT FOUND</b></div>`;
      guardsEl.innerHTML = `<li>Run <span class="key">npm run qa:ai</span> to generate <span class="key">public/ai-playtest/latest.json</span>.</li>`;
      personasEl.innerHTML = `<tr><td>No AI Player Lab data yet.</td></tr>`;
      runsEl.innerHTML = `<tr><td>No run evidence yet.</td></tr>`;
      return;
    }
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    summaryEl.innerHTML = `
      <div class="cc-stat"><label>REPORT</label><b>${esc(report.label.toUpperCase())}</b></div>
      <div class="cc-stat"><label>GENERATED</label><b>${esc(new Date(report.generatedAt).toLocaleString())}</b></div>
      <div class="cc-stat"><label>SEEDS</label><b>${esc(report.seeds.join(', '))}</b></div>
      <div class="cc-stat"><label>LOCAL OBJECTIVE SUCCESS</label><b class="${report.summary.completionRate > 0 ? 'ok' : 'warn'}">${pct(report.summary.completionRate)}</b></div>
      <div class="cc-stat"><label>FULL ROUTE CLEARS</label><b class="${(report.summary.fullRouteCompletionRate ?? 0) > 0 ? 'ok' : 'warn'}">${pct(report.summary.fullRouteCompletionRate ?? 0)}</b></div>
      <div class="cc-stat"><label>BREACH-OPEN DRILLS</label><b>${pct(report.summary.objectiveCompleteRate ?? 0)}</b></div>
      <div class="cc-stat"><label>LEAST USED WEAPON</label><b class="warn">${esc(report.summary.leastUsedWeapon)}</b></div>
      <div class="cc-stat"><label>IGNORED LOOT</label><b>${report.summary.mostIgnoredRewards}</b></div>
      <div class="cc-stat"><label>CONFUSING OBJECTIVE</label><b>${esc(report.summary.mostConfusingObjective)}</b></div>
      <div class="cc-stat"><label>REPETITIVE ENCOUNTER</label><b>${esc(report.summary.mostRepetitiveEncounter)}</b></div>
      <div class="cc-stat"><label>FLAGS</label><b>${esc([...report.summary.likelyBoredomFlags, ...report.summary.likelyFrustrationFlags].join(' · ') || 'none')}</b></div>`;
    guardsEl.innerHTML = report.guardrails.map((g) => `<li>☑ ${esc(g)}</li>`).join('');
    personasEl.innerHTML = `<tr><th>PERSONA</th><th>COMPLETION</th><th>AVG DEATHS</th><th>AVG STUCK</th></tr>` +
      Object.entries(report.summary.personas)
        .map(([name, p]) => `<tr><td><b>${esc(name)}</b></td><td class="key">${pct(p.completionRate)}</td><td>${p.averageDeaths.toFixed(1)}</td><td>${p.averageStuckEvents.toFixed(1)}</td></tr>`)
        .join('');
    runsEl.innerHTML = `<tr><th>PERSONA</th><th>SEED</th><th>RESULT</th><th>REGIONS</th><th>DEATHS</th><th>STUCK</th><th>WEAPONS</th><th>FLAGS</th><th>EVIDENCE</th></tr>` +
      report.runs
        .slice(0, 18)
        .map((r) => {
          const weapons = Object.entries(r.weaponUsage).map(([k, v]) => `${k}:${v}`).join(' ');
          const flags = [...r.boredomFlags, ...r.frustrationFlags].join(' · ') || 'none';
          const shots = r.screenshots.map((s, i) => `<span class="cc-chip">${esc(`shot ${i + 1}`)}</span>`).join('');
          return `<tr><td><b>${esc(r.persona)}</b></td><td>${r.seed}</td><td class="key">${esc(r.result)}</td><td>${esc(r.regionsReached.join(' → ') || 'none')}</td><td>${r.deaths}</td><td>${r.stuckEvents}</td><td>${esc(weapons)}</td><td>${esc(flags)}</td><td>${shots}</td></tr>`;
        })
        .join('');
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
            <p>A ${esc(s.colorName)} trace in the field data. A brave Scout signature, still cutting through the noise.</p>
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
            <p>A marked notebook page. Scan where the ${scout ? esc(scout.colorName) : ''} trace runs strongest.</p>
          </article>`;
        }
        return `<article class="cc-card note" style="--sw:${sw}">
          <header><b>${esc(n.title)}</b><span class="cc-chip ok">${scout ? esc(scout.callsign) : ''}</span></header>
          <p class="cc-note-body">${esc(n.body)}</p>
          <p class="cc-kv"><label>TEACHES</label> ${esc(n.hint)}</p>
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
        'weapon shots': st.weaponShotsFired,
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

  }
}
