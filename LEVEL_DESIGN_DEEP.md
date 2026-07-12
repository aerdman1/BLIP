# BLIP — DEEP LEVEL DESIGN

> The in-depth design for the campaign's zones. Goal:
> every level is genuinely UNIQUE and FUN — one signature system + one motivated
> perspective shift each, so nothing repeats — while staying unmistakably BLIP and
> smooth. This is authoritative alongside `LEVEL_RETHEMES.md` and `SCOUT_SKINS_PLAN.md`,
> and it is mirrored in **Command Center ▸ LEVEL PLANS** (data: `src/game/data/levelPlans.ts`).
>
> **Status:** BUILT — all **5 zones are shipped and playable** (Miller Field → Motel
> Nowhere → Chagrin Falls High → Patterson's Orchard → **Skyline Array, the finale**),
> ending in **EndingScene** (the classification choice — "REFUSE THE LABEL"). There is no
> Zone 6; "The Broadcast" was folded into the Skyline Array finale (a possible post-V1
> stretch at most). · **Governing skills:** `blip-game-director`, `procedural-pixel-art`,
> `phaser-pixel-platformer`, `blipstream-puzzle`, `scope-control`.

---

## 1. Design pillars (the vision every zone serves)

1. **One core, many lenses.** Every zone is still BLIP — scan, classification, the
   Blipstream, "the Signal answers what you point at it." Each adds exactly ONE
   signature system and ONE perspective shift, so no two feel the same. Shifts are
   motivated by the fiction (you slip inside the Signal), glitch-transitioned, smooth.
2. **The perspective ladder.** Variety escalates: Z2 top-down circuit · Z3 underwater
   gravity-inversion · Z4 top-down crop-draw · Z5 first-person sky-tuning (the finale).
   The side-view platformer stays the spine; shifts are spice, never a genre the
   player must relearn from zero.
3. **Pixel + selective realism.** Crisp 2D pixel base; realism reserved for LIGHT and
   WATER (volumetric cones, bloom, wet/pool reflections, storm haze, depth particles) via
   Phaser blend modes / light shaders. Always 60fps-smooth; never breaks the pixel
   identity. UI stays crisp HTML.
4. **Wear the zone you earn.** The mechanic a zone teaches IS that scout's skin ability,
   so gathering the Signal Set and equipping the skin pays off in place.
5. **The stakes are identity.** Classification escalates: meter (Z1) → stadium scoreboard
   (Z3) → the Engine holds your file (Z5 Skyline Array). By the **Skyline Array finale**,
   "what the radar reads you as" becomes a choice with a cost — the EndingScene
   "REFUSE THE LABEL" climax.

---

## 2. The perspective ladder — how each shift is built (Phaser feasibility)

These are NOT a second engine — they reuse our scene/transition tech and stay smooth.

| Zone | Shift | Practical implementation |
|---|---|---|
| Z2 | **Top-down circuit run** | A separate scene (gravity off, top camera). You're a spark; move on a wire grid to route power. Same input, no jump. Enter/exit = the existing glitch/static Blipstream transition. |
| Z3 | **Underwater inversion** | Same side-view scene, `gravity.y` flipped/reduced + water tint + drift particles + slower accel. It's a physics + shader reskin, not new tech. |
| Z4 | **Top-down crop-draw** | Top camera; the player leaves a glowing trail (Will's route-tracer) that must match a target glyph. A drawing/overlap check, not 3D. |
| Z5 | **First-person tuning** (finale) | A fullscreen HTML/canvas overlay minigame (parallax starfield + dials) layered over the paused side-view — like the Command Center overlay. Stylized 2.5D, not a 3D engine. Skyline Array closes on the EndingScene classification choice. |
| *(cut)* | **Genre-melding** | Once a planned Zone 6 "The Broadcast" — folded into the Skyline Array finale. If ever revived as a post-V1 stretch: rooms pick one of the above per segment, transitions are the glitch cut, skin-swap gates decide which room opens. |

**Rule:** if a shift can't be made buttery-smooth and readable, cut it back to a flavor
beat rather than ship jank. The side-view core must always be the fallback.

---

## 3. Graphics philosophy — "pixel with a pulse"

- **Base:** everything procedural pixel at the 480×270 virtual canvas (per the art skill).
- **Realism, only where it sells atmosphere:** additive **light** (lamp/lighttower cones,
  neon bloom, firefly glow, storm flashes) and **water** (wet-asphalt + pool reflections,
  god-rays, drift). Rendered with blend modes / a light-blur render texture — cheap, and
  it reads as "pixel art shot on real film," not a different art style.
- **Motion sells it:** hover bob, dash afterimages, scan ripples, screen shake, glitch
  flashes — already the house style; each zone adds one signature motion (neon flicker,
  pool ripple, chaff drift, wind streaks, rumor static).
- **Per-zone identity is the palette + one hero material** (Z2 neon+wet asphalt, Z3
  stadium bloom + reflective water, Z4 crop-glyph glow + drawn-map overlay, Z5 storm sea +
  starfield + the EndingScene glitch-seam finale).
- **Never noisy.** Detail lives in silhouettes, light, and one or two hero props — not in
  busy tiling (see the Miller Field terrain pass: rich but calm).

---

## 4. The zones (deep)

> Each zone's full field set (signature, perspective, standout moment, core loop, wild +
> core mechanics, sub-areas, Blipstream node, boss phases + weakness, scout Signal Set,
> skin payoff, graphics identity) is the single source of truth in
> `src/game/data/levelPlans.ts` and renders live in Command Center ▸ LEVEL PLANS. This
> section is the prose companion — read them together.

- **Z1 Miller Field (BUILT)** — the template: scan-reveal → Blipstream mode-switch that
  reshapes the overworld. Everything later riffs on this.
- **Z2 Motel Nowhere (Chip/SPARK)** — *the neon is the level.* Lit signs are solid; rewire
  the town's power so routes flick in/out. **Perspective:** top-down "inside the circuit"
  spark-runs. **Wild:** a quiet ~90s time-loop the level resets on until Chip breaks it;
  reading routes in wet-asphalt reflections. **Graphics:** neon + CRT VACANCY, puddle
  reflections, diner bloom, vector-glow circuit mode.
- **Z3 Chagrin Falls High (Henry/ANCHOR)** — *Friday-night-lights stealth.* Rotating
  light-cones timed like rhythm; the **scoreboard KNOWN/UNKNOWN is your detection meter**;
  a phantom crowd whose cheers rise and expose you if you rush. **Perspective:** dive
  through the rec pool → an **underwater, gravity-inverted mirror** world (the node).
  **Graphics:** volumetric light-tower cones + bloom, Tiger banners under ANCHOR green,
  reflective water, god-rays underwater.
- **Z4 Patterson's Orchard (Cameron/ECHO)** — *the maze thinks,* rearranging on a readable
  pattern. **Perspective:** lift to a **top-down crop-draw** view and trace a crop-circle
  route to lock gates. **Standout:** the camera pulls up to reveal you were drawing the
  answer. **Graphics:** apple-pillar silhouettes, green-roof barn, glowing crop glyphs, a
  drawn-map overlay in top-down mode.
- **Z5 Skyline Array (Danny/ROCKET) — THE FINALE** — *storm-surfing speedrun* up antenna
  spires on updrafts, lightning below, on a relentless clock. **Perspective:** a
  **first-person "tune the sky"** beat at each dish — quiet, staring up through the dish
  aligning constellations. **Boss:** The Listening Station. **Finale:** beating it launches
  **EndingScene** — the Five Signal Scouts converge and CONTACT-47 makes the classification
  choice, **REFUSE THE LABEL** (you decide what the radar is allowed to read you as).
  **Graphics:** storm sea + lightning below the catwalks, speed-blur, a first-person
  starfield/dial overlay, an iris dome that opens like an eye, and the glitch-seam ending.

> **On "The Broadcast":** once planned as a separate Zone 6 finale (genre-melding rooms,
> skin-swap gates, a rumor-static boss that copies your last mode), it was **folded into the
> Skyline Array finale**. It is no longer a shipped zone — at most a post-V1 stretch idea.
> Its stakes (present as a known kid to pass a gate, but risk completing that child's file)
> and its imagery (impossible road fragments in a void, every palette bleeding through glitch
> seams, a rumor-static monster that never resolves) live on in the EndingScene climax.

---

## 5. Cross-cutting signature systems (build once, reuse everywhere)

- **Perspective-shift kit** — a reusable "enter alt-view" transition (glitch/static + camera
  swap + physics profile) so Z2/Z3/Z4/Z5 all share one smooth pipeline (the shared **Fold**).
- **Route-tracer / crop-draw** (Will) — a trail-vs-target-glyph system; core of Z4.
- **Light + reflection layer** — the additive light / reflective-water render pass;
  authored once, tuned per zone (neon, stadium, storm).
- **Classification-as-identity** — extend the meter into the scoreboard (Z3) and the
  Skyline Array finale's file-gates + EndingScene choice; skins let you present as a known
  kid (the SCOUT_SKINS §9 hook) with a moral cost.
- **Sound-reactive atmosphere** — the phantom crowd (Z3), neon hum (Z2), storm (Z5); a
  small "ambient intensity → detection/juice" coupling, WebAudio-driven.

---

## 6. Build order & scope guard (per `scope-control`)

Build in roadmap order — **Motel Nowhere first** — and only after Miller Field is proven
fun in human playtest. Each zone ships with its scout's full Signal Set + Scout Echo
(SCOUT_SKINS_PLAN.md Phase 6). Prototype each zone's ONE signature shift on a grey-box
before art. If a wild mechanic can't be made smooth, demote it to flavor and keep the
side-view core clean. Keep `typecheck + build + qa:full` green per zone.

---

## 7. AS BUILT — Zone 4: Patterson's Orchard (first pass, 2026-07-11)

Zone 4 shipped as BLIP's first fully hybrid zone on the shared **Fold / Sweep** engine.
Full atlas + systems: see `ZONE4_ATLAS.md`.

- **Side-view spine** (`OrchardScene`, `buildPattersonsOrchard()` — 150×50 tiles): farm road →
  tall apple-tree pillar climb (branch ledges + respawning fruit) → white barn + hidden loft
  (Cameron/ECHO badge) → shifting-wall corn-maze approach → Fold mouth → crop-circle gate →
  maze heart (Tuning Fork) → Harvest Pattern arena → county road.
- **Signature — "THE MAZE THINKS":** side-view corn walls (`Q`/`W`) rearrange on a fixed,
  purple-telegraphed beat (never random). The real maze traversal is the **top-down `maze-z4`
  Sweep arena** reached through the Fold; charging its crop-circle node **blooms** the circle
  (the standout), then Folds you back and opens the gate.
- **Progression:** Cameron/ECHO Signal Set (badge + `cameron-log-1` + Tuning Fork) → ECHO skin;
  boss grants Signal Fragment 4/5 + `pulse-ricochet`.
- **Boss — The Harvest Pattern:** FULL fight — read the rotating glyph (the weak symbol's
  down-swing opens the core), scan to slow the spin, dodge telegraphed radial volleys, and
  survive the low-HP "walls close in" harvest sweeps. Grants Fragment 4/5 + `pulse-ricochet`.
- **Secrets (3):** hidden barn loft (Cameron badge) · maze heart (Tuning Fork) · **cider
  cellar** (drop-in shard cache). Dedicated **orchard music** track in `AudioSystem`.
- **Command Center:** new `cc-atlas-orchard` side-view atlas **and** a new **SWEEP ARENAS**
  birdseye section rendering the top-down room/hall maps (Z1 `surface-z1`, Z2 `circuit-z2`,
  Z4 `maze-z4`). Zone card = PLAYABLE, LEVEL PLANS = BUILT, BUILD TODO ticked.
- **Known limitations:** the county-road exit is a signpost until Zone 5 exists; not yet
  human-playtested end-to-end (typecheck + build green).
