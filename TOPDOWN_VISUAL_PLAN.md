# TOPDOWN VISUAL PLAN — BLIP

Phased execution plan for the top-down visual overhaul. Read
[`TOPDOWN_VISUAL_SPEC.md`](TOPDOWN_VISUAL_SPEC.md) first — it holds the inspection results,
the shared-code rules, the isolation boundary and the acceptance criteria, and is not
repeated here.

**Scope: `surface-z1` only. Side-scrolling levels must not change.**

### Direction decisions (confirmed with the user, do not relitigate)

1. **Art style — HD stylized, a clear break.** Top-down goes non-pixel: LINEAR-filtered HD
   art, soft shadows, real lighting. Side-view stays pixel art. The Fold is the in-fiction
   justification — top-down is the Interpretation Engine's high-fidelity SCAN of you.
2. **Character art — offline Python/PIL authoring, committed.** No text-to-image generator
   exists in this environment (verified: no ImageMagick, no `sharp`/`canvas`, no image-gen
   MCP; Python PIL 11.3.0 + numpy 2.0.2 + ffmpeg present). Terrain, foliage and rock come
   from verified CC0 photoscans; CONTACT-47 and the drones are authored by a committed
   `scripts/art/` PIL toolchain.

### Global rules for every phase

- Work on branch `claude/topdown-visual-overhaul`. One commit per phase — that commit is the
  rollback point.
- Run `npm run typecheck && npm run build` before every commit.
- Capture screenshots at every visual checkpoint and **review them critically against the spec
  before proceeding**. A captured screenshot is not a passed checkpoint.
- Never present an obvious placeholder as final.
- **Deployment is out of scope** for this plan — see the note at the end.

---

## Phase 1 — Repository and scene isolation

**Files changed**: `src/game/config.ts` (additive), `src/game/data/sweepArenas.ts` (add an `id`
field if absent)
**New**: `src/game/render/` and `src/game/topdown/` directories, `src/game/topdown/TdFlags.ts`

**Tasks**
1. Add `TD_VISUALS = { enabled: true, density: {desktop: 3, touch: 2}, quality: 'auto' }` to
   `config.ts`.
2. Add a `TD_PALETTE` block and a `TEX.td*` namespace. Do **not** overload `TEX.sweep*`.
3. Add a single gate helper `useTdVisuals(arena)` → `TD_VISUALS.enabled && arena.id === 'surface-z1'`.
4. Convert the biome ternaries at `SweepScene.ts:252-256` into a `BIOME_ART` lookup table. Motel
   and orchard continue to resolve to existing `sweepTextures.ts` keys, unchanged.
5. Baseline capture: run `npm run qa:playtest` on `main` and archive the screenshots as the
   regression reference for Phases 2, 7 and 11.

**Assets**: none.
**Validate**: `npm run typecheck && npm run build && npm run test:e2e`.
**Checkpoint**: the game runs identically to `main`; `surface-z1` is unchanged.
**Risk**: the ternary → table refactor silently redirects a biome. Mitigate — this phase is
behaviour-neutral by construction; diff the resolved keys per biome and assert equality.
**Rollback**: `git tag td-phase-1`.
**Done when**: zero visual change, flag plumbed, baseline archived.

---

## Phase 2 — Visual foundation and rendering systems

**Files changed**: `src/game/scenes/SweepScene.ts` (camera + depths), `src/game/scenes/UIScene.ts`
(RESIZE handler), `src/game/scenes/BootScene.ts` + `MainMenuScene.ts` (defensive restore),
`src/style.css` (one rule)
**New**: `src/game/render/RenderScale.ts`, `Depth.ts`, `Oblique.ts`, `TopDownShadows.ts`

**Tasks**
1. `RenderScale.ts` — `enterHiRes(game, d)` / `restoreBase(game)` / `density(scene)`. Call
   `enterHiRes` at the **top of `SweepScene.create()`** — before `buildSweepTextures`, and never
   in a `delayedCall`, so an iOS rotation refit cannot interleave. Call `restoreBase` from the
   existing `SHUTDOWN` handler (`SweepScene.ts:225`); it is the only hook covering every exit path
   (breach, death → GameOverScene, quit-to-menu, dev warp) with one call.
2. Defensive `restoreBase()` in `BootScene.create` and `MainMenuScene.create`, plus a dev assertion
   if `scale.width !== 480` outside SweepScene.
