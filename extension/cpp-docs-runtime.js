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
  // Логотип как data-URI. В оболочке VS Code рантайм не может грузить файл с диска, поэтому
  // картинка встроена. Значение подставляет `node scripts/embed-logo.js` из docs/screenshots/logo-embed.png.
  var LOGO_URI = "data:image/png;base64,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";

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
  "#" + WIN_ID + " .cd-home-inner{max-width:768px;margin:0 auto;padding:36px 30px 64px;}" +
  "#" + WIN_ID + " .cd-home-hero{display:flex;align-items:center;gap:18px;margin-bottom:26px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-home-logo{flex:0 0 auto;width:66px;height:66px;border-radius:17px;overflow:hidden;" +
  "box-shadow:0 10px 26px rgba(var(--ac-rgb),.26),inset 0 0 0 1px rgba(var(--ac-rgb),.22);}" +
  "#" + WIN_ID + " .cd-home-logo img{width:100%;height:100%;display:block;}" +
  "#" + WIN_ID + " .cd-home-htxt{flex:1 1 200px;min-width:0;}" +
  "#" + WIN_ID + " .cd-home-hi{font-size:24px;font-weight:800;letter-spacing:-.015em;color:var(--fg);line-height:1.12;}" +
  "#" + WIN_ID + " .cd-home-sub{font-size:13px;color:var(--muted);margin-top:4px;}" +
  // Кольцо общего прогресса
  "#" + WIN_ID + " .cd-ring{flex:0 0 auto;position:relative;width:74px;height:74px;}" +
  "#" + WIN_ID + " .cd-ring svg{width:100%;height:100%;transform:rotate(-90deg);}" +
  "#" + WIN_ID + " .cd-ring-bg{fill:none;stroke:var(--bd);stroke-width:5;}" +
  "#" + WIN_ID + " .cd-ring-fg{fill:none;stroke:var(--ac);stroke-width:5;stroke-linecap:round;transition:stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-ring-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-ring-pct{font-size:17px;font-weight:800;color:var(--fg);line-height:1;font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-ring-sub{font-size:8px;color:var(--faint);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;}" +
  "#" + WIN_ID + " .cd-home-cont{display:flex;align-items:center;gap:14px;width:100%;text-align:left;font-family:inherit;cursor:pointer;border:1px solid rgba(var(--ac-rgb),.30);" +
  "background:linear-gradient(135deg,rgba(var(--ac-rgb),.17),rgba(var(--ac-rgb),.05));border-radius:14px;padding:15px 18px;margin-bottom:26px;transition:transform .13s,box-shadow .13s,border-color .13s;}" +
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
  "#" + WIN_ID + " .cd-home-sec{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--faint);margin:0 2px 11px;}" +
  "#" + WIN_ID + " .cd-home-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(198px,1fr));gap:10px;margin-bottom:28px;}" +
  "#" + WIN_ID + " .cd-home-card{position:relative;text-align:left;font-family:inherit;cursor:pointer;border:1px solid var(--bd);background:var(--panel);border-radius:12px;padding:13px 15px 13px 18px;overflow:hidden;transition:transform .13s,box-shadow .13s,border-color .13s,background .13s;}" +
  "#" + WIN_ID + " .cd-home-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--gcolor,var(--ac));opacity:.85;}" +
  "#" + WIN_ID + " .cd-home-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(0,0,0,.24);border-color:color-mix(in srgb,var(--gcolor,var(--ac)) 45%,var(--bd));background:color-mix(in srgb,var(--gcolor,var(--ac)) 7%,var(--panel));}" +
  "#" + WIN_ID + " .cd-hcard-t{font-size:13.5px;font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-hcard-s{font-size:11.5px;color:var(--muted);margin-top:3px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
  "#" + WIN_ID + " .cd-home-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;}" +
  "#" + WIN_ID + " .cd-home-chip{font-family:inherit;cursor:pointer;font-size:12px;color:var(--fg);border:1px solid var(--bd);background:var(--panel);border-radius:999px;padding:6px 13px;display:inline-flex;align-items:center;gap:7px;transition:border-color .12s,background .12s,transform .12s;}" +
  "#" + WIN_ID + " .cd-home-chip::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--gcolor,var(--ac));flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-home-chip:hover{border-color:var(--ac);transform:translateY(-1px);}" +
  "#" + WIN_ID + ".home .cd-file-only{display:none;}" +
  "#" + WIN_ID + ".home .cd-rprog{visibility:hidden;}" +
  "@keyframes cd-home-in{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + " .cd-home.cd-in-anim{animation:cd-home-in .2s ease-out;}" +
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
  "#" + WIN_ID + " .cd-item.active{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gcolor,var(--ac)) 26%,transparent);}" +

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
  var homeEl = null, homeBtn = null;     // главный экран (приветствие) + кнопка «Главная»
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
    rbar.appendChild(titleEl); rbar.appendChild(homeBtn); rbar.appendChild(viewWrap); rbar.appendChild(tocBtn); rbar.appendChild(readBtn);
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

    // главный экран (приветствие) — оверлей поверх области чтения
    homeEl = el("div", null); homeEl.className = "cd-home"; homeEl.hidden = true;
    rmain.appendChild(homeEl);

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
      navListEl.appendChild(el("div", null, "Материалы не найдены. Проверь путь к docs в настройке cppDocs.path.")).className = "cd-empty";
      return;
    }
    groups.forEach(function (g) {
      var section = el("div", null); section.className = "cd-group";
      if (state.collapsed[g.label]) section.classList.add("collapsed");
      section.setAttribute("data-group", g.label);
      // Цвет группы доступен всей секции (заголовок + счётчик красятся под него).
      section.style.setProperty("--gcolor", g.color);

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
  function buildHome() {
    if (!homeEl) return;
    var d = DATA(); if (!d) return;
    var total = d.files.length, done = 0;
    d.files.forEach(function (f) { if (state.read[f.rel]) done++; });
    var pct = total ? Math.round(done / total * 100) : 0;
    var hi = done > 0 ? "С возвращением!" : "Привет!";
    var sub = greeting() + (done > 0 ? " · продолжаем учить C++" : " · документация C++ у тебя под рукой");

    var logo = LOGO_URI ? '<img src="' + LOGO_URI + '" alt="Документация C++">' : "";
    var r = 32, circ = 2 * Math.PI * r, off = circ * (1 - pct / 100);
    var ring = '<div class="cd-ring"><svg viewBox="0 0 74 74" aria-hidden="true">' +
      '<circle class="cd-ring-bg" cx="37" cy="37" r="' + r + '"></circle>' +
      '<circle class="cd-ring-fg" cx="37" cy="37" r="' + r + '" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle>' +
      '</svg><div class="cd-ring-label"><div class="cd-ring-pct">' + pct + '%</div><div class="cd-ring-sub">изучено</div></div></div>';

    var html = '<div class="cd-home-inner">';
    html += '<div class="cd-home-hero"><div class="cd-home-logo">' + logo + '</div>' +
      '<div class="cd-home-htxt"><div class="cd-home-hi">' + escapeHtml(hi) + '</div>' +
      '<div class="cd-home-sub">' + escapeHtml(sub) + '</div></div>' + ring + '</div>';

    // Продолжить (последний открытый) либо предложить старт
    var lastF = state.last ? lookupFile(state.last) : null;
    var contF = lastF || findFile(/00-нач|начни/i) || d.files[0];
    if (contF) {
      var m = metaOf(contF);
      html += '<button class="cd-home-cont" data-rel="' + escapeHtml(contF.rel) + '">' +
        '<div class="cd-hc-main">' +
        '<div class="cd-hc-lbl">' + (lastF ? "▶ Продолжить чтение" : "▶ Начать здесь") + '</div>' +
        '<div class="cd-hc-title">' + escapeHtml(contF.title || contF.name) + '</div>' +
        (m ? '<div class="cd-hc-meta">' + escapeHtml(m) + '</div>' : '') +
        '</div><div class="cd-hc-arrow">→</div>' +
        '</button>';
    }

    // Быстрый доступ — ключевые точки, цвет карточки = цвет группы файла
    var quick = [
      { re: /00-нач|начни/i, t: "Начни отсюда", s: "карта: что где лежит и с чего начать" },
      { re: /marshrut|маршрут/i, t: "Маршрут изучения", s: "этапы по порядку с чекпоинтами" },
      { re: /shpargalka|шпаргал/i, t: "Шпаргалка", s: "самое частое на один экран" },
      { re: /^ref\//i, t: "Справочник по темам", s: "подробно по каждой теме" },
      { re: /^examples\//i, t: "Примеры программ", s: "готовый код — собран и запущен" },
      { re: /zadachnik|задачник/i, t: "Задачник", s: "задачи для практики" }
    ];
    var cards = "";
    quick.forEach(function (q) {
      var f = findFile(q.re); if (!f) return;
      cards += '<button class="cd-home-card" data-rel="' + escapeHtml(f.rel) + '" style="--gcolor:' + escapeHtml(f.groupColor || "var(--ac)") + '">' +
        '<div class="cd-hcard-t">' + escapeHtml(q.t) + '</div>' +
        '<div class="cd-hcard-s">' + escapeHtml(f.subtitle || q.s) + '</div></button>';
    });
    if (cards) html += '<div class="cd-home-sec">Быстрый доступ</div><div class="cd-home-grid">' + cards + '</div>';

    // Закреплённое (если есть)
    var pinRels = Object.keys(state.pins || {}).filter(function (r) { return state.pins[r] && lookupFile(r); });
    if (pinRels.length) {
      var chips = "";
      pinRels.slice(0, 12).forEach(function (r) {
        var f = lookupFile(r);
        chips += '<button class="cd-home-chip" data-rel="' + escapeHtml(f.rel) + '" style="--gcolor:' + escapeHtml(f.groupColor || "var(--ac)") + '">' + escapeHtml(f.title || f.name) + '</button>';
      });
      html += '<div class="cd-home-sec">Закреплённое</div><div class="cd-home-chips">' + chips + '</div>';
    }
    html += '</div>';
    homeEl.innerHTML = html;

    homeEl.querySelectorAll("[data-rel]").forEach(function (b) {
      b.addEventListener("click", function () { openFile(b.getAttribute("data-rel")); });
    });
  }
  function showHome() {
    if (!homeEl || !winEl) return;
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
    if (!silent) state.last = f.rel.toLowerCase();
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
    syncReadBtn();
    highlightActive();
    // отметить прочитанным при открытии (но не при тихой стартовой предзагрузке)
    if (!silent && !state.read[f.rel]) { state.read[f.rel] = true; refreshItemRead(f.rel); updateProgress(); }
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
