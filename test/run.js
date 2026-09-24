// ============================================================
//  Тест «напиши и запусти» (Фаза 4): настоящая компиляция C++ + прогон по тестам.
//  Запуск:  node test/run.js   (или npm run test:run)
//
//  Грузит extension.js с заглушкой vscode (localRun=on, компилятор — найденный g++/clang++)
//  и прогоняет ext._run.runUserCode на трёх сценариях: верный код, неверный, и с ошибкой
//  компиляции. Если компилятор не найден — тест ПРОПУСКАЕТСЯ (exit 0), чтобы check не падал
//  на машинах без компилятора; на CI (MSYS2 UCRT64) он реально компилирует.
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");
var os = require("os");
var cp = require("child_process");
var Module = require("module");

var ROOT = path.join(__dirname, "..");
var EXT = path.join(ROOT, "extension");
var failures = [];
function check(name, cond, extra) {
  if (cond) console.log("  ok   " + name);
  else { console.log("  ПРОВАЛ " + name + (extra != null ? "  — " + String(JSON.stringify(extra)).slice(0, 300) : "")); failures.push(name); }
}

// MSYS-путь /d/foo → D:/foo(.exe): чтобы execFile получил настоящий windows-путь.
function toWinPath(p) {
  var m = p.match(/^\/([a-zA-Z])\/(.*)$/);
  if (m) p = m[1].toUpperCase() + ":/" + m[2];
  if (process.platform === "win32" && !/\.exe$/i.test(p) && fs.existsSync(p + ".exe")) p = p + ".exe";
  return p;
}
function findCompiler() {
  var names = ["g++", "clang++"];
  var finders = process.platform === "win32" ? ["where", "which"] : ["which"];
  for (var f = 0; f < finders.length; f++) {
    for (var i = 0; i < names.length; i++) {
      try {
        var out = cp.execFileSync(finders[f], [names[i]], { timeout: 4000 }).toString().trim().split(/\r?\n/)[0].trim();
        if (out) { var wp = toWinPath(out); if (fs.existsSync(wp)) return wp; if (fs.existsSync(out)) return out; }
      } catch (e) { /* нет такого — дальше */ }
    }
  }
  return null;
}

console.log("Напиши и запусти: end-to-end компиляция\n");
var compiler = findCompiler();
if (!compiler) { console.log("  пропущено — компилятор C++ (g++/clang++) не найден в PATH."); process.exit(0); }
console.log("  компилятор: " + compiler + "\n");

var stub = {
  Uri: { file: function (p) { return { fsPath: p }; } },
  workspace: { workspaceFolders: [], getConfiguration: function () { return { get: function (k) { if (k === "localRun") return true; if (k === "compiler") return compiler; if (k === "path") return path.join(ROOT, "docs"); if (k === "paths") return []; return true; } }; } },
  window: { showTextDocument: function () { return Promise.resolve({}); } }, commands: {},
};
// «Заготовка задачи»: новый документ — запоминаем, что попросили открыть.
var openedDocs = [];
stub.workspace.openTextDocument = function (o) { openedDocs.push(o); return Promise.resolve({}); };
var stubName = "vscode-stub-run-test";
var orig = Module._resolveFilename;
Module._resolveFilename = function (r) { if (r === "vscode") return stubName; return orig.apply(this, arguments); };
require.cache[stubName] = { id: stubName, filename: stubName, loaded: true, exports: stub };
delete require.cache[require.resolve(path.join(EXT, "extension.js"))];
var ext = require(path.join(EXT, "extension.js"));
Module._resolveFilename = orig;
var R = ext._run;

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-runtest-"));
var ctx = { globalStorageUri: { fsPath: TMP } };
var resPath = R.runResFilePath(ctx);

function waitRes(id, cb) {
  var waited = 0;
  var t = setInterval(function () {
    waited += 150;
    var res = null; try { res = JSON.parse(fs.readFileSync(resPath, "utf8")); } catch (e) {}
    if (res && res.id === id) { clearInterval(t); cb(res); }
    else if (waited >= 20000) { clearInterval(t); cb({ id: id, ok: false, stage: "timeout" }); }
  }, 150);
}

var SUM = "#include <iostream>\nint main(){int n; std::cin>>n; long s=0; for(int i=1;i<=n;++i) s+=i; std::cout<<s;}";
var WRONG = "#include <iostream>\nint main(){int n; std::cin>>n; std::cout<<n;}";
var BROKEN = "#include <iostream>\nint main(){ std::cout << ;}";
var SILENT = "int main(){return 0;}";   // выходит, не читая stdin
var NOISY = "#include <iostream>\nint main(){ for(int i=0;i<50000;i++) std::cerr<<\"debug line\"<<std::endl; std::cout<<\"done\"; }";
var uncaught = [];
process.on("uncaughtException", function (e) { uncaught.push(String(e && (e.code || e.message) || e)); });

