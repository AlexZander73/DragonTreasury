#!/usr/bin/env python3
"""Generate painted-looking dragon and treasure atlases for DragonTreasury.

The runtime frame contracts stay unchanged (same names and coordinates), so scene
rigging/physics code does not need structural changes.
"""

from __future__ import annotations

import json
import math
import random
from collections import deque
from pathlib import Path
from typing import Dict, Tuple

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ATLAS_DIR = ROOT / "public" / "assets" / "atlases"
SOURCE_DIR = ROOT / "public" / "assets" / "source"
DRAGON_PARTS_DIR = SOURCE_DIR / "dragon-parts"
TREASURE_PARTS_DIR = SOURCE_DIR / "treasure-parts"

Color = Tuple[int, int, int, int]

DRAGON_REFERENCE_CROP_BOXES: Dict[str, tuple[int, int, int, int]] = {
    "dragon-body": (170, 282, 404, 472),
    "dragon-head": (26, 38, 342, 370),
    "dragon-jaw": (174, 160, 336, 304),
    "dragon-tail": (324, 372, 1016, 688),
    "dragon-wing": (520, 28, 1014, 394),
    "dragon-eye": (190, 142, 252, 204),
    "dragon-horn": (44, 28, 286, 208),
    "dragon-scales": (18, 420, 214, 706),
    "dragon-spines": (328, 560, 864, 816),
    "dragon-glow": (478, 518, 1018, 1018),
}

DRAGON_HERO_CROP_BOXES: Dict[str, tuple[int, int, int, int]] = {
    "dragon-body": (20, 126, 1012, 844),
    "dragon-head": (44, 130, 382, 436),
    "dragon-jaw": (176, 240, 382, 420),
    "dragon-tail": (486, 540, 1016, 818),
    "dragon-wing": (388, 112, 996, 520),
    "dragon-eye": (246, 236, 288, 274),
    "dragon-horn": (40, 108, 332, 252),
    "dragon-scales": (52, 290, 286, 748),
    "dragon-spines": (390, 536, 796, 690),
    "dragon-glow": (270, 242, 448, 392),
}

TREASURE_REFERENCE_CROP_BOXES: Dict[str, tuple[int, int, int, int]] = {
    "coin": (12, 554, 109, 652),
    "gem": (246, 556, 346, 655),
    "artifact": (628, 558, 785, 715),
    "legendary-relic": (519, 827, 654, 987),
    "cursed-item": (922, 802, 1009, 988),
    "metal-idol": (829, 630, 945, 749),
    "arcane-crystal": (451, 559, 530, 641),
    "scroll-capsule": (917, 614, 1010, 788),
}

DRAGON_PART_ALIASES: Dict[str, tuple[str, ...]] = {
    "dragon-body": ("dragon-body", "body"),
    "dragon-head": ("dragon-head", "head"),
    "dragon-jaw": ("dragon-jaw", "jaw", "mouth"),
    "dragon-tail": ("dragon-tail", "tail"),
    "dragon-wing": ("dragon-wing", "wing"),
    "dragon-eye": ("dragon-eye", "eye"),
    "dragon-horn": ("dragon-horn", "horn"),
    "dragon-scales": ("dragon-scales", "scales"),
    "dragon-spines": ("dragon-spines", "spines"),
    "dragon-glow": ("dragon-glow", "glow", "ember"),
}

TREASURE_PART_ALIASES: Dict[str, tuple[str, ...]] = {
    "coin": ("coin",),
    "gem": ("gem", "gem-blue", "gem-red"),
    "artifact": ("artifact", "relic"),
    "legendary-relic": ("legendary-relic", "legendary"),
    "cursed-item": ("cursed-item", "cursed"),
    "metal-idol": ("metal-idol", "idol"),
    "arcane-crystal": ("arcane-crystal", "crystal"),
    "scroll-capsule": ("scroll-capsule", "scroll"),
}


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


def first_existing(paths: list[Path]) -> Path | None:
    for path in paths:
        if path.exists():
            return path
    return None


def load_reference_image(candidates: list[str]) -> tuple[Image.Image, str] | None:
    path = first_existing([SOURCE_DIR / name for name in candidates])
    if not path:
        return None
    return Image.open(path).convert("RGBA"), path.name.lower()


