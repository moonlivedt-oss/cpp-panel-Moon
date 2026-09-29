  // ==== runtime/13-checkpoint.js — «Контрольная точка главы» и «Повтори за мной», сравнение кода ====
  // ---------------------------------------------------------------------------
  //  ```checkpoint — эталон игры «Подземелье» на конец главы. «Сравнить с моим кодом» берёт открытый
  //  в редакторе .cpp (действие окна editor-text) и показывает построчное сравнение: что совпало,
  //  чего нет у тебя, что у тебя своё, — и каких функций/типов эталона у тебя пока нет.
  //    # Название
  //    Что должно быть готово к концу главы (Markdown)
  //    ---
  //    код эталона
  //
  //  ```repeat — «Повтори за мной» в примерах: код примера спрятан (размыт), видно только поведение
  //  программы — тесты «ввод => что должно появиться в выводе». Ученик пишет свою версию, окно
  //  собирает и проверяет её (режим contains: подсказки ввода у каждого свои), потом — сравнение с
  //  кодом примера.
  //    @id ключ
  //    @hint подсказка (сколько угодно)
  //    Условие
  //    ---
  //    ввод => строка вывода\nещё строка
  // ---------------------------------------------------------------------------
  function renderCheckpoint(src) {
    var raw = String(src).replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, ""), title = "Контрольная точка";
    var m = raw.match(/^#\s+(.*)\n?/);
    if (m) { title = m[1].trim(); raw = raw.slice(m[0].length); }
    var parts = raw.split(/^\s*---\s*$/m);
    var code = (parts.slice(1).join("---") || "").replace(/^\n+|\n+$/g, "");
    if (!code) return "";
    return '<div class="cd-cp" data-code="' + encodeURIComponent(code) + '">' +
      '<div class="cd-cp-head"><span class="cd-ch-badge">контрольная точка</span><b>' + inline(title) + "</b></div>" +
      '<div class="cd-cp-body">' + renderMarkdown(parts[0] || "", null) + "</div>" +
      '<div class="cd-ch-ctl"><button class="cd-cp-cmp" type="button">Сравнить с моим кодом</button>' +
      '<button class="cd-cp-show" type="button">Показать эталон</button><span class="cd-ch-msg"></span></div>' +
      '<div class="cd-cp-res" hidden></div>' +
      '<div class="cd-cp-ref" hidden><pre class="code"><code>' + highlight(code, "cpp") + "</code></pre></div></div>";
  }
  function renderRepeat(src) {
    var fk = fenceKey(String(src).replace(/\r\n?/g, "\n")), secs = fk.body.split(/^\s*---\s*$/m);
    var prompt = [], hints = [];
    (secs[0] || "").split("\n").forEach(function (ln) {
      var mh = ln.match(/^\s*@hint\s+(.+)$/i);
      if (mh) { hints.push(mh[1].trim()); return; }
      if (/^\s*@ref\s/i.test(ln)) return;              // файл эталона — для scripts/check-challenges.js
      if (ln.trim()) prompt.push(ln.trim());
    });
    var tests = parseTestLines(secs[1] || ""), id = fk.id, done = !!state.challenge[id];
    var enabled = !!(DATA() && DATA().run && DATA().run.enabled);
    var rows = tests.map(function (t) {
      return "<tr><td><code>" + testShow(t["in"] || "∅") + "</code></td><td><code>" + testShow(t["out"]) + "</code></td></tr>";
    }).join("");
    var behave = rows ? '<div class="cd-ch-lab">как ведёт себя программа — ввод и что должно появиться в выводе (подсказки ввода пиши свои):</div>' +
      '<div class="tablewrap"><table><thead><tr><th>Ввод</th><th>В выводе есть</th></tr></thead><tbody>' + rows + "</tbody></table></div>" : "";
    var hide = state.repeatShowCode ? "" : " hidecode";
    var head = '<div class="cd-ch-head"><span class="cd-ch-badge">повтори за мной</span>' + inline(prompt.join(" ") || "Напиши эту программу сам — по её поведению") + "</div>" +
      '<label class="cd-rep-hide"><input type="checkbox" class="cd-rep-hidebox"' + (hide ? " checked" : "") + "> прятать код примера, пока решаю (клик по коду — подсмотреть)</label>";
    var starter = "#include <iostream>\n#include <string>\n\nint main() {\n    \n}\n";
    var cmp = '<button class="cd-rep-cmp" type="button"' + (done ? "" : " hidden") + ">Сравнить с кодом примера</button>";
    if (!enabled) {
      return '<div class="cd-ch cd-rep' + hide + (done ? " done" : "") + '" data-id="' + escapeHtml(id) + '">' + head + behave +
        '<div class="cd-run-hint">Проверка в один клик выключена: включи <code>cppDocs.localRun</code> и поставь компилятор. А пока — напиши программу в редакторе и сверь её поведение с таблицей.</div></div>';
    }
    return '<div class="cd-ch cd-ch-run cd-rep' + hide + (done ? " done" : "") + '" data-id="' + escapeHtml(id) + '" data-mode="contains" data-tests="' +
      encodeURIComponent(JSON.stringify(tests)) + '">' + head + behave +
      '<textarea class="cd-run-code" spellcheck="false" autocomplete="off" autocapitalize="off" rows="14">' + escapeHtml(starter) + "</textarea>" +
      '<div class="cd-ch-ctl"><button class="cd-run-go" type="button">Запустить</button>' +
      (tests.length ? '<span class="cd-run-tinfo">' + tests.length + " " + plural(tests.length, ["тест", "теста", "тестов"]) + "</span>" : "") +
      cmp + '<span class="cd-ch-msg"></span></div><div class="cd-run-out" hidden></div>' +
      '<div class="cd-cp-res" hidden></div>' + hintsHtml(hints, null, done) + "</div>";
  }
  // Код примера: первый ```cpp в разделе «Код целиком» (иначе — первый с main).
  function exampleRefCode(md) {
    var s = String(md || "").replace(/\r\n?/g, "\n");
    var after = s.split(/^##\s+Код целиком.*$/m)[1];
    var re = /```(?:cpp|c\+\+)[^\n]*\n([\s\S]*?)\n```/g, m;
    if (after) { m = re.exec(after); if (m) return m[1]; }
    re.lastIndex = 0;
    while ((m = re.exec(s))) if (/\bint\s+main\s*\(/.test(m[1])) return m[1];
    return "";
  }

  // ---- Сравнение кода: значимые строки (без пустых, комментариев и одиноких скобок), LCS ----
  function codeLines(text) {
    var out = [];
    String(text || "").replace(/\r\n?/g, "\n").split("\n").forEach(function (raw) {
      var ln = raw, q = 0, cut = -1;
      for (var i = 0; i < ln.length - 1; i++) {
        var c = ln.charAt(i);
        if (c === '"' && ln.charAt(i - 1) !== "\\") q ^= 1;
        if (!q && c === "/" && ln.charAt(i + 1) === "/") { cut = i; break; }
      }
      if (cut >= 0) ln = ln.slice(0, cut);
      var norm = ln.replace(/\s+/g, " ").trim();
      if (!norm || /^[{}();]+$/.test(norm)) return;
      out.push({ raw: raw.replace(/\s+$/, ""), key: norm.replace(/\s*([(){}\[\];,<>=+\-*\/&|!:])\s*/g, "$1") });
    });
    return out.slice(0, 700);
  }
  function lcsOps(a, b) {
    var n = a.length, m = b.length, dp = [];
    for (var i = 0; i <= n; i++) { dp.push(new Uint16Array(m + 1)); }
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i].key === b[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
    var ops = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i].key === b[j].key) { ops.push(["=", b[j].raw]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(["-", a[i].raw]); i++; }
      else { ops.push(["+", b[j].raw]); j++; }
    }
    for (; i < n; i++) ops.push(["-", a[i].raw]);
    for (; j < m; j++) ops.push(["+", b[j].raw]);
    return { ops: ops, same: dp[0][0] };
  }
  // Функции и типы верхнего уровня: «чего из эталона у тебя нет».
  function codeNames(text) {
    var fn = {}, ty = {};
    String(text || "").split(/\r?\n/).forEach(function (ln) {
      var t = ln.match(/^(?:struct|class|enum(?:\s+class)?)\s+([A-Za-z_]\w*)/);
      if (t) ty[t[1]] = 1;
      // «тип имя(параметры) [const] {» — тело может идти в той же строке
      var f = ln.match(/^[A-Za-z_][\w:<>,\s*&]*?[\s*&]([A-Za-z_]\w*)\s*\([^;{}]*?\)\s*(?:const\s*)?(?:\{.*)?$/);
      if (f && !/^(if|for|while|switch|return|else)$/.test(f[1]) && f[1] !== "main") fn[f[1]] = 1;
    });
    return { fn: Object.keys(fn), ty: Object.keys(ty) };
  }
  function diffHtml(refText, mineText, refLabel) {
    var a = codeLines(refText), b = codeLines(mineText);
    if (!b.length) return '<div class="cd-cp-note">В твоём файле пока нет кода.</div>';
    var r = lcsOps(a, b), pct = a.length ? Math.round(r.same / a.length * 100) : 0;
    var rn = codeNames(refText), mn = codeNames(mineText);
    var missFn = rn.fn.filter(function (x) { return mn.fn.indexOf(x) === -1; });
    var missTy = rn.ty.filter(function (x) { return mn.ty.indexOf(x) === -1; });
    var rows = "", run = [];
    function flushSame() {
      if (run.length > 6) {
        rows += run.slice(0, 2).map(sameRow).join("") + '<div class="cd-df-gap">… ещё ' + (run.length - 4) + " совпадающих строк …</div>" + run.slice(-2).map(sameRow).join("");
      } else rows += run.map(sameRow).join("");
      run = [];
    }
    function sameRow(x) { return '<div class="cd-df-l"><i> </i><code>' + escapeHtml(x) + "</code></div>"; }
    r.ops.forEach(function (o) {
      if (o[0] === "=") { run.push(o[1]); return; }
      flushSame();
      rows += '<div class="cd-df-l ' + (o[0] === "-" ? "del" : "add") + '"><i>' + (o[0] === "-" ? "−" : "+") + "</i><code>" + escapeHtml(o[1]) + "</code></div>";
    });
    flushSame();
    return '<div class="cd-cp-stat"><b>' + pct + "%</b> строк " + escapeHtml(refLabel) + " есть и у тебя (" + r.same + " из " + a.length + "; пустые строки, комментарии и отступы не считаются)</div>" +
      (missFn.length || missTy.length ? '<div class="cd-cp-miss">В эталоне есть, у тебя пока нет: ' +
        missTy.map(function (x) { return "<code>" + escapeHtml(x) + "</code> (тип)"; }).concat(missFn.map(function (x) { return "<code>" + escapeHtml(x) + "()</code>"; })).join(", ") + "</div>" : "") +
      '<div class="cd-cp-note">Совпадать дословно не нужно: у каждого свои имена и тексты. Смотри на устройство — какие функции, какие типы, где цикл.</div>' +
      '<div class="cd-df"><div class="cd-df-leg"><span class="del">− только в эталоне</span><span class="add">+ только у тебя</span></div>' + rows + "</div>";
  }

  function checkpointClick(t) {
    var cmp = t.closest(".cd-cp-cmp"), show = t.closest(".cd-cp-show");
    if (show) {
      var box = show.closest(".cd-cp"), ref = box && box.querySelector(".cd-cp-ref");
      if (ref) { ref.hidden = !ref.hidden; show.textContent = ref.hidden ? "Показать эталон" : "Спрятать эталон"; }
      return true;
    }
    if (!cmp) return false;
    var cb = cmp.closest(".cd-cp"), msg = cb.querySelector(".cd-ch-msg"), res = cb.querySelector(".cd-cp-res");
    var code = decodeURIComponent(cb.getAttribute("data-code") || "");
    cmp.disabled = true; if (msg) { msg.textContent = "Беру код из редактора…"; msg.className = "cd-ch-msg"; }
    sendAction({ kind: "editor-text" }, function (r) {
      cmp.disabled = false;
      if (!r.ok) { if (msg) { msg.textContent = r.error || "Не получилось взять код из редактора"; msg.className = "cd-ch-msg err"; } return; }
      if (msg) { msg.textContent = "Сравнил с файлом " + (r.name || ""); msg.className = "cd-ch-msg ok"; }
      setHTML(res, diffHtml(code, r.text, "эталона")); res.hidden = false;
      bumpCount("checkpoint"); saveState();
    });
    return true;
  }
  function repeatClick(t, e) {
    var hb = t.closest(".cd-rep-hidebox");
    if (hb) {
      var box = hb.closest(".cd-rep");
      box.classList.toggle("hidecode", hb.checked);
      state.repeatShowCode = !hb.checked; saveState();
      return false;   // чекбокс переключается сам
    }
    var cmp = t.closest(".cd-rep-cmp");
    if (cmp) {
      var rb = cmp.closest(".cd-rep"), res = rb.querySelector(".cd-cp-res"), ta = rb.querySelector(".cd-run-code");
      var ref = exampleRefCode(current && current.md);
      if (!ref) { toast("В материале нет кода примера для сравнения", true); return true; }
      setHTML(res, diffHtml(ref, ta ? ta.value : "", "примера")); res.hidden = false;
      return true;
    }
    // размытый код примера: клик — подсмотреть этот блок
    var pre = t.closest("pre");
    if (pre && !pre.closest(".cd-rep") && !pre.classList.contains("peek") && articleEl &&
        articleEl.querySelector(".cd-rep.hidecode:not(.done)")) {
      pre.classList.add("peek");
      if (e) e.stopPropagation();
      return true;
    }
    return false;
  }
  // Задача решена — кнопка сравнения появляется (зовёт challengeSolved через noteRunResult).
  function repeatSolved(box) {
    var b = box && box.classList && box.classList.contains("cd-rep") ? box.querySelector(".cd-rep-cmp") : null;
    if (b) b.hidden = false;
  }
