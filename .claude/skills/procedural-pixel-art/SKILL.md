---
name: procedural-pixel-art
description: Art direction rules for BLIP — everything is generated pixel shapes, silhouettes, and palette-locked colors ("Dreamlike Rural Pixel Sci-Fi"). Consult before creating or modifying any texture, color, or visual effect.
---

# Procedural Pixel Art

Purpose: make the game look cool without real art assets.

## Scope exemption — TOP-DOWN levels

These rules govern the **side-view** game. The top-down "Sweep" arenas are a
DELIBERATE, APPROVED style break: HD stylized, non-pixel, LINEAR-filtered art
loaded from `public/assets/topdown/`, with real lighting and soft shadows.
Fiction: top-down is the Interpretation Engine's high-fidelity SCAN of you,
while side-view is your own memory — the Fold is the seam between them.

Do NOT "correct" the top-down levels back to pixel art. See
`TOPDOWN_VISUAL_SPEC.md` (rules), `ASSET_SOURCES.md` (CC0 provenance) and
`GENERATED_ASSETS.md`. Currently applied to `surface-z1` only, gated behind
`TD_VISUALS` in `src/game/config.ts`.

## Rules (side-view)

- ALL art must be buildable with simple generated shapes, pixelated textures, tile strips, gradients, particles, and silhouettes (Phaser Graphics / Canvas → `generateTexture`).
- Use generated grass tiles, dirt platforms, fence shapes, radio towers, scan equipment, crop-circle glyphs, drones, and signal nodes.
- Parallax backgrounds: huge dithered clouds, floating land chunks, radio tower silhouettes, far hills — all from simple pixel shapes.
- Strong silhouettes and lighting instead of detailed illustrations. **Never spend time drawing realistic objects when symbolic/procedural versions are enough.**
- Glow = layered alpha copies / additive blending, not blur filters.

## Palette (locked — use `PALETTE` in src/game/config.ts)

- sky/dusk: deep blue, cyan, pale cloud white
- ground: dark greens, moss, muted brown
- signal (friendly/interactive): cyan/green
- danger/classification: red/orange
- scout collectibles: Will **cyan**, Chip **orange**, Henry **green**, Cameron **purple**, Danny **red**

## Aesthetic Targets

- Dreamlike Rural Pixel Sci-Fi: lush fields at dusk, lonely radio towers, strange floating land, crop-circle symbols, red scan cones, green/cyan signal effects, glitch/CRT overlays.
- Motion sells everything: hover bob, cloud drift, scan ripples, particles, screen shake, glitch flashes.
