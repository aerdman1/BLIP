/**
 * RewardUI — the DOM/CSS reward layer for BLIP's Signal Cache system.
 * Lives beside ShellUI/CommandCenter (crisp HTML over the pixel canvas) so it's
 * readable + touchable on desktop / iPad / iPhone. Owns:
 *   1. cache-earned + trophy popups (top-center banners)
 *   2. the interactive Signal Cache OPENING screen (radar rings, flash, cards)
 *   3. the Signal ARCHIVE (collection terminal)
 * Driven entirely by EVT.* bus events + RewardSystem. Input works with
 * tap / click / keyboard / gamepad. See ui/rewardUI.css for the juice.
 */
import './rewardUI.css';
import type Phaser from 'phaser';
import { EVT, PAD, SCENES, REWARD_BANNER } from '../game/config';
import { bus } from '../game/systems/EventBus';
import { audio } from '../game/systems/AudioSystem';
import { readPad } from '../game/systems/PadSim';
import { pushRewardOverlay, popRewardOverlay } from '../game/systems/UIState';
import { getSave } from '../game/systems/SaveSystem';
import { rewards, type OpenResult, type OpenedReward } from '../game/systems/RewardSystem';
import { CACHES, CACHE_ORDER, type CacheType } from '../game/data/caches';
import {
  CATEGORY_LABEL,
  RARITIES,
  rewardsByCategory,
  type RarityId,
  type RewardCategory,
  type RewardDef,
} from '../game/data/rewards';
import { TROPHIES } from '../game/data/trophies';
import { SCOUTS } from '../game/data/scouts';
import { iconSvg } from './rewardIcons';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** cosmetic categories the player can equip as a loadout */
const EQUIPPABLE: RewardCategory[] = ['trail', 'ripple', 'pulsefx', 'echofx', 'skin'];

interface BannerPayload {
  kind: string;
  title: string;
  sub: string;
  desc?: string;
  color: string;
  icon: string;
  rarity: RarityId;
  big?: boolean;
}

type CacheState = 'idle' | 'revealing' | 'summary';

interface ArchiveTab {
  id: string;
  label: string;
  count: () => [number, number]; // [owned, total] for the tab chip
}

export class RewardUI {
  private game: Phaser.Game;
  private root: HTMLElement;
  private banners!: HTMLElement;
  private cacheEl!: HTMLElement;
  private archiveEl!: HTMLElement;

  private pausedScenes: string[] = [];
  private cacheOpen = false;
  private archiveOpen = false;

  // cache-opening state
  private cacheState: CacheState = 'idle';
  private cacheType: CacheType = 'small-signal';
  private revealTimers: number[] = [];
  private particles: Particle[] = [];
  private rafId: number | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  // banner queue — rewards reveal ONE AT A TIME, each with its own spotlight
  private bannerQueue: BannerPayload[] = [];
  private bannerActive = false;
  private bannerTimers: number[] = [];

  // archive state
  private activeTab = 'caches';

  // gamepad edge detection
  private prevPad: ReturnType<typeof readPad> = null;
  private prevPadX = 0;

  private gameplayScenes = [
    SCENES.field, SCENES.motel, SCENES.stadium, SCENES.underwater,
    SCENES.orchard, SCENES.skyline, SCENES.blipstream, SCENES.sweep,
  ];

  constructor(game: Phaser.Game) {
    this.game = game;
    this.root = document.createElement('div');
    this.root.id = 'reward-layer';
    (document.getElementById('app-shell') ?? document.body).appendChild(this.root);
    this.buildDom();
    this.wireBus();
    this.wireInput();
    this.startPadLoop();
  }

  /* ------------------------------ DOM scaffolding --------------------------- */

  private buildDom(): void {
    this.banners = document.createElement('div');
    this.banners.id = 'rw-banners';
    this.banners.setAttribute('aria-live', 'polite');

    this.cacheEl = document.createElement('div');
    this.cacheEl.id = 'rw-cache';
    this.cacheEl.className = 'rw-modal hidden';

    this.archiveEl = document.createElement('div');
    this.archiveEl.id = 'rw-archive';
    this.archiveEl.className = 'rw-modal hidden';

    this.root.append(this.banners, this.cacheEl, this.archiveEl);
  }

  private wireBus(): void {
    bus.on(EVT.rewardBanner, (d) => this.showBanner(d as BannerPayload));
    bus.on(EVT.rewardOpenArchive, () => this.openArchive());
    bus.on(EVT.rewardOpenCache, (d) => this.openCacheScreen((d as { cacheType?: CacheType } | undefined)?.cacheType));
  }

