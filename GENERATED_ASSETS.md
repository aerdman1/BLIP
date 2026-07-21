# GENERATED_ASSETS — everything shipped under `public/assets/topdown/`

> **UPDATE — art-direction pass 3.** Every tile and sprite currently shipped in
> `public/assets/topdown/` is now produced by `scripts/art/family.py`, which
> generates them from scratch (domain-warped fBm + one baked light direction +
> one palette). The CC0 photoscan pipeline below is retained for reference and
> is still runnable, but **its outputs are no longer what ships**: minified
> outdoor photoscans had no macro material structure and read as uniform
> speckle, which was the root cause of the "enlarged pixel noise" look.
>
> Practical consequence: the shipped art has **no third-party provenance at
> all** — it is wholly generated, so there is nothing to attribute and no
> license to honour beyond this project's own. The CC0 sources in
> `ASSET_SOURCES.md` remain correctly documented for the retained pipeline.


Produced by the committed `scripts/art/` toolchain. Nothing here is hand-painted and nothing is a
placeholder. Every row names its producing script and its input assets, so each shipped byte
traces back to a CC0 root declared in [`ASSET_SOURCES.md`](ASSET_SOURCES.md) or to explicitly
procedural generation.

`node scripts/art/verify-licenses.mjs` fails the build if any file here lacks a row, if a row
names a script that does not exist, or if a named input is neither a declared CC0 original nor
marked `procedural`.

## Commands

These are **not** wired into `package.json` (that file is owned by a concurrent change). Run them
directly, in this order:

```
node scripts/art/fetch-sources.mjs     # download CC0 originals into art-src/ (gitignored)
python3 scripts/art/process.py         # night-grade terrain, cut props + foliage
python3 scripts/art/author-actors.py   # author CONTACT-47, 8 drones, elite, Signal Node
node scripts/art/build-atlas.mjs       # pack sprites -> topdown-z1.webp + .json
node scripts/art/contact-sheet.mjs     # review sheet -> art-src/contact-sheet.html
node scripts/art/verify-licenses.mjs   # licensing + budget gate  (exit 1 on failure)
node scripts/art/check-links.mjs       # URL + no-remote-loader gate (exit 1 on failure)
```

`fetch-sources.mjs` caches; pass `--force` to re-download. `check-links.mjs --offline` skips the
HTTP round-trips and still runs the `src/` remote-URL scan.

Requirements: Node 18, Python 3 with PIL 11.3 and numpy 2.0 (both already present), `unzip`.

## Shipped files

Total: **415.8 KB** (budget 1536 KB, target ~900 KB).

