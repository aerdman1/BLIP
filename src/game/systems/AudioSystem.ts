/**
 * WebAudio procedural SFX — zero audio assets.
 * All sounds are synthesized oscillators/noise with short envelopes.
 * The context unlocks on first user gesture (see main.ts).
 */
import { EVT } from '../config';
import { bus } from './EventBus';
import { settings } from './Settings';

/* ------------------------- procedural music tracks ------------------------- */
// A tiny step-sequencer. DARK ANALOG SYNTHWAVE direction — filtered-sawtooth
// sub-bass, hypnotic sequenced arpeggios and cold pads (Carpenter / Stranger
// Things stealth-tension vibe), still built entirely from oscillators.
interface MusicVoice { type: OscillatorType; gain: number; noteDur: number; filter?: number; attack?: number; detune?: number; sustain?: number; decay?: number; release?: number; notes: number[] }
interface DrumPattern { kick?: number[]; snare?: number[]; hat?: number[] } // per-step velocity; hat 2 = open
interface MusicTrack { step: number; steps: number; voices: MusicVoice[]; drums?: DrumPattern }
const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12); // MIDI → Hz

interface ChordCell { bass: number; arp: number[]; lead: number[] }
/** in-game tracks: soft filtered/detuned bed (warm, not bleepy chiptune) */
function buildTrack(
  step: number,
  spc: number, // steps per chord
  prog: ChordCell[],
  o: { bassGain?: number; arpGain?: number; leadGain?: number; leadType?: OscillatorType; bassType?: OscillatorType; arpType?: OscillatorType; arpFilter?: number; bassFilter?: number }
): MusicTrack {
  const steps = prog.length * spc;
  const bass = Array<number>(steps).fill(0);
  const arp = Array<number>(steps).fill(0);
  const lead = Array<number>(steps).fill(0);
  prog.forEach((c, ci) => {
    const base = ci * spc;
    const half = Math.floor(spc / 2);
    bass[base] = c.bass;
    bass[base + half] = c.bass;
    for (let s = 0; s < spc; s += 2) arp[base + s] = c.arp[(s / 2) % c.arp.length];
    if (c.lead[0]) lead[base] = c.lead[0];
    if (c.lead[1]) lead[base + half] = c.lead[1];
  });
  return {
    step,
    steps,
    voices: [
      // analog sub-bass: filtered sawtooth = warm Carpenter/synthwave low end
      { type: o.bassType ?? 'sawtooth', gain: o.bassGain ?? 0.28, noteDur: step * 3, attack: 0.02, filter: o.bassFilter ?? 360, notes: bass },
      // hypnotic sequenced arp — the driving synthwave pulse
      { type: o.arpType ?? 'sawtooth', gain: o.arpGain ?? 0.08, noteDur: step * 1.6, filter: o.arpFilter ?? 1500, detune: 8, attack: 0.008, notes: arp },
      // sparse, haunting lead
      { type: o.leadType ?? 'triangle', gain: o.leadGain ?? 0.12, noteDur: step * 3.2, filter: 1800, detune: 6, attack: 0.05, notes: lead },
    ],
  };
}

