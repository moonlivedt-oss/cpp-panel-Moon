// ============================================================
//  Действия окна → хост: «в редактор» (вставить пример кода), «заготовка» (новый .cpp с каркасом
//  задачи), «в заметки» (цитата в личный блокнот), копия/загрузка прогресса.
//
//  Окно присылает запрос мосту (POST /action) или вкладке (сообщение «rpc») и сразу получает ответ.
//  Действия безвредны (вставка текста, дописывание в один фиксированный файл, диалоги) — отдельной
//  настройки не требуют. Здесь же — слежение за общими файлами хранилища (контекст редактора,
//  метка свежести данных): их изменения рассылаются окнам событиями.
// ============================================================

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { log } = require('./log');
const { findDocsRoot, bundledDocs } = require('./docs');
const { storageDir, NOTES_REL, notesFilePath } = require('./storage');
const { writeDocsData } = require('./data');
const { CPP_LANGS } = require('./editor-bridge');
const { exportProgress, importProgress } = require('./progress');
const { broadcast } = require('./bridge');
const { EVENT_FILES } = require('./protocol');

const MAX_INSERT = 100000;

/** Окно этого хоста сейчас в фокусе? Нет API (тесты/старый VS Code) — считаем, что да. */
function windowFocused() {
  try { return !(vscode.window.state && vscode.window.state.focused === false); } catch (e) { return true; }
}

