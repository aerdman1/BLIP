# Top-down visual overhaul — results

Scope delivered: **`surface-z1` ("The Surface · Area 47") only.** Side-scrolling levels are
untouched. See [`TOPDOWN_VISUAL_SPEC.md`](TOPDOWN_VISUAL_SPEC.md) for the rules and
[`TOPDOWN_VISUAL_PLAN.md`](TOPDOWN_VISUAL_PLAN.md) for the phase plan this followed.

## What shipped

| Area | Result |
|---|---|
| Render | Scene-local hi-res backbuffer (1440×810 desktop / 960×540 touch) with camera zoom scaled by the same density, so the **visible world region is unchanged** and no gameplay tuning moved. Restored to 480×270 on `SHUTDOWN`. |
| Depth | Y-sorted depth bands (`src/game/render/Depth.ts`); actors, props and walls sort on their **feet**, giving real occlusion. |
| Terrain | Layered tiling from CC0 photoscans + masked organic paths + extruded walls (top cap + face strip) + baked directional wall shadows. |
| Actors | HD CONTACT-47, 8 drones and the Classifier elite, each with a separate additive emissive layer and a pooled contact shadow. Hitboxes, AI, speeds and damage untouched. |
| Node | `SignalNodeRig` — plinth, emissive core, vertical beacon shaft and ground rings, all driven by charge fraction, shifting green → cyan at full. |
| Lighting | Multiply-darkness layer + pooled additive radial lights + drifting fog. No Light2D, no bloom (both rejected for documented reasons). |
| HUD | 100% DOM, four panels (objective / vitals / overdrive / abilities). Status strip and instruction ticker suppressed in top-down only. |
| Assets | 575 KB total, all CC0, all same-origin, license-verified. |

## Assets

- **Sources:** ambientCG, Poly Haven, Kenney — all site-wide CC0, no attribution required, each
  original SHA-256'd. Full provenance in [`ASSET_SOURCES.md`](ASSET_SOURCES.md).
- **Generated:** CONTACT-47, the drones, the elite and the Node are authored by
  `scripts/art/author-actors.py` (Python/PIL) — no CC0 pack contains these characters, and a
  generic drone would have read as asset-flipped. Documented in
  [`GENERATED_ASSETS.md`](GENERATED_ASSETS.md).
- **Verifiers:** `node scripts/art/verify-licenses.mjs` and `node scripts/art/check-links.mjs`
  both exit non-zero on failure and were negative-tested.

## Things that went wrong, and what they cost

Recorded because each was found by *looking at the running game*, not by reasoning — and each
would silently recur.

1. **A missing asset hung the boot screen.** A dev server answers a missing file with `200` +
   `index.html`; Phaser "loads" it, fails to parse, and retries forever. Fixed by probing and
   validating the manifest with `fetch` before queueing anything, and by loading off `create()`
   so boot never blocks on art.
2. **`force-cache` pinned that bad response,** keeping the art disabled across reloads. Now uses
   default HTTP caching.
3. **The multiply-darkness layer rendered the arena at ~3% brightness.** `Rectangle`'s 6th
   constructor argument is *fill* alpha, which does not attenuate a `MULTIPLY` blend — the
   strength has to be baked into the fill *colour*.
4. **The spec's ground value range (0.06–0.22) was wrong.** Correct in isolation, unplayable once
   the darkness layer, baked shadows and canopy stacked on top. Re-graded at the source to
   ~0.14–0.42 rather than compensating with runtime hacks.
5. **`artScale` did not exist.** Art authored at 2× was rendering at 2×, so 230 px canopy sprites
   blacked out a 585 px viewport. Now a single constant every td draw path applies.
6. **Cell-stamped ground left a visible rectangular grid** — the exact prototype look being
   removed. Replaced with mismatched-period layered tiling; paths use a `BitmapMask` instead of
   per-hall rectangles.
7. **Ground repeat at 64 px minified the 512² scans 8×** into aliased static. Raised to 256 px.

## Verification

- `npm run typecheck`, `npm run build` — clean.
- `tests/topdown-visual.spec.ts` — asset integrity (no `__MISSING` keys, no off-origin requests,
  no 404s), objective flow through breach → Fold → Miller Field, **no backbuffer leak on any exit
  path**, and side-view shell chrome restored on exit.
- `tests/topdown-capture.spec.ts` — storyboard + responsive + a side-view regression reference into
  `test-results/screenshots/qa-reports/topdown/`.
- Side-view zones confirmed rendering at 480×270 with pixel art, status strip and ticker intact.

## Known gaps

- `td-fern` and `td-tuft` derive from similar Kenney silhouettes and read alike at ~20 px. One-line
  fix in `KENNEY_PICKS` if it bothers you.
- The elite/boss beam and Overdrive VFX still use the shared `EffectsSystem` look rather than
  bespoke td treatments — deliberate, to avoid touching shared code.
- Not yet profiled on real iPad hardware; quality tiers are wired but only desktop-measured.
- **Not deployed.** See the deployment note in the plan: deploy only from `/Users/aerdman/BLIP`,
  and this adds the first real binary assets, so confirm `public/assets/topdown/` serves
  same-origin and the service worker's `CORE_URLS` update took effect.

## Reusing this for the next top-down arena

1. Add the arena id to `TD_VISUALS.arenas` in `src/game/config.ts`.
2. Add its biome materials to `scripts/art/process.py` and re-run it, then `build-atlas.mjs`.
3. Point that biome at the new keys in `SweepScene`'s `BIOME_ART` table.
4. Nothing else. Terrain, lighting, shadows, depth sorting, rigs and the HUD are arena-agnostic —
   `TdTerrain` takes the room/hall/marker data it is given.

Flip `TD_VISUALS.enabled = false` at any time to render the Sweep exactly as it did before.
