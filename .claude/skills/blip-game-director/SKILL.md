---
name: blip-game-director
description: Keeps BLIP aligned with the current game vision — top-down procedural pixel action, Dreamlike Rural Pixel Sci-Fi, CONTACT-47 vs the Interpretation Engine, Five Signal Scouts. Consult before designing or implementing any feature, art, story, or scope decision.
---

# BLIP Game Director

Purpose: keep the project aligned with the actual game vision. Consult this before any feature, art, or story work.

## The Vision

- The game is called **BLIP**. Tagline: "You are the thing on the radar." Subtitle: "A pixel signal adventure about staying unknown."
- BLIP is a **top-down-only** procedural pixel action game. The current foundation is a route-connected chain of separate top-down arena maps, not a seamless open map yet. Polish this route before rebuilding or expanding it.
- The player is **CONTACT-47**, an unknown signal/contact escaping classification.
- The enemy is **classification/interpretation itself** (The Interpretation Engine), not just "bad guys." Drones and cones are trying to *label* you.
- Route progression runs through **Signal Nodes** and breaches. Collectibles are **Signal Fragments**.
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

- **Scan** — reveals caches and scout trails (exploration) AND stuns drones caught in the pulse + exposes weak points (combat).
- **Dash (Phase Drift)** — crosses danger lanes and slips through security beams with i-frames (traversal/stealth) AND ROCKET's phase-strike damages drones (combat).
- **Weapons** — Pulse Carbine pressures at range, Arc Blade creates melee/parry risk-reward, and Recall Disc rewards positioning. Fast switching is part of the combat identity. Future weapons should usually be mutations of these before becoming new standalone weapons.
- **Overdrive** — clears a swarm to open space (survival) AND creates a short rapid-fire push for the node (combat).

When a verb only does one job, that's a gap to close — not a reason for a new button.

## Design Rules — Secrets, Collectibles & Placement Legibility (learned the hard way, 2026-07-11)

Apply these when authoring ANY zone's secrets/collectibles (scan-secrets, scout items, caches):

1. **Spacing: one scan = one thing.** Keep scannable items **> 1 scan radius apart** (`SCAN.radius`
   is 150px; keep them ~200px+ apart) so a single pulse never claims two at once — overlapping
   claims fire stacked transmissions and read as chaos.
2. **Claimed = visibly done.** Every scannable/collectible MUST change state on claim: cues **pop
   + fade away** or otherwise visibly retire. Persistent props should **dim/tint green** or clearly show a claimed state. Never leave a claimed item looking identical to an unclaimed one.
3. **Reachability is math, not vibes.** Every intended route must fit the top-down player radius,
   dash distance, scan radius, and camera scale. Never place a reward the base kit cannot reach.
4. **No signage without payoff.** A marker/arrow/glow must point at something real and obtainable.
   Decorative markers that promise a reward (the "stranded WILLOW chevron" bug) read as broken.
5. **Tutorialize in Zone 1 only.** Miller Surface teaches `[Q] SCAN`; later zones assume the verb is learned.
