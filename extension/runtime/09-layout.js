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
    window.addEventListener("resize", function () {
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

