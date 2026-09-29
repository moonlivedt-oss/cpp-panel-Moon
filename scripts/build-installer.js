#!/usr/bin/env node
// ============================================================
//  Сборка папки установщика:  dist/cpp-docs-panel-install
//  Запуск:  npm run installer            (из уже собранного .vsix)
//           npm run package:installer    (сначала собрать .vsix, потом папку)
//           node scripts/build-installer.js --no-solutions   вариант «без решений» (-bez-reshenij)
//           … --zip                                          ещё и .zip рядом с папкой
//           … --no-mooncore                                  без Moon Core в комплекте
//
//  Moon Core (../moon-core/dist/moon-core-<версия>.vsix) по умолчанию кладётся рядом: Установить.bat
//  предложит поставить его вместе с документацией, чтобы не качать отдельно. Нет файла или он старее
//  исходников Moon Core — сборка падает с подсказкой (раздать устаревший Moon Core хуже, чем никакой).
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

/** Самое свежее время изменения файла в дереве (без node_modules и .git). */
function newestMtime(dir) {
  var t = 0;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    if (e.name === "node_modules" || e.name[0] === ".") return;
    var p = path.join(dir, e.name);
    t = Math.max(t, e.isDirectory() ? newestMtime(p) : fs.statSync(p).mtimeMs);
  });
  return t;
}
/** .vsix Moon Core текущей версии из соседней папки проекта; null — --no-mooncore. */
function mooncoreVsix() {
  if (process.argv.indexOf("--no-mooncore") !== -1) return null;
  var mcRoot = path.join(ROOT, "..", "moon-core");
  var hint = " — соберите его (cd ../moon-core && npm run package) или добавьте --no-mooncore";
  var mcPkg;
  try { mcPkg = JSON.parse(fs.readFileSync(path.join(mcRoot, "extension", "package.json"), "utf8")); }
  catch (e) { fail("не найден проект Moon Core рядом (../moon-core)" + hint); }
  var p = path.join(mcRoot, "dist", mcPkg.name + "-" + mcPkg.version + ".vsix");
  if (!fs.existsSync(p)) fail("нет " + path.relative(ROOT, p) + hint);
  if (newestMtime(path.join(mcRoot, "extension")) > fs.statSync(p).mtimeMs) fail(path.basename(p) + " старее исходников Moon Core" + hint);
  return p;
}

var mcVsix = mooncoreVsix();
fs.rmSync(OUT, { recursive: true, force: true });
var files = copyTree(SRC, OUT);
fs.copyFileSync(vsix, path.join(OUT, vsixName));
if (mcVsix) fs.copyFileSync(mcVsix, path.join(OUT, path.basename(mcVsix)));

console.log("  ✔ Установщик собран: " + path.relative(ROOT, OUT));
console.log("    файлов из installer/: " + files + ", расширение: " + vsixName +
            " (" + Math.round(fs.statSync(vsix).size / 1024) + " КБ)" +
            (mcVsix ? ", Moon Core: " + path.basename(mcVsix) + " (" + Math.round(fs.statSync(mcVsix).size / 1024) + " КБ)" : ", без Moon Core"));

// --zip: рядом архив для раздачи. Пишем своим makeZip (тот же, что собирает .vsix): имена в UTF-8
// с флагом 0x0800 — кириллица батников в Проводнике не превращается в кракозябры, — разделитель «/»
// (.NET ZipFile в Windows PowerShell писал «\», и не-проводниковые распаковщики клали файлы с «\» в
// имени), фиксированная метка времени — архив воспроизводим байт-в-байт. Работает на любой ОС.
if (process.argv.indexOf("--zip") !== -1) {
  var makeZip = require("./package-extension.js").makeZip;
  var zip = OUT + ".zip";
  var top = path.basename(OUT);
  var entries = [];
  (function walk(dir, rel) {
    fs.readdirSync(dir, { withFileTypes: true })
      .sort(function (x, y) { return x.name < y.name ? -1 : x.name > y.name ? 1 : 0; })
      .forEach(function (e) {
        var r = rel + "/" + e.name, full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, r);
        else entries.push({ name: r, data: fs.readFileSync(full) });
      });
  })(OUT, top);
  fs.writeFileSync(zip, makeZip(entries));
  console.log("  ✔ Архив: " + path.relative(ROOT, zip) + " (" + Math.round(fs.statSync(zip).size / 1024) + " КБ, файлов: " + entries.length + ")");
}
