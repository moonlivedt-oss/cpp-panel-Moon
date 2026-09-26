"use strict";

// Резервная копия прогресса: окно (рантайм) зеркалит localStorage в файл, при пустом/устаревшем
// localStorage поднимает прогресс из файла; хост (lib/progress.js) проверяет файлы и делает
// ежедневные копии. Без VS Code: DOM-стаб как в test/runtime.js, настоящие файлы во временной папке.

var fs = require("fs");
var os = require("os");
var path = require("path");
var Module = require("module");

const { check, group, finish } = require("./helpers");

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-progress-"));
var MIRROR = path.join(TMP, "cpp-docs-progress.json");
var mirrorUrl = "file:///" + MIRROR.replace(/\\/g, "/").replace(/^\/+/, "");
var BRIDGE = path.join(TMP, "cpp-docs-bridge.json");
fs.writeFileSync(BRIDGE, JSON.stringify({ hosts: [{ port: 4321, token: "b".repeat(48), pid: 1 }] }));
var bridgeUrl = "file:///" + BRIDGE.replace(/\\/g, "/").replace(/^\/+/, "");
var RUNTIME = fs.readFileSync(path.join(__dirname, "..", "extension", "cpp-docs-runtime.js"), "utf8");

function el() {
  return {
    style: {}, dataset: {}, children: [], classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    setAttribute: function () {}, getAttribute: function () { return null; }, removeAttribute: function () {}, appendChild: function (c) { return c; },
    removeChild: function () {}, remove: function () {}, addEventListener: function () {}, removeEventListener: function () {},
    querySelector: function () { return null; }, querySelectorAll: function () { return []; }, insertBefore: function (c) { return c; },
    innerHTML: "", textContent: "", id: "",
  };
}
var timers = [];
/** Поднять рантайм заново с заданным содержимым localStorage. Возвращает {api, ls}. */
function boot(lsValue, opts) {
  var ls = { v: lsValue };
  timers = [];
  global.document = {
    readyState: "loading", head: el(), body: el(), documentElement: el(), createElement: el,
    createTextNode: function (t) { return { textContent: t }; }, getElementById: function () { return null; },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    addEventListener: function () {}, removeEventListener: function () {},
  };
  global.window = {
    __CPPDOCS__: { root: "docs", indexFile: "00.md", generatedAt: 1, files: [], progressUrl: mirrorUrl, bridgeUrl: bridgeUrl },
    __CPPDOCS_BOOT__: null, addEventListener: function () {}, removeEventListener: function () {},
    matchMedia: function () { return { matches: false, addEventListener: function () {} }; }, navigator: { userAgent: "node" },
  };
  // Окно живёт в песочнице VS Code: читает через vscode-file:// (здесь — настоящие файлы), пишет через мост
  // (здесь — fetch, который кладёт тело в файл хранилища, как это делает lib/bridge.js).
  global.location = { protocol: "vscode-file:" };
  global.XMLHttpRequest = function () {
    var self = this;
    this.open = function (m, u, async) { self.u = u.replace(/\?t=\d+$/, ""); self.async = async; };
    this.send = function () {
      var p = decodeURIComponent(self.u.replace(/^vscode-file:\/\/vscode-app\//, ""));
      if (!/^[A-Za-z]:/.test(p)) p = "/" + p;
      var ok = true;
      try { self.responseText = fs.readFileSync(p, "utf8"); self.status = 200; } catch (e) { ok = false; }
      if (self.async) { if (ok) self.onload && self.onload(); else self.onerror && self.onerror(); return; }
      if (!ok) throw new Error("net::ERR_FILE_NOT_FOUND");
    };
  };
  global.fetch = function (u, o) {
    var m = /\/w\/[0-9a-f]{48}\/([\w.-]+)$/.exec(u);
    if (m && o && o.method === "POST") fs.writeFileSync(path.join(TMP, m[1]), o.body);
    return Promise.resolve({ ok: true });
  };
  global.localStorage = {
    getItem: function () { return ls.v == null ? null : ls.v; },
    setItem: function (k, v) { ls.v = v; }, removeItem: function () { ls.v = null; },
  };
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ""; } }; };
  global.MutationObserver = function () { return { observe: function () {}, disconnect: function () {} }; };
  global.setInterval = function () { return 0; }; global.clearInterval = function () {};
  global.setTimeout = function (fn) { timers.push(fn); return timers.length; }; global.clearTimeout = function () {};
  (0, eval)(RUNTIME);
  return { api: global.window.__cppDocs, ls: ls };
}
function writeMirror(state, savedAt) {
  fs.writeFileSync(MIRROR, JSON.stringify({ format: "cppdocs-progress", version: 1, savedAt: savedAt, state: state }));
}
function runTimers() { var t = timers; timers = []; t.forEach(function (fn) { try { fn(); } catch (e) {} }); }

