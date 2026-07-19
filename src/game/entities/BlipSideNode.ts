/**
 * Optional Blipstream side node — zones 2–5.
 *
 * A jack-in portal that is pure side content: it never gates a quest step, a
 * Fold, a boss or a fragment. Solve its room and a persistent "signal bridge"
 * (a short run of glowing waveform platforms) lights up in the overworld, plus
 * a Signal Shard payout. State lives in one SaveFlags boolean per zone, so it
 * survives reloads.
 *
 * Rules: .claude/skills/blipstream-puzzle — completion MUST change the overworld.
 */
import Phaser from 'phaser';
import { BLIP_ROOM, EVT, PALETTE as P, SCENES, TEX } from '../config';
import { audio } from '../systems/AudioSystem';
import { bus } from '../systems/EventBus';
import { addShards, getSave, updateSave, type SaveFlags } from '../systems/SaveSystem';
import { BlipstreamNodePortal } from './BlipstreamNodePortal';

export interface BlipSideNodeConfig {
  /** Blipstream room id (key of BLIP_ROOMS) */
  roomId: string;
  /** save flag that remembers the solve */
  flag: keyof SaveFlags;
  /** prompt label, e.g. 'BREAKER RUN' */
  label: string;
  /** HUD zone name shown inside the room */
  zoneLabel: string;
  /** scene to wake on exit */
  returnScene: string;
  /** portal position (groundY = top surface of the tile it stands on) */
  x: number;
  groundY: number;
  /** where the reward bridge appears (left edge, platform-top y) */
  bridge: { x: number; y: number };
  /** one-line "what changed" toast */
  bridgeToast: string;
}

export class BlipSideNode {
  readonly portal: BlipstreamNodePortal;
  private bridgeTiles: Phaser.Physics.Arcade.Image[] = [];

  constructor(
    private scene: Phaser.Scene,
    private solids: Phaser.Physics.Arcade.StaticGroup,
    private cfg: BlipSideNodeConfig
  ) {
    this.portal = new BlipstreamNodePortal(scene, cfg.x, cfg.groundY, cfg.label);
    if (this.solved) {
      this.portal.setCompleted();
      this.buildBridge(false);
    }
  }

  get solved(): boolean {
    return getSave().flags[this.cfg.flag] === true;
  }

  /**
   * Near the portal + interact pressed → jack in. Returns true if we left.
   * The proximity test comes FIRST on purpose: `interactJustDown` is a
   * JustDown edge that is consumed when read, so we must not sample it on
   * frames where this node isn't the thing the player is standing at.
   */
  tryEnter(playerX: number, playerY: number, input: { interactJustDown: boolean }): boolean {
    const near = this.portal.playerNear(playerX, playerY);
    if (!near || this.solved) return false;
    if (!input.interactJustDown) return false;
    audio.transitionWarp();
    this.scene.registry.set('blipRoomId', this.cfg.roomId);
    this.scene.registry.set('blipReturnScene', this.cfg.returnScene);
    this.scene.registry.set('blipZoneLabel', this.cfg.zoneLabel);
    this.scene.registry.set('blipRoomSolved', '');
    this.scene.cameras.main.flash(180, 168, 255, 62);
    this.scene.time.delayedCall(320, () => {
      bus.emit(EVT.sceneChanged, { scene: SCENES.blipstream, zone: this.cfg.zoneLabel });
      this.scene.scene.switch(SCENES.blipstream);
    });
    return true;
  }

  /** call from the zone's onWake — applies the reward if this room was solved */
  applyIfSolved(): void {
    if (this.scene.registry.get('blipRoomSolved') !== this.cfg.roomId) return;
    this.scene.registry.set('blipRoomSolved', '');
    if (this.solved) return;
    updateSave((s) => {
      (s.flags[this.cfg.flag] as boolean) = true;
    });
    this.portal.setCompleted();
    this.buildBridge(true);
    addShards(BLIP_ROOM.clearShards);
    audio.doorUnlock();
    bus.emit(EVT.toast, { text: this.cfg.bridgeToast, color: 'green' });
    bus.emit(EVT.toast, { text: `+${BLIP_ROOM.clearShards} SIGNAL SHARDS`, color: 'cyan' });
  }

  /** the persistent world-state change: a lit run of waveform platforms */
  private buildBridge(animate: boolean): void {
    if (this.bridgeTiles.length) return;
    for (let i = 0; i < BLIP_ROOM.bridgeTiles; i++) {
      const bx = this.cfg.bridge.x + i * 20;
      const by = this.cfg.bridge.y - i * 14;
      const t = this.solids.create(bx, by, TEX.wavePlatform) as Phaser.Physics.Arcade.Image;
      t.setDepth(9).setTint(P.signalGreen);
      t.setDisplaySize(20, 6);
      (t.body as Phaser.Physics.Arcade.StaticBody).setSize(20, 6);
      (t.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      this.bridgeTiles.push(t);
      const glow = this.scene.add
        .image(bx, by, TEX.glow8)
        .setScale(2.4)
        .setTint(P.signalGreen)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.3)
        .setDepth(8);
      this.scene.tweens.add({ targets: glow, alpha: { from: 0.18, to: 0.42 }, duration: 1200, yoyo: true, repeat: -1 });
      if (animate) {
        t.setAlpha(0);
        this.scene.tweens.add({ targets: t, alpha: 1, duration: 260, delay: 160 * i });
      }
    }
  }
}
