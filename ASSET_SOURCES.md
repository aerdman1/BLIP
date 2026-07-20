# ASSET_SOURCES — external originals

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


Every external asset used by the BLIP top-down (`surface-z1`) art pipeline.

**All sources below are site-wide CC0 1.0 (public domain dedication). No attribution is
required, and none is shipped.** The `Attribution Required` column exists so the verifier can
prove that, not because any row is expected to say `yes`.

The **originals themselves are not committed** — `art-src/` is gitignored. What ships is the
processed output under `public/assets/topdown/`, documented in
[`GENERATED_ASSETS.md`](GENERATED_ASSETS.md). The SHA-256 of every original is recorded here so a
re-fetch can be proven byte-identical, and so the derived work traces to a known CC0 root even if
a host later goes offline. `scripts/art/source-manifest.json` is the machine-readable twin of this
table, written by `scripts/art/fetch-sources.mjs`.

Re-fetch with:

```
node scripts/art/fetch-sources.mjs          # cached; --force to re-download
```

Verify with:

```
node scripts/art/verify-licenses.mjs
node scripts/art/check-links.mjs
```

## Originals

| Original | Source URL | Direct File URL | License | Attribution Required | Retrieved | SHA-256 |
|---|---|---|---|---|---|---|
| `art-src/originals/ambientcg_grass004_color.jpg` | https://ambientcg.com/view?id=Grass004 | https://ambientcg.com/get?file=Grass004_1K-JPG.zip | CC0-1.0 | no | 2026-07-20 | 9e1c60da44b34a9738b1256ba827541f097dc583521b1d281e61b5f4b4217bc5 |
| `art-src/originals/ambientcg_ground037_color.jpg` | https://ambientcg.com/view?id=Ground037 | https://ambientcg.com/get?file=Ground037_1K-JPG.zip | CC0-1.0 | no | 2026-07-20 | d92bec8a35b9cb16ec79b421ca0f572a7400286eae109beafa266629ef49a6cf |
| `art-src/originals/ambientcg_rock030_color.jpg` | https://ambientcg.com/view?id=Rock030 | https://ambientcg.com/get?file=Rock030_1K-JPG.zip | CC0-1.0 | no | 2026-07-20 | 1dca8a336518ce0adca4b5cbe2ab30819c8769388f1c15278082a99f022c615a |
| `art-src/originals/polyhaven_aerial_grass_rock_diff_1k.jpg` | https://polyhaven.com/a/aerial_grass_rock | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg | CC0-1.0 | no | 2026-07-20 | 57b8041bfe0d0f01430e4dbaad45e7ddddf0a9fc97317f90dbc51f7b0d9e1b5d |
| `art-src/originals/polyhaven_aerial_ground_rock_diff_1k.jpg` | https://polyhaven.com/a/aerial_ground_rock | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_ground_rock/aerial_ground_rock_diff_1k.jpg | CC0-1.0 | no | 2026-07-20 | c14761998b32630dd193b0fbfd31c8c6f5a144a701b84f87f9d7c33596cc554f |
| `art-src/originals/polyhaven_aerial_rocks_02_diff_1k.jpg` | https://polyhaven.com/a/aerial_rocks_02 | https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_rocks_02/aerial_rocks_02_diff_1k.jpg | CC0-1.0 | no | 2026-07-20 | 708373b2af7fd07ac8de1500556006aaf904c41a99985a849cacc78874f38eac |
| `art-src/unzip/kenney-foliage` | https://kenney.nl/assets/foliage-sprites | https://kenney.nl/media/pages/assets/foliage-sprites/b65bd70c69-1677495980/kenney_foliage-sprites.zip | CC0-1.0 | no | 2026-07-20 | 8e3e944acaa731a90e0b004846d2ce99ee8a65d5479b4c2f421cab7cdde128e5 |

The Kenney row's SHA-256 is that of the downloaded `kenney_foliage-sprites.zip`; the `Original`
column names the extracted directory because four separate sprites are drawn from it
(`sprite_0052`, `sprite_0074`, `sprite_0090`, `sprite_0091` under `PNG/Shaded/`).

## What each original feeds

| Original | Feeds |
|---|---|
| Poly Haven `aerial_grass_rock` | `td-ground`, `td-ground-lit`, `td-ground-dark` — top-down aerial camera match, so the grain runs the right way for a top-down arena |
| ambientCG `Grass004` | second grass material blended against the above so the base ground is not a single photo |
| Poly Haven `aerial_ground_rock` | `td-path`, `td-debris` |
| Poly Haven `aerial_rocks_02` | `td-wall-top`, `td-wall-face`, `td-rock`, `td-log`, `td-scrap` |
| ambientCG `Ground037` | soil fallback for `td-path` if Poly Haven is unreachable |
| ambientCG `Rock030` | rock fallback for the wall/prop set if Poly Haven is unreachable |
| Kenney Foliage Sprites | `td-tuft`, `td-fern`, `td-bush`, `td-canopy` |

## Sources deliberately NOT used

**OpenGameArt** is fallback only and was not needed. It is per-asset licensed and mixes
CC-BY/GPL into CC0 search results, so any asset taken from it must carry its own license URL —
`verify-licenses.mjs` enforces that extra column for any OpenGameArt-origin row.

Note that `kenney.nl/assets/topdown-shooter` is a **404**; the correct slug is
`top-down-shooter`. That class of error is exactly what `check-links.mjs` exists to catch.

## No remote assets at runtime

Nothing here is fetched at build time or at run time. Phaser loads only same-origin files from
`public/assets/topdown/`. `check-links.mjs` greps `src/` for any remote URL reaching a Phaser
loader and fails on a single hit.
