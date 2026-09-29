"use strict";

// Новое API Moon Core в рантайме окна: выключение модуля без перезагрузки окна (всё глобальное
// снимается, повторное включение запустит файл заново) и общая шина модулей (акцент фона
// «mlbg.accent», своё состояние «cppdocs.view»). Рантайм грузится под DOM-стабом без boot.

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
// Учёт подписок окна и документа: сколько повесили и сколько сняли.
var added = [], removed = [];
function trackTarget(name, obj) {
  obj.addEventListener = function (ev, fn) { added.push(name + ":" + ev); };
  obj.removeEventListener = function (ev, fn) { removed.push(name + ":" + ev); };
  return obj;
}
var byId = { "cppdocs-launch": makeEl(), "cppdocs-style": makeEl() };
var doc = trackTarget("document", {
  readyState: "loading",
  head: makeEl(), body: makeEl(), documentElement: makeEl(),
  createElement: function () { return makeEl(); },
  createTextNode: function (t) { return { textContent: t }; },
  getElementById: function (id) { return byId[id] || null; },
  querySelector: function () { return null; }, querySelectorAll: function () { return []; },
});
global.document = doc;
var shared = {}, sharedSubs = {}, disposers = [];
global.window = trackTarget("window", {
  __CPPDOCS__: null, __CPPDOCS_BOOT__: null,
  __MOONCORE__: { module: function (id) {
    if (id !== "cppdocs") return null;
    return {
      data: function () { return null; }, on: function () { return function () {}; }, rpc: function () { return Promise.resolve({ ok: true }); },
      onDispose: function (fn) { disposers.push(fn); },
      share: function (k, v) { shared[k] = v; return true; },
      shared: function (k, fn) { (sharedSubs[k] = sharedSubs[k] || []).push(fn); return function () { sharedSubs[k] = []; }; },
    };
  } },
  setInterval: function () { return 0; }, clearInterval: function () {},
  setTimeout: function () { return 0; }, clearTimeout: function () {},
  matchMedia: function () { return { matches: false, addEventListener: function () {} }; },
});
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
global.window.navigator = { userAgent: "node-test" };
global.getComputedStyle = function () { return { getPropertyValue: function () { return ""; } }; };
global.MutationObserver = function () { return { observe: function () {}, disconnect: function () {} }; };
global.setInterval = function () { return 0; };
global.clearInterval = function () {};
global.setTimeout = function () { return 0; };
global.clearTimeout = function () {};

var code = fs.readFileSync(path.join(__dirname, "..", "extension", "cpp-docs-runtime.js"), "utf8");
var loaded = false;
try { (0, eval)(code); loaded = true; } catch (e) { console.log(e && e.stack || e); }

group("Moon Core: новое API в окне");
check("рантайм загрузился с модулем Moon Core", loaded && !!(global.window.__cppDocs && global.window.__cppDocs._mc));
var mc = global.window.__cppDocs._mc;
var nGlobal = mc.offCount();
check("глобальные подписки окна и документа — снимаемые", nGlobal >= 8, nGlobal);

mc.api();
check("уборка зарегистрирована в Moon Core (onDispose)", disposers.length === 1);
check("акцент фона — подписка на общую шину «mlbg.accent»", (sharedSubs["mlbg.accent"] || []).length === 1);
check("своё состояние — в шину «cppdocs.view»", shared["cppdocs.view"] && shared["cppdocs.view"].open === false, shared["cppdocs.view"]);
var accentCalls = 0;
try { sharedSubs["mlbg.accent"][0]({ hex: "#ff0000", rgb: [255, 0, 0] }, "mlbg"); accentCalls = 1; } catch (e) {}
check("смена акцента в шине не роняет окно", accentCalls === 1);

var beforeRemoved = removed.length;
global.window.__CPPDOCS_RUNTIME__ = true;
disposers[0]();
check("выключение: сняты все глобальные подписки", removed.length - beforeRemoved >= nGlobal, { added: added.length, removed: removed.length - beforeRemoved });
check("выключение: пилюля и стиль окна убраны", byId["cppdocs-launch"].removed === true && byId["cppdocs-style"].removed === true);
check("выключение: подписка на шину снята", (sharedSubs["mlbg.accent"] || []).length === 0);
check("выключение: состояние убрано из шины", shared["cppdocs.view"] === undefined);
check("выключение: метка «рантайм уже запущен» снята — повторное включение запустит окно", global.window.__CPPDOCS_RUNTIME__ === false);
check("выключение: мост для тестов убран", global.window.__cppDocs === undefined);
var again = 0;
try { mc.stop(); again = 1; } catch (e) {}
check("повторное выключение безопасно", again === 1);

// Манифест модуля: ленивая загрузка (927 КБ рантайма не разбираются на старте окна).
var pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "extension", "package.json"), "utf8"));
var man = pkg.moonCore && pkg.moonCore.modules && pkg.moonCore.modules[0];
check("манифест: модуль ленивый, с задержкой после загрузки окна", !!(man && man.lazy && man.lazy.delay > 0 && man.lazy.delay <= 5000), man && man.lazy);

finish("Moon Core: новое API");
