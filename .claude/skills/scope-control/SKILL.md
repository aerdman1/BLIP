---
name: scope-control
description: Prevents feature creep in BLIP — polish the connected top-down vertical slice before adding large new regions or systems.
---

# Scope Control

Purpose: prevent runaway feature creep.

## Rules

- Do NOT add large new regions until the connected top-down route is genuinely fun, readable, and stable.
- Do NOT add complex inventory today.
- Do NOT add crafting.
- Do NOT add dialogue trees.
- Do NOT add complex hand-made animations.
- Do NOT add procedural world generation beyond small reusable patterns.
- Do NOT add a WebGPU gameplay dependency (detection badge in Command Center only).
- Do NOT expand story cutscenes today (scout logs are short text popups, not cutscenes).
- Current baseline: Miller Surface → Motel Circuit → Chagrin Falls Town → Orchard Maze → Signal Storm is connected and top-down-only. Improve this route before expanding it.
- Phase Boost, stealth, weapon-specific secrets, crash-site onboarding, and mutation trees should land as scoped, tested passes rather than one giant rewrite.

## Decision Test

Before adding anything, ask: "Does this make the connected top-down baseline more playable, more readable, or more polished?" If not, it goes in Command Center future-plans data instead of code.
