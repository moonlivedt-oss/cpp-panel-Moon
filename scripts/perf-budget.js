#!/usr/bin/env node
// ============================================================
//  Бюджет производительности (npm run check:perf, и в CI).
//
//  Окно живёт в оболочке VS Code — всё, что тяжелеет, замедляет сам редактор. Здесь замеряем
//  размеры (рантайм, что впечатывается в оболочку, полный файл данных) и время на настоящих
//  доках (рендер всех материалов, поиск). Вышли за бюджет — выход 1 с понятным сообщением.
//  Бюджет с запасом ~30 % к текущему: поднимать осознанно, а не «чтобы прошло».
// ============================================================
"use strict";

const fs = require("fs");
const path = require("path");
const Module = require("module");
const ROOT = path.join(__dirname, "..");

const BUDGET = {
  runtimeKB: 900,          // extension/cpp-docs-runtime.js
  inlineKB: 64,            // что впечатывается в workbench.html (оглавление + загрузчик)
  dataKB: 3500,            // полный файл данных окна (тексты + индекс поиска)
  renderAllMs: 800,        // renderMarkdown всех материалов подряд
  searchMs: 150,           // 20 запросов поиска по всем материалам (с прогретым индексом)
  searchColdMs: 150,       // первый запрос (нормализация индекса)
};

// заглушка vscode: документация — из docs/ этого репозитория
const orig = Module._resolveFilename;
Module._resolveFilename = function (r) { return r === "vscode" ? "vscode-stub-perf" : orig.apply(this, arguments); };
require.cache["vscode-stub-perf"] = { id: "vscode-stub-perf", filename: "vscode-stub-perf", loaded: true, exports: {
  workspace: { workspaceFolders: [{ uri: { fsPath: ROOT } }], isTrusted: true, getConfiguration: () => ({ get: () => undefined, inspect: () => ({}) }) },
  window: {}, env: {}, Uri: { file: (p) => ({ fsPath: p }) },
} };
const D = require(path.join(ROOT, "extension", "lib", "data.js"));
const { wbBlockSize } = (function () {
  const WB = require(path.join(ROOT, "extension", "lib", "wb-patch.js"));
  return { wbBlockSize: (body) => WB.buildWindowBlock(body, { src: "vscode-file://vscode-app/x/cpp-docs-runtime-000000000000.js", integrity: "sha256-x", sha: "0".repeat(64) }, "n").length };
})();
Module._resolveFilename = orig;

const os = require("os");
const ctx = { extensionPath: path.join(ROOT, "extension"), globalStorageUri: { fsPath: fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-perf-")) }, subscriptions: [] };
const full = D.windowData(ctx);
const inlineBody = D.windowDataBody(ctx, "nonce");

const rows = [];
function measure(name, value, limit, unit) { rows.push({ name, value, limit, unit, ok: value <= limit }); }

measure("рантайм окна", Math.round(fs.statSync(path.join(ROOT, "extension", "cpp-docs-runtime.js")).size / 1024), BUDGET.runtimeKB, "КБ");
measure("впечатывается в оболочку", Math.round(wbBlockSize(inlineBody) / 1024), BUDGET.inlineKB, "КБ");
measure("полный файл данных", Math.round(JSON.stringify(full).length / 1024), BUDGET.dataKB, "КБ");

const { loadRuntime } = require(path.join(ROOT, "test", "support", "runtime-env.js"));
const api = loadRuntime(full);
let t0 = process.hrtime.bigint();
for (const f of full.files) api.render(f.md || "");
measure("рендер всех материалов (" + full.files.length + ")", Number(process.hrtime.bigint() - t0) / 1e6, BUDGET.renderAllMs, "мс");

const QUERIES = ["vector", "push_back", "указатель", "ссылка", "цикл", "std::map", "класс", "исключение", "строка", "sort",
  "const", "шаблон", "файл", "ошибка", "массив", "рекурсия", "итератор", "лямбда", "unique_ptr", "cmake"];
t0 = process.hrtime.bigint();
full.files.forEach((f) => api.searchHit(f, QUERIES[0]));
measure("поиск: первый запрос (холодный индекс)", Number(process.hrtime.bigint() - t0) / 1e6, BUDGET.searchColdMs, "мс");
t0 = process.hrtime.bigint();
for (const q of QUERIES) full.files.forEach((f) => api.searchHit(f, q));
measure("поиск: 20 запросов по всем материалам", Number(process.hrtime.bigint() - t0) / 1e6, BUDGET.searchMs, "мс");

try { fs.rmSync(ctx.globalStorageUri.fsPath, { recursive: true, force: true }); } catch (e) { /* не критично */ }
let bad = 0;
console.log("Бюджет производительности:");
for (const r of rows) {
  if (!r.ok) bad++;
  console.log("  " + (r.ok ? "✓" : "✗") + " " + r.name.padEnd(42) + String(Math.round(r.value)).padStart(6) + " " + r.unit + "  (бюджет " + r.limit + ")");
}
if (bad) { console.error("\n  ✗ вышли за бюджет: " + bad + ". Найдите, что потяжелело, — или поднимите бюджет в scripts/perf-budget.js осознанно."); process.exit(1); }
