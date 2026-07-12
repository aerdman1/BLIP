/**
 * LEVEL PLANS — the design roadmap for every BLIP zone, surfaced in the
 * Command Center for review. Zone 1 is built; Zones 2–6 are PLANS ONLY
 * (no playable build) per the current directive.
 *
 * Deep-design pass: every zone carries ONE signature system + ONE motivated
 * perspective shift + wild mechanics so no two zones repeat. Re-themes follow
 * LEVEL_RETHEMES.md; scout/skin payoffs follow SCOUT_SKINS_PLAN.md; the full
 * design writeup + feasibility notes live in LEVEL_DESIGN_DEEP.md.
 */

export interface BossPlan {
  name: string;
  phases: string[];
  weakness: string;
}

export interface LevelPlan {
  id: string;
  order: number;
  name: string;
  status: 'BUILT' | 'PLANNED';
  scope: string;
  setting: string;
  signalAnswer: string; // the one impossible thing the Signal made true
  signature: string; // the ONE standout system that makes this zone unique
  perspective: string; // the view mode(s) + the motivated shift
  standoutMoment: string; // the "holy shit" beat players remember
  coreLoop: string[];
  mechanics: string[];
  wildMechanics: string[]; // the cool/unusual stuff that makes it stand out
  subAreas: string[];
  blipstream: string;
  boss: BossPlan;
  scout: string;
  signalSet: string;
  skinPayoff: string;
  graphicsHook: string[]; // the zone's unique pixel-plus-realism visual identity
  captured?: string[]; // deferred ideas to wire WHEN this zone is built (curried-bachman capture pass)
}

/** Cross-cutting design pillars — the vision every zone serves. */
export const DESIGN_PILLARS: Array<{ title: string; body: string }> = [
  {
    title: 'One core, many lenses',
    body:
      'Every zone is still BLIP — scan, classification, the Blipstream, "the Signal answers what you point at it." ' +
      'But each zone adds exactly ONE signature system and ONE perspective shift so no two ever feel the same. ' +
      'Shifts are always motivated by the fiction (you slip inside the Signal), glitch-transitioned, and smooth.',
  },
  {
    title: 'The perspective ladder (via the Fold)',
    body:
      'BLIP is a perspective-shift HYBRID. The side-view platformer is the spine; each zone adds exactly ONE shift, ' +
      'and every shift is handed off by THE FOLD — a flash-masked view-flip (the Engine changing how it observes you). ' +
      'The game COLD-OPENS in the top-down combat Scan, then Folds into Miller Field. Ladder: Z1 top-down Scan cold-open · ' +
      'Z2 top-down "inside the circuit" run · Z3 an underwater gravity-inversion dive · Z4 a top-down crop-draw map · ' +
      'Z5 first-person sky-tuning · Z6 all of them Fold-cut together. Never a genre the player relearns from scratch.',
  },
  {
    title: 'Pixel + selective realism',
    body:
      'A consistent hybrid: crisp 2D pixel-art base, with realism reserved for LIGHT and WATER — volumetric light ' +
      'cones, bloom, wet-asphalt and pool reflections, storm haze, depth particles — via Phaser blend modes / light ' +
      'shaders. It always stays smooth (60fps target) and never breaks the pixel identity. UI stays crisp HTML.',
  },
  {
    title: 'Wear the zone you earn',
    body:
      'The mechanic a zone teaches IS that scout’s skin ability, so gathering the Signal Set and equipping the skin ' +
      'pays off in the very place you earned it. WILLOW reads routes, SPARK powers machines, ANCHOR shelters, ECHO ' +
      'bends the Blipstream, ROCKET dashes — each is best at home.',
  },
  {
    title: 'The stakes are identity',
    body:
      'The enemy is being decided. Classification escalates from a meter (Z1) to a stadium scoreboard (Z3) to the ' +
      'Engine holding your file (Z6). By the finale, "what the radar reads you as" becomes a choice with a cost — ' +
      'present as a known kid to pass a gate, but risk completing that child’s file.',
  },
];

