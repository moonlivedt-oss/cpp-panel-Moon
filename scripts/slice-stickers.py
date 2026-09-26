#!/usr/bin/env python3
# ============================================================
#  Нарезка листа наклеек 4×3 на 12 значков ui-* (для палитр окна).
#
#  python scripts/slice-stickers.py лист.png <палитра>    — лист 4×3 → ui-*@<палитра>.webp
#  python scripts/slice-stickers.py одиночная.png ui-read  — одна картинка → ui-read.webp
#
#  Порядок на листе (по строкам): read solve streak steps / cards warm deck shuffle /
#  hint dice guide news. Разрезы ищутся по пустым промежуткам между наклейками (не строго
#  по сетке), в каждой клетке рисунок обрезается по краям и ставится по центру квадрата
#  128×128 с полями. Результат — в extension/stickers/, дальше: npm run embed:stickers
#  (варианты палитр уходят в extension/stickers-palettes.json, не в рантайм).
#  Нужен Pillow: pip install pillow
# ============================================================
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DST = os.path.join(ROOT, "extension", "stickers")
ORDER = ["ui-read", "ui-solve", "ui-streak", "ui-steps", "ui-cards", "ui-warm",
         "ui-deck", "ui-shuffle", "ui-hint", "ui-dice", "ui-guide", "ui-news"]
OUT_PX = 128
PAD = 0.06


def tight(im):
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(bb) if bb else im


def square(im):
    im = tight(im)
    w, h = im.size
    side = int(max(w, h) * (1 + 2 * PAD))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return canvas.resize((OUT_PX, OUT_PX), Image.LANCZOS)


def gutters(im, n, axis, thr=150):
    """Позиции n-1 разрезов между n полосами: ищем самую «пустую» линию рядом с ожидаемой."""
    a = im.getchannel("A").point(lambda v: 255 if v > thr else 0)
    w, h = im.size
    L = w if axis == "x" else h
    prof = [0] * L
    data = a.resize((w // 2, h // 2), Image.NEAREST)
    px = data.load()
    for y in range(h // 2):
        for x in range(w // 2):
            if px[x, y]:
                prof[(x if axis == "x" else y) * 2] += 1
    cuts = []
    for k in range(1, n):
        c = L * k // n
        lo, hi = c - L // (2 * n), c + L // (2 * n)
        lo -= lo % 2
        best = min(prof[lo:hi:2])
        run = [i for i in range(lo, hi, 2) if prof[i] == best]
        # середина самого длинного участка минимума
        seg, cur = [], [run[0]]
        for i in run[1:]:
            if i - cur[-1] <= 2: cur.append(i)
            else: seg.append(cur); cur = [i]
        seg.append(cur)
        longest = max(seg, key=len)
        cuts.append(longest[len(longest) // 2])
    return [0] + cuts + [L]


def cut_grid(im):
    xs, ys = gutters(im, 4, "x"), gutters(im, 3, "y")
    cells = []
    for r in range(3):
        for c in range(4):
            cells.append(im.crop((xs[c], ys[r], xs[c + 1], ys[r + 1])))
    return cells, xs, ys



def save(im, name):
    p = os.path.join(DST, name + ".webp")
    square(im).save(p, "WEBP", quality=85, method=6, alpha_quality=85)
    return p


def main():
    if len(sys.argv) != 3:
        print(__doc__ or "python scripts/slice-stickers.py <картинка.png> <палитра | ui-имя>")
        sys.exit(2)
    im = Image.open(sys.argv[1]).convert("RGBA")
    arg = sys.argv[2]
    if arg.startswith("ui-"):
        print("✓", save(im, arg))
        return
    cells, xs, ys = cut_grid(im)
    print("разрезы x:", xs, " y:", ys)
    for name, cell in zip(ORDER, cells):
        print("✓", save(cell, name + "@" + arg))


if __name__ == "__main__":
    main()
