// ============================================================
//  Выбор библиотеки документации: C++ (основа) или Unreal Engine (дополнение).
//
//  Одна библиотека активна на все окна VS Code: globalState + файл cpp-docs-lib.json в хранилище.
//  Плавающее окно переключается само (кнопка в шапке) и сообщает об этом действием «library»;
//  из VS Code — командой cppDocs.switchLibrary. Смена файла выбора расходится событием «lib»:
//  окно в каждом окне VS Code пересобирается под новую библиотеку, боковая панель и статус-бар —
//  тоже. Данные другой библиотеки при этом окно не читает: у каждой свой файл данных.
// ============================================================

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { log } = require('./log');
const docs = require('./docs');
const { libFilePath } = require('./storage');
const { onBroadcast } = require('./bridge');

const LIB_KEY = 'cppDocs.library';
const _listeners = new Set();

/** Подписка на смену библиотеки: fn(id). */
function onLibraryChange(fn) { _listeners.add(fn); return { dispose: () => _listeners.delete(fn) }; }
function notify(id) { for (const fn of _listeners) { try { fn(id); } catch (e) { log('смена библиотеки', e); } } }

/** Выбор из файла хранилища (его мог записать хост другого окна VS Code). */
function readLibFile(context) {
  try {
    const o = JSON.parse(fs.readFileSync(libFilePath(context), 'utf8'));
    return o && docs.isLibrary(o.lib) ? o.lib : null;
  } catch (e) { return null; }
}
function writeLibFile(context, id) {
  try {
    const p = libFilePath(context);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (readLibFile(context) === id) return;          // то же самое — события не будет
    const tmp = p + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ lib: id, at: Date.now() }), 'utf8');
    fs.renameSync(tmp, p);
  } catch (e) { log('файл выбора библиотеки', e); }
}

/** Применить выбор локально (без записи): у библиотеки нет папки — остаёмся на C++. */
function adopt(id) {
  const next = docs.isLibrary(id) && docs.findDocsRoot(id) ? id : 'cpp';
  if (next === docs.activeLibrary()) return false;
  docs.setActiveLibrary(next);
  notify(next);
  return true;
}

/** Старт: выбор из файла (общий для всех окон), затем globalState. */
function initLibrary(context) {
  const saved = readLibFile(context) || context.globalState.get(LIB_KEY) || 'cpp';
  docs.setActiveLibrary(docs.isLibrary(saved) && docs.findDocsRoot(saved) ? saved : 'cpp');
  writeLibFile(context, docs.activeLibrary());
  // Выбор сменили в другом окне VS Code (или окно документации) — подхватываем.
  context.subscriptions.push(onBroadcast((event) => {
    if (event !== 'lib') return;
    const id = readLibFile(context);
    if (id && adopt(id)) { try { context.globalState.update(LIB_KEY, docs.activeLibrary()); } catch (e) {} }
  }));
  return docs.activeLibrary();
}

/** Переключить библиотеку. → { ok, lib } или { ok:false, error }. */
function switchLibrary(context, id) {
  if (!docs.isLibrary(id)) return { ok: false, error: 'нет такой библиотеки' };
  if (!docs.findDocsRoot(id)) {
    return { ok: false, error: id === 'unreal'
      ? 'папка документации Unreal не найдена — укажите её в настройке cppDocs.unrealPath'
      : 'папка документации не найдена' };
  }
  adopt(id);
  try { context.globalState.update(LIB_KEY, id); } catch (e) {}
  // Свежий файл данных — до файла выбора: окно, получив событие «lib», прочитает уже готовые данные.
  try { require('./data').writeDocsData(context, id); } catch (e) { log('данные библиотеки ' + id, e); }
  writeLibFile(context, id);
  return { ok: true, lib: id };
}

/** Команда: переключить на другую библиотеку (их две — просто «на другую»). */
function toggleLibrary(context) {
  const next = docs.activeLibrary() === 'cpp' ? 'unreal' : 'cpp';
  const r = switchLibrary(context, next);
  if (!r.ok) {
    vscode.window.showWarningMessage('Документация: ' + r.error, 'Открыть настройку')
      .then((p) => { if (p) vscode.commands.executeCommand('workbench.action.openSettings', 'cppDocs.unrealPath'); });
  }
  return r;
}

module.exports = { LIB_KEY, initLibrary, switchLibrary, toggleLibrary, onLibraryChange, readLibFile };
