// ============================================================
//  Окно как модуль Moon Core.
//
//  Если установлен Moon Core, окно встраивает он (модуль «cppdocs» объявлен в package.json):
//  одна вставка в оболочку VS Code вместо двух, один вопрос после обновления VS Code, его
//  защита запуска, проверка кода и контрольная сумма. Своя вставка CPPDOCS-WINDOW тогда
//  снимается, чтобы окно не встраивалось дважды.
//
//  Связь окна с расширением в этом режиме — через мост Moon Core:
//    • оглавление и адреса файлов — в файле данных модуля (окно читает его при старте);
//    • запросы окна (run / action / log и запись зеркала прогресса) — mc.onRequest;
//    • события (контекст редактора, метка свежести) — mc.publish.
//  Собственный мост (lib/bridge.js) продолжает работать: окно во вкладке и окно старой версии.
//  Без Moon Core всё как раньше — своя вставка в оболочку.
// ============================================================

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { log } = require('./log');
const P = require('./protocol');
const { storageDir } = require('./storage');

const MC_ID = 'moonlivedt.moon-core';
const MODULE_ID = 'cppdocs';
const MAX_TOC = 900 * 1024;        // файл данных модуля Moon Core — до 1 МБ

let mc = null, _context = null, _dispatch = null, _lastSeen = 0, _requests = 0, _subscribed = false, _reqSub = null;

function getExt() { try { return vscode.extensions && vscode.extensions.getExtension ? vscode.extensions.getExtension(MC_ID) : null; } catch (e) { return null; } }
/** Подключиться к API Moon Core. null — ядра нет или API другой версии. */
async function connect(context, dispatch) {
  _context = context; _dispatch = dispatch;
  mc = null;
  const ext = getExt();
  if (!ext) return null;
  try {
    const api = await ext.activate();
    if (api && api.apiVersion === 1 && typeof api.module === 'function') mc = api.module(MODULE_ID);
  } catch (e) { log('Moon Core: подключение', e); mc = null; }
  if (!mc) return null;
  // Переподключение (поставили/удалили любое расширение) — прежняя регистрация снимается, а не копится.
  try { if (_reqSub) _reqSub.dispose(); } catch (e) {}
  _reqSub = null;
  try { _reqSub = mc.onRequest(onRequest); context.subscriptions.push(_reqSub); } catch (e) { log('Moon Core: запросы окна', e); }
  if (!_subscribed) {
    _subscribed = true;
    // События окна (lib/bridge.js broadcast) дублируем в мост Moon Core.
    try { context.subscriptions.push(require('./bridge').onBroadcast((ev, data) => publish(ev, data))); } catch (e) {}
  }
  publishToc();
  return mc;
}

/** Модуль разрешён в Moon Core и встраивается им. */
function active() { return !!(mc && mc.active); }

/** Запрос окна через мост Moon Core. */
async function onRequest(method, body) {
  _lastSeen = Date.now(); _requests++;
  if (method === 'ping') return { ok: true };
  if (method === 'write') {
    const name = body && String(body.name || '');
    if (P.WRITABLE.indexOf(name) === -1 || typeof body.text !== 'string' || body.text.length > P.MAX_BODY) return { ok: false, error: 'bad write' };
    const file = path.join(storageDir(_context), name);
    const tmp = file + '.' + process.pid + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, body.text, 'utf8');
    fs.renameSync(tmp, file);
    return { ok: true };
  }
  if (P.METHODS.indexOf(method) === -1 || !_dispatch) return { ok: false, error: 'unknown method' };
  // Moon Core сам направляет запрос хосту окна, из которого он пришёл, — фокус не проверяем.
  return _dispatch(method, body || {}, { requireFocus: false });
}

function publish(event, data) {
  if (!mc || P.EVENTS.indexOf(event) === -1) return;
  try { mc.publish(event, String(data)); } catch (e) { log('Moon Core: событие ' + event, e); }
}

/** Оглавление окна — в файл данных модуля (окно Moon Core читает его синхронно при старте). */
function publishToc() {
  if (!mc || !_context || typeof mc.writeData !== 'function') return false;
  try {
    const { windowData } = require('./data');
    const data = windowData(_context);
    if (!data) return false;
    // Тексты материалов не кладём: окно дочитает полный файл данных само (lazy).
    data.files = data.files.map((f) => Object.assign({}, f, { md: '', sx: undefined }));
    data.lazy = true;
    let toc = JSON.parse(JSON.stringify(data));
    if (JSON.stringify(toc).length > MAX_TOC) { toc.files = []; log('Moon Core: оглавление больше лимита — окно возьмёт его из полного файла данных'); }
    Promise.resolve(mc.writeData({ v: 1, toc: toc, at: Date.now() })).catch((e) => log('Moon Core: файл данных модуля', e));
    return true;
  } catch (e) { log('Moon Core: оглавление', e); return false; }
}

function status() {
  return { installed: !!getExt(), connected: !!mc, active: active(), lastSeen: _lastSeen, requests: _requests };
}

module.exports = { connect, active, publishToc, status, MODULE_ID, MC_ID };
