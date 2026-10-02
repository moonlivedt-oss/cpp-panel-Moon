// Генерирует docs/zametki/00-bystrye-slova.md из каталога быстрых слов расширения
// (extension/lib/snippets-data.js) — того же, из которого их вставляет редактор.
// Запуск: npm run docs:slova
const fs = require('fs');
const path = require('path');
const { SNIPPETS, FUNCS, plainBody } = require('../extension/lib/snippets-data');

const outFile = path.join(__dirname, '..', 'docs', 'zametki', '00-bystrye-slova.md');

const groups = [];
for (const sn of SNIPPETS) {
  let g = groups.find((x) => x.name === sn.section);
  if (!g) { g = { name: sn.section, items: [] }; groups.push(g); }
  g.items.push(sn);
}

const hasChoice = (sn) => /\$\{\d+\|/.test(sn.body.join('\n'));
const tidy = (code) => code.replace(/\t/g, '    ').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
// Для функций ввода показываем само определение (его слово и добавляет), для остальных — тело.
const codeOf = (sn) => tidy(sn.kind === 'func' ? FUNCS[sn.func].code.join('\n') : plainBody(sn.body.join('\n')));
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
// Описание для блока snippets: <x> -> `<x>` (экранировать | не нужно — это не таблица).
const descS = (d) => d.replace(/<([a-z_.]+)>/g, '`<$1>`');
const addsOf = (sn) => {
  const parts = [];
  if (sn.includes && sn.includes.length) parts.push(sn.includes.map((h) => '<' + h + '>').join(', '));
  if (sn.needs && sn.needs.length) parts.push(sn.needs.join(', '));
  return parts.length ? ' (сам добавит: ' + parts.join('; ') + ')' : '';
};

const out = [];
out.push('# Быстрые слова', '');
out.push('> Все сниппеты C++: напечатай слово из колонки «Печатай» и нажми **Tab**. Значок ⌄ — при вставке появится меню выбора. **Нажми на строку — раскроется её код.**', '');
out.push('Слова встроены в расширение «Документация C++» (настройка `cppDocs.smartSnippets`). После вставки `Tab` прыгает по местам для заполнения, а `⌄` открывает список вариантов (стрелки + Enter).', '');
out.push('> **Про `#include` и функции ввода.** Слово само дописывает недостающие `#include` к остальным — уже подключённые не повторяются. `readint`, `readdouble`, `readline`, `readyesno` внутри функции вставляют вызов, а саму функцию кладут над ней, если её ещё нет. Вне функций то же слово вставляет определение.', '');
out.push('> _Страница собрана автоматически: `npm run docs:slova`. Слова правятся в `extension/lib/snippets-data.js`, потом перегенерируй._', '');
out.push('---', '');
let total = 0;
for (const g of groups) {
  out.push('## ' + g.name, '', '```snippets');
  for (const sn of g.items) {
    total++;
    out.push([sn.prefix, hasChoice(sn) ? '1' : '0', descS(sn.desc + addsOf(sn)), b64(codeOf(sn))].join('\t'));
  }
  out.push('```', '');
}
out.push('---', '');
out.push('_Всего слов: **' + total + '**._ Знаешь слово — печатаешь пару букв, VS Code подскажет остальное. Полные примеры каждого приёма — в [Шпаргалке](../01-shpargalka.md) и [Справочнике](../00-НАЧНИ-ОТСЮДА.md).', '');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, out.join('\n'));
console.log('Готово: ' + path.relative(path.join(__dirname, '..'), outFile) + ' (' + total + ' слов) из extension/lib/snippets-data.js');