| Output Path | Producing Script | Input Assets | Notes |
|---|---|---|---|
| `public/assets/topdown/td-ground.webp` | `scripts/art/process.py` | `art-src/originals/polyhaven_aerial_grass_rock_diff_1k.jpg`, `art-src/originals/ambientcg_grass004_color.jpg` | 512² seamless tileSprite ground. Two grass albedos blended through a hard-edged tileable noise mask, night-graded to TD_PALETTE (value 0.075–0.251) |
| `public/assets/topdown/td-ground-lit.webp` | `scripts/art/process.py` | `art-src/originals/polyhaven_aerial_grass_rock_diff_1k.jpg`, `art-src/originals/ambientcg_grass004_color.jpg` | 512² cool moonlit-green variant for light pools (value 0.110–0.376) |
| `public/assets/topdown/td-ground-dark.webp` | `scripts/art/process.py` | `art-src/originals/polyhaven_aerial_grass_rock_diff_1k.jpg`, `art-src/originals/ambientcg_grass004_color.jpg` | 512² wet / shadowed variant, blue-shifted (value 0.047–0.169) |
| `public/assets/topdown/td-path.webp` | `scripts/art/process.py` | `art-src/originals/polyhaven_aerial_ground_rock_diff_1k.jpg`, `art-src/originals/ambientcg_ground037_color.jpg` | 512² low-chroma brown dirt path with a broad wet sheen |
| `public/assets/topdown/td-wall-top.webp` | `scripts/art/process.py` | `art-src/originals/polyhaven_aerial_rocks_02_diff_1k.jpg`, `art-src/originals/ambientcg_rock030_color.jpg` | 512² wall / hedge top cap, wrap-aware directional relight so the bevel reads dimensional |
| `public/assets/topdown/td-wall-face.webp` | `scripts/art/process.py` | `art-src/originals/polyhaven_aerial_rocks_02_diff_1k.jpg`, `art-src/originals/ambientcg_rock030_color.jpg` | 512×160 extruded wall face strip. Bright cap lip → deep cool base contact band; wraps horizontally only (it repeats along a wall run, never vertically) |
| `public/assets/topdown/topdown-z1.webp` | `scripts/art/build-atlas.mjs` | `art-src/originals/polyhaven_aerial_rocks_02_diff_1k.jpg`, `art-src/originals/polyhaven_aerial_ground_rock_diff_1k.jpg`, `art-src/unzip/kenney-foliage`, procedural | 256×792 lossless WebP, 30 frames, 77.4% fill. Lossless because actor sprites have hard alpha edges and additive emissive layers, both of which lossy WebP smears into halos |
| `public/assets/topdown/topdown-z1.json` | `scripts/art/build-atlas.mjs` | procedural | Phaser JSON-Hash atlas manifest. Frames are trimmed; `sourceSize` / `spriteSourceSize` preserve untrimmed placement |

## Atlas frames

Frame names are **exactly** the `TEX.td*` registry values. `build-atlas.mjs` asserts the set
against its own `REQUIRED_FRAMES` and fails on any missing or unexpected sprite — atlas frame-name
drift is the most likely silent failure in this overhaul.

### Actors — authored, not sourced

`scripts/art/author-actors.py`, inputs: **procedural** (no CC0 pack contains CONTACT-47, and a
stock drone is the one place this overhaul would read as asset-flipped).

Each is built from an implicit height field: a supersampled silhouette, a distance-style dome, a
three-stop material ramp driven by a fixed **upper-left** key light, a tight chassis specular, a
cool moonlit rim on the shaded edge, and a baked contact shadow. Hovering drones get a
**detached, softened** shadow; the rooted `turret` does not.

| Frame | Source size | Intended on-screen | Notes |
|---|---|---|---|
| `td-blip` / `td-blip-emis` | 56×69 | ~28 px | CONTACT-47. Cream shell, inset dark visor plate, two feet, antenna bulb — same silhouette as `src/game/art/sweepTextures.ts` (read-only reference; that file is untouched) |
| `td-drifter` / `-emis` | 44×57 | ~22 px | saucer hull, side vents |
| `td-tagger` / `-emis` | 44×57 | ~22 px | violet dome |
| `td-diver` / `-emis` | 43×55 | ~22 px | amber dart |
| `td-warden` / `-emis` | 53×69 | ~22 px | frontal shield arc — the archetype's whole read |
| `td-sniper` / `-emis` | 46×59 | ~22 px | barrel, hottest eye |
| `td-splitter` / `-emis` | 49×63 | ~22 px | banded shell |
| `td-weaver` / `-emis` | 40×52 | ~22 px | swept wings, smallest |
| `td-turret` / `-emis` | 51×67 | ~22 px | rooted hex pylon, planted shadow |
| `td-elite` / `-emis` | 80×100 | ~40 px | Classifier. Octagonal armour, shoulder blocks, warning stripes, one big scan eye — visibly larger and heavier |
| `td-node` / `-emis` | 112×132 | ~56 px | Signal Node. Three oblique tiers (foreshortened by `OBLIQUE.k = 0.55`) with contact AO in each groove, plus a raised core pillar. A physical structure, not a glowing circle |

**Emissives are separate additive layers.** Every `-emis` frame is its own PNG so the runtime can
pulse its alpha without re-tinting the chassis. Drone and elite eyes are red (spec: only enemies
emit red); CONTACT-47's visor and antenna and the Node's core are signal green. Bodies still carry
a faint bounce of their own emissive so an actor reads lit even with the additive layer off.

