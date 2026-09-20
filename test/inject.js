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

var json = ext.safeJsonForScript(data);
check("safeJsonForScript не оставляет сырого '<' (глушит </script, <!--, <script)", json.indexOf("<") === -1);
var reparsed;
try { reparsed = JSON.parse(json); } catch (e) { reparsed = null; }
check("данные валидно парсятся обратно (JSON.parse)", !!reparsed && Array.isArray(reparsed.files));
// Спец-проверка: опасные последовательности из контента доков нейтрализованы, но восстановимы.
var evil = ext.safeJsonForScript({ md: "</script><!--<script>x" });
check("safeJsonForScript глушит все три вектора", evil.indexOf("<") === -1 && JSON.parse(evil).md === "</script><!--<script>x");

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
// Автообновление: рантайм должен опрашивать метку и запускать опрос на старте.
check("рантайм опрашивает метку свежести (pollStamp/__CPPDOCS_STAMP__)",
      runtimeRaw.indexOf("__CPPDOCS_STAMP__") !== -1 && runtimeRaw.indexOf("pollStamp") !== -1);
check("опрос метки запускается в boot()",
      /boot[\s\S]*pollStamp/.test(runtimeRaw));
// Бейдж на кнопке синхронизируется с данными в тике heal (обновляется и при закрытом окне).
check("бейдж синхронизируется с данными (syncBadge в heal)",
      runtimeRaw.indexOf("function syncBadge") !== -1 && /function heal[\s\S]*syncBadge\(\)/.test(runtimeRaw));
// Внешние ссылки открываются наружу, а не в workbench-фрейме.
check("внешние ссылки идут через openExternalLink (window.open)",
      runtimeRaw.indexOf("function openExternalLink") !== -1 &&
      runtimeRaw.indexOf("window.open") !== -1 &&
      (runtimeRaw.match(/openExternalLink\(href\)/g) || []).length >= 2);
