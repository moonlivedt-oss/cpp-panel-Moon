"use strict";

// Окно «Прогресс» и учебные блоки: освоение тем, карта знаний, слабые места, экзамен недели,
// достижения, рекорды задачи дня, сравнение кода («Контрольная точка», «Повтори за мной»), Anki.
// Рантайм поднимается под DOM-стабом (test/support/runtime-env.js) — это его настоящие функции.

const { check, group, finish } = require("./helpers");
const { loadRuntime } = require("./support/runtime-env.js");

const A = [
  "# Тема А",
  "",
  "**Уровень:** первые шаги · **Опирается на:** ничего — это первая тема",
  "",
  "## Раздел",
  "",
  "```cards",
  "Q: Вопрос один?",
  "A: Ответ один.",
  "",
  "Q: Вопрос два?",
  "A: Ответ `два`.",
  "```",
  "",
  "```quiz",
  "В: Сколько будет 2+2?",
  "+ 4",
  "- 5",
  "= Арифметика.",
  "",
  "В: Какой тип у 1.5?",
  "- int",
  "+ double",
  "```",
  "",
  "```challenge",
  "@id chA",
  "@type predict",
  "Что выведет?",
  "---",
  "int main(){}",
  "---",
  "1",
  "```",
  "",
  "```boss",
  "# Босс А",
  "@id bossA",
  "Сделай всё.",
  "```",
].join("\n");
const B = [
  "# Тема Б: продолжение",
  "",
  "**Уровень:** нужна база · **Опирается на:** [Тема А](01-a.md)",
  "",
  "```quiz",
  "В: Вопрос Б?",
  "+ да",
  "- нет",
  "```",
].join("\n");
const EX = "# Пример\n\n## Повтори за мной\n\n## Код целиком\n\n```cpp\n#include <iostream>\nint main() { std::cout << 1; }\n```\n";
const data = {
  root: "d", indexFile: "00.md", generatedAt: 1, run: { enabled: true },
  files: [
    { rel: "ref/01-a.md", name: "01-a.md", title: "Тема А", md: A, sections: 0, group: "Справочник по темам" },
    { rel: "ref/02-b.md", name: "02-b.md", title: "Тема Б: продолжение", md: B, sections: 0, group: "Справочник по темам" },
    { rel: "ref/03-x.md", name: "03-x.md", title: "Циклы", md: "# Циклы", sections: 0, group: "Справочник по темам" },
    { rel: "examples/01-x.md", name: "01-x.md", title: "Пример", md: EX, sections: 0 },
    { rel: "ref/06-v.md", name: "06-v.md", title: "Контейнеры", md: "# Контейнеры", sections: 0, group: "Справочник по темам" },
    { rel: "ref/07-s.md", name: "07-s.md", title: "Алгоритмы", md: "# Алгоритмы", sections: 0, group: "Справочник по темам" },
  ],
};
const api = loadRuntime(data);
const st = api._state();
function box(id, cls) {
  const classes = new Set(cls || []);
  return { getAttribute: (k) => (k === "data-id" ? id : null), classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c) }, querySelector: () => null };
}
function reset() {
  ["read", "cards", "challenge", "boss", "missed", "secSeen", "solved", "exams", "records", "weekly", "dailyDone"].forEach((k) => { st[k] = {}; });
  st.ach = {};
  delete st.daily;
}

