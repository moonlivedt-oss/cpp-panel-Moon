// ============================================================
//  Плавающее окно БЕЗ стороннего загрузчика: расширение само патчит оболочку
//  VS Code (workbench.html) — как это делает vscode-bg. Не нужны ни be5invis,
//  ни custom-ui-style, ни внешний батник. Вставка помечается маркерами, делается
//  резервная копия, повторный вызов идемпотентен (перезаписывает свой же блок).
// ============================================================

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { log } = require('./log');
const { findDocsRoot } = require('./docs');
const { runtimeScriptPath, dataFilePath, stampFilePath, editorFilePath } = require('./storage');
const { writeDocsData, windowDataBody } = require('./data');

const WINDOW_SETUP_KEY = 'cppDocs.windowSetupOffered';      // предложили окно один раз
const WINDOW_ON_KEY = 'cppDocs.windowEnabled';              // окно было включено (для восстановления после апдейта)
const WB_START = '<!-- CPPDOCS-WINDOW-START -->';
const WB_END = '<!-- CPPDOCS-WINDOW-END -->';

// Якорь целостности рантайма. Значение хранится в extension.js (доверенная точка) и
// передаётся сюда при загрузке — см. setRuntimeAnchor там.
let runtimeAnchor = '';
function setRuntimeAnchor(sha) { runtimeAnchor = String(sha || ''); }

/** Экранировать </script, чтобы инлайн-<script> не закрылся на содержимом. */
function escapeScript(s) { return String(s).replace(/<\/script/gi, '<\\/script'); }

/** Снять CSP-мету из оболочки (используется как крайний случай в armCspWithNonce). */
function neutralizeCsp(html) {
  return html.replace(/<meta\s+[^>]*Content-Security-Policy[^>]*>/gi, '');
}

/** Впустить наши скрипты по nonce, НЕ снимая CSP целиком (раньше вырезали её — это ослабляло
 *  защиту всего VS Code). Нет CSP-меты — ничего не навязываем; есть script-src — дописываем
 *  'nonce-…' file:; нет script-src — добавляем минимальную директиву, не снимая CSP; в style-src
 *  вешаем тот же nonce для нашего <style>. Чужие инлайн-скрипты остаются заблокированы. */