3. **`UIScene`**: add a `Phaser.Scale.Events.RESIZE` listener re-applying
   `cam.setZoom(width / VIEW_W).centerOn(VIEW_W/2, VIEW_H/2)`. *This is the highest-risk edit in
   the plan — it lives in a shared file for a reason unrelated to the sweep and is the change most
   likely to be missed in review.* Verify all seven platformer HUDs afterwards.
4. Sweep camera: zoom `d * SWEEP.cameraZoom`, and `setRoundPixels(false)` on this camera only.
5. `src/style.css`: `body.sweep-active #game-root canvas { image-rendering: auto; }` —
   `image-rendering: pixelated` (`style.css:216`) produces harsh aliasing on a downscale.
6. `Depth.ts` — the depth bands and helpers from spec §4. **Migrate the ~35 existing `setDepth`
   call sites 1:1 as a standalone behaviour-neutral commit before introducing y-sorting.** Current
   depths are already monotone in the intended draw order, so the mapping is mechanical.
7. Enable y-sorting per spec §4.
8. `Oblique.ts` — `OBLIQUE.k = 0.55`, base-anchored placement helper, wall-extrusion helper, lens tilt.
9. `TopDownShadows.ts` — pooled dynamic ellipse shadows from a LINEAR radial-gradient canvas
   texture at `DEPTH.shadow`, `setScale(w, w * k)`, offset along one global light direction by
   caster height. Static shadows are baked in Phase 4. **New system — do not generalize
   `VisualFX`'s shadows**; they project onto `surfaceYAt(x)` from the side-view `LevelDef` and the
   coupling is total.

**Assets**: shadow and light gradient textures (runtime canvas).
**Validate**: `npm run typecheck && npm run build && npm run test:e2e`; manual pass through **all
seven** side-view zones; enter and exit the sweep by breach, by death, and by quit-to-menu.
**Checkpoint**: the sweep is visibly sharper with correct occlusion at unchanged framing; every
side-view HUD and scene is pixel-identical to the Phase 1 baseline.
**Risks**: (1) a leaked resize → the next scene renders tiny in the top-left; (2) the UIScene zoom
compensation missed → all seven platformer HUDs break; (3) depth migration off by one band.
**Rollback**: `git tag td-phase-2`.
**Done when**: HD backbuffer live, y-sorting correct, side-view proven unchanged.

---

## Phase 3 — Autonomous asset acquisition and generation

**Files changed**: `.gitignore`, `package.json` (art scripts), `public/sw.js` (`CORE_URLS`)
**New**: `scripts/art/` (`fetch-sources.mjs`, `process.py`, `author-actors.py`, `build-atlas.mjs`,
`verify-licenses.mjs`, `check-links.mjs`), `public/assets/topdown/`, `ASSET_SOURCES.md`,
`GENERATED_ASSETS.md`

### Sources — verified live during planning, all site-wide CC0, no attribution required

| Source | Verification | Covers |
|---|---|---|
| **ambientCG** `https://ambientcg.com/` | API confirmed: `/api/v2/full_json?id=Grass004&include=downloadData` returns real download links | Ground, grass, soil, rock, bark albedo |
| **Poly Haven** `https://polyhaven.com/textures` | `https://api.polyhaven.com/assets?t=textures` → 782 assets incl. `aerial_grass_rock`, `aerial_ground_rock`, `aerial_rocks_01/02/04` | **Top-down aerial ground — exact camera match** |
| **Kenney** `https://kenney.nl/assets/foliage-sprites`, `/particle-pack`, `/game-icons` | all 200; pages carry `CC0 licensed!` | Foliage, props, debris, icon reference |

OpenGameArt is **fallback only** — it is per-asset licensed and mixes CC-BY/GPL into CC0 search
results; any asset taken from it needs its own license URL recorded. Note that
`kenney.nl/assets/topdown-shooter` is a **404**; the correct slug is `top-down-shooter` — exactly
the class of error the link checker exists to catch.

### Per-category decisions

Rule: anything the player reads as a *physical object* gets real art; anything read as *light or
interface* gets code.

