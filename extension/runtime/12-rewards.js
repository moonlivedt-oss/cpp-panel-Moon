  // ==== runtime/12-rewards.js — окно «Прогресс»: карта, экзамен недели, достижения, рекорды; Anki ====
  // ---------------------------------------------------------------------------
  //  Достижения — за реальные действия (собрал, починил, решил без подсказок), а не за клики.
  //  Счётчики событий — state.ach.n, полученные — state.ach.got { id: дата }.
  // ---------------------------------------------------------------------------
  function achState() {
    if (!state.ach || typeof state.ach !== "object" || Array.isArray(state.ach)) state.ach = {};
    if (!state.ach.got || typeof state.ach.got !== "object" || Array.isArray(state.ach.got)) state.ach.got = {};
    if (!state.ach.n || typeof state.ach.n !== "object" || Array.isArray(state.ach.n)) state.ach.n = {};
    return state.ach;
  }
  function achN(k) { var v = achState().n[k]; return typeof v === "number" && isFinite(v) ? v : 0; }
  function bumpCount(k, by) { var a = achState(); a.n[k] = achN(k) + (by || 1); achSoon(); }
  var _achBusy = false;
  // Зовёт saveState: проверка — не чаще раза в секунду (сохранения идут пачками при прокрутке).
  var _achAt = 0;
  function achOnSave() {
    if (_achBusy || Date.now() - _achAt < 1000 && _achT) return;
    _achBusy = true; _achAt = Date.now();
    try { checkAchievements(false); } catch (e) { reportError("достижения", e); } finally { _achBusy = false; }
  }
  function countMap(m) { return Object.keys(m || {}).filter(function (k) { return m[k]; }).length; }
  function masteredCount(p) { try { return progressTopics().filter(function (t) { return masteryPct(t) >= p; }).length; } catch (e) { return 0; } }
  function coreTopicsRead() {
    var d = DATA(); if (!d) return false;
    var n = 0;
    for (var k = 1; k <= 8; k++) if (d.files.some(function (f) { return /^ref\//i.test(f.rel) && topicNum(f.rel) === k && state.read[f.rel]; })) n++;
    return n >= 8;
  }
  function bestDailyMs() {
    var best = 0;
    Object.keys(state.records).forEach(function (k) { var r = state.records[k]; if (r && r.ms > 0 && (!best || r.ms < best)) best = r.ms; });
    return best;
  }
  var ACH = [
    { id: "read1", ic: "ui-read", t: "Первая тема", d: "Отметить первую тему «Изучено»", ok: function () { return countMap(state.read) >= 1; } },
    { id: "read10", ic: "ui-learned", t: "Десять тем", d: "Отметить «Изучено» десять материалов", ok: function () { return countMap(state.read) >= 10; } },
    { id: "core", ic: "icon-ref", t: "Фундамент", d: "Изучены темы 1–8 справочника", ok: coreTopicsRead },
    { id: "run1", ic: "ui-steps", t: "Первая сборка", d: "Программа собралась прямо в окне", ok: function () { return achN("compiled") >= 1; } },
    { id: "pass1", ic: "ui-solve", t: "Все тесты зелёные", d: "Решить первое «напиши и запусти»", ok: function () { return achN("runPass") >= 1; } },
    { id: "fix5", ic: "ui-hint", t: "Чиню сборку", d: "Пять раз исправить ошибку компиляции и собрать заново", ok: function () { return achN("compileFix") >= 5; } },
    { id: "crash", ic: "mascot-think", t: "Укротитель падений", d: "Программа упала, а после правки прошла все тесты", ok: function () { return achN("crashFix") >= 1; } },
    { id: "hang", ic: "ui-shuffle", t: "Вечный цикл пойман", d: "Программа зависла, а после правки прошла тесты", ok: function () { return achN("hangFix") >= 1; } },
    { id: "nohint10", ic: "mascot-search", t: "Без подсказок", d: "Десять заданий подряд решено без подсказок и эталона", ok: function () { return achN("noHintBest") >= 10; } },
    { id: "cards100", ic: "ui-cards", t: "Сто повторений", d: "Оценить карточки сто раз", ok: function () { return achN("graded") >= 100; } },
    { id: "streak7", ic: "ui-streak", t: "Неделя подряд", d: "Заниматься семь дней без пропуска", ok: function () { return streakDays() >= 7; } },
    { id: "streak30", ic: "ui-streak", t: "Месяц подряд", d: "Тридцать дней без пропуска", ok: function () { return streakDays() >= 30; } },
    { id: "daily7", ic: "ui-dice", t: "Задача дня ×7", d: "Решать задачу дня неделю подряд", ok: function () { return dailyStreak() >= 7; } },
    { id: "fast", ic: "ui-warm", t: "Молния", d: "Решить задачу дня быстрее двух минут", ok: function () { var b = bestDailyMs(); return b > 0 && b < 120000; } },
    { id: "boss1", ic: "icon-tasks", t: "Первый босс", d: "Победить босса темы", ok: function () { return countMap(state.boss) >= 1; } },
    { id: "boss5", ic: "icon-tasks", t: "Пять боссов", d: "Победить пять боссов", ok: function () { return countMap(state.boss) >= 5; } },
    { id: "exam1", ic: "ui-learned", t: "Зачёт", d: "Сдать итоговую проверку этапа", ok: function () { return Object.keys(state.exams).some(function (k) { return state.exams[k] && state.exams[k].passed; }); } },
    { id: "weekly1", ic: "icon-route", t: "Экзамен недели", d: "Пройти экзамен недели", ok: function () { return achN("weekly") >= 1; } },
    { id: "weekly100", ic: "mascot-win", t: "Без единой ошибки", d: "Экзамен недели на все вопросы", ok: function () { return achN("weeklyPerfect") >= 1; } },
    { id: "master1", ic: "icon-start", t: "Тема освоена", d: "Освоить тему на 80 % и больше", ok: function () { return masteredCount(80) >= 1; } },
    { id: "master5", ic: "mascot-done", t: "Пять освоенных тем", d: "Пять тем на 80 %+", ok: function () { return masteredCount(80) >= 5; } },
    { id: "repeat1", ic: "icon-examples", t: "Повторил за мной", d: "Написать пример программы самому по её поведению", ok: function () { return achN("repeat") >= 1; } },
    { id: "check1", ic: "ui-peek", t: "Сверился с эталоном", d: "Сравнить свою игру с контрольной точкой главы", ok: function () { return achN("checkpoint") >= 1; } },
  ];
  // Достижения проверяет saveState (перед записью — одна метка времени у localStorage и зеркала).
  // Счётчики, которые меняются без сохранения, просят сохранение с задержкой.
  var _achT = null;
  function achSoon() { clearTimeout(_achT); _achT = setTimeout(function () { _achT = null; saveState(); }, 700); }
  // Новые достижения → в state.ach.got + тост. Первый запуск этой версии — молча (старые заслуги не сыплются тостами).
  function checkAchievements(silent) {
    var a = achState(), fresh = [];
    var quiet = silent || !a.init;
    ACH.forEach(function (x) {
      if (a.got[x.id]) return;
      var ok = false; try { ok = !!x.ok(); } catch (e) {}
      if (ok) { a.got[x.id] = cdDate(0); fresh.push(x); }
    });
    a.init = 1;
    if (!quiet && fresh.length) setTimeout(function () {
      toast("Достижение: " + fresh.map(function (x) { return x.t; }).join(", ") + "!");
      try { if (winEl) celebrate(winEl.querySelector(".cd-head") || winEl, "#f9e2af"); } catch (e) {}
    }, 0);
    return fresh;
  }
  function achHtml() {
    var a = achState(), got = ACH.filter(function (x) { return a.got[x.id]; }).length;
    return '<div class="cd-ach-sum"><b>' + got + "</b> из " + ACH.length + " достижений</div>" +
      '<div class="cd-ach-grid">' + ACH.map(function (x) {
        var d = a.got[x.id];
        // значок — наклейка; нет её — первая буква названия в кружке; не получено — бледный
        return '<div class="cd-ach' + (d ? " got" : "") + '"><span class="cd-ach-ic">' + emo(x.ic, '<span class="cd-ach-mono">' + escapeHtml(x.t.charAt(0)) + "</span>") + "</span>" +
          '<span class="cd-ach-t">' + escapeHtml(x.t) + "</span><span class=\"cd-ach-d\">" + escapeHtml(x.d) + "</span>" +
          (d ? '<span class="cd-ach-when">' + escapeHtml(d) + "</span>" : "") + "</div>";
      }).join("") + "</div>";
  }

  // ---- Счётчики из «Запустить» и решений: зовут 13-interactive.js ----
  function noteRunResult(box, res) {
    if (!box || !res) return;
    if (res.stage === "compile") { box.__hadCompileErr = true; return; }
    if (res.stage !== "run") return;
    bumpCount("compiled");
    if (box.__hadCompileErr) { box.__hadCompileErr = false; bumpCount("compileFix"); }
    var tests = res.tests || [];
    if (tests.some(function (t) { return t.crash; })) box.__hadCrash = true;
    if (res.stopped === "hang") box.__hadHang = true;
    if (res.ok && tests.length) {
      bumpCount("runPass");
      if (box.__hadCrash) { box.__hadCrash = false; bumpCount("crashFix"); }
      if (box.__hadHang) { box.__hadHang = false; bumpCount("hangFix"); }
      if (box.classList && box.classList.contains("cd-rep")) bumpCount("repeat");
    }
    if (!res.ok) noteAttempt(box, false);
  }
  // Подсказки: открыл подсказку или эталон — задание решено «с помощью».
  function boxHinted(box) {
    var hb = box && box.querySelector && box.querySelector(".cd-hints");
    return !!(box && (box.__solShown || box.__revealed || (hb && +hb.getAttribute("data-shown") > 0)));
  }
  function noteSolvedFirst(box) {
    if (boxHinted(box)) { achState().n.noHintRun = 0; }
    else {
      var run = achN("noHintRun") + 1;
      achState().n.noHintRun = run;
      if (run > achN("noHintBest")) achState().n.noHintBest = run;
    }
    achSoon();
  }

  // ---- Рекорды задачи дня: время, попытки, без подсказок ----
  function dailyFor(box) {
    var id = box && box.getAttribute && box.getAttribute("data-id");
    return id && state.daily && state.daily.id === id && state.daily.date === cdDate(0) ? state.daily : null;
  }
  function noteDailyOpened() {
    if (state.daily && state.daily.date === cdDate(0) && !state.daily.startAt && !state.dailyDone[cdDate(0)]) {
      state.daily.startAt = Date.now(); state.daily.tries = 0; state.daily.hint = false; saveState();
    }
  }
  function noteAttempt(box, ok) { var dc = dailyFor(box); if (dc && !ok) { dc.tries = (dc.tries | 0) + 1; saveState(); } }
  function noteHint(box) { var dc = dailyFor(box); if (dc) { dc.hint = true; saveState(); } }
  function typeBest(type, skipDate) {
    var best = null;
    Object.keys(state.records).forEach(function (k) {
      var r = state.records[k];
      if (!r || k === skipDate || r.type !== type || !(r.ms > 0)) return;
      if (!best || r.ms < best.ms) best = r;
    });
    return best;
  }
  function noteDailySolved(box) {
    var dc = dailyFor(box); if (!dc) return;
    var today = cdDate(0);
    if (state.records[today]) return;
    var rec = { type: dc.type, ms: dc.startAt ? Date.now() - dc.startAt : 0, tries: (dc.tries | 0) + 1, hint: !!(dc.hint || boxHinted(box)) };
    var prev = typeBest(dc.type, today);
    state.records[today] = rec;
    keepLast(state.records, 400);
    saveState();
    if (rec.ms > 0 && (!prev || rec.ms < prev.ms)) {
      setTimeout(function () { toast("Новый рекорд «" + (DAILY_TYPES[rec.type] || "задание") + "»: " + mmss(rec.ms) + (prev ? " (было " + mmss(prev.ms) + ")" : "")); }, 2700);
    }
  }
  function dailyRecordLine(type) {
    var b = typeBest(type, null), t = state.records[cdDate(0)];
    if (t && t.ms) return "сегодня " + mmss(t.ms) + (t.tries > 1 ? ", попыток " + t.tries : ", с первой попытки") + (b && b !== t ? " · рекорд " + mmss(b.ms) : "");
    return b ? "рекорд " + mmss(b.ms) : "";
  }
  function recordsHtml() {
    var keys = Object.keys(state.records).sort().reverse();
    if (!keys.length) return '<p class="cd-pg-empty">Рекордов пока нет. Реши задачу дня с главной — время засекается с момента, как ты её открыл.</p>';
    var rows = Object.keys(DAILY_TYPES).map(function (type) {
      var list = keys.map(function (k) { return state.records[k]; }).filter(function (r) { return r && r.type === type; });
      if (!list.length) return "";
      var b = typeBest(type, null), avgTries = list.slice(0, 30).reduce(function (s, r) { return s + (r.tries || 1); }, 0) / Math.min(30, list.length);
      var clean = list.filter(function (r) { return !r.hint && (r.tries || 1) === 1; }).length;
      return "<tr><td>" + escapeHtml(DAILY_TYPES[type]) + "</td><td>" + list.length + "</td><td><b>" + (b ? mmss(b.ms) : "—") + "</b></td><td>" +
        avgTries.toFixed(1) + "</td><td>" + clean + "</td></tr>";
    }).join("");
    var last = keys.slice(0, 14).map(function (k) {
      var r = state.records[k];
      return "<li><span>" + escapeHtml(k) + "</span><span>" + escapeHtml(DAILY_TYPES[r.type] || "") + "</span><b>" + (r.ms ? mmss(r.ms) : "—") + "</b><span>" +
        (r.tries || 1) + " " + plural(r.tries || 1, ["попытка", "попытки", "попыток"]) + (r.hint ? " · с подсказкой" : "") + "</span></li>";
    }).join("");
    return '<div class="cd-rec-sum">Серия задачи дня: <b>' + dailyStreak() + "</b> · всего решено: <b>" + keys.length + "</b></div>" +
      '<div class="tablewrap"><table class="cd-rec-t"><thead><tr><th>Вид</th><th>Решено</th><th>Лучшее время</th><th>Попыток в среднем</th><th>С первой без подсказок</th></tr></thead><tbody>' +
      rows + "</tbody></table></div>" + '<div class="cd-rec-last"><div>Последние дни</div><ul>' + last + "</ul></div>";
  }

  // ---- Экспорт карточек в Anki: текст с табуляцией (вопрос, ответ, метки) ----
  function ankiField(s) {
    return escapeHtml(String(s || "")).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
  }
  function ankiExportText() {
    var seen = {}, lines = ["#separator:tab", "#html:true", "#tags column:3"];
    collectAllCards().forEach(function (c) {
      if (seen[c.id]) return; seen[c.id] = 1;
      var tag = "cpp-docs " + String(c.rel).replace(/\.md$/i, "").replace(/[^\wа-яё-]+/gi, "_");
      lines.push(ankiField(c.q) + "\t" + ankiField(c.a) + "\t" + tag);
    });
    return { text: lines.join("\n") + "\n", count: lines.length - 3 };
  }
  function exportAnki() {
    var ex = ankiExportText();
    if (!ex.count) { toast("Карточек пока нет — они появятся, когда загрузятся материалы", true); return; }
    sendAction({ kind: "export-anki", text: ex.text, count: ex.count }, function (res) {
      if (res.ok) toast("Выбери, куда сохранить колоду (" + ex.count + " карточек)");
      else toast("Не получилось: " + (res.error || "нет связи с расширением"), true);
    });
  }

  // ---- Окно «Прогресс» поверх окна документации (как «Обучение») ----
  var progressEl = null;
  var PG_TABS = [["map", "Карта знаний"], ["weekly", "Экзамен недели"], ["ach", "Достижения"], ["rec", "Рекорды"]];
  function showProgress(tab) {
    if (!winEl) return;
    if (!progressEl) {
      progressEl = el("div", null); progressEl.className = "cd-guide cd-pg"; progressEl.hidden = true;
      progressEl.setAttribute("role", "dialog"); progressEl.setAttribute("aria-label", "Прогресс");
      progressEl.addEventListener("click", onProgressClick);
      progressEl.addEventListener("keydown", function (e) {
        var n = e.target && e.target.closest && e.target.closest(".cd-km-n");
        if (n && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); kmSelect(n.getAttribute("data-krel")); }
      });
      winEl.appendChild(progressEl);
    }
    try { if (checkAchievements(false).length) saveState(); } catch (e) {}
    setHTML(progressEl, '<div class="cd-guide-panel cd-pg-panel"><div class="cd-guide-top"><div class="cd-guide-title">Прогресс</div>' +
      '<button class="cd-pg-anki" type="button" title="Все карточки справочника — файлом для Anki">Карточки в Anki</button>' +
      '<button class="cd-guide-close" type="button" title="Закрыть" aria-label="Закрыть">×</button></div>' +
      '<div class="cd-guide-tabs">' + PG_TABS.map(function (t) { return '<button class="cd-guide-chip" type="button" data-pgt="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      '<div class="cd-guide-scroll">' + PG_TABS.map(function (t) { return '<div class="cd-pg-page" data-pg="' + t[0] + '" hidden></div>'; }).join("") + "</div></div>");
    progressEl.hidden = false;
    progressTab(tab || "map");
  }
  function progressTab(tab) {
    if (!progressEl) return;
    progressEl.querySelectorAll(".cd-guide-chip").forEach(function (c) { c.classList.toggle("on", c.getAttribute("data-pgt") === tab); });
    progressEl.querySelectorAll(".cd-pg-page").forEach(function (p) {
      var on = p.getAttribute("data-pg") === tab;
      p.hidden = !on;
      if (!on) return;
      if (tab === "map") setHTML(p, knowledgeMapHtml());
      else if (tab === "weekly") { if (weekly && !weekly.done) renderWeekly(); else if (weekly && weekly.done) renderWeekly(); else setHTML(p, weeklyIntroHtml()); }
      else if (tab === "ach") setHTML(p, achHtml());
      else if (tab === "rec") setHTML(p, recordsHtml());
    });
    var sc = progressEl.querySelector(".cd-guide-scroll"); if (sc) sc.scrollTop = 0;
  }
  function kmSelect(rel) {
    var det = progressEl && progressEl.querySelector(".cd-km-detail"); if (!det) return;
    progressEl.querySelectorAll(".cd-km-n").forEach(function (n) { n.classList.toggle("sel", n.getAttribute("data-krel") === rel); });
    setHTML(det, kmDetailHtml(rel)); det.hidden = false;
  }
  function onProgressClick(e) {
    var t = e.target; if (!t) return;
    if (t === progressEl) { hideProgress(); return; }
    if (!t.closest) return;
    if (t.closest(".cd-guide-close")) { hideProgress(); return; }
    if (t.closest(".cd-pg-anki")) { exportAnki(); return; }
    var chip = t.closest(".cd-guide-chip"); if (chip) { progressTab(chip.getAttribute("data-pgt")); return; }
    var go = t.closest(".cd-pg-tab-go"); if (go) { if (weekly && weekly.done) weekly = null; progressTab(go.getAttribute("data-go")); return; }
    var node = t.closest(".cd-km-n"); if (node) { kmSelect(node.getAttribute("data-krel")); return; }
    var nx = t.closest(".cd-km-next"); if (nx) { hideProgress(); openFile(nx.getAttribute("data-krel")); return; }
    var op = t.closest(".cd-kd-open"); if (op) { hideProgress(); openFile(op.getAttribute("data-krel2")); return; }
    var wg = t.closest(".cd-weak-go"); if (wg) { runWeakAction(wg.getAttribute("data-wrel"), wg.getAttribute("data-wk"), wg.getAttribute("data-wx")); return; }
    if (t.closest(".cd-wk-start") || t.closest(".cd-wk-again")) { weeklyStart(); return; }
    var opt = t.closest(".cd-wk-opt"); if (opt) { weeklyAnswer(+opt.getAttribute("data-k")); return; }
    if (t.closest(".cd-wk-next")) { if (weekly.i + 1 < weekly.qs.length) { weekly.i++; renderWeekly(); } else weeklyFinish(false); return; }
    if (t.closest(".cd-wk-quit")) { weeklyFinish(false); return; }
  }
  function hideProgress() { if (progressEl) progressEl.hidden = true; }
  function progressOpen() { return !!(progressEl && !progressEl.hidden); }
