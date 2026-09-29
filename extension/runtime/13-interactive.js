  // ==== runtime/13-interactive.js — обработка кликов интерактивных блоков, поиск по тексту, клавиатура ====
  // ------- опросник / «найди ошибку» (общая обработка для читалки и сплита) -------
  function quizMarkAnswered(q, ok) {
    var first = !q.hasAttribute("data-answered");
    q.setAttribute("data-answered", "1");
    if (first) { q.setAttribute("data-first", ok ? "1" : "0"); examProgress(q); if (!ok) missQuiz(q); }
    var opts = q.querySelectorAll(".cd-quiz-opt");
    for (var i = 0; i < opts.length; i++)
      if (opts[i].getAttribute("data-ok") === "1") opts[i].classList.add("right");
    var ex = q.querySelector(".cd-quiz-expl"); if (ex) ex.hidden = false;
    var rv = q.querySelector(".cd-quiz-reveal"); if (rv) rv.style.display = "none";
  }
  function quizPick(opt) {
    var q = opt.closest && opt.closest(".cd-quiz-q"); if (!q) return;
    opt.classList.add(opt.getAttribute("data-ok") === "1" ? "right" : "wrong", "picked");
    quizMarkAnswered(q, opt.getAttribute("data-ok") === "1");
  }
  // Итоговая проверка: когда отвечены все вопросы — итог, зачёт и запись результата.
  function examProgress(q) {
    var box = q.closest && q.closest(".cd-exam"); if (!box) return;
    var qs = box.querySelectorAll(".cd-quiz-q"), answered = 0, right = 0;
    for (var i = 0; i < qs.length; i++) {
      if (qs[i].hasAttribute("data-first")) answered++;
      if (qs[i].getAttribute("data-first") === "1") right++;
    }
    if (answered < qs.length) return;
    var total = qs.length, passed = right >= Math.ceil(total * EXAM_PASS);
    var id = box.getAttribute("data-exam"), prev = state.exams[id] || {};
    state.exams[id] = {
      best: Math.max(prev.best || 0, right), total: total, passed: !!(prev.passed || passed),
      topics: parseTopics(box.getAttribute("data-topics"))
    };
    saveState(); try { recordActivity(); } catch (e) {}
    var res = box.querySelector(".cd-exam-res");
    if (res) {
      res.hidden = false;
      res.className = "cd-exam-res " + (passed ? "ok" : "no");
      setHTML(res, (passed
        ? "<b>Зачтено: " + right + " из " + total + ".</b> Этап отмечен на дорожке курса на главной."
        : "<b>Пока " + right + " из " + total + "</b> — для зачёта нужно " + Math.ceil(total * EXAM_PASS) + ". Перечитай разделы по вопросам с ошибками и пройди ещё раз.") +
        ' <button class="cd-exam-again" type="button">Пройти заново</button>');
    }
    if (passed) { try { celebrate(res || box); } catch (e) {} }
  }
  function examReset(btn) {
    var box = btn.closest(".cd-exam"); if (!box) return;
    box.querySelectorAll(".cd-quiz-q").forEach(function (q) {
      q.removeAttribute("data-answered"); q.removeAttribute("data-first");
      q.querySelectorAll(".cd-quiz-opt").forEach(function (o) { o.classList.remove("right", "wrong", "picked"); });
      var ex = q.querySelector(".cd-quiz-expl"); if (ex) ex.hidden = true;
      var rv = q.querySelector(".cd-quiz-reveal"); if (rv) rv.style.display = "";
    });
    var res = box.querySelector(".cd-exam-res"); if (res) { res.hidden = true; setHTML(res, ""); }
    box.scrollIntoView({ block: "start" });
  }
  // Темы, по которым сдана итоговая проверка (для дорожки курса).
  function examPassedTopics() {
    var out = {};
    Object.keys(state.exams).forEach(function (k) {
      var r = state.exams[k];
      if (r && r.passed && Array.isArray(r.topics)) r.topics.forEach(function (n) { out[n] = true; });
    });
    return out;
  }
  function fbReveal(btn) {
    var box = btn.closest && btn.closest(".cd-fb"); if (!box) return;
    var ans = box.querySelector(".cd-fb-ans"); if (ans) ans.hidden = false;
    btn.style.display = "none";
  }
  // ---- колода карточек ----
  function deckActive(dk) {
    return Array.prototype.slice.call(dk.querySelectorAll(".cd-dcard")).filter(function (c) { return !c.hasAttribute("data-skip"); });
  }
  function deckGo(dk, pos) {
    var list = deckActive(dk); if (!list.length) return;
    pos = Math.max(0, Math.min(list.length - 1, pos));
    dk.querySelectorAll(".cd-dcard.cur").forEach(function (c) { c.classList.remove("cur"); });
    var card = list[pos]; card.classList.add("cur");
    var id = card.getAttribute("data-i");
    dk.querySelectorAll(".cd-dk-dot").forEach(function (d) { d.classList.toggle("cur", d.getAttribute("data-i") === id); });
    dk.setAttribute("data-pos", String(pos));
    var ps = dk.querySelector(".cd-dk-pos"); if (ps) ps.textContent = (pos + 1) + " из " + list.length;
    var pv = dk.querySelector(".cd-dk-prev"), nx = dk.querySelector(".cd-dk-next");
    if (pv) pv.disabled = pos === 0;
    if (nx) nx.disabled = pos === list.length - 1;
  }
  // Тонкая полоска под точками: сколько карточек этого прохода уже оценено.
  function deckProgress(dk) {
    var list = deckActive(dk), rated = list.filter(function (c) { return c.hasAttribute("data-g"); }).length;
    var bar = dk.querySelector(".cd-dk-prog i"); if (bar) bar.style.width = (list.length ? Math.round(rated / list.length * 100) : 0) + "%";
  }
  function deckShow(dk, on) {   // колода ↔ итог
    ["cd-dk-dots", "cd-dk-prog", "cd-dk-stage", "cd-dk-nav"].forEach(function (c) { var n = dk.querySelector("." + c); if (n) n.hidden = !on; });
    var sum = dk.querySelector(".cd-dk-sum"); if (sum) sum.hidden = on;
  }
  function deckRate(btn) {
    var card = btn.closest(".cd-dcard"), dk = btn.closest(".cd-deck"); if (!card || !dk) return;
    var g = parseInt(btn.getAttribute("data-g"), 10) || 0;
    var ivl = cdSchedule(card.getAttribute("data-id"), g);
    card.setAttribute("data-g", String(g));
    var badge = card.querySelector(".cd-dc-due");
    if (badge) { badge.className = "cd-dc-due lat"; badge.textContent = "повтор " + ivlLabel(ivl); }
    var dot = dk.querySelector('.cd-dk-dot[data-i="' + card.getAttribute("data-i") + '"]');
    if (dot) { dot.classList.remove("g0", "g1", "g2", "st-due", "st-new", "st-later"); dot.classList.add("g" + g); }
    try { recordActivity(); } catch (e) {}
    deckProgress(dk);
    if (g === 2) pulse(dot || btn);
    setTimeout(function () {
      var list = deckActive(dk), pos = list.indexOf(card), next = -1;
      for (var k = 1; k <= list.length && next < 0; k++) { var c = list[(pos + k) % list.length]; if (!c.hasAttribute("data-g")) next = (pos + k) % list.length; }
      if (next < 0) { deckSummary(dk); return; }
      card.classList.remove("flipped");
      deckGo(dk, next);
    }, 420);
  }
  function deckSummary(dk) {
    var list = deckActive(dk), cnt = [0, 0, 0];
    list.forEach(function (c) { cnt[+c.getAttribute("data-g") || 0]++; });
    var weak = cnt[0] + cnt[1], sum = dk.querySelector(".cd-dk-sum");
    setHTML(sum, '<div class="cd-dk-sum-t">' + (weak ? "Колода пройдена" : "Всё помнишь — отлично!") + "</div>" +
      '<div class="cd-dk-sum-row"><span class="g2"><b>' + cnt[2] + '</b>помню</span><span class="g1"><b>' + cnt[1] + "</b>трудно</span>" +
      '<span class="g0"><b>' + cnt[0] + "</b>не помню</span></div>" +
      '<div class="cd-dk-sum-s">Интервалы назначены — карточки сами вернутся в «Разминку», когда придёт время.</div>' +
      '<div class="cd-dk-sum-ctl">' + (weak ? '<button class="cd-dk-again" type="button">Ещё раз трудные (' + weak + ")</button>" : "") +
      '<button class="cd-dk-restart" type="button">Пройти заново</button></div>');
    deckShow(dk, false);
    if (!weak) celebrate(sum.querySelector(".cd-dk-sum-t"));
  }
  function deckRestart(dk, onlyWeak) {
    dk.querySelectorAll(".cd-dcard").forEach(function (c) {
      var g = c.getAttribute("data-g");
      if (onlyWeak && (g === "2" || c.hasAttribute("data-skip"))) c.setAttribute("data-skip", "");
      else c.removeAttribute("data-skip");
      if (!c.hasAttribute("data-skip")) c.removeAttribute("data-g");
      c.classList.remove("flipped");
    });
    dk.querySelectorAll(".cd-dk-dot").forEach(function (d) {
      var c = dk.querySelector('.cd-dcard[data-i="' + d.getAttribute("data-i") + '"]');
      d.classList.toggle("skip", !!(c && c.hasAttribute("data-skip")));
      if (c && !c.hasAttribute("data-skip")) d.classList.remove("g0", "g1", "g2");
    });
    deckShow(dk, true);
    deckProgress(dk);
    deckGo(dk, 0);
  }
  function deckShuffle(dk) {
    var stage = dk.querySelector(".cd-dk-stage"), dotsEl = dk.querySelector(".cd-dk-dots");
    var cards = Array.prototype.slice.call(stage.querySelectorAll(".cd-dcard"));
    for (var i = cards.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = cards[i]; cards[i] = cards[j]; cards[j] = t; }
    cards.forEach(function (c) {
      c.classList.remove("flipped"); stage.appendChild(c);
      var d = dotsEl.querySelector('.cd-dk-dot[data-i="' + c.getAttribute("data-i") + '"]'); if (d) dotsEl.appendChild(d);
    });
    deckGo(dk, 0);
  }
  // #8 Лицевая сторона карточки чуть наклоняется за курсором (глубина без лишнего шума).
  function deckTilt(e) {
    if (state.noAnim) return;
    var f = e.target.closest && e.target.closest(".cd-dcard.cur:not(.flipped) .cd-dc-front");
    if (deckTiltEl && deckTiltEl !== f) { deckTiltEl.style.removeProperty("--tx"); deckTiltEl.style.removeProperty("--ty"); }
    deckTiltEl = f || null;
    if (!f) return;
    var r = f.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    f.style.setProperty("--ty", (x * 7).toFixed(2) + "deg");
    f.style.setProperty("--tx", (-y * 5).toFixed(2) + "deg");
  }
  var deckTiltEl = null;
  // Все клики колоды; true — клик обработан.
  function deckClick(t) {
    var dk = t.closest && t.closest(".cd-deck"); if (!dk) return false;
    var card = t.closest(".cd-dcard");
    if (t.closest(".cd-dk-btn")) { deckRate(t.closest(".cd-dk-btn")); return true; }
    if (t.closest(".cd-dc-hintbtn")) { var h = card && card.querySelector(".cd-dc-hint"); if (h) h.hidden = false; t.closest(".cd-dc-hintbtn").hidden = true; return true; }
    if (t.closest(".cd-dc-unflip")) { if (card) card.classList.remove("flipped"); return true; }
    if (t.closest(".cd-dc-flip") || (card && t.closest(".cd-dc-front") && !t.closest("button, a"))) { if (card) card.classList.add("flipped"); return true; }
    if (t.closest(".cd-dk-dot")) {
      var id = t.closest(".cd-dk-dot").getAttribute("data-i");
      var list = deckActive(dk), idx = -1;
      list.forEach(function (c, k) { if (c.getAttribute("data-i") === id) idx = k; });
      if (idx >= 0) { deckShow(dk, true); deckGo(dk, idx); }
      return true;
    }
    var pos = +(dk.getAttribute("data-pos") || 0);
    if (t.closest(".cd-dk-prev")) { deckGo(dk, pos - 1); return true; }
    if (t.closest(".cd-dk-next")) { deckGo(dk, pos + 1); return true; }
    if (t.closest(".cd-dk-shuffle")) { deckShow(dk, true); deckShuffle(dk); return true; }
    if (t.closest(".cd-dk-again")) { deckRestart(dk, true); return true; }
    if (t.closest(".cd-dk-restart")) { deckRestart(dk, false); return true; }
    return false;
  }
  function fcCheck(btn) {
    var box = btn.closest(".cd-fc"); if (!box) return;
    var ins = box.querySelectorAll(".cd-fc-in"), ok = 0;
    for (var i = 0; i < ins.length; i++) {
      var good = ins[i].value.trim() === (ins[i].getAttribute("data-a") || "").trim();
      ins[i].classList.remove("right", "wrong"); ins[i].classList.add(good ? "right" : "wrong");
      if (good) ok++;
    }
    var msg = box.querySelector(".cd-fc-msg");
    if (msg) msg.textContent = ok === ins.length ? ("Верно, все " + ins.length + "!") : (ok + " из " + ins.length + " — красное поправь");
    if (ok < ins.length) missFill(box);
  }
  function fcReveal(btn) {
    var box = btn.closest(".cd-fc"); if (!box) return;
    missFill(box);
    var ins = box.querySelectorAll(".cd-fc-in");
    for (var i = 0; i < ins.length; i++) { ins[i].value = ins[i].getAttribute("data-a") || ""; ins[i].classList.remove("wrong"); ins[i].classList.add("right"); }
    var msg = box.querySelector(".cd-fc-msg"); if (msg) msg.textContent = "Ответ показан.";
  }
  function testsCopy(btn) {
    var text = btn.getAttribute("data-in") || "";
    function ok() { var p = btn.textContent; btn.textContent = "скопировано"; btn.classList.add("done"); setTimeout(function () { btn.textContent = p; btn.classList.remove("done"); }, 1200); }
    try { navigator.clipboard.writeText(text).then(ok, function () { legacyCopy(text); ok(); }); }
    catch (e) { legacyCopy(text); ok(); }
  }
  // Делегат input-событий статьи: пока только слайдеры «живого примера» (```live).
  function onArticleInput(e) {
    var sl = e.target && e.target.closest && e.target.closest(".cd-live-sl");
    if (sl) { var box = sl.closest(".cd-live"); if (box) liveRecalc(box); }
  }
  function quizClick(e) {
    var t = e.target;
    if (!t || !t.closest) return false;
    var qopt = t.closest(".cd-quiz-opt");
    if (qopt) { e.preventDefault(); quizPick(qopt); return true; }
    var qrev = t.closest(".cd-quiz-reveal");
    if (qrev) { e.preventDefault(); var q = qrev.closest(".cd-quiz-q"); if (q) quizMarkAnswered(q, false); return true; }
    var exAgain = t.closest(".cd-exam-again");
    if (exAgain) { e.preventDefault(); examReset(exAgain); return true; }
    if (bossClick(t)) { e.preventDefault(); return true; }
    if (repeatClick(t, e) || checkpointClick(t)) { e.preventDefault(); return true; }
    var altB = t.closest(".cd-alt-go, .cd-alt-tab");
    if (altB) { e.preventDefault(); altGo(altB); return true; }
    var stb = t.closest(".cd-st-btn");
    if (stb) { e.preventDefault(); stepsClick(stb); return true; }
    if (memClick(t)) { e.preventDefault(); return true; }
    if (framesClick(t)) { e.preventDefault(); return true; }
    var fbrev = t.closest(".cd-fb-reveal");
    if (fbrev) { e.preventDefault(); fbReveal(fbrev); return true; }
    if (deckClick(t)) { e.preventDefault(); return true; }
    var fchk = t.closest(".cd-fc-check");
    if (fchk) { e.preventDefault(); fcCheck(fchk); return true; }
    var frev = t.closest(".cd-fc-reveal");
    if (frev) { e.preventDefault(); fcReveal(frev); return true; }
    var tcopy = t.closest(".cd-tests-copy");
    if (tcopy) { e.preventDefault(); testsCopy(tcopy); return true; }
    var chk = t.closest(".cd-check-item");
    if (chk) { e.preventDefault(); checkToggle(chk); return true; }
    var chItem = t.closest(".cd-ch-item");
    if (chItem) { e.preventDefault(); parsonsPick(chItem); return true; }
    var chCheck = t.closest(".cd-ch-check");
    if (chCheck) { e.preventDefault(); parsonsCheck(chCheck); return true; }
    var chReset = t.closest(".cd-ch-reset");
    if (chReset) { e.preventDefault(); parsonsReset(chReset); return true; }
    var solA = t.closest('a[href="#решения-с-разбором"],a[href="#ответы-с-разбором"]');
    if (solA) {
      var tcard = solA.closest(".cd-taskcard"), th2 = tcard && tcard.querySelector("h2.cd-task");
      var tn = th2 && ((th2.textContent || "").match(/^\s*(\d+\.\d+)/) || [])[1];
      if (tn && openSolution(tn)) { e.preventDefault(); return true; }
    }
    var solBack = t.closest(".cd-sol-back");
    if (solBack) { e.preventDefault(); gotoTask(solBack.getAttribute("data-num")); return true; }
    var lNext = t.closest(".cd-ladder-next");
    if (lNext) { e.preventDefault(); ladderNext(lNext); return true; }
    var hNext = t.closest(".cd-hint-next");
    if (hNext) { e.preventDefault(); hintNext(hNext); return true; }
    var sShow = t.closest(".cd-sol-show");
    if (sShow) { e.preventDefault(); solutionShow(sShow); return true; }
    var prCheck = t.closest(".cd-pr-check");
    if (prCheck) { e.preventDefault(); predictCheck(prCheck); return true; }
    var prReveal = t.closest(".cd-pr-reveal");
    if (prReveal) { e.preventDefault(); predictReveal(prReveal); return true; }
    var runGo = t.closest(".cd-run-go");
    if (runGo) { e.preventDefault(); runChallengeRun(runGo); return true; }
    return false;
  }
  // Отметить ката решённой (прогресс переживает перезапуск; день идёт в «серию»).
  function challengeSolved(box) {
    var id = box.getAttribute("data-id");
    if (id && !state.challenge[id]) { state.challenge[id] = true; try { noteSolvedFirst(box); } catch (e) {} saveState(); try { recordActivity(); } catch (e) {} }
    if (id && state.daily && state.daily.id === id && state.daily.date === cdDate(0) && !state.dailyDone[cdDate(0)]) {
      try { noteDailySolved(box); } catch (e) {}
      state.dailyDone[cdDate(0)] = 1; saveState();
      toast("Задача дня решена! Серия: " + dailyStreak());
    }
    box.classList.add("done");
    try { repeatSolved(box); } catch (e) {}
  }
  // Parsons: клик по строке перекладывает её между «банком» и «решением».
  function parsonsPick(li) {
    var box = li.closest(".cd-ch"); if (!box) return;
    var sol = box.querySelector(".cd-ch-sol"), bank = box.querySelector(".cd-ch-bank");
    li.classList.remove("right", "wrong");
    if (li.parentNode === bank) sol.appendChild(li); else bank.appendChild(li);
    var msg = box.querySelector(".cd-ch-msg"); if (msg) msg.textContent = "";
  }
  function parsonsReset(btn) {
    var box = btn.closest(".cd-ch"); if (!box) return;
    var sol = box.querySelector(".cd-ch-sol"), bank = box.querySelector(".cd-ch-bank");
    var items = [].slice.call(sol.querySelectorAll(".cd-ch-item"));
    items.forEach(function (li) { li.classList.remove("right", "wrong"); bank.appendChild(li); });
    var msg = box.querySelector(".cd-ch-msg"); if (msg) { msg.textContent = ""; msg.className = "cd-ch-msg"; }
  }
  function parsonsCheck(btn) {
    var box = btn.closest(".cd-ch"); if (!box) return;
    var sol = box.querySelector(".cd-ch-sol");
    var got = [].slice.call(sol.querySelectorAll(".cd-ch-item"));
    var want = []; try { want = JSON.parse(decodeURIComponent(box.getAttribute("data-sol") || "[]")); } catch (e) {}
    var msg = box.querySelector(".cd-ch-msg");
    if (!got.length) { if (msg) { msg.textContent = "Сначала собери программу из строк выше."; msg.className = "cd-ch-msg"; } return; }
    var okAll = got.length === want.length, firstBad = -1;
    for (var i = 0; i < got.length; i++) {
      var txt = decodeURIComponent(got[i].getAttribute("data-t") || "");
      var good = txt === want[i];
      got[i].classList.remove("right", "wrong"); got[i].classList.add(good ? "right" : "wrong");
      if (!good && firstBad < 0) firstBad = i + 1;
      if (!good) okAll = false;
    }
    if (okAll) { if (msg) { msg.textContent = "Верно! Программа собрана правильно."; msg.className = "cd-ch-msg ok"; } challengeSolved(box); }
    else if (got.length === want.length) { missParsons(box); noteAttempt(box, false); }   // собрал всё, но не в том порядке
    else if (msg) { msg.textContent = got.length !== want.length ? ("Нужно " + want.length + " " + plural(want.length, ["строка", "строки", "строк"]) + ", а стоит " + got.length + ".") : ("Строка " + firstBad + " не на месте — поправь порядок."); msg.className = "cd-ch-msg err"; }
  }
  // Predict: сверяем введённый вывод с эталоном (построчно, схлопнув лишние пробелы).
  function predictNorm(s) { return String(s).replace(/\r\n?/g, "\n").split("\n").map(function (l) { return l.trim().replace(/\s+/g, " "); }).join("\n").replace(/\n+$/g, ""); }
  function predictCheck(btn) {
    var box = btn.closest(".cd-ch"); if (!box) return;
    var inp = box.querySelector(".cd-pr-in"), msg = box.querySelector(".cd-ch-msg");
    var exp = decodeURIComponent(box.getAttribute("data-exp") || "");
    var good = predictNorm(inp.value) === predictNorm(exp) && inp.value.trim() !== "";
    inp.classList.remove("right", "wrong"); inp.classList.add(good ? "right" : "wrong");
    if (msg) {
      if (good) { msg.textContent = "Верно!"; msg.className = "cd-ch-msg ok"; challengeSolved(box); }
      else { msg.textContent = "Не совпало. Проследи код по шагам и попробуй снова."; msg.className = "cd-ch-msg err"; missPredict(box); noteAttempt(box, false); }
    }
  }
  function predictReveal(btn) {
    var box = btn.closest(".cd-ch"); if (!box) return;
    var inp = box.querySelector(".cd-pr-in"), msg = box.querySelector(".cd-ch-msg");
    var exp = decodeURIComponent(box.getAttribute("data-exp") || "");
    if (inp) { inp.value = exp; inp.classList.remove("wrong"); }
    if (msg) { msg.textContent = "Ответ показан."; msg.className = "cd-ch-msg"; }
    box.__revealed = true; noteHint(box);
    if (!box.classList.contains("done")) missPredict(box);
  }
  // «Напиши и запусти»: код и тесты — запросом к расширению (мост / вкладка / Moon Core), ответ — прогон.
  var _runSeq = 0;
  function runChallengeRun(btn) {
    var box = btn.closest(".cd-ch-run"); if (!box) return;
    var msg = box.querySelector(".cd-ch-msg"), out = box.querySelector(".cd-run-out");
    var ta = box.querySelector(".cd-run-code");
    if (!ta) return;
    var tests = []; try { tests = JSON.parse(decodeURIComponent(box.getAttribute("data-tests") || "[]")); } catch (e) {}
    var id = "r" + Date.now() + "-" + (++_runSeq), mode = box.getAttribute("data-mode") === "contains" ? "contains" : undefined;
    btn.disabled = true;
    if (msg) { msg.textContent = "Компилирую и запускаю…"; msg.className = "cd-ch-msg"; }
    if (out) { out.hidden = true; setHTML(out, ""); }
    setMood(box, "think");
    // Запрос с ответом сразу: у каждой задачи своё ожидание, соседняя его не отменит.
    rpc("run", { id: id, code: ta.value, tests: tests.slice(0, PROTO.MAX_TESTS), mode: mode }, PROTO.RUN_TIMEOUT_MS, function (res) {
      btn.disabled = false;
      if (res) { renderRunResult(box, res); try { noteRunResult(box, res); } catch (e) {} return; }
      setMood(box, "oops");
      if (msg) { msg.textContent = "Нет ответа от расширения. Проверь, что оно активно («Документация C++: проверить плавающее окно»)."; msg.className = "cd-ch-msg err"; }
    });
  }
  // Маскот рядом с результатом запуска: думает, пока идёт сборка; празднует пройденные тесты;
  // сочувствует ошибке. Нет наклейки — место пустое (без заглушек-эмодзи).
  var MOODS = { think: ["mascot-think"], win: ["mascot-win", "mascot-done"], oops: ["mascot-oops", "mascot-think"] };
  var MOOD_TIPS = { think: "Собираю и запускаю…", win: "Получилось!", oops: "Бывает — разберёмся" };
  function setMood(box, mood) {
    var slot = box.querySelector(".cd-mood");
    if (!slot) {
      var msg = box.querySelector(".cd-ch-msg");
      if (!msg || !msg.parentNode) return;
      slot = el("span"); slot.className = "cd-mood"; slot.setAttribute("aria-hidden", "true");
      msg.parentNode.insertBefore(slot, msg);
    }
    var uri = null, names = MOODS[mood] || [];
    for (var i = 0; i < names.length && !uri; i++) uri = STICKERS && STICKERS[names[i]];
    slot.className = "cd-mood m-" + mood;
    slot.title = MOOD_TIPS[mood] || "";
    setHTML(slot, uri ? html`<img src="${uri}" alt="" draggable="false">` : "");
    slot.hidden = !uri;
  }
  function renderRunResult(box, res) {
    var msg = box.querySelector(".cd-ch-msg"), out = box.querySelector(".cd-run-out");
    setMood(box, res.ok ? "win" : (res.stage === "run" && !(res.tests || []).length ? "win" : "oops"));
    if (res.stage === "disabled") { if (msg) { msg.textContent = "Запуск выключен: включи настройку cppDocs.localRun."; msg.className = "cd-ch-msg err"; } return; }
    if (res.stage === "busy") { if (msg) { msg.textContent = "Уже идёт несколько запусков — подожди секунду и нажми ещё раз."; msg.className = "cd-ch-msg err"; } return; }
    if (res.stage === "nocompiler") { if (msg) { msg.textContent = "Компилятор не найден. Укажи путь в настройке cppDocs.compiler (g++/clang++/cl)."; msg.className = "cd-ch-msg err"; } return; }
    if (res.stage === "io") { if (msg) { msg.textContent = "Не удалось запустить: " + (res.error || ""); msg.className = "cd-ch-msg err"; } return; }
    if (res.stage === "compile" || res.stage === "run" && !res.ok) {
      box.setAttribute("data-fails", String((+box.getAttribute("data-fails") || 0) + 1));
      syncSolution(box);
    }
    if (res.stage === "compile") {
      if (msg) { msg.textContent = "Ошибка компиляции:"; msg.className = "cd-ch-msg err"; }
      if (out) { out.hidden = false; setHTML(out, explainHtml(explainCompileError(res.compileError || "")) + '<pre class="cd-run-err"><code>' + escapeHtml(res.compileError || "") + "</code></pre>"); }
      return;
    }
    var tests = res.tests || [], passed = 0, rows = "";
    tests.forEach(function (t) {
      if (t.pass) passed++;
      if (t.skipped) {   // хост остановил прогон: программа зависла или кончилось время
        rows += '<div class="cd-run-t skip"><span class="cd-run-tmark">–</span><span class="cd-run-tin">вход: <code>' +
          testShow(t["in"] == null ? "∅" : t["in"]) + "</code> · не запускался</span></div>";
        return;
      }
      rows += '<div class="cd-run-t ' + (t.pass ? "ok" : "bad") + '"><span class="cd-run-tmark">' + (t.pass ? "✓" : "✗") + "</span>" +
        '<span class="cd-run-tin">вход: <code>' + testShow(t["in"] == null ? "∅" : t["in"]) + "</code></span>" +
        (t.pass ? "" : '<span class="cd-run-tgot">вывод <code>' + testShow(t.got == null ? "" : t.got) +
          '</code> · ждали <code>' + testShow(t.expected == null ? "" : t.expected) + "</code></span>") +
        // программа упала: причина простыми словами + начало stderr (там часто what() исключения)
        (t.crash ? '<span class="cd-run-tcrash">💥 Программа упала: ' + escapeHtml(String(t.crash)) +
          (t.stderr ? '<code>' + escapeHtml(String(t.stderr).slice(0, 300)) + "</code>" : "") + "</span>" : "") + "</div>";
    });
    if (out) { out.hidden = false; setHTML(out, rows || '<div class="cd-run-t ok"><span class="cd-run-tmark">✓</span><span class="cd-run-tin">скомпилировалось без ошибок</span></div>'); }
    if (msg) {
      if (res.ok && tests.length) { msg.textContent = "Все тесты пройдены (" + passed + "/" + tests.length + ")!"; msg.className = "cd-ch-msg ok"; challengeSolved(box); syncSolution(box); }
      else if (tests.length) {
        msg.textContent = "Пройдено " + passed + " из " + tests.length + (res.stopped === "hang"
          ? " — программа зависла (бесконечный цикл?), остальные тесты не запускались."
          : res.stopped ? " — время вышло, остальные тесты не запускались." : " — поправь код и запусти снова.");
        msg.className = "cd-ch-msg err";
      }
      else { msg.textContent = "Скомпилировалось без ошибок."; msg.className = "cd-ch-msg ok"; }
    }
  }
  function checkToggle(btn) {
    var id = btn.getAttribute("data-id"); if (!id) return;
    var on = !btn.classList.contains("on");
    btn.classList.toggle("on", on);
    if (on) state.checks[id] = true; else delete state.checks[id];
    saveState();
  }

  // Чек-бокс списка задач «- [ ] …»: переключаем и красим текст, состояние — в state.checks.
  function taskCheckToggle(btn) {
    var id = btn.getAttribute("data-id"); if (!id) return;
    var on = !btn.classList.contains("on");
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-checked", on ? "true" : "false");
    var txt = btn.parentNode && btn.parentNode.querySelector(".cd-tl-txt");
    if (txt) txt.classList.toggle("done", on);
    if (on) state.checks[id] = true; else delete state.checks[id];
    saveState();
  }

  // Короткая вспышка «✓» на маленькой кнопке (для «#» и копий, где длинный текст не влезает).
  function flashTiny(btn, sym) {
    var prev = btn.textContent;
    btn.textContent = sym || "✓"; btn.classList.add("copied");
    setTimeout(function () { try { btn.textContent = prev; btn.classList.remove("copied"); } catch (e) {} }, 1100);
  }
  function copyText(text, cb) {
    try {
      navigator.clipboard.writeText(text).then(cb, function () { legacyCopy(text); cb(); });
    } catch (e) { legacyCopy(text); cb(); }
  }
  // «#» у заголовка → копирует внутреннюю ссылку вида 07-algoritmy.md#18-алгоритмы.
  function copyHeadingLink(btn) {
    var slug = btn.getAttribute("data-slug");
    if (!slug || !current) return;
    copyText(current.rel + "#" + slug, function () { flashTiny(btn, "✓"); });
  }
  // Кнопка в шапке читалки → копирует весь материал как Markdown-исходник.
  function copyWholeDoc(btn) {
    if (!current) return;
    copyText(current.md || "", function () { flashTiny(btn, "✓"); });
  }

  // «☆» у заголовка → закладка на раздел (ключ rel#slug, значение — чистый текст заголовка).
  function toggleBookmark(btn) {
    var slug = btn.getAttribute("data-slug");
    if (!slug || !current) return;
    var key = current.rel + "#" + slug;
    if (state.marks[key]) {
      delete state.marks[key];
      btn.classList.remove("on"); btn.textContent = "☆"; btn.setAttribute("aria-pressed", "false");
    } else {
      var h = btn.closest ? btn.closest("h2,h3,h4,h5,h6") : btn.parentNode;
      var txt = (h && (h.getAttribute("data-title") || h.textContent)) || slug;
      state.marks[key] = String(txt).replace(/[#☆★\s]+$/, "").trim();
      btn.classList.add("on"); btn.textContent = "★"; btn.setAttribute("aria-pressed", "true");
    }
    saveState();
  }
  // Проставить состояние звёздочек после рендера файла (как decorateTasks для «решено»).
  function syncBookmarks() {
    if (!articleEl || !current) return;
    articleEl.querySelectorAll(".cd-hmark").forEach(function (b) {
      var on = !!state.marks[current.rel + "#" + b.getAttribute("data-slug")];
      b.classList.toggle("on", on);
      b.textContent = on ? "★" : "☆";
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // ------- поиск по тексту открытого материала -------
  // Снять прошлую подсветку: заменяем наши <mark class="cd-find-hit"> обратно на текст.
  function findClear() {
    if (articleEl) {
      var hits = articleEl.querySelectorAll("mark.cd-find-hit");
      for (var i = 0; i < hits.length; i++) {
        var m = hits[i];
        if (m.parentNode) m.parentNode.replaceChild(document.createTextNode(m.textContent), m);
      }
      if (articleEl.normalize) try { articleEl.normalize(); } catch (e) {}   // склеить соседние текст-узлы
    }
    findHits = []; findIdx = -1;
  }
  // Полный сброс (смена файла): убрать подсветку и спрятать панель.
  function findReset() {
    findClear();
    if (findBar) findBar.hidden = true;
    if (findBtn) findBtn.classList.remove("on");
    if (findInput) findInput.value = "";
    updateFindCount();
  }
  function updateFindCount() {
    if (!findCountEl) return;
    findCountEl.textContent = findHits.length ? (findIdx + 1) + "/" + findHits.length : "0";
    findCountEl.classList.toggle("cd-find-none", !findHits.length && !!(findInput && findInput.value));
  }
  // Обойти текст-узлы статьи и обернуть совпадения запроса в <mark class="cd-find-hit">.
  function findRun(q) {
    findClear();
    if (!articleEl) { updateFindCount(); return; }
    var query = norm(String(q || ""));
    if (query.length < 1) { updateFindCount(); return; }
    var nodes = [];
    (function walk(node) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { if (c.nodeValue && c.nodeValue.trim()) nodes.push(c); }
        else if (c.nodeType === 1 && c.tagName !== "MARK" && c.tagName !== "BUTTON") walk(c);
      }
    })(articleEl);
    nodes.forEach(function (tn) {
      var text = tn.nodeValue, low = norm(text), idx = low.indexOf(query);
      if (idx === -1) return;
      var frag = document.createDocumentFragment(), pos = 0;
      while (idx !== -1) {
        if (idx > pos) frag.appendChild(document.createTextNode(text.slice(pos, idx)));
        var m = document.createElement("mark"); m.className = "cd-find-hit";
        m.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(m); findHits.push(m);
        pos = idx + query.length; idx = low.indexOf(query, pos);
      }
      if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
      if (tn.parentNode) tn.parentNode.replaceChild(frag, tn);
    });
    if (findHits.length) findGo(0); else updateFindCount();
  }
  function findGo(i) {
    if (!findHits.length) { updateFindCount(); return; }
    if (i < 0) i = findHits.length - 1; else if (i >= findHits.length) i = 0;
    if (findIdx >= 0 && findHits[findIdx]) findHits[findIdx].classList.remove("cur");
    findIdx = i;
    var m = findHits[findIdx];
    m.classList.add("cur");
    try { m.scrollIntoView({ block: "center" }); } catch (e) {}
    updateFindCount();
  }
  function findStep(dir) { if (findHits.length) findGo(findIdx + dir); }
  function toggleFind(force) {
    if (!findBar) return;
    var show = (typeof force === "boolean") ? force : findBar.hidden;
    findBar.hidden = !show;
    if (findBtn) findBtn.classList.toggle("on", show);
    if (show) { findInput.focus(); findInput.select(); if (findInput.value) findRun(findInput.value); }
    else { findClear(); updateFindCount(); }
  }

  function onArticleClick(e) {
    var stub = e.target.closest && e.target.closest(".cd-taskstub");
    if (stub) { e.preventDefault(); e.stopPropagation(); sendTaskStub(stub); return; }
    var solve = e.target.closest && e.target.closest(".cd-solve");
    if (solve) { e.preventDefault(); e.stopPropagation(); toggleSolved(solve); return; }
    var hmark = e.target.closest && e.target.closest(".cd-hmark");
    if (hmark) { e.preventDefault(); e.stopPropagation(); toggleBookmark(hmark); return; }
    var hlink = e.target.closest && e.target.closest(".cd-hlink");
    if (hlink) { e.preventDefault(); e.stopPropagation(); copyHeadingLink(hlink); return; }
    var tl = e.target.closest && e.target.closest(".cd-tl-box");
    if (tl) { e.preventDefault(); e.stopPropagation(); taskCheckToggle(tl); return; }
    var exMore = e.target.closest && e.target.closest(".cd-ex-more");
    if (exMore) { e.preventDefault(); openFile(exMore.getAttribute("data-rel"), exMore.getAttribute("data-hash") || undefined); return; }
    var toed = e.target.closest && e.target.closest(".cd-toed");
    if (toed) { e.preventDefault(); sendToEditor(toed); return; }
    var copy = e.target.closest && e.target.closest(".copybtn");
    if (copy) { doCopy(copy); return; }
    var wrapB = e.target.closest && e.target.closest(".cd-wrapbtn");
    if (wrapB) { e.preventDefault(); state.codeWrap = !state.codeWrap; saveState(); applyReaderPrefs(); return; }
    var see = e.target.closest && e.target.closest(".cd-see");
    if (see) { e.preventDefault(); openInTab(see.getAttribute("data-rel"), null, e.ctrlKey || e.metaKey); return; }
    var hlu = e.target.closest && e.target.closest(".cd-hlu");
    if (hlu) { e.preventDefault(); removeHighlight(hlu); return; }
    if (quizClick(e)) return;
    if (gamesClick(e)) return;                     // сундуки, волна поиска пути
    // клик по строке таблицы «Задачи темы» — переход к самой задаче
    var taskRow = e.target.closest && e.target.closest("tr.cd-taskrow");
    if (taskRow && !e.target.closest("a[href]")) { gotoTask(taskRow.getAttribute("data-num")); return; }
    // клик по строке таблицы сниппетов — развернуть/свернуть код под ней
    var snipRow = e.target.closest && e.target.closest("tr.cd-snip");
    if (snipRow && !e.target.closest("a[href]")) {
      var codeRow = snipRow.nextElementSibling;
      if (codeRow && codeRow.classList.contains("cd-snip-code")) {
        var closed = codeRow.hasAttribute("hidden");
        if (closed) codeRow.removeAttribute("hidden"); else codeRow.setAttribute("hidden", "");
        snipRow.classList.toggle("cd-open", closed);
      }
      return;
    }
    // клик по заголовку раздела (не по его кнопкам/ссылкам) — свернуть/развернуть
    var foldH = e.target.closest && e.target.closest("h2.cd-foldable");
    if (foldH && !(e.target.closest("a[href]") || e.target.closest("button"))) {
      setFold(foldH, !foldH.classList.contains("cd-sec-folded")); return;
    }
    var a = e.target.closest && e.target.closest("a[href]");
    if (a) {
      var href = a.getAttribute("href");
      if (/^(https?|mailto):/i.test(href)) { e.preventDefault(); openExternalLink(href); return; } // внешняя — во внешний браузер, не в фрейм
      e.preventDefault();
      if (href.charAt(0) === "#") { openFile(current.rel, href); return; }  // якорь той же страницы — та же вкладка
      var res = resolveRel(current.rel, href);
      var map = fileMap();
      if (/\.md$/i.test(res.rel) && map[res.rel.toLowerCase()]) openInTab(res.rel, res.hash, e.ctrlKey || e.metaKey);
    }
  }
  function flashCopy(btn) {
    var prev = btn.textContent;
    btn.textContent = "скопировано ✓"; btn.classList.add("done");
    var cw = btn.closest && btn.closest(".codewrap");
    if (cw) { cw.classList.remove("cd-copied"); void cw.offsetWidth; cw.classList.add("cd-copied"); }
    setTimeout(function () { btn.textContent = prev; btn.classList.remove("done"); }, 1300);
  }
  function legacyCopy(text) {
    try {
      var ta = el("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    } catch (e) {}
  }
  // Внешняя ссылка: default-навигация увела бы весь workbench-фрейм на URL. Гасим её и открываем
  // через window.open — VS Code перехватит и откроет во внешнем браузере, редактор цел.
  function openExternalLink(href) {
    try { window.open(href, "_blank", "noopener"); } catch (e) {}
  }

  // ------- клавиатура -------
  // Esc — только когда фокус внутри окна: обработчик висит на document (фаза перехвата), и без
  // этой проверки Esc в редакторе (закрыть подсказку/поиск VS Code) закрывал бы окно документации.
  function focusInside(win, t, ae) {
    if (!win) return false;
    return !!((t && t.nodeType === 1 && win.contains(t)) || (ae && ae !== document.body && win.contains(ae)));
  }
  function onKey(e) {
    if (isOpen() && altKey(e)) return;                     // ← → листают применения примера
    if (!isOpen() || e.key !== "Escape") return;
    if (!focusInside(winEl, e.target, document.activeElement)) return;
    if (progressOpen()) { e.stopPropagation(); hideProgress(); return; }                 // окно «Прогресс»
    if (guideEl && !guideEl.hidden) { e.stopPropagation(); hideGuide(); return; }        // сперва закрываем руководство
    if (viewMenu && !viewMenu.hidden) { viewMenu.hidden = true; return; }
    if (edPopEl && !edPopEl.hidden) { edPopEl.hidden = true; return; }
    if (findBar && !findBar.hidden) { e.stopPropagation(); toggleFind(false); return; }  // затем поиск, не окно
    closeWindow();
  }