function armCspWithNonce(html, nonce) {
  const re = /<meta\s+[^>]*Content-Security-Policy[^>]*>/i;
  const m = html.match(re);
  if (!m) return html;
  let meta = m[0];
  if (/script-src/i.test(meta)) {
    meta = meta.replace(/(script-src)([^;>"']*)/i, "$1$2 'nonce-" + nonce + "' file:");
  } else {
    meta = meta.replace(/(content\s*=\s*)(["'])/i, "$1$2script-src 'nonce-" + nonce + "' file:; ");
  }
  if (/style-src/i.test(meta)) meta = meta.replace(/(style-src)([^;>"']*)/i, "$1$2 'nonce-" + nonce + "'");
  return html.replace(re, meta);
}

/** Регэксп нашего блока между маркерами. */
function windowBlockRe() {
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(esc(WB_START) + '[\\s\\S]*?' + esc(WB_END));
}

/** Готовый блок для <head>: маркеры + инлайн-данные + инлайн-рантайм. На <script> вешаем nonce
 *  (проходят CSP, когда она есть; без CSP атрибут игнорируется). */
function buildWindowBlock(dataBody, runtimeJs, nonce) {
  const attr = nonce ? ' nonce="' + nonce + '"' : '';
  return WB_START + '\n<script' + attr + '>\n' + escapeScript(dataBody) + '\n</script>\n<script' + attr + '>\n' +
         escapeScript(runtimeJs) + '\n</script>\n' + WB_END + '\n';
}

/** Одноразовый nonce для CSP (криптостойкий). */
function makeNonce() { return crypto.randomBytes(16).toString('base64').replace(/[^A-Za-z0-9]/g, ''); }

/** Вставить/обновить блок в HTML оболочки (идемпотентно). Вернёт null, если нет </head>. */
function applyWindowInjection(html, block) {
  html = html.replace(windowBlockRe(), '');
  const idx = html.indexOf('</head>');
  if (idx < 0) return null;
  return html.slice(0, idx) + block + html.slice(idx);
}

/** Убрать наш блок из HTML оболочки. */
function stripWindowInjection(html) { return html.replace(windowBlockRe(), ''); }

/** Атомарная запись в workbench.html: пишем во временный файл и переименовываем.
 *  Прямой writeFileSync мог оставить оболочку недописанной (сбой/антивирус/выключение),
 *  и тогда VS Code не запустится. rename в пределах одной папки — атомарен. */
function writeWorkbenchAtomic(file, data) {
  const tmp = file + '.cppdocs-tmp';
  fs.writeFileSync(tmp, data, 'utf8');
  // Несколько окон VS Code могут патчить один workbench.html, а антивирус — держать файл
  // открытым: rename тогда даёт EBUSY/EPERM транзиентно. Пара коротких повторов это переживает.
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try { fs.renameSync(tmp, file); return; }
    catch (e) {
      lastErr = e;
      if (!(e && (e.code === 'EBUSY' || e.code === 'EPERM'))) break;
      const until = Date.now() + 40; while (Date.now() < until) { /* короткая пауза перед повтором */ }
    }
  }
  try { fs.unlinkSync(tmp); } catch (e2) {}
  throw lastErr;
}

/** Вернуть CSP-мету из бэкапа при отключении окна (не оставляем защиту снятой навсегда).
 *  Если в оригинале CSP не было — ничего не делаем; чужие вставки не трогаем. */
function restoreCspFromBackup(html, bakPath) {
  const RE = /<meta\s+[^>]*Content-Security-Policy[^>]*>/i;
  let orig;
  try { orig = fs.readFileSync(bakPath, 'utf8'); } catch (e) { return html; }
  const om = orig.match(RE);
  if (!om) return html;                       // в оригинале CSP не было — добавлять не будем
  if (RE.test(html)) return html.replace(RE, om[0]);  // вернуть ИМЕННО оригинал (снять наши nonce/file:)
  const idx = html.indexOf('</head>');        // нашу CSP сняли ранее — впечатать оригинал заново
  if (idx < 0) return html;
  return html.slice(0, idx) + om[0] + '\n' + html.slice(idx);
}

/** Найти файл(ы) workbench.html в установке VS Code (через vscode.env.appRoot).
 *  Результат кешируем на сессию: пути не меняются без перезапуска VS Code (а апдейт
 *  перезапускает хост расширений). Пустой результат НЕ кешируем — вдруг это временная
 *  ошибка доступа, дадим повторить. Обход всего дерева out/ на каждый health/inject был лишним. */
let _wbCache = null;
function findWorkbenchFiles() {
  if (_wbCache && _wbCache.length) return _wbCache;
  const out = [];
  try {
    const appRoot = vscode.env && vscode.env.appRoot;
    if (!appRoot) return out;
    const walk = (dir, depth) => {
      if (depth > 6) return;
      let items;
      try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const it of items) {
        const p = path.join(dir, it.name);
        if (it.isDirectory()) walk(p, depth + 1);
        else if (it.name === 'workbench.html') out.push(p);
      }
    };
    walk(path.join(appRoot, 'out'), 0);
  } catch (e) {}
  if (out.length) _wbCache = out;   // кешируем только удачный поиск
  return out;
}

/** Пропатчена ли оболочка нашим блоком (для health). */
function windowInjected() {
  return findWorkbenchFiles().some((f) => {
    try { return fs.readFileSync(f, 'utf8').indexOf(WB_START) !== -1; } catch (e) { return false; }
  });
}

/** Сколько «хвостов» осталось рядом с оболочкой (для health): недописанные .cppdocs-tmp. */
function countLeftovers() {
  let n = 0;
  for (const f of findWorkbenchFiles()) {
    try { if (fs.existsSync(f + '.cppdocs-tmp')) n++; } catch (e) {}
  }
  return n;
}

/** Убрать хвосты: временные файлы недописанной оболочки (после сбоя записи). Бэкапы и
 *  файлы данных НЕ трогаем — они нужны для восстановления и для загрузчика. */
function cleanupLeftovers() {
  let removed = 0;
  for (const f of findWorkbenchFiles()) {
    const tmp = f + '.cppdocs-tmp';
    try { if (fs.existsSync(tmp)) { fs.unlinkSync(tmp); removed++; } } catch (e) {}
  }
  if (removed) log('уборка: удалено временных файлов оболочки: ' + removed);
  return removed;
}

/** Ядро инъекции без UI: патчит все workbench.html. Возвращает {ok,done,denied,reason}. */
function injectWindowFiles(context) {
  const nonce = makeNonce();
  const dataBody = windowDataBody(context, nonce);
  if (!dataBody) return { ok: false, done: 0, denied: false, reason: 'no-docs' };
  try { writeDocsData(context); } catch (e) { log('запись данных окна перед инъекцией', e); }  // для автообновления
  const scriptPath = runtimeScriptPath(context);
  if (!fs.existsSync(scriptPath)) return { ok: false, done: 0, denied: false, reason: 'no-runtime' };
  const files = findWorkbenchFiles();
  if (!files.length) return { ok: false, done: 0, denied: false, reason: 'no-workbench' };
  let runtimeJs;
  try { runtimeJs = fs.readFileSync(scriptPath, 'utf8'); }
  catch (e) { return { ok: false, done: 0, denied: false, reason: 'read-runtime' }; }
  // Санити: пустой/подменённый рантайм в оболочку не впечатываем (нужен размер + свой маркер).
  if (runtimeJs.length < 5000 || runtimeJs.indexOf('__CPPDOCS_RUNTIME__') === -1) {
    return { ok: false, done: 0, denied: false, reason: 'bad-runtime' };
  }
  // Целостность: хэш рантайма должен совпасть с якорем runtimeAnchor (защита от подмены).
  // Пустой якорь (dev до генерации) — проверку пропускаем.
  if (runtimeAnchor) {
    let actual = '';
    try { actual = crypto.createHash('sha256').update(runtimeJs, 'utf8').digest('hex'); } catch (e) {}
    if (actual && actual !== runtimeAnchor) {
      log('инъекция окна отменена: SHA-256 рантайма (' + actual.slice(0, 12) + '…) не совпал с ожидаемым — возможна подмена');
      return { ok: false, done: 0, denied: false, reason: 'bad-runtime' };
    }
  }
  const block = buildWindowBlock(dataBody, runtimeJs, nonce);
  let done = 0, denied = false;
  for (const f of files) {
    // Пишем только в настоящий workbench.html оболочки, не в случайный файл.
    if (!/[\\/]workbench[\\/]workbench\.html$/i.test(f)) continue;
    try {
      const bak = f + '.cppdocs-backup';
      const raw = fs.readFileSync(f, 'utf8');
      // Бэкап держим равным оригиналу: файл ещё без нашего маркера — значит чистая оболочка.
      if (raw.indexOf(WB_START) === -1) { try { fs.copyFileSync(f, bak); } catch (e) {} }
      else if (!fs.existsSync(bak)) { try { fs.copyFileSync(f, bak); } catch (e) {} }
      const html = armCspWithNonce(raw, nonce);
      const next = applyWindowInjection(html, block);
      if (next == null) continue;
      writeWorkbenchAtomic(f, next);
      done++;
    } catch (e) {
      if (e && (e.code === 'EACCES' || e.code === 'EPERM')) denied = true;
      log('инъекция окна: не удалось записать ' + f, e);
    }
  }
  if (!done) log('инъекция окна не удалась: ' + (denied ? 'нет доступа на запись' : 'не найден </head>'));
  return { ok: done > 0, done: done, denied: denied, reason: done > 0 ? 'ok' : (denied ? 'denied' : 'no-head') };
}

/** Подключить плавающее окно: прямой патч оболочки, без стороннего загрузчика. */
async function enableWindow(context) {
  const r = injectWindowFiles(context);
  if (!r.ok) {
    const msg = {
      'no-docs': 'Папка docs не найдена — окну нечего показывать. Укажите путь в настройке cppDocs.path.',
      'no-runtime': 'cpp-docs-runtime.js не найден рядом с расширением. Переустановите расширение.',
      'read-runtime': 'Не удалось прочитать рантайм окна.',
      'bad-runtime': 'Файл рантайма окна повреждён или подменён — инъекция отменена. Переустановите расширение.',
      'no-workbench': 'Не удалось найти workbench.html в установке VS Code — прямой патч невозможен.',
      'denied': 'Нет доступа на запись к оболочке VS Code. Запустите VS Code от имени администратора и повторите.',
      'no-head': 'Не удалось впечатать окно в оболочку VS Code.',
    }[r.reason] || 'Не удалось подключить окно.';
    vscode.window.showErrorMessage(msg);
    return;
  }
  try { context.globalState.update(WINDOW_ON_KEY, true); } catch (e) {}
  const pick = await vscode.window.showInformationMessage(
    'Плавающее окно подключено. Перезапустить редактор? (Баннер «…appears to be corrupt» можно закрыть — это ожидаемо.)',
    'Перезапустить', 'Позже');
  if (pick === 'Перезапустить') {
    try { await vscode.commands.executeCommand('workbench.action.reloadWindow'); } catch (e) {}
  }
}

/** Отключить плавающее окно: снять наш патч + удалить файл данных + почистить наследие загрузчиков. */
async function disableWindow(context) {
  let done = 0, denied = false;
  for (const f of findWorkbenchFiles()) {
    try {
      const html = fs.readFileSync(f, 'utf8');
      if (html.indexOf(WB_START) === -1) continue;
      // Снимаем ТОЛЬКО свой блок (полное восстановление из бэкапа затёрло бы чужие вставки,
      // например обои custom-bg). CSP-мету, если снимали при инъекции, возвращаем.
      let next = stripWindowInjection(html);
      next = restoreCspFromBackup(next, f + '.cppdocs-backup');
      writeWorkbenchAtomic(f, next);
      done++;
    } catch (e) { if (e && (e.code === 'EACCES' || e.code === 'EPERM')) denied = true; log('отключение окна: не удалось записать ' + f, e); }
  }
  try { cleanupLeftovers(); } catch (e) {}
  try { const p = dataFilePath(context); if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
  try { const sp = stampFilePath(context); if (fs.existsSync(sp)) fs.unlinkSync(sp); } catch (e) {}
  try { const ep = editorFilePath(context); if (fs.existsSync(ep)) fs.unlinkSync(ep); } catch (e) {}
  try { context.globalState.update(WINDOW_ON_KEY, false); } catch (e) {}
  vscode.window.showInformationMessage(done
    ? 'Плавающее окно отключено. Перезапустите редактор (Developer: Reload Window).'
    : (denied ? 'Нет доступа на запись к оболочке VS Code (нужен администратор).'
              : 'Инъекция окна не найдена — оболочка уже чистая.'));
}

/** Одна команда-переключатель: окно впечатано — снять, иначе подключить. Удобная единая точка
 *  входа (без отдельной горячей клавиши) — по состоянию оболочки решаем, что делать. */
async function toggleWindow(context) {
  if (windowInjected()) return disableWindow(context);
  return enableWindow(context);
}

/** Отчёт о состоянии окна с кнопками-действиями. */
async function windowHealth(context) {
  const script = runtimeScriptPath(context);
  const root = findDocsRoot();
  const wbFiles = findWorkbenchFiles();
  const patched = windowInjected();
  // Состояние файла данных — частая причина «пустого» окна.
  let dataInfo = 'НЕ создан (пересоздастся при подключении окна)';
  try {
    const df = dataFilePath(context);
    if (fs.existsSync(df)) {
      const st = fs.statSync(df);
      const mins = Math.round((Date.now() - st.mtimeMs) / 60000);
      dataInfo = 'есть (' + Math.max(1, Math.round(st.size / 1024)) + ' КБ, обновлён ' +
        (mins < 1 ? 'только что' : mins + ' мин назад') + ')';
    }
  } catch (e) { dataInfo = 'ошибка чтения'; }
  const leftovers = countLeftovers();
  const L = [
    'Оболочка VS Code (workbench.html): ' + (patched ? 'пропатчена' : 'НЕ пропатчена'),
    'Файл workbench.html найден: ' + (wbFiles.length ? 'да (' + wbFiles.length + ')' : 'НЕТ'),
    'Файл рантайма на месте: ' + (fs.existsSync(script) ? 'да' : 'НЕТ'),
    'Файл данных окна: ' + dataInfo,
    'Папка документации: ' + (root ? root : 'НЕ найдена (см. cppDocs.path)'),
    'Временные хвосты (.cppdocs-tmp): ' + (leftovers ? leftovers + ' — уберутся при отключении/перезапуске' : 'нет'),
  ];
  const actions = patched ? ['Отключить окно', 'Переподключить'] : ['Подключить окно'];
  const pick = await vscode.window.showInformationMessage(
    'Плавающее окно — состояние:\n\n• ' + L.join('\n• '), { modal: false }, ...actions);
  if (pick === 'Подключить окно' || pick === 'Переподключить') {
    await enableWindow(context);
  } else if (pick === 'Отключить окно') {
    await disableWindow(context);
  }
}

module.exports = {
  WINDOW_ON_KEY, WINDOW_SETUP_KEY, setRuntimeAnchor,
  escapeScript, neutralizeCsp, armCspWithNonce, makeNonce, buildWindowBlock,
  applyWindowInjection, stripWindowInjection, writeWorkbenchAtomic, restoreCspFromBackup,
  findWorkbenchFiles, windowInjected, cleanupLeftovers, injectWindowFiles,
  enableWindow, disableWindow, toggleWindow, windowHealth,
};
