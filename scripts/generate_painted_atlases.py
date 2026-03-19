#!/usr/bin/env python3
"""Generate painted-looking dragon and treasure atlases for DragonTreasury.

The runtime frame contracts stay unchanged (same names and coordinates), so scene
rigging/physics code does not need structural changes.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path
from typing import Dict, Tuple

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ATLAS_DIR = ROOT / "public" / "assets" / "atlases"

Color = Tuple[int, int, int, int]


def rgba(hex_color: str, alpha: int = 255) -> Color:
    hex_color = hex_color.lstrip("#")
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
        alpha,
    )


def soft_noise(size: tuple[int, int], amount: int, seed: int) -> Image.Image:
    rng = random.Random(seed)
    base = Image.effect_noise(size, amount)
    base = ImageOps.autocontrast(base)
    # Break regularity with blurred offset mix.
    shifted = ImageChops.offset(base, rng.randint(6, 26), rng.randint(6, 26)).filter(
        ImageFilter.GaussianBlur(rng.uniform(0.6, 1.5))
    )
    return ImageChops.blend(base, shifted, 0.45)


def radial_glow(size: tuple[int, int], inner: Color, outer: Color, power: float = 1.55) -> Image.Image:
    w, h = size
    cx = w / 2
    cy = h / 2
    max_d = math.hypot(cx, cy)
    img = Image.new("RGBA", size)
    px = img.load()
    for y in range(h):
      for x in range(w):
          d = math.hypot(x - cx, y - cy) / max_d
          t = min(1.0, max(0.0, d ** power))
          px[x, y] = (
              int(inner[0] + (outer[0] - inner[0]) * t),
              int(inner[1] + (outer[1] - inner[1]) * t),
              int(inner[2] + (outer[2] - inner[2]) * t),
              int(inner[3] + (outer[3] - inner[3]) * t),
          )
    return img


def apply_mask(image: Image.Image, mask: Image.Image) -> Image.Image:
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    out.paste(image, (0, 0), mask)
    return out


def clip_alpha_floor(image: Image.Image, threshold: int) -> Image.Image:
    if threshold <= 0:
        return image
    rgba_img = image.convert("RGBA")
    r, g, b, a = rgba_img.split()
    a = a.point(lambda value: 0 if value < threshold else value)
    rgba_img.putalpha(a)
    return rgba_img


def add_masked_grain(
    image: Image.Image,
    seed: int,
    amount: int,
    dark_hex: str,
    light_hex: str,
    max_alpha: int,
) -> None:
    grain = soft_noise(image.size, amount, seed)
    grain_col = ImageOps.colorize(grain, dark_hex, light_hex).convert("RGBA")
    mask = image.convert("RGBA").split()[3]
    grain_alpha = mask.point(lambda value: int((value / 255.0) * max_alpha))
    grain_col.putalpha(grain_alpha)
    image.alpha_composite(grain_col)


def draw_scale_pattern(layer: Image.Image, area: tuple[int, int, int, int], color: Color, seed: int, alpha: int = 140) -> None:
    rng = random.Random(seed)
    draw = ImageDraw.Draw(layer)
    left, top, right, bottom = area
    row_h = max(6, (bottom - top) // 16)
    col_w = max(8, (right - left) // 20)
    for row, y in enumerate(range(top, bottom + row_h, row_h)):
        offset = col_w // 2 if row % 2 else 0
        for x in range(left - col_w, right + col_w, col_w):
            rx = x + offset + rng.randint(-1, 1)
            ry = y + rng.randint(-1, 1)
            draw.pieslice(
                [rx, ry - row_h // 2, rx + col_w, ry + row_h // 2],
                start=200,
                end=340,
                fill=(color[0], color[1], color[2], alpha),
            )


def bevel_outline(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, light: Color, dark: Color) -> None:
    draw.rounded_rectangle(box, radius=radius, outline=dark, width=5)
    inset = (box[0] + 2, box[1] + 2, box[2] - 2, box[3] - 2)
    draw.rounded_rectangle(inset, radius=max(2, radius - 2), outline=light, width=2)


def paint_coin(size: tuple[int, int]) -> Image.Image:
    w, h = size
    base = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(base)

    ring = (26, 26, w - 26, h - 26)
    inner = (52, 52, w - 52, h - 52)

    radial = radial_glow(size, rgba("f3c974"), rgba("7f4f25"))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse(ring, fill=255)
    base.alpha_composite(apply_mask(radial, mask))

    d.ellipse(ring, outline=rgba("7a4a24", 255), width=10)
    d.ellipse(inner, outline=rgba("d9b172", 220), width=5)

    for idx in range(18):
        a = (math.pi * 2 * idx) / 18
        x = w * 0.5 + math.cos(a) * (w * 0.31)
        y = h * 0.5 + math.sin(a) * (h * 0.31)
        d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=rgba("6c4322", 170))

    d.arc((w * 0.23, h * 0.27, w * 0.78, h * 0.72), 220, 350, fill=rgba("fbe4b3", 180), width=5)
    d.line((w * 0.36, h * 0.44, w * 0.63, h * 0.44), fill=rgba("8a5b30", 200), width=9)
    d.line((w * 0.36, h * 0.56, w * 0.63, h * 0.56), fill=rgba("8a5b30", 200), width=9)
    d.line((w * 0.36, h * 0.68, w * 0.63, h * 0.68), fill=rgba("8a5b30", 200), width=9)

    add_masked_grain(base, seed=7, amount=22, dark_hex="#4f361f", light_hex="#e8c483", max_alpha=46)

    return base.filter(ImageFilter.GaussianBlur(0.35))


def paint_gem(size: tuple[int, int], tone: str = "sapphire") -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    tone_map = {
        "sapphire": ("#c6e2ff", "#4d7fca", "#1d3159"),
        "emerald": ("#cdf7e7", "#4a9d86", "#183f38"),
        "amethyst": ("#ecd7ff", "#8965c2", "#352355"),
        "arcane": ("#d8ffff", "#54b6be", "#1e4652"),
    }
    light, mid, dark = tone_map[tone]

    poly = [
        (w * 0.50, h * 0.10),
        (w * 0.86, h * 0.35),
        (w * 0.70, h * 0.90),
        (w * 0.30, h * 0.90),
        (w * 0.14, h * 0.35),
    ]

    mask = Image.new("L", size, 0)
    md = ImageDraw.Draw(mask)
    md.polygon(poly, fill=255)

    fill = radial_glow(size, rgba(light, 255), rgba(dark, 255), power=1.2)
    img.alpha_composite(apply_mask(fill, mask))

    d.polygon(poly, outline=rgba("f3fdff", 180), width=4)
    d.polygon([(w * 0.50, h * 0.14), (w * 0.67, h * 0.33), (w * 0.33, h * 0.33)], fill=rgba(light, 120))
    d.polygon([(w * 0.14, h * 0.35), (w * 0.50, h * 0.14), (w * 0.50, h * 0.90)], fill=rgba(mid, 110))
    d.polygon([(w * 0.86, h * 0.35), (w * 0.50, h * 0.14), (w * 0.50, h * 0.90)], fill=rgba(dark, 140))
    d.polygon([(w * 0.36, h * 0.40), (w * 0.64, h * 0.40), (w * 0.50, h * 0.55)], fill=rgba("ffffff", 75))

    for i in range(4):
        x0 = w * (0.28 + i * 0.12)
        d.line((x0, h * 0.36, x0 + 10, h * 0.86), fill=rgba("dff6ff", 120), width=2)

    add_masked_grain(img, seed=19, amount=18, dark_hex="#0f1d2d", light_hex="#edf8ff", max_alpha=26)

    return img.filter(ImageFilter.GaussianBlur(0.25))


def paint_artifact(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    box = (24, 24, w - 24, h - 24)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=48, fill=255)

    gradient = radial_glow(size, rgba("d5a370"), rgba("60361f"))
    img.alpha_composite(apply_mask(gradient, mask))

    bevel_outline(d, box, 48, rgba("ffd8a0", 150), rgba("58331d", 220))

    d.rounded_rectangle((w * 0.20, h * 0.18, w * 0.80, h * 0.25), radius=10, fill=rgba("8a5a32", 170))
    d.rounded_rectangle((w * 0.20, h * 0.75, w * 0.80, h * 0.82), radius=10, fill=rgba("8a5a32", 170))

    d.ellipse((w * 0.34, h * 0.34, w * 0.66, h * 0.66), fill=rgba("d1a063", 100), outline=rgba("f4d19a", 160), width=4)
    d.line((w * 0.50, h * 0.30, w * 0.50, h * 0.70), fill=rgba("f7dfb8", 160), width=3)
    d.line((w * 0.30, h * 0.50, w * 0.70, h * 0.50), fill=rgba("f7dfb8", 160), width=3)

    for a in range(0, 360, 35):
        r = w * 0.18
        x = w * 0.50 + math.cos(math.radians(a)) * r
        y = h * 0.50 + math.sin(math.radians(a)) * r
        d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=rgba("f3d7a4", 140))

    add_masked_grain(img, seed=31, amount=24, dark_hex="#3f2415", light_hex="#e0bc84", max_alpha=52)

    return img.filter(ImageFilter.GaussianBlur(0.28))


def paint_legendary(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    points = []
    cx, cy = w * 0.5, h * 0.5
    for i in range(10):
        a = math.radians(-90 + i * 36)
        r = w * (0.38 if i % 2 == 0 else 0.17)
        points.append((cx + math.cos(a) * r, cy + math.sin(a) * r))

    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    fill = radial_glow(size, rgba("ffe89e"), rgba("7c4b1e"), power=1.45)
    img.alpha_composite(apply_mask(fill, mask))

    d.polygon(points, outline=rgba("fff3cf", 210), width=4)
    d.ellipse((w * 0.41, h * 0.41, w * 0.59, h * 0.59), fill=rgba("e7c16a", 170), outline=rgba("fff1cb", 170), width=3)

    for x in (0.48, 0.52):
        d.line((w * x, h * 0.23, w * x, h * 0.77), fill=rgba("ffefc8", 180), width=3)
    d.line((w * 0.28, h * 0.52, w * 0.72, h * 0.52), fill=rgba("ffefc8", 170), width=3)

    add_masked_grain(img, seed=47, amount=17, dark_hex="#4a2f1b", light_hex="#fbe7bd", max_alpha=36)

    return img


def paint_cursed(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    shard = [
        (w * 0.12, h * 0.22),
        (w * 0.75, h * 0.16),
        (w * 0.90, h * 0.50),
        (w * 0.62, h * 0.84),
        (w * 0.22, h * 0.80),
        (w * 0.08, h * 0.52),
    ]

    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon(shard, fill=255)
    fill = radial_glow(size, rgba("d87d93"), rgba("3b1423"), power=1.35)
    img.alpha_composite(apply_mask(fill, mask))

    d.polygon(shard, outline=rgba("f1a2b7", 170), width=3)
    cracks = [
        ((w * 0.18, h * 0.54), (w * 0.84, h * 0.46)),
        ((w * 0.29, h * 0.20), (w * 0.62, h * 0.72)),
        ((w * 0.52, h * 0.14), (w * 0.41, h * 0.63)),
    ]
    for (x1, y1), (x2, y2) in cracks:
        d.line((x1, y1, x2, y2), fill=rgba("2a0914", 170), width=7)
        d.line((x1, y1, x2, y2), fill=rgba("623046", 110), width=2)

    d.ellipse((w * 0.44, h * 0.24, w * 0.70, h * 0.39), fill=rgba("f9c2d0", 45))

    add_masked_grain(img, seed=63, amount=29, dark_hex="#2b0f1a", light_hex="#ffbfd0", max_alpha=50)

    return img.filter(ImageFilter.GaussianBlur(0.2))


def paint_idol(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    body = (w * 0.18, h * 0.10, w * 0.82, h * 0.90)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(body, radius=int(w * 0.18), fill=255)

    fill = radial_glow(size, rgba("b8c4d1"), rgba("39475a"), power=1.4)
    img.alpha_composite(apply_mask(fill, mask))

    bevel_outline(d, tuple(int(v) for v in body), int(w * 0.18), rgba("d5deea", 120), rgba("2c394a", 220))
    d.ellipse((w * 0.36, h * 0.30, w * 0.64, h * 0.52), fill=rgba("2f3d52", 220))
    d.rounded_rectangle((w * 0.30, h * 0.63, w * 0.70, h * 0.77), radius=10, fill=rgba("34455c", 220))

    for y in (0.20, 0.26, 0.82):
        d.line((w * 0.24, h * y, w * 0.76, h * y), fill=rgba("d7e5f7", 70), width=3)

    add_masked_grain(img, seed=81, amount=20, dark_hex="#1a2532", light_hex="#d8e3f3", max_alpha=40)

    return img.filter(ImageFilter.GaussianBlur(0.25))


def paint_scroll(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    sheet = (w * 0.12, h * 0.24, w * 0.88, h * 0.78)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(sheet, radius=int(h * 0.2), fill=255)
    fill = radial_glow(size, rgba("e3bf91"), rgba("7c4f2f"), power=1.45)
    img.alpha_composite(apply_mask(fill, mask))

    d.rounded_rectangle(tuple(int(v) for v in sheet), radius=int(h * 0.2), outline=rgba("704328", 210), width=4)
    d.ellipse((w * 0.03, h * 0.35, w * 0.24, h * 0.67), fill=rgba("75492a", 245))
    d.ellipse((w * 0.76, h * 0.35, w * 0.97, h * 0.67), fill=rgba("75492a", 245))
    for i in range(4):
        y = h * (0.35 + i * 0.10)
        d.line((w * 0.23, y, w * 0.77, y), fill=rgba("c89364", 140), width=4)

    add_masked_grain(img, seed=103, amount=24, dark_hex="#5a3621", light_hex="#f4d9b2", max_alpha=48)

    return img.filter(ImageFilter.GaussianBlur(0.2))


def paint_dragon_body(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    mask = Image.new("L", size, 0)
    md = ImageDraw.Draw(mask)
    md.ellipse((22, 40, w - 20, h - 48), fill=255)
    md.ellipse((w * 0.18, h * 0.20, w * 0.84, h * 0.82), fill=255)

    base = radial_glow(size, rgba("6f4e3b"), rgba("1f1a28"), power=1.22)
    img.alpha_composite(apply_mask(base, mask))

    scale_layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_scale_pattern(scale_layer, (36, 92, w - 34, h - 84), rgba("8a6a4f"), seed=7, alpha=120)
    img.alpha_composite(apply_mask(scale_layer, mask))

    d.ellipse((w * 0.20, h * 0.35, w * 0.82, h * 0.95), fill=rgba("7e5a41", 130))
    d.arc((w * 0.18, h * 0.21, w * 0.83, h * 0.62), 188, 354, fill=rgba("f6cf93", 145), width=7)

    for i in range(5):
        cx = w * (0.56 + i * 0.065)
        cy = h * (0.39 + i * 0.018)
        d.ellipse((cx - 10, cy - 6, cx + 10, cy + 6), fill=rgba("b5946f", 88))

    add_masked_grain(img, seed=137, amount=26, dark_hex="#2a1c16", light_hex="#d2af88", max_alpha=44)

    return img.filter(ImageFilter.GaussianBlur(0.18))


def paint_dragon_head(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    head = [
        (w * 0.08, h * 0.22),
        (w * 0.60, h * 0.18),
        (w * 0.90, h * 0.33),
        (w * 0.82, h * 0.62),
        (w * 0.48, h * 0.80),
        (w * 0.16, h * 0.72),
        (w * 0.06, h * 0.49),
    ]

    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon(head, fill=255)
    fill = radial_glow(size, rgba("6e4f44"), rgba("242033"), power=1.28)
    img.alpha_composite(apply_mask(fill, mask))

    d.polygon(head, outline=rgba("8f7158", 210), width=4)
    d.polygon([(w * 0.40, h * 0.30), (w * 0.72, h * 0.27), (w * 0.56, h * 0.40)], fill=rgba("8a6e66", 130))

    d.line((w * 0.18, h * 0.60, w * 0.75, h * 0.55), fill=rgba("27151d", 220), width=9)
    d.line((w * 0.21, h * 0.58, w * 0.73, h * 0.55), fill=rgba("7c5f4f", 150), width=2)

    d.ellipse((w * 0.65, h * 0.30, w * 0.78, h * 0.40), fill=rgba("d4b08d", 36))

    for idx in range(6):
        x = w * (0.18 + idx * 0.08)
        y = h * (0.64 - idx * 0.02)
        d.polygon([(x, y), (x + 9, y - 16), (x + 16, y)], fill=rgba("d9c2a8", 125))

    add_masked_grain(img, seed=157, amount=22, dark_hex="#20161a", light_hex="#c9a489", max_alpha=40)

    return img.filter(ImageFilter.GaussianBlur(0.18))


def paint_dragon_jaw(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    jaw = [(w * 0.08, h * 0.28), (w * 0.84, h * 0.30), (w * 0.96, h * 0.56), (w * 0.20, h * 0.74), (w * 0.06, h * 0.52)]
    d.polygon(jaw, fill=rgba("5f4035", 255), outline=rgba("8d6b57", 210), width=3)
    d.line((w * 0.18, h * 0.42, w * 0.72, h * 0.44), fill=rgba("2a141a", 190), width=4)
    for idx in range(4):
        x = w * (0.22 + idx * 0.12)
        d.polygon([(x, h * 0.54), (x + 6, h * 0.40), (x + 12, h * 0.54)], fill=rgba("e3ccb2", 145))
    return img.filter(ImageFilter.GaussianBlur(0.14))


def paint_dragon_tail(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    body = [
        (w * 0.10, h * 0.44),
        (w * 0.72, h * 0.22),
        (w * 0.95, h * 0.50),
        (w * 0.74, h * 0.78),
        (w * 0.16, h * 0.90),
        (w * 0.04, h * 0.64),
    ]
    d.polygon(body, fill=rgba("4f3d45", 255), outline=rgba("8a6d5b", 180), width=3)
    for i in range(3):
        x1 = w * (0.26 + i * 0.18)
        y1 = h * (0.36 + i * 0.08)
        d.line((x1, y1, x1 + 44, y1 - 12), fill=rgba("8f7680", 130), width=4)
    return img.filter(ImageFilter.GaussianBlur(0.2))


def paint_dragon_wing(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    wing = [(w * 0.16, h * 0.92), (w * 0.90, h * 0.12), (w * 0.70, h * 0.96)]
    d.polygon(wing, fill=rgba("33293a", 240), outline=rgba("705b6c", 160), width=4)
    ribs = [(0.35, 0.78), (0.48, 0.73), (0.60, 0.68)]
    for x, y in ribs:
        d.line((w * x, h * 0.80, w * y, h * 0.24), fill=rgba("8b7586", 120), width=5)
    return img.filter(ImageFilter.GaussianBlur(0.28))


def paint_dragon_eye(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((w * 0.08, h * 0.18, w * 0.92, h * 0.84), fill=rgba("31222a", 255))
    d.polygon([(w * 0.50, h * 0.18), (w * 0.72, h * 0.50), (w * 0.50, h * 0.82), (w * 0.36, h * 0.50)], fill=rgba("f4c56f", 245))
    d.polygon([(w * 0.50, h * 0.20), (w * 0.58, h * 0.50), (w * 0.50, h * 0.80), (w * 0.44, h * 0.50)], fill=rgba("180a08", 210))
    d.ellipse((w * 0.18, h * 0.28, w * 0.46, h * 0.46), fill=rgba("fff5d8", 80))
    return img.filter(ImageFilter.GaussianBlur(0.1))


def paint_dragon_horn(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    horn = [(w * 0.20, h * 0.90), (w * 0.70, h * 0.22), (w * 0.82, h * 0.10), (w * 0.56, h * 0.94)]
    d.polygon(horn, fill=rgba("d8bb8f", 245), outline=rgba("8a6a3f", 200), width=3)
    d.line((w * 0.34, h * 0.78, w * 0.72, h * 0.26), fill=rgba("f4debf", 140), width=2)
    return img.filter(ImageFilter.GaussianBlur(0.15))


def paint_dragon_scales(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_scale_pattern(img, (8, 10, w - 8, h - 8), rgba("a4947a"), seed=191, alpha=180)
    return img.filter(ImageFilter.GaussianBlur(0.1))


def paint_dragon_spines(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i in range(10):
        x = w * (0.06 + i * 0.09)
        y = h * (0.62 + math.sin(i * 0.34) * 0.08)
        d.polygon([(x, y), (x + 10, y - 28), (x + 20, y)], fill=rgba("6f5445", 220), outline=rgba("b69777", 160))
    return img.filter(ImageFilter.GaussianBlur(0.14))


def paint_dragon_glow(size: tuple[int, int]) -> Image.Image:
    img = radial_glow(size, rgba("f5b162", 220), rgba("f5b162", 0), power=1.85)
    return img.filter(ImageFilter.GaussianBlur(8.0))


def paste_frame(atlas: Image.Image, frame: dict, image: Image.Image) -> None:
    target_w = frame["w"]
    target_h = frame["h"]
    if image.size != (target_w, target_h):
        image = image.resize((target_w, target_h), Image.Resampling.LANCZOS)
    atlas.alpha_composite(image, (frame["x"], frame["y"]))


def load_frames(path: Path) -> Dict[str, dict]:
    data = json.loads(path.read_text())
    return data["frames"]


def generate_treasure_atlas() -> None:
    frame_data = load_frames(ATLAS_DIR / "treasure-atlas.json")
    canvas = Image.new("RGBA", (2048, 670), (0, 0, 0, 0))

    painters = {
        "coin": lambda size: paint_coin(size),
        "gem": lambda size: paint_gem(size, tone="sapphire"),
        "artifact": lambda size: paint_artifact(size),
        "legendary-relic": lambda size: paint_legendary(size),
        "cursed-item": lambda size: paint_cursed(size),
        "metal-idol": lambda size: paint_idol(size),
        "arcane-crystal": lambda size: paint_gem(size, tone="arcane"),
        "scroll-capsule": lambda size: paint_scroll(size),
    }
    alpha_floor_by_key = {
        "coin": 64,
        "gem": 62,
        "artifact": 62,
        "legendary-relic": 0,
        "cursed-item": 62,
        "metal-idol": 62,
        "arcane-crystal": 62,
        "scroll-capsule": 62,
    }

    for key, frame in frame_data.items():
        painter = painters.get(key)
        if not painter:
            continue
        img = painter((frame["w"], frame["h"]))
        img = clip_alpha_floor(img, alpha_floor_by_key.get(key, 0))
        paste_frame(canvas, frame, img)

    png_path = ATLAS_DIR / "treasure-atlas.png"
    webp_path = ATLAS_DIR / "treasure-atlas.webp"
    canvas.save(png_path, optimize=True)
    canvas.save(webp_path, format="WEBP", quality=92, method=6)


def generate_dragon_atlas() -> None:
    frame_data = load_frames(ATLAS_DIR / "dragon-atlas.json")
    canvas = Image.new("RGBA", (2048, 750), (0, 0, 0, 0))

    painters = {
        "dragon-body": lambda size: paint_dragon_body(size),
        "dragon-head": lambda size: paint_dragon_head(size),
        "dragon-jaw": lambda size: paint_dragon_jaw(size),
        "dragon-tail": lambda size: paint_dragon_tail(size),
        "dragon-wing": lambda size: paint_dragon_wing(size),
        "dragon-eye": lambda size: paint_dragon_eye(size),
        "dragon-horn": lambda size: paint_dragon_horn(size),
        "dragon-scales": lambda size: paint_dragon_scales(size),
        "dragon-spines": lambda size: paint_dragon_spines(size),
        "dragon-glow": lambda size: paint_dragon_glow(size),
    }
    alpha_floor_by_key = {
        "dragon-body": 60,
        "dragon-head": 60,
        "dragon-jaw": 54,
        "dragon-tail": 58,
        "dragon-wing": 58,
        "dragon-eye": 32,
        "dragon-horn": 50,
        "dragon-scales": 58,
        "dragon-spines": 48,
        "dragon-glow": 0,
    }

    for key, frame in frame_data.items():
        painter = painters.get(key)
        if not painter:
            continue
        img = painter((frame["w"], frame["h"]))
        img = clip_alpha_floor(img, alpha_floor_by_key.get(key, 0))
        paste_frame(canvas, frame, img)

    png_path = ATLAS_DIR / "dragon-atlas.png"
    webp_path = ATLAS_DIR / "dragon-atlas.webp"
    canvas.save(png_path, optimize=True)
    canvas.save(webp_path, format="WEBP", quality=92, method=6)


def main() -> None:
    generate_treasure_atlas()
    generate_dragon_atlas()
    print("Generated painted atlases:")
    print("-", ATLAS_DIR / "treasure-atlas.png")
    print("-", ATLAS_DIR / "treasure-atlas.webp")
    print("-", ATLAS_DIR / "dragon-atlas.png")
    print("-", ATLAS_DIR / "dragon-atlas.webp")


if __name__ == "__main__":
    main()
