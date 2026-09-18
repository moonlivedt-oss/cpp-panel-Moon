"use strict";

// Плоский конфиг ESLint 9. Ловит то, что `node --check` пропускает: обращение к необъявленной
// переменной, забытый var, повторное объявление. Глобалы описаны вручную — не тянем пакет
// `globals`, чтобы dev-зависимость была ровно одна (сам eslint). Рантайм — браузерный скрипт,
// остальное — CommonJS для Node.

var NODE_GLOBALS = {
  require: "readonly", module: "writable", exports: "writable", process: "readonly",
  __dirname: "readonly", __filename: "readonly", console: "readonly", Buffer: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
};

var BROWSER_GLOBALS = {
  window: "readonly", document: "readonly", localStorage: "readonly", navigator: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
  console: "readonly", MutationObserver: "readonly", getComputedStyle: "readonly",
  requestAnimationFrame: "readonly", XMLHttpRequest: "readonly",
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
  { ignores: ["node_modules/**", "dist/**", "**/.ruff_cache/**", "**/*.min.js"] },
  {
    files: ["extension/extension.js", "scripts/**/*.js", "test/**/*.js", "eslint.config.js"],
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
    rules: COMMON_RULES,
  },
];
