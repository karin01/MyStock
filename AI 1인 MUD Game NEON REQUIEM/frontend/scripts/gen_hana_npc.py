from __future__ import annotations

import os
import random
import math
from PIL import Image, ImageDraw, ImageFilter


def _vgrad(w: int, h: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    im = Image.new("RGB", (w, h), top)
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        d.line([(0, y), (w, y)], fill=(r, g, b))
    return im


def _add_glow(im: Image.Image, color: tuple[int, int, int], alpha: int, blur: int, mask: Image.Image) -> Image.Image:
    glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    # mask는 L 채널로, 외곽 라이트용
    m = mask.filter(ImageFilter.GaussianBlur(blur))
    px = glow.load()
    mp = m.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            a = mp[x, y]
            if a:
                px[x, y] = (color[0], color[1], color[2], min(255, int(a * alpha / 255)))
    return Image.alpha_composite(im.convert("RGBA"), glow)


def make_hana_portrait(size: int = 900) -> Image.Image:
    """
    예쁜 여성(동양인 느낌) 픽서 컨셉의 1:1 초상 PNG.

    WHY: 현재 세션에서 모델 기반 인물 생성이 제한되어, 직접 PNG를 생성해 퀄리티를 최대한 확보한다.
    """
    w = h = size

    # 배경: 네온 보케 + 다크 그라데이션
    bg = _vgrad(w, h, (10, 12, 18), (4, 5, 8)).convert("RGBA")
    bokeh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bokeh, "RGBA")
    palette = [(34, 211, 238), (236, 72, 153), (250, 204, 21)]
    for _ in range(26):
        cx = random.randint(0, w)
        cy = random.randint(0, h)
        r = random.randint(80, 220)
        col = random.choice(palette)
        bd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(col[0], col[1], col[2], random.randint(12, 26)))
    bokeh = bokeh.filter(ImageFilter.GaussianBlur(26))
    base = Image.alpha_composite(bg, bokeh)

    # 인물 레이어
    p = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(p, "RGBA")

    cx, cy = w // 2, h // 2 + 20

    # 피부 톤(따뜻한 베이지) + 음영
    skin = (229, 205, 190, 255)
    skin_shadow = (178, 156, 145, 255)
    blush = (236, 72, 153, 55)

    # 헤어(긴 생머리 + 앞머리) — 다크 브라운
    hair = (24, 18, 22, 255)
    hair_hi = (50, 38, 44, 140)

    # 헤어 뒤 매스
    d.ellipse((cx - 285, cy - 360, cx + 285, cy + 210), fill=hair)
    # 헤어 안쪽 하이라이트
    d.ellipse((cx - 250, cy - 320, cx + 120, cy + 190), fill=hair_hi)

    # 얼굴(타원) + 턱선
    face_box = (cx - 150, cy - 300, cx + 150, cy + 80)
    d.ellipse(face_box, fill=skin)
    # 턱 음영
    d.pieslice((cx - 155, cy - 80, cx + 155, cy + 170), start=20, end=160, fill=skin_shadow)

    # 앞머리(곡선)
    d.pieslice((cx - 290, cy - 380, cx + 290, cy + 90), start=205, end=335, fill=hair)
    # 앞머리 가닥
    for i in range(7):
        x = cx - 110 + i * 35
        d.pieslice((x - 65, cy - 330, x + 65, cy + 20), start=200, end=320, fill=(20, 14, 18, 255))

    # 귀(살짝)
    d.ellipse((cx - 175, cy - 150, cx - 120, cy - 60), fill=skin_shadow)
    d.ellipse((cx + 120, cy - 150, cx + 175, cy - 60), fill=skin_shadow)

    # 눈: 아몬드 형태 + 하이라이트 (시안 네온)
    eye_white = (235, 238, 242, 255)
    eye_line = (20, 18, 24, 255)
    iris = (34, 211, 238, 255)
    iris2 = (236, 72, 153, 90)

    def eye(x0: int, y0: int, flip: int) -> None:
        # 눈 흰자
        d.pieslice((x0 - 95, y0 - 45, x0 + 95, y0 + 45), start=200 if flip < 0 else -20, end=340 if flip < 0 else 160, fill=eye_white)
        # 아이라인
        d.arc((x0 - 98, y0 - 48, x0 + 98, y0 + 48), start=205 if flip < 0 else -15, end=335 if flip < 0 else 155, fill=eye_line, width=5)
        # 홍채
        d.ellipse((x0 - 28, y0 - 18, x0 + 28, y0 + 38), fill=iris)
        d.ellipse((x0 - 18, y0 - 8, x0 + 18, y0 + 26), fill=(10, 10, 14, 255))
        # 하이라이트
        d.ellipse((x0 - 16, y0 - 10, x0 - 3, y0 + 3), fill=(255, 255, 255, 230))
        d.ellipse((x0 + 6, y0 - 2, x0 + 12, y0 + 4), fill=(255, 255, 255, 160))
        # 핑크 보조광
        d.ellipse((x0 - 44, y0 + 22, x0 + 44, y0 + 62), fill=iris2)

    eye(cx - 85, cy - 120, -1)
    eye(cx + 85, cy - 120, +1)

    # 눈썹
    brow = (30, 22, 28, 230)
    d.arc((cx - 160, cy - 200, cx - 20, cy - 90), start=210, end=330, fill=brow, width=7)
    d.arc((cx + 20, cy - 200, cx + 160, cy - 90), start=210, end=330, fill=brow, width=7)

    # 볼터치
    d.ellipse((cx - 170, cy - 95, cx - 70, cy + 15), fill=blush)
    d.ellipse((cx + 70, cy - 95, cx + 170, cy + 15), fill=blush)

    # 코/입
    d.arc((cx - 18, cy - 60, cx + 18, cy + 15), start=40, end=140, fill=(160, 130, 120, 140), width=3)
    lip = (236, 72, 153, 210)
    d.arc((cx - 55, cy + 5, cx + 55, cy + 55), start=200, end=340, fill=lip, width=5)
    d.arc((cx - 38, cy + 18, cx + 38, cy + 62), start=210, end=330, fill=(255, 255, 255, 55), width=3)

    # 목 + 칼라
    d.rounded_rectangle((cx - 70, cy + 60, cx + 70, cy + 190), radius=28, fill=skin_shadow)
    d.polygon([(cx - 70, cy + 160), (cx, cy + 120), (cx + 70, cy + 160), (cx, cy + 210)], fill=(16, 16, 24, 255))

    # 테크웨어 재킷(어깨 넓게) + 네온 라인
    jacket = (14, 16, 26, 255)
    jacket2 = (10, 12, 20, 255)
    d.rounded_rectangle((cx - 340, cy + 170, cx + 340, cy + 560), radius=120, fill=jacket)
    d.rounded_rectangle((cx - 300, cy + 210, cx + 300, cy + 520), radius=110, fill=jacket2)

    # 네온 파이핑
    neon1 = (34, 211, 238, 200)
    neon2 = (236, 72, 153, 160)
    for i, col in enumerate([neon1, neon2]):
        inset = 24 + i * 10
        d.rounded_rectangle((cx - 340 + inset, cy + 170 + inset, cx + 340 - inset, cy + 560 - inset), radius=110, outline=col, width=6)

    # 액세서리: 이어커프(네온 링)
    d.ellipse((cx + 152, cy - 122, cx + 188, cy - 86), outline=(34, 211, 238, 220), width=4)
    d.ellipse((cx + 146, cy - 116, cx + 194, cy - 68), outline=(236, 72, 153, 160), width=3)

    # 합성(림라이트 + 글로우)
    base = Image.alpha_composite(base, p)

    # 림 마스크: 인물 알파의 에지 근사
    mask = p.split()[-1].filter(ImageFilter.FIND_EDGES)
    base = _add_glow(base, (34, 211, 238), alpha=180, blur=8, mask=mask)
    base = _add_glow(base, (236, 72, 153), alpha=120, blur=14, mask=mask)

    # 소프트 비네트
    vign = Image.new("L", (w, h), 0)
    vd = ImageDraw.Draw(vign)
    vd.ellipse((-int(w * 0.15), -int(h * 0.05), int(w * 1.15), int(h * 1.10)), fill=255)
    vign = vign.filter(ImageFilter.GaussianBlur(60))
    vpx = vign.load()
    out = base.copy()
    opx = out.load()
    for y in range(h):
        for x in range(w):
            t = vpx[x, y] / 255.0
            # 가장자리 어둡게
            k = 0.72 + 0.28 * t
            r, g, b, a = opx[x, y]
            opx[x, y] = (int(r * k), int(g * k), int(b * k), a)

    # 그레인
    noise = Image.effect_noise((w, h), 10).convert("L")
    noise = noise.point(lambda p: int((p - 128) * 0.28 + 128))
    noise_rgba = Image.merge("RGB", (noise, noise, noise)).convert("RGBA")
    noise_rgba.putalpha(18)
    out = Image.alpha_composite(out, noise_rgba)

    return out.convert("RGB")


if __name__ == "__main__":
    out_dir = (
        r"g:\내 드라이브\KNOU\Somoim\Jungwon_Drive_Obsidian_Vault\AI 1인 MUD Game NEON REQUIEM"
        r"\frontend\src\assets\scene\images\npcs"
    )
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "hana.png")

    img = make_hana_portrait(900)
    img.save(out_path, format="PNG", optimize=True)
    print("saved", out_path)

