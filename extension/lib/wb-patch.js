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

/** Экранировать </script, чтобы инлайн-<script> не закрылся на содержимом. */
function escapeScript(s) { return String(s).replace(/<\/script/gi, '<\\/script'); }

/** Одноразовый nonce для CSP (криптостойкий). */
function makeNonce() { return crypto.randomBytes(16).toString('base64').replace(/[^A-Za-z0-9]/g, ''); }

/** Снять наши прошлые добавки из CSP: «'nonce-…' file:» в script-src и «'nonce-…'» в style-src.
 *  Иначе каждое «Переподключить» дописывало бы ещё один nonce, и мета росла бы без конца. */
function stripOurNonces(meta) {
  return meta.replace(/ 'nonce-[A-Za-z0-9]+'(?: file:)?/g, '').replace(/ http:\/\/127\.0\.0\.1:\*/g, '').replace(/ cppdocs(?=[\s;"'])/g, '');
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
  if (/script-src/i.test(meta)) {
    meta = meta.replace(/(script-src)([^;>"]*)/i, "$1$2 'nonce-" + nonce + "' file:");
  } else {
    meta = meta.replace(/(content\s*=\s*)(["'])/i, "$1$2script-src 'nonce-" + nonce + "' file:; ");
  }
  if (/style-src/i.test(meta)) meta = meta.replace(/(style-src)([^;>"]*)/i, "$1$2 'nonce-" + nonce + "'");
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

/** Вернуть CSP-мету из бэкапа (снять наши nonce/file:). В оригинале CSP не было — только чистим свои
 *  добавки; чужие вставки не трогаем. */
function restoreCspFromBackup(html, bakPath) {
  let orig;
  try { orig = fs.readFileSync(bakPath, 'utf8'); } catch (e) { orig = null; }
  const om = orig && orig.match(CSP_RE);
  if (!om) return html.replace(CSP_RE, (meta) => stripOurNonces(meta));
  if (CSP_RE.test(html)) return html.replace(CSP_RE, om[0]);
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
  WB_START, WB_END, escapeScript, makeNonce, armCspWithNonce, stripOurNonces, windowBlockRe, buildWindowBlock,
  applyWindowInjection, stripWindowInjection, injectedRuntimeSha, writeWorkbenchAtomic, restoreCspFromBackup, findWorkbenchIn, unpatchFile,
};
