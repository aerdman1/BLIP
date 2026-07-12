/**
 * Quest data — vertical slice quest "THE FIRST CONTACT".
 * The QuestSystem walks these steps in order; objectives feed the HUD.
 */

export interface QuestStep {
  id: string;
  objective: string;   // HUD objective line
  hint?: string;       // smaller secondary line
}

export interface QuestDef {
  id: string;
  name: string;
  zone: string;
  steps: QuestStep[];
}

export const THE_FIRST_CONTACT: QuestDef = {
  id: 'the-first-contact',
  name: 'The First Contact',
  zone: 'miller-field',
  steps: [
    {
      id: 'wake',
      objective: 'Systems online. Move with A/D — jump with SPACE.',
      hint: 'Hold SPACE in the air to hover. SHIFT to dash.',
    },
    {
      id: 'scanTutorial',
      objective: 'Something is hidden in this field. Use the SCAN PULSE [Q].',
      hint: 'Scan reveals what the Interpretation Engine cannot see.',
    },
    {
      id: 'avoidCone',
      objective: 'Old scan equipment ahead. Stay out of the red cone.',
      hint: 'If it classifies you as a THREAT, the drones will believe it.',
    },
    {
      id: 'destroyDrones',
      objective: 'Scanner drones locked on. Destroy 2 drones with the PULSE SHOT [X].',
      hint: 'Dash [SHIFT] through their bolts.',
    },
    {
      id: 'reachDoor',
      objective: 'A crop-circle door. Sealed by an old signal lock.',
      hint: 'The glyphs answer to something inside the Blipstream.',
    },
    {
      id: 'enterNode',
      objective: 'Enter Blipstream Node A [E].',
      hint: 'The node hums beside the door.',
    },
    {
      id: 'solvePuzzle',
      objective: 'Route the signal: activate all 3 node switches, then exit.',
      hint: 'Pulse shot [X] activates switches. Red static hurts.',
    },
    {
      id: 'bossFight',
      objective: 'SIGNAL SPIKE — the SCARECROW ANTENNA is awake. Scan [Q] to expose its core.',
      hint: 'The core only stays open for a few seconds.',
    },
    {
      id: 'collectFragment',
      objective: 'Collect the Signal Fragment.',
      hint: 'It is what everyone has been listening to.',
    },
    {
      id: 'complete',
      objective: 'Fragment secured — 1 / ?. The field is quiet. For now.',
      hint: 'Open the COMMAND CENTER [C] to review what you know.',
    },
  ],
};

export const THE_LONG_NIGHT: QuestDef = {
  id: 'the-long-night',
  name: 'The Long Night',
  zone: 'motel-nowhere',
  steps: [
    {
      id: 'arrive',
      objective: 'Motel Nowhere. The VACANCY sign never clears. Cross the wet lot.',
      hint: 'The neon is the level — only LIT signs are solid.',
    },
    {
      id: 'crossLot',
      objective: 'Security lights sweep the parking lot. Stay out of the cones.',
      hint: 'Linger in a beam and the Engine flags you — keep moving; a DASH slips the light.',
    },
    {
      id: 'powerDiner',
      objective: 'Shoot the POWER SWITCH to light the diner signs into solid platforms.',
      hint: 'Pulse shot [X / left-click] trips a switch. Lit = solid, dark = gone.',
    },
    {
      id: 'findFuse',
      objective: 'A whole motel wing sits dark. Find Chip’s FUSE BOX and jack in [E].',
      hint: 'Chip rewired the town’s power with bike parts and radio guts.',
    },
    {
      id: 'routeCircuit',
      objective: 'Inside the circuit: route the pulse through all the breakers, then exit.',
      hint: 'Overloaded nodes stay lit. This is SPARK’s domain.',
    },
    {
      id: 'climbWing',
      objective: 'The dead wing is lit. Climb the new staircase of light to the sign.',
      hint: 'Signs flicker — time your jumps to the neon.',
    },
    {
      id: 'bossFight',
      objective: 'THE VACANCY SIGN is awake. Scan [right-click / Q] to expose its filament.',
      hint: 'It short-circuits on its own every few seconds — that’s an opening too.',
    },
    {
      id: 'collectFragment',
      objective: 'Collect the second Signal Fragment.',
      hint: 'The room the town kept lit forever — this is why.',
    },
    {
      id: 'complete',
      objective: 'Fragment secured — 2 / ?. SPARK online. The loop is broken.',
      hint: 'Open the COMMAND CENTER [C] — Chip’s file is no longer unknown.',
    },
  ],
};

