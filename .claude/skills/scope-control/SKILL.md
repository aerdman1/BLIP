---
name: scope-control
description: Prevents feature creep in BLIP — the vertical slice (Miller Field) ships before anything else. Consult before adding any new system, zone, or content type.
---

# Scope Control

Purpose: prevent runaway feature creep.

## Rules

- Do NOT add large new regions until the connected top-down route is stable.
- Do NOT add complex inventory today.
- Do NOT add crafting.
- Do NOT add dialogue trees.
- Do NOT add complex hand-made animations.
- Do NOT add procedural world generation beyond small reusable patterns.
- Do NOT add a WebGPU gameplay dependency (detection badge in Command Center only).
- Do NOT expand story cutscenes today (scout logs are short text popups, not cutscenes).
- Finish the top-down baseline first: movement/combat → Miller Surface → Motel Circuit → Chagrin town connector → Orchard Maze → Signal Storm → save → Command Center.

## Decision Test

Before adding anything, ask: "Does this make the connected top-down baseline more playable, more readable, or more polished?" If not, it goes in Command Center future-plans data instead of code.
