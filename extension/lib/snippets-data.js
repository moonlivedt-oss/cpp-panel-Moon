// ============================================================
//  Быстрые слова C++ — каталог для умных вставок (lib/smart-snippets.js)
//  и страницы «Быстрые слова» в справочнике (scripts/gen-snippets-doc.js).
//
//  Виды слов:
//    func — функция ввода: вне функций вставляет определение, внутри — вызов,
//           а само определение кладёт над текущей функцией (если его ещё нет).
//    main — каркас программы (не предлагается, если main уже есть).
//    code — кусок кода в месте курсора.
//  includes — заголовки, которых не хватает, допишутся к остальным #include;
//  needs    — функции ввода, которые допишутся над текущей функцией.
//  Тела — синтаксис сниппетов VS Code ($1, ${1:имя}, ${1|a,b|}); отступ — \t.
//  Код функций (FUNCS) — обычный текст: он вставляется как есть.
// ============================================================

const WINDOWS = 'windows.h';
const WINDOWS_BLOCK = ['#define NOMINMAX', '#define WIN32_LEAN_AND_MEAN', '#include <windows.h>'];

const FUNCS = {
  readLine: {
    includes: ['cstdlib', 'iostream', 'string'],
    code: [
      'std::string readLine(const std::string &prompt) {',
      '\tstd::cout << prompt;',
      '\tstd::string line;',
      '\tif (!std::getline(std::cin, line)) {',
      '\t\tstd::cout << "\\nВвод закончился.\\n";',
      '\t\tstd::exit(0);',
      '\t}',
      "\tif (!line.empty() && line.back() == '\\r') {",
      '\t\tline.pop_back();',
      '\t}',
      '\treturn line;',
      '}',
    ],
  },
  readInt: {
    includes: ['cstdlib', 'iostream', 'limits', 'sstream', 'string', 'utility'],
    code: [
      'int readInt(const std::string &prompt,',
      '            int lo = std::numeric_limits<int>::min(),',
      '            int hi = std::numeric_limits<int>::max()) {',
      '\tif (lo > hi) {',
      '\t\tstd::swap(lo, hi);',
      '\t}',
      '\twhile (true) {',
      '\t\tstd::cout << prompt;',
      '\t\tstd::string line;',
      '\t\tif (!std::getline(std::cin, line)) {',
      '\t\t\tstd::cout << "\\nВвод закончился.\\n";',
      '\t\t\tstd::exit(0);',
      '\t\t}',
      '\t\tstd::istringstream in(line);',
      '\t\tint value = 0;',
      '\t\tchar extra = 0;',
      '\t\tif (!(in >> value) || in >> extra) {',
      '\t\t\tstd::cout << "Нужно целое число.\\n";',
      '\t\t} else if (value < lo || value > hi) {',
      '\t\t\tstd::cout << "Нужно число от " << lo << " до " << hi << ".\\n";',
      '\t\t} else {',
      '\t\t\treturn value;',
      '\t\t}',
      '\t}',
      '}',
    ],
  },
  readDouble: {
    includes: ['algorithm', 'cstdlib', 'iostream', 'limits', 'sstream', 'string', 'utility'],
    code: [
      'double readDouble(const std::string &prompt,',
      '                  double lo = std::numeric_limits<double>::lowest(),',
      '                  double hi = std::numeric_limits<double>::max()) {',
      '\tif (lo > hi) {',
      '\t\tstd::swap(lo, hi);',
      '\t}',
      '\twhile (true) {',
      '\t\tstd::cout << prompt;',
      '\t\tstd::string line;',
      '\t\tif (!std::getline(std::cin, line)) {',
      '\t\t\tstd::cout << "\\nВвод закончился.\\n";',
      '\t\t\tstd::exit(0);',
      '\t\t}',
      "\t\tstd::replace(line.begin(), line.end(), ',', '.');",
      '\t\tstd::istringstream in(line);',
      '\t\tdouble value = 0.0;',
      '\t\tchar extra = 0;',
      '\t\tif (!(in >> value) || in >> extra) {',
      '\t\t\tstd::cout << "Нужно число (можно дробное: 3.5 или 3,5).\\n";',
      '\t\t} else if (value < lo || value > hi) {',
      '\t\t\tstd::cout << "Нужно число от " << lo << " до " << hi << ".\\n";',
      '\t\t} else {',
      '\t\t\treturn value;',
      '\t\t}',
      '\t}',
      '}',
    ],
  },
  readYesNo: {
    includes: ['cstdlib', 'iostream', 'sstream', 'string'],
    code: [
      'bool readYesNo(const std::string &prompt) {',
      '\twhile (true) {',
      '\t\tstd::cout << prompt;',
      '\t\tstd::string line;',
      '\t\tif (!std::getline(std::cin, line)) {',
      '\t\t\tstd::cout << "\\nВвод закончился.\\n";',
      '\t\t\tstd::exit(0);',
      '\t\t}',
      '\t\tstd::istringstream in(line);',
      '\t\tstd::string word;',
      '\t\tin >> word;',
      '\t\tif (word == "y" || word == "Y" || word == "yes" || word == "д" || word == "Д" ||',
      '\t\t    word == "да" || word == "Да" || word == "ДА") {',
      '\t\t\treturn true;',
      '\t\t}',
      '\t\tif (word == "n" || word == "N" || word == "no" || word == "н" || word == "Н" ||',
      '\t\t    word == "нет" || word == "Нет" || word == "НЕТ") {',
      '\t\t\treturn false;',
      '\t\t}',
      '\t\tstd::cout << "Ответьте да или нет (y/n).\\n";',
      '\t}',
      '}',
    ],
  },
};