  /* ------------------------- shell modal pause plumbing --------------------- */
  // Mirror ShellUI: only pause scenes that are currently ACTIVE (isActive is
  // false for already-paused scenes), so opening the reward layer over the
  // Command Center never wrongly resumes gameplay underneath.

  private pushModal(): void {
    pushRewardOverlay();
    this.pausedScenes = this.gameplayScenes.filter((k) => this.game.scene.isActive(k));
    this.pausedScenes.forEach((k) => this.game.scene.pause(k));
  }

  private popModal(): void {
    popRewardOverlay();
    this.pausedScenes.forEach((k) => {
      if (this.game.scene.isPaused(k)) this.game.scene.resume(k);
    });
    this.pausedScenes = [];
  }

  /* ============================ 1. CACHE-EARNED POPUPS ===================== */

  /** Enqueue a reward banner. Reveals are strictly ONE AT A TIME (see pumpBanner). */
  private showBanner(p: BannerPayload): void {
    this.bannerQueue.push(p);
    this.pumpBanner();
  }

  /**
   * Reveal the next queued banner if the stage is clear. Only ever ONE banner is
   * on screen: enter → hold → exit → gap → next. A backlog shortens the dwell so
   * the player isn't stuck watching a parade, but they never stack.
   */
  private pumpBanner(): void {
    // hold everything back while the cache-opening screen owns the spotlight
    if (this.bannerActive || this.cacheOpen || this.bannerQueue.length === 0) return;
    const p = this.bannerQueue.shift() as BannerPayload;
    this.bannerActive = true;

    const color = p.color || '#a8ff3e';
    const remaining = this.bannerQueue.length;
    const el = document.createElement('div');
    el.className = `rw-banner${p.big ? ' big' : ''}`;
    el.style.setProperty('--c', color);
    el.style.setProperty('--rw-enter', `${REWARD_BANNER.enterMs}ms`);
    el.style.setProperty('--rw-exit', `${REWARD_BANNER.exitMs}ms`);
    const descHtml = p.desc ? `<div class="rw-b-desc">${esc(p.desc)}</div>` : '';
    // a small "+N more" chip tells the player extra rewards are still queued
    const moreHtml = remaining > 0 ? `<div class="rw-b-more">+${remaining}</div>` : '';
    el.innerHTML =
      `<div class="rw-b-shine"></div>` +
      `<div class="rw-b-icon">${iconSvg(p.icon, color)}</div>` +
      `<div class="rw-b-text">` +
      `<div class="rw-b-title">${esc(p.title)}</div>` +
      `<div class="rw-b-sub">${esc(p.sub)}</div>` +
      descHtml +
      `</div>` +
      moreHtml;
    // hard guarantee: nothing else is on the rail
    this.banners.innerHTML = '';
    this.banners.appendChild(el);
    try { audio.uiToggle(); } catch { /* audio best-effort */ }

    const hold = remaining >= REWARD_BANNER.backlogThreshold
      ? REWARD_BANNER.backlogHoldMs
      : p.big ? REWARD_BANNER.bigHoldMs : REWARD_BANNER.holdMs;
    const life = REWARD_BANNER.enterMs + hold;

    this.bannerTimers.push(window.setTimeout(() => el.classList.add('out'), life));
    this.bannerTimers.push(window.setTimeout(() => {
      el.remove();
      this.bannerActive = false;
      // brief beat, then the next reward gets its own moment
      this.bannerTimers.push(window.setTimeout(() => this.pumpBanner(), REWARD_BANNER.gapMs));
    }, life + REWARD_BANNER.exitMs));
  }

  /** Cache screen closed — resume revealing any rewards that queued behind it. */
  private flushDeferredBanners(): void {
    this.pumpBanner();
  }

  /* ============================ 2. CACHE-OPENING SCREEN =================== */

  /** Open the reveal screen. If no type given, pick the first the player owns. */
  openCacheScreen(type?: CacheType): void {
    let t = type;
    if (!t || rewards.cacheCount(t) <= 0) {
      t = CACHE_ORDER.find((c) => rewards.cacheCount(c) > 0);
    }
    if (!t) {
      bus.emit(EVT.toast, { text: 'NO SIGNAL CACHES TO OPEN', color: 'orange' });
      return;
    }
    this.cacheType = t;
    this.cacheState = 'idle';
    this.banners.innerHTML = '';
    this.renderCacheIdle();
    this.cacheEl.classList.remove('hidden');
    if (!this.cacheOpen) {
      this.cacheOpen = true;
      this.pushModal();
    }
    this.startCanvas();
  }

