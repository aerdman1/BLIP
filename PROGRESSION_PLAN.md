# BLIP — PROGRESSION PLAN: Earning Your Power

> Turn BLIP from "everything unlocked at start" into a game where you **earn** abilities
> by beating zones, spending salvage, and finding scout gear. **Most of this is already
> sketched** in `src/game/data/upgrades.ts` (a display-only roadmap today) — this plan
> WIRES it into a real earn-loop. Deliberately lean: 3 channels, ~6 abilities, one shop,
> one hub. No sprawling skill tree.
>
> **Governing skills:** `blip-game-director`, `scope-control`, `phaser-pixel-platformer`.
> **Composes with:** `LEVEL_RETHEMES.md`, `SCOUT_SKINS_PLAN.md`.

---

## The spine — 3 ways to earn, each a different feel

| Channel | How you earn it | What you get | Vibe |
|---|---|---|---|
| **A — Signature Abilities** | Beat a zone (boss + Signal Fragment) | 1 fixed marquee ability per zone — often a **metroidvania key** | milestone / story |
| **B — Signal Shards** | Salvage from destroyed drones + hidden caches | Spend at Chip's **Workbench** on tiered stat upgrades | flexible / exploration |
| **C — Scout Skins** | Complete a scout's 3-piece Signal Set | That scout's skin + playstyle | identity (see skins plan) |

Base kit stays fully playable start-to-finish. Everything below is **added power + soft
gates**, never a wall you can't pass with the core kit + skill.

---

## Channel A — Signature Abilities (one per zone, from the boss)

After each boss, the Signal Fragment secures and its **signature ability** is granted in
a reward card (hook the existing quest `complete` step — e.g. "SPARK online"). These reuse
the existing `upgrades.ts` ids and mostly already have `source:` tags pointing here.

| Zone | Boss | Signature (upgrade id) | Power + why it's a key |
|---|---|---|---|
| 1 Miller Field | Scarecrow Antenna | `pulse-resonance` | +core damage — combat primer (already the Fragment-1 reward). |
| 2 Motel Nowhere | The Vacancy Sign | `emp-burst` | disable machines in a radius → opens machine-locked routes. |
| 3 Chagrin Falls High | The Weather Balloon | `ghost-protocol` | briefly **unreadable by cones** — the cloak; the big traversal key. |
| 4 Patterson's Orchard | The Harvest Pattern | `pulse-ricochet` (+ `scan-memory`) | bounce shots at indirect switches; reveals linger. |
| 5 Skyline Array **(finale)** | The Listening Station | `phase-drift-plus` (+ air-dash) | longer phasing dash / air-dash → high vertical routes. Beating it launches **EndingScene** — the classification-choice climax ("REFUSE THE LABEL"). |

**Soft gating (light — don't over-wall):** a few routes need a later ability, which
creates the AAA "come back stronger" loop — e.g. `ghost-protocol` lets you re-cross cone
corridors in earlier zones to reach scout relics you couldn't before. Tie **some** (not
all) scout Signal-Set pieces behind these, linking Channel A to Channel C.

`route-tracer` (Will) and other flavor upgrades: grant from **scout Signal-Set
completion** rather than bosses, so the scouts feel like the source of the best tricks.

**Ending / Finale.** There is no Zone 6. **Skyline Array (Zone 5) is the finale** — its
boss (The Listening Station) grants the last signature and Signal Fragment (5/5), then
launches **EndingScene**: the Five Signal Scouts converge and CONTACT-47 makes the
classification choice, **REFUSE THE LABEL** (you decide what the radar is allowed to read
you as). "The Broadcast," once a planned capstone zone, was folded into this finale.

---

## Channel B — Signal Shards + Chip's Workbench

The flexible economy that makes exploration pay off.

- **Currency: Signal Shards** — drop from destroyed drones and hide in caches/side-routes.
  New pickup kind on `Collectible.ts`; new HUD counter.
- **Vendor: Chip's Workbench** — unlocks when Chip/SPARK's file is discovered (Zone 2).
  Lives as a tab in the Command Center **PROGRESSION** panel (already exists as display).
