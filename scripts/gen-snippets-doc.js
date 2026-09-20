// Генерирует docs/zametki/00-bystrye-slova.md из пользовательского cpp.json со сниппетами.
// Источник по умолчанию: %APPDATA%\Code\User\snippets\cpp.json (можно передать путь аргументом).
// Запуск: node scripts/gen-snippets-doc.js [путь-к-cpp.json]
const fs = require('fs');
const path = require('path');
const os = require('os');

const src = process.argv[2] ||
  path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
            'Code', 'User', 'snippets', 'cpp.json');
const outFile = path.join(__dirname, '..', 'docs', 'zametki', '00-bystrye-slova.md');

const raw = fs.readFileSync(src, 'utf8');
const obj = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));   // допускаем //-комментарии (jsonc)

// Секции берём из строк-разделителей «// ─── Имя ───», сниппеты — по ключам верхнего уровня.
const keySet = new Set(Object.keys(obj));
const groups = [];
let cur = null;
for (const line of raw.split('\n')) {
  const sec = line.match(/^\s*\/\/\s*─+\s*(.+?)\s*─+\s*$/);
  if (sec) { cur = { name: sec[1].trim(), keys: [] }; groups.push(cur); continue; }
  const key = line.match(/^\s*"([^"]+)"\s*:\s*\{\s*$/);
  if (key && keySet.has(key[1])) {
    if (!cur) { cur = { name: 'Прочее', keys: [] }; groups.push(cur); }
    cur.keys.push(key[1]);
  }
}

const hasChoice = (k) => /\$\{\d+\|/.test((obj[k].body || []).join('\n'));
const safe = (d) => d.replace(/<([a-z_]+)>/g, '`<$1>`').replace(/\|/g, '\|');

const out = [];
out.push('# Быстрые слова', '');
out.push('> Все сниппеты C++: напечатай слово из колонки «Печатай» и нажми **Tab**. Значок ⌄ — при вставке появится меню выбора.', '');
out.push('Слова живут в `%APPDATA%\\Code\\User\\snippets\\cpp.json`. После вставки `Tab` прыгает по местам для заполнения, а `⌄` открывает список вариантов (стрелки + Enter).', '');
out.push('> **Подсказка про `#include`.** Если в колонке написано «Нужен `<vector>`», а заголовок не подключён — код подчеркнётся красным. Наведи курсор, нажми `Ctrl + .` и выбери «Add #include» — VS Code (cpptools) допишет строку сам.', '');
out.push('> _Страница собрана автоматически: `npm run docs:slova`. Правь сниппеты, потом перегенерируй._', '');
out.push('---', '');
let total = 0;
for (const g of groups) {
  if (!g.keys.length) continue;
  out.push('## ' + g.name, '', '| Печатай | Что вставит |', '| --- | --- |');
  for (const k of g.keys) {
    total++;
    out.push('| `' + obj[k].prefix + '`' + (hasChoice(k) ? ' ⌄' : '') + ' | ' + safe(obj[k].description || '') + ' |');
  }
  out.push('');
}
out.push('---', '');
out.push('_Всего слов: **' + total + '**._ Знаешь слово — печатаешь пару букв, VS Code подскажет остальное. Полные примеры каждого приёма — в [Шпаргалке](../01-shpargalka.md) и [Справочнике](../00-НАЧНИ-ОТСЮДА.md).', '');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, out.join('\n'));
console.log('Готово: ' + path.relative(path.join(__dirname, '..'), outFile) + ' (' + total + ' слов) из ' + src);
