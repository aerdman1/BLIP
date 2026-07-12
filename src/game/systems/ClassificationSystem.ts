/**
 * The Interpretation Engine's opinion of you.
 * Detection cones fill the meter: UNKNOWN → ANOMALY → THREAT.
 * At THREAT, drones trust the label and turn aggressive. Decays out of sight.
 */
import { CLASSIFY, EVT, type ClassifyTier } from '../config';
import { bus } from './EventBus';
import { skinMods } from './SkinState';

export class ClassificationSystem {
  value = 0;
  tier: ClassifyTier = 'UNKNOWN';
  private lastEmitted = -1;

  update(dtSec: number, inCone: boolean, decoyMul = 1): void {
    const before = this.value;
    // ANCHOR slower, ROCKET faster; Echo Blink decoy (decoyMul<1) redirects the read
    const fillMul = (skinMods().classifyFillMul ?? 1) * decoyMul;
    if (inCone) this.value = Math.min(CLASSIFY.max, this.value + CLASSIFY.fillPerSec * fillMul * dtSec);
    else this.value = Math.max(0, this.value - CLASSIFY.decayPerSec * dtSec);

    const newTier: ClassifyTier =
      this.value >= CLASSIFY.threatAt ? 'THREAT' : this.value >= CLASSIFY.anomalyAt ? 'ANOMALY' : 'UNKNOWN';
    const tierChanged = newTier !== this.tier;
    this.tier = newTier;

    // throttle HUD updates to whole-number changes / tier flips
    const rounded = Math.round(this.value);
    if (rounded !== this.lastEmitted || tierChanged) {
      this.lastEmitted = rounded;
      bus.emit(EVT.hudClassify, { value: rounded, tier: this.tier, inCone });
    }
    void before;
  }

  get isThreat(): boolean {
    return this.tier === 'THREAT';
  }

  reset(): void {
    this.value = 0;
    this.tier = 'UNKNOWN';
    bus.emit(EVT.hudClassify, { value: 0, tier: 'UNKNOWN', inCone: false });
  }
}
