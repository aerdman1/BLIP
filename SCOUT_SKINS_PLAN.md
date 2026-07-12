# BLIP — SIGNAL SKINS: Project Plan

> **Feature:** Unlockable player skins based on the Five Signal Scouts. Each skin
> recolors CONTACT-47 into that kid **and** grants a signature ability drawn from
> that scout's zone mechanic. Collecting a scout's full set summons their **echo**
> (the kid, as a character) who hands you their signal.
>
> **Status:** IMPLEMENTED — all five Signal Skins ship, and every scout's Signal Set is
> placed in their home zone (Will · Chip · Henry · Cameron · Danny across the five built
> zones). The finale is **Skyline Array → EndingScene**, where the five scouts converge.
> **Governing skills:** `blip-game-director`, `procedural-pixel-art`,
> `phaser-pixel-platformer`, `playtest-qa`, `scope-control`.

---

## 1. Concept — "Wear the Signal"

CONTACT-47 is a formless UNKNOWN the Interpretation Engine is trying to classify.
The Five Signal Scouts (Will, Chip, Henry, Cameron, Danny) each left traces in the
world. Gather enough of one scout's traces and you can **impersonate their frequency**
— the radar briefly reads you as "Will" instead of UNKNOWN. Mechanically that's a
new **skin** (recolor + silhouette accent) plus that scout's **signature ability**.

Why it fits BLIP: the whole game is about *what the radar decides you are*. Skins let
the player **choose what they're read as** — that's the game's core theme turned into
a progression system. Each skin embodies the exact zone mechanic that scout's trail
already teaches (`src/game/data/scouts.ts` → `gameplay`/`theme` fields), so skins
reinforce the fiction instead of bolting on a cosmetic shop.

Default state = **CONTACT-47 / UNKNOWN** (the true formless blip). Fully viable, no
tradeoffs — the baseline every skin sidegrades from.

---

## 2. The Five Signal Skins

Each skin = a **class flavor** (Recon / Engineer / Tank / Trickster / Speed) that is
*best in that scout's home zone* but usable everywhere. All numbers below are targets
— they live in `config.ts → SKINS`, never hardcoded.

| Skin | Scout / callsign | Color | Class | One-line fantasy |
|---|---|---|---|---|
| **UNKNOWN** | CONTACT-47 | blip white/cyan | Baseline | The thing on the radar. No tradeoffs. |
| **WILLOW** | Will | cyan | Recon | See the safe path & the enemy's eyes. |
| **SPARK** | Chip | orange | Engineer | Endless hover, overcharged shots, live off machines. |
| **ANCHOR** | Henry | green | Guardian | Hard to kill, hard to classify, drop safe zones. |
| **ECHO** | Cameron | purple | Trickster | Shots that bounce; master of the Blipstream. |
| **ROCKET** | Danny | red | Speed | Dash king / glass cannon. |

### WILLOW — Will — Recon
- **Passive:** `SCAN.radius ×1.4`, `SCAN.cooldownMs ×0.75`; revealed hidden platforms
  & route markers stay revealed until you leave the room.
- **Signature — Recon Ping:** a scan also outlines every enemy detection cone + aggro
  radius for ~3s.
- **Tradeoff:** `PULSE.damage ×0.9` (a scout, not a fighter).
- **Best in:** Blacksite County (stealth), any hidden-route content.

### SPARK — Chip — Engineer
- **Passive:** `PLAYER.energyMax ×1.5`, `energyRegenPerSec ×1.4`, `hoverDrainPerSec ×0.8`
  (much longer hover). Standing near signal boxes / machines fast-recharges energy.
- **Signature — Surge Shot:** every 3rd pulse is a SURGE (×2 dmg, instantly trips
  node switches & overloads machines).
- **Tradeoff:** `PLAYER.dashCooldownMs ×1.15` (relies on thrusters, not dashes).
- **Best in:** Motel Nowhere (powered-sign platforming), Blipstream node puzzles.

### ANCHOR — Henry — Guardian
- **Passive:** `+1` max hull; `CLASSIFY.fillPerSec ×0.6` (the Engine reads you slower);
  slow regen (+1 hp per few seconds standing still, out of any red cone).
- **Signature — Anchor Field (active):** plant a small safe zone that decays
  classification and heals over a few seconds. Cooldown-gated.
- **Tradeoff:** `PLAYER.runSpeed ×0.9` (heavy).
- **Best in:** Blacksite County (detection-heavy), boss fights.

### ECHO — Cameron — Trickster
- **Signature — Echo Shot:** pulse shots bounce once off geometry (or split into a
  second delayed pulse). In Blipstream: node switches stay lit longer and oscillating
  platform paths telegraph their arc.
- **Passive:** `PULSE.cooldownMs ×0.9`.
- **Tradeoff:** `SCAN.radius ×0.9` (reads patterns, not terrain).
- **Best in:** the Blipstream everywhere, The Moving Corn Maze (route-memory).

