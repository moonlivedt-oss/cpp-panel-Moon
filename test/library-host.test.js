"use strict";

// Библиотеки на стороне расширения: у C++ и Unreal свои файлы данных, метки и зеркала прогресса;
// выбор хранится в cpp-docs-lib.json и globalState; действие окна «library» переключает выбор;
// без папки Unreal переключиться нельзя, а сохранённый выбор Unreal откатывается на C++.

const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const { check, group, finish } = require("./helpers");

const ROOT = path.join(__dirname, "..");
const EXT = path.join(ROOT, "extension");
const store = fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-lib-"));
const cppDocs = path.join(store, "cpp-docs");
const ueDocs = path.join(store, "unreal-docs");
const INDEX = "00-НАЧНИ-ОТСЮДА.md";
fs.mkdirSync(path.join(cppDocs, "ref"), { recursive: true });
fs.mkdirSync(path.join(ueDocs, "ref"), { recursive: true });
fs.writeFileSync(path.join(cppDocs, INDEX), "# Старт C++\n\n> Основа.\n\nтекст-только-про-cpp\n");
fs.writeFileSync(path.join(cppDocs, "ref", "01-osnovy.md"), "# Основы\n\n## Переменные\n");
fs.writeFileSync(path.join(ueDocs, INDEX), "# Старт Unreal\n\n> Дополнение.\n\nтекст-только-про-unreal\n");
fs.writeFileSync(path.join(ueDocs, "ref", "01-interfeys.md"), "# Интерфейс редактора\n\n## Окна\n");

const conf = { path: cppDocs, unrealPath: ueDocs };
const gs = {};
const stub = {
  Uri: { file: (p) => ({ fsPath: p }), parse: (s) => ({ toString: () => s }) },
  workspace: { workspaceFolders: [], getConfiguration: () => ({ get: (k) => conf[k], inspect: () => ({}) }), isTrusted: true },
  window: { visibleTextEditors: [], state: { focused: true }, showWarningMessage: () => Promise.resolve(), showInformationMessage: () => Promise.resolve() },
  commands: { executeCommand: () => Promise.resolve() },
};
const orig = Module._resolveFilename;
Module._resolveFilename = function (r) { return r === "vscode" ? "vscode-stub-lib" : orig.apply(this, arguments); };
require.cache["vscode-stub-lib"] = { id: "vscode-stub-lib", filename: "vscode-stub-lib", loaded: true, exports: stub };
const docs = require(path.join(EXT, "lib", "docs.js"));
const storage = require(path.join(EXT, "lib", "storage.js"));
const data = require(path.join(EXT, "lib", "data.js"));
const library = require(path.join(EXT, "lib", "library.js"));
const actions = require(path.join(EXT, "lib", "actions.js"));
const { progressFilePath } = require(path.join(EXT, "lib", "progress.js"));
const P = require(path.join(EXT, "lib", "protocol.js"));
Module._resolveFilename = orig;

const ctx = {
  globalStorageUri: { fsPath: path.join(store, "gs") }, subscriptions: [],
  globalState: { get: (k, d) => (k in gs ? gs[k] : d), update: (k, v) => { gs[k] = v; return Promise.resolve(); } },
};
const readData = (lib) => {
  const t = fs.readFileSync(storage.dataFilePath(ctx, lib), "utf8");
  return JSON.parse(t.replace(/^window\.__CPPDOCS__\s*=\s*/, "").replace(/;\s*$/, ""));
};

