"""
카리나 NPC 초상 PNG 생성.

WHY: 미스테리오와 동일한 사이버펑크 네온·비·가죽 테크웨어 톤을 맞추되,
     장면에서 구분되는 여성 정보상 캐릭터로 새 일러를 만든다.
     배경은 기존 mysterio.png를 블러 처리해 골목 분위기만 차용한다.
"""
from __future__ import annotations

import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps

NPC_DIR = (
    r"g:\내 드라이브\KNOU\Somoim\Jungwon_Drive_Obsidian_Vault\AI 1인 MUD Game NEON REQUIEM"
    r"\frontend\src\assets\scene\images\npcs"
)
MYSTERIO = os.path.join(NPC_DIR, "mysterio.png")
OUT_PATH = os.path.join(NPC_DIR, "karina.png")


def _alley_bg(size: int) -> Image.Image:
    """미스테리오 일러에서 골목 네온 배경만 느슨하게 재사용."""
    w = h = size
    if os.path.isfile(MYSTERIO):
        ref = Image.open(MYSTERIO).convert("RGB")
        bg = ImageOps.fit(ref, (w, h), method=Image.Resampling.LANCZOS, centering=(0.52, 0.38))
        bg = bg.filter(ImageFilter.GaussianBlur(14))
        bg = ImageEnhance.Brightness(bg).enhance(0.55)
        bg = ImageEnhance.Color(bg).enhance(1.15)
        return bg.convert("RGBA")
    # 폴백: 단색 네온 그라데이션
    im = Image.new("RGB", (w, h), (12,10,22))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(20 + (8 - 20) * t)
        g = int(22 + (10 - 22) * t)
        b = int(40 + (18 - 40) * t)
        d.line([(0, y), (w, y)], fill=(r, g, b))
    return im.convert("RGBA")


def _add_rain(im: Image.Image, amount: int) -> Image.Image:
    w, h = im.size
    rain = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(rain, "RGBA")
    for _ in range(amount):
        x = random.randint(-40, w + 40)
        y = random.randint(-40, h + 40)
        ln = random.randint(14, 36)
        x2 = x + int(ln * 0.65)
        y2 = y + ln
        a = random.randint(22, 58)
        d.line((x, y, x2, y2), fill=(200, 230, 255, a), width=1)
    rain = rain.filter(ImageFilter.GaussianBlur(0.6))
    return Image.alpha_composite(im.convert("RGBA"), rain)