export const LEVEL_PLANS: LevelPlan[] = [
  {
    id: 'miller-field',
    order: 1,
    name: 'Miller Field',
    status: 'BUILT',
    scope: 'Vertical slice — complete & playable',
    setting: 'A moonlit Chagrin-Falls hillside of fences, grass, a lonely radio tower and a floating chunk of land nobody acknowledges.',
    signalAnswer: 'A leak dense enough to hold — the first Signal Fragment — guarded by a listening idol the Engine planted.',
    signature: 'The scan-reveal → Blipstream mode-switch: solving an abstract signal room reshapes the physical overworld. This is the template every later zone riffs on.',
    perspective: 'BUILT: COLD-OPENS in the top-down combat Scan ("the Surface" — Area 47 from above; twin-stick, mouse-aim) then FOLDS into the side-view platformer. Plus the first Blipstream node (abstract waveform side-view). The Fold is BLIP’s signature view-flip.',
    standoutMoment: 'The sealed crop-circle door that only opens from inside the Signal — your first proof the two worlds are one.',
    coreLoop: [
      'Wake HIGH on the spawn ridge — learn move / jump / hover / dash with a view over the field.',
      'Drop into the deep dip → scan reveals a ladder of hidden platforms → climb out to the high meadow (Chip’s SPARK box + a chevron ledge above).',
      'Cross the scanner plateau — time the sweeping cone, dash through it, or take the high hop-line above the rig.',
      'Descend into the tiered drone lowlands — destroy 2 drones (one low, one high) using the shelves for angles.',
      'The odd grass patch: scan reveals Will’s markers → a tall secret climb to his badge + Folded Map relic (optional).',
      'Rolling terraces past the radio tower, over the plank bridge — then clear the ravine pit (hover!, safe shelf below).',
      'Up the node mound to the sealed crop-circle door → enter Blipstream Node A → route it → the door answers.',
      'Fight the Scarecrow Antenna in the walled bowl (two side tiers for dodging) → collect the Signal Fragment → follow the lit signpost east.',
    ],
    mechanics: ['Movement tutorial', 'Scan-reveal hidden geometry', 'Detection cones + classification meter', 'Patrol/aggro drones', 'Node pulse-routing puzzle'],
    wildMechanics: ['Scan literally rewrites what is real', 'Solving the Blipstream node changes the overworld state', 'Buried signal nodes hum under the soil, hinting the whole hill is Signal-touched'],
    subAreas: [
      'Spawn ridge (high, scenic) → the deep dip (scan tutorial + reward ledge)',
      'High meadow (Chip’s box) → scanner plateau (timed sweep, high bypass)',
      'Tiered drone lowlands → Will’s secret climb (optional, tall)',
      'Rolling terraces + plank bridge → the ravine pit (safe shelf + ledge ladder out)',
      'Node mound + crop-circle door → walled boss bowl (side tiers) → the road east',
      'Checkpoints: spawn · dip · highMeadow · drones · badge · node/door · bossArena',
    ],
    blipstream: 'Node A — three pulse-routing switches across waveform platforms, dodging red static bars + a sweeping scan line.',
    boss: {
      name: 'The Scarecrow Antenna',
      phases: ['Rotating scan beams', 'Radial static bursts', 'Summons 2 drones at 66% / 33% hp'],
      weakness: 'Core is shielded — scan to expose it for a few seconds, then jump-shot.',
    },
    scout: 'Will / WILLOW (cyan)',
    signalSet: 'Badge + WILLOW log (from the badge) + the Folded Map relic on the badge ledge → unlocks WILLOW.',
    skinPayoff: 'WILLOW’s wider scan + Recon Ping make every hidden route and cone trivial to read.',
    graphicsHook: ['Layered moonlit ravine soil (embedded rock/brick/roots, mossy lips)', 'Seamless 3-ridge parallax + a sculpted floating island', 'Pixel base + additive glow: fireflies, scan rings, buried nodes, a carved “47”'],
    captured: [
      'LEVEL-PENDING (retrofit): post-fragment ESCAPE (Pizza Tower) — touching the Fragment wakes the Engine; the road east becomes a soft-timer escape (cones sweep, drones spawn, classification climbs steadily) — no hard countdown / no checkpoint system.',
    ],
  },
  {
    id: 'motel-nowhere',
    order: 2,
    name: 'Motel Nowhere',
    status: 'BUILT',
    scope: 'Medium — power/light platforming + top-down circuit mode',
    setting: 'A roadside motel and diner where the neon never agrees with the clock. Wet asphalt, warm rooms, a humming ice machine, a VACANCY sign that never clears.',
    signalAnswer: 'The town asked never to be passed by — so the Signal kept one room lit forever and folded the night into a loop that quietly resets.',
    signature: 'THE NEON IS THE LEVEL — only LIT signs are solid. You rewire the town’s power so entire routes flick into and out of existence; platforming becomes an electrical puzzle.',
    perspective: 'BUILT: Side-view ⇄ a TOP-DOWN “inside the circuit” combat run — jack into the fuse box, the Fold flips you into the neon circuit (drones = corrupted processes), reach the breach and Fold back out to a world with the dead wing powered on.',
    standoutMoment: 'Diving into a buzzing fuse box and the whole screen snapping to a neon circuit-board you speedrun as a spark — then rising back into a motel that just grew a new staircase of light.',
    coreLoop: [
      'Cross the wet parking lot, timing security-light sweeps off the puddle reflections.',
      'Power the diner: flip Chip’s rewired boxes so lit signs become solid platforms.',
      'Jack into a fuse box → top-down spark-run to route power to a dead wing.',
      'Climb the newly-lit motel wings — the route keeps changing as signs flicker.',
      'Break the time-loop with Chip’s gadget → the big VACANCY sign wakes up → boss.',
    ],
    mechanics: ['Powered-sign platforms (lit = solid, dark = gone)', 'Switch/circuit puzzles', 'Security-light detection cones', 'Timing the neon flicker'],
    wildMechanics: ['TOP-DOWN circuit-board spark-runs to route power', 'A quiet ~90s time-loop the level resets on until you break it', 'Reading routes in wet-asphalt reflections, not just the signs themselves'],
    subAreas: ['Wet parking lot', 'The diner counter', 'Motel wings (2 floors)', 'Fuse boxes (top-down circuit entrances)'],
    blipstream: 'A circuit-routing room — direct the pulse through breakers to power the sign; overloaded nodes stay lit (SPARK’s domain).',
    boss: {
      name: 'The Vacancy Sign',
      phases: ['Drops falling neon letters', 'Sweeps a buzzing light-bar', 'Short-circuits into a stutter (opening)'],
      weakness: 'Shoot the letters that spell the safe word; the exposed filament core takes hits between flickers.',
    },
    scout: 'Chip / SPARK (orange)',
    signalSet: 'SPARK badge + log (the signal box, teased in Miller Field) + the Power Cell relic here → unlocks SPARK.',
    skinPayoff: 'SPARK’s endless hover + Surge Shot (trips switches instantly) turn the power puzzles into a playground.',
    graphicsHook: ['Neon sign glyphs + a CRT VACANCY that flickers', 'Wet-asphalt puddle REFLECTIONS of the signs (realism touch)', 'Warm diner-window bloom', 'Circuit mode: clean vector-glow traces laid over the pixel world'],
  },
  {
    id: 'tiger-stadium',
    order: 3,
    name: 'Chagrin Falls High',
    status: 'BUILT',
    scope: 'Medium — rhythm-stealth + underwater inversion dive',
    setting: 'The Tigers’ stadium at the edge of the falls — bleachers, a red-cinder track, Friday-night light towers, the rec pool shimmering past the fence.',
    signalAnswer: 'The town pointed its most wholesome ritual at the sky, and the Signal kept the game going forever — lights that never cut, a scoreboard tallying KNOWN vs UNKNOWN, a crowd that isn’t there.',
    signature: 'FRIDAY-NIGHT-LIGHTS STEALTH — sweeping light-tower cones you time like a rhythm, with the SCOREBOARD as a live threat meter and a phantom crowd whose cheers swell and expose you if you rush.',
    perspective: 'Side-view stealth + an UNDERWATER reflection dive: plunge through the rec pool and the world inverts into a floaty, gravity-flipped mirror side-scroll (the Blipstream node — water is the mirror the Signal reads you in).',
    standoutMoment: 'Diving into the pool and gravity turning upside-down as your own rippling reflection becomes the level you platform through.',
    coreLoop: [
      'Cross the field between rotating light-cones — move on the dark beats.',
      'Duck into Henry’s safe zones (end zone, dugout, concession) to declassify + heal between sweeps.',
      'Climb bleachers + goalposts; sprint the cinder-track speed lane.',
      'Dive through the rec pool’s reflection → the inverted underwater Blipstream node.',
      'Surface → the “weather balloon” lifts off the fifty-yard line → boss.',
    ],
    mechanics: ['Rotating light-cone timing', 'Henry safe zones (declassify + heal)', 'Bleacher/goalpost platforming', 'The track speed lane'],
    wildMechanics: ['The scoreboard KNOWN/UNKNOWN IS your detection meter', 'A crowd-that-isn’t-there: phantom cheers rise and reveal you if you move fast', 'UNDERWATER gravity-inversion mirror world for the node'],
    subAreas: ['The field + track', 'Bleachers & press box', 'End zone / dugout / concession (safe zones)', 'The rec pool (inverted node)'],
    blipstream: 'A reflection room — a mirrored, low-gravity underwater space where your echo copies your moves on a delay; sync you and your reflection to open the gate.',
    boss: {
      name: 'The Weather Balloon',
      phases: ['Bobbing decoy — vents drones from inside', 'Spotlight slam', 'Deflates into a thrashing tangle once the drones are cleared'],
      weakness: 'Pop the inner drones first; the exposed valve core is only hittable while it deflates.',
    },
    scout: 'Henry / ANCHOR (green)',
    signalSet: 'ANCHOR badge + log + the Signal Flare relic (planted at a safe zone) → unlocks ANCHOR.',
    skinPayoff: 'ANCHOR reads 40% slower under the lights, drops its own safe zones, and tanks the Weather Balloon.',
    graphicsHook: ['Volumetric light-tower cones + Friday-night bloom (realism)', 'Orange/black Tiger banners under a green ANCHOR glow', 'Reflective, rippling pool water', 'Underwater: cool tint, god-rays, slow drifting particles'],
    captured: [
      'LEVEL-PENDING: "Signal Sync" beat-synced Blipstream node (Rayman) — the reflection room consumes EVT.musicBeat (already emitted by the AudioSystem) so it pulses to the music.',
      'LEVEL-PENDING: Henry OVERCHARGE safe-nodes (Shovel Knight) — a safe zone you can overcharge for a risk/reward heal + declassify burst; build INTO the safe-zone system, not a standalone checkpoint.',
      'LEVEL-PENDING: one optional ANCHOR mastery route + branching upper (light-exposed, risky) / lower (safe) flow (Celeste/Sonic) — authored into the grid.',
    ],
  },
  {
    id: 'pattersons-orchard',
    order: 4,
    name: "Patterson's Orchard",
    status: 'BUILT',
    scope: 'Medium — living maze + top-down crop-draw + the full Harvest Pattern boss (BUILT)',
    setting: 'A pick-your-own apple farm and its corn maze out on the county road. Hayrides, purple/red orchard lights, a white barn with a green metal roof.',
    signalAnswer: 'The grown-ups asked the sky for one more good harvest, and one more — so the Signal gave them all at once: apples regrow mid-fall, the rows rearrange behind you, and a crop-circle spreads through the corn like the maze is thinking.',
    signature: 'THE MAZE THINKS — a living corn maze that rearranges on a readable PATTERN (not randomly); you win by reading the rhythm of the shift, not brute-forcing it.',
    perspective: 'Side-view orchard climbing ⇄ the FOLD into the top-down maze-z4 Sweep arena (fight the corn maze, charge the crop-circle node); charging it BLOOMS the crop circle, then you Fold back and the maze-heart gate opens.',
    standoutMoment: 'The camera pulling UP off the corn to reveal the path you’ve been tracing is a giant glowing crop circle — you were drawing the answer the whole time.',
    coreLoop: [
      'Climb the apple-tree pillar platforms (fruit respawns — timing).',
      'Enter the maze: read the pattern of the shifting walls from Cameron’s logs.',
      'Lift to the top-down view and crop-draw your route to lock a gate open.',
      'Reach the maze heart → the crop-circle Blipstream node.',
      'Route the glyph → the Harvest Pattern rises at the center → boss.',
    ],
    mechanics: ['Route-memory maze (walls shift on a readable pattern)', 'Respawning fruit platforms', 'Crop-circle glyph reading'],
    wildMechanics: ['TOP-DOWN crop-draw: trace glyphs by flying to unlock gates', 'The maze re-draws itself around you between reads', 'The Blipstream telegraphs the next wall shift (ECHO’s gift)'],
    subAreas: ['Apple rows', 'The corn maze (shifting)', 'The barn loft', 'The maze heart (node)'],
    blipstream: 'A pattern room — oscillating platforms telegraph their arc; memorize the sequence and cross before it repeats.',
    boss: {
      name: 'The Harvest Pattern',
      phases: ['Rotating harvest-symbol volleys', 'The maze walls close in as attacks', 'Symbol lock — repeat the pattern back to stun it'],
      weakness: 'Read the rotating glyph and shoot the matching symbol; a wrong symbol resets its stun.',
    },
    scout: 'Cameron / ECHO (purple)',
    signalSet: 'ECHO badge + log + the Tuning Fork relic (in the maze heart) → unlocks ECHO.',
    skinPayoff: 'ECHO’s bouncing shots and lit-longer node switches make the maze’s Blipstream logic sing.',
    graphicsHook: ['Apple-tree pillar silhouettes + a white barn / green metal roof backdrop', 'Glowing crop-circle glyphs burned into the corn', 'Top-down mode shifts to a hand-drawn “map” aesthetic over the pixel field', 'Purple/red hanging orchard lights + drifting chaff'],
    captured: [
      'LEVEL-PENDING: Echo Blink EARN-WIRING (PoP) — Cameron/ECHO\'s Signal Set grants echo-blink here. The mechanic is already BUILT + ERD-grantable + decoy-wired; just attach the set reward when this zone lands.',
      'LEVEL-PENDING: one optional ECHO mastery route + branching upper/lower maze flow (Celeste/Sonic).',
    ],
  },
  {
    id: 'skyline-array',
    order: 5,
    name: 'Skyline Array',
    status: 'BUILT',
    scope: 'Medium — vertical storm-surf speedrun + first-person tuning',
    setting: 'Radio towers and a mountaintop observatory above the storm line — antenna spires, catwalks, and lightning flashing in the clouds BELOW you.',
    signalAnswer: 'The array keeps listening for a reply that already came — so it hurls signals up the towers on a clock that never stops, and the storm never breaks.',
    signature: 'STORM-SURFING SPEEDRUN — dash-chain up antenna spires on rising updrafts, dodging lightning on a relentless clock; momentum is everything and the ground is a mile down.',
    perspective: 'Vertical side-view dash-platformer + a FIRST-PERSON “tune the sky” beat: at each dish the view lifts to look UP through it and you align drifting constellations / frequencies — a calm island between frantic climbs.',
    standoutMoment: 'Cresting the top tower and the game going first-person and silent — just you, staring up through a dish at a sky you tune like an old radio until it answers.',
    coreLoop: [
      'Dash-chain up the spires, riding updrafts between towers.',
      'Time each ascent against lightning strikes in the clouds below.',
      'At each dish, shift to first-person and tune three frequencies to open the way.',
      'Clear Danny’s dash-gate challenge rooms for the Cracked Goggles.',
      'Reach the observatory → it opens like an eye → boss.',
    ],
    mechanics: ['Vertical dash-chaining', 'Lightning hazard timing', 'Danny dash-gates + timed trials'],
    wildMechanics: ['Momentum STORM-SURFING on updrafts between towers', 'FIRST-PERSON constellation/frequency tuning minigame', 'The floor is a lethal storm sea — falling is the fail state'],
    subAreas: ['Antenna spires', 'Catwalk maze', 'Dish arrays (first-person trials)', 'The observatory dome (node + boss)'],
    blipstream: 'A tuning room — ride oscillating waveform platforms and match a frequency; ROCKET’s air-dash makes the impossible gaps possible.',
    boss: {
      name: 'The Listening Station',
      phases: ['The dome iris opens — a sweeping eye-beam', 'Lightning-call barrages', 'Iris jams open (the pupil is the core)'],
      weakness: 'Dash through the eye-beam gaps; the pupil-core is only hittable while the iris is jammed open.',
    },
    scout: 'Danny / ROCKET (red)',
    signalSet: 'ROCKET badge + log + the Cracked Goggles relic (past the hardest dash gate) → unlocks ROCKET.',
    skinPayoff: 'ROCKET’s air-dash, shorter cooldown and Phase-Strike are built for this vertical speed zone.',
    graphicsHook: ['Radio-tower/observatory silhouettes over a lightning-lit storm sea below', 'Speed-blur afterimages + wind streaks (realism-lite motion)', 'First-person: a soft parallax starfield + tuning-dial overlay', 'A giant iris dome that opens like an eye'],
    captured: [
      'LEVEL-PENDING: this zone IS the full-throttle version of the post-fragment escape (Pizza Tower) — the relentless rising climb-clock.',
      'LEVEL-PENDING: one optional ROCKET mastery route + branching high-risk / low-safe vertical flow (Celeste/Sonic).',
    ],
  },
];