function step1() {
  var id = "t1"; R.runUserCode(ctx, { id: id, code: SUM, tests: [{ "in": "5", "out": "15" }, { "in": "10", "out": "55" }] });
  waitRes(id, function (res) {
    if (res.stage === "nocompiler") { console.log("  пропущено — автопоиск компилятора в расширении не сработал."); finish(true); return; }
    check("верный код: stage=run, ok=true, оба теста прошли", res.stage === "run" && res.ok === true && (res.tests || []).length === 2 && res.tests.every(function (t) { return t.pass; }), res);
    step2();
  });
}
function step2() {
  var id = "t2"; R.runUserCode(ctx, { id: id, code: WRONG, tests: [{ "in": "5", "out": "15" }] });
  waitRes(id, function (res) {
    check("неверный код: ok=false, тест провален, got≠expected", res.stage === "run" && res.ok === false && res.tests[0].pass === false && res.tests[0].expected === "15", res.tests && res.tests[0]);
    step3();
  });
}
function step3() {
  var id = "t3"; R.runUserCode(ctx, { id: id, code: BROKEN, tests: [{ "in": "1", "out": "1" }] });
  waitRes(id, function (res) {
    check("битый код: stage=compile, есть текст ошибки", res.stage === "compile" && typeof res.compileError === "string" && res.compileError.length > 0, res && res.stage);
    check("normRunOut: '15\\n' == ' 15 '", R.normRunOut("15\n") === R.normRunOut(" 15 "));
    step4();
  });
}
function step4() {
  // Большой ввод программе, которая его не читает: EPIPE не должен ронять процесс.
  var id = "t4"; R.runUserCode(ctx, { id: id, code: SILENT, tests: [{ "in": "x".repeat(2000000), "out": "" }] });
  waitRes(id, function (res) {
    check("ввод не дочитан: без необработанного исключения, тест прошёл", uncaught.length === 0 && res.stage === "run" && res.ok === true, { uncaught: uncaught, stage: res.stage });
    step5();
  });
}
function step5() {
  // Много вывода в cerr не должно подвешивать программу (stderr вычитывается).
  var id = "t5"; R.runUserCode(ctx, { id: id, code: NOISY, tests: [{ "in": "", "out": "done" }] });
  waitRes(id, function (res) {
    check("поток в cerr: не таймаут, вывод cout сверен", res.stage === "run" && res.ok === true, res.tests && res.tests[0]);
    step6();
  });
}
function step6() {
  // Запрос, оставшийся с прошлой сессии, не исполняется и убирается.
  var reqPath = R.runReqFilePath(ctx);
  fs.writeFileSync(reqPath, JSON.stringify({ id: "stale", code: SUM, tests: [], ts: Date.now() - 3600000 }));
  R.processRunReq(ctx);
  setTimeout(function () {
    var res = null; try { res = JSON.parse(fs.readFileSync(resPath, "utf8")); } catch (e) {}
    check("старый запрос: не запущен, файл запроса удалён", !(res && res.id === "stale") && !fs.existsSync(reqPath), res && res.id);
    step7();
  }, 600);   // processRunReq откладывает разбор на 60 мс
}
function step7() {
  // «В заметки»: формат записи и место вставки (чистые функции, без записи в настоящие docs).
  var A = ext._actions;
  var entry = A.formatNoteEntry({ text: "vector  хранит\nэлементы подряд", rel: "ref/06-konteynery.md", title: "Контейнеры [x]", section: "Вектор", slug: "вектор" }, "2026-09-24");
  check("заметка: цитата + ссылка на раздел + дата",
    entry === "> vector хранит элементы подряд\n>\n> — [Контейнеры x → Вектор](../ref/06-konteynery.md#вектор) · 2026-09-24\n", entry);
  check("заметка: rel с «..» не превращается в ссылку", A.formatNoteEntry({ text: "t", rel: "../../evil.md", title: "T" }, "d").indexOf("](") === -1);
  var md = "# Мои заметки\n\nтекст\n\n---\n\n_шаблон_\n";
  var once = A.insertNoteEntry(md, "> A\n");
  check("заметка: раздел «Из справочника» создан в конце", /---\n\n_шаблон_\n\n## Из справочника\n\n> A\n$/.test(once), once);
  var twice = A.insertNoteEntry(once + "\n## Моё\n\nx\n", "> B\n");
  check("заметка: следующая запись — в конец своего раздела, до «## Моё»", twice.indexOf("> A\n\n> B\n\n## Моё") !== -1, twice);
  // Канал действий: неизвестное действие получает ответ ok:false, устаревшее — игнорируется.
  var ap = A.actionFilePath(ctx), arp = A.actionResFilePath(ctx);
  fs.writeFileSync(ap, JSON.stringify({ id: "x1", kind: "bogus", ts: Date.now() }));
  A.processActionReq(ctx);
  setTimeout(function () {
    var r1 = null; try { r1 = JSON.parse(fs.readFileSync(arp, "utf8")); } catch (e) {}
    check("действие: неизвестное → ответ ok:false", !!r1 && r1.id === "x1" && r1.ok === false, r1);
    fs.writeFileSync(ap, JSON.stringify({ id: "x2", kind: "note", text: "старое", ts: Date.now() - 3600000 }));
    A.processActionReq(ctx);
    setTimeout(function () {
      var r2 = null; try { r2 = JSON.parse(fs.readFileSync(arp, "utf8")); } catch (e) {}
      check("действие: старый запрос не выполняется", !(r2 && r2.id === "x2") && !fs.existsSync(ap), r2 && r2.id);
      fs.writeFileSync(ap, JSON.stringify({ id: "x3", kind: "newfile", code: "int main() {}\n", ts: Date.now() }));
      A.processActionReq(ctx);
      setTimeout(function () {
        var r3 = null; try { r3 = JSON.parse(fs.readFileSync(arp, "utf8")); } catch (e) {}
        check("действие: «заготовка» открывает новый C++-файл",
          !!r3 && r3.id === "x3" && r3.ok === true && openedDocs.length === 1 && openedDocs[0].language === "cpp" && openedDocs[0].content === "int main() {}\n", r3);
        finish(false);
      }, 300);
    }, 300);
  }, 300);
}
function finish(skipped) {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  if (skipped) { process.exit(0); return; }
  console.log("\n" + (failures.length ? "ПРОВАЛОВ: " + failures.length : "Напиши и запусти: все проверки пройдены"));
  process.exit(failures.length ? 1 : 0);
}
step1();
