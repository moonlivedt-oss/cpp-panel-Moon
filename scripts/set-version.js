#!/usr/bin/env node
"use strict";

// Единый бамп версии: правит и корневой package.json, и extension/package.json одной командой,
// чтобы они не расходились (упаковщик теперь падает при рассинхроне). CHANGELOG не трогаем —
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
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log("  " + path.relative(ROOT, p) + ": " + old + " -> " + ver);
});

var ch = path.join(ROOT, "CHANGELOG.md");
try {
  if (fs.readFileSync(ch, "utf8").indexOf("[" + ver + "]") === -1) {
    console.log("\n  ! Не забудь добавить в CHANGELOG.md запись «## [" + ver + "] — <дата>» —");
    console.log("    без неё упаковщик остановит сборку.");
  }
} catch (e) { /* CHANGELOG может отсутствовать */ }