  private closeCacheScreen(): void {
    if (!this.cacheOpen) return;
    this.cacheOpen = false;
    this.clearRevealTimers();
    this.stopCanvas();
    this.cacheEl.classList.add('hidden');
    this.cacheEl.innerHTML = '';
    this.popModal();
    this.flushDeferredBanners();
    bus.emit(EVT.rewardChanged, {});
  }

  private renderCacheIdle(): void {
    const def = CACHES[this.cacheType];
    const count = rewards.cacheCount(this.cacheType);
    this.cacheEl.innerHTML =
      `<div class="rw-grid-bg"></div>` +
      `<canvas class="rw-cache-canvas"></canvas>` +
      `<div class="rw-beams" style="--cc:${def.color}"></div>` +
      `<div class="rw-flash"><div class="rw-flash-bg"></div><div class="rw-flash-word"></div></div>` +
      `<div class="rw-stage" style="--cc:${def.color}">` +
      `  <div class="rw-rings">${ringsSvg(def.color)}` +
      `    <div class="rw-cache-shell">` +
      `      <div class="rw-cache-glow" style="--cc:${def.color}"></div>` +
      `      ${iconSvg(def.icon, def.color)}` +
      `    </div>` +
      `  </div>` +
      `  <div class="rw-prompt"><span class="rw-cache-name" style="--cc:${def.color}">${esc(def.name.toUpperCase())}</span>` +
      `    ${count > 1 ? `${count} REMAINING · ` : ''}TAP · CLICK · PRESS TO SCAN</div>` +
      `  <div class="rw-charge"><i></i></div>` +
      `</div>`;
    // top-right close
    const close = document.createElement('button');
    close.className = 'rw-close';
    close.textContent = '✕ LATER';
    close.style.cssText = 'position:absolute;top:max(10px,env(safe-area-inset-top));right:12px;z-index:6';
    close.addEventListener('click', (e) => { e.stopPropagation(); this.closeCacheScreen(); });
    this.cacheEl.appendChild(close);
    this.rebindCanvas();
  }

  /** the player scanned the cache — roll + play the reveal sequence */
  private scanCache(): void {
    if (this.cacheState !== 'idle') return;
    const result = rewards.openCache(this.cacheType);
    if (!result) { this.closeCacheScreen(); return; }
    this.cacheState = 'revealing';
    try { audio.rewardScan(); } catch { try { audio.uiToggle(); } catch { /* */ } }

    const shell = this.cacheEl.querySelector('.rw-cache-shell') as HTMLElement | null;
    const rings = this.cacheEl.querySelectorAll('.rw-ring-spin');
    rings.forEach((r) => r.classList.add('fast'));
    shell?.classList.add('charging');
    const prompt = this.cacheEl.querySelector('.rw-prompt') as HTMLElement | null;
    if (prompt) prompt.textContent = 'SCANNING…';

    // build-up particles at the cache
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.42;
    for (let i = 0; i < 3; i++) this.revealTimers.push(window.setTimeout(() => this.burst(cx, cy, CACHES[this.cacheType].color, 12), i * 180));

    const topRarity = result.rewards.reduce<RarityId>((best, r) =>
      RARITIES[r.def.rarity].rank > RARITIES[best].rank ? r.def.rarity : best, 'common');

    // after the build-up: rarity flash, then reveal cards
    this.revealTimers.push(window.setTimeout(() => this.playFlash(topRarity, cx, cy), 780));
    this.revealTimers.push(window.setTimeout(() => this.renderReveal(result, topRarity), 1120));
  }

  private playFlash(rarity: RarityId, cx: number, cy: number): void {
    const r = RARITIES[rarity];
    const flash = this.cacheEl.querySelector('.rw-flash') as HTMLElement | null;
    const word = this.cacheEl.querySelector('.rw-flash-word') as HTMLElement | null;
    if (flash && word) {
      flash.style.setProperty('--fc', r.color);
      word.textContent = r.flash;
      flash.classList.remove('go');
      void flash.offsetWidth; // reflow to restart the animation
      flash.classList.add('go');
    }
    // big rarities get beams + a screen shake + a large burst
    if (r.rank >= 5) {
      this.cacheEl.querySelector('.rw-beams')?.classList.add('on');
      this.shake(r.intensity);
      this.burst(cx, cy, r.color, 60);
    } else if (r.rank >= 3) {
      this.burst(cx, cy, r.color, 30);
    }
    try { audio.uiToggle(); } catch { /* */ }
  }

