---
name: blip-game-director
description: Keeps BLIP aligned with the current game vision — top-down procedural pixel action, Dreamlike Rural Pixel Sci-Fi, CONTACT-47 vs the Interpretation Engine, Five Signal Scouts. Consult before designing or implementing any feature, art, story, or scope decision.
---

# BLIP Game Director

Purpose: keep the project aligned with the actual game vision. Consult this before any feature, art, or story work.

## The Vision (pivoted 2026-07-20)

- The game is called **BLIP**. Tagline: "You are the thing on the radar." Subtitle: "A pixel signal adventure about staying unknown."
- BLIP is now a **top-down-only** procedural pixel action game. The previous side-view spine and Fold-back structure are removed from live access. The existing Sweep arenas are the foundation of the whole game and should be connected, expanded, and polished rather than rebuilt from scratch.
- The player is **CONTACT-47**, an unknown signal/contact escaping classification.
- The enemy is **classification/interpretation itself** (The Interpretation Engine), not just "bad guys." Drones and cones are trying to *label* you.
- The puzzle dimension is the **Blipstream** (Blipstream Nodes / Blipstream Rooms). Collectibles are **Signal Fragments**.
- Core vibe: **Dreamlike Rural Pixel Sci-Fi** — lush pixel fields at dusk, huge clouds, lonely radio towers, floating land chunks, crop-circle glyphs, red scan cones, cyan/green signal effects, glitch overlays, mysterious government tech.
- The **Five Signal Scouts** (Will/WILLOW-cyan, Chip/SPARK-orange, Henry/ANCHOR-green, Cameron/ECHO-purple, Danny/ROCKET-red) are the heart of the story: five best friends/cousins who understood the Signal first and left a trail. Wholesome, brave, funny, clever — never victims, never dark. Tone stays PG, adventurous, mysterious, heartfelt.

## Hard Rules

- Do NOT build a generic UFO cow-abduction game. Top-down means action/exploration/combat through Chagrin Falls-inspired spaces, not farm sim chores.
- Do NOT build detailed illustrated barns/cars/cows or realistic art of any kind.
- Do NOT rely on hand-painted assets or complex sprite sheets.
- DO use procedural pixel art, tile shapes, parallax, particles, scan effects, silhouettes, and UI overlays.
- No BEAMLINE branding anywhere user-facing (legacy save-migration code is the only exception).
- Prioritize a stable connected top-down route over scope expansion, always.

## Design Principle — Double-Duty Verbs (Dead Cells)

Every player verb must have a **combat** job AND a **traversal/stealth** job — one input, two uses — so the kit stays tiny but deep. This is a house rule: before adding a new verb, first ask whether an existing verb can carry the job.

- **Scan** — reveals hidden platforms & scout trails (traversal) AND stuns drones caught in the pulse + exposes boss cores (combat).
- **Dash (Phase Drift)** — crosses gaps & slips through security cones with i-frames (traversal/stealth) AND ROCKET's phase-strike damages drones (combat).
- **Pulse Shot** — trips node switches & powers neon platforms (traversal/puzzle) AND damages drones/boss cores (combat).
- **Hover** — reaches ledges & feathers falls (traversal) AND repositions off a drone's gun line (combat spacing).

When a verb only does one job, that's a gap to close — not a reason for a new button.

## Design Rules — Secrets, Collectibles & Placement Legibility (learned the hard way, 2026-07-11)

Apply these when authoring ANY zone's secrets/collectibles (scan-secrets, scout items, caches):

1. **Spacing: one scan = one thing.** Keep scannable items **> 1 scan radius apart** (`SCAN.radius`
   is 150px; keep them ~200px+ apart) so a single pulse never claims two at once — overlapping
   claims fire stacked transmissions and read as chaos.
2. **Claimed = visibly done.** Every scannable/collectible MUST change state on claim: cues **pop
   + fade away** (`retireSecretCue` in `systems/Secrets.ts`), persistent props **dim/tint green**
   (see `SignalBox.markScanned`). Never leave a claimed item looking identical to an unclaimed one.
3. **Reachability is math, not vibes.** Base jump apex ≈ **40px (2.49 tiles)**; hover only slows
   falls, dash is horizontal. Every intended climb steps **≤ 2 rows (32px)** per hop. Never place
   a reward the base kit can't reach (skin/ability-gated routes must be flagged as such).
4. **No signage without payoff.** A marker/arrow/glow must point at something real and obtainable.
   Decorative markers that promise a reward (the "stranded WILLOW chevron" bug) read as broken.
5. **Tutorialize in Zone 1 only.** Miller Field shows `[Q] SCAN` prompts over scannable items
   (see `FieldScene.buildScanHints`); later zones assume the verb is learned — don't re-prompt.
