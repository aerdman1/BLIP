# TOPDOWN VISUAL SPEC — BLIP

Visual specification for the top-down "Sweep" levels. Scope of the first pass:
**`surface-z1` ("The Surface · Area 47") only.** This arena is the benchmark; the systems
built for it are parameterized so `circuit-z2` and `maze-z4` are later data + assets, not
new architecture.

**Side-scrolling levels are out of scope and must not change.**

---

## 0. Established facts (do not re-derive)

| Concern | Finding |
|---|---|
| Scene | `src/game/scenes/SweepScene.ts` (1297 lines), key `SCENES.sweep`, registered `src/game/BlipGame.ts:51` |
| Level data | `surface-z1` — `src/game/data/sweepArenas.ts:62-100`. Grid 34×20, `SWEEP.tile` 32 → world 1088×640. Mode `traverse`, biome `miller`, node {17,10}, breach {28,4}, spawn {6,15}, elite {19,9}, chargeTarget 100, 10 authored enemies, 3 caches. `DEFAULT_ARENA` line 236 |
| Entry / exit | Cold-open from `MainMenuScene.startGame()` ~598-634 → `FieldScene` via `foldOnward()` `SweepScene.ts:1212` / `exitToOverworld()` 1258 |
| Engine | Phaser `^3.90.0`. `BlipGame.ts:27-52` — `Phaser.AUTO`, 480×270, `pixelArt: true`, `roundPixels: true`, scale `FIT` + `CENTER_BOTH`, global PostFX pipelines (ComicFX/GradeFX/RetroFX/HalftoneFX/SignalFX), arcade physics |
| Render scaffolding | `config.ts:7-18` — `RENDER_ZOOM=1`, `VIEW_W/H` 480×270, `GAME_WIDTH/HEIGHT` derived. The comment explicitly reserves this for a future HD-2D bump |
| Camera | `SweepScene.ts:167-189` — biome bg colour, `setZoom(RENDER_ZOOM * 0.82)` (0.72 on `pointer: coarse`), `setBounds(0,0,AW,AH)`, gravity 0, `startFollow(player, true, 0.16, 0.16)` |
| Terrain | `buildMap()` 248-397 — 10 passes: tileSprite ground → tonal patches → dirt paths → wall carve + merged colliders (flat `tileSprite`, depth 7) → decals → props → node landmark + additive glow → 14 motes → foreground framing → (no vignette) |
| Actors | `src/game/entities/sweep/BlipCraft.ts` (232), `SweepEnemy.ts` (219); archetypes `config.ts:857-874`; elite/boss inline `SweepScene.ts:484-620` |
| Signal node | `nodePos`/`nodeCharge` 66-68, `addNodeCharge()` 458, `buildBreach()` 400, `openBreach()` 417, `cropBloom()` 439; art `TEX.sweepNode` |
| Textures | 100% procedural. `src/game/art/sweepTextures.ts` (649, lazy + idempotent, called `SweepScene.ts:120`); `src/game/systems/ProceduralArt.ts` via `BootScene.ts:25`. **No `preload()` anywhere.** Only binaries in repo: PWA icons + 5 DOM scout portraits |
| FX available | `EffectsSystem.ts` (pooled emitters, shake, flash, `scanRing`, `floatText`); `VisualFX.ts` — a complete HD-2D rig (grade/vignette/grain, ambient-darkness multiply + additive radial lights, contact shadows, canvas LINEAR textures), **currently `enabled: false`, opted into by FieldScene only, tightly coupled to side-view `LevelDef`** |
| Lighting today | Fake only — additive `TEX.glow8` sprites. No Light2D anywhere |
| HUD | `src/game/scenes/UIScene.ts` — **shared, dual-mode**. Side-view = per-frame Phaser graphics. Sweep = DOM overlay `#sweep-hud-dom` (built 140-169, drawn 204-284) + a residual Phaser `sweepG` HP bar. Phaser sweep text objects are created then permanently `setVisible(false)` — dead code. Plus the always-on DOM shell: `index.html` `#objective-bar`, `#status-strip`, driven by `src/ui/ShellUI.ts` (1825), styled `src/style.css` (1747; sweep base 220-340, sweep compact 1360-1418) |
| Responsive | `ShellUI.refreshCompactLayout` ~287-299 (`body.compact-gameplay`, `body.sweep-active`), manual Phaser refit 308-336, `ResizeObserver` 339-356; `src/ui/TouchControls.ts` + `systems/TouchInput.ts` |
| Commands | `dev`, `build`, `preview`, `typecheck`, `test:e2e`, `qa:playtest`, `qa:full`, `qa:loop`, `deploy`, `verify:prod`. Playwright: `vite preview` :4173, viewport 960×540, workers 1 |
| Command Center | `command-center.html` + `src/command-center/CommandCenter.ts` + `src/game/data/commandCenterData.ts` (line 134 records the Z1 hybrid cold-open). Canonical Z1 prose spec: `src/game/data/levelPlans.ts:93` |

