/**
 * BLIPSTREAM NODE A — inside the Signal.
 * Abstract waveform space: black void, glowing platform bars, red static
 * hazards, a sweeping scan line and three node switches. Route all three,
 * exit through the gate, and the crop-circle door outside answers.
 * Rules: .claude/skills/blipstream-puzzle (no literal interiors, short, world-changing).
 */
import Phaser from 'phaser';
import { BLIP_ROOM, EVT, VIEW_H, PALETTE as P, PULSE, RENDER_ZOOM, SCAN, SCENES, TEX, css } from '../config';
import { BLIP_ROOMS, NODE_A, walkLevel, type LevelDef } from '../data/levels';
import { Player } from '../entities/Player';
import { Projectile, fireFrom, makeProjectileGroup } from '../entities/Projectile';
import { audio } from '../systems/AudioSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { attachScreenFilter } from '../systems/ScreenFilter';
import { bus } from '../systems/EventBus';
import { PlayerInput } from '../systems/InputSystem';
import { quests } from '../systems/QuestSystem';
import { getSave } from '../systems/SaveSystem';
import { activeSkin } from '../systems/SkinState';
import { registerScene, unregisterScene } from '../systems/TestAPI';
import { uiOverlayActive } from '../systems/UIState';

interface NodeSwitch {
  sprite: Phaser.Physics.Arcade.Image;
  glow: Phaser.GameObjects.Image;
  active: boolean;
  index: number;
}

/** a breaker: shoot to latch, it bleeds back out unless the whole run goes hot */
interface Breaker {
  sprite: Phaser.Physics.Arcade.Image;
  glow: Phaser.GameObjects.Image;
  latched: boolean;
  latchedAt: number;
}

/** a '%' platform that phases in and out on a telegraphed beat */
interface PhasePlatform {
  img: Phaser.Physics.Arcade.Image;
  phase: number; // 0..1 offset in the beat
  solid: boolean;
}

/** a frequency-band platform — only solid while its band is the live one */
interface BandPlatform {
  img: Phaser.Physics.Arcade.Image;
  band: number;
  baseY: number;
}

export class BlipstreamScene extends Phaser.Scene {
  player!: Player;
  private def: LevelDef = NODE_A;
  private roomId = 'node-a';
  private breakers: Breaker[] = [];
  private phasePlats: PhasePlatform[] = [];
  private bandPlats: BandPlatform[] = [];
  private tuners: Phaser.Physics.Arcade.Image[] = [];
  private liveBand = 1;
  private syncPads: Array<{ img: Phaser.GameObjects.Image; lit: boolean }> = [];
  private echo?: Phaser.GameObjects.Image;
  private echoTrail: Array<{ t: number; x: number; y: number }> = [];
  private synced = false;
  private objectiveText?: Phaser.GameObjects.Text;
  private input2!: PlayerInput;
  private fx!: EffectsSystem;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private hazards: Phaser.GameObjects.Image[] = [];
  private oscPlatforms: Array<{ img: Phaser.Physics.Arcade.Image; baseY: number; phase: number }> = [];
  private nodes: NodeSwitch[] = [];
  private wires!: Phaser.GameObjects.Graphics;
  private waveform!: Phaser.GameObjects.Graphics;
  playerBolts!: Phaser.Physics.Arcade.Group;
  private gate!: Phaser.GameObjects.Image;
  private gateGlow!: Phaser.GameObjects.Image;
  private gatePos = { x: 0, y: 0 };
  private gateOpen = false;
  private scanLine!: Phaser.GameObjects.Image;
  private scanLineGlow!: Phaser.GameObjects.Image;
  private spawnPoint = { x: 0, y: 0 };
  private exiting = false;
  private isPaused = false;
  private gameOverShown = false;
  private unsubs: Array<() => void> = [];

  constructor() {
    super(SCENES.blipstream);
  }

