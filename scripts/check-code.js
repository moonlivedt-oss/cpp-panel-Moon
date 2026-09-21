#!/usr/bin/env node
'use strict';

// Проверка, что примеры кода в документации собираются.
// Достаёт блоки ```cpp и компилирует те, что являются целой программой
// (содержат int main) — фрагменты без main пропускаем, они не самодостаточны.
// Компиляция синтаксическая (-fsyntax-only): без .exe, быстро, ловит ошибки типов
// и забытые #include. Предупреждения (-Wall) не роняют сборку — их печатаем на месте.
//
// Нужен g++ (у тебя msys64 ucrt64). Путь берём из $CXX, иначе g++ из PATH.
// В CI (где компилятора нет) не запускается — это отдельная команда, не часть npm run check.
//
// Запуск:  node scripts/check-code.js  [корень, по умолчанию docs]
// Выход 1, если хоть один блок не собрался.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'docs'));
const CXX = process.env.CXX || 'g++';
const STD = process.env.CXXSTD || 'c++20';

// g++ на месте?
const probe = spawnSync(CXX, ['--version'], { encoding: 'utf8' });
if (probe.error) {
  console.error('Не найден компилятор "' + CXX + '". Задай $CXX или добавь g++ в PATH.');
  console.error('Пропускаю проверку кода (это не ошибка сборки).');
  process.exit(0);
}

function mdFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isSymbolicLink()) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      out.push(...mdFiles(p));
    } else if (ent.name.toLowerCase().endsWith('.md')) {
      out.push(p);
    }
  }
  return out;
}

/** Блоки ```cpp / ```c++ с номером строки открывающей ограды. Цитатный `> ` снимаем. */
function cppBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].replace(/^\s*(?:>\s?)+/, '');
    const open = s.match(/^```+\s*([\w+]*)\s*$/);
    if (cur) {
      if (/^```+\s*$/.test(s)) { blocks.push(cur); cur = null; }
      else cur.code.push(s);
    } else if (open) {
      const lang = (open[1] || '').toLowerCase();
      if (lang === 'cpp' || lang === 'c++' || lang === 'cc') {
        // метка отказа в HTML-комментарии над блоком (в тексте не видна)
        let j = i - 1;
        while (j >= 0 && lines[j].trim() === '') j--;
        const prev = j >= 0 ? lines[j] : '';
        cur = { line: i + 1, code: [], noCompile: /docs:no-compile/.test(prev) };
      }
    }
  }
  return blocks;
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cppdocs-'));
const failures = [];
let compiled = 0;
let skipped = 0;

for (const file of mdFiles(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  cppBlocks(content).forEach((b, n) => {
    const code = b.code.join('\n');
    // Компилируем только самодостаточную программу: есть и #include, и main.
    // Фрагменты (без #include) опираются на контекст файла — их не трогаем.
    // Метка `// docs:no-compile` — явный отказ (намеренно сломанный пример-демонстрация).
    if (b.noCompile || /docs:no-compile/.test(code)) { skipped++; return; }
    if (!/^\s*#\s*include/m.test(code) || !/\bint\s+main\s*\(/.test(code)) { skipped++; return; }
    const src = path.join(tmpDir, 'b' + n + '_' + b.line + '.cpp');
    fs.writeFileSync(src, code, 'utf8');
    const r = spawnSync(CXX, ['-std=' + STD, '-fsyntax-only', '-Wall', src], { encoding: 'utf8' });
    compiled++;
    if (r.status !== 0) {
      const msg = (r.stderr || r.stdout || '').split('\n')
        .filter((l) => l.trim())
        .slice(0, 8)
        .map((l) => l.replace(src, rel + ':' + b.line))
        .join('\n');
      failures.push({ rel, line: b.line, msg });
    }
  });
}

try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* не критично */ }

if (failures.length === 0) {
  console.log('Код: все целые программы собрались (' + compiled + ' шт., фрагментов пропущено ' + skipped + ').');
  process.exit(0);
}

console.error('Не собираются (' + failures.length + ' из ' + compiled + '):\n');
for (const f of failures) {
  console.error('  ' + f.rel + ':' + f.line);
  console.error(f.msg.replace(/^/gm, '      ') + '\n');
}
process.exit(1);