// Один фоновый тикер (heal + poll вместе), не два.
check("фоновый тикер один (setInterval с шагом 3000)",
      (runtimeRaw.match(/setInterval\(/g) || []).length === 1);
// Поиск workbench.html кешируется на сессию.
var extRaw = fs.readFileSync(path.join(EXT, "extension.js"), "utf8");
check("findWorkbenchFiles кеширует результат (_wbCache)",
      extRaw.indexOf("_wbCache") !== -1 && /_wbCache = out/.test(extRaw));

// --- Безопасность: контракты по исходникам ---
// #5 allowlist схем ссылок/картинок.
check("рантайм фильтрует схемы ссылок (safeUrl)",
      runtimeRaw.indexOf("function safeUrl") !== -1 &&
      /href="' \+ safeUrl\(href/.test(runtimeRaw) &&
      /data-src="' \+ safeUrl\(src/.test(runtimeRaw));
// #3 строгая форма данных + защита прототипа.
check("рантайм валидирует форму данных и глушит __proto__ (looksSafe)",
      runtimeRaw.indexOf("function looksSafe") !== -1 && runtimeRaw.indexOf("__proto__") !== -1);
// #2 nonce вешается на динамический <style>, кешируется в boot.
check("рантайм вешает nonce на динамику (applyNonce) и кеширует CD_NONCE",
      runtimeRaw.indexOf("function applyNonce") !== -1 &&
      /CD_NONCE = /.test(runtimeRaw) &&
      (runtimeRaw.match(/applyNonce\(/g) || []).length >= 2);
// #1 Перечитка данных/метки НЕ исполняет файл (нет динамического <script> под данные/refresh).
check("рантайм перечитывает данные только через fs+JSON.parse, без исполнения файла",
      runtimeRaw.indexOf("sanitizeData(JSON.parse(") !== -1 &&
      !/document\.head\.appendChild\(s\)/.test(runtimeRaw) &&
      !/s\.src = url/.test(runtimeRaw));
// #1 гейт по доверию воркспейса.
check("findDocsRoot гейтит недоверенный воркспейс (workspaceTrusted/isTrusted)",
      extRaw.indexOf("function workspaceTrusted") !== -1 &&
      extRaw.indexOf("isTrusted") !== -1 &&
      /if \(workspaceTrusted\(\)\)/.test(extRaw));
// #6 лимиты объёма вшиваемых доков.
check("buildDocsData ограничивает объём (MAX_DOC_BYTES/MAX_TOTAL)",
      extRaw.indexOf("MAX_DOC_BYTES") !== -1 && extRaw.indexOf("MAX_TOTAL_DOC_BYTES") !== -1);
// #7 симлинки не разворачиваются.
check("mdFilesIn пропускает симлинки (isSymbolicLink)",
      /mdFilesIn[\s\S]*isSymbolicLink/.test(extRaw));
// #8 пишем только в настоящий workbench.html.
check("injectWindowFiles проверяет путь workbench.html",
      /workbench\[\\\\\/\]workbench\\\.html\$/.test(extRaw));
// #9 санити рантайма перед инъекцией.
check("injectWindowFiles проверяет рантайм перед инъекцией (bad-runtime)",
      extRaw.indexOf("'bad-runtime'") !== -1);
// #1+#2 инлайн: данные и рантайм впечатываются В оболочку (внешний file://-скрипт VS Code блокирует).
check("injectWindowFiles впечатывает данные инлайном (windowDataBody/__CPPDOCS__)",
      extRaw.indexOf("windowDataBody") !== -1 && extRaw.indexOf("window.__CPPDOCS__ = ") !== -1);
// #4 паритет офлайн-установщика: те же маркеры и та же инлайн-схема, что в JS.
var ps1 = fs.readFileSync(path.join(EXT, "..", "dist", "cpp-docs-panel-install", "window-inject.ps1"), "utf8");
check("PS1-установщик: те же маркеры + инлайн данных/рантайма + экранирование </script",
      ps1.indexOf("CPPDOCS-WINDOW-START") !== -1 &&
      ps1.indexOf("$dataJs") !== -1 && ps1.indexOf("$runtimeJs") !== -1 &&
      ps1.indexOf("<\\/script") !== -1);
// #6 упаковщик падает при рассинхроне версий и требует запись в CHANGELOG.
var packRaw = fs.readFileSync(path.join(EXT, "..", "scripts", "package-extension.js"), "utf8");
check("упаковщик требует совпадения версий и записи в CHANGELOG",
      /fail\(.*версии разошлись/.test(packRaw) && /CHANGELOG.*нет записи/.test(packRaw));
// #8 воспроизводимая сборка: фиксированная метка времени + печать SHA-256.
check("упаковщик воспроизводим (SOURCE_EPOCH) и печатает SHA-256",
      packRaw.indexOf("SOURCE_EPOCH") !== -1 && packRaw.indexOf("sha256") !== -1);

// ------------------------------------------------------------
//  3. Инъекция в workbench.html (настоящие функции расширения)
// ------------------------------------------------------------
console.log("\nИнъекция в оболочку");
var START = "<!-- CPPDOCS-WINDOW-START -->";
var END = "<!-- CPPDOCS-WINDOW-END -->";

// «Чистый» workbench с CSP-метой — как на свежем VS Code без загрузчиков.
var csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"script-src 'self' 'unsafe-eval'; style-src 'self';\">";
var fakeWorkbench = "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" + csp + "</head><body><div id=\"app\"></div></body></html>";

check("исходный workbench содержит CSP-мету", fakeWorkbench.indexOf("Content-Security-Policy") !== -1);

// НОВОЕ поведение: CSP не снимаем целиком (это ослабляло бы весь VS Code), а впускаем наши
// скрипты по nonce.
var nonce = ext.makeNonce();
check("makeNonce даёт непустой алфанум", /^[A-Za-z0-9]+$/.test(nonce) && nonce.length >= 8);
var armed = ext.armCspWithNonce(fakeWorkbench, nonce);
check("armCspWithNonce сохраняет CSP-мету", armed.indexOf("Content-Security-Policy") !== -1);
check("armCspWithNonce добавляет наш nonce в script-src", armed.indexOf("'nonce-" + nonce + "'") !== -1);
check("armCspWithNonce добавляет file: для перечитки данных", /script-src[^;>]*file:/.test(armed));
check("armCspWithNonce не трогает оболочку без CSP", ext.armCspWithNonce("<head></head>", nonce) === "<head></head>");

// #1+#2: данные И рантайм впечатываются инлайном (внешний file://-скрипт блокируется схемой vscode-file://).
var dataWithNonce = Object.assign({}, data, { scriptNonce: nonce });
var dataBody = "window.__CPPDOCS__ = " + ext.safeJsonForScript(dataWithNonce) + ";\n";
var block = ext.buildWindowBlock(dataBody, runtimeRaw, nonce);
check("оба <script> несут nonce", (block.match(new RegExp('nonce="' + nonce + '"', "g")) || []).length === 2);
check("данные и рантайм впечатаны инлайном (нет <script src=)",
      block.indexOf("window.__CPPDOCS__ = ") !== -1 && block.indexOf("__CPPDOCS_RUNTIME__") !== -1 &&
      !/<script[^>]*\ssrc=/.test(block));
var out = ext.applyWindowInjection(armed, block);
check("после подключения CSP-мета СОХРАНЕНА (не снята)", out.indexOf("Content-Security-Policy") !== -1);
check("после подключения script-src содержит наш nonce", out.indexOf("'nonce-" + nonce + "'") !== -1);
// neutralizeCsp остаётся как крайний случай — проверим, что функция ещё работает.
check("neutralizeCsp (fallback) убирает CSP-мету",
      typeof ext.neutralizeCsp === "function" && ext.neutralizeCsp(fakeWorkbench).indexOf("Content-Security-Policy") === -1);

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

// сквозная проверка: инлайн-данные __CPPDOCS__ из workbench.html снова парсятся
var m = out.match(/window\.__CPPDOCS__ = ([\s\S]*?);\n/);
var roundtrip = null;
if (m) { try { roundtrip = JSON.parse(m[1]); } catch (e) { roundtrip = null; } }
check("__CPPDOCS__ из workbench.html парсится, несёт files + nonce",
      !!roundtrip && Array.isArray(roundtrip.files) && roundtrip.files.length > 0 && roundtrip.scriptNonce === nonce);

// В блоке ровно два закрывающих </script> — данные + рантайм (контентные экранированы).
var ourBlock = out.slice(out.indexOf(START), out.indexOf(END));
var scriptCloses = count(ourBlock, "</script>");
check("ровно два закрывающих </script> (данные + рантайм)",
      scriptCloses === 2, "закрывающих </script>=" + scriptCloses);

// ------------------------------------------------------------
// Отключение окна: возврат CSP из бэкапа + атомарная запись
// ------------------------------------------------------------
var tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "cppdocs-test-"));
try {
  // 1) бэкап с CSP (как на «чистом» VS Code) → после снятия блока CSP должна вернуться
  var wbFile = path.join(tmpDir, "workbench.html");
  var bakFile = wbFile + ".cppdocs-backup";
  fs.writeFileSync(bakFile, fakeWorkbench, "utf8");          // оригинал с CSP
  var patched = ext.applyWindowInjection(ext.neutralizeCsp(fakeWorkbench), block); // без CSP + наш блок
  var disabled = ext.restoreCspFromBackup(ext.stripWindowInjection(patched), bakFile);
  check("после отключения CSP-мета возвращена из бэкапа",
        disabled.indexOf("Content-Security-Policy") !== -1);
  check("после отключения нашего блока в оболочке нет", disabled.indexOf(START) === -1);

  // 2) бэкап без CSP (свежие сборки VS Code) → restoreCspFromBackup ничего не добавляет
  var bakNoCsp = path.join(tmpDir, "wb2.html.cppdocs-backup");
  fs.writeFileSync(bakNoCsp, "<html><head></head><body></body></html>", "utf8");
  var noCsp = ext.restoreCspFromBackup("<html><head></head><body></body></html>", bakNoCsp);
  check("без CSP в бэкапе restoreCspFromBackup ничего не добавляет",
        noCsp.indexOf("Content-Security-Policy") === -1);

  // 3) atomic write: файл записан, временный .cppdocs-tmp не остался
  ext.writeWorkbenchAtomic(wbFile, disabled);
  check("writeWorkbenchAtomic записал файл", fs.readFileSync(wbFile, "utf8") === disabled);
  check("writeWorkbenchAtomic не оставил .cppdocs-tmp", !fs.existsSync(wbFile + ".cppdocs-tmp"));

  // 4) armed-CSP (с нашим nonce) → после отключения возвращается ОРИГИНАЛ без nonce
  var armedPatched = ext.applyWindowInjection(ext.armCspWithNonce(fakeWorkbench, nonce), block);
  var armedDisabled = ext.restoreCspFromBackup(ext.stripWindowInjection(armedPatched), bakFile);
  check("после отключения CSP вернулась к оригиналу (nonce снят)",
        armedDisabled.indexOf("Content-Security-Policy") !== -1 &&
        armedDisabled.indexOf("nonce-" + nonce) === -1 &&
        armedDisabled.indexOf("file:") === -1);
} finally {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
}

// ------------------------------------------------------------
console.log("\n" + (failures.length ? "ПРОВАЛОВ: " + failures.length : "Инъекция: все проверки пройдены") +
            "  (" + checks + " шт.)");
if (failures.length) {
  failures.forEach(function (f) { console.log("  - " + f); });
  process.exit(1);
}