const TRACKS: Record<'menu' | 'field' | 'motel' | 'signal' | 'stadium' | 'underwater' | 'orchard', MusicTrack> = {
  // TITLE — dark analog synthwave. Filtered-saw sub, a hypnotic rising Am arpeggio
  // (Carpenter/Stranger-Things homage, original line), cold saw pads, a lonely lead.
  // Am – F – Dm – E (dark, cinematic).
  menu: {
    step: 0.3,
    steps: 16,
    voices: [
      // deep sustained sub-bass — slow hypnotic Am → F vamp (held, not plucked)
      { type: 'sawtooth', gain: 0.22, noteDur: 2.4, attack: 0.08, decay: 0.3, sustain: 0.9, release: 1.2, filter: 260, notes: [33, 0, 0, 0, 0, 0, 0, 0, 29, 0, 0, 0, 0, 0, 0, 0] },
      // low saw pad (fifths) — long swell
      { type: 'sawtooth', gain: 0.05, noteDur: 2.4, attack: 0.7, decay: 0.4, sustain: 0.85, release: 1.4, detune: 9, filter: 700, notes: [64, 0, 0, 0, 0, 0, 0, 0, 60, 0, 0, 0, 0, 0, 0, 0] },
      // upper saw pad (thirds) for analog width
      { type: 'sawtooth', gain: 0.045, noteDur: 2.4, attack: 0.9, decay: 0.4, sustain: 0.8, release: 1.6, detune: 9, filter: 900, notes: [72, 0, 0, 0, 0, 0, 0, 0, 69, 0, 0, 0, 0, 0, 0, 0] },
      // the hypnotic rise/fall arpeggio — legato notes that ring through delay + reverb
      { type: 'sawtooth', gain: 0.06, noteDur: 0.5, attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.55, detune: 7, filter: 1500, notes: [69, 72, 76, 81, 76, 72, 69, 72, 65, 69, 72, 77, 72, 69, 65, 69] },
      // one lonely high note per phrase, drenched in reverb
      { type: 'triangle', gain: 0.05, noteDur: 2.2, attack: 0.5, decay: 0.5, sustain: 0.7, release: 1.9, detune: 5, filter: 1600, notes: [88, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
  // Miller Field — stealth tension: driving filtered-saw pulse, lots of space,
  // a lonely sine lead. Am – G – F – E (dark descending).
  field: buildTrack(0.22, 8, [
    { bass: 45, arp: [57, 64, 0, 60], lead: [76, 0] },
    { bass: 43, arp: [55, 62, 0, 59], lead: [74, 0] },
    { bass: 41, arp: [53, 60, 0, 57], lead: [72, 0] },
    { bass: 40, arp: [52, 59, 0, 56], lead: [71, 0] },
  ], { bassGain: 0.22, arpGain: 0.06, leadGain: 0.07, leadType: 'sine', bassType: 'sawtooth', arpType: 'sawtooth', arpFilter: 1300, bassFilter: 340 }),
  // Motel Nowhere — neon-noir synthwave that EVOLVES so it never feels loopy:
  // a 16-chord, 4-section arrangement (main → variation → breakdown → build,
  // ~18s) with a live beat that drops out for the breakdown and fills on the build.
  motel: {
    ...buildTrack(0.14, 8, [
      // — A: main groove (Am–F–G–E) —
      { bass: 45, arp: [57, 64, 69, 64], lead: [81, 0] },
      { bass: 41, arp: [53, 60, 65, 60], lead: [77, 0] },
      { bass: 43, arp: [55, 62, 67, 62], lead: [79, 0] },
      { bass: 40, arp: [56, 59, 64, 59], lead: [80, 0] },
      // — A′: variation — arp lifts, lead answers on the off-beat —
      { bass: 45, arp: [64, 69, 72, 69], lead: [0, 76] },
      { bass: 41, arp: [60, 65, 69, 65], lead: [0, 72] },
      { bass: 43, arp: [62, 67, 71, 67], lead: [0, 74] },
      { bass: 40, arp: [59, 64, 68, 64], lead: [76, 71] },
      // — B: breakdown (Dm–Am–E–Am) — sparser, drums pull back —
      { bass: 38, arp: [57, 62, 65, 0], lead: [74, 0] },
      { bass: 45, arp: [60, 64, 69, 0], lead: [72, 0] },
      { bass: 40, arp: [56, 59, 64, 0], lead: [71, 0] },
      { bass: 45, arp: [57, 60, 64, 0], lead: [69, 0] },
      // — C: build/climax (F–G–Am–E) — higher lead, fill back into the loop —
      { bass: 41, arp: [65, 69, 72, 77], lead: [84, 0] },
      { bass: 43, arp: [67, 71, 74, 79], lead: [86, 0] },
      { bass: 45, arp: [69, 72, 76, 81], lead: [88, 0] },
      { bass: 40, arp: [68, 71, 76, 80], lead: [83, 80] },
    ], { bassGain: 0.26, arpGain: 0.09, leadGain: 0.09, leadType: 'sawtooth', bassType: 'sawtooth', arpType: 'sawtooth', arpFilter: 1800, bassFilter: 420 }),
    // 128-step beat matched to the 4 sections (each row = one 32-step section):
    drums: {
      kick: [
        1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, // A
        1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, // A′
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, // B (drop)
        1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, // C
      ],
      snare: [
        0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, // A
        0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, // A′
        0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, // B
        0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, // C (fill)
      ],
      hat: [
        1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 2, // A
        1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 2, // A′
        1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, // B
        1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 2, // C
      ],
    },
  },
  // Signal node pressure — cold digital menace: deep saw sub, tight arpeggio, no lead.
  signal: buildTrack(0.13, 8, [
    { bass: 33, arp: [60, 67, 72, 67], lead: [0, 0] },
    { bass: 31, arp: [58, 65, 70, 65], lead: [0, 0] },
    { bass: 33, arp: [60, 67, 72, 67], lead: [0, 0] },
    { bass: 35, arp: [62, 69, 74, 69], lead: [0, 0] },
  ], { bassGain: 0.2, arpGain: 0.11, leadGain: 0, leadType: 'sine', bassType: 'sawtooth', arpType: 'sawtooth', arpFilter: 1500, bassFilter: 320 }),
  // Chagrin Falls High — Friday-night tension: an anthemic minor pulse under the
  // never-ending game. Am – F – G – E (dark but stirring, "the crowd that isn't there").
  stadium: buildTrack(0.2, 8, [
    { bass: 45, arp: [57, 64, 69, 64], lead: [76, 0] },
    { bass: 41, arp: [53, 60, 65, 60], lead: [72, 0] },
    { bass: 43, arp: [55, 62, 67, 62], lead: [74, 0] },
    { bass: 40, arp: [52, 59, 64, 59], lead: [71, 0] },
  ], { bassGain: 0.24, arpGain: 0.07, leadGain: 0.08, leadType: 'triangle', bassType: 'sawtooth', arpType: 'sawtooth', arpFilter: 1600, bassFilter: 380 }),
  // Underwater reflection — slow, dreamlike, floaty. Dm7-ish drifting pads, a
  // soft sine lead like light through water.
  underwater: buildTrack(0.3, 8, [
    { bass: 36, arp: [60, 67, 72, 67], lead: [79, 0] },
    { bass: 34, arp: [58, 65, 70, 65], lead: [77, 0] },
    { bass: 38, arp: [62, 69, 74, 69], lead: [81, 0] },
    { bass: 33, arp: [57, 64, 69, 64], lead: [76, 0] },
  ], { bassGain: 0.2, arpGain: 0.06, leadGain: 0.09, leadType: 'sine', bassType: 'sine', arpType: 'triangle', arpFilter: 1100, bassFilter: 300 }),
  // Patterson's Orchard — warm harvest-dusk pastoral with an eerie undertow (the
  // maze that thinks). Am – F – C – G, rolling and warm but a little uncanny.
  orchard: buildTrack(0.24, 8, [
    { bass: 45, arp: [57, 64, 69, 72], lead: [76, 0] },
    { bass: 41, arp: [53, 60, 65, 69], lead: [72, 0] },
    { bass: 48, arp: [60, 64, 67, 72], lead: [79, 0] },
    { bass: 43, arp: [55, 62, 67, 71], lead: [74, 0] },
  ], { bassGain: 0.22, arpGain: 0.07, leadGain: 0.08, leadType: 'triangle', bassType: 'sawtooth', arpType: 'triangle', arpFilter: 1200, bassFilter: 340 }),
};

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null; // SFX bus (under master)
  private musicGain: GainNode | null = null; // music bus (under master, quieter)
  private musicInput: GainNode | null = null; // voices feed here → reverb/delay → musicGain
  private noiseBuf: AudioBuffer | null = null;

  constructor() {
    // volume/mute live in the shared settings store — track changes live
    bus.on(EVT.settingsChanged, () => this.applyGain());
  }

  private applyGain(): void {
    if (this.master) this.master.gain.value = settings.get('muted') ? 0 : settings.get('volume');
    if (this.musicGain) this.musicGain.gain.value = settings.get('music') ? settings.get('musicVolume') * 0.5 : 0;
  }

  /** Synthesize a reverb impulse response: decaying stereo noise. */
  private makeReverbIR(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx!.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = this.ctx!.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  /** Create/resume the context — call from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.applyGain();
      // Music FX bus: voices → (dry + convolver reverb + feedback tape-delay) → musicGain.
      // The wet space is what turns bare oscillators into a lush analog-synth score.
      this.musicInput = this.ctx.createGain();
      const dry = this.ctx.createGain();
      dry.gain.value = 0.82;
      this.musicInput.connect(dry).connect(this.musicGain);
      const conv = this.ctx.createConvolver();
      conv.buffer = this.makeReverbIR(2.9, 3.2);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.5;
      this.musicInput.connect(conv);
      conv.connect(wet).connect(this.musicGain);
      const delay = this.ctx.createDelay(1.0);
      delay.delayTime.value = 0.36; // ~dotted-eighth echo
      const fb = this.ctx.createGain();
      fb.gain.value = 0.32; // <1 so it decays out
      const delayWet = this.ctx.createGain();
      delayWet.gain.value = 0.2;
      this.musicInput.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(delayWet).connect(this.musicGain);
      // shared noise buffer
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    // (re)start any track requested before the context existed
    if (this.pendingTrack && !this.musicTimer) this.startScheduler();
  }

  get muted(): boolean {
    return settings.get('muted');
  }

  get volume(): number {
    return settings.get('volume');
  }

  setVolume(v: number): void {
    settings.set('volume', Math.max(0, Math.min(1, v)));
    if (v > 0 && settings.get('muted')) settings.set('muted', false);
    this.applyGain();
  }

  toggleMute(): boolean {
    settings.set('muted', !settings.get('muted'));
    this.applyGain();
    bus.emit(EVT.audioMute, settings.get('muted'));
    return settings.get('muted');
  }

  /* ------------------------------ synth helpers ----------------------------- */

  private tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.5, sweepTo?: number, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.sfxGain ?? this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol = 0.4, filterFreq = 1200, delay = 0): void {
    if (!this.ctx || !this.master || !this.noiseBuf || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, filterFreq * 0.15), t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.sfxGain ?? this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* -------------------------------- music engine ---------------------------- */

  private pendingTrack: MusicTrack | null = null;
  private currentTrackId = '';
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicNextTime = 0;

  /** Start (or crossfade to) a named background track. Safe before unlock. */
  playMusic(id: keyof typeof TRACKS): void {
    if (this.currentTrackId === id) return;
    this.currentTrackId = id;
    this.pendingTrack = TRACKS[id] ?? null;
    this.musicStep = 0;
    if (this.ctx) {
      this.musicNextTime = this.ctx.currentTime + 0.06;
      this.startScheduler();
    }
  }

  stopMusic(): void {
    this.currentTrackId = '';
    this.pendingTrack = null;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private startScheduler(): void {
    if (this.musicTimer !== null || !this.ctx) return;
    this.musicNextTime = this.ctx.currentTime + 0.06;
    this.musicTimer = window.setInterval(() => this.schedulerTick(), 25);
  }

  private schedulerTick(): void {
    const track = this.pendingTrack;
    if (!this.ctx || !track) return;
    while (this.musicNextTime < this.ctx.currentTime + 0.12) {
      const step = this.musicStep % track.steps;
      for (const v of track.voices) {
        const note = v.notes[step];
        if (note) this.musicTone(mtof(note), this.musicNextTime, v.noteDur, v.type, v.gain, v.filter, v.attack ?? 0.02, v.detune ?? 0, v.sustain, v.decay, v.release);
      }
      const d = track.drums;
      if (d) {
        const t = this.musicNextTime;
        const kv = d.kick?.[step];
        if (kv) this.drumKick(t, 0.42 * kv);
        const sv = d.snare?.[step];
        if (sv) this.drumSnare(t, 0.3 * sv);
        const hv = d.hat?.[step];
        if (hv) this.drumHat(t, 0.12, hv > 1);
      }
      // beat hook: a beat-synced EVT.musicBeat for ambience (Motel neon flicker, lamp sweep)
      const beatBar = Math.floor(this.musicStep / track.steps);
      const beatWhen = this.musicNextTime;
      window.setTimeout(
        () => bus.emit(EVT.musicBeat, { bar: beatBar, step }),
        Math.max(0, (beatWhen - this.ctx.currentTime) * 1000)
      );
      this.musicNextTime += track.step;
      this.musicStep++;
    }
  }

  /* -------------------------------- drum machine ---------------------------- */
  // Scheduled percussion for tracks with a `drums` pattern. Routed dry to the
  // music bus (punchy) so the beat cuts through the reverbed synths.

  private drumKick(t0: number, vol: number): void {
    if (!this.ctx || !this.musicGain || this.muted) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t0);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.11);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
    osc.connect(g).connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  }

  private drumSnare(t0: number, vol: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuf || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    src.connect(hp).connect(g).connect(this.musicGain);
    src.start(t0);
    src.stop(t0 + 0.18);
    const osc = this.ctx.createOscillator(); // a little tonal snap
    const g2 = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, t0);
    g2.gain.setValueAtTime(vol * 0.5, t0);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    osc.connect(g2).connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + 0.11);
  }

  private drumHat(t0: number, vol: number, open: boolean): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuf || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    const dur = open ? 0.13 : 0.04;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(hp).connect(g).connect(this.musicGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  private musicTone(freq: number, t0: number, dur: number, type: OscillatorType, vol: number, filterFreq?: number, attack = 0.02, detune = 0, sustain = 0.7, decay = 0.12, release?: number): void {
    const out = this.musicInput ?? this.musicGain;
    if (!this.ctx || !out) return;
    const rel = release ?? Math.max(0.2, dur * 0.6);
    const sus = Math.max(0.0002, vol * sustain);
    const gain = this.ctx.createGain();
    // ADSR with a real SUSTAIN plateau + a long RELEASE tail that rings into the
    // reverb instead of clicking off — this is what kills the "beepy" feel.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);          // A
    gain.gain.exponentialRampToValueAtTime(sus, t0 + attack + decay);  // D → S
    gain.gain.setValueAtTime(sus, t0 + Math.max(attack + decay, dur)); // hold S
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + rel);    // R
    // main oscillator (+ symmetric detuned partners for a wide analog/supersaw feel)
    const mk = (cents: number): void => {
      const osc = this.ctx!.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (cents) osc.detune.setValueAtTime(cents, t0);
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t0 + dur + rel + 0.08);
    };
    mk(0);
    if (detune) { mk(detune); mk(-detune); }
    let tail: AudioNode = gain;
    if (filterFreq) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 1.2; // gentle analog resonance
      f.frequency.setValueAtTime(filterFreq, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(180, filterFreq * 0.55), t0 + dur + rel); // slow filter "close"
      gain.connect(f);
      tail = f;
    }
    tail.connect(out);
  }

  /* -------------------------------- the sounds ------------------------------ */
  // Volumes are deliberately restrained because combat sounds fire constantly and sit
  // above the quieter music bus. Master volume in Settings scales everything.

  pulseShot(): void { this.tone(950, 0.06, 'square', 0.13, 320); }
  scanPulse(): void { this.tone(320, 0.42, 'sine', 0.22, 1250); this.tone(320, 0.42, 'sine', 0.09, 1250, 0.05); }
  dash(): void { this.noise(0.14, 0.15, 2600); this.tone(600, 0.12, 'sawtooth', 0.08, 180); }
  playerHit(): void { this.tone(210, 0.22, 'sawtooth', 0.26, 70); this.noise(0.18, 0.18, 900); }
  enemyHit(): void { this.tone(500, 0.05, 'square', 0.15, 350); }
  explode(): void { this.noise(0.42, 0.3, 1400); this.tone(120, 0.35, 'sawtooth', 0.15, 40); }
  badgePickup(): void { this.tone(660, 0.12, 'sine', 0.24); this.tone(990, 0.2, 'sine', 0.24, undefined, 0.1); }
  fragmentPickup(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.22, undefined, i * 0.09));
    this.tone(2093, 0.5, 'sine', 0.08, undefined, 0.4);
  }
  doorUnlock(): void { [262, 330, 392].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.2, undefined, i * 0.11)); }
  nodeActivate(): void { this.tone(880, 0.1, 'sine', 0.19); this.tone(1320, 0.16, 'sine', 0.15, undefined, 0.08); }
  bossWarning(): void { [0, 0.28, 0.56].forEach((d) => this.tone(88, 0.24, 'sawtooth', 0.24, 66, d)); }
  bossStagger(): void { this.tone(1400, 0.3, 'square', 0.13, 200); }
  uiToggle(): void { this.tone(740, 0.05, 'square', 0.1, 500); }
  rewardScan(): void {
    this.noise(0.38, 0.08, 5200);
    this.tone(180, 0.45, 'sawtooth', 0.08, 760);
    this.tone(360, 0.28, 'triangle', 0.08, 1320, 0.16);
  }
  rewardReveal(rank = 1): void {
    const lift = Math.max(0, rank - 1) * 0.02;
    const chord = rank >= 6 ? [392, 587, 784, 1175, 1568] : rank >= 4 ? [330, 494, 659, 988] : [262, 392, 523];
    chord.forEach((f, i) => this.tone(f, 0.22 + lift, 'sine', 0.14, undefined, i * 0.045));
    this.tone(rank >= 6 ? 96 : 128, 0.34, 'sawtooth', 0.13, rank >= 6 ? 64 : 92);
    this.noise(0.22 + rank * 0.025, 0.08 + rank * 0.015, rank >= 5 ? 6800 : 4200);
  }
  rewardCollect(): void {
    this.tone(784, 0.08, 'triangle', 0.12);
    this.tone(1175, 0.12, 'triangle', 0.1, undefined, 0.07);
  }
  transitionRoute(): void { this.tone(200, 0.5, 'sawtooth', 0.16, 1600); this.noise(0.5, 0.15, 3200); }
  hazardZap(): void { this.tone(1800, 0.09, 'square', 0.13, 300); this.noise(0.1, 0.13, 4000); }
  questAdvance(): void { this.tone(587, 0.09, 'sine', 0.17); this.tone(880, 0.14, 'sine', 0.17, undefined, 0.07); }
}

export const audio = new AudioSystem();
