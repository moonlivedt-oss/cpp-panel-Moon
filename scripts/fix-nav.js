#!/usr/bin/env node
'use strict';

// Навигация «← назад / вперёд →» в темах справочника — по порядку курса (extension/lib/course.js).
// Строка навигации стоит в шапке темы и внизу страницы; скрипт переписывает обе (нет нижней —
// добавляет). Порядок меняется в одном месте — course.js, а доки выравниваются этим скриптом.
//
//   node scripts/fix-nav.js          — переписать
//   node scripts/fix-nav.js --check  — только проверить (входит в check-links.js)

const fs = require('fs');
const path = require('path');
const course = require('../extension/lib/course');

const DIR = path.join(__dirname, '..', 'docs', 'ref');
const START = '[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md) · [Маршрут изучения](../00-marshrut.md)';
const LABEL = {
  '01-osnovy': 'Основы', '02-vvod-vyvod': 'Ввод и вывод', '03-logika-cikly': 'Логика и циклы', '04-funkcii': 'Функции',
  '05-stroki': 'Строки', '06-konteynery': 'Контейнеры', '07-algoritmy': 'Алгоритмы', '08-struct-fayly': 'struct, математика, файлы',
  '22-ukazateli': 'Ссылки и указатели', '13-klassy': 'Классы', '14-isklyucheniya': 'Исключения', '15-string-view': 'string_view',
  '16-ranges': 'Ranges', '17-shablony': 'Шаблоны', '23-peremeshchenie': 'Перемещение', '18-umnye-ukazateli': 'Умные указатели',
  '19-razdelenie': 'Разделение на файлы', '24-cmake': 'CMake', '25-constexpr': 'constexpr', '26-variant': 'optional и variant',
  '27-potoki': 'Потоки', '20-nasledovanie': 'Наследование', '28-otladchik': 'Отладчик', '21-igra-v-konsoli': 'Игра в консоли',
  '09-spravka': 'Справка', '10-slovar': 'Словарь терминов', '10a-slovar-funkcij': 'Словарь функций',
  '11-oshibki': 'Ошибки компилятора', '12-lovim-bagi': 'Как ловить баги',
};

function navLine(base) {
  const nb = course.neighbours(base);
  let s = START;
  if (nb && nb.prev) s += ' · [← ' + LABEL[nb.prev] + '](' + nb.prev + '.md)';
  if (nb && nb.next) s += ' · [' + LABEL[nb.next] + ' →](' + nb.next + '.md)';
  return s;
}

/** Файл → { text, problems } с выправленной навигацией. */
function fixFile(base, text) {
  const want = navLine(base);
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const idx = [];
  lines.forEach((l, i) => { if (l.startsWith('[← Начни отсюда](../00-НАЧНИ-ОТСЮДА.md)')) idx.push(i); });
  const problems = [];
  if (!idx.length) problems.push('нет строки навигации в шапке');
  idx.forEach((i) => { if (lines[i] !== want) { problems.push('строка ' + (i + 1) + ': навигация не по порядку курса'); lines[i] = want; } });
  if (idx.length === 1) {
    problems.push('нет навигации внизу страницы');
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    lines.push('', '---', '', want, '');
  }
  return { text: lines.join('\n'), problems };
}

function run(check) {
  const all = course.COURSE.concat(course.REFERENCE);
  const out = [];
  for (const base of all) {
    const file = path.join(DIR, base + '.md');
    if (!fs.existsSync(file)) { out.push(base + '.md: файла нет (lib/course.js)'); continue; }
    const r = fixFile(base, fs.readFileSync(file, 'utf8'));
    if (!r.problems.length) continue;
    if (check) r.problems.forEach((p) => out.push('ref/' + base + '.md: ' + p));
    else { fs.writeFileSync(file, r.text); out.push('ref/' + base + '.md: исправлено (' + r.problems.length + ')'); }
  }
  // Темы в ref/, которых нет в course.js, — их место в курсе не задано
  fs.readdirSync(DIR).filter((n) => n.endsWith('.md')).forEach((n) => {
    if (course.courseIndex(n) === -1 && !course.isReference(n)) out.push('ref/' + n + ': нет в extension/lib/course.js');
  });
  return out;
}

module.exports = { run, navLine };

if (require.main === module) {
  const check = process.argv.includes('--check');
  const out = run(check);
  out.forEach((l) => console.log('  ' + l));
  if (check && out.length) { console.error('Навигация тем: расхождений ' + out.length + ' — node scripts/fix-nav.js'); process.exit(1); }
  if (!out.length) console.log('Навигация тем: по порядку курса.');
}