| Category | Strategy |
|---|---|
| Terrain materials | **Source CC0 + PIL composite.** Poly Haven aerial + ambientCG grass/soil/rock. Night-grade to `TD_PALETTE`, verify seamless tiling, emit 512² WebP. Biggest single win |
| Terrain edge / cliff pieces | **Derive.** PIL cuts edge strips from the same albedos, normal-map-driven directional relight, baked contact AO |
| Foliage, ferns, grass tufts | **Source CC0.** Kenney Foliage Sprites — top-down-friendly, pre-alpha-cut. PIL: palette-grade + soft drop shadow |
| Trees / canopy | **Source + derive.** Kenney canopies upscaled, PIL radial-falloff relight for a lit crown and dark underside — the main dimensional cue in a top-down forest |
| Rocks, logs, roots, debris | **Source + derive.** Same rock albedos, PIL-cut to blobs with baked AO under one fixed light direction (upper-left, matching the existing `sweepTextures.ts` convention) |
| **CONTACT-47, 8 drones, Classifier elite** | **Generate — PIL, committed.** No CC0 pack contains CONTACT-47, and a generic Kenney drone is the one place this overhaul would read as asset-flipped. `author-actors.py` builds layered sprites with real gradient shading, rim light, chassis specular and a baked shadow. Emissives (visor, eyes) stay separate additive layers so they pulse at runtime |
| Signal node | **Generate — PIL.** Story-critical hero prop; must be on-model |
| HUD icons | **Code (runtime canvas).** Must stay crisp at any scale and recolour per state |
| Particles | **Code.** Radial gradients; already correct |
| Shadows / masks | **Code.** Pure math; a PNG would be strictly worse — bigger, and unable to rescale to arbitrary light radii |

### Pipeline

- **Location** `public/assets/topdown/`, mirroring the `public/assets/portraits/` precedent. Vite
  copies `public/` verbatim and Phaser's loader wants stable runtime URLs — **not** `src/assets/`
  with `?url`, which would hash assets into the JS graph.
- **Format** WebP, no PNG fallback. Lossy q82 for organic material; lossless for actor sprites with
  hard alpha edges.
- **One sprite atlas** `topdown-z1.webp` + `.json` (Phaser JSON Hash) for actors, foliage, props and
  debris. **Ground and wall tiles stay individual files** — `tileSprite` needs real texture wrap,
  which atlas frames cannot provide, and `SweepScene.ts:306` already depends on it.
- **Load in `BootScene`** alongside the existing procedural generation — not in a
  `SweepScene.preload()`, which would block and re-run on every arena entry. `buildSweepTextures()`
  keeps its `textures.exists` guard.
- Atlas **frame names must equal `TEX.td*` values** so lookup stays uniform.
- On load complete, `setFilter(LINEAR)` on **`td*` keys only**. Never on `TEX.glow8` / `px` /
  `spark` / `ring` — they are shared with every side-view scene, and `SweepScene` alone uses
  `glow8` in eleven places. Generate `td-glow` / `td-spark` aliases instead. **Enforce by naming
  convention, not by vigilance.**
- **Content-hash filenames** (`topdown-z1.a3f19c.webp`). This matters more than usual: `public/sw.js`
  serves non-JS/CSS **cache-first**, so a redeploy reusing a filename serves stale art until the
  background refresh lands. Also add the topdown set to `CORE_URLS` so the level works offline —
  currently only portraits and icons are precached.

**Validate**: `node scripts/art/verify-licenses.mjs && node scripts/art/check-links.mjs`; asset
budget assertion.
**Checkpoint**: an HTML contact sheet of every acquired and generated asset, reviewed for palette
coherence and consistent light direction **before** any integration.
**Risks**: a source goes offline (mitigate — commit originals + SHA-256, never re-fetch at build);
PIL output looks flat (mitigate — the contact-sheet review gate); byte budget blown.
**Rollback**: `git tag td-phase-3`.
**Done when**: all assets are in-repo, both docs are complete, both verifiers are green.

### Verification procedures established in this phase

`verify-licenses.mjs` fails the build unless:
1. Every file under `public/assets/topdown/` has a row in `ASSET_SOURCES.md` (external) or
   `GENERATED_ASSETS.md` (PIL-produced), matched by exact path.
2. Every `ASSET_SOURCES.md` row carries: source URL, license (must be in the CC0 allowlist),
   attribution-required flag, retrieval date, SHA-256 of the downloaded original.
3. Every `GENERATED_ASSETS.md` row names the producing script and its input assets, so derived work
   traces back to a CC0 root.
4. Any OpenGameArt-origin row additionally carries a per-asset license URL.

`check-links.mjs`:
1. `curl -sIL -w %{http_code}` every URL in both docs; non-200 fails.
2. `grep -rE "https?://" src/` for any remote URL reaching a Phaser loader — zero tolerance.

