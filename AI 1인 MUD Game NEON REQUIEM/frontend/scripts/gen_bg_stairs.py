from __future__ import annotations

from PIL import Image, ImageDraw, ImageFilter
import random


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def make_bg_stairs(width: int = 1280, height: int = 800) -> Image.Image:
    # 16:10 배경 — 계단 삼거리(산업 지하) 컨셉 PNG
    img = Image.new("RGB", (width, height), (5, 6, 10))
    px = img.load()

    # 베이스 수직 그라데이션 (차가운 슬레이트 → 거의 검정)
    top = (18, 28, 46)
    bottom = (4, 5, 8)
    for y in range(height):
        t = y / max(1, height - 1)
        r = lerp(top[0], bottom[0], t)
        g = lerp(top[1], bottom[1], t)
        b = lerp(top[2], bottom[2], t)
        for x in range(width):
            px[x, y] = (r, g, b)

    base = img.convert("RGBA")
    d = ImageDraw.Draw(base, "RGBA")

    # 안개/블룸 레이어
    mist = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    md = ImageDraw.Draw(mist, "RGBA")
    for _ in range(28):
        cx = random.randint(0, width)
        cy = random.randint(int(height * 0.10), int(height * 0.90))
        rx = random.randint(220, 520)
        ry = random.randint(80, 220)
        col = (40, 120, 170, random.randint(12, 26))
        md.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=col)
    mist = mist.filter(ImageFilter.GaussianBlur(30))
    base = Image.alpha_composite(base, mist)

    d = ImageDraw.Draw(base, "RGBA")

    # 원근 벽/바닥
    d.polygon(
        [(0, height), (0, int(height * 0.25)), (int(width * 0.43), int(height * 0.36)), (int(width * 0.47), height)],
        fill=(10, 12, 18, 255),
    )
    d.polygon(
        [(width, height), (width, int(height * 0.22)), (int(width * 0.57), int(height * 0.34)), (int(width * 0.53), height)],
        fill=(8, 10, 16, 255),
    )
    d.polygon(
        [
            (int(width * 0.44), int(height * 0.38)),
            (int(width * 0.56), int(height * 0.36)),
            (int(width * 0.60), int(height * 0.62)),
            (int(width * 0.40), int(height * 0.64)),
        ],
        fill=(0, 0, 0, 255),
    )
    d.polygon(
        [
            (int(width * 0.47), height),
            (int(width * 0.53), height),
            (int(width * 0.60), int(height * 0.62)),
            (int(width * 0.40), int(height * 0.64)),
        ],
        fill=(12, 14, 20, 255),
    )

    # 계단(층별 트라페zoid)
    steps = 10
    x0, x1 = int(width * 0.41), int(width * 0.59)
    y_top = int(height * 0.64)
    y_bot = height
    for i in range(steps):
        t0 = i / steps
        t1 = (i + 1) / steps
        yA = int(y_top + (y_bot - y_top) * t0)
        yB = int(y_top + (y_bot - y_top) * t1)
        shrink = int(180 * (1 - t0))
        xa0 = x0 + shrink
        xa1 = x1 - shrink
        shrink2 = int(180 * (1 - t1))
        xb0 = x0 + shrink2
        xb1 = x1 - shrink2
        col = (18 + i * 2, 20 + i * 2, 28 + i * 2, 255)
        d.polygon([(xa0, yA), (xa1, yA), (xb1, yB), (xb0, yB)], fill=col)
        d.line([(xa0, yA), (xa1, yA)], fill=(90, 110, 130, 70), width=2)

    # 난간
    rail = (90, 100, 120, 160)
    d.line([(int(width * 0.33), height), (int(width * 0.43), int(height * 0.36))], fill=rail, width=5)
    d.line([(int(width * 0.67), height), (int(width * 0.57), int(height * 0.34))], fill=rail, width=5)

    # 네온 가이드 스트립 + 비상등 웜 글로우
    neon = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    nd = ImageDraw.Draw(neon, "RGBA")
    cyan = (34, 211, 238, 200)
    for off in (-18, 18):
        nd.line([(int(width * 0.47) + off, height), (int(width * 0.56) + off, int(height * 0.36))], fill=cyan, width=6)
        nd.line([(int(width * 0.53) + off, height), (int(width * 0.44) + off, int(height * 0.38))], fill=cyan, width=6)
    nd.ellipse((int(width * 0.15), int(height * 0.10), int(width * 0.35), int(height * 0.35)), fill=(250, 204, 21, 30))
    nd.ellipse((int(width * 0.12), int(height * 0.07), int(width * 0.38), int(height * 0.40)), fill=(250, 204, 21, 16))
    neon = neon.filter(ImageFilter.GaussianBlur(5))
    base = Image.alpha_composite(base, neon)

    # 때/노이즈
    noise = Image.effect_noise((width, height), 18).convert("L")
    noise = noise.point(lambda p: int((p - 128) * 0.35 + 128))
    noise_rgb = Image.merge("RGB", (noise, noise, noise)).convert("RGBA")
    noise_rgb.putalpha(22)
    base = Image.alpha_composite(base, noise_rgb)

    return base.convert("RGB")


if __name__ == "__main__":
    out_path = (
        r"g:\내 드라이브\KNOU\Somoim\Jungwon_Drive_Obsidian_Vault\AI 1인 MUD Game NEON REQUIEM"
        r"\frontend\src\assets\scene\images\backgrounds\bg_stairs.png"
    )
    img = make_bg_stairs()
    img.save(out_path, format="PNG", optimize=True)
    print("saved", out_path)

