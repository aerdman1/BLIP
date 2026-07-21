/**
 * ShellUI — every crisp (non-pixelated) UI surface of BLIP:
 * instrument top bar, main menu overlay (SVG pixel logo), pause overlay,
 * settings modal, transmission modal, toasts, boss bar, objective bar,
 * bottom status strip, debug panel — plus gamepad navigation for all of it.
 *
 * The Phaser canvas renders the WORLD; this renders the CONSOLE around it.
 */
import type Phaser from 'phaser';
import { EVT, FILTERS, FRAGMENT_TOTAL, PAD, SCENES, TEX, type FilterId } from '../game/config';
import { audio } from '../game/systems/AudioSystem';
import { bus } from '../game/systems/EventBus';
import {
  PAD_ACTIONS,
  allPadBindings,
  isPadDefault,
  padButtonLabel,
  resetPadBindings,
  setPadBinding,
  type PadAction,
} from '../game/systems/PadBindings';
import { readPad } from '../game/systems/PadSim';
import { addShards, buyUpgrade, getSave, grantAbility, hasProgress, ownsUpgrade, resetSave, unlockSkin, updateSave } from '../game/systems/SaveSystem';
import { rewards } from '../game/systems/RewardSystem';
import { skinById } from '../game/data/skins';
import { UPGRADES } from '../game/data/upgrades';
import { devState } from '../game/systems/DevState';
import { settings, type TouchControlsMode } from '../game/systems/Settings';
import { setOverlayDepth } from '../game/systems/UIState';
import { TouchControls } from './TouchControls';

interface MenuEntry {
  label: string;
  icon: string;
  cls?: string;
  id?: string;
  sub?: string;
  action: () => void;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

const MENU_SCOUT_TARGETS = [
  { id: 'henry', name: 'Henry / ANCHOR', color: '#4bff8f', x: 36, y: 224 },
  { id: 'cameron', name: 'Cameron / ECHO', color: '#b06bff', x: 53, y: 224 },
  { id: 'chip', name: 'Chip / SPARK', color: '#ffb03b', x: 70, y: 224 },
  { id: 'will', name: 'Will / WILLOW', color: '#35d5ff', x: 86, y: 224 },
  { id: 'danny', name: 'Danny / ROCKET', color: '#ff4b5c', x: 101, y: 224 },
] as const;

const ZONE_LABELS: Record<string, string> = {
  'miller-field': 'Miller Surface',
  'motel-nowhere': 'Motel Circuit',
  'tiger-stadium': 'Chagrin Falls Town',
  'pattersons-orchard': "Patterson's Orchard",
  'skyline-array': 'Signal Storm',
};

const DEV_WARP_ZONES = [
  ['miller-field', 'Miller Surface'],
  ['motel-nowhere', 'Motel Circuit'],
  ['tiger-stadium', 'Chagrin Falls Town'],
  ['pattersons-orchard', "Patterson's Orchard"],
  ['skyline-array', 'Signal Storm'],
] as const;

/* ------------------------------ pixel logo ------------------------------- */

const LOGO_GLYPHS: Record<string, string[]> = {
  B: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'],
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  P: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
};

function buildLogoSvg(word: string): string {
  const rows = 7;
  let x = 0;
  let rects = '';
  for (const ch of word) {
    const glyph = LOGO_GLYPHS[ch];
    if (!glyph) continue;
    glyph.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === 'X') rects += `<rect x="${x + rx}" y="${ry}" width="1" height="1"/>`;
      }
    });
    x += 6; // 5 wide + 1 gap
  }
  const w = x - 1;
  return `<svg viewBox="0 0 ${w} ${rows}" width="min(330px, 56vw)" style="shape-rendering: crispEdges" xmlns="http://www.w3.org/2000/svg" fill="#f6e7b4" role="img" aria-label="${word}">${rects}</svg>`;
}

/**
 * The radar hero: CONTACT-47 inside a green radar screen with a curved unit
 * label, a rotating sweep, and pinging blips. Lives in the crisp overlay layer
 * (not the game canvas) so it stacks cleanly above the BLIP wordmark and can
 * never overlap it. `robotSrc` is the game's own probe texture as a data URL.
 */
function heroEmblemHtml(robotSrc: string): string {
  const FONT = "Bahnschrift, 'DIN Alternate', 'Roboto Condensed', system-ui, sans-serif";
  const blips = [
    { x: '64%', y: '33%', d: '0s' },
    { x: '39%', y: '58%', d: '0.7s' },
    { x: '66%', y: '64%', d: '1.3s' },
  ]
    .map((b) => `<span class="hero-blip" style="left:${b.x};top:${b.y};animation-delay:${b.d}"></span>`)
    .join('');
  return (
    `<div class="hero-radar">` +
    // back: semi-transparent screen + grid rings + crosshair (behind the robot)
    `<svg class="hero-frame" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="50" cy="50" r="47" fill="#0e1f14" fill-opacity="0.5"/>` +
    `<circle cx="50" cy="50" r="31" fill="none" stroke="#5f9e2e" stroke-width="0.6" opacity="0.6"/>` +
    `<circle cx="50" cy="50" r="16" fill="none" stroke="#5f9e2e" stroke-width="0.6" opacity="0.6"/>` +
    `<line x1="50" y1="5" x2="50" y2="95" stroke="#5f9e2e" stroke-width="0.4" opacity="0.35"/>` +
    `<line x1="5" y1="50" x2="95" y2="50" stroke="#5f9e2e" stroke-width="0.4" opacity="0.35"/>` +
    `</svg>` +
    `<div class="hero-sweep"></div>` +
    blips +
    (robotSrc ? `<img class="hero-robot" src="${robotSrc}" alt="CONTACT-47"/>` : '') +
    // front: bright rim + curved CONTACT-47 label (over everything, clear of the robot)
    `<svg class="hero-ring" viewBox="0 0 100 100" role="img" aria-label="CONTACT-47" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="50" cy="50" r="47" fill="none" stroke="#a8ff3e" stroke-width="1.5"/>` +
    `<defs><path id="hero-arc" d="M17,27 A40,40 0 0 1 83,27" fill="none"/></defs>` +
    `<text fill="#a8ff3e" font-family="${FONT}" font-size="7" font-weight="700" letter-spacing="1.3">` +
    `<textPath href="#hero-arc" startOffset="50%" text-anchor="middle">CONTACT-47</textPath>` +
    `</text></svg>` +
    `</div>`
  );
}

/* ================================ ShellUI ================================= */

export class ShellUI {
  private game: Phaser.Game;
  private modalDepth = 0;
  private pausedScenes: string[] = [];
  private menuVisible = false;
  private heroBuilt = false;
  private pauseVisible = false;
  private settingsVisible = false;
  private transmissionVisible = false;
  private portraitVisible = false;
  private ccVisible = false;
  private workbenchVisible = false;
  private debugVisible = false;
  private devVisible = false;
  private devBuffer = '';
  private devEl: HTMLElement | null = null;
  private menuFocus = 0;
  private pauseFocus = 0;
  private menuEntries: MenuEntry[] = [];
  private pauseEntries: MenuEntry[] = [];
  private lastScene = '';
  private prevPad: ReturnType<typeof readPad> = null;
  private prevStickY = 0;
  private padPollTimer: number | null = null;
  /** action currently waiting for a button press in the remap UI */
  private listenAction: PadAction | null = null;
  /** buttons already held when listening began (ignored until released) */
  private listenHeld = new Set<number>();
  private menuScoutButtons: HTMLButtonElement[] = [];
  private touch: TouchControls;
  private openCommandCenter: (section?: string) => void;
  private closeCommandCenter: () => void;

