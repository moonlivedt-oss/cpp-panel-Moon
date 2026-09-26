"use strict";

// Мост «окно → расширение» (extension/lib/bridge.js): настоящий HTTP-сервер на 127.0.0.1,
// настоящие запросы. Проверяем, что пишет ровно то, что должен, и отбивает всё остальное.
// Плюс сторона окна (рантайм): без Node читает через vscode-file://, пишет через мост.

var fs = require("fs");
var os = require("os");
var path = require("path");
var http = require("http");
var Module = require("module");

const { check, group, finish } = require("./helpers");

var orig = Module._resolveFilename;
Module._resolveFilename = function (r) { if (r === "vscode") return "vscode-stub-bridge"; return orig.apply(this, arguments); };
require.cache["vscode-stub-bridge"] = { id: "vscode-stub-bridge", filename: "vscode-stub-bridge", loaded: true,
  exports: { workspace: { getConfiguration: function () { return { get: function () {} }; } }, window: {}, commands: {} } };
var B = require(path.join(__dirname, "..", "extension", "lib", "bridge.js"));
Module._resolveFilename = orig;

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-bridge-"));
var ctx = { globalStorageUri: { fsPath: TMP }, subscriptions: [] };

function req(opts, body) {
  return new Promise(function (resolve) {
    var r = http.request(Object.assign({ host: "127.0.0.1" }, opts), function (res) {
      var d = ""; res.on("data", function (c) { d += c; }); res.on("end", function () { resolve({ code: res.statusCode, headers: res.headers, body: d }); });
    });
    r.on("error", function (e) { resolve({ code: 0, error: String(e) }); });
    if (body != null) r.write(body);
    r.end();
  });
}
function waitFile(f, ms) {
  return new Promise(function (resolve) {
    var t0 = Date.now();
    (function poll() { if (fs.existsSync(f)) return resolve(true); if (Date.now() - t0 > ms) return resolve(false); setTimeout(poll, 30); })();
  });
}

