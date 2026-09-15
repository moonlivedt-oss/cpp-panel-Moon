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
  var VERSION = "3.0.0";

  // ---------------------------------------------------------------------------
  //  Данные: материалы приходят из cpp-docs-data.js (window.__CPPDOCS__).
  // ---------------------------------------------------------------------------
  function DATA() {
    var d = window.__CPPDOCS__;
    return d && typeof d === "object" && Array.isArray(d.files) ? d : null;
  }

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
      return s && typeof s === "object" ? s : {};
    } catch (e) { return {}; }
  }
  var state = loadState();
  if (!state.read) state.read = {};        // { rel: true } — отмечено «изучено»
  if (!state.pins) state.pins = {};        // { rel: true } — закреплено
  if (!state.collapsed) state.collapsed = {}; // { group: true } — свёрнутая группа в навигаторе
  if (!state.scroll) state.scroll = {};    // { rel: scrollTop } — где остановился в каждом файле
  if (typeof state.fs !== "number") state.fs = 1;   // масштаб шрифта читалки (0.8..1.6)
  if (typeof state.wide !== "boolean") state.wide = false;  // широкая колонка чтения
  if (typeof state.dense !== "boolean") state.dense = false; // плотный список файлов
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
  // Русское окончание: 1 файл, 2 файла, 5 файлов.
  function plural(n, forms) {
    var d10 = n % 10, d100 = n % 100;
    if (d10 === 1 && d100 !== 11) return forms[0];
    if (d10 >= 2 && d10 <= 4 && (d100 < 10 || d100 >= 20)) return forms[1];
    return forms[2];
  }
  // Нормализация для поиска: без регистра и без различия ё/е.
  function norm(s) { return String(s).toLowerCase().replace(/ё/g, "е"); }

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
    // Картинки ![alt](src) — до ссылок.
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, function (_, alt, src) {
      return '<img alt="' + alt + '" data-src="' + src + '">';
    });
    // Ссылки [текст](url "title")
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, function (_, label, href) {
      return '<a href="' + href + '">' + label + "</a>";
    });
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    // Вернуть код на место.
    text = text.replace(/\u0000(\d+)\u0000/g, function (_, i) {
      return "<code>" + escapeHtml(codes[+i]) + "</code>";
    });
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
      html += "<" + (type || "ul") + ">";
      items.forEach(function (it) { html += "<li>" + inline(it.text) + it.sub + "</li>"; });
      html += "</" + (type || "ul") + ">";
      return html;
    }

    while (i < lines.length) {
      var line = lines[i];

      if (!line.trim()) { i++; continue; } // пустые строки между блоками

      // Код в ограждении ```lang … ```
      var fence = line.match(/^\s*```+\s*([\w+#-]*)\s*$/);
      if (fence) {
        var lang = fence[1] || "";
        i++;
        var buf = [];
        while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++; // закрывающая ```
        var code = buf.join("\n");
        var langLabel = lang ? escapeHtml(lang) : "";
        out.push(
          '<div class="codewrap">' +
          (langLabel ? '<span class="codelang">' + langLabel + "</span>" : "") +
          '<button class="copybtn" type="button" title="Копировать код">копировать</button>' +
          '<pre class="code"><code>' + highlight(code, lang) + "</code></pre></div>"
        );
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
        out.push("<h" + level + ' id="' + slug + '">' + inline(htext) + "</h" + level + ">");
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
        var attrs = nc ? ' class="note" style="--nc:' + nc + ';--nbg:' + nbg + '"' : "";
        out.push("<blockquote" + attrs + ">" + renderMarkdown(qtext, null) + "</blockquote>");
        continue;
      }

      // Таблица
      if (line.indexOf("|") >= 0 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        var header = tableCells(line);
        i += 2; // шапка + разделитель
        var rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].indexOf("|") >= 0) {
          rows.push(tableCells(lines[i])); i++;
        }
        var thtml = '<div class="tablewrap"><table><thead><tr>';
        header.forEach(function (c) { thtml += "<th>" + inline(c) + "</th>"; });
        thtml += "</tr></thead><tbody>";
        rows.forEach(function (r) {
          thtml += "<tr>";
          for (var c = 0; c < header.length; c++) thtml += "<td>" + inline(r[c] || "") + "</td>";
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
    var st = el("style"); st.id = STYLE_ID;
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
  "@media (prefers-reduced-motion: reduce){#" + WIN_ID + ",#" + WIN_ID + " *,#" + BTN_ID + "{transition:none!important;animation:none!important;}}" +

  // Шапка = ручка перетаскивания
  "#" + WIN_ID + " .cd-head{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:move;user-select:none;" +
  "border-bottom:1px solid var(--bd);background:linear-gradient(180deg,var(--hl),transparent);}" +
  "#" + WIN_ID + " .cd-title{font-weight:700;font-size:13px;letter-spacing:.2px;flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-title b{color:var(--ac2);}" +
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
  "#" + WIN_ID + " .cd-group{margin-top:6px;}" +
  "#" + WIN_ID + " .cd-ghead{display:flex;align-items:center;gap:6px;width:100%;padding:7px 6px 5px;background:none;border:none;cursor:pointer;color:var(--faint);font-family:inherit;text-align:left;}" +
  "#" + WIN_ID + " .cd-ghead .cd-gl{flex:1 1 auto;text-transform:uppercase;font-size:10px;font-weight:800;letter-spacing:.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-ghead .cd-gc{font-size:9.5px;padding:1px 6px;border-radius:8px;background:var(--bd);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-chev{width:9px;font-size:9px;transition:transform .12s;}" +
  "#" + WIN_ID + " .cd-group.collapsed .cd-chev{transform:rotate(-90deg);}" +
  "#" + WIN_ID + " .cd-group.collapsed .cd-items{display:none;}" +
  "#" + WIN_ID + " .cd-item{position:relative;padding:7px 9px 7px 13px;border-radius:8px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-item::before{content:'';position:absolute;left:5px;top:9px;bottom:9px;width:2.5px;border-radius:3px;background:var(--gcolor,var(--ac));opacity:.35;}" +
  "#" + WIN_ID + " .cd-item:hover{background:var(--hl);}" +
  "#" + WIN_ID + " .cd-item:hover::before{opacity:.9;top:7px;bottom:7px;}" +
  "#" + WIN_ID + " .cd-item.active{background:var(--hl);}" +
  "#" + WIN_ID + " .cd-item.active::before{opacity:1;top:6px;bottom:6px;}" +
  "#" + WIN_ID + " .cd-it-title{font-weight:600;font-size:12.5px;line-height:1.3;padding-right:38px;}" +
  "#" + WIN_ID + " .cd-item.read .cd-it-title::before{content:'✓ ';color:var(--ts);font-weight:800;}" +
  "#" + WIN_ID + " .cd-it-sub{color:var(--muted);font-size:11px;margin-top:2px;line-height:1.4;padding-right:8px;}" +
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
  "#" + WIN_ID + " .cd-rmain{flex:1 1 auto;display:flex;min-height:0;min-width:0;}" +
  "#" + WIN_ID + " .cd-content{flex:1 1 auto;overflow-y:auto;padding:22px 30px 60px;min-height:0;min-width:0;line-height:1.62;scroll-behavior:smooth;}" +
  "#" + WIN_ID + " .cd-article{max-width:820px;margin:0 auto;}" +

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
  "#" + WIN_ID + " .cd-article h2{font-size:20px;margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--bd);color:var(--ac2);scroll-margin-top:10px;}" +
  "#" + WIN_ID + " .cd-article h3{font-size:16px;margin:20px 0 8px;color:var(--fg);scroll-margin-top:10px;}" +
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
  "#" + WIN_ID + " .cd-article img{max-width:100%;border-radius:8px;}" +

  // Таблицы
  "#" + WIN_ID + " .tablewrap{overflow-x:auto;margin:12px 0;border:1px solid var(--bd);border-radius:9px;}" +
  "#" + WIN_ID + " .cd-article table{border-collapse:collapse;width:100%;font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-article th,#" + WIN_ID + " .cd-article td{padding:7px 11px;text-align:left;border-bottom:1px solid var(--bd);vertical-align:top;}" +
  "#" + WIN_ID + " .cd-article th{background:var(--hl);font-weight:700;color:var(--ac2);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-article tbody tr:last-child td{border-bottom:none;}" +
  "#" + WIN_ID + " .cd-article tbody tr:hover{background:var(--bd2);}" +

  // Блоки кода
  "#" + WIN_ID + " .codewrap{position:relative;margin:12px 0;}" +
  "#" + WIN_ID + " .codelang{position:absolute;top:0;left:12px;transform:translateY(-50%);font-size:9.5px;text-transform:uppercase;letter-spacing:.6px;" +
  "background:var(--ac);color:#fff;padding:1px 7px;border-radius:6px;font-weight:700;}" +
  "#" + WIN_ID + " .copybtn{position:absolute;top:8px;right:8px;border:1px solid var(--bd);background:var(--bg);color:var(--muted);cursor:pointer;" +
  "font-family:inherit;font-size:10.5px;padding:3px 9px;border-radius:7px;opacity:0;transition:opacity .12s;}" +
  "#" + WIN_ID + " .codewrap:hover .copybtn{opacity:1;}" +
  "#" + WIN_ID + " .copybtn:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .copybtn.done{color:var(--ts);border-color:var(--ts);}" +
  "#" + WIN_ID + " pre.code{margin:0;padding:14px 16px;overflow-x:auto;background:var(--code);border:1px solid var(--bd);border-radius:10px;" +
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

  // Кнопка-запуск (плавающая пилюля)
  "#" + BTN_ID + "{position:fixed;z-index:2147482000;right:18px;bottom:30px;display:inline-flex;align-items:center;gap:7px;" +
  "padding:9px 15px;border-radius:999px;border:1px solid rgba(var(--cppdocs-ac-rgb,137,180,250),.45);cursor:pointer;user-select:none;" +
  "background:rgba(24,24,37,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#cdd6f4;" +
  "font-family:var(--vscode-font-family,'Segoe UI',system-ui,sans-serif);font-size:12.5px;font-weight:700;" +
  "box-shadow:0 6px 20px rgba(0,0,0,.4);transition:transform .12s,box-shadow .12s;}" +
  "#" + BTN_ID + ":hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,.5);}" +
  "#" + BTN_ID + " .cd-badge{font-size:10px;font-weight:800;padding:1px 7px;border-radius:999px;background:rgba(var(--cppdocs-ac-rgb,137,180,250),.28);color:var(--cppdocs-ac2,#b4befe);}";

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
  var viewBtn = null, viewMenu = null;   // меню вида (шрифт/ширина/плотность)
  var rprogFill = null;      // заполнение полосы прогресса чтения
  var noResultEl = null;     // «ничего не найдено» под поиском
  var readBtn = null;
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
    title.innerHTML = "📘 <b>Документация C++</b>";
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
    tocBtn = el("button", null, "☰ Разделы"); tocBtn.className = "cd-rbtn";
    tocBtn.title = "Оглавление файла сбоку (показать/скрыть)";
    rbar.appendChild(titleEl); rbar.appendChild(viewWrap); rbar.appendChild(tocBtn); rbar.appendChild(readBtn);
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
    if (start) openFile(start.rel);

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
      navListEl.appendChild(el("div", null, "Материалы не найдены. Проверь путь к docs в настройке cppDocs.path.")).className = "cd-empty";
      return;
    }
    groups.forEach(function (g) {
      var section = el("div", null); section.className = "cd-group";
      if (state.collapsed[g.label]) section.classList.add("collapsed");
      section.setAttribute("data-group", g.label);

      var ghead = el("button", null); ghead.className = "cd-ghead"; ghead.type = "button";
      ghead.innerHTML = '<span class="cd-chev">▾</span><span class="cd-gl"></span><span class="cd-gc"></span>';
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

  function toggleRead(rel) {
    if (state.read[rel]) delete state.read[rel]; else state.read[rel] = true;
    saveState();
    var it = itemEls.filter(function (x) { return x.getAttribute("data-rel") === rel; })[0];
    if (it) {
      it.classList.toggle("read", !!state.read[rel]);
      var b = it.querySelector(".cd-it-act button");
      if (b) { b.textContent = state.read[rel] ? "✓" : "○"; b.className = state.read[rel] ? "on-read" : ""; }
    }
    if (current && current.rel === rel) syncReadBtn();
    updateProgress();
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
        noResultEl.innerHTML = "Ничего не найдено по запросу<br><b>«" + escapeHtml(searchInput.value.trim()) + "»</b>";
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
        if (t) { t.scrollIntoView({ block: "start" }); flashHeading(t); }
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
      curHeadings.push({ el: h, slug: h.id, text: h.textContent });
    });
  }
  var _scrollSaveTimer = null;
  function onContentScroll() {
    if (!contentEl) return;
    var max = contentEl.scrollHeight - contentEl.clientHeight;
    var pct = max > 0 ? contentEl.scrollTop / max : 0;
    if (rprogFill) rprogFill.style.width = Math.round(clamp(pct, 0, 1) * 100) + "%";
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
  }
  function applyReaderPrefs() {
    if (!winEl) return;
    winEl.classList.toggle("wide", !!state.wide);
    winEl.classList.toggle("dense", !!state.dense);
    winEl.classList.toggle("no-outline", !isOutlineOn());
    if (tocBtn) tocBtn.classList.toggle("act", isOutlineOn());
    if (articleEl) articleEl.style.zoom = String(state.fs || 1);
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
      if (t) { t.scrollIntoView({ block: "start" }); return; }
    }
    if (box) box.scrollTop = 0;
  }
  function onSplitClick(e) {
    var copy = e.target.closest && e.target.closest(".copybtn");
    if (copy) { doCopy(copy); return; }
    var a = e.target.closest && e.target.closest("a[href]");
    if (a && splitCurrent) {
      var href = a.getAttribute("href");
      if (/^https?:/i.test(href)) return;
      e.preventDefault();
      if (href.charAt(0) === "#") { openInSplit(splitCurrent.rel, href); return; }
      var res = resolveRel(splitCurrent.rel, href);
      var map = fileMap();
      if (/\.md$/i.test(res.rel) && map[res.rel.toLowerCase()]) openInSplit(res.rel, res.hash);
    }
  }

  // ------- открытие файла -------
  function openFile(rel, hash) {
    var map = fileMap();
    var f = map[String(rel).toLowerCase()];
    if (!f) return;
    // запомнить позицию прокрутки в уходящем файле
    if (current && contentEl) state.scroll[current.rel] = contentEl.scrollTop;
    current = f;
    state.last = f.rel.toLowerCase();
    if (!navHist) pushHistory(f.rel, hash || "");
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
    syncReadBtn();
    highlightActive();
    // отметить прочитанным при открытии
    if (!state.read[f.rel]) { state.read[f.rel] = true; refreshItemRead(f.rel); updateProgress(); }
    saveState();
    // прокрутка к якорю, к сохранённой позиции или наверх
    if (hash) {
      var target = articleEl.querySelector('[id="' + cssEscape(decodeURIComponent(hash.replace(/^#/, ""))) + '"]');
      if (target) { target.scrollIntoView({ block: "start" }); flashHeading(target); onContentScroll(); return; }
    }
    contentEl.scrollTop = state.scroll[f.rel] || 0;
    onContentScroll();
  }
  function refreshItemRead(rel) {
    var it = itemEls.filter(function (x) { return x.getAttribute("data-rel") === rel; })[0];
    if (it) {
      it.classList.add("read");
      var b = it.querySelector(".cd-it-act button");
      if (b) { b.textContent = "✓"; b.className = "on-read"; }
    }
  }

  // Картинки: data-src → file:// абсолютный путь относительно корня доков.
  function resolveImagesIn(root, f) {
    var d = DATA(); if (!d || !f || !root) return;
    root.querySelectorAll("img[data-src]").forEach(function (img) {
      var src = img.getAttribute("data-src");
      if (/^https?:|^data:/.test(src)) { img.src = src; return; }
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
    var pre = btn.parentNode.querySelector("pre.code code");
    var text = pre ? pre.textContent : "";
    try {
      navigator.clipboard.writeText(text).then(function () { flashCopy(btn); }, function () { legacyCopy(text); flashCopy(btn); });
    } catch (err) { legacyCopy(text); flashCopy(btn); }
  }
  function onArticleClick(e) {
    var copy = e.target.closest && e.target.closest(".copybtn");
    if (copy) { doCopy(copy); return; }
    var a = e.target.closest && e.target.closest("a[href]");
    if (a) {
      var href = a.getAttribute("href");
      if (/^https?:/i.test(href)) return; // внешняя — пусть откроется как есть
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

  // ------- клавиатура -------
  function onKey(e) {
    if (!winEl) return;
    if (e.key === "Escape") {
      if (viewMenu && !viewMenu.hidden) { viewMenu.hidden = true; return; }
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

  // Перечитать данные: расширение перезаписало cpp-docs-data.js — подтягиваем свежую
  // версию тем же трюком, что и live-данные vscode-bg (тег <script> с меткой времени).
  function refreshData() {
    var d = DATA();
    var url = d && d.dataUrl;
    if (!url) { rebuildFromData(); return; }
    var s = document.createElement("script");
    s.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "r=" + Date.now();
    s.async = true;
    // Всегда пересобираем: при успехе — со свежими данными, при ошибке загрузки
    // (CSP/файла нет) — хотя бы из уже загруженных, чтобы кнопка не казалась «мёртвой».
    s.onload = function () { rebuildFromData(); try { s.remove(); } catch (e) {} };
    s.onerror = function () { rebuildFromData(); try { s.remove(); } catch (e) {} };
    document.head.appendChild(s);
  }
  function rebuildFromData() {
    if (!winEl) return;
    var keepRel = current && current.rel;
    renderNav();
    var map = fileMap();
    if (keepRel && map[keepRel.toLowerCase()]) openFile(keepRel);
    else { var d = DATA(); if (d && d.files[0]) openFile(d.files[0].rel); }
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
    var d = DATA();
    var n = d ? d.files.length : 0;
    var b = el("div"); b.id = BTN_ID;
    b.setAttribute("role", "button");
    b.setAttribute("tabindex", "0");
    b.setAttribute("aria-label", "Открыть документацию C++");
    b.title = "Документация C++ — открыть плавающее окно";
    b.innerHTML = "📘 C++" + (n ? ' <span class="cd-badge">' + n + "</span>" : "");
    b.addEventListener("click", toggleWindow);
    b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleWindow(); } });
    document.body.appendChild(b);
    if (winEl) b.style.display = "none";
  }

  function heal() {
    try { applyAccent(); } catch (e) {}   // акцент под тему/обои — до отрисовки стиля и кнопки
    try { ensureStyle(); } catch (e) {}
    try { ensureButton(); } catch (e) {}
    // Тема окна могла смениться.
    try { if (winEl) winEl.classList.toggle("light", isLight()); } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  //  Старт.
  // ---------------------------------------------------------------------------
  function boot() {
    heal();
    // Возврат кнопки после перестройки DOM редактором — тем же лёгким тикером, что у vscode-bg.
    setInterval(function () { if (!document.hidden) heal(); }, 3000);
    try {
      new MutationObserver(function () { heal(); }).observe(document.body || document.documentElement, { childList: true });
    } catch (e) {}
    console.log("[cpp-docs] плавающее окно " + VERSION + " готово, материалов: " + (DATA() ? DATA().files.length : 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Узкий мост для превью/отладки (в реальном воркбенче не мешает).
  window.__cppDocs = { open: openWindow, close: closeWindow, toggle: toggleWindow, render: renderMarkdown };
})();
