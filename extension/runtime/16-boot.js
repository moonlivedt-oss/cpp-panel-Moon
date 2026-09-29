  // ==== runtime/16-boot.js — кнопка-запуск, самолечение, старт ====
  // ---------------------------------------------------------------------------
  //  Плавающая кнопка-запуск + самолечение (VS Code пересобирает DOM).
  // ---------------------------------------------------------------------------
  function setBtnVisible(v) {
    var b = document.getElementById(BTN_ID);
    if (b) b.style.display = v ? "inline-flex" : "none";
  }
  function ensureButton() {
    if (IN_PANEL) return;
    if (document.getElementById(BTN_ID)) return;
    if (!document.body) return;
    if (!extAlive()) return;   // расширение удалено — осиротевшую кнопку не создаём
    var d = DATA();
    var n = d ? d.files.length : 0;
    var b = el("div"); b.id = BTN_ID;
    b.setAttribute("role", "button");
    b.setAttribute("tabindex", "0");
    b.setAttribute("aria-label", "Открыть документацию C++");
    b.title = "Документация C++ — клик открывает окно, перетаскиванием можно отодвинуть";
    // Наклейка-смайл вместо эмодзи 📘 — фирменное лицо расширения даже при закрытом окне.
    setHTML(b, '<span class="cd-btn-face">' + stickerMarkup("welcome", 20) + "</span>C++" +
      (n ? ' <span class="cd-badge">' + n + "</span>" : ""));
    // Клик открывает окно; но если пилюлю только что перетащили — click, идущий следом
    // за mouseup, подавляем (иначе перетащил — и случайно открыл/закрыл окно).
    b.addEventListener("click", function () { if (b._dragged) { b._dragged = false; return; } toggleWindow(); });
    b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleWindow(); } });
    installBtnDrag(b);
    document.body.appendChild(b);
    restoreBtnPos(b);              // вернуть на место, куда пользователь её оттащил
    if (isOpen()) b.style.display = "none";
  }

  // Пилюлю можно оттащить мышью, если она перекрывает уведомления VS Code в углу.
  // Порог в несколько пикселей отделяет перетаскивание от обычного клика (клик открывает окно).
  // Позиция запоминается в state.btnX/btnY и переживает перезагрузку.
  function clampBtn(b, x, y) {
    var vw = viewW(), vh = window.innerHeight || 800;
    return { x: clamp(x, 4, vw - b.offsetWidth - 4), y: clamp(y, safeTop() + 4, vh - b.offsetHeight - 4) };
  }
  function placeBtn(b, x, y) {
    b.style.left = x + "px"; b.style.top = y + "px";
    b.style.right = "auto"; b.style.bottom = "auto";
  }
  function restoreBtnPos(b) {
    if (typeof state.btnX !== "number" || typeof state.btnY !== "number") return;
    var p = clampBtn(b, state.btnX, state.btnY);   // окно могло изменить размер — прижать к экрану
    placeBtn(b, p.x, p.y);
  }
  function installBtnDrag(b) {
    var d = null;
    b.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      var r = b.getBoundingClientRect();
      d = { sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top,
            moved: false, lastX: r.left, lastY: r.top };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    function onMove(e) {
      if (!d) return;
      if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 5) return;  // ещё клик
      d.moved = true;
      e.preventDefault();
      var p = clampBtn(b, e.clientX - d.dx, e.clientY - d.dy);
      d.lastX = p.x; d.lastY = p.y;
      placeBtn(b, p.x, p.y);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (d && d.moved) {
        b._dragged = true;   // подавить click, который придёт следом за этим mouseup
        state.btnX = Math.round(d.lastX); state.btnY = Math.round(d.lastY); saveState();
      }
      d = null;
    }
  }

  // Держим счётчик на кнопке в согласии с данными: после автообновления (окно даже закрыто)
  // число материалов могло измениться — ensureButton его не трогает, обновляем здесь.
  // Бейдж — это сигнал, а не счётчик файлов: «!» — окно объяснило ошибку в редакторе, пока было
  // закрыто; «N» — карточки, которые пора повторить (с учётом лимита новых). Нечего сказать — бейджа нет.
  // Карточки считаем не чаще раза в минуту: syncBadge зовётся из heal на тикере.
  var _cardSig = { t: 0, n: 0 }, pendingErr = false;
  function dueSignal() {
    var now = Date.now();
    if (now - _cardSig.t > 60000) {
      _cardSig.t = now;
      try { var cc = cardCounts(); _cardSig.n = cc.due + cc.neu; } catch (e) { _cardSig.n = 0; }
    }
    return _cardSig.n;
  }
  function syncBadge() {
    var b = document.getElementById(BTN_ID);
    if (!b) return;
    var d = DATA();
    var n = d && d.files.length ? dueSignal() : 0;
    var txt = pendingErr ? "!" : (n > 0 ? String(n) : "");
    var badge = b.querySelector(".cd-badge");
    if (txt) {
      if (!badge) { b.appendChild(document.createTextNode(" ")); badge = el("span"); badge.className = "cd-badge"; b.appendChild(badge); }
      if (badge.textContent !== txt) badge.textContent = txt;
      badge.classList.toggle("err", pendingErr);
      var tip = pendingErr ? "Есть подсказка про ошибку в коде — открой окно" : "Пора повторить карточки: " + n;
      if (badge.title !== tip) badge.title = tip;
    } else if (badge) { try { badge.remove(); } catch (e) {} }
  }

  // Дешёвое восстановление после того, как VS Code пересобрал DOM: вернуть кнопку, если её снесли.
  // Идёт на КАЖДУЮ мутацию workbench, поэтому здесь НЕТ ни диска (extAlive), ни getComputedStyle
  // (applyAccent) — только один getElementById; тяжёлое обслуживание делает heal() на тикере 3с.
  function healCheap() {
    if (_cdStopped) return;
    try {
      if (!document.getElementById(BTN_ID)) { ensureStyle(); ensureButton(); syncBadge(); }
    } catch (e) {}
  }
  // Дебаунс всплеска мутаций: пачка добавлений/удалений детей body схлопывается в одну проверку.
  var _healTimer = null;
  function onWorkbenchMutation() {
    if (_healTimer) return;
    _healTimer = setTimeout(function () { _healTimer = null; healCheap(); }, 150);
  }

  function heal() {
    if (_cdStopped) return;                  // модуль выключен в Moon Core — ничего не возвращаем
    // Расширение удалено — убираем кнопку и больше ничего не подрисовываем.
    try { if (!extAlive()) { var ob = document.getElementById(BTN_ID); if (ob) ob.remove(); return; } } catch (e) {}
    try { applyAccent(); } catch (e) {}   // акцент под тему/обои — до отрисовки стиля и кнопки
    try { ensureStyle(); } catch (e) {}
    try { ensureButton(); } catch (e) {}
    try { syncBadge(); } catch (e) {}
    // Тема окна могла смениться.
    try { applyThemeClasses(); } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  //  Старт.
  // ---------------------------------------------------------------------------
  function bootPanel() {
    _esLive = true;   // всё приходит сообщениями — опрос файлов не нужен
    try { applyAccent(); } catch (e) {}
    ensureStyle();
    document.documentElement.classList.add("cd-in-panel-doc");
    openWindow();
    if (winEl) winEl.classList.add("in-panel");
    window.addEventListener("message", function (ev) {
      var m = ev && ev.data;
      if (!m || typeof m !== "object") return;
      if (m.type === "editor" && typeof m.text === "string") { var p = parseEditorText(m.text); if (p) { editorPayload = p; applyEditorPayload(p); } }
      else if (m.type === "rpc-result" && typeof m.id === "string" && _rpcWait[m.id]) _rpcWait[m.id](m.result);
      else if (m.type === "data" && m.data) {
        var obj = sanitizeData(m.data);
        if (obj) { window.__CPPDOCS__ = obj; rebuildFromData(); }
      }
      else if (m.type === "theme") { try { applyAccent(); applyThemeClasses(); } catch (e) {} }
      else if (m.type === "progress" && typeof m.text === "string") { window.__CPPDOCS_MIRROR__ = m.text; onProgressEvent(m.text); }
    });
    try {
      document.addEventListener("mouseup", function () { setTimeout(onArticleSelect, 0); });
      document.addEventListener("scroll", hideHlPop, true);
    } catch (e) {}
    try { new MutationObserver(function () { applyThemeClasses(); }).observe(document.body, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    try { VSC.postMessage({ type: "ready" }); } catch (e) {}
  }
  function boot() {
    // nonce теперь приходит из инлайн-загрузчика __CPPDOCS_BOOT__ (данные грузятся внешним
    // файлом и nonce не несут). Fallback на старый путь — на случай инлайн-данных.
    try {
      var b0 = window.__CPPDOCS_BOOT__, d0 = DATA();
      CD_NONCE = (b0 && typeof b0.scriptNonce === "string" && b0.scriptNonce) ||
                 (d0 && typeof d0.scriptNonce === "string" && d0.scriptNonce) || MC_NONCE || "";
    } catch (e) {}
    if (IN_PANEL) { bootPanel(); return; }
    heal();
    // В оболочку впечатано только оглавление (data.lazy) — тексты материалов читаем асинхронно сразу
    // после старта: VS Code не разбирает мегабайты данных на критическом пути запуска.
    try { var d0l = DATA(); if (d0l && d0l.lazy) refreshData(); } catch (e) { reportError("lazy-data", e); }
    try { pollStamp(); } catch (e) {}
    try { pollEditor(); } catch (e) {}
    // маркер по тексту: показ кнопки «Выделить» после выделения, скрытие при прокрутке
    cdOnGlobal(document, "mouseup", function () { setTimeout(onArticleSelect, 0); });
    cdOnGlobal(document, "scroll", hideHlPop, true);
    // Один тикер на всё: возврат кнопки после перестройки DOM редактором (как у vscode-bg) плюс
    // опрос метки свежести для автообновления и слова под курсором. Оба дела спят, пока вкладка скрыта.
    // Тик раз в секунду: контекст редактора (крошечный файл) — каждый тик, чтобы «Найти в
    // справочнике» из меню открывалось сразу; лечение DOM и метка — каждый третий, как раньше.
    var tick = 0;
    var tickTimer = setInterval(function () {
      if (document.hidden || _cdStopped) return;
      ++tick;
      if (!_esLive && tick % 2 === 0) { try { pollEditor(); } catch (e) {} }   // поток событий не подключён — запасной опрос
      if (tick % 3) return;
      heal();
      // Поток не подключён: VS Code стартует окно раньше хоста расширений, и в файле моста сначала
      // лежит адрес прошлого сеанса. Перечитываем адрес (bridgeInfo кеширует его на 10 с) — как
      // только хост поднимет мост, окно подключится само.
      if (!_esLive) { try { pollStamp(); } catch (e) {} try { bridgeInfo(); } catch (e) {} }
      else if (tick % 30 === 0) { try { bridgeInfo(); } catch (e) {} }        // освежить список хостов
    }, 1000);
    cdTrack(function () { clearInterval(tickTimer); });
    try { bridgeInfo(); } catch (e) {}   // сразу подключиться к потоку событий
    try {
      var wbMo = new MutationObserver(onWorkbenchMutation);
      wbMo.observe(document.body || document.documentElement, { childList: true });
      cdTrack(function () { wbMo.disconnect(); if (_healTimer) { clearTimeout(_healTimer); _healTimer = null; } });
    } catch (e) {}
    // Новое API Moon Core: выключение модуля без перезагрузки окна, акцент фона через общую шину.
    try { cdMoonCoreApi(); } catch (e) { reportError("moon-core-api", e); }
    console.log("[cpp-docs] плавающее окно " + VERSION + " готово, материалов: " + (DATA() ? DATA().files.length : 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Узкий мост для превью/отладки (в реальном воркбенче не мешает).
  window.__cppDocs = {
    open: openWindow, close: closeWindow, toggle: toggleWindow, render: renderMarkdown,
    // для тестов: чистая логика главного экрана (карточки/следующий шаг)
    collectAllCards: collectAllCards, cardCounts: cardCounts, nextUnread: nextUnread,
    // для тестов/диагностики: мост доки↔редактор
    bridgeFind: bridgeFind, cppGlossary: CPPMAP, showBridge: showBridge, hideBridge: hideBridge,
    // для тестов: поиск со сниппетом и «Смотри также»
    searchHit: searchHit, relatedFiles: relatedFiles, appUrl: appUrl,
    // для тестов: ошибка простым языком и «Разминка дня»
    explainCompileError: explainCompileError, errorDocTarget: errorDocTarget, slugify: slugify,
    explainHtml: explainHtml, showBridgeError: showBridgeError, applyEditorEnv: applyEditorEnv, headNextTarget: headNextTarget, palettes: PALETTES, parseCards: parseCards, parsePalStickers: parsePalStickers,
    buildWarmupQueue: buildWarmupQueue, bossTasks: bossTasks, _state: function () { return state; },
    // для тестов: заготовка задачи, интервалы на кнопках, лимит новых карточек, режим по разделам
    taskStubCode: taskStubCode, ivlLabel: ivlLabel, cdPreview: cdPreview, newLeftToday: newLeftToday,
    tidyArticle: tidyArticle, showSection: showSection, parseTopics: parseTopics, examPassedTopics: examPassedTopics,
    _rpc: function (m, b, t, cb) { rpc(m, b, t, cb); }, _scrubHTML: scrubHTML, _stateSchema: { migrate: migrateState, normalize: normalizeState, prune: pruneState, version: STATE_VERSION }, stepsNorm: stepsNorm, collectChallenges: collectChallenges, dailyChallenge: dailyChallenge, dailyStreak: dailyStreak, parseMemory: parseMemory, parseFrames: parseFrames, focusInside: focusInside, _adoptProgress: adoptProgress, _saveState: function () { saveState(); }, _sticker: function (n) { return STICKERS[n]; }, _read: function (u) { return fileRead(u); }, _write: function (u, t) { return bridgeWrite(u, t); },
    // для тестов: игровые блоки (волна BFS, квесты «Подземелья»)
    bfsDist: bfsDist, bfsParse: bfsParse, collectQuests: collectQuests,
    // для тестов: освоение тем, карта, экзамен недели, достижения, рекорды, сравнение кода, Anki
    progressTopics: progressTopics, topicMastery: topicMastery, topicUnlocked: topicUnlocked, weakSpots: weakSpots,
    knowledgeMapHtml: knowledgeMapHtml, weekKey: weekKey, buildWeeklyExam: buildWeeklyExam, quizQuestionsOf: quizQuestionsOf,
    checkAchievements: checkAchievements, achList: ACH, noteRunResult: noteRunResult, noteDailySolved: noteDailySolved,
    noteDailyOpened: noteDailyOpened, dailyRecordLine: dailyRecordLine, recordsHtml: recordsHtml, achHtml: achHtml,
    diffHtml: diffHtml, codeLines: codeLines, lcsOps: lcsOps, codeNames: codeNames, exampleRefCode: exampleRefCode,
    renderCheckpoint: renderCheckpoint, renderRepeat: renderRepeat, ankiExportText: ankiExportText,
    onProgressEvent: onProgressEvent, keepRecent: keepRecent, aheadNotes: aheadNotes, renderCodeAlts: renderCodeAlts,
    // для тестов: новое API Moon Core (выключение без перезагрузки, общая шина)
    _mc: { api: cdMoonCoreApi, stop: cdStop, shareView: cdShareView, offCount: function () { return _cdOff.length; } },
  };
})();
