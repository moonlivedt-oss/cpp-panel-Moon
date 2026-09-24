// Данные плавающего окна: список материалов с текстом + адреса файловых каналов.
// Пишутся в файл (для автообновления окна) и впечатываются в оболочку (см. window.js).

const fs = require('fs');
const path = require('path');
const { MAX_DOC_BYTES, findDocsRoot, buildDocsData, bundledDocs } = require('./docs');
const storage = require('./storage');
const { fileUrl, runtimeScriptPath, dataFilePath, stampFilePath, editorFilePath,
  runReqFilePath, runResFilePath, actionFilePath, actionResFilePath,
  NOTES_REL, notesFilePath, localRunEnabled } = storage;

/** JSON для инлайн-<script>: экранируем каждый '<' (глушит </script, <!--, <script разом)
 *  и разделители строк U+2028/U+2029 (валидны в JSON, но рвут JS-литерал). JSON.parse вернёт
 *  исходные символы. Данные могут прийти из чужого воркспейса, а исполняются в оболочке. */
function safeJsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Канал действий окна и личный блокнот. Во вшитых доках блокнот живёт в globalStorage —
 *  подменяем им стартовый шаблон, чтобы окно показывало настоящие записи. */
function addWindowExtras(context, root, data) {
  data.actionUrl = fileUrl(actionFilePath(context));
  data.actionResUrl = fileUrl(actionResFilePath(context));
  if (root !== bundledDocs()) return;
  let md;
  try { md = fs.readFileSync(notesFilePath(context, root), 'utf8'); } catch (e) { return; }
  const f = data.files.find((x) => x.rel === NOTES_REL);
  if (f) f.md = md.slice(0, MAX_DOC_BYTES);
}

/** Сгенерировать/обновить файл данных окна. Возвращает true при успехе. */
function writeDocsData(context) {
  const root = findDocsRoot();
  if (!root) return false;
  let data;
  try { data = buildDocsData(root); } catch (e) { return false; }
  data.dataUrl = fileUrl(dataFilePath(context));   // для кнопки «Обновить» в окне
  data.stampUrl = fileUrl(stampFilePath(context)); // лёгкая метка для автообновления
  data.runtimeUrl = fileUrl(runtimeScriptPath(context)); // маячок «живо ли расширение» (самопроверка окна)
  data.editorUrl = fileUrl(editorFilePath(context)); // мост доки↔редактор: слово под курсором
  data.run = { enabled: localRunEnabled() };          // «напиши и запусти»: доступна ли кнопка
  data.runReqUrl = fileUrl(runReqFilePath(context));  // окно пишет сюда запрос на компиляцию
  data.runResUrl = fileUrl(runResFilePath(context));  // хост кладёт сюда результат
  addWindowExtras(context, root, data);               // «в редактор»/«в заметки» + блокнот из хранилища
  // Загрузчик встраивает файл инлайном; safeJsonForScript глушит </script, <!--, <script и
  // разделители строк — контент может прийти из чужого воркспейса, а исполняется в оболочке.
  const body = 'window.__CPPDOCS__ = ' + safeJsonForScript(data) + ';\n';
  try {
    const p = dataFilePath(context);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf8');
    // Метку пишем ПОСЛЕ данных: окно, увидев новую метку, перечитает уже готовый data-файл.
    try { fs.writeFileSync(stampFilePath(context), 'window.__CPPDOCS_STAMP__ = ' + JSON.stringify(data.generatedAt || Date.now()) + ';\n', 'utf8'); } catch (e) {}
    return true;
  } catch (e) { return false; }
}

/** Тело data-скрипта (window.__CPPDOCS__ = {…};) — инлайном в оболочку: внешний file://-скрипт
 *  VS Code блокирует (схема vscode-file://), поэтому и данные, и рантайм впечатываем напрямую. */
function windowDataBody(context, nonce) {
  const root = findDocsRoot();
  if (!root) return null;
  let data;
  try { data = buildDocsData(root); } catch (e) { return null; }
  try {
    data.dataUrl = fileUrl(dataFilePath(context));
    data.stampUrl = fileUrl(stampFilePath(context));
    data.runtimeUrl = fileUrl(runtimeScriptPath(context)); // маячок для самопроверки окна
    data.editorUrl = fileUrl(editorFilePath(context)); // мост доки↔редактор
    data.run = { enabled: localRunEnabled() };
    data.runReqUrl = fileUrl(runReqFilePath(context));
    data.runResUrl = fileUrl(runResFilePath(context));
    addWindowExtras(context, root, data);
  } catch (e) {}
  if (nonce) data.scriptNonce = nonce;
  return 'window.__CPPDOCS__ = ' + safeJsonForScript(data) + ';\n';
}

module.exports = { safeJsonForScript, writeDocsData, windowDataBody };
