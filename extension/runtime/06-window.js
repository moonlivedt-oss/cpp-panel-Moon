  // ==== runtime/06-window.js — построение окна: шапка, навигатор, статья ====
  // ---------------------------------------------------------------------------
  //  Построение окна.
  // ---------------------------------------------------------------------------
  var winEl = null;          // корень окна
  var navListEl = null;      // контейнер списка файлов
  var filterBarEl = null;    // чипы-фильтр над списком (Всё/Не изучено/Закреплённое/С заметками)
  var ctxMenu = null;        // контекстное меню пункта (правый клик)
  var searchInput = null;
  var searchJumpTerm = "";   // слово из поиска: при открытии материала прыгнуть к нему и подсветить
  var contentEl = null;      // область статьи
  var articleEl = null;      // .cd-article
  var bridgeEl = null;       // плашка-подсказка моста доки↔редактор (слово под курсором)
  var titleEl = null;        // хлебные крошки в шапке окна: раздел › тема › подраздел
  var groupCrumbEl = null;   // крошка «раздел» (значок + название группы)
  var rnameEl = null;        // имя текущего файла
  var crumbEl = null;        // хлебная крошка «текущий раздел»
  var dockBtnEl = null;      // «закрепить справа»
  var secProgEl = null;      // «Раздел 3/9 ● ● ● ○» — где ты в теме и что уже прочитано
  var logoEl = null;         // логотип в шапке — вокруг него кольцо общего прогресса
  var revBellEl = null;      // шапка: «🎴 N» — карточки к повторению
  var nextBtnEl = null;      // шапка: «Дальше» — следующее действие по месту
  var edBtnEl = null, edPopEl = null, edEnv = null;   // шапка: связь с редактором (файл, ошибки, компилятор)
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
  var reviewEl = null, reviewQueue = [], reviewPos = 0, reviewOk = 0, reviewWarmup = false;  // сессия повторения карточек (+ это «Разминка дня»?)
  var reviewLog = [], reviewUndo = null, reviewStreak = 0, reviewTyped = "";   // оценки сессии, «↶ Назад», серия, «сначала вспомни»
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
    if (navHiddenNow()) w.classList.add("navhidden");

    // --- размеры/позиция ---
    var vw = viewW(), vh = window.innerHeight || 800;
    var width = clamp(state.w || Math.min(1120, Math.round(vw * 0.92)), 560, vw - 20);
    var height = clamp(state.h || Math.min(760, Math.round(vh * 0.86)), 380, vh - 20);
    var left = state.x != null ? clamp(state.x, 0, vw - width) : Math.round((vw - width) / 2);
    var top = state.y != null ? clamp(state.y, safeTop(), vh - height) : Math.max(safeTop(), Math.round((vh - height) / 2));
    w.style.width = width + "px"; w.style.height = height + "px";
    w.style.left = left + "px"; w.style.top = top + "px";

    // --- шапка ---
    var head = el("div", null); head.className = "cd-head";
    var navToggle = hbtn("☰", "Скрыть/показать список файлов", "menu");
    navToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      // Раскладка запоминается отдельно для главной и для чтения.
      if (w.classList.contains("home")) state.navHiddenHome = !state.navHiddenHome;
      else state.navHidden = !state.navHidden;
      saveState();
      w.classList.toggle("navhidden", navHiddenNow());
      applyResponsive();
    });
    backBtn = hbtn("‹", "Назад", "back");
    backBtn.addEventListener("click", function (e) { e.stopPropagation(); goBack(); });
    fwdBtn = hbtn("›", "Вперёд", "forward");
    fwdBtn.addEventListener("click", function (e) { e.stopPropagation(); goForward(); });
    var title = el("div", null); title.className = "cd-title";
    // Логотип в кольце общего прогресса (--lp, %), рядом — хлебные крошки вместо статичного названия.
    setHTML(title, '<span class="cd-logo" role="button" title="На главную" tabindex="0"><span class="cd-logo-in">' +
      (LOGO_URI ? '<img src="' + LOGO_URI + '" alt="">' : "📘") + "</span></span>");
    logoEl = title.querySelector(".cd-logo");
    logoEl.addEventListener("click", function (e) { e.stopPropagation(); showHome(); });
    logoEl.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); showHome(); } });
    var snapL = hbtn("◧", "Прижать влево (половина экрана)", "snap-left");
    snapL.addEventListener("click", function (e) { e.stopPropagation(); snapWindow("left"); });
    var snapR = hbtn("◨", "Прижать вправо (половина экрана)", "snap-right");
    snapR.addEventListener("click", function (e) { e.stopPropagation(); snapWindow("right"); });
    dockBtnEl = hbtn("⇥", "Закрепить справа: редактор сдвинется и не будет под окном (ещё раз — открепить)", "dock");
    dockBtnEl.addEventListener("click", function (e) { e.stopPropagation(); toggleDock(); });
    if (state.docked) dockBtnEl.classList.add("on");
    var rollBtn = hbtn("⎯", "Свернуть в полоску / развернуть (двойной клик по шапке)", "roll");
    rollBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleRoll(); });
    var maxBtn = hbtn("▢", "Во весь экран / восстановить", "maximize");
    maxBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleMax(); });
    var splitBtn = hbtn("⊟", "Второй документ рядом (сплит)", "split");
    splitBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleSplit(); });
    var refreshBtn = hbtn("⟳", "Обновить материалы", "refresh");
    refreshBtn.addEventListener("click", function (e) { e.stopPropagation(); refreshData(); });
    var closeBtn = hbtn("✕", "Закрыть (Esc)", "close");
    closeBtn.addEventListener("click", function (e) { e.stopPropagation(); closeWindow(); });
    // В свёрнутой полоске видно, что открыто: «Тема › раздел»; щелчок — развернуть.
    rollInfoEl = el("button", null); rollInfoEl.type = "button"; rollInfoEl.className = "cd-rollinfo";
    rollInfoEl.title = "Развернуть окно";
    rollInfoEl.addEventListener("click", function (e) { e.stopPropagation(); if (state.rolled) toggleRoll(); });
    // Хлебные крошки: «раздел › тема › подраздел». Раздел — раскрыть его в списке слева,
    // тема — к её началу, подраздел — к его заголовку.
    titleEl = el("div", null); titleEl.className = "cd-crumbs";
    groupCrumbEl = el("button", null); groupCrumbEl.type = "button"; groupCrumbEl.className = "cd-cg"; groupCrumbEl.hidden = true;
    groupCrumbEl.addEventListener("click", function (e) { e.stopPropagation(); if (current) revealGroup(current.group); });
    rnameEl = el("span", null, "Главная"); rnameEl.className = "cd-rname";
    crumbEl = el("span", null); crumbEl.className = "cd-crumb";
    secProgEl = el("span", null); secProgEl.className = "cd-secprog"; secProgEl.hidden = true;
    titleEl.appendChild(groupCrumbEl); titleEl.appendChild(rnameEl); titleEl.appendChild(crumbEl); titleEl.appendChild(secProgEl);
    rnameEl.addEventListener("click", function (e) {
      e.stopPropagation();
      if (current && contentEl && !(winEl && winEl.classList.contains("home"))) contentEl.scrollTo({ top: 0, behavior: "smooth" });
    });
    crumbEl.addEventListener("click", function (e) {
      e.stopPropagation();
      var slug = crumbEl.getAttribute("data-slug"); if (!slug || !articleEl) return;
      var t = articleEl.querySelector('[id="' + cssEscape(slug) + '"]');
      if (t) { t.scrollIntoView({ block: "start", behavior: "smooth" }); flashHeading(t); }
    });
    title.appendChild(titleEl);
    title.appendChild(rollInfoEl);
    // Середина шапки: карточки к повторению · связь с редактором · «Дальше».
    var hx = el("div", null); hx.className = "cd-hx";
    revBellEl = el("button", null); revBellEl.type = "button"; revBellEl.className = "cd-hpill cd-hrev"; revBellEl.hidden = true;
    revBellEl.addEventListener("click", function (e) { e.stopPropagation(); if (warmupDoneToday()) startReview(); else startWarmup(); });
    edBtnEl = el("button", null); edBtnEl.type = "button"; edBtnEl.className = "cd-hpill cd-hed"; edBtnEl.hidden = true;
    setHTML(edBtnEl, '<i class="cd-hed-dot"></i><span class="cd-hed-n"></span><b class="cd-hed-e"></b>');
    edBtnEl.addEventListener("click", function (e) { e.stopPropagation(); toggleEdPop(); });
    nextBtnEl = el("button", null); nextBtnEl.type = "button"; nextBtnEl.className = "cd-hnext"; nextBtnEl.hidden = true;
    setHTML(nextBtnEl, '<span class="cd-hnext-t"></span><span class="cd-hnext-a" aria-hidden="true">›</span>');
    nextBtnEl.addEventListener("click", function (e) { e.stopPropagation(); goHeadNext(); });
    hx.appendChild(revBellEl); hx.appendChild(edBtnEl); hx.appendChild(nextBtnEl);
    // Инструменты чтения (Главная, Разделы, ⚙ ⌕ ⧉, Изучено) — тоже в шапке; наполняются ниже, где создаются.
    var hrt = el("div", null); hrt.className = "cd-hrt";
    closeBtn.classList.add("cd-close");
    // Кнопки шапки — «капсулами»: навигация слева, управление окном справа (с разделителями).
    function hgroup(items, cls) {
      var g = el("div", null); g.className = "cd-hgrp" + (cls ? " " + cls : "");
      items.forEach(function (it) {
        if (it === "|") { var sep = el("i", null); sep.className = "cd-hsep"; g.appendChild(sep); }
        else g.appendChild(it);
      });
      return g;
    }
    head.appendChild(hgroup([navToggle, backBtn, fwdBtn], "cd-hg-nav")); head.appendChild(title);
    head.appendChild(hx); head.appendChild(hrt);
    head.appendChild(hgroup([splitBtn, snapL, snapR, dockBtnEl, "|", rollBtn, maxBtn, "|", refreshBtn, closeBtn], "cd-hg-win"));
    [snapL, snapR, dockBtnEl, rollBtn, maxBtn, closeBtn].forEach(function (b) { b.classList.add("cd-winctl"); });   // во вкладке этим управляет VS Code
    head.addEventListener("dblclick", function (e) {
      if (headInteractive(e.target)) return;  // двойной клик по кнопке/крошке/меню — не сворачивать
      toggleRoll();
    });
    w.appendChild(head);
    // #4 Зерно: почти невидимый шум поверх окна — убирает «ступеньки» на градиентах.
    var grain = el("div", null); grain.className = "cd-grain"; grain.setAttribute("aria-hidden", "true");
    w.appendChild(grain);

    // --- тело ---
    var body = el("div", null); body.className = "cd-body";

    // навигатор
    var nav = el("aside", null); nav.className = "cd-nav";
    var searchWrap = el("div", null); searchWrap.className = "cd-search";
    setHTML(searchWrap, '<span class="cd-si">⌕</span><button class="cd-sx" type="button" title="Очистить">✕</button>');
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

    // Чипы-фильтр над списком материалов.
    filterBarEl = el("div", null); filterBarEl.className = "cd-filterbar";
    [["all", "Всё"], ["unread", "Не изучено"], ["pinned", "Закреплённое"], ["noted", "С заметками"], ["hl", "С выделениями"]].forEach(function (pair) {
      var chip = el("button", null, pair[1]); chip.type = "button"; chip.className = "cd-fchip";
      chip.setAttribute("data-filter", pair[0]);
      chip.addEventListener("click", function () { state.navFilter = pair[0]; saveState(); syncFilterChips(); renderNav(); });
      filterBarEl.appendChild(chip);
    });
    nav.appendChild(filterBarEl);
    syncFilterChips();

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
    readBtn = el("button", null); readBtn.className = "cd-rbtn cd-readbtn"; setHTML(readBtn, uiLabel("read-off", "○", "Изучено"));
    readBtn.title = "Отметить материал изученным";
    // Настройки — отдельная кнопка, видна ВСЕГДА (на главной, в повторении, в материале); сама
    // панель — окно поверх всего окна документации (кладём его в корень окна в wireViewMenu).
    viewBtn = el("button", null); viewBtn.className = "cd-rbtn cd-setbtn"; viewBtn.type = "button";
    setHTML(viewBtn, uiLabel("settings", "⚙")); viewBtn.title = "Настройки: тема, палитра, шрифт, поведение";
    viewBtn.setAttribute("aria-label", "Настройки"); viewBtn.setAttribute("aria-haspopup", "dialog");
    viewMenu = el("div", null); viewMenu.className = "cd-viewmenu cd-set"; viewMenu.hidden = true;
    tocBtn = el("button", null); tocBtn.className = "cd-rbtn cd-file-only"; setHTML(tocBtn, uiLabel("sections", "☰", "Разделы"));
    tocBtn.title = "Оглавление файла сбоку (показать/скрыть)";
    readBtn.classList.add("cd-file-only");
    // кнопка возврата на главный экран (приветствие) — всегда видна
    homeBtn = el("button", null); homeBtn.className = "cd-rbtn cd-hb-home"; homeBtn.type = "button"; setHTML(homeBtn, uiLabel("home", "⌂", "Главная"));
    homeBtn.title = "На главную (приветствие и быстрый доступ)";
    homeBtn.addEventListener("click", function () { showHome(); });
    // «Копировать весь материал» — исходный Markdown текущего файла в буфер обмена.
    copyDocBtn = el("button", null); copyDocBtn.className = "cd-rbtn cd-file-only"; copyDocBtn.type = "button"; setHTML(copyDocBtn, uiLabel("copy", "⧉"));
    copyDocBtn.title = "Копировать весь материал (Markdown)";
    copyDocBtn.setAttribute("aria-label", "Копировать весь материал");
    copyDocBtn.addEventListener("click", function () { copyWholeDoc(copyDocBtn); });
    // «Найти в тексте» — открывает панель поиска по открытому материалу.
    findBtn = el("button", null); findBtn.className = "cd-rbtn cd-file-only"; findBtn.type = "button"; setHTML(findBtn, uiLabel("find", "⌕"));
    findBtn.title = "Найти в этом материале"; findBtn.setAttribute("aria-label", "Найти в материале");
    findBtn.addEventListener("click", function () { toggleFind(); });
    // Инструменты материала (поиск, копировать) — одной сегментированной капсулой.
    var tools = el("div", null); tools.className = "cd-rgrp cd-file-only";
    tools.appendChild(findBtn); tools.appendChild(copyDocBtn);
    // Маскот выглядывает из-за нижней кромки шапки — рядом с кнопками (декор, не кликается).
    if ((typeof STICKERS !== "undefined" && STICKERS && STICKERS["ui-peek"])) {
      var peek = el("img", null); peek.className = "cd-peek"; peek.alt = ""; peek.src = STICKERS["ui-peek"];
      peek.setAttribute("aria-hidden", "true"); peek.draggable = false;
      hrt.appendChild(peek);
    }
    // Бывшая вторая полоса «панель темы» живёт в шапке окна (одна полоса — больше места под текст).
    hrt.appendChild(homeBtn); hrt.appendChild(viewBtn); hrt.appendChild(tocBtn); hrt.appendChild(tools); hrt.appendChild(readBtn);

    // тонкая полоса прогресса чтения текущего файла
    var rprog = el("div", null); rprog.className = "cd-rprog";
    rprogFill = el("i", null); rprog.appendChild(rprogFill);
    reader.appendChild(rprog);

    // основная область: статья + боковое оглавление-рейка
    var rmain = el("div", null); rmain.className = "cd-rmain";
    contentEl = el("div", null); contentEl.className = "cd-content";
    articleEl = el("div", null); articleEl.className = "cd-article";
    contentEl.appendChild(articleEl);
    // Плашка-мост: всплывает снизу области чтения, когда курсор в C/C++-файле стоит на знакомом слове.
    bridgeEl = el("div", null); bridgeEl.className = "cd-bridge"; bridgeEl.hidden = true;
    setHTML(bridgeEl, '<span class="cd-bridge-ic">✎</span><div class="cd-bridge-body">' +
      '<div class="cd-bridge-word"></div><div class="cd-bridge-def"></div></div>' +
      '<button class="cd-bridge-ex" type="button" hidden title="Открыть правильный мини-пример в новом файле (твой код не трогаем)">Пример</button>' +
      '<button class="cd-bridge-open" type="button">Открыть</button>' +
      '<button class="cd-bridge-x" type="button" title="Скрыть подсказку" aria-label="Скрыть">✕</button>');
    bridgeEl.querySelector(".cd-bridge-open").addEventListener("click", function () { bridgeOpen(); });
    bridgeEl.querySelector(".cd-bridge-ex").addEventListener("click", function () {
      var b = this, code = bridgeExample; if (!code) return;
      b.disabled = true;
      sendAction({ kind: "newfile", code: "// Правильный вариант — сравни со своим кодом\n" + code }, function (res) {
        b.disabled = false;
        if (res.ok) toast("Пример открыт в новом файле"); else toast("Не открылось: " + (res.error || "ошибка"), true);
      });
    });
    bridgeEl.querySelector(".cd-bridge-x").addEventListener("click", function () { hideBridge(true); });
    contentEl.appendChild(bridgeEl);
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
    splitArticle.addEventListener("input", onArticleInput);
    rmain.appendChild(splitEl);

    // главный экран (приветствие) — оверлей поверх области чтения
    // Фон главной отдельным слоем под ней: сияние (#3) + звёздное небо прогресса (#1).
    homeBgEl = el("div", null); homeBgEl.className = "cd-homebg"; homeBgEl.setAttribute("aria-hidden", "true");
    rmain.appendChild(homeBgEl);
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
    applyRoll();   // восстановить мини-режим, если был свёрнут

    // --- поведение ---
    installDrag(w, head);
    wireSearch();
    wireTocButton();
    wireViewMenu();
    readBtn.addEventListener("click", function () { if (current) { toggleRead(current.rel); } });
    continueBtn.addEventListener("click", openNextUnread);

    // клики по статье: копирование кода и внутренние ссылки
    articleEl.addEventListener("click", onArticleClick);
    // движение слайдеров «живого примера» — пересчёт кода и вывода на лету
    articleEl.addEventListener("input", onArticleInput);
    articleEl.addEventListener("mousemove", deckTilt, { passive: true });
    articleEl.addEventListener("mouseover", memHover, { passive: true });
    articleEl.addEventListener("mouseleave", deckTilt, { passive: true });
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
    // первое открытие — знакомство в 3 шага; только если главная ещё на экране (материал могли
    // открыть за эти 0,7 с — например, «Найти в справочнике» из редактора; тогда тур — в следующий раз)
    if (!state.tourDone) setTimeout(function () { if (homeEl && !homeEl.hidden) startTour(); }, 700);

    // Esc закрывает окно (и меню разделов).
    document.addEventListener("keydown", onKey, true);

    return w;
  }

  // ---- Иконки интерфейса: свои картинки вместо символов ----
  //  Картинки кладутся в extension/ui-icons/<имя>.png|webp и встраиваются командой
  //  npm run embed:ui-icons (между маркерами ниже). Нет картинки — остаётся символ.
  /* UI_ICONS:start */
  var UI_ICONS = {};
  /* UI_ICONS:end */
  // Подпись кнопки: иконка (или символ) + текст. textContent остаётся «символ текст».
  function uiLabel(name, glyph, text) {
    var uri = UI_ICONS && UI_ICONS[name];
    var ic = uri ? '<img class="cd-uiic" src="' + uri + '" alt="' + escapeHtml(glyph) + '" draggable="false">'
                 : '<span class="cd-ic">' + escapeHtml(glyph) + "</span>";
    return ic + (text ? ' <span class="cd-bt">' + escapeHtml(text) + "</span>" : "");
  }
  function hbtn(sym, title, name) {
    var b = el("button", null); b.className = "cd-hbtn"; b.type = "button"; b.title = title;
    b.setAttribute("aria-label", title);
    setHTML(b, uiLabel(name || "", sym));
    return b;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // Высота строки заголовка VS Code (нативные кнопки свернуть/развернуть/закрыть). Окно держим
  // НИЖЕ неё, чтобы его шапка не налезала на эти кнопки — без F11 и без правки settings.json.
  // В полноэкранном режиме заголовка нет (offsetHeight 0) — вернём 0, и ограничение снимется само.
  function safeTop() {
    try {
      var tb = document.querySelector(".part.titlebar") || document.querySelector(".titlebar");
      if (tb && tb.offsetHeight > 0) {
        var r = tb.getBoundingClientRect();
        if (r.top <= 2 && r.height > 0) return Math.min(48, Math.round(r.height));
      }
    } catch (e) {}
    return 0;
  }

