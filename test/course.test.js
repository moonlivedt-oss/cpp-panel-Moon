"use strict";

// Порядок тем справочника (extension/lib/course.js): группы в данных окна и панели, навигация тем.

const path = require("path");
const Module = require("module");
const { check, group, finish } = require("./helpers");

const ROOT = path.join(__dirname, "..");
const orig = Module._resolveFilename;
Module._resolveFilename = function (r) { return r === "vscode" ? "vscode-stub-course" : orig.apply(this, arguments); };
require.cache["vscode-stub-course"] = { id: "vscode-stub-course", filename: "vscode-stub-course", loaded: true,
  exports: { workspace: { workspaceFolders: [], getConfiguration: () => ({ get: () => undefined }) }, window: {}, Uri: { file: (p) => ({ fsPath: p }) } } };
const docs = require(path.join(ROOT, "extension", "lib", "docs.js"));
Module._resolveFilename = orig;
const course = require(path.join(ROOT, "extension", "lib", "course.js"));
const nav = require(path.join(ROOT, "scripts", "fix-nav.js"));

group("Порядок курса");
const data = docs.buildDocsData(path.join(ROOT, "docs"));
const topics = data.files.filter((f) => f.group === "Справочник по темам").map((f) => f.name.replace(/\.md$/, ""));
const refs = data.files.filter((f) => f.group === "Справка и словари").map((f) => f.name.replace(/\.md$/, ""));
check("темы справочника — в порядке course.js", JSON.stringify(topics) === JSON.stringify(course.COURSE), topics);
check("после struct (08) — указатели (22)", topics.indexOf("22-ukazateli") === topics.indexOf("08-struct-fayly") + 1);
check("справка и словари — отдельной группой", JSON.stringify(refs) === JSON.stringify(course.REFERENCE), refs);
check("соседи: у первой темы нет «назад», у 08 «вперёд» — 22", course.neighbours("01-osnovy").prev === null && course.neighbours("08-struct-fayly").next === "22-ukazateli");
check("справка — своя цепочка", course.neighbours("10-slovar").prev === "09-spravka" && course.neighbours("12-lovim-bagi").next === null);

group("Навигация тем");
check("ссылки «назад / вперёд» во всех темах — по порядку курса, сверху и снизу", nav.run(true).length === 0, nav.run(true));
check("строка навигации темы 22 ведёт назад в 08 и вперёд в 13", /\(08-struct-fayly\.md\).*\(13-klassy\.md\)/.test(nav.navLine("22-ukazateli")));

finish("Порядок курса и навигация");
