/**
 * Zone plan — only Miller Field is playable in the vertical slice.
 * The rest are design cards surfaced in the Command Center.
 */

import { SCENES } from '../config';

export interface ZoneDef {
  id: string;
  name: string;
  status: 'PLAYABLE' | 'PLANNED';
  tagline: string;
  description: string;
  scout: string;        // which Signal Scout's trail runs through it
  scoutHook: string;
  boss: string;
  bossDescription: string;
}

/**
 * Single source of truth for zone routing: zoneId → { overworld scene key, quest id }.
 * Every warp path (ERD dev panel, Test API, Main-Menu continue, Game-Over retry) reads
 * THIS map, so adding a new playable zone only needs ONE line here. firstStep is derived
 * from the quest's first step at each call site.
 */
export const ZONE_ROUTES: Record<string, { scene: string; quest: string }> = {
  'miller-field': { scene: SCENES.field, quest: 'the-first-contact' },
  'motel-nowhere': { scene: SCENES.motel, quest: 'the-long-night' },
  'tiger-stadium': { scene: SCENES.stadium, quest: 'friday-night-lights' },
  'pattersons-orchard': { scene: SCENES.orchard, quest: 'the-endless-harvest' },
  'skyline-array': { scene: SCENES.skyline, quest: 'the-sky-listens' },
};

export const ZONES: ZoneDef[] = [
  {
    id: 'miller-field',
    name: 'Miller Field',
    status: 'PLAYABLE',
    tagline: 'A hillside that remembers being watched.',
    description:
      'A moonlit hillside hike on the wooded edge of Chagrin Falls, Ohio: a high spawn ridge, a deep scan-tutorial ravine, a swept scanner plateau, tiered drone lowlands, Will’s tall secret climb, rolling terraces, a true ravine pit, and the crop-circle door into Blipstream Node A — ending at the Scarecrow Antenna and the road east.',
    scout: 'Will / WILLOW',
    scoutHook: 'Will’s hidden route markers appear under scan pulse — he mapped a way through the hill.',
    boss: 'The Scarecrow Antenna',
    bossDescription: 'A pole-and-wire idol the Engine built to listen. Rotating scan beams, radial static, a red core it hides.',
  },
  {
    id: 'motel-nowhere',
    name: 'Motel Nowhere',
    status: 'PLAYABLE',
    tagline: 'Vacancy forever.',
    description:
      'A roadside motel and diner where the neon never agrees with the clock. Powered-sign platforming, security lights, broken machines that only Chip ever understood.',
    scout: 'Chip / SPARK',
    scoutHook: 'Chip’s caches and rewired power boxes unlock gadget/energy upgrades.',
    boss: 'The Vacancy Sign',
    bossDescription: 'A possessed motel sign that attacks with falling neon letters.',
  },
  {
    id: 'tiger-stadium',
    name: 'Chagrin Falls High',
    status: 'PLAYABLE',
    tagline: 'The lights never turn off.',
    description:
      'The Tigers’ stadium at the edge of a waterfall town — bleachers, a red-cinder track, ' +
      'Friday-night light towers, and the rec pool shimmering past the fence. The ' +
      'Interpretation Engine kept the game going forever: the lights never cut, the ' +
      'scoreboard tallies KNOWN vs UNKNOWN, and a crowd that isn’t there keeps roaring. Cross ' +
      'the field between sweeping light-cones; dive through the pool’s reflection to reach a ' +
      'Blipstream node.',
    scout: 'Henry / ANCHOR',
    scoutHook: 'Henry’s safe zones — end zone, dugout, concession stand — decay classification and heal you between light sweeps.',
    boss: 'The Weather Balloon',
    bossDescription: 'The classic cover story made real: a bobbing “weather balloon” over the fifty-yard line — an inflated decoy with drones tucked inside.',
  },
  {
    id: 'pattersons-orchard',
    name: "Patterson's Orchard",
    status: 'PLAYABLE',
    tagline: 'The harvest that won’t end.',
    description:
      'A pick-your-own apple farm and its corn maze out on the county road. The town asked ' +
      'the sky for a perfect endless harvest and the Signal answered: apples regrow mid-fall, ' +
      'the rows rearrange behind you, and a glowing crop-circle pattern spreads through the ' +
      'corn like the maze is thinking. Read the pattern, not your reflexes.',
    scout: 'Cameron / ECHO',
    scoutHook: 'Cameron’s logs read the maze like a waveform — the corn maze is his Blipstream puzzle made physical.',
    boss: 'The Harvest Pattern',
    bossDescription: 'A living crop circle at the maze’s heart that attacks as rotating harvest symbols.',
  },
  {
    id: 'skyline-array',
    name: 'Skyline Array',
    status: 'PLAYABLE',
    tagline: 'Everything up here is listening. This is where the broadcast ends.',
    description:
      'THE FINALE. A vertical storm-surf ascent of the radio-tower array — ride updrafts up the ' +
      'spires, dodge a telegraphed lightning clock, dash through ROCKET gates to the summit. All ' +
      'five Scouts’ trails converge here: it is also "The Broadcast", the sky heard from the ' +
      'inside. Beat the Listening Station and the Engine tries to finish deciding what you are — ' +
      'the only way through is to refuse the label.',
    scout: 'Danny / ROCKET',
    scoutHook: 'Danny’s challenge markers unlock dash routes and timed movement trials.',
    boss: 'The Listening Station',
    bossDescription: 'A mountain observatory that opens like an eye — the Engine’s last, worst answer, built from rumor, fear and every blurry photo pointed at the dark.',
  },
];
