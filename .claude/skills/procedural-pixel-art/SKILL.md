---
name: procedural-pixel-art
description: Art direction rules for BLIP — everything is generated pixel shapes, silhouettes, and palette-locked colors ("Dreamlike Rural Pixel Sci-Fi"). Consult before creating or modifying any texture, color, or visual effect.
---

# Procedural Pixel Art

Purpose: make the game look cool without real art assets.

## Rules

- BLIP is top-down. Art must support readable 8-direction movement, y-sorted actors, cover, routes, gates, barriers, pickups, drones, and signal nodes.
- Most art should be buildable with generated shapes, pixelated textures, tile strips, gradients, particles, and silhouettes (Phaser Graphics / Canvas → `generateTexture`).
- The higher-detail top-down path may use authored assets from `public/assets/topdown/` when already wired through `TD_VISUALS`.
- Use generated grass, asphalt, orchard rows, town walls, fences, radio towers, scan equipment, crop-circle glyphs, drones, pickups, and signal nodes.
- Strong silhouettes and lighting instead of detailed illustrations. **Never spend time drawing realistic objects when symbolic/procedural versions are enough.**
- Glow = layered alpha copies / additive blending, not blur filters.
- Mature-tone rule: keep the color, but make threat areas harder-edged with deeper shadows, damaged streets, smoke, scorched ground, broken machinery, emergency lighting and hostile red classification shapes.
- Ordinary actions should not look like confetti or toys. Combat should read as sparks, debris, electrical rupture, oil-dark scorch and forceful silhouettes.

## Palette (locked — use `PALETTE` in src/game/config.ts)

- sky/dusk: deep blue, cyan, pale cloud white
- ground: dark greens, moss, muted brown
- signal (friendly/interactive): cyan/green
- danger/classification: red/orange
- scout collectibles: Will **cyan**, Chip **orange**, Henry **green**, Cameron **purple**, Danny **red**

## Aesthetic Targets

- Dreamlike Rural Pixel Sci-Fi: lush fields at dusk, lonely radio towers, damaged Chagrin Falls roads, strange floating land, crop-circle symbols, red scan cones, green/cyan signal effects, glitch/CRT overlays.
- Motion sells everything: actor bob, cloud drift, scan ripples, sparks, debris, screen shake, glitch flashes and lingering environmental damage.
