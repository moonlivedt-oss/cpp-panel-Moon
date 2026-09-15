# -*- coding: utf-8 -*-
"""
Проверка документации: собирается ли весь код, работают ли все ссылки.

Запуск из папки docs:      python proverka.py
Или из любого места:       python D:/Desktop/C++/docs/proverka.py

Что делает:
  1. достаёт из всех .md блоки ```cpp и компилирует те, где есть main();
  2. сверяет код примеров в .md с настоящими файлами examples/code/*.cpp;
  3. проверяет все внутренние ссылки и якоря заголовков;
  4. печатает отчёт: что в порядке, что сломалось и где.

Ничего не меняет — только проверяет.
"""

import io
import os
import re
import subprocess
import sys
import tempfile

DOCS = os.path.dirname(os.path.abspath(__file__))

FLAGS = [
    "-std=c++20",
    "-Wall",
    "-Wextra",
    "-Wpedantic",
    "-Wshadow",
    "-Wconversion",
    "-Wsign-conversion",
    "-D_GLIBCXX_ASSERTIONS",
    "-fsyntax-only",
]

try:  # чтобы русский текст не ломался в консоли Windows
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def anchor_of(heading):
    """Якорь заголовка по правилам GitHub и VS Code."""
    t = re.sub(r"^#+\s*", "", heading.strip())
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)  # [текст](ссылка) -> текст
    t = t.lower()
    t = re.sub(r"[^\w\s-]", "", t, flags=re.UNICODE)
    return t.replace(" ", "-")


def md_files():
    out = []
    for root, _dirs, files in os.walk(DOCS):
        for name in sorted(files):
            if name.endswith(".md"):
                out.append(os.path.join(root, name))
    return sorted(out)


def read(path):
    return io.open(path, encoding="utf-8").read()


def code_blocks(text):
    """Все блоки ```cpp ... ``` из markdown."""
    return re.findall(r"```cpp\n(.*?)\n```", text, flags=re.DOTALL)


def is_full_program(block):
    """Годится ли блок для сборки.

    Пропускаем три вида блоков, которые собираться и не должны:
      * помеченные крестиком — это намеренно неправильный код, показанный как ловушка;
      * с многоточием ... — псевдокод, а не программа;
      * без единого #include — иллюстративный фрагмент, вырванный из контекста.
    """
    if "int main(" not in block:
        return False
    if "❌" in block:
        return False
    if "..." in block:
        return False
    if "#include" not in block:
        return False
    return True


def strip_code(text):
    """Убрать блоки кода и inline-код — чтобы не принять лямбду за ссылку."""
    out, infence = [], False
    for line in text.split("\n"):
        if line.strip().startswith("```"):
            infence = not infence
            out.append("")
            continue
        out.append("" if infence else line)
    return re.sub(r"`[^`]*`", "", "\n".join(out))


