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
const WINDOW_VIA_MC_KEY = 'cppDocs.windowViaMooncore';      // окно встраивал Moon Core (его удалили — своя вставка снята)
const { WB_START, escapeScript, makeNonce, armCspWithNonce, buildWindowBlock, applyWindowInjection,
  stripWindowInjection, writeWorkbenchAtomic, restoreCspFromBackup, findWorkbenchIn, unpatchFile, injectedRuntimeSha,
  SHELL_RE, stageRuntimeIn, checkRuntime, patchFileWithBlock } = require('./wb-patch');
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

/** Положить рантайм в хранилище расширения (см. wb-patch.stageRuntimeIn). */
function stageRuntime(context, runtimeJs, sha) { return stageRuntimeIn(storageDir(context), runtimeJs, sha); }
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
  // Санити + целостность: пустой/подменённый рантайм в оболочку не впечатываем (маркер, размер,
  // SHA-256 = якорь runtimeAnchor; пустой якорь — dev до генерации — хэш не сверяем).
  if (checkRuntime(runtimeJs, runtimeAnchor)) {
    log('инъекция окна отменена: рантайм повреждён или SHA-256 не совпал с ожидаемым — возможна подмена');
    return { ok: false, done: 0, denied: false, reason: 'bad-runtime' };
  }
  let staged;
  try { staged = stageRuntime(context, runtimeJs, crypto.createHash('sha256').update(runtimeJs, 'utf8').digest('hex')); }
  catch (e) { log('рантайм окна в хранилище', e); return { ok: false, done: 0, denied: false, reason: 'read-runtime' }; }
  const block = buildWindowBlock(dataBody, staged, nonce);
  let done = 0, denied = false;
  for (const f of files) {
    if (!SHELL_RE.test(f)) continue;
    try { if (patchFileWithBlock(f, block, nonce)) done++; }
    catch (e) {
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
    if (mooncoreActive()) return false;   // рантайм обновляет Moon Core
    // Блок в оболочке — уже согласие (его мог впечатать и батник установщика без ключа в globalState):
    // запоминаем окно включённым, чтобы после обновления VS Code тоже предложить вернуть его.
    if (!windowInjected() || !runtimeAnchor) return false;
    if (!context.globalState.get(WINDOW_ON_KEY)) { try { context.globalState.update(WINDOW_ON_KEY, true); } catch (e) {} }
    if (injectedSha() === runtimeAnchor) return false;
    const r = injectWindowFiles(context);
    log('окно: ссылка на рантайм обновлена под новую версию расширения — ' + (r.ok ? 'готово' : 'не удалось: ' + r.reason));
    return r.ok;
  } catch (e) { log('обновление рантайма окна', e); return false; }
}

/** Окно встраивает Moon Core (модуль cppdocs): снять свою вставку, чтобы окно не шло дважды. */
function adoptMooncore(context) {
  let done = 0;
  for (const f of findWorkbenchFiles()) {
    try { if (unpatchFile(f)) done++; } catch (e) { log('Moon Core: снятие своей вставки ' + f, e); }
  }
  try { cleanupLeftovers(); } catch (e) {}
  try { context.globalState.update(WINDOW_ON_KEY, true); context.globalState.update(WINDOW_VIA_MC_KEY, true); } catch (e) {}
  log('окно встраивает Moon Core' + (done ? ': своя вставка снята (' + done + ')' : ''));
  if (done) vscode.window.showInformationMessage('Документация C++: окно теперь встраивает Moon Core. Перезагрузите окно VS Code, чтобы применить.', 'Перезагрузить')
    .then((p) => { if (p) vscode.commands.executeCommand('workbench.action.reloadWindow'); });
  return done;
}
function mooncoreActive() { try { return require('./mooncore').active(); } catch (e) { return false; } }

const DENIED_MSG = 'Нет доступа на запись к оболочке VS Code: он установлен для всех пользователей (Program Files). ' +
  'Без прав администратора то же окно работает во вкладке. Насовсем — поставьте VS Code вариантом User Installer (в папку пользователя).';

