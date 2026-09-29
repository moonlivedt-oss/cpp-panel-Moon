// ============================================================
//  Запросы окна к расширению — одна точка для моста (HTTP) и вкладки (postMessage).
//    run    — «Напиши и запусти» (lib/run.js);
//    action — «в редактор», «заготовка», «в заметки», копия прогресса (lib/actions.js);
//    log    — ошибка в окне → журнал «Документация C++» (Output), чтобы сбои окна были видны.
// ============================================================

const { log } = require('./log');
const { handleRun } = require('./run');
const { handleAction } = require('./actions');
const { MAX_LOG } = require('./protocol');

const LOG_PER_MIN = 30;         // окно в цикле ошибок не завалит журнал
let _logWindow = { t: 0, n: 0 }, _errors = 0;

function logFromWindow(body) {
  const now = Date.now();
  if (now - _logWindow.t > 60000) _logWindow = { t: now, n: 0 };
  if (++_logWindow.n > LOG_PER_MIN) return { ok: true, dropped: true };
  _errors++;
  const clip = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B-\u001F]/g, ' ').slice(0, MAX_LOG);
  const where = body && body.where ? ' [' + clip(body.where).slice(0, 80) + ']' : '';
  log('окно' + where + ': ' + clip(body && body.msg) + (body && body.stack ? '\n' + clip(body.stack) : ''));
  return { ok: true };
}

/** Выполнить запрос окна. Всегда резолвится объектом-ответом (ошибки — полем ok:false). */
async function dispatch(context, method, body, opts) {
  try {
    if (method === 'run') return await handleRun(body);
    if (method === 'action') return await handleAction(context, body, opts);
    if (method === 'log') return logFromWindow(body);
    return { ok: false, error: 'неизвестный метод' };
  } catch (e) {
    log('запрос окна ' + method, e);
    return { ok: false, error: String(e && e.message || e).slice(0, 200) };
  }
}

/** Сколько ошибок окна пришло за сессию (для «проверить плавающее окно»). */
function windowErrorCount() { return _errors; }

module.exports = { dispatch, windowErrorCount };
