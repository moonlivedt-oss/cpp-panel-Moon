// Расширение «Документация C++». Точка входа: activate() связывает модули из lib/.
//
//   lib/docs.js           где папка docs, чтение .md, группы материалов
//   lib/sidebar.js        боковая панель (webview) и openDoc
//   lib/storage.js        файлы в globalStorage, их file:///-адреса, «опасные» настройки
//   lib/data.js           данные плавающего окна (window.__CPPDOCS__)
//   lib/window.js         впечатывание окна в оболочку VS Code (workbench.html)
//   lib/editor-bridge.js  слово/ошибка под курсором → окно; «Найти в справочнике C++»
//   lib/run.js            «Напиши и запусти»: компиляция и прогон по тестам
//   lib/actions.js        действия окна: «в редактор», «в заметки»; watch каналов
//   lib/log.js            журнал (Output → «Документация C++»)
//
// Рантайм самого окна — cpp-docs-runtime.js (один файл: впечатывается в оболочку целиком).

const vscode = require('vscode');
const path = require('path');
const { log, showLog, logChannel } = require('./lib/log');
const docs = require('./lib/docs');
const { INDEX_FILE, setBundledDocs, findDocsRoot, buildDocsData } = docs;
const { DocsViewProvider, openDoc, RECENT_KEY } = require('./lib/sidebar');
const storage = require('./lib/storage');
const { safeJsonForScript, writeDocsData } = require('./lib/data');
const win = require('./lib/window');
const { WINDOW_ON_KEY, WINDOW_SETUP_KEY, findWorkbenchFiles, windowInjected, cleanupLeftovers,
  injectWindowFiles, enableWindow, disableWindow, toggleWindow, windowHealth } = win;
const run = require('./lib/run');
const { resetCompilerCache } = run;
const actions = require('./lib/actions');
const { setupWindowChannels } = actions;
const { writeEditorContext, registerEditorBridge } = require('./lib/editor-bridge');

// Якорь целостности рантайма: перед впечатыванием сверяем SHA-256 cpp-docs-runtime.js с этим
// значением (подмена файла на диске не пройдёт). Ставит `npm run hash:runtime`; пусто — проверку
// пропускаем. Доверенная точка тут сам extension.js.
const RUNTIME_SHA256 = 'fae2f4608255b11addb632d3620b6e69a6432630c590cecb0cc5fa27fb2c2000'; /* HASH:runtime — ставит scripts/hash-runtime.js */
win.setRuntimeAnchor(RUNTIME_SHA256);

