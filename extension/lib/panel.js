// ============================================================
//  Окно документации во вкладке VS Code (webview) — «безопасный режим».
//
//  Тот же рантайм (cpp-docs-runtime.js), что впечатывается в оболочку, но открытый в обычной
//  вкладке редактора: VS Code не правится, баннера «…corrupt» нет, работает и там, где писать
//  в установку VS Code нельзя. Каналы те же, только вместо моста — сообщения webview:
//    окно → расширение: { type: "rpc", id, method, body } — те же запросы, что POST /rpc моста,
//                       ответ { type: "rpc-result", id, result };
//                       { type: "write", name, text } — зеркало прогресса (как POST /w);
//    расширение → окно: { type: "data" | "editor" | "theme" } — те же события, что в потоке моста.
// ============================================================

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { log } = require('./log');
const { storageDir, runtimeScriptPath, editorFilePath } = require('./storage');
const { windowData, safeJsonForScript } = require('./data');
const { progressFilePath } = require('./progress');
const { onBroadcast, WRITABLE, MAX_BODY } = require('./bridge');
const { METHODS } = require('./protocol');
const { escapeScript } = require('./wb-patch');

let _panel = null;

/** Данные окна с адресами картинок, понятными webview (file:/// → https://…vscode-cdn.net). */
function panelData(context, webview) {
  const data = windowData(context);
  if (!data) return null;
  const toWeb = (fileUrl) => {
    try { return webview.asWebviewUri(vscode.Uri.parse(fileUrl)).toString(); } catch (e) { return ''; }
  };
  ['stickerImgs', 'palStickerImgs'].forEach((k) => { if (data[k] && data[k].base) data[k] = Object.assign({}, data[k], { base: toWeb(data[k].base) }); });
  if (data.extDirUrl) data.extDirUrl = toWeb(data.extDirUrl);
  // Чтение файлов во вкладке не нужно: всё приходит сообщениями. Адреса оставляем как ключи.
  delete data.stickersUrl; delete data.stickersAllUrl;
  return data;
}

function buildHtml(context, webview) {
  const data = panelData(context, webview);
  if (!data) return '<!DOCTYPE html><html lang="ru"><body><p>Папка документации не найдена.</p></body></html>';
  const nonce = crypto.randomBytes(16).toString('base64').replace(/[^A-Za-z0-9]/g, '');
  data.scriptNonce = nonce;
  let runtime = '';
  try { runtime = fs.readFileSync(runtimeScriptPath(context), 'utf8'); } catch (e) { log('окно во вкладке: рантайм', e); }
  let mirror = null;
  try { mirror = fs.readFileSync(progressFilePath(context), 'utf8'); } catch (e) { /* прогресса ещё нет */ }
  const csp = "default-src 'none'; img-src " + webview.cspSource + " data: https:; style-src " + webview.cspSource +
    " 'unsafe-inline'; font-src " + webview.cspSource + "; script-src 'nonce-" + nonce + "';";
  return '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">' +
    '<meta http-equiv="Content-Security-Policy" content="' + csp + '">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' +
    '<script nonce="' + nonce + '">window.__CPPDOCS_HOST__ = "webview";\nwindow.__CPPDOCS__ = ' + safeJsonForScript(data) + ';\n' +
    'window.__CPPDOCS_MIRROR__ = ' + safeJsonForScript(mirror) + ';</script>\n' +
    '<script nonce="' + nonce + '">\n' + escapeScript(runtime) + '\n</script></body></html>';
}

/** Запись от окна: только известные файлы, только JSON, атомарно (как мост). */
function handleWrite(context, msg) {
  if (!msg || typeof msg.name !== 'string' || typeof msg.text !== 'string') return;
  if (!WRITABLE.has(msg.name) || Buffer.byteLength(msg.text, 'utf8') > MAX_BODY) return;
  try { JSON.parse(msg.text); } catch (e) { return; }
  try {
    const file = path.join(storageDir(context), msg.name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, msg.text, 'utf8');
    fs.renameSync(tmp, file);
  } catch (e) { log('окно во вкладке: запись ' + msg.name, e); }
}

/** dispatch(method, body, opts) → Promise<ответ> — обработчик запросов окна (lib/rpc.js). */
function openWindowPanel(context, dispatch) {
  if (_panel) { _panel.reveal(); return _panel; }
  const roots = [vscode.Uri.file(context.extensionPath), vscode.Uri.file(storageDir(context))];
  const panel = vscode.window.createWebviewPanel('cppDocsWindow', 'Документация C++', vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: roots });
  try { panel.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icon.svg')); } catch (e) {}
  _panel = panel;
  const subs = [];
  subs.push(panel.webview.onDidReceiveMessage((msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'write') handleWrite(context, msg);
    else if (msg.type === 'rpc' && typeof msg.id === 'string' && METHODS.indexOf(msg.method) !== -1 && dispatch) {
      // во вкладке окно одно на этот хост — фокус не проверяем
      dispatch(msg.method, msg.body, { requireFocus: false })
        .then((result) => { if (_panel) panel.webview.postMessage({ type: 'rpc-result', id: msg.id, result: result }); });
    }
    else if (msg.type === 'ready') {
      // сразу отдать контекст редактора, если он есть
      try { panel.webview.postMessage({ type: 'editor', text: fs.readFileSync(editorFilePath(context), 'utf8') }); } catch (e) {}
    }
  }));
  // События хоста (из общего каталога хранилища) → окно во вкладке.
  subs.push(onBroadcast((event, text) => {
    if (!_panel) return;
    if (event === 'stamp') {
      const data = panelData(context, panel.webview);
      if (data) panel.webview.postMessage({ type: 'data', data: data });
    } else if (event === 'editor') {
      panel.webview.postMessage({ type: event, text: String(text) });
    }
  }));
  if (typeof vscode.window.onDidChangeActiveColorTheme === 'function') {
    subs.push(vscode.window.onDidChangeActiveColorTheme(() => { if (_panel) panel.webview.postMessage({ type: 'theme' }); }));
  }
  panel.onDidDispose(() => { _panel = null; subs.forEach((d) => { try { d.dispose(); } catch (e) {} }); });
  panel.webview.html = buildHtml(context, panel.webview);
  return panel;
}

/** Открыто ли окно во вкладке (для «Найти в справочнике»: без впечатанного окна — сюда). */
function panelOpen() { return !!_panel; }

module.exports = { openWindowPanel, panelOpen, panelData, handleWrite, buildHtml };
