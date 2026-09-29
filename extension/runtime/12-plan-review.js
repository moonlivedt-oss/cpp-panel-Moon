  // ==== runtime/12-plan-review.js — план на сегодня, курс, карточки, разминка, задача дня ====
  // ------- главная: план на сегодня и дорожка курса -------
  // Номер темы по имени файла: ref/04-funkcii.md → 4 (для связи тема ↔ задачник).
  function topicNum(rel) { var m = String(rel).match(/(?:^|\/)0?(\d{1,2})[a-z]?-[^/]*\.md$/i); return m ? +m[1] : 0; }
  // Первый ещё не прокрученный раздел ## / ### темы (по отметкам secSeen) — «где продолжить».
  function nextSection(f) {
    var seen = state.secSeen[f.rel] || {}, out = null;
    String(f.md || "").replace(/\r\n?/g, "\n").split("\n").some(function (ln) {
      var m = ln.match(/^(#{2,3})\s+(.*?)\s*#*\s*$/);
      if (!m || /^Что в этом файле/i.test(m[2])) return false;
      var slug = slugify(m[2]);
      if (!seen[slug]) { out = { slug: slug, text: m[2].replace(/`/g, "") }; return true; }
      return false;
    });
    return out;
  }
  // «План на сегодня» одной строкой: Разминка (2 мин) → тема, раздел (~N мин) → задача темы.
  function todayPlan(primary, cc) {
    if (!primary) return "";
    // Шаги дня: разминка → раздел темы → задача. Сделанное — с галочкой и зачёркнуто.
    var steps = [];
    function step(attrs, text, time, done) { steps.push({ a: attrs, t: text, m: time, done: !!done }); }
    if (cc.total > 0) step(' data-act="warm"', "Разминка", "2 мин", warmupDoneToday());
    var sec = nextSection(primary);
    var mins = Math.max(5, Math.min(20, Math.round(String(primary.md || "").length / 2500)));
    step(' data-rel="' + escapeHtml(primary.rel) + '"' + (sec ? ' data-hash="#' + escapeHtml(sec.slug) + '"' : ""),
      escapeHtml(primary.title || primary.name) + (sec ? ' <span class="cd-plan-sub">раздел «' + escapeHtml(sec.text) + "»</span>" : ""),
      "~" + mins + " мин", !!state.read[primary.rel]);
    var n = topicNum(primary.rel);
    if (n && /^ref\//i.test(primary.rel)) {
      var task = collectTasks(true).filter(function (t) { return topicNum(t.rel) === n; })[0];
      if (task) {
        // номер «4.2» берём из текста заголовка задачи (в slug точки пропадают)
        var tf = lookupFile(task.rel), lbl = "Задача темы";
        String(tf && tf.md || "").split("\n").some(function (ln) {
          var hm = ln.match(/^##\s+(.*?)\s*#*\s*$/);
          if (!hm || slugify(hm[1]) !== task.slug) return false;
          var nm = hm[1].match(/^(\d+\.\d+)/); if (nm) lbl = "Задача " + nm[1];
          return true;
        });
        step(' data-rel="' + escapeHtml(task.rel) + '" data-hash="#' + escapeHtml(task.slug) + '"', lbl, "практика", false);
      }
    }
    var done = steps.filter(function (x) { return x.done; }).length;
    var html = steps.map(function (x, i) {
      return '<button class="cd-plan-step' + (x.done ? " done" : "") + '" type="button"' + x.a + ">" +
        '<span class="cd-plan-n">' + (x.done ? "✓" : i + 1) + "</span>" +
        '<span class="cd-plan-t">' + x.t + "</span><i>" + x.m + "</i></button>";
    }).join('<span class="cd-plan-line" aria-hidden="true"></span>');
    return '<div class="cd-plan"><div class="cd-plan-l">План на сегодня<span class="cd-plan-c">' + done + " из " + steps.length + "</span></div>" +
      '<div class="cd-plan-row">' + html + "</div></div>";
  }
  // Дорожка курса: темы справочника 1–8 кружками — пройденные залиты, «ты здесь» подсвечена.
  function courseTrack() {
    var d = DATA(); if (!d) return "";
    var topics = [];
    for (var n = 1; n <= 8; n++) {
      var f = d.files.filter(function (x) { return /^ref\//i.test(x.rel) && topicNum(x.rel) === n; })[0];
      if (f) topics.push(f);
    }
    if (topics.length < 3) return "";
    var here = null;
    for (var i = 0; i < topics.length; i++) if (!state.read[topics[i].rel]) { here = topics[i]; break; }
    var done = topics.filter(function (f) { return state.read[f.rel]; }).length;
    var examOk = examPassedTopics();
    var checkF = d.files.filter(function (x) { return /itogovye-proverki/i.test(x.rel); })[0];
    var html = '<div class="cd-track" aria-label="Дорожка курса"><div class="cd-track-h"><span>Курс: темы 1–' + topics.length + "</span><b>" + done + " из " + topics.length + "</b></div><ol>";
    topics.forEach(function (f, k) {
      var st = state.read[f.rel] ? "done" : (f === here ? "here" : "");
      if (examOk[k + 1]) st += " exam";
      var name = (f.title || f.name).split(/[:(]/)[0].trim();
      html += '<li class="' + st + '"><button type="button" data-rel="' + escapeHtml(f.rel) + '" title="' + escapeHtml(f.title || f.name) + (examOk[k + 1] ? " — итоговая проверка сдана" : "") + (st.indexOf("here") === 0 ? " — ты здесь" : st.indexOf("done") === 0 ? " — изучено" : "") + '">' +
        '<span class="cd-tr-dot">' + (state.read[f.rel] ? "✓" : String(k + 1)) + '</span><span class="cd-tr-n">' + escapeHtml(name) + "</span></button></li>";
    });
    html += "</ol>";
    if (checkF) {
      var passedN = Object.keys(state.exams).filter(function (k) { return state.exams[k] && state.exams[k].passed; }).length;
      html += '<button class="cd-track-exam" type="button" data-rel="' + escapeHtml(checkF.rel) + '">Итоговые проверки этапов' +
        (passedN ? " · сдано " + passedN : "") + " →</button>";
    }
    return html + "</div>";
  }

  // ------- #1: следующий шаг по курсу (первый неизученный материал в порядке данных) -------
  function nextUnread() {
    var d = DATA(); if (!d) return null;
    for (var i = 0; i < d.files.length; i++) { if (!state.read[d.files[i].rel]) return d.files[i]; }
    return null;
  }

  // ------- #3: флеш-карточки к повторению (движок cdCardState/cdSchedule уже есть) -------
  // Разбор одного блока ```cards в пары {q,a} — та же логика, что в renderCards.
  function parseCards(src) {
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n"), out = [], cur = null;
    function flush() { if (cur && (cur.q.length || cur.a.length)) out.push(cur); cur = null; }
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i];
      var mq = t.match(/^\s*(?:Q|В|Вопрос)\s*[:.]\s*(.*)$/i);
      var ma = t.match(/^\s*(?:A|О|Ответ)\s*[:.]\s*(.*)$/i);
      var mh = t.match(/^\s*(?:H|Подсказка)\s*[:.]\s*(.*)$/i);
      if (mq) { if (cur && cur.a.length) flush(); if (!cur) cur = { q: [], a: [], h: [], m: "q" }; cur.q.push(mq[1]); cur.m = "q"; continue; }
      if (ma) { if (!cur) cur = { q: [], a: [], h: [], m: "a" }; cur.a.push(ma[1]); cur.m = "a"; continue; }
      if (mh) { if (!cur) cur = { q: [], a: [], h: [], m: "h" }; cur.h.push(mh[1]); cur.m = "h"; continue; }   // подсказка — не часть ответа
      if (!t.trim()) { if (cur && cur.a.length) flush(); continue; }
      if (cur) cur[cur.m].push(t.trim());
    }
    flush();
    return out;
  }
  // Все карточки из всех файлов: [{q,a,id,rel}].
  function collectAllCards() {
    var d = DATA(), out = [];
    if (!d) return out;
    d.files.forEach(function (f) {
      var md = String(f.md || ""), re = /```+[ \t]*cards[ \t]*\r?\n([\s\S]*?)\r?\n```+/gi, m;
      while ((m = re.exec(md))) {
        // ближайший заголовок ## / ### над блоком — «откуда карточка»
        var before = md.slice(0, m.index), hm, hre = /^#{2,3}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, sec = null;
        while ((hm = hre.exec(before))) sec = hm[1];
        parseCards(m[1]).forEach(function (c) {
          var q = c.q.join(" "); if (!q) return;
          out.push({ q: q, a: c.a.join(" "), id: cdHash(q), rel: f.rel, sec: sec ? sec.replace(/`/g, "") : "", slug: sec ? slugify(sec) : "" });
        });
      }
    });
    return out;
  }
  // Счётчики для главного экрана: сколько «пора повторить» и сколько «новых».
  // Новые карточки дозируем: не больше NEW_PER_DAY в день («52 новые карточки» на старте пугают).
  var NEW_PER_DAY = 10;
  function newLeftToday() {
    var t = cdDate(0), nt = state.newToday;
    return Math.max(0, NEW_PER_DAY - (nt && nt.d === t ? nt.n | 0 : 0));
  }
  function noteNewSeen() {
    var t = cdDate(0);
    if (!state.newToday || state.newToday.d !== t) state.newToday = { d: t, n: 0 };
    state.newToday.n = (state.newToday.n | 0) + 1;
  }
  function cardCounts() {
    var all = collectAllCards(), due = 0, neu = 0, seen = {};
    all.forEach(function (c) {
      if (seen[c.id]) return; seen[c.id] = true;
      var s = cdCardState(c.id).status; if (s === "due") due++; else if (s === "new") neu++;
    });
    return { due: due, neu: Math.min(neu, newLeftToday()), newTotal: neu, total: all.length };
  }
  // Очередь на сессию: сперва просроченные, затем новые; не длиннее 20 за раз.
  function buildReviewQueue() {
    var all = collectAllCards(), dueL = [], newL = [], seen = {};
    all.forEach(function (c) {
      if (seen[c.id]) return; seen[c.id] = true;
      var s = cdCardState(c.id).status; if (s === "due") dueL.push(c); else if (s === "new") newL.push(c);
    });
    return dueL.concat(newL.slice(0, newLeftToday())).slice(0, 20);
  }
  function startReview() {
    reviewQueue = buildReviewQueue();
    resetReviewSession(false);
    if (!reviewQueue.length) return;
    showReview();
  }
  // «Разминка дня»: ровно 5 карточек — сперва «пора повторить», затем новые, а если их не
  // хватает — те, чей повтор ближе всего (разминка бывает каждый день, даже без просроченных).
  var WARMUP_N = 5;
  // ---- Задача дня: одна маленькая задача в день, своя серия дней ----
  // Берём задания ```challenge (предскажи вывод / собери код / напиши и запусти) из тем, которые
  // ученик уже открывал (иначе — из первых тем), сначала нерешённые. Выбор детерминирован датой:
  // весь день одна и та же задача, завтра — другая. Решил её — день засчитан в серию.
  var DAILY_TYPES = { predict: "предскажи вывод", parsons: "собери код", run: "напиши и запусти" };
  function collectChallenges() {
    var d = DATA(), out = [];
    if (!d) return out;
    d.files.forEach(function (f) {
      var md = String(f.md || "").replace(/\r\n?/g, "\n"), re = /^```challenge[^\n]*\n([\s\S]*?)\n```/gm, m;
      while ((m = re.exec(md))) {
        var fk = fenceKey(m[1].replace(/\r\n?/g, "\n"));
        var head = fk.body.split(/^\s*---\s*$/m)[0] || "", type = "parsons", prompt = [];
        head.split("\n").forEach(function (ln) {
          var mt = ln.match(/^\s*@type\s+(\w+)/i); if (mt) { type = mt[1].toLowerCase(); return; }
          if (/^\s*@hint\s/i.test(ln)) return;
          if (ln.trim()) prompt.push(ln.trim());
        });
        out.push({ rel: f.rel, id: fk.id, type: DAILY_TYPES[type] ? type : "parsons", prompt: prompt.join(" ").replace(/[`*]/g, ""), title: f.title || f.name });
      }
    });
    return out;
  }
  function dailyChallenge() {
    var today = cdDate(0);
    if (state.daily && state.daily.date === today && lookupFile(state.daily.rel) &&
        (state.daily.type !== "run" || (DATA() && DATA().run && DATA().run.enabled))) return state.daily;
    // «Напиши и запусти» без cppDocs.localRun решить нельзя — такая задача дня сожгла бы серию.
    var runOn = !!(DATA() && DATA().run && DATA().run.enabled);
    var all = collectChallenges().filter(function (c) { return runOn || c.type !== "run"; });
    if (!all.length) return null;
    var opened = all.filter(function (c) { return state.read[c.rel] || (state.recent || []).indexOf(c.rel) !== -1; });
    var pool = opened.length ? opened : all.filter(function (c) { return topicNum(c.rel) <= 3; });
    if (!pool.length) pool = all;
    var fresh = pool.filter(function (c) { return !state.challenge[c.id]; });
    if (fresh.length) pool = fresh;
    var c = pool[parseInt(cdHash("daily:" + today).slice(1), 36) % pool.length];
    state.daily = { date: today, id: c.id, rel: c.rel, type: c.type, prompt: c.prompt.slice(0, 140), title: c.title };
    saveState();
    return state.daily;
  }
  function dailyStreak() {
    var d = new Date(), n = 0;
    if (!state.dailyDone[cdDate(0)]) d.setDate(d.getDate() - 1);   // сегодня ещё не решал — серия не сгорела
    for (;;) {
      var k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      if (!state.dailyDone[k]) break;
      n++; d.setDate(d.getDate() - 1);
    }
    return n;
  }
  function openDaily() {
    var dc = dailyChallenge(); if (!dc) return;
    try { noteDailyOpened(); } catch (e) {}
    openFile(dc.rel);
    setTimeout(function () {
      var box = articleEl && articleEl.querySelector('[data-id="' + cssEscape(dc.id) + '"]');
      if (!box) return;
      unfoldContaining(box);
      box.scrollIntoView({ block: "center", behavior: "smooth" });
      box.classList.add("cd-daily-hl"); setTimeout(function () { box.classList.remove("cd-daily-hl"); }, 2200);
    }, 120);
  }
  function dailyCardHtml() {
    var dc = dailyChallenge(); if (!dc) return "";
    var done = !!state.dailyDone[cdDate(0)], streak = dailyStreak();
    return '<div class="cd-home-warm cd-daily' + (done ? " done" : "") + '"' + (done ? "" : ' role="button" tabindex="0"') + '>' +
      '<span class="cd-hw-ic">' + (done ? "✓" : emo("ui-dice", "🎯")) + "</span>" +
      '<div class="cd-hc-main"><div class="cd-hc-lbl">Задача дня · ' + escapeHtml(DAILY_TYPES[dc.type] || "задание") + (done ? " · решена" : "") + "</div>" +
      '<div class="cd-hc-title">' + escapeHtml(dc.prompt || "Задание из темы") + "</div>" +
      '<div class="cd-hc-meta">' + escapeHtml(dc.title) + (streak ? " · серия " + streak + " " + plural(streak, ["день", "дня", "дней"]) : " · реши — начнётся серия") +
      (function () { var r = ""; try { r = dailyRecordLine(dc.type); } catch (e) {} return r ? " · " + escapeHtml(r) : ""; })() + "</div></div>" +
      (done ? "" : '<div class="cd-hc-arrow">→</div>') + "</div>";
  }
  function buildWarmupQueue() {
    var all = collectAllCards(), dueL = [], newL = [], laterL = [], seen = {};
    all.forEach(function (c) {
      if (seen[c.id]) return; seen[c.id] = true;       // одна и та же карточка в двух файлах — один раз
      var s = cdCardState(c.id).status;
      if (s === "due") dueL.push(c); else if (s === "new") newL.push(c); else laterL.push(c);
    });
    laterL.sort(function (a, b) { return String(state.cards[a.id].due).localeCompare(String(state.cards[b.id].due)); });
    var today = cdDate(0), miss = [];
    Object.keys(state.missed).forEach(function (k) {
      var m = state.missed[k];
      if (m && typeof m.q === "string" && String(m.due) <= today && lookupFile(m.rel))
        miss.push({ q: "🤔 " + m.q, a: m.a, id: "miss:" + k, rel: m.rel, sec: MISS_LABEL[m.kind] || MISS_LABEL.steps, slug: m.hash, missed: k, md: !!m.md, due: String(m.due) });
    });
    miss.sort(function (x, y) { return x.due.localeCompare(y.due); });   // самые давние ошибки — первыми
    return miss.slice(0, 3).concat(dueL, newL.slice(0, newLeftToday()), laterL).slice(0, WARMUP_N);
  }
  function warmupDoneToday() { return state.warmupDone === cdDate(0); }
  function startWarmup() {
    reviewQueue = buildWarmupQueue();
    resetReviewSession(true);
    if (!reviewQueue.length) return;
    showReview();
  }
  function resetReviewSession(warm) {
    reviewPos = 0; reviewOk = 0; reviewWarmup = !!warm;
    reviewLog = []; reviewUndo = null; reviewStreak = 0; reviewTyped = "";
  }
  var RV_GRADES = [   // [подпись, значок, класс]
    ["Не помню", "✗", "g0"], ["Трудно", "~", "g1"], ["Помню", "✓", "g2"],
  ];
  // Дорожка сессии: точка на карточку, отвеченные окрашены оценкой, текущая пульсирует.
  function reviewTrackHtml() {
    var n = reviewQueue.length;
    if (n > 24) {
      return '<span class="cd-rv-prog"><i style="width:' + Math.round(reviewPos / n * 100) + '%"></i></span>';
    }
    var html = '<span class="cd-rv-track">';
    for (var i = 0; i < n; i++) {
      var lg = reviewLog[i], cls = lg ? "g" + lg.g : (i === reviewPos ? "cur" : "");
      if (reviewQueue[i] && reviewQueue[i].again) cls += " again";
      html += '<i class="' + cls + '"></i>';
    }
    return html + "</span>";
  }
  function reviewTopHtml() {
    return '<div class="cd-rv-top">' +
      '<span class="cd-rv-count">' + (reviewWarmup ? "Разминка · " : "Повторение · ") + Math.min(reviewPos + 1, reviewQueue.length) + " / " + reviewQueue.length + "</span>" +
      reviewTrackHtml() +
      (reviewUndo ? '<button class="cd-rv-undo" type="button" title="Отменить последнюю оценку">↶ Назад</button>' : "") +
      '<button class="cd-rv-close" type="button" title="Закрыть">✕</button></div>';
  }
  // Сколько карточек этой сессии вернётся завтра и на этой неделе (по свежему расписанию).
  function reviewReturns() {
    var t1 = cdDate(1), t7 = cdDate(7), tomorrow = 0, week = 0, seen = {};
    reviewLog.forEach(function (l) {
      if (!l.id || seen[l.id]) return; seen[l.id] = true;
      var rec = state.cards[l.id]; if (!rec || !rec.due) return;
      if (String(rec.due) <= t1) tomorrow++; else if (String(rec.due) <= t7) week++;
    });
    return { tomorrow: tomorrow, week: week };
  }
  function reviewDoneHtml() {
    var wm = (typeof STICKERS !== "undefined" && STICKERS && STICKERS["mascot-win"]) ? "mascot-win" : "mascot-done";
    var cnt = [0, 0, 0], weak = [], seenWeak = {};
    reviewLog.forEach(function (l) {
      if (l.again) return;                                  // повтор внутри сессии не считаем второй раз
      cnt[l.g]++;
      if (l.g < 2 && !seenWeak[l.key]) { seenWeak[l.key] = true; weak.push(l); }
    });
    var total = cnt[0] + cnt[1] + cnt[2], acc = total ? Math.round((cnt[1] + cnt[2]) / total * 100) : 0;
    var ret = reviewReturns(), cc = null;
    try { cc = cardCounts(); } catch (e) {}
    var more = cc && !reviewWarmup ? cc.due + cc.neu : (cc ? cc.due : 0);
    var title = (reviewWarmup ? "Разминка сделана! " : "") + (total ? "Повторено " + total + " " + plural(total, ["карточка", "карточки", "карточек"]) : "Готово");
    var sub = !total ? "" : acc === 100 ? "Все вспомнил — отличная память." : acc >= 70 ? "Хороший результат: большинство — в голове." :
      "Ничего страшного: трудные карточки вернутся раньше, и с каждым разом будет легче.";
    var tile = function (k, v, lbl) { return '<div class="cd-rv-st ' + k + '"><b>' + v + "</b><span>" + lbl + "</span></div>"; };
    var weakHtml = weak.length ? '<div class="cd-rv-weak"><div class="cd-rv-wh">Стоит перечитать</div>' + weak.slice(0, 5).map(function (l) {
      var cf = lookupFile(l.rel);
      return '<div class="cd-rv-wi g' + l.g + '"><span class="cd-rv-wq">' + inline(String(l.q || "").replace(/^🤔\s*/, "")) + "</span>" +
        (cf ? '<button class="cd-rv-open" type="button" data-rel="' + escapeHtml(l.rel) + '" data-hash="' + (l.slug ? "#" + escapeHtml(l.slug) : "") + '">' +
          escapeHtml(cf.title || cf.name) + " ↗</button>" : "") + "</div>";
    }).join("") + "</div>" : "";
    var retTxt = (ret.tomorrow || ret.week) ? '<div class="cd-rv-ret">' + emo("ui-calendar", "📅") + " " +
      (ret.tomorrow ? "Завтра вернётся " + ret.tomorrow + " " + plural(ret.tomorrow, ["карточка", "карточки", "карточек"]) : "") +
      (ret.tomorrow && ret.week ? ", " : "") + (ret.week ? (ret.tomorrow ? "" : "На этой неделе вернётся ") + (ret.tomorrow ? "на неделе ещё " : "") + ret.week : "") + "</div>" : "";
    return '<div class="cd-rv-inner">' + reviewTopHtml() + '<div class="cd-rv-done">' +
      '<div class="cd-rv-art">' + stickerMarkup(wm, 96) + "</div>" +
      '<div class="cd-rv-done-t">' + escapeHtml(title) + "</div>" +
      (sub ? '<div class="cd-rv-done-s">' + escapeHtml(sub) + "</div>" : "") +
      (total ? '<div class="cd-rv-stats">' + tile("g2", cnt[2], "помню") + tile("g1", cnt[1], "трудно") + tile("g0", cnt[0], "не помню") +
        tile("acc", acc + "%", "вспомнил") + "</div>" : "") +
      retTxt + weakHtml +
      '<div class="cd-rv-done-btns"><button class="cd-rv-close2" type="button">На главную</button>' +
      (more ? '<button class="cd-rv-more" type="button">Ещё карточки (' + more + ")</button>" : "") + "</div>" +
      "</div></div>";
  }
  function renderReviewCard() {
    if (!reviewEl) return;
    syncReviewBell();
    if (reviewPos >= reviewQueue.length) {          // сессия окончена — итог
      if (reviewWarmup) state.warmupDone = cdDate(0);
      setHTML(reviewEl, reviewDoneHtml());
      recordActivity(); saveState();
      return;
    }
    var c = reviewQueue[reviewPos];
    var cf = lookupFile(c.rel);
    var from = cf ? escapeHtml(cf.title || cf.name) + (c.sec ? " → " + escapeHtml(c.sec) : "") : "";
    var gcol = cf && cf.groupColor ? ' style="--rvg:' + escapeHtml(cf.groupColor) + '"' : "";
    function gradeBtn(g) {
      var sub = c.again ? ["не вышло", "почти", "закрепил"][g] : c.missed ? ["через день", "через 3 дня", "больше не спрашивать"][g] : ivlLabel(cdPreview(c.id, g));
      var G = RV_GRADES[g];
      return '<button class="cd-rv-grade ' + G[2] + '" data-g="' + g + '" type="button"><span class="cd-rv-gi">' + G[1] + "</span>" +
        '<span class="cd-rv-gt">' + G[0] + "<small>" + escapeHtml(sub) + "</small></span></button>";
    }
    var streak = reviewStreak >= 3 ? '<span class="cd-rv-streak" title="Подряд без «не помню»">' + emo("ui-streak", "🔥") + " " + reviewStreak + " подряд</span>" : "";
    setHTML(reviewEl, '<div class="cd-rv-inner">' + reviewTopHtml() +
      '<div class="cd-rv-card"' + gcol + ">" +
      '<div class="cd-rv-meta">' + (from ? '<span class="cd-rv-from">' + from + "</span>" : "") +
      (c.again ? '<span class="cd-rv-badge">повтор</span>' : (cdCardState(c.id).status === "new" && !c.missed ? '<span class="cd-rv-badge new">новая</span>' : "")) + streak + "</div>" +
      '<div class="cd-rv-q">' + (c.md ? renderMarkdown(c.q, null) : inline(c.q)) + "</div>" +
      '<div class="cd-rv-recall"><details class="cd-rv-own"' + (reviewTyped ? " open" : "") + "><summary>" + emo("ui-pencil", "✎") + " Сначала вспомни — запиши ответ своими словами (необязательно)</summary>" +
      '<textarea class="cd-rv-in" rows="2" placeholder="Как объяснил бы другу?"></textarea></details></div>' +
      '<div class="cd-rv-a" hidden>' + '<div class="cd-rv-mine" hidden><span>Твой ответ</span><div class="cd-rv-mt"></div></div>' +
      '<div class="cd-rv-al">Ответ</div>' + (c.md ? renderMarkdown(c.a, null) : inline(c.a)) + "</div>" +
      '<div class="cd-rv-ctl"><button class="cd-rv-show" type="button">Показать ответ</button>' +
      '<span class="cd-rv-rate" hidden>' + gradeBtn(0) + gradeBtn(1) + gradeBtn(2) + "</span>" +
      (cf ? '<button class="cd-rv-open" type="button" data-rel="' + escapeHtml(c.rel) + '" data-hash="' + (c.slug ? "#" + escapeHtml(c.slug) : "") + '" title="Прочитать раздел, откуда эта карточка">открыть раздел ↗</button>' : "") +
      "</div></div>" +
      '<div class="cd-rv-hint">' + (c.again ? "Эта карточка уже была «не помню» — закрепляем, расписание не меняется." : "Отвечай честно: от оценки зависит, когда карточка вернётся.") + "</div></div>");
    var ta = reviewEl.querySelector(".cd-rv-in");
    if (ta) { ta.value = reviewTyped; ta.addEventListener("input", function () { reviewTyped = ta.value; }); }
  }
  function cloneOrUndef(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function reviewGrade(g) {
    var c = reviewQueue[reviewPos]; if (!c) return;
    // снимок для «↶ Назад»: всё, что меняет оценка
    reviewUndo = {
      pos: reviewPos, ok: reviewOk, streak: reviewStreak, logLen: reviewLog.length, queueLen: reviewQueue.length,
      id: c.id, card: cloneOrUndef(state.cards[c.id]), missedKey: c.missed || "", missed: c.missed ? cloneOrUndef(state.missed[c.missed]) : undefined,
      newToday: cloneOrUndef(state.newToday), warm: state.warmupDone, typed: reviewTyped,
    };
    reviewLog[reviewPos] = { g: g, id: c.missed ? "" : c.id, key: c.id, q: c.q, rel: c.rel, slug: c.slug, again: !!c.again };
    reviewStreak = g >= 1 ? reviewStreak + 1 : 0;
    reviewTyped = "";
    if (c.again) {                    // повтор внутри сессии: расписание уже назначено первой оценкой
      reviewPos++; renderReviewCard(); return;
    }
    if (c.missed) {                   // загадка из разбора: своё простое расписание
      if (g >= 2) delete state.missed[c.missed];
      else if (state.missed[c.missed]) state.missed[c.missed].due = cdDate(g ? 3 : 1);
      saveState();
      if (g >= 1) reviewOk++;
      reviewPos++; renderReviewCard(); return;
    }
    if (cdCardState(c.id).status === "new") noteNewSeen();
    cdSchedule(c.id, g);
    try { bumpCount("graded"); } catch (e) {}
    if (g >= 1) reviewOk++;          // «трудно»/«помню» считаем как повторённую
    // «Не помню» — ещё раз в конце этой же сессии (один раз): вспомнить, пока ответ свежий, полезнее всего
    if (g === 0) reviewQueue.push(Object.assign({}, c, { again: true }));
    reviewPos++;
    renderReviewCard();
  }
  function reviewUndoLast() {
    var u = reviewUndo; if (!u) return;
    if (u.id && !u.missedKey) { if (u.card === undefined) delete state.cards[u.id]; else state.cards[u.id] = u.card; }
    if (u.missedKey) { if (u.missed === undefined) delete state.missed[u.missedKey]; else state.missed[u.missedKey] = u.missed; }
    if (u.newToday === undefined) delete state.newToday; else state.newToday = u.newToday;
    state.warmupDone = u.warm;
    reviewQueue.length = u.queueLen; reviewLog.length = u.logLen;
    reviewPos = u.pos; reviewOk = u.ok; reviewStreak = u.streak; reviewTyped = u.typed || "";
    reviewUndo = null;
    saveState(); renderReviewCard();
  }
  function onReviewClick(e) {
    var t = e.target;
    if (t.closest && t.closest(".cd-rv-close, .cd-rv-close2")) { hideReview(); showHome(); return; }
    if (t.closest && t.closest(".cd-rv-undo")) { reviewUndoLast(); return; }
    if (t.closest && t.closest(".cd-rv-more")) { startReview(); return; }
    if (t.closest && t.closest(".cd-rv-show")) {
      var card = reviewEl.querySelector(".cd-rv-card");
      if (card) {
        var a = card.querySelector(".cd-rv-a"), rate = card.querySelector(".cd-rv-rate"), show = card.querySelector(".cd-rv-show");
        var mine = card.querySelector(".cd-rv-mine"), own = card.querySelector(".cd-rv-recall");
        if (mine && reviewTyped.trim()) { mine.hidden = false; mine.querySelector(".cd-rv-mt").textContent = reviewTyped.trim(); }
        if (own) own.hidden = true;
        if (a) a.hidden = false; if (rate) rate.hidden = false; if (show) show.hidden = true;
        card.classList.add("flipped");
      }
      return;
    }
    var gb = t.closest && t.closest(".cd-rv-grade");
    if (gb) { reviewGrade(parseInt(gb.getAttribute("data-g"), 10) || 0); return; }
    var ob = t.closest && t.closest(".cd-rv-open");
    if (ob) { hideReview(); if (winEl) winEl.classList.remove("reviewing"); openFile(ob.getAttribute("data-rel"), ob.getAttribute("data-hash") || undefined); return; }
  }
  function showReview() {
    if (!reviewEl || !winEl) return;
    if (homeEl) homeEl.hidden = true;
    reviewEl.hidden = false; winEl.classList.add("home");
    winEl.classList.add("reviewing");   // режим повторения: без списка материалов, карточка крупнее
    // пейзаж палитры — приглушённым фоном (если на главной выбран «Пейзаж»)
    var bg = state.homeBg === "none" || state.homeBg === "stars" ? null : homeBgImage();
    reviewEl.classList.toggle("has-bg", !!bg);
    if (bg) reviewEl.style.setProperty("--rv-bg", "url(" + bg + ")"); else reviewEl.style.removeProperty("--rv-bg");
    renderReviewCard();
    syncHead();
  }
  function hideReview() { if (reviewEl) reviewEl.hidden = true; if (winEl) winEl.classList.remove("reviewing"); }

  // Картинки: data-src → file:// абсолютный путь относительно корня доков.
  function resolveImagesIn(root, f) {
    var d = DATA(); if (!d || !f || !root) return;
    root.querySelectorAll("img[data-src]").forEach(function (img) {
      var src = img.getAttribute("data-src");
      if (!src) return;
      // Доки офлайновые: удалённые (http/https) и inline (data:) картинки не грузим — автозагрузка
      // внешнего URL из оболочки это канал утечки (IP, факт чтения). Заменяем текстовой заглушкой.
      if (/^https?:/i.test(src) || /^data:/i.test(src)) {
        var ph = el("span", "opacity:.55;font-style:italic;font-size:.9em",
          img.getAttribute("alt") || "внешнее изображение (не загружено)");
        ph.title = "Внешние картинки отключены ради приватности";
        if (img.parentNode) img.parentNode.replaceChild(ph, img);
        return;
      }
      var res = resolveRel(f.rel, src);
      var base = (d.root || "").replace(/\\/g, "/");
      // Оболочка VS Code отклоняет file:// — картинку отдаёт vscode-file:// (resUrl; сегменты кодируются).
      if (base) {
        var fu = "file:///" + (base + "/" + res.rel).replace(/^\/+/, "").split("/").map(function (seg) {
          try { return encodeURIComponent(decodeURIComponent(seg)).replace(/%3A/gi, ":"); } catch (e) { return encodeURIComponent(seg); }
        }).join("/");
        var ru = resUrl(fu);
        if (ru) img.src = ru;
      }
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
    var text = btn.getAttribute("data-code");
    if (text == null) {
      var wrap = btn.closest ? btn.closest(".codewrap") : btn.parentNode;
      var pre = wrap ? wrap.querySelector("pre.code code") : null;
      text = pre ? pre.textContent : "";
    }
    try {
      navigator.clipboard.writeText(text).then(function () { flashCopy(btn); }, function () { legacyCopy(text); flashCopy(btn); });
    } catch (err) { legacyCopy(text); flashCopy(btn); }
  }
