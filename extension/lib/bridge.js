// ============================================================
//  Мост «окно ↔ расширение» без Node.
//
//  Окно впечатано в оболочку VS Code, а оболочка работает в песочнице: у окна нет Node, писать
//  файлы оно не может. Читать может (vscode-file:// — хранилище расширения там разрешённый
//  корень), а для записи и для событий расширение поднимает крошечный HTTP-сервер:
//    • слушает только 127.0.0.1, порт — любой свободный;
//    • адрес содержит случайный токен (48 hex) — без него запрос отклоняется;
//    • принимает только Origin оболочки (vscode-file://vscode-app) и Host 127.0.0.1:<порт>
//      (защита от сайтов в браузере и от DNS-rebinding);
//    • POST /rpc/<токен>/<метод> — запрос окна с ответом сразу (run, action, log — lib/rpc.js);
//      действие окна выполняет только хост окна в фокусе, остальные отвечают 409 — окно пробует
//      следующий хост из списка;
//    • POST /w/<токен>/<имя> — записать известный файл (зеркало прогресса) в хранилище;
//    • GET /events/<токен> — поток событий (SSE): контекст редактора и метка свежести данных.
//  Имена, методы и лимиты — в lib/protocol.js (их же видит рантайм окна).
//
//  Несколько окон VS Code = несколько хостов расширений с ОДНИМ хранилищем. Поэтому в
//  cpp-docs-bridge.json лежит список живых хостов (hosts), каждый дописывает себя и при выгрузке
//  убирает только себя. Любой хост годится: файлы общие, а события хосты берут из общего
//  каталога (watch в actions.js), так что поток любого хоста видит изменения всех окон.
// ============================================================

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { log } = require('./log');
const { storageDir } = require('./storage');

const P = require('./protocol');

const ORIGIN = 'vscode-file://vscode-app';
const WRITABLE = new Set(P.WRITABLE);
const METHODS = new Set(P.METHODS);
const MAX_BODY = P.MAX_BODY;
const REFRESH_MS = 30000;      // раз в 30 с хост проверяет, что он есть в списке (другой хост мог затереть)

let _server = null, _token = '', _port = 0, _lastSeen = 0, _writes = 0, _refresh = null;
const _clients = new Set();    // открытые потоки событий

function bridgeFilePath(context) { return path.join(storageDir(context), 'cpp-docs-bridge.json'); }

function sameToken(a) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(_token);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Жив ли процесс (запись другого хоста в списке могла остаться после аварийного выхода). */
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (pid === process.pid) return true;
  try { process.kill(pid, 0); return true; } catch (e) { return !!(e && e.code === 'EPERM'); }
}

/** Прочитать список хостов (старый формат {port, token} тоже понимаем). */
function readHosts(file) {
  let o = null;
  try { o = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return []; }
  const list = o && Array.isArray(o.hosts) ? o.hosts : [];
  return list.filter((h) => h && (h.port | 0) > 0 && /^[0-9a-f]{48}$/.test(String(h.token)) && pidAlive(h.pid));
}

function writeHosts(file, hosts) {
  if (!hosts.length) { try { fs.unlinkSync(file); } catch (e) {} return; }
  // port/token верхнего уровня — для окна старой версии: оно знает только один адрес.
  const body = JSON.stringify({ hosts: hosts, port: hosts[0].port, token: hosts[0].token, ts: Date.now() });
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, body, 'utf8');
  fs.renameSync(tmp, file);
}

/** Дописать себя в список (идемпотентно). */
function registerSelf(context) {
  if (!_port) return;
  try {
    fs.mkdirSync(storageDir(context), { recursive: true });
    const file = bridgeFilePath(context);
    const hosts = readHosts(file);
    if (hosts.some((h) => h.pid === process.pid && h.port === _port && h.token === _token)) return;
    const others = hosts.filter((h) => h.pid !== process.pid);
    writeHosts(file, [{ port: _port, token: _token, pid: process.pid, ts: Date.now() }].concat(others));
  } catch (e) { log('мост окна: адрес', e); }
}

function unregisterSelf(context) {
  try {
    const file = bridgeFilePath(context);
    writeHosts(file, readHosts(file).filter((h) => h.pid !== process.pid));
  } catch (e) {}
}

// Подписчики в самом хосте (окно во вкладке, lib/panel.js): получают те же события, что и поток.
const _listeners = new Set();
function onBroadcast(fn) { _listeners.add(fn); return { dispose: () => _listeners.delete(fn) }; }

/** Разослать событие всем открытым потокам окна. data — строка (обычно JSON). */
function broadcast(event, data) {
  for (const fn of _listeners) { try { fn(event, data); } catch (e) { log('подписчик событий окна', e); } }
  const msg = 'event: ' + event + '\ndata: ' + String(data).replace(/\r?\n/g, '\ndata: ') + '\n\n';
  for (const res of _clients) { try { res.write(msg); } catch (e) { _clients.delete(res); } }
}

