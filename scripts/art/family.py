#!/usr/bin/env python3
"""
family.py — ONE coherent top-down asset family for BLIP's Sweep arenas.

Why this exists (and why it replaced the photoscan pipeline for ground/walls):
a 512px outdoor photoscan minified to a 256px repeat becomes uniform
salt-and-pepper speckle. It has no MACRO structure — no "here is packed earth,
here is moss, here is a wet hollow" — so the arena read as enlarged pixel noise
with rectangular asset boundaries laid over it. No amount of runtime lighting
fixes an input with no large-scale structure.

Everything here is generated instead, from one set of shared rules:

  * ONE light direction (upper-left) baked into every prop, wall and actor.
  * ONE palette, keyed to earth/stone neutrals — green is reserved for signal
    tech and moss accents, not the whole world.
  * ONE noise basis (domain-warped fBm) drives ground materials, wall
    silhouettes and prop shapes, so surfaces feel like they belong together.
  * MACRO FIRST: large material regions, then mid detail, then a little grain.

Run:  python3 scripts/art/family.py
Outputs: public/assets/topdown/*.webp  +  art-src/family/ sprite PNGs
"""
from __future__ import annotations

import math
import os

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_TILES = os.path.join(ROOT, "public", "assets", "topdown")
OUT_SPRITES = os.path.join(ROOT, "art-src", "family")
os.makedirs(OUT_TILES, exist_ok=True)
os.makedirs(OUT_SPRITES, exist_ok=True)

RNG = np.random.default_rng(0x5EED47)

# --- one light, everywhere -------------------------------------------------
LIGHT = np.array([-0.62, -0.62, 0.48])
LIGHT /= np.linalg.norm(LIGHT)

# --- one palette: NEUTRAL earth base, green used sparingly -----------------
P = {
    "soil_dk":   (0x22, 0x1E, 0x18),
    "soil":      (0x3A, 0x32, 0x26),
    "soil_lt":   (0x52, 0x46, 0x33),
    "mud":       (0x2C, 0x26, 0x1E),
    "mud_wet":   (0x1E, 0x1E, 0x1C),
    "stone_dk":  (0x2A, 0x2C, 0x2E),
    "stone":     (0x44, 0x47, 0x4A),
    "stone_lt":  (0x63, 0x67, 0x6B),
    "moss_dk":   (0x24, 0x33, 0x22),
    "moss":      (0x37, 0x4C, 0x30),
    "moss_lt":   (0x4E, 0x66, 0x3D),
    "water":     (0x18, 0x24, 0x26),
    "water_lt":  (0x2E, 0x4A, 0x4C),
    "chassis_dk": (0x2A, 0x2F, 0x36),
    "chassis":    (0x8E, 0x96, 0x9E),
    "chassis_lt": (0xD6, 0xDC, 0xE2),
    "hull_dk":   (0x1B, 0x20, 0x28),
    "hull":      (0x39, 0x41, 0x4E),
    "hull_lt":   (0x5A, 0x64, 0x72),
    "signal":    (0x7C, 0xE8, 0x6A),
    "signal_lt": (0xD6, 0xFF, 0xE0),
    "danger":    (0xFF, 0x3B, 0x30),
    "warm":      (0xFF, 0x9D, 0x4A),
}


def C(name: str) -> np.ndarray:
    return np.array(P[name], dtype=float)


# ---------------------------------------------------------------- noise ----
def _lattice(h: int, w: int, freq: int) -> np.ndarray:
    """Tileable smooth value noise at `freq` cells across the image."""
    g = RNG.random((freq, freq))
    g = np.pad(g, ((0, 1), (0, 1)), mode="wrap")
    ys = np.linspace(0, freq, h, endpoint=False)
    xs = np.linspace(0, freq, w, endpoint=False)
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    fy = (ys - y0)[:, None]
    fx = (xs - x0)[None, :]
    sy = fy * fy * (3 - 2 * fy)
    sx = fx * fx * (3 - 2 * fx)
    a = g[y0][:, x0]
    b = g[y0][:, x0 + 1]
    c = g[y0 + 1][:, x0]
    d = g[y0 + 1][:, x0 + 1]
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


def fbm(h: int, w: int, base: int = 2, octaves: int = 5, gain: float = 0.5) -> np.ndarray:
    out = np.zeros((h, w))
    amp = 1.0
    tot = 0.0
    for o in range(octaves):
        out += amp * _lattice(h, w, base * (2 ** o))
        tot += amp
        amp *= gain
    out /= tot
    return (out - out.min()) / (np.ptp(out) + 1e-9)


def warped(h: int, w: int, base: int = 2, strength: float = 0.35) -> np.ndarray:
    """Domain-warped fBm — this is what makes regions look eroded and organic
    rather than like smooth blobs or uniform static."""
    q = fbm(h, w, base, 4)
    r = fbm(h, w, base, 4)
    ys, xs = np.mgrid[0:h, 0:w]
    dy = ((ys + (q - 0.5) * strength * h).astype(int)) % h
    dx = ((xs + (r - 0.5) * strength * w).astype(int)) % w
    return fbm(h, w, base, 5)[dy, dx]


def normals(height: np.ndarray, z: float = 2.2) -> np.ndarray:
    gy, gx = np.gradient(height * 255.0)
    n = np.dstack([-gx, -gy, np.full_like(gx, z)])
    return n / (np.linalg.norm(n, axis=2, keepdims=True) + 1e-9)


def shade(height: np.ndarray, ambient: float = 0.55, strength: float = 0.45) -> np.ndarray:
    lam = np.clip((normals(height) @ LIGHT), 0, 1)
    return ambient + strength * lam


def ramp(t: np.ndarray, stops: list[tuple[float, str]]) -> np.ndarray:
    """Map 0..1 through named palette stops."""
    h, w = t.shape
    out = np.zeros((h, w, 3))
    for i in range(len(stops) - 1):
        a_pos, a_col = stops[i]
        b_pos, b_col = stops[i + 1]
        m = (t >= a_pos) & (t <= b_pos)
        if not m.any():
            continue
        f = ((t - a_pos) / max(b_pos - a_pos, 1e-6))[m][:, None]
        out[m] = C(a_col)[None, :] * (1 - f) + C(b_col)[None, :] * f
    out[t < stops[0][0]] = C(stops[0][1])
    out[t > stops[-1][0]] = C(stops[-1][1])
    return out


def save_tile(arr: np.ndarray, name: str) -> None:
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    path = os.path.join(OUT_TILES, f"{name}.webp")
    img.save(path, "WEBP", quality=88, method=6)
    print(f"  tile   {name:<18} {img.size[0]}x{img.size[1]}  {os.path.getsize(path)/1024:6.1f} KB")


