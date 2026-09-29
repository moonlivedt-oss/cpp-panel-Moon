// ============================================================
//  Порядок тем справочника — единственный источник.
//
//  Файлы ref/ идут в курсе не по номерам: после struct (8) сразу указатели (22), перемещение (23)
//  — перед умными указателями (18), CMake (24) — сразу после разделения на файлы (19). Этот порядок
//  (как в docs/00-marshrut.md) задаёт:
//    • группу «Справочник по темам» в боковой панели и в окне (lib/docs.js collectGroups);
//    • ссылки «← назад / вперёд →» в шапке и внизу каждой темы (scripts/check-links.js сверяет);
//    • «Забегаем вперёд» в окне (что «позже» — по этому порядку; окно берёт его из порядка данных).
//  Справка и словари — отдельная группа: их не «проходят», а открывают по надобности.
//  Без vscode — его зовут и скрипты.
// ============================================================

const COURSE = [
  '01-osnovy', '02-vvod-vyvod', '03-logika-cikly', '04-funkcii', '05-stroki', '06-konteynery', '07-algoritmy',
  '08-struct-fayly', '22-ukazateli', '13-klassy', '14-isklyucheniya', '15-string-view', '16-ranges', '17-shablony',
  '23-peremeshchenie', '18-umnye-ukazateli', '19-razdelenie', '24-cmake', '25-constexpr', '26-variant', '27-potoki',
  '20-nasledovanie', '28-otladchik', '21-igra-v-konsoli',
];
const REFERENCE = ['09-spravka', '10-slovar', '10a-slovar-funkcij', '11-oshibki', '12-lovim-bagi'];

/** Имя файла без .md → место в курсе (-1 — не тема курса). */
function courseIndex(name) { return COURSE.indexOf(String(name).replace(/\.md$/i, '')); }
function isReference(name) { return REFERENCE.indexOf(String(name).replace(/\.md$/i, '')) !== -1; }

/** Соседи в цепочке навигации: темы курса — по COURSE, справка — по REFERENCE. */
function neighbours(name) {
  const base = String(name).replace(/\.md$/i, '');
  const list = COURSE.indexOf(base) !== -1 ? COURSE : REFERENCE.indexOf(base) !== -1 ? REFERENCE : null;
  if (!list) return null;
  const i = list.indexOf(base);
  return { prev: i > 0 ? list[i - 1] : null, next: i + 1 < list.length ? list[i + 1] : null };
}

module.exports = { COURSE, REFERENCE, courseIndex, isReference, neighbours };