console.log("Прогресс: окно");
// 1. localStorage пуст (сброс VS Code), а зеркало есть → прогресс восстановлен
writeMirror({ read: { "ref/01-osnovy.md": true }, challenge: { c1: true }, _savedAt: 1000 }, 1000);
var b1 = boot(null);
var s1 = b1.api._state();
check("пустой localStorage → прогресс поднят из зеркала", s1.read["ref/01-osnovy.md"] === true && s1.challenge.c1 === true, s1.read);
check("восстановленный прогресс записан обратно в localStorage", /01-osnovy/.test(b1.ls.v || ""));

// 2. localStorage свежее зеркала → берём localStorage
writeMirror({ read: { old: true }, _savedAt: 1000 }, 1000);
var s2 = boot(JSON.stringify({ read: { fresh: true }, _savedAt: 5000 })).api._state();
check("localStorage новее зеркала → зеркало не трогает прогресс", s2.read.fresh === true && !s2.read.old, s2.read);

// 3. зеркало новее (импорт из файла) → берём зеркало
writeMirror({ read: { imported: true }, _savedAt: 9000 }, 9000);
var s3 = boot(JSON.stringify({ read: { mine: true }, _savedAt: 5000 })).api._state();
check("зеркало новее (импорт) → прогресс из файла", s3.read.imported === true && !s3.read.mine, s3.read);

// 4. чужой / опасный JSON в зеркале — игнорируется
fs.writeFileSync(MIRROR, JSON.stringify({ format: "cppdocs-progress", state: JSON.parse('{"__proto__":{"x":1},"read":{"evil":true}}'), savedAt: 99999 }));
var s4 = boot(JSON.stringify({ read: { safe: true }, _savedAt: 1 })).api._state();
check("зеркало с __proto__ — отвергнуто", s4.read.safe === true && !s4.read.evil, s4.read);
fs.writeFileSync(MIRROR, "{ битый json");
var s5 = boot(null).api._state();
check("битое зеркало — чистый старт без падения", s5 && typeof s5.read === "object" && !Object.keys(s5.read).length);

// 5. изменение → зеркало пишется (пачкой, по таймеру) и совпадает с localStorage
fs.unlinkSync(MIRROR);
var b6 = boot(null);
var st6 = b6.api._state();
st6.read["ref/02-vvod-vyvod.md"] = true;
b6.api._saveState();
runTimers();
var m6 = null; try { m6 = JSON.parse(fs.readFileSync(MIRROR, "utf8")); } catch (e) {}
check("после сохранения зеркало записано в формате cppdocs-progress", m6 && m6.format === "cppdocs-progress" && m6.state.read["ref/02-vvod-vyvod.md"] === true, m6 && m6.format);
check("у зеркала и localStorage одна метка времени", m6 && m6.savedAt === JSON.parse(b6.ls.v)._savedAt);
check("временный файл после записи не остался", !fs.existsSync(MIRROR + ".tmp"));

// 6. более новое зеркало (импорт уже лёг) не затирается старым окном
writeMirror({ read: { imported: true }, _savedAt: Date.now() + 60000 }, Date.now() + 60000);
b6.api._saveState();
runTimers();
var m7 = JSON.parse(fs.readFileSync(MIRROR, "utf8"));
check("старое окно не затирает более новое зеркало (импорт)", m7.state.read.imported === true, m7.state.read);

// 7. после импорта (метка «на минуту вперёд») окно продолжает писать зеркало, а не замолкает
var F = Date.now() + 60000;
writeMirror({ read: { imported: true }, _savedAt: F }, F);
var b8 = boot(JSON.stringify({ read: { mine: true }, _savedAt: 5 }));
b8.api._state().read.after = true;
b8.api._saveState();
runTimers();
var m8 = JSON.parse(fs.readFileSync(MIRROR, "utf8"));
check("после импорта следующее сохранение пишет зеркало (метка монотонна)", m8.state.read.after === true && m8.savedAt > F, m8.savedAt - F);

// 8. (заодно — тот же механизм чтения с диска) наклейки из stickers.json приходят по требованию
var SFILE = path.join(TMP, "stickers.json");
fs.writeFileSync(SFILE, JSON.stringify({ "mascot-hi": "data:image/webp;base64,QUJD" }));
var b9 = boot(null);
global.window.__CPPDOCS__.stickersAllUrl = "file:///" + SFILE.replace(/\\/g, "/").replace(/^\/+/, "");
check("наклейки: файл stickers.json читается при первом обращении", b9.api._sticker("mascot-hi") === "data:image/webp;base64,QUJD");

