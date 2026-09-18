"use strict";

// Поведенческие тесты рантайма БЕЗ зависимостей: поднимаем крошечный DOM-стаб, грузим
// cpp-docs-runtime.js и дёргаем его настоящий renderMarkdown (window.__cppDocs.render).
// Это ловит реальные регрессии рендера/безопасности схем, а не наличие строки в исходнике.
//
// Трюк: document.readyState = "loading" — тогда boot() откладывается на DOMContentLoaded
// (который мы не шлём), IIFE успевает выставить window.__cppDocs, и тяжёлый DOM для boot не нужен.

var fs = require("fs");
var path = require("path");

var checks = 0;
var failures = [];
function check(name, cond, extra) {
  checks++;
  if (cond) { console.log("  ok   " + name); }
  else { failures.push(name + (extra ? " — " + extra : "")); console.log("  NOT  " + name + (extra ? " — " + extra : "")); }
}

// --- минимальный DOM/окружение ---
function makeEl() {
  return {
    style: {}, dataset: {}, children: [],
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    setAttribute: function () {}, getAttribute: function () { return null; }, removeAttribute: function () {},
    appendChild: function (c) { this.children.push(c); return c; }, removeChild: function () {}, remove: function () {},
    addEventListener: function () {}, removeEventListener: function () {},
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    insertBefore: function (c) { this.children.push(c); return c; },
    innerHTML: "", textContent: "", id: "",
  };
}
var doc = {
  readyState: "loading",                 // ← boot откладывается, IIFE доезжает до window.__cppDocs
  head: makeEl(), body: makeEl(), documentElement: makeEl(),
  createElement: function () { return makeEl(); },
  createTextNode: function (t) { return { textContent: t }; },
  getElementById: function () { return null; },
  querySelector: function () { return null; }, querySelectorAll: function () { return []; },
  addEventListener: function () {}, removeEventListener: function () {},
};
global.document = doc;
global.window = {
  __CPPDOCS__: null, __CPPDOCS_BOOT__: null,
  addEventListener: function () {}, removeEventListener: function () {},
  setInterval: function () { return 0; }, clearInterval: function () {},
  setTimeout: function () { return 0; }, clearTimeout: function () {},
  matchMedia: function () { return { matches: false, addEventListener: function () {} }; },
};
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
// global.navigator в Node 24 — только для чтения; рантайму хватит встроенного.
global.window.navigator = { userAgent: "node-test" };
global.getComputedStyle = function () { return { getPropertyValue: function () { return ""; } }; };
global.MutationObserver = function () { return { observe: function () {}, disconnect: function () {} }; };
global.setInterval = function () { return 0; };
global.clearInterval = function () {};
global.setTimeout = function () { return 0; };
global.clearTimeout = function () {};

// --- загрузка рантайма ---
console.log("Рантайм: загрузка под DOM-стабом");
var code = fs.readFileSync(path.join(__dirname, "..", "extension", "cpp-docs-runtime.js"), "utf8");
var loaded = false;
try { (0, eval)(code); loaded = true; } catch (e) { console.log("  NOT  рантайм загрузился без ошибок — " + (e && e.stack || e)); }
check("рантайм загрузился под DOM-стабом", loaded);
var api = global.window.__cppDocs;
check("экспортирован мост window.__cppDocs.render", !!(api && typeof api.render === "function"));

var render = api && api.render;
function R(md) { try { return render(md); } catch (e) { return "THROW:" + (e && e.message || e); } }

// --- поведение рендера ---
console.log("\nРантайм: рендер и безопасность схем");
if (render) {
  check("жирный текст → <strong>", R("**жирно**").indexOf("<strong>") !== -1);
  check("инлайн-код → <code>", R("текст `x` тут").indexOf("<code>") !== -1);
  check("сырой < экранируется", R("a < b").indexOf("a &lt; b") !== -1);
  check("литеральный </script> не выходит сырым", R("тест </script> тут").indexOf("</script>") === -1);

  var js = R("[клик](javascript:alert(1))");
  check("javascript:-ссылка обезврежена (href=\"#\")", /href="#"/.test(js) && js.indexOf("javascript:") === -1);
  var mail = R("[почта](mailto:a@b.c)");
  check("mailto:-ссылка сохранена", mail.indexOf('href="mailto:a@b.c"') !== -1);
  var http = R("[сайт](https://example.com)");
  check("http(s)-ссылка сохранена", http.indexOf('href="https://example.com"') !== -1);
  var rel = R("[тема](07-algoritmy.md)");
  check("относительная .md-ссылка сохранена", rel.indexOf('href="07-algoritmy.md"') !== -1);

  var imgBad = R("![x](javascript:alert(1))");
  check("картинка со схемой javascript: обезврежена (data-src=\"\")", imgBad.indexOf('data-src=""') !== -1);
  var imgRel = R("![x](img/a.png)");
  check("относительная картинка сохранена", imgRel.indexOf('data-src="img/a.png"') !== -1);
}

// ------------------------------------------------------------
console.log("\n" + (failures.length ? "ПРОВАЛОВ: " + failures.length : "Рантайм: все проверки пройдены") +
            "  (" + checks + " шт.)");
if (failures.length) { failures.forEach(function (f) { console.log("  - " + f); }); process.exit(1); }
