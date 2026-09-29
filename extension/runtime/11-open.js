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

