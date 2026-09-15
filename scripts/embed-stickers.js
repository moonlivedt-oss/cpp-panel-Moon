#!/usr/bin/env node
// ============================================================
//  Встраивает рисованные наклейки в рантайм окна как data-URI.
//
//  В оболочке VS Code рантайм (cpp-docs-runtime.js) внедряется строкой и не может
//  грузить картинки с диска (CSP, нет доступа к файлам воркбенча). Поэтому наклейки
//  хранятся прямо в коде. Этот скрипт читает картинки из extension/stickers/ и
//  подставляет их base64 в объект STICKERS между маркерами
//  «// STICKERS:start … // STICKERS:end».
//
//  Слоты (имя файла → где показывается в окне):
//    welcome   — рядом с приветствием на главном экране (0% изучено);
//    progress  — там же, пока идёт учёба (1..99% изучено);
//    noresult  — когда поиск ничего не нашёл;
//    empty     — когда материалов нет / не загрузились;
//    done      — там же, когда весь справочник изучен (100%).
//
//  Любого файла может не быть — тогда на его месте рисуется SVG-заглушка из рантайма,
//  так что ничего не ломается. Форматы: png (лучше всего, с прозрачным фоном), webp, gif, svg.
//
//  Запускать после добавления/замены наклеек:  node scripts/embed-stickers.js
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var DIR = path.join(ROOT, "extension", "stickers");
var RUNTIME = path.join(ROOT, "extension", "cpp-docs-runtime.js");

var SLOTS = [
  // Состояния окна (приветствие/поиск/прогресс) — пять исходных наклеек.
  "welcome", "progress", "noresult", "empty", "done",
  // Иконки пунктов меню (карточки «Быстрый доступ» на главном экране).
  "icon-start", "icon-route", "icon-ref", "icon-examples", "icon-cheat", "icon-tasks",
];
var MIME = {
  ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
};
var MAX_KB = 200;   // мягкий предел на одну наклейку: рантайм внедряется строкой и так большой

var map = {};
var found = [];
SLOTS.forEach(function (name) {
  // ищем name.<ext> с любым поддерживаемым расширением (png в приоритете — идёт первым)
  var hit = null;
  Object.keys(MIME).forEach(function (ext) {
    var p = path.join(DIR, name + ext);
    if (!hit && fs.existsSync(p)) hit = { p: p, ext: ext };
  });
  if (!hit) return;
  var buf = fs.readFileSync(hit.p);
  var kb = Math.round(buf.length / 1024);
  if (kb > MAX_KB) {
    console.warn("  ! " + name + hit.ext + " весит " + kb + "КБ (> " + MAX_KB + "КБ) — сожми картинку, иначе рантайм раздуется. Пропускаю.");
    return;
  }
  map[name] = "data:" + MIME[hit.ext] + ";base64," + buf.toString("base64");
  found.push(name + hit.ext + " (" + kb + "КБ)");
});

var src = fs.readFileSync(RUNTIME, "utf8");
var re = /\/\/ STICKERS:start[\s\S]*?\/\/ STICKERS:end/;
if (!re.test(src)) {
  console.error("В рантайме не найдены маркеры  // STICKERS:start … // STICKERS:end");
  process.exit(1);
}
var block = "// STICKERS:start\n  var STICKERS = " + JSON.stringify(map) + ";\n  // STICKERS:end";
src = src.replace(re, block);
fs.writeFileSync(RUNTIME, src, "utf8");

if (found.length) {
  console.log("Встроено наклеек: " + found.length + " — " + found.join(", "));
} else {
  console.log("Наклеек в extension/stickers/ не найдено — рантайм рисует SVG-заглушки.");
  console.log("Положи сюда welcome / progress / noresult / empty / done .png и запусти снова.");
}
var totalKb = Math.round(Buffer.byteLength(JSON.stringify(map), "utf8") / 1024);
if (totalKb) console.log("Общий вес наклеек в рантайме: ~" + totalKb + "КБ base64.");