  create(): void {
    this.roomId = (this.registry.get('blipRoomId') as string) ?? 'node-a';
    const def = BLIP_ROOMS[this.roomId] ?? NODE_A;
    this.def = def;
    this.fx = new EffectsSystem(this);
    attachScreenFilter(this, true); // level screen filter (dialed down for gameplay)
    this.input2 = new PlayerInput(this);
    this.hazards = [];
    this.oscPlatforms = [];
    this.nodes = [];
    this.breakers = [];
    this.phasePlats = [];
    this.bandPlats = [];
    this.tuners = [];
    this.syncPads = [];
    this.echoTrail = [];
    this.echo = undefined;
    this.synced = false;
    this.liveBand = def.meta.blip?.startBand ?? 1;
    this.exiting = false;
    this.isPaused = false;
    this.gameOverShown = false;
    this.gateOpen = false;

    // the void
    this.cameras.main.setBackgroundColor('#020308');
    this.add.tileSprite(0, 0, def.meta.widthPx, def.meta.heightPx, TEX.gridBg).setOrigin(0).setDepth(0).setAlpha(0.7);
    this.scatterMotes(def.meta.widthPx, def.meta.heightPx);
    this.waveform = this.add.graphics().setDepth(1);

    this.platforms = this.physics.add.staticGroup();
    this.playerBolts = makeProjectileGroup(this, TEX.boltPlayer, PULSE.maxActive);

    let nodeIndex = 0;
    walkLevel(def, (ch, _col, _row, x, y) => {
      switch (ch) {
        case '-': {
          const t = this.platforms.create(x, y, TEX.wavePlatform) as Phaser.Physics.Arcade.Image;
          t.setDepth(8);
          (t.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 8).setOffset(0, 0);
          break;
        }
        case '~': {
          const img = this.physics.add.staticImage(x + 8, y, TEX.wavePlatform).setDepth(8);
          img.setDisplaySize(32, 8);
          (img.body as Phaser.Physics.Arcade.StaticBody).setSize(32, 8);
          img.setTint(P.signalGreen);
          this.oscPlatforms.push({ img: img as unknown as Phaser.Physics.Arcade.Image, baseY: y, phase: x * 0.05 });
          break;
        }
        case '!': {
          const h = this.add.image(x, y, TEX.hazardBar).setDepth(9);
          this.hazards.push(h);
          break;
        }
        case 'o': {
          const glow = this.add.image(x, y, TEX.glow8).setScale(2.6).setTint(P.signalDim).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(9);
          const sprite = this.physics.add.staticImage(x, y, TEX.nodeSwitch).setDepth(10);
          (sprite.body as Phaser.Physics.Arcade.StaticBody).setSize(18, 18);
          this.nodes.push({ sprite, glow, active: false, index: nodeIndex++ });
          break;
        }
        case 'b': {
          // breaker — shoot to latch; bleeds back out after the hold window
          const glow = this.add.image(x, y, TEX.glow8).setScale(2.4).setTint(P.neonAmberDim).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(9);
          const sprite = this.physics.add.staticImage(x, y, TEX.powerSwitch).setDepth(10).setTint(P.neonAmberDim);
          (sprite.body as Phaser.Physics.Arcade.StaticBody).setSize(18, 18);
          this.breakers.push({ sprite, glow, latched: false, latchedAt: 0 });
          break;
        }
        case '%': {
          // phasing platform — solid only on its beat, telegraphed before it drops
          const img = this.physics.add.staticImage(x + 8, y, TEX.wavePlatform).setDepth(8);
          img.setDisplaySize(32, 8);
          (img.body as Phaser.Physics.Arcade.StaticBody).setSize(32, 8);
          img.setTint(P.signal);
          this.phasePlats.push({ img: img as unknown as Phaser.Physics.Arcade.Image, phase: (this.phasePlats.length * 0.27) % 1, solid: true });
          break;
        }
        case '1':
        case '2': {
          const band = ch === '1' ? 1 : 2;
          const img = this.physics.add.staticImage(x, y, TEX.wavePlatform).setDepth(8);
          (img.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 8).setOffset(0, 0);
          img.setTint(band === 1 ? P.signal : P.signalGreen);
          this.bandPlats.push({ img: img as unknown as Phaser.Physics.Arcade.Image, band, baseY: y });
          break;
        }
        case 'T': {
          const t = this.physics.add.staticImage(x, y, TEX.nodeSwitch).setDepth(10).setTint(P.white);
          (t.body as Phaser.Physics.Arcade.StaticBody).setSize(18, 18);
          this.tuners.push(t as unknown as Phaser.Physics.Arcade.Image);
          break;
        }
        case 'd': {
          const pad = this.add.image(x, y + 4, TEX.syncPad).setDepth(7).setTint(P.signalDim).setAlpha(0.75);
          this.syncPads.push({ img: pad, lit: false });
          break;
        }
        case 'E': {
          this.gatePos = { x, y: y + 4 };
          break;
        }
        case 'P':
          this.spawnPoint = { x, y };
          break;
      }
    });

    // wires between nodes → gate (dim until routed)
    this.wires = this.add.graphics().setDepth(2);
    this.drawWires();

    // exit gate
    this.gateGlow = this.add
      .image(this.gatePos.x, this.gatePos.y, TEX.glow8)
      .setScale(5)
      .setTint(P.signalGreen)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.12)
      .setDepth(9);
    this.gate = this.add.image(this.gatePos.x, this.gatePos.y, TEX.exitGate).setDepth(10).setAlpha(0.45).setTint(P.uiDim);