  private renderReveal(result: OpenResult, topRarity: RarityId): void {
    const def = result.cache;
    const reward = result.rewards[0];
    const newCount = result.newCount;
    const cardsHtml = result.rewards.map((r, i) => this.cardHtml(r, i)).join('');
    const outcome = reward
      ? reward.dust > 0
        ? `DUPLICATE MELTED INTO +${reward.dust} SIGNAL DUST`
        : reward.amount > 0
          ? `BALANCE INCREASED BY +${reward.amount}`
          : reward.isNew
            ? 'NEW COLLECTION ITEM UNLOCKED'
            : 'SIGNAL LOG UPDATED'
      : 'SIGNAL LOG UPDATED';
    this.cacheEl.innerHTML =
      `<div class="rw-grid-bg"></div>` +
      `<canvas class="rw-cache-canvas"></canvas>` +
      `<div class="rw-beams${RARITIES[topRarity].rank >= 5 ? ' on' : ''}" style="--cc:${def.color}"></div>` +
      `<div class="rw-reveal">` +
      `  <div class="rw-reveal-title" style="color:${def.color}">${esc(def.name.toUpperCase())} DECODED</div>` +
      `  <div class="rw-cards">${cardsHtml}</div>` +
      `  <div class="rw-summary">` +
      `    <span class="rw-sum-chip primary">${esc(outcome)}</span>` +
      `    ${newCount > 0 ? `<span class="rw-sum-chip">NEW <b>${newCount}</b></span>` : ''}` +
      `    ${result.dustTotal > 0 ? `<span class="rw-sum-chip">${iconSvg('dust', '#f2a93b')} DUST <b>+${result.dustTotal}</b></span>` : ''}` +
      `    <span class="rw-sum-chip">TOTAL DUST <b>${rewards.dust()}</b></span>` +
      `  </div>` +
      `  <div class="rw-actions">` +
      (rewards.cacheCount(this.cacheType) > 0
        ? `<button class="rw-btn" data-act="again">OPEN ANOTHER (${rewards.cacheCount(this.cacheType)})</button>`
        : '') +
      `    <button class="rw-btn${rewards.cacheCount(this.cacheType) > 0 ? ' ghost' : ''}" data-act="collect">COLLECT</button>` +
      `    <button class="rw-btn ghost" data-act="archive">ARCHIVE</button>` +
      `  </div>` +
      `</div>`;
    this.rebindCanvas();
    this.cacheState = 'summary';

    // one big prize reveal + rarity fanfare
    const cards = Array.from(this.cacheEl.querySelectorAll('.rw-card')) as HTMLElement[];
    cards.forEach((card, i) => {
      this.revealTimers.push(window.setTimeout(() => {
        card.classList.add('in');
        const rect = card.getBoundingClientRect();
        const rar = card.dataset.rarity as RarityId;
        const col = RARITIES[rar]?.color ?? '#fff';
        this.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, col, RARITIES[rar]?.rank >= 4 ? 20 : 8);
        try { audio.rewardReveal(RARITIES[rar]?.rank ?? 1); } catch { try { audio.uiToggle(); } catch { /* */ } }
      }, i * 230));
    });

