  // ==== runtime/13-games.js — игровые блоки: карта квестов, симулятор лута, волна поиска пути ====

  // ---- ```quests : «Путь героя» — все квесты «Подземелья» с прогрессом ----
  // Квест = «## Квест N. Название» в proekt/NN-glava-*.md; пройден, когда отмечены ВСЕ пункты его
  // ```checklist (ключи пунктов — те же cdHash, что у renderChecklist). Тело блока не нужно.
  function questChecklistItems(src) {
    var items = [];
    String(src).split("\n").forEach(function (ln) {
      var t = ln.replace(/\s+$/, "");
      var mi = t.match(/^\s*[-*]\s+(.*)$/);
      if (mi) items.push(mi[1]);
    });
    return items;
  }
  function collectQuests() {
    var d = DATA(); if (!d) return null;
    var files = d.files.filter(function (f) { return /^proekt\/\d\d-glava/i.test(f.rel); })
      .sort(function (a, b) { return a.rel < b.rel ? -1 : 1; });
    if (!files.length) return null;
    var chapters = [], loading = false;
    files.forEach(function (f) {
      if (!f.md) { loading = true; return; }
      var lines = String(f.md).replace(/\r\n?/g, "\n").split("\n");
      var ch = { rel: f.rel, title: String(f.title || f.name).replace(/^Подземелье\s*·\s*/, ""), quests: [] };
      var q = null, fence = null, buf = [];
      lines.forEach(function (ln) {
        var fm = ln.match(/^```\s*([A-Za-z]*)/);
        if (fm) {
          if (fence === null) { fence = fm[1].toLowerCase(); buf = []; return; }
          if (fence === "checklist" && q) q.items = q.items.concat(questChecklistItems(buf.join("\n")));
          fence = null; return;
        }
        if (fence !== null) { buf.push(ln); return; }
        var hm = ln.match(/^##\s+(Квест\s+(\d+)\.\s*(.+?))\s*$/);
        if (hm) { q = { n: +hm[2], title: hm[3], slug: slugify(hm[1]), items: [] }; ch.quests.push(q); }
        else if (/^##\s/.test(ln)) q = null;
      });
      chapters.push(ch);
    });
    return { chapters: chapters, loading: loading };
  }
  function renderQuestMap() {
    var qd = collectQuests();
    if (!qd) return '<div class="cd-qmap cd-qmap-empty">Квесты «Подземелья» не найдены.</div>';
    if (qd.loading) return '<div class="cd-qmap cd-qmap-empty">Путь героя загружается…</div>';
    var total = 0, done = 0, next = null, chHtml = "";
    qd.chapters.forEach(function (ch) {
      var chDone = 0, nodes = "";
      ch.quests.forEach(function (q) {
        var have = q.items.filter(function (it) { return !!state.checks[cdHash(it)]; }).length;
        var st = q.items.length && have === q.items.length ? "done" : (have ? "part" : "todo");
        total++; if (st === "done") { done++; chDone++; } else if (!next) { next = { q: q, ch: ch }; st += " next"; }
        var href = "../" + ch.rel + "#" + q.slug;
        var pct = q.items.length ? Math.round(have / q.items.length * 100) : 0;
        nodes += '<a class="cd-qm-node ' + st + '" href="' + escapeHtml(href) + '" style="--qp:' + pct + '" title="Квест ' + q.n + ". " +
          escapeHtml(q.title) + (st.indexOf("done") === 0 ? " — пройден" : q.items.length ? " — отмечено " + have + " из " + q.items.length : "") + '">' +
          '<span class="cd-qm-dot">' + (st.indexOf("done") === 0 ? "✓" : q.n) + '</span><span class="cd-qm-nm">' + escapeHtml(q.title) + "</span></a>";
      });
      chHtml += '<div class="cd-qm-ch"><div class="cd-qm-chn">' + escapeHtml(ch.title) +
        '<span class="cd-qm-chc">' + chDone + " / " + ch.quests.length + "</span></div>" +
        '<div class="cd-qm-path">' + nodes + "</div></div>";
    });
    var pct = total ? Math.round(done / total * 100) : 0;
    var nextHtml = next
      ? '<a class="cd-qm-next" href="' + escapeHtml("../" + next.ch.rel + "#" + next.q.slug) + '">Следующий: <b>Квест ' + next.q.n + " · " + escapeHtml(next.q.title) + "</b> →</a>"
      : '<div class="cd-qm-next win">🏆 Все квесты пройдены — игра ваша. Дальше — бонус-квесты ниже.</div>';
    return '<div class="cd-qmap"><div class="cd-qm-head"><div class="cd-qm-ttl">🗺️ Путь героя</div>' +
      '<div class="cd-qm-sum">пройдено <b>' + done + "</b> из " + total + " · " + pct + "%</div></div>" +
      '<div class="cd-qm-bar"><i style="width:' + pct + '%"></i></div>' + chHtml + nextHtml +
      '<div class="cd-qm-note">Квест засчитывается, когда отмечены все пункты его чек-листа «готово, если».</div></div>';
  }

  // ---- ```lootsim : сундуки с весами. Строки «Имя = вес», необязательно «@pity N» ----
  function renderLootSim(src) {
    var rows = [], pity = 0;
    String(src).replace(/\r\n?/g, "\n").split("\n").forEach(function (ln) {
      var pm = ln.match(/^\s*@pity\s+(\d+)\s*$/i); if (pm) { pity = Math.min(200, +pm[1]); return; }
      var m = ln.match(/^\s*(.+?)\s*=\s*(\d+(?:\.\d+)?)\s*$/);
      if (m && rows.length < 6 && +m[2] > 0) rows.push({ name: m[1], w: +m[2] });
    });
    if (rows.length < 2) return "";
    var sum = rows.reduce(function (a, r) { return a + r.w; }, 0);
    var list = rows.map(function (r, i) {
      var p = Math.round(r.w / sum * 1000) / 10;
      return '<div class="cd-ls-row r' + i + '"><span class="cd-ls-nm">' + escapeHtml(r.name) + '</span>' +
        '<span class="cd-ls-want">шанс ' + p + '%</span>' +
        '<span class="cd-ls-bar"><i class="cd-ls-exp" style="left:' + p + '%"></i><b style="width:0%"></b></span>' +
        '<span class="cd-ls-got">—</span></div>';
    }).join("");
    return '<div class="cd-lootsim" data-rows="' + encodeURIComponent(JSON.stringify(rows)) + '" data-pity="' + pity + '">' +
      '<div class="cd-ls-head">🎁 Открой сундуки — посмотри, как веса работают на деле</div>' + list +
      '<div class="cd-ls-trail" aria-label="Последние сундуки"></div>' +
      '<div class="cd-ls-ctl"><button type="button" class="cd-ls-open" data-n="1">Открыть 1</button>' +
      '<button type="button" class="cd-ls-open" data-n="10">×10</button><button type="button" class="cd-ls-open" data-n="1000">×1000</button>' +
      (pity ? '<label class="cd-ls-pityl"><input type="checkbox" class="cd-ls-pity"> гарантия: «' + escapeHtml(rows[rows.length - 1].name) + "» не реже чем раз в " + pity + "</label>" : "") +
      '<button type="button" class="cd-ls-reset">Сброс</button></div>' +
      '<div class="cd-ls-stat">Пока ни одного сундука. Черта на полоске — заявленный шанс.</div></div>';
  }
  function lootSimClick(t) {
    var box = t.closest(".cd-lootsim"); if (!box) return false;
    var open = t.closest(".cd-ls-open"), reset = t.closest(".cd-ls-reset");
    if (!open && !reset) return false;
    var rows = []; try { rows = JSON.parse(decodeURIComponent(box.getAttribute("data-rows") || "")); } catch (e) { return true; }
    var pity = +box.getAttribute("data-pity") || 0, last = rows.length - 1;
    if (!box.__ls || reset) box.__ls = { cnt: rows.map(function () { return 0; }), total: 0, dry: 0, maxDry: 0, trail: [] };
    var S = box.__ls, sum = rows.reduce(function (a, r) { return a + r.w; }, 0);
    var pityOn = pity && box.querySelector(".cd-ls-pity") && box.querySelector(".cd-ls-pity").checked;
    var n = open ? +open.getAttribute("data-n") || 1 : 0;
    for (var k = 0; k < n; k++) {
      var pick;
      if (pityOn && S.dry >= pity - 1) pick = last;               // гарантия: давно не было — выдаём редчайшее
      else { var r = Math.random() * sum, i = 0; while (i < last && r >= rows[i].w) { r -= rows[i].w; i++; } pick = i; }
      S.cnt[pick]++; S.total++;
      if (pick === last) S.dry = 0; else { S.dry++; if (S.dry > S.maxDry) S.maxDry = S.dry; }
      S.trail.push(pick); if (S.trail.length > 24) S.trail.shift();
    }
    box.querySelectorAll(".cd-ls-row").forEach(function (row, i) {
      var share = S.total ? S.cnt[i] / S.total * 100 : 0;
      row.querySelector(".cd-ls-bar b").style.width = Math.min(100, share) + "%";
      row.querySelector(".cd-ls-got").textContent = S.total ? S.cnt[i] + " · " + (Math.round(share * 10) / 10) + "%" : "—";
    });
    setHTML(box.querySelector(".cd-ls-trail"), S.trail.map(function (p) { return '<i class="r' + p + '" title="' + escapeHtml(rows[p].name) + '"></i>'; }).join(""));
    box.querySelector(".cd-ls-stat").textContent = S.total
      ? "Открыто: " + S.total + " · последний: " + rows[S.trail[S.trail.length - 1]].name + " · без «" + rows[last].name + "» подряд сейчас " + S.dry +
        ", самая длинная серия " + S.maxDry + (S.total < 100 ? ". Открой ×1000 — доли подтянутся к заявленным." : ".")
      : "Пока ни одного сундука. Черта на полоске — заявленный шанс.";
    return true;
  }

  // ---- ```bfsgrid : карта (# стена, . пол, S игрок, E враг). Клик — стена/пол, волна считается заново ----
  function bfsParse(src) {
    var rows = String(src).replace(/\r\n?/g, "\n").split("\n").map(function (l) { return l.replace(/\s+$/, ""); })
      .filter(function (l) { return l.length && !/^\s*#\s/.test(l); }).slice(0, 16);
    var w = rows.reduce(function (a, r) { return Math.max(a, r.length); }, 0);
    if (!w || w > 30 || rows.length < 2) return null;
    return rows.map(function (r) { var o = []; for (var x = 0; x < w; x++) { var c = r.charAt(x) || "#"; o.push(/[#.SE]/.test(c) ? c : "."); } return o; });
  }
  function bfsDist(g) {
    var h = g.length, w = g[0].length, dist = [], sx = -1, sy = -1, ex = -1, ey = -1, x, y;
    for (y = 0; y < h; y++) { dist.push([]); for (x = 0; x < w; x++) { dist[y].push(-1); if (g[y][x] === "S") { sx = x; sy = y; } if (g[y][x] === "E") { ex = x; ey = y; } } }
    if (sx < 0) return { dist: dist, path: {}, max: 0, reach: -1 };
    var q = [[sx, sy]], head = 0, max = 0; dist[sy][sx] = 0;
    var D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < q.length) {
      var c = q[head++];
      D.forEach(function (d) {
        var nx = c[0] + d[0], ny = c[1] + d[1];
        if (ny < 0 || ny >= h || nx < 0 || nx >= w || g[ny][nx] === "#" || dist[ny][nx] >= 0) return;
        dist[ny][nx] = dist[c[1]][c[0]] + 1; if (dist[ny][nx] > max) max = dist[ny][nx];
        q.push([nx, ny]);
      });
    }
    var path = {}, reach = ex >= 0 ? dist[ey][ex] : -1;
    if (reach > 0) {                     // от врага — к клетке, где волна на 1 меньше: так враг и идёт к игроку
      var cx = ex, cy = ey;
      while (dist[cy][cx] > 0) {
        path[cx + "," + cy] = 1;
        for (var i = 0; i < 4; i++) {
          var px = cx + D[i][0], py = cy + D[i][1];
          if (py >= 0 && py < h && px >= 0 && px < w && dist[py][px] === dist[cy][cx] - 1) { cx = px; cy = py; break; }
        }
      }
    }
    return { dist: dist, path: path, max: max, reach: reach };
  }
  function bfsGridHtml(g, limit) {
    var r = bfsDist(g), html = "";
    g.forEach(function (row, y) {
      row.forEach(function (c, x) {
        var d = r.dist[y][x], show = d >= 0 && (limit == null || d <= limit);
        var cls = c === "#" ? "wall" : c === "S" ? "start" : c === "E" ? "enemy" : "floor";
        if (show && r.path[x + "," + y] && (limit == null || limit >= r.reach)) cls += " path";
        var tone = show && r.max ? Math.round(d / r.max * 100) : 0;
        var label = c === "S" ? "@" : c === "E" ? "E" : c === "#" ? "" : (show ? String(d) : "");
        html += '<button type="button" class="cd-bfs-c ' + cls + (show ? " on" : "") + '" data-x="' + x + '" data-y="' + y + '" style="--t:' + tone + '"' +
          (c === "#" || c === "." ? ' title="Клик — ' + (c === "#" ? "убрать стену" : "поставить стену") + '"' : "") + ">" + label + "</button>";
      });
    });
    var status = r.reach > 0 ? "Враг дойдёт до героя за <b>" + r.reach + "</b> " + plural(r.reach, ["шаг", "шага", "шагов"]) + " — путь подсвечен."
      : r.reach === 0 ? "Враг уже рядом." : "Стены перекрыли дорогу — волна не дошла до врага, ему некуда идти.";
    return { grid: html, status: status, cols: g[0].length, max: r.max };
  }
  function renderBfsGrid(src) {
    var g = bfsParse(src); if (!g) return "";
    var v = bfsGridHtml(g);
    return '<div class="cd-bfs" data-map="' + encodeURIComponent(g.map(function (r) { return r.join(""); }).join("\n")) + '">' +
      '<div class="cd-bfs-head">🧭 Волна от героя: число в клетке — сколько шагов до неё. Кликай по клеткам — ставь и убирай стены.</div>' +
      '<div class="cd-bfs-grid" style="--cols:' + v.cols + '">' + v.grid + "</div>" +
      '<div class="cd-bfs-st">' + v.status + "</div>" +
      '<div class="cd-bfs-ctl"><button type="button" class="cd-bfs-play">▶ Волна по шагам</button><button type="button" class="cd-bfs-reset">Вернуть карту</button></div></div>';
  }
  function bfsRedraw(box, limit) {
    var v = bfsGridHtml(box.__g, limit);
    setHTML(box.querySelector(".cd-bfs-grid"), v.grid);
    setHTML(box.querySelector(".cd-bfs-st"), limit == null || limit >= v.max ? v.status : "Волна: шаг " + limit + "…");
    return v;
  }
  function bfsClick(t) {
    var box = t.closest(".cd-bfs"); if (!box) return false;
    if (!box.__g || t.closest(".cd-bfs-reset")) {
      box.__g = bfsParse(decodeURIComponent(box.getAttribute("data-map") || ""));
      if (!box.__g) return true;
    }
    clearTimeout(box.__timer);
    var cell = t.closest(".cd-bfs-c");
    if (cell) {
      var x = +cell.getAttribute("data-x"), y = +cell.getAttribute("data-y"), c = box.__g[y] && box.__g[y][x];
      if (c === "#" || c === ".") box.__g[y][x] = c === "#" ? "." : "#";
      bfsRedraw(box); return true;
    }
    if (t.closest(".cd-bfs-play")) {
      var v = bfsRedraw(box, 0), k = 0;
      if (state.noAnim || prefersReducedMotion()) { bfsRedraw(box); return true; }
      var tick = function () { k++; bfsRedraw(box, k); if (k < v.max) box.__timer = setTimeout(tick, 170); };
      box.__timer = setTimeout(tick, 170);
      return true;
    }
    if (t.closest(".cd-bfs-reset")) { bfsRedraw(box); return true; }
    return false;
  }
  // Клики по игровым блокам (зовёт onArticleClick).
  function gamesClick(e) {
    var t = e.target; if (!t || !t.closest) return false;
    return lootSimClick(t) || bfsClick(t);
  }
