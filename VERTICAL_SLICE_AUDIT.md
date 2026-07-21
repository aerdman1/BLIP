# BLIP Vertical Slice Audit

Status: route-connected top-down arena foundation.

Companion planning map: `VERTICAL_SLICE_DESIGN.md`. The Command Center mirrors the same region identities and system statuses from `src/game/data/commandCenterData.ts`.

## World Size

The current route chain is large enough for a focused polished slice, but it is not one seamless open map. It is a sequence of separate top-down arena maps connected by fast breach handoffs with shared save/runtime state. It can support roughly 15-25 minutes of play now, and can reach 30-45 minutes only if pacing improves through stronger encounters, secrets, rewards, and a modest amount of targeted layout breathing room later.

Do not cram every future mechanic into the current rooms. The safer approach is:

- Keep the five existing route-connected regions as the current spine.
- Give each region one clear gameplay purpose.
- Add only small layout changes where combat or stealth needs more room.
- Defer large map expansion until the core loop is fun.

## Feature Fit

Fits now:

- Three distinct weapons.
- Fast weapon pickup/switching across keyboard, mouse wheel, gamepad and touch.
- Better hit feedback, stagger, and weapon identity.
- Clearer major loot presentation.
- Region objectives using existing nodes, caches, enemies, and route exits.
- One final combat challenge.

Needs a later scoped pass:

- Phase Shift as a full exploration/combat mechanic.
- Stealth routes with dedicated barriers and scanner logic.
- Weapon-specific secrets.
- Full weapon mutation trees and equip/store/salvage decisions.
- A true 30-45 minute pacing pass with a small amount of map rework.

## Safest Order

1. Final cleanup and single-save model.
2. Preserve runtime state across connected region transitions.
3. Narrow the live weapon foundation to Pulse Carbine, Arc Blade, and Recall Disc.
4. Improve major weapon pickup clarity.
5. Add Phase Shift with collision/barrier rules.
6. Add region-specific objectives and secrets only after the combat kit is stable.
