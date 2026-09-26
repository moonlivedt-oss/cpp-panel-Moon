#!/usr/bin/env node
// ============================================================
//  Встраивает свои иконки кнопок окна в рантайм.   Запуск:  npm run embed:ui-icons
//
//  Картинки кладутся в extension/ui-icons/<имя>.webp|png|gif (квадратные, 64–128 px,
//  прозрачный фон). Имена — ниже в NAMES. Нет файла — у кнопки остаётся прежний символ.
//  Скрипт пишет объект UI_ICONS между маркерами  /* UI_ICONS:start */ … /* UI_ICONS:end */
//  и напоминает пересчитать хеш рантайма.
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var DIR = path.join(ROOT, "extension", "ui-icons");
var RT = require("./build-runtime");      // рантайм собирается из частей extension/runtime/
var RUNTIME = RT.partWith("/* UI_ICONS:start */");

// имя файла → где стоит
var NAMES = {
  "menu": "шапка: показать/скрыть список",
  "back": "шапка: назад",
  "forward": "шапка: вперёд",
  "split": "шапка: второй документ рядом",
  "snap-left": "шапка: прижать влево",
  "snap-right": "шапка: прижать вправо",
  "roll": "шапка: свернуть в полоску",
  "maximize": "шапка: во весь экран",
  "refresh": "шапка: обновить материалы",
  "close": "шапка: закрыть",
  "home": "панель темы: Главная",
  "sections": "панель темы: Разделы",
  "settings": "панель темы: настройки",
  "find": "панель темы: найти в материале",
  "copy": "панель темы: копировать материал",
  "read-off": "панель темы: «Изучено» — ещё нет",
  "read-on": "панель темы: «Изучено» — отмечено",
};
var MIME = { ".webp": "image/webp", ".png": "image/png", ".gif": "image/gif" };
var MAX_KB = 24;   // иконка 16 px на экране: больше 24 КБ — лишний вес в оболочке VS Code

var map = {}, found = [], missing = [];
Object.keys(NAMES).forEach(function (name) {
  var hit = null;
  Object.keys(MIME).forEach(function (ext) {
    var p = path.join(DIR, name + ext);
    if (!hit && fs.existsSync(p)) hit = { p: p, ext: ext };
  });
  if (!hit) { missing.push(name); return; }
  var buf = fs.readFileSync(hit.p);
  var kb = Math.round(buf.length / 1024);
  if (kb > MAX_KB) {
    console.warn("  ! " + name + hit.ext + " весит " + kb + " КБ (> " + MAX_KB + ") — уменьши до 64–128 px. Пропускаю.");
    return;
  }
  map[name] = "data:" + MIME[hit.ext] + ";base64," + buf.toString("base64");
  found.push(name + hit.ext);
});

var src = fs.readFileSync(RUNTIME, "utf8");
var re = /\/\* UI_ICONS:start \*\/[\s\S]*?\/\* UI_ICONS:end \*\//;
if (!re.test(src)) { console.error("В рантайме нет маркеров /* UI_ICONS:start */ … /* UI_ICONS:end */"); process.exit(1); }
src = src.replace(re, "/* UI_ICONS:start */\n  var UI_ICONS = " + JSON.stringify(map) + ";\n  /* UI_ICONS:end */");
fs.writeFileSync(RUNTIME, src, "utf8");
RT.write();

console.log("Встроено иконок: " + found.length + (found.length ? " — " + found.join(", ") : ""));
if (missing.length) console.log("Нет картинки (остаётся символ): " + missing.join(", "));
console.log("Дальше: npm run hash:runtime && npm run check");
