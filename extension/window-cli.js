// ============================================================
//  Плавающее окно из командной строки — для батников установщика.
//
//  Запуск (VS Code как голый Node, так же работает хук удаления uninstall.js):
//    set ELECTRON_RUN_AS_NODE=1
//    "…\Code.exe" "…\window-cli.js" inject | remove | status | writable
//
//  Логика та же, что у команды «подключить плавающее окно» (lib/wb-patch.js), без API VS Code:
//  оболочку ищем от process.execPath, данные окна берём из файла, который расширение пишет в
//  globalStorage при запуске (cpp-docs-data.js), в оболочку идёт только оглавление + ссылка на
//  рантайм с проверкой SRI. Копии этой логики в батниках больше нет.
//
//  Коды выхода: 0 — готово; 1 — ошибка; 2 — нет файла данных (VS Code ещё не запускали с
//  расширением); 3 — нет прав на запись в оболочку; 4 — окно встраивает Moon Core.
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const W = require('./lib/wb-patch');

const EXIT = { OK: 0, FAIL: 1, NO_DATA: 2, DENIED: 3, MOONCORE: 4 };
const IDS = ['moonlivedt.cpp-docs-panel', 'local.cpp-docs-panel'];
const DATA_PREFIX = 'window.__CPPDOCS__ = ';
const MC_START = '<!-- MOONCORE-START -->';

/** Папки resources/app/out рядом с исполняемым файлом VS Code (в новых сборках — в подпапке с хэшем). */
function outDirs(execPath) {
  const exeDir = path.dirname(execPath);
  const bases = [exeDir, path.join(exeDir, '..')];
  try { fs.readdirSync(exeDir, { withFileTypes: true }).forEach((d) => { if (d.isDirectory()) bases.push(path.join(exeDir, d.name)); }); } catch (e) {}
  const out = [];
  bases.forEach((b) => ['resources', 'Resources'].forEach((r) => {
    // Настоящий путь: на Windows «resources» и «Resources» — одна папка, иначе оболочка шла бы дважды.
    let o = path.join(b, r, 'app', 'out');
    try { o = fs.realpathSync.native(o); } catch (e) { return; }
    if (out.indexOf(o) === -1) out.push(o);
  }));
  return out;
}

/** product.json установки (имя папки данных: Code / Code - Insiders / VSCodium). */
function readProduct(outs) {
  for (const o of outs) {
    try { return JSON.parse(fs.readFileSync(path.join(o, '..', 'product.json'), 'utf8')); } catch (e) {}
  }
  return {};
}

/** Папка пользовательских данных редактора: портативный режим (data рядом с exe), VSCODE_APPDATA
 *  или %APPDATA%\<nameShort>. */
function userDataDir(execPath, product, env) {
  const portable = env.VSCODE_PORTABLE || path.join(path.dirname(execPath), 'data');
  if (fs.existsSync(portable)) return path.join(portable, 'user-data');
  const base = env.VSCODE_APPDATA || env.APPDATA || path.join(env.HOME || env.USERPROFILE || '', '.config');
  return path.join(base, product.nameShort || 'Code');
}

/** Папка globalStorage расширения и файл данных в ней (первая, где файл данных уже есть). */
function findStorage(userData) {
  const gs = path.join(userData, 'User', 'globalStorage');
  for (const id of IDS) {
    const dir = path.join(gs, id);
    if (fs.existsSync(path.join(dir, 'cpp-docs-data.js'))) return dir;
  }
  return path.join(gs, IDS[0]);
}

/** Разобрать файл данных (window.__CPPDOCS__ = {…};) → объект или null. */
function readData(file) {
  let t;
  try { t = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
  if (t.indexOf(DATA_PREFIX) !== 0) return null;
  try {
    const d = JSON.parse(t.slice(DATA_PREFIX.length).replace(/;\s*$/, ''));
    return d && typeof d === 'object' && Array.isArray(d.files) ? d : null;
  } catch (e) { return null; }
}

/** Якорь целостности рантайма из extension.js рядом (его ставит scripts/hash-runtime.js). */
function readAnchor(dir) {
  try {
    const m = fs.readFileSync(path.join(dir, 'extension.js'), 'utf8').match(/const RUNTIME_SHA256 = '([0-9a-f]{64})'/);
    return m ? m[1] : '';
  } catch (e) { return ''; }
}

function isDenied(e) { return !!(e && (e.code === 'EACCES' || e.code === 'EPERM')); }

/** Всё, что нужно командам: файлы оболочки, редактор, хранилище. */
function context(opts) {
  const execPath = opts.execPath || process.execPath;
  const env = opts.env || process.env;
  const outs = outDirs(execPath);
  const product = readProduct(outs);
  const shells = [];
  outs.forEach((o) => W.findWorkbenchIn(o, 6).forEach((f) => { if (W.SHELL_RE.test(f) && shells.indexOf(f) === -1) shells.push(f); }));
  const storage = opts.storage || findStorage(userDataDir(execPath, product, env));
  return { execPath, product, shells, storage, extDir: opts.extDir || __dirname };
}

function inject(c, say) {
  if (!c.shells.length) { say('[ПРОВАЛ] Не найден workbench.html рядом с ' + c.execPath); return EXIT.FAIL; }
  const html = c.shells.map((f) => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } });
  if (html.some((t) => t.indexOf(MC_START) !== -1)) {
    say('[!] Окно встраивает Moon Core — включается там: F1 -> «Moon Core: Модули» -> cppdocs.');
    return EXIT.MOONCORE;
  }
  if (!c.shells.some(W.canWrite)) {
    say('[ПРОВАЛ] Нет прав на запись в оболочку VS Code (' + path.dirname(c.shells[0]) + ').');
    return EXIT.DENIED;
  }
  const data = readData(path.join(c.storage, 'cpp-docs-data.js'));
  if (!data) {
    say('[ПРОВАЛ] Данных окна ещё нет: откройте VS Code один раз (расширение их создаст) и повторите.');
    return EXIT.NO_DATA;
  }
  let runtimeJs;
  try { runtimeJs = fs.readFileSync(path.join(c.extDir, 'cpp-docs-runtime.js'), 'utf8'); } catch (e) { runtimeJs = ''; }
  if (W.checkRuntime(runtimeJs, readAnchor(c.extDir))) {
    say('[ПРОВАЛ] Файл рантайма окна повреждён или изменён — переустановите расширение.');
    return EXIT.FAIL;
  }
  const nonce = W.makeNonce();
  const staged = W.stageRuntimeIn(c.storage, runtimeJs, crypto.createHash('sha256').update(runtimeJs, 'utf8').digest('hex'));
  const block = W.buildWindowBlock(W.lazyWindowBody(data, nonce), staged, nonce);
  let done = 0, denied = false;
  c.shells.forEach((f) => {
    try { if (W.patchFileWithBlock(f, block, nonce)) done++; }
    catch (e) { if (isDenied(e)) denied = true; else say('[!] ' + f + ': ' + (e && e.message)); }
  });
  if (!done) { say(denied ? '[ПРОВАЛ] Нет прав на запись в оболочку VS Code.' : '[ПРОВАЛ] Не удалось впечатать окно (нет </head>).'); return denied ? EXIT.DENIED : EXIT.FAIL; }
  say('[OK] Окно подключено (файлов оболочки: ' + done + ').');
  return EXIT.OK;
}

