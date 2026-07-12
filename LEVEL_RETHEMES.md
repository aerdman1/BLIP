# BLIP — LEVEL RE-THEMES: Chagrin Falls Landmarks

> Re-skin two zones to real Chagrin Falls, Ohio landmarks (the town the
> game is already canonically set in). This is a **re-theme of existing zones — zero new
> scope**: same scout, same mechanic, same boss; new name, fiction, and procedural art.
>
> **Status:** IMPLEMENTED — both re-themed zones (Chagrin Falls High / Tiger Stadium and
> Patterson's Orchard) are now built and playable. · **Governing skills:** `blip-game-director`,
> `procedural-pixel-art`, `scope-control`. **Implemented into:** `src/game/data/zones.ts`,
> `src/game/data/gameBible.ts` (+ reference updates, see §4).

---

## The canon key — why real places fit
From the story bible: *"The Signal answers what people point at it… Be careful what the
grown-ups ask it."* A real, warm, ordinary Chagrin Falls place becomes a BLIP level
because the Signal has made **one impossible thing locally true** there. The town stays
real and warm; the Signal bends one ritual into something eerie. Tone stays PG,
heartfelt, never dark — the scouts are local kids who knew these places.

---

## 1. Zone 4 → PATTERSON'S ORCHARD  (was "The Moving Corn Maze")

**Scout:** Cameron / ECHO (unchanged) · **Boss:** The Harvest Pattern (unchanged).
Patterson's is a real pick-your-own apple farm **with a corn maze** — a perfect host for
ECHO's pattern/route-memory/Blipstream-logic mechanic. The corn maze becomes the puzzle
heart of the farm.

**The Signal's answer:** the town asked the sky for a perfect endless harvest, so apples
regrow mid-fall, the rows rearrange behind you, and a glowing crop-circle pattern spreads
through the corn like the maze is thinking.

**Exact `zones.ts` entry (replace the `moving-corn-maze` object):**
```ts
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
```

**Exact `gameBible.ts` entry (add to `GAME_BIBLE`):**
```ts
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
```

**Procedural side-view art (per hard rules — silhouettes/shapes, NO illustrated barn):**
rows of apple-tree pillars as climbable platforms · white barn + **green metal roof** as a
parallax silhouette backdrop · hanging orchard lights (purple/red glow) · corn-maze walls
as shifting vertical bars (route-memory) · crop-circle glyphs burned into the field.

---

## 2. Zone 3 → CHAGRIN FALLS HIGH / TIGER STADIUM  (was "Blacksite County")

**Scout:** Henry / ANCHOR (unchanged) · **Boss:** The Weather Balloon (unchanged).
The old brief already read *"stadium lights and stealth platforming through overlapping
detection cones"* — the Tigers' stadium is the tightest match on the whole roadmap. And a
"weather balloon" over the fifty-yard line **is** the classic UFO cover story; the Engine
literally labels things `WEATHER`.

**The Signal's answer:** the town pointed its most wholesome ritual — Friday night
football — at the sky, and the Signal kept the game going forever: lights that never cut,
a scoreboard tallying `KNOWN / UNKNOWN` instead of points, a crowd that isn't there.

**Mechanic:** sweeping stadium-light cones = rotating classification pressure; bleachers +
goalposts = platforms; the running track = a speed lane. Henry/ANCHOR safe zones (end
zone, dugout, concession stand) let you cross **between** light sweeps. The **rec pool**
sits on the horizon as a parallax landmark and becomes a sub-area: dive through its
reflection to enter a Blipstream node (water = a mirror the Signal reads you in).

**Exact `zones.ts` entry (replace the `blacksite-county` object):**
```ts
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
```

**Exact `gameBible.ts` entry (add to `GAME_BIBLE`):**
```ts
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
```

**Procedural side-view art:** silhouette bleachers + press box · orange/black Tiger banners
(the mundane town color) under a green ANCHOR signal-glow · light-pole cones · yard-line
grid · a distant lane-lined pool shimmer.

---

## 3. What stays unchanged
Zone 1 Miller Field (Will) · Zone 2 **Motel Nowhere** (Chip/SPARK — neon & power) ·
Zone 5 **Skyline Array** (Danny/ROCKET — dedicated dash/speed zone, and **the finale** →
EndingScene). There is no Zone 6; "The Broadcast" was folded into the Skyline Array finale.

**Skins tie-in:** ANCHOR (Henry) is earned at the stadium, ECHO (Cameron) in the maze —
each skin is best in the zone you earn it (see `SCOUT_SKINS_PLAN.md`).

---

## 4. Reference-update checklist (do NOT skip — prevents broken canon links)
The zone `id`s and display names change, so after editing `zones.ts` + `gameBible.ts`:
1. `grep -rn` the repo for the OLD values and update **every** hit:
   - `blacksite-county` · `Blacksite County`
   - `moving-corn-maze` · `The Moving Corn Maze`
2. Update the `zone:` fields in `src/game/data/scouts.ts`:
   - Henry → `'Chagrin Falls High'`
   - Cameron → `"Patterson's Orchard"`
3. Check the Command Center + any Playwright tests that assert on the old names.
4. `npm run typecheck && npm run build && npm run qa:full` — all green before moving on.

---

## 5. Optional (decide later)
If you'd rather the running **track** drive actual speed/timed-trial gameplay, hand the
stadium to Danny/ROCKET and re-theme Skyline Array instead. Recommendation is to keep it
Henry/ANCHOR (lights + Weather Balloon fit best), but it's a clean swap.
