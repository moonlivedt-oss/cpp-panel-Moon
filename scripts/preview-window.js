#!/usr/bin/env node
// ============================================================
//  Превью ПЛАВАЮЩЕГО ОКНА в обычном браузере.   Запуск:  npm run preview:window
//
//  В настоящем VS Code окно рисует cpp-docs-runtime.js, внедрённый загрузчиком.
//  Чтобы посмотреть его вживую, не переустанавливая расширение, этот скрипт собирает
//  автономный HTML: подкладывает фон-«воркбенч» (класс .monaco-workbench vs-dark, как
//  у VS Code — от него рантайм берёт светлую/тёмную тему), выставляет window.__CPPDOCS__
//  из настоящих доков и подключает тот же рантайм. Открой build/preview-window.html.
//  build/ — папка для генерируемого (в .gitignore), отдельно от рукописных docs/.
//
//  Отличие от редактора: кнопка «Обновить» перечитывает файл данных по сети — в браузере
//  файла нет, поэтому она просто пересобирает из уже загруженных данных. Всё остальное
//  (перетаскивание, размер, навигатор, читалка, подсветка, копирование) работает как есть.
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");
var Module = require("module");

var ROOT = path.join(__dirname, "..");
var EXT = path.join(ROOT, "extension");

var pkg = JSON.parse(fs.readFileSync(path.join(EXT, "package.json"), "utf8"));
var defaultPath = pkg.contributes.configuration.properties["cppDocs.path"]["default"];
var docsPath = process.argv[2] || defaultPath;

// Заглушка vscode: extension.js требует модуль 'vscode', которого вне редактора нет.
// Нам нужен только buildDocsData — чистая функция от пути, но модуль всё равно грузится.
var stub = {
  Uri: { file: function (p) { return { fsPath: p }; } },
  workspace: {
    workspaceFolders: [],
    getConfiguration: function () { return { get: function (k) { return k === "path" ? docsPath : true; } }; },
  },
  window: { registerWebviewViewProvider: function () { return {}; }, showWarningMessage: function () {}, createStatusBarItem: undefined },
  commands: { registerCommand: function () { return {}; }, executeCommand: function () {} },
  extensions: { getExtension: function () { return null; } },
  StatusBarAlignment: { Left: 1 },
  ConfigurationTarget: { Global: 1 },
};
var stubName = "vscode-preview-window-stub";
var orig = Module._resolveFilename;
Module._resolveFilename = function (request) {
  if (request === "vscode") return stubName;
  return orig.apply(this, arguments);
};
require.cache[stubName] = { id: stubName, filename: stubName, loaded: true, exports: stub };

var ext = require(path.join(EXT, "extension.js"));
if (typeof ext.buildDocsData !== "function") {
  console.error("extension.js не экспортирует buildDocsData");
  process.exit(1);
}

if (!fs.existsSync(path.join(docsPath, "00-НАЧНИ-ОТСЮДА.md"))) {
  console.error("Документация не найдена: " + docsPath);
  process.exit(1);
}

var data = ext.buildDocsData(docsPath);
data.dataUrl = ""; // в браузере перечитать по сети нельзя — окно пересоберёт из загруженных данных

var runtime = fs.readFileSync(path.join(EXT, "cpp-docs-runtime.js"), "utf8");

// Экранируем </script> в данных и рантайме, чтобы не разорвать теги.
function safe(s) { return String(s).replace(/<\/script>/gi, "<\\/script>"); }

var html =
  "<!doctype html>\n<html lang=\"ru\"><head><meta charset=\"utf-8\">\n" +
  "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
  "<title>Превью плавающего окна — Документация C++</title>\n" +
  "<style>\n" +
  // Демонстрация акцента: подставляем те же переменные, что задаёт MoonLight custom-bg
  // (--mlbg-accent[-rgb]) и тема (--vscode-focusBorder). Здесь — образец (Catppuccin Mauve),
  // чтобы было видно, что окно красится акцентом. В настоящем редакторе рантайм возьмёт ТВОЙ
  // живой акцент custom-bg (из обоев) или focusBorder активной темы. Поменяй значения ниже,
  // чтобы примерить другой цвет прямо в превью.
  "  :root{--mlbg-accent:#cba6f7;--mlbg-accent-rgb:203,166,247;--vscode-focusBorder:#cba6f7;}\n" +
  "  html,body{margin:0;height:100%;font-family:'Segoe UI',system-ui,sans-serif;}\n" +
  "  .monaco-workbench{position:fixed;inset:0;background:#1e1e2e;color:#6c7086;overflow:hidden;}\n" +
  "  .fake-edit{padding:40px;font-family:Consolas,monospace;font-size:13px;line-height:1.6;opacity:.5;white-space:pre;}\n" +
  "  .hint{position:fixed;left:16px;top:14px;color:#7f849c;font-size:12px;}\n" +
  "</style></head>\n<body>\n" +
  "<div class=\"monaco-workbench vs-dark\">\n" +
  "  <div class=\"hint\">Превью: акцент здесь — образец (Catppuccin Mauve). В редакторе окно возьмёт твой живой акцент custom-bg/темы. Нажми «📘 C++» справа внизу.</div>\n" +
  "  <div class=\"fake-edit\">// имитация редактора VS Code\nint main() {\n  std::cout << \"Документация C++\";\n  return 0;\n}</div>\n" +
  "</div>\n" +
  "<script>window.__CPPDOCS__ = " + safe(JSON.stringify(data)) + ";</script>\n" +
  "<script>\n" + safe(runtime) + "\n</script>\n" +
  "<script>window.addEventListener('load', function(){ setTimeout(function(){ try{ window.__cppDocs.open(); }catch(e){} }, 100); });</script>\n" +
  "</body></html>\n";

var BUILD = path.join(ROOT, "build");
if (!fs.existsSync(BUILD)) fs.mkdirSync(BUILD, { recursive: true });
var out = path.join(BUILD, "preview-window.html");
fs.writeFileSync(out, html, "utf8");

console.log("Превью окна сохранено: build/preview-window.html");
console.log("  документация: " + docsPath);
console.log("  материалов: " + data.files.length);
console.log("\nОткрой файл в браузере, чтобы увидеть плавающее окно вживую.");
