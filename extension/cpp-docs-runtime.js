// ============================================================
//  Плавающее окно «Документация C++» — рантайм окна.
//
//  Этот файл НЕ запускается как расширение. Расширение (extension/lib/window.js)
//  впечатывает его целиком в оболочку VS Code (workbench.html) вместе с данными
//  window.__CPPDOCS__ — поэтому он один и без require. Перед впечатыванием его SHA-256
//  сверяется с якорем RUNTIME_SHA256 в extension.js: после правки этого файла
//  выполните  npm run hash:runtime.
//
//  Связь с расширением: файлы globalStorage окно ЧИТАЕТ по vscode-file:// (данные, метка
//  свежести, контекст редактора), а запросы («Запустить», «в редактор», «в заметки») и запись
//  зеркала прогресса идут через мост на 127.0.0.1 (lib/bridge.js); во вкладке — сообщениями.
//
//  Карта файла (ищите по тексту заголовка раздела):
//    Данные ............... «Данные: материалы приходят…» — форма и санитизация данных
//    Состояние ............ «Состояние окна (localStorage)» — отметки, закладки, настройки
//    Утилиты, наклейки .... «Мелкие утилиты», «Наклейки-иллюстрации»
//    Markdown ............. «Подсветка синтаксиса», «Рендер Markdown → HTML» и фенсы
//                           ```cards / fillcode / tests / live / challenge / snippets …
//    Тема и стиль ......... «Тема: светлая/тёмная», «Акцентный цвет», «Стиль окна»
//    Окно ................. «Построение окна»: перетаскивание, навигатор, поиск,
//                           оглавление, меню вида, вкладки, сплит, главный экран,
//                           «Обучение», открытие файла, маркер, задачник, заметки
//    Каналы ............... «Открыть / закрыть / обновить», «Действия окна → расширение»
//    Ошибки простым языком  «Ошибка компилятора простым языком» (ERR_RULES)
//    Кнопка и старт ....... «Плавающая кнопка-запуск + самолечение», «Старт»
//
//  Работает офлайн, без сети. Позиция окна, отметки и закладки — в localStorage.
// ============================================================
(function () {
  "use strict";

  // Один рантайм на окно: загрузчик может импортировать файл повторно (перезагрузка
  // окна, второй импорт) — второй раз ничего не делаем, иначе появятся две кнопки.
  if (window.__CPPDOCS_RUNTIME__) return;
  window.__CPPDOCS_RUNTIME__ = true;

  // Модуль Moon Core: окно встроено ядром (одна вставка на все плагины). Оглавление и адреса
  // файлов — в файле данных модуля (ядро читает его при старте), запросы и события — через
  // мост ядра, nonce — у нашего же <script>. Без Moon Core MCM = null и всё как раньше.
  var MCM = null, MC_NONCE = "";
  try { MC_NONCE = (document.currentScript && document.currentScript.nonce) || ""; } catch (e) {}
  try { MCM = window.__MOONCORE__ && typeof window.__MOONCORE__.module === "function" ? window.__MOONCORE__.module("cppdocs") : null; } catch (e) { MCM = null; }
  if (MCM && !window.__CPPDOCS__) {
    try { var mcd = MCM.data(); if (mcd && mcd.toc && typeof mcd.toc === "object") window.__CPPDOCS__ = mcd.toc; } catch (e) {}
  }
  // Подписки на окно и документ, которые снимаются, когда Moon Core выключает модуль без
  // перезагрузки окна (15-mooncore.js, cdStop). Без Moon Core просто addEventListener.
  var _cdOff = [];
  function cdOnGlobal(target, ev, fn, opt) {
    try {
      target.addEventListener(ev, fn, opt);
      _cdOff.push(function () { try { target.removeEventListener(ev, fn, opt); } catch (e) {} });
    } catch (e) {}
  }
  function cdTrack(fn) { if (typeof fn === "function") _cdOff.push(fn); }

  var WIN_ID = "cppdocs-window";
  var BTN_ID = "cppdocs-launch";
  var STYLE_ID = "cppdocs-style";
  /* PROTOCOL:start — генерируется из extension/lib/protocol.js, руками не править */
  var PROTO = {"VERSION":2,"METHODS":["run","action","log"],"WRITABLE":["cpp-docs-progress.json"],"EVENTS":["editor","stamp","data","theme","progress"],"EVENT_FILES":{"cpp-docs-editor.js":"editor","cpp-docs-stamp.js":"stamp","cpp-docs-progress.json":"progress"},"MAX_BODY":8388608,"MAX_CODE":200000,"MAX_TESTS":20,"MAX_LOG":4000,"RUN_TIMEOUT_MS":60000,"ACTION_TIMEOUT_MS":8000};
  /* PROTOCOL:end */
  var LS_KEY = "cppdocs.ui.v1";
  // Шрифты чтения — только те, что уже есть в системе (без встраивания, офлайн).
  var RFONTS = {
    system: { label: "Системный", stack: "" },
    serif:  { label: "Сериф",     stack: "Cambria, Georgia, 'PT Serif', 'Times New Roman', serif" },
    soft:   { label: "Мягкий",    stack: "Candara, 'Segoe UI', Optima, 'Trebuchet MS', system-ui, sans-serif" },
    round:  { label: "Округлый",  stack: "'Comic Sans MS', 'Segoe Print', 'Chalkboard SE', 'Comic Neue', cursive" },
    // Шрифты с хорошей кириллицей — ВСТРОЕНЫ в расширение (extension/fonts/*.woff2, лицензия OFL):
    // ставить их в систему не нужно. Имя «CppDocs …» — чтобы не спорить с установленной копией.
    inter:  { label: "Inter",     stack: "'CppDocs Inter', Inter, 'Segoe UI', system-ui, sans-serif", sample: "Чёткий и строгий" },
    ptsans: { label: "PT Sans",   stack: "'CppDocs PT Sans', 'PT Sans', 'Segoe UI', system-ui, sans-serif", sample: "Мягкий и книжный" },
    golos:  { label: "Golos",     stack: "'CppDocs Golos', 'Golos Text', 'Segoe UI', system-ui, sans-serif", sample: "Современный и живой" },
  };
  var VERSION = "3.5.2";
  // Идентификатор баннера «Что нового»: пока state.whatsnew !== этого значения — показываем баннер.
  var WHATSNEW = "landscapes-2026-09";
  // Логотип как data-URI. В оболочке VS Code рантайм не может грузить файл с диска, поэтому
  // картинка встроена. Значение подставляет `node scripts/embed-logo.js` из docs/screenshots/logo-embed.png.
  var LOGO_URI = "data:image/webp;base64,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";

  // ---------------------------------------------------------------------------
  //  Данные: материалы приходят из cpp-docs-data.js (window.__CPPDOCS__).
  // ---------------------------------------------------------------------------
  // Проверка формы + защита от prototype-pollution: контент из чужого воркспейса исполняется
  // в привилегированной оболочке, поэтому берём объект только ожидаемой формы и без опасных ключей.
  var BAD_KEYS = { "__proto__": 1, "constructor": 1, "prototype": 1 };
  // Режим «во вкладке»: тот же рантайм открыт в обычной вкладке VS Code (webview, lib/panel.js)
  // вместо впечатывания в оболочку — без правки VS Code и баннера «corrupt». Файлы тогда не
  // читаются вовсе: данные, контекст редактора и ответы приходят сообщениями от расширения,
  // записи уходят сообщением ему же.
  var IN_PANEL = false, VSC = null;
  try {
    if (window.__CPPDOCS_HOST__ === "webview" && typeof acquireVsCodeApi === "function") { VSC = acquireVsCodeApi(); IN_PANEL = true; }
  } catch (e) {}
  function looksSafe(d) {
    if (!d || typeof d !== "object" || Array.isArray(d)) return false;
    for (var k in BAD_KEYS) if (Object.prototype.hasOwnProperty.call(d, k)) return false;
    if (!Array.isArray(d.files)) return false;
    return true;
  }
  function DATA() {
    var d = window.__CPPDOCS__;
    return looksSafe(d) ? d : null;
  }

  // Данные, перечитанные из файла, приводим к строгой форме и режем переразмеренное: копируем
  // только ожидаемые поля нужного типа (лишние/опасные ключи отбрасываются). Инлайн-снимок при
  // старте — от расширения (доверенный), его не санируем.
  var CD_MAX_MD = 512 * 1024, CD_MAX_TOTAL_MD = 8 * 1024 * 1024, CD_MAX_FILES = 4000;
  function cdStr(v) { return typeof v === "string" ? v : (v == null ? "" : String(v)); }
  function cdNum(v) { return typeof v === "number" && isFinite(v) ? v : 0; }
  function sanitizeData(d) {
    if (!looksSafe(d)) return null;
    var out = {
      root: cdStr(d.root), indexFile: cdStr(d.indexFile),
      generatedAt: typeof d.generatedAt === "number" ? d.generatedAt : Date.now(),
      files: []
    };
    if (typeof d.dataUrl === "string") out.dataUrl = d.dataUrl;
    if (typeof d.stampUrl === "string") out.stampUrl = d.stampUrl;
    if (typeof d.editorUrl === "string") out.editorUrl = d.editorUrl;
    if (typeof d.stickersUrl === "string") out.stickersUrl = d.stickersUrl;
    if (typeof d.stickersAllUrl === "string") out.stickersAllUrl = d.stickersAllUrl;
    ["stickerImgs", "palStickerImgs"].forEach(function (k) {
      var v = d[k];
      if (v && typeof v === "object" && typeof v.base === "string" && v.files && typeof v.files === "object" && !Array.isArray(v.files)) {
        var files = {};
        Object.keys(v.files).slice(0, 400).forEach(function (n) { if (typeof v.files[n] === "string") files[n] = v.files[n]; });
        out[k] = { base: v.base, files: files };
      }
    });
    if (typeof d.progressUrl === "string") out.progressUrl = d.progressUrl;
    if (typeof d.bridgeUrl === "string") out.bridgeUrl = d.bridgeUrl;
    if (typeof d.extDirUrl === "string") out.extDirUrl = d.extDirUrl;
    if (typeof d.aliveUrl === "string") out.aliveUrl = d.aliveUrl;
    if (Array.isArray(d.bgImages)) out.bgImages = d.bgImages.filter(function (n) { return typeof n === "string" && /^bg-[a-z0-9-]{1,40}\.webp$/.test(n); }).slice(0, 40);
    if (d.run && typeof d.run === "object") out.run = { enabled: !!d.run.enabled };
    if (typeof d.scriptNonce === "string") out.scriptNonce = d.scriptNonce;
    if (typeof d.protocol === "number") out.protocol = d.protocol;
    var total = 0;
    for (var i = 0; i < d.files.length && out.files.length < CD_MAX_FILES; i++) {
      var f = d.files[i];
      if (!f || typeof f !== "object" || Array.isArray(f)) continue;
      var md = cdStr(f.md);
      if (md.length > CD_MAX_MD) md = md.slice(0, CD_MAX_MD);
      if (total + md.length > CD_MAX_TOTAL_MD) md = "";
      total += md.length;
      // индекс поиска (lib/docs.js searchSections): только строки, разумного размера
      var sx = [];
      if (Array.isArray(f.sx)) {
        for (var j = 0, sxLen = 0; j < f.sx.length && j < 400 && sxLen < CD_MAX_MD; j++) {
          var e = f.sx[j];
          if (!e || typeof e !== "object") continue;
          var x = cdStr(e.x).slice(0, CD_MAX_MD - sxLen);
          sxLen += x.length;
          sx.push({ s: cdStr(e.s).slice(0, 200), t: cdStr(e.t).slice(0, 300), x: x });
        }
      }
      out.files.push({
        rel: cdStr(f.rel), name: cdStr(f.name), title: cdStr(f.title), subtitle: cdStr(f.subtitle),
        group: cdStr(f.group), groupColor: cdStr(f.groupColor),
        minutes: cdNum(f.minutes), sections: cdNum(f.sections), md: md, sx: sx.length ? sx : null
      });
    }
    return out;
  }

  // nonce для CSP: кешируем из первого (инлайн) снимка данных и вешаем на динамически
  // создаваемые <script>/<style>, чтобы они проходили CSP, когда она есть. Внешний
  // data-файл nonce не несёт — помним его отсюда.
  var CD_NONCE = "";
  function applyNonce(elm) { if (CD_NONCE) { try { elm.setAttribute("nonce", CD_NONCE); } catch (e) {} } return elm; }

  // Карта rel-путь → файл (в нижнем регистре, ФС Windows нечувствительна к регистру).
  // Нужна для перехода по внутренним ссылкам вида (07-algoritmy.md#18-алгоритмы).
  function fileMap() {
    var map = {};
    var d = DATA();
    if (!d) return map;
    d.files.forEach(function (f) { map[String(f.rel || f.name).toLowerCase()] = f; });
    return map;
  }

  // ---------------------------------------------------------------------------
  //  Состояние окна (localStorage). Всё необязательно — при первом запуске пусто.
  // ---------------------------------------------------------------------------
  // Резервная копия: прогресс зеркалится в файл cpp-docs-progress.json хранилища расширения
  // (data.progressUrl). localStorage оболочки стирают сброс настроек, смена профиля или
  // загрузчика — тогда при старте берём зеркало. Берём его и когда оно новее (импорт из файла).
  var PROGRESS_FORMAT = "cppdocs-progress", progressRestored = false, _mirrorTimer = null;
  function progressUrl() { var d = DATA(); return (d && d.progressUrl) || bootVal("progressUrl"); }
  function unwrapProgress(txt) {
    var o = null;
    try { o = JSON.parse(txt); } catch (e) { return null; }
    var st = o && o.format === PROGRESS_FORMAT ? o.state : null;
    if (!st || typeof st !== "object" || Array.isArray(st)) return null;
    for (var k in BAD_KEYS) if (Object.prototype.hasOwnProperty.call(st, k)) return null;
    return st;
  }
  function readMirror() { var u = progressUrl(), txt = u ? fileRead(u) : null; return txt ? unwrapProgress(txt) : null; }
  function savedAtOf(s) { return s && typeof s._savedAt === "number" && isFinite(s._savedAt) ? s._savedAt : 0; }
  function loadState() {
    var s = {}, hadLs = false;
    try {
      var raw = localStorage.getItem(LS_KEY);
      hadLs = !!raw;
      s = raw ? JSON.parse(raw) : {};
      if (!s || typeof s !== "object" || Array.isArray(s)) s = {};
    } catch (e) { s = {}; }
    try {
      var m = readMirror();
      if (m && (!hadLs || savedAtOf(m) > savedAtOf(s))) {
        s = m; progressRestored = hadLs ? "import" : "restore";
        try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
      }
    } catch (e) {}
    return s;
  }
  // Записать зеркало. Не затираем более новое (импорт или другое окно VS Code записали позже нас).
  // Метку зеркала знаем из событий «progress» и своих записей (mirrorAt), а файл перечитываем
  // асинхронно — синхронный XHR на каждое сохранение подвисал бы главный поток VS Code.
  var mirrorAt = 0;
  function writeMirror(unloading) {
    _mirrorTimer = null;
    var u = progressUrl(); if (!u) return;
    function put() {
      if (mirrorAt > savedAtOf(state)) return;
      try {
        var text = JSON.stringify({ format: PROGRESS_FORMAT, version: 1, savedAt: savedAtOf(state), state: state });
        if (bridgeWrite(u, text, unloading)) mirrorAt = savedAtOf(state);   // у окна нет Node (песочница VS Code): пишет расширение
      } catch (e) {}
    }
    // При закрытии окна ждать нельзя — пишем по уже известной метке.
    if (unloading || IN_PANEL || typeof appReadAsync !== "function") { put(); return; }
    appReadAsync(u, function (txt) {
      var cur = txt ? unwrapProgress(txt) : null;
      if (cur) mirrorAt = Math.max(mirrorAt, savedAtOf(cur));
      put();
    });
  }
  // Прогресс поменяли снаружи (другое окно VS Code, боковая панель, импорт): приходит метка savedAt.
  // Новее нашей — перечитываем зеркало и берём прогресс оттуда.
  function onProgressEvent(txt) {
    var at = 0;
    try { var o = JSON.parse(String(txt)); at = o && typeof o.savedAt === "number" ? o.savedAt : 0; } catch (e) { return; }
    if (at) mirrorAt = Math.max(mirrorAt, at);
    if (!at || at <= savedAtOf(state)) return;
    var apply = function (m) {
      if (!m || savedAtOf(m) <= savedAtOf(state)) return;
      adoptProgress(m);
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
      try { onExternalProgress(); } catch (e) {}
    };
    if (IN_PANEL || typeof appReadAsync !== "function") { apply(readMirror()); return; }
    var u = progressUrl(); if (!u) return;
    appReadAsync(u, function (t) { apply(t ? unwrapProgress(t) : null); });
  }
  // При закрытии окна VS Code обычный fetch может оборваться — зеркало уходит через sendBeacon.
  function flushMirror() { if (_mirrorTimer) { clearTimeout(_mirrorTimer); writeMirror(true); } }
  // Плоский словарь { ключ: значение }. Всё прочее — массив, null, число из
  // подпорченного localStorage — заменяем пустым объектом, чтобы state.read[rel]=…
  // и Object.keys(state.pins) не падали и не вели себя странно.
  function plainMap(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  // ---- Схема состояния: версия, миграции, значения по умолчанию, подрезка ----
  // state.v — версия схемы. Старое состояние проходит миграции по порядку (1 → 2 → …), затем
  // нормализуется по SCHEMA: словари — только объекты, флаги — только булевы, числа — конечные и в
  // пределах. Всё, что растёт само (выделения, прокрутка, прочитанные разделы, дни), подрезается,
  // чтобы не упереться в лимит localStorage (~5 МБ на всё окно VS Code).
  var STATE_VERSION = 4;
  var MIGRATIONS = {
    // v1: выделения-маркер — были массивом строк, стали [{t, c}] (цвет y|p|g)
    1: function (s) {
      var hl = plainMap(s.hl);
      Object.keys(hl).forEach(function (rel) {
        var arr = hl[rel];
        if (!Array.isArray(arr)) { delete hl[rel]; return; }
        var out = [];
        arr.forEach(function (x) {
          if (typeof x === "string") out.push({ t: x, c: "y" });
          else if (x && typeof x.t === "string") out.push({ t: x.t, c: (x.c === "p" || x.c === "g" ? x.c : "y") });
        });
        if (out.length) hl[rel] = out; else delete hl[rel];
      });
      s.hl = hl;
    },
    // v2: раскладка отдельно для главной и для чтения — при чтении список материалов по умолчанию скрыт
    2: function (s) { if (s.layoutV !== 2) s.navHidden = true; delete s.layoutV; },
    // v3: дни активности — не флаг, а число действий за день (для тепловой карты)
    3: function (s) { var d = plainMap(s.days); Object.keys(d).forEach(function (k) { if (d[k] === true) d[k] = 1; }); s.days = d; },
    // v4: шрифт «PT Root» (не было в комплекте) заменён встроенным PT Sans
    4: function (s) { if (s.rfont === "ptroot") s.rfont = "ptsans"; },
  };
  function migrateState(s) {
    var v = typeof s.v === "number" && isFinite(s.v) ? s.v : (s.layoutV === 2 ? 2 : 0);   // до версий знаком была только layoutV
    if (v > STATE_VERSION) v = STATE_VERSION;             // состояние из более новой версии — не «откатываем»
    for (var n = v + 1; n <= STATE_VERSION; n++) { try { MIGRATIONS[n](s); } catch (e) {} }
    s.v = STATE_VERSION;
    return s;
  }
  // Словари прогресса и настроек: { ключ: … }.
  var MAP_KEYS = ["read", "stepsDone", "boss", "missed", "secSeen", "solved", "notes", "days", "pins", "collapsed",
    "cards", "scroll", "checks", "exams", "challenge", "hl", "marks", "dailyDone", "ach", "weekly", "records"];
  // Скаляры: [тип, по умолчанию, (для строк) допустимые значения].
  var SCALARS = {
    wide: ["boolean", false], dense: ["boolean", false], expandNotes: ["boolean", false], termHints: ["boolean", true],
    noAnim: ["boolean", false], noCelebrate: ["boolean", false], covers: ["boolean", true], docked: ["boolean", false],
    tourDone: ["boolean", false], focus: ["boolean", false], rolled: ["boolean", false], navHidden: ["boolean", true],
    navHiddenHome: ["boolean", false], codeWrap: ["boolean", false], bySection: ["boolean", false], repeatShowCode: ["boolean", false],
    navFilter: ["string", "all", ["all", "unread", "pinned", "noted"]],
    theme: ["string", "auto", ["auto", "light", "dark", "sepia"]],
    palette: ["string", "auto"], homeBg: ["string", "image", ["image", "stars", "none"]],
    rfont: ["string", "system"], lh: ["string", "normal", ["tight", "normal", "roomy"]],
    ghost: ["string", "off", ["off", "soft", "strong"]],
  };
  // Числа: [мин, макс, по умолчанию (undefined — поле удаляется, если кривое)].
  var NUMBERS = { fs: [0.8, 1.6, 1], codeFs: [11, 17, 0], x: [-10000, 100000], y: [-10000, 100000], w: [100, 100000], h: [100, 100000],
    btnX: [-10000, 100000], btnY: [-10000, 100000], dockW: [300, 10000] };
  function normalizeState(s) {
    MAP_KEYS.forEach(function (k) { s[k] = plainMap(s[k]); });
    Object.keys(SCALARS).forEach(function (k) {
      var d = SCALARS[k];
      if (typeof s[k] !== d[0] || (d[2] && d[2].indexOf(s[k]) === -1)) s[k] = d[1];
    });
    Object.keys(NUMBERS).forEach(function (k) {
      var d = NUMBERS[k];
      if (typeof s[k] === "number" && isFinite(s[k])) {
        if (k === "codeFs" && s[k] === 0) return;           // 0 = размер по умолчанию
        s[k] = Math.max(d[0], Math.min(d[1], s[k]));
      } else if (d[2] !== undefined) s[k] = d[2]; else delete s[k];
    });
    if (!Array.isArray(s.recent)) s.recent = [];
    s.recent = s.recent.filter(function (r) { return typeof r === "string"; }).slice(0, 50);
    if (!s.spot || typeof s.spot !== "object" || typeof s.spot.rel !== "string") delete s.spot;
    if (!s.daily || typeof s.daily !== "object" || typeof s.daily.id !== "string" || typeof s.daily.rel !== "string") delete s.daily;
    ["last", "warmupDone"].forEach(function (k) { if (typeof s[k] !== "string") delete s[k]; });
    return s;
  }
  // Подрезка растущих словарей. files — известные материалы (rel → true) или null (данных ещё нет).
  var PRUNE = { hlFiles: 300, hlPerFile: 60, scroll: 400, notes: 400, noteLen: 20000, days: 400, missed: 200, dailyDone: 400, marks: 500 };
  function keepLast(map, n) {   // ключи-даты («2026-09-27»): оставить n последних по сортировке ключей
    var keys = Object.keys(map);
    if (keys.length <= n) return;
    keys.sort().slice(0, keys.length - n).forEach(function (k) { delete map[k]; });
  }
  // Ключи-пути материалов: по алфавиту резать нельзя — пропали бы заметки к «01-…», а не старые.
  // Оставляем сперва недавно открытые (state.recent), дальше — по порядку добавления (новые в конце).
  function keepRecent(map, n, recent) {
    var keys = Object.keys(map);
    if (keys.length <= n) return;
    var rank = {};
    (recent || []).forEach(function (r, i) { var rel = String(r).split("#")[0]; if (rank[rel] === undefined) rank[rel] = i; });
    var ordered = keys.map(function (k, i) { var r = rank[String(k).split("#")[0]]; return { k: k, fresh: r === undefined ? -1 : r, i: i }; });
    ordered.sort(function (a, b) {
      if ((a.fresh >= 0) !== (b.fresh >= 0)) return a.fresh >= 0 ? -1 : 1;   // недавние — вперёд
      if (a.fresh >= 0) return a.fresh - b.fresh;
      return b.i - a.i;                                                        // прочие — новые вперёд
    });
    ordered.slice(n).forEach(function (x) { delete map[x.k]; });
  }
  function pruneState(s, files) {
    if (files) ["scroll", "secSeen", "hl", "notes"].forEach(function (k) {   // материал удалили из доков — его хвосты тоже
      Object.keys(s[k]).forEach(function (rel) { if (!files[rel]) delete s[k][rel]; });
    });
    Object.keys(s.hl).forEach(function (rel) { if (s.hl[rel].length > PRUNE.hlPerFile) s.hl[rel] = s.hl[rel].slice(-PRUNE.hlPerFile); });
    keepRecent(s.hl, PRUNE.hlFiles, s.recent);
    keepRecent(s.scroll, PRUNE.scroll, s.recent);
    keepRecent(s.notes, PRUNE.notes, s.recent);
    Object.keys(s.notes).forEach(function (rel) { if (typeof s.notes[rel] !== "string") delete s.notes[rel]; else if (s.notes[rel].length > PRUNE.noteLen) s.notes[rel] = s.notes[rel].slice(0, PRUNE.noteLen); });
    keepLast(s.days, PRUNE.days);
    keepLast(s.dailyDone, PRUNE.dailyDone);
    keepLast(s.records, PRUNE.dailyDone);
    keepLast(s.weekly, 104);
    keepRecent(s.missed, PRUNE.missed, null);
    keepRecent(s.marks, PRUNE.marks, s.recent);
    return s;
  }
  function knownFiles() {
    var d = DATA(); if (!d || !d.files.length) return null;
    var m = {}; d.files.forEach(function (f) { m[f.rel] = true; }); return m;
  }
  var state = pruneState(normalizeState(migrateState(loadState())), knownFiles());
  var _saves = 0;
  function saveState() {
    state._savedAt = Math.max(Date.now(), savedAtOf(state) + 1);   // монотонно: импорт ставит метку «на минуту вперёд»
    try { achOnSave(); } catch (e) {}                                  // новые достижения — в эту же запись
    if (++_saves % 50 === 0) { try { pruneState(state, knownFiles()); } catch (e) {} }   // растущее — подрезать изредка
    var text = JSON.stringify(state);
    // На пределе localStorage (~5 МБ на всё окно VS Code) — жертвуем восстановимым: прокрутка и
    // отметки прочитанных разделов. Прогресс (изучено, решено, карточки) не трогаем.
    if (text.length > 3 * 1024 * 1024) { state.scroll = {}; state.secSeen = {}; text = JSON.stringify(state); }
    try { localStorage.setItem(LS_KEY, text); } catch (e) {}
    if (!_mirrorTimer) _mirrorTimer = setTimeout(writeMirror, 1500);   // зеркало — пачкой, не на каждый клик
  }
  cdOnGlobal(window, "beforeunload", flushMirror);

  // Несколько окон VS Code делят один localStorage, но у каждого своё `state` в памяти: без
  // синхронизации окно B при сохранении затёрло бы отметки, сделанные в окне A. Событие storage
  // приходит в остальные окна — забираем оттуда прогресс (настройки вида у каждого окна свои).
  var PROGRESS_KEYS = ["dailyDone", "read", "stepsDone", "boss", "missed", "secSeen", "solved", "notes", "days", "pins",
    "cards", "checks", "exams", "challenge", "hl", "marks", "ach", "weekly", "records"];
  function adoptProgress(other) {
    PROGRESS_KEYS.forEach(function (k) { state[k] = plainMap(other[k]); });
    if (Array.isArray(other.recent)) state.recent = other.recent.slice(0, 50);
    if (typeof other.warmupDone === "string") state.warmupDone = other.warmupDone;
    if (other.spot && typeof other.spot === "object" && typeof other.spot.rel === "string") state.spot = other.spot;
    state._savedAt = Math.max(savedAtOf(state), savedAtOf(other));
  }
  try {
    cdOnGlobal(window, "storage", function (e) {
      if (!e || e.key !== LS_KEY || !e.newValue) return;
      var other = null;
      try { other = JSON.parse(e.newValue); } catch (x) { return; }
      if (!other || typeof other !== "object" || Array.isArray(other) || savedAtOf(other) <= savedAtOf(state)) return;
      for (var k in BAD_KEYS) if (Object.prototype.hasOwnProperty.call(other, k)) return;
      adoptProgress(other);
      try { onExternalProgress(); } catch (x) {}
    });
  } catch (e) {}
  if (progressRestored) setTimeout(function () {
    toast(progressRestored === "import" ? "Прогресс загружен из файла" : "Прогресс восстановлен из резервной копии");
  }, 3000);

  // ==== runtime/01-utils-stickers.js — мелкие утилиты, наклейки (встраиваются scripts/embed-stickers.js) ====
  // ---------------------------------------------------------------------------
  //  Мелкие утилиты.
  // ---------------------------------------------------------------------------
  // ---- HTML: одна точка вставки разметки ----
  // Всё, что окно вставляет как HTML, идёт через setHTML (правило ESLint запрещает innerHTML напрямую):
  //  • Trusted Types — чистая оболочка VS Code требует их («require-trusted-types-for 'script'»);
  //    политика «cppdocs» впускается в CSP при подключении окна (lib/wb-patch.js);
  //  • защита в глубину: даже если где-то забыли escapeHtml, <script>, обработчики on*=,
  //    javascript:-адреса и встраиваемые фреймы до DOM не доходят.
  var TT_POLICY = null;
  try {
    if (window.trustedTypes && typeof window.trustedTypes.createPolicy === "function") {
      TT_POLICY = window.trustedTypes.createPolicy("cppdocs", { createHTML: function (s) { return scrubHTML(s); } });
    }
  } catch (e) { TT_POLICY = null; }   // политика уже есть / имя не впущено CSP — остаётся строка
  var SCRUB_TAGS = /<\s*\/?\s*(script|iframe|frame|frameset|object|embed|base|meta|link)\b[^>]*>/gi;
  var SCRUB_ON = /(<[a-z][^>]*?)\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
  var SCRUB_JS = /(\s(?:href|src|xlink:href|action|formaction)\s*=\s*["']?)\s*(?:javascript|vbscript|data:text\/html)\s*:?/gi;
  function scrubHTML(s) {
    s = String(s == null ? "" : s);
    if (s.indexOf("<") === -1) return s;
    var prev;
    do { prev = s; s = s.replace(SCRUB_TAGS, "").replace(SCRUB_ON, "$1"); } while (s !== prev);   // вложенные попытки
    return s.replace(SCRUB_JS, "$1#");
  }
  function setHTML(node, html) {
    if (!node) return;
    // eslint-disable-next-line no-restricted-syntax -- единственное место, где разметка попадает в DOM
    node.innerHTML = TT_POLICY ? TT_POLICY.createHTML(String(html)) : scrubHTML(html);
  }
  // Шаблон с автоэкранированием: html`<b>${имя}</b>` — подстановки экранируются, готовая
  // разметка — через raw(…). Для нового кода вместо склейки строк.
  function raw(s) { return { __html: String(s == null ? "" : s) }; }
  function html(parts) {
    var out = parts[0];
    for (var i = 1; i < arguments.length; i++) {
      var v = arguments[i];
      out += (v && typeof v === "object" && typeof v.__html === "string" ? v.__html : escapeHtml(v == null ? "" : v)) + parts[i];
    }
    return out;
  }
  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  // Allowlist схем для href/src. Окно живёт в привилегированной оболочке, поэтому чужие
  // схемы (javascript:, data:, vbscript:, file: …) обезвреживаем: у ссылки → "#", у картинки → "".
  // Относительные пути, якоря и .md-ссылки — без схемы — пропускаем как есть.
  function safeUrl(u, forImg) {
    // Управляющие символы браузер при разборе URL отбрасывает: «\x01javascript:» стал бы схемой.
    var s = String(u).replace(/[\u0000-\u001F\u007F]+/g, "").trim();
    var m = s.match(/^([a-z][a-z0-9+.\-]*):/i);
    if (!m) return s;                                   // нет схемы — относительная/якорь
    var sch = m[1].toLowerCase();
    if (sch === "http" || sch === "https") return s;
    if (!forImg && sch === "mailto") return s;
    return forImg ? "" : "#";
  }
  // Русское окончание: 1 файл, 2 файла, 5 файлов.
  function plural(n, forms) {
    var d10 = n % 10, d100 = n % 100;
    if (d10 === 1 && d100 !== 11) return forms[0];
    if (d10 >= 2 && d10 <= 4 && (d100 < 10 || d100 >= 20)) return forms[1];
    return forms[2];
  }
  // Нормализация для поиска: без регистра и без различия ё/е.
  function norm(s) { return String(s).toLowerCase().replace(/ё/g, "е"); }

  // ---------------------------------------------------------------------------
  //  Наклейки-иллюстрации для пустых состояний и приветствия.
  //  Настоящие рисованные наклейки (растр) подставляет scripts/embed-stickers.js в
  //  объект STICKERS ниже — из PNG в extension/stickers/. Пока их нет, рисуем
  //  SVG-заглушку в том же «наклеечном» духе (толстый скруглённый контур, яркая заливка),
  //  чтобы место не пустовало. Ключи: welcome | noresult | empty | done.
  // ---------------------------------------------------------------------------
  // STICKERS:start
  var STICKERS = {"welcome":"data:image/webp;base64,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"};
  // STICKERS:end
  // Оболочка VS Code работает в песочнице: Node у окна может не быть, и прочитать .json с диска
  // нельзя. Картинки же оболочка отдаёт сама по vscode-file://vscode-app/<путь>. Расширение
  // раскладывает наклейки файлами и присылает { base: file:///…, files: { имя: файл } }.
  function imgsFromData(key) {
    var d = DATA(), m = (d && d[key]) || bootVal(key), out = {};
    if (!m || typeof m !== "object" || typeof m.base !== "string" || !m.files || typeof m.files !== "object") return null;
    var root = resUrl(String(m.base).replace(/\/+$/, ""));
    if (!root) return null;
    root += "/";
    Object.keys(m.files).forEach(function (k) {
      var f = m.files[k];
      if (/^[a-z0-9@-]{1,60}$/.test(k) && typeof f === "string" && /^[a-z0-9@-]{1,60}\.(webp|png|gif|jpg)$/.test(f)) out[k] = root + f;
    });
    return out;
  }
  // Остальные наклейки — в extension/stickers.json рядом с рантаймом (data.stickersAllUrl): рантайм
  // впечатывается в оболочку при каждом старте VS Code, и тащить в него ~300 КБ картинок незачем.
  // Первое обращение к наклейке, которой нет в STICKERS, один раз читает файл и докладывает всё в объект.
  // В превью (браузер, без Node) файл подкладывается готовым объектом window.__CPPDOCS_STICKERS__.
  STICKERS = (function (eager) {
    var loaded = false;
    function loadAll() {
      var obj = null;
      try {
        if (window.__CPPDOCS_STICKERS__ && typeof window.__CPPDOCS_STICKERS__ === "object") { obj = window.__CPPDOCS_STICKERS__; loaded = true; }
        else {
          var d = DATA(), url = (d && d.stickersAllUrl) || bootVal("stickersAllUrl");
          var files = imgsFromData("stickerImgs");
          if (!url && !files) return;       // данных окна ещё нет — попробуем при следующем обращении
          loaded = true;                    // читаем один раз (ничего нет — рисуем заглушки)
          if (files) {                      // адреса картинок-файлов: без чтения ~300 КБ JSON на главном потоке
            Object.keys(files).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(eager, k)) eager[k] = files[k]; });
            return;
          }
          var txt = url ? fileRead(url) : null;
          if (txt) obj = JSON.parse(txt);
        }
      } catch (e) { obj = null; }
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
      Object.keys(obj).forEach(function (k) {
        var v = obj[k];     // только наши ключи и только картинки data: — в src ничего другого не попадёт
        if (/^[a-z][a-z0-9-]{0,40}$/.test(k) && !Object.prototype.hasOwnProperty.call(eager, k) &&
          typeof v === "string" && /^data:image\/(webp|png|gif|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(v)) eager[k] = v;
      });
    }
    if (typeof Proxy !== "function") { loadAll(); return eager; }
    return new Proxy(eager, {
      get: function (t, k) { if (!loaded && typeof k === "string" && !Object.prototype.hasOwnProperty.call(t, k)) loadAll(); return t[k]; },
      has: function (t, k) { if (!loaded && typeof k === "string" && !Object.prototype.hasOwnProperty.call(t, k)) loadAll(); return k in t; },
    });
  })(STICKERS);
  var STICKER_SVG = {
    welcome: '<svg viewBox="0 0 100 100" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="46" cy="52" r="29" fill="var(--ac)" fill-opacity=".16" stroke="var(--ac)" stroke-width="5"/>' +
      '<circle cx="37" cy="48" r="3.4" fill="var(--ac)"/><circle cx="55" cy="48" r="3.4" fill="var(--ac)"/>' +
      '<path d="M35 60 q11 10 22 0" stroke="var(--ac)" stroke-width="5"/>' +
      '<path d="M79 17 l3.2 8.4 8.4 3.2 -8.4 3.2 -3.2 8.4 -3.2 -8.4 -8.4 -3.2 8.4 -3.2 z" fill="#eab308" stroke="#eab308" stroke-width="2"/>' +
      '</svg>',
    noresult: '<svg viewBox="0 0 100 100" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="43" cy="43" r="25" fill="var(--ac)" fill-opacity=".10" stroke="var(--ac)" stroke-width="6"/>' +
      '<path d="M61 61 L82 82" stroke="var(--ac)" stroke-width="8"/>' +
      '<path d="M36 38 q0 -9 8 -9 q9 0 9 8 q0 6 -7 8" stroke="var(--ac)" stroke-width="4.5"/>' +
      '<circle cx="46" cy="57" r="2.8" fill="var(--ac)"/>' +
      '</svg>',
    empty: '<svg viewBox="0 0 100 100" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M31 20 h27 l15 15 v42 a5 5 0 0 1 -5 5 h-37 a5 5 0 0 1 -5 -5 z" fill="var(--ac)" fill-opacity=".12" stroke="var(--ac)" stroke-width="5"/>' +
      '<path d="M57 20 v15 h15" stroke="var(--ac)" stroke-width="5"/>' +
      '<circle cx="43" cy="58" r="2.8" fill="var(--ac)"/><circle cx="59" cy="58" r="2.8" fill="var(--ac)"/>' +
      '<path d="M42 72 q9 -7 18 0" stroke="var(--ac)" stroke-width="4" opacity=".75"/>' +
      '</svg>',
    done: '<svg viewBox="0 0 100 100" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20 66 L28 34 L44 52 L52 28 L60 52 L76 34 L84 66 Z" fill="#eab308" fill-opacity=".22" stroke="#eab308" stroke-width="5"/>' +
      '<path d="M22 66 h60" stroke="#eab308" stroke-width="6"/>' +
      '<circle cx="52" cy="28" r="3.6" fill="#eab308"/>' +
      '<path d="M17 22 l2.2 6 6 2.2 -6 2.2 -2.2 6 -2.2 -6 -6 -2.2 6 -2.2 z" fill="var(--ac)" stroke="var(--ac)" stroke-width="1.5"/>' +
      '</svg>',
    progress: '<svg viewBox="0 0 100 100" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M52 15 C60 33 76 40 71 61 a21 21 0 0 1 -42 0 C26 47 39 45 39 31 C46 37 49 25 52 15 Z" fill="#f97316" fill-opacity=".18" stroke="#f97316" stroke-width="5"/>' +
      '<path d="M51 49 c7 6 9 13 4 19 a11 11 0 0 1 -13 -3 c-1 -7 5 -10 9 -16 Z" fill="#eab308" fill-opacity=".28" stroke="#eab308" stroke-width="3.5"/>' +
      '</svg>'
  };
  // Разметка наклейки: если встроена растровая (STICKERS[name]) — <img>, иначе SVG-заглушка.
  // Наклейки-значки под палитры лежат отдельным файлом (stickers-palettes.json): их около сотни,
  // а нужны 12 штук текущей палитры. Читаем файл с диска один раз, при первом запросе.
  var _palStickers = null;
  function parsePalStickers(txt) {
    var out = {}, obj;
    try { obj = JSON.parse(txt); } catch (e) { return out; }
    if (!obj || typeof obj !== "object") return out;
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      // только наши ключи и только картинки data: — в src ничего другого не попадёт
      if (/^ui-[a-z]+@[a-z]+$/.test(k) && typeof v === "string" && /^data:image\/(webp|png);base64,[A-Za-z0-9+\/=]+$/.test(v)) out[k] = v;
    });
    return out;
  }
  function palStickers() {
    if (_palStickers) return _palStickers;
    // Картинки-файлы по vscode-file:// — первыми: без синхронного чтения большого JSON.
    var files = imgsFromData("palStickerImgs");
    if (files) {
      _palStickers = {};
      Object.keys(files).forEach(function (k) { if (/^ui-[a-z]+@[a-z]+$/.test(k)) _palStickers[k] = files[k]; });
      return _palStickers;
    }
    var d = DATA(), url = (d && d.stickersUrl) || bootVal("stickersUrl");
    var txt = url ? fileRead(url) : null;
    if (!txt) return {};                 // файла нет (превью, старая сборка) — общий набор, без кэша
    _palStickers = parsePalStickers(txt);
    return _palStickers;
  }
  // Значок интерфейса: своя рисованная наклейка из STICKERS (слоты ui-*), иначе — прежний эмодзи.
  // Наклейки кладутся в extension/stickers/<имя>.webp и встраиваются npm run embed:stickers.
  function emo(name, fallback) {
    var S = typeof STICKERS !== "undefined" && STICKERS;
    // Сначала вариант под текущую палитру (из stickers-palettes.json), затем общий встроенный.
    var P = state.palette && state.palette !== "auto" ? palStickers() : null;
    var uri = (P && P[name + "@" + state.palette]) || (S && S[name]);
    return uri ? '<img class="cd-emo" src="' + uri + '" alt="" draggable="false">' : fallback;
  }
  function stickerMarkup(name, size) {
    size = size || 84;
    var uri = STICKERS && STICKERS[name];
    if (uri) return '<img class="cd-sticker" src="' + uri + '" alt="" style="width:' + size + 'px;height:' + size + 'px" draggable="false">';
    return '<span class="cd-sticker cd-sticker-svg" style="width:' + size + 'px;height:' + size + 'px" aria-hidden="true">' +
      (STICKER_SVG[name] || STICKER_SVG.welcome) + '</span>';
  }

  // Слаг заголовка, совместимый с якорями GitHub/GFM (и кириллицей): в нижний
  // регистр, убрать всё кроме букв/цифр/пробела/дефиса/подчёркивания, пробелы → дефис.
  // Двойные дефисы НЕ схлопываем — так же делает GitHub (это важно для наших якорей).
  function slugify(text) {
    return String(text)
      .replace(/`([^`]*)`/g, "$1")             // код в заголовке — по содержимому
      .replace(/\*\*/g, "").replace(/\*/g, "") // снять жирный/курсив
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // ссылку — по её тексту
      .toLowerCase()
      .replace(/[^\p{L}\p{N} \-_]/gu, "")
      .replace(/ /g, "-");
  }

  // ==== runtime/02-blocks.js — подсветка кода и интерактивные блоки: quiz, cards, live, steps, memory, frames, challenge… ====
  // ---------------------------------------------------------------------------
  //  Подсветка синтаксиса.
  // ---------------------------------------------------------------------------
  var CPP_KEYWORDS = {};
  ("alignas alignof and and_eq asm auto bitand bitor break case catch class compl concept " +
   "const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype " +
   "default delete do dynamic_cast else enum explicit export extern false final for friend goto if " +
   "import inline mutable namespace new noexcept not not_eq nullptr operator or or_eq override private " +
   "protected public reinterpret_cast requires return sizeof static static_assert static_cast struct " +
   "switch template this thread_local throw true try typedef typeid typename union using virtual " +
   "volatile while xor xor_eq")
    .split(" ").forEach(function (k) { CPP_KEYWORDS[k] = 1; });
  var CPP_TYPES = {};
  ("bool char char8_t char16_t char32_t double float int long short signed unsigned void wchar_t " +
   "size_t ssize_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t std string " +
   "wstring string_view vector map unordered_map set unordered_set array pair tuple optional variant " +
   "span ranges views ostream istream ifstream ofstream stringstream initializer_list " +
   "shared_ptr unique_ptr weak_ptr function")
    .split(" ").forEach(function (k) { CPP_TYPES[k] = 1; });

  // Токенайзер C++: комментарии, строки/символы, директивы препроцессора, числа,
  // идентификаторы (ключевые слова/типы/функции). Всё между совпадениями — экранируется
  // как есть (операторы, пунктуация, пробелы). Результат — безопасный HTML.
  function highlightCpp(code) {
    var re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(^[ \t]*#[a-zA-Z_]+)|(\b\d[\w.']*\b)|([A-Za-z_]\w*)/gm;
    var out = "", last = 0, m;
    while ((m = re.exec(code))) {
      if (m.index > last) out += escapeHtml(code.slice(last, m.index));
      var txt = m[0];
      if (m[1]) out += '<span class="tc">' + escapeHtml(txt) + "</span>";        // комментарий
      else if (m[2]) out += '<span class="ts">' + escapeHtml(txt) + "</span>";   // строка/символ
      else if (m[3]) out += '<span class="tp">' + escapeHtml(txt) + "</span>";   // #директива
      else if (m[4]) out += '<span class="tn">' + escapeHtml(txt) + "</span>";   // число
      else {                                                                     // идентификатор
        var cls = CPP_KEYWORDS[txt] ? "tk" : CPP_TYPES[txt] ? "ty" : null;
        // Имя перед «(» подсветим как вызов функции (не ключевое слово/тип).
        if (!cls) {
          var after = code.slice(m.index + txt.length);
          if (/^\s*\(/.test(after)) cls = "tf";
        }
        out += cls ? '<span class="' + cls + '">' + escapeHtml(txt) + "</span>" : escapeHtml(txt);
      }
      last = re.lastIndex;
    }
    if (last < code.length) out += escapeHtml(code.slice(last));
    return out;
  }
  // Bash: комментарии, строки, флаги. Остальное — как есть.
  function highlightBash(code) {
    var re = /((?:^|\s)#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')|((?:^|\s)--?[A-Za-z][\w-]*)/gm;
    var out = "", last = 0, m;
    while ((m = re.exec(code))) {
      if (m.index > last) out += escapeHtml(code.slice(last, m.index));
      if (m[1]) out += '<span class="tc">' + escapeHtml(m[0]) + "</span>";
      else if (m[2]) out += '<span class="ts">' + escapeHtml(m[0]) + "</span>";
      else out += '<span class="tp">' + escapeHtml(m[0]) + "</span>";
      last = re.lastIndex;
    }
    if (last < code.length) out += escapeHtml(code.slice(last));
    return out;
  }
  function highlight(code, lang) {
    lang = (lang || "").toLowerCase();
    if (lang === "cpp" || lang === "c++" || lang === "c" || lang === "h" || lang === "hpp") return highlightCpp(code);
    if (lang === "bash" || lang === "sh" || lang === "shell" || lang === "console") return highlightBash(code);
    return escapeHtml(code); // прочее (вывод программы, текст) — без подсветки
  }

  // ---------------------------------------------------------------------------
  //  Рендер Markdown → HTML (подмножество, которое реально используют доки).
  // ---------------------------------------------------------------------------

  // Инлайн-разметка внутри строки текста: код, ссылки, картинки, жирный.
  // Порядок важен: сперва вынимаем `код` в плейсхолдеры (в нём не должно быть
  // никакой другой разметки), потом экранируем HTML, потом ссылки/жирный, потом
  // возвращаем код обратно. Курсив «_» намеренно не трогаем — иначе распадаются
  // идентификаторы вроде std::size_t и static_cast.
  function inline(text) {
    var codes = [];
    text = String(text).replace(/`([^`]+)`/g, function (_, c) {
      codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000";
    });
    text = escapeHtml(text);
    // Картинки ![alt](src) — до ссылок. Схему src фильтруем (см. safeUrl).
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, function (_, alt, src) {
      return '<img alt="' + alt + '" data-src="' + safeUrl(src, true) + '">';
    });
    // Ссылки [текст](url "title") — только безопасные схемы, иначе ссылка обезврежена.
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, function (_, label, href) {
      return '<a href="' + safeUrl(href, false) + '">' + label + "</a>";
    });
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    // Зачёркивание ~~текст~~ → <del>. Двойная тильда в C++ не встречается (одиночная ~ —
    // побитовое НЕ — сюда не попадает: инлайн-код уже вынут в плейсхолдеры выше).
    text = text.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    // Вернуть код на место.
    text = text.replace(/\u0000(\d+)\u0000/g, function (_, i) {
      return "<code>" + escapeHtml(codes[+i]) + "</code>";
    });
    // Мелкая подпись <sub>…</sub> (например, легенда сложности в задачнике). Сырой HTML
    // экранирован, поэтому возвращаем в жизнь только эти безопасные теги — как <small>.
    text = text.replace(/&lt;sub&gt;/g, '<small class="cd-cap">').replace(/&lt;\/sub&gt;/g, "</small>");
    // Значки сложности 🟢🟡🔴 → аккуратные цветные чипы (легче сканировать).
    text = text
      .replace(/🟢/g, '<span class="cd-diff d-e" title="лёгкая"></span>')
      .replace(/🟡/g, '<span class="cd-diff d-m" title="средняя"></span>')
      .replace(/🔴/g, '<span class="cd-diff d-h" title="трудная"></span>')
      .replace(/🔥/g, '<span class="cd-diff d-x" title="челлендж темы">🔥</span>')
      .replace(/🔗/g, '<span class="cd-chain" title="звено сквозной цепочки «Журнал забегов» — задача на стык тем">🔗</span>');
    return text;
  }

  // Разбить таблицу на ячейки строки «| a | b |».
  function tableCells(line) {
    var t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    // Разделяем по «|», не считая экранированные «\|».
    var cells = t.split(/(?<!\\)\|/).map(function (c) { return c.replace(/\\\|/g, "|").trim(); });
    return cells;
  }
  function isTableSep(line) {
    return /^\s*\|?[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)*\|?\s*$/.test(line);
  }

  // headings — накопитель заголовков файла для оглавления (заполняется по ходу рендера).
  /* CD_ICONS:start */ var CD_ICONS = {"book":"data:image/webp;base64,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","play":"data:image/webp;base64,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","bulb":"data:image/webp;base64,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","attention":"data:image/webp;base64,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","star":"data:image/webp;base64,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","magnifier":"data:image/webp;base64,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"}; /* CD_ICONS:end */
  // Цвет врезки-callout по её полужирной метке (задачник — без эмодзи). → [border, bg] или null.
  function calloutColorByLabel(raw) {                          // → [border, bg, iconKey]
    var s = String(raw || "").toLowerCase().replace(/[\s.:!?»«()]+$/g, "").trim();
    if (s.indexOf("бонус") === 0) return ["#a6e3a1", "rgba(166,227,161,.12)", "star"];            // зелёный — на десерт
    var WARN = ["осторожно", "переполнение", "выбор типа", "тип данных", "по значению или по ссылке"];
    var HINT = ["как подступиться"];
    var LIVE = ["в живых программах", "в целой программе", "в целых программах", "тот же приём в целой программе"];
    var REF = ["теория темы", "мало подсказки"];
    if (WARN.indexOf(s) >= 0) return ["#f9b47a", "rgba(249,180,122,.12)", "attention"];           // янтарный — ловушка
    if (HINT.indexOf(s) >= 0) return ["#f9e2af", "rgba(249,226,175,.12)", "bulb"];                // жёлтый — как подступиться
    if (LIVE.indexOf(s) >= 0) return ["#74c7ec", "rgba(116,199,236,.12)", "play"];               // небесный — живые программы
    if (REF.indexOf(s) >= 0) return ["#89b4fa", "rgba(137,180,250,.12)", "book"];                 // синий — теория
    return ["#b4befe", "rgba(180,190,254,.10)", "magnifier"];                                     // лаванда — разбор/прочее
  }

  // Интерактивный опросник ```quiz — вопросы с выбором ответа.
  // Формат: «В: текст» (или Q:) → вопрос; «+ вариант» (верный) / «- вариант»;
  // «= пояснение» (показывается после ответа / по кнопке «Показать ответ»).
  // Итоговая проверка этапа: первая строка опросника «@exam id темы» (например «@exam etap-1-2 1-3»).
  // Засчитывается ПЕРВЫЙ ответ на каждый вопрос («Показать ответ» — как неверный); ≥ 80 % — зачёт.
  var EXAM_PASS = 0.8;
  function parseTopics(spec) {
    var out = [];
    String(spec || "").split(",").forEach(function (part) {
      var m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!m) return;
      for (var n = +m[1]; n <= +(m[2] || m[1]) && n < 100; n++) out.push(n);
    });
    return out;
  }
  function renderQuiz(src) {
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n");
    var exam = null;
    var em = (lines[0] || "").trim().match(/^@exam\s+([\w-]+)(?:\s+([\d,\s-]+))?\s*$/);
    if (em) { exam = { id: em[1], topics: parseTopics(em[2]) }; lines.shift(); }
    var qs = [], cur = null;
    function flush() { if (cur && (cur.text.length || cur.opts.length)) qs.push(cur); cur = null; }
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      var mq = t.match(/^(?:В|Q|Вопрос)\s*[:.)]\s*(.*)$/i);
      if (mq) { flush(); cur = { text: [mq[1]], opts: [], expl: [] }; continue; }
      if (!cur) { if (t) cur = { text: [t], opts: [], expl: [] }; continue; }
      var mo = t.match(/^([+\-])\s+(.*)$/);
      if (mo) { cur.opts.push({ ok: mo[1] === "+", text: mo[2] }); continue; }
      var me = t.match(/^[=>]\s+(.*)$/);
      if (me) { cur.expl.push(me[1]); continue; }
      if (!t) continue;
      if (cur.opts.length) cur.expl.push(t); else cur.text.push(t);
    }
    flush();
    var html;
    if (exam) {
      var rec = state.exams[exam.id];
      html = '<div class="cd-quiz cd-exam" data-exam="' + escapeHtml(exam.id) + '" data-topics="' + escapeHtml(exam.topics.join(",")) + '" data-total="' + qs.length + '">' +
        '<div class="cd-quiz-head">Итоговая проверка' +
        (rec && rec.passed ? ' <span class="cd-exam-badge">зачтено · лучший результат ' + rec.best + " из " + rec.total + "</span>" : "") + "</div>" +
        '<div class="cd-exam-rule">Засчитывается первый ответ на каждый вопрос. Зачёт — от ' + Math.ceil(qs.length * EXAM_PASS) + " верных из " + qs.length + ".</div>";
    } else {
      html = '<div class="cd-quiz"><div class="cd-quiz-head">Проверь себя</div>';
    }
    qs.forEach(function (q, qi) {
      var right = q.opts.filter(function (o) { return o.ok; }).map(function (o) { return o.text; }).join("; ");
      html += '<div class="cd-quiz-q" data-mq="' + encodeURIComponent(q.text.join(" ")) + '" data-ma="' +
        encodeURIComponent(right + (q.expl.length ? " — " + q.expl.join(" ") : "")) + '">';
      html += '<div class="cd-quiz-qt"><span class="cd-quiz-n">' + (qi + 1) + '.</span> ' + inline(q.text.join(" ")) + "</div>";
      html += '<div class="cd-quiz-opts">';
      q.opts.forEach(function (o) {
        html += '<button class="cd-quiz-opt" type="button" data-ok="' + (o.ok ? "1" : "0") +
          '"><span class="cd-quiz-mark"></span><span class="cd-quiz-ot">' + inline(o.text) + "</span></button>";
      });
      html += "</div>";
      if (q.expl.length) html += '<div class="cd-quiz-expl" hidden>' + inline(q.expl.join(" ")) + "</div>";
      html += '<button class="cd-quiz-reveal" type="button">Показать ответ</button>';
      html += "</div>";
    });
    if (exam) html += '<div class="cd-exam-res" hidden></div>';
    return html + "</div>";
  }

  // Задание «найди ошибку» ```findbug — код (сверху) + ответ (после строки ---), скрытый до клика.
  function renderFindbug(src) {
    var s = String(src).replace(/\r\n?/g, "\n").split("\n");
    var code = [], ans = [], inAns = false;
    for (var i = 0; i < s.length; i++) {
      if (!inAns && /^\s*(---|===)\s*$/.test(s[i])) { inAns = true; continue; }
      if (inAns) ans.push(s[i]); else code.push(s[i]);
    }
    var codeStr = code.join("\n").replace(/^\n+|\n+$/g, "");
    var ansStr = ans.join("\n").trim();
    var html = '<div class="cd-fb"><div class="cd-fb-head">Найди ошибку</div>' +
      '<pre class="code cd-fb-code"><code>' + highlight(codeStr, "cpp") + "</code></pre>";
    if (ansStr) {
      html += '<button class="cd-fb-reveal" type="button">Показать ответ</button>' +
        '<div class="cd-fb-ans" hidden>' + renderMarkdown(ansStr, null) + "</div>";
    }
    return html + "</div>";
  }

  // ---- Флеш-карточки ```cards с интервальным повторением ----
  function cdHash(s) { var h = 5381, i = String(s).length; while (i) h = (h * 33) ^ String(s).charCodeAt(--i); return "c" + (h >>> 0).toString(36); }
  // Постоянный ключ блока: строка «@id <ключ>» внутри ```challenge/```steps/```boss. Без неё ключ —
  // хэш текста, и любая правка задания сбрасывала бы отметку «решено». scripts/stamp-ids.js ставит
  // @id, равный ТЕКУЩЕМУ хэшу (без строки @id), — поэтому у тех, кто уже решал, ничего не теряется.
  var FENCE_ID_RE = /^[ \t]*@id[ \t]+([A-Za-z0-9_-]{1,40})[ \t]*(?:\n|$)/m;
  function fenceKey(raw, hashOf) {
    var m = String(raw).match(FENCE_ID_RE);
    var body = m ? String(raw).replace(FENCE_ID_RE, "") : String(raw);
    return { id: m ? m[1] : cdHash(hashOf ? hashOf(body) : body), body: body };
  }
  // «{3,5-7}» из инфостроки ограждения → { 3:true, 5:true, 6:true, 7:true }. Нет фигурных скобок — null.
  function parseHlLines(spec) {
    if (!spec) return null;
    var body = spec.replace(/[{}\s]/g, ""); if (!body) return null;
    var set = {};
    body.split(",").forEach(function (part) {
      if (!part) return;
      var r = part.split("-");
      if (r.length === 2) { var a = +r[0], b = +r[1]; if (a && b) for (var n = a; n <= b; n++) set[n] = true; }
      else { var v = +part; if (v) set[v] = true; }
    });
    return Object.keys(set).length ? set : null;
  }
  function cdDate(offset) { var d = new Date(); if (offset) d.setDate(d.getDate() + offset); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function cdCardState(id) {
    var rec = state.cards[id];
    if (!rec || !rec.due) return { status: "new" };
    var t = cdDate(0);
    if (rec.due <= t) return { status: "due" };
    var dd = Math.round((new Date(rec.due) - new Date(t)) / 86400000);
    return { status: "later", days: dd };
  }
  // Что будет с интервалом при оценке g — без сохранения (подпись на кнопке «Помню · через 2 дн.»).
  function cdPreview(id, grade) {
    var rec = state.cards[id] || { ivl: 0, ease: 2.3 };
    if (grade === 0) return 1;
    if (grade === 1) return Math.max(1, Math.round((rec.ivl || 1) * 1.3));
    return rec.ivl ? Math.round(rec.ivl * (rec.ease || 2.3)) : 2;
  }
  function ivlLabel(days) {
    if (days <= 1) return "завтра";
    if (days < 31) return "через " + days + " дн.";
    var mo = Math.round(days / 30);
    return "через " + mo + " мес.";
  }
  function cdSchedule(id, grade) {
    var rec = state.cards[id] || { ivl: 0, ease: 2.3 };
    if (grade === 0) { rec.ivl = 1; rec.ease = Math.max(1.6, (rec.ease || 2.3) - 0.2); }
    else if (grade === 1) { rec.ivl = Math.max(1, Math.round((rec.ivl || 1) * 1.3)); }
    else { rec.ivl = rec.ivl ? Math.round(rec.ivl * (rec.ease || 2.3)) : 2; rec.ease = Math.min(3.0, (rec.ease || 2.3) + 0.05); }
    rec.due = cdDate(rec.ivl);
    state.cards[id] = rec; saveState();
    return rec.ivl;
  }
  // ---- Карточки ```cards: колода — по одной карточке, переворот, оценка «помню/трудно/не помню» ----
  // Формат: «Q: вопрос» / «A: ответ», необязательная «H: подсказка» (или «Подсказка:»), пустая строка — следующая.
  function renderCards(src) {
    var cards = parseCards(src), n = cards.length;
    if (!n) return "";
    var due = 0, neu = 0, items = "", dots = "";
    var GR = [["Не помню", "g0"], ["Трудно", "g1"], ["Помню", "g2"]];
    cards.forEach(function (c, i) {
      var qtext = c.q.join(" "), id = cdHash(qtext), st = cdCardState(id);
      if (st.status === "due") due++; else if (st.status === "new") neu++;
      var badge = st.status === "due" ? '<span class="cd-dc-due due">пора повторить</span>'
        : st.status === "new" ? '<span class="cd-dc-due neu">новая</span>'
        : '<span class="cd-dc-due lat">повтор ' + ivlLabel(st.days) + "</span>";
      var hint = c.h && c.h.length ? c.h.join(" ") : "";
      var rate = GR.map(function (g, k) {
        return '<button class="cd-dk-btn ' + g[1] + '" type="button" data-g="' + k + '"><b>' + g[0] + "</b><small>" + ivlLabel(cdPreview(id, k)) + "</small></button>";
      }).join("");
      items += '<div class="cd-dcard' + (i ? "" : " cur") + '" data-id="' + id + '" data-i="' + i + '">' +
        '<div class="cd-dc-in">' +
        '<div class="cd-dc-face cd-dc-front">' +
        '<div class="cd-dc-top"><span class="cd-dc-num">' + (i + 1) + " / " + n + "</span>" + badge + "</div>" +
        '<div class="cd-dc-q">' + inline(qtext) + "</div>" +
        (hint ? '<div class="cd-dc-hint" hidden><span aria-hidden="true">' + emo("ui-hint", "💡") + "</span> " + inline(hint) + "</div>" : "") +
        '<div class="cd-dc-ctl">' + (hint ? '<button class="cd-dc-hintbtn" type="button">' + emo("ui-hint", "💡") + " Подсказка</button>" : "") +
        '<button class="cd-dc-flip" type="button">Перевернуть ↻</button></div></div>' +
        '<div class="cd-dc-face cd-dc-back">' +
        '<div class="cd-dc-top"><span class="cd-dc-num">ответ</span><button class="cd-dc-unflip" type="button" title="Снова вопрос">↺ вопрос</button></div>' +
        '<div class="cd-dc-qs">' + inline(qtext) + "</div>" +
        '<div class="cd-dc-a">' + inline(c.a.join(" ")) + "</div>" +
        '<div class="cd-dc-rlbl">Насколько легко вспомнил?</div><div class="cd-dc-rate">' + rate + "</div></div>" +
        "</div></div>";
      dots += '<button class="cd-dk-dot' + (i ? "" : " cur") + " st-" + st.status + '" type="button" data-i="' + i + '" title="Карточка ' + (i + 1) + '"></button>';
    });
    return '<div class="cd-deck" data-n="' + n + '">' +
      '<div class="cd-dk-head"><div class="cd-dk-t"><span class="cd-dk-ic" aria-hidden="true">' + emo("ui-deck", "🃏") + '</span>Карточки темы<span class="cd-dk-cnt">' + n + "</span></div>" +
      '<div class="cd-dk-meta">' + (due ? '<span class="due">' + due + " пора повторить</span>" : "") +
      (neu ? '<span class="neu">' + neu + " " + plural(neu, ["новая", "новые", "новых"]) + "</span>" : "") + "</div>" +
      '<button class="cd-dk-shuffle" type="button" title="Перемешать порядок карточек">' + emo("ui-shuffle", "🔀") + ' Перемешать</button></div>' +
      '<div class="cd-dk-dots">' + dots + "</div>" +
      '<div class="cd-dk-prog"><i></i></div>' +
      '<div class="cd-dk-stage">' + items + "</div>" +
      '<div class="cd-dk-nav"><button class="cd-dk-prev" type="button" disabled>‹ Назад</button>' +
      '<span class="cd-dk-pos">1 из ' + n + '</span><button class="cd-dk-next" type="button"' + (n > 1 ? "" : " disabled") + ">Дальше ›</button></div>" +
      '<div class="cd-dk-sum" hidden></div></div>';
  }

  // ---- «Заполни пропуск» ```fillcode : код с [[ответами]] ----
  function renderFillcode(src) {
    var code = String(src).replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
    var parts = code.split(/\[\[(.*?)\]\]/);   // чёт — текст, нечёт — ответ
    var body = "";
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 0) body += escapeHtml(parts[i]);
      else body += '<input class="cd-fc-in" type="text" spellcheck="false" data-a="' + escapeHtml(parts[i]) + '" size="' + Math.max(3, parts[i].length + 1) + '">';
    }
    return '<div class="cd-fc"><div class="cd-fc-head">Заполни пропуск</div>' +
      '<pre class="code cd-fc-code"><code>' + body + "</code></pre>" +
      '<div class="cd-fc-ctl"><button class="cd-fc-check" type="button">Проверить</button>' +
      '<button class="cd-fc-reveal" type="button">Показать ответ</button><span class="cd-fc-msg"></span></div></div>';
  }

  // ---- Лесенка подсказок задачника ```hints : строки «Идея: …», «План: …», «Ключ: …» ----
  // Ступени открываются по одной: сначала идея без кода, потом план, потом одна ключевая строка.
  var LADDER_IC = { "идея": "💡", "план": "🧭", "ключ": "🔑" };
  function renderHintsLadder(src) {
    var steps = [];
    String(src).replace(/\r\n?/g, "\n").split("\n").forEach(function (ln) {
      var m = ln.match(/^\s*([^:：]{1,20})[:：]\s*(.+)$/);
      if (m) steps.push({ label: m[1].trim(), text: m[2].trim() });
      else if (ln.trim() && steps.length) steps[steps.length - 1].text += " " + ln.trim();
    });
    if (!steps.length) return "";
    var ic = function (st) { return LADDER_IC[st.label.toLowerCase()] || "•"; };
    var h = '<div class="cd-ladder" data-shown="0" data-total="' + steps.length + '">' +
      '<div class="cd-ladder-head"><span class="cd-ladder-t">Подсказки</span><span class="cd-ladder-sub">открывайте по одной — сначала попробуйте с первой</span>' +
      '<span class="cd-ladder-dots" aria-hidden="true">' + steps.map(function () { return "<i></i>"; }).join("") + "</span></div>";
    steps.forEach(function (st, i) {
      h += '<div class="cd-lstep" data-i="' + i + '" hidden><span class="cd-lstep-ic" aria-hidden="true">' + ic(st) + "</span>" +
        '<div class="cd-lstep-b"><span class="cd-lstep-l">' + escapeHtml(st.label) + "</span>" + inline(st.text) + "</div></div>";
    });
    h += '<button class="cd-ladder-next" type="button" data-labels="' + escapeHtml(JSON.stringify(steps.map(function (st) { return ic(st) + " " + st.label; }))) + '">' +
      ic(steps[0]) + " Открыть: " + escapeHtml(steps[0].label.toLowerCase()) + "</button></div>";
    return h;
  }
  function ladderNext(btn) {
    var box = btn.closest(".cd-ladder"); if (!box) return;
    var list = box.querySelectorAll(".cd-lstep"), shown = +box.getAttribute("data-shown") || 0;
    if (shown >= list.length) return;
    list[shown].hidden = false;
    list[shown].classList.add("cd-lstep-in");
    shown++;
    box.setAttribute("data-shown", String(shown));
    var dots = box.querySelectorAll(".cd-ladder-dots i");
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("on", i < shown);
    var labels = []; try { labels = JSON.parse(btn.getAttribute("data-labels") || "[]"); } catch (e) {}
    if (shown >= list.length) { btn.hidden = true; box.classList.add("done"); }
    else btn.textContent = (labels[shown] || "Дальше").replace(/^(\S+) (.*)$/, function (_, a, b) { return a + " Открыть: " + b.toLowerCase(); });
  }

  // ---- «Тесты к задаче» ```tests : строки «вход => ожидаемый вывод», #строка — подпись ----
  function renderTests(src) {
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n");
    var rows = "", note = "";
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (!t) continue;
      if (t.charAt(0) === "#") { note += (note ? " " : "") + t.slice(1).trim(); continue; }
      var idx = t.indexOf("=>");
      if (idx < 0) continue;
      var inp = t.slice(0, idx).trim(), exp = t.slice(idx + 2).trim();
      rows += "<tr><td><code>" + testShow(testUnesc(inp)) + '</code> <button class="cd-tests-copy" type="button" data-in="' + escapeHtml(testUnesc(inp)) + '">копировать</button></td>' +
        "<td><code>" + testShow(testUnesc(exp)) + "</code></td></tr>";
    }
    return '<div class="cd-tests"><div class="cd-tests-head">Прогони свою программу на этих входах</div>' +
      '<div class="tablewrap"><table><thead><tr><th>Ввод</th><th>Ожидается</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      (note ? '<div class="cd-tests-note">' + inline(note) + "</div>" : "") + "</div>";
  }

  // ---- «Было / стало» ```badgood : две колонки кода через строку --- ----
  // Первая строка вида «Метка слева | Метка справа» задаёт заголовки (необязательна).
  function renderBadgood(src) {
    var lines = String(src).replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "").split("\n");
    var labBad = "Так неверно", labGood = "Так правильно";
    if (lines.length && lines[0].indexOf("|") >= 0 && !/[{};]/.test(lines[0])) {
      var lp = lines[0].split("|");
      labBad = lp[0].trim() || labBad; labGood = (lp[1] || "").trim() || labGood;
      lines.shift();
    }
    var sep = -1;
    for (var i = 0; i < lines.length; i++) { if (lines[i].trim() === "---") { sep = i; break; } }
    var badCode, goodCode;
    if (sep < 0) { badCode = lines.join("\n"); goodCode = ""; }
    else { badCode = lines.slice(0, sep).join("\n").replace(/^\n+|\n+$/g, ""); goodCode = lines.slice(sep + 1).join("\n").replace(/^\n+|\n+$/g, ""); }
    function col(cls, lab, code) {
      return '<div class="cd-bg-col ' + cls + '">' +
        '<div class="cd-bg-lab">' + escapeHtml(lab) + "</div>" +
        '<pre class="code"><code>' + highlight(code, "cpp") + "</code></pre></div>";
    }
    return '<div class="cd-badgood">' + col("bad", labBad, badCode) +
      (goodCode ? col("good", labGood, goodCode) : "") + "</div>";
  }

  // ---- Транскрипт консоли ```console : `<<` на строке отделяет ввод пользователя ----
  function renderConsole(src) {
    var lines = String(src).replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "").split("\n");
    var body = lines.map(function (ln) {
      var idx = ln.indexOf("<<");
      if (idx < 0) return '<span class="cd-con-line">' + (escapeHtml(ln) || "​") + "</span>";
      var pre = ln.slice(0, idx), typed = ln.slice(idx + 2).replace(/^\s/, "");
      return '<span class="cd-con-line">' + escapeHtml(pre) +
        '<span class="cd-con-in">' + escapeHtml(typed) + "</span></span>";
    }).join("");
    return '<div class="cd-console"><div class="cd-console-bar"><span class="cd-console-dot"></span>' +
      '<span class="cd-console-dot"></span><span class="cd-console-dot"></span>' +
      '<span class="cd-console-ttl">консоль</span></div>' +
      '<pre class="cd-console-body"><code>' + body + "</code></pre></div>";
  }

  // ---- Диаграмма ```diagram / ```svg : сырой SVG/HTML как есть, в подписанной рамке ----
  // Первая строка `# подпись` (необязательна) становится подписью под рисунком.
  // Схема ```diagram/```svg — это сырой HTML/SVG, а окно живёт в оболочке VS Code с доступом к Node:
  // обработчик вроде <img onerror=…> из чужой папки с доками выполнился бы с полными правами.
  // Разбираем в инертном <template> (там ничего не грузится и не исполняется) и оставляем
  // только безопасное: без <script>/<iframe>/<foreignObject>…, без on*-атрибутов, без
  // javascript:-ссылок; картинки — только data:image/* (без svg+xml) и относительные пути.
  // noscript/xmp/noembed/noframes/plaintext/math/template — классические векторы mXSS: разбор в <template>
  // и повторная вставка в живой документ читают их по-разному.
  var ART_BAD_TAGS = /^(script|iframe|frame|object|embed|foreignobject|link|meta|style|base|form|input|button|textarea|select|audio|video|animate|set|animatemotion|animatetransform|handler|listener|noscript|xmp|noembed|noframes|plaintext|math|template)$/i;
  function artUrlOk(v, isImg) {
    var u = String(v).replace(/[\u0000- ]+/g, "").toLowerCase();
    if (/^data:/.test(u)) return isImg && /^data:image\/(png|webp|jpe?g|gif);/.test(u);
    if (/^[a-z][a-z0-9+.-]*:/.test(u)) return false;       // javascript:, file:, http: … — нельзя
    return true;                                           // #якорь или относительный путь
  }
  function sanitizeArt(html) {
    var tpl = null;
    try { tpl = document.createElement("template"); } catch (e) {}
    if (!tpl || !tpl.content || typeof tpl.content.querySelectorAll !== "function") {
      // без DOM (тесты): грубая, но строгая очистка строкой
      return String(html)
        .replace(/<\s*(script|iframe|object|embed|foreignObject|style|link|meta|base)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, "")
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/(href|src|xlink:href)\s*=\s*("|')?\s*(javascript|vbscript|file):/gi, "$1=$2#");
    }
    setHTML(tpl, String(html));
    var all = tpl.content.querySelectorAll("*");
    for (var i = all.length - 1; i >= 0; i--) {
      var n = all[i];
      if (ART_BAD_TAGS.test(n.localName || n.nodeName)) { n.remove(); continue; }
      for (var a = n.attributes.length - 1; a >= 0; a--) {
        var at = n.attributes[a], nm = at.name.toLowerCase();
        if (/^on/.test(nm) || nm === "srcset" || nm === "formaction" || nm === "style" && /url\s*\(|expression/i.test(at.value)) { n.removeAttribute(at.name); continue; }
        if ((nm === "src" || nm === "href" || nm === "xlink:href") && !artUrlOk(at.value, nm === "src" || n.localName === "image")) n.removeAttribute(at.name);
      }
    }
    return tpl.innerHTML;
  }
  function renderDiagram(src) {
    var raw = String(src).replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
    var cap = "";
    var m = raw.match(/^#\s+(.*)\n?/);
    if (m) { cap = m[1].trim(); raw = raw.slice(m[0].length); }
    return '<figure class="cd-figure"><div class="cd-figure-art">' + sanitizeArt(raw) + "</div>" +
      (cap ? "<figcaption>" + inline(cap) + "</figcaption>" : "") + "</figure>";
  }

  // ---- Чек-лист ```checklist : пункты «- текст», состояние помнится (state.checks) ----
  function renderChecklist(src) {
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n");
    var title = "", items = [];
    lines.forEach(function (ln) {
      var t = ln.replace(/\s+$/, "");
      if (!t.trim()) return;
      var mi = t.match(/^\s*[-*]\s+(.*)$/);
      if (mi) items.push(mi[1]);
      else if (!items.length) title += (title ? " " : "") + t.trim();
    });
    var html = '<div class="cd-check">' +
      '<div class="cd-check-head">' + inline(title || "Проверь себя: могу сам, не подсматривая") + "</div>";
    items.forEach(function (it) {
      var id = cdHash(it), on = !!state.checks[id];
      html += '<button class="cd-check-item' + (on ? " on" : "") + '" type="button" data-id="' + id + '">' +
        '<span class="cd-check-box"></span><span class="cd-check-txt">' + inline(it) + "</span></button>";
    });
    return html + "</div>";
  }

  // ---- Интерактивная таблица сниппетов ```snippets : строка «prefix<TAB>choice<TAB>desc<TAB>base64(код)»;
  //      клик по строке разворачивает подсвеченный код. Блок собирает gen-snippets-doc.js. ----
  function renderSnippets(src) {
    var rows = String(src).replace(/\r\n?/g, "\n").split("\n");
    var out = '<table class="cd-snip-table"><thead><tr><th>Печатай</th><th>Что вставит</th></tr></thead><tbody>';
    var n = 0;
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i].trim()) continue;
      var p = rows[i].split("\t");
      if (p.length < 4) continue;
      var prefix = p[0], choice = (p[1] === "1"), desc = p[2], b64 = p[3];
      var code = "";
      try { code = decodeURIComponent(escape(atob(b64))); } catch (e) { try { code = atob(b64); } catch (_e) {} }
      n++;
      out += '<tr class="cd-snip"><td class="cd-snip-key"><span class="cd-snip-caret">▸</span> <code>' +
        escapeHtml(prefix) + "</code>" +
        (choice ? ' <span class="cd-snip-ch" title="при вставке появится меню выбора">⌄</span>' : "") +
        "</td><td>" + inline(desc) + "</td></tr>";
      out += '<tr class="cd-snip-code" hidden><td colspan="2">' +
        '<div class="codewrap"><div class="codehead"><span class="codelang">C++</span>' +
        '<span class="cd-codebtns">' + toEditorBtn(code) +
        '<button class="copybtn" type="button" title="Копировать код" data-code="' + escapeHtml(code) +
        '"><span class="cb-ic">⧉</span> копировать</button></span></div>' +
        '<pre class="code"><code>' + highlight(code, "cpp") + "</code></pre></div></td></tr>";
    }
    return n ? out + "</tbody></table>" : "";
  }

  // ---- «Живой пример» ```live : параметры-слайдеры, код и вывод пересчитываются на лету ----
  //  Синтаксис (секции разделяются строкой из одних дефисов «---»):
  //     @N = 5 [1..20]            ← параметр: имя = значение [мин..макс] (можно «step 2»)
  //     ---
  //     int s=0; for(int i=1;i<={N};++i) s+=i;   ← код-шаблон, {выражение} подставляется
  //     ---
  //     Сумма 1..{N} = {N*(N+1)/2}               ← вывод-шаблон; строка «{for i=1..N} …» повторяется
  //  Значения считает liveEval — СВОЙ разбор выражений (НЕ eval): чужой контент из доков не
  //  исполняется, доступны только объявленные числовые параметры и арифметика + - * / % ( ).
  function liveEval(expr, vars) {
    try {
      var s = String(expr), n = s.length, k = 0;
      var out = [], ops = [], prev = "op";  // prev: "op" | "val" — для распознавания унарного минуса
      var prec = { "u-": 4, "*": 3, "/": 3, "%": 3, "+": 2, "-": 2 };
      function apply(op) {
        if (op === "u-") { var x = out.pop(); if (!x) throw 0; out.push({ v: -x.v, i: x.i }); return; }
        var b = out.pop(), a = out.pop(); if (!a || !b) throw 0;
        var bothInt = a.i && b.i, r;
        if (op === "+") r = a.v + b.v;
        else if (op === "-") r = a.v - b.v;
        else if (op === "*") r = a.v * b.v;
        else if (op === "/") { if (b.v === 0) throw 0; r = a.v / b.v; if (bothInt) r = Math.trunc(r); }  // деление целых — по-C++ (усечение)
        else { if (b.v === 0) throw 0; r = bothInt ? (Math.trunc(a.v) % Math.trunc(b.v)) : (a.v % b.v); }
        // целые — как int в C++: за пределом ±2^31 значение «оборачивается» (так видно переполнение)
        if (bothInt && (r > 2147483647 || r < -2147483648)) { r = ((r % 4294967296) + 4294967296) % 4294967296; if (r >= 2147483648) r -= 4294967296; }
        out.push({ v: r, i: bothInt });
      }
      while (k < n) {
        var c = s.charAt(k);
        if (c === " " || c === "\t") { k++; continue; }
        if (c >= "0" && c <= "9" || (c === "." && s.charAt(k + 1) >= "0" && s.charAt(k + 1) <= "9")) {
          var num = ""; while (k < n && (/[0-9.]/).test(s.charAt(k))) { num += s.charAt(k); k++; }
          out.push({ v: parseFloat(num), i: num.indexOf(".") < 0 }); prev = "val"; continue;
        }
        if ((/[A-Za-z_]/).test(c)) {
          var id = ""; while (k < n && (/[A-Za-z0-9_]/).test(s.charAt(k))) { id += s.charAt(k); k++; }
          if (!(id in vars)) throw 0;                         // только объявленные параметры
          var vv = vars[id]; out.push({ v: vv, i: Number.isInteger(vv) }); prev = "val"; continue;
        }
        if (c === "(") { ops.push("("); prev = "op"; k++; continue; }
        if (c === ")") {
          while (ops.length && ops[ops.length - 1] !== "(") apply(ops.pop());
          if (!ops.length) throw 0; ops.pop(); prev = "val"; k++; continue;
        }
        if ("+-*/%".indexOf(c) >= 0) {
          var op = c;
          if (c === "-" && prev === "op") op = "u-";           // унарный минус
          while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]] >= prec[op] && op !== "u-") apply(ops.pop());
          ops.push(op); prev = "op"; k++; continue;
        }
        throw 0;                                               // неизвестный символ — выражение недопустимо
      }
      while (ops.length) { var o = ops.pop(); if (o === "(") throw 0; apply(o); }
      if (out.length !== 1) throw 0;
      var res = out[0].v;
      return isFinite(res) ? res : NaN;
    } catch (e) { return NaN; }
  }
  // Число → строка: целое без дробей, дробное — до 6 значащих (хвостовые нули убираем).
  function liveNum(x) {
    if (!isFinite(x)) return "?";
    if (Number.isInteger(x)) return String(x);
    return String(parseFloat(x.toPrecision(6)));
  }
  // Подстановка {выражений} в текст. wrap=true — оборачиваем значения в акцентный span (для вывода).
  function liveSubst(text, vars, wrap) {
    var parts = String(text).split(/(\{[^{}]+\})/);
    var html = "";
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.length > 1 && p.charAt(0) === "{" && p.charAt(p.length - 1) === "}") {
        var val = liveNum(liveEval(p.slice(1, -1), vars));
        html += wrap ? '<span class="cd-live-val">' + escapeHtml(val) + "</span>" : escapeHtml(val);
      } else html += escapeHtml(p);
    }
    return html;
  }
  // Одна строка вывода. «{for i=a..b} шаблон» разворачивается в b−a+1 строк (i доступна в шаблоне).
  function liveOutLine(line, vars) {
    var mf = String(line).match(/^\s*\{for\s+([A-Za-z_]\w*)\s*=\s*([^}]+?)\.\.([^}]+?)\}(.*)$/);
    if (!mf) return liveSubst(line, vars, true);
    var name = mf[1], a = liveEval(mf[2], vars), b = liveEval(mf[3], vars), tpl = mf[4];
    if (!isFinite(a) || !isFinite(b)) return '<span class="cd-live-val">?</span>';
    a = Math.trunc(a); b = Math.trunc(b);
    var rows = [], guard = 0;
    for (var v = a; v <= b && guard < 500; v++, guard++) {
      var sub = {}; for (var kk in vars) sub[kk] = vars[kk]; sub[name] = v;   // локальная переменная цикла
      rows.push(liveSubst(tpl.replace(/^\s/, ""), sub, true));
    }
    if (a <= b && (b - a) >= 500) rows.push("…");
    return rows.join("\n");
  }
  // Пересчёт кода и вывода по текущим значениям слайдеров. Шаблоны лежат в data-атрибутах
  // контейнера (переживают перерисовку DOM), значения — в самих слайдерах.
  function liveRecalc(box) {
    if (!box) return;
    var vars = {}, sls = box.querySelectorAll(".cd-live-sl");
    for (var i = 0; i < sls.length; i++) {
      var nm = sls[i].getAttribute("data-name"); if (!nm) continue;
      var num = parseFloat(sls[i].value); vars[nm] = isFinite(num) ? num : 0;
      var o = sls[i].parentNode && sls[i].parentNode.querySelector(".cd-live-num");
      if (o) o.textContent = sls[i].value;
    }
    var codeTpl = decodeURIComponent(box.getAttribute("data-code") || "");
    var outTpl = decodeURIComponent(box.getAttribute("data-out") || "");
    var codeEl = box.querySelector(".cd-live-code code");
    if (codeEl) {
      // Значения подставляем в текст, затем подсвечиваем как обычный C++ — число в коде «живёт».
      var filled = codeTpl.replace(/\{[^{}]+\}/g, function (m) { return liveNum(liveEval(m.slice(1, -1), vars)); });
      setHTML(codeEl, highlight(filled, "cpp"));
    }
    var outEl = box.querySelector(".cd-live-out code");
    if (outEl) {
      var lines = outTpl.split("\n").map(function (ln) { return liveOutLine(ln, vars); });
      setHTML(outEl, lines.join("\n") || "​");
    }
  }
  function renderLive(src) {
    var raw = String(src).replace(/\r\n?/g, "\n");
    var secs = raw.split(/^\s*---\s*$/m);
    var paramSrc = secs[0] || "", codeTpl = (secs[1] || "").replace(/^\n+|\n+$/g, ""), outTpl = (secs[2] || "").replace(/^\n+|\n+$/g, "");
    if (secs.length < 2) { codeTpl = paramSrc.replace(/^\n+|\n+$/g, ""); paramSrc = ""; }  // нет «---» — считаем весь блок кодом
    var params = [];
    paramSrc.split("\n").forEach(function (ln) {
      // @имя = значение [мин..макс] или [мин..макс step S]
      var m = ln.match(/^\s*@\s*([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)\s*\[\s*(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)\s*(?:step\s*(\d+(?:\.\d+)?))?\s*\]/i);
      if (m) params.push({ name: m[1], def: m[2], min: m[3], max: m[4], step: m[5] || "1" });
    });
    if (!params.length || !codeTpl) return "";                 // без параметров или кода — фенс бессмысленен
    var initVars = {}; params.forEach(function (p) { initVars[p.name] = parseFloat(p.def); });
    var ctl = "";
    params.forEach(function (p) {
      ctl += '<label class="cd-live-p"><span class="cd-live-nm">' + escapeHtml(p.name) + "</span>" +
        '<input class="cd-live-sl" type="range" data-name="' + escapeHtml(p.name) + '" min="' + escapeHtml(p.min) +
        '" max="' + escapeHtml(p.max) + '" step="' + escapeHtml(p.step) + '" value="' + escapeHtml(p.def) + '">' +
        '<output class="cd-live-num">' + escapeHtml(p.def) + "</output></label>";
    });
    // Начальные код и вывод считаем сразу (до первого движения слайдера).
    var filled0 = codeTpl.replace(/\{[^{}]+\}/g, function (m) { return liveNum(liveEval(m.slice(1, -1), initVars)); });
    var out0 = outTpl ? outTpl.split("\n").map(function (ln) { return liveOutLine(ln, initVars); }).join("\n") : "";
    return '<div class="cd-live" data-code="' + encodeURIComponent(codeTpl) + '" data-out="' + encodeURIComponent(outTpl) + '">' +
      '<div class="cd-live-head">Живой пример — двигай параметр</div>' +
      '<div class="cd-live-ctl">' + ctl + "</div>" +
      '<pre class="code cd-live-code"><code>' + highlight(filled0, "cpp") + "</code></pre>" +
      (outTpl ? '<div class="cd-live-outwrap"><div class="cd-live-outlab">вывод программы</div>' +
        '<pre class="cd-live-out"><code>' + (out0 || "​") + "</code></pre></div>" : "") + "</div>";
  }

  // ---- Пошаговый проигрыватель ```steps : стрелка идёт по строкам, видны переменные и вывод ----
  //  Синтаксис (код и шаги через строку «---»):
  //     # Сумма цифр            ← необязательный заголовок
  //     int n = 12, s = 0;      ← код (строки нумеруются с 1)
  //     ---
  //     1 | n=12, s=0 | Создали переменные          ← строка | переменные | пояснение | вывод
  //     3 | s=2 | 12 % 10 = 2
  //     5 | | Печатаем | 3
  //  Переменные копятся от шага к шагу (пишите только изменившиеся), «x=—» убирает x.
  //  В выводе «\n» — перевод строки. Ничего не выполняется: шаги пишет автор.
  function stepsSplitVars(s) {
    var out = [], cur = "", depth = 0, q = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (q) { cur += ch; if (ch === q && s.charAt(i - 1) !== "\\") q = ""; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === "[" || ch === "{" || ch === "(") depth++;
      if (ch === "]" || ch === "}" || ch === ")") depth--;
      if (ch === "," && depth <= 0) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }
  function parseSteps(src) {
    var raw = String(src).replace(/\r\n?/g, "\n");
    var secs = raw.split(/^\s*---\s*$/m);
    if (secs.length < 2) return null;
    var codeLines = secs[0].replace(/^\n+|\n+$/g, "").split("\n"), title = "";
    if (/^\s*#\s+/.test(codeLines[0] || "")) title = codeLines.shift().replace(/^\s*#\s+/, "");
    while (codeLines.length && !codeLines[0].trim()) codeLines.shift();
    var steps = [], vars = {}, order = [], out = "";
    secs.slice(1).join("\n").split("\n").forEach(function (ln) {
      if (!ln.trim()) return;
      var f = ln.split("|").map(function (x) { return x.trim(); });
      var q = /^\s*\?/.test(f[0]);                     // «?4 | …» — шаг-загадка: сначала предсказать
      var line = parseInt(f[0].replace(/^\s*\?/, ""), 10); if (!(line >= 0)) return;
      var changed = {};
      stepsSplitVars(f[1] || "").forEach(function (kv) {
        var m = kv.match(/^\s*([^=]+?)\s*=\s*([\s\S]*?)\s*$/); if (!m) return;
        var k = m[1], v = m[2];
        if (v === "—" || v === "-") { if (Object.prototype.hasOwnProperty.call(vars, k)) { delete vars[k]; order = order.filter(function (o) { return o !== k; }); } return; }
        if (!Object.prototype.hasOwnProperty.call(vars, k)) order.push(k);
        if (vars[k] !== v) changed[k] = 1;
        vars[k] = v;
      });
      var o = f.slice(3).join("|");
      if (o) out += o.replace(/\\n/g, "\n");
      steps.push({ l: line, v: order.map(function (k) { return [k, vars[k], changed[k] ? 1 : 0]; }), c: f[2] || "", o: out, q: q ? 1 : 0 });
    });
    if (!steps.length) return null;
    return { title: title, code: codeLines, steps: steps };
  }
  function renderSteps(src) {
    var fk = fenceKey(String(src).replace(/\r\n?/g, "\n")), stId = fk.id;
    var d = parseSteps(fk.body); if (!d) return "";
    var code = d.code.map(function (ln, i) {
      return '<span class="cd-ln cd-st-ln" data-n="' + (i + 1) + '"><span class="cd-st-no">' + (i + 1) + "</span>" + (highlight(ln, "cpp") || "​") + "</span>";
    }).join("");
    return '<div class="cd-steps" data-steps="' + encodeURIComponent(JSON.stringify(d.steps)) + '" data-i="0" data-id="' + stId + '" id="st-' + stId + '">' +
      '<div class="cd-st-head"><span class="cd-st-badge">▶ По шагам</span>' + (d.title ? '<span class="cd-st-title">' + inline(d.title) + "</span>" : "") + "</div>" +
      '<div class="cd-st-body"><pre class="code cd-lined cd-st-code"><code>' + code + "</code></pre>" +
      '<div class="cd-st-side"><div class="cd-st-lab">переменные</div><div class="cd-st-vars"></div>' +
      '<div class="cd-st-lab">вывод</div><pre class="cd-st-out"><code>​</code></pre></div></div>' +
      '<div class="cd-st-note">Нажмите «Шаг ▶» — стрелка пойдёт по программе.</div>' +
      '<div class="cd-st-ctl"><button class="cd-st-btn" data-st="first" type="button" title="В начало">⟲</button>' +
      '<button class="cd-st-btn" data-st="prev" type="button">◀ Назад</button>' +
      '<span class="cd-st-pos">' + d.steps.length + " шагов</span>" +
      '<button class="cd-st-btn cd-st-main" data-st="next" type="button">Шаг ▶</button>' +
      '<button class="cd-st-btn cd-st-chk" data-st="check" type="button">Проверить</button>' +
      '<button class="cd-st-btn" data-st="play" type="button" title="Проиграть все шаги сами">▶▶ Авто</button></div>' +
      '<div class="cd-st-track"><div class="cd-st-fill"></div></div></div>';
  }

  // ---- Память по шагам ```memory: стек, куча и указатели (в духе Python Tutor) ----
  // Синтаксис (секции через строку «---»):
  //   # заголовок                    — необязательно, первой строкой
  //   код программы                  — первая секция
  //   ---
  //   строка 3                       — какую строку кода подсветить на этом шаге
  //   стек main: x = 5; p = →x       — кадр стека (несколько строк «стек» — несколько кадров, верхний — последний)
  //   куча: #1 int[3] = {1, 2, 3}; #2 Hero = {hp: 10}
  //   пояснение: текст               — подпись к шагу (разметка как в тексте)
  // Значение «→имя» — указатель на переменную стека, «→#1» — на блок кучи, «→∅» — nullptr,
  // «→✗» — висячий (память уже освобождена). Блок кучи «#1 ✗ …» — освобождён (delete).
  // Ничего не выполняется: состояние на каждом шаге пишет автор — окно только рисует.
  function memSplitItems(s) { return String(s).split(/;\s*/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function memParseStep(sec) {
    var st = { line: 0, frames: [], heap: [], note: "" };
    sec.split("\n").forEach(function (ln) {
      var t = ln.trim(), m;
      if (!t) return;
      if ((m = t.match(/^строка\s+(\d+)$/i))) { st.line = +m[1]; return; }
      if ((m = t.match(/^стек(?:\s+([^:]+))?:\s*(.*)$/i))) {
        st.frames.push({ name: (m[1] || "").trim(), vars: memSplitItems(m[2]).map(function (it) {
          var k = it.indexOf("=");
          return k < 0 ? { name: it, val: "?" } : { name: it.slice(0, k).trim(), val: it.slice(k + 1).trim() };
        }) });
        return;
      }
      if ((m = t.match(/^куча:\s*(.*)$/i))) {
        memSplitItems(m[1]).forEach(function (it) {
          var hm = it.match(/^#(\w+)\s*(✗)?\s*(.*)$/);
          if (!hm) return;
          var body = hm[3], k = body.indexOf("=");
          st.heap.push({ id: hm[1], dead: !!hm[2], type: (k < 0 ? body : body.slice(0, k)).trim(), val: k < 0 ? "" : body.slice(k + 1).trim() });
        });
        return;
      }
      if ((m = t.match(/^(?:пояснение:|>)\s*(.*)$/i))) { st.note += (st.note ? " " : "") + m[1]; return; }
    });
    return st;
  }
  function parseMemory(src) {
    var raw = String(src).replace(/\r\n?/g, "\n"), title = "";
    var tm = raw.match(/^#\s+(.*)\n/);
    if (tm) { title = tm[1].trim(); raw = raw.slice(tm[0].length); }
    var secs = raw.split(/\n-{3,}\s*\n/);
    if (secs.length < 2) return null;
    return { title: title, code: secs[0].replace(/\n+$/, "").split("\n"), steps: secs.slice(1).map(memParseStep) };
  }
  function renderMemory(src) {
    var fk = fenceKey(String(src).replace(/\r\n?/g, "\n")), d = parseMemory(fk.body);
    if (!d) return "";
    var code = d.code.map(function (ln, i) {
      return '<span class="cd-ln cd-mem-ln" data-n="' + (i + 1) + '"><span class="cd-st-no">' + (i + 1) + "</span>" + (highlight(ln, "cpp") || "\u200b") + "</span>";
    }).join("");
    return '<div class="cd-mem" data-mem="' + encodeURIComponent(JSON.stringify(d.steps)) + '" data-i="0" id="mem-' + fk.id + '">' +
      '<div class="cd-st-head"><span class="cd-st-badge cd-mem-badge">▦ Память</span>' + (d.title ? '<span class="cd-st-title">' + inline(d.title) + "</span>" : "") + "</div>" +
      '<div class="cd-mem-body"><pre class="code cd-lined cd-mem-code"><code>' + code + "</code></pre>" +
      '<div class="cd-mem-cols"><div class="cd-mem-col"><div class="cd-st-lab">стек</div><div class="cd-mem-stack"></div></div>' +
      '<div class="cd-mem-col"><div class="cd-st-lab">куча</div><div class="cd-mem-heap"></div></div></div></div>' +
      '<div class="cd-st-note cd-mem-note"></div>' +
      '<div class="cd-st-ctl"><button class="cd-mem-btn" data-mem="first" type="button" title="В начало">⟲</button>' +
      '<button class="cd-mem-btn" data-mem="prev" type="button">◀ Назад</button>' +
      '<span class="cd-st-pos cd-mem-pos"></span>' +
      '<button class="cd-mem-btn cd-st-main" data-mem="next" type="button">Шаг ▶</button></div></div>';
  }
  function memData(box) {
    if (!box.__mem) { try { box.__mem = JSON.parse(decodeURIComponent(box.getAttribute("data-mem") || "")); } catch (e) { box.__mem = []; } }
    return box.__mem;
  }
  // Значение-указатель → чип «→ цель» (подсветка цели при наведении); прочее — текст.
  function memVal(v) {
    var m = String(v).match(/^→\s*(.+)$/);
    if (!m) return '<code>' + escapeHtml(v) + "</code>";
    var tg = m[1].trim();
    if (tg === "∅" || /^nullptr$/i.test(tg)) return '<span class="cd-mem-ptr null" title="nullptr — ни на что не указывает">→ ∅</span>';
    if (tg === "✗") return '<span class="cd-mem-ptr dead" title="Висячий указатель: память уже освобождена">→ ✗</span>';
    return html`<span class="cd-mem-ptr" data-to="${tg}" title="Указывает на ${tg}">→ ${tg}</span>`;
  }
  function memShow(box, i) {
    var steps = memData(box); if (!steps.length) return;
    i = clamp(i, 0, steps.length - 1);
    box.setAttribute("data-i", String(i));
    var st = steps[i], prev = i > 0 ? steps[i - 1] : null;
    var old = {};
    if (prev) prev.frames.forEach(function (fr) { fr.vars.forEach(function (v) { old[fr.name + "." + v.name] = v.val; }); });
    var sh = "";
    for (var k = st.frames.length - 1; k >= 0; k--) {       // верхний кадр стека — сверху
      var fr = st.frames[k];
      sh += '<div class="cd-mem-frame' + (k === st.frames.length - 1 ? " top" : "") + '"><div class="cd-mem-fname">' + escapeHtml(fr.name || "кадр") + "</div>" +
        fr.vars.map(function (v) {
          var ch = prev && old[fr.name + "." + v.name] !== v.val;
          return html`<div class="cd-mem-var${ch ? " changed" : ""}" data-name="${v.name}"><span class="cd-mem-vn">${v.name}</span>${raw(memVal(v.val))}</div>`;
        }).join("") + "</div>";
    }
    var hh = st.heap.map(function (b) {
      return '<div class="cd-mem-blk' + (b.dead ? " dead" : "") + '" data-id="#' + escapeHtml(b.id) + '"><span class="cd-mem-bid">#' + escapeHtml(b.id) + "</span>" +
        '<span class="cd-mem-bt">' + escapeHtml(b.type) + (b.dead ? " · освобождено" : "") + "</span>" + (b.val ? memVal(b.val) : "") + "</div>";
    }).join("");
    setHTML(box.querySelector(".cd-mem-stack"), sh || '<div class="cd-mem-empty">пусто</div>');
    setHTML(box.querySelector(".cd-mem-heap"), hh || '<div class="cd-mem-empty">пусто</div>');
    setHTML(box.querySelector(".cd-mem-note"), st.note ? inline(st.note) : "");
    box.querySelector(".cd-mem-pos").textContent = "шаг " + (i + 1) + " из " + steps.length;
    box.querySelectorAll(".cd-mem-ln").forEach(function (ln) { ln.classList.toggle("cur", +ln.getAttribute("data-n") === st.line); });
    box.querySelector('[data-mem="prev"]').disabled = i === 0;
    box.querySelector('[data-mem="next"]').disabled = i === steps.length - 1;
  }
  function memClick(t) {
    var b = t.closest(".cd-mem-btn"); if (!b) return false;
    var box = b.closest(".cd-mem"); if (!box) return false;
    var i = +box.getAttribute("data-i") || 0, act = b.getAttribute("data-mem");
    memShow(box, act === "first" ? 0 : act === "prev" ? i - 1 : i + 1);
    return true;
  }
  function memHover(e) {
    var chip = e.target.closest && e.target.closest(".cd-mem-ptr[data-to]");
    var box = e.target.closest && e.target.closest(".cd-mem");
    if (!box) return;
    box.querySelectorAll(".cd-mem-hit").forEach(function (x) { x.classList.remove("cd-mem-hit"); });
    if (!chip) return;
    var to = chip.getAttribute("data-to");
    var tgt = to.charAt(0) === "#" ? box.querySelector('.cd-mem-blk[data-id="' + cssEscape(to) + '"]') : box.querySelector('.cd-mem-var[data-name="' + cssEscape(to) + '"]');
    if (tgt) tgt.classList.add("cd-mem-hit");
  }
  function initMemory(root) {
    (root || articleEl).querySelectorAll(".cd-mem").forEach(function (box) { if (!box.__init) { box.__init = true; memShow(box, 0); } });
  }

  // ---- Кадры ```frames: консольная «анимация» по кадрам (игровой цикл глазами игрока) ----
  // Синтаксис: «# заголовок» и «@fps N» (кадров в секунду, 1–12) — необязательно, в начале;
  // дальше кадры через строку «---». Строка кадра «> текст» — подпись к кадру (не рисуется в кадре).
  function parseFrames(src) {
    var raw = String(src).replace(/\r\n?/g, "\n"), title = "", fps = 3, m;
    while ((m = raw.match(/^(#\s+(.*)|@fps\s+(\d+))\s*\n/))) {
      if (m[2]) title = m[2].trim(); else fps = clamp(+m[3] || 3, 1, 12);
      raw = raw.slice(m[0].length);
    }
    var frames = raw.split(/\n-{3,}\s*\n/).map(function (fr) {
      var cap = [], body = [];
      fr.split("\n").forEach(function (ln) { if (/^>\s?/.test(ln)) cap.push(ln.replace(/^>\s?/, "")); else body.push(ln); });
      return { art: body.join("\n").replace(/^\n+|\n+$/g, ""), cap: cap.join(" ") };
    }).filter(function (x) { return x.art || x.cap; });
    return frames.length ? { title: title, fps: fps, frames: frames } : null;
  }
  function renderFrames(src) {
    var d = parseFrames(src); if (!d) return "";
    return '<div class="cd-frames" data-frames="' + encodeURIComponent(JSON.stringify(d.frames)) + '" data-fps="' + d.fps + '" data-i="0">' +
      '<div class="cd-st-head"><span class="cd-st-badge cd-fr-badge">🎞 Кадры</span>' + (d.title ? '<span class="cd-st-title">' + inline(d.title) + "</span>" : "") + "</div>" +
      '<pre class="cd-fr-screen"><code></code></pre><div class="cd-st-note cd-fr-cap"></div>' +
      '<div class="cd-st-ctl"><button class="cd-fr-btn" data-fr="prev" type="button" title="Кадр назад">◀</button>' +
      '<button class="cd-fr-btn cd-st-main" data-fr="play" type="button">▶ Играть</button>' +
      '<button class="cd-fr-btn" data-fr="next" type="button" title="Кадр вперёд">▶</button>' +
      '<span class="cd-st-pos cd-fr-pos"></span></div></div>';
  }
  function framesShow(box, i) {
    if (!box.__fr) { try { box.__fr = JSON.parse(decodeURIComponent(box.getAttribute("data-frames") || "")); } catch (e) { box.__fr = []; } }
    var fr = box.__fr; if (!fr.length) return;
    i = ((i % fr.length) + fr.length) % fr.length;
    box.setAttribute("data-i", String(i));
    box.querySelector(".cd-fr-screen code").textContent = fr[i].art || " ";
    setHTML(box.querySelector(".cd-fr-cap"), fr[i].cap ? inline(fr[i].cap) : "");
    box.querySelector(".cd-fr-pos").textContent = "кадр " + (i + 1) + " из " + fr.length;
  }
  function framesStop(box) {
    if (box.__timer) { clearTimeout(box.__timer); box.__timer = null; }
    var b = box.querySelector('[data-fr="play"]'); if (b) b.textContent = "▶ Играть";
  }
  function framesClick(t) {
    var b = t.closest(".cd-fr-btn"); if (!b) return false;
    var box = b.closest(".cd-frames"); if (!box) return false;
    var i = +box.getAttribute("data-i") || 0, act = b.getAttribute("data-fr");
    if (act === "play") {
      if (box.__timer) { framesStop(box); return true; }
      var fps = clamp(+box.getAttribute("data-fps") || 3, 1, 12);
      b.textContent = "⏸ Пауза";
      // самоперепланирующийся setTimeout, а не второй фоновый setInterval: живёт, только пока играет
      var tick = function () {
        if (!box.isConnected) { framesStop(box); return; }        // ушли со страницы — не крутим в фоне
        framesShow(box, (+box.getAttribute("data-i") || 0) + 1);
        box.__timer = setTimeout(tick, Math.round(1000 / fps));
      };
      box.__timer = setTimeout(tick, Math.round(1000 / fps));
      return true;
    }
    framesStop(box);
    framesShow(box, act === "prev" ? i - 1 : i + 1);
    return true;
  }
  function initFrames(root) {
    (root || articleEl).querySelectorAll(".cd-frames").forEach(function (box) { if (!box.__init) { box.__init = true; framesShow(box, 0); } });
  }
  function stepsData(box) {
    if (!box.__steps) { try { box.__steps = JSON.parse(decodeURIComponent(box.getAttribute("data-steps") || "")); } catch (e) { box.__steps = []; } }
    return box.__steps;
  }
  function stepsShow(box, i) {
    var st = stepsData(box); if (!st.length) return;
    i = Math.max(0, Math.min(st.length - 1, i)); box.setAttribute("data-i", String(i));
    var s = st[i], rev = box.__rev || (box.__rev = {});
    var ask = !!s.q && !rev[i];                           // шаг-загадка: сначала предсказать
    var lns = box.querySelectorAll(".cd-st-ln"), cur = null;
    for (var k = 0; k < lns.length; k++) { var on = +lns[k].getAttribute("data-n") === s.l; lns[k].classList.toggle("cd-st-cur", on); if (on) cur = lns[k]; }
    var pre = box.querySelector(".cd-st-code");
    if (cur && pre && pre.scrollHeight > pre.clientHeight) pre.scrollTop = Math.max(0, cur.offsetTop - pre.clientHeight / 2);
    setHTML(box.querySelector(".cd-st-vars"), s.v.length ? s.v.map(function (v) {
      if (ask && v[2]) return '<div class="cd-st-var ask"><span class="cd-st-k">' + escapeHtml(v[0]) + '</span><input class="cd-st-in" type="text" size="6" placeholder="?" spellcheck="false" data-a="' + escapeHtml(v[1]) + '"></div>';
      return '<div class="cd-st-var' + (v[2] ? " chg" : "") + '"><span class="cd-st-k">' + escapeHtml(v[0]) + '</span><span class="cd-st-v">' + escapeHtml(v[1]) + "</span></div>";
    }).join("") : '<div class="cd-st-empty">пока нет</div>');
    box.querySelector(".cd-st-out code").textContent = (ask ? (i ? st[i - 1].o : "") : s.o) || "​";
    setHTML(box.querySelector(".cd-st-note"), ask
      ? "🤔 <b>Предскажите:</b> что окажется в пустых полях? Впишите и нажмите «Проверить» — или «Шаг ▶», чтобы просто увидеть ответ."
      : (box.__ok === i ? '<b class="cd-st-yes">✓ Верно!</b> ' : "") + (s.c ? inline(s.c) : ""));
    box.querySelector(".cd-st-pos").textContent = "шаг " + (i + 1) + " из " + st.length;
    box.querySelector(".cd-st-fill").style.width = ((i + 1) / st.length * 100) + "%";
    box.classList.add("cd-st-on");
    box.classList.toggle("cd-st-asking", ask);
    box.classList.toggle("cd-st-end", i === st.length - 1);
    if (ask) { var inp = box.querySelector(".cd-st-in"); if (inp) try { inp.focus({ preventScroll: true }); } catch (e) {} }
    // дошёл до последнего шага — разбор засчитан (плитка «разборов» на главном)
    var id = box.getAttribute("data-id");
    if (i === st.length - 1 && !ask && id && !state.stepsDone[id]) { state.stepsDone[id] = 1; recordActivity(); saveState(); }
    rememberSpot(box, "steps", i, st.length);
  }
  // «Где остановились» — для кнопки на главном: последний разбор/босс, который начат, но не закончен.
  function rememberSpot(box, kind, i, n) {
    if (!current || !box) return;
    var id = box.getAttribute("data-id"), finished = kind === "steps" ? i >= n - 1 : !!state.boss[id];
    if (finished) { if (state.spot && state.spot.id === id) { delete state.spot; saveState(); } return; }
    var tEl = box.querySelector(kind === "steps" ? ".cd-st-title" : ".cd-boss-title");
    state.spot = { rel: current.rel, kind: kind, id: id, i: i || 0, n: n || 0, title: tEl ? tEl.textContent : "" };
    saveState();
  }
  // Любая ошибка (или «Показать ответ», не попробовав) → карточка в «Разминке дня» через 2 дня.
  // kind: steps | quiz | predict | parsons | fillcode. md — вопрос/ответ с блоками кода (рисуем Markdown).
  var MISS_LABEL = {
    steps: "загадка, где вы ошиблись", quiz: "вопрос, где вы ошиблись", predict: "«предскажи вывод», где вы ошиблись",
    parsons: "«собери код», где вы ошиблись", fillcode: "пропуск, где вы ошиблись"
  };
  var MISS_MAX = 200;
  function recordMiss(kind, key, box, q, a, md) {
    if (!current || !key || !q) return;
    state.missed[kind + ":" + key] = { rel: current.rel, hash: sectionSlugOf(box), q: String(q).slice(0, 4000), a: String(a || "").slice(0, 4000), due: cdDate(2), kind: kind, md: md ? 1 : 0 };
    var keys = Object.keys(state.missed);
    if (keys.length > MISS_MAX) {                     // копилка не растёт бесконечно: самые старые — прочь
      keys.sort(function (x, y) { return String(state.missed[x].due).localeCompare(String(state.missed[y].due)); });
      keys.slice(0, keys.length - MISS_MAX).forEach(function (k) { delete state.missed[k]; });
    }
    saveState();
  }
  // Ближайший заголовок раздела выше элемента статьи — чтобы из карточки прыгнуть к нужному месту.
  function sectionSlugOf(node) {
    var n = node;
    while (n && n.parentNode && n.parentNode !== articleEl) n = n.parentNode;
    for (; n; n = n.previousElementSibling) if (/^H[23]$/.test(n.tagName || "") && n.id) return n.id;
    return "";
  }
  function plainOf(el) { return el ? String(el.textContent || "").replace(/\s+/g, " ").trim() : ""; }
  function codeOf(el) { return el ? String(el.textContent || "").replace(/\u200b/g, "").replace(/\n+$/, "") : ""; }
  function mdCode(code) { return "\n```cpp\n" + code + "\n```\n"; }
  function missQuiz(q) {
    var rq = q.getAttribute("data-mq") ? decodeURIComponent(q.getAttribute("data-mq")) : plainOf(q.querySelector(".cd-quiz-qt"));
    var ra = q.getAttribute("data-ma") ? decodeURIComponent(q.getAttribute("data-ma")) : "";
    recordMiss("quiz", cdHash(rq), q, rq, ra, false);
  }
  function missPredict(box) {
    var head = box.querySelector(".cd-ch-head"), badge = head && head.querySelector(".cd-ch-badge");
    var prompt = plainOf(head).replace(plainOf(badge), "").trim() || "Что напечатает программа?";
    recordMiss("predict", box.getAttribute("data-id"), box, prompt + mdCode(codeOf(box.querySelector("pre code"))),
      "`" + decodeURIComponent(box.getAttribute("data-exp") || "") + "`", true);
  }
  function missParsons(box) {
    var want = []; try { want = JSON.parse(decodeURIComponent(box.getAttribute("data-sol") || "[]")); } catch (e) {}
    var head = box.querySelector(".cd-ch-head"), badge = head && head.querySelector(".cd-ch-badge");
    var prompt = plainOf(head).replace(plainOf(badge), "").trim() || "Собери программу из строк";
    recordMiss("parsons", box.getAttribute("data-id"), box, prompt + " — в каком порядке идут строки?", mdCode(want.join("\n")), true);
  }
  function missFill(box) {
    var pre = box.querySelector(".cd-fc-code"); if (!pre) return;
    var copy = pre.cloneNode(true), ins = copy.querySelectorAll ? copy.querySelectorAll(".cd-fc-in") : [], ans = [];
    for (var i = 0; i < ins.length; i++) { ans.push(ins[i].getAttribute("data-a") || ""); ins[i].replaceWith ? ins[i].replaceWith("___") : null; }
    var code = codeOf(copy);
    recordMiss("fillcode", cdHash(code), box, "Заполни пропуски `___`:" + mdCode(code), ans.map(function (x) { return "`" + x + "`"; }).join(", "), true);
  }
  // Ошибка в загадке → карточка вернётся в «Разминку дня» через 2 дня.
  function rememberMiss(box, i) {
    if (!current) return;
    var st = stepsData(box), s = st[i]; if (!s) return;
    var id = box.getAttribute("data-id"), key = id + ":" + i;
    var ln = box.querySelector('.cd-st-ln[data-n="' + s.l + '"]');
    var code = ln ? ln.textContent.replace(/^\s*\d+/, "").trim() : "";
    var tEl = box.querySelector(".cd-st-title");
    var asked = s.v.filter(function (v) { return v[2]; });
    state.missed[key] = {
      rel: current.rel, hash: "st-" + id,
      q: (tEl ? "Разбор «" + tEl.textContent + "». " : "") + (code ? "После строки `" + code + "` — " : "") +
        "чему " + (asked.length > 1 ? "равны " : "равно ") + asked.map(function (v) { return "`" + v[0] + "`"; }).join(", ") + "?",
      a: asked.map(function (v) { return "`" + v[0] + "` = `" + v[1] + "`"; }).join(", ") + (s.c ? " — " + s.c : ""),
      due: cdDate(2), kind: "steps"
    };
    saveState();
  }
  // Ответ «как написал бы человек»: без пробелов и кавычек; числа — по значению (3.0 = 3, 0.50 = .5),
  // true/false — как 1/0 (так их печатает cout). Иначе верный ответ засчитывался бы ошибкой.
  function stepsNorm(x) {
    var s = String(x).replace(/\s+/g, "").replace(/^["']|["']$/g, "").toLowerCase();
    if (s === "true") return "1";
    if (s === "false") return "0";
    var num = s.replace(/^([+-]?\d*),(\d+)$/, "$1.$2");      // «3,5» — русская запятая в дроби
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(num)) return String(Number(num));
    return s;
  }
  function stepsCheck(box) {
    var i = +box.getAttribute("data-i") || 0, ins = box.querySelectorAll(".cd-st-in"), all = true;
    for (var k = 0; k < ins.length; k++) {
      var ok = stepsNorm(ins[k].value) === stepsNorm(ins[k].getAttribute("data-a"));
      ins[k].classList.toggle("bad", !ok); ins[k].classList.toggle("good", ok);
      if (!ok) all = false;
    }
    if (all) { (box.__rev || (box.__rev = {}))[i] = 1; box.__ok = i; stepsShow(box, i); }
    else {
      rememberMiss(box, i);
      var note = box.querySelector(".cd-st-note");
      if (note) setHTML(note, "Пока не то — красным отмечено, где расхождение. Подумайте ещё или нажмите «Шаг ▶», чтобы увидеть ответ.");
    }
  }
  function stepsStop(box) {
    if (box.__play) { clearTimeout(box.__play); box.__play = 0; }
    var b = box.querySelector('[data-st="play"]'); if (b) b.textContent = "▶▶ Авто";
  }
  function stepsClick(btn) {
    var box = btn.closest(".cd-steps"); if (!box) return;
    var act = btn.getAttribute("data-st"), n = stepsData(box).length, rev = box.__rev || (box.__rev = {});
    var i = box.classList.contains("cd-st-on") ? (+box.getAttribute("data-i") || 0) : -1;  // -1: ещё не начинали
    if (act === "check") { stepsCheck(box); return; }
    if (act === "play") {
      if (box.__play) { stepsStop(box); return; }
      if (i >= n - 1 || i < 0) { rev[0] = 1; stepsShow(box, 0); }
      btn.textContent = "❚❚ Пауза";
      var tick = function () {
        if (!box.isConnected) { box.__play = 0; return; }
        var j = (+box.getAttribute("data-i") || 0) + 1;
        if (j >= n) { stepsStop(box); return; }
        rev[j] = 1;                                      // в автопросмотре загадки сразу с ответом
        stepsShow(box, j); box.__play = setTimeout(tick, 1200);
      };
      box.__play = setTimeout(tick, 1200);
      return;
    }
    stepsStop(box);
    // «Шаг ▶» на загадке сначала показывает ответ, а уже следующий — идёт дальше
    if (act === "next" && box.classList.contains("cd-st-asking")) { rev[i] = 1; box.__ok = -1; stepsShow(box, i); return; }
    stepsShow(box, act === "first" ? 0 : act === "prev" ? i - 1 : i + 1);
  }

  // ---- Босс темы ```boss : итоговый мини-проект. Открывается, когда тема отмечена «Изучено» ----
  //  Синтаксис: первая строка «# Название», дальше — условие в Markdown (можно с кодом и <details>).
  function renderBoss(src) {
    var raw = String(src).replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, ""), title = "Итоговое задание";
    var m = raw.match(/^#\s+(.*)\n?/);
    if (m) { title = m[1].trim(); raw = raw.slice(m[0].length); }
    var fk = fenceKey(raw, function () { return "boss:" + title; }), bid = fk.id;
    raw = fk.body;
    return '<div class="cd-boss" data-id="' + bid + '" id="boss-' + bid + '">' +
      '<div class="cd-boss-head"><span class="cd-boss-crown">👑</span><div><div class="cd-boss-kick">Босс темы</div>' +
      '<div class="cd-boss-title">' + inline(title) + "</div></div></div>" +
      '<div class="cd-boss-lock">🔒 Откроется, когда вы отметите тему «Изучено» — кнопкой вверху окна. ' +
      '<button class="cd-boss-peek" type="button">заглянуть сейчас</button></div>' +
      '<div class="cd-boss-body">' + renderMarkdown(raw, null) +
      '<button class="cd-boss-done" type="button">🏆 Босс побеждён</button></div></div>';
  }
  function refreshBoss() {
    if (!articleEl || !current) return;
    var open = !!state.read[current.rel];
    articleEl.querySelectorAll(".cd-boss").forEach(function (b) {
      var won = !!state.boss[b.getAttribute("data-id")];
      b.classList.toggle("open", open || !!b.__peek || won);
      b.classList.toggle("won", won);
      var d = b.querySelector(".cd-boss-done");
      if (d) d.textContent = won ? "🏆 Побеждён! (нажмите, чтобы снять отметку)" : "🏆 Босс побеждён";
      // после победы — 2–3 задачи из задачника той же темы, чтобы закрепить
      var nx = b.querySelector(".cd-boss-next");
      if (won && !nx) {
        var tasks = bossTasks(current.rel);
        if (tasks.length) {
          var up = new Array(current.rel.split("/").length).join("../");
          nx = document.createElement("div"); nx.className = "cd-boss-next";
          setHTML(nx, "<b>Закрепите победу</b> — задачи этой темы из задачника:" + '<div class="cd-boss-tasks">' +
            tasks.map(function (t) { return '<a href="' + escapeHtml(up + t.rel + "#" + t.slug) + '">' + inline(t.title) + "</a>"; }).join("") + "</div>");
          b.appendChild(nx);
        }
      } else if (!won && nx) nx.remove();
    });
  }
  function bossClick(t) {
    var peek = t.closest(".cd-boss-peek"), done = t.closest(".cd-boss-done");
    var box = t.closest(".cd-boss"); if (!box || !(peek || done)) return false;
    if (peek) box.__peek = 1;
    if (done) {
      var id = box.getAttribute("data-id");
      if (state.boss[id]) delete state.boss[id]; else { state.boss[id] = 1; recordActivity(); }
      saveState();
    }
    rememberSpot(box, "boss");
    refreshBoss();
    return true;
  }
  // Нерешённые задачи задачника «той же темы» (ref/05-stroki.md ↔ zadachnik/05-stroki.md): сперва 🟡/🔴, до трёх.
  function bossTasks(rel) {
    var base = String(rel).split("/").pop().toLowerCase();
    var list = collectTasks(true).filter(function (t) { return String(t.rel).toLowerCase().split("/").pop() === base && t.rel !== rel; });
    var hard = list.filter(function (t) { return /\uD83D[\uDFE1\uDD34]/.test(t.title); });
    return hard.concat(list.filter(function (t) { return hard.indexOf(t) < 0; })).slice(0, 3);
  }
  // Все разборы ```steps во всех материалах (для плитки на главном): id как у renderSteps.
  function stepsTotals() {
    var d = DATA(), total = 0, done = 0;
    if (d) d.files.forEach(function (f) {
      var md = String(f.md || ""), re = /```+[ \t]*steps[ \t]*\r?\n([\s\S]*?)\r?\n```+/gi, m;
      while ((m = re.exec(md))) { total++; if (state.stepsDone[fenceKey(m[1].replace(/\r\n?/g, "\n")).id]) done++; }
    });
    return { total: total, done: done };
  }

  // ---- «Ката» ```challenge : собери код из строк (parsons) или предскажи вывод (predict) ----
  //  Синтаксис (секции через строку «---»):
  //     @type parsons            ← режим (parsons | predict); по умолчанию parsons
  //     Собери сумму 1..n.       ← условие (можно несколько строк)
  //     ---
  //     int sum = 0;             ← parsons: эталонный код (строки перемешаются)
  //     for (...) sum += i;         predict: код-загадка, а ниже ещё «---» и ожидаемый вывод
  //  Автопроверка честная и без выполнения: parsons сверяет порядок строк, predict — вывод
  //  с эталоном. Прогресс решённого — в state.challenge (переживает перезапуск).
  function seededShuffle(arr, seed) {
    var a = arr.slice(), s = (seed >>> 0) || 1;
    for (var i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; var j = s % (i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function renderParsons(promptHtml, codeSrc, id, done) {
    var lines = String(codeSrc).replace(/^\n+|\n+$/g, "").split("\n").filter(function (l) { return l.trim() !== ""; });
    if (lines.length < 2) return "";                          // из одной строки собирать нечего
    var order = lines.map(function (_, i) { return i; });
    var shuffled = seededShuffle(order, id.length + lines.join("").length);  // детерминированно: порядок стабилен между перерисовками
    var bank = "";
    shuffled.forEach(function (idx) {
      bank += '<li class="cd-ch-item" data-t="' + encodeURIComponent(lines[idx]) + '"><span class="cd-ch-grip">⋮⋮</span><code>' + highlight(lines[idx], "cpp") + "</code></li>";
    });
    var sol = encodeURIComponent(JSON.stringify(lines));
    return '<div class="cd-ch cd-ch-parsons' + (done ? " done" : "") + '" data-id="' + escapeHtml(id) + '" data-sol="' + sol + '">' +
      '<div class="cd-ch-head"><span class="cd-ch-badge">собери код</span>' + promptHtml + "</div>" +
      '<div class="cd-ch-lab">детали — нажимай строки по порядку</div>' +
      '<ul class="cd-ch-bank">' + bank + "</ul>" +
      '<div class="cd-ch-lab">твоя программа:</div>' +
      '<ul class="cd-ch-sol" data-empty="кликни строки сверху — они встанут сюда"></ul>' +
      '<div class="cd-ch-ctl"><button class="cd-ch-check" type="button">Проверить</button>' +
      '<button class="cd-ch-reset" type="button">Сброс</button><span class="cd-ch-msg"></span></div></div>';
  }
  function renderPredict(promptHtml, codeSrc, expected, id, done) {
    var code = String(codeSrc).replace(/^\n+|\n+$/g, "");
    if (!code || expected == null) return "";
    return '<div class="cd-ch cd-ch-predict' + (done ? " done" : "") + '" data-id="' + escapeHtml(id) + '" data-exp="' + encodeURIComponent(String(expected).replace(/^\n+|\n+$/g, "")) + '">' +
      '<div class="cd-ch-head"><span class="cd-ch-badge">предскажи вывод</span>' + (promptHtml || "Что напечатает программа?") + "</div>" +
      '<pre class="code"><code>' + highlight(code, "cpp") + "</code></pre>" +
      '<div class="cd-pr-row"><input class="cd-pr-in" type="text" spellcheck="false" placeholder="что выведет код?">' +
      '<button class="cd-pr-check" type="button">Проверить</button>' +
      '<button class="cd-pr-reveal" type="button">Показать ответ</button></div>' +
      '<span class="cd-ch-msg"></span></div>';
  }
  function renderChallenge(src) {
    var fk = fenceKey(String(src).replace(/\r\n?/g, "\n")), raw = fk.body;
    var secs = raw.split(/^\s*---\s*$/m);
    var type = "parsons", prompt = [], hints = [];
    (secs[0] || "").split("\n").forEach(function (ln) {
      var mt = ln.match(/^\s*@type\s+(\w+)/i);
      if (mt) { type = mt[1].toLowerCase(); return; }
      var mh = ln.match(/^\s*@hint\s+(.+)$/i);       // лесенка подсказок: открываются по одной
      if (mh) { hints.push(mh[1].trim()); return; }
      if (ln.trim()) prompt.push(ln.trim());
    });
    var promptHtml = inline(prompt.join(" "));
    var id = fk.id, done = !!state.challenge[id];
    var extra = hintsHtml(hints, type === "run" ? secs[3] : null, done);
    if (type === "run") return renderRun(promptHtml, secs[1] || "", secs[2] != null ? secs[2] : "", id, done).replace(/<\/div>$/, extra + "</div>");
    if (extra) {
      var html = type === "predict" ? renderPredict(promptHtml, secs[1] || "", secs[2] != null ? secs[2] : "", id, done) : renderParsons(promptHtml, secs[1] || "", id, done);
      return html ? html.replace(/<\/div>$/, extra + "</div>") : html;
    }
    if (type === "predict") return renderPredict(promptHtml, secs[1] || "", secs[2] != null ? secs[2] : "", id, done);
    if (type === "run") return renderRun(promptHtml, secs[1] || "", secs[2] != null ? secs[2] : "", id, done);
    return renderParsons(promptHtml, secs[1] || "", id, done);
  }
  // Лесенка помощи под заданием: «💡 Подсказка 1 из N» открывает по одной; эталон (4-я секция
  // ```challenge @type run) — только после всех подсказок или после RUN_FAILS_FOR_SOLUTION неудачных запусков.
  var RUN_FAILS_FOR_SOLUTION = 3;
  function hintsHtml(hints, solution, done) {
    var sol = solution != null ? String(solution).replace(/^\n+|\n+$/g, "") : "";
    if (!hints.length && !sol) return "";
    var h = '<div class="cd-hints" data-shown="0" data-total="' + hints.length + '">';
    hints.forEach(function (t, i) { h += '<div class="cd-hint" hidden><b>Подсказка ' + (i + 1) + ".</b> " + inline(t) + "</div>"; });
    h += '<div class="cd-hints-ctl">';
    if (hints.length) h += '<button class="cd-hint-next" type="button">💡 Подсказка 1 из ' + hints.length + "</button>";
    if (sol) h += '<button class="cd-sol-show" type="button"' + (done ? "" : " disabled") + '>Показать решение</button><span class="cd-sol-why">' +
      (done ? "" : "откроется после всех подсказок или " + RUN_FAILS_FOR_SOLUTION + " попыток") + "</span>";
    h += "</div>";
    if (sol) h += '<div class="cd-sol" hidden><div class="cd-sol-lab">Эталонное решение — сравни со своим: где пошли одинаково, где иначе?</div>' +
      '<pre class="code"><code>' + highlight(sol, "cpp") + "</code></pre></div>";
    return h + "</div>";
  }
  // Можно ли уже открыть эталон: все подсказки открыты или набралось неудачных запусков.
  function syncSolution(box) {
    var hb = box && box.querySelector(".cd-hints"); if (!hb) return;
    var btn = hb.querySelector(".cd-sol-show"), why = hb.querySelector(".cd-sol-why"); if (!btn) return;
    var shown = +hb.getAttribute("data-shown") || 0, total = +hb.getAttribute("data-total") || 0;
    var fails = +box.getAttribute("data-fails") || 0, solved = box.classList.contains("done");
    var open = solved || shown >= total && total > 0 || fails >= RUN_FAILS_FOR_SOLUTION;
    btn.disabled = !open;
    if (why) why.textContent = open ? "" : total > shown
      ? "откроется после всех подсказок или " + RUN_FAILS_FOR_SOLUTION + " попыток"
      : "откроется после " + RUN_FAILS_FOR_SOLUTION + " попыток (сделано " + fails + ")";
  }
  function hintNext(btn) {
    var hb = btn.closest(".cd-hints"); if (!hb) return;
    var list = hb.querySelectorAll(".cd-hint"), shown = +hb.getAttribute("data-shown") || 0;
    if (shown < list.length) { list[shown].hidden = false; shown++; hb.setAttribute("data-shown", String(shown)); }
    if (shown >= list.length) btn.hidden = true;
    else btn.textContent = "💡 Подсказка " + (shown + 1) + " из " + list.length;
    try { noteHint(hb.closest(".cd-ch")); } catch (e) {}
    syncSolution(hb.closest(".cd-ch"));
  }
  function solutionShow(btn) {
    var hb = btn.closest(".cd-hints"); if (!hb || btn.disabled) return;
    var sol = hb.querySelector(".cd-sol"); if (sol) sol.hidden = false;
    btn.hidden = true;
    var chb = hb.closest(".cd-ch"); if (chb) { chb.__solShown = true; try { noteHint(chb); } catch (e) {} }
  }
  // Тесты формата «вход => ожидаемый вывод» (как ```tests); «#строка» — подпись.
  // «\n» внутри входа/вывода — перевод строки: так задаются многострочный ввод (getline) и вывод.
  function testUnesc(x) { return x.replace(/\\n/g, "\n"); }
  function testShow(x) { return escapeHtml(String(x)).replace(/\n/g, '<span class="cd-run-nl">⏎</span>'); }
  function parseTestLines(src) {
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n"), tests = [];
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].replace(/\s+$/, "");
      if (!t.trim() || t.trim().charAt(0) === "#") continue;
      var idx = t.indexOf("=>");
      if (idx < 0) continue;
      tests.push({ "in": testUnesc(t.slice(0, idx).trim()), "out": testUnesc(t.slice(idx + 2).trim()) });
    }
    return tests;
  }
  // «Напиши и запусти» (```challenge @type run): редактируемый код + компиляция хостом + прогон тестов.
  // Доступно только при cppDocs.localRun (data.run.enabled); иначе — код и тесты как справка.
  function renderRun(promptHtml, starterSrc, testsSrc, id, done) {
    var starter = String(starterSrc).replace(/^\n+|\n+$/g, "");
    var tests = parseTestLines(testsSrc);
    var enabled = !!(DATA() && DATA().run && DATA().run.enabled);
    var head = '<div class="cd-ch-head"><span class="cd-ch-badge">напиши и запусти</span>' + (promptHtml || "Напиши программу и проверь её на тестах") + "</div>";
    if (!enabled) {
      var rows = "";
      tests.forEach(function (t) { rows += "<tr><td><code>" + testShow(t["in"]) + "</code></td><td><code>" + testShow(t["out"]) + "</code></td></tr>"; });
      return '<div class="cd-ch cd-ch-run' + (done ? " done" : "") + '" data-id="' + escapeHtml(id) + '">' + head +
        '<pre class="code"><code>' + highlight(starter, "cpp") + "</code></pre>" +
        (rows ? '<div class="cd-ch-lab">тесты (вход → ожидается):</div><div class="tablewrap"><table><thead><tr><th>Ввод</th><th>Ожидается</th></tr></thead><tbody>' + rows + "</tbody></table></div>" : "") +
        '<div class="cd-run-hint">▶ Запуск в один клик выключен. Включи <code>cppDocs.localRun</code> в настройках и поставь компилятор (g++/clang++/MSVC), чтобы компилировать и проверять код прямо здесь.</div></div>';
    }
    var rowsN = Math.min(22, Math.max(6, starter.split("\n").length + 1));
    return '<div class="cd-ch cd-ch-run' + (done ? " done" : "") + '" data-id="' + escapeHtml(id) + '" data-tests="' + encodeURIComponent(JSON.stringify(tests)) + '">' + head +
      '<textarea class="cd-run-code" spellcheck="false" autocomplete="off" autocapitalize="off" rows="' + rowsN + '">' + escapeHtml(starter) + "</textarea>" +
      '<div class="cd-ch-ctl"><button class="cd-run-go" type="button">▶ Запустить</button>' +
      (tests.length ? '<span class="cd-run-tinfo">' + tests.length + " " + plural(tests.length, ["тест", "теста", "тестов"]) + "</span>" : "") +
      '<span class="cd-ch-msg"></span></div>' +
      '<div class="cd-run-out" hidden></div></div>';
  }

  // ==== runtime/03-markdown.js — рендер Markdown → HTML ====
  function renderMarkdown(md, headings) {
    // U+2028/U+2029 — невидимые «разделители строк»: регэкспы с «.» на них спотыкаются (fuzz-тест
    // нашёл так бесконечный цикл в списке). В тексте они ничем не отличаются от пробела.
    var lines = String(md).replace(/\r\n?/g, "\n").replace(/[\u2028\u2029]/g, " ").split("\n");
    var out = [];
    var i = 0;
    var sawTitle = false;

    function listBlock(startIndent) {
      // Рекурсивный разбор списка по отступам. Возвращает HTML одного уровня.
      var html = "";
      var type = null; // "ul" | "ol"
      var items = [];
      while (i < lines.length) {
        var line = lines[i];
        if (!line.trim()) { // пустая строка — заглянем: продолжается ли список
          var j = i + 1;
          if (j < lines.length && /^(\s*)([-*+]|\d+[.)])\s+/.test(lines[j])) { i++; continue; }
          break;
        }
        var m = line.match(/^(\s*)([-*+]|\d+[.)])\s+([\s\S]*)$/);
        if (!m) break;
        var indent = m[1].length;
        if (indent < startIndent) break;
        if (indent > startIndent) { // вложенный список — соберём в последний пункт
          var sub = listBlock(indent);
          if (items.length) items[items.length - 1].sub += sub;
          continue;
        }
        var thisType = /\d/.test(m[2]) ? "ol" : "ul";
        if (!type) type = thisType;
        i++;
        items.push({ text: m[3], sub: "" });
      }
      // Есть ли среди пунктов чек-бокс «- [ ] …» — тогда весь список рисуем как список задач.
      var hasTask = items.some(function (it) { return /^\[[ xX]\]\s+/.test(it.text); });
      html += "<" + (type || "ul") + (hasTask ? ' class="cd-tasklist"' : "") + ">";
      items.forEach(function (it) {
        var tm = it.text.match(/^\[([ xX])\]\s+([\s\S]*)$/);
        if (tm) {
          // Состояние берём только из localStorage (как у ```checklist), чтобы отметки жили
          // между перезапусками; исходное [x] служит лишь визуальной подсказкой автора.
          var id = cdHash(tm[2]), on = !!state.checks[id];
          html += '<li class="cd-tl"><button class="cd-tl-box' + (on ? " on" : "") +
            '" type="button" data-id="' + id + '" role="checkbox" aria-checked="' + (on ? "true" : "false") +
            '" aria-label="Отметить пункт"></button><span class="cd-tl-txt' + (on ? " done" : "") + '">' +
            inline(tm[2]) + "</span>" + it.sub + "</li>";
        } else {
          html += "<li>" + inline(it.text) + it.sub + "</li>";
        }
      });
      html += "</" + (type || "ul") + ">";
      return html;
    }

    var lastI = -1, stuck = 0;
    while (i < lines.length) {
      var line = lines[i];
      // Страховка от зависания: если ни один разбор блока не сдвинул позицию (странная строка,
      // которую узнал один регэксп и не узнал другой), выводим её абзацем и идём дальше.
      if (i === lastI) { if (++stuck > 2) { out.push("<p>" + inline(line) + "</p>"); i++; stuck = 0; continue; } }
      else { stuck = 0; lastI = i; }

      if (!line.trim()) { i++; continue; } // пустые строки между блоками
      // Служебные метки для проверок и сборки (<!-- docs:no-compile -->, <!-- docs:solutions:start -->)
      // — HTML-комментарий на отдельной строке ученику не показываем (раньше печатался текстом).
      if (/^\s*<!--[\s\S]*?-->\s*$/.test(line)) { i++; continue; }

      // Код в ограждении ```lang … ``` (после языка можно указать подсветку строк: ```cpp {3,5-7})
      var fence = line.match(/^\s*```+\s*([\w+#-]*)\s*(\{[\d,\s-]*\})?\s*$/);
      if (fence) {
        var lang = fence[1] || "";
        var hlSet = parseHlLines(fence[2]);
        i++;
        var buf = [];
        while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++; // закрывающая ```
        var code = buf.join("\n");
        var lc = (lang || "").toLowerCase();
        if (lc === "quiz") { out.push(renderQuiz(code)); continue; }       // интерактивный опросник
        if (lc === "findbug") { out.push(renderFindbug(code)); continue; } // «найди ошибку» + ответ
        if (lc === "cards") { out.push(renderCards(code)); continue; }      // флеш-карточки
        if (lc === "fillcode") { out.push(renderFillcode(code)); continue; } // заполни пропуск
        if (lc === "tests") { out.push(renderTests(code)); continue; }      // тесты к задаче
        if (lc === "hints") { out.push(renderHintsLadder(code)); continue; } // лесенка подсказок задачника
        if (lc === "badgood") { out.push(renderBadgood(code)); continue; }  // было/стало в две колонки
        if (lc === "console") { out.push(renderConsole(code)); continue; }  // транскрипт консоли
        if (lc === "diagram" || lc === "svg") { out.push(renderDiagram(code)); continue; } // схема
        if (lc === "checklist") { out.push(renderChecklist(code)); continue; } // чек-лист «усвоено»
        if (lc === "snippets") { out.push(renderSnippets(code)); continue; }   // таблица «Быстрые слова»: клик по строке — код
        if (lc === "boss") { out.push(renderBoss(code)); continue; }        // босс темы: итоговый мини-проект
        if (lc === "quests") { out.push(renderQuestMap()); continue; }      // «Путь героя»: квесты «Подземелья» с прогрессом
        if (lc === "lootsim") { var ls = renderLootSim(code); if (ls) { out.push(ls); continue; } }  // симулятор сундуков
        if (lc === "bfsgrid") { var bg = renderBfsGrid(code); if (bg) { out.push(bg); continue; } }  // волна поиска пути на сетке
        if (lc === "steps") { var sp = renderSteps(code); if (sp) { out.push(sp); continue; } }  // пошаговый проигрыватель
        if (lc === "frames") { var fv = renderFrames(code); if (fv) { out.push(fv); continue; } }  // кадры: ASCII-анимация
        if (lc === "memory") { var mv = renderMemory(code); if (mv) { out.push(mv); continue; } }  // память по шагам: стек/куча/указатели
        if (lc === "live") { var lv = renderLive(code); if (lv) { out.push(lv); continue; } }  // живой пример: параметры-слайдеры
        if (lc === "challenge") { var ch = renderChallenge(code); if (ch) { out.push(ch); continue; } }  // ката: собери код / предскажи вывод
        if (lc === "checkpoint") { var cpt = renderCheckpoint(code); if (cpt) { out.push(cpt); continue; } }  // эталон главы + сравнение с моим кодом
        if (lc === "repeat") { out.push(renderRepeat(code)); continue; }      // «Повтори за мной»: код примера спрятан, видно поведение
        var LANG_LABEL = { cpp: "C++", "c++": "C++", cc: "C++", cxx: "C++", c: "C", bash: "Bash", sh: "Bash", shell: "Bash", txt: "текст", text: "текст", py: "Python" };
        var langLabel = escapeHtml(LANG_LABEL[(lang || "").toLowerCase()] || lang || "код");
        var codeHtml;
        if (hlSet) {                                    // построчная подсветка нужных строк
          codeHtml = code.split("\n").map(function (ln, idx) {
            return '<span class="cd-ln' + (hlSet[idx + 1] ? " cd-hl" : "") + '">' +
              (highlight(ln, lang) || "​") + "</span>";
          }).join("");
        } else {
          codeHtml = highlight(code, lang);
        }
        // Другие применения того же приёма: следом идут блоки «```cpp alt: Подпись» — они не печатаются
        // отдельно, а становятся слайдами этого примера (стрелки справа). Страница не растёт.
        var alts = [], j = i;
        for (;;) {
          var k = j;
          while (k < lines.length && !lines[k].trim()) k++;
          var am = k < lines.length ? lines[k].match(/^\s*```+\s*([\w+#-]*)\s+alt:?\s*(.*?)\s*$/) : null;
          if (!am) break;
          var ab = [];
          for (k++; k < lines.length && !/^\s*```+\s*$/.test(lines[k]); k++) ab.push(lines[k]);
          alts.push({ lang: am[1] || lang, label: am[2] || "Ещё применение", code: ab.join("\n") });
          j = k + 1;
        }
        if (alts.length) {
          i = j;
          out.push(renderCodeAlts({ lang: lang, code: code, html: codeHtml, lined: !!hlSet }, alts, langLabel, lc));
          continue;
        }
        out.push(
          '<div class="codewrap">' +
          '<div class="codehead"><span class="codelang">' + langLabel + "</span>" +
          '<span class="cd-codebtns">' + (TOED_LANGS[lc] ? toEditorBtn(code) : "") +
          '<button class="cd-wrapbtn" type="button" title="Переносить длинные строки (для всех блоков кода)">↩ перенос</button>' +
          '<button class="copybtn" type="button" title="Копировать код" data-code="' + escapeHtml(code) + '"><span class="cb-ic">⧉</span> копировать</button></span></div>' +
          '<pre class="code' + (hlSet ? " cd-lined" : "") + '"><code>' + codeHtml + "</code></pre></div>"
        );
        continue;
      }

      // Спойлер <details>…</details> (подсказки задачника). Рендерер экранирует сырой HTML,
      // поэтому разбираем блок сами: <summary> → заголовок, остальное → markdown рекурсивно.
      // Нативный <details> сам сворачивается по клику — JS не нужен.
      if (/^\s*<details\b/i.test(line)) {
        i++;                                   // строка <details ...>
        var dbuf = [], depth = 1;
        while (i < lines.length) {
          if (/^\s*<details\b/i.test(lines[i])) depth++;
          if (/^\s*<\/details>/i.test(lines[i])) { depth--; if (depth === 0) { i++; break; } }
          dbuf.push(lines[i]); i++;
        }
        var dinner = dbuf.join("\n");
        var dsummary = "Показать";
        dinner = dinner.replace(/<summary>([\s\S]*?)<\/summary>/i, function (_, s) { dsummary = s.trim(); return ""; });
        out.push('<details class="cd-spoiler"><summary>' + inline(dsummary) + "</summary>" +
          '<div class="cd-spoiler-body">' + renderMarkdown(dinner, null) + "</div></details>");
        continue;
      }

      // Заголовок
      var h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (h) {
        var level = h[1].length;
        var htext = h[2];
        var slug = slugify(htext);
        if (level === 1 && !sawTitle) { sawTitle = true; i++; continue; } // первый # — это имя файла, оно в шапке читалки
        if (headings && level >= 2 && level <= 3) headings.push({ level: level, text: htext.replace(/`/g, ""), slug: slug });
        else if (headings && level === 1) headings.push({ level: 2, major: true, text: htext.replace(/`/g, ""), slug: slug });   // большой раздел: «Решения с разбором»
        // data-title держит «чистый» текст заголовка (без кнопки «#»), чтобы хлебные крошки
        // и активный раздел читались из него, а не из textContent, куда попадает «#».
        var hclean = escapeHtml(htext.replace(/`/g, ""));
        out.push("<h" + level + ' id="' + slug + '" data-title="' + hclean + '">' + inline(htext) +
          '<button class="cd-hmark" type="button" tabindex="-1" title="Добавить раздел в закладки"' +
          ' aria-label="Добавить в закладки" aria-pressed="false" data-slug="' + slug + '">☆</button>' +
          '<button class="cd-hlink" type="button" tabindex="-1" title="Копировать ссылку на раздел"' +
          ' aria-label="Копировать ссылку на раздел" data-slug="' + slug + '">#</button>' +
          "</h" + level + ">");
        i++;
        continue;
      }

      // Горизонтальная линия
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

      // Цитата/врезка (может быть многострочной). Цвет врезки — по ведущему значку.
      if (/^\s*>/.test(line)) {
        var q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          q.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        var qtext = q.join("\n");
        var lead = qtext.replace(/^[\s>*_]+/, "");   // снять пробелы и разметку перед значком
        var nc = "", nbg = "";
        if (lead.indexOf("⚠") === 0) { nc = "#f9b47a"; nbg = "rgba(250,179,135,.12)"; }
        else if (lead.indexOf("✅") === 0) { nc = "#a6e3a1"; nbg = "rgba(166,227,161,.12)"; }
        else if (lead.indexOf("❌") === 0) { nc = "#f38ba8"; nbg = "rgba(243,139,168,.12)"; }
        else if (lead.indexOf("💡") === 0) { nc = "#f9e2af"; nbg = "rgba(249,226,175,.12)"; }
        else if (lead.indexOf("📖") === 0) { nc = "#89b4fa"; nbg = "rgba(137,180,250,.12)"; }   // определение
        var nic = "";
        if (!nc) {                                    // без эмодзи: цвет + иконка по полужирной метке в начале врезки
          var lm = qtext.match(/^\s*\*\*\s*([^*]+?)\s*\*\*/);
          if (lm) { var cc = calloutColorByLabel(lm[1]); if (cc) { nc = cc[0]; nbg = cc[1]; nic = cc[2] || ""; } }
        }
        var hasIc = nic && typeof CD_ICONS !== "undefined" && CD_ICONS[nic];
        var attrs = nc ? ' class="note' + (hasIc ? " has-ic" : "") + '" style="--nc:' + nc + ';--nbg:' + nbg + '"' : "";
        var icImg = hasIc ? '<img class="cd-note-ic" alt="" aria-hidden="true" src="' + CD_ICONS[nic] + '">' : "";
        out.push("<blockquote" + attrs + ">" + icImg + renderMarkdown(qtext, null) + "</blockquote>");
        continue;
      }

      // Таблица
      if (line.indexOf("|") >= 0 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        var header = tableCells(line);
        // Выравнивание колонок из строки-разделителя: :--- слева, :--: по центру, ---: справа.
        var aligns = tableCells(lines[i + 1]).map(function (s) {
          var t = s.trim(), l = t.charAt(0) === ":", r = t.charAt(t.length - 1) === ":";
          return r && l ? "center" : r ? "right" : l ? "left" : "";
        });
        var alignAttr = function (idx) { return aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : ""; };
        i += 2; // шапка + разделитель
        var rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].indexOf("|") >= 0) {
          rows.push(tableCells(lines[i])); i++;
        }
        var thtml = '<div class="tablewrap"><table><thead><tr>';
        header.forEach(function (c, ci) { thtml += "<th" + alignAttr(ci) + ">" + inline(c) + "</th>"; });
        thtml += "</tr></thead><tbody>";
        rows.forEach(function (r) {
          thtml += "<tr>";
          for (var c = 0; c < header.length; c++) thtml += "<td" + alignAttr(c) + ">" + inline(r[c] || "") + "</td>";
          thtml += "</tr>";
        });
        thtml += "</tbody></table></div>";
        out.push(thtml);
        continue;
      }

      // Список
      if (/^(\s*)([-*+]|\d+[.)])\s+/.test(line)) { out.push(listBlock(line.match(/^\s*/)[0].length)); continue; }

      // Абзац: копим строки до пустой или до начала другого блока
      var para = [];
      while (i < lines.length && lines[i].trim() &&
             !/^\s*```/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) &&
             !/^\s*>/.test(lines[i]) && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i]) &&
             !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i]) &&
             !(lines[i].indexOf("|") >= 0 && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
        para.push(lines[i]); i++;
      }
      if (para.length) out.push("<p>" + inline(para.join(" ")) + "</p>");
    }
    return out.join("\n");
  }

  // ==== runtime/04-theme.js — тема и акцентный цвет ====
  // ---------------------------------------------------------------------------
  //  Тема: светлая/тёмная берётся из класса воркбенча VS Code.
  // ---------------------------------------------------------------------------
  function isLight() {
    if (state.theme === "light" || state.theme === "sepia") return true;  // ручной выбор (сепия — светлая по токенам)
    if (state.theme === "dark") return false;
    try {
      var bc = document.body && document.body.classList;
      if (bc && (bc.contains("vscode-light") || bc.contains("vscode-high-contrast-light"))) return true;
      if (bc && (bc.contains("vscode-dark") || bc.contains("vscode-high-contrast"))) return false;
      var wb = document.querySelector(".monaco-workbench");
      if (wb && wb.classList) {
        if (wb.classList.contains("vs") && !wb.classList.contains("vs-dark") && !wb.classList.contains("hc-black")) return true;
        if (wb.classList.contains("vs-dark") || wb.classList.contains("hc-black")) return false;
      }
      return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
    } catch (e) { return false; }
  }

  // ---------------------------------------------------------------------------
  //  Акцентный цвет — под тему пользователя.
  //  Берём его из живых CSS-переменных оболочки VS Code (окно живёт в её DOM, а не в
  //  песочнице webview, поэтому переменные доступны). Приоритет:
  //    1) --mlbg-accent(-rgb) от MoonLight custom-bg — это акцент, которым он красит весь
  //       редактор (обычно вычислен из обоев); так окно совпадает с остальным интерфейсом
  //       и само меняется вслед за сменой обоев/слайд-шоу;
  //    2) --vscode-focusBorder / кнопки / ссылки — сам акцент активной темы;
  //    3) запасной Catppuccin-синий, если ничего не нашли.
  //  Значение (r,g,b) выставляем в --cppdocs-ac / --cppdocs-ac-rgb / --cppdocs-ac2 на :root,
  //  откуда его наследуют и окно, и кнопка-запуск. Обновляется в heal (тема/обои сменились).
  function readCssVar(name) {
    var els = [document.documentElement, document.body, document.querySelector(".monaco-workbench")];
    for (var i = 0; i < els.length; i++) {
      if (!els[i]) continue;
      try { var v = getComputedStyle(els[i]).getPropertyValue(name).trim(); if (v) return v; } catch (e) {}
    }
    return "";
  }
  function toRgb(str) {
    str = String(str || "").trim();
    if (!str) return null;
    var m;
    if ((m = str.match(/^#([0-9a-fA-F]{3})$/))) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
    if ((m = str.match(/^#([0-9a-fA-F]{6,8})$/))) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    if ((m = str.match(/rgba?\(([^)]+)\)/i))) {
      var p = m[1].split(",").map(function (x) { return parseFloat(x); });
      if (p.length >= 3 && p.slice(0, 3).every(function (n) { return isFinite(n); })) return [p[0] | 0, p[1] | 0, p[2] | 0];
    }
    // строка вида "137, 180, 250" (формат --mlbg-accent-rgb)
    if (/^\d[\d.\s,]*$/.test(str)) {
      var q = str.split(",").map(function (x) { return parseFloat(x); });
      if (q.length >= 3 && q.slice(0, 3).every(function (n) { return isFinite(n); })) return [q[0] | 0, q[1] | 0, q[2] | 0];
    }
    return null;
  }
  function resolveAccentRgb() {
    var rgb = toRgb(readCssVar("--mlbg-accent-rgb")) || toRgb(readCssVar("--mlbg-accent"));
    if (!rgb) {
      var cands = ["--vscode-focusBorder", "--vscode-button-background", "--vscode-textLink-foreground", "--vscode-progressBar-background"];
      for (var i = 0; i < cands.length && !rgb; i++) rgb = toRgb(readCssVar(cands[i]));
    }
    if (!rgb) rgb = isLight() ? [30, 102, 245] : [137, 180, 250];
    return rgb;
  }
  function mix(rgb, amt) { // amt 0..1 в сторону белого
    return [Math.round(rgb[0] + (255 - rgb[0]) * amt), Math.round(rgb[1] + (255 - rgb[1]) * amt), Math.round(rgb[2] + (255 - rgb[2]) * amt)];
  }
  // Контраст по WCAG: относительная яркость и отношение двух цветов.
  function lum(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  // Светлая тема/сепия поверх тёмного VS Code: акцент темы редактора светлый (сиреневый Mocha)
  // и на светлом фоне не читается. Затемняем его, сохраняя оттенок, до контраста ≥ 4.5:1.
  function darkenFor(rgb, bg) {
    var out = rgb.slice();
    for (var i = 0; i < 40 && contrast(out, bg) < 4.5; i++) out = out.map(function (v) { return Math.round(v * 0.92); });
    return out;
  }
  var _lastAccent = "", _accentSig = "";
  // MoonLight custom-bg сообщает о смене акцента событием — перекрашиваемся сразу, не ждём
  // тикера heal (иначе окно отставало от смены обоев на секунду-две).
  cdOnGlobal(window, "mlbg-accent", function () { _accentSig = ""; applyAccent(); });
  function applyAccent() {
    try {
      // Дешёвая сигнатура «могло ли что-то поменяться»: тема-класс оболочки + ручная тема +
      // текущий mlbg-акцент (один readCssVar). Пока не изменилась — не зовём resolveAccentRgb
      // (тот делает до ~18 getComputedStyle). Так heal на тикере почти не стоит стилевого пересчёта.
      var wb = document.querySelector(".monaco-workbench");
      var sig = (wb ? wb.className : "") + "|" + state.theme + "|" + state.palette + "|" + readCssVar("--mlbg-accent-rgb");
      if (sig === _accentSig) return;
      _accentSig = sig;
      var pal = activePalette();
      var rgb = pal ? toRgb(pal.ac) : resolveAccentRgb();   // своя палитра — свой акцент, иначе из редактора
      if (isLight()) rgb = darkenFor(rgb, state.theme === "sepia" ? [244, 236, 220] : [250, 250, 252]);
      var key = rgb.join(",") + "/" + (isLight() ? "l" : "d");
      if (key === _lastAccent) return;      // ничего не изменилось — не трогаем стиль
      _lastAccent = key;
      var ac2 = isLight() ? rgb : mix(rgb, 0.32); // на тёмной — светлее, для заголовков
      var s = document.documentElement.style;
      s.setProperty("--cppdocs-ac", "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")");
      s.setProperty("--cppdocs-ac-rgb", rgb[0] + "," + rgb[1] + "," + rgb[2]);
      s.setProperty("--cppdocs-ac2", "rgb(" + ac2[0] + "," + ac2[1] + "," + ac2[2] + ")");
    } catch (e) {}
  }

  // ==== runtime/05-css.js — стили окна и палитры ====
  // ---------------------------------------------------------------------------
  //  Стиль окна (один <style> на документ).
  // ---------------------------------------------------------------------------
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = applyNonce(el("style")); st.id = STYLE_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
    ensureFonts();
  }
  // Встроенные шрифты чтения (extension/fonts/). Браузер качает файл, только когда шрифт реально
  // выбран, и только нужный диапазон (кириллица/латиница). Папку берём из data.extDirUrl — она
  // приходит с файлом данных, поэтому зовём и после его загрузки.
  var FONT_RANGES = {
    cyrillic: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116",
    latin: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  };
  var FONT_FILES = [   // [имя семейства, файл без -<диапазон>.woff2, насыщенность]
    ["CppDocs Inter", "inter", "400 700"], ["CppDocs Golos", "golos-text", "400 700"],
    ["CppDocs PT Sans", "pt-sans-400", "400"], ["CppDocs PT Sans", "pt-sans-700", "700"],
  ];
  function ensureFonts() {
    if (document.getElementById(STYLE_ID + "-fonts")) return;
    var d = DATA(), dir = (d && d.extDirUrl) || bootVal("extDirUrl");
    var base = dir ? resUrl(String(dir).replace(/\/+$/, "") + "/fonts") : null;
    if (!base) return;
    var css = "";
    FONT_FILES.forEach(function (f) {
      Object.keys(FONT_RANGES).forEach(function (r) {
        css += "@font-face{font-family:'" + f[0] + "';font-style:normal;font-weight:" + f[2] + ";font-display:swap;" +
          "src:url(" + base + "/" + f[1] + "-" + r + ".woff2) format('woff2');unicode-range:" + FONT_RANGES[r] + ";}\n";
      });
    });
    var st = applyNonce(el("style")); st.id = STYLE_ID + "-fonts"; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---------------------------------------------------------------------------
  //  Палитры окна (Настройки → Палитра). «Как в редакторе» (auto) — прежнее поведение:
  //  акцент из custom-bg / темы VS Code, фон Catppuccin. Остальные — готовые наборы для тех,
  //  у кого нет обоев custom-bg: свой фон с мягким свечением, свой акцент и цвета подсветки кода.
  //  В светлой теме и сепии палитра меняет только акцент (его затемняет darkenFor под контраст).
  // ---------------------------------------------------------------------------
  var PALETTES = {
    mocha:    { name: "Catppuccin",  bg: "#181825", panel: "#1e1e2e", code: "#11111b", fg: "#cdd6f4", muted: "#a6adc8", faint: "#7f849c", ac: "#cba6f7", glow: "#89b4fa", tc: "#6c7086", ts: "#a6e3a1", tp: "#f38ba8", tn: "#fab387", tk: "#cba6f7", ty: "#f9e2af", tf: "#89b4fa" },
    tokyo:    { name: "Tokyo Night", bg: "#1a1b26", panel: "#1f2335", code: "#16161e", fg: "#c0caf5", muted: "#a9b1d6", faint: "#737aa2", ac: "#7aa2f7", glow: "#bb9af7", tc: "#565f89", ts: "#9ece6a", tp: "#f7768e", tn: "#ff9e64", tk: "#bb9af7", ty: "#e0af68", tf: "#7dcfff" },
    dracula:  { name: "Dracula",     bg: "#21222c", panel: "#282a36", code: "#191a21", fg: "#f8f8f2", muted: "#bfc3d9", faint: "#7f87b3", ac: "#bd93f9", glow: "#ff79c6", tc: "#6272a4", ts: "#50fa7b", tp: "#ff5555", tn: "#ffb86c", tk: "#ff79c6", ty: "#f1fa8c", tf: "#8be9fd" },
    nord:     { name: "Nord",        bg: "#2e3440", panel: "#353c4a", code: "#272c36", fg: "#eceff4", muted: "#d8dee9", faint: "#8f9ab0", ac: "#88c0d0", glow: "#81a1c1", tc: "#7b88a1", ts: "#a3be8c", tp: "#bf616a", tn: "#d08770", tk: "#b48ead", ty: "#ebcb8b", tf: "#81a1c1" },
    gruvbox:  { name: "Gruvbox",     bg: "#1d2021", panel: "#282828", code: "#171a1b", fg: "#ebdbb2", muted: "#d5c4a1", faint: "#a89984", ac: "#fe8019", glow: "#fabd2f", tc: "#928374", ts: "#b8bb26", tp: "#fb4934", tn: "#fe8019", tk: "#d3869b", ty: "#fabd2f", tf: "#83a598" },
    rosepine: { name: "Rosé Pine",   bg: "#191724", panel: "#1f1d2e", code: "#14121e", fg: "#e0def4", muted: "#aaa6c8", faint: "#817d9e", ac: "#ebbcba", glow: "#c4a7e7", tc: "#6e6a86", ts: "#9ccfd8", tp: "#eb6f92", tn: "#f6c177", tk: "#c4a7e7", ty: "#f6c177", tf: "#9ccfd8" },
    onedark:  { name: "One Dark",    bg: "#21252b", panel: "#282c34", code: "#1b1f24", fg: "#d7dae0", muted: "#abb2bf", faint: "#7f848e", ac: "#61afef", glow: "#c678dd", tc: "#7f848e", ts: "#98c379", tp: "#e06c75", tn: "#d19a66", tk: "#c678dd", ty: "#e5c07b", tf: "#61afef" },
    forest:   { name: "Лес",         bg: "#141d18", panel: "#1a2620", code: "#0f1612", fg: "#dde9e0", muted: "#a9c2b1", faint: "#76917f", ac: "#7fd4a0", glow: "#d8c97a", tc: "#6b8574", ts: "#9fdc8c", tp: "#e8828a", tn: "#e3a46f", tk: "#b8a4e0", ty: "#e6d27f", tf: "#7cc7d6" },
    sunset:   { name: "Закат",       bg: "#1f1520", panel: "#281b29", code: "#170f18", fg: "#f3e3e6", muted: "#cfb3bb", faint: "#96788a", ac: "#ff9e7a", glow: "#e879b9", tc: "#8a6a7c", ts: "#b5dd8c", tp: "#ff6f91", tn: "#ffb86b", tk: "#d9a6ff", ty: "#ffd479", tf: "#7fc8f8" },
  };
  function activePalette() { return state.palette && PALETTES[state.palette] ? PALETTES[state.palette] : null; }
  // CSS наборов: токены тёмной темы + фон окна с двумя мягкими пятнами света (вместо обоев).
  function paletteCss() {
    return Object.keys(PALETTES).map(function (k) {
      var P = PALETTES[k], rgb = function (h) { return toRgb(h).join(","); };
      return "#" + WIN_ID + ".pal-" + k + ":not(.light):not(.sepia){" +
        "--bg:rgba(" + rgb(P.bg) + ",.985);--panel:" + P.panel + ";--nav:rgba(" + rgb(P.code) + ",.55);--code:" + P.code + ";" +
        "--fg:" + P.fg + ";--muted:" + P.muted + ";--faint:" + P.faint + ";--bd:rgba(" + rgb(P.fg) + ",.13);--bd2:rgba(" + rgb(P.fg) + ",.07);" +
        "--tc:" + P.tc + ";--ts:" + P.ts + ";--tp:" + P.tp + ";--tn:" + P.tn + ";--tk:" + P.tk + ";--ty:" + P.ty + ";--tf:" + P.tf + ";" +
        "background:radial-gradient(900px 520px at -5% -12%,rgba(" + rgb(P.ac) + ",.17),transparent 62%)," +
        "radial-gradient(820px 560px at 108% 112%,rgba(" + rgb(P.glow) + ",.13),transparent 60%),var(--bg);}";
    }).join("");
  }

  var CSS =
  // ---- Дизайн-токены (2026-09-26): скругления, длительности, тени — одна шкала вместо «на глаз» ----
  // Префикс --cd- — чтобы не пересечься с переменными VS Code. Меняешь шкалу здесь — меняется всё окно.
  ":root{--cd-r-xs:4px;--cd-r-sm:6px;--cd-r-md:8px;--cd-r-lg:10px;--cd-r-xl:12px;--cd-r-2xl:16px;--cd-r-pill:999px;" +
    "--cd-t-fast:.12s;--cd-t-slow:.25s;" +
    "--cd-sh-1:0 1px 2px rgba(0,0,0,.10);--cd-sh-2:0 8px 24px rgba(0,0,0,.32);--cd-sh-3:0 12px 40px rgba(0,0,0,.45);" +
    "--cd-sp-1:4px;--cd-sp-2:8px;--cd-sp-3:12px;--cd-sp-4:16px;--cd-sp-5:24px;}" +
  // Акцент приходит из :root (--cppdocs-ac* ставит applyAccent под тему/обои); хекс-значения —
  // запасные, если JS ещё не отработал или переменных нет. --ac-rgb нужен для полупрозрачных
  // оттенков rgba(var(--ac-rgb), .N). --tf оставлен фиксированным — это цвет кода, не UI-акцент.
  "#" + WIN_ID + "{--ac:var(--cppdocs-ac,#89b4fa);--ac2:var(--cppdocs-ac2,#b4befe);--ac-rgb:var(--cppdocs-ac-rgb,137,180,250);" +
  "--bg:rgba(24,24,37,.98);--panel:#1e1e2e;--nav:rgba(17,17,27,.6);" +
  "--fg:#cdd6f4;--muted:#a6adc8;--faint:#7f849c;--bd:rgba(205,214,244,.14);--bd2:rgba(205,214,244,.08);--code:#11111b;" +
  "--tc:#6c7086;--ts:#a6e3a1;--tp:#f38ba8;--tn:#fab387;--tk:#cba6f7;--ty:#f9e2af;--tf:#89b4fa;--hl:rgba(var(--ac-rgb),.14);}" +
  "#" + WIN_ID + ".light{--bg:rgba(250,250,252,.99);--panel:#eff1f5;--nav:rgba(230,233,239,.6);" +
  "--fg:#1e1e2e;--muted:#5c5f77;--faint:#8c8fa1;--bd:rgba(30,30,46,.14);--bd2:rgba(30,30,46,.07);--code:#eff1f5;" +
  "--tc:#8c8fa1;--ts:#40a02b;--tp:#d20f39;--tn:#fe640b;--tk:#8839ef;--ty:#df8e1d;--tf:#1e66f5;--hl:rgba(var(--ac-rgb),.10);}" +
  // Сепия — тёплый «бумажный» фон, мягче для глаз (токены кода светлые, но приглушённо-тёплые)
  "#" + WIN_ID + ".sepia{--bg:rgba(244,236,220,.99);--panel:#efe6d3;--nav:rgba(233,223,203,.62);" +
  "--fg:#453a2a;--muted:#7a6a52;--faint:#a4977c;--bd:rgba(69,58,42,.16);--bd2:rgba(69,58,42,.08);--code:#ece2cd;" +
  "--tc:#a4977c;--ts:#5c8a3a;--tp:#b04a2f;--tn:#b0742f;--tk:#7d5aa0;--ty:#8a6a1a;--tf:#3a6a9a;--hl:rgba(var(--ac-rgb),.12);}" +
  // Межстрочный интервал (Настройки → Интервал)
  "#" + WIN_ID + " .cd-article.cd-lh-tight p,#" + WIN_ID + " .cd-article.cd-lh-tight li{line-height:1.45;}" +
  "#" + WIN_ID + " .cd-article.cd-lh-roomy p,#" + WIN_ID + " .cd-article.cd-lh-roomy li{line-height:1.95;}" +
  // Режим фокуса: скрыть список слева и оглавление справа, дать тексту удобную ширину по центру
  "#" + WIN_ID + ".focus .cd-nav{display:none;}" +
  "#" + WIN_ID + ".focus .cd-outline{display:none;}" +
  "#" + WIN_ID + ".focus .cd-article{max-width:760px;margin-left:auto;margin-right:auto;}" +
  // Прозрачность, пока курсор не на окне (Настройки → Прозрачность): не мешает писать код, наведёшь — чёткое
  "#" + WIN_ID + ".ghost-soft,#" + WIN_ID + ".ghost-strong{transition:opacity .18s ease;}" +
  "#" + WIN_ID + ".ghost-soft{opacity:.66;}" +
  "#" + WIN_ID + ".ghost-strong{opacity:.32;}" +
  "#" + WIN_ID + ".ghost-soft:hover,#" + WIN_ID + ".ghost-strong:hover,#" + WIN_ID + ".ghost-soft:focus-within,#" + WIN_ID + ".ghost-strong:focus-within{opacity:1;}" +
  // Мини-режим: свёрнуто в полоску-заголовок (кнопка ⎯ или двойной клик по шапке)
  "#" + WIN_ID + ".rolled{height:auto!important;min-height:0!important;}" +
  "#" + WIN_ID + ".rolled .cd-body{display:none;}" +
  // свёрнутая полоска — по содержимому, а не на всю ширину редактора
  "#" + WIN_ID + ".rolled{width:var(--roll-w,720px)!important;max-width:calc(100vw - 16px);}" +
  "#" + WIN_ID + ".rolled .cd-title{flex:0 1 auto;}" +
  "#" + WIN_ID + ".rolled .cd-title>b{display:none;}" +
  "#" + WIN_ID + " .cd-rollinfo{display:none;}" +
  "#" + WIN_ID + ".rolled .cd-rollinfo{display:block;min-width:0;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--bd);background:var(--panel);color:var(--fg);border-radius:var(--cd-r-md);padding:3px 10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;}" +
  "#" + WIN_ID + ".rolled .cd-rollinfo:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + ".rolled .cd-rz-s,#" + WIN_ID + ".rolled .cd-rz-se{display:none;}" +
  // Маркер по тексту: выделение (клик — убрать) + всплывающая кнопка «Выделить» (она вне #WIN)
  "#" + WIN_ID + " .cd-article .cd-hlu{border-radius:3px;padding:0 1px;cursor:pointer;transition:filter var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-hlu:hover{filter:brightness(1.18);}" +
  "#" + WIN_ID + " .cd-article .cd-hlu-y{background:rgba(249,226,175,.36);}" +
  "#" + WIN_ID + " .cd-article .cd-hlu-p{background:rgba(243,139,168,.34);}" +
  "#" + WIN_ID + " .cd-article .cd-hlu-g{background:rgba(166,227,161,.34);}" +
  "#" + WIN_ID + ".light .cd-article .cd-hlu-y,#" + WIN_ID + ".sepia .cd-article .cd-hlu-y{background:rgba(223,142,29,.30);}" +
  "#" + WIN_ID + ".light .cd-article .cd-hlu-p,#" + WIN_ID + ".sepia .cd-article .cd-hlu-p{background:rgba(210,15,57,.20);}" +
  "#" + WIN_ID + ".light .cd-article .cd-hlu-g,#" + WIN_ID + ".sepia .cd-article .cd-hlu-g{background:rgba(64,160,43,.24);}" +
  ".cd-hlpop{position:fixed;z-index:2147483001;display:flex;align-items:center;gap:7px;padding:6px 9px;background:#1e1e2e;border:1px solid rgba(205,214,244,.18);border-radius:var(--cd-r-lg);box-shadow:0 6px 20px rgba(0,0,0,.45);}" +
  ".cd-hlpop .cd-hlpop-ic{font-size:13px;line-height:1;opacity:.85;}" +
  ".cd-hlpop .cd-hlpop-c{width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,.25);cursor:pointer;padding:0;transition:transform .1s;}" +
  ".cd-hlpop .cd-hlpop-c:hover{transform:scale(1.15);}" +
  ".cd-hlpop .cd-hlpop-note{margin-left:3px;padding:3px 9px;border-radius:var(--cd-r-md);border:1px solid rgba(205,214,244,.25);background:transparent;color:#cdd6f4;font:600 11.5px system-ui,sans-serif;cursor:pointer;white-space:nowrap;}" +
  ".cd-hlpop .cd-hlpop-note:hover{border-color:#89b4fa;background:rgba(137,180,250,.14);}" +
  ".cd-toast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483002;max-width:min(460px,90vw);padding:9px 16px;border-radius:var(--cd-r-lg);background:#1e1e2e;color:#cdd6f4;border:1px solid #a6e3a1;box-shadow:var(--cd-sh-3);font:600 12.5px system-ui,sans-serif;pointer-events:none;}" +
  ".cd-toast.bad{border-color:#f38ba8;}" +
  ".cd-hlpop .cd-hlpop-y{background:#f9e2af;}" +
  ".cd-hlpop .cd-hlpop-p{background:#f38ba8;}" +
  ".cd-hlpop .cd-hlpop-g{background:#a6e3a1;}" +

  "#" + WIN_ID + "{position:fixed;z-index:2147483000;display:flex;flex-direction:column;" +
  "background:var(--bg);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:var(--fg);" +
  "border:1px solid rgba(var(--ac-rgb),.28);border-radius:var(--cd-r-2xl);box-shadow:0 18px 60px rgba(0,0,0,.55);" +
  "font-family:var(--vscode-font-family,'Segoe UI',system-ui,sans-serif);font-size:13px;overflow:hidden;}" +
  "#" + WIN_ID + " *{box-sizing:border-box;}" +
  // Атрибут hidden должен реально прятать элемент. У .cd-split и .cd-tabs задан display:flex,
  // который перебивает браузерное [hidden]{display:none} (равная специфичность, автор позже) —
  // поэтому скрытый сплит/вкладки оставались во flex-потоке пустой колонкой. Форсим скрытие.
  "#" + WIN_ID + " [hidden]{display:none!important;}" +
  "@media (prefers-reduced-motion: reduce){#" + WIN_ID + ",#" + WIN_ID + " *,#" + BTN_ID + "{transition:none!important;animation:none!important;}}" +

  // Шапка = ручка перетаскивания
  "#" + WIN_ID + " .cd-head{display:flex;align-items:center;gap:9px;padding:10px 12px;cursor:move;user-select:none;" +
  "border-bottom:1px solid var(--bd);background:linear-gradient(180deg,rgba(var(--ac-rgb),.10),transparent);}" +
  "#" + WIN_ID + " .cd-title{display:flex;align-items:center;gap:9px;font-weight:700;font-size:13px;letter-spacing:.2px;flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-title b{color:var(--ac2);font-weight:700;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-logo{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:var(--cd-r-md);overflow:hidden;font-size:13px;cursor:pointer;" +
  "background:rgba(var(--ac-rgb),.16);box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.30);}" +
  "#" + WIN_ID + " .cd-logo img{width:100%;height:100%;display:block;}" +
  "#" + WIN_ID + " .cd-hbtn{flex:0 0 auto;width:26px;height:24px;line-height:1;border:none;border-radius:var(--cd-r-md);cursor:pointer;" +
  "background:transparent;color:var(--muted);font-size:14px;display:inline-flex;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-hbtn:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-hbtn:disabled{opacity:.28;cursor:default;background:transparent;}" +

  // Навигация по маршруту (пред./след. файл) внизу статьи
  "#" + WIN_ID + " .cd-routenav{display:flex;gap:12px;justify-content:space-between;margin:36px 0 6px;padding-top:18px;border-top:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-rn{flex:1 1 0;min-width:0;border:1px solid var(--bd);background:var(--panel);border-radius:var(--cd-r-lg);padding:9px 14px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:2px;transition:border-color var(--cd-t-fast),background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-rn-next{text-align:right;align-items:flex-end;}" +
  "#" + WIN_ID + " .cd-article .cd-winhide{display:none!important;}" +
  "#" + WIN_ID + " .cd-article .cd-secoff{display:none!important;}" +
  "#" + WIN_ID + " .cd-article .cd-secbar{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:7px 8px;border:1px solid var(--bd);border-radius:var(--cd-r-lg);background:var(--panel);font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-sect{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;}" +
  "#" + WIN_ID + " .cd-article .cd-secp{flex:0 0 90px;height:5px;border-radius:3px;background:var(--bd2);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-article .cd-secp i{display:block;height:100%;background:var(--ac);border-radius:3px;transition:width .2s;}" +
  "#" + WIN_ID + " .cd-article .cd-secb{border:1px solid var(--bd);background:var(--bg);color:var(--fg);border-radius:var(--cd-r-md);width:28px;height:24px;cursor:pointer;font:inherit;font-size:15px;line-height:1;}" +
  "#" + WIN_ID + " .cd-article .cd-secb:disabled{opacity:.35;cursor:default;}" +
  "#" + WIN_ID + " .cd-article .cd-secnext{display:block;width:100%;margin:26px 0 0;padding:11px 16px;border:1px solid rgba(var(--ac-rgb),.5);border-radius:var(--cd-r-xl);background:rgba(var(--ac-rgb),.10);color:var(--fg);font:inherit;font-size:13px;font-weight:700;cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-article .cd-secnext:hover{background:rgba(var(--ac-rgb),.2);}" +
  "#" + WIN_ID + " .cd-article .cd-secnext[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-article blockquote.cd-lead{border-left:0;background:none;padding:0;margin:-4px 0 8px;color:var(--muted);font-size:13px;}" +
  "#" + WIN_ID + " .cd-article blockquote.cd-lead p{margin:0;}" +
  "#" + WIN_ID + " .cd-article a.cd-dictchip{display:inline-block;margin:0 0 14px;padding:3px 11px;border:1px solid var(--bd);border-radius:var(--cd-r-pill);font-size:11.5px;text-decoration:none;color:var(--muted);background:var(--panel);}" +
  "#" + WIN_ID + " .cd-article a.cd-dictchip:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rn-done{display:flex;flex-direction:column;align-items:center;gap:2px;width:100%;margin:36px 0 -18px;padding:12px 16px;border:1px solid rgba(var(--ac-rgb),.55);border-radius:var(--cd-r-xl);background:rgba(var(--ac-rgb),.12);color:var(--fg);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;transition:background var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-rn-done:hover{background:rgba(var(--ac-rgb),.22);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-rn-done-s{font-size:11.5px;font-weight:500;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-rn-done + .cd-routenav{margin-top:30px;}" +
  "#" + WIN_ID + " .cd-rn:hover{border-color:var(--ac);background:var(--hl);}" +
  "#" + WIN_ID + " .cd-rn-dir{font-size:10.5px;color:var(--faint);font-weight:700;}" +
  "#" + WIN_ID + " .cd-rn-t{font-size:12.5px;color:var(--ac);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}" +

  // Тело: навигатор + читалка
  "#" + WIN_ID + " .cd-body{flex:1 1 auto;display:flex;min-height:0;}" +
  "#" + WIN_ID + " .cd-nav{flex:0 0 auto;width:300px;min-width:0;display:flex;flex-direction:column;background:var(--nav);border-right:1px solid var(--bd);min-height:0;}" +
  "#" + WIN_ID + ".navhidden .cd-nav{display:none;}" +
  "#" + WIN_ID + " .cd-search{position:relative;padding:10px 10px 6px;}" +
  "#" + WIN_ID + " .cd-search input{width:100%;padding:8px 28px 8px 30px;border-radius:var(--cd-r-md);border:1px solid var(--bd);" +
  "background:var(--panel);color:var(--fg);font-family:inherit;font-size:12.5px;outline:none;}" +
  "#" + WIN_ID + " .cd-search input:focus{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-search .cd-si{position:absolute;left:20px;top:50%;transform:translateY(-40%);opacity:.5;font-size:13px;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-search .cd-sx{position:absolute;right:16px;top:50%;transform:translateY(-45%);border:none;background:none;color:var(--faint);cursor:pointer;font-size:13px;display:none;}" +
  "#" + WIN_ID + " .cd-search .cd-sx:hover{color:var(--fg);}" +

  // Прогресс
  "#" + WIN_ID + " .cd-prog{display:flex;align-items:center;gap:8px;padding:2px 12px 8px;}" +
  "#" + WIN_ID + " .cd-continue{flex:0 0 auto;border:none;cursor:pointer;padding:4px 10px;border-radius:var(--cd-r-pill);font-family:inherit;font-size:11px;font-weight:700;" +
  "background:rgba(var(--ac-rgb),.16);color:var(--ac);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-continue:hover{background:var(--ac);color:#fff;}" +
  "#" + WIN_ID + " .cd-continue[disabled]{opacity:.4;cursor:default;}" +
  "#" + WIN_ID + " .cd-bar{flex:1 1 auto;height:5px;border-radius:var(--cd-r-pill);background:var(--bd);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-fill{height:100%;width:0;background:var(--ac);transition:width var(--cd-t-slow);}" +
  "#" + WIN_ID + " .cd-ptext{flex:0 0 auto;font-size:10.5px;color:var(--faint);font-variant-numeric:tabular-nums;white-space:nowrap;}" +

  // Список файлов
  "#" + WIN_ID + " .cd-list{flex:1 1 auto;overflow-y:auto;padding:2px 8px 12px;min-height:0;}" +
  "#" + WIN_ID + " .cd-group{margin-top:13px;}" +
  "#" + WIN_ID + " .cd-group:first-child{margin-top:3px;}" +
  "#" + WIN_ID + " .cd-ghead{display:flex;align-items:center;gap:7px;width:100%;padding:6px 6px;background:none;border:none;cursor:pointer;color:var(--faint);font-family:inherit;text-align:left;}" +
  "#" + WIN_ID + " .cd-ghead .cd-gl{flex:1 1 auto;display:inline-flex;align-items:center;gap:7px;text-transform:uppercase;font-size:10px;font-weight:800;letter-spacing:.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted);color:color-mix(in srgb,var(--gcolor,var(--ac)) 72%,var(--fg));}" +
  "#" + WIN_ID + " .cd-ghead .cd-gl::before{content:'';flex:0 0 auto;width:6px;height:6px;border-radius:2px;background:var(--gcolor,var(--ac));}" +
  "#" + WIN_ID + " .cd-ghead .cd-gc{font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:var(--cd-r-md);background:var(--bd);background:color-mix(in srgb,var(--gcolor,var(--ac)) 18%,transparent);color:var(--muted);color:color-mix(in srgb,var(--gcolor,var(--ac)) 78%,var(--fg));}" +
  "#" + WIN_ID + " .cd-gdot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--gcolor,var(--ac));box-shadow:0 0 0 3px color-mix(in srgb,var(--gcolor,var(--ac)) 20%,transparent);}" +
  "#" + WIN_ID + " .cd-chev{width:9px;font-size:9px;transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-group.collapsed .cd-chev{transform:rotate(-90deg);}" +
  // Чипы-фильтр навигатора (Всё/Не изучено/Закреплённое/С заметками)
  "#" + WIN_ID + " .cd-filterbar{display:flex;flex-wrap:wrap;gap:5px;padding:2px 10px 8px;}" +
  "#" + WIN_ID + " .cd-fchip{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:var(--cd-r-pill);border:1px solid var(--bd);background:none;color:var(--muted);cursor:pointer;transition:background var(--cd-t-fast),color var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-fchip:hover{color:var(--fg);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-fchip.on{background:color-mix(in srgb,var(--ac) 20%,transparent);color:var(--ac2);border-color:color-mix(in srgb,var(--ac) 45%,var(--bd));}" +
  // Тонкий прогресс на группе (изучено N из M)
  "#" + WIN_ID + " .cd-gprog{display:flex;align-items:center;gap:7px;padding:0 8px 6px 22px;}" +
  "#" + WIN_ID + " .cd-gprog-track{flex:1 1 auto;height:3px;border-radius:3px;background:color-mix(in srgb,var(--gcolor,var(--ac)) 20%,transparent);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-gprog-fill{height:100%;width:0;border-radius:3px;background:var(--gcolor,var(--ac));transition:width var(--cd-t-slow);}" +
  "#" + WIN_ID + " .cd-gprog-lab{font-size:9px;font-weight:700;color:var(--muted);white-space:nowrap;}" +
  // При активном фильтре группы не сворачиваются
  "#" + WIN_ID + " .cd-list.filtering .cd-chev{visibility:hidden;}" +
  "#" + WIN_ID + " .cd-list.filtering .cd-ghead{cursor:default;}" +
  // Контекстное меню пункта (правый клик)
  ".cd-ctxmenu{position:fixed;z-index:2147483400;min-width:190px;padding:4px;border-radius:var(--cd-r-lg);border:1px solid rgba(205,214,244,.16);background:#1e1e2e;box-shadow:0 12px 32px rgba(0,0,0,.5);font-family:var(--vscode-font-family,'Segoe UI',system-ui,sans-serif);}" +
  ".cd-ctxmenu .cd-ctxitem{display:block;width:100%;text-align:left;border:none;background:none;color:#cdd6f4;font-family:inherit;font-size:12.5px;padding:7px 10px;border-radius:var(--cd-r-md);cursor:pointer;}" +
  ".cd-ctxmenu .cd-ctxitem:hover{background:rgba(137,180,250,.16);}" +
  "#" + WIN_ID + " .cd-group.collapsed .cd-items{display:none;}" +
  "#" + WIN_ID + " .cd-item{position:relative;margin:1px 0;padding:8px 10px 9px 15px;border-radius:var(--cd-r-md);cursor:pointer;}" +
  "#" + WIN_ID + " .cd-item::before{content:'';position:absolute;left:6px;top:9px;bottom:9px;width:3px;border-radius:3px;background:var(--gcolor,var(--ac));opacity:.45;transition:opacity .13s,top .13s,bottom .13s;}" +
  "#" + WIN_ID + " .cd-item:hover{background:var(--hl);background:color-mix(in srgb,var(--gcolor,var(--ac)) 9%,transparent);}" +
  "#" + WIN_ID + " .cd-item:hover::before{opacity:.9;top:7px;bottom:7px;}" +
  "#" + WIN_ID + " .cd-item.active{background:var(--hl);background:color-mix(in srgb,var(--gcolor,var(--ac)) 15%,transparent);}" +
  "#" + WIN_ID + " .cd-item.active::before{opacity:1;top:6px;bottom:6px;}" +
  "#" + WIN_ID + " .cd-item.active .cd-it-title{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-it-title{font-weight:600;font-size:12.5px;line-height:1.3;padding-right:38px;}" +
  "#" + WIN_ID + " .cd-item.read .cd-it-title::before{content:'✓ ';color:var(--ts);font-weight:800;}" +
  "#" + WIN_ID + " .cd-it-sub{color:var(--muted);font-size:11px;margin-top:3px;line-height:1.45;padding-right:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
  "#" + WIN_ID + " .cd-it-meta{color:var(--faint);font-size:10px;margin-top:3px;font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-it-act{position:absolute;top:6px;right:6px;display:flex;gap:2px;}" +
  "#" + WIN_ID + " .cd-it-act button{border:none;background:none;cursor:pointer;color:var(--muted);font-size:13.5px;padding:2px 4px;border-radius:var(--cd-r-sm);opacity:0;transition:opacity var(--cd-t-fast),background var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-it-act .cd-a-read{opacity:.5;}" +   // кружок прогресса виден всегда (главный индикатор)
  "#" + WIN_ID + " .cd-item:hover .cd-it-act button,#" + WIN_ID + " .cd-item.active .cd-it-act button{opacity:.92;}" +
  "#" + WIN_ID + " .cd-it-act button:hover{opacity:1;background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-it-act .on-pin{opacity:1;color:var(--ty);}" +
  "#" + WIN_ID + " .cd-it-act .on-read{opacity:1;color:var(--ts);}" +
  "#" + WIN_ID + " .cd-empty{padding:20px 14px;text-align:center;color:var(--faint);font-size:12px;}" +

  // Читалка
  "#" + WIN_ID + " .cd-reader{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0;}" +
  "#" + WIN_ID + " .cd-tocwrap{position:relative;flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-rbtn{border:1px solid var(--bd);background:var(--panel);color:var(--muted);cursor:pointer;font-family:inherit;font-size:11.5px;padding:5px 10px;border-radius:var(--cd-r-md);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-rbtn:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-rbtn.on{color:var(--ts);border-color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rmain{position:relative;flex:1 1 auto;display:flex;min-height:0;min-width:0;}" +

  // --- Главный экран (приветствие / возвращение) — оверлей поверх области чтения ---
  "#" + WIN_ID + " .cd-home{position:absolute;inset:0;z-index:7;overflow-y:auto;" +
  "background:radial-gradient(120% 68% at 50% -12%,rgba(var(--ac-rgb),.15),transparent 60%),radial-gradient(85% 55% at 108% 112%,rgba(var(--ac-rgb),.08),transparent 55%),var(--bg);}" +
  "#" + WIN_ID + " .cd-home-inner{max-width:880px;margin:0 auto;padding:32px 30px 64px;}" +
  // Герой — градиентная панель с мягким свечением
  "#" + WIN_ID + " .cd-home-hero{position:relative;display:flex;align-items:center;justify-content:space-between;gap:20px 24px;margin-bottom:18px;padding:18px 24px;border-radius:var(--cd-r-2xl);overflow:hidden;flex-wrap:wrap;" +
  "background:linear-gradient(135deg,color-mix(in srgb,var(--ac) 15%,var(--panel)),var(--panel));border:1px solid color-mix(in srgb,var(--ac) 24%,var(--bd));}" +
  "#" + WIN_ID + " .cd-home-hero::before{content:'';position:absolute;top:-45%;right:-8%;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(var(--ac-rgb),.20),transparent 70%);pointer-events:none;}" +
  "#" + WIN_ID + " .cd-home-hero::after{content:'';position:absolute;left:-6%;bottom:-60%;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(var(--ac-rgb),.10),transparent 70%);pointer-events:none;}" +
  "#" + WIN_ID + " .cd-home-hero{box-shadow:inset 0 1px 0 rgba(255,255,255,.05);}" +
  // Лид героя (маскот + приветствие) слева, статистика — справа; на узком окне статистика переносится вниз.
  "#" + WIN_ID + " .cd-hero-lead{position:relative;z-index:1;display:flex;align-items:center;gap:18px;flex:1 1 260px;min-width:0;}" +
  "#" + WIN_ID + " .cd-hero-stats{position:relative;z-index:1;flex:1 1 300px;display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dtile{padding:9px 11px;border-radius:var(--cd-r-xl);gap:2px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dtile:hover{transform:none;box-shadow:none;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-ic{width:24px;height:24px;font-size:12px;border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-v{font-size:15px;margin-top:3px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-l{font-size:10px;line-height:1.25;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-bar{margin-top:7px;height:4px;}" +
  // маскот героя — наклейка-настроение на мягком радиальном свечении
  "#" + WIN_ID + " .cd-home-mascot{position:relative;flex:0 0 auto;width:96px;height:96px;display:flex;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-home-mascot::before{content:'';position:absolute;inset:-4px;border-radius:50%;background:radial-gradient(circle,rgba(var(--ac-rgb),.28),transparent 66%);z-index:0;}" +
  "#" + WIN_ID + " .cd-home-mascot .cd-sticker,#" + WIN_ID + " .cd-home-mascot img{position:relative;z-index:1;}" +
  "#" + WIN_ID + " .cd-home-mascot .cd-sticker{filter:drop-shadow(0 8px 18px rgba(0,0,0,.38));transform:rotate(-5deg);transition:transform var(--cd-t-slow) cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-home-mascot:hover .cd-sticker{transform:rotate(0) scale(1.05);}" +
  "#" + WIN_ID + " .cd-home-htxt{flex:1 1 200px;min-width:0;}" +
  "#" + WIN_ID + " .cd-home-hi{font-size:25px;font-weight:800;letter-spacing:-.015em;color:var(--fg);line-height:1.12;}" +
  "#" + WIN_ID + " .cd-home-sub{font-size:13px;color:var(--muted);margin-top:5px;}" +
  // Кольцо общего прогресса
  "#" + WIN_ID + " .cd-ring{flex:0 0 auto;position:relative;width:74px;height:74px;}" +
  "#" + WIN_ID + " .cd-ring svg{width:100%;height:100%;transform:rotate(-90deg);}" +
  "#" + WIN_ID + " .cd-ring-bg{fill:none;stroke:var(--bd);stroke-width:5;}" +
  "#" + WIN_ID + " .cd-ring-fg{fill:none;stroke:var(--ac);stroke-width:5;stroke-linecap:round;transition:stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-home-cont{display:flex;align-items:center;gap:14px;width:100%;text-align:left;font-family:inherit;cursor:pointer;border:1px solid rgba(var(--ac-rgb),.30);" +
  "background:linear-gradient(135deg,rgba(var(--ac-rgb),.17),rgba(var(--ac-rgb),.05));border-radius:var(--cd-r-2xl);padding:16px 20px;margin-bottom:14px;transition:transform var(--cd-t-fast),box-shadow var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-cont:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.28);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-hc-main{flex:1 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-hc-arrow{flex:0 0 auto;font-size:22px;color:var(--ac);opacity:.7;transition:transform .16s,opacity .16s;}" +
  "#" + WIN_ID + " .cd-home-cont:hover .cd-hc-arrow{transform:translateX(4px);opacity:1;}" +
  "#" + WIN_ID + " .cd-hc-lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--ac);}" +
  "#" + WIN_ID + " .cd-hc-title{font-size:17px;font-weight:700;color:var(--fg);margin:5px 0 2px;}" +
  "#" + WIN_ID + " .cd-hc-meta{font-size:11.5px;color:var(--faint);}" +
  // Дашборд-плитки (#1)
  "#" + WIN_ID + " .cd-dtile{border:1px solid var(--bd);border-radius:var(--cd-r-2xl);background:var(--panel);padding:13px 15px;display:flex;flex-direction:column;gap:3px;transition:transform .13s,box-shadow .13s,border-color .13s;}" +
  "#" + WIN_ID + " .cd-dtile:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.16);border-color:color-mix(in srgb,var(--ac) 35%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dt-ic{width:30px;height:30px;border-radius:var(--cd-r-md);display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;}" +
  "#" + WIN_ID + " .cd-dt-read .cd-dt-ic{background:rgba(137,180,250,.16);}" +
  "#" + WIN_ID + " .cd-dt-solve .cd-dt-ic{background:rgba(166,227,161,.16);}" +
  "#" + WIN_ID + " .cd-dt-streak .cd-dt-ic{background:rgba(250,179,135,.16);}" +
  "#" + WIN_ID + " .cd-dt-v{font-size:19px;font-weight:800;color:var(--fg);font-variant-numeric:tabular-nums;margin-top:5px;}" +
  "#" + WIN_ID + " .cd-dt-l{font-size:11px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-dt-bar{height:5px;border-radius:var(--cd-r-pill);background:var(--bd);overflow:hidden;margin-top:9px;}" +
  "#" + WIN_ID + " .cd-dt-bar i{display:block;height:100%;border-radius:var(--cd-r-pill);transition:width .6s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-dt-read .cd-dt-bar i{background:linear-gradient(90deg,#89b4fa,#b4befe);}" +
  "#" + WIN_ID + " .cd-dt-solve .cd-dt-bar i{background:linear-gradient(90deg,#a6e3a1,#94e2d5);}" +
  "#" + WIN_ID + " .cd-home-sec{display:flex;align-items:center;gap:9px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.9px;color:var(--muted);margin:26px 0 13px;padding-bottom:8px;border-bottom:1px solid var(--bd2);}" +
  "#" + WIN_ID + " .cd-sec-dot{width:7px;height:7px;border-radius:2px;flex:0 0 auto;background:var(--sc,var(--ac));box-shadow:0 0 8px color-mix(in srgb,var(--sc,var(--ac)) 55%,transparent);}" +
  "#" + WIN_ID + " .cd-sec-count{margin-left:auto;font-size:10px;letter-spacing:0;color:var(--faint);opacity:.85;padding:1px 8px;border-radius:var(--cd-r-md);background:var(--hl);}" +
  "#" + WIN_ID + " .cd-hcard-go{position:absolute;right:12px;bottom:11px;font-size:15px;color:var(--gcolor,var(--ac));opacity:0;transform:translateX(-4px);transition:opacity var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-card:hover .cd-hcard-go{opacity:.9;transform:none;}" +
  "#" + WIN_ID + " .cd-home-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-home-card{position:relative;text-align:left;font-family:inherit;cursor:pointer;border:1px solid var(--bd);background:linear-gradient(180deg,color-mix(in srgb,var(--fg) 2%,var(--panel)),var(--panel));border-radius:var(--cd-r-2xl);padding:14px 32px 14px 18px;overflow:hidden;transition:transform var(--cd-t-fast),box-shadow var(--cd-t-fast),border-color var(--cd-t-fast),background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--gcolor,var(--ac));opacity:.85;}" +
  "#" + WIN_ID + " .cd-home-card:hover{transform:translateY(-2px);box-shadow:var(--cd-sh-2);border-color:color-mix(in srgb,var(--gcolor,var(--ac)) 45%,var(--bd));background:color-mix(in srgb,var(--gcolor,var(--ac)) 7%,var(--panel));}" +
  "#" + WIN_ID + " .cd-hcard-head{display:flex;align-items:center;gap:9px;}" +
  "#" + WIN_ID + " .cd-hcard-ic{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;padding:3px;border-radius:var(--cd-r-md);background:color-mix(in srgb,var(--gcolor,var(--ac)) 13%,transparent);}" +
  "#" + WIN_ID + " .cd-hcard-ic .cd-sticker{transition:transform .16s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-home-card:hover .cd-hcard-ic .cd-sticker{transform:scale(1.12) rotate(-4deg);}" +
  "#" + WIN_ID + " .cd-hcard-t{font-size:13.5px;font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-hcard-s{font-size:11.5px;color:var(--muted);margin-top:3px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
  "#" + WIN_ID + " .cd-home-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-home-chip{font-family:inherit;cursor:pointer;font-size:12px;color:var(--fg);border:1px solid var(--bd);background:var(--panel);border-radius:var(--cd-r-pill);padding:6px 13px;display:inline-flex;align-items:center;gap:7px;transition:border-color var(--cd-t-fast),background var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-chip::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--gcolor,var(--ac));flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-home-chip:hover{border-color:var(--gcolor,var(--ac));background:color-mix(in srgb,var(--gcolor,var(--ac)) 9%,var(--panel));transform:translateY(-1px);}" +
  "#" + WIN_ID + ".home .cd-file-only{display:none;}" +
  "#" + WIN_ID + ".home .cd-rprog{visibility:hidden;}" +
  "@keyframes cd-home-in{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + " .cd-home.cd-in-anim{animation:cd-home-in .2s ease-out;}" +
  "#" + WIN_ID + " .cd-content{flex:1 1 auto;overflow-y:auto;padding:22px 30px 60px;min-height:0;min-width:0;line-height:1.62;scroll-behavior:smooth;}" +
  "#" + WIN_ID + " .cd-article{max-width:820px;margin:0 auto;font-family:var(--cd-rfont,inherit);}" +

  // Боковое оглавление-рейка
  "#" + WIN_ID + " .cd-outline{flex:0 0 auto;width:198px;overflow-y:auto;padding:14px 6px 44px;border-left:1px solid var(--bd);background:var(--nav);}" +
  "#" + WIN_ID + ".no-outline .cd-outline,#" + WIN_ID + ".narrow .cd-outline{display:none;}" +
  "#" + WIN_ID + ".narrow.ol-peek .cd-outline{display:block;position:absolute;right:0;top:0;bottom:0;z-index:6;width:240px;background:var(--panel);box-shadow:var(--sh3,0 18px 46px rgba(0,0,0,.4));}" +
  "#" + WIN_ID + " .cd-ol{display:block;width:100%;text-align:left;border:none;background:none;color:var(--muted);cursor:pointer;" +
  "font-family:inherit;font-size:11.5px;line-height:1.35;padding:5px 10px;border-radius:0 6px 6px 0;border-left:2px solid transparent;}" +
  "#" + WIN_ID + " .cd-ol.lvl3{padding-left:20px;font-size:11px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-ol:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-ol.active{color:var(--ac);border-left-color:var(--ac);background:var(--hl);font-weight:600;}" +
  "#" + WIN_ID + " .cd-rbtn.act{color:var(--ac);border-color:var(--ac);}" +

  // Полоса вкладок
  "#" + WIN_ID + " .cd-tabs{display:flex;gap:4px;align-items:flex-end;padding:6px 8px 0;overflow-x:auto;flex:0 0 auto;background:var(--nav);border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-tab{display:inline-flex;align-items:center;gap:6px;max-width:190px;flex:0 0 auto;padding:6px 6px 6px 11px;border:1px solid var(--bd);border-bottom:none;border-radius:8px 8px 0 0;background:var(--panel);color:var(--muted);cursor:pointer;font-size:11.5px;white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-tab.active{background:var(--bg);color:var(--fg);border-color:var(--ac);box-shadow:inset 0 2px 0 0 var(--ac);}" +
  "#" + WIN_ID + " .cd-tab-l{overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-tab-x{border:none;background:none;color:var(--faint);cursor:pointer;font-size:11px;line-height:1;padding:2px 3px;border-radius:var(--cd-r-xs);}" +
  "#" + WIN_ID + " .cd-tab-x:hover{background:var(--hl);color:var(--fg);}" +

  // Второй документ рядом (сплит)
  "#" + WIN_ID + " .cd-split{flex:1 1 0;min-width:0;display:flex;flex-direction:column;border-left:1px solid var(--bd);background:var(--bg);}" +
  "#" + WIN_ID + ".split .cd-content{flex:1 1 0;}" +
  "#" + WIN_ID + ".split .cd-outline{display:none;}" +
  "#" + WIN_ID + " .cd-split-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--bd);background:linear-gradient(180deg,var(--hl),transparent);}" +
  "#" + WIN_ID + " .cd-split-title{flex:1 1 auto;font-weight:700;font-size:12.5px;color:var(--ac2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-split-x{flex:0 0 auto;border:none;background:none;color:var(--muted);cursor:pointer;font-size:13px;padding:2px 7px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-split-x:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-split-content{flex:1 1 auto;overflow-y:auto;padding:18px 24px 50px;min-height:0;line-height:1.62;scroll-behavior:smooth;}" +

  // Типографика статьи
  "#" + WIN_ID + " .cd-article h2{position:relative;font-size:20px;margin:30px 0 12px;padding-bottom:7px;border-bottom:1px solid var(--bd);color:var(--ac2);scroll-margin-top:10px;}" +
  "#" + WIN_ID + " .cd-article h2::before{content:'';position:absolute;left:-16px;top:4px;height:19px;width:4px;border-radius:3px;background:linear-gradient(180deg,var(--ac),var(--ac2));}" +
  "#" + WIN_ID + " .cd-article h3{font-size:16px;margin:22px 0 8px;color:var(--fg);scroll-margin-top:10px;}" +
  "#" + WIN_ID + " .cd-article h4{font-size:14px;margin:16px 0 6px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article p{margin:9px 0;}" +
  "#" + WIN_ID + " .cd-article a{color:var(--ac);text-decoration:none;border-bottom:1px solid transparent;}" +
  "#" + WIN_ID + " .cd-article a:hover{border-bottom-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article ul,#" + WIN_ID + " .cd-article ol{margin:8px 0;padding-left:24px;}" +
  "#" + WIN_ID + " .cd-article li{margin:4px 0;}" +
  "#" + WIN_ID + " .cd-article code{background:var(--code);border:1px solid var(--bd2);border-radius:var(--cd-r-sm);padding:1px 5px;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12px;}" +
  "#" + WIN_ID + " .cd-article strong{color:var(--fg);font-weight:700;}" +
  "#" + WIN_ID + " .cd-article hr{border:none;border-top:1px solid var(--bd);margin:20px 0;}" +
  "#" + WIN_ID + " .cd-article blockquote{margin:12px 0;padding:10px 14px;border-left:3px solid var(--ac);border-radius:0 8px 8px 0;background:var(--hl);}" +
  "#" + WIN_ID + " .cd-article blockquote p{margin:5px 0;}" +
  // Спойлеры-подсказки задачника (<details class="cd-spoiler">)
  "#" + WIN_ID + " .cd-article details.cd-spoiler{margin:10px 0;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--panel);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary{cursor:pointer;padding:9px 13px;font-weight:600;font-size:13px;color:var(--ac2);list-style:none;user-select:none;background:var(--hl);}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary::-webkit-details-marker{display:none;}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary::before{content:'▸';display:inline-block;width:1em;color:var(--ac);transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler[open]>summary::before{transform:rotate(90deg);}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary:hover{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler .cd-spoiler-body{padding:2px 14px 8px;}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler .cd-spoiler-body>:first-child{margin-top:6px;}" +
  // Подсказки-термины: слово из словаря с пунктирным подчёркиванием, при наведении — определение.
  "#" + WIN_ID + " .cd-article abbr.cd-term{border-bottom:1px dotted var(--faint,#8a8a9a);cursor:help;text-decoration:none;-webkit-text-decoration:none;}" +
  "#" + WIN_ID + " .cd-article abbr.cd-term:hover{border-bottom-color:var(--ac);}" +
  // Меню настроек: заголовок
  // Таблица сниппетов «Быстрые слова»: клик по строке раскрывает подсвеченный код
  "#" + WIN_ID + " .cd-article table.cd-snip-table{width:100%;}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip{cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip:hover>td{background:color-mix(in srgb,var(--ac) 10%,transparent);}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip .cd-snip-key{white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip .cd-snip-caret{display:inline-block;width:.9em;color:var(--ac);transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip.cd-open .cd-snip-caret{transform:rotate(90deg);}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip .cd-snip-ch{color:var(--muted);font-weight:700;}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip-code>td{padding:0 0 10px;border:none;background:none;}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip-code .codewrap{margin:2px 0 0;}" +
  // Таблица «Задачи темы» задачника: строка кликабельна, при наведении — чип «Перейти к заданию →»
  "#" + WIN_ID + " .cd-article table.cd-tasktable tr.cd-taskrow{cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article table.cd-tasktable tr.cd-taskrow>td:last-child{position:relative;}" +
  "#" + WIN_ID + " .cd-article table.cd-tasktable tr.cd-taskrow:hover>td{background:color-mix(in srgb,var(--ac) 12%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-taskrow-go{position:absolute;right:6px;top:50%;transform:translateY(-50%) translateX(6px);opacity:0;pointer-events:none;white-space:nowrap;font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:var(--cd-r-pill);background:var(--ac);color:#11111b;box-shadow:0 2px 10px rgba(0,0,0,.35);transition:opacity .13s,transform .13s;}" +
  "#" + WIN_ID + " .cd-article table.cd-tasktable tr.cd-taskrow:hover .cd-taskrow-go{opacity:1;transform:translateY(-50%) translateX(0);}" +
  // Выключение анимаций (настройка «Анимации: Выкл»)
  "#" + WIN_ID + ".no-anim *,#" + WIN_ID + ".no-anim{animation:none!important;transition:none!important;}" +
  // Мелкая подпись-легенда (<sub> из задачника → <small class="cd-cap">)
  "#" + WIN_ID + " .cd-article .cd-cap{font-size:.85em;color:var(--faint);}" +
  // Чипы сложности (#3): цветной кружок с мягким кольцом
  "#" + WIN_ID + " .cd-diff{display:inline-block;width:11px;height:11px;border-radius:50%;vertical-align:middle;margin:0 1px;}" +
  "#" + WIN_ID + " .cd-diff.d-e{background:#40c057;box-shadow:0 0 0 3px rgba(64,192,87,.18);}" +
  "#" + WIN_ID + " .cd-diff.d-m{background:#f2b705;box-shadow:0 0 0 3px rgba(242,183,5,.18);}" +
  "#" + WIN_ID + " .cd-diff.d-h{background:#fa5252;box-shadow:0 0 0 3px rgba(250,82,82,.18);}" +
  "#" + WIN_ID + " .cd-article h2.cd-task .cd-diff{margin-left:4px;}" +
  // 🔥 челлендж и 🔗 звено цепочки — те же «пилюли», что и сложность, но со значком
  "#" + WIN_ID + " .cd-diff.d-x{width:auto;height:auto;border-radius:var(--cd-r-lg);padding:0 6px;font-size:.8em;line-height:1.5;background:rgba(250,82,82,.14);box-shadow:0 0 0 1px rgba(250,82,82,.35);}" +
  "#" + WIN_ID + " .cd-chain{display:inline-block;border-radius:var(--cd-r-lg);padding:0 6px;font-size:.8em;line-height:1.5;vertical-align:middle;margin:0 2px;background:color-mix(in srgb,var(--ac) 14%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--ac) 40%,transparent);}" +
  // Оглавление: большой раздел (# …) — отдельной строкой с разделителем
  "#" + WIN_ID + " .cd-ol.major{margin-top:6px;padding-top:7px;border-top:1px solid var(--bd);font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-ol.major::before{content:'◆';color:var(--ac);margin-right:6px;font-size:9px;vertical-align:1px;}" +
  // Решения задачника
  "#" + WIN_ID + " .cd-article details.cd-soldet>summary{display:flex;align-items:center;gap:8px;}" +
  "#" + WIN_ID + " .cd-article details.cd-soldet.cd-sol-solved>summary::after{content:'✓ решено';margin-left:auto;font-size:11px;font-weight:700;color:var(--ts);}" +
  "#" + WIN_ID + " .cd-article details.cd-soldet.cd-sol-flash{animation:cdSolFlash 1.2s ease-out;}" +
  "@keyframes cdSolFlash{0%{box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 55%,transparent);}100%{box-shadow:0 0 0 0 transparent;}}" +
  "#" + WIN_ID + ".no-anim .cd-article details.cd-soldet.cd-sol-flash{animation:none;}" +
  "#" + WIN_ID + " .cd-article .cd-sol-back{font:inherit;font-size:11.5px;float:right;margin:0 0 6px 10px;padding:3px 9px;border-radius:var(--cd-r-md);cursor:pointer;border:1px solid var(--bd);background:var(--bg);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-sol-back:hover{color:var(--ac);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-alt{margin:16px 0 4px;padding:10px 12px 4px;border-radius:var(--cd-r-xl);border:1px solid color-mix(in srgb,var(--ts) 35%,var(--bd));background:color-mix(in srgb,var(--ts) 6%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-alt-h{margin:0 0 8px;}" +
  "#" + WIN_ID + " .cd-article .cd-alt-h strong{display:inline-block;font-size:12.5px;padding:2px 9px;border-radius:var(--cd-r-md);background:color-mix(in srgb,var(--ts) 18%,transparent);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-alt-cmp{border-left-color:var(--ts);}" +
  // Таблица «Задачи темы»: решённые — с галочкой
  "#" + WIN_ID + " .cd-article tr.cd-taskrow-done td:first-child::before{content:'✓ ';color:var(--ts);font-weight:800;}" +
  "#" + WIN_ID + " .cd-article tr.cd-taskrow-done td{opacity:.72;}" +
  // Лесенка подсказок задачника (```hints)
  "#" + WIN_ID + " .cd-article .cd-ladder{margin:14px 0;padding:12px 14px;border-radius:var(--cd-r-xl);border:1px solid color-mix(in srgb,var(--ac) 28%,var(--bd));background:color-mix(in srgb,var(--ac) 6%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px;}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-t{font-weight:700;color:var(--ac2);font-size:13.5px;}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-sub{font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-dots{margin-left:auto;display:flex;gap:5px;}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-dots i{width:8px;height:8px;border-radius:50%;background:var(--bd);transition:background var(--cd-t-slow),transform var(--cd-t-slow);}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-dots i.on{background:var(--ac);transform:scale(1.15);}" +
  "#" + WIN_ID + " .cd-article .cd-lstep{display:flex;gap:10px;align-items:flex-start;margin:8px 0;padding:9px 11px;border-radius:var(--cd-r-md);background:var(--bg);border:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-article .cd-lstep.cd-lstep-in{animation:cdLadderIn .28s ease-out;}" +
  "@keyframes cdLadderIn{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + ".no-anim .cd-article .cd-lstep.cd-lstep-in{animation:none;}" +
  "#" + WIN_ID + " .cd-article .cd-lstep-ic{font-size:17px;line-height:1.4;}" +
  "#" + WIN_ID + " .cd-article .cd-lstep-b{flex:1;min-width:0;}" +
  "#" + WIN_ID + " .cd-article .cd-lstep-l{display:block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ac2);margin-bottom:2px;}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-next{font:inherit;font-size:13px;margin-top:4px;padding:6px 12px;border-radius:var(--cd-r-md);cursor:pointer;border:1px solid color-mix(in srgb,var(--ac) 45%,transparent);background:color-mix(in srgb,var(--ac) 14%,transparent);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-next:hover{background:color-mix(in srgb,var(--ac) 24%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-ladder.done{border-style:dashed;}" +
  // Прогресс по задачнику: счётчик темы + отметка «решено» у задач
  "#" + WIN_ID + " .cd-article .cd-taskbar{margin:2px 0 16px;padding:8px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--hl);font-size:13px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar b{color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-article h2.cd-task{display:flex;align-items:center;flex-wrap:wrap;gap:10px;}" +
  "#" + WIN_ID + " .cd-article h2.cd-task.cd-task-done{opacity:.72;}" +
  "#" + WIN_ID + " .cd-article .cd-taskstub{cursor:pointer;font:inherit;font-size:11px;font-weight:600;line-height:1;padding:5px 10px;margin-left:6px;border-radius:var(--cd-r-pill);border:1px dashed var(--bd);background:none;color:var(--muted);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-article .cd-taskstub:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-solve{cursor:pointer;font:inherit;font-size:11px;font-weight:600;line-height:1;padding:5px 10px;border-radius:var(--cd-r-pill);border:1px solid var(--bd);background:var(--panel);color:var(--muted);white-space:nowrap;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-solve:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-solve.on{background:var(--ac);border-color:var(--ac);color:#11111b;}" +
  "#" + WIN_ID + " .cd-article h2.cd-task.cd-task-done>a.cd-anchor,#" + WIN_ID + " .cd-article h2.cd-task.cd-task-done{text-decoration:none;}" +
  // #3 Карточка задачи: каждая ## N.M. со своим условием — в аккуратной карточке
  "#" + WIN_ID + " .cd-article .cd-taskcard{margin:18px 0;padding:4px 18px 16px;border:1px solid color-mix(in srgb,var(--fg) 16%,transparent);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 6.5%,var(--panel));box-shadow:0 3px 10px rgba(0,0,0,.22);}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task{border-bottom-color:color-mix(in srgb,var(--fg) 10%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task{margin-top:14px;}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task::before{display:none;}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task+p em{color:var(--muted);}" +
  // #4 Сегментированный прогресс темы (в .cd-taskbar)
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-top{margin-bottom:8px;}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-track{display:flex;gap:4px;}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-cell{flex:1 1 0;height:7px;border-radius:var(--cd-r-xs);background:var(--bd);transition:background .18s;}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-cell.on{background:linear-gradient(90deg,var(--ac),var(--ac2));}" +
  // Личные заметки к материалу (внизу читалки)
  "#" + WIN_ID + " .cd-article .cd-notes{margin:34px 0 6px;padding-top:18px;border-top:1px dashed var(--bd);}" +
  "#" + WIN_ID + " .cd-article .cd-notes-h{font-size:13px;font-weight:700;color:var(--ac2);margin-bottom:8px;}" +
  "#" + WIN_ID + " .cd-article .cd-notes-ta{width:100%;min-height:70px;resize:vertical;padding:10px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--nav);color:var(--fg);font:inherit;font-size:13.5px;line-height:1.5;outline:none;transition:border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-notes-ta:focus{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-notes-ta::placeholder{color:var(--faint);}" +
  "#" + WIN_ID + " .cd-item.has-note .cd-it-title::after{content:'📝';margin-left:6px;font-size:.85em;opacity:.75;}" +
  "#" + WIN_ID + " .cd-article img{max-width:100%;border-radius:var(--cd-r-md);}" +

  // Таблицы
  "#" + WIN_ID + " .tablewrap{overflow-x:auto;margin:12px 0;border:1px solid var(--bd);border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-article table{border-collapse:collapse;width:100%;font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-article th,#" + WIN_ID + " .cd-article td{padding:7px 11px;text-align:left;border-bottom:1px solid var(--bd);vertical-align:top;}" +
  "#" + WIN_ID + " .cd-article th{background:var(--hl);font-weight:700;color:var(--ac2);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-article tbody tr:last-child td{border-bottom:none;}" +
  "#" + WIN_ID + " .cd-article tbody tr:hover{background:var(--bd2);}" +

  // Блоки кода — с верхней шапкой (язык + копировать)
  "#" + WIN_ID + " .codewrap{position:relative;margin:14px 0;border:1px solid var(--bd);border-radius:var(--cd-r-lg);overflow:hidden;box-shadow:var(--cd-sh-1);}" +
  "#" + WIN_ID + " .codehead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 8px 5px 12px;background:color-mix(in srgb,var(--ac) 10%,var(--code));border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .codelang{font-size:10px;text-transform:uppercase;letter-spacing:.7px;font-weight:800;color:var(--ac);}" +
  "#" + WIN_ID + " .copybtn{border:1px solid var(--bd);background:var(--bg);color:var(--muted);cursor:pointer;" +
  "font-family:inherit;font-size:10.5px;padding:3px 9px;border-radius:var(--cd-r-md);opacity:.75;transition:opacity var(--cd-t-fast),border-color var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .copybtn .cb-ic{font-size:11px;}" +
  "#" + WIN_ID + " .codewrap:hover .copybtn{opacity:1;}" +
  "#" + WIN_ID + " .copybtn:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .copybtn.done{color:var(--ts);border-color:var(--ts);}" +
  "#" + WIN_ID + " .cd-codebtns{display:inline-flex;gap:6px;align-items:center;}" +
  "#" + WIN_ID + " .cd-toed:disabled{opacity:.5;cursor:progress;}" +
  "#" + WIN_ID + " .cd-explain{margin:0 0 10px;padding:11px 14px;border-radius:var(--cd-r-lg);border:1px solid color-mix(in srgb,#f9e2af 45%,var(--bd));border-left:4px solid #f9e2af;background:color-mix(in srgb,#f9e2af 8%,var(--bg));line-height:1.5;}" +
  "#" + WIN_ID + " .cd-explain.generic{border-left-color:var(--muted);}" +
  "#" + WIN_ID + " .cd-ex-t{font-weight:800;font-size:13.5px;color:var(--fg);margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-ex-line{font-weight:600;font-size:11px;color:var(--muted);border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:1px 8px;margin-left:6px;}" +
  "#" + WIN_ID + " .cd-ex-why{font-size:12.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-ex-fix{font-size:12.5px;color:var(--fg);margin-top:5px;}" +
  "#" + WIN_ID + " .cd-ex-more{margin-top:8px;font:inherit;font-size:11.5px;font-weight:700;color:var(--ac);background:none;border:1px solid var(--ac);border-radius:var(--cd-r-pill);padding:4px 12px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-ex-more:hover{background:color-mix(in srgb,var(--ac) 14%,transparent);}" +
  "#" + WIN_ID + " .cd-bridge.err{border-color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-bridge.err .cd-bridge-ic,#" + WIN_ID + " .cd-bridge.err .cd-bridge-word{color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-bridge.err .cd-bridge-open{background:#f38ba8;}" +
  "#" + WIN_ID + " .cd-home-warm{width:100%;text-align:left;display:flex;align-items:center;gap:14px;margin:0 0 14px;padding:13px 18px;border:1px solid color-mix(in srgb,#f9e2af 50%,var(--bd));border-radius:var(--cd-r-2xl);background:linear-gradient(135deg,color-mix(in srgb,#f9e2af 14%,transparent),transparent);color:var(--fg);font:inherit;cursor:pointer;transition:transform var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " button.cd-home-warm:hover{border-color:#f9e2af;transform:translateY(-2px);}" +
  "#" + WIN_ID + " .cd-home-warm.cd-daily{border-color:color-mix(in srgb,#f38ba8 45%,var(--bd));background:linear-gradient(135deg,color-mix(in srgb,#f38ba8 12%,transparent),transparent);}" +
  "#" + WIN_ID + " .cd-home-warm.cd-daily[role=button]:hover{border-color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-daily-hl{box-shadow:0 0 0 3px #f38ba8;transition:box-shadow .3s;}" +
  "#" + WIN_ID + " .cd-home-warm.done{cursor:default;opacity:.75;padding:10px 18px;}" +
  "#" + WIN_ID + " .cd-hw-ic{font-size:24px;flex:0 0 auto;}" +
  "#" + WIN_ID + " pre.code{margin:0;padding:14px 16px;overflow-x:auto;background:var(--code);border:none;border-radius:0;" +
  "font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:var(--cd-codefs,12.5px);line-height:1.55;}" +
  // Код шире колонки: тень у правого края, пока справа есть скрытое (гаснет, когда доскроллил до конца).
  "#" + WIN_ID + " .cd-article pre.code{background:linear-gradient(to left,var(--code) 40%,rgba(0,0,0,0)) right center/34px 100% no-repeat local,linear-gradient(to left,rgba(0,0,0,.38),rgba(0,0,0,0)) right center/14px 100% no-repeat scroll,var(--code);}" +
  "#" + WIN_ID + ".light .cd-article pre.code,#" + WIN_ID + ".sepia .cd-article pre.code{background:linear-gradient(to left,var(--code) 40%,rgba(0,0,0,0)) right center/34px 100% no-repeat local,linear-gradient(to left,rgba(0,0,0,.14),rgba(0,0,0,0)) right center/14px 100% no-repeat scroll,var(--code);}" +
  "#" + WIN_ID + ".codewrap-on pre.code{white-space:pre-wrap;overflow-wrap:anywhere;}" +
  "#" + WIN_ID + " .cd-wrapbtn{border:1px solid var(--bd);background:var(--bg);color:var(--muted);cursor:pointer;border-radius:var(--cd-r-sm);padding:2px 8px;font:inherit;font-size:11px;opacity:0;transition:opacity var(--cd-t-fast);}" +
  "#" + WIN_ID + " .codewrap:hover .cd-wrapbtn{opacity:1;}" +
  "#" + WIN_ID + ".codewrap-on .cd-wrapbtn{opacity:1;color:var(--ac);border-color:rgba(var(--ac-rgb),.5);}" +
  "#" + WIN_ID + " pre.code code{background:none;border:none;padding:0;font-size:inherit;}" +
  "#" + WIN_ID + " pre.code .tc{color:var(--tc);font-style:italic;}" +
  "#" + WIN_ID + " pre.code .ts{color:var(--ts);}" +
  "#" + WIN_ID + " pre.code .tp{color:var(--tp);}" +
  "#" + WIN_ID + " pre.code .tn{color:var(--tn);}" +
  "#" + WIN_ID + " pre.code .tk{color:var(--tk);}" +
  "#" + WIN_ID + " pre.code .ty{color:var(--ty);}" +
  "#" + WIN_ID + " pre.code .tf{color:var(--tf);}" +

  // Скроллбары внутри окна
  "#" + WIN_ID + " ::-webkit-scrollbar{width:10px;height:10px;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-thumb{background:var(--bd);border-radius:var(--cd-r-sm);border:2px solid transparent;background-clip:padding-box;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-thumb:hover{background:var(--faint);background-clip:padding-box;}" +

  // Ручки изменения размера
  "#" + WIN_ID + " .cd-rz{position:absolute;z-index:6;}" +
  "#" + WIN_ID + " .cd-rz-e{top:0;right:0;width:6px;height:100%;cursor:ew-resize;}" +
  "#" + WIN_ID + " .cd-rz-s{left:0;bottom:0;height:6px;width:100%;cursor:ns-resize;}" +
  "#" + WIN_ID + " .cd-rz-se{right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;}" +
  "#" + WIN_ID + " .cd-rz-w{top:0;left:0;width:6px;height:100%;cursor:ew-resize;}" +

  // Прогресс чтения файла — тонкая полоса под шапкой читалки
  "#" + WIN_ID + " .cd-rprog{height:3px;flex:0 0 auto;background:transparent;}" +
  "#" + WIN_ID + " .cd-rprog i{display:block;height:100%;width:0;background:var(--ac);opacity:.85;transition:width .1s linear;}" +

  // Хлебные крошки: текущий раздел рядом с именем файла
  "#" + WIN_ID + " .cd-rname{overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;}" +
  "#" + WIN_ID + " .cd-crumb{color:var(--faint);font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-crumb::before{content:'›';margin:0 6px;opacity:.6;}" +
  "#" + WIN_ID + " .cd-crumb:empty{display:none;}" +
  // Название темы важнее раздела: сжимается позже крошки и видно целиком при наведении.
  "#" + WIN_ID + " .cd-rname{flex-shrink:.25;min-width:min(55%,max-content);cursor:pointer;}" +
  "#" + WIN_ID + " .cd-crumb{flex-shrink:4;cursor:pointer;}" +
  "html.cd-in-panel-doc,html.cd-in-panel-doc body{margin:0;padding:0;overflow:hidden;background:transparent;}" +
  "#" + WIN_ID + ".in-panel{left:0!important;top:0!important;width:100vw!important;height:100vh!important;border-radius:0;border:none;box-shadow:none;}" +
  "#" + WIN_ID + ".in-panel .cd-winctl,#" + WIN_ID + ".in-panel .cd-rz{display:none!important;}" +
  // знакомство в 3 шага
  "#" + WIN_ID + " .cd-tour{position:absolute;inset:0;z-index:60;}" +
  "#" + WIN_ID + " .cd-tour-hole{position:absolute;border-radius:var(--cd-r-xl);box-shadow:0 0 0 9999px rgba(0,0,0,.55),0 0 0 2px var(--ac);transition:all var(--cd-t-slow) ease;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-tour-tip{position:absolute;box-sizing:border-box;padding:14px 16px 12px;border-radius:var(--cd-r-2xl);background:var(--bg2,#1e1e2e);color:var(--fg);box-shadow:var(--cd-sh-3),inset 0 0 0 1px var(--bd);}" +
  "#" + WIN_ID + " .cd-tour-t{font-weight:800;font-size:14px;margin-bottom:6px;}" +
  "#" + WIN_ID + " .cd-tour-x{font-size:12.5px;line-height:1.55;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-tour-nav{display:flex;align-items:center;gap:8px;margin-top:12px;}" +
  "#" + WIN_ID + " .cd-tour-n{flex:1;font-size:11px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-tour-nav button{font:inherit;font-size:12px;padding:5px 12px;border-radius:var(--cd-r-md);border:none;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-tour-skip{background:transparent;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-tour-next{background:var(--ac);color:var(--ac-fg,#11111b);font-weight:700;}" +
  "#" + WIN_ID + ".docked{border-radius:0;border-top:none;border-right:none;border-bottom:none;}" +
  "#" + WIN_ID + " .cd-hbtn.on{color:var(--ac);background:rgba(var(--ac-rgb),.14);}" +
  "#" + WIN_ID + " .cd-secprog{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;margin-left:8px;font-size:11px;color:var(--faint);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-secprog b{font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-sp-dots{display:inline-flex;gap:3px;}" +
  "#" + WIN_ID + " .cd-sp-dots i{width:6px;height:6px;border-radius:50%;background:color-mix(in srgb,var(--fg) 16%,transparent);}" +
  "#" + WIN_ID + " .cd-sp-dots i.r{background:var(--gcolor,var(--ac));}" +
  "#" + WIN_ID + " .cd-sp-dots i.cur{box-shadow:0 0 0 2px color-mix(in srgb,var(--gcolor,var(--ac)) 55%,transparent);}" +
  "#" + WIN_ID + " .cd-sp-bar{display:inline-block;width:46px;height:4px;border-radius:3px;background:color-mix(in srgb,var(--fg) 14%,transparent);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-sp-bar i{display:block;height:100%;background:var(--gcolor,var(--ac));}" +
  "#" + WIN_ID + " .cd-rname:hover,#" + WIN_ID + " .cd-crumb:hover{color:var(--ac);}" +
  "#" + WIN_ID + ".home .cd-rname{cursor:default;}" +
  "#" + WIN_ID + ".home .cd-rname:hover{color:inherit;}" +
  "#" + WIN_ID + " .cd-ol.seen::after{content:'✓';margin-left:5px;color:var(--ts);font-size:10px;font-weight:800;}" +

  // Меню вида: размер шрифта / ширина колонки / плотность списка
  "#" + WIN_ID + " .cd-vm-sec{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--ac2);margin:13px 4px 5px;}" +
  "#" + WIN_ID + " .cd-vm-sec:first-of-type{margin-top:4px;}" +
  "#" + WIN_ID + " .cd-vm-row{display:flex;align-items:center;gap:10px;padding:6px;border-radius:var(--cd-r-md);font-size:12px;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-vm-row:hover{background:color-mix(in srgb,var(--fg) 5%,transparent);}" +
  "#" + WIN_ID + " .cd-vm-row .cd-vm-lbl{flex:1 1 auto;min-width:0;font-weight:500;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  // строки с 3+ кнопками — вертикально: подпись сверху, сегмент-контрол на всю ширину
  "#" + WIN_ID + " .cd-vm-row.stack{flex-direction:column;align-items:stretch;gap:7px;}" +
  "#" + WIN_ID + " .cd-vm-row.stack .cd-vm-lbl{flex:none;}" +
  "#" + WIN_ID + " .cd-vm-row.stack .cd-seg{width:100%;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-vm-row.stack .cd-seg button{flex:1 1 auto;text-align:center;min-width:0;}" +
  "#" + WIN_ID + " .cd-seg{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--panel);flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-seg button{border:none;background:none;color:var(--muted);cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:600;padding:5px 10px;min-width:26px;border-radius:var(--cd-r-md);white-space:nowrap;transition:background var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-seg button.on{background:var(--ac);color:#11111b;box-shadow:0 1px 3px rgba(0,0,0,.18);}" +
  "#" + WIN_ID + " .cd-seg button:not(.on):hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-seg button:disabled{background:none;color:var(--fg);font-weight:700;cursor:default;}" +

  // Врезки-callouts: цвет по ведущему значку (класс .note + инлайновые --nc/--nbg)
  "#" + WIN_ID + " .cd-article blockquote.note{border-left-color:var(--nc,var(--ac));background:var(--nbg,var(--hl));}" +
  // Рисованная иконка-наклейка в начале врезки (роль callout'а)
  "#" + WIN_ID + " .cd-article blockquote.note.has-ic{position:relative;padding-left:46px;}" +
  "#" + WIN_ID + " .cd-article blockquote.note .cd-note-ic{position:absolute;left:12px;top:9px;width:24px;height:24px;object-fit:contain;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.18));}" +
  // Опросник (```quiz) и «найди ошибку» (```findbug)
  "#" + WIN_ID + " .cd-article .cd-quiz-head,#" + WIN_ID + " .cd-article .cd-fb-head{font-weight:700;color:var(--ac2);font-size:13.5px;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-exam{border:1px solid rgba(var(--ac-rgb),.45);border-radius:var(--cd-r-2xl);padding:14px 14px 4px;}" +
  "#" + WIN_ID + " .cd-article .cd-exam-badge{margin-left:8px;font-size:11px;font-weight:700;color:#1e1e2e;background:var(--ts);border-radius:var(--cd-r-pill);padding:2px 9px;}" +
  "#" + WIN_ID + " .cd-article .cd-exam-rule{font-size:12px;color:var(--muted);margin:-4px 0 12px;}" +
  "#" + WIN_ID + " .cd-article .cd-exam-res{margin:4px 0 12px;padding:11px 14px;border-radius:var(--cd-r-xl);font-size:13px;line-height:1.5;}" +
  "#" + WIN_ID + " .cd-article .cd-exam-res.ok{background:color-mix(in srgb,var(--ts) 16%,transparent);border:1px solid var(--ts);}" +
  "#" + WIN_ID + " .cd-article .cd-exam-res.no{background:color-mix(in srgb,var(--tn) 14%,transparent);border:1px solid var(--tn);}" +
  "#" + WIN_ID + " .cd-article .cd-exam-again{margin-left:6px;border:1px solid var(--bd);background:var(--bg);color:var(--fg);border-radius:var(--cd-r-md);padding:3px 10px;font:inherit;font-size:12px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article .cd-exam-again:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-q{margin:0 0 12px;padding:12px 14px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-qt{font-weight:600;margin-bottom:9px;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-n{color:var(--ac2);margin-right:2px;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opts{display:flex;flex-direction:column;gap:6px;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt{display:flex;align-items:center;gap:10px;text-align:left;font:inherit;font-size:13px;color:var(--fg);cursor:pointer;padding:8px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--bg);transition:border-color var(--cd-t-fast),background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-mark{flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:16px;height:16px;border:2px solid var(--faint);border-radius:50%;font-size:11px;line-height:1;color:#11111b;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.right{border-color:#a6e3a1;background:rgba(166,227,161,.13);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.right .cd-quiz-mark{border-color:#a6e3a1;background:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.right .cd-quiz-mark::after{content:'\\2713';}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.wrong{border-color:#f38ba8;background:rgba(243,139,168,.13);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.wrong .cd-quiz-mark{border-color:#f38ba8;background:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.wrong.picked .cd-quiz-mark::after{content:'\\2715';}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-expl{margin-top:10px;padding:9px 12px;border-left:3px solid var(--ac);border-radius:0 8px 8px 0;background:var(--hl);font-size:12.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-reveal,#" + WIN_ID + " .cd-article .cd-fb-reveal{margin-top:10px;font:inherit;font-size:11.5px;font-weight:600;color:var(--muted);background:none;border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 12px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-reveal:hover,#" + WIN_ID + " .cd-article .cd-fb-reveal:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-fb{margin:14px 0;padding:12px 14px 14px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-fb-code{margin:0;border:1px solid var(--bd);border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-article .cd-fb-ans{margin-top:10px;padding:2px 13px;border-left:3px solid #f9b47a;border-radius:0 8px 8px 0;background:rgba(249,180,122,.11);}" +
  "#" + WIN_ID + " .cd-article .cd-fb-ans>:first-child{margin-top:8px;}" +
  // Флеш-карточки / «заполни пропуск» / тесты к задаче
  "#" + WIN_ID + " .cd-article .cd-fc-head,#" + WIN_ID + " .cd-article .cd-tests-head{font-weight:700;color:var(--ac2);font-size:13.5px;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-fc,#" + WIN_ID + " .cd-article .cd-tests{margin:14px 0;}" +
  "#" + WIN_ID + " .cd-article .cd-fc-check,#" + WIN_ID + " .cd-article .cd-fc-reveal{font:inherit;font-size:11.5px;font-weight:600;color:var(--muted);background:none;border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 12px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-check:hover,#" + WIN_ID + " .cd-article .cd-fc-reveal:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-code{margin:0 0 10px;border:1px solid var(--bd);border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-in{font-family:inherit;font-size:inherit;background:var(--bg);border:1px solid var(--ac);border-radius:var(--cd-r-sm);color:var(--fg);padding:0 4px;margin:0 1px;}" +
  "#" + WIN_ID + " .cd-article .cd-fc-in.right{border-color:#a6e3a1;background:rgba(166,227,161,.15);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-in.wrong{border-color:#f38ba8;background:rgba(243,139,168,.15);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-ctl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-fc-msg,#" + WIN_ID + " .cd-article .cd-tests-note{font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-tests-note{margin-top:8px;}" +
  "#" + WIN_ID + " .cd-article .cd-tests-copy{font:inherit;font-size:10px;padding:2px 7px;border-radius:var(--cd-r-sm);border:1px solid var(--bd);background:var(--bg);color:var(--muted);cursor:pointer;margin-left:6px;}" +
  "#" + WIN_ID + " .cd-article .cd-tests-copy:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-tests-copy.done{color:var(--ts);border-color:var(--ts);}" +

  // «Живой пример» (```live): слайдеры + пересчёт кода и вывода
  "#" + WIN_ID + " .cd-article .cd-live{margin:14px 0;padding:13px 15px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-live-head{font-weight:700;color:var(--ac2);font-size:13.5px;margin:0 0 11px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-ctl{display:flex;flex-direction:column;gap:9px;margin:0 0 12px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-p{display:flex;align-items:center;gap:11px;font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-nm{flex:0 0 auto;min-width:34px;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-weight:600;color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-live-sl{flex:1 1 auto;max-width:260px;accent-color:var(--ac);cursor:pointer;height:4px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-num{flex:0 0 auto;min-width:34px;text-align:right;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-live-code{margin:0 0 11px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-outlab{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 5px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-out{margin:0;padding:10px 13px;border-radius:var(--cd-r-md);background:var(--bg);border:1px solid var(--bd);overflow-x:auto;}" +
  "#" + WIN_ID + " .cd-article .cd-live-out code{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;white-space:pre;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-live-val{color:var(--ac2);font-weight:700;background:var(--hl);border-radius:var(--cd-r-xs);padding:0 3px;}" +

  // Пошаговый проигрыватель (```steps)
  // кадры
  "#" + WIN_ID + " .cd-article .cd-frames{margin:14px 0;padding:13px 15px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-fr-badge{background:color-mix(in srgb,#fab387 22%,transparent);color:#fab387;}" +
  "#" + WIN_ID + " .cd-article .cd-fr-screen{margin:8px 0;padding:12px 14px;border-radius:var(--cd-r-lg);background:#11111b;color:#a6e3a1;font-size:13px;line-height:1.25;min-height:5em;overflow:auto;box-shadow:inset 0 0 0 1px var(--bd),inset 0 0 24px rgba(166,227,161,.06);}" +
  "#" + WIN_ID + ".light .cd-article .cd-fr-screen{background:#1e1e2e;}" +
  "#" + WIN_ID + " .cd-article .cd-fr-cap:empty{display:none;}" +
  // память по шагам
  "#" + WIN_ID + " .cd-article .cd-mem{container-type:inline-size;margin:14px 0;padding:13px 15px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-mem-badge{background:color-mix(in srgb,#89b4fa 22%,transparent);color:#89b4fa;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-body{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;align-items:start;}" +
  "@container (max-width:560px){#" + WIN_ID + " .cd-article .cd-mem-body{grid-template-columns:1fr;}}" +
  "#" + WIN_ID + " .cd-article .cd-mem-code{margin:0;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-ln.cur{background:rgba(var(--ac-rgb),.18);box-shadow:inset 3px 0 0 var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-frame{border:1px solid var(--bd);border-radius:var(--cd-r-lg);padding:6px 8px;margin-bottom:6px;background:color-mix(in srgb,var(--fg) 3%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-frame.top{border-color:color-mix(in srgb,var(--ac) 55%,var(--bd));}" +
  "#" + WIN_ID + " .cd-article .cd-mem-fname{font-size:10.5px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-var,#" + WIN_ID + " .cd-article .cd-mem-blk{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:3px 5px;border-radius:var(--cd-r-md);font-size:12px;transition:background .2s,box-shadow .2s;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-vn{font-family:var(--mono,monospace);font-weight:700;min-width:1.5em;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-var.changed{background:rgba(var(--ac-rgb),.14);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-blk{border:1px dashed var(--bd);margin-bottom:6px;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-blk.dead{opacity:.55;text-decoration:line-through;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-bid{font-weight:800;color:#fab387;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-bt{color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-ptr{display:inline-block;padding:1px 7px;border-radius:var(--cd-r-pill);font-size:11.5px;font-weight:700;color:var(--ac);background:rgba(var(--ac-rgb),.14);cursor:default;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-ptr.null{color:var(--faint);background:color-mix(in srgb,var(--fg) 8%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-ptr.dead{color:#f38ba8;background:rgba(243,139,168,.14);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-hit{box-shadow:0 0 0 2px var(--ac);background:rgba(var(--ac-rgb),.16);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-empty{font-size:11.5px;color:var(--faint);font-style:italic;padding:4px;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-note:empty{display:none;}" +
  "#" + WIN_ID + " .cd-article .cd-steps{container-type:inline-size;margin:14px 0;padding:13px 15px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-st-head{display:flex;align-items:center;gap:10px;margin:0 0 10px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-st-badge{font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent);border-radius:var(--cd-r-pill);padding:3px 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-title{font-weight:700;color:var(--ac2);font-size:13.5px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-body{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(150px,1fr);gap:12px;align-items:start;}" +
  "#" + WIN_ID + " .cd-article .cd-st-code{margin:0;max-height:340px;overflow:auto;position:relative;}" +
  "#" + WIN_ID + " .cd-article .cd-st-ln{display:block;padding-right:8px;border-left:3px solid transparent;transition:background .18s,border-color .18s;}" +
  "#" + WIN_ID + " .cd-article .cd-st-no{display:inline-block;width:2.2em;margin-right:8px;text-align:right;color:var(--muted);opacity:.6;user-select:none;}" +
  "#" + WIN_ID + " .cd-article .cd-st-ln.cd-st-cur{background:color-mix(in srgb,var(--ac) 18%,transparent);border-left-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-st-ln.cd-st-cur .cd-st-no{color:var(--ac);opacity:1;font-weight:700;}" +
  "#" + WIN_ID + " .cd-article .cd-st-lab{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 5px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-vars{display:flex;flex-direction:column;gap:4px;margin:0 0 12px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-var{display:flex;justify-content:space-between;gap:10px;padding:4px 9px;border-radius:var(--cd-r-md);border:1px solid var(--bd);background:var(--bg);font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;transition:background var(--cd-t-slow),border-color var(--cd-t-slow);}" +
  "#" + WIN_ID + " .cd-article .cd-st-var.chg{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,var(--bg));}" +
  "#" + WIN_ID + " .cd-article .cd-st-k{color:var(--ac);font-weight:600;}" +
  "#" + WIN_ID + " .cd-article .cd-st-v{color:var(--fg);font-weight:700;overflow-wrap:anywhere;text-align:right;}" +
  "#" + WIN_ID + " .cd-article .cd-st-empty{font-size:12px;color:var(--muted);font-style:italic;}" +
  "#" + WIN_ID + " .cd-article .cd-st-out{margin:0;padding:8px 11px;border-radius:var(--cd-r-md);background:var(--bg);border:1px solid var(--bd);min-height:1.6em;max-height:140px;overflow:auto;}" +
  "#" + WIN_ID + " .cd-article .cd-st-out code{background:none;padding:0;border:0;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;white-space:pre;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-st-note{margin:11px 0 0;padding:8px 12px;border-radius:var(--cd-r-md);background:color-mix(in srgb,var(--ac2) 10%,transparent);font-size:13px;line-height:1.5;min-height:1.5em;}" +
  "#" + WIN_ID + " .cd-article .cd-st-ctl{display:flex;align-items:center;gap:7px;margin:11px 0 0;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-st-btn{font:inherit;font-size:12px;font-weight:600;color:var(--fg);background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 12px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-st-btn:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-st-main{background:var(--ac);border-color:var(--ac);color:var(--bg);}" +
  "#" + WIN_ID + " .cd-article .cd-st-main:hover{color:var(--bg);filter:brightness(1.1);}" +
  "#" + WIN_ID + " .cd-article .cd-st-end .cd-st-main{opacity:.45;}" +
  "#" + WIN_ID + " .cd-article .cd-st-pos{flex:1 1 auto;text-align:center;font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-st-track{height:3px;border-radius:2px;background:var(--bd);margin:10px 0 0;overflow:hidden;}" +
  "#" + WIN_ID + " .cd-article .cd-st-fill{height:100%;width:0;background:var(--ac);transition:width var(--cd-t-slow);}" +
  "@container (max-width:540px){#" + WIN_ID + " .cd-article .cd-st-body{grid-template-columns:1fr;}}" +

  "#" + WIN_ID + " .cd-article .cd-st-chk{display:none;border-color:var(--ac2);color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-article .cd-st-asking .cd-st-chk{display:inline-block;}" +
  "#" + WIN_ID + " .cd-article .cd-st-var.ask{border-style:dashed;border-color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-run-nl{opacity:.55;margin:0 .15em;}" +
  "#" + WIN_ID + " .cd-hints{margin-top:10px;}" +
  "#" + WIN_ID + " .cd-hint{margin:6px 0;padding:7px 10px;border-radius:var(--cd-r-md);background:color-mix(in srgb,var(--ac) 10%,transparent);border-left:3px solid var(--ac);font-size:.95em;}" +
  "#" + WIN_ID + " .cd-hints-ctl{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px;}" +
  "#" + WIN_ID + " .cd-hints-ctl button{font:inherit;font-size:.9em;padding:4px 10px;border-radius:var(--cd-r-md);border:1px solid var(--line,rgba(127,127,127,.35));background:transparent;color:var(--fg);cursor:pointer;}" +
  "#" + WIN_ID + " .cd-hints-ctl button:disabled{opacity:.45;cursor:default;}" +
  "#" + WIN_ID + " .cd-sol-why{font-size:.85em;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-sol{margin-top:8px;}" +
  "#" + WIN_ID + " .cd-sol-lab{font-size:.9em;color:var(--muted);margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-in{width:5.5em;font:inherit;font-weight:700;text-align:right;color:var(--fg);background:transparent;border:0;border-bottom:1px dashed var(--muted);outline:none;padding:0 2px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-in:focus{border-bottom-color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-article .cd-st-in.bad{color:#f38ba8;border-bottom-color:#f38ba8;animation:cdStShake .3s;}" +
  "#" + WIN_ID + " .cd-article .cd-st-in.good{color:#a6e3a1;border-bottom-color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-st-yes{color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-boss{margin:22px 0 14px;padding:15px 17px;border-radius:var(--cd-r-2xl);border:1px solid color-mix(in srgb,#f9e2af 40%,var(--bd));background:linear-gradient(135deg,color-mix(in srgb,#f9e2af 10%,var(--panel)),color-mix(in srgb,var(--ac) 8%,var(--panel)));}" +
  "#" + WIN_ID + " .cd-article .cd-boss-head{display:flex;align-items:center;gap:12px;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-crown{font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.25));}" +
  "#" + WIN_ID + " .cd-article .cd-boss-kick{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#f9e2af;font-weight:700;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-title{font-size:15px;font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-boss-lock{margin:11px 0 0;font-size:13px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-boss-peek{font:inherit;font-size:12px;color:var(--ac);background:none;border:0;padding:0;margin-left:4px;text-decoration:underline dotted;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-body{display:none;margin:12px 0 0;}" +
  "#" + WIN_ID + " .cd-article .cd-boss.open .cd-boss-lock{display:none;}" +
  "#" + WIN_ID + " .cd-article .cd-boss.open .cd-boss-body{display:block;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-done{margin-top:6px;font:inherit;font-size:12.5px;font-weight:700;color:#1e1e2e;background:#f9e2af;border:0;border-radius:var(--cd-r-pill);padding:6px 14px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article .cd-boss.won{border-color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-boss.won .cd-boss-done{background:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-next{margin:12px 0 0;padding:10px 12px;border-radius:var(--cd-r-lg);background:color-mix(in srgb,var(--fg) 5%,transparent);font-size:13px;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-tasks{display:flex;flex-direction:column;gap:5px;margin:7px 0 0;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-tasks a{display:block;padding:6px 10px;border-radius:var(--cd-r-md);border:1px solid var(--bd);text-decoration:none;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-boss-tasks a:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-home-spot .cd-spot-f{color:var(--muted);font-weight:400;}" +
  // светлая тема и сепия: пастельные акценты тёмной темы на белом бледнеют — берём насыщенные
  "#" + WIN_ID + ".light .cd-article .cd-st-in.bad,#" + WIN_ID + ".sepia .cd-article .cd-st-in.bad{color:#d20f39;border-bottom-color:#d20f39;}" +
  "#" + WIN_ID + ".light .cd-article .cd-st-in.good,#" + WIN_ID + ".sepia .cd-article .cd-st-in.good{color:#40a02b;border-bottom-color:#40a02b;}" +
  "#" + WIN_ID + ".light .cd-article .cd-st-yes,#" + WIN_ID + ".sepia .cd-article .cd-st-yes{color:#40a02b;}" +
  "#" + WIN_ID + ".light .cd-article .cd-boss-kick,#" + WIN_ID + ".sepia .cd-article .cd-boss-kick{color:#b7791f;}" +
  "#" + WIN_ID + ".light .cd-article .cd-boss,#" + WIN_ID + ".sepia .cd-article .cd-boss{border-color:color-mix(in srgb,#df8e1d 45%,var(--bd));background:linear-gradient(135deg,color-mix(in srgb,#df8e1d 9%,var(--panel)),color-mix(in srgb,var(--ac) 6%,var(--panel)));}" +
  "#" + WIN_ID + ".light .cd-article .cd-boss-done,#" + WIN_ID + ".sepia .cd-article .cd-boss-done{background:#df8e1d;color:#fff;}" +
  "#" + WIN_ID + ".light .cd-article .cd-boss.won .cd-boss-done,#" + WIN_ID + ".sepia .cd-article .cd-boss.won .cd-boss-done{background:#40a02b;color:#fff;}" +
  "#" + WIN_ID + ".light .cd-article .cd-boss.won,#" + WIN_ID + ".sepia .cd-article .cd-boss.won{border-color:#40a02b;}" +
  "#" + WIN_ID + ".light .cd-dt-steps .cd-dt-v,#" + WIN_ID + ".sepia .cd-dt-steps .cd-dt-v{color:#1e8fa6;}" +
  "#" + WIN_ID + " .cd-ghead .cd-gl::before{display:none;}" +
  "#" + WIN_ID + " .cd-hero-stats.cd-hs4{grid-template-columns:repeat(2,minmax(0,1fr));}" +
  "#" + WIN_ID + " .cd-home-spot{display:flex;align-items:center;gap:12px;width:100%;margin:10px 0 0;padding:11px 14px;border-radius:var(--cd-r-2xl);border:1px solid var(--bd);border-left:3px solid var(--ac2);background:color-mix(in srgb,var(--ac2) 7%,var(--panel));font:inherit;color:var(--fg);text-align:left;cursor:pointer;transition:transform var(--cd-t-fast),box-shadow var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-spot:hover{transform:translateY(-1px);box-shadow:var(--sh2,0 4px 14px rgba(0,0,0,.2));border-color:color-mix(in srgb,var(--ac2) 50%,var(--bd));}" +
  "#" + WIN_ID + " .cd-spot-ic{flex:0 0 auto;width:32px;height:32px;border-radius:var(--cd-r-lg);display:grid;place-items:center;font-size:16px;color:var(--ac2);background:color-mix(in srgb,var(--ac2) 16%,transparent);}" +
  "#" + WIN_ID + " .cd-spot-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;}" +
  "#" + WIN_ID + " .cd-spot-lbl{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-spot-t{font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-spot-f{font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-spot-bar{display:block;height:3px;margin-top:5px;border-radius:2px;background:var(--bd);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-spot-bar i{display:block;height:100%;background:var(--ac2);border-radius:2px;}" +
  "#" + WIN_ID + " .cd-spot-go{flex:0 0 auto;font-size:15px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-home-spot:hover .cd-spot-go{color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-kicker{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 12px;font-size:11px;}" +
  "#" + WIN_ID + " .cd-kicker span{padding:2px 9px;border-radius:var(--cd-r-pill);border:1px solid var(--bd);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-kicker .cd-kk-g{font-weight:800;letter-spacing:.05em;text-transform:uppercase;font-size:10px;color:color-mix(in srgb,var(--gcolor) 75%,var(--fg));border-color:color-mix(in srgb,var(--gcolor) 40%,var(--bd));background:color-mix(in srgb,var(--gcolor) 12%,transparent);}" +
  "#" + WIN_ID + " .cd-kicker .cd-kk-ok{color:#a6e3a1;border-color:color-mix(in srgb,#a6e3a1 40%,var(--bd));}" +
  "#" + WIN_ID + " .cd-article .codewrap.cd-copied{animation:cdCopied .7s ease-out;}" +
  "@keyframes cdCopied{0%{box-shadow:0 0 0 2px var(--ac);}100%{box-shadow:0 0 0 2px transparent;}}" +
  "#" + WIN_ID + ".light .cd-kicker .cd-kk-ok,#" + WIN_ID + ".sepia .cd-kicker .cd-kk-ok{color:#40a02b;}" +
  "#" + WIN_ID + ".no-anim .cd-article .codewrap.cd-copied,#" + WIN_ID + ".no-anim .cd-home-spot{animation:none;transition:none;}" +
  "@keyframes cdStShake{0%,100%{transform:none}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}" +
  "#" + WIN_ID + " .cd-dt-steps .cd-dt-ic{background:rgba(137,220,235,.16);}" +
  "#" + WIN_ID + " .cd-dt-steps .cd-dt-v{color:#89dceb;}" +

  // «Ката» (```challenge): собери код (parsons) + предскажи вывод (predict)
  "#" + WIN_ID + " .cd-article .cd-ch{margin:14px 0;padding:13px 15px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-ch.done{border-color:color-mix(in srgb,#a6e3a1 45%,var(--bd));}" +
  "#" + WIN_ID + " .cd-article .cd-ch-head{font-weight:600;color:var(--fg);font-size:13.5px;margin:0 0 11px;line-height:1.5;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-badge{display:inline-block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#11111b;background:var(--ac2);border-radius:var(--cd-r-sm);padding:2px 7px;margin-right:8px;vertical-align:1px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch.done .cd-ch-badge::after{content:' ✓';}" +
  "#" + WIN_ID + " .cd-article .cd-ch-lab{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:9px 0 5px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-bank,#" + WIN_ID + " .cd-article .cd-ch-sol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-sol{min-height:42px;padding:7px;border:1px dashed var(--bd);border-radius:var(--cd-r-md);background:var(--bg);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-sol:empty::before{content:attr(data-empty);color:var(--muted);font-size:12px;font-style:italic;display:block;padding:4px 5px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-item{display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 10px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--bg);transition:border-color var(--cd-t-fast),background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-item:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-item code{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;white-space:pre;background:none;padding:0;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-grip{flex:0 0 auto;color:var(--faint);font-size:11px;letter-spacing:-2px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-item.right{border-color:#a6e3a1;background:rgba(166,227,161,.12);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-item.wrong{border-color:#f38ba8;background:rgba(243,139,168,.12);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-ctl,#" + WIN_ID + " .cd-article .cd-pr-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:11px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-check,#" + WIN_ID + " .cd-article .cd-pr-check{font:inherit;font-size:12px;font-weight:600;color:#11111b;background:var(--ac);border:1px solid var(--ac);border-radius:var(--cd-r-pill);padding:6px 15px;cursor:pointer;transition:filter var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-check:hover,#" + WIN_ID + " .cd-article .cd-pr-check:hover{filter:brightness(1.08);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-reset,#" + WIN_ID + " .cd-article .cd-pr-reveal{font:inherit;font-size:11.5px;font-weight:600;color:var(--muted);background:none;border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 12px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-reset:hover,#" + WIN_ID + " .cd-article .cd-pr-reveal:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-pr-in{flex:1 1 180px;min-width:120px;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:13px;background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-md);color:var(--fg);padding:7px 11px;}" +
  "#" + WIN_ID + " .cd-article .cd-pr-in:focus{outline:none;border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-pr-in.right{border-color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-pr-in.wrong{border-color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-msg{font-size:12px;color:var(--muted);flex-basis:100%;}" +
  "#" + WIN_ID + " .cd-article .cd-mood{flex:0 0 auto;width:40px;height:40px;margin-right:-4px;}" +
  "#" + WIN_ID + " .cd-article .cd-mood img{width:40px;height:40px;object-fit:contain;display:block;}" +
  "#" + WIN_ID + " .cd-article .cd-mood.m-think img{animation:cd-mood-bob 1.2s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-article .cd-mood.m-win img{animation:cd-mood-pop .5s cubic-bezier(.3,1.6,.5,1);}" +
  "#" + WIN_ID + " .cd-article .cd-mood.m-oops img{animation:cd-mood-shake .45s ease;}" +
  "#" + WIN_ID + " .cd-article .cd-mood + .cd-ch-msg{flex-basis:calc(100% - 48px);align-self:center;}" +
  "@keyframes cd-mood-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}" +
  "@keyframes cd-mood-pop{0%{transform:scale(.6)}100%{transform:scale(1)}}" +
  "@keyframes cd-mood-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}" +
  "#" + WIN_ID + ".no-anim .cd-mood img{animation:none!important;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-msg.ok{color:#a6e3a1;font-weight:600;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-msg.err{color:#f38ba8;}" +
  // «Напиши и запусти» (```challenge @type run)
  "#" + WIN_ID + " .cd-article .cd-run-code{display:block;width:100%;box-sizing:border-box;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;line-height:1.5;tab-size:4;color:var(--fg);background:var(--code);border:1px solid var(--bd);border-radius:var(--cd-r-md);padding:10px 12px;resize:vertical;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-run-code:focus{outline:none;border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-run-go{font:inherit;font-size:12px;font-weight:700;color:#11111b;background:var(--ac);border:1px solid var(--ac);border-radius:var(--cd-r-pill);padding:6px 16px;cursor:pointer;transition:filter var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-run-go:hover{filter:brightness(1.08);}" +
  "#" + WIN_ID + " .cd-article .cd-run-go:disabled{opacity:.6;cursor:progress;}" +
  "#" + WIN_ID + " .cd-article .cd-run-tinfo{font-size:11.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-run-out{margin-top:11px;display:flex;flex-direction:column;gap:5px;}" +
  "#" + WIN_ID + " .cd-article .cd-run-t{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;font-size:12.5px;padding:6px 10px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--bg);}" +
  "#" + WIN_ID + " .cd-article .cd-run-t.ok{border-color:color-mix(in srgb,#a6e3a1 45%,var(--bd));}" +
  "#" + WIN_ID + " .cd-article .cd-run-t.bad{border-color:color-mix(in srgb,#f38ba8 45%,var(--bd));}" +
  "#" + WIN_ID + " .cd-article .cd-run-t.skip{opacity:.6;border-style:dashed;}" +
  // Пример с другими применениями: вкладки-подписи над кодом, стрелки и точки справа по центру
  "#" + WIN_ID + " .cd-alts .codehead{border-bottom:0;}" +
  "#" + WIN_ID + " .cd-alt-count{margin-left:10px;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ac);opacity:.85;}" +
  "#" + WIN_ID + " .cd-alt-tabs{display:flex;gap:6px;padding:2px 12px 10px;overflow-x:auto;scrollbar-width:none;scroll-behavior:smooth;" +
    "-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 12px,#000 calc(100% - 18px),transparent);mask-image:linear-gradient(90deg,transparent 0,#000 12px,#000 calc(100% - 18px),transparent);}" +
  "#" + WIN_ID + " .cd-alt-tabs::-webkit-scrollbar{display:none;}" +
  "#" + WIN_ID + " .cd-alt-tab{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12px;font-weight:600;color:var(--muted);" +
    "background:color-mix(in srgb,var(--fg) 4%,transparent);border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:4px 12px 4px 5px;cursor:pointer;white-space:nowrap;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-alt-tab i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;border-radius:50%;font-size:10.5px;" +
    "background:color-mix(in srgb,var(--fg) 10%,transparent);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-alt-tab:hover{color:var(--fg);border-color:color-mix(in srgb,var(--ac) 60%,var(--bd));}" +
  "#" + WIN_ID + " .cd-alt-tab.on{color:var(--fg);border-color:var(--ac);background:color-mix(in srgb,var(--ac) 16%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 12%,transparent);}" +
  "#" + WIN_ID + " .cd-alt-tab.on i{background:var(--ac);color:#11111b;}" +
  "#" + WIN_ID + " .cd-alt-tab:focus-visible,#" + WIN_ID + " .cd-alt-go:focus-visible{outline:2px solid var(--ac);outline-offset:2px;}" +
  // все слайды — в одной ячейке сетки: высота = самый высокий, страница при листании не прыгает
  "#" + WIN_ID + " .cd-alt-body{position:relative;display:grid;border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent);}" +
  "#" + WIN_ID + " .cd-alt-pane{grid-area:1/1;min-width:0;visibility:hidden;opacity:0;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-alt-pane.on{visibility:visible;opacity:1;pointer-events:auto;}" +
  "#" + WIN_ID + " .cd-alt-pane.in-r{animation:cdAltInR .28s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-alt-pane.in-l{animation:cdAltInL .28s cubic-bezier(.2,.8,.2,1);}" +
  "@keyframes cdAltInR{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}" +
  "@keyframes cdAltInL{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:none}}" +
  "#" + WIN_ID + ".no-anim .cd-alt-pane{animation:none!important;}" +
  "#" + WIN_ID + " .cd-alt-body pre.code{padding-right:64px;margin:0;}" +
  "#" + WIN_ID + " .cd-alt-nav{position:absolute;right:12px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;z-index:2;}" +
  "#" + WIN_ID + " .cd-alt-go{font:inherit;font-size:22px;line-height:1;width:38px;height:38px;border-radius:50%;cursor:pointer;color:var(--fg);" +
    "background:color-mix(in srgb,var(--panel) 72%,transparent);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);" +
    "border:1px solid color-mix(in srgb,var(--ac) 55%,var(--bd));box-shadow:0 4px 14px rgba(0,0,0,.28);transition:transform var(--cd-t-fast),background var(--cd-t-fast),color var(--cd-t-fast),opacity var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-alt-go:hover:not([disabled]){background:var(--ac);color:#11111b;transform:scale(1.08);}" +
  "#" + WIN_ID + " .cd-alt-go:active:not([disabled]){transform:scale(.95);}" +
  "#" + WIN_ID + " .cd-alt-go[disabled]{opacity:.28;cursor:default;box-shadow:none;}" +
  // пока ни разу не листали — стрелка «дальше» мягко зовёт
  "#" + WIN_ID + " .cd-alts:not(.used) .cd-alt-go.next{animation:cdAltCall 2.4s ease-in-out 1s 3;}" +
  "@keyframes cdAltCall{0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.28)}50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--ac) 25%,transparent),0 4px 14px rgba(0,0,0,.28)}}" +
  "#" + WIN_ID + ".no-anim .cd-alt-go.next{animation:none!important;}" +
  "#" + WIN_ID + " .cd-alt-dots{display:flex;flex-direction:column;gap:4px;}" +
  "#" + WIN_ID + " .cd-alt-dots i{width:5px;height:5px;border-radius:50%;background:color-mix(in srgb,var(--fg) 25%,transparent);transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-alt-dots i.on{background:var(--ac);height:12px;border-radius:3px;}" +
  // «Забегаем вперёд» под кодом
  "#" + WIN_ID + " .cd-article .cd-ahead{margin:0;padding:9px 14px 10px;border-top:1px dashed color-mix(in srgb,#89b4fa 40%,var(--bd));" +
    "background:color-mix(in srgb,#89b4fa 6%,transparent);font-size:12px;line-height:1.55;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-ahead-h{display:flex;align-items:center;gap:7px;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#89b4fa;margin-bottom:3px;}" +
  "#" + WIN_ID + " .cd-article .cd-ahead-ic{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:color-mix(in srgb,#89b4fa 22%,transparent);font-size:12px;}" +
  "#" + WIN_ID + " .cd-article .cd-ahead ul{margin:0;padding-left:18px;}" +
  "#" + WIN_ID + " .cd-article .cd-ahead li{margin:2px 0;}" +
  "#" + WIN_ID + " .cd-article .cd-ahead code{font-size:11.5px;}" +
  "#" + WIN_ID + " .cd-article .cd-run-tmark{flex:0 0 auto;font-weight:700;}" +
  "#" + WIN_ID + " .cd-article .cd-run-t.ok .cd-run-tmark{color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-run-t.bad .cd-run-tmark{color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-run-tgot{color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-run-tcrash{flex-basis:100%;color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-run-tcrash code{display:block;margin-top:4px;white-space:pre-wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-run-t code{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12px;}" +
  "#" + WIN_ID + " .cd-article .cd-run-err{margin:0;padding:10px 12px;border-radius:var(--cd-r-md);background:var(--code);border:1px solid color-mix(in srgb,#f38ba8 40%,var(--bd));overflow-x:auto;}" +
  "#" + WIN_ID + " .cd-article .cd-run-err code{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12px;color:#f38ba8;white-space:pre;}" +
  "#" + WIN_ID + " .cd-article .cd-run-hint{margin-top:10px;font-size:12px;color:var(--muted);padding:9px 12px;border-left:3px solid var(--ac);border-radius:0 8px 8px 0;background:var(--hl);}" +

  // «Смотри также» — связанные материалы в конце статьи
  "#" + WIN_ID + " .cd-article .cd-seealso{margin:34px 0 6px;padding-top:18px;border-top:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-article .cd-seealso-h{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:0 0 11px;}" +
  "#" + WIN_ID + " .cd-article .cd-seealso-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:9px;}" +
  "#" + WIN_ID + " .cd-article .cd-see{display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left;font:inherit;cursor:pointer;padding:10px 13px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--panel);transition:border-color var(--cd-t-fast),transform var(--cd-t-fast),background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-see:hover{border-color:var(--ac);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-article .cd-see-t{font-size:13px;font-weight:600;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-see-s{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-article .cd-see-g{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-top:3px;}" +

  // «Обучение» — руководство по интерфейсу (модальный оверлей поверх окна)
  "#" + WIN_ID + " .cd-guide{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);padding:22px;}" +
  "#" + WIN_ID + " .cd-guide-panel{display:flex;flex-direction:column;width:min(680px,100%);max-height:100%;background:var(--panel);border:1px solid var(--bd);border-radius:var(--cd-r-2xl);box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-guide-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 20px;border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-guide-title{font-size:15px;font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-guide-close{flex:0 0 auto;font:inherit;font-size:14px;color:var(--muted);background:none;border:1px solid var(--bd);border-radius:var(--cd-r-md);width:30px;height:30px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-guide-close:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-guide-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:11px 20px 4px;border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-guide-chip{font:inherit;font-size:12px;font-weight:600;color:var(--muted);background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 13px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-guide-chip:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-guide-chip.on{background:var(--ac);color:#11111b;border-color:transparent;}" +
  "#" + WIN_ID + " .cd-guide-scroll{overflow-y:auto;padding:14px 22px 20px;}" +
  "#" + WIN_ID + " .cd-guide-page h3{font-size:12px;font-weight:700;color:var(--ac2);margin:2px 0 9px;text-transform:uppercase;letter-spacing:.05em;}" +
  "#" + WIN_ID + " .cd-guide-page h3:not(:first-child){margin-top:20px;}" +
  "#" + WIN_ID + " .cd-guide-page p{margin:0 0 10px;font-size:13px;line-height:1.62;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-guide-page ul{margin:0 0 10px;padding-left:18px;}" +
  "#" + WIN_ID + " .cd-guide-page li{font-size:13px;line-height:1.62;color:var(--fg);margin:5px 0;}" +
  "#" + WIN_ID + " .cd-guide-page code{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12px;background:var(--code);padding:1px 5px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-guide-page b{color:var(--fg);font-weight:700;}" +
  "#" + WIN_ID + " .cd-guide-try-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px;}" +
  "#" + WIN_ID + " .cd-guide-try{font:inherit;font-size:12px;font-weight:600;color:var(--fg);background:var(--bg);border:1px solid var(--ac);border-radius:var(--cd-r-md);padding:8px 14px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-guide-try:hover{background:var(--hl);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-guide-note{font-size:12px;color:var(--muted);font-style:italic;}" +
  "#" + WIN_ID + " .cd-guide-hint{font-size:12px;color:var(--muted);margin:14px 0 6px;}" +
  "#" + WIN_ID + " .cd-guide-demo{border:1px dashed var(--bd);border-radius:var(--cd-r-xl);padding:2px 14px;background:color-mix(in srgb,var(--fg) 3%,var(--panel));}" +
  "#" + WIN_ID + " .cd-guide .cd-article{padding:0;margin:0;background:none;max-width:none;font-size:13px;}" +

  // Окно «Прогресс»: карта знаний, экзамен недели, достижения, рекорды (12-progress-map.js, 12-rewards.js)
  "#" + WIN_ID + " .cd-pg-panel{width:min(900px,100%);}" +
  "#" + WIN_ID + " .cd-pg .cd-guide-top{gap:10px;}" +
  "#" + WIN_ID + " .cd-pg .cd-guide-title{flex:1;}" +
  "#" + WIN_ID + " .cd-pg-anki{font:inherit;font-size:12px;color:var(--fg);background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-md);padding:5px 11px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-pg-anki:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-pg-empty{color:var(--muted);font-size:13px;}" +
  "#" + WIN_ID + " .cd-mbar{display:inline-block;vertical-align:middle;width:90px;height:6px;border-radius:3px;background:color-mix(in srgb,var(--fg) 12%,transparent);overflow:hidden;margin:0 8px;}" +
  "#" + WIN_ID + " .cd-mbar.sm{width:70px;height:5px;}" +
  "#" + WIN_ID + " .cd-mbar i{display:block;height:100%;background:var(--ac);border-radius:inherit;}" +
  "#" + WIN_ID + " .cd-mbar.m1 i{background:#f38ba8;}#" + WIN_ID + " .cd-mbar.m2 i{background:#fab387;}#" + WIN_ID + " .cd-mbar.m3 i{background:#f9e2af;}#" + WIN_ID + " .cd-mbar.m4 i{background:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-km-sum{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;font-size:13px;margin-bottom:10px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-km-sum b{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-km-next,#" + WIN_ID + " .cd-weak-go,#" + WIN_ID + " .cd-kd-open,#" + WIN_ID + " .cd-wk-start,#" + WIN_ID + " .cd-wk-next,#" + WIN_ID + " .cd-wk-again,#" + WIN_ID + " .cd-pg-tab-go,#" + WIN_ID + " .cd-wk-quit{font:inherit;font-size:12px;font-weight:600;color:var(--fg);background:var(--bg);border:1px solid var(--ac);border-radius:var(--cd-r-md);padding:6px 12px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-km-next:hover,#" + WIN_ID + " .cd-weak-go:hover,#" + WIN_ID + " .cd-kd-open:hover,#" + WIN_ID + " .cd-wk-start:hover,#" + WIN_ID + " .cd-wk-next:hover,#" + WIN_ID + " .cd-wk-again:hover,#" + WIN_ID + " .cd-pg-tab-go:hover{background:var(--hl);}" +
  "#" + WIN_ID + " .cd-wk-quit{border-color:var(--bd);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-km-wrap{overflow-x:auto;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 3%,var(--panel));padding:6px;}" +
  "#" + WIN_ID + " .cd-km{display:block;margin:0 auto;}" +
  "#" + WIN_ID + " .cd-km-e{fill:none;stroke:color-mix(in srgb,var(--fg) 22%,transparent);stroke-width:1.4;}" +
  "#" + WIN_ID + " .cd-km-e.on{stroke:color-mix(in srgb,var(--ac) 70%,transparent);}" +
  "#" + WIN_ID + " .cd-km-n{cursor:pointer;outline:none;}" +
  "#" + WIN_ID + " .cd-km-bg{fill:var(--panel);stroke:color-mix(in srgb,var(--fg) 18%,transparent);stroke-width:4;}" +
  "#" + WIN_ID + " .cd-km-fg{fill:none;stroke:var(--ac);stroke-width:4;stroke-linecap:round;}" +
  "#" + WIN_ID + " .cd-km-n.m1 .cd-km-fg{stroke:#f38ba8;}#" + WIN_ID + " .cd-km-n.m2 .cd-km-fg{stroke:#fab387;}#" + WIN_ID + " .cd-km-n.m3 .cd-km-fg{stroke:#f9e2af;}#" + WIN_ID + " .cd-km-n.m4 .cd-km-fg{stroke:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-km-n.m4 .cd-km-bg{fill:color-mix(in srgb,#a6e3a1 18%,var(--panel));}" +
  "#" + WIN_ID + " .cd-km-num{fill:var(--fg);font-size:11px;font-weight:700;text-anchor:middle;}" +
  "#" + WIN_ID + " .cd-km-t{fill:var(--muted);font-size:10px;text-anchor:middle;}" +
  "#" + WIN_ID + " .cd-km-n.lock{opacity:.4;}" +
  "#" + WIN_ID + " .cd-km-n.lock .cd-km-bg{stroke-dasharray:3 3;}" +
  "#" + WIN_ID + " .cd-km-n.next .cd-km-bg{stroke:var(--ac);animation:cdKmPulse 1.8s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-km-n:hover .cd-km-t,#" + WIN_ID + " .cd-km-n.sel .cd-km-t,#" + WIN_ID + " .cd-km-n:focus .cd-km-t{fill:var(--fg);font-weight:700;}" +
  "#" + WIN_ID + " .cd-km-n.sel .cd-km-bg{stroke:var(--fg);}" +
  "@keyframes cdKmPulse{0%,100%{stroke-opacity:1}50%{stroke-opacity:.35}}" +
  "#" + WIN_ID + ".no-anim .cd-km-n.next .cd-km-bg{animation:none;}" +
  "#" + WIN_ID + " .cd-km-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px;color:var(--muted);margin:8px 2px;}" +
  "#" + WIN_ID + " .cd-km-legend span::before{content:'';display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:-1px;background:color-mix(in srgb,var(--fg) 20%,transparent);}" +
  "#" + WIN_ID + " .cd-km-legend .m1::before{background:#f38ba8;}#" + WIN_ID + " .cd-km-legend .m2::before{background:#fab387;}#" + WIN_ID + " .cd-km-legend .m3::before{background:#f9e2af;}#" + WIN_ID + " .cd-km-legend .m4::before{background:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-km-legend .lock::before{background:none;border:1px dashed var(--muted);}" +
  "#" + WIN_ID + " .cd-km-detail{margin-top:10px;padding:12px 14px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--bg);}" +
  "#" + WIN_ID + " .cd-kd-h{display:flex;align-items:center;flex-wrap:wrap;font-size:13px;}" +
  "#" + WIN_ID + " .cd-kd-h em,#" + WIN_ID + " .cd-kd-parts em,#" + WIN_ID + " .cd-weak-main em{font-style:normal;font-weight:700;font-size:12px;}" +
  "#" + WIN_ID + " .cd-kd-parts{list-style:none;margin:8px 0;padding:0;font-size:12px;}" +
  "#" + WIN_ID + " .cd-kd-parts li{display:flex;align-items:center;gap:4px;margin:3px 0;}" +
  "#" + WIN_ID + " .cd-kd-parts li span:first-child{flex:0 0 190px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-kd-parts li.bad span:first-child{color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-kd-deps{font-size:12px;color:var(--muted);margin:6px 0;}" +
  "#" + WIN_ID + " .cd-kd-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}" +
  // Слабые места на главной
  "#" + WIN_ID + " .cd-weak{border:1px solid var(--bd);border-radius:var(--cd-r-xl);padding:10px 12px;margin:10px 0;background:color-mix(in srgb,var(--panel) 80%,transparent);}" +
  "#" + WIN_ID + " .cd-weak-h{font-size:12px;font-weight:700;margin-bottom:6px;}" +
  "#" + WIN_ID + " .cd-weak-h span{font-weight:400;color:var(--muted);margin-left:8px;}" +
  "#" + WIN_ID + " .cd-weak-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-top:1px solid color-mix(in srgb,var(--bd) 60%,transparent);}" +
  "#" + WIN_ID + " .cd-weak-row:first-of-type{border-top:0;}" +
  "#" + WIN_ID + " .cd-weak-main{flex:1 1 200px;font-size:12px;}" +
  "#" + WIN_ID + " .cd-weak-main small{display:block;color:var(--muted);font-size:11px;margin-top:2px;}" +
  "#" + WIN_ID + " .cd-home-warm.cd-weekly{border-color:color-mix(in srgb,#89b4fa 45%,var(--bd));}" +
  // Экзамен недели
  "#" + WIN_ID + " .cd-wk-intro p{font-size:13px;line-height:1.6;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-wk-hist{margin-top:16px;font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-wk-hist ul,#" + WIN_ID + " .cd-wk-by,#" + WIN_ID + " .cd-rec-last ul{list-style:none;padding:0;margin:6px 0;}" +
  "#" + WIN_ID + " .cd-wk-hist li,#" + WIN_ID + " .cd-wk-by li,#" + WIN_ID + " .cd-rec-last li{display:flex;gap:10px;align-items:center;padding:3px 0;font-size:12px;}" +
  "#" + WIN_ID + " .cd-wk-hist li span:first-child,#" + WIN_ID + " .cd-wk-by li span:first-child{flex:0 0 180px;}" +
  "#" + WIN_ID + " .cd-wk-top{display:flex;gap:14px;align-items:center;font-size:12px;color:var(--muted);margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-wk-timer{margin-left:auto;font-weight:700;color:var(--fg);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-wk-q{font-size:14px;line-height:1.55;margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-wk-from{font-size:11px;color:var(--muted);margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-wk-opts{display:flex;flex-direction:column;gap:6px;}" +
  "#" + WIN_ID + " .cd-wk-opt{text-align:left;font:inherit;font-size:13px;color:var(--fg);background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-md);padding:8px 12px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-wk-opt:hover:not([disabled]){border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-wk-opt.right{border-color:#a6e3a1;background:color-mix(in srgb,#a6e3a1 14%,var(--bg));}" +
  "#" + WIN_ID + " .cd-wk-opt.wrong{border-color:#f38ba8;background:color-mix(in srgb,#f38ba8 14%,var(--bg));}" +
  "#" + WIN_ID + " .cd-wk-expl{font-size:12px;color:var(--muted);margin-top:8px;}" +
  "#" + WIN_ID + " .cd-wk-ctl{display:flex;gap:8px;margin-top:12px;}" +
  "#" + WIN_ID + " .cd-wk-res{text-align:center;font-size:13px;}" +
  "#" + WIN_ID + " .cd-wk-big{font-size:38px;font-weight:800;margin:6px 0;}" +
  "#" + WIN_ID + " .cd-wk-res .cd-wk-by{max-width:420px;margin:12px auto;text-align:left;}" +
  "#" + WIN_ID + " .cd-wk-res .cd-wk-ctl{justify-content:center;}" +
  // Достижения и рекорды
  "#" + WIN_ID + " .cd-ach-sum,#" + WIN_ID + " .cd-rec-sum{font-size:13px;color:var(--muted);margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-ach-sum b,#" + WIN_ID + " .cd-rec-sum b{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-ach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;}" +
  "#" + WIN_ID + " .cd-ach{display:grid;grid-template-columns:36px 1fr;grid-template-rows:auto auto auto;column-gap:10px;padding:9px 10px;border:1px solid var(--bd);border-radius:var(--cd-r-lg);background:var(--bg);opacity:.55;filter:grayscale(1);}" +
  "#" + WIN_ID + " .cd-ach.got{opacity:1;filter:none;border-color:color-mix(in srgb,#f9e2af 50%,var(--bd));}" +
  "#" + WIN_ID + " .cd-ach-ic{grid-row:1/4;display:flex;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-ach-ic .cd-emo{width:32px;height:32px;}" +
  "#" + WIN_ID + " .cd-ach-mono{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--ac);color:#11111b;font-weight:800;}" +
  "#" + WIN_ID + " .cd-ach-t{font-size:12px;font-weight:700;}" +
  "#" + WIN_ID + " .cd-ach-d{font-size:11px;color:var(--muted);line-height:1.4;}" +
  "#" + WIN_ID + " .cd-ach-when{font-size:10px;color:var(--muted);margin-top:2px;}" +
  "#" + WIN_ID + " .cd-rec-t{font-size:12px;}" +
  "#" + WIN_ID + " .cd-rec-last{margin-top:12px;font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-rec-last li span:first-child{flex:0 0 90px;}" +
  "#" + WIN_ID + " .cd-rec-last li b{flex:0 0 50px;color:var(--fg);}" +
  // Контрольная точка и «Повтори за мной»: сравнение кода
  "#" + WIN_ID + " .cd-article .cd-cp{border:1px solid color-mix(in srgb,#89b4fa 45%,var(--bd));border-radius:var(--cd-r-xl);padding:12px 14px;margin:16px 0;background:color-mix(in srgb,#89b4fa 6%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-cp-head{display:flex;gap:10px;align-items:center;margin-bottom:6px;}" +
  "#" + WIN_ID + " .cd-article .cd-cp-stat{font-size:13px;margin:10px 0 4px;}" +
  "#" + WIN_ID + " .cd-article .cd-cp-miss{font-size:12px;color:#fab387;margin:4px 0;}" +
  "#" + WIN_ID + " .cd-article .cd-cp-note{font-size:12px;color:var(--muted);margin:4px 0 8px;}" +
  "#" + WIN_ID + " .cd-article .cd-df{border:1px solid var(--bd);border-radius:var(--cd-r-md);padding:6px 0;max-height:420px;overflow:auto;background:var(--code);font-family:'Cascadia Code',Consolas,monospace;font-size:12px;}" +
  "#" + WIN_ID + " .cd-article .cd-df-leg{display:flex;gap:14px;padding:0 10px 6px;font-family:inherit;font-size:11px;}" +
  "#" + WIN_ID + " .cd-article .cd-df-leg .del,#" + WIN_ID + " .cd-article .cd-df-l.del i{color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-df-leg .add,#" + WIN_ID + " .cd-article .cd-df-l.add i{color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-df-l{display:flex;gap:8px;padding:0 10px;white-space:pre;}" +
  "#" + WIN_ID + " .cd-article .cd-df-l i{font-style:normal;flex:0 0 10px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-df-l code{background:none;padding:0;}" +
  "#" + WIN_ID + " .cd-article .cd-df-l.del{background:color-mix(in srgb,#f38ba8 12%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-df-l.add{background:color-mix(in srgb,#a6e3a1 12%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-df-gap{padding:2px 28px;color:var(--muted);font-style:italic;font-family:inherit;}" +
  "#" + WIN_ID + " .cd-article .cd-rep-hide{display:block;font-size:12px;color:var(--muted);margin:6px 0;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article:has(.cd-rep.hidecode:not(.done)) pre:not(.peek){filter:blur(5px);cursor:pointer;user-select:none;}" +
  "#" + WIN_ID + " .cd-article:has(.cd-rep.hidecode:not(.done)) .cd-rep pre{filter:none;cursor:auto;user-select:auto;}" +

  // Плашка-мост доки↔редактор: всплывает снизу читалки по слову под курсором
  "#" + WIN_ID + " .cd-bridge{position:sticky;bottom:12px;z-index:6;margin:14px 14px 6px;display:flex;align-items:center;gap:11px;padding:10px 13px;border:1px solid var(--ac);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--panel) 92%,var(--ac));box-shadow:var(--cd-sh-2);}" +
  "#" + WIN_ID + " .cd-bridge-ic{flex:0 0 auto;font-size:15px;color:var(--ac);}" +
  "#" + WIN_ID + " .cd-bridge-body{flex:1 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-bridge-word{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-weight:700;font-size:13px;color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-bridge-def{font-size:12px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-bridge-open{flex:0 0 auto;font:inherit;font-size:11.5px;font-weight:700;color:#11111b;background:var(--ac);border:none;border-radius:var(--cd-r-pill);padding:6px 14px;cursor:pointer;transition:filter var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-bridge-open:hover{filter:brightness(1.1);}" +
  "#" + WIN_ID + " .cd-bridge-ex{flex:0 0 auto;font:inherit;font-size:11.5px;font-weight:700;color:var(--fg);background:none;border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 12px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-bridge-ex:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-bridge-ex[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-bridge-x{flex:0 0 auto;font:inherit;font-size:12px;color:var(--muted);background:none;border:none;cursor:pointer;padding:2px 4px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-bridge-x:hover{color:var(--fg);background:var(--hl);}" +

  // Подсветка отдельных строк кода (```cpp {3,5-7})
  "#" + WIN_ID + " pre.code.cd-lined code{display:block;}" +
  "#" + WIN_ID + " pre.code.cd-lined .cd-ln{display:block;}" +
  "#" + WIN_ID + " pre.code.cd-lined .cd-hl{background:rgba(var(--ac-rgb),.14);border-left:2px solid var(--ac);margin:0 -16px;padding:0 16px 0 14px;}" +

  // Диаграмма/схема (```diagram, ```svg)
  "#" + WIN_ID + " .cd-article .cd-figure{margin:16px 0;padding:16px 14px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 3%,var(--panel));text-align:center;}" +
  "#" + WIN_ID + " .cd-article .cd-figure-art{overflow-x:auto;}" +
  "#" + WIN_ID + " .cd-article .cd-figure svg{max-width:100%;height:auto;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-figure img{max-width:100%;height:auto;border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-article .cd-figure figcaption{margin-top:10px;font-size:12px;color:var(--muted);}" +

  // Было/стало в две колонки (```badgood)
  "#" + WIN_ID + " .cd-article .cd-badgood{display:flex;gap:12px;margin:14px 0;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col{flex:1 1 260px;min-width:0;border:1px solid var(--bd);border-radius:var(--cd-r-lg);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-article .cd-bg-lab{font-size:12px;font-weight:700;padding:6px 12px;border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col.bad .cd-bg-lab{color:#f38ba8;background:rgba(243,139,168,.12);}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col.good .cd-bg-lab{color:#a6e3a1;background:rgba(166,227,161,.12);}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col pre.code{border-radius:0;}" +

  // Транскрипт консоли (```console)
  "#" + WIN_ID + " .cd-article .cd-console{margin:14px 0;border:1px solid var(--bd);border-radius:var(--cd-r-lg);overflow:hidden;box-shadow:var(--cd-sh-1);}" +
  "#" + WIN_ID + " .cd-article .cd-console-bar{display:flex;align-items:center;gap:6px;padding:7px 12px;background:#1e1e2e;border-bottom:1px solid rgba(255,255,255,.08);}" +
  "#" + WIN_ID + " .cd-article .cd-console-dot{width:9px;height:9px;border-radius:50%;background:#585b70;}" +
  "#" + WIN_ID + " .cd-article .cd-console-dot:nth-child(1){background:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-console-dot:nth-child(2){background:#f9e2af;}" +
  "#" + WIN_ID + " .cd-article .cd-console-dot:nth-child(3){background:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-console-ttl{margin-left:6px;font-size:11px;color:#a6adc8;}" +
  "#" + WIN_ID + " .cd-article .cd-console-body{margin:0;padding:12px 16px;background:#11111b;color:#cdd6f4;overflow-x:auto;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;line-height:1.55;}" +
  "#" + WIN_ID + " .cd-article .cd-con-line{display:block;white-space:pre-wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-con-in{color:#a6e3a1;font-weight:700;}" +

  // Чек-лист «усвоено» (```checklist)
  "#" + WIN_ID + " .cd-article .cd-check{margin:16px 0;padding:14px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-check-head{font-weight:700;color:var(--ac2);font-size:13.5px;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-check-item{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;font:inherit;font-size:13px;color:var(--fg);cursor:pointer;padding:8px 10px;border:1px solid transparent;border-radius:var(--cd-r-md);background:none;transition:background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-check-item:hover{background:var(--hl);}" +
  "#" + WIN_ID + " .cd-article .cd-check-box{flex:0 0 auto;width:17px;height:17px;margin-top:1px;border:2px solid var(--faint);border-radius:var(--cd-r-sm);transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-check-item.on .cd-check-box{border-color:#a6e3a1;background:#a6e3a1;position:relative;}" +
  "#" + WIN_ID + " .cd-article .cd-check-item.on .cd-check-box::after{content:'\\2713';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#11111b;}" +
  "#" + WIN_ID + " .cd-article .cd-check-item.on .cd-check-txt{color:var(--muted);text-decoration:line-through;}" +

  // Вспышка при переходе к разделу (по ссылке/оглавлению)
  "@keyframes cd-flash{0%{background:rgba(var(--ac-rgb),.32);}100%{background:transparent;}}" +
  "#" + WIN_ID + " .cd-flash{animation:cd-flash 1.1s ease-out;border-radius:var(--cd-r-sm);}" +

  // Мягкое проявление статьи при открытии + плавный ховер пунктов
  "@keyframes cd-fade{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + " .cd-article.fade{animation:cd-fade .18s ease-out;}" +
  "#" + WIN_ID + " .cd-item{transition:background var(--cd-t-fast);}" +

  // Доступность: видимая обводка при навигации с клавиатуры
  "#" + WIN_ID + " button:focus-visible,#" + WIN_ID + " input:focus-visible,#" + WIN_ID + " [tabindex]:focus-visible{outline:2px solid var(--ac);outline-offset:1px;border-radius:var(--cd-r-sm);}" +

  // Ширина колонки чтения (широкий режим)
  "#" + WIN_ID + ".wide .cd-article{max-width:1180px;}" +

  // Плотный список файлов (компактный режим)
  "#" + WIN_ID + ".dense .cd-item{padding:5px 8px 5px 12px;}" +
  "#" + WIN_ID + ".dense .cd-it-sub{display:none;}" +
  "#" + WIN_ID + ".dense .cd-it-meta{margin-top:1px;}" +
  "#" + WIN_ID + ".dense .cd-it-title{font-size:12px;padding-right:34px;}" +
  // невысокое окно (ноутбук): описание пункта в одну строку, чтобы в списке помещалось больше
  "#" + WIN_ID + ".short:not(.dense) .cd-it-sub{-webkit-line-clamp:1;line-clamp:1;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;}" +
  "#" + WIN_ID + ".short:not(.dense) .cd-item{padding-top:6px;padding-bottom:6px;}" +

  // «Ничего не найдено» по поиску
  "#" + WIN_ID + " .cd-noresult{padding:18px 14px;text-align:center;color:var(--faint);font-size:12px;line-height:1.5;display:none;}" +
  "#" + WIN_ID + " .cd-noresult b{color:var(--muted);}" +

  // Наклейки-иллюстрации: пустые состояния, приветствие, «всё изучено»
  "#" + WIN_ID + " .cd-sticker{display:inline-block;vertical-align:middle;filter:drop-shadow(0 3px 6px rgba(0,0,0,.28));}" +
  "#" + WIN_ID + " .cd-sticker-svg{display:inline-flex;line-height:0;}" +
  "#" + WIN_ID + " .cd-sticker-svg svg{width:100%;height:100%;display:block;overflow:visible;}" +
  "#" + WIN_ID + " .cd-empty-art{margin:0 auto 14px;display:flex;justify-content:center;transform:rotate(-4deg);}" +
  "#" + WIN_ID + " .cd-empty-t{font-size:14px;font-weight:700;color:var(--fg);margin-bottom:5px;}" +
  "#" + WIN_ID + " .cd-empty-s{font-size:11.5px;color:var(--faint);line-height:1.5;max-width:270px;margin:0 auto;}" +
  "#" + WIN_ID + " .cd-empty-home{max-width:360px;margin:40px auto 0;}" +
  // карточка «всё изучено!» на главном экране (золотой акцент вместо синего)
  "#" + WIN_ID + " .cd-home-done{display:flex;align-items:center;gap:16px;width:100%;text-align:left;border:1px solid rgba(234,179,8,.34);" +
  "background:linear-gradient(135deg,rgba(234,179,8,.16),rgba(234,179,8,.04));border-radius:var(--cd-r-2xl);padding:15px 18px;margin-bottom:26px;}" +
  "#" + WIN_ID + " .cd-done-art{flex:0 0 auto;transform:rotate(-6deg);}" +
  "#" + WIN_ID + " .cd-home-done .cd-hc-lbl{color:#eab308;}" +

  // --- Анимации (все отключаются под prefers-reduced-motion правилом выше) ---
  // Появление окна и кнопки-запуска
  "@keyframes cd-win-in{from{opacity:0;transform:translateY(10px) scale(.985);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + ".cd-in{animation:cd-win-in .22s cubic-bezier(.2,.8,.2,1);}" +
  "@keyframes cd-pop{from{opacity:0;transform:translateY(10px) scale(.9);}to{opacity:1;transform:none;}}" +
  "#" + BTN_ID + "{animation:cd-pop .26s cubic-bezier(.2,.8,.2,1);}" +
  // Появление меню вида и второго документа
  "@keyframes cd-menu-in{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:none;}}" +
  "@keyframes cd-split-in{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + " .cd-split{animation:cd-split-in .2s ease-out;}" +
  // Плавные ховеры и тактильный отклик на нажатие
  "#" + WIN_ID + " .cd-rbtn,#" + WIN_ID + " .cd-hbtn,#" + WIN_ID + " .cd-tab,#" + WIN_ID + " .cd-ol,#" + WIN_ID + " .cd-continue{transition:background .13s ease,color .13s ease,border-color .13s ease,transform var(--cd-t-fast) ease;}" +
  "#" + WIN_ID + " .cd-rn{transition:background .13s ease,border-color .13s ease,transform var(--cd-t-fast) ease,box-shadow var(--cd-t-fast) ease;}" +
  "#" + WIN_ID + " .cd-rn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.18);}" +
  "#" + WIN_ID + " .cd-continue:hover{transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-hbtn:active,#" + WIN_ID + " .cd-rbtn:active,#" + WIN_ID + " .cd-continue:active{transform:scale(.93);}" +
  "#" + WIN_ID + " .cd-item{transition:background .13s ease,box-shadow .13s ease;}" +
  "#" + WIN_ID + " .cd-item:hover{box-shadow:inset 0 0 0 1px var(--bd2);}" +
  "#" + WIN_ID + " .cd-item.active{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gcolor,var(--ac)) 26%,transparent);}" +

  // Кнопка-запуск (плавающая пилюля)
  "#" + BTN_ID + "{position:fixed;z-index:2147482000;right:18px;bottom:30px;display:inline-flex;align-items:center;gap:7px;" +
  "padding:9px 15px;border-radius:var(--cd-r-pill);border:1px solid rgba(var(--cppdocs-ac-rgb,137,180,250),.45);cursor:pointer;user-select:none;" +
  "background:rgba(24,24,37,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#cdd6f4;" +
  "font-family:var(--vscode-font-family,'Segoe UI',system-ui,sans-serif);font-size:12.5px;font-weight:700;" +
  "box-shadow:var(--cd-sh-2);transition:transform var(--cd-t-fast),box-shadow var(--cd-t-fast);}" +
  "#" + BTN_ID + ":hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,.5);}" +
  "#" + BTN_ID + " .cd-btn-face{display:inline-flex;align-items:center;line-height:0;}" +
  "#" + BTN_ID + " .cd-btn-face .cd-sticker{filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));}" +
  "#" + BTN_ID + " .cd-badge.err{background:#f38ba8;color:#1e1e2e;}" +
  "#" + BTN_ID + " .cd-badge{font-size:10px;font-weight:800;padding:1px 7px;border-radius:var(--cd-r-pill);background:rgba(var(--cppdocs-ac-rgb,137,180,250),.28);color:var(--cppdocs-ac2,#b4befe);}" +

  // --- Полировка (#5): тематические скроллбары, фокус-обводки, поднятие карточек ---
  "#" + WIN_ID + " ::-webkit-scrollbar{width:10px;height:10px;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-track{background:transparent;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-thumb{background:var(--bd);border-radius:var(--cd-r-md);border:2px solid transparent;background-clip:content-box;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-thumb:hover{background:var(--faint);}" +
  "#" + WIN_ID + " *{scrollbar-width:thin;scrollbar-color:var(--bd) transparent;}" +
  "#" + WIN_ID + " button:focus-visible,#" + WIN_ID + " a:focus-visible,#" + WIN_ID + " textarea:focus-visible,#" + WIN_ID + " input:focus-visible{outline:2px solid var(--ac);outline-offset:2px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-home-chip:hover{transform:translateY(-1px);border-color:var(--ac);}" +

  // --- Новое: список задач «- [ ] …», якоря заголовков, кнопки «наверх»/«копировать», практика ---
  // Интерактивные чек-боксы в обычных списках
  "#" + WIN_ID + " .cd-article ul.cd-tasklist{list-style:none;padding-left:2px;}" +
  "#" + WIN_ID + " .cd-article li.cd-tl{display:flex;align-items:flex-start;gap:9px;margin:5px 0;}" +
  "#" + WIN_ID + " .cd-tl-box{flex:0 0 auto;margin-top:2px;width:17px;height:17px;padding:0;cursor:pointer;border:1.6px solid var(--faint);border-radius:var(--cd-r-sm);background:transparent;transition:background var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-tl-box:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-tl-box.on{border-color:var(--ts);background:var(--ts);position:relative;}" +
  "#" + WIN_ID + " .cd-tl-box.on::after{content:'\\2713';position:absolute;left:1px;top:-2px;font-size:12px;font-weight:700;color:var(--panel);}" +
  "#" + WIN_ID + " .cd-tl-txt.done{opacity:.6;text-decoration:line-through;}" +
  // Якорь «#» у заголовка — виден при наведении на заголовок
  "#" + WIN_ID + " .cd-article h2,#" + WIN_ID + " .cd-article h3{position:relative;}" +
  "#" + WIN_ID + " .cd-hlink{border:none;background:none;cursor:pointer;color:var(--faint);font:inherit;font-weight:700;opacity:0;padding:0 4px;margin-left:4px;transition:opacity var(--cd-t-fast),color var(--cd-t-fast);vertical-align:middle;}" +
  "#" + WIN_ID + " .cd-article h2:hover .cd-hlink,#" + WIN_ID + " .cd-article h3:hover .cd-hlink{opacity:.55;}" +
  "#" + WIN_ID + " .cd-hlink:hover{opacity:1 !important;color:var(--ac);}" +
  "#" + WIN_ID + " .cd-hlink.copied{opacity:1 !important;color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rbtn.copied{color:var(--ts);border-color:var(--ts);}" +
  // Плавающая кнопка «наверх»
  "#" + WIN_ID + " .cd-totop{position:absolute;right:18px;bottom:18px;z-index:8;width:34px;height:34px;border-radius:50%;cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-size:16px;line-height:1;box-shadow:0 4px 14px rgba(0,0,0,.4);}" +
  "#" + WIN_ID + " .cd-totop:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-totop[hidden]{display:none;}" +
  // Зачёркнутый текст
  "#" + WIN_ID + " .cd-article del{opacity:.7;}" +

  // --- #19 закладки-звёздочки у заголовков ---
  "#" + WIN_ID + " .cd-hmark{border:none;background:none;cursor:pointer;color:var(--faint);font:inherit;opacity:0;padding:0 3px;margin-left:6px;transition:opacity var(--cd-t-fast),color var(--cd-t-fast);vertical-align:middle;}" +
  "#" + WIN_ID + " .cd-article h2:hover .cd-hmark,#" + WIN_ID + " .cd-article h3:hover .cd-hmark{opacity:.55;}" +
  "#" + WIN_ID + " .cd-hmark:hover{opacity:1 !important;color:var(--ty);}" +
  "#" + WIN_ID + " .cd-hmark.on{opacity:1 !important;color:var(--ty);}" +
  "#" + WIN_ID + " .cd-home-mark{text-align:left;}" +

  // --- #11 поиск по тексту материала ---
  "#" + WIN_ID + " .cd-find{position:absolute;top:10px;right:16px;z-index:9;display:flex;align-items:center;gap:4px;padding:5px 6px;" +
  "background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-lg);box-shadow:var(--cd-sh-2);}" +
  "#" + WIN_ID + " .cd-find[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-find-in{border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-family:inherit;font-size:12.5px;padding:5px 8px;border-radius:var(--cd-r-md);width:190px;outline:none;}" +
  "#" + WIN_ID + " .cd-find-in:focus{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-find-n{min-width:34px;text-align:center;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-find-n.cd-find-none{color:var(--tp);}" +
  "#" + WIN_ID + " .cd-find-b{border:1px solid transparent;background:none;color:var(--muted);cursor:pointer;font-size:13px;line-height:1;padding:4px 7px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-find-b:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " mark.cd-find-hit{background:var(--ty);color:#1e1e2e;border-radius:2px;padding:0 1px;}" +
  "#" + WIN_ID + " mark.cd-find-hit.cur{background:var(--tn);outline:2px solid var(--tn);}" +

  // --- #8 кольцо прогресса вокруг маскота ---
  "#" + WIN_ID + " .cd-home-mascot.cd-has-ring{position:relative;width:104px;height:104px;flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-ring{position:absolute;inset:0;width:104px;height:104px;transform:rotate(-90deg);}" +
  "#" + WIN_ID + " .cd-ring-bg{fill:none;stroke:var(--bd);stroke-width:6;}" +
  "#" + WIN_ID + " .cd-ring-fg{fill:none;stroke:var(--ac);stroke-width:6;stroke-linecap:round;filter:drop-shadow(0 0 4px rgba(var(--ac-rgb),.55));transition:stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-ring-in{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-home-status{margin-top:6px;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;}" +

  // --- #2 поиск на главной ---
  "#" + WIN_ID + " .cd-home-search{position:relative;margin:2px 0 16px;}" +
  "#" + WIN_ID + " .cd-hs-ic{position:absolute;left:12px;top:11px;font-size:15px;opacity:.4;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-hs-in{width:100%;padding:10px 12px 10px 34px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--panel);color:var(--fg);font-family:inherit;font-size:13.5px;outline:none;}" +
  "#" + WIN_ID + " .cd-hs-in:focus{border-color:var(--ac);box-shadow:0 0 0 3px rgba(var(--ac-rgb),.16);}" +
  "#" + WIN_ID + " .cd-hs-res{margin-top:6px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--bg);overflow:hidden;box-shadow:var(--cd-sh-2);}" +
  "#" + WIN_ID + " .cd-hs-res[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-hs-item{display:block;width:100%;text-align:left;border:none;border-bottom:1px solid var(--bd2);background:none;color:var(--fg);cursor:pointer;font-family:inherit;padding:8px 12px;}" +
  "#" + WIN_ID + " .cd-hs-item:hover{background:var(--hl);}" +
  "#" + WIN_ID + " .cd-hs-item b{font-size:13px;font-weight:600;}" +
  "#" + WIN_ID + " .cd-hs-item span{display:block;font-size:11px;opacity:.6;margin-top:2px;}" +
  "#" + WIN_ID + " .cd-hs-item .cd-hs-sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--ac2);opacity:.9;margin-top:3px;}" +
  "#" + WIN_ID + " .cd-hs-item .cd-hs-snip{font-size:11.5px;line-height:1.45;color:var(--muted);opacity:1;margin-top:3px;}" +
  "#" + WIN_ID + " .cd-hs-item .cd-hs-snip mark{background:rgba(var(--ac-rgb),.28);color:var(--fg);border-radius:3px;padding:0 2px;}" +
  "#" + WIN_ID + " .cd-hs-empty{padding:10px 12px;font-size:12px;opacity:.6;}" +

  // --- #10 «Что нового» ---
  "#" + WIN_ID + " .cd-whatsnew{margin:0 0 16px;padding:14px 16px;border:1px solid rgba(var(--ac-rgb),.35);border-radius:var(--cd-r-xl);background:linear-gradient(180deg,rgba(var(--ac-rgb),.12),transparent);}" +
  "#" + WIN_ID + " .cd-wn-h{font-weight:700;font-size:13px;margin-bottom:6px;}" +
  "#" + WIN_ID + " .cd-wn-list{margin:0 0 10px;padding-left:18px;font-size:12.5px;line-height:1.7;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-wn-list b{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-wn-ok{cursor:pointer;border:none;background:var(--ac);color:#1e1e2e;font-family:inherit;font-size:12px;font-weight:700;padding:7px 16px;border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-wn-ok:hover{filter:brightness(1.08);}" +

  // --- #9 панель быстрых действий ---
  "#" + WIN_ID + " .cd-qabar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px;}" +
  "#" + WIN_ID + " .cd-qa{cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-family:inherit;font-size:12.5px;font-weight:600;padding:9px 14px;border-radius:var(--cd-r-lg);transition:border-color var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-qa:hover{border-color:var(--ac);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-qa-rev{border-color:rgba(var(--ac-rgb),.5);}" +
  // «Продолжить» — главное действие, акцентная заливка; остальные пилюли — призрачные
  "#" + WIN_ID + " .cd-qa-cont{background:var(--ac);color:#1e1e2e;border-color:transparent;box-shadow:0 4px 14px rgba(var(--ac-rgb),.28);}" +
  "#" + WIN_ID + " .cd-qa-cont:hover{border-color:transparent;filter:brightness(1.07);transform:translateY(-1px);}" +

  // --- #3 карточка повторения + «дальше по курсу» ---
  "#" + WIN_ID + " .cd-home-review,#" + WIN_ID + " .cd-home-cont{width:100%;text-align:left;}" +
  "#" + WIN_ID + " .cd-home-review{display:flex;align-items:center;gap:14px;margin:0 0 14px;padding:15px 18px;border:1px solid rgba(var(--ac-rgb),.4);border-radius:var(--cd-r-2xl);background:linear-gradient(135deg,rgba(var(--ac-rgb),.14),rgba(var(--ac-rgb),.03));cursor:pointer;color:var(--fg);transition:transform var(--cd-t-fast),box-shadow var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-review:hover{border-color:var(--ac);transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.26);}" +
  "#" + WIN_ID + " .cd-home-review:hover .cd-hc-arrow{transform:translateX(4px);opacity:1;}" +
  "#" + WIN_ID + " .cd-home-next{display:block;width:100%;text-align:left;margin:-6px 0 14px;padding:8px 12px;border:none;background:none;color:var(--muted);cursor:pointer;font-family:inherit;font-size:12px;border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-home-next:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-home-next b{color:var(--fg);}" +

  // --- #3 оверлей режима повторения ---
  "#" + WIN_ID + " .cd-review{position:absolute;inset:0;z-index:8;overflow-y:auto;background:radial-gradient(120% 68% at 50% -12%,rgba(var(--ac-rgb),.15),transparent 60%),var(--bg);}" +
  "#" + WIN_ID + " .cd-review[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-rv-inner{max-width:640px;margin:0 auto;padding:22px 26px 60px;}" +
  "#" + WIN_ID + " .cd-rv-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}" +
  "#" + WIN_ID + " .cd-rv-count{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-rv-close,#" + WIN_ID + " .cd-rv-close2{cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-family:inherit;border-radius:var(--cd-r-md);padding:5px 10px;}" +
  "#" + WIN_ID + " .cd-rv-close:hover,#" + WIN_ID + " .cd-rv-close2:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-card{border:1px solid var(--bd);border-radius:var(--cd-r-2xl);background:var(--panel);padding:26px 22px;box-shadow:0 10px 30px rgba(0,0,0,.3);}" +
  "#" + WIN_ID + " .cd-rv-q{font-size:17px;font-weight:600;line-height:1.5;}" +
  "#" + WIN_ID + " .cd-rv-a{margin-top:16px;padding-top:16px;border-top:1px solid var(--bd);font-size:15px;line-height:1.6;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-rv-ctl{margin-top:20px;display:flex;flex-wrap:wrap;gap:8px;}" +
  "#" + WIN_ID + " .cd-rv-show{cursor:pointer;border:none;background:var(--ac);color:#1e1e2e;font-family:inherit;font-size:13px;font-weight:700;padding:10px 20px;border-radius:var(--cd-r-lg);}" +
  "#" + WIN_ID + " .cd-rv-rate{display:flex;gap:8px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-rv-grade{cursor:pointer;border:1px solid var(--bd);background:var(--bg);color:var(--fg);font-family:inherit;font-size:12.5px;padding:10px 16px;border-radius:var(--cd-r-lg);}" +
  "#" + WIN_ID + " .cd-rv-grade[data-g='0']:hover{border-color:var(--tp);color:var(--tp);}" +
  "#" + WIN_ID + " .cd-rv-grade[data-g='1']:hover{border-color:var(--tn);color:var(--tn);}" +
  "#" + WIN_ID + " .cd-rv-grade[data-g='2']:hover{border-color:var(--ts);color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rv-done{text-align:center;padding:40px 20px;}" +
  // режим повторения: список материалов прячем, карточка крупнее, полоска прогресса сессии
  "#" + WIN_ID + ".reviewing .cd-nav{display:none;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-inner{max-width:760px;padding-top:34px;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-card{min-height:260px;padding:34px 34px 28px;display:flex;flex-direction:column;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-q{font-size:20px;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-a{font-size:16px;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-ctl{margin-top:auto;padding-top:22px;}" +
  "#" + WIN_ID + " .cd-rv-top{gap:12px;}" +
  "#" + WIN_ID + " .cd-rv-prog{flex:1 1 auto;height:6px;border-radius:3px;background:var(--bd2);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-rv-prog i{display:block;height:100%;background:var(--ac);border-radius:3px;transition:width var(--cd-t-slow);}" +
  "#" + WIN_ID + " .cd-rv-from{font-size:11.5px;color:var(--faint);margin:-8px 0 12px;}" +
  "#" + WIN_ID + " .cd-rv-grade{display:inline-flex;flex-direction:column;align-items:center;gap:1px;line-height:1.25;}" +
  "#" + WIN_ID + " .cd-rv-grade small{font-size:10.5px;color:var(--faint);font-weight:500;}" +
  "#" + WIN_ID + " .cd-rv-open{margin-left:auto;cursor:pointer;border:0;background:none;color:var(--muted);font:inherit;font-size:12px;text-decoration:underline;text-underline-offset:3px;}" +
  "#" + WIN_ID + " .cd-rv-open:hover{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-hint{margin-top:12px;font-size:11.5px;color:var(--faint);text-align:center;}" +
  // главная: план на сегодня, дорожка курса, «повторить все», один поиск
  "#" + WIN_ID + " .cd-plan{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:-4px 0 14px;font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-plan-l{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);margin-right:4px;}" +
  "#" + WIN_ID + " .cd-plan-step{border:1px solid var(--bd);background:var(--panel);color:var(--fg);border-radius:var(--cd-r-pill);padding:4px 11px;font:inherit;font-size:12.5px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-plan-step:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-plan-step i{font-style:normal;color:var(--faint);margin-left:3px;}" +
  "#" + WIN_ID + " .cd-plan-arr{color:var(--faint);}" +
  "#" + WIN_ID + " .cd-track{margin:0 0 16px;padding:12px 14px 10px;border:1px solid var(--bd);border-radius:var(--cd-r-2xl);background:var(--panel);}" +
  "#" + WIN_ID + " .cd-track-h{display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-track-h b{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-track ol{list-style:none;margin:0;padding:0;display:flex;}" +
  "#" + WIN_ID + " .cd-track li{flex:1 1 0;min-width:0;position:relative;}" +
  "#" + WIN_ID + " .cd-track li+li::before{content:'';position:absolute;top:13px;right:calc(50% + 15px);left:calc(-50% + 15px);height:2px;background:var(--bd);}" +
  "#" + WIN_ID + " .cd-track li.done+li::before{background:var(--ts);}" +
  "#" + WIN_ID + " .cd-track button{display:flex;flex-direction:column;align-items:center;gap:5px;width:100%;border:0;background:none;color:var(--muted);font:inherit;cursor:pointer;padding:0 2px;}" +
  "#" + WIN_ID + " .cd-tr-dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid var(--bd);background:var(--bg);font-size:11.5px;font-weight:800;color:var(--muted);transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-track button:hover .cd-tr-dot{transform:scale(1.1);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-track li.done .cd-tr-dot{background:var(--ts);border-color:var(--ts);color:#1e1e2e;}" +
  "#" + WIN_ID + " .cd-track li.here .cd-tr-dot{border-color:var(--ac);color:var(--ac);box-shadow:0 0 0 4px rgba(var(--ac-rgb),.18);}" +
  "#" + WIN_ID + " .cd-tr-n{font-size:10.5px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-track li.here .cd-tr-n{color:var(--fg);font-weight:700;}" +
  "#" + WIN_ID + " .cd-track li.exam .cd-tr-dot{position:relative;box-shadow:0 0 0 3px color-mix(in srgb,#f9e2af 70%,transparent);}" +
  "#" + WIN_ID + " .cd-track li.exam .cd-tr-dot::after{content:'★';position:absolute;top:-7px;right:-8px;font-size:11px;color:#f9e2af;}" +
  "#" + WIN_ID + " .cd-track-exam{display:block;margin:10px auto 0;border:0;background:none;color:var(--muted);font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;}" +
  "#" + WIN_ID + " .cd-track-exam:hover{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-home-warm[role=button]{cursor:pointer;}" +
  "#" + WIN_ID + " .cd-home-warm[role=button]:hover{border-color:#f9e2af;transform:translateY(-2px);}" +
  "#" + WIN_ID + " .cd-hw-all{flex:0 0 auto;font-size:12px;color:var(--muted);text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:4px 6px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-hw-all:hover{color:var(--ac);}" +
  "#" + WIN_ID + ".home .cd-search{display:none;}" +
  "#" + WIN_ID + " .cd-rv-done-t{font-size:18px;font-weight:700;margin-top:12px;}" +
  "#" + WIN_ID + " .cd-rv-done-s{font-size:13px;color:var(--muted);margin:8px 0 20px;}" +

  // =====================================================================
  //  ДИЗАЙН-ПОЛИРОВКА (аккуратная, 2026-09-20). Идёт в конце строки CSS,
  //  поэтому при равной специфичности перебивает более ранние правила.
  // =====================================================================

  // --- #14 Система теней: 3 уровня (var --sh1/2/3). Светлая тема — мягче. ---
  "#" + WIN_ID + "{--sh1:0 1px 2px rgba(0,0,0,.18),0 2px 6px rgba(0,0,0,.20);--sh2:0 6px 18px rgba(0,0,0,.30);--sh3:0 18px 50px rgba(0,0,0,.50);}" +
  "#" + WIN_ID + ".light{--sh1:0 1px 2px rgba(30,30,46,.06),0 2px 6px rgba(30,30,46,.08);--sh2:0 6px 18px rgba(30,30,46,.13);--sh3:0 18px 46px rgba(30,30,46,.20);}" +
  "#" + WIN_ID + "{box-shadow:var(--sh3);}" +
  "#" + WIN_ID + " .cd-hs-res,#" + WIN_ID + " .cd-find{box-shadow:var(--sh2);}" +
  "#" + WIN_ID + " .cd-taskcard{box-shadow:var(--sh1);}" +
  "#" + WIN_ID + " .cd-totop{box-shadow:var(--sh2);}" +
  "#" + WIN_ID + " .cd-home-card:hover,#" + WIN_ID + " .cd-home-cont:hover,#" + WIN_ID + " .cd-home-review:hover,#" + WIN_ID + " .cd-dtile:hover{box-shadow:var(--sh2);}" +

  // --- #1 Чтение: чуть крупнее проза + больше воздуха между абзацами ---
  "#" + WIN_ID + " .cd-article{font-size:13.5px;}" +
  "#" + WIN_ID + " .cd-article p{margin:11px 0;}" +
  "#" + WIN_ID + " .cd-article li{margin:5px 0;}" +
  "#" + WIN_ID + " .cd-article code{font-size:12.5px;padding:1.5px 6px;}" +

  // --- #16 Светлая тема (Latte): усилить контраст вторичного текста и границ ---
  "#" + WIN_ID + ".light{--faint:#6c6f85;--bd:rgba(30,30,46,.18);--bd2:rgba(30,30,46,.10);}" +

  // --- #5 Главная: плотнее вертикальный ритм, меньше пустот сверху ---
  "#" + WIN_ID + " .cd-home-inner{padding-top:24px;}" +
  "#" + WIN_ID + " .cd-home-hero{margin-bottom:14px;padding:16px 22px;}" +
  "#" + WIN_ID + " .cd-home-search{margin:0 0 13px;}" +
  "#" + WIN_ID + " .cd-whatsnew{margin:0 0 13px;}" +
  "#" + WIN_ID + " .cd-qabar{margin:0 0 13px;}" +
  "#" + WIN_ID + " .cd-home-review{margin:0 0 12px;}" +

  // --- #6 Плитки статистики: тёплая подсветка под тип + рамка в цвет ---
  "#" + WIN_ID + " .cd-dt-read{background:color-mix(in srgb,#89b4fa 8%,var(--panel));border-color:color-mix(in srgb,#89b4fa 24%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dt-solve{background:color-mix(in srgb,#a6e3a1 8%,var(--panel));border-color:color-mix(in srgb,#a6e3a1 24%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dt-streak{background:color-mix(in srgb,#fab387 9%,var(--panel));border-color:color-mix(in srgb,#fab387 26%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dt-streak .cd-dt-v{color:#fab387;}" +
  "#" + WIN_ID + ".light .cd-dt-streak .cd-dt-v{color:#e8590c;}" +

  // --- #7 Живой маскот: мягкое «дыхание» (глушится общим reduced-motion правилом) ---
  "@keyframes cd-bob{0%,100%{transform:rotate(-5deg) translateY(0);}50%{transform:rotate(-5deg) translateY(-4px);}}" +
  "#" + WIN_ID + " .cd-home-mascot .cd-sticker{animation:cd-bob 3.6s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-home-mascot:hover .cd-sticker{animation:none;transform:rotate(0) scale(1.05);}" +

  // --- #13 Единый язык кнопок: общий фокус-ринг + тактильное нажатие для шапки и читалки ---
  "#" + WIN_ID + " .cd-hbtn,#" + WIN_ID + " .cd-rbtn{transition:background var(--cd-t-fast),border-color var(--cd-t-fast),color var(--cd-t-fast),box-shadow var(--cd-t-fast),transform .08s;}" +
  "#" + WIN_ID + " .cd-hbtn:active,#" + WIN_ID + " .cd-rbtn:active{transform:translateY(1px) scale(.97);}" +
  "#" + WIN_ID + " .cd-hbtn:focus-visible,#" + WIN_ID + " .cd-rbtn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bg),0 0 0 4px rgba(var(--ac-rgb),.55);}" +

  // --- #10 Микро-праздник: искры + пульс кнопки при «изучено/решено» ---
  "@keyframes cd-spark-fly{0%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(0);}" +
  "100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.35) rotate(var(--dr));}}" +
  ".cd-spark{position:fixed;z-index:2147483600;width:7px;height:7px;border-radius:2px;pointer-events:none;" +
  "transform:translate(-50%,-50%);animation:cd-spark-fly .68s cubic-bezier(.2,.7,.3,1) forwards;}" +
  "@keyframes cd-pulse{0%{transform:scale(1);}45%{transform:scale(1.16);}100%{transform:scale(1);}}" +
  "#" + WIN_ID + " .cd-pulse{animation:cd-pulse .42s ease;}" +

  // --- #17 Скелет-загрузка (когда источник данных есть, но материалы ещё не пришли) ---
  "@keyframes cd-shine{0%{background-position:-320px 0;}100%{background-position:320px 0;}}" +
  "#" + WIN_ID + " .cd-skel-b{background:linear-gradient(90deg,var(--bd2) 25%,var(--hl) 50%,var(--bd2) 75%);background-size:320px 100%;animation:cd-shine 1.2s linear infinite;border-radius:var(--cd-r-lg);}" +
  "#" + WIN_ID + " .cd-skel-hero{height:92px;margin-bottom:16px;border-radius:var(--cd-r-2xl);}" +
  "#" + WIN_ID + " .cd-skel-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;}" +
  "#" + WIN_ID + " .cd-skel-tile{height:74px;border-radius:var(--cd-r-xl);}" +
  "#" + WIN_ID + " .cd-skel-line{height:14px;margin:10px 0;}" +
  "#" + WIN_ID + " .cd-skel-line.w40{width:40%;}#" + WIN_ID + " .cd-skel-line.w60{width:60%;}#" + WIN_ID + " .cd-skel-line.w80{width:80%;}" +
  "#" + WIN_ID + " .cd-skel-note{margin-top:16px;text-align:center;font-size:12px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-skel-nav{padding:6px 8px;}#" + WIN_ID + " .cd-skel-nav .cd-skel-b{height:34px;margin:8px 0;border-radius:var(--cd-r-md);}" +

  // --- #20 Бренд-росчерк: рисованная подчёркивающая линия у заголовков секций ---
  "#" + WIN_ID + " .cd-home-sec{border-bottom-color:transparent;}" +
  "#" + WIN_ID + " .cd-home-sec .cd-sec-lbl{position:relative;}" +
  "#" + WIN_ID + " .cd-home-sec .cd-sec-lbl::after{content:'';position:absolute;left:0;bottom:-7px;width:1.7em;height:3px;border-radius:3px;" +
  "background:linear-gradient(90deg,var(--sc,var(--ac)),color-mix(in srgb,var(--sc,var(--ac)) 40%,transparent));transform:rotate(-.7deg);}" +
  "#" + WIN_ID + " .cd-home-sec .cd-sec-dot{box-shadow:0 0 0 4px color-mix(in srgb,var(--sc,var(--ac)) 16%,transparent);}" +

  // =====================================================================
  //  ДИЗАЙН-ПОЛИРОВКА, часть 2 (2026-09-20): #3, #4, #8, #9, #12.
  // =====================================================================

  // --- #3 Ссылки в статье: заметнее (лёгкое подчёркивание в покое) + чистый ховер ---
  "#" + WIN_ID + " .cd-article a{border-bottom:1px solid color-mix(in srgb,var(--ac) 22%,transparent);transition:color var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article a:hover{border-bottom-color:var(--ac);color:var(--ac2);}" +

  // --- #4 Таблицы: рамка со скруглением, зебра, чёткий ховер строки ---
  "#" + WIN_ID + " .cd-article table{border:1px solid var(--bd);border-radius:var(--cd-r-lg);overflow:hidden;box-shadow:var(--sh1);}" +
  "#" + WIN_ID + " .cd-article tbody tr:nth-child(even){background:color-mix(in srgb,var(--fg) 3.5%,transparent);}" +
  "#" + WIN_ID + " .cd-article tbody tr:hover{background:color-mix(in srgb,var(--ac) 10%,transparent);}" +
  "#" + WIN_ID + " .cd-article th{border-bottom:1px solid var(--bd);}" +

  // --- #8 Карточка «Продолжить/Следующий шаг» — главный акцент экрана ---
  "#" + WIN_ID + " .cd-home-cont{padding:18px 22px;border-color:rgba(var(--ac-rgb),.48);" +
  "background:linear-gradient(135deg,rgba(var(--ac-rgb),.24),rgba(var(--ac-rgb),.06));box-shadow:var(--sh1);}" +
  "#" + WIN_ID + " .cd-home-cont .cd-hc-title{font-size:19px;}" +
  "#" + WIN_ID + " .cd-home-cont .cd-hc-arrow{width:36px;height:36px;font-size:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(var(--ac-rgb),.18);opacity:1;}" +
  "#" + WIN_ID + " .cd-home-cont:hover .cd-hc-arrow{background:var(--ac);color:#11111b;transform:translateX(3px);}" +

  // --- #9 Единый ритм секций: счётчик красится в цвет секции (как точка и росчерк) ---
  "#" + WIN_ID + " .cd-home-sec .cd-sec-count{opacity:1;font-weight:700;background:color-mix(in srgb,var(--sc,var(--ac)) 16%,transparent);color:color-mix(in srgb,var(--sc,var(--ac)) 70%,var(--fg));}" +

  // --- #12 Активный пункт рейки «На странице»: мягкое свечение + акцентная планка ---
  "#" + WIN_ID + " .cd-ol{transition:background var(--cd-t-fast),color var(--cd-t-fast),border-color var(--cd-t-fast),box-shadow var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-ol.active{border-left-width:3px;background:color-mix(in srgb,var(--ac) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac) 16%,transparent);}" +

  // --- Сворачивание разделов (## ) прямо в читалке ---
  "#" + WIN_ID + " .cd-article h2.cd-foldable{cursor:pointer;}" +
  "#" + WIN_ID + " .cd-fold-caret{display:inline-block;font-size:.58em;color:var(--faint);margin-right:.5em;transform:translateY(-2px);transition:transform var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article h2.cd-foldable:hover .cd-fold-caret{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article h2.cd-sec-folded .cd-fold-caret{transform:rotate(-90deg);}" +
  "#" + WIN_ID + " .cd-article h2.cd-sec-folded{border-bottom-style:dashed;}" +
  "#" + WIN_ID + " .cd-fold-hidden{display:none!important;}" +
  // ПОЛИРОВКА 3 (2026-09-24, аудит 3.8): чёткая шкала заголовков и экономнее акцент.
  // Шкала 21 → 16.5 → 13.5 (h4 — капсом, чтобы не сливаться с прозой 13.5 px).
  "#" + WIN_ID + " .cd-article h2{font-size:21px;font-weight:750;line-height:1.3;letter-spacing:-.01em;}" +
  "#" + WIN_ID + " .cd-article h3{font-size:16.5px;font-weight:700;line-height:1.35;}" +
  "#" + WIN_ID + " .cd-article h4{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:18px 0 6px;}" +
  // Рамки-заметки: нейтральный фон панели вместо сиреневой заливки — акцент остаётся только полоской
  // слева, поэтому по-настоящему важное (кнопки, активные пункты) снова выделяется.
  "#" + WIN_ID + " .cd-article blockquote{background:var(--panel);border-left-color:rgba(var(--ac-rgb),.7);}" +
  "#" + WIN_ID + " .cd-article blockquote.cd-lead{background:none;}" +
  // ---- Шапка и панель читалки: капсулы кнопок, кромка, цвет группы (2026-09-25) ----
  "#" + WIN_ID + " .cd-head{position:relative;}" +
  "#" + WIN_ID + " .cd-head::before{content:'';position:absolute;left:14px;right:14px;top:0;height:2px;border-radius:0 0 3px 3px;background:linear-gradient(90deg,transparent,var(--ac) 25%,var(--ac2) 75%,transparent);opacity:.75;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-title b{background:linear-gradient(90deg,var(--ac2),var(--ac));-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:.3px;}" +
  "#" + WIN_ID + " .cd-logo{box-shadow:0 0 0 1px color-mix(in srgb,var(--ac) 35%,transparent),0 2px 10px rgba(var(--ac-rgb),.28);}" +
  "#" + WIN_ID + " .cd-hgrp{flex:0 0 auto;display:flex;align-items:center;gap:1px;padding:2px;border-radius:var(--cd-r-lg);background:color-mix(in srgb,var(--fg) 4%,transparent);border:1px solid color-mix(in srgb,var(--fg) 7%,transparent);}" +
  "#" + WIN_ID + " .cd-hgrp .cd-hbtn{width:27px;height:24px;display:grid;place-items:center;}" +
  "#" + WIN_ID + " .cd-hsep{display:block;width:1px;height:14px;margin:0 3px;background:color-mix(in srgb,var(--fg) 12%,transparent);}" +
  "#" + WIN_ID + " .cd-hbtn.cd-close:hover{background:color-mix(in srgb,#f38ba8 22%,transparent);color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-uiic{width:16px;height:16px;display:block;object-fit:contain;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-rbtn .cd-uiic{display:inline-block;vertical-align:-3px;width:15px;height:15px;}" +
  "#" + WIN_ID + " .cd-rbtn .cd-ic{display:inline-block;min-width:1em;text-align:center;}" +
  "#" + WIN_ID + " .cd-rbtn{display:inline-flex;align-items:center;gap:5px;border-radius:var(--cd-r-md);padding:5px 11px;background:color-mix(in srgb,var(--fg) 3%,var(--panel));}" +
  "#" + WIN_ID + " .cd-rbtn:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.18);}" +
  "#" + WIN_ID + " .cd-rgrp{display:flex;align-items:center;border:1px solid var(--bd);border-radius:var(--cd-r-lg);background:color-mix(in srgb,var(--fg) 3%,var(--panel));overflow:visible;}" +
  "#" + WIN_ID + " .cd-rgrp .cd-rbtn,.cd-rgrp .cd-tocwrap>.cd-rbtn{border:none;background:transparent;border-radius:0;padding:5px 10px;box-shadow:none;}" +
  "#" + WIN_ID + " .cd-rgrp .cd-rbtn:hover{transform:none;box-shadow:none;background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-rgrp>*+*{border-left:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-rgrp>:first-child .cd-rbtn,.cd-rgrp>.cd-rbtn:first-child{border-radius:9px 0 0 9px;}" +
  "#" + WIN_ID + " .cd-rgrp>.cd-rbtn:last-child{border-radius:0 9px 9px 0;}" +
  "#" + WIN_ID + " .cd-readbtn{border-color:color-mix(in srgb,var(--ac) 45%,var(--bd));color:var(--fg);}" +
  "#" + WIN_ID + " .cd-readbtn.on{background:color-mix(in srgb,var(--ts) 14%,var(--panel));border-color:var(--ts);color:var(--ts);font-weight:700;}" +
  "#" + WIN_ID + ".home .cd-rgrp{display:none;}" +
  "#" + WIN_ID + ".no-anim .cd-rbtn:hover{transform:none;}" +
  "#" + WIN_ID + " .cd-head>*{position:relative;z-index:1;}" +
  "#" + WIN_ID + " .cd-peek{align-self:flex-end;height:34px;width:auto;margin:0 2px -8px auto;flex:0 0 auto;pointer-events:none;filter:drop-shadow(0 -1px 2px rgba(0,0,0,.25));transform-origin:50% 100%;animation:cdPeek 5s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-learned{position:absolute;z-index:40;width:120px;height:auto;pointer-events:none;animation:cdLearned 2.2s cubic-bezier(.2,1.4,.4,1) forwards;filter:drop-shadow(0 6px 14px rgba(0,0,0,.35));}" +
  "@keyframes cdPeek{0%,70%,100%{transform:translateY(0)}78%{transform:translateY(3px)}86%{transform:translateY(-2px) rotate(-3deg)}}" +
  "@keyframes cdLearned{0%{opacity:0;transform:scale(.3) translateY(-10px)}18%{opacity:1;transform:scale(1.08)}30%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}" +
  "#" + WIN_ID + ".no-anim .cd-peek{animation:none;}" +
  "#" + WIN_ID + ".tightbar .cd-peek,#" + WIN_ID + ".narrow .cd-peek,#" + WIN_ID + ".home .cd-peek,#" + WIN_ID + ".rolled .cd-peek{display:none;}" +
  "#" + WIN_ID + " .cd-gbadge{width:18px;height:18px;flex:0 0 auto;display:block;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));}" +
  "#" + WIN_ID + " .cd-ghead:hover .cd-gbadge{transform:rotate(-8deg) scale(1.08);transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-kicker .cd-kk-g{display:inline-flex;align-items:center;gap:5px;}" +
  "#" + WIN_ID + " .cd-kk-ic{width:15px;height:15px;display:block;margin-left:-3px;}" +
  "#" + WIN_ID + ".no-anim .cd-ghead:hover .cd-gbadge{transform:none;}" +
  "#" + WIN_ID + " .cd-title b{font-size:14px;font-weight:800;letter-spacing:.2px;}" +
  "#" + WIN_ID + ".rolled .cd-title{flex:1 1 auto;}" +
  "#" + WIN_ID + ".rolled .cd-rollinfo{position:relative;flex:0 1 auto;max-width:380px;min-width:0;display:flex!important;align-items:center;gap:8px;padding:5px 12px 7px;border-radius:var(--cd-r-lg);overflow:hidden;background:color-mix(in srgb,var(--fg) 4%,var(--panel));border:1px solid var(--bd);text-align:left;font:inherit;font-size:12px;color:var(--fg);cursor:pointer;}" +
  "#" + WIN_ID + ".rolled .cd-rollinfo:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-ri-ic{width:18px;height:18px;flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-ri-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--ac);}" +
  "#" + WIN_ID + " .cd-ri-t{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-ri-s{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-ri-s::before{content:\"›\";margin-right:6px;color:var(--faint,var(--muted));}" +
  "#" + WIN_ID + " .cd-ri-p{margin-left:4px;flex:0 0 auto;font-size:10.5px;font-weight:700;color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-ri-bar{position:absolute;left:0;bottom:0;height:2px;background:linear-gradient(90deg,var(--ac),var(--ac2));border-radius:0 2px 2px 0;}" +
  "#" + WIN_ID + ".rolled .cd-rz-e,#" + WIN_ID + ".rolled .cd-rz-w{width:8px;}" +

  // ===== Шапка одной полосой (2026-09-25): крошки, кольцо прогресса, «Дальше», карточки, редактор =====
  // z-index — чтобы меню из шапки (⚙, «редактор») ложились поверх главной и статьи.
  "#" + WIN_ID + " .cd-head{z-index:12;gap:8px;padding:8px 10px;background:linear-gradient(180deg,color-mix(in srgb,var(--hcol,var(--ac)) 11%,transparent),transparent);}" +
  // Кромка сверху — цветом раздела, который сейчас читаешь (на главной — акцент).
  "#" + WIN_ID + " .cd-head::before{background:linear-gradient(90deg,transparent,var(--hcol,var(--ac)) 25%,color-mix(in srgb,var(--hcol,var(--ac)) 55%,var(--ac2)) 75%,transparent);}" +
  "#" + WIN_ID + " .cd-title{gap:8px;font-weight:600;}" +
  // Логотип в кольце общего прогресса «изучено».
  "#" + WIN_ID + " .cd-logo{width:30px;height:30px;padding:3px;border-radius:50%;overflow:visible;box-shadow:none;background:conic-gradient(var(--ac) calc(var(--lp,0) * 1%),color-mix(in srgb,var(--fg) 13%,transparent) 0);transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-logo:hover{transform:scale(1.06);}" +
  "#" + WIN_ID + " .cd-logo-in{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--panel);font-size:13px;}" +
  "#" + WIN_ID + " .cd-logo-in img{width:100%;height:100%;display:block;}" +
  // Крошки: [значок Раздел] › Тема › подраздел
  "#" + WIN_ID + " .cd-crumbs{display:flex;align-items:center;min-width:0;flex:1 1 auto;overflow:hidden;white-space:nowrap;font-size:13px;}" +
  "#" + WIN_ID + " .cd-cg{flex:0 3 auto;min-width:30px;display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px 0 5px;border:1px solid transparent;border-radius:var(--cd-r-md);overflow:hidden;cursor:pointer;" +
  "background:color-mix(in srgb,var(--gcolor,var(--ac)) 13%,transparent);color:var(--gcolor,var(--ac));font:inherit;font-size:12px;font-weight:700;}" +
  "#" + WIN_ID + " .cd-cg:hover{border-color:color-mix(in srgb,var(--gcolor,var(--ac)) 55%,transparent);}" +
  "#" + WIN_ID + " .cd-cg-ic{width:18px;height:18px;flex:0 0 auto;display:block;}" +
  "#" + WIN_ID + " .cd-cg-dot{width:8px;height:8px;margin-left:4px;border-radius:50%;flex:0 0 auto;background:currentColor;}" +
  "#" + WIN_ID + " .cd-cg-t{min-width:0;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-cg:not([hidden])+.cd-rname::before{content:'›';margin:0 7px;color:var(--faint);font-weight:600;}" +
  "#" + WIN_ID + " .cd-crumbs .cd-rname{font-weight:700;color:var(--fg);}" +
  // Середина: пилюли «🎴 N», «редактор» и главная кнопка «Дальше»
  "#" + WIN_ID + " .cd-hx{flex:0 0 auto;display:flex;align-items:center;gap:6px;}" +
  "#" + WIN_ID + " .cd-hpill{position:relative;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--bd);border-radius:var(--cd-r-pill);cursor:pointer;white-space:nowrap;" +
  "background:color-mix(in srgb,var(--fg) 3%,var(--panel));color:var(--muted);font:inherit;font-size:12px;font-weight:600;transition:border-color var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-hpill:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-hrev{padding:0 10px 0 9px;}" +
  "#" + WIN_ID + " .cd-hrev-ic{font-size:13px;line-height:1;}" +
  "#" + WIN_ID + " .cd-hrev-n{color:var(--fg);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-hrev.due{border-color:color-mix(in srgb,var(--ty) 50%,var(--bd));}" +
  "#" + WIN_ID + " .cd-hrev-dot{position:absolute;top:2px;right:3px;width:7px;height:7px;border-radius:50%;background:var(--ty);box-shadow:0 0 0 2px var(--panel);}" +
  "#" + WIN_ID + " .cd-hed{max-width:200px;}" +
  "#" + WIN_ID + " .cd-hed-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--faint);}" +
  "#" + WIN_ID + " .cd-hed.ok .cd-hed-dot{background:var(--ts);box-shadow:0 0 0 3px color-mix(in srgb,var(--ts) 22%,transparent);}" +
  "#" + WIN_ID + " .cd-hed.err .cd-hed-dot{background:var(--tp);box-shadow:0 0 0 3px color-mix(in srgb,var(--tp) 22%,transparent);}" +
  "#" + WIN_ID + " .cd-hed.err{border-color:color-mix(in srgb,var(--tp) 45%,var(--bd));}" +
  "#" + WIN_ID + " .cd-hed-n{min-width:0;overflow:hidden;text-overflow:ellipsis;font-family:'Cascadia Code',Consolas,monospace;font-size:11.5px;}" +
  "#" + WIN_ID + " .cd-hed.none .cd-hed-n,#" + WIN_ID + " .cd-hed.off .cd-hed-n{font-family:inherit;font-size:12px;}" +
  "#" + WIN_ID + " .cd-hed-e{color:var(--tp);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-hed-e:empty{display:none;}" +
  "#" + WIN_ID + " .cd-hnext{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px 0 14px;border:none;border-radius:var(--cd-r-pill);cursor:pointer;white-space:nowrap;" +
  "background:linear-gradient(135deg,var(--ac),color-mix(in srgb,var(--ac) 55%,var(--ac2)));color:var(--panel);font:inherit;font-size:12px;font-weight:800;" +
  "box-shadow:0 2px 10px rgba(var(--ac-rgb),.3);transition:transform var(--cd-t-fast),filter var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-hnext:hover{filter:brightness(1.08);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-hnext:focus-visible,#" + WIN_ID + " .cd-hpill:focus-visible,#" + WIN_ID + " .cd-cg:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bg),0 0 0 4px rgba(var(--ac-rgb),.55);}" +
  "#" + WIN_ID + " .cd-hnext-a{font-size:16px;line-height:1;margin-top:-2px;}" +
  "#" + WIN_ID + ".no-anim .cd-hnext:hover{transform:none;}" +
  // Инструменты чтения (бывшая вторая полоса) — справа в шапке
  "#" + WIN_ID + " .cd-hrt{flex:0 0 auto;display:flex;align-items:center;gap:6px;}" +
  "#" + WIN_ID + " .cd-hrt>.cd-rbtn{height:28px;padding:0 10px;}" +
  "#" + WIN_ID + " .cd-hrt .cd-rgrp .cd-rbtn{height:26px;}" +
  "#" + WIN_ID + " .cd-head .cd-peek{height:30px;margin:0 0 -9px;}" +
  // Всплывашка «Связь с редактором»
  "#" + WIN_ID + " .cd-edpop{position:absolute;top:calc(100% + 6px);z-index:30;width:320px;max-width:calc(100% - 16px);padding:10px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);" +
  "background:var(--bg);box-shadow:var(--sh2);cursor:auto;user-select:text;white-space:normal;font-size:12.5px;font-weight:400;color:var(--fg);animation:cd-menu-in .14s ease-out;}" +
  "#" + WIN_ID + " .cd-ep-h{margin:0 0 4px;font-size:10.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-ep-row{display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-top:1px solid var(--bd);line-height:1.45;}" +
  "#" + WIN_ID + " .cd-ep-h+.cd-ep-row{border-top:none;}" +
  "#" + WIN_ID + " .cd-ep-ic{flex:0 0 18px;text-align:center;}" +
  "#" + WIN_ID + " .cd-ep-row.good .cd-ep-ic{color:var(--ts);}" +
  "#" + WIN_ID + " .cd-ep-row.bad .cd-ep-ic{color:var(--tp);}" +
  "#" + WIN_ID + " .cd-ep-row.muted{color:var(--muted);}" +
  "#" + WIN_ID + " .cd-ep-sub{color:var(--faint);font-size:11px;}" +
  "#" + WIN_ID + " .cd-ep-row code{font-size:11.5px;padding:1px 5px;border-radius:var(--cd-r-sm);background:var(--hl);}" +
  "#" + WIN_ID + " .cd-ep-go{display:block;margin-top:7px;padding:5px 12px;border:none;border-radius:var(--cd-r-pill);background:var(--tp);color:var(--panel);font:inherit;font-size:12px;font-weight:700;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-ep-go:hover{filter:brightness(1.08);}" +
  // Свёрнутая полоска — только «тема › раздел» (rollinfo) и кнопки окна
  "#" + WIN_ID + ".rolled .cd-crumbs,#" + WIN_ID + ".rolled .cd-hx,#" + WIN_ID + ".rolled .cd-hrt,#" + WIN_ID + ".rolled .cd-edpop{display:none!important;}" +
  // Узкое окно: по шагам прячем подписи (кнопки остаются, с подсказками при наведении)
  // (1) название раздела → только значок; (2) подписи кнопок чтения и имя файла; (3) подпись «Дальше» и «Главная».
  "#" + WIN_ID + ".hc1 .cd-cg-t,#" + WIN_ID + ".hc1 .cd-head .cd-peek{display:none;}" +
  "#" + WIN_ID + ".hc1 .cd-cg{padding:0 5px;}" +
  "#" + WIN_ID + ".hc2 .cd-hrt .cd-bt,#" + WIN_ID + ".hc2 .cd-hed-n{display:none;}" +
  "#" + WIN_ID + ".hc3 .cd-hnext-t,#" + WIN_ID + ".hc3 .cd-hb-home{display:none;}" +
  "#" + WIN_ID + ".hc3 .cd-hnext{padding:0 12px;}" +
  "#" + WIN_ID + ".hc4 .cd-hx .cd-hpill{display:none;}" +

  // ===== Читалка, полировка (2026-09-25) =====
  // (1) Без лигатур в коде: шрифт склеивает != в ≠, -> в стрелку — новичок перепечатает значок и получит ошибку.
  "#" + WIN_ID + " pre,#" + WIN_ID + " code,#" + WIN_ID + " textarea,#" + WIN_ID + " kbd,#" + WIN_ID + " .cd-hed-n{font-variant-ligatures:none;font-feature-settings:'liga' 0,'calt' 0;}" +
  // (2) Крупное название темы
  // обложка темы
  "#" + WIN_ID + " .cd-article .cd-cover{position:relative;overflow:hidden;margin:0 0 18px;padding:16px 20px 14px;border-radius:var(--cd-r-2xl);" +
    "background:linear-gradient(115deg,color-mix(in srgb,var(--gcolor) 26%,transparent),color-mix(in srgb,var(--gcolor) 7%,transparent) 62%,transparent)," +
    "radial-gradient(circle at 92% 20%,color-mix(in srgb,var(--gcolor) 22%,transparent),transparent 45%);" +
    "box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gcolor) 30%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-cover.has-art{background:linear-gradient(90deg,color-mix(in srgb,var(--gcolor) 20%,var(--cd-cover-bg,rgba(20,20,30,.72))) 38%,transparent 78%),var(--cover-img) center/cover no-repeat;}" +
  "#" + WIN_ID + " .cd-article .cd-cover .cd-kicker{margin:0 0 6px;}" +
  "#" + WIN_ID + " .cd-article .cd-cover h1.cd-atitle{margin:0;max-width:calc(100% - 96px);position:relative;}" +
  "#" + WIN_ID + " .cd-article .cd-cover-badge{position:absolute;right:14px;top:50%;width:84px;height:84px;object-fit:contain;transform:translateY(-50%) rotate(-7deg);opacity:.95;filter:drop-shadow(0 6px 14px rgba(0,0,0,.25));pointer-events:none;}" +
  "#" + WIN_ID + ".light .cd-article .cd-cover.has-art{--cd-cover-bg:rgba(255,255,255,.78);}" +
  "#" + WIN_ID + " .cd-article h1.cd-atitle{margin:4px 0 10px;padding:0;border:none;font-size:28px;font-weight:800;line-height:1.2;letter-spacing:-.015em;color:var(--fg);text-wrap:balance;}" +
  "#" + WIN_ID + " .cd-article .cd-kicker{margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-article h1.cd-atitle+blockquote.cd-lead{margin-top:0;font-size:13.5px;}" +
  // (6) Заголовок раздела: текст по линии абзацев, черта вплотную слева, стрелка сворачивания — левее, при наведении
  "#" + WIN_ID + " .cd-article h2::before{left:-13px;top:.3em;height:.95em;}" +
  "#" + WIN_ID + " .cd-article h2.cd-foldable .cd-fold-caret{position:absolute;left:-32px;top:.42em;margin:0;font-size:12px;opacity:0;transform:none;transition:opacity var(--cd-t-fast),transform var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article h2.cd-foldable:hover .cd-fold-caret{opacity:1;}" +
  "#" + WIN_ID + " .cd-article h2.cd-sec-folded .cd-fold-caret{opacity:.8;transform:rotate(-90deg);}" +
  "#" + WIN_ID + ".narrow .cd-article h2.cd-foldable .cd-fold-caret{position:static;opacity:.6;margin-right:.45em;}" +
  // (7) «За 30 секунд» — карточка-выжимка в цвете раздела
  "#" + WIN_ID + " .cd-article .cd-tldr{margin:16px 0 24px;padding:14px 18px 8px;border:1px solid color-mix(in srgb,var(--hcol,var(--ac)) 34%,var(--bd));border-radius:var(--cd-r-2xl);" +
  "background:linear-gradient(135deg,color-mix(in srgb,var(--hcol,var(--ac)) 10%,var(--panel)),color-mix(in srgb,var(--hcol,var(--ac)) 3%,var(--panel)));box-shadow:var(--sh1);}" +
  "#" + WIN_ID + " .cd-article .cd-tldr>h3:first-child{display:flex;align-items:center;gap:7px;margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:color-mix(in srgb,var(--hcol,var(--ac)) 80%,var(--fg));}" +
  "#" + WIN_ID + " .cd-article .cd-tldr>h3:first-child::before{content:'⚡';font-size:14px;letter-spacing:0;}" +
  "#" + WIN_ID + " .cd-article .cd-tldr ul{margin:4px 0 8px;}" +
  "#" + WIN_ID + " .cd-article .cd-tldr .codewrap{margin:10px 0 8px;}" +
  // (9) Инлайн-код не раздувает строку: высота строки 1, отступы поменьше, рамка тише
  "#" + WIN_ID + " .cd-article p code,#" + WIN_ID + " .cd-article li code,#" + WIN_ID + " .cd-article td code,#" + WIN_ID + " .cd-article blockquote code,#" + WIN_ID + " .cd-article h2 code,#" + WIN_ID + " .cd-article h3 code{" +
  "padding:.12em .38em;border-radius:var(--cd-r-xs);line-height:1;font-size:.9em;border-color:color-mix(in srgb,var(--fg) 9%,transparent);-webkit-box-decoration-break:clone;box-decoration-break:clone;}" +
  // (10) Значки инструментов в шапке (⚙ ⌕ ⧉ и т. п.) — крупнее и контрастнее
  "#" + WIN_ID + " .cd-hrt .cd-rbtn .cd-ic{font-size:15px;line-height:1;}" +
  "#" + WIN_ID + " .cd-hrt .cd-rgrp .cd-rbtn{color:color-mix(in srgb,var(--fg) 82%,transparent);padding:0 11px;}" +
  "#" + WIN_ID + " .cd-hrt .cd-rgrp .cd-rbtn:hover{color:var(--ac);}" +

  // ===== Карточки: колода (2026-09-25) =====
  "#" + WIN_ID + " .cd-article .cd-deck{margin:18px 0;padding:14px 16px 16px;border:1px solid var(--bd);border-radius:var(--cd-r-2xl);" +
  "background:linear-gradient(180deg,color-mix(in srgb,var(--hcol,var(--ac)) 7%,var(--panel)),var(--panel));}" +
  "#" + WIN_ID + " .cd-dk-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-dk-t{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-dk-ic{font-size:17px;}" +
  "#" + WIN_ID + " .cd-dk-cnt{padding:1px 8px;border-radius:var(--cd-r-pill);background:var(--hl);color:var(--ac);font-size:11px;font-weight:800;}" +
  "#" + WIN_ID + " .cd-dk-meta{display:flex;gap:6px;flex:1 1 auto;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-dk-meta span{padding:2px 9px;border-radius:var(--cd-r-pill);font-size:11px;font-weight:700;}" +
  "#" + WIN_ID + " .cd-dk-meta .due{background:color-mix(in srgb,var(--tn) 20%,transparent);color:var(--tn);}" +
  "#" + WIN_ID + " .cd-dk-meta .neu{background:var(--hl);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-deck button{font:inherit;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-dk-shuffle,#" + WIN_ID + " .cd-dk-prev,#" + WIN_ID + " .cd-dk-next,#" + WIN_ID + " .cd-dc-hintbtn,#" + WIN_ID + " .cd-dc-unflip,#" + WIN_ID + " .cd-dk-restart{" +
  "padding:6px 13px;border:1px solid var(--bd);border-radius:var(--cd-r-pill);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;transition:border-color var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-dk-shuffle:hover,#" + WIN_ID + " .cd-dk-prev:hover:not(:disabled),#" + WIN_ID + " .cd-dk-next:hover:not(:disabled),#" + WIN_ID + " .cd-dc-hintbtn:hover,#" + WIN_ID + " .cd-dc-unflip:hover,#" + WIN_ID + " .cd-dk-restart:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-deck button:disabled{opacity:.35;cursor:default;}" +
  "#" + WIN_ID + " .cd-dc-unflip{padding:3px 10px;font-size:11px;}" +
  // точки-прогресс: серые — не тронуты, обводка — пора повторить, цвет — оценка
  "#" + WIN_ID + " .cd-dk-dots{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 12px;padding:0 2px;}" +
  "#" + WIN_ID + " .cd-dk-dot{width:10px;height:10px;padding:0;border:none;border-radius:50%;background:color-mix(in srgb,var(--fg) 16%,transparent);transition:transform var(--cd-t-fast),background .2s;}" +
  "#" + WIN_ID + " .cd-dk-dot.st-due{background:transparent;box-shadow:inset 0 0 0 2px var(--tn);}" +
  "#" + WIN_ID + " .cd-dk-dot.g0{background:var(--tp);box-shadow:none;}" +
  "#" + WIN_ID + " .cd-dk-dot.g1{background:var(--ty);box-shadow:none;}" +
  "#" + WIN_ID + " .cd-dk-dot.g2{background:var(--ts);box-shadow:none;}" +
  "#" + WIN_ID + " .cd-dk-dot.cur{transform:scale(1.35);outline:2px solid var(--ac);outline-offset:2px;}" +
  "#" + WIN_ID + " .cd-dk-dot.skip{opacity:.22;}" +
  // карточка: две стороны в одной ячейке сетки (высота — по большей), переворот по Y
  "#" + WIN_ID + " .cd-dcard{display:none;perspective:1400px;}" +
  "#" + WIN_ID + " .cd-dcard.cur{display:block;animation:cd-dk-in .28s ease-out;}" +
  "@keyframes cd-dk-in{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + " .cd-dc-in{display:grid;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.3,.9,.3,1);}" +
  "#" + WIN_ID + " .cd-dcard.flipped .cd-dc-in{transform:rotateY(180deg);}" +
  "#" + WIN_ID + " .cd-dc-face{grid-area:1/1;display:flex;flex-direction:column;gap:12px;min-height:200px;padding:16px 20px 18px;border:1px solid var(--bd);border-radius:var(--cd-r-2xl);" +
  "-webkit-backface-visibility:hidden;backface-visibility:hidden;}" +
  "#" + WIN_ID + " .cd-dc-front{cursor:pointer;box-shadow:var(--sh1);" +
  "background:radial-gradient(120% 90% at 100% 0%,rgba(var(--ac-rgb),.17),transparent 60%),radial-gradient(90% 80% at 0% 100%,color-mix(in srgb,var(--hcol,var(--ac)) 12%,transparent),transparent 60%),color-mix(in srgb,var(--fg) 3%,var(--bg));}" +
  "#" + WIN_ID + " .cd-dc-front:hover{border-color:color-mix(in srgb,var(--ac) 45%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dc-back{transform:rotateY(180deg);background:linear-gradient(180deg,color-mix(in srgb,var(--ts) 10%,var(--bg)),var(--bg) 70%);border-color:color-mix(in srgb,var(--ts) 35%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dc-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}" +
  "#" + WIN_ID + " .cd-dc-num{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-dc-due{padding:2px 9px;border-radius:var(--cd-r-pill);font-size:10.5px;font-weight:700;}" +
  "#" + WIN_ID + " .cd-dc-due.due{background:var(--tn);color:var(--panel);}" +
  "#" + WIN_ID + " .cd-dc-due.neu{background:var(--hl);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-dc-due.lat{border:1px solid var(--bd);color:var(--faint);}" +
  "#" + WIN_ID + " .cd-dc-q{flex:1 1 auto;display:flex;align-items:center;justify-content:center;padding:6px 12px;text-align:center;text-wrap:balance;font-size:17.5px;font-weight:700;line-height:1.45;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-dc-hint{align-self:center;max-width:92%;padding:8px 13px;border-radius:var(--cd-r-lg);background:color-mix(in srgb,var(--ty) 13%,transparent);color:var(--fg);font-size:13px;text-align:center;}" +
  "#" + WIN_ID + " .cd-dc-ctl{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-dc-flip{padding:8px 18px;border:none;border-radius:var(--cd-r-pill);background:var(--ac);color:var(--panel);font-size:12.5px;font-weight:800;box-shadow:0 3px 12px rgba(var(--ac-rgb),.3);transition:filter var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-dc-flip:hover{filter:brightness(1.08);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-dc-qs{font-size:12.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-dc-a{flex:1 1 auto;font-size:14.5px;line-height:1.6;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-dc-rlbl{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-dc-rate{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}" +
  "#" + WIN_ID + " .cd-dk-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--panel);color:var(--fg);transition:border-color var(--cd-t-fast),background var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-dk-btn b{font-size:13px;}" +
  "#" + WIN_ID + " .cd-dk-btn small{font-size:10.5px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-dk-btn:hover{transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-dk-btn.g0:hover{border-color:var(--tp);background:color-mix(in srgb,var(--tp) 13%,var(--panel));}" +
  "#" + WIN_ID + " .cd-dk-btn.g1:hover{border-color:var(--ty);background:color-mix(in srgb,var(--ty) 13%,var(--panel));}" +
  "#" + WIN_ID + " .cd-dk-btn.g2:hover{border-color:var(--ts);background:color-mix(in srgb,var(--ts) 13%,var(--panel));}" +
  "#" + WIN_ID + " .cd-dk-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;}" +
  "#" + WIN_ID + " .cd-dk-pos{font-size:12px;color:var(--faint);font-variant-numeric:tabular-nums;}" +
  // итог колоды
  "#" + WIN_ID + " .cd-dk-sum{padding:16px 10px 6px;text-align:center;animation:cd-dk-in .28s ease-out;}" +
  "#" + WIN_ID + " .cd-dk-sum-t{margin:0 0 12px;font-size:18px;font-weight:800;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-dk-sum-row{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-dk-sum-row span{display:flex;flex-direction:column;min-width:88px;padding:10px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--bg);font-size:11.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-dk-sum-row b{font-size:22px;font-weight:800;}" +
  "#" + WIN_ID + " .cd-dk-sum-row .g2 b{color:var(--ts);}" +
  "#" + WIN_ID + " .cd-dk-sum-row .g1 b{color:var(--ty);}" +
  "#" + WIN_ID + " .cd-dk-sum-row .g0 b{color:var(--tp);}" +
  "#" + WIN_ID + " .cd-dk-sum-s{margin:0 0 12px;font-size:12px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-dk-sum-ctl{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-dk-again{padding:7px 16px;border:none;border-radius:var(--cd-r-pill);background:var(--ac);color:var(--panel);font-size:12.5px;font-weight:800;}" +
  "#" + WIN_ID + ".no-anim .cd-dc-in{transition:none;}" +
  "#" + WIN_ID + ".no-anim .cd-dcard.cur,#" + WIN_ID + ".no-anim .cd-dk-sum{animation:none;}" +
  "#" + WIN_ID + ".narrow .cd-dc-rate{grid-template-columns:1fr;}" +
  // Палитры: сетка образцов в настройках
  "#" + WIN_ID + " .cd-pal-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;width:100%;}" +
  "#" + WIN_ID + " .cd-pal{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--bd);border-radius:var(--cd-r-lg);background:var(--panel);color:var(--fg);font:inherit;font-size:12px;font-weight:600;cursor:pointer;text-align:left;}" +
  "#" + WIN_ID + " .cd-pal:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-pal.on{border-color:var(--ac);background:var(--hl);box-shadow:inset 0 0 0 1px var(--ac);}" +
  "#" + WIN_ID + " .cd-pal-sw{flex:0 0 auto;width:22px;height:22px;border-radius:var(--cd-r-md);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);}" +
  "#" + WIN_ID + " .cd-pal-note{margin:6px 0 0;font-size:11px;color:var(--faint);}" +
  // ===== Графика, заход 3 (2026-09-25) =====
  // #1 наклейки-значки на месте эмодзи
  "#" + WIN_ID + " .cd-emo{display:inline-block;width:1.3em;height:1.3em;vertical-align:-.28em;object-fit:contain;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.25));}" +
  "#" + WIN_ID + " .cd-dt-ic .cd-emo{width:20px;height:20px;vertical-align:0;}" +
  "#" + WIN_ID + " .cd-hw-ic .cd-emo{width:34px;height:34px;vertical-align:0;}" +
  "#" + WIN_ID + " .cd-dk-ic .cd-emo{width:22px;height:22px;}" +
  // #4 главная в две колонки
  "#" + WIN_ID + " .cd-home.wide2 .cd-home-inner{max-width:1280px;}" +
  "#" + WIN_ID + " .cd-home-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);gap:0 20px;align-items:start;}" +
  "#" + WIN_ID + " .cd-home-main,#" + WIN_ID + " .cd-home-side{min-width:0;}" +
  "#" + WIN_ID + " .cd-home-side .cd-qabar{display:grid;grid-template-columns:1fr 1fr;}" +
  "#" + WIN_ID + " .cd-home-side .cd-qa{text-align:left;}" +
  "#" + WIN_ID + " .cd-home-side .cd-home-warm{flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-home.wide2 .cd-home-grid{grid-template-columns:repeat(3,minmax(0,1fr));}" +
  // #5 «Продолжить» в списке слева — спокойная, не спорит с главной карточкой
  "#" + WIN_ID + " .cd-continue{background:transparent;color:var(--muted);box-shadow:inset 0 0 0 1px var(--bd);}" +
  "#" + WIN_ID + " .cd-continue:hover{background:var(--hl);color:var(--fg);box-shadow:inset 0 0 0 1px var(--ac);}" +
  // #6 «План на сегодня» — отдельная карточка-лента с шагами
  "#" + WIN_ID + " .cd-plan{display:block;margin:0 0 16px;padding:12px 16px 14px;border:1px solid var(--bd);border-radius:var(--cd-r-2xl);background:color-mix(in srgb,var(--fg) 2%,var(--panel));font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-plan-l{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-plan-c{padding:1px 8px;border-radius:var(--cd-r-pill);background:var(--hl);color:var(--ac);letter-spacing:0;text-transform:none;}" +
  "#" + WIN_ID + " .cd-plan-row{display:flex;align-items:center;gap:0;flex-wrap:wrap;row-gap:8px;}" +
  "#" + WIN_ID + " .cd-plan-step{display:inline-flex;align-items:center;gap:8px;min-width:0;padding:6px 12px 6px 6px;border:1px solid var(--bd);border-radius:var(--cd-r-pill);background:var(--bg);color:var(--fg);font:inherit;font-size:12.5px;cursor:pointer;text-align:left;transition:border-color var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-plan-step:hover{border-color:var(--ac);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-plan-n{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--hl);color:var(--ac);font-size:11px;font-weight:800;}" +
  "#" + WIN_ID + " .cd-plan-t{min-width:0;font-weight:600;}" +
  "#" + WIN_ID + " .cd-plan-sub{font-weight:400;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-plan-step i{font-style:normal;color:var(--faint);font-size:11.5px;white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-plan-step.done{border-color:color-mix(in srgb,var(--ts) 40%,var(--bd));background:color-mix(in srgb,var(--ts) 8%,var(--bg));}" +
  "#" + WIN_ID + " .cd-plan-step.done .cd-plan-n{background:var(--ts);color:var(--panel);}" +
  "#" + WIN_ID + " .cd-plan-step.done .cd-plan-t{text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--fg) 45%,transparent);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-plan-line{flex:0 0 18px;height:2px;margin:0 4px;border-radius:2px;background:var(--bd);}" +
  "#" + WIN_ID + " .cd-plan-arr{display:none;}" +
  // #8 наклон лицевой стороны карточки
  "#" + WIN_ID + " .cd-dc-front{transform:rotateX(var(--tx,0deg)) rotateY(var(--ty,0deg));transition:transform .18s ease-out,border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + ".no-anim .cd-dc-front{transform:none;}" +
  // #10 точки колоды по центру, с воздухом; полоска прогресса под ними
  "#" + WIN_ID + " .cd-dk-dots{justify-content:center;gap:10px;margin:2px 0 8px;padding:4px 0;}" +
  "#" + WIN_ID + " .cd-dk-dot{width:9px;height:9px;}" +
  "#" + WIN_ID + " .cd-dk-dot.cur{transform:scale(1.25);outline:2px solid var(--ac);outline-offset:2px;}" +
  "#" + WIN_ID + " .cd-dk-prog{height:3px;margin:0 auto 12px;max-width:260px;border-radius:3px;background:var(--bd);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-dk-prog i{display:block;height:100%;width:0;border-radius:3px;background:linear-gradient(90deg,var(--ac),var(--ts));transition:width .35s ease;}" +
  // ===== Фон (2026-09-25): небо прогресса, сияние, зерно, тон раздела, стекло =====
  // Главная прозрачная — под ней слой .cd-homebg (цвет окна + сияние + звёзды).
  "#" + WIN_ID + " .cd-home{background:transparent;}" +
  "#" + WIN_ID + " .cd-homebg{position:absolute;inset:0;z-index:6;display:none;overflow:hidden;pointer-events:none;" +
  "background:radial-gradient(120% 68% at 50% -12%,rgba(var(--ac-rgb),.12),transparent 60%),var(--bg);}" +
  "#" + WIN_ID + ".home .cd-homebg{display:block;}" +
  // Главная прозрачная, а фон окна бывает полупрозрачным (custom-bg, «призрак») — статья, открытая до
  // главной, просвечивала снизу бледным текстом. Пока открыта главная/повторение — статью прячем
  // (visibility, а не display: позиция прокрутки и разметка сохраняются для возврата).
  "#" + WIN_ID + ".home .cd-rmain>.cd-content,#" + WIN_ID + ".home .cd-rmain>.cd-outline,#" + WIN_ID + ".home .cd-rmain>.cd-split," +
  "#" + WIN_ID + ".reviewing .cd-rmain>.cd-content,#" + WIN_ID + ".reviewing .cd-rmain>.cd-outline,#" + WIN_ID + ".reviewing .cd-rmain>.cd-split{visibility:hidden;}" +
  // #3 сияние: три мягких пятна медленно плывут (только transform — дёшево для GPU)
  "#" + WIN_ID + " .cd-aur{position:absolute;width:62%;height:72%;border-radius:50%;will-change:transform;animation:cd-aur1 48s ease-in-out infinite alternate;}" +
  "#" + WIN_ID + " .cd-aur.a1{left:-12%;top:-22%;background:radial-gradient(closest-side,rgba(var(--ac-rgb),.20),transparent);}" +
  "#" + WIN_ID + " .cd-aur.a2{right:-14%;bottom:-26%;background:radial-gradient(closest-side,color-mix(in srgb,var(--tk) 20%,transparent),transparent);animation-name:cd-aur2;animation-duration:62s;}" +
  "#" + WIN_ID + " .cd-aur.a3{left:28%;top:34%;width:46%;height:52%;background:radial-gradient(closest-side,color-mix(in srgb,var(--tf) 11%,transparent),transparent);animation-name:cd-aur3;animation-duration:77s;}" +
  "@keyframes cd-aur1{to{transform:translate(9%,7%) scale(1.15);}}" +
  "@keyframes cd-aur2{to{transform:translate(-11%,-6%) scale(1.12);}}" +
  "@keyframes cd-aur3{to{transform:translate(-14%,9%) scale(.88);}}" +
  // #1 звёзды
  "#" + WIN_ID + " .cd-sky{position:absolute;inset:0;width:100%;height:100%;}" +
  "#" + WIN_ID + " .cd-st{fill:var(--fg);opacity:.2;}" +
  "#" + WIN_ID + " .cd-st.dust{opacity:.1;}" +
  "#" + WIN_ID + " .cd-st.on{opacity:1;animation:cd-tw 4.5s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-st-glow{opacity:.16;}" +
  "#" + WIN_ID + " .cd-st-line{fill:none;stroke-width:1;stroke-linecap:round;opacity:.3;}" +
  "#" + WIN_ID + " .cd-st.next{fill:var(--ac);opacity:.95;}" +
  "#" + WIN_ID + " .cd-st-ring{fill:none;stroke:var(--ac);stroke-width:1.2;transform-box:fill-box;transform-origin:center;animation:cd-ring 2.6s ease-out infinite;}" +
  "@keyframes cd-tw{0%,100%{opacity:1;}50%{opacity:.5;}}" +
  "@keyframes cd-ring{0%{transform:scale(.5);opacity:.8;}100%{transform:scale(2.4);opacity:0;}}" +
  "#" + WIN_ID + ".no-anim .cd-aur,#" + WIN_ID + ".no-anim .cd-st,#" + WIN_ID + ".no-anim .cd-st-ring{animation:none;}" +
  // #4 зерно
  "#" + WIN_ID + " .cd-grain{position:absolute;inset:0;z-index:11;pointer-events:none;opacity:.045;background-image:url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxODAnIGhlaWdodD0nMTgwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nLjknIG51bU9jdGF2ZXM9JzMnIHN0aXRjaFRpbGVzPSdzdGl0Y2gnLz48ZmVDb2xvck1hdHJpeCB0eXBlPSdzYXR1cmF0ZScgdmFsdWVzPScwJy8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9JzEwMCUnIGhlaWdodD0nMTAwJScgZmlsdGVyPSd1cmwoI24pJy8+PC9zdmc+);background-size:180px 180px;}" +
  "#" + WIN_ID + ".light .cd-grain,#" + WIN_ID + ".sepia .cd-grain{opacity:.06;}" +
  // #6 тон раздела над статьёй: мягкий отсвет цвета раздела сверху, уезжает вместе с текстом
  "#" + WIN_ID + " .cd-content{background:radial-gradient(60% 300px at 0% 0%,color-mix(in srgb,var(--hcol,transparent) 14%,transparent),transparent 72%)," +
  "linear-gradient(180deg,color-mix(in srgb,var(--hcol,transparent) 7%,transparent),transparent 380px);background-repeat:no-repeat;background-attachment:local;}" +
  // #7 стеклянные карточки главной: полупрозрачные, с размытием того, что под ними
  "#" + WIN_ID + " .cd-home{--glass:color-mix(in srgb,var(--panel) 60%,transparent);}" +
  "#" + WIN_ID + " .cd-home .cd-home-hero,#" + WIN_ID + " .cd-home .cd-home-cont,#" + WIN_ID + " .cd-home .cd-home-spot,#" + WIN_ID + " .cd-home .cd-plan," +
  "#" + WIN_ID + " .cd-home .cd-track,#" + WIN_ID + " .cd-home .cd-home-warm,#" + WIN_ID + " .cd-home .cd-whatsnew,#" + WIN_ID + " .cd-home .cd-home-card," +
  "#" + WIN_ID + " .cd-home .cd-hs-in,#" + WIN_ID + " .cd-home .cd-qa,#" + WIN_ID + " .cd-home .cd-home-chip,#" + WIN_ID + " .cd-home .cd-home-done{" +
  "-webkit-backdrop-filter:blur(12px) saturate(1.25);backdrop-filter:blur(12px) saturate(1.25);}" +
  "#" + WIN_ID + " .cd-home .cd-home-hero{background:linear-gradient(135deg,color-mix(in srgb,var(--ac) 15%,var(--glass)),var(--glass));box-shadow:inset 0 1px 0 rgba(255,255,255,.07),var(--sh1);}" +
  "#" + WIN_ID + " .cd-home .cd-plan,#" + WIN_ID + " .cd-home .cd-track,#" + WIN_ID + " .cd-home .cd-home-card,#" + WIN_ID + " .cd-home .cd-hs-in," +
  "#" + WIN_ID + " .cd-home .cd-qa,#" + WIN_ID + " .cd-home .cd-home-chip{background:var(--glass);}" +
  "#" + WIN_ID + " .cd-home .cd-home-spot{background:linear-gradient(90deg,color-mix(in srgb,var(--ac2) 10%,var(--glass)),var(--glass));}" +
  "#" + WIN_ID + " .cd-home .cd-plan,#" + WIN_ID + " .cd-home .cd-track,#" + WIN_ID + " .cd-home .cd-home-card,#" + WIN_ID + " .cd-home .cd-home-cont," +
  "#" + WIN_ID + " .cd-home .cd-home-warm,#" + WIN_ID + " .cd-home .cd-whatsnew{box-shadow:inset 0 1px 0 rgba(255,255,255,.06);}" +
  "#" + WIN_ID + " .cd-home .cd-dtile{background-color:color-mix(in srgb,var(--panel) 50%,transparent);}" +
  "#" + WIN_ID + ".light .cd-home,#" + WIN_ID + ".sepia .cd-home{--glass:color-mix(in srgb,var(--panel) 72%,transparent);}" +
  // ===== Статичный фон и крупные значки (2026-09-25) =====
  // Пейзаж: картинка под палитрой, приглушена вуалью цвета окна — текст и карточки читаются.
  "#" + WIN_ID + " .cd-homebg-img{position:absolute;inset:-6px;background-position:center 70%;background-size:cover;background-repeat:no-repeat;opacity:.62;filter:saturate(.92);}" +
  "#" + WIN_ID + " .cd-homebg-veil{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,var(--bg) 55%,transparent) 0%,color-mix(in srgb,var(--bg) 25%,transparent) 45%,color-mix(in srgb,var(--bg) 60%,transparent) 100%);}" +
  "#" + WIN_ID + ".light .cd-homebg-img,#" + WIN_ID + ".sepia .cd-homebg-img{opacity:.38;}" +
  // Фон неподвижный: сияние, мерцание звёзд и пульс следующей темы — без анимации
  "#" + WIN_ID + " .cd-aur,#" + WIN_ID + " .cd-st.on,#" + WIN_ID + " .cd-st-ring{animation:none!important;}" +
  "#" + WIN_ID + " .cd-st-ring{transform:scale(1.5);opacity:.55;}" +
  // Значки-наклейки крупнее: на плитках, в кнопках, в разминке и колоде их должно быть видно
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-ic{width:36px;height:36px;font-size:20px;border-radius:var(--cd-r-lg);background:none!important;}" +
  "#" + WIN_ID + " .cd-dt-ic .cd-emo{width:34px;height:34px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-v{margin-top:4px;}" +
  "#" + WIN_ID + " .cd-qa .cd-emo{width:24px;height:24px;vertical-align:-7px;margin-right:4px;}" +
  "#" + WIN_ID + " .cd-home-status .cd-emo{width:20px;height:20px;vertical-align:-5px;}" +
  "#" + WIN_ID + " .cd-hw-ic .cd-emo{width:48px;height:48px;}" +
  "#" + WIN_ID + " .cd-hrev-ic .cd-emo{width:20px;height:20px;vertical-align:-5px;}" +
  "#" + WIN_ID + " .cd-dk-ic .cd-emo{width:30px;height:30px;vertical-align:-8px;}" +
  "#" + WIN_ID + " .cd-dc-hintbtn .cd-emo,#" + WIN_ID + " .cd-dk-shuffle .cd-emo,#" + WIN_ID + " .cd-dc-hint .cd-emo{width:20px;height:20px;vertical-align:-5px;}" +
  "#" + WIN_ID + " .cd-wn-h .cd-emo{width:22px;height:22px;vertical-align:-6px;}" +
  // ===== Герой плотнее (2026-09-25): плитки «значок слева», в широком окне — в один ряд; неделя под приветствием =====
  "#" + WIN_ID + " .cd-hero-stats .cd-dtile{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:'ic v' 'ic l' 'bar bar';column-gap:10px;row-gap:0;align-items:center;padding:10px 12px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-ic{grid-area:ic;align-self:center;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-v{grid-area:v;margin:0;align-self:end;font-size:16px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-l{grid-area:l;align-self:start;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-bar{grid-area:bar;margin-top:8px;}" +
  // плитки сами встают в ряд, когда им хватает места (и в широком окне, и когда герой перенёсся на две строки)
  "#" + WIN_ID + " .cd-hero-stats,#" + WIN_ID + " .cd-hero-stats.cd-hs4{grid-template-columns:repeat(auto-fit,minmax(118px,1fr));}" +
  "#" + WIN_ID + " .cd-home.wide2 .cd-hero-lead{flex:1 1 380px;}" +
  "#" + WIN_ID + " .cd-home.wide2 .cd-hero-stats,#" + WIN_ID + " .cd-home.wide2 .cd-hero-stats.cd-hs4{flex:2 1 600px;grid-template-columns:repeat(4,minmax(0,1fr));}" +
  "#" + WIN_ID + " .cd-home-week{display:flex;align-items:flex-end;gap:6px;margin-top:10px;}" +
  "#" + WIN_ID + " .cd-wk-d{display:flex;flex-direction:column;align-items:center;gap:3px;}" +
  "#" + WIN_ID + " .cd-wk-d i{display:block;width:18px;height:18px;border-radius:var(--cd-r-sm);background:color-mix(in srgb,var(--fg) 9%,transparent);box-shadow:inset 0 0 0 1px var(--bd);}" +
  "#" + WIN_ID + " .cd-wk-d.on i{background:linear-gradient(135deg,var(--ac),color-mix(in srgb,var(--ac) 55%,var(--tn)));box-shadow:0 0 10px rgba(var(--ac-rgb),.35);}" +
  "#" + WIN_ID + " .cd-wk-d.today i{outline:2px solid color-mix(in srgb,var(--ac) 70%,transparent);outline-offset:2px;}" +
  "#" + WIN_ID + " .cd-wk-d b{font-size:9.5px;font-weight:600;color:var(--faint);text-transform:uppercase;letter-spacing:.03em;}" +
  "#" + WIN_ID + " .cd-wk-d.today b{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-wk-n{margin-left:6px;margin-bottom:17px;font-size:11px;color:var(--muted);white-space:nowrap;}" +
  // тепловая карта 12 недель
  "#" + WIN_ID + " .cd-heat{display:block;margin-top:10px;}" +
  "#" + WIN_ID + " .cd-hm-heads,#" + WIN_ID + " .cd-hm-grid{display:flex;gap:3px;}" +
  "#" + WIN_ID + " .cd-hm-m{width:11px;font-size:9px;line-height:12px;color:var(--faint);white-space:nowrap;overflow:visible;}" +
  "#" + WIN_ID + " .cd-hm-w{display:flex;flex-direction:column;gap:3px;}" +
  "#" + WIN_ID + " .cd-hm-c{display:inline-block;width:11px;height:11px;border-radius:3px;background:color-mix(in srgb,var(--fg) 8%,transparent);box-shadow:inset 0 0 0 1px var(--bd);}" +
  "#" + WIN_ID + " .cd-hm-c.l1{background:color-mix(in srgb,var(--ac) 30%,transparent);}" +
  "#" + WIN_ID + " .cd-hm-c.l2{background:color-mix(in srgb,var(--ac) 55%,transparent);}" +
  "#" + WIN_ID + " .cd-hm-c.l3{background:color-mix(in srgb,var(--ac) 80%,transparent);}" +
  "#" + WIN_ID + " .cd-hm-c.l4{background:var(--ac);box-shadow:0 0 6px rgba(var(--ac-rgb),.45);}" +
  "#" + WIN_ID + " .cd-hm-c.fut{opacity:.25;}" +
  "#" + WIN_ID + " .cd-hm-c.today{outline:1.5px solid color-mix(in srgb,var(--ac) 80%,transparent);outline-offset:1px;}" +
  "#" + WIN_ID + " .cd-hm-foot{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:6px;}" +
  "#" + WIN_ID + " .cd-hm-foot .cd-wk-n{margin:0;}" +
  "#" + WIN_ID + " .cd-hm-leg{display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-hm-leg .cd-hm-c{width:9px;height:9px;}" +
  // ---- Настройки: окно с вкладками, карточки палитр с пейзажами и шрифтов ----
  "#" + WIN_ID + " .cd-viewmenu.cd-set{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,8,14,.46);backdrop-filter:blur(6px);animation:cd-set-fade .16s ease-out;}" +
  "#" + WIN_ID + " .cd-viewmenu.cd-set[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-set-card{position:relative;display:flex;flex-direction:column;width:min(780px,100%);max-height:min(88%,720px);background:color-mix(in srgb,var(--bg) 94%,transparent);border:1px solid var(--bd);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.45),0 0 0 1px rgba(var(--ac-rgb),.10);overflow:hidden;animation:cd-set-pop .2s cubic-bezier(.2,.9,.3,1.2);cursor:auto;user-select:text;font-weight:400;}" +
  "#" + WIN_ID + " .cd-set-card::before{content:\"\";position:absolute;inset:0 0 auto 0;height:120px;background:radial-gradient(120% 100% at 0% 0%,rgba(var(--ac-rgb),.22),transparent 70%);pointer-events:none;}" +
  "#" + WIN_ID + " .cd-set-head{position:relative;display:flex;align-items:center;gap:12px;padding:16px 18px 14px;border-bottom:1px solid var(--bd2);}" +
  "#" + WIN_ID + " .cd-set-ic{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:12px;background:rgba(var(--ac-rgb),.16);font-size:20px;flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-set-ic img,#" + WIN_ID + " .cd-set-ic .cd-uiic{width:26px;height:26px;}" +
  "#" + WIN_ID + " .cd-set-ht{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto;}" +
  "#" + WIN_ID + " .cd-set-ht b{font-size:16px;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-set-ht span{font-size:11.5px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-set-x{flex:0 0 auto;width:32px;height:32px;border-radius:10px;border:1px solid var(--bd);background:var(--panel);color:var(--muted);cursor:pointer;font:inherit;font-size:14px;}" +
  "#" + WIN_ID + " .cd-set-x:hover{color:var(--fg);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-set-body{display:grid;grid-template-columns:170px 1fr;min-height:0;flex:1 1 auto;}" +
  "#" + WIN_ID + " .cd-set-tabs{display:flex;flex-direction:column;gap:3px;padding:12px 10px;border-right:1px solid var(--bd2);background:color-mix(in srgb,var(--fg) 2.5%,transparent);overflow-y:auto;}" +
  "#" + WIN_ID + " .cd-set-tab{display:flex;align-items:center;gap:10px;padding:9px 11px;border:0;border-radius:11px;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer;text-align:left;transition:background .12s,color .12s,transform .12s;}" +
  "#" + WIN_ID + " .cd-set-tab:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-set-tab.on{background:rgba(var(--ac-rgb),.18);color:var(--fg);box-shadow:inset 3px 0 0 var(--ac);}" +
  "#" + WIN_ID + " .cd-set-tic{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:color-mix(in srgb,var(--fg) 6%,transparent);font-size:14px;flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-set-tab.on .cd-set-tic{background:rgba(var(--ac-rgb),.28);}" +
  "#" + WIN_ID + " .cd-set-pages{overflow-y:auto;padding:16px 20px 22px;min-width:0;}" +
  "#" + WIN_ID + " .cd-set-page{display:flex;flex-direction:column;gap:6px;animation:cd-set-fade .18s ease-out;}" +
  "#" + WIN_ID + " .cd-set-page[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-set-ph{display:flex;flex-direction:column;gap:2px;margin:0 0 8px;}" +
  "#" + WIN_ID + " .cd-set-ph b{font-size:15px;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-set-ph span{font-size:12px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-set .cd-vm-row{padding:9px 10px;border-radius:12px;background:color-mix(in srgb,var(--fg) 3%,transparent);font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-set .cd-vm-row:hover{background:color-mix(in srgb,var(--fg) 5%,transparent);}" +
  "#" + WIN_ID + " .cd-set .cd-vm-row.stack:not(.cards){flex-direction:row;align-items:center;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-set .cd-vm-row.stack:not(.cards) .cd-seg{width:auto;flex:0 1 auto;margin-left:auto;}" +
  "#" + WIN_ID + " .cd-set .cd-seg button{padding:6px 12px;}" +
  "#" + WIN_ID + " .cd-set .cd-pal-note{flex-basis:100%;}" +
  "#" + WIN_ID + " .cd-th-btn{display:inline-flex !important;flex-direction:column;align-items:center;gap:5px;padding:8px 10px !important;}" +
  "#" + WIN_ID + " .cd-th-mini{display:flex;flex-direction:column;gap:3px;width:46px;height:30px;padding:5px;border-radius:7px;box-sizing:border-box;box-shadow:inset 0 0 0 1px rgba(128,128,128,.35);}" +
  "#" + WIN_ID + " .cd-th-mini i{display:block;height:3px;border-radius:2px;background:currentColor;opacity:.55;}" +
  "#" + WIN_ID + " .cd-th-mini i:first-child{width:60%;opacity:.9;}" +
  "#" + WIN_ID + " .cd-th-mini i:last-child{width:80%;}" +
  "#" + WIN_ID + " .cd-th-mini.th-dark{background:#1e1e2e;color:#cdd6f4;}" +
  "#" + WIN_ID + " .cd-th-mini.th-light{background:#f5f5f7;color:#4c4f69;}" +
  "#" + WIN_ID + " .cd-th-mini.th-sepia{background:#f1e7d0;color:#5b4636;}" +
  "#" + WIN_ID + " .cd-th-mini.th-auto{background:linear-gradient(135deg,#f5f5f7 50%,#1e1e2e 50%);color:#888;}" +
  "#" + WIN_ID + " .cd-pal-grid{grid-template-columns:repeat(auto-fill,minmax(128px,1fr)) !important;gap:9px !important;}" +
  "#" + WIN_ID + " .cd-pal{flex-direction:column;align-items:stretch !important;gap:0 !important;padding:0 !important;overflow:hidden;border-radius:13px !important;transition:transform .14s,box-shadow .14s,border-color .14s;}" +
  "#" + WIN_ID + " .cd-pal:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.28);}" +
  "#" + WIN_ID + " .cd-pal.on{box-shadow:0 0 0 2px var(--ac),0 8px 20px rgba(0,0,0,.3) !important;}" +
  "#" + WIN_ID + " .cd-pal-th{position:relative;display:block;height:62px;background-size:cover;background-position:center;}" +
  "#" + WIN_ID + " .cd-pal-th::after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(0,0,0,.45));}" +
  "#" + WIN_ID + " .cd-pal-dots{position:absolute;left:7px;bottom:6px;z-index:1;display:flex;gap:4px;}" +
  "#" + WIN_ID + " .cd-pal-dots i{width:10px;height:10px;border-radius:50%;box-shadow:0 0 0 1.5px rgba(255,255,255,.7);}" +
  "#" + WIN_ID + " .cd-pal-nm{padding:7px 9px 8px;font-size:12px;font-weight:600;}" +
  "#" + WIN_ID + " .cd-pal.on .cd-pal-nm::after{content:\" ✓\";color:var(--ac);}" +
  "#" + WIN_ID + " .cd-font-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px;}" +
  "#" + WIN_ID + " .cd-font{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 6px 9px;border:1px solid var(--bd);border-radius:13px;background:var(--panel);color:var(--fg);cursor:pointer;font:inherit;transition:transform .14s,border-color .14s,box-shadow .14s;}" +
  "#" + WIN_ID + " .cd-font:hover{transform:translateY(-2px);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-font.on{border-color:var(--ac);background:rgba(var(--ac-rgb),.12);box-shadow:0 0 0 1px var(--ac);}" +
  "#" + WIN_ID + " .cd-font-aa{font-size:26px;line-height:1.1;font-weight:600;}" +
  "#" + WIN_ID + " .cd-font-nm{font-size:11.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-font-tag{position:absolute;top:5px;right:6px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ac);opacity:.85;}" +
  "#" + WIN_ID + " .cd-set-sample{margin:0 0 6px;padding:14px 16px;border-radius:14px;border:1px dashed rgba(var(--ac-rgb),.45);background:color-mix(in srgb,var(--panel) 80%,transparent);color:var(--fg);font-size:14px;line-height:1.6;}" +
  "#" + WIN_ID + " .cd-set-sample.cd-lh-tight{line-height:1.4;}" +
  "#" + WIN_ID + " .cd-set-sample.cd-lh-roomy{line-height:1.85;}" +
  "#" + WIN_ID + " .cd-set-sample .cd-ss-h{font-size:16px;font-weight:700;margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-set-sample p{margin:0 0 8px;}" +
  "#" + WIN_ID + " .cd-set-sample code{font-family:'Cascadia Code',Consolas,monospace;font-size:.9em;padding:1px 5px;border-radius:5px;background:var(--code);}" +
  "#" + WIN_ID + " .cd-set-sample pre{margin:0;padding:9px 12px;border-radius:10px;background:var(--code);white-space:pre;overflow:auto;line-height:1.5;}" +
  "#" + WIN_ID + " .cd-set-sample pre code{padding:0;background:none;font-size:inherit;}" +
  "#" + WIN_ID + " .cd-setbtn .cd-ic,#" + WIN_ID + " .cd-setbtn .cd-uiic{transition:transform .3s ease;}" +
  "#" + WIN_ID + " .cd-setbtn:hover .cd-ic,#" + WIN_ID + " .cd-setbtn:hover .cd-uiic{transform:rotate(60deg);}" +
  "#" + WIN_ID + ".no-anim .cd-set-card,#" + WIN_ID + ".no-anim .cd-viewmenu.cd-set,#" + WIN_ID + ".no-anim .cd-set-page{animation:none !important;}" +
  // окно узкое (класс tiny ставит applyResponsive) — вкладки строкой сверху
  "#" + WIN_ID + ".tiny .cd-set-body{grid-template-columns:1fr;}#" + WIN_ID + ".tiny .cd-set-tabs{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--bd2);padding:8px;}#" + WIN_ID + ".tiny .cd-set-tab{flex:0 0 auto;padding:7px 10px;}" +
  "@keyframes cd-set-fade{from{opacity:0}to{opacity:1}}@keyframes cd-set-pop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}" +
  // ---- Повторение карточек: дорожка оценок, цветные кнопки, «сначала вспомни», итог сессии ----
  "#" + WIN_ID + " .cd-review.has-bg::before{content:\"\";position:fixed;inset:0;pointer-events:none;background:var(--rv-bg) center/cover no-repeat;opacity:.22;filter:blur(2px) saturate(1.1);}" +
  "#" + WIN_ID + " .cd-review.has-bg::after{content:\"\";position:fixed;inset:0;pointer-events:none;background:radial-gradient(90% 70% at 50% 35%,transparent,var(--bg) 92%);}" +
  "#" + WIN_ID + " .cd-review .cd-rv-inner{position:relative;z-index:1;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-inner{max-width:780px;padding-top:6vh;}" +
  "#" + WIN_ID + " .cd-rv-top{gap:10px;}" +
  "#" + WIN_ID + " .cd-rv-count{flex:0 0 auto;font-weight:600;}" +
  "#" + WIN_ID + " .cd-rv-track{flex:1 1 auto;display:flex;gap:4px;align-items:center;min-width:0;}" +
  "#" + WIN_ID + " .cd-rv-track i{flex:1 1 0;max-width:34px;height:7px;border-radius:4px;background:var(--bd);transition:background .25s,transform .25s;}" +
  "#" + WIN_ID + " .cd-rv-track i.cur{background:rgba(var(--ac-rgb),.55);transform:scaleY(1.35);animation:cd-rv-pulse 1.4s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-rv-track i.g0{background:var(--tp);}" +
  "#" + WIN_ID + " .cd-rv-track i.g1{background:var(--tn);}" +
  "#" + WIN_ID + " .cd-rv-track i.g2{background:var(--ts);}" +
  "#" + WIN_ID + " .cd-rv-track i.again{outline:1px dashed rgba(var(--ac-rgb),.6);outline-offset:1px;}" +
  "#" + WIN_ID + " .cd-rv-undo{flex:0 0 auto;cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--muted);font:inherit;font-size:12px;border-radius:var(--cd-r-md);padding:5px 10px;}" +
  "#" + WIN_ID + " .cd-rv-undo:hover{color:var(--fg);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-card{position:relative;overflow:hidden;border-top:3px solid var(--rvg,var(--ac));background:color-mix(in srgb,var(--panel) 92%,transparent);backdrop-filter:blur(8px);}" +
  "#" + WIN_ID + " .cd-rv-card.flipped{animation:cd-rv-flip .32s cubic-bezier(.2,.8,.3,1);}" +
  "#" + WIN_ID + " .cd-rv-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:-6px 0 14px;}" +
  "#" + WIN_ID + " .cd-rv-meta .cd-rv-from{margin:0;padding:3px 9px;border-radius:999px;background:color-mix(in srgb,var(--rvg,var(--ac)) 14%,transparent);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-rv-badge{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;padding:3px 8px;border-radius:999px;background:rgba(var(--ac-rgb),.18);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-badge.new{background:color-mix(in srgb,var(--ts) 18%,transparent);color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rv-streak{margin-left:auto;font-size:12px;font-weight:700;color:var(--tn);}" +
  "#" + WIN_ID + " .cd-rv-recall{margin-top:14px;}" +
  "#" + WIN_ID + " .cd-rv-own summary{cursor:pointer;font-size:12px;color:var(--faint);list-style:none;}" +
  "#" + WIN_ID + " .cd-rv-own summary::-webkit-details-marker{display:none;}" +
  "#" + WIN_ID + " .cd-rv-own summary:hover{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-in{display:block;width:100%;box-sizing:border-box;margin-top:8px;padding:10px 12px;border:1px solid var(--bd);border-radius:12px;background:var(--bg);color:var(--fg);font:inherit;font-size:14px;line-height:1.5;resize:vertical;}" +
  "#" + WIN_ID + " .cd-rv-in:focus{outline:none;border-color:var(--ac);box-shadow:0 0 0 3px rgba(var(--ac-rgb),.18);}" +
  "#" + WIN_ID + " .cd-rv-mine{margin-bottom:12px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--fg) 4%,transparent);border-left:3px solid var(--faint);}" +
  "#" + WIN_ID + " .cd-rv-mine span{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--faint);margin-bottom:3px;}" +
  "#" + WIN_ID + " .cd-rv-mt{white-space:pre-wrap;color:var(--fg);font-size:14px;}" +
  "#" + WIN_ID + " .cd-rv-al{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ts);margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-rv-a{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-rv-show{padding:11px 26px;font-size:14px;box-shadow:0 6px 18px rgba(var(--ac-rgb),.28);transition:transform .12s,box-shadow .12s;}" +
  "#" + WIN_ID + " .cd-rv-show:hover{transform:translateY(-1px);box-shadow:0 9px 22px rgba(var(--ac-rgb),.36);}" +
  "#" + WIN_ID + " .cd-rv-rate{gap:10px;}" +
  "#" + WIN_ID + " .cd-rv-grade{flex-direction:row !important;align-items:center !important;gap:9px !important;padding:9px 16px 9px 10px !important;border-width:1.5px !important;transition:transform .12s,background .12s,border-color .12s;}" +
  "#" + WIN_ID + " .cd-rv-grade:hover{transform:translateY(-2px);}" +
  "#" + WIN_ID + " .cd-rv-gi{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;font-weight:800;font-size:14px;color:#11111b;}" +
  "#" + WIN_ID + " .cd-rv-gt{display:flex;flex-direction:column;align-items:flex-start;line-height:1.2;font-weight:600;}" +
  "#" + WIN_ID + " .cd-rv-grade.g0{border-color:color-mix(in srgb,var(--tp) 45%,transparent) !important;}" +
  "#" + WIN_ID + " .cd-rv-grade.g0 .cd-rv-gi{background:var(--tp);}" +
  "#" + WIN_ID + " .cd-rv-grade.g0:hover{background:color-mix(in srgb,var(--tp) 12%,var(--bg)) !important;}" +
  "#" + WIN_ID + " .cd-rv-grade.g1{border-color:color-mix(in srgb,var(--tn) 45%,transparent) !important;}" +
  "#" + WIN_ID + " .cd-rv-grade.g1 .cd-rv-gi{background:var(--tn);}" +
  "#" + WIN_ID + " .cd-rv-grade.g1:hover{background:color-mix(in srgb,var(--tn) 12%,var(--bg)) !important;}" +
  "#" + WIN_ID + " .cd-rv-grade.g2{border-color:color-mix(in srgb,var(--ts) 45%,transparent) !important;}" +
  "#" + WIN_ID + " .cd-rv-grade.g2 .cd-rv-gi{background:var(--ts);}" +
  "#" + WIN_ID + " .cd-rv-grade.g2:hover{background:color-mix(in srgb,var(--ts) 12%,var(--bg)) !important;}" +
  "#" + WIN_ID + " .cd-rv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-width:520px;margin:4px auto 16px;}" +
  "#" + WIN_ID + " .cd-rv-st{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 6px;border-radius:14px;border:1px solid var(--bd);background:color-mix(in srgb,var(--panel) 90%,transparent);}" +
  "#" + WIN_ID + " .cd-rv-st b{font-size:22px;line-height:1.1;}" +
  "#" + WIN_ID + " .cd-rv-st span{font-size:11px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-rv-st.g2 b{color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rv-st.g1 b{color:var(--tn);}" +
  "#" + WIN_ID + " .cd-rv-st.g0 b{color:var(--tp);}" +
  "#" + WIN_ID + " .cd-rv-st.acc b{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-ret{font-size:12.5px;color:var(--muted);margin-bottom:14px;}" +
  "#" + WIN_ID + " .cd-rv-weak{max-width:560px;margin:0 auto 18px;text-align:left;}" +
  "#" + WIN_ID + " .cd-rv-wh{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--faint);margin:0 0 6px 2px;}" +
  "#" + WIN_ID + " .cd-rv-wi{display:flex;align-items:center;gap:10px;padding:9px 12px;margin-bottom:6px;border-radius:12px;background:color-mix(in srgb,var(--panel) 90%,transparent);border-left:3px solid var(--tn);font-size:13px;}" +
  "#" + WIN_ID + " .cd-rv-wi.g0{border-left-color:var(--tp);}" +
  "#" + WIN_ID + " .cd-rv-wq{flex:1 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-rv-wi .cd-rv-open{flex:0 0 auto;margin-left:0;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-rv-done-btns{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-rv-more{cursor:pointer;border:none;background:var(--ac);color:#11111b;font:inherit;font-weight:700;border-radius:var(--cd-r-md);padding:6px 14px;}" +
  "#" + WIN_ID + ".no-anim .cd-rv-card.flipped,#" + WIN_ID + ".no-anim .cd-rv-track i.cur{animation:none;}" +
  "@keyframes cd-rv-flip{0%{transform:perspective(900px) rotateX(8deg);opacity:.6}100%{transform:none;opacity:1}}@keyframes cd-rv-pulse{0%,100%{opacity:1}50%{opacity:.45}}" +
  "#" + WIN_ID + " .cd-set-tic img.cd-emo{width:22px;height:22px;object-fit:contain;}#" + WIN_ID + " .cd-rv-streak img.cd-emo,#" + WIN_ID + " .cd-rv-ret img.cd-emo,#" + WIN_ID + " .cd-rv-own img.cd-emo{width:18px;height:18px;vertical-align:-4px;}" +
  // ---- Игровые блоки: «Путь героя» (```quests), сундуки (```lootsim), волна поиска пути (```bfsgrid) ----
  "#" + WIN_ID + " .cd-qmap{margin:18px 0;padding:18px 18px 14px;border:1px solid var(--bd);border-radius:18px;background:radial-gradient(120% 90% at 100% 0%,color-mix(in srgb,#eab308 14%,transparent),transparent 60%),var(--panel);}" +
  "#" + WIN_ID + " .cd-qmap-empty{color:var(--faint);font-size:13px;}" +
  "#" + WIN_ID + " .cd-qm-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-qm-ttl{font-size:17px;font-weight:800;}" +
  "#" + WIN_ID + " .cd-qm-sum{font-size:12.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-qm-sum b{color:#eab308;font-size:15px;}" +
  "#" + WIN_ID + " .cd-qm-bar{height:8px;border-radius:5px;background:var(--bd2);overflow:hidden;margin:9px 0 14px;}" +
  "#" + WIN_ID + " .cd-qm-bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#eab308,#f97316);transition:width .4s;}" +
  "#" + WIN_ID + " .cd-qm-ch{margin:0 0 12px;}" +
  "#" + WIN_ID + " .cd-qm-chn{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:7px;}" +
  "#" + WIN_ID + " .cd-qm-chc{margin-left:auto;font-size:11px;color:var(--faint);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-qm-path{position:relative;display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px;}" +
  "#" + WIN_ID + " .cd-qm-node{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:12px;border:1px solid var(--bd);background:var(--bg);color:var(--fg) !important;text-decoration:none !important;font-size:12px;line-height:1.25;transition:transform .12s,border-color .12s;}" +
  "#" + WIN_ID + " .cd-qm-node:hover{transform:translateY(-2px);border-color:#eab308;}" +
  "#" + WIN_ID + " .cd-qm-dot{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;font-weight:800;font-size:12px;background:conic-gradient(#eab308 calc(var(--qp)*1%),var(--bd2) 0);color:var(--fg);box-shadow:inset 0 0 0 3px var(--bg);}" +
  "#" + WIN_ID + " .cd-qm-nm{min-width:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}" +
  "#" + WIN_ID + " .cd-qm-node.done{border-color:color-mix(in srgb,var(--ts) 45%,transparent);background:color-mix(in srgb,var(--ts) 9%,var(--bg));}" +
  "#" + WIN_ID + " .cd-qm-node.done .cd-qm-dot{background:var(--ts);color:#11111b;box-shadow:none;}" +
  "#" + WIN_ID + " .cd-qm-node.next{border-color:#eab308;box-shadow:0 0 0 1px #eab308,0 6px 18px color-mix(in srgb,#eab308 22%,transparent);}" +
  "#" + WIN_ID + " .cd-qm-node.next .cd-qm-dot{animation:cd-qm-pulse 1.6s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-qm-node.todo:not(.next){opacity:.72;}" +
  "#" + WIN_ID + " .cd-qm-next{display:block;margin-top:6px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,#eab308 12%,transparent);color:var(--fg) !important;text-decoration:none !important;font-size:13px;}" +
  "#" + WIN_ID + " .cd-qm-next:hover{background:color-mix(in srgb,#eab308 20%,transparent);}" +
  "#" + WIN_ID + " .cd-qm-note{margin-top:8px;font-size:11px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-lootsim,#" + WIN_ID + " .cd-bfs{margin:16px 0;padding:14px 16px;border:1px solid var(--bd);border-radius:16px;background:var(--panel);}" +
  "#" + WIN_ID + " .cd-ls-head,#" + WIN_ID + " .cd-bfs-head{font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-ls-row{display:grid;grid-template-columns:minmax(90px,1.1fr) 70px minmax(90px,2fr) minmax(76px,auto);align-items:center;gap:10px;padding:5px 0;font-size:13px;}" +
  "#" + WIN_ID + " .cd-ls-nm{font-weight:700;}" +
  "#" + WIN_ID + " .cd-ls-want{font-size:11.5px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-ls-bar{position:relative;height:12px;border-radius:7px;background:var(--bd2);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-ls-bar b{display:block;height:100%;border-radius:7px;background:var(--lc);transition:width .35s;}" +
  "#" + WIN_ID + " .cd-ls-exp{position:absolute;top:-2px;bottom:-2px;width:2px;margin-left:-1px;background:var(--fg);opacity:.55;z-index:1;}" +
  "#" + WIN_ID + " .cd-ls-got{font-size:12px;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-ls-row.r0,#" + WIN_ID + " .cd-ls-trail i.r0{--lc:#9ca3af;}" +
  "#" + WIN_ID + " .cd-ls-row.r1,#" + WIN_ID + " .cd-ls-trail i.r1{--lc:#60a5fa;}" +
  "#" + WIN_ID + " .cd-ls-row.r2,#" + WIN_ID + " .cd-ls-trail i.r2{--lc:#c084fc;}" +
  "#" + WIN_ID + " .cd-ls-row.r3,#" + WIN_ID + " .cd-ls-trail i.r3{--lc:#fbbf24;}" +
  "#" + WIN_ID + " .cd-ls-row.r4,#" + WIN_ID + " .cd-ls-trail i.r4{--lc:#f87171;}" +
  "#" + WIN_ID + " .cd-ls-row.r5,#" + WIN_ID + " .cd-ls-trail i.r5{--lc:#34d399;}" +
  "#" + WIN_ID + " .cd-ls-trail{display:flex;gap:4px;min-height:14px;margin:10px 0 4px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-ls-trail i{width:14px;height:14px;border-radius:4px;background:var(--lc);box-shadow:inset 0 -2px 0 rgba(0,0,0,.25);}" +
  "#" + WIN_ID + " .cd-ls-ctl,#" + WIN_ID + " .cd-bfs-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;}" +
  "#" + WIN_ID + " .cd-ls-ctl button,#" + WIN_ID + " .cd-bfs-ctl button{cursor:pointer;border:1px solid var(--bd);background:var(--bg);color:var(--fg);font:inherit;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:10px;}" +
  "#" + WIN_ID + " .cd-ls-ctl button:hover,#" + WIN_ID + " .cd-bfs-ctl button:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-ls-open[data-n='1'],#" + WIN_ID + " .cd-bfs-play{background:var(--ac) !important;color:#11111b !important;border-color:transparent !important;}" +
  "#" + WIN_ID + " .cd-ls-pityl{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer;}" +
  "#" + WIN_ID + " .cd-ls-reset,#" + WIN_ID + " .cd-bfs-reset{margin-left:auto;}" +
  "#" + WIN_ID + " .cd-ls-stat,#" + WIN_ID + " .cd-bfs-st{margin-top:8px;font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-bfs-grid{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,34px));gap:3px;justify-content:start;overflow-x:auto;}" +
  "#" + WIN_ID + " .cd-bfs-c{aspect-ratio:1;min-width:0;padding:0;border:0;border-radius:6px;cursor:pointer;font:inherit;font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--fg);background:color-mix(in srgb,var(--fg) 5%,transparent);transition:background .18s,transform .1s;}" +
  "#" + WIN_ID + " .cd-bfs-c:hover{transform:scale(1.08);}" +
  "#" + WIN_ID + " .cd-bfs-c.wall{background:color-mix(in srgb,var(--fg) 26%,var(--bg));box-shadow:inset 0 -3px 0 rgba(0,0,0,.25);}" +
  "#" + WIN_ID + " .cd-bfs-c.floor.on{background:color-mix(in srgb,var(--ac) calc(62% - var(--t)*0.5%),transparent);}" +
  "#" + WIN_ID + " .cd-bfs-c.path{background:color-mix(in srgb,#f97316 70%,transparent) !important;color:#11111b;}" +
  "#" + WIN_ID + " .cd-bfs-c.start{background:var(--ts);color:#11111b;cursor:default;}" +
  "#" + WIN_ID + " .cd-bfs-c.enemy{background:var(--tp);color:#11111b;cursor:default;}" +
  "#" + WIN_ID + ".no-anim .cd-qm-node.next .cd-qm-dot{animation:none;}" +
  "@keyframes cd-qm-pulse{0%,100%{box-shadow:inset 0 0 0 3px var(--bg),0 0 0 0 rgba(234,179,8,.5)}50%{box-shadow:inset 0 0 0 3px var(--bg),0 0 0 6px rgba(234,179,8,0)}}" +
  paletteCss();

  // ==== runtime/06-window.js — построение окна: шапка, навигатор, статья ====
  // ---------------------------------------------------------------------------
  //  Построение окна.
  // ---------------------------------------------------------------------------
  var winEl = null;          // корень окна
  var navListEl = null;      // контейнер списка файлов
  var filterBarEl = null;    // чипы-фильтр над списком (Всё/Не изучено/Закреплённое/С заметками)
  var ctxMenu = null;        // контекстное меню пункта (правый клик)
  var searchInput = null;
  var searchJumpTerm = "";   // слово из поиска: при открытии материала прыгнуть к нему и подсветить
  var contentEl = null;      // область статьи
  var articleEl = null;      // .cd-article
  var bridgeEl = null;       // плашка-подсказка моста доки↔редактор (слово под курсором)
  var titleEl = null;        // хлебные крошки в шапке окна: раздел › тема › подраздел
  var groupCrumbEl = null;   // крошка «раздел» (значок + название группы)
  var rnameEl = null;        // имя текущего файла
  var crumbEl = null;        // хлебная крошка «текущий раздел»
  var dockBtnEl = null;      // «закрепить справа»
  var secProgEl = null;      // «Раздел 3/9 ● ● ● ○» — где ты в теме и что уже прочитано
  var logoEl = null;         // логотип в шапке — вокруг него кольцо общего прогресса
  var revBellEl = null;      // шапка: «🎴 N» — карточки к повторению
  var nextBtnEl = null;      // шапка: «Дальше» — следующее действие по месту
  var edBtnEl = null, edPopEl = null, edEnv = null;   // шапка: связь с редактором (файл, ошибки, компилятор)
  var tocBtn = null;                     // кнопка «Разделы» — теперь переключает боковое оглавление
  var outlineEl = null;                  // боковая рейка-оглавление (следит за прокруткой)
  var homeEl = null, homeBtn = null;     // главный экран (приветствие) + кнопка «Главная»
  var viewBtn = null, viewMenu = null;   // меню вида (шрифт/ширина/плотность)
  var rprogFill = null;      // заполнение полосы прогресса чтения
  var noResultEl = null;     // «ничего не найдено» под поиском
  var readBtn = null;
  var copyDocBtn = null;     // «копировать весь материал» в шапке читалки
  var toTopBtn = null;       // плавающая кнопка «наверх» в области чтения
  var findBtn = null, findBar = null, findInput = null, findCountEl = null;  // поиск по тексту материала
  var findHits = [], findIdx = -1;   // найденные <mark> и текущий
  var reviewEl = null, reviewQueue = [], reviewPos = 0, reviewOk = 0, reviewWarmup = false;  // сессия повторения карточек (+ это «Разминка дня»?)
  var reviewLog = [], reviewUndo = null, reviewStreak = 0, reviewTyped = "";   // оценки сессии, «↶ Назад», серия, «сначала вспомни»
  var backBtn = null, fwdBtn = null;     // навигация по истории переходов
  var fillEl = null, ptextEl = null, continueBtn = null;
  var current = null;        // текущий файл (объект из data)
  var curHeadings = [];      // [{el, slug, text}] — заголовки открытого файла для крошек/оглавления
  var itemEls = [];          // .cd-item по порядку
  var history = [], histIdx = -1, navHist = false;  // стек истории (как в браузере)
  var prevRect = null;       // прошлые размеры окна для «восстановить» после разворота
  var tabsEl = null, tabs = [], activeTab = 0;      // вкладки внутри окна
  var splitEl = null, splitArticle = null, splitTitleEl = null, splitCurrent = null;  // второй документ рядом (сплит)

  function groupsFromData() {
    // Собираем файлы в группы по полю group, сохраняя порядок первого появления.
    var d = DATA();
    var order = [], byName = {};
    (d ? d.files : []).forEach(function (f) {
      var g = f.group || "Материалы";
      if (!byName[g]) { byName[g] = { label: g, color: f.groupColor || "var(--ac)", items: [] }; order.push(byName[g]); }
      byName[g].items.push(f);
    });
    return order;
  }

  function buildWindow() {
    ensureStyle();
    applyAccent();                 // акцент под тему/обои ещё до первой отрисовки окна
    var w = el("div"); w.id = WIN_ID;
    w.className = isLight() ? "light" : "";
    w.classList.add("cd-in");                 // анимация появления окна
    if (navHiddenNow()) w.classList.add("navhidden");

    // --- размеры/позиция ---
    var vw = viewW(), vh = window.innerHeight || 800;
    var width = clamp(state.w || Math.min(1120, Math.round(vw * 0.92)), 560, vw - 20);
    var height = clamp(state.h || Math.min(760, Math.round(vh * 0.86)), 380, vh - 20);
    var left = state.x != null ? clamp(state.x, 0, vw - width) : Math.round((vw - width) / 2);
    var top = state.y != null ? clamp(state.y, safeTop(), vh - height) : Math.max(safeTop(), Math.round((vh - height) / 2));
    w.style.width = width + "px"; w.style.height = height + "px";
    w.style.left = left + "px"; w.style.top = top + "px";

    // --- шапка ---
    var head = el("div", null); head.className = "cd-head";
    var navToggle = hbtn("☰", "Скрыть/показать список файлов", "menu");
    navToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      // Раскладка запоминается отдельно для главной и для чтения.
      if (w.classList.contains("home")) state.navHiddenHome = !state.navHiddenHome;
      else state.navHidden = !state.navHidden;
      saveState();
      w.classList.toggle("navhidden", navHiddenNow());
      applyResponsive();
    });
    backBtn = hbtn("‹", "Назад", "back");
    backBtn.addEventListener("click", function (e) { e.stopPropagation(); goBack(); });
    fwdBtn = hbtn("›", "Вперёд", "forward");
    fwdBtn.addEventListener("click", function (e) { e.stopPropagation(); goForward(); });
    var title = el("div", null); title.className = "cd-title";
    // Логотип в кольце общего прогресса (--lp, %), рядом — хлебные крошки вместо статичного названия.
    setHTML(title, '<span class="cd-logo" role="button" title="На главную" tabindex="0"><span class="cd-logo-in">' +
      (LOGO_URI ? '<img src="' + LOGO_URI + '" alt="">' : "📘") + "</span></span>");
    logoEl = title.querySelector(".cd-logo");
    logoEl.addEventListener("click", function (e) { e.stopPropagation(); showHome(); });
    logoEl.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); showHome(); } });
    var snapL = hbtn("◧", "Прижать влево (половина экрана)", "snap-left");
    snapL.addEventListener("click", function (e) { e.stopPropagation(); snapWindow("left"); });
    var snapR = hbtn("◨", "Прижать вправо (половина экрана)", "snap-right");
    snapR.addEventListener("click", function (e) { e.stopPropagation(); snapWindow("right"); });
    dockBtnEl = hbtn("⇥", "Закрепить справа: редактор сдвинется и не будет под окном (ещё раз — открепить)", "dock");
    dockBtnEl.addEventListener("click", function (e) { e.stopPropagation(); toggleDock(); });
    if (state.docked) dockBtnEl.classList.add("on");
    var rollBtn = hbtn("⎯", "Свернуть в полоску / развернуть (двойной клик по шапке)", "roll");
    rollBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleRoll(); });
    var maxBtn = hbtn("▢", "Во весь экран / восстановить", "maximize");
    maxBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMax(); });
    var splitBtn = hbtn("⊟", "Второй документ рядом (сплит)", "split");
    splitBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleSplit(); });
    var refreshBtn = hbtn("⟳", "Обновить материалы", "refresh");
    refreshBtn.addEventListener("click", function (e) { e.stopPropagation(); refreshData(); });
    var closeBtn = hbtn("✕", "Закрыть (Esc)", "close");
    closeBtn.addEventListener("click", function (e) { e.stopPropagation(); closeWindow(); });
    // В свёрнутой полоске видно, что открыто: «Тема › раздел»; щелчок — развернуть.
    rollInfoEl = el("button", null); rollInfoEl.type = "button"; rollInfoEl.className = "cd-rollinfo";
    rollInfoEl.title = "Развернуть окно";
    rollInfoEl.addEventListener("click", function (e) { e.stopPropagation(); if (state.rolled) toggleRoll(); });
    // Хлебные крошки: «раздел › тема › подраздел». Раздел — раскрыть его в списке слева,
    // тема — к её началу, подраздел — к его заголовку.
    titleEl = el("div", null); titleEl.className = "cd-crumbs";
    groupCrumbEl = el("button", null); groupCrumbEl.type = "button"; groupCrumbEl.className = "cd-cg"; groupCrumbEl.hidden = true;
    groupCrumbEl.addEventListener("click", function (e) { e.stopPropagation(); if (current) revealGroup(current.group); });
    rnameEl = el("span", null, "Главная"); rnameEl.className = "cd-rname";
    crumbEl = el("span", null); crumbEl.className = "cd-crumb";
    secProgEl = el("span", null); secProgEl.className = "cd-secprog"; secProgEl.hidden = true;
    titleEl.appendChild(groupCrumbEl); titleEl.appendChild(rnameEl); titleEl.appendChild(crumbEl); titleEl.appendChild(secProgEl);
    rnameEl.addEventListener("click", function (e) {
      e.stopPropagation();
      if (current && contentEl && !(winEl && winEl.classList.contains("home"))) contentEl.scrollTo({ top: 0, behavior: "smooth" });
    });
    crumbEl.addEventListener("click", function (e) {
      e.stopPropagation();
      var slug = crumbEl.getAttribute("data-slug"); if (!slug || !articleEl) return;
      var t = articleEl.querySelector('[id="' + cssEscape(slug) + '"]');
      if (t) { t.scrollIntoView({ block: "start", behavior: "smooth" }); flashHeading(t); }
    });
    title.appendChild(titleEl);
    title.appendChild(rollInfoEl);
    // Середина шапки: карточки к повторению · связь с редактором · «Дальше».
    var hx = el("div", null); hx.className = "cd-hx";
    revBellEl = el("button", null); revBellEl.type = "button"; revBellEl.className = "cd-hpill cd-hrev"; revBellEl.hidden = true;
    revBellEl.addEventListener("click", function (e) { e.stopPropagation(); if (warmupDoneToday()) startReview(); else startWarmup(); });
    edBtnEl = el("button", null); edBtnEl.type = "button"; edBtnEl.className = "cd-hpill cd-hed"; edBtnEl.hidden = true;
    setHTML(edBtnEl, '<i class="cd-hed-dot"></i><span class="cd-hed-n"></span><b class="cd-hed-e"></b>');
    edBtnEl.addEventListener("click", function (e) { e.stopPropagation(); toggleEdPop(); });
    nextBtnEl = el("button", null); nextBtnEl.type = "button"; nextBtnEl.className = "cd-hnext"; nextBtnEl.hidden = true;
    setHTML(nextBtnEl, '<span class="cd-hnext-t"></span><span class="cd-hnext-a" aria-hidden="true">›</span>');
    nextBtnEl.addEventListener("click", function (e) { e.stopPropagation(); goHeadNext(); });
    hx.appendChild(revBellEl); hx.appendChild(edBtnEl); hx.appendChild(nextBtnEl);
    // Инструменты чтения (Главная, Разделы, ⚙ ⌕ ⧉, Изучено) — тоже в шапке; наполняются ниже, где создаются.
    var hrt = el("div", null); hrt.className = "cd-hrt";
    closeBtn.classList.add("cd-close");
    // Кнопки шапки — «капсулами»: навигация слева, управление окном справа (с разделителями).
    function hgroup(items, cls) {
      var g = el("div", null); g.className = "cd-hgrp" + (cls ? " " + cls : "");
      items.forEach(function (it) {
        if (it === "|") { var sep = el("i", null); sep.className = "cd-hsep"; g.appendChild(sep); }
        else g.appendChild(it);
      });
      return g;
    }
    head.appendChild(hgroup([navToggle, backBtn, fwdBtn], "cd-hg-nav")); head.appendChild(title);
    head.appendChild(hx); head.appendChild(hrt);
    head.appendChild(hgroup([splitBtn, snapL, snapR, dockBtnEl, "|", rollBtn, maxBtn, "|", refreshBtn, closeBtn], "cd-hg-win"));
    [snapL, snapR, dockBtnEl, rollBtn, maxBtn, closeBtn].forEach(function (b) { b.classList.add("cd-winctl"); });   // во вкладке этим управляет VS Code
    head.addEventListener("dblclick", function (e) {
      if (headInteractive(e.target)) return;  // двойной клик по кнопке/крошке/меню — не сворачивать
      toggleRoll();
    });
    w.appendChild(head);
    // #4 Зерно: почти невидимый шум поверх окна — убирает «ступеньки» на градиентах.
    var grain = el("div", null); grain.className = "cd-grain"; grain.setAttribute("aria-hidden", "true");
    w.appendChild(grain);

    // --- тело ---
    var body = el("div", null); body.className = "cd-body";

    // навигатор
    var nav = el("aside", null); nav.className = "cd-nav";
    var searchWrap = el("div", null); searchWrap.className = "cd-search";
    setHTML(searchWrap, '<span class="cd-si">⌕</span><button class="cd-sx" type="button" title="Очистить">✕</button>');
    searchInput = el("input"); searchInput.type = "text"; searchInput.placeholder = "Поиск по всем материалам…";
    searchInput.setAttribute("aria-label", "Поиск по документации");
    searchWrap.insertBefore(searchInput, searchWrap.querySelector(".cd-sx"));
    nav.appendChild(searchWrap);

    var prog = el("div", null); prog.className = "cd-prog";
    continueBtn = el("button", null, "▶ Продолжить"); continueBtn.className = "cd-continue";
    continueBtn.title = "Открыть следующий неизученный материал";
    var bar = el("div", null); bar.className = "cd-bar";
    fillEl = el("div", null); fillEl.className = "cd-fill"; bar.appendChild(fillEl);
    ptextEl = el("span", null); ptextEl.className = "cd-ptext";
    prog.appendChild(continueBtn); prog.appendChild(bar); prog.appendChild(ptextEl);
    nav.appendChild(prog);

    // Чипы-фильтр над списком материалов.
    filterBarEl = el("div", null); filterBarEl.className = "cd-filterbar";
    [["all", "Всё"], ["unread", "Не изучено"], ["pinned", "Закреплённое"], ["noted", "С заметками"], ["hl", "С выделениями"]].forEach(function (pair) {
      var chip = el("button", null, pair[1]); chip.type = "button"; chip.className = "cd-fchip";
      chip.setAttribute("data-filter", pair[0]);
      chip.addEventListener("click", function () { state.navFilter = pair[0]; saveState(); syncFilterChips(); renderNav(); });
      filterBarEl.appendChild(chip);
    });
    nav.appendChild(filterBarEl);
    syncFilterChips();

    navListEl = el("div", null); navListEl.className = "cd-list";
    nav.appendChild(navListEl);
    // «ничего не найдено» — вне списка, чтобы перерисовка навигатора его не стёрла
    noResultEl = el("div", null); noResultEl.className = "cd-noresult";
    nav.appendChild(noResultEl);
    body.appendChild(nav);

    // читалка
    var reader = el("div", null); reader.className = "cd-reader";
    // полоса вкладок (появляется, когда открыто больше одной)
    tabsEl = el("div", null); tabsEl.className = "cd-tabs"; tabsEl.hidden = true;
    reader.appendChild(tabsEl);
    readBtn = el("button", null); readBtn.className = "cd-rbtn cd-readbtn"; setHTML(readBtn, uiLabel("read-off", "○", "Изучено"));
    readBtn.title = "Отметить материал изученным";
    // Настройки — отдельная кнопка, видна ВСЕГДА (на главной, в повторении, в материале); сама
    // панель — окно поверх всего окна документации (кладём его в корень окна в wireViewMenu).
    viewBtn = el("button", null); viewBtn.className = "cd-rbtn cd-setbtn"; viewBtn.type = "button";
    setHTML(viewBtn, uiLabel("settings", "⚙")); viewBtn.title = "Настройки: тема, палитра, шрифт, поведение";
    viewBtn.setAttribute("aria-label", "Настройки"); viewBtn.setAttribute("aria-haspopup", "dialog");
    viewMenu = el("div", null); viewMenu.className = "cd-viewmenu cd-set"; viewMenu.hidden = true;
    tocBtn = el("button", null); tocBtn.className = "cd-rbtn cd-file-only"; setHTML(tocBtn, uiLabel("sections", "☰", "Разделы"));
    tocBtn.title = "Оглавление файла сбоку (показать/скрыть)";
    readBtn.classList.add("cd-file-only");
    // кнопка возврата на главный экран (приветствие) — всегда видна
    homeBtn = el("button", null); homeBtn.className = "cd-rbtn cd-hb-home"; homeBtn.type = "button"; setHTML(homeBtn, uiLabel("home", "⌂", "Главная"));
    homeBtn.title = "На главную (приветствие и быстрый доступ)";
    homeBtn.addEventListener("click", function () { showHome(); });
    // «Копировать весь материал» — исходный Markdown текущего файла в буфер обмена.
    copyDocBtn = el("button", null); copyDocBtn.className = "cd-rbtn cd-file-only"; copyDocBtn.type = "button"; setHTML(copyDocBtn, uiLabel("copy", "⧉"));
    copyDocBtn.title = "Копировать весь материал (Markdown)";
    copyDocBtn.setAttribute("aria-label", "Копировать весь материал");
    copyDocBtn.addEventListener("click", function () { copyWholeDoc(copyDocBtn); });
    // «Найти в тексте» — открывает панель поиска по открытому материалу.
    findBtn = el("button", null); findBtn.className = "cd-rbtn cd-file-only"; findBtn.type = "button"; setHTML(findBtn, uiLabel("find", "⌕"));
    findBtn.title = "Найти в этом материале"; findBtn.setAttribute("aria-label", "Найти в материале");
    findBtn.addEventListener("click", function () { toggleFind(); });
    // Инструменты материала (поиск, копировать) — одной сегментированной капсулой.
    var tools = el("div", null); tools.className = "cd-rgrp cd-file-only";
    tools.appendChild(findBtn); tools.appendChild(copyDocBtn);
    // Маскот выглядывает из-за нижней кромки шапки — рядом с кнопками (декор, не кликается).
    if ((typeof STICKERS !== "undefined" && STICKERS && STICKERS["ui-peek"])) {
      var peek = el("img", null); peek.className = "cd-peek"; peek.alt = ""; peek.src = STICKERS["ui-peek"];
      peek.setAttribute("aria-hidden", "true"); peek.draggable = false;
      hrt.appendChild(peek);
    }
    // Бывшая вторая полоса «панель темы» живёт в шапке окна (одна полоса — больше места под текст).
    hrt.appendChild(homeBtn); hrt.appendChild(viewBtn); hrt.appendChild(tocBtn); hrt.appendChild(tools); hrt.appendChild(readBtn);

    // тонкая полоса прогресса чтения текущего файла
    var rprog = el("div", null); rprog.className = "cd-rprog";
    rprogFill = el("i", null); rprog.appendChild(rprogFill);
    reader.appendChild(rprog);

    // основная область: статья + боковое оглавление-рейка
    var rmain = el("div", null); rmain.className = "cd-rmain";
    contentEl = el("div", null); contentEl.className = "cd-content";
    articleEl = el("div", null); articleEl.className = "cd-article";
    contentEl.appendChild(articleEl);
    // Плашка-мост: всплывает снизу области чтения, когда курсор в C/C++-файле стоит на знакомом слове.
    bridgeEl = el("div", null); bridgeEl.className = "cd-bridge"; bridgeEl.hidden = true;
    setHTML(bridgeEl, '<span class="cd-bridge-ic">✎</span><div class="cd-bridge-body">' +
      '<div class="cd-bridge-word"></div><div class="cd-bridge-def"></div></div>' +
      '<button class="cd-bridge-ex" type="button" hidden title="Открыть правильный мини-пример в новом файле (твой код не трогаем)">Пример</button>' +
      '<button class="cd-bridge-open" type="button">Открыть</button>' +
      '<button class="cd-bridge-x" type="button" title="Скрыть подсказку" aria-label="Скрыть">✕</button>');
    bridgeEl.querySelector(".cd-bridge-open").addEventListener("click", function () { bridgeOpen(); });
    bridgeEl.querySelector(".cd-bridge-ex").addEventListener("click", function () {
      var b = this, code = bridgeExample; if (!code) return;
      b.disabled = true;
      sendAction({ kind: "newfile", code: "// Правильный вариант — сравни со своим кодом\n" + code }, function (res) {
        b.disabled = false;
        if (res.ok) toast("Пример открыт в новом файле"); else toast("Не открылось: " + (res.error || "ошибка"), true);
      });
    });
    bridgeEl.querySelector(".cd-bridge-x").addEventListener("click", function () { hideBridge(true); });
    contentEl.appendChild(bridgeEl);
    rmain.appendChild(contentEl);
    outlineEl = el("nav", null); outlineEl.className = "cd-outline";
    outlineEl.setAttribute("aria-label", "Оглавление файла");
    rmain.appendChild(outlineEl);

    // Панель поиска по тексту материала (плавает вверху справа над статьёй).
    findBar = el("div", null); findBar.className = "cd-find"; findBar.hidden = true;
    findInput = el("input"); findInput.type = "text"; findInput.className = "cd-find-in";
    findInput.placeholder = "Найти в материале…"; findInput.setAttribute("aria-label", "Найти в материале");
    findCountEl = el("span", null, ""); findCountEl.className = "cd-find-n";
    var findPrev = el("button", null, "↑"); findPrev.type = "button"; findPrev.className = "cd-find-b"; findPrev.title = "Предыдущее (Shift+Enter)";
    var findNext = el("button", null, "↓"); findNext.type = "button"; findNext.className = "cd-find-b"; findNext.title = "Следующее (Enter)";
    var findX = el("button", null, "✕"); findX.type = "button"; findX.className = "cd-find-b"; findX.title = "Закрыть (Esc)";
    findBar.appendChild(findInput); findBar.appendChild(findCountEl);
    findBar.appendChild(findPrev); findBar.appendChild(findNext); findBar.appendChild(findX);
    findInput.addEventListener("input", function () { findRun(findInput.value); });
    findInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
      else if (e.key === "Escape") { e.preventDefault(); toggleFind(false); }
    });
    findPrev.addEventListener("click", function () { findStep(-1); findInput.focus(); });
    findNext.addEventListener("click", function () { findStep(1); findInput.focus(); });
    findX.addEventListener("click", function () { toggleFind(false); });
    rmain.appendChild(findBar);

    // Плавающая кнопка «наверх» — появляется, когда статья прокручена далеко вниз.
    toTopBtn = el("button", null, "↑"); toTopBtn.className = "cd-totop"; toTopBtn.type = "button";
    toTopBtn.title = "Наверх"; toTopBtn.setAttribute("aria-label", "Наверх"); toTopBtn.hidden = true;
    toTopBtn.addEventListener("click", function () {
      if (contentEl) { try { contentEl.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { contentEl.scrollTop = 0; } }
    });
    rmain.appendChild(toTopBtn);

    // второй документ рядом (сплит) — свой заголовок + прокручиваемая статья
    splitEl = el("div", null); splitEl.className = "cd-split"; splitEl.hidden = true;
    var splitHead = el("div", null); splitHead.className = "cd-split-head";
    splitTitleEl = el("span", null, ""); splitTitleEl.className = "cd-split-title";
    var splitClose = el("button", null, "✕"); splitClose.type = "button"; splitClose.className = "cd-split-x"; splitClose.title = "Закрыть второй документ";
    splitClose.addEventListener("click", function () { toggleSplit(false); });
    splitHead.appendChild(splitTitleEl); splitHead.appendChild(splitClose);
    var splitContent = el("div", null); splitContent.className = "cd-split-content";
    splitArticle = el("div", null); splitArticle.className = "cd-article";
    splitContent.appendChild(splitArticle);
    splitEl.appendChild(splitHead); splitEl.appendChild(splitContent);
    splitArticle.addEventListener("click", onSplitClick);
    splitArticle.addEventListener("input", onArticleInput);
    rmain.appendChild(splitEl);

    // главный экран (приветствие) — оверлей поверх области чтения
    // Фон главной отдельным слоем под ней: сияние (#3) + звёздное небо прогресса (#1).
    homeBgEl = el("div", null); homeBgEl.className = "cd-homebg"; homeBgEl.setAttribute("aria-hidden", "true");
    rmain.appendChild(homeBgEl);
    homeEl = el("div", null); homeEl.className = "cd-home"; homeEl.hidden = true;
    rmain.appendChild(homeEl);

    // оверлей режима повторения карточек (#3) — поверх области чтения, как главный экран
    reviewEl = el("div", null); reviewEl.className = "cd-review"; reviewEl.hidden = true;
    reviewEl.addEventListener("click", onReviewClick);
    rmain.appendChild(reviewEl);

    reader.appendChild(rmain);
    body.appendChild(reader);

    w.appendChild(body);

    // --- ручки размера ---
    ["e", "s", "se", "w"].forEach(function (side) {
      var rz = el("div", null); rz.className = "cd-rz cd-rz-" + side;
      w.appendChild(rz);
      installResize(w, rz, side);
    });

    document.body.appendChild(w);
    winEl = w;
    applyRoll();   // восстановить мини-режим, если был свёрнут

    // --- поведение ---
    installDrag(w, head);
    wireSearch();
    wireTocButton();
    wireViewMenu();
    readBtn.addEventListener("click", function () { if (current) { toggleRead(current.rel); } });
    continueBtn.addEventListener("click", openNextUnread);

    // клики по статье: копирование кода и внутренние ссылки
    articleEl.addEventListener("click", onArticleClick);
    // движение слайдеров «живого примера» — пересчёт кода и вывода на лету
    articleEl.addEventListener("input", onArticleInput);
    articleEl.addEventListener("mousemove", deckTilt, { passive: true });
    articleEl.addEventListener("mouseover", memHover, { passive: true });
    articleEl.addEventListener("mouseleave", deckTilt, { passive: true });
    // прокрутка читалки: прогресс, память позиции, активный раздел для крошек
    contentEl.addEventListener("scroll", onContentScroll, { passive: true });

    applyReaderPrefs();
    renderNav();
    // Открыть последний файл или первый доступный.
    var start = null, map = fileMap();
    if (state.last && map[state.last]) start = map[state.last];
    if (!start) { var d = DATA(); start = d && d.files[0]; }
    if (start) openFile(start.rel, null, true);   // тихая предзагрузка: не мечем «изучено»/«последний»
    // При открытии окна показываем главный экран (приветствие). Файл уже загружен под ним —
    // клик по «Продолжить»/карточке/навигатору просто скрывает оверлей и открывает материал.
    showHome();
    // первое открытие — знакомство в 3 шага; только если главная ещё на экране (материал могли
    // открыть за эти 0,7 с — например, «Найти в справочнике» из редактора; тогда тур — в следующий раз)
    if (!state.tourDone) setTimeout(function () { if (homeEl && !homeEl.hidden) startTour(); }, 700);

    // Esc закрывает окно (и меню разделов).
    document.addEventListener("keydown", onKey, true);

    return w;
  }

  // ---- Иконки интерфейса: свои картинки вместо символов ----
  //  Картинки кладутся в extension/ui-icons/<имя>.png|webp и встраиваются командой
  //  npm run embed:ui-icons (между маркерами ниже). Нет картинки — остаётся символ.
  /* UI_ICONS:start */
  var UI_ICONS = {};
  /* UI_ICONS:end */
  // Подпись кнопки: иконка (или символ) + текст. textContent остаётся «символ текст».
  function uiLabel(name, glyph, text) {
    var uri = UI_ICONS && UI_ICONS[name];
    var ic = uri ? '<img class="cd-uiic" src="' + uri + '" alt="' + escapeHtml(glyph) + '" draggable="false">'
                 : '<span class="cd-ic">' + escapeHtml(glyph) + "</span>";
    return ic + (text ? ' <span class="cd-bt">' + escapeHtml(text) + "</span>" : "");
  }
  function hbtn(sym, title, name) {
    var b = el("button", null); b.className = "cd-hbtn"; b.type = "button"; b.title = title;
    b.setAttribute("aria-label", title);
    setHTML(b, uiLabel(name || "", sym));
    return b;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // Высота строки заголовка VS Code (нативные кнопки свернуть/развернуть/закрыть). Окно держим
  // НИЖЕ неё, чтобы его шапка не налезала на эти кнопки — без F11 и без правки settings.json.
  // В полноэкранном режиме заголовка нет (offsetHeight 0) — вернём 0, и ограничение снимется само.
  function safeTop() {
    try {
      var tb = document.querySelector(".part.titlebar") || document.querySelector(".titlebar");
      if (tb && tb.offsetHeight > 0) {
        var r = tb.getBoundingClientRect();
        if (r.top <= 2 && r.height > 0) return Math.min(48, Math.round(r.height));
      }
    } catch (e) {}
    return 0;
  }

  // ==== runtime/07-nav-search.js — перетаскивание, размер, навигатор, поиск, оглавление, разделы ====
  // ------- перетаскивание за шапку -------
  function installDrag(w, head) {
    var drag = null;
    head.addEventListener("mousedown", function (e) {
      if (e.button !== 0 || IN_PANEL) return;   // во вкладке окно не двигается
      if (headInteractive(e.target)) return;  // клик по кнопке/крошке/меню шапки — не перетаскивание
      if (state.docked) toggleDock();   // потащил закреплённое окно — оно открепляется
      var r = w.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.preventDefault();
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    function onMove(e) {
      if (!drag) return;
      var x = clamp(e.clientX - drag.dx, 0, viewW() - w.offsetWidth);
      var y = clamp(e.clientY - drag.dy, safeTop(), (window.innerHeight || 800) - w.offsetHeight);
      w.style.left = x + "px"; w.style.top = y + "px";
    }
    function onUp() {
      if (!drag) return; drag = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      var r = w.getBoundingClientRect();
      state.x = Math.round(r.left); state.y = Math.round(r.top); saveState();
    }
  }

  // ------- изменение размера -------
  function installResize(w, handle, side) {
    var rz = null;
    handle.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      var r = w.getBoundingClientRect();
      rz = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, left: r.left, top: r.top };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    function onMove(e) {
      if (!rz) return;
      var vw = viewW(), vh = window.innerHeight || 800;
      if (state.rolled) {                              // полоска: только ширина, своя (--roll-w)
        var rw = side === "w" ? clamp(rz.w - (e.clientX - rz.x), 380, rz.left + rz.w) : clamp(rz.w + (e.clientX - rz.x), 380, vw - rz.left);
        w.style.setProperty("--roll-w", rw + "px");
        if (side === "w") w.style.left = (rz.left + rz.w - rw) + "px";
        return;
      }
      if (side.indexOf("e") >= 0) w.style.width = clamp(rz.w + (e.clientX - rz.x), 560, vw - rz.left) + "px";
      if (side.indexOf("s") >= 0) w.style.height = clamp(rz.h + (e.clientY - rz.y), 380, vh - rz.top) + "px";
      if (side === "w") {
        var nw = clamp(rz.w - (e.clientX - rz.x), 560, rz.left + rz.w);
        w.style.width = nw + "px";
        w.style.left = (rz.left + rz.w - nw) + "px";
      }
      applyResponsive();
    }
    function onUp() {
      if (!rz) return; rz = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      var r = w.getBoundingClientRect();
      if (state.rolled) state.rollW = Math.round(r.width);   // ширина полоски — отдельно от окна
      else { state.w = Math.round(r.width); state.h = Math.round(r.height); }   // в мини-режиме высота = полоска, её не сохраняем
      state.x = Math.round(r.left); state.y = Math.round(r.top); saveState();
    }
  }

  // ------- навигатор -------
  function navMatch(f) {
    switch (state.navFilter) {
      case "unread": return !state.read[f.rel];
      case "pinned": return !!state.pins[f.rel];
      case "noted": return !!state.notes[f.rel];
      case "hl": return Array.isArray(state.hl[f.rel]) && state.hl[f.rel].length > 0;
      default: return true;
    }
  }
  function renderNav() {
    if (!navListEl) return;
    navListEl.textContent = "";
    itemEls = [];
    var groups = groupsFromData();
    if (!groups.length) {
      // Источник данных есть, но список ещё пуст — скелет вместо «материалов нет».
      if (hasDataSource()) { setHTML(navListEl, skelNavHtml()); return; }
      var emptyBox = el("div", null); emptyBox.className = "cd-empty";
      setHTML(emptyBox, '<div class="cd-empty-art">' + stickerMarkup("mascot-sleep", 92) + '</div>' +
        '<div class="cd-empty-t">Материалов пока нет</div>' +
        '<div class="cd-empty-s">Проверь путь к папке docs в настройке cppDocs.path и нажми «Обновить» ⟳ вверху окна.</div>');
      navListEl.appendChild(emptyBox);
      return;
    }
    var filtering = state.navFilter && state.navFilter !== "all";
    navListEl.classList.toggle("filtering", !!filtering);
    var shown = 0;
    groups.forEach(function (g) {
      var items = filtering ? g.items.filter(navMatch) : g.items;
      if (!items.length) return;                       // при фильтре пустые группы прячем
      shown += items.length;
      var section = el("div", null); section.className = "cd-group";
      if (!filtering && state.collapsed[g.label]) section.classList.add("collapsed");   // при фильтре всё раскрыто
      section.setAttribute("data-group", g.label);
      // Цвет группы доступен всей секции (заголовок + счётчик красятся под него).
      section.style.setProperty("--gcolor", g.color);

      var ghead = el("button", null); ghead.className = "cd-ghead"; ghead.type = "button";
      setHTML(ghead, '<span class="cd-chev">▾</span><span class="cd-gdot"></span><span class="cd-gl"></span><span class="cd-gc"></span>');
      ghead.querySelector(".cd-gl").textContent = g.label;
      var gb = groupBadge(g.label);
      if (gb) {
        var gbImg = el("img", null); gbImg.className = "cd-gbadge"; gbImg.src = gb; gbImg.alt = ""; gbImg.draggable = false;
        var gd = ghead.querySelector(".cd-gdot"); gd.parentNode.replaceChild(gbImg, gd);
      }
      ghead.querySelector(".cd-gc").textContent = filtering ? items.length : g.items.length;
      ghead.addEventListener("click", function () {
        if (filtering) return;                         // при активном фильтре сворачивать нельзя
        // Аккордеон: клик фокусирует группу (открывает её, остальные сворачивает).
        // Повторный клик по единственной открытой группе — сворачивает всё.
        var openLabels = groups.filter(function (gg) { return !state.collapsed[gg.label]; }).map(function (gg) { return gg.label; });
        var onlyThisOpen = openLabels.length === 1 && openLabels[0] === g.label;
        groups.forEach(function (gg) { state.collapsed[gg.label] = true; });
        if (!onlyThisOpen) delete state.collapsed[g.label];
        saveState();
        renderNav();
      });
      section.appendChild(ghead);

      if (g.items.length >= 2) {                        // тонкий прогресс на группе (изучено N из M)
        var gprog = el("div", null); gprog.className = "cd-gprog";
        setHTML(gprog, '<div class="cd-gprog-track"><div class="cd-gprog-fill"></div></div><span class="cd-gprog-lab"></span>');
        section.appendChild(gprog);
      }

      var itemsBox = el("div", null); itemsBox.className = "cd-items";
      items.forEach(function (f) {
        var item = buildItem(f, g);
        itemsBox.appendChild(item);
        itemEls.push(item);
      });
      section.appendChild(itemsBox);
      navListEl.appendChild(section);
    });
    if (filtering && !shown) {                          // фильтр ничего не нашёл
      var none = el("div", null); none.className = "cd-empty";
      setHTML(none, '<div class="cd-empty-t">Ничего под этот фильтр</div>' +
        '<div class="cd-empty-s">Попробуй другой фильтр или «Всё».</div>');
      navListEl.appendChild(none);
    }
    updateProgress();
    updateGroupProgress();
    highlightActive();
  }
  // Тонкая полоска прогресса под заголовком группы: изучено N из M (из данных, а не из DOM, — верно и при фильтре).
  function updateGroupProgress() {
    if (!navListEl) return;
    groupsFromData().forEach(function (g) {
      var sec = navListEl.querySelector('.cd-group[data-group="' + cssEscape(g.label) + '"]');
      if (!sec) return;
      var read = 0; g.items.forEach(function (f) { if (state.read[f.rel]) read++; });
      var total = g.items.length, pct = total ? Math.round((read / total) * 100) : 0;
      var fill = sec.querySelector(".cd-gprog-fill"); if (fill) fill.style.width = pct + "%";
      var lab = sec.querySelector(".cd-gprog-lab"); if (lab) lab.textContent = read + " / " + total;
    });
  }
  function syncFilterChips() {
    if (!filterBarEl) return;
    var chips = filterBarEl.querySelectorAll(".cd-fchip");
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle("on", chips[i].getAttribute("data-filter") === (state.navFilter || "all"));
    }
  }

  // Контекстное меню пункта (правый клик): «тяжёлые» действия, убранные из иконок.
  function showItemMenu(f, x, y) {
    hideItemMenu();
    ctxMenu = el("div", null); ctxMenu.className = "cd-ctxmenu";
    var acts = [
      ["Открыть в новой вкладке", function () { openInTab(f.rel, null, true); }],
      ["Открыть рядом (сплит)", function () { openInSplit(f.rel); toggleSplit(true); }],
      [state.pins[f.rel] ? "Открепить" : "Закрепить", function () { togglePin(f.rel); }],
      [state.read[f.rel] ? "Снять «изучено»" : "Отметить изученным", function () { toggleRead(f.rel); }]
    ];
    acts.forEach(function (a) {
      var b = el("button", null, a[0]); b.type = "button"; b.className = "cd-ctxitem";
      b.addEventListener("click", function () { hideItemMenu(); a[1](); });
      ctxMenu.appendChild(b);
    });
    document.body.appendChild(ctxMenu);
    var r = ctxMenu.getBoundingClientRect();
    var vw = viewW(), vh = window.innerHeight || 800;
    ctxMenu.style.left = Math.max(4, Math.min(x, vw - r.width - 6)) + "px";
    ctxMenu.style.top = Math.max(4, Math.min(y, vh - r.height - 6)) + "px";
  }
  function hideItemMenu() { if (ctxMenu && ctxMenu.parentNode) ctxMenu.parentNode.removeChild(ctxMenu); ctxMenu = null; }
  cdOnGlobal(document, "mousedown", function (e) { if (ctxMenu && !ctxMenu.contains(e.target)) hideItemMenu(); }, true);
  cdOnGlobal(document, "wheel", function () { if (ctxMenu) hideItemMenu(); }, true);
  cdOnGlobal(document, "keydown", function (e) { if (e.key === "Escape") hideItemMenu(); });

  function buildItem(f, g) {
    var item = el("div", null); item.className = "cd-item";
    item.style.setProperty("--gcolor", g.color);
    item.setAttribute("data-rel", f.rel);
    if (state.read[f.rel]) item.classList.add("read");
    if (state.notes[f.rel]) item.classList.add("has-note");

    var titleD = el("div", null, f.title || f.name); titleD.className = "cd-it-title";
    item.appendChild(titleD);
    if (f.subtitle) { var sub = el("div", null, f.subtitle); sub.className = "cd-it-sub"; item.appendChild(sub); }
    var metaParts = [];
    if (f.minutes) metaParts.push("~" + f.minutes + " мин");
    if (f.sections) metaParts.push(f.sections + " " + plural(f.sections, ["раздел", "раздела", "разделов"]));
    if (metaParts.length) { var meta = el("div", null, metaParts.join(" · ")); meta.className = "cd-it-meta"; item.appendChild(meta); }

    var act = el("div", null); act.className = "cd-it-act";
    var readB = el("button", null, state.read[f.rel] ? "✓" : "○");
    readB.className = "cd-a-read" + (state.read[f.rel] ? " on-read" : "");
    readB.title = "Отметить изученным"; readB.type = "button";
    readB.addEventListener("click", function (e) { e.stopPropagation(); toggleRead(f.rel); });
    var pinB = el("button", null, state.pins[f.rel] ? "★" : "☆");
    pinB.className = state.pins[f.rel] ? "on-pin" : "";
    pinB.title = "Закрепить"; pinB.type = "button";
    pinB.addEventListener("click", function (e) { e.stopPropagation(); togglePin(f.rel); });
    // Оставляем у пункта только ○ (прогресс) и ☆ (закрепить). «Открыть в новой вкладке / сплит»
    // переехали в правый клик — так пункт чище (read=кнопка[0], pin=[1] — порядок для toggleRead/togglePin).
    act.appendChild(readB); act.appendChild(pinB);
    item.appendChild(act);

    item.addEventListener("click", function (e) {
      if (searchInput && searchInput.value.trim()) searchJumpTerm = searchInput.value.trim();  // открыли из поиска — прыгнем к слову
      openInTab(f.rel, null, e.ctrlKey || e.metaKey);
    });
    item.addEventListener("auxclick", function (e) { if (e.button === 1) { e.preventDefault(); openInTab(f.rel, null, true); } });
    item.addEventListener("contextmenu", function (e) { e.preventDefault(); showItemMenu(f, e.clientX, e.clientY); });
    // данные для поиска
    var body = f.sx ? f.sx.map(function (x) { return x.t + " " + x.x; }).join(" ") : (f.md || "");
    item._search = norm((f.title || "") + " " + (f.subtitle || "") + " " + (f.name || "") + " " + body.slice(0, 4000));
    return item;
  }

  function highlightActive() {
    itemEls.forEach(function (it) {
      it.classList.toggle("active", !!current && it.getAttribute("data-rel") === current.rel);
    });
  }

  function updateProgress() {
    var d = DATA();
    var total = d ? d.files.length : 0;
    var done = 0;
    if (d) d.files.forEach(function (f) { if (state.read[f.rel]) done++; });
    var pct = total ? Math.round((done / total) * 100) : 0;
    if (fillEl) fillEl.style.width = pct + "%";
    if (ptextEl) ptextEl.textContent = "изучено " + done + " из " + total + " · " + pct + "%";
    if (continueBtn) continueBtn.disabled = done >= total;
    syncLogoRing(done, total);
  }
  // Прогресс поменяли в другом окне VS Code — освежаем то, что его показывает (без пересборки окна).
  function onExternalProgress() {
    _cardSig.t = 0;   // счётчик карточек на кнопке пересчитать
    syncBadge();
    if (!winEl) return;
    renderNav();
    updateProgress();
    syncReadBtn();
    if (winEl.classList.contains("home")) showHome();
  }

  // #10 Микро-праздник: короткий залп искр у элемента + пульс самого элемента.
  // Тактичный (10 частиц, ~0.7 c), глушится при prefers-reduced-motion.
  function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }
  // Наклейка «Изучено!» выпрыгивает над кнопкой на пару секунд (уважает «без анимаций»).
  function popLearned(anchor) {
    try {
      if (!winEl || !anchor || !(typeof STICKERS !== "undefined" && STICKERS && STICKERS["ui-learned"]) || state.noCelebrate || prefersReducedMotion()) return;
      var old = winEl.querySelector(".cd-learned"); if (old) old.remove();
      var img = el("img", null); img.className = "cd-learned"; img.alt = "Изучено!"; img.src = STICKERS["ui-learned"];
      var wr = winEl.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
      if (!ar.width && !ar.height) return;   // кнопка скрыта (главная/свёрнутое окно) — иначе наклейка прыгнет в угол, на шапку
      img.style.left = Math.max(8, ar.left - wr.left + ar.width / 2 - 60) + "px";
      img.style.top = (ar.bottom - wr.top + 6) + "px";
      winEl.appendChild(img);
      setTimeout(function () { if (img.parentNode) img.remove(); }, 2200);
    } catch (e) {}
  }
  function celebrate(anchor, tint) {
    try {
      if (state.noCelebrate || !anchor || !anchor.getBoundingClientRect || prefersReducedMotion()) return;
      var r = anchor.getBoundingClientRect();
      if (!r.width && !r.height) return;
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var colors = tint || ["#a6e3a1", "#f9e2af", "#89b4fa", "#f38ba8", "#cba6f7"];
      var n = 10;
      for (var i = 0; i < n; i++) {
        var s = el("div"); s.className = "cd-spark";
        var ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.6;
        var dist = 26 + Math.random() * 26;
        s.style.left = cx + "px"; s.style.top = cy + "px";
        s.style.background = colors[i % colors.length];
        s.style.setProperty("--dx", (Math.cos(ang) * dist).toFixed(1) + "px");
        s.style.setProperty("--dy", (Math.sin(ang) * dist - 10).toFixed(1) + "px");
        s.style.setProperty("--dr", Math.round(Math.random() * 220 - 110) + "deg");
        document.body.appendChild(s);
        (function (node) { setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 720); })(s);
      }
    } catch (e) {}
  }
  function pulse(elm) {
    if (state.noCelebrate || !elm || !elm.classList || prefersReducedMotion()) return;
    elm.classList.remove("cd-pulse"); void elm.offsetWidth; elm.classList.add("cd-pulse");
    setTimeout(function () { if (elm.classList) elm.classList.remove("cd-pulse"); }, 440);
  }

  function toggleRead(rel) {
    if (state.read[rel]) delete state.read[rel]; else state.read[rel] = true;
    recordActivity();
    saveState();
    var it = itemEls.filter(function (x) { return x.getAttribute("data-rel") === rel; })[0];
    if (it) {
      it.classList.toggle("read", !!state.read[rel]);
      var b = it.querySelector(".cd-it-act button");
      if (b) { b.textContent = state.read[rel] ? "✓" : "○"; b.className = "cd-a-read" + (state.read[rel] ? " on-read" : ""); }
    }
    if (current && current.rel === rel) syncReadBtn();
    updateProgress();
    syncNextBtn();
    updateGroupProgress();
    // Праздник только при постановке отметки (не при снятии).
    if (state.read[rel]) {
      // readBtn — только если его видно: на главной он скрыт, и праздник надо показать у пункта списка.
      var anc = (current && current.rel === rel && readBtn && readBtn.offsetWidth) ? readBtn : it;
      if (anc) { celebrate(anc); pulse(anc); }
      if (anc === readBtn) popLearned(readBtn);
    }
  }
  function togglePin(rel) {
    if (state.pins[rel]) delete state.pins[rel]; else state.pins[rel] = true;
    saveState();
    var it = itemEls.filter(function (x) { return x.getAttribute("data-rel") === rel; })[0];
    if (it) {
      var b = it.querySelectorAll(".cd-it-act button")[1];
      if (b) { b.textContent = state.pins[rel] ? "★" : "☆"; b.className = state.pins[rel] ? "on-pin" : ""; }
    }
  }
  function syncReadBtn() {
    refreshBoss();   // босс темы открывается отметкой «Изучено»
    if (!readBtn || !current) return;
    var on = !!state.read[current.rel];
    setHTML(readBtn, uiLabel(on ? "read-on" : "read-off", on ? "✓" : "○", "Изучено"));
    readBtn.classList.toggle("on", on);
  }

  function openNextUnread() {
    var d = DATA(); if (!d) return;
    var next = d.files.filter(function (f) { return !state.read[f.rel]; })[0];
    if (next) openFile(next.rel);
  }

  // ------- поиск: сниппеты и переход к найденному -------
  // Фрагмент вокруг совпадения с подсветкой <mark>. Индексы берём из norm (он длину сохраняет).
  function makeSnippet(text, q) {
    var low = norm(text), idx = low.indexOf(q);
    if (idx < 0) return escapeHtml(String(text).slice(0, 120));
    var start = Math.max(0, idx - 45), end = Math.min(text.length, idx + q.length + 80);
    return (start > 0 ? "…" : "") + escapeHtml(text.slice(start, idx)) +
      "<mark>" + escapeHtml(text.slice(idx, idx + q.length)) + "</mark>" +
      escapeHtml(text.slice(idx + q.length, end)) + (end < text.length ? "…" : "");
  }
  // Ищем q в теле материала: возвращаем сниппет + раздел (текст и slug ближайшего заголовка),
  // чтобы показать, ГДЕ нашлось, и открыть на этом месте. Блоки кода пропускаем (шум).
  function searchHit(f, q) {
    // Индекс от расширения (f.sx: проза по разделам) — без разбора markdown на каждое нажатие;
    // нормализованный текст раздела считаем один раз и держим рядом.
    if (f.sx && f.sx.length) {
      for (var si = 0; si < f.sx.length; si++) {
        var sec = f.sx[si];
        if (sec._n == null) sec._n = norm(sec.x);
        var k = sec._n.indexOf(q);
        if (k < 0) continue;
        var st = sec.x.lastIndexOf("\n", k - 1) + 1, en = sec.x.indexOf("\n", k);
        if (en < 0) en = sec.x.length;
        return { slug: sec.s, sec: sec.t, snippet: makeSnippet(sec.x.slice(st, en), q) };
      }
      if (norm((f.title || "") + " " + (f.subtitle || "") + " " + (f.name || "")).indexOf(q) !== -1)
        return { slug: "", sec: "", snippet: escapeHtml(f.subtitle || f.title || f.name || "") };
      return null;
    }
    var lines = String(f.md || "").replace(/\r\n?/g, "\n").split("\n");
    var slug = "", secText = "", inFence = false;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (ln.trim().slice(0, 3) === "```") { inFence = !inFence; continue; }
      if (inFence) continue;
      var hm = ln.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
      if (hm) { secText = hm[2].replace(/[`*]/g, "").trim(); slug = slugify(hm[2]); continue; }
      var plain = ln.replace(/[#>*`|\[\]()]/g, " ").replace(/\s{2,}/g, " ").trim();  // НЕ трогаем _: важен для идентификаторов (push_back)
      if (plain && norm(plain).indexOf(q) !== -1) return { slug: slug, sec: secText, snippet: makeSnippet(plain, q) };
    }
    if (norm((f.title || "") + " " + (f.subtitle || "") + " " + (f.name || "")).indexOf(q) !== -1)
      return { slug: "", sec: "", snippet: escapeHtml(f.subtitle || f.title || f.name || "") };
    return null;
  }
  // После открытия материала из поиска: подсветить слово и прыгнуть к первому совпадению.
  function consumeSearchJump() {
    if (!searchJumpTerm || !findInput) { searchJumpTerm = ""; return; }
    var t = String(searchJumpTerm).split(/\s+/)[0];   // многословный запрос — ведём по первому слову
    searchJumpTerm = "";
    if (!t) return;
    findInput.value = t;
    toggleFind(true);   // откроет панель поиска, подсветит и прокрутит к первому совпадению
  }

  // ------- поиск -------
  function wireSearch() {
    var xBtn = winEl.querySelector(".cd-sx");
    var timer;
    searchInput.addEventListener("input", function () {
      clearTimeout(timer); timer = setTimeout(applySearch, 90);
      xBtn.style.display = searchInput.value ? "block" : "none";
    });
    xBtn.addEventListener("click", function () { searchInput.value = ""; xBtn.style.display = "none"; applySearch(); searchInput.focus(); });
  }
  function applySearch() {
    var q = norm(searchInput.value.trim());
    var tokens = q ? q.split(/ +/) : [];
    var anyGroupVisible = {};
    itemEls.forEach(function (it) {
      var hit = !tokens.length || tokens.every(function (t) { return it._search.indexOf(t) >= 0; });
      it.style.display = hit ? "" : "none";
      if (hit) anyGroupVisible[it.closest(".cd-group").getAttribute("data-group")] = true;
    });
    // Свернуть/показать группы: при поиске раскрываем все, где есть совпадения.
    winEl.querySelectorAll(".cd-group").forEach(function (sec) {
      var name = sec.getAttribute("data-group");
      if (tokens.length) {
        sec.style.display = anyGroupVisible[name] ? "" : "none";
        sec.classList.toggle("collapsed", false);
      } else {
        sec.style.display = "";
        sec.classList.toggle("collapsed", !!state.collapsed[name]);
      }
    });
    // «Ничего не найдено»
    if (noResultEl) {
      var anyVisible = itemEls.some(function (it) { return it.style.display !== "none"; });
      if (tokens.length && !anyVisible) {
        setHTML(noResultEl, '<div class="cd-empty-art">' + stickerMarkup("mascot-search", 92) + '</div>' +
          "Ничего не найдено по запросу<br><b>«" + escapeHtml(searchInput.value.trim()) + "»</b>");
        noResultEl.style.display = "block";
      } else {
        noResultEl.style.display = "none";
      }
    }
  }

  // ------- боковое оглавление (рейка со слежением за прокруткой) -------
  function isOutlineOn() { return state.outline !== false; }   // по умолчанию включено
  function wireTocButton() {
    tocBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (winEl && winEl.classList.contains("narrow")) {   // узко: рейка всплывает поверх текста
        winEl.classList.toggle("ol-peek");
        if (tocBtn) tocBtn.classList.toggle("act", winEl.classList.contains("ol-peek"));
        return;
      }
      state.outline = !isOutlineOn();
      saveState();
      applyReaderPrefs();
    });
  }
  function buildOutline(headings) {
    if (!outlineEl) return;
    outlineEl.textContent = "";
    if (!headings.length) {
      outlineEl.appendChild(el("div", "padding:6px 10px;color:var(--faint);font-size:11px;", "Нет разделов"));
      return;
    }
    outlineEl.appendChild(el("div", "font-size:10px;text-transform:uppercase;letter-spacing:.8px;font-weight:800;color:var(--faint);padding:2px 10px 6px;", "На странице"));
    headings.forEach(function (h) {
      var b = el("button", null, h.text); b.type = "button";
      b.className = "cd-ol" + (h.level === 3 ? " lvl3" : "") + (h.major ? " major" : "");
      b.setAttribute("data-slug", h.slug);
      b.addEventListener("click", function () {
        var t = articleEl.querySelector('[id="' + cssEscape(h.slug) + '"]');
        if (t) { unfoldContaining(t); t.scrollIntoView({ block: "start" }); flashHeading(t); }
      });
      outlineEl.appendChild(b);
    });
    syncOutlineSeen();
  }
  // Прогресс внутри темы: разделы, которые ты прокрутил (заголовок ушёл выше), отмечаются ✓ в «На странице».
  function markSectionsSeen(active) {
    if (!current || !active) return;
    var rel = current.rel, seen = state.secSeen[rel] || (state.secSeen[rel] = {}), added = false;
    for (var i = 0; i < curHeadings.length; i++) {
      var h = curHeadings[i];
      if (h === active) break;
      if (!seen[h.slug]) { seen[h.slug] = 1; added = true; }
    }
    // дочитал до конца — последний раздел тоже засчитываем
    if (contentEl && contentEl.scrollTop + contentEl.clientHeight >= contentEl.scrollHeight - 40 && !seen[active.slug]) { seen[active.slug] = 1; added = true; }
    if (added) { saveState(); syncOutlineSeen(); }
  }
  function syncOutlineSeen() {
    if (!outlineEl || !current) return;
    var seen = state.secSeen[current.rel] || {};
    outlineEl.querySelectorAll(".cd-ol").forEach(function (b) { b.classList.toggle("seen", !!seen[b.getAttribute("data-slug")]); });
  }
  function markOutlineActive(slug) {
    if (!outlineEl) return;
    var active = null;
    outlineEl.querySelectorAll(".cd-ol").forEach(function (b) {
      var on = b.getAttribute("data-slug") === slug;
      b.classList.toggle("active", on);
      if (on) active = b;
    });
    // держим активный пункт в поле зрения рейки
    if (active && outlineEl.scrollHeight > outlineEl.clientHeight) {
      var oR = outlineEl.getBoundingClientRect(), bR = active.getBoundingClientRect();
      if (bR.top < oR.top + 8 || bR.bottom > oR.bottom - 8) active.scrollIntoView({ block: "nearest" });
    }
  }
  function cssEscape(s) {
    // Экранируем id для селектора (у нас кириллица/цифры/дефисы; хватит экранирования кавычек).
    return String(s).replace(/["\\]/g, "\\$&");
  }

  // ------- прогресс чтения, память позиции, активный раздел (крошки) -------
  function collectHeadings() {
    curHeadings = [];
    if (!articleEl) return;
    articleEl.querySelectorAll("h1[id],h2[id],h3[id]").forEach(function (h) {
      if (h.classList.contains("cd-winhide")) return;   // «Что в этом файле» в окне спрятан
      curHeadings.push({ el: h, slug: h.id, text: h.getAttribute("data-title") || h.textContent });
    });
  }

  // ------- сворачивание разделов (## ) прямо в читалке -------
  // Клик по заголовку раздела скрывает его содержимое до следующего ## — длинный
  // материал становится обозримым. Состояние живёт в пределах открытой страницы
  // (перерисовка разворачивает всё заново). Заголовки задач (cd-task) не трогаем.
  function foldSectionEls(h2) {
    var out = [], n = h2.nextElementSibling;
    while (n && n.tagName !== "H2") { out.push(n); n = n.nextElementSibling; }
    return out;
  }
  function setFold(h2, folded) {
    h2.classList.toggle("cd-sec-folded", folded);
    foldSectionEls(h2).forEach(function (node) { node.classList.toggle("cd-fold-hidden", folded); });
  }
  function wireFolding() {
    if (!articleEl) return;
    articleEl.querySelectorAll("h2[id]").forEach(function (h2) {
      if (h2.classList.contains("cd-task") || h2.querySelector(".cd-fold-caret")) return;
      var caret = el("span", null, "▾"); caret.className = "cd-fold-caret"; caret.setAttribute("aria-hidden", "true");
      h2.insertBefore(caret, h2.firstChild);
      h2.classList.add("cd-foldable");
    });
  }
  // Раздел, которому принадлежит элемент, развернуть (чтобы переход по оглавлению/
  // ссылке не упирался в скрытый якорь).
  function unfoldContaining(target) {
    if (!target || !articleEl) return;
    var node = target;
    while (node && node.parentElement && node.parentElement !== articleEl) node = node.parentElement;
    if (secMode && node && node.hasAttribute && node.hasAttribute("data-sec")) showSection(+node.getAttribute("data-sec"), true);
    var p = node;
    while (p) { if (p.tagName === "H2") { if (p.classList.contains("cd-sec-folded")) setFold(p, false); return; } p = p.previousElementSibling; }
  }
  // ------- режим «по разделам»: длинная тема показывается по одному разделу ## за раз -------
  // Включается в Настройках («Длинные темы: по разделам»). Работает, если в теме ≥ 4 разделов.
  // Вводная часть до первого ## идёт вместе с первым разделом; блоки конца статьи (заметки,
  // «Смотри также», «Предыдущая / Следующая») — вместе с последним.
  var secMode = false, secCount = 0, secIdx = 0, secTag = "H2";
  var SEC_TAIL = { "cd-notes": 1, "cd-seealso": 1, "cd-rn-done": 1, "cd-routenav": 1 };
  function secTitle(h) { return (h.getAttribute("data-title") || h.textContent).replace(/^▾/, "").replace(/[☆★#]+$/g, "").trim(); }
  function setupSections() {
    secMode = false; secCount = 0; secIdx = 0;
    if (!articleEl) return;
    var kids = Array.prototype.slice.call(articleEl.children);
    if (!state.bySection) return;
    // делим по ##, а если их мало (тема из одного большого раздела, как «Функции») — по ###
    var pick = function (tag) { return kids.filter(function (n) { return n.tagName === tag && !n.classList.contains("cd-winhide") && !n.classList.contains("cd-task"); }); };
    var h2s = pick("H2");
    if (h2s.length < 4) h2s = pick("H3");
    if (h2s.length < 4) return;
    secTag = h2s[0].tagName;
    secMode = true; secCount = h2s.length;
    var idx = 0, seenH2 = false;
    kids.forEach(function (n) {
      if (h2s.indexOf(n) >= 0) { if (seenH2) idx++; seenH2 = true; }
      var tail = false;
      for (var c in SEC_TAIL) if (n.classList.contains(c)) tail = true;
      n.setAttribute("data-sec", tail ? String(secCount - 1) : String(idx));
    });
    var bar = el("div", null); bar.className = "cd-secbar";
    setHTML(bar, '<button type="button" class="cd-secb" data-d="-1" title="Предыдущий раздел">‹</button>' +
      '<span class="cd-sect"></span><span class="cd-secp"><i></i></span>' +
      '<button type="button" class="cd-secb" data-d="1" title="Следующий раздел">›</button>');
    articleEl.insertBefore(bar, articleEl.firstChild);
    var nextB = el("button", null); nextB.type = "button"; nextB.className = "cd-secnext"; nextB.setAttribute("data-d", "1");
    // кнопка — в конце раздела, т. е. перед хвостом статьи
    var tailStart = articleEl.querySelector(":scope > .cd-notes, :scope > .cd-seealso, :scope > .cd-rn-done, :scope > .cd-routenav");
    articleEl.insertBefore(nextB, tailStart || null);
    [bar, nextB].forEach(function (b) {
      b.addEventListener("click", function (e) {
        var t = e.target.closest && e.target.closest("[data-d]"); if (!t) return;
        showSection(secIdx + (+t.getAttribute("data-d")));
      });
    });
    showSection(0, true);
  }
  function showSection(i, keepScroll) {
    if (!secMode || !articleEl) return;
    i = clamp(i, 0, secCount - 1);
    secIdx = i;
    var title = "";
    Array.prototype.forEach.call(articleEl.children, function (n) {
      if (!n.hasAttribute("data-sec")) return;
      var on = +n.getAttribute("data-sec") === i;
      n.classList.toggle("cd-secoff", !on);
      if (on && n.tagName === secTag && !title && !n.classList.contains("cd-winhide")) title = secTitle(n);
    });
    var bar = articleEl.querySelector(".cd-secbar");
    if (bar) {
      bar.querySelector(".cd-sect").textContent = "Раздел " + (i + 1) + " из " + secCount + (title ? " · " + title : "");
      bar.querySelector(".cd-secp i").style.width = Math.round((i + 1) / secCount * 100) + "%";
      bar.querySelector('[data-d="-1"]').disabled = i === 0;
      bar.querySelector('[data-d="1"]').disabled = i === secCount - 1;
    }
    var nb = articleEl.querySelector(".cd-secnext");
    if (nb) {
      nb.hidden = i === secCount - 1;
      var nx = null;
      articleEl.querySelectorAll(secTag.toLowerCase() + '[data-sec="' + (i + 1) + '"]').forEach(function (h) { if (!nx && !h.classList.contains("cd-winhide")) nx = h; });
      nb.textContent = "Следующий раздел →" + (nx ? "  " + secTitle(nx) : "");
    }
    if (!keepScroll && contentEl) contentEl.scrollTop = 0;
    onContentScroll();
  }

  var _scrollSaveTimer = null;
  function onContentScroll() {
    if (!contentEl) return;
    var max = contentEl.scrollHeight - contentEl.clientHeight;
    var pct = max > 0 ? contentEl.scrollTop / max : 0;
    if (rprogFill) rprogFill.style.width = Math.round(clamp(pct, 0, 1) * 100) + "%";
    if (toTopBtn) toTopBtn.hidden = contentEl.scrollTop < 400;
    scheduleActiveHeading();   // тяжёлый обход getBoundingClientRect — не чаще кадра
    if (current) {
      clearTimeout(_scrollSaveTimer);
      _scrollSaveTimer = setTimeout(function () {
        if (current && contentEl) { state.scroll[current.rel] = contentEl.scrollTop; saveState(); }
      }, 260);
    }
  }
  // Скролл сыплет событиями по многу в секунду, а updateActiveHeading обходит все заголовки
  // с getBoundingClientRect (принудительный reflow). Схлопываем до одного вызова на кадр.
  var _headingRaf = false;
  function scheduleActiveHeading() {
    if (_headingRaf) return;
    _headingRaf = true;
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    raf(function () { _headingRaf = false; updateActiveHeading(); });
  }
  function updateActiveHeading() {
    if (!crumbEl) return;
    if (winEl && winEl.classList.contains("home")) { if (crumbEl.textContent) crumbEl.textContent = ""; if (secProgEl) secProgEl.hidden = true; return; }   // на главной крошки нет
    if (!curHeadings.length) { if (crumbEl.textContent) crumbEl.textContent = ""; if (secProgEl) secProgEl.hidden = true; return; }
    var cTop = contentEl.getBoundingClientRect().top;
    var active = null;
    for (var i = 0; i < curHeadings.length; i++) {
      if (secMode && !curHeadings[i].el.offsetParent) continue;   // режим «по разделам»: чужие разделы скрыты
      if (curHeadings[i].el.getBoundingClientRect().top - cTop <= 44) active = curHeadings[i]; else break;
    }
    var txt = active ? active.text : "";
    if (crumbEl.textContent !== txt) crumbEl.textContent = txt;
    crumbEl.setAttribute("data-slug", active ? active.slug : "");
    crumbEl.title = txt ? "К началу раздела «" + txt + "»" : "";
    if (rnameEl && current) rnameEl.title = (current.title || current.name) + " — к началу темы";
    markSectionsSeen(active);
    syncSecProg(active);
    syncNextBtn();   // «Задача N.M» в шапке зависит от того, до куда дочитано
    if (typeof markOutlineActive === "function") markOutlineActive(active ? active.slug : null);
  }
  // Прогресс по разделам темы в крошках: номер текущего ## из всех и точки — прочитанные
  // (прокрученные) разделы закрашены, текущий обведён. Больше 12 разделов — вместо точек полоска.
  function syncSecProg(active) {
    if (!secProgEl) return;
    var secs = curHeadings.filter(function (h) { return h.el.tagName === "H2"; });
    if (!current || secs.length < 2 || (winEl && winEl.classList.contains("home"))) { secProgEl.hidden = true; return; }
    var seen = state.secSeen[current.rel] || {}, idx = -1, read = 0;
    var activeTop = active ? active.el : null;
    for (var i = 0; i < curHeadings.length && activeTop; i++) {   // активный ### — считаем его родительский ##
      if (curHeadings[i].el.tagName === "H2") idx = secs.indexOf(curHeadings[i]);
      if (curHeadings[i] === active) break;
    }
    var dots = "";
    secs.forEach(function (h, j) {
      if (seen[h.slug]) read++;
      if (secs.length <= 12) dots += '<i class="' + (seen[h.slug] ? "r" : "") + (j === idx ? " cur" : "") + '"></i>';
    });
    var html = '<b>' + (idx >= 0 ? idx + 1 : 0) + "/" + secs.length + "</b>" +
      (dots ? '<span class="cd-sp-dots">' + dots + "</span>" : '<span class="cd-sp-bar"><i style="width:' + Math.round(read / secs.length * 100) + '%"></i></span>');
    if (secProgEl.innerHTML !== html) setHTML(secProgEl, html);
    secProgEl.title = "Раздел " + (idx + 1) + " из " + secs.length + " · прочитано " + read;
    secProgEl.hidden = false;
  }
  function flashHeading(node) {
    if (!node) return;
    node.classList.remove("cd-flash"); void node.offsetWidth; node.classList.add("cd-flash");
    setTimeout(function () { try { node.classList.remove("cd-flash"); } catch (e) {} }, 1200);
  }

  // ==== runtime/08-view.js — меню настроек, подсказки-термины, история, маршрут ====
  // ------- настройки: окно поверх окна документации, с вкладками -------
  function wireViewMenu() {
    if (winEl && viewMenu.parentNode !== winEl) winEl.appendChild(viewMenu);
    buildViewMenu();
    viewBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (viewMenu.hidden) openSettings(); else viewMenu.hidden = true;
    });
    // клик по затемнению вокруг карточки — закрыть
    viewMenu.addEventListener("mousedown", function (e) { if (e.target === viewMenu) viewMenu.hidden = true; });
  }
  function openSettings(tab) {
    if (!viewMenu) return;
    buildViewMenu();                                  // картинки палитр и отметки — свежие
    if (tab) showSetTab(tab);
    viewMenu.hidden = false;
    try { var c = viewMenu.querySelector(".cd-set-x"); if (c) c.focus(); } catch (e) {}
  }
  var setTab = "look";
  function showSetTab(k) {
    setTab = k;
    viewMenu.querySelectorAll(".cd-set-tab").forEach(function (b) {
      var on = b.getAttribute("data-tab") === k;
      b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false");
    });
    viewMenu.querySelectorAll(".cd-set-page").forEach(function (pg) { pg.hidden = pg.getAttribute("data-tab") !== k; });
  }
  function segRow(label, buttons) {
    // 3+ кнопок (или длинные подписи) не влезают в строку — кладём контрол под подпись на всю ширину.
    var row = el("div", null); row.className = "cd-vm-row" + (buttons.length >= 3 || label.length > 9 ? " stack" : "");
    var lbl = el("span", null, label); lbl.className = "cd-vm-lbl"; row.appendChild(lbl);
    var seg = el("div", null); seg.className = "cd-seg";
    buttons.forEach(function (b) { seg.appendChild(b); });
    row.appendChild(seg);
    return row;
  }
  // Пейзаж палитры для карточки (та же картинка, что на главной); файла нет — null.
  function palThumb(k) {
    var d = DATA(), dir = (d && d.extDirUrl) || bootVal("extDirUrl");
    var have = (d && Array.isArray(d.bgImages)) ? d.bgImages : [];
    var name = have.indexOf("bg-" + k + ".webp") !== -1 ? "bg-" + k + ".webp" : (have.indexOf("bg-default.webp") !== -1 ? "bg-default.webp" : "");
    return dir && name ? resUrl(String(dir).replace(/\/+$/, "") + "/" + name) : null;
  }
  function buildViewMenu() {
    viewMenu.textContent = "";
    // шрифт
    var minus = el("button", null, "A−"); minus.type = "button"; minus.title = "Меньше";
    var val = el("button", null, ""); val.type = "button"; val.disabled = true; val.style.cursor = "default";
    var plus = el("button", null, "A+"); plus.type = "button"; plus.title = "Больше";
    function showFs() { val.textContent = Math.round((state.fs || 1) * 100) + "%"; }
    function stepFs(d) { state.fs = clamp(Math.round(((state.fs || 1) + d) * 10) / 10, 0.8, 1.6); saveState(); applyReaderPrefs(); showFs(); }
    minus.addEventListener("click", function () { stepFs(-0.1); });
    plus.addEventListener("click", function () { stepFs(0.1); });
    showFs();
    var rowFont = segRow("Размер текста", [minus, val, plus]);
    // ширина
    var wN = el("button", null, "Уже"); var wW = el("button", null, "Шире");
    wN.type = "button"; wW.type = "button";
    function showW() { wN.classList.toggle("on", !state.wide); wW.classList.toggle("on", !!state.wide); }
    wN.addEventListener("click", function () { state.wide = false; saveState(); applyReaderPrefs(); showW(); });
    wW.addEventListener("click", function () { state.wide = true; saveState(); applyReaderPrefs(); showW(); });
    showW();
    var rowWidth = segRow("Ширина", [wN, wW]);
    // межстрочный интервал
    var lhT = el("button", null, "Плотнее"); var lhN = el("button", null, "Обычный"); var lhR = el("button", null, "Просторнее");
    lhT.type = "button"; lhN.type = "button"; lhR.type = "button";
    function showLh() { lhT.classList.toggle("on", state.lh === "tight"); lhN.classList.toggle("on", state.lh !== "tight" && state.lh !== "roomy"); lhR.classList.toggle("on", state.lh === "roomy"); }
    lhT.addEventListener("click", function () { state.lh = "tight"; saveState(); applyReaderPrefs(); showLh(); });
    lhN.addEventListener("click", function () { state.lh = "normal"; saveState(); applyReaderPrefs(); showLh(); });
    lhR.addEventListener("click", function () { state.lh = "roomy"; saveState(); applyReaderPrefs(); showLh(); });
    showLh();
    var rowInterval = segRow("Интервал", [lhT, lhN, lhR]);
    // размер шрифта кода — отдельно от прозы (на ноутбуке 12.5 px мелковато)
    var cMinus = el("button", null, "A−"); cMinus.type = "button"; cMinus.title = "Код мельче";
    var cVal = el("button", null, ""); cVal.type = "button"; cVal.disabled = true; cVal.style.cursor = "default";
    var cPlus = el("button", null, "A+"); cPlus.type = "button"; cPlus.title = "Код крупнее";
    function showCfs() { cVal.textContent = (state.codeFs || 12.5) + " px"; }
    function stepCfs(d) { state.codeFs = clamp((state.codeFs || 12.5) + d, 11, 17); if (state.codeFs === 12.5) state.codeFs = 0; saveState(); applyReaderPrefs(); showCfs(); }
    cMinus.addEventListener("click", function () { stepCfs(-0.5); });
    cPlus.addEventListener("click", function () { stepCfs(0.5); });
    showCfs();
    var rowCodeFs = segRow("Размер кода", [cMinus, cVal, cPlus]);
    // режим фокуса: скрыть навигацию и оглавление, оставить только текст
    var fcOn = el("button", null, "Вкл"); var fcOff = el("button", null, "Выкл");
    fcOn.type = "button"; fcOff.type = "button";
    fcOn.title = "Спрятать список слева и оглавление справа — только текст"; fcOff.title = "Показывать навигацию и оглавление";
    function showFocus() { fcOn.classList.toggle("on", !!state.focus); fcOff.classList.toggle("on", !state.focus); }
    fcOn.addEventListener("click", function () { state.focus = true; saveState(); applyReaderPrefs(); showFocus(); });
    fcOff.addEventListener("click", function () { state.focus = false; saveState(); applyReaderPrefs(); showFocus(); });
    showFocus();
    var rowFocus = segRow("Фокус", [fcOn, fcOff]);
    // прозрачность, пока курсор не на окне — чтобы не мешало писать код (наведёшь — снова чёткое)
    var gOff = el("button", null, "Выкл"); var gSoft = el("button", null, "Слегка"); var gStrong = el("button", null, "Сильно");
    gOff.type = "button"; gSoft.type = "button"; gStrong.type = "button";
    gSoft.title = "Окно слегка прозрачное, пока на нём нет курсора"; gStrong.title = "Окно сильно прозрачное, пока на нём нет курсора";
    function showGhost() { gOff.classList.toggle("on", state.ghost !== "soft" && state.ghost !== "strong"); gSoft.classList.toggle("on", state.ghost === "soft"); gStrong.classList.toggle("on", state.ghost === "strong"); }
    gOff.addEventListener("click", function () { state.ghost = "off"; saveState(); applyReaderPrefs(); showGhost(); });
    gSoft.addEventListener("click", function () { state.ghost = "soft"; saveState(); applyReaderPrefs(); showGhost(); });
    gStrong.addEventListener("click", function () { state.ghost = "strong"; saveState(); applyReaderPrefs(); showGhost(); });
    showGhost();
    var rowGhost = segRow("Прозрачность", [gOff, gSoft, gStrong]);
    // плотность списка
    var dN = el("button", null, "Просторно"); var dD = el("button", null, "Плотно");
    dN.type = "button"; dD.type = "button";
    function showD() { dN.classList.toggle("on", !state.dense); dD.classList.toggle("on", !!state.dense); }
    dN.addEventListener("click", function () { state.dense = false; saveState(); applyReaderPrefs(); showD(); });
    dD.addEventListener("click", function () { state.dense = true; saveState(); applyReaderPrefs(); showD(); });
    showD();
    var rowList = segRow("Список", [dN, dD]);
    // разборы: свернуть/развернуть разом все «Разбор»/«Копнуть глубже» (режим «только основное»)
    var eN = el("button", null, "Свёрнуты"); var eE = el("button", null, "Развёрнуты");
    eN.type = "button"; eE.type = "button";
    eN.title = "Только основное: разборы под кодом свёрнуты";
    eE.title = "Показывать все разборы раскрытыми";
    function showE() { eN.classList.toggle("on", !state.expandNotes); eE.classList.toggle("on", !!state.expandNotes); }
    eN.addEventListener("click", function () { state.expandNotes = false; saveState(); applyExpandNotes(); showE(); });
    eE.addEventListener("click", function () { state.expandNotes = true; saveState(); applyExpandNotes(); showE(); });
    showE();
    var rowNotes = segRow("Разборы", [eN, eE]);
    // подсказки-термины при наведении
    var hN = el("button", null, "Выкл"); var hY = el("button", null, "Вкл");
    hN.type = "button"; hY.type = "button";
    hN.title = "Не подчёркивать термины"; hY.title = "Подчёркивать термины, определение при наведении";
    function showH() { hY.classList.toggle("on", !!state.termHints); hN.classList.toggle("on", !state.termHints); }
    hY.addEventListener("click", function () { state.termHints = true; saveState(); showH(); if (current) openFile(current.rel, null, true); });
    hN.addEventListener("click", function () { state.termHints = false; saveState(); showH(); if (current) openFile(current.rel, null, true); });
    showH();
    var rowHints = segRow("Подсказки", [hN, hY]);
    // анимации окна
    var aOn = el("button", null, "Вкл"); var aOff = el("button", null, "Выкл");
    aOn.type = "button"; aOff.type = "button";
    function showA() { aOn.classList.toggle("on", !state.noAnim); aOff.classList.toggle("on", !!state.noAnim); }
    aOn.addEventListener("click", function () { state.noAnim = false; saveState(); applyReaderPrefs(); showA(); });
    aOff.addEventListener("click", function () { state.noAnim = true; saveState(); applyReaderPrefs(); showA(); });
    showA();
    var rowAnim = segRow("Анимации", [aOn, aOff]);
    // тема окна: авто (под VS Code) / светлая / тёмная / сепия
    var tA = el("button", null, "Авто"); var tL = el("button", null, "Светлая"); var tD = el("button", null, "Тёмная"); var tSep = el("button", null, "Сепия");
    tA.type = "button"; tL.type = "button"; tD.type = "button"; tSep.type = "button";
    tSep.title = "Тёплый «бумажный» фон — мягче для глаз";
    [[tA, "auto"], [tL, "light"], [tD, "dark"], [tSep, "sepia"]].forEach(function (p) {   // мини-окно темы на кнопке
      var mini = el("span", null); mini.className = "cd-th-mini th-" + p[1];
      setHTML(mini, "<i></i><i></i><i></i>"); p[0].insertBefore(mini, p[0].firstChild); p[0].classList.add("cd-th-btn");
    });
    function showT() {
      tA.classList.toggle("on", state.theme === "auto");
      tL.classList.toggle("on", state.theme === "light");
      tD.classList.toggle("on", state.theme === "dark");
      tSep.classList.toggle("on", state.theme === "sepia");
    }
    function setTheme(v) { state.theme = v; saveState(); applyThemeClasses(); applyAccent(); showT(); }
    tA.addEventListener("click", function () { setTheme("auto"); });
    tL.addEventListener("click", function () { setTheme("light"); });
    tD.addEventListener("click", function () { setTheme("dark"); });
    tSep.addEventListener("click", function () { setTheme("sepia"); });
    showT();
    var rowTheme = segRow("Тема", [tA, tL, tD, tSep]);
    // палитра: «как в редакторе» или готовый набор (фон + акцент + цвета кода)
    var rowPal = el("div", null); rowPal.className = "cd-vm-row stack cards";
    var palLbl = el("span", null, "Палитра"); palLbl.className = "cd-vm-lbl"; rowPal.appendChild(palLbl);
    var palGrid = el("div", null); palGrid.className = "cd-pal-grid"; rowPal.appendChild(palGrid);
    var palBtns = [];
    ["auto"].concat(Object.keys(PALETTES)).forEach(function (k) {
      var P = PALETTES[k];
      var b = el("button", null); b.type = "button"; b.className = "cd-pal";
      // карточка: пейзаж палитры (если есть) + точки её цветов + имя
      var th = el("span", null); th.className = "cd-pal-th";
      var img = palThumb(k);
      th.style.backgroundImage = img ? "url(" + img + ")" : (P ? "linear-gradient(135deg," + P.bg + " 40%," + P.ac + " 75%," + P.glow + ")"
        : "linear-gradient(135deg,#1e1e2e 40%,var(--cppdocs-ac,#89b4fa) 80%)");
      var dots = el("span", null); dots.className = "cd-pal-dots";
      (P ? [P.ac, P.glow, P.ts, P.tn] : ["var(--cppdocs-ac,#89b4fa)"]).forEach(function (c) { var i = el("i", null); i.style.background = c; dots.appendChild(i); });
      th.appendChild(dots);
      b.appendChild(th);
      var nm = el("span", null, P ? P.name : "Как в редакторе"); nm.className = "cd-pal-nm"; b.appendChild(nm);
      b.title = P ? "Фон, акцент и подсветка кода «" + P.name + "»" : "Акцент из темы VS Code / обоев custom-bg";
      b.setAttribute("data-pal", k);
      b.addEventListener("click", function () {
        state.palette = k; saveState(); applyThemeClasses(); applyAccent();
        // значки ui-* могут иметь свой вариант под палитру — перерисуем то, что на экране
        if (winEl.classList.contains("home")) buildHome(); else if (current) openFile(current.rel, null, true);
        buildSky();
        showHb();                                   // у новой палитры своя картинка фона (или её нет)
        syncReviewBell();
        palBtns.forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-pal") === k); });
      });
      b.classList.toggle("on", (state.palette || "auto") === k);
      palBtns.push(b); palGrid.appendChild(b);
    });
    var palNote = el("div", null, "В светлой теме и сепии палитра меняет только акцент. Картинка — фон главной (режим «Пейзаж»)."); palNote.className = "cd-pal-note";
    rowPal.appendChild(palNote);
    // фон главной: пейзаж под палитру / звёздное небо прогресса / без рисунка
    var hbI = el("button", null, "Пейзаж"), hbS = el("button", null, "Звёзды"), hbN = el("button", null, "Пусто");
    hbI.type = hbS.type = hbN.type = "button";
    hbI.title = "Статичная картинка под палитру (если её нет — звёзды)";
    hbS.title = "Звёздное небо прогресса: изученные темы горят";
    // Картинок bg-*.webp может не быть (их кладут отдельно) — тогда «Пейзаж» прячем: он выглядел бы как «Звёзды».
    function showHb() {
      var hasImg = !!homeBgImage(), m = state.homeBg === "image" && !hasImg ? "stars" : state.homeBg;
      hbI.hidden = !hasImg;
      hbI.classList.toggle("on", m === "image"); hbS.classList.toggle("on", m === "stars"); hbN.classList.toggle("on", m === "none");
    }
    function setHb(v) { state.homeBg = v; saveState(); showHb(); buildSky(); }
    hbI.addEventListener("click", function () { setHb("image"); });
    hbS.addEventListener("click", function () { setHb("stars"); });
    hbN.addEventListener("click", function () { setHb("none"); });
    showHb();
    var rowHomeBg = segRow("Фон главной", [hbI, hbS, hbN]);
    // праздник: искры при «изучено/решено»
    var cOn = el("button", null, "Вкл"); var cOff = el("button", null, "Выкл");
    cOn.type = "button"; cOff.type = "button";
    function showC() { cOn.classList.toggle("on", !state.noCelebrate); cOff.classList.toggle("on", !!state.noCelebrate); }
    cOn.addEventListener("click", function () { state.noCelebrate = false; saveState(); showC(); });
    cOff.addEventListener("click", function () { state.noCelebrate = true; saveState(); showC(); });
    showC();
    var rowCelebrate = segRow("Праздник", [cOn, cOff]);
    // шрифт чтения
    var fontBtns = [];
    var rowRead = el("div", null); rowRead.className = "cd-vm-row stack cards";
    var frLbl = el("span", null, "Шрифт текста"); frLbl.className = "cd-vm-lbl"; rowRead.appendChild(frLbl);
    var fontGrid = el("div", null); fontGrid.className = "cd-font-grid"; rowRead.appendChild(fontGrid);
    Object.keys(RFONTS).forEach(function (key) {
      var F = RFONTS[key];
      var b = el("button", null); b.type = "button"; b.className = "cd-font" + ((state.rfont || "system") === key ? " on" : "");
      var aa = el("span", null, "Аа"); aa.className = "cd-font-aa";
      if (F.stack) aa.style.fontFamily = F.stack;                     // образец прямо на карточке
      b.appendChild(aa);
      var nm = el("span", null, F.label); nm.className = "cd-font-nm"; b.appendChild(nm);
      if (F.sample) { var tag = el("span", null, "встроен"); tag.className = "cd-font-tag"; b.appendChild(tag); }
      b.title = F.sample ? F.label + " — " + F.sample.toLowerCase() + " (встроен в расширение)" : F.label;
      b.addEventListener("click", function () {
        state.rfont = key; saveState(); applyReaderPrefs();
        fontBtns.forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
      });
      fontBtns.push(b); fontGrid.appendChild(b);
    });
    var fNote = el("div", null, "Inter, PT Sans и Golos встроены в расширение — устанавливать их не нужно."); fNote.className = "cd-pal-note";
    rowRead.appendChild(fNote);
    // обложки тем
    var cvOn = el("button", null, "Вкл"), cvOff = el("button", null, "Выкл");
    cvOn.type = cvOff.type = "button";
    function showCv() { cvOn.classList.toggle("on", !!state.covers); cvOff.classList.toggle("on", !state.covers); }
    function setCv(v) { state.covers = v; saveState(); showCv(); if (current && articleEl && !(winEl && winEl.classList.contains("home"))) openFile(current.rel, null, true); }
    cvOn.addEventListener("click", function () { setCv(true); });
    cvOff.addEventListener("click", function () { setCv(false); });
    showCv();
    var rowCovers = segRow("Обложки тем", [cvOn, cvOff]);
    // длинные темы — целиком или по одному разделу
    var bsAll = el("button", null, "Целиком"); var bsSec = el("button", null, "По разделам");
    bsAll.type = "button"; bsSec.type = "button";
    bsSec.title = "Показывать один раздел за раз, с кнопкой «Следующий раздел» (для тем от 4 разделов)";
    function showBs() { bsAll.classList.toggle("on", !state.bySection); bsSec.classList.toggle("on", !!state.bySection); }
    function setBs(v) { state.bySection = v; saveState(); showBs(); if (current && articleEl && !(winEl && winEl.classList.contains("home"))) openFile(current.rel, null, true); }
    bsAll.addEventListener("click", function () { setBs(false); });
    bsSec.addEventListener("click", function () { setBs(true); });
    showBs();
    var rowBySec = segRow("Длинные темы", [bsAll, bsSec]);
    // Живой образец текста: видно, как ляжет шрифт/размер/интервал, не выходя из настроек.
    var sample = el("div", null); sample.className = "cd-set-sample";
    setHTML(sample, '<div class="cd-ss-h">Переменная — коробка с именем</div>' +
      '<p>Сначала объяви, потом используй: <code>int score = 0;</code> — и счёт готов.</p>' +
      '<pre class="cd-ss-code"><code>for (int i = 0; i &lt; 3; ++i)\n    std::cout &lt;&lt; i &lt;&lt; " ";</code></pre>');
    function syncSample() {
      var rf = RFONTS[state.rfont] || RFONTS.system;
      sample.style.fontFamily = rf.stack || "inherit";
      sample.style.zoom = String(state.fs || 1);
      sample.classList.toggle("cd-lh-tight", state.lh === "tight");
      sample.classList.toggle("cd-lh-roomy", state.lh === "roomy");
      var pre = sample.querySelector("pre"); if (pre) pre.style.fontSize = (state.codeFs || 12.5) + "px";
    }
    syncSample();
    // Прогресс: копия в файл и загрузка из файла (диалоги показывает расширение)
    var pExp = el("button", null, "Сохранить копию…"), pImp = el("button", null, "Загрузить…");
    pExp.type = pImp.type = "button";
    pExp.title = "Сохранить весь прогресс (темы, карточки, задания, заметки) в файл — на случай переустановки";
    pImp.title = "Заменить прогресс сохранённой копией. Текущий прогресс сначала уйдёт в резервную копию.";
    function progressAction(kind, msg) {
      saveState(); flushMirror();                  // в файле — самое свежее
      sendAction({ kind: kind }, function (r) { toast(r && r.ok ? msg : "Не получилось: " + ((r && r.error) || "расширение не ответило"), !(r && r.ok)); });
    }
    pExp.addEventListener("click", function () { progressAction("export-progress", "Выберите, куда сохранить копию"); });
    pImp.addEventListener("click", function () { progressAction("import-progress", "Выберите файл с копией прогресса"); });
    var pNote = el("div", null, "Копия делается и сама — раз в день, последние 14 дней."); pNote.className = "cd-pal-note";
    var rowProgress = segRow("Резервная копия прогресса", [pExp, pImp]);
    rowProgress.appendChild(pNote);
    // Окно настроек: шапка + вкладки слева + страница справа.
    viewMenu.setAttribute("role", "dialog"); viewMenu.setAttribute("aria-label", "Настройки");
    var card = el("div", null); card.className = "cd-set-card";
    var head = el("div", null); head.className = "cd-set-head";
    setHTML(head, '<span class="cd-set-ic">' + emo("ui-settings", "⚙") + '</span><div class="cd-set-ht"><b>Настройки</b>' +
      "<span>Всё меняется сразу — сохранять не нужно</span></div>" +
      '<button class="cd-set-x" type="button" title="Закрыть" aria-label="Закрыть">✕</button>');
    head.querySelector(".cd-set-x").addEventListener("click", function () { viewMenu.hidden = true; });
    card.appendChild(head);
    var bodyEl = el("div", null); bodyEl.className = "cd-set-body";
    var tabs = el("div", null); tabs.className = "cd-set-tabs"; tabs.setAttribute("role", "tablist");
    var pagesEl = el("div", null); pagesEl.className = "cd-set-pages";
    var PAGES = [
      ["look", emo("ui-tab-look", "🎨"), "Вид", "Тема, палитра и фон главной", [rowTheme, rowPal, rowHomeBg, rowCovers]],
      ["text", emo("ui-tab-text", "🔤"), "Текст", "Шрифт и размеры — образец меняется сразу", [sample, rowRead, rowFont, rowCodeFs, rowInterval, rowWidth, rowBySec]],
      ["window", emo("ui-tab-window", "🪟"), "Окно", "Как окно ведёт себя поверх редактора", [rowFocus, rowGhost, rowList]],
      ["behave", emo("ui-tab-behave", "✨"), "Поведение", "Разборы, подсказки и анимации", [rowNotes, rowHints, rowAnim, rowCelebrate]],
      ["progress", emo("ui-tab-progress", "💾"), "Прогресс", "Резервная копия изученного", [rowProgress]],
    ];
    PAGES.forEach(function (P) {
      var t = el("button", null); t.type = "button"; t.className = "cd-set-tab"; t.setAttribute("role", "tab"); t.setAttribute("data-tab", P[0]);
      setHTML(t, '<span class="cd-set-tic">' + P[1] + "</span><span>" + escapeHtml(P[2]) + "</span>");
      t.addEventListener("click", function () { showSetTab(P[0]); });
      tabs.appendChild(t);
      var pg = el("div", null); pg.className = "cd-set-page"; pg.setAttribute("data-tab", P[0]); pg.setAttribute("role", "tabpanel");
      var ph = el("div", null); ph.className = "cd-set-ph";
      setHTML(ph, "<b>" + escapeHtml(P[2]) + "</b><span>" + escapeHtml(P[3]) + "</span>");
      pg.appendChild(ph);
      P[4].forEach(function (r) { pg.appendChild(r); });
      pagesEl.appendChild(pg);
    });
    bodyEl.appendChild(tabs); bodyEl.appendChild(pagesEl);
    card.appendChild(bodyEl);
    viewMenu.appendChild(card);
    // Любой клик в настройках мог поменять шрифт/размер — обновим образец (обработчики кнопок уже отработали).
    card.addEventListener("click", syncSample);
    showSetTab(setTab);
  }
  // Классы темы окна: сепия — отдельный тёплый набор; светлая — когда не сепия и тема светлая.
  // ---- Знакомство в 3 шага (первое открытие окна) ----
  // Подсвечиваем НАСТОЯЩИЕ кнопки окна (а не картинки с ними): затемнение вокруг, рамка и
  // подсказка рядом. «Дальше» / «Пропустить» / Esc. Повторить — из руководства (кнопка «?»).
  var TOUR = [
    { sel: ".cd-home-cont", title: "1. Главное действие", text: "Эта карточка всегда ведёт к следующему шагу: продолжить тему, где остановился, или начать новую. Не знаешь, что делать, — жми её." },
    { sel: ".cd-hg-nav .cd-hbtn", title: "2. Все материалы", text: "Список тем, задач и примеров. В нём же поиск по тексту — ищет и по содержимому, с переходом прямо к месту." },
    { sel: ".cd-rbtn", title: "3. Под себя", text: "Шрифт, тема, палитра, обложки тем, анимации. Там же — резервная копия прогресса. А кнопкой ⇥ в шапке окно встаёт справа и сдвигает редактор." },
  ];
  var tourEl = null, tourI = 0;
  function startTour() {
    if (!winEl || !isOpen()) return;
    tourI = 0;
    if (!tourEl) {
      tourEl = el("div"); tourEl.className = "cd-tour";
      setHTML(tourEl, '<div class="cd-tour-hole"></div><div class="cd-tour-tip" role="dialog" aria-live="polite">' +
        '<div class="cd-tour-t"></div><div class="cd-tour-x"></div>' +
        '<div class="cd-tour-nav"><span class="cd-tour-n"></span><button type="button" class="cd-tour-skip">Пропустить</button>' +
        '<button type="button" class="cd-tour-next">Дальше</button></div></div>');
      tourEl.addEventListener("click", function (e) {
        e.stopPropagation();
        if (e.target.closest(".cd-tour-skip")) endTour();
        else if (e.target.closest(".cd-tour-next")) { tourI++; showTourStep(); }
      });
      tourEl.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); endTour(); } });
    }
    winEl.appendChild(tourEl);
    tourEl.hidden = false;
    showTourStep();
  }
  function showTourStep() {
    // шаг, чья кнопка не видна (узкое окно, другая раскладка), пропускаем
    while (tourI < TOUR.length) {
      var t = winEl.querySelector(TOUR[tourI].sel);
      if (t && t.offsetParent) break;
      tourI++;
    }
    if (tourI >= TOUR.length) { endTour(); return; }
    var st = TOUR[tourI], target = winEl.querySelector(st.sel);
    var wr = winEl.getBoundingClientRect(), r = target.getBoundingClientRect(), pad = 6;
    var hole = tourEl.querySelector(".cd-tour-hole"), tip = tourEl.querySelector(".cd-tour-tip");
    hole.style.left = (r.left - wr.left - pad) + "px"; hole.style.top = (r.top - wr.top - pad) + "px";
    hole.style.width = (r.width + pad * 2) + "px"; hole.style.height = (r.height + pad * 2) + "px";
    tourEl.querySelector(".cd-tour-t").textContent = st.title;
    tourEl.querySelector(".cd-tour-x").textContent = st.text;
    tourEl.querySelector(".cd-tour-n").textContent = (tourI + 1) + " из " + TOUR.length;
    tourEl.querySelector(".cd-tour-next").textContent = tourI === TOUR.length - 1 ? "Понятно" : "Дальше";
    // подсказка — под целью, а если не помещается — над ней; по горизонтали — в пределах окна
    var tw = 300, below = r.bottom - wr.top + 12, above = r.top - wr.top - 12;
    tip.style.width = tw + "px";
    tip.style.left = clamp(r.left - wr.left, 10, wr.width - tw - 10) + "px";
    if (below + 150 < wr.height) { tip.style.top = below + "px"; tip.style.bottom = "auto"; }
    else { tip.style.top = "auto"; tip.style.bottom = (wr.height - above) + "px"; }
    try { tourEl.querySelector(".cd-tour-next").focus(); } catch (e) {}
  }
  // Материал открылся поверх тура (из редактора, по ссылке): подсветка указывала бы в пустоту —
  // прячем тур, не отмечая его пройденным.
  function hideTour() {
    if (tourEl && !tourEl.hidden) { tourEl.hidden = true; if (tourEl.parentNode) tourEl.parentNode.removeChild(tourEl); }
  }
  function endTour() {
    if (tourEl) { tourEl.hidden = true; if (tourEl.parentNode) tourEl.parentNode.removeChild(tourEl); }
    state.tourDone = true; saveState();
  }
  function applyThemeClasses() {
    if (!winEl) return;
    var sepia = state.theme === "sepia";
    winEl.classList.toggle("sepia", sepia);
    Object.keys(PALETTES).forEach(function (k) { winEl.classList.toggle("pal-" + k, state.palette === k); });
    winEl.classList.toggle("light", !sepia && isLight());
  }
  function applyReaderPrefs() {
    if (!winEl) return;
    winEl.classList.toggle("wide", !!state.wide);
    winEl.classList.toggle("dense", !!state.dense);
    winEl.classList.toggle("no-anim", !!state.noAnim);
    winEl.classList.toggle("no-outline", !isOutlineOn());
    winEl.classList.toggle("focus", !!state.focus);                 // режим фокуса: скрыть навигацию/оглавление
    winEl.classList.toggle("codewrap-on", !!state.codeWrap);        // перенос длинных строк кода
    if (state.codeFs) winEl.style.setProperty("--cd-codefs", state.codeFs + "px"); else winEl.style.removeProperty("--cd-codefs");
    winEl.classList.toggle("ghost-soft", state.ghost === "soft");   // прозрачность, пока курсор не на окне
    winEl.classList.toggle("ghost-strong", state.ghost === "strong");
    if (tocBtn) tocBtn.classList.toggle("act", isOutlineOn());
    if (articleEl) {
      articleEl.style.zoom = String(state.fs || 1);
      articleEl.classList.toggle("cd-lh-tight", state.lh === "tight");   // межстрочный интервал
      articleEl.classList.toggle("cd-lh-roomy", state.lh === "roomy");
    }
    applyThemeClasses();
    try { ensureFonts(); } catch (e) {}                  // данные с адресом папки могли прийти позже
    var rf = RFONTS[state.rfont] || RFONTS.system;
    winEl.style.setProperty("--cd-rfont", rf.stack || "inherit");
    applyResponsive();
  }
  // Узкое окно: боковое оглавление прячем автоматически, чтобы не сжимать текст.
  // Считаем место под текст: ширина окна минус список материалов (если виден) минус рейка 198 px.
  // Меньше ~640 px — рейку прячем (код перестаёт влезать); «☰ Разделы» тогда открывает её поверх текста.
  function applyResponsive() {
    if (!winEl) return;
    var navW = 0;
    var nav = winEl.querySelector(".cd-nav");
    if (nav && getComputedStyle(nav).display !== "none") navW = nav.offsetWidth;
    var narrow = winEl.offsetWidth < 860 || winEl.offsetWidth - navW - 198 < 640;
    winEl.classList.toggle("narrow", narrow);
    winEl.classList.toggle("tiny", winEl.offsetWidth < 640);          // совсем узко: настройки — вкладки строкой
    winEl.classList.toggle("tightbar", winEl.offsetWidth < 1050);   // маскоту у кнопок нужна ширина — иначе прячем
    winEl.classList.toggle("short", winEl.offsetHeight < 720);
    if (!narrow) winEl.classList.remove("ol-peek");
    fitHead();
    if (homeEl && !homeEl.hidden && homeWideLast !== null && homeWide() !== homeWideLast) { var st0 = homeEl.scrollTop; buildHome(); homeEl.scrollTop = st0; }
  }

  // ------- режим «только основное»: разом свернуть/развернуть все «Разбор»/«Копнуть глубже» -------
  function applyExpandNotes() {
    if (!articleEl) return;
    var open = !!state.expandNotes;
    var list = articleEl.querySelectorAll("details.cd-spoiler");
    for (var i = 0; i < list.length; i++) {
      if (open) list[i].setAttribute("open", ""); else list[i].removeAttribute("open");
    }
  }

  // ------- подсказки-термины: при наведении на слово из словаря всплывает его определение -------
  // Коротко, без ухода со страницы. Определения — простым языком, как в словаре терминов.
  var GLOSSARY = {
    "итератор": "закладка на элемент контейнера: *it — значение под ней, ++it — сдвиг на следующий",
    "итераторы": "закладки на элементы контейнера: *it — значение, ++it — следующий",
    "ссылка": "второе имя той же переменной (T&), а не копия: меняешь ссылку — меняется оригинал",
    "ссылки": "вторые имена тех же переменных (T&), а не копии",
    "указатель": "переменная, хранящая адрес другого объекта; *p — значение по этому адресу",
    "лямбда": "безымянная функция прямо на месте: [захват](параметры){ тело }",
    "raii": "ресурс сам освобождается при выходе из области видимости (файл закроется, память вернётся)",
    "рекурсия": "функция вызывает саму себя; обязательно нужна база — условие, на котором вызовы прекращаются",
    "перегрузка": "несколько функций с одним именем, но разными параметрами",
    "конструктор": "код, который создаёт и заполняет объект нужного типа",
    "деструктор": "код, вызываемый при уничтожении объекта, — освобождает его ресурсы",
    "метод": "функция, живущая внутри структуры или класса; видит её поля без префикса",
    "переполнение": "число вышло за предел типа и «обернулось» (у int за максимумом сразу минимум)",
    "контейнер": "хранилище элементов: vector, map, set, string и подобные",
    "константа": "значение, которое нельзя менять после задания (const/constexpr)",
    "поток": "поток байтов между программой и миром (cin/cout/файл); << пишет в него, >> читает"
  };
  function isTermWordCh(ch) { return !!ch && /[0-9A-Za-zА-Яа-яЁё_]/.test(ch); }
  function annotateTerms(root) {
    if (!state.termHints) return;                 // выключено в настройках
    if (!root || typeof document.createTreeWalker !== "function") return;
    var used = {};
    var terms = Object.keys(GLOSSARY).sort(function (a, b) { return b.length - a.length; });
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (var k = 0; k < nodes.length; k++) {
      var node = nodes[k], p = node.parentNode;
      if (!p || !p.closest) continue;
      // Не трогаем код, ссылки, заголовки, кнопки, уже размеченные термины.
      if (p.closest("code,pre,a,abbr,button,summary,h1,h2,h3,h4,h5,h6")) continue;
      var text = node.nodeValue, lower = text.toLowerCase();
      for (var ti = 0; ti < terms.length; ti++) {
        var term = terms[ti];
        if (used[term]) continue;
        var idx = lower.indexOf(term);
        while (idx !== -1) {                       // ищем отдельное слово, а не часть другого
          var before = idx > 0 ? text.charAt(idx - 1) : "";
          var after = idx + term.length < text.length ? text.charAt(idx + term.length) : "";
          if (!isTermWordCh(before) && !isTermWordCh(after)) break;
          idx = lower.indexOf(term, idx + 1);
        }
        if (idx === -1) continue;
        var abbr = document.createElement("abbr");
        abbr.className = "cd-term";
        abbr.setAttribute("title", GLOSSARY[term]);
        abbr.textContent = text.substr(idx, term.length);
        var rest = node.splitText(idx);            // node → «до», rest → «совпадение + хвост»
        rest.nodeValue = rest.nodeValue.substr(term.length);   // rest → только «хвост»
        p.insertBefore(abbr, rest);
        used[term] = true;
        break;                                     // один термин на текстовый узел — без пестроты
      }
    }
  }

  // ------- история переходов («Назад» / «Вперёд», как в браузере) -------
  function pushHistory(rel, hash) {
    history = history.slice(0, histIdx + 1);
    var top = history[histIdx];
    if (top && top.rel === rel && (top.hash || "") === (hash || "")) return;  // не дублируем текущую точку
    history.push({ rel: rel, hash: hash || "" });
    histIdx = history.length - 1;
    if (history.length > 100) { history.shift(); histIdx--; }
    updateNavButtons();
  }
  function goBack() {
    if (histIdx <= 0) return;
    histIdx--; var h = history[histIdx];
    navHist = true; openFile(h.rel, h.hash); navHist = false;
    updateNavButtons();
  }
  function goForward() {
    if (histIdx >= history.length - 1) return;
    histIdx++; var h = history[histIdx];
    navHist = true; openFile(h.rel, h.hash); navHist = false;
    updateNavButtons();
  }
  function updateNavButtons() {
    if (backBtn) backBtn.disabled = histIdx <= 0;
    if (fwdBtn) fwdBtn.disabled = histIdx >= history.length - 1;
  }

  // ------- переход по маршруту: предыдущий / следующий файл (порядок из data) -------
  function fileIndex(rel) {
    var d = DATA(); if (!d) return -1;
    rel = String(rel).toLowerCase();
    for (var i = 0; i < d.files.length; i++) if (d.files[i].rel.toLowerCase() === rel) return i;
    return -1;
  }
  // Первый экран статьи в окне — сразу к делу. На GitHub .md читаются как есть, а в окне:
  //  • строка ссылок «← Начни отсюда · ← Строки · …» (вверху и внизу) дублирует кнопки
  //    «Предыдущая / Следующая» и «назад» — прячем её и соседнюю черту;
  //  • «Что в этом файле» дублирует панель «На странице» — прячем раздел целиком;
  //  • врезку «Определения функций этой темы … в Словаре функций» сжимаем в чип под заголовком;
  //  • во вводной цитате оставляем только первую строку (служебное «Это разделы …» прячем).
  // Возвращает заголовки без спрятанных (для «На странице»).
  function isNavLine(p) {
    if (!p || p.tagName !== "P") return false;
    var links = p.querySelectorAll("a");
    if (links.length < 2) return false;
    var txt = p.textContent.replace(/\s+/g, " ").trim();
    if (!/^←/.test(txt)) return false;
    var rest = txt;
    for (var i = 0; i < links.length; i++) rest = rest.replace(links[i].textContent.replace(/\s+/g, " ").trim(), "");
    return /^[\s·|]*$/.test(rest);
  }
  function tidyArticle(headings) {
    if (!articleEl) return headings;
    var hide = function (n) { if (n) n.classList.add("cd-winhide"); };
    var kids = Array.prototype.slice.call(articleEl.children);
    kids.forEach(function (n, i) {
      if (!isNavLine(n)) return;
      hide(n);
      if (kids[i + 1] && kids[i + 1].tagName === "HR") hide(kids[i + 1]);
      if (kids[i - 1] && kids[i - 1].tagName === "HR") hide(kids[i - 1]);
    });
    var gone = {};
    kids.forEach(function (n, i) {
      if (n.tagName !== "H2" || !/^Что в этом файле/i.test(n.textContent.trim())) return;
      gone[n.id] = 1; hide(n);
      for (var j = i + 1; j < kids.length && !/^(H[12]|HR)$/.test(kids[j].tagName); j++) hide(kids[j]);
      if (kids[j] && kids[j].tagName === "HR") hide(kids[j]);
    });
    var h1 = articleEl.querySelector("h1");   // обычно H1 уходит в шапку окна и в статье его нет
    kids.forEach(function (n, i) {
      if (n.tagName !== "BLOCKQUOTE") return;
      if ((i === 0 && !h1) || (i === 1 && kids[0] === h1)) {
        var ps = n.querySelectorAll(":scope > p");
        if (ps.length > 1) { n.classList.add("cd-lead"); for (var k = 1; k < ps.length; k++) hide(ps[k]); }
        return;
      }
      var a = n.querySelector('a[href*="10a-slovar-funkcij"]');
      if (!a || !/^Определения функций/.test(n.textContent.trim()) || n.textContent.length > 260) return;
      var chip = el("a", null, "Словарь функций этой темы →");
      chip.className = "cd-dictchip"; chip.setAttribute("href", a.getAttribute("href"));
      var codes = Array.prototype.slice.call(n.querySelectorAll("code")).map(function (c) { return c.textContent; });
      if (codes.length) chip.title = "Коротко про " + codes.join(", ");
      hide(n);
      var anchor = articleEl.querySelector(".cd-lead") || h1;
      if (anchor) articleEl.insertBefore(chip, anchor.nextSibling); else articleEl.insertBefore(chip, articleEl.firstChild);
    });
    wrapTldr();
    return headings.filter(function (h) { return !gone[h.slug]; });
  }
  // «За 30 секунд» — выжимка темы: заголовок и всё до следующего заголовка/черты — в карточку.
  function wrapTldr() {
    var hs = articleEl.querySelectorAll(":scope > h3");
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (!/^За 30 секунд/i.test(h.textContent.trim())) continue;
      var box = document.createElement("section"); box.className = "cd-tldr";
      articleEl.insertBefore(box, h);
      var node = h;
      while (node && !(node !== h && /^(H1|H2|H3|HR)$/.test(node.tagName))) {
        var nx = node.nextElementSibling;
        box.appendChild(node);
        if (node.classList && node.classList.contains("codewrap")) break;   // выжимка = список + пример; текст после — уже тема
        node = nx;
      }
    }
  }
  function buildRouteNav(f) {
    var d = DATA(); if (!d || !articleEl) return;
    var idx = fileIndex(f.rel);
    var prev = idx > 0 ? d.files[idx - 1] : null;
    var next = idx >= 0 && idx < d.files.length - 1 ? d.files[idx + 1] : null;
    if (!prev && !next) return;
    // «Понял → дальше»: дочитал до конца — одной кнопкой отметить тему и открыть следующую.
    if (next && !state.read[f.rel]) {
      var go = el("button", null); go.type = "button"; go.className = "cd-rn-done";
      go.appendChild(el("span", null, "✓ Разобрался — следующая тема"));
      var sub = el("span", null, next.title || next.name); sub.className = "cd-rn-done-s";
      go.appendChild(sub);
      go.addEventListener("click", function () { toggleRead(f.rel); openFile(next.rel); });
      articleEl.appendChild(go);
    }
    var wrap = el("div", null); wrap.className = "cd-routenav";
    wrap.appendChild(prev ? routeBtn(prev, "prev") : el("span"));
    if (next) wrap.appendChild(routeBtn(next, "next"));
    articleEl.appendChild(wrap);
  }
  function routeBtn(f, dir) {
    var b = el("button", null); b.type = "button"; b.className = "cd-rn cd-rn-" + dir;
    var d = el("span", null, dir === "prev" ? "‹ Предыдущая" : "Следующая ›"); d.className = "cd-rn-dir";
    var t = el("span", null, f.title || f.name); t.className = "cd-rn-t";
    b.appendChild(d); b.appendChild(t);
    b.addEventListener("click", function () { openFile(f.rel); });
    return b;
  }

  // ==== runtime/09-layout.js — привязки окна, закрепление справа, вкладки, сплит ====
  // ------- привязки окна: половина слева/справа, разворот/восстановление -------
  function setRect(x, y, wd, ht) {
    if (!winEl) return;
    var vw = viewW(), vh = window.innerHeight || 800;
    wd = clamp(wd, 560, vw); ht = clamp(ht, 380, vh);
    x = clamp(x, 0, vw - wd); y = clamp(y, safeTop(), vh - ht);
    winEl.style.left = Math.round(x) + "px"; winEl.style.top = Math.round(y) + "px";
    winEl.style.width = Math.round(wd) + "px"; winEl.style.height = Math.round(ht) + "px";
    state.x = Math.round(x); state.y = Math.round(y); state.w = Math.round(wd); state.h = Math.round(ht); saveState();
    applyResponsive();
  }
  // ---- Закрепить справа: окно встаёт колонкой у правого края, а редактор VS Code сдвигается ----
  // Раскладку VS Code считает от window.innerWidth. Подменяем его геттер на «ширина минус окно»
  // и шлём resize — workbench перестраивается уже, окно встаёт в освободившуюся полосу.
  // Настоящая ширина — через исходный геттер (viewW), чтобы наши расчёты не ехали.
  var _iwDesc = null;
  try { _iwDesc = Object.getOwnPropertyDescriptor(window, "innerWidth") || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), "innerWidth") || null; } catch (e) {}
  function viewW() {
    try { if (_iwDesc && _iwDesc.get) return _iwDesc.get.call(window) || 1200; } catch (e) {}
    return (document.documentElement && document.documentElement.clientWidth) || 1200;
  }
  var _docked = false;
  function applyDock(on) {
    if (IN_PANEL || !_iwDesc || !_iwDesc.get) return false;
    try {
      if (on) {
        var w = clamp(state.dockW || 560, 560, Math.max(560, Math.round(viewW() * 0.45)));
        Object.defineProperty(window, "innerWidth", { configurable: true, enumerable: true, get: function () { return Math.max(400, viewW() - w); } });
        _docked = true;
        if (winEl) {
          winEl.classList.add("docked");
          setRect(viewW() - w, 0, w, window.innerHeight || 800);
        }
      } else if (_docked) {
        Object.defineProperty(window, "innerWidth", _iwDesc);   // вернуть исходный геттер
        _docked = false;
        if (winEl) winEl.classList.remove("docked");
      }
      window.dispatchEvent(new Event("resize"));
      return true;
    } catch (e) { return false; }
  }
  // Окно VS Code поменяло размер — закреплённая колонка остаётся у правого края во всю высоту.
  try {
    cdOnGlobal(window, "resize", function () {
      if (!_docked || !winEl) return;
      var w = clamp(state.dockW || 560, 560, Math.max(560, Math.round(viewW() * 0.45)));
      setRect(viewW() - w, 0, w, window.innerHeight || 800);
    });
  } catch (e) {}
  function toggleDock() {
    if (!winEl) return;
    if (!state.docked) {
      if (state.rolled) toggleRoll();
      var r = winEl.getBoundingClientRect();
      state.undockRect = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      state.dockW = clamp(Math.round(r.width), 560, Math.max(560, Math.round(viewW() * 0.45)));
      state.docked = applyDock(true);
      if (!state.docked) toast("Не получилось закрепить окно в этой версии VS Code", true);
    } else {
      applyDock(false);
      state.docked = false;
      var u = state.undockRect;
      if (u) setRect(u.x, u.y, u.w, u.h);
    }
    saveState();
    if (dockBtnEl) dockBtnEl.classList.toggle("on", !!state.docked);
  }
  function snapWindow(mode) {
    if (state.docked) toggleDock();   // половинки и «во весь экран» — уже не закреплённое окно
    if (!winEl) return;
    var vw = viewW(), vh = window.innerHeight || 800, m = 8;
    if (state.rolled && (mode === "left" || mode === "right")) {
      var sw = winEl.offsetWidth;
      var sx = mode === "left" ? m : Math.max(m, vw - m - sw);
      winEl.style.left = sx + "px";
      state.x = sx; saveState();
      return;
    }
    var t = Math.max(m, safeTop());       // верхняя кромка ниже строки заголовка VS Code
    var halfW = Math.floor((vw - m * 3) / 2);
    if (mode === "left") setRect(m, t, halfW, vh - t - m);
    else if (mode === "right") setRect(m * 2 + halfW, t, halfW, vh - t - m);
    else if (mode === "max") setRect(m, t, vw - m * 2, vh - t - m);
  }
  function toggleMax() {
    if (!winEl) return;
    var vw = viewW(), m = 8;
    var isMax = winEl.offsetWidth >= vw - m * 2 - 4;   // на весь экран растянута только «max» (половинки — уже)
    if (isMax && prevRect) { setRect(prevRect.x, prevRect.y, prevRect.w, prevRect.h); prevRect = null; }
    else { var r = winEl.getBoundingClientRect(); prevRect = { x: r.left, y: r.top, w: r.width, h: r.height }; snapWindow("max"); }
  }
  // Мини-режим: класс .rolled прячет тело (.cd-body) и делает высоту авто (= высота шапки). Инлайн-высота
  // окна сохраняется, поэтому разворот её возвращает без отдельного хранения.
  var rollInfoEl = null;
  function toggleRoll() { if (!winEl) return; state.rolled = !state.rolled; saveState(); applyRoll(); keepOnScreen(); }
  // Сдвинуть окно влево, если его правый край ушёл за экран (ширина у полоски и окна разная).
  function keepOnScreen() {
    if (!winEl) return;
    var vw = viewW(), m = 8, r = winEl.getBoundingClientRect();
    if (r.right > vw - m) {
      var nx = Math.max(m, vw - m - r.width);
      winEl.style.left = nx + "px"; state.x = Math.round(nx); saveState();
    }
  }
  function applyRoll() {
    if (!winEl) return;
    winEl.classList.toggle("rolled", !!state.rolled);
    if (state.rollW) winEl.style.setProperty("--roll-w", state.rollW + "px");
    if (rollInfoEl) {
      // Полоска: значок раздела · тема › раздел · сколько прочитано.
      var home = winEl.classList.contains("home") || !current;
      var t = home ? "Главная" : (current.title || current.name).split(/[:(]/)[0].trim();
      var sec = !home && crumbEl ? crumbEl.textContent : "";
      var badge = !home && typeof groupBadge === "function" ? groupBadge(current.group) : "";
      var pct = !home && rprogFill ? (parseInt(rprogFill.style.width, 10) || 0) : 0;
      setHTML(rollInfoEl, (badge ? '<img class="cd-ri-ic" src="' + badge + '" alt="">' : '<span class="cd-ri-dot"></span>') +
        '<span class="cd-ri-t">' + escapeHtml(t) + "</span>" +
        (sec ? '<span class="cd-ri-s">' + escapeHtml(sec) + "</span>" : "") +
        (!home ? '<span class="cd-ri-p">' + pct + "%</span>" : "") +
        '<i class="cd-ri-bar" style="width:' + pct + '%"></i>');
      rollInfoEl.title = "Развернуть окно: " + t + (sec ? " › " + sec : "");
    }
  }

  // ------- вкладки внутри окна -------
  function syncActiveTab(rel) {
    if (!tabs.length) { tabs = [{ rel: rel }]; activeTab = 0; }
    else tabs[activeTab] = { rel: rel };
    renderTabStrip();
  }
  function openInTab(rel, hash, newTab) {
    var low = String(rel).toLowerCase();
    if (!fileMap()[low]) return;
    if (newTab) {
      // уже открыт в какой-то вкладке — просто переключимся, не плодим дубли
      var exist = -1;
      for (var i = 0; i < tabs.length; i++) if (tabs[i].rel.toLowerCase() === low) { exist = i; break; }
      if (exist >= 0) activeTab = exist;
      else { tabs.splice(activeTab + 1, 0, { rel: rel }); activeTab++; }
    }
    openFile(rel, hash);
  }
  function switchTab(i) { if (i < 0 || i >= tabs.length || i === activeTab) return; activeTab = i; openFile(tabs[i].rel); }
  function closeTab(i) {
    if (tabs.length <= 1) return;
    tabs.splice(i, 1);
    if (activeTab > i) activeTab--; else if (activeTab >= tabs.length) activeTab = tabs.length - 1;
    openFile(tabs[activeTab].rel);
  }
  function renderTabStrip() {
    if (!tabsEl) return;
    if (tabs.length <= 1) { tabsEl.hidden = true; tabsEl.textContent = ""; return; }
    tabsEl.hidden = false; tabsEl.textContent = "";
    var map = fileMap();
    tabs.forEach(function (t, i) {
      var f = map[String(t.rel).toLowerCase()];
      var chip = el("div", null); chip.className = "cd-tab" + (i === activeTab ? " active" : "");
      chip.title = f ? (f.title || f.name) : t.rel;
      var lbl = el("span", null, f ? (f.title || f.name) : t.rel); lbl.className = "cd-tab-l";
      chip.appendChild(lbl);
      var x = el("button", null, "✕"); x.type = "button"; x.className = "cd-tab-x"; x.title = "Закрыть вкладку";
      x.addEventListener("click", function (e) { e.stopPropagation(); closeTab(i); });
      chip.appendChild(x);
      chip.addEventListener("click", function () { switchTab(i); });
      chip.addEventListener("auxclick", function (e) { if (e.button === 1) { e.preventDefault(); closeTab(i); } });
      tabsEl.appendChild(chip);
    });
  }

  // ------- второй документ рядом (сплит) -------
  function toggleSplit(on) {
    if (!winEl || !splitEl) return;
    var want = (on === undefined) ? splitEl.hidden : on;
    splitEl.hidden = !want;
    winEl.classList.toggle("split", want);
    if (want && !splitCurrent) openInSplit(current ? current.rel : (tabs[0] && tabs[0].rel));
    applyResponsive();
  }
  function openInSplit(rel, hash) {
    if (!splitArticle) return;
    var f = fileMap()[String(rel || "").toLowerCase()];
    if (!f) return;
    splitCurrent = f;
    if (splitTitleEl) splitTitleEl.textContent = f.title || f.name;
    setHTML(splitArticle, renderMarkdown(f.md || "", null));
    resolveImagesIn(splitArticle, f);
    try { annotateAhead(splitArticle, f.rel); } catch (e) { reportError("забегаем вперёд", e); }
    var box = splitArticle.parentNode;
    if (hash) {
      var t = splitArticle.querySelector('[id="' + cssEscape(decodeURIComponent(String(hash).replace(/^#/, ""))) + '"]');
      if (t) { unfoldContaining(t); t.scrollIntoView({ block: "start" }); return; }
    }
    if (box) box.scrollTop = 0;
  }
  function onSplitClick(e) {
    var exMore = e.target.closest && e.target.closest(".cd-ex-more");
    if (exMore) { e.preventDefault(); openFile(exMore.getAttribute("data-rel"), exMore.getAttribute("data-hash") || undefined); return; }
    var toed = e.target.closest && e.target.closest(".cd-toed");
    if (toed) { e.preventDefault(); sendToEditor(toed); return; }
    var copy = e.target.closest && e.target.closest(".copybtn");
    if (copy) { doCopy(copy); return; }
    if (quizClick(e)) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (a && splitCurrent) {
      var href = a.getAttribute("href");
      if (/^(https?|mailto):/i.test(href)) { e.preventDefault(); openExternalLink(href); return; }
      e.preventDefault();
      if (href.charAt(0) === "#") { openInSplit(splitCurrent.rel, href); return; }
      var res = resolveRel(splitCurrent.rel, href);
      var map = fileMap();
      if (/\.md$/i.test(res.rel) && map[res.rel.toLowerCase()]) openInSplit(res.rel, res.hash);
    }
  }

  // ==== runtime/10-home.js — главный экран, руководство ====
  // ------- главный экран (приветствие / возвращение) -------
  function greeting() {
    var h = new Date().getHours();
    if (h < 6) return "Доброй ночи";
    if (h < 12) return "Доброе утро";
    if (h < 18) return "Добрый день";
    return "Добрый вечер";
  }
  function findFile(re) {
    var d = DATA(); if (!d) return null;
    for (var i = 0; i < d.files.length; i++) if (re.test(d.files[i].rel)) return d.files[i];
    return null;
  }
  function lookupFile(rel) {   // устойчиво к регистру
    var map = fileMap();
    return map[rel] || map[String(rel).toLowerCase()] || null;
  }
  function metaOf(f) {
    var parts = [];
    if (f.minutes) parts.push("~" + f.minutes + " мин");
    if (f.sections) parts.push(f.sections + " " + plural(f.sections, ["раздел", "раздела", "разделов"]));
    return parts.join(" · ");
  }
  // #17 Есть ли откуда грузить материалы (data/stamp-файл). Если да, но файлов ещё нет —
  // показываем скелет-заглушку («грузится»), а не пугающее «не найдено / проверь путь».
  function hasDataSource() {
    try {
      var d = DATA();
      return !!((d && (d.dataUrl || d.stampUrl)) || bootVal("dataUrl") || bootVal("stampUrl"));
    } catch (e) { return false; }
  }
  function skelHomeHtml() {
    return '<div class="cd-home-inner">' +
      '<div class="cd-skel-b cd-skel-hero"></div>' +
      '<div class="cd-skel-tiles"><div class="cd-skel-b cd-skel-tile"></div><div class="cd-skel-b cd-skel-tile"></div><div class="cd-skel-b cd-skel-tile"></div></div>' +
      '<div class="cd-skel-b cd-skel-line w40"></div>' +
      '<div class="cd-skel-b cd-skel-line w80"></div>' +
      '<div class="cd-skel-b cd-skel-line w60"></div>' +
      '<div class="cd-skel-note">Загружаю материалы…</div></div>';
  }
  function skelNavHtml() {
    var rows = "";
    for (var i = 0; i < 6; i++) rows += '<div class="cd-skel-b"></div>';
    return '<div class="cd-skel-nav">' + rows + "</div>";
  }

  function buildHome() {
    if (!homeEl) return;
    var d = DATA();
    // Данные не загрузились (нет файла данных / пустой список) — дружелюбная заглушка
    // с наклейкой вместо пустого экрана.
    if (!d || !d.files.length || d.lazy) {
      // Источник данных есть, но материалы ещё не пришли (или пришло только оглавление, а тексты
      // читаются асинхронно) — скелет вместо «не найдено».
      if (hasDataSource()) { setHTML(homeEl, skelHomeHtml()); return; }
      setHTML(homeEl, '<div class="cd-home-inner"><div class="cd-empty cd-empty-home">' +
        '<div class="cd-empty-art">' + stickerMarkup("mascot-sleep", 118) + '</div>' +
        '<div class="cd-empty-t">Материалы не загрузились</div>' +
        '<div class="cd-empty-s">Нажми «Обновить» ⟳ вверху окна или проверь путь к docs в настройке cppDocs.path.</div>' +
        '</div></div>');
      return;
    }
    var total = d.files.length, done = 0;
    d.files.forEach(function (f) { if (state.read[f.rel]) done++; });
    var allDone = done >= total && total > 0;   // весь справочник пройден — время поздравить
    var hi = done > 0 ? "С возвращением!" : "Привет!";   // неразрывный пробел: «С» не повисает отдельной строкой
    var sub = greeting() + (done > 0 ? " · продолжаем учить C++" : " · документация C++ у тебя под рукой");

    var ts = taskStats(), streak = streakDays(), cc = cardCounts();
    var pct = total ? Math.round((done / total) * 100) : 0;
    // Новые наклейки (mascot-win) могут быть ещё не сгенерированы —
    // аккуратно падаем на уже существующие, чтобы экран не показывал заглушку.
    var winMood = (typeof STICKERS !== "undefined" && STICKERS && STICKERS["mascot-win"]) ? "mascot-win" : "mascot-done";
    // #8 маскот меняет настроение: победа (всё пройдено / длинная серия) → думает → машет
    var mood = (allDone || streak >= 7) ? winMood : (done > 0 ? "mascot-think" : "mascot-hi");

    // #8 кольцо прогресса вокруг маскота (SVG). C = длина окружности радиуса 46.
    var C = 289, off = Math.round(C * (1 - pct / 100));
    var ring = '<svg class="cd-ring" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="cd-ring-bg" cx="50" cy="50" r="46"/>' +
      '<circle class="cd-ring-fg" cx="50" cy="50" r="46" style="stroke-dasharray:' + C + ';stroke-dashoffset:' + off + '"/></svg>';

    // Плитки статистики теперь живут в самой шапке справа (dashTile определён ниже — поднимается
    // хойстингом). Это заполняет пустое место героя на широком окне и укорачивает экран.
    var sts = stepsTotals();
    var statsHtml =
      dashTile(emo("ui-read", "📘"), "read", done + " / " + total, "изучено", total ? done / total : 0) +
      dashTile(emo("ui-solve", "✅"), "solve", ts.done + " / " + ts.total, "решено", ts.total ? ts.done / ts.total : 0) +
      dashTile(emo("ui-streak", "🔥"), "streak", String(streak), plural(streak, ["день", "дня", "дней"]) + " подряд", null) +
      (sts.total ? dashTile(emo("ui-steps", "👣"), "steps", sts.done + " / " + sts.total, "разборов по шагам", sts.done / sts.total) : "");

    var html = '<div class="cd-home-inner">';
    html += '<div class="cd-home-hero">' +
      '<div class="cd-hero-lead">' +
      '<div class="cd-home-mascot cd-has-ring">' + ring + '<span class="cd-ring-in">' + stickerMarkup(mood, 76) + '</span></div>' +
      '<div class="cd-home-htxt"><div class="cd-home-hi">' + escapeHtml(hi) + '</div>' +
      '<div class="cd-home-sub">' + escapeHtml(sub) + '</div>' +
      heroWeek() +
      (cc.due > 0 ? '<div class="cd-home-status">' + emo("ui-cards", "🎴") + " к повторению " + cc.due + " " + plural(cc.due, ["карточка", "карточки", "карточек"]) + "</div>" : "") +
      "</div></div>" +
      '<div class="cd-hero-stats' + (sts.total ? " cd-hs4" : "") + '">' + statsHtml + "</div></div>";

    // Порядок главной: приветствие → главное действие (+ план на сегодня, дорожка курса) →
    // повторение одной карточкой → поиск → остальное. Поэтому блоки ниже копим в переменные.
    var heroEnd = html.length;   // всё после героя раскладываем по колонкам в конце (см. homeWide)
    var searchHtml = "", newsHtml = "", qaHtml = "", quickHtml = "", recentHtml = "", marksHtml = "", pinsHtml = "";
    // #2 Поиск по всем материалам прямо на главной
    searchHtml = '<div class="cd-home-search"><span class="cd-hs-ic" aria-hidden="true">⌕</span>' +
      '<input class="cd-hs-in" type="text" placeholder="Поиск по всем материалам…" aria-label="Поиск по материалам" autocomplete="off">' +
      '<div class="cd-hs-res" hidden></div></div>';

    // #10 «Что нового» — разовый баннер о свежих возможностях
    if (state.whatsnew !== WHATSNEW) {
      newsHtml = '<div class="cd-whatsnew"><div class="cd-wn-h">' + emo("ui-news", "✨") + ' Что нового</div>' +
        '<ul class="cd-wn-list">' +
        '<li><b>🏞️ Пейзажи</b> — у каждой палитры своя картинка на главной и в повторении карточек</li>' +
        '<li><b>⚙ Новые настройки</b> — кнопка всегда в шапке; вкладки, палитры с картинками, образец текста прямо в окне</li>' +
        '<li><b>🔤 Шрифты в комплекте</b> — Inter, PT Sans и Golos работают сразу, устанавливать не нужно</li>' +
        '<li><b>🎴 Повторение карточек</b> — «сначала вспомни», «↶ Назад», «не помню» возвращается в конце сессии, итог с разбором</li>' +
        '<li><b>▶ Запустить</b> — упавшая программа больше не засчитывается; причина падения — простыми словами</li>' +
        '</ul><button class="cd-wn-ok" type="button">Понятно</button></div>';
    }

    // Плитка статистики (используется в шапке героя). frac=null — без мини-полоски.
    function dashTile(ic, kind, value, label, frac) {
      var bar = (frac != null)
        ? '<div class="cd-dt-bar"><i style="width:' + Math.max(0, Math.min(100, Math.round(frac * 100))) + '%"></i></div>' : '';
      return '<div class="cd-dtile cd-dt-' + kind + '"><div class="cd-dt-ic">' + ic + '</div>' +
        '<div class="cd-dt-v">' + escapeHtml(value) + '</div>' +
        '<div class="cd-dt-l">' + escapeHtml(label) + '</div>' + bar + '</div>';
    }

    // #9 Панель быстрых действий — запуск в один тап
    var qab = "";   // «▶ Продолжить» здесь убран: главное действие — большая карточка «Следующий шаг» выше
    if (ts.total) qab += '<button class="cd-qa cd-qa-rand" type="button">' + emo("ui-dice", "🎲") + " Случайная задача</button>";
    if (cc.due + cc.neu > 0) qab += '<button class="cd-qa cd-qa-rev" type="button">' + emo("ui-cards", "🎴") + " Повторить" + (cc.due ? " · " + cc.due : "") + "</button>";
    qab += '<button class="cd-qa cd-qa-find" type="button">⌕ Найти</button>';
    qab += '<button class="cd-qa cd-qa-prog" type="button">' + emo("icon-route", "") + " Прогресс</button>";
    qab += '<button class="cd-qa cd-qa-guide" type="button">' + emo("ui-guide", "📖") + " Обучение</button>";
    qaHtml = '<div class="cd-qabar">' + qab + "</div>";

    // Повторение — одна карточка: «Разминка дня» (5 карточек, ~2 мин) + сколько всего ждёт,
    // и маленькая кнопка «повторить все». Новые карточки дозируются лимитом в день (NEW_PER_DAY).
    var cardsHtml = "";
    if (cc.total > 0) {
      var restTxt = cc.due + cc.neu > 0
        ? "всего к повторению " + cc.due + (cc.neu ? " + " + cc.neu + " " + plural(cc.neu, ["новая", "новые", "новых"]) + " на сегодня" : "")
        : "всё повторено — интервалы назначены";
      var allBtn = cc.due + cc.neu > 0 ? '<span class="cd-hw-all" role="button" tabindex="0" title="Повторить всё, что ждёт сегодня">повторить все →</span>' : "";
      if (warmupDoneToday()) {
        cardsHtml += '<div class="cd-home-warm done"><span class="cd-hw-ic">✓</span>' +
          '<div class="cd-hc-main"><div class="cd-hc-lbl">Разминка дня · сделана</div>' +
          '<div class="cd-hc-meta">' + escapeHtml(restTxt) + "</div></div>" + allBtn + "</div>";
      } else {
        var wn = Math.min(WARMUP_N, cc.total);
        cardsHtml += '<div class="cd-home-warm" role="button" tabindex="0"><span class="cd-hw-ic">' + emo("ui-warm", "🌅") + '</span>' +
          '<div class="cd-hc-main"><div class="cd-hc-lbl">Разминка дня</div>' +
          '<div class="cd-hc-title">' + wn + " " + plural(wn, ["карточка", "карточки", "карточек"]) + " · около 2 минут</div>" +
          '<div class="cd-hc-meta">' + escapeHtml(restTxt) + "</div></div>" + allBtn +
          '<div class="cd-hc-arrow">→</div></div>';
      }
    }
    cardsHtml += dailyCardHtml();
    try { cardsHtml += weeklyHomeHtml() + weakHomeHtml(); } catch (e) { reportError("главная: прогресс", e); }
    var planHtml = "", trackHtml = courseTrack();

    if (allDone) {
      // Весь справочник пройден — вместо «Продолжить» поздравляем наклейкой.
      html += '<div class="cd-home-done">' +
        '<div class="cd-done-art">' + stickerMarkup(winMood, 62) + '</div>' +
        '<div class="cd-hc-main"><div class="cd-hc-lbl">Готово</div>' +
        '<div class="cd-hc-title">Всё изучено — ' + total + ' ' + plural(total, ["материал", "материала", "материалов"]) + '!</div>' +
        '<div class="cd-hc-meta">Можно перечитывать любой материал или сбросить прогресс и пройти заново.</div></div></div>';
    } else {
      // #1 Умный «Следующий шаг»: незакрытая последняя тема → продолжить; иначе первая
      // неизученная по порядку курса; в самом начале — «Начать здесь».
      var lastF = state.last ? lookupFile(state.last) : null;
      var nF = nextUnread();
      var primary, lbl, reason;
      if (lastF && !state.read[lastF.rel]) { primary = lastF; lbl = "▶ Продолжить чтение"; reason = "вернуться к последней теме"; }
      else if (nF) { primary = nF; lbl = "▶ Следующий шаг"; reason = "следующая неизученная тема"; }
      else { primary = lastF || findFile(/00-нач|начни/i) || d.files[0]; lbl = "▶ Начать здесь"; reason = ""; }
      if (primary) {
        var meta = [reason, metaOf(primary)].filter(function (x) { return x; }).join(" · ");
        html += '<button class="cd-home-cont" data-rel="' + escapeHtml(primary.rel) + '">' +
          '<div class="cd-hc-main"><div class="cd-hc-lbl">' + lbl + '</div>' +
          '<div class="cd-hc-title">' + escapeHtml(primary.title || primary.name) + '</div>' +
          (meta ? '<div class="cd-hc-meta">' + escapeHtml(meta) + '</div>' : '') +
          '</div><div class="cd-hc-arrow">→</div></button>';
        // «Вы остановились» — начатый, но не законченный разбор по шагам или открытый босс
        var sp = state.spot, spF = sp ? lookupFile(sp.rel) : null;
        if (spF) {
          var spPct = sp.kind === "steps" && sp.n ? Math.round((sp.i + 1) / sp.n * 100) : 0;
          html += '<button class="cd-home-spot" type="button">' +
            '<span class="cd-spot-ic">' + (sp.kind === "boss" ? "♛" : "↩") + "</span>" +
            '<span class="cd-spot-main"><span class="cd-spot-lbl">Вы остановились · ' + (sp.kind === "boss" ? "босс темы" : "разбор по шагам") + "</span>" +
            '<span class="cd-spot-t">' + escapeHtml(sp.title || "без названия") + "</span>" +
            '<span class="cd-spot-f">' + escapeHtml(spF.title || spF.name) +
            (sp.kind === "steps" && sp.n ? " · шаг " + (sp.i + 1) + " из " + sp.n : "") + "</span>" +
            (spPct ? '<span class="cd-spot-bar"><i style="width:' + spPct + '%"></i></span>' : "") +
            '</span><span class="cd-spot-go">→</span></button>';
        }
        // Подсказка «дальше по курсу», если следующий неизученный отличается от primary
        if (nF && nF.rel !== primary.rel) {
          html += '<button class="cd-home-next" data-rel="' + escapeHtml(nF.rel) + '">Дальше по курсу: <b>' +
            escapeHtml(nF.title || nF.name) + "</b> →</button>";
        }
        planHtml = todayPlan(primary, cc);
      }
    }
    var mainTop = html.slice(heroEnd); html = html.slice(0, heroEnd);

    // Быстрый доступ — ключевые точки, цвет карточки = цвет группы файла
    var quick = [
      { re: /00-нач|начни/i, t: "Начни отсюда", s: "карта: что где лежит и с чего начать", icon: "icon-start" },
      { re: /marshrut|маршрут/i, t: "Маршрут изучения", s: "этапы по порядку с чекпоинтами", icon: "icon-route" },
      { re: /shpargalka|шпаргал/i, t: "Шпаргалка", s: "самое частое на один экран", icon: "icon-cheat" },
      { re: /^ref\//i, t: "Справочник по темам", s: "подробно по каждой теме", icon: "icon-ref" },
      { re: /zadachnik|задачник/i, t: "Задачник", s: "задачи для практики — реши сам", icon: "icon-tasks" },
      { re: /^examples\//i, t: "Примеры программ", s: "готовый код — собран и запущен", icon: "icon-examples" }
    ];
    // Единый заголовок секции: цветная точка + подпись + счётчик — общий ритм для всех блоков.
    function secHead(label, count, color) {
      return '<div class="cd-home-sec"' + (color ? ' style="--sc:' + color + '"' : "") + ">" +
        '<span class="cd-sec-dot"></span><span class="cd-sec-lbl">' + escapeHtml(label) + "</span>" +
        (count != null ? '<span class="cd-sec-count">' + count + "</span>" : "") + "</div>";
    }
    var cards = "", quickN = 0;
    quick.forEach(function (q) {
      var f = findFile(q.re); if (!f) return;
      quickN++;
      var ic = (q.icon && STICKERS && STICKERS[q.icon]) ? '<span class="cd-hcard-ic">' + stickerMarkup(q.icon, 32) + "</span>" : "";
      cards += '<button class="cd-home-card" data-rel="' + escapeHtml(f.rel) + '" style="--gcolor:' + escapeHtml(f.groupColor || "var(--ac)") + '">' +
        '<div class="cd-hcard-head">' + ic + '<div class="cd-hcard-t">' + escapeHtml(q.t) + "</div></div>" +
        '<div class="cd-hcard-s">' + escapeHtml(f.subtitle || q.s) + "</div>" +
        '<span class="cd-hcard-go">→</span></button>';
    });
    if (cards) quickHtml = secHead("Быстрый доступ", quickN, "var(--ac)") + '<div class="cd-home-grid">' + cards + "</div>";

    // Недавнее (кроме файла из «Продолжить», чтобы не дублировать)
    var recentRels = (state.recent || []).filter(function (r) {
      return lookupFile(r) && String(r).toLowerCase() !== String(state.last || "").toLowerCase();
    });
    if (recentRels.length) {
      var rchips = "";
      recentRels.slice(0, 8).forEach(function (r) {
        var rf = lookupFile(r);
        rchips += '<button class="cd-home-chip" data-rel="' + escapeHtml(rf.rel) + '" style="--gcolor:' +
          escapeHtml(rf.groupColor || "var(--ac)") + '">' + escapeHtml(rf.title || rf.name) + "</button>";
      });
      recentHtml = secHead("Недавнее", recentRels.length, "#f9e2af") + '<div class="cd-home-chips">' + rchips + "</div>";
    }

    // Закладки на разделы (если есть) — клик ведёт прямо к разделу
    var markKeys = Object.keys(state.marks || {}).filter(function (k) {
      return lookupFile(String(k).split("#")[0]);
    });
    if (markKeys.length) {
      var mchips = "";
      markKeys.slice(0, 16).forEach(function (k) {
        var parts = String(k).split("#"), rel = parts[0], slug = parts.slice(1).join("#");
        var mf = lookupFile(rel);
        var label = state.marks[k] || (mf && (mf.title || mf.name)) || rel;
        mchips += '<button class="cd-home-chip cd-home-mark" data-rel="' + escapeHtml(mf.rel) +
          '" data-hash="#' + escapeHtml(slug) + '" style="--gcolor:' + escapeHtml(mf.groupColor || "var(--ac)") +
          '" title="' + escapeHtml((mf.title || mf.name) + " · раздел") + '">★ ' + escapeHtml(label) + "</button>";
      });
      marksHtml = secHead("Закладки", markKeys.length, "#cba6f7") + '<div class="cd-home-chips">' + mchips + "</div>";
    }

    // Закреплённое (если есть)
    var pinRels = Object.keys(state.pins || {}).filter(function (r) { return state.pins[r] && lookupFile(r); });
    if (pinRels.length) {
      var chips = "";
      pinRels.slice(0, 12).forEach(function (r) {
        var f = lookupFile(r);
        chips += '<button class="cd-home-chip" data-rel="' + escapeHtml(f.rel) + '" style="--gcolor:' + escapeHtml(f.groupColor || "var(--ac)") + '">' + escapeHtml(f.title || f.name) + '</button>';
      });
      pinsHtml = secHead("Закреплённое", pinRels.length, "#f38ba8") + '<div class="cd-home-chips">' + chips + "</div>";
    }
    // Широкое окно — две колонки: слева путь (следующий шаг, план, курс, быстрый доступ),
    // справа ежедневное (разминка, поиск, действия, недавнее, «Что нового»). Узкое — одна лента.
    var wide = homeWide(); homeWideLast = wide;
    if (wide) {
      html += '<div class="cd-home-cols"><div class="cd-home-main">' + mainTop + planHtml + trackHtml + quickHtml + "</div>" +
        '<div class="cd-home-side">' + cardsHtml + searchHtml + qaHtml + recentHtml + marksHtml + pinsHtml + newsHtml + "</div></div>";
    } else {
      html += mainTop + planHtml + trackHtml + cardsHtml + searchHtml + newsHtml + qaHtml + quickHtml + recentHtml + marksHtml + pinsHtml;
    }
    html += "</div>";
    homeEl.classList.toggle("wide2", wide);
    setHTML(homeEl, html);
    buildSky();
    homeCountUp();   // #8 цифры героя «набегают», кольцо заполняется

    // Анимация мини-полосок дашборда: от нуля к целевой ширине.
    homeEl.querySelectorAll(".cd-dt-bar i").forEach(function (bar) {
      var w = bar.style.width; bar.style.width = "0";
      requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = w; }); });
    });

    homeEl.querySelectorAll("[data-rel]").forEach(function (b) {
      b.addEventListener("click", function () { openFile(b.getAttribute("data-rel"), b.getAttribute("data-hash") || undefined); });
    });

    var spotBtn = homeEl.querySelector(".cd-home-spot");
    if (spotBtn) spotBtn.addEventListener("click", function () {
      var sp = state.spot; if (!sp) return;
      openFile(sp.rel, "#" + (sp.kind === "boss" ? "boss-" : "st-") + sp.id);
      var box = articleEl && articleEl.querySelector('[data-id="' + cssEscape(sp.id) + '"]');
      if (box && sp.kind === "steps") stepsShow(box, sp.i);
      if (box && sp.kind === "boss") { box.__peek = 1; refreshBoss(); }
    });

    // #9 быстрые действия
    var cont = homeEl.querySelector(".cd-home-cont");
    var qaCont = homeEl.querySelector(".cd-qa-cont");
    if (qaCont) qaCont.addEventListener("click", function () {
      if (cont) { cont.click(); return; }
      var lf = state.last ? lookupFile(state.last) : null, f = lf || (d.files[0]);
      if (f) openFile(f.rel);
    });
    var qaRand = homeEl.querySelector(".cd-qa-rand");
    if (qaRand) qaRand.addEventListener("click", openRandomTask);
    var qaRev = homeEl.querySelector(".cd-qa-rev");
    if (qaRev) qaRev.addEventListener("click", startReview);

    // #3 карточка повторения
    var revCard = homeEl.querySelector(".cd-home-review");
    if (revCard) revCard.addEventListener("click", startReview);
    var warmBtn = homeEl.querySelector(".cd-home-warm:not(.done):not(.cd-daily)");
    var allRev = homeEl.querySelector(".cd-hw-all");
    if (allRev) {
      allRev.addEventListener("click", function (e) { e.stopPropagation(); startReview(); });
      allRev.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); startReview(); } });
    }
    var dailyBtn = homeEl.querySelector(".cd-daily:not(.done)");
    if (dailyBtn) {
      dailyBtn.addEventListener("click", function (e) { e.stopPropagation(); openDaily(); });
      dailyBtn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDaily(); } });
    }
    if (warmBtn) {
      warmBtn.addEventListener("click", startWarmup);
      warmBtn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startWarmup(); } });
    }
    homeEl.querySelectorAll(".cd-plan-step[data-act]").forEach(function (b) {
      b.addEventListener("click", function () { if (b.getAttribute("data-act") === "warm") startWarmup(); });
    });

    // #10 «Что нового» — закрыть и запомнить
    var wnOk = homeEl.querySelector(".cd-wn-ok");
    if (wnOk) wnOk.addEventListener("click", function () { state.whatsnew = WHATSNEW; saveState(); buildHome(); });

    // #2 живой поиск по всем материалам
    var hsIn = homeEl.querySelector(".cd-hs-in");
    var hsRes = homeEl.querySelector(".cd-hs-res");
    function hsRender() {
      var q = norm(hsIn.value.trim());
      if (!q) { hsRes.hidden = true; setHTML(hsRes, ""); return; }
      var all = (DATA() || { files: [] }).files, out = [], i;
      for (i = 0; i < all.length && out.length < 12; i++) {
        var hit = searchHit(all[i], q);         // теперь ищем и в теле, со сниппетом и разделом
        if (hit) out.push({ f: all[i], hit: hit });
      }
      hsRes.hidden = false;
      setHTML(hsRes, out.length
        ? out.map(function (o) {
            var f = o.f, h = o.hit;
            return '<button class="cd-hs-item" data-rel="' + escapeHtml(f.rel) + '"><b>' + escapeHtml(f.title || f.name) + "</b>" +
              (h.sec ? '<span class="cd-hs-sec">' + escapeHtml(h.sec) + "</span>" : "") +
              '<span class="cd-hs-snip">' + h.snippet + "</span></button>";
          }).join("")
        : '<div class="cd-hs-empty">Ничего не нашлось</div>');
    }
    var qaFind = homeEl.querySelector(".cd-qa-find");
    if (qaFind && hsIn) qaFind.addEventListener("click", function () { hsIn.focus(); hsIn.select(); });
    var qaProg = homeEl.querySelector(".cd-qa-prog");
    if (qaProg) qaProg.addEventListener("click", function () { showProgress("map"); });
    var wkBtn = homeEl.querySelector(".cd-weekly");
    if (wkBtn) {
      wkBtn.addEventListener("click", function () { showProgress("weekly"); });
      wkBtn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showProgress("weekly"); } });
    }
    homeEl.querySelectorAll(".cd-weak-go").forEach(function (b) {
      b.addEventListener("click", function () { runWeakAction(b.getAttribute("data-wrel"), b.getAttribute("data-wk"), b.getAttribute("data-wx")); });
    });
    var qaGuide = homeEl.querySelector(".cd-qa-guide");
    if (qaGuide) qaGuide.addEventListener("click", function () { showGuide(); });
    if (hsIn && hsRes) {
      hsIn.addEventListener("input", hsRender);
      hsIn.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { var first = hsRes.querySelector(".cd-hs-item"); if (first) { searchJumpTerm = hsIn.value.trim(); openFile(first.getAttribute("data-rel")); } }
        else if (e.key === "Escape") { hsIn.value = ""; hsRender(); }
      });
      hsRes.addEventListener("click", function (e) {
        var it = e.target.closest && e.target.closest(".cd-hs-item");
        if (it) { searchJumpTerm = hsIn.value.trim(); openFile(it.getAttribute("data-rel")); }
      });
    }
  }
  // Главная в две колонки — когда области чтения хватает ширины (считаем по родителю: сама
  // главная при сборке может быть ещё скрыта).
  var homeWideLast = null;
  var homeBgEl = null;
  // Детерминированный «случайный» генератор от строки: звезда темы всегда на своём месте.
  function seededRand(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5; var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // #1 Звёздное небо прогресса: каждая тема — звезда. Изученные горят цветом раздела,
  // соседние изученные в разделе соединены линией-созвездием; следующая тема пульсирует.
  // Разделы — скопления у краёв (центр занят карточками), небо — за стеклянными карточками.
  var SKY_SPOTS = [[90, 110], [910, 110], [110, 330], [890, 320], [95, 520], [905, 520], [500, 40], [500, 565], [300, 80], [700, 560]];
  // Статичный пейзаж под палитру: файл extension/bg-<палитра>.webp (или bg-default.webp для
  // «Как в редакторе» и палитр без своей картинки). Читается с диска один раз на палитру;
  // в рантайм не встраивается — картинки по сотне-другой КБ.
  var _bgCache = {};
  function homeBgImage() {
    var d = DATA(), dir = (d && d.extDirUrl) || bootVal("extDirUrl");
    if (!dir) return null;
    var key = state.palette && PALETTES[state.palette] ? state.palette : "default";
    if (_bgCache[key] !== undefined) return _bgCache[key];
    var base = String(dir).replace(/\/+$/, "") + "/";
    var have = (d && Array.isArray(d.bgImages)) ? d.bgImages : [];   // какие bg-*.webp есть в расширении
    var name = have.indexOf("bg-" + key + ".webp") !== -1 ? "bg-" + key + ".webp" : (have.indexOf("bg-default.webp") !== -1 ? "bg-default.webp" : "");
    _bgCache[key] = name ? resUrl(base + name) : null;
    return _bgCache[key];
  }
  function buildSky() {
    if (!homeBgEl) return;
    var mode = state.homeBg === "none" || state.homeBg === "stars" ? state.homeBg : "image";
    var img = mode === "image" ? homeBgImage() : null;
    homeBgEl.classList.toggle("has-img", !!img);
    if (mode === "none" || img) {                   // пейзаж — без звёзд и пятен, чтобы не спорили
      setHTML(homeBgEl, img ? '<div class="cd-homebg-img" style="background-image:url(' + img + ')"></div><div class="cd-homebg-veil"></div>' : "");
      return;
    }
    var html = '<div class="cd-aur a1"></div><div class="cd-aur a2"></div><div class="cd-aur a3"></div>';
    var d = DATA();
    if (d && d.files.length) {
      var nxt = nextUnread(), lines = "", stars = "";
      groupsFromData().forEach(function (g, gi) {
        var c = SKY_SPOTS[gi % SKY_SPOTS.length], rnd = seededRand(g.label), prev = null;
        var col = g.color || "var(--ac)", n = g.items.length;
        g.items.forEach(function (f, i) {
          var r2 = seededRand(f.rel);
          var ang = i / Math.max(1, n) * Math.PI * 2 + rnd() * 0.8, rad = 18 + r2() * (40 + n * 3.2);
          var x = Math.round(c[0] + Math.cos(ang) * rad * 1.25), y = Math.round(c[1] + Math.sin(ang) * rad * 0.9);
          var on = !!state.read[f.rel], isNext = nxt && nxt.rel === f.rel;
          if (on && prev) lines += '<line class="cd-st-line" x1="' + prev[0] + '" y1="' + prev[1] + '" x2="' + x + '" y2="' + y + '" style="stroke:' + col + '"/>';
          prev = on ? [x, y] : null;
          if (on) {
            stars += '<circle class="cd-st-glow" cx="' + x + '" cy="' + y + '" r="7" style="fill:' + col + '"/>' +
              '<circle class="cd-st on" cx="' + x + '" cy="' + y + '" r="2.3" style="fill:' + col + ";animation-delay:-" + (r2() * 5).toFixed(2) + 's"/>';
          } else if (isNext) {
            stars += '<circle class="cd-st-ring" cx="' + x + '" cy="' + y + '" r="5"/><circle class="cd-st next" cx="' + x + '" cy="' + y + '" r="2.4"/>';
          } else {
            stars += '<circle class="cd-st" cx="' + x + '" cy="' + y + '" r="1.5"/>';
          }
        });
      });
      // немного фоновой «пыли», чтобы небо не было пустым между скоплениями
      var dust = "", rd = seededRand("sky");
      for (var k = 0; k < 60; k++) dust += '<circle class="cd-st dust" cx="' + Math.round(rd() * 1000) + '" cy="' + Math.round(rd() * 600) + '" r="' + (0.6 + rd() * 0.8).toFixed(1) + '"/>';
      html += '<svg class="cd-sky" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">' + dust + lines + stars + "</svg>";
    }
    setHTML(homeBgEl, html);
  }
  function homeWide() {
    var host = homeEl && homeEl.parentNode;
    return !!(host && host.clientWidth >= 1180);
  }
  // #8 Живые цифры: при смене значений числа на плитках героя набегают от нуля, кольцо маскота
  // и полоски заполняются. Один раз на набор значений — повторный заход на главную не мельтешит.
  var homeCountKey = "";
  function homeCountUp() {
    if (!homeEl) return;
    var vals = homeEl.querySelectorAll(".cd-hero-stats .cd-dt-v"), key = "";
    vals.forEach(function (v) { key += v.textContent + "|"; });
    var ringFg = homeEl.querySelector(".cd-ring-fg");
    if (key === homeCountKey || state.noAnim || prefersReducedMotion()) { homeCountKey = key; return; }
    homeCountKey = key;
    if (ringFg) {
      var off = ringFg.style.strokeDashoffset; ringFg.style.strokeDashoffset = "289";
      requestAnimationFrame(function () { requestAnimationFrame(function () { ringFg.style.strokeDashoffset = off; }); });
    }
    vals.forEach(function (v) {
      var tpl = v.textContent, nums = tpl.match(/\d+/g); if (!nums) return;
      var t0 = null, dur = 750;
      function frame(ts) {
        if (!v.isConnected) return;
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3), i = 0;
        v.textContent = tpl.replace(/\d+/g, function () { return String(Math.round(+nums[i++] * e)); });
        if (k < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      // страховка: если кадры не шли (окно скрыто, вкладка в фоне) — итоговое значение всё равно встанет
      setTimeout(function () { if (v.isConnected) v.textContent = tpl; }, dur + 250);
    });
  }
  function showHome() {
    if (!homeEl || !winEl) return;
    if (reviewEl) reviewEl.hidden = true;   // выходим из режима повторения, если был
    winEl.classList.remove("reviewing");
    buildHome();
    homeEl.hidden = false;
    winEl.classList.add("home");
    if (secProgEl) secProgEl.hidden = true;
    winEl.classList.toggle("navhidden", navHiddenNow());
    homeEl.classList.remove("cd-in-anim"); void homeEl.offsetWidth; homeEl.classList.add("cd-in-anim");
    if (state.rolled) applyRoll();
    syncHead();
    syncReviewBell();
    homeEl.scrollTop = 0;
  }
  function hideHome() {
    if (!homeEl || !winEl) return;
    homeEl.hidden = true;
    if (reviewEl) reviewEl.hidden = true;
    winEl.classList.remove("home", "reviewing");
    winEl.classList.toggle("navhidden", navHiddenNow());
    applyResponsive();
  }
  // Список материалов: на главной по умолчанию виден, при чтении — скрыт (съедает место под текст).
  function navHiddenNow() {
    var home = winEl ? winEl.classList.contains("home") : false;
    return home ? !!state.navHiddenHome : !!state.navHidden;
  }

  // =================== Шапка окна: крошки, цвет раздела, «Дальше», карточки, редактор ===================
  // Клик по кнопке/крошке/меню в шапке — не перетаскивание и не «свернуть» двойным кликом.
  function headInteractive(t) {
    return !!(t && t.closest && t.closest("button, input, select, textarea, [role=button], .cd-viewmenu, .cd-edpop, .cd-rname, .cd-crumb"));
  }
  // Крошка «раздел»: показать список слева и раскрыть в нём этот раздел (остальные свернуть).
  function revealGroup(label) {
    if (!winEl || !label) return;
    if (navHiddenNow()) {
      if (winEl.classList.contains("home")) state.navHiddenHome = false; else state.navHidden = false;
      winEl.classList.remove("navhidden");
    }
    groupsFromData().forEach(function (g) { state.collapsed[g.label] = g.label !== label; });
    saveState();
    renderNav();
    applyResponsive();
    var sec = navListEl && navListEl.querySelector('.cd-group[data-group="' + cssEscape(label) + '"]');
    if (sec) { sec.scrollIntoView({ block: "start", behavior: "smooth" }); pulse(sec.querySelector(".cd-ghead") || sec); }
  }
  // Крошки + цвет шапки по разделу (#10) + кнопка «Дальше». Зовётся при смене экрана/темы.
  function syncHead() {
    if (!winEl || !titleEl) return;
    var reading = !!current && !winEl.classList.contains("home");
    var reviewing = winEl.classList.contains("reviewing");
    if (reading && current.group) {
      var gb = groupBadge(current.group);
      setHTML(groupCrumbEl, (gb ? '<img class="cd-cg-ic" src="' + gb + '" alt="" draggable="false">' : '<i class="cd-cg-dot"></i>') +
        '<span class="cd-cg-t">' + escapeHtml(current.group) + "</span>");
      groupCrumbEl.title = "Раздел «" + current.group + "» — показать в списке слева";
      groupCrumbEl.hidden = false;
    } else groupCrumbEl.hidden = true;
    if (!reading) {
      rnameEl.textContent = reviewing ? "Повторение карточек" : "Главная";
      rnameEl.removeAttribute("title");
      if (crumbEl.textContent) crumbEl.textContent = "";
      if (secProgEl) secProgEl.hidden = true;   // «0/8 ●●●» прошлого материала не должен висеть на главной и в повторении
    }
    // Цвет раздела: кромка и лёгкий тон шапки. На главной — обычный акцент.
    var col = reading && current.groupColor;
    if (col) { winEl.style.setProperty("--hcol", col); titleEl.style.setProperty("--gcolor", col); }
    else { winEl.style.removeProperty("--hcol"); titleEl.style.removeProperty("--gcolor"); }
    syncNextBtn();
    fitHead();
  }
  // Кольцо вокруг логотипа — общий прогресс «изучено» (#3).
  function syncLogoRing(done, total) {
    if (!logoEl) return;
    var pct = total ? Math.round((done / total) * 100) : 0;
    logoEl.style.setProperty("--lp", String(pct));
    logoEl.title = "Изучено " + done + " из " + total + " (" + pct + "%) · на главную";
    logoEl.setAttribute("aria-label", logoEl.title);
  }
  // «🎴 N» — карточки к повторению (#5). Клик: «Разминка дня», а если она сделана — всё, что ждёт.
  function syncReviewBell() {
    if (!revBellEl) return;
    var cc;
    try { cc = cardCounts(); } catch (e) { return; }
    var warm = !warmupDoneToday() && cc.total > 0;
    if (!cc.due && !cc.neu && !warm) { revBellEl.hidden = true; return; }
    revBellEl.hidden = false;
    var n = cc.due || (warm ? 0 : cc.neu);
    setHTML(revBellEl, '<span class="cd-hrev-ic" aria-hidden="true">' + emo("ui-cards", "🎴") + "</span>" +
      (n ? '<b class="cd-hrev-n">' + n + "</b>" : "") + (warm ? '<i class="cd-hrev-dot" aria-hidden="true"></i>' : ""));
    revBellEl.classList.toggle("due", cc.due > 0);
    var tip = warm ? "Разминка дня: " + Math.min(WARMUP_N, cc.total) + " карточек, около 2 минут" : "Повторить карточки";
    if (cc.due || cc.neu) tip += "\nК повторению: " + cc.due + (cc.neu ? " + " + cc.neu + " " + plural(cc.neu, ["новая", "новые", "новых"]) : "");
    revBellEl.title = tip;
    revBellEl.setAttribute("aria-label", tip.replace("\n", ". "));
  }
  // Раздел ## (режим «по разделам»), в котором лежит узел статьи; -1 — вне разделов.
  function secOf(node) {
    while (node && node.parentElement && node.parentElement !== articleEl) node = node.parentElement;
    return node && node.hasAttribute && node.hasAttribute("data-sec") ? +node.getAttribute("data-sec") : -1;
  }
  // Куда ведёт «Дальше» (#6): на главной — продолжить/следующий шаг; в задачнике — следующая
  // нерешённая задача ниже по тексту; иначе — следующая тема курса.
  function headNextTarget() {
    if (!winEl || winEl.classList.contains("reviewing")) return null;
    var d = DATA(); if (!d || !d.files.length) return null;
    if (winEl.classList.contains("home")) return null;   // на главной главное действие — карточка «Следующий шаг»
    if (!current) {
      var lastF = state.last ? lookupFile(state.last) : null;
      if (lastF && !state.read[lastF.rel]) return { f: lastF, label: "Продолжить", tip: "Продолжить чтение: " + (lastF.title || lastF.name) };
      var nF = nextUnread();
      if (nF) return { f: nF, label: "Следующий шаг", tip: "Следующая неизученная тема: " + (nF.title || nF.name) };
      return null;
    }
    if (articleEl && contentEl) {
      var tasks = articleEl.querySelectorAll("h2.cd-task:not(.cd-task-done)");
      if (tasks.length) {
        var cTop = contentEl.getBoundingClientRect().top, pick = null;
        for (var i = 0; i < tasks.length && !pick; i++) {
          var h = tasks[i];
          if (h.offsetParent) { if (h.getBoundingClientRect().top - cTop > 60) pick = h; }
          else if (secMode && secOf(h) > secIdx) pick = h;          // в следующем разделе (скрыт)
        }
        pick = pick || tasks[0];                                     // ниже нет — по кругу к первой
        var num = (pick.textContent.match(/^\s*(\d+(?:\.\d+)*)/) || [])[1];
        return { task: pick, label: num ? "Задача " + num : "Следующая задача", tip: "К следующей нерешённой задаче" };
      }
    }
    var idx = fileIndex(current.rel);
    var next = idx >= 0 && idx < d.files.length - 1 ? d.files[idx + 1] : null;
    return next ? { f: next, label: "Дальше", tip: "Следующая тема: " + (next.title || next.name) } : null;
  }
  function syncNextBtn() {
    if (!nextBtnEl) return;
    var t = headNextTarget();
    var was = nextBtnEl.hidden;
    if (!t) { nextBtnEl.hidden = true; if (!was) fitHead(); return; }
    nextBtnEl.hidden = false;
    var lab = nextBtnEl.querySelector(".cd-hnext-t");
    if (lab.textContent !== t.label) { lab.textContent = t.label; if (!was) fitHead(); }
    nextBtnEl.title = t.tip; nextBtnEl.setAttribute("aria-label", t.tip);
    if (was) fitHead();
  }
  function goHeadNext() {
    var t = headNextTarget(); if (!t) return;
    if (t.task) { unfoldContaining(t.task); t.task.scrollIntoView({ block: "start", behavior: "smooth" }); flashHeading(t.task); return; }
    if (t.f) openFile(t.f.rel);
  }

  // Связь с редактором (#9): какой C/C++-файл открыт, есть ли в нём ошибки, найден ли компилятор.
  // Данные приходят тем же файловым мостом, что и слово под курсором (payload.file / .cc / .off).
  function applyEditorEnv(p) {
    if (!edBtnEl) return;
    edEnv = p || {};
    var f = edEnv.file, off = !!edEnv.off;
    var st = off ? "off" : !f ? "none" : f.errs ? "err" : "ok";
    var sig = st + "|" + (f ? f.name + "|" + f.errs : "") + "|" + JSON.stringify(edEnv.cc === undefined ? "?" : edEnv.cc);
    if (edBtnEl.getAttribute("data-sig") === sig && !edBtnEl.hidden) return;   // опрос раз в секунду — без лишних перерисовок
    edBtnEl.setAttribute("data-sig", sig);
    edBtnEl.hidden = false;
    edBtnEl.className = "cd-hpill cd-hed " + st;
    edBtnEl.querySelector(".cd-hed-n").textContent = f ? f.name : (off ? "редактор" : "нет .cpp");
    edBtnEl.querySelector(".cd-hed-e").textContent = f && f.errs ? String(f.errs) : "";
    var tip = off ? "Связь с редактором выключена" : !f ? "C/C++-файл в редакторе не открыт" :
      f.name + (f.errs ? " — " + f.errs + " " + plural(f.errs, ["ошибка", "ошибки", "ошибок"]) : " — ошибок нет");
    edBtnEl.title = tip + " · подробнее"; edBtnEl.setAttribute("aria-label", tip);
    if (edPopEl && !edPopEl.hidden) renderEdPop();
    fitHead();
  }
  function renderEdPop() {
    if (!edPopEl) return;
    var p = edEnv || {}, f = p.file, d = DATA(), runOn = !!(d && d.run && d.run.enabled);
    var rows = [];
    function row(ic, cls, html) { rows.push('<div class="cd-ep-row ' + cls + '"><span class="cd-ep-ic">' + ic + "</span><div>" + html + "</div></div>"); }
    if (p.off) row("⏸", "muted", "Связь с редактором выключена. Включи настройку <code>cppDocs.editorBridge</code> — окно будет подсказывать по слову под курсором и объяснять ошибки.");
    else if (!f) row("📄", "muted", "Открой <b>.cpp</b>-файл в редакторе — окно подскажет по слову под курсором и объяснит ошибки простым языком.");
    else {
      row("📄", "", "<b>" + escapeHtml(f.name) + "</b>" + (f.lang ? ' <span class="cd-ep-sub">' + escapeHtml(f.lang) + "</span>" : ""));
      if (f.errs) row("⚠", "bad", f.errs + " " + plural(f.errs, ["ошибка", "ошибки", "ошибок"]) + (f.first && f.first.line ? " · первая — строка " + f.first.line : "") +
        (f.first ? '<button class="cd-ep-go" type="button" data-act="err">Разобрать ошибку</button>' : ""));
      else row("✓", "good", "Ошибок нет");
    }
    if (p.cc === undefined) row("⚙", "muted", "Ищу компилятор…");
    else if (p.cc) row("⚙", "good", "Компилятор: <b>" + escapeHtml(p.cc.name) + "</b>");
    else row("⚙", "bad", "Компилятор не найден — поставь g++ (MSYS2) или укажи путь в настройке <code>cppDocs.compiler</code>.");
    row("▶", runOn ? "good" : "muted", runOn ? "Запуск задач прямо в окне включён" : "Запуск задач в окне выключен (настройка <code>cppDocs.localRun</code>)");
    setHTML(edPopEl, '<div class="cd-ep-h">Связь с редактором</div>' + rows.join(""));
  }
  var edPopDocBound = false;
  function toggleEdPop(force) {
    if (!winEl || !edBtnEl) return;
    var open = force !== undefined ? force : !(edPopEl && !edPopEl.hidden);
    if (!open) { if (edPopEl) edPopEl.hidden = true; return; }
    if (!edPopEl || !winEl.contains(edPopEl)) {   // окно могли закрыть и собрать заново
      edPopEl = el("div", null); edPopEl.className = "cd-edpop"; edPopEl.hidden = true;
      edPopEl.setAttribute("role", "dialog"); edPopEl.setAttribute("aria-label", "Связь с редактором");
      edPopEl.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest(".cd-ep-go"); if (!b) return;
        e.stopPropagation();
        var diag = edEnv && edEnv.file && edEnv.file.first; if (!diag) return;
        toggleEdPop(false);
        var ex = explainCompileError(diag.msg), t = errorDocTarget(ex.h);
        if (t) openFile(t.rel, t.hash); else hideHome();
        showBridgeError(diag);
        bridgePin = lastEditorKey;   // не прятать плашку при следующем опросе, пока курсор не сдвинется
      });
      if (!edPopDocBound) {   // один слушатель на документ — не плодим при пересборке окна
        edPopDocBound = true;
        document.addEventListener("mousedown", function (e) {
          if (edPopEl && !edPopEl.hidden && !edPopEl.contains(e.target) && !(edBtnEl && edBtnEl.contains(e.target))) edPopEl.hidden = true;
        }, true);
      }
      winEl.querySelector(".cd-head").appendChild(edPopEl);
    }
    renderEdPop();
    edPopEl.hidden = false;
    // Под кнопкой, но не за правым краем окна.
    var hr = edPopEl.parentNode.getBoundingClientRect(), br = edBtnEl.getBoundingClientRect();
    edPopEl.style.left = Math.max(8, Math.min(br.left - hr.left, hr.width - edPopEl.offsetWidth - 8)) + "px";
  }

  // Шапка не должна наезжать сама на себя: если крошкам остаётся мало места, по шагам
  // прячем подписи (кнопки остаются — с подсказками при наведении).
  function fitHead() {
    if (!winEl || !titleEl || winEl.classList.contains("rolled")) return;
    var title = titleEl.parentNode;
    winEl.classList.remove("hc1", "hc2", "hc3", "hc4");
    // Порог шире для темы (раздел › тема › подраздел), чем для главной (одно слово).
    var need = current && !winEl.classList.contains("home") ? 280 : 160;
    for (var lvl = 1; lvl <= 3 && title.clientWidth < need; lvl++) winEl.classList.add("hc" + lvl);
    // Совсем узко и всё равно не влезает — прячем «🎴» и «редактор» (они есть и на главной),
    // чтобы кнопки окна (✕ в первую очередь) никогда не уезжали за край.
    var head = title.parentNode;
    if (head.scrollWidth > head.clientWidth + 1) winEl.classList.add("hc4");
  }

  // ------- «Обучение»: руководство по интерфейсу (официальный стиль) -------
  var guideEl = null;
  var GUIDE_TABS = [["s0", "Обзор"], ["s1", "Окно"], ["s2", "Список"], ["s3", "Чтение"], ["s4", "Настройки"], ["s5", "Интерактив"], ["s6", "Ещё"]];
  // Живые демо строим настоящим рендером — их можно трогать прямо в гайде (без записи в прогресс).
  function guidePage(sec, inner) { return '<div class="cd-guide-page" data-sec="' + sec + '"' + (sec === "s0" ? "" : " hidden") + '>' + inner + "</div>"; }
  function buildGuidePanel() {
    var demoLive = renderMarkdown("```live\n@N = 3 [1..10]\n---\nfor (int i = 1; i <= {N}; ++i)\n    std::cout << i * i << \" \";\n---\n{for i=1..N} {i*i}\n```", []);
    var demoSteps = renderMarkdown("```steps\nint x = 2;\nx = x * 3;\nx += 1;\n---\n1 | x=2 | Создали `x`.\n2 | x=6 | Сначала считается правая часть: 2 * 3, потом результат кладётся в `x`.\n3 | x=7 | `x += 1` — то же, что `x = x + 1`.\n```", []);
    var demoQuiz = renderMarkdown("```quiz\nВ: Что выведет `std::cout << 7 / 2;` ?\n+ 3\n- 3.5\n- 2\n= Оба операнда целые — дробная часть отбрасывается (целочисленное деление).\n```", []);
    var demoFill = renderMarkdown("```fillcode\nint sum = 0;\nfor (int i = 1; i [[<=]] n; ++i)\n    sum [[+=]] i;\n```", []);
    var chips = GUIDE_TABS.map(function (t, i) {
      return '<button class="cd-guide-chip' + (i === 0 ? " on" : "") + '" type="button" data-sec="' + t[0] + '">' + t[1] + "</button>";
    }).join("");
    var pages =
      guidePage("s0",
        "<p>Это интерактивное руководство. Листайте вкладки сверху и <b>пробуйте примеры прямо здесь</b>. Материалы открываются в плавающем окне поверх редактора и работают автономно, без подключения к сети.</p>" +
        '<div class="cd-guide-try-row">' +
        '<button class="cd-guide-try" data-act="sepia" type="button">🎨 Попробовать сепию</button>' +
        '<button class="cd-guide-try" data-act="settings" type="button">⚙ Открыть настройки</button>' +
        '<button class="cd-guide-try" data-act="search" type="button">⌕ Перейти к поиску</button>' +
        '<button class="cd-guide-try" data-act="tour" type="button">👋 Показать знакомство снова</button></div>' +
        '<p class="cd-guide-note">«Попробовать сепию» переключит тему прямо сейчас — руководство тоже сменит цвет. Нажмите ещё раз, чтобы вернуть.</p>') +
      guidePage("s1",
        "<h3>Плавающее окно</h3><ul>" +
        "<li><b>Перемещение</b> — удерживая левую кнопку мыши на заголовке окна.</li>" +
        "<li><b>Изменение размера</b> — за края и углы окна.</li>" +
        "<li><b>Половина экрана</b> и <b>во весь экран</b> — кнопки в шапке окна.</li>" +
        "<li><b>Разделение</b> — открыть второй материал рядом с текущим.</li>" +
        "<li><b>Закрытие</b> — кнопка «✕» или клавиша Esc. Положение и размер окна сохраняются между сеансами.</li></ul>") +
      guidePage("s2",
        "<h3>Список материалов (слева)</h3><ul>" +
        "<li><b>Поиск</b> вверху фильтрует материалы по названию и содержимому.</li>" +
        "<li><b>Фильтры</b>: «Всё», «Не изучено», «Закреплённое», «С заметками».</li>" +
        "<li>Разделы сворачиваются; у раздела показан прогресс изучения.</li>" +
        "<li>У пункта — кружок прогресса (○ / изучено) и звёздочка закрепления (★).</li>" +
        "<li><b>Правый клик</b> по пункту открывает меню: вкладка, разделение, закрепление, отметка об изучении.</li></ul>" +
        '<div class="cd-guide-try-row"><button class="cd-guide-try" data-act="search" type="button">⌕ Перейти к поиску</button></div>') +
      guidePage("s3",
        "<h3>Чтение материала</h3><ul>" +
        "<li><b>«Разделы»</b> — боковое оглавление следит за прокруткой; строка сверху показывает текущий раздел.</li>" +
        "<li><b>Кольцо прогресса</b> отражает долю прочитанного; <b>«Отметить изученным»</b> фиксирует материал как пройденный.</li>" +
        "<li><b>★</b> у заголовка добавляет раздел в закладки; <b>#</b> копирует ссылку на раздел.</li>" +
        "<li><b>«Найти» (⌕)</b> ищет по тексту материала; отдельная кнопка копирует материал целиком.</li>" +
        "<li>Стрелки <b>«назад/вперёд»</b> перемещают по истории; переход к предыдущему и следующему материалу — по кнопкам маршрута.</li></ul>") +
      guidePage("s4",
        "<h3>Настройки (⚙)</h3><ul>" +
        "<li>Размер шрифта, ширина колонки, межстрочный интервал.</li>" +
        "<li><b>Режим фокуса</b> скрывает список и оглавление, оставляя только текст.</li>" +
        "<li><b>Тема</b>: авто, светлая, тёмная, сепия.</li>" +
        "<li><b>«Разборы»</b> — режим «только основное» сворачивает пояснения под кодом.</li>" +
        "<li>Подсказки-термины, анимации, шрифт чтения.</li></ul>" +
        '<div class="cd-guide-try-row">' +
        '<button class="cd-guide-try" data-act="sepia" type="button">🎨 Попробовать сепию</button>' +
        '<button class="cd-guide-try" data-act="settings" type="button">⚙ Открыть настройки</button></div>') +
      guidePage("s5",
        "<h3>Интерактивные материалы</h3><p>Материалы содержат блоки, с которыми можно работать. Попробуйте прямо здесь:</p>" +
        '<p class="cd-guide-hint">Двигайте ползунок — код и вывод пересчитаются:</p><div class="cd-guide-demo cd-article">' + demoLive + "</div>" +
        '<p class="cd-guide-hint">Нажимайте «Шаг ▶» — стрелка пройдёт по программе, справа видны переменные:</p><div class="cd-guide-demo cd-article">' + demoSteps + "</div>" +
        '<p class="cd-guide-hint">Выберите ответ:</p><div class="cd-guide-demo cd-article">' + demoQuiz + "</div>" +
        '<p class="cd-guide-hint">Впишите пропущенное и нажмите «Проверить»:</p><div class="cd-guide-demo cd-article">' + demoFill + "</div>" +
        "<p>Ещё есть <b>карточки</b> с интервальным повторением, <b>ката</b> («собери код», «предскажи вывод», «напиши и запусти» — компиляция и проверка по тестам при включённой <code>cppDocs.localRun</code>) и блок <b>«Смотри также»</b> в конце материала.</p>" +
        '<div class="cd-guide-try-row">' +
        '<button class="cd-guide-try" data-act="live" type="button">▶ Открыть живой пример</button>' +
        '<button class="cd-guide-try" data-act="kata" type="button">🧩 Открыть ката</button>' +
        '<button class="cd-guide-try" data-act="steps" type="button">👣 Пройти код по шагам</button></div>') +
      guidePage("s6",
        "<h3>Связь с редактором</h3><p>При установке курсора на слово в файле C/C++ окно показывает краткую подсказку по этому слову и кнопку перехода к справочнику. Отключается настройкой <code>cppDocs.editorBridge</code>.</p>" +
        "<h3>Главный экран</h3><p>«Продолжить» открывает следующий неизученный материал; блок повторения предлагает карточки, готовые к повтору; «Быстрый доступ» и поиск ускоряют переход.</p>" +
        "<h3>Клавиатура</h3><p>Клавиша Esc последовательно закрывает: это руководство, затем поиск по материалу, затем окно.</p>");
    return '<div class="cd-guide-panel"><div class="cd-guide-top">' +
      '<div class="cd-guide-title">Обучение — как пользоваться</div>' +
      '<button class="cd-guide-close" type="button" title="Закрыть" aria-label="Закрыть">✕</button></div>' +
      '<div class="cd-guide-tabs">' + chips + "</div>" +
      '<div class="cd-guide-scroll">' + pages + "</div></div>";
  }
  function guideShowSection(sec) {
    if (!guideEl) return;
    guideEl.querySelectorAll(".cd-guide-chip").forEach(function (c) { c.classList.toggle("on", c.getAttribute("data-sec") === sec); });
    guideEl.querySelectorAll(".cd-guide-page").forEach(function (p) { p.hidden = p.getAttribute("data-sec") !== sec; });
    var sc = guideEl.querySelector(".cd-guide-scroll"); if (sc) sc.scrollTop = 0;
  }
  function guideAction(act) {
    if (act === "sepia") { state.theme = (state.theme === "sepia" ? "auto" : "sepia"); saveState(); applyThemeClasses(); applyAccent(); }
    else if (act === "settings") { hideGuide(); openSettings(); }
    else if (act === "tour") { hideGuide(); showHome(); setTimeout(startTour, 300); }
    else if (act === "search") { hideGuide(); if (searchInput) { try { searchInput.focus(); searchInput.select(); } catch (e) {} } }
    else if (act === "live" || act === "kata" || act === "steps") {
      var needle = act === "live" ? "```live" : act === "steps" ? "```steps" : "```challenge";
      var d = DATA();
      if (d && d.files) for (var i = 0; i < d.files.length; i++) {
        if ((d.files[i].md || "").indexOf(needle) >= 0) { hideGuide(); openFile(d.files[i].rel); return; }
      }
      hideGuide();
    }
  }
  function onGuideClick(e) {
    var t = e.target; if (!t) return;
    if (t === guideEl) { hideGuide(); return; }               // клик по затемнённому фону
    if (t.closest) {
      if (t.closest(".cd-guide-close")) { hideGuide(); return; }
      var chip = t.closest(".cd-guide-chip"); if (chip) { e.preventDefault(); guideShowSection(chip.getAttribute("data-sec")); return; }
      var tb = t.closest(".cd-guide-try"); if (tb) { e.preventDefault(); guideAction(tb.getAttribute("data-act")); return; }
      var te = t.closest(".cd-toed"); if (te) { sendToEditor(te); return; }
      var cp = t.closest(".copybtn"); if (cp) { doCopy(cp); return; }
    }
    quizClick(e);   // встроенные демо: квиз, «заполни пропуск» и т. п.
  }
  function showGuide() {
    if (!winEl) return;
    if (!guideEl) {
      guideEl = el("div", null); guideEl.className = "cd-guide"; guideEl.hidden = true;
      guideEl.setAttribute("role", "dialog"); guideEl.setAttribute("aria-label", "Обучение — как пользоваться");
      guideEl.addEventListener("click", onGuideClick);
      guideEl.addEventListener("input", onArticleInput);   // ползунки живых примеров внутри гайда
      winEl.appendChild(guideEl);
    }
    setHTML(guideEl, buildGuidePanel());   // пересобираем при каждом открытии — демо свежие, без следов
    guideShowSection("s0");
    guideEl.hidden = false;
  }
  function hideGuide() { if (guideEl) guideEl.hidden = true; }

  // ==== runtime/11-open.js — открытие файла, маркер, задачник, заметки ====
  // ------- открытие файла -------
  // silent=true — стартовая предзагрузка материала ПОД главным экраном: показать его
  // в читалке, но не трогать «последний»/историю/прогресс. Иначе при самом первом
  // запуске главный экран увидит уже помеченный файл и покажет «С возвращением» и
  // ненулевой прогресс по тому, что пользователь ещё не открывал.
  function openFile(rel, hash, silent) {
    hideHome();
    hideTour();
    var map = fileMap();
    var f = map[String(rel).toLowerCase()];
    if (!f) return;
    // запомнить позицию прокрутки в уходящем файле
    if (current && contentEl) state.scroll[current.rel] = contentEl.scrollTop;
    current = f;
    cdShareView();
    if (!silent) {
      state.last = f.rel.toLowerCase();
      // Недавнее: свежий файл — в начало, без дублей, не длиннее 8.
      var rl = String(f.rel).toLowerCase();
      state.recent = (Array.isArray(state.recent) ? state.recent : [])
        .filter(function (r) { return String(r).toLowerCase() !== rl; });
      state.recent.unshift(f.rel);
      if (state.recent.length > 8) state.recent = state.recent.slice(0, 8);
    }
    if (!silent && !navHist) pushHistory(f.rel, hash || "");
    // Служебная группа «Главное» (шпаргалка, FAQ…) стоит над курсом. После первого открытого
    // материала один раз сворачиваем её, чтобы сверху был сам курс; дальше — как решит человек.
    if (!silent && !state.mainFolded) {
      state.mainFolded = true; state.collapsed["Главное"] = true;
      renderNav();
    }
    syncActiveTab(f.rel);

    if (rnameEl) rnameEl.textContent = f.title || f.name;
    if (crumbEl) crumbEl.textContent = "";
    var headings = [];
    setHTML(articleEl, renderMarkdown(f.md || "", headings));
    headings = tidyArticle(headings);   // в окне: убрать дубли навигации и оглавления (сами .md не трогаем)
    // мягкое проявление статьи
    articleEl.classList.remove("fade"); void articleEl.offsetWidth; articleEl.classList.add("fade");
    resolveImages();
    try { annotateAhead(articleEl, f.rel); } catch (e) { reportError("забегаем вперёд", e); }
    buildOutline(headings);
    collectHeadings();
    buildRouteNav(f);
    decorateTasks(f);
    decorateTaskTables(f);  // таблицы «Задачи темы»: строка-задача кликабельна (переход к заданию)
    decorateSolutions(f);   // решения внизу: «↑ к задаче», отметка «решено», «Другой подход» карточкой
    wireFolding();          // сворачивание разделов — после decorateTasks (пропускаем cd-task)
    annotateTerms(articleEl);   // подсказки-термины при наведении (после структурных правок DOM)
    try { initMemory(articleEl); initFrames(articleEl); } catch (e) {}   // «Память по шагам» и «Кадры»: первый шаг/кадр
    applyExpandNotes();         // режим «только основное»: свернуть/раскрыть все разборы
    syncBookmarks();
    renderNotes(f);
    addKicker(f);       // «Создание игр · тема 3 из 9 · ~12 мин» — где я в курсе
    if (state.rolled) applyRoll();   // свёрнутая полоска показывает новую тему
    appendSeeAlso(f);   // блок «Смотри также» — связанные материалы в конце
    // «Разобрался → следующая» и «Предыдущая / Следующая» — самым последним, где заканчивается чтение
    ["cd-rn-done", "cd-routenav"].forEach(function (c) { var n = articleEl.querySelector(":scope > ." + c); if (n) articleEl.appendChild(n); });
    setupSections();    // режим «по разделам» (если включён в настройках)
    applyHighlights(f); // наложить сохранённые выделения-маркер
    syncReadBtn();
    highlightActive();
    findReset();   // смена файла — сбрасываем поиск по тексту
    // «Изучено» больше НЕ ставится автоматически при открытии темы — только вручную
    // (кнопка «Отметить изученным» в читалке или ○/✓ в навигаторе), как «решено» в задачнике.
    if (!silent) recordActivity();
    saveState();
    // прокрутка к якорю, к сохранённой позиции или наверх
    if (hash) {
      var target = articleEl.querySelector('[id="' + cssEscape(decodeURIComponent(hash.replace(/^#/, ""))) + '"]');
      if (target) { unfoldContaining(target); target.scrollIntoView({ block: "start" }); flashHeading(target); onContentScroll(); searchJumpTerm = ""; return; }
    }
    contentEl.scrollTop = state.scroll[f.rel] || 0;
    onContentScroll();
    consumeSearchJump();   // если открыли из поиска — подсветить слово и прыгнуть к нему
  }
  // Связанные материалы: общие значимые слова заголовка/подзаголовка + бонус за свой раздел.
  // Пусто по теме — берём соседей по разделу, чтобы блок не был бесполезным.
  function relatedFiles(f) {
    var d = DATA(); if (!d || !d.files) return [];
    var mine = {}; norm((f.title || "") + " " + (f.subtitle || "")).split(/ +/).forEach(function (w) { if (w.length >= 4) mine[w] = 1; });
    var scored = [], sameGroup = [];
    d.files.forEach(function (o) {
      if (o.rel === f.rel) return;
      if (o.group === f.group) sameGroup.push(o);
      var s = 0;
      norm((o.title || "") + " " + (o.subtitle || "")).split(/ +/).forEach(function (w) { if (w.length >= 4 && mine[w]) s++; });
      if (o.group === f.group) s += 0.5;
      if (s > 0) scored.push({ f: o, s: s });
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    var out = scored.slice(0, 4).map(function (x) { return x.f; });
    for (var i = 0; out.length < 3 && i < sameGroup.length; i++) {          // добить соседями по разделу
      if (out.indexOf(sameGroup[i]) < 0) out.push(sameGroup[i]);
    }
    return out.slice(0, 4);
  }
  // Значки разделов (рисованные, без лиц). Группы без значка — с цветной точкой, как раньше.
  var GROUP_BADGE = {
    "Справочник по темам": "badge-ref", "Справка и словари": "badge-ref", "Задачник": "badge-tasks", "Примеры программ": "badge-examples",
    "Сквозной проект": "badge-proekt", "Создание игр": "badge-igry", "Главное": "badge-main", "Мои заметки": "badge-notes"
  };
  function groupBadge(label) {
    var k = GROUP_BADGE[label];
    return (k && typeof STICKERS !== "undefined" && STICKERS && STICKERS[k]) || "";
  }
  // Строка-ориентир над статьёй: группа (её цветом), номер темы в группе и время чтения.
  function addKicker(f) {
    syncHead();   // крошки «раздел › тема», цвет шапки по разделу, «Дальше»
    // Крупное название темы над вводным абзацем (первый # из .md в статью не рендерится).
    if (articleEl && f) {
      var ttl = document.createElement("h1"); ttl.className = "cd-atitle";
      ttl.textContent = f.title || f.name;
      articleEl.insertBefore(ttl, articleEl.firstChild);
    }
    if (!articleEl || !f || !f.group) return;
    var d = DATA(); if (!d) return;
    var same = d.files.filter(function (o) { return o.group === f.group; });
    var idx = same.indexOf(f);
    if (same.length < 2 || idx < 0) return;
    var k = document.createElement("div");
    k.className = "cd-kicker";
    k.style.setProperty("--gcolor", f.groupColor || "var(--ac)");
    var kb = groupBadge(f.group);
    setHTML(k, '<span class="cd-kk-g">' + (kb ? '<img class="cd-kk-ic" src="' + kb + '" alt="" draggable="false">' : "") + escapeHtml(f.group) + "</span>" +
      '<span class="cd-kk-n">тема ' + (idx + 1) + " из " + same.length + "</span>" +
      (f.minutes ? '<span class="cd-kk-m">~' + f.minutes + " мин</span>" : "") +
      (state.read[f.rel] ? '<span class="cd-kk-ok">изучено</span>' : ""));
    articleEl.insertBefore(k, articleEl.firstChild);
    addCover(f, k);
  }
  // Обложка темы: полоса цветом раздела с крупным значком раздела (или рисованный баннер
  // cover-<раздел>.webp, если он есть). Внутрь переезжают строка-ориентир и название темы.
  function addCover(f, kicker) {
    if (!state.covers || !articleEl) return;
    var ttl = articleEl.querySelector("h1.cd-atitle");
    if (!ttl) return;
    var key = GROUP_BADGE[f.group] || "";
    var art = key && STICKERS && STICKERS[key.replace(/^badge-/, "cover-")];
    var badge = groupBadge(f.group);
    var cv = document.createElement("div");
    cv.className = "cd-cover" + (art ? " has-art" : "");
    cv.style.setProperty("--gcolor", f.groupColor || "var(--ac)");
    if (art) cv.style.setProperty("--cover-img", 'url("' + art + '")');
    if (badge && !art) {
      var bi = document.createElement("img");
      bi.className = "cd-cover-badge"; bi.src = badge; bi.alt = ""; bi.draggable = false;
      cv.appendChild(bi);
    }
    articleEl.insertBefore(cv, kicker || ttl);
    if (kicker) cv.appendChild(kicker);
    cv.appendChild(ttl);
  }
  function appendSeeAlso(f) {
    if (!articleEl) return;
    var rel = relatedFiles(f);
    if (!rel.length) return;
    var html = '<nav class="cd-seealso" aria-label="Смотри также"><div class="cd-seealso-h">Смотри также</div><div class="cd-seealso-list">';
    rel.forEach(function (o) {
      html += '<button class="cd-see" type="button" data-rel="' + escapeHtml(o.rel) + '">' +
        '<span class="cd-see-t">' + escapeHtml(o.title || o.name) + "</span>" +
        (o.subtitle ? '<span class="cd-see-s">' + escapeHtml(o.subtitle) + "</span>" : "") +
        '<span class="cd-see-g" style="color:' + escapeHtml(o.groupColor || "var(--muted)") + '">' + escapeHtml(o.group || "") + "</span></button>";
    });
    html += "</div></nav>";
    var wrap = el("div"); setHTML(wrap, html);
    if (wrap.firstChild) articleEl.appendChild(wrap.firstChild);
  }

  // ------- маркер по тексту: выделяешь фрагмент — он подсвечивается и запоминается -------
  var hlPop = null;
  // Снять все пользовательские выделения (перед повторным наложением и чтобы искать по чистому тексту).
  function clearUserHighlights(root) {
    if (!root) return;
    var marks = root.querySelectorAll(".cd-hlu");
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (m.parentNode) m.parentNode.replaceChild(document.createTextNode(m.textContent), m);
    }
    try { root.normalize(); } catch (e) {}
  }
  // Обернуть первое вхождение text в <mark.cd-hlu>. Ищем в текстовых узлах прозы (код/кнопки/интерактив
  // пропускаем). norm сохраняет длину, поэтому индекс совпадает с оригиналом.
  function wrapFirstHl(root, text, color) {
    var needle = norm(text); if (!needle) return false;
    var done = false;
    (function walk(n) {
      for (var c = n.firstChild; c && !done; c = c.nextSibling) {
        if (c.nodeType === 3) {
          var t = c.nodeValue, idx = norm(t).indexOf(needle);
          if (idx >= 0) {
            var frag = document.createDocumentFragment();
            if (idx > 0) frag.appendChild(document.createTextNode(t.slice(0, idx)));
            var mk = document.createElement("mark"); mk.className = "cd-hlu cd-hlu-" + (color || "y");
            mk.setAttribute("data-hl", encodeURIComponent(text));
            mk.title = "Клик — убрать выделение";
            mk.textContent = t.slice(idx, idx + text.length);
            frag.appendChild(mk);
            if (idx + text.length < t.length) frag.appendChild(document.createTextNode(t.slice(idx + text.length)));
            c.parentNode.replaceChild(frag, c); done = true; return;
          }
        } else if (c.nodeType === 1) {
          var tag = c.tagName;
          if (tag === "PRE" || tag === "CODE" || tag === "MARK" || tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "TEXTAREA") continue;
          if (c.classList && (c.classList.contains("cd-live") || c.classList.contains("cd-quiz") || c.classList.contains("cd-ch") || c.classList.contains("cd-fc") || c.classList.contains("cd-seealso"))) continue;
          walk(c);
        }
      }
    })(root);
    return done;
  }
  // Наложить сохранённые выделения материала (после рендера/изменения).
  function applyHighlights(f) {
    if (!articleEl || !f) return;
    clearUserHighlights(articleEl);
    var arr = state.hl[f.rel];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (e) { wrapFirstHl(articleEl, e.t, e.c); });
  }
  function addHighlight(text, color) {
    if (!current) return;
    var t = String(text).replace(/\s+/g, " ").trim();
    if (t.length < 2 || t.length > 300) return;
    var col = (color === "p" || color === "g") ? color : "y";
    var arr = state.hl[current.rel] || [];
    var ex = null; for (var i = 0; i < arr.length; i++) if (arr[i].t === t) { ex = arr[i]; break; }
    if (ex) ex.c = col; else arr.push({ t: t, c: col });   // тот же текст — перекрашиваем, не дублируем
    state.hl[current.rel] = arr; saveState(); applyHighlights(current);
    if (typeof syncFilterChips === "function") try { syncFilterChips(); } catch (e) {}
  }
  function removeHighlight(mark) {
    var t = decodeURIComponent(mark.getAttribute("data-hl") || "");
    if (current && Array.isArray(state.hl[current.rel])) {
      state.hl[current.rel] = state.hl[current.rel].filter(function (x) { return x.t !== t; });
      if (!state.hl[current.rel].length) delete state.hl[current.rel];
      saveState(); applyHighlights(current);
      if (typeof syncFilterChips === "function") try { syncFilterChips(); } catch (e) {}
    }
  }
  // Всплывающая кнопка «Выделить» рядом с выделением текста.
  function hideHlPop() { if (hlPop) hlPop.hidden = true; }
  function ensureHlPop() {
    if (hlPop) return;
    hlPop = el("div", null); hlPop.className = "cd-hlpop"; hlPop.hidden = true;
    setHTML(hlPop, '<span class="cd-hlpop-ic" aria-hidden="true">🖊</span>' +
      '<button type="button" class="cd-hlpop-c cd-hlpop-y" data-c="y" title="Важное" aria-label="Выделить жёлтым — важное"></button>' +
      '<button type="button" class="cd-hlpop-c cd-hlpop-p" data-c="p" title="Вопрос" aria-label="Выделить розовым — вопрос"></button>' +
      '<button type="button" class="cd-hlpop-c cd-hlpop-g" data-c="g" title="Выучить" aria-label="Выделить зелёным — выучить"></button>' +
      '<button type="button" class="cd-hlpop-note" title="Дописать цитату со ссылкой в «Мои заметки»">📝 в заметки</button>');
    // mousedown (а не click), чтобы не сбросить выделение до срабатывания
    hlPop.addEventListener("mousedown", function (e) {
      var nb = e.target.closest && e.target.closest(".cd-hlpop-note");
      e.preventDefault();
      if (nb) {
        e.stopPropagation();
        if (hlPop._text) sendNote(hlPop._text);   // раздел ищем по ещё живому выделению — снимаем после
        try { var s0 = window.getSelection(); if (s0) s0.removeAllRanges(); } catch (er) {}
        hideHlPop();
        return;
      }
      var b = e.target.closest && e.target.closest(".cd-hlpop-c");
      if (!b) return;
      e.stopPropagation();
      if (hlPop._text) addHighlight(hlPop._text, b.getAttribute("data-c"));
      try { var s = window.getSelection(); if (s) s.removeAllRanges(); } catch (er) {}
      hideHlPop();
    });
    document.body.appendChild(hlPop);
  }
  // Выделение внутри статьи (в одном текстовом узле прозы) → показать кнопку над ним.
  function onArticleSelect() {
    if (!winEl || !articleEl) { hideHlPop(); return; }
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { hideHlPop(); return; }
    if (sel.anchorNode !== sel.focusNode || !sel.anchorNode || sel.anchorNode.nodeType !== 3) { hideHlPop(); return; }  // только один текстовый узел
    if (!articleEl.contains(sel.anchorNode)) { hideHlPop(); return; }
    var par = sel.anchorNode.parentNode;
    if (par && par.closest && par.closest("pre,code,button,a,input,textarea,.cd-live,.cd-quiz,.cd-ch,.cd-fc,.cd-seealso,.cd-hlu")) { hideHlPop(); return; }
    var txt = String(sel.toString()).replace(/\s+/g, " ").trim();
    if (txt.length < 2 || txt.length > 300) { hideHlPop(); return; }
    ensureHlPop();
    var r = sel.getRangeAt(0).getBoundingClientRect();
    hlPop._text = txt;
    hlPop.hidden = false;
    hlPop.style.left = Math.round(Math.max(6, r.left + r.width / 2 - 95)) + "px";
    hlPop.style.top = Math.round(Math.max(6, r.top - 40)) + "px";
  }
  // ---- Прогресс по задачнику: отметки «решено» у задач ## N.M. ----
  function isTaskFile(rel) { return /(^|\/)zadachnik\//i.test(String(rel || "")); }
  function isTaskHeading(t) { return /^\s*\d+\.\d+\./.test(t || ""); }
  // Всего задач в теме и сколько решено (по DOM после рендера).
  function decorateTasks(f) {
    if (!f || !isTaskFile(f.rel) || !articleEl) return;
    var total = 0, solved = 0;
    articleEl.querySelectorAll("h2[id]").forEach(function (h) {
      if (!isTaskHeading(h.textContent)) return;
      total++;
      var key = f.rel + "#" + h.id;
      var on = !!state.solved[key];
      if (on) solved++;
      var b = el("button");                 // NB: el(tag, css, text) — 2-й аргумент это СТИЛЬ, класс ставим сами
      b.type = "button";
      b.className = "cd-solve" + (on ? " on" : "");
      b.setAttribute("data-key", key);
      b.textContent = on ? "✓ решено" : "отметить решённой";
      h.classList.add("cd-task");
      h.classList.toggle("cd-task-done", on);
      h.appendChild(b);
      // «Заготовка»: новый .cpp с каркасом программы и условием задачи в комментарии
      var st = el("button"); st.type = "button"; st.className = "cd-taskstub";
      st.textContent = "↳ заготовка";
      st.title = "Открыть новый .cpp: #include, main, русские буквы в консоли и условие задачи комментарием";
      h.appendChild(st);
    });
    // #3 Карточки: каждую задачу (## N.M. … до разделителя) заворачиваем в .cd-taskcard
    articleEl.querySelectorAll("h2.cd-task").forEach(function (h) {
      var card = document.createElement("div");
      card.className = "cd-taskcard";
      h.parentNode.insertBefore(card, h);
      var node = h;
      while (node) {
        var next = node.nextSibling;
        card.appendChild(node);                 // перенос узла в карточку
        if (!next) break;
        if (next.nodeType === 1) {
          if ((next.classList && next.classList.contains("cd-task")) || next.tagName === "H1") break;
          if (next.tagName === "HR") { next.parentNode.removeChild(next); break; }  // убрать разделитель между карточками
        }
        node = next;
      }
    });
    if (total) {
      var bar = el("div");
      bar.className = "cd-taskbar";
      bar.setAttribute("data-taskbar", "1");
      var cells = "";
      for (var k = 0; k < total; k++) cells += '<i class="cd-tb-cell' + (k < solved ? " on" : "") + '"></i>';
      setHTML(bar, '<div class="cd-tb-top">Решено <b class="cd-tb-s">' + solved + '</b> из <b>' + total + '</b> задач темы</div>' +
        '<div class="cd-tb-track">' + cells + '</div>');
      articleEl.insertBefore(bar, articleEl.firstChild);
    }
  }
  // Заголовок задачи N.M в статье (h2.cd-task), или null.
  function taskHeading(num) {
    if (!articleEl || !num) return null;
    var heads = articleEl.querySelectorAll("h2.cd-task");
    for (var i = 0; i < heads.length; i++) if ((heads[i].textContent || "").trim().indexOf(num + ".") === 0) return heads[i];
    return null;
  }
  // Решения внизу страницы задачника: у каждого — «↑ к задаче», отметка «решено» и карточка «Другой подход».
  function decorateSolutions(f) {
    if (!f || !isTaskFile(f.rel) || !articleEl) return;
    articleEl.querySelectorAll("details").forEach(function (d) {
      var sm = d.querySelector("summary");
      var m = sm && (sm.textContent || "").match(/^\s*(?:Полное решение|Ответ)\s+(\d+\.\d+)/);
      if (!m) return;
      var num = m[1], body = d.querySelector(".cd-spoiler-body") || d;
      d.classList.add("cd-soldet");
      d.setAttribute("data-num", num);
      var h = taskHeading(num);
      d.classList.toggle("cd-sol-solved", !!(h && h.classList.contains("cd-task-done")));
      if (!body.querySelector(".cd-sol-back")) {
        var back = el("button"); back.type = "button"; back.className = "cd-sol-back";
        back.setAttribute("data-num", num); back.textContent = "↑ к задаче " + num;
        body.insertBefore(back, body.firstChild);
      }
      Array.prototype.slice.call(body.children).forEach(function (p) {
        var st = p.tagName === "P" && p.firstElementChild;
        if (!st || st.tagName !== "STRONG" || !/^Другой подход/.test(st.textContent || "")) return;
        var card = el("div"); card.className = "cd-alt";
        p.parentNode.insertBefore(card, p);
        p.classList.add("cd-alt-h");
        var next = p.nextElementSibling;
        card.appendChild(p);
        if (next && (next.classList.contains("codewrap") || next.tagName === "PRE")) { var n2 = next.nextElementSibling; card.appendChild(next); next = n2; }
        if (next && next.tagName === "BLOCKQUOTE") { next.classList.add("cd-alt-cmp"); card.appendChild(next); }
      });
    });
  }
  // Ссылка «внизу страницы» у задачи — сразу к решению ЭТОЙ задачи (раскрыть и показать).
  function openSolution(num) {
    var d = articleEl && articleEl.querySelector('details.cd-soldet[data-num="' + num + '"]');
    if (!d) return false;
    d.open = true;
    unfoldContaining(d);
    d.scrollIntoView({ block: "start" });
    d.classList.remove("cd-sol-flash"); void d.offsetWidth; d.classList.add("cd-sol-flash");
    return true;
  }
  // Клик по строке таблицы «Задачи темы» (в задачнике) — переход к самой задаче (её заголовку).
  // При наведении на строку появляется подсказка «Перейти к заданию →».
  function decorateTaskTables(f) {
    if (!f || !isTaskFile(f.rel) || !articleEl) return;
    articleEl.querySelectorAll("table").forEach(function (tbl) {
      var marked = false;
      tbl.querySelectorAll("tr").forEach(function (tr) {
        var cell = tr.querySelector("td");
        if (!cell) return;                                   // строка-заголовок (th) — пропускаем
        var num = (cell.textContent || "").trim();
        if (!/^\d+\.\d+$/.test(num)) return;                 // не строка-задача
        marked = true;
        tr.classList.add("cd-taskrow");
        tr.setAttribute("data-num", num);
        var th = taskHeading(num);
        tr.classList.toggle("cd-taskrow-done", !!(th && th.classList.contains("cd-task-done")));   // ✓ у решённых
        var last = tr.querySelector("td:last-child");
        if (last && !last.querySelector(".cd-taskrow-go")) {
          var go = el("span", null, "Перейти к заданию →"); go.className = "cd-taskrow-go";
          last.appendChild(go);
        }
      });
      if (marked) tbl.classList.add("cd-tasktable");
    });
  }
  function gotoTask(num) {
    if (!num || !articleEl) return;
    var heads = articleEl.querySelectorAll("h2.cd-task"), target = null;
    for (var i = 0; i < heads.length; i++) {
      var t = (heads[i].textContent || "").trim();
      if (t.indexOf(num + ".") === 0 || t.indexOf(num + " ") === 0) { target = heads[i]; break; }
    }
    if (!target) return;
    unfoldContaining(target);
    target.scrollIntoView({ block: "start" });
    flashHeading(target);
  }
  function toggleSolved(btn) {
    var key = btn.getAttribute("data-key");
    if (!key) return;
    var on = !state.solved[key];
    if (on) state.solved[key] = true; else delete state.solved[key];
    btn.classList.toggle("on", on);
    btn.textContent = on ? "✓ решено" : "отметить решённой";
    var h = btn.closest ? btn.closest("h2") : null;
    if (h) h.classList.toggle("cd-task-done", on);
    var tnum = h && ((h.textContent || "").match(/^\s*(\d+\.\d+)/) || [])[1];
    if (tnum && articleEl) {
      articleEl.querySelectorAll('tr.cd-taskrow[data-num="' + tnum + '"]').forEach(function (tr) { tr.classList.toggle("cd-taskrow-done", on); });
      var sd = articleEl.querySelector('details.cd-soldet[data-num="' + tnum + '"]'); if (sd) sd.classList.toggle("cd-sol-solved", on);
    }
    syncNextBtn();
    var bar = articleEl.querySelector("[data-taskbar]");
    if (bar) {
      var s = 0;
      articleEl.querySelectorAll("h2.cd-task").forEach(function (x) { if (x.classList.contains("cd-task-done")) s++; });
      var sEl = bar.querySelector(".cd-tb-s"); if (sEl) sEl.textContent = s;
      var cells = bar.querySelectorAll(".cd-tb-cell");
      for (var ci = 0; ci < cells.length; ci++) cells[ci].classList.toggle("on", ci < s);
    }
    recordActivity();
    saveState();
    // #10 Праздник при отметке «решено» — зелёно-мятный залп у кнопки.
    if (on) { celebrate(btn, ["#a6e3a1", "#94e2d5", "#f9e2af", "#89b4fa"]); pulse(btn); }
  }

  // ---- Личные заметки к материалу ----
  var _saveT = null;
  function scheduleSave() {
    if (_saveT) clearTimeout(_saveT);
    _saveT = setTimeout(function () { _saveT = null; saveState(); }, 400);
  }
  function renderNotes(f) {
    if (!f || !articleEl) return;
    var wrap = el("div"); wrap.className = "cd-notes";
    var head = el("div", null, "📝 Мои заметки"); head.className = "cd-notes-h";
    var ta = document.createElement("textarea");
    ta.className = "cd-notes-ta";
    ta.rows = 3;
    ta.placeholder = "Заметки к этому материалу — сохраняются автоматически, только у вас…";
    ta.value = (state.notes[f.rel] != null) ? state.notes[f.rel] : "";
    ta.addEventListener("input", function () {
      if (ta.value) state.notes[f.rel] = ta.value; else delete state.notes[f.rel];
      refreshItemNote(f.rel);
      scheduleSave();
    });
    wrap.appendChild(head);
    wrap.appendChild(ta);
    articleEl.appendChild(wrap);
  }
  // Пометка в навигаторе, если у файла есть заметка.
  function refreshItemNote(rel) {
    var it = itemEls.filter(function (x) { return x.getAttribute("data-rel") === rel; })[0];
    if (it) it.classList.toggle("has-note", !!state.notes[rel]);
  }

  // ---- Серия дней активности ----
  function dayKey(dt) {
    var m = dt.getMonth() + 1, d = dt.getDate();
    return dt.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (d < 10 ? "0" + d : d);
  }
  // Активность по дням: { "ГГГГ-ММ-ДД": число действий } (старый формат — true, считается за 1).
  function dayCount(k) { var v = state.days[k]; return v === true ? 1 : (typeof v === "number" && v > 0 ? v : 0); }
  function recordActivity() {
    var t = dayKey(new Date());
    state.days[t] = Math.min(999, dayCount(t) + 1);
    scheduleSave();
  }
  // Тепловая карта активности за 12 недель (как на GitHub): колонки — недели, строки — дни
  // пн…вс, яркость — сколько сделано за день. Пустая неделя не так расстраивает, как 7 пустых
  // квадратиков подряд, а длинная серия видна целиком. Сегодня — с обводкой.
  var HEAT_WEEKS = 12;
  function heatLevel(n) { return n <= 0 ? 0 : n <= 1 ? 1 : n <= 3 ? 2 : n <= 7 ? 3 : 4; }
  function heroWeek() {
    var today = new Date(); today.setHours(12, 0, 0, 0);
    var dow = (today.getDay() + 6) % 7;                 // 0 = пн … 6 = вс
    var start = new Date(today); start.setDate(start.getDate() - dow - (HEAT_WEEKS - 1) * 7);
    var months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    var cols = "", heads = "", active = 0, lastMonth = -1, d = new Date(start);
    for (var w = 0; w < HEAT_WEEKS; w++) {
      var col = "";
      heads += '<span class="cd-hm-m">' + (d.getMonth() !== lastMonth ? months[d.getMonth()] : "") + "</span>";
      lastMonth = d.getMonth();
      for (var i = 0; i < 7; i++) {
        var future = d > today, k = dayKey(d), n = future ? 0 : dayCount(k);
        if (n) active++;
        var isToday = d.getTime() === today.getTime();
        col += '<i class="cd-hm-c l' + heatLevel(n) + (isToday ? " today" : "") + (future ? " fut" : "") + '"' +
          (future ? "" : ' title="' + k + (n ? " — действий: " + n : " — без занятий") + '"') + "></i>";
        d.setDate(d.getDate() + 1);
      }
      cols += '<span class="cd-hm-w">' + col + "</span>";
    }
    var streak = streakDays();
    return '<div class="cd-home-week cd-heat" aria-label="Активность за ' + HEAT_WEEKS + ' недель: дней с занятиями ' + active + '">' +
      '<div class="cd-hm-heads">' + heads + '</div><div class="cd-hm-grid">' + cols + '</div>' +
      '<div class="cd-hm-foot"><span class="cd-wk-n">' + active + " " + plural(active, ["день", "дня", "дней"]) + " за " + HEAT_WEEKS + " недель" +
      (streak ? " · серия " + streak : "") + '</span><span class="cd-hm-leg">меньше <i class="cd-hm-c l0"></i><i class="cd-hm-c l1"></i><i class="cd-hm-c l2"></i><i class="cd-hm-c l3"></i><i class="cd-hm-c l4"></i> больше</span></div></div>';
  }
  function streakDays() {
    var d = new Date();
    if (!state.days[dayKey(d)]) { d.setDate(d.getDate() - 1); if (!state.days[dayKey(d)]) return 0; }
    var s = 0;
    while (state.days[dayKey(d)]) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }
  // Всего задач в задачнике и сколько решено (для дашборда).
  function taskStats() {
    var d = DATA(), total = 0;
    if (d && d.files) d.files.forEach(function (f) {
      if (!/(^|\/)zadachnik\//i.test(f.rel)) return;
      var mm = (f.md || "").match(/^##\s+\d+\.\d+\./gm);
      if (mm) total += mm.length;
    });
    var done = Object.keys(state.solved || {}).filter(function (k) { return state.solved[k]; }).length;
    if (done > total) done = total;
    return { total: total, done: done };
  }

  // Все задачи задачника как [{rel, slug, key}]; onlyUnsolved — только ещё не отмеченные «решено».
  // Ключ и slug строим так же, как рендер (slugify) и decorateTasks (rel#slug) — чтобы совпало.
  function collectTasks(onlyUnsolved) {
    var d = DATA(), out = [];
    if (!d) return out;
    d.files.forEach(function (f) {
      if (!isTaskFile(f.rel)) return;
      String(f.md || "").replace(/\r\n?/g, "\n").split("\n").forEach(function (ln) {
        var m = ln.match(/^##\s+(.*?)\s*#*\s*$/);
        if (!m || !isTaskHeading(m[1])) return;
        var slug = slugify(m[1]), key = f.rel + "#" + slug;
        if (onlyUnsolved && state.solved[key]) return;
        out.push({ rel: f.rel, slug: slug, key: key, title: m[1] });
      });
    });
    return out;
  }
  // Открыть случайную задачу: сначала из нерешённых, если все решены — из всех; в крайнем
  // случае просто открываем сам задачник.
  function openRandomTask() {
    var pool = collectTasks(true);
    if (!pool.length) pool = collectTasks(false);
    if (!pool.length) { var tf = findFile(/zadachnik|задачник/i); if (tf) openFile(tf.rel); return; }
    var t = pool[Math.floor(Math.random() * pool.length)];
    openFile(t.rel, "#" + t.slug);
  }

  // ==== runtime/12-plan-review.js — план на сегодня, курс, карточки, разминка, задача дня ====
  // ------- главная: план на сегодня и дорожка курса -------
  // Номер темы по имени файла: ref/04-funkcii.md → 4 (для связи тема ↔ задачник).
  function topicNum(rel) { var m = String(rel).match(/(?:^|\/)0?(\d{1,2})[a-z]?-[^/]*\.md$/i); return m ? +m[1] : 0; }
  // Первый ещё не прокрученный раздел ## / ### темы (по отметкам secSeen) — «где продолжить».
  function nextSection(f) {
    var seen = state.secSeen[f.rel] || {}, out = null;
    String(f.md || "").replace(/\r\n?/g, "\n").split("\n").some(function (ln) {
      var m = ln.match(/^(#{2,3})\s+(.*?)\s*#*\s*$/);
      if (!m || /^Что в этом файле/i.test(m[2])) return false;
      var slug = slugify(m[2]);
      if (!seen[slug]) { out = { slug: slug, text: m[2].replace(/`/g, "") }; return true; }
      return false;
    });
    return out;
  }
  // «План на сегодня» одной строкой: Разминка (2 мин) → тема, раздел (~N мин) → задача темы.
  function todayPlan(primary, cc) {
    if (!primary) return "";
    // Шаги дня: разминка → раздел темы → задача. Сделанное — с галочкой и зачёркнуто.
    var steps = [];
    function step(attrs, text, time, done) { steps.push({ a: attrs, t: text, m: time, done: !!done }); }
    if (cc.total > 0) step(' data-act="warm"', "Разминка", "2 мин", warmupDoneToday());
    var sec = nextSection(primary);
    var mins = Math.max(5, Math.min(20, Math.round(String(primary.md || "").length / 2500)));
    step(' data-rel="' + escapeHtml(primary.rel) + '"' + (sec ? ' data-hash="#' + escapeHtml(sec.slug) + '"' : ""),
      escapeHtml(primary.title || primary.name) + (sec ? ' <span class="cd-plan-sub">раздел «' + escapeHtml(sec.text) + "»</span>" : ""),
      "~" + mins + " мин", !!state.read[primary.rel]);
    var n = topicNum(primary.rel);
    if (n && /^ref\//i.test(primary.rel)) {
      var task = collectTasks(true).filter(function (t) { return topicNum(t.rel) === n; })[0];
      if (task) {
        // номер «4.2» берём из текста заголовка задачи (в slug точки пропадают)
        var tf = lookupFile(task.rel), lbl = "Задача темы";
        String(tf && tf.md || "").split("\n").some(function (ln) {
          var hm = ln.match(/^##\s+(.*?)\s*#*\s*$/);
          if (!hm || slugify(hm[1]) !== task.slug) return false;
          var nm = hm[1].match(/^(\d+\.\d+)/); if (nm) lbl = "Задача " + nm[1];
          return true;
        });
        step(' data-rel="' + escapeHtml(task.rel) + '" data-hash="#' + escapeHtml(task.slug) + '"', lbl, "практика", false);
      }
    }
    var done = steps.filter(function (x) { return x.done; }).length;
    var html = steps.map(function (x, i) {
      return '<button class="cd-plan-step' + (x.done ? " done" : "") + '" type="button"' + x.a + ">" +
        '<span class="cd-plan-n">' + (x.done ? "✓" : i + 1) + "</span>" +
        '<span class="cd-plan-t">' + x.t + "</span><i>" + x.m + "</i></button>";
    }).join('<span class="cd-plan-line" aria-hidden="true"></span>');
    return '<div class="cd-plan"><div class="cd-plan-l">План на сегодня<span class="cd-plan-c">' + done + " из " + steps.length + "</span></div>" +
      '<div class="cd-plan-row">' + html + "</div></div>";
  }
  // Дорожка курса: темы справочника 1–8 кружками — пройденные залиты, «ты здесь» подсвечена.
  function courseTrack() {
    var d = DATA(); if (!d) return "";
    var topics = [];
    for (var n = 1; n <= 8; n++) {
      var f = d.files.filter(function (x) { return /^ref\//i.test(x.rel) && topicNum(x.rel) === n; })[0];
      if (f) topics.push(f);
    }
    if (topics.length < 3) return "";
    var here = null;
    for (var i = 0; i < topics.length; i++) if (!state.read[topics[i].rel]) { here = topics[i]; break; }
    var done = topics.filter(function (f) { return state.read[f.rel]; }).length;
    var examOk = examPassedTopics();
    var checkF = d.files.filter(function (x) { return /itogovye-proverki/i.test(x.rel); })[0];
    var html = '<div class="cd-track" aria-label="Дорожка курса"><div class="cd-track-h"><span>Курс: темы 1–' + topics.length + "</span><b>" + done + " из " + topics.length + "</b></div><ol>";
    topics.forEach(function (f, k) {
      var st = state.read[f.rel] ? "done" : (f === here ? "here" : "");
      if (examOk[k + 1]) st += " exam";
      var name = (f.title || f.name).split(/[:(]/)[0].trim();
      html += '<li class="' + st + '"><button type="button" data-rel="' + escapeHtml(f.rel) + '" title="' + escapeHtml(f.title || f.name) + (examOk[k + 1] ? " — итоговая проверка сдана" : "") + (st.indexOf("here") === 0 ? " — ты здесь" : st.indexOf("done") === 0 ? " — изучено" : "") + '">' +
        '<span class="cd-tr-dot">' + (state.read[f.rel] ? "✓" : String(k + 1)) + '</span><span class="cd-tr-n">' + escapeHtml(name) + "</span></button></li>";
    });
    html += "</ol>";
    if (checkF) {
      var passedN = Object.keys(state.exams).filter(function (k) { return state.exams[k] && state.exams[k].passed; }).length;
      html += '<button class="cd-track-exam" type="button" data-rel="' + escapeHtml(checkF.rel) + '">Итоговые проверки этапов' +
        (passedN ? " · сдано " + passedN : "") + " →</button>";
    }
    return html + "</div>";
  }

  // ------- #1: следующий шаг по курсу (первый неизученный материал в порядке данных) -------
  function nextUnread() {
    var d = DATA(); if (!d) return null;
    for (var i = 0; i < d.files.length; i++) { if (!state.read[d.files[i].rel]) return d.files[i]; }
    return null;
  }

  // ------- #3: флеш-карточки к повторению (движок cdCardState/cdSchedule уже есть) -------
  // Разбор одного блока ```cards в пары {q,a} — та же логика, что в renderCards.
  function parseCards(src) {
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n"), out = [], cur = null;
    function flush() { if (cur && (cur.q.length || cur.a.length)) out.push(cur); cur = null; }
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i];
      var mq = t.match(/^\s*(?:Q|В|Вопрос)\s*[:.]\s*(.*)$/i);
      var ma = t.match(/^\s*(?:A|О|Ответ)\s*[:.]\s*(.*)$/i);
      var mh = t.match(/^\s*(?:H|Подсказка)\s*[:.]\s*(.*)$/i);
      if (mq) { if (cur && cur.a.length) flush(); if (!cur) cur = { q: [], a: [], h: [], m: "q" }; cur.q.push(mq[1]); cur.m = "q"; continue; }
      if (ma) { if (!cur) cur = { q: [], a: [], h: [], m: "a" }; cur.a.push(ma[1]); cur.m = "a"; continue; }
      if (mh) { if (!cur) cur = { q: [], a: [], h: [], m: "h" }; cur.h.push(mh[1]); cur.m = "h"; continue; }   // подсказка — не часть ответа
      if (!t.trim()) { if (cur && cur.a.length) flush(); continue; }
      if (cur) cur[cur.m].push(t.trim());
    }
    flush();
    return out;
  }
  // Все карточки из всех файлов: [{q,a,id,rel}].
  function collectAllCards() {
    var d = DATA(), out = [];
    if (!d) return out;
    d.files.forEach(function (f) {
      var md = String(f.md || ""), re = /```+[ \t]*cards[ \t]*\r?\n([\s\S]*?)\r?\n```+/gi, m;
      while ((m = re.exec(md))) {
        // ближайший заголовок ## / ### над блоком — «откуда карточка»
        var before = md.slice(0, m.index), hm, hre = /^#{2,3}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, sec = null;
        while ((hm = hre.exec(before))) sec = hm[1];
        parseCards(m[1]).forEach(function (c) {
          var q = c.q.join(" "); if (!q) return;
          out.push({ q: q, a: c.a.join(" "), id: cdHash(q), rel: f.rel, sec: sec ? sec.replace(/`/g, "") : "", slug: sec ? slugify(sec) : "" });
        });
      }
    });
    return out;
  }
  // Счётчики для главного экрана: сколько «пора повторить» и сколько «новых».
  // Новые карточки дозируем: не больше NEW_PER_DAY в день («52 новые карточки» на старте пугают).
  var NEW_PER_DAY = 10;
  function newLeftToday() {
    var t = cdDate(0), nt = state.newToday;
    return Math.max(0, NEW_PER_DAY - (nt && nt.d === t ? nt.n | 0 : 0));
  }
  function noteNewSeen() {
    var t = cdDate(0);
    if (!state.newToday || state.newToday.d !== t) state.newToday = { d: t, n: 0 };
    state.newToday.n = (state.newToday.n | 0) + 1;
  }
  function cardCounts() {
    var all = collectAllCards(), due = 0, neu = 0, seen = {};
    all.forEach(function (c) {
      if (seen[c.id]) return; seen[c.id] = true;
      var s = cdCardState(c.id).status; if (s === "due") due++; else if (s === "new") neu++;
    });
    return { due: due, neu: Math.min(neu, newLeftToday()), newTotal: neu, total: all.length };
  }
  // Очередь на сессию: сперва просроченные, затем новые; не длиннее 20 за раз.
  function buildReviewQueue() {
    var all = collectAllCards(), dueL = [], newL = [], seen = {};
    all.forEach(function (c) {
      if (seen[c.id]) return; seen[c.id] = true;
      var s = cdCardState(c.id).status; if (s === "due") dueL.push(c); else if (s === "new") newL.push(c);
    });
    return dueL.concat(newL.slice(0, newLeftToday())).slice(0, 20);
  }
  function startReview() {
    reviewQueue = buildReviewQueue();
    resetReviewSession(false);
    if (!reviewQueue.length) return;
    showReview();
  }
  // «Разминка дня»: ровно 5 карточек — сперва «пора повторить», затем новые, а если их не
  // хватает — те, чей повтор ближе всего (разминка бывает каждый день, даже без просроченных).
  var WARMUP_N = 5;
  // ---- Задача дня: одна маленькая задача в день, своя серия дней ----
  // Берём задания ```challenge (предскажи вывод / собери код / напиши и запусти) из тем, которые
  // ученик уже открывал (иначе — из первых тем), сначала нерешённые. Выбор детерминирован датой:
  // весь день одна и та же задача, завтра — другая. Решил её — день засчитан в серию.
  var DAILY_TYPES = { predict: "предскажи вывод", parsons: "собери код", run: "напиши и запусти" };
  function collectChallenges() {
    var d = DATA(), out = [];
    if (!d) return out;
    d.files.forEach(function (f) {
      var md = String(f.md || "").replace(/\r\n?/g, "\n"), re = /^```challenge[^\n]*\n([\s\S]*?)\n```/gm, m;
      while ((m = re.exec(md))) {
        var fk = fenceKey(m[1].replace(/\r\n?/g, "\n"));
        var head = fk.body.split(/^\s*---\s*$/m)[0] || "", type = "parsons", prompt = [];
        head.split("\n").forEach(function (ln) {
          var mt = ln.match(/^\s*@type\s+(\w+)/i); if (mt) { type = mt[1].toLowerCase(); return; }
          if (/^\s*@hint\s/i.test(ln)) return;
          if (ln.trim()) prompt.push(ln.trim());
        });
        out.push({ rel: f.rel, id: fk.id, type: DAILY_TYPES[type] ? type : "parsons", prompt: prompt.join(" ").replace(/[`*]/g, ""), title: f.title || f.name });
      }
    });
    return out;
  }
  function dailyChallenge() {
    var today = cdDate(0);
    if (state.daily && state.daily.date === today && lookupFile(state.daily.rel) &&
        (state.daily.type !== "run" || (DATA() && DATA().run && DATA().run.enabled))) return state.daily;
    // «Напиши и запусти» без cppDocs.localRun решить нельзя — такая задача дня сожгла бы серию.
    var runOn = !!(DATA() && DATA().run && DATA().run.enabled);
    var all = collectChallenges().filter(function (c) { return runOn || c.type !== "run"; });
    if (!all.length) return null;
    var opened = all.filter(function (c) { return state.read[c.rel] || (state.recent || []).indexOf(c.rel) !== -1; });
    var pool = opened.length ? opened : all.filter(function (c) { return topicNum(c.rel) <= 3; });
    if (!pool.length) pool = all;
    var fresh = pool.filter(function (c) { return !state.challenge[c.id]; });
    if (fresh.length) pool = fresh;
    var c = pool[parseInt(cdHash("daily:" + today).slice(1), 36) % pool.length];
    state.daily = { date: today, id: c.id, rel: c.rel, type: c.type, prompt: c.prompt.slice(0, 140), title: c.title };
    saveState();
    return state.daily;
  }
  function dailyStreak() {
    var d = new Date(), n = 0;
    if (!state.dailyDone[cdDate(0)]) d.setDate(d.getDate() - 1);   // сегодня ещё не решал — серия не сгорела
    for (;;) {
      var k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      if (!state.dailyDone[k]) break;
      n++; d.setDate(d.getDate() - 1);
    }
    return n;
  }
  function openDaily() {
    var dc = dailyChallenge(); if (!dc) return;
    try { noteDailyOpened(); } catch (e) {}
    openFile(dc.rel);
    setTimeout(function () {
      var box = articleEl && articleEl.querySelector('[data-id="' + cssEscape(dc.id) + '"]');
      if (!box) return;
      unfoldContaining(box);
      box.scrollIntoView({ block: "center", behavior: "smooth" });
      box.classList.add("cd-daily-hl"); setTimeout(function () { box.classList.remove("cd-daily-hl"); }, 2200);
    }, 120);
  }
  function dailyCardHtml() {
    var dc = dailyChallenge(); if (!dc) return "";
    var done = !!state.dailyDone[cdDate(0)], streak = dailyStreak();
    return '<div class="cd-home-warm cd-daily' + (done ? " done" : "") + '"' + (done ? "" : ' role="button" tabindex="0"') + '>' +
      '<span class="cd-hw-ic">' + (done ? "✓" : emo("ui-dice", "🎯")) + "</span>" +
      '<div class="cd-hc-main"><div class="cd-hc-lbl">Задача дня · ' + escapeHtml(DAILY_TYPES[dc.type] || "задание") + (done ? " · решена" : "") + "</div>" +
      '<div class="cd-hc-title">' + escapeHtml(dc.prompt || "Задание из темы") + "</div>" +
      '<div class="cd-hc-meta">' + escapeHtml(dc.title) + (streak ? " · серия " + streak + " " + plural(streak, ["день", "дня", "дней"]) : " · реши — начнётся серия") +
      (function () { var r = ""; try { r = dailyRecordLine(dc.type); } catch (e) {} return r ? " · " + escapeHtml(r) : ""; })() + "</div></div>" +
      (done ? "" : '<div class="cd-hc-arrow">→</div>') + "</div>";
  }
  function buildWarmupQueue() {
    var all = collectAllCards(), dueL = [], newL = [], laterL = [], seen = {};
    all.forEach(function (c) {
      if (seen[c.id]) return; seen[c.id] = true;       // одна и та же карточка в двух файлах — один раз
      var s = cdCardState(c.id).status;
      if (s === "due") dueL.push(c); else if (s === "new") newL.push(c); else laterL.push(c);
    });
    laterL.sort(function (a, b) { return String(state.cards[a.id].due).localeCompare(String(state.cards[b.id].due)); });
    var today = cdDate(0), miss = [];
    Object.keys(state.missed).forEach(function (k) {
      var m = state.missed[k];
      if (m && typeof m.q === "string" && String(m.due) <= today && lookupFile(m.rel))
        miss.push({ q: "🤔 " + m.q, a: m.a, id: "miss:" + k, rel: m.rel, sec: MISS_LABEL[m.kind] || MISS_LABEL.steps, slug: m.hash, missed: k, md: !!m.md, due: String(m.due) });
    });
    miss.sort(function (x, y) { return x.due.localeCompare(y.due); });   // самые давние ошибки — первыми
    return miss.slice(0, 3).concat(dueL, newL.slice(0, newLeftToday()), laterL).slice(0, WARMUP_N);
  }
  function warmupDoneToday() { return state.warmupDone === cdDate(0); }
  function startWarmup() {
    reviewQueue = buildWarmupQueue();
    resetReviewSession(true);
    if (!reviewQueue.length) return;
    showReview();
  }
  function resetReviewSession(warm) {
    reviewPos = 0; reviewOk = 0; reviewWarmup = !!warm;
    reviewLog = []; reviewUndo = null; reviewStreak = 0; reviewTyped = "";
  }
  var RV_GRADES = [   // [подпись, значок, класс]
    ["Не помню", "✗", "g0"], ["Трудно", "~", "g1"], ["Помню", "✓", "g2"],
  ];
  // Дорожка сессии: точка на карточку, отвеченные окрашены оценкой, текущая пульсирует.
  function reviewTrackHtml() {
    var n = reviewQueue.length;
    if (n > 24) {
      return '<span class="cd-rv-prog"><i style="width:' + Math.round(reviewPos / n * 100) + '%"></i></span>';
    }
    var html = '<span class="cd-rv-track">';
    for (var i = 0; i < n; i++) {
      var lg = reviewLog[i], cls = lg ? "g" + lg.g : (i === reviewPos ? "cur" : "");
      if (reviewQueue[i] && reviewQueue[i].again) cls += " again";
      html += '<i class="' + cls + '"></i>';
    }
    return html + "</span>";
  }
  function reviewTopHtml() {
    return '<div class="cd-rv-top">' +
      '<span class="cd-rv-count">' + (reviewWarmup ? "Разминка · " : "Повторение · ") + Math.min(reviewPos + 1, reviewQueue.length) + " / " + reviewQueue.length + "</span>" +
      reviewTrackHtml() +
      (reviewUndo ? '<button class="cd-rv-undo" type="button" title="Отменить последнюю оценку">↶ Назад</button>' : "") +
      '<button class="cd-rv-close" type="button" title="Закрыть">✕</button></div>';
  }
  // Сколько карточек этой сессии вернётся завтра и на этой неделе (по свежему расписанию).
  function reviewReturns() {
    var t1 = cdDate(1), t7 = cdDate(7), tomorrow = 0, week = 0, seen = {};
    reviewLog.forEach(function (l) {
      if (!l.id || seen[l.id]) return; seen[l.id] = true;
      var rec = state.cards[l.id]; if (!rec || !rec.due) return;
      if (String(rec.due) <= t1) tomorrow++; else if (String(rec.due) <= t7) week++;
    });
    return { tomorrow: tomorrow, week: week };
  }
  function reviewDoneHtml() {
    var wm = (typeof STICKERS !== "undefined" && STICKERS && STICKERS["mascot-win"]) ? "mascot-win" : "mascot-done";
    var cnt = [0, 0, 0], weak = [], seenWeak = {};
    reviewLog.forEach(function (l) {
      if (l.again) return;                                  // повтор внутри сессии не считаем второй раз
      cnt[l.g]++;
      if (l.g < 2 && !seenWeak[l.key]) { seenWeak[l.key] = true; weak.push(l); }
    });
    var total = cnt[0] + cnt[1] + cnt[2], acc = total ? Math.round((cnt[1] + cnt[2]) / total * 100) : 0;
    var ret = reviewReturns(), cc = null;
    try { cc = cardCounts(); } catch (e) {}
    var more = cc && !reviewWarmup ? cc.due + cc.neu : (cc ? cc.due : 0);
    var title = (reviewWarmup ? "Разминка сделана! " : "") + (total ? "Повторено " + total + " " + plural(total, ["карточка", "карточки", "карточек"]) : "Готово");
    var sub = !total ? "" : acc === 100 ? "Все вспомнил — отличная память." : acc >= 70 ? "Хороший результат: большинство — в голове." :
      "Ничего страшного: трудные карточки вернутся раньше, и с каждым разом будет легче.";
    var tile = function (k, v, lbl) { return '<div class="cd-rv-st ' + k + '"><b>' + v + "</b><span>" + lbl + "</span></div>"; };
    var weakHtml = weak.length ? '<div class="cd-rv-weak"><div class="cd-rv-wh">Стоит перечитать</div>' + weak.slice(0, 5).map(function (l) {
      var cf = lookupFile(l.rel);
      return '<div class="cd-rv-wi g' + l.g + '"><span class="cd-rv-wq">' + inline(String(l.q || "").replace(/^🤔\s*/, "")) + "</span>" +
        (cf ? '<button class="cd-rv-open" type="button" data-rel="' + escapeHtml(l.rel) + '" data-hash="' + (l.slug ? "#" + escapeHtml(l.slug) : "") + '">' +
          escapeHtml(cf.title || cf.name) + " ↗</button>" : "") + "</div>";
    }).join("") + "</div>" : "";
    var retTxt = (ret.tomorrow || ret.week) ? '<div class="cd-rv-ret">' + emo("ui-calendar", "📅") + " " +
      (ret.tomorrow ? "Завтра вернётся " + ret.tomorrow + " " + plural(ret.tomorrow, ["карточка", "карточки", "карточек"]) : "") +
      (ret.tomorrow && ret.week ? ", " : "") + (ret.week ? (ret.tomorrow ? "" : "На этой неделе вернётся ") + (ret.tomorrow ? "на неделе ещё " : "") + ret.week : "") + "</div>" : "";
    return '<div class="cd-rv-inner">' + reviewTopHtml() + '<div class="cd-rv-done">' +
      '<div class="cd-rv-art">' + stickerMarkup(wm, 96) + "</div>" +
      '<div class="cd-rv-done-t">' + escapeHtml(title) + "</div>" +
      (sub ? '<div class="cd-rv-done-s">' + escapeHtml(sub) + "</div>" : "") +
      (total ? '<div class="cd-rv-stats">' + tile("g2", cnt[2], "помню") + tile("g1", cnt[1], "трудно") + tile("g0", cnt[0], "не помню") +
        tile("acc", acc + "%", "вспомнил") + "</div>" : "") +
      retTxt + weakHtml +
      '<div class="cd-rv-done-btns"><button class="cd-rv-close2" type="button">На главную</button>' +
      (more ? '<button class="cd-rv-more" type="button">Ещё карточки (' + more + ")</button>" : "") + "</div>" +
      "</div></div>";
  }
  function renderReviewCard() {
    if (!reviewEl) return;
    syncReviewBell();
    if (reviewPos >= reviewQueue.length) {          // сессия окончена — итог
      if (reviewWarmup) state.warmupDone = cdDate(0);
      setHTML(reviewEl, reviewDoneHtml());
      recordActivity(); saveState();
      return;
    }
    var c = reviewQueue[reviewPos];
    var cf = lookupFile(c.rel);
    var from = cf ? escapeHtml(cf.title || cf.name) + (c.sec ? " → " + escapeHtml(c.sec) : "") : "";
    var gcol = cf && cf.groupColor ? ' style="--rvg:' + escapeHtml(cf.groupColor) + '"' : "";
    function gradeBtn(g) {
      var sub = c.again ? ["не вышло", "почти", "закрепил"][g] : c.missed ? ["через день", "через 3 дня", "больше не спрашивать"][g] : ivlLabel(cdPreview(c.id, g));
      var G = RV_GRADES[g];
      return '<button class="cd-rv-grade ' + G[2] + '" data-g="' + g + '" type="button"><span class="cd-rv-gi">' + G[1] + "</span>" +
        '<span class="cd-rv-gt">' + G[0] + "<small>" + escapeHtml(sub) + "</small></span></button>";
    }
    var streak = reviewStreak >= 3 ? '<span class="cd-rv-streak" title="Подряд без «не помню»">' + emo("ui-streak", "🔥") + " " + reviewStreak + " подряд</span>" : "";
    setHTML(reviewEl, '<div class="cd-rv-inner">' + reviewTopHtml() +
      '<div class="cd-rv-card"' + gcol + ">" +
      '<div class="cd-rv-meta">' + (from ? '<span class="cd-rv-from">' + from + "</span>" : "") +
      (c.again ? '<span class="cd-rv-badge">повтор</span>' : (cdCardState(c.id).status === "new" && !c.missed ? '<span class="cd-rv-badge new">новая</span>' : "")) + streak + "</div>" +
      '<div class="cd-rv-q">' + (c.md ? renderMarkdown(c.q, null) : inline(c.q)) + "</div>" +
      '<div class="cd-rv-recall"><details class="cd-rv-own"' + (reviewTyped ? " open" : "") + "><summary>" + emo("ui-pencil", "✎") + " Сначала вспомни — запиши ответ своими словами (необязательно)</summary>" +
      '<textarea class="cd-rv-in" rows="2" placeholder="Как объяснил бы другу?"></textarea></details></div>' +
      '<div class="cd-rv-a" hidden>' + '<div class="cd-rv-mine" hidden><span>Твой ответ</span><div class="cd-rv-mt"></div></div>' +
      '<div class="cd-rv-al">Ответ</div>' + (c.md ? renderMarkdown(c.a, null) : inline(c.a)) + "</div>" +
      '<div class="cd-rv-ctl"><button class="cd-rv-show" type="button">Показать ответ</button>' +
      '<span class="cd-rv-rate" hidden>' + gradeBtn(0) + gradeBtn(1) + gradeBtn(2) + "</span>" +
      (cf ? '<button class="cd-rv-open" type="button" data-rel="' + escapeHtml(c.rel) + '" data-hash="' + (c.slug ? "#" + escapeHtml(c.slug) : "") + '" title="Прочитать раздел, откуда эта карточка">открыть раздел ↗</button>' : "") +
      "</div></div>" +
      '<div class="cd-rv-hint">' + (c.again ? "Эта карточка уже была «не помню» — закрепляем, расписание не меняется." : "Отвечай честно: от оценки зависит, когда карточка вернётся.") + "</div></div>");
    var ta = reviewEl.querySelector(".cd-rv-in");
    if (ta) { ta.value = reviewTyped; ta.addEventListener("input", function () { reviewTyped = ta.value; }); }
  }
  function cloneOrUndef(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function reviewGrade(g) {
    var c = reviewQueue[reviewPos]; if (!c) return;
    // снимок для «↶ Назад»: всё, что меняет оценка
    reviewUndo = {
      pos: reviewPos, ok: reviewOk, streak: reviewStreak, logLen: reviewLog.length, queueLen: reviewQueue.length,
      id: c.id, card: cloneOrUndef(state.cards[c.id]), missedKey: c.missed || "", missed: c.missed ? cloneOrUndef(state.missed[c.missed]) : undefined,
      newToday: cloneOrUndef(state.newToday), warm: state.warmupDone, typed: reviewTyped,
    };
    reviewLog[reviewPos] = { g: g, id: c.missed ? "" : c.id, key: c.id, q: c.q, rel: c.rel, slug: c.slug, again: !!c.again };
    reviewStreak = g >= 1 ? reviewStreak + 1 : 0;
    reviewTyped = "";
    if (c.again) {                    // повтор внутри сессии: расписание уже назначено первой оценкой
      reviewPos++; renderReviewCard(); return;
    }
    if (c.missed) {                   // загадка из разбора: своё простое расписание
      if (g >= 2) delete state.missed[c.missed];
      else if (state.missed[c.missed]) state.missed[c.missed].due = cdDate(g ? 3 : 1);
      saveState();
      if (g >= 1) reviewOk++;
      reviewPos++; renderReviewCard(); return;
    }
    if (cdCardState(c.id).status === "new") noteNewSeen();
    cdSchedule(c.id, g);
    try { bumpCount("graded"); } catch (e) {}
    if (g >= 1) reviewOk++;          // «трудно»/«помню» считаем как повторённую
    // «Не помню» — ещё раз в конце этой же сессии (один раз): вспомнить, пока ответ свежий, полезнее всего
    if (g === 0) reviewQueue.push(Object.assign({}, c, { again: true }));
    reviewPos++;
    renderReviewCard();
  }
  function reviewUndoLast() {
    var u = reviewUndo; if (!u) return;
    if (u.id && !u.missedKey) { if (u.card === undefined) delete state.cards[u.id]; else state.cards[u.id] = u.card; }
    if (u.missedKey) { if (u.missed === undefined) delete state.missed[u.missedKey]; else state.missed[u.missedKey] = u.missed; }
    if (u.newToday === undefined) delete state.newToday; else state.newToday = u.newToday;
    state.warmupDone = u.warm;
    reviewQueue.length = u.queueLen; reviewLog.length = u.logLen;
    reviewPos = u.pos; reviewOk = u.ok; reviewStreak = u.streak; reviewTyped = u.typed || "";
    reviewUndo = null;
    saveState(); renderReviewCard();
  }
  function onReviewClick(e) {
    var t = e.target;
    if (t.closest && t.closest(".cd-rv-close, .cd-rv-close2")) { hideReview(); showHome(); return; }
    if (t.closest && t.closest(".cd-rv-undo")) { reviewUndoLast(); return; }
    if (t.closest && t.closest(".cd-rv-more")) { startReview(); return; }
    if (t.closest && t.closest(".cd-rv-show")) {
      var card = reviewEl.querySelector(".cd-rv-card");
      if (card) {
        var a = card.querySelector(".cd-rv-a"), rate = card.querySelector(".cd-rv-rate"), show = card.querySelector(".cd-rv-show");
        var mine = card.querySelector(".cd-rv-mine"), own = card.querySelector(".cd-rv-recall");
        if (mine && reviewTyped.trim()) { mine.hidden = false; mine.querySelector(".cd-rv-mt").textContent = reviewTyped.trim(); }
        if (own) own.hidden = true;
        if (a) a.hidden = false; if (rate) rate.hidden = false; if (show) show.hidden = true;
        card.classList.add("flipped");
      }
      return;
    }
    var gb = t.closest && t.closest(".cd-rv-grade");
    if (gb) { reviewGrade(parseInt(gb.getAttribute("data-g"), 10) || 0); return; }
    var ob = t.closest && t.closest(".cd-rv-open");
    if (ob) { hideReview(); if (winEl) winEl.classList.remove("reviewing"); openFile(ob.getAttribute("data-rel"), ob.getAttribute("data-hash") || undefined); return; }
  }
  function showReview() {
    if (!reviewEl || !winEl) return;
    if (homeEl) homeEl.hidden = true;
    reviewEl.hidden = false; winEl.classList.add("home");
    winEl.classList.add("reviewing");   // режим повторения: без списка материалов, карточка крупнее
    // пейзаж палитры — приглушённым фоном (если на главной выбран «Пейзаж»)
    var bg = state.homeBg === "none" || state.homeBg === "stars" ? null : homeBgImage();
    reviewEl.classList.toggle("has-bg", !!bg);
    if (bg) reviewEl.style.setProperty("--rv-bg", "url(" + bg + ")"); else reviewEl.style.removeProperty("--rv-bg");
    renderReviewCard();
    syncHead();
  }
  function hideReview() { if (reviewEl) reviewEl.hidden = true; if (winEl) winEl.classList.remove("reviewing"); }

  // Картинки: data-src → file:// абсолютный путь относительно корня доков.
  function resolveImagesIn(root, f) {
    var d = DATA(); if (!d || !f || !root) return;
    root.querySelectorAll("img[data-src]").forEach(function (img) {
      var src = img.getAttribute("data-src");
      if (!src) return;
      // Доки офлайновые: удалённые (http/https) и inline (data:) картинки не грузим — автозагрузка
      // внешнего URL из оболочки это канал утечки (IP, факт чтения). Заменяем текстовой заглушкой.
      if (/^https?:/i.test(src) || /^data:/i.test(src)) {
        var ph = el("span", "opacity:.55;font-style:italic;font-size:.9em",
          img.getAttribute("alt") || "внешнее изображение (не загружено)");
        ph.title = "Внешние картинки отключены ради приватности";
        if (img.parentNode) img.parentNode.replaceChild(ph, img);
        return;
      }
      var res = resolveRel(f.rel, src);
      var base = (d.root || "").replace(/\\/g, "/");
      // Оболочка VS Code отклоняет file:// — картинку отдаёт vscode-file:// (resUrl; сегменты кодируются).
      if (base) {
        var fu = "file:///" + (base + "/" + res.rel).replace(/^\/+/, "").split("/").map(function (seg) {
          try { return encodeURIComponent(decodeURIComponent(seg)).replace(/%3A/gi, ":"); } catch (e) { return encodeURIComponent(seg); }
        }).join("/");
        var ru = resUrl(fu);
        if (ru) img.src = ru;
      }
    });
  }
  function resolveImages() { resolveImagesIn(articleEl, current); }

  // Разрешение относительной ссылки от текущего файла.
  function resolveRel(baseRel, href) {
    var hash = "", qi = href.indexOf("#");
    if (qi >= 0) { hash = href.slice(qi); href = href.slice(0, qi); }
    if (!href) return { rel: baseRel, hash: hash };
    var baseDir = baseRel.indexOf("/") >= 0 ? baseRel.replace(/\/[^\/]*$/, "") : "";
    var parts = baseDir ? baseDir.split("/") : [];
    href.split("/").forEach(function (p) {
      if (p === "." || p === "") return;
      if (p === "..") { parts.pop(); return; }
      parts.push(p);
    });
    return { rel: parts.join("/"), hash: hash };
  }

  // Клики внутри статьи: кнопки «копировать» и внутренние ссылки.
  function doCopy(btn) {
    var text = btn.getAttribute("data-code");
    if (text == null) {
      var wrap = btn.closest ? btn.closest(".codewrap") : btn.parentNode;
      var pre = wrap ? wrap.querySelector("pre.code code") : null;
      text = pre ? pre.textContent : "";
    }
    try {
      navigator.clipboard.writeText(text).then(function () { flashCopy(btn); }, function () { legacyCopy(text); flashCopy(btn); });
    } catch (err) { legacyCopy(text); flashCopy(btn); }
  }
  // ==== runtime/12-progress-map.js — освоение тем, карта знаний, слабые места, экзамен недели ====
  // ---------------------------------------------------------------------------
  //  Темы справочника как граф: у каждой ref/*.md в шапке есть строка «**Опирается на:** [..](..)» —
  //  из неё берутся связи. Освоение темы (0–100) складывается из того, что ученик реально сделал:
  //  отметка «Изучено», прочитанные разделы, крепость карточек, решённые задания и задачи, босс,
  //  итоговая проверка; ошибки в разборах, ещё не отработанные, немного снижают оценку.
  // ---------------------------------------------------------------------------
  var _topics = { sig: "", list: [] };
  function shortTitle(f) { return String(f.title || f.name || "").replace(/`/g, "").split(/[:(—]/)[0].trim(); }
  // Все ```-блоки нужного вида в Markdown → тела блоков.
  function fenceBodies(md, kind) {
    var out = [], re = new RegExp("^```+[ \\t]*" + kind + "[^\\n]*\\n([\\s\\S]*?)\\n```+[ \\t]*$", "gim"), m;
    md = String(md || "").replace(/\r\n?/g, "\n");
    while ((m = re.exec(md))) out.push(m[1]);
    return out;
  }
  // Ключ босса — тот же, что у renderBoss: «@id» или хэш от «boss:<название>».
  function bossIdOf(src) {
    var raw = String(src).replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, ""), title = "Итоговое задание";
    var m = raw.match(/^#\s+(.*)\n?/);
    if (m) { title = m[1].trim(); raw = raw.slice(m[0].length); }
    return fenceKey(raw, function () { return "boss:" + title; }).id;
  }
  function progressTopics() {
    var d = DATA(); if (!d || d.lazy) return [];
    var sig = d.generatedAt + ":" + d.files.length;
    if (_topics.sig === sig) return _topics.list;
    var list = [], byRel = {};
    d.files.forEach(function (f) {
      if (!/^ref\//i.test(f.rel)) return;
      var head = String(f.md || "").slice(0, 4000);
      var m = head.match(/\*\*Опирается на:\*\*([^\n]*)/);
      if (!m) return;                                       // словари и справка — не темы курса
      var deps = [], re = /\]\(([^)#\s]+\.md)/g, x;
      while ((x = re.exec(m[1]))) deps.push(resolveRel(f.rel, x[1]).rel.toLowerCase());
      var lv = head.match(/\*\*Уровень:\*\*([^\n·]*)/);
      // метки уровня в доках — красный/жёлтый кружок (U+1F534 / U+1F7E1)
      var level = lv && /🔴/.test(lv[1]) ? 3 : lv && /🟡/.test(lv[1]) ? 2 : 1;
      var t = { rel: f.rel, f: f, deps: deps, level: level, n: topicNum(f.rel), short: shortTitle(f), cards: [], ch: [], boss: [], tasks: [] };
      list.push(t); byRel[f.rel.toLowerCase()] = t;
    });
    list.forEach(function (t) {
      t.deps = t.deps.filter(function (r) { return byRel[r] && byRel[r] !== t; }).map(function (r) { return byRel[r].rel; });
    });
    // Глубина = самый длинный путь от корня (колонка на карте). Цикл в ссылках не зациклит расчёт.
    var depth = {};
    function dep(t, seen) {
      if (depth[t.rel] !== undefined) return depth[t.rel];
      if (seen[t.rel]) return 0;
      seen[t.rel] = 1;
      var v = 0;
      t.deps.forEach(function (r) { v = Math.max(v, dep(byRel[r.toLowerCase()], seen) + 1); });
      depth[t.rel] = v;
      return v;
    }
    list.forEach(function (t) { t.depth = dep(t, {}); });
    // Что в теме можно «сделать»: карточки, задания, боссы — и задачи задачника той же темы.
    collectAllCards().forEach(function (c) { var t = byRel[String(c.rel).toLowerCase()]; if (t && t.cards.indexOf(c.id) === -1) t.cards.push(c.id); });
    collectChallenges().forEach(function (c) { var t = byRel[String(c.rel).toLowerCase()]; if (t) t.ch.push(c.id); });
    list.forEach(function (t) { fenceBodies(t.f.md, "boss").forEach(function (b) { t.boss.push(bossIdOf(b)); }); });
    collectTasks(false).forEach(function (k) {
      var base = String(k.rel).toLowerCase().split("/").pop();
      list.forEach(function (t) { if (String(t.rel).toLowerCase().split("/").pop() === base) t.tasks.push(k.key); });
    });
    list.sort(function (a, b) { return a.depth - b.depth || a.n - b.n; });
    _topics = { sig: sig, list: list };
    return list;
  }
  function topicByRel(rel) {
    var l = progressTopics(), r = String(rel || "").toLowerCase();
    for (var i = 0; i < l.length; i++) if (l[i].rel.toLowerCase() === r) return l[i];
    return null;
  }
  function missedIn(rel) {
    var n = 0;
    Object.keys(state.missed).forEach(function (k) { var m = state.missed[k]; if (m && m.rel === rel) n++; });
    return n;
  }
  // Карточка «крепкая», когда интервал повторения дорос до двух недель.
  function cardStrength(id) { var r = state.cards[id]; return r && r.ivl ? Math.min(1, r.ivl / 14) : 0; }
  // Освоение темы: { pct, parts: [[название, доля 0..1]], miss }.
  function topicMastery(t) {
    var parts = [], rel = t.rel;
    function add(name, v, w) { parts.push([name, Math.max(0, Math.min(1, v)), w]); }
    add("отмечена «Изучено»", state.read[rel] ? 1 : 0, 3);
    if (t.f.sections) add("прочитано разделов", Object.keys(state.secSeen[rel] || {}).length / t.f.sections, 1);
    if (t.cards.length) add("крепость карточек", t.cards.reduce(function (s, id) { return s + cardStrength(id); }, 0) / t.cards.length, 3);
    if (t.ch.length) add("решено заданий", t.ch.filter(function (id) { return state.challenge[id]; }).length / t.ch.length, 2);
    if (t.tasks.length) add("решено задач задачника", t.tasks.filter(function (k) { return state.solved[k]; }).length / t.tasks.length, 2);
    if (t.boss.length) add("босс темы", t.boss.filter(function (id) { return state.boss[id]; }).length / t.boss.length, 2);
    if (examPassedTopics()[t.n] && t.n) add("итоговая проверка", 1, 1);
    var v = 0, w = 0;
    parts.forEach(function (p) { v += p[1] * p[2]; w += p[2]; });
    var miss = missedIn(rel);
    var pct = w ? Math.round(Math.max(0, v / w - Math.min(0.2, miss * 0.05)) * 100) : 0;
    return { pct: pct, parts: parts, miss: miss };
  }
  function masteryPct(t) { return topicMastery(t).pct; }
  // Тема «открыта», когда её опоры освоены хотя бы на 40 % (или она уже начата сама).
  var UNLOCK_AT = 40;
  function topicUnlocked(t) {
    if (!t.deps.length || state.read[t.rel] || masteryPct(t) > 0) return true;
    return t.deps.every(function (r) { var d = topicByRel(r); return !d || state.read[d.rel] || masteryPct(d) >= UNLOCK_AT; });
  }
  function masteryTone(p) { return p >= 80 ? "m4" : p >= 60 ? "m3" : p >= 35 ? "m2" : p > 0 ? "m1" : "m0"; }

  // ---- Слабые места: начатые темы с низким освоением и конкретный следующий шаг ----
  function weakSpots(limit) {
    var recent = state.recent || [];
    var out = progressTopics().map(function (t) {
      var m = topicMastery(t);
      var started = state.read[t.rel] || m.pct > 0 || recent.indexOf(t.rel) !== -1;
      return { t: t, m: m, started: started };
    }).filter(function (x) { return x.started && x.m.pct < 60; });
    out.sort(function (a, b) { return a.m.pct - b.m.pct; });
    return out.slice(0, limit || 3).map(function (x) { x.act = weakAction(x.t, x.m); return x; });
  }
  // Что сделать с темой прямо сейчас — самое полезное из доступного.
  function weakAction(t, m) {
    var due = t.cards.filter(function (id) { var s = cdCardState(id).status; return s === "due"; }).length;
    var weakCards = t.cards.filter(function (id) { return cardStrength(id) < 0.5; }).length;
    if (due) return { kind: "cards", label: "Повторить карточки темы · " + due, why: due + " " + plural(due, ["карточка ждёт", "карточки ждут", "карточек ждут"]) + " повторения" };
    if (m.miss) return { kind: "miss", label: "Разобрать ошибки · " + m.miss, why: "ошибки в разборах этой темы ещё не отработаны" };
    var sec = nextSection(t.f);
    if (!state.read[t.rel] && sec) return { kind: "read", label: "Дочитать: «" + sec.text + "»", hash: sec.slug, why: "тема не дочитана" };
    var ch = t.ch.filter(function (id) { return !state.challenge[id]; });
    if (ch.length) return { kind: "task", label: "Решить задание темы", id: ch[0], why: "задания темы не решены" };
    if (weakCards) return { kind: "cards", label: "Закрепить карточки · " + weakCards, why: "карточки ещё не окрепли" };
    return { kind: "read", label: "Перечитать тему", hash: "", why: "освоение пока ниже 60 %" };
  }
  function runWeakAction(rel, kind, extra) {
    var t = topicByRel(rel); if (!t) return;
    hideProgress();
    if (kind === "cards") { startTopicReview(t); return; }
    if (kind === "miss") { startWarmup(); return; }
    if (kind === "task" && extra) {
      openFile(t.rel);
      setTimeout(function () {
        var box = articleEl && articleEl.querySelector('[data-id="' + cssEscape(extra) + '"]');
        if (box) { unfoldContaining(box); box.scrollIntoView({ block: "center", behavior: "smooth" }); }
      }, 120);
      return;
    }
    openFile(t.rel, extra ? "#" + extra : undefined);
  }
  // Повторение только по одной теме: сперва «пора», потом слабые, потом новые (в пределах лимита дня).
  function startTopicReview(t) {
    var all = collectAllCards().filter(function (c) { return t.cards.indexOf(c.id) !== -1; }), seen = {}, due = [], weak = [], neu = [];
    all.forEach(function (c) {
      if (seen[c.id]) return; seen[c.id] = 1;
      var s = cdCardState(c.id).status;
      if (s === "due") due.push(c); else if (s === "new") neu.push(c); else if (cardStrength(c.id) < 0.5) weak.push(c);
    });
    reviewQueue = due.concat(weak, neu.slice(0, Math.max(3, newLeftToday()))).slice(0, 20);
    resetReviewSession(false);
    if (!reviewQueue.length) { openFile(t.rel); return; }
    showReview();
  }
  function weakHomeHtml() {
    var ws = []; try { ws = weakSpots(3); } catch (e) {}
    if (!ws.length) return "";
    return '<div class="cd-weak"><div class="cd-weak-h">Слабые места<span>что подтянуть</span></div>' + ws.map(function (x) {
      return '<div class="cd-weak-row"><div class="cd-weak-main"><b>' + escapeHtml(x.t.short) + "</b>" +
        '<span class="cd-mbar ' + masteryTone(x.m.pct) + '"><i style="width:' + x.m.pct + '%"></i></span><em>' + x.m.pct + "%</em>" +
        '<small>' + escapeHtml(x.act.why) + "</small></div>" +
        '<button class="cd-weak-go" type="button" data-wrel="' + escapeHtml(x.t.rel) + '" data-wk="' + x.act.kind + '" data-wx="' +
        escapeHtml(x.act.hash || x.act.id || "") + '">' + escapeHtml(x.act.label) + " →</button></div>";
    }).join("") + "</div>";
  }

  // ---- Карта знаний (SVG): колонки — глубина по «Опирается на», цвет — освоение ----
  function knowledgeMapHtml() {
    var list = progressTopics();
    if (list.length < 2) return '<p class="cd-pg-empty">Карта появится, когда загрузятся материалы справочника.</p>';
    var cols = {};
    list.forEach(function (t) { (cols[t.depth] = cols[t.depth] || []).push(t); });
    var depths = Object.keys(cols).map(Number).sort(function (a, b) { return a - b; });
    var maxRows = Math.max.apply(null, depths.map(function (k) { return cols[k].length; }));
    var CW = 128, RH = 62, W = depths.length * CW + 20, H = maxRows * RH + 30, pos = {};
    depths.forEach(function (k, ci) {
      var col = cols[k], off = (maxRows - col.length) * RH / 2;
      col.forEach(function (t, ri) { pos[t.rel] = { x: 20 + ci * CW + 40, y: 26 + off + ri * RH }; });
    });
    var next = null;
    for (var i = 0; i < list.length && !next; i++) if (!state.read[list[i].rel] && topicUnlocked(list[i])) next = list[i];
    var edges = "", nodes = "";
    list.forEach(function (t) {
      var p = pos[t.rel];
      t.deps.forEach(function (r) {
        var q = pos[r]; if (!q) return;
        var mx = (q.x + p.x) / 2;
        edges += '<path class="cd-km-e' + (state.read[r] || masteryPct(topicByRel(r)) >= UNLOCK_AT ? " on" : "") + '" d="M' + (q.x + 13) + " " + q.y + " C" + mx + " " + q.y + " " + mx + " " + p.y + " " + (p.x - 13) + " " + p.y + '"/>';
      });
    });
    list.forEach(function (t) {
      var p = pos[t.rel], pct = masteryPct(t), open = topicUnlocked(t);
      var C = 2 * Math.PI * 15, off = C * (1 - pct / 100);
      var label = t.short.length > 16 ? t.short.slice(0, 15) + "…" : t.short;
      nodes += '<g class="cd-km-n ' + masteryTone(pct) + (open ? "" : " lock") + (t === next ? " next" : "") + '" data-krel="' + escapeHtml(t.rel) + '" tabindex="0" role="button">' +
        "<title>" + escapeHtml(t.f.title || t.short) + " — освоено " + pct + "%" + (open ? "" : " · сначала опоры: " + t.deps.map(function (r) { var d = topicByRel(r); return d ? d.short : r; }).join(", ")) + "</title>" +
        '<circle class="cd-km-bg" cx="' + p.x + '" cy="' + p.y + '" r="15"/>' +
        '<circle class="cd-km-fg" cx="' + p.x + '" cy="' + p.y + '" r="15" style="stroke-dasharray:' + C.toFixed(1) + ";stroke-dashoffset:" + off.toFixed(1) + '" transform="rotate(-90 ' + p.x + " " + p.y + ')"/>' +
        '<text class="cd-km-num" x="' + p.x + '" y="' + (p.y + 4) + '">' + (t.n || "•") + "</text>" +
        '<text class="cd-km-t" x="' + p.x + '" y="' + (p.y + 30) + '">' + escapeHtml(label) + "</text></g>";
    });
    var masteredN = list.filter(function (t) { return masteryPct(t) >= 80; }).length;
    var avg = Math.round(list.reduce(function (s, t) { return s + masteryPct(t); }, 0) / list.length);
    return '<div class="cd-km-sum"><span><b>' + masteredN + "</b> из " + list.length + " тем освоено на 80 %+</span><span>среднее освоение <b>" + avg + "%</b></span>" +
      (next ? '<button class="cd-km-next" type="button" data-krel="' + escapeHtml(next.rel) + '">Дальше: ' + escapeHtml(next.short) + " →</button>" : "") + "</div>" +
      '<div class="cd-km-wrap"><svg class="cd-km" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" aria-label="Карта знаний">' + edges + nodes + "</svg></div>" +
      '<div class="cd-km-legend"><span class="m0">не начата</span><span class="m1">начата</span><span class="m2">35 %+</span><span class="m3">60 %+</span><span class="m4">освоена</span><span class="lock">бледная — сначала опоры: изучить или освоить на ' + UNLOCK_AT + " %</span></div>" +
      '<div class="cd-km-detail" hidden></div>';
  }
  function kmDetailHtml(rel) {
    var t = topicByRel(rel); if (!t) return "";
    var m = topicMastery(t), act = weakAction(t, m);
    return '<div class="cd-kd-h"><b>' + escapeHtml(t.f.title || t.short) + '</b><span class="cd-mbar ' + masteryTone(m.pct) + '"><i style="width:' + m.pct + '%"></i></span><em>' + m.pct + "%</em></div>" +
      '<ul class="cd-kd-parts">' + m.parts.map(function (p) {
        return "<li><span>" + escapeHtml(p[0]) + '</span><span class="cd-mbar sm"><i style="width:' + Math.round(p[1] * 100) + '%"></i></span><em>' + Math.round(p[1] * 100) + "%</em></li>";
      }).join("") + (m.miss ? '<li class="bad"><span>неотработанных ошибок</span><em>' + m.miss + "</em></li>" : "") + "</ul>" +
      (t.deps.length ? '<div class="cd-kd-deps">Опирается на: ' + t.deps.map(function (r) { var d = topicByRel(r); return d ? escapeHtml(d.short) + " (" + masteryPct(d) + "%)" : ""; }).join(", ") + "</div>" : "") +
      '<div class="cd-kd-btns"><button class="cd-weak-go" type="button" data-wrel="' + escapeHtml(t.rel) + '" data-wk="' + act.kind + '" data-wx="' + escapeHtml(act.hash || act.id || "") + '">' + escapeHtml(act.label) + " →</button>" +
      '<button class="cd-kd-open" type="button" data-krel2="' + escapeHtml(t.rel) + '">Открыть тему</button></div>';
  }

  // ---- Экзамен недели: 10 вопросов из слабых тем, 10 минут, первый ответ засчитывается ----
  var WEEKLY_N = 10, WEEKLY_MS = 10 * 60000;
  function weekKey(dt) {
    var d = new Date(dt || Date.now()); d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);                // четверг этой недели (ISO)
    var y = d.getFullYear(), jan4 = new Date(y, 0, 4, 12);
    var w = 1 + Math.round(((d - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7);
    return y + "-W" + (w < 10 ? "0" + w : w);
  }
  // Вопросы ```quiz темы: { q, opts: [{ok, text}], expl, rel }.
  function quizQuestionsOf(f) {
    var out = [];
    fenceBodies(f.md, "quiz").forEach(function (src) {
      var lines = String(src).split("\n");
      if (/^@exam\s/.test((lines[0] || "").trim())) lines.shift();
      var cur = null;
      function flush() { if (cur && cur.opts.length > 1 && cur.opts.some(function (o) { return o.ok; })) out.push(cur); cur = null; }
      lines.forEach(function (ln) {
        var t = ln.trim();
        var mq = t.match(/^(?:В|Q|Вопрос)\s*[:.)]\s*(.*)$/i);
        if (mq) { flush(); cur = { q: mq[1], opts: [], expl: "", rel: f.rel }; return; }
        if (!cur) { if (t) cur = { q: t, opts: [], expl: "", rel: f.rel }; return; }
        var mo = t.match(/^([+\-])\s+(.*)$/);
        if (mo) { cur.opts.push({ ok: mo[1] === "+", text: mo[2] }); return; }
        var me = t.match(/^[=>]\s+(.*)$/);
        if (me) { cur.expl += (cur.expl ? " " : "") + me[1]; return; }
        if (t && !cur.opts.length) cur.q += " " + t;
      });
      flush();
    });
    return out;
  }
  function buildWeeklyExam() {
    var wk = weekKey(), rnd = seededRand("weekly:" + wk);
    var topics = progressTopics().map(function (t) { return { t: t, p: masteryPct(t), qs: quizQuestionsOf(t.f) }; })
      .filter(function (x) { return x.qs.length; });
    var started = topics.filter(function (x) { return state.read[x.t.rel] || x.p > 0; });
    var pool = (started.length ? started : topics.slice(0, 3)).sort(function (a, b) { return a.p - b.p; });
    // Слабые темы — первыми и почаще: круговой отбор по отсортированному списку.
    pool.forEach(function (x) {
      for (var i = x.qs.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), tmp = x.qs[i]; x.qs[i] = x.qs[j]; x.qs[j] = tmp; }
    });
    var out = [], round = 0;
    while (out.length < WEEKLY_N && round < 20) {
      var took = false;
      for (var k = 0; k < pool.length && out.length < WEEKLY_N; k++) {
        if (round < pool[k].qs.length && (k < 3 || round < 2)) { out.push(pool[k].qs[round]); took = true; }
      }
      if (!took) break;
      round++;
    }
    if (out.length < WEEKLY_N) {
      topics.forEach(function (x) { x.qs.forEach(function (q) { if (out.length < WEEKLY_N && out.indexOf(q) === -1) out.push(q); }); });
    }
    out.forEach(function (q) {                                   // варианты — в своём порядке на эту неделю
      for (var i = q.opts.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), tmp = q.opts[i]; q.opts[i] = q.opts[j]; q.opts[j] = tmp; }
    });
    return { wk: wk, qs: out };
  }
  var weekly = null;   // идущий экзамен: { wk, qs, i, right, answers, t0, timer }
  function weeklyBest() { var r = state.weekly[weekKey()]; return r && typeof r.best === "number" ? r : null; }
  function weeklyHomeHtml() {
    var r = weeklyBest(), prog = progressTopics();
    if (!prog.length || !prog.some(function (t) { return quizQuestionsOf(t.f).length; })) return "";
    return '<div class="cd-home-warm cd-weekly' + (r ? " done" : "") + '" role="button" tabindex="0"><span class="cd-hw-ic">' + emo("icon-route", "") + "</span>" +
      '<div class="cd-hc-main"><div class="cd-hc-lbl">Экзамен недели' + (r ? " · сдан" : "") + "</div>" +
      '<div class="cd-hc-title">' + (r ? "Лучший результат: " + r.best + " из " + r.total : WEEKLY_N + " вопросов из слабых тем · 10 минут") + "</div>" +
      '<div class="cd-hc-meta">' + (r ? "можно пересдать — засчитается лучший" : "первый ответ на вопрос засчитывается, ошибки вернутся в разминку") + "</div></div>" +
      '<div class="cd-hc-arrow">→</div></div>';
  }
  function weeklyIntroHtml() {
    var ex = buildWeeklyExam(), r = weeklyBest(), rels = {};
    ex.qs.forEach(function (q) { rels[q.rel] = 1; });
    var names = Object.keys(rels).map(function (rel) { var t = topicByRel(rel); return t ? t.short : rel; });
    if (!ex.qs.length) return '<p class="cd-pg-empty">Нет вопросов для экзамена: в темах пока нет блоков «Проверь себя».</p>';
    var hist = Object.keys(state.weekly).sort().reverse().slice(0, 6).map(function (k) {
      var h = state.weekly[k]; return "<li><span>" + escapeHtml(k.replace("-W", ", неделя ")) + "</span><b>" + h.best + " / " + h.total + "</b></li>";
    }).join("");
    return '<div class="cd-wk-intro"><p>' + ex.qs.length + " " + plural(ex.qs.length, ["вопрос", "вопроса", "вопросов"]) + " на " + (WEEKLY_MS / 60000) +
      " минут. Темы этой недели: <b>" + escapeHtml(names.join(", ")) + "</b> — сначала самые слабые.</p>" +
      "<p>Засчитывается первый ответ. Вопросы, где ошибёшься, придут в «Разминку дня».</p>" +
      (r ? '<p class="cd-wk-best">На этой неделе лучший результат: <b>' + r.best + " из " + r.total + "</b></p>" : "") +
      '<button class="cd-wk-start" type="button">' + (r ? "Пересдать" : "Начать экзамен") + "</button>" +
      (hist ? '<div class="cd-wk-hist"><div>Прошлые недели</div><ul>' + hist + "</ul></div>" : "") + "</div>";
  }
  function weeklyStart() {
    var ex = buildWeeklyExam(); if (!ex.qs.length) return;
    weeklyStop();
    weekly = { wk: ex.wk, qs: ex.qs, i: 0, right: 0, answers: [], t0: Date.now(), timer: null };
    weeklyArm();
    renderWeekly();
  }
  function weeklyArm() { if (weekly && !weekly.done) weekly.timer = setTimeout(function () { weeklyTick(); weeklyArm(); }, 1000); }
  function weeklyStop() { if (weekly && weekly.timer) clearTimeout(weekly.timer); if (weekly) weekly.timer = null; }
  function weeklyLeft() { return weekly ? Math.max(0, WEEKLY_MS - (Date.now() - weekly.t0)) : 0; }
  function mmss(ms) { var s = Math.round(ms / 1000); return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
  function weeklyTick() {
    if (!weekly || weekly.done) { weeklyStop(); return; }
    var tEl = progressEl && progressEl.querySelector(".cd-wk-timer");
    if (tEl) tEl.textContent = mmss(weeklyLeft());
    if (weeklyLeft() <= 0) weeklyFinish(true);
  }
  function renderWeekly() {
    var box = progressEl && progressEl.querySelector('.cd-pg-page[data-pg="weekly"]'); if (!box || !weekly) return;
    if (weekly.done) { setHTML(box, weeklyResultHtml()); return; }
    var q = weekly.qs[weekly.i], a = weekly.answers[weekly.i], t = topicByRel(q.rel);
    var opts = q.opts.map(function (o, k) {
      var cls = a == null ? "" : (o.ok ? " right" : (a === k ? " wrong" : ""));
      return '<button class="cd-wk-opt' + cls + '" type="button" data-k="' + k + '"' + (a == null ? "" : " disabled") + ">" + inline(o.text) + "</button>";
    }).join("");
    setHTML(box, '<div class="cd-wk-top"><span>Вопрос ' + (weekly.i + 1) + " из " + weekly.qs.length + '</span><span class="cd-wk-score">верно ' + weekly.right + "</span>" +
      '<span class="cd-wk-timer">' + mmss(weeklyLeft()) + "</span></div>" +
      '<div class="cd-wk-q"><div class="cd-wk-from">' + escapeHtml(t ? t.short : q.rel) + "</div>" + inline(q.q) + "</div>" +
      '<div class="cd-wk-opts">' + opts + "</div>" +
      (a != null && q.expl ? '<div class="cd-wk-expl">' + inline(q.expl) + "</div>" : "") +
      '<div class="cd-wk-ctl">' + (a != null ? '<button class="cd-wk-next" type="button">' + (weekly.i + 1 < weekly.qs.length ? "Дальше →" : "Итог") + "</button>" : "") +
      '<button class="cd-wk-quit" type="button">Сдать досрочно</button></div>');
  }
  function weeklyAnswer(k) {
    if (!weekly || weekly.done || weekly.answers[weekly.i] != null) return;
    var q = weekly.qs[weekly.i];
    weekly.answers[weekly.i] = k;
    if (q.opts[k] && q.opts[k].ok) weekly.right++;
    else {
      // ошибка → в «Разминку дня» (как и в обычных опросах)
      var right = q.opts.filter(function (o) { return o.ok; }).map(function (o) { return o.text; }).join("; ");
      state.missed["quiz:" + cdHash(q.q)] = { rel: q.rel, hash: "", q: String(q.q).slice(0, 4000), a: (right + (q.expl ? " — " + q.expl : "")).slice(0, 4000), due: cdDate(1), kind: "quiz", md: 0 };
    }
    renderWeekly();
  }
  function weeklyFinish(timeout) {
    if (!weekly || weekly.done) return;
    weeklyStop();
    weekly.done = true; weekly.timeout = !!timeout; weekly.ms = Date.now() - weekly.t0;
    var prev = state.weekly[weekly.wk] || {};
    state.weekly[weekly.wk] = { best: Math.max(prev.best || 0, weekly.right), total: weekly.qs.length, ms: weekly.ms, tries: (prev.tries || 0) + 1, at: Date.now() };
    keepLast(state.weekly, 104);
    bumpCount("weekly");
    if (weekly.right === weekly.qs.length) bumpCount("weeklyPerfect");
    recordActivity(); saveState();
    renderWeekly();
  }
  function weeklyResultHtml() {
    var w = weekly, n = w.qs.length, pct = n ? Math.round(w.right / n * 100) : 0, by = {};
    w.qs.forEach(function (q, i) {
      var r = by[q.rel] || (by[q.rel] = { ok: 0, n: 0 });
      r.n++; if (w.answers[i] != null && q.opts[w.answers[i]] && q.opts[w.answers[i]].ok) r.ok++;
    });
    var rows = Object.keys(by).map(function (rel) {
      var t = topicByRel(rel), r = by[rel];
      return "<li><span>" + escapeHtml(t ? t.short : rel) + '</span><span class="cd-mbar sm ' + masteryTone(Math.round(r.ok / r.n * 100)) + '"><i style="width:' + Math.round(r.ok / r.n * 100) + '%"></i></span><b>' + r.ok + " / " + r.n + "</b></li>";
    }).join("");
    return '<div class="cd-wk-res"><div class="cd-wk-big">' + w.right + " / " + n + "</div>" +
      "<div>" + (w.timeout ? "Время вышло. " : "") + (pct === 100 ? "Без единой ошибки!" : pct >= 80 ? "Отличный результат." : pct >= 50 ? "Неплохо — ошибки уже в разминке." : "Темы стоит повторить — начни со слабых мест.") +
      " Время: " + mmss(w.ms) + "</div><ul class=\"cd-wk-by\">" + rows + "</ul>" +
      '<div class="cd-wk-ctl"><button class="cd-wk-again" type="button">Ещё раз</button><button class="cd-pg-tab-go" type="button" data-go="map">К карте знаний</button></div></div>';
  }
  // ==== runtime/12-rewards.js — окно «Прогресс»: карта, экзамен недели, достижения, рекорды; Anki ====
  // ---------------------------------------------------------------------------
  //  Достижения — за реальные действия (собрал, починил, решил без подсказок), а не за клики.
  //  Счётчики событий — state.ach.n, полученные — state.ach.got { id: дата }.
  // ---------------------------------------------------------------------------
  function achState() {
    if (!state.ach || typeof state.ach !== "object" || Array.isArray(state.ach)) state.ach = {};
    if (!state.ach.got || typeof state.ach.got !== "object" || Array.isArray(state.ach.got)) state.ach.got = {};
    if (!state.ach.n || typeof state.ach.n !== "object" || Array.isArray(state.ach.n)) state.ach.n = {};
    return state.ach;
  }
  function achN(k) { var v = achState().n[k]; return typeof v === "number" && isFinite(v) ? v : 0; }
  function bumpCount(k, by) { var a = achState(); a.n[k] = achN(k) + (by || 1); achSoon(); }
  var _achBusy = false;
  // Зовёт saveState: проверка — не чаще раза в секунду (сохранения идут пачками при прокрутке).
  var _achAt = 0;
  function achOnSave() {
    if (_achBusy || Date.now() - _achAt < 1000 && _achT) return;
    _achBusy = true; _achAt = Date.now();
    try { checkAchievements(false); } catch (e) { reportError("достижения", e); } finally { _achBusy = false; }
  }
  function countMap(m) { return Object.keys(m || {}).filter(function (k) { return m[k]; }).length; }
  function masteredCount(p) { try { return progressTopics().filter(function (t) { return masteryPct(t) >= p; }).length; } catch (e) { return 0; } }
  function coreTopicsRead() {
    var d = DATA(); if (!d) return false;
    var n = 0;
    for (var k = 1; k <= 8; k++) if (d.files.some(function (f) { return /^ref\//i.test(f.rel) && topicNum(f.rel) === k && state.read[f.rel]; })) n++;
    return n >= 8;
  }
  function bestDailyMs() {
    var best = 0;
    Object.keys(state.records).forEach(function (k) { var r = state.records[k]; if (r && r.ms > 0 && (!best || r.ms < best)) best = r.ms; });
    return best;
  }
  var ACH = [
    { id: "read1", ic: "ui-read", t: "Первая тема", d: "Отметить первую тему «Изучено»", ok: function () { return countMap(state.read) >= 1; } },
    { id: "read10", ic: "ui-learned", t: "Десять тем", d: "Отметить «Изучено» десять материалов", ok: function () { return countMap(state.read) >= 10; } },
    { id: "core", ic: "icon-ref", t: "Фундамент", d: "Изучены темы 1–8 справочника", ok: coreTopicsRead },
    { id: "run1", ic: "ui-steps", t: "Первая сборка", d: "Программа собралась прямо в окне", ok: function () { return achN("compiled") >= 1; } },
    { id: "pass1", ic: "ui-solve", t: "Все тесты зелёные", d: "Решить первое «напиши и запусти»", ok: function () { return achN("runPass") >= 1; } },
    { id: "fix5", ic: "ui-hint", t: "Чиню сборку", d: "Пять раз исправить ошибку компиляции и собрать заново", ok: function () { return achN("compileFix") >= 5; } },
    { id: "crash", ic: "mascot-think", t: "Укротитель падений", d: "Программа упала, а после правки прошла все тесты", ok: function () { return achN("crashFix") >= 1; } },
    { id: "hang", ic: "ui-shuffle", t: "Вечный цикл пойман", d: "Программа зависла, а после правки прошла тесты", ok: function () { return achN("hangFix") >= 1; } },
    { id: "nohint10", ic: "mascot-search", t: "Без подсказок", d: "Десять заданий подряд решено без подсказок и эталона", ok: function () { return achN("noHintBest") >= 10; } },
    { id: "cards100", ic: "ui-cards", t: "Сто повторений", d: "Оценить карточки сто раз", ok: function () { return achN("graded") >= 100; } },
    { id: "streak7", ic: "ui-streak", t: "Неделя подряд", d: "Заниматься семь дней без пропуска", ok: function () { return streakDays() >= 7; } },
    { id: "streak30", ic: "ui-streak", t: "Месяц подряд", d: "Тридцать дней без пропуска", ok: function () { return streakDays() >= 30; } },
    { id: "daily7", ic: "ui-dice", t: "Задача дня ×7", d: "Решать задачу дня неделю подряд", ok: function () { return dailyStreak() >= 7; } },
    { id: "fast", ic: "ui-warm", t: "Молния", d: "Решить задачу дня быстрее двух минут", ok: function () { var b = bestDailyMs(); return b > 0 && b < 120000; } },
    { id: "boss1", ic: "icon-tasks", t: "Первый босс", d: "Победить босса темы", ok: function () { return countMap(state.boss) >= 1; } },
    { id: "boss5", ic: "icon-tasks", t: "Пять боссов", d: "Победить пять боссов", ok: function () { return countMap(state.boss) >= 5; } },
    { id: "exam1", ic: "ui-learned", t: "Зачёт", d: "Сдать итоговую проверку этапа", ok: function () { return Object.keys(state.exams).some(function (k) { return state.exams[k] && state.exams[k].passed; }); } },
    { id: "weekly1", ic: "icon-route", t: "Экзамен недели", d: "Пройти экзамен недели", ok: function () { return achN("weekly") >= 1; } },
    { id: "weekly100", ic: "mascot-win", t: "Без единой ошибки", d: "Экзамен недели на все вопросы", ok: function () { return achN("weeklyPerfect") >= 1; } },
    { id: "master1", ic: "icon-start", t: "Тема освоена", d: "Освоить тему на 80 % и больше", ok: function () { return masteredCount(80) >= 1; } },
    { id: "master5", ic: "mascot-done", t: "Пять освоенных тем", d: "Пять тем на 80 %+", ok: function () { return masteredCount(80) >= 5; } },
    { id: "repeat1", ic: "icon-examples", t: "Повторил за мной", d: "Написать пример программы самому по её поведению", ok: function () { return achN("repeat") >= 1; } },
    { id: "check1", ic: "ui-peek", t: "Сверился с эталоном", d: "Сравнить свою игру с контрольной точкой главы", ok: function () { return achN("checkpoint") >= 1; } },
  ];
  // Достижения проверяет saveState (перед записью — одна метка времени у localStorage и зеркала).
  // Счётчики, которые меняются без сохранения, просят сохранение с задержкой.
  var _achT = null;
  function achSoon() { clearTimeout(_achT); _achT = setTimeout(function () { _achT = null; saveState(); }, 700); }
  // Новые достижения → в state.ach.got + тост. Первый запуск этой версии — молча (старые заслуги не сыплются тостами).
  function checkAchievements(silent) {
    var a = achState(), fresh = [];
    var quiet = silent || !a.init;
    ACH.forEach(function (x) {
      if (a.got[x.id]) return;
      var ok = false; try { ok = !!x.ok(); } catch (e) {}
      if (ok) { a.got[x.id] = cdDate(0); fresh.push(x); }
    });
    a.init = 1;
    if (!quiet && fresh.length) setTimeout(function () {
      toast("Достижение: " + fresh.map(function (x) { return x.t; }).join(", ") + "!");
      try { if (winEl) celebrate(winEl.querySelector(".cd-head") || winEl, "#f9e2af"); } catch (e) {}
    }, 0);
    return fresh;
  }
  function achHtml() {
    var a = achState(), got = ACH.filter(function (x) { return a.got[x.id]; }).length;
    return '<div class="cd-ach-sum"><b>' + got + "</b> из " + ACH.length + " достижений</div>" +
      '<div class="cd-ach-grid">' + ACH.map(function (x) {
        var d = a.got[x.id];
        // значок — наклейка; нет её — первая буква названия в кружке; не получено — бледный
        return '<div class="cd-ach' + (d ? " got" : "") + '"><span class="cd-ach-ic">' + emo(x.ic, '<span class="cd-ach-mono">' + escapeHtml(x.t.charAt(0)) + "</span>") + "</span>" +
          '<span class="cd-ach-t">' + escapeHtml(x.t) + "</span><span class=\"cd-ach-d\">" + escapeHtml(x.d) + "</span>" +
          (d ? '<span class="cd-ach-when">' + escapeHtml(d) + "</span>" : "") + "</div>";
      }).join("") + "</div>";
  }

  // ---- Счётчики из «Запустить» и решений: зовут 13-interactive.js ----
  function noteRunResult(box, res) {
    if (!box || !res) return;
    if (res.stage === "compile") { box.__hadCompileErr = true; return; }
    if (res.stage !== "run") return;
    bumpCount("compiled");
    if (box.__hadCompileErr) { box.__hadCompileErr = false; bumpCount("compileFix"); }
    var tests = res.tests || [];
    if (tests.some(function (t) { return t.crash; })) box.__hadCrash = true;
    if (res.stopped === "hang") box.__hadHang = true;
    if (res.ok && tests.length) {
      bumpCount("runPass");
      if (box.__hadCrash) { box.__hadCrash = false; bumpCount("crashFix"); }
      if (box.__hadHang) { box.__hadHang = false; bumpCount("hangFix"); }
      if (box.classList && box.classList.contains("cd-rep")) bumpCount("repeat");
    }
    if (!res.ok) noteAttempt(box, false);
  }
  // Подсказки: открыл подсказку или эталон — задание решено «с помощью».
  function boxHinted(box) {
    var hb = box && box.querySelector && box.querySelector(".cd-hints");
    return !!(box && (box.__solShown || box.__revealed || (hb && +hb.getAttribute("data-shown") > 0)));
  }
  function noteSolvedFirst(box) {
    if (boxHinted(box)) { achState().n.noHintRun = 0; }
    else {
      var run = achN("noHintRun") + 1;
      achState().n.noHintRun = run;
      if (run > achN("noHintBest")) achState().n.noHintBest = run;
    }
    achSoon();
  }

  // ---- Рекорды задачи дня: время, попытки, без подсказок ----
  function dailyFor(box) {
    var id = box && box.getAttribute && box.getAttribute("data-id");
    return id && state.daily && state.daily.id === id && state.daily.date === cdDate(0) ? state.daily : null;
  }
  function noteDailyOpened() {
    if (state.daily && state.daily.date === cdDate(0) && !state.daily.startAt && !state.dailyDone[cdDate(0)]) {
      state.daily.startAt = Date.now(); state.daily.tries = 0; state.daily.hint = false; saveState();
    }
  }
  function noteAttempt(box, ok) { var dc = dailyFor(box); if (dc && !ok) { dc.tries = (dc.tries | 0) + 1; saveState(); } }
  function noteHint(box) { var dc = dailyFor(box); if (dc) { dc.hint = true; saveState(); } }
  function typeBest(type, skipDate) {
    var best = null;
    Object.keys(state.records).forEach(function (k) {
      var r = state.records[k];
      if (!r || k === skipDate || r.type !== type || !(r.ms > 0)) return;
      if (!best || r.ms < best.ms) best = r;
    });
    return best;
  }
  function noteDailySolved(box) {
    var dc = dailyFor(box); if (!dc) return;
    var today = cdDate(0);
    if (state.records[today]) return;
    var rec = { type: dc.type, ms: dc.startAt ? Date.now() - dc.startAt : 0, tries: (dc.tries | 0) + 1, hint: !!(dc.hint || boxHinted(box)) };
    var prev = typeBest(dc.type, today);
    state.records[today] = rec;
    keepLast(state.records, 400);
    saveState();
    if (rec.ms > 0 && (!prev || rec.ms < prev.ms)) {
      setTimeout(function () { toast("Новый рекорд «" + (DAILY_TYPES[rec.type] || "задание") + "»: " + mmss(rec.ms) + (prev ? " (было " + mmss(prev.ms) + ")" : "")); }, 2700);
    }
  }
  function dailyRecordLine(type) {
    var b = typeBest(type, null), t = state.records[cdDate(0)];
    if (t && t.ms) return "сегодня " + mmss(t.ms) + (t.tries > 1 ? ", попыток " + t.tries : ", с первой попытки") + (b && b !== t ? " · рекорд " + mmss(b.ms) : "");
    return b ? "рекорд " + mmss(b.ms) : "";
  }
  function recordsHtml() {
    var keys = Object.keys(state.records).sort().reverse();
    if (!keys.length) return '<p class="cd-pg-empty">Рекордов пока нет. Реши задачу дня с главной — время засекается с момента, как ты её открыл.</p>';
    var rows = Object.keys(DAILY_TYPES).map(function (type) {
      var list = keys.map(function (k) { return state.records[k]; }).filter(function (r) { return r && r.type === type; });
      if (!list.length) return "";
      var b = typeBest(type, null), avgTries = list.slice(0, 30).reduce(function (s, r) { return s + (r.tries || 1); }, 0) / Math.min(30, list.length);
      var clean = list.filter(function (r) { return !r.hint && (r.tries || 1) === 1; }).length;
      return "<tr><td>" + escapeHtml(DAILY_TYPES[type]) + "</td><td>" + list.length + "</td><td><b>" + (b ? mmss(b.ms) : "—") + "</b></td><td>" +
        avgTries.toFixed(1) + "</td><td>" + clean + "</td></tr>";
    }).join("");
    var last = keys.slice(0, 14).map(function (k) {
      var r = state.records[k];
      return "<li><span>" + escapeHtml(k) + "</span><span>" + escapeHtml(DAILY_TYPES[r.type] || "") + "</span><b>" + (r.ms ? mmss(r.ms) : "—") + "</b><span>" +
        (r.tries || 1) + " " + plural(r.tries || 1, ["попытка", "попытки", "попыток"]) + (r.hint ? " · с подсказкой" : "") + "</span></li>";
    }).join("");
    return '<div class="cd-rec-sum">Серия задачи дня: <b>' + dailyStreak() + "</b> · всего решено: <b>" + keys.length + "</b></div>" +
      '<div class="tablewrap"><table class="cd-rec-t"><thead><tr><th>Вид</th><th>Решено</th><th>Лучшее время</th><th>Попыток в среднем</th><th>С первой без подсказок</th></tr></thead><tbody>' +
      rows + "</tbody></table></div>" + '<div class="cd-rec-last"><div>Последние дни</div><ul>' + last + "</ul></div>";
  }

  // ---- Экспорт карточек в Anki: текст с табуляцией (вопрос, ответ, метки) ----
  function ankiField(s) {
    return escapeHtml(String(s || "")).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
  }
  function ankiExportText() {
    var seen = {}, lines = ["#separator:tab", "#html:true", "#tags column:3"];
    collectAllCards().forEach(function (c) {
      if (seen[c.id]) return; seen[c.id] = 1;
      var tag = "cpp-docs " + String(c.rel).replace(/\.md$/i, "").replace(/[^\wа-яё-]+/gi, "_");
      lines.push(ankiField(c.q) + "\t" + ankiField(c.a) + "\t" + tag);
    });
    return { text: lines.join("\n") + "\n", count: lines.length - 3 };
  }
  function exportAnki() {
    var ex = ankiExportText();
    if (!ex.count) { toast("Карточек пока нет — они появятся, когда загрузятся материалы", true); return; }
    sendAction({ kind: "export-anki", text: ex.text, count: ex.count }, function (res) {
      if (res.ok) toast("Выбери, куда сохранить колоду (" + ex.count + " карточек)");
      else toast("Не получилось: " + (res.error || "нет связи с расширением"), true);
    });
  }

  // ---- Окно «Прогресс» поверх окна документации (как «Обучение») ----
  var progressEl = null;
  var PG_TABS = [["map", "Карта знаний"], ["weekly", "Экзамен недели"], ["ach", "Достижения"], ["rec", "Рекорды"]];
  function showProgress(tab) {
    if (!winEl) return;
    if (!progressEl) {
      progressEl = el("div", null); progressEl.className = "cd-guide cd-pg"; progressEl.hidden = true;
      progressEl.setAttribute("role", "dialog"); progressEl.setAttribute("aria-label", "Прогресс");
      progressEl.addEventListener("click", onProgressClick);
      progressEl.addEventListener("keydown", function (e) {
        var n = e.target && e.target.closest && e.target.closest(".cd-km-n");
        if (n && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); kmSelect(n.getAttribute("data-krel")); }
      });
      winEl.appendChild(progressEl);
    }
    try { if (checkAchievements(false).length) saveState(); } catch (e) {}
    setHTML(progressEl, '<div class="cd-guide-panel cd-pg-panel"><div class="cd-guide-top"><div class="cd-guide-title">Прогресс</div>' +
      '<button class="cd-pg-anki" type="button" title="Все карточки справочника — файлом для Anki">Карточки в Anki</button>' +
      '<button class="cd-guide-close" type="button" title="Закрыть" aria-label="Закрыть">×</button></div>' +
      '<div class="cd-guide-tabs">' + PG_TABS.map(function (t) { return '<button class="cd-guide-chip" type="button" data-pgt="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      '<div class="cd-guide-scroll">' + PG_TABS.map(function (t) { return '<div class="cd-pg-page" data-pg="' + t[0] + '" hidden></div>'; }).join("") + "</div></div>");
    progressEl.hidden = false;
    progressTab(tab || "map");
  }
  function progressTab(tab) {
    if (!progressEl) return;
    progressEl.querySelectorAll(".cd-guide-chip").forEach(function (c) { c.classList.toggle("on", c.getAttribute("data-pgt") === tab); });
    progressEl.querySelectorAll(".cd-pg-page").forEach(function (p) {
      var on = p.getAttribute("data-pg") === tab;
      p.hidden = !on;
      if (!on) return;
      if (tab === "map") setHTML(p, knowledgeMapHtml());
      else if (tab === "weekly") { if (weekly && !weekly.done) renderWeekly(); else if (weekly && weekly.done) renderWeekly(); else setHTML(p, weeklyIntroHtml()); }
      else if (tab === "ach") setHTML(p, achHtml());
      else if (tab === "rec") setHTML(p, recordsHtml());
    });
    var sc = progressEl.querySelector(".cd-guide-scroll"); if (sc) sc.scrollTop = 0;
  }
  function kmSelect(rel) {
    var det = progressEl && progressEl.querySelector(".cd-km-detail"); if (!det) return;
    progressEl.querySelectorAll(".cd-km-n").forEach(function (n) { n.classList.toggle("sel", n.getAttribute("data-krel") === rel); });
    setHTML(det, kmDetailHtml(rel)); det.hidden = false;
  }
  function onProgressClick(e) {
    var t = e.target; if (!t) return;
    if (t === progressEl) { hideProgress(); return; }
    if (!t.closest) return;
    if (t.closest(".cd-guide-close")) { hideProgress(); return; }
    if (t.closest(".cd-pg-anki")) { exportAnki(); return; }
    var chip = t.closest(".cd-guide-chip"); if (chip) { progressTab(chip.getAttribute("data-pgt")); return; }
    var go = t.closest(".cd-pg-tab-go"); if (go) { if (weekly && weekly.done) weekly = null; progressTab(go.getAttribute("data-go")); return; }
    var node = t.closest(".cd-km-n"); if (node) { kmSelect(node.getAttribute("data-krel")); return; }
    var nx = t.closest(".cd-km-next"); if (nx) { hideProgress(); openFile(nx.getAttribute("data-krel")); return; }
    var op = t.closest(".cd-kd-open"); if (op) { hideProgress(); openFile(op.getAttribute("data-krel2")); return; }
    var wg = t.closest(".cd-weak-go"); if (wg) { runWeakAction(wg.getAttribute("data-wrel"), wg.getAttribute("data-wk"), wg.getAttribute("data-wx")); return; }
    if (t.closest(".cd-wk-start") || t.closest(".cd-wk-again")) { weeklyStart(); return; }
    var opt = t.closest(".cd-wk-opt"); if (opt) { weeklyAnswer(+opt.getAttribute("data-k")); return; }
    if (t.closest(".cd-wk-next")) { if (weekly.i + 1 < weekly.qs.length) { weekly.i++; renderWeekly(); } else weeklyFinish(false); return; }
    if (t.closest(".cd-wk-quit")) { weeklyFinish(false); return; }
  }
  function hideProgress() { if (progressEl) progressEl.hidden = true; }
  function progressOpen() { return !!(progressEl && !progressEl.hidden); }
  // ==== runtime/13-checkpoint.js — «Контрольная точка главы» и «Повтори за мной», сравнение кода ====
  // ---------------------------------------------------------------------------
  //  ```checkpoint — эталон игры «Подземелье» на конец главы. «Сравнить с моим кодом» берёт открытый
  //  в редакторе .cpp (действие окна editor-text) и показывает построчное сравнение: что совпало,
  //  чего нет у тебя, что у тебя своё, — и каких функций/типов эталона у тебя пока нет.
  //    # Название
  //    Что должно быть готово к концу главы (Markdown)
  //    ---
  //    код эталона
  //
  //  ```repeat — «Повтори за мной» в примерах: код примера спрятан (размыт), видно только поведение
  //  программы — тесты «ввод => что должно появиться в выводе». Ученик пишет свою версию, окно
  //  собирает и проверяет её (режим contains: подсказки ввода у каждого свои), потом — сравнение с
  //  кодом примера.
  //    @id ключ
  //    @hint подсказка (сколько угодно)
  //    Условие
  //    ---
  //    ввод => строка вывода\nещё строка
  // ---------------------------------------------------------------------------
  function renderCheckpoint(src) {
    var raw = String(src).replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, ""), title = "Контрольная точка";
    var m = raw.match(/^#\s+(.*)\n?/);
    if (m) { title = m[1].trim(); raw = raw.slice(m[0].length); }
    var parts = raw.split(/^\s*---\s*$/m);
    var code = (parts.slice(1).join("---") || "").replace(/^\n+|\n+$/g, "");
    if (!code) return "";
    return '<div class="cd-cp" data-code="' + encodeURIComponent(code) + '">' +
      '<div class="cd-cp-head"><span class="cd-ch-badge">контрольная точка</span><b>' + inline(title) + "</b></div>" +
      '<div class="cd-cp-body">' + renderMarkdown(parts[0] || "", null) + "</div>" +
      '<div class="cd-ch-ctl"><button class="cd-cp-cmp" type="button">Сравнить с моим кодом</button>' +
      '<button class="cd-cp-show" type="button">Показать эталон</button><span class="cd-ch-msg"></span></div>' +
      '<div class="cd-cp-res" hidden></div>' +
      '<div class="cd-cp-ref" hidden><pre class="code"><code>' + highlight(code, "cpp") + "</code></pre></div></div>";
  }
  function renderRepeat(src) {
    var fk = fenceKey(String(src).replace(/\r\n?/g, "\n")), secs = fk.body.split(/^\s*---\s*$/m);
    var prompt = [], hints = [];
    (secs[0] || "").split("\n").forEach(function (ln) {
      var mh = ln.match(/^\s*@hint\s+(.+)$/i);
      if (mh) { hints.push(mh[1].trim()); return; }
      if (/^\s*@ref\s/i.test(ln)) return;              // файл эталона — для scripts/check-challenges.js
      if (ln.trim()) prompt.push(ln.trim());
    });
    var tests = parseTestLines(secs[1] || ""), id = fk.id, done = !!state.challenge[id];
    var enabled = !!(DATA() && DATA().run && DATA().run.enabled);
    var rows = tests.map(function (t) {
      return "<tr><td><code>" + testShow(t["in"] || "∅") + "</code></td><td><code>" + testShow(t["out"]) + "</code></td></tr>";
    }).join("");
    var behave = rows ? '<div class="cd-ch-lab">как ведёт себя программа — ввод и что должно появиться в выводе (подсказки ввода пиши свои):</div>' +
      '<div class="tablewrap"><table><thead><tr><th>Ввод</th><th>В выводе есть</th></tr></thead><tbody>' + rows + "</tbody></table></div>" : "";
    var hide = state.repeatShowCode ? "" : " hidecode";
    var head = '<div class="cd-ch-head"><span class="cd-ch-badge">повтори за мной</span>' + inline(prompt.join(" ") || "Напиши эту программу сам — по её поведению") + "</div>" +
      '<label class="cd-rep-hide"><input type="checkbox" class="cd-rep-hidebox"' + (hide ? " checked" : "") + "> прятать код примера, пока решаю (клик по коду — подсмотреть)</label>";
    var starter = "#include <iostream>\n#include <string>\n\nint main() {\n    \n}\n";
    var cmp = '<button class="cd-rep-cmp" type="button"' + (done ? "" : " hidden") + ">Сравнить с кодом примера</button>";
    if (!enabled) {
      return '<div class="cd-ch cd-rep' + hide + (done ? " done" : "") + '" data-id="' + escapeHtml(id) + '">' + head + behave +
        '<div class="cd-run-hint">Проверка в один клик выключена: включи <code>cppDocs.localRun</code> и поставь компилятор. А пока — напиши программу в редакторе и сверь её поведение с таблицей.</div></div>';
    }
    return '<div class="cd-ch cd-ch-run cd-rep' + hide + (done ? " done" : "") + '" data-id="' + escapeHtml(id) + '" data-mode="contains" data-tests="' +
      encodeURIComponent(JSON.stringify(tests)) + '">' + head + behave +
      '<textarea class="cd-run-code" spellcheck="false" autocomplete="off" autocapitalize="off" rows="14">' + escapeHtml(starter) + "</textarea>" +
      '<div class="cd-ch-ctl"><button class="cd-run-go" type="button">Запустить</button>' +
      (tests.length ? '<span class="cd-run-tinfo">' + tests.length + " " + plural(tests.length, ["тест", "теста", "тестов"]) + "</span>" : "") +
      cmp + '<span class="cd-ch-msg"></span></div><div class="cd-run-out" hidden></div>' +
      '<div class="cd-cp-res" hidden></div>' + hintsHtml(hints, null, done) + "</div>";
  }
  // Код примера: первый ```cpp в разделе «Код целиком» (иначе — первый с main).
  function exampleRefCode(md) {
    var s = String(md || "").replace(/\r\n?/g, "\n");
    var after = s.split(/^##\s+Код целиком.*$/m)[1];
    var re = /```(?:cpp|c\+\+)[^\n]*\n([\s\S]*?)\n```/g, m;
    if (after) { m = re.exec(after); if (m) return m[1]; }
    re.lastIndex = 0;
    while ((m = re.exec(s))) if (/\bint\s+main\s*\(/.test(m[1])) return m[1];
    return "";
  }

  // ---- Сравнение кода: значимые строки (без пустых, комментариев и одиноких скобок), LCS ----
  function codeLines(text) {
    var out = [];
    String(text || "").replace(/\r\n?/g, "\n").split("\n").forEach(function (raw) {
      var ln = raw, q = 0, cut = -1;
      for (var i = 0; i < ln.length - 1; i++) {
        var c = ln.charAt(i);
        if (c === '"' && ln.charAt(i - 1) !== "\\") q ^= 1;
        if (!q && c === "/" && ln.charAt(i + 1) === "/") { cut = i; break; }
      }
      if (cut >= 0) ln = ln.slice(0, cut);
      var norm = ln.replace(/\s+/g, " ").trim();
      if (!norm || /^[{}();]+$/.test(norm)) return;
      out.push({ raw: raw.replace(/\s+$/, ""), key: norm.replace(/\s*([(){}\[\];,<>=+\-*\/&|!:])\s*/g, "$1") });
    });
    return out.slice(0, 700);
  }
  function lcsOps(a, b) {
    var n = a.length, m = b.length, dp = [];
    for (var i = 0; i <= n; i++) { dp.push(new Uint16Array(m + 1)); }
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i].key === b[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
    var ops = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i].key === b[j].key) { ops.push(["=", b[j].raw]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(["-", a[i].raw]); i++; }
      else { ops.push(["+", b[j].raw]); j++; }
    }
    for (; i < n; i++) ops.push(["-", a[i].raw]);
    for (; j < m; j++) ops.push(["+", b[j].raw]);
    return { ops: ops, same: dp[0][0] };
  }
  // Функции и типы верхнего уровня: «чего из эталона у тебя нет».
  function codeNames(text) {
    var fn = {}, ty = {};
    String(text || "").split(/\r?\n/).forEach(function (ln) {
      var t = ln.match(/^(?:struct|class|enum(?:\s+class)?)\s+([A-Za-z_]\w*)/);
      if (t) ty[t[1]] = 1;
      // «тип имя(параметры) [const] {» — тело может идти в той же строке
      var f = ln.match(/^[A-Za-z_][\w:<>,\s*&]*?[\s*&]([A-Za-z_]\w*)\s*\([^;{}]*?\)\s*(?:const\s*)?(?:\{.*)?$/);
      if (f && !/^(if|for|while|switch|return|else)$/.test(f[1]) && f[1] !== "main") fn[f[1]] = 1;
    });
    return { fn: Object.keys(fn), ty: Object.keys(ty) };
  }
  function diffHtml(refText, mineText, refLabel) {
    var a = codeLines(refText), b = codeLines(mineText);
    if (!b.length) return '<div class="cd-cp-note">В твоём файле пока нет кода.</div>';
    var r = lcsOps(a, b), pct = a.length ? Math.round(r.same / a.length * 100) : 0;
    var rn = codeNames(refText), mn = codeNames(mineText);
    var missFn = rn.fn.filter(function (x) { return mn.fn.indexOf(x) === -1; });
    var missTy = rn.ty.filter(function (x) { return mn.ty.indexOf(x) === -1; });
    var rows = "", run = [];
    function flushSame() {
      if (run.length > 6) {
        rows += run.slice(0, 2).map(sameRow).join("") + '<div class="cd-df-gap">… ещё ' + (run.length - 4) + " совпадающих строк …</div>" + run.slice(-2).map(sameRow).join("");
      } else rows += run.map(sameRow).join("");
      run = [];
    }
    function sameRow(x) { return '<div class="cd-df-l"><i> </i><code>' + escapeHtml(x) + "</code></div>"; }
    r.ops.forEach(function (o) {
      if (o[0] === "=") { run.push(o[1]); return; }
      flushSame();
      rows += '<div class="cd-df-l ' + (o[0] === "-" ? "del" : "add") + '"><i>' + (o[0] === "-" ? "−" : "+") + "</i><code>" + escapeHtml(o[1]) + "</code></div>";
    });
    flushSame();
    return '<div class="cd-cp-stat"><b>' + pct + "%</b> строк " + escapeHtml(refLabel) + " есть и у тебя (" + r.same + " из " + a.length + "; пустые строки, комментарии и отступы не считаются)</div>" +
      (missFn.length || missTy.length ? '<div class="cd-cp-miss">В эталоне есть, у тебя пока нет: ' +
        missTy.map(function (x) { return "<code>" + escapeHtml(x) + "</code> (тип)"; }).concat(missFn.map(function (x) { return "<code>" + escapeHtml(x) + "()</code>"; })).join(", ") + "</div>" : "") +
      '<div class="cd-cp-note">Совпадать дословно не нужно: у каждого свои имена и тексты. Смотри на устройство — какие функции, какие типы, где цикл.</div>' +
      '<div class="cd-df"><div class="cd-df-leg"><span class="del">− только в эталоне</span><span class="add">+ только у тебя</span></div>' + rows + "</div>";
  }

  function checkpointClick(t) {
    var cmp = t.closest(".cd-cp-cmp"), show = t.closest(".cd-cp-show");
    if (show) {
      var box = show.closest(".cd-cp"), ref = box && box.querySelector(".cd-cp-ref");
      if (ref) { ref.hidden = !ref.hidden; show.textContent = ref.hidden ? "Показать эталон" : "Спрятать эталон"; }
      return true;
    }
    if (!cmp) return false;
    var cb = cmp.closest(".cd-cp"), msg = cb.querySelector(".cd-ch-msg"), res = cb.querySelector(".cd-cp-res");
    var code = decodeURIComponent(cb.getAttribute("data-code") || "");
    cmp.disabled = true; if (msg) { msg.textContent = "Беру код из редактора…"; msg.className = "cd-ch-msg"; }
    sendAction({ kind: "editor-text" }, function (r) {
      cmp.disabled = false;
      if (!r.ok) { if (msg) { msg.textContent = r.error || "Не получилось взять код из редактора"; msg.className = "cd-ch-msg err"; } return; }
      if (msg) { msg.textContent = "Сравнил с файлом " + (r.name || ""); msg.className = "cd-ch-msg ok"; }
      setHTML(res, diffHtml(code, r.text, "эталона")); res.hidden = false;
      bumpCount("checkpoint"); saveState();
    });
    return true;
  }
  function repeatClick(t, e) {
    var hb = t.closest(".cd-rep-hidebox");
    if (hb) {
      var box = hb.closest(".cd-rep");
      box.classList.toggle("hidecode", hb.checked);
      state.repeatShowCode = !hb.checked; saveState();
      return false;   // чекбокс переключается сам
    }
    var cmp = t.closest(".cd-rep-cmp");
    if (cmp) {
      var rb = cmp.closest(".cd-rep"), res = rb.querySelector(".cd-cp-res"), ta = rb.querySelector(".cd-run-code");
      var ref = exampleRefCode(current && current.md);
      if (!ref) { toast("В материале нет кода примера для сравнения", true); return true; }
      setHTML(res, diffHtml(ref, ta ? ta.value : "", "примера")); res.hidden = false;
      return true;
    }
    // размытый код примера: клик — подсмотреть этот блок
    var pre = t.closest("pre");
    if (pre && !pre.closest(".cd-rep") && !pre.classList.contains("peek") && articleEl &&
        articleEl.querySelector(".cd-rep.hidecode:not(.done)")) {
      pre.classList.add("peek");
      if (e) e.stopPropagation();
      return true;
    }
    return false;
  }
  // Задача решена — кнопка сравнения появляется (зовёт challengeSolved через noteRunResult).
  function repeatSolved(box) {
    var b = box && box.classList && box.classList.contains("cd-rep") ? box.querySelector(".cd-rep-cmp") : null;
    if (b) b.hidden = false;
  }
  // ==== runtime/13-code-alts.js — другие применения примера; «Забегаем вперёд» под кодом ====
  // ---------------------------------------------------------------------------
  //  Один пример — несколько применений того же приёма. В Markdown сразу после блока кода идут
  //  блоки «```cpp alt: Подпись»; окно собирает их в один блок-карусель:
  //    • вкладки с подписями над кодом (где это встречается) — клик переключает;
  //    • стрелки ‹ › справа по центру кода и точки-индикатор; ← → с клавиатуры, когда блок в фокусе;
  //    • все слайды лежат в одной ячейке сетки — высота блока = самый высокий слайд, страница не прыгает;
  //    • «копировать» и «в редактор» берут показанный слайд.
  // ---------------------------------------------------------------------------
  function renderCodeAlts(main, alts, langLabel, lc) {
    var slides = [{ label: "Пример из текста", code: main.code, html: main.html, lined: main.lined }].concat(alts.map(function (a) {
      return { label: a.label, code: a.code, html: highlight(a.code, a.lang), lined: false };
    }));
    var n = slides.length;
    var tabs = slides.map(function (s, k) {
      return '<button class="cd-alt-tab' + (k ? "" : " on") + '" type="button" role="tab" data-k="' + k + '" aria-selected="' + (k ? "false" : "true") + '">' +
        '<i>' + (k + 1) + "</i>" + escapeHtml(s.label) + "</button>";
    }).join("");
    var panes = slides.map(function (s, k) {
      return '<div class="cd-alt-pane' + (k ? "" : " on") + '" role="tabpanel" data-k="' + k + '" data-label="' + escapeHtml(s.label) + '" data-code="' + escapeHtml(s.code) + '"' +
        (k ? ' aria-hidden="true"' : "") + '><pre class="code' + (s.lined ? " cd-lined" : "") + '"><code>' + s.html + "</code></pre></div>";
    }).join("");
    var dots = "";
    for (var d = 0; d < n; d++) dots += '<i class="' + (d ? "" : "on") + '"></i>';
    return '<div class="codewrap cd-alts" data-k="0" data-n="' + n + '">' +
      '<div class="codehead"><span class="codelang">' + langLabel + "</span>" +
      '<span class="cd-alt-count">' + n + " " + plural(n, ["применение", "применения", "применений"]) + "</span>" +
      '<span class="cd-codebtns">' + (TOED_LANGS[lc] ? toEditorBtn(main.code) : "") +
      '<button class="cd-wrapbtn" type="button" title="Переносить длинные строки (для всех блоков кода)">↩ перенос</button>' +
      '<button class="copybtn" type="button" title="Копировать показанный код" data-code="' + escapeHtml(main.code) + '"><span class="cb-ic">⧉</span> копировать</button></span></div>' +
      '<div class="cd-alt-tabs" role="tablist" aria-label="Применения этого приёма">' + tabs + "</div>" +
      '<div class="cd-alt-body">' + panes +
      '<div class="cd-alt-nav">' +
      '<button class="cd-alt-go" data-d="-1" type="button" title="Предыдущее применение" aria-label="Предыдущее применение" disabled>‹</button>' +
      '<span class="cd-alt-dots" aria-hidden="true">' + dots + "</span>" +
      '<button class="cd-alt-go next" data-d="1" type="button" title="Дальше: ' + escapeHtml(slides[1].label) + '" aria-label="Следующее применение">›</button>' +
      "</div></div></div>";
  }
  // Показать слайд k. dir — откуда въезжает (1 — справа, -1 — слева) для анимации.
  function altShow(w, k, dir) {
    var n = +w.getAttribute("data-n") || 1, cur = +w.getAttribute("data-k") || 0;
    k = Math.max(0, Math.min(n - 1, k));
    if (k === cur && w.__altSeen) return;
    w.__altSeen = true;
    w.setAttribute("data-k", String(k));
    w.classList.add("used");                                  // стрелку больше не подсвечиваем
    var panes = w.querySelectorAll(".cd-alt-pane"), pane = null;
    for (var i = 0; i < panes.length; i++) {
      var on = i === k;
      panes[i].classList.toggle("on", on);
      panes[i].classList.remove("in-l", "in-r");
      if (on) { pane = panes[i]; panes[i].removeAttribute("aria-hidden"); } else panes[i].setAttribute("aria-hidden", "true");
    }
    if (!pane) return;
    if (dir) { void pane.offsetWidth; pane.classList.add(dir > 0 ? "in-r" : "in-l"); }
    var tabs = w.querySelectorAll(".cd-alt-tab");
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].classList.toggle("on", t === k);
      tabs[t].setAttribute("aria-selected", t === k ? "true" : "false");
    }
    var strip = w.querySelector(".cd-alt-tabs"), tab = tabs[k];
    if (strip && tab) {                                       // активная вкладка — в видимой части полосы
      var left = tab.offsetLeft - 12, right = tab.offsetLeft + tab.offsetWidth + 12;
      if (left < strip.scrollLeft) strip.scrollLeft = left;
      else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth;
    }
    var dots = w.querySelectorAll(".cd-alt-dots i");
    for (var j = 0; j < dots.length; j++) dots[j].classList.toggle("on", j === k);
    var code = pane.getAttribute("data-code") || "";
    var cb = w.querySelector(".copybtn"); if (cb) cb.setAttribute("data-code", code);
    var te = w.querySelector(".cd-toed"); if (te) te.setAttribute("data-code", code);
    var gos = w.querySelectorAll(".cd-alt-go");
    if (gos[0]) gos[0].disabled = k === 0;
    if (gos[1]) {
      gos[1].disabled = k === n - 1;
      var nx = panes[k + 1];
      gos[1].title = nx ? "Дальше: " + (nx.getAttribute("data-label") || "") : "Это последнее применение";
    }
  }
  function altGo(btn) {
    var w = btn.closest(".cd-alts"); if (!w) return;
    var cur = +w.getAttribute("data-k") || 0;
    if (btn.classList.contains("cd-alt-tab")) { var k = +btn.getAttribute("data-k") || 0; altShow(w, k, k > cur ? 1 : k < cur ? -1 : 0); return; }
    var d = +btn.getAttribute("data-d") || 0;
    altShow(w, cur + d, d);
  }
  // ← → листают, когда фокус внутри блока (на вкладке, стрелке или кнопке блока).
  function altKey(e) {
    if (!e || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return false;
    var a = document.activeElement, w = a && a.closest ? a.closest(".cd-alts") : null;
    if (!w) return false;
    var d = e.key === "ArrowRight" ? 1 : -1, cur = +w.getAttribute("data-k") || 0;
    altShow(w, cur + d, d);
    var tab = w.querySelectorAll(".cd-alt-tab")[+w.getAttribute("data-k") || 0];
    if (tab && a.classList.contains("cd-alt-tab")) tab.focus();
    e.preventDefault();
    return true;
  }

  // ---------------------------------------------------------------------------
  //  «Забегаем вперёд»: в примере темы встретился приём из более поздней темы — под кодом одна
  //  строка, что он делает, и где о нём подробно. Каждый приём — один раз на странице (первое
  //  появление), чтобы не шуметь. Порядок тем — как в маршруте (после struct — указатели): его
  //  задаёт extension/lib/course.js, а окно видит его как порядок группы «Справочник по темам».
  // ---------------------------------------------------------------------------
  var AHEAD = [
    [/std::format\b/, "std::format", "собирает строку по шаблону: `{}` заменяется значением, `{:.2f}` — число с двумя знаками", 2],
    [/std::getline\b|std::istringstream\b/, "std::getline / istringstream", "читают строку целиком и разбирают её на слова", 2],
    [/\b(for|while)\s*\(/, "цикл for / while", "повторяет блок кода, пока условие верно", 3],
    [/\bswitch\s*\(/, "switch", "выбирает ветку по значению — как цепочка if, но короче", 3],
    [/\benum\s+class\b/, "enum class", "свой тип с именованными вариантами вместо «магических» чисел", 3],
    [/^[A-Za-z_][\w:<>]*\s+[A-Za-z_]\w*\s*\([^;]*\)\s*\{/m, "своя функция", "именованный кусок кода, который можно вызывать много раз", 4],
    [/\bconst\s+[\w:<>]+\s*&/, "const &", "передать значение в функцию без копии и без права его менять", 4],
    [/\[[^\]\n]*\]\s*\([^)\n]*\)\s*(?:->\s*[\w:<>]+\s*)?\{/, "лямбда [](…) { … }", "маленькая функция прямо на месте — например, правило сортировки", 4],
    [/std::optional\b/, "std::optional", "«значение или ничего» — когда ответа может не быть", 4],
    [/std::vector\b/, "std::vector", "список значений, который сам растёт: `push_back` добавляет, `v[i]` — элемент", 6],
    [/std::(?:unordered_)?map\b/, "std::map", "словарь «ключ → значение», например «предмет → сколько штук»", 6],
    [/std::set\b/, "std::set", "набор без повторов: одинаковое второй раз не добавится", 6],
    [/std::pair\b|\bauto\s*&?\s*\[/, "pair и auto [a, b]", "две вещи вместе и способ разложить их на две переменные", 6],
    [/\.begin\(\)|\.end\(\)/, "begin() / end()", "начало и конец контейнера — их передают алгоритмам", 7],
    [/std::(?:stable_sort|sort|count_if|max_element|min_element|find_if|accumulate|transform)\b/, "алгоритмы std::sort, count_if, max_element…", "готовые «сортируй», «посчитай», «найди максимум» — без ручного цикла", 7],
    [/\bstruct\s+[A-Za-z_]\w*\s*\{/, "struct", "свой тип из нескольких полей: имя, HP, золото — одним значением", 8],
    [/std::(?:ifstream|ofstream|fstream)\b/, "файлы ifstream / ofstream", "читать из файла и писать в файл так же, как в консоль", 8],
    [/std::(?:mt19937|uniform_int_distribution|random_device)\b/, "случайные числа <random>", "генератор и «кубик» с нужным диапазоном", 8],
    [/\bnullptr\b|\bnew\s+[A-Za-z_]/, "указатели", "адрес объекта в памяти; `nullptr` — «никуда не указывает»", 22],
    [/(?<!enum\s{1,4})\bclass\s+[A-Za-z_]\w*\s*[{:]/, "class", "тип с закрытыми полями: менять их можно только его методами", 13],
    [/\btry\s*\{|\bcatch\s*\(|\bthrow\b/, "try / catch", "поймать ошибку, которую бросила функция, и не упасть", 14],
    [/std::string_view\b/, "std::string_view", "взгляд на строку без её копии", 15],
    [/std::(?:ranges|views)::/, "ranges", "алгоритмы без begin()/end() и цепочки обработки", 16],
    [/\btemplate\s*</, "template", "одна функция или тип сразу для многих типов", 17],
    [/std::move\b/, "std::move", "отдать объект, а не копировать его", 23],
    [/std::(?:unique_ptr|make_unique|shared_ptr|make_shared)\b/, "умные указатели", "объект в куче, который удалится сам", 18],
    [/\bvirtual\b|\boverride\b/, "virtual / override", "один вызов — разное поведение у разных наследников", 20],
    [/\bconstexpr\b|\bconsteval\b|\bstatic_assert\b/, "constexpr", "посчитать значение ещё при сборке программы", 25],
    [/std::(?:variant|visit)\b/, "std::variant", "«одно из нескольких» и разбор всех вариантов", 26],
    [/std::(?:thread|jthread|mutex|atomic|async)\b/, "потоки", "несколько дел одновременно", 27],
  ];
  var REF_GROUP = "Справочник по темам";
  // Место темы в курсе = её место в группе «Справочник по темам» (данные уже в порядке курса).
  function courseTopics() { var d = DATA(); return d ? d.files.filter(function (f) { return f.group === REF_GROUP; }) : []; }
  function courseRank(rel) {
    var list = courseTopics(), r = String(rel || "").toLowerCase();
    for (var i = 0; i < list.length; i++) if (list[i].rel.toLowerCase() === r) return i;
    return -1;
  }
  function topicFileByNum(n) {
    var d = DATA(); if (!d) return null;
    for (var i = 0; i < d.files.length; i++) if (/^ref\//i.test(d.files[i].rel) && topicNum(d.files[i].rel) === n) return d.files[i];
    return null;
  }
  // Что в этом коде из более поздних тем (без повторов из seen).
  function aheadNotes(code, rel, seen) {
    var r = courseRank(rel); if (r < 0) return [];
    // в комментариях не ищем; строка с main — каркас любой программы, не «своя функция»
    var out = [], src = String(code || "").replace(/\/\/[^\n]*/g, "").replace(/^.*\bmain\s*\(.*$/gm, "");
    AHEAD.forEach(function (a) {
      if (seen && seen[a[1]]) return;
      var f = topicFileByNum(a[3]); if (!f) return;
      if (courseRank(f.rel) <= r || !a[0].test(src)) return;
      if (seen) seen[a[1]] = true;
      out.push({ name: a[1], what: a[2], n: a[3], f: f });
    });
    return out;
  }
  function aheadHtml(list, rel) {
    if (!list.length) return "";
    var dir = String(rel).replace(/[^/]*$/, "");
    return '<div class="cd-ahead"><div class="cd-ahead-h"><span class="cd-ahead-ic" aria-hidden="true">»</span>Забегаем вперёд — можно пока не вникать</div><ul>' +
      list.map(function (x) {
        var href = x.f.rel.indexOf(dir) === 0 ? x.f.rel.slice(dir.length) : "../" + x.f.rel;
        return "<li><code>" + escapeHtml(x.name) + "</code> — " + inline(x.what) + ". Подробно — в " +
          '<a href="' + escapeHtml(href) + '">теме ' + x.n + " «" + escapeHtml(shortTitle(x.f)) + "»</a>.</li>";
      }).join("") + "</ul></div>";
  }
  // После рендера статьи: подписать каждый блок кода (и каждый слайд применений) по порядку страницы.
  function annotateAhead(root, rel) {
    if (!root || courseRank(rel) < 0) return;
    var seen = {};
    root.querySelectorAll(".codewrap").forEach(function (w) {
      if (w.closest(".cd-ch, .cd-rep, .cd-cp, .cd-guide")) return;   // задания и эталоны — не трогаем
      var targets = w.classList.contains("cd-alts") ? w.querySelectorAll(".cd-alt-pane") : [w];
      for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        var code = t.getAttribute("data-code");
        if (code == null) { var cb = t.querySelector(".copybtn"); code = cb ? cb.getAttribute("data-code") : ""; }
        var html = aheadHtml(aheadNotes(code, rel, seen), rel);
        if (!html) continue;
        var box = document.createElement("div");
        setHTML(box, html);
        if (box.firstChild) t.appendChild(box.firstChild);
      }
    });
  }
  // ==== runtime/13-games.js — игровые блоки: карта квестов, симулятор лута, волна поиска пути ====

  // ---- ```quests : «Путь героя» — все квесты «Подземелья» с прогрессом ----
  // Квест = «## Квест N. Название» в proekt/NN-glava-*.md; пройден, когда отмечены ВСЕ пункты его
  // ```checklist (ключи пунктов — те же cdHash, что у renderChecklist). Тело блока не нужно.
  function questChecklistItems(src) {
    var items = [];
    String(src).split("\n").forEach(function (ln) {
      var t = ln.replace(/\s+$/, "");
      var mi = t.match(/^\s*[-*]\s+(.*)$/);
      if (mi) items.push(mi[1]);
    });
    return items;
  }
  function collectQuests() {
    var d = DATA(); if (!d) return null;
    var files = d.files.filter(function (f) { return /^proekt\/\d\d-glava/i.test(f.rel); })
      .sort(function (a, b) { return a.rel < b.rel ? -1 : 1; });
    if (!files.length) return null;
    var chapters = [], loading = false;
    files.forEach(function (f) {
      if (!f.md) { loading = true; return; }
      var lines = String(f.md).replace(/\r\n?/g, "\n").split("\n");
      var ch = { rel: f.rel, title: String(f.title || f.name).replace(/^Подземелье\s*·\s*/, ""), quests: [] };
      var q = null, fence = null, buf = [];
      lines.forEach(function (ln) {
        var fm = ln.match(/^```\s*([A-Za-z]*)/);
        if (fm) {
          if (fence === null) { fence = fm[1].toLowerCase(); buf = []; return; }
          if (fence === "checklist" && q) q.items = q.items.concat(questChecklistItems(buf.join("\n")));
          fence = null; return;
        }
        if (fence !== null) { buf.push(ln); return; }
        var hm = ln.match(/^##\s+(Квест\s+(\d+)\.\s*(.+?))\s*$/);
        if (hm) { q = { n: +hm[2], title: hm[3], slug: slugify(hm[1]), items: [] }; ch.quests.push(q); }
        else if (/^##\s/.test(ln)) q = null;
      });
      chapters.push(ch);
    });
    return { chapters: chapters, loading: loading };
  }
  function renderQuestMap() {
    var qd = collectQuests();
    if (!qd) return '<div class="cd-qmap cd-qmap-empty">Квесты «Подземелья» не найдены.</div>';
    if (qd.loading) return '<div class="cd-qmap cd-qmap-empty">Путь героя загружается…</div>';
    var total = 0, done = 0, next = null, chHtml = "";
    qd.chapters.forEach(function (ch) {
      var chDone = 0, nodes = "";
      ch.quests.forEach(function (q) {
        var have = q.items.filter(function (it) { return !!state.checks[cdHash(it)]; }).length;
        var st = q.items.length && have === q.items.length ? "done" : (have ? "part" : "todo");
        total++; if (st === "done") { done++; chDone++; } else if (!next) { next = { q: q, ch: ch }; st += " next"; }
        var href = "../" + ch.rel + "#" + q.slug;
        var pct = q.items.length ? Math.round(have / q.items.length * 100) : 0;
        nodes += '<a class="cd-qm-node ' + st + '" href="' + escapeHtml(href) + '" style="--qp:' + pct + '" title="Квест ' + q.n + ". " +
          escapeHtml(q.title) + (st.indexOf("done") === 0 ? " — пройден" : q.items.length ? " — отмечено " + have + " из " + q.items.length : "") + '">' +
          '<span class="cd-qm-dot">' + (st.indexOf("done") === 0 ? "✓" : q.n) + '</span><span class="cd-qm-nm">' + escapeHtml(q.title) + "</span></a>";
      });
      chHtml += '<div class="cd-qm-ch"><div class="cd-qm-chn">' + escapeHtml(ch.title) +
        '<span class="cd-qm-chc">' + chDone + " / " + ch.quests.length + "</span></div>" +
        '<div class="cd-qm-path">' + nodes + "</div></div>";
    });
    var pct = total ? Math.round(done / total * 100) : 0;
    var nextHtml = next
      ? '<a class="cd-qm-next" href="' + escapeHtml("../" + next.ch.rel + "#" + next.q.slug) + '">Следующий: <b>Квест ' + next.q.n + " · " + escapeHtml(next.q.title) + "</b> →</a>"
      : '<div class="cd-qm-next win">🏆 Все квесты пройдены — игра ваша. Дальше — бонус-квесты ниже.</div>';
    return '<div class="cd-qmap"><div class="cd-qm-head"><div class="cd-qm-ttl">🗺️ Путь героя</div>' +
      '<div class="cd-qm-sum">пройдено <b>' + done + "</b> из " + total + " · " + pct + "%</div></div>" +
      '<div class="cd-qm-bar"><i style="width:' + pct + '%"></i></div>' + chHtml + nextHtml +
      '<div class="cd-qm-note">Квест засчитывается, когда отмечены все пункты его чек-листа «готово, если».</div></div>';
  }

  // ---- ```lootsim : сундуки с весами. Строки «Имя = вес», необязательно «@pity N» ----
  function renderLootSim(src) {
    var rows = [], pity = 0;
    String(src).replace(/\r\n?/g, "\n").split("\n").forEach(function (ln) {
      var pm = ln.match(/^\s*@pity\s+(\d+)\s*$/i); if (pm) { pity = Math.min(200, +pm[1]); return; }
      var m = ln.match(/^\s*(.+?)\s*=\s*(\d+(?:\.\d+)?)\s*$/);
      if (m && rows.length < 6 && +m[2] > 0) rows.push({ name: m[1], w: +m[2] });
    });
    if (rows.length < 2) return "";
    var sum = rows.reduce(function (a, r) { return a + r.w; }, 0);
    var list = rows.map(function (r, i) {
      var p = Math.round(r.w / sum * 1000) / 10;
      return '<div class="cd-ls-row r' + i + '"><span class="cd-ls-nm">' + escapeHtml(r.name) + '</span>' +
        '<span class="cd-ls-want">шанс ' + p + '%</span>' +
        '<span class="cd-ls-bar"><i class="cd-ls-exp" style="left:' + p + '%"></i><b style="width:0%"></b></span>' +
        '<span class="cd-ls-got">—</span></div>';
    }).join("");
    return '<div class="cd-lootsim" data-rows="' + encodeURIComponent(JSON.stringify(rows)) + '" data-pity="' + pity + '">' +
      '<div class="cd-ls-head">🎁 Открой сундуки — посмотри, как веса работают на деле</div>' + list +
      '<div class="cd-ls-trail" aria-label="Последние сундуки"></div>' +
      '<div class="cd-ls-ctl"><button type="button" class="cd-ls-open" data-n="1">Открыть 1</button>' +
      '<button type="button" class="cd-ls-open" data-n="10">×10</button><button type="button" class="cd-ls-open" data-n="1000">×1000</button>' +
      (pity ? '<label class="cd-ls-pityl"><input type="checkbox" class="cd-ls-pity"> гарантия: «' + escapeHtml(rows[rows.length - 1].name) + "» не реже чем раз в " + pity + "</label>" : "") +
      '<button type="button" class="cd-ls-reset">Сброс</button></div>' +
      '<div class="cd-ls-stat">Пока ни одного сундука. Черта на полоске — заявленный шанс.</div></div>';
  }
  function lootSimClick(t) {
    var box = t.closest(".cd-lootsim"); if (!box) return false;
    var open = t.closest(".cd-ls-open"), reset = t.closest(".cd-ls-reset");
    if (!open && !reset) return false;
    var rows = []; try { rows = JSON.parse(decodeURIComponent(box.getAttribute("data-rows") || "")); } catch (e) { return true; }
    var pity = +box.getAttribute("data-pity") || 0, last = rows.length - 1;
    if (!box.__ls || reset) box.__ls = { cnt: rows.map(function () { return 0; }), total: 0, dry: 0, maxDry: 0, trail: [] };
    var S = box.__ls, sum = rows.reduce(function (a, r) { return a + r.w; }, 0);
    var pityOn = pity && box.querySelector(".cd-ls-pity") && box.querySelector(".cd-ls-pity").checked;
    var n = open ? +open.getAttribute("data-n") || 1 : 0;
    for (var k = 0; k < n; k++) {
      var pick;
      if (pityOn && S.dry >= pity - 1) pick = last;               // гарантия: давно не было — выдаём редчайшее
      else { var r = Math.random() * sum, i = 0; while (i < last && r >= rows[i].w) { r -= rows[i].w; i++; } pick = i; }
      S.cnt[pick]++; S.total++;
      if (pick === last) S.dry = 0; else { S.dry++; if (S.dry > S.maxDry) S.maxDry = S.dry; }
      S.trail.push(pick); if (S.trail.length > 24) S.trail.shift();
    }
    box.querySelectorAll(".cd-ls-row").forEach(function (row, i) {
      var share = S.total ? S.cnt[i] / S.total * 100 : 0;
      row.querySelector(".cd-ls-bar b").style.width = Math.min(100, share) + "%";
      row.querySelector(".cd-ls-got").textContent = S.total ? S.cnt[i] + " · " + (Math.round(share * 10) / 10) + "%" : "—";
    });
    setHTML(box.querySelector(".cd-ls-trail"), S.trail.map(function (p) { return '<i class="r' + p + '" title="' + escapeHtml(rows[p].name) + '"></i>'; }).join(""));
    box.querySelector(".cd-ls-stat").textContent = S.total
      ? "Открыто: " + S.total + " · последний: " + rows[S.trail[S.trail.length - 1]].name + " · без «" + rows[last].name + "» подряд сейчас " + S.dry +
        ", самая длинная серия " + S.maxDry + (S.total < 100 ? ". Открой ×1000 — доли подтянутся к заявленным." : ".")
      : "Пока ни одного сундука. Черта на полоске — заявленный шанс.";
    return true;
  }

  // ---- ```bfsgrid : карта (# стена, . пол, S игрок, E враг). Клик — стена/пол, волна считается заново ----
  function bfsParse(src) {
    var rows = String(src).replace(/\r\n?/g, "\n").split("\n").map(function (l) { return l.replace(/\s+$/, ""); })
      .filter(function (l) { return l.length && !/^\s*#\s/.test(l); }).slice(0, 16);
    var w = rows.reduce(function (a, r) { return Math.max(a, r.length); }, 0);
    if (!w || w > 30 || rows.length < 2) return null;
    return rows.map(function (r) { var o = []; for (var x = 0; x < w; x++) { var c = r.charAt(x) || "#"; o.push(/[#.SE]/.test(c) ? c : "."); } return o; });
  }
  function bfsDist(g) {
    var h = g.length, w = g[0].length, dist = [], sx = -1, sy = -1, ex = -1, ey = -1, x, y;
    for (y = 0; y < h; y++) { dist.push([]); for (x = 0; x < w; x++) { dist[y].push(-1); if (g[y][x] === "S") { sx = x; sy = y; } if (g[y][x] === "E") { ex = x; ey = y; } } }
    if (sx < 0) return { dist: dist, path: {}, max: 0, reach: -1 };
    var q = [[sx, sy]], head = 0, max = 0; dist[sy][sx] = 0;
    var D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < q.length) {
      var c = q[head++];
      D.forEach(function (d) {
        var nx = c[0] + d[0], ny = c[1] + d[1];
        if (ny < 0 || ny >= h || nx < 0 || nx >= w || g[ny][nx] === "#" || dist[ny][nx] >= 0) return;
        dist[ny][nx] = dist[c[1]][c[0]] + 1; if (dist[ny][nx] > max) max = dist[ny][nx];
        q.push([nx, ny]);
      });
    }
    var path = {}, reach = ex >= 0 ? dist[ey][ex] : -1;
    if (reach > 0) {                     // от врага — к клетке, где волна на 1 меньше: так враг и идёт к игроку
      var cx = ex, cy = ey;
      while (dist[cy][cx] > 0) {
        path[cx + "," + cy] = 1;
        for (var i = 0; i < 4; i++) {
          var px = cx + D[i][0], py = cy + D[i][1];
          if (py >= 0 && py < h && px >= 0 && px < w && dist[py][px] === dist[cy][cx] - 1) { cx = px; cy = py; break; }
        }
      }
    }
    return { dist: dist, path: path, max: max, reach: reach };
  }
  function bfsGridHtml(g, limit) {
    var r = bfsDist(g), html = "";
    g.forEach(function (row, y) {
      row.forEach(function (c, x) {
        var d = r.dist[y][x], show = d >= 0 && (limit == null || d <= limit);
        var cls = c === "#" ? "wall" : c === "S" ? "start" : c === "E" ? "enemy" : "floor";
        if (show && r.path[x + "," + y] && (limit == null || limit >= r.reach)) cls += " path";
        var tone = show && r.max ? Math.round(d / r.max * 100) : 0;
        var label = c === "S" ? "@" : c === "E" ? "E" : c === "#" ? "" : (show ? String(d) : "");
        html += '<button type="button" class="cd-bfs-c ' + cls + (show ? " on" : "") + '" data-x="' + x + '" data-y="' + y + '" style="--t:' + tone + '"' +
          (c === "#" || c === "." ? ' title="Клик — ' + (c === "#" ? "убрать стену" : "поставить стену") + '"' : "") + ">" + label + "</button>";
      });
    });
    var status = r.reach > 0 ? "Враг дойдёт до героя за <b>" + r.reach + "</b> " + plural(r.reach, ["шаг", "шага", "шагов"]) + " — путь подсвечен."
      : r.reach === 0 ? "Враг уже рядом." : "Стены перекрыли дорогу — волна не дошла до врага, ему некуда идти.";
    return { grid: html, status: status, cols: g[0].length, max: r.max };
  }
  function renderBfsGrid(src) {
    var g = bfsParse(src); if (!g) return "";
    var v = bfsGridHtml(g);
    return '<div class="cd-bfs" data-map="' + encodeURIComponent(g.map(function (r) { return r.join(""); }).join("\n")) + '">' +
      '<div class="cd-bfs-head">🧭 Волна от героя: число в клетке — сколько шагов до неё. Кликай по клеткам — ставь и убирай стены.</div>' +
      '<div class="cd-bfs-grid" style="--cols:' + v.cols + '">' + v.grid + "</div>" +
      '<div class="cd-bfs-st">' + v.status + "</div>" +
      '<div class="cd-bfs-ctl"><button type="button" class="cd-bfs-play">▶ Волна по шагам</button><button type="button" class="cd-bfs-reset">Вернуть карту</button></div></div>';
  }
  function bfsRedraw(box, limit) {
    var v = bfsGridHtml(box.__g, limit);
    setHTML(box.querySelector(".cd-bfs-grid"), v.grid);
    setHTML(box.querySelector(".cd-bfs-st"), limit == null || limit >= v.max ? v.status : "Волна: шаг " + limit + "…");
    return v;
  }
  function bfsClick(t) {
    var box = t.closest(".cd-bfs"); if (!box) return false;
    if (!box.__g || t.closest(".cd-bfs-reset")) {
      box.__g = bfsParse(decodeURIComponent(box.getAttribute("data-map") || ""));
      if (!box.__g) return true;
    }
    clearTimeout(box.__timer);
    var cell = t.closest(".cd-bfs-c");
    if (cell) {
      var x = +cell.getAttribute("data-x"), y = +cell.getAttribute("data-y"), c = box.__g[y] && box.__g[y][x];
      if (c === "#" || c === ".") box.__g[y][x] = c === "#" ? "." : "#";
      bfsRedraw(box); return true;
    }
    if (t.closest(".cd-bfs-play")) {
      var v = bfsRedraw(box, 0), k = 0;
      if (state.noAnim || prefersReducedMotion()) { bfsRedraw(box); return true; }
      var tick = function () { k++; bfsRedraw(box, k); if (k < v.max) box.__timer = setTimeout(tick, 170); };
      box.__timer = setTimeout(tick, 170);
      return true;
    }
    if (t.closest(".cd-bfs-reset")) { bfsRedraw(box); return true; }
    return false;
  }
  // Клики по игровым блокам (зовёт onArticleClick).
  function gamesClick(e) {
    var t = e.target; if (!t || !t.closest) return false;
    return lootSimClick(t) || bfsClick(t);
  }
  // ==== runtime/13-interactive.js — обработка кликов интерактивных блоков, поиск по тексту, клавиатура ====
  // ------- опросник / «найди ошибку» (общая обработка для читалки и сплита) -------
  function quizMarkAnswered(q, ok) {
    var first = !q.hasAttribute("data-answered");
    q.setAttribute("data-answered", "1");
    if (first) { q.setAttribute("data-first", ok ? "1" : "0"); examProgress(q); if (!ok) missQuiz(q); }
    var opts = q.querySelectorAll(".cd-quiz-opt");
    for (var i = 0; i < opts.length; i++)
      if (opts[i].getAttribute("data-ok") === "1") opts[i].classList.add("right");
    var ex = q.querySelector(".cd-quiz-expl"); if (ex) ex.hidden = false;
    var rv = q.querySelector(".cd-quiz-reveal"); if (rv) rv.style.display = "none";
  }
  function quizPick(opt) {
    var q = opt.closest && opt.closest(".cd-quiz-q"); if (!q) return;
    opt.classList.add(opt.getAttribute("data-ok") === "1" ? "right" : "wrong", "picked");
    quizMarkAnswered(q, opt.getAttribute("data-ok") === "1");
  }
  // Итоговая проверка: когда отвечены все вопросы — итог, зачёт и запись результата.
  function examProgress(q) {
    var box = q.closest && q.closest(".cd-exam"); if (!box) return;
    var qs = box.querySelectorAll(".cd-quiz-q"), answered = 0, right = 0;
    for (var i = 0; i < qs.length; i++) {
      if (qs[i].hasAttribute("data-first")) answered++;
      if (qs[i].getAttribute("data-first") === "1") right++;
    }
    if (answered < qs.length) return;
    var total = qs.length, passed = right >= Math.ceil(total * EXAM_PASS);
    var id = box.getAttribute("data-exam"), prev = state.exams[id] || {};
    state.exams[id] = {
      best: Math.max(prev.best || 0, right), total: total, passed: !!(prev.passed || passed),
      topics: parseTopics(box.getAttribute("data-topics"))
    };
    saveState(); try { recordActivity(); } catch (e) {}
    var res = box.querySelector(".cd-exam-res");
    if (res) {
      res.hidden = false;
      res.className = "cd-exam-res " + (passed ? "ok" : "no");
      setHTML(res, (passed
        ? "<b>Зачтено: " + right + " из " + total + ".</b> Этап отмечен на дорожке курса на главной."
        : "<b>Пока " + right + " из " + total + "</b> — для зачёта нужно " + Math.ceil(total * EXAM_PASS) + ". Перечитай разделы по вопросам с ошибками и пройди ещё раз.") +
        ' <button class="cd-exam-again" type="button">Пройти заново</button>');
    }
    if (passed) { try { celebrate(res || box); } catch (e) {} }
  }
  function examReset(btn) {
    var box = btn.closest(".cd-exam"); if (!box) return;
    box.querySelectorAll(".cd-quiz-q").forEach(function (q) {
      q.removeAttribute("data-answered"); q.removeAttribute("data-first");
      q.querySelectorAll(".cd-quiz-opt").forEach(function (o) { o.classList.remove("right", "wrong", "picked"); });
      var ex = q.querySelector(".cd-quiz-expl"); if (ex) ex.hidden = true;
      var rv = q.querySelector(".cd-quiz-reveal"); if (rv) rv.style.display = "";
    });
    var res = box.querySelector(".cd-exam-res"); if (res) { res.hidden = true; setHTML(res, ""); }
    box.scrollIntoView({ block: "start" });
  }
  // Темы, по которым сдана итоговая проверка (для дорожки курса).
  function examPassedTopics() {
    var out = {};
    Object.keys(state.exams).forEach(function (k) {
      var r = state.exams[k];
      if (r && r.passed && Array.isArray(r.topics)) r.topics.forEach(function (n) { out[n] = true; });
    });
    return out;
  }
  function fbReveal(btn) {
    var box = btn.closest && btn.closest(".cd-fb"); if (!box) return;
    var ans = box.querySelector(".cd-fb-ans"); if (ans) ans.hidden = false;
    btn.style.display = "none";
  }
  // ---- колода карточек ----
  function deckActive(dk) {
    return Array.prototype.slice.call(dk.querySelectorAll(".cd-dcard")).filter(function (c) { return !c.hasAttribute("data-skip"); });
  }
  function deckGo(dk, pos) {
    var list = deckActive(dk); if (!list.length) return;
    pos = Math.max(0, Math.min(list.length - 1, pos));
    dk.querySelectorAll(".cd-dcard.cur").forEach(function (c) { c.classList.remove("cur"); });
    var card = list[pos]; card.classList.add("cur");
    var id = card.getAttribute("data-i");
    dk.querySelectorAll(".cd-dk-dot").forEach(function (d) { d.classList.toggle("cur", d.getAttribute("data-i") === id); });
    dk.setAttribute("data-pos", String(pos));
    var ps = dk.querySelector(".cd-dk-pos"); if (ps) ps.textContent = (pos + 1) + " из " + list.length;
    var pv = dk.querySelector(".cd-dk-prev"), nx = dk.querySelector(".cd-dk-next");
    if (pv) pv.disabled = pos === 0;
    if (nx) nx.disabled = pos === list.length - 1;
  }
  // Тонкая полоска под точками: сколько карточек этого прохода уже оценено.
  function deckProgress(dk) {
    var list = deckActive(dk), rated = list.filter(function (c) { return c.hasAttribute("data-g"); }).length;
    var bar = dk.querySelector(".cd-dk-prog i"); if (bar) bar.style.width = (list.length ? Math.round(rated / list.length * 100) : 0) + "%";
  }
  function deckShow(dk, on) {   // колода ↔ итог
    ["cd-dk-dots", "cd-dk-prog", "cd-dk-stage", "cd-dk-nav"].forEach(function (c) { var n = dk.querySelector("." + c); if (n) n.hidden = !on; });
    var sum = dk.querySelector(".cd-dk-sum"); if (sum) sum.hidden = on;
  }
  function deckRate(btn) {
    var card = btn.closest(".cd-dcard"), dk = btn.closest(".cd-deck"); if (!card || !dk) return;
    var g = parseInt(btn.getAttribute("data-g"), 10) || 0;
    var ivl = cdSchedule(card.getAttribute("data-id"), g);
    card.setAttribute("data-g", String(g));
    var badge = card.querySelector(".cd-dc-due");
    if (badge) { badge.className = "cd-dc-due lat"; badge.textContent = "повтор " + ivlLabel(ivl); }
    var dot = dk.querySelector('.cd-dk-dot[data-i="' + card.getAttribute("data-i") + '"]');
    if (dot) { dot.classList.remove("g0", "g1", "g2", "st-due", "st-new", "st-later"); dot.classList.add("g" + g); }
    try { recordActivity(); } catch (e) {}
    deckProgress(dk);
    if (g === 2) pulse(dot || btn);
    setTimeout(function () {
      var list = deckActive(dk), pos = list.indexOf(card), next = -1;
      for (var k = 1; k <= list.length && next < 0; k++) { var c = list[(pos + k) % list.length]; if (!c.hasAttribute("data-g")) next = (pos + k) % list.length; }
      if (next < 0) { deckSummary(dk); return; }
      card.classList.remove("flipped");
      deckGo(dk, next);
    }, 420);
  }
  function deckSummary(dk) {
    var list = deckActive(dk), cnt = [0, 0, 0];
    list.forEach(function (c) { cnt[+c.getAttribute("data-g") || 0]++; });
    var weak = cnt[0] + cnt[1], sum = dk.querySelector(".cd-dk-sum");
    setHTML(sum, '<div class="cd-dk-sum-t">' + (weak ? "Колода пройдена" : "Всё помнишь — отлично!") + "</div>" +
      '<div class="cd-dk-sum-row"><span class="g2"><b>' + cnt[2] + '</b>помню</span><span class="g1"><b>' + cnt[1] + "</b>трудно</span>" +
      '<span class="g0"><b>' + cnt[0] + "</b>не помню</span></div>" +
      '<div class="cd-dk-sum-s">Интервалы назначены — карточки сами вернутся в «Разминку», когда придёт время.</div>' +
      '<div class="cd-dk-sum-ctl">' + (weak ? '<button class="cd-dk-again" type="button">Ещё раз трудные (' + weak + ")</button>" : "") +
      '<button class="cd-dk-restart" type="button">Пройти заново</button></div>');
    deckShow(dk, false);
    if (!weak) celebrate(sum.querySelector(".cd-dk-sum-t"));
  }
  function deckRestart(dk, onlyWeak) {
    dk.querySelectorAll(".cd-dcard").forEach(function (c) {
      var g = c.getAttribute("data-g");
      if (onlyWeak && (g === "2" || c.hasAttribute("data-skip"))) c.setAttribute("data-skip", "");
      else c.removeAttribute("data-skip");
      if (!c.hasAttribute("data-skip")) c.removeAttribute("data-g");
      c.classList.remove("flipped");
    });
    dk.querySelectorAll(".cd-dk-dot").forEach(function (d) {
      var c = dk.querySelector('.cd-dcard[data-i="' + d.getAttribute("data-i") + '"]');
      d.classList.toggle("skip", !!(c && c.hasAttribute("data-skip")));
      if (c && !c.hasAttribute("data-skip")) d.classList.remove("g0", "g1", "g2");
    });
    deckShow(dk, true);
    deckProgress(dk);
    deckGo(dk, 0);
  }
  function deckShuffle(dk) {
    var stage = dk.querySelector(".cd-dk-stage"), dotsEl = dk.querySelector(".cd-dk-dots");
    var cards = Array.prototype.slice.call(stage.querySelectorAll(".cd-dcard"));
    for (var i = cards.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = cards[i]; cards[i] = cards[j]; cards[j] = t; }
    cards.forEach(function (c) {
      c.classList.remove("flipped"); stage.appendChild(c);
      var d = dotsEl.querySelector('.cd-dk-dot[data-i="' + c.getAttribute("data-i") + '"]'); if (d) dotsEl.appendChild(d);
    });
    deckGo(dk, 0);
  }
  // #8 Лицевая сторона карточки чуть наклоняется за курсором (глубина без лишнего шума).
  function deckTilt(e) {
    if (state.noAnim) return;
    var f = e.target.closest && e.target.closest(".cd-dcard.cur:not(.flipped) .cd-dc-front");
    if (deckTiltEl && deckTiltEl !== f) { deckTiltEl.style.removeProperty("--tx"); deckTiltEl.style.removeProperty("--ty"); }
    deckTiltEl = f || null;
    if (!f) return;
    var r = f.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    f.style.setProperty("--ty", (x * 7).toFixed(2) + "deg");
    f.style.setProperty("--tx", (-y * 5).toFixed(2) + "deg");
  }
  var deckTiltEl = null;
  // Все клики колоды; true — клик обработан.
  function deckClick(t) {
    var dk = t.closest && t.closest(".cd-deck"); if (!dk) return false;
    var card = t.closest(".cd-dcard");
    if (t.closest(".cd-dk-btn")) { deckRate(t.closest(".cd-dk-btn")); return true; }
    if (t.closest(".cd-dc-hintbtn")) { var h = card && card.querySelector(".cd-dc-hint"); if (h) h.hidden = false; t.closest(".cd-dc-hintbtn").hidden = true; return true; }
    if (t.closest(".cd-dc-unflip")) { if (card) card.classList.remove("flipped"); return true; }
    if (t.closest(".cd-dc-flip") || (card && t.closest(".cd-dc-front") && !t.closest("button, a"))) { if (card) card.classList.add("flipped"); return true; }
    if (t.closest(".cd-dk-dot")) {
      var id = t.closest(".cd-dk-dot").getAttribute("data-i");
      var list = deckActive(dk), idx = -1;
      list.forEach(function (c, k) { if (c.getAttribute("data-i") === id) idx = k; });
      if (idx >= 0) { deckShow(dk, true); deckGo(dk, idx); }
      return true;
    }
    var pos = +(dk.getAttribute("data-pos") || 0);
    if (t.closest(".cd-dk-prev")) { deckGo(dk, pos - 1); return true; }
    if (t.closest(".cd-dk-next")) { deckGo(dk, pos + 1); return true; }
    if (t.closest(".cd-dk-shuffle")) { deckShow(dk, true); deckShuffle(dk); return true; }
    if (t.closest(".cd-dk-again")) { deckRestart(dk, true); return true; }
    if (t.closest(".cd-dk-restart")) { deckRestart(dk, false); return true; }
    return false;
  }
  function fcCheck(btn) {
    var box = btn.closest(".cd-fc"); if (!box) return;
    var ins = box.querySelectorAll(".cd-fc-in"), ok = 0;
    for (var i = 0; i < ins.length; i++) {
      var good = ins[i].value.trim() === (ins[i].getAttribute("data-a") || "").trim();
      ins[i].classList.remove("right", "wrong"); ins[i].classList.add(good ? "right" : "wrong");
      if (good) ok++;
    }
    var msg = box.querySelector(".cd-fc-msg");
    if (msg) msg.textContent = ok === ins.length ? ("Верно, все " + ins.length + "!") : (ok + " из " + ins.length + " — красное поправь");
    if (ok < ins.length) missFill(box);
  }
  function fcReveal(btn) {
    var box = btn.closest(".cd-fc"); if (!box) return;
    missFill(box);
    var ins = box.querySelectorAll(".cd-fc-in");
    for (var i = 0; i < ins.length; i++) { ins[i].value = ins[i].getAttribute("data-a") || ""; ins[i].classList.remove("wrong"); ins[i].classList.add("right"); }
    var msg = box.querySelector(".cd-fc-msg"); if (msg) msg.textContent = "Ответ показан.";
  }
  function testsCopy(btn) {
    var text = btn.getAttribute("data-in") || "";
    function ok() { var p = btn.textContent; btn.textContent = "скопировано"; btn.classList.add("done"); setTimeout(function () { btn.textContent = p; btn.classList.remove("done"); }, 1200); }
    try { navigator.clipboard.writeText(text).then(ok, function () { legacyCopy(text); ok(); }); }
    catch (e) { legacyCopy(text); ok(); }
  }
  // Делегат input-событий статьи: пока только слайдеры «живого примера» (```live).
  function onArticleInput(e) {
    var sl = e.target && e.target.closest && e.target.closest(".cd-live-sl");
    if (sl) { var box = sl.closest(".cd-live"); if (box) liveRecalc(box); }
  }
  function quizClick(e) {
    var t = e.target;
    if (!t || !t.closest) return false;
    var qopt = t.closest(".cd-quiz-opt");
    if (qopt) { e.preventDefault(); quizPick(qopt); return true; }
    var qrev = t.closest(".cd-quiz-reveal");
    if (qrev) { e.preventDefault(); var q = qrev.closest(".cd-quiz-q"); if (q) quizMarkAnswered(q, false); return true; }
    var exAgain = t.closest(".cd-exam-again");
    if (exAgain) { e.preventDefault(); examReset(exAgain); return true; }
    if (bossClick(t)) { e.preventDefault(); return true; }
    if (repeatClick(t, e) || checkpointClick(t)) { e.preventDefault(); return true; }
    var altB = t.closest(".cd-alt-go, .cd-alt-tab");
    if (altB) { e.preventDefault(); altGo(altB); return true; }
    var stb = t.closest(".cd-st-btn");
    if (stb) { e.preventDefault(); stepsClick(stb); return true; }
    if (memClick(t)) { e.preventDefault(); return true; }
    if (framesClick(t)) { e.preventDefault(); return true; }
    var fbrev = t.closest(".cd-fb-reveal");
    if (fbrev) { e.preventDefault(); fbReveal(fbrev); return true; }
    if (deckClick(t)) { e.preventDefault(); return true; }
    var fchk = t.closest(".cd-fc-check");
    if (fchk) { e.preventDefault(); fcCheck(fchk); return true; }
    var frev = t.closest(".cd-fc-reveal");
    if (frev) { e.preventDefault(); fcReveal(frev); return true; }
    var tcopy = t.closest(".cd-tests-copy");
    if (tcopy) { e.preventDefault(); testsCopy(tcopy); return true; }
    var chk = t.closest(".cd-check-item");
    if (chk) { e.preventDefault(); checkToggle(chk); return true; }
    var chItem = t.closest(".cd-ch-item");
    if (chItem) { e.preventDefault(); parsonsPick(chItem); return true; }
    var chCheck = t.closest(".cd-ch-check");
    if (chCheck) { e.preventDefault(); parsonsCheck(chCheck); return true; }
    var chReset = t.closest(".cd-ch-reset");
    if (chReset) { e.preventDefault(); parsonsReset(chReset); return true; }
    var solA = t.closest('a[href="#решения-с-разбором"],a[href="#ответы-с-разбором"]');
    if (solA) {
      var tcard = solA.closest(".cd-taskcard"), th2 = tcard && tcard.querySelector("h2.cd-task");
      var tn = th2 && ((th2.textContent || "").match(/^\s*(\d+\.\d+)/) || [])[1];
      if (tn && openSolution(tn)) { e.preventDefault(); return true; }
    }
    var solBack = t.closest(".cd-sol-back");
    if (solBack) { e.preventDefault(); gotoTask(solBack.getAttribute("data-num")); return true; }
    var lNext = t.closest(".cd-ladder-next");
    if (lNext) { e.preventDefault(); ladderNext(lNext); return true; }
    var hNext = t.closest(".cd-hint-next");
    if (hNext) { e.preventDefault(); hintNext(hNext); return true; }
    var sShow = t.closest(".cd-sol-show");
    if (sShow) { e.preventDefault(); solutionShow(sShow); return true; }
    var prCheck = t.closest(".cd-pr-check");
    if (prCheck) { e.preventDefault(); predictCheck(prCheck); return true; }
    var prReveal = t.closest(".cd-pr-reveal");
    if (prReveal) { e.preventDefault(); predictReveal(prReveal); return true; }
    var runGo = t.closest(".cd-run-go");
    if (runGo) { e.preventDefault(); runChallengeRun(runGo); return true; }
    return false;
  }
  // Отметить ката решённой (прогресс переживает перезапуск; день идёт в «серию»).
  function challengeSolved(box) {
    var id = box.getAttribute("data-id");
    if (id && !state.challenge[id]) { state.challenge[id] = true; try { noteSolvedFirst(box); } catch (e) {} saveState(); try { recordActivity(); } catch (e) {} }
    if (id && state.daily && state.daily.id === id && state.daily.date === cdDate(0) && !state.dailyDone[cdDate(0)]) {
      try { noteDailySolved(box); } catch (e) {}
      state.dailyDone[cdDate(0)] = 1; saveState();
      toast("Задача дня решена! Серия: " + dailyStreak());
    }
    box.classList.add("done");
    try { repeatSolved(box); } catch (e) {}
  }
  // Parsons: клик по строке перекладывает её между «банком» и «решением».
  function parsonsPick(li) {
    var box = li.closest(".cd-ch"); if (!box) return;
    var sol = box.querySelector(".cd-ch-sol"), bank = box.querySelector(".cd-ch-bank");
    li.classList.remove("right", "wrong");
    if (li.parentNode === bank) sol.appendChild(li); else bank.appendChild(li);
    var msg = box.querySelector(".cd-ch-msg"); if (msg) msg.textContent = "";
  }
  function parsonsReset(btn) {
    var box = btn.closest(".cd-ch"); if (!box) return;
    var sol = box.querySelector(".cd-ch-sol"), bank = box.querySelector(".cd-ch-bank");
    var items = [].slice.call(sol.querySelectorAll(".cd-ch-item"));
    items.forEach(function (li) { li.classList.remove("right", "wrong"); bank.appendChild(li); });
    var msg = box.querySelector(".cd-ch-msg"); if (msg) { msg.textContent = ""; msg.className = "cd-ch-msg"; }
  }
  function parsonsCheck(btn) {
    var box = btn.closest(".cd-ch"); if (!box) return;
    var sol = box.querySelector(".cd-ch-sol");
    var got = [].slice.call(sol.querySelectorAll(".cd-ch-item"));
    var want = []; try { want = JSON.parse(decodeURIComponent(box.getAttribute("data-sol") || "[]")); } catch (e) {}
    var msg = box.querySelector(".cd-ch-msg");
    if (!got.length) { if (msg) { msg.textContent = "Сначала собери программу из строк выше."; msg.className = "cd-ch-msg"; } return; }
    var okAll = got.length === want.length, firstBad = -1;
    for (var i = 0; i < got.length; i++) {
      var txt = decodeURIComponent(got[i].getAttribute("data-t") || "");
      var good = txt === want[i];
      got[i].classList.remove("right", "wrong"); got[i].classList.add(good ? "right" : "wrong");
      if (!good && firstBad < 0) firstBad = i + 1;
      if (!good) okAll = false;
    }
    if (okAll) { if (msg) { msg.textContent = "Верно! Программа собрана правильно."; msg.className = "cd-ch-msg ok"; } challengeSolved(box); }
    else if (got.length === want.length) { missParsons(box); noteAttempt(box, false); }   // собрал всё, но не в том порядке
    else if (msg) { msg.textContent = got.length !== want.length ? ("Нужно " + want.length + " " + plural(want.length, ["строка", "строки", "строк"]) + ", а стоит " + got.length + ".") : ("Строка " + firstBad + " не на месте — поправь порядок."); msg.className = "cd-ch-msg err"; }
  }
  // Predict: сверяем введённый вывод с эталоном (построчно, схлопнув лишние пробелы).
  function predictNorm(s) { return String(s).replace(/\r\n?/g, "\n").split("\n").map(function (l) { return l.trim().replace(/\s+/g, " "); }).join("\n").replace(/\n+$/g, ""); }
  function predictCheck(btn) {
    var box = btn.closest(".cd-ch"); if (!box) return;
    var inp = box.querySelector(".cd-pr-in"), msg = box.querySelector(".cd-ch-msg");
    var exp = decodeURIComponent(box.getAttribute("data-exp") || "");
    var good = predictNorm(inp.value) === predictNorm(exp) && inp.value.trim() !== "";
    inp.classList.remove("right", "wrong"); inp.classList.add(good ? "right" : "wrong");
    if (msg) {
      if (good) { msg.textContent = "Верно!"; msg.className = "cd-ch-msg ok"; challengeSolved(box); }
      else { msg.textContent = "Не совпало. Проследи код по шагам и попробуй снова."; msg.className = "cd-ch-msg err"; missPredict(box); noteAttempt(box, false); }
    }
  }
  function predictReveal(btn) {
    var box = btn.closest(".cd-ch"); if (!box) return;
    var inp = box.querySelector(".cd-pr-in"), msg = box.querySelector(".cd-ch-msg");
    var exp = decodeURIComponent(box.getAttribute("data-exp") || "");
    if (inp) { inp.value = exp; inp.classList.remove("wrong"); }
    if (msg) { msg.textContent = "Ответ показан."; msg.className = "cd-ch-msg"; }
    box.__revealed = true; noteHint(box);
    if (!box.classList.contains("done")) missPredict(box);
  }
  // «Напиши и запусти»: код и тесты — запросом к расширению (мост / вкладка / Moon Core), ответ — прогон.
  var _runSeq = 0;
  function runChallengeRun(btn) {
    var box = btn.closest(".cd-ch-run"); if (!box) return;
    var msg = box.querySelector(".cd-ch-msg"), out = box.querySelector(".cd-run-out");
    var ta = box.querySelector(".cd-run-code");
    if (!ta) return;
    var tests = []; try { tests = JSON.parse(decodeURIComponent(box.getAttribute("data-tests") || "[]")); } catch (e) {}
    var id = "r" + Date.now() + "-" + (++_runSeq), mode = box.getAttribute("data-mode") === "contains" ? "contains" : undefined;
    btn.disabled = true;
    if (msg) { msg.textContent = "Компилирую и запускаю…"; msg.className = "cd-ch-msg"; }
    if (out) { out.hidden = true; setHTML(out, ""); }
    setMood(box, "think");
    // Запрос с ответом сразу: у каждой задачи своё ожидание, соседняя его не отменит.
    rpc("run", { id: id, code: ta.value, tests: tests.slice(0, PROTO.MAX_TESTS), mode: mode }, PROTO.RUN_TIMEOUT_MS, function (res) {
      btn.disabled = false;
      if (res) { renderRunResult(box, res); try { noteRunResult(box, res); } catch (e) {} return; }
      setMood(box, "oops");
      if (msg) { msg.textContent = "Нет ответа от расширения. Проверь, что оно активно («Документация C++: проверить плавающее окно»)."; msg.className = "cd-ch-msg err"; }
    });
  }
  // Маскот рядом с результатом запуска: думает, пока идёт сборка; празднует пройденные тесты;
  // сочувствует ошибке. Нет наклейки — место пустое (без заглушек-эмодзи).
  var MOODS = { think: ["mascot-think"], win: ["mascot-win", "mascot-done"], oops: ["mascot-oops", "mascot-think"] };
  var MOOD_TIPS = { think: "Собираю и запускаю…", win: "Получилось!", oops: "Бывает — разберёмся" };
  function setMood(box, mood) {
    var slot = box.querySelector(".cd-mood");
    if (!slot) {
      var msg = box.querySelector(".cd-ch-msg");
      if (!msg || !msg.parentNode) return;
      slot = el("span"); slot.className = "cd-mood"; slot.setAttribute("aria-hidden", "true");
      msg.parentNode.insertBefore(slot, msg);
    }
    var uri = null, names = MOODS[mood] || [];
    for (var i = 0; i < names.length && !uri; i++) uri = STICKERS && STICKERS[names[i]];
    slot.className = "cd-mood m-" + mood;
    slot.title = MOOD_TIPS[mood] || "";
    setHTML(slot, uri ? html`<img src="${uri}" alt="" draggable="false">` : "");
    slot.hidden = !uri;
  }
  function renderRunResult(box, res) {
    var msg = box.querySelector(".cd-ch-msg"), out = box.querySelector(".cd-run-out");
    setMood(box, res.ok ? "win" : (res.stage === "run" && !(res.tests || []).length ? "win" : "oops"));
    if (res.stage === "disabled") { if (msg) { msg.textContent = "Запуск выключен: включи настройку cppDocs.localRun."; msg.className = "cd-ch-msg err"; } return; }
    if (res.stage === "busy") { if (msg) { msg.textContent = "Уже идёт несколько запусков — подожди секунду и нажми ещё раз."; msg.className = "cd-ch-msg err"; } return; }
    if (res.stage === "nocompiler") { if (msg) { msg.textContent = "Компилятор не найден. Укажи путь в настройке cppDocs.compiler (g++/clang++/cl)."; msg.className = "cd-ch-msg err"; } return; }
    if (res.stage === "io") { if (msg) { msg.textContent = "Не удалось запустить: " + (res.error || ""); msg.className = "cd-ch-msg err"; } return; }
    if (res.stage === "compile" || res.stage === "run" && !res.ok) {
      box.setAttribute("data-fails", String((+box.getAttribute("data-fails") || 0) + 1));
      syncSolution(box);
    }
    if (res.stage === "compile") {
      if (msg) { msg.textContent = "Ошибка компиляции:"; msg.className = "cd-ch-msg err"; }
      if (out) { out.hidden = false; setHTML(out, explainHtml(explainCompileError(res.compileError || "")) + '<pre class="cd-run-err"><code>' + escapeHtml(res.compileError || "") + "</code></pre>"); }
      return;
    }
    var tests = res.tests || [], passed = 0, rows = "";
    tests.forEach(function (t) {
      if (t.pass) passed++;
      if (t.skipped) {   // хост остановил прогон: программа зависла или кончилось время
        rows += '<div class="cd-run-t skip"><span class="cd-run-tmark">–</span><span class="cd-run-tin">вход: <code>' +
          testShow(t["in"] == null ? "∅" : t["in"]) + "</code> · не запускался</span></div>";
        return;
      }
      rows += '<div class="cd-run-t ' + (t.pass ? "ok" : "bad") + '"><span class="cd-run-tmark">' + (t.pass ? "✓" : "✗") + "</span>" +
        '<span class="cd-run-tin">вход: <code>' + testShow(t["in"] == null ? "∅" : t["in"]) + "</code></span>" +
        (t.pass ? "" : '<span class="cd-run-tgot">вывод <code>' + testShow(t.got == null ? "" : t.got) +
          '</code> · ждали <code>' + testShow(t.expected == null ? "" : t.expected) + "</code></span>") +
        // программа упала: причина простыми словами + начало stderr (там часто what() исключения)
        (t.crash ? '<span class="cd-run-tcrash">💥 Программа упала: ' + escapeHtml(String(t.crash)) +
          (t.stderr ? '<code>' + escapeHtml(String(t.stderr).slice(0, 300)) + "</code>" : "") + "</span>" : "") + "</div>";
    });
    if (out) { out.hidden = false; setHTML(out, rows || '<div class="cd-run-t ok"><span class="cd-run-tmark">✓</span><span class="cd-run-tin">скомпилировалось без ошибок</span></div>'); }
    if (msg) {
      if (res.ok && tests.length) { msg.textContent = "Все тесты пройдены (" + passed + "/" + tests.length + ")!"; msg.className = "cd-ch-msg ok"; challengeSolved(box); syncSolution(box); }
      else if (tests.length) {
        msg.textContent = "Пройдено " + passed + " из " + tests.length + (res.stopped === "hang"
          ? " — программа зависла (бесконечный цикл?), остальные тесты не запускались."
          : res.stopped ? " — время вышло, остальные тесты не запускались." : " — поправь код и запусти снова.");
        msg.className = "cd-ch-msg err";
      }
      else { msg.textContent = "Скомпилировалось без ошибок."; msg.className = "cd-ch-msg ok"; }
    }
  }
  function checkToggle(btn) {
    var id = btn.getAttribute("data-id"); if (!id) return;
    var on = !btn.classList.contains("on");
    btn.classList.toggle("on", on);
    if (on) state.checks[id] = true; else delete state.checks[id];
    saveState();
  }

  // Чек-бокс списка задач «- [ ] …»: переключаем и красим текст, состояние — в state.checks.
  function taskCheckToggle(btn) {
    var id = btn.getAttribute("data-id"); if (!id) return;
    var on = !btn.classList.contains("on");
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-checked", on ? "true" : "false");
    var txt = btn.parentNode && btn.parentNode.querySelector(".cd-tl-txt");
    if (txt) txt.classList.toggle("done", on);
    if (on) state.checks[id] = true; else delete state.checks[id];
    saveState();
  }

  // Короткая вспышка «✓» на маленькой кнопке (для «#» и копий, где длинный текст не влезает).
  function flashTiny(btn, sym) {
    var prev = btn.textContent;
    btn.textContent = sym || "✓"; btn.classList.add("copied");
    setTimeout(function () { try { btn.textContent = prev; btn.classList.remove("copied"); } catch (e) {} }, 1100);
  }
  function copyText(text, cb) {
    try {
      navigator.clipboard.writeText(text).then(cb, function () { legacyCopy(text); cb(); });
    } catch (e) { legacyCopy(text); cb(); }
  }
  // «#» у заголовка → копирует внутреннюю ссылку вида 07-algoritmy.md#18-алгоритмы.
  function copyHeadingLink(btn) {
    var slug = btn.getAttribute("data-slug");
    if (!slug || !current) return;
    copyText(current.rel + "#" + slug, function () { flashTiny(btn, "✓"); });
  }
  // Кнопка в шапке читалки → копирует весь материал как Markdown-исходник.
  function copyWholeDoc(btn) {
    if (!current) return;
    copyText(current.md || "", function () { flashTiny(btn, "✓"); });
  }

  // «☆» у заголовка → закладка на раздел (ключ rel#slug, значение — чистый текст заголовка).
  function toggleBookmark(btn) {
    var slug = btn.getAttribute("data-slug");
    if (!slug || !current) return;
    var key = current.rel + "#" + slug;
    if (state.marks[key]) {
      delete state.marks[key];
      btn.classList.remove("on"); btn.textContent = "☆"; btn.setAttribute("aria-pressed", "false");
    } else {
      var h = btn.closest ? btn.closest("h2,h3,h4,h5,h6") : btn.parentNode;
      var txt = (h && (h.getAttribute("data-title") || h.textContent)) || slug;
      state.marks[key] = String(txt).replace(/[#☆★\s]+$/, "").trim();
      btn.classList.add("on"); btn.textContent = "★"; btn.setAttribute("aria-pressed", "true");
    }
    saveState();
  }
  // Проставить состояние звёздочек после рендера файла (как decorateTasks для «решено»).
  function syncBookmarks() {
    if (!articleEl || !current) return;
    articleEl.querySelectorAll(".cd-hmark").forEach(function (b) {
      var on = !!state.marks[current.rel + "#" + b.getAttribute("data-slug")];
      b.classList.toggle("on", on);
      b.textContent = on ? "★" : "☆";
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // ------- поиск по тексту открытого материала -------
  // Снять прошлую подсветку: заменяем наши <mark class="cd-find-hit"> обратно на текст.
  function findClear() {
    if (articleEl) {
      var hits = articleEl.querySelectorAll("mark.cd-find-hit");
      for (var i = 0; i < hits.length; i++) {
        var m = hits[i];
        if (m.parentNode) m.parentNode.replaceChild(document.createTextNode(m.textContent), m);
      }
      if (articleEl.normalize) try { articleEl.normalize(); } catch (e) {}   // склеить соседние текст-узлы
    }
    findHits = []; findIdx = -1;
  }
  // Полный сброс (смена файла): убрать подсветку и спрятать панель.
  function findReset() {
    findClear();
    if (findBar) findBar.hidden = true;
    if (findBtn) findBtn.classList.remove("on");
    if (findInput) findInput.value = "";
    updateFindCount();
  }
  function updateFindCount() {
    if (!findCountEl) return;
    findCountEl.textContent = findHits.length ? (findIdx + 1) + "/" + findHits.length : "0";
    findCountEl.classList.toggle("cd-find-none", !findHits.length && !!(findInput && findInput.value));
  }
  // Обойти текст-узлы статьи и обернуть совпадения запроса в <mark class="cd-find-hit">.
  function findRun(q) {
    findClear();
    if (!articleEl) { updateFindCount(); return; }
    var query = norm(String(q || ""));
    if (query.length < 1) { updateFindCount(); return; }
    var nodes = [];
    (function walk(node) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { if (c.nodeValue && c.nodeValue.trim()) nodes.push(c); }
        else if (c.nodeType === 1 && c.tagName !== "MARK" && c.tagName !== "BUTTON") walk(c);
      }
    })(articleEl);
    nodes.forEach(function (tn) {
      var text = tn.nodeValue, low = norm(text), idx = low.indexOf(query);
      if (idx === -1) return;
      var frag = document.createDocumentFragment(), pos = 0;
      while (idx !== -1) {
        if (idx > pos) frag.appendChild(document.createTextNode(text.slice(pos, idx)));
        var m = document.createElement("mark"); m.className = "cd-find-hit";
        m.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(m); findHits.push(m);
        pos = idx + query.length; idx = low.indexOf(query, pos);
      }
      if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
      if (tn.parentNode) tn.parentNode.replaceChild(frag, tn);
    });
    if (findHits.length) findGo(0); else updateFindCount();
  }
  function findGo(i) {
    if (!findHits.length) { updateFindCount(); return; }
    if (i < 0) i = findHits.length - 1; else if (i >= findHits.length) i = 0;
    if (findIdx >= 0 && findHits[findIdx]) findHits[findIdx].classList.remove("cur");
    findIdx = i;
    var m = findHits[findIdx];
    m.classList.add("cur");
    try { m.scrollIntoView({ block: "center" }); } catch (e) {}
    updateFindCount();
  }
  function findStep(dir) { if (findHits.length) findGo(findIdx + dir); }
  function toggleFind(force) {
    if (!findBar) return;
    var show = (typeof force === "boolean") ? force : findBar.hidden;
    findBar.hidden = !show;
    if (findBtn) findBtn.classList.toggle("on", show);
    if (show) { findInput.focus(); findInput.select(); if (findInput.value) findRun(findInput.value); }
    else { findClear(); updateFindCount(); }
  }

  function onArticleClick(e) {
    var stub = e.target.closest && e.target.closest(".cd-taskstub");
    if (stub) { e.preventDefault(); e.stopPropagation(); sendTaskStub(stub); return; }
    var solve = e.target.closest && e.target.closest(".cd-solve");
    if (solve) { e.preventDefault(); e.stopPropagation(); toggleSolved(solve); return; }
    var hmark = e.target.closest && e.target.closest(".cd-hmark");
    if (hmark) { e.preventDefault(); e.stopPropagation(); toggleBookmark(hmark); return; }
    var hlink = e.target.closest && e.target.closest(".cd-hlink");
    if (hlink) { e.preventDefault(); e.stopPropagation(); copyHeadingLink(hlink); return; }
    var tl = e.target.closest && e.target.closest(".cd-tl-box");
    if (tl) { e.preventDefault(); e.stopPropagation(); taskCheckToggle(tl); return; }
    var exMore = e.target.closest && e.target.closest(".cd-ex-more");
    if (exMore) { e.preventDefault(); openFile(exMore.getAttribute("data-rel"), exMore.getAttribute("data-hash") || undefined); return; }
    var toed = e.target.closest && e.target.closest(".cd-toed");
    if (toed) { e.preventDefault(); sendToEditor(toed); return; }
    var copy = e.target.closest && e.target.closest(".copybtn");
    if (copy) { doCopy(copy); return; }
    var wrapB = e.target.closest && e.target.closest(".cd-wrapbtn");
    if (wrapB) { e.preventDefault(); state.codeWrap = !state.codeWrap; saveState(); applyReaderPrefs(); return; }
    var see = e.target.closest && e.target.closest(".cd-see");
    if (see) { e.preventDefault(); openInTab(see.getAttribute("data-rel"), null, e.ctrlKey || e.metaKey); return; }
    var hlu = e.target.closest && e.target.closest(".cd-hlu");
    if (hlu) { e.preventDefault(); removeHighlight(hlu); return; }
    if (quizClick(e)) return;
    if (gamesClick(e)) return;                     // сундуки, волна поиска пути
    // клик по строке таблицы «Задачи темы» — переход к самой задаче
    var taskRow = e.target.closest && e.target.closest("tr.cd-taskrow");
    if (taskRow && !e.target.closest("a[href]")) { gotoTask(taskRow.getAttribute("data-num")); return; }
    // клик по строке таблицы сниппетов — развернуть/свернуть код под ней
    var snipRow = e.target.closest && e.target.closest("tr.cd-snip");
    if (snipRow && !e.target.closest("a[href]")) {
      var codeRow = snipRow.nextElementSibling;
      if (codeRow && codeRow.classList.contains("cd-snip-code")) {
        var closed = codeRow.hasAttribute("hidden");
        if (closed) codeRow.removeAttribute("hidden"); else codeRow.setAttribute("hidden", "");
        snipRow.classList.toggle("cd-open", closed);
      }
      return;
    }
    // клик по заголовку раздела (не по его кнопкам/ссылкам) — свернуть/развернуть
    var foldH = e.target.closest && e.target.closest("h2.cd-foldable");
    if (foldH && !(e.target.closest("a[href]") || e.target.closest("button"))) {
      setFold(foldH, !foldH.classList.contains("cd-sec-folded")); return;
    }
    var a = e.target.closest && e.target.closest("a[href]");
    if (a) {
      var href = a.getAttribute("href");
      if (/^(https?|mailto):/i.test(href)) { e.preventDefault(); openExternalLink(href); return; } // внешняя — во внешний браузер, не в фрейм
      e.preventDefault();
      if (href.charAt(0) === "#") { openFile(current.rel, href); return; }  // якорь той же страницы — та же вкладка
      var res = resolveRel(current.rel, href);
      var map = fileMap();
      if (/\.md$/i.test(res.rel) && map[res.rel.toLowerCase()]) openInTab(res.rel, res.hash, e.ctrlKey || e.metaKey);
    }
  }
  function flashCopy(btn) {
    var prev = btn.textContent;
    btn.textContent = "скопировано ✓"; btn.classList.add("done");
    var cw = btn.closest && btn.closest(".codewrap");
    if (cw) { cw.classList.remove("cd-copied"); void cw.offsetWidth; cw.classList.add("cd-copied"); }
    setTimeout(function () { btn.textContent = prev; btn.classList.remove("done"); }, 1300);
  }
  function legacyCopy(text) {
    try {
      var ta = el("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    } catch (e) {}
  }
  // Внешняя ссылка: default-навигация увела бы весь workbench-фрейм на URL. Гасим её и открываем
  // через window.open — VS Code перехватит и откроет во внешнем браузере, редактор цел.
  function openExternalLink(href) {
    try { window.open(href, "_blank", "noopener"); } catch (e) {}
  }

  // ------- клавиатура -------
  // Esc — только когда фокус внутри окна: обработчик висит на document (фаза перехвата), и без
  // этой проверки Esc в редакторе (закрыть подсказку/поиск VS Code) закрывал бы окно документации.
  function focusInside(win, t, ae) {
    if (!win) return false;
    return !!((t && t.nodeType === 1 && win.contains(t)) || (ae && ae !== document.body && win.contains(ae)));
  }
  function onKey(e) {
    if (isOpen() && altKey(e)) return;                     // ← → листают применения примера
    if (!isOpen() || e.key !== "Escape") return;
    if (!focusInside(winEl, e.target, document.activeElement)) return;
    if (progressOpen()) { e.stopPropagation(); hideProgress(); return; }                 // окно «Прогресс»
    if (guideEl && !guideEl.hidden) { e.stopPropagation(); hideGuide(); return; }        // сперва закрываем руководство
    if (viewMenu && !viewMenu.hidden) { viewMenu.hidden = true; return; }
    if (edPopEl && !edPopEl.hidden) { edPopEl.hidden = true; return; }
    if (findBar && !findBar.hidden) { e.stopPropagation(); toggleFind(false); return; }  // затем поиск, не окно
    closeWindow();
  }

  // ==== runtime/14-channels.js — открыть/закрыть окно, доступ к файлам, мост, действия окна ====
  // ---------------------------------------------------------------------------
  //  Открыть / закрыть / обновить.
  // ---------------------------------------------------------------------------
  // Закрытие окна его только прячет: DOM, прокрутка, вкладки и раскрытые разделы живут до
  // следующего открытия (пересборка окна — самое дорогое место рантайма). Пересобираем, только
  // если VS Code снёс узел, перестраивая свой DOM.
  var winOpen = false;
  function isOpen() { return !!(winEl && winOpen); }
  function openWindow() {
    if (pendingErr) { pendingErr = false; syncBadge(); }
    lastBridgeWord = null;   // плашка ошибки/слова покажется заново
    if (winEl && !winEl.isConnected) { document.removeEventListener("keydown", onKey, true); winEl = null; }
    if (winEl) {
      winEl.style.display = "flex";
      winOpen = true;
      try { keepOnScreen(); applyResponsive(); } catch (e) {}
    } else {
      winOpen = true;
      buildWindow();
    }
    if (state.docked && !_docked) applyDock(true);
    setBtnVisible(false);
    cdShareView();
  }
  function closeWindow() {
    if (IN_PANEL) return;
    if (_docked) applyDock(false);          // спрятанное окно не должно отнимать место у редактора
    if (winEl) winEl.style.display = "none";
    winOpen = false;
    try { hideHlPop(); hideItemMenu(); } catch (e) {}
    setBtnVisible(true);
    cdShareView();
  }
  function toggleWindow() { if (isOpen()) closeWindow(); else openWindow(); }

  function bootVal(key) { try { var b = window.__CPPDOCS_BOOT__; return b && b[key]; } catch (e) { return null; } }
  // Доступ к файлам. Оболочка VS Code работает в песочнице — Node у окна нет (VS Code ≥ 1.76):
  //  • читаем через vscode-file://vscode-app/<путь> (хранилище и папка расширений — разрешённые
  //    корни оболочки);
  //  • пишем через мост расширения (lib/bridge.js): POST на 127.0.0.1 с токеном.
  function appUrl(u) {
    var m = String(u || "").match(/^file:\/\/\/([^?#]+)$/);
    if (!m) return null;
    return "vscode-file://vscode-app/" + m[1].split("/").map(function (seg) {
      try { return encodeURIComponent(decodeURIComponent(seg)).replace(/%3A/gi, ":"); } catch (e) { return ""; }
    }).join("/");
  }
  // Адрес ресурса для <img>/фона: file:/// → vscode-file:// (оболочка); во вкладке расширение уже
  // прислало адрес webview (https://…vscode-cdn.net/…) — берём как есть.
  function resUrl(u) {
    if (IN_PANEL && /^https:\/\/[^"'()\s<>]+$/.test(String(u || ""))) return String(u);
    // Превью в браузере (npm run preview:window / dev): картинки отдаёт локальный сервер превью.
    // В оболочке VS Code страница открыта по vscode-file:, так что эта ветка там не срабатывает.
    if (typeof location !== "undefined" && /^https?:$/.test(location.protocol) &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^"'()\s<>]*$/.test(String(u || ""))) return String(u);
    return appUrl(u);
  }
  function appRead(u) {
    try {
      if (typeof location === "undefined" || location.protocol !== "vscode-file:" || typeof XMLHttpRequest === "undefined") return null;
      var url = appUrl(u); if (!url) return null;
      var x = new XMLHttpRequest();
      x.open("GET", url + "?t=" + Date.now(), false);   // метка — мимо кэша
      x.send();
      return x.status === 200 || (x.status === 0 && x.responseText) ? x.responseText : null;
    } catch (e) { return null; }       // файла нет — оболочка отвечает ошибкой сети
  }
  var _bridge = null, _bridgeAt = 0;
  // Через Moon Core: события модуля вместо своего потока (подписываемся один раз).
  var _mcSubscribed = false;
  function mcSubscribe() {
    if (_mcSubscribed || !MCM) return;
    _mcSubscribed = true;
    _esLive = true;   // контекст редактора и метка приходят событиями — опрос файлов не нужен
    try {
      MCM.on("editor", function (txt) { var p = parseEditorText(String(txt)); if (p) { editorPayload = p; applyEditorPayload(p); } });
      MCM.on("stamp", function (txt) { applyStampText(String(txt)); });
      MCM.on("progress", function (txt) { onProgressEvent(String(txt)); });
    } catch (e) { _esLive = false; }
  }
  function bridgeInfo() {
    if (IN_PANEL) return null;
    // Moon Core: события — через его мост, но свой мост расширения тоже жив: им пишем зеркало
    // прогресса (у моста Moon Core лимит 1 МБ и нет sendBeacon при закрытии окна).
    if (MCM) mcSubscribe();
    if (_bridge && Date.now() - _bridgeAt < 10000) return _bridge;
    _bridgeAt = Date.now();
    var d = DATA(), txt = appRead((d && d.bridgeUrl) || bootVal("bridgeUrl"));
    var prev = _bridge; _bridge = null;
    try {
      var o = txt ? JSON.parse(txt) : null;
      // Окон VS Code может быть несколько — в файле список живых хостов (hosts); годится любой.
      // Старый формат — один адрес {port, token}. Хост, который недавно не ответил, пропускаем.
      var list = o && Array.isArray(o.hosts) ? o.hosts.slice(0, 16) : (o ? [o] : []);
      for (var i = 0; i < list.length && !_bridge; i++) {
        var h = list[i];
        if (!h || !((h.port | 0) > 0 && (h.port | 0) < 65536 && /^[0-9a-f]{48}$/.test(h.token))) continue;
        if (_badHosts[h.token] && Date.now() - _badHosts[h.token] < 30000) continue;
        _bridge = { port: h.port | 0, token: h.token };
      }
      if (_bridge) {
        var fresh = !prev || prev.token !== _bridge.token;
        // «я на связи» — для «Проверить плавающее окно» (один раз на адрес моста)
        if (fresh && typeof fetch === "function") try { fetch("http://127.0.0.1:" + _bridge.port + "/ping/" + _bridge.token, { cache: "no-store" }).catch(function () {}); } catch (e) {}
        if (fresh && !MCM) connectEvents();
      }
    } catch (e) {}
    return _bridge;
  }
  var _badHosts = {};
  function bridgeFailed(b) {
    if (b) _badHosts[b.token] = Date.now();
    if (_bridge && b && _bridge.token === b.token) { _bridge = null; _bridgeAt = 0; }
  }

  // Поток событий от расширения (SSE): контекст редактора и метка свежести данных приходят
  // сами — без синхронного чтения файлов раз в секунду на главном потоке VS Code. Пока поток
  // не подключён (нет моста / старое расширение) — работает прежний опрос, но реже.
  var _es = null, _esToken = "", _esLive = false;
  function connectEvents() {
    if (typeof EventSource !== "function" || !_bridge) return;
    if (_es && _esToken === _bridge.token) return;
    try { if (_es) _es.close(); } catch (e) {}
    var b = _bridge;
    _esToken = b.token; _esLive = false;
    try { _es = new EventSource("http://127.0.0.1:" + b.port + "/events/" + b.token); } catch (e) { _es = null; return; }
    _es.onopen = function () { _esLive = true; };
    // Хост из файла мёртв (адрес прошлого сеанса) — EventSource будет молча переподключаться вечно.
    // Не открылся за 5 с — помечаем хост плохим и берём следующий.
    var es0 = _es;
    setTimeout(function () {
      if (_es === es0 && !_esLive) { try { es0.close(); } catch (e) {} _es = null; _esToken = ""; bridgeFailed(b); }
    }, 5000);
    _es.onerror = function () {
      _esLive = false;
      // Хост закрылся (окно VS Code закрыли) — переключаемся на другой из списка.
      if (_es && _es.readyState === 2) { _es = null; bridgeFailed(b); bridgeInfo(); }
    };
    _es.addEventListener("editor", function (ev) {
      var p = parseEditorText(ev.data);
      if (p) { editorPayload = p; applyEditorPayload(p); }
    });
    _es.addEventListener("stamp", function (ev) { applyStampText(ev.data); });
    _es.addEventListener("progress", function (ev) { onProgressEvent(ev.data); });
  }
  // Записать зеркало прогресса через мост (во вкладке — сообщением). Асинхронно; true — запрос ушёл.
  function bridgeWrite(u, text, beacon) {
    var name = String(u || "").split(/[\/\\]/).pop();
    if (PROTO.WRITABLE.indexOf(name) === -1) return false;
    if (IN_PANEL) { try { VSC.postMessage({ type: "write", name: name, text: String(text) }); return true; } catch (e) { return false; } }
    var b = bridgeInfo();
    if (!b) return MCM ? mcWrite(name, text) : false;
    var target = "http://127.0.0.1:" + b.port + "/w/" + b.token + "/" + name;
    // sendBeacon переживает выгрузку страницы; text/plain не требует CORS-предзапроса.
    if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(target, new Blob([String(text)], { type: "text/plain" }))) return true; } catch (e) {}
    }
    if (typeof fetch !== "function") return false;
    try {
      fetch(target, {
        method: "POST", body: String(text), headers: { "Content-Type": "text/plain" }, mode: "cors", cache: "no-store",
      }).then(function (r) { if (!r.ok) { bridgeFailed(b); if (MCM) mcWrite(name, text); } },
        function () { bridgeFailed(b); if (MCM) mcWrite(name, text); });   // сбой — возьмём другой хост (или мост Moon Core)
      return true;
    } catch (e) { return false; }
  }
  // Запись через мост Moon Core: у него лимит тела запроса ~1 МБ. Больше — не молчим, а сообщаем
  // (журнал + один раз подсказка): иначе прогресс тихо переставал бы сохраняться.
  var MC_MAX_WRITE = 1000 * 1000, _mcBigWarned = false;
  function mcWrite(name, text) {
    text = String(text);
    if (text.length > MC_MAX_WRITE) {
      if (!_mcBigWarned) {
        _mcBigWarned = true;
        reportError("зеркало прогресса", new Error("зеркало " + Math.round(text.length / 1024) + " КБ больше лимита моста Moon Core; мост расширения недоступен"));
        toast("Резервная копия прогресса не сохранилась: слишком большая. Проверь «Документация C++: проверить плавающее окно».", true);
      }
      return false;
    }
    try {
      MCM.rpc("write", { name: name, text: text }).then(function (r) {
        if (!r || !r.ok) reportError("зеркало прогресса", new Error((r && r.error) || "мост Moon Core не принял запись"));
      }, function () {});
      return true;
    } catch (e) { return false; }
  }
  // Все живые хосты из файла моста (текущий — первым). Для запросов с ответом перебираем по порядку:
  // действие окна выполняет хост окна VS Code в фокусе, остальные отвечают 409 «не я».
  function bridgeHosts() {
    var d = DATA(), txt = appRead((d && d.bridgeUrl) || bootVal("bridgeUrl")), out = [];
    try {
      var o = txt ? JSON.parse(txt) : null;
      var list = o && Array.isArray(o.hosts) ? o.hosts.slice(0, 16) : (o ? [o] : []);
      list.forEach(function (h) {
        if (h && (h.port | 0) > 0 && (h.port | 0) < 65536 && /^[0-9a-f]{48}$/.test(h.token)) out.push({ port: h.port | 0, token: h.token });
      });
    } catch (e) {}
    var cur = _bridge;
    if (cur) out.sort(function (a, b) { return (b.token === cur.token) - (a.token === cur.token); });
    return out;
  }
  // Запрос к расширению с ответом: run / action / log (методы и лимиты — PROTO, из lib/protocol.js).
  // cb(ответ) или cb(null) — нет связи или вышло время.
  var _rpcSeq = 0, _rpcWait = {};
  function rpc(method, body, timeoutMs, cb) {
    var done = false;
    var timer = setTimeout(function () { finish(null); }, timeoutMs);
    function finish(r) { if (done) return; done = true; clearTimeout(timer); try { cb(r); } catch (e) { reportError("rpc:" + method, e); } }
    if (IN_PANEL) {
      var id = "q" + Date.now() + "-" + (++_rpcSeq);
      _rpcWait[id] = function (r) { delete _rpcWait[id]; finish(r); };
      try { VSC.postMessage({ type: "rpc", id: id, method: method, body: body }); } catch (e) { delete _rpcWait[id]; finish(null); }
      return;
    }
    if (MCM) {
      // Мост Moon Core сам выбирает хост этого окна; ответ модуля — { ok, result }.
      try {
        // Своё ожидание: «Запустить» идёт до минуты, а у моста Moon Core по умолчанию 8 с.
        MCM.rpc(method, body, { timeoutMs: Math.max(1000, timeoutMs - 1000) }).then(function (r) { finish(r && r.ok ? r.result : null); }, function () { finish(null); });
      } catch (e) { finish(null); }
      return;
    }
    var hosts = bridgeHosts(), i = 0;
    if (!hosts.length || typeof fetch !== "function") { finish(null); return; }
    (function next() {
      if (done) return;
      if (i >= hosts.length) { finish(null); return; }
      var h = hosts[i++];
      fetch("http://127.0.0.1:" + h.port + "/rpc/" + h.token + "/" + method, {
        // text/plain — «простой» запрос без CORS-предзапроса; хост всё равно разбирает JSON
        method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "text/plain" }, mode: "cors", cache: "no-store",
      }).then(function (r) {
        if (r.status === 409) { next(); return null; }               // не тот хост — следующий
        if (!r.ok) { bridgeFailed(h); next(); return null; }
        return r.json();
      }).then(function (j) { if (j) finish(j); }, function () { bridgeFailed(h); next(); });
    })();
  }
  // Ошибки окна — в журнал расширения (Output → «Документация C++»): иначе сбой в окне не виден
  // никому. Не чаще 10 в минуту; сами отправки ошибок не порождают.
  var _errN = 0, _errT = 0, _errBusy = false;
  function reportError(where, e) {
    if (_errBusy) return;
    try {
      var now = Date.now();
      if (now - _errT > 60000) { _errT = now; _errN = 0; }
      if (++_errN > 10) return;
      _errBusy = true;
      var msg = String(e && (e.message || e) || e).slice(0, 500);
      var stack = e && e.stack ? String(e.stack).slice(0, 2000) : "";
      try { console.warn("[cpp-docs] " + where + ": " + msg); } catch (x) {}
      rpc("log", { where: String(where || "").slice(0, 80), msg: msg, stack: stack, v: VERSION }, 3000, function () {});
    } catch (x) {} finally { _errBusy = false; }
  }
  try {
    // Только ошибки НАШЕГО скрипта: он встроен в workbench.html, значит, у его ошибок filename —
    // адрес самой страницы (скрипты VS Code — отдельные .js). Во вкладке страница целиком наша.
    cdOnGlobal(window, "error", function (ev) {
      if (!ev) return;
      var fn = String(ev.filename || "").split("?")[0];
      var mine = IN_PANEL || (fn && typeof location !== "undefined" && fn === String(location.href).split("?")[0]) ||
        /mooncore-mod-cppdocs\.js$/.test(fn);   // файл модуля Moon Core рядом с оболочкой
      if (mine) reportError("window.onerror", ev.error || ev.message);
    });
    if (IN_PANEL) cdOnGlobal(window, "unhandledrejection", function (ev) { reportError("promise", ev && ev.reason); });
  } catch (e) {}
  // Прочитать файл хранилища/расширения (vscode-file://; во вкладке — только зеркало прогресса).
  function fileRead(u) {
    if (IN_PANEL) return u && u === progressUrl() && typeof window.__CPPDOCS_MIRROR__ === "string" ? window.__CPPDOCS_MIRROR__ : null;
    return appRead(u);
  }
  // Асинхронное чтение (данные окна — сотни КБ: синхронный запрос подвесил бы интерфейс VS Code).
  function appReadAsync(u, cb) {
    if (IN_PANEL) { cb(null); return; }
    var url = appUrl(u);
    if (!url || typeof XMLHttpRequest === "undefined") { cb(null); return; }
    try {
      var x = new XMLHttpRequest();
      x.open("GET", url + "?t=" + Date.now(), true);
      x.onload = function () { cb(x.status === 200 || (x.status === 0 && x.responseText) ? x.responseText : null); };
      x.onerror = function () { cb(null); };
      x.send();
    } catch (e) { cb(null); }
  }
  // ---------------------------------------------------------------------------
  //  Действия окна → расширение: «в редактор», «заготовка», «в заметки», копия прогресса —
  //  запросом rpc("action") с ответом сразу.
  // ---------------------------------------------------------------------------
  var _actSeq = 0;
  function sendAction(payload, cb) {
    payload.id = "a" + Date.now() + "-" + (++_actSeq);
    payload.ts = Date.now();
    rpc("action", payload, PROTO.ACTION_TIMEOUT_MS, function (res) {
      cb(res || { ok: false, error: IN_PANEL ? "расширение не ответило" : "нет связи с расширением — обнови окно ⟳" });
    });
  }
  // Короткое сообщение внизу экрана (успех/ошибка действия).
  var toastEl = null, toastTimer = null;
  function toast(text, bad) {
    try {
      if (!toastEl) { toastEl = el("div"); toastEl.className = "cd-toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
      toastEl.textContent = text;
      toastEl.classList.toggle("bad", !!bad);
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { if (toastEl) toastEl.hidden = true; }, 2600);
    } catch (e) {}
  }
  // Языки, у которых есть кнопка «в редактор». Блок без языка — обычно вывод программы или
  // текст ошибки, вставлять его в .cpp незачем.
  var TOED_LANGS = { cpp: 1, "c++": 1, cc: 1, cxx: 1, c: 1, h: 1, hpp: 1 };
  function toEditorBtn(code) {
    return '<button class="copybtn cd-toed" type="button" title="Вставить в открытый .cpp (на место курсора), а если его нет — в новый файл" data-code="' +
      escapeHtml(code) + '"><span class="cb-ic">↳</span> в редактор</button>';
  }
  function sendToEditor(btn) {
    var code = btn.getAttribute("data-code") || "";
    if (!code.trim()) return;
    btn.disabled = true;
    sendAction({ kind: "insert", code: code }, function (res) {
      btn.disabled = false;
      if (res.ok) toast(res.where === "new" ? "Код открыт в новом файле" : "Вставлено в " + (res.name || "редактор"));
      else toast("Не вставилось: " + (res.error || "ошибка"), true);
    });
  }
  // Каркас решения задачи: условие (абзацы до «Пример» / подсказок) — комментарием сверху.
  function wrapComment(text, width) {
    var out = [], line = "";
    String(text).replace(/\s+/g, " ").trim().split(" ").forEach(function (w) {
      if (line && (line + " " + w).length > width) { out.push("// " + line); line = w; }
      else line = line ? line + " " + w : w;
    });
    if (line) out.push("// " + line);
    return out;
  }
  function taskStubCode(h) {
    var title = (h.getAttribute("data-title") || h.firstChild && h.firstChild.textContent || h.textContent)
      .replace(/[🟢🟡🔴]/g, "").replace(/\s+/g, " ").trim();
    var cond = [];
    for (var n = h.nextElementSibling; n; n = n.nextElementSibling) {
      if (/^(H[1-3]|PRE|DETAILS|HR)$/.test(n.tagName) || n.classList.contains("codewrap")) break;
      var t = n.textContent.replace(/\s+/g, " ").trim();
      if (/^Пример/i.test(t)) break;
      var em = n.firstElementChild;   // курсивная строка-подводка — не условие
      if (em && n.children.length === 1 && em.tagName === "EM" && em.textContent.trim() === t) continue;
      if (n.tagName === "P" && t) cond.push(t);
    }
    var lines = ["// Задача " + title];
    cond.forEach(function (t, i) { if (i) lines.push("//"); lines = lines.concat(wrapComment(t, 86)); });
    return lines.join("\n") + "\n\n" +
      "#include <windows.h>        // Windows: русские буквы в консоли\n" +
      "#include <iostream>\n#include <string>\n\n" +
      "int main() {\n  SetConsoleCP(CP_UTF8);\n  SetConsoleOutputCP(CP_UTF8);\n\n" +
      "  // 1. ВВОД   2. РАСЧЁТ   3. ВЫВОД\n\n  return 0;\n}\n";
  }
  function sendTaskStub(btn) {
    var h = btn.closest("h2"); if (!h) return;
    btn.disabled = true;
    sendAction({ kind: "newfile", code: taskStubCode(h) }, function (res) {
      btn.disabled = false;
      if (res.ok) toast("Заготовка открыта в новом файле — сохрани её как .cpp");
      else toast("Не открылось: " + (res.error || "ошибка"), true);
    });
  }
  // Цитата из выделения → «Мои заметки» (с источником: материал и раздел).
  function sendNote(text) {
    if (!current) return;
    var sec = "", slug = "";
    try {
      var sel = window.getSelection(), node = sel && sel.anchorNode;
      var hs = articleEl ? articleEl.querySelectorAll("h2[id],h3[id]") : [];
      for (var i = 0; i < hs.length; i++) {
        // последний заголовок ПЕРЕД выделением — раздел, откуда цитата
        if (node && (hs[i].compareDocumentPosition(node) & 4)) { sec = hs[i].getAttribute("data-title") || ""; slug = hs[i].id; }
      }
    } catch (e) {}
    sendAction({ kind: "note", text: text, rel: current.rel, title: current.title || current.name, section: sec, slug: slug }, function (res) {
      if (res.ok) toast("📝 Добавлено в «Мои заметки»");
      else toast("Не записалось: " + (res.error || "ошибка"), true);
    });
  }

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
    var txt = fileRead(url); if (txt == null) return;   // файла нет — не трогаем плашку
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
    if (url) applyStampText(fileRead(url));
  }

  // ==== runtime/15-mooncore.js — новое API Moon Core: выключение без перезагрузки, общая шина ====
  // ---------------------------------------------------------------------------
  //  Moon Core умеет выключить модуль без перезагрузки окна и снова включить его (тот же файл
  //  выполняется заново). Поэтому всё, что окно заводит глобально, снимается в cdStop():
  //  подписки (cdOnGlobal / cdTrack в 00-core.js), тикер, наблюдатели, поток событий моста,
  //  пилюля, окно, стиль. Прогресс перед этим сохраняется.
  //
  //  Общая шина модулей: акцент фона MoonLight BG приходит ключом «mlbg.accent» (раньше — только
  //  событием окна «mlbg-accent», оно тоже осталось для старого фона), а своё состояние окно
  //  публикует ключом «cppdocs.view» { open, title } — соседям видно, открыта ли документация.
  //  Со старым Moon Core (без onDispose / share) всё это молча пропускается.
  // ---------------------------------------------------------------------------
  var _cdStopped = false;

  function cdStop() {
    if (_cdStopped) return;
    try { flushMirror(); } catch (e) {}                 // отметки и прогресс — на диск до ухода
    _cdStopped = true;
    var off = _cdOff.splice(0);
    for (var i = off.length - 1; i >= 0; i--) { try { off[i](); } catch (e) {} }
    try { document.removeEventListener("keydown", onKey, true); } catch (e) {}
    try { if (_docked) applyDock(false); } catch (e) {}
    try { hideHlPop(); hideItemMenu(); hideBridge(); } catch (e) {}
    try { if (_es) { _es.close(); _es = null; } } catch (e) {}
    [WIN_ID, BTN_ID, STYLE_ID].forEach(function (id) {
      try { var n = document.getElementById(id); if (n) n.remove(); } catch (e) {}
    });
    try { if (winEl && winEl.parentNode) winEl.parentNode.removeChild(winEl); } catch (e) {}
    winEl = null; winOpen = false;
    try { if (MCM && typeof MCM.share === "function") MCM.share("cppdocs.view", undefined); } catch (e) {}
    // Повторное включение выполнит файл заново — защита «один рантайм на окно» не должна мешать.
    window.__CPPDOCS_RUNTIME__ = false;
    try { delete window.__cppDocs; } catch (e) { window.__cppDocs = undefined; }
  }

  var _cdViewSig = "";
  function cdShareView() {
    if (!MCM || typeof MCM.share !== "function" || _cdStopped) return;
    var open = false, title = "";
    try { open = !!isOpen(); } catch (e) {}
    try { title = current ? String(current.title || current.rel || "").slice(0, 120) : ""; } catch (e) {}
    var sig = open + "|" + title;
    if (sig === _cdViewSig) return;
    try { if (MCM.share("cppdocs.view", { open: open, title: title })) _cdViewSig = sig; } catch (e) {}
  }

  function cdMoonCoreApi() {
    if (!MCM) return;
    if (typeof MCM.onDispose === "function") MCM.onDispose(cdStop);
    if (typeof MCM.shared === "function") {
      cdTrack(MCM.shared("mlbg.accent", function () { _accentSig = ""; try { applyAccent(); } catch (e) {} }));
    }
    cdShareView();
  }
  // ==== runtime/16-boot.js — кнопка-запуск, самолечение, старт ====
  // ---------------------------------------------------------------------------
  //  Плавающая кнопка-запуск + самолечение (VS Code пересобирает DOM).
  // ---------------------------------------------------------------------------
  function setBtnVisible(v) {
    var b = document.getElementById(BTN_ID);
    if (b) b.style.display = v ? "inline-flex" : "none";
  }
  function ensureButton() {
    if (IN_PANEL) return;
    if (document.getElementById(BTN_ID)) return;
    if (!document.body) return;
    if (!extAlive()) return;   // расширение удалено — осиротевшую кнопку не создаём
    var d = DATA();
    var n = d ? d.files.length : 0;
    var b = el("div"); b.id = BTN_ID;
    b.setAttribute("role", "button");
    b.setAttribute("tabindex", "0");
    b.setAttribute("aria-label", "Открыть документацию C++");
    b.title = "Документация C++ — клик открывает окно, перетаскиванием можно отодвинуть";
    // Наклейка-смайл вместо эмодзи 📘 — фирменное лицо расширения даже при закрытом окне.
    setHTML(b, '<span class="cd-btn-face">' + stickerMarkup("welcome", 20) + "</span>C++" +
      (n ? ' <span class="cd-badge">' + n + "</span>" : ""));
    // Клик открывает окно; но если пилюлю только что перетащили — click, идущий следом
    // за mouseup, подавляем (иначе перетащил — и случайно открыл/закрыл окно).
    b.addEventListener("click", function () { if (b._dragged) { b._dragged = false; return; } toggleWindow(); });
    b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleWindow(); } });
    installBtnDrag(b);
    document.body.appendChild(b);
    restoreBtnPos(b);              // вернуть на место, куда пользователь её оттащил
    if (isOpen()) b.style.display = "none";
  }

  // Пилюлю можно оттащить мышью, если она перекрывает уведомления VS Code в углу.
  // Порог в несколько пикселей отделяет перетаскивание от обычного клика (клик открывает окно).
  // Позиция запоминается в state.btnX/btnY и переживает перезагрузку.
  function clampBtn(b, x, y) {
    var vw = viewW(), vh = window.innerHeight || 800;
    return { x: clamp(x, 4, vw - b.offsetWidth - 4), y: clamp(y, safeTop() + 4, vh - b.offsetHeight - 4) };
  }
  function placeBtn(b, x, y) {
    b.style.left = x + "px"; b.style.top = y + "px";
    b.style.right = "auto"; b.style.bottom = "auto";
  }
  function restoreBtnPos(b) {
    if (typeof state.btnX !== "number" || typeof state.btnY !== "number") return;
    var p = clampBtn(b, state.btnX, state.btnY);   // окно могло изменить размер — прижать к экрану
    placeBtn(b, p.x, p.y);
  }
  function installBtnDrag(b) {
    var d = null;
    b.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      var r = b.getBoundingClientRect();
      d = { sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top,
            moved: false, lastX: r.left, lastY: r.top };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    function onMove(e) {
      if (!d) return;
      if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 5) return;  // ещё клик
      d.moved = true;
      e.preventDefault();
      var p = clampBtn(b, e.clientX - d.dx, e.clientY - d.dy);
      d.lastX = p.x; d.lastY = p.y;
      placeBtn(b, p.x, p.y);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (d && d.moved) {
        b._dragged = true;   // подавить click, который придёт следом за этим mouseup
        state.btnX = Math.round(d.lastX); state.btnY = Math.round(d.lastY); saveState();
      }
      d = null;
    }
  }

  // Держим счётчик на кнопке в согласии с данными: после автообновления (окно даже закрыто)
  // число материалов могло измениться — ensureButton его не трогает, обновляем здесь.
  // Бейдж — это сигнал, а не счётчик файлов: «!» — окно объяснило ошибку в редакторе, пока было
  // закрыто; «N» — карточки, которые пора повторить (с учётом лимита новых). Нечего сказать — бейджа нет.
  // Карточки считаем не чаще раза в минуту: syncBadge зовётся из heal на тикере.
  var _cardSig = { t: 0, n: 0 }, pendingErr = false;
  function dueSignal() {
    var now = Date.now();
    if (now - _cardSig.t > 60000) {
      _cardSig.t = now;
      try { var cc = cardCounts(); _cardSig.n = cc.due + cc.neu; } catch (e) { _cardSig.n = 0; }
    }
    return _cardSig.n;
  }
  function syncBadge() {
    var b = document.getElementById(BTN_ID);
    if (!b) return;
    var d = DATA();
    var n = d && d.files.length ? dueSignal() : 0;
    var txt = pendingErr ? "!" : (n > 0 ? String(n) : "");
    var badge = b.querySelector(".cd-badge");
    if (txt) {
      if (!badge) { b.appendChild(document.createTextNode(" ")); badge = el("span"); badge.className = "cd-badge"; b.appendChild(badge); }
      if (badge.textContent !== txt) badge.textContent = txt;
      badge.classList.toggle("err", pendingErr);
      var tip = pendingErr ? "Есть подсказка про ошибку в коде — открой окно" : "Пора повторить карточки: " + n;
      if (badge.title !== tip) badge.title = tip;
    } else if (badge) { try { badge.remove(); } catch (e) {} }
  }

  // Дешёвое восстановление после того, как VS Code пересобрал DOM: вернуть кнопку, если её снесли.
  // Идёт на КАЖДУЮ мутацию workbench, поэтому здесь НЕТ ни диска (extAlive), ни getComputedStyle
  // (applyAccent) — только один getElementById; тяжёлое обслуживание делает heal() на тикере 3с.
  function healCheap() {
    if (_cdStopped) return;
    try {
      if (!document.getElementById(BTN_ID)) { ensureStyle(); ensureButton(); syncBadge(); }
    } catch (e) {}
  }
  // Дебаунс всплеска мутаций: пачка добавлений/удалений детей body схлопывается в одну проверку.
  var _healTimer = null;
  function onWorkbenchMutation() {
    if (_healTimer) return;
    _healTimer = setTimeout(function () { _healTimer = null; healCheap(); }, 150);
  }

  function heal() {
    if (_cdStopped) return;                  // модуль выключен в Moon Core — ничего не возвращаем
    // Расширение удалено — убираем кнопку и больше ничего не подрисовываем.
    try { if (!extAlive()) { var ob = document.getElementById(BTN_ID); if (ob) ob.remove(); return; } } catch (e) {}
    try { applyAccent(); } catch (e) {}   // акцент под тему/обои — до отрисовки стиля и кнопки
    try { ensureStyle(); } catch (e) {}
    try { ensureButton(); } catch (e) {}
    try { syncBadge(); } catch (e) {}
    // Тема окна могла смениться.
    try { applyThemeClasses(); } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  //  Старт.
  // ---------------------------------------------------------------------------
  function bootPanel() {
    _esLive = true;   // всё приходит сообщениями — опрос файлов не нужен
    try { applyAccent(); } catch (e) {}
    ensureStyle();
    document.documentElement.classList.add("cd-in-panel-doc");
    openWindow();
    if (winEl) winEl.classList.add("in-panel");
    window.addEventListener("message", function (ev) {
      var m = ev && ev.data;
      if (!m || typeof m !== "object") return;
      if (m.type === "editor" && typeof m.text === "string") { var p = parseEditorText(m.text); if (p) { editorPayload = p; applyEditorPayload(p); } }
      else if (m.type === "rpc-result" && typeof m.id === "string" && _rpcWait[m.id]) _rpcWait[m.id](m.result);
      else if (m.type === "data" && m.data) {
        var obj = sanitizeData(m.data);
        if (obj) { window.__CPPDOCS__ = obj; rebuildFromData(); }
      }
      else if (m.type === "theme") { try { applyAccent(); applyThemeClasses(); } catch (e) {} }
      else if (m.type === "progress" && typeof m.text === "string") { window.__CPPDOCS_MIRROR__ = m.text; onProgressEvent(m.text); }
    });
    try {
      document.addEventListener("mouseup", function () { setTimeout(onArticleSelect, 0); });
      document.addEventListener("scroll", hideHlPop, true);
    } catch (e) {}
    try { new MutationObserver(function () { applyThemeClasses(); }).observe(document.body, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    try { VSC.postMessage({ type: "ready" }); } catch (e) {}
  }
  function boot() {
    // nonce теперь приходит из инлайн-загрузчика __CPPDOCS_BOOT__ (данные грузятся внешним
    // файлом и nonce не несут). Fallback на старый путь — на случай инлайн-данных.
    try {
      var b0 = window.__CPPDOCS_BOOT__, d0 = DATA();
      CD_NONCE = (b0 && typeof b0.scriptNonce === "string" && b0.scriptNonce) ||
                 (d0 && typeof d0.scriptNonce === "string" && d0.scriptNonce) || MC_NONCE || "";
    } catch (e) {}
    if (IN_PANEL) { bootPanel(); return; }
    heal();
    // В оболочку впечатано только оглавление (data.lazy) — тексты материалов читаем асинхронно сразу
    // после старта: VS Code не разбирает мегабайты данных на критическом пути запуска.
    try { var d0l = DATA(); if (d0l && d0l.lazy) refreshData(); } catch (e) { reportError("lazy-data", e); }
    try { pollStamp(); } catch (e) {}
    try { pollEditor(); } catch (e) {}
    // маркер по тексту: показ кнопки «Выделить» после выделения, скрытие при прокрутке
    cdOnGlobal(document, "mouseup", function () { setTimeout(onArticleSelect, 0); });
    cdOnGlobal(document, "scroll", hideHlPop, true);
    // Один тикер на всё: возврат кнопки после перестройки DOM редактором (как у vscode-bg) плюс
    // опрос метки свежести для автообновления и слова под курсором. Оба дела спят, пока вкладка скрыта.
    // Тик раз в секунду: контекст редактора (крошечный файл) — каждый тик, чтобы «Найти в
    // справочнике» из меню открывалось сразу; лечение DOM и метка — каждый третий, как раньше.
    var tick = 0;
    var tickTimer = setInterval(function () {
      if (document.hidden || _cdStopped) return;
      ++tick;
      if (!_esLive && tick % 2 === 0) { try { pollEditor(); } catch (e) {} }   // поток событий не подключён — запасной опрос
      if (tick % 3) return;
      heal();
      // Поток не подключён: VS Code стартует окно раньше хоста расширений, и в файле моста сначала
      // лежит адрес прошлого сеанса. Перечитываем адрес (bridgeInfo кеширует его на 10 с) — как
      // только хост поднимет мост, окно подключится само.
      if (!_esLive) { try { pollStamp(); } catch (e) {} try { bridgeInfo(); } catch (e) {} }
      else if (tick % 30 === 0) { try { bridgeInfo(); } catch (e) {} }        // освежить список хостов
    }, 1000);
    cdTrack(function () { clearInterval(tickTimer); });
    try { bridgeInfo(); } catch (e) {}   // сразу подключиться к потоку событий
    try {
      var wbMo = new MutationObserver(onWorkbenchMutation);
      wbMo.observe(document.body || document.documentElement, { childList: true });
      cdTrack(function () { wbMo.disconnect(); if (_healTimer) { clearTimeout(_healTimer); _healTimer = null; } });
    } catch (e) {}
    // Новое API Moon Core: выключение модуля без перезагрузки окна, акцент фона через общую шину.
    try { cdMoonCoreApi(); } catch (e) { reportError("moon-core-api", e); }
    console.log("[cpp-docs] плавающее окно " + VERSION + " готово, материалов: " + (DATA() ? DATA().files.length : 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Узкий мост для превью/отладки (в реальном воркбенче не мешает).
  window.__cppDocs = {
    open: openWindow, close: closeWindow, toggle: toggleWindow, render: renderMarkdown,
    // для тестов: чистая логика главного экрана (карточки/следующий шаг)
    collectAllCards: collectAllCards, cardCounts: cardCounts, nextUnread: nextUnread,
    // для тестов/диагностики: мост доки↔редактор
    bridgeFind: bridgeFind, cppGlossary: CPPMAP, showBridge: showBridge, hideBridge: hideBridge,
    // для тестов: поиск со сниппетом и «Смотри также»
    searchHit: searchHit, relatedFiles: relatedFiles, appUrl: appUrl,
    // для тестов: ошибка простым языком и «Разминка дня»
    explainCompileError: explainCompileError, errorDocTarget: errorDocTarget, slugify: slugify,
    explainHtml: explainHtml, showBridgeError: showBridgeError, applyEditorEnv: applyEditorEnv, headNextTarget: headNextTarget, palettes: PALETTES, parseCards: parseCards, parsePalStickers: parsePalStickers,
    buildWarmupQueue: buildWarmupQueue, bossTasks: bossTasks, _state: function () { return state; },
    // для тестов: заготовка задачи, интервалы на кнопках, лимит новых карточек, режим по разделам
    taskStubCode: taskStubCode, ivlLabel: ivlLabel, cdPreview: cdPreview, newLeftToday: newLeftToday,
    tidyArticle: tidyArticle, showSection: showSection, parseTopics: parseTopics, examPassedTopics: examPassedTopics,
    _rpc: function (m, b, t, cb) { rpc(m, b, t, cb); }, _scrubHTML: scrubHTML, _stateSchema: { migrate: migrateState, normalize: normalizeState, prune: pruneState, version: STATE_VERSION }, stepsNorm: stepsNorm, collectChallenges: collectChallenges, dailyChallenge: dailyChallenge, dailyStreak: dailyStreak, parseMemory: parseMemory, parseFrames: parseFrames, focusInside: focusInside, _adoptProgress: adoptProgress, _saveState: function () { saveState(); }, _sticker: function (n) { return STICKERS[n]; }, _read: function (u) { return fileRead(u); }, _write: function (u, t) { return bridgeWrite(u, t); },
    // для тестов: игровые блоки (волна BFS, квесты «Подземелья»)
    bfsDist: bfsDist, bfsParse: bfsParse, collectQuests: collectQuests,
    // для тестов: освоение тем, карта, экзамен недели, достижения, рекорды, сравнение кода, Anki
    progressTopics: progressTopics, topicMastery: topicMastery, topicUnlocked: topicUnlocked, weakSpots: weakSpots,
    knowledgeMapHtml: knowledgeMapHtml, weekKey: weekKey, buildWeeklyExam: buildWeeklyExam, quizQuestionsOf: quizQuestionsOf,
    checkAchievements: checkAchievements, achList: ACH, noteRunResult: noteRunResult, noteDailySolved: noteDailySolved,
    noteDailyOpened: noteDailyOpened, dailyRecordLine: dailyRecordLine, recordsHtml: recordsHtml, achHtml: achHtml,
    diffHtml: diffHtml, codeLines: codeLines, lcsOps: lcsOps, codeNames: codeNames, exampleRefCode: exampleRefCode,
    renderCheckpoint: renderCheckpoint, renderRepeat: renderRepeat, ankiExportText: ankiExportText,
    onProgressEvent: onProgressEvent, keepRecent: keepRecent, aheadNotes: aheadNotes, renderCodeAlts: renderCodeAlts,
    // для тестов: новое API Moon Core (выключение без перезагрузки, общая шина)
    _mc: { api: cdMoonCoreApi, stop: cdStop, shareView: cdShareView, offCount: function () { return _cdOff.length; } },
  };
})();