### Shared code — the careful list

| File | Shared? | Rule |
|---|---|---|
| `src/game/config.ts` | Yes | **Additive only.** New `TD_*` blocks and `TEX.td*` keys. Never change `RENDER_ZOOM`, `VIEW_W/H`, `TILE`, existing `PALETTE` or `TEX.sweep*` values |
| `src/game/scenes/UIScene.ts` | Yes | One additive RESIZE handler + sweep-mode DOM migration. The side-view `update()` path must not be edited |
| `src/style.css` | Yes | New rules scoped under `body.sweep-active` / `.td-hud` only |
| `src/game/systems/EffectsSystem.ts` | Yes | Read-only. Wrap, don't modify |
| `src/game/entities/Projectile.ts` | Yes | Read-only. New visuals via texture keys only |
| `src/game/art/sweepTextures.ts` | Motel + Orchard arenas | **Must remain intact.** Only the `miller` biome switches to HD keys |
| `src/game/systems/VisualFX.ts` | FieldScene | Read-only reference. Copy techniques, do not generalize — coupled to `cellAt`/`surfaceYAt` |
| `TEX.glow8` / `px` / `spark` / `ring` | Yes | **Never `setFilter(LINEAR)` on these.** Generate `td-*` aliases instead |
| `src/game/BlipGame.ts` | Yes | Do not change `width`/`height`/`pixelArt`/`roundPixels` globals |
| All side-view scenes | — | Zero edits |

**Isolation boundary:** `SweepScene` + `sweepArenas` + new `src/game/render/` + `src/game/topdown/`
+ `public/assets/topdown/`, gated on `arena.id === 'surface-z1'` behind the single flag
`TD_VISUALS.enabled`. Flipping it false must restore today's rendering exactly.

---

## 1. Visual direction

The Sweep is the Interpretation Engine's high-fidelity SCAN of you — a rendered, over-resolved
simulation of Area 47. Where the side-view world is your memory (pixel art, warm, hand-made), the
top-down world is the machine's model of you: smoother, colder, better-lit, uncannily detailed.
**This stylistic break is deliberate and diegetic.** The Fold transition is the seam.

Target read: a night forest clearing under a green signal beacon. Wet, dimensional ground; layered
foliage with real occlusion; a small white robot with a warm rim light casting a soft contact
shadow; red-eyed drones trailing volumetric cones; a single dominant green light source at the
Node. Dark, atmospheric, high contrast, low clutter. **Not** photoreal — HD stylized.

**Anti-goals:** pixelated minification shimmer; flat unlit tiles; visible rectangular room edges;
uniform ground colour; sprites floating without ground contact; HUD occupying more than 12% of the
screen.

---

## 2. Camera and perspective rules

- **Backbuffer density `d`**: 3 on desktop, 2 on `pointer: coarse`, settings-overridable. Sweep only.
- **All `td-*` art is authored at 2× its intended on-screen size and rendered at
  `TD_VISUALS.artScale = 0.5`.** Every code path that draws td art must apply it. Skipping this
  is not subtle — a 230 px canopy sprite lands in a ~585 px-wide viewport and blacks out the arena.
- **Ground material repeats at `TD_VISUALS.groundCell` (256 px)** — 2× minification of the 512²
  photoscans. Smaller repeats (64 px) minify 8× and turn grass into aliased static.
- **Camera zoom** = `d * SWEEP.cameraZoom` (0.82 / 0.72 touch). The visible world region is
  **byte-identical to today**, so no gameplay tuning (`aimRange`, `scanRadius`, follow lerp, arena
  bounds) needs to change.
- `camera.setRoundPixels(false)` on the sweep camera only — the fractional zoom makes pixel-snapping
  jitter rather than crisp, and y-sorting/shadows need sub-pixel continuity.
- **Ground stays flat top-down.** Never perspective-project the floor; it breaks the 1:1 map between
  the top-down physics circle and the render.
- **Everything above the ground is a base-anchored billboard** with baked ¾ perspective: origin
  `(0.5, 1)`, drawn at its footprint y, showing its front face plus a hint of top surface. This is
  the whole 2.5D trick.
