// ============================================================
//  Панель «Документация C++»
//
//  Иконка книги в панели действий открывает список материалов проекта:
//  справочник, примеры, инструменты. Названия и описания читаются из самих
//  файлов, поэтому новые материалы появляются в панели сами.
//
//  Что внутри:
//    findDocsRoot()   — где лежит документация (проект → настройка);
//    collectGroups()  — что показать и в каком порядке;
//    DocsViewProvider — сборка HTML и обмен сообщениями с панелью.
// ============================================================

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const INDEX_FILE = '00-НАЧНИ-ОТСЮДА.md';
// Путь к документации, вшитой прямо в расширение (extension/docs). Задаётся в activate.
// Нужен, чтобы расширение работало «из коробки» после установки с Marketplace, даже когда
// в проекте пользователя нет своей папки docs.
let BUNDLED_DOCS = null;
const RECENT_KEY = 'cppDocs.recent';
const RECENT_LIMIT = 4;
const PINS_KEY = 'cppDocs.pins';
const READ_KEY = 'cppDocs.read';        // какие материалы уже открывали — отметка «изучено»
const FRESH_MS = 24 * 60 * 60 * 1000;   // «недавно изменён» — за последние сутки

// ===== Плавающее окно документации (инъекция в оболочку VS Code) =====
// Окно рисует extension/cpp-docs-runtime.js, внедрённый в окно редактора тем же
// загрузчиком, что и MoonLight custom-bg: subframe7536.custom-ui-style (живучее,
// переживает обновления VS Code) или be5invis.vscode-custom-css (классический).
// Расширение лишь прописывает импорт рантайма и генерирует рядом файл с данными
// (window.__CPPDOCS__) — сам рантайм API расширений не видит. См. writeDocsData,
// ensureWindowImport, removeWindowImport, windowHealth ниже.
const BE5_ID = 'be5invis.vscode-custom-css';
const BE5_IMPORTS_KEY = 'vscode_custom_css.imports';        // формат: массив строк-URL
const CUS_ID = 'subframe7536.custom-ui-style';
const CUS_IMPORTS_KEY = 'custom-ui-style.external.imports'; // формат: массив { type, url }
const WINDOW_SETUP_KEY = 'cppDocs.windowSetupOffered';      // первый запуск: предложили окно один раз

/** Ищет папку docs: сначала в открытом проекте, потом путь из настроек. */
function findDocsRoot() {
  const folders = vscode.workspace.workspaceFolders || [];
  for (const folder of folders) {
    const candidate = path.join(folder.uri.fsPath, 'docs');
    if (fs.existsSync(path.join(candidate, INDEX_FILE))) return candidate;
    if (fs.existsSync(path.join(folder.uri.fsPath, INDEX_FILE))) return folder.uri.fsPath;
  }
  const configured = vscode.workspace.getConfiguration('cppDocs').get('path');
  // Путь из настройки принимаем, только если это действительно папка с доками, —
  // иначе панель отрисовала бы пустые группы вместо понятной заглушки.
  if (configured && fs.existsSync(path.join(configured, INDEX_FILE))) return configured;
  // Наконец — документация, вшитая в само расширение (работает без открытого проекта).
  if (BUNDLED_DOCS && fs.existsSync(path.join(BUNDLED_DOCS, INDEX_FILE))) return BUNDLED_DOCS;
  return null;
}

/** Первый заголовок «# ...» — человеческое имя файла. Работает с уже прочитанным текстом. */
function parseTitle(content, filePath) {
  for (const line of content.slice(0, 2000).split('\n')) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m) return m[1].replace(/`/g, '');
  }
  return path.basename(filePath);
}

/** Описание под заголовком: первая строка цитаты «> ...», обрезанная по слову. */
function parseSubtitle(content) {
  for (const line of content.slice(0, 3000).split('\n')) {
    const m = line.match(/^>\s+(.+?)\s*$/);
    if (m) {
      const text = m[1]
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .trim();
      if (text.length <= 100) return text;
      const cut = text.slice(0, 100);
      const lastSpace = cut.lastIndexOf(' ');
      return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[,;:—-]$/, '') + '…';
    }
  }
  return '';
}

function mdFilesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.md')).sort();
  names.sort((a, b) => {
    const ra = a.toLowerCase().startsWith('readme') ? 0 : 1;
    const rb = b.toLowerCase().startsWith('readme') ? 0 : 1;
    return ra - rb;
  });
  return names.map((n) => path.join(dir, n));
}

/** Текст файла для поиска: заголовки и абзацы без разметки, первые 6 КБ.
 *  Нужен, чтобы запрос «тест» находил файл про тестирование, даже если этого
 *  слова нет ни в названии, ни в описании. Регистр сохраняем — из этого текста
 *  панель вырезает читаемый фрагмент-контекст вокруг совпадения. */
function parseBody(content) {
  return content
    .slice(0, 6000)
    .replace(/```[\s\S]*?```/g, ' ')       // блоки кода не индексируем: там шум
    .replace(/[#>*`|_\[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Разделы файла (## и ###) с номерами строк — для оглавления и перехода к разделу.
 *  Заголовок первого уровня (#) пропускаем: это название всего файла. */
function parseHeadings(content) {
  const lines = content.split('\n');
  const out = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().slice(0, 3) === '```') { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/[`*]/g, ''), line: i });
    if (out.length >= 40) break;    // очень длинные файлы не раздуваем
  }
  return out;
}

/** Сколько всего разделов (##/###) в файле — для подписи «N разделов». Без ограничения. */
function countSections(content) {
  const lines = content.split('\n');
  let inFence = false;
  let n = 0;
  for (const line of lines) {
    if (line.trim().slice(0, 3) === '```') { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^#{2,3}\s+\S/.test(line)) n++;
  }
  return n;
}

/** Прикидка времени чтения: слова прозы (без блоков кода) при ~150 слов/мин. */
function estimateMinutes(content) {
  const prose = content.replace(/```[\s\S]*?```/g, ' ');
  const words = (prose.match(/\S+/g) || []).length;
  return Math.max(1, Math.round(words / 150));
}

// Кэш разобранных файлов: пока файл не менялся (по mtime), не перечитываем и не
// разбираем его заново. Раньше describe() читал каждый файл четыре раза, и вся
// папка перечитывалась при любой перерисовке (открытие, закладка, слежение).
const docCache = new Map();

function describe(filePath) {
  let mtimeMs = 0;
  let fresh = false;
  try {
    const st = fs.statSync(filePath);
    mtimeMs = st.mtimeMs;
    fresh = Date.now() - st.mtimeMs < FRESH_MS;    // «недавно изменён» считаем всегда: это про сейчас
  } catch (e) {
    /* файла нет — соберём пункт из имени пути */
  }

  let parsed = docCache.get(filePath);
  if (!parsed || parsed.mtimeMs !== mtimeMs) {
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf8');   // единственное чтение файла
    } catch (e) {
      content = '';
    }
    const title = parseTitle(content, filePath);
    const subtitle = parseSubtitle(content);
    parsed = {
      mtimeMs: mtimeMs,
      title: title,
      subtitle: subtitle,
      body: parseBody(content),
      headings: parseHeadings(content),
      sections: countSections(content),
      minutes: estimateMinutes(content),
      // отдельно: по чему искать в заголовке/описании (в тексте ищем по body)
      head: (title + ' ' + subtitle + ' ' + path.basename(filePath)).toLowerCase(),
    };
    docCache.set(filePath, parsed);
  }

  return {
    title: parsed.title,
    subtitle: parsed.subtitle,
    file: filePath,
    name: path.basename(filePath),
    head: parsed.head,
    body: parsed.body,
    headings: parsed.headings,
    sections: parsed.sections,
    minutes: parsed.minutes,
    fresh: fresh,
  };
}

/** Группы для панели. Цвет — визуальный маркер, чтобы разделы различались с одного взгляда. */
function collectGroups(root, recent, pins) {
  const groups = [];

  // Закреплённое — материалы, что пользователь прикрепил сам; всегда наверху
  const pinnedItems = (pins || []).filter((p) => fs.existsSync(p)).map(describe);
  if (pinnedItems.length) {
    groups.push({
      label: 'Закреплённое',
      color: 'var(--vscode-charts-red, #e0697f)',
      items: pinnedItems,
      collapsedByDefault: false,
    });
  }

  // Недавнее — только если что-то уже открывали и файлы ещё существуют
  const recentItems = (recent || []).filter((p) => fs.existsSync(p)).slice(0, RECENT_LIMIT);
  if (recentItems.length) {
    groups.push({
      label: 'Недавнее',
      color: 'var(--vscode-charts-yellow, #d9a34a)',
      items: recentItems.map(describe),
      collapsedByDefault: false,
    });
  }

  const featured = [
    INDEX_FILE,
    '01-shpargalka.md',
    '02-recepty.md',
    '03-primenenie.md',
    '04-sravneniya.md',
    '05-samoproverka.md',
    '06-faq.md',
    '07-ukazatel.md',
    '08-zadachnik.md',
  ];
  const shown = new Set(featured);
  const main = [];
  for (const name of featured) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) main.push(describe(p));
  }
  for (const p of mdFilesIn(root)) {
    if (!shown.has(path.basename(p))) main.push(describe(p));
  }
  if (main.length) {
    groups.push({ label: 'Главное', color: 'var(--vscode-charts-blue, #519aba)', items: main });
  }

  const sections = [
    ['ref', 'Справочник по темам', 'var(--vscode-charts-purple, #b180d7)'],
    ['zadachnik', 'Задачник', 'var(--vscode-charts-red, #e06c75)'],
    ['examples', 'Примеры программ', 'var(--vscode-charts-green, #89d185)'],
    ['situacii', 'Один инструмент — разные задачи', 'var(--vscode-charts-orange, #d89a4a)'],
  ];
  for (const [folder, label, color] of sections) {
    const items = mdFilesIn(path.join(root, folder)).map(describe);
    if (items.length) groups.push({ label, color, items });
  }
  return groups;
}

// ============================================================
//  Данные для плавающего окна.
// ============================================================

/** Все материалы одним плоским списком с текстом файлов — для окна (window.__CPPDOCS__).
 *  Группы берём статические (без «Недавнего»/«Закреплённого» — у окна свои закладки).
 *  Чистая функция от пути: не трогает vscode, поэтому её же зовёт превью и смоук-тест. */
function buildDocsData(root) {
  const groups = collectGroups(root, [], []);
  const files = [];
  const seen = new Set();
  for (const g of groups) {
    for (const it of g.items) {
      if (seen.has(it.file)) continue;
      seen.add(it.file);
      let md = '';
      try { md = fs.readFileSync(it.file, 'utf8'); } catch (e) { md = ''; }
      files.push({
        rel: path.relative(root, it.file).replace(/\\/g, '/'),
        name: it.name,
        title: it.title,
        subtitle: it.subtitle,
        group: g.label,
        groupColor: g.color,
        minutes: it.minutes,
        sections: it.sections,
        md: md,
      });
    }
  }
  return { root: String(root).replace(/\\/g, '/'), indexFile: INDEX_FILE, generatedAt: Date.now(), files: files };
}

// ============================================================
//  Загрузчик и файлы инъекции (тот же механизм, что у MoonLight custom-bg).
// ============================================================

/** file:///-URL: прямые слэши, на Windows — третий слэш перед буквой диска. */
function fileUrl(p) {
  const abs = path.resolve(p).replace(/\\/g, '/');
  return 'file:///' + abs.replace(/^\/+/, '');
}
/** Какой загрузчик активен: предпочитаем custom-ui-style (живучее), иначе be5invis. */
function activeLoader() {
  try {
    if (vscode.extensions.getExtension(CUS_ID)) return 'custom-ui-style';
    if (vscode.extensions.getExtension(BE5_ID)) return 'custom-css';
  } catch (e) {}
  return null;
}
function loaderTitle(loader) {
  return loader === 'custom-ui-style' ? 'Custom UI Style' : loader === 'custom-css' ? 'Custom CSS and JS (be5invis)' : 'не найден';
}
function importsKey(loader) { return loader === 'custom-ui-style' ? CUS_IMPORTS_KEY : BE5_IMPORTS_KEY; }
function importEntry(loader, url) { return loader === 'custom-ui-style' ? { type: 'js', url: url } : url; }
function entryUrl(e) {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && typeof e.url === 'string') return e.url;
  return '';
}
/** Путь к рантайму окна: внутри установленного расширения. */
function runtimeScriptPath(context) {
  return path.join(context.extensionPath, 'cpp-docs-runtime.js');
}
/** Файл с данными окна: в globalStorage (гарантированно доступен на запись). */
function dataFilePath(context) {
  const dir = (context.globalStorageUri && context.globalStorageUri.fsPath) || context.globalStoragePath;
  return path.join(dir, 'cpp-docs-data.js');
}

