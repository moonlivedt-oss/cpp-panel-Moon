#!/usr/bin/env python3
# ============================================================
#  Картинки фона главной: пейзаж под каждую палитру окна.
#
#  python scripts/prepare-backgrounds.py картинка.png tokyo   — одна картинка → extension/bg-tokyo.webp
#  python scripts/prepare-backgrounds.py D:/Desktop/components  — все файлы bg-<ключ>.(png|jpg|webp) из папки
#
#  Ключи: default (для «Как в редакторе» и палитр без своей картинки), mocha, tokyo, dracula,
#  nord, gruvbox, rosepine, onedark, forest, sunset.
#  Картинка ужимается до 1920 px по ширине и сохраняется в WebP (~100–250 КБ). В рантайм она
#  НЕ встраивается: окно читает extension/bg-<ключ>.webp с диска, когда показывает главную.
#  Нужен Pillow: pip install pillow
# ============================================================
import os
import re
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
KEYS = {
    "default",
    "mocha",
    "tokyo",
    "dracula",
    "nord",
    "gruvbox",
    "rosepine",
    "onedark",
    "forest",
    "sunset",
}
MAX_W = 1920


def convert(src, key):
    if key not in KEYS:
        raise SystemExit(
            "Неизвестный ключ «%s». Можно: %s" % (key, ", ".join(sorted(KEYS)))
        )
    im = Image.open(src).convert("RGB")
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    out = os.path.join(ROOT, "extension", "bg-" + key + ".webp")
    im.save(out, "WEBP", quality=80, method=6)
    print(
        "✓ %-28s → extension/bg-%s.webp  %dx%d, %d КБ"
        % (
            os.path.basename(src),
            key,
            im.width,
            im.height,
            os.path.getsize(out) // 1024,
        )
    )


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    if len(sys.argv) == 3:
        convert(sys.argv[1], sys.argv[2])
    elif len(sys.argv) == 2 and os.path.isdir(sys.argv[1]):
        n = 0
        for fn in sorted(os.listdir(sys.argv[1])):
            m = re.match(r"^bg-([a-z]+)\.(png|jpe?g|webp)$", fn, re.I)
            if m and m.group(1).lower() in KEYS:
                convert(os.path.join(sys.argv[1], fn), m.group(1).lower())
                n += 1
        print(
            "Готово: %d картинок." % n
            if n
            else "В папке нет файлов bg-<ключ>.png/jpg/webp"
        )
    else:
        print(
            "python scripts/prepare-backgrounds.py <картинка> <ключ>   или   <папка с bg-*.png>"
        )
        sys.exit(2)


if __name__ == "__main__":
    main()
