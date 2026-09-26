// Документация на диске: где лежит папка docs, как читаются .md-файлы (название, описание,
// разделы, время чтения) и как они раскладываются по группам. Всё — чистое чтение файлов,
// поэтому этот же модуль используют превью (scripts/preview*.js) и тесты.

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Потолок объёма: доки попадают инлайном в привилегированную оболочку workbench.html;
// без лимита огромная папка раздула бы её и повесила старт редактора (локальный DoS).
const MAX_DOC_BYTES = 512 * 1024;             // один файл в окно
const MAX_TOTAL_DOC_BYTES = 8 * 1024 * 1024;  // суммарно на все материалы

const INDEX_FILE = '00-НАЧНИ-ОТСЮДА.md';
// Доки, вшитые в расширение (extension/docs) — fallback, когда у пользователя нет своей папки docs.
let BUNDLED_DOCS = null;
function setBundledDocs(dir) { BUNDLED_DOCS = dir || null; }
function bundledDocs() { return BUNDLED_DOCS; }

const RECENT_LIMIT = 4;
const FRESH_MS = 24 * 60 * 60 * 1000;   // «недавно изменён» — за последние сутки

/** Доверяем ли воркспейсу. Контент доков идёт в привилегированную оболочку, поэтому в
 *  недоверенной папке читаем только вшитую документацию, игнорируя docs/ проекта и cppDocs.path.
 *  isTrusted === undefined (старый VS Code / тест) считаем доверием. */
function workspaceTrusted() {
  try { return !(vscode.workspace && vscode.workspace.isTrusted === false); } catch (e) { return true; }
}

function findDocsRoot() {
  if (workspaceTrusted()) {
    const folders = vscode.workspace.workspaceFolders || [];
    for (const folder of folders) {
      const candidate = path.join(folder.uri.fsPath, 'docs');
      if (fs.existsSync(path.join(candidate, INDEX_FILE))) return candidate;
      if (fs.existsSync(path.join(folder.uri.fsPath, INDEX_FILE))) return folder.uri.fsPath;
    }
    const conf = vscode.workspace.getConfiguration('cppDocs');
    const configured = conf.get('path');
    // Путь из настройки принимаем, только если там реально папка с доками.
    if (configured && fs.existsSync(path.join(configured, INDEX_FILE))) return configured;
    // Список путей cppDocs.paths — берём первый, где реально лежит документация. Позволяет
    // держать несколько возможных папок (разные машины/проекты), не переписывая cppDocs.path.
    const extra = conf.get('paths');
    if (Array.isArray(extra)) {
      for (const p of extra) {
        if (typeof p === 'string' && p && fs.existsSync(path.join(p, INDEX_FILE))) return p;
      }
    }
  }
  // Fallback — вшитая документация (работает без проекта и в недоверенной папке).
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
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return []; }
  // Симлинки НЕ разворачиваем: увели бы чтение за пределы корня (утечка в вшиваемый контент).
  const names = ents
    .filter((d) => !d.isSymbolicLink() && d.isFile() && d.name.toLowerCase().endsWith('.md'))
    .map((d) => d.name)
    .sort();
  names.sort((a, b) => {
    const ra = a.toLowerCase().startsWith('readme') ? 0 : 1;
    const rb = b.toLowerCase().startsWith('readme') ? 0 : 1;
    return ra - rb;
  });
  return names.map((n) => path.join(dir, n));
}

/** Текст файла для поиска (первые 6 КБ, без разметки): чтобы находить по содержимому, а не
 *  только по названию. Регистр сохраняем — из этого текста вырезается фрагмент-контекст. */
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

/** Якорь заголовка — как slugify в рантайме окна (runtime/01-utils-stickers.js) и в check-links.js. */
function slugify(text) {
  return String(text)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} \-_]/gu, '')
    .replace(/ /g, '-');
}

/** Индекс поиска окна: проза материала по разделам (## / ###) — без блоков кода и разметки.
 *  → [{ s: якорь раздела ('' — до первого заголовка), t: заголовок, x: строки текста через \n }].
 *  Считается здесь, при сборке данных, а не в окне на каждое нажатие клавиши. */
function searchSections(md) {
  const out = [];
  let cur = { s: '', t: '', x: [] }, inFence = false;
  for (const ln of String(md || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (ln.trim().slice(0, 3) === '```') { inFence = !inFence; continue; }
    if (inFence) continue;
    const hm = ln.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (hm) {
      if (cur.x.length || cur.s) out.push(cur);
      cur = { s: slugify(hm[2]), t: hm[2].replace(/[`*]/g, '').trim(), x: [] };
      continue;
    }
    // НЕ трогаем _: он важен для идентификаторов (push_back)
    const plain = ln.replace(/<[^>]+>/g, ' ').replace(/[#>*`|[\]()]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (plain) cur.x.push(plain);
  }
  if (cur.x.length || cur.s) out.push(cur);
  return out.map((c) => ({ s: c.s, t: c.t, x: c.x.join('\n') }));
}

/** Прикидка времени чтения: слова прозы (без блоков кода) при ~150 слов/мин. */
function estimateMinutes(content) {
  const prose = content.replace(/```[\s\S]*?```/g, ' ');
  const words = (prose.match(/\S+/g) || []).length;
  return Math.max(1, Math.round(words / 150));
}

// Кэш разбора файла по mtime: пока файл не менялся — не перечитываем и не разбираем заново.
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
    '09-itogovye-proverki.md',
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
    ['zametki', 'Мои заметки', '#4ec9b0'],
    ['ref', 'Справочник по темам', 'var(--vscode-charts-purple, #b180d7)'],
    ['proekt', 'Сквозной проект', '#f9e2af'],
    ['igry', 'Создание игр', '#fab387'],
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
  let totalBytes = 0;
  for (const g of groups) {
    for (const it of g.items) {
      if (seen.has(it.file)) continue;
      seen.add(it.file);
      let md = '';
      try {
        // Симлинки не читаем (вне корня); большой файл обрезаем; за общим потолком — тело не тащим.
        const st = fs.lstatSync(it.file);
        if (st.isSymbolicLink()) { md = ''; }
        else if (totalBytes >= MAX_TOTAL_DOC_BYTES) { md = '\n> _Материал не показан в окне: превышен общий лимит объёма._\n'; }
        else {
          // Лимиты — в байтах (кириллица в UTF-8 — 2 байта на букву; md.length считал бы символы).
          const buf = fs.readFileSync(it.file);
          md = buf.length > MAX_DOC_BYTES
            ? buf.subarray(0, MAX_DOC_BYTES).toString('utf8').replace(/\uFFFD+$/, '') + '\n\n> _…материал обрезан: файл больше ' + Math.round(MAX_DOC_BYTES / 1024) + ' КБ._\n'
            : buf.toString('utf8');
          totalBytes += Math.min(buf.length, MAX_DOC_BYTES);
        }
      } catch (e) { md = ''; }
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
        sx: searchSections(md),   // индекс поиска окна (проза по разделам)
      });
    }
  }
  return { root: String(root).replace(/\\/g, '/'), indexFile: INDEX_FILE, generatedAt: Date.now(), files: files };
}

module.exports = {
  INDEX_FILE, MAX_DOC_BYTES, RECENT_LIMIT,
  setBundledDocs, bundledDocs, workspaceTrusted, findDocsRoot,
  collectGroups, buildDocsData, searchSections, slugify,
};
