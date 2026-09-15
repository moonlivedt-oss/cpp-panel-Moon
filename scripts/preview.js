#!/usr/bin/env node
// ============================================================
//  Превью панели в обычном браузере.   Запуск:  npm run preview
//
//  Зачем. Чтобы посмотреть, как выглядит панель, обычно нужно собрать пакет,
//  поставить его и перезапустить редактор — три шага ради правки одного отступа.
//  Скрипт собирает тот же HTML, что увидит VS Code, подставляет цвета темы
//  (в редакторе они приходят из переменных --vscode-*, в браузере их нет)
//  и сохраняет в build/preview.html — открыл файл и смотришь.
//  build/ — папка для генерируемого (в .gitignore), отдельно от рукописных docs/.
//
//  Важно: это только вёрстка. Клики по пунктам в браузере ничего не открывают,
//  потому что мост до редактора (acquireVsCodeApi) существует только внутри него.
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");
var Module = require("module");

var ROOT = path.join(__dirname, "..");
var EXT = path.join(ROOT, "extension");
var BUILD = path.join(ROOT, "build");

// Путь к документации: аргументом или значение по умолчанию из манифеста
var pkg = JSON.parse(fs.readFileSync(path.join(EXT, "package.json"), "utf8"));
var defaultPath = pkg.contributes.configuration.properties["cppDocs.path"]["default"];
var docsPath = process.argv[2] || defaultPath;

// ------------------------------------------------------------
//  Заглушка vscode — вне редактора модуля нет
// ------------------------------------------------------------
var captured = { provider: null };
var stub = {
  Uri: { file: function (p) { return { fsPath: p }; } },
  workspace: {
    workspaceFolders: [],
    getConfiguration: function () {
      return { get: function (key) { return key === "path" ? docsPath : true; } };
    },
  },
  window: {
    registerWebviewViewProvider: function (id, provider) {
      captured.provider = provider;
      return {};
    },
    showWarningMessage: function () {},
    showTextDocument: function () {},
  },
  commands: { registerCommand: function () { return {}; }, executeCommand: function () {} },
};

var stubName = "vscode-preview-stub";
var origResolve = Module._resolveFilename;
Module._resolveFilename = function (request) {
  if (request === "vscode") return stubName;
  return origResolve.apply(this, arguments);
};
require.cache[stubName] = { id: stubName, filename: stubName, loaded: true, exports: stub };

var ext = require(path.join(EXT, "extension.js"));
ext.activate({
  subscriptions: [],
  globalState: { get: function (k, d) { return d; }, update: function () { return Promise.resolve(); } },
});

var html = "";
captured.provider.view = {
  webview: {
    set html(value) { html = value; },
    get html() { return html; },
  },
};
captured.provider.render();

// ------------------------------------------------------------
//  Подстановка темы. Цвета — Catppuccin Mocha, чтобы превью выглядело
//  примерно как в редакторе с тёмной темой.
// ------------------------------------------------------------
var theme =
  "<style>\n" +
  ":root{\n" +
  '  --vscode-font-family:"Segoe UI",system-ui,sans-serif;\n' +
  "  --vscode-foreground:#cdd6f4;\n" +
  "  --vscode-sideBar-background:#181825;\n" +
  "  --vscode-input-background:#313244;\n" +
  "  --vscode-input-foreground:#cdd6f4;\n" +
  "  --vscode-input-border:#45475a;\n" +
  "  --vscode-focusBorder:#89b4fa;\n" +
  "  --vscode-list-hoverBackground:#313244;\n" +
  "  --vscode-button-secondaryBackground:#45475a;\n" +
  "  --vscode-button-secondaryForeground:#cdd6f4;\n" +
  "  --vscode-button-secondaryHoverBackground:#585b70;\n" +
  "  --vscode-panel-border:#313244;\n" +
  "  --vscode-textCodeBlock-background:#313244;\n" +
  "}\n" +
  "body{background:var(--vscode-sideBar-background);max-width:360px;}\n" +
  "</style>\n";

html = html.replace("</head>", theme + "</head>");
// Мост до редактора заменяем заглушкой, иначе скрипт упадёт в браузере
// В редакторе этот мост даёт и postMessage, и хранилище состояния панели.
// В браузере его нет — подставляем заглушку с теми же методами, иначе скрипт
// падает на getState и список остаётся пустым.
html = html.replace(
  "const vscode = acquireVsCodeApi();",
  "const vscode = { postMessage: (m) => console.log('postMessage', m)," +
    " getState: () => JSON.parse(sessionStorage.getItem('preview-state') || '{}')," +
    " setState: (s) => sessionStorage.setItem('preview-state', JSON.stringify(s)) };"
);

if (!fs.existsSync(BUILD)) fs.mkdirSync(BUILD, { recursive: true });
var out = path.join(BUILD, "preview.html");
fs.writeFileSync(out, html, "utf8");

var items = (html.match(/ role="option"/g) || []).length;
var groups = (html.match(/class="group-label"/g) || []).length;

console.log("Превью сохранено: build/preview.html");
console.log("  документация: " + docsPath);
console.log("  групп: " + groups + ", пунктов: " + items);
console.log("\nОткрой файл в браузере, чтобы посмотреть вёрстку.");