def make_karina_portrait(size: int = 900) -> Image.Image:
    random.seed(20260401)
    w = h = size
    base = _alley_bg(size)

    # 인물 레이어
    p = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(p, "RGBA")
    cx, cy = w // 2 + 8, h // 2 + 24

    skin = (235, 210, 198, 255)
    skin_s = (195, 168, 158, 255)
    hair = (18, 16, 22, 255)
    hair_hi = (55, 48, 62, 200)

    # 뒷머리(슬릭 백 + 긴 헤어)
    d.ellipse((cx - 280, cy - 340, cx + 280, cy + 80), fill=hair)
    d.pieslice((cx - 260, cy - 360, cx + 100, cy + 120), 200, 320, fill=hair_hi)

    # 가죽 재킷 (먼저 그려 얼굴 아래 깔림)
    j_dark = (14, 14, 20, 255)
    j_mid = (22, 22, 30, 255)
    d.rounded_rectangle((cx - 360, cy + 100, cx + 360, cy + 620), radius=130, fill=j_dark)
    d.rounded_rectangle((cx - 320, cy + 140, cx + 320, cy + 580), radius=110, fill=j_mid)

    # 하이칼라 + 안감 레드
    d.polygon(
        [
            (cx - 130, cy + 100),
            (cx + 130, cy + 100),
            (cx + 95, cy + 220),
            (cx - 95, cy + 220),
        ],
        fill=(32, 18, 28, 255),
    )
    d.polygon(
        [
            (cx - 85, cy + 110),
            (cx + 85, cy + 110),
            (cx + 55, cy + 195),
            (cx - 55, cy + 195),
        ],
        fill=(120, 24, 42, 255),
    )

    # 얼굴
    d.ellipse((cx - 148, cy - 285, cx + 148, cy + 45), fill=skin)
    d.pieslice((cx - 152, cy - 120, cx + 152, cy + 95), start=15, end=165, fill=skin_s)

    # 목
    d.rounded_rectangle((cx - 78, cy + 35, cx + 78, cy + 125), radius=26, fill=skin_s)

    # 앞머리 / 옆살
    d.pieslice((cx - 270, cy - 320, cx + 200, cy + 30), 210, 330, fill=hair)
    d.pieslice((cx - 200, cy - 330, cx - 40, cy - 40), 60, 200, fill=hair)

    # 귀
    d.ellipse((cx - 175, cy - 175, cx - 118, cy - 88), fill=skin_s)
    d.ellipse((cx + 118, cy - 175, cx + 175, cy - 88), fill=skin_s)

    # 눈 (시안 홍채, 자신감)
    ew = (238, 240, 248, 255)
    d.pieslice((cx - 125, cy - 195, cx - 12, cy - 115), 200, 350, fill=ew)
    d.pieslice((cx + 12, cy - 195, cx + 125, cy - 115), 190, 340, fill=ew)
    d.ellipse((cx - 88, cy - 168, cx - 35, cy - 128), fill=(34, 211, 238, 255))
    d.ellipse((cx + 35, cy - 168, cx + 88, cy - 128), fill=(34, 211, 238, 255))
    d.ellipse((cx - 72, cy - 158, cx - 48, cy - 136), fill=(12, 12, 18, 255))
    d.ellipse((cx + 48, cy - 158, cx + 72, cy - 136), fill=(12, 12, 18, 255))
    d.ellipse((cx - 78, cy - 165, cx - 62, cy - 150), fill=(255, 255, 255, 220))
    d.ellipse((cx + 58, cy - 162, cx + 72, cy - 150), fill=(255, 255, 255, 200))

    d.arc((cx - 145, cy - 225, cx - 15, cy - 145), start=210, end=320, fill=(28, 24, 30, 240), width=6)
    d.arc((cx + 15, cy - 225, cx + 145, cy - 145), start=220, end=330, fill=(28, 24, 30, 240), width=6)

    # 가벼운 흉터(눈썹 위 — 미스테리오와 대비되는 디테일)
    scar_y = 208
    d.line((cx - 40, cy - scar_y, cx - 8, cy - 188), fill=(180, 140, 130, 120), width=2)

    # 볼 네온 반사 (마젠타)
    d.ellipse((cx - 165, cy - 145, cx - 55, cy - 35), fill=(236, 72, 153, 38))
    d.ellipse((cx + 55, cy - 150, cx + 168, cy - 40), fill=(34, 211, 238, 32))

    # 코 / 입 — 살짝 스머지
    lip = (210, 90, 130, 230)
    d.arc((cx - 22, cy - 88, cx + 22, cy - 35), start=45, end=135, fill=(170, 130, 120, 100), width=2)
    d.arc((cx - 52, cy - 8, cx + 52, cy + 42), start=200, end=340, fill=lip, width=5)
    d.arc((cx - 40, cy + 2, cx + 40, cy + 48), start=205, end=335, fill=(255, 255, 255, 60), width=2)

    # 오른손(뷰어 기준 왼쪽) + 홀로 카드
    glove = (18, 18, 24, 255)
    d.rounded_rectangle((cx - 290, cy + 220, cx - 120, cy + 430), radius=40, fill=glove)
    holo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(holo, "RGBA")
    hx0, hy0 = cx - 255, cy + 240
    hd.rounded_rectangle((hx0, hy0, hx0 + 118, hy0 + 152), radius=12, fill=(34, 211, 238, 110))
    hd.rounded_rectangle((hx0 + 6, hy0 + 8, hx0 + 112, hy0 + 144), radius=8, fill=(12, 40, 55, 180))
    # 카드 속 거미 아이콘 각인 느낌
    hd.line((hx0 + 40, hy0 + 95, hx0 + 78, hy0 + 55), fill=(200, 240, 255, 200), width=2)
    hd.line((hx0 + 40, hy0 + 55, hx0 + 78, hy0 + 95), fill=(200, 240, 255, 200), width=2)
    holo = holo.filter(ImageFilter.GaussianBlur(1.2))
    p = Image.alpha_composite(p, holo)

    d = ImageDraw.Draw(p, "RGBA")
    # 재킷 어깨 회로 자수 (화이트/시안)
    for i in range(5):
        y0 = cy + 160 + i * 28
        d.line((cx + 120, y0, cx + 280, y0 + 8), fill=(220, 235, 250, 140 - i * 18), width=2)
    d.line((cx + 130, cy + 175, cx + 240, cy + 290), fill=(34, 211, 238, 130), width=2)
    # 작은 거미줄 패턴
    d.line((cx + 200, cy + 200, cx + 248, cy + 200), fill=(240, 248, 255, 100), width=1)
    d.line((cx + 224, cy + 178, cx + 224, cy + 232), fill=(240, 248, 255, 100), width=1)

    # 네온 파이프 라인
    d.rounded_rectangle((cx - 340, cy + 125, cx + 340, cy + 600), radius=120, outline=(34, 211, 238, 130), width=4)
    d.rounded_rectangle((cx - 310, cy + 155, cx + 310, cy + 570), radius=100, outline=(236, 72, 153, 90), width=3)

    # 이어링 네온 링
    d.ellipse((cx + 138, cy - 178, cx + 172, cy - 142), outline=(34, 211, 238, 220), width=4)

    base = Image.alpha_composite(base, p)

    # 핑크/시안 림 (인물 실루엣 근사)
    alpha = p.split()[-1]
    edge = alpha.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(2))
    edge = ImageEnhance.Contrast(edge).enhance(2.0)
    rim = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rp = rim.load()
    ep = edge.load()
    for y in range(h):
        for x in range(w):
            v = ep[x, y]
            if v > 25:
                rp[x, y] = (236, 72, 153, min(120, v // 2)) if x < cx else (34, 211, 238, min(120, v // 2))
    rim = rim.filter(ImageFilter.GaussianBlur(4))
    base = Image.alpha_composite(base, rim)

    base = ImageEnhance.Color(base).enhance(1.18)
    base = ImageEnhance.Contrast(base).enhance(1.12)
    base = _add_rain(base, 820)

    # 비네트
    vign = Image.new("L", (w, h), 0)
    vd = ImageDraw.Draw(vign)
    vd.ellipse((-int(w * 0.12), -int(h * 0.06), int(w * 1.12), int(h * 1.08)), fill=255)
    vign = vign.filter(ImageFilter.GaussianBlur(55))
    vp = vign.load()
    px = base.load()
    for y in range(h):
        for x in range(w):
            t = vp[x, y] / 255.0
            k = 0.76 + 0.24 * t
            r, g, b, a = px[x, y]
            px[x, y] = (int(r * k), int(g * k), int(b * k), a)

    noise = Image.effect_noise((w, h), 9).convert("L")
    noise = noise.point(lambda x: int((x - 128) * 0.22 + 128))
    nr = Image.merge("RGB", (noise, noise, noise)).convert("RGBA")
    nr.putalpha(14)
    base = Image.alpha_composite(base, nr)

    return base.convert("RGB")


def main() -> None:
    os.makedirs(NPC_DIR, exist_ok=True)
    img = make_karina_portrait(900)
    img.save(OUT_PATH, format="PNG", optimize=True)
    print("saved", OUT_PATH)


if __name__ == "__main__":
    main()