  constructor(game: Phaser.Game, cc: { open: (section?: string) => void; close: () => void }) {
    this.game = game;
    this.openCommandCenter = (s) => {
      if (this.ccVisible) return;
      this.ccVisible = true;
      this.pushModal();
      cc.open(s);
    };
    this.closeCommandCenter = () => {
      if (!this.ccVisible) return;
      this.ccVisible = false;
      cc.close();
      this.popModal();
    };

    $('menu-logo').innerHTML = buildLogoSvg('BLIP');
    this.touch = new TouchControls($('game-frame'));
    this.wireTopBar();
    this.wireTransmissionModal();
    this.wirePortraitModal();
    this.wireMenuScroll();
    this.wireMenuPeek();
    this.wireBus();
    this.buildPauseEntries();
    this.buildSettings();
    this.wireWorkbench();
    this.startClock();
    this.renderVolumePips();
    this.renderClassify(0, 'UNKNOWN');
    this.renderFragments(0);
    this.applyCrt();
    this.startPadLoop();
    this.wireOrientation();
    this.wireBeforeUnload();
    window.addEventListener('resize', () => {
      this.positionMenuScoutTargets();
      this.refreshGameplayChrome();
      this.refitCanvas();
    });
    window.addEventListener('orientationchange', () => window.setTimeout(() => {
      this.positionMenuScoutTargets();
      this.refreshGameplayChrome();
      this.refitCanvas();
    }, 120));
    this.observeGameFrame();
    window.addEventListener('keydown', (ev) => this.onKeyDown(ev), { capture: true });

    // iOS Safari ignores `user-scalable=no`, so block its pinch-zoom gestures
    // directly. `{ passive: false }` is required for preventDefault to take. This
    // only cancels multi-finger pinch — normal single taps/clicks are untouched.
    const blockGesture = (ev: Event) => ev.preventDefault();
    document.addEventListener('gesturestart', blockGesture, { passive: false });
    document.addEventListener('gesturechange', blockGesture, { passive: false });
    document.addEventListener('gestureend', blockGesture, { passive: false });

    this.wireTouchDevAccess();
  }

  /** True on touch/tablet devices (iPad, phones) where there's no keyboard. */
  private isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /** DEV access without a keyboard (iPad): surface the ▚ DEV button and add a
   *  secret rapid multi-tap on the unit badge — both open the ERD dev console. */
  private wireTouchDevAccess(): void {
    if (this.isTouchDevice()) {
      // reveal the DEV console launcher so touch players can enable God / Fly
      $('btn-dev').classList.remove('hidden');
    }
    // secret fallback (works on any device): 5 quick taps/clicks on the unit badge
    let taps = 0;
    let lastTap = 0;
    $('unit-badge').addEventListener('click', () => {
      const now = Date.now();
      taps = now - lastTap < 600 ? taps + 1 : 1;
      lastTap = now;
      if (taps >= 5) {
        taps = 0;
        this.showDevPanel();
      }
    });
  }

  private wireBeforeUnload(): void {
    const isTest = new URLSearchParams(window.location.search).has('test');
    window.addEventListener('beforeunload', (ev) => {
      if (!this.shouldWarnBeforeUnload()) return;
      try {
        updateSave(() => {
          /* force a final save write before the browser leaves */
        });
      } catch {
        /* localStorage may be unavailable; still show the browser guard */
      }
      if (isTest) return;
      ev.preventDefault();
      ev.returnValue = '';
    });
  }

  private shouldWarnBeforeUnload(): boolean {
    return !this.menuVisible && this.gameplayScenes.includes(this.lastScene as (typeof this.gameplayScenes)[number]);
  }

  /* --------------------------- on-screen touch controls --------------------- */

  private touchGameplayScenes: string[] = [SCENES.sweep];

  /** Show the on-screen controls only during unobstructed gameplay, per the
   *  ON-SCREEN CONTROLS setting (auto = touch devices only). */
  private refreshTouch(): void {
    const mode = settings.get('touchControls');
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const enabled = mode === 'on' || (mode === 'auto' && coarse);
    const isGameplay = this.touchGameplayScenes.includes(this.lastScene);
    const unobstructed = !this.menuVisible && !this.pauseVisible && this.modalDepth === 0;
    this.touch.setVisible(enabled && isGameplay && unobstructed);
    this.refreshGameplayChrome();
  }

  private refreshGameplayChrome(): void {
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const phoneSized =
      typeof window.matchMedia === 'function' &&
      (window.matchMedia('(max-width: 700px)').matches ||
        window.matchMedia('(orientation: landscape) and (max-width: 900px) and (max-height: 520px)').matches);
    const isGameplay = this.touchGameplayScenes.includes(this.lastScene);
    const unobstructed = !this.menuVisible && !this.pauseVisible && this.modalDepth === 0;
    const compact = isGameplay && unobstructed && (coarse || phoneSized);
    const changed = document.body.classList.contains('compact-gameplay') !== compact;
    document.body.classList.toggle('gameplay-active', isGameplay && unobstructed);
    document.body.classList.toggle('compact-gameplay', compact);
    document.body.classList.toggle('sweep-active', isGameplay && unobstructed && this.lastScene === SCENES.sweep);
    // These classes resize #game-frame. Phaser (Scale.FIT) must re-measure its
    // parent afterwards or the canvas keeps a stale size and overflows/offsets
    // the viewport — the core "looks broken on mobile" bug. Wait a frame so the
    // new CSS has been applied before refreshing.
    if (changed) this.refitCanvas();
  }

