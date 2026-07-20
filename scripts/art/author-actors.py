#!/usr/bin/env python3
"""
BLIP top-down art pipeline - Phase 3, step 3.

Authors the HD actor sprites. No CC0 pack contains CONTACT-47, and a generic
stock drone is the one place this overhaul would read as asset-flipped - so
every actor here is built from scratch with numpy/PIL: real gradient shading
from an implicit height field, a fixed upper-left key light, a cool moonlit rim
on the shaded edge, a tight chassis specular, and a baked contact shadow.

Emissives - CONTACT-47's visor, the drones' eyes, the Node's core - are emitted
as SEPARATE additive-layer PNGs (`*-emis.png`) so the runtime can pulse them
without touching the body. Bodies carry no emissive light of their own beyond
the faint bloom already bounced onto the surrounding chassis.

Authored at ~2x intended on-screen size (see SPECS below); the runtime scales
down with LINEAR filtering, which is what buys the smooth HD read.

Outputs (PNG, RGBA, into art-src/sprites/ for build-atlas.mjs to pack):
  td-blip / td-blip-emis
  td-drifter td-tagger td-diver td-warden td-sniper td-splitter td-weaver
  td-turret  (+ -emis for each)
  td-elite / td-elite-emis
  td-node / td-node-emis

Usage: python3 scripts/art/author-actors.py
"""
from __future__ import annotations

import os
import warnings

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

warnings.filterwarnings("ignore", message=".*'mode' parameter is deprecated.*")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPRITES = os.path.join(ROOT, "art-src", "sprites")

SS = 4  # supersample factor - draw big, downsample, get clean HD edges

# Same fixed key light as process.py: upper-left.
LIGHT = np.array([-0.62, -0.62, 0.48])
LIGHT /= np.linalg.norm(LIGHT)

# Intended on-screen sizes (TOPDOWN_VISUAL_PLAN Phase 3); authored at 2x.
SPECS = {"player": 28, "drone": 22, "elite": 40, "node": 56}

# --- palette, matched to src/game/config.ts (read-only reference) ------------
SHELL_HI = (255, 251, 239)      # P.shellHi
SHELL_WHITE = (242, 234, 216)   # P.shellWhite
SHELL_MID = (221, 209, 183)     # P.shellMid
SHELL_SHADE = (201, 189, 164)   # P.shellShade
SHELL_DEEP = (154, 140, 112)    # P.shellDeep
SHELL_RIM = (116, 219, 228)     # P.shellRim - cool moonlit rim
FACEPLATE = (38, 46, 52)
SIGNAL = (124, 220, 106)        # P.signalGreen
VISOR_GLOW = (201, 255, 224)    # P.visorGlow

CHASSIS_HI = (118, 132, 156)
CHASSIS_MID = (72, 84, 106)
CHASSIS_MID_D = (48, 58, 76)
CHASSIS_DEEP = (24, 30, 42)     # dark navy / slate
CHASSIS_RIM = (120, 176, 200)
DANGER = (216, 74, 66)          # P.danger
DANGER_HOT = (255, 122, 74)     # hot filament, still unmistakably red
WARNING = (232, 168, 72)
VIOLET = (150, 110, 210)

NODE_STONE_HI = (96, 110, 108)
NODE_STONE = (52, 62, 62)
NODE_STONE_D = (24, 30, 32)
NODE_CORE = (150, 255, 190)

SHADOW_TINT = (8, 14, 18)       # cool, blue-shifted - never pure black


# ---------------------------------------------------------------------------
# core shading
# ---------------------------------------------------------------------------
def blur(a: np.ndarray, r: float) -> np.ndarray:
    return (
        np.asarray(
            Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(r)
            ),
            dtype=float,
        )
        / 255.0
    )


def mask_from_draw(w: int, h: int, fn) -> np.ndarray:
    """Render a drawing callback at SSx and return an antialiased 0..1 mask."""
    im = Image.new("L", (w * SS, h * SS), 0)
    fn(ImageDraw.Draw(im), SS)
    return np.asarray(im.resize((w, h), Image.LANCZOS), dtype=float) / 255.0