### Props and foliage

| Frame | Source size | Producing script | Input assets |
|---|---|---|---|
| `td-rock` | 96×100 | `scripts/art/process.py` | `art-src/originals/polyhaven_aerial_rocks_02_diff_1k.jpg` |
| `td-log` | 128×70 | `scripts/art/process.py` | `art-src/originals/polyhaven_aerial_rocks_02_diff_1k.jpg` |
| `td-debris` | 72×72 | `scripts/art/process.py` | `art-src/originals/polyhaven_aerial_ground_rock_diff_1k.jpg` |
| `td-scrap` | 64×62 | `scripts/art/process.py` | `art-src/originals/polyhaven_aerial_rocks_02_diff_1k.jpg` |
| `td-tuft` | 63×80 | `scripts/art/process.py` | `art-src/unzip/kenney-foliage` (`PNG/Shaded/sprite_0052.png`) |
| `td-fern` | 95×106 | `scripts/art/process.py` | `art-src/unzip/kenney-foliage` (`PNG/Shaded/sprite_0074.png`) |
| `td-bush` | 109×124 | `scripts/art/process.py` | `art-src/unzip/kenney-foliage` (`PNG/Shaded/sprite_0090.png`) |
| `td-canopy` | 203×231 | `scripts/art/process.py` | `art-src/unzip/kenney-foliage` (`PNG/Shaded/sprite_0091.png`) |

Rock, log, debris and scrap are cut from the rock/soil albedos onto organic height fields, relit
under the same upper-left key, and given a baked cool contact shadow. The albedo is blurred before
grading on purpose — at prop scale the photoscan's lichen speckle out-shouts the silhouette and
the object stops reading as solid. Form comes from the relight, not from borrowed pixel noise.

Bush and canopy get a **radial falloff relight** — lit crown, dark underside. Per the plan that is
the main dimensional cue in a top-down forest.

## Pipeline decisions worth knowing

- **Tiles are individual files, not atlas frames.** Phaser's `tileSprite` needs real texture wrap,
  which an atlas frame cannot provide.
- **Seamlessness is measured relative to the texture's own local contrast**, not as an absolute
  pixel delta. A perfectly seamless grass photoscan already has ~10/255 between neighbouring
  pixels, so an absolute threshold flags every real texture as broken. All five 512² tiles measure
  1.13–1.17× interior contrast — effectively invisible. `td-wall-face` is forced on its horizontal
  axis only, by design.
- **Every filter in `process.py` is wrap-aware.** PIL's Gaussian blur clamps at the border; without
  wrap padding, the local-contrast pass disagrees across the tile edge and the seam-repair step
  "fixes" it into a visible mirrored blob.
- **Value discipline.** All ground materials sit inside the spec's 0.06–0.22 window; the lit
  variant is allowed to reach 0.376 at its brightest blade tips because it only appears inside
  light pools.

## Fallbacks used

**None.** All seven CC0 sources were reachable and every shipped asset derives from a real
photoscan or from the authored PIL toolchain. `process.py` retains fully procedural
grass/soil/rock and foliage generators (`synth_ground`, `synth_foliage`) for the case where a host
is down; if they ever fire, the run prints `FALLBACKS USED:` and records them in
`art-src/process-report.json`, and this section must be updated to say so.

One recoverable failure occurred during development: Kenney's asset page drives its download
button from JavaScript, so the zip is not in an `href`. `fetch-sources.mjs` now matches the
`/media/pages/` zip URL in the page source instead.

## Review

`node scripts/art/contact-sheet.mjs` writes `art-src/contact-sheet.html` — every produced asset on
a dark background at 1× and 3×, tiles shown 2×2-repeated so seams are visible, and actors shown
with their additive emissive layer composited. That sheet is the Phase 3 review gate: review it
for palette coherence and consistent light direction **before** any integration work.
