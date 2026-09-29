"use strict";

// Поведенческие тесты рантайма БЕЗ зависимостей: поднимаем крошечный DOM-стаб, грузим
// cpp-docs-runtime.js и дёргаем его настоящий renderMarkdown (window.__cppDocs.render).
// Это ловит реальные регрессии рендера/безопасности схем, а не наличие строки в исходнике.
//
// Трюк: document.readyState = "loading" — тогда boot() откладывается на DOMContentLoaded
// (который мы не шлём), IIFE успевает выставить window.__cppDocs, и тяжёлый DOM для boot не нужен.

var fs = require("fs");
var path = require("path");

const { check, group, finish } = require("./helpers");

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
group("Рантайм: рендер и безопасность схем");
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
group("Главный экран: карточки и следующий шаг");
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
  // Подсказка «H:» — отдельно от ответа (в колоде это кнопка «Подсказка», в повторении её нет)
  var ph = api.parseCards("Q: 7 / 2?\nH: оба операнда целые\nA: 3\n\nQ: второй?\nA: да");
  check("карточки: H: — подсказка, не часть ответа", ph.length === 2 && ph[0].h.join("") === "оба операнда целые" && ph[0].a.join("") === "3", JSON.stringify(ph[0]));
  var deck = api.render("```cards\nQ: раз?\nH: намёк\nA: один\n\nQ: два?\nA: два\n```", []);
  check("карточки: колода — 2 карточки, точки, кнопка подсказки", (deck.match(/class="cd-dcard/g) || []).length === 2 &&
    (deck.match(/class="cd-dk-dot[ "]/g) || []).length === 2 && deck.indexOf("cd-dc-hintbtn") !== -1 && deck.indexOf("cd-dk-shuffle") !== -1);
}
if (api && api.parsePalStickers) {
  var ps = api.parsePalStickers(JSON.stringify({ "ui-read@tokyo": "data:image/webp;base64,AAAA", "ui-x@nord": "javascript:alert(1)", "evil": "data:image/webp;base64,AAAA" }));
  check("наклейки под палитры: берутся только ui-*@палитра с data:image", Object.keys(ps).join(",") === "ui-read@tokyo", Object.keys(ps).join(","));
  check("наклейки под палитры: битый JSON — пусто, без исключения", Object.keys(api.parsePalStickers("{oops")).length === 0);
}
if (api && api.palettes) {
  var pk = Object.keys(api.palettes);
  check("палитры: 9 наборов, у каждого фон, акцент и цвета кода", pk.length === 9 && pk.every(function (k) {
    var p = api.palettes[k]; return /^#[0-9a-f]{6}$/i.test(p.bg) && /^#[0-9a-f]{6}$/i.test(p.ac) && /^#[0-9a-f]{6}$/i.test(p.tf) && !!p.name;
  }), pk.join(","));
}

