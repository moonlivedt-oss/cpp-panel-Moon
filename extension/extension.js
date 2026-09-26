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
//   lib/panel.js          то же окно во вкладке VS Code (webview) — без правки оболочки
//   lib/wb-patch.js       правка workbench.html (чистые функции; их же зовёт хук удаления uninstall.js)
//   lib/bridge.js         мост окно→расширение (HTTP 127.0.0.1) и поток событий
//   lib/progress.js       резервные копии прогресса, экспорт/импорт
//   lib/style.js          подсказки по стилю в .cpp
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
const { registerProgress } = require('./lib/progress');
const { startBridge } = require('./lib/bridge');
const { registerStyleHints } = require('./lib/style');
const { openWindowPanel } = require('./lib/panel');
const { dispatch } = require('./lib/rpc');
const { writeEditorContext, registerEditorBridge, openDocTarget } = require('./lib/editor-bridge');

// Якорь целостности рантайма: перед впечатыванием сверяем SHA-256 cpp-docs-runtime.js с этим
// значением (подмена файла на диске не пройдёт). Ставит `npm run hash:runtime`; пусто — проверку
// пропускаем. Доверенная точка тут сам extension.js.
const RUNTIME_SHA256 = '95fffb18b041f681fcb9972ad36de0091bb6ecacdd0dc223a7684332d1c6a4ca'; /* HASH:runtime — ставит scripts/hash-runtime.js */
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
    vscode.commands.registerCommand('cppDocs.showLog', showLog),
    // То же окно во вкладке VS Code — без правки оболочки (безопасный режим).
    vscode.commands.registerCommand('cppDocs.openWindowTab', () => openWindowPanel(context, rpcFor(context)))
  );
  // Канал журнала создаётся лениво (при первой записи) — освобождаем его при выгрузке, когда бы он ни появился.
  context.subscriptions.push({ dispose: () => { const c = logChannel(); if (c) c.dispose(); } });
  try { startBridge(context, rpcFor(context)); } catch (e) { log('мост окна', e); }
  try { actions.watchWindowEvents(context); } catch (e) { log('события окна', e); }
  try { registerProgress(context); } catch (e) { log('резервная копия прогресса', e); }
  try { registerStyleHints(context, (rel, hash) => openDocTarget(context, rel, hash)); } catch (e) { log('подсказки по стилю', e); }
  try { cleanupLeftovers(); } catch (e) { log('уборка хвостов', e); }
  try { win.ensureRuntimeCurrent(context); } catch (e) { log('обновление рантайма окна', e); }

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
            'Документация C++: можно открыть плавающее окно поверх редактора. Это разово изменит оболочку VS Code (появится баннер «…corrupt», его можно закрыть). Или откройте то же окно во вкладке — без правки VS Code.',
            'Включить окно', 'Во вкладке', 'Позже'
          ).then((pick) => {
            if (pick === 'Включить окно') enableWindow(context);
            else if (pick === 'Во вкладке') openWindowPanel(context, rpcFor(context));
          });
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
      }
    }));
  }
  } catch (e) {
    // Сбой активации не должен ронять хост расширений и другие расширения — гасим и логируем.
    log('сбой активации расширения', e);
  }
  // API для интеграционных тестов в настоящем VS Code (test/vscode/): состояние моста и окна,
  // ручная инъекция в тестовую копию VS Code. Пользователю не видно — это возвращаемое значение activate.
  return {
    _e2e: {
      status: () => ({ bridge: require('./lib/bridge').bridgeStatus(), errors: require('./lib/rpc').windowErrorCount(),
        injectedSha: win.injectedSha(), anchor: RUNTIME_SHA256, storage: storage.storageDir(context) }),
      inject: () => injectWindowFiles(context),
      disable: () => disableWindow(context),
    },
  };
}

/** Обработчик запросов окна для моста и вкладки: (method, body, opts) → Promise<ответ>. */
function rpcFor(context) { return (method, body, opts) => dispatch(context, method, body, opts); }

function deactivate() {}

module.exports = {
  activate, deactivate, buildDocsData, findDocsRoot,
  // чистые хелперы инъекции — покрыты test/inject.js
  escapeScript: win.escapeScript, safeJsonForScript,
  armCspWithNonce: win.armCspWithNonce, makeNonce: win.makeNonce,
  buildWindowBlock: win.buildWindowBlock, applyWindowInjection: win.applyWindowInjection,
  stripWindowInjection: win.stripWindowInjection,
  writeWorkbenchAtomic: win.writeWorkbenchAtomic, restoreCspFromBackup: win.restoreCspFromBackup,
  // «напиши и запусти» и действия окна — для тестов
  _run: { runUserCode: run.runUserCode, handleRun: run.handleRun, resolveCompilerAsync: run.resolveCompilerAsync,
    normRunOut: run.normRunOut, writeEditorContext, editorFilePath: storage.editorFilePath },
  _actions: { formatNoteEntry: actions.formatNoteEntry, insertNoteEntry: actions.insertNoteEntry, handleAction: actions.handleAction },
  _rpc: { dispatch },
};
