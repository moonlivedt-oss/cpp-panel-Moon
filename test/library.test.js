"use strict";

// Две библиотеки документации (C++ и Unreal) — два разных окна. Переключение останавливает окно
// одной библиотеки целиком и запускает рантайм заново с заготовкой другой: ни материалов, ни
// файла данных, ни ключа localStorage прежней библиотеки новое окно не трогает.
// Рантайм грузится под DOM-стабом; файлы «читаются» синхронным XHR-стабом (учёт адресов).

var fs = require("fs");
var path = require("path");
const { check, group, finish } = require("./helpers");

function makeEl() {
  return {
    style: {}, dataset: {}, children: [], parentNode: null,
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    setAttribute: function () {}, getAttribute: function () { return null; }, removeAttribute: function () {},
    appendChild: function (c) { this.children.push(c); return c; }, removeChild: function () {}, remove: function () { this.removed = true; },
    addEventListener: function () {}, removeEventListener: function () {},
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    insertBefore: function (c) { this.children.push(c); return c; },
    innerHTML: "", textContent: "", id: "",
  };
}

var S = "file:///C:/store/";
function libsMeta() {
  return {
    cpp: { title: "Документация C++", short: "C++", available: true,
      dataUrl: S + "cpp-docs-data.js", stampUrl: S + "cpp-docs-stamp.js", progressUrl: S + "cpp-docs-progress.json" },
    unreal: { title: "Документация Unreal Engine", short: "UE", available: true,
      dataUrl: S + "cpp-docs-data-unreal.js", stampUrl: S + "cpp-docs-stamp-unreal.js", progressUrl: S + "cpp-docs-progress-unreal.json" },
  };
}
function cppData() {
  return {
    lib: "cpp", root: "D:/docs", indexFile: "00-НАЧНИ-ОТСЮДА.md", generatedAt: 1,
    files: [{ rel: "00-НАЧНИ-ОТСЮДА.md", name: "00-НАЧНИ-ОТСЮДА.md", title: "Старт C++", subtitle: "", group: "Главное", md: "# Старт C++\nтекст про C++" }],
    dataUrl: S + "cpp-docs-data.js", stampUrl: S + "cpp-docs-stamp.js", progressUrl: S + "cpp-docs-progress.json",
    libUrl: S + "cpp-docs-lib.json", bridgeUrl: S + "cpp-docs-bridge.json", editorUrl: S + "cpp-docs-editor.js",
    libs: libsMeta(), scriptNonce: "NONCE1",
  };
}

// Окружение: файлы хранилища (чтение через XHR-стаб), localStorage с учётом ключей, таймеры вручную.
var files = {}, reads = [], lsSet = [], lsStore = {}, timers = [];
function setup(data, libFile) {
  files = {}; reads = []; lsSet = []; lsStore = {}; timers = [];
  if (libFile) files["cpp-docs-lib.json"] = JSON.stringify(libFile);
  global.document = {
    readyState: "loading", head: makeEl(), body: makeEl(), documentElement: makeEl(),
    createElement: function () { return makeEl(); }, createTextNode: function (t) { return { textContent: t }; },
    getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    addEventListener: function () {}, removeEventListener: function () {},
  };
  global.window = {
    __CPPDOCS__: data, __CPPDOCS_BOOT__: null,
    addEventListener: function () {}, removeEventListener: function () {},
    matchMedia: function () { return { matches: false, addEventListener: function () {} }; }, navigator: { userAgent: "node" },
  };
  global.location = { protocol: "vscode-file:", href: "vscode-file://vscode-app/workbench.html" };
  global.XMLHttpRequest = function () {
    var x = this;
    x.open = function (m, u) { x.url = String(u).split("?")[0]; };
    x.send = function () {
      reads.push(x.url);
      var name = x.url.split("/").pop();
      if (Object.prototype.hasOwnProperty.call(files, name)) { x.status = 200; x.responseText = files[name]; } else { x.status = 404; x.responseText = ""; }
      if (x.onload) x.onload();
    };
  };
  global.localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(lsStore, k) ? lsStore[k] : null; },
    setItem: function (k, v) { lsSet.push(k); lsStore[k] = String(v); }, removeItem: function () {},
  };
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ""; } }; };
  global.MutationObserver = function () { return { observe: function () {}, disconnect: function () {} }; };
  global.setTimeout = function (fn) { timers.push(fn); return timers.length; };
  global.clearTimeout = function () {};
  global.setInterval = function () { return 0; };
  global.clearInterval = function () {};
}
var code = fs.readFileSync(path.join(__dirname, "..", "extension", "cpp-docs-runtime.js"), "utf8");
function load() { (0, eval)(code); return global.window.__cppDocs; }
function runTimers() { var t = timers.splice(0); t.forEach(function (fn) { try { fn(); } catch (e) { /* таймеры окна */ } }); }

