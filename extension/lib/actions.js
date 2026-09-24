// ============================================================
//  Действия окна → хост: «в редактор» (вставить пример кода), «заготовка» (новый .cpp с каркасом
//  задачи) и «в заметки» (цитата в личный
//  блокнот). Тот же файловый канал, что у запуска: окно пишет cpp-docs-action.json, хост
//  выполняет и кладёт ответ в cpp-docs-action-res.json. Оба действия безвредны (вставка текста,
//  дописывание в один фиксированный файл), поэтому отдельной настройки не требуют.
// ============================================================

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { log } = require('./log');
const { findDocsRoot, bundledDocs } = require('./docs');
const { storageDir, actionFilePath, actionResFilePath, NOTES_REL, notesFilePath } = require('./storage');
const { writeDocsData } = require('./data');
const { processRunReq } = require('./run');
const { CPP_LANGS } = require('./editor-bridge');

function writeActionResult(context, res) {
  try { fs.writeFileSync(actionResFilePath(context), JSON.stringify(Object.assign({ ts: Date.now() }, res)), 'utf8'); } catch (e) { log('ответ на действие окна', e); }
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
let _lastActionId = null, _actionTimer = null;
function processActionReq(context) {
  clearTimeout(_actionTimer);
  _actionTimer = setTimeout(() => {
    let req;
    try { req = JSON.parse(fs.readFileSync(actionFilePath(context), 'utf8')); } catch (e) { return; }
    if (!req || typeof req.id !== 'string' || req.id === _lastActionId) return;
    try { fs.unlinkSync(actionFilePath(context)); } catch (e) {}           // одноразовый, как запрос запуска
    if (typeof req.ts !== 'number' || Math.abs(Date.now() - req.ts) > 15000) return;   // остался с прошлой сессии
    _lastActionId = req.id;
    const fail = (e) => { log('действие окна ' + req.kind, e); writeActionResult(context, { id: req.id, ok: false, error: String(e && e.message || e).slice(0, 200) }); };
    if (req.kind === 'insert' && typeof req.code === 'string' && req.code.length <= 100000) {
      insertCodeToEditor(req.code).then((r) => writeActionResult(context, Object.assign({ id: req.id, ok: true }, r)), fail);
    } else if (req.kind === 'newfile' && typeof req.code === 'string' && req.code.length <= 100000) {
      // «Заготовка задачи»: всегда новый несохранённый C++-файл (открытый .cpp не трогаем)
      Promise.resolve(vscode.workspace.openTextDocument({ language: 'cpp', content: req.code }))
        .then((doc) => vscode.window.showTextDocument(doc))
        .then(() => writeActionResult(context, { id: req.id, ok: true, where: 'new' }), fail);
    } else if (req.kind === 'note' && typeof req.text === 'string' && req.text.trim() && req.text.length <= 2000) {
      try { appendNote(context, req); writeActionResult(context, { id: req.id, ok: true }); } catch (e) { fail(e); }
    } else {
      writeActionResult(context, { id: req.id, ok: false, error: 'неизвестное действие' });
    }
  }, 60);
}
// Один watch на каталог хранилища (всё, что окно пишет расширению): запросы запуска (только при localRun — проверяет processRunReq)
// и действия окна. Пересобирается при смене настройки.
let _runWatcher = null, _runWatcherDisposable = false;
function setupWindowChannels(context) {
  try { if (_runWatcher) { _runWatcher.close(); _runWatcher = null; } } catch (e) {}
  const dir = storageDir(context);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  try {
    _runWatcher = fs.watch(dir, (evt, fname) => {
      const f = String(fname || '');
      if (!fname || f.indexOf('cpp-docs-run-req') === 0) processRunReq(context);
      if (!fname || f === 'cpp-docs-action.json') processActionReq(context);
    });
    if (!_runWatcherDisposable) {   // одна подписка на все пересборки канала, а не по штуке на каждую
      _runWatcherDisposable = true;
      context.subscriptions.push({ dispose: () => { try { _runWatcher && _runWatcher.close(); } catch (e) {} } });
    }
  } catch (e) { log('watch каналов окна', e); }
  processRunReq(context);      // вдруг запрос уже лежит
  processActionReq(context);
}

module.exports = { formatNoteEntry, insertNoteEntry, processActionReq, setupWindowChannels };
