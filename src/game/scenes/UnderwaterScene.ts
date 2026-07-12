/**
 * THE REC POOL — Zone 3 underwater reflection node.
 * Dive through the pool and the world flips into a cool, low-gravity mirror: a
 * floaty side-scroll lit by god-rays and drifting bubbles, where your own
 * delayed REFLECTION echoes your moves. Route the three sync nodes and rise
 * through the surface gate — the field above wakes up (poolNodeSolved).
 *
 * Mirrors BlipstreamScene's node skeleton (switches → wires → exit gate,
 * fall-reset, solveAndExit test hook, return via `blipReturnScene`) so the
 * dive/surface loop is identical to jacking into a Blipstream node.
 */
import Phaser from 'phaser';
import { EVT, VIEW_H, VIEW_W, PALETTE as P, PULSE, RENDER_ZOOM, SCENES, TEX, css } from '../config';
import { POOL_MIRROR, walkLevel } from '../data/levels';
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

interface SyncNode {
  sprite: Phaser.Physics.Arcade.Image;
  glow: Phaser.GameObjects.Image;
  active: boolean;
  index: number;
}

const UNDER_GRAVITY = 300; // low, floaty
const UNDER_MAX_FALL = 150; // capped terminal fall → dreamlike drift
const ECHO_DELAY_FRAMES = 26; // your reflection lags ~0.4s behind

export class UnderwaterScene extends Phaser.Scene {
  player!: Player;
  private input2!: PlayerInput;
  private fx!: EffectsSystem;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private hazards: Phaser.GameObjects.Image[] = [];
  private oscPlatforms: Array<{ img: Phaser.Physics.Arcade.Image; baseY: number; phase: number }> = [];
  private nodes: SyncNode[] = [];
  private wires!: Phaser.GameObjects.Graphics;
  playerBolts!: Phaser.Physics.Arcade.Group;
  private gate!: Phaser.GameObjects.Image;
  private gateGlow!: Phaser.GameObjects.Image;
  private gatePos = { x: 0, y: 0 };
  private gateOpen = false;
  private scanLine!: Phaser.GameObjects.Image;
  private spawnPoint = { x: 0, y: 0 };

  // the reflection echo
  private echo!: Phaser.GameObjects.Image;
  private history: Array<{ x: number; y: number; flip: boolean }> = [];

  private godrays: Phaser.GameObjects.Image[] = [];
  private exiting = false;
  private isPaused = false;
  private gameOverShown = false;
  private unsubs: Array<() => void> = [];

  constructor() {
    super(SCENES.underwater);
  }

