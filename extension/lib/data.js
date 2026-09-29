// Данные плавающего окна: список материалов с текстом + адреса файловых каналов.
// Пишутся в файл (для автообновления окна) и впечатываются в оболочку (см. window.js).

const fs = require('fs');
const path = require('path');
const { MAX_DOC_BYTES, findDocsRoot, buildDocsData, bundledDocs } = require('./docs');
const storage = require('./storage');
const { progressFilePath } = require('./progress');
const { bridgeFilePath } = require('./bridge');
const { fileUrl, dataFilePath, stampFilePath, editorFilePath,
  NOTES_REL, notesFilePath, localRunEnabled } = storage;

// safeJsonForScript и тело для оболочки — в wb-patch: их же зовёт window-cli.js (батники установщика).
const { safeJsonForScript, lazyWindowBody } = require('./wb-patch');

/** Личный блокнот. Во вшитых доках блокнот живёт в globalStorage —
 *  подменяем им стартовый шаблон, чтобы окно показывало настоящие записи. */
function addWindowExtras(context, root, data) {
  if (root !== bundledDocs()) return;
  let md;
  try { md = fs.readFileSync(notesFilePath(context, root), 'utf8'); } catch (e) { return; }
  const f = data.files.find((x) => x.rel === NOTES_REL);
  if (f) f.md = Buffer.byteLength(md, 'utf8') > MAX_DOC_BYTES ? Buffer.from(md, 'utf8').subarray(0, MAX_DOC_BYTES).toString('utf8').replace(/\uFFFD+$/, '') : md;
}

/** Файл с наклейками-значками под палитры (stickers-palettes.json рядом с расширением).
 *  Окно читает его с диска само и только когда выбрана палитра — в рантайм он не встраивается. */
function stickersUrl(context) {
  try {
    const p = path.join(context.extensionPath || '', 'stickers-palettes.json');
    return context.extensionPath && fs.existsSync(p) ? fileUrl(p) : '';
  } catch (e) { return ''; }
}
/** Все наклейки, кроме пилюли (stickers.json рядом с расширением): окно читает их при первом показе. */
function stickersAllUrl(context) {
  try {
    const p = path.join(context.extensionPath || '', 'stickers.json');
    return context.extensionPath && fs.existsSync(p) ? fileUrl(p) : '';
  } catch (e) { return ''; }
}

// Наклейки отдельными файлами. Оболочка VS Code работает в песочнице: у окна нет Node, и прочитать
// stickers.json оно не может. Зато картинки оболочка отдаёт сама по vscode-file:// — поэтому
// раскладываем data:-картинки из JSON в <globalStorage>/<папка>/<имя>.webp (один раз на версию
// файла) и отдаём окну список имён. Возвращает { base: file:///…/папка, files: { имя: файл } } или null.
const IMG_EXT = { 'image/webp': '.webp', 'image/png': '.png', 'image/gif': '.gif', 'image/jpeg': '.jpg' };
function extractImages(context, jsonName, subdir) {
  try {
    if (!context.extensionPath) return null;
    const src = path.join(context.extensionPath, jsonName);
    if (!fs.existsSync(src)) return null;
    const dir = path.join(storage.storageDir(context), subdir);
    const st = fs.statSync(src), stamp = st.size + ':' + Math.round(st.mtimeMs);
    const marker = path.join(dir, '.source');
    let files = null;
    if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === stamp) {
      files = {};
      fs.readdirSync(dir).forEach((f) => { const m = f.match(/^([a-z0-9@-]{1,60})\.(webp|png|gif|jpg)$/); if (m) files[m[1]] = f; });
    } else {
      const obj = JSON.parse(fs.readFileSync(src, 'utf8'));
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      files = {};
      Object.keys(obj).forEach((k) => {
        const m = /^data:(image\/(?:webp|png|gif|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(obj[k]));
        if (!/^[a-z0-9@-]{1,60}$/.test(k) || !m) return;
        const f = k + IMG_EXT[m[1]];
        fs.writeFileSync(path.join(dir, f), Buffer.from(m[2], 'base64'));
        files[k] = f;
      });
      fs.writeFileSync(marker, stamp, 'utf8');
    }
    return { base: fileUrl(dir), files };
  } catch (e) { return null; }
}
/** Поля данных окна про картинки (одни и те же для файла данных и для впечатывания). */
function addImageData(context, data) {
  data.stickersUrl = stickersUrl(context);            // значки под палитры — запасной путь: JSON целиком
  data.stickersAllUrl = stickersAllUrl(context);      // наклейки интерфейса — тоже
  const all = extractImages(context, 'stickers.json', 'stickers');
  const pal = extractImages(context, 'stickers-palettes.json', 'stickers-pal');
  if (all) data.stickerImgs = all;                    // основной путь: картинками по vscode-file://
  if (pal) data.palStickerImgs = pal;
}