    // sweeping scan line hazard — a soft red glow behind the thin bar so the
    // moving hazard reads clearly against the grid (the bright core is the hit line)
    const sl = def.meta.scanLine;
    this.scanLineGlow = this.add
      .image(sl ? sl.x0 : -50, def.meta.heightPx / 2, TEX.glow8)
      .setTint(P.danger)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(10)
      .setDisplaySize(16, def.meta.heightPx * 1.05)
      .setAlpha(0.32);
    this.scanLine = this.add.image(sl ? sl.x0 : -50, def.meta.heightPx / 2, TEX.scanLine).setDepth(11);
    this.scanLine.setDisplaySize(6, def.meta.heightPx);

    // player
    this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.fx);
    this.player.setSkin(getSave().selectedSkin);
    const sk = activeSkin();
    bus.emit(EVT.skinSelected, { id: sk.id, name: sk.name, color: sk.color, live: false });
    this.physics.add.collider(this.player, this.platforms);

    this.physics.add.collider(this.playerBolts, this.platforms, (bolt) => {
      const b = bolt as Projectile;
      this.fx.sparks(b.x, b.y, P.signal, 3);
      b.kill();
    });

    // bolts activate node switches
    this.nodes.forEach((node) => {
      this.physics.add.overlap(this.playerBolts, node.sprite, (_s, bolt) => {
        const b = bolt as Projectile;
        if (!b.active || node.active) return;
        b.kill();
        this.activateNode(node);
      });
    });

    // bolts latch breakers
    this.breakers.forEach((br) => {
      this.physics.add.overlap(this.playerBolts, br.sprite, (_s, bolt) => {
        const b = bolt as Projectile;
        if (!b.active || br.latched) return;
        b.kill();
        this.latchBreaker(br);
      });
    });

    // bolts swap the live frequency band
    this.tuners.forEach((t) => {
      this.physics.add.overlap(this.playerBolts, t, (_s, bolt) => {
        const b = bolt as Projectile;
        if (!b.active) return;
        b.kill();
        this.swapBand(t.x, t.y);
      });
    });

    // mirror rooms — the delayed echo + low gravity
    if (this.syncPads.length >= 2) {
      this.echo = this.add
        .image(this.spawnPoint.x, this.spawnPoint.y, TEX.echoBody)
        .setDepth(9)
        .setAlpha(0.6)
        .setTint(P.signalGreen);
      const lowG = def.meta.blip?.lowGravity ?? 0;
      if (lowG) (this.player.body as Phaser.Physics.Arcade.Body).setGravityY(-lowG);
    }
    this.applyBandState();

    this.physics.world.setBounds(0, -VIEW_H, def.meta.widthPx, def.meta.heightPx + VIEW_H);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.cameras.main.setZoom(RENDER_ZOOM);
    this.cameras.main.setBounds(0, 0, def.meta.widthPx, Math.max(def.meta.heightPx, VIEW_H * 0.63));
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.fadeIn(400, 2, 3, 8);

    const zoneLabel = (this.registry.get('blipZoneLabel') as string) ?? 'Blipstream Node A';
    audio.playMusic('blipstream');
    bus.emit(EVT.sceneChanged, { scene: SCENES.blipstream, zone: zoneLabel });
    bus.emit(EVT.toast, { text: 'INSIDE THE SIGNAL', color: 'cyan' });
    const objective = def.meta.blip?.objective;
    if (objective) {
      this.objectiveText = this.add
        .text(this.spawnPoint.x, this.spawnPoint.y - 40, objective, {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: css(P.signal),
          backgroundColor: 'rgba(5,7,15,0.72)',
          padding: { x: 3, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(14)
        .setResolution(2);
      this.tweens.add({ targets: this.objectiveText, alpha: 0, delay: 4200, duration: 900 });
    }
    this.player.refreshHud();

    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.unsubs.push(bus.on(EVT.uiResume, () => this.setPaused(false)));
    this.unsubs.push(
      bus.on(EVT.skinSelected, (d) => {
        const id = (d as { id: string }).id;
        if (this.player?.active && activeSkin().id !== id) this.player.setSkin(id);
      })
    );
    this.unsubs.push(bus.on(EVT.debugGotoField, () => this.exitToField(false)));
    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    registerScene('blipstream', this);

    // exit hint text floating over gate
    this.add
      .text(this.gatePos.x, this.gatePos.y - 32, 'EXIT', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: css(P.signalGreen),
      })
      .setOrigin(0.5)
      .setDepth(12)
      .setResolution(2)
      .setAlpha(0.7);
  }

  private onWake(): void {
    // re-entered from field (debug) — reset player position
    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    const zoneLabel = (this.registry.get('blipZoneLabel') as string) ?? 'Blipstream Node A';
    bus.emit(EVT.sceneChanged, { scene: SCENES.blipstream, zone: zoneLabel });
  }

  /** Ambient signal motes drifting through the void — the abstract space reads
   *  as *alive* / inhabited rather than an empty black room. Pure atmosphere. */
  private scatterMotes(w: number, h: number): void {
    for (let i = 0; i < 16; i++) {
      const mx = 40 + Math.random() * (w - 80);
      const my = 18 + Math.random() * (h - 36);
      const mote = this.add
        .image(mx, my, TEX.glow8)
        .setTint(i % 3 === 0 ? P.signalGreen : P.signal)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.3 + Math.random() * 0.35)
        .setAlpha(0.16)
        .setDepth(1);
      this.tweens.add({
        targets: mote,
        x: mx + (Math.random() * 40 - 20),
        y: my - (10 + Math.random() * 26),
        alpha: { from: 0.07, to: 0.32 },
        duration: 2600 + Math.random() * 2600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1600,
      });
    }
  }

  private drawWires(): void {
    this.wires.clear();
    const pts = [...this.nodes.map((n) => ({ x: n.sprite.x, y: n.sprite.y })), this.gatePos];
    for (let i = 0; i < pts.length - 1; i++) {
      const from = pts[i];
      const to = pts[i + 1];
      const routed = this.nodes[i]?.active ?? false;
      this.wires.lineStyle(1, routed ? P.signal : P.signalDim, routed ? 0.9 : 0.3);
      // stepped "circuit" path
      const midX = (from.x + to.x) / 2;
      this.wires.beginPath();
      this.wires.moveTo(from.x, from.y);
      this.wires.lineTo(midX, from.y);
      this.wires.lineTo(midX, to.y);
      this.wires.lineTo(to.x, to.y);
      this.wires.strokePath();
    }
  }

  private activateNode(node: NodeSwitch): void {
    node.active = true;
    node.sprite.setTint(P.signal);
    node.glow.setTint(P.signal).setAlpha(0.8);
    audio.nodeActivate();
    this.fx.sparks(node.sprite.x, node.sprite.y, P.signal, 10);
    this.fx.floatText(node.sprite.x, node.sprite.y - 12, `NODE ${node.index + 1}/3`, P.signal);
    this.drawWires();

    // send a routing pulse down the wire
    const next = this.nodes[node.index + 1]?.sprite ?? this.gate;
    const dot = this.add.image(node.sprite.x, node.sprite.y, TEX.glow8).setTint(P.white).setBlendMode(Phaser.BlendModes.ADD).setDepth(12);
    this.tweens.add({
      targets: dot,
      x: next.x,
      y: next.y,
      duration: 550,
      ease: 'Sine.easeInOut',
      onComplete: () => dot.destroy(),
    });

    this.checkSolved();
  }

  /* ------------------------- room mechanics (side rooms) --------------------- */

  /** every lock in the room is satisfied → the exit answers */
  private checkSolved(): void {
    if (this.nodes.some((n) => !n.active)) return;
    if (this.breakers.some((b) => !b.latched)) return;
    if (this.syncPads.length >= 2 && !this.synced) return;
    this.openGate();
  }

  /** ZONE 2 — latch a breaker. The whole run has to be hot at once; a lone
   *  breaker bleeds back out after the hold window. All hot → they overload lit. */
  private latchBreaker(br: Breaker): void {
    br.latched = true;
    br.latchedAt = this.time.now;
    br.sprite.setTint(P.neonAmber);
    br.glow.setTint(P.neonAmber).setAlpha(0.85);
    audio.nodeActivate();
    this.fx.sparks(br.sprite.x, br.sprite.y, P.neonAmber, 10);
    const hot = this.breakers.filter((b) => b.latched).length;
    this.fx.floatText(br.sprite.x, br.sprite.y - 12, `BREAKER ${hot}/${this.breakers.length}`, P.neonAmber);
    if (hot >= this.breakers.length) {
      this.fx.flash(P.neonAmber, 140);
      bus.emit(EVT.toast, { text: 'OVERLOAD — THE RUN STAYS LIT', color: 'orange' });
    }
    this.checkSolved();
  }

  private unlatchBreaker(br: Breaker): void {
    br.latched = false;
    br.sprite.setTint(P.neonAmberDim);
    br.glow.setTint(P.neonAmberDim).setAlpha(0.3);
    this.fx.floatText(br.sprite.x, br.sprite.y - 12, 'BLED OUT', P.danger);
    audio.hazardZap();
  }

  /** ZONE 5 — swap which frequency band is solid */
  private swapBand(x: number, y: number): void {
    this.liveBand = this.liveBand === 1 ? 2 : 1;
    audio.nodeActivate();
    this.fx.sparks(x, y, P.white, 8);
    this.fx.floatText(x, y - 12, `BAND ${this.liveBand}`, this.liveBand === 1 ? P.signal : P.signalGreen);
    this.applyBandState();
  }

  private applyBandState(): void {
    for (const bp of this.bandPlats) {
      const live = bp.band === this.liveBand;
      bp.img.setAlpha(live ? 1 : 0.18);
      (bp.img.body as Phaser.Physics.Arcade.StaticBody).enable = live;
    }
  }

  /** ZONE 3 — light both sync pads at once (you now, your echo 2s ago, mirrored) */
  private updateEcho(now: number): void {
    if (!this.echo) return;
    const delay = this.def.meta.blip?.echoDelayMs ?? BLIP_ROOM.echoDelayMs;
    const last = this.echoTrail[this.echoTrail.length - 1];
    if (!last || now - last.t >= BLIP_ROOM.echoSampleMs) {
      this.echoTrail.push({ t: now, x: this.player.x, y: this.player.y });
    }
    while (this.echoTrail.length > 2 && this.echoTrail[1].t <= now - delay) this.echoTrail.shift();
    const src = this.echoTrail[0];
    if (src && now - src.t >= delay * 0.9) {
      this.echo.setPosition(this.def.meta.widthPx - src.x, src.y); // mirrored horizontally
      this.echo.setFlipX(true);
    }

    // pads: pad[0] wants the echo, pad[1] wants you
    const [padEcho, padYou] = this.syncPads;
    const r = BLIP_ROOM.syncPadRadius;
    const echoOn = Math.abs(this.echo.x - padEcho.img.x) < r && Math.abs(this.echo.y - padEcho.img.y) < r + 6;
    const youOn = Math.abs(this.player.x - padYou.img.x) < r && Math.abs(this.player.y - padYou.img.y) < r + 6;
    this.setPad(padEcho, echoOn);
    this.setPad(padYou, youOn);
    if (echoOn && youOn && !this.synced) {
      this.synced = true;
      audio.doorUnlock();
      this.fx.flash(P.signalGreen, 150);
      this.fx.floatText(this.player.x, this.player.y - 16, 'SYNCED', P.signalGreen);
      this.checkSolved();
    }
  }

  private setPad(pad: { img: Phaser.GameObjects.Image; lit: boolean }, lit: boolean): void {
    if (pad.lit === lit) return;
    pad.lit = lit;
    pad.img.setTint(lit ? P.signalGreen : P.signalDim).setAlpha(lit ? 1 : 0.75);
  }

  /** ZONE 4 — phasing platforms: solid on the beat, telegraphed before they go */
  private updatePhasePlatforms(now: number): void {
    if (!this.phasePlats.length) return;
    const period = this.def.meta.blip?.phasePeriodMs ?? BLIP_ROOM.phasePeriodMs;
    for (const pp of this.phasePlats) {
      const t = ((now / period) + pp.phase) % 1;
      const solid = t < BLIP_ROOM.phaseOnRatio;
      const warn = solid && t > BLIP_ROOM.phaseOnRatio - BLIP_ROOM.phaseWarnMs / period;
      if (solid !== pp.solid) {
        pp.solid = solid;
        (pp.img.body as Phaser.Physics.Arcade.StaticBody).enable = solid;
      }
      const img = pp.img as unknown as Phaser.GameObjects.Image;
      if (!solid) img.setAlpha(0.16).setTint(P.signalDim);
      else if (warn) img.setAlpha(0.45 + 0.45 * Math.abs(Math.sin(now * 0.03))).setTint(P.danger);
      else img.setAlpha(1).setTint(P.signal);
    }
  }

  private openGate(): void {
    if (this.gateOpen) return;
    this.gateOpen = true;
    this.gate.setTint(P.signalGreen).setAlpha(1);
    this.gateGlow.setAlpha(0.5);
    this.tweens.add({ targets: this.gateGlow, alpha: { from: 0.5, to: 0.85 }, duration: 700, yoyo: true, repeat: -1 });
    audio.doorUnlock();
    this.fx.flash(P.signalGreen, 150);
    bus.emit(EVT.toast, { text: 'SIGNAL ROUTED — EXIT OPEN [E]', color: 'green' });
  }

  /** Test API: instantly route everything and leave */
  solveAndExit(): void {
    this.breakers.forEach((b) => {
      b.latched = true;
      b.latchedAt = this.time.now;
      b.sprite.setTint(P.neonAmber);
      b.glow.setTint(P.neonAmber).setAlpha(0.85);
    });
    this.synced = true;
    this.syncPads.forEach((p) => this.setPad(p, true));
    this.nodes.forEach((n) => {
      if (!n.active) {
        n.active = true;
        n.sprite.setTint(P.signal);
        n.glow.setTint(P.signal).setAlpha(0.8);
      }
    });
    this.drawWires();
    this.openGate();
    this.exitToField(true);
  }

  private exitToField(solved: boolean): void {
    if (this.exiting) return;
    this.exiting = true;
    // Node A drives the Miller Field quest via `nodeJustSolved`; the optional
    // side rooms report separately so no zone mistakes them for its own beat.
    if (solved) {
      if (this.roomId === 'node-a') this.registry.set('nodeJustSolved', true);
      else this.registry.set('blipRoomSolved', this.roomId);
    }
    audio.transitionWarp();
    this.fx.staticBurst(420);
    this.fx.flash(P.white, 160);
    // return to whichever overworld jacked in (Miller Field or Motel Nowhere)
    const returnScene = (this.registry.get('blipReturnScene') as string) ?? SCENES.field;
    this.time.delayedCall(350, () => {
      this.scene.stop(); // full stop: fresh room next visit
      this.scene.wake(returnScene);
    });
  }

  update(_time: number, _delta: number): void {
    this.input2.update(); // pad snapshot + edges, before any early-return
    if (this.input2.pauseJustDown && !this.isPaused && !uiOverlayActive() && !this.gameOverShown) {
      this.setPaused(true);
    }
    if (this.isPaused || this.gameOverShown || this.exiting) return;
    const now = this.time.now;

    this.player.updatePlayer(this.input2);

    // shooting
    if (this.input2.shootDown && this.player.canShoot() && this.player.alive) {
      const aim = this.input2.shotVector(this.player.x, this.player.y - 1, this.player.facing);
      if (Math.abs(aim.x) > 0.25) this.player.facing = aim.x >= 0 ? 1 : -1;
      this.player.markShoot();
      const bolt = fireFrom(this.playerBolts, this.player.x + aim.x * 8, this.player.y - 1 + aim.y * 4, aim.x * PULSE.speed, aim.y * PULSE.speed, PULSE.lifeMs);
      if (bolt) bolt.setTint(activeSkin().color);
      audio.pulseShot();
    }

    // mini scan — pings the wires + node targets
    if (this.input2.scanJustDown && this.player.canScan() && this.player.alive) {
      this.player.markScan();
      audio.scanPulse();
      this.fx.scanRing(this.player.x, this.player.y, this.player.scanRadius * 0.8, SCAN.durationMs);
      this.nodes.forEach((n) => {
        if (!n.active) this.fx.floatText(n.sprite.x, n.sprite.y - 12, 'TARGET', P.signal);
      });
    }

    // exit interact
    if (
      this.gateOpen &&
      this.input2.interactJustDown &&
      Math.abs(this.player.x - this.gatePos.x) < 20 &&
      Math.abs(this.player.y - this.gatePos.y) < 30
    ) {
      this.exitToField(true);
    }

    // oscillating platforms
    for (const osc of this.oscPlatforms) {
      const img = osc.img as unknown as Phaser.GameObjects.Image;
      img.y = osc.baseY + Math.sin(now * 0.0018 + osc.phase) * 18;
      (osc.img.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    }

    // side-room mechanics
    this.updatePhasePlatforms(now);
    this.updateEcho(now);
    if (this.breakers.length && this.breakers.some((b) => !b.latched)) {
      const hold = this.def.meta.blip?.breakerHoldMs ?? BLIP_ROOM.breakerHoldMs;
      for (const br of this.breakers) {
        if (br.latched && now - br.latchedAt > hold) this.unlatchBreaker(br);
      }
    }
    for (const bp of this.bandPlats) {
      const live = bp.band === this.liveBand;
      const img = bp.img as unknown as Phaser.GameObjects.Image;
      img.y = bp.baseY + Math.sin(now * 0.0022 + bp.baseY * 0.05 + bp.band) * (live ? 5 : 2);
      (bp.img.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      (bp.img.body as Phaser.Physics.Arcade.StaticBody).enable = live;
    }

    // hazards (static red bars)
    if (this.player.alive && !this.player.invulnerable) {
      for (const h of this.hazards) {
        if (Math.abs(this.player.x - h.x) < 12 && Math.abs(this.player.y - h.y) < 10) {
          audio.hazardZap();
          this.hurtPlayer(1, h.x);
          break;
        }
      }
    }

    // sweeping scan line
    const sl = this.def.meta.scanLine;
    if (sl) {
      const t = (Math.sin((now / sl.periodMs) * Math.PI * 2) + 1) / 2;
      const x = sl.x0 + (sl.x1 - sl.x0) * t;
      this.scanLine.setPosition(x, this.def.meta.heightPx / 2);
      this.scanLineGlow.setPosition(x, this.def.meta.heightPx / 2);
      if (this.player.alive && !this.player.invulnerable && Math.abs(this.player.x - x) < 5) {
        audio.hazardZap();
        this.fx.sparks(this.player.x, this.player.y, P.danger, 6);
        this.hurtPlayer(1, x - 8);
      }
    }

    // waveform baseline animation
    this.waveform.clear();
    this.waveform.lineStyle(1, P.signalDim, 0.5);
    this.waveform.beginPath();
    const baseY = this.def.meta.heightPx - 14;
    for (let x = 0; x < this.def.meta.widthPx; x += 4) {
      const y = baseY + Math.sin(x * 0.04 + now * 0.004) * 4 + Math.sin(x * 0.013 - now * 0.002) * 3;
      if (x === 0) this.waveform.moveTo(x, y);
      else this.waveform.lineTo(x, y);
    }
    this.waveform.strokePath();

    // fell out of the waveform — reset to entry
    if (this.player.y > this.def.meta.heightPx + 40 && this.player.alive) {
      this.hurtPlayer(1, this.player.x + 1);
      if (this.player.alive) {
        this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
    }

    if (now >= this.debugEmitAt) {
      this.debugEmitAt = now + 200;
      bus.emit(EVT.debugState, {
        fps: Math.round(this.game.loop.actualFps),
        scene: 'BlipstreamScene',
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        quest: quests.stepId,
        playerBolts: this.playerBolts.countActive(true),
        energy: Math.round(this.player.energy),
        hp: this.player.hp,
        nodes: `${this.nodes.filter((n) => n.active).length}/${this.nodes.length}`,
      });
    }
  }

  private debugEmitAt = 0;

  hurtPlayer(amount: number, fromX: number): void {
    if (!this.player.alive) return;
    const applied = this.player.damage(amount, fromX);
    if (applied && this.player.hp <= 0) {
      this.gameOverShown = true;
      this.fx.staticBurst(500);
      this.player.setVisible(false);
      this.physics.pause();
      this.time.delayedCall(700, () => {
        this.scene.launch(SCENES.gameOver, { from: SCENES.blipstream });
        this.scene.pause();
      });
    }
  }

  private togglePause(): void {
    if (uiOverlayActive()) return; // a shell modal owns ESC right now
    this.setPaused(!this.isPaused);
  }

  setPaused(v: boolean): void {
    if (this.gameOverShown) return;
    this.isPaused = v;
    if (v) {
      this.physics.pause();
      bus.emit(EVT.gamePaused, {});
    } else {
      this.physics.resume();
      bus.emit(EVT.gameResumed, {});
    }
  }

  private onShutdown(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
    unregisterScene('blipstream');
  }
}
