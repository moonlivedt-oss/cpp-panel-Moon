"use strict";

// Общий прогресс «изучено» боковой панели и окна (lib/shared-progress.js), событие «progress»
// (только метка времени), новые действия окна: текст из редактора и экспорт колоды в Anki,
// кодирование file:///-адресов.

const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const { check, group, finish } = require("./helpers");

const ROOT = path.join(__dirname, "..");
const EXT = path.join(ROOT, "extension");
const store = fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-sp-"));
let active = null;
const saved = [];
const stub = {
  Uri: { file: (p) => ({ fsPath: p }), parse: (s) => ({ toString: () => s }) },
  workspace: { workspaceFolders: [], getConfiguration: () => ({ get: () => undefined, inspect: () => ({}) }), isTrusted: true },
  window: {
    get activeTextEditor() { return active; }, visibleTextEditors: [], state: { focused: true },
    showSaveDialog: () => Promise.resolve({ fsPath: path.join(store, "deck.txt") }),
    showInformationMessage: (m) => { saved.push(m); return Promise.resolve(); },
  },
  commands: {},
};
const orig = Module._resolveFilename;
Module._resolveFilename = function (r) { return r === "vscode" ? "vscode-stub-sp" : orig.apply(this, arguments); };
require.cache["vscode-stub-sp"] = { id: "vscode-stub-sp", filename: "vscode-stub-sp", loaded: true, exports: stub };
const shared = require(path.join(EXT, "lib", "shared-progress.js"));
const { progressFilePath } = require(path.join(EXT, "lib", "progress.js"));
const storage = require(path.join(EXT, "lib", "storage.js"));
const actions = require(path.join(EXT, "lib", "actions.js"));
const P = require(path.join(EXT, "lib", "protocol.js"));
Module._resolveFilename = orig;
const ctx = { globalStorageUri: { fsPath: store }, subscriptions: [] };

(async () => {
  group("Общий прогресс «изучено»");
  check("зеркала нет — отметок окна нет", shared.windowRead(ctx).length === 0);
  check("отметка из панели создаёт зеркало в формате окна", shared.setWindowRead(ctx, "ref/01-osnovy.md", true) === true);
  const doc = JSON.parse(fs.readFileSync(progressFilePath(ctx), "utf8"));
  check("формат cppdocs-progress, метки времени совпадают", doc.format === "cppdocs-progress" && doc.state.read["ref/01-osnovy.md"] === true && doc.savedAt === doc.state._savedAt, doc);
  fs.writeFileSync(progressFilePath(ctx), JSON.stringify({ format: "cppdocs-progress", version: 1, savedAt: Date.now() + 60000,
    state: { read: { "ref/02-vvod-vyvod.md": true }, cards: { c1: { ivl: 3 } }, _savedAt: Date.now() + 60000 } }));
  check("отметки окна читаются панелью", shared.windowRead(ctx).join() === "ref/02-vvod-vyvod.md");
  shared.setWindowRead(ctx, "ref/03-logika-cikly.md", true);
  const d2 = JSON.parse(fs.readFileSync(progressFilePath(ctx), "utf8"));
  check("запись из панели не трогает остальной прогресс окна (карточки)", d2.state.cards.c1.ivl === 3 && d2.state.read["ref/02-vvod-vyvod.md"]);
  check("метка растёт монотонно (импорт «на минуту вперёд» не перебивается)", d2.savedAt > doc.savedAt + 59000);
  check("путь с «..» не пишется", shared.setWindowRead(ctx, "../evil.md", true) === false);
  check("повторная та же отметка — без записи", shared.setWindowRead(ctx, "ref/03-logika-cikly.md", true) === false);
  shared.clearWindowRead(ctx);
  check("сброс снимает все отметки окна", shared.windowRead(ctx).length === 0);
  fs.writeFileSync(progressFilePath(ctx), '{"format":"cppdocs-progress","state":{"__proto__":{"x":1},"read":{"ref/x.md":true}}}');
  check("зеркало с __proto__ отвергается", shared.windowRead(ctx).length === 0);

  group("Протокол: событие progress");
  check("progress — в списке событий и файлов хранилища", P.EVENTS.indexOf("progress") !== -1 && P.EVENT_FILES["cpp-docs-progress.json"] === "progress");

  group("Действия окна");
  let r = await actions.handleAction(ctx, { id: "e1", kind: "editor-text" }, {});
  check("нет открытого .cpp — понятная ошибка", r.ok === false && /нет открытого/.test(r.error), r);
  active = { document: { languageId: "cpp", isClosed: false, getText: () => "int main() {}", fileName: "D:/game/main.cpp" } };
  r = await actions.handleAction(ctx, { id: "e2", kind: "editor-text" }, {});
  check("текст открытого .cpp и только имя файла", r.ok && r.text === "int main() {}" && r.name === "main.cpp", r);
  active = { document: { languageId: "python", isClosed: false, getText: () => "x", fileName: "a.py" } };
  r = await actions.handleAction(ctx, { id: "e3", kind: "editor-text" }, {});
  check("не C/C++ файл не отдаётся", r.ok === false);
  r = await actions.handleAction(ctx, { id: "e4", kind: "export-anki", text: "#separator:tab\nq\ta\tt\n", count: 1 }, {});
  await new Promise((res) => setTimeout(res, 50));
  check("экспорт Anki: ответ сразу, файл сохранён по выбору пользователя", r.ok && fs.readFileSync(path.join(store, "deck.txt"), "utf8").indexOf("q\ta") !== -1 && saved.length === 1, r);

  group("Адреса файлов");
  const u = storage.fileUrl(path.join(store, "a#b", "c%d.js"));
  check("file:///-адрес кодирует # и % (иначе адрес обрезался бы в окне)", /a%23b\/c%25d\.js$/.test(u) && /^file:\/\/\//.test(u), u);

  finish("Общий прогресс и действия окна");
  try { fs.rmSync(store, { recursive: true, force: true }); } catch (e) { /* не критично */ }
})();