const MAIN_OPEN = ['int main() {', '\tSetConsoleCP(CP_UTF8);', '\tSetConsoleOutputCP(CP_UTF8);', ''];
const MAIN_CLOSE = ['', '\treturn 0;', '}'];

/** @type {Array<{prefix: string, title: string, section: string, desc: string, kind: string,
 *   func?: string, includes?: string[], needs?: string[], body: string[]}>} */
const SNIPPETS = [
  // ─── Каркас
  { prefix: 'main', title: 'Каркас программы', section: 'Каркас', kind: 'main',
    includes: [WINDOWS, 'iostream', 'string'],
    body: [...MAIN_OPEN, '\t$0', ...MAIN_CLOSE],
    desc: 'Скелет программы: UTF-8 для русского в консоли, все нужные <include>' },
  { prefix: 'maininput', title: 'Каркас с вводом', section: 'Каркас', kind: 'main',
    includes: [WINDOWS, 'iostream', 'string'], needs: ['readInt'],
    body: [...MAIN_OPEN, '\tint ${1:n} = readInt("${2:Введите число}: ");', '\t$0', ...MAIN_CLOSE],
    desc: 'Каркас + readInt. Остальные функции ввода добавятся сами, когда напишешь их слово' },
  { prefix: 'func', title: 'Функция', section: 'Каркас', kind: 'code',
    body: ['${1|int,double,bool,std::string,void|} ${2:doWork}(${3:int x}) {', '\t$0', '\treturn ${4:0};', '}'],
    desc: 'Заготовка функции: вынести кусок кода из main. У void убери return' },

  // ─── Ввод
  { prefix: 'readint', title: 'Ввод целого', section: 'Ввод', kind: 'func', func: 'readInt',
    body: ['int ${1:n} = readInt("${2:Введите число}: ");$0'],
    desc: 'В функции — вызов, а сама readInt появится над ней. Отвергает «12abc» и «3.5»' },
  { prefix: 'readintrange', title: 'Ввод целого в диапазоне', section: 'Ввод', kind: 'code', needs: ['readInt'],
    body: ['int ${1:n} = readInt("${2:Введите число}: ", ${3:1}, ${4:10});$0'],
    desc: 'Число строго от..до — readInt переспросит, пока не попадут' },
  { prefix: 'readdouble', title: 'Ввод дроби', section: 'Ввод', kind: 'func', func: 'readDouble',
    body: ['double ${1:x} = readDouble("${2:Введите число}: ");$0'],
    desc: 'Дробное число, понимает и 3.5, и 3,5. С диапазоном: readDouble("…", 0.5, 2.5)' },
  { prefix: 'readline', title: 'Ввод строки', section: 'Ввод', kind: 'func', func: 'readLine',
    body: ['std::string ${1:line} = readLine("${2:Введите строку}: ");$0'],
    desc: 'Вся строка с пробелами (имя, фраза). Можно смешивать с readInt' },
  { prefix: 'readyesno', title: 'Вопрос да/нет', section: 'Ввод', kind: 'func', func: 'readYesNo',
    body: ['if (readYesNo("${1:Продолжить? (y/n)}: ")) {', '\t$0', '}'],
    desc: 'y/да → true, n/нет → false, на опечатку переспрашивает' },
  { prefix: 'inputkit', title: 'Все функции ввода', section: 'Ввод', kind: 'code',
    needs: ['readLine', 'readInt', 'readDouble', 'readYesNo'], body: ['$0'],
    desc: 'Добавит те функции ввода, которых ещё нет: readLine, readInt, readDouble, readYesNo' },
  { prefix: 'inputloop', title: 'Читать числа до конца', section: 'Ввод', kind: 'code', includes: ['iostream'],
    body: ['int ${1:x} = 0;', 'while (std::cin >> ${1:x}) {', '\t$0', '}'],
    desc: 'Читать поток чисел, пока они идут (стоп — буквы или Ctrl+Z)' },
  { prefix: 'readvec', title: 'Вектор из N целых', section: 'Ввод', kind: 'code', includes: ['vector'], needs: ['readInt'],
    body: ['int ${1:n} = readInt("Сколько чисел: ", 0, ${2:1000});', 'std::vector<int> ${3:v}(${1:n});',
      'for (auto &${4:item} : ${3:v}) {', '\t${4:item} = readInt("Число: ");', '}', '$0'],
    desc: 'Спросить количество и заполнить вектор целых' },
  { prefix: 'readvecd', title: 'Вектор из N дробных', section: 'Ввод', kind: 'code', includes: ['vector'], needs: ['readInt', 'readDouble'],
    body: ['int ${1:n} = readInt("Сколько чисел: ", 0, ${2:1000});', 'std::vector<double> ${3:v}(${1:n});',
      'for (auto &${4:item} : ${3:v}) {', '\t${4:item} = readDouble("Число: ");', '}', '$0'],
    desc: 'Спросить количество и заполнить вектор дробных' },

  // ─── Объявления
  { prefix: 'vec', title: 'Вектор', section: 'Объявления', kind: 'code', includes: ['vector'],
    body: ['std::vector<${1|int,double,std::string|}> ${2:v};$0'], desc: 'Объявить вектор' },
  { prefix: 'mapd', title: 'Словарь (map)', section: 'Объявления', kind: 'code', includes: ['map'],
    body: ['std::map<${1|std::string,int,char|}, ${2|int,std::string,double|}> ${3:m};$0'],
    desc: 'map: поиск по ключу, ключи отсортированы' },
  { prefix: 'setd', title: 'Множество (set)', section: 'Объявления', kind: 'code', includes: ['set'],
    body: ['std::set<${1|int,std::string|}> ${2:seen};$0'], desc: 'set: только уникальные значения' },
  { prefix: 'struct', title: 'Структура', section: 'Объявления', kind: 'code', includes: ['string'],
    body: ['struct ${1:Student} {', '\tstd::string ${2:name};', '\tint ${3:score} = 0;', '};', '$0'],
    desc: 'struct с полями и значениями по умолчанию' },
  { prefix: 'enumclass', title: 'Перечисление (enum class)', section: 'Объявления', kind: 'code',
    body: ['enum class ${1:Color} { ${2:Red}, ${3:Green}, ${4:Blue} };', '$0'],
    desc: 'enum class: именованные варианты вместо чисел' },
  { prefix: 'grid', title: 'Двумерный вектор (сетка)', section: 'Объявления', kind: 'code', includes: ['vector'],
    body: ['int ${1:rows} = ${2:3}, ${3:cols} = ${4:3};',
      'std::vector<std::vector<${5|int,char,bool|}>> ${6:grid}(${1:rows}, std::vector<$5>(${3:cols}));', '$0'],
    desc: 'Сетка rows×cols (карта, поле). Тип выбирается один раз' },

  // ─── Циклы
  { prefix: 'fore', title: 'Перебор по значениям', section: 'Циклы', kind: 'code',
    body: ['for (const auto &${1:item} : ${2:v}) {', '\t$0', '}'], desc: 'range-for без копирования' },
  { prefix: 'forref', title: 'Перебор с изменением', section: 'Циклы', kind: 'code',
    body: ['for (auto &${1:item} : ${2:v}) {', '\t$0', '}'], desc: 'range-for по ссылке: можно менять элементы' },
  { prefix: 'fori', title: 'Цикл по индексам', section: 'Циклы', kind: 'code',
    body: ['for (std::size_t ${1:i} = 0; ${1:i} < ${2:v}.size(); ++${1:i}) {', '\t$0', '}'],
    desc: 'Когда нужен номер элемента (size_t, а не int)' },
  { prefix: 'forn', title: 'Цикл N раз', section: 'Циклы', kind: 'code',
    body: ['for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {', '\t$0', '}'], desc: 'Счётный цикл от 0 до n-1' },
  { prefix: 'form', title: 'Перебор словаря', section: 'Циклы', kind: 'code',
    body: ['for (const auto &[${1:key}, ${2:value}] : ${3:m}) {', '\t$0', '}'], desc: 'Перебор map: сразу ключ и значение' },

  // ─── Алгоритмы
  { prefix: 'sort', title: 'Сортировка вектора', section: 'Алгоритмы', kind: 'code', includes: ['algorithm', 'functional'],
    body: ['std::sort(${1:v}.begin(), ${1:v}.end(), ${2|std::less<>(),std::greater<>()|});$0'],
    desc: 'less — по возрастанию, greater — по убыванию' },
  { prefix: 'sortby', title: 'Сортировка по полю', section: 'Алгоритмы', kind: 'code', includes: ['algorithm'],
    body: ['std::sort(${1:group}.begin(), ${1:group}.end(),',
      '          [](const ${2:Student} &a, const ${2:Student} &b) { return a.${3:score} ${4|>,<|} b.${3:score}; });$0'],
    desc: 'Вектор структур по полю: > убывание, < возрастание' },
  { prefix: 'countif', title: 'Сосчитать подходящие', section: 'Алгоритмы', kind: 'code', includes: ['algorithm'],
    body: ['auto ${1:count} = std::count_if(${2:v}.begin(), ${2:v}.end(),',
      '                                [](const auto &${3:x}) { return ${4:x > 4}; });$0'],
    desc: 'Сколько элементов подходит под условие' },
  { prefix: 'findv', title: 'Найти элемент', section: 'Алгоритмы', kind: 'code', includes: ['algorithm'],
    body: ['auto ${1:it} = std::find(${2:v}.begin(), ${2:v}.end(), ${3:value});', 'if (${1:it} != ${2:v}.end()) {', '\t$0', '}'],
    desc: 'Поиск в векторе: end() — не нашли' },
  { prefix: 'sumv', title: 'Сумма вектора', section: 'Алгоритмы', kind: 'code', includes: ['numeric'],
    body: ['auto ${1:sum} = std::accumulate(${2:v}.begin(), ${2:v}.end(), ${3|0LL,0.0|});$0'],
    desc: 'Начальное значение задаёт тип суммы: 0LL — для целых, 0.0 — для double' },
  { prefix: 'maxv', title: 'Максимум/минимум вектора', section: 'Алгоритмы', kind: 'code', includes: ['algorithm'],
    body: ['if (!${1:v}.empty()) {', '\tauto ${2:best} = *std::${3|max,min|}_element(${1:v}.begin(), ${1:v}.end());', '\t$0', '}'],
    desc: 'Наибольший/наименьший элемент (на пустом векторе нельзя)' },
  { prefix: 'eraseif', title: 'Удалить подходящие', section: 'Алгоритмы', kind: 'code', includes: ['vector'],
    body: ['std::erase_if(${1:v}, [](const auto &${2:x}) { return ${3:x < 0}; });$0'],
    desc: 'Убрать из вектора все элементы по условию (C++20)' },
  { prefix: 'countmap', title: 'Счётчик через map', section: 'Алгоритмы', kind: 'code', includes: ['map', 'string'],
    body: ['std::map<${1|std::string,int,char|}, int> ${2:counter};', 'for (const auto &${3:item} : ${4:items}) {',
      '\t++${2:counter}[${3:item}];', '}', '$0'],
    desc: 'Сколько раз что встретилось: нет ключа → 0 → 1' },
  { prefix: 'clampv', title: 'Загнать в диапазон', section: 'Алгоритмы', kind: 'code', includes: ['algorithm'],
    body: ['${1:value} = std::clamp(${1:value}, ${2:0}, ${3:100});$0'],
    desc: 'Меньше нижней границы — станет ею, больше верхней — тоже' },

  // ─── Файлы
  { prefix: 'readfile', title: 'Чтение файла построчно', section: 'Файлы', kind: 'code', includes: ['fstream', 'iostream', 'string'],
    body: ['std::ifstream in("${1:data.txt}");', 'if (!in.is_open()) {', '\tstd::cout << "Файл не найден\\\\n";', '\treturn 1;', '}',
      'std::string line;', 'while (std::getline(in, line)) {', '\t$0', '}'],
    desc: 'Путь — относительно папки, откуда запущена программа' },
  { prefix: 'writefile', title: 'Запись в файл', section: 'Файлы', kind: 'code', includes: ['fstream', 'iostream'],
    body: ['std::ofstream out("${1:result.txt}");', 'if (!out.is_open()) {', '\tstd::cout << "Не удалось записать файл\\\\n";',
      '\treturn 1;', '}', 'out << $0;'],
    desc: 'Создать файл и записать в него (старое содержимое стирается)' },

  // ─── Вывод и дроби
  { prefix: 'fmt', title: 'Печать через format', section: 'Вывод и дроби', kind: 'code', includes: ['format', 'iostream'],
    body: ['std::cout << std::format("{} = {}\\\\n", ${1:a}, ${2:b});$0'], desc: '{} — место для значения' },
  { prefix: 'fmtf', title: 'Дробь с точностью', section: 'Вывод и дроби', kind: 'code', includes: ['format', 'iostream'],
    body: ['std::cout << std::format("{:.${2:2}f}\\\\n", ${1:value});$0'], desc: 'Дробь с N знаками после точки' },
  { prefix: 'table', title: 'Таблица через format', section: 'Вывод и дроби', kind: 'code', includes: ['format', 'iostream'],
    body: ['std::cout << std::format("{:<12}{:>6}\\\\n", "${1:Имя}", "${2:Балл}");', 'for (const auto &${3:s} : ${4:group}) {',
      '\tstd::cout << std::format("{:<12}{:>6}\\\\n", ${3:s}.${5:name}, ${3:s}.${6:score});', '}', '$0'],
    desc: 'Ровные колонки: format считает символы, а не байты' },
  { prefix: 'avg', title: 'Среднее с защитой', section: 'Вывод и дроби', kind: 'code',
    body: ['double ${1:avg} = ${2:v}.empty() ? 0.0', '    : static_cast<double>(${3:sum}) / static_cast<double>(${2:v}.size());$0'],
    desc: 'Среднее: проверка на пустоту и оба static_cast' },
  { prefix: 'dbleq', title: 'Сравнить дроби', section: 'Вывод и дроби', kind: 'code', includes: ['cmath'],
    body: ['if (std::abs(${1:a} - ${2:b}) < 1e-9) {', '\t$0', '}'], desc: 'double не сравнивают через ==' },

  // ─── Строки
  { prefix: 'strconv', title: 'Число ↔ строка', section: 'Строки', kind: 'code', includes: ['string'],
    body: ['int ${1:number} = std::stoi(${2:text});', 'std::string ${3:text2} = std::to_string(${1:number});$0'],
    desc: 'stoi бросит исключение, если в строке не число' },
  { prefix: 'strcase', title: 'Регистр строки', section: 'Строки', kind: 'code', includes: ['cctype'],
    body: ['for (char &${1:c} : ${2:text}) {',
      '\t${1:c} = static_cast<char>(std::${3|tolower,toupper|}(static_cast<unsigned char>(${1:c})));', '}', '$0'],
    desc: 'Только латиница: кириллицу в UTF-8 так не поменять' },
  { prefix: 'split', title: 'Разбить по пробелам', section: 'Строки', kind: 'code', includes: ['sstream', 'string', 'vector'],
    body: ['std::istringstream ${1:stream}(${2:line});', 'std::string ${3:word};', 'std::vector<std::string> ${4:words};',
      'while (${1:stream} >> ${3:word}) {', '\t${4:words}.push_back(${3:word});', '}', '$0'],
    desc: 'Строка → вектор слов' },

  // ─── Числа и случайность
  { prefix: 'rnd', title: 'Случайное число', section: 'Числа и случайность', kind: 'code', includes: ['random'],
    body: ['static std::mt19937 ${1:rng}(std::random_device{}());', 'std::uniform_int_distribution<int> ${2:dist}(${3:1}, ${4:6});',
      'int ${5:roll} = ${2:dist}(${1:rng});$0'],
    desc: 'Целое в [от; до], оба конца включены' },

  // ─── Управление
  { prefix: 'inrange', title: 'Проверка диапазона', section: 'Управление', kind: 'code', includes: ['iostream'],
    body: ['if (${1:value} < ${2:1} || ${1:value} > ${3:100}) {', '\tstd::cout << "Нужно число от ${2:1} до ${3:100}\\\\n";', '\t$0', '}'],
    desc: 'Отвергнуть значение вне [от; до]' },
  { prefix: 'menu', title: 'Меню (switch)', section: 'Управление', kind: 'code', includes: ['iostream'], needs: ['readInt'],
    body: ['int ${1:choice} = readInt("Выберите пункт: ", 1, ${2:3});', 'switch (${1:choice}) {', '\tcase 1:', '\t\t$0',
      '\t\tbreak;', '\tcase 2:', '\t\tbreak;', '\tdefault:', '\t\tbreak;', '}'],
    desc: 'readInt с диапазоном сам отсекает неверные пункты' },
];

