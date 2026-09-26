"use strict";

// «Напиши и запусти»: настоящая компиляция C++ и прогон по тестам (lib/run.js) + действия окна
// (lib/actions.js). Без компилятора в PATH компиляционная часть пропускается (на CI — MSYS2 UCRT64).

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const Module = require("module");

const ROOT = path.join(__dirname, "..");
const EXT = path.join(ROOT, "extension");

// MSYS-путь /d/foo → D:/foo(.exe): чтобы execFile получил настоящий windows-путь.
function toWinPath(p) {
  const m = p.match(/^\/([a-zA-Z])\/(.*)$/);
  if (m) p = m[1].toUpperCase() + ":/" + m[2];
  if (process.platform === "win32" && !/\.exe$/i.test(p) && fs.existsSync(p + ".exe")) p = p + ".exe";
  return p;
}
function findCompiler() {
  const names = ["g++", "clang++"];
  const finders = process.platform === "win32" ? ["where", "which"] : ["which"];
  for (const f of finders) for (const n of names) {
    try {
      const out = cp.execFileSync(f, [n], { timeout: 4000 }).toString().trim().split(/\r?\n/)[0].trim();
      if (out) { const wp = toWinPath(out); if (fs.existsSync(wp)) return wp; if (fs.existsSync(out)) return out; }
    } catch (e) { /* нет такого — дальше */ }
  }
  return null;
}
const compiler = findCompiler();

let localRun = true;
const opened = [];
const stub = {
  Uri: { file: (p) => ({ fsPath: p }) },
  workspace: {
    workspaceFolders: [],
    getConfiguration: () => ({ get: (k) => (k === "localRun" ? localRun : k === "compiler" ? compiler : k === "path" ? path.join(ROOT, "docs") : k === "paths" ? [] : true) }),
    openTextDocument: (o) => { opened.push(o); return Promise.resolve({}); },
  },
  window: { showTextDocument: () => Promise.resolve({}), state: { focused: true } },
  commands: {},
};
const orig = Module._resolveFilename;
Module._resolveFilename = function (r) { return r === "vscode" ? "vscode-stub-run" : orig.apply(this, arguments); };
require.cache["vscode-stub-run"] = { id: "vscode-stub-run", filename: "vscode-stub-run", loaded: true, exports: stub };
const ext = require(path.join(EXT, "extension.js"));
Module._resolveFilename = orig;
const R = ext._run, A = ext._actions;

const SUM = "#include <iostream>\nint main(){int n; std::cin>>n; long s=0; for(int i=1;i<=n;++i) s+=i; std::cout<<s;}";
const WRONG = "#include <iostream>\nint main(){int n; std::cin>>n; std::cout<<n;}";
const BROKEN = "#include <iostream>\nint main(){ std::cout << ;}";
const SILENT = "int main(){return 0;}";   // выходит, не читая stdin
const NOISY = "#include <iostream>\nint main(){ for(int i=0;i<50000;i++) std::cerr<<\"debug line\"<<std::endl; std::cout<<\"done\"; }";
const CPP20 = "#include <format>\n#include <iostream>\n#include <string>\nint main(){std::string a,b; std::getline(std::cin,a); std::getline(std::cin,b);" +
  " std::cout << std::format(\"{}+{}\", a.starts_with(\"x\") ? 1 : 0, b.size()) << \"\\n\" << b;}";
const CRASH = "#include <iostream>\nint main(){ std::cerr << \"беда\"; return 3; }";
const HANG = "int main(){ volatile unsigned long long i = 0; for(;;) ++i; }";

const uncaught = [];
process.on("uncaughtException", (e) => uncaught.push(String(e && (e.code || e.message) || e)));

