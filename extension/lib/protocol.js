// ============================================================
//  Протокол «окно ↔ расширение» — единственный источник имён и лимитов.
//
//  Его используют хост (bridge.js, panel.js, data.js, actions.js) и рантайм окна: сборка
//  рантайма (scripts/build-runtime.js) подставляет эти же значения в extension/runtime/00-core.js
//  между маркерами PROTOCOL:start … PROTOCOL:end, а `npm run check` сверяет, что они совпадают.
//  Меняешь протокол несовместимо — подними VERSION: окно и хост разных версий это увидят.
// ============================================================

const PROTOCOL = {
  VERSION: 2,
  // Запросы окна к мосту (HTTP на 127.0.0.1) и к вкладке (postMessage «rpc»): ответ приходит сразу.
  METHODS: ['run', 'action', 'log'],
  // Файл, который окно пишет целиком (зеркало прогресса) — POST /w/<токен>/<имя>.
  WRITABLE: ['cpp-docs-progress.json'],
  // События потока (SSE /events) и сообщений вкладки.
  EVENTS: ['editor', 'stamp', 'data', 'theme'],
  // Файлы хранилища, изменения которых хост рассылает событиями.
  EVENT_FILES: { 'cpp-docs-editor.js': 'editor', 'cpp-docs-stamp.js': 'stamp' },
  MAX_BODY: 8 * 1024 * 1024,        // байт в теле запроса
  MAX_CODE: 200000,                 // символов кода в «Запустить»
  MAX_TESTS: 20,                    // тестов в одном запуске
  MAX_LOG: 4000,                    // символов в одной записи журнала от окна
  RUN_TIMEOUT_MS: 30000,            // окно ждёт ответ на «Запустить»
  ACTION_TIMEOUT_MS: 8000,          // …и на действие
};

/** Кусок JS для рантайма окна: `var PROTO = {...};` (подставляет сборка). */
function runtimeSnippet() {
  return '  /* PROTOCOL:start — генерируется из extension/lib/protocol.js, руками не править */\n' +
    '  var PROTO = ' + JSON.stringify(PROTOCOL) + ';\n' +
    '  /* PROTOCOL:end */';
}

module.exports = Object.assign({ PROTOCOL, runtimeSnippet }, PROTOCOL);