/** Подключить плавающее окно: прямой патч оболочки, без стороннего загрузчика. */
async function enableWindow(context) {
  if (mooncoreActive()) {
    vscode.window.showInformationMessage('Документация C++: окно встраивает Moon Core. Включить или выключить его можно в «Moon Core: Модули».', 'Открыть модули')
      .then((p) => { if (p) vscode.commands.executeCommand('moonCore.modules'); });
    return;
  }
  const r = injectWindowFiles(context);
  if (!r.ok) {
    const msg = {
      'no-docs': 'Папка docs не найдена — окну нечего показывать. Укажите путь в настройке cppDocs.path.',
      'no-runtime': 'cpp-docs-runtime.js не найден рядом с расширением. Переустановите расширение.',
      'read-runtime': 'Не удалось прочитать рантайм окна.',
      'bad-runtime': 'Файл рантайма окна повреждён или подменён — инъекция отменена. Переустановите расширение.',
      'no-workbench': 'Не удалось найти workbench.html в установке VS Code — прямой патч невозможен.',
      'denied': DENIED_MSG,
      'no-head': 'Не удалось впечатать окно в оболочку VS Code.',
    }[r.reason] || 'Не удалось подключить окно.';
    // Нет прав на оболочку — не тупик: то же окно работает во вкладке, без правки VS Code.
    if (r.reason === 'denied') {
      vscode.window.showErrorMessage(msg, 'Открыть во вкладке')
        .then((p) => { if (p) vscode.commands.executeCommand('cppDocs.openWindowTab'); });
    } else vscode.window.showErrorMessage(msg);
    return;
  }
  try { context.globalState.update(WINDOW_ON_KEY, true); context.globalState.update(WINDOW_VIA_MC_KEY, false); } catch (e) {}
  const pick = await vscode.window.showInformationMessage(
    'Плавающее окно подключено. Перезапустить редактор? (Баннер «…appears to be corrupt» можно закрыть — это ожидаемо.)',
    'Перезапустить', 'Позже');
  if (pick === 'Перезапустить') {
    try { await vscode.commands.executeCommand('workbench.action.reloadWindow'); } catch (e) {}
  }
}

/** Отключить плавающее окно: снять наш патч + удалить файл данных + почистить наследие загрузчиков. */
async function disableWindow(context) {
  if (mooncoreActive()) {
    vscode.window.showInformationMessage('Документация C++: окно встраивает Moon Core — отключается там, в «Moon Core: Модули».', 'Открыть модули')
      .then((p) => { if (p) vscode.commands.executeCommand('moonCore.modules'); });
    return;
  }
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
    : (denied ? 'Нет доступа на запись к оболочке VS Code: она установлена для всех пользователей (Program Files), снять окно можно только с правами администратора.'
              : 'Инъекция окна не найдена — оболочка уже чистая.'));
}

/** Одна команда-переключатель: окно впечатано — снять, иначе подключить. Удобная единая точка
 *  входа (без отдельной горячей клавиши) — по состоянию оболочки решаем, что делать. */
async function toggleWindow(context) {
  if (mooncoreActive() || windowInjected()) return disableWindow(context);
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
  const mcs = require('./mooncore').status();
  const L = [
    'Встраивание: ' + (mcs.active ? 'Moon Core (модуль cppdocs)' + (mcs.lastSeen ? ', окно выходило на связь ' + Math.round((Date.now() - mcs.lastSeen) / 1000) + ' с назад' : '')
      : mcs.installed ? 'своя вставка (Moon Core есть, но модуль не разрешён — «Moon Core: Модули»)' : 'своя вставка'),
    'Оболочка VS Code (workbench.html): ' + (patched ? 'пропатчена' : 'НЕ пропатчена'),
    'Файл workbench.html найден: ' + (wbFiles.length ? 'да (' + wbFiles.length + ')' : 'НЕТ'),
    'Файл рантайма на месте: ' + (fs.existsSync(script) ? 'да' : 'НЕТ'),
    'Файл данных окна: ' + dataInfo,
    'Папка документации: ' + (root ? root : 'НЕ найдена (см. cppDocs.path)'),
    'Временные хвосты (.cppdocs-tmp): ' + (leftovers ? leftovers + ' — уберутся при отключении/перезапуске' : 'нет'),
    'Связь окна с расширением: ' + bridgeLine(),
    'Ошибок в окне за сессию: ' + require('./rpc').windowErrorCount() + ' (подробности — «Документация C++: показать журнал»)',
  ];
  // Окно встраивает Moon Core — своей вставки нет и не должно быть: вместо «Подключить» ведём в его модули.
  if (mcs.active) L[1] = 'Оболочка VS Code: окно встраивает Moon Core (своя вставка не нужна)';
  const actions = mcs.active ? ['Модули Moon Core'] : patched ? ['Отключить окно', 'Переподключить'] : ['Подключить окно'];
  // Переводы строк показывает только модальный диалог (detail); в тосте семь пунктов слились бы в строку.
  const pick = await vscode.window.showInformationMessage(
    'Плавающее окно — состояние', { modal: true, detail: '• ' + L.join('\n• ') }, ...actions);
  if (pick === 'Модули Moon Core') {
    try { await vscode.commands.executeCommand('moonCore.modules'); } catch (e) {}
  } else if (pick === 'Подключить окно' || pick === 'Переподключить') {
    await enableWindow(context);
  } else if (pick === 'Отключить окно') {
    await disableWindow(context);
  }
}

module.exports = {
  WINDOW_ON_KEY, WINDOW_SETUP_KEY, WINDOW_VIA_MC_KEY, setRuntimeAnchor,
  escapeScript, armCspWithNonce, makeNonce, buildWindowBlock,
  applyWindowInjection, stripWindowInjection, writeWorkbenchAtomic, restoreCspFromBackup,
  findWorkbenchFiles, windowInjected, cleanupLeftovers, injectWindowFiles, ensureRuntimeCurrent, stageRuntime, injectedSha,
  enableWindow, disableWindow, toggleWindow, windowHealth, adoptMooncore,
};