    // wire action buttons
    this.cacheEl.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = (b as HTMLElement).dataset.act;
        if (act === 'again') this.openCacheScreen(this.cacheType);
        else if (act === 'archive') { try { audio.rewardCollect(); } catch { /* */ } this.closeCacheScreen(); this.openArchive(); }
        else { try { audio.rewardCollect(); } catch { /* */ } this.closeCacheScreen(); }
      })
    );
  }

  private cardHtml(r: OpenedReward, i: number): string {
    const rar = RARITIES[r.def.rarity];
    const dupe = !r.isNew && r.dust > 0;
    const category = CATEGORY_LABEL[r.def.category];
    const amountTag =
      r.amount > 0 ? `<span class="rw-tag dust">+${r.amount}</span>` : '';
    const dustTag = dupe ? `<span class="rw-tag dust">+${r.dust} DUST</span>` : '';
    const newTag = r.isNew ? `<span class="rw-tag new">NEW!</span>` : '';
    return (
      `<div class="rw-card rw-r-${r.def.rarity}${dupe ? ' dupe' : ''}" data-rarity="${r.def.rarity}" style="animation-delay:${i * 0.05}s">` +
      `<div class="rw-card-rays"></div>` +
      `${newTag}${dustTag}${amountTag}` +
      `<div class="rw-card-rarity">${rar.name}</div>` +
      `<div class="rw-card-icon">${iconSvg(r.def.icon, r.def.color ?? rar.color)}</div>` +
      `<div class="rw-card-category">${esc(category)}</div>` +
      `<div class="rw-card-name">${esc(r.def.name)}</div>` +
      `<div class="rw-card-flavor">${esc(r.def.flavor)}</div>` +
      `</div>`
    );
  }

  /** reveal is playing — a second activation fast-forwards to the summary */
  private skipReveal(): void {
    this.clearRevealTimers();
    const cards = this.cacheEl.querySelectorAll('.rw-card');
    cards.forEach((c) => c.classList.add('in'));
    this.cacheState = 'summary';
  }

  /* --------------------------- cache-screen input --------------------------- */

  /** central "advance" action bound to tap/click/Enter/Space/gamepad-A */
  private cacheActivate(): void {
    if (this.cacheState === 'idle') this.scanCache();
    else if (this.cacheState === 'revealing') this.skipReveal();
    // summary: buttons own the next step (COLLECT / OPEN ANOTHER)
  }

  private clearRevealTimers(): void {
    this.revealTimers.forEach((t) => window.clearTimeout(t));
    this.revealTimers = [];
  }

  /* ------------------------------- particles -------------------------------- */

  private startCanvas(): void {
    this.rebindCanvas();
    if (this.rafId == null) {
      const step = () => {
        this.tickParticles();
        this.rafId = window.requestAnimationFrame(step);
      };
      this.rafId = window.requestAnimationFrame(step);
    }
  }
  private stopCanvas(): void {
    if (this.rafId != null) { window.cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.particles = [];
  }
  private rebindCanvas(): void {
    this.canvas = this.cacheEl.querySelector('.rw-cache-canvas');
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.ctx = this.canvas.getContext('2d');
    }
  }
  private burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 5.5;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 1, color, size: 2 + Math.random() * 3 });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }
  private tickParticles(): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += 0.14;
      p.vx *= 0.98;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.018;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
  private shake(intensity: number): void {
    const el = this.cacheEl;
    const mag = 4 + intensity * 12;
    let t = 0;
    const dur = 340;
    const start = performance.now();
    const step = (now: number) => {
      t = now - start;
      if (t >= dur) { el.style.transform = ''; return; }
      const d = (1 - t / dur) * mag;
      el.style.transform = `translate(${(Math.random() - 0.5) * d}px, ${(Math.random() - 0.5) * d}px)`;
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

  /* ============================ 3. SIGNAL ARCHIVE ========================== */

  private tabs(): ArchiveTab[] {
    const catTab = (id: string, label: string, cats: RewardCategory[]): ArchiveTab => ({
      id, label,
      count: () => {
        const pool = cats.flatMap((c) => rewardsByCategory(c));
        return [pool.filter((r) => rewards.owns(r.id)).length, pool.length];
      },
    });
    return [
      { id: 'caches', label: 'CACHES', count: () => [rewards.totalCaches(), rewards.totalCaches()] },
      { id: 'trophies', label: 'TROPHIES', count: () => [rewards.trophyProgress().unlocked, rewards.trophyProgress().total] },
      catTab('skin', 'SKINS', ['skin']),
      catTab('effects', 'TRAILS & EFFECTS', ['trail', 'ripple', 'pulsefx', 'echofx']),
      catTab('tokens', 'STICKERS & BADGES', ['sticker', 'badge']),
      catTab('note', 'FIELD NOTES', ['note']),
      catTab('relic', 'RELICS', ['relic']),
      catTab('medal', 'MEDALS', ['medal']),
      { id: 'scouts', label: 'SCOUTS', count: () => { const done = Object.values(getSave().signalSets).filter((s) => s.badge && s.log && s.relic).length; return [done, SCOUTS.length]; } },
    ];
  }

  openArchive(): void {
    this.activeTab = rewards.totalCaches() > 0 ? 'caches' : 'trophies';
    this.renderArchive();
    this.archiveEl.classList.remove('hidden');
    if (!this.archiveOpen) {
      this.archiveOpen = true;
      this.pushModal();
    }
  }

  private closeArchive(): void {
    if (!this.archiveOpen) return;
    this.archiveOpen = false;
    this.archiveEl.classList.add('hidden');
    this.archiveEl.innerHTML = '';
    this.popModal();
  }

  private renderArchive(): void {
    const col = rewards.collection();
    const pct = Math.round(col.percent * 100);
    const tabs = this.tabs();
    const tabBar = tabs.map((t) => {
      const [o, tot] = t.count();
      return `<button class="rw-tab${t.id === this.activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}<span class="rw-tab-count">${o}/${tot}</span></button>`;
    }).join('');

    this.archiveEl.innerHTML =
      `<div class="rw-grid-bg"></div>` +
      `<div class="rw-arch-frame">` +
      `  <div class="rw-arch-header">` +
      `    <div class="rw-arch-title"><span class="rw-dot"></span> SIGNAL ARCHIVE</div>` +
      `    <div class="rw-arch-spacer"></div>` +
      `    <div class="rw-arch-meter"><span>COLLECTION</span><div class="rw-meter-bar"><i style="width:${pct}%"></i></div><b>${pct}%</b></div>` +
      `    <button class="rw-close" data-close>✕ CLOSE</button>` +
      `  </div>` +
      `  <div class="rw-tabs">${tabBar}</div>` +
      `  <div class="rw-arch-body" id="rw-arch-body">${this.renderTabBody(this.activeTab)}</div>` +
      `</div>`;

    this.archiveEl.querySelector('[data-close]')?.addEventListener('click', () => this.closeArchive());
    this.archiveEl.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.activeTab = (b as HTMLElement).dataset.tab!;
        try { audio.uiToggle(); } catch { /* */ }
        this.renderArchive();
      })
    );
    this.archiveEl.querySelectorAll('[data-open-cache]').forEach((b) =>
      b.addEventListener('click', () => {
        const t = (b as HTMLElement).dataset.openCache as CacheType;
        this.closeArchive();
        this.openCacheScreen(t);
      })
    );
    // equip a cosmetic from its tile (delegated so it survives re-render)
    this.archiveEl.querySelectorAll('[data-equip]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        rewards.equip((b as HTMLElement).dataset.equip!);
        try { audio.uiToggle(); } catch { /* */ }
        this.renderArchive();
      })
    );
    // viewing a tab clears NEW flags for the collectibles it shows
    this.markTabSeen(this.activeTab);
  }

  private renderTabBody(tab: string): string {
    if (tab === 'caches') return this.renderCachesTab();
    if (tab === 'trophies') return this.renderTrophiesTab();
    if (tab === 'scouts') return this.renderScoutsTab();
    // category tabs
    const map: Record<string, RewardCategory[]> = {
      skin: ['skin'],
      effects: ['trail', 'ripple', 'pulsefx', 'echofx'],
      tokens: ['sticker', 'badge'],
      note: ['note'],
      relic: ['relic'],
      medal: ['medal'],
    };
    const cats = map[tab] ?? [];
    const pool = cats.flatMap((c) => rewardsByCategory(c));
    return this.renderRewardGrid(pool);
  }

  private renderCachesTab(): string {
    const owned = CACHE_ORDER.filter((t) => rewards.cacheCount(t) > 0);
    const tiles = CACHE_ORDER.map((t) => {
      const def = CACHES[t];
      const n = rewards.cacheCount(t);
      const has = n > 0;
      return (
        `<div class="rw-item rw-cache-tile${has ? '' : ' locked'}" style="--c:${def.color}"${has ? ` data-open-cache="${t}"` : ''}>` +
        (has ? `<span class="rw-cache-count">${n}</span>` : '') +
        `<div class="rw-item-icon">${iconSvg(def.icon, def.color)}</div>` +
        `<div class="rw-item-name">${esc(def.name)}</div>` +
        `<div class="rw-item-flavor">${esc(def.tagline)}</div>` +
        (has ? `<div class="rw-open-pill">OPEN ▸</div>` : `<div class="rw-item-rarity">NONE YET</div>`) +
        `</div>`
      );
    }).join('');
    const note = owned.length
      ? `You have <b>${rewards.totalCaches()}</b> unopened cache(s). Tap one to crack it open.`
      : `No unopened caches right now. Earn them by playing — clear zones, beat bosses, find secrets.`;
    return `<p class="rw-arch-note">${note}</p><div class="rw-arch-grid">${tiles}</div>`;
  }

  private renderRewardGrid(pool: RewardDef[]): string {
    if (pool.length === 0) return `<div class="rw-empty">Nothing catalogued in this band yet.</div>`;
    // sort by rarity rank then name
    const sorted = [...pool].sort((a, b) => RARITIES[a.rarity].rank - RARITIES[b.rarity].rank || a.name.localeCompare(b.name));
    const owned = sorted.filter((r) => rewards.owns(r.id)).length;
    const items = sorted.map((r) => this.rewardTile(r)).join('');
    return `<p class="rw-arch-note">Recovered <b>${owned}</b> of <b>${sorted.length}</b> in this band. Locked slots reveal as you intercept them.</p><div class="rw-arch-grid">${items}</div>`;
  }

  private rewardTile(r: RewardDef): string {
    const owns = rewards.owns(r.id);
    const rar = RARITIES[r.rarity];
    const isNew = rewards.isNew(r.id);
    if (!owns) {
      return (
        `<div class="rw-item locked">` +
        `<div class="rw-item-icon">${iconSvg(r.icon, '#3a4150')}</div>` +
        `<div class="rw-item-name">???</div>` +
        `<div class="rw-item-flavor">${esc(CATEGORY_LABEL[r.category])} · locked</div>` +
        `<div class="rw-item-rarity">${rar.name}</div>` +
        `</div>`
      );
    }
    const equippable = EQUIPPABLE.includes(r.category);
    const equipped = equippable && rewards.isEquipped(r.id);
    const equipBtn = equippable
      ? `<button class="rw-equip${equipped ? ' on' : ''}" data-equip="${r.id}">${equipped ? '✓ EQUIPPED' : 'EQUIP'}</button>`
      : '';
    return (
      `<div class="rw-item rw-r-${r.rarity}${equipped ? ' equipped' : ''}" style="--c:${r.color ?? rar.color}">` +
      (isNew ? `<span class="rw-tag new">NEW!</span>` : '') +
      `<div class="rw-item-icon">${iconSvg(r.icon, r.color ?? rar.color)}</div>` +
      `<div class="rw-item-name">${esc(r.name)}</div>` +
      `<div class="rw-item-flavor">${esc(r.flavor)}</div>` +
      `<div class="rw-item-rarity">${rar.name}</div>` +
      equipBtn +
      `</div>`
    );
  }

  private renderTrophiesTab(): string {
    const items = TROPHIES.map((t) => {
      const has = rewards.hasTrophy(t.id);
      const rar = RARITIES[t.rarity];
      const name = has ? t.name : t.hidden ? '???' : t.name;
      const body = has ? t.description : t.hidden ? 'A hidden trophy. Keep playing.' : t.hint;
      return (
        `<div class="rw-item${has ? ` rw-r-${t.rarity}` : ' locked'}" style="--c:${rar.color}">` +
        `<div class="rw-item-icon">${iconSvg(t.icon, has ? rar.color : '#3a4150')}</div>` +
        `<div class="rw-item-name">${esc(name)}</div>` +
        `<div class="rw-item-flavor">${esc(body)}</div>` +
        `<div class="rw-item-rarity">${has ? rar.name : 'LOCKED'}</div>` +
        `</div>`
      );
    }).join('');
    const p = rewards.trophyProgress();
    return `<p class="rw-arch-note">Unlocked <b>${p.unlocked}</b> of <b>${p.total}</b> trophies.</p><div class="rw-arch-grid">${items}</div>`;
  }

  private renderScoutsTab(): string {
    const sets = getSave().signalSets;
    const rows = SCOUTS.map((sc) => {
      const set = sets[sc.id] ?? { badge: false, log: false, relic: false };
      const done = (set.badge ? 1 : 0) + (set.log ? 1 : 0) + (set.relic ? 1 : 0);
      const col = '#' + (sc.color ?? 0xa8ff3e).toString(16).padStart(6, '0');
      return (
        `<div class="rw-scout-row" style="color:${col}">` +
        `<span class="rw-scout-dot" style="background:${col};box-shadow:0 0 8px ${col}"></span>` +
        `<span class="rw-scout-name">${esc(sc.name)} / ${esc((sc.callsign ?? '').toUpperCase())}</span>` +
        `<span class="rw-scout-pips">` +
        `<i class="${set.badge ? 'on' : ''}" title="badge"></i>` +
        `<i class="${set.log ? 'on' : ''}" title="log"></i>` +
        `<i class="${set.relic ? 'on' : ''}" title="relic"></i>` +
        `</span>` +
        `<b style="color:${col};margin-left:10px">${done}/3</b>` +
        `</div>`
      );
    }).join('');
    return `<p class="rw-arch-note">Each scout left a 3-piece Signal Set — badge · log · relic. Complete one in their home zone to wear their frequency.</p>${rows}`;
  }

  private markTabSeen(tab: string): void {
    const map: Record<string, RewardCategory[]> = {
      skin: ['skin'], effects: ['trail', 'ripple', 'pulsefx', 'echofx'],
      tokens: ['sticker', 'badge'], note: ['note'], relic: ['relic'], medal: ['medal'],
    };
    const cats = map[tab];
    if (!cats) return;
    const owned = cats.flatMap((c) => rewardsByCategory(c)).filter((r) => rewards.owns(r.id)).map((r) => r.id);
    rewards.markSeen(owned);
  }

  /* ------------------------------- keyboard input --------------------------- */

  private wireInput(): void {
    window.addEventListener('keydown', (ev) => this.onKey(ev), { capture: true });
    // tap / click anywhere on the cache stage advances the reveal
    this.cacheEl && document.addEventListener('pointerdown', (ev) => {
      if (!this.cacheOpen) return;
      const target = ev.target as HTMLElement;
      if (target.closest('.rw-actions') || target.closest('.rw-close')) return; // buttons own their clicks
      this.cacheActivate();
    });
  }

  private onKey(ev: KeyboardEvent): void {
    if (this.cacheOpen) {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); this.closeCacheScreen(); return; }
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault(); ev.stopPropagation();
        if (this.cacheState === 'summary') this.closeCacheScreen();
        else this.cacheActivate();
      }
      return;
    }
    if (this.archiveOpen) {
      if (ev.key === 'Escape' || ev.key === 'Tab') { ev.preventDefault(); ev.stopPropagation(); this.closeArchive(); return; }
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        this.cycleTab(ev.key === 'ArrowRight' ? 1 : -1);
      }
      return;
    }
  }

  private cycleTab(dir: number): void {
    const ids = this.tabs().map((t) => t.id);
    const idx = ids.indexOf(this.activeTab);
    this.activeTab = ids[(idx + dir + ids.length) % ids.length];
    try { audio.uiToggle(); } catch { /* */ }
    this.renderArchive();
  }

  /* ------------------------------- gamepad input ---------------------------- */

  private startPadLoop(): void {
    const step = () => { this.pollPad(); window.requestAnimationFrame(step); };
    window.requestAnimationFrame(step);
  }

  private padJust(pad: ReturnType<typeof readPad>, index: number): boolean {
    return pad?.buttons[index] === true && this.prevPad?.buttons[index] !== true;
  }

  private pollPad(): void {
    const pad = readPad();
    const xRaw = pad?.axes[0] ?? 0;
    const x = Math.abs(xRaw) > 0.5 ? Math.sign(xRaw) : 0;
    const xEdge = x !== 0 && x !== this.prevPadX ? x : 0;
    if (pad) {
      if (this.cacheOpen) {
        if (this.padJust(pad, PAD.jump) || this.padJust(pad, PAD.interact) || this.padJust(pad, PAD.start)) {
          if (this.cacheState === 'summary') this.closeCacheScreen();
          else this.cacheActivate();
        } else if (this.padJust(pad, PAD.select)) {
          this.closeCacheScreen();
        }
      } else if (this.archiveOpen) {
        if (this.padJust(pad, PAD.interact) || this.padJust(pad, PAD.select) || this.padJust(pad, PAD.start)) this.closeArchive();
        else if (this.padJust(pad, PAD.dpadRight) || xEdge > 0) this.cycleTab(1);
        else if (this.padJust(pad, PAD.dpadLeft) || xEdge < 0) this.cycleTab(-1);
      }
    }
    this.prevPad = pad;
    this.prevPadX = x;
  }
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
}

