// Файлы расширения в globalStorage (данные окна, метка, файловые каналы окно↔расширение),
// их file:///-адреса для окна и настройки, влияющие на то, что исполняется на машине.

const vscode = require('vscode');
const path = require('path');
const { bundledDocs } = require('./docs');

/** file:///-URL: прямые слэши, на Windows — третий слэш перед буквой диска. */
function fileUrl(p) {
  const abs = path.resolve(p).replace(/\\/g, '/');
  return 'file:///' + abs.replace(/^\/+/, '');
}

/** Папка globalStorage расширения (гарантированно доступна на запись). */
function storageDir(context) {
  return (context.globalStorageUri && context.globalStorageUri.fsPath) || context.globalStoragePath;
}
/** Путь к рантайму окна: внутри установленного расширения. */
function runtimeScriptPath(context) { return path.join(context.extensionPath, 'cpp-docs-runtime.js'); }
/** Данные окна (window.__CPPDOCS__ = {…}). */
function dataFilePath(context) { return path.join(storageDir(context), 'cpp-docs-data.js'); }
/** Крошечная метка времени сборки: окно опрашивает её (дёшево), а полный файл данных
 *  перечитывает, только когда метка сменилась. */
function stampFilePath(context) { return path.join(storageDir(context), 'cpp-docs-stamp.js'); }
/** Что под курсором в редакторе (мост доки↔редактор). */
function editorFilePath(context) { return path.join(storageDir(context), 'cpp-docs-editor.js'); }
/** «Напиши и запусти»: запрос окна и ответ расширения. */
function runReqFilePath(context) { return path.join(storageDir(context), 'cpp-docs-run-req.json'); }
function runResFilePath(context) { return path.join(storageDir(context), 'cpp-docs-run-res.json'); }
/** Действия окна («в редактор», «в заметки»): запрос и ответ. */
function actionFilePath(context) { return path.join(storageDir(context), 'cpp-docs-action.json'); }
function actionResFilePath(context) { return path.join(storageDir(context), 'cpp-docs-action-res.json'); }

const NOTES_REL = 'zametki/01-moi-zametki.md';
/** Где лежит блокнот. Во вшитых доках (каталог расширения стирается при обновлении) — в globalStorage. */
function notesFilePath(context, root) {
  if (root && root !== bundledDocs()) return path.join(root, NOTES_REL);
  const dir = (context.globalStorageUri && context.globalStorageUri.fsPath) || context.globalStoragePath;
  return path.join(dir, 'cpp-docs-my-notes.md');
}

// localRun и compiler решают, ЧТО исполнится на машине, поэтому берём их только из пользовательских
// настроек: значение из .vscode/settings.json чужой папки игнорируем (иначе репозиторий подсунул бы
// свой «компилятор»). inspect нет (старый VS Code / тест) — обычный get.
function userSetting(key) {
  const conf = vscode.workspace.getConfiguration('cppDocs');
  if (typeof conf.inspect !== 'function') return conf.get(key);
  const i = conf.inspect(key) || {};
  return i.globalValue !== undefined ? i.globalValue : i.defaultValue;
}
function localRunEnabled() {
  try { return userSetting('localRun') === true; } catch (e) { return false; }
}

module.exports = {
  fileUrl, storageDir, runtimeScriptPath, dataFilePath, stampFilePath, editorFilePath,
  runReqFilePath, runResFilePath, actionFilePath, actionResFilePath,
  NOTES_REL, notesFilePath, userSetting, localRunEnabled,
};
