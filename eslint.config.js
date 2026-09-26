"use strict";

// Плоский конфиг ESLint 9. Ловит то, что `node --check` пропускает: обращение к необъявленной
// переменной, забытый var, повторное объявление. Глобалы описаны вручную — не тянем пакет
// `globals`, чтобы dev-зависимость была ровно одна (сам eslint). Рантайм — браузерный скрипт,
// остальное — CommonJS для Node.

var NODE_GLOBALS = {
  require: "readonly", module: "writable", exports: "writable", process: "readonly",
  __dirname: "readonly", __filename: "readonly", console: "readonly", Buffer: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
  setImmediate: "readonly", clearImmediate: "readonly", URL: "readonly",
};

var BROWSER_GLOBALS = {
  window: "readonly", document: "readonly", localStorage: "readonly", navigator: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
  console: "readonly", MutationObserver: "readonly", getComputedStyle: "readonly",
  requestAnimationFrame: "readonly", XMLHttpRequest: "readonly", fetch: "readonly", location: "readonly", atob: "readonly", NodeFilter: "readonly", EventSource: "readonly", Blob: "readonly", Event: "readonly", acquireVsCodeApi: "readonly",
  // В оболочке VS Code (electron-browser) доступен Node require — рантайм читает файлы напрямую.
  require: "readonly",
};

var COMMON_RULES = {
  "no-undef": "error",
  // Пустой catch (e) {} — устоявшаяся идиома проекта, не ругаемся на неиспользованный параметр.
  "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
  "no-redeclare": "error",
  "no-cond-assign": ["error", "except-parens"],
};

function merge(a, b) { var o = {}; for (var k in a) o[k] = a[k]; for (var j in b) o[j] = b[j]; return o; }

module.exports = [
  // Части рантайма (extension/runtime/) — куски одной функции-обёртки, по отдельности не JS-модули; линтуется собранный файл.
  { ignores: ["node_modules/**", "dist/**", "**/.ruff_cache/**", "**/*.min.js", "extension/runtime/**"] },
  {
    files: ["extension/extension.js", "extension/uninstall.js", "extension/lib/**/*.js", "scripts/**/*.js", "test/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2021, sourceType: "commonjs", globals: NODE_GLOBALS },
    rules: COMMON_RULES,
  },
  {
    // Превью/скриншот-скрипты содержат код, исполняемый В СТРАНИЦЕ (document и пр.) — Node + браузер.
    files: ["scripts/preview.js", "scripts/preview-window.js", "scripts/screenshots.js"],
    languageOptions: { ecmaVersion: 2021, sourceType: "commonjs", globals: merge(NODE_GLOBALS, BROWSER_GLOBALS) },
    rules: COMMON_RULES,
  },
  {
    files: ["extension/cpp-docs-runtime.js"],
    languageOptions: { ecmaVersion: 2021, sourceType: "script", globals: BROWSER_GLOBALS },
    // Разметка в DOM — только через setHTML (Trusted Types + чистка): прямые HTML-приёмники,
    // eval и new Function в окне, которое живёт в привилегированной оболочке, запрещены.
    rules: merge(COMMON_RULES, {
      "no-restricted-syntax": ["error",
        { selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]", message: "Разметку вставляй через setHTML(узел, html)." },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: "Разметку вставляй через setHTML(узел, html)." },
        { selector: "CallExpression[callee.property.name='write'][callee.object.name='document']", message: "document.write запрещён." },
        { selector: "CallExpression[callee.name='eval']", message: "eval в окне запрещён." },
        { selector: "NewExpression[callee.name='Function']", message: "new Function в окне запрещён." },
      ],
      "no-implied-eval": "error",
    }),
  },
];