- **`OBLIQUE.k = 0.55`** — the single foreshortening constant. A prop of render height `H` occupies
  `H*k` of ground depth. Drives shadow ellipse `scaleY`, wall extrusion height, and elevated depth
  offset.
- **Lens tilt**: render y offset by `(propY - cam.midPoint.y) * 0.02`. Subtle arena parallax;
  trivially reversible.
- Camera behaviour (follow, lerp, bounds, deadzone) is otherwise unchanged.

### Render architecture

Scene-local backbuffer resize: `game.scale.resize(480*d, 270*d)` on Sweep entry, restored on
`SHUTDOWN`. Side-view scenes continue to run at exactly 480×270.

Rejected alternatives, for the record:
- **Global `RENDER_ZOOM = 2`** — coherent on paper (a zoom-2 camera on a 960×540 buffer shows
  exactly 480×270 world units, so `setScrollFactor(0)` overlays sized `VIEW_W×VIEW_H` still fill the
  screen, and NEAREST 2× upscaling is pixel-exact), but it changes the render path for all 13 scenes
  and permanently raises fill cost for seven platformers that gain nothing.
- **High-res RenderTexture at 480×270** — impossible. An FBO can exceed the canvas, but compositing
  it back resamples to the 480×270 drawing buffer. Final pixels are capped by the backbuffer.

Consequence: `UIScene.ts:70` hardcodes `setZoom(RENDER_ZOOM)` and must gain a
`Phaser.Scale.Events.RESIZE` handler re-applying `setZoom(width / VIEW_W).centerOn(VIEW_W/2, VIEW_H/2)`,
mapping the 480×270 HUD layout space onto any backbuffer.

Failure mode to guard: **a leaked resize.** If `restoreBase()` is missed on any exit path, the next
scene builds a 480-coordinate layout inside a 1440×810 buffer and renders tiny in the top-left corner.

---

## 3. Palette

Extends `PALETTE`, does not replace it. New `TD_PALETTE` block in `config.ts`.

| Role | Direction |
|---|---|
| Ground base | Deep desaturated forest green-black; **mean luminance ~0.25, range ~0.14–0.42**, never a single flat tone. (An earlier draft said 0.06–0.22. That was judged in isolation and proved unplayable: once the multiply-darkness layer, baked wall shadows and canopy stack on top, the arena rendered as near-black. Corrected after measuring the running game.) |
| Ground lit | Cool moonlit green where light pools reach; warm amber only under the beacon |
| Dirt / path | Low-chroma brown with a wet sheen highlight |
| Foliage | Three depth tiers: near (darkest, silhouette), mid (readable), far (haze-shifted toward blue) |
| Signal / friendly | Green `P.signalGreen` → cyan core. The Node is the brightest object on screen |
| Danger | Red `P.danger` for drone eyes, beams, telegraphs. **Only enemies emit red** |
| Atmosphere | Cool blue-green haze; warm amber accents at ≤5% coverage for contrast |

Rules: exactly **one** dominant light hue per arena (Z1 = green). Red is reserved for threat. Max two
saturated hues on screen at once. Shadows are cool and blue-shifted, never pure black.

---

## 4. Terrain rules

- **Ground = layered tiling, never cell stamping.** Three full-arena `tileSprite`s of the same
  materials at mutually mismatched tile scales and offsets. Stamping material per cell — at *any*
  cell size — leaves a visible rectangular grid across the whole arena and fails the "no rectangle"
  criterion outright; mismatched repeat periods give the eye no grid to lock onto.
- **Worn paths are masked, not rectangles.** One full-arena path `tileSprite` revealed through a
  `BitmapMask` painted with soft overlapping blobs down each corridor. A tileSprite per hall rect
  paints hard-edged tan rectangles — exactly the prototype look this overhaul exists to remove.
- **Wall shadows are baked once** into a `Graphics` at build: zero per-frame cost, and the main
  source of the "this is really lit" impression.
- **Natural variation**: value noise drives tile blend weights so no two regions match. Minimum three
  ground materials per arena plus a wet/darkened variant.
- **Irregular edges**: the room/hall rectangles from `arena.rooms`/`halls` are the *collision* truth
  and do not change. Their *visual* edges are broken up by an alpha-masked overlay — organic foliage
  skirts, scattered rocks, root cover straddling the boundary — until no rectangle is ever visible.
- **Walls become extrusions, not flat tiles.** Replace the flat `tileSprite` at `SweepScene.ts:330`
  with a top-cap tile plus a face strip of height `TD_WALL.height` extruded upward from the wall's
  bottom edge, depth-sorted by its base y. **Physics bodies are unchanged** — keep the existing merged
  static rects exactly. This single change is what makes a top-down arena read as 2.5D: the player
  walks behind walls above them and in front of walls below them.