---

## Phase 4 — Terrain and environment overhaul

**Files changed**: `src/game/scenes/SweepScene.ts` (`buildMap` 248-397)
**New**: `src/game/topdown/TerrainBuilder.ts`, `PropScatter.ts`, `GroundBake.ts`

**Tasks**
1. `GroundBake.ts` — assemble the ground into one RenderTexture at build: noise-weighted
   multi-material blend, paths, decals, and **baked static shadows** for walls, props and the
   bunker (long directional, zero runtime cost — this is where the "real shadows" impression comes
   from).
2. `TerrainBuilder.ts` — wall extrusion per spec §4 (top cap + upward face strip, depth-sorted by
   base y). **Physics bodies unchanged** — keep the existing merged static rects exactly.
3. Irregular edges: alpha-masked foliage skirts, rocks and roots straddling every room/hall
   boundary until no rectangle is visible.
4. `PropScatter.ts` — deterministic seeded scatter (so screenshots are reproducible),
   density-mapped, **respecting the existing `clearOf()` marker clearance and the combat lanes**.
5. Foreground canopy layer the player passes beneath, at `DEPTH.foreground`.

**Assets**: the Phase 3 terrain, foliage, rock and prop sets.
**Validate**: typecheck, build, `npm run test:e2e`; **walk the full arena** confirming no collision
change.
**Checkpoint**: screenshots at spawn, mid-arena, node, breach and all four map corners. Review
against spec §4 — specifically "no rectangular edge visible" and "no two regions match".
**Risks**: props blocking combat lanes or the spawn → node → breach route; bake memory at d=3 (the
arena is 1088×640 world units — bake at authoring density, not backbuffer density).
**Rollback**: `git tag td-phase-4`.
**Done when**: terrain matches spec, layout and collision provably unchanged.

---

## Phase 5 — Contact-47, enemies, and signal node

**Files changed**: `src/game/entities/sweep/BlipCraft.ts`, `SweepEnemy.ts`, `SweepScene.ts`
(node/breach/elite construction: 365-370, 400-455, 484-620)
**New**: `src/game/topdown/ActorRig.ts`, `SignalNodeRig.ts`

**Tasks**
1. `ActorRig.ts` — wraps an actor with a base-anchored HD sprite, a separate additive emissive
   layer, a pooled contact shadow, and an optional light contribution. One rig class serves player,
   drones and elite.
2. Swap `BlipCraft` and `SweepEnemy` visuals to rigs. **Hitboxes, speeds, AI, damage and animation
   timing are untouched.** Render swap only.
3. `SignalNodeRig.ts` — per spec §6: tiered plinth, emissive core, vertical light shaft, ground
   rings scaled by `OBLIQUE.k`, all driven by `nodeCharge / chargeTarget`. The Breach mirrors it in
   dormant grey.
4. The elite reads visibly larger and heavier; its beam telegraph gains a light contribution.
5. Silhouette test: screenshot every actor black-tinted at 50% size; each must remain identifiable.

**Assets**: the Phase 3 actor and node sprites.
**Validate**: typecheck, build, `npm run test:e2e` (including `tests/game-over-retry.spec.ts`,
`scan-stun`, `echo-blink`); a full combat playthrough of `surface-z1`.
**Checkpoint**: combat screenshots — engaged, dashing, elite beam charging, node at 0% / 50% / 100%.
**Risks**: a sprite scale change alters the perceived hitbox and makes combat feel unfair (mitigate
— overlay physics debug and confirm the visual footprint matches the body); emissive layers
desyncing on death.
**Rollback**: `git tag td-phase-5`.
**Done when**: actors read HD and dimensional; gameplay is measurably identical.

---

## Phase 6 — Lighting, shadows, atmosphere and VFX

**Files changed**: `SweepScene.ts`, `src/game/render/TopDownShadows.ts`
**New**: `src/game/topdown/TdLighting.ts`, `TdAtmosphere.ts`, `TdVfx.ts`

**Tasks**
1. `TdLighting.ts` — arena-wide multiply darkness layer + pooled additive radial lights (Node
   dominant, beacon, breach, player, drone eyes, muzzle flashes). Light count gated by quality tier.
2. Enable static shadow baking (the Phase 4 hook) plus dynamic pooled shadows; hover shadows detach
   and soften with hover height.
3. `TdAtmosphere.ts` — localized drifting fog sheets in hollows and near the Node; atmospheric
   perspective on distant foliage (desaturate + blue-shift).