// --- «Живой пример» ```live: слайдеры, подстановка выражений, безопасный счёт ---
group("Рантайм: живой пример (```live)");
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
// --- Пошаговый проигрыватель ```steps: строки кода, накопление переменных и вывода ---
group("Рантайм: по шагам (```steps)");
if (typeof render === "function") {
  var sp = R("```steps\n# Сумма\nint n = 12, s = 0;\nwhile (n > 0) { s += n % 10; n /= 10; }\nstd::cout << s;\n---\n1 | n=12, s=0 | старт\n2 | s=2, v=[1, 2] | цифра\n2 | n=1, v=— | дальше\n3 | | печать | 3\\n\n```");
  var spData = (function () { var m = sp.match(/data-steps="([^"]*)"/); try { return m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch (e) { return null; } })();
  check("steps: контейнер, заголовок и кнопки", sp.indexOf('class="cd-steps"') !== -1 && sp.indexOf("Сумма") !== -1 && sp.indexOf('data-st="next"') !== -1);
  check("steps: строки кода пронумерованы", /data-n="3"/.test(sp) && !/data-n="4"/.test(sp));
  check("steps: 4 шага разобраны", spData && spData.length === 4, spData && spData.length);
  check("steps: переменные копятся, изменённые помечены", spData && JSON.stringify(spData[1].v) === JSON.stringify([["n", "12", 0], ["s", "2", 1], ["v", "[1, 2]", 1]]), spData && JSON.stringify(spData[1].v));
  check("steps: «x=—» убирает переменную", spData && spData[2].v.length === 2 && spData[2].v[0][0] === "n");
  check("steps: вывод накапливается, \\n — перевод строки", spData && spData[3].o === "3\n" && spData[2].o === "");
  check("steps: без «---» — обычный код", R("```steps\nint a;\n```").indexOf("cd-steps") === -1);
  var sq = R("```steps\nint a = 1;\na += 2;\n---\n1 | a=1 | старт\n?2 | a=3 | загадка\n```");
  var sqData = (function () { var m = sq.match(/data-steps="([^"]*)"/); try { return m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch (e) { return null; } })();
  check("steps: «?N» — шаг-загадка помечен q, номер строки цел", sqData && sqData[1].q === 1 && sqData[1].l === 2 && sqData[0].q === 0);
  check("steps: есть кнопка «Проверить» и стабильный data-id", sq.indexOf('data-st="check"') !== -1 && /data-id="c[0-9a-z]+"/.test(sq));

  // Босс темы ```boss
  var bs = R("```boss\n# Мини-банк\nСделайте **счёт** с пополнением.\n```");
  check("boss: карточка, заголовок, замок и тело", bs.indexOf('class="cd-boss"') !== -1 && bs.indexOf("Мини-банк") !== -1 &&
    bs.indexOf("cd-boss-lock") !== -1 && bs.indexOf("<strong>счёт</strong>") !== -1);

  // Схема ```diagram: сырой HTML чистится (окно живёт в оболочке с доступом к Node)
  var dg = R("```diagram\n# схема\n<img src=\"x.png\" onerror=\"alert(1)\"><script>alert(2)</script><a href=\"javascript:alert(3)\">a</a>\n```");
  check("diagram: без on*-обработчиков", !/onerror/i.test(dg), dg);
  check("diagram: без <script>", !/<script/i.test(dg));
  check("diagram: без javascript:-ссылок", !/javascript:/i.test(dg));
  check("diagram: безопасная картинка осталась", /<img[^>]*src="x\.png"/.test(dg));
}

group("Рантайм: ката (```challenge)");
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
group("Рантайм: напиши и запусти (```challenge @type run)");
if (typeof render === "function") {
  var runSrc = "```challenge\n@type run\nСумма 1..n.\n---\n#include <iostream>\nint main(){int n; std::cin>>n;}\n---\n5 => 15\n10 => 55\n```";
  global.window.__CPPDOCS__ = { root: "docs", indexFile: "00.md", generatedAt: 1, files: [], run: { enabled: false } };
  var rOff = R(runSrc);
  check("run(выкл): бейдж+код-справка, без textarea", /cd-ch-run/.test(rOff) && rOff.indexOf("cd-run-code") === -1 && /cd-run-hint/.test(rOff));
  check("run(выкл): тесты показаны справкой (15 и 55)", rOff.indexOf("15") !== -1 && rOff.indexOf("55") !== -1);
  global.window.__CPPDOCS__ = { root: "docs", indexFile: "00.md", generatedAt: 1, files: [], run: { enabled: true } };
  var rOn = R(runSrc);
  check("run(вкл): textarea + кнопка «Запустить»", /cd-run-code/.test(rOn) && /cd-run-go/.test(rOn));
  var tj = []; try { tj = JSON.parse(decodeURIComponent((rOn.match(/data-tests="([^"]+)"/) || [])[1] || "[]")); } catch (e) {}
  check("run(вкл): 2 теста зашиты в data-tests", tj.length === 2 && tj[0]["in"] === "5" && tj[0]["out"] === "15", tj);
  check("run: безопасность — без eval/Function", (rOff + rOn).indexOf("eval(") === -1 && (rOff + rOn).indexOf("Function(") === -1);
  // «\n» в тесте — перевод строки: многострочный ввод (getline) и вывод
  var rNl = R("```challenge\n@type run\nИмя.\n---\nint main(){}\n---\nРобин\\n2 => а\\nб\n```");
  var tn = []; try { tn = JSON.parse(decodeURIComponent((rNl.match(/data-tests="([^"]+)"/) || [])[1] || "[]")); } catch (e) {}
  check("run: «\\n» во входе и выводе → перевод строки", tn.length === 1 && tn[0]["in"] === "Робин\n2" && tn[0]["out"] === "а\nб", tn);
  global.window.__CPPDOCS__ = { root: "docs", indexFile: "00.md", generatedAt: 1, files: [], run: { enabled: false } };
  var rNlOff = R("```challenge\n@type run\nИмя.\n---\nint main(){}\n---\nРобин\\n2 => а\n```");
  check("run(выкл): перевод строки в таблице тестов показан значком ⏎", rNlOff.indexOf("cd-run-nl") !== -1);
  global.window.__CPPDOCS__ = null;
}

// --- поиск со сниппетом (searchHit) + «Смотри также» (relatedFiles) ---
group("Рантайм: поиск со сниппетом и «Смотри также»");
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
group("Рантайм: мост доки↔редактор");
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
group("Рантайм: ошибка компилятора простым языком");
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
  if (api._state) {
    var st0 = api._state();
    st0.missed = { "x:1": { rel: "a.md", hash: "st-x", q: "чему равно `sum`?", a: "`sum` = `5`", due: "2000-01-01" },
                   "x:2": { rel: "a.md", hash: "st-x", q: "позже", a: "-", due: "2999-01-01" } };
    var wq2 = api.buildWarmupQueue();
    check("разминка: ошибка в загадке вернулась первой", wq2.length === 5 && wq2[0].missed === "x:1" && wq2[0].slug === "st-x", wq2[0] && wq2[0].id);
    check("разминка: загадка с будущей датой ещё не пришла", !wq2.some(function (c) { return c.missed === "x:2"; }));
    st0.missed = {};
  }
  global.window.__CPPDOCS__ = null;
}

// --- Босс: задачи той же темы из задачника ---
if (api && typeof api.bossTasks === "function") {
  global.window.__CPPDOCS__ = { root: "docs", indexFile: "00.md", generatedAt: 1, files: [
    { rel: "ref/05-stroki.md", name: "05-stroki.md", title: "Строки", subtitle: "", group: "", groupColor: "", minutes: 1, sections: 0, md: "# Строки" },
    { rel: "zadachnik/05-stroki.md", name: "05-stroki.md", title: "Задачи: строки", subtitle: "", group: "Задачник", groupColor: "", minutes: 1, sections: 0,
      md: "# Задачи\n\n## 5.1. Лёгкая 🟢\n\nт\n\n## 5.2. Средняя 🟡\n\nт\n\n## 5.3. Сложная 🔴\n\nт\n\n## 5.4. Ещё 🟢\n\nт\n" }] };
  var bt = api.bossTasks("ref/05-stroki.md");
  check("босс: 3 задачи той же темы, сперва 🟡/🔴", bt.length === 3 && /5\.2/.test(bt[0].title) && /5\.3/.test(bt[1].title), bt.map(function (t) { return t.title; }).join(" | "));
  check("босс: у другой темы задач нет", api.bossTasks("ref/13-klassy.md").length === 0);
  global.window.__CPPDOCS__ = null;
}

// --- file:// → путь: Windows-диск и POSIX-корень ---
group("Рантайм: пути файловых каналов");
if (api && typeof api.appUrl === "function") {
  check("appUrl: Windows-диск → vscode-file://", api.appUrl("file:///C:/Users/a/x.js") === "vscode-file://vscode-app/C:/Users/a/x.js", api.appUrl("file:///C:/Users/a/x.js"));
  check("appUrl: POSIX-путь", api.appUrl("file:///home/a/x.js") === "vscode-file://vscode-app/home/a/x.js");
  check("appUrl: пробел и кириллица закодированы", api.appUrl("file:///D:/my%20docs/д.js") === "vscode-file://vscode-app/D:/my%20docs/%D0%B4.js");
  check("appUrl: не file:// — null", api.appUrl("https://x/y") === null);
}

// --- аудит 2026-09-24: объяснялка ошибок, интервалы, лимит новых карточек, живой int ---
group("Рантайм: ошибки, повторение, живые примеры");
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

// --- наклейки: в рантайме только пилюля, остальные — из stickers.json при первом обращении ---
group("Рантайм: наклейки по требованию");
if (api && typeof api._sticker === "function") {
  check("пилюля (welcome) встроена в рантайм", /^data:image\//.test(api._sticker("welcome") || ""));
  global.window.__CPPDOCS_STICKERS__ = {
    "mascot-hi": "data:image/webp;base64,QUJD",
    "welcome": "data:image/webp;base64,SEFDSw==",                  // встроенную не перезаписываем
    "evil": "javascript:alert(1)",                                   // не картинка data: — прочь
    "__proto__": "data:image/png;base64,QQ==",
  };
  check("наклейка не из рантайма подгружается при первом обращении", api._sticker("mascot-hi") === "data:image/webp;base64,QUJD");
  check("встроенная наклейка не перезаписывается файлом", api._sticker("welcome") !== "data:image/webp;base64,SEFDSw==");
  check("не-картинка из файла отброшена", api._sticker("evil") === undefined);
  delete global.window.__CPPDOCS_STICKERS__;
}
// Задачник: лесенка подсказок ```hints, чипы 🔥/🔗, «\n» в тестах задачи
if (render) {
  var lad = R("```hints\nИдея: подумай о `x`\nПлан: шаги\nКлюч: `int y = 0;`\n```");
  check("лесенка: три ступени, все скрыты до клика", (lad.match(/class="cd-lstep"/g) || []).length === 3 && (lad.match(/ hidden>/g) || []).length === 3, lad.slice(0, 200));
  check("лесенка: кнопка начинается с идеи, значки 💡🧭🔑", /💡 Открыть: идея/.test(lad) && lad.indexOf("🧭") !== -1 && lad.indexOf("🔑") !== -1);
  check("лесенка: код в ступени — <code>, без сырого HTML", lad.indexOf("<code>int y = 0;</code>") !== -1 && lad.indexOf("<script") === -1);
  var ch = R("## 4.9. Урон 🔗🟡\n\n## 4.10. Степень 🔥");
  check("чипы: 🔗 звено цепочки и 🔥 челлендж", ch.indexOf('class="cd-chain"') !== -1 && ch.indexOf("cd-diff d-x") !== -1);
  var tt = R("```tests\n4\\nAri 50 => Ari: 50\\nитого\n```");
  check("тесты задачи: «\\n» показан значком ⏎, в копию — настоящий перевод строки", tt.indexOf("cd-run-nl") !== -1 && tt.indexOf('data-in="4\nAri 50"') !== -1, tt.slice(0, 300));
}

// Служебные метки <!-- docs:… --> на отдельной строке ученику не показываются
if (render) {
  var cm = R("текст\n\n<!-- docs:solutions:start -->\n\nещё\n\n<!-- docs:no-compile: пример -->");
  check("служебные метки <!-- … --> в окне не видны", cm.indexOf("docs:") === -1 && cm.indexOf("ещё") !== -1, cm);
}
// Главная прозрачная: статья и её оглавление под ней не должны просвечивать (фон окна бывает полупрозрачным)
check("на главной статья и оглавление спрятаны (не просвечивают сквозь фон)",
  code.indexOf('.home .cd-rmain>.cd-content') !== -1 && code.indexOf('.home .cd-rmain>.cd-outline') !== -1);
var rtSize = fs.statSync(path.join(__dirname, "..", "extension", "cpp-docs-runtime.js")).size;
// Страховка от случайно встроенных картинок (наклейки — отдельными файлами). Общий бюджет — scripts/perf-budget.js.
check("рантайм без встроенных наклеек легче 950 КБ", rtSize < 950 * 1024, Math.round(rtSize / 1024) + " КБ");

// --- постоянный ключ блока @id: правка текста не сбрасывает прогресс ---
group("Рантайм: постоянные ключи заданий (@id)");
if (render) {
  var idOf = function (html) { return (html.match(/data-id="([^"]+)"/) || [])[1]; };
  var chA = "```challenge\n@type predict\nЧто напечатает?\n---\nstd::cout << 1;\n---\n1\n```";
  var chB = "```challenge\n@id c1abc\n@type predict\nЧто напечатает?\n---\nstd::cout << 1;\n---\n1\n```";
  var chC = "```challenge\n@id c1abc\n@type predict\nЧто напечатает эта программа?\n---\nstd::cout << 1;\n---\n1\n```";
  check("@id: ключ задания берётся из строки @id", idOf(R(chB)) === "c1abc", idOf(R(chB)));
  check("@id: правка условия ключ не меняет", idOf(R(chC)) === "c1abc");
  check("@id: без строки ключ — прежний хэш текста", /^c[0-9a-z]+$/.test(idOf(R(chA)) || "") && idOf(R(chA)) !== "c1abc");
  check("@id: строка @id не попадает в условие", R(chB).indexOf("@id") === -1);
  var stB = "```steps\n@id st1\n# Разбор\nint a = 1;\n---\n1 | a=1 | создали\n```";
  check("@id: у разбора «По шагам»", idOf(R(stB)) === "st1" && R(stB).indexOf("@id") === -1);
  var bsB = "```boss\n# Босс\n@id b1\nСделай игру.\n```";
  check("@id: у босса (после строки с названием)", idOf(R(bsB)) === "b1" && R(bsB).indexOf("@id") === -1);
}

// --- ошибки → «Разминка»: вопрос опросника несёт исходный текст и верный ответ ---
if (render) {
  var qz = R("```quiz\nВ: Сколько будет `2+2`?\n+ 4\n- 5\n= Потому что арифметика.\n```");
  var mq = decodeURIComponent((qz.match(/data-mq="([^"]*)"/) || [])[1] || "");
  var ma = decodeURIComponent((qz.match(/data-ma="([^"]*)"/) || [])[1] || "");
  check("ошибка в опроснике: исходный вопрос в разметке (для карточки повторения)", mq === "Сколько будет `2+2`?", mq);
  check("ошибка в опроснике: верный ответ + пояснение в разметке", ma === "4 — Потому что арифметика.", ma);
}

// --- «По шагам»: ответ засчитывается в любой естественной записи ---
group("Рантайм: проверка ответов «По шагам»");
if (api && typeof api.stepsNorm === "function") {
  var sn = api.stepsNorm;
  check("шаги: 3.0 = 3", sn("3.0") === sn("3"));
  check("шаги: 0,5 (русская запятая) = .5", sn("0,5") === sn(".5"));
  check("шаги: true = 1, false = 0 (так печатает cout)", sn("true") === sn("1") && sn("false") === sn("0"));
  check("шаги: кавычки и пробелы не важны", sn(' "abc" ') === sn("abc"));
  check("шаги: {1,2} не равно {1.2}", sn("{1,2}") !== sn("{1.2}"));
  check("шаги: 12 не равно 13", sn("12") !== sn("13"));
}

// --- итоговые проверки этапов (```quiz с @exam) ---
group("Рантайм: итоговые проверки");
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

// --- Esc и фокус: окно реагирует на клавиши, только когда фокус внутри него ---
group("Рантайм: Esc только при фокусе в окне");
if (api && typeof api.focusInside === "function") {
  var inner = { nodeType: 1 }, outer = { nodeType: 1 };
  var winFake = { contains: function (n) { return n === inner; } };
  check("Esc в редакторе VS Code (фокус вне окна) — окно не трогаем", api.focusInside(winFake, outer, outer) === false);
  check("Esc в поле поиска окна — окно реагирует", api.focusInside(winFake, inner, inner) === true);
  check("событие на body, а фокус внутри окна — реагирует", api.focusInside(winFake, global.document.body, inner) === true);
  check("фокус на body (никуда не поставлен) — не реагирует", api.focusInside(winFake, global.document.body, global.document.body) === false);
  check("окна нет — не реагирует", api.focusInside(null, inner, inner) === false);
}

// --- ```memory и ```frames: разбор ---
group("Рантайм: память по шагам и кадры");
if (api && typeof api.parseMemory === "function") {
  var mem = api.parseMemory("# T\nint a = 1;\nint* p = &a;\n---\nстрока 1\nстек main: a = 1\n---\nстрока 2\nстек main: a = 1; p = →a\nкуча: #1 int = 5; #2 ✗ int[3] = {1, 2, 3}\nпояснение: p хранит адрес");
  check("memory: код и шаги", mem && mem.code.length === 2 && mem.steps.length === 2 && mem.title === "T");
  var s2 = mem && mem.steps[1];
  check("memory: строка, кадр стека, указатель", s2 && s2.line === 2 && s2.frames[0].name === "main" && s2.frames[0].vars[1].val === "→a");
  check("memory: куча — живой и освобождённый блок", s2 && s2.heap.length === 2 && !s2.heap[0].dead && s2.heap[1].dead && s2.heap[1].type === "int[3]");
  check("memory: пояснение", s2 && s2.note === "p хранит адрес");
  check("memory: без шагов — null", api.parseMemory("int a;") === null);
  var fr = api.parseFrames("# Прыжок\n@fps 20\n@\n> кадр 1\n---\n .@\n---\n  @");
  check("frames: кадры, подпись, fps ограничен 12", fr && fr.frames.length === 3 && fr.frames[0].cap === "кадр 1" && fr.frames[0].art === "@" && fr.fps === 12 && fr.title === "Прыжок");
  var html = api.render("```memory\nint a;\n---\nстек main: a = <script>\n```");
  check("memory: HTML из пояснений/значений не исполняется (данные в data-атрибуте закодированы)", html.indexOf("<script>") === -1 && html.indexOf("cd-mem") !== -1);
}

// --- Схема состояния: миграции, нормализация, подрезка ---
group("Рантайм: схема состояния");
if (api && api._stateSchema) {
  var SS = api._stateSchema;
  var old = { layoutV: 1, hl: { "a.md": ["слово", { t: "x", c: "p" }, 5] }, days: { "2026-01-01": true, "2026-01-02": 3 } };
  SS.migrate(old);
  check("миграции: версия проставлена", old.v === SS.version);
  check("миграция v1: выделения-строки → {t, c}", old.hl["a.md"].length === 2 && old.hl["a.md"][0].c === "y" && old.hl["a.md"][1].c === "p");
  check("миграция v2: при чтении список материалов скрыт, layoutV убран", old.navHidden === true && !("layoutV" in old));
  check("миграция v3: день-флаг → число", old.days["2026-01-01"] === 1 && old.days["2026-01-02"] === 3);
  var fut = { v: 99, navHidden: false };
  SS.migrate(fut);
  check("состояние из более новой версии не «откатывается» миграциями", fut.navHidden === false);
  var bad = SS.normalize({ read: [1], fs: 9, codeFs: "x", x: NaN, theme: "neon", noAnim: "yes", recent: [1, "a", null] });
  check("нормализация: словари, клампы, недопустимые значения → по умолчанию",
    !Array.isArray(bad.read) && bad.fs === 1.6 && bad.codeFs === 0 && !("x" in bad) && bad.theme === "auto" && bad.noAnim === false && bad.recent.join() === "a");
  var big = SS.normalize({ scroll: {}, hl: {}, notes: {}, secSeen: {}, days: {} });
  for (var qi = 0; qi < 500; qi++) { big.scroll["f" + qi + ".md"] = qi; big.days["2025-" + String(qi).padStart(4, "0")] = 1; }
  big.notes["gone.md"] = "x"; big.secSeen["gone.md"] = { a: 1 }; big.scroll["keep.md"] = 1;
  SS.prune(big, { "keep.md": true });
  check("подрезка: хвосты удалённых материалов убраны", !big.notes["gone.md"] && !big.secSeen["gone.md"] && big.scroll["keep.md"] === 1 && !big.scroll["f1.md"]);
  check("подрезка: дней активности — не больше 400", Object.keys(big.days).length === 400);
}

// --- Задача дня ---
group("Рантайм: задача дня");
if (api && typeof api.dailyChallenge === "function") {
  global.window.__CPPDOCS__ = { root: "d", indexFile: "00.md", generatedAt: 1, run: { enabled: true }, files: [
    { rel: "ref/01-a.md", name: "01-a.md", title: "А", md: "```challenge\n@id k1\n@type predict\nЧто выведет?\n---\nint main(){}\n---\n1\n```\n```challenge\n@id k2\nСобери\n---\na\nb\n```" },
    { rel: "ref/02-b.md", name: "02-b.md", title: "Б", md: "```challenge\n@id k3\n@type run\nНапиши\n---\nint main(){}\n---\n1 => 1\n```" },
  ] };
  var chs = api.collectChallenges();
  check("задания собраны с id и типом", chs.length === 3 && chs[0].id === "k1" && chs[0].type === "predict" && chs[1].type === "parsons" && chs[2].type === "run");
  var st9 = api._state(); delete st9.daily; st9.read = {}; st9.challenge = { k1: true, k2: true }; st9.dailyDone = {};
  var dc = api.dailyChallenge();
  check("задача дня — нерешённая", dc && dc.id === "k3", dc);
  check("в течение дня — та же задача", api.dailyChallenge().id === dc.id);
  var t0 = new Date(), dk = function (off) { var d = new Date(t0); d.setDate(d.getDate() + off); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  st9.dailyDone = {}; st9.dailyDone[dk(-1)] = 1; st9.dailyDone[dk(-2)] = 1;
  check("серия: вчера и позавчера, сегодня ещё не решал — 2", api.dailyStreak() === 2, api.dailyStreak());
  st9.dailyDone[dk(0)] = 1;
  check("серия: с сегодняшней — 3", api.dailyStreak() === 3);
  // Без cppDocs.localRun «напиши и запусти» решить нельзя — такая задача дня не выпадает (и не держится с утра)
  global.window.__CPPDOCS__.run = { enabled: false };
  delete st9.daily; st9.challenge = {};
  var dcOff = api.dailyChallenge();
  check("без localRun задача дня — не «напиши и запусти»", dcOff && dcOff.type !== "run", dcOff);
  st9.daily = { date: dk(0), id: "k3", rel: "ref/02-b.md", type: "run", prompt: "", title: "" };
  check("…и утренняя «run» заменяется, когда запуск выключили", api.dailyChallenge().type !== "run");
  global.window.__CPPDOCS__ = null;
}

// --- Несколько окон VS Code: прогресс из другого окна подхватывается, а не затирается ---
group("Рантайм: прогресс из другого окна VS Code");
if (api && typeof api._adoptProgress === "function") {
  var stA = api._state();
  stA.read = { "ref/01-osnovy.md": true }; stA.fs = 1.2;
  api._adoptProgress({ read: { "ref/01-osnovy.md": true, "ref/02-vvod-vyvod.md": true }, solved: { "a#b": true }, fs: 0.8, _savedAt: Date.now() + 5000 });
  var st1 = api._state();
  check("отметки другого окна подхвачены", st1.read["ref/02-vvod-vyvod.md"] === true && st1.solved["a#b"] === true);
  check("настройки вида (шрифт) у окна свои", st1.fs === 1.2);
  check("метка времени — не старее чужой", st1._savedAt >= Date.now() + 4000);
  api._adoptProgress({ read: [1, 2], cards: null, _savedAt: 1 });
  check("кривые поля из чужого окна — пустые словари", !Array.isArray(api._state().read) && typeof api._state().cards === "object");
}

// --- Игровые блоки: волна BFS на сетке, сундуки, «Путь героя» ---
group("Рантайм: игровые блоки");
if (api && typeof api.bfsDist === "function") {
  var FN = "```";
  var g1 = api.bfsParse("#####\n#S.E#\n#####");
  check("волна: до врага в коридоре 2 шага", api.bfsDist(g1).reach === 2);
  var g2 = api.bfsParse("#####\n#S#E#\n#####");
  check("волна: стена между — врагу не дойти", api.bfsDist(g2).reach === -1);
  var r3 = api.bfsDist(api.bfsParse("#######\n#S....#\n#.###.#\n#....E#\n#######"));
  check("волна: кратчайший из двух обходов", r3.reach === 6 && Object.keys(r3.path).length === 6);
  var g4 = api.bfsParse("#?#\n#S\n###");
  check("волна: чужой символ — пол, короткая строка добита стенами", g4[0][1] === "." && g4[1][2] === "#");
  var bgHtml = api.render(FN + "bfsgrid\n#####\n#S.E#\n#####\n" + FN);
  check("```bfsgrid рисует сетку и статус", bgHtml.indexOf("cd-bfs-grid") !== -1 && bgHtml.indexOf("2</b> шага") !== -1);
  var lsHtml = api.render(FN + "lootsim\nОбычный = 60\nРедкий = 30\nЛегендарный = 10\n@pity 10\n" + FN);
  check("```lootsim: три строки, шанс в процентах и гарантия",
    (lsHtml.match(/cd-ls-row/g) || []).length === 3 && lsHtml.indexOf("шанс 10%") !== -1 && lsHtml.indexOf("cd-ls-pity") !== -1);
  check("```lootsim из одной строки — не симулятор", api.render(FN + "lootsim\nОдин = 1\n" + FN).indexOf("cd-lootsim") === -1);
  var savedData = global.window.__CPPDOCS__;
  global.window.__CPPDOCS__ = { root: "", files: [
    { rel: "proekt/02-glava-1-osnovy.md", title: "Подземелье · Глава 1. Герой",
      md: "## Квест 1. Раз\n" + FN + "checklist\nКвест 1 готов, если:\n- пункт А\n- пункт Б\n" + FN + "\n" +
          "## Квест 2. Два\n" + FN + "checklist\n- пункт В\n" + FN + "\n## Прочее\n" + FN + "checklist\n- чужой пункт\n" + FN + "\n" },
  ] };
  var qs = api.collectQuests();
  check("квесты: два квеста, у каждого — пункты своего чек-листа",
    qs && qs.chapters[0].quests.length === 2 && qs.chapters[0].quests[0].items.length === 2 && qs.chapters[0].quests[1].items.length === 1);
  check("квесты: «Подземелье · » снято с названия главы", qs.chapters[0].title === "Глава 1. Герой");
  var qm = api.render(FN + "quests\n" + FN);
  check("```quests: карта с прогрессом и ссылкой на следующий квест", qm.indexOf("cd-qmap") !== -1 && qm.indexOf("из 2") !== -1 && qm.indexOf("Следующий") !== -1);
  global.window.__CPPDOCS__ = savedData;
}

finish("Рантайм окна");