- **Layering**: ground bake → ground decals → static shadows (baked) → sorted band → canopy/foreground.
- Layout, collision, room/hall geometry and marker positions: **unchanged**.

### Depth bands

```
ground 0 · patch 1_000 · decal 2_000 · shadow 3_000
sorted 10_000            ← the y-sorted band (900k of headroom)
air 950_000 · fxOverlay 960_000 · reticle 980_000 · foreground 990_000

sortedDepth(baseY)      = sorted + baseY
airDepth(baseY, height) = sorted + baseY + AIR_BIAS
```

Everything sharing the ground plane sorts on **base y (feet), not centre**: player, enemies, props,
walls, node, bunker, pickups, breach core. Elevated and flying things use `airDepth` so they draw
above ground contacts at the same y while still sorting correctly against distant props. Only moving
objects update per frame (~30 calls); statics are set once at build.

---

## 5. Player and enemy presentation

- **CONTACT-47**: HD sprite, base-anchored, ~2× current on-screen size for silhouette legibility.
  Warm rim light on the light-facing side; green visor as a separate additive layer that pulses at
  runtime; soft contact shadow that squashes on dash. Directional facing preserved from `BlipCraft`.
- **Drones**: each of the 8 archetypes keeps its current readable silhouette and colour language but
  gains dimensional shading, a red eye emissive on its own additive layer, a hover shadow that
  detaches from the ground (offset and softened by hover height), and a faint downward light cone.
  The Classifier elite reads visibly larger and heavier.
- **Silhouette rule**: every actor must be identifiable in pure black at 50% size. Verify by
  screenshotting with a black tint applied.
- Animation, hitboxes, movement, AI and damage: **unchanged**. This is a render swap only.

---

## 6. Signal node presentation

The Node is the scene's hero prop and its primary light source.

- A physical structure — a tiered plinth with an emissive core — not a glowing circle.
- A vertical light shaft rising from the core (additive, gently animated), visible from anywhere in
  the arena as a navigational beacon.
- Concentric ground rings projected onto the terrain, scaled by `OBLIQUE.k`, brightening with charge.
- **Charge state drives light**: core brightness, shaft height, ring count and ambient pool radius all
  scale with `nodeCharge / chargeTarget`. Full charge = a bloom-out and colour shift to cyan.
- The Breach mirrors this language in a locked/dormant grey until `openBreach()`.
- All existing charge logic, radii and events unchanged.

---

## 7. Lighting and atmosphere rules

**Do not use Phaser Light2D.** It requires a normal map per texture (all art is procedural or
photoscanned albedo — you would be authoring normal maps for everything and doubling texture memory),
it is a per-GameObject render pipeline that fights tileSprites/Graphics/Text, and **it casts no
shadows** — so it does not deliver the thing that is actually wanted.

Use the approach `VisualFX.ts` already proves and ships:

1. **One arena-wide multiply darkness layer** over the ground. Under `MULTIPLY` the **fill colour is
   the transmission factor**, not the amount of darkness — white passes the scene through, black
   kills it. The strength constant must be baked into the colour; `Rectangle`'s 6th argument is
   *fill* alpha and does not attenuate a multiply. Getting this wrong renders the arena at ~3%
   brightness, which is how it first shipped in review.
2. **Additive radial light sprites punch holes in it** — Node (dominant), beacon, breach, player,
   drone eyes, muzzle flashes. Two draw calls plus one sprite per light. Fully art-directable.
3. **`GradeFX` on the sweep camera** for grade + vignette (resolution-independent).
4. **Skip bloom.** `VisualFX.ts:56-68` documents the A/B: Phaser's Bloom FX has no luminance
   threshold, blurs the whole frame and lifts the black point, greying out a dark scene. Additive
   pools give better halation for less cost.
5. **Localized fog**: low-lying drifting fog sheets in hollows and near the Node, LINEAR-filtered,
   scrolled slowly. Not a full-screen wash.
6. **Atmospheric perspective**: distant foliage desaturated and haze-shifted toward blue.

---

## 8. VFX rules

- Muzzle flash, impact and death effects gain a light contribution, not just particles.
- Dash leaves a ground-scuff decal and a brief motion smear.
- Scan pulse becomes a ground-projected expanding ring (ellipse-scaled by `OBLIQUE.k`) plus a light flash.
- Overdrive: screen-space chromatic pulse + a sustained player light + a ground shockwave ring.
- Enemy telegraphs are the loudest reds on screen — readability beats beauty.
- **Never obscure the player or an incoming projectile.** Alpha budget: no effect exceeds 0.6 alpha
  over the play area for more than 200 ms.
