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

