#!/usr/bin/env node
'use strict';

// Проверка внутренних ссылок в документации.
// Ловит две беды: ссылка на несуществующий файл и ссылка на несуществующий
// якорь (#заголовок). Якоря считаются ТЕМ ЖЕ slugify, что и в рантайме окна
// (extension/cpp-docs-runtime.js), иначе проверка врала бы.
//
// Запуск:  node scripts/check-links.js  [корень, по умолчанию docs]
// Выход 1, если есть битые ссылки — годится для npm run check и CI.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'docs'));

/** Точная копия slugify из cpp-docs-runtime.js — держать синхронно с ним. */
function slugify(text) {
  return String(text)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} \-_]/gu, '')
    .replace(/ /g, '-');
}

/** Все .md-файлы под dir (рекурсивно), симлинки не разворачиваем. */
function mdFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isSymbolicLink()) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      out.push(...mdFiles(p));
    } else if (ent.name.toLowerCase().endsWith('.md')) {
      out.push(p);
    }
  }
  return out;
}

/** Набор slug'ов заголовков файла — как их проставит рантайм (первый # пропущен). */
const slugCache = new Map();
function headingSlugs(file) {
  if (slugCache.has(file)) return slugCache.get(file);
  const slugs = new Set();
  let inFence = false;
  let sawTitle = false;
  let content = '';
  try { content = fs.readFileSync(file, 'utf8'); } catch (e) { slugCache.set(file, slugs); return slugs; }
  for (const raw of content.split('\n')) {
    const s = raw.replace(/^\s*(?:>\s?)+/, ''); // снять маркеры цитаты: `> ```cpp` — тоже ограда
    const fence = s.match(/^(```+|~~~+)/);
    if (fence) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h = s.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!h) continue;
    if (h[1].length === 1 && !sawTitle) { sawTitle = true; continue; } // имя файла — без id
    slugs.add(slugify(h[2]));
  }
  slugCache.set(file, slugs);
  return slugs;
}

/** Убрать инлайн-код `...`, чтобы `v[i](x)` в тексте не приняли за ссылку. */
function stripInlineCode(line) { return line.replace(/`[^`]*`/g, ''); }

const problems = [];
const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

for (const file of mdFiles(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let inFence = false;
  lines.forEach((raw, idx) => {
    const s = raw.replace(/^\s*(?:>\s?)+/, ''); // цитата не мешает: `> ```cpp` — ограда кода
    const fence = s.match(/^(```+|~~~+)/);
    if (fence) { inFence = !inFence; return; }
    if (inFence) return;
    const line = stripInlineCode(s);
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(line)) !== null) {
      let target = m[1].trim().replace(/^<|>$/g, '');
      target = target.replace(/\s+["'].*$/, ''); // убрать необязательный "title"
      if (!target) continue;
      if (/^(https?:|mailto:|tel:|data:)/i.test(target)) continue;

      const hashAt = target.indexOf('#');
      const filePart = hashAt === -1 ? target : target.slice(0, hashAt);
      const anchor = hashAt === -1 ? '' : target.slice(hashAt + 1);

      let targetFile = file;
      if (filePart) {
        targetFile = path.resolve(path.dirname(file), decodeURIComponent(filePart));
        if (!fs.existsSync(targetFile)) {
          problems.push({ rel, line: idx + 1, target, why: 'нет файла' });
          continue;
        }
      }
      if (anchor && targetFile.toLowerCase().endsWith('.md')) {
        const slugs = headingSlugs(targetFile);
        if (!slugs.has(anchor.toLowerCase())) {
          problems.push({ rel, line: idx + 1, target, why: 'нет якоря #' + anchor });
        }
      }
    }
  });
}

if (problems.length === 0) {
  const count = mdFiles(ROOT).length;
  console.log('Ссылки: все внутренние ссылки целы (' + count + ' файлов).');
  process.exit(0);
}

console.error('Битые ссылки (' + problems.length + '):\n');
let last = '';
for (const p of problems) {
  if (p.rel !== last) { console.error('  ' + p.rel); last = p.rel; }
  console.error('    :' + p.line + '  [..](' + p.target + ')  — ' + p.why);
}
process.exit(1);
