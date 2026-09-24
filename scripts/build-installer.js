#!/usr/bin/env node
// ============================================================
//  Сборка папки установщика:  dist/cpp-docs-panel-install
//  Запуск:  npm run installer            (из уже собранного .vsix)
//           npm run package:installer    (сначала собрать .vsix, потом папку)
//           node scripts/build-installer.js --no-solutions   вариант «без решений» (-bez-reshenij)
//           … --zip                                          ещё и .zip рядом с папкой (Windows)
//
//  Берёт исходник installer/ (батники, tools/, Прочти-меня.txt) и .vsix текущей версии
//  из dist/, складывает всё в одну папку — её можно заархивировать и отдать.
//  Папку пересоздаёт с нуля, чтобы там не залежались старые .vsix и отчёты.
//  Батникам принудительно ставит CRLF: cmd с LF-строками промахивается мимо меток.
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var SRC = path.join(ROOT, "installer");
var DIST = path.join(ROOT, "dist");
var NO_SOL = process.argv.indexOf("--no-solutions") !== -1;
var SUFFIX = NO_SOL ? "-bez-reshenij" : "";
var OUT = path.join(DIST, "cpp-docs-panel-install" + SUFFIX);
var CRLF_EXT = /\.(bat|cmd|ps1|txt)$/i;
var SKIP = { "otchet.txt": true };   // локальный отчёт диагностики — не для раздачи

function fail(msg) { console.error("  ✖ " + msg); process.exit(1); }

var pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "extension", "package.json"), "utf8"));
var vsixName = pkg.name + "-" + pkg.version + SUFFIX + ".vsix";
var vsix = path.join(DIST, vsixName);
if (!fs.existsSync(vsix)) fail("нет " + path.relative(ROOT, vsix) + " — сначала соберите: npm run " + (NO_SOL ? "package:nosol" : "package"));

// Копия дерева installer/ с нормализацией переводов строк у текстовых файлов.
function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  var n = 0;
  fs.readdirSync(from, { withFileTypes: true }).forEach(function (e) {
    if (SKIP[e.name]) return;
    var s = path.join(from, e.name), d = path.join(to, e.name);
    if (e.isDirectory()) { n += copyTree(s, d); return; }
    if (CRLF_EXT.test(e.name)) {
      fs.writeFileSync(d, fs.readFileSync(s, "utf8").replace(/\r?\n/g, "\r\n"), "utf8");
    } else {
      fs.copyFileSync(s, d);
    }
    n++;
  });
  return n;
}

fs.rmSync(OUT, { recursive: true, force: true });
var files = copyTree(SRC, OUT);
fs.copyFileSync(vsix, path.join(OUT, vsixName));

console.log("  ✔ Установщик собран: " + path.relative(ROOT, OUT));
console.log("    файлов из installer/: " + files + ", расширение: " + vsixName +
            " (" + Math.round(fs.statSync(vsix).size / 1024) + " КБ)");

// --zip: рядом архив для раздачи. Через .NET ZipFile с явным UTF-8 — иначе кириллические
// имена батников в Проводнике превращаются в кракозябры. Только Windows (там его и раздают).
if (process.argv.indexOf("--zip") !== -1) {
  if (process.platform !== "win32") fail("--zip собирается только на Windows (PowerShell + .NET ZipFile)");
  var zip = OUT + ".zip";
  fs.rmSync(zip, { force: true });
  var ps = "Add-Type -AssemblyName System.IO.Compression.FileSystem; " +
    "[IO.Compression.ZipFile]::CreateFromDirectory($env:CPPDOCS_SRC, $env:CPPDOCS_ZIP, " +
    "[IO.Compression.CompressionLevel]::Optimal, $true, [Text.Encoding]::UTF8)";
  var r = require("child_process").spawnSync("powershell", ["-NoProfile", "-Command", ps], {
    stdio: "inherit", env: Object.assign({}, process.env, { CPPDOCS_SRC: OUT, CPPDOCS_ZIP: zip }),
  });
  if (r.status !== 0 || !fs.existsSync(zip)) fail("не удалось собрать архив " + path.relative(ROOT, zip));
  console.log("  ✔ Архив: " + path.relative(ROOT, zip) + " (" + Math.round(fs.statSync(zip).size / 1024) + " КБ)");
}