function remove(c, say) {
  let done = 0, denied = false;
  c.shells.forEach((f) => {
    try { if (W.unpatchFile(f)) done++; }
    catch (e) { if (isDenied(e)) denied = true; else say('[!] ' + f + ': ' + (e && e.message)); }
    try { fs.unlinkSync(f + '.cppdocs-tmp'); } catch (e) {}
  });
  if (denied && !done) { say('[ПРОВАЛ] Нет прав на запись в оболочку VS Code.'); return EXIT.DENIED; }
  say(done ? '[OK] Окно убрано (файлов оболочки: ' + done + ').' : '[OK] Окна в оболочке нет — убирать нечего.');
  return EXIT.OK;
}

function status(c, say) {
  const anchor = readAnchor(c.extDir);
  say('Редактор: ' + (c.product.nameLong || '?') + ' ' + (c.product.version || '') + ' (' + c.execPath + ')');
  say('Расширение: ' + c.extDir);
  say('Хранилище: ' + c.storage + (fs.existsSync(path.join(c.storage, 'cpp-docs-data.js')) ? ' (данные есть)' : ' (данных НЕТ — откройте VS Code)'));
  if (!c.shells.length) say('Оболочка: workbench.html НЕ найден');
  c.shells.forEach((f) => {
    let t = '';
    try { t = fs.readFileSync(f, 'utf8'); } catch (e) {}
    const sha = W.injectedRuntimeSha(t);
    say('Оболочка: ' + f);
    say('  наше окно: ' + (t.indexOf(W.WB_START) !== -1 ? 'есть' + (sha ? (sha === anchor ? ', рантайм текущий' : ', рантайм от другой версии') : ', старый инлайн-вариант') : 'нет') +
        ' | Moon Core: ' + (t.indexOf(MC_START) !== -1 ? 'есть' : 'нет') + ' | запись: ' + (W.canWrite(f) ? 'можно' : 'НЕЛЬЗЯ (нужен администратор)'));
    // CSP с Trusted Types (VS Code 1.139+): без «cppdocs» в trusted-types окно не может вставить
    // разметку и пилюля не появляется. Вписывает её своя вставка или Moon Core (0.1.0 с 2026-09-28).
    const tt = /(?:^|[;"'\s])trusted-types(?=[\s;"])([^;>"]*)/i.exec(t);
    if (tt && (t.indexOf(W.WB_START) !== -1 || t.indexOf(MC_START) !== -1)) say('  CSP Trusted Types: политика окна «cppdocs» ' + (/\scppdocs(?=\s|$)/.test(tt[1]) ? 'разрешена' : 'НЕ разрешена — окно не появится (обновите Moon Core / переподключите окно)'));
  });
  return EXIT.OK;
}

/** Можно ли править оболочку без прав администратора: 0 — да, 3 — нет, 1 — оболочка не найдена. */
function writable(c, say) {
  if (!c.shells.length) { say('Оболочка VS Code не найдена.'); return EXIT.FAIL; }
  const ok = c.shells.every(W.canWrite);
  say(ok ? 'Оболочку VS Code можно менять без прав администратора.' : 'Оболочка VS Code защищена от записи (установлен для всех пользователей).');
  return ok ? EXIT.OK : EXIT.DENIED;
}

/** argv: [команда]. opts (для тестов): execPath, env, storage, extDir, say. → код выхода. */
function main(argv, opts) {
  opts = opts || {};
  const say = opts.say || ((s) => console.log('  ' + s));
  const cmd = (argv && argv[0]) || '';
  const fn = { inject, remove, status, writable }[cmd];
  if (!fn) { say('Использование: window-cli.js inject | remove | status | writable'); return EXIT.FAIL; }
  try { return fn(context(opts), say); }
  catch (e) { say('[ПРОВАЛ] ' + (e && e.message)); return EXIT.FAIL; }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main, EXIT, outDirs, readProduct, userDataDir, findStorage, readData };
