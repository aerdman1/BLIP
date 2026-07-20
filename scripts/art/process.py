#!/usr/bin/env python3
"""
BLIP top-down art pipeline - Phase 3, step 2.

Night-grades the CC0 photoscan albedos fetched by `fetch-sources.mjs` toward
TOPDOWN_VISUAL_SPEC.md section 3 (deep desaturated forest green-black, value
0.06-0.22), verifies / forces seamless tiling, and emits:

  public/assets/topdown/td-ground.webp        512x512  tileSprite ground base
  public/assets/topdown/td-ground-lit.webp    512x512  moonlit pool variant
  public/assets/topdown/td-ground-dark.webp   512x512  wet / shadowed variant
  public/assets/topdown/td-path.webp          512x512  low-chroma dirt path
  public/assets/topdown/td-wall-top.webp      512x512  wall / hedge top cap
  public/assets/topdown/td-wall-face.webp     512x160  extruded wall face strip

  art-src/sprites/td-rock.png    td-log.png   td-debris.png  td-scrap.png
  art-src/sprites/td-bush.png    td-fern.png  td-tuft.png    td-canopy.png

Sprites are staged as PNG in art-src/sprites/ and packed into the atlas by
build-atlas.mjs. Tiles stay individual files because Phaser's tileSprite needs
real texture wrap, which an atlas frame cannot provide.

Fixed light direction: UPPER-LEFT, matching the existing sweepTextures.ts
convention. Every baked highlight, rim and contact shadow in this pipeline and
in author-actors.py uses the same vector.

If a source original is missing (host unreachable at fetch time) the affected
material falls back to a fully procedural PIL/numpy equivalent; the fallback is
recorded in the run report so GENERATED_ASSETS.md can state it.

Usage: python3 scripts/art/process.py
"""
from __future__ import annotations

import json
import os
import sys
import warnings

import numpy as np
from PIL import Image, ImageFilter, ImageDraw

# Pillow 11 deprecates the explicit `mode` arg to Image.fromarray; the calls here
# are all correct-by-construction and the warning is pure noise in the run log.
warnings.filterwarnings("ignore", category=DeprecationWarning, module="PIL")
warnings.filterwarnings("ignore", message=".*'mode' parameter is deprecated.*")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ORIG = os.path.join(ROOT, "art-src", "originals")
KENNEY = os.path.join(ROOT, "art-src", "unzip", "kenney-foliage", "PNG", "Shaded")
SPRITES = os.path.join(ROOT, "art-src", "sprites")
OUT = os.path.join(ROOT, "public", "assets", "topdown")

TILE = 512
FACE_H = 160
WEBP_Q = 80

# Fixed scene light: upper-left, slightly steep.
LIGHT = np.array([-0.62, -0.62, 0.48])
LIGHT = LIGHT / np.linalg.norm(LIGHT)

