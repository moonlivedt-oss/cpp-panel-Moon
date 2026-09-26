// Мост доки↔редактор: слово под курсором и ошибка на строке курсора в C/C++-файле
// пишутся в файл, окно показывает по ним подсказку. Плюс «Найти в справочнике C++»
// из меню правой кнопки. Односторонний файловый канал (как метка stamp).

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { findDocsRoot, buildDocsData } = require('./docs');
const { editorFilePath } = require('./storage');

// Языки, для которых мост уместен (C/C++ и их родня). Для прочих окно подсказку не показывает.
const CPP_LANGS = { c: 1, cpp: 1, 'cuda-cpp': 1, 'objective-cpp': 1, 'objective-c': 1 };
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
/** Ошибка компилятора/IntelliSense на строке курсора → {msg, line}. Текст режем: в окне он идёт в DOM (через textContent). */
function cleanDiag(d) {
  if (!d || typeof d.msg !== 'string' || !d.msg.trim()) return null;
  return { msg: d.msg.replace(/\s+/g, ' ').trim().slice(0, 300), line: Number.isInteger(d.line) && d.line > 0 ? d.line : 0 };
}
// Последний запрос «Найти в справочнике» из контекстного меню. Хранится отдельно и дописывается
// в каждый снимок контекста ещё 15 с: правый клик двигает курсор, и следующий снимок по событию
// выделения иначе затёр бы запрос раньше, чем окно его прочтёт.
let _lookupReq = null;
let _lastSig = '';
// Окружение для индикатора в шапке окна: выключен ли мост и найден ли компилятор.
// cc: undefined — ещё ищем, null — не найден, { name } — имя (без пути: путь в окно не отдаём).
const _env = { off: false, cc: undefined };
/** Открытый C/C++-файл → {name, lang, errs, first}. Имя — только базовое, режем: пойдёт в DOM (через textContent). */
function cleanFile(f) {
  if (!f || typeof f.name !== 'string') return null;
  const name = path.basename(f.name).split('').filter((ch) => ch.charCodeAt(0) >= 32).join('').slice(0, 80);
  if (!name) return null;
  const out = { name: name, lang: String(f.lang || '').slice(0, 20), errs: Number.isInteger(f.errs) && f.errs > 0 ? Math.min(f.errs, 999) : 0 };
  const first = cleanDiag(f.first);
  if (out.errs && first) out.first = first;
  return out;
}
/** Записать/очистить контекст редактора для окна. info=null — стираем (окно спрячет подсказку).
 *  Слово валидируем как идентификатор и режем по длине: в окне оно попадёт в DOM. */
/**
 * @typedef {{ word: string, lang: string, ts: number, diag?: {msg: string, line: number},
 *   lookup?: object, file?: object, off?: boolean, cc?: ({name: string}|null) }} EditorPayload
 */
function writeEditorContext(context, info) {
  /** @type {EditorPayload|null} */
  let payload = null;
  const word = info && typeof info.word === 'string' && IDENT_RE.test(info.word) ? info.word : '';
  const diag = info ? cleanDiag(info.diag) : null;
  if (word || diag) {
    payload = { word: word, lang: String(info.lang || '').slice(0, 20), ts: Date.now() };
    if (diag) payload.diag = diag;
  }
  if (_lookupReq && Date.now() - _lookupReq.ts < 15000) {
    payload = payload || { word: '', lang: '', ts: Date.now() };
    payload.lookup = _lookupReq;
  }
  // Индикатор в шапке: какой файл открыт, есть ли в нём ошибки, есть ли компилятор.
  const file = info ? cleanFile(info.file) : null;
  payload = payload || { word: '', lang: '', ts: Date.now() };
  if (file) payload.file = file;
  if (_env.off) payload.off = true;
  if (_env.cc !== undefined) payload.cc = _env.cc;
  // Курсор двигается постоянно, а содержимое чаще всего то же — файл (и событие окну) не трогаем.
  const sig = JSON.stringify(Object.assign({}, payload, { ts: 0 }));
  if (sig === _lastSig && !payload.lookup) return true;
  _lastSig = sig;
  const body = 'window.__CPPDOCS_EDITOR__ = ' + JSON.stringify(payload) + ';\n';
  try {
    const p = editorFilePath(context);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf8');
    return true;
  } catch (e) { return false; }
}