/** Картинки фона главной (bg-*.webp рядом с расширением): окно берёт их по vscode-file:// по списку. */
function bgImages(context) {
  try {
    if (!context.extensionPath) return [];
    return fs.readdirSync(context.extensionPath).filter((n) => /^bg-[a-z0-9-]{1,40}\.webp$/.test(n)).slice(0, 40);
  } catch (e) { return []; }
}

/** Данные окна: материалы + адреса файловых каналов. Одни и те же для файла данных (автообновление)
 *  и для впечатывания в оболочку. null — документации нет. */
function windowData(context) {
  const root = findDocsRoot();
  if (!root) return null;
  let data;
  try { data = buildDocsData(root); } catch (e) { return null; }
  try {
    data.dataUrl = fileUrl(dataFilePath(context));      // для кнопки «Обновить» в окне
    data.stampUrl = fileUrl(stampFilePath(context));    // лёгкая метка для автообновления
    // маячок «живо ли расширение» — крошечный package.json (окно читает его раз в минуту)
    data.aliveUrl = context.extensionPath ? fileUrl(path.join(context.extensionPath, 'package.json')) : '';
    data.editorUrl = fileUrl(editorFilePath(context));  // мост доки↔редактор: слово под курсором
    data.run = { enabled: localRunEnabled() };           // «напиши и запусти»: доступна ли кнопка (сам запуск — запросом к мосту)
    data.protocol = require('./protocol').VERSION;       // окно другой версии протокола это увидит
    addImageData(context, data);                         // наклейки: адреса файлов для окна
    data.bridgeUrl = fileUrl(bridgeFilePath(context));   // где окно узнает адрес моста (запись без Node)
    data.progressUrl = fileUrl(progressFilePath(context)); // зеркало прогресса (резервная копия localStorage)
    data.extDirUrl = context.extensionPath ? fileUrl(context.extensionPath) : '';
    data.bgImages = bgImages(context);                   // какие bg-*.webp есть (фон главной)
    addWindowExtras(context, root, data);                // «в редактор»/«в заметки» + блокнот из хранилища
  } catch (e) {}
  return data;
}

/** Сгенерировать/обновить файл данных окна. Возвращает true при успехе. */
function writeDocsData(context) {
  const data = windowData(context);
  if (!data) return false;
  // Окно читает файл как текст и разбирает JSON.parse; safeJsonForScript глушит </script, <!--,
  // <script и разделители строк — контент может прийти из чужого воркспейса.
  const body = 'window.__CPPDOCS__ = ' + safeJsonForScript(data) + ';\n';
  try {
    const p = dataFilePath(context);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    // Атомарно: окно читает файл асинхронно и могло бы поймать его недописанным (2+ МБ),
    // а несколько окон VS Code пишут его одновременно.
    const tmp = p + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, body, 'utf8');
    fs.renameSync(tmp, p);
    // Метку пишем ПОСЛЕ данных: окно, увидев новую метку, перечитает уже готовый data-файл.
    try { fs.writeFileSync(stampFilePath(context), 'window.__CPPDOCS_STAMP__ = ' + JSON.stringify(data.generatedAt || Date.now()) + ';\n', 'utf8'); } catch (e) {}
    try { require('./mooncore').publishToc(); } catch (e) {}   // оглавление для окна Moon Core
    return true;
  } catch (e) { return false; }
}

/** Тело data-скрипта (window.__CPPDOCS__ = {…};) — инлайном в оболочку (только оглавление); рантайм
 *  подключается отдельным <script src="vscode-file://…" integrity> — см. wb-patch.buildWindowBlock. */
function windowDataBody(context, nonce) {
  const data = windowData(context);
  if (!data) return null;
  // Инлайном — только оглавление; полный файл данных окно читает само (см. wb-patch.lazyWindowBody).
  return lazyWindowBody(data, nonce);
}

module.exports = { safeJsonForScript, writeDocsData, windowDataBody, windowData, extractImages };
