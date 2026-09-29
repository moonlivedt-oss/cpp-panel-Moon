// ============================================================
//  Правка оболочки VS Code (workbench.html) — чистые функции без vscode.
//  Их используют и расширение (lib/window.js), и хук удаления (uninstall.js), который VS Code
//  запускает голым Node уже без API расширений.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WB_START = '<!-- CPPDOCS-WINDOW-START -->';
const WB_END = '<!-- CPPDOCS-WINDOW-END -->';
const CSP_RE = /<meta\s+[^>]*Content-Security-Policy[^>]*>/i;

/** JSON для инлайн-<script>: экранируем каждый '<' (глушит </script, <!--, <script разом)
 *  и разделители строк U+2028/U+2029 (валидны в JSON, но рвут JS-литерал). JSON.parse вернёт
 *  исходные символы. Данные могут прийти из чужого воркспейса, а исполняются в оболочке. */
function safeJsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Тело data-скрипта для оболочки (window.__CPPDOCS__ = {…};) — только оглавление: тексты материалов
 *  (сотни КБ–мегабайты) VS Code разбирал бы при каждом запуске; полный файл данных окно читает
 *  асинхронно сразу после старта (refreshData). Исходный объект не меняется. */
function lazyWindowBody(data, nonce) {
  const d = Object.assign({}, data);
  d.files = (data.files || []).map((f) => Object.assign({}, f, { md: '', sx: undefined }));
  d.lazy = true;
  if (nonce) d.scriptNonce = nonce;
  return 'window.__CPPDOCS__ = ' + safeJsonForScript(d) + ';\n';
}

/** Экранировать </script, чтобы инлайн-<script> не закрылся на содержимом. */
function escapeScript(s) { return String(s).replace(/<\/script/gi, '<\\/script'); }

/** Одноразовый nonce для CSP (криптостойкий). */
function makeNonce() { return crypto.randomBytes(16).toString('base64').replace(/[^A-Za-z0-9]/g, ''); }

/** Директива CSP по имени: m[1] — разделитель перед ней, m[2] — имя, m[3] — значение.
 *  Имя целиком: «script-src» не находится внутри «script-src-elem». */
function directiveRe(name) { return new RegExp('(^|[;"\'\\s])(' + name + ')(?=[\\s;"]|$)([^;>"]*)', 'i'); }

/** Снять наши прошлые добавки из CSP: «'nonce-…' file:» в script-src, тот же nonce в style-src,
 *  мост и политику cppdocs. Иначе каждое «Переподключить» дописывало бы ещё один nonce.
 *  Наш nonce узнаём по подписи «'nonce-…' file:» — чужие nonce (Moon Core, сам VS Code) не трогаем:
 *  раньше снимались ВСЕ, и после подключения окна скрипты Moon Core блокировались CSP. */
