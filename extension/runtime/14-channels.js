  // ==== runtime/14-channels.js — открыть/закрыть окно, доступ к файлам, мост, действия окна ====
  // ---------------------------------------------------------------------------
  //  Открыть / закрыть / обновить.
  // ---------------------------------------------------------------------------
  // Закрытие окна его только прячет: DOM, прокрутка, вкладки и раскрытые разделы живут до
  // следующего открытия (пересборка окна — самое дорогое место рантайма). Пересобираем, только
  // если VS Code снёс узел, перестраивая свой DOM.
  var winOpen = false;
  function isOpen() { return !!(winEl && winOpen); }
  function openWindow() {
    if (pendingErr) { pendingErr = false; syncBadge(); }
    lastBridgeWord = null;   // плашка ошибки/слова покажется заново
    if (winEl && !winEl.isConnected) { document.removeEventListener("keydown", onKey, true); winEl = null; }
    if (winEl) {
      winEl.style.display = "flex";
      winOpen = true;
      try { keepOnScreen(); applyResponsive(); } catch (e) {}
    } else {
      winOpen = true;
      buildWindow();
    }
    if (state.docked && !_docked) applyDock(true);
    setBtnVisible(false);
    cdShareView();
  }
  function closeWindow() {
    if (IN_PANEL) return;
    if (_docked) applyDock(false);          // спрятанное окно не должно отнимать место у редактора
    if (winEl) winEl.style.display = "none";
    winOpen = false;
    try { hideHlPop(); hideItemMenu(); } catch (e) {}
    setBtnVisible(true);
    cdShareView();
  }
  function toggleWindow() { if (isOpen()) closeWindow(); else openWindow(); }

  function bootVal(key) { try { var b = window.__CPPDOCS_BOOT__; return b && b[key]; } catch (e) { return null; } }
  // Доступ к файлам. Оболочка VS Code работает в песочнице — Node у окна нет (VS Code ≥ 1.76):
  //  • читаем через vscode-file://vscode-app/<путь> (хранилище и папка расширений — разрешённые
  //    корни оболочки);
  //  • пишем через мост расширения (lib/bridge.js): POST на 127.0.0.1 с токеном.
  function appUrl(u) {
    var m = String(u || "").match(/^file:\/\/\/([^?#]+)$/);
    if (!m) return null;
    return "vscode-file://vscode-app/" + m[1].split("/").map(function (seg) {
      try { return encodeURIComponent(decodeURIComponent(seg)).replace(/%3A/gi, ":"); } catch (e) { return ""; }
    }).join("/");
  }
  // Адрес ресурса для <img>/фона: file:/// → vscode-file:// (оболочка); во вкладке расширение уже
  // прислало адрес webview (https://…vscode-cdn.net/…) — берём как есть.
  function resUrl(u) {
    if (IN_PANEL && /^https:\/\/[^"'()\s<>]+$/.test(String(u || ""))) return String(u);
    // Превью в браузере (npm run preview:window / dev): картинки отдаёт локальный сервер превью.
    // В оболочке VS Code страница открыта по vscode-file:, так что эта ветка там не срабатывает.
    if (typeof location !== "undefined" && /^https?:$/.test(location.protocol) &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^"'()\s<>]*$/.test(String(u || ""))) return String(u);
    return appUrl(u);
  }
  function appRead(u) {
    try {
      if (typeof location === "undefined" || location.protocol !== "vscode-file:" || typeof XMLHttpRequest === "undefined") return null;
      var url = appUrl(u); if (!url) return null;
      var x = new XMLHttpRequest();
      x.open("GET", url + "?t=" + Date.now(), false);   // метка — мимо кэша
      x.send();
      return x.status === 200 || (x.status === 0 && x.responseText) ? x.responseText : null;
    } catch (e) { return null; }       // файла нет — оболочка отвечает ошибкой сети
  }
  var _bridge = null, _bridgeAt = 0;
  // Через Moon Core: события модуля вместо своего потока (подписываемся один раз).
  var _mcSubscribed = false;
  function mcSubscribe() {
    if (_mcSubscribed || !MCM) return;
    _mcSubscribed = true;
    _esLive = true;   // контекст редактора и метка приходят событиями — опрос файлов не нужен
    try {
      MCM.on("editor", function (txt) { var p = parseEditorText(String(txt)); if (p) { editorPayload = p; applyEditorPayload(p); } });
      MCM.on("stamp", function (txt) { applyStampText(String(txt)); });
      MCM.on("progress", function (txt) { onProgressEvent(String(txt)); });
    } catch (e) { _esLive = false; }
  }
  function bridgeInfo() {
    if (IN_PANEL) return null;
    // Moon Core: события — через его мост, но свой мост расширения тоже жив: им пишем зеркало
    // прогресса (у моста Moon Core лимит 1 МБ и нет sendBeacon при закрытии окна).
    if (MCM) mcSubscribe();
    if (_bridge && Date.now() - _bridgeAt < 10000) return _bridge;
    _bridgeAt = Date.now();
    var d = DATA(), txt = appRead((d && d.bridgeUrl) || bootVal("bridgeUrl"));
    var prev = _bridge; _bridge = null;
    try {
      var o = txt ? JSON.parse(txt) : null;
      // Окон VS Code может быть несколько — в файле список живых хостов (hosts); годится любой.
      // Старый формат — один адрес {port, token}. Хост, который недавно не ответил, пропускаем.
      var list = o && Array.isArray(o.hosts) ? o.hosts.slice(0, 16) : (o ? [o] : []);
      for (var i = 0; i < list.length && !_bridge; i++) {
        var h = list[i];
        if (!h || !((h.port | 0) > 0 && (h.port | 0) < 65536 && /^[0-9a-f]{48}$/.test(h.token))) continue;
        if (_badHosts[h.token] && Date.now() - _badHosts[h.token] < 30000) continue;
        _bridge = { port: h.port | 0, token: h.token };
      }
      if (_bridge) {
        var fresh = !prev || prev.token !== _bridge.token;
        // «я на связи» — для «Проверить плавающее окно» (один раз на адрес моста)
        if (fresh && typeof fetch === "function") try { fetch("http://127.0.0.1:" + _bridge.port + "/ping/" + _bridge.token, { cache: "no-store" }).catch(function () {}); } catch (e) {}
        if (fresh && !MCM) connectEvents();
      }
    } catch (e) {}
    return _bridge;
  }
  var _badHosts = {};
  function bridgeFailed(b) {
    if (b) _badHosts[b.token] = Date.now();
    if (_bridge && b && _bridge.token === b.token) { _bridge = null; _bridgeAt = 0; }
  }

  // Поток событий от расширения (SSE): контекст редактора и метка свежести данных приходят
  // сами — без синхронного чтения файлов раз в секунду на главном потоке VS Code. Пока поток
  // не подключён (нет моста / старое расширение) — работает прежний опрос, но реже.
  var _es = null, _esToken = "", _esLive = false;
  function connectEvents() {
    if (typeof EventSource !== "function" || !_bridge) return;
    if (_es && _esToken === _bridge.token) return;
    try { if (_es) _es.close(); } catch (e) {}
    var b = _bridge;
    _esToken = b.token; _esLive = false;
    try { _es = new EventSource("http://127.0.0.1:" + b.port + "/events/" + b.token); } catch (e) { _es = null; return; }
    _es.onopen = function () { _esLive = true; };
    // Хост из файла мёртв (адрес прошлого сеанса) — EventSource будет молча переподключаться вечно.
    // Не открылся за 5 с — помечаем хост плохим и берём следующий.
    var es0 = _es;
    setTimeout(function () {
      if (_es === es0 && !_esLive) { try { es0.close(); } catch (e) {} _es = null; _esToken = ""; bridgeFailed(b); }
    }, 5000);
    _es.onerror = function () {
      _esLive = false;
      // Хост закрылся (окно VS Code закрыли) — переключаемся на другой из списка.
      if (_es && _es.readyState === 2) { _es = null; bridgeFailed(b); bridgeInfo(); }
    };
    _es.addEventListener("editor", function (ev) {
      var p = parseEditorText(ev.data);
      if (p) { editorPayload = p; applyEditorPayload(p); }
    });
    _es.addEventListener("stamp", function (ev) { applyStampText(ev.data); });
    _es.addEventListener("progress", function (ev) { onProgressEvent(ev.data); });
  }
  // Записать зеркало прогресса через мост (во вкладке — сообщением). Асинхронно; true — запрос ушёл.
  function bridgeWrite(u, text, beacon) {
    var name = String(u || "").split(/[\/\\]/).pop();
    if (PROTO.WRITABLE.indexOf(name) === -1) return false;
    if (IN_PANEL) { try { VSC.postMessage({ type: "write", name: name, text: String(text) }); return true; } catch (e) { return false; } }
    var b = bridgeInfo();
    if (!b) return MCM ? mcWrite(name, text) : false;
    var target = "http://127.0.0.1:" + b.port + "/w/" + b.token + "/" + name;
    // sendBeacon переживает выгрузку страницы; text/plain не требует CORS-предзапроса.
    if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(target, new Blob([String(text)], { type: "text/plain" }))) return true; } catch (e) {}
    }
    if (typeof fetch !== "function") return false;
    try {
      fetch(target, {
        method: "POST", body: String(text), headers: { "Content-Type": "text/plain" }, mode: "cors", cache: "no-store",
      }).then(function (r) { if (!r.ok) { bridgeFailed(b); if (MCM) mcWrite(name, text); } },
        function () { bridgeFailed(b); if (MCM) mcWrite(name, text); });   // сбой — возьмём другой хост (или мост Moon Core)
      return true;
    } catch (e) { return false; }
  }
  // Запись через мост Moon Core: у него лимит тела запроса ~1 МБ. Больше — не молчим, а сообщаем
  // (журнал + один раз подсказка): иначе прогресс тихо переставал бы сохраняться.
  var MC_MAX_WRITE = 1000 * 1000, _mcBigWarned = false;
  function mcWrite(name, text) {
    text = String(text);
    if (text.length > MC_MAX_WRITE) {
      if (!_mcBigWarned) {
        _mcBigWarned = true;
        reportError("зеркало прогресса", new Error("зеркало " + Math.round(text.length / 1024) + " КБ больше лимита моста Moon Core; мост расширения недоступен"));
        toast("Резервная копия прогресса не сохранилась: слишком большая. Проверь «Документация C++: проверить плавающее окно».", true);
      }
      return false;
    }
    try {
      MCM.rpc("write", { name: name, text: text }).then(function (r) {
        if (!r || !r.ok) reportError("зеркало прогресса", new Error((r && r.error) || "мост Moon Core не принял запись"));
      }, function () {});
      return true;
    } catch (e) { return false; }
  }
  // Все живые хосты из файла моста (текущий — первым). Для запросов с ответом перебираем по порядку:
  // действие окна выполняет хост окна VS Code в фокусе, остальные отвечают 409 «не я».
  function bridgeHosts() {
    var d = DATA(), txt = appRead((d && d.bridgeUrl) || bootVal("bridgeUrl")), out = [];
    try {
      var o = txt ? JSON.parse(txt) : null;
      var list = o && Array.isArray(o.hosts) ? o.hosts.slice(0, 16) : (o ? [o] : []);
      list.forEach(function (h) {
        if (h && (h.port | 0) > 0 && (h.port | 0) < 65536 && /^[0-9a-f]{48}$/.test(h.token)) out.push({ port: h.port | 0, token: h.token });
      });
    } catch (e) {}
    var cur = _bridge;
    if (cur) out.sort(function (a, b) { return (b.token === cur.token) - (a.token === cur.token); });
    return out;
  }
  // Запрос к расширению с ответом: run / action / log (методы и лимиты — PROTO, из lib/protocol.js).
  // cb(ответ) или cb(null) — нет связи или вышло время.
  var _rpcSeq = 0, _rpcWait = {};
  function rpc(method, body, timeoutMs, cb) {
    var done = false;
    var timer = setTimeout(function () { finish(null); }, timeoutMs);
    function finish(r) { if (done) return; done = true; clearTimeout(timer); try { cb(r); } catch (e) { reportError("rpc:" + method, e); } }
    if (IN_PANEL) {
      var id = "q" + Date.now() + "-" + (++_rpcSeq);
      _rpcWait[id] = function (r) { delete _rpcWait[id]; finish(r); };
      try { VSC.postMessage({ type: "rpc", id: id, method: method, body: body }); } catch (e) { delete _rpcWait[id]; finish(null); }
      return;
    }
    if (MCM) {
      // Мост Moon Core сам выбирает хост этого окна; ответ модуля — { ok, result }.
      try {
        // Своё ожидание: «Запустить» идёт до минуты, а у моста Moon Core по умолчанию 8 с.
        MCM.rpc(method, body, { timeoutMs: Math.max(1000, timeoutMs - 1000) }).then(function (r) { finish(r && r.ok ? r.result : null); }, function () { finish(null); });
      } catch (e) { finish(null); }
      return;
    }
    var hosts = bridgeHosts(), i = 0;
    if (!hosts.length || typeof fetch !== "function") { finish(null); return; }
    (function next() {
      if (done) return;
      if (i >= hosts.length) { finish(null); return; }
      var h = hosts[i++];
      fetch("http://127.0.0.1:" + h.port + "/rpc/" + h.token + "/" + method, {
        // text/plain — «простой» запрос без CORS-предзапроса; хост всё равно разбирает JSON
        method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "text/plain" }, mode: "cors", cache: "no-store",
      }).then(function (r) {
        if (r.status === 409) { next(); return null; }               // не тот хост — следующий
        if (!r.ok) { bridgeFailed(h); next(); return null; }
        return r.json();
      }).then(function (j) { if (j) finish(j); }, function () { bridgeFailed(h); next(); });
    })();
  }
  // Ошибки окна — в журнал расширения (Output → «Документация C++»): иначе сбой в окне не виден
  // никому. Не чаще 10 в минуту; сами отправки ошибок не порождают.
  var _errN = 0, _errT = 0, _errBusy = false;
  function reportError(where, e) {
    if (_errBusy) return;
    try {
      var now = Date.now();
      if (now - _errT > 60000) { _errT = now; _errN = 0; }
      if (++_errN > 10) return;
      _errBusy = true;
      var msg = String(e && (e.message || e) || e).slice(0, 500);
      var stack = e && e.stack ? String(e.stack).slice(0, 2000) : "";
      try { console.warn("[cpp-docs] " + where + ": " + msg); } catch (x) {}
      rpc("log", { where: String(where || "").slice(0, 80), msg: msg, stack: stack, v: VERSION }, 3000, function () {});
    } catch (x) {} finally { _errBusy = false; }
  }
  try {
    // Только ошибки НАШЕГО скрипта: он встроен в workbench.html, значит, у его ошибок filename —
    // адрес самой страницы (скрипты VS Code — отдельные .js). Во вкладке страница целиком наша.
    cdOnGlobal(window, "error", function (ev) {
      if (!ev) return;
      var fn = String(ev.filename || "").split("?")[0];
      var mine = IN_PANEL || (fn && typeof location !== "undefined" && fn === String(location.href).split("?")[0]) ||
        /mooncore-mod-cppdocs\.js$/.test(fn);   // файл модуля Moon Core рядом с оболочкой
      if (mine) reportError("window.onerror", ev.error || ev.message);
    });
    if (IN_PANEL) cdOnGlobal(window, "unhandledrejection", function (ev) { reportError("promise", ev && ev.reason); });
  } catch (e) {}
  // Прочитать файл хранилища/расширения (vscode-file://; во вкладке — только зеркало прогресса).
  function fileRead(u) {
    if (IN_PANEL) return u && u === progressUrl() && typeof window.__CPPDOCS_MIRROR__ === "string" ? window.__CPPDOCS_MIRROR__ : null;
    return appRead(u);
  }
  // Асинхронное чтение (данные окна — сотни КБ: синхронный запрос подвесил бы интерфейс VS Code).
  function appReadAsync(u, cb) {
    if (IN_PANEL) { cb(null); return; }
    var url = appUrl(u);
    if (!url || typeof XMLHttpRequest === "undefined") { cb(null); return; }
    try {
      var x = new XMLHttpRequest();
      x.open("GET", url + "?t=" + Date.now(), true);
      x.onload = function () { cb(x.status === 200 || (x.status === 0 && x.responseText) ? x.responseText : null); };
      x.onerror = function () { cb(null); };
      x.send();
    } catch (e) { cb(null); }
  }
  // ---------------------------------------------------------------------------
  //  Действия окна → расширение: «в редактор», «заготовка», «в заметки», копия прогресса —
  //  запросом rpc("action") с ответом сразу.
  // ---------------------------------------------------------------------------
  var _actSeq = 0;
  function sendAction(payload, cb) {
    payload.id = "a" + Date.now() + "-" + (++_actSeq);
    payload.ts = Date.now();
    rpc("action", payload, PROTO.ACTION_TIMEOUT_MS, function (res) {
      cb(res || { ok: false, error: IN_PANEL ? "расширение не ответило" : "нет связи с расширением — обнови окно ⟳" });
    });
  }
  // Короткое сообщение внизу экрана (успех/ошибка действия).
  var toastEl = null, toastTimer = null;
  function toast(text, bad) {
    try {
      if (!toastEl) { toastEl = el("div"); toastEl.className = "cd-toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
      toastEl.textContent = text;
      toastEl.classList.toggle("bad", !!bad);
      toastEl.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { if (toastEl) toastEl.hidden = true; }, 2600);
    } catch (e) {}
  }
  // Языки, у которых есть кнопка «в редактор». Блок без языка — обычно вывод программы или
  // текст ошибки, вставлять его в .cpp незачем.
  var TOED_LANGS = { cpp: 1, "c++": 1, cc: 1, cxx: 1, c: 1, h: 1, hpp: 1 };
  function toEditorBtn(code) {
    return '<button class="copybtn cd-toed" type="button" title="Вставить в открытый .cpp (на место курсора), а если его нет — в новый файл" data-code="' +
      escapeHtml(code) + '"><span class="cb-ic">↳</span> в редактор</button>';
  }
  function sendToEditor(btn) {
    var code = btn.getAttribute("data-code") || "";
    if (!code.trim()) return;
    btn.disabled = true;
    sendAction({ kind: "insert", code: code }, function (res) {
      btn.disabled = false;
      if (res.ok) toast(res.where === "new" ? "Код открыт в новом файле" : "Вставлено в " + (res.name || "редактор"));
      else toast("Не вставилось: " + (res.error || "ошибка"), true);
    });
  }
  // Каркас решения задачи: условие (абзацы до «Пример» / подсказок) — комментарием сверху.
  function wrapComment(text, width) {
    var out = [], line = "";
    String(text).replace(/\s+/g, " ").trim().split(" ").forEach(function (w) {
      if (line && (line + " " + w).length > width) { out.push("// " + line); line = w; }
      else line = line ? line + " " + w : w;
    });
    if (line) out.push("// " + line);
    return out;
  }
  function taskStubCode(h) {
    var title = (h.getAttribute("data-title") || h.firstChild && h.firstChild.textContent || h.textContent)
      .replace(/[🟢🟡🔴]/g, "").replace(/\s+/g, " ").trim();
    var cond = [];
    for (var n = h.nextElementSibling; n; n = n.nextElementSibling) {
      if (/^(H[1-3]|PRE|DETAILS|HR)$/.test(n.tagName) || n.classList.contains("codewrap")) break;
      var t = n.textContent.replace(/\s+/g, " ").trim();
      if (/^Пример/i.test(t)) break;
      var em = n.firstElementChild;   // курсивная строка-подводка — не условие
      if (em && n.children.length === 1 && em.tagName === "EM" && em.textContent.trim() === t) continue;
      if (n.tagName === "P" && t) cond.push(t);
    }
    var lines = ["// Задача " + title];
    cond.forEach(function (t, i) { if (i) lines.push("//"); lines = lines.concat(wrapComment(t, 86)); });
    return lines.join("\n") + "\n\n" +
      "#include <windows.h>        // Windows: русские буквы в консоли\n" +
      "#include <iostream>\n#include <string>\n\n" +
      "int main() {\n  SetConsoleCP(CP_UTF8);\n  SetConsoleOutputCP(CP_UTF8);\n\n" +
      "  // 1. ВВОД   2. РАСЧЁТ   3. ВЫВОД\n\n  return 0;\n}\n";
  }
  function sendTaskStub(btn) {
    var h = btn.closest("h2"); if (!h) return;
    btn.disabled = true;
    sendAction({ kind: "newfile", code: taskStubCode(h) }, function (res) {
      btn.disabled = false;
      if (res.ok) toast("Заготовка открыта в новом файле — сохрани её как .cpp");
      else toast("Не открылось: " + (res.error || "ошибка"), true);
    });
  }
  // Цитата из выделения → «Мои заметки» (с источником: материал и раздел).
  function sendNote(text) {
    if (!current) return;
    var sec = "", slug = "";
    try {
      var sel = window.getSelection(), node = sel && sel.anchorNode;
      var hs = articleEl ? articleEl.querySelectorAll("h2[id],h3[id]") : [];
      for (var i = 0; i < hs.length; i++) {
        // последний заголовок ПЕРЕД выделением — раздел, откуда цитата
        if (node && (hs[i].compareDocumentPosition(node) & 4)) { sec = hs[i].getAttribute("data-title") || ""; slug = hs[i].id; }
      }
    } catch (e) {}
    sendAction({ kind: "note", text: text, rel: current.rel, title: current.title || current.name, section: sec, slug: slug }, function (res) {
      if (res.ok) toast("📝 Добавлено в «Мои заметки»");
      else toast("Не записалось: " + (res.error || "ошибка"), true);
    });
  }