def save_sprite(img: Image.Image, name: str) -> None:
    path = os.path.join(OUT_SPRITES, f"{name}.png")
    img.save(path)
    print(f"  sprite {name:<18} {img.size[0]}x{img.size[1]}")


# ---------------------------------------------------------------- ground ---
S = 512


def ground_family() -> None:
    """Four ground materials that share one erosion basis, so they blend into
    each other instead of butting up as separate textures."""
    print("ground")
    base = warped(S, S, base=2, strength=0.4)      # macro: where earth vs moss
    mid = fbm(S, S, base=6, octaves=4)             # mid: clumping
    fine = fbm(S, S, base=32, octaves=3)           # fine: restrained grain
    erosion = warped(S, S, base=4, strength=0.25)

    # Height field drives real shading, so the ground has form, not just colour.
    height = base * 0.6 + mid * 0.3 + fine * 0.1
    lam = shade(height, ambient=0.62, strength=0.4)[:, :, None]

    def compose(stops, moss_amt: float, wet_amt: float, grain: float) -> np.ndarray:
        t = np.clip(base * 0.65 + mid * 0.25 + fine * grain, 0, 1)
        rgb = ramp(t, stops)
        # moss creeps into the LOW, sheltered areas — reads as growth, not tint
        if moss_amt > 0:
            m = np.clip((0.55 - base) * 2.2, 0, 1) * np.clip(mid * 1.4, 0, 1)
            m = (m * moss_amt)[:, :, None]
            moss_rgb = ramp(np.clip(mid * 0.8 + fine * 0.2, 0, 1),
                            [(0.0, "moss_dk"), (0.55, "moss"), (1.0, "moss_lt")])
            rgb = rgb * (1 - m) + moss_rgb * m
        # standing water pools in the lowest ground, with a specular sky glint
        if wet_amt > 0:
            w = np.clip((0.34 - erosion) * 4.0, 0, 1)[:, :, None] * wet_amt
            water = ramp(np.clip(fine, 0, 1), [(0.0, "water"), (1.0, "water_lt")])
            rgb = rgb * (1 - w) + water * w
            spec = np.clip((normals(height) @ LIGHT) ** 18, 0, 1)[:, :, None]
            rgb = rgb + spec * w * 150
        return rgb * lam

    save_tile(compose([(0.0, "soil_dk"), (0.4, "soil"), (0.75, "mud"), (1.0, "soil_lt")],
                      moss_amt=0.55, wet_amt=0.0, grain=0.10), "td-ground")
    save_tile(compose([(0.0, "soil"), (0.35, "soil_lt"), (0.7, "moss"), (1.0, "moss_lt")],
                      moss_amt=0.85, wet_amt=0.0, grain=0.08), "td-ground-lit")
    save_tile(compose([(0.0, "mud_wet"), (0.45, "mud"), (0.8, "soil_dk"), (1.0, "stone_dk")],
                      moss_amt=0.2, wet_amt=0.75, grain=0.06), "td-ground-dark")
    save_tile(compose([(0.0, "mud_wet"), (0.3, "mud"), (0.65, "soil"), (1.0, "soil_lt")],
                      moss_amt=0.0, wet_amt=0.25, grain=0.12), "td-path")


def wall_family() -> None:
    """Rock walls: a top cap seen from above and a vertical face seen from the
    side. The face is what actually sells the three-quarter view."""
    print("walls")
    base = warped(S, S, base=3, strength=0.3)
    mid = fbm(S, S, base=9, octaves=4)
    # blocky-but-eroded rock: quantise the macro field into shelves
    shelves = np.floor(base * 5) / 5 + mid * 0.16
    lam = shade(shelves, ambient=0.5, strength=0.55)[:, :, None]
    cap = ramp(np.clip(shelves, 0, 1),
               [(0.0, "stone_dk"), (0.4, "stone"), (0.75, "moss_dk"), (1.0, "moss")]) * lam
    save_tile(cap, "td-wall-top")

    # Vertical face: strata run HORIZONTALLY and it darkens toward the base, so
    # the eye reads it as a surface facing the camera rather than more ground.
    H = 192
    fb = warped(H, S, base=3, strength=0.22)
    strata = np.sin(np.linspace(0, 9 * math.pi, H))[:, None] * 0.16
    fh = np.clip(fb * 0.8 + strata, 0, 1)
    flam = shade(fh, ambient=0.42, strength=0.5)[:, :, None]
    face = ramp(fh, [(0.0, "stone_dk"), (0.45, "stone"), (1.0, "stone_lt")]) * flam
    depth = np.linspace(1.05, 0.42, H)[:, None, None]   # ambient occlusion downward
    save_tile(face * depth, "td-wall-face")


# --------------------------------------------------------------- sprites ---
def blob_mask(w: int, h: int, lobes: int, seed_scale: float = 1.0) -> np.ndarray:
    """An irregular organic silhouette — never an ellipse, never a rectangle."""
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w / 2, h * 0.58
    acc = np.zeros((h, w))
    for _ in range(lobes):
        ox = cx + (RNG.random() - 0.5) * w * 0.42 * seed_scale
        oy = cy + (RNG.random() - 0.5) * h * 0.38 * seed_scale
        rx = w * (0.16 + RNG.random() * 0.2)
        ry = h * (0.14 + RNG.random() * 0.18)
        acc = np.maximum(acc, np.clip(1 - (((xx - ox) / rx) ** 2 + ((yy - oy) / ry) ** 2), 0, 1))
    n = fbm(h, w, base=5, octaves=4)
    return np.clip(acc * (0.72 + 0.55 * n) * 1.5, 0, 1)


def lit_sprite(w: int, h: int, mask: np.ndarray, stops: list[tuple[float, str]],
               relief: float, ao_floor: float = 0.55) -> Image.Image:
    """Give a silhouette real form: a domed height field, one light direction,
    a darker underside, and a soft alpha edge so nothing looks die-cut."""
    dome = np.clip(mask, 0, 1) ** 0.6
    detail = fbm(h, w, base=7, octaves=4)
    height = dome * relief + detail * 0.35 * dome
    lam = shade(height, ambient=0.5, strength=0.55)
    grad = np.linspace(1.06, ao_floor, h)[:, None]      # underside falls into shade
    rgb = ramp(np.clip(detail * 0.55 + dome * 0.45, 0, 1), stops) * (lam * grad)[:, :, None]
    a = np.clip((mask - 0.42) * 3.4, 0, 1)
    img = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8), "RGBA")
    return img.filter(ImageFilter.GaussianBlur(0.6))


