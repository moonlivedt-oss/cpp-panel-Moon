  // ==== runtime/15-errors-bridge.js — ошибки компилятора простым языком, мост доки↔редактор ====
  // ---------------------------------------------------------------------------
  //  Ошибка компилятора простым языком. Берём ПЕРВУЮ ошибку (остальные обычно её
  //  последствия) и сверяем с шаблонами g++ / clang / MSVC / подсказок редактора
  //  (IntelliSense). h — заголовок раздела в ref/11-oshibki.md, куда ведёт «Подробнее».
  // ---------------------------------------------------------------------------
  var STD_HEADER = {
    cout: "iostream", cin: "iostream", cerr: "iostream", endl: "iostream",
    string: "string", getline: "string", to_string: "string", stoi: "string", stod: "string",
    vector: "vector", map: "map", unordered_map: "unordered_map", set: "set", unordered_set: "unordered_set",
    array: "array", deque: "deque", stack: "stack", queue: "queue", priority_queue: "queue",
    sort: "algorithm", find: "algorithm", reverse: "algorithm", count: "algorithm", max: "algorithm", min: "algorithm",
    max_element: "algorithm", min_element: "algorithm", accumulate: "numeric", iota: "numeric",
    swap: "utility", pair: "utility", make_pair: "utility", setw: "iomanip", setprecision: "iomanip", fixed: "iostream",
    ifstream: "fstream", ofstream: "fstream", fstream: "fstream",
    stringstream: "sstream", istringstream: "sstream", ostringstream: "sstream",
    sqrt: "cmath", pow: "cmath", abs: "cmath", floor: "cmath", ceil: "cmath", round: "cmath",
    rand: "cstdlib", srand: "cstdlib", time: "ctime", numeric_limits: "limits",
    unique_ptr: "memory", make_unique: "memory", shared_ptr: "memory", make_shared: "memory",
    optional: "optional", string_view: "string_view", function: "functional"
  };
  function stdHint(name) {
    var h = STD_HEADER[name];
    return h ? " Похоже на средство стандартной библиотеки: пиши std::" + name + " и подключи #include <" + h + "> в начале файла." : "";
  }
  var ERR_RULES = [
    { re: [/'(\w+)' was not declared in this scope/, /use of undeclared identifier '(\w+)'/, /identifier "(\w+)" is undefined/, /'(\w+)': undeclared identifier/],
      t: function (m) { return "Компилятор не знает имя «" + m[1] + "»"; },
      why: "Имя используется, но нигде выше не объявлено: опечатка (регистр важен: Count ≠ count), переменная объявлена ниже или внутри другого блока { }, либо забыт #include / std::.",
      fix: function (m) { return "Проверь написание и где объявлено имя." + stdHint(m[1]); },
      h: "`'cout' was not declared in this scope`",
      ex: "#include <iostream>\n\nint main() {\n  int count = 0;            // сначала объявить…\n  count = count + 1;        // …потом пользоваться (регистр букв важен)\n  std::cout << count << \"\\n\";   // имена из стандартной библиотеки — с std::\n  return 0;\n}\n" },
    { re: [/'(\w+)' is not a member of 'std'/, /no member named '(\w+)' in namespace 'std'/, /namespace "std" has no member "(\w+)"/],
      t: function (m) { return "В std нет «" + m[1] + "» — не подключён заголовок"; },
      why: "Средства стандартной библиотеки живут в разных заголовках. Пока нужный #include не подключён, компилятор про них не знает.",
      fix: function (m) { var h = STD_HEADER[m[1]]; return h ? "Добавь в начало файла #include <" + h + ">." : "Найди, в каком заголовке объявлено «" + m[1] + "», и подключи его (или проверь написание)."; },
      h: "`'vector' is not a member of 'std'`" },
    { re: [/fatal error: ([\w./]+): No such file or directory/, /cannot open source file "([\w./]+)"/, /'([\w./]+)' file not found/],
      t: function (m) { return "Нет заголовка «" + m[1] + "»"; },
      why: "В #include опечатка или такого заголовка не существует. Стандартные пишутся без .h: <iostream>, <vector>, <string>.",
      fix: "Проверь имя в #include. Свои файлы подключаются в кавычках: #include \"my.h\"." },
    { re: [/expected ';'/, /expected a ";"/],
      t: "Не хватает точки с запятой",
      why: "Каждая инструкция в C++ заканчивается «;». Компилятор замечает пропуск только на СЛЕДУЮЩЕЙ строке — поэтому номер строки часто на одну больше.",
      fix: "Посмотри на конец ПРЕДЫДУЩЕЙ строки и поставь «;». После struct/class { … } тоже нужна «;».",
      h: "`expected ';' after struct definition`",
      ex: "struct Point {\n  int x = 0;\n  int y = 0;\n};                 // ← после struct { … } нужна «;»\n\nint main() {\n  Point p;         // каждая инструкция заканчивается «;»\n  p.x = 3;\n  return 0;\n}\n" },
    { re: [/expected '\}' at end of input/, /expected a "\}"/, /expected '\}'/],
      t: "Не закрыта фигурная скобка",
      why: "Где-то открыли «{», а закрыть забыли — компилятор дошёл до конца файла и не нашёл пару.",
      fix: "Пройди по блокам сверху вниз: у каждой «{» должна быть своя «}». Помогает аккуратный отступ (Format Document).",
      h: "`expected '}' at end of input`" },
    { re: [/expected primary-expression/, /expected an expression/, /expected expression/],
      t: "Ожидалось значение, а его нет",
      why: "В выражении пропущена часть: например «cout << ;», «x = ;», лишняя запятая или оператор без второго операнда.",
      fix: "Найди место с оператором (<<, =, +, запятая) и допиши недостающее значение.",
      h: "`expected primary-expression before ';' token`",
      ex: "#include <iostream>\n\nint main() {\n  int x = 5;\n  std::cout << x << \"\\n\";   // после каждого << — значение\n  int y = x * 2;             // после = — значение\n  std::cout << y << \"\\n\";\n  return 0;\n}\n" },
    { re: [/missing terminating (["']) character/, /missing closing quote/],
      t: "Не закрыта кавычка",
      why: "Строка \"…\" или символ '…' начаты, но не закончены. Кавычки должны быть парными и прямыми (\" \"), а не «ёлочками».",
      fix: "Закрой кавычку на той же строке." },
    { re: [/stray '\\?(\d+|.)' in program/, /extended character .* is not valid in an identifier/, /invalid character/],
      t: "Посторонний символ в коде",
      why: "В код попал символ, которого нет в C++: «ёлочки» «», длинное тире —, неразрывный пробел или русская буква — обычно после копирования из браузера или документа.",
      fix: "Перепечатай подозрительное место вручную (кавычки — \" , минус — -).",
      h: "`extended character « is not valid in an identifier`" },
    { re: [/'else' without a previous 'if'/, /expected a statement/],
      t: "else без своего if",
      why: "Чаще всего после if (…) стоит лишняя «;» или у if несколько строк без { } — и else «отрывается».",
      fix: "Убери «;» сразу после if (…) и возьми тело if в фигурные скобки." },
    { re: [/jump to case label/],
      t: "Переменная внутри case без { }",
      why: "Переменная объявлена в одном case, а соседний case «перепрыгивает» её создание.",
      fix: "Возьми код этого case в фигурные скобки: case 1: { … break; }",
      h: "`jump to case label`" },
    { re: [/no match for 'operator(<<|>>)'/, /no operator "(<<|>>)" matches these operands/, /invalid operands to binary expression \(('std::[\w:]*ostream)/],
      t: function (m) { return m[1] === ">>" ? "cin не умеет читать такой тип" : "cout не умеет печатать такой тип"; },
      why: "« << » умеет выводить числа, строки и символы. vector, struct, enum class и свои типы целиком напечатать нельзя.",
      fix: "Печатай по частям: элементы вектора — циклом for, у структуры — поля (p.name, p.age), enum class — через static_cast<int>(…)." },
    { re: [/invalid operands of types '(const )?char/],
      t: "Нельзя сложить два текста в кавычках",
      why: "\"текст\" — это не std::string, а массив символов. Два таких массива C++ складывать не умеет.",
      fix: "Сделай хотя бы один операнд строкой: std::string(\"Привет, \") + \"мир\" — или прибавляй к переменной типа std::string.",
      h: "`invalid operands of types 'const char [15]' and 'const char [7]' to binary 'operator+'`",
      ex: "#include <iostream>\n#include <string>\n\nint main() {\n  std::string name = \"мир\";\n  std::string a = std::string(\"Привет, \") + \"мир\";   // хотя бы один — std::string\n  std::string b = \"Привет, \" + name;                  // или переменная-строка\n  std::cout << a << \"\\n\" << b << \"\\n\";\n  return 0;\n}\n" },
    { re: [/invalid operands of types/],
      t: "Операция не подходит к этим типам",
      why: "Для такого сочетания типов операция не определена: например, сложили указатели или массивы.",
      fix: "Проверь типы слева и справа от оператора. Текст в кавычках — не std::string; число в строку — std::to_string(x).",
      h: "`invalid operands of types 'const char [15]' and 'const char [7]' to binary 'operator+'`" },
    { re: [/no match for 'operator([^']+)'/, /no operator "([^"]+)" matches these operands/, /invalid operands to binary expression/],
      t: function (m) { return "Операция" + (m[1] ? " «" + m[1] + "»" : "") + " не подходит к этим типам"; },
      why: "Для такого сочетания типов операция не определена: например, строку сложили с числом, или сравнивают структуру целиком.",
      fix: "Проверь типы слева и справа. Число в строку — std::to_string(x); структуры сравнивай по полям.",
      h: "`no match for 'operator+=' ... 'const std::string'`" },
    { re: [/no matching function for call to/, /no instance of (overloaded )?function .* matches the argument list/, /no matching function/],
      t: "Нет функции, которая принимает такие аргументы",
      why: "Имя функции верное, но число или типы аргументов не совпадают с её объявлением.",
      fix: "Сравни вызов с объявлением функции: сколько параметров и каких типов она ждёт. Под «candidate» компилятор пишет, почему вариант не подошёл.",
      h: "`no matching function for call to 'max(int&, double&)'`",
      ex: "#include <algorithm>\n#include <iostream>\n\nint main() {\n  int a = 3;\n  double b = 2.5;\n  // std::max(a, b) не соберётся: аргументы разных типов\n  double m = std::max<double>(a, b);   // явно: сравниваем как double\n  std::cout << m << \"\\n\";\n  return 0;\n}\n" },
    { re: [/too many arguments to function/, /too many arguments in function call/, /too few arguments to function/, /too few arguments in function call/],
      t: "Не то число аргументов",
      why: "Функцию вызывают с большим или меньшим числом аргументов, чем в её объявлении.",
      fix: "Сосчитай параметры в объявлении функции и передай ровно столько же.",
      h: "`too many arguments to function`" },
    { re: [/undefined reference to/, /unresolved external symbol/],
      t: "Функция объявлена, но у неё нет тела",
      why: "Это ошибка компоновщика: заголовок функции есть, а определения { … } нет — или оно названо иначе (регистр, типы параметров), или лежит в файле, который не собирался.",
      fix: "Найди функцию из сообщения и проверь, что тело написано и имя/параметры совпадают с объявлением один в один.",
      h: "`undefined reference to 'calc(int)'`" },
    { re: [/multiple definition of/, /already defined in/],
      t: "Одно и то же определено дважды",
      why: "Функция или переменная определена в двух местах — часто тело функции написали в .h, а его подключили в несколько .cpp, или в проекте два main.",
      fix: "Оставь одно определение: в .h — только объявление, тело — в одном .cpp.",
      h: "`multiple definition of 'main'`" },
    { re: [/redeclaration of/, /conflicting declaration/, /redefinition of/, /has already been declared/],
      t: "Имя объявлено второй раз",
      why: "В одной области видимости дважды объявили переменную (или функцию) с тем же именем.",
      fix: "Удали повторное объявление: во второй раз пиши просто x = …, без типа впереди." },
    { re: [/assignment of read-only (variable|location)/, /expression must be a modifiable lvalue/, /cannot assign to (variable|return value)/],
      t: "Нельзя изменить const",
      why: "Значение объявлено const (или это const-ссылка/параметр) — менять его запрещено. Иногда так проявляется = вместо == в сравнении.",
      fix: "Если значение правда должно меняться — убери const. Если это сравнение — пиши ==.",
      h: "`assignment of read-only variable`" },
    { re: [/lvalue required as left operand of assignment/],
      t: "Слева от = должно быть «куда записать»",
      why: "Присваивают во что-то, что не является переменной: например if (x + 1 = 5) или перепутаны = и ==.",
      fix: "В сравнениях пиши ==. Слева от одиночного = должна стоять переменная.",
      h: "`lvalue required as left operand of assignment`",
      ex: "#include <iostream>\n\nint main() {\n  int x = 4;\n  if (x + 1 == 5) {          // сравнение — два знака ==\n    std::cout << \"равно\\n\";\n  }\n  x = x + 1;                 // присваивание: слева переменная\n  return 0;\n}\n" },
    { re: [/narrowing conversion/, /cannot be narrowed/],
      t: "Потеря точности в { }",
      why: "Инициализация фигурными скобками запрещает «сужение»: например int x{3.7} потеряла бы дробную часть.",
      fix: "Сделай тип подходящим (double x{3.7}) или преобразуй явно: static_cast<int>(3.7).",
      h: "`narrowing conversion`" },
    { re: [/invalid conversion from/, /cannot convert/, /a value of type .* cannot be (used to initialize|assigned to) an entity of type/, /cannot initialize a variable of type/],
      t: "Типы не совпадают",
      why: "Значение одного типа кладут туда, где ждут другой: строку в int, число в string, указатель в число.",
      fix: "Проверь тип переменной и того, что ей присваиваешь. Строку в число — std::stoi(s), число в строку — std::to_string(x).",
      h: "`invalid conversion from 'const char*' to 'int'`" },
    { re: [/is private within this context/, /is inaccessible/, /is a private member of/],
      t: "Поле закрыто (private)",
      why: "К полю или методу класса обращаются снаружи, а оно объявлено private (в class по умолчанию всё private).",
      fix: "Сделай метод-доступ (get…/set…) в public, или перенеси поле в секцию public:.",
      h: "`'int Box::size' is private within this context`" },
    { re: [/request for member '(\w+)' in .* which is of (non-class|pointer) type/, /expression must have (class|struct|union) type/, /member reference base type .* is not a structure or union/],
      t: "Точка у того, что не объект",
      why: "«.» работает только у объектов (struct/class/string/vector). У числа полей нет, а у указателя вместо точки пишут «->».",
      fix: "Проверь тип переменной слева от точки. Для указателя: p->name вместо p.name.",
      h: "`request for member 'size' in 'n', which is of non-class type 'int'`" },
    { re: [/does not name a type/, /unknown type name/, /is not a type name/],
      t: "Компилятор не знает этот тип",
      why: "Тип написан с опечаткой, для него не подключён #include, или код стоит вне функции (например, x = 5; прямо в файле, а не в main).",
      fix: "Проверь написание типа и нужный #include (std::string — <string>, std::vector — <vector>).",
      h: "`'string' does not name a type`",
      ex: "#include <string>                // std::string живёт здесь\n#include <vector>\n\nstruct Student {                 // свой тип объявляем ДО использования\n  std::string name;\n  int score = 0;\n};\n\nint main() {\n  std::string city = \"Казань\";  // с std::\n  std::vector<Student> group;\n  return 0;\n}\n" },
    { re: [/expected unqualified-id/, /expected a declaration/],
      t: "Код стоит не на своём месте",
      why: "Обычно лишняя или недостающая «}» выше: из-за неё код «вывалился» из функции, где он должен быть.",
      fix: "Проверь парность фигурных скобок в функции над этой строкой." },
    { re: [/control reaches end of non-void function/, /non-void function does not return a value/, /must return a value/],
      t: "Функция может не вернуть значение",
      why: "Функция обещает вернуть результат (int, double…), но есть путь, где она заканчивается без return.",
      fix: "Добавь return во все ветки — в том числе после if/else в самом конце.",
      h: "`control reaches end of non-void function`" },
    { re: [/is used uninitialized/, /may be used uninitialized/, /is uninitialized when used/],
      t: "Переменная используется без значения",
      why: "Переменную объявили, но не дали ей начального значения — в ней «мусор».",
      fix: "Сразу задавай значение: int count = 0;",
      h: "`'count' is used uninitialized`",
      ex: "#include <iostream>\n\nint main() {\n  int count = 0;             // значение — сразу при объявлении\n  for (int i = 0; i < 3; ++i) count += i;\n  std::cout << count << \"\\n\";\n  return 0;\n}\n" }
  ];
  // Первая строка с ошибкой (линкер: «undefined reference» важнее итоговой «ld returned 1»).
  function firstErrorLine(text) {
    var lines = String(text || "").replace(/\r\n?/g, "\n").split("\n"), i;
    for (i = 0; i < lines.length; i++) if (/undefined reference to|multiple definition of|unresolved external/.test(lines[i])) return lines[i].trim();
    for (i = 0; i < lines.length; i++) if (/\b(fatal )?error\b[ :C]/i.test(lines[i]) && !/ld returned|collect2/.test(lines[i])) return lines[i].trim();
    for (i = 0; i < lines.length; i++) if (lines[i].trim()) return lines[i].trim();
    return "";
  }
  // → { msg, line, t, why, fix, h } ; неизвестная ошибка — общий совет «читай первую».
  function explainCompileError(text) {
    var msg = firstErrorLine(text);
    var lm = msg.match(/:(\d+):(?:\d+:)?\s*(?:fatal )?error/i) || msg.match(/\((\d+)\):\s*(?:fatal )?error/i);
    var out = { msg: msg.slice(0, 300), line: lm ? +lm[1] : 0 };
    var hay = [msg, String(text || "")];
    for (var k = 0; k < hay.length; k++) {
      for (var r = 0; r < ERR_RULES.length; r++) {
        var rule = ERR_RULES[r];
        for (var j = 0; j < rule.re.length; j++) {
          var m = hay[k].match(rule.re[j]);
          if (!m) continue;
          out.t = typeof rule.t === "function" ? rule.t(m) : rule.t;
          out.why = rule.why;
          out.fix = typeof rule.fix === "function" ? rule.fix(m) : rule.fix;
          out.h = rule.h || null;
          out.ex = rule.ex || null;
          out.known = true;
          return out;
        }
      }
    }
    out.t = "Разбери первую ошибку";
    out.why = "Это сообщение не из частых. Читай только ПЕРВУЮ ошибку — остальные обычно её последствия: в ней есть файл, номер строки и суть.";
    out.fix = "Посмотри на строку из сообщения и строку над ней. Исправь, собери заново — и снова только первая ошибка.";
    out.h = "Три правила, которые экономят больше всего времени";
    out.known = false;
    return out;
  }
  // Где разбор: файл-словарь ошибок + якорь раздела (или null, если словаря нет в доках).
  function errorDocTarget(h) {
    var d = DATA(); if (!d || !d.files || !h) return null;
    for (var i = 0; i < d.files.length; i++) {
      if (/(^|\/)11-oshibki\.md$/i.test(d.files[i].rel)) return { rel: d.files[i].rel, hash: "#" + slugify(h) };
    }
    return null;
  }
  function explainHtml(ex) {
    var tgt = errorDocTarget(ex.h);
    return '<div class="cd-explain' + (ex.known ? "" : " generic") + '">' +
      '<div class="cd-ex-t">💡 ' + escapeHtml(ex.t) + (ex.line ? ' <span class="cd-ex-line">строка ' + ex.line + "</span>" : "") + "</div>" +
      '<div class="cd-ex-why">' + escapeHtml(ex.why) + "</div>" +
      '<div class="cd-ex-fix"><b>Что сделать:</b> ' + escapeHtml(ex.fix) + "</div>" +
      (tgt ? '<button class="cd-ex-more" type="button" data-rel="' + escapeHtml(tgt.rel) + '" data-hash="' + escapeHtml(tgt.hash) + '">Подробнее в «Ошибках компилятора» →</button>' : "") +
      "</div>";
  }

  // Жив ли каталог расширения. При удалении VS Code не зовёт «отключить окно», и впечатанный
  // рантайм остаётся до очистки хуком vscode:uninstall (он срабатывает только после перезапуска).
  // Раз в минуту асинхронно читаем крошечный маячок (package.json расширения); два промаха подряд —
  // окно осиротело, снимаем кнопку. Маячка нет (старые данные) — считаем, что живо.
  var _alive = true, _aliveMiss = 0, _aliveAt = 0;
  function extAlive() {
    if (IN_PANEL) return true;
    var d = DATA(), url = (d && d.aliveUrl) || bootVal("aliveUrl");
    if (!url) return true;
    if (Date.now() - _aliveAt > 60000) {
      _aliveAt = Date.now();
      appReadAsync(url, function (txt) {
        if (txt != null) { _aliveMiss = 0; _alive = true; }
        else if (++_aliveMiss >= 2) _alive = false;
      });
    }
    return _alive;
  }
  // Только чтение + JSON.parse: файл НЕ исполняется (иначе подмена файла в globalStorage =
  // произвольный код в оболочке). Не прочиталось/не распарсилось — остаёмся на старых данных.
  var _refreshing = false;
  function refreshData() {
    var d = DATA();
    var url = (d && d.dataUrl) || bootVal("dataUrl");
    if (!url) { rebuildFromData(); return; }
    if (_refreshing) return;
    _refreshing = true;
    appReadAsync(url, function (txt) {
      _refreshing = false;
      if (txt != null) {
        try {
          _cardSig.t = 0;   // карточки на кнопке пересчитать уже по полным данным
          var jm = txt.replace(/^[\s\S]*?window\.__CPPDOCS__\s*=\s*/, "").replace(/;\s*$/, "");
          var obj = sanitizeData(JSON.parse(jm));
          if (obj) window.__CPPDOCS__ = obj;
        } catch (e) { reportError("данные окна", e); }
      }
      rebuildFromData();
      try { syncBadge(); } catch (e) {}
    });
  }
  function rebuildFromData() {
    if (!winEl) return;
    var onHome = winEl.classList.contains("home");
    var keepRel = current && current.rel;
    renderNav();
    // Были на главной (в т.ч. на скелете загрузки) — обновляем её, не выкидывая на файл.
    if (onHome) { showHome(); return; }
    var map = fileMap();
    if (keepRel && map[keepRel.toLowerCase()]) openFile(keepRel);
    else { var d = DATA(); if (d && d.files[0]) openFile(d.files[0].rel); }
  }

  // Автообновление: расширение при правке доков/кнопке «Обновить» переписывает крошечный
  // файл-метку (cpp-docs-stamp.js → window.__CPPDOCS_STAMP__). Опрашиваем ЕГО, а не тяжёлый
  // data-файл; полный refreshData() дёргаем только когда метка реально сменилась.
  // ------- мост доки↔редактор: подсказка по слову под курсором (файл cpp-docs-editor.js) -------
  //  Хост пишет { word, lang } активного C/C++-редактора; окно опрашивает файл (как метку stamp),
  //  показывает плашку с пояснением и кнопкой «Открыть». Выключается настройкой cppDocs.editorBridge
  //  (тогда хост шлёт null, и плашка прячется). Мини-словарь — частые слова для новичка.
  var CPPMAP = {
    "vector": "динамический массив: push_back добавляет, [i] — доступ, size() — длина",
    "string": "строка: += дописывает, .size(), .substr(a,n), [i] — символ",
    "map": "словарь ключ→значение: m[k]=v, .count(k), обход по парам",
    "unordered_map": "быстрый словарь без порядка ключей (хеш-таблица)",
    "set": "множество уникальных значений: .insert(x), .count(x)",
    "pair": "пара значений: .first и .second",
    "array": "массив фиксированного размера: std::array<T,N>",
    "cout": "поток вывода: std::cout << x печатает x",
    "cin": "поток ввода: std::cin >> x читает x",
    "endl": "перевод строки + сброс буфера (часто хватает \"\\n\")",
    "for": "цикл со счётчиком: for (инициализация; условие; шаг)",
    "while": "цикл, пока условие истинно (проверка до тела)",
    "if": "ветвление: выполнить блок, если условие истинно",
    "switch": "выбор ветки по значению (case), не забудь break",
    "auto": "тип выводится из значения справа при инициализации",
    "const": "значение нельзя менять после задания",
    "constexpr": "вычисляется на этапе компиляции, если возможно",
    "struct": "структура: объединяет поля (и методы) в один тип",
    "class": "класс: как struct, но поля по умолчанию скрыты (private)",
    "enum": "перечисление именованных значений (лучше enum class)",
    "return": "вернуть значение из функции и выйти из неё",
    "nullptr": "пустой указатель — не указывает ни на что",
    "bool": "логический тип: true или false",
    "int": "целое число (обычно 32 бита)",
    "double": "дробное число двойной точности",
    "float": "дробное число одинарной точности",
    "char": "один символ (байт)",
    "void": "«ничего»: функция без возвращаемого значения",
    "sizeof": "размер типа или объекта в байтах",
    "static": "живёт всю программу; в классе — общий на все объекты",
    "namespace": "пространство имён, чтобы не сталкивались одинаковые имена",
    "include": "#include подключает заголовок с нужными средствами",
    "template": "шаблон: код, работающий с любым типом T",
    "typename": "обозначает тип-параметр в шаблоне",
    "throw": "бросить исключение (ошибку), которую ловит try/catch",
    "try": "блок, где ошибки перехватываются catch",
    "catch": "перехватывает исключение из try",
    "new": "выделить объект в куче (лучше умные указатели)",
    "delete": "освободить память из new (парой к нему)"
  };
  var lastBridgeWord = null, bridgeDismissed = null;
  // Найти материал по слову: сперва по заголовку/имени, затем по тексту (короткие слова — только заголовки).
  function bridgeFind(word) {
    var d = DATA(); if (!d || !d.files) return null;
    var w = String(word).toLowerCase();
    for (var i = 0; i < d.files.length; i++) {
      var f = d.files[i];
      if (((f.title || "") + " " + (f.subtitle || "") + " " + (f.name || "")).toLowerCase().indexOf(w) >= 0) return f.rel;
    }
    if (w.length >= 4) {
      for (var j = 0; j < d.files.length; j++) {
        if ((d.files[j].md || "").toLowerCase().indexOf(w) >= 0) return d.files[j].rel;
      }
    }
    return null;
  }
  function hideBridge(remember) {
    if (bridgeEl) bridgeEl.hidden = true;
    if (remember) bridgeDismissed = lastBridgeWord;   // это слово пользователь закрыл — не всплывать снова
  }
  var bridgeTarget = null;   // куда ведёт кнопка плашки: {rel, hash}
  var bridgeExample = null;  // правильный мини-пример к ошибке (кнопка «Пример»)
  function setBridge(title, def, target, btnLabel, isErr, example) {
    bridgeExample = example || null;
    var exb = bridgeEl.querySelector(".cd-bridge-ex"); if (exb) exb.hidden = !bridgeExample;
    bridgeEl.classList.toggle("err", !!isErr);
    bridgeEl.querySelector(".cd-bridge-ic").textContent = isErr ? "⚠" : "✎";
    bridgeEl.querySelector(".cd-bridge-word").textContent = title;
    var defEl = bridgeEl.querySelector(".cd-bridge-def");
    defEl.textContent = def; defEl.hidden = !def;
    var ob = bridgeEl.querySelector(".cd-bridge-open");
    ob.textContent = btnLabel; ob.hidden = !target;
    bridgeTarget = target;
    bridgeEl.hidden = false;
  }
  function showBridge(word) {
    if (!bridgeEl) return;
    var def = CPPMAP[String(word).toLowerCase()] || "";
    var rel = bridgeFind(word);
    if (!def && !rel) { hideBridge(false); return; }  // нечего сказать и некуда вести — молчим
    setBridge(word, def, rel ? { rel: rel } : null, "Открыть", false);
  }
  // Курсор в редакторе на строке с ошибкой — плашка с объяснением простым языком.
  var lastBadgeDiag = "";
  function showBridgeError(diag) {
    if (!bridgeEl) return;
    var ex = explainCompileError(diag.msg);
    setBridge("Ошибка" + (diag.line ? " · строка " + diag.line : ""), ex.t + ". " + ex.fix, errorDocTarget(ex.h), "Разобрать", true, ex.ex);
  }
  function bridgeOpen() {
    var t = bridgeTarget;
    if (t && t.rel) { hideBridge(true); openFile(t.rel, t.hash); }
  }
  // «Найти в справочнике C++» из меню редактора: открыть окно и нужный материал.
  var lastLookupTs = 0;
  function handleLookup(lk) {
    if (!lk || typeof lk.ts !== "number" || lk.ts <= lastLookupTs) return;
    lastLookupTs = lk.ts;
    if (Date.now() - lk.ts > 15000) return;             // старый запрос (окно перезапускали)
    if (!isOpen()) openWindow();
    // «📘 Почему так» из подсказки по стилю: конкретный файл и раздел
    if (typeof lk.rel === "string" && /^[\w\-\/]+\.md$/.test(lk.rel) && lk.rel.split("/").indexOf("..") === -1) {
      if (lookupFile(lk.rel)) openFile(lk.rel, typeof lk.hash === "string" && lk.hash ? "#" + lk.hash.replace(/[^\p{L}\p{N}\-_]/gu, "") : null);
      else toast("Раздел не найден в материалах", true);
      return;
    }
    if (lk.diag && typeof lk.diag.msg === "string") {
      var ex = explainCompileError(lk.diag.msg), t = errorDocTarget(ex.h);
      if (t) openFile(t.rel, t.hash);
      showBridgeError(lk.diag);
      return;
    }
    var word = typeof lk.word === "string" ? lk.word : "";
    var rel = word && bridgeFind(word);
    if (rel) openFile(rel);
    else toast("В справочнике не нашлось «" + word + "»", true);
  }
  var editorPayload = null, _editorText = null;
  var lastEditorKey = "", bridgePin = null;   // bridgePin — ключ, при котором плашку открыли вручную из шапки
  function parseEditorText(txt) {
    if (txt == null) return null;
    try {
      var p = JSON.parse(String(txt).replace(/^[\s\S]*?__CPPDOCS_EDITOR__\s*=\s*/, "").replace(/;\s*$/, ""));
      return p && typeof p === "object" && !Array.isArray(p) ? p : null;
    } catch (e) { return null; }
  }
  // Запасной опрос (поток событий не подключён): читаем файл и применяем, только если он изменился.
  function pollEditor() {
    var d = DATA(); var url = (d && d.editorUrl) || bootVal("editorUrl");
    if (!url) return;
    var txt = nodeRead(url); if (txt == null) return;   // файла нет — не трогаем плашку
    if (txt === _editorText) { applyEditorPayload(editorPayload); return; }
    _editorText = txt;
    editorPayload = parseEditorText(txt);
    applyEditorPayload(editorPayload);
  }
  function applyEditorPayload(payload) {
    if (payload && payload.lookup) handleLookup(payload.lookup);   // работает и при закрытом окне
    if (winEl) applyEditorEnv(payload);                              // индикатор «редактор» в шапке
    var diag = payload && payload.diag && typeof payload.diag.msg === "string" ? payload.diag : null;
    // окно закрыто, а курсор встал на ошибку — зажечь «!» на кнопке-запуске
    if (!isOpen() && diag) {
      var dk = "d:" + diag.line + ":" + diag.msg;
      if (dk !== lastBadgeDiag) { lastBadgeDiag = dk; pendingErr = true; syncBadge(); }
    }
    if (!bridgeEl || !isOpen()) return;
    var word = payload && typeof payload.word === "string" ? payload.word : "";
    var key = diag ? "d:" + diag.line + ":" + diag.msg : word;   // ошибка на строке важнее слова
    lastEditorKey = key;
    if (bridgePin !== null) { if (key === bridgePin) return; bridgePin = null; }   // плашку открыли из шапки — держим, пока курсор на месте
    if (!key) { lastBridgeWord = null; hideBridge(false); return; }
    if (key === lastBridgeWord) return;                 // то же слово/ошибка — не мигаем
    lastBridgeWord = key;
    if (key === bridgeDismissed) { hideBridge(false); return; }
    if (diag) showBridgeError(diag); else showBridge(word);
  }

  var lastStamp = null, stampInit = false;
  function applyStampText(txt) {
    if (txt == null) return;
    var mm = String(txt).match(/=\s*(\d+)/);
    var st = mm ? parseInt(mm[1], 10) : null;
    if (st == null) return;
    if (!stampInit) { stampInit = true; lastStamp = st; }
    else if (st !== lastStamp) { lastStamp = st; refreshData(); }
  }
  function pollStamp() {
    var d = DATA();
    var url = (d && d.stampUrl) || bootVal("stampUrl");
    if (url) applyStampText(nodeRead(url));
  }