# --- TD_PALETTE (TOPDOWN_VISUAL_SPEC.md section 3) --------------------------
# Ground ramp: deep desaturated forest green-black.
# Value 0.14 -> 0.42. The spec originally called for 0.06 -> 0.22; that was
# measured in isolation and proved unplayable once the runtime multiply-darkness
# layer, baked wall shadows and canopy stacked on top - the arena rendered as
# near-black. Raised after looking at the running game. TOPDOWN_VISUAL_SPEC.md
# section 3 has been corrected to match.
RAMP_GROUND = [
    (0.00, (0x19, 0x27, 0x1D)),  # v 0.078  deep shadow between blades
    (0.35, (0x2F, 0x46, 0x33)),  # v 0.141
    (0.70, (0x46, 0x63, 0x4A)),  # v 0.200
    (1.00, (0x5A, 0x79, 0x5C)),  # v 0.243  brightest blade tip
]
RAMP_GROUND_LIT = [  # cool moonlit green where light pools reach
    (0.00, (0x25, 0x39, 0x2F)),
    (0.35, (0x42, 0x63, 0x4E)),
    (0.70, (0x63, 0x8E, 0x6F)),
    (1.00, (0x85, 0xB5, 0x8E)),
]
RAMP_GROUND_DARK = [  # wet / shadowed variant, blue-shifted per "shadows are cool"
    (0.00, (0x0E, 0x17, 0x17)),
    (0.35, (0x1B, 0x29, 0x29)),
    (0.70, (0x29, 0x3B, 0x3B)),
    (1.00, (0x36, 0x4C, 0x4C)),
]
RAMP_PATH = [  # low-chroma brown, wet sheen added afterwards
    (0.00, (0x20, 0x1B, 0x15)),
    (0.35, (0x41, 0x35, 0x28)),
    (0.70, (0x61, 0x50, 0x3D)),
    (1.00, (0x7D, 0x68, 0x50)),
]
RAMP_WALLTOP = [  # hedge / rock top cap - reads as foliage crown from above
    (0.00, (0x12, 0x1C, 0x13)),
    (0.35, (0x21, 0x33, 0x23)),
    (0.70, (0x33, 0x4A, 0x34)),
    (1.00, (0x46, 0x62, 0x46)),
]
RAMP_ROCK = [
    (0.00, (0x0C, 0x10, 0x12)),
    (0.35, (0x1B, 0x20, 0x23)),
    (0.70, (0x2C, 0x33, 0x36)),
    (1.00, (0x40, 0x48, 0x4C)),
]
RAMP_WOOD = [
    (0.00, (0x0E, 0x0C, 0x0A)),
    (0.35, (0x1E, 0x18, 0x12)),
    (0.70, (0x2E, 0x25, 0x1B)),
    (1.00, (0x3E, 0x33, 0x26)),
]
RAMP_FOLIAGE = [  # near tier: darkest, reads as silhouette
    (0.00, (0x07, 0x0E, 0x09)),
    (0.40, (0x11, 0x1D, 0x13)),
    (0.75, (0x1B, 0x2C, 0x1D)),
    (1.00, (0x2A, 0x40, 0x2C)),
]
RAMP_CANOPY = [  # lit crown -> dark underside is applied by radial relight
    (0.00, (0x06, 0x0C, 0x08)),
    (0.40, (0x0F, 0x1A, 0x11)),
    (0.75, (0x1C, 0x2E, 0x1E)),
    (1.00, (0x32, 0x4C, 0x34)),
]

REPORT: dict[str, dict] = {}
FALLBACKS: list[str] = []


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def ramp_lut(stops) -> np.ndarray:
    """Build a 256x3 uint8 LUT from (position, rgb) stops."""
    xs = np.array([s[0] for s in stops]) * 255.0
    cols = np.array([s[1] for s in stops], dtype=float)
    idx = np.arange(256, dtype=float)
    out = np.zeros((256, 3))
    for c in range(3):
        out[:, c] = np.interp(idx, xs, cols[:, c])
    return np.clip(out, 0, 255).astype(np.uint8)


def luminance(rgb: np.ndarray) -> np.ndarray:
    return (
        0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    )


def normalize(a: np.ndarray, lo=0.0, hi=1.0) -> np.ndarray:
    mn, mx = float(a.min()), float(a.max())
    if mx - mn < 1e-6:
        return np.full_like(a, (lo + hi) * 0.5)
    return lo + (a - mn) / (mx - mn) * (hi - lo)


