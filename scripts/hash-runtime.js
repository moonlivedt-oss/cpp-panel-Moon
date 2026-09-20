#!/usr/bin/env node
"use strict";

// Якорь целостности рантайма: считает SHA-256 cpp-docs-runtime.js и вписывает его в константу
// RUNTIME_SHA256 в extension.js. Перед впечатыванием рантайма в оболочку расширение сверяет
// хэш с этой константой — подмена файла на диске не пройдёт.
//
//   node scripts/hash-runtime.js            записать/обновить якорь
//   node scripts/hash-runtime.js --check    только сверить (падает при рассинхроне; для CI)

var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var ROOT = path.join(__dirname, "..");
var RUNTIME = path.join(ROOT, "extension", "cpp-docs-runtime.js");
var EXT = path.join(ROOT, "extension", "extension.js");
var MARK = /const RUNTIME_SHA256 = '[0-9a-f]*';/;

function hashRuntime() {
  // Хэшируем ТОЧНО так же, как injectWindowFiles в extension.js: читаем как utf8-строку и
  // обновляем хэш с кодировкой utf8 — иначе якорь и фактический хэш могли бы разойтись.
  var txt = fs.readFileSync(RUNTIME, "utf8");
  return crypto.createHash("sha256").update(txt, "utf8").digest("hex");
}

function currentConst() {
  var src = fs.readFileSync(EXT, "utf8");
  var m = src.match(/const RUNTIME_SHA256 = '([0-9a-f]*)';/);
  return m ? m[1] : null;
}

var checkOnly = process.argv.indexOf("--check") !== -1;
var sha = hashRuntime();
var cur = currentConst();

if (cur === null) {
  console.error("  [ПРОВАЛ] в extension/extension.js не найдена константа RUNTIME_SHA256.");
  process.exit(1);
}

if (checkOnly) {
  if (cur !== sha) {
    console.error("  [ПРОВАЛ] SHA-256 рантайма разошёлся с якорем в extension.js.");
    console.error("           ожидается: " + sha);
    console.error("           в коде:    " + (cur || "(пусто)"));
    console.error("           Выполните: node scripts/hash-runtime.js");
    process.exit(1);
  }
  console.log("  ✓ SHA-256 рантайма совпадает с якорем (" + sha.slice(0, 12) + "…)");
  process.exit(0);
}

if (cur === sha) {
  console.log("  ✓ RUNTIME_SHA256 уже актуален (" + sha.slice(0, 12) + "…)");
  process.exit(0);
}

var src = fs.readFileSync(EXT, "utf8");
src = src.replace(MARK, "const RUNTIME_SHA256 = '" + sha + "';");
fs.writeFileSync(EXT, src, "utf8");
console.log("  RUNTIME_SHA256 обновлён: " + (cur || "(пусто)") + " -> " + sha.slice(0, 12) + "…");
