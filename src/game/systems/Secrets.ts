/**
 * Scan-secrets resolver (Animal Well spirit) — shared by every overworld scene.
 * Scanning near a hidden secret spot claims it: a shard cache pays Signal Shards,
 * a field-note spot recovers a Scout Field Note (shown in the transmission modal
 * and the Command Center ▸ FIELD NOTES gallery). One-time per save.
 */
import Phaser from 'phaser';
import { EVT, PALETTE as P, TEX } from '../config';
import { ZONE_SECRETS, fieldNoteById } from '../data/fieldNotes';
import { addShards, getSave, updateSave } from './SaveSystem';
import { bus } from './EventBus';
import type { EffectsSystem } from './EffectsSystem';

/** Faint "scan me" cues at each still-unclaimed secret in a zone. */
export function placeSecretCues(scene: Phaser.Scene, zone: string): Record<string, Phaser.GameObjects.Image> {
  const cues: Record<string, Phaser.GameObjects.Image> = {};
  const claimed = new Set(getSave().foundSecrets);
  for (const sec of ZONE_SECRETS[zone] ?? []) {
    if (claimed.has(sec.id)) continue;
    const isNote = sec.reward.kind === 'note';
    const img = scene.add
      .image(sec.x, sec.y, isNote ? TEX.fieldNote : TEX.buriedNode)
      .setDepth(9)
      .setAlpha(0.45);
    if (isNote) img.setTint(P.signal);
    scene.tweens.add({ targets: img, alpha: { from: 0.3, to: 0.6 }, duration: 1400, yoyo: true, repeat: -1 });
    cues[sec.id] = img;
  }
  return cues;
}

/** A secret was just claimed — pop + fade its cue so it clearly reads as "collected/done". */
export function retireSecretCue(scene: Phaser.Scene, cues: Record<string, Phaser.GameObjects.Image>, id: string): void {
  const img = cues[id];
  if (!img) return;
  delete cues[id];
  scene.tweens.killTweensOf(img);
  scene.tweens.add({
    targets: img,
    alpha: 0,
    scale: 1.6,
    y: img.y - 10,
    duration: 320,
    ease: 'Cubic.easeOut',
    onComplete: () => img.destroy(),
  });
}

/** Claim any unclaimed secret within `radius` of (px,py). Returns claimed ids. */
export function resolveScanSecrets(
  zone: string,
  px: number,
  py: number,
  radius: number,
  fx: EffectsSystem
): string[] {
  const claimed = new Set(getSave().foundSecrets);
  const gained: string[] = [];
  for (const sec of ZONE_SECRETS[zone] ?? []) {
    if (claimed.has(sec.id)) continue;
    if (Phaser.Math.Distance.Between(px, py, sec.x, sec.y) > radius) continue;

    updateSave((s) => {
      if (!s.foundSecrets.includes(sec.id)) s.foundSecrets.push(sec.id);
    });

    if (sec.reward.kind === 'shards') {
      const amount = sec.reward.amount;
      addShards(amount);
      bus.emit(EVT.toast, { text: `SIGNAL SHARDS +${amount}`, color: 'green' });
    } else {
      const noteId = sec.reward.noteId;
      const note = fieldNoteById(noteId);
      updateSave((s) => {
        if (!s.discoveredFieldNotes.includes(noteId)) s.discoveredFieldNotes.push(noteId);
      });
      if (note) {
        bus.emit(EVT.scoutLog, {
          title: `FIELD NOTE — ${note.title}`,
          body: `${note.body}\n\n${note.hint}`,
          accent: note.scoutId,
        });
      }
    }
    fx.sparks(sec.x, sec.y, P.signal, 10);
    gained.push(sec.id);
  }
  return gained;
}