(async () => {
  group("Библиотеки: файлы и корни");
  check("две библиотеки: cpp и unreal", docs.LIBRARY_IDS.join() === "cpp,unreal");
  check("корни: C++ из cppDocs.path, Unreal из cppDocs.unrealPath", docs.findDocsRoot("cpp") === cppDocs && docs.findDocsRoot("unreal") === ueDocs);
  check("у C++ прежние имена файлов, у Unreal — с суффиксом",
    path.basename(storage.dataFilePath(ctx, "cpp")) === "cpp-docs-data.js" && path.basename(storage.dataFilePath(ctx, "unreal")) === "cpp-docs-data-unreal.js" &&
    path.basename(storage.stampFilePath(ctx, "unreal")) === "cpp-docs-stamp-unreal.js" && path.basename(progressFilePath(ctx, "unreal")) === "cpp-docs-progress-unreal.json");
  check("протокол: окно может писать зеркало Unreal, его метка и прогресс — свои события",
    P.WRITABLE.indexOf("cpp-docs-progress-unreal.json") !== -1 && P.EVENT_FILES["cpp-docs-stamp-unreal.js"] === "stamp-unreal" &&
    P.EVENT_FILES["cpp-docs-progress-unreal.json"] === "progress-unreal" && P.EVENT_FILES["cpp-docs-lib.json"] === "lib" &&
    ["stamp-unreal", "progress-unreal", "lib"].every((e) => P.EVENTS.indexOf(e) !== -1));

  group("Библиотеки: старт и данные");
  check("по умолчанию выбрана C++", library.initLibrary(ctx) === "cpp" && docs.activeLibrary() === "cpp");
  check("файл выбора записан", JSON.parse(fs.readFileSync(storage.libFilePath(ctx), "utf8")).lib === "cpp");
  check("данные пишутся для обеих библиотек", data.writeDocsData(ctx) === true && fs.existsSync(storage.dataFilePath(ctx, "cpp")) && fs.existsSync(storage.dataFilePath(ctx, "unreal")));
  const dc = readData("cpp"), du = readData("unreal");
  check("файл C++ — только материалы C++", dc.lib === "cpp" && JSON.stringify(dc.files).indexOf("текст-только-про-unreal") === -1 && JSON.stringify(dc.files).indexOf("текст-только-про-cpp") !== -1);
  check("файл Unreal — только материалы Unreal", du.lib === "unreal" && JSON.stringify(du.files).indexOf("текст-только-про-cpp") === -1 && du.files.some((f) => f.rel === "ref/01-interfeys.md"));
  check("у каждой свои адреса данных, метки и прогресса", du.dataUrl !== dc.dataUrl && du.stampUrl !== dc.stampUrl && du.progressUrl !== dc.progressUrl && /unreal/.test(du.progressUrl));
  check("переключатель: в данных обе библиотеки — только адреса и названия",
    dc.libs && dc.libs.unreal.available === true && dc.libs.unreal.dataUrl === du.dataUrl && !("files" in dc.libs.unreal) && dc.libUrl === du.libUrl);

  group("Библиотеки: переключение");
  const r = await actions.handleAction(ctx, { id: "a1", kind: "library", lib: "unreal" }, { requireFocus: true });
  check("действие окна «library» переключает на Unreal", r.ok === true && r.lib === "unreal" && docs.activeLibrary() === "unreal", r);
  check("выбор — в globalState и в файле выбора", gs[library.LIB_KEY] === "unreal" && library.readLibFile(ctx) === "unreal");
  check("активная библиотека — корень и прогресс Unreal", docs.findDocsRoot() === ueDocs && /unreal/.test(progressFilePath(ctx)));
  const bad = await actions.handleAction(ctx, { id: "a2", kind: "library", lib: "../x" }, {});
  check("неизвестная библиотека отклоняется", bad.ok === false && docs.activeLibrary() === "unreal");
  check("переключение обратно на C++", library.toggleLibrary(ctx).ok === true && docs.activeLibrary() === "cpp");

  group("Библиотеки: без папки Unreal");
  conf.unrealPath = path.join(store, "nope");
  check("переключиться на Unreal без папки нельзя", library.switchLibrary(ctx, "unreal").ok === false && docs.activeLibrary() === "cpp");
  fs.writeFileSync(storage.libFilePath(ctx), JSON.stringify({ lib: "unreal", at: 1 }));
  check("сохранённый выбор Unreal без папки откатывается на C++", library.initLibrary(ctx) === "cpp");
  const meta = data.librariesMeta(ctx);
  check("в данных окна Unreal помечена недоступной (кнопки не будет)", meta.unreal.available === false && meta.cpp.available === true);

  try { fs.rmSync(store, { recursive: true, force: true }); } catch (e) {}
  finish("Библиотеки на стороне расширения");
})();
