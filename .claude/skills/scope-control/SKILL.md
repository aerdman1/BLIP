---
name: scope-control
description: Prevents feature creep in BLIP — the vertical slice (Miller Field) ships before anything else. Consult before adding any new system, zone, or content type.
---

# Scope Control

Purpose: prevent runaway feature creep.

## Rules

- Do NOT add extra zones until Miller Field is fun and complete.
- Do NOT add complex inventory today.
- Do NOT add crafting.
- Do NOT add dialogue trees.
- Do NOT add complex hand-made animations.
- Do NOT add procedural world generation beyond small reusable patterns.
- Do NOT add a WebGPU gameplay dependency (detection badge in Command Center only).
- Do NOT expand story cutscenes today (scout logs are short text popups, not cutscenes).
- Finish the vertical slice first: movement → Miller Field → scan reveal → Blipstream Node A → door unlock → Scarecrow Antenna → Signal Fragment → save → Command Center.

## Decision Test

Before adding anything, ask: "Does this make the 5–10 minute vertical slice more playable, more readable, or more polished?" If not, it goes in Command Center future-plans data instead of code.
