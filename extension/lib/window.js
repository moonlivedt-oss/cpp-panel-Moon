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
const { WB_START, escapeScript, makeNonce, armCspWithNonce, buildWindowBlock, applyWindowInjection,
  stripWindowInjection, writeWorkbenchAtomic, restoreCspFromBackup, findWorkbenchIn, unpatchFile, injectedRuntimeSha } = require('./wb-patch');
const { storageDir } = require('./storage');

// Якорь целостности рантайма. Значение хранится в extension.js (доверенная точка) и
// передаётся сюда при загрузке — см. setRuntimeAnchor там.
let runtimeAnchor = '';
function setRuntimeAnchor(sha) { runtimeAnchor = String(sha || ''); }

/** Найти файл(ы) workbench.html в установке VS Code (через vscode.env.appRoot).
 *  Результат кешируем на сессию: пути не меняются без перезапуска VS Code (а апдейт
 *  перезапускает хост расширений). Пустой результат НЕ кешируем — вдруг это временная
 *  ошибка доступа, дадим повторить. Обход всего дерева out/ на каждый health/inject был лишним. */
let _wbCache = null;
function findWorkbenchFiles() {
  if (_wbCache && _wbCache.length) return _wbCache;
  let out = [];
  try {
    const appRoot = vscode.env && vscode.env.appRoot;
    if (appRoot) out = findWorkbenchIn(path.join(appRoot, 'out'), 6);
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

/** vscode-file://-адрес файла на диске — так оболочка VS Code отдаёт свои и пользовательские файлы. */
function appFileUrl(p) {
  const abs = path.resolve(p).replace(/\\/g, '/').replace(/^\/+/, '');
  return 'vscode-file://vscode-app/' + abs.split('/').map((seg) => encodeURIComponent(seg).replace(/%3A/gi, ':')).join('/');
}
const RUNTIME_FILE_RE = /^cpp-docs-runtime-([0-9a-f]{12})\.js$/;
/** Положить рантайм в хранилище под именем с хэшем (cpp-docs-runtime-<sha12>.js). Имя меняется
 *  с каждой версией: оболочка, ещё ссылающаяся на старый файл, работает до перезапуска, а
 *  новый блок ссылается на новый. Держим два последних файла. → { path, src, integrity, sha }. */
function stageRuntime(context, runtimeJs, sha) {
  const dir = storageDir(context);
  fs.mkdirSync(dir, { recursive: true });
  const name = 'cpp-docs-runtime-' + sha.slice(0, 12) + '.js';
  const file = path.join(dir, name);
  let same = false;
  try { same = fs.readFileSync(file, 'utf8') === runtimeJs; } catch (e) {}
  if (!same) { const tmp = file + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, runtimeJs, 'utf8'); fs.renameSync(tmp, file); }
  try {
    fs.readdirSync(dir).filter((n) => RUNTIME_FILE_RE.test(n) && n !== name)
      .map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs })).sort((a, b) => b.t - a.t)
      .slice(1).forEach((x) => { try { fs.unlinkSync(path.join(dir, x.n)); } catch (e) {} });
  } catch (e) {}
  const integrity = 'sha256-' + crypto.createHash('sha256').update(runtimeJs, 'utf8').digest('base64');
  return { path: file, src: appFileUrl(file), integrity, sha };
}
/** SHA рантайма, на который сейчас ссылается оболочка ('' — окна нет или старый инлайн-вариант). */
function injectedSha() {
  for (const f of findWorkbenchFiles()) {
    try { const s = injectedRuntimeSha(fs.readFileSync(f, 'utf8')); if (s) return s; } catch (e) {}
  }
  return '';
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
  let staged;
  try { staged = stageRuntime(context, runtimeJs, crypto.createHash('sha256').update(runtimeJs, 'utf8').digest('hex')); }
  catch (e) { log('рантайм окна в хранилище', e); return { ok: false, done: 0, denied: false, reason: 'read-runtime' }; }
  const block = buildWindowBlock(dataBody, staged, nonce);
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
      // Переподключение: сперва вернуть CSP из бэкапа (armCspWithNonce ещё и сам чистит старые nonce).
      const base = raw.indexOf(WB_START) === -1 ? raw : restoreCspFromBackup(raw, bak);
      const html = armCspWithNonce(base, nonce);
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

/** После обновления расширения оболочка ссылается на рантайм прошлой версии (или на старый
 *  инлайн-вариант). Окно было включено — тихо обновляем ссылку: новый рантайм заработает со
 *  следующего запуска VS Code, текущий сеанс доживает на старом файле. */
function ensureRuntimeCurrent(context) {
  try {
    if (!context.globalState.get(WINDOW_ON_KEY) || !windowInjected() || !runtimeAnchor) return false;
    if (injectedSha() === runtimeAnchor) return false;
    const r = injectWindowFiles(context);
    log('окно: ссылка на рантайм обновлена под новую версию расширения — ' + (r.ok ? 'готово' : 'не удалось: ' + r.reason));
    return r.ok;
  } catch (e) { log('обновление рантайма окна', e); return false; }
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
      // Снимаем ТОЛЬКО свой блок (полное восстановление из бэкапа затёрло бы чужие вставки,
      // например обои custom-bg). CSP-мету возвращаем из бэкапа.
      if (unpatchFile(f)) done++;
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

/** Мост окно → расширение (lib/bridge.js): без него «Запустить», «в редактор», копия прогресса молчат. */
function bridgeLine() {
  const b = require('./bridge').bridgeStatus();
  if (!b.running) return 'мост не запущен';
  if (!b.lastSeen) return 'мост ждёт на порту ' + b.port + ', окно ещё не выходило на связь (открой окно и подожди пару секунд)';
  const s = Math.round((Date.now() - b.lastSeen) / 1000);
  return 'есть — окно выходило на связь ' + (s < 5 ? 'только что' : s + ' с назад') + ', записей: ' + b.writes +
    ', поток событий: ' + (b.streams ? 'подключён' : 'нет (окно опрашивает файлы)');
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
    'Связь окна с расширением: ' + bridgeLine(),
    'Ошибок в окне за сессию: ' + require('./rpc').windowErrorCount() + ' (подробности — «Документация C++: показать журнал»)',
  ];
  const actions = patched ? ['Отключить окно', 'Переподключить'] : ['Подключить окно'];
  // Переводы строк показывает только модальный диалог (detail); в тосте семь пунктов слились бы в строку.
  const pick = await vscode.window.showInformationMessage(
    'Плавающее окно — состояние', { modal: true, detail: '• ' + L.join('\n• ') }, ...actions);
  if (pick === 'Подключить окно' || pick === 'Переподключить') {
    await enableWindow(context);
  } else if (pick === 'Отключить окно') {
    await disableWindow(context);
  }
}

module.exports = {
  WINDOW_ON_KEY, WINDOW_SETUP_KEY, setRuntimeAnchor,
  escapeScript, armCspWithNonce, makeNonce, buildWindowBlock,
  applyWindowInjection, stripWindowInjection, writeWorkbenchAtomic, restoreCspFromBackup,
  findWorkbenchFiles, windowInjected, cleanupLeftovers, injectWindowFiles, ensureRuntimeCurrent, stageRuntime, appFileUrl, injectedSha,
  enableWindow, disableWindow, toggleWindow, windowHealth,
};