  /** Re-measure the parent and re-letterbox the 480x270 canvas.
   *
   *  Phaser's own window-resize handling does NOT reliably re-fit here (verified:
   *  after a viewport change a plain `resize` event left the canvas at its old
   *  size, overflowing the viewport — only an explicit refresh() corrected it).
   *  So every layout change routes through this. The delayed second pass is for
   *  iOS Safari, which reports stale innerWidth/Height right after a rotation. */
  private refitCanvas(): void {
    const refresh = () => {
      try {
        // Measure the container ourselves and hand Phaser the size explicitly.
        // refresh() alone is NOT enough: Phaser caches its parent bounds, and
        // after a rotation/layout change it re-centres the canvas while keeping
        // a stale SCALE (verified: a 390x219 canvas left inside an 844x360 box).
        // setParentSize() makes the re-fit deterministic.
        const root = document.getElementById('game-root');
        if (root) {
          const r = root.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            this.game.scale.setParentSize(Math.round(r.width), Math.round(r.height));
          }
        }
        this.game.scale.refresh();
      } catch {
        /* game not booted yet — the next layout change will refit */
      }
    };
    requestAnimationFrame(refresh);
    window.setTimeout(refresh, 260); // iOS reports stale dimensions right after a rotation
  }

  /** The reliable backstop: watch the canvas's actual container box instead of
   *  trusting resize/orientationchange events. This catches rotation, the chrome
   *  classes resizing #game-frame, AND iOS Safari collapsing/expanding its address
   *  bar mid-play (which changes 100dvh without a useful event). */
  private observeGameFrame(): void {
    if (typeof ResizeObserver !== 'function') return;
    const root = document.getElementById('game-root');
    if (!root) return;
    let lastW = 0;
    let lastH = 0;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w === lastW && h === lastH) return; // ignore no-op churn
      lastW = w;
      lastH = h;
      this.refitCanvas();
    });
    ro.observe(root);
  }

  private refreshOrientationNudge(): void {
    // Phones and iPads must remain playable in either orientation. The old
    // blocking rotate gate made portrait sessions look broken, especially in
    // Safari/PWA view where users may not rotate immediately.
    $('rotate-overlay').classList.add('hidden');
  }

  /** Portrait rotate nudge — only meaningful on touch devices. */
  private wireOrientation(): void {
    window.addEventListener('resize', () => this.refreshOrientationNudge());
    window.addEventListener('orientationchange', () => this.refreshOrientationNudge());
    this.refreshOrientationNudge();
  }

  /* --------------------------- modal pause plumbing -------------------------- */

  private gameplayScenes = [SCENES.sweep];

  private pushModal(): void {
    this.modalDepth++;
    setOverlayDepth(this.modalDepth);
    if (this.modalDepth === 1) {
      this.pausedScenes = this.gameplayScenes.filter((k) => this.game.scene.isActive(k));
      this.pausedScenes.forEach((k) => this.game.scene.pause(k));
    }
    this.refreshTouch();
    this.refreshOrientationNudge();
  }

  private popModal(): void {
    this.modalDepth = Math.max(0, this.modalDepth - 1);
    setOverlayDepth(this.modalDepth);
    if (this.modalDepth === 0) {
      this.pausedScenes.forEach((k) => {
        if (this.game.scene.isPaused(k)) this.game.scene.resume(k);
      });
      this.pausedScenes = [];
    }
    this.refreshTouch();
    this.refreshOrientationNudge();
  }

  /* -------------------------------- top bar --------------------------------- */

  private wireTopBar(): void {
    // (the old ▶ RESUME button was removed — it only closed overlays and always
    //  showed even with nothing to resume; ESC / [C] / modal buttons cover it)
    $('btn-command-center').addEventListener('click', () => {
      audio.unlock();
      this.ccVisible ? this.closeCommandCenter() : this.openCommandCenter();
    });
    $('btn-debug').addEventListener('click', () => bus.emit(EVT.debugToggle, {}));
    $('btn-dev').addEventListener('click', () => this.showDevPanel());
    // Always-visible one-tap GOD toggle — the reliable path on touch/iPad where the
    // "erd" keyboard code and DEV button aren't reachable. Never hidden by dev chrome.
    $('btn-god').addEventListener('click', () => this.toggleGod());
    $('btn-mute').addEventListener('click', () => {
      audio.unlock();
      audio.toggleMute();
      this.renderVolumePips();
    });
    this.refreshDevChrome();
    this.refreshGodButton();
  }

  /** One-tap god toggle from the always-visible ◇ GOD button. */
  private toggleGod(): void {
    audio.unlock();
    devState.god = !devState.god;
    bus.emit(EVT.godMode, { on: devState.god });
    bus.emit(EVT.toast, {
      text: devState.god ? 'GOD MODE ON — invulnerable' : 'GOD MODE OFF',
      color: devState.god ? 'green' : 'orange',
    });
    this.refreshGodButton();
    if (this.devVisible) this.refreshDevPanel();
    this.refreshDevChrome();
  }

  private refreshGodButton(): void {
    const b = $('btn-god');
    b.textContent = devState.god ? '◇ GOD ✓' : '◇ GOD';
    b.classList.toggle('on', devState.god);
  }

  private onMenu = true;

  /** Dev tools (Command Center / Debug / DEV console buttons + the GOD MODE
   *  indicator) only clutter the HUD when god mode is on and a run is active.
   *  Normal players see just the SOUND toggle. */
  private refreshDevChrome(): void {
    const showButtons = devState.god && !this.onMenu;
    $('btn-command-center').classList.toggle('hidden', !showButtons);
    $('btn-debug').classList.toggle('hidden', !showButtons);
    // The DEV console launcher is the ENTRY point to enabling god/fly, so on touch
    // devices (no keyboard, no "erd" path) it must stay visible regardless of god state.
    $('btn-dev').classList.toggle('hidden', !showButtons && !this.isTouchDevice());
    $('god-indicator').classList.toggle('hidden', !showButtons);
  }

  private confirmQuitToMenu(): void {
    if (window.confirm('Quit to menu? You will continue from your last autosave.')) {
      bus.emit(EVT.uiMainMenu, {});
    }
  }

  renderVolumePips(): void {
    const pips = $('volume-pips');
    const vol = audio.muted ? 0 : audio.volume;
    const filled = Math.ceil(vol * 5);
    pips.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
    $('mute-label').textContent = audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
  }

  /* ------------------------------- bus wiring -------------------------------- */

  private wireBus(): void {
    bus.on(EVT.menuActive, (d) => this.setMenuVisible((d as { active: boolean }).active));
    bus.on(EVT.gamePaused, () => this.setPauseVisible(true));
    bus.on(EVT.gameResumed, () => this.setPauseVisible(false));
    bus.on(EVT.ccOpen, (d) => this.openCommandCenter((d as { section?: string } | undefined)?.section));
    bus.on(EVT.ccClose, () => this.closeCommandCenter());
    bus.on(EVT.uiOpenSettings, () => this.openSettings());
    bus.on(EVT.scoutLog, (d) => this.showTransmission(d as { title: string; body: string; accent?: string }));
    bus.on(EVT.scoutPortrait, (d) => this.showScoutPortrait(d as { id: string; name: string; color: string }));
    bus.on(EVT.tutorial, (d) => this.showTransmission(d as { title: string; html: string; accent?: string }));
    bus.on(EVT.transmissionClosed, (d) => {
      if ((d as { force?: boolean } | undefined)?.force) this.hideTransmission();
    });
    bus.on(EVT.toast, (d) => this.showToast(d as { text: string; color?: string }));
    bus.on(EVT.questObjective, (d) => {
      const q = d as { objective: string; hint: string };
      $('objective-text').textContent = q.objective;
      $('objective-hint').textContent = q.hint ?? '';
    });
    bus.on(EVT.fragmentCount, (d) => {
      this.renderFragments((d as { count: number }).count);
    });
    bus.on(EVT.hudClassify, (d) => {
      const c = d as { value: number; tier: string };
      this.renderClassify(c.value, c.tier);
    });
    bus.on(EVT.sceneChanged, (d) => {
      const s = d as { scene: string; zone?: string };
      this.lastScene = s.scene;
      if (s.zone) $('strip-location').textContent = s.zone.toUpperCase();
      this.renderStatus();
      if (s.scene !== SCENES.menu) this.setMenuVisible(false);
      this.refreshGameplayChrome();
      this.refreshTouch();
      this.refreshOrientationNudge();
      this.refreshDevChrome();
    });
    bus.on(EVT.godMode, () => {
      this.refreshDevChrome();
      this.refreshGodButton();
    });
    bus.on(EVT.bossSpawn, (d) => {
      const b = d as { name: string };
      $('boss-name').textContent = b.name;
      $('boss-bar').classList.remove('hidden');
      const bar = document.querySelector('#boss-hp i') as HTMLElement | null;
      if (bar) bar.style.width = '100%';
    });
    bus.on(EVT.bossHp, (d) => {
      const b = d as { hp: number; max: number };
      const bar = document.querySelector('#boss-hp i') as HTMLElement;
      if (bar) bar.style.width = `${Math.max(0, (b.hp / b.max) * 100)}%`;
    });
    bus.on(EVT.bossDead, () => $('boss-bar').classList.add('hidden'));
    bus.on(EVT.debugToggle, () => {
      this.debugVisible = !this.debugVisible;
      $('debug-panel').classList.toggle('hidden', !this.debugVisible);
    });
    bus.on(EVT.debugState, (d) => {
      if (!this.debugVisible) return;
      const obj = d as Record<string, unknown>;
      $('debug-panel').textContent = Object.entries(obj)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join('\n');
    });
    bus.on(EVT.settingsChanged, () => {
      this.renderVolumePips();
      this.applyCrt();
      this.refreshTouch();
    });
    bus.on(EVT.audioMute, () => this.renderVolumePips());
    bus.on(EVT.padStatus, (d) => {
      const p = d as { connected: boolean; id?: string };
      const line = document.getElementById('pad-status-line');
      if (line) line.innerHTML = p.connected ? `<b class="ok">CONNECTED</b> — ${p.id ?? 'controller'}` : 'no controller detected';
    });
    bus.on(EVT.skinSelected, (d) => {
      const s = d as { name: string; color: number };
      const el = document.querySelector('#unit-badge .badge-text') as HTMLElement | null;
      if (el) {
        el.textContent = `${s.name} / FIELD UNIT`;
        el.style.color = '#' + s.color.toString(16).padStart(6, '0');
      }
    });

    // shell-level action events
    bus.on(EVT.uiMainMenu, () => {
      this.setPauseVisible(false);
      [SCENES.gameOver, SCENES.sweep, SCENES.ui].forEach((k) => {
        if (this.game.scene.isActive(k) || this.game.scene.isPaused(k) || this.game.scene.isSleeping(k)) {
          this.game.scene.stop(k);
        }
      });
      this.game.scene.start(SCENES.menu);
    });
  }

  private applyCrt(): void {
    document.body.classList.toggle('crt-off', !settings.get('crt'));
  }

  /* ------------------------------ status strip ------------------------------- */

  private renderClassify(value: number, tier: string): void {
    const label = $('strip-classify-label');
    label.textContent = tier;
    label.className = tier === 'THREAT' ? 'bad' : tier === 'ANOMALY' ? 'warn' : 'ok';
    const colorCls = tier === 'THREAT' ? 'red' : tier === 'ANOMALY' ? 'amber' : '';
    const filled = Math.round(value / 10);
    $('strip-classify-pips').innerHTML = Array.from(
      { length: 10 },
      (_, i) => `<i class="${colorCls} ${i < filled ? 'on' : ''}"></i>`
    ).join('');
    this.lastTier = tier;
    this.renderStatus();
  }

  private lastTier = 'UNKNOWN';

  private renderStatus(): void {
    const el = $('strip-status');
    if (this.lastTier === 'THREAT') {
      el.textContent = 'HUNTED';
      el.className = 'bad';
    } else if (this.lastTier === 'ANOMALY') {
      el.textContent = 'FLAGGED';
      el.className = 'warn';
    } else {
      el.textContent = 'STEALTH';
      el.className = 'ok';
    }
  }

  private startClock(): void {
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      const h12 = h % 12 || 12;
      const ampm = h >= 12 ? 'PM' : 'AM';
      $('strip-clock').textContent = `${h12}:${String(now.getMinutes()).padStart(2, '0')} ${ampm}`;
    };
    tick();
    window.setInterval(tick, 20_000);
  }

  private renderFragments(count: number): void {
    $('strip-fragments').textContent = `${count} / ${FRAGMENT_TOTAL}`;
    $('strip-fragment-pips').innerHTML = Array.from(
      { length: FRAGMENT_TOTAL },
      (_, i) => `<i class="${i < count ? 'on' : ''}"></i>`
    ).join('');
  }

  /* --------------------------------- toasts --------------------------------- */

  private showToast({ text, color }: { text: string; color?: string }): void {
    const stack = $('toast-stack');
    const el = document.createElement('div');
    const cls = color === 'cyan' ? 'cyan' : color === 'orange' ? 'orange' : color === 'green' ? 'lime' : color === 'red' ? 'red' : '';
    el.className = `toast ${cls}`;
    el.textContent = text;
    stack.appendChild(el);
    while (stack.children.length > 3) stack.removeChild(stack.firstChild as Node);
    window.setTimeout(() => el.classList.add('out'), 2400);
    window.setTimeout(() => el.remove(), 2900);
  }

  /* -------------------------------- main menu -------------------------------- */

  private setMenuVisible(v: boolean): void {
    if (this.menuVisible === v) return;
    this.menuVisible = v;
    this.onMenu = v;
    document.body.classList.toggle('menu-active', v);
    $('game-frame').classList.toggle('menu-open', v);
    this.refreshGameplayChrome();
    $('menu-overlay').classList.toggle('hidden', !v);
    $('menu-overlay').classList.remove('peeking'); // never reopen already-hidden
    this.refreshDevChrome();
    if (v) {
      this.buildHero();
      this.buildMenuScoutTargets();
      this.buildMenuEntries();
      this.positionMenuScoutTargets();
    }
    this.refreshTouch();
    this.refreshOrientationNudge();
  }

  /** Peek: collapse the menu so the Chagrin Falls title art shows in full, and
   *  tap anywhere (or the restore pill) to bring the menu back. Mobile keeps the
   *  whole homepage from being a wall of buttons; harmless on desktop. */
  private wireMenuPeek(): void {
    const overlay = $('menu-overlay');
    const setPeek = (on: boolean) => {
      overlay.classList.toggle('peeking', on);
      // move focus to whichever affordance is now interactive, so keyboard and
      // screen-reader users are never stranded on a hidden control
      if (on) ($('menu-restore') as HTMLButtonElement).focus?.();
      else ($('menu-peek') as HTMLButtonElement).focus?.();
    };
    $('menu-peek').addEventListener('click', (e) => {
      e.stopPropagation();
      setPeek(true);
    });
    $('menu-restore').addEventListener('click', (e) => {
      e.stopPropagation();
      setPeek(false);
    });
    // while peeking, a tap anywhere on the (now transparent) overlay restores
    overlay.addEventListener('click', () => {
      if (overlay.classList.contains('peeking')) setPeek(false);
    });
    // Esc restores too, for keyboard users
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('peeking')) {
        e.stopPropagation();
        setPeek(false);
      }
    });
  }

  private wireMenuScroll(): void {
    const overlay = $('menu-overlay');
    let lastY: number | null = null;
    const canScroll = () => this.menuVisible && overlay.scrollHeight > overlay.clientHeight + 1;

    overlay.addEventListener('wheel', (ev) => {
      if (!canScroll()) return;
      overlay.scrollTop += ev.deltaY;
      ev.preventDefault();
    }, { passive: false });

    overlay.addEventListener('touchstart', (ev) => {
      lastY = ev.touches[0]?.clientY ?? null;
    }, { passive: true });

    overlay.addEventListener('touchmove', (ev) => {
      if (!canScroll() || lastY === null) return;
      const y = ev.touches[0]?.clientY ?? lastY;
      const dy = lastY - y;
      lastY = y;
      if (Math.abs(dy) < 1) return;
      overlay.scrollTop += dy;
      ev.preventDefault();
    }, { passive: false });

    overlay.addEventListener('touchend', () => {
      lastY = null;
    }, { passive: true });
  }

  /** Build the crisp radar hero once, reusing the game's own probe texture. */
  private buildHero(): void {
    if (this.heroBuilt) return;
    const textures = this.game.textures;
    const robotSrc = textures.exists(TEX.player) ? textures.getBase64(TEX.player) : '';
    $('menu-hero').innerHTML = heroEmblemHtml(robotSrc);
    this.heroBuilt = true;
  }

  private buildMenuScoutTargets(): void {
    if (this.menuScoutButtons.length > 0) return;
    const overlay = $('menu-overlay');
    for (const scout of MENU_SCOUT_TARGETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-scout-hit';
      btn.setAttribute('aria-label', `Show ${scout.name} portrait`);
      btn.title = scout.name;
      const open = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
        bus.emit(EVT.scoutPortrait, { id: scout.id, name: scout.name, color: scout.color });
      };
      btn.addEventListener('click', open);
      btn.addEventListener('pointerup', open);
      btn.addEventListener('touchend', open);
      overlay.appendChild(btn);
      this.menuScoutButtons.push(btn);
    }
  }

  private positionMenuScoutTargets(): void {
    if (!this.menuVisible || this.menuScoutButtons.length === 0) return;
    const canvas = document.querySelector('#game-root canvas') as HTMLCanvasElement | null;
    const overlayRect = $('menu-overlay').getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    if (!canvasRect || canvasRect.width <= 0 || canvasRect.height <= 0) return;

    MENU_SCOUT_TARGETS.forEach((scout, i) => {
      const btn = this.menuScoutButtons[i];
      const left = canvasRect.left - overlayRect.left + (scout.x / 480) * canvasRect.width;
      const top = canvasRect.top - overlayRect.top + (scout.y / 270) * canvasRect.height;
      const size = Math.max(38, Math.min(54, canvasRect.width * 0.09));
      btn.style.left = `${Math.round(left - size / 2)}px`;
      btn.style.top = `${Math.round(top - size / 2)}px`;
      btn.style.width = `${Math.round(size)}px`;
      btn.style.height = `${Math.round(size)}px`;
    });
  }

  private buildMenuEntries(): void {
    this.menuEntries = [];
    const save = getSave();
    const hasSave = hasProgress();
    if (hasSave) {
      const zone = ZONE_LABELS[save.currentZone] ?? 'Miller Surface';
      const mins = Math.max(1, Math.round(save.playerStats.timePlayedSec / 60));
      const skin = save.selectedSkin && save.selectedSkin !== 'contact47' ? ` · ${skinById(save.selectedSkin).name}` : '';
      this.menuEntries.push({
        label: 'CONTINUE',
        icon: '▶',
        cls: 'primary',
        id: 'menu-continue',
        sub: `${zone.toUpperCase()} · ${save.signalFragments}◆ · ${mins}m${skin}`,
        action: () => bus.emit(EVT.uiStartGame, { continueRun: true }),
      });
    }
    this.menuEntries.push({
      label: 'NEW GAME',
      icon: '✦',
      cls: hasSave ? '' : 'primary',
      id: 'menu-new-game',
      sub: hasSave ? 'erase the current run and start over' : 'start the connected Chagrin Falls route',
      action: () => this.startNewGame(hasSave),
    });
    if (this.devMode()) {
      DEV_WARP_ZONES.forEach(([zoneId, label]) => {
        this.menuEntries.push({
          label: `WARP · ${label.toUpperCase()}`,
          icon: '◇',
          cls: 'dev-warp',
          id: `menu-warp-${zoneId}`,
          sub: 'dev test jump',
          action: () => this.devWarp(zoneId),
        });
      });
    }
    this.menuEntries.push(
      { label: 'COMMAND CENTER', icon: '▦', id: 'menu-command-center', action: () => this.openCommandCenter() },
      { label: 'SIGNAL ARCHIVE', icon: '▤', id: 'menu-archive', action: () => bus.emit(EVT.rewardOpenArchive, {}) },
      { label: 'WORKBENCH', icon: '⚒', id: 'menu-workbench', action: () => this.openWorkbench() },
      { label: 'FIELD MANUAL', icon: '❏', id: 'menu-field-manual', action: () => this.openCommandCenter('controls') },
      { label: 'SETTINGS', icon: '⚙', id: 'menu-settings', action: () => this.openSettings() }
    );
    this.menuFocus = 0;
    this.renderMenu($('menu-items'), this.menuEntries, this.menuFocus, (i) => {
      this.menuFocus = i;
      this.renderMenuFocus($('menu-items'), i);
    });
  }

  private startNewGame(hasExistingSave: boolean): void {
    if (hasExistingSave && !window.confirm('Start a new game? This erases the current save.')) return;
    resetSave();
    bus.emit(EVT.uiStartGame, { continueRun: false });
  }

  private devMode(): boolean {
    return import.meta.env.DEV || new URLSearchParams(window.location.search).has('test') || devState.god;
  }

  private devWarp(zoneId: string): void {
    updateSave((s) => {
      s.currentZone = zoneId;
      const questByZone: Record<string, string> = {
        'miller-field': 'the-first-contact',
        'motel-nowhere': 'motel-nowhere',
        'tiger-stadium': 'tiger-stadium',
        'pattersons-orchard': 'pattersons-orchard',
        'skyline-array': 'skyline-array',
      };
      s.currentQuest = questByZone[zoneId] ?? 'the-first-contact';
      s.questStep = 'wake';
    });
    bus.emit(EVT.uiStartGame, { continueRun: true });
  }

  private renderMenu(rootEl: HTMLElement, entries: MenuEntry[], focus: number, onHover: (i: number) => void): void {
    rootEl.innerHTML = '';
    entries.forEach((entry, i) => {
      const btn = document.createElement('button');
      btn.className = `menu-item ${entry.cls ?? ''} ${i === focus ? 'focused' : ''}`;
      if (entry.id) btn.id = entry.id;
      const sub = entry.sub ? `<span class="mi-sub">${entry.sub}</span>` : '';
      btn.innerHTML = `<span class="mi-icon">${entry.icon}</span><span class="mi-label">${entry.label}${sub}</span>`;
      btn.addEventListener('click', (ev) => {
        audio.unlock();
        audio.uiToggle();
        entry.action();
      });
      btn.addEventListener('mouseenter', () => onHover(i));
      rootEl.appendChild(btn);
    });
  }

  private renderMenuFocus(rootEl: HTMLElement, focus: number): void {
    [...rootEl.children].forEach((el, i) => el.classList.toggle('focused', i === focus));
  }

  /* ---------------------------------- pause ---------------------------------- */

  private buildPauseEntries(): void {
    this.pauseEntries = [
      { label: 'RESUME', icon: '▶', cls: 'primary', id: 'pause-resume', action: () => bus.emit(EVT.uiResume, {}) },
      { label: 'SETTINGS', icon: '⚙', id: 'pause-settings', action: () => this.openSettings() },
      { label: 'SIGNAL ARCHIVE', icon: '▦', id: 'pause-archive', action: () => bus.emit(EVT.rewardOpenArchive, {}) },
      { label: 'WORKBENCH', icon: '⚒', id: 'pause-workbench', action: () => this.openWorkbench() },
      { label: 'COMMAND CENTER', icon: '▤', id: 'pause-command-center', action: () => this.openCommandCenter() },
      { label: 'QUIT TO MENU', icon: '⌂', id: 'pause-quit-menu', action: () => this.confirmQuitToMenu() },
    ];
  }

  private setPauseVisible(v: boolean): void {
    if (this.pauseVisible === v) return;
    this.pauseVisible = v;
    $('pause-overlay').classList.toggle('hidden', !v);
    if (v) {
      this.pauseFocus = 0;
      this.renderMenu($('pause-items'), this.pauseEntries, this.pauseFocus, (i) => {
        this.pauseFocus = i;
        this.renderMenuFocus($('pause-items'), i);
      });
    }
    this.refreshTouch();
  }

  /* --------------------------------- settings -------------------------------- */

  private buildSettings(): void {
    const body = $('settings-body');
    body.innerHTML = `
      <div class="settings-section">
        <h3>SOUND</h3>
        <div class="settings-row">
          <div class="row-label">MASTER VOLUME<span class="row-sub" id="vol-readout"></span></div>
          <input type="range" class="vol" id="setting-volume" min="0" max="100" step="5" />
        </div>
        <div class="settings-row">
          <div class="row-label">MUSIC<span class="row-sub">procedural background themes</span></div>
          <div class="toggle" id="setting-music" role="switch" tabindex="0"><i></i></div>
        </div>
        <div class="settings-row">
          <div class="row-label">MUSIC VOLUME<span class="row-sub" id="musicvol-readout"></span></div>
          <input type="range" class="vol" id="setting-musicvol" min="0" max="100" step="5" />
        </div>
        <div class="settings-row">
          <div class="row-label">MUTE<span class="row-sub">all sound is synthesized — no audio files</span></div>
          <div class="toggle" id="setting-mute" role="switch" tabindex="0"><i></i></div>
        </div>
      </div>
      <div class="settings-section">
        <h3>VIDEO / FEEL</h3>
        <div class="settings-row">
          <div class="row-label">CRT SCANLINES<span class="row-sub">the console glass over the world</span></div>
          <div class="toggle" id="setting-crt" role="switch" tabindex="0"><i></i></div>
        </div>
        <div class="settings-row">
          <div class="row-label">SCREEN FILTER<span class="row-sub">stylize the title screen — more coming</span></div>
          <select class="filter-select" id="setting-filter"></select>
        </div>
        <div class="settings-row">
          <div class="row-label">SCREEN SHAKE<span class="row-sub">impacts, explosions, boss slams</span></div>
          <div class="toggle" id="setting-shake" role="switch" tabindex="0"><i></i></div>
        </div>
        <div class="settings-row">
          <div class="row-label">ON-SCREEN CONTROLS<span class="row-sub">touch D-pad + buttons for tablets</span></div>
          <select class="filter-select" id="setting-touch">
            <option value="auto">AUTO (touch devices)</option>
            <option value="on">ALWAYS ON</option>
            <option value="off">OFF</option>
          </select>
        </div>
      </div>
      <div class="settings-section">
        <h3>CONTROLS — KEYBOARD + GAMEPAD</h3>
        <table class="settings-table">
          <tr><th>ACTION</th><th>KEYBOARD / MOUSE</th><th>XBOX · PLAYSTATION</th></tr>
          <tr><td>Move</td><td class="key">WASD · ARROWS</td><td class="pad">Left stick · D-pad</td></tr>
          <tr><td>Dash</td><td class="key">SHIFT</td><td class="pad">RB / LB · R1 / L1</td></tr>
          <tr><td>Fire</td><td class="key">X · LEFT CLICK</td><td class="pad">X / RT · ▢ / R2</td></tr>
          <tr><td>Switch Weapon</td><td class="key">1 / 2 / 3 · R</td><td class="pad">L-stick / R-stick click</td></tr>
          <tr><td>Scan Pulse</td><td class="key">RIGHT CLICK · Q</td><td class="pad">Y / LT · △ / L2</td></tr>
          <tr><td>Interact / Overdrive</td><td class="key">E</td><td class="pad">B · ○</td></tr>
          <tr><td>Echo Blink (place / return)</td><td class="key">F</td><td class="pad">D-pad Up</td></tr>
          <tr><td>Pause</td><td class="key">ESC</td><td class="pad">START · OPTIONS</td></tr>
          <tr><td>Command Center</td><td class="key">C · TAB</td><td class="pad">BACK · SHARE</td></tr>
          <tr><td>Menu navigation</td><td class="key">↑ ↓ + ENTER</td><td class="pad">D-pad / stick + A · ✕</td></tr>
        </table>
        <p class="row-sub" style="margin-top:8px">Touch (iPad): on-screen D-pad + action buttons appear automatically — see FIELD MANUAL ▸ Controls.</p>
      </div>
      <div class="settings-section">
        <h3>GAMEPAD</h3>
        <div class="settings-row"><div id="pad-status-line">no controller detected — press any button on it</div></div>
        <div class="settings-row"><div class="row-sub">LIVE INPUT: <span id="pad-last-button">—</span></div></div>
      </div>
      <div class="settings-section">
        <h3>CONTROLLER — BUTTON REMAPPING</h3>
        <div id="rebind-list"></div>
        <div class="settings-row">
          <div class="row-label">RESTORE<span class="row-sub" id="rebind-hint">click REBIND, then press a button on your controller</span></div>
          <button class="filter-select" id="rebind-reset">RESET TO DEFAULTS</button>
        </div>
      </div>
      <div class="settings-section">
        <h3>UPDATES</h3>
        <div class="settings-row">
          <div class="row-label">GET LATEST<span class="row-sub">clear the cache and reload the newest build</span></div>
          <button class="filter-select" id="setting-update">CHECK FOR UPDATES</button>
        </div>
      </div>`;

    const vol = $('setting-volume') as unknown as HTMLInputElement;
    const syncVol = () => {
      vol.value = String(Math.round(audio.volume * 100));
      vol.style.setProperty('--fill', `${Math.round(audio.volume * 100)}%`);
      $('vol-readout').textContent = audio.muted ? 'muted' : `${Math.round(audio.volume * 100)}%`;
    };
    vol.addEventListener('input', () => {
      audio.unlock();
      audio.setVolume(Number(vol.value) / 100);
      syncVol();
      audio.uiToggle();
    });

    // music volume slider
    const mvol = $('setting-musicvol') as unknown as HTMLInputElement;
    const syncMusicVol = () => {
      const v = Math.round(settings.get('musicVolume') * 100);
      mvol.value = String(v);
      mvol.style.setProperty('--fill', `${v}%`);
      $('musicvol-readout').textContent = settings.get('music') ? `${v}%` : 'off';
    };
    mvol.addEventListener('input', () => {
      audio.unlock();
      settings.set('musicVolume', Number(mvol.value) / 100);
      syncMusicVol();
    });

    const wireToggle = (id: string, key: 'muted' | 'music' | 'crt' | 'shake', invert = false) => {
      const el = $(id);
      const sync = () => el.classList.toggle('on', invert ? !settings.get(key) : settings.get(key));
      const flip = () => {
        audio.unlock();
        if (key === 'muted') audio.toggleMute();
        else settings.set(key, !settings.get(key));
        sync();
        syncVol();
        syncMusicVol();
        audio.uiToggle();
      };
      el.addEventListener('click', flip);
      el.addEventListener('keydown', (ev) => {
        if ((ev as KeyboardEvent).key === 'Enter' || (ev as KeyboardEvent).key === ' ') flip();
      });
      sync();
    };
    wireToggle('setting-mute', 'muted');
    wireToggle('setting-music', 'music');
    wireToggle('setting-crt', 'crt');
    wireToggle('setting-shake', 'shake');

    // screen-filter dropdown (post-fx on the title camera; extend FILTERS to add more)
    const filterSel = $('setting-filter') as unknown as HTMLSelectElement;
    let filterHtml = '';
    let curGroup = '__root__';
    for (const f of FILTERS) {
      const g = f.group || '';
      if (g !== curGroup) {
        if (curGroup !== '__root__' && curGroup !== '') filterHtml += '</optgroup>';
        if (g !== '') filterHtml += `<optgroup label="${g}">`;
        curGroup = g;
      }
      filterHtml += `<option value="${f.id}">${f.label}</option>`;
    }
    if (curGroup !== '' && curGroup !== '__root__') filterHtml += '</optgroup>';
    filterSel.innerHTML = filterHtml;
    filterSel.value = settings.get('filter');
    filterSel.addEventListener('change', () => {
      audio.unlock();
      settings.set('filter', filterSel.value as FilterId);
      audio.uiToggle();
    });

    // on-screen touch controls mode (auto / on / off)
    const touchSel = $('setting-touch') as unknown as HTMLSelectElement;
    touchSel.value = settings.get('touchControls');
    touchSel.addEventListener('change', () => {
      audio.unlock();
      settings.set('touchControls', touchSel.value as TouchControlsMode);
      audio.uiToggle();
    });
    syncVol();
    syncMusicVol();

    // "Get Latest" — nuke any service worker + Cache Storage, then hard-reload so
    // the newest deploy is fetched fresh. A manual escape hatch from stale PWAs.
    const updateBtn = $('setting-update') as unknown as HTMLButtonElement;
    updateBtn.addEventListener('click', async () => {
      audio.unlock();
      audio.uiToggle();
      updateBtn.disabled = true;
      updateBtn.textContent = 'UPDATING…';
      bus.emit(EVT.toast, { text: 'FETCHING LATEST BUILD…', color: 'green' });
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        /* Best-effort: reload regardless so the newest HTML is requested. */
      }
      location.reload();
    });

    $('settings-close').addEventListener('click', () => this.closeSettings());

    this.renderRebindList();
    $('rebind-reset').addEventListener('click', () => {
      resetPadBindings();
      this.listenAction = null;
      this.renderRebindList();
      audio.uiToggle();
    });
  }

  /* ------------------------- controller remapping UI ------------------------ */

  private renderRebindList(): void {
    const host = document.getElementById('rebind-list');
    if (!host) return;
    const b = allPadBindings();
    host.innerHTML = PAD_ACTIONS.map((a) => {
      const listening = this.listenAction === a.id;
      const alt = b[a.id].alt !== undefined ? ` <span class="row-sub">(or ${padButtonLabel(b[a.id].alt as number)})</span>` : '';
      const val = listening ? '<b class="ok">press a button…</b>' : `${padButtonLabel(b[a.id].btn)}${alt}`;
      return `<div class="settings-row">
        <div class="row-label">${a.label}<span class="row-sub">${val}</span></div>
        <button class="filter-select" data-rebind="${a.id}">${listening ? 'CANCEL' : 'REBIND'}</button>
      </div>`;
    }).join('');
    host.querySelectorAll('[data-rebind]').forEach((el) =>
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).dataset.rebind as PadAction;
        if (this.listenAction === id) {
          this.listenAction = null;
        } else {
          this.listenAction = id;
          const pad = readPad();
          this.listenHeld = new Set(
            pad ? Object.entries(pad.buttons).filter(([, v]) => v).map(([k]) => Number(k)) : []
          );
        }
        this.renderRebindList();
        audio.uiToggle();
      })
    );
    const hint = document.getElementById('rebind-hint');
    if (hint) {
      hint.textContent = this.listenAction
        ? 'press a button on your controller (or click CANCEL)'
        : isPadDefault()
          ? 'defaults active — click REBIND, then press a button'
          : 'custom bindings active';
    }
  }

  /** while listening, grab the first freshly-pressed pad button */
  private pollRebind(pad: ReturnType<typeof readPad>): void {
    const action = this.listenAction;
    if (!action) return;
    if (!pad) return;
    for (const [k, v] of Object.entries(pad.buttons)) {
      const idx = Number(k);
      if (!v) {
        this.listenHeld.delete(idx);
        continue;
      }
      if (this.listenHeld.has(idx)) continue;
      const res = setPadBinding(action, idx);
      if (!res.ok) continue;
      this.listenAction = null;
      this.renderRebindList();
      if (res.swappedWith) {
        const other = PAD_ACTIONS.find((a) => a.id === res.swappedWith)?.label ?? res.swappedWith;
        const hint = document.getElementById('rebind-hint');
        if (hint) hint.textContent = `swapped with ${other}`;
      }
      return;
    }
  }

  openSettings(): void {
    if (this.settingsVisible) return;
    this.settingsVisible = true;
    $('settings-modal').classList.remove('hidden');
    this.pushModal();
    this.listenAction = null;
    this.renderRebindList();
    // live pad readout while open
    this.padPollTimer = window.setInterval(() => {
      const pad = readPad();
      const line = document.getElementById('pad-status-line');
      if (line) {
        line.innerHTML = pad
          ? `<b class="ok">CONNECTED</b> — ${pad.id ?? 'standard controller'}`
          : 'no controller detected — press any button on it';
      }
      if (this.listenAction) this.pollRebind(pad);
      const last = document.getElementById('pad-last-button');
      if (last && pad) {
        const pressed = Object.entries(pad.buttons)
          .filter(([, v]) => v)
          .map(([k]) => `B${k}`);
        const ax = pad.axes[0] && Math.abs(pad.axes[0]) > 0.3 ? [`stick ${pad.axes[0] > 0 ? '→' : '←'}`] : [];
        const txt = [...pressed, ...ax].join(' · ');
        if (txt) last.textContent = txt;
      }
    }, 200);
  }

  closeSettings(): void {
    if (!this.settingsVisible) return;
    this.settingsVisible = false;
    $('settings-modal').classList.add('hidden');
    if (this.padPollTimer !== null) {
      window.clearInterval(this.padPollTimer);
      this.padPollTimer = null;
    }
    this.listenAction = null;
    this.popModal();
  }

  /* ----------------------------- Chip's Workbench ---------------------------- */
  // Signal Shard shop (Channel B). A modal like Settings: pushModal pauses the
  // run while it's open. Purchases go through buyUpgrade (persists to the save).

  private wireWorkbench(): void {
    $('workbench-close').addEventListener('click', () => this.closeWorkbench());
    // keep the balance readout live if shards change while the shop is open
    bus.on(EVT.shardsChanged, () => {
      if (this.workbenchVisible) this.renderWorkbench();
    });
  }

  openWorkbench(): void {
    if (this.workbenchVisible) return;
    this.workbenchVisible = true;
    $('workbench-modal').classList.remove('hidden');
    this.renderWorkbench();
    this.pushModal();
  }

  closeWorkbench(): void {
    if (!this.workbenchVisible) return;
    this.workbenchVisible = false;
    $('workbench-modal').classList.add('hidden');
    this.popModal();
  }

  private renderWorkbench(): void {
    const save = getSave();
    $('workbench-balance').textContent = `${save.shards} ◈`;
    const body = $('workbench-body');
    const shopItems = UPGRADES.filter((u) => u.unlockType === 'shop');
    body.innerHTML = '';
    shopItems.forEach((u) => {
      const cost = u.cost ?? 0;
      const owned = ownsUpgrade(u.id);
      const affordable = save.shards >= cost;
      const row = document.createElement('div');
      row.className = `wb-item ${owned ? 'owned' : ''}`;
      const btnState = owned ? '✓ OWNED' : 'BUY';
      const disabled = owned || !affordable;
      row.innerHTML =
        `<div class="wb-info">` +
        `<span class="wb-name">${u.name}</span>` +
        `<span class="wb-desc">${u.description}</span>` +
        `</div>` +
        `<span class="wb-cost">${owned ? '—' : `${cost} ◈`}</span>` +
        `<button class="shell-btn wb-buy ${disabled ? 'disabled' : 'accent'}" ${disabled ? 'disabled' : ''}>${btnState}</button>`;
      const btn = row.querySelector('.wb-buy') as HTMLButtonElement;
      if (!disabled) {
        btn.addEventListener('click', () => this.tryBuy(u.id, cost, u.name));
      }
      body.appendChild(row);
    });
  }

  private tryBuy(id: string, cost: number, name: string): void {
    audio.unlock();
    if (buyUpgrade(id, cost)) {
      audio.uiToggle();
      bus.emit(EVT.toast, { text: `PURCHASED — ${name}`, color: 'green' });
    } else {
      bus.emit(EVT.toast, { text: 'NOT ENOUGH SHARDS', color: 'orange' });
    }
    this.renderWorkbench(); // reflect new balance + owned/afford states
  }

  /* ------------------------------ transmissions ------------------------------ */

  private wireTransmissionModal(): void {
    $('transmission-modal').addEventListener('click', () => this.hideTransmission());
  }

  showTransmission(payload: { title: string; body?: string; html?: string; accent?: string }): void {
    $('transmission-title').textContent = payload.title;
    $('transmission-title').className =
      payload.accent === 'will' ? 'scout-will' : payload.accent === 'chip' ? 'scout-chip' : payload.accent === 'fragment' ? 'fragment' : '';
    // rich cards (e.g. the how-to-play tutorial) pass pre-formatted html;
    // ordinary scout logs pass plain text.
    const body = $('transmission-body');
    if (payload.html !== undefined) {
      body.innerHTML = payload.html;
      $('transmission-card').classList.add('tutorial-card');
    } else {
      body.textContent = payload.body ?? '';
      $('transmission-card').classList.remove('tutorial-card');
    }
    $('transmission-modal').classList.remove('hidden');
    if (!this.transmissionVisible) {
      this.transmissionVisible = true;
      this.pushModal();
    }
  }

  hideTransmission(): void {
    if (!this.transmissionVisible) return;
    this.transmissionVisible = false;
    $('transmission-modal').classList.add('hidden');
    this.popModal();
    bus.emit(EVT.transmissionClosed, {});
  }

  get isTransmissionVisible(): boolean {
    return this.transmissionVisible;
  }

  private wirePortraitModal(): void {
    $('scout-portrait-modal').addEventListener('click', (ev) => {
      if (ev.target === $('scout-portrait-modal')) this.hideScoutPortrait();
    });
    $('scout-portrait-close').addEventListener('click', () => this.hideScoutPortrait());
  }

  showScoutPortrait(payload: { id: string; name: string; color: string }): void {
    const img = $('scout-portrait-img') as HTMLImageElement;
    img.src = `/assets/portraits/${payload.id}.png`;
    img.alt = `${payload.name} Signal Portrait`;
    $('scout-portrait-name').textContent = payload.name;
    $('scout-portrait-name').style.color = payload.color;
    $('scout-portrait-modal').classList.remove('hidden');
    if (!this.portraitVisible) {
      this.portraitVisible = true;
      this.pushModal();
    }
  }

  hideScoutPortrait(): void {
    if (!this.portraitVisible) return;
    this.portraitVisible = false;
    $('scout-portrait-modal').classList.add('hidden');
    this.popModal();
  }

  get isCcVisible(): boolean {
    return this.ccVisible;
  }

  toggleCommandCenter(): void {
    this.ccVisible ? this.closeCommandCenter() : this.openCommandCenter();
  }

  /* --------------------------- DEV console (type "erd") ---------------------- */

  private showDevPanel(): void {
    if (this.devVisible) return;
    this.devVisible = true;
    if (!this.devEl) this.buildDevPanel();
    this.refreshDevPanel();
    this.devEl!.classList.remove('hidden');
  }

  private hideDevPanel(): void {
    this.devVisible = false;
    this.devEl?.classList.add('hidden');
  }

  private buildDevPanel(): void {
    const el = document.createElement('div');
    el.id = 'dev-panel';
    el.className = 'hidden';
    el.innerHTML = `
      <div class="dev-card bracketed">
        <div class="dev-title">▚ ERD DEV CONSOLE <span id="dev-close">✕</span></div>
        <div class="dev-sec-h">GRANT</div>
        <div class="dev-row">
          <button data-act="abilities">All Abilities</button>
          <button data-act="skins">All Skins</button>
          <button data-act="frags">+5 Fragments</button>
          <button data-act="shards">+250 Shards</button>
        </div>
        <div class="dev-sec-h">SIGNAL CACHES / REWARDS</div>
        <div class="dev-row">
          <button data-act="cache-small">+ Small Cache</button>
          <button data-act="cache-scout">+ Scout Cache</button>
          <button data-act="cache-anomaly">+ Anomaly Cache</button>
          <button data-act="cache-broadcast">+ Broadcast Cache</button>
        </div>
        <div class="dev-row">
          <button data-act="open-cache">▸ Open a Cache</button>
          <button data-act="open-archive">▦ Signal Archive</button>
        </div>
        <div class="dev-sec-h">TOGGLES</div>
        <div class="dev-row">
          <button data-act="god" id="dev-god">God Mode: OFF</button>
          <button data-act="fly" id="dev-fly">Fly Mode: OFF</button>
          <button data-act="reset" class="danger">Clear Local Save</button>
        </div>
        <div class="dev-hint">Top-down only: <b>WASD</b> move · mouse/right stick aim · <b>X/click</b> fires · <b>Q</b> scans · <b>SHIFT</b> dashes · <b>G</b> toggles god mode.</div>
        <div class="dev-status" id="dev-status"></div>
      </div>`;
    document.body.appendChild(el);
    this.devEl = el;

    (el.querySelector('#dev-close') as HTMLElement).addEventListener('click', () => this.hideDevPanel());
    el.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', () => this.devAction((b as HTMLElement).dataset.act as string))
    );
  }

  private refreshDevPanel(): void {
    if (!this.devEl) return;
    const s = getSave();
    const god = this.devEl.querySelector('#dev-god');
    if (god) god.textContent = `God Mode: ${devState.god ? 'ON' : 'OFF'}`;
    (this.devEl.querySelector('#dev-god') as HTMLElement)?.classList.toggle('on', devState.god);
    const fly = this.devEl.querySelector('#dev-fly');
    if (fly) fly.textContent = `Fly Mode: ${devState.fly ? 'ON' : 'OFF'}`;
    (this.devEl.querySelector('#dev-fly') as HTMLElement)?.classList.toggle('on', devState.fly);
    this.devStatus(
      `${s.unlockedAbilities.length} abilities · ${s.unlockedSkins.length} skins · ${s.signalFragments} frags · ${s.shards} shards`
    );
  }

  private devStatus(msg: string): void {
    const st = this.devEl?.querySelector('#dev-status');
    if (st) st.textContent = msg;
  }

  private devAction(act: string): void {
    switch (act) {
      case 'abilities':
        UPGRADES.forEach((u) => grantAbility(u.id));
        break;
      case 'skins':
        ['contact47', 'will', 'chip', 'henry', 'cameron', 'danny'].forEach(unlockSkin);
        break;
      case 'frags':
        updateSave((s) => {
          s.signalFragments += 5;
        });
        bus.emit(EVT.fragmentCount, { count: getSave().signalFragments });
        break;
      case 'shards':
        addShards(250);
        break;
      case 'cache-small':
        rewards.grantCache('small-signal');
        break;
      case 'cache-scout':
        rewards.grantCache('scout');
        break;
      case 'cache-anomaly':
        rewards.grantCache('anomaly');
        break;
      case 'cache-broadcast':
        rewards.grantCache('broadcast');
        break;
      case 'open-cache':
        this.hideDevPanel();
        bus.emit(EVT.rewardOpenCache, {});
        return;
      case 'open-archive':
        this.hideDevPanel();
        bus.emit(EVT.rewardOpenArchive, {});
        return;
      case 'god':
        devState.god = !devState.god;
        bus.emit(EVT.godMode, { on: devState.god });
        break;
      case 'fly':
        devState.fly = !devState.fly;
        bus.emit(EVT.flyMode, { on: devState.fly });
        bus.emit(EVT.toast, {
          text: devState.fly ? 'FLY MODE ON — noclip · move stick + PRIMARY/↑ up · ↓ down' : 'FLY MODE OFF',
          color: devState.fly ? 'green' : 'orange',
        });
        break;
      case 'reset':
        if (window.confirm('Clear local BLIP save data?')) {
          resetSave();
          window.location.reload();
        }
        return;
    }
    this.refreshDevPanel();
  }

  /* ------------------------------ keyboard nav ------------------------------- */

  private onKeyDown(ev: KeyboardEvent): void {
    // DEV: type "erd" on the title screen to open the developer panel
    if (this.devVisible) {
      if (ev.code === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        this.hideDevPanel();
      }
      return; // panel is mouse-driven; swallow menu nav underneath
    }
    if (this.onMenu && ev.key && ev.key.length === 1) {
      this.devBuffer = (this.devBuffer + ev.key.toLowerCase()).slice(-3);
      if (this.devBuffer === 'erd') {
        this.devBuffer = '';
        this.showDevPanel();
        ev.preventDefault();
        return;
      }
    }

    // transmission eats (almost) everything
    if (this.transmissionVisible) {
      if (ev.key !== 'F5' && ev.key !== 'F12') {
        ev.preventDefault();
        ev.stopPropagation();
        this.hideTransmission();
      }
      return;
    }
    if (this.settingsVisible) {
      if (ev.code === 'Escape' || ev.code === 'KeyC' || ev.code === 'Tab') {
        ev.preventDefault();
        ev.stopPropagation();
        this.closeSettings();
      }
      return; // let sliders/toggles receive keys
    }
    if (this.ccVisible) {
      if (ev.code === 'Escape' || ev.code === 'KeyC' || ev.code === 'Tab') {
        ev.preventDefault();
        ev.stopPropagation();
        this.closeCommandCenter();
      }
      return;
    }
    if (this.workbenchVisible) {
      if (ev.code === 'Escape' || ev.code === 'KeyC' || ev.code === 'Tab') {
        ev.preventDefault();
        ev.stopPropagation();
        this.closeWorkbench();
      }
      return;
    }

    // menu / pause list navigation
    const navTarget = this.menuVisible ? 'menu' : this.pauseVisible ? 'pause' : null;
    if (navTarget) {
      const entries = navTarget === 'menu' ? this.menuEntries : this.pauseEntries;
      const rootEl = navTarget === 'menu' ? $('menu-items') : $('pause-items');
      let focus = navTarget === 'menu' ? this.menuFocus : this.pauseFocus;
      if (ev.code === 'ArrowDown' || ev.code === 'KeyS') {
        focus = (focus + 1) % entries.length;
        ev.preventDefault();
      } else if (ev.code === 'ArrowUp' || ev.code === 'KeyW') {
        focus = (focus - 1 + entries.length) % entries.length;
        ev.preventDefault();
      } else if (ev.code === 'Enter' || ev.code === 'NumpadEnter' || (navTarget === 'menu' && ev.code === 'Space')) {
        ev.preventDefault();
        audio.unlock();
        audio.uiToggle();
        entries[focus].action();
        return;
      }
      if (navTarget === 'menu') this.menuFocus = focus;
      else this.pauseFocus = focus;
      this.renderMenuFocus(rootEl, focus);
      if (ev.code === 'KeyC' || ev.code === 'Tab') {
        ev.preventDefault();
        this.openCommandCenter();
      }
      return;
    }

    // gameplay-level shell keys
    switch (ev.code) {
      case 'KeyC':
      case 'Tab':
        ev.preventDefault();
        this.toggleCommandCenter();
        break;
      case 'F1':
        ev.preventDefault();
        bus.emit(EVT.debugToggle, {});
        break;
    }
  }

  /* ------------------------------- gamepad nav ------------------------------- */

  private startPadLoop(): void {
    const step = () => {
      this.pollPad();
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

  private padJust(pad: ReturnType<typeof readPad>, index: number): boolean {
    return pad?.buttons[index] === true && this.prevPad?.buttons[index] !== true;
  }

  private pollPad(): void {
    const pad = readPad();
    const stickYRaw = pad?.axes[1] ?? 0;
    const stickY = Math.abs(stickYRaw) > 0.5 ? Math.sign(stickYRaw) : 0;
    const stickEdge = stickY !== 0 && stickY !== this.prevStickY ? stickY : 0;

    if (pad) {
      if (this.transmissionVisible) {
        const anyEdge = Object.keys(pad.buttons).some((k) => this.padJust(pad, Number(k)));
        if (anyEdge) this.hideTransmission();
      } else if (this.settingsVisible) {
        if (this.padJust(pad, PAD.interact) || this.padJust(pad, PAD.start)) this.closeSettings();
      } else if (this.ccVisible) {
        if (this.padJust(pad, PAD.interact) || this.padJust(pad, PAD.select) || this.padJust(pad, PAD.start)) {
          this.closeCommandCenter();
        }
      } else if (this.menuVisible || this.pauseVisible) {
        const entries = this.menuVisible ? this.menuEntries : this.pauseEntries;
        const rootEl = this.menuVisible ? $('menu-items') : $('pause-items');
        let focus = this.menuVisible ? this.menuFocus : this.pauseFocus;
        const down = this.padJust(pad, PAD.dpadDown) || stickEdge > 0;
        const up = this.padJust(pad, PAD.dpadUp) || stickEdge < 0;
        if (down) focus = (focus + 1) % entries.length;
        if (up) focus = (focus - 1 + entries.length) % entries.length;
        if (down || up) {
          if (this.menuVisible) this.menuFocus = focus;
          else this.pauseFocus = focus;
          this.renderMenuFocus(rootEl, focus);
          audio.uiToggle();
        }
        if (this.padJust(pad, PAD.primary)) {
          audio.unlock();
          entries[focus].action();
        }
        if (this.pauseVisible && (this.padJust(pad, PAD.start) || this.padJust(pad, PAD.interact))) {
          bus.emit(EVT.uiResume, {});
        }
      } else {
        // in gameplay: BACK/SELECT opens the Command Center (START handled in-scene)
        if (this.padJust(pad, PAD.select)) this.openCommandCenter();
      }
    }

    this.prevPad = pad;
    this.prevStickY = stickY;
  }
}
