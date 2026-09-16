// ============================================================
//  Смоук-тест панели документации.   Запуск:  npm test
// ============================================================
//  `node --check` проверяет только синтаксис и не видит, работает ли расширение
//  по-настоящему: собирается ли HTML, находятся ли файлы документации, не рвётся
//  ли разметка на кавычках в заголовках. Поэтому тест загружает extension.js
//  с заглушкой модуля vscode (его вне редактора не существует) и проверяет:
//
//    - манифест расширения валиден и объявляет webview-панель;
//    - активация проходит и регистрирует провайдера;
//    - HTML собирается: есть поиск, группы, пункты, кнопки действий;
//    - подписи берутся из самих файлов документации, а не захардкожены;
//    - опасные символы в заголовках экранируются (иначе сломается разметка);
//    - при отсутствии папки docs показывается понятная заглушка, а не пустота.
//
//  Тест не требует установленного VS Code и ничего не меняет на диске.
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");
var Module = require("module");

var ROOT = path.join(__dirname, "..");
var EXT = path.join(ROOT, "extension");

var failures = [];
var checks = 0;

function check(name, condition, details) {
  checks++;
  if (condition) {
    console.log("  ok   " + name);
  } else {
    console.log("  ПРОВАЛ " + name + (details ? "  — " + details : ""));
    failures.push(name);
  }
}

// ------------------------------------------------------------
//  Заглушка модуля vscode: расширение вне редактора его не найдёт
// ------------------------------------------------------------
function makeVscodeStub(options) {
  var opts = options || {};
  return {
    Uri: { file: function (p) { return { fsPath: p }; } },
    workspace: {
      workspaceFolders: opts.folders || [],
      getConfiguration: function () {
        return {
          get: function (key) {
            if (key === "path") return opts.docsPath || "";
            return true;
          },
        };
      },
    },
    window: {
      registerWebviewViewProvider: function (id, provider) {
        opts.captured.provider = provider;
        opts.captured.viewId = id;
        return {};
      },
      showWarningMessage: function () {},
      showTextDocument: function () {},
    },
    commands: {
      registerCommand: function (id) {
        opts.captured.commands.push(id);
        return {};
      },
      executeCommand: function () {},
    },
  };
}

/** Заглушка globalState: панель хранит в нём список недавно открытых файлов. */
function makeState(initial) {
  var store = initial || {};
  return {
    get: function (key, fallback) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : fallback;
    },
    update: function (key, value) {
      store[key] = value;
      return Promise.resolve();
    },
  };
}

function loadExtension(stub) {
  var stubName = "vscode-stub-" + Math.random();
  var orig = Module._resolveFilename;
  Module._resolveFilename = function (request) {
    if (request === "vscode") return stubName;
    return orig.apply(this, arguments);
  };
  require.cache[stubName] = {
    id: stubName,
    filename: stubName,
    loaded: true,
    exports: stub,
  };
  delete require.cache[require.resolve(path.join(EXT, "extension.js"))];
  var ext = require(path.join(EXT, "extension.js"));
  Module._resolveFilename = orig;
  return ext;
}

/** Прогоняет провайдера и возвращает собранный HTML. */
function renderHtml(captured) {
  var html = "";
  captured.provider.view = {
    webview: {
      set html(value) {
        html = value;
      },
      get html() {
        return html;
      },
    },
  };
  captured.provider.render();
  return html;
}

console.log("Смоук-тест панели документации\n");

// ------------------------------------------------------------
//  1. Манифест расширения
// ------------------------------------------------------------
console.log("Манифест");
var pkg = JSON.parse(fs.readFileSync(path.join(EXT, "package.json"), "utf8"));
check("package.json читается", !!pkg.name);
check("объявлен вход main", pkg.main === "./extension.js");
check("есть контейнер в панели действий", !!(pkg.contributes.viewsContainers || {}).activitybar);
var views = (pkg.contributes.views || {}).cppDocs || [];
check("панель объявлена как webview", views.length === 1 && views[0].type === "webview");
check("иконка на месте", fs.existsSync(path.join(EXT, pkg.contributes.viewsContainers.activitybar[0].icon)));
check(
  "расширение активируется при старте (кнопка в статус-баре видна сразу)",
  Array.isArray(pkg.activationEvents) && pkg.activationEvents.indexOf("onStartupFinished") !== -1
);

