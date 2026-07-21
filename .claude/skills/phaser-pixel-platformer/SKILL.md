---
name: phaser-pixel-platformer
description: Guides all Phaser implementation decisions for BLIP — low-res virtual canvas, top-down Arcade physics, grid collision, data-driven objects, centralized constants, Vercel-ready build. Consult before writing or changing any game engine code.
---

# Phaser Pixel Platformer

Purpose: guide all Phaser implementation decisions.

## Stack

- Vite + TypeScript + Phaser 3 (Arcade Physics). No other runtime game libraries unless they clearly help.
- Node 18 on this machine → Vite is pinned to 5.x. Do not bump to Vite 6/7 without checking Node.

## Rendering Rules

- Low-resolution virtual canvas: **480×270**, scaled up to fit the browser with crisp pixel rendering (`pixelArt: true`, `roundPixels: true`, CSS `image-rendering: pixelated`).
- All textures are generated at native pixel scale (16px tiles, ~14px player). Never draw sub-pixel.
- Camera follows the player with lerp; the top-down world uses tile/grid-based collision from `src/game/data/sweepArenas.ts`.
- Parallax background layers, screen shake, particles, and a readable HUD are required components of the feel.

## Code Rules

- Keep game objects simple and **data-driven** (levels, quests, zones, scouts, upgrades, command-center copy all live in `src/game/data/`).
- Centralize ALL tuning constants in `src/game/config.ts`: movement, jump, hover, dash, enemy speeds, damage, cooldowns, and colors. Never scatter magic numbers.
- Centralize texture keys in `AssetKeys` (config.ts) so procedural art can be swapped for real assets later.
- Destroy/clean up listeners, timers, and groups on scene shutdown. Cap bullets/enemies/particles.
- Cross-scene + shell communication goes through the singleton EventBus (`src/game/systems/EventBus.ts`).

## Build Rules

- Must stay Vercel-ready: static `dist` output, no server runtime, no Node APIs in client code, no hardcoded localhost URLs, localStorage for saves.
- `npm run typecheck` and `npm run build` must pass before a feature counts as done.
