#!/usr/bin/env node
"use strict";

// Единый бамп версии: правит корневой package.json, extension/package.json (и версию модуля
// Moon Core в нём) и значок версии в README одной командой, чтобы они не расходились (упаковщик
// падает при рассинхроне). CHANGELOG не трогаем —
// запись под версию пишется руками; упаковщик проверит, что она есть.
//
//   node scripts/set-version.js 3.4.0

var fs = require("fs");
var path = require("path");

var ver = process.argv[2];
if (!ver || !/^\d+\.\d+\.\d+$/.test(ver)) {
  console.error("Использование: node scripts/set-version.js <MAJOR.MINOR.PATCH>");
  process.exit(1);
}

var ROOT = path.join(__dirname, "..");
[path.join(ROOT, "package.json"), path.join(ROOT, "extension", "package.json")].forEach(function (p) {
  var pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  var old = pkg.version;
  pkg.version = ver;
  // Модуль Moon Core (окно) — та же версия, что у расширения.
  if (pkg.moonCore && Array.isArray(pkg.moonCore.modules)) pkg.moonCore.modules.forEach(function (m) { if (m.version) m.version = ver; });
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log("  " + path.relative(ROOT, p) + ": " + old + " -> " + ver);
});

// Значок версии в README (shields.io: badge/version-X.Y.Z-цвет).
["README.md", "README.en.md"].forEach(function (n) {
  var p = path.join(ROOT, n);
  try {
    var t = fs.readFileSync(p, "utf8");
    var next = t.replace(/(badge\/version-)\d+\.\d+\.\d+(-)/g, "$1" + ver + "$2");
    if (next !== t) { fs.writeFileSync(p, next, "utf8"); console.log("  " + n + ": значок версии -> " + ver); }
  } catch (e) { /* README может отсутствовать */ }
});

var ch = path.join(ROOT, "CHANGELOG.md");
try {
  if (fs.readFileSync(ch, "utf8").indexOf("[" + ver + "]") === -1) {
    console.log("\n  ! Не забудь добавить в CHANGELOG.md запись «## [" + ver + "] — <дата>» —");
    console.log("    без неё упаковщик остановит сборку.");
  }
} catch (e) { /* CHANGELOG может отсутствовать */ }

// Рантайм окна вшивает VERSION из package.json — пересобрать его и обновить якорь SHA-256,
// иначе npm run check и упаковщик остановятся на рассинхроне.
var cp = require("child_process");
["build-runtime.js", "hash-runtime.js"].forEach(function (s) {
  var r = cp.spawnSync(process.execPath, [path.join(__dirname, s)], { stdio: "inherit" });
  if (r.status !== 0) { console.error("  ! не удалось: node scripts/" + s); process.exitCode = 1; }
});
