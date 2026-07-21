/**
 * The Five Signal Scouts — the heart of BLIP's story.
 * Five best friends/cousins who found the first Signal event near Miller Field
 * years before CONTACT-47 woke up. Wholesome, brave, clever — never victims.
 */
import { PALETTE } from '../config';

export interface ScoutProfile {
  id: string;
  name: string;
  callsign: string;
  color: number;
  colorName: string;
  role: string;
  theme: string;
  personality: string;
  gameplay: string;
  zone: string;
}

export const SCOUTS: ScoutProfile[] = [
  {
    id: 'will',
    name: 'Will',
    callsign: 'WILLOW',
    color: PALETTE.scoutWill,
    colorName: 'cyan',
    role: 'The mapper / pathfinder',
    theme: 'Hidden routes, secret paths, map fragments',
    personality: 'Curious, brave, always the first to explore',
    gameplay: 'Scan pulse reveals Will’s hidden route markers',
    zone: 'Miller Field',
  },
  {
    id: 'chip',
    name: 'Chip',
    callsign: 'SPARK',
    color: PALETTE.scoutChip,
    colorName: 'yellow/orange',
    role: 'The builder / gadget kid',
    theme: 'Switches, power boxes, machines, broken devices',
    personality: 'Energetic, funny, always trying to fix or build something',
    gameplay: 'Chip’s caches unlock gadget/energy upgrades',
    zone: 'Motel Nowhere',
  },
  {
    id: 'henry',
    name: 'Henry',
    callsign: 'ANCHOR',
    color: PALETTE.scoutHenry,
    colorName: 'green',
    role: 'The steady protector',
    theme: 'Shields, safe zones, defense fields',
    personality: 'Calm, loyal, dependable',
    gameplay: 'Henry markers create temporary safe zones or restore health',
    zone: 'Chagrin Falls High',
  },
  {
    id: 'cameron',
    name: 'Cameron',
    callsign: 'ECHO',
    color: PALETTE.scoutCameron,
    colorName: 'purple',
    role: 'The puzzle thinker / pattern reader',
    theme: 'Signal nodes, route memory, hidden codes, rhythm puzzles',
    personality: 'Clever, observant, notices what others miss',
    gameplay: 'Cameron logs hint at maze routes and signal-node patterns',
    zone: "Patterson's Orchard",
  },
  {
    id: 'danny',
    name: 'Danny',
    callsign: 'ROCKET',
    color: PALETTE.scoutDanny,
    colorName: 'red',
    role: 'The daredevil / speedrunner',
    theme: 'Dash routes, challenge rooms, timed gates',
    personality: 'Fearless, fast, always wants to try the risky route',
    gameplay: 'Danny challenge markers unlock dash/speed trials',
    zone: 'Skyline Array',
  },
];

export interface ScoutLog {
  id: string;
  scoutId: string;
  title: string;
  body: string;
}

export const SCOUT_LOGS: ScoutLog[] = [
  {
    id: 'will-log-1',
    scoutId: 'will',
    title: 'SCOUT LOG FOUND: WILL / WILLOW',
    body:
      '“Found a path the grown-ups missed. If the lights start watching you, don’t run straight. The hill has another way through.”',
  },
  {
    id: 'chip-box-1',
    scoutId: 'chip',
    title: 'FIELD NOTE: UNKNOWN DEVICE',
    body:
      'A homemade signal box, still faintly humming. Someone rewired it years ago with bike parts and radio guts.\n\nA tiny orange spark is painted on the side.',
  },
  {
    id: 'henry-log-1',
    scoutId: 'henry',
    title: 'SCOUT LOG FOUND: HENRY / ANCHOR',
    body:
      '“When the lights sweep, don’t panic — get to the dugout, the end zone, anywhere green, and just breathe. They can’t read you if you hold still where it’s safe. I’ll keep those spots open for whoever comes after.”',
  },
  {
    id: 'cameron-log-1',
    scoutId: 'cameron',
    title: 'SCOUT LOG FOUND: CAMERON / ECHO',
    body:
      '“The maze isn’t random — nothing out here is. It breathes on a count. Watch the purple glow, count with it, and the walls tell you where they’ll be. Everybody else brute-forces it and gets lost. You just have to read the drawing under the drawing.”',
  },
  {
    id: 'danny-log-1',
    scoutId: 'danny',
    title: 'SCOUT LOG FOUND: DANNY / ROCKET',
    body:
      '“Up top the wind shoves you sideways if you catch it right. Everyone said the route between the towers was impossible. It isn’t — dash at the exact worst moment, when the lightning is about to hit, and trust it. Fastest way through is always the scariest one.”',
  },
];

export const scoutById = (id: string): ScoutProfile | undefined => SCOUTS.find((s) => s.id === id);
export const logById = (id: string): ScoutLog | undefined => SCOUT_LOGS.find((l) => l.id === id);
