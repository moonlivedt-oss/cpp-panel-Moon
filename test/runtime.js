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

  // Новое: зачёркивание ~~…~~
  check("зачёркивание ~~ → <del>", R("~~старое~~").indexOf("<del>старое</del>") !== -1);
  check("одиночная ~ не трогается", R("a ~ b").indexOf("<del>") === -1);

  // Новое: выравнивание колонок таблицы из строки-разделителя
  var tbl = R("| A | B | C |\n| :-- | :--: | --: |\n| 1 | 2 | 3 |");
  check("таблица: выравнивание по центру", tbl.indexOf("text-align:center") !== -1);
  check("таблица: выравнивание вправо", tbl.indexOf("text-align:right") !== -1);

  // Новое: список задач «- [ ] …» → интерактивный чек-бокс
  var tl = R("- [ ] выучить указатели\n- [x] циклы");
  check("список задач → чек-боксы", tl.indexOf('class="cd-tasklist"') !== -1 && tl.indexOf("cd-tl-box") !== -1);
  check("обычный список без чек-боксов", R("- просто пункт").indexOf("cd-tl-box") === -1);

  // Новое: у заголовка есть якорь «#» и чистый data-title (без «#» для крошек)
  var hh = R("## Указатели");
  check("заголовок: якорь копирования ссылки", hh.indexOf('class="cd-hlink"') !== -1);
  check("заголовок: кнопка-закладка", hh.indexOf('class="cd-hmark"') !== -1);
  check("заголовок: чистый data-title без «#»", hh.indexOf('data-title="Указатели"') !== -1);
}

// --- логика главного экрана: карточки к повторению и «следующий шаг» ---
console.log("\nГлавный экран: карточки и следующий шаг");
if (api && typeof api.cardCounts === "function") {
  global.window.__CPPDOCS__ = {
    root: "docs", indexFile: "00.md", generatedAt: 1, files: [
      { rel: "a.md", name: "a.md", title: "Тема A", subtitle: "", group: "Главное", groupColor: "",
        minutes: 1, sections: 0, md: "# Тема A\n\n```cards\nQ: 2+2?\nA: 4\n\nQ: тип bool?\nA: логический\n```\n" },
      { rel: "b.md", name: "b.md", title: "Тема B", subtitle: "", group: "Главное", groupColor: "",
        minutes: 1, sections: 0, md: "# Тема B\n\nбез карточек" },
    ],
  };
  var cards = api.collectAllCards();
  check("collectAllCards находит 2 карточки", cards.length === 2, "нашлось " + cards.length);
  var cnt = api.cardCounts();
  check("cardCounts: обе карточки новые", cnt.neu === 2 && cnt.due === 0, JSON.stringify(cnt));
  var nu = api.nextUnread();
  check("nextUnread: первый неизученный — a.md", nu && nu.rel === "a.md", nu && nu.rel);
  global.window.__CPPDOCS__ = null;
}

// ------------------------------------------------------------
console.log("\n" + (failures.length ? "ПРОВАЛОВ: " + failures.length : "Рантайм: все проверки пройдены") +
            "  (" + checks + " шт.)");
if (failures.length) { failures.forEach(function (f) { console.log("  - " + f); }); process.exit(1); }
