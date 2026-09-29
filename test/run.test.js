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
// Верный ответ напечатан, но потом программа падает (исключение из at) — тест не засчитывается.
const OK_THEN_CRASH = "#include <iostream>\n#include <vector>\nint main(){ std::cout << \"ok\" << std::endl; std::vector<int> v; return v.at(5); }";
const HANG ="int main(){ volatile unsigned long long i = 0; for(;;) ++i; }";

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
    assert.match(res.tests[0].crash, /код 3|abort/);
  });
  await t.test("верный вывод, но программа упала — тест не пройден, причина в ответе", async () => {
    const res = await R.handleRun({ id: "t6b", code: OK_THEN_CRASH, tests: [{ in: "", out: "ok" }] });
    assert.equal(res.ok, false, JSON.stringify(res.tests));
    assert.equal(res.tests[0].pass, false);
    assert.ok(res.tests[0].crash, "есть причина падения");
  });
  await t.test("зависшая программа снимается по таймауту", { timeout: 30000 }, async () => {
    const t0 = Date.now();
    const res = await R.handleRun({ id: "t7", code: HANG, tests: [{ in: "", out: "" }] });
    assert.match(res.tests[0].got, /превышено время/);
    assert.ok(Date.now() - t0 < 25000);
  });
  await t.test("зависла на первом тесте — остальные не гоняются, ответ укладывается в бюджет", { timeout: 30000 }, async () => {
    const t0 = Date.now();
    const res = await R.handleRun({ id: "t7b", code: HANG, tests: [{ in: "", out: "" }, { in: "", out: "" }, { in: "", out: "" }] });
    assert.equal(res.stopped, "hang", JSON.stringify(res));
    assert.equal(res.tests.length, 3);
    assert.ok(res.tests[1].skipped && res.tests[2].skipped, JSON.stringify(res.tests));
    assert.ok(Date.now() - t0 < 15000, "один таймаут, а не три");
  });
  await t.test("режим contains: строки ожидаемого есть в выводе по порядку, подсказки ввода свои", async (tt) => {
    const CALC = "#include <iostream>\nint main(){int a,b; std::cout<<\"First: \"; std::cin>>a; std::cout<<\"Second: \"; std::cin>>b; std::cout<<a<<\" + \"<<b<<\" = \"<<a+b<<\"\\nBye!\";}";
    const ok = await R.handleRun({ id: "c1", code: CALC, mode: "contains", tests: [{ in: "2 3", out: "2 + 3 = 5\nbye" }] });
    // Антивирус (Kaspersky) иногда блокирует свежий MinGW-exe — это не ошибка кода.
    if (/заблокирован/.test(JSON.stringify(ok.tests))) { tt.skip("антивирус заблокировал запуск"); return; }
    assert.equal(ok.ok, true, JSON.stringify(ok.tests));
    const bad = await R.handleRun({ id: "c2", code: CALC, mode: "contains", tests: [{ in: "2 3", out: "bye\n2 + 3 = 5" }] });
    assert.equal(bad.ok, false, "порядок строк важен");
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
  await t.test("outputMatches: exact — как раньше, contains — части строк по порядку без учёта регистра", () => {
    assert.equal(R.outputMatches("15\n", "15"), true);
    assert.equal(R.outputMatches("Введите: 15", "15"), false);
    assert.equal(R.outputMatches("Введите: 15\nИТОГ ok", "15\nитог", "contains"), true);
    assert.equal(R.outputMatches("a\nb", "b\na", "contains"), false);
  });
  await t.test("бюджет ответа меньше ожидания окна (ответ не теряется)", () => {
    const P = require(path.join(EXT, "lib", "protocol.js"));
    assert.ok(R.RUN_BUDGET_MS < P.RUN_TIMEOUT_MS && R.RUN_BUDGET_MS >= 10000);
  });
  await t.test("отпечаток компилятора меняется вместе с файлом (обновили g++ — кэш не отдаст старое)", () => {
    const os = require("os");
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-cc-")), "g++.exe");
    fs.writeFileSync(f, "a");
    const s1 = R.compilerStamp({ cmd: "g++", path: f });
    fs.writeFileSync(f, "bbbb");
    const s2 = R.compilerStamp({ cmd: "g++", path: f });
    assert.notEqual(s1, s2);
    assert.equal(R.compilerStamp({ cmd: "g++" }), "g++");
  });
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

test("Напиши и запусти: причина падения простыми словами", () => {
  const { crashReason } = R;
  assert.equal(crashReason({ code: 0 }), "");
  assert.equal(crashReason({ timeout: true, code: 1 }), "");
  assert.match(crashReason({ code: 3 }), /abort/);
  assert.match(crashReason({ code: -1073741819 }), /чужой памяти/);    // 0xC0000005 как отрицательное число
  assert.match(crashReason({ code: 0xC00000FD }), /рекурсия/);
  assert.match(crashReason({ code: null, signal: "SIGSEGV" }), /чужой памяти/);
  assert.match(crashReason({ code: 7 }), /код 7/);
});