def blur(a: np.ndarray, radius: float, wrap=True) -> np.ndarray:
    """Gaussian blur a float 0..1 plane.

    `wrap=True` pads by wrapping before blurring. Without it PIL clamps at the
    border, the local-contrast pass then disagrees across the tile edge, and an
    input that WAS seamless comes out with a visible seam - which force_seamless
    then "repairs" into an obvious mirrored blob. Keeping every filter
    wrap-aware is what lets the photoscans stay seamless end to end.
    """
    h, w = a.shape
    pad = int(np.ceil(radius * 3)) + 2 if wrap else 0
    src = np.pad(np.clip(a, 0, 1), pad, mode="wrap") if pad else np.clip(a, 0, 1)
    out = (
        np.asarray(
            Image.fromarray((src * 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(radius)
            ),
            dtype=float,
        )
        / 255.0
    )
    return out[pad : pad + h, pad : pad + w] if pad else out


def prep_lum(img: Image.Image, detail=1.0) -> np.ndarray:
    """Luminance, percentile-stretched, with local contrast restored.

    A straight min/max normalize on a downscaled photoscan reads as flat mud:
    a handful of outlier pixels own the whole range. Stretching on the 1st/99th
    percentile and adding the high-frequency residual back keeps the fibrous
    grass/rock detail that makes the ground read as a real surface.
    """
    lum = luminance(np.asarray(img.convert("RGB"), dtype=float))
    lo, hi = np.percentile(lum, [1.0, 99.0])
    lum = np.clip((lum - lo) / max(hi - lo, 1e-6), 0.0, 1.0)
    if detail > 0:
        for radius, amount in ((1.2, 0.55 * detail), (5.0, 0.80 * detail)):
            lum = np.clip(lum + (lum - blur(lum, radius)) * amount, 0.0, 1.0)
    return lum


def night_grade(
    img: Image.Image,
    stops,
    contrast=1.0,
    chroma=0.10,
    detail=1.0,
    macro=0.0,
    macro_seed=1,
) -> Image.Image:
    """Map an albedo's luminance through a palette ramp.

    Keeps a fraction of the original chroma so the material still varies, but
    the VALUE is fully controlled by the ramp - which is what keeps every
    surface inside the spec's 0.06-0.22 window. `macro` adds tileable
    low-frequency patchiness so no two regions of a repeated tile match.
    """
    a = np.asarray(img.convert("RGB"), dtype=float)
    lum = prep_lum(img, detail=detail)
    lum = np.clip((lum - 0.5) * contrast + 0.5, 0.0, 1.0)
    if macro > 0:
        n = value_noise(max(a.shape[0], a.shape[1]), (2, 4, 8), seed=macro_seed)
        n = n[: a.shape[0], : a.shape[1]]
        lum = np.clip(lum + (n - 0.5) * macro, 0.0, 1.0)
    lut = ramp_lut(stops).astype(float)
    idx = (lum * 255).astype(np.uint8)
    out = lut[idx]
    if chroma > 0:
        srclum = np.clip(luminance(a), 1e-6, None)
        dev = a - srclum[..., None]
        out = out + dev * chroma
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def tiling_error(img: Image.Image) -> float:
    """Wrap-seam discontinuity RELATIVE to the texture's own local contrast.

    An absolute seam delta is meaningless on a noisy photoscan: neighbouring
    pixels of a perfectly seamless grass scan already differ by ~10/255, so a
    raw threshold flags every real texture as broken. Dividing the seam delta by
    the mean interior adjacent-pixel delta gives a scale-free ratio - 1.0 means
    "the seam is as continuous as any other pixel boundary".
    """
    a = np.asarray(img.convert("RGB"), dtype=float)
    h_err = np.abs(a[:, 0, :] - a[:, -1, :]).mean()
    v_err = np.abs(a[0, :, :] - a[-1, :, :]).mean()
    h_ref = np.abs(a[:, 1:, :] - a[:, :-1, :]).mean()
    v_ref = np.abs(a[1:, :, :] - a[:-1, :, :]).mean()
    ref = max((h_ref + v_ref) * 0.5, 1e-3)
    return float(((h_err + v_err) * 0.5) / ref)


# A seam within 1.6x of the texture's own interior contrast is invisible in
# motion at the sweep camera's zoom.
SEAM_OK = 1.6


def force_seamless(img: Image.Image, feather: int = 48) -> Image.Image:
    """Offset-and-blend so opposite edges match exactly.

    Wraps the image by half, then cross-fades the (now central) seam with the
    mirrored neighbourhood. Idempotent enough to run on already-seamless input.
    """
    a = np.asarray(img.convert("RGB"), dtype=float)
    h, w, _ = a.shape
    b = np.roll(np.roll(a, w // 2, axis=1), h // 2, axis=0)

    # Horizontal seam repair at x = w//2
    x0 = w // 2
    ramp = np.linspace(0, 1, feather * 2)[None, :, None]
    left = b[:, x0 - feather : x0 + feather, :]
    mirror = b[:, x0 + feather - 1 : x0 - feather - 1 : -1, :]
    b[:, x0 - feather : x0 + feather, :] = left * (1 - ramp) + mirror * ramp

    # Vertical seam repair at y = h//2
    y0 = h // 2
    rampv = np.linspace(0, 1, feather * 2)[:, None, None]
    top = b[y0 - feather : y0 + feather, :, :]
    mirrorv = b[y0 + feather - 1 : y0 - feather - 1 : -1, :, :]
    b[y0 - feather : y0 + feather, :, :] = top * (1 - rampv) + mirrorv * rampv

    # Roll back so the repaired region returns to the interior.
    b = np.roll(np.roll(b, -(h // 2), axis=0), -(w // 2), axis=1)
    return Image.fromarray(np.clip(b, 0, 255).astype(np.uint8), "RGB")


def ensure_seamless(img: Image.Image, name: str) -> Image.Image:
    before = tiling_error(img)
    if before <= SEAM_OK:
        REPORT.setdefault(name, {})["tiling"] = {"before": round(before, 2), "forced": False}
        return img
    fixed = force_seamless(img)
    after = tiling_error(fixed)
    REPORT.setdefault(name, {})["tiling"] = {
        "before": round(before, 2),
        "after": round(after, 2),
        "forced": True,
    }
    return fixed


def value_stats(img: Image.Image) -> dict:
    a = np.asarray(img.convert("RGB"), dtype=float) / 255.0
    v = a.max(axis=2)
    return {"vMin": round(float(v.min()), 3), "vMean": round(float(v.mean()), 3),
            "vMax": round(float(v.max()), 3)}


def value_noise(size: int, octaves=(4, 8, 16, 32, 64), seed=1337) -> np.ndarray:
    """Tileable fractal value noise in 0..1."""
    rng = np.random.default_rng(seed)
    acc = np.zeros((size, size))
    amp_total = 0.0
    for i, f in enumerate(octaves):
        amp = 0.5 ** i
        grid = rng.random((f, f))
        grid = np.vstack([grid, grid[:1]])
        grid = np.hstack([grid, grid[:, :1]])
        layer = np.asarray(
            Image.fromarray((grid * 255).astype(np.uint8)).resize(
                (size + size // f, size + size // f), Image.BICUBIC
            ),
            dtype=float,
        )[:size, :size] / 255.0
        acc += layer * amp
        amp_total += amp
    return normalize(acc / amp_total)


def relight(rgb: np.ndarray, height: np.ndarray, strength=0.55, ambient=0.55,
            wrap=False) -> np.ndarray:
    """Directional relight from a height field, fixed upper-left light."""
    if wrap:
        h, w = height.shape
        p = np.pad(height.astype(float), 2, mode="wrap")
        gy, gx = (g[2 : 2 + h, 2 : 2 + w] for g in np.gradient(p))
    else:
        gy, gx = np.gradient(height.astype(float))
    n = np.dstack([-gx * strength * 24.0, -gy * strength * 24.0, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    lam = np.clip((n * LIGHT[None, None, :]).sum(axis=2), 0, 1)
    shade = ambient + (1 - ambient) * lam
    # Chassis-free specular: narrow highlight on steep light-facing slopes.
    spec = np.clip(lam, 0, 1) ** 18 * 0.35
    out = rgb * shade[..., None] + spec[..., None] * 255.0
    return np.clip(out, 0, 255)


def load_original(*candidates) -> Image.Image | None:
    for c in candidates:
        p = os.path.join(ORIG, c)
        if os.path.exists(p):
            return Image.open(p).convert("RGB")
    return None


def synth_ground(size: int, seed: int) -> Image.Image:
    """Procedural fallback: fibrous grass-like albedo, tileable by construction."""
    rng = np.random.default_rng(seed)
    base = value_noise(size, (4, 8, 16, 32), seed=seed)
    fib = value_noise(size, (32, 64, 128), seed=seed + 7)
    a = normalize(base * 0.55 + fib * 0.45)
    # Blade streaks
    streak = np.zeros((size, size))
    for _ in range(size * 3):
        x = rng.integers(0, size)
        y = rng.integers(0, size)
        ln = rng.integers(6, 22)
        for k in range(ln):
            streak[(y + k) % size, (x + k // 3) % size] += 1.0 - k / ln
    streak = normalize(streak)
    a = np.clip(a * 0.75 + streak * 0.25, 0, 1)
    g = (a * 255).astype(np.uint8)
    return Image.fromarray(np.dstack([g, g, g]), "RGB")


def save_tile(img: Image.Image, name: str, quality=WEBP_Q):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    img.convert("RGB").save(p, "WEBP", quality=quality, method=6)
    REPORT.setdefault(name, {})["bytes"] = os.path.getsize(p)
    REPORT[name].update(value_stats(img))
    print(f"  tile {name:22s} {os.path.getsize(p)/1024:7.1f} KB  {value_stats(img)}")


def save_sprite(img: Image.Image, name: str):
    os.makedirs(SPRITES, exist_ok=True)
    p = os.path.join(SPRITES, f"{name}.png")
    img.save(p)
    print(f"  sprite {name:20s} {img.size[0]}x{img.size[1]}  {os.path.getsize(p)/1024:6.1f} KB")


# --------------------------------------------------------------------------
# ground / path / wall tiles
# --------------------------------------------------------------------------
def build_tiles():
    print("ground + wall tiles")
    grass = load_original(
        "polyhaven_aerial_grass_rock_diff_1k.jpg", "ambientcg_grass004_color.jpg"
    )
    soil = load_original(
        "polyhaven_aerial_ground_rock_diff_1k.jpg", "ambientcg_ground037_color.jpg"
    )
    rock = load_original(
        "polyhaven_aerial_rocks_02_diff_1k.jpg", "ambientcg_rock030_color.jpg"
    )
    grassB = load_original("ambientcg_grass004_color.jpg") or grass

    if grass is None:
        FALLBACKS.append("td-ground/td-ground-lit/td-ground-dark (grass source unreachable)")
        grass = synth_ground(TILE, 11)
    if soil is None:
        FALLBACKS.append("td-path (soil source unreachable)")
        soil = synth_ground(TILE, 23)
    if rock is None:
        FALLBACKS.append("td-wall-top/td-wall-face (rock source unreachable)")
        rock = synth_ground(TILE, 31)
    if grassB is None:
        grassB = grass

    grass = grass.resize((TILE, TILE), Image.LANCZOS)
    grassB = grassB.resize((TILE, TILE), Image.LANCZOS)
    soil = soil.resize((TILE, TILE), Image.LANCZOS)
    rock = rock.resize((TILE, TILE), Image.LANCZOS)

    # Blend two grass albedos so the base material is not a single photo. The
    # mask is hard-edged (a thresholded noise, softened only slightly) rather
    # than a smooth lerp - averaging two photoscans destroys local contrast and
    # produces the flat mud the spec calls an anti-goal.
    raw = value_noise(TILE, (2, 4, 8), seed=99)
    mask = np.clip((raw - 0.5) * 5.0 + 0.5, 0, 1)
    ga = np.asarray(grass, float)
    gb = np.asarray(grassB, float)
    blended = Image.fromarray(
        np.clip(ga * mask[..., None] + gb * (1 - mask[..., None]), 0, 255).astype(np.uint8),
        "RGB",
    )

    base = ensure_seamless(
        night_grade(blended, RAMP_GROUND, contrast=1.30, detail=1.2, macro=0.30, macro_seed=5),
        "td-ground",
    )
    save_tile(base, "td-ground.webp")

    lit = ensure_seamless(
        night_grade(blended, RAMP_GROUND_LIT, contrast=1.30, detail=1.2, macro=0.26,
                    macro_seed=6),
        "td-ground-lit",
    )
    save_tile(lit, "td-ground-lit.webp")

    dark = ensure_seamless(
        night_grade(blended, RAMP_GROUND_DARK, contrast=1.15, chroma=0.05, detail=1.0,
                    macro=0.24, macro_seed=7),
        "td-ground-dark",
    )
    save_tile(dark, "td-ground-dark.webp")

    # Path: soil ramp + a broad wet sheen. Kept low-contrast and cool-tinted -
    # bright specks read as noise, a wide gentle pool reads as damp earth.
    path = night_grade(soil, RAMP_PATH, contrast=1.2, chroma=0.06, detail=1.1, macro=0.20,
                       macro_seed=8)
    sheen = value_noise(TILE, (3, 6, 12), seed=404)
    sheen = np.clip((sheen - 0.55) * 2.0, 0, 1) ** 1.2
    pa = np.asarray(path, float)
    pa = pa + sheen[..., None] * np.array([9.0, 13.0, 16.0])[None, None, :]
    path = ensure_seamless(Image.fromarray(np.clip(pa, 0, 255).astype(np.uint8), "RGB"),
                           "td-path")
    save_tile(path, "td-path.webp")

    # Wall top cap: hedge crown read from directly above - relit so the bevel
    # already carries form before any runtime light touches it.
    top = night_grade(rock, RAMP_WALLTOP, contrast=1.35, chroma=0.10, detail=1.2, macro=0.28,
                      macro_seed=12)
    hgt = np.asarray(top.convert("L"), float) / 255.0
    hgt = blur(hgt, 2.0, wrap=True)
    top = Image.fromarray(
        relight(np.asarray(top, float), hgt, strength=0.5, ambient=0.62,
                wrap=True).astype(np.uint8), "RGB"
    )
    top = ensure_seamless(top, "td-wall-top")
    save_tile(top, "td-wall-top.webp")

    # Wall face strip: the extruded vertical face. Directionally relit top-to-
    # bottom (bright lip, dark base) so the extrusion reads dimensional, and
    # horizontally wrappable so tileSprite can repeat it along any wall run.
    face_src = rock.resize((TILE, FACE_H), Image.LANCZOS)
    face = night_grade(face_src, RAMP_WALLTOP, contrast=1.4, chroma=0.08, detail=1.3)
    fa = np.asarray(face, float)
    yy = np.linspace(0, 1, FACE_H)[:, None, None]
    # Bright cap lip at the top, falling to a deep cool base shadow.
    lipglow = np.clip(1.0 - yy * 6.0, 0, 1) ** 1.4
    falloff = 0.95 - 0.62 * yy ** 1.25
    fa = fa * falloff + lipglow * np.array([44.0, 58.0, 46.0])[None, None, :]
    # Cool blue-shifted base contact band (shadows are never pure black).
    basedark = np.clip((yy - 0.72) / 0.28, 0, 1) ** 1.5
    fa = fa * (1 - basedark * 0.45) + basedark * np.array([6.0, 10.0, 12.0])[None, None, :]
    face = Image.fromarray(np.clip(fa, 0, 255).astype(np.uint8), "RGB")
    # Only the horizontal seam matters for a strip; feather it directly.
    fa = np.asarray(face, float)
    f = 40
    ramp = np.linspace(0, 1, f)[None, :, None]
    fa[:, :f, :] = fa[:, :f, :] * ramp + fa[:, -f:, :][:, ::-1, :] * (1 - ramp)
    face = Image.fromarray(np.clip(fa, 0, 255).astype(np.uint8), "RGB")
    REPORT.setdefault("td-wall-face", {})["tiling"] = {
        "before": round(tiling_error(face), 2), "forced": True, "axis": "horizontal-only"
    }
    save_tile(face, "td-wall-face.webp")

    return {"rock": rock, "soil": soil, "grass": grass}


# --------------------------------------------------------------------------
# rock / log / debris props with baked contact AO
# --------------------------------------------------------------------------
def blob_height(w: int, h: int, seed: int, lumps=7, squash=1.0) -> np.ndarray:
    """Organic dome height field in 0..1, zero at the silhouette edge."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    acc = np.zeros((h, w))
    for i in range(lumps):
        cx = w * (0.5 + rng.uniform(-0.22, 0.22))
        cy = h * (0.55 + rng.uniform(-0.18, 0.18))
        rx = w * rng.uniform(0.22, 0.42)
        ry = h * rng.uniform(0.22, 0.42) * squash
        d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
        acc = np.maximum(acc, np.clip(1.0 - d, 0, 1) ** 0.6)
    acc *= 0.85 + 0.15 * value_noise(max(w, h), (8, 16, 32), seed=seed + 3)[:h, :w]
    return np.clip(acc, 0, 1)


def prop_from_height(hgt: np.ndarray, albedo: Image.Image, stops, pad=14,
                     contact=0.85, seed=0) -> Image.Image:
    """Shade a height field with the fixed light, cut alpha, bake a contact AO."""
    h, w = hgt.shape
    # Blur the albedo before grading: at prop scale the photoscan's lichen
    # speckle out-shouts the silhouette and the object stops reading as solid.
    # Form comes from the relight, not from borrowed pixel noise.
    small = albedo.resize((w, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.6))
    src = np.asarray(small, float)
    graded = np.asarray(
        night_grade(Image.fromarray(src.astype(np.uint8), "RGB"), stops,
                    contrast=0.9, chroma=0.08, detail=0.25),
        float,
    )
    shaded = relight(graded, hgt, strength=0.9, ambient=0.42)

    # Rim light on the light-facing upper-left edge (cool moonlight).
    edge = np.asarray(
        Image.fromarray((hgt * 255).astype(np.uint8)).filter(ImageFilter.FIND_EDGES), float
    ) / 255.0
    gy, gx = np.gradient(hgt)
    facing = np.clip(-(gx * LIGHT[0] + gy * LIGHT[1]) * 8.0, 0, 1)
    rim = np.clip(edge * facing, 0, 1) ** 0.8
    shaded = shaded + rim[..., None] * np.array([44.0, 62.0, 70.0])[None, None, :]

    alpha = np.clip(hgt * 6.0, 0, 1)
    alpha = np.asarray(
        Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)),
        np.uint8,
    )

    canvas = Image.new("RGBA", (w, h + pad), (0, 0, 0, 0))

    # Baked contact shadow: an ellipse offset down-right from the upper-left
    # light, cool and blue-shifted, never pure black.
    sh = Image.new("L", (w, h + pad), 0)
    d = ImageDraw.Draw(sh)
    foot = np.where(hgt.max(axis=0) > 0.05)[0]
    if len(foot):
        x0, x1 = int(foot[0]), int(foot[-1])
    else:
        x0, x1 = 0, w - 1
    cw = (x1 - x0) * 0.92
    cy = h + pad - pad * 0.75
    d.ellipse(
        [x0 + (x1 - x0) * 0.04 + cw * 0.06, cy - cw * 0.20 * 0.55,
         x0 + (x1 - x0) * 0.04 + cw, cy + cw * 0.20 * 0.55],
        fill=int(255 * contact),
    )
    sh = sh.filter(ImageFilter.GaussianBlur(w * 0.045 + 2))
    shadow_rgba = Image.merge(
        "RGBA",
        (
            Image.new("L", sh.size, 8),
            Image.new("L", sh.size, 14),
            Image.new("L", sh.size, 18),
            sh.point(lambda v: int(v * 0.72)),
        ),
    )
    canvas.alpha_composite(shadow_rgba)

    body = Image.fromarray(
        np.dstack([np.clip(shaded, 0, 255).astype(np.uint8), alpha]), "RGBA"
    )
    canvas.alpha_composite(body, (0, 0))
    return canvas


def build_props(mats):
    print("rock / log / debris props")
    rock = mats["rock"]
    soil = mats["soil"]

    # td-rock - single boulder, ~96px authored (48 on screen)
    h = blob_height(96, 84, seed=5, lumps=6)
    save_sprite(prop_from_height(h, rock, RAMP_ROCK, pad=16, seed=5), "td-rock")

    # td-log - fallen log, long low cylinder read at a slight angle
    w, hh = 128, 56
    yy, xx = np.mgrid[0:hh, 0:w].astype(float)
    axis = hh * 0.5 + np.sin(xx / w * np.pi) * 5.0
    r = np.clip(1.0 - ((yy - axis) / (hh * 0.34)) ** 2, 0, 1)
    caps = np.clip(np.minimum(xx / 10.0, (w - 1 - xx) / 10.0), 0, 1)
    log_h = np.sqrt(np.clip(r, 0, 1)) * caps
    log_h *= 0.9 + 0.1 * value_noise(128, (16, 32, 64), seed=61)[:hh, :w]
    save_sprite(prop_from_height(log_h, rock, RAMP_WOOD, pad=14, seed=61), "td-log")

    # td-debris - scatter of small broken stones
    d = blob_height(72, 60, seed=17, lumps=9, squash=0.7)
    d = np.where(value_noise(72, (8, 16, 32), seed=71)[:60, :72] > 0.42, d, d * 0.15)
    save_sprite(prop_from_height(d, soil, RAMP_ROCK, pad=12, contact=0.6, seed=17), "td-debris")

    # td-scrap - angular torn metal panel, the Engine's litter
    w, hh = 64, 52
    rng = np.random.default_rng(3)
    poly = Image.new("L", (w, hh), 0)
    pd = ImageDraw.Draw(poly)
    pts = []
    for i in range(7):
        a = i / 7 * 6.28318
        rr = 0.5 + rng.uniform(-0.16, 0.10)
        pts.append((w * 0.5 + np.cos(a) * w * rr, hh * 0.55 + np.sin(a) * hh * rr * 0.8))
    pd.polygon(pts, fill=255)
    mask = np.asarray(poly, float) / 255.0
    plate = np.clip(mask, 0, 1) * (0.55 + 0.45 * value_noise(64, (8, 16), seed=9)[:hh, :w])
    plate = plate * np.asarray(
        Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)),
        float,
    ) / 255.0
    save_sprite(
        prop_from_height(plate, rock, RAMP_ROCK, pad=10, contact=0.55, seed=9), "td-scrap"
    )


# --------------------------------------------------------------------------
# foliage from the Kenney CC0 silhouettes
# --------------------------------------------------------------------------
KENNEY_PICKS = {
    # Picks are by eye from the pack's 50 unnamed silhouettes (sprite_0052..0101):
    # 0052 grass tuft, 0074 upright fern fronds, 0090 compact shrub crown,
    # 0091 full round crown. The 01xx sprites are loose leaf scatters and read
    # as floating debris once shaded - deliberately not used.
    "td-tuft": ("sprite_0052.png", 72, RAMP_FOLIAGE, "flat"),
    "td-fern": ("sprite_0074.png", 96, RAMP_FOLIAGE, "flat"),
    "td-bush": ("sprite_0090.png", 112, RAMP_FOLIAGE, "dome"),
    "td-canopy": ("sprite_0091.png", 208, RAMP_CANOPY, "crown"),
}


def synth_foliage(size: int, kind: str, seed: int) -> Image.Image:
    """Procedural fallback silhouette if the Kenney pack is unreachable."""
    rng = np.random.default_rng(seed)
    im = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(im)
    if kind == "flat":
        for _ in range(26):
            x = size * rng.uniform(0.2, 0.8)
            d.polygon(
                [(x, size * rng.uniform(0.05, 0.4)), (x - 4, size * 0.95), (x + 4, size * 0.95)],
                fill=255,
            )
    else:
        for _ in range(60):
            a = rng.uniform(0, 6.28318)
            r = size * 0.34 * rng.uniform(0.2, 1.0)
            cx = size / 2 + np.cos(a) * r
            cy = size / 2 + np.sin(a) * r
            rr = size * rng.uniform(0.07, 0.16)
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=255)
    return im.convert("RGBA")


def build_foliage():
    print("foliage")
    have_kenney = os.path.isdir(KENNEY)
    if not have_kenney:
        FALLBACKS.append("td-tuft/td-fern/td-bush/td-canopy (Kenney pack unreachable)")

    for name, (fn, size, stops, mode) in KENNEY_PICKS.items():
        p = os.path.join(KENNEY, fn)
        if have_kenney and os.path.exists(p):
            src = Image.open(p).convert("RGBA")
            bbox = src.split()[3].getbbox()
            if bbox:
                src = src.crop(bbox)
            src.thumbnail((size, size), Image.LANCZOS)
        else:
            src = synth_foliage(size, "flat" if mode == "flat" else "dome", 7)

        w, h = src.size
        a = np.asarray(src, float)
        alpha = a[..., 3] / 255.0
        # Kenney art is a white-to-grey gradient silhouette: its luminance is a
        # usable form cue, so grade it straight through the foliage ramp.
        lum = normalize(luminance(a[..., :3]))
        lut = ramp_lut(stops).astype(float)
        rgb = lut[(lum * 255).astype(np.uint8)]

        if mode in ("dome", "crown"):
            # Radial falloff relight: lit crown, dark underside. Per the plan
            # this is the main dimensional cue in a top-down forest.
            yy, xx = np.mgrid[0:h, 0:w].astype(float)
            dome = np.clip(
                1.0 - (((xx - w * 0.42) / (w * 0.55)) ** 2 + ((yy - h * 0.38) / (h * 0.55)) ** 2),
                0, 1,
            ) ** 0.7
            dome *= alpha
            rgb = relight(rgb, dome, strength=1.0, ambient=0.40)
            under = np.clip((yy / h - 0.45) / 0.55, 0, 1) ** 1.3
            rgb = rgb * (1 - under * 0.55)[..., None] + under[..., None] * np.array(
                [5.0, 9.0, 8.0]
            )
        else:
            hgt = alpha * (0.35 + 0.65 * (1.0 - np.mgrid[0:h, 0:w][0] / h))
            rgb = relight(rgb, hgt, strength=0.8, ambient=0.5)

        pad = max(8, h // 9)
        canvas = Image.new("RGBA", (w, h + pad), (0, 0, 0, 0))
        sh = Image.new("L", (w, h + pad), 0)
        sd = ImageDraw.Draw(sh)
        cw = w * 0.78
        cy = h + pad * 0.25
        sd.ellipse([w / 2 - cw / 2 + cw * 0.06, cy - cw * 0.22 * 0.55,
                    w / 2 + cw / 2 + cw * 0.06, cy + cw * 0.22 * 0.55],
                   fill=190 if mode != "crown" else 220)
        sh = sh.filter(ImageFilter.GaussianBlur(w * 0.05 + 2))
        canvas.alpha_composite(
            Image.merge("RGBA", (Image.new("L", sh.size, 8), Image.new("L", sh.size, 14),
                                 Image.new("L", sh.size, 18),
                                 sh.point(lambda v: int(v * 0.7))))
        )
        body = Image.fromarray(
            np.dstack([np.clip(rgb, 0, 255).astype(np.uint8),
                       (alpha * 255).astype(np.uint8)]), "RGBA"
        )
        canvas.alpha_composite(body, (0, 0))
        save_sprite(canvas, name)


# --------------------------------------------------------------------------
def main():
    if not os.path.isdir(ORIG):
        print("art-src/originals missing - run: node scripts/art/fetch-sources.mjs",
              file=sys.stderr)
    mats = build_tiles()
    build_props(mats)
    build_foliage()

    total = sum(
        os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)
        if f.endswith(".webp")
    )
    REPORT["_summary"] = {
        "tileBytes": total,
        "fallbacks": FALLBACKS,
        "lightDirection": "upper-left",
    }
    os.makedirs(os.path.join(ROOT, "art-src"), exist_ok=True)
    with open(os.path.join(ROOT, "art-src", "process-report.json"), "w") as f:
        json.dump(REPORT, f, indent=2)
    print(f"\ntiles total {total/1024:.1f} KB")
    if FALLBACKS:
        print("FALLBACKS USED:")
        for f in FALLBACKS:
            print("  -", f)


if __name__ == "__main__":
    main()