function activate(context) {
  // Документация, вшитая в расширение (extension/docs) — fallback, если в проекте нет своей.
  if (context && context.extensionPath) setBundledDocs(path.join(context.extensionPath, 'docs'));
  const provider = new DocsViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('cppDocsPanel', provider),
    vscode.commands.registerCommand('cppDocs.refresh', () => provider.renderAll()),
    vscode.commands.registerCommand('cppDocs.openMenu', () => provider.openMenuPanel()),
    vscode.commands.registerCommand('cppDocs.clearRecent', () => {
      context.globalState.update(RECENT_KEY, []);
      provider.renderAll();
    }),
    vscode.commands.registerCommand('cppDocs.openIndex', () => {
      const root = findDocsRoot();
      if (!root) {
        vscode.window.showWarningMessage('Папка docs не найдена. Проверь настройку cppDocs.path.');
        return;
      }
      openDoc(path.join(root, INDEX_FILE), false);
    }),
    vscode.commands.registerCommand('cppDocs.focusSearch', () => provider.focusSearch()),
    // Плавающее окно: подключить / отключить / проверить (прямой патч оболочки).
    vscode.commands.registerCommand('cppDocs.enableWindow', () => enableWindow(context)),
    vscode.commands.registerCommand('cppDocs.disableWindow', () => disableWindow(context)),
    vscode.commands.registerCommand('cppDocs.toggleWindow', () => toggleWindow(context)),
    vscode.commands.registerCommand('cppDocs.windowHealth', () => windowHealth(context)),
    vscode.commands.registerCommand('cppDocs.showLog', showLog)
  );
  if (logChannel()) context.subscriptions.push(logChannel());
  try { cleanupLeftovers(context); } catch (e) { log('уборка хвостов', e); }

  try {
  // Держим файл данных окна свежим при запуске (нужен окну и авто-инъектору).
  try { writeDocsData(context); } catch (e) {}

  // Патч пропал после обновления VS Code, а окно было включено — не патчим молча,
  // а спрашиваем согласие; впечатываем только по «Восстановить».
  try {
    if (context.globalState.get(WINDOW_ON_KEY) && findDocsRoot() &&
        findWorkbenchFiles().length && !windowInjected()) {
      setTimeout(() => {
        vscode.window.showInformationMessage(
          'Документация C++: после обновления VS Code плавающее окно пропало. Восстановить? Это снова разово изменит оболочку VS Code (появится баннер «…corrupt», его можно закрыть).',
          'Восстановить', 'Позже'
        ).then((pick) => {
          if (pick !== 'Восстановить') return;
          const r = injectWindowFiles(context);
          if (r.ok) {
            vscode.window.showInformationMessage(
              'Окно восстановлено. Перезагрузить редактор?', 'Перезагрузить', 'Позже'
            ).then((p2) => { if (p2 === 'Перезагрузить') { try { vscode.commands.executeCommand('workbench.action.reloadWindow'); } catch (e) {} } });
          } else if (r.denied) {
            vscode.window.showWarningMessage(
              'Не удалось восстановить окно (нет доступа на запись к оболочке). Запустите VS Code от имени администратора и выполните «подключить плавающее окно».');
          } else {
            vscode.window.showWarningMessage('Не удалось восстановить плавающее окно. Откройте «проверить плавающее окно» для диагностики.');
          }
        });
      }, 2500);
    }
  } catch (e) {}

  // Первый запуск: один раз предложим включить плавающее окно.
  try {
    if (!context.globalState.get(WINDOW_SETUP_KEY)) {
      context.globalState.update(WINDOW_SETUP_KEY, true);
      if (findDocsRoot() && findWorkbenchFiles().length && !windowInjected()) {
        setTimeout(() => {
          vscode.window.showInformationMessage(
            'Документация C++: можно открыть плавающее окно поверх редактора. Это разово изменит оболочку VS Code (появится баннер «…corrupt», его можно закрыть). Включить?',
            'Включить окно', 'Позже'
          ).then((pick) => { if (pick === 'Включить окно') enableWindow(context); });
        }, 3500);
      }
    }
  } catch (e) {}

  // Кнопка в статус-баре — постоянная точка входа в меню, мимо левого сайдбара.
  if (typeof vscode.window.createStatusBarItem === 'function') {
    const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    status.text = '$(book) C++';
    status.tooltip = 'Открыть меню документации C++';
    status.command = 'cppDocs.openMenu';
    status.show();
    context.subscriptions.push(status);
  }

  // Сменился активный редактор — обновим подсветку открытого файла в панели.
  if (typeof vscode.window.onDidChangeActiveTextEditor === 'function') {
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => provider.updateCurrent())
    );
  }

  registerEditorBridge(context);
  if (typeof vscode.workspace.onDidChangeConfiguration === 'function') {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
      const aff = (k) => !e || typeof e.affectsConfiguration !== 'function' || e.affectsConfiguration(k);
      if (aff('cppDocs.compiler')) resetCompilerCache();                 // перепроверить компилятор
      if (aff('cppDocs.localRun') || aff('cppDocs.compiler')) {
        try { writeDocsData(context); } catch (e2) {}                     // окно узнает про доступность «Запустить»
        try { setupWindowChannels(context); } catch (e2) {}
      }
    }));
  }
  try { setupWindowChannels(context); } catch (e) {}   // запросы окна: «Запустить», «в редактор», «в заметки»
  } catch (e) {
    // Сбой активации не должен ронять хост расширений и другие расширения — гасим и логируем.
    log('сбой активации расширения', e);
  }
}

function deactivate() {}

module.exports = {
  activate, deactivate, buildDocsData, findDocsRoot,
  // чистые хелперы инъекции — покрыты test/inject.js
  escapeScript: win.escapeScript, safeJsonForScript, neutralizeCsp: win.neutralizeCsp,
  armCspWithNonce: win.armCspWithNonce, makeNonce: win.makeNonce,
  buildWindowBlock: win.buildWindowBlock, applyWindowInjection: win.applyWindowInjection,
  stripWindowInjection: win.stripWindowInjection,
  writeWorkbenchAtomic: win.writeWorkbenchAtomic, restoreCspFromBackup: win.restoreCspFromBackup,
  // «напиши и запусти» — для теста end-to-end компиляции/прогона
  _run: { runUserCode: run.runUserCode, processRunReq: run.processRunReq,
    runReqFilePath: storage.runReqFilePath, runResFilePath: storage.runResFilePath,
    resolveCompilerAsync: run.resolveCompilerAsync, normRunOut: run.normRunOut,
    writeEditorContext, editorFilePath: storage.editorFilePath },
  // действия окна: блокнот «в заметки»
  _actions: { formatNoteEntry: actions.formatNoteEntry, insertNoteEntry: actions.insertNoteEntry,
    processActionReq: actions.processActionReq,
    actionFilePath: storage.actionFilePath, actionResFilePath: storage.actionResFilePath },
};
