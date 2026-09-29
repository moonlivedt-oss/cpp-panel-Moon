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

