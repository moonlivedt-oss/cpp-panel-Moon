#!/usr/bin/env node
// ============================================================
//  Встраивает логотип в рантайм плавающего окна как data-URI.
//
//  В оболочке VS Code рантайм (cpp-docs-runtime.js) внедряется как строка и не может
//  грузить картинку с диска (нет доступа к файлам воркбенча, CSP). Поэтому логотип
//  хранится прямо в коде: этот скрипт читает docs/screenshots/logo-embed.png (компактная
//  версия, ~128px) и подставляет её base64 в строку `var LOGO_URI = "...";`.
//
//  Запускать при обновлении логотипа:  node scripts/embed-logo.js
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var LOGO = path.join(ROOT, "docs", "screenshots", "logo-embed.png");
var RUNTIME = path.join(ROOT, "extension", "cpp-docs-runtime.js");

if (!fs.existsSync(LOGO)) {
  console.error("Нет файла логотипа: " + LOGO);
  console.error("Положи компактный логотип (~128px PNG) сюда и запусти снова.");
  process.exit(1);
}

var b64 = fs.readFileSync(LOGO).toString("base64");
var uri = "data:image/png;base64," + b64;

var src = fs.readFileSync(RUNTIME, "utf8");
var re = /var LOGO_URI = "[^"]*";/;
if (!re.test(src)) {
  console.error("В рантайме не найдена строка  var LOGO_URI = \"...\";");
  process.exit(1);
}

src = src.replace(re, 'var LOGO_URI = "' + uri + '";');
fs.writeFileSync(RUNTIME, src, "utf8");

console.log("Логотип встроен в рантайм: " + Math.round(b64.length / 1024) + "KB base64");