4. `GradeFX` on the sweep camera for grade + vignette. **No bloom** — see spec §7.
5. `TdVfx.ts` — upgrade muzzle, impact, death, dash, scan and overdrive per spec §8, each with a
   light contribution.

**Assets**: fog sheets, light gradients, ring masks — all runtime canvas.
**Validate**: typecheck, build, e2e; **profile in Chrome DevTools** — assert ≤ 4 full-screen passes,
≤ 250 draw calls, ≤ 400 display-list items.
**Checkpoint**: screenshots of night ambience, combat under fire, overdrive active, node full-charge
bloom. Verify no effect obscures the player or an incoming projectile.
**Risks**: the darkness layer making combat unreadable (mitigate — a minimum-ambient floor so the
player is never below a legibility threshold); overdraw blowing the iPad budget.
**Rollback**: `git tag td-phase-6`.
**Done when**: the scene reads atmospheric and cinematic within budget.

---

## Phase 7 — HUD replacement

**Files changed**: `src/game/scenes/UIScene.ts` (sweep-mode paths only, 105-290), `src/style.css`
(new `body.sweep-active` scope), `index.html` (sweep-scoped hiding only), `src/ui/ShellUI.ts`
(sweep hooks)
**New**: `src/ui/TdHud.ts`, `src/ui/tdHud.css`, `src/ui/tdHudIcons.ts`

**Tasks**
1. Build `#td-hud` per spec §9: objective card, health/energy/weapon card, overdrive meter, ability
   strip, transient alerts. **100% DOM** — migrate the residual Phaser `sweepG` HP bar in, so
   nothing is backbuffer-scaled.
2. Delete the dead Phaser sweep text objects in `setSweepMode` (created then permanently hidden).
3. Resolve the duplicated controls string (`buildSweepDom:157` vs `drawSweepHud:283`, currently
   disagreeing) — one source of truth.
4. Under `body.sweep-active`: hide `#status-strip` and the duplicate objective readout; convert
   `#objective-hint` to a one-shot dismissed on first input; surface fragments and classification in
   the pause screen instead.
5. `tdHudIcons.ts` — code-generated, crisp, scalable ability and status icons.
6. **Prove side-view UI unchanged** — every new CSS rule scoped, verified by diffing side-view HUD
   screenshots against the Phase 1 baseline.

**Assets**: none (all code-generated).
**Validate**: typecheck, build, `npm run test:e2e` — note that `tests/game-over-retry.spec.ts`
asserts `#sweep-hud-dom`; update that selector deliberately, not incidentally.
**Checkpoint**: HUD screenshots at desktop / tablet / mobile-landscape / mobile-portrait; measure
the HUD's frame coverage and confirm ≤ 12%.
**Risks**: an unscoped CSS rule leaking into side-scrolling UI — the single most likely regression
in this phase; a test selector breaking silently.
**Rollback**: `git tag td-phase-7`.
**Done when**: the HUD matches spec, no information appears twice, side-view UI is provably identical.

---

## Phase 8 — Responsive and performance work

**Files changed**: `src/ui/tdHud.css`, `src/ui/TouchControls.ts` (sweep overrides only),
`src/game/render/RenderScale.ts`, `src/game/config.ts` (quality tiers)

**Tasks**: density auto-selection by device; quality tiers (`low` → fewer lights, no grain, shadow
cap 12); merge the ability strip into the touch cluster on mobile rather than duplicating it;
safe-area insets; verify the `ShellUI` refit path (308-336) still behaves across rotation with a
resized backbuffer.
**Validate**: `npm run test:e2e` including `tests/mobile-touch.spec.ts`; measure fps at each
breakpoint.
**Checkpoint**: screenshots at 1920×1080 / 1280×800 / 1024×768 / 844×390 / 390×844.
**Risks**: iOS rotation racing the resize — mitigate by keeping `enterHiRes` in `create()` only,
never deferred.
**Rollback**: `git tag td-phase-8`.
**Done when**: 60 fps desktop / ≥ 45 fps iPad-class, all breakpoints correct.

---

## Phase 9 — Automated gameplay testing

**Files changed**: `tests/`
**New**: `tests/topdown-visual.spec.ts`