(async function () {
  console.log("Мост: расширение");
  // обработчик запросов окна: action «не в фокусе» → retry (как у хоста окна VS Code без фокуса)
  var calls = [];
  B.startBridge(ctx, function (method, body, opts) {
    calls.push({ method: method, body: body, opts: opts });
    if (method === "action" && body && body.kind === "unfocused") return Promise.resolve({ id: body.id, ok: false, retry: true });
    return Promise.resolve({ id: body && body.id, ok: true, method: method });
  });
  var info = null;
  if (await waitFile(B.bridgeFilePath(ctx), 3000)) info = JSON.parse(fs.readFileSync(B.bridgeFilePath(ctx), "utf8"));
  check("адрес моста записан в хранилище (порт + токен)", info && info.port > 0 && /^[0-9a-f]{48}$/.test(info.token), info);
  var P = info.port, T = info.token, H = { host: "127.0.0.1:" + P, origin: "vscode-file://vscode-app" };
  var mirrorText = JSON.stringify({ format: "cppdocs-progress", version: 1, savedAt: 1, state: { read: {} } });

  var ok = await req({ port: P, method: "POST", path: "/w/" + T + "/cpp-docs-progress.json", headers: H }, mirrorText);
  check("POST зеркала прогресса → 204 и файл записан", ok.code === 204 && fs.readFileSync(path.join(TMP, "cpp-docs-progress.json"), "utf8") === mirrorText, ok.code);
  check("ответ разрешает оболочку (CORS) и локальную сеть (PNA)", ok.headers["access-control-allow-origin"] === "vscode-file://vscode-app" && ok.headers["access-control-allow-private-network"] === "true");
  check("временный файл не остался", !fs.readdirSync(TMP).some(function (n) { return /\.tmp$/.test(n); }));

  // Запросы с ответом сразу (POST /rpc/<токен>/<метод>)
  var r1 = await req({ port: P, method: "POST", path: "/rpc/" + T + "/run", headers: H }, JSON.stringify({ id: "r1", code: "int main(){}", tests: [] }));
  var j1 = null; try { j1 = JSON.parse(r1.body); } catch (e) {}
  check("rpc run → 200 и ответ обработчика", r1.code === 200 && j1 && j1.id === "r1" && j1.ok === true && j1.method === "run", r1);
  check("rpc: мосту обработчик зовётся с requireFocus", calls.length === 1 && calls[0].opts && calls[0].opts.requireFocus === true);
  var r2 = await req({ port: P, method: "POST", path: "/rpc/" + T + "/action", headers: H }, JSON.stringify({ id: "a1", kind: "unfocused" }));
  check("rpc action в окне без фокуса → 409 (окно попробует другой хост)", r2.code === 409, r2.code);
  var r3 = await req({ port: P, method: "POST", path: "/rpc/" + T + "/format-disk", headers: H }, "{}");
  check("rpc: неизвестный метод → 404", r3.code === 404);

  var pre = await req({ port: P, method: "OPTIONS", path: "/rpc/" + T + "/run", headers: H });
  check("предзапрос OPTIONS → 204", pre.code === 204);
  var bad = await req({ port: P, method: "POST", path: "/rpc/" + "0".repeat(48) + "/run", headers: H }, "{}");
  check("чужой токен → 403", bad.code === 403);
  var site = await req({ port: P, method: "POST", path: "/rpc/" + T + "/run", headers: { host: H.host, origin: "https://evil.example" } }, "{}");
  check("чужой Origin (сайт в браузере) → 403", site.code === 403);
  var reb = await req({ port: P, method: "POST", path: "/rpc/" + T + "/run", headers: { host: "evil.example:" + P, origin: H.origin } }, "{}");
  check("подмена Host (DNS-rebinding) → 403", reb.code === 403);
  var name = await req({ port: P, method: "POST", path: "/w/" + T + "/settings.json", headers: H }, "{}");
  check("неизвестный файл → 404, ничего не записано", name.code === 404 && !fs.existsSync(path.join(TMP, "settings.json")));
  var trav = await req({ port: P, method: "POST", path: "/w/" + T + "/..%2F..%2Fx.json", headers: H }, "{}");
  check("путь с ../ → отказ", trav.code >= 400);
  var nj = await req({ port: P, method: "POST", path: "/rpc/" + T + "/run", headers: H }, "не json");
  check("не JSON → 400", nj.code === 400);
  var getRpc = await req({ port: P, method: "GET", path: "/rpc/" + T + "/run", headers: H });
  check("rpc через GET → 405", getRpc.code === 405);
  var ping = await req({ port: P, method: "GET", path: "/ping/" + T, headers: H });
  var st = B.bridgeStatus();
  check("ping и статус: окно выходило на связь, записей 1", ping.code === 200 && st.running && st.lastSeen > 0 && st.writes === 1, st);

  // Поток событий (SSE): окно получает контекст редактора и метку без опроса файлов.
  var got = await new Promise(function (resolve) {
    var r = http.request({ host: "127.0.0.1", port: P, method: "GET", path: "/events/" + T, headers: H }, function (res) {
      var d = "";
      res.on("data", function (c) { d += c; if (/event: editor/.test(d)) { r.destroy(); resolve({ code: res.statusCode, type: res.headers["content-type"], body: d }); } });
      setTimeout(function () { B.broadcast("editor", "window.__CPPDOCS_EDITOR__ = {\"word\":\"vector\"};"); }, 50);
    });
    r.on("error", function () {});
    r.end();
    setTimeout(function () { resolve(null); }, 2000);
  });
  check("поток событий: text/event-stream, событие editor доходит", got && got.code === 200 && /event-stream/.test(got.type) && /data: window.__CPPDOCS_EDITOR__/.test(got.body), got);
  var evBad = await req({ port: P, method: "GET", path: "/events/" + "0".repeat(48), headers: H });
  check("поток событий с чужим токеном → 403", evBad.code === 403);

  // Несколько окон VS Code: второй хост (живой процесс) в списке сохраняется, при выгрузке уходит только наш.
  var other = { port: 5555, token: "c".repeat(48), pid: process.ppid || 1, ts: 1 };
  var cur = JSON.parse(fs.readFileSync(B.bridgeFilePath(ctx), "utf8"));
  cur.hosts.push(other);
  cur.hosts.push({ port: 6666, token: "d".repeat(48), pid: 999999, ts: 1 });   // мёртвый процесс
  fs.writeFileSync(B.bridgeFilePath(ctx), JSON.stringify(cur));
  var hosts = B.readHosts(B.bridgeFilePath(ctx));
  check("список хостов: мёртвый процесс отброшен, живые остались", hosts.length === 2 && hosts.some(function (h) { return h.token === other.token; }), hosts.length);

  ctx.subscriptions.forEach(function (d) { try { d.dispose(); } catch (e) {} });
  var left = B.readHosts(B.bridgeFilePath(ctx));
  check("при выключении из списка ушёл только этот хост", left.length === 1 && left[0].token === other.token, left);
  fs.writeFileSync(B.bridgeFilePath(ctx), JSON.stringify({ hosts: [] }));
  try { fs.unlinkSync(B.bridgeFilePath(ctx)); } catch (e) {}
  check("при выключении последнего хоста адрес моста удалён", !fs.existsSync(B.bridgeFilePath(ctx)));


  group("Мост: окно (рантайм без Node)");
  var el = function () {
    return { style: {}, dataset: {}, children: [], classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      setAttribute: function () {}, getAttribute: function () { return null; }, removeAttribute: function () {}, appendChild: function (c) { return c; }, removeChild: function () {},
      remove: function () {}, addEventListener: function () {}, removeEventListener: function () {}, querySelector: function () { return null; }, querySelectorAll: function () { return []; },
      insertBefore: function (c) { return c; }, innerHTML: "", textContent: "", id: "" };
  };
  var files = {}, sent = [];
  files["vscode-file://vscode-app/c:/st/cpp-docs-bridge.json"] = JSON.stringify({ hosts: [{ port: 4321, token: "a".repeat(48) }, { port: 4322, token: "b".repeat(48) }] });
  files["vscode-file://vscode-app/c:/st/%D0%B4/cpp-docs-editor.js"] = "window.__CPPDOCS_EDITOR__ = {};";
  global.location = { protocol: "vscode-file:" };
  global.XMLHttpRequest = function () {
    var self = this;
    this.open = function (m, u) { self.u = u.replace(/\?t=\d+$/, ""); };
    this.send = function () { if (!(self.u in files)) throw new Error("net::ERR_FILE_NOT_FOUND"); self.status = 200; self.responseText = files[self.u]; };
  };
  // хост 4321 — «не в фокусе» (409 на action), хост 4322 — отвечает
  global.fetch = function (u, o) {
    sent.push({ u: u, o: o });
    if (/\/rpc\//.test(u)) {
      if (/:4321\//.test(u) && /\/action$/.test(u)) return Promise.resolve({ ok: false, status: 409, json: function () { return Promise.resolve({ retry: true }); } });
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ id: JSON.parse(o.body).id, ok: true, via: u.slice(0, 22) }); } });
    }
    return Promise.resolve({ ok: true, status: 204 });
  };
  global.document = { readyState: "loading", head: el(), body: el(), documentElement: el(), createElement: el, createTextNode: function (t) { return { textContent: t }; },
    getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, addEventListener: function () {}, removeEventListener: function () {} };
  global.window = { __CPPDOCS__: { root: "docs", indexFile: "00.md", generatedAt: 1, files: [], bridgeUrl: "file:///c:/st/cpp-docs-bridge.json",
    progressUrl: "file:///c:/st/cpp-docs-progress.json" }, __CPPDOCS_BOOT__: null, addEventListener: function () {}, removeEventListener: function () {},
    matchMedia: function () { return { matches: false, addEventListener: function () {} }; }, navigator: { userAgent: "node" } };
  global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ""; } }; };
  global.MutationObserver = function () { return { observe: function () {}, disconnect: function () {} }; };
  var timers = [];
  global.setInterval = function () { return 0; }; global.clearInterval = function () {};
  global.setTimeout = function (fn) { timers.push(fn); return 1; }; global.clearTimeout = function () {};
  (0, eval)(fs.readFileSync(path.join(__dirname, "..", "extension", "cpp-docs-runtime.js"), "utf8"));
  var api = global.window.__cppDocs;
  check("чтение без Node: файл хранилища через vscode-file:// (кириллица закодирована)", api._read("file:///c:/st/д/cpp-docs-editor.js") === "window.__CPPDOCS_EDITOR__ = {};");
  check("чтение без Node: файла нет — null, без исключения", api._read("file:///c:/st/нет.js") === null);
  api._state().read.x = true; api._saveState(); timers.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  var mirror = sent.filter(function (s) { return /cpp-docs-progress\.json$/.test(s.u); })[0];
  check("зеркало прогресса без Node уходит через мост", mirror && mirror.u === "http://127.0.0.1:4321/w/" + "a".repeat(48) + "/cpp-docs-progress.json" && JSON.parse(mirror.o.body).state.read.x === true, mirror && mirror.u);
  check("запись файла не из списка — не отправляется", api._write("file:///c:/st/settings.json", "{}") === false);
  check("старые файловые каналы (run-req) больше не пишутся", api._write("file:///c:/st/cpp-docs-run-req.json", "{}") === false);
  var rr = null; api._rpc("run", { id: "q1", code: "", tests: [] }, 1000, function (r) { rr = r; });
  var ra = null; api._rpc("action", { id: "q2", kind: "insert", code: "x" }, 1000, function (r) { ra = r; });
  for (var k = 0; k < 20 && !(rr && ra); k++) await new Promise(function (res) { setImmediate(res); });
  check("rpc run — ответ первого хоста", rr && rr.id === "q1" && /:4321\//.test(rr.via), rr);
  check("rpc action: хост без фокуса ответил 409 — окно взяло следующий", ra && ra.id === "q2" && /:4322\//.test(ra.via), ra);

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  finish("Мост окно ↔ расширение");
})();