- **What you buy (tiered I → II, from the `upgrades.ts` roadmap + a few stat lines):**
  `hover-cell-plus` (longer hover / slower drain) · `wide-scan` (bigger radius) ·
  **Max Hull +** · **Energy Regen +** · **Pulse Rate +** · **Dash Cooldown −**.
- Keep it to ~6 upgrade lines × 2 tiers. Costs live in `config.ts`.

---

## Channel C — Scout Skins
Per `SCOUT_SKINS_PLAN.md` — collect a scout's Signal Set → their skin + signature
playstyle. Same progression, the identity axis. No changes needed here beyond noting it's
part of the same "earn it" spine.

---

## Save schema (additive — stays `blip_save_v1`)
Extend `SaveData` (defaults fill for old saves, same pattern as `flags`):
```ts
unlockedAbilities: string[];        // upgrade ids granted (['pulse-resonance', ...])
shards: number;                     // Signal Shard balance
purchasedUpgrades: string[];        // workbench purchases (with tier suffix, e.g. 'max-hull-2')
// (skins fields come from SCOUT_SKINS_PLAN.md)
```

---

## Technical wiring (file-by-file)
| File | Change |
|---|---|
| `src/game/data/upgrades.ts` | Add earn-metadata to each: `unlockType: 'boss' \| 'shop' \| 'scout-set'`, `cost?`, `gatedBy?`. Flip statuses as they land. |
| `src/game/config.ts` | New `PROGRESSION` block: shard drop rates + workbench costs + per-ability tuning. |
| `src/game/systems/SaveSystem.ts` | Schema deltas + migration; `grantAbility()`, `addShards()`, `buyUpgrade()`. |
| `src/game/systems/QuestSystem.ts` (or new `ProgressionSystem.ts`) | Grant the zone's signature ability on the boss/fragment `complete` step; emit events. |
| `src/game/entities/Collectible.ts` | New `shard` kind; drones drop shards on death. |
| `src/game/entities/Player.ts` | Apply owned abilities/upgrades to the kit (mods layer — coexists with skin mods). |
| `src/game/systems/EventBus.ts` + `config EVT` | `abilityUnlocked`, `shardsChanged`, `upgradePurchased`. |
| `src/command-center/CommandCenter.ts` | Turn the PROGRESSION panel into the live Workbench (view abilities, spend shards, tiers). |
| `src/game/scenes/UIScene.ts` | Ability-unlock reward card + shard counter on the HUD. |

---

## Phases (QA-gated: typecheck + build + qa:full green before each next)
- **Phase 0** — Progression data + save foundation (`upgrades.ts` metadata, Shards,
  unlocked lists, `config.PROGRESSION`). No visible change.
- **Phase 1** — Signature-ability grants: wire Miller Field's `pulse-resonance` reward
  end-to-end (boss → grant → reward card → applied to kit). Proves the whole channel.
- **Phase 2** — Signal Shards economy: drone drops + caches + HUD counter + Chip's
  Workbench (buy tiered stat upgrades) in the Command Center.
- **Phase 3** — Soft ability-gating + backtrack rewards (a few gated routes; tie some
  scout relics behind later abilities).
- **Phase 4** — Roll out per zone as zones are built: each boss grants its signature,
  each zone seeds shards.

---

## Guardrails (keep it lean)
- **One** signature ability per zone. **One** shop currency. **One** hub (the PROGRESSION
  panel). ~6 upgrade lines × 2 tiers. Resist a full skill tree.
- The base kit must beat every zone unaided — upgrades are power + optional routes.
- Reuse the existing `upgrades.ts` ids; don't invent parallel ability names.
- All numbers in `config.ts`; the Command Center renders live — keep statuses honest.

---

## Captured for later (curried-bachman deep-dive) — NOT built yet

- **Death remnant — "old signal" (Hollow Knight), Phase-2+ follow-on, forgiving only.**
  After the Shards economy ships (Phase 2), dying leaves a corrupted **old signal** at the
  death spot holding the Shards earned since your last save; walk back and reclaim it to
  recover them, and reclaiming also **resets classification to UNKNOWN** (a mercy, not a
  punishment). **Zero permanent loss** — PG and forgiving, no souls-like sting. Do NOT build
  until Phase 2 exists (there's nothing to drop yet), and never make it lose progress.
