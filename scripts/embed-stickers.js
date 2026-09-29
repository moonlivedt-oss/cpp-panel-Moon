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
//  Слоты — список SLOTS ниже (имя файла → где показывается в окне).
//
//  Любого файла может не быть — тогда на его месте рисуется SVG-заглушка из рантайма,
//  так что ничего не ломается. Форматы: webp (берётся первым — легче), png, gif, jpg, svg.
//
//  Запускать после добавления/замены наклеек:  node scripts/embed-stickers.js
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var DIR = path.join(ROOT, "extension", "stickers");
var RT = require("./build-runtime");      // рантайм собирается из частей extension/runtime/
var RUNTIME = RT.partWith("// STICKERS:start");

var SLOTS = [
  // Состояние окна: welcome — иконка на пилюле запуска.
  // (progress/done/noresult/empty заменены маскотом ниже — их не встраиваем.)
  "welcome",
  // Иконки пунктов меню (карточки «Быстрый доступ» на главном экране).
  "icon-start", "icon-route", "icon-ref", "icon-examples", "icon-cheat", "icon-tasks",
  // Маскот-человечек: главная (машет/думает/празднует) + заглушки (ищет/спит).
  "mascot-hi", "mascot-think", "mascot-done", "mascot-win", "mascot-search", "mascot-sleep",
  "mascot-oops",             // сочувствует ошибке сборки/тестов (2026-09-26)
  // Обложки тем (баннеры над названием темы), по разделу. Нет файла — полоса цветом раздела + значок.
  "cover-ref", "cover-tasks", "cover-examples", "cover-proekt", "cover-igry", "cover-main", "cover-notes",
  "ui-peek", "ui-learned",   // панель темы (2026-09-25)
  "badge-ref", "badge-tasks", "badge-examples", "badge-proekt", "badge-igry", "badge-main", "badge-notes",   // значки разделов
  // Значки интерфейса вместо эмодзи (2026-09-25). Нет файла — в окне остаётся прежний эмодзи.
  "ui-read", "ui-solve", "ui-streak", "ui-steps",        // плитки героя: изучено / решено / серия / разборы
  "ui-cards", "ui-warm", "ui-deck", "ui-shuffle", "ui-hint",   // повторение, разминка, колода, перемешать, подсказка
  "ui-dice", "ui-guide", "ui-news",                      // случайная задача, обучение, «что нового»
  "ui-settings",                                         // шапка окна настроек (2026-09-26)
  "ui-tab-look", "ui-tab-text", "ui-tab-window", "ui-tab-behave", "ui-tab-progress",   // вкладки настроек
  "ui-calendar", "ui-pencil",                           // итог повторения, «сначала вспомни»
];
// Ещё не нарисованы — окно обходится без них (запасная наклейка или пусто). Нарисовал — убери
// имя отсюда (смоук-тест проверяет, что у каждого слота вне этого списка есть картинка).
var PENDING = ["mascot-oops", "ui-settings", "ui-tab-look", "ui-tab-text", "ui-tab-window", "ui-tab-behave", "ui-tab-progress", "ui-calendar", "ui-pencil", "cover-ref", "cover-tasks", "cover-examples", "cover-proekt", "cover-igry", "cover-main", "cover-notes"];
var MIME = {
  ".webp": "image/webp", ".png": "image/png", ".gif": "image/gif",   // .webp первым: легче в 2–4 раза
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
};
var MAX_KB = 200;   // мягкий предел на одну наклейку: рантайм внедряется строкой и так большой

var map = {};
var found = [];
SLOTS.forEach(function (name) {
  // ищем name.<ext> с любым поддерживаемым расширением (порядок — как в MIME: .webp первым)
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

// Варианты значков под палитру окна: ui-<имя>@<палитра>.webp (например ui-read@tokyo.webp).
// В рантайм их НЕ встраиваем: их около сотни, а нужны в каждый момент 12 штук текущей палитры.
// Они идут отдельным файлом extension/stickers-palettes.json — окно читает его с диска один раз,
// когда выбрана палитра (data.stickersUrl). Так старт VS Code не тяжелеет. Ключи палитр:
// mocha tokyo dracula nord gruvbox rosepine onedark forest sunset.
var PAL_FILE = path.join(ROOT, "extension", "stickers-palettes.json");
var pal = {}, palKb = 0, palN = 0;
fs.readdirSync(DIR).sort().forEach(function (fn) {
  var m = fn.match(/^(ui-[a-z]+@[a-z]+)(\.(?:webp|png))$/);
  if (!m) return;
  if (pal[m[1]] && m[2] === ".png") return;                 // .webp того же имени уже взят
  var buf = fs.readFileSync(path.join(DIR, fn)), kb = Math.round(buf.length / 1024);
  if (kb > MAX_KB) { console.warn("  ! " + fn + " весит " + kb + "КБ — пропускаю."); return; }
  pal[m[1]] = "data:" + MIME[m[2]] + ";base64," + buf.toString("base64");
  palKb += buf.length / 1024; palN++;
});
if (palN) {
  fs.writeFileSync(PAL_FILE, JSON.stringify(pal), "utf8");
  console.log("Варианты под палитры: " + palN + " шт. (~" + Math.round(palKb) + " КБ) → extension/stickers-palettes.json");
} else if (fs.existsSync(PAL_FILE)) {
  fs.unlinkSync(PAL_FILE);
}

var src = fs.readFileSync(RUNTIME, "utf8");
var re = /\/\/ STICKERS:start[\s\S]*?\/\/ STICKERS:end/;
if (!re.test(src)) {
  console.error("В рантайме не найдены маркеры  // STICKERS:start … // STICKERS:end");
  process.exit(1);
}
// В рантайм (он впечатывается в оболочку VS Code при каждом старте) кладём только то, что нужно
// сразу, — наклейку пилюли-запуска. Остальные — в extension/stickers.json: окно прочитает его с диска
// при первом обращении к наклейке (ленивый STICKERS в рантайме). Так рантайм легче на ~300 КБ.
var EAGER = ["welcome"];
var eager = {}, lazy = {};
Object.keys(map).forEach(function (k) { (EAGER.indexOf(k) !== -1 ? eager : lazy)[k] = map[k]; });
var LAZY_FILE = path.join(ROOT, "extension", "stickers.json");
if (Object.keys(lazy).length) fs.writeFileSync(LAZY_FILE, JSON.stringify(lazy), "utf8");
else if (fs.existsSync(LAZY_FILE)) fs.unlinkSync(LAZY_FILE);
var block = "// STICKERS:start\n  var STICKERS = " + JSON.stringify(eager) + ";\n  // STICKERS:end";
src = src.replace(re, block);
fs.writeFileSync(RUNTIME, src, "utf8");
RT.write();
console.log("В рантайме: " + Object.keys(eager).join(", ") + " (~" + Math.round(Buffer.byteLength(JSON.stringify(eager)) / 1024) +
  " КБ); по требованию из extension/stickers.json: " + Object.keys(lazy).length + " шт. (~" + Math.round(Buffer.byteLength(JSON.stringify(lazy)) / 1024) + " КБ).");

if (found.length) {
  console.log("Встроено наклеек: " + found.length + " — " + found.join(", "));
} else {
  console.log("Наклеек в extension/stickers/ не найдено — рантайм рисует SVG-заглушки.");
  console.log("Положи сюда картинки с именами из SLOTS (.webp или .png) и запусти снова.");
}
var pend = PENDING.filter(function (n) { return !map[n]; });
if (pend.length) console.log("Ещё не нарисованы (окно обходится без них): " + pend.join(", ") + " — промпты в art/PROMPTS.md.");
