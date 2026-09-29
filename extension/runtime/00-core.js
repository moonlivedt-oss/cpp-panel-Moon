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