/* ------------------------------- ring artwork ------------------------------ */
// Concentric radar rings + a rotating sweep line, tinted to the cache color.
function ringsSvg(color: string): string {
  return (
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<g class="rw-ring-spin">` +
    `<circle cx="50" cy="50" r="47" fill="none" stroke="${color}" stroke-width="0.6" stroke-opacity="0.35" stroke-dasharray="2 4"/>` +
    `<circle cx="50" cy="50" r="47" fill="none" stroke="${color}" stroke-width="0.4" stroke-opacity="0.5" stroke-dasharray="20 260"/>` +
    `</g>` +
    `<g class="rw-ring-spin rev">` +
    `<circle cx="50" cy="50" r="38" fill="none" stroke="${color}" stroke-width="0.5" stroke-opacity="0.3"/>` +
    `<circle cx="50" cy="50" r="38" fill="none" stroke="${color}" stroke-width="0.8" stroke-opacity="0.6" stroke-dasharray="10 228"/>` +
    `</g>` +
    `<circle cx="50" cy="50" r="29" fill="none" stroke="${color}" stroke-width="0.4" stroke-opacity="0.28"/>` +
    `<circle cx="50" cy="50" r="20" fill="none" stroke="${color}" stroke-width="0.4" stroke-opacity="0.22"/>` +
    `</svg>`
  );
}
