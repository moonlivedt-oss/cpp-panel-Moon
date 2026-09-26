#!/usr/bin/env node
'use strict';

// Согласованность документации: один источник правды об окружении ученика и проверка, что
// текст ему не противоречит. Ловит расхождения вида «в одном разделе -fsanitize советуют,
// в другом — он не собирается», «в тексте g++ 14, в маршруте g++ 15.2», «в доках C++20, а
// «Напиши и запусти» собирает C++17», «в тексте настройка cppDocs.x, а в расширении её нет».
//
// Поменялось окружение — правь FACTS здесь, а проверка покажет все места в тексте.
// Запуск:  node scripts/check-consistency.js   (входит в npm run check)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');

const FACTS = {
  gcc: '15.2',             // g++ из MSYS2 UCRT64
  gdb: '17.1',
  std: 'c++20',            // стандарт курса: settings.json, «Напиши и запусти», check-code
  keys: { 'Ctrl+Alt+R': 'запуск файла', 'Ctrl+Alt+D': 'отладка файла' },   // C/C++ Runner
  sanitizer: false,        // -fsanitize в MSYS2/MinGW не собирается
};

function mdFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isSymbolicLink() || ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...mdFiles(p));
    else if (ent.name.endsWith('.md')) out.push(p);
  }
  return out.sort();
}

const problems = [];
function report(rel, line, msg, text) { problems.push(rel + ':' + line + '  ' + msg + (text ? '\n      ' + text.trim().slice(0, 160) : '')); }

// Настройки расширения, которые реально существуют (contributes.configuration).
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'package.json'), 'utf8'));
const cfg = manifest.contributes && manifest.contributes.configuration;
const settings = new Set(Object.keys((Array.isArray(cfg) ? cfg[0] : cfg || {}).properties || {}));
const commands = new Set(((manifest.contributes && manifest.contributes.commands) || []).map((c) => c.command));

for (const file of mdFiles(DOCS)) {
  const rel = path.relative(DOCS, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n');
  // абзац = строки до пустой: санитайзеру нужна оговорка в том же абзаце (или той же строке таблицы)
  const para = (i) => {
    let a = i, b = i;
    while (a > 0 && lines[a - 1].trim()) a--;
    while (b + 1 < lines.length && lines[b + 1].trim()) b++;
    return lines[i].trim().startsWith('|') ? lines[i] : lines.slice(a, b + 1).join(' ');
  };
  lines.forEach((ln, i) => {
    const n = i + 1;
    if (!FACTS.sanitizer && /-fsanitize/.test(ln) && !/не (собирается|линкуется|поддерживается)/.test(para(i))) {
      report(rel, n, '-fsanitize упомянут без оговорки, что в MSYS2/MinGW он не собирается (роль играет -D_GLIBCXX_ASSERTIONS)', ln);
    }
    for (const m of ln.matchAll(/\bg\+\+ (\d+\.\d+)\b/g)) if (m[1] !== FACTS.gcc) report(rel, n, 'версия g++ ' + m[1] + ', а в окружении ' + FACTS.gcc, ln);
    for (const m of ln.matchAll(/\bgdb (\d+\.\d+)\b/g)) if (m[1] !== FACTS.gdb) report(rel, n, 'версия gdb ' + m[1] + ', а в окружении ' + FACTS.gdb, ln);
    // стандарт в команде сборки и в утверждениях «у тебя выбран / стандарт C++NN»
    if (/\bg\+\+\b/.test(ln)) for (const m of ln.matchAll(/-std=(c\+\+\w+)/g)) if (m[1] !== FACTS.std) report(rel, n, 'команда собирает ' + m[1] + ', а курс — ' + FACTS.std, ln);
    for (const m of ln.matchAll(/(?:у тебя выбран|[Сс]тандарт)\s+C\+\+(\d\d)\b/g)) if ('c++' + m[1] !== FACTS.std) report(rel, n, 'сказано C++' + m[1] + ', а курс — ' + FACTS.std, ln);
    // клавиша запуска
    for (const m of ln.matchAll(/Ctrl\+Alt\+([A-Z])\b/g)) if (!FACTS.keys['Ctrl+Alt+' + m[1]]) report(rel, n, 'клавиша Ctrl+Alt+' + m[1] + ' — такой в окружении нет (есть: ' + Object.keys(FACTS.keys).join(', ') + ')', ln);
    // настройки и команды расширения, упомянутые в тексте, существуют
    for (const m of ln.matchAll(/\bcppDocs\.([A-Za-z]+)\b/g)) {
      const key = 'cppDocs.' + m[1];
      if (!settings.has(key) && !commands.has(key)) report(rel, n, 'в расширении нет настройки/команды ' + key, ln);
    }
  });
}

// Код расширения и проверки собирают тем же стандартом, что обещан в тексте.
const code = [
  ['extension/lib/run.js', /-std=(c\+\+\w+)/g],
  ['extension/lib/run.js', /\/std:(c\+\+\w+)/g],
  ['scripts/check-code.js', /CXXSTD \|\| '(c\+\+\w+)'/g],
  ['scripts/check-challenges.js', /CXXSTD \|\| '(c\+\+\w+)'/g],
];
for (const [rel, re] of code) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const found = [...src.matchAll(re)].map((m) => m[1]);
  if (!found.length) report(rel, 1, 'не нашёл, каким стандартом собирает — проверь шаблон в check-consistency.js');
  found.filter((s) => s !== FACTS.std).forEach((s) => report(rel, 1, 'собирает ' + s + ', а курс — ' + FACTS.std));
}

if (!problems.length) {
  console.log('Согласованность: текст не противоречит окружению (g++ ' + FACTS.gcc + ', ' + FACTS.std + ', ' + Object.keys(FACTS.keys).join('/') + ', без -fsanitize).');
  process.exit(0);
}
console.error('Согласованность: расхождений ' + problems.length + ':\n');
problems.forEach((p) => console.error('  ' + p + '\n'));
process.exit(1);
