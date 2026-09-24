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
/** Записать/очистить контекст редактора для окна. info=null — стираем (окно спрячет подсказку).
 *  Слово валидируем как идентификатор и режем по длине: в окне оно попадёт в DOM. */
function writeEditorContext(context, info) {
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
    return { word, diag, lang: ed.document.languageId };
  };
  const pushEditorContext = () => {
    try {
      if (vscode.workspace.getConfiguration('cppDocs').get('editorBridge') === false) { writeEditorContext(context, null); return; }
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
    if (!windowInjected()) { lookupFallback(word, diag); return; }
    _lookupReq = { word: word, diag: diag, ts: Date.now() };
    writeEditorContext(context, info);
  }));
  if (typeof vscode.window.onDidChangeActiveTextEditor === 'function') {
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(scheduleBridge));
  }
  if (typeof vscode.workspace.onDidChangeConfiguration === 'function') {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e || typeof e.affectsConfiguration !== 'function' || e.affectsConfiguration('cppDocs.editorBridge')) pushEditorContext();
    }));
  }
  try { pushEditorContext(); } catch (e) {}   // начальное состояние при активации
}

module.exports = { CPP_LANGS, writeEditorContext, registerEditorBridge };