def dome(mask: np.ndarray, power=0.55, soften=2.0) -> np.ndarray:
    """Turn a flat silhouette into a rounded height field.

    A distance-transform-ish falloff via repeated blur: the interior rises, the
    silhouette edge stays at zero. This is what gives every actor real gradient
    shading instead of flat fill.
    """
    h = mask.copy()
    acc = np.zeros_like(mask)
    for r in (soften, soften * 2.2, soften * 4.5):
        acc += blur(h, r)
    acc /= 3.0
    acc *= mask
    mx = acc.max()
    if mx > 1e-6:
        acc /= mx
    return np.clip(acc, 0, 1) ** power


def shade(
    height: np.ndarray,
    mask: np.ndarray,
    base_hi,
    base_mid,
    base_deep,
    ambient=0.34,
    spec=0.55,
    spec_tight=26.0,
    rim_col=None,
    rim_amt=0.9,
) -> np.ndarray:
    """Light a height field with the fixed key: diffuse ramp + specular + rim."""
    gy, gx = np.gradient(height)
    n = np.dstack([-gx * 9.0, -gy * 9.0, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    lam = np.clip((n * LIGHT[None, None, :]).sum(axis=2), 0, 1)

    # Three-stop material ramp driven by the diffuse term - a real form ramp,
    # not a two-tone cel fill.
    t = np.clip(ambient + (1 - ambient) * lam, 0, 1)
    hi = np.array(base_hi, float)
    mid = np.array(base_mid, float)
    deep = np.array(base_deep, float)
    lo_t = np.clip(t / 0.55, 0, 1)[..., None]
    hi_t = np.clip((t - 0.55) / 0.45, 0, 1)[..., None]
    rgb = deep + (mid - deep) * lo_t
    rgb = rgb + (hi - rgb) * hi_t

    # Chassis specular: a narrow highlight on light-facing curvature.
    # Halfway vector against a straight-up view direction.
    hvec = LIGHT + np.array([0.0, 0.0, 1.0])
    hvec /= np.linalg.norm(hvec)
    ndoth = np.clip((n * hvec[None, None, :]).sum(axis=2), 0, 1)
    rgb = rgb + (ndoth**spec_tight * spec * 255.0)[..., None]

    # Rim: the moonlit edge on the side AWAY from the key, per spec section 5.
    if rim_col is not None:
        edge = np.clip(mask - blur(mask, 1.6), 0, 1)
        away = np.clip(-(gx * -LIGHT[0] + gy * -LIGHT[1]) * 7.0, 0, 1)
        rim = np.clip(edge * 3.0, 0, 1) * away
        rgb = rgb + rim[..., None] * np.array(rim_col, float) * rim_amt

    return np.clip(rgb, 0, 255)


def compose(
    rgb: np.ndarray,
    mask: np.ndarray,
    pad_below: int,
    shadow_w: float,
    shadow_alpha=0.62,
    shadow_soft=None,
    detach=0.0,
) -> Image.Image:
    """Place the shaded body on a canvas with a baked contact shadow.

    `detach` lifts and softens the shadow for hovering actors - the drones fly,
    so their shadow separates from their feet, which is the cue that sells the
    hover in a top-down view.
    """
    h, w = mask.shape
    ch = h + pad_below
    canvas = Image.new("RGBA", (w, ch), (0, 0, 0, 0))

    sh = Image.new("L", (w, ch), 0)
    d = ImageDraw.Draw(sh)
    cy = h + pad_below * (0.35 + detach * 0.5)
    sw = shadow_w * (1.0 + detach * 0.35)
    # Offset down-right: the key light is upper-left.
    cx = w * 0.5 + sw * 0.10
    d.ellipse([cx - sw / 2, cy - sw * 0.28, cx + sw / 2, cy + sw * 0.28],
              fill=int(255 * shadow_alpha))
    soft = shadow_soft if shadow_soft is not None else (w * 0.05 + 1.5 + detach * w * 0.10)
    sh = sh.filter(ImageFilter.GaussianBlur(soft))
    canvas.alpha_composite(
        Image.merge(
            "RGBA",
            (
                Image.new("L", sh.size, SHADOW_TINT[0]),
                Image.new("L", sh.size, SHADOW_TINT[1]),
                Image.new("L", sh.size, SHADOW_TINT[2]),
                sh,
            ),
        )
    )
    body = Image.fromarray(
        np.dstack([rgb.astype(np.uint8), (np.clip(mask, 0, 1) * 255).astype(np.uint8)]),
        "RGBA",
    )
    canvas.alpha_composite(body, (0, 0))
    return canvas


def emissive_layer(w: int, ch: int, blobs, glow_scale=1.0) -> Image.Image:
    """Build the separate ADDITIVE emissive layer.

    Runtime blends this with ADD and pulses its alpha. Kept as its own file so a
    pulse never has to re-tint the chassis. Each blob is a hot core plus a wide
    soft bloom, which is what stops an emissive from looking like a flat dot.
    """
    yy, xx = np.mgrid[0:ch, 0:w].astype(float)
    inten = np.zeros((ch, w), float)          # total emissive energy
    colour = np.zeros((ch, w, 3), float)      # energy-weighted colour
    corefield = np.zeros((ch, w), float)      # hot centre only

    for (x, y, r, col, intensity) in blobs:
        dist = np.hypot(xx - x, yy - y)
        # Hot core: near-solid inside r, feathered over one pixel band.
        core = np.clip((r - dist) / max(r * 0.35, 0.8), 0, 1) * intensity
        # Bloom: a tight quadratic falloff. A wide, strong bloom is what turned
        # every drone eye into a pale blob - keep it close to the source.
        gr = r * 2.1 * glow_scale
        bloom = np.clip(1.0 - dist / gr, 0, 1) ** 2.2 * intensity * 0.55
        e = np.clip(core + bloom, 0, 1.4)
        inten += e
        colour += e[..., None] * np.array(col, float)
        corefield = np.maximum(corefield, core)

    tot = np.clip(inten, 1e-6, None)
    rgbf = colour / tot[..., None]            # true blob colour, NOT normalised
    # Whiten only the very centre - a hot filament inside a coloured bloom.
    rgbf = rgbf * (1 - corefield[..., None] * 0.18) + 255.0 * corefield[..., None] * 0.18
    a = np.clip(inten, 0, 1) * 255.0
    return Image.fromarray(
        np.dstack([np.clip(rgbf, 0, 255).astype(np.uint8), a.astype(np.uint8)]), "RGBA"
    )


def save(img: Image.Image, name: str):
    os.makedirs(SPRITES, exist_ok=True)
    p = os.path.join(SPRITES, f"{name}.png")
    img.save(p)
    print(f"  {name:18s} {img.size[0]:3d}x{img.size[1]:3d}  {os.path.getsize(p)/1024:6.1f} KB")


# ---------------------------------------------------------------------------
# CONTACT-47
# ---------------------------------------------------------------------------
def build_blip():
    """Small white/cream rounded robot with a wide green visor.

    Silhouette matches sweepTextures.ts' 24x27 hero (rounded shell, two little
    feet, antenna with a signal bulb) - that file stays untouched; this is the
    HD re-authoring of the same character.
    """
    W = SPECS["player"] * 2  # 56
    H = int(W * 1.12)        # 62
    sc = W / 24.0            # scale from the 24px reference drawing

    def body(d, s):
        u = s * sc
        # rounded shell, matching the reference 14x16 footprint
        d.rounded_rectangle([5 * u, 6 * u, 19 * u, 22 * u], radius=6.4 * u, fill=255)
        # feet
        d.rounded_rectangle([6.6 * u, 20 * u, 11 * u, 24 * u], radius=1.4 * u, fill=255)
        d.rounded_rectangle([13 * u, 20 * u, 17.4 * u, 24 * u], radius=1.4 * u, fill=255)
        # antenna shaft + bulb
        d.rounded_rectangle([11.1 * u, 2.4 * u, 12.9 * u, 7 * u], radius=0.8 * u, fill=255)
        d.ellipse([10.2 * u, 1.1 * u, 13.8 * u, 4.7 * u], fill=255)

    mask = mask_from_draw(W, H, body)
    hgt = dome(mask, power=0.5, soften=W * 0.045)
    rgb = shade(
        hgt, mask, SHELL_HI, SHELL_MID, SHELL_DEEP,
        ambient=0.40, spec=0.60, spec_tight=22.0, rim_col=SHELL_RIM, rim_amt=1.0,
    )

    # Visor faceplate: a dark inset panel cut into the shell, with its own
    # subtle curvature so it does not read as a painted-on rectangle.
    def visor(d, s):
        u = s * sc
        d.rounded_rectangle([6.2 * u, 8.4 * u, 17.8 * u, 16.4 * u], radius=3.2 * u, fill=255)

    vmask = mask_from_draw(W, H, visor) * mask
    vh = dome(vmask, power=0.7, soften=W * 0.03)
    vrgb = shade(vh, vmask, (86, 104, 116), FACEPLATE, (14, 20, 26),
                 ambient=0.30, spec=0.75, spec_tight=34.0)
    a = vmask[..., None]
    rgb = rgb * (1 - a) + vrgb * a
    # Contact-shadow the shell just under the visor lip.
    lip = np.clip(blur(vmask, W * 0.02) - vmask, 0, 1)
    rgb *= (1 - lip * 0.35)[..., None]

    pad = max(4, W // 8)
    img = compose(rgb, mask, pad, shadow_w=W * 0.62, shadow_alpha=0.70)
    save(img, "td-blip")

    # Emissive: two eyes, the scanner line between them, the antenna bulb.
    u = sc
    save(
        emissive_layer(
            W, H + pad,
            [
                (9.9 * u, 12.4 * u, 2.5 * u, SIGNAL, 1.0),
                (14.6 * u, 12.4 * u, 2.5 * u, SIGNAL, 1.0),
                (12.2 * u, 12.4 * u, 0.9 * u, VISOR_GLOW, 0.55),
                (12.0 * u, 2.9 * u, 1.5 * u, VISOR_GLOW, 0.85),
            ],
        ),
        "td-blip-emis",
    )


# ---------------------------------------------------------------------------
# drones
# ---------------------------------------------------------------------------
# Each archetype keeps the readable silhouette + colour language it has today
# (sweepTextures.ts) and gains dimensional shading. Chassis is dark navy/slate
# across the board; the accent and the outline are what differentiate them.
DRONES = {
    "drifter":  dict(size=1.00, form="saucer",  accent=DANGER,  eye=1.00),
    "tagger":   dict(size=1.00, form="dome",    accent=VIOLET,  eye=0.95),
    "diver":    dict(size=0.98, form="dart",    accent=WARNING, eye=1.05),
    "warden":   dict(size=1.22, form="shield",  accent=(96, 120, 150), eye=0.95),
    "sniper":   dict(size=1.05, form="barrel",  accent=(210, 96, 90), eye=1.15),
    "splitter": dict(size=1.12, form="split",   accent=(150, 200, 120), eye=0.9),
    "weaver":   dict(size=0.92, form="wings",   accent=(96, 210, 200), eye=0.95),
    "turret":   dict(size=1.18, form="pylon",   accent=WARNING, eye=1.10),
}


def drone_silhouette(form: str, W: int, H: int):
    """Return (body_fn, accent_fn, eye_xy) for an archetype."""
    def base_hull(d, s, inset=0.0):
        d.rounded_rectangle(
            [(0.18 + inset) * W * s, (0.20 + inset) * H * s,
             (0.82 - inset) * W * s, (0.80 - inset) * H * s],
            radius=0.20 * W * s, fill=255,
        )

    if form == "saucer":
        def body(d, s):
            d.ellipse([0.06 * W * s, 0.24 * H * s, 0.94 * W * s, 0.74 * H * s], fill=255)
            base_hull(d, s, 0.06)

        def accent(d, s):
            d.rectangle([0.02 * W * s, 0.44 * H * s, 0.14 * W * s, 0.58 * H * s], fill=255)
            d.rectangle([0.86 * W * s, 0.44 * H * s, 0.98 * W * s, 0.58 * H * s], fill=255)
        return body, accent, (0.5, 0.50)

    if form == "dome":
        def body(d, s):
            base_hull(d, s)
            d.ellipse([0.30 * W * s, 0.02 * H * s, 0.70 * W * s, 0.34 * H * s], fill=255)

        def accent(d, s):
            d.ellipse([0.33 * W * s, 0.04 * H * s, 0.67 * W * s, 0.28 * H * s], fill=255)
        return body, accent, (0.5, 0.54)

    if form == "dart":
        def body(d, s):
            d.polygon(
                [(0.50 * W * s, 0.02 * H * s), (0.90 * W * s, 0.62 * H * s),
                 (0.50 * W * s, 0.92 * H * s), (0.10 * W * s, 0.62 * H * s)],
                fill=255,
            )

        def accent(d, s):
            d.polygon(
                [(0.50 * W * s, 0.10 * H * s), (0.72 * W * s, 0.52 * H * s),
                 (0.50 * W * s, 0.40 * H * s), (0.28 * W * s, 0.52 * H * s)],
                fill=255,
            )
        return body, accent, (0.5, 0.56)

    if form == "shield":
        def body(d, s):
            base_hull(d, s)
            # frontal shield plate - the archetype's whole read
            d.pieslice([0.02 * W * s, 0.02 * H * s, 0.98 * W * s, 0.86 * H * s],
                       200, 340, fill=255)

        def accent(d, s):
            d.pieslice([0.06 * W * s, 0.06 * H * s, 0.94 * W * s, 0.80 * H * s],
                       206, 334, fill=255)
            d.pieslice([0.16 * W * s, 0.16 * H * s, 0.84 * W * s, 0.70 * H * s],
                       206, 334, fill=0)
        return body, accent, (0.5, 0.60)

    if form == "barrel":
        def body(d, s):
            base_hull(d, s, 0.06)
            d.rounded_rectangle([0.42 * W * s, 0.00, 0.58 * W * s, 0.50 * H * s],
                                radius=0.06 * W * s, fill=255)

        def accent(d, s):
            d.rounded_rectangle([0.44 * W * s, 0.02 * H * s, 0.56 * W * s, 0.24 * H * s],
                                radius=0.05 * W * s, fill=255)
        return body, accent, (0.5, 0.62)

    if form == "split":
        def body(d, s):
            d.ellipse([0.10 * W * s, 0.18 * H * s, 0.90 * W * s, 0.86 * H * s], fill=255)

        def accent(d, s):
            for k in range(3):
                y = (0.30 + k * 0.18) * H * s
                d.rectangle([0.22 * W * s, y, 0.78 * W * s, y + 0.045 * H * s], fill=255)
        return body, accent, (0.5, 0.52)

    if form == "wings":
        def body(d, s):
            base_hull(d, s, 0.10)
            d.polygon([(0.00, 0.46 * H * s), (0.30 * W * s, 0.34 * H * s),
                       (0.30 * W * s, 0.66 * H * s)], fill=255)
            d.polygon([(W * s, 0.46 * H * s), (0.70 * W * s, 0.34 * H * s),
                       (0.70 * W * s, 0.66 * H * s)], fill=255)

        def accent(d, s):
            d.polygon([(0.02 * W * s, 0.46 * H * s), (0.26 * W * s, 0.38 * H * s),
                       (0.26 * W * s, 0.58 * H * s)], fill=255)
            d.polygon([(0.98 * W * s, 0.46 * H * s), (0.74 * W * s, 0.38 * H * s),
                       (0.74 * W * s, 0.58 * H * s)], fill=255)
        return body, accent, (0.5, 0.50)

    # pylon - rooted emitter, wider base, reads as planted not hovering
    def body(d, s):
        d.polygon([(0.50 * W * s, 0.04 * H * s), (0.86 * W * s, 0.36 * H * s),
                   (0.86 * W * s, 0.74 * H * s), (0.50 * W * s, 0.96 * H * s),
                   (0.14 * W * s, 0.74 * H * s), (0.14 * W * s, 0.36 * H * s)], fill=255)

    def accent(d, s):
        for k in range(3):
            x = (0.26 + k * 0.20) * W * s
            d.rectangle([x, 0.20 * H * s, x + 0.10 * W * s, 0.30 * H * s], fill=255)
    return body, accent, (0.5, 0.56)


def build_drone(kind: str, cfg: dict):
    base = SPECS["drone"] * 2
    W = int(base * cfg["size"])
    H = int(W * 1.02)
    body_fn, accent_fn, (ex, ey) = drone_silhouette(cfg["form"], W, H)

    mask = mask_from_draw(W, H, body_fn)
    hgt = dome(mask, power=0.52, soften=W * 0.05)
    rgb = shade(
        hgt, mask, CHASSIS_HI, CHASSIS_MID, CHASSIS_DEEP,
        ambient=0.30, spec=0.70, spec_tight=30.0, rim_col=CHASSIS_RIM, rim_amt=0.85,
    )

    # Accent plating: the archetype's colour language, shaded on its own dome so
    # it reads as a fitted part rather than a decal.
    amask = mask_from_draw(W, H, accent_fn) * mask
    if amask.max() > 0.02:
        ac = np.array(cfg["accent"], float)
        ah = dome(amask, power=0.7, soften=W * 0.03)
        argb = shade(ah, amask, np.clip(ac * 1.5, 0, 255), ac, ac * 0.35,
                     ambient=0.34, spec=0.5, spec_tight=30.0)
        a = amask[..., None]
        rgb = rgb * (1 - a) + argb * a

    # Panel-line: a dark seam around the hull, the cheapest read of "machined".
    seam = np.clip(blur(mask, 1.2) - blur(mask, 2.6), 0, 1) * mask
    rgb *= (1 - seam * 0.55)[..., None]

    pad = max(5, int(W * 0.30))
    hovering = cfg["form"] != "pylon"
    img = compose(
        rgb, mask, pad,
        shadow_w=W * (0.52 if hovering else 0.74),
        shadow_alpha=0.50 if hovering else 0.68,
        detach=0.85 if hovering else 0.0,
    )
    save(img, f"td-{kind}")

    r = W * 0.068 * cfg["eye"]
    save(
        emissive_layer(
            W, H + pad,
            [
                (ex * W, ey * H, r, DANGER_HOT, 1.0),
                (ex * W, ey * H, r * 1.7, DANGER, 0.40),
            ],
        ),
        f"td-{kind}-emis",
    )


# ---------------------------------------------------------------------------
# Classifier elite
# ---------------------------------------------------------------------------
def build_elite():
    """Larger, heavier: thicker armour, warning stripes, one big scanning eye."""
    W = SPECS["elite"] * 2  # 80
    H = int(W * 1.02)

    def body(d, s):
        # octagonal armoured hull - visibly heavier than any grunt
        c = W * s / 2
        cy = H * s * 0.52
        r = W * s * 0.46
        pts = [
            (c + np.cos(i / 8 * 2 * np.pi + np.pi / 8) * r,
             cy + np.sin(i / 8 * 2 * np.pi + np.pi / 8) * r * 0.94)
            for i in range(8)
        ]
        d.polygon(pts, fill=255)
        # shoulder blocks
        d.rounded_rectangle([0.02 * W * s, 0.30 * H * s, 0.22 * W * s, 0.62 * H * s],
                            radius=0.05 * W * s, fill=255)
        d.rounded_rectangle([0.78 * W * s, 0.30 * H * s, 0.98 * W * s, 0.62 * H * s],
                            radius=0.05 * W * s, fill=255)
        # antennae
        d.rectangle([0.20 * W * s, 0.02 * H * s, 0.27 * W * s, 0.18 * H * s], fill=255)
        d.rectangle([0.73 * W * s, 0.02 * H * s, 0.80 * W * s, 0.18 * H * s], fill=255)

    mask = mask_from_draw(W, H, body)
    hgt = dome(mask, power=0.48, soften=W * 0.05)
    rgb = shade(
        hgt, mask, CHASSIS_HI, CHASSIS_MID_D, (16, 20, 30),
        ambient=0.26, spec=0.80, spec_tight=34.0, rim_col=CHASSIS_RIM, rim_amt=1.0,
    )

    def stripes(d, s):
        for k in range(4):
            x = (0.24 + k * 0.14) * W * s
            d.polygon([(x, 0.20 * H * s), (x + 0.07 * W * s, 0.20 * H * s),
                       (x + 0.03 * W * s, 0.32 * H * s), (x - 0.04 * W * s, 0.32 * H * s)],
                      fill=255)

    smask = mask_from_draw(W, H, stripes) * mask
    sh = dome(smask, power=0.8, soften=W * 0.02)
    srgb = shade(sh, smask, (255, 220, 150), WARNING, (90, 60, 20),
                 ambient=0.42, spec=0.4, spec_tight=30.0)
    a = smask[..., None] * 0.92
    rgb = rgb * (1 - a) + srgb * a

    seam = np.clip(blur(mask, 1.4) - blur(mask, 3.2), 0, 1) * mask
    rgb *= (1 - seam * 0.6)[..., None]

    pad = max(7, int(W * 0.24))
    img = compose(rgb, mask, pad, shadow_w=W * 0.80, shadow_alpha=0.72, detach=0.45)
    save(img, "td-elite")

    save(
        emissive_layer(
            W, H + pad,
            [
                (W * 0.5, H * 0.58, W * 0.085, DANGER_HOT, 1.0),
                (W * 0.5, H * 0.58, W * 0.16, DANGER, 0.5),
                (W * 0.235, H * 0.05, W * 0.035, DANGER, 0.8),
                (W * 0.765, H * 0.05, W * 0.035, DANGER, 0.8),
            ],
        ),
        "td-elite-emis",
    )


# ---------------------------------------------------------------------------
# Signal Node
# ---------------------------------------------------------------------------
def build_node():
    """Tiered plinth + emissive core - a physical structure, not a glowing circle.

    Three stacked oblique tiers (each ellipse foreshortened by OBLIQUE.k = 0.55)
    with a lit upper-left face, plus a raised core housing. The runtime drives
    the emissive layer's alpha and scale from nodeCharge / chargeTarget.
    """
    W = SPECS["node"] * 2   # 112
    H = int(W * 1.05)
    K = 0.55                # OBLIQUE.k

    tiers = [  # (half-width fraction, top-y fraction, thickness fraction)
        (0.46, 0.74, 0.15),
        (0.32, 0.55, 0.14),
        (0.20, 0.38, 0.12),
    ]

    def body(d, s):
        for hw, ty, th in tiers:
            rx = hw * W * s
            ry = rx * K
            cx = W * s * 0.5
            cy = ty * H * s
            # extruded side wall + top cap
            d.rectangle([cx - rx, cy, cx + rx, cy + th * H * s], fill=255)
            d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
            d.ellipse([cx - rx, cy + th * H * s - ry, cx + rx, cy + th * H * s + ry],
                      fill=255)
        # core housing: a slim pillar rising from the top tier
        cx = W * s * 0.5
        d.rounded_rectangle([cx - 0.085 * W * s, 0.12 * H * s,
                             cx + 0.085 * W * s, 0.44 * H * s],
                            radius=0.05 * W * s, fill=255)

    mask = mask_from_draw(W, H, body)

    # The height field is built PER TIER, not domed from the union silhouette.
    # Doming the union melts the three steps into one blob and the plinth stops
    # reading as architecture - which is exactly what the spec forbids ("a
    # physical structure ... not a glowing circle").
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    hgt = np.zeros((H, W))
    for i, (hw, ty, th) in enumerate(tiers):
        rx, cx, cy = hw * W, W * 0.5, ty * H
        ry = rx * K
        # Top cap: a raised oblique disc. Its own gentle crown gives the cap a
        # lit upper-left and a shaded lower-right.
        cap = np.clip(1.0 - (((xx - cx) / rx) ** 2 + ((yy - cy) / max(ry, 1)) ** 2), 0, 1)
        level = 0.24 + i * 0.24
        hgt = np.maximum(hgt, (level + 0.10 * np.sqrt(cap)) * (cap > 0))
        # Side wall: a vertical face below the cap, falling off to its base.
        wall = ((np.abs(xx - cx) < rx) & (yy >= cy) & (yy <= cy + th * H)).astype(float)
        curve = np.clip(1.0 - (np.abs(xx - cx) / rx) ** 2, 0, 1)
        hgt = np.maximum(hgt, wall * (level - 0.06) * (0.55 + 0.45 * curve))
    # Core pillar sits highest.
    pillar = ((np.abs(xx - W * 0.5) < 0.09 * W) & (yy > 0.12 * H) & (yy < 0.45 * H))
    pcurve = np.clip(1.0 - (np.abs(xx - W * 0.5) / (0.09 * W)) ** 2, 0, 1)
    hgt = np.maximum(hgt, pillar * (0.90 + 0.10 * pcurve))
    hgt = blur(hgt, W * 0.006) * mask

    # Contact AO in the groove where each tier lands on the one below.
    ao = np.zeros((H, W))
    for hw, ty, th in tiers:
        rx, cx = hw * W, W * 0.5
        band = np.clip(1.0 - np.abs(yy - (ty * H + th * H)) / (H * 0.035), 0, 1)
        ao = np.maximum(ao, band * (np.abs(xx - cx) < rx * 1.45))
    ao = blur(ao, W * 0.012) * mask

    rgb = shade(
        hgt, mask, NODE_STONE_HI, NODE_STONE, NODE_STONE_D,
        ambient=0.30, spec=0.45, spec_tight=24.0, rim_col=(90, 200, 170), rim_amt=1.0,
    )

    # The core's own light bounced onto the surrounding stone - the structure
    # must look lit BY the core even with the emissive layer switched off.
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    bounce = np.clip(1.0 - np.hypot(xx - W * 0.5, (yy - H * 0.30) / 0.8) / (W * 0.42), 0, 1) ** 2
    rgb = np.clip(rgb + bounce[..., None] * np.array(NODE_CORE, float) * 0.16, 0, 255)
    rgb *= (1 - ao * 0.42)[..., None]

    pad = max(6, int(W * 0.14))
    img = compose(rgb, mask, pad, shadow_w=W * 0.92, shadow_alpha=0.74)
    save(img, "td-node")

    save(
        emissive_layer(
            W, H + pad,
            [
                (W * 0.5, H * 0.24, W * 0.055, NODE_CORE, 1.0),
                (W * 0.5, H * 0.30, W * 0.035, (200, 255, 235), 0.85),
                (W * 0.5, H * 0.25, W * 0.115, SIGNAL, 0.42),
                (W * 0.5, H * 0.43, W * 0.070, SIGNAL, 0.22),
            ],
            glow_scale=1.15,
        ),
        "td-node-emis",
    )


def main():
    print("CONTACT-47")
    build_blip()
    print("drones")
    for kind, cfg in DRONES.items():
        build_drone(kind, cfg)
    print("Classifier elite")
    build_elite()
    print("Signal Node")
    build_node()


if __name__ == "__main__":
    main()