  create(): void {
    const def = POOL_MIRROR;
    this.fx = new EffectsSystem(this);
    attachScreenFilter(this, true); // level screen filter (dialed down for gameplay)
    this.input2 = new PlayerInput(this);
    this.hazards = [];
    this.oscPlatforms = [];
    this.nodes = [];
    this.godrays = [];
    this.history = [];
    this.exiting = false;
    this.isPaused = false;
    this.gameOverShown = false;
    this.gateOpen = false;

    // floaty underwater physics (this scene's Arcade world only)
    this.physics.world.gravity.y = UNDER_GRAVITY;

    // cool water backdrop + depth gradient
    this.cameras.main.setBackgroundColor('#061a30');
    this.add.image(0, 0, TEX.underwaterBg).setOrigin(0).setScrollFactor(0).setDepth(0).setDisplaySize(def.meta.widthPx, def.meta.heightPx).setAlpha(0.9);
    // god-rays slanting down through the water
    for (let i = 0; i < 5; i++) {
      const gx = 60 + i * (def.meta.widthPx / 5);
      const ray = this.add.image(gx, -10, TEX.godRay).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(P.godRay).setAlpha(0.12).setDepth(1).setRotation(0.12);
      this.tweens.add({ targets: ray, alpha: { from: 0.06, to: 0.2 }, x: gx + 12, duration: 3200 + i * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.godrays.push(ray);
    }
    // drifting bubbles
    for (let i = 0; i < 16; i++) {
      const bx = Math.random() * def.meta.widthPx;
      const by = Math.random() * def.meta.heightPx;
      const b = this.add.image(bx, by, TEX.bubble).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.4).setDepth(3).setScale(0.6 + Math.random() * 0.8);
      this.tweens.add({ targets: b, y: by - 60 - Math.random() * 80, alpha: { from: 0.4, to: 0 }, duration: 3000 + Math.random() * 3000, repeat: -1, delay: Math.random() * 2000, ease: 'Sine.easeOut' });
    }

    // cool cinematic vignette — deepens the water at the frame edges
    this.add.image(0, 0, TEX.vignette).setOrigin(0).setScrollFactor(0).setDepth(11).setTint(0x0a1e33).setDisplaySize(VIEW_W, VIEW_H).setAlpha(0.5);

    this.platforms = this.physics.add.staticGroup();
    this.playerBolts = makeProjectileGroup(this, TEX.boltPlayer, PULSE.maxActive);

    let nodeIndex = 0;
    walkLevel(def, (ch, _col, _row, x, y) => {
      switch (ch) {
        case '-': {
          const t = this.platforms.create(x, y, TEX.wavePlatform) as Phaser.Physics.Arcade.Image;
          t.setDepth(8).setTint(P.poolShimmer);
          (t.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 8).setOffset(0, 0);
          break;
        }
        case '~': {
          const img = this.physics.add.staticImage(x + 8, y, TEX.wavePlatform).setDepth(8).setTint(P.waterMid);
          img.setDisplaySize(32, 8);
          (img.body as Phaser.Physics.Arcade.StaticBody).setSize(32, 8);
          this.oscPlatforms.push({ img: img as unknown as Phaser.Physics.Arcade.Image, baseY: y, phase: x * 0.05 });
          break;
        }
        case '!': {
          const h = this.add.image(x, y, TEX.hazardBar).setDepth(9).setTint(P.godRay).setAlpha(0.85);
          this.hazards.push(h);
          break;
        }
        case 'o': {
          const glow = this.add.image(x, y, TEX.glow8).setScale(2.6).setTint(P.poolShimmer).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(9);
          const sprite = this.physics.add.staticImage(x, y, TEX.nodeSwitch).setDepth(10);
          (sprite.body as Phaser.Physics.Arcade.StaticBody).setSize(18, 18);
          this.nodes.push({ sprite, glow, active: false, index: nodeIndex++ });
          break;
        }
        case 'E': this.gatePos = { x, y: y + 4 }; break;
        case 'P': this.spawnPoint = { x, y }; break;
      }
    });

    this.wires = this.add.graphics().setDepth(2);
    this.drawWires();

    this.gateGlow = this.add.image(this.gatePos.x, this.gatePos.y, TEX.glow8).setScale(5).setTint(P.anchorGreen).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.12).setDepth(9);
    this.gate = this.add.image(this.gatePos.x, this.gatePos.y, TEX.exitGate).setDepth(10).setAlpha(0.45).setTint(P.uiDim);
    this.add.text(this.gatePos.x, this.gatePos.y - 32, 'SURFACE', { fontFamily: 'monospace', fontSize: '8px', color: css(P.poolShimmer) }).setOrigin(0.5).setDepth(12).setResolution(2).setAlpha(0.75);

    const sl = def.meta.scanLine;
    this.scanLine = this.add.image(sl ? sl.x0 : -50, def.meta.heightPx / 2, TEX.scanLine).setDepth(11).setTint(P.godRay);
    this.scanLine.setDisplaySize(6, def.meta.heightPx);

    // player + its trailing reflection
    this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.fx);
    this.player.setSkin(getSave().selectedSkin);
    (this.player.body as Phaser.Physics.Arcade.Body).setMaxVelocity(300, UNDER_MAX_FALL);
    const sk = activeSkin();
    bus.emit(EVT.skinSelected, { id: sk.id, name: sk.name, color: sk.color, live: false });
    // the reflection is literally you — reuse the player's own body, tinted cool
    this.echo = this.add.image(this.spawnPoint.x, this.spawnPoint.y, this.player.texture.key).setDepth(this.player.depth - 1).setTint(P.godRay).setAlpha(0.5);

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.playerBolts, this.platforms, (bolt) => {
      const b = bolt as Projectile;
      this.fx.sparks(b.x, b.y, P.poolShimmer, 3);
      b.kill();
    });
    this.nodes.forEach((node) => {
      this.physics.add.overlap(this.playerBolts, node.sprite, (_s, bolt) => {
        const b = bolt as Projectile;
        if (!b.active || node.active) return;
        b.kill();
        this.activateNode(node);
      });
    });

    this.physics.world.setBounds(0, -VIEW_H, def.meta.widthPx, def.meta.heightPx + VIEW_H);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.cameras.main.setZoom(RENDER_ZOOM);
    this.cameras.main.setBounds(0, 0, def.meta.widthPx, Math.max(def.meta.heightPx, VIEW_H * 0.63));
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.fadeIn(400, 4, 12, 24);

    const zoneLabel = (this.registry.get('blipZoneLabel') as string) ?? 'The Rec Pool';
    audio.playMusic('underwater');
    bus.emit(EVT.sceneChanged, { scene: SCENES.underwater, zone: zoneLabel });
    bus.emit(EVT.toast, { text: 'UNDER THE SURFACE — YOUR REFLECTION FOLLOWS', color: 'cyan' });
    this.player.refreshHud();

    this.input.keyboard?.on('keydown-ESC', this.togglePause, this);
    this.unsubs.push(bus.on(EVT.uiResume, () => this.setPaused(false)));
    this.unsubs.push(bus.on(EVT.skinSelected, (d) => {
      const id = (d as { id: string }).id;
      if (this.player?.active && activeSkin().id !== id) this.player.setSkin(id);
    }));
    this.unsubs.push(bus.on(EVT.debugGotoField, () => this.exitToStadium(false)));
    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    registerScene('underwater', this);
  }

  private onWake(): void {
    this.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    const zoneLabel = (this.registry.get('blipZoneLabel') as string) ?? 'The Rec Pool';
    bus.emit(EVT.sceneChanged, { scene: SCENES.underwater, zone: zoneLabel });
  }

  private drawWires(): void {
    this.wires.clear();
    const pts = [...this.nodes.map((n) => ({ x: n.sprite.x, y: n.sprite.y })), this.gatePos];
    for (let i = 0; i < pts.length - 1; i++) {
      const from = pts[i];
      const to = pts[i + 1];
      const routed = this.nodes[i]?.active ?? false;
      this.wires.lineStyle(1, routed ? P.anchorGreen : P.waterMid, routed ? 0.9 : 0.3);
      const midX = (from.x + to.x) / 2;
      this.wires.beginPath();
      this.wires.moveTo(from.x, from.y);
      this.wires.lineTo(midX, from.y);
      this.wires.lineTo(midX, to.y);
      this.wires.lineTo(to.x, to.y);
      this.wires.strokePath();
    }
  }

  private activateNode(node: SyncNode): void {
    node.active = true;
    node.sprite.setTint(P.anchorGreen);
    node.glow.setTint(P.anchorGreen).setAlpha(0.8);
    audio.nodeActivate();
    this.fx.sparks(node.sprite.x, node.sprite.y, P.anchorGreen, 10);
    this.fx.floatText(node.sprite.x, node.sprite.y - 12, `SYNC ${node.index + 1}/3`, P.anchorGreen);
    this.drawWires();
    const next = this.nodes[node.index + 1]?.sprite ?? this.gate;
    const dot = this.add.image(node.sprite.x, node.sprite.y, TEX.glow8).setTint(P.white).setBlendMode(Phaser.BlendModes.ADD).setDepth(12);
    this.tweens.add({ targets: dot, x: next.x, y: next.y, duration: 550, ease: 'Sine.easeInOut', onComplete: () => dot.destroy() });
    if (this.nodes.filter((n) => n.active).length >= this.nodes.length) this.openGate();
  }

  private openGate(): void {
    if (this.gateOpen) return;
    this.gateOpen = true;
    this.gate.setTint(P.anchorGreen).setAlpha(1);
    this.gateGlow.setAlpha(0.5);
    this.tweens.add({ targets: this.gateGlow, alpha: { from: 0.5, to: 0.85 }, duration: 700, yoyo: true, repeat: -1 });
    audio.doorUnlock();
    this.fx.flash(P.anchorGreen, 150);
    bus.emit(EVT.toast, { text: 'REFLECTION SYNCED — SURFACE OPEN [E]', color: 'green' });
  }

  /** Test API: instantly route everything and surface */
  solveAndExit(): void {
    this.nodes.forEach((n) => {
      if (!n.active) {
        n.active = true;
        n.sprite.setTint(P.anchorGreen);
        n.glow.setTint(P.anchorGreen).setAlpha(0.8);
      }
    });
    this.drawWires();
    this.openGate();
    this.exitToStadium(true);
  }

  private exitToStadium(solved: boolean): void {
    if (this.exiting) return;
    this.exiting = true;
    if (solved) this.registry.set('nodeJustSolved', true);
    audio.transitionWarp();
    this.fx.staticBurst(420);
    this.fx.flash(P.white, 160);
    const returnScene = (this.registry.get('blipReturnScene') as string) ?? SCENES.stadium;
    this.time.delayedCall(350, () => {
      this.scene.stop();
      this.scene.wake(returnScene);
    });
  }

  update(_time: number, _delta: number): void {
    this.input2.update();
    if (this.input2.pauseJustDown && !this.isPaused && !uiOverlayActive() && !this.gameOverShown) this.setPaused(true);
    if (this.isPaused || this.gameOverShown || this.exiting) return;
    const now = this.time.now;

    this.player.updatePlayer(this.input2);
    this.updateEcho();

    if (this.input2.shootDown && this.player.canShoot() && this.player.alive) {
      this.player.markShoot();
      const dir = this.player.facing;
      const bolt = fireFrom(this.playerBolts, this.player.x + dir * 8, this.player.y - 1, dir * PULSE.speed, 0, PULSE.lifeMs);
      if (bolt) bolt.setTint(activeSkin().color);
      audio.pulseShot();
    }

    if (this.input2.scanJustDown && this.player.canScan() && this.player.alive) {
      this.player.markScan();
      audio.scanPulse();
      this.fx.scanRing(this.player.x, this.player.y, this.player.scanRadius * 0.8, 520);
      this.nodes.forEach((n) => { if (!n.active) this.fx.floatText(n.sprite.x, n.sprite.y - 12, 'SYNC', P.anchorGreen); });
    }

    if (
      this.gateOpen &&
      this.input2.interactJustDown &&
      Math.abs(this.player.x - this.gatePos.x) < 20 &&
      Math.abs(this.player.y - this.gatePos.y) < 30
    ) {
      this.exitToStadium(true);
    }

    for (const osc of this.oscPlatforms) {
      const img = osc.img as unknown as Phaser.GameObjects.Image;
      img.y = osc.baseY + Math.sin(now * 0.0012 + osc.phase) * 16;
      (osc.img.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    }

    if (this.player.alive && !this.player.invulnerable) {
      for (const h of this.hazards) {
        if (Math.abs(this.player.x - h.x) < 12 && Math.abs(this.player.y - h.y) < 10) {
          audio.hazardZap();
          this.hurtPlayer(1, h.x);
          break;
        }
      }
    }

    const sl = POOL_MIRROR.meta.scanLine;
    if (sl) {
      const t = (Math.sin((now / sl.periodMs) * Math.PI * 2) + 1) / 2;
      const x = sl.x0 + (sl.x1 - sl.x0) * t;
      this.scanLine.setPosition(x, POOL_MIRROR.meta.heightPx / 2);
      if (this.player.alive && !this.player.invulnerable && Math.abs(this.player.x - x) < 5) {
        audio.hazardZap();
        this.fx.sparks(this.player.x, this.player.y, P.godRay, 6);
        this.hurtPlayer(1, x - 8);
      }
    }

    if (this.player.y > POOL_MIRROR.meta.heightPx + 40 && this.player.alive) {
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
        scene: 'UnderwaterScene',
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

  /** the reflection: a delayed ghost that trails and mirrors the player */
  private updateEcho(): void {
    this.history.push({ x: this.player.x, y: this.player.y, flip: this.player.flipX });
    if (this.history.length > ECHO_DELAY_FRAMES + 4) this.history.shift();
    const past = this.history.length > ECHO_DELAY_FRAMES ? this.history[0] : null;
    if (past) {
      this.echo.setPosition(past.x, past.y).setFlipX(!past.flip);
      this.echo.setAlpha(0.38 + Math.sin(this.time.now * 0.006) * 0.12);
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
        this.scene.launch(SCENES.gameOver, { from: SCENES.underwater });
        this.scene.pause();
      });
    }
  }

  private togglePause(): void {
    if (uiOverlayActive()) return;
    this.setPaused(!this.isPaused);
  }
  setPaused(v: boolean): void {
    if (this.gameOverShown) return;
    this.isPaused = v;
    if (v) { this.physics.pause(); bus.emit(EVT.gamePaused, {}); }
    else { this.physics.resume(); bus.emit(EVT.gameResumed, {}); }
  }

  private onShutdown(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
    unregisterScene('underwater');
  }
}