def check_code():
    """Компилируем каждый блок с main()."""
    problems, compiled, skipped = [], 0, 0
    tmpdir = tempfile.mkdtemp(prefix="docs_check_")
    for path in md_files():
        rel = os.path.relpath(path, DOCS)
        for i, block in enumerate(code_blocks(read(path)), start=1):
            if not is_full_program(block):
                skipped += 1  # фрагмент или намеренно неправильный код
                continue
            src = os.path.join(tmpdir, "block.cpp")
            io.open(src, "w", encoding="utf-8", newline="").write(block + "\n")
            r = subprocess.run(
                ["g++"] + FLAGS + [src],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            compiled += 1
            if r.returncode != 0 or (r.stderr or "").strip():
                first = ((r.stderr or "").strip().split("\n") or [""])[0]
                problems.append("%s, блок кода №%d: %s" % (rel, i, first))
    return compiled, skipped, problems


def check_cpp_files():
    """Собираем все готовые программы: examples/code/*.cpp и situacii/*.cpp."""
    problems, built = [], 0
    for folder in (os.path.join("examples", "code"), "situacii"):
        full = os.path.join(DOCS, folder)
        if not os.path.isdir(full):
            continue
        for name in sorted(os.listdir(full)):
            if not name.endswith(".cpp"):
                continue
            src = os.path.join(full, name)
            r = subprocess.run(
                ["g++"] + FLAGS + [src],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            built += 1
            if r.returncode != 0 or (r.stderr or "").strip():
                first = ((r.stderr or "").strip().split("\n") or [""])[0]
                problems.append("%s/%s: %s" % (folder, name, first))
    return built, problems


def check_examples_sync():
    """Код в examples/*.md должен совпадать с examples/code/*.cpp."""
    pairs = [
        ("01-kalkulyator.md", "calc.cpp"),
        ("02-spisok-del.md", "todo.cpp"),
        ("03-analiz-teksta.md", "text.cpp"),
        ("04-ugaday-chislo.md", "guess.cpp"),
        ("05-raskhody-csv.md", "csv.cpp"),
        ("06-telefonnaya-kniga.md", "phones.cpp"),
        ("07-krestiki-noliki.md", "tictactoe.cpp"),
        ("08-zhurnal-ocenok.md", "grades.cpp"),
        ("09-parol.md", "pass.cpp"),
    ]
    problems, checked = [], 0
    for md, cpp in pairs:
        mp = os.path.join(DOCS, "examples", md)
        cp = os.path.join(DOCS, "examples", "code", cpp)
        if not (os.path.exists(mp) and os.path.exists(cp)):
            problems.append("нет пары: %s / %s" % (md, cpp))
            continue
        blocks = code_blocks(read(mp))
        if not blocks:
            problems.append("%s: не нашёл блок с кодом" % md)
            continue
        checked += 1
        if blocks[0].strip() != read(cp).strip():
            problems.append("%s разошёлся с code/%s — обнови текст примера" % (md, cpp))
    return checked, problems


def check_links():
    """Все относительные ссылки и якоря."""
    anchors = {}
    for path in md_files():
        heads = [l for l in read(path).split("\n") if re.match(r"^#{1,6} ", l)]
        anchors[os.path.normpath(path)] = set(anchor_of(h) for h in heads)

    link_re = re.compile(r"\[([^\]]*)\]\(([^)\s]+)\)")
    problems, total = [], 0
    for path in md_files():
        rel = os.path.relpath(path, DOCS)
        base = os.path.dirname(path)
        for _text, target in link_re.findall(strip_code(read(path))):
            if target.startswith("http"):
                continue
            total += 1
            file_part, _, frag = target.partition("#")
            tgt = (
                os.path.normpath(path)
                if file_part == ""
                else os.path.normpath(os.path.join(base, file_part))
            )
            if not os.path.exists(tgt):
                problems.append("%s -> %s (нет такого файла)" % (rel, target))
            elif frag and tgt.endswith(".md") and frag not in anchors.get(tgt, set()):
                problems.append("%s -> %s (нет такого заголовка)" % (rel, target))
    return total, problems


def main():
    print("Проверяю документацию в", DOCS)
    print("=" * 60)

    ok = True

    compiled, skipped, code_problems = check_code()
    print("\n[1/4] Код из документации")
    print("  собрано программ: %d, пропущено фрагментов: %d" % (compiled, skipped))
    if code_problems:
        ok = False
        print("  ПРОБЛЕМЫ (%d):" % len(code_problems))
        for p in code_problems:
            print("   -", p)
    else:
        print("  всё собирается без предупреждений")

    built, cpp_problems = check_cpp_files()
    print("\n[2/4] Готовые программы (.cpp)")
    print("  собрано файлов: %d" % built)
    if cpp_problems:
        ok = False
        print("  ПРОБЛЕМЫ (%d):" % len(cpp_problems))
        for p in cpp_problems:
            print("   -", p)
    else:
        print("  все примеры и демо собираются без предупреждений")

    checked, sync_problems = check_examples_sync()
    print("\n[3/4] Примеры: текст против файлов .cpp")
    print("  сверено пар: %d" % checked)
    if sync_problems:
        ok = False
        print("  ПРОБЛЕМЫ (%d):" % len(sync_problems))
        for p in sync_problems:
            print("   -", p)
    else:
        print("  код в описаниях совпадает с настоящими файлами")

    total, link_problems = check_links()
    print("\n[4/4] Ссылки и якоря")
    print("  проверено ссылок: %d" % total)
    if link_problems:
        ok = False
        print("  ПРОБЛЕМЫ (%d):" % len(link_problems))
        for p in link_problems:
            print("   -", p)
    else:
        print("  все ссылки рабочие")

    print("\n" + "=" * 60)
    print("ИТОГ:", "всё в порядке" if ok else "есть что починить (см. выше)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
