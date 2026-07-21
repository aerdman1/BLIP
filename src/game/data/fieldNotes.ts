/**
 * Scout Field Notes (Tunic-style collectible pages) + scan-secrets (Animal Well).
 * Notebook pages the Five Scouts left behind — they teach a mechanic in a
 * brave, coded field-journal voice and reward curiosity. Hidden until a scan pulse
 * finds them; some secret spots pay Signal Shards instead of a note.
 * Content data only — placements are area coords the top-down scene scans against.
 */

export interface FieldNoteDef {
  id: string;
  scoutId: string;
  title: string;
  body: string;
  hint: string; // the mechanic the page teaches
}

export const FIELD_NOTES: FieldNoteDef[] = [
  {
    id: 'will-map-margin',
    scoutId: 'will',
    title: "Will's map margin",
    body: '“If the lights start watching, don’t run straight. The field has another way through. I drew the safe marks in cyan. Scan and they light up.”',
    hint: 'Scan reveals WILLOW route markers and hidden caches.',
  },
  {
    id: 'henry-safe-spots',
    scoutId: 'henry',
    title: "Henry's safe-spots list",
    body: '“Places the red light can’t reach: behind the big rock, under the meadow lip, the dugout. Wait there and it forgets you. Count to ten, Danny. TEN.”',
    hint: 'Classification decays whenever you stay out of the red cones.',
  },
  {
    id: 'chip-circuit-doodle',
    scoutId: 'chip',
    title: "Chip's circuit sketch",
    body: '“Only the lit signs tell the truth. Shoot the power box and the whole lot changes. I wired the diner into the warning grid. If it hums, leave fast.”',
    hint: 'Pulse-shot signal machinery to open route pressure windows.',
  },
  {
    id: 'danny-dare',
    scoutId: 'danny',
    title: "Danny's route mark",
    body: '“The red light reads slow after a dash. I crossed the lot in four cuts. The drainpipe route still works if you do not freeze.”',
    hint: 'Dash i-frames slip you clean through the security cones.',
  },
];

export type SecretReward = { kind: 'shards'; amount: number } | { kind: 'note'; noteId: string };

export interface SecretDef {
  id: string;
  x: number;
  y: number;
  reward: SecretReward;
}

/** Scannable secret spots per area. */
export const ZONE_SECRETS: Record<string, SecretDef[]> = {
  'miller-field': [
    { id: 'miller-cache-1', x: 1216, y: 380, reward: { kind: 'shards', amount: 15 } },
    { id: 'sec-will-map', x: 592, y: 210, reward: { kind: 'note', noteId: 'will-map-margin' } }, // high meadow, next to the first optional scan-reward route
    { id: 'sec-henry-safe', x: 1700, y: 250, reward: { kind: 'note', noteId: 'henry-safe-spots' } },
  ],
  'motel-nowhere': [
    { id: 'motel-cache-1', x: 328, y: 258, reward: { kind: 'shards', amount: 15 } },
    { id: 'sec-chip-doodle', x: 712, y: 185, reward: { kind: 'note', noteId: 'chip-circuit-doodle' } },
    { id: 'sec-danny-dare', x: 1000, y: 260, reward: { kind: 'note', noteId: 'danny-dare' } },
  ],
};

export const fieldNoteById = (id: string): FieldNoteDef | undefined => FIELD_NOTES.find((n) => n.id === id);