- All VFX remain code-generated; only actors, terrain and props use real art.

---

## 9. HUD rules

The world occupies **≥ 88%** of the frame. One panel per concern; nothing permanent that is not needed.

**Keep, in exactly one place each:**

| Element | Placement |
|---|---|
| Objective panel — title + contacts remaining + charge bar | Top-left, compact, single card |
| Health / energy / weapon | Bottom-left, one grouped card with the CONTACT-47 chip |
| Signal Overdrive | Bottom-centre, thin restrained meter, prominent only when READY |
| Ability strip — DASH · SCAN · ECHO · FIRE with binding glyphs | Bottom-right, icons + small labels |
| Contextual alerts | Transient centre toasts only; auto-dismiss |

**Remove or suppress while `body.sweep-active`:**

- The permanent instruction ticker (`#objective-hint`) — convert to a one-shot dismissed on first input.
- The duplicate objective readout (`#objective-text` vs `.sweep-hud-objective`) — one wins.
- `#status-strip`: SIGNAL FRAGMENTS / CLASSIFICATION / LOCATION / STATUS / clock. Hide in top-down;
  fragments and classification surface in the pause screen instead.
- Heavy borders, double frames, oversized panels, debug-style presentation.
- Excessive uppercase — sentence case for prose; uppercase reserved for labels and objectives.
- The dead Phaser sweep text objects in `UIScene.setSweepMode` (created then permanently hidden).
- The duplicated controls string (`buildSweepDom:157` vs `drawSweepHud:283`, currently disagreeing).

**Structural**: sweep-mode HUD becomes **100% DOM**. Migrate the residual Phaser `sweepG` HP bar into
the DOM overlay, so no HUD element is subject to backbuffer scaling. Side-view HUD is untouched.

**Responsive**: desktop / tablet / mobile-landscape / mobile-portrait. Panels use `clamp()` and
safe-area insets; on mobile the ability strip merges into the existing touch cluster rather than
duplicating it. All rules scoped under `body.sweep-active` — side-scrolling UI must be provably
unchanged.

---

## 10. Performance rules

- **≤ 4 full-screen-equivalent passes.** Currently 3 (scene → darkness multiply → GradeFX RT). One
  spare for grain/vignette. **Do not add a second PostFX pipeline.**
- **≤ 250 draw calls, ≤ 400 display-list items.** Bake static shadows and static prop lighting into
  the ground RenderTexture rather than adding sprites.
- Author textures at **density 2 even when rendering at d=3**; LINEAR carries the last 1.5×.
  Visually indistinguishable on a smooth upscale, and it cuts texture memory by more than half.
- **Never minify a texture below ~0.5×** — non-power-of-two canvas textures get no mipmaps, so LINEAR
  only helps on magnification. Author to on-screen size.
- Zero per-frame allocation. Shadows and lights are pooled; dynamic shadows capped at 24.
- Reuse `VISUAL_FX.quality`'s existing `'auto' → 'low' on touch` pattern for light count, grain and
  shadow cap.
- **Asset budget: 1.5 MB hard cap** for the `surface-z1` set (~900 KB target), enforced by a
  build-time size assertion.
- Target 60 fps desktop, ≥ 45 fps iPad, measured in the running game.

---

## 11. Acceptance criteria

1. `surface-z1` is visibly non-pixelated, dimensional and atmospheric; a side-by-side against the
   current screenshots shows an unambiguous improvement.
2. No rectangular room or hall edge is visible anywhere in the arena.
3. Every actor and prop has a ground shadow and reads as standing on the terrain.
4. The player passes visibly behind props/walls above them and in front of those below them.
5. The Node is the brightest object and is legible as a navigational beacon from any arena position.
6. HUD occupies ≤ 12% of the frame; no information appears twice; no permanent instruction ticker.
7. Side-scrolling levels are **pixel-identical** to `main` — proven by screenshot comparison, not by
   assertion.
8. `npm run typecheck`, `npm run build`, `npm run test:e2e` all pass.
9. Zero runtime hotlinks; every asset same-origin; every asset license-documented.
10. Setting `TD_VISUALS.enabled = false` restores today's rendering exactly.
11. 60 fps desktop / ≥ 45 fps iPad-class, measured.
12. The system is arena-parameterized — adding `circuit-z2` later is data + assets, not new
    architecture.
