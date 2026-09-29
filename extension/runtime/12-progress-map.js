  // ==== runtime/12-progress-map.js — освоение тем, карта знаний, слабые места, экзамен недели ====
  // ---------------------------------------------------------------------------
  //  Темы справочника как граф: у каждой ref/*.md в шапке есть строка «**Опирается на:** [..](..)» —
  //  из неё берутся связи. Освоение темы (0–100) складывается из того, что ученик реально сделал:
  //  отметка «Изучено», прочитанные разделы, крепость карточек, решённые задания и задачи, босс,
  //  итоговая проверка; ошибки в разборах, ещё не отработанные, немного снижают оценку.
  // ---------------------------------------------------------------------------
  var _topics = { sig: "", list: [] };
  function shortTitle(f) { return String(f.title || f.name || "").replace(/`/g, "").split(/[:(—]/)[0].trim(); }
  // Все ```-блоки нужного вида в Markdown → тела блоков.
  function fenceBodies(md, kind) {
    var out = [], re = new RegExp("^```+[ \\t]*" + kind + "[^\\n]*\\n([\\s\\S]*?)\\n```+[ \\t]*$", "gim"), m;
    md = String(md || "").replace(/\r\n?/g, "\n");
    while ((m = re.exec(md))) out.push(m[1]);
    return out;
  }
  // Ключ босса — тот же, что у renderBoss: «@id» или хэш от «boss:<название>».
  function bossIdOf(src) {
    var raw = String(src).replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, ""), title = "Итоговое задание";
    var m = raw.match(/^#\s+(.*)\n?/);
    if (m) { title = m[1].trim(); raw = raw.slice(m[0].length); }
    return fenceKey(raw, function () { return "boss:" + title; }).id;
  }
  function progressTopics() {
    var d = DATA(); if (!d || d.lazy) return [];
    var sig = d.generatedAt + ":" + d.files.length;
    if (_topics.sig === sig) return _topics.list;
    var list = [], byRel = {};
    d.files.forEach(function (f) {
      if (!/^ref\//i.test(f.rel)) return;
      var head = String(f.md || "").slice(0, 4000);
      var m = head.match(/\*\*Опирается на:\*\*([^\n]*)/);
      if (!m) return;                                       // словари и справка — не темы курса
      var deps = [], re = /\]\(([^)#\s]+\.md)/g, x;
      while ((x = re.exec(m[1]))) deps.push(resolveRel(f.rel, x[1]).rel.toLowerCase());
      var lv = head.match(/\*\*Уровень:\*\*([^\n·]*)/);
      // метки уровня в доках — красный/жёлтый кружок (U+1F534 / U+1F7E1)
      var level = lv && /🔴/.test(lv[1]) ? 3 : lv && /🟡/.test(lv[1]) ? 2 : 1;
      var t = { rel: f.rel, f: f, deps: deps, level: level, n: topicNum(f.rel), short: shortTitle(f), cards: [], ch: [], boss: [], tasks: [] };
      list.push(t); byRel[f.rel.toLowerCase()] = t;
    });
    list.forEach(function (t) {
      t.deps = t.deps.filter(function (r) { return byRel[r] && byRel[r] !== t; }).map(function (r) { return byRel[r].rel; });
    });
    // Глубина = самый длинный путь от корня (колонка на карте). Цикл в ссылках не зациклит расчёт.
    var depth = {};
    function dep(t, seen) {
      if (depth[t.rel] !== undefined) return depth[t.rel];
      if (seen[t.rel]) return 0;
      seen[t.rel] = 1;
      var v = 0;
      t.deps.forEach(function (r) { v = Math.max(v, dep(byRel[r.toLowerCase()], seen) + 1); });
      depth[t.rel] = v;
      return v;
    }
    list.forEach(function (t) { t.depth = dep(t, {}); });
    // Что в теме можно «сделать»: карточки, задания, боссы — и задачи задачника той же темы.
    collectAllCards().forEach(function (c) { var t = byRel[String(c.rel).toLowerCase()]; if (t && t.cards.indexOf(c.id) === -1) t.cards.push(c.id); });
    collectChallenges().forEach(function (c) { var t = byRel[String(c.rel).toLowerCase()]; if (t) t.ch.push(c.id); });
    list.forEach(function (t) { fenceBodies(t.f.md, "boss").forEach(function (b) { t.boss.push(bossIdOf(b)); }); });
    collectTasks(false).forEach(function (k) {
      var base = String(k.rel).toLowerCase().split("/").pop();
      list.forEach(function (t) { if (String(t.rel).toLowerCase().split("/").pop() === base) t.tasks.push(k.key); });
    });
    list.sort(function (a, b) { return a.depth - b.depth || a.n - b.n; });
    _topics = { sig: sig, list: list };
    return list;
  }
  function topicByRel(rel) {
    var l = progressTopics(), r = String(rel || "").toLowerCase();
    for (var i = 0; i < l.length; i++) if (l[i].rel.toLowerCase() === r) return l[i];
    return null;
  }
  function missedIn(rel) {
    var n = 0;
    Object.keys(state.missed).forEach(function (k) { var m = state.missed[k]; if (m && m.rel === rel) n++; });
    return n;
  }
  // Карточка «крепкая», когда интервал повторения дорос до двух недель.
  function cardStrength(id) { var r = state.cards[id]; return r && r.ivl ? Math.min(1, r.ivl / 14) : 0; }
  // Освоение темы: { pct, parts: [[название, доля 0..1]], miss }.
  function topicMastery(t) {
    var parts = [], rel = t.rel;
    function add(name, v, w) { parts.push([name, Math.max(0, Math.min(1, v)), w]); }
    add("отмечена «Изучено»", state.read[rel] ? 1 : 0, 3);
    if (t.f.sections) add("прочитано разделов", Object.keys(state.secSeen[rel] || {}).length / t.f.sections, 1);
    if (t.cards.length) add("крепость карточек", t.cards.reduce(function (s, id) { return s + cardStrength(id); }, 0) / t.cards.length, 3);
    if (t.ch.length) add("решено заданий", t.ch.filter(function (id) { return state.challenge[id]; }).length / t.ch.length, 2);
    if (t.tasks.length) add("решено задач задачника", t.tasks.filter(function (k) { return state.solved[k]; }).length / t.tasks.length, 2);
    if (t.boss.length) add("босс темы", t.boss.filter(function (id) { return state.boss[id]; }).length / t.boss.length, 2);
    if (examPassedTopics()[t.n] && t.n) add("итоговая проверка", 1, 1);
    var v = 0, w = 0;
    parts.forEach(function (p) { v += p[1] * p[2]; w += p[2]; });
    var miss = missedIn(rel);
    var pct = w ? Math.round(Math.max(0, v / w - Math.min(0.2, miss * 0.05)) * 100) : 0;
    return { pct: pct, parts: parts, miss: miss };
  }
  function masteryPct(t) { return topicMastery(t).pct; }
  // Тема «открыта», когда её опоры освоены хотя бы на 40 % (или она уже начата сама).
  var UNLOCK_AT = 40;
  function topicUnlocked(t) {
    if (!t.deps.length || state.read[t.rel] || masteryPct(t) > 0) return true;
    return t.deps.every(function (r) { var d = topicByRel(r); return !d || state.read[d.rel] || masteryPct(d) >= UNLOCK_AT; });
  }
  function masteryTone(p) { return p >= 80 ? "m4" : p >= 60 ? "m3" : p >= 35 ? "m2" : p > 0 ? "m1" : "m0"; }

  // ---- Слабые места: начатые темы с низким освоением и конкретный следующий шаг ----
  function weakSpots(limit) {
    var recent = state.recent || [];
    var out = progressTopics().map(function (t) {
      var m = topicMastery(t);
      var started = state.read[t.rel] || m.pct > 0 || recent.indexOf(t.rel) !== -1;
      return { t: t, m: m, started: started };
    }).filter(function (x) { return x.started && x.m.pct < 60; });
    out.sort(function (a, b) { return a.m.pct - b.m.pct; });
    return out.slice(0, limit || 3).map(function (x) { x.act = weakAction(x.t, x.m); return x; });
  }
  // Что сделать с темой прямо сейчас — самое полезное из доступного.
  function weakAction(t, m) {
    var due = t.cards.filter(function (id) { var s = cdCardState(id).status; return s === "due"; }).length;
    var weakCards = t.cards.filter(function (id) { return cardStrength(id) < 0.5; }).length;
    if (due) return { kind: "cards", label: "Повторить карточки темы · " + due, why: due + " " + plural(due, ["карточка ждёт", "карточки ждут", "карточек ждут"]) + " повторения" };
    if (m.miss) return { kind: "miss", label: "Разобрать ошибки · " + m.miss, why: "ошибки в разборах этой темы ещё не отработаны" };
    var sec = nextSection(t.f);
    if (!state.read[t.rel] && sec) return { kind: "read", label: "Дочитать: «" + sec.text + "»", hash: sec.slug, why: "тема не дочитана" };
    var ch = t.ch.filter(function (id) { return !state.challenge[id]; });
    if (ch.length) return { kind: "task", label: "Решить задание темы", id: ch[0], why: "задания темы не решены" };
    if (weakCards) return { kind: "cards", label: "Закрепить карточки · " + weakCards, why: "карточки ещё не окрепли" };
    return { kind: "read", label: "Перечитать тему", hash: "", why: "освоение пока ниже 60 %" };
  }
  function runWeakAction(rel, kind, extra) {
    var t = topicByRel(rel); if (!t) return;
    hideProgress();
    if (kind === "cards") { startTopicReview(t); return; }
    if (kind === "miss") { startWarmup(); return; }
    if (kind === "task" && extra) {
      openFile(t.rel);
      setTimeout(function () {
        var box = articleEl && articleEl.querySelector('[data-id="' + cssEscape(extra) + '"]');
        if (box) { unfoldContaining(box); box.scrollIntoView({ block: "center", behavior: "smooth" }); }
      }, 120);
      return;
    }
    openFile(t.rel, extra ? "#" + extra : undefined);
  }
  // Повторение только по одной теме: сперва «пора», потом слабые, потом новые (в пределах лимита дня).
  function startTopicReview(t) {
    var all = collectAllCards().filter(function (c) { return t.cards.indexOf(c.id) !== -1; }), seen = {}, due = [], weak = [], neu = [];
    all.forEach(function (c) {
      if (seen[c.id]) return; seen[c.id] = 1;
      var s = cdCardState(c.id).status;
      if (s === "due") due.push(c); else if (s === "new") neu.push(c); else if (cardStrength(c.id) < 0.5) weak.push(c);
    });
    reviewQueue = due.concat(weak, neu.slice(0, Math.max(3, newLeftToday()))).slice(0, 20);
    resetReviewSession(false);
    if (!reviewQueue.length) { openFile(t.rel); return; }
    showReview();
  }
  function weakHomeHtml() {
    var ws = []; try { ws = weakSpots(3); } catch (e) {}
    if (!ws.length) return "";
    return '<div class="cd-weak"><div class="cd-weak-h">Слабые места<span>что подтянуть</span></div>' + ws.map(function (x) {
      return '<div class="cd-weak-row"><div class="cd-weak-main"><b>' + escapeHtml(x.t.short) + "</b>" +
        '<span class="cd-mbar ' + masteryTone(x.m.pct) + '"><i style="width:' + x.m.pct + '%"></i></span><em>' + x.m.pct + "%</em>" +
        '<small>' + escapeHtml(x.act.why) + "</small></div>" +
        '<button class="cd-weak-go" type="button" data-wrel="' + escapeHtml(x.t.rel) + '" data-wk="' + x.act.kind + '" data-wx="' +
        escapeHtml(x.act.hash || x.act.id || "") + '">' + escapeHtml(x.act.label) + " →</button></div>";
    }).join("") + "</div>";
  }

  // ---- Карта знаний (SVG): колонки — глубина по «Опирается на», цвет — освоение ----
  function knowledgeMapHtml() {
    var list = progressTopics();
    if (list.length < 2) return '<p class="cd-pg-empty">Карта появится, когда загрузятся материалы справочника.</p>';
    var cols = {};
    list.forEach(function (t) { (cols[t.depth] = cols[t.depth] || []).push(t); });
    var depths = Object.keys(cols).map(Number).sort(function (a, b) { return a - b; });
    var maxRows = Math.max.apply(null, depths.map(function (k) { return cols[k].length; }));
    var CW = 128, RH = 62, W = depths.length * CW + 20, H = maxRows * RH + 30, pos = {};
    depths.forEach(function (k, ci) {
      var col = cols[k], off = (maxRows - col.length) * RH / 2;
      col.forEach(function (t, ri) { pos[t.rel] = { x: 20 + ci * CW + 40, y: 26 + off + ri * RH }; });
    });
    var next = null;
    for (var i = 0; i < list.length && !next; i++) if (!state.read[list[i].rel] && topicUnlocked(list[i])) next = list[i];
    var edges = "", nodes = "";
    list.forEach(function (t) {
      var p = pos[t.rel];
      t.deps.forEach(function (r) {
        var q = pos[r]; if (!q) return;
        var mx = (q.x + p.x) / 2;
        edges += '<path class="cd-km-e' + (state.read[r] || masteryPct(topicByRel(r)) >= UNLOCK_AT ? " on" : "") + '" d="M' + (q.x + 13) + " " + q.y + " C" + mx + " " + q.y + " " + mx + " " + p.y + " " + (p.x - 13) + " " + p.y + '"/>';
      });
    });
    list.forEach(function (t) {
      var p = pos[t.rel], pct = masteryPct(t), open = topicUnlocked(t);
      var C = 2 * Math.PI * 15, off = C * (1 - pct / 100);
      var label = t.short.length > 16 ? t.short.slice(0, 15) + "…" : t.short;
      nodes += '<g class="cd-km-n ' + masteryTone(pct) + (open ? "" : " lock") + (t === next ? " next" : "") + '" data-krel="' + escapeHtml(t.rel) + '" tabindex="0" role="button">' +
        "<title>" + escapeHtml(t.f.title || t.short) + " — освоено " + pct + "%" + (open ? "" : " · сначала опоры: " + t.deps.map(function (r) { var d = topicByRel(r); return d ? d.short : r; }).join(", ")) + "</title>" +
        '<circle class="cd-km-bg" cx="' + p.x + '" cy="' + p.y + '" r="15"/>' +
        '<circle class="cd-km-fg" cx="' + p.x + '" cy="' + p.y + '" r="15" style="stroke-dasharray:' + C.toFixed(1) + ";stroke-dashoffset:" + off.toFixed(1) + '" transform="rotate(-90 ' + p.x + " " + p.y + ')"/>' +
        '<text class="cd-km-num" x="' + p.x + '" y="' + (p.y + 4) + '">' + (t.n || "•") + "</text>" +
        '<text class="cd-km-t" x="' + p.x + '" y="' + (p.y + 30) + '">' + escapeHtml(label) + "</text></g>";
    });
    var masteredN = list.filter(function (t) { return masteryPct(t) >= 80; }).length;
    var avg = Math.round(list.reduce(function (s, t) { return s + masteryPct(t); }, 0) / list.length);
    return '<div class="cd-km-sum"><span><b>' + masteredN + "</b> из " + list.length + " тем освоено на 80 %+</span><span>среднее освоение <b>" + avg + "%</b></span>" +
      (next ? '<button class="cd-km-next" type="button" data-krel="' + escapeHtml(next.rel) + '">Дальше: ' + escapeHtml(next.short) + " →</button>" : "") + "</div>" +
      '<div class="cd-km-wrap"><svg class="cd-km" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" aria-label="Карта знаний">' + edges + nodes + "</svg></div>" +
      '<div class="cd-km-legend"><span class="m0">не начата</span><span class="m1">начата</span><span class="m2">35 %+</span><span class="m3">60 %+</span><span class="m4">освоена</span><span class="lock">бледная — сначала опоры: изучить или освоить на ' + UNLOCK_AT + " %</span></div>" +
      '<div class="cd-km-detail" hidden></div>';
  }
  function kmDetailHtml(rel) {
    var t = topicByRel(rel); if (!t) return "";
    var m = topicMastery(t), act = weakAction(t, m);
    return '<div class="cd-kd-h"><b>' + escapeHtml(t.f.title || t.short) + '</b><span class="cd-mbar ' + masteryTone(m.pct) + '"><i style="width:' + m.pct + '%"></i></span><em>' + m.pct + "%</em></div>" +
      '<ul class="cd-kd-parts">' + m.parts.map(function (p) {
        return "<li><span>" + escapeHtml(p[0]) + '</span><span class="cd-mbar sm"><i style="width:' + Math.round(p[1] * 100) + '%"></i></span><em>' + Math.round(p[1] * 100) + "%</em></li>";
      }).join("") + (m.miss ? '<li class="bad"><span>неотработанных ошибок</span><em>' + m.miss + "</em></li>" : "") + "</ul>" +
      (t.deps.length ? '<div class="cd-kd-deps">Опирается на: ' + t.deps.map(function (r) { var d = topicByRel(r); return d ? escapeHtml(d.short) + " (" + masteryPct(d) + "%)" : ""; }).join(", ") + "</div>" : "") +
      '<div class="cd-kd-btns"><button class="cd-weak-go" type="button" data-wrel="' + escapeHtml(t.rel) + '" data-wk="' + act.kind + '" data-wx="' + escapeHtml(act.hash || act.id || "") + '">' + escapeHtml(act.label) + " →</button>" +
      '<button class="cd-kd-open" type="button" data-krel2="' + escapeHtml(t.rel) + '">Открыть тему</button></div>';
  }

  // ---- Экзамен недели: 10 вопросов из слабых тем, 10 минут, первый ответ засчитывается ----
  var WEEKLY_N = 10, WEEKLY_MS = 10 * 60000;
  function weekKey(dt) {
    var d = new Date(dt || Date.now()); d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);                // четверг этой недели (ISO)
    var y = d.getFullYear(), jan4 = new Date(y, 0, 4, 12);
    var w = 1 + Math.round(((d - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7);
    return y + "-W" + (w < 10 ? "0" + w : w);
  }
  // Вопросы ```quiz темы: { q, opts: [{ok, text}], expl, rel }.
  function quizQuestionsOf(f) {
    var out = [];
    fenceBodies(f.md, "quiz").forEach(function (src) {
      var lines = String(src).split("\n");
      if (/^@exam\s/.test((lines[0] || "").trim())) lines.shift();
      var cur = null;
      function flush() { if (cur && cur.opts.length > 1 && cur.opts.some(function (o) { return o.ok; })) out.push(cur); cur = null; }
      lines.forEach(function (ln) {
        var t = ln.trim();
        var mq = t.match(/^(?:В|Q|Вопрос)\s*[:.)]\s*(.*)$/i);
        if (mq) { flush(); cur = { q: mq[1], opts: [], expl: "", rel: f.rel }; return; }
        if (!cur) { if (t) cur = { q: t, opts: [], expl: "", rel: f.rel }; return; }
        var mo = t.match(/^([+\-])\s+(.*)$/);
        if (mo) { cur.opts.push({ ok: mo[1] === "+", text: mo[2] }); return; }
        var me = t.match(/^[=>]\s+(.*)$/);
        if (me) { cur.expl += (cur.expl ? " " : "") + me[1]; return; }
        if (t && !cur.opts.length) cur.q += " " + t;
      });
      flush();
    });
    return out;
  }
  function buildWeeklyExam() {
    var wk = weekKey(), rnd = seededRand("weekly:" + wk);
    var topics = progressTopics().map(function (t) { return { t: t, p: masteryPct(t), qs: quizQuestionsOf(t.f) }; })
      .filter(function (x) { return x.qs.length; });
    var started = topics.filter(function (x) { return state.read[x.t.rel] || x.p > 0; });
    var pool = (started.length ? started : topics.slice(0, 3)).sort(function (a, b) { return a.p - b.p; });
    // Слабые темы — первыми и почаще: круговой отбор по отсортированному списку.
    pool.forEach(function (x) {
      for (var i = x.qs.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), tmp = x.qs[i]; x.qs[i] = x.qs[j]; x.qs[j] = tmp; }
    });
    var out = [], round = 0;
    while (out.length < WEEKLY_N && round < 20) {
      var took = false;
      for (var k = 0; k < pool.length && out.length < WEEKLY_N; k++) {
        if (round < pool[k].qs.length && (k < 3 || round < 2)) { out.push(pool[k].qs[round]); took = true; }
      }
      if (!took) break;
      round++;
    }
    if (out.length < WEEKLY_N) {
      topics.forEach(function (x) { x.qs.forEach(function (q) { if (out.length < WEEKLY_N && out.indexOf(q) === -1) out.push(q); }); });
    }
    out.forEach(function (q) {                                   // варианты — в своём порядке на эту неделю
      for (var i = q.opts.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), tmp = q.opts[i]; q.opts[i] = q.opts[j]; q.opts[j] = tmp; }
    });
    return { wk: wk, qs: out };
  }
  var weekly = null;   // идущий экзамен: { wk, qs, i, right, answers, t0, timer }
  function weeklyBest() { var r = state.weekly[weekKey()]; return r && typeof r.best === "number" ? r : null; }
  function weeklyHomeHtml() {
    var r = weeklyBest(), prog = progressTopics();
    if (!prog.length || !prog.some(function (t) { return quizQuestionsOf(t.f).length; })) return "";
    return '<div class="cd-home-warm cd-weekly' + (r ? " done" : "") + '" role="button" tabindex="0"><span class="cd-hw-ic">' + emo("icon-route", "") + "</span>" +
      '<div class="cd-hc-main"><div class="cd-hc-lbl">Экзамен недели' + (r ? " · сдан" : "") + "</div>" +
      '<div class="cd-hc-title">' + (r ? "Лучший результат: " + r.best + " из " + r.total : WEEKLY_N + " вопросов из слабых тем · 10 минут") + "</div>" +
      '<div class="cd-hc-meta">' + (r ? "можно пересдать — засчитается лучший" : "первый ответ на вопрос засчитывается, ошибки вернутся в разминку") + "</div></div>" +
      '<div class="cd-hc-arrow">→</div></div>';
  }
  function weeklyIntroHtml() {
    var ex = buildWeeklyExam(), r = weeklyBest(), rels = {};
    ex.qs.forEach(function (q) { rels[q.rel] = 1; });
    var names = Object.keys(rels).map(function (rel) { var t = topicByRel(rel); return t ? t.short : rel; });
    if (!ex.qs.length) return '<p class="cd-pg-empty">Нет вопросов для экзамена: в темах пока нет блоков «Проверь себя».</p>';
    var hist = Object.keys(state.weekly).sort().reverse().slice(0, 6).map(function (k) {
      var h = state.weekly[k]; return "<li><span>" + escapeHtml(k.replace("-W", ", неделя ")) + "</span><b>" + h.best + " / " + h.total + "</b></li>";
    }).join("");
    return '<div class="cd-wk-intro"><p>' + ex.qs.length + " " + plural(ex.qs.length, ["вопрос", "вопроса", "вопросов"]) + " на " + (WEEKLY_MS / 60000) +
      " минут. Темы этой недели: <b>" + escapeHtml(names.join(", ")) + "</b> — сначала самые слабые.</p>" +
      "<p>Засчитывается первый ответ. Вопросы, где ошибёшься, придут в «Разминку дня».</p>" +
      (r ? '<p class="cd-wk-best">На этой неделе лучший результат: <b>' + r.best + " из " + r.total + "</b></p>" : "") +
      '<button class="cd-wk-start" type="button">' + (r ? "Пересдать" : "Начать экзамен") + "</button>" +
      (hist ? '<div class="cd-wk-hist"><div>Прошлые недели</div><ul>' + hist + "</ul></div>" : "") + "</div>";
  }
  function weeklyStart() {
    var ex = buildWeeklyExam(); if (!ex.qs.length) return;
    weeklyStop();
    weekly = { wk: ex.wk, qs: ex.qs, i: 0, right: 0, answers: [], t0: Date.now(), timer: null };
    weeklyArm();
    renderWeekly();
  }
  function weeklyArm() { if (weekly && !weekly.done) weekly.timer = setTimeout(function () { weeklyTick(); weeklyArm(); }, 1000); }
  function weeklyStop() { if (weekly && weekly.timer) clearTimeout(weekly.timer); if (weekly) weekly.timer = null; }
  function weeklyLeft() { return weekly ? Math.max(0, WEEKLY_MS - (Date.now() - weekly.t0)) : 0; }
  function mmss(ms) { var s = Math.round(ms / 1000); return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
  function weeklyTick() {
    if (!weekly || weekly.done) { weeklyStop(); return; }
    var tEl = progressEl && progressEl.querySelector(".cd-wk-timer");
    if (tEl) tEl.textContent = mmss(weeklyLeft());
    if (weeklyLeft() <= 0) weeklyFinish(true);
  }
  function renderWeekly() {
    var box = progressEl && progressEl.querySelector('.cd-pg-page[data-pg="weekly"]'); if (!box || !weekly) return;
    if (weekly.done) { setHTML(box, weeklyResultHtml()); return; }
    var q = weekly.qs[weekly.i], a = weekly.answers[weekly.i], t = topicByRel(q.rel);
    var opts = q.opts.map(function (o, k) {
      var cls = a == null ? "" : (o.ok ? " right" : (a === k ? " wrong" : ""));
      return '<button class="cd-wk-opt' + cls + '" type="button" data-k="' + k + '"' + (a == null ? "" : " disabled") + ">" + inline(o.text) + "</button>";
    }).join("");
    setHTML(box, '<div class="cd-wk-top"><span>Вопрос ' + (weekly.i + 1) + " из " + weekly.qs.length + '</span><span class="cd-wk-score">верно ' + weekly.right + "</span>" +
      '<span class="cd-wk-timer">' + mmss(weeklyLeft()) + "</span></div>" +
      '<div class="cd-wk-q"><div class="cd-wk-from">' + escapeHtml(t ? t.short : q.rel) + "</div>" + inline(q.q) + "</div>" +
      '<div class="cd-wk-opts">' + opts + "</div>" +
      (a != null && q.expl ? '<div class="cd-wk-expl">' + inline(q.expl) + "</div>" : "") +
      '<div class="cd-wk-ctl">' + (a != null ? '<button class="cd-wk-next" type="button">' + (weekly.i + 1 < weekly.qs.length ? "Дальше →" : "Итог") + "</button>" : "") +
      '<button class="cd-wk-quit" type="button">Сдать досрочно</button></div>');
  }
  function weeklyAnswer(k) {
    if (!weekly || weekly.done || weekly.answers[weekly.i] != null) return;
    var q = weekly.qs[weekly.i];
    weekly.answers[weekly.i] = k;
    if (q.opts[k] && q.opts[k].ok) weekly.right++;
    else {
      // ошибка → в «Разминку дня» (как и в обычных опросах)
      var right = q.opts.filter(function (o) { return o.ok; }).map(function (o) { return o.text; }).join("; ");
      state.missed["quiz:" + cdHash(q.q)] = { rel: q.rel, hash: "", q: String(q.q).slice(0, 4000), a: (right + (q.expl ? " — " + q.expl : "")).slice(0, 4000), due: cdDate(1), kind: "quiz", md: 0 };
    }
    renderWeekly();
  }
  function weeklyFinish(timeout) {
    if (!weekly || weekly.done) return;
    weeklyStop();
    weekly.done = true; weekly.timeout = !!timeout; weekly.ms = Date.now() - weekly.t0;
    var prev = state.weekly[weekly.wk] || {};
    state.weekly[weekly.wk] = { best: Math.max(prev.best || 0, weekly.right), total: weekly.qs.length, ms: weekly.ms, tries: (prev.tries || 0) + 1, at: Date.now() };
    keepLast(state.weekly, 104);
    bumpCount("weekly");
    if (weekly.right === weekly.qs.length) bumpCount("weeklyPerfect");
    recordActivity(); saveState();
    renderWeekly();
  }
  function weeklyResultHtml() {
    var w = weekly, n = w.qs.length, pct = n ? Math.round(w.right / n * 100) : 0, by = {};
    w.qs.forEach(function (q, i) {
      var r = by[q.rel] || (by[q.rel] = { ok: 0, n: 0 });
      r.n++; if (w.answers[i] != null && q.opts[w.answers[i]] && q.opts[w.answers[i]].ok) r.ok++;
    });
    var rows = Object.keys(by).map(function (rel) {
      var t = topicByRel(rel), r = by[rel];
      return "<li><span>" + escapeHtml(t ? t.short : rel) + '</span><span class="cd-mbar sm ' + masteryTone(Math.round(r.ok / r.n * 100)) + '"><i style="width:' + Math.round(r.ok / r.n * 100) + '%"></i></span><b>' + r.ok + " / " + r.n + "</b></li>";
    }).join("");
    return '<div class="cd-wk-res"><div class="cd-wk-big">' + w.right + " / " + n + "</div>" +
      "<div>" + (w.timeout ? "Время вышло. " : "") + (pct === 100 ? "Без единой ошибки!" : pct >= 80 ? "Отличный результат." : pct >= 50 ? "Неплохо — ошибки уже в разминке." : "Темы стоит повторить — начни со слабых мест.") +
      " Время: " + mmss(w.ms) + "</div><ul class=\"cd-wk-by\">" + rows + "</ul>" +
      '<div class="cd-wk-ctl"><button class="cd-wk-again" type="button">Ещё раз</button><button class="cd-pg-tab-go" type="button" data-go="map">К карте знаний</button></div></div>';
  }
