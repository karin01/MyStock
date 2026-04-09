from __future__ import annotations

import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageEnhance


REF_PATH = r"C:\Users\Luna\.cursor\projects\g-KNOU-Somoim-Jungwon-Drive-Obsidian-Vault-AI-1-MUD-Game-NEON-REQUIEM\assets\c__Users_Luna_AppData_Roaming_Cursor_User_workspaceStorage_523e43503166e1873931fe44072b5562_images_______-3fdce429-e6fb-4b9f-8101-04181583737c.png"
OUT_PATH = (
    r"g:\내 드라이브\KNOU\Somoim\Jungwon_Drive_Obsidian_Vault\AI 1인 MUD Game NEON REQUIEM"
    r"\frontend\src\assets\scene\images\npcs\hana.png"
)


def neon_bg(size: int) -> Image.Image:
    w = h = size
    base = Image.new("RGB", (w, h), (8, 10, 16))
    d = ImageDraw.Draw(base)
    # gradient
    top = (16, 18, 28)
    bottom = (3, 4, 7)
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        d.line([(0, y), (w, y)], fill=(r, g, b))

    haze = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(haze, "RGBA")
    palette = [(34, 211, 238, 18), (236, 72, 153, 14), (250, 204, 21, 10)]
    for _ in range(22):
        cx = random.randint(0, w)
        cy = random.randint(0, h)
        r = random.randint(int(w * 0.10), int(w * 0.22))
        col = random.choice(palette)
        hd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col)
    haze = haze.filter(ImageFilter.GaussianBlur(30))
    out = Image.alpha_composite(base.convert("RGBA"), haze)

    # faux neon signs blocks
    sd = ImageDraw.Draw(out, "RGBA")
    for _ in range(14):
        x = random.randint(0, w - 160)
        y = random.randint(40, h - 220)
        ww = random.randint(90, 220)
        hh = random.randint(30, 90)
        c = random.choice([(34, 211, 238, 28), (236, 72, 153, 22), (250, 204, 21, 18)])
        sd.rounded_rectangle((x, y, x + ww, y + hh), radius=10, fill=c)
    out = out.filter(ImageFilter.GaussianBlur(1))
    return out.convert("RGBA")


def neon_overlay(size: int) -> Image.Image:
    """배경 컷아웃 없이 '네온 사인' 느낌만 얹는 오버레이."""
    w = h = size
    ov = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov, "RGBA")
    palette = [(34, 211, 238, 58), (236, 72, 153, 48), (250, 204, 21, 38)]
    for _ in range(20):
        x = random.randint(0, w - 220)
        y = random.randint(30, h - 260)
        ww = random.randint(120, 320)
        hh = random.randint(36, 110)
        c = random.choice(palette)
        d.rounded_rectangle((x, y, x + ww, y + hh), radius=14, fill=c)
    # 보케 느낌
    for _ in range(18):
        cx = random.randint(0, w)
        cy = random.randint(0, h)
        r = random.randint(90, 220)
        c = random.choice([(34, 211, 238, 26), (236, 72, 153, 20), (250, 204, 21, 16)])
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=c)
    return ov.filter(ImageFilter.GaussianBlur(14))


def cyberpunk_grade(im: Image.Image) -> Image.Image:
    x = im.convert("RGBA")
    # teal-magenta split tone
    r, g, b, a = x.split()
    r = ImageEnhance.Brightness(r).enhance(1.03)
    b = ImageEnhance.Brightness(b).enhance(1.06)
    x = Image.merge("RGBA", (r, g, b, a))
    x = ImageEnhance.Brightness(x).enhance(0.90)
    x = ImageEnhance.Color(x).enhance(1.45)
    x = ImageEnhance.Contrast(x).enhance(1.22)
    x = ImageEnhance.Sharpness(x).enhance(1.15)
    return x


def add_rain(im: Image.Image, amount: int = 1200) -> Image.Image:
    w, h = im.size
    rain = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(rain, "RGBA")
    for _ in range(amount):
        x = random.randint(-50, w + 50)
        y = random.randint(-50, h + 50)
        ln = random.randint(12, 32)
        # diagonal streak
        x2 = x + int(ln * 0.7)
        y2 = y + ln
        a = random.randint(18, 55)
        d.line((x, y, x2, y2), fill=(180, 220, 255, a), width=1)
    rain = rain.filter(ImageFilter.GaussianBlur(0.7))
    return Image.alpha_composite(im.convert("RGBA"), rain)


def main() -> None:
    if not os.path.exists(REF_PATH):
        raise FileNotFoundError(REF_PATH)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    ref = Image.open(REF_PATH).convert("RGB")
    W, H = ref.size

    # 오른쪽 인물 중심으로 크롭 (상반신/얼굴 중심)
    # 이미지가 1024x1024 기준으로 들어온 경우를 가정하되, 비율 기반으로 계산
    crop = (
        int(W * 0.52),
        int(H * 0.00),
        int(W * 0.98),
        int(H * 0.86),
    )
    sub = ref.crop(crop)

    # 900x900로 리사이즈 + 약간 얼굴 중심 위로 이동
    sub = ImageOps.fit(sub, (900, 900), method=Image.Resampling.LANCZOS, centering=(0.55, 0.10))

    # 컷아웃 대신, 원본 위에 네온 오버레이/그레이딩으로 "일러 분위기"만 만든다 (얼굴 아티팩트 방지)
    comp = sub.convert("RGBA")
    comp = cyberpunk_grade(comp)
    comp = Image.alpha_composite(comp, neon_overlay(900))
    comp = add_rain(comp, amount=900)

    # 비네트
    vign = Image.new("L", (900, 900), 0)
    vd = ImageDraw.Draw(vign)
    vd.ellipse((-140, -60, 1040, 1060), fill=255)
    vign = vign.filter(ImageFilter.GaussianBlur(70))
    vp = vign.load()
    px = comp.load()
    for y in range(900):
        for x in range(900):
            t = vp[x, y] / 255.0
            k = 0.70 + 0.30 * t
            r, g, b, a = px[x, y]
            px[x, y] = (int(r * k), int(g * k), int(b * k), a)

    # 미세 그레인
    noise = Image.effect_noise((900, 900), 10).convert("L")
    noise = noise.point(lambda p: int((p - 128) * 0.22 + 128))
    nrgba = Image.merge("RGB", (noise, noise, noise)).convert("RGBA")
    nrgba.putalpha(14)
    comp = Image.alpha_composite(comp, nrgba)

    comp.convert("RGB").save(OUT_PATH, format="PNG", optimize=True)
    print("saved", OUT_PATH)


if __name__ == "__main__":
    main()

