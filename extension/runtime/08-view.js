  // ==== runtime/08-view.js — меню настроек, подсказки-термины, история, маршрут ====
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
    // 3+ кнопок (или длинные подписи) не влезают в строку — кладём контрол под подпись на всю ширину.
    var row = el("div", null); row.className = "cd-vm-row" + (buttons.length >= 3 || label.length > 9 ? " stack" : "");
    var lbl = el("span", null, label); lbl.className = "cd-vm-lbl"; row.appendChild(lbl);
    var seg = el("div", null); seg.className = "cd-seg";
    buttons.forEach(function (b) { seg.appendChild(b); });
    row.appendChild(seg);
    return row;
  }
  function vmSection(title) {
    var s = el("div", null, title); s.className = "cd-vm-sec"; viewMenu.appendChild(s);
  }
  function buildViewMenu() {
    viewMenu.textContent = "";
    var mtitle = el("div", null, "Настройки"); mtitle.className = "cd-vm-title"; viewMenu.appendChild(mtitle);
    // шрифт
    var minus = el("button", null, "A−"); minus.type = "button"; minus.title = "Меньше";
    var val = el("button", null, ""); val.type = "button"; val.disabled = true; val.style.cursor = "default";
    var plus = el("button", null, "A+"); plus.type = "button"; plus.title = "Больше";
    function showFs() { val.textContent = Math.round((state.fs || 1) * 100) + "%"; }
    function stepFs(d) { state.fs = clamp(Math.round(((state.fs || 1) + d) * 10) / 10, 0.8, 1.6); saveState(); applyReaderPrefs(); showFs(); }
    minus.addEventListener("click", function () { stepFs(-0.1); });
    plus.addEventListener("click", function () { stepFs(0.1); });
    showFs();
    var rowFont = segRow("Шрифт", [minus, val, plus]);
    // ширина
    var wN = el("button", null, "Уже"); var wW = el("button", null, "Шире");
    wN.type = "button"; wW.type = "button";
    function showW() { wN.classList.toggle("on", !state.wide); wW.classList.toggle("on", !!state.wide); }
    wN.addEventListener("click", function () { state.wide = false; saveState(); applyReaderPrefs(); showW(); });
    wW.addEventListener("click", function () { state.wide = true; saveState(); applyReaderPrefs(); showW(); });
    showW();
    var rowWidth = segRow("Ширина", [wN, wW]);
    // межстрочный интервал
    var lhT = el("button", null, "Плотнее"); var lhN = el("button", null, "Обычный"); var lhR = el("button", null, "Просторнее");
    lhT.type = "button"; lhN.type = "button"; lhR.type = "button";
    function showLh() { lhT.classList.toggle("on", state.lh === "tight"); lhN.classList.toggle("on", state.lh !== "tight" && state.lh !== "roomy"); lhR.classList.toggle("on", state.lh === "roomy"); }
    lhT.addEventListener("click", function () { state.lh = "tight"; saveState(); applyReaderPrefs(); showLh(); });
    lhN.addEventListener("click", function () { state.lh = "normal"; saveState(); applyReaderPrefs(); showLh(); });
    lhR.addEventListener("click", function () { state.lh = "roomy"; saveState(); applyReaderPrefs(); showLh(); });
    showLh();
    var rowInterval = segRow("Интервал", [lhT, lhN, lhR]);
    // размер шрифта кода — отдельно от прозы (на ноутбуке 12.5 px мелковато)
    var cMinus = el("button", null, "A−"); cMinus.type = "button"; cMinus.title = "Код мельче";
    var cVal = el("button", null, ""); cVal.type = "button"; cVal.disabled = true; cVal.style.cursor = "default";
    var cPlus = el("button", null, "A+"); cPlus.type = "button"; cPlus.title = "Код крупнее";
    function showCfs() { cVal.textContent = (state.codeFs || 12.5) + " px"; }
    function stepCfs(d) { state.codeFs = clamp((state.codeFs || 12.5) + d, 11, 17); if (state.codeFs === 12.5) state.codeFs = 0; saveState(); applyReaderPrefs(); showCfs(); }
    cMinus.addEventListener("click", function () { stepCfs(-0.5); });
    cPlus.addEventListener("click", function () { stepCfs(0.5); });
    showCfs();
    var rowCodeFs = segRow("Код", [cMinus, cVal, cPlus]);
    // режим фокуса: скрыть навигацию и оглавление, оставить только текст
    var fcOn = el("button", null, "Вкл"); var fcOff = el("button", null, "Выкл");
    fcOn.type = "button"; fcOff.type = "button";
    fcOn.title = "Спрятать список слева и оглавление справа — только текст"; fcOff.title = "Показывать навигацию и оглавление";
    function showFocus() { fcOn.classList.toggle("on", !!state.focus); fcOff.classList.toggle("on", !state.focus); }
    fcOn.addEventListener("click", function () { state.focus = true; saveState(); applyReaderPrefs(); showFocus(); });
    fcOff.addEventListener("click", function () { state.focus = false; saveState(); applyReaderPrefs(); showFocus(); });
    showFocus();
    var rowFocus = segRow("Фокус", [fcOn, fcOff]);
    // прозрачность, пока курсор не на окне — чтобы не мешало писать код (наведёшь — снова чёткое)
    var gOff = el("button", null, "Выкл"); var gSoft = el("button", null, "Слегка"); var gStrong = el("button", null, "Сильно");
    gOff.type = "button"; gSoft.type = "button"; gStrong.type = "button";
    gSoft.title = "Окно слегка прозрачное, пока на нём нет курсора"; gStrong.title = "Окно сильно прозрачное, пока на нём нет курсора";
    function showGhost() { gOff.classList.toggle("on", state.ghost !== "soft" && state.ghost !== "strong"); gSoft.classList.toggle("on", state.ghost === "soft"); gStrong.classList.toggle("on", state.ghost === "strong"); }
    gOff.addEventListener("click", function () { state.ghost = "off"; saveState(); applyReaderPrefs(); showGhost(); });
    gSoft.addEventListener("click", function () { state.ghost = "soft"; saveState(); applyReaderPrefs(); showGhost(); });
    gStrong.addEventListener("click", function () { state.ghost = "strong"; saveState(); applyReaderPrefs(); showGhost(); });
    showGhost();
    var rowGhost = segRow("Прозрачность", [gOff, gSoft, gStrong]);
    // плотность списка
    var dN = el("button", null, "Просторно"); var dD = el("button", null, "Плотно");
    dN.type = "button"; dD.type = "button";
    function showD() { dN.classList.toggle("on", !state.dense); dD.classList.toggle("on", !!state.dense); }
    dN.addEventListener("click", function () { state.dense = false; saveState(); applyReaderPrefs(); showD(); });
    dD.addEventListener("click", function () { state.dense = true; saveState(); applyReaderPrefs(); showD(); });
    showD();
    var rowList = segRow("Список", [dN, dD]);
    // разборы: свернуть/развернуть разом все «Разбор»/«Копнуть глубже» (режим «только основное»)
    var eN = el("button", null, "Свёрнуты"); var eE = el("button", null, "Развёрнуты");
    eN.type = "button"; eE.type = "button";
    eN.title = "Только основное: разборы под кодом свёрнуты";
    eE.title = "Показывать все разборы раскрытыми";
    function showE() { eN.classList.toggle("on", !state.expandNotes); eE.classList.toggle("on", !!state.expandNotes); }
    eN.addEventListener("click", function () { state.expandNotes = false; saveState(); applyExpandNotes(); showE(); });
    eE.addEventListener("click", function () { state.expandNotes = true; saveState(); applyExpandNotes(); showE(); });
    showE();
    var rowNotes = segRow("Разборы", [eN, eE]);
    // подсказки-термины при наведении
    var hN = el("button", null, "Выкл"); var hY = el("button", null, "Вкл");
    hN.type = "button"; hY.type = "button";
    hN.title = "Не подчёркивать термины"; hY.title = "Подчёркивать термины, определение при наведении";
    function showH() { hY.classList.toggle("on", !!state.termHints); hN.classList.toggle("on", !state.termHints); }
    hY.addEventListener("click", function () { state.termHints = true; saveState(); showH(); if (current) openFile(current.rel, null, true); });
    hN.addEventListener("click", function () { state.termHints = false; saveState(); showH(); if (current) openFile(current.rel, null, true); });
    showH();
    var rowHints = segRow("Подсказки", [hN, hY]);
    // анимации окна
    var aOn = el("button", null, "Вкл"); var aOff = el("button", null, "Выкл");
    aOn.type = "button"; aOff.type = "button";
    function showA() { aOn.classList.toggle("on", !state.noAnim); aOff.classList.toggle("on", !!state.noAnim); }
    aOn.addEventListener("click", function () { state.noAnim = false; saveState(); applyReaderPrefs(); showA(); });
    aOff.addEventListener("click", function () { state.noAnim = true; saveState(); applyReaderPrefs(); showA(); });
    showA();
    var rowAnim = segRow("Анимации", [aOn, aOff]);
    // тема окна: авто (под VS Code) / светлая / тёмная / сепия
    var tA = el("button", null, "Авто"); var tL = el("button", null, "Светлая"); var tD = el("button", null, "Тёмная"); var tSep = el("button", null, "Сепия");
    tA.type = "button"; tL.type = "button"; tD.type = "button"; tSep.type = "button";
    tSep.title = "Тёплый «бумажный» фон — мягче для глаз";
    function showT() {
      tA.classList.toggle("on", state.theme === "auto");
      tL.classList.toggle("on", state.theme === "light");
      tD.classList.toggle("on", state.theme === "dark");
      tSep.classList.toggle("on", state.theme === "sepia");
    }
    function setTheme(v) { state.theme = v; saveState(); applyThemeClasses(); applyAccent(); showT(); }
    tA.addEventListener("click", function () { setTheme("auto"); });
    tL.addEventListener("click", function () { setTheme("light"); });
    tD.addEventListener("click", function () { setTheme("dark"); });
    tSep.addEventListener("click", function () { setTheme("sepia"); });
    showT();
    var rowTheme = segRow("Тема", [tA, tL, tD, tSep]);
    // палитра: «как в редакторе» или готовый набор (фон + акцент + цвета кода)
    var rowPal = el("div", null); rowPal.className = "cd-vm-row stack";
    var palLbl = el("span", null, "Палитра"); palLbl.className = "cd-vm-lbl"; rowPal.appendChild(palLbl);
    var palGrid = el("div", null); palGrid.className = "cd-pal-grid"; rowPal.appendChild(palGrid);
    var palBtns = [];
    ["auto"].concat(Object.keys(PALETTES)).forEach(function (k) {
      var P = PALETTES[k];
      var b = el("button", null); b.type = "button"; b.className = "cd-pal";
      var sw = el("span", null); sw.className = "cd-pal-sw";
      sw.style.background = P ? "linear-gradient(135deg," + P.bg + " 48%," + P.ac + " 52%," + P.glow + ")"
        : "linear-gradient(135deg,#1e1e2e 48%,var(--cppdocs-ac,#89b4fa) 52%)";
      b.appendChild(sw); b.appendChild(el("span", null, P ? P.name : "Как в редакторе"));
      b.title = P ? "Фон, акцент и подсветка кода «" + P.name + "»" : "Акцент из темы VS Code / обоев custom-bg";
      b.setAttribute("data-pal", k);
      b.addEventListener("click", function () {
        state.palette = k; saveState(); applyThemeClasses(); applyAccent();
        // значки ui-* могут иметь свой вариант под палитру — перерисуем то, что на экране
        if (winEl.classList.contains("home")) buildHome(); else if (current) openFile(current.rel, null, true);
        buildSky();
        showHb();                                   // у новой палитры своя картинка фона (или её нет)
        syncReviewBell();
        palBtns.forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-pal") === k); });
      });
      b.classList.toggle("on", (state.palette || "auto") === k);
      palBtns.push(b); palGrid.appendChild(b);
    });
    var palNote = el("div", null, "В светлой теме и сепии палитра меняет только акцент."); palNote.className = "cd-pal-note";
    rowPal.appendChild(palNote);
    // фон главной: пейзаж под палитру / звёздное небо прогресса / без рисунка
    var hbI = el("button", null, "Пейзаж"), hbS = el("button", null, "Звёзды"), hbN = el("button", null, "Пусто");
    hbI.type = hbS.type = hbN.type = "button";
    hbI.title = "Статичная картинка под палитру (если её нет — звёзды)";
    hbS.title = "Звёздное небо прогресса: изученные темы горят";
    // Картинок bg-*.webp может не быть (их кладут отдельно) — тогда «Пейзаж» прячем: он выглядел бы как «Звёзды».
    function showHb() {
      var hasImg = !!homeBgImage(), m = state.homeBg === "image" && !hasImg ? "stars" : state.homeBg;
      hbI.hidden = !hasImg;
      hbI.classList.toggle("on", m === "image"); hbS.classList.toggle("on", m === "stars"); hbN.classList.toggle("on", m === "none");
    }
    function setHb(v) { state.homeBg = v; saveState(); showHb(); buildSky(); }
    hbI.addEventListener("click", function () { setHb("image"); });
    hbS.addEventListener("click", function () { setHb("stars"); });
    hbN.addEventListener("click", function () { setHb("none"); });
    showHb();
    var rowHomeBg = segRow("Фон главной", [hbI, hbS, hbN]);
    // праздник: искры при «изучено/решено»
    var cOn = el("button", null, "Вкл"); var cOff = el("button", null, "Выкл");
    cOn.type = "button"; cOff.type = "button";
    function showC() { cOn.classList.toggle("on", !state.noCelebrate); cOff.classList.toggle("on", !!state.noCelebrate); }
    cOn.addEventListener("click", function () { state.noCelebrate = false; saveState(); showC(); });
    cOff.addEventListener("click", function () { state.noCelebrate = true; saveState(); showC(); });
    showC();
    var rowCelebrate = segRow("Праздник", [cOn, cOff]);
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
    var rowRead = segRow("Шрифт", fontBtns);
    var fNote = el("div", null, "Inter, PT Root и Golos берутся, если установлены в системе; иначе — системный."); fNote.className = "cd-pal-note";
    rowRead.appendChild(fNote);
    // обложки тем
    var cvOn = el("button", null, "Вкл"), cvOff = el("button", null, "Выкл");
    cvOn.type = cvOff.type = "button";
    function showCv() { cvOn.classList.toggle("on", !!state.covers); cvOff.classList.toggle("on", !state.covers); }
    function setCv(v) { state.covers = v; saveState(); showCv(); if (current && articleEl && !(winEl && winEl.classList.contains("home"))) openFile(current.rel, null, true); }
    cvOn.addEventListener("click", function () { setCv(true); });
    cvOff.addEventListener("click", function () { setCv(false); });
    showCv();
    var rowCovers = segRow("Обложки тем", [cvOn, cvOff]);
    // длинные темы — целиком или по одному разделу
    var bsAll = el("button", null, "Целиком"); var bsSec = el("button", null, "По разделам");
    bsAll.type = "button"; bsSec.type = "button";
    bsSec.title = "Показывать один раздел за раз, с кнопкой «Следующий раздел» (для тем от 4 разделов)";
    function showBs() { bsAll.classList.toggle("on", !state.bySection); bsSec.classList.toggle("on", !!state.bySection); }
    function setBs(v) { state.bySection = v; saveState(); showBs(); if (current && articleEl && !(winEl && winEl.classList.contains("home"))) openFile(current.rel, null, true); }
    bsAll.addEventListener("click", function () { setBs(false); });
    bsSec.addEventListener("click", function () { setBs(true); });
    showBs();
    var rowBySec = segRow("Длинные темы", [bsAll, bsSec]);
    // Раскладка по секциям — чтобы 11 настроек читались, а не сливались в один список.
    vmSection("Текст");        viewMenu.appendChild(rowFont); viewMenu.appendChild(rowCodeFs); viewMenu.appendChild(rowInterval); viewMenu.appendChild(rowWidth); viewMenu.appendChild(rowRead); viewMenu.appendChild(rowBySec);
    vmSection("Оформление");   viewMenu.appendChild(rowTheme); viewMenu.appendChild(rowPal); viewMenu.appendChild(rowHomeBg); viewMenu.appendChild(rowCovers); viewMenu.appendChild(rowFocus); viewMenu.appendChild(rowGhost); viewMenu.appendChild(rowList);
    vmSection("Поведение");    viewMenu.appendChild(rowNotes); viewMenu.appendChild(rowHints); viewMenu.appendChild(rowAnim); viewMenu.appendChild(rowCelebrate);
    // Прогресс: копия в файл и загрузка из файла (диалоги показывает расширение)
    var pExp = el("button", null, "Сохранить копию…"), pImp = el("button", null, "Загрузить…");
    pExp.type = pImp.type = "button";
    pExp.title = "Сохранить весь прогресс (темы, карточки, задания, заметки) в файл — на случай переустановки";
    pImp.title = "Заменить прогресс сохранённой копией. Текущий прогресс сначала уйдёт в резервную копию.";
    function progressAction(kind, msg) {
      saveState(); flushMirror();                  // в файле — самое свежее
      sendAction({ kind: kind }, function (r) { toast(r && r.ok ? msg : "Не получилось: " + ((r && r.error) || "расширение не ответило"), !(r && r.ok)); });
    }
    pExp.addEventListener("click", function () { progressAction("export-progress", "Выберите, куда сохранить копию"); });
    pImp.addEventListener("click", function () { progressAction("import-progress", "Выберите файл с копией прогресса"); });
    var pNote = el("div", null, "Копия делается и сама — раз в день, последние 14 дней."); pNote.className = "cd-pal-note";
    var rowProgress = segRow("Резервная копия прогресса", [pExp, pImp]);
    rowProgress.appendChild(pNote);
    vmSection("Прогресс");     viewMenu.appendChild(rowProgress);
  }
  // Классы темы окна: сепия — отдельный тёплый набор; светлая — когда не сепия и тема светлая.
  // ---- Знакомство в 3 шага (первое открытие окна) ----
  // Подсвечиваем НАСТОЯЩИЕ кнопки окна (а не картинки с ними): затемнение вокруг, рамка и
  // подсказка рядом. «Дальше» / «Пропустить» / Esc. Повторить — из руководства (кнопка «?»).
  var TOUR = [
    { sel: ".cd-home-cont", title: "1. Главное действие", text: "Эта карточка всегда ведёт к следующему шагу: продолжить тему, где остановился, или начать новую. Не знаешь, что делать, — жми её." },
    { sel: ".cd-hg-nav .cd-hbtn", title: "2. Все материалы", text: "Список тем, задач и примеров. В нём же поиск по тексту — ищет и по содержимому, с переходом прямо к месту." },
    { sel: ".cd-rbtn", title: "3. Под себя", text: "Шрифт, тема, палитра, обложки тем, анимации. Там же — резервная копия прогресса. А кнопкой ⇥ в шапке окно встаёт справа и сдвигает редактор." },
  ];
  var tourEl = null, tourI = 0;
  function startTour() {
    if (!winEl || !isOpen()) return;
    tourI = 0;
    if (!tourEl) {
      tourEl = el("div"); tourEl.className = "cd-tour";
      setHTML(tourEl, '<div class="cd-tour-hole"></div><div class="cd-tour-tip" role="dialog" aria-live="polite">' +
        '<div class="cd-tour-t"></div><div class="cd-tour-x"></div>' +
        '<div class="cd-tour-nav"><span class="cd-tour-n"></span><button type="button" class="cd-tour-skip">Пропустить</button>' +
        '<button type="button" class="cd-tour-next">Дальше</button></div></div>');
      tourEl.addEventListener("click", function (e) {
        e.stopPropagation();
        if (e.target.closest(".cd-tour-skip")) endTour();
        else if (e.target.closest(".cd-tour-next")) { tourI++; showTourStep(); }
      });
      tourEl.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); endTour(); } });
    }
    winEl.appendChild(tourEl);
    tourEl.hidden = false;
    showTourStep();
  }
  function showTourStep() {
    // шаг, чья кнопка не видна (узкое окно, другая раскладка), пропускаем
    while (tourI < TOUR.length) {
      var t = winEl.querySelector(TOUR[tourI].sel);
      if (t && t.offsetParent) break;
      tourI++;
    }
    if (tourI >= TOUR.length) { endTour(); return; }
    var st = TOUR[tourI], target = winEl.querySelector(st.sel);
    var wr = winEl.getBoundingClientRect(), r = target.getBoundingClientRect(), pad = 6;
    var hole = tourEl.querySelector(".cd-tour-hole"), tip = tourEl.querySelector(".cd-tour-tip");
    hole.style.left = (r.left - wr.left - pad) + "px"; hole.style.top = (r.top - wr.top - pad) + "px";
    hole.style.width = (r.width + pad * 2) + "px"; hole.style.height = (r.height + pad * 2) + "px";
    tourEl.querySelector(".cd-tour-t").textContent = st.title;
    tourEl.querySelector(".cd-tour-x").textContent = st.text;
    tourEl.querySelector(".cd-tour-n").textContent = (tourI + 1) + " из " + TOUR.length;
    tourEl.querySelector(".cd-tour-next").textContent = tourI === TOUR.length - 1 ? "Понятно" : "Дальше";
    // подсказка — под целью, а если не помещается — над ней; по горизонтали — в пределах окна
    var tw = 300, below = r.bottom - wr.top + 12, above = r.top - wr.top - 12;
    tip.style.width = tw + "px";
    tip.style.left = clamp(r.left - wr.left, 10, wr.width - tw - 10) + "px";
    if (below + 150 < wr.height) { tip.style.top = below + "px"; tip.style.bottom = "auto"; }
    else { tip.style.top = "auto"; tip.style.bottom = (wr.height - above) + "px"; }
    try { tourEl.querySelector(".cd-tour-next").focus(); } catch (e) {}
  }
  function endTour() {
    if (tourEl) { tourEl.hidden = true; if (tourEl.parentNode) tourEl.parentNode.removeChild(tourEl); }
    state.tourDone = true; saveState();
  }
  function applyThemeClasses() {
    if (!winEl) return;
    var sepia = state.theme === "sepia";
    winEl.classList.toggle("sepia", sepia);
    Object.keys(PALETTES).forEach(function (k) { winEl.classList.toggle("pal-" + k, state.palette === k); });
    winEl.classList.toggle("light", !sepia && isLight());
  }
  function applyReaderPrefs() {
    if (!winEl) return;
    winEl.classList.toggle("wide", !!state.wide);
    winEl.classList.toggle("dense", !!state.dense);
    winEl.classList.toggle("no-anim", !!state.noAnim);
    winEl.classList.toggle("no-outline", !isOutlineOn());
    winEl.classList.toggle("focus", !!state.focus);                 // режим фокуса: скрыть навигацию/оглавление
    winEl.classList.toggle("codewrap-on", !!state.codeWrap);        // перенос длинных строк кода
    if (state.codeFs) winEl.style.setProperty("--cd-codefs", state.codeFs + "px"); else winEl.style.removeProperty("--cd-codefs");
    winEl.classList.toggle("ghost-soft", state.ghost === "soft");   // прозрачность, пока курсор не на окне
    winEl.classList.toggle("ghost-strong", state.ghost === "strong");
    if (tocBtn) tocBtn.classList.toggle("act", isOutlineOn());
    if (articleEl) {
      articleEl.style.zoom = String(state.fs || 1);
      articleEl.classList.toggle("cd-lh-tight", state.lh === "tight");   // межстрочный интервал
      articleEl.classList.toggle("cd-lh-roomy", state.lh === "roomy");
    }
    applyThemeClasses();
    var rf = RFONTS[state.rfont] || RFONTS.system;
    winEl.style.setProperty("--cd-rfont", rf.stack || "inherit");
    applyResponsive();
  }
  // Узкое окно: боковое оглавление прячем автоматически, чтобы не сжимать текст.
  // Считаем место под текст: ширина окна минус список материалов (если виден) минус рейка 198 px.
  // Меньше ~640 px — рейку прячем (код перестаёт влезать); «☰ Разделы» тогда открывает её поверх текста.
  function applyResponsive() {
    if (!winEl) return;
    var navW = 0;
    var nav = winEl.querySelector(".cd-nav");
    if (nav && getComputedStyle(nav).display !== "none") navW = nav.offsetWidth;
    var narrow = winEl.offsetWidth < 860 || winEl.offsetWidth - navW - 198 < 640;
    winEl.classList.toggle("narrow", narrow);
    winEl.classList.toggle("tightbar", winEl.offsetWidth < 1050);   // маскоту у кнопок нужна ширина — иначе прячем
    winEl.classList.toggle("short", winEl.offsetHeight < 720);
    if (!narrow) winEl.classList.remove("ol-peek");
    fitHead();
    if (homeEl && !homeEl.hidden && homeWideLast !== null && homeWide() !== homeWideLast) { var st0 = homeEl.scrollTop; buildHome(); homeEl.scrollTop = st0; }
  }

  // ------- режим «только основное»: разом свернуть/развернуть все «Разбор»/«Копнуть глубже» -------
  function applyExpandNotes() {
    if (!articleEl) return;
    var open = !!state.expandNotes;
    var list = articleEl.querySelectorAll("details.cd-spoiler");
    for (var i = 0; i < list.length; i++) {
      if (open) list[i].setAttribute("open", ""); else list[i].removeAttribute("open");
    }
  }

  // ------- подсказки-термины: при наведении на слово из словаря всплывает его определение -------
  // Коротко, без ухода со страницы. Определения — простым языком, как в словаре терминов.
  var GLOSSARY = {
    "итератор": "закладка на элемент контейнера: *it — значение под ней, ++it — сдвиг на следующий",
    "итераторы": "закладки на элементы контейнера: *it — значение, ++it — следующий",
    "ссылка": "второе имя той же переменной (T&), а не копия: меняешь ссылку — меняется оригинал",
    "ссылки": "вторые имена тех же переменных (T&), а не копии",
    "указатель": "переменная, хранящая адрес другого объекта; *p — значение по этому адресу",
    "лямбда": "безымянная функция прямо на месте: [захват](параметры){ тело }",
    "raii": "ресурс сам освобождается при выходе из области видимости (файл закроется, память вернётся)",
    "рекурсия": "функция вызывает саму себя; обязательно нужна база — условие, на котором вызовы прекращаются",
    "перегрузка": "несколько функций с одним именем, но разными параметрами",
    "конструктор": "код, который создаёт и заполняет объект нужного типа",
    "деструктор": "код, вызываемый при уничтожении объекта, — освобождает его ресурсы",
    "метод": "функция, живущая внутри структуры или класса; видит её поля без префикса",
    "переполнение": "число вышло за предел типа и «обернулось» (у int за максимумом сразу минимум)",
    "контейнер": "хранилище элементов: vector, map, set, string и подобные",
    "константа": "значение, которое нельзя менять после задания (const/constexpr)",
    "поток": "поток байтов между программой и миром (cin/cout/файл); << пишет в него, >> читает"
  };
  function isTermWordCh(ch) { return !!ch && /[0-9A-Za-zА-Яа-яЁё_]/.test(ch); }
  function annotateTerms(root) {
    if (!state.termHints) return;                 // выключено в настройках
    if (!root || typeof document.createTreeWalker !== "function") return;
    var used = {};
    var terms = Object.keys(GLOSSARY).sort(function (a, b) { return b.length - a.length; });
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (var k = 0; k < nodes.length; k++) {
      var node = nodes[k], p = node.parentNode;
      if (!p || !p.closest) continue;
      // Не трогаем код, ссылки, заголовки, кнопки, уже размеченные термины.
      if (p.closest("code,pre,a,abbr,button,summary,h1,h2,h3,h4,h5,h6")) continue;
      var text = node.nodeValue, lower = text.toLowerCase();
      for (var ti = 0; ti < terms.length; ti++) {
        var term = terms[ti];
        if (used[term]) continue;
        var idx = lower.indexOf(term);
        while (idx !== -1) {                       // ищем отдельное слово, а не часть другого
          var before = idx > 0 ? text.charAt(idx - 1) : "";
          var after = idx + term.length < text.length ? text.charAt(idx + term.length) : "";
          if (!isTermWordCh(before) && !isTermWordCh(after)) break;
          idx = lower.indexOf(term, idx + 1);
        }
        if (idx === -1) continue;
        var abbr = document.createElement("abbr");
        abbr.className = "cd-term";
        abbr.setAttribute("title", GLOSSARY[term]);
        abbr.textContent = text.substr(idx, term.length);
        var rest = node.splitText(idx);            // node → «до», rest → «совпадение + хвост»
        rest.nodeValue = rest.nodeValue.substr(term.length);   // rest → только «хвост»
        p.insertBefore(abbr, rest);
        used[term] = true;
        break;                                     // один термин на текстовый узел — без пестроты
      }
    }
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
  // Первый экран статьи в окне — сразу к делу. На GitHub .md читаются как есть, а в окне:
  //  • строка ссылок «← Начни отсюда · ← Строки · …» (вверху и внизу) дублирует кнопки
  //    «Предыдущая / Следующая» и «назад» — прячем её и соседнюю черту;
  //  • «Что в этом файле» дублирует панель «На странице» — прячем раздел целиком;
  //  • врезку «Определения функций этой темы … в Словаре функций» сжимаем в чип под заголовком;
  //  • во вводной цитате оставляем только первую строку (служебное «Это разделы …» прячем).
  // Возвращает заголовки без спрятанных (для «На странице»).
  function isNavLine(p) {
    if (!p || p.tagName !== "P") return false;
    var links = p.querySelectorAll("a");
    if (links.length < 2) return false;
    var txt = p.textContent.replace(/\s+/g, " ").trim();
    if (!/^←/.test(txt)) return false;
    var rest = txt;
    for (var i = 0; i < links.length; i++) rest = rest.replace(links[i].textContent.replace(/\s+/g, " ").trim(), "");
    return /^[\s·|]*$/.test(rest);
  }
  function tidyArticle(headings) {
    if (!articleEl) return headings;
    var hide = function (n) { if (n) n.classList.add("cd-winhide"); };
    var kids = Array.prototype.slice.call(articleEl.children);
    kids.forEach(function (n, i) {
      if (!isNavLine(n)) return;
      hide(n);
      if (kids[i + 1] && kids[i + 1].tagName === "HR") hide(kids[i + 1]);
      if (kids[i - 1] && kids[i - 1].tagName === "HR") hide(kids[i - 1]);
    });
    var gone = {};
    kids.forEach(function (n, i) {
      if (n.tagName !== "H2" || !/^Что в этом файле/i.test(n.textContent.trim())) return;
      gone[n.id] = 1; hide(n);
      for (var j = i + 1; j < kids.length && !/^(H[12]|HR)$/.test(kids[j].tagName); j++) hide(kids[j]);
      if (kids[j] && kids[j].tagName === "HR") hide(kids[j]);
    });
    var h1 = articleEl.querySelector("h1");   // обычно H1 уходит в шапку окна и в статье его нет
    kids.forEach(function (n, i) {
      if (n.tagName !== "BLOCKQUOTE") return;
      if ((i === 0 && !h1) || (i === 1 && kids[0] === h1)) {
        var ps = n.querySelectorAll(":scope > p");
        if (ps.length > 1) { n.classList.add("cd-lead"); for (var k = 1; k < ps.length; k++) hide(ps[k]); }
        return;
      }
      var a = n.querySelector('a[href*="10a-slovar-funkcij"]');
      if (!a || !/^Определения функций/.test(n.textContent.trim()) || n.textContent.length > 260) return;
      var chip = el("a", null, "Словарь функций этой темы →");
      chip.className = "cd-dictchip"; chip.setAttribute("href", a.getAttribute("href"));
      var codes = Array.prototype.slice.call(n.querySelectorAll("code")).map(function (c) { return c.textContent; });
      if (codes.length) chip.title = "Коротко про " + codes.join(", ");
      hide(n);
      var anchor = articleEl.querySelector(".cd-lead") || h1;
      if (anchor) articleEl.insertBefore(chip, anchor.nextSibling); else articleEl.insertBefore(chip, articleEl.firstChild);
    });
    wrapTldr();
    return headings.filter(function (h) { return !gone[h.slug]; });
  }
  // «За 30 секунд» — выжимка темы: заголовок и всё до следующего заголовка/черты — в карточку.
  function wrapTldr() {
    var hs = articleEl.querySelectorAll(":scope > h3");
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (!/^За 30 секунд/i.test(h.textContent.trim())) continue;
      var box = document.createElement("section"); box.className = "cd-tldr";
      articleEl.insertBefore(box, h);
      var node = h;
      while (node && !(node !== h && /^(H1|H2|H3|HR)$/.test(node.tagName))) {
        var nx = node.nextElementSibling;
        box.appendChild(node);
        if (node.classList && node.classList.contains("codewrap")) break;   // выжимка = список + пример; текст после — уже тема
        node = nx;
      }
    }
  }
  function buildRouteNav(f) {
    var d = DATA(); if (!d || !articleEl) return;
    var idx = fileIndex(f.rel);
    var prev = idx > 0 ? d.files[idx - 1] : null;
    var next = idx >= 0 && idx < d.files.length - 1 ? d.files[idx + 1] : null;
    if (!prev && !next) return;
    // «Понял → дальше»: дочитал до конца — одной кнопкой отметить тему и открыть следующую.
    if (next && !state.read[f.rel]) {
      var go = el("button", null); go.type = "button"; go.className = "cd-rn-done";
      go.appendChild(el("span", null, "✓ Разобрался — следующая тема"));
      var sub = el("span", null, next.title || next.name); sub.className = "cd-rn-done-s";
      go.appendChild(sub);
      go.addEventListener("click", function () { toggleRead(f.rel); openFile(next.rel); });
      articleEl.appendChild(go);
    }
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