/** Тело сниппета → обычный код: ${1:имя} → имя, ${1|a,b|} → a, $1 → '', \$ → $. Для превью и справочника. */
function plainBody(text) {
  const s = String(text);
  const vals = {};
  let i = 0;
  function parse(stop) {
    let out = '';
    while (i < s.length) {
      const c = s[i];
      if (c === '\\' && '$}\\'.indexOf(s[i + 1]) !== -1) { out += s[i + 1]; i += 2; continue; }
      if (stop && c === '}') { i++; return out; }
      if (c === '$') {
        let m = /^\$(\d+)/.exec(s.slice(i));
        if (m) { i += m[0].length; out += vals[m[1]] || ''; continue; }
        m = /^\$\{(\d+)([:|}])/.exec(s.slice(i));
        if (m) {
          const n = m[1];
          i += m[0].length;
          if (m[2] === '}') { out += vals[n] || ''; continue; }
          if (m[2] === ':') { const d = parse(true); if (!(n in vals)) vals[n] = d; out += vals[n]; continue; }
          const end = s.indexOf('|}', i);
          const first = s.slice(i, end).split(',')[0];
          i = end + 2;
          if (!(n in vals)) vals[n] = first;
          out += vals[n];
          continue;
        }
      }
      out += c;
      i++;
    }
    return out;
  }
  return parse(false);
}

module.exports = { SNIPPETS, FUNCS, WINDOWS, WINDOWS_BLOCK, plainBody };