def chroma_key_light_background(image: Image.Image, min_luma: int = 214, max_channel_diff: int = 22) -> Image.Image:
    img = image.convert("RGBA")
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    src_px = img.load()
    dst_px = out.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = src_px[x, y]
            max_c = max(r, g, b)
            min_c = min(r, g, b)
            if max_c >= min_luma and (max_c - min_c) <= max_channel_diff:
                dst_px[x, y] = (0, 0, 0, 0)
            else:
                dst_px[x, y] = (r, g, b, a)

    alpha = out.split()[3].filter(ImageFilter.GaussianBlur(0.7))
    out.putalpha(alpha)
    return out


def trim_to_alpha_bounds(image: Image.Image, padding: int = 8) -> Image.Image:
    rgba_img = image.convert("RGBA")
    bbox = rgba_img.getbbox()
    if not bbox:
        return rgba_img
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(rgba_img.width, bbox[2] + padding)
    bottom = min(rgba_img.height, bbox[3] + padding)
    return rgba_img.crop((left, top, right, bottom))


def extract_largest_alpha_component(image: Image.Image, alpha_threshold: int = 20) -> Image.Image:
    src = image.convert("RGBA")
    w, h = src.size
    alpha = src.split()[3]
    alpha_data = list(alpha.getdata())
    visited = bytearray(w * h)

    best_component: list[int] = []
    best_count = 0

    for idx, value in enumerate(alpha_data):
        if value <= alpha_threshold or visited[idx]:
            continue
        visited[idx] = 1
        queue = deque([idx])
        component = [idx]

        while queue:
            current = queue.popleft()
            x = current % w
            y = current // w
            neighbors = (
                current - 1 if x > 0 else None,
                current + 1 if x < w - 1 else None,
                current - w if y > 0 else None,
                current + w if y < h - 1 else None,
            )
            for next_idx in neighbors:
                if next_idx is None or visited[next_idx]:
                    continue
                visited[next_idx] = 1
                if alpha_data[next_idx] > alpha_threshold:
                    queue.append(next_idx)
                    component.append(next_idx)

        if len(component) > best_count:
            best_count = len(component)
            best_component = component

    if not best_component:
        return src

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    src_px = src.load()
    out_px = out.load()
    for idx in best_component:
        x = idx % w
        y = idx // w
        out_px[x, y] = src_px[x, y]
    return out


def prepare_reference_part(image: Image.Image, target_size: tuple[int, int], largest_component: bool = False) -> Image.Image:
    cutout = chroma_key_light_background(image.convert("RGBA"))
    if largest_component:
        cutout = extract_largest_alpha_component(cutout, alpha_threshold=22)
    cutout = trim_to_alpha_bounds(cutout, padding=10)
    cutout = cutout.filter(ImageFilter.UnsharpMask(radius=1.4, percent=120, threshold=5))

    target = Image.new("RGBA", target_size, (0, 0, 0, 0))
    fitted = ImageOps.contain(cutout, target_size, method=Image.Resampling.LANCZOS)
    x = (target_size[0] - fitted.width) // 2
    y = (target_size[1] - fitted.height) // 2
    target.alpha_composite(fitted, (x, y))
    return target


def crop_reference_part(
    source: Image.Image, box: tuple[int, int, int, int], target_size: tuple[int, int], largest_component: bool = False
) -> Image.Image:
    crop = source.crop(box).convert("RGBA")
    return prepare_reference_part(crop, target_size, largest_component=largest_component)