// 9. Песочница VS Code: у окна нет Node — наклейки приходят адресами картинок vscode-file://
var b10 = boot(null, { noNode: true });
global.window.__CPPDOCS__.stickerImgs = { base: "file:///c:/Users/Мы/st", files: { "mascot-hi": "mascot-hi.webp", "bad": "x.exe", "ev\"il": "a.webp" } };
check("без Node: наклейка — адрес vscode-file:// (кириллица закодирована)", b10.api._sticker("mascot-hi") === "vscode-file://vscode-app/c:/Users/%D0%9C%D1%8B/st/mascot-hi.webp", b10.api._sticker("mascot-hi"));
check("без Node: не-картинка и кривое имя отброшены", b10.api._sticker("bad") === undefined && b10.api._sticker("ev\"il") === undefined);

group("Прогресс: расширение (lib/progress.js)");
var origResolve = Module._resolveFilename;
Module._resolveFilename = function (r) { if (r === "vscode") return "vscode-stub-progress"; return origResolve.apply(this, arguments); };
require.cache["vscode-stub-progress"] = {
  id: "vscode-stub-progress", filename: "vscode-stub-progress", loaded: true,
  exports: { workspace: { getConfiguration: function () { return { get: function () {} }; } }, window: {}, commands: {}, languages: {}, Uri: { file: function (p) { return { fsPath: p }; } } },
};
var P = require(path.join(__dirname, "..", "extension", "lib", "progress.js"));
Module._resolveFilename = origResolve;
check("parseProgress: наш формат", !!P.parseProgress(JSON.stringify({ format: "cppdocs-progress", savedAt: 1, state: { read: {} } })));
check("parseProgress: «голое» состояние тоже принимается", !!P.parseProgress(JSON.stringify({ read: { a: true } })));
check("parseProgress: чужой JSON — нет", P.parseProgress(JSON.stringify({ name: "package" })) === null);
check("parseProgress: массив / битый — нет", P.parseProgress("[1]") === null && P.parseProgress("{x") === null);
check("parseProgress: __proto__ — нет", P.parseProgress('{"__proto__":{},"read":{}}') === null);

// раскладка наклеек файлами (для окна без Node)
Module._resolveFilename = function (r) { if (r === "vscode") return "vscode-stub-progress"; return origResolve.apply(this, arguments); };
var DJ = require(path.join(__dirname, "..", "extension", "lib", "data.js"));
Module._resolveFilename = origResolve;
var EXTD = path.join(TMP, "ext");
fs.mkdirSync(EXTD, { recursive: true });
fs.writeFileSync(path.join(EXTD, "stickers.json"), JSON.stringify({ "mascot-hi": "data:image/webp;base64,QUJD", "evil": "javascript:1", "../x": "data:image/png;base64,QQ==" }));
var ctx2 = { extensionPath: EXTD, globalStorageUri: { fsPath: TMP } };
var ex = DJ.extractImages(ctx2, "stickers.json", "stickers");
check("наклейки разложены файлами: только картинки с чистыми именами", ex && Object.keys(ex.files).join() === "mascot-hi" &&
  fs.readFileSync(path.join(TMP, "stickers", "mascot-hi.webp"), "utf8") === "ABC", ex && ex.files);
var ex2 = DJ.extractImages(ctx2, "stickers.json", "stickers");
check("повторный запуск без изменений — те же файлы (по метке .source)", ex2 && ex2.files["mascot-hi"] === "mascot-hi.webp");
check("нет stickers.json — null, без исключения", DJ.extractImages({ extensionPath: TMP, globalStorageUri: { fsPath: TMP } }, "нет.json", "x") === null);

var ctx = { globalStorageUri: { fsPath: TMP } };
writeMirror({ read: { a: true } }, 1);
var bdir = P.backupDir(ctx);
fs.mkdirSync(bdir, { recursive: true });
for (var d = 1; d <= 20; d++) fs.writeFileSync(path.join(bdir, "progress-2020-01-" + String(d).padStart(2, "0") + ".json"), "{}");
P.dailyBackup(ctx);
var left = fs.readdirSync(bdir).filter(function (f) { return /^progress-\d/.test(f); });
check("ежедневная копия: сегодняшняя создана", left.some(function (f) { return f.indexOf(new Date().getFullYear() + "-") > 0 && f !== "progress-2020-01-20.json" && !/2020/.test(f); }), left.length);
check("ежедневная копия: хранятся последние 14", left.length === 14, left.length);

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
finish("Прогресс");