/** Сгенерировать/обновить файл данных окна. Возвращает true при успехе. */
function writeDocsData(context) {
  const root = findDocsRoot();
  if (!root) return false;
  let data;
  try { data = buildDocsData(root); } catch (e) { return false; }
  data.dataUrl = fileUrl(dataFilePath(context));  // чтобы окно могло перечитать себя по кнопке «Обновить»
  // Загрузчик (be5invis/custom-ui-style) встраивает этот файл ИНЛАЙНОМ: <script>…</script>.
  // Если в материалах попадётся литеральный </script> (например, пример с HTML), он досрочно
  // закроет тег — данные вывалятся текстом, а window.__CPPDOCS__ не установится. Экранируем его
  // так же, как это делает превью-харнесс (scripts/preview-window.js, функция safe).
  const json = JSON.stringify(data).replace(/<\/script/gi, '<\\/script');
  const body = 'window.__CPPDOCS__ = ' + json + ';\n';
  try {
    const p = dataFilePath(context);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf8');
    return true;
  } catch (e) { return false; }
}

/** Прописать импорт рантайма (и данных перед ним) в настройки загрузчика. */
async function ensureWindowImport(context) {
  const loader = activeLoader();
  if (!loader) {
    const pick = await vscode.window.showWarningMessage(
      'Плавающее окно работает через загрузчик Custom UI Style (или Custom CSS and JS) — как MoonLight custom-bg. Его нужно установить.',
      'Открыть в маркетплейсе', 'Отмена');
    if (pick === 'Открыть в маркетплейсе') {
      try { await vscode.commands.executeCommand('workbench.extensions.search', CUS_ID); } catch (e) {}
    }
    return;
  }
  const script = runtimeScriptPath(context);
  if (!fs.existsSync(script)) {
    vscode.window.showErrorMessage('cpp-docs-runtime.js не найден рядом с расширением. Переустанови .vsix.');
    return;
  }
  // Данные должны записаться ДО прописывания импорта: иначе окно подключится пустым и
  // покажет «материалы не найдены». Не вышло — честно объясняем причину и не трогаем настройки.
  if (!writeDocsData(context)) {
    vscode.window.showWarningMessage(findDocsRoot()
      ? 'Не удалось записать данные документации для окна (нет доступа к хранилищу расширения). Попробуй ещё раз или переустанови .vsix.'
      : 'Папка docs не найдена — окну нечего показывать. Открой проект с папкой docs или укажи путь в настройке cppDocs.path.');
    return;
  }
  const conf = vscode.workspace.getConfiguration();
  const key = importsKey(loader);
  let arr = conf.get(key);
  arr = Array.isArray(arr) ? arr.slice() : [];
  const dataUrlLc = fileUrl(dataFilePath(context)).toLowerCase();
  const scriptUrlLc = fileUrl(script).toLowerCase();
  // Выкинуть прежние наши записи, добавим заново в правильном порядке (данные ПЕРЕД рантаймом).
  arr = arr.filter((u) => {
    const s = entryUrl(u).toLowerCase();
    return s !== dataUrlLc && s !== scriptUrlLc;
  });
  arr.push(importEntry(loader, fileUrl(dataFilePath(context))));
  arr.push(importEntry(loader, fileUrl(script)));
  await conf.update(key, arr, vscode.ConfigurationTarget.Global);

  if (loader === 'custom-ui-style') {
    const pick = await vscode.window.showInformationMessage(
      'Плавающее окно документации подключено (Custom UI Style). Применить и перезапустить редактор?', 'Применить', 'Позже');
    if (pick === 'Применить') {
      try { await vscode.commands.executeCommand('custom-ui-style.reload'); }
      catch (e) { vscode.window.showWarningMessage('Запусти «Custom UI Style: Reload» из палитры команд вручную.'); }
    }
  } else {
    const pick = await vscode.window.showInformationMessage(
      'Плавающее окно документации прописано. Включить Custom CSS и перезапустить?', 'Включить Custom CSS', 'Позже');
    if (pick === 'Включить Custom CSS') {
      try { await vscode.commands.executeCommand('extension.installCustomCSS'); }
      catch (e) { vscode.window.showWarningMessage('Запусти «Enable Custom CSS and JS» из палитры команд вручную.'); }
    }
  }
}