**Tasks**: a full `surface-z1` playthrough via `TestAPI` (`enterSweep`, `getSweepState`,
`debugSkipToBreach`) — spawn → combat → elite → node charge → breach → Fold to Miller Field.
Assert unchanged objective flow, kill counts, charge behaviour and exit. Assert every `TEX.td*` key
resolves to a real texture and is **not** Phaser's `__MISSING` placeholder — this catches atlas
frame-name drift, the most likely silent failure. Hook `page.on('request')` and assert every image
request is same-origin `localhost:4173` with zero 404s. Assert no resize leak (`scale.width === 480`
after exiting the sweep).
**Validate**: `npm run qa:full`.
**Checkpoint**: green suite; `test-results/qa-reports/latest.md` clean.
**Rollback**: `git tag td-phase-9`.
**Done when**: gameplay parity and asset integrity are machine-verified.

---

## Phase 10 — Screenshot-based visual review and correction

**Files changed**: whatever the review finds.
**New**: `tests/topdown-capture.spec.ts`, `qa-reports/topdown/` (gitignored)

**Tasks**
1. Capture a fixed storyboard: spawn, mid-traverse, first contact, elite beam, node at 0/50/100%,
   breach open, Fold-out, plus the four map corners and all five responsive breakpoints.
2. **Review each critically against the spec's acceptance criteria — read the images, do not merely
   capture them.** For each, name what is wrong, not whether it "looks good".
3. Explicitly hunt for: visible rectangles, actors without ground contact, shimmer or aliasing on
   pan, HUD overlap, unreadable combat under the darkness layer, obvious placeholder art, palette
   drift.
4. Fix, re-capture, re-review. **Iterate until no criterion fails.** Log every round in the report.
5. Side-by-side against the Phase 1 baseline and against the user's reference screenshots.

**Validate**: re-run `npm run qa:full` after each correction round.
**Checkpoint**: a written review document listing each acceptance criterion and its evidence.
**Risk**: declaring done on a captured-but-unreviewed screenshot — the explicit failure mode called
out in the brief.
**Rollback**: `git tag td-phase-10`.
**Done when**: every acceptance criterion has passing photographic evidence.

---

## Phase 11 — Final regression verification

**Tasks**
1. **Side-scrolling proof**: play all seven platformer zones; screenshot-compare against the Phase 1
   baseline. Any difference is a bug, not a judgement call.
2. Flag test: `TD_VISUALS.enabled = false` → confirm the sweep renders exactly as it did on `main`.
3. Full campaign smoke: menu → cold-open sweep → Fold → Miller Field → Blipstream → save/load →
   game-over/retry.
4. `npm run qa:full`; asset budget assertion; `verify-licenses.mjs` + `check-links.mjs` green.
5. Grep `src/` for any remote URL reaching a Phaser loader — zero tolerance.
6. Confirm no leaked resize on every exit path (breach / death / quit / dev warp).
7. **Update `src/game/data/commandCenterData.ts`** — the shipped-features entry for the Z1 cold-open
   (line 134) now describes the HD top-down treatment; add the top-down visual system to the feature
   list.
8. **Amend `.claude/skills/procedural-pixel-art/SKILL.md`** with an explicit top-down exemption
   recording the deliberate style break, so future sessions do not "correct" it back to pixel art.
9. Write `TOPDOWN_VISUAL_RESULTS.md` — before/after, decisions taken, known gaps, and the reuse
   recipe for `circuit-z2` and `maze-z4`.

**Done when**: every acceptance criterion is met, side-view is proven untouched, and the system is
documented as reusable.

---

## Deployment note — not part of this plan's execution

Deployment is **out of scope** here and must not be attempted as part of the overhaul.

When the user does ask to deploy, `CLAUDE.md`'s non-negotiable rule governs: deploy only from
`/Users/aerdman/BLIP` — never a worktree, never the GitHub mirror at
`/Users/aerdman/ReadMe_Local/Github/BLIP`. Verify the checkout is clean and at `origin/main`, then
`git pull --ff-only` → `npm run typecheck` → `npm run build` → `npm run deploy` →
`npm run verify:prod`. Production is `https://blip-chagrin.vercel.app/` and is only "done" when the
homepage's `blip-deploy-commit` meta tag matches the current Git HEAD — HTTP 200 is not sufficient.
`scripts/deploy.sh` already guards on `.vercel/project.json` naming project `blip`.

Specific to this work: the overhaul adds the **first real binary assets** to the build, so the first
deploy after it should explicitly confirm that `public/assets/topdown/` is served same-origin and
that the service worker's `CORE_URLS` update took effect.