test("Напиши и запусти: компиляция и тесты", { skip: compiler ? false : "компилятор C++ не найден в PATH" }, async (t) => {
  await t.test("верный код: ok, оба теста прошли", async () => {
    const res = await R.handleRun({ id: "t1", code: SUM, tests: [{ in: "5", out: "15" }, { in: "10", out: "55" }] });
    assert.equal(res.stage, "run", JSON.stringify(res));
    assert.equal(res.ok, true);
    assert.ok(res.tests.every((x) => x.pass));
  });
  await t.test("тот же код второй раз — из кэша сборки", async () => {
    const res = await R.handleRun({ id: "t1b", code: SUM, tests: [{ in: "3", out: "6" }] });
    assert.equal(res.ok, true);
    assert.equal(res.cached, true);
  });
  await t.test("C++20 (std::format, starts_with), многострочный ввод", async () => {
    const res = await R.handleRun({ id: "t20", code: CPP20, tests: [{ in: "xyz\nабв", out: "1+6\nабв" }] });
    assert.equal(res.ok, true, res.compileError || JSON.stringify(res.tests));
  });
  await t.test("неверный код: тест провален, got≠expected", async () => {
    const res = await R.handleRun({ id: "t2", code: WRONG, tests: [{ in: "5", out: "15" }] });
    assert.equal(res.ok, false);
    assert.equal(res.tests[0].pass, false);
    assert.equal(res.tests[0].expected, "15");
  });
  await t.test("битый код: stage=compile с текстом ошибки", async () => {
    const res = await R.handleRun({ id: "t3", code: BROKEN, tests: [{ in: "1", out: "1" }] });
    assert.equal(res.stage, "compile");
    assert.ok(res.compileError.length > 0);
  });
  await t.test("ввод не дочитан — без необработанного исключения", async () => {
    const res = await R.handleRun({ id: "t4", code: SILENT, tests: [{ in: "x".repeat(2000000), out: "" }] });
    assert.deepEqual(uncaught, []);
    assert.equal(res.ok, true);
  });
  await t.test("много вывода в cerr не подвешивает программу", async () => {
    const res = await R.handleRun({ id: "t5", code: NOISY, tests: [{ in: "", out: "done" }] });
    assert.equal(res.ok, true, JSON.stringify(res.tests));
  });
  await t.test("падение: код выхода и начало stderr в ответе", async () => {
    const res = await R.handleRun({ id: "t6", code: CRASH, tests: [{ in: "", out: "ok" }] });
    assert.equal(res.tests[0].exit, 3);
    assert.match(res.tests[0].stderr, /беда/);
  });
  await t.test("зависшая программа снимается по таймауту", { timeout: 30000 }, async () => {
    const t0 = Date.now();
    const res = await R.handleRun({ id: "t7", code: HANG, tests: [{ in: "", out: "" }] });
    assert.match(res.tests[0].got, /превышено время/);
    assert.ok(Date.now() - t0 < 25000);
  });
  await t.test("очередь: запросы сверх лимита получают busy, остальные выполняются", async () => {
    const all = await Promise.all([0, 1, 2, 3, 4].map((i) => R.handleRun({ id: "q" + i, code: SUM, tests: [{ in: "1", out: "1" }] })));
    assert.ok(all.filter((r) => r.stage === "busy").length >= 1, JSON.stringify(all.map((r) => r.stage)));
    assert.ok(all.filter((r) => r.ok).length >= 3);
  });
});

test("Напиши и запусти: проверки запроса", async (t) => {
  await t.test("localRun выключен — stage=disabled, ничего не компилируется", async () => {
    localRun = false;
    const res = await R.handleRun({ id: "d1", code: SUM, tests: [] });
    localRun = true;
    assert.equal(res.stage, "disabled");
  });
  await t.test("код больше лимита — отказ", async () => {
    const res = await R.handleRun({ id: "big", code: "x".repeat(300000), tests: [] });
    assert.equal(res.ok, false);
    assert.equal(res.stage, "io");
  });
  await t.test("normRunOut: '15\\n' == ' 15 '", () => assert.equal(R.normRunOut("15\n"), R.normRunOut(" 15 ")));
});

test("Действия окна", async (t) => {
  await t.test("заметка: цитата + ссылка на раздел + дата", () => {
    const entry = A.formatNoteEntry({ text: "vector  хранит\nэлементы подряд", rel: "ref/06-konteynery.md", title: "Контейнеры [x]", section: "Вектор", slug: "вектор" }, "2026-09-24");
    assert.equal(entry, "> vector хранит элементы подряд\n>\n> — [Контейнеры x → Вектор](../ref/06-konteynery.md#вектор) · 2026-09-24\n");
  });
  await t.test("заметка: rel с «..» не превращается в ссылку", () => {
    assert.equal(A.formatNoteEntry({ text: "t", rel: "../../evil.md", title: "T" }, "d").indexOf("]("), -1);
  });
  await t.test("заметки: раздел «Из справочника» и порядок записей", () => {
    const once = A.insertNoteEntry("# Мои заметки\n\nтекст\n\n---\n\n_шаблон_\n", "> A\n");
    assert.match(once, /---\n\n_шаблон_\n\n## Из справочника\n\n> A\n$/);
    const twice = A.insertNoteEntry(once + "\n## Моё\n\nx\n", "> B\n");
    assert.ok(twice.indexOf("> A\n\n> B\n\n## Моё") !== -1);
  });
  await t.test("неизвестное действие → ok:false", async () => {
    const r = await A.handleAction({}, { id: "x1", kind: "bogus" });
    assert.equal(r.ok, false);
  });
  await t.test("мост: окно без фокуса отвечает retry", async () => {
    stub.window.state.focused = false;
    const r = await A.handleAction({}, { id: "x2", kind: "newfile", code: "x" }, { requireFocus: true });
    stub.window.state.focused = true;
    assert.equal(r.retry, true);
  });
  await t.test("«заготовка» открывает новый C++-файл", async () => {
    const r = await A.handleAction({}, { id: "x3", kind: "newfile", code: "int main() {}\n" });
    assert.equal(r.ok, true);
    assert.equal(opened[opened.length - 1].language, "cpp");
    assert.equal(opened[opened.length - 1].content, "int main() {}\n");
  });
  await t.test("журнал окна: запись принимается, частота ограничена", async () => {
    const out = [];
    for (let i = 0; i < 35; i++) out.push(await ext._rpc.dispatch({}, "log", { msg: "ошибка " + i }));
    assert.ok(out.every((r) => r.ok));
    assert.ok(out.some((r) => r.dropped));
  });
});