### ROCKET — Danny — Speed
- **Passive:** `PLAYER.dashCooldownMs ×0.55`, `dashSpeed ×1.15`, `runSpeed ×1.15`,
  longer dash i-frames; **air-dash** (one extra dash mid-air).
- **Signature — Phase-Strike:** dashing through a drone damages it and leaves a
  burning afterimage.
- **Tradeoff:** `-1` max hull (glass cannon); `CLASSIFY.fillPerSec ×1.2` (you run hot —
  red is the THREAT color for a reason).
- **Best in:** Skyline Array (dash-heavy vertical), speed challenges.

---

## 3. How you unlock them — Signal Sets + Scout Echoes

### 3.1 Signal Sets (the collectibles)
Each scout has a **3-piece Signal Set** hidden in their home zone (some pieces behind
scan-reveals, hover routes, or Blipstream nodes — themed to that scout):

| Piece | Role | What it does |
|---|---|---|
| **Badge** | identity | Marks the scout "DISCOVERED" in the Command Center. |
| **Log** | story | A short lore fragment in the scout's voice (the emotional beat). |
| **Relic** | power | Their signature gadget — the thing that grants the skin. |

Per-scout relics (procedural pixel glyphs, palette-locked to the scout color):

| Scout | Relic | Color |
|---|---|---|
| Will / WILLOW | the **Folded Map** | cyan |
| Chip / SPARK | the **Power Cell** (rewired spark box) | orange |
| Henry / ANCHOR | the **Signal Flare / anchor stake** | green |
| Cameron / ECHO | the **Tuning Fork / cipher wheel** | purple |
| Danny / ROCKET | the **Cracked Goggles** | red |

**Collect all 3 in a zone → that scout's skin unlocks.** This gives a concrete reason
to 100% each zone, and each skin pays off *in the very zone you earned it*.

> **Current state to formalize:** Will already has a badge + WILLOW log in Miller Field;
> Chip has the SPARK signal box. These become the Badge+Log of their sets — we just add
> the two missing Relics and wire the "set complete" check. Henry/Cameron/Danny sets
> live in their home zones (Zone build-out dependency), with optional teaser pieces
> seeded in Miller Field / Node A.

### 3.2 Scout Echoes (the "characters")
Completing a set triggers a **Scout Echo** encounter: a pixel apparition of the kid,
rendered in their scout color, floats up in the Blipstream/field, says one line, and
"hands you their signal" — the skin-unlock moment. This is the payoff that makes the
Five Scouts *characters*, not pickups, and it seeds the finale (the **Skyline Array →
EndingScene** climax, where all five echoes converge). New lightweight entity: `ScoutEcho.ts`.

---

## 4. Command Center — WARDROBE panel
New section **SIGNAL SKINS / WARDROBE** (extends the existing Scouts section in
`src/command-center/CommandCenter.ts`):
- Card per skin: locked (silhouette + "x/3 pieces found") or unlocked (color art +
  ability text + **SELECT** button).
- Selecting persists to save and applies on next field spawn (and live if in-field).
- Reads live from `skins.ts` + save progress, same honesty rule as the rest of the CC.
- In-game: a skin indicator on the HUD and an optional quick-swap in the pause menu.

---

## 5. Save schema (additive — stays `blip_save_v1`)
Extend `SaveData` in `src/game/systems/SaveSystem.ts` with defaulted fields so old
saves migrate silently (no key bump):
```ts
unlockedSkins: string[];              // ['contact47', 'will', ...] — contact47 always present
selectedSkin: string;                 // defaults 'contact47'
signalSets: Record<string, {          // keyed by scout id
  badge: boolean; log: boolean; relic: boolean;
}>;
```
`hydrate()` fills missing fields from defaults — same pattern already used for `flags`.

---

## 6. Technical architecture (file-by-file)