def foliage_family() -> None:
    print("foliage / props")
    specs = [
        ("td-bush", 150, 130, 7, [(0.0, "moss_dk"), (0.5, "moss"), (1.0, "moss_lt")], 0.9),
        ("td-fern", 120, 118, 5, [(0.0, "moss_dk"), (0.55, "moss"), (1.0, "moss_lt")], 0.7),
        ("td-tuft", 92, 74, 4, [(0.0, "moss_dk"), (0.6, "moss"), (1.0, "moss_lt")], 0.55),
        ("td-canopy", 300, 250, 9, [(0.0, "moss_dk"), (0.7, "moss_dk"), (1.0, "moss")], 1.15),
        ("td-rock", 128, 104, 4, [(0.0, "stone_dk"), (0.5, "stone"), (1.0, "stone_lt")], 1.25),
        ("td-log", 168, 84, 3, [(0.0, "soil_dk"), (0.5, "soil"), (1.0, "soil_lt")], 0.95),
        ("td-debris", 96, 72, 5, [(0.0, "soil_dk"), (0.6, "stone_dk"), (1.0, "stone")], 0.7),
        ("td-scrap", 88, 66, 4, [(0.0, "hull_dk"), (0.6, "hull"), (1.0, "hull_lt")], 0.8),
    ]
    for name, w, h, lobes, stops, relief in specs:
        m = blob_mask(w, h, lobes)
        img = lit_sprite(w, h, m, stops, relief)
        # ferns and tufts get blade structure so they aren't just mounds
        if name in ("td-fern", "td-tuft"):
            d = ImageDraw.Draw(img)
            for _ in range(16 if name == "td-fern" else 10):
                bx = w * (0.2 + RNG.random() * 0.6)
                by = h * (0.62 + RNG.random() * 0.3)
                ln = h * (0.3 + RNG.random() * 0.34)
                lean = (RNG.random() - 0.5) * w * 0.3
                col = P["moss_lt"] if RNG.random() < 0.4 else P["moss"]
                d.line([(bx, by), (bx + lean, by - ln)], fill=(*col, 210), width=2)
        save_sprite(img, name)



