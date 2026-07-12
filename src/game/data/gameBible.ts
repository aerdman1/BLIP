/**
 * BLIP story bible — surfaced in the Command Center.
 * Entries with `lockedUntilFragment` decrypt after the first Signal Fragment.
 */

export interface BibleEntry {
  id: string;
  title: string;
  classification: string;
  body: string;
  lockedUntilFragment?: boolean;
}

export const GAME_BIBLE: BibleEntry[] = [
  {
    id: 'contact-47',
    title: 'CONTACT-47',
    classification: 'SUBJECT // UNRESOLVED',
    body:
      'You are the forty-seventh logged contact event over Miller Field — a blip that refused to leave the radar, and then refused to stay a blip. You woke up in the grass with a body made of readings, a heartbeat made of ping intervals, and one recurring directive burned into your memory: COLLECT THE SIGNAL FRAGMENTS BEFORE THEY FINISH DECIDING WHAT YOU ARE. You are not invading anything. You are trying to stay unknown long enough to stay real.',
  },
  {
    id: 'the-signal',
    title: 'The Signal',
    classification: 'PHENOMENON // LEAKING',
    body:
      'Earth is not being invaded. Earth is leaking. Something called the Signal bleeds through the sky and makes impossible things locally true: frozen drivers, glowing fields, roads that loop, searchlights pointing at nothing, rumors that leave footprints. The leak concentrates into Signal Fragments — dense knots of almost-real. Collect them and the field goes quiet. Leave them, and the sky keeps tearing.',
  },
  {
    id: 'interpretation-engine',
    title: 'The Interpretation Engine',
    classification: 'ADVERSARY // AUTOMATED',
    body:
      'The government does not hunt you with soldiers. It hunts you with labels. The Interpretation Engine is the machine layer that watches the sky and decides what things are: WEATHER. BIRDS. SWAMP GAS. THREAT. Its scanner drones and detection cones are not eyes — they are opinions. Stand in the red light long enough and its classification of you becomes the truth everything else acts on. The enemy of this game is not a monster. It is being decided.',
  },
  {
    id: 'signal-fragments',
    title: 'Signal Fragments',
    classification: 'OBJECTIVE // COLLECT',
    body:
      'A fragment is a piece of the leak that got dense enough to hold. Each one you collect makes the local sky more ordinary and you slightly more impossible. The directive says to collect them all. The directive does not say what happens when you do.',
  },
  {
    id: 'miller-field',
    title: 'Miller Field',
    classification: 'ZONE 01 // ACTIVE',
    body:
      'A hillside of fences, grass and one lonely radio tower on the edge of Chagrin Falls, Ohio — a waterfall town where the porch lights stay warm and the falls never stop talking. Over the tree line floats a chunk of land no official record acknowledges. The first Signal event was logged here — logged second, technically. Five kids with homemade radios logged it first, on a May night in 1982.',
  },
  {
    id: 'signal-scouts',
    title: 'The Five Signal Scouts',
    classification: 'PERSONS OF INTEREST // FRIENDLY',
    body:
      'Will, Chip, Henry, Cameron and Danny — best friends and cousins who found the first leak years before you woke up. They formed a secret club, built gadgets, mapped hidden paths, and left behind badges, notes and recordings, as if they knew someone like you would come along and need them. The real mystery is not just what the Signal is. It is what five kids understood about it that the Interpretation Engine still doesn’t.',
  },
  {
    id: 'blipstream',
    title: 'The Blipstream',
    classification: 'DIMENSION // PARTIAL ACCESS',
    body:
      'The inside of the Signal: a black space of waveforms, static and routing logic. Blipstream Nodes are stitches where the leak was patched — crude, clever patches, more bike-parts than physics. Route a node correctly and the world outside changes shape. Cameron’s notebooks called it "the drawing under the drawing."',
  },
  {
    id: 'the-fold',
    title: 'The Fold',
    classification: 'PHENOMENON // OBSERVED',
    body:
      'The Interpretation Engine cannot classify you side-on — too much noise, too many angles. So it does the only thing it can: it SURFACES you. The world folds, and for a moment you are seen the way the radar sees you — from directly above, a bright contact on its scan, drones converging to force a reading. Survive the scan, reach the breach, and the view folds back down into the world. You begin the whole story this way: a blip on the scan that refuses to be labelled, breaking the fix and dropping into Miller Field. The Fold is not a place. It is the machine changing how it looks at you — and you slipping between the looks.',
  },
  {
    id: 'tiger-stadium',
    title: 'Chagrin Falls High',
    classification: 'ZONE 03 // LIT',
    body:
      'Friday-night lights on the edge of a waterfall town — the Tigers’ field, a red-cinder ' +
      'track, a rec pool going quiet past the fence. The whole town used to point its love ' +
      'here every autumn. The Signal answered the way it always does: it kept the game going. ' +
      'The lights never cut now. The scoreboard stopped counting points. Nobody remembers ' +
      'who’s winning, only that the home side is still down there, playing.',
  },
  {
    id: 'pattersons-orchard',
    title: "Patterson's Orchard",
    classification: 'ZONE 04 // GROWING',
    body:
      'Apple rows and a corn maze the county drove out to every fall — pick-your-own, ' +
      'hayrides, a harvest that was supposed to end. The grown-ups asked the sky for one ' +
      'more good season, and one more, and the Signal — which only ever answers — gave them ' +
      'all of them at once. The apples fall and are back on the branch by the time they land. ' +
      'The maze re-draws itself around anyone patient enough to watch. Cameron watched.',
  },
  {
    id: 'motel-nowhere',
    title: 'Motel Nowhere',
    classification: 'ZONE 02 // LOOPING',
    body:
      'A roadside motel and diner out where the highway forgets itself. The VACANCY sign ' +
      'never agrees with the clock; the neon is the only thing that decides what’s solid. ' +
      'Somebody asked the sky, once, to keep the lights on all night — and the Signal, which ' +
      'only ever answers, kept them on forever, humming, flickering, rewiring the dark. Chip ' +
      'figured out you could climb the wiring itself. He left the fuse box open for you.',
  },
  {
    id: 'skyline-array',
    title: 'Skyline Array',
    classification: 'ZONE 05 // LISTENING',
    body:
      'Radio towers and a mountaintop observatory above the storm line, where the dishes still ' +
      'point up and wait. The lightning never lands the same way twice, and the wind pushes ' +
      'the brave straight up. The grown-ups built this place to hear the sky better; the Signal ' +
      'answered by making the sky worth hearing. Danny climbed it because everyone said the ' +
      'jump between the spires was impossible. It wasn’t. He tuned the last dish himself.',
  },
  {
    id: 'the-broadcast',
    title: 'The Broadcast',
    classification: 'THE FINALE // SKYLINE ARRAY',
    body:
      'The broadcast is not a separate place — it is what the Skyline Array becomes at the summit. ' +
      'The sky from the inside: waveform rooms and torn-loose pieces of Chagrin Falls floating ' +
      'in pure Signal, every view of the world stacked at once. This is where all five scouts’ ' +
      'trails converge, and where the Engine keeps its last, worst answer — a thing built from ' +
      'rumor and fear and every blurry photo anyone ever pointed at the dark. To pass, it will ' +
      'try to finish deciding what you are. The only way through is to refuse the label.',
  },
  {
    id: 'fragment-analysis-01',
    title: 'Fragment Analysis 01',
    classification: 'DECRYPTED // FRAGMENT 1',
    lockedUntilFragment: true,
    body:
      'The fragment is not debris. It is a reply. The Signal answers what people point at it: fear comes back with teeth, rumor comes back with a face. Five children pointed a homemade radio at it and asked a question, and the reply has been waiting in this field ever since. Analysis note, handwriting unknown: "It isn’t invading. It’s answering. Be careful what the grown-ups ask it." — C.',
  },
];