| File | Change |
|---|---|
| `src/game/config.ts` | New **`SKINS`** block (per-skin modifier tables + ability flags); new `TEX` entries for each skin body + relic/badge glyphs; new `EVT` events. |
| `src/game/data/skins.ts` **(new)** | `SkinDef[]` — single source of truth: id, scoutId, name, color, stat modifiers, ability flags, description, unlock hint. |
| `src/game/data/scouts.ts` | Grow `SCOUT_LOGS` to one per scout; add **`SIGNAL_SETS`** manifest (the 3 piece ids + placement notes per scout). |
| `src/game/entities/Collectible.ts` | Generalize `CollectibleKind` to `badge/log/relic` × scout (or a `scout-piece` kind param'd by scoutId+type); tint by scout color (already supported). |
| `src/game/entities/Player.ts` | Apply active skin's stat modifiers + ability hooks; `setSkin(id)`; swap texture/palette. |
| `src/game/systems/ProceduralArt.ts` | Generate per-skin player textures (recolor + small silhouette accent) and relic/badge glyphs. Cheap — art is already procedural. |
| `src/game/systems/SaveSystem.ts` | Schema deltas + additive migration; `unlockSkin()`, `selectSkin()`, `recordPiece()` helpers. |
| `src/game/systems/QuestSystem.ts` | Detect set-completion → emit `skinUnlocked`; trigger the Scout Echo. |
| `src/game/systems/EventBus.ts` + `config EVT` | `collectiblePicked`, `skinUnlocked`, `skinSelected`. |
| `src/game/entities/ScoutEcho.ts` **(new)** | The scout apparition encounter (art + one line + hand-off). |
| `src/game/data/levels.ts` | New grid symbols for scout pieces per zone; place Will/Chip relics in Miller Field. |
| `src/game/scenes/FieldScene.ts` (+ future zone scenes) | Spawn pieces from grid; apply selected skin on player spawn; fire Echo on set-complete. |
| `src/command-center/CommandCenter.ts` | New Wardrobe panel + extend Scouts section. |
| `src/game/scenes/UIScene.ts` | HUD skin indicator + optional pause-menu quick-swap. |
| `src/game/data/commandCenterData.ts` | Replace the `Henry/Cameron/Danny collectibles` TODO with the Signal Skins items (below). |

---

## 7. Phased build plan (QA-gated)
Every phase ends **green** on `npm run typecheck && npm run build && npm run qa:full`
before the next begins. Update the Command Center `BUILD_TODO` as each lands.

- **Phase 0 — Data & save foundation.** `skins.ts`, `config SKINS`/`EVT`, `SaveData`
  deltas + migration. No visible change. _Gate._
- **Phase 1 — Skin application + art.** `Player.setSkin()` + modifier layer;
  `ProceduralArt` recolors for all 5; debug hotkey to cycle skins. Prove all render +
  stats apply. _Gate._
- **Phase 2 — Wardrobe (Command Center).** View / select / persist skins; ability +
  progress display. _Gate._
- **Phase 3 — Signal Sets in Miller Field.** Formalize Will's + Chip's 3-piece sets
  (add their Relics), place them, wire pickup → progress → unlock-on-complete. _Gate._
- **Phase 4 — Scout Echo characters.** Apparition encounter on set-complete
  (Will + Chip first). _Gate._
- **Phase 5 — Signature abilities live.** Wire each skin's signature to gameplay
  (Recon Ping, Surge Shot, Anchor Field, Echo Shot, Phase-Strike + air-dash) and the
  classification tie-ins. Balance pass. _Gate._
- **Phase 6 — Roll out per zone.** As Zones 2–5 land, place each scout's full set +
  Echo + Relic in their home zone; the **Skyline Array → EndingScene** finale is where all
  five echoes converge. _Gate each zone._ **(Done — all five sets are placed.)**

**Sequencing:** Phases 0–5 can ship **now** (Will + Chip fully; Henry/Cameron/Danny
seeded/teased in Miller Field & Node A). Phase 6 runs alongside the Zone build-out
plan — each new zone brings its scout's set with it.

---

## 8. Balance principles
- Skins are **sidegrades**: one signature strength + one honest tradeoff. Not a power
  ladder.
- Each skin is *designed* to shine in its scout's home zone; that synergy is the point.
- **UNKNOWN / CONTACT-47 stays fully viable** — the no-tradeoff baseline.
- Boss & hazard tuning must never assume a skin is equipped.
- All modifiers live in `config.ts → SKINS`. Tune there; this doc & the CC follow.

---

## 9. Stretch / narrative hook (optional, very on-theme)
Tie skins into **classification** as story, not just stats: while wearing a skin the
Engine may read you as that *known* kid. ANCHOR lowers your classification; ROCKET
raises it. Go further — the Engine has **files on the missing children**: presenting as
"Will" could open a door that only opens for Will, but risks the Engine *completing that
kid's file*. That's a moral stake that pays off in the **Skyline Array → EndingScene**
finale (the classification choice, "REFUSE THE LABEL"). Keep out of core scope until the
base system ships.

---

## 10. BUILD_TODO edits (replace the current collectibles line)
In `src/game/data/commandCenterData.ts`, swap `Henry/Cameron/Danny collectibles` for:
- `Signal Skins: skin system + Wardrobe (all 5 scouts)`
- `Signal Sets: badge/log/relic collectibles for all 5 scouts`
- `Scout Echo encounters (unlock payoff + characters)`
- `Per-skin signature abilities + classification tie-in`

---

## 11. Open decisions (for sign-off)
1. **Active abilities** (Anchor Field, Surge Shot cadence) — keep as designed, or
   passive-only for v1 to cut scope?
2. **Skin swapping** — anywhere from the Wardrobe, or only at scout "shrines" in-world?
3. **Glass-cannon ROCKET** — is `-1` hull acceptable, or make it purely additive?
4. **Stretch narrative hook (§9)** — in scope for the first pass, or park it?
