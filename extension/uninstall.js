// ============================================================
//  Хук удаления (package.json → scripts."vscode:uninstall").
//
//  VS Code запускает его голым Node (без API расширений), когда расширение удалено и редактор
//  перезапущен. Окно документации впечатано в оболочку VS Code (workbench.html) и само оттуда
//  не уйдёт — снимаем свой блок и возвращаем CSP из резервной копии. Чужие вставки не трогаем.
//
//  Где оболочка: process.execPath — это исполняемый файл VS Code (Code.exe / code / Electron),
//  рядом лежит resources/app/out (на macOS — ../Resources/app/out; в новых сборках Windows —
//  ещё и подпапка с хэшем версии).
// ============================================================

const fs = require('fs');
const path = require('path');
const { findWorkbenchIn, unpatchFile } = require('./lib/wb-patch');

function outDirs() {
  const exeDir = path.dirname(process.execPath);
  const bases = [exeDir, path.join(exeDir, '..')];
  try {
    fs.readdirSync(exeDir, { withFileTypes: true }).forEach((d) => { if (d.isDirectory()) bases.push(path.join(exeDir, d.name)); });
  } catch (e) { /* каталог недоступен — хватит основных */ }
  const out = [];
  bases.forEach((b) => {
    ['resources', 'Resources'].forEach((r) => {
      const o = path.join(b, r, 'app', 'out');
      if (fs.existsSync(o) && out.indexOf(o) === -1) out.push(o);
    });
  });
  return out;
}

function main() {
  let done = 0;
  outDirs().forEach((dir) => {
    findWorkbenchIn(dir, 6).forEach((f) => {
      if (!/[\\/]workbench[\\/]workbench\.html$/i.test(f)) return;
      try { if (unpatchFile(f)) done++; } catch (e) { /* нет прав — оставляем как есть */ }
      try { fs.unlinkSync(f + '.cppdocs-tmp'); } catch (e) { /* хвоста нет */ }
    });
  });
  console.log('cpp-docs-panel: плавающее окно снято из оболочки VS Code: ' + done);
}

if (require.main === module) main();
module.exports = { outDirs, main };
