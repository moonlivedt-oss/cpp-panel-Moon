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