// ------------------------------------------------------------
//  2. Активация
// ------------------------------------------------------------
console.log("\nАктивация");
var captured = { commands: [], provider: null, viewId: null };
// Документация лежит в самом проекте (docs/). Если вдруг её там нет (например,
// запуск из копии без доков), проверки интерфейса ниже просто пропустятся.
var docsPath = path.join(ROOT, "docs");
var ext = loadExtension(
  makeVscodeStub({ captured: captured, docsPath: docsPath, folders: [] })
);
var subscriptions = [];
ext.activate({ subscriptions: subscriptions, globalState: makeState() });

check("провайдер зарегистрирован", captured.viewId === "cppDocsPanel");
check("команды зарегистрированы", captured.commands.indexOf("cppDocs.refresh") !== -1);
check("команда фокуса поиска", captured.commands.indexOf("cppDocs.focusSearch") !== -1);
check("команда открытия меню отдельной панелью", captured.commands.indexOf("cppDocs.openMenu") !== -1);
check("подписки добавлены", subscriptions.length >= 3);

// ------------------------------------------------------------
//  3. Сборка интерфейса (только если документация на месте)
// ------------------------------------------------------------
console.log("\nИнтерфейс");
if (!fs.existsSync(path.join(docsPath, "00-НАЧНИ-ОТСЮДА.md"))) {
  console.log("  пропуск: папка документации не найдена (" + docsPath + ")");
} else {
  var html = renderHtml(captured);

  check("html собран", html.length > 1000);
  check("есть поле поиска", html.indexOf('id="search"') !== -1);
  check("есть кнопка запуска тестов", html.indexOf('id="btn-tests"') !== -1);
  check("есть кнопка проверки документации", html.indexOf('id="btn-check"') !== -1);

  var groups = html.match(/class="group-label"/g) || [];
  check("групп не меньше двух", groups.length >= 2, "найдено " + groups.length);

  var items = html.match(/class="item(?: fresh)?" role="option"/g) || [];
  check("пунктов не меньше десяти", items.length >= 10, "найдено " + items.length);

  check(
    "подписи берутся из файлов",
    html.indexOf('data-title="Начни отсюда"') !== -1,
    "не найден заголовок главной страницы"
  );
  check("у пунктов есть описания", (html.match(/data-sub="[^"]+"/g) || []).length > 5);
  check("описания не рвутся на полуслове", html.indexOf(" не при\"") === -1);
  check("csp выставлен", html.indexOf("Content-Security-Policy") !== -1);
  check("скрипт с nonce", /<script nonce="[A-Za-z0-9]{32}">/.test(html));

  // удобство: то, ради чего делалась вторая версия панели
  check("группы сворачиваются", html.indexOf('class="group-head"') !== -1);
  check("у групп есть счётчик", html.indexOf('class="group-count"') !== -1);
  check("у групп свой цветовой маркер", html.indexOf("--accent:") !== -1);
  check("есть кнопка очистки поиска", html.indexOf('id="clear"') !== -1);
  check("тулбар без кнопок-иконок (чистый вид)", html.indexOf('class="icon-btn"') === -1);
  check("у поля поиска есть иконка", html.indexOf('class="search-icon"') !== -1);
  check("состояние панели сохраняется", html.indexOf("vscode.setState") !== -1);
  check("состояние панели восстанавливается", html.indexOf("vscode.getState") !== -1);
  check("есть навигация стрелками", html.indexOf("ArrowDown") !== -1 && html.indexOf("ArrowUp") !== -1);
  check("Esc очищает поиск", html.indexOf("Escape") !== -1);
  check("поиск ищет и по тексту файлов", html.indexOf("data-body=") !== -1);
  check("результаты ранжируются", html.indexOf("rank") !== -1);
  check("поиск понимает несколько слов", html.indexOf("q.split(/ +/)") !== -1);
  check("совпадение в тексте даёт фрагмент-контекст", html.indexOf("function snippet") !== -1);
  check("ввод в поиск с дебаунсом", html.indexOf("filterTimer") !== -1);
  check("подсветка открытого в редакторе файла", html.indexOf("markCurrent") !== -1);
  check("открыть как текст правым кликом", html.indexOf("contextmenu") !== -1 && html.indexOf("'openText'") !== -1);
  check("очистка «Недавнего» из панели", html.indexOf("clearRecent") !== -1);
  check("счётчик всего материалов в покое", html.indexOf("материал") !== -1);
  // топ-10 идей интерфейса
  check("закладки: кнопка на пункте", html.indexOf("pin-btn") !== -1);
  check("оглавление материала", html.indexOf("toc-btn") !== -1 || html.indexOf("toc-link") !== -1);
  check("метка группы в результатах", html.indexOf("item-group-tag") !== -1);
  check("память прокрутки", html.indexOf("scroll:") !== -1);
  check("кнопка «наверх»", html.indexOf('id="to-top"') !== -1);
  check("нет чипов-фильтров (упрощено)", html.indexOf('id="chips"') === -1 && html.indexOf("applyChip") === -1);
  check("индикатор «недавно изменён»", html.indexOf(".fresh") !== -1);
  check("у пунктов нет мелких действий ⇥ и </>", html.indexOf("item-side-btn") === -1 && html.indexOf("item-text-btn") === -1);
  check("живой счётчик для скринридеров", html.indexOf('aria-live') !== -1);
  check("активный пункт помечается для скринридера", html.indexOf("aria-selected") !== -1);

  // автосетка колонок в широком окне остаётся (она автоматическая, не кнопка)
  check("адаптивная сетка колонок", html.indexOf("grid-template-columns") !== -1);
  check("убраны ручные тумблеры вида", html.indexOf('id="grid-toggle"') === -1 && html.indexOf('id="density"') === -1);
  check("убрано «открыть рядом»", html.indexOf("item-side-btn") === -1 && html.indexOf("openSide") === -1);
  check("убран тумблер «скрыть изученное»", html.indexOf('id="hide-read"') === -1);
  check("убрана кнопка «в сайдбар»", html.indexOf('id="to-sidebar"') === -1);
  check("отметки «изучено»", html.indexOf("data-read=") !== -1 && html.indexOf(".item.read") !== -1);
  check("полоса прогресса изучения", html.indexOf('id="progress-fill"') !== -1 && html.indexOf("updateProgress") !== -1);
  check("шапка панели в широком окне", html.indexOf("panel-head") !== -1);
  check("сброс прогресса", html.indexOf('id="progress-reset"') !== -1 && html.indexOf("resetProgress") !== -1);

  // --- 15 улучшений v2.8 ---
  check("оценка времени чтения у пунктов", html.indexOf('class="item-meta"') !== -1 && /~\d+\s*мин/.test(html));
  check("число разделов в подписи", /\d+\s+раздел/.test(html), "нет подписи с числом разделов");
  check("кнопка «Продолжить» (следующий неизученный)", html.indexOf('id="progress-continue"') !== -1);
  check("процент в полосе прогресса", html.indexOf("+ '%'") !== -1 || html.indexOf('+ pct +') !== -1);
  check("ручная отметка «изучено» кнопкой", html.indexOf('class="read-btn') !== -1 && html.indexOf("toggleRead") !== -1);
  check("открепить всё из группы «Закреплённое»", html.indexOf("clearPins") !== -1);
  check("убран фильтр свежести (чипы удалены)", html.indexOf("__fresh__") === -1 && html.indexOf("only-fresh") === -1);
  check("поиск без учёта регистра и ё/е", html.indexOf("/ё/g") !== -1 && html.indexOf("function norm") !== -1);
  check("навигация PageUp/PageDown", html.indexOf("PageDown") !== -1 && html.indexOf("PageUp") !== -1);
  check("Ctrl+K — прыжок в поиск", html.indexOf("e.ctrlKey || e.metaKey") !== -1 && /'k' \|\| e\.key === 'K'/.test(html));
  check("combobox для скринридера", html.indexOf('role="combobox"') !== -1 && html.indexOf("aria-activedescendant") !== -1);
  check("уникальные id у пунктов (для aria-activedescendant)", /id="opt-\d+"/.test(html));
  check("учёт prefers-reduced-motion", html.indexOf("prefers-reduced-motion") !== -1);
  check("правильное окончание в объявлении находок", html.indexOf("plural(shown.length") !== -1);
  check("внятная заглушка «ничего не нашлось»", html.indexOf('id="nothing-reset"') !== -1 && html.indexOf("nothing-text") !== -1);
  // регрессия: свёрнутое оглавление слушается hidden, а не висит раскрытым
  check("свёрнутое оглавление скрыто", html.indexOf(".item-toc[hidden]") !== -1 && html.indexOf("display: none") !== -1);

  var src = fs.readFileSync(path.join(EXT, "extension.js"), "utf8");
  check("есть отдельное меню-панель (webview panel)", src.indexOf("createWebviewPanel") !== -1);
  check("рендер общий для сайдбара и панели", src.indexOf("renderAll") !== -1 && src.indexOf("renderPanel") !== -1);
  check("панель следит за файлами", src.indexOf("createFileSystemWatcher") !== -1);
  check("панель реагирует на смену редактора", src.indexOf("onDidChangeActiveTextEditor") !== -1);
  check("переход к разделу оглавления", src.indexOf("openAt") !== -1);
  check("закладки хранятся между сессиями", src.indexOf("PINS_KEY") !== -1);
  check("прогресс изучения хранится между сессиями", src.indexOf("READ_KEY") !== -1);
  check("горячая клавиша на панель-меню", pkg.contributes.keybindings.some(function (k) { return k.command === "cppDocs.openMenu"; }));

  // --- v2.8: производительность и новые сообщения (по исходнику) ---
  check("файл разбирается один раз и кэшируется по mtime", src.indexOf("docCache") !== -1 && src.indexOf("parsed.mtimeMs !== mtimeMs") !== -1);
  check("оценка времени чтения считается", src.indexOf("function estimateMinutes") !== -1);
  check("подсчёт числа разделов", src.indexOf("function countSections") !== -1);
  check("обработка «открепить всё»", src.indexOf("msg.type === 'clearPins'") !== -1);
  check("обработка ручной отметки «изучено»", src.indexOf("msg.type === 'toggleRead'") !== -1 && src.indexOf("toggleRead(filePath)") !== -1);
  // Считаем только парсер доков (до блока инъекции окна): у окна свои законные
  // чтения workbench.html/рантайма, они к кэшу парсинга отношения не имеют.
  check("единственное чтение файла в парсере доков",
    (src.slice(0, src.indexOf("const WB_START")).match(/readFileSync/g) || []).length <= 3);

  // --- регрессии на исправленные баги ---
  // Свёрнутость групп привязана к имени, а не к порядковому индексу
  // (иначе появление «Недавнего»/«Закреплённого» сдвигает индексы).
  check(
    "ключ группы — имя, а не индекс",
    html.indexOf('data-group="Главное"') !== -1,
    "группа не помечена стабильным ключом"
  );
  // Результаты поиска не показывают один файл дважды.
  check("дедупликация результатов поиска", html.indexOf("seen.has(file)") !== -1);
  // Порядок пунктов после сброса поиска восстанавливается целиком.
  check(
    "порядок пунктов восстанавливается",
    html.indexOf("if (el._home) el._home.appendChild(el)") !== -1
  );
  // Хоткей открывает панель, даже если она была закрыта.
  check("фокус поиска открывает закрытую панель", src.indexOf("cppDocsPanel.focus") !== -1);
  // Путь из настройки принимается, только если это папка с доками.
  check(
    "путь из настройки проверяется по индексному файлу",
    src.indexOf("fs.existsSync(path.join(configured, INDEX_FILE))") !== -1
  );
}

// ------------------------------------------------------------
//  4. Экранирование: кавычки и угловые скобки в заголовке
// ------------------------------------------------------------
console.log("\nЭкранирование");
var tmp = path.join(require("os").tmpdir(), "cpp-docs-smoke-" + Date.now());
fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(
  path.join(tmp, "00-НАЧНИ-ОТСЮДА.md"),
  '# Заголовок с "кавычками" и <тегом>\n\n> Описание с "кавычками"\n',
  "utf8"
);
var captured2 = { commands: [], provider: null, viewId: null };
var ext2 = loadExtension(makeVscodeStub({ captured: captured2, docsPath: tmp, folders: [] }));
ext2.activate({ subscriptions: [], globalState: makeState() });
var html2 = renderHtml(captured2);

check("кавычки экранированы", html2.indexOf("&quot;") !== -1);
check("угловые скобки экранированы", html2.indexOf("&lt;тегом&gt;") !== -1);
check("сырой тег не попал в разметку", html2.indexOf("<тегом>") === -1);
fs.rmSync(tmp, { recursive: true, force: true });

// ------------------------------------------------------------
//  5. Нет документации — понятная заглушка
// ------------------------------------------------------------
console.log("\nПоведение без документации");
var captured3 = { commands: [], provider: null, viewId: null };
var ext3 = loadExtension(
  makeVscodeStub({ captured: captured3, docsPath: path.join(tmp, "нет-такой-папки"), folders: [] })
);
ext3.activate({ subscriptions: [], globalState: makeState() });
var html3 = renderHtml(captured3);
check("показана подсказка, а не пустая панель", html3.indexOf("не найдена") !== -1);
check("названа настройка пути", html3.indexOf("cppDocs.path") !== -1);
check("на пустом экране есть кнопка настроек", html3.indexOf("open-settings") !== -1);

// ------------------------------------------------------------
//  6. Плавающее окно: команды, данные, рантайм
// ------------------------------------------------------------
console.log("\nПлавающее окно");
check("команда подключить окно", captured.commands.indexOf("cppDocs.enableWindow") !== -1);
check("команда отключить окно", captured.commands.indexOf("cppDocs.disableWindow") !== -1);
check("команда проверить окно", captured.commands.indexOf("cppDocs.windowHealth") !== -1);
check("buildDocsData экспортирован", typeof ext.buildDocsData === "function");

if (typeof ext.buildDocsData === "function" && fs.existsSync(path.join(docsPath, "00-НАЧНИ-ОТСЮДА.md"))) {
  var data = ext.buildDocsData(docsPath);
  check("данные окна: список файлов", Array.isArray(data.files) && data.files.length >= 10, "файлов " + (data.files || []).length);
  var f0 = data.files[0] || {};
  check("у материала есть rel-путь", typeof f0.rel === "string" && f0.rel.length > 0);
  check("у материала есть текст (md)", typeof f0.md === "string" && f0.md.length > 0);
  check("у материала есть группа и цвет", !!f0.group && !!f0.groupColor);
  check("данные знают корень доков", typeof data.root === "string" && data.root.length > 0);
  // rel-пути на прямых слэшах (важно для сопоставления внутренних ссылок в окне)
  check("rel-пути без обратных слэшей", data.files.every(function (f) { return f.rel.indexOf("\\") === -1; }));
}

var runtimePath = path.join(EXT, "cpp-docs-runtime.js");
check("рантайм окна на месте", fs.existsSync(runtimePath));
if (fs.existsSync(runtimePath)) {
  var rt = fs.readFileSync(runtimePath, "utf8");
  check("рантайм: рендер Markdown", rt.indexOf("function renderMarkdown") !== -1);
  check("рантайм: подсветка C++", rt.indexOf("function highlightCpp") !== -1);
  check("рантайм: слаги как на GitHub", rt.indexOf("function slugify") !== -1);
  check("рантайм: перетаскивание окна", rt.indexOf("installDrag") !== -1);
  check("рантайм: изменение размера", rt.indexOf("installResize") !== -1);
  check("рантайм: кнопка «копировать код»", rt.indexOf("copybtn") !== -1);
  check("рантайм: переходы по внутренним ссылкам", rt.indexOf("resolveRel") !== -1);
  check("рантайм: защита от повторной инъекции", rt.indexOf("__CPPDOCS_RUNTIME__") !== -1);
  check("рантайм: читает данные из window.__CPPDOCS__", rt.indexOf("window.__CPPDOCS__") !== -1);
  check("рантайм: тема светлая/тёмная", rt.indexOf("function isLight") !== -1);
  check("рантайм: акцент под тему", rt.indexOf("function applyAccent") !== -1 && rt.indexOf("--cppdocs-ac") !== -1);
  check("рантайм: акцент из переменных оболочки", rt.indexOf("--mlbg-accent") !== -1 && rt.indexOf("--vscode-focusBorder") !== -1);

  // --- надёжность рантайма: подпорченное состояние из localStorage не ломает окно ---
  check("рантайм: словари состояния санируются (plainMap)", rt.indexOf("function plainMap") !== -1);
  check("рантайм: масштаб шрифта клампится в [0.8..1.6]", rt.indexOf("isFinite(state.fs)") !== -1 && rt.indexOf("Math.min(1.6") !== -1);
  check("рантайм: позиция/размер окна принимаются только числами", rt.indexOf('["x", "y", "w", "h"]') !== -1);

  // --- наклейки-иллюстрации (пустые состояния, приветствие, «всё изучено») ---
  check("рантайм: слоты наклеек и SVG-заглушки", rt.indexOf("function stickerMarkup") !== -1 && rt.indexOf("STICKER_SVG") !== -1);
  check("рантайм: маркеры для встраивания наклеек", rt.indexOf("STICKERS:start") !== -1 && rt.indexOf("STICKERS:end") !== -1);
  check("рантайм: наклейка в «ничего не найдено»", rt.indexOf('stickerMarkup("noresult"') !== -1);
  check("рантайм: наклейка в пустом навигаторе", rt.indexOf('stickerMarkup("empty"') !== -1);
  check("рантайм: поздравление наклейкой при 100%", rt.indexOf("cd-home-done") !== -1 && rt.indexOf("allDone") !== -1);
  check("рантайм: наклейка прогресса у приветствия (смайл→огонёк→корона)", rt.indexOf('done > 0 ? "progress"') !== -1);
}

// наклейки, вырезанные из emo.jpg, — стартовый набор в extension/stickers/
["welcome", "progress", "noresult", "empty", "done"].forEach(function (n) {
  check("наклейка " + n + ".png на месте", fs.existsSync(path.join(EXT, "stickers", n + ".png")));
});

var srcAll = fs.readFileSync(path.join(EXT, "extension.js"), "utf8");
check("окно: поддержан загрузчик custom-ui-style", srcAll.indexOf("custom-ui-style") !== -1);
check("окно: поддержан загрузчик be5invis", srcAll.indexOf("vscode_custom_css.imports") !== -1);
check("окно: генерация файла данных", srcAll.indexOf("function writeDocsData") !== -1);
check("окно: прописывание импорта", srcAll.indexOf("function ensureWindowImport") !== -1);
check("окно: удаление импорта", srcAll.indexOf("function removeWindowImport") !== -1);
check("окно: прямой патч оболочки без загрузчика", srcAll.indexOf("function enableWindow") !== -1 && srcAll.indexOf("function findWorkbenchFiles") !== -1);
check("окно: команда подключения ведёт на прямой патч", srcAll.indexOf("() => enableWindow(context)") !== -1);
check("окно: команда в манифесте", pkg.contributes.commands.some(function (c) { return c.command === "cppDocs.enableWindow"; }));
check("окно: кнопка в шапке панели", JSON.stringify(pkg.contributes.menus["view/title"]).indexOf("cppDocs.enableWindow") !== -1);

// ------------------------------------------------------------
//  7. Надёжность и защита от сбоев
// ------------------------------------------------------------
console.log("\nНадёжность");
check("openDoc проверяет наличие файла", srcAll.indexOf("Файл не найден (возможно") !== -1);
check("запасной путь, если превью Markdown недоступно", srcAll.indexOf("markdown.showPreview") !== -1 && srcAll.indexOf("расширение Markdown отключено") !== -1);
check("openAt защищён от исчезнувшего файла", (srcAll.match(/Файл не найден \(возможно/g) || []).length >= 2);
check("enableWindow предупреждает при провале записи данных", srcAll.indexOf("окну нечего показывать") !== -1);
check("windowHealth показывает состояние файла данных", srcAll.indexOf("Файл данных окна:") !== -1);

var pkgScript = fs.readFileSync(path.join(ROOT, "scripts", "package-extension.js"), "utf8");
check("упаковщик: предполётная проверка перед сборкой", pkgScript.indexOf("function preflight") !== -1);
check("упаковщик: проверяет синтаксис JS (node --check)", pkgScript.indexOf('"--check"') !== -1);
check("упаковщик: проверяет обязательные файлы", pkgScript.indexOf("нет обязательного файла") !== -1);
check("скрипт встраивания наклеек на месте", fs.existsSync(path.join(ROOT, "scripts", "embed-stickers.js")));

// ------------------------------------------------------------
console.log("\n" + (failures.length ? "ПРОВАЛОВ: " + failures.length : "Все проверки пройдены") +
            "  (" + checks + " шт.)");
if (failures.length) {
  failures.forEach(function (f) {
    console.log("  - " + f);
  });
  process.exit(1);
}