/** Убрать импорт рантайма/данных из настроек обоих загрузчиков и удалить файл данных. */
async function removeWindowImport(context) {
  const scriptLc = fileUrl(runtimeScriptPath(context)).toLowerCase();
  const dataLc = fileUrl(dataFilePath(context)).toLowerCase();
  const conf = vscode.workspace.getConfiguration();
  let touched = false;
  for (const key of [CUS_IMPORTS_KEY, BE5_IMPORTS_KEY]) {
    const cur = conf.get(key);
    if (!Array.isArray(cur)) continue;
    const next = cur.filter((u) => {
      const s = entryUrl(u).toLowerCase();
      return s !== scriptLc && s !== dataLc;
    });
    if (next.length !== cur.length) { await conf.update(key, next, vscode.ConfigurationTarget.Global); touched = true; }
  }
  try { const p = dataFilePath(context); if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
  vscode.window.showInformationMessage(touched
    ? 'Плавающее окно отключено. Перезапусти редактор (или Reload загрузчика), чтобы оно исчезло.'
    : 'Импорт окна не найден — нечего убирать.');
}

// ============================================================
//  Плавающее окно БЕЗ стороннего загрузчика: расширение само патчит оболочку
//  VS Code (workbench.html) — как это делает vscode-bg. Не нужны ни be5invis,
//  ни custom-ui-style, ни внешний батник. Вставка помечается маркерами, делается
//  резервная копия, повторный вызов идемпотентен (перезаписывает свой же блок).
// ============================================================
const WB_START = '<!-- CPPDOCS-WINDOW-START -->';
const WB_END = '<!-- CPPDOCS-WINDOW-END -->';

/** Экранировать </script, чтобы инлайн-<script> не закрылся на содержимом. */
function escapeScript(s) { return String(s).replace(/<\/script/gi, '<\\/script'); }

/** Снять CSP-мету из оболочки: на чистом VS Code она блокирует инлайн-<script>,
 *  поэтому без окна и без пилюли. Загрузчики (be5invis) делают ровно это же. */
function neutralizeCsp(html) {
  return html.replace(/<meta\s+[^>]*Content-Security-Policy[^>]*>/gi, '');
}

/** Регэксп нашего блока между маркерами. */
function windowBlockRe() {
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(esc(WB_START) + '[\\s\\S]*?' + esc(WB_END));
}

/** Тело data-скрипта: window.__CPPDOCS__ = {…}; (для инлайна в оболочку). */
function windowDataBody() {
  const root = findDocsRoot();
  if (!root) return null;
  let data;
  try { data = buildDocsData(root); } catch (e) { return null; }
  return 'window.__CPPDOCS__ = ' + escapeScript(JSON.stringify(data)) + ';\n';
}

/** Готовый блок для вставки в <head>: маркеры + данные + рантайм (оба экранированы). */
function buildWindowBlock(dataBody, runtimeJs) {
  return WB_START + '\n<script>\n' + escapeScript(dataBody) + '\n</script>\n<script>\n' +
         escapeScript(runtimeJs) + '\n</script>\n' + WB_END + '\n';
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

/** Найти файл(ы) workbench.html в установке VS Code (через vscode.env.appRoot). */
function findWorkbenchFiles() {
  const out = [];
  try {
    const appRoot = vscode.env && vscode.env.appRoot;
    if (!appRoot) return out;
    const walk = (dir, depth) => {
      if (depth > 6) return;
      let items;
      try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const it of items) {
        const p = path.join(dir, it.name);
        if (it.isDirectory()) walk(p, depth + 1);
        else if (it.name === 'workbench.html') out.push(p);
      }
    };
    walk(path.join(appRoot, 'out'), 0);
  } catch (e) {}
  return out;
}

/** Пропатчена ли оболочка нашим блоком (для health). */
function windowInjected() {
  return findWorkbenchFiles().some((f) => {
    try { return fs.readFileSync(f, 'utf8').indexOf(WB_START) !== -1; } catch (e) { return false; }
  });
}

/** Подключить плавающее окно: прямой патч оболочки, без стороннего загрузчика. */
async function enableWindow(context) {
  const dataBody = windowDataBody();
  if (!dataBody) {
    vscode.window.showWarningMessage('Папка docs не найдена — окну нечего показывать. Укажите путь в настройке cppDocs.path.');
    return;
  }
  try { writeDocsData(context); } catch (e) {}  // держим и файл данных свежим (кнопка «Обновить»)
  const scriptPath = runtimeScriptPath(context);
  if (!fs.existsSync(scriptPath)) {
    vscode.window.showErrorMessage('cpp-docs-runtime.js не найден рядом с расширением. Переустановите расширение.');
    return;
  }
  const files = findWorkbenchFiles();
  if (!files.length) {
    vscode.window.showErrorMessage('Не удалось найти workbench.html в установке VS Code — прямой патч невозможен.');
    return;
  }
  let runtimeJs;
  try { runtimeJs = fs.readFileSync(scriptPath, 'utf8'); }
  catch (e) { vscode.window.showErrorMessage('Не удалось прочитать рантайм окна.'); return; }
  const block = buildWindowBlock(dataBody, runtimeJs);
  let done = 0, denied = false;
  for (const f of files) {
    try {
      const bak = f + '.cppdocs-backup';
      if (!fs.existsSync(bak)) { try { fs.copyFileSync(f, bak); } catch (e) {} }
      let html = neutralizeCsp(fs.readFileSync(f, 'utf8'));  // снять CSP, иначе инлайн-скрипты не выполнятся
      const next = applyWindowInjection(html, block);
      if (next == null) continue;
      fs.writeFileSync(f, next, 'utf8');
      done++;
    } catch (e) { if (e && (e.code === 'EACCES' || e.code === 'EPERM')) denied = true; }
  }
  if (!done) {
    vscode.window.showErrorMessage(denied
      ? 'Нет доступа на запись к оболочке VS Code. Запустите VS Code от имени администратора и повторите.'
      : 'Не удалось впечатать окно в оболочку VS Code.');
    return;
  }
  const pick = await vscode.window.showInformationMessage(
    'Плавающее окно подключено. Перезапустить редактор? (Баннер «…appears to be corrupt» можно закрыть — это ожидаемо.)',
    'Перезапустить', 'Позже');
  if (pick === 'Перезапустить') {
    try { await vscode.commands.executeCommand('workbench.action.reloadWindow'); } catch (e) {}
  }
}

/** Отключить плавающее окно: снять наш патч + удалить файл данных + почистить наследие загрузчиков. */
async function disableWindow(context) {
  let done = 0, denied = false;
  for (const f of findWorkbenchFiles()) {
    try {
      const html = fs.readFileSync(f, 'utf8');
      if (html.indexOf(WB_START) === -1) continue;
      // Есть маркеры => патч не затёрт апдейтом, бэкап ему соответствует —
      // безопасно восстановить оболочку целиком (вернёт и CSP-мету).
      const bak = f + '.cppdocs-backup';
      if (fs.existsSync(bak)) fs.copyFileSync(bak, f);
      else fs.writeFileSync(f, stripWindowInjection(html), 'utf8');
      done++;
    } catch (e) { if (e && (e.code === 'EACCES' || e.code === 'EPERM')) denied = true; }
  }
  try { const p = dataFilePath(context); if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
  vscode.window.showInformationMessage(done
    ? 'Плавающее окно отключено. Перезапустите редактор (Developer: Reload Window).'
    : (denied ? 'Нет доступа на запись к оболочке VS Code (нужен администратор).'
              : 'Инъекция окна не найдена — оболочка уже чистая.'));
}

/** Прописан ли уже наш импорт (для health и первого запуска). */
function windowImportPresent(context) {
  const loader = activeLoader();
  if (!loader) return false;
  const cur = vscode.workspace.getConfiguration().get(importsKey(loader));
  if (!Array.isArray(cur)) return false;
  const scriptLc = fileUrl(runtimeScriptPath(context)).toLowerCase();
  return cur.some((u) => entryUrl(u).toLowerCase() === scriptLc);
}

/** Отчёт о состоянии окна с кнопками-действиями. */
async function windowHealth(context) {
  const script = runtimeScriptPath(context);
  const root = findDocsRoot();
  const wbFiles = findWorkbenchFiles();
  const patched = windowInjected();
  // Состояние файла данных — частая причина «пустого» окна.
  let dataInfo = 'НЕ создан (пересоздастся при подключении окна)';
  try {
    const df = dataFilePath(context);
    if (fs.existsSync(df)) {
      const st = fs.statSync(df);
      const mins = Math.round((Date.now() - st.mtimeMs) / 60000);
      dataInfo = 'есть (' + Math.max(1, Math.round(st.size / 1024)) + ' КБ, обновлён ' +
        (mins < 1 ? 'только что' : mins + ' мин назад') + ')';
    }
  } catch (e) { dataInfo = 'ошибка чтения'; }
  const L = [
    'Оболочка VS Code (workbench.html): ' + (patched ? 'пропатчена' : 'НЕ пропатчена'),
    'Файл workbench.html найден: ' + (wbFiles.length ? 'да (' + wbFiles.length + ')' : 'НЕТ'),
    'Файл рантайма на месте: ' + (fs.existsSync(script) ? 'да' : 'НЕТ'),
    'Файл данных окна: ' + dataInfo,
    'Папка документации: ' + (root ? root : 'НЕ найдена (см. cppDocs.path)'),
  ];
  const actions = patched ? ['Отключить окно', 'Переподключить'] : ['Подключить окно'];
  const pick = await vscode.window.showInformationMessage(
    'Плавающее окно — состояние:\n\n• ' + L.join('\n• '), { modal: false }, ...actions);
  if (pick === 'Подключить окно' || pick === 'Переподключить') {
    await enableWindow(context);
  } else if (pick === 'Отключить окно') {
    await disableWindow(context);
  }
}

async function openDoc(filePath, forceText) {
  // Файл могли удалить/переместить уже после того, как панель собрала список, —
  // не даём showTextDocument упасть с непонятной ошибкой, говорим по-человечески.
  if (!fs.existsSync(filePath)) {
    vscode.window.showWarningMessage('Файл не найден (возможно, перемещён или удалён): ' + path.basename(filePath));
    return;
  }
  const uri = vscode.Uri.file(filePath);
  const preview = vscode.workspace.getConfiguration('cppDocs').get('openInPreview');
  if (preview && !forceText) {
    try {
      await vscode.commands.executeCommand('markdown.showPreview', uri);
      return;
    } catch (e) {
      // Встроенное превью Markdown недоступно (расширение Markdown отключено) —
      // открываем как обычный текст, чтобы клик по материалу всегда что-то показал.
    }
  }
  await vscode.window.showTextDocument(uri, { preview: false });
}

function nonceString() {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Русское окончание для числа: 1 раздел, 2 раздела, 5 разделов. */
function pluralRu(n, forms) {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return forms[0];
  if (d10 >= 2 && d10 <= 4 && (d100 < 10 || d100 >= 20)) return forms[1];
  return forms[2];
}

class DocsViewProvider {
  constructor(context) {
    this.context = context;
    this.view = null;
    this.panel = null;          // отдельное меню в области редактора (WebviewPanel)
    this.watcher = null;        // следит за *.md, чтобы панель обновлялась сама
    this.watchedRoot = null;    // какую папку уже сторожим — не пересоздаём зря
    this.renderTimer = null;    // гасим пачку файловых событий одной перерисовкой
  }

  /** Обновиться не сразу: при сохранении файла событий прилетает несколько. */
  scheduleRender() {
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => {
      this.renderAll();
      // Плавающее окно читает материалы из сгенерированного файла — держим его свежим.
      // Пишем только если окно уже подключено (файл данных существует), иначе не тратим диск.
      try {
        if (fs.existsSync(dataFilePath(this.context))) writeDocsData(this.context);
      } catch (e) { /* нет прав/папки — окно просто обновится при следующем открытии */ }
    }, 150);
  }

  /** Сторожим папку с доками: добавили, изменили или удалили .md — панель освежается.
   *  Тихо ничего не делаем, если API недоступно (например, в смоук-тесте). */
  ensureWatcher(root) {
    if (this.watchedRoot === root) return;
    if (typeof vscode.workspace.createFileSystemWatcher !== 'function' ||
        typeof vscode.RelativePattern !== 'function') return;
    if (this.watcher) { this.watcher.dispose(); this.watcher = null; }
    this.watchedRoot = root;
    if (!root) return;
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, '**/*.md')
    );
    const onChange = () => this.scheduleRender();
    watcher.onDidCreate(onChange);
    watcher.onDidChange(onChange);
    watcher.onDidDelete(onChange);
    this.watcher = watcher;
    this.context.subscriptions.push(watcher);
  }

  recent() {
    return this.context.globalState.get(RECENT_KEY, []);
  }

  rememberOpened(filePath) {
    const list = this.recent().filter((p) => p !== filePath);
    list.unshift(filePath);
    this.context.globalState.update(RECENT_KEY, list.slice(0, RECENT_LIMIT * 2));
  }

  pins() {
    return this.context.globalState.get(PINS_KEY, []);
  }

  /** Прикрепить или открепить материал. */
  togglePin(filePath) {
    const list = this.pins();
    const next = list.includes(filePath)
      ? list.filter((p) => p !== filePath)
      : list.concat([filePath]);
    return this.context.globalState.update(PINS_KEY, next);
  }

  read() {
    return this.context.globalState.get(READ_KEY, []);
  }

  /** Отметить материал изученным (открывали хотя бы раз). */
  markRead(filePath) {
    const list = this.read();
    if (list.includes(filePath)) return Promise.resolve();
    return this.context.globalState.update(READ_KEY, list.concat([filePath]));
  }

  /** Переключить отметку «изучено» вручную — по клику на галочку у пункта. */
  toggleRead(filePath) {
    const list = this.read();
    const next = list.includes(filePath)
      ? list.filter((p) => p !== filePath)
      : list.concat([filePath]);
    return this.context.globalState.update(READ_KEY, next);
  }

  /** Открыть файл как текст на конкретной строке (переход к разделу оглавления). */
  async openAt(filePath, line) {
    if (!fs.existsSync(filePath)) {
      vscode.window.showWarningMessage('Файл не найден (возможно, перемещён или удалён): ' + path.basename(filePath));
      return;
    }
    this.rememberOpened(filePath);
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    const editor = await vscode.window.showTextDocument(doc, { preview: false });
    const pos = new vscode.Position(Math.max(0, line | 0), 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
  }

  /** Общий обработчик сообщений вебвью — одинаков и для сайдбара, и для отдельной панели. */
  async handleMessage(msg) {
    if (msg.type === 'open') {
      this.rememberOpened(msg.file);
      await this.markRead(msg.file);
      await openDoc(msg.file, false);
      this.renderAll();
    } else if (msg.type === 'openText') {
      this.rememberOpened(msg.file);
      await this.markRead(msg.file);
      await openDoc(msg.file, true);
      this.renderAll();
    } else if (msg.type === 'runTests') {
      await vscode.commands.executeCommand('workbench.action.tasks.runTask', 'C++: прогнать тесты');
    } else if (msg.type === 'checkDocs') {
      await vscode.commands.executeCommand('workbench.action.tasks.runTask', 'Документация: проверить');
    } else if (msg.type === 'clearRecent') {
      await this.context.globalState.update(RECENT_KEY, []);
      this.renderAll();
    } else if (msg.type === 'resetProgress') {
      await this.context.globalState.update(READ_KEY, []);
      this.renderAll();
    } else if (msg.type === 'togglePin') {
      await this.togglePin(msg.file);
      this.renderAll();
    } else if (msg.type === 'clearPins') {
      await this.context.globalState.update(PINS_KEY, []);
      this.renderAll();
    } else if (msg.type === 'toggleRead') {
      await this.toggleRead(msg.file);
      this.renderAll();
    } else if (msg.type === 'openAt') {
      await this.markRead(msg.file);
      await this.openAt(msg.file, msg.line);
      this.renderAll();
    } else if (msg.type === 'openSettings') {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'cppDocs.path');
    } else if (msg.type === 'refresh') {
      this.renderAll();
    }
  }

  /** Открыть меню отдельной панелью в области редактора (во всю ширину, не в сайдбаре). */
  openMenuPanel() {
    if (this.panel) { this.panel.reveal(); return; }
    const panel = vscode.window.createWebviewPanel(
      'cppDocsMenu',
      'Документация C++',
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    try {
      panel.iconPath = vscode.Uri.file(path.join(__dirname, 'icon.svg'));
    } catch (e) { /* иконка вкладки необязательна */ }
    this.panel = panel;
    panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    panel.onDidDispose(() => { if (this.panel === panel) this.panel = null; });
    if (typeof panel.onDidChangeViewState === 'function') {
      panel.onDidChangeViewState((e) => { if (e.webviewPanel.visible) this.updateCurrent(); });
    }
    this.renderPanel();
  }

  /** Собрать HTML для любого вебвью (сайдбар или панель). Здесь же — включение слежения за файлами. */
  htmlFor() {
    const root = findDocsRoot();
    this.ensureWatcher(root);
    return root
      ? this.buildHtml(collectGroups(root, this.recent(), this.pins()), this.currentDocFile(), this.pins(), this.read())
      : this.buildEmptyHtml();
  }

  /** Перерисовать отдельную панель, если она открыта. */
  renderPanel() {
    if (this.panel && this.panel.webview) this.panel.webview.html = this.htmlFor();
  }

  /** Перерисовать оба места сразу — и сайдбар, и панель. */
  renderAll() {
    this.render();
    this.renderPanel();
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.render();

    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));

    // Панель снова стала видимой — освежим подсветку открытого файла.
    if (typeof webviewView.onDidChangeVisibility === 'function') {
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) this.updateCurrent();
      });
    }
  }

  /** Файл, открытый в активном редакторе, — панель подсветит его в списке. */
  currentDocFile() {
    const ed = vscode.window.activeTextEditor;
    return ed && ed.document ? ed.document.uri.fsPath : '';
  }

  /** Сказать обоим местам, какой файл сейчас открыт, — без полной перерисовки. */
  updateCurrent() {
    const file = this.currentDocFile();
    const post = (wv) => {
      if (wv && typeof wv.postMessage === 'function') wv.postMessage({ type: 'current', file });
    };
    if (this.view) post(this.view.webview);
    if (this.panel) post(this.panel.webview);
  }

  /** Открыть меню и поставить курсор в строку поиска (команда/горячая клавиша). */
  async focusSearch() {
    // Если открыта отдельная панель — работаем с ней: она в приоритете.
    if (this.panel) {
      this.panel.reveal();
      if (this.panel.webview && typeof this.panel.webview.postMessage === 'function') {
        this.panel.webview.postMessage({ type: 'focusSearch' });
      }
      return;
    }
    // Сайдбар ещё ни разу не открывали в этой сессии — сначала откроем его.
    // При загрузке вебвью сам ставит фокус в строку поиска.
    if (!this.view) {
      await vscode.commands.executeCommand('cppDocsPanel.focus');
      return;
    }
    if (typeof this.view.show === 'function') this.view.show(false);
    if (this.view.webview && typeof this.view.webview.postMessage === 'function') {
      this.view.webview.postMessage({ type: 'focusSearch' });
    }
  }

  render() {
    if (!this.view) return;
    this.view.webview.html = this.htmlFor();
  }

  buildEmptyHtml() {
    const nonce = nonceString();
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         padding: 18px 16px; font-size: 13px; line-height: 1.55; }
  code { background: var(--vscode-textCodeBlock-background); padding: 1px 5px; border-radius: 3px; }
  .hint { opacity: .75; margin-top: 10px; }
  button {
    margin-top: 14px; padding: 6px 12px;
    font-family: inherit; font-size: 12px; cursor: pointer;
    color: var(--vscode-button-foreground); background: var(--vscode-button-background);
    border: none; border-radius: 5px;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
</style></head><body>
<p><b>Папка с документацией не найдена.</b></p>
<p class="hint">Открой проект <code>D:\\Desktop\\components\\cpp-docs-panel</code> или укажи путь в настройке
<code>cppDocs.path</code>.</p>
<button id="open-settings" type="button">Открыть настройки</button>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  document.getElementById('open-settings').addEventListener('click', function () {
    vscode.postMessage({ type: 'openSettings' });
  });
</script>
</body></html>`;
  }

  buildHtml(groups, currentFile, pins, read) {
    const nonce = nonceString();
    const pinnedSet = new Set(pins || []);
    const readSet = new Set(read || []);
    let index = 0;

    const groupsHtml = groups
      .map((g, gi) => {
        const items = g.items
          .map((it) => {
            const pinned = pinnedSet.has(it.file);
            const isRead = readSet.has(it.file);
            const headings = it.headings || [];
            const toc = headings
              .map((h) => `<button class="toc-link toc-l${h.level}" type="button" data-line="${h.line}">${escapeHtml(h.text)}</button>`)
              .join('');
            // мета-строка под описанием: время чтения и число разделов
            const metaParts = ['~' + it.minutes + ' мин'];
            if (it.sections > 0) {
              metaParts.push(it.sections + ' ' + pluralRu(it.sections, ['раздел', 'раздела', 'разделов']));
            }
            const metaText = metaParts.join(' · ');
            return `
        <div id="opt-${index}" class="item${it.fresh ? ' fresh' : ''}${isRead ? ' read' : ''}" role="option" aria-selected="false"
             data-index="${index++}" data-file="${escapeHtml(it.file)}" data-read="${isRead ? '1' : '0'}"
             data-head="${escapeHtml(it.head)}" data-body="${escapeHtml(it.body)}"
             data-title="${escapeHtml(it.title)}" data-sub="${escapeHtml(it.subtitle)}"
             title="${escapeHtml(it.name)}">
          <div class="item-main">
            <div class="item-title"></div>
            ${it.subtitle ? '<div class="item-sub"></div>' : ''}
            <div class="item-meta">${escapeHtml(metaText)}</div>
            <div class="item-where"></div>
            <span class="item-group-tag" style="--tag:${g.color}">${escapeHtml(g.label)}</span>
          </div>
          <div class="item-actions">
            <button class="read-btn${isRead ? ' is-read' : ''}" type="button" tabindex="-1"
                    title="${isRead ? 'Снять отметку «изучено»' : 'Отметить изученным'}"
                    aria-label="Отметить изученным" aria-pressed="${isRead ? 'true' : 'false'}">${isRead ? '✓' : '○'}</button>
            ${headings.length ? '<button class="toc-btn" type="button" tabindex="-1" title="Разделы файла" aria-label="Разделы файла"><span class="toc-chev">▸</span></button>' : ''}
            <button class="pin-btn${pinned ? ' pinned' : ''}" type="button" tabindex="-1"
                    title="${pinned ? 'Открепить' : 'Закрепить'}" aria-label="Закрепить">${pinned ? '★' : '☆'}</button>
          </div>
          ${toc ? `<div class="item-toc" hidden>${toc}</div>` : ''}
        </div>`;
          })
          .join('');
        // У «Недавнего» и «Закреплённого» — кнопка очистки прямо в шапке группы.
        const clearBtn = g.label === 'Недавнее'
          ? `
        <button class="recent-clear" type="button" title="Очистить недавнее"
                aria-label="Очистить недавнее">✕</button>`
          : g.label === 'Закреплённое'
          ? `
        <button class="pins-clear" type="button" title="Открепить всё"
                aria-label="Открепить всё">✕</button>`
          : '';
        // Ключ группы — её название, а не позиция: набор групп меняется на ходу
        // («Недавнее» и «Закреплённое» появляются сверху и сдвигают индексы),
        // поэтому свёрнутость надо привязывать к устойчивому имени.
        return `
      <section class="group" data-group="${escapeHtml(g.label)}" style="--accent:${g.color}">
        <button class="group-head" type="button" aria-expanded="true">
          <span class="chev" aria-hidden="true">▾</span>
          <span class="group-label">${escapeHtml(g.label)}</span>
          <span class="group-count">${g.items.length}</span>
        </button>${clearBtn}
        <div class="group-body">${items}</div>
      </section>`;
      })
      .join('');

    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    font-size: 13px;
    margin: 0;
    padding: 0;
  }

  /* уважаем системную настройку «меньше движения»: гасим все анимации и переходы */
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
  }

  /* ---------- поиск ---------- */
  .top {
    position: sticky; top: 0; z-index: 3;
    padding: 12px 12px 10px;
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid transparent;
    transition: border-color .15s;
  }
  .top.scrolled { border-bottom-color: var(--vscode-panel-border, rgba(128,128,128,.22)); }
  .search-wrap { position: relative; display: flex; align-items: center; }
  .search-icon {
    position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
    font-size: 14px; opacity: .4; pointer-events: none; line-height: 1;
  }
  #search {
    flex: 1; min-width: 0;
    padding: 8px 30px 8px 30px;
    color: var(--vscode-input-foreground);
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 8px;
    font-family: inherit; font-size: 13px;
    outline: none;
  }
  #search::placeholder { opacity: .6; }
  #search:focus { border-color: var(--vscode-focusBorder); }
  #clear {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    border: none; background: none; cursor: pointer; padding: 2px 5px;
    color: var(--vscode-foreground); opacity: .45; font-size: 14px; line-height: 1;
    display: none;
  }
  #clear:hover { opacity: .9; }
  .hint-row {
    font-size: 10.5px; opacity: .45; padding: 8px 2px 0;
    display: flex; justify-content: flex-end;
  }

  /* ---------- группы ---------- */
  .group { padding: 0 8px; position: relative; }
  .group + .group { margin-top: 4px; }
  .recent-clear, .pins-clear {
    position: absolute; top: 10px; right: 8px;
    border: none; background: none; cursor: pointer;
    color: var(--vscode-foreground); opacity: .4;
    font-size: 11px; line-height: 1; padding: 3px 6px; border-radius: 4px;
  }
  .recent-clear:hover, .pins-clear:hover { opacity: .9; background: var(--vscode-list-hoverBackground); }
  .group.collapsed .recent-clear, .group.collapsed .pins-clear { display: none; }
  .group-head {
    display: flex; align-items: center; gap: 7px;
    width: 100%; padding: 11px 6px 7px;
    background: none; border: none; cursor: pointer;
    color: var(--vscode-foreground);
    font-family: inherit; text-align: left;
  }
  .group-head:hover .group-label { opacity: .95; }
  .chev { font-size: 9px; opacity: .5; width: 10px; transition: transform .12s; }
  .group.collapsed .chev { transform: rotate(-90deg); }
  .group.collapsed .group-body { display: none; }
  .group-label {
    text-transform: uppercase; font-size: 10.5px; letter-spacing: .8px;
    font-weight: 700; opacity: .7; flex: 1;
  }
  .group-count {
    font-size: 10px; opacity: .5; font-variant-numeric: tabular-nums;
    padding: 1px 6px; border-radius: 8px; background: var(--vscode-list-hoverBackground);
  }

  /* ---------- пункты ---------- */
  .item {
    position: relative;
    padding: 9px 10px 9px 15px;
    border-radius: 7px;
    cursor: pointer;
    transition: background .1s;
  }
  .item::before {
    content: ''; position: absolute; left: 5px; top: 10px; bottom: 10px;
    width: 2.5px; border-radius: 3px; background: var(--accent); opacity: .32;
    transition: opacity .12s, top .12s, bottom .12s;
  }
  .item:hover { background: var(--vscode-list-hoverBackground); }
  .item:hover::before { opacity: .9; top: 7px; bottom: 7px; }
  .item.active {
    background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-list-activeSelectionForeground, inherit);
  }
  .item.active::before { opacity: 1; top: 6px; bottom: 6px; }
  .item-title { font-weight: 600; font-size: 13px; line-height: 1.35; }
  .item-sub { opacity: .62; font-size: 11.5px; margin-top: 3px; line-height: 1.45; }
  /* мета: время чтения и число разделов — тихой строкой под описанием */
  .item-meta {
    margin-top: 4px; font-size: 10px; opacity: .5; letter-spacing: .2px;
    font-variant-numeric: tabular-nums; color: var(--vscode-descriptionForeground, inherit);
  }
  .item-where {
    display: none;
    margin-top: 4px; font-size: 10.5px; opacity: .55;
    color: var(--vscode-descriptionForeground, inherit);
  }
  .item.found-in-body .item-where { display: block; }
  mark {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(255,200,0,.35));
    color: inherit; border-radius: 2px; padding: 0 1px;
  }

  /* пункт, открытый прямо сейчас в редакторе — видно, где ты находишься */
  .item.current {
    background: var(--vscode-list-inactiveSelectionBackground, var(--vscode-list-hoverBackground));
  }
  .item.current::before { opacity: 1; top: 5px; bottom: 5px; }
  .item.current .item-title { font-weight: 700; }

  /* точка «недавно изменён» — не в тексте, а псевдоэлементом, чтобы пережить перерисовку заголовка */
  .item.fresh .item-title::after {
    content: '●'; color: var(--vscode-charts-green, #89d185);
    font-size: 7px; vertical-align: middle; margin-left: 6px; opacity: .8;
  }

  /* метка исходной группы — видна только в плоском списке результатов поиска */
  .item-group-tag {
    display: none; margin-top: 5px; font-size: 9.5px; line-height: 1.6;
    padding: 0 7px; border-radius: 8px;
    color: var(--tag); border: 1px solid var(--tag); opacity: .85;
  }
  #results .item .item-group-tag { display: inline-block; }

  /* кластер действий справа: изучено, разделы, закладка. Прячется, пока не наведёшь */
  .item-actions {
    position: absolute; top: 8px; right: 8px;
    display: flex; gap: 3px; align-items: center;
  }
  .item-actions button {
    border: none; cursor: pointer; opacity: 0; transition: opacity .1s;
    background: var(--vscode-list-hoverBackground); color: var(--vscode-foreground);
    font-size: 11px; padding: 3px 6px; border-radius: 5px; line-height: 1;
  }
  .item:hover .item-actions button, .item.active .item-actions button { opacity: .55; }
  .item-actions button:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-activeSelectionBackground)); }
  /* закреплённое видно всегда, а не только при наведении */
  .pin-btn.pinned { opacity: 1; background: none; color: var(--vscode-charts-yellow, #d9a34a); }
  /* отметка «изучено» видна всегда, когда стоит — чтобы её можно было снять */
  .read-btn.is-read { opacity: 1; background: none; color: var(--vscode-charts-green, #89d185); }
  .toc-chev { display: inline-block; transition: transform .12s; }
  .item.toc-open .toc-chev { transform: rotate(90deg); }

  /* оглавление файла — раскрывается под пунктом */
  .item-toc { margin: 3px 0 5px 15px; display: flex; flex-direction: column; }
  /* Свёрнутое оглавление обязано слушаться атрибута hidden. Без этого правила
     класс .item-toc (display:flex) перебивает браузерное [hidden]{display:none},
     и все оглавления висят раскрытыми, а кнопка ▸ только крутит стрелку. */
  .item-toc[hidden] { display: none; }
  .toc-link {
    text-align: left; border: none; background: none; cursor: pointer;
    color: var(--vscode-foreground); opacity: .68;
    font-family: inherit; font-size: 11.5px; padding: 3px 7px; border-radius: 5px;
  }
  .toc-link:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
  .toc-l3 { padding-left: 20px; opacity: .55; font-size: 11px; }

  /* кнопка «наверх» при длинном списке */
  #to-top {
    position: fixed; right: 12px; bottom: 58px; z-index: 4; display: none;
    width: 30px; height: 30px; border-radius: 50%; cursor: pointer; border: none;
    background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
    color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
    font-size: 14px; line-height: 1; box-shadow: 0 1px 5px rgba(0,0,0,.35);
  }
  #to-top.show { display: block; }

  /* только для скринридеров */
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }

  /* видимая рамка при переходе с клавиатуры — для доступности */
  #search:focus-visible, .group-head:focus-visible,
  .recent-clear:focus-visible, .pins-clear:focus-visible, .actions button:focus-visible,
  .item-actions button:focus-visible, .toc-link:focus-visible, #to-top:focus-visible,
  .progress-continue:focus-visible, .progress-reset:focus-visible,
  .empty .linklike:focus-visible {
    outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px;
  }

  /* ---------- низ ---------- */
  .actions {
    position: sticky; bottom: 0; z-index: 3;
    display: flex; gap: 6px;
    padding: 8px 12px 10px;
    background: var(--vscode-sideBar-background);
    border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,.22));
  }
  .actions button {
    flex: 1; padding: 6px 8px;
    font-family: inherit; font-size: 12px;
    color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
    background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
    border: none; border-radius: 6px; cursor: pointer;
  }
  .actions button:hover {
    background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground));
  }
  .empty { padding: 22px 14px; opacity: .6; text-align: center; line-height: 1.6; }
  .empty .linklike {
    border: none; background: none; cursor: pointer; padding: 0 2px;
    color: var(--vscode-textLink-foreground, var(--vscode-focusBorder));
    font-family: inherit; font-size: inherit; text-decoration: underline;
  }
  .empty .linklike:hover { text-decoration: none; }
  #results { padding: 4px 8px 6px; }
  #results .item { --accent: var(--vscode-focusBorder); }
  #list { padding-bottom: 8px; }

  /* шапка панели — видна только в широком окне (отдельная панель); в узком сайдбаре скрыта */
  .panel-head { display: none; padding: 14px 14px 4px; }
  .panel-title { font-size: 16px; font-weight: 700; }
  .panel-sub { display: block; margin-top: 3px; font-size: 11px; opacity: .55; }

  /* полоса прогресса «изучено N из M» + «Продолжить» */
  .progress { display: flex; align-items: center; gap: 8px; padding: 10px 2px 0; }
  .progress-bar {
    flex: 1; height: 4px; border-radius: 999px; overflow: hidden;
    background: var(--vscode-list-hoverBackground);
  }
  .progress-fill {
    height: 100%; width: 0; border-radius: 999px;
    background: var(--vscode-charts-green, #89d185); transition: width .25s;
  }
  .progress-text { font-size: 10.5px; opacity: .6; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .progress-reset {
    border: none; background: none; cursor: pointer; padding: 3px 5px; border-radius: 5px;
    color: var(--vscode-foreground); opacity: .45; font-size: 12px; line-height: 1;
  }
  .progress-reset:hover { opacity: .9; background: var(--vscode-list-hoverBackground); }
  /* «Продолжить» — маленькая пилюля слева от полосы, ведёт к следующему неизученному */
  .progress-continue {
    border: none; cursor: pointer; padding: 4px 11px; border-radius: 999px;
    background: var(--vscode-button-secondaryBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    font-family: inherit; font-size: 11px; line-height: 1; white-space: nowrap; font-weight: 600;
  }
  .progress-continue:hover { background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-activeSelectionBackground)); }
  .progress-continue[disabled] { opacity: .35; cursor: default; }

  /* отметка «изучено» перед названием */
  .item.read .item-title::before {
    content: '✓ '; color: var(--vscode-charts-green, #89d185); font-weight: 700;
  }

  /* адаптивная сетка колонок в широком окне (отдельная панель); в узком сайдбаре — один столбец */
  @media (min-width: 760px) {
    .panel-head { display: block; }
    .group-body, #results {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2px 10px;
      align-items: start;
    }
  }
  @media (min-width: 1200px) {
    .group-body, #results {
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    }
  }
</style></head><body>

<div class="panel-head">
  <span class="panel-title">📘 Документация C++</span>
  <span class="panel-sub">справочник · примеры · задачник — клик открывает материал</span>
</div>

<div class="top" id="top">
  <div class="search-wrap">
    <span class="search-icon" aria-hidden="true">⌕</span>
    <input id="search" type="text" placeholder="Поиск по документации…" autocomplete="off"
           aria-label="Поиск по документации" role="combobox" aria-expanded="true"
           aria-autocomplete="list" aria-controls="list results">
    <button id="clear" type="button" title="Очистить (Esc)" aria-label="Очистить">✕</button>
  </div>
  <div class="progress">
    <button id="progress-continue" class="progress-continue" type="button"
            title="Открыть следующий неизученный материал">▶&nbsp;Продолжить</button>
    <div class="progress-bar"><div id="progress-fill" class="progress-fill"></div></div>
    <span id="progress-text" class="progress-text"></span>
    <button id="progress-reset" class="progress-reset" type="button"
            title="Сбросить прогресс изучения" aria-label="Сбросить прогресс">↺</button>
  </div>
  <div class="hint-row"><span id="counter"></span></div>
</div>

<div id="list" role="listbox" aria-label="Материалы документации">${groupsHtml}</div>
<div id="results" role="listbox" aria-label="Результаты поиска" style="display:none"></div>
<div class="empty" id="nothing" style="display:none">
  <span id="nothing-text">Ничего не нашлось</span>
  <button id="nothing-reset" type="button" class="linklike">Сбросить поиск</button>
</div>
<div id="live" class="sr-only" aria-live="polite"></div>

<button id="to-top" type="button" title="Наверх" aria-label="Наверх">↑</button>

<div class="actions">
  <button id="btn-tests" title="Прогнать тесты для открытого .cpp">Прогнать тесты</button>
  <button id="btn-check" title="Проверить, что документация не устарела">Проверить доки</button>
</div>

<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();
  let CURRENT_FILE = ${JSON.stringify(currentFile || '')};

  const search = document.getElementById('search');
  const clearBtn = document.getElementById('clear');
  const nothing = document.getElementById('nothing');
  const counter = document.getElementById('counter');
  const list = document.getElementById('list');
  const top = document.getElementById('top');
  const results = document.getElementById('results');
  const live = document.getElementById('live');
  const toTop = document.getElementById('to-top');
  const items = Array.from(document.querySelectorAll('.item'));
  items.forEach((el) => { el._home = el.parentNode; });   // куда вернуть после поиска
  let activeIndex = -1;

  // ---------- состояние панели переживает переключение вкладок ----------
  const saved = vscode.getState() || {};
  const collapsed = new Set(saved.collapsed || []);
  document.querySelectorAll('.group').forEach((g) => {
    if (collapsed.has(g.dataset.group)) {
      g.classList.add('collapsed');
      g.querySelector('.group-head').setAttribute('aria-expanded', 'false');
    }
  });

  function saveState() {
    vscode.setState({
      collapsed: Array.from(collapsed),
      query: search.value,
      scroll: window.scrollY,
    });
  }

  // Правильное окончание: 1 материал, 2 материала, 5 материалов.
  function plural(n, forms) {
    const d10 = n % 10, d100 = n % 100;
    if (d10 === 1 && d100 !== 11) return forms[0];
    if (d10 >= 2 && d10 <= 4 && (d100 < 10 || d100 >= 20)) return forms[1];
    return forms[2];
  }

  // Нормализация для поиска: без учёта регистра и «ё»/«е» («всё» находит «все»).
  // Замена посимвольная (длина сохраняется), поэтому позиции совпадений в
  // нормализованной строке точно соответствуют позициям в исходном тексте —
  // подсветка и вырезка фрагмента остаются корректными.
  function norm(s) {
    return s.toLowerCase().replace(/ё/g, 'е');
  }

  // Подсветить пункт, открытый сейчас в редакторе.
  function markCurrent(file) {
    CURRENT_FILE = file || '';
    items.forEach((el) => el.classList.toggle('current', !!file && el.dataset.file === file));
  }

  // ---------- отрисовка текста с подсветкой совпадений ----------
  // tokens — слова запроса; подсвечиваем каждое, где бы оно ни встретилось.
  function paint(el, text, tokens) {
    el.textContent = '';
    if (!tokens || !tokens.length) { el.textContent = text; return; }
    const low = norm(text);
    const ranges = [];
    tokens.forEach(function (t) {
      if (!t) return;
      let from = 0, idx;
      while ((idx = low.indexOf(t, from)) !== -1) {
        ranges.push([idx, idx + t.length]);
        from = idx + t.length;
      }
    });
    if (!ranges.length) { el.textContent = text; return; }
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    // склеиваем пересекающиеся куски, чтобы не плодить вложенные <mark>
    const merged = [];
    ranges.forEach(function (r) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push(r.slice());
    });
    let pos = 0;
    merged.forEach(function (r) {
      if (r[0] > pos) el.appendChild(document.createTextNode(text.slice(pos, r[0])));
      const mark = document.createElement('mark');
      mark.textContent = text.slice(r[0], r[1]);
      el.appendChild(mark);
      pos = r[1];
    });
    if (pos < text.length) el.appendChild(document.createTextNode(text.slice(pos)));
  }

  // Кусочек текста файла вокруг первого совпадения — чтобы было видно, за что нашлось.
  function snippet(body, tokens) {
    const low = norm(body);
    let best = -1, bestLen = 0;
    tokens.forEach(function (t) {
      const i = low.indexOf(t);
      if (i !== -1 && (best === -1 || i < best)) { best = i; bestLen = t.length; }
    });
    if (best === -1) return '';
    const radius = 42;
    let start = Math.max(0, best - radius);
    let end = Math.min(body.length, best + bestLen + radius);
    if (start > 0) {                       // не режем слово в начале фрагмента
      const sp = low.indexOf(' ', start);
      if (sp !== -1 && sp < best) start = sp + 1;
    }
    if (end < body.length) {               // и в конце
      const sp = low.lastIndexOf(' ', end);
      if (sp > best + bestLen) end = sp;
    }
    return (start > 0 ? '…' : '') + body.slice(start, end).trim() + (end < body.length ? '…' : '');
  }

  function applyFilter() {
    const q = norm(search.value.trim());      // без учёта регистра и ё/е
    const tokens = q ? q.split(/ +/) : [];    // без \s: код живёт внутри шаблонной строки
    clearBtn.style.display = q ? 'block' : 'none';

    if (!tokens.length) {
      // Обычный режим: возвращаем пункты по своим группам.
      // Дописываем в дом КАЖДЫЙ пункт по порядку из items (это порядок исходной
      // разметки), иначе те, что «всплывали» в результаты поиска, вернулись бы
      // в конец группы и порядок внутри неё бы перемешался.
      items.forEach((el) => {
        el.style.display = '';
        el.classList.remove('found-in-body');
        paint(el.querySelector('.item-title'), el.dataset.title, null);
        const sub = el.querySelector('.item-sub');
        if (sub) paint(sub, el.dataset.sub, null);
        if (el._home) el._home.appendChild(el);
      });
      document.querySelectorAll('.group').forEach((group) => {
        group.style.display = '';
        group.classList.toggle('collapsed', collapsed.has(group.dataset.group));
      });
      list.style.display = '';
      results.style.display = 'none';
      nothing.style.display = 'none';
      counter.textContent = items.length + ' ' + plural(items.length, ['материал', 'материала', 'материалов']);
      live.textContent = '';
      setActive(-1);
      return;
    }

    // Режим поиска: один плоский список, самое точное сверху.
    // Несколько слов — это «И»: пункт подходит, если каждое слово нашлось
    // в названии/описании или в тексте файла. Совпадение в названии важнее,
    // чем в тексте, иначе «Ошибки компилятора» тонет среди файлов, где слово
    // просто встречается.
    const matched = [];
    items.forEach((el) => {
      const head = norm(el.dataset.head);
      const bodyLow = norm(el.dataset.body);
      const inHead = tokens.every((t) => head.includes(t));
      const matches = tokens.every((t) => head.includes(t) || bodyLow.includes(t));
      if (!matches) {
        el.style.display = 'none';
        return;
      }
      const inBody = !inHead;                 // хоть одно слово нашлось только в тексте
      el.style.display = '';
      el.classList.toggle('found-in-body', inBody);
      paint(el.querySelector('.item-title'), el.dataset.title, tokens);
      const sub = el.querySelector('.item-sub');
      if (sub) paint(sub, el.dataset.sub, tokens);
      if (inBody) paint(el.querySelector('.item-where'), snippet(el.dataset.body, tokens), tokens);
      // ранг: 0 — начало названия, 1 — целиком в названии/описании, 2 — с текстом
      const title = norm(el.dataset.title);
      const rank = title.startsWith(tokens[0]) && inHead ? 0 : inHead ? 1 : 2;
      matched.push({ el: el, rank: rank });
    });

    matched.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return items.indexOf(a.el) - items.indexOf(b.el);
    });

    // Один и тот же файл может стоять в нескольких группах (например, в «Недавнем»
    // и в «Справочнике»). В плоском списке результатов показываем его один раз —
    // тот, что оказался выше по рангу; прочие копии прячем.
    const seen = new Set();
    const shown = [];
    matched.forEach(function (m) {
      const file = m.el.dataset.file;
      if (seen.has(file)) { m.el.style.display = 'none'; return; }
      seen.add(file);
      shown.push(m);
      results.appendChild(m.el);
    });

    list.style.display = 'none';
    results.style.display = shown.length ? '' : 'none';
    nothing.style.display = shown.length ? 'none' : '';
    counter.textContent = shown.length + ' из ' + items.length;
    // заглушка «ничего не нашлось» повторяет сам запрос — видно, что именно искали
    if (!shown.length) {
      const nt = document.getElementById('nothing-text');
      if (nt) nt.textContent = 'Ничего не нашлось: «' + search.value.trim() + '»';
    }
    live.textContent = shown.length
      ? 'Найдено: ' + shown.length + ' ' + plural(shown.length, ['материал', 'материала', 'материалов'])
      : 'Ничего не нашлось';
    setActive(shown.length ? 0 : -1);
  }

  function visibleItems() {
    return items.filter((el) => el.offsetParent !== null);
  }

  function setActive(n) {
    items.forEach((el) => { el.classList.remove('active'); el.setAttribute('aria-selected', 'false'); });
    const vis = visibleItems();
    if (n < 0 || !vis.length) {
      activeIndex = -1;
      search.removeAttribute('aria-activedescendant');   // скринридеру: активного пункта нет
      return;
    }
    activeIndex = Math.max(0, Math.min(n, vis.length - 1));
    const el = vis[activeIndex];
    el.classList.add('active');
    el.setAttribute('aria-selected', 'true');
    // combobox-паттерн: фокус остаётся в поиске, а «активный потомок» указывает
    // на выделенный пункт — скринридер зачитывает его при навигации стрелками.
    if (el.id) search.setAttribute('aria-activedescendant', el.id);
    el.scrollIntoView({ block: 'nearest' });
  }

  function openActive(asText) {
    const vis = visibleItems();
    const el = activeIndex >= 0 ? vis[activeIndex] : vis[0];
    if (el) vscode.postMessage({ type: asText ? 'openText' : 'open', file: el.dataset.file });
  }

  // ---------- мышь ----------
  items.forEach((el) => {
    el.addEventListener('click', () => vscode.postMessage({ type: 'open', file: el.dataset.file }));
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      vscode.postMessage({ type: 'openText', file: el.dataset.file });
    });
    el.addEventListener('mouseenter', () => {
      const vis = visibleItems();
      const i = vis.indexOf(el);
      if (i >= 0) { items.forEach((x) => x.classList.remove('active')); activeIndex = i; }
    });
    // Кнопки действий не должны всплывать к пункту (иначе откроется превью).
    const pinBtn = el.querySelector('.pin-btn');
    if (pinBtn) pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({ type: 'togglePin', file: el.dataset.file });
    });
    const readBtn = el.querySelector('.read-btn');
    if (readBtn) readBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({ type: 'toggleRead', file: el.dataset.file });
    });
    const tocBtn = el.querySelector('.toc-btn');
    const toc = el.querySelector('.item-toc');
    if (tocBtn && toc) {
      tocBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = el.classList.toggle('toc-open');
        toc.hidden = !open;
      });
      toc.addEventListener('click', (e) => e.stopPropagation());   // клик по пустому месту не открывает файл
      toc.querySelectorAll('.toc-link').forEach((link) => {
        link.addEventListener('click', (e) => {
          e.stopPropagation();
          vscode.postMessage({ type: 'openAt', file: el.dataset.file, line: parseInt(link.dataset.line, 10) });
        });
      });
    }
  });

  const recentClear = document.querySelector('.recent-clear');
  if (recentClear) recentClear.addEventListener('click', (e) => {
    e.stopPropagation();
    vscode.postMessage({ type: 'clearRecent' });
  });

  const pinsClear = document.querySelector('.pins-clear');
  if (pinsClear) pinsClear.addEventListener('click', (e) => {
    e.stopPropagation();
    vscode.postMessage({ type: 'clearPins' });
  });

  const nothingReset = document.getElementById('nothing-reset');
  if (nothingReset) nothingReset.addEventListener('click', () => {
    search.value = ''; applyFilter(); search.focus(); saveState();
  });

  document.querySelectorAll('.group-head').forEach((head) => {
    head.addEventListener('click', () => {
      const group = head.closest('.group');
      const key = group.dataset.group;
      group.classList.toggle('collapsed');
      const isCollapsed = group.classList.contains('collapsed');
      head.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
      if (isCollapsed) collapsed.add(key); else collapsed.delete(key);
      saveState();
    });
  });

  clearBtn.addEventListener('click', () => { search.value = ''; applyFilter(); search.focus(); saveState(); });
  document.getElementById('btn-tests').addEventListener('click', () => vscode.postMessage({ type: 'runTests' }));
  document.getElementById('btn-check').addEventListener('click', () => vscode.postMessage({ type: 'checkDocs' }));

  // «Наверх».
  toTop.addEventListener('click', () => { window.scrollTo(0, 0); search.focus(); });

  // ---------- клавиатура ----------
  // Дебаунс: на быстром наборе не дёргаем DOM на каждой букве.
  let filterTimer;
  search.addEventListener('input', () => {
    saveState();
    clearTimeout(filterTimer);
    filterTimer = setTimeout(applyFilter, 110);
  });

  const PAGE = 8;   // на сколько пунктов прыгать по PageUp/PageDown
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(activeIndex <= 0 ? 0 : activeIndex - 1);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setActive(activeIndex < 0 ? 0 : activeIndex + PAGE);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setActive(activeIndex <= 0 ? 0 : activeIndex - PAGE);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openActive(e.ctrlKey || e.metaKey);
    } else if (e.key === 'Escape') {
      if (search.value) { search.value = ''; applyFilter(); saveState(); }
      search.focus();
    } else if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
      // Ctrl/Cmd+K — привычный способ прыгнуть в поиск, не выходя из панели.
      e.preventDefault();
      search.focus();
      search.select();
    } else if (e.key === '/' && document.activeElement !== search) {
      e.preventDefault();
      search.focus();
      search.select();
    }
  });

  // Прокрутка: тень под поиском, кнопка «наверх», запоминание позиции (с дебаунсом).
  let scrollTimer;
  window.addEventListener('scroll', () => {
    top.classList.toggle('scrolled', window.scrollY > 2);
    toTop.classList.toggle('show', window.scrollY > 200);
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(saveState, 200);
  });

  // ---------- сообщения от расширения ----------
  window.addEventListener('message', (e) => {
    const msg = e.data || {};
    if (msg.type === 'current') markCurrent(msg.file);
    else if (msg.type === 'focusSearch') { search.focus(); search.select(); }
  });

  // ---------- прогресс изучения и «Продолжить» ----------
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const progressReset = document.getElementById('progress-reset');
  const continueBtn = document.getElementById('progress-continue');

  // «изучено N из M» — считаем по уникальным файлам (один файл может стоять в нескольких группах)
  function updateProgress() {
    const files = new Set(items.map((el) => el.dataset.file));
    const doneFiles = new Set(
      items.filter((el) => el.dataset.read === '1').map((el) => el.dataset.file)
    );
    const pct = files.size ? Math.round((doneFiles.size / files.size) * 100) : 0;
    if (progressText) progressText.textContent = 'изучено ' + doneFiles.size + ' из ' + files.size + ' · ' + pct + '%';
    if (progressFill) progressFill.style.width = pct + '%';
    if (continueBtn) continueBtn.disabled = doneFiles.size >= files.size;   // всё изучено — гаснет
  }

  if (progressReset) progressReset.addEventListener('click', () => vscode.postMessage({ type: 'resetProgress' }));

  // «Продолжить»: открыть первый неизученный материал по порядку списка (закреплённое,
  // недавнее, затем главное и разделы) — учёба движется по справочнику сверху вниз.
  if (continueBtn) continueBtn.addEventListener('click', () => {
    const next = items.find((el) => el.dataset.read === '0');
    if (next) vscode.postMessage({ type: 'open', file: next.dataset.file });
  });

  updateProgress();

  // ---------- восстановление ----------
  if (saved.query) search.value = saved.query;
  applyFilter();
  markCurrent(CURRENT_FILE);
  if (!saved.query && saved.scroll) window.scrollTo(0, saved.scroll);   // вернуть позицию списка
  toTop.classList.toggle('show', window.scrollY > 200);
  search.focus();
})();
</script>
</body></html>`;
  }
}