def side_shade(img: Image.Image, from_x: float = 0.56, amount: int = 62) -> Image.Image:
    """Darken the light-facing convention's shaded side.

    MUST be masked by the sprite's own alpha: painting a plain rectangle over
    the canvas also darkens the transparent margin, which renders in-game as a
    grey box around every sprite. (It did exactly that until this was fixed.)
    """
    w, h = img.size
    shade = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(shade).rectangle((int(w * from_x), 0, w, h), fill=(6, 9, 14, amount))
    a = np.asarray(img.split()[-1], dtype=np.uint16)
    sa = np.asarray(shade.split()[-1], dtype=np.uint16)
    masked = (sa * a // 255).astype(np.uint8)
    shade.putalpha(Image.fromarray(masked, "L"))
    return Image.alpha_composite(img, shade)


def _plates(d, box, top_col, side_col, edge_col, r=8):
    """Draw a body as a TOP plane and a FRONT plane, not a flat capsule.
    This is what gives actors the same oblique read as the rocks and walls:
    you see the upper surface AND the face turned toward the camera."""
    x0, y0, x1, y1 = box
    mid = y0 + (y1 - y0) * 0.52
    d.rounded_rectangle((x0, y0, x1, mid + r), radius=r, fill=(*top_col, 255))
    d.rounded_rectangle((x0, mid, x1, y1), radius=r, fill=(*side_col, 255))
    d.line([(x0 + 2, mid), (x1 - 2, mid)], fill=(*edge_col, 200), width=2)


def actor_family() -> None:
    """CONTACT-47, the drones, the Node and the landmarks.

    Judged at GAMEPLAY scale, not enlarged: silhouettes have to survive being
    drawn ~30-40px tall, so features are few, large and high-contrast. Every
    body is built from a top plane plus a front plane under one shared light.
    """
    print("actors")

    # ---- CONTACT-47: compact, agile field unit ----------------------------
    # Deliberately NARROW (w:h ~ 0.62). The previous build was near-square and
    # read as a white block that dominated the frame.
    W, H = 132, 210
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # legs first, so the torso overlaps them
    for fx in (0.24, 0.56):
        d.rounded_rectangle((int(W * fx), int(H * 0.72), int(W * (fx + 0.20)), int(H * 0.88)),
                            radius=5, fill=(*P["chassis_dk"], 255))
        d.rounded_rectangle((int(W * fx) - 3, int(H * 0.86), int(W * (fx + 0.20)) + 3, int(H * 0.95)),
                            radius=4, fill=(*P["hull_dk"], 255))  # foot pad, grounds him
    # torso: top plane + front plane
    _plates(d, (int(W * 0.20), int(H * 0.40), int(W * 0.80), int(H * 0.78)),
            P["chassis_lt"], P["chassis"], P["chassis_dk"], r=13)
    # shoulder/arm masses read as mechanical, and widen the silhouette a little
    for sx, lit in ((0.04, True), (0.76, False)):
        col = P["chassis"] if lit else P["chassis_dk"]
        d.rounded_rectangle((int(W * sx), int(H * 0.46), int(W * (sx + 0.20)), int(H * 0.70)),
                            radius=7, fill=(*col, 255))
    # head: separated from the torso by a neck, so it reads as a head
    d.rounded_rectangle((int(W * 0.40), int(H * 0.34), int(W * 0.60), int(H * 0.42)),
                        radius=4, fill=(*P["chassis_dk"], 255))
    _plates(d, (int(W * 0.24), int(H * 0.16), int(W * 0.76), int(H * 0.38)),
            P["chassis_lt"], P["chassis"], P["chassis_dk"], r=10)
    # visor: modest, inset, clearly FRONT-facing
    v = (int(W * 0.31), int(H * 0.24), int(W * 0.69), int(H * 0.33))
    d.rounded_rectangle(v, radius=4, fill=(*P["hull_dk"], 255))
    d.rounded_rectangle((v[0] + 3, v[1] + 2, v[2] - 3, v[3] - 2), radius=3, fill=(*P["signal"], 255))
    # antenna
    d.line([(int(W * 0.5), int(H * 0.16)), (int(W * 0.56), int(H * 0.04))],
           fill=(*P["chassis_dk"], 255), width=4)
    d.ellipse((int(W * 0.52), int(H * 0.01), int(W * 0.62), int(H * 0.07)), fill=(*P["signal"], 255))
    # internal shading: darken the shaded side so it is not a flat white mass
    img = side_shade(img, 0.58, 74)
    save_sprite(img, "td-blip")
    em = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    de = ImageDraw.Draw(em)
    de.rounded_rectangle((v[0] + 3, v[1] + 2, v[2] - 3, v[3] - 2), radius=3, fill=(*P["signal_lt"], 255))
    de.ellipse((int(W * 0.52), int(H * 0.01), int(W * 0.62), int(H * 0.07)), fill=(*P["signal_lt"], 255))
    save_sprite(em.filter(ImageFilter.GaussianBlur(1.6)), "td-blip-emis")

    # ---- drones: mechanical, archetype-distinct ---------------------------
    # Proportions differ per archetype so they are separable by SHAPE alone at
    # gameplay zoom, before colour or detail is even resolved.
    D = {
        "drifter":  dict(w=120, h=92,  fins=0, arms=0, lens=1, rotor=2, plate=0, mount=0, tall=0),
        "tagger":   dict(w=134, h=96,  fins=2, arms=0, lens=1, rotor=2, plate=0, mount=1, tall=0),
        "diver":    dict(w=104, h=126, fins=3, arms=0, lens=1, rotor=0, plate=0, mount=0, tall=1),
        "warden":   dict(w=164, h=112, fins=0, arms=0, lens=2, rotor=2, plate=1, mount=0, tall=0),
        "sniper":   dict(w=176, h=88,  fins=1, arms=0, lens=1, rotor=1, plate=0, mount=2, tall=0),
        "splitter": dict(w=140, h=118, fins=0, arms=3, lens=3, rotor=0, plate=0, mount=0, tall=0),
        "weaver":   dict(w=150, h=80,  fins=2, arms=0, lens=1, rotor=2, plate=0, mount=0, tall=0),
        "turret":   dict(w=132, h=140, fins=0, arms=0, lens=1, rotor=0, plate=1, mount=3, tall=1),
    }
    for name, c in D.items():
        w, h = c["w"], c["h"]
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        dd = ImageDraw.Draw(im)
        top = int(h * (0.10 + 0.12 * c["tall"]))
        bot = int(h * 0.74)
        # rotors / thruster pods sit BEHIND the hull
        for i in range(c["rotor"]):
            side = -1 if i % 2 == 0 else 1
            cx = w / 2 + side * w * 0.40
            dd.ellipse((cx - w * 0.13, h * 0.30, cx + w * 0.13, h * 0.52),
                       fill=(*P["hull_dk"], 255))
            dd.ellipse((cx - w * 0.08, h * 0.33, cx + w * 0.08, h * 0.45),
                       fill=(*P["stone_dk"], 255))
        # swept fins — the main silhouette breaker
        for i in range(c["fins"]):
            side = -1 if i % 2 == 0 else 1
            yb = h * (0.36 + 0.14 * (i // 2))
            dd.polygon([(w / 2, yb), (w / 2 + side * w * 0.52, yb - h * 0.10),
                        (w / 2 + side * w * 0.34, yb + h * 0.16)],
                       fill=(*P["hull_dk"], 255))
        # manipulator arms (splitter)
        for i in range(c["arms"]):
            a = math.pi * (0.15 + 0.7 * i / max(1, c["arms"] - 1))
            ex = w / 2 + math.cos(a) * w * 0.46
            ey = h * 0.52 - math.sin(a) * h * 0.30
            dd.line([(w / 2, h * 0.52), (ex, ey)], fill=(*P["hull_dk"], 255), width=7)
            dd.ellipse((ex - 7, ey - 7, ex + 7, ey + 7), fill=(*P["hull"], 255))
        # hull: top plane + front plane
        _plates(dd, (int(w * 0.20), top, int(w * 0.80), bot),
                P["hull_lt"], P["hull"], P["hull_dk"], r=int(h * 0.16))
        # armour plate (warden/turret): a bold frontal slab
        if c["plate"]:
            dd.rounded_rectangle((int(w * 0.14), int(h * 0.50), int(w * 0.86), int(h * 0.78)),
                                 radius=6, fill=(*P["stone"], 255))
            dd.line([(int(w * 0.14), int(h * 0.50)), (int(w * 0.86), int(h * 0.50))],
                    fill=(*P["stone_lt"], 230), width=3)
        # weapon mounts
        for i in range(c["mount"]):
            mx = w * (0.5 + (i - (c["mount"] - 1) / 2) * 0.26)
            dd.rounded_rectangle((mx - w * 0.05, bot - h * 0.06, mx + w * 0.05, bot + h * 0.12),
                                 radius=3, fill=(*P["hull_dk"], 255))
        # red optics — the threat read, on the FRONT plane
        n = c["lens"]
        for i in range(n):
            fx = 0.5 if n == 1 else 0.5 + (i - (n - 1) / 2) * 0.20
            r = w * (0.075 if n == 1 else 0.05)
            cy = h * 0.60
            dd.ellipse((fx * w - r * 1.5, cy - r * 1.5, fx * w + r * 1.5, cy + r * 1.5),
                       fill=(*P["hull_dk"], 255))
            dd.ellipse((fx * w - r, cy - r, fx * w + r, cy + r), fill=(*P["danger"], 255))
        # shade the light-facing convention: darken the right/lower side
        im = side_shade(im)
        save_sprite(im, f"td-{name}")
        emi = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        de = ImageDraw.Draw(emi)
        for i in range(n):
            fx = 0.5 if n == 1 else 0.5 + (i - (n - 1) / 2) * 0.20
            r = w * (0.10 if n == 1 else 0.07)
            de.ellipse((fx * w - r, h * 0.60 - r, fx * w + r, h * 0.60 + r),
                       fill=(255, 96, 78, 255))
        save_sprite(emi.filter(ImageFilter.GaussianBlur(2.4)), f"td-{name}-emis")

    # elite: same language, heavier, wider stance
    w, h = 220, 150
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(im)
    for side in (-1, 1):
        cx = w / 2 + side * w * 0.40
        dd.ellipse((cx - w * 0.12, h * 0.24, cx + w * 0.12, h * 0.50), fill=(*P["hull_dk"], 255))
        dd.polygon([(w / 2, h * 0.40), (cx + side * w * 0.12, h * 0.24), (cx, h * 0.64)],
                   fill=(*P["hull_dk"], 255))
    _plates(dd, (int(w * 0.22), int(h * 0.14), int(w * 0.78), int(h * 0.76)),
            P["hull_lt"], P["hull"], P["hull_dk"], r=16)
    dd.rounded_rectangle((int(w * 0.16), int(h * 0.50), int(w * 0.84), int(h * 0.80)),
                         radius=8, fill=(*P["stone"], 255))
    dd.ellipse((int(w * 0.42), int(h * 0.56), int(w * 0.58), int(h * 0.72)), fill=(*P["danger"], 255))
    im = side_shade(im)
    save_sprite(im, "td-elite")
    emi = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(emi).ellipse((int(w * 0.39), int(h * 0.53), int(w * 0.61), int(h * 0.75)),
                                fill=(255, 96, 78, 255))
    save_sprite(emi.filter(ImageFilter.GaussianBlur(4.0)), "td-elite-emis")

    # ---- the Node ---------------------------------------------------------
    w, h = 300, 320
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(im)
    cx = w / 2
    for rw, ry, col in [(0.50, 0.86, "hull_dk"), (0.38, 0.72, "hull"), (0.27, 0.60, "hull_lt")]:
        dd.ellipse((cx - w * rw, h * ry - h * rw * 0.42, cx + w * rw, h * ry + h * rw * 0.42),
                   fill=(*P[col], 255))
        dd.ellipse((cx - w * rw, h * ry - h * rw * 0.42 - h * 0.045,
                    cx + w * rw, h * ry + h * rw * 0.42 - h * 0.045), fill=(*P[col], 255))
    for i in range(8):
        a = i * math.pi / 4
        dd.line([(cx + math.cos(a) * w * 0.06, h * 0.555 + math.sin(a) * h * 0.025),
                 (cx + math.cos(a) * w * 0.25, h * 0.555 + math.sin(a) * h * 0.105)],
                fill=(*P["signal"], 190), width=4)
    dd.rounded_rectangle((cx - w * 0.09, h * 0.30, cx + w * 0.09, h * 0.57), radius=10,
                         fill=(*P["hull"], 255))
    dd.rounded_rectangle((cx - w * 0.09, h * 0.30, cx - w * 0.01, h * 0.57), radius=10,
                         fill=(*P["hull_lt"], 255))
    for ry in (0.36, 0.44, 0.52):
        dd.ellipse((cx - w * 0.11, h * ry, cx + w * 0.11, h * (ry + 0.03)),
                   fill=(*P["hull_dk"], 255))
    dd.ellipse((cx - w * 0.07, h * 0.24, cx + w * 0.07, h * 0.36), fill=(*P["signal"], 255))
    save_sprite(im, "td-node")
    emi = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    de = ImageDraw.Draw(emi)
    de.ellipse((cx - w * 0.09, h * 0.22, cx + w * 0.09, h * 0.38), fill=(*P["signal_lt"], 255))
    for i in range(8):
        a = i * math.pi / 4
        de.line([(cx + math.cos(a) * w * 0.06, h * 0.555 + math.sin(a) * h * 0.025),
                 (cx + math.cos(a) * w * 0.25, h * 0.555 + math.sin(a) * h * 0.105)],
                fill=(*P["signal_lt"], 220), width=5)
    save_sprite(emi.filter(ImageFilter.GaussianBlur(4.0)), "td-node-emis")


def landmark_family() -> None:
    """A FEW distinctive structures — navigation anchors, not more scatter."""
    print("landmarks")

    # crashed field pod: hull section half-buried, one lit interior port
    w, h = 300, 210
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((int(w * 0.04), int(h * 0.46), int(w * 0.96), int(h * 0.94)), fill=(*P["hull_dk"], 255))
    d.ellipse((int(w * 0.08), int(h * 0.30), int(w * 0.88), int(h * 0.78)), fill=(*P["hull"], 255))
    d.ellipse((int(w * 0.12), int(h * 0.26), int(w * 0.70), int(h * 0.58)), fill=(*P["hull_lt"], 255))
    d.polygon([(int(w * 0.62), int(h * 0.30)), (int(w * 0.99), int(h * 0.16)),
               (int(w * 0.90), int(h * 0.52))], fill=(*P["hull_dk"], 255))  # torn panel
    d.ellipse((int(w * 0.30), int(h * 0.42), int(w * 0.46), int(h * 0.56)), fill=(*P["signal"], 255))
    save_sprite(im, "td-lm-pod")
    e = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(e).ellipse((int(w * 0.29), int(h * 0.41), int(w * 0.47), int(h * 0.57)),
                              fill=(*P["signal_lt"], 255))
    save_sprite(e.filter(ImageFilter.GaussianBlur(5.0)), "td-lm-pod-emis")

    # damaged signal relay: leaning mast + dish, warm hazard lamp
    w, h = 220, 300
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((int(w * 0.18), int(h * 0.80), int(w * 0.82), int(h * 0.98)), fill=(*P["stone_dk"], 255))
    d.line([(int(w * 0.5), int(h * 0.88)), (int(w * 0.66), int(h * 0.18))],
           fill=(*P["hull"], 255), width=13)
    d.line([(int(w * 0.5), int(h * 0.88)), (int(w * 0.62), int(h * 0.18))],
           fill=(*P["hull_lt"], 255), width=5)
    for t in (0.34, 0.52, 0.70):
        d.line([(int(w * (0.5 + (0.88 - t) * 0.2)), int(h * t)),
                (int(w * (0.5 + (0.88 - t) * 0.2)) + 34, int(h * (t + 0.06)))],
               fill=(*P["hull_dk"], 255), width=6)
    d.ellipse((int(w * 0.40), int(h * 0.06), int(w * 0.94), int(h * 0.30)), fill=(*P["hull_dk"], 255))
    d.ellipse((int(w * 0.44), int(h * 0.08), int(w * 0.88), int(h * 0.26)), fill=(*P["stone"], 255))
    d.ellipse((int(w * 0.60), int(h * 0.30), int(w * 0.72), int(h * 0.38)), fill=(*P["warm"], 255))
    save_sprite(im, "td-lm-relay")
    e = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(e).ellipse((int(w * 0.58), int(h * 0.28), int(w * 0.74), int(h * 0.40)),
                              fill=(*P["warm"], 255))
    save_sprite(e.filter(ImageFilter.GaussianBlur(5.0)), "td-lm-relay-emis")

    # exposed root formation: a big organic mass to break sightlines
    w, h = 340, 200
    m = blob_mask(w, h, 9, 1.25)
    im = lit_sprite(w, h, m, [(0.0, "soil_dk"), (0.5, "soil"), (1.0, "soil_lt")], 1.3)
    d = ImageDraw.Draw(im)
    for _ in range(9):
        x0 = w * (0.15 + RNG.random() * 0.7)
        y0 = h * (0.45 + RNG.random() * 0.3)
        d.line([(x0, y0), (x0 + (RNG.random() - 0.5) * w * 0.4, y0 + h * (0.2 + RNG.random() * 0.3))],
               fill=(*P["soil_dk"], 235), width=7)
    save_sprite(im, "td-lm-roots")

    # contaminated pool: luminous, the one cool-toned landmark
    w, h = 300, 190
    m = blob_mask(w, h, 6, 1.1)
    im = lit_sprite(w, h, m, [(0.0, "water"), (0.6, "water_lt"), (1.0, "moss")], 0.35, ao_floor=0.8)
    save_sprite(im, "td-lm-pool")
    e = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    a = np.clip((m - 0.5) * 2.2, 0, 1)
    rgbe = np.zeros((h, w, 3))
    rgbe[:, :, 0] = 0x35; rgbe[:, :, 1] = 0xE0; rgbe[:, :, 2] = 0xD0
    e = Image.fromarray(np.dstack([rgbe, a * 190]).astype(np.uint8), "RGBA")
    save_sprite(e.filter(ImageFilter.GaussianBlur(7.0)), "td-lm-pool-emis")


# ============================================================================
#  MOTEL NOWHERE — zone 2. "Inside the Circuit."
#
#  THIS IS A HYBRID, and the existing pixel art is the brief. sweepTextures.ts
#  builds zone 2's ground as "wet asphalt with neon-spill puddles" and its
#  walls as FUSE-BOX STEEL PANELS with neon cyan trim — the motel lot as seen
#  THROUGH the circuit you jacked into. Not a parking lot, not an abstract
#  circuit board: both at once. This pass raises that exact world to HD; it
#  does not redesign it.
#
#  Two consequences for the art:
#
#  * The ground is WET blacktop, so its light is REFLECTED — neon spill lies
#    in the puddles rather than the surface being lit from above. Reflection,
#    not illumination, is what makes wet asphalt read as wet.
#  * The walls are MANUFACTURED. Zone 1's rule is "no rectangle is ever
#    visible", but a breaker panel is supposed to be rectangular — so the fix
#    is not to erode it, it is to make the rectangle read as ENGINEERED:
#    panel seams, bolt rows, vent louvres, a neon trim line. A blank grey
#    rectangle looks like a mistake; a bolted steel panel looks intentional.
#
#  Palette values are lifted from PALETTE in src/game/config.ts so the HD set
#  and the pixel set are the same world at two resolutions.
# ============================================================================
PM = {
    # wet blacktop — from PALETTE.asphalt / asphaltLit / asphaltPuddle
    "tar_dk":    (0x33, 0x2C, 0x3E),
    "tar":       (0x4A, 0x41, 0x59),
    "tar_lt":    (0x63, 0x58, 0x73),
    "tar_worn":  (0x7E, 0x72, 0x8E),
    "puddle":    (0x3A, 0x30, 0x50),
    "kerb":      (0x3C, 0x43, 0x56),   # PALETTE.slate
    "kerb_lt":   (0x5A, 0x62, 0x78),
    # breaker housing — PALETTE.fuseSteel / fuseSteelDark / slateDark
    "steel_dk":  (0x1E, 0x22, 0x2B),
    "steel":     (0x31, 0x36, 0x43),
    "steel_lt":  (0x4C, 0x53, 0x64),
    "block":     (0x26, 0x2D, 0x3D),
    "block_lt":  (0x3C, 0x43, 0x56),
    "paint":     (0x6B, 0x60, 0x34),   # faded lot line
    "rust":      (0x5A, 0x3A, 0x24),
    "weed":      (0x33, 0x3D, 0x28),
    "weed_lt":   (0x4A, 0x55, 0x33),
    # neon — PALETTE.neonPink / neonCyan / neonAmber / their dim variants
    "neon_pink": (0xFF, 0x4D, 0x8D),
    "neon_pink_dim": (0x6E, 0x24, 0x40),
    "neon_cyan": (0x3D, 0xF0, 0xFF),
    "neon_cyan_dim": (0x1A, 0x5A, 0x63),
    "sodium":    (0xFF, 0xB0, 0x3B),
}


def motel_tiles() -> None:
    """Wet asphalt lot + engineered breaker-panel walls."""
    print("motel ground / walls")
    P.update(PM)
    base = warped(S, S, base=2, strength=0.30)
    mid = fbm(S, S, base=7, octaves=4)
    fine = fbm(S, S, base=34, octaves=3)

    # CRACKS: ridged noise (1 - |2n-1|) sharpened. Ridged rather than plain fBm
    # because we want thin continuous SEAMS, not soft patches — the ridge lines
    # of the field are exactly where tar splits.
    ridge = 1.0 - np.abs(fbm(S, S, base=5, octaves=5) * 2 - 1)
    cracks = np.clip((ridge - 0.72) * 9.0, 0, 1)
    cracks = np.clip(cracks + np.clip((1.0 - np.abs(fbm(S, S, base=11, octaves=4) * 2 - 1) - 0.80) * 8, 0, 1), 0, 1)

    # WHERE THE WATER LIES. Standing water is the defining feature of this
    # ground, so it gets its own broad field rather than being derived from the
    # crack noise — puddles pool in shallow depressions, not along splits.
    pool = np.clip((0.46 - warped(S, S, base=3, strength=0.35)) * 3.4, 0, 1)

    height = base * 0.5 + mid * 0.34 + fine * 0.16 - cracks * 0.55
    lam = shade(height, ambient=0.66, strength=0.34)[:, :, None]

    def compose(stops, wear: float, wet: float, spill: float) -> np.ndarray:
        t = np.clip(base * 0.55 + mid * 0.32 + fine * 0.13, 0, 1)
        rgb = ramp(t, stops)
        if wear > 0:
            w_ = np.clip((base - 0.52) * 2.6, 0, 1)[:, :, None] * wear
            rgb = rgb * (1 - w_) + ramp(t, [(0.0, "tar"), (1.0, "tar_worn")]) * w_
        rgb = rgb * (1 - cracks[:, :, None] * 0.72)

        if wet > 0:
            pw = (pool * wet)[:, :, None]
            # A puddle is DARKER than dry tar (it absorbs) but carries a hard
            # specular glint (it reflects). Doing only one of the two is what
            # makes CG water read as flat paint.
            rgb = rgb * (1 - pw * 0.45) + ramp(np.clip(fine, 0, 1),
                                               [(0.0, "puddle"), (1.0, "tar")]) * pw * 0.45
            spec = np.clip((normals(height) @ LIGHT) ** 26, 0, 1)[:, :, None]
            rgb = rgb + spec * pw * 260

        # NEON SPILL — the zone's signature. Colour arrives by REFLECTION in
        # the standing water, so it appears only where the puddles are and is
        # strongest where they are smoothest. This is the single cue that says
        # "motel sign overhead" without drawing the sign.
        if spill > 0:
            s_lo = np.clip(fbm(S, S, base=4, octaves=3) * 1.5 - 0.35, 0, 1)
            cyan = (pool * s_lo * spill)[:, :, None]
            pink = (pool * np.clip(1 - s_lo, 0, 1) * spill * 0.75)[:, :, None]
            rgb = rgb + np.array(P["neon_cyan"], dtype=float) * cyan * 0.5
            rgb = rgb + np.array(P["neon_pink"], dtype=float) * pink * 0.42
        return rgb * lam

    save_tile(compose([(0.0, "tar_dk"), (0.45, "tar"), (0.8, "tar_lt"), (1.0, "tar_worn")],
                      wear=0.55, wet=0.7, spill=0.55), "td-z2-ground")
    # "lit": nearer a sign or a lamp — more spill, more reflection, not just brighter
    save_tile(compose([(0.0, "tar"), (0.4, "tar_lt"), (0.75, "tar_worn"), (1.0, "kerb_lt")],
                      wear=0.7, wet=0.85, spill=1.0), "td-z2-ground-lit")
    save_tile(compose([(0.0, "tar_dk"), (0.5, "tar_dk"), (0.85, "tar"), (1.0, "tar_lt")],
                      wear=0.2, wet=0.95, spill=0.25), "td-z2-ground-dark")
    lane = compose([(0.0, "tar"), (0.4, "tar_lt"), (0.8, "tar_worn"), (1.0, "kerb")],
                   wear=0.95, wet=0.35, spill=0.3)
    stripe = np.clip(np.sin(np.linspace(0, 2 * math.pi, S))[None, :] * 6 - 5.2, 0, 1)[:, :, None]
    lane = lane * (1 - stripe * 0.5) + np.array(P["paint"], dtype=float) * stripe * 0.5
    save_tile(lane, "td-z2-path")

    # ---------------------------------------------------------------------
    # WALLS: breaker panels, not masonry.
    #
    # Zone 1 forbids visible rectangles because a rock bank has none. Here the
    # rectangle IS the subject — so it is drawn as a MANUFACTURED one. Panel
    # seams on a regular pitch, bolt rows at the corners, vent louvres, and a
    # neon trim line picking out each panel edge. That reads as equipment; an
    # unarticulated grey rectangle reads as an unfinished asset.
    # ---------------------------------------------------------------------
    wb = fbm(S, S, base=10, octaves=4)
    wh = np.clip(wb * 0.42 + 0.34, 0, 1)
    wlam = shade(wh, ambient=0.60, strength=0.34)[:, :, None]
    cap = ramp(wh, [(0.0, "steel_dk"), (0.5, "steel"), (1.0, "steel_lt")]) * wlam

    idx = np.arange(S)
    PITCH = 44                       # panel width in texels — reads as equipment
                                     # at the ~272px ground cell, not as a grid
    seam = ((idx % PITCH) < 2)
    seam_f = seam[None, :] | seam[:, None]
    cap = cap * (1 - seam_f[:, :, None] * 0.55)
    # neon trim: a thin bright line just inside every seam
    trim = (((idx % PITCH) >= 3) & ((idx % PITCH) < 4))
    trim_f = trim[None, :] | trim[:, None]
    # Trim is a HINT of powered edge, not a light source. At 0.85 it dominated
    # the frame and the arena read as a lattice overlay rather than a place.
    cap = cap + np.array(P["neon_cyan_dim"], dtype=float) * trim_f[:, :, None] * 0.30
    # bolt rows: a dot at each panel corner region
    bolt = (((idx % PITCH) > 6) & ((idx % PITCH) < 9))
    bolt_f = bolt[None, :] & bolt[:, None]
    cap = cap + np.array(P["steel_lt"], dtype=float) * bolt_f[:, :, None] * 0.55
    save_tile(cap, "td-z2-wall-top")

    # Vertical face: the panel seen edge-on. Louvred vents run horizontally —
    # regular, hard-edged, and unmistakably manufactured, which is exactly the
    # cue that separates this surface from zone 1's stratified rock.
    H = 192
    fb = fbm(H, S, base=8, octaves=4)
    fh = np.clip(fb * 0.4 + 0.36, 0, 1)
    flam = shade(fh, ambient=0.56, strength=0.34)[:, :, None]
    face = ramp(fh, [(0.0, "steel_dk"), (0.45, "steel"), (1.0, "steel_lt")]) * flam

    rows = np.arange(H)
    louvre = ((rows % 22) < 9)[:, None]
    # each louvre is dark at its top lip and catches light at its bottom edge
    lip = ((rows % 22) < 3)[:, None]
    face = face * (1 - louvre[:, :, None] * 0.30)
    face = face * (1 - lip[:, :, None] * 0.45)
    catch = ((rows % 22) >= 7) & ((rows % 22) < 9)
    face = face + np.array(P["steel_lt"], dtype=float) * catch[:, None][:, :, None] * 0.40
    # vertical panel seams carry through onto the face so cap and face align
    face = face * (1 - seam[None, :][:, :, None] * 0.5)
    face = face + np.array(P["neon_cyan_dim"], dtype=float) * trim[None, :][:, :, None] * 0.28
    depth = np.linspace(1.06, 0.44, H)[:, None, None]
    save_tile(face * depth, "td-z2-wall-face")


def motel_props() -> None:
    print("motel props")
    P.update(PM)
    specs = [
        ("td-z2-rubble",  120,  88, 5, [(0.0, "block"), (0.55, "kerb"), (1.0, "kerb_lt")], 0.9),
        ("td-z2-tire",    116,  96, 4, [(0.0, "tar_dk"), (0.6, "tar"), (1.0, "tar_lt")], 1.05),
        ("td-z2-crate",   130, 108, 4, [(0.0, "steel_dk"), (0.55, "steel"), (1.0, "steel_lt")], 1.0),
        ("td-z2-scrap",    96,  72, 5, [(0.0, "hull_dk"), (0.6, "hull"), (1.0, "hull_lt")], 0.85),
        ("td-z2-weed",     98,  90, 5, [(0.0, "weed"), (0.6, "weed"), (1.0, "weed_lt")], 0.5),
        ("td-z2-planter", 140,  96, 4, [(0.0, "kerb"), (0.5, "kerb_lt"), (1.0, "steel_lt")], 0.95),
    ]
    for name, w, h, lobes, stops, relief in specs:
        m = blob_mask(w, h, lobes)
        img = lit_sprite(w, h, m, stops, relief)
        d = ImageDraw.Draw(img)
        if name == "td-z2-weed":
            for _ in range(14):
                bx = w * (0.2 + RNG.random() * 0.6)
                by = h * (0.66 + RNG.random() * 0.28)
                ln = h * (0.3 + RNG.random() * 0.36)
                lean = (RNG.random() - 0.5) * w * 0.36
                col = P["weed_lt"] if RNG.random() < 0.45 else P["weed"]
                d.line([(bx, by), (bx + lean, by - ln)], fill=(*col, 205), width=2)
        if name == "td-z2-tire":
            d.ellipse((w * 0.3, h * 0.34, w * 0.7, h * 0.72), fill=(*P["tar_dk"], 230))
        save_sprite(img, name)

    # traffic cone — the one saturated non-signal note on the lot floor
    w, h = 96, 116
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((w * 0.10, h * 0.80, w * 0.90, h * 0.99), fill=(*P["tar_dk"], 255))
    d.polygon([(w * 0.5, h * 0.06), (w * 0.80, h * 0.88), (w * 0.20, h * 0.88)],
              fill=(*P["rust"], 255))
    d.polygon([(w * 0.5, h * 0.06), (w * 0.66, h * 0.88), (w * 0.44, h * 0.88)],
              fill=(0xC8, 0x5A, 0x2A, 255))
    d.polygon([(w * 0.36, h * 0.50), (w * 0.64, h * 0.50), (w * 0.68, h * 0.62), (w * 0.32, h * 0.62)],
              fill=(0xD8, 0xD2, 0xC0, 235))
    save_sprite(side_shade(im), "td-z2-cone")


def motel_landmarks() -> None:
    """Navigation anchors for a lot: things that GLOW and things you park."""
    print("motel landmarks")
    P.update(PM)

    def emis(w, h, draw_fn, blur=6.0):
        e = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw_fn(ImageDraw.Draw(e))
        return e.filter(ImageFilter.GaussianBlur(blur))

    # vending machine — a lit box against a dark wall, the classic motel beacon
    w, h = 190, 260
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((w * 0.16, h * 0.14, w * 0.86, h * 0.94), fill=(*P["hull_dk"], 255))
    d.rectangle((w * 0.20, h * 0.10, w * 0.82, h * 0.90), fill=(*P["hull"], 255))
    d.rectangle((w * 0.26, h * 0.17, w * 0.66, h * 0.62), fill=(*P["neon_cyan"], 255))
    for i in range(4):  # product rows behind the glass
        d.rectangle((w * 0.28, h * (0.20 + i * 0.10), w * 0.64, h * (0.25 + i * 0.10)),
                    fill=(*P["hull_dk"], 190))
    d.rectangle((w * 0.26, h * 0.68, w * 0.64, h * 0.80), fill=(*P["hull_dk"], 255))
    save_sprite(side_shade(im), "td-z2-lm-vending")
    save_sprite(emis(w, h, lambda dd: dd.rectangle(
        (w * 0.25, h * 0.16, w * 0.67, h * 0.63), fill=(*P["neon_cyan"], 255))), "td-z2-lm-vending-emis")

    # VACANCY sign — the zone's single strongest colour note, so it earns being
    # the one thing on the lot that is unambiguously pink.
    w, h = 200, 300
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((w * 0.44, h * 0.42, w * 0.56, h * 0.98), fill=(*P["hull_dk"], 255))
    d.rectangle((w * 0.10, h * 0.06, w * 0.90, h * 0.44), fill=(*P["hull_dk"], 255))
    d.rectangle((w * 0.14, h * 0.10, w * 0.86, h * 0.40), fill=(*P["hull"], 255))
    d.rectangle((w * 0.20, h * 0.15, w * 0.80, h * 0.24), fill=(*P["neon_pink"], 255))
    d.rectangle((w * 0.24, h * 0.28, w * 0.76, h * 0.35), fill=(*P["neon_cyan"], 255))
    save_sprite(side_shade(im), "td-z2-lm-sign")
    save_sprite(emis(w, h, lambda dd: (
        dd.rectangle((w * 0.19, h * 0.14, w * 0.81, h * 0.25), fill=(*P["neon_pink"], 255)),
        dd.rectangle((w * 0.23, h * 0.27, w * 0.77, h * 0.36), fill=(*P["neon_cyan"], 255)),
    )), "td-z2-lm-sign-emis")

    # derelict car — a big silhouette that breaks sightlines, seen from above
    w, h = 320, 200
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((w * 0.06, h * 0.30, w * 0.94, h * 0.86), radius=26,
                        fill=(*P["hull_dk"], 255))
    d.rounded_rectangle((w * 0.09, h * 0.26, w * 0.91, h * 0.80), radius=24,
                        fill=(*P["rust"], 255))
    d.rounded_rectangle((w * 0.30, h * 0.33, w * 0.68, h * 0.68), radius=14,
                        fill=(*P["tar_dk"], 255))          # roof / cabin
    d.rounded_rectangle((w * 0.33, h * 0.36, w * 0.64, h * 0.52), radius=8,
                        fill=(*P["water_lt"], 190))        # windscreen glint
    for cx in (0.20, 0.80):                                 # wheels
        d.ellipse((w * (cx - 0.07), h * 0.74, w * (cx + 0.07), h * 0.92),
                  fill=(*P["tar_dk"], 255))
    save_sprite(side_shade(im), "td-z2-lm-car")

    # sodium lamp post — the light SOURCE the whole biome is lit by
    w, h = 150, 320
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((w * 0.28, h * 0.86, w * 0.72, h * 0.99), fill=(*P["kerb"], 255))
    d.rectangle((w * 0.44, h * 0.12, w * 0.56, h * 0.92), fill=(*P["hull"], 255))
    d.rectangle((w * 0.46, h * 0.12, w * 0.51, h * 0.92), fill=(*P["hull_lt"], 255))
    d.polygon([(w * 0.50, h * 0.14), (w * 0.94, h * 0.06), (w * 0.90, h * 0.20),
               (w * 0.50, h * 0.22)], fill=(*P["hull_dk"], 255))
    d.ellipse((w * 0.62, h * 0.14, w * 0.88, h * 0.22), fill=(*P["sodium"], 255))
    save_sprite(side_shade(im), "td-z2-lm-lamp")
    save_sprite(emis(w, h, lambda dd: dd.ellipse(
        (w * 0.58, h * 0.11, w * 0.92, h * 0.25), fill=(*P["sodium"], 255)), blur=9.0),
        "td-z2-lm-lamp-emis")


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--biome", default="miller", choices=["miller", "motel"])
    args = ap.parse_args()

    print("BLIP top-down asset family — one light, one palette, one noise basis\n")
    if args.biome == "miller":
        ground_family()
        wall_family()
        foliage_family()
        actor_family()          # SHARED cast — authored here, packed into every atlas
        landmark_family()
    else:
        # Scenery only. The cast is generated by the miller run and packed into
        # this biome's atlas from art-src/sprites by build-atlas.mjs — CONTACT-47
        # does not get a new body because the ground changed.
        OUT_SPRITES = os.path.join(ROOT, "art-src", f"sprites-{args.biome}")
        os.makedirs(OUT_SPRITES, exist_ok=True)
        globals()["OUT_SPRITES"] = OUT_SPRITES
        motel_tiles()
        motel_props()
        motel_landmarks()
    print(f"\ntiles  -> {OUT_TILES}\nsprites-> {OUT_SPRITES}")