def load_reference_part_file(
    part_dir: Path, aliases: tuple[str, ...], target_size: tuple[int, int], largest_component: bool = False
) -> Image.Image | None:
    candidates: list[Path] = []
    for alias in aliases:
        candidates.extend(
            (
                part_dir / f"{alias}.png",
                part_dir / f"{alias}.webp",
                part_dir / f"{alias}.jpg",
                part_dir / f"{alias}.jpeg",
            )
        )
    path = first_existing(candidates)
    if not path:
        return None
    return prepare_reference_part(Image.open(path).convert("RGBA"), target_size, largest_component=largest_component)


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
    d = ImageDraw.Draw(img, "RGBA")

    tone_map = {
        "sapphire": ("#d8eeff", "#3f80db", "#0f3268"),
        "emerald": ("#d5ffd7", "#45b067", "#1c5e2f"),
        "amethyst": ("#f0ddff", "#9a63d8", "#421d74"),
        "arcane": ("#dcffff", "#3dbfc9", "#165764"),
    }
    light, mid, dark = tone_map[tone]

    if tone == "emerald":
        poly = [(w * 0.50, h * 0.08), (w * 0.84, h * 0.28), (w * 0.76, h * 0.84), (w * 0.32, h * 0.92), (w * 0.12, h * 0.36)]
    elif tone == "amethyst":
        poly = [(w * 0.50, h * 0.06), (w * 0.86, h * 0.24), (w * 0.82, h * 0.78), (w * 0.46, h * 0.94), (w * 0.14, h * 0.62), (w * 0.16, h * 0.20)]
    elif tone == "arcane":
        poly = [(w * 0.50, h * 0.08), (w * 0.88, h * 0.26), (w * 0.70, h * 0.90), (w * 0.30, h * 0.90), (w * 0.12, h * 0.26)]
    else:
        poly = [(w * 0.50, h * 0.08), (w * 0.86, h * 0.30), (w * 0.74, h * 0.90), (w * 0.30, h * 0.92), (w * 0.12, h * 0.36)]

    mask = Image.new("L", size, 0)
    md = ImageDraw.Draw(mask)
    md.polygon(poly, fill=255)

    fill = radial_glow(size, rgba(light, 255), rgba(dark, 255), power=1.08)
    img.alpha_composite(apply_mask(fill, mask))

    d.polygon(poly, outline=rgba("f3fdff", 215), width=4)
    d.polygon([(w * 0.50, h * 0.12), (w * 0.70, h * 0.30), (w * 0.30, h * 0.32)], fill=rgba(light, 140))
    d.polygon([(w * 0.14, h * 0.33), (w * 0.50, h * 0.12), (w * 0.50, h * 0.90)], fill=rgba(mid, 126))
    d.polygon([(w * 0.86, h * 0.33), (w * 0.50, h * 0.12), (w * 0.50, h * 0.90)], fill=rgba(dark, 165))
    d.polygon([(w * 0.34, h * 0.42), (w * 0.66, h * 0.42), (w * 0.50, h * 0.56)], fill=rgba("ffffff", 92))

    for i in range(4):
        x0 = w * (0.24 + i * 0.14)
        d.line((x0, h * 0.30, x0 + 12, h * 0.86), fill=rgba("ebfbff", 120), width=2)

    d.ellipse((w * 0.24, h * 0.22, w * 0.46, h * 0.40), fill=rgba("ffffff", 48))
    add_masked_grain(img, seed=19 + len(tone), amount=16, dark_hex="#111a2a", light_hex="#f1fbff", max_alpha=24)

    return img.filter(ImageFilter.GaussianBlur(0.18))


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


def add_brush_strokes(
    image: Image.Image,
    mask: Image.Image,
    seed: int,
    base_hex: str,
    accent_hex: str,
    count: int,
    alpha_range: tuple[int, int] = (36, 110),
    width_range: tuple[int, int] = (3, 10),
) -> None:
    rng = random.Random(seed)
    draw = ImageDraw.Draw(image, "RGBA")
    bbox = mask.getbbox()
    if not bbox:
        return

    left, top, right, bottom = bbox
    for _ in range(count):
        x = rng.randint(left, right)
        y = rng.randint(top, bottom)
        angle = rng.uniform(-math.pi * 0.9, math.pi * 0.2)
        length = rng.uniform(18, 62)
        x2 = x + math.cos(angle) * length
        y2 = y + math.sin(angle) * length
        color_hex = accent_hex if rng.random() > 0.68 else base_hex
        draw.line(
            (x, y, x2, y2),
            fill=rgba(color_hex, rng.randint(alpha_range[0], alpha_range[1])),
            width=rng.randint(width_range[0], width_range[1]),
        )

    image_alpha = image.split()[3]
    masked_alpha = ImageChops.multiply(image_alpha, mask)
    image.putalpha(masked_alpha)


