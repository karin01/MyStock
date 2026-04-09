"""
npc_generic.png — 고품질 장면 톤에 맞춘 폴백 초상.

WHY (사용자 혼선 방지):
- 미스테리오(mysterio.png) 같은 일러는 **외부에서 만든 고해상도 원화**를
  프로젝트에 넣은 것이지, Pillow로 같은 날 "그렸다"는 의미가 아니다.
- 예전에 시도했던 **다중 일러 블렌딩 + 포스터라이즈 + 엣지 강조**는
  만화/벡터 같은 저해상 느낌이 나서 미스테리오 톤과 어긋난다.

이 스크립트는 **mysterio.png 텍스처만** 강하게 흐리고(특정 인물 식별 불가),
네온 듀오톤·스캔라인·비·비네트로 "데이터 네트워크 상의 익명 접점" 느낌을 낸다.
"""
from __future__ import annotations

import os
import random
from typing import Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps, ImageChops

OUT_PATH = (
    r"g:\내 드라이브\KNOU\Somoim\Jungwon_Drive_Obsidian_Vault\AI 1인 MUD Game NEON REQUIEM"
    r"\frontend\src\assets\scene\images\npcs\npc_generic.png"
)
NPC_DIR = r"g:\내 드라이브\KNOU\Somoim\Jungwon_Drive_Obsidian_Vault\AI 1인 MUD Game NEON REQUIEM\frontend\src\assets\scene\images\npcs"
MYSTERIO = os.path.join(NPC_DIR, "mysterio.png")


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_color(c1: Tuple[int, int, int], c2: Tuple[int, int, int], t: float) -> Tuple[int, int, int]:
    return (
        int(lerp(c1[0], c2[0], t)),
        int(lerp(c1[1], c2[1], t)),
        int(lerp(c1[2], c2[2], t)),
    )


def neon_city_bg(size: int) -> Image.Image:
    """mysterio.png가 없을 때만 쓰는 최소 네온 골목."""
    w = h = size
    base = Image.new("RGB", (w, h), (10, 12, 22))
    d = ImageDraw.Draw(base)
    top = (26, 28, 48)
    bottom = (6, 7, 14)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=lerp_color(top, bottom, t))
    return base


def add_rain(im: Image.Image, amount: int) -> Image.Image:
    w, h = im.size
    rain = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(rain, "RGBA")
    for _ in range(amount):
        x = random.randint(-40, w + 40)
        y = random.randint(-40, h + 40)
        ln = random.randint(10, 28)
        x2 = x + int(ln * 0.65)
        y2 = y + ln
        a = random.randint(16, 48)
        d.line((x, y, x2, y2), fill=(200, 230, 255, a), width=1)
    rain = rain.filter(ImageFilter.GaussianBlur(0.7))
    return Image.alpha_composite(im.convert("RGBA"), rain)


def draw_portrait(size: int) -> Image.Image:
    w = h = size
    random.seed(20260401)

    if os.path.isfile(MYSTERIO):
        base = Image.open(MYSTERIO).convert("RGB")
        base = ImageOps.fit(base, (w, h), method=Image.Resampling.LANCZOS, centering=(0.52, 0.34))
    else:
        base = neon_city_bg(size)

    # 강한 블러 = 얼굴·의상 디테일 익명화 (원화 "질감"은 색 덩어리로 남음)
    base = base.filter(ImageFilter.GaussianBlur(20))
    base = ImageEnhance.Color(base).enhance(1.14)
    base = ImageEnhance.Contrast(base).enhance(1.10)
    base = ImageEnhance.Brightness(base).enhance(0.80)

    # 그레이스케일 듀오톤으로 네온 팔레트 고정(미스테리오 장면과 톤 정렬)
    gray = ImageOps.grayscale(base)
    duo = ImageOps.colorize(gray, (12, 20, 36), (210, 75, 145))
    base = Image.blend(base, duo, 0.32)

    img = base.convert("RGBA")

    # 미세 크로마틱 어긋남(네온 노이즈 느낌)
    r, g, b = img.convert("RGB").split()
    r = ImageChops.offset(r, 2, 0)
    b = ImageChops.offset(b, -2, 0)
    img = Image.merge("RGB", (r, g, b)).convert("RGBA")

    # CRT 스캔라인(얇게)
    scan = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scan, "RGBA")
    for y in range(0, h, 4):
        sd.line([(0, y), (w, y)], fill=(255, 255, 255, 10))
    img = Image.alpha_composite(img, scan)

    # 모서리 시안 보조광(은은)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    gd.ellipse((-80, -80, w * 0.55, h * 0.65), fill=(34, 211, 238, 28))
    gd.ellipse((w * 0.45, h * 0.35, w + 90, h + 90), fill=(236, 72, 153, 22))
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    img = Image.alpha_composite(img, glow)

    img = add_rain(img, 720)

    vign = Image.new("L", (w, h), 0)
    vd = ImageDraw.Draw(vign)
    vd.ellipse((-140, -70, w + 140, h + 160), fill=255)
    vign = vign.filter(ImageFilter.GaussianBlur(65))
    vp = vign.load()
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = vp[x, y] / 255.0
            k = 0.78 + 0.22 * t
            r2, g2, b2, a = px[x, y]
            px[x, y] = (int(r2 * k), int(g2 * k), int(b2 * k), a)

    noise = Image.effect_noise((w, h), 10).convert("L")
    noise = noise.point(lambda p: int((p - 128) * 0.18 + 128))
    nrgba = Image.merge("RGB", (noise, noise, noise)).convert("RGBA")
    nrgba.putalpha(12)
    img = Image.alpha_composite(img, nrgba)

    return img.convert("RGB")


def main() -> None:
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    img = draw_portrait(900)
    img.save(OUT_PATH, format="PNG", optimize=True)
    print("saved", OUT_PATH)


if __name__ == "__main__":
    main()