const NOTES_HEADING = '## Из справочника';
/** Цитата → Markdown-запись: «> текст» + строка-ссылка на источник. rel/заголовки чистим от разметки. */
function formatNoteEntry(n, dateStr) {
  const plain = (s, max) => String(s || '').replace(/[\r\n]+/g, ' ').replace(/[[\]()`*_<>]/g, '').trim().slice(0, max);
  const text = String(n.text || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  const rel = /^[^\s()<>]+\.md$/i.test(String(n.rel || '')) && String(n.rel).split('/').indexOf('..') === -1 ? String(n.rel) : '';
  const slug = String(n.slug || '').replace(/[^\p{L}\p{N}\-_]/gu, '').slice(0, 120);
  const label = [plain(n.title, 80), plain(n.section, 80)].filter(Boolean).join(' → ') || 'источник';
  const src = rel ? '[' + label + '](../' + rel + (slug ? '#' + slug : '') + ')' : label;
  return '> ' + text + '\n>\n> — ' + src + ' · ' + dateStr + '\n';
}
/** Вставить запись в конец раздела «## Из справочника» (раздел создаётся в конце файла, если его нет). */
function insertNoteEntry(md, entry) {
  let s = String(md || '# Мои заметки\n').replace(/\r\n/g, '\n');
  let h = s.indexOf('\n' + NOTES_HEADING + '\n');
  if (h === -1) { s = s.replace(/\n*$/, '\n\n') + NOTES_HEADING + '\n\n'; h = s.lastIndexOf('\n' + NOTES_HEADING + '\n'); }
  const from = h + NOTES_HEADING.length + 2;
  const m = /\n(## |---)/.exec(s.slice(from));
  const at = m ? from + m.index + 1 : s.length;
  const before = s.slice(0, at).replace(/\n*$/, '\n\n');
  const after = s.slice(at);
  return before + entry + (after ? '\n' + after : '');
}
function appendNote(context, n) {
  const root = findDocsRoot();
  const file = notesFilePath(context, root);
  let md = '';
  try { md = fs.readFileSync(file, 'utf8'); } catch (e) {
    // Нового блокнота нет — начинаем со стартового шаблона вшитых доков (если он есть).
    try { if (bundledDocs()) md = fs.readFileSync(path.join(bundledDocs(), NOTES_REL), 'utf8'); } catch (e2) {}
  }
  const d = new Date();
  const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, insertNoteEntry(md, formatNoteEntry(n, dateStr)), 'utf8');
  try { writeDocsData(context); } catch (e) {}   // окно перечитает данные и покажет запись
  return file;
}
/** Вставить код в открытый C/C++-редактор (на место курсора/выделения) или в новый файл. */
async function insertCodeToEditor(code) {
  const isCpp = (ed) => ed && ed.document && CPP_LANGS[ed.document.languageId] && !ed.document.isClosed;
  let ed = vscode.window.activeTextEditor;
  if (!isCpp(ed)) ed = (vscode.window.visibleTextEditors || []).find(isCpp);
  if (!ed) {
    const doc = await vscode.workspace.openTextDocument({ language: 'cpp', content: code });
    await vscode.window.showTextDocument(doc);
    return { where: 'new' };
  }
  const shown = await vscode.window.showTextDocument(ed.document, ed.viewColumn);
  const sel = shown.selection;
  const text = sel.active.character === 0 && !/\n$/.test(code) ? code + '\n' : code;
  await shown.edit((eb) => eb.replace(sel, text));
  return { where: 'editor', name: path.basename(ed.document.fileName || '') };
}

/** Текст открытого C/C++-файла — для «Сравнить с эталоном». Только C/C++ и не больше MAX_INSERT:
 *  окно показывает его построчно рядом с эталоном главы. */
function editorText() {
  const isCpp = (ed) => ed && ed.document && CPP_LANGS[ed.document.languageId] && !ed.document.isClosed;
  let ed = vscode.window.activeTextEditor;
  if (!isCpp(ed)) ed = (vscode.window.visibleTextEditors || []).find(isCpp);
  if (!ed) return { ok: false, error: 'нет открытого .cpp — открой файл своей игры в редакторе' };
  const text = ed.document.getText();
  if (text.length > MAX_INSERT) return { ok: false, error: 'файл слишком большой для сравнения' };
  return { ok: true, text: text, name: path.basename(ed.document.fileName || '') };
}

/** Колода карточек → файл для импорта в Anki (текст с табуляцией: вопрос, ответ, метки). */
const MAX_EXPORT = 4 * 1024 * 1024;
async function exportAnki(text, count) {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const uri = await vscode.window.showSaveDialog({
    defaultUri: home ? vscode.Uri.file(path.join(home, 'cpp-docs-cards.txt')) : undefined,
    filters: { 'Карточки для Anki (текст с табуляцией)': ['txt'] },
    saveLabel: 'Сохранить колоду',
  });
  if (!uri) return false;
  fs.writeFileSync(uri.fsPath, text, 'utf8');
  vscode.window.showInformationMessage('Колода сохранена: ' + count + ' карточек. В Anki: Файл → Импорт, разделитель — табуляция, поля: Лицевая, Оборотная, Метки.');
  return true;
}

/**
 * Выполнить действие окна. Возвращает Promise с ответом { id, ok, … }.
 * opts.requireFocus — мост: при нескольких окнах VS Code действие выполняет хост окна в фокусе
 * (кнопку нажали именно там); остальные отвечают { retry: true }, и окно пробует следующий хост.
 */
async function handleAction(context, req, opts) {
  const id = req && typeof req.id === 'string' ? req.id : '';
  if (!req || !id || typeof req.kind !== 'string') return { id, ok: false, error: 'неверный запрос' };
  if (opts && opts.requireFocus && !windowFocused()) return { id, ok: false, retry: true };
  try {
    if (req.kind === 'insert' && typeof req.code === 'string' && req.code.length <= MAX_INSERT) {
      return Object.assign({ id, ok: true }, await insertCodeToEditor(req.code));
    }
    if (req.kind === 'newfile' && typeof req.code === 'string' && req.code.length <= MAX_INSERT) {
      // «Заготовка задачи»: всегда новый несохранённый C++-файл (открытый .cpp не трогаем)
      const doc = await vscode.workspace.openTextDocument({ language: 'cpp', content: req.code });
      await vscode.window.showTextDocument(doc);
      return { id, ok: true, where: 'new' };
    }
    if (req.kind === 'export-progress' || req.kind === 'import-progress') {
      // Диалог выбора файла ждёт человека дольше, чем окно ждёт ответа, — отвечаем сразу.
      (req.kind === 'export-progress' ? exportProgress : importProgress)(context).catch((e) => log('прогресс: ' + req.kind, e));
      return { id, ok: true };
    }
    if (req.kind === 'note' && typeof req.text === 'string' && req.text.trim() && req.text.length <= 2000) {
      appendNote(context, req);
      return { id, ok: true };
    }
    if (req.kind === 'editor-text') return Object.assign({ id }, editorText());
    if (req.kind === 'export-anki' && typeof req.text === 'string' && req.text.length <= MAX_EXPORT) {
      // Диалог ждёт человека дольше, чем окно ждёт ответа, — отвечаем сразу, итог покажет VS Code.
      exportAnki(req.text, Number(req.count) || 0).catch((e) => log('экспорт карточек', e));
      return { id, ok: true };
    }
    return { id, ok: false, error: 'неизвестное действие' };
  } catch (e) {
    log('действие окна ' + req.kind, e);
    return { id, ok: false, error: String(e && e.message || e).slice(0, 200) };
  }
}

// Один watch на каталог хранилища: изменения общих файлов (контекст редактора, метка свежести
// данных) рассылаются окнам событиями. Каталог общий для всех окон VS Code — поэтому поток любого
// хоста видит изменения всех.
let _watcher = null;
function watchWindowEvents(context) {
  if (_watcher) return;
  const dir = storageDir(context);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  try {
    _watcher = fs.watch(dir, (evt, fname) => { const f = String(fname || ''); if (EVENT_FILES[f]) pushEvent(context, f); });
    context.subscriptions.push({ dispose: () => { try { _watcher && _watcher.close(); } catch (e) {} _watcher = null; } });
  } catch (e) { log('слежение за хранилищем окна', e); }
}
const _evtTimers = {};
function pushEvent(context, name) {
  clearTimeout(_evtTimers[name]);
  _evtTimers[name] = setTimeout(() => {
    let text;
    try { text = fs.readFileSync(path.join(storageDir(context), name), 'utf8'); } catch (e) { return; }
    // Зеркало прогресса бывает в мегабайты — окнам шлём только метку времени: окно, у которого
    // прогресс старше, само перечитает файл (своё же сохранение по метке узнаётся и не трогается).
    if (EVENT_FILES[name] === 'progress') {
      let at = 0;
      try { const o = JSON.parse(text); at = o && typeof o.savedAt === 'number' ? o.savedAt : 0; } catch (e) { return; }
      text = JSON.stringify({ savedAt: at });
    }
    broadcast(EVENT_FILES[name], text);
  }, 30);
}

module.exports = { formatNoteEntry, insertNoteEntry, handleAction, watchWindowEvents, editorText };
