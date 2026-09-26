#!/usr/bin/env node
'use strict';

// Ставит постоянный ключ «@id …» в блоки ```challenge, ```steps и ```boss документации.
//
// Зачем: окно запоминает «решено»/«пройдено»/«босс побеждён» по ключу блока. Без @id ключ —
// хэш текста, и любая правка (опечатка, подсказка) сбрасывала бы прогресс учеников.
// Ключ берётся из САМОГО рантайма: файл рендерится настоящим cpp-docs-runtime.js, и из HTML
// читаются data-id блоков. Так @id гарантированно равен тому, что уже лежит в прогрессе.
//
// Блок, где @id уже есть, не трогается. Задачник 01–03 не трогается никогда (там идут занятия).
//
// Запуск:  node scripts/stamp-ids.js          — проставить
//          node scripts/stamp-ids.js --check  — только проверить, что у всех блоков есть @id (для CI)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'docs');
const RUNTIME = path.join(__dirname, '..', 'extension', 'cpp-docs-runtime.js');
const CHECK = process.argv.includes('--check');
const FROZEN = /^zadachnik\/0[1-3]-/;          // задачник тем 1–3 не правим

// --- минимальный DOM, чтобы рантайм загрузился и отдал window.__cppDocs.render ---
function el() {
  return {
    style: {}, dataset: {}, children: [], classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, appendChild(c) { return c; }, removeChild() {},
    remove() {}, addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    insertBefore(c) { return c; }, innerHTML: '', textContent: '', id: '',
  };
}
function loadRuntime() {
  global.document = {
    readyState: 'loading', head: el(), body: el(), documentElement: el(), createElement: el,
    createTextNode(t) { return { textContent: t }; }, getElementById() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {},
  };
  global.window = {
    __CPPDOCS__: null, __CPPDOCS_BOOT__: null, addEventListener() {}, removeEventListener() {},
    setInterval() { return 0; }, clearInterval() {}, setTimeout() { return 0; }, clearTimeout() {},
    matchMedia() { return { matches: false, addEventListener() {} }; }, navigator: { userAgent: 'node' },
  };
  global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  global.getComputedStyle = () => ({ getPropertyValue: () => '' });
  global.MutationObserver = function () { return { observe() {}, disconnect() {} }; };
  global.setInterval = () => 0; global.clearInterval = () => {}; global.setTimeout = () => 0; global.clearTimeout = () => {};
  (0, eval)(fs.readFileSync(RUNTIME, 'utf8'));
  return global.window.__cppDocs;
}

function mdFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...mdFiles(p));
    else if (ent.name.endsWith('.md')) out.push(p);
  }
  return out.sort();
}

/** Блоки в порядке появления: {kind, open (индекс строки ограды), hasId}. */
function fences(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^```(challenge|steps|boss)\s*$/);
    if (!m) continue;
    let j = i + 1, hasId = false;
    for (; j < lines.length && !/^```\s*$/.test(lines[j]); j++) if (/^[ \t]*@id[ \t]+\S/.test(lines[j])) hasId = true;
    out.push({ kind: m[1], open: i, hasId });
    i = j;
  }
  return out;
}

/** data-id блоков из HTML в порядке появления, по видам. */
function renderedIds(html) {
  const ids = { challenge: [], steps: [], boss: [] };
  const re = /<div class="(cd-steps|cd-boss|cd-ch cd-ch-[a-z]+[^"]*)"[^>]*?data-id="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const kind = m[1] === 'cd-steps' ? 'steps' : m[1] === 'cd-boss' ? 'boss' : 'challenge';
    ids[kind].push(m[2]);
  }
  return ids;
}

const api = loadRuntime();
let stamped = 0, missing = 0, problems = 0;
for (const file of mdFiles(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (FROZEN.test(rel)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  const fs_ = fences(lines);
  if (!fs_.length) continue;
  const todo = fs_.filter((f) => !f.hasId);
  if (!todo.length) continue;
  if (CHECK) { missing += todo.length; todo.forEach((f) => console.error('  нет @id: ' + rel + ':' + (f.open + 1) + ' (' + f.kind + ')')); continue; }

  const ids = renderedIds(api.render(src));
  const byKind = { challenge: [], steps: [], boss: [] };
  fs_.forEach((f) => byKind[f.kind].push(f));
  let ok = true;
  for (const k of Object.keys(byKind)) {
    if (byKind[k].length !== ids[k].length) {
      console.error('  ! ' + rel + ': блоков ' + k + ' в тексте ' + byKind[k].length + ', в рендере ' + ids[k].length + ' — файл пропущен');
      ok = false;
    }
  }
  if (!ok) { problems++; continue; }
  // Вставляем снизу вверх, чтобы индексы строк не съезжали.
  const inserts = [];
  for (const k of Object.keys(byKind)) byKind[k].forEach((f, n) => { if (!f.hasId) inserts.push({ f, id: ids[k][n] }); });
  inserts.sort((a, b) => b.f.open - a.f.open);
  for (const { f, id } of inserts) {
    // у босса первая строка — «# Название», @id ставим после неё; у остальных — первой строкой блока
    const at = f.kind === 'boss' && /^#\s/.test(lines[f.open + 1] || '') ? f.open + 2 : f.open + 1;
    lines.splice(at, 0, '@id ' + id);
    stamped++;
  }
  fs.writeFileSync(file, lines.join(eol), 'utf8');
  console.log('  ' + rel + ': +' + inserts.length);
}

if (CHECK) {
  if (missing) { console.error('Блоков без @id: ' + missing + '. Запусти: node scripts/stamp-ids.js'); process.exit(1); }
  console.log('@id: у всех заданий, разборов и боссов есть постоянный ключ.');
  process.exit(0);
}
console.log('Проставлено @id: ' + stamped + (problems ? ', файлов с расхождением: ' + problems : ''));
process.exit(problems ? 1 : 0);
