// ============================================================
//  Резервная копия прогресса ученика.
//
//  Окно хранит прогресс (изученные темы, карточки, решённые задания, боссы, зачёты, заметки)
//  в localStorage оболочки VS Code. Его стирают сброс настроек, смена профиля или загрузчика —
//  поэтому окно ещё и зеркалит прогресс в файл cpp-docs-progress.json в хранилище расширения,
//  а здесь:
//    • раз в день кладём датированную копию в progress-backups/ (хранятся последние 14);
//    • «Экспорт прогресса» — копия зеркала в выбранный файл;
//    • «Импорт прогресса» — файл проверяется, текущий прогресс уходит в копию, зеркало заменяется,
//      окно VS Code перезагружается — и окно документации поднимает прогресс из зеркала.
// ============================================================

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { log } = require('./log');
const { storageDir } = require('./storage');

const FORMAT = 'cppdocs-progress';
const MAX_BYTES = 8 * 1024 * 1024;
const KEEP_BACKUPS = 14;
const KEEP_IMPORTS = 5;
const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];

function progressFilePath(context) { return path.join(storageDir(context), 'cpp-docs-progress.json'); }
function backupDir(context) { return path.join(storageDir(context), 'progress-backups'); }

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** Текст файла → {format, version, savedAt, state} или null. Принимаем и «голый» объект состояния. */
function parseProgress(text) {
  if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text, 'utf8') > MAX_BYTES) return null;
  let o;
  try { o = JSON.parse(text); } catch (e) { return null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const st = o.format === FORMAT ? o.state : o;
  if (!st || typeof st !== 'object' || Array.isArray(st)) return null;
  if (BAD_KEYS.some((k) => Object.prototype.hasOwnProperty.call(st, k))) return null;
  // Хоть какой-то след прогресса — иначе это чужой JSON, а не наш файл.
  const known = ['read', 'cards', 'challenge', 'stepsDone', 'boss', 'exams', 'checks', 'notes', 'days', 'solved'];
  if (!known.some((k) => st[k] && typeof st[k] === 'object')) return null;
  return { format: FORMAT, version: 1, savedAt: typeof o.savedAt === 'number' ? o.savedAt : 0, state: st };
}

/** Короткая сводка для диалогов: «изучено тем: 12, решено заданий: 30». */
function summary(st) {
  const n = (o) => (o && typeof o === 'object' ? Object.keys(o).length : 0);
  return 'изучено тем: ' + n(st.read) + ', решено заданий: ' + n(st.challenge) + ', карточек в повторении: ' + n(st.cards);
}

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

/** Раз в день — датированная копия зеркала; старше KEEP_BACKUPS — удаляем. */
function dailyBackup(context) {
  try {
    const src = progressFilePath(context);
    if (!fs.existsSync(src)) return;
    const dir = backupDir(context);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, 'progress-' + today() + '.json');
    if (!fs.existsSync(dest) && parseProgress(fs.readFileSync(src, 'utf8'))) fs.copyFileSync(src, dest);
    const all = fs.readdirSync(dir);
    const old = all.filter((f) => /^progress-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().slice(KEEP_BACKUPS)
      // копии «перед импортом» тоже не копим без конца: хватит последних KEEP_IMPORTS
      .concat(all.filter((f) => /^before-import-\d+\.json$/.test(f)).sort((a, b) => parseInt(b.slice(14), 10) - parseInt(a.slice(14), 10)).slice(KEEP_IMPORTS));
    old.forEach((f) => { try { fs.unlinkSync(path.join(dir, f)); } catch (e) {} });
  } catch (e) { log('резервная копия прогресса', e); }
}

async function exportProgress(context) {
  const src = progressFilePath(context);
  let data = null;
  try { data = parseProgress(fs.readFileSync(src, 'utf8')); } catch (e) {}
  if (!data) {
    vscode.window.showWarningMessage('Прогресс ещё не сохранён: открой окно документации (пилюля «C++») и отметь что-нибудь.');
    return false;
  }
  const home = process.env.USERPROFILE || process.env.HOME || storageDir(context);
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(home, 'cpp-docs-progress-' + today() + '.json')),
    filters: { 'Прогресс документации C++': ['json'] },
    saveLabel: 'Сохранить копию',
  });
  if (!uri) return false;
  writeAtomic(uri.fsPath, JSON.stringify(data, null, 1));
  vscode.window.showInformationMessage('Копия прогресса сохранена (' + summary(data.state) + ').');
  return true;
}

async function importProgress(context) {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    defaultUri: vscode.Uri.file(fs.existsSync(backupDir(context)) ? backupDir(context) : storageDir(context)),
    filters: { 'Прогресс документации C++': ['json'] },
    openLabel: 'Загрузить прогресс',
  });
  if (!uris || !uris[0]) return false;
  let data = null;
  try { data = parseProgress(fs.readFileSync(uris[0].fsPath, 'utf8')); } catch (e) {}
  if (!data) { vscode.window.showErrorMessage('Это не файл прогресса документации C++ (или он повреждён).'); return false; }
  const pick = await vscode.window.showWarningMessage(
    'Заменить текущий прогресс прогрессом из файла? (' + summary(data.state) + '). Текущий сначала сохранится в резервную копию.',
    { modal: true }, 'Заменить и перезагрузить');
  if (pick !== 'Заменить и перезагрузить') return false;
  const dst = progressFilePath(context);
  try {
    if (fs.existsSync(dst)) {
      fs.mkdirSync(backupDir(context), { recursive: true });
      fs.copyFileSync(dst, path.join(backupDir(context), 'before-import-' + Date.now() + '.json'));
    }
  } catch (e) { log('копия перед импортом', e); }
  // Метка времени — на минуту вперёд: даже если окно успеет что-то сохранить до перезагрузки,
  // зеркало останется новее localStorage, и окно возьмёт импорт. Дальше окно считает метку от неё.
  const now = Date.now() + 60000;
  const st = Object.assign({}, data.state, { _savedAt: now });
  writeAtomic(dst, JSON.stringify({ format: FORMAT, version: 1, savedAt: now, state: st }));
  await vscode.commands.executeCommand('workbench.action.reloadWindow');
  return true;
}

function registerProgress(context) {
  dailyBackup(context);
  context.subscriptions.push(
    vscode.commands.registerCommand('cppDocs.exportProgress', () => exportProgress(context).catch((e) => log('экспорт прогресса', e))),
    vscode.commands.registerCommand('cppDocs.importProgress', () => importProgress(context).catch((e) => log('импорт прогресса', e)))
  );
}

module.exports = { progressFilePath, backupDir, parseProgress, summary, dailyBackup, exportProgress, importProgress, registerProgress };