def paint_dragon_body(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    shell_mask = Image.new("L", size, 0)
    sd = ImageDraw.Draw(shell_mask)

    outer = (12, 20, w - 8, h - 10)
    inner = (w * 0.31, h * 0.30, w * 0.78, h * 0.72)
    sd.ellipse(outer, fill=255)
    sd.ellipse((w * 0.10, h * 0.38, w * 0.74, h * 0.98), fill=255)
    sd.polygon(
        [
            (w * 0.14, h * 0.74),
            (w * 0.34, h * 0.54),
            (w * 0.72, h * 0.60),
            (w * 0.96, h * 0.76),
            (w * 0.88, h * 0.92),
            (w * 0.34, h * 0.98),
        ],
        fill=255,
    )

    hollow = Image.new("L", size, 0)
    ImageDraw.Draw(hollow).ellipse(tuple(int(v) for v in inner), fill=255)
    shell_mask = ImageChops.subtract(shell_mask, hollow)

    # Carve an asymmetrical notch where neck/head fold over the coil.
    carve = Image.new("L", size, 0)
    ImageDraw.Draw(carve).polygon(
        [
            (w * 0.56, h * 0.18),
            (w * 0.94, h * 0.26),
            (w * 0.86, h * 0.54),
            (w * 0.62, h * 0.46),
        ],
        fill=255,
    )
    shell_mask = ImageChops.subtract(shell_mask, carve)

    edge_pass = ImageDraw.Draw(shell_mask)
    for i in range(15):
        t = i / 14
        x = w * (0.06 + t * 0.76)
        y = h * (0.82 + math.sin(i * 0.62) * 0.07)
        edge_pass.ellipse((x - 10, y - 8, x + 10, y + 8), fill=255)

    base = radial_glow(size, rgba("cf5b1a"), rgba("3c0f0e"), power=1.05)
    img.alpha_composite(apply_mask(base, shell_mask))

    underpaint = radial_glow(size, rgba("ff8a2f", 190), rgba("8f150f", 0), power=1.35)
    ember_mask = Image.new("L", size, 0)
    ImageDraw.Draw(ember_mask).ellipse((w * 0.28, h * 0.50, w * 0.72, h * 0.92), fill=205)
    img.alpha_composite(apply_mask(underpaint, ember_mask))

    scale_layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_scale_pattern(scale_layer, (20, 52, w - 14, h - 34), rgba("f48b2e"), seed=307, alpha=142)
    draw_scale_pattern(scale_layer, (24, 58, w - 18, h - 36), rgba("622012"), seed=311, alpha=96)
    img.alpha_composite(apply_mask(scale_layer, shell_mask))

    for band in range(9):
        t = band / 8
        x = w * (0.30 + t * 0.34)
        y = h * (0.56 + t * 0.25)
        pw = 14 - t * 2.6
        ph = 9 - t * 1.8
        d.polygon(
            [
                (x - pw * 0.8, y - ph * 0.35),
                (x + pw * 0.8, y - ph * 0.35),
                (x + pw * 0.55, y + ph * 0.6),
                (x, y + ph),
                (x - pw * 0.55, y + ph * 0.6),
            ],
            fill=rgba("ffd27e", 94 - int(t * 24)),
            outline=rgba("b56d2f", 102),
        )

    for i in range(13):
        x = w * (0.20 + i * 0.048)
        y = h * (0.26 + math.sin(i * 0.45) * 0.06)
        d.polygon([(x, y), (x + 10, y - 20), (x + 21, y)], fill=rgba("f27f2c", 132), outline=rgba("5a1a0f", 140))

    d.arc((w * 0.03, h * 0.05, w * 0.84, h * 0.72), 192, 344, fill=rgba("ffd086", 150), width=8)
    d.arc((w * 0.06, h * 0.08, w * 0.82, h * 0.72), 198, 330, fill=rgba("3b100d", 126), width=12)

    add_masked_grain(img, seed=317, amount=30, dark_hex="#2a0f0d", light_hex="#ffb56d", max_alpha=56)

    return img.filter(ImageFilter.GaussianBlur(0.26))


def paint_dragon_head(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    mask = Image.new("L", size, 0)
    md = ImageDraw.Draw(mask)
    md.polygon(
        [
            (w * 0.05, h * 0.40),
            (w * 0.28, h * 0.16),
            (w * 0.63, h * 0.11),
            (w * 0.92, h * 0.30),
            (w * 0.95, h * 0.54),
            (w * 0.76, h * 0.76),
            (w * 0.49, h * 0.86),
            (w * 0.16, h * 0.76),
            (w * 0.06, h * 0.58),
        ],
        fill=255,
    )

    fill = radial_glow(size, rgba("d75719"), rgba("2d0f10"), power=1.08)
    img.alpha_composite(apply_mask(fill, mask))

    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).polygon(
        [
            (w * 0.12, h * 0.56),
            (w * 0.52, h * 0.48),
            (w * 0.88, h * 0.53),
            (w * 0.56, h * 0.73),
            (w * 0.20, h * 0.69),
        ],
        fill=rgba("1a0708", 190),
    )
    img.alpha_composite(apply_mask(shadow, mask))

    brow = [
        (w * 0.24, h * 0.27),
        (w * 0.68, h * 0.21),
        (w * 0.80, h * 0.30),
        (w * 0.52, h * 0.40),
        (w * 0.28, h * 0.35),
    ]
    d.polygon(brow, fill=rgba("ff9a4f", 116))
    d.line((w * 0.11, h * 0.58, w * 0.84, h * 0.50), fill=rgba("2c0c0b", 196), width=10)
    d.line((w * 0.13, h * 0.56, w * 0.82, h * 0.49), fill=rgba("e9873c", 118), width=3)

    for idx in range(9):
        x = w * (0.12 + idx * 0.085)
        y = h * (0.52 - idx * 0.022)
        d.polygon([(x, y), (x + 9, y - 19), (x + 17, y)], fill=rgba("ffd8a8", 130), outline=rgba("5a2411", 130))

    for row in range(5):
        for col in range(5):
            cx = w * (0.24 + col * 0.11 + row * 0.012)
            cy = h * (0.32 + row * 0.08)
            d.polygon(
                [(cx - 7, cy - 5), (cx + 7, cy - 5), (cx + 5, cy + 7), (cx, cy + 10), (cx - 5, cy + 7)],
                fill=rgba("f1792b", 95),
                outline=rgba("4f150e", 120),
            )

    add_masked_grain(img, seed=353, amount=30, dark_hex="#260e0d", light_hex="#ef8d43", max_alpha=62)

    return img.filter(ImageFilter.GaussianBlur(0.22))


def paint_dragon_jaw(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    jaw = [(w * 0.05, h * 0.26), (w * 0.86, h * 0.29), (w * 0.98, h * 0.54), (w * 0.22, h * 0.78), (w * 0.04, h * 0.54)]
    d.polygon(jaw, fill=rgba("b04820", 255), outline=rgba("5a1d10", 196), width=3)
    d.line((w * 0.18, h * 0.42, w * 0.82, h * 0.45), fill=rgba("1e0707", 210), width=5)
    for idx in range(5):
        x = w * (0.16 + idx * 0.12)
        d.polygon([(x, h * 0.58), (x + 7, h * 0.37), (x + 15, h * 0.58)], fill=rgba("ffd6a4", 165), outline=rgba("58200f", 120))
    add_masked_grain(img, seed=367, amount=20, dark_hex="#2b0f0d", light_hex="#ef8e43", max_alpha=42)
    return img.filter(ImageFilter.GaussianBlur(0.16))


def paint_dragon_tail(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    mask = Image.new("L", size, 0)
    md = ImageDraw.Draw(mask)
    md.polygon(
        [
            (w * 0.06, h * 0.42),
            (w * 0.56, h * 0.24),
            (w * 0.90, h * 0.33),
            (w * 0.97, h * 0.52),
            (w * 0.76, h * 0.76),
            (w * 0.34, h * 0.92),
            (w * 0.08, h * 0.80),
            (w * 0.03, h * 0.58),
        ],
        fill=255,
    )

    base = radial_glow(size, rgba("cf5718"), rgba("2a0f10"), power=1.08)
    img.alpha_composite(apply_mask(base, mask))
    scale_layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_scale_pattern(scale_layer, (16, 48, w - 20, h - 18), rgba("f6882d"), seed=373, alpha=138)
    draw_scale_pattern(scale_layer, (18, 50, w - 22, h - 20), rgba("5a1d12"), seed=377, alpha=85)
    img.alpha_composite(apply_mask(scale_layer, mask))
    d.line((w * 0.20, h * 0.56, w * 0.86, h * 0.44), fill=rgba("ffd28b", 84), width=5)
    for i in range(8):
        x = w * (0.24 + i * 0.085)
        y = h * (0.36 + math.sin(i * 0.65) * 0.1)
        d.polygon([(x, y), (x + 8, y - 15), (x + 16, y)], fill=rgba("f57f2c", 130), outline=rgba("53180f", 140))
    add_masked_grain(img, seed=379, amount=24, dark_hex="#2a100d", light_hex="#ef8e46", max_alpha=50)
    return img.filter(ImageFilter.GaussianBlur(0.24))


def paint_dragon_wing(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    wing = [(w * 0.12, h * 0.94), (w * 0.88, h * 0.18), (w * 0.70, h * 0.96)]
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon(wing, fill=255)
    base = radial_glow(size, rgba("ffb13a"), rgba("b33a13"), power=1.22)
    img.alpha_composite(apply_mask(base, mask))

    ribs = [(0.34, 0.80, 0.52), (0.44, 0.76, 0.58), (0.54, 0.72, 0.64), (0.64, 0.70, 0.71)]
    for x, y, topx in ribs:
        d.line((w * x, h * 0.82, w * topx, h * y), fill=rgba("ffca63", 130), width=5)
        d.line((w * x, h * 0.82, w * topx, h * y), fill=rgba("a72e11", 145), width=3)
    d.polygon(wing, outline=rgba("6f210f", 200), width=5)
    add_masked_grain(img, seed=389, amount=26, dark_hex="#5a1b10", light_hex="#ffb45b", max_alpha=48)
    return img.filter(ImageFilter.GaussianBlur(0.22))


def paint_dragon_eye(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((w * 0.06, h * 0.14, w * 0.94, h * 0.88), fill=rgba("3a1b0f", 255))
    d.polygon([(w * 0.08, h * 0.52), (w * 0.40, h * 0.20), (w * 0.88, h * 0.44), (w * 0.64, h * 0.78)], fill=rgba("ffcd58", 250))
    d.polygon([(w * 0.44, h * 0.18), (w * 0.56, h * 0.48), (w * 0.48, h * 0.82), (w * 0.40, h * 0.50)], fill=rgba("1a0806", 230))
    d.ellipse((w * 0.18, h * 0.28, w * 0.44, h * 0.46), fill=rgba("fff5d8", 94))
    return img.filter(ImageFilter.GaussianBlur(0.1))


def paint_dragon_horn(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    horn = [(w * 0.18, h * 0.93), (w * 0.74, h * 0.20), (w * 0.88, h * 0.08), (w * 0.62, h * 0.96)]
    d.polygon(horn, fill=rgba("f2d7ac", 248), outline=rgba("8b5d2b", 210), width=3)
    for i in range(6):
        t = i / 5
        x1 = w * (0.24 + t * 0.42)
        y1 = h * (0.84 - t * 0.56)
        d.line((x1, y1, x1 + 20, y1 - 18), fill=rgba("ab7b46", 126), width=2)
    d.line((w * 0.32, h * 0.80, w * 0.78, h * 0.22), fill=rgba("fff6e3", 152), width=2)
    return img.filter(ImageFilter.GaussianBlur(0.16))


def paint_dragon_scales(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_scale_pattern(img, (6, 8, w - 6, h - 8), rgba("ff8f2f"), seed=401, alpha=200)
    draw_scale_pattern(img, (9, 12, w - 9, h - 10), rgba("5c1d12"), seed=409, alpha=88)
    add_masked_grain(img, seed=419, amount=18, dark_hex="#3a120f", light_hex="#ffaf56", max_alpha=40)
    return img.filter(ImageFilter.GaussianBlur(0.16))


def paint_dragon_spines(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    for i in range(12):
        x = w * (0.02 + i * 0.082)
        y = h * (0.66 + math.sin(i * 0.33) * 0.1)
        hgt = 24 + int(10 * math.sin(i * 0.9 + 0.5))
        d.polygon([(x, y), (x + 9, y - hgt), (x + 22, y)], fill=rgba("d2571d", 235), outline=rgba("4d170f", 160))
        d.line((x + 4, y - 2, x + 11, y - hgt + 4), fill=rgba("ffb76b", 132), width=2)
    return img.filter(ImageFilter.GaussianBlur(0.16))


def paint_dragon_glow(size: tuple[int, int]) -> Image.Image:
    img = radial_glow(size, rgba("ffb54a", 238), rgba("d32112", 0), power=1.62)
    return img.filter(ImageFilter.GaussianBlur(9.0))


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
    treasure_reference_data = load_reference_image(
        [
            "booty.png",
            "booty.webp",
            "booty.jpg",
            "treasure-reference.png",
            "treasure-reference.webp",
            "treasure-reference.jpg",
            "treasure-sheet.png",
            "treasure-sheet.webp",
            "treasure-sheet.jpg",
        ]
    )
    treasure_reference = treasure_reference_data[0] if treasure_reference_data else None

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
        "coin": 22,
        "gem": 18,
        "artifact": 16,
        "legendary-relic": 0,
        "cursed-item": 18,
        "metal-idol": 16,
        "arcane-crystal": 16,
        "scroll-capsule": 14,
    }

    for key, frame in frame_data.items():
        size = (frame["w"], frame["h"])
        img = load_reference_part_file(TREASURE_PARTS_DIR, TREASURE_PART_ALIASES.get(key, (key,)), size)
        if img is None and treasure_reference and key in TREASURE_REFERENCE_CROP_BOXES:
            img = crop_reference_part(treasure_reference, TREASURE_REFERENCE_CROP_BOXES[key], size)
        if img is None:
            painter = painters.get(key)
            if not painter:
                continue
            img = painter(size)
        img = clip_alpha_floor(img, alpha_floor_by_key.get(key, 0))
        paste_frame(canvas, frame, img)

    png_path = ATLAS_DIR / "treasure-atlas.png"
    webp_path = ATLAS_DIR / "treasure-atlas.webp"
    canvas.save(png_path, optimize=True)
    canvas.save(webp_path, format="WEBP", quality=92, method=6)


def generate_dragon_atlas() -> None:
    frame_data = load_frames(ATLAS_DIR / "dragon-atlas.json")
    canvas = Image.new("RGBA", (2048, 750), (0, 0, 0, 0))
    dragon_reference_data = load_reference_image(
        [
            "dragonhero.png",
            "dragonhero.webp",
            "dragonhero.jpg",
            "dragon.png",
            "dragon.webp",
            "dragon.jpg",
            "dragon-reference.png",
            "dragon-reference.webp",
            "dragon-reference.jpg",
            "dragon-sheet.png",
            "dragon-sheet.webp",
            "dragon-sheet.jpg",
        ]
    )
    dragon_reference = dragon_reference_data[0] if dragon_reference_data else None
    dragon_reference_name = dragon_reference_data[1] if dragon_reference_data else ""
    dragon_crop_boxes = DRAGON_HERO_CROP_BOXES if "dragonhero" in dragon_reference_name else DRAGON_REFERENCE_CROP_BOXES

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
        "dragon-body": 22,
        "dragon-head": 20,
        "dragon-jaw": 18,
        "dragon-tail": 20,
        "dragon-wing": 18,
        "dragon-eye": 10,
        "dragon-horn": 12,
        "dragon-scales": 16,
        "dragon-spines": 14,
        "dragon-glow": 0,
    }

    for key, frame in frame_data.items():
        size = (frame["w"], frame["h"])
        isolate = key != "dragon-glow"
        img = load_reference_part_file(
            DRAGON_PARTS_DIR, DRAGON_PART_ALIASES.get(key, (key,)), size, largest_component=isolate
        )
        if img is None and dragon_reference and key in dragon_crop_boxes:
            img = crop_reference_part(dragon_reference, dragon_crop_boxes[key], size, largest_component=isolate)
        if img is None:
            painter = painters.get(key)
            if not painter:
                continue
            img = painter(size)
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
