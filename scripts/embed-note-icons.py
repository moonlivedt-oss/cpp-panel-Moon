#!/usr/bin/env python3
# ============================================================
#  Встраивание иконок-наклеек для врезок (callout'ов) задачника.
#
#  Берёт PNG из scripts/note-icons/, ужимает до 64x64 (с прозрачностью),
#  кодирует в base64 и вписывает в extension/cpp-docs-runtime.js одной
#  строкой  var CD_ICONS = {...};  между маркерами CD_ICONS:start/end.
#
#  Рантайм показывает нужную иконку слева во врезке по её роли
#  (см. calloutColorByLabel: book/play/bulb/attention/star/magnifier).
#
#  Запуск:  python scripts/embed-note-icons.py
#  Нужен Pillow (pip install pillow).  Идемпотентно: повторный запуск
#  просто заменяет уже вставленную строку.
# ============================================================
import base64
import io
import os
import re

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "note-icons")
RT = os.path.join(HERE, "..", "extension", "cpp-docs-runtime.js")
NAMES = ["book", "play", "bulb", "attention", "star", "magnifier"]
SIZE = 64

parts = []
for name in NAMES:
    im = Image.open(os.path.join(SRC, name + ".png")).convert("RGBA")
    im = im.resize((SIZE, SIZE), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    parts.append('"%s":"%s"' % (name, uri))
    print("  %-10s -> %5d B" % (name, len(uri)))

line = (
    "  /* CD_ICONS:start */ var CD_ICONS = {"
    + ",".join(parts)
    + "}; /* CD_ICONS:end */\n"
)
src = open(RT, encoding="utf-8").read()
if "CD_ICONS:start" in src:
    src = re.sub(
        r"  /\* CD_ICONS:start \*/.*?/\* CD_ICONS:end \*/\n", line, src, flags=re.S
    )
    where = "replaced existing block"
else:
    anchor = src.index("  function calloutColorByLabel")
    src = src[:anchor] + line + src[anchor:]
    where = "inserted before calloutColorByLabel"
open(RT, "w", encoding="utf-8", newline="").write(src)
print("CD_ICONS %s (%d bytes)" % (where, len(line)))
