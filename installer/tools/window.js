// ============================================================
//  Мостик батников к коду расширений. Запускается VS Code как голым Node:
//    set ELECTRON_RUN_AS_NODE=1
//    "…\Code.exe" tools\window.js inject | remove | status | mooncore-remove | where
//
//  Сам ничего не патчит: находит установленное расширение «Документация C++» и вызывает его
//  window-cli.js (та же логика, что у команды в VS Code). mooncore-remove — хук удаления
//  Moon Core (его uninstall.js): снимает блок Moon Core из оболочки до удаления расширения.
//
//  Коды выхода: как у window-cli.js (0/1/2/3/4) плюс 5 — расширение слишком старое (нет
//  window-cli.js), 6 — расширение не установлено.
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const CPPDOCS = ['moonlivedt.cpp-docs-panel', 'local.cpp-docs-panel'];
const MOONCORE = ['moonlivedt.moon-core'];

/** product.json установки, в которой запущены (рядом с исполняемым файлом или в подпапке с хэшем). */
function readProduct(execPath) {
  const exeDir = path.dirname(execPath);
  const bases = [exeDir, path.join(exeDir, '..')];
  try { fs.readdirSync(exeDir, { withFileTypes: true }).forEach((d) => { if (d.isDirectory()) bases.push(path.join(exeDir, d.name)); }); } catch (e) {}
  for (const b of bases) {
    for (const r of ['resources', 'Resources']) {
      try { return JSON.parse(fs.readFileSync(path.join(b, r, 'app', 'product.json'), 'utf8')); } catch (e) {}
    }
  }
  return {};
}

/** Папка расширений: VSCODE_EXTENSIONS, портативный режим или ~/.vscode(-insiders|-oss)/extensions. */
function extensionsDir(execPath, env) {
  if (env.VSCODE_EXTENSIONS) return env.VSCODE_EXTENSIONS;
  const portable = env.VSCODE_PORTABLE || path.join(path.dirname(execPath), 'data');
  if (fs.existsSync(portable)) return path.join(portable, 'extensions');
  const product = readProduct(execPath);
  return path.join(env.USERPROFILE || env.HOME || '', product.dataFolderName || '.vscode', 'extensions');
}

function cmpVer(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); }
  return 0;
}

/** Папка установленного расширения с одним из ids: самая новая версия, без помеченных устаревшими
 *  (.obsolete). Источник — extensions.json (реестр VS Code), запасной путь — имена папок. */
function findExtension(dir, ids) {
  let obsolete = {};
  try { obsolete = JSON.parse(fs.readFileSync(path.join(dir, '.obsolete'), 'utf8')) || {}; } catch (e) {}
  const found = [];
  const add = (id, ver, p) => {
    if (!p || obsolete[path.basename(p)] || !fs.existsSync(path.join(p, 'package.json'))) return;
    found.push({ rank: ids.indexOf(id), ver, path: p });
  };
  let registry = null;
  try { registry = JSON.parse(fs.readFileSync(path.join(dir, 'extensions.json'), 'utf8')); } catch (e) {}
  // Реестр есть — верим ему: папка, которой в нём нет, — остаток, а не установленное расширение.
  if (Array.isArray(registry)) {
    registry.forEach((e) => {
      const id = String(e && e.identifier && e.identifier.id || '').toLowerCase();
      if (ids.indexOf(id) === -1) return;
      const loc = e.location && (e.location.fsPath || e.location.path);
      add(id, e.version, e.relativeLocation ? path.join(dir, e.relativeLocation) : loc && path.normalize(loc.replace(/^\/([A-Za-z]:)/, '$1')));
    });
  } else {
    try {
      fs.readdirSync(dir).forEach((n) => {
        const m = /^(.+)-(\d+\.\d+\.\d+)$/.exec(n);
        if (m && ids.indexOf(m[1].toLowerCase()) !== -1) add(m[1].toLowerCase(), m[2], path.join(dir, n));
      });
    } catch (e) {}
  }
  found.sort((a, b) => cmpVer(b.ver, a.ver) || a.rank - b.rank);
  return found.length ? found[0].path : '';
}

function main(argv, opts) {
  opts = opts || {};
  // Отступ как у строк батника (tools/common.cmd: 8 пробелов).
  const say = opts.say || ((s) => console.log('        ' + s));
  const execPath = opts.execPath || process.execPath;
  const env = opts.env || process.env;
  const cmd = argv[0] || '';
  const dir = extensionsDir(execPath, env);
  if (cmd === 'mooncore-remove') {
    const mc = findExtension(dir, MOONCORE);
    if (!mc) { say('Moon Core не установлен.'); return 0; }
    try { require(path.join(mc, 'uninstall.js')).main(); return 0; }
    catch (e) { say('[ПРОВАЛ] Moon Core: ' + (e && e.message)); return 1; }
  }
  const ext = findExtension(dir, CPPDOCS);
  if (cmd === 'where') { say(ext || 'не найдено (' + dir + ')'); return ext ? 0 : 6; }
  if (!ext) { say('[ПРОВАЛ] Расширение «Документация C++» не установлено (' + dir + '). Запустите Установить.bat.'); return 6; }
  const cli = path.join(ext, 'window-cli.js');
  if (!fs.existsSync(cli)) { say('[ПРОВАЛ] Установлена старая версия расширения — обновите её: Установить.bat.'); return 5; }
  return require(cli).main(argv, { execPath, env, say });
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main, extensionsDir, findExtension, readProduct };
