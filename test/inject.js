// ============================================================
//  Мини-тест инъекции плавающего окна.   Запуск:  node test/inject.js
// ============================================================
//  По образцу sandbox-тестов vscode-bg: проверяем не синтаксис, а то, что
//  впечатывание данных + рантайма в оболочку VS Code (workbench.html) даёт
//  рабочий результат и не воспроизводит прошлые баги окна.
//
//  Важно: тест вызывает НАСТОЯЩИЕ функции расширения (escapeScript,
//  buildWindowBlock, applyWindowInjection из extension.js), а не их копию —
//  значит проверяется тот код, который реально патчит оболочку.
//
//  Проверяем:
//    - данные собираются и валидно парсятся (JSON), материалов > 0;
//    - ни в данных, ни в рантайме не остаётся сырого </script> (иначе тег
//      закроется раньше времени — это был баг «текст поверх редактора»);
//    - блок встаёт между маркерами и перед </head>, данные идут ПЕРЕД рантаймом;
//    - повторная инъекция идемпотентна (ровно один блок, без дублей);
//    - у рантайма есть защита от повторного запуска (__CPPDOCS_RUNTIME__);
//    - __CPPDOCS__, извлечённый из готового workbench.html, снова парсится.
//
//  Тест не требует VS Code и ничего не пишет на диск.
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");
var Module = require("module");

var ROOT = path.join(__dirname, "..");
var EXT = path.join(ROOT, "extension");
var DOCS = path.join(ROOT, "docs");

var failures = [];
var checks = 0;
function check(name, condition, details) {
  checks++;
  if (condition) {
    console.log("  ok   " + name);
  } else {
    console.log("  ПРОВАЛ " + name + (details ? "  — " + details : ""));
    failures.push(name);
  }
}

// --- заглушка vscode, чтобы require(extension.js) не падал вне редактора ---
var STUB = {
  Uri: { file: function (p) { return { fsPath: p }; } },
  env: {},
  workspace: { workspaceFolders: [], getConfiguration: function () { return { get: function () { return ""; } }; }, onDidChangeConfiguration: function () { return { dispose: function () {} }; } },
  window: { registerWebviewViewProvider: function () { return {}; }, showWarningMessage: function () {}, showInformationMessage: function () {}, showErrorMessage: function () {}, createStatusBarItem: function () { return { show: function () {}, dispose: function () {} }; }, onDidChangeActiveColorTheme: function () { return { dispose: function () {} }; } },
  commands: { registerCommand: function () { return { dispose: function () {} }; }, executeCommand: function () {} },
  extensions: { getExtension: function () { return null; } },
  StatusBarAlignment: { Left: 1, Right: 2 }, ConfigurationTarget: { Global: 1 },
  EventEmitter: function () { this.event = function () { return { dispose: function () {} }; }; this.fire = function () {}; },
};
var VNAME = "vscode-inject-test";
var origResolve = Module._resolveFilename;
Module._resolveFilename = function (request) { if (request === "vscode") return VNAME; return origResolve.apply(this, arguments); };
require.cache[VNAME] = { id: VNAME, filename: VNAME, loaded: true, exports: STUB };

var ext = require(path.join(EXT, "extension.js"));

check("расширение экспортирует хелперы инъекции",
      typeof ext.escapeScript === "function" && typeof ext.buildWindowBlock === "function" &&
      typeof ext.applyWindowInjection === "function");

// ------------------------------------------------------------
//  1. Данные окна: сборка + экранирование (как windowDataBody)
// ------------------------------------------------------------
console.log("\nДанные окна");
var data = ext.buildDocsData(DOCS);
check("buildDocsData вернул объект с files", data && Array.isArray(data.files));
check("материалов больше нуля", data && data.files && data.files.length > 0,
      data && data.files ? "files=" + data.files.length : "нет files");

var json = ext.escapeScript(JSON.stringify(data));
var dataBody = "window.__CPPDOCS__ = " + json + ";\n";
check("тело данных не содержит сырого </script>", dataBody.indexOf("</script") === -1);
var reparsed;
try { reparsed = JSON.parse(json); } catch (e) { reparsed = null; }
check("данные валидно парсятся обратно (JSON.parse)", !!reparsed && Array.isArray(reparsed.files));

