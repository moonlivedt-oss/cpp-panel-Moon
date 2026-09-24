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

// --- «Живой пример» ```live: слайдеры, подстановка выражений, безопасный счёт ---
console.log("\nРантайм: живой пример (```live)");
if (typeof render === "function") {
  var stripTags = function (h) {
    return String(h).replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  };
  var outOf = function (h) { var m = String(h).match(/<pre class="cd-live-out"><code>([\s\S]*?)<\/code><\/pre>/); return m ? stripTags(m[1]) : ""; };
  var codeOf = function (h) { var m = String(h).match(/cd-live-code"><code>([\s\S]*?)<\/code>/); return m ? stripTags(m[1]) : ""; };
  var lv = R("```live\n@N = 5 [1..20]\n---\nfor (int i = 1; i <= {N}; ++i) s += i;\n---\nСумма 1..{N} = {N*(N+1)/2}\n```");
  check("live: контейнер и слайдер N (1..20)", lv.indexOf('class="cd-live"') !== -1 && /data-name="N"[^>]*max="20"/.test(lv));
  check("live: код подставил N=5 (i <= 5)", /i <= 5/.test(codeOf(lv)), codeOf(lv));
  check("live: вывод посчитан (Сумма 1..5 = 15)", /Сумма 1\.\.\s*5\s*=\s*15/.test(outOf(lv)), outOf(lv));
  var lt = R("```live\n@N = 3 [1..9]\n---\ncode\n---\n{for i=1..5} {i}*{N}={i*N}\n```");
  check("live: генератор {for} даёт '5*3=15'", /5\*3=15/.test(outOf(lt).replace(/\s/g, "")), outOf(lt));
  var ld = R("```live\n@A = 7 [1..9]\n---\nx\n---\n{A/2}\n```");
  check("live: целочисл. деление по-C++ (7/2 → 3, не 3.5)", outOf(ld).indexOf("3") !== -1 && outOf(ld).indexOf("3.5") === -1, outOf(ld));
  var lbad = R("```live\n@N = 5 [1..9]\n---\nx = {N*};\n```");
  check("live: битое выражение → '?', без падения", lbad.indexOf('class="cd-live"') !== -1 && stripTags(lbad).indexOf("?") !== -1);
  check("live: безопасность — без eval/Function", lv.indexOf("eval(") === -1 && lv.indexOf("Function(") === -1);
}

// --- «Ката» ```challenge: собери код (parsons) + предскажи вывод (predict) ---
console.log("\nРантайм: ката (```challenge)");
if (typeof render === "function") {
  var pp = R("```challenge\n@type parsons\nСобери сумму.\n---\nint sum = 0;\nfor (int i = 1; i <= n; ++i)\n    sum += i;\nstd::cout << sum;\n```");
  check("parsons: контейнер + банк из 4 строк", /cd-ch-parsons/.test(pp) && (pp.match(/cd-ch-item/g) || []).length === 4);
  check("parsons: зона решения и кнопки", /cd-ch-sol/.test(pp) && /cd-ch-check/.test(pp) && /cd-ch-reset/.test(pp));
  var solArr = []; try { solArr = JSON.parse(decodeURIComponent((pp.match(/data-sol="([^"]+)"/) || [])[1] || "[]")); } catch (e) {}
  check("parsons: эталон из 4 строк в верном порядке", solArr.length === 4 && solArr[0] === "int sum = 0;" && solArr[3] === "std::cout << sum;", JSON.stringify(solArr));
  var items = (pp.match(/data-t="([^"]+)"/g) || []).map(function (s) { return decodeURIComponent(s.slice(8, -1)); });
  check("parsons: строки перемешаны (порядок в HTML != эталон)", items.length === 4 && !(items[0] === "int sum = 0;" && items[3] === "std::cout << sum;"));
  var prp = R("```challenge\n@type predict\nЧто выведет?\n---\nint x = 7;\nstd::cout << x / 2;\n---\n3\n```");
  check("predict: контейнер + поле ввода + кнопки", /cd-ch-predict/.test(prp) && /cd-pr-in/.test(prp) && /cd-pr-check/.test(prp));
  check("predict: эталон '3' спрятан в data-exp", decodeURIComponent((prp.match(/data-exp="([^"]+)"/) || [])[1] || "") === "3");
  check("challenge: 1 строка parsons → фенс деградирует (пусто)", R("```challenge\n@type parsons\nx\n---\nодна строка\n```").indexOf("cd-ch-parsons") === -1);
  check("challenge: безопасность — без eval/Function", (pp + prp).indexOf("eval(") === -1 && (pp + prp).indexOf("Function(") === -1);
}

// --- «Напиши и запусти» ```challenge @type run (рендер вкл/выкл, без реальной компиляции) ---
console.log("\nРантайм: напиши и запусти (```challenge @type run)");
if (typeof render === "function") {
  var runSrc = "```challenge\n@type run\nСумма 1..n.\n---\n#include <iostream>\nint main(){int n; std::cin>>n;}\n---\n5 => 15\n10 => 55\n```";
  global.window.__CPPDOCS__ = { root: "docs", indexFile: "00.md", generatedAt: 1, files: [], run: { enabled: false } };
  var rOff = R(runSrc);
  check("run(выкл): бейдж+код-справка, без textarea", /cd-ch-run/.test(rOff) && rOff.indexOf("cd-run-code") === -1 && /cd-run-hint/.test(rOff));
  check("run(выкл): тесты показаны справкой (15 и 55)", rOff.indexOf("15") !== -1 && rOff.indexOf("55") !== -1);
  global.window.__CPPDOCS__ = { root: "docs", indexFile: "00.md", generatedAt: 1, files: [], run: { enabled: true }, runReqUrl: "file:///x/req.json", runResUrl: "file:///x/res.json" };
  var rOn = R(runSrc);
  check("run(вкл): textarea + кнопка «Запустить»", /cd-run-code/.test(rOn) && /cd-run-go/.test(rOn));
  var tj = []; try { tj = JSON.parse(decodeURIComponent((rOn.match(/data-tests="([^"]+)"/) || [])[1] || "[]")); } catch (e) {}
  check("run(вкл): 2 теста зашиты в data-tests", tj.length === 2 && tj[0]["in"] === "5" && tj[0]["out"] === "15", tj);
  check("run: безопасность — без eval/Function", (rOff + rOn).indexOf("eval(") === -1 && (rOff + rOn).indexOf("Function(") === -1);
  global.window.__CPPDOCS__ = null;
}

// --- поиск со сниппетом (searchHit) + «Смотри также» (relatedFiles) ---
console.log("\nРантайм: поиск со сниппетом и «Смотри также»");
if (api && typeof api.searchHit === "function") {
  var F = {
    rel: "ref/06.md", name: "06.md", title: "Контейнеры", subtitle: "vector, map", group: "Справочник", groupColor: "", minutes: 1, sections: 0,
    md: "# Контейнеры\n\n## Вектор\nМетод push_back добавляет элемент в конец.\n\n## Карта\nstd::map хранит пары ключ-значение.",
  };
  var h1 = api.searchHit(F, "push_back");
  check("searchHit: нашёл в теле, сниппет с <mark>", !!h1 && /<mark>push_back<\/mark>/i.test(h1.snippet), h1 && h1.snippet);
  check("searchHit: раздел = 'Вектор', slug непустой", !!h1 && h1.sec === "Вектор" && !!h1.slug, h1);
  check("searchHit: нет совпадения → null", api.searchHit(F, "zzzqqq") === null);
  check("searchHit: код-блоки не мешают (поиск в прозе)", !!api.searchHit(F, "хранит"));
  global.window.__CPPDOCS__ = {
    root: "docs", indexFile: "00.md", generatedAt: 1, files: [
      { rel: "ref/06.md", name: "06.md", title: "Контейнеры vector map", subtitle: "", group: "Справочник", groupColor: "", minutes: 1, sections: 0, md: "" },
      { rel: "ref/07.md", name: "07.md", title: "Алгоритмы над контейнерами", subtitle: "sort vector", group: "Справочник", groupColor: "", minutes: 1, sections: 0, md: "" },
      { rel: "ex/01.md", name: "01.md", title: "Телефонная книга", subtitle: "map", group: "Примеры", groupColor: "", minutes: 1, sections: 0, md: "" },
    ],
  };
  var related = api.relatedFiles(global.window.__CPPDOCS__.files[0]);
  check("relatedFiles: не включает сам файл", related.every(function (x) { return x.rel !== "ref/06.md"; }));
  check("relatedFiles: нашёл связанное (общее слово/раздел)", related.length >= 1 && related.some(function (x) { return x.rel === "ref/07.md"; }), related.map(function (x) { return x.rel; }));
  global.window.__CPPDOCS__ = null;
}

// --- мост доки↔редактор: поиск материала по слову + словарь C++ ---
console.log("\nРантайм: мост доки↔редактор");
if (api && typeof api.bridgeFind === "function") {
  global.window.__CPPDOCS__ = {
    root: "docs", indexFile: "00.md", generatedAt: 1, files: [
      { rel: "ref/06.md", name: "06.md", title: "Контейнеры: vector и map", subtitle: "", group: "Справочник", groupColor: "", minutes: 1, sections: 0, md: "# Контейнеры\nпро vector" },
      { rel: "ref/03.md", name: "03.md", title: "Циклы", subtitle: "", group: "Справочник", groupColor: "", minutes: 1, sections: 0, md: "# Циклы\nfor while do" },
    ],
  };
  check("bridge: 'vector' найден по заголовку", api.bridgeFind("vector") === "ref/06.md", api.bridgeFind("vector"));
  check("bridge: 'while' найден по тексту (длинное слово)", api.bridgeFind("while") === "ref/03.md", api.bridgeFind("while"));
  check("bridge: неизвестное слово → null", api.bridgeFind("zzzqqq") === null);
  check("bridge: короткое слово ищется только в заголовках (нет → null)", api.bridgeFind("do") === null, api.bridgeFind("do"));
  check("словарь C++: есть пояснения к vector/for/cout", !!(api.cppGlossary && api.cppGlossary.vector && api.cppGlossary["for"] && api.cppGlossary.cout));
  global.window.__CPPDOCS__ = null;
}

// --- ошибка компилятора простым языком ---
console.log("\nРантайм: ошибка компилятора простым языком");
if (api && typeof api.explainCompileError === "function") {
  var E = api.explainCompileError;
  var gpp = "C:\\t\\main.cpp: In function 'int main()':\nC:\\t\\main.cpp:4:5: error: 'cout' was not declared in this scope; did you mean 'std::cout'?\n    4 |     cout << 1;\n";
  var e1 = E(gpp);
  check("g++: имя не объявлено → понятный заголовок и номер строки", e1.known && /cout/.test(e1.t) && e1.line === 4, e1);
  check("g++: для cout подсказан #include <iostream>", /#include <iostream>/.test(e1.fix), e1.fix);
  check("clang: undeclared identifier", E("main.cpp:3:3: error: use of undeclared identifier 'x'").known);
  check("IntelliSense: identifier is undefined", /«vector»|vector/.test(E('identifier "vector" is undefined').t));
  check("IntelliSense: expected a \";\" → точка с запятой", /запят/.test(E('expected a ";"').t));
  check("не в std → заголовок <vector>", /#include <vector>/.test(E("main.cpp:2:10: error: 'vector' is not a member of 'std'").fix));
  var e2 = E("main.cpp:5:18: error: no match for 'operator<<' (operand types are 'std::ostream' and 'std::vector<int>')");
  check("cout << vector → «cout не умеет печатать»", /cout не умеет/.test(e2.t), e2.t);
  var link = "/usr/bin/ld: main.o: in function `main':\nmain.cpp:(.text+0x9): undefined reference to `calc(int)'\ncollect2: error: ld returned 1 exit status";
  check("линкер: берётся undefined reference, а не «ld returned»", /тела/.test(E(link).t), E(link).t);
  var e3 = E("something totally strange happened");
  check("незнакомая ошибка → общий совет, не падает", e3.known === false && !!e3.fix);

  // Каждый раздел, на который ведёт «Подробнее», реально есть в ref/11-oshibki.md.
  var errMd = fs.readFileSync(path.join(__dirname, "..", "docs", "ref", "11-oshibki.md"), "utf8");
  var errHtml = R(errMd);
  global.window.__CPPDOCS__ = { root: "docs", indexFile: "00.md", generatedAt: 1, files: [
    { rel: "ref/11-oshibki.md", name: "11-oshibki.md", title: "Ошибки", subtitle: "", group: "", groupColor: "", minutes: 1, sections: 0, md: errMd }] };
  var samples = [gpp, "error: 'vector' is not a member of 'std'", "error: expected ';' after struct definition", "error: expected '}' at end of input",
    "error: jump to case label", "error: too many arguments to function", link, "multiple definition of `main'", "error: assignment of read-only variable 'x'",
    "error: narrowing conversion of", "error: invalid conversion from 'const char*' to 'int'", "error: no match for 'operator+=' (operand types",
    "error: 'int Box::size' is private within this context", "warning: control reaches end of non-void function", "warning: 'count' is used uninitialized", "zzz"];
  var missing = samples.map(function (s) { var t = api.errorDocTarget(E(s).h); return t && errHtml.indexOf('id="' + t.hash.slice(1) + '"') === -1 ? t.hash : null; }).filter(Boolean);
  check("«Подробнее» ведёт на существующие разделы 11-oshibki.md", missing.length === 0, missing);
  global.window.__CPPDOCS__ = null;
}

// --- «в редактор» у примеров кода ---
if (render) {
  check("C++-блок кода: есть кнопка «в редактор»", R("```cpp\nint main() {}\n```").indexOf("cd-toed") !== -1);
  check("bash-блок: кнопки «в редактор» нет", R("```bash\nls\n```").indexOf("cd-toed") === -1);
}

// --- «Разминка дня» ---
if (api && typeof api.buildWarmupQueue === "function") {
  var many = "```cards\n" + [1, 2, 3, 4, 5, 6, 7].map(function (n) { return "В: вопрос " + n + "\nО: ответ " + n + "\n"; }).join("\n") + "```";
  global.window.__CPPDOCS__ = { root: "docs", indexFile: "00.md", generatedAt: 1, files: [
    { rel: "a.md", name: "a.md", title: "A", subtitle: "", group: "", groupColor: "", minutes: 1, sections: 0, md: many },
    { rel: "b.md", name: "b.md", title: "B", subtitle: "", group: "", groupColor: "", minutes: 1, sections: 0, md: "```cards\nВ: вопрос 1\nО: ответ 1\n```" }] };
  var wq = api.buildWarmupQueue();
  var ids = {}; wq.forEach(function (c) { ids[c.id] = true; });
  check("разминка: ровно 5 карточек, без повторов", wq.length === 5 && Object.keys(ids).length === 5, wq.length);
  global.window.__CPPDOCS__ = null;
}

// --- file:// → путь: Windows-диск и POSIX-корень ---
console.log("\nРантайм: пути файловых каналов");
if (api && typeof api.fileUrlToPath === "function") {
  check("fileUrlToPath: Windows-диск", api.fileUrlToPath("file:///C:/Users/a/x.js") === "C:/Users/a/x.js", api.fileUrlToPath("file:///C:/Users/a/x.js"));
  check("fileUrlToPath: POSIX сохраняет ведущий /", api.fileUrlToPath("file:///home/a/x.js") === "/home/a/x.js", api.fileUrlToPath("file:///home/a/x.js"));
  check("fileUrlToPath: %20 раскодирован", api.fileUrlToPath("file:///D:/my%20docs/x.js") === "D:/my docs/x.js");
}

// --- аудит 2026-09-24: объяснялка ошибок, интервалы, лимит новых карточек, живой int ---
console.log("\nРантайм: ошибки, повторение, живые примеры");
if (api && typeof api.explainCompileError === "function") {
  var cases = [
    ["a.cpp:4:21: error: expected primary-expression before ';' token", "expected primary-expression"],
    ["a.cpp:3:16: error: extended character « is not valid in an identifier", "extended character"],
    ["a.cpp:2:1: error: 'string' does not name a type; did you mean 'stdin'?", "does not name a type"],
    ["a.cpp:3:9: error: lvalue required as left operand of assignment", "lvalue required"],
    ["a.cpp:5:20: error: no matching function for call to 'max(int&, double&)'", "no matching function"],
    ["a.cpp:3:30: error: invalid operands of types 'const char [15]' and 'const char [7]' to binary 'operator+'", "invalid operands of types"],
    ["a.cpp:4:18: error: request for member 'size' in 'n', which is of non-class type 'int'", "request for member"],
  ];
  cases.forEach(function (c) {
    var ex = api.explainCompileError(c[0]);
    check("ошибка «" + c[1] + "»: узнана и ведёт в словарь", ex.known && !!ex.h, JSON.stringify({ t: ex.t, h: ex.h }));
  });
  var lit = api.explainCompileError("x.cpp:3:30: error: invalid operands of types 'const char [15]' and 'const char [7]' to binary 'operator+'");
  check("два литерала: есть правильный мини-пример", typeof lit.ex === "string" && lit.ex.indexOf("int main()") !== -1);
}
if (api && typeof api.ivlLabel === "function") {
  check("интервал: 1 день → «завтра»", api.ivlLabel(1) === "завтра", api.ivlLabel(1));
  check("интервал: 2 дня → «через 2 дн.»", api.ivlLabel(2) === "через 2 дн.", api.ivlLabel(2));
  check("интервал: 60 дней → «через 2 мес.»", api.ivlLabel(60) === "через 2 мес.", api.ivlLabel(60));
  check("новая карточка: «Помню» → через 2 дн.", api.cdPreview("нет-такой", 2) === 2);
  check("новая карточка: «Не помню» → завтра", api.cdPreview("нет-такой", 0) === 1);
  check("лимит новых карточек в день — 10", api.newLeftToday() === 10, api.newLeftToday());
}
if (api && typeof api.render === "function") {
  var lvWrap = api.render("```live\n@N = 46500 [45000..47000 step 20]\n---\nint n = {N};\n---\n{N*N}\n```");
  check("живой пример: int «оборачивается» за 2^31", lvWrap.indexOf("-2132717296") !== -1);
  var lv2 = api.render("```live\n@N = 5 [1..20]\n---\nint s = {N};\n---\n{N*(N+1)/2}\n```");
  check("живой пример: обычная арифметика не тронута", lv2.indexOf(">15<") !== -1 || lv2.indexOf("15") !== -1);
}

// --- итоговые проверки этапов (```quiz с @exam) ---
console.log("\nРантайм: итоговые проверки");
if (api && typeof api.parseTopics === "function") {
  check("темы зачёта: «1-3» → 1,2,3", api.parseTopics("1-3").join(",") === "1,2,3");
  check("темы зачёта: «4, 6-7» → 4,6,7", api.parseTopics("4, 6-7").join(",") === "4,6,7");
  var ex = api.render("```quiz\n@exam etap-x 1-2\nВ: 2+2?\n+ 4\n- 5\n```");
  check("зачёт: помечен cd-exam, id и темы", ex.indexOf('data-exam="etap-x"') !== -1 && ex.indexOf('data-topics="1,2"') !== -1);
  check("зачёт: строка @exam не стала вопросом", ex.indexOf("@exam") === -1);
  check("зачёт: есть место под итог", ex.indexOf("cd-exam-res") !== -1);
  var plain = api.render("```quiz\nВ: 2+2?\n+ 4\n- 5\n```");
  check("обычный опросник — без зачёта", plain.indexOf("cd-exam") === -1);
  check("без сданных зачётов нет отмеченных тем", Object.keys(api.examPassedTopics()).length === 0);
}

// ------------------------------------------------------------
console.log("\n" + (failures.length ? "ПРОВАЛОВ: " + failures.length : "Рантайм: все проверки пройдены") +
            "  (" + checks + " шт.)");
if (failures.length) { failures.forEach(function (f) { console.log("  - " + f); }); process.exit(1); }
