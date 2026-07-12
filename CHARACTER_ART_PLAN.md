# BLIP — SCOUT CHARACTERS & SIGNAL PORTRAITS: Plan

> How the five scouts get into the game. Decisions are **LOCKED** (owner delegated them).
> **Status:** largely IMPLEMENTED — the procedural scout sprites, Scout Echoes, Signal
> Skins, and the Signal Portrait gallery all ship; all five sets are placed across the five
> built zones. Extends `SCOUT_SKINS_PLAN.md`.
> **Governing skills:** `procedural-pixel-art`, `blip-game-director`.

---

## The idea in one line
From **one act of collecting** each scout's traces, you get three payoffs: you **MEET**
them (a pixel echo with their name over its head), you can **PLAY AS** them (a pixel skin),
and you **KEEP** a **Signal Portrait** — the beautiful painted art, earned as a collectible
card. The painted images are **never** used as in-world sprites; they live only as reward
cards in the (HTML) Command Center.

---

## The three forms per scout

### 1. MEET them — Scout Echo (procedural pixel, in-world)
- When you complete a scout's Signal Set, their **echo** appears: a ~24×32px pixel figure
  of the kid, built procedurally in their signal color, hovering/glitching like a memory.
- **Their name floats above their head** — `WILL / WILLOW`, `HENRY / ANCHOR`, etc. — so it's
  always clear who you just met, even if the tiny sprite isn't a perfect likeness.
- Says one warm line, hands you their signal, fades. (Entity: `ScoutEcho.ts` from skins plan.)
- Built "as best we can" from the guide art — signal color + silhouette + 2–3 signature
  features. Likeness doesn't need to be exact; the name tag + color carry recognition.

### 2. PLAY AS them — Signal Skin (procedural pixel, in-world)
- The same pixel design becomes the **player body** when that skin is equipped
  (`SCOUT_SKINS_PLAN.md`). Authored as pixel data in code → zero image assets, stays procedural.

### 3. KEEP them — Signal Portrait (the painted card, UI only)
- Completing a scout's set also awards a **Signal Portrait**: the raw painted illustration,
  framed as a collectible "card" in a new Command Center **gallery** (e.g. *"SIGNAL PORTRAIT
  — DANNY / ROCKET, recovered"*).
- **In-fiction:** the Interpretation Engine only ever sees a *blip* — a label. You collect
  enough of a scout's traces that the Signal can **render them in full** again: a real kid,
  not a reading. That inversion (blip → full picture) is the emotional core, and it's the
  *only* place the painted art appears.
- This is the single, contained exception to "zero image assets," and it's justified: the
  art is an **earned trophy in the HTML console**, not world decoration.

---

## LOCKED decisions (my calls, per "figure it out")
1. **Cameron stays PURPLE.** Canon/palette wins; his guide art is blue but recoloring one
   pixel sprite to purple is trivial and avoids rippling a color change through config/skins/
   Command Center. His Signal Portrait card can keep the blue art or get a purple pass later —
   cosmetic, not blocking.
2. **In-world = 100% procedural.** Echoes and skins are pixel-data sprites in code. **No PNG
   ever ships into the 480×270 world.**
3. **Painted art = collectible cards only**, in the Command Center gallery (the one contained
   UI-asset exception).
4. **Name tags:** yes — callsign label floats above every Scout Echo when you meet them.
5. **Sprite scope v1:** ~24×32px, idle + run + jump. Enough to ship; add hover/attack later.

No open questions remain — this is the spec.

---

## Remake pipeline (per scout, ×5)
1. **Lock the design** from the guide portrait: signal color + hair + outfit palette, the
   silhouette, and **2–3 signature features** (below). Reference only — do not trace.
2. **Author the pixel sprite** (idle/run/jump) in code, palette-locked to the scout color.
   Same sprite drives both the Echo and the Skin.
3. **Frame the Signal Portrait card** from the raw art: consistent crop + a signal-color
   frame + name/callsign + "recovered" tag, for the gallery.
4. **Set pass:** all five share one template so they read as a family.

| Scout | Color | Signature features for the pixel build |
|---|---|---|
| Will / WILLOW | cyan | spiky hair, cyan signal glyph on chest, sling bag |
| Chip / SPARK | orange | blond hair, orange sash + badge |
| Henry / ANCHOR | green | backpack, green neckerchief, sturdy build |
| Cameron / ECHO | **purple** | tie-dye/ripple motif → recolored purple, calm stance |
| Danny / ROCKET | red | red neckerchief, lean/fast build |

---

## Where it plugs in (no new systems — art layer over existing plans)
| Surface | Form | System |
|---|---|---|
| Scout you meet on set-complete | pixel echo + name tag | `ScoutEcho.ts` (skins plan) |
| Player body when skin equipped | pixel skin | Signal Skins (`SCOUT_SKINS_PLAN.md`) |
| Command Center scout file | text/data (already exists) | `sectionScouts` |
| **Signal Portrait gallery (new)** | painted card | new Command Center panel |

---

## Build order (for the builder session, later)
1. Pixel sprite template + all 5 scout sprites (drives echo + skin).
2. Scout Echo entity + name tag + set-complete trigger.
3. Wire sprites into Signal Skins.
4. Signal Portrait gallery panel + award-on-completion + save the earned set.

Naming stays in the **Signal ___** family: Signal Fragments · Signal Sets · Signal Skins ·
**Signal Portraits**.