group("Карта знаний");
reset();
const topics = api.progressTopics();
const ta = topics.find((t) => t.rel === "ref/01-a.md"), tb = topics.find((t) => t.rel === "ref/02-b.md");
check("темы — только ref/* со строкой «Опирается на»", topics.length === 2 && !topics.some((t) => /^examples/.test(t.rel)), topics.map((t) => t.rel));
check("связь из «Опирается на»: Б опирается на А", tb && tb.deps.length === 1 && tb.deps[0] === "ref/01-a.md", tb && tb.deps);
check("глубина: А — 0, Б — 1", ta.depth === 0 && tb.depth === 1);
check("в теме найдены карточки, задание и босс", ta.cards.length === 2 && ta.ch.length === 1 && ta.boss.length === 1 && ta.boss[0] === "bossA", ta);
check("ничего не сделано — освоение 0", api.topicMastery(ta).pct === 0);
check("Б закрыта, пока А не изучена и не освоена", api.topicUnlocked(tb) === false);
st.read["ref/01-a.md"] = true;
check("А отмечена «Изучено» — Б открыта", api.topicUnlocked(tb) === true);
const mid = api.topicMastery(ta).pct;
check("одна отметка «Изучено» — освоение частичное", mid > 0 && mid < 60, mid);
ta.cards.forEach((id) => { st.cards[id] = { ivl: 20, ease: 2.5, due: "2999-01-01" }; });
st.challenge.chA = true; st.boss.bossA = 1;
check("всё сделано — освоение 100 %", api.topicMastery(ta).pct === 100, api.topicMastery(ta));
st.missed["quiz:x"] = { rel: "ref/01-a.md", q: "q", a: "a", due: "2000-01-01", kind: "quiz" };
check("неотработанная ошибка снижает освоение", api.topicMastery(ta).pct < 100);
const map = api.knowledgeMapHtml();
check("карта: узел на каждую тему и связь между ними", (map.match(/data-krel="ref\//g) || []).length >= 2 && map.indexOf("cd-km-e") !== -1);

group("Слабые места");
reset();
st.read["ref/01-a.md"] = true;
const ws = api.weakSpots(3);
check("начатая тема с низким освоением — в слабых местах", ws.length === 1 && ws[0].t.rel === "ref/01-a.md", ws.map((x) => x.t.rel));
check("у слабого места есть конкретный шаг", ws[0] && ws[0].act && ws[0].act.label && ws[0].act.kind, ws[0] && ws[0].act);
check("не начатая тема в слабые места не попадает", !ws.some((x) => x.t.rel === "ref/02-b.md"));

group("Экзамен недели");
check("неделя по ISO: 1 января 2026 — 2026-W01", api.weekKey(new Date(2026, 0, 1)) === "2026-W01", api.weekKey(new Date(2026, 0, 1)));
check("29 декабря 2025 — тоже 2026-W01", api.weekKey(new Date(2025, 11, 29)) === "2026-W01");
check("27 сентября 2026 (воскресенье) — 2026-W39", api.weekKey(new Date(2026, 8, 27)) === "2026-W39");
const qs = api.quizQuestionsOf(data.files[0]);
check("вопросы опросника разобраны с верным вариантом", qs.length === 2 && qs[0].opts.some((o) => o.ok && o.text === "4"), qs);
const ex1 = api.buildWeeklyExam(), ex2 = api.buildWeeklyExam();
check("экзамен собран из опросников тем", ex1.qs.length === 3, ex1.qs.length);
check("на одной неделе — те же вопросы в том же порядке", JSON.stringify(ex1.qs.map((q) => q.q)) === JSON.stringify(ex2.qs.map((q) => q.q)));

group("Достижения");
reset();
api.checkAchievements(true);
check("первая проверка — молча, без заслуг", Object.keys(st.ach.got).length === 0);
st.read["ref/01-a.md"] = true;
const fresh = api.checkAchievements(false);
check("первая изученная тема — достижение", fresh.some((x) => x.id === "read1") && st.ach.got.read1);
const b1 = box("r1");
api.noteRunResult(b1, { stage: "compile", ok: false });
api.noteRunResult(b1, { stage: "run", ok: false, tests: [{ pass: false, crash: "abort" }] });
api.noteRunResult(b1, { stage: "run", ok: true, tests: [{ pass: true }] });
check("ошибка компиляции → собралось: счётчик «починил сборку»", st.ach.n.compileFix === 1, st.ach.n);
check("упала → прошла: «укротитель падений»", st.ach.n.crashFix === 1 && st.ach.n.runPass === 1);
const b2 = box("r2");
api.noteRunResult(b2, { stage: "run", ok: false, stopped: "hang", tests: [{ pass: false }] });
api.noteRunResult(b2, { stage: "run", ok: true, tests: [{ pass: true }] });
check("зависла → прошла: «вечный цикл пойман»", st.ach.n.hangFix === 1);
api.noteRunResult(box("r3", ["cd-rep"]), { stage: "run", ok: true, tests: [{ pass: true }] });
check("решённое «Повтори за мной» считается", st.ach.n.repeat === 1);
check("у каждого достижения есть название, описание и проверка", api.achList.every((x) => x.id && x.t && x.d && typeof x.ok === "function"));
check("в значках достижений нет эмодзи", api.achList.every((x) => /^[a-z0-9-]+$/.test(x.ic)));

group("Рекорды задачи дня");
reset();
const today = (function () { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
st.daily = { date: today, id: "chA", rel: "ref/01-a.md", type: "predict", prompt: "", title: "" };
api.noteDailyOpened();
check("открыл задачу дня — засечено время", typeof st.daily.startAt === "number" && st.daily.tries === 0);
st.daily.startAt = Date.now() - 65000;
st.daily.tries = 2;
api.noteDailySolved(box("chA"));
const rec = st.records[today];
check("решил — рекорд дня: время, попытки", rec && rec.ms >= 64000 && rec.tries === 3 && rec.type === "predict", rec);
check("строка рекорда на карточке задачи дня", /сегодня 1:0\d/.test(api.dailyRecordLine("predict")), api.dailyRecordLine("predict"));
check("таблица рекордов строится", api.recordsHtml().indexOf("предскажи вывод") !== -1);
api.noteDailySolved(box("другой"));
check("решение не задачи дня рекорд не пишет", Object.keys(st.records).length === 1);

group("Сравнение кода");
const REF = "#include <iostream>\n\nstruct Hero { int hp = 1; };\n\nint heal(int hp) { return hp + 5; }\n\nint main() {\n  // приветствие\n  std::cout << heal(1);\n}\n";
const same = api.lcsOps(api.codeLines(REF), api.codeLines(REF.replace(/  /g, "    ")));
check("отступы и комментарии не мешают: всё совпало", same.same === api.codeLines(REF).length, same);
check("пустые строки, комментарии и одинокие скобки не считаются", api.codeLines(REF).every((l) => l.key && l.key !== "}" && l.key.indexOf("приветствие") === -1));
const names = api.codeNames(REF);
check("найдены функции и типы верхнего уровня", names.fn.indexOf("heal") !== -1 && names.ty.indexOf("Hero") !== -1 && names.fn.indexOf("main") === -1, names);
const d1 = api.diffHtml(REF, "#include <iostream>\nint main() { std::cout << 6; }\n", "эталона");
check("сравнение называет, чего у тебя нет", d1.indexOf("heal()") !== -1 && d1.indexOf("Hero") !== -1, d1.slice(0, 400));
check("строки только в эталоне и только у тебя помечены", d1.indexOf("cd-df-l del") !== -1 && d1.indexOf("cd-df-l add") !== -1);
check("код примера — из раздела «Код целиком»", api.exampleRefCode(EX).indexOf("std::cout << 1") !== -1);

group("Блоки «Контрольная точка» и «Повтори за мной»");
const cp = api.renderCheckpoint("# Глава 1\nЧто должно быть.\n---\nint main() {}\n");
check("контрольная точка: название, кнопки, код эталона в data-code", cp.indexOf("Глава 1") !== -1 && cp.indexOf("cd-cp-cmp") !== -1 &&
  decodeURIComponent((cp.match(/data-code="([^"]*)"/) || [])[1] || "") === "int main() {}");
check("контрольная точка без кода — пусто", api.renderCheckpoint("# Глава\nтекст") === "");
const rp = api.renderRepeat("@id rp1\n@ref code/x.cpp\n@hint подсказка\nНапиши сам.\n---\n1\\n2 => 3\n");
check("повтори за мной: режим contains, тесты, спрятанный код", rp.indexOf('data-mode="contains"') !== -1 && rp.indexOf("data-tests=") !== -1 && rp.indexOf("hidecode") !== -1, rp.slice(0, 300));
check("строка @ref в условие не попадает", rp.indexOf("code/x.cpp") === -1);
check("подсказки — лесенкой", rp.indexOf("cd-hint-next") !== -1);
data.run.enabled = false;
const rpOff = api.renderRepeat("@id rp1\nНапиши.\n---\n1 => 1\n");
data.run.enabled = true;
check("без cppDocs.localRun — таблица поведения и подсказка включить запуск", rpOff.indexOf("cppDocs.localRun") !== -1 && rpOff.indexOf("cd-run-go") === -1);

group("Другие применения примера (```cpp alt:)");
const altHtml = api.render("```cpp\nint a = 1;\n```\n\n```cpp alt: В игре\nint hp = 30;\n```\n```cpp alt: В журнале\nint mark = 5;\n```\n\nтекст после");
check("пример и два применения — один блок со стрелками", (altHtml.match(/class="codewrap/g) || []).length === 1 && altHtml.indexOf("cd-alt-go") !== -1, altHtml.slice(0, 300));
check("три слайда и три вкладки с подписями, первая выбрана", (altHtml.match(/class="cd-alt-pane/g) || []).length === 3 &&
  (altHtml.match(/class="cd-alt-tab[ "]/g) || []).length === 3 && altHtml.indexOf('cd-alt-tab on') !== -1 && altHtml.indexOf("В журнале") !== -1 && altHtml.indexOf("3 применения") !== -1);
check("слайды лежат друг на друге (виден только первый), три точки-индикатора", (altHtml.match(/cd-alt-pane on/g) || []).length === 1 && (altHtml.match(/<i class="(on)?"><\/i>/g) || []).length === 3);

group("Забегаем вперёд");
const later = api.aheadNotes("std::vector<int> v;\nstd::sort(v.begin(), v.end());\nint main() { return 0; }", "ref/03-x.md", {});
const aNames = later.map((x) => x.name);
check("в теме 3: vector (тема 6) и алгоритмы (тема 7) — вперёд", aNames.indexOf("std::vector") !== -1 && aNames.some((x) => /алгоритмы/.test(x)), aNames);
check("main не считается «своей функцией»", aNames.indexOf("своя функция") === -1);
check("в теме 7 то же самое — уже не «вперёд»", api.aheadNotes("std::vector<int> v; std::sort(v.begin(), v.end());", "ref/07-s.md", {}).length === 0);
check("enum class — не class из темы 13", !api.aheadNotes("enum class Dir { Up, Down };", "ref/02-b.md", {}).some((x) => x.name === "class"));
check("код в комментарии не считается", api.aheadNotes("int x = 0; // потом возьмём std::vector", "ref/02-b.md", {}).length === 0);
const seenAhead = {};
api.aheadNotes("std::vector<int> a;", "ref/03-x.md", seenAhead);
check("на странице приём объясняется один раз", api.aheadNotes("std::vector<int> b;", "ref/03-x.md", seenAhead).length === 0);
check("вне справочника по темам — без заметок", api.aheadNotes("std::vector<int> v;", "examples/01-x.md", {}).length === 0);
check("текст после блока не съеден", altHtml.indexOf("текст после") !== -1);
check("обычный блок без alt — как раньше", api.render("```cpp\nint a;\n```").indexOf("cd-alts") === -1);

group("Экспорт карточек в Anki");
const anki = api.ankiExportText();
const lines = anki.text.trim().split("\n");
check("заголовок формата Anki и строка на карточку", lines[0] === "#separator:tab" && anki.count === 2 && lines.length === 5, lines);
check("вопрос, ответ и метка — через табуляцию; код — в <code>", lines[4].split("\t").length === 3 && lines[4].indexOf("<code>два</code>") !== -1, lines[4]);

group("Подрезка состояния по свежести");
const m = { "ref/a.md": 1, "ref/b.md": 1, "ref/c.md": 1, "ref/d.md": 1 };
api.keepRecent(m, 2, ["ref/a.md"]);
check("недавно открытый материал остаётся, по алфавиту не режем", m["ref/a.md"] && m["ref/d.md"] && !m["ref/b.md"], Object.keys(m));

finish("Прогресс: карта, экзамен, достижения, рекорды, сравнение кода");