/** «Найти в справочнике» без плавающего окна: открываем подходящий .md прямо в редакторе
 *  (ошибка → словарь ошибок; слово → файл с ним в заголовке, иначе в тексте). */
function lookupFallback(word, diag) {
  const root = findDocsRoot();
  if (!root) { vscode.window.showWarningMessage('Документация не найдена.'); return; }
  let files = [];
  try { files = buildDocsData(root).files; } catch (e) {}
  let hit = null;
  if (diag) hit = files.find((f) => /(^|\/)11-oshibki\.md$/.test(f.rel));
  if (!hit && word) {
    const w = word.toLowerCase();
    hit = files.find((f) => (f.title + ' ' + f.subtitle + ' ' + f.name).toLowerCase().indexOf(w) >= 0) ||
      (w.length >= 4 ? files.find((f) => String(f.md).toLowerCase().indexOf(w) >= 0) : null);
  }
  if (!hit) { vscode.window.showInformationMessage('В справочнике не нашлось «' + (word || 'этой ошибки') + '».'); return; }
  require('./sidebar').openDoc(path.join(root, hit.rel), false);
}

/** Подписки моста: события редактора, команда контекстного меню, настройка cppDocs.editorBridge. */
function registerEditorBridge(context) {
  // window.js и sidebar.js грузим здесь, а не наверху: они тянут за собой данные окна,
  // а этот модуль нужен actions.js уже при загрузке (CPP_LANGS).
  const { windowInjected } = require('./window');
  // Мост доки↔редактор: слово под курсором в C/C++-файле пишем в файл, окно показывает подсказку.
  // Односторонний файловый канал (как метка stamp); включается настройкой cppDocs.editorBridge.
  let bridgeTimer = null;
  // Слово под курсором и первая ошибка (severity Error) на строке курсора — от g++/cpptools/clangd.
  const editorInfo = () => {
    const ed = vscode.window.activeTextEditor;
    if (!ed || !ed.document || !CPP_LANGS[ed.document.languageId]) return null;
    const pos = ed.selection && ed.selection.active;
    let word = '', diag = null;
    if (pos && typeof ed.document.getWordRangeAtPosition === 'function') {
      const r = ed.document.getWordRangeAtPosition(pos);
      if (r) word = ed.document.getText(r);
    }
    if (pos && vscode.languages && typeof vscode.languages.getDiagnostics === 'function') {
      const errs = vscode.languages.getDiagnostics(ed.document.uri)
        .filter((d) => d.severity === 0 && d.range && d.range.start.line <= pos.line && d.range.end.line >= pos.line);
      if (errs.length) diag = { msg: String(errs[0].message || ''), line: errs[0].range.start.line + 1 };
    }
    // Для индикатора в шапке: имя файла и сколько в нём ошибок (первая — чтобы её можно было разобрать).
    let errs = 0, first = null;
    if (vscode.languages && typeof vscode.languages.getDiagnostics === 'function') {
      const all = vscode.languages.getDiagnostics(ed.document.uri).filter((d) => d.severity === 0 && d.range);
      errs = all.length;
      if (all.length) first = { msg: String(all[0].message || ''), line: all[0].range.start.line + 1 };
    }
    const file = { name: String(ed.document.fileName || ''), lang: ed.document.languageId, errs: errs, first: first };
    return { word, diag, lang: ed.document.languageId, file };
  };
  const pushEditorContext = () => {
    try {
      // Файл контекста общий для всех окон VS Code: пишет только окно в фокусе, иначе слово
      // под курсором одного окна всплывало бы в плашке другого.
      if (vscode.window.state && vscode.window.state.focused === false) return;
      _env.off = vscode.workspace.getConfiguration('cppDocs').get('editorBridge') === false;
      if (_env.off) { writeEditorContext(context, null); return; }
      writeEditorContext(context, editorInfo());
    } catch (e) { /* мост необязателен — молча */ }
  };
  const scheduleBridge = () => { clearTimeout(bridgeTimer); bridgeTimer = setTimeout(pushEditorContext, 200); };
  if (typeof vscode.window.onDidChangeTextEditorSelection === 'function') {
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(scheduleBridge));
  }
  if (vscode.languages && typeof vscode.languages.onDidChangeDiagnostics === 'function') {
    context.subscriptions.push(vscode.languages.onDidChangeDiagnostics(scheduleBridge));   // ошибка появилась без движения курсора
  }
  // Правый клик → «Найти в справочнике C++»: на строке с ошибкой — разбор ошибки, иначе — материал
  // по слову (или по выделенному идентификатору). Работает и при выключенном cppDocs.editorBridge.
  context.subscriptions.push(vscode.commands.registerCommand('cppDocs.lookupInDocs', () => {
    const info = editorInfo();
    const ed = vscode.window.activeTextEditor;
    let word = info && info.word || '';
    if (ed && ed.selection && !ed.selection.isEmpty) {
      const m = ed.document.getText(ed.selection).trim().match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (m) word = m[1];
    }
    if (!IDENT_RE.test(word)) word = '';
    const diag = info && cleanDiag(info.diag);
    if (!word && !diag) { vscode.window.showInformationMessage('Поставь курсор на слово или на строку с ошибкой.'); return; }
    if (!windowInjected() && !require('./panel').panelOpen()) { lookupFallback(word, diag); return; }
    _lookupReq = { word: word, diag: diag, ts: Date.now() };
    writeEditorContext(context, info);
  }));
  if (typeof vscode.window.onDidChangeActiveTextEditor === 'function') {
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(scheduleBridge));
  }
  if (typeof vscode.window.onDidChangeWindowState === 'function') {
    context.subscriptions.push(vscode.window.onDidChangeWindowState((st) => { if (st && st.focused) { _lastSig = ''; scheduleBridge(); } }));
  }
  if (typeof vscode.workspace.onDidChangeConfiguration === 'function') {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e || typeof e.affectsConfiguration !== 'function' || e.affectsConfiguration('cppDocs.editorBridge')) pushEditorContext();
      // Путь к компилятору поменяли — extension.js сбрасывает кеш поиска; ищем заново после него.
      if (e && typeof e.affectsConfiguration === 'function' && e.affectsConfiguration('cppDocs.compiler')) {
        _env.cc = undefined; setTimeout(checkCompiler, 0);
      }
    }));
  }
  // Компилятор ищем в фоне (where/which с таймаутом) — индикатор в шапке покажет, найден ли он.
  function checkCompiler() {
    try {
      require('./run').resolveCompilerAsync((c) => {
        _env.cc = c ? { name: path.basename(String(c.cmd)).slice(0, 40) } : null;
        pushEditorContext();
      });
    } catch (e) { /* поиск необязателен */ }
  }
  try { pushEditorContext(); } catch (e) {}   // начальное состояние при активации
  checkCompiler();
}

/** Открыть раздел справочника (rel + якорь) — из подсказки по стилю «📘 Почему так».
 *  Окно подключено — просим его (через тот же канал, что «Найти в справочнике»); нет — .md в редакторе. */
function openDocTarget(context, rel, hash) {
  if (!/^[\w\-/]+\.md$/.test(rel) || rel.split('/').indexOf('..') !== -1) return;
  const slug = String(hash || '').replace(/[^\p{L}\p{N}\-_]/gu, '').slice(0, 160);
  const { windowInjected } = require('./window');
  if (!windowInjected() && !require('./panel').panelOpen()) {
    const root = findDocsRoot();
    if (root) require('./sidebar').openDoc(path.join(root, rel), false);
    return;
  }
  _lookupReq = { rel: rel, hash: slug, ts: Date.now() };
  writeEditorContext(context, null);
}

module.exports = { CPP_LANGS, writeEditorContext, registerEditorBridge, openDocTarget };