function activate(context) {
  // Документация, вшитая в расширение (extension/docs) — fallback, если в проекте нет своей.
  if (context && context.extensionPath) BUNDLED_DOCS = path.join(context.extensionPath, 'docs');
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
    // Плавающее окно: подключить / отключить / проверить.
    // Прямой патч оболочки, без стороннего загрузчика (ensureWindowImport/
    // removeWindowImport оставлены как совместимость со старым способом).
    vscode.commands.registerCommand('cppDocs.enableWindow', () => enableWindow(context)),
    vscode.commands.registerCommand('cppDocs.disableWindow', () => disableWindow(context)),
    vscode.commands.registerCommand('cppDocs.windowHealth', () => windowHealth(context))
  );

  // Всегда держим файл данных окна свежим при запуске: он нужен и окну, подключённому
  // через загрузчик, и авто-инъектору workbench.html (батник «Плавающее-окно.bat»),
  // который сам впечатывает данные + рантайм без стороннего загрузчика.
  try { writeDocsData(context); } catch (e) {}

  // Первый запуск: один раз предложим включить плавающее окно (прямой патч оболочки,
  // без стороннего загрузчика) — это основной способ читать доки поверх редактора.
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
}

function deactivate() {}

module.exports = {
  activate, deactivate, buildDocsData, findDocsRoot,
  // чистые хелперы инъекции — покрыты test/inject.js
  escapeScript, neutralizeCsp, buildWindowBlock, applyWindowInjection, stripWindowInjection,
};
