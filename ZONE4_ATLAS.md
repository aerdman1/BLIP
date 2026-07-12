# ZONE 4 LEVEL ATLAS — Patterson's Orchard

> **Scout:** Cameron / ECHO (purple) · **Boss:** The Harvest Pattern (full) ·
> **Signature:** *THE MAZE THINKS* · **Signal Fragment:** 4 / 5
> **Status:** first playable pass (2026-07-11). Live birdseye renders in the Command Center
> ▸ **LEVEL ATLAS** (`cc-atlas-orchard`) and ▸ **SWEEP ARENAS** (`cc-sweep-maze-z4`).

Patterson's is a pick-your-own apple farm and its corn maze out on the county road. The town
asked the sky for one more good harvest, and one more — so the Signal gave them all at once:
apples regrow mid-fall, the corn rows rearrange behind you, and a crop-circle spreads through
the maze **like it is thinking**. You win by reading the rhythm of the shift, not brute-forcing
it. This is BLIP's first *hybrid* zone built entirely on the shared **Fold / Sweep** engine.

---

## The route (west → east, with a tall vertical climb)

```
 farm road ─▶ APPLE-TREE PILLAR CLIMB ─▶ white BARN + hidden LOFT ─▶ descent
   (spawn)     (branch ledges + fruit)     (Cameron/ECHO badge)
      │                                                                   │
      ▼                                                                   ▼
 CORN-MAZE APPROACH ─▶ FOLD MOUTH [E] ══╗                        (drop to floor)
 (walls shift on a beat)                ║  THE FOLD
                                        ▼
                            ┌─────────────────────────────┐
                            │  TOP-DOWN maze-z4 (Sweep)    │
                            │  fight the corn maze →       │
                            │  charge the crop-circle node │
                            │  → the CIRCLE BLOOMS         │
                            └──────────────┬──────────────┘
                                           ║  FOLD back
                                           ▼
 crop-circle GATE opens ─▶ MAZE HEART ─▶ HARVEST PATTERN arena ─▶ COUNTY ROAD
   (was sealed)            (Tuning Fork)   (tiered, red band)      (→ Zone 5 stub)
```

**Flow:** farm road → a tall apple-tree pillar climb (branch ledges + **respawning fruit
platforms**) → the white barn + green metal roof with a **hidden loft** (Cameron's ECHO badge)
→ back down to the **corn-maze approach** whose walls shift on a readable, telegraphed beat →
the **Fold mouth** `[E]` drops you into the **top-down `maze-z4` Sweep arena** → fight through,
charge the **crop-circle node** and it **blooms** across the map (*"you drew the answer"*) →
Fold back; the sealed **crop-circle gate** opens → the **maze heart** (the **Tuning Fork**
relic) → the tiered **Harvest Pattern** boss arena → the **county road** east (Zone 5 signpost).

---

## Dimensions & shape

| | |
|---|---|
| Side-view level | **150 × 50 tiles** (2400 × 800 px) — `buildPattersonsOrchard()` in `src/game/data/levels.ts` |
| Top-down Sweep arena | **`maze-z4`** — 36 × 22 tiles, `orchard` biome — `src/game/data/sweepArenas.ts` |
| Vertical range used | rows 6 → 44 · **38 tiles (608 px)** — a genuine climb, not a flat strip |
| Climbs | 1 tall apple-pillar climb + a hidden loft climb |
| Optional routes | 2 (barn-loft badge · maze-heart relic) |
| Perspective shift | side-view ⇄ **the Fold** → top-down `maze-z4` (shared `SweepScene`), bookended by `foldCollapse`/`foldSettle` |
| Est. playtime | ~6–9 min |

---

## Core systems

- **Apple-tree pillar climb** — alternating branch ledges (`=`) and **respawning fruit
  platforms** (`%`) on a 2-row-step ladder. Fruit cycles solid → telegraph blink → gone →
  regrow (`ORCHARD.fruitRespawnMs`), a forgiving timing beat (a miss just drops you a ledge).
- **The maze that thinks** — side-view corn walls in two phases (`Q` / `W`) that rearrange on a
  fixed, **purple-telegraphed** beat (`ORCHARD.mazeShiftPeriodMs` / `mazeTelegraphMs`). Never
  random; soft corn nudges you clear rather than trapping you.
- **The Fold → top-down crop-draw** — the maze mouth `[E]` runs `foldCollapse` and switches to
  the shared `SweepScene` with the `maze-z4` arena. Charging the crop-circle node opens the
  breach **and blooms a giant crop-circle glyph** across the corn — the standout beat. Folding
  back sets `orchardMazeSolved` and opens the maze-heart gate.
- **Cameron / ECHO progression** — badge (in the hidden loft, grants badge + `cameron-log-1`) +
  the **Tuning Fork** relic (maze heart) complete the Signal Set → unlocks the **ECHO** skin
  (bouncing Echo Shot). ECHO's top-down identity is already the bouncing Echo Arc weapon boon.
- **The Harvest Pattern boss (FULL)** — *read the pattern:* one **weak symbol** orbits the
  rotating glyph and the core only opens while it **dips down toward you** (a telegraphed STRIKE
  window); each core hit jumps the weak symbol to a new spoke. A **scan slows the rotation**
  (ECHO's read). Between windows it fires telegraphed radial volleys; below a third HP the maze
  **closes in** with telegraphed **harvest sweeps**. Defeat grants **Signal Fragment 4/5** and
  the `pulse-ricochet` ability.
- **Hidden cider cellar** — a pocket under the farm road: drop in for a Signal-Shard cache
  (`foundSecrets: 'orchard-cider-cellar'`). Third optional space alongside the loft + maze heart.

---

## How to reach it

- **Natural chain:** beat Zone 3 (Chagrin Falls High) and walk east off the county road — you
  fade straight into the orchard (`StadiumScene.travelToOrchard`).
- **Command Center:** the zone card shows **PLAYABLE**; LEVEL PLANS shows **BUILT**.
- **Continue / Game Over** resume routes to the orchard when it's the saved zone.
- **QA / dev:** `__BLIP_TEST_API__.enterZone('pattersons-orchard')`.

---

## Playable now / stubbed / later polish

- **Playable now (everything):** full start→exit traversal · apple-pillar climb + respawning
  fruit · barn + hidden loft · **cider-cellar** secret · a denser shifting-wall maze approach ·
  **the Fold → top-down `maze-z4` + crop-circle bloom** · Cameron badge/log/relic → ECHO unlock ·
  the **full Harvest Pattern boss** (strike-window read + low-HP harvest sweeps) · Signal
  Fragment 4/5 · a dedicated **orchard music** bed · Command-Center side-view atlas + the new
  **Sweep-arena birdseye**.
- **Remaining:** wire the county-road exit → **Zone 5 (Skyline Array)** once it exists; an
  end-to-end **human playtest** + `qa:full` (typecheck + build are green now). Optional art polish.

## Known limitations
- The side-view maze approach is a denser *reading* beat; the full maze traversal is the
  top-down `maze-z4` arena (by design — the perspective shift IS the maze).
- The county-road exit leads on to Zone 5 (Skyline Array), the finale.
- Not yet human-playtested end-to-end (typecheck + build green; `qa:full` loop pending).