function stripOurNonces(meta) {
  const ours = {};
  meta.replace(/'nonce-([A-Za-z0-9]+)' file:/g, (x, id) => { ours[id] = 1; return x; });
  Object.keys(ours).forEach((id) => { meta = meta.split(" 'nonce-" + id + "' file:").join('').split(" 'nonce-" + id + "'").join(''); });
  meta = meta.replace(/ http:\/\/127\.0\.0\.1:\*/g, '').replace(/ cppdocs(?=[\s;"'])/g, '');
  // script-src, которую мы дописали сами (в CSP её не было): копия default-src или пустая.
  const re = /(content\s*=\s*)(["'])script-src([^;"]*);\s*/i;
  const m = re.exec(meta), dm = directiveRe('default-src').exec(meta);
  if (m && (!m[3].trim() || (dm && m[3].trim() === dm[3].trim()))) meta = meta.replace(re, (x, a, q) => a + q);
  return meta;
}
/** Остальное, без чего окно не работает в чистой оболочке VS Code:
 *  connect-src — мост на 127.0.0.1 (запросы и поток событий);
 *  trusted-types — политика «cppdocs» (вся разметка окна идёт через неё, см. setHTML в рантайме). */
function armExtras(meta) {
  if (/connect-src/i.test(meta)) meta = meta.replace(/(connect-src)([^;>"]*)/i, '$1$2 http://127.0.0.1:*');
  if (/(^|[\s;"'])trusted-types\s/i.test(meta)) meta = meta.replace(/((?:^|[\s;"'])trusted-types)([^;>"]*)/i, '$1$2 cppdocs');
  return meta;
}

/** Впустить наши скрипты по nonce, НЕ снимая CSP целиком. Нет CSP-меты — ничего не навязываем;
 *  есть script-src — дописываем 'nonce-…' file:; нет script-src — добавляем минимальную директиву;
 *  в style-src вешаем тот же nonce для нашего <style>. Чужие инлайн-скрипты остаются заблокированы. */
function armCspWithNonce(html, nonce) {
  const m = html.match(CSP_RE);
  if (!m) return html;
  let meta = stripOurNonces(m[0]);
  const add = " 'nonce-" + nonce + "' file:";
  const sm = directiveRe('script-src').exec(meta);
  if (sm) {
    meta = meta.replace(directiveRe('script-src'), () => sm[1] + sm[2] + sm[3].replace(/\s+$/, '') + add + sm[3].slice(sm[3].replace(/\s+$/, '').length));
  } else {
    // script-src нет — скрипты ограничивает default-src. Новая script-src — его копия плюс наш
    // nonce: одиночный nonce отрезал бы скрипты самого VS Code ('self'). Нет и default-src —
    // скрипты не ограничены, дописывать нечего.
    const dm = directiveRe('default-src').exec(meta);
    if (dm) meta = meta.replace(/(content\s*=\s*)(["'])/i, (x, a, q) => a + q + 'script-src' + (dm[3].trim() ? ' ' + dm[3].trim() : '') + add + '; ');
  }
  const st = directiveRe('style-src').exec(meta);
  // Где в style-src уже есть 'unsafe-inline', nonce не нужен: он бы его ВЫКЛЮЧИЛ (CSP2+), и VS Code
  // потерял бы свои инлайн-стили.
  if (st && !/'unsafe-inline'/i.test(st[3])) meta = meta.replace(directiveRe('style-src'), () => st[1] + st[2] + st[3].replace(/\s+$/, '') + " 'nonce-" + nonce + "'" + st[3].slice(st[3].replace(/\s+$/, '').length));
  meta = armExtras(meta);
  return html.replace(CSP_RE, () => meta);
}

/** Регэксп нашего блока между маркерами. */
function windowBlockRe() {
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(esc(WB_START) + '[\\s\\S]*?' + esc(WB_END) + '\\n?');
}

/** Блок для <head>: маркеры + инлайн-данные (только оглавление, без текстов — см. data.js) +
 *  рантайм. runtime — объект { src, integrity, sha }: внешний скрипт по vscode-file:// с проверкой
 *  SRI (в оболочку не попадают ~700 КБ кода, VS Code стартует быстрее, а подменённый файл браузер
 *  не выполнит). Строка — прежний вариант, рантайм инлайном (превью, тесты). На <script> — nonce. */
function buildWindowBlock(dataBody, runtime, nonce) {
  const attr = nonce ? ' nonce="' + nonce + '"' : '';
  const q = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const rt = typeof runtime === 'string'
    ? '<script' + attr + '>\n' + escapeScript(runtime) + '\n</script>\n'
    : '<script' + attr + ' src="' + q(runtime.src) + '" integrity="' + q(runtime.integrity) + '" data-cppdocs-sha="' + q(runtime.sha) + '"></script>\n';
  return WB_START + '\n<script' + attr + '>\n' + escapeScript(dataBody) + '\n</script>\n' + rt + WB_END + '\n';
}
/** SHA рантайма, на который ссылается впечатанный блок ('' — инлайн-вариант или блока нет). */
function injectedRuntimeSha(html) {
  const m = String(html).match(/data-cppdocs-sha="([0-9a-f]{64})"/);
  return m ? m[1] : '';
}

/** Вставить/обновить блок в HTML оболочки (идемпотентно). Вернёт null, если нет </head>. */
function applyWindowInjection(html, block) {
  html = html.replace(windowBlockRe(), '');
  const idx = html.indexOf('</head>');
  if (idx < 0) return null;
  return html.slice(0, idx) + block + html.slice(idx);
}

/** Убрать наш блок из HTML оболочки. */
function stripWindowInjection(html) { return html.replace(windowBlockRe(), ''); }

/** Атомарная запись в workbench.html: временный файл + rename (прямая запись при сбое оставила бы
 *  оболочку недописанной — VS Code не запустится). Пара повторов переживает EBUSY/EPERM от антивируса. */
function writeWorkbenchAtomic(file, data) {
  const tmp = file + '.cppdocs-tmp';
  fs.writeFileSync(tmp, data, 'utf8');
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try { fs.renameSync(tmp, file); return; }
    catch (e) {
      lastErr = e;
      if (!(e && (e.code === 'EBUSY' || e.code === 'EPERM'))) break;
      const until = Date.now() + 40; while (Date.now() < until) { /* короткая пауза перед повтором */ }
    }
  }
  try { fs.unlinkSync(tmp); } catch (e2) {}
  throw lastErr;
}

/** Вернуть CSP-мету к виду без наших добавок. CSP в оболочке есть — снимаем только свои добавки:
 *  мету целиком из бэкапа НЕ подставляем — в ней нет того, что с тех пор дописали другие (nonce и
 *  порты Moon Core), и после снятия окна они переставали работать. Бэкап нужен только старым
 *  версиям, которые снимали CSP целиком: её впечатываем заново. */
function restoreCspFromBackup(html, bakPath) {
  if (CSP_RE.test(html)) return html.replace(CSP_RE, (meta) => stripOurNonces(meta));
  let orig;
  try { orig = fs.readFileSync(bakPath, 'utf8'); } catch (e) { orig = null; }
  const om = orig && orig.match(CSP_RE);
  if (!om) return html;
  const idx = html.indexOf('</head>');        // нашу CSP сняли ранее — впечатать оригинал заново
  if (idx < 0) return html;
  return html.slice(0, idx) + om[0] + '\n' + html.slice(idx);
}

/** Найти workbench.html под каталогом (обход до depth уровней). */
function findWorkbenchIn(dir, depth) {
  const out = [];
  const walk = (d, lvl) => {
    if (lvl > depth) return;
    let items;
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const it of items) {
      const p = path.join(d, it.name);
      if (it.isDirectory() && !it.isSymbolicLink()) walk(p, lvl + 1);
      else if (it.name === 'workbench.html') out.push(p);
    }
  };
  walk(dir, 0);
  return out;
}

/** Настоящий файл оболочки (патчим только его, не случайный workbench.html). */
const SHELL_RE = /[\\/]electron-(browser|sandbox)[\\/]workbench[\\/]workbench\.html$/i;

/** vscode-file://-адрес файла на диске — так оболочка VS Code отдаёт свои и пользовательские файлы. */
function appFileUrl(p) {
  const abs = path.resolve(p).replace(/\\/g, '/').replace(/^\/+/, '');
  return 'vscode-file://vscode-app/' + abs.split('/').map((seg) => encodeURIComponent(seg).replace(/%3A/gi, ':')).join('/');
}

const RUNTIME_FILE_RE = /^cpp-docs-runtime-([0-9a-f]{12})\.js$/;
/** Положить рантайм в папку хранилища под именем с хэшем (cpp-docs-runtime-<sha12>.js). Имя меняется
 *  с каждой версией: оболочка, ещё ссылающаяся на старый файл, работает до перезапуска, а новый
 *  блок ссылается на новый. Держим два последних файла. → { path, src, integrity, sha }. */
function stageRuntimeIn(dir, runtimeJs, sha) {
  fs.mkdirSync(dir, { recursive: true });
  const name = 'cpp-docs-runtime-' + sha.slice(0, 12) + '.js';
  const file = path.join(dir, name);
  let same = false;
  try { same = fs.readFileSync(file, 'utf8') === runtimeJs; } catch (e) {}
  if (!same) { const tmp = file + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, runtimeJs, 'utf8'); fs.renameSync(tmp, file); }
  try {
    fs.readdirSync(dir).filter((n) => RUNTIME_FILE_RE.test(n) && n !== name)
      .map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs })).sort((a, b) => b.t - a.t)
      .slice(1).forEach((x) => { try { fs.unlinkSync(path.join(dir, x.n)); } catch (e) {} });
  } catch (e) {}
  const integrity = 'sha256-' + crypto.createHash('sha256').update(runtimeJs, 'utf8').digest('base64');
  return { path: file, src: appFileUrl(file), integrity, sha };
}

/** Проверка рантайма перед впечатыванием: свой маркер, разумный размер и (если якорь задан)
 *  SHA-256 = якорь. → '' (годен) или причина: 'bad-runtime'. */
function checkRuntime(runtimeJs, anchor) {
  if (typeof runtimeJs !== 'string' || runtimeJs.length < 5000 || runtimeJs.indexOf('__CPPDOCS_RUNTIME__') === -1) return 'bad-runtime';
  if (anchor && crypto.createHash('sha256').update(runtimeJs, 'utf8').digest('hex') !== anchor) return 'bad-runtime';
  return '';
}

/** Впечатать готовый блок в один файл оболочки: бэкап оригинала, CSP с nonce, атомарная запись.
 *  → true (записано) / false (нет </head>). Ошибки записи — исключением (EACCES/EPERM — нет прав). */
function patchFileWithBlock(f, block, nonce) {
  const bak = f + '.cppdocs-backup';
  const raw = fs.readFileSync(f, 'utf8');
  // Бэкап держим равным оригиналу: файл ещё без нашего маркера — значит чистая оболочка.
  if (raw.indexOf(WB_START) === -1) { try { fs.copyFileSync(f, bak); } catch (e) {} }
  else if (!fs.existsSync(bak)) { try { fs.copyFileSync(f, bak); } catch (e) {} }
  // Переподключение: сперва вернуть CSP из бэкапа (armCspWithNonce ещё и сам чистит старые nonce).
  const base = raw.indexOf(WB_START) === -1 ? raw : restoreCspFromBackup(raw, bak);
  const next = applyWindowInjection(armCspWithNonce(base, nonce), block);
  if (next == null) return false;
  writeWorkbenchAtomic(f, next);
  return true;
}

/** Можно ли писать в файл (не меняя его). Нет прав — false: оболочка VS Code в Program Files. */
function canWrite(f) {
  try { fs.closeSync(fs.openSync(f, 'r+')); return true; }
  catch (e) { return !(e && (e.code === 'EACCES' || e.code === 'EPERM')); }
}

/** Снять окно из одного файла оболочки. Возвращает true, если что-то поменяли. */
function unpatchFile(f) {
  const html = fs.readFileSync(f, 'utf8');
  if (html.indexOf(WB_START) === -1) return false;
  let next = stripWindowInjection(html);
  next = restoreCspFromBackup(next, f + '.cppdocs-backup');
  writeWorkbenchAtomic(f, next);
  return true;
}

module.exports = {
  WB_START, escapeScript, makeNonce, armCspWithNonce, stripOurNonces, buildWindowBlock,
  applyWindowInjection, stripWindowInjection, injectedRuntimeSha, writeWorkbenchAtomic, restoreCspFromBackup, findWorkbenchIn, unpatchFile,
  safeJsonForScript, lazyWindowBody, SHELL_RE, appFileUrl, stageRuntimeIn, checkRuntime, patchFileWithBlock, canWrite,
};