function handler(context) {
  return (req, res) => {
    const origin = req.headers.origin || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGIN,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Private-Network': 'true',   // Chromium: запрос к локальному адресу
      'Vary': 'Origin',
    };
    const end = (code, body) => { res.writeHead(code, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, cors)); res.end(body || ''); };
    if (req.headers.host !== '127.0.0.1:' + _port) return end(403, 'host');
    if (origin && origin !== ORIGIN) return end(403, 'origin');
    if (req.method === 'OPTIONS') return end(204);
    const m = /^\/(w|ping|events|rpc)\/([0-9a-f]{48})(?:\/([\w.-]+))?$/.exec(req.url || '');
    if (!m || !sameToken(m[2])) return end(403, 'token');
    _lastSeen = Date.now();
    if (m[1] === 'ping') return end(200, 'ok');
    if (m[1] === 'events') {
      if (req.method !== 'GET') return end(405, 'method');
      res.writeHead(200, Object.assign({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' }, cors));
      res.write('retry: 3000\n\n');
      _clients.add(res);
      req.on('close', () => _clients.delete(res));
      return undefined;
    }
    if (req.method !== 'POST') return end(405, 'method');
    if (m[1] === 'rpc' && !METHODS.has(m[3] || '')) return end(404, 'method');
    if (m[1] === 'w' && !WRITABLE.has(m[3] || '')) return end(404, 'name');
    readBody(req, (text) => {
      if (text == null) return end(413, 'size');
      let body;
      try { body = JSON.parse(text); } catch (e) { return end(400, 'json'); }   // только JSON
      if (m[1] === 'rpc') {
        if (!_dispatch) return end(503, 'no-dispatch');
        _dispatch(m[3], body, { requireFocus: true }).then((out) => {
          // хост не в фокусе — «попробуй другой»: 409, окно переберёт хосты из списка
          const code = out && out.retry ? 409 : 200;
          res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, cors));
          res.end(JSON.stringify(out || {}));
        });
        return undefined;
      }
      try {
        const file = path.join(storageDir(context), m[3]);
        const tmp = file + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, text, 'utf8');
        fs.renameSync(tmp, file);
        _writes++;
        end(204);
      } catch (e) { log('мост окна: запись ' + m[3], e); end(500, 'io'); }
      return undefined;
    });
    return undefined;
  };
}

/** Тело запроса целиком (или null, если больше MAX_BODY). */
function readBody(req, cb) {
  let size = 0, over = false;
  const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { over = true; req.destroy(); return; } chunks.push(c); });
  req.on('end', () => cb(over ? null : Buffer.concat(chunks).toString('utf8')));
  req.on('close', () => { if (over) cb(null); });
}

/** Поднять мост и записать его адрес для окна. Повторный вызов — ничего не делает.
 *  dispatch(method, body, opts) → Promise<ответ> — обработчик запросов окна (lib/rpc.js). */
let _dispatch = null;
function startBridge(context, dispatch) {
  if (dispatch) _dispatch = dispatch;
  if (_server) return;
  _token = crypto.randomBytes(24).toString('hex');
  _server = http.createServer(handler(context));
  _server.on('error', (e) => log('мост окна', e));
  _server.unref();   // не держит процесс хоста (и тесты) живым сам по себе
  _server.listen(0, '127.0.0.1', () => {
    _port = _server.address().port;
    registerSelf(context);
  });
  // Держим себя в списке: другой хост мог записать файл одновременно с нами и затереть запись.
  _refresh = setInterval(() => registerSelf(context), REFRESH_MS);
  if (_refresh.unref) _refresh.unref();
  // Пульс потокам: без трафика прокси/антивирус может оборвать соединение.
  const beat = setInterval(() => { for (const r of _clients) { try { r.write(': ping\n\n'); } catch (e) { _clients.delete(r); } } }, 25000);
  if (beat.unref) beat.unref();
  context.subscriptions.push({
    dispose: () => {
      clearInterval(_refresh); clearInterval(beat); _refresh = null;
      for (const r of _clients) { try { r.end(); } catch (e) {} }
      _clients.clear();
      try { _server && _server.close(); } catch (e) {}
      _server = null;
      unregisterSelf(context);
      _port = 0;
    },
  });
}

/** Для «проверить плавающее окно»: жив ли мост и когда окно выходило на связь. */
function bridgeStatus() {
  return { running: !!_server && _port > 0, port: _port, lastSeen: _lastSeen, writes: _writes, streams: _clients.size };
}

module.exports = { startBridge, bridgeStatus, bridgeFilePath, broadcast, onBroadcast, readHosts, WRITABLE, MAX_BODY };
