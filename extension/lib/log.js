// Журнал расширения: канал «Документация C++» в панели Output — вместо молчаливых catch.
// Канал создаётся лениво, при первой записи.

const vscode = require('vscode');

let outputChannel = null;
function log(msg, err) {
  try {
    if (!outputChannel) outputChannel = vscode.window.createOutputChannel('Документация C++');
    const time = new Date().toISOString().slice(11, 19);
    outputChannel.appendLine('[' + time + '] ' + msg + (err ? ' — ' + (err.stack || err.message || err) : ''));
  } catch (e) { /* канал недоступен (тесты/заглушка) — молча */ }
}
/** Команда «показать журнал». */
function showLog() {
  log('открыт журнал');
  if (outputChannel) outputChannel.show(true);
}
/** Канал для подписок расширения (dispose при выгрузке); null, если ещё ничего не писали. */
function logChannel() { return outputChannel; }

module.exports = { log, showLog, logChannel };
