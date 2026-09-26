#!/usr/bin/env python3
# ============================================================
#  Сжатие встроенных картинок: PNG (data:image/png;base64) → WebP.
#  Запуск:  npm run optimize:images      (нужен Pillow: pip install pillow)
#
#  Зачем: рантайм окна впечатывается в оболочку VS Code строкой и разбирается при
#  КАЖДОМ запуске редактора, а данные с .md грузятся при старте — лишние сотни КБ base64
#  замедляют старт. WebP с прозрачностью в 2–4 раза легче PNG, Chromium VS Code его понимает.
#
#  Что делает: в extension/cpp-docs-runtime.js и docs/**/*.md каждую PNG-картинку
#  перекодирует в WebP (пробует lossless и lossy q=88, берёт меньшее) и заменяет, только
#  если выигрыш ≥ 10 %. Плюс кладёт .webp рядом с наклейками extension/stickers/*.png —
#  embed-stickers.js берёт .webp первым. Идемпотентен: повторный запуск ничего не меняет.
#  После правки рантайма: npm run hash:runtime.
# ============================================================
import base64
import io
import os
import re
import sys

from PIL import Image

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
RE = re.compile(r"data:image/png;base64,([A-Za-z0-9+/=]+)")


def to_webp(png_bytes):
    im = Image.open(io.BytesIO(png_bytes))
    im.load()
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert(
            "RGBA"
            if "transparency" in im.info or im.mode in ("LA", "PA", "P")
            else "RGB"
        )
    best = None
    for kw in (
        {"lossless": True, "method": 6},
        {"quality": 88, "method": 6, "alpha_quality": 90},
    ):
        buf = io.BytesIO()
        im.save(buf, "WEBP", **kw)
        b = buf.getvalue()
        if best is None or len(b) < len(best):
            best = b
    return best


def process_text(path):
    with open(path, encoding="utf-8", newline="") as fh:
        src = fh.read()
    saved = [0, 0]

    def rep(m):
        png = base64.b64decode(m.group(1))
        try:
            webp = to_webp(png)
        except Exception as e:  # битая картинка — не трогаем
            print("  ! пропуск (" + str(e) + ") в " + path)
            return m.group(0)
        if len(webp) > len(png) * 0.9:
            return m.group(0)
        saved[0] += len(m.group(0))
        out = "data:image/webp;base64," + base64.b64encode(webp).decode("ascii")
        saved[1] += len(out)
        return out

    dst = RE.sub(rep, src)
    if dst != src:
        with open(path, "w", encoding="utf-8", newline="") as fh:
            fh.write(dst)
        print(
            "  %-48s %5d КБ → %4d КБ"
            % (os.path.relpath(path, ROOT), saved[0] // 1024, saved[1] // 1024)
        )
    return saved


def main():
    total = [0, 0]
    # рантайм — по частям (extension/runtime/*.js); собранный файл потом: npm run build:runtime
    rdir = os.path.join(ROOT, "extension", "runtime")
    targets = [os.path.join(rdir, f) for f in sorted(os.listdir(rdir)) if f.endswith(".js")]
    for d, _, files in os.walk(os.path.join(ROOT, "docs")):
        targets += [os.path.join(d, f) for f in files if f.endswith(".md")]
    for t in targets:
        a, b = process_text(t)
        total[0] += a
        total[1] += b
    # WebP-копии наклеек (источник для embed-stickers.js)
    sdir = os.path.join(ROOT, "extension", "stickers")
    for f in sorted(os.listdir(sdir)):
        if not f.endswith(".png"):
            continue
        p = os.path.join(sdir, f)
        if os.path.getsize(p) > 200 * 1024:
            continue  # крупные исходники схем в рантайм не идут
        w = p[:-4] + ".webp"
        if os.path.exists(w) and os.path.getmtime(w) >= os.path.getmtime(p):
            continue
        with open(p, "rb") as fh:
            data = to_webp(fh.read())
        with open(w, "wb") as fh:
            fh.write(data)
    if total[0]:
        print("Итого: %d КБ → %d КБ base64" % (total[0] // 1024, total[1] // 1024))
    else:
        print("Нечего сжимать — всё уже в WebP.")


if __name__ == "__main__":
    sys.exit(main())