export const FRIDAY_NIGHT_LIGHTS: QuestDef = {
  id: 'friday-night-lights',
  name: 'Friday Night Lights',
  zone: 'tiger-stadium',
  steps: [
    {
      id: 'arrive',
      objective: 'Chagrin Falls High. The lights never cut. Step onto the field.',
      hint: 'The scoreboard stopped counting points — now it counts YOU.',
    },
    {
      id: 'timeLights',
      objective: 'Light towers sweep the track. Cross between the beams.',
      hint: 'Linger under a light and the scoreboard flips to KNOWN — a DASH slips it.',
    },
    {
      id: 'reachDugout',
      objective: 'Duck into Henry’s ANCHOR safe zones to declassify and heal.',
      hint: 'End zone, dugout, concession — green means the lights can’t read you.',
    },
    {
      id: 'poolDive',
      objective: 'Dive through the rec pool’s reflection [E].',
      hint: 'Water is a mirror the Signal reads you in. Go under.',
    },
    {
      id: 'routeMirror',
      objective: 'Underwater: route the three sync nodes, then rise to the surface.',
      hint: 'Your reflection echoes you. Pulse [X] the sync nodes; float over the static.',
    },
    {
      id: 'bossFight',
      objective: 'The WEATHER BALLOON lifts off the fifty. Pop its drones, then hit the valve.',
      hint: 'The valve core is only open while it deflates.',
    },
    {
      id: 'collectFragment',
      objective: 'Collect the third Signal Fragment.',
      hint: 'The game can finally end. Someone can finally go home.',
    },
    {
      id: 'complete',
      objective: 'Fragment secured — 3 / ?. ANCHOR online. The lights go quiet.',
      hint: 'Open the COMMAND CENTER [C] — Henry’s file is no longer unknown.',
    },
  ],
};

export const THE_ENDLESS_HARVEST: QuestDef = {
  id: 'the-endless-harvest',
  name: 'The Endless Harvest',
  zone: 'pattersons-orchard',
  steps: [
    {
      id: 'arrive',
      objective: "Patterson's Orchard. The harvest won't end. Head up the rows.",
      hint: 'Climb the apple-tree pillars — the fruit platforms regrow on a beat.',
    },
    {
      id: 'climb',
      objective: 'Climb toward the barn. Scan the loft for what Cameron left.',
      hint: 'A scan pulse [Q] reveals hidden platforms.',
    },
    {
      id: 'maze',
      objective: 'The corn maze re-draws itself. Read the beat, then enter the maze [E].',
      hint: 'Walls telegraph in purple before they shift. At the maze mouth, drop into the Fold.',
    },
    {
      id: 'bossFight',
      objective: 'The crop circle is drawn. Take the Tuning Fork and face THE HARVEST PATTERN.',
      hint: 'Scan [Q] to expose its core, then pulse [X] it.',
    },
    {
      id: 'collectFragment',
      objective: 'Collect the fourth Signal Fragment.',
      hint: 'The maze finally stops thinking.',
    },
    {
      id: 'complete',
      objective: 'Fragment secured — 4 / ?. ECHO online. The harvest can end.',
      hint: 'Open the COMMAND CENTER [C] — Cameron’s file is no longer unknown.',
    },
  ],
};

export const THE_SKY_LISTENS: QuestDef = {
  id: 'the-sky-listens',
  name: 'The Sky Listens',
  zone: 'skyline-array',
  steps: [
    {
      id: 'launch',
      objective: 'Above the storm line at last. Ride the updrafts UP the array.',
      hint: 'Dash to keep momentum — the storm sea below is the fail state.',
    },
    {
      id: 'frequencies',
      objective: 'Each dish answers a different Scout. Swap frequency [1–5] to pass their stretch.',
      hint: 'Identity is the key up here — become the one the sky expects.',
    },
    {
      id: 'summit',
      objective: 'The observatory. The five echoes gather — tune the sky and open the final door.',
      hint: 'Align the drifting frequencies until the sky answers.',
    },
    {
      id: 'bossFight',
      objective: 'THE LISTENING STATION opens like an eye and wears your face. Refuse the label.',
      hint: 'Swap to a DIFFERENT frequency than it copied, SCAN [Q] to jam the iris, then pulse the pupil.',
    },
    {
      id: 'collectFragment',
      objective: 'Collect the final Signal Fragment.',
      hint: 'The reply it was waiting for was already sent.',
    },
    {
      id: 'complete',
      objective: 'The broadcast ends. What does the radar read you as?',
      hint: 'Open the COMMAND CENTER [C] — every Scout is home.',
    },
  ],
};

export const QUESTS: QuestDef[] = [THE_FIRST_CONTACT, THE_LONG_NIGHT, FRIDAY_NIGHT_LIGHTS, THE_ENDLESS_HARVEST, THE_SKY_LISTENS];

export function findQuest(id: string): QuestDef {
  return QUESTS.find((q) => q.id === id) ?? THE_FIRST_CONTACT;
}