group("Переключатель библиотеки: старт");
setup(cppData(), { lib: "cpp", at: 1 });
var api = load();
check("окно C++ стартует библиотекой C++", api && api._lib.id() === "cpp");
check("ключ localStorage у C++ прежний", api._lib.lsKey() === "cppdocs.ui.v1", api._lib.lsKey());
check("другая библиотека для кнопки — Unreal", api._lib.other() === "unreal");
check("события своей библиотеки: stamp / progress", api._lib.ev("stamp") === "stamp" && api._lib.ev("progress") === "progress");
var san = api._lib.sanitize(cppData());
check("санитизация сохраняет lib, libs и libUrl", san.lib === "cpp" && san.libs && san.libs.unreal && san.libs.unreal.dataUrl === S + "cpp-docs-data-unreal.js" && san.libUrl === S + "cpp-docs-lib.json");
var bad = cppData(); bad.lib = "../x"; bad.libs = { "__proto__": {}, "Bad-Id": { title: "x" } };
var san2 = api._lib.sanitize(bad);
check("санитизация: чужие id библиотек и lib отбрасываются", san2.lib === undefined && san2.libs === undefined, san2);

group("Переключатель библиотеки: C++ → Unreal");
reads = [];
var ok = api._lib.switchTo("unreal");
check("переключение принято", ok === true);
var stub = global.window.__CPPDOCS__;
check("данные C++ отпущены: в окне заготовка Unreal без материалов", stub && stub.lib === "unreal" && stub.files.length === 0 && stub.lazy === true);
check("заготовка ведёт на файлы Unreal", stub.dataUrl === S + "cpp-docs-data-unreal.js" && stub.stampUrl === S + "cpp-docs-stamp-unreal.js" && stub.progressUrl === S + "cpp-docs-progress-unreal.json");
check("в заготовке нет текста C++", JSON.stringify(stub).indexOf("текст про C++") === -1);
check("nonce переносится в новый запуск", stub.scriptNonce === "NONCE1");
check("выбор запомнен в localStorage", lsStore["cppdocs.lib"] === "unreal");
check("старое окно остановлено (мост для тестов снят)", global.window.__cppDocs === undefined && global.window.__CPPDOCS_RUNTIME__ === false);
runTimers();
var api2 = global.window.__cppDocs;
check("рантайм запущен заново — уже окном Unreal", api2 && api2._lib.id() === "unreal");
check("у Unreal свой ключ localStorage", api2._lib.lsKey() === "cppdocs.unreal.ui.v1", api2._lib.lsKey());
check("события Unreal: stamp-unreal / progress-unreal", api2._lib.ev("stamp") === "stamp-unreal" && api2._lib.ev("progress") === "progress-unreal");
check("кнопка в окне Unreal ведёт обратно в C++", api2._lib.other() === "cpp");
check("новое окно не читало файлы C++ (данные, метку, прогресс)", reads.every(function (u) { return !/cpp-docs-(data|stamp|progress)\.(js|json)$/.test(u); }), reads);
check("ключ C++ в localStorage новым окном не записан", lsSet.indexOf("cppdocs.ui.v1") === -1 || lsSet.lastIndexOf("cppdocs.ui.v1") < lsSet.indexOf("cppdocs.lib"), lsSet);

group("Переключатель библиотеки: события и опрос файла выбора");
check("событие «lib» той же библиотеки ничего не делает", (api2._lib.onEvent(JSON.stringify({ lib: "unreal", at: 5 })), global.window.__cppDocs === api2));
check("мусор в событии «lib» не роняет окно", (api2._lib.onEvent("{не json"), api2._lib.onEvent(JSON.stringify({ lib: "../evil" })), global.window.__cppDocs === api2));
files["cpp-docs-lib.json"] = JSON.stringify({ lib: "cpp", at: 1 });
api2._lib.poll();
check("первый опрос файла выбора только запоминает метку (кнопку не откатывает)", global.window.__cppDocs === api2 && api2._lib.id() === "unreal");
files["cpp-docs-lib.json"] = JSON.stringify({ lib: "cpp", at: 9 });
api2._lib.poll();
runTimers();
var api3 = global.window.__cppDocs;
check("выбор сменили в VS Code — окно переключилось обратно на C++", api3 && api3._lib.id() === "cpp" && global.window.__CPPDOCS__.dataUrl === S + "cpp-docs-data.js");

group("Переключатель библиотеки: старт с выбранной Unreal");
setup(cppData(), { lib: "unreal", at: 3 });
var api4 = load();
check("впечатано оглавление C++, а выбрана Unreal — окно сразу Unreal", api4 && api4._lib.id() === "unreal");
check("оглавление C++ отброшено", global.window.__CPPDOCS__.files.length === 0 && global.window.__CPPDOCS__.lib === "unreal");

group("Переключатель библиотеки: Unreal недоступна");
var noUe = cppData(); noUe.libs.unreal.available = false;
setup(noUe, { lib: "unreal", at: 3 });
var api5 = load();
check("папки Unreal нет — остаёмся на C++ и кнопки нет", api5._lib.id() === "cpp" && api5._lib.other() === "");
check("переключиться на недоступную нельзя", api5._lib.switchTo("unreal") === false && global.window.__cppDocs === api5);

finish("Переключатель библиотеки");
