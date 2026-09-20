// ============================================================
//  Плавающее окно «Документация C++» — рантайм для окна редактора.
//
//  Этот файл НЕ запускается как расширение. Его внедряет в оболочку VS Code
//  загрузчик (subframe7536.custom-ui-style или be5invis.vscode-custom-css) —
//  тем же способом, что и MoonLight custom-bg. Расширение (extension.js) лишь
//  прописывает импорт этого файла и генерирует рядом cpp-docs-data.js, который
//  выставляет window.__CPPDOCS__ со всеми материалами (см. writeDataFile там).
//
//  Что здесь внутри:
//    • компактный рендер Markdown → HTML с подсветкой C++/bash;
//    • перетаскиваемое и растягиваемое окно (как панель vscode-bg);
//    • навигатор по всем .md: группы, поиск, прогресс «изучено», закладки;
//    • читалка: аккуратная типографика, кнопки «копировать код», оглавление
//      файла и переходы по внутренним ссылкам между файлами.
//
//  Работает офлайн, без сети и без доступа к API расширений: все данные уже
//  лежат в window.__CPPDOCS__. Позиция окна, отметки и закладки — в localStorage.
// ============================================================
(function () {
  "use strict";

  // Один рантайм на окно: загрузчик может импортировать файл повторно (перезагрузка
  // окна, второй импорт) — второй раз ничего не делаем, иначе появятся две кнопки.
  if (window.__CPPDOCS_RUNTIME__) return;
  window.__CPPDOCS_RUNTIME__ = true;

  var WIN_ID = "cppdocs-window";
  var BTN_ID = "cppdocs-launch";
  var STYLE_ID = "cppdocs-style";
  var LS_KEY = "cppdocs.ui.v1";
  // Шрифты чтения — только те, что уже есть в системе (без встраивания, офлайн).
  var RFONTS = {
    system: { label: "Системный", stack: "" },
    serif:  { label: "Сериф",     stack: "Cambria, Georgia, 'PT Serif', 'Times New Roman', serif" },
    soft:   { label: "Мягкий",    stack: "Candara, 'Segoe UI', Optima, 'Trebuchet MS', system-ui, sans-serif" },
    round:  { label: "Округлый",  stack: "'Comic Sans MS', 'Segoe Print', 'Chalkboard SE', 'Comic Neue', cursive" },
  };
  var VERSION = "3.0.0";
  // Идентификатор баннера «Что нового»: пока state.whatsnew !== этого значения — показываем баннер.
  var WHATSNEW = "home-2026-09";
  // Логотип как data-URI. В оболочке VS Code рантайм не может грузить файл с диска, поэтому
  // картинка встроена. Значение подставляет `node scripts/embed-logo.js` из docs/screenshots/logo-embed.png.
  var LOGO_URI = "data:image/png;base64,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";

  // ---------------------------------------------------------------------------
  //  Данные: материалы приходят из cpp-docs-data.js (window.__CPPDOCS__).
  // ---------------------------------------------------------------------------
  // Проверка формы + защита от prototype-pollution: контент из чужого воркспейса исполняется
  // в привилегированной оболочке, поэтому берём объект только ожидаемой формы и без опасных ключей.
  var BAD_KEYS = { "__proto__": 1, "constructor": 1, "prototype": 1 };
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
    if (typeof d.runtimeUrl === "string") out.runtimeUrl = d.runtimeUrl;
    if (typeof d.scriptNonce === "string") out.scriptNonce = d.scriptNonce;
    var total = 0;
    for (var i = 0; i < d.files.length && out.files.length < CD_MAX_FILES; i++) {
      var f = d.files[i];
      if (!f || typeof f !== "object" || Array.isArray(f)) continue;
      var md = cdStr(f.md);
      if (md.length > CD_MAX_MD) md = md.slice(0, CD_MAX_MD);
      if (total + md.length > CD_MAX_TOTAL_MD) md = "";
      total += md.length;
      out.files.push({
        rel: cdStr(f.rel), name: cdStr(f.name), title: cdStr(f.title), subtitle: cdStr(f.subtitle),
        group: cdStr(f.group), groupColor: cdStr(f.groupColor),
        minutes: cdNum(f.minutes), sections: cdNum(f.sections), md: md
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
  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var s = raw ? JSON.parse(raw) : {};
      return s && typeof s === "object" && !Array.isArray(s) ? s : {};
    } catch (e) { return {}; }
  }
  // Плоский словарь { ключ: значение }. Всё прочее — массив, null, число из
  // подпорченного localStorage — заменяем пустым объектом, чтобы state.read[rel]=…
  // и Object.keys(state.pins) не падали и не вели себя странно.
  function plainMap(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  var state = loadState();
  state.read = plainMap(state.read);          // { rel: true } — отмечено «изучено»
  state.solved = plainMap(state.solved);      // { "rel#slug": true } — задача задачника отмечена «решено»
  state.notes = plainMap(state.notes);        // { rel: "текст" } — личные заметки к материалу
  state.days = plainMap(state.days);          // { "ГГГГ-ММ-ДД": true } — дни активности (для «серии»)
  state.pins = plainMap(state.pins);          // { rel: true } — закреплено
  state.collapsed = plainMap(state.collapsed); // { group: true } — свёрнутая группа в навигаторе
  state.cards = plainMap(state.cards);        // { cardId: {due,ivl,ease} } — интервальное повторение флеш-карт
  state.scroll = plainMap(state.scroll);      // { rel: scrollTop } — где остановился в каждом файле
  state.checks = plainMap(state.checks);      // { itemId: true } — отмеченные пункты чек-листов
  if (!Array.isArray(state.recent)) state.recent = [];  // [rel, …] — недавно открытые (для главного экрана)
  state.marks = plainMap(state.marks);        // { "rel#slug": "текст заголовка" } — закладки на разделы
  // Масштаб шрифта читалки — только конечное число в [0.8..1.6]. NaN/Infinity/строку/
  // подпорченное большое значение из хранилища приводим к 1, иначе zoom «взорвёт» текст.
  state.fs = (typeof state.fs === "number" && isFinite(state.fs)) ? Math.max(0.8, Math.min(1.6, state.fs)) : 1;
  if (typeof state.wide !== "boolean") state.wide = false;  // широкая колонка чтения
  if (typeof state.dense !== "boolean") state.dense = false; // плотный список файлов
  if (typeof state.rfont !== "string") state.rfont = "system"; // шрифт чтения (см. RFONTS)
  // Позиция и размер окна — числа (или отсутствуют). Строку/NaN из подпорченного
  // хранилища убираем: иначе clamp() даст NaN и окно откроется без размеров.
  ["x", "y", "w", "h"].forEach(function (k) {
    if (state[k] != null && (typeof state[k] !== "number" || !isFinite(state[k]))) delete state[k];
  });
  if (typeof state.last !== "string") delete state.last;   // последний открытый файл — только строкой
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  //  Мелкие утилиты.
  // ---------------------------------------------------------------------------
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
    var s = String(u).trim();
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
  var STICKERS = {"welcome":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOAAAADgCAYAAAAaLWrhAADKHElEQVR42uy9d7imVXX3/1l73+Upp5/pjSmAwICCwFClWbChRt8IWGLD3qKxt6ixJWg0McZuFAVjBxTRqIigIp0BpNcZppfTnnK3vdfvj32fYfQ175uivxfNWdd1LuAwc87z3M9ee7Xv97tgzuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszuZszv5QJnOPYM7+WMwYg8hvHllVxXs/93DmbM7+/3S83/Vn5iLgnM3ZH8D5ZiPc2rVrm4cffviKlStXLgVk06ZNW6+77rr7rr/++u5v/9k5m7M5+2+atRaAdevWDV188cVnd7qdGf0ty7Is/8lPfvJPxx9//OgfcyScszl7yEU+gGc/+9n7dTqdKVXVoijKXq/f7fX6M71eb6bf73fzvChn/9/LX/7yQ/d23Dmbszn7bzjfqaeeurAoi7Isy7LX683kRVEWeVFmWVZmWVbmeV4WeVH2er1uURS5quqzn/WsfeeccM7m7L/alBBBRBgZGTG33377z1RVawcri6Io8zwvnXOlc64sy7LM87wsi7Ls9/t951y5ZcuWO5YtWxaJyFw6Omdz9p+1KIoAeMUrXnHYrPOVRVkWeVGWRVlWVeWuveba8vLLf172er2yLF2IhEVR9nq9GVXVD37wg6ft/bPmbM5+7xHiT33kcMkll3zCe+9CnZeXeZ6X3nv3gfd/yC1bsrxctWJ1+fznvqDszHTKsijLoijKLMv6vvLunnvu+dXIyIjMPq85m7P/tIMZYzDGYK3FWksURb/xNfv93/U1+3f/2A7f7Ovdf7/90snJyR2+8i7P8zLLstJ779avX+/WrNqvXLNy3/LAhx1ULlu0rPzG179ROufKfr8f6sN+1ldVfc5znrPfH0MtOJck/z88bHs7mLUWEUFV96A7vPc453DOUVXVb3zNfv93fc3+XVVl9hDOOuZD2Slna7aD1q5dMDw8PK90ZSVizOw5veH69VRVRRRHdLpdPPDdC78X3qMxBgFV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","icon-start":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAAAAAAAAAAQCEeRdzAAAQAElEQVR4nO19CZhdxXXmOVV1731bv943dbfUQhtaQGgHSQiEwSZgbLMF2/GKJxt2sD0xXiZkPLE9iVmSTIw9JjaQYOIQMxhsMGCMWSUQCIR2tdaWWlJLrZZ6e/u791bVfKfue63uVgs73zfz6fVy+ES/fv3We/46dZb/nEKYlAkt4lx/gEk5tzIJgAkukwCY4DIJgAkukwCY4DIJgAkukwCY4DIJgAkukwCY4DIJgAkukwCY4DIJgAkukwCY4DIJgAkukwCY4DIJgAkukwCY4DIJgAkuExYAiDh4W2sNE1XERFM6/dMaUGtFWi+iQCMyIEzQ3fTfRJEJA4BA8Zr+MQBg4VAYKyqqdCaT1MlkApVWBAxZBIPWCiaCiAmkfGxqahRTp872amqbVWPTTCirr4XsQAYyiR7oH+iCvW3bYd+eHcLzXckY00qNfxCMewAwxkApxWbPmosf/NAtXry8rNIKOdfYNlujlW5WZVFAHjsu2HmvL1ux5Kn9Hdmexx9+lCWTW5BzrqQkozB+RUwA5eOFFy7X117/CRVx1G1c4NdtW7RwxkGhBgEayBvQEj4nEI/Omxm9+/b/9if3PfKjR+HwwXUMEdR49hHFeDb7pPy62in6sqtuhMpK8TBH/ikEFrh+yICR06c1MNTmPmFFmj3X/15NWf6ST3/2to8//2y92rTxcSY1jNu9QIxnh8+2HXb9TZ+TDXWRHwrkn9KAOQ0QEpy9wxg8FA45u5TSoBSen3fdT/m+v1IIlld++GPVVX35m265+rPJgQOsrW2zKlgTGG8yLgEQxHOaz5yzSjZNrbnGsdifacA8gg5FY9G7nWjkG5wpRSbAAguk9F4N5/Cfk1n27VwufyfnPO954jOC5Z6eMf9DT7S1bREAyodxKGJcrn6lIFZWA1f+wVXgWPB14Bbd79jCfiBeHv4a+tFwPovCCmdV2PEw59vogSNjkb6/lp4fVwC3C87A9/VXll7Q+MSGl2epnp69iMj0eAsPxx0Agg1eswULVsuKsvgcRLmcAdKW32uXOd9kOizssMZMheVFeBnIpIu2k0WlbQQIWbEI/+5AKv0JZLoK0VpWVg3zl1yyaOdvfrWXXmbc5YjGIQCMsMbmauVY3lzGQ45x8LhY54B1zMtaUbtc+VU2oEhZmPUdsGwJ0UhO5/LaEZZ13LLF657nXYeMi0wyOX/6zDk7hbCZ77uqADAYLzLuAFA00fGKOCjp1wRZPQDG2QlQAnyHQU5aLNQtIEPevwbwVZnOMw3gcRBOBlgWjw5GEvlcjcVDIEQIfN8tuBcwbmTcASBQkAU5rALu6CzhgTFK/kOFsFzwPQ0eKG1bGtEDYAIgHPc1+kIzrTCpKXzUcXotiiTCUZ6S6Qrw/TIASIwr5Y9DAFCxh/L9FUplmwDYiX0U5jHOwHX95UmtwuWRrB9SDktFAOyEhwSQRBZ1BZeYE56UvW5UKr2SMQTXlVoj7qqyHACo0ACdCASlyS2gVIXqPJS6nauPe0twdfi5zakBf7ew7POlkq25gfyfljH4X0pD2FJKOU4a3TyATpUrNyZ5LuvmEsnkHyulp3PGSM37o1G+bX9XA/p+rQ6sy+ky8niQcWYBtNkCAPo0rppmNTW1eHt6T/4QwPonROZKN3d3fwK6KuPs55l0KpKxbc0Fh1zqECTSmJXKul4D3I2IngZtcS5+HObazcxeIgDmSQavgBysII8PGXcACKzzdjjf+w+/teEitmtH1/e1wluQqZXImPJ8/9Ge/vSBTCaLWmfBsgR4rguWZSsmYKbJ/CMJewPR/wdLWXzVpVH106pbQff+bwCU42kHGE8AQACmQasmgLorYMXUmNa+5mGb+VzALVLhc6j1PK20lFrNiIQj5lmkbyHsIHrQSmqjfNyNyD4GKi8TSV8srTmmqq9YAj2PzwXkbaB9Xthqxr6MFwBQpA9Ce9qHO3DV3dfDZ26shnc3tkmmfScc40fTGXkHevgcgPYpnef7FNIPi+kK+wcyx2Jf5jx0mCvPOdrd5c3bshU/9IVm/S+P/xCYfzlKJNrQ+MgHjAcAIIAFXHjg+6uQL1sGd68dAA5TATiiVAql6wOzHam8PGhTAQDD/8KC/k5DQCs0WUOUvs8hGqvEluY87tzZqZe2PIxb//Ij+t2//yvg+D9RgqVB+2MeBGJcKN/yQHqtIK58Fh7/UQrqeo7yt0+9izu3b/dCkUgupwBsi2dcWu20ygcJoRoKcSOeJopStpflOM9DJu3khFMFGvvs/q3H9ZevfkHepe7UO/5xHwj+GPiK07YxpkEwlgGAgBYAI+XPB7b0N/DYo2E+68h29ezr2/xcLg9WKFLJeeQSpthKmXbfj4zCxNNuvDZ6GxLXERAQtev6/8gZe1Gj+4bvwVtSsRPh2ipwjuTZXX+d5J/I/kz23b8cOXwFFCMM0OsakumYkzEKAHLS6Zp7oOUMWHPt34jLb9mqkr884D/do5kdDr3PCYdu0Upe7XuyBSl4C1Y+rfZA8+Z3CBZvYS+gexkgcQGXSimX0nMYY8dB2c9p0P92PO2/En3kUf/vbm5md7t/xtofikpQfw6MKVCKI4AccyAYgwBgwLjSipxw8Wds2R/exm654jde/oTkR3XZJ6NR5wug9XJ6AGmDMaR9new0I/eeFE8p3kK0pwsIMIAIMGGo4xTr0UOYlLIRQN/KmH2rRny7ByLftzYe+rc7rnrQ/8WsT4kX78wpX35Z01O0HnsgGGMA4IBMIuk2XHaX9YGvf8C7dOprKt2J10A4/s0wWsuJC4CIinMupVL0/ZjSmkmfAKE1MXuI8Ss4BykJF4HifSlBSWU8AM4Y51xwZGQBkAjFUmtFFJJlNsLDbjj2eXUE/vuHYj98ftF3psGrz9xrbVh/lw94EhA4am1CxDEBhDEDAEQORNvXSsDsed+1bvyjVq8l/mxt6mj8Xh6Jf4pce6J2GuOOyKRSzHVdo+BoJAw1jfVQU1MFlRXlEI1GgHNuftKKT6XTQOzfdDoD/QMJPHWqF3p6+iCdyRK5BLlggjFOOwhZBWUzXC4d+eu0W/NQbajzjo9+Ot6r9V32m69/0dOQhLHUVyDGjPLNqmpi77/6v7BrPxz1vNyBqxNu9Y/sGG8xSy4w35x4e/l8HijRM312C0xvbYHa2mqIRqMgODdOAK10y7Kgo+MwZHN5mDXrPNMRxKgCRCkeKSGTycLJU73QfrADOjqOmt9t22KMM6aUlkQpZRbeKv34Ffn+zK033MRfrqn/kvXmy/fJU339Y6a5ZAwAIFC+YJXsuo//Ja6+uMzPJhJ3cLvqbsc2obsPiILUn83lzKpesvhCmD3rPCgjzj8g+NIH3/fB97zA0WNMu54Hd93zT9Dfn4D7vncXlMVimM+7QUIREUIhx4Bn+vQWSAwkYfeeA7CrbS9ksjltWYLT47TWHhe81YfoC56X/NzKK5sfnjrnr6wH77lL5v1TMBYoZCUOAAacS5CyCucuexBWrT4kvb70vSJS9pec0X5AyuRCSmku9IUXzMPFFy2AeLzMKNw1CiUIFGL8QuaPzH8qlQLP88CymDH95eVxQN+gw7wzlZENIEAbUF28YjHMnTsL3t283QCBXk9wbpE7KgQi42X/qtOZhtZpobsuWn2neOuVr0nG8iBlaWcMSxgA5IBpkBKwqvZ77A9vzEpM4PdFOPJ5huBRCp8zhnnX01WV5bB61TJoaW4Cz/cgl8sZRZLDN/LSB66CNlZACA7plH+a7j2kYzgIDExMYLYEAlQkHILL11yCrdOaYd36jTCQSIBj21xS6xFo3+eh7/J02r7mhtpvJ3o+K9q23+/TrkJgKlURpbzvK+WDsP6Uf+ZPa/yK6LZv59zKzwtulG+RmTb798zpsObSFUgmm7YAur+4ike97IVWn3A4DJEIFYQQKsrLTUQwstA7+DvlA/A0EKZNazYO5SuvbtAHDx3GkGOTX4BCoC9l2bciXtfJj37y4vt/8A+7rO6u1zxyIJWJW0tPROk6fZRn/7B16+1/4E1v3PG5TLb8TsvWZuUzZJDL5+GihQtg1cqlSCEemXta8b/ztQtUL8uy8Kt3fFH7UmI0FtG+R/b/NASGggFHtJfnc3kIOQ5c/YG18Nprb+pdbXvRdixUSnHGtJSq7IdxO9nxJ7fd/Nw/3d1jJVM7vdOObGmJKF1Wz3R++Yc/7y2Ye2BxdiD2A2EhLVxOZj+Xd/XiRRfiqkuWFPbpoA+w2PA/dOUPyfqfTvwBmP2/vqbWrOxULmtyRCNl6ACBoffRe1HegDJLa9eupIyS3rFzN4Qcm0BAYSO4rnh4SoO34P0f/lL3z3/6TY54TAad6aXlFJYcAArZWly64jZ57RUHndyA/wgXIQdRU8s2z+VcPW/uLCDl5/JuoKCC8s5qwkfc9pWCynAMfrDxV5B18/CV1TdCfzYJZKqLUgTRqD5EkFY0lsRzPbzs0hWa/I72gx3atixKPPl2yKpNJb37L1nOb9i3407ctvU2SjyW3DCSkgJA0UxObV0irvtYxJP5zLcsJzYPUXuccUEOX3NTg9nz8643qPz/LEnLYhxOZRLwk50vQ156+tNLrsIIt0Bq8gOo+2O45Rgqxd+LkYVJKWuNay9bqfv6B6C/fwCEEAJAe8jD13Pe++mrbpr68K62j1i++wuPwtpSIpOUFgCYpDZtXt/6GS/E9QJgoS8WcvnkaUM45MDll6005pqAQr7AqIp5j8CLlBwPReGpHW9D10CPWcXP7t8En75gLfRlU+RgDP9MQ15/6O3B9yPn0JeUN8DLLr0Ynn7mheJTmeCopRv71pTqk0/MWnB9su3dXyLjMqhjlIiUEAAENXIAwGdx8UXngaV23qmsaocSPciYICdv5SVLobKyHLLZ3LA9vygjV23Qx3V6ezD7NyDkfA9+vuv1wioGeGLXerh57krij5jnGJtSeMJQYJ1NKNQjp7SlZQosvHAevLNpK4RDIa7Jk+XWVC7dL69ZU/6t/dvXCs97qaQcwhIBAIVuPmjl8LUfXO7PnrF/kfTiNzAuqS1bkKPXWF8Lc+fMBKrz0/77u5y14usGpd/gMWSuy+wwrD/SBpuO7YOQsGlXhnc798NbnXthTcs8SLpZA4ShJmSo8zji1QetAX0mAulFC+fDvn0HIZvNUuGJDBh4nn3b/Dld3//IzRf1/p9/fwlLiTsgSqejV0N9w3K2ciWXMgd/zm1uBfw9ExbAosUXmAYP8H1acsMu/uj7dbHSe/qvAQ0A4edtb4AvPUBhmWf7SsJjO9fBZVMXnPnZRvws3h5qGYqvS7kEyi1ceOE8vX79W+CEHCoI+FyI+lw2fcO0lukPRCPniXSm3SuVWkFJAKDgGrMrPrjQi4RlHWrnhiBzi9ys/sY6mDa1CVxy/M4S65+5pApmvPBX0+YlbNjbcwxeat8KUTsEkoqHGjFqO/rFA5thb28nTC+vx5zpARzduRym+OLtwgOp6dPx2wAAEABJREFUfEwU81kzW3Hrtp1mq6K0s/l6WnymosZ5YOa8xWrrO+0lkx8WpTLNo6qilU2ZPlv5mYEPhKJV1WZqDzDaR+H82TPMhSwma0aLzc8ugY2gMXBhy4Zf7tkIp1L9UBWOga+pnKC0oN7xXBp+sedN+MbKmyDj5UEMHST5HtvAyPcnK1AWi8F506fB1q07wRKCKa00F9YKLjMLr/yDi7Ye3vcy7xvokcXvPsEBQKZQQmXjMohHQiAy+Y8YU6+1ptQrVfQo9ep5VPQbrvzRkj6jWgLQYHEB3ekBeGrPmxCxHJDmwqN5RboZFSF4qu0t+Nyi98PQkLAov7eaiBMkJZzX2gI7d+0J7kH0icAoNLuqMlq5NRKtYwSAUmg1P+cAKOTIcfklDT56mUphhynOM6w/MvlTGushFo2aGv/Q4s5ol27k33BI4iceisAv926Eg33HdIUdQwnFmJ8IPwAhZsHBvi584cBm+PiCNSYkpEliv1+OYUi0gQie70NNbTVUVVZAX18/MM5N6Op5/pXKse+NxC0Fx0a2JUxAABRNYG1NJW+sbfC5Zhdw22qg2i4a/1kbABTTtEOv1dnSvaM9jvIFWenB4zvXmySQpswN/U3Rtl3MPQYJop/tXKevP/9i5CbHMBgUnmH+h/QSDPsD3aTqXyhkQ119jT55sgds2r+AOpCsCyRCRbx6eT/AtnO//M81AIqSSFgIygGB3oWAYbqoVGG1LGFpqrpJRdtlMaQbXrAZGQmMVBbt/bFC6Lelqx0iwjFqlaR2gcTcQVTagCBi2RQS4ptDQkKT8h3lMw9q7ywFJPpbbU21IaCY3wljTDQKnZheWbdgM4CDAPmJDYCgOCIh783WUjeBJY7PN20WxMI0IVUYY7GoIWsaGRn/DwHEyNU/pOHLaIDCPE96QEr2tIRICiCaJI6hhEylgEzUXAwttcQn9mzQl0+7INgcfs8887CHFYZOV1aUI+dm5CwBWDIuiN8ys6YqvBmgiml9/JyPnDnHW0CwqO3QLC1CtN+K1kJzjknQUEztOI5ZxUEPR3ChBit3o1Twht5j6v6WDbt7jsErB7ZCTNhE5oP6dgm1h3LEMQ7aBLgLJ1o4dp9n6RiG9Ev7N8PuxUdgekU95H1v2Gj5ke81GCHQIOriH3RgeYhJRGUBcgoZNQ8AEpFpelWcBpDMBK2PD6l+TuAtoLE2pOvKk8T0qDEfqOAbEAOHcwaeK0FYZtSbudh0QQ2L53cUgkgJESsEzx18F5L5NMQjUYgedbHxoKs9geAFYDIuwJSDHrpxC1N1XJPj9sy+t+Frq2+GrJcHjsOdwWIbScAXKjSTcaaDaiJ5GDR80nAONBFV0ulMkIUix5NHG+qrBESjTZBOn3tH8BxbgMD9amxxVFlch5JJZmbzFFecbVMyEMyFTCaT6Lqe6eYoj5cBDXagIsxoVgAKSnGEBQcHuuHftr2klWCY0B42drnaB2ViAEaLlywAvQRnUHHMg854DnSIw2PtG+ATC9fqMhFCfwTYCkaq8D5Azp0hiSRT/QZQjmNDLBYzn88SIsj4UZbINCWxKqesH86fH8FNG4uvABPbAoDuhr5Ejlxlys0W+ze1MaOxKDzzzPPw4wf+VUciYQqldHNzE9z5V3egbVlntQS0qiiM60sO6EtEM0QbZ2kmBByEdyCn09RMDsZwF+ZB5JXU5V4I/mjKcgrbIJHNwIm+XqhsmAq+KvAOiq89+B7k2QsqAetvffu70NvbB7Ztm5D1y1/6AixftjjYGhRNlwkyk0yxaB59mDlPw6aNxWLFhAVAcFnzXj9oxjUH30zmpgs2LEOGSA4hhJwQKJmFcDgUhJBDXmVk1c5Qt3wPplc1wCdnXgrpdJqmgMDPYvvxSH9S0wwgWajLkhaoHjC1vAquq1sY0MtrozCjuhHcET7AaLkHAhD5K9ksjSIG04NAk0eINUTt6QbNhXfSjNISHA4d6A4CmHO8B5SEBcjkazEUDvmQTdHIpoJ5ReP9p1JpuPyy1XDx8qVInT6EENoCoOALDAUCybDbNDDasbCsvhI627p1hGtYvGghdJ3oMuROLmjPRjS3OdcXXXQBJPwcpHJpbJndqrktgvrDKKFeMY9IZp4+z//45jcgk84Y4BJAQ+GQTqfSFEZqyjUUPhAVsgZCWkGqvyvgs5zjTeAch4HBz3SiGr28dplWSatQu6VrlsnmTChGCiJ/gPZWWjHFQxxGKn+kGIfRl9BYXw8dBw+j73owbVqLXnPpanhjw5tUvjVKsBwbVl68ApumNJpyczwWg4a6WqTaQ1H3o/ECisVG+nz0WcrKYuZ+2paIKkYkFtqyiIJeHDAm8/IUzZaoqa4cdg0msgXQTPfwrOupMmF1Uas2bZtUSadqGpE3TSMnNX0W18somcFRhcCiAj+iobEeOg51QC6bw7lzZuvmpinQ09tLFF6khA05ba7n0+N145QGWsH4Xqt/8MMPASIBUxctj2VBOpMxvEWKZAqlB3rK8awkUunZSGcTCgDBl08k9mE6vRKiZfn9XJMNoM4NNACgrp3KygpQxAMYNJpnvk6RyzdSTGpWSpgypRE6j3YaHbiui5FIWMfj00zChnL3BDT6GzlxUxobDNX8bKTS0b/FaX6iOYSCM+jvGyDrgJzbBuemK4n5B9yshMMdbec8C1gCW0BwDfr7DuuTPRrqymUbxc+UhqcULHnT1KVbW1NlRryOHvIFqZizXs3CllFRHofq6io4efIUWMIy/kXOzwcp2mAQBAEDmpoaMVYWKwDiTLbxf0Zr3fSlaPxE8EW59P2cD2rf0aOdcOTwURX4fxPYAhQdYMc+qcNWDygV20yZUwRq9gwuzrHjJ+D8OTNGPHNk9v+9rUDhzSh8RCrOBCcD0kC4oS9puoOhuaXpDKbOe9HBRvs9AJMHJ06cJPM/GGtKL78/z/mhWMhi9bU1+sTJUwAT3QIQHyDv5lXHvgMwtXHxbi3dDhDh6aQFy7JY57ETpjWb4u0zKF8jjPRgunikpUA0pri6pto0gSYGEgWmjjbPI1InOXJVVVVQUVFhHMeR6d/h1b8i0E5/hqG5AWo9P3GiG/r6+6kWQFlBvzCZ7M3KeFge6Ouyevv6/RIIAs61DzBoBfTB/dutS1YvyzCdeZnb4elKa0Xdn8SzP9rZBbNnTTe9gEH7VzF2HlqKPbM+gGcoRhhfgFK9AaD06VFxGmDq1GYDBgoyzrrnD4YFZ1Ymi+9DSm8/eFh7no/UQkaDRgxUGDyT6s/Am29s0uR3lMLZhOccAKZzFgH37GnTuzpysGSueEJLdSvy4KKRQvbsPQAzZ7SeWZQ5q1M4/CHFder7Euob6qDj0GHjX0BhLhCt+HhZGZCFoMf8XgXA4ftHwfqAsSzJZBra2zuKVos0zJXS3Sj0+radFuzde5TeRJdC1/A5BwBdNYZcK51Su95+FRbOve63KLP7OHdmETHEtm1GFqDzWBc0TWkwjlpADP0967RFCY6RI74+UJi3b98BY6qLoeKU5kajMCJ1no14evavEKR5KXUdsm3Ysm2XGTUTCYeJ2EBja5iS3i/yvji1b8cBC6DXK5UDCUsAAAUrAKB3vLvVOn75h/KtTf6/SOn8Ledm9Zjs2uYtO3HKlPrCyjtbRHBaRttcyYJQeraxscGMh9FBnl5HIhFsaKgHKYOEztnbQkcx/0WfwAwsoNWfgl279poCVkHBNJdG+TL/YCoThu7jvyy4Kud8+y8dAJgyqemcPCi3bk9CdZPzcFR5X9dMlFEI59gWHDl6TO/d247UGEoZwtOL9HdYghF7Nb0ekUxqa2ug6/gJ89fm+jpjGQaty9nov4NvWWgcCTLWg7Rzy7bgjQ3vQDKVMiNmpDRHzVkA8mllORsP7N5qtR/cbxIapdATUEIAgCIxQu/Y9Ja18n3XHYtax3+gVewb1BUsleJCcP3mxs26saHOxOk074cqrKNpa1jZdoSlMIkhraG5uVlTmEartqmp0WwDpwn+7xVunvkr5RRC4RC0tx+GnW17Tcra5DMQme+DEpj+7tHeWfDrZ//FEJ5KgQ5ecgCgFUHXv7fnSbln+3JYeYn9XZWVnxC2aFE0eYFzRu1WL7+6Aa679kqzUotJnMGE+lkYQsMutSng+FBdU4llZWWaikDlFXGaMzBiRoA+qzUJsn2nqV+08gcGErDu9bcC5rKp+2uJyITy0z9JhMJvPPX4gJVKbvHJwJxrz78kARBccK4BsvqXjz4iahvuSCxoPfEV1xc/44zmLii0bRs7j3Xp19a/BWsvX2mKOYMgGPFK8B5WvEDRhkWLFwY9fa43ivJHeXZxmHQhr29CPqJ8+RJ+++J6TZVL2zKTLIzn73nqVDTmfu2VjYvhWNsXJOe+lnKyPfzsEKCWb5qnIzf5rz2/Vcz9/MzHVC77YWY7H0dATyklaG/d1bYPbMuGVauWmobM0UAwFAjDdHiayKGTiaTxCYjDP3xEzNlTzkGfR7CKqZxMr/X8C69B14luGhhlKoDGwQcUqLK3J/O1XW+/9JYFsMVXJThKtoQsQCDF2HjfjkfVjgN/A+c35f5Y+dZiJtj5oMCXWgpyCjdv3WHm/61Zvdzs3yZ7d0b4duZKLlK5SXH33EtzAvvh3nv+FkJh47QN2UWGVf4Hf5gSs1KmaOS5Hvz6hVfgyJFOmhlEZooe5AFoS3rqnyNh79HD3b123+F7iH4YTB8uMSk5AFBEYLJx6pDauqHNmvuZmZn8yYGbuA6/agtRTVM6aZRIOOTo7TvaMJXKaNoOIpEQEi8vSO68x0ou0LgGEgns7+/XmWwW+gcGoCnWCLJ4isgwGZJhJLInAFB839PTiy+8uA66T54KmMvKMJd9RLC0wtcslvpCr9fKfvvrd3ypu+gjk1sApSYlCACyAsHPd9Y/5M0672579TJvZyJt36w4/w19ZorepZTMsW04eOgw9P9iAC9dvbzQQ0gnh5gBTu9JGKUahGVZoNOZwZrA2SIKky8ohHnk5LXt3gcb3nxHZ7I5k+otKJ9WuaW03qmkvj4UBf/ff9zEd2/6hgocv5Jb/KULgIAqR2zabvzZT094kVkX28tq3nm5PwXXWLZ4EoFHafqG0lo4jo3JZBKeefZFM8lz8aIFUFFRPgiE0xnj04olZdC4GWFZYDsOkUEIUcHmPvgRgvQu/SOgUH6fKok0/eNA+2GkugKRPgKiCnicMcvz/W1uTl1ZW5nufaV9sbVn0499xL2glCDjAKUoJQqAICykY12V/xA83v4l78q1CVtu7HjBRf5BX6rHELGWEntaKWFa7wBg5849+tChI3D+nJk4Z84MQyQJagB+wNYpbMFEECGlfvH225AytfE41f+DLCCFdZRfIO+eJonS+PkTJ3ugbdde2HfgECWLNEUjwWfU1PJDy9+SSr4KADdWRPyefqfK3rn5qKfhJ4VvU7rzYksWAOQLEHuWwR4YeO0VqLrvOi908CFnz6m0/kAAAAtoSURBVPHkK9wOr+ScP6akXETc0YJvxWzHRirybHxns2nNbmlpgtbWZmisr4NoLGKSPkXKFpntGTNajc0na0HRBTWRkrGniCCRSGJXVzccPHQEjh49BnnXNQke8vSp358m0qMZUk0scvZIPgefE9z3LJaw3+y7zNv6xtPAwQOp6SF+SSq/xAFAGDDNG6AO/AdsOvJ++KMVC93dT77kRJ3QfgC22hfibt/zPl9IBEma7U9DgGkMLOX89+49ALv37IeyWFRXV1ciWYTKirhpOQs5dpCRo+BTKpMLSKXSZtRbb18/9Pb20+w/kx8gc08AKZw04tOd5EsC6l6Ls68hUw/Ydp7bjFu1rdO9I7+uBkg/ElxdcixLWEobAHS5BQ3x2Qbrnvbgv365BRYuuNA90L7f4rwiF7L4F8BO/yLvyrs9V5E1MPMZCt3exiKQ7aUVfrTzuO440mmYHMTSoW0DC3s+WQOaOE7JJkPj5tyUdcnBM9yhQMjck8EQlPq1HfFkyLa+ojzVrsGzs25Otk5t9ddecyN88cEdALCnMArKAKA0GKBjDwBGkRpgL4QT21GpVmhoaIBTvd2yp/sEQqjBsaLh35ZJdUkq4X1SSu8O6cvZhdYiqrf55oRHREazge1gVOfQeh8GrV1Cc27GTMOQI6RIgukViNwcRqHpoAmxToTE34VjoefIPqVSoRD3T3qJRILsA02c1+lOd/QvU4JS8gAIikRJsOF1CNuLobYuA6srV+u3N26EQ4fbvTk1851sLqdCVeIBrcse9zz/D/sHEp+QSq1USgvD0A2GP6qiQov1QV04Mo4c/oLyDbEQNeWkTeDPTYOKUmkE9UIsWvZgeTz+LB1H6XmuU1MT172sz+s83KNrqmuhZdo0TWz/xthR6AnIZmYGEZSwlDgATh/X3vHiI1p/6y+wvr7eePXXXHutfvHFF/HE8U5vSuMM1p/i4XA4nQ6H7R/ZFn9AMViSzXjXZDPZK6VSFyilyqkzc7BFa9hkDz2MT1joQj5uO/a7kXD4ecsSL3Db2h0NO+Dlkk7KrcbqcvQ9d0B3HevSqXQW6GySvfsP4OJly3XLtE2aNoHC2XZQylLyACjqaMaCJTDQ3wsdh49Aa2srlJeXm5n/3Sd7oK6uXtc21nvJfpcJpqLlFdVa+urteES9rZT7nXQu1+xl8wuEHZrv+XKa6+UalVTlvq+o55wyi3kO0BuOhI8gYLtWflssGt0N3Om2LG5OEbMtHXXzdPZoxG9p4crPZKCvjzqXKFqR5pCKbTt2wmXHOuCaq9fgcw8Rqkoz9h9TACgmZ5rqqk0b9sDAgPnX19cH+/btg6bGRuP6xS2JomoKZNN9vs09lKjDjOa/MEuGItGjnut1MAbPBOVgTWfKMWoIpeqt4KgotmPCMifBcuGA7aCV91iMfANHuFJ5rvQF1wLjKLMInEegspJDNpsx5E4CgOVJ6D5xDBaetwoAKhB0f8HMlO4uUPoAKNiAzkPtECsrM1m+devWIXX71tXVG6p3JBxFYdkQUwgcomiLoO+KXDca0ae0sEO2b1EAAKCYVHSaEz2AzvukTYaR42cMP2OM5hNKOiLOEbSB09EzERChCIapECFd7Xo0wZjT4FnV3DwTGpvymEokdUfHIdi9Zy+sWH2xjpafB+mBdwcHYZWqlDgAiKJNKXYH3nf1Tfj8r5/DQ4ePQE11HWtoaOJ2KORYglucWzYAs2wBdqgiJLRGmspF+z0jC01jOrW2QlRODgI6MxSKFxx+GWz75n+aIVOMWHyBY0DooO5eL6jygYsY9iJaS9/3pZt3KX3g+i76jFn+1GlT5eGOQ9oWA7Bo8WJY//K75myi4IDK0pSSBkBx9dQ3zEHtC2w/2C4aGqaGIpFQWFhWWHAeFlxEGMMwMqSecUdJxWjZBoomy25mDVjUr6k1AUHR6qdjxjCYEGhYY8TeMR1i5LhRKphK/uYESsYocPSQ0bBHcwixpN85524oHMpalp8SAlOIKplOy3S8vDr32iu/9ZlttD5k3nhpSkkDoHjx5s+rxYGBQ3Z1VXU556zKtu2YJbhDsxikVFGldQikDGmtbTq8yThmpHSlMfhd20EEYE4WZYUBFDqgblHyn1a5OVqYsoNmdKBJEhKni3FT7aE7aXtAOr8AmWYINDYkpbXOCSESoVC4Vyvdlw1nE8lkIlkZzebMNyhl+1/6AAiESKB0XIwvJaX2bCll2PN9RwiIatRx1Ejtt4JCfk2K1ppO8QoTlVAFdVirsOLzZNeVNOU5KGzOpHRNk0PpnOBg9ZsCT3DoJK1/RG6SzObFGZV3qeFfYHD8h0kSMWQOIloMmZBKiuaGWgOoUuL/jVkArHvtNT1r5uzcBRfM7+3p6cnV1talEVkEAZNCYBoQw8ZcG8vNuAbtKEVmHx06Lpqoe4X+Ap+AoISmqpAXDKQGq3hkLL0C5+QEApEETaVPa/CDFLNJEtD5BWbmH4CmdF9KKZX1XDfluvmBVDqdGujvzUrfy61bv44STyXFAB5zAChy/fr6+vR9931Pfuxjt2euvnpJ7nBH+0C8vNIuLy8POYGQEi1EOlnITBinlh8a0EvbBJ3/gIUCDhYIJeYkajQNCQSOwtHxiOQLKMbQN7VeDYqm1FFAbzrYiNNFJw8r8KSUrlKUECTJu11dJ/PpVK/fNH22uv+h/9Dbtm0x5JFJC/D/AARBu3UeHn74Hj1v/sPqhpuvU/vbdngnT/VkTGsZ56w8Hue27XCyylzQboCMSB6cnkxa1ZIQIZSp6Zi8P5LTH+AkSAuaZD6S2yAlY1xZnKmc7wctHObUaRpgLrXn5mQul1UDA/2KeASum4Xp01v1ZZe9H7557w/hN0/+hBpCS6L3b0xbgKLQKjJ9AErB1776af38KzfhVWuWwkc/+lFN5zh3dh5Tbbt361w26zMmzFgWas2iQRDpdBorKqsgFo2g7+eIWm6Yx0GaNgyAxCr2UfqgiSvIBdcKNaQT3Xqgv0fHK2pQSjoeLmdy+7lcBixh+vr0nDmzYNGii/RAwoOnn3oJvvN3fw5vvfEkOYjGtJR6BDBmAEBCyg+OcNXw0rOP65eefRyeevpXcPtf3I4rVizV1OlDZV+THu4+UWj6EHQb9u7dCwMDPbqyshIymQxms1lT7kXk6Lp5YviYknEmkzZsX3O+gGXrmTNnQU9Pj05nBkzqmTgBs2cv0c3NLYVJplF4+Kcvw/33/z289cYzQSOgGWBZiADHgIwZABgxhIygBZv27A2vr4cNr7+unbADq1atgRYa/NRzCpYtW6ZDoTAeOXJYz549G1avXm3qB0QBr62tNQonZR8/1gFOyIaa6gaIx+Nw5GgnAQRqauqguroaDh06aIZH0WNXrV4NnZ0n4KGHHtAb3njdjK7p7k5BZ6c5FAKEYKB0MDZuLMnYAkBBimPiCAh0O5/NwUu/JcJwIL/61a/AsiLa8zL0K3X/wtq1a2HLli2wfPkKmD9vLrTOOB/fd8XHIZv14Hh3GrbvPwjTm2sheSoD93z1q3rJ8ovxvvvu0ye7jsP08+ZA5dRp0H0kCVs2Pj3ss5DiKZ9UJKCONRmTAChKcVAkydCDo82Rrp4p0ph/tKqfeeYZ87cnn3wCnnwyeBjAlxCAThBPaIA8UEZZehTd5eDBhx6inJEp557qOQXw9uvmScQOHiwnG8Jpacf54xoAJEVFFK1CUcyxropKtab1fDAkC4KCwEHzfZriRdSNQsePlxu0LLTdBG1egyGiWekj32esy5gHwNlkaPKFbhcVN1yBONgQUpzjSE8b+pigKcTcgvEo4xYAv5/oYYot4YTd/zeZ4ACYlEkATHCZBMAEl0kATHCZBMAEl0kATHCZBMAEl0kATHCZBMAEl0kATHCZBMAEl0kATHD5vywOn90IUaD0AAAAAElFTkSuQmCC","icon-route":"data:image/png;base64,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","icon-ref":"data:image/png;base64,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","icon-examples":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAAAAAAAAAAQCEeRdzAAAQAElEQVR4nO29B5hcV5UuunY6p6o6qFsdlJOlllrBEdtyUFYrORBm4N7HMDPEBwzMvfPAGDDBOMJcExzgATME2wSDBzAGnJRayUGOsmVbsRUsK3cOlc45e+/7/fucasuMAd87tBVa+7PcoapPVZ219gr/+tfajE6vQb3k8X4Dp9fxXacVYJCv0wowyNdpBRjk67QCDPJ1WgEG+TqtAIN8nVaAQb5OK8AgX6cVYJCv0wowyNdpBRjk67QCDPJ1WgEG+TqtAIN8nVaAQb5OK8AgX6cVYJCv0wowyNdgUwB2zPf2OL6PE2bJQSr80s+WBvk6FRXg/1SwLPn6l/7mlFSYU1EB/pSw7F8QNvsLAj7lhH8qK8AbrTcSPqNBvk5FBbBvsKPfSNDsz/zulNztg0UB3kzw90bL0iBcp6oCsD8h7P44gLH4IWsHpdxPeQX4S8taa9lgjPoHuwL8KctAjDH2f2ANTplYQZ7iaV/psdc9BbKGwBlj/a4ADxlr+l0CTMSfeb2TXvCnmgK8bsUC5gTZGmMScx8LlHNGxtg/t9stLiE4J8Z5ohDMfXXf4+upI/+TXQEYcc4hVCcRY4z7ZSx03W+mGVPWWkOMaQifhlRW2uGjJrCJo4dTw5RJ1JnL0/4d7XTo1RY6fPAg9ZkshTrABd/wVYWA5RDue61hNd74eSfDOikVIBY6pyiKyBgI9XUPWynLafK0qXT29Cn0i1/8jD7+8U/QggXz2Hve8y47YsQIam5uZo2Njf/pup1Hu6h1fysrry2nzTt3ss1PP0VPbHzMSn8427ennQ4daqFDB7dTpHNEFB3zeoK0tielIpw0CgBfzbkgayF0k+x2j86cfgGddeEy1jg5YxsnjXF+vaZmGF06exYpQfS3f/tOdsEF59PYsePo3e9+N733ve9NhG/p1Vf308iRI50ydXS0U019LVXXV1FXdxctXTiH5s+aSR/JfojB0uzYvp8ibamqPEP7X22nl3bsp81bnqVHfv9Lam3b496jkpIirU+q1PIkUADGpBQWu11rt+vY6DFn0gfe/3H623e/g6ZPH0WHDr5K3d2dnIjZfa/uZ7t276AozNOkhgY7b948OnToMG3fvp3uuusuJqWkV155hTZv3sy2bt1KZ5xxhhPYwYMH6cILL7Ttbe1sx84dlEqlKAgCEkJQGBLTOk/Y6UNramxtbQ1dcnE9/c27Pmpvuu4z7Lf3NtNVn/uEDaNW947xvEibUthxQq8TWgE4F4xZDVPPiFL0gQ/8D/rUpz9Bo0YPI8kLtHXrFvbTnzxMPT0hs9YwpRhLpzMkPJ8OHjxMBw4eslpHLorjQlijtYUCFPJ5qqqu4uecfTbL5fMW1mTy5Ml04MABsoaxSZMmMfh2WAatIxZGLr5gRke2WCzYA/vbzM6W/baYf4Jqa6voincusIvf/gL7+T0P0Lf+9VqbLx527x+vBcU9kdcJqQAw41JKFoah+/mKd32Ebvv6LTRxYjVteu5pWrn8CXboUDsbUlnBKodUsYoKzqXgTCrOLXFGlhClWSk4hKuRDXh+iimJwI2RkNL9OgxDNnToUJfxGW1YJlOGZJEZazl2sI4iXIZZY1mkDccTjS0zOoq0NtZwNsL29WXNfff/wU48Y5z92Aeb7NuvWMp++OPv2R9873854XOBBIS7WOVEXCecAsDkaq0Jwh81Yhr94N7f0LLZjbTx8Q300EMvsCDUvKZmKB83bjQXgnPGSAgpOWeShOCCc85gOdwXLixjFOBJeLJSAhpgw0hrzpTJZMocHIjHrSVuGfI9J2imtbZxBkncGMudBbAGCmWiMNJRFDjrUllZEZWVlenOjl5z76/ut2Vlwnz+Mx+i//fD76Pbv/Ud+/N7vo9cgZRSFMKUnGAppDwRhU9Uxj71L1fTP3/qE7Sv5Xl2150bqbM7x+vr6nhZmc+V8qSUSmJByiVAR0Aj8AshWKwcEC9TQnAjJLecwU4gVIB/Ji2EMNoY7jJFxiBomA4AQsxoi8egAcqSxRNtrBTGaC/SWvsaZkDrSIWhjpQS0dCactPe0al//ev79ejRI+ztt91AH/r4J+iDH/3/aN+2Zgv1s1b8sTU4rpDzCaMAnuch6GJ/87cfoX/7/veotlbSfff9mu3YuZuNGzuOjxtSJfyUJ5X0hOd5yvMUhK8Y4+4zWAvcxsmRIwiD/LngAIQU5yLi8A7EYAWIC4SLwiolTRDCQFjOGIfQWRiFzBjShmsryQFGUsMCcM2EYIgNkPZFxtgQyoD4IYJL0F4QBEE0rF6FFeXlrK29w/zgx3eZt513pn3pudX2y5+/gd1+x1csrIEQsj+gPd4mYSAV4E1/OKWki7gvvugK+s2vf0BPPvko/fjHT7CRo0bzxilThBBSZDJpz/dTEKbkgrudzxmXjDFljJHYqUQs5JzhznJjrRKMaymlllJIzqULKpWCTC2EoIXgxAUX1hjOOIPpJxlJG2ln6K2ODA+jSBodKrJkGBMa2mLIIJzwSMrQAchGGsQQvu/zoFjkQkju+36Uy1XpZ5/bottaW+m226+1yy77R/bf3nM59fRuSVxCHOOcigrwpoWP3QrfOGfB37EH7v8hbdiwjj3zzCY2btxY7nm+UMoT5eXlnu97Hsw+41xxxhTcOuQYRTplreVAZnr7+kZHUVSupGqvqqo8aoxJ4X0ILiKphBVCWqC78PpSCgPX7/SISOCXcPpCWGJhaKPIUhQZqbWWjFGhty9X29eXrZNK9lRWlO+zxDzOyBdCFQUiBGFJWgtlDaEA+dgfhZMnT6Qjh4/q3/3ufrpw5nn23nt/Qf/wwY9Q25Gn43Qx0qekArzJne9RGAa06J0fY4/89vu0ZfMm2rJ1OzvjjAkw0jKTKZPpdEr5ni+VpyRMOGPMRXzWMBFEoQ9ovrcvW71p00ufPHzkyJwwjMqE4L2TGyY+fM7ZM+7kXGQ9j5TgwgjBQwSGsWyIIfhnzAUEiCOENdaGUcQQQ0SRFsYYXiwG6rlNmz/WsmvPZYVCodpTqlBXX7fx/PPO/nZlZfl+BCxSyoJ01Qa4ElQV8T4Rigiey+XZyJHDg86uXnPXnb+0mQzZ5jUP2S9+6Tv0h/uuJ6UEC0ODIgMNqhgAfjAMAzZtwoV03VX/RD+56wfMksdqhtZyYlJk0inp+SmFne/7nmBMwERDUDD1MtIQvol6enrq165//LbW1vapMKu4kcawmmeefeHv2zu7x1x5WdO1Lg9jLOJCMKB1cQGQWegB3IDWBvUDiXBSWLcrudbGR3nhsSee+vzmzS8vSqV8F2gWCkVv167dizs7O6fMmXXxVXV1NXuMMWVKynxcmogrjcZDrGGtdEpexCtGnjdGHz7Upo/sf5J+/5vr7BXv6KIHf387wbBFoT4uSnA8FIBxIRE909jRM+lnv7iL1jz2eyZkORs7dgS3JpKZTFqlfCxPSJkSRAIbTDLsfGtVGIYIwYOu7p5ha9Y8ekdHZ9eUVMoPtTZxok9EqZSvX3nllbn79x+cNW1a46OWrHLbnjGDSiHnzLgkEpU/Fyy6IhJiCg5QSUqud+0+cNG2bTsWZTJp2Gm4GVSdbCqVijo7u8atXrPhjkVN8z5dVzt0T6ijMk/KLJGynieQQCAtpSAIWaQkCS7wmkyNSdvtOw4Yyx6iB357m/3w+yvpxz+7Ee6ARRHg7bcWPnzLFcDdXw1kT9GPf3UvkTpChYKmqdNGAWkT5eVlMp1KSaU87vuI4yRyN48xQklPhGHkI0Lr6Owa1rzm0e90dXU3eJ5CGK5KdXyblHNh0ve9euC86dMbH+fIBhjTUAAIBjEExe8IN9xAOWKX4KABuKDw1VcPNkSRtp6nnJUofQRjrPI8T/f1ZUeuXLnm201Ncz87fFj9S2GkyzwPygQXg+qjQs7JhJDGFZMBNLA+Gj68Ptr0/C6towfpRz+9wUa+op/86FoogY2i16qYb+Z2/leziLdYAZxxJHi8r97yS5p5Zg3dfecf2OTJDS6gy2QyMp3OKNzdlO8JIQDuMs9pC1kZC9/qrq6eUWvXPXZbV1fXxFj4RiCgc9IEcpPgAqj7p1KpggMGGBPOMyPed/ueIVWEriD2Y9ZqB/0i0U/wA15ensnjUijylQo8x3AJhecp3dvXV7e6ecMti5rmfaa+rmZHFOkyKXnewVCCCbxYyLT1rc+ttmRshoVRH40dO4q279irjxz5EV31L/9oD7x6mFav+C6CU7igNyvU/7K1eEsVQClpAb9+7J+/Rtdc/Td0549+wKqqq5G5cwR6CPiUp3zPUz4iaQR8RABiSITF0DfW6o7OzhGrm9ff0dXVPcHzvAhmu5+/U2L3MKaDMJKVlRX5xsZJ68haKQRSOIcSOmCQHGGEuacj5kMYD9MPv5Bg+P7EiROe2vjks3+fy+YqlYds06GEyUtAwQwwCd3T01u3ctWaby5aOO9Tw4fVb42iMKOUKkDduESqySwHDhVnPRFZy5TIU3rcaNve1mV+86vv09Wf+Tvq6e6wTz/5S0DVTCMNeQvWW6YAyMHDMLQj6qbR12+8in7zm1+xYiRZdVk5Uj2vvDwjfT8lAfBgEROSyPl07HxPaxN1dnWPam7ecFtnV/cE3/OQreP999+oeN8KAPZcChHNn3fJN+pqa/Yg1xdShLDJSPcc9EvYj8zljy4vdJRACMopADIBPnRo9f7FTfNueuChFTfC+iB1TFJOZxEccgxLoJTu7e2rfWRl8zeWLpp/9bBh9duCMMykPC8HIApYsFLuuQgQKZMx0DPe19fNhw6tskLMoB3bNtqbbrqWrrxsFQVhG1wlClz2lFEARi7fZd/795/SphfWs72vtLKx40YhDleZTJknle+pZHEmJGNWwS2EYZiKIlPs6Ogcvrp5/W3dPT1nJMJ3lJwSZSvGAFG3QcRPesH8WTdPmdKwQUiR9jwvz0p+n1tk+sAABCBgyzj8cyxQFqeFUkoD6xJp7Tc0TNy4bEnTdQ89suoGxBmAj/uVINE9QMWwBLlsbtjylWu/uWTxgn8ZPqyupRgEad/zsohfkMF6ns+IiuQZzwBWTqXKbKGQQ6HKFNqg7fvoi9feaL/y5X9CSYvetCM40RWgBH0uuuKTVDfc0prVG9nEiQ3cV0z5fsrzfR9u3+G8iMnh7+HKwzBKGW2D9vaOkc1rH/12V3f3BN+PhR/T84yr30D+iOpRtAH4smDBrK9Nn9q4VkhR7qX8ApeuXCAdX8c9i6yw8P/YkobFeuAgPtSfcRGrlNIpB/zr8ilTJj5GZL/y8PLVX4ki3W8JEt1zlgcYEpQgm83WLV/RfMeSRfOvGj6sflsxCMp8z+sj+B/iAh8Ry5kbRJ3GsCjq03U1tfrFl7bqmto0nXX2uXbzC5tcTom3e1IrAO48aurp9Aj6xEf+O216dgOrrx/O0xn4+5RXUZFRwPjwD/EyZ1YC1g+D0DPGFjo6O8c2r91wR1d3z7h451vx+hfAVmaH3QAAEABJREFUSwCKw+blev78WTdOnTJ5PZe8Il2WLkolcatZhKowx35HVIc9myiBBniDyB/hHkJ3pG+oGElmyf0+6uvrq2hsbHiMc37jAw+tuNYYgwi1FBOUwg9kB0IpZfr6srXLVzZ/Y8niBZ8aVl+3PQiCMuV5Rc4AVQslhEee5/iEVhtN2rGbuC0UC1ZHRdO0cBHt2L7VFgqFEl3dnrQKEJMqNM2fs5DCoI1pzXlVVZVArJdKpTzlpYWUiNJRorHSGPj8EKleoaOja+zq5vXf7u7pGespFRlrk8IPzDUk74A3o7XD8qMF82fdMG3q5LVKqapUOhUKKcgQ8VBHyD1gNVAvJiWkBqAghXDOn1twhS1x5Ccw7gauggk8Th7p8vKyKJvNVTU0nLFx2dKm65evaP4Kqj/I9RJ3AAGVshCO7ACw8fIVzbcuWbTgUyOG1+8MwyDjuZgA0DQjI5T1fW2s9VGEAvfAVldX27a2NjtlykR70UVzae3a5e5zDiTFbMAVQGvktYzOOm886+o6ytKZCo4tD1/ve4A/GMAXYPGSHMgTpVBpa2/vmNS8dsOt3d09Y5NoHwJ0gA22G24J0jgYdAh/0cK5102bNmW9FHJIqiwVCbfziRV0wCOt8afu/07SRDLtpZgvlVZCMkCA3EkekbrDBRyma4VAGkLWepTJkM7lcxVTJk963Bjz5ZWr1t6ATOFYJShl+sbG2UFfX67ukRXNty5dsgDuAJYgrZRnYGk4N9rVLblyNSXP81y5GfFHEBTZJZfMpqefesJmcz0DqgQDqgCOV28MjZtyHjVOP5Ple9pYRVVG+MjzUdpVvqvmkXXCl1FkfGtt2NbePq55zYbbe3r6RpeE7653TIsH9i3yd8aYXjh/1g1TGxvWSSkrM2XpEPQgPDkwoQRCtK+ndcS9zzb/P325vsq5U85dc+6YyWsDo63kIlXup60nFSkuCGVGTtxwy4yjBTgzg3gA+aNTnDBrskOgBIzYlx5evuomEAMgNLiDxFrHUHCCE+RyubqHH1n9raVLFl5VX1e71VoogYyVDGik4FZKRb4fE42qq6tFa+sRGjmyVo8/Ywq9/NLTA+oGBlYBku00buR0MmEfCemJdAoBn1JSKkRmknGSlqyMQp0iYvnW1vZJMPu9fX0jPQ82Eqnea5IvCT9p9ojmzb30hqmNk5uVUkMyZZlAKuEUL7KahSbifUHB/tujv//kE3s2n5/iip45sP3iM0dOXLBs6kU/P2/M5JetNb4U0s94Ke0J5dgjTg0ca8QJnsGPSCGtRXUAfHCWrWpsnLTRkv3KI8tXXw9LECuBk717UswyQoro6UK+ULt8+epvLW6a/+kRI4ZtCWxYLqVEiggiibHWA8TBlVIyDD1Kp8spDAv2PX/zdtOy80XwEAfMCgyoAmD3Y81oHA1HzdPpMqFiJo+rljnTb0lq7cx+sb29czx2fm9fdiRMKHY+7mecprl4D/9DCoUbHTUtnHP91KmT13hKVZWVl4UKwKFwNt493ZKN2rPd5fvaDo2t9NJWChiESGzat+2iLQd3nz+74ZxHlk27+L4zakfuj4xOKS5UWqXIlwpuASkBMAMEHBqVYyEF88hzcW02m6ueNnXKE0R03cOPrL4eMcHrUsRYQ507UJ7UuXy+ZkXzum82zZ/9qZEjh+8Mw7BMCBGCuoD0VUplladJhQH5vjJ92R42bEQ9Gzdukt2x46UBI48MmAIkKQydd97baMaZo1mhYETlEGwUMDMFBK+MsajqpRixYntH54TVa9b//319WZh9bYwGHn9MacQFfi7aR5i2cMGcG6dPa1yrlKwuK8toz/eAvTp0RkNhIgJHnwVgdQgU9/B3EeA+ht0ObuiqbU9f8fQr2+YumTrz/qYpb/tDXUVVV6ijVFr5zJeoIbv4IHIRAiNoLUyBJfJYGVGUy+UrpzZOftxaQmB43R/hBHG70msposn2ZWtXNa+/beniBVfV19duicIwg5DBIYZckJLc4nlSKu57KaCWNHXqdHbgwG6LQlGxWPirK8GAKQCEjwxg3vwFTBvOMymfSaFQGHGQPHQkikKfcxG0dXRMbG7e8J1sLjfKCT+u6vV/VvwfuTkKMth9TQvnfnXGjKlrpRBDM5lM6Pke4FNAfJAOdh3+jJsY4BGIHWPQJvYhrm5PjMq8VFQICxX3PrPyHx5t2TzvyrMv/eWciWc/GhkT5cJiusxLm5TymEIxgQsmUO+FX0PGirwtRhWGTJs6+THG6PpHlq++VkcaJUxjLbiGcSthkiLCxMNy1Dyyovmbi5vmfbq+vvZFsracEWUZ51oIGSEpEVLxGI4OqK6ulvL54oB1HQ08EISePDLMMXcdZRdCQrpnHETa0dGFgO87fdnsKKU8EC2RDr7uEhypnjEO6Vs4f/ZXp09rXKOkHJLJZLTvew66xaWJxxkZi61EEoXg9RxOmPjR5G3FzZ6CM24QCB7taR/z7xt+d/WjOzcvuvzMS355/pjJEA4vRqFf5qV0SioiLsFFs6APwxJ4VjFbloYlGDK1cfITWpsbV65a+2VjNKhrTgleQyqdGxNKSYBFNctXrPnGsqULP1lXV7PXWutz1IzAOsQHcXEEdwDaiBE1jj6WxAF/9VhwwBQgKZYQUhrPQymewZ8rZlHZQ2nXiCgyqSeefObm7p7eUSnfj4zR/e/ntVwfATU2EZn582Z99cwzp60RQlSiRu/7vgXJE3vGlX9BBkluNzQvqdu5Om8cPSbhZJxM2tJbBQtYAf4lslsO7z5nZ9urZ180Ycbay6bN/E1D3ZgWY03K2JRIK+TwnkVGgGwhJqC4ICXKmlzltMaGRxmjG1etXvcVfBakiEl5OUGaS1VEDzFB3eNPPPXVxYvmf9xTqgvBMN4VPgfwh0Rl2OjRo6i8POMCwYFYA6IApYj1wgtn0sgR41AE4pmyCsfjdCE2WcmI51/dv3/ZkaOtZ/oeeNZu578WRsdcbZfnQ5hzZ1988/RpU1ZxIbDzQ+WBkynA6cP2x83jKO7E/GAI110Jdx/xRrz1kxZviMwFlFRC8937dWF/WvkaD6/f+dz8Z/duvWjRtAv/8I4Zl/62vmJoASVEJYTlSWGBcTIAmzyULWwq7DNmSOOUhseNsTetWr3ui4gJYpwgLjw6PUyyA9/3ooOHjk5qadmzaMaMxp+ZmHsYW0nGuedL3tubM+l0xtbWDqf29o4ByQQG1AVMmTIV3AhIMQZb3H2LQTc0UR45cnTmaxsRq99El4TPlJK9F5x/7h0NDRPXMGIVvucF2HkOxXPNH86yuKDL7cXEf7g9HkeOLiBNavyJbriXoBKWn7y0Ux/0CeCpMPvG6vR9z6/9bztb98/44pJ//FrG8/PoEBLADpFrxiRFUM0A4NhUyg/6+qKyCePHbbj0kpk3PfX0s1eFYVhR0ul+1U7q1/DrR9vazrXW/tzCqJADxcBhRt+Dowwjjho/fhzbvn3LgEABA6oA2WyfraiosNYEbnPGpjmWM+5BGEblca0DOu8g+mMGMHCrTcSry4ccGD1qxDprbRmPoVuXGgIAAvEHXAEX+CPYcFdmpv8C8a6PEuAw0ZDXhkPZ193P1wfYMcLITXW6PHrxwK5p24/smzqqsuapyGjfsygtI89IoowYlnYRKuegg+mK0aNGbNy6reLV1ta26eg/iIs/8SsnTiomf4RReRiEoJAatz8QBxCGDzjXwXK5HF1yyaX05JNPUFdXV2zW/oqaMKAuYNeuFmpqWmg10HVH1owHOCQ0KXDrjkD+sYBeM8mgVYKpq6QyrW3tjes2bLxhyeL5yLXB01dKGy2EyzLwl47P4yx/rF/O4McYVGIy/ziETm4fK80NSf6sH2iKdx5KxtSdz3r15VWdIyqH7omMlr70oHggdWhyE2XAI3EtY+hgRoOAs/mPPv7kl1tbW6ejOAQE+nUvnEwxwVfPU61cCPQzoFbsPpMjLcHDJNwVNK1ms33xFf7KZmAgLYCNwhAF+nhTIyuLLXRspq1Vo0YN37izZdffx0WUY/4yZu26AA5I2v79By5qbl5//ZLFC25EKTZpB7OMo7zHQg6r7UI9Fy84USaxtxsVkzA3jmGOvDYXiPpBxsRsuDYhbos6QhhPM0ZNfOZ95y+6a0xV/UHOuC84DxlqiEl4jybSIAipUCjwQrHI8vmCWrNmw2f37Nl7USqVOoY78Lpb4yaV4ApjxozagCDZaRCBKIJ0Bxia60Q1UnFavvxhWEvnDhIc5MS2AImSsr5sllDudJAwqBrxjYOpDC3Z1MgRwx+dMH7cg9u277w8nU5FQAVffx33f5FK+dGeva9cuHzlmmsXN827wc1/ceiJ4/TDYRpheQgtc5/J1erj3B+bNK7qJkFB6WscnFP/3UTth3ETRqEMTEhn1I/euXTahf8xc2zjY1WpcgPsOqW8gnD9KK7qhwZSFgUhg/Dz+bzJZnNi1ep1n92xswXCj1BwjD9I/L8kDcUbjwqFgjzjjPHrJ4wf+zgiSC54DrWASKPlDEYTZWmivqy1uXxymVJO+VdEBQc0Bjh8+JCbvFFXV+9o4Nq4jYN2bY2bgKDn/LedfUsunx+z/8DBs1DvR4Qc/3Upf0bzlZW4obt3773gkRXN1y5bsvA6cPwQMKVsyu10kqBcuBoBgEAsNzPAuR24hFIg4CzBMVPiGIIIhxTKXFTkdRXVRxdMftuv5jacs2pYRXVOcZFJSz/KeH7ocZeeue1p0MEcRFQoFmS+UDC5fIGtWr3u09t3tFyUPkb4sXIlMLYjx/AoCEM5auTwnbMumfmvElmF5BFSSWttZI3V1uJGEbqQqbKy1v6J1vK/ihIMmAWAiS4Wi6ynp9uOGDHKhGHSWmucFkQuG2QMRNC+ubMv+R9r1j1264GDB89DSgiBJ6Fa3OofI4sCN/aVV169YOXqtV9aunjB9bhJjsLtaMPwCA4KLr2JOCyIGSP9762UHCQ0IoM2/1xQlOWpTG5B4/l/WDLtwvtGD6lrE1yk08rzM8oPPaGsRIYOd+JmCWgdBqEtFgNZyBdsLpenlavWfX7Hzl2z8B5L1ctSUBFbnET4QSjr62q3L5g/+5qKyvIuKbjmXIRRFESYfEMWVUHXbuq4yCydpt5cV3I3+r+wkwIIgiJs376Dpk070xaDwARBoLGTyTpUFSleYC1lUmmWmzvn4s+tXff4LYcOHTrX99H3gT7M/mDAfdXGOHewa9eeix9e3vzlpYsX3JRwzV1voAQFQMT1eRcQcGZQGcZ97M/BGTgBSB4s5UNwRqS5dOKZKy6fccmvJtaN2ucJha6EyoyXCsEXkEygMlgikLlANgo1fL4sFAORLxT5ipVrPgPhA8xKdn7cnOBgidjRoGkVCjN8WN3WBfPnXDNkSGWnVBKkk4Lz/zFhwQRh6KSfy+aM56fss+tfoiDX2T/e7phb/Jd2/5uyEAPZHOpWS8sroILDDxsd6zZHzAx8hjP0XGNb2wEAABAASURBVPOCEDwtOO9eMG/W1WvWPXrrwYOHzwTfHzeztHvcReO5fwKdt7t37710+crmLy1ZvOAmBy1Yy/y0T5IEsDcDsD+u7zNgDvjOKQSgpmIUIp8kBHiXT7/o1zNGTNiU8VLCk6oso1LWFwrtv0wyAaoRkTNajoIYm/1CkReKAXM7f+Xaq3bs2DUbitnv85P2gdfyfxYFQSCH1dftaFo497PV1VU9aFXABnDzrgjMILxIhOeFQbGoi8WcqaweYzc+97vkktDxflfwZkz/m2vOpYFZ/TCr1kUYcHDfdLEYsHRaS61D6HpEzA1ygCsPGI8yFVz0LZw/56pVzeu/fvDQobNTvp/EBK+f8YzfIWjcvfuVS1etXv+lxU1zb07Ik8qmPOsafh1dgPHqTEWutnxI56FDrXUZlZKh1nRG7ahdy868+J6ZY6c+WemnueSiIqVSUVp5NqkAohScmG7E4g4gsvDJhUJBFQp5XsgXaOWqtVdt275jjjP7ifDdXoZ3SYCn0s6vq63ZsXjR/M8NHVrV7XjvShbjWpXLjdERFIVhUNTa6Gyu6ErE3Udy9uUXHotvaJzJnjzl4DjnZ9TSspOeeOIpWrhwns1ms6a8ohwMLR5GlnkGZl45KrYnVdEIo4Qo71i0cO5nVqxee9vhQ0emgwXslKDfl8bGFT0BfsqPduxsudQY/YVlS5pucughWe77nsvhJeNmSKrMfHTW23/406cfeV+uWExfOumstbMnnLW8Kl2ek0Kk057P0tIHNQysIFccQvGOSq/lpoDA7CPVK4pCPs9g+leuWvfpbdt2zIZLA/unVGhKij5xe5qId35dXc2upYvnX11dXdXpKQ+9D0VLFBltAmtNiD5HY2D9wygIigaNospTdtOTuyif73I9hi4kGIA1oFlA4rfoxedfspdcfLHj3cO8BUEh9FMeAwUOmq8UJ2DqkqF/Hx09ZZ1N8+f8z9Vr1t9+6NCRGcDN3RCIZFdhJaNBJfzuzpbdsxhr/sKiprk3JxgrSV8Zj2O4h5WNtWNevG7JB78YkfFT0g9cQUZKL+OlAk8oN3HCTRVC3T9OtVwajv+DlYJBDsViUeahAIWiXblq3f/csm377HQ6nXQmvbZizBnU8njn19fXtixumve56urqTt9Dv6NXAIcRjGfLTAETh8IwKoZhGBaLAXa+yeU7TW39KHqhZUX8WV9z/ScPH+DYvHX3Ky3U212giipps9kcAkHygyJTAuwgtP85F+7KvSBHEmOpqqrK3gXz53x2dfO6bx0+fLSxPztI8qlSRlzKDnbsbJkDe7pk8fybQfr2ASJ5nklLD/NEpW896Uyz4ClPqAjMYAWxIx5NaAIJXIet5vJVpAhO+IUCBM8KhaJeuWrt57Zs3T43nUrhOXGv+R+JBKQQJ/y62t1LFi/4fHVV1VHPkygAFUBOAbeQSGPSVPxfFEX5XEFHUWi6u7tsT0835QuStjy/IbmPAzeBdKAVwNW0u7s76YVNr9oPfOQyeuHF53Q6naKUn2ZKBoFUYA5xtE/rWAm4SPlehCQBkXLTwrmfWbV6/TcOHz7SiJbvUlNIAuMm2zVWgpaWXfMgjSWLF9wcF2q49LiCEiAuiIgD5QO5w/WISiB+HB1CrhDkys7uctj7bjScE34RQyJ43u38NZ9xwk+n+zuTXisoxJgFxsgEQSDQkrZ40bxrhlZXtUPLPc8JH5KMEPAhZkFOHATO7Ie5QtbVM7q6uuyVV7zd3n/fKurt7QDzOekboJOTEIK0H3fnV7/9EX3yX95vfV9SrhDYijDUQRiEsiiFUpGQQhkRd+W4mCCV4gE6gzkb0tq0YM6nV6xae2tra9uUUmdQ6fpJ7d+WsoMdO3fNg0Ff1DT3BkYsBUGD0On2OoCcmH/luJ7EXStYUiOM61Wgp0P6oGgHQcDRnJHPF8KVq9Z+fuvWHQudz0/M/muwfJzyApwKglDU1lS3LFk8/5ra2qFtSinhe34A9m/CkgtwT5JxcyYMimGxWIikYOZwa4edPKWBznvb2+jTH7mm/9oDOUhqwBUgsQK2GHTQzV/7KvvHf3gXHT1y1DBuqZDLRb7yA0zkCKPIjevAoDjXUkvCCZQx8qqrq7qWLlnwuRUr195y+PCRybAEwASOdQfO9RMJ+OWt23bMJUbXLF2y8BtSCA9BFEbQMXTpIvV0njpuJU0qlIAHXPjm5gJqw8IgYNj5QRDq1c3rr96ydftCWBmtdewzXteSCq/FY59fV7N7UdO8z9XUVHeg2833/SBGLak0whxxPxw/gr4iXABcS6FQNADNPvzhD9nbbvsJrXt+5VsyQ+gt6Q0sQZkrlj9M3/vu9+zjjz9IHR0dZujQoVQo5kOpMAnA51GIrAApuiUhHWbOGPPhDjxeNaS1aeGcT61cte7WI0ePTkaK6JSgP/Byy1mCskw62r69pQlNGEsWz/u2VBKtCIaE1SBxoDUQZR/uOMT9tQC4IEfjQicTdjK6k9aue+yfN7/48uJMJpMgfK9hiclLAmbWSbTfsqhp7mdraoZ2YbRNKpUqIh5wMIWzUpYgT2sM0J5CMQwKhWI+QAXg6NGjbhAFlPkHP7gjuW9v6vb+lwLDt0QB3Pg1KSgIOu3KFSvYO9+12N59989oyJAhppAvaM/zQqXy3NEGHfbPBDNM4weQIxNqdqZmaHXP4qa5n31kxZpb2traJx/rDmDUHcqDOm3SqPnylq2Lp09rWN84peE5NHD0IymMR3gdFr+9xASgL8y5EgRmUKnivlf3n7P5xZevTKVSeJ24CpS0Fpa4JZxz4BuypqZ695JF878A4WOOIcghTvhxwSopQOAVIop0iCBRFwtF8GLAEUQ3sr38isvsIw+soC1bnnVnILzJ8bInx4SQUiD77VtvpQ9+6N20sGm+fXTDYzRixAiTy+YidIVLWeRA4GCzMXEtbuVnGtYgzVOICfzq6qq2ZUsWXLVi5dpvHjna6pTAQgn6BQrmpBv6YAFA7tmzb3rDpIkbUX6O30jJ4LtoH8sxlCHgGDLGfdfIBgv79h2YhjJsOp1CTBBTvZODQ1zWwLmL9mtrh+5aunjB52prazp9v1/4KHiFmEiKMyWMhfcwGC7prD8QP8T/gpPZt2+fraisoOHDRtAvv/eF+E0x9DUO/KDpt0wBUBaGODe99LhtXvU8m7dgOj3z9HME0zdi5Fidz+VCT3k8CMC3KJDv+3AB2GGKkQS/VqfTrICYQAjeuahp7lVg1ra1tU/xnCUogTElVhiiZ5cmIOhLwoRjora4pKsRlbsOJSIfz0mqD6BxQ3LOCh1TgnXfx/MFuS5A+DVD9yxdvPDq2rqhHRholkqlAiklJpOGjFkUeCyGTqLN3WiTD4IgXywGBYwVhRLu278PUDktWtRkn3n6ZfrJwz91rwTT8Fast3RETHzMSsRuuuFWmj3nbmqYPNE+9SQGJjq56SAoRpi2qbXQUWQCziM3Ah7BIVC9ODvA7EeWqqkZ2rNkyYJrlq9Yc0trW9skAEJu7m/czYNUzqVQE8aPeRk4T2lAlKsHueEQzgL05/zJvYCrQTKKuy/Gjxuz5cmnnnFbGAIvHTWH7/OFoqqrHbpv2ZIFXxg6tLrLUyoFny+VDAXnSdCXTJ5A6ke2CKg3DKOwUCg4vD+fz9uWnS32nHPOoYZJk+ndH3i/81JSuBE1f863nxx8gD+VEj7x5G+ps/12qqqqomw2S309vbaqaij64yPlKa48cCNRGnHycEO83FhXAMcIFNIMA35TNUOrOy5b1vT55SvWfPXAgYOTMW/YoY/W8ly+wM8+c/qq8ePHPs2IoSUpiOcFOz/u8HeKV8ITYWHcbu5mAaM72Bs3bvTL06c1PvTMs89flsmk+1P+fD7Hh9XX7blsadNX6upqO5VCsO8XlXI7vxgbl5hhhLK+tbqgtc4j7A+KxTCfx4/WHjl6xI4fP57mzJlt21o7ae0fHnLXx4N/oeR7YjOC/kIwaAtBL3v4dw/R+z/+d7R3zyu0bds2K6RvlYfRLL5mlHXk4ZQvQPbXRDyIp3hwiXme0Ao/RTChEGz7lZcvvubJp577wJ69r1yidZRRUvVccP65j1x4wXn/4fsptF5HCMhirmBs04/ZRTz557hWCL6QMvq+F0Rai6aF8/6tqmpI60svb11YKBSrlVLBlCmTHr3kovPvrhoypNOLB1ki2oeCodQNZXIpH4IJjLeJIp0PAxR6dFgMigEqnb29PRYW4H3ve5+tqamhm6+/hdo72jA0EkRRd7tOyTmBBmIgsl+/7VYGBViydLHt7Oxkra2HbENDAwY0a+sRKxYC5knPkDSRs9LoqXfmGQV+IwAhg5ItRKikFNkli+bd3tPb+3PMCk6l0p1DKivaGceUOB8NHFCAZJJQf8sei4P/1xEtHB1dIghVnk2nna9nsy6d+cszZ0x9sFAoVADUKa8oOyyFxAQJtHsVpHTspBDvJz5+0ESWDAZJw/kXoigsRhpsszBEkvHKK3vN7t277axZswjCx3pwdVz2fQvmQh1vBdAY0Uovb3+Glj/4BC267AK6/PLL7fr163GWjxk/fgKLdKDLZIaCMHSQHaZxeyplOIbHYOSvmxbuJvyCD+i4eWEUIQLr4Jzh4B4IOoWd73kKXcFuEKSbFBoD/u4uc1f5w7iwOCGIhxg6Ui4GRbmjA3DWQFAMMrW1Nahr9yZ/m5ISQ6FFIIBcctDSkyjTaAR+BYuCZxTCDIDjh1wf7iE6evQo0gD7nve8x44ePdq97nPPv0BPPflUUt8yp/6s4JjAY+zyVWvZkssvJgBCmUzGHj582MG62WzW+r5vysrKI4vbK4HgM+2qtWjQwy7GXAGUb9w8Xmk867khDXGMBtiVh9jIDu93nQRxt9ofjXNhx+A66Bh2A6LcsCnBSDKFi4VSKhfGuwohEXZ7ElC6YC8CCoiSvtYIXFHoQYk3LBptQXQNyFqksCaXz5menh6HSjY0NDiM49lnn6GPfvSfrAY9YoDHwZwws4KTD2mffvIBIooxb7iBTCbjjoZDA6bRAoUS7XkqBDoXgsXDCF1B2KHO5IJvknyGVGzN4R5KgTrH7nXNwo4yBhoacgBOcEL4Ow+sMWQfxygF+v40ZwIdyo5jGh9Vh3qMQEJXIpRCcwBnw1m76h5QQyJbBMqHETdBUTsLYUmH+UIeET/hX2trq7300kvd4VVY6PzdsmUrHa91PBTAndKF9fTTz9qW7TtZWWU57dq1i9BFBLNZO7TOoksKg7eTZllXrxMcvAAKXOMnWNwMgz25h0QRJYdkdyLMQ+2ntJXccBcbj6vAb2Hb8VxRquLEOB3CTgfZ4eA/9z5jBcNrYZawC0YBBMVE5VjwcbRm4UXgDqgAMy/BJNAYPR+6XiFYs97eXlMoFFBget3NcHBA/1t969dxcQGlMnExKtLP7vkZXXf99XTuuefSU0895U7RcN1dpsDLyytRJQRzEm1UiAfcKSEs9Jx6AAALgElEQVSEYQ2umzbupXN3Ob6LpTpP3F8dA3YxRyeu4CCHcCdJ9T9u3cDIUl8ioCOY89fNd0iCQyhMzPRySuV6+aAQcAOKcWdRUEgUGFsmJBn0EULAvueb8vJyizYvpKqdnZ3uNjz22GOE4k8+nys1fQye8wJKJIff/u539svXXsvOP/98+9xzz7EoimxQDFimLIMe+xRKwjiGQwoFXrbC6XBJ75TbxeB+or/ANZXE+LzjhcVe34It7nw/ZhJY41rTkwkyGBzhPj8aB+JpkU748XLF4mOaOZNAISkhuFQPioItHiGUEMJikHXRchYyEiGo70qqQqQiHC3nRoBXV1VrnFrqSLJE9OGPfNju3bv3mMOyBuGhUW6adhjS/v37qbyinFWUVwhjDYTvA/vnnKVw4hv65x3pEy305A6Kwg7G7F8fR3G5FizQweNd7eIMCB2dyEmwh68lPB+VFgJY6I7xio+Td76c4Z+bKOksTNxXFjekOhQxjiXxCGIQSg4Rdt1HQeyKbIipf6B9YQwNmpc9pXgIIKBQLOKIuUOHDjHEApctuYy2b9t+XE8jP44WIP7QaHx8/PHH3Ylh9XX12NmekirNOfcZ4ynGmQ/olzH4eux042PMLoRnrUlbSym0nwO2h2fBtA1UCJOMwGH67mivuI3TjW8rxSEWBSKLGgBmxvAix+7lqBS6IBNAA1hDYA3A9cS5vmMQcChmxAXvZAzEFecmcCxI3hLh5wIRC1zrCTQAVovxLOKSKIwCxAI7du6kSy64iN361+/3fMsV4L+ES+d6c1SerqDtB7axskyZtPEYVp8x8omsbw2VG2PKMUASBRuM1kyELHFwA4SIU0CNxhk/VmljUnE1z03+ALmD47SQpKnDneRhEOPHLijljBC6fRmVAeMHYuiijeRoATccyA0iYAHnAkqCXgGcB4S0VHHOCm5uUNx3kOeMwyr0GmugDEVilBMYYhG3p4HXiCKgzvX1sZajr7r7hiFU0Wuc/5NOAf6vhF8aAZMtZNnhfQfd78ClM2QFSq9g7sYC1SkWESwAdr1KhO9hyhgmcMS7HX8TKaMNyoIKFgHcAI12bYz5JEJe5wSPwg78rTsJ1IBV5EbE44gPhwG4wRPx+ZMQPgntGIQQLjAhEIgB/jgLwo1BtzAshWsnx/eGudlHmH2I99MXB5YO3oPielpHwARYT18vtWzbFt+MY1rXBlUMgOAHQd9zGzayGfPPp57ubqBkrirohR6OXysKLbKWC7RMozyWcZN9GXPUbmxMrQ2UIOMmcXGjhDFg7jiMX0t4BOA3zguAiunmASWMbxHPD3IAEIgbjiME4iYEjkqiQ/lcPOBMOTABCBltRg7V4wCAGIFihudiIYhEwFkgY3OWbAiVA+1LAyYy2rr2Xx3aYmee1jy0yt0HNJoOSgUwSbPDPff/B31h+kRrPKaLhXykpIxUXMApYlcKKQJmKS+4yMUzgVwG4A6Qcv0CxnZbshlrbBrU8XgMXDzlI5406oJCHAvnsAJH/3U/m9IYNwg5PvMNvp6DjRTPlUFwiPKy+x2gYwdCuXgAGxeSC1C+T7ISXLuPjM0assUocry/fFgMgmJQLBSKxWJ3T5dOp9Jm0wub7O79ey2mngxeBbAGhzrTzgO7af36dXbWkvlRd3evUJ4fqjxY1HHlzjV5ShkZYQJPgbzBAeZ4mNsmwSMFs4/ZbhwvEwM8DtPBcAqc+4sRtDzZ7RhR5+r0bgIDucklbjhXqRDkhBpDvAnGAGIH4F0Edy5TwF/HB0vFbWpFpHzJRQOtdQ5VP3T7BMUgyOfzqP9H2Wy20NfTE+TyBV1fXWN/8YufvW6a6vFaxz0NTG6Ave+B37O5s+ebnJcPe3t6keg7Dj0GSWNbeh5mDJMKKECY5jELwcR4AGY4JkNAkNIlA8Fd9B0fFBqDQAgGMeDNxRc4SZq5d+DSuWTAIMy5wwVK6GOpKg/3E5baUfA6cCXx/CEGoYM85GZ6GG2iIAzyCes3yhcKYW9vT5jt6yscaW2Lpkwar39x54/MgaNHT+mTQ9/0Svj01N3XY7//w++xz335Gn3o0JEA3TJA2XB0azEMOOje6VRaSyURgoeCo6MgdgcReoydW0CDppNlif4fs0SR1cfAD0rJkCmAI5UMq0LrspsiEU+YS9p6HUzgtjt0wRWAYojJlWyZ6+e1Ooqxf8gdPt6YKIpCpHpg/eXz+Sjblw27u7ujgwcPhDW1tfrun99p7r7nV87yHW/hnxAKgIWoHEqwcdMz9u4f/5D++9//gz56tNX0ZfvssPp6nQnLRNxEEaKI4iaDut564IM4dpOYsoyQksESGMEhX+3yO3ACrTPnsV8AIBTveFeShBdwhwnEDb1u38NouL6dUvMAGJ1x0QfahGZuVxpEO7gTfRTBA2BGVBQWi0XX6oWml46OjjCbzWrQAM497232379/l737p/fa44n8nZAKcKwS3P/Aw3b/oVb62r/eYguFrD2w/4BOZ9K8oqIiQldOOpVG8wdKqW7msFQKc0IB2LhZtKUJYfFAYndUKNJsuJHSmJZ4zkvS+m1gy5Mzp5JCQjy/wLrALiYBI3k3yYGOrqoU55OwDHgIC9u+kC+gG1hnc1nd3t4RZcoyZtiwYRQUi/Ynd/7Y3v3THyadvieG8E8oBcDCjUGZ9Jlnn7Ef/uCH2B3fvs3OOHOG7evrQ33A0azaOzoYzuLF4OkhQ4aw8nLMWobuuEQM5WQ3H8CNasdELZzUhGpS/4hC9CS5FJDFbeAMeXqiE65jzCUQztCj0IM9D+zANfw6FUHh34ZBgDN9NP5FYWgwJwi5Xmdnpy0ry9iLL77YNDRMpt///gF6xzuutK+dn3R8g74TWgGwoihylmDf/r32ne96J02YMIGWLVtmZ86cyV544QVzxRVX0LBhw1wuv3nzZtqzdy9DsykqbT6iRKmQGzBfeay8ogKcflaChfFYMk08PjqQkrl1yWmjcV8J2chE1lOKwiiE4rkThaCcxSAAWcVNLsff1dbWUuPUxtLJZe6QJ7z/8vJyuu22W+3+/Qdp48an3edKDqOkE22dcAqAhZuN3Yy1Z88e+u53v4t/bhfdc8899N73vtdecMEF7KKLLqKWlhbnU6EoECTGyB48eJDa29spjAJW6MqjHIsqIx1tO4qGC3cyKITqeZ77W6B6+FdRXuGUD6amr68XvQmun6E3m3OPQeBjxozB7ic/nXLdSC0tLY7osWbNGrt27VoCy7e3t5dWrlzZ/3mw809E4Z+wCoBVqo0nJ373nz9w+PBhuvXWW/GQhdBRSezu7qazzjoLrWY0duxYeuGFF2jOnDlUXV1NM2fOxFgXe8bEM+iSSy8hlF8hSPQXSCndc7BgQXbv3k3PP/88gav3jW983dXvJ02aRAsXLmQ60tTc3AyqGrvzzjstFKxYLP4nwT733HPuqyOhOpMPfsnxK/actApQWseSJHAzcVNxc3FTYR1KC+QKBFwPPRRz6594Aqe5xKlcfX09fec738FAR0fGAPnk6quvtngumjJmz57NNmzYYB988EGnTLAiuD6EC5LKunXr7L59+9x7UUq5Tp7SKinosfUN1+VyAgV6J7UC/PEqCQYrPvLd9n/f2trav/tKyoLHsVs/9rGPgX5OlZXVdOWVV9J99/0H+v5py5YtcCv9WxTXKQkY18H3sBpYuB5+Pnbu4PFg8QxqBfhz1uGPvy/tSPyc0LCop6eTfv7zn/QL+NjnlWKBY3dxQv8onTByXJi7A7lOagV4M+vY495Lq8S/03/CTB8r4JLg3+ixU2Gd8grwRoI7WfzzW7EGjQKcXm+8TivAIF+nFeD4rwE5EfTNrtMKMMjXaQUY5Ou0Ahz/dVzzytMKMMjXaQUY5Ou0AgzydVoBBvk6rQCDfJ1WgEG+TivAIF+nFWCQr9MKMMjX/waz+nD4MTMrrwAAAABJRU5ErkJggg==","icon-cheat":"data:image/png;base64,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","icon-tasks":"data:image/png;base64,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","mascot-hi":"data:image/png;base64,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","mascot-think":"data:image/png;base64,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","mascot-done":"data:image/png;base64,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","mascot-search":"data:image/png;base64,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","mascot-sleep":"data:image/png;base64,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"};
  // STICKERS:end
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
      .replace(/🔴/g, '<span class="cd-diff d-h" title="трудная"></span>');
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
  /* CD_ICONS:start */ var CD_ICONS = {"book":"data:image/png;base64,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","play":"data:image/png;base64,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","bulb":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAYOElEQVR42tV7eZxdVZXut/ZwzrlDzUlV5qQq8zxBaIKhFCKComJL4YgMKmor4ATqawTy7AcK+hQHImijSJQnwQAqRBmUIoEwJDFTVSpTZawpqfHWHc49Z++9+o+kkO7f0xaosnH/d/+4e/jO2t/61rCBkR2ioaFBDv1gZkJy0lggNTddNfmiFWfO/WJQOvmDQM05Zy2d++b3vG3p2P/yf3rl/0di0EjN29AAse5BWMvAm86YfcZAFue2tuVLF01NTbvw7Kr3+pr4F7/run12bXLR0jkV5/1+04mDm3YN7q8q09L3aUtPj723t+dAU2xe3icBcP8IAEgiWGYAGLX4rSvG3bh8bvqslkPhDTdcNm70vDnpzyKQLUji6zBiBSL+JDTdiQpxd/sLA7du35e/aM3jJ3oOdkTj9x4rPFE7NvHDP21vWmcd0NDQINeuXWvfyABIABaoGjdmYsXNn7qw+qMfOGfU4emzE3cB4hwX8lujgl2jnW2W5d4nIUSAfPypgawLkmn5b1qQg0ct0FR3/GAhcf/TfbXf/VV7IVfkxgWTva888VzztlNrOAA8XBseLiClFLBV1VPft2hO+bp7rptW/6F3jT5UFdD+MM+XK0I1JcQDCpgSQX70T82DJ669fd+Nk8ckPjJ1UvLLtmBO2NjBFN1ik7cVZRV++E8ryr6xcl7psWzWXfLY5oH3zZ46Juo63v3cK67EG8YCpCDYZNWUGy44vfJr37tmMmqqdZzpjUxpVZAAua5tOwY7f7cls3Dzvjxa2wrOOg49JZMfOLcKn79kTFeYt+VBSvvGOMvAUybmDQjkOQlflEDy8z+8v+Ojt/yiI6EV//jAhz74CVq1asgC+H8YgHolqNEkKqbc+q7lVV++5/paBAouW3AiXamx70DOfu1n7XbHoYKniLdfeX514s1LyqaPLVfkKWLfI0tESnoSxrhjbOzjwpNlLMWZHNlmx0QqkLWySn3/zh8fOesn6/vee6I3fPD22xa9/5JL1uL1XofXBUB9fb16prHRJCsmf+G8ZaO+ed9XJltf0onIckUyrfwfruvkr9/fTm9ZVFb8wsVjDsybm9YA1aFgpTUMxwwhCAzEjrGNQB2kaTE7MBt7RAayDqAdcWgfYyUuSJTLcb9Y15lZdV/nCmftvfv37728vr5eNTY2mv8BDmiQhw8/Zmtrp6+cOiG15s6rJ+4eM9r7U9HwpCBQJVd/+yD/6NETtPqztbjuI+NMdamu5ohHhTkjrAWYASIwiPrZ8R4hqYIELebYZYjIF75I2aJ7CECkAnmFMEzhQFxYsqjstDIF+dhLmUWTJowa3Lx567MNDQ2yubmZ/54WQABo5cqlJbt29+9+74rKJ79/4zQZ9Zn3eR51XvF/9lU825RL/vaWmZhRl0SYMaCTKzHRyTWJwAByzMgJQVXOsQQwKLSQzHgJzh0kLeuZuRKROwrCeF3iVUaDcd5LiY0fu+XAsie3DpaUlYhFO3a0NAEQJz3Q38ECTiHuClHilmkTEuf+ctX0wIa8xCsRay69cX/hD9sHp//u1pliZm2ScgMGShKIgKHDD4HIYKWkKAFDQBCEFD1seTMRqoUS57vYEYwznq9qhaCELdoWC96nPDlu6ZTE5vuf7pkWx7ywp6fnJ6c+Cv89ABDNzc1u4cLp42Mj1tzx6Sm6bmrqCSlx79PP9l/w7XVdZ6++ZopcvqSMcgMGWtFfMSMiZjBJigAcgeU8CVqqPDEuDm0EpqTvyVRsXMY6boUSgdJC5AbNi6MmJmeYnKEntmbmz55a81xHZ/eB13IVxGsgPgEA2SyuLkurvhVzkue7bLzfxfjWNx7oXFq/IO0urK/kMPPXD/8KFJy1XHDWjdWemM3MOiwYFkJ4QoCj2A4woSiUqILjVjbcl0jrf0Yu/u25S0uunDkxiZ4B81kAWLt27au2gFcNQGNjo73qqqU6tnzZ7In+flWirhNJ/dWH/nCi+FLLoL3hQ+MFGOTgLDP/t9qdHYQkKpdSJIpFx8yAICJmPkmUQgSCaNAZd4C0WEZaeGYgvrhokZs/r+zOeZP9vZHDW5Ytmz/hlEsUIwmABMAvbMwsJqKaqy8asxgGdYjMofue7E5csKxczpqWsuGgOaak6BeC/luhQgRyzHCO/xNHEAFCUMiW2xioVL6aw5G93Ybme7pS30ZEV4H5ufe8qbLoa5nIDoQrX2mhIwJAfX09AcBgyG8uTyuuG+NthYDf3hVN2XagIFfMSx+AxEtCkk+gSgBCCHrVnoYIcI4j5xg6IeuEpM22EF8vPLVQBOouLthBOD7minzakmnJ/uoyjXzMZ70WQlev5U+FmBfPrPJ4dLmeCyUqt+zJ2kJkadmsFKHoFjCz1kpQbJx1DnkSnATT30S4zGAA5Ce1Zwz3xpH7sRCkRVLf6mIbk0MzaZpEhrMuBo2q0qVaoYMdFgxd0RGzgMbGRnvq60weV6WlSkkH8M9/vzmzcVyVz5Oq/bSznBdakLXuCEAHhSRJIPG3Hl4rQUIJa2K3kWO7Xki6QCr6lA1NDpYtC6qzERMpMdYyNqNa3zalxnPWoYb5JnHqytFIAEAAmAB4UozNF91+BOobUGI0CSwbyJo4lZAaSoRs0MhEeSFRS0CS+W/bkFJEDjjhLG+Ac2ntyyskY3pcMBkwxjCjDOAS6YmsDe3tUGSRdd9OBcI6Zv/yy5/2RtwLrP74Us1gJQUSiOwVCG2ydnyQ+/DK0ez7coMt2peEokVaiVnOQjr3t3kmErDOcZezdoCAM5UnFxVDy8XYMgkq9bTQwpNMTA/byD6p0uo6IkxDlbzwUFfUFHgimDIFZsQ5YMbYNAMDbCwnQNQYOz7985dOeAnsttm8W0lKLHGxoyL/Wfa+cjhmVvKke7DOOQIJIsBZdgDKfS1rjGWEBcMEgpKChCRYRpONzRbpq2VSqgmuYFZFho55PXb1vCnJpVv3Zptvvvlpu2oVvaoQ+dVYAAOgc1Y1GoB7cwWXgHEzXOx+VhyIj8V593FnuI6N6ycBFuKkynuZ1flkkiwIFDnnCtbycQIZOnn3IQRpKYRfjB07ZggiUooIggaNcZuYXegl9EeY+UiUN58RvjrDT4jvI7TuQHvYr7XoIiIeUR3Q0NAgGIDvydYjJ4qqsz18QGvxbqHE2xG7DgKk1rLKWQjnXKSVIAZbazkOEopIwMWR3UkkWqWiNBE8/jMBwvGftYAQcI7RY2PbJaVYSkpOskVzGwF7dEJ+yxTtW2BcFOVcVU/GlElC84jrgOPHjxMAaIFnsiF0W198rSDOc9EOaC3nK0XlUdF0E6FPKoK1tpNAuSCttTW8kx09TEp4QtJcOCT/Ej0QAdayZea01HIqMz9vI7uOpHiPEuJqF9qkkOTrpPz1I8/23NLRG3MqQRtfU97+VbpBBwCVpbQ+LBr38Ia+EESLvVJvThzbnjh2O8mTTijKscVu8mSZ9GU2Cs1qx9wiPXGeIpppTpk5/WV3CK2lFkoMOOueBCOttfiEFDQdYEgt9xdy5kYklYid+EGuYDPjS+QTI64DhrT2pi179hCwYfP+wtQob4XLx89CikPkyTJYbmJQRiTVVBD90hTN90mKFdqTDS626WLRvMwLf0kkEsFEsWt3ke0jorOVFkuIAcvIxpFbY619PFHmfRW5eMFdj3YVpcTvn3qppedUEYVHNBxuaGgQTU3NPGXC6N6j3eYDJQFtPf20shITcR8ctwpfLBNaHLR5+zWAp3gJ9VkpkEbs8taxBxBpJchYZ5kRSkmaQLCOwTiZN1CKYp0QCUliDBiKTyLfzJF7gjyxDEpcoNPii++/bvdvm49Gl40ukZd3HO/uaG5uFq8WgFetA04VJsT2i9//qHN286829v9Tti/eBkJSJNQiZ/jLdjD+iUzIr2lPXNzZGe59x/Ut0aMv9Jd5aS18LUj4OKoVtQtBSec4tM71BkllA48gNGHPkdD/l28eCtq7I5CmXBy7F9m4gi7VlxPQlu+JLgRRbVl58Jsotg9t3dmy9dTXtyMuhF620lWr3LhR/vXbDuTw40eOn+9X+xv7j4SXCClWypT+gS3aDhg+VJaWY9p6otJvru0EBB1t74n+2Lg5w2GMMTot9niBOOSnVGLL7kHRdKgAFUj86z1HeeehPI+r0pliwR6XCktlIKcXs9FNxdg9WjYxWP3MM33XP/Z8X7GqXFzPAL2WXMDrSYpyQwPkE0+eaJ0ysXruH7dlFi0YrdfOW1jynThyCpZ3CSWmFovOS5TrRFoJuebJbuw7mGt7atvgkt9s6ve++tOjqAhklEqpqV/+4RH90t4cfeP+dmzdncULLTla9ZHxPGtGSisSlSB6xkTu58qTK31PXhVmTPjBW1r9QmRu3btn/8NAgwSa3d81K9zcfDIxOr9ubGNfzn4qdrjowhUV62zMFUJgHBsUhC+qibEpkHjh8S2DS3oytvS7n57880+/p6bXGpr16Av95XsOF/COM8px3WUTML3Gx+pfH8eoMoWbr5xIUlCvjdxjALOQdKVSsg6KzTfv7yz9/Yv9TWuumHDpvY2H6bUe/nXXBYaKlQvnz7y8rdvcc+tHJ7R/7P3jmsMBM0n7MuMK8QMk5WkqEO+48Au788e6I7t19dzjQouFUAQUHazlvEwIxDmX1CUSb7u2maeN9+0PvjLtaL6n2KG1nKl9WXUyFOP+J17s2/mp7xxeoZU9raXlwJY/1yNfY/3+9QCwdu1a29DQILfv3PPTyhL5xG0PdFa27c/XBOXq/8W5+F6ZUNdC0VRUyKvm1wW7B3Ju7IH24kJogUImLpjYNjlwxhRcUmvK7t+fz+8+UqCz55fkELtST8nlWoqqUzJxAxx/6ePfOlTJcN9qaTmwpb6+Xr2ew79uAF6RiCQp5VWCIN91094sIjdRpdXNNna3FDLRN5BxX204u+rMnkzRbN6bLULhRcfYCC2nSCHKothtR0L07jpc8ByDz5hVUgbDVVISLKE3LJh7USZbvr226+sAgpXnlH0FgHy1omdEAADg6uvr5e7duw875/41dnL5Tx/qmqXG6bcYR4uDlPqpzcXltWM81I1NqEee6zsIw0il9VvheKcx7vdKi2oImvRCS1aNq9I0vlrDWnaWeXcU2WeDtFrR/KfMh/99/YkKG+PKu+/eEg9HYXS4ABiSn7K0tPSOQlhsufHetqpCS/7nCcnnwKKDpXAVFd7dRHwgtjQLFhVR3tzOhF6hxTsVYSzylne25jFzQsA6qYpR7FoZ8D1fnglBm6647eD+TDZ6qO3Yvmdeq88fMQBOusUGbNmyJfYF3xD4auYPft2VQFLBSXopm4luREotveisqqmbmjM9bR2FdcqjBu2pt7vYSecYubylw11FTJ8QAGArBU1wDlIqbH98Y9+bugfNnOqS4LrX4/NHEoCXFeJNCxY/HBajHetfHJze3VX8lnK8O10erAZc657DuXsCT1ZGBl8SvpxiCgbOcaQUmRMDMXoHDSbX+ARQwhjOAJyC5fk/euzE5MG8+eXWpqYDDQ0NYjh7hYYNgKFY/JK1a21Vqb5rR2uON2wduEaWyEt7e4rvRqDWf/i80W/N5Ax39cYAcxwbu48I3dCCOntjFGPGuEoNWAepqMpPq32/+mPPg8/vHjSTRgWrT319DGsb23BONhQuO4oeLE9L/tH6E3lMSpxfmpJXYtCsGVOhJyopxL62cB8UPS61TBDROACiq+8kr1WVaoagKIrcThCnDnaZf4liPrj5hrmbTi1j37AADIXLO3a0HneOn+vojacUtmWeUoS3IrRhaVL0MjvT1RcFMLzSWZ5gHQOKqCdjIAWhJCkJkbO+L+faPCcfea4n72t6ni5Za+vr64e9Z3C4ARhKSRGBNzlHlZ09sRC+jEG4NzK4KxUoax2NAqH9ZL8AGVjXNZCzxtMEX8NBUEJJtLd1hXsGck5rja0YoSFGamJFaI0Mc3tPtFco+owB6QmjvC8KwWogG0cQNBnA9ih2jZCywjpSgsC+FgIOxI5rckV+RxSzVkK0j9Reh33SbDZLADhIBUcdBB3rdhtR4n1Jpb3lvpb3SKXziYQXYnzy9qA02FM6JrUc5XJjy5H8c6PKAypLqwI8apVlQRBb9EfGuYSmEyPRJToSjZJ06hqkWvfvvcNYvuLMOWUUJASe3977/NSJ6dlHjkdlvZno8KSaYHDOlGBef9ZF+zr1DnKFOYVCwZ86oTQXW1kYXRKN7s8RWruVkIgflVJ9Yc+ePXteayfI3wMAAkD1l13mHfrDU0/OO+2ss855x7ujfCREMXaivMQX/f2DWS1db7qkZFLHsba9Xnr0uDGjk2l/390d+3pKnq5a/L53qqg7LTo3dPSXriipHluTDvev3/rTBzYsiCLT7fveol27dh0fLhk8rAAMtavNmD37Eo7jX37t7nXxzAXzdZgvQgoBEDlmjplJg3jQ97VvGa3T1O47Q4slJ7zZ58YxWsuK+0OXrFmeRUlzaa61UZePffPDv35m4v/9ysfHJ9KlH9vd1PTvr7c1bkQ5QAgxyjmLzqOtpBQgpAIJzUSKpNK+VIoSSZ3WAV5Ip3HvUT370i5/9odsjDYl4RXKpi2LdMmTgcaWqLLuEpNK9OQH++7y/AScMf0AUF1d/Ya9ApgzZ05NsRiuTybTi1ac/89O+57AqXYXa2JW2qNCPttzoqNtb+3MuWcqJXG8/dixIJkqr6ganT60t3kXSGDanDnz2g4fOrKvafszQoj3Hmvd98fyysqLtmzZYoeTEIeVBIcyRLW1tXeMrhl79eQZcywANdDX3aGk59KlpeMLhTwrpSmVLsHgQD8cO+d5vnDOwjl26XSpcOyQy2acHySEEAJbn/0DmLHe87yLmpubzXACoIb78LNmzTrPxNE1V173vzF36ZmqGBZcIkjmHbg6joqw1kBrH+ycMzYWONUTBYASibSw1nAUhczMAgAHiaR7ZM3dvO7Hd1yAROJdAB4czncDwwbAUN3QGDPbDxKIwsLvHPM4ZrdgcLB/qnOOTxWYKQpDZrAQQsL3AsRRkRwz4iiCtYYAIikVnDMEQCw642z72/vugg2j9CvXekMBMBQI+b7/eBgW+n92x79Nu5QwWUjVp4XMS63Hh4VCBILzPD9w1iJIpGBNjEKYh5IKDIazFp6fABGhkB90ZRWjxKanHlOFQm5Ldc3Y3wCg4UiFjeiLkRkzZnw2Nzhwc+2MedkJtXXjO44d7YnCQjhmwqTxYaGAgb7urrLyqmoQkbV2yE0CzCAhOI6igtI6WVpeiZbtm/d2th2eVFE1+kctLS3XvN4s8EgCIAC4+fPnzxzMDGy44vM3dVz80SvH5jJ2IzvXqzz5PmfRERWjnVKr09namjiOrRAi8bKkIYCZnRDCer7PUVj8WXlV4vCPbv/6lx+5b3UqlS69cNeuXY8OJweIYY4CEYbhhal06egFp6+ITIxbjAkFCXdxfjD/i3x2cKOUODcKw6hQKLQyszJxzHEcwZgYcbHI7Jxg5r5sJrOWBNcWQ3vtire95w/aC2CMGT/cHCCGkQP4ZKeXejGOi/jm//pkdxyaK9naCWHRfC6ZTowvKU2901msV0p3B4lELRGFQkgIKVkIYbTnQwiZtSbu8YPERYV84Szn5LGmLc+9PY6KHUEQPPRG5wABwNXV1X0imUzdNHbSlJI9O7e1z1qwpHzK9JnVRw8ePKaUUqPGjB2TzQwUwbDK85LOWccOlgRpds4lUyUiOziAQ3ub4rpZ8+L9Tdufa2vd/7muvr5dQ2u8kd8NDkVrAsDEutopTTXjJ6vPrPq2PVkOd7DGuiCRFEO6QGkP1hoQCQR+Akpr+71Vn8PeHVuPdff2nVUoFNr+y9zDytojMU7NS/1jxo83mb7u86uqx+K0s88jBlMynSbleS5dWk6JVAk8P0AylUIqXYrK6hrevOFJ0/jbX2k/nb62s71949KlV+mOji0Y7sOPJAA8pA6zg4MvRHG0vHnrC9O8ILDT5y/OsHNKay3DfP6otbFl5oSQkoNk0j3/1GNuzXdv0caYe/ft3buqvr5ebdq0zozE4Ufy7fB/mn/m8uVpd+LEfdZE75616IzCuz/yCaqdOe+RRCKdtjZ+SzEs+F1tR2Tjow+i8bF1YMd3fvjAgatX0ctNj/yP9nj6/8cJmD179ofzuew1Qsi5JeUV4exFp1c6a9HfcwJHW/dlM309G0orKr/T0tLy+Cv2xv+Ir8f/0jpMRJgzZ+HCMBxc1nu8o1wIyY7dkYpRNX86ePDQvlOPTIb1ffBfG/8Bp7q3X+ONO2gAAAAASUVORK5CYII=","attention":"data:image/png;base64,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","star":"data:image/png;base64,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","magnifier":"data:image/png;base64,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"}; /* CD_ICONS:end */
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
  function renderQuiz(src) {
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n");
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
    var html = '<div class="cd-quiz"><div class="cd-quiz-head">Проверь себя</div>';
    qs.forEach(function (q, qi) {
      html += '<div class="cd-quiz-q">';
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
  function cdSchedule(id, grade) {
    var rec = state.cards[id] || { ivl: 0, ease: 2.3 };
    if (grade === 0) { rec.ivl = 1; rec.ease = Math.max(1.6, (rec.ease || 2.3) - 0.2); }
    else if (grade === 1) { rec.ivl = Math.max(1, Math.round((rec.ivl || 1) * 1.3)); }
    else { rec.ivl = rec.ivl ? Math.round(rec.ivl * (rec.ease || 2.3)) : 2; rec.ease = Math.min(3.0, (rec.ease || 2.3) + 0.05); }
    rec.due = cdDate(rec.ivl);
    state.cards[id] = rec; saveState();
    return rec.ivl;
  }
  function renderCards(src) {
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n");
    var cards = [], cur = null;
    function flush() { if (cur && (cur.q.length || cur.a.length)) cards.push(cur); cur = null; }
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i];
      var mq = t.match(/^\s*(?:Q|В|Вопрос)\s*[:.]\s*(.*)$/i);
      var ma = t.match(/^\s*(?:A|О|Ответ)\s*[:.]\s*(.*)$/i);
      if (mq) { if (cur && cur.a.length) flush(); if (!cur) cur = { q: [], a: [], m: "q" }; cur.q.push(mq[1]); cur.m = "q"; continue; }
      if (ma) { if (!cur) cur = { q: [], a: [], m: "a" }; cur.a.push(ma[1]); cur.m = "a"; continue; }
      if (!t.trim()) { if (cur && cur.a.length) flush(); continue; }
      if (cur) (cur.m === "a" ? cur.a : cur.q).push(t.trim());
    }
    flush();
    var html = '<div class="cd-cards"><div class="cd-cards-head">Карточки — вспомни ответ, потом проверь</div>';
    cards.forEach(function (c) {
      var qtext = c.q.join(" "), id = cdHash(qtext), st = cdCardState(id);
      var badge = st.status === "due" ? '<span class="cd-card-due due">пора повторить</span>'
        : st.status === "new" ? '<span class="cd-card-due neu">новая</span>'
        : '<span class="cd-card-due lat">повтор через ' + st.days + " " + plural(st.days, ["день", "дня", "дней"]) + "</span>";
      html += '<div class="cd-card" data-id="' + id + '">' + badge +
        '<div class="cd-card-q">' + inline(qtext) + "</div>" +
        '<div class="cd-card-a" hidden>' + inline(c.a.join(" ")) + "</div>" +
        '<div class="cd-card-ctl"><button class="cd-card-show" type="button">Показать ответ</button>' +
        '<span class="cd-card-rate" hidden>' +
        '<button class="cd-card-btn" type="button" data-g="0">Не помню</button>' +
        '<button class="cd-card-btn" type="button" data-g="1">Трудно</button>' +
        '<button class="cd-card-btn" type="button" data-g="2">Помню</button></span>' +
        '<span class="cd-card-done" hidden></span></div></div>';
    });
    return html + "</div>";
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
      rows += "<tr><td><code>" + escapeHtml(inp) + '</code> <button class="cd-tests-copy" type="button" data-in="' + escapeHtml(inp) + '">копировать</button></td>' +
        "<td><code>" + escapeHtml(exp) + "</code></td></tr>";
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
  function renderDiagram(src) {
    var raw = String(src).replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
    var cap = "";
    var m = raw.match(/^#\s+(.*)\n?/);
    if (m) { cap = m[1].trim(); raw = raw.slice(m[0].length); }
    return '<figure class="cd-figure"><div class="cd-figure-art">' + raw + "</div>" +
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

  function renderMarkdown(md, headings) {
    var lines = String(md).replace(/\r\n?/g, "\n").split("\n");
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
        var m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
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

    while (i < lines.length) {
      var line = lines[i];

      if (!line.trim()) { i++; continue; } // пустые строки между блоками

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
        if (lc === "badgood") { out.push(renderBadgood(code)); continue; }  // было/стало в две колонки
        if (lc === "console") { out.push(renderConsole(code)); continue; }  // транскрипт консоли
        if (lc === "diagram" || lc === "svg") { out.push(renderDiagram(code)); continue; } // схема
        if (lc === "checklist") { out.push(renderChecklist(code)); continue; } // чек-лист «усвоено»
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
        out.push(
          '<div class="codewrap">' +
          '<div class="codehead"><span class="codelang">' + langLabel + "</span>" +
          '<button class="copybtn" type="button" title="Копировать код" data-code="' + escapeHtml(code) + '"><span class="cb-ic">⧉</span> копировать</button></div>' +
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

  // ---------------------------------------------------------------------------
  //  Тема: светлая/тёмная берётся из класса воркбенча VS Code.
  // ---------------------------------------------------------------------------
  function isLight() {
    try {
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
  var _lastAccent = "";
  function applyAccent() {
    try {
      var rgb = resolveAccentRgb();
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

  // ---------------------------------------------------------------------------
  //  Стиль окна (один <style> на документ).
  // ---------------------------------------------------------------------------
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = applyNonce(el("style")); st.id = STYLE_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  var CSS =
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

  "#" + WIN_ID + "{position:fixed;z-index:2147483000;display:flex;flex-direction:column;" +
  "background:var(--bg);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:var(--fg);" +
  "border:1px solid rgba(var(--ac-rgb),.28);border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.55);" +
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
  "#" + WIN_ID + " .cd-logo{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;overflow:hidden;font-size:13px;cursor:pointer;" +
  "background:rgba(var(--ac-rgb),.16);box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.30);}" +
  "#" + WIN_ID + " .cd-logo img{width:100%;height:100%;display:block;}" +
  "#" + WIN_ID + " .cd-hbtn{flex:0 0 auto;width:26px;height:24px;line-height:1;border:none;border-radius:7px;cursor:pointer;" +
  "background:transparent;color:var(--muted);font-size:14px;display:inline-flex;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-hbtn:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-hbtn:disabled{opacity:.28;cursor:default;background:transparent;}" +

  // Навигация по маршруту (пред./след. файл) внизу статьи
  "#" + WIN_ID + " .cd-routenav{display:flex;gap:12px;justify-content:space-between;margin:36px 0 6px;padding-top:18px;border-top:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-rn{flex:1 1 0;min-width:0;border:1px solid var(--bd);background:var(--panel);border-radius:10px;padding:9px 14px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:2px;transition:border-color .12s,background .12s;}" +
  "#" + WIN_ID + " .cd-rn-next{text-align:right;align-items:flex-end;}" +
  "#" + WIN_ID + " .cd-rn:hover{border-color:var(--ac);background:var(--hl);}" +
  "#" + WIN_ID + " .cd-rn-dir{font-size:10.5px;color:var(--faint);font-weight:700;}" +
  "#" + WIN_ID + " .cd-rn-t{font-size:12.5px;color:var(--ac);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}" +

  // Тело: навигатор + читалка
  "#" + WIN_ID + " .cd-body{flex:1 1 auto;display:flex;min-height:0;}" +
  "#" + WIN_ID + " .cd-nav{flex:0 0 auto;width:300px;min-width:0;display:flex;flex-direction:column;background:var(--nav);border-right:1px solid var(--bd);min-height:0;}" +
  "#" + WIN_ID + ".navhidden .cd-nav{display:none;}" +
  "#" + WIN_ID + " .cd-search{position:relative;padding:10px 10px 6px;}" +
  "#" + WIN_ID + " .cd-search input{width:100%;padding:8px 28px 8px 30px;border-radius:9px;border:1px solid var(--bd);" +
  "background:var(--panel);color:var(--fg);font-family:inherit;font-size:12.5px;outline:none;}" +
  "#" + WIN_ID + " .cd-search input:focus{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-search .cd-si{position:absolute;left:20px;top:50%;transform:translateY(-40%);opacity:.5;font-size:13px;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-search .cd-sx{position:absolute;right:16px;top:50%;transform:translateY(-45%);border:none;background:none;color:var(--faint);cursor:pointer;font-size:13px;display:none;}" +
  "#" + WIN_ID + " .cd-search .cd-sx:hover{color:var(--fg);}" +

  // Прогресс
  "#" + WIN_ID + " .cd-prog{display:flex;align-items:center;gap:8px;padding:2px 12px 8px;}" +
  "#" + WIN_ID + " .cd-continue{flex:0 0 auto;border:none;cursor:pointer;padding:4px 10px;border-radius:999px;font-family:inherit;font-size:11px;font-weight:700;" +
  "background:rgba(var(--ac-rgb),.16);color:var(--ac);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-continue:hover{background:var(--ac);color:#fff;}" +
  "#" + WIN_ID + " .cd-continue[disabled]{opacity:.4;cursor:default;}" +
  "#" + WIN_ID + " .cd-bar{flex:1 1 auto;height:5px;border-radius:999px;background:var(--bd);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-fill{height:100%;width:0;background:var(--ac);transition:width .25s;}" +
  "#" + WIN_ID + " .cd-ptext{flex:0 0 auto;font-size:10.5px;color:var(--faint);font-variant-numeric:tabular-nums;white-space:nowrap;}" +

  // Список файлов
  "#" + WIN_ID + " .cd-list{flex:1 1 auto;overflow-y:auto;padding:2px 8px 12px;min-height:0;}" +
  "#" + WIN_ID + " .cd-group{margin-top:13px;}" +
  "#" + WIN_ID + " .cd-group:first-child{margin-top:3px;}" +
  "#" + WIN_ID + " .cd-ghead{display:flex;align-items:center;gap:7px;width:100%;padding:6px 6px;background:none;border:none;cursor:pointer;color:var(--faint);font-family:inherit;text-align:left;}" +
  "#" + WIN_ID + " .cd-ghead .cd-gl{flex:1 1 auto;display:inline-flex;align-items:center;gap:7px;text-transform:uppercase;font-size:10px;font-weight:800;letter-spacing:.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted);color:color-mix(in srgb,var(--gcolor,var(--ac)) 72%,var(--fg));}" +
  "#" + WIN_ID + " .cd-ghead .cd-gl::before{content:'';flex:0 0 auto;width:6px;height:6px;border-radius:2px;background:var(--gcolor,var(--ac));}" +
  "#" + WIN_ID + " .cd-ghead .cd-gc{font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:8px;background:var(--bd);background:color-mix(in srgb,var(--gcolor,var(--ac)) 18%,transparent);color:var(--muted);color:color-mix(in srgb,var(--gcolor,var(--ac)) 78%,var(--fg));}" +
  "#" + WIN_ID + " .cd-gdot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--gcolor,var(--ac));box-shadow:0 0 0 3px color-mix(in srgb,var(--gcolor,var(--ac)) 20%,transparent);}" +
  "#" + WIN_ID + " .cd-chev{width:9px;font-size:9px;transition:transform .12s;}" +
  "#" + WIN_ID + " .cd-group.collapsed .cd-chev{transform:rotate(-90deg);}" +
  "#" + WIN_ID + " .cd-group.collapsed .cd-items{display:none;}" +
  "#" + WIN_ID + " .cd-item{position:relative;margin:1px 0;padding:8px 10px 9px 15px;border-radius:9px;cursor:pointer;}" +
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
  "#" + WIN_ID + " .cd-it-act button{border:none;background:none;cursor:pointer;color:var(--faint);font-size:12px;padding:2px 4px;border-radius:5px;opacity:0;}" +
  "#" + WIN_ID + " .cd-item:hover .cd-it-act button,#" + WIN_ID + " .cd-item.active .cd-it-act button{opacity:.7;}" +
  "#" + WIN_ID + " .cd-it-act button:hover{opacity:1;background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-it-act .on-pin{opacity:1;color:var(--ty);}" +
  "#" + WIN_ID + " .cd-it-act .on-read{opacity:1;color:var(--ts);}" +
  "#" + WIN_ID + " .cd-empty{padding:20px 14px;text-align:center;color:var(--faint);font-size:12px;}" +

  // Читалка
  "#" + WIN_ID + " .cd-reader{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0;}" +
  "#" + WIN_ID + " .cd-rbar{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--bd);background:linear-gradient(180deg,var(--hl),transparent);}" +
  "#" + WIN_ID + " .cd-rtitle{flex:1 1 auto;display:flex;align-items:center;min-width:0;font-weight:700;font-size:13.5px;white-space:nowrap;overflow:hidden;}" +
  "#" + WIN_ID + " .cd-tocwrap{position:relative;flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-rbtn{border:1px solid var(--bd);background:var(--panel);color:var(--muted);cursor:pointer;font-family:inherit;font-size:11.5px;padding:5px 10px;border-radius:8px;white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-rbtn:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-rbtn.on{color:var(--ts);border-color:var(--ts);}" +
  "#" + WIN_ID + " .cd-tocmenu{position:absolute;right:0;top:calc(100% + 4px);z-index:5;min-width:230px;max-width:340px;max-height:60vh;overflow-y:auto;" +
  "background:var(--bg);border:1px solid var(--bd);border-radius:10px;box-shadow:0 12px 34px rgba(0,0,0,.5);padding:5px;}" +
  "#" + WIN_ID + " .cd-tocmenu button{display:block;width:100%;text-align:left;border:none;background:none;color:var(--fg);cursor:pointer;font-family:inherit;font-size:12px;padding:5px 8px;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-tocmenu button:hover{background:var(--hl);}" +
  "#" + WIN_ID + " .cd-tocmenu .lvl3{padding-left:20px;color:var(--muted);font-size:11.5px;}" +
  "#" + WIN_ID + " .cd-rmain{position:relative;flex:1 1 auto;display:flex;min-height:0;min-width:0;}" +

  // --- Главный экран (приветствие / возвращение) — оверлей поверх области чтения ---
  "#" + WIN_ID + " .cd-home{position:absolute;inset:0;z-index:7;overflow-y:auto;" +
  "background:radial-gradient(120% 68% at 50% -12%,rgba(var(--ac-rgb),.15),transparent 60%),radial-gradient(85% 55% at 108% 112%,rgba(var(--ac-rgb),.08),transparent 55%),var(--bg);}" +
  "#" + WIN_ID + " .cd-home-inner{max-width:880px;margin:0 auto;padding:32px 30px 64px;}" +
  // Герой — градиентная панель с мягким свечением
  "#" + WIN_ID + " .cd-home-hero{position:relative;display:flex;align-items:center;justify-content:space-between;gap:20px 24px;margin-bottom:18px;padding:18px 24px;border-radius:18px;overflow:hidden;flex-wrap:wrap;" +
  "background:linear-gradient(135deg,color-mix(in srgb,var(--ac) 15%,var(--panel)),var(--panel));border:1px solid color-mix(in srgb,var(--ac) 24%,var(--bd));}" +
  "#" + WIN_ID + " .cd-home-hero::before{content:'';position:absolute;top:-45%;right:-8%;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(var(--ac-rgb),.20),transparent 70%);pointer-events:none;}" +
  "#" + WIN_ID + " .cd-home-hero::after{content:'';position:absolute;left:-6%;bottom:-60%;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(var(--ac-rgb),.10),transparent 70%);pointer-events:none;}" +
  "#" + WIN_ID + " .cd-home-hero{box-shadow:inset 0 1px 0 rgba(255,255,255,.05);}" +
  // Лид героя (маскот + приветствие) слева, статистика — справа; на узком окне статистика переносится вниз.
  "#" + WIN_ID + " .cd-hero-lead{position:relative;z-index:1;display:flex;align-items:center;gap:18px;flex:1 1 260px;min-width:0;}" +
  "#" + WIN_ID + " .cd-hero-stats{position:relative;z-index:1;flex:1 1 300px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dtile{padding:9px 11px;border-radius:12px;gap:2px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dtile:hover{transform:none;box-shadow:none;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-ic{width:24px;height:24px;font-size:12px;border-radius:7px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-v{font-size:15px;margin-top:3px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-l{font-size:10px;line-height:1.25;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-bar{margin-top:7px;height:4px;}" +
  // маскот героя — наклейка-настроение на мягком радиальном свечении
  "#" + WIN_ID + " .cd-home-mascot{position:relative;flex:0 0 auto;width:96px;height:96px;display:flex;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-home-mascot::before{content:'';position:absolute;inset:-4px;border-radius:50%;background:radial-gradient(circle,rgba(var(--ac-rgb),.28),transparent 66%);z-index:0;}" +
  "#" + WIN_ID + " .cd-home-mascot .cd-sticker,#" + WIN_ID + " .cd-home-mascot img{position:relative;z-index:1;}" +
  "#" + WIN_ID + " .cd-home-mascot .cd-sticker{filter:drop-shadow(0 8px 18px rgba(0,0,0,.38));transform:rotate(-5deg);transition:transform .25s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-home-mascot:hover .cd-sticker{transform:rotate(0) scale(1.05);}" +
  "#" + WIN_ID + " .cd-home-htxt{flex:1 1 200px;min-width:0;}" +
  "#" + WIN_ID + " .cd-home-hi{font-size:25px;font-weight:800;letter-spacing:-.015em;color:var(--fg);line-height:1.12;}" +
  "#" + WIN_ID + " .cd-home-sub{font-size:13px;color:var(--muted);margin-top:5px;}" +
  // Кольцо общего прогресса
  "#" + WIN_ID + " .cd-ring{flex:0 0 auto;position:relative;width:74px;height:74px;}" +
  "#" + WIN_ID + " .cd-ring svg{width:100%;height:100%;transform:rotate(-90deg);}" +
  "#" + WIN_ID + " .cd-ring-bg{fill:none;stroke:var(--bd);stroke-width:5;}" +
  "#" + WIN_ID + " .cd-ring-fg{fill:none;stroke:var(--ac);stroke-width:5;stroke-linecap:round;transition:stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-ring-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-ring-pct{font-size:17px;font-weight:800;color:var(--fg);line-height:1;font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-ring-sub{font-size:8px;color:var(--faint);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;}" +
  "#" + WIN_ID + " .cd-home-cont{display:flex;align-items:center;gap:14px;width:100%;text-align:left;font-family:inherit;cursor:pointer;border:1px solid rgba(var(--ac-rgb),.30);" +
  "background:linear-gradient(135deg,rgba(var(--ac-rgb),.17),rgba(var(--ac-rgb),.05));border-radius:16px;padding:16px 20px;margin-bottom:14px;transition:transform .14s,box-shadow .14s,border-color .14s;}" +
  "#" + WIN_ID + " .cd-home-cont:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.28);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-hc-main{flex:1 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-hc-arrow{flex:0 0 auto;font-size:22px;color:var(--ac);opacity:.7;transition:transform .16s,opacity .16s;}" +
  "#" + WIN_ID + " .cd-home-cont:hover .cd-hc-arrow{transform:translateX(4px);opacity:1;}" +
  "#" + WIN_ID + " .cd-hc-lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--ac);}" +
  "#" + WIN_ID + " .cd-hc-title{font-size:17px;font-weight:700;color:var(--fg);margin:5px 0 2px;}" +
  "#" + WIN_ID + " .cd-hc-meta{font-size:11.5px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-hc-bar{height:6px;border-radius:999px;background:var(--bd);overflow:hidden;margin-top:12px;}" +
  "#" + WIN_ID + " .cd-hc-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--ac),var(--ac2));border-radius:999px;transition:width .5s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-hc-prog{font-size:11px;color:var(--muted);margin-top:7px;font-variant-numeric:tabular-nums;}" +
  // Дашборд-плитки (#1)
  "#" + WIN_ID + " .cd-dash{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 26px;}" +
  "#" + WIN_ID + " .cd-dtile{border:1px solid var(--bd);border-radius:14px;background:var(--panel);padding:13px 15px;display:flex;flex-direction:column;gap:3px;transition:transform .13s,box-shadow .13s,border-color .13s;}" +
  "#" + WIN_ID + " .cd-dtile:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.16);border-color:color-mix(in srgb,var(--ac) 35%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dt-ic{width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;}" +
  "#" + WIN_ID + " .cd-dt-read .cd-dt-ic{background:rgba(137,180,250,.16);}" +
  "#" + WIN_ID + " .cd-dt-solve .cd-dt-ic{background:rgba(166,227,161,.16);}" +
  "#" + WIN_ID + " .cd-dt-streak .cd-dt-ic{background:rgba(250,179,135,.16);}" +
  "#" + WIN_ID + " .cd-dt-v{font-size:19px;font-weight:800;color:var(--fg);font-variant-numeric:tabular-nums;margin-top:5px;}" +
  "#" + WIN_ID + " .cd-dt-l{font-size:11px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-dt-bar{height:5px;border-radius:999px;background:var(--bd);overflow:hidden;margin-top:9px;}" +
  "#" + WIN_ID + " .cd-dt-bar i{display:block;height:100%;border-radius:999px;transition:width .6s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-dt-read .cd-dt-bar i{background:linear-gradient(90deg,#89b4fa,#b4befe);}" +
  "#" + WIN_ID + " .cd-dt-solve .cd-dt-bar i{background:linear-gradient(90deg,#a6e3a1,#94e2d5);}" +
  "#" + WIN_ID + " .cd-home-sec{display:flex;align-items:center;gap:9px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.9px;color:var(--muted);margin:26px 0 13px;padding-bottom:8px;border-bottom:1px solid var(--bd2);}" +
  "#" + WIN_ID + " .cd-sec-dot{width:7px;height:7px;border-radius:2px;flex:0 0 auto;background:var(--sc,var(--ac));box-shadow:0 0 8px color-mix(in srgb,var(--sc,var(--ac)) 55%,transparent);}" +
  "#" + WIN_ID + " .cd-sec-count{margin-left:auto;font-size:10px;letter-spacing:0;color:var(--faint);opacity:.85;padding:1px 8px;border-radius:8px;background:var(--hl);}" +
  "#" + WIN_ID + " .cd-hcard-go{position:absolute;right:12px;bottom:11px;font-size:15px;color:var(--gcolor,var(--ac));opacity:0;transform:translateX(-4px);transition:opacity .15s,transform .15s;}" +
  "#" + WIN_ID + " .cd-home-card:hover .cd-hcard-go{opacity:.9;transform:none;}" +
  "#" + WIN_ID + " .cd-home-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-home-card{position:relative;text-align:left;font-family:inherit;cursor:pointer;border:1px solid var(--bd);background:linear-gradient(180deg,color-mix(in srgb,var(--fg) 2%,var(--panel)),var(--panel));border-radius:14px;padding:14px 32px 14px 18px;overflow:hidden;transition:transform .14s,box-shadow .14s,border-color .14s,background .14s;}" +
  "#" + WIN_ID + " .cd-home-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--gcolor,var(--ac));opacity:.85;}" +
  "#" + WIN_ID + " .cd-home-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(0,0,0,.24);border-color:color-mix(in srgb,var(--gcolor,var(--ac)) 45%,var(--bd));background:color-mix(in srgb,var(--gcolor,var(--ac)) 7%,var(--panel));}" +
  "#" + WIN_ID + " .cd-hcard-head{display:flex;align-items:center;gap:9px;}" +
  "#" + WIN_ID + " .cd-hcard-ic{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;padding:3px;border-radius:9px;background:color-mix(in srgb,var(--gcolor,var(--ac)) 13%,transparent);}" +
  "#" + WIN_ID + " .cd-hcard-ic .cd-sticker{transition:transform .16s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-home-card:hover .cd-hcard-ic .cd-sticker{transform:scale(1.12) rotate(-4deg);}" +
  "#" + WIN_ID + " .cd-hcard-t{font-size:13.5px;font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-hcard-s{font-size:11.5px;color:var(--muted);margin-top:3px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
  "#" + WIN_ID + " .cd-home-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-home-chip{font-family:inherit;cursor:pointer;font-size:12px;color:var(--fg);border:1px solid var(--bd);background:var(--panel);border-radius:999px;padding:6px 13px;display:inline-flex;align-items:center;gap:7px;transition:border-color .12s,background .12s,transform .12s;}" +
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
  "#" + WIN_ID + " .cd-tab-x{border:none;background:none;color:var(--faint);cursor:pointer;font-size:11px;line-height:1;padding:2px 3px;border-radius:4px;}" +
  "#" + WIN_ID + " .cd-tab-x:hover{background:var(--hl);color:var(--fg);}" +

  // Второй документ рядом (сплит)
  "#" + WIN_ID + " .cd-split{flex:1 1 0;min-width:0;display:flex;flex-direction:column;border-left:1px solid var(--bd);background:var(--bg);}" +
  "#" + WIN_ID + ".split .cd-content{flex:1 1 0;}" +
  "#" + WIN_ID + ".split .cd-outline{display:none;}" +
  "#" + WIN_ID + " .cd-split-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--bd);background:linear-gradient(180deg,var(--hl),transparent);}" +
  "#" + WIN_ID + " .cd-split-title{flex:1 1 auto;font-weight:700;font-size:12.5px;color:var(--ac2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-split-x{flex:0 0 auto;border:none;background:none;color:var(--muted);cursor:pointer;font-size:13px;padding:2px 7px;border-radius:6px;}" +
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
  "#" + WIN_ID + " .cd-article code{background:var(--code);border:1px solid var(--bd2);border-radius:5px;padding:1px 5px;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12px;}" +
  "#" + WIN_ID + " .cd-article strong{color:var(--fg);font-weight:700;}" +
  "#" + WIN_ID + " .cd-article hr{border:none;border-top:1px solid var(--bd);margin:20px 0;}" +
  "#" + WIN_ID + " .cd-article blockquote{margin:12px 0;padding:10px 14px;border-left:3px solid var(--ac);border-radius:0 8px 8px 0;background:var(--hl);}" +
  "#" + WIN_ID + " .cd-article blockquote p{margin:5px 0;}" +
  // Спойлеры-подсказки задачника (<details class="cd-spoiler">)
  "#" + WIN_ID + " .cd-article details.cd-spoiler{margin:10px 0;border:1px solid var(--bd);border-radius:9px;background:var(--panel);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary{cursor:pointer;padding:9px 13px;font-weight:600;font-size:13px;color:var(--ac2);list-style:none;user-select:none;background:var(--hl);}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary::-webkit-details-marker{display:none;}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary::before{content:'▸';display:inline-block;width:1em;color:var(--ac);transition:transform .12s;}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler[open]>summary::before{transform:rotate(90deg);}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary:hover{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler .cd-spoiler-body{padding:2px 14px 8px;}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler .cd-spoiler-body>:first-child{margin-top:6px;}" +
  // Мелкая подпись-легенда (<sub> из задачника → <small class="cd-cap">)
  "#" + WIN_ID + " .cd-article .cd-cap{font-size:.85em;color:var(--faint);}" +
  // Чипы сложности (#3): цветной кружок с мягким кольцом
  "#" + WIN_ID + " .cd-diff{display:inline-block;width:11px;height:11px;border-radius:50%;vertical-align:middle;margin:0 1px;}" +
  "#" + WIN_ID + " .cd-diff.d-e{background:#40c057;box-shadow:0 0 0 3px rgba(64,192,87,.18);}" +
  "#" + WIN_ID + " .cd-diff.d-m{background:#f2b705;box-shadow:0 0 0 3px rgba(242,183,5,.18);}" +
  "#" + WIN_ID + " .cd-diff.d-h{background:#fa5252;box-shadow:0 0 0 3px rgba(250,82,82,.18);}" +
  "#" + WIN_ID + " .cd-article h2.cd-task .cd-diff{margin-left:4px;}" +
  // Прогресс по задачнику: счётчик темы + отметка «решено» у задач
  "#" + WIN_ID + " .cd-article .cd-taskbar{margin:2px 0 16px;padding:8px 12px;border:1px solid var(--bd);border-radius:9px;background:var(--hl);font-size:13px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar b{color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-article h2.cd-task{display:flex;align-items:center;flex-wrap:wrap;gap:10px;}" +
  "#" + WIN_ID + " .cd-article h2.cd-task.cd-task-done{opacity:.72;}" +
  "#" + WIN_ID + " .cd-article .cd-solve{cursor:pointer;font:inherit;font-size:11px;font-weight:600;line-height:1;padding:5px 10px;border-radius:999px;border:1px solid var(--bd);background:var(--panel);color:var(--muted);white-space:nowrap;transition:all .12s;}" +
  "#" + WIN_ID + " .cd-article .cd-solve:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-solve.on{background:var(--ac);border-color:var(--ac);color:#11111b;}" +
  "#" + WIN_ID + " .cd-article h2.cd-task.cd-task-done>a.cd-anchor,#" + WIN_ID + " .cd-article h2.cd-task.cd-task-done{text-decoration:none;}" +
  // #3 Карточка задачи: каждая ## N.M. со своим условием — в аккуратной карточке
  "#" + WIN_ID + " .cd-article .cd-taskcard{margin:18px 0;padding:4px 18px 16px;border:1px solid color-mix(in srgb,var(--fg) 16%,transparent);border-radius:12px;background:color-mix(in srgb,var(--fg) 6.5%,var(--panel));box-shadow:0 3px 10px rgba(0,0,0,.22);}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task{border-bottom-color:color-mix(in srgb,var(--fg) 10%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task{margin-top:14px;}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task::before{display:none;}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task+p em{color:var(--muted);}" +
  // #4 Сегментированный прогресс темы (в .cd-taskbar)
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-top{margin-bottom:8px;}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-track{display:flex;gap:4px;}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-cell{flex:1 1 0;height:7px;border-radius:4px;background:var(--bd);transition:background .18s;}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-cell.on{background:linear-gradient(90deg,var(--ac),var(--ac2));}" +
  // Личные заметки к материалу (внизу читалки)
  "#" + WIN_ID + " .cd-article .cd-notes{margin:34px 0 6px;padding-top:18px;border-top:1px dashed var(--bd);}" +
  "#" + WIN_ID + " .cd-article .cd-notes-h{font-size:13px;font-weight:700;color:var(--ac2);margin-bottom:8px;}" +
  "#" + WIN_ID + " .cd-article .cd-notes-ta{width:100%;min-height:70px;resize:vertical;padding:10px 12px;border:1px solid var(--bd);border-radius:9px;background:var(--nav);color:var(--fg);font:inherit;font-size:13.5px;line-height:1.5;outline:none;transition:border-color .12s;}" +
  "#" + WIN_ID + " .cd-article .cd-notes-ta:focus{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-notes-ta::placeholder{color:var(--faint);}" +
  "#" + WIN_ID + " .cd-item.has-note .cd-it-title::after{content:'📝';margin-left:6px;font-size:.85em;opacity:.75;}" +
  "#" + WIN_ID + " .cd-article img{max-width:100%;border-radius:8px;}" +

  // Таблицы
  "#" + WIN_ID + " .tablewrap{overflow-x:auto;margin:12px 0;border:1px solid var(--bd);border-radius:9px;}" +
  "#" + WIN_ID + " .cd-article table{border-collapse:collapse;width:100%;font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-article th,#" + WIN_ID + " .cd-article td{padding:7px 11px;text-align:left;border-bottom:1px solid var(--bd);vertical-align:top;}" +
  "#" + WIN_ID + " .cd-article th{background:var(--hl);font-weight:700;color:var(--ac2);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-article tbody tr:last-child td{border-bottom:none;}" +
  "#" + WIN_ID + " .cd-article tbody tr:hover{background:var(--bd2);}" +

  // Блоки кода — с верхней шапкой (язык + копировать)
  "#" + WIN_ID + " .codewrap{position:relative;margin:14px 0;border:1px solid var(--bd);border-radius:10px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.10);}" +
  "#" + WIN_ID + " .codehead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 8px 5px 12px;background:color-mix(in srgb,var(--ac) 10%,var(--code));border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .codelang{font-size:10px;text-transform:uppercase;letter-spacing:.7px;font-weight:800;color:var(--ac);}" +
  "#" + WIN_ID + " .copybtn{border:1px solid var(--bd);background:var(--bg);color:var(--muted);cursor:pointer;" +
  "font-family:inherit;font-size:10.5px;padding:3px 9px;border-radius:7px;opacity:.75;transition:opacity .12s,border-color .12s,color .12s;}" +
  "#" + WIN_ID + " .copybtn .cb-ic{font-size:11px;}" +
  "#" + WIN_ID + " .codewrap:hover .copybtn{opacity:1;}" +
  "#" + WIN_ID + " .copybtn:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .copybtn.done{color:var(--ts);border-color:var(--ts);}" +
  "#" + WIN_ID + " pre.code{margin:0;padding:14px 16px;overflow-x:auto;background:var(--code);border:none;border-radius:0;" +
  "font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;line-height:1.55;}" +
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
  "#" + WIN_ID + " ::-webkit-scrollbar-thumb{background:var(--bd);border-radius:6px;border:2px solid transparent;background-clip:padding-box;}" +
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

  // Меню вида: размер шрифта / ширина колонки / плотность списка
  "#" + WIN_ID + " .cd-viewmenu{position:absolute;right:0;top:calc(100% + 4px);z-index:5;min-width:230px;background:var(--bg);border:1px solid var(--bd);border-radius:10px;box-shadow:0 12px 34px rgba(0,0,0,.5);padding:6px;}" +
  "#" + WIN_ID + " .cd-vm-row{display:flex;align-items:center;gap:8px;padding:6px;font-size:11.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-vm-row .cd-vm-lbl{flex:1 1 auto;}" +
  "#" + WIN_ID + " .cd-seg{display:inline-flex;border:1px solid var(--bd);border-radius:7px;overflow:hidden;}" +
  "#" + WIN_ID + " .cd-seg button{border:none;background:var(--panel);color:var(--muted);cursor:pointer;font-family:inherit;font-size:11.5px;padding:3px 9px;min-width:26px;}" +
  "#" + WIN_ID + " .cd-seg button.on{background:var(--ac);color:#fff;}" +
  "#" + WIN_ID + " .cd-seg button:not(.on):hover{background:var(--hl);color:var(--fg);}" +

  // Врезки-callouts: цвет по ведущему значку (класс .note + инлайновые --nc/--nbg)
  "#" + WIN_ID + " .cd-article blockquote.note{border-left-color:var(--nc,var(--ac));background:var(--nbg,var(--hl));}" +
  // Рисованная иконка-наклейка в начале врезки (роль callout'а)
  "#" + WIN_ID + " .cd-article blockquote.note.has-ic{position:relative;padding-left:46px;}" +
  "#" + WIN_ID + " .cd-article blockquote.note .cd-note-ic{position:absolute;left:12px;top:9px;width:24px;height:24px;object-fit:contain;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.18));}" +
  // Опросник (```quiz) и «найди ошибку» (```findbug)
  "#" + WIN_ID + " .cd-article .cd-quiz-head,#" + WIN_ID + " .cd-article .cd-fb-head{font-weight:700;color:var(--ac2);font-size:13.5px;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-q{margin:0 0 12px;padding:12px 14px;border:1px solid var(--bd);border-radius:11px;background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-qt{font-weight:600;margin-bottom:9px;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-n{color:var(--ac2);margin-right:2px;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opts{display:flex;flex-direction:column;gap:6px;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt{display:flex;align-items:center;gap:10px;text-align:left;font:inherit;font-size:13px;color:var(--fg);cursor:pointer;padding:8px 12px;border:1px solid var(--bd);border-radius:9px;background:var(--bg);transition:border-color .12s,background .12s;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-mark{flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:16px;height:16px;border:2px solid var(--faint);border-radius:50%;font-size:11px;line-height:1;color:#11111b;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.right{border-color:#a6e3a1;background:rgba(166,227,161,.13);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.right .cd-quiz-mark{border-color:#a6e3a1;background:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.right .cd-quiz-mark::after{content:'\\2713';}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.wrong{border-color:#f38ba8;background:rgba(243,139,168,.13);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.wrong .cd-quiz-mark{border-color:#f38ba8;background:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.wrong.picked .cd-quiz-mark::after{content:'\\2715';}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-expl{margin-top:10px;padding:9px 12px;border-left:3px solid var(--ac);border-radius:0 8px 8px 0;background:var(--hl);font-size:12.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-reveal,#" + WIN_ID + " .cd-article .cd-fb-reveal{margin-top:10px;font:inherit;font-size:11.5px;font-weight:600;color:var(--muted);background:none;border:1px solid var(--bd);border-radius:999px;padding:5px 12px;cursor:pointer;transition:all .12s;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-reveal:hover,#" + WIN_ID + " .cd-article .cd-fb-reveal:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-fb{margin:14px 0;padding:12px 14px 14px;border:1px solid var(--bd);border-radius:11px;background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-fb-code{margin:0;border:1px solid var(--bd);border-radius:9px;}" +
  "#" + WIN_ID + " .cd-article .cd-fb-ans{margin-top:10px;padding:2px 13px;border-left:3px solid #f9b47a;border-radius:0 8px 8px 0;background:rgba(249,180,122,.11);}" +
  "#" + WIN_ID + " .cd-article .cd-fb-ans>:first-child{margin-top:8px;}" +
  // Флеш-карточки / «заполни пропуск» / тесты к задаче
  "#" + WIN_ID + " .cd-article .cd-cards-head,#" + WIN_ID + " .cd-article .cd-fc-head,#" + WIN_ID + " .cd-article .cd-tests-head{font-weight:700;color:var(--ac2);font-size:13.5px;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-cards,#" + WIN_ID + " .cd-article .cd-fc,#" + WIN_ID + " .cd-article .cd-tests{margin:14px 0;}" +
  "#" + WIN_ID + " .cd-article .cd-card{position:relative;margin:0 0 10px;padding:13px 14px;border:1px solid var(--bd);border-radius:11px;background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-card-due{position:absolute;right:12px;top:11px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;}" +
  "#" + WIN_ID + " .cd-article .cd-card-due.due{color:#11111b;background:#f9b47a;}" +
  "#" + WIN_ID + " .cd-article .cd-card-due.neu{color:var(--muted);background:var(--hl);}" +
  "#" + WIN_ID + " .cd-article .cd-card-due.lat{color:var(--faint);border:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-article .cd-card-q{font-weight:600;padding-right:120px;}" +
  "#" + WIN_ID + " .cd-article .cd-card-a{margin-top:9px;padding:9px 12px;border-left:3px solid #a6e3a1;border-radius:0 8px 8px 0;background:rgba(166,227,161,.12);}" +
  "#" + WIN_ID + " .cd-article .cd-card-ctl{margin-top:10px;display:flex;align-items:center;gap:7px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-card-show,#" + WIN_ID + " .cd-article .cd-fc-check,#" + WIN_ID + " .cd-article .cd-fc-reveal{font:inherit;font-size:11.5px;font-weight:600;color:var(--muted);background:none;border:1px solid var(--bd);border-radius:999px;padding:5px 12px;cursor:pointer;transition:all .12s;}" +
  "#" + WIN_ID + " .cd-article .cd-card-show:hover,#" + WIN_ID + " .cd-article .cd-fc-check:hover,#" + WIN_ID + " .cd-article .cd-fc-reveal:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-card-rate{display:inline-flex;gap:6px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-card-btn{font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;border-radius:999px;padding:5px 11px;border:1px solid var(--bd);background:var(--bg);color:var(--fg);transition:all .12s;}" +
  "#" + WIN_ID + " .cd-article .cd-card-btn[data-g='0']:hover{border-color:#f38ba8;color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-card-btn[data-g='1']:hover{border-color:#f9b47a;color:#f9b47a;}" +
  "#" + WIN_ID + " .cd-article .cd-card-btn[data-g='2']:hover{border-color:#a6e3a1;color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-card-done{font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-card-rated{opacity:.72;}" +
  "#" + WIN_ID + " .cd-article .cd-fc-code{margin:0 0 10px;border:1px solid var(--bd);border-radius:9px;}" +
  "#" + WIN_ID + " .cd-article .cd-fc-in{font-family:inherit;font-size:inherit;background:var(--bg);border:1px solid var(--ac);border-radius:5px;color:var(--fg);padding:0 4px;margin:0 1px;}" +
  "#" + WIN_ID + " .cd-article .cd-fc-in.right{border-color:#a6e3a1;background:rgba(166,227,161,.15);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-in.wrong{border-color:#f38ba8;background:rgba(243,139,168,.15);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-ctl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-fc-msg,#" + WIN_ID + " .cd-article .cd-tests-note{font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-tests-note{margin-top:8px;}" +
  "#" + WIN_ID + " .cd-article .cd-tests-copy{font:inherit;font-size:10px;padding:2px 7px;border-radius:6px;border:1px solid var(--bd);background:var(--bg);color:var(--muted);cursor:pointer;margin-left:6px;}" +
  "#" + WIN_ID + " .cd-article .cd-tests-copy:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-tests-copy.done{color:var(--ts);border-color:var(--ts);}" +

  // Подсветка отдельных строк кода (```cpp {3,5-7})
  "#" + WIN_ID + " pre.code.cd-lined code{display:block;}" +
  "#" + WIN_ID + " pre.code.cd-lined .cd-ln{display:block;}" +
  "#" + WIN_ID + " pre.code.cd-lined .cd-hl{background:rgba(var(--ac-rgb),.14);border-left:2px solid var(--ac);margin:0 -16px;padding:0 16px 0 14px;}" +

  // Диаграмма/схема (```diagram, ```svg)
  "#" + WIN_ID + " .cd-article .cd-figure{margin:16px 0;padding:16px 14px 12px;border:1px solid var(--bd);border-radius:12px;background:color-mix(in srgb,var(--fg) 3%,var(--panel));text-align:center;}" +
  "#" + WIN_ID + " .cd-article .cd-figure-art{overflow-x:auto;}" +
  "#" + WIN_ID + " .cd-article .cd-figure svg{max-width:100%;height:auto;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-figure figcaption{margin-top:10px;font-size:12px;color:var(--muted);}" +

  // Было/стало в две колонки (```badgood)
  "#" + WIN_ID + " .cd-article .cd-badgood{display:flex;gap:12px;margin:14px 0;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col{flex:1 1 260px;min-width:0;border:1px solid var(--bd);border-radius:10px;overflow:hidden;}" +
  "#" + WIN_ID + " .cd-article .cd-bg-lab{font-size:12px;font-weight:700;padding:6px 12px;border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col.bad .cd-bg-lab{color:#f38ba8;background:rgba(243,139,168,.12);}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col.good .cd-bg-lab{color:#a6e3a1;background:rgba(166,227,161,.12);}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col pre.code{border-radius:0;}" +

  // Транскрипт консоли (```console)
  "#" + WIN_ID + " .cd-article .cd-console{margin:14px 0;border:1px solid var(--bd);border-radius:10px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.10);}" +
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
  "#" + WIN_ID + " .cd-article .cd-check{margin:16px 0;padding:14px;border:1px solid var(--bd);border-radius:12px;background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-check-head{font-weight:700;color:var(--ac2);font-size:13.5px;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-check-item{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;font:inherit;font-size:13px;color:var(--fg);cursor:pointer;padding:8px 10px;border:1px solid transparent;border-radius:9px;background:none;transition:background .12s;}" +
  "#" + WIN_ID + " .cd-article .cd-check-item:hover{background:var(--hl);}" +
  "#" + WIN_ID + " .cd-article .cd-check-box{flex:0 0 auto;width:17px;height:17px;margin-top:1px;border:2px solid var(--faint);border-radius:5px;transition:all .12s;}" +
  "#" + WIN_ID + " .cd-article .cd-check-item.on .cd-check-box{border-color:#a6e3a1;background:#a6e3a1;position:relative;}" +
  "#" + WIN_ID + " .cd-article .cd-check-item.on .cd-check-box::after{content:'\\2713';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#11111b;}" +
  "#" + WIN_ID + " .cd-article .cd-check-item.on .cd-check-txt{color:var(--muted);text-decoration:line-through;}" +

  // Вспышка при переходе к разделу (по ссылке/оглавлению)
  "@keyframes cd-flash{0%{background:rgba(var(--ac-rgb),.32);}100%{background:transparent;}}" +
  "#" + WIN_ID + " .cd-flash{animation:cd-flash 1.1s ease-out;border-radius:6px;}" +

  // Мягкое проявление статьи при открытии + плавный ховер пунктов
  "@keyframes cd-fade{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + " .cd-article.fade{animation:cd-fade .18s ease-out;}" +
  "#" + WIN_ID + " .cd-item{transition:background .12s;}" +

  // Доступность: видимая обводка при навигации с клавиатуры
  "#" + WIN_ID + " button:focus-visible,#" + WIN_ID + " input:focus-visible,#" + WIN_ID + " [tabindex]:focus-visible{outline:2px solid var(--ac);outline-offset:1px;border-radius:6px;}" +

  // Ширина колонки чтения (широкий режим)
  "#" + WIN_ID + ".wide .cd-article{max-width:1180px;}" +

  // Плотный список файлов (компактный режим)
  "#" + WIN_ID + ".dense .cd-item{padding:5px 8px 5px 12px;}" +
  "#" + WIN_ID + ".dense .cd-it-sub{display:none;}" +
  "#" + WIN_ID + ".dense .cd-it-meta{margin-top:1px;}" +
  "#" + WIN_ID + ".dense .cd-it-title{font-size:12px;padding-right:34px;}" +

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
  "background:linear-gradient(135deg,rgba(234,179,8,.16),rgba(234,179,8,.04));border-radius:14px;padding:15px 18px;margin-bottom:26px;}" +
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
  "#" + WIN_ID + " .cd-viewmenu{animation:cd-menu-in .14s ease-out;}" +
  "@keyframes cd-split-in{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + " .cd-split{animation:cd-split-in .2s ease-out;}" +
  // Плавные ховеры и тактильный отклик на нажатие
  "#" + WIN_ID + " .cd-rbtn,#" + WIN_ID + " .cd-hbtn,#" + WIN_ID + " .cd-tab,#" + WIN_ID + " .cd-ol,#" + WIN_ID + " .cd-continue{transition:background .13s ease,color .13s ease,border-color .13s ease,transform .12s ease;}" +
  "#" + WIN_ID + " .cd-rn{transition:background .13s ease,border-color .13s ease,transform .12s ease,box-shadow .12s ease;}" +
  "#" + WIN_ID + " .cd-rn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.18);}" +
  "#" + WIN_ID + " .cd-continue:hover{transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-hbtn:active,#" + WIN_ID + " .cd-rbtn:active,#" + WIN_ID + " .cd-continue:active{transform:scale(.93);}" +
  "#" + WIN_ID + " .cd-item{transition:background .13s ease,box-shadow .13s ease;}" +
  "#" + WIN_ID + " .cd-item:hover{box-shadow:inset 0 0 0 1px var(--bd2);}" +
  "#" + WIN_ID + " .cd-item.active{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gcolor,var(--ac)) 26%,transparent);}" +

  // Кнопка-запуск (плавающая пилюля)
  "#" + BTN_ID + "{position:fixed;z-index:2147482000;right:18px;bottom:30px;display:inline-flex;align-items:center;gap:7px;" +
  "padding:9px 15px;border-radius:999px;border:1px solid rgba(var(--cppdocs-ac-rgb,137,180,250),.45);cursor:pointer;user-select:none;" +
  "background:rgba(24,24,37,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#cdd6f4;" +
  "font-family:var(--vscode-font-family,'Segoe UI',system-ui,sans-serif);font-size:12.5px;font-weight:700;" +
  "box-shadow:0 6px 20px rgba(0,0,0,.4);transition:transform .12s,box-shadow .12s;}" +
  "#" + BTN_ID + ":hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,.5);}" +
  "#" + BTN_ID + " .cd-btn-face{display:inline-flex;align-items:center;line-height:0;}" +
  "#" + BTN_ID + " .cd-btn-face .cd-sticker{filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));}" +
  "#" + BTN_ID + " .cd-badge{font-size:10px;font-weight:800;padding:1px 7px;border-radius:999px;background:rgba(var(--cppdocs-ac-rgb,137,180,250),.28);color:var(--cppdocs-ac2,#b4befe);}" +

  // --- Полировка (#5): тематические скроллбары, фокус-обводки, поднятие карточек ---
  "#" + WIN_ID + " ::-webkit-scrollbar{width:10px;height:10px;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-track{background:transparent;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-thumb{background:var(--bd);border-radius:8px;border:2px solid transparent;background-clip:content-box;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-thumb:hover{background:var(--faint);}" +
  "#" + WIN_ID + " *{scrollbar-width:thin;scrollbar-color:var(--bd) transparent;}" +
  "#" + WIN_ID + " button:focus-visible,#" + WIN_ID + " a:focus-visible,#" + WIN_ID + " textarea:focus-visible,#" + WIN_ID + " input:focus-visible{outline:2px solid var(--ac);outline-offset:2px;border-radius:6px;}" +
  "#" + WIN_ID + " .cd-home-chip:hover{transform:translateY(-1px);border-color:var(--ac);}" +

  // --- Новое: список задач «- [ ] …», якоря заголовков, кнопки «наверх»/«копировать», практика ---
  // Интерактивные чек-боксы в обычных списках
  "#" + WIN_ID + " .cd-article ul.cd-tasklist{list-style:none;padding-left:2px;}" +
  "#" + WIN_ID + " .cd-article li.cd-tl{display:flex;align-items:flex-start;gap:9px;margin:5px 0;}" +
  "#" + WIN_ID + " .cd-tl-box{flex:0 0 auto;margin-top:2px;width:17px;height:17px;padding:0;cursor:pointer;border:1.6px solid var(--faint);border-radius:5px;background:transparent;transition:background .12s,border-color .12s;}" +
  "#" + WIN_ID + " .cd-tl-box:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-tl-box.on{border-color:var(--ts);background:var(--ts);position:relative;}" +
  "#" + WIN_ID + " .cd-tl-box.on::after{content:'\\2713';position:absolute;left:1px;top:-2px;font-size:12px;font-weight:700;color:var(--panel);}" +
  "#" + WIN_ID + " .cd-tl-txt.done{opacity:.6;text-decoration:line-through;}" +
  // Якорь «#» у заголовка — виден при наведении на заголовок
  "#" + WIN_ID + " .cd-article h2,#" + WIN_ID + " .cd-article h3{position:relative;}" +
  "#" + WIN_ID + " .cd-hlink{border:none;background:none;cursor:pointer;color:var(--faint);font:inherit;font-weight:700;opacity:0;padding:0 4px;margin-left:4px;transition:opacity .12s,color .12s;vertical-align:middle;}" +
  "#" + WIN_ID + " .cd-article h2:hover .cd-hlink,#" + WIN_ID + " .cd-article h3:hover .cd-hlink{opacity:.55;}" +
  "#" + WIN_ID + " .cd-hlink:hover{opacity:1 !important;color:var(--ac);}" +
  "#" + WIN_ID + " .cd-hlink.copied{opacity:1 !important;color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rbtn.copied{color:var(--ts);border-color:var(--ts);}" +
  // Плавающая кнопка «наверх»
  "#" + WIN_ID + " .cd-totop{position:absolute;right:18px;bottom:18px;z-index:8;width:34px;height:34px;border-radius:50%;cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-size:16px;line-height:1;box-shadow:0 4px 14px rgba(0,0,0,.4);}" +
  "#" + WIN_ID + " .cd-totop:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-totop[hidden]{display:none;}" +
  // Кнопка практики на главном экране
  "#" + WIN_ID + " .cd-home-actions{margin:2px 0 18px;}" +
  "#" + WIN_ID + " .cd-home-rand{cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-family:inherit;font-size:12.5px;font-weight:600;padding:9px 16px;border-radius:10px;transition:border-color .12s,transform .12s;}" +
  "#" + WIN_ID + " .cd-home-rand:hover{border-color:var(--ac);transform:translateY(-1px);}" +
  // Зачёркнутый текст
  "#" + WIN_ID + " .cd-article del{opacity:.7;}" +

  // --- #19 закладки-звёздочки у заголовков ---
  "#" + WIN_ID + " .cd-hmark{border:none;background:none;cursor:pointer;color:var(--faint);font:inherit;opacity:0;padding:0 3px;margin-left:6px;transition:opacity .12s,color .12s;vertical-align:middle;}" +
  "#" + WIN_ID + " .cd-article h2:hover .cd-hmark,#" + WIN_ID + " .cd-article h3:hover .cd-hmark{opacity:.55;}" +
  "#" + WIN_ID + " .cd-hmark:hover{opacity:1 !important;color:var(--ty);}" +
  "#" + WIN_ID + " .cd-hmark.on{opacity:1 !important;color:var(--ty);}" +
  "#" + WIN_ID + " .cd-home-mark{text-align:left;}" +

  // --- #11 поиск по тексту материала ---
  "#" + WIN_ID + " .cd-find{position:absolute;top:10px;right:16px;z-index:9;display:flex;align-items:center;gap:4px;padding:5px 6px;" +
  "background:var(--bg);border:1px solid var(--bd);border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.4);}" +
  "#" + WIN_ID + " .cd-find[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-find-in{border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-family:inherit;font-size:12.5px;padding:5px 8px;border-radius:7px;width:190px;outline:none;}" +
  "#" + WIN_ID + " .cd-find-in:focus{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-find-n{min-width:34px;text-align:center;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-find-n.cd-find-none{color:var(--tp);}" +
  "#" + WIN_ID + " .cd-find-b{border:1px solid transparent;background:none;color:var(--muted);cursor:pointer;font-size:13px;line-height:1;padding:4px 7px;border-radius:6px;}" +
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
  "#" + WIN_ID + " .cd-hs-in{width:100%;padding:10px 12px 10px 34px;border:1px solid var(--bd);border-radius:11px;background:var(--panel);color:var(--fg);font-family:inherit;font-size:13.5px;outline:none;}" +
  "#" + WIN_ID + " .cd-hs-in:focus{border-color:var(--ac);box-shadow:0 0 0 3px rgba(var(--ac-rgb),.16);}" +
  "#" + WIN_ID + " .cd-hs-res{margin-top:6px;border:1px solid var(--bd);border-radius:11px;background:var(--bg);overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.35);}" +
  "#" + WIN_ID + " .cd-hs-res[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-hs-item{display:block;width:100%;text-align:left;border:none;border-bottom:1px solid var(--bd2);background:none;color:var(--fg);cursor:pointer;font-family:inherit;padding:8px 12px;}" +
  "#" + WIN_ID + " .cd-hs-item:hover{background:var(--hl);}" +
  "#" + WIN_ID + " .cd-hs-item b{font-size:13px;font-weight:600;}" +
  "#" + WIN_ID + " .cd-hs-item span{display:block;font-size:11px;opacity:.6;margin-top:2px;}" +
  "#" + WIN_ID + " .cd-hs-empty{padding:10px 12px;font-size:12px;opacity:.6;}" +

  // --- #10 «Что нового» ---
  "#" + WIN_ID + " .cd-whatsnew{margin:0 0 16px;padding:14px 16px;border:1px solid rgba(var(--ac-rgb),.35);border-radius:13px;background:linear-gradient(180deg,rgba(var(--ac-rgb),.12),transparent);}" +
  "#" + WIN_ID + " .cd-wn-h{font-weight:700;font-size:13px;margin-bottom:6px;}" +
  "#" + WIN_ID + " .cd-wn-list{margin:0 0 10px;padding-left:18px;font-size:12.5px;line-height:1.7;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-wn-list b{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-wn-ok{cursor:pointer;border:none;background:var(--ac);color:#1e1e2e;font-family:inherit;font-size:12px;font-weight:700;padding:7px 16px;border-radius:9px;}" +
  "#" + WIN_ID + " .cd-wn-ok:hover{filter:brightness(1.08);}" +

  // --- #9 панель быстрых действий ---
  "#" + WIN_ID + " .cd-qabar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px;}" +
  "#" + WIN_ID + " .cd-qa{cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-family:inherit;font-size:12.5px;font-weight:600;padding:9px 14px;border-radius:10px;transition:border-color .12s,transform .12s;}" +
  "#" + WIN_ID + " .cd-qa:hover{border-color:var(--ac);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-qa-rev{border-color:rgba(var(--ac-rgb),.5);}" +
  // «Продолжить» — главное действие, акцентная заливка; остальные пилюли — призрачные
  "#" + WIN_ID + " .cd-qa-cont{background:var(--ac);color:#1e1e2e;border-color:transparent;box-shadow:0 4px 14px rgba(var(--ac-rgb),.28);}" +
  "#" + WIN_ID + " .cd-qa-cont:hover{border-color:transparent;filter:brightness(1.07);transform:translateY(-1px);}" +

  // --- #3 карточка повторения + «дальше по курсу» ---
  "#" + WIN_ID + " .cd-home-review,#" + WIN_ID + " .cd-home-cont{width:100%;text-align:left;}" +
  "#" + WIN_ID + " .cd-home-review{display:flex;align-items:center;gap:14px;margin:0 0 14px;padding:15px 18px;border:1px solid rgba(var(--ac-rgb),.4);border-radius:16px;background:linear-gradient(135deg,rgba(var(--ac-rgb),.14),rgba(var(--ac-rgb),.03));cursor:pointer;color:var(--fg);transition:transform .14s,box-shadow .14s,border-color .14s;}" +
  "#" + WIN_ID + " .cd-home-review:hover{border-color:var(--ac);transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.26);}" +
  "#" + WIN_ID + " .cd-home-review:hover .cd-hc-arrow{transform:translateX(4px);opacity:1;}" +
  "#" + WIN_ID + " .cd-hr-art{flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-home-next{display:block;width:100%;text-align:left;margin:-6px 0 14px;padding:8px 12px;border:none;background:none;color:var(--muted);cursor:pointer;font-family:inherit;font-size:12px;border-radius:8px;}" +
  "#" + WIN_ID + " .cd-home-next:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-home-next b{color:var(--fg);}" +

  // --- #3 оверлей режима повторения ---
  "#" + WIN_ID + " .cd-review{position:absolute;inset:0;z-index:8;overflow-y:auto;background:radial-gradient(120% 68% at 50% -12%,rgba(var(--ac-rgb),.15),transparent 60%),var(--bg);}" +
  "#" + WIN_ID + " .cd-review[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-rv-inner{max-width:640px;margin:0 auto;padding:22px 26px 60px;}" +
  "#" + WIN_ID + " .cd-rv-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}" +
  "#" + WIN_ID + " .cd-rv-count{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-rv-close,#" + WIN_ID + " .cd-rv-close2{cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-family:inherit;border-radius:8px;padding:5px 10px;}" +
  "#" + WIN_ID + " .cd-rv-close:hover,#" + WIN_ID + " .cd-rv-close2:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-card{border:1px solid var(--bd);border-radius:16px;background:var(--panel);padding:26px 22px;box-shadow:0 10px 30px rgba(0,0,0,.3);}" +
  "#" + WIN_ID + " .cd-rv-q{font-size:17px;font-weight:600;line-height:1.5;}" +
  "#" + WIN_ID + " .cd-rv-a{margin-top:16px;padding-top:16px;border-top:1px solid var(--bd);font-size:15px;line-height:1.6;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-rv-ctl{margin-top:20px;display:flex;flex-wrap:wrap;gap:8px;}" +
  "#" + WIN_ID + " .cd-rv-show{cursor:pointer;border:none;background:var(--ac);color:#1e1e2e;font-family:inherit;font-size:13px;font-weight:700;padding:10px 20px;border-radius:10px;}" +
  "#" + WIN_ID + " .cd-rv-rate{display:flex;gap:8px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-rv-grade{cursor:pointer;border:1px solid var(--bd);background:var(--bg);color:var(--fg);font-family:inherit;font-size:12.5px;padding:10px 16px;border-radius:10px;}" +
  "#" + WIN_ID + " .cd-rv-grade[data-g='0']:hover{border-color:var(--tp);color:var(--tp);}" +
  "#" + WIN_ID + " .cd-rv-grade[data-g='1']:hover{border-color:var(--tn);color:var(--tn);}" +
  "#" + WIN_ID + " .cd-rv-grade[data-g='2']:hover{border-color:var(--ts);color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rv-done{text-align:center;padding:40px 20px;}" +
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
  "#" + WIN_ID + " .cd-viewmenu,#" + WIN_ID + " .cd-tocmenu,#" + WIN_ID + " .cd-hs-res,#" + WIN_ID + " .cd-find{box-shadow:var(--sh2);}" +
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
  "#" + WIN_ID + " .cd-hbtn,#" + WIN_ID + " .cd-rbtn{transition:background .12s,border-color .12s,color .12s,box-shadow .12s,transform .08s;}" +
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
  "#" + WIN_ID + " .cd-skel-b{background:linear-gradient(90deg,var(--bd2) 25%,var(--hl) 50%,var(--bd2) 75%);background-size:320px 100%;animation:cd-shine 1.2s linear infinite;border-radius:10px;}" +
  "#" + WIN_ID + " .cd-skel-hero{height:92px;margin-bottom:16px;border-radius:18px;}" +
  "#" + WIN_ID + " .cd-skel-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;}" +
  "#" + WIN_ID + " .cd-skel-tile{height:74px;border-radius:12px;}" +
  "#" + WIN_ID + " .cd-skel-line{height:14px;margin:10px 0;}" +
  "#" + WIN_ID + " .cd-skel-line.w40{width:40%;}#" + WIN_ID + " .cd-skel-line.w60{width:60%;}#" + WIN_ID + " .cd-skel-line.w80{width:80%;}" +
  "#" + WIN_ID + " .cd-skel-note{margin-top:16px;text-align:center;font-size:12px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-skel-nav{padding:6px 8px;}#" + WIN_ID + " .cd-skel-nav .cd-skel-b{height:34px;margin:8px 0;border-radius:9px;}" +

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
  "#" + WIN_ID + " .cd-article a{border-bottom:1px solid color-mix(in srgb,var(--ac) 22%,transparent);transition:color .12s,border-color .12s;}" +
  "#" + WIN_ID + " .cd-article a:hover{border-bottom-color:var(--ac);color:var(--ac2);}" +

  // --- #4 Таблицы: рамка со скруглением, зебра, чёткий ховер строки ---
  "#" + WIN_ID + " .cd-article table{border:1px solid var(--bd);border-radius:10px;overflow:hidden;box-shadow:var(--sh1);}" +
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
  "#" + WIN_ID + " .cd-ol{transition:background .12s,color .12s,border-color .12s,box-shadow .12s;}" +
  "#" + WIN_ID + " .cd-ol.active{border-left-width:3px;background:color-mix(in srgb,var(--ac) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac) 16%,transparent);}" +

  // --- Сворачивание разделов (## ) прямо в читалке ---
  "#" + WIN_ID + " .cd-article h2.cd-foldable{cursor:pointer;}" +
  "#" + WIN_ID + " .cd-fold-caret{display:inline-block;font-size:.58em;color:var(--faint);margin-right:.5em;transform:translateY(-2px);transition:transform .15s,color .12s;}" +
  "#" + WIN_ID + " .cd-article h2.cd-foldable:hover .cd-fold-caret{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article h2.cd-sec-folded .cd-fold-caret{transform:rotate(-90deg);}" +
  "#" + WIN_ID + " .cd-article h2.cd-sec-folded{border-bottom-style:dashed;}" +
  "#" + WIN_ID + " .cd-fold-hidden{display:none!important;}";

  // ---------------------------------------------------------------------------
  //  Построение окна.
  // ---------------------------------------------------------------------------
  var winEl = null;          // корень окна
  var navListEl = null;      // контейнер списка файлов
  var searchInput = null;
  var contentEl = null;      // область статьи
  var articleEl = null;      // .cd-article
  var titleEl = null;        // контейнер заголовка в шапке читалки
  var rnameEl = null;        // имя текущего файла
  var crumbEl = null;        // хлебная крошка «текущий раздел»
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
  var reviewEl = null, reviewQueue = [], reviewPos = 0, reviewOk = 0;  // сессия повторения карточек
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
    if (state.navHidden) w.classList.add("navhidden");

    // --- размеры/позиция ---
    var vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
    var width = clamp(state.w || Math.min(1120, Math.round(vw * 0.92)), 560, vw - 20);
    var height = clamp(state.h || Math.min(760, Math.round(vh * 0.86)), 380, vh - 20);
    var left = state.x != null ? clamp(state.x, 0, vw - width) : Math.round((vw - width) / 2);
    var top = state.y != null ? clamp(state.y, 0, vh - height) : Math.round((vh - height) / 2);
    w.style.width = width + "px"; w.style.height = height + "px";
    w.style.left = left + "px"; w.style.top = top + "px";

    // --- шапка ---
    var head = el("div", null); head.className = "cd-head";
    var navToggle = hbtn("☰", "Скрыть/показать список файлов");
    navToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      state.navHidden = !state.navHidden; saveState();
      w.classList.toggle("navhidden", state.navHidden);
    });
    backBtn = hbtn("‹", "Назад");
    backBtn.addEventListener("click", function (e) { e.stopPropagation(); goBack(); });
    fwdBtn = hbtn("›", "Вперёд");
    fwdBtn.addEventListener("click", function (e) { e.stopPropagation(); goForward(); });
    var title = el("div", null); title.className = "cd-title";
    title.innerHTML = '<span class="cd-logo" role="button" title="На главную" tabindex="0">' + (LOGO_URI ? '<img src="' + LOGO_URI + '" alt="">' : "📘") + '</span><b>Документация&nbsp;C++</b>';
    var logoEl = title.querySelector(".cd-logo");
    logoEl.addEventListener("click", function (e) { e.stopPropagation(); showHome(); });
    logoEl.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); showHome(); } });
    var snapL = hbtn("◧", "Прижать влево (половина экрана)");
    snapL.addEventListener("click", function (e) { e.stopPropagation(); snapWindow("left"); });
    var snapR = hbtn("◨", "Прижать вправо (половина экрана)");
    snapR.addEventListener("click", function (e) { e.stopPropagation(); snapWindow("right"); });
    var maxBtn = hbtn("▢", "Во весь экран / восстановить");
    maxBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMax(); });
    var splitBtn = hbtn("⊟", "Второй документ рядом (сплит)");
    splitBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleSplit(); });
    var refreshBtn = hbtn("⟳", "Обновить материалы");
    refreshBtn.addEventListener("click", function (e) { e.stopPropagation(); refreshData(); });
    var closeBtn = hbtn("✕", "Закрыть (Esc)");
    closeBtn.addEventListener("click", function (e) { e.stopPropagation(); closeWindow(); });
    head.appendChild(navToggle); head.appendChild(backBtn); head.appendChild(fwdBtn); head.appendChild(title);
    head.appendChild(splitBtn); head.appendChild(snapL); head.appendChild(snapR); head.appendChild(maxBtn); head.appendChild(refreshBtn); head.appendChild(closeBtn);
    w.appendChild(head);

    // --- тело ---
    var body = el("div", null); body.className = "cd-body";

    // навигатор
    var nav = el("aside", null); nav.className = "cd-nav";
    var searchWrap = el("div", null); searchWrap.className = "cd-search";
    searchWrap.innerHTML = '<span class="cd-si">⌕</span><button class="cd-sx" type="button" title="Очистить">✕</button>';
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
    var rbar = el("div", null); rbar.className = "cd-rbar";
    titleEl = el("div", null); titleEl.className = "cd-rtitle";
    rnameEl = el("span", null, "Выбери материал слева"); rnameEl.className = "cd-rname";
    crumbEl = el("span", null); crumbEl.className = "cd-crumb";
    titleEl.appendChild(rnameEl); titleEl.appendChild(crumbEl);
    readBtn = el("button", null, "○ Изучено"); readBtn.className = "cd-rbtn";
    readBtn.title = "Отметить материал изученным";
    // меню вида: шрифт / ширина / плотность
    var viewWrap = el("div", null); viewWrap.className = "cd-tocwrap";
    viewBtn = el("button", null, "Aa"); viewBtn.className = "cd-rbtn"; viewBtn.title = "Вид: размер шрифта, ширина, плотность";
    viewMenu = el("div", null); viewMenu.className = "cd-viewmenu"; viewMenu.hidden = true;
    viewWrap.appendChild(viewBtn); viewWrap.appendChild(viewMenu);
    tocBtn = el("button", null, "☰ Разделы"); tocBtn.className = "cd-rbtn cd-file-only";
    tocBtn.title = "Оглавление файла сбоку (показать/скрыть)";
    viewWrap.classList.add("cd-file-only"); readBtn.classList.add("cd-file-only");
    // кнопка возврата на главный экран (приветствие) — всегда видна
    homeBtn = el("button", null, "⌂ Главная"); homeBtn.className = "cd-rbtn"; homeBtn.type = "button";
    homeBtn.title = "На главную (приветствие и быстрый доступ)";
    homeBtn.addEventListener("click", function () { showHome(); });
    // «Копировать весь материал» — исходный Markdown текущего файла в буфер обмена.
    copyDocBtn = el("button", null, "⧉"); copyDocBtn.className = "cd-rbtn cd-file-only"; copyDocBtn.type = "button";
    copyDocBtn.title = "Копировать весь материал (Markdown)";
    copyDocBtn.setAttribute("aria-label", "Копировать весь материал");
    copyDocBtn.addEventListener("click", function () { copyWholeDoc(copyDocBtn); });
    // «Найти в тексте» — открывает панель поиска по открытому материалу.
    findBtn = el("button", null, "⌕"); findBtn.className = "cd-rbtn cd-file-only"; findBtn.type = "button";
    findBtn.title = "Найти в этом материале"; findBtn.setAttribute("aria-label", "Найти в материале");
    findBtn.addEventListener("click", function () { toggleFind(); });
    rbar.appendChild(titleEl); rbar.appendChild(homeBtn); rbar.appendChild(viewWrap); rbar.appendChild(tocBtn); rbar.appendChild(findBtn); rbar.appendChild(copyDocBtn); rbar.appendChild(readBtn);
    reader.appendChild(rbar);

    // тонкая полоса прогресса чтения текущего файла
    var rprog = el("div", null); rprog.className = "cd-rprog";
    rprogFill = el("i", null); rprog.appendChild(rprogFill);
    reader.appendChild(rprog);

    // основная область: статья + боковое оглавление-рейка
    var rmain = el("div", null); rmain.className = "cd-rmain";
    contentEl = el("div", null); contentEl.className = "cd-content";
    articleEl = el("div", null); articleEl.className = "cd-article";
    contentEl.appendChild(articleEl);
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
    rmain.appendChild(splitEl);

    // главный экран (приветствие) — оверлей поверх области чтения
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

    // --- поведение ---
    installDrag(w, head);
    wireSearch();
    wireTocButton();
    wireViewMenu();
    readBtn.addEventListener("click", function () { if (current) { toggleRead(current.rel); } });
    continueBtn.addEventListener("click", openNextUnread);

    // клики по статье: копирование кода и внутренние ссылки
    articleEl.addEventListener("click", onArticleClick);
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

    // Esc закрывает окно (и меню разделов).
    document.addEventListener("keydown", onKey, true);

    return w;
  }

  function hbtn(sym, title) {
    var b = el("button", null, sym); b.className = "cd-hbtn"; b.type = "button"; b.title = title; return b;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ------- перетаскивание за шапку -------
  function installDrag(w, head) {
    var drag = null;
    head.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest(".cd-hbtn")) return;  // клик по любой кнопке шапки — не перетаскивание
      var r = w.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.preventDefault();
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    function onMove(e) {
      if (!drag) return;
      var x = clamp(e.clientX - drag.dx, 0, (window.innerWidth || 1200) - w.offsetWidth);
      var y = clamp(e.clientY - drag.dy, 0, (window.innerHeight || 800) - w.offsetHeight);
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
      var vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
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
      state.w = Math.round(r.width); state.h = Math.round(r.height);
      state.x = Math.round(r.left); state.y = Math.round(r.top); saveState();
    }
  }

  // ------- навигатор -------
  function renderNav() {
    if (!navListEl) return;
    navListEl.textContent = "";
    itemEls = [];
    var groups = groupsFromData();
    if (!groups.length) {
      // Источник данных есть, но список ещё пуст — скелет вместо «материалов нет».
      if (hasDataSource()) { navListEl.innerHTML = skelNavHtml(); return; }
      var emptyBox = el("div", null); emptyBox.className = "cd-empty";
      emptyBox.innerHTML = '<div class="cd-empty-art">' + stickerMarkup("mascot-sleep", 92) + '</div>' +
        '<div class="cd-empty-t">Материалов пока нет</div>' +
        '<div class="cd-empty-s">Проверь путь к папке docs в настройке cppDocs.path и нажми «Обновить» ⟳ вверху окна.</div>';
      navListEl.appendChild(emptyBox);
      return;
    }
    groups.forEach(function (g) {
      var section = el("div", null); section.className = "cd-group";
      if (state.collapsed[g.label]) section.classList.add("collapsed");
      section.setAttribute("data-group", g.label);
      // Цвет группы доступен всей секции (заголовок + счётчик красятся под него).
      section.style.setProperty("--gcolor", g.color);

      var ghead = el("button", null); ghead.className = "cd-ghead"; ghead.type = "button";
      ghead.innerHTML = '<span class="cd-chev">▾</span><span class="cd-gdot"></span><span class="cd-gl"></span><span class="cd-gc"></span>';
      ghead.querySelector(".cd-gl").textContent = g.label;
      ghead.querySelector(".cd-gc").textContent = g.items.length;
      ghead.addEventListener("click", function () {
        var c = section.classList.toggle("collapsed");
        if (c) state.collapsed[g.label] = true; else delete state.collapsed[g.label];
        saveState();
      });
      section.appendChild(ghead);

      var itemsBox = el("div", null); itemsBox.className = "cd-items";
      g.items.forEach(function (f) {
        var item = buildItem(f, g);
        itemsBox.appendChild(item);
        itemEls.push(item);
      });
      section.appendChild(itemsBox);
      navListEl.appendChild(section);
    });
    updateProgress();
    highlightActive();
  }

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
    readB.className = state.read[f.rel] ? "on-read" : "";
    readB.title = "Отметить изученным"; readB.type = "button";
    readB.addEventListener("click", function (e) { e.stopPropagation(); toggleRead(f.rel); });
    var pinB = el("button", null, state.pins[f.rel] ? "★" : "☆");
    pinB.className = state.pins[f.rel] ? "on-pin" : "";
    pinB.title = "Закрепить"; pinB.type = "button";
    pinB.addEventListener("click", function (e) { e.stopPropagation(); togglePin(f.rel); });
    // ⧉ — открыть в новой вкладке; ⊟ — открыть во втором документе (сплит). Добавляем ПОСЛЕ
    // read/pin, чтобы не сдвигать их индексы (toggleRead/togglePin ищут кнопки по порядку).
    var newTabB = el("button", null, "⧉"); newTabB.type = "button"; newTabB.title = "Открыть в новой вкладке";
    newTabB.addEventListener("click", function (e) { e.stopPropagation(); openInTab(f.rel, null, true); });
    var splitB = el("button", null, "⊟"); splitB.type = "button"; splitB.title = "Открыть рядом (сплит)";
    splitB.addEventListener("click", function (e) { e.stopPropagation(); openInSplit(f.rel); toggleSplit(true); });
    act.appendChild(readB); act.appendChild(pinB); act.appendChild(newTabB); act.appendChild(splitB);
    item.appendChild(act);

    item.addEventListener("click", function (e) { openInTab(f.rel, null, e.ctrlKey || e.metaKey); });
    item.addEventListener("auxclick", function (e) { if (e.button === 1) { e.preventDefault(); openInTab(f.rel, null, true); } });
    // данные для поиска
    item._search = norm((f.title || "") + " " + (f.subtitle || "") + " " + (f.name || "") + " " + (f.md || "").slice(0, 4000));
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
  }

  // #10 Микро-праздник: короткий залп искр у элемента + пульс самого элемента.
  // Тактичный (10 частиц, ~0.7 c), глушится при prefers-reduced-motion.
  function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }
  function celebrate(anchor, tint) {
    try {
      if (!anchor || !anchor.getBoundingClientRect || prefersReducedMotion()) return;
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
    if (!elm || !elm.classList || prefersReducedMotion()) return;
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
      if (b) { b.textContent = state.read[rel] ? "✓" : "○"; b.className = state.read[rel] ? "on-read" : ""; }
    }
    if (current && current.rel === rel) syncReadBtn();
    updateProgress();
    // Праздник только при постановке отметки (не при снятии).
    if (state.read[rel]) {
      var anc = (current && current.rel === rel && readBtn) ? readBtn : it;
      if (anc) { celebrate(anc); pulse(anc); }
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
    if (!readBtn || !current) return;
    var on = !!state.read[current.rel];
    readBtn.textContent = on ? "✓ Изучено" : "○ Изучено";
    readBtn.classList.toggle("on", on);
  }

  function openNextUnread() {
    var d = DATA(); if (!d) return;
    var next = d.files.filter(function (f) { return !state.read[f.rel]; })[0];
    if (next) openFile(next.rel);
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
        noResultEl.innerHTML = '<div class="cd-empty-art">' + stickerMarkup("mascot-search", 92) + '</div>' +
          "Ничего не найдено по запросу<br><b>«" + escapeHtml(searchInput.value.trim()) + "»</b>";
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
      b.className = "cd-ol" + (h.level === 3 ? " lvl3" : "");
      b.setAttribute("data-slug", h.slug);
      b.addEventListener("click", function () {
        var t = articleEl.querySelector('[id="' + cssEscape(h.slug) + '"]');
        if (t) { unfoldContaining(t); t.scrollIntoView({ block: "start" }); flashHeading(t); }
      });
      outlineEl.appendChild(b);
    });
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
    articleEl.querySelectorAll("h2[id],h3[id]").forEach(function (h) {
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
    var p = node;
    while (p) { if (p.tagName === "H2") { if (p.classList.contains("cd-sec-folded")) setFold(p, false); return; } p = p.previousElementSibling; }
  }
  var _scrollSaveTimer = null;
  function onContentScroll() {
    if (!contentEl) return;
    var max = contentEl.scrollHeight - contentEl.clientHeight;
    var pct = max > 0 ? contentEl.scrollTop / max : 0;
    if (rprogFill) rprogFill.style.width = Math.round(clamp(pct, 0, 1) * 100) + "%";
    if (toTopBtn) toTopBtn.hidden = contentEl.scrollTop < 400;
    updateActiveHeading();
    if (current) {
      clearTimeout(_scrollSaveTimer);
      _scrollSaveTimer = setTimeout(function () {
        if (current && contentEl) { state.scroll[current.rel] = contentEl.scrollTop; saveState(); }
      }, 260);
    }
  }
  function updateActiveHeading() {
    if (!crumbEl) return;
    if (!curHeadings.length) { if (crumbEl.textContent) crumbEl.textContent = ""; return; }
    var cTop = contentEl.getBoundingClientRect().top;
    var active = null;
    for (var i = 0; i < curHeadings.length; i++) {
      if (curHeadings[i].el.getBoundingClientRect().top - cTop <= 44) active = curHeadings[i]; else break;
    }
    var txt = active ? active.text : "";
    if (crumbEl.textContent !== txt) crumbEl.textContent = txt;
    if (typeof markOutlineActive === "function") markOutlineActive(active ? active.slug : null);
  }
  function flashHeading(node) {
    if (!node) return;
    node.classList.remove("cd-flash"); void node.offsetWidth; node.classList.add("cd-flash");
    setTimeout(function () { try { node.classList.remove("cd-flash"); } catch (e) {} }, 1200);
  }

  // ------- меню вида: шрифт / ширина / плотность -------
  function wireViewMenu() {
    buildViewMenu();
    viewBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      viewMenu.hidden = !viewMenu.hidden;
    });
    document.addEventListener("mousedown", function (e) {
      if (viewMenu && !viewMenu.hidden && !viewMenu.contains(e.target) && e.target !== viewBtn) viewMenu.hidden = true;
    }, true);
  }
  function segRow(label, buttons) {
    var row = el("div", null); row.className = "cd-vm-row";
    var lbl = el("span", null, label); lbl.className = "cd-vm-lbl"; row.appendChild(lbl);
    var seg = el("div", null); seg.className = "cd-seg";
    buttons.forEach(function (b) { seg.appendChild(b); });
    row.appendChild(seg);
    return row;
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
    viewMenu.appendChild(segRow("Шрифт", [minus, val, plus]));
    // ширина
    var wN = el("button", null, "Уже"); var wW = el("button", null, "Шире");
    wN.type = "button"; wW.type = "button";
    function showW() { wN.classList.toggle("on", !state.wide); wW.classList.toggle("on", !!state.wide); }
    wN.addEventListener("click", function () { state.wide = false; saveState(); applyReaderPrefs(); showW(); });
    wW.addEventListener("click", function () { state.wide = true; saveState(); applyReaderPrefs(); showW(); });
    showW();
    viewMenu.appendChild(segRow("Ширина", [wN, wW]));
    // плотность списка
    var dN = el("button", null, "Просторно"); var dD = el("button", null, "Плотно");
    dN.type = "button"; dD.type = "button";
    function showD() { dN.classList.toggle("on", !state.dense); dD.classList.toggle("on", !!state.dense); }
    dN.addEventListener("click", function () { state.dense = false; saveState(); applyReaderPrefs(); showD(); });
    dD.addEventListener("click", function () { state.dense = true; saveState(); applyReaderPrefs(); showD(); });
    showD();
    viewMenu.appendChild(segRow("Список", [dN, dD]));
    // шрифт чтения
    var fontBtns = [];
    Object.keys(RFONTS).forEach(function (key) {
      var b = el("button", null, RFONTS[key].label); b.type = "button";
      b.className = (state.rfont === key ? "on" : "");
      if (RFONTS[key].stack) b.style.fontFamily = RFONTS[key].stack;  // превью прямо на кнопке
      b.addEventListener("click", function () {
        state.rfont = key; saveState(); applyReaderPrefs();
        fontBtns.forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
      });
      fontBtns.push(b);
    });
    viewMenu.appendChild(segRow("Чтение", fontBtns));
  }
  function applyReaderPrefs() {
    if (!winEl) return;
    winEl.classList.toggle("wide", !!state.wide);
    winEl.classList.toggle("dense", !!state.dense);
    winEl.classList.toggle("no-outline", !isOutlineOn());
    if (tocBtn) tocBtn.classList.toggle("act", isOutlineOn());
    if (articleEl) articleEl.style.zoom = String(state.fs || 1);
    var rf = RFONTS[state.rfont] || RFONTS.system;
    winEl.style.setProperty("--cd-rfont", rf.stack || "inherit");
    applyResponsive();
  }
  // Узкое окно: боковое оглавление прячем автоматически, чтобы не сжимать текст.
  function applyResponsive() {
    if (!winEl) return;
    winEl.classList.toggle("narrow", winEl.offsetWidth < 860);
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
  function buildRouteNav(f) {
    var d = DATA(); if (!d || !articleEl) return;
    var idx = fileIndex(f.rel);
    var prev = idx > 0 ? d.files[idx - 1] : null;
    var next = idx >= 0 && idx < d.files.length - 1 ? d.files[idx + 1] : null;
    if (!prev && !next) return;
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

  // ------- привязки окна: половина слева/справа, разворот/восстановление -------
  function setRect(x, y, wd, ht) {
    if (!winEl) return;
    var vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
    wd = clamp(wd, 560, vw); ht = clamp(ht, 380, vh);
    x = clamp(x, 0, vw - wd); y = clamp(y, 0, vh - ht);
    winEl.style.left = Math.round(x) + "px"; winEl.style.top = Math.round(y) + "px";
    winEl.style.width = Math.round(wd) + "px"; winEl.style.height = Math.round(ht) + "px";
    state.x = Math.round(x); state.y = Math.round(y); state.w = Math.round(wd); state.h = Math.round(ht); saveState();
    applyResponsive();
  }
  function snapWindow(mode) {
    if (!winEl) return;
    var vw = window.innerWidth || 1200, vh = window.innerHeight || 800, m = 8;
    var halfW = Math.floor((vw - m * 3) / 2);
    if (mode === "left") setRect(m, m, halfW, vh - m * 2);
    else if (mode === "right") setRect(m * 2 + halfW, m, halfW, vh - m * 2);
    else if (mode === "max") setRect(m, m, vw - m * 2, vh - m * 2);
  }
  function toggleMax() {
    if (!winEl) return;
    var vw = window.innerWidth || 1200, vh = window.innerHeight || 800, m = 8;
    var isMax = winEl.offsetWidth >= vw - m * 2 - 4 && winEl.offsetHeight >= vh - m * 2 - 4;
    if (isMax && prevRect) { setRect(prevRect.x, prevRect.y, prevRect.w, prevRect.h); prevRect = null; }
    else { var r = winEl.getBoundingClientRect(); prevRect = { x: r.left, y: r.top, w: r.width, h: r.height }; snapWindow("max"); }
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
    splitArticle.innerHTML = renderMarkdown(f.md || "", null);
    resolveImagesIn(splitArticle, f);
    var box = splitArticle.parentNode;
    if (hash) {
      var t = splitArticle.querySelector('[id="' + cssEscape(decodeURIComponent(String(hash).replace(/^#/, ""))) + '"]');
      if (t) { unfoldContaining(t); t.scrollIntoView({ block: "start" }); return; }
    }
    if (box) box.scrollTop = 0;
  }
  function onSplitClick(e) {
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
    if (!d || !d.files.length) {
      // Источник данных есть, но материалы ещё не пришли — скелет вместо «не найдено».
      if (hasDataSource()) { homeEl.innerHTML = skelHomeHtml(); return; }
      homeEl.innerHTML = '<div class="cd-home-inner"><div class="cd-empty cd-empty-home">' +
        '<div class="cd-empty-art">' + stickerMarkup("mascot-sleep", 118) + '</div>' +
        '<div class="cd-empty-t">Материалы не загрузились</div>' +
        '<div class="cd-empty-s">Нажми «Обновить» ⟳ вверху окна или проверь путь к docs в настройке cppDocs.path.</div>' +
        '</div></div>';
      return;
    }
    var total = d.files.length, done = 0;
    d.files.forEach(function (f) { if (state.read[f.rel]) done++; });
    var allDone = done >= total && total > 0;   // весь справочник пройден — время поздравить
    var hi = done > 0 ? "С возвращением!" : "Привет!";
    var sub = greeting() + (done > 0 ? " · продолжаем учить C++" : " · документация C++ у тебя под рукой");

    var ts = taskStats(), streak = streakDays(), cc = cardCounts();
    var pct = total ? Math.round((done / total) * 100) : 0;
    // Новые наклейки (mascot-win / cards-review) могут быть ещё не сгенерированы —
    // аккуратно падаем на уже существующие, чтобы экран не показывал заглушку.
    var winMood = (typeof STICKERS !== "undefined" && STICKERS && STICKERS["mascot-win"]) ? "mascot-win" : "mascot-done";
    var revArt = (typeof STICKERS !== "undefined" && STICKERS && STICKERS["cards-review"]) ? "cards-review" : "icon-cheat";
    // #8 маскот меняет настроение: победа (всё пройдено / длинная серия) → думает → машет
    var mood = (allDone || streak >= 7) ? winMood : (done > 0 ? "mascot-think" : "mascot-hi");

    // #8 кольцо прогресса вокруг маскота (SVG). C = длина окружности радиуса 46.
    var C = 289, off = Math.round(C * (1 - pct / 100));
    var ring = '<svg class="cd-ring" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="cd-ring-bg" cx="50" cy="50" r="46"/>' +
      '<circle class="cd-ring-fg" cx="50" cy="50" r="46" style="stroke-dasharray:' + C + ';stroke-dashoffset:' + off + '"/></svg>';

    // Плитки статистики теперь живут в самой шапке справа (dashTile определён ниже — поднимается
    // хойстингом). Это заполняет пустое место героя на широком окне и укорачивает экран.
    var statsHtml =
      dashTile("📘", "read", done + " / " + total, "изучено", total ? done / total : 0) +
      dashTile("✅", "solve", ts.done + " / " + ts.total, "решено", ts.total ? ts.done / ts.total : 0) +
      dashTile("🔥", "streak", String(streak), plural(streak, ["день", "дня", "дней"]) + " подряд", null);

    var html = '<div class="cd-home-inner">';
    html += '<div class="cd-home-hero">' +
      '<div class="cd-hero-lead">' +
      '<div class="cd-home-mascot cd-has-ring">' + ring + '<span class="cd-ring-in">' + stickerMarkup(mood, 76) + '</span></div>' +
      '<div class="cd-home-htxt"><div class="cd-home-hi">' + escapeHtml(hi) + '</div>' +
      '<div class="cd-home-sub">' + escapeHtml(sub) + '</div>' +
      (cc.due > 0 ? '<div class="cd-home-status">🎴 к повторению ' + cc.due + " " + plural(cc.due, ["карточка", "карточки", "карточек"]) + "</div>" : "") +
      "</div></div>" +
      '<div class="cd-hero-stats">' + statsHtml + "</div></div>";

    // #2 Поиск по всем материалам прямо на главной
    html += '<div class="cd-home-search"><span class="cd-hs-ic" aria-hidden="true">⌕</span>' +
      '<input class="cd-hs-in" type="text" placeholder="Поиск по всем материалам…" aria-label="Поиск по материалам" autocomplete="off">' +
      '<div class="cd-hs-res" hidden></div></div>';

    // #10 «Что нового» — разовый баннер о свежих возможностях
    if (state.whatsnew !== WHATSNEW) {
      html += '<div class="cd-whatsnew"><div class="cd-wn-h">✨ Что нового</div>' +
        '<ul class="cd-wn-list">' +
        '<li>Поиск <b>внутри материала</b> — кнопка «⌕» в шапке читалки</li>' +
        '<li><b>Закладки</b> на разделы — звёздочка ☆ у заголовка</li>' +
        '<li><b>Повторение карточек</b> и «Следующий шаг» — прямо на этом экране</li>' +
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
    var qab = '<button class="cd-qa cd-qa-cont" type="button">▶ Продолжить</button>';
    if (ts.total) qab += '<button class="cd-qa cd-qa-rand" type="button">🎲 Случайная задача</button>';
    if (cc.due + cc.neu > 0) qab += '<button class="cd-qa cd-qa-rev" type="button">🎴 Повторить' + (cc.due ? " · " + cc.due : "") + "</button>";
    qab += '<button class="cd-qa cd-qa-find" type="button">⌕ Найти</button>';
    html += '<div class="cd-qabar">' + qab + "</div>";

    // #3 Заметная карточка повторения (если есть что повторять)
    if (cc.due + cc.neu > 0) {
      var rlbl = cc.due > 0
        ? "К повторению: " + cc.due + " " + plural(cc.due, ["карточка", "карточки", "карточек"])
        : cc.neu + " " + plural(cc.neu, ["новая карточка", "новые карточки", "новых карточек"]);
      html += '<button class="cd-home-review" type="button">' +
        '<div class="cd-hr-art">' + stickerMarkup(revArt, 46) + "</div>" +
        '<div class="cd-hc-main"><div class="cd-hc-lbl">🎴 Повторение</div>' +
        '<div class="cd-hc-title">' + escapeHtml(rlbl) + "</div>" +
        '<div class="cd-hc-meta">' + (cc.due > 0 && cc.neu > 0 ? "и " + cc.neu + " новых · интервальное повторение" : "интервальное повторение") + "</div></div>" +
        '<div class="cd-hc-arrow">→</div></button>';
    }

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
        // Подсказка «дальше по курсу», если следующий неизученный отличается от primary
        if (nF && nF.rel !== primary.rel) {
          html += '<button class="cd-home-next" data-rel="' + escapeHtml(nF.rel) + '">Дальше по курсу: <b>' +
            escapeHtml(nF.title || nF.name) + "</b> →</button>";
        }
      }
    }

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
    if (cards) html += secHead("Быстрый доступ", quickN, "var(--ac)") + '<div class="cd-home-grid">' + cards + "</div>";

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
      html += secHead("Недавнее", recentRels.length, "#f9e2af") + '<div class="cd-home-chips">' + rchips + "</div>";
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
      html += secHead("Закладки", markKeys.length, "#cba6f7") + '<div class="cd-home-chips">' + mchips + "</div>";
    }

    // Закреплённое (если есть)
    var pinRels = Object.keys(state.pins || {}).filter(function (r) { return state.pins[r] && lookupFile(r); });
    if (pinRels.length) {
      var chips = "";
      pinRels.slice(0, 12).forEach(function (r) {
        var f = lookupFile(r);
        chips += '<button class="cd-home-chip" data-rel="' + escapeHtml(f.rel) + '" style="--gcolor:' + escapeHtml(f.groupColor || "var(--ac)") + '">' + escapeHtml(f.title || f.name) + '</button>';
      });
      html += secHead("Закреплённое", pinRels.length, "#f38ba8") + '<div class="cd-home-chips">' + chips + "</div>";
    }
    html += '</div>';
    homeEl.innerHTML = html;

    // Анимация мини-полосок дашборда: от нуля к целевой ширине.
    homeEl.querySelectorAll(".cd-dt-bar i").forEach(function (bar) {
      var w = bar.style.width; bar.style.width = "0";
      requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = w; }); });
    });

    homeEl.querySelectorAll("[data-rel]").forEach(function (b) {
      b.addEventListener("click", function () { openFile(b.getAttribute("data-rel"), b.getAttribute("data-hash") || undefined); });
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

    // #10 «Что нового» — закрыть и запомнить
    var wnOk = homeEl.querySelector(".cd-wn-ok");
    if (wnOk) wnOk.addEventListener("click", function () { state.whatsnew = WHATSNEW; saveState(); buildHome(); });

    // #2 живой поиск по всем материалам
    var hsIn = homeEl.querySelector(".cd-hs-in");
    var hsRes = homeEl.querySelector(".cd-hs-res");
    function hsRender() {
      var q = norm(hsIn.value.trim());
      if (!q) { hsRes.hidden = true; hsRes.innerHTML = ""; return; }
      var all = (DATA() || { files: [] }).files, out = [], i;
      for (i = 0; i < all.length && out.length < 12; i++) {
        var f = all[i];
        if (norm((f.title || "") + " " + (f.subtitle || "") + " " + (f.name || "")).indexOf(q) !== -1) out.push(f);
      }
      hsRes.hidden = false;
      hsRes.innerHTML = out.length
        ? out.map(function (f) {
            return '<button class="cd-hs-item" data-rel="' + escapeHtml(f.rel) + '"><b>' + escapeHtml(f.title || f.name) + "</b>" +
              (f.subtitle ? "<span>" + escapeHtml(f.subtitle) + "</span>" : "") + "</button>";
          }).join("")
        : '<div class="cd-hs-empty">Ничего не нашлось</div>';
    }
    var qaFind = homeEl.querySelector(".cd-qa-find");
    if (qaFind && hsIn) qaFind.addEventListener("click", function () { hsIn.focus(); hsIn.select(); });
    if (hsIn && hsRes) {
      hsIn.addEventListener("input", hsRender);
      hsIn.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { var first = hsRes.querySelector(".cd-hs-item"); if (first) openFile(first.getAttribute("data-rel")); }
        else if (e.key === "Escape") { hsIn.value = ""; hsRender(); }
      });
      hsRes.addEventListener("click", function (e) {
        var it = e.target.closest && e.target.closest(".cd-hs-item");
        if (it) openFile(it.getAttribute("data-rel"));
      });
    }
  }
  function showHome() {
    if (!homeEl || !winEl) return;
    if (reviewEl) reviewEl.hidden = true;   // выходим из режима повторения, если был
    buildHome();
    homeEl.hidden = false;
    winEl.classList.add("home");
    homeEl.classList.remove("cd-in-anim"); void homeEl.offsetWidth; homeEl.classList.add("cd-in-anim");
    if (rnameEl) rnameEl.textContent = "Главная";
    if (crumbEl) crumbEl.textContent = "";
    homeEl.scrollTop = 0;
  }
  function hideHome() {
    if (!homeEl || !winEl) return;
    homeEl.hidden = true;
    if (reviewEl) reviewEl.hidden = true;
    winEl.classList.remove("home");
  }

  // ------- открытие файла -------
  // silent=true — стартовая предзагрузка материала ПОД главным экраном: показать его
  // в читалке, но не трогать «последний»/историю/прогресс. Иначе при самом первом
  // запуске главный экран увидит уже помеченный файл и покажет «С возвращением» и
  // ненулевой прогресс по тому, что пользователь ещё не открывал.
  function openFile(rel, hash, silent) {
    hideHome();
    var map = fileMap();
    var f = map[String(rel).toLowerCase()];
    if (!f) return;
    // запомнить позицию прокрутки в уходящем файле
    if (current && contentEl) state.scroll[current.rel] = contentEl.scrollTop;
    current = f;
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
    syncActiveTab(f.rel);

    if (rnameEl) rnameEl.textContent = f.title || f.name;
    if (crumbEl) crumbEl.textContent = "";
    var headings = [];
    articleEl.innerHTML = renderMarkdown(f.md || "", headings);
    // мягкое проявление статьи
    articleEl.classList.remove("fade"); void articleEl.offsetWidth; articleEl.classList.add("fade");
    resolveImages();
    buildOutline(headings);
    collectHeadings();
    buildRouteNav(f);
    decorateTasks(f);
    wireFolding();          // сворачивание разделов — после decorateTasks (пропускаем cd-task)
    syncBookmarks();
    renderNotes(f);
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
      if (target) { unfoldContaining(target); target.scrollIntoView({ block: "start" }); flashHeading(target); onContentScroll(); return; }
    }
    contentEl.scrollTop = state.scroll[f.rel] || 0;
    onContentScroll();
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
      bar.innerHTML =
        '<div class="cd-tb-top">Решено <b class="cd-tb-s">' + solved + '</b> из <b>' + total + '</b> задач темы</div>' +
        '<div class="cd-tb-track">' + cells + '</div>';
      articleEl.insertBefore(bar, articleEl.firstChild);
    }
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
  function recordActivity() {
    var t = dayKey(new Date());
    if (!state.days[t]) { state.days[t] = true; scheduleSave(); }
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
        out.push({ rel: f.rel, slug: slug, key: key });
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
      if (mq) { if (cur && cur.a.length) flush(); if (!cur) cur = { q: [], a: [], m: "q" }; cur.q.push(mq[1]); cur.m = "q"; continue; }
      if (ma) { if (!cur) cur = { q: [], a: [], m: "a" }; cur.a.push(ma[1]); cur.m = "a"; continue; }
      if (!t.trim()) { if (cur && cur.a.length) flush(); continue; }
      if (cur) (cur.m === "a" ? cur.a : cur.q).push(t.trim());
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
        parseCards(m[1]).forEach(function (c) {
          var q = c.q.join(" "); if (!q) return;
          out.push({ q: q, a: c.a.join(" "), id: cdHash(q), rel: f.rel });
        });
      }
    });
    return out;
  }
  // Счётчики для главного экрана: сколько «пора повторить» и сколько «новых».
  function cardCounts() {
    var all = collectAllCards(), due = 0, neu = 0;
    all.forEach(function (c) { var s = cdCardState(c.id).status; if (s === "due") due++; else if (s === "new") neu++; });
    return { due: due, neu: neu, total: all.length };
  }
  // Очередь на сессию: сперва просроченные, затем новые; не длиннее 20 за раз.
  function buildReviewQueue() {
    var all = collectAllCards(), dueL = [], newL = [];
    all.forEach(function (c) { var s = cdCardState(c.id).status; if (s === "due") dueL.push(c); else if (s === "new") newL.push(c); });
    return dueL.concat(newL).slice(0, 20);
  }
  function startReview() {
    reviewQueue = buildReviewQueue();
    reviewPos = 0; reviewOk = 0;
    if (!reviewQueue.length) return;
    showReview();
  }
  function renderReviewCard() {
    if (!reviewEl) return;
    if (reviewPos >= reviewQueue.length) {          // сессия окончена — итог
      var wm = (typeof STICKERS !== "undefined" && STICKERS && STICKERS["mascot-win"]) ? "mascot-win" : "mascot-done";
      reviewEl.innerHTML = '<div class="cd-rv-inner"><div class="cd-rv-done">' +
        '<div class="cd-rv-art">' + stickerMarkup(wm, 96) + "</div>" +
        '<div class="cd-rv-done-t">Повторено ' + reviewOk + " " + plural(reviewOk, ["карточка", "карточки", "карточек"]) + "!</div>" +
        '<div class="cd-rv-done-s">Отлично. Возвращайся завтра — интервалы уже назначены.</div>' +
        '<button class="cd-rv-close2" type="button">На главную</button></div></div>';
      recordActivity(); saveState();
      return;
    }
    var c = reviewQueue[reviewPos];
    reviewEl.innerHTML = '<div class="cd-rv-inner">' +
      '<div class="cd-rv-top"><span class="cd-rv-count">' + (reviewPos + 1) + " / " + reviewQueue.length + "</span>" +
      '<button class="cd-rv-close" type="button" title="Закрыть">✕</button></div>' +
      '<div class="cd-rv-card"><div class="cd-rv-q">' + inline(c.q) + "</div>" +
      '<div class="cd-rv-a" hidden>' + inline(c.a) + "</div>" +
      '<div class="cd-rv-ctl"><button class="cd-rv-show" type="button">Показать ответ</button>' +
      '<span class="cd-rv-rate" hidden>' +
      '<button class="cd-rv-grade" data-g="0" type="button">Не помню</button>' +
      '<button class="cd-rv-grade" data-g="1" type="button">Трудно</button>' +
      '<button class="cd-rv-grade" data-g="2" type="button">Помню</button></span></div></div></div>';
  }
  function reviewGrade(g) {
    var c = reviewQueue[reviewPos]; if (!c) return;
    cdSchedule(c.id, g);
    if (g >= 1) reviewOk++;          // «трудно»/«помню» считаем как повторённую
    reviewPos++;
    renderReviewCard();
  }
  function onReviewClick(e) {
    var t = e.target;
    if (t.closest && t.closest(".cd-rv-close, .cd-rv-close2")) { hideReview(); showHome(); return; }
    if (t.closest && t.closest(".cd-rv-show")) {
      var card = reviewEl.querySelector(".cd-rv-card");
      if (card) { var a = card.querySelector(".cd-rv-a"), rate = card.querySelector(".cd-rv-rate"), show = card.querySelector(".cd-rv-show");
        if (a) a.hidden = false; if (rate) rate.hidden = false; if (show) show.hidden = true; }
      return;
    }
    var gb = t.closest && t.closest(".cd-rv-grade");
    if (gb) { reviewGrade(parseInt(gb.getAttribute("data-g"), 10) || 0); return; }
  }
  function showReview() {
    if (!reviewEl || !winEl) return;
    if (homeEl) homeEl.hidden = true;
    reviewEl.hidden = false; winEl.classList.add("home");
    renderReviewCard();
  }
  function hideReview() { if (reviewEl) reviewEl.hidden = true; }

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
      if (base) img.src = "file:///" + (base + "/" + res.rel).replace(/^\/+/, "");
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
  // ------- опросник / «найди ошибку» (общая обработка для читалки и сплита) -------
  function quizMarkAnswered(q) {
    q.setAttribute("data-answered", "1");
    var opts = q.querySelectorAll(".cd-quiz-opt");
    for (var i = 0; i < opts.length; i++)
      if (opts[i].getAttribute("data-ok") === "1") opts[i].classList.add("right");
    var ex = q.querySelector(".cd-quiz-expl"); if (ex) ex.hidden = false;
    var rv = q.querySelector(".cd-quiz-reveal"); if (rv) rv.style.display = "none";
  }
  function quizPick(opt) {
    var q = opt.closest && opt.closest(".cd-quiz-q"); if (!q) return;
    opt.classList.add(opt.getAttribute("data-ok") === "1" ? "right" : "wrong", "picked");
    quizMarkAnswered(q);
  }
  function fbReveal(btn) {
    var box = btn.closest && btn.closest(".cd-fb"); if (!box) return;
    var ans = box.querySelector(".cd-fb-ans"); if (ans) ans.hidden = false;
    btn.style.display = "none";
  }
  function cardShow(btn) {
    var card = btn.closest(".cd-card"); if (!card) return;
    var a = card.querySelector(".cd-card-a"); if (a) a.hidden = false;
    btn.style.display = "none";
    var rate = card.querySelector(".cd-card-rate"); if (rate) rate.hidden = false;
  }
  function cardRate(btn) {
    var card = btn.closest(".cd-card"); if (!card) return;
    var ivl = cdSchedule(card.getAttribute("data-id"), parseInt(btn.getAttribute("data-g"), 10) || 0);
    var word = ivl + " " + plural(ivl, ["день", "дня", "дней"]);
    var rate = card.querySelector(".cd-card-rate"); if (rate) rate.hidden = true;
    var done = card.querySelector(".cd-card-done");
    if (done) { done.hidden = false; done.textContent = "Отмечено. Снова через " + word + "."; }
    var badge = card.querySelector(".cd-card-due");
    if (badge) { badge.className = "cd-card-due lat"; badge.textContent = "повтор через " + word; }
    card.classList.add("cd-card-rated");
    try { recordActivity(); } catch (e) {}
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
  }
  function fcReveal(btn) {
    var box = btn.closest(".cd-fc"); if (!box) return;
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
  function quizClick(e) {
    var t = e.target;
    if (!t || !t.closest) return false;
    var qopt = t.closest(".cd-quiz-opt");
    if (qopt) { e.preventDefault(); quizPick(qopt); return true; }
    var qrev = t.closest(".cd-quiz-reveal");
    if (qrev) { e.preventDefault(); var q = qrev.closest(".cd-quiz-q"); if (q) quizMarkAnswered(q); return true; }
    var fbrev = t.closest(".cd-fb-reveal");
    if (fbrev) { e.preventDefault(); fbReveal(fbrev); return true; }
    var cshow = t.closest(".cd-card-show");
    if (cshow) { e.preventDefault(); cardShow(cshow); return true; }
    var crate = t.closest(".cd-card-btn");
    if (crate) { e.preventDefault(); cardRate(crate); return true; }
    var fchk = t.closest(".cd-fc-check");
    if (fchk) { e.preventDefault(); fcCheck(fchk); return true; }
    var frev = t.closest(".cd-fc-reveal");
    if (frev) { e.preventDefault(); fcReveal(frev); return true; }
    var tcopy = t.closest(".cd-tests-copy");
    if (tcopy) { e.preventDefault(); testsCopy(tcopy); return true; }
    var chk = t.closest(".cd-check-item");
    if (chk) { e.preventDefault(); checkToggle(chk); return true; }
    return false;
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
    var solve = e.target.closest && e.target.closest(".cd-solve");
    if (solve) { e.preventDefault(); e.stopPropagation(); toggleSolved(solve); return; }
    var hmark = e.target.closest && e.target.closest(".cd-hmark");
    if (hmark) { e.preventDefault(); e.stopPropagation(); toggleBookmark(hmark); return; }
    var hlink = e.target.closest && e.target.closest(".cd-hlink");
    if (hlink) { e.preventDefault(); e.stopPropagation(); copyHeadingLink(hlink); return; }
    var tl = e.target.closest && e.target.closest(".cd-tl-box");
    if (tl) { e.preventDefault(); e.stopPropagation(); taskCheckToggle(tl); return; }
    var copy = e.target.closest && e.target.closest(".copybtn");
    if (copy) { doCopy(copy); return; }
    if (quizClick(e)) return;
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
  function onKey(e) {
    if (!winEl) return;
    if (e.key === "Escape") {
      if (viewMenu && !viewMenu.hidden) { viewMenu.hidden = true; return; }
      if (findBar && !findBar.hidden) { e.stopPropagation(); toggleFind(false); return; }  // Esc сперва закрывает поиск, не окно
      closeWindow();
    }
  }

  // ---------------------------------------------------------------------------
  //  Открыть / закрыть / обновить.
  // ---------------------------------------------------------------------------
  function openWindow() {
    if (winEl) { winEl.style.display = "flex"; return; }
    buildWindow();
    setBtnVisible(false);
  }
  function closeWindow() {
    if (winEl) {
      document.removeEventListener("keydown", onKey, true);
      winEl.remove(); winEl = null;
    }
    setBtnVisible(true);
  }
  function toggleWindow() { if (winEl) closeWindow(); else openWindow(); }

  function bootVal(key) { try { var b = window.__CPPDOCS_BOOT__; return b && b[key]; } catch (e) { return null; } }
  // file:///…/x.js → путь на диске (данные читаем через Node fs, а не file://-скриптом).
  function fileUrlToPath(u) {
    if (!u) return null;
    var s = String(u).replace(/^file:\/\/\//, "").replace(/[?#].*$/, "");
    try { s = decodeURIComponent(s); } catch (e) {}
    return s;
  }
  // Node fs, если доступен (electron-browser workbench): читаем файл напрямую.
  function nodeRead(u) {
    try {
      var req = null;
      try { if (typeof require === "function") req = require; } catch (e) {}
      if (!req && typeof window !== "undefined" && window.require) req = window.require;
      if (!req) return null;
      var p = fileUrlToPath(u);
      return p ? req("fs").readFileSync(p, "utf8") : null;
    } catch (e) { return null; }
  }
  // Жив ли каталог расширения. При удалении VS Code не зовёт «отключить окно», и впечатанный
  // рантайм остаётся навсегда — если файла рантайма на диске нет, окно осиротело (снимаем кнопку).
  // Нет маячка (старые данные) или fs недоступен — ведём себя как раньше.
  function extAlive() {
    try {
      var d = DATA();
      var url = (d && d.runtimeUrl) || bootVal("runtimeUrl");
      if (!url) return true;
      var p = fileUrlToPath(url);
      if (!p) return true;
      var req = null;
      try { if (typeof require === "function") req = require; } catch (e) {}
      if (!req && typeof window !== "undefined" && window.require) req = window.require;
      if (!req) return true;
      return !!req("fs").existsSync(p);
    } catch (e) { return true; }
  }
  function refreshData() {
    var d = DATA();
    var url = (d && d.dataUrl) || bootVal("dataUrl");
    if (!url) { rebuildFromData(); return; }
    // Только чтение через Node fs + JSON.parse: файл НЕ исполняется (иначе подмена файла в
    // globalStorage = произвольный код в оболочке). Нет fs / не распарсилось — остаёмся на старых данных.
    var txt = nodeRead(url);
    if (txt != null) {
      try {
        var jm = txt.replace(/^[\s\S]*?window\.__CPPDOCS__\s*=\s*/, "").replace(/;\s*$/, "");
        var obj = sanitizeData(JSON.parse(jm));
        if (obj) window.__CPPDOCS__ = obj;
      } catch (e) {}
    }
    rebuildFromData();
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
  var lastStamp = null, stampInit = false;
  function pollStamp() {
    var d = DATA();
    var url = (d && d.stampUrl) || bootVal("stampUrl");
    if (!url) return;
    // Метку читаем только через Node fs (файл не исполняем, как и в refreshData).
    var txt = nodeRead(url);
    if (txt == null) return;
    var mm = txt.match(/=\s*(\d+)/);
    var st = mm ? parseInt(mm[1], 10) : null;
    if (st != null) {
      if (!stampInit) { stampInit = true; lastStamp = st; }
      else if (st !== lastStamp) { lastStamp = st; refreshData(); }
    }
  }

  // ---------------------------------------------------------------------------
  //  Плавающая кнопка-запуск + самолечение (VS Code пересобирает DOM).
  // ---------------------------------------------------------------------------
  function setBtnVisible(v) {
    var b = document.getElementById(BTN_ID);
    if (b) b.style.display = v ? "inline-flex" : "none";
  }
  function ensureButton() {
    if (document.getElementById(BTN_ID)) return;
    if (!document.body) return;
    if (!extAlive()) return;   // расширение удалено — осиротевшую кнопку не создаём
    var d = DATA();
    var n = d ? d.files.length : 0;
    var b = el("div"); b.id = BTN_ID;
    b.setAttribute("role", "button");
    b.setAttribute("tabindex", "0");
    b.setAttribute("aria-label", "Открыть документацию C++");
    b.title = "Документация C++ — открыть плавающее окно";
    // Наклейка-смайл вместо эмодзи 📘 — фирменное лицо расширения даже при закрытом окне.
    b.innerHTML = '<span class="cd-btn-face">' + stickerMarkup("welcome", 20) + "</span>C++" +
      (n ? ' <span class="cd-badge">' + n + "</span>" : "");
    b.addEventListener("click", toggleWindow);
    b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleWindow(); } });
    document.body.appendChild(b);
    if (winEl) b.style.display = "none";
  }

  // Держим счётчик на кнопке в согласии с данными: после автообновления (окно даже закрыто)
  // число материалов могло измениться — ensureButton его не трогает, обновляем здесь.
  function syncBadge() {
    var b = document.getElementById(BTN_ID);
    if (!b) return;
    var d = DATA();
    var n = d ? d.files.length : 0;
    var badge = b.querySelector(".cd-badge");
    if (n > 0) {
      if (!badge) { b.appendChild(document.createTextNode(" ")); badge = el("span"); badge.className = "cd-badge"; b.appendChild(badge); }
      if (badge.textContent !== String(n)) badge.textContent = String(n);
    } else if (badge) { try { badge.remove(); } catch (e) {} }
  }

  function heal() {
    // Расширение удалено — убираем кнопку и больше ничего не подрисовываем.
    try { if (!extAlive()) { var ob = document.getElementById(BTN_ID); if (ob) ob.remove(); return; } } catch (e) {}
    try { applyAccent(); } catch (e) {}   // акцент под тему/обои — до отрисовки стиля и кнопки
    try { ensureStyle(); } catch (e) {}
    try { ensureButton(); } catch (e) {}
    try { syncBadge(); } catch (e) {}
    // Тема окна могла смениться.
    try { if (winEl) winEl.classList.toggle("light", isLight()); } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  //  Старт.
  // ---------------------------------------------------------------------------
  function boot() {
    // nonce теперь приходит из инлайн-загрузчика __CPPDOCS_BOOT__ (данные грузятся внешним
    // файлом и nonce не несут). Fallback на старый путь — на случай инлайн-данных.
    try {
      var b0 = window.__CPPDOCS_BOOT__, d0 = DATA();
      CD_NONCE = (b0 && typeof b0.scriptNonce === "string" && b0.scriptNonce) ||
                 (d0 && typeof d0.scriptNonce === "string" && d0.scriptNonce) || "";
    } catch (e) {}
    heal();
    try { pollStamp(); } catch (e) {}
    // Один тикер на всё: возврат кнопки после перестройки DOM редактором (как у vscode-bg) плюс
    // опрос метки свежести для автообновления. Оба дела спят, пока вкладка скрыта, — не жжём CPU.
    setInterval(function () {
      if (document.hidden) return;
      heal();
      try { pollStamp(); } catch (e) {}
    }, 3000);
    try {
      new MutationObserver(function () { heal(); }).observe(document.body || document.documentElement, { childList: true });
    } catch (e) {}
    console.log("[cpp-docs] плавающее окно " + VERSION + " готово, материалов: " + (DATA() ? DATA().files.length : 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Узкий мост для превью/отладки (в реальном воркбенче не мешает).
  window.__cppDocs = {
    open: openWindow, close: closeWindow, toggle: toggleWindow, render: renderMarkdown,
    // для тестов: чистая логика главного экрана (карточки/следующий шаг)
    collectAllCards: collectAllCards, cardCounts: cardCounts, nextUnread: nextUnread,
  };
})();
