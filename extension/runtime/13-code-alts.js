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
