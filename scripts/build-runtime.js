#!/usr/bin/env node
// ============================================================
//  Сборка рантайма окна из частей.
//
//  Исходники окна лежат по частям в extension/runtime/NN-имя.js (по теме: данные и состояние,
//  разметка, стили, навигатор, главная, каналы…). Окно же впечатывается в оболочку VS Code ОДНИМ
//  скриптом — extension/cpp-docs-runtime.js, — поэтому части просто склеиваются по порядку имён.
//  Части — не самостоятельные модули, а куски одной функции-обёртки (IIFE): общие переменные видны
//  всем частям, как и раньше в одном файле.
//
//  Запуск:   node scripts/build-runtime.js           — собрать
//            node scripts/build-runtime.js --check   — проверить, что собранный файл совпадает с частями
//  После сборки: npm run hash:runtime (якорь целостности). npm run build:runtime делает оба шага.
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var DIR = path.join(ROOT, "extension", "runtime");
var OUT = path.join(ROOT, "extension", "cpp-docs-runtime.js");

function parts() {
  return fs.readdirSync(DIR).filter(function (n) { return /^\d\d-[a-z0-9-]+\.js$/.test(n); }).sort()
    .map(function (n) { return path.join(DIR, n); });
}
function build() {
  return parts().map(function (p) {
    var s = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
    return s.endsWith("\n") ? s : s + "\n";
  }).join("");
}
/** Часть, в которой встречается строка/регэксп (для скриптов встраивания картинок). */
function partWith(marker) {
  var hit = parts().filter(function (p) {
    var s = fs.readFileSync(p, "utf8");
    return typeof marker === "string" ? s.indexOf(marker) !== -1 : marker.test(s);
  });
  if (hit.length !== 1) throw new Error("маркер " + marker + " найден в " + hit.length + " частях рантайма (нужна ровно одна)");
  return hit[0];
}
// Константы протокола окно↔расширение: единственный источник — extension/lib/protocol.js; в часть
// 00-core.js они попадают блоком между маркерами PROTOCOL:start … PROTOCOL:end.
var PROTO_RE = /  \/\* PROTOCOL:start[\s\S]*?\/\* PROTOCOL:end \*\//;
function syncProtocol(apply) {
  var snippet = require(path.join(ROOT, "extension", "lib", "protocol.js")).runtimeSnippet();
  var core = path.join(DIR, "00-core.js");
  var s = fs.readFileSync(core, "utf8").replace(/\r\n/g, "\n");
  var next = PROTO_RE.test(s) ? s.replace(PROTO_RE, function () { return snippet; })
    : s.replace(/(  var STYLE_ID = [^\n]*\n)/, function (m) { return m + snippet + "\n"; });
  if (next === s) return false;
  if (apply) fs.writeFileSync(core, next, "utf8");
  return true;
}
function write() { syncProtocol(true); fs.writeFileSync(OUT, build(), "utf8"); }

module.exports = { parts: parts, build: build, partWith: partWith, write: write, syncProtocol: syncProtocol, OUT: OUT, DIR: DIR };

if (require.main === module) {
  if (process.argv.indexOf("--check") !== -1 && syncProtocol(false)) {
    console.error("  ✗ константы протокола в extension/runtime/00-core.js разошлись с extension/lib/protocol.js — npm run build:runtime");
    process.exit(1);
  }
  if (process.argv.indexOf("--check") === -1) syncProtocol(true);
  var out = build();
  if (process.argv.indexOf("--check") !== -1) {
    var cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
    if (cur !== out) {
      console.error("  ✗ extension/cpp-docs-runtime.js не совпадает с частями extension/runtime/ — правьте части и запустите npm run build:runtime");
      process.exit(1);
    }
    console.log("  ✓ рантайм собран из частей (" + parts().length + " шт.)");
  } else {
    fs.writeFileSync(OUT, out, "utf8");
    console.log("Рантайм собран из " + parts().length + " частей → extension/cpp-docs-runtime.js (" + Math.round(out.length / 1024) + " КБ)");
  }
}