// ------------------------------------------------------------
//  2. Рантайм: читаемость + защита от повторного запуска
// ------------------------------------------------------------
console.log("\nРантайм");
var runtimeRaw = fs.readFileSync(path.join(EXT, "cpp-docs-runtime.js"), "utf8");
check("рантайм на месте и непустой", runtimeRaw.length > 1000);
check("есть защита от повторной инъекции (__CPPDOCS_RUNTIME__)",
      runtimeRaw.indexOf("__CPPDOCS_RUNTIME__") !== -1);
check("рантайм после экранирования не содержит сырого </script>",
      ext.escapeScript(runtimeRaw).indexOf("</script") === -1);

// ------------------------------------------------------------
//  3. Инъекция в workbench.html (настоящие функции расширения)
// ------------------------------------------------------------
console.log("\nИнъекция в оболочку");
var START = "<!-- CPPDOCS-WINDOW-START -->";
var END = "<!-- CPPDOCS-WINDOW-END -->";

// «Чистый» workbench с CSP-метой — как на свежем VS Code без загрузчиков.
var csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"script-src 'self' 'unsafe-eval';\">";
var fakeWorkbench = "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" + csp + "</head><body><div id=\"app\"></div></body></html>";

// CSP обязателен к снятию: иначе инлайн-<script> не выполнится (не будет ни окна, ни пилюли).
check("исходный workbench содержит CSP-мету", fakeWorkbench.indexOf("Content-Security-Policy") !== -1);
check("neutralizeCsp убирает CSP-мету",
      typeof ext.neutralizeCsp === "function" && ext.neutralizeCsp(fakeWorkbench).indexOf("Content-Security-Policy") === -1);

var block = ext.buildWindowBlock(dataBody, runtimeRaw);
var out = ext.applyWindowInjection(ext.neutralizeCsp(fakeWorkbench), block);
check("после подключения в оболочке НЕТ CSP-меты", out.indexOf("Content-Security-Policy") === -1);

function count(s, sub) { return s.split(sub).length - 1; }

check("applyWindowInjection вернул HTML", typeof out === "string" && out.length > 0);
check("после инъекции ровно один START-маркер", count(out, START) === 1);
check("после инъекции ровно один END-маркер", count(out, END) === 1);
check("блок стоит перед </head>", out.indexOf(START) < out.indexOf("</head>"));
check("данные идут перед рантаймом",
      out.indexOf("window.__CPPDOCS__") < out.indexOf("__CPPDOCS_RUNTIME__"));

// идемпотентность: повторный прогон не должен задваивать блок
var out2 = ext.applyWindowInjection(out, block);
check("повторная инъекция идемпотентна (один START)", count(out2, START) === 1);
check("повторная инъекция идемпотентна (один END)", count(out2, END) === 1);

// снятие инъекции возвращает исходный HTML
var cleaned = ext.stripWindowInjection(out);
check("stripWindowInjection убирает блок полностью", cleaned.indexOf(START) === -1 && cleaned.indexOf(END) === -1);

// сквозная проверка: __CPPDOCS__ из готового workbench.html снова парсится
var m = out.match(/window\.__CPPDOCS__ = ([\s\S]*?);\n/);
var roundtrip = null;
if (m) { try { roundtrip = JSON.parse(m[1]); } catch (e) { roundtrip = null; } }
check("__CPPDOCS__ из workbench.html парсится и содержит files",
      !!roundtrip && Array.isArray(roundtrip.files) && roundtrip.files.length > 0);

// Внутри <script> блок завершает ТОЛЬКО закрывающий </script>; открывающий
// <script> может встречаться в тексте рантайма (комментарий) и безвреден.
// Меряем закрывающие теги: их должно быть ровно два — наши; контентные экранированы.
var ourBlock = out.slice(out.indexOf(START), out.indexOf(END));
var scriptCloses = count(ourBlock, "</script>");
check("ровно два закрывающих </script> (наши; контентные экранированы)",
      scriptCloses === 2, "закрывающих </script>=" + scriptCloses);

// ------------------------------------------------------------
console.log("\n" + (failures.length ? "ПРОВАЛОВ: " + failures.length : "Инъекция: все проверки пройдены") +
            "  (" + checks + " шт.)");
if (failures.length) {
  failures.forEach(function (f) { console.log("  - " + f); });
  process.exit(1);
}
