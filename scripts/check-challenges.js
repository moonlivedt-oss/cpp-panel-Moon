#!/usr/bin/env node
'use strict';

// Проверка интерактивных заданий документации — что ответы в тексте правдивы.
// check-code.js только собирает целые программы; здесь код ещё и ЗАПУСКАЕТСЯ:
//
//   ```challenge @type predict  — код собирается, а напечатанное совпадает с ответом (строго);
//   ```challenge @type parsons  — правильный порядок строк собирается (если фрагмент самодостаточен);
//   ```challenge @type run      — заготовка собирается; если есть эталон test/solutions/<файл>.<N>.cpp,
//                                 он проходит все тесты задания («\n» в тесте — перевод строки);
//   ```steps                    — номера строк в пределах кода, а накопленный «вывод» шагов совпадает
//                                 с настоящим (для фрагментов без ввода и случайности);
//   ```repeat                   — «Повтори за мной»: программа из @ref (examples/code/…) проходит
//                                 тесты в режиме contains (строки ожидаемого есть в выводе по порядку);
//   ```checkpoint               — эталон главы собирается без предупреждений (-Wall -Wextra -Werror).
//
// Фрагмент без main оборачивается: объявления верхнего уровня (функции, struct, enum…) — наверх,
// остальное — в main, плюс набор стандартных #include. Фрагмент, которому нужен контекст из текста
// (тип объявлен выше по файлу), не собирается — такие шаги/parsons считаем «без контекста» и не валим.
// Метка <!-- docs:no-run --> над блоком — явный отказ от проверки.
//
// Нужен g++ (как для check-code). Запуск:  node scripts/check-challenges.js [--verbose]
// Выход 1, если хоть одна проверка провалилась.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', 'docs');
const SOLUTIONS = path.join(__dirname, '..', 'test', 'solutions');
const CXX = process.env.CXX || 'g++';
const STD = process.env.CXXSTD || 'c++20';
const VERBOSE = process.argv.includes('--verbose');

const probe = spawnSync(CXX, ['--version'], { encoding: 'utf8' });
if (probe.error) {
  console.error('Не найден компилятор "' + CXX + '". Задай $CXX или добавь g++ в PATH.');
  console.error('Пропускаю проверку заданий (это не ошибка сборки).');
  process.exit(0);
}

const HEADERS = ['iostream', 'iomanip', 'string', 'string_view', 'vector', 'map', 'set', 'unordered_map',
  'algorithm', 'numeric', 'memory', 'optional', 'ranges', 'cmath', 'cstdlib', 'sstream', 'stdexcept',
  'utility', 'array', 'functional', 'limits', 'cctype', 'format', 'chrono', 'random', 'fstream', 'queue', 'deque', 'variant', 'atomic', 'thread', 'mutex', 'future', 'type_traits']
  .map((h) => '#include <' + h + '>').join('\n') + '\n';

function mdFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isSymbolicLink() || ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...mdFiles(p));
    else if (ent.name.toLowerCase().endsWith('.md')) out.push(p);
  }
  return out.sort();
}

/** Блоки ```challenge, ```steps, ```repeat, ```checkpoint: {kind, line, body[], noRun}. */
function blocks(content) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^```(challenge|steps|repeat|checkpoint)\s*$/);
    if (!m) continue;
    let j = i - 1;
    while (j >= 0 && lines[j].trim() === '') j--;
    const noRun = j >= 0 && /docs:no-run/.test(lines[j]);
    const body = [];
    let k = i + 1, id = '';
    while (k < lines.length && !/^```\s*$/.test(lines[k])) {
      const mid = lines[k].match(/^[ \t]*@id[ \t]+(\S+)/);
      if (mid) id = mid[1]; else body.push(lines[k]);   // постоянный ключ блока — не код
      k++;
    }
    out.push({ kind: m[1], line: i + 1, body, noRun, id });
    i = k;
  }
  return out;
}

// Строка верхнего уровня, с которой начинается объявление (а не оператор внутри main).
const STMT_RE = /^(return|if|for|while|else|do|switch|case|break|continue)\b/;
const DECL_RE = new RegExp('^(#include|#define|struct |class |template|enum |using |namespace |' +
  // функция: «тип имя(параметры) [const] [noexcept] [override] {» — без «=» до скобки (это не лямбда)
  '[A-Za-z_][\\w:<>,\\s*&]*[\\s*&]\\s*~?[A-Za-z_]\\w*\\s*\\([^;]*\\)\\s*(const\\s*)?(noexcept\\s*)?(override\\s*)?(->\\s*[\\w:<>]+\\s*)?\\{)');

/** Фрагмент → целая программа. */
// Контекст фрагмента: test/context/<@id>.cpp — то, что фрагмент берёт из текста выше (типы, функции,
// переменные). Строки до «// @main» идут наверх файла, после — в начало main. «// @function <сигнатура>»
// делает фрагмент телом этой функции (фрагмент с return). «// @skip причина» — фрагмент не программа
// (псевдокод, команда сборки): не собираем и не считаем «без контекста».
const CONTEXT = path.join(__dirname, '..', 'test', 'context');
function loadContext(id) {
  const f = id && path.join(CONTEXT, id + '.cpp');
  if (!f || !fs.existsSync(f)) return null;
  const ctx = { top: [], main: [], fn: '', skip: '' };
  let part = 'top';
  for (const ln of fs.readFileSync(f, 'utf8').replace(/\r\n?/g, '\n').split('\n')) {
    const d = ln.match(/^\s*\/\/\s*@(main|function|skip)\b\s*(.*)$/);
    if (d && d[1] === 'main') { part = 'main'; continue; }
    if (d && d[1] === 'function') { ctx.fn = d[2].trim(); continue; }
    if (d && d[1] === 'skip') { ctx.skip = d[2].trim() || 'пропущено'; continue; }
    ctx[part].push(ln);
  }
  return ctx;
}
function wrap(code, ctx) {
  const top0 = ctx ? ctx.top.join('\n') + '\n' : '';
  const main0 = ctx ? ctx.main.join('\n') + '\n' : '';
  if (ctx && ctx.fn) return HEADERS + top0 + ctx.fn + ' {\n' + code + '\n}\nint main() {\n' + main0 + '}\n';
  if (/\bint\s+main\s*\(/.test(code)) return HEADERS + top0 + code;
  const top = [], body = [];
  let depth = 0, inTop = false;
  for (const s of code.split('\n')) {
    if (depth === 0) inTop = !/^\s/.test(s) && !STMT_RE.test(s) && DECL_RE.test(s);
    (inTop ? top : body).push(s);
    depth += (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
    if (depth <= 0) { depth = 0; inTop = false; }
  }
  return HEADERS + top0 + top.join('\n') + '\nint main() {\n' + main0 + body.join('\n') + '\n}\n';
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cppdocs-ch-'));
let seq = 0;
function build(src, extra) {
  const n = ++seq;
  const cpp = path.join(tmpDir, 'c' + n + '.cpp');
  const exe = path.join(tmpDir, 'c' + n + (process.platform === 'win32' ? '.exe' : ''));
  fs.writeFileSync(cpp, src, 'utf8');
  const r = spawnSync(CXX, ['-std=' + STD, '-w'].concat(extra || [], [cpp, '-o', exe]), { encoding: 'utf8' });
  const err = (r.stderr || '').split('\n').filter((l) => /error/.test(l)).slice(0, 3)
    .map((l) => l.replace(cpp, '<код>')).join('\n');
  return r.status === 0 ? { exe, src } : { error: err || 'сборка не удалась' };
}
// Антивирус (у автора — Kaspersky) иногда блокирует свежий MinGW-exe во временной папке: запуск
// падает с EPERM/EACCES/EBUSY. Это не ошибка задания: пересобираем с другими флагами (другой двоичный
// файл) и пробуем снова; если заблокирован и он — предупреждение, а не провал.
const blocked = [];
function run(b, input) {
  const once = (exe) => spawnSync(exe, [], { encoding: 'utf8', input: input || '', timeout: 5000 });
  let r = once(b.exe);
  if (r.error && /EPERM|EACCES|EBUSY/.test(r.error.code || r.error.message) && b.src) {
    if (!b.alt) b.alt = build(b.src, ['-O2', '-s']);
    if (b.alt.exe) r = once(b.alt.exe);
    if (r.error && /EPERM|EACCES|EBUSY/.test(r.error.code || r.error.message)) return { blocked: true };
  }
  if (r.error || r.status === null) return { error: r.error ? String(r.error.message) : 'превышено время' };
  return { out: r.stdout || '' };
}
const flat = (s) => String(s).replace(/\r/g, '').replace(/\s+/g, ' ').trim();
// Как normRunOut в extension/lib/run.js: хвостовые пробелы и пустые строки в конце не важны.
const normRun = (s) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').split('\n')
  .map((l) => l.replace(/\s+$/g, '').replace(/[ \t]+/g, ' ').replace(/^\s+/, '')).join('\n').replace(/\n+$/g, '');

function sections(body) {
  const secs = [[]];
  for (const s of body) { if (/^\s*---\s*$/.test(s)) secs.push([]); else secs[secs.length - 1].push(s); }
  return secs;
}

// Как outputMatches в extension/lib/run.js (режим contains): каждая строка ожидаемого — часть
// какой-то строки вывода, по порядку, без учёта регистра.
function containsInOrder(got, want) {
  const have = normRun(got).split('\n');
  let j = 0;
  for (const w of normRun(want).split('\n').filter((l) => l.trim())) {
    const lw = w.toLowerCase();
    while (j < have.length && have[j].toLowerCase().indexOf(lw) === -1) j++;
    if (j >= have.length) return false;
    j++;
  }
  return true;
}

const failures = [];
const stats = { predict: 0, parsons: 0, run: 0, runSolved: 0, runNoSol: [], ctxSkip: 0, steps: 0, stepsRun: 0, noCtx: 0, skipped: 0, repeat: 0, checkpoint: 0 };
function fail(where, msg) { failures.push(where + '\n      ' + msg.replace(/\n/g, '\n      ')); }
function note(where, msg) { if (VERBOSE) console.log('  · ' + where + ' — ' + msg); }

for (const file of mdFiles(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let runIdx = 0;
  for (const b of blocks(fs.readFileSync(file, 'utf8'))) {
    const where = rel + ':' + b.line;
    if (b.kind === 'repeat') {
      stats.repeat++;
      const ref = (b.body.find((x) => /^\s*@ref\s/.test(x)) || '').replace(/^\s*@ref\s+/, '').trim();
      if (!ref) { fail(where + ' [повтори за мной]', 'нет строки @ref <файл эталона>'); continue; }
      const refFile = path.join(path.dirname(file), ref);
      if (!fs.existsSync(refFile)) { fail(where + ' [повтори за мной]', 'нет файла ' + ref); continue; }
      const sol = build(fs.readFileSync(refFile, 'utf8'));
      if (sol.error) { fail(where + ' [повтори за мной]', ref + ' не собирается:\n' + sol.error); continue; }
      const tests = sections(b.body)[1] || [];
      if (!tests.some((t) => t.indexOf('=>') >= 0)) fail(where + ' [повтори за мной]', 'нет тестов «ввод => вывод»');
      for (const t of tests) {
        const x = t.replace(/\s+$/, '');
        if (!x.trim() || x.trim()[0] === '#' || x.indexOf('=>') < 0) continue;
        const idx = x.indexOf('=>');
        const input = x.slice(0, idx).trim().replace(/\\n/g, '\n');
        const want = x.slice(idx + 2).trim().replace(/\\n/g, '\n');
        const o = run(sol, input);
        if (o.blocked) { blocked.push(where); break; }
        if (o.error) fail(where + ' [повтори за мной]', JSON.stringify(input) + ' → ' + o.error);
        else if (!containsInOrder(o.out, want)) fail(where + ' [повтори за мной]', 'вход ' + JSON.stringify(input) + ': в выводе нет ' + JSON.stringify(normRun(want)) + '\n вывод: ' + JSON.stringify(normRun(o.out).slice(0, 400)));
      }
      continue;
    }
    if (b.kind === 'checkpoint') {
      stats.checkpoint++;
      const secs = sections(b.body);
      const code = secs.slice(1).map((x) => x.join('\n')).join('\n---\n').replace(/^\n+|\n+$/g, '');
      if (!code) { fail(where + ' [контрольная точка]', 'нет кода эталона после ---'); continue; }
      const r = build(code, ['-Wall', '-Wextra', '-Werror']);
      if (r.error) fail(where + ' [контрольная точка]', 'эталон не собирается без предупреждений:\n' + r.error);
      continue;
    }
    if (b.kind === 'challenge') {
      const type = ((b.body.find((s) => /^@type\s/.test(s)) || '').split(/\s+/)[1] || 'parsons');
      const secs = sections(b.body);
      const code = (secs[1] || []).join('\n').replace(/^\n+|\n+$/g, '');
      if (type === 'run') runIdx++;
      if (b.noRun) { stats.skipped++; continue; }
      if (type === 'predict') {
        stats.predict++;
        const r = build(wrap(code));
        if (r.error) { fail(where + ' [предскажи вывод]', 'не собирается:\n' + r.error); continue; }
        const o = run(r);
        const want = flat((secs[2] || []).join('\n'));
        if (o.blocked) { blocked.push(where); continue; }
        if (o.error) fail(where + ' [предскажи вывод]', 'запуск: ' + o.error);
        else if (flat(o.out) !== want) fail(where + ' [предскажи вывод]', 'в тексте: ' + JSON.stringify(want) + '\n на деле:  ' + JSON.stringify(flat(o.out)));
      } else if (type === 'run') {
        stats.run++;
        const starter = build(code);
        if (starter.error) fail(where + ' [напиши и запусти]', 'заготовка не собирается:\n' + starter.error);
        // Эталон: 4-я секция блока (ученик видит её после подсказок), иначе — test/solutions/ (скрытый,
        // для заданий «без готовых решений», как квесты «Подземелья»).
        const inlineSol = (secs[3] || []).join('\n').replace(/^\n+|\n+$/g, '');
        const solFile = path.join(SOLUTIONS, rel.replace(/\.md$/, '') + '.' + runIdx + '.cpp');
        const hasFile = fs.existsSync(solFile);
        if (!inlineSol && !hasFile) { stats.runNoSol.push(where); note(where, 'нет эталона ' + path.relative(SOLUTIONS, solFile)); continue; }
        if (inlineSol && hasFile) fail(where + ' [эталон]', 'эталон и в блоке, и в ' + path.relative(SOLUTIONS, solFile) + ' — оставь один');
        stats.runSolved++;
        const sol = build(inlineSol || fs.readFileSync(solFile, 'utf8'));
        if (sol.error) { fail(where + ' [эталон]', (inlineSol ? 'эталон в блоке' : path.relative(SOLUTIONS, solFile)) + ' не собирается:\n' + sol.error); continue; }
        for (const t of (secs[2] || [])) {
          const s = t.replace(/\s+$/, '');
          if (!s.trim() || s.trim()[0] === '#' || s.indexOf('=>') < 0) continue;
          const idx = s.indexOf('=>');
          const input = s.slice(0, idx).trim().replace(/\\n/g, '\n');
          const want = s.slice(idx + 2).trim().replace(/\\n/g, '\n');
          const o = run(sol, input);
          if (o.blocked) { blocked.push(where); break; }
          if (o.error) fail(where + ' [тест]', JSON.stringify(input) + ' → ' + o.error);
          else if (normRun(o.out) !== normRun(want)) fail(where + ' [тест]', 'вход ' + JSON.stringify(input) + ': ждём ' + JSON.stringify(normRun(want)) + ', эталон даёт ' + JSON.stringify(normRun(o.out)));
        }
      } else {
        stats.parsons++;
        const ctx = loadContext(b.id);
        if (ctx && ctx.skip) { stats.ctxSkip++; note(where, 'пропуск: ' + ctx.skip); continue; }
        const r = build(wrap(code, ctx));
        if (r.error && ctx) fail(where + ' [собери код]', 'не собирается даже с контекстом test/context/' + b.id + '.cpp:\n' + r.error);
        else if (r.error) { stats.noCtx++; note(where, 'parsons без контекста: ' + r.error.split('\n')[0]); }
      }
    } else {
      stats.steps++;
      if (b.noRun) { stats.skipped++; continue; }
      const k = b.body.findIndex((s) => /^\s*---\s*$/.test(s));
      if (k < 0) { fail(where + ' [по шагам]', 'нет разделителя --- между кодом и шагами'); continue; }
      const codeLines = b.body.slice(0, k);
      if (/^\s*#\s+/.test(codeLines[0] || '')) codeLines.shift();
      while (codeLines.length && !codeLines[0].trim()) codeLines.shift();
      while (codeLines.length && !codeLines[codeLines.length - 1].trim()) codeLines.pop();
      let out = '';
      for (const ln of b.body.slice(k + 1)) {
        if (!ln.trim()) continue;
        const f = ln.split('|').map((x) => x.trim());
        const n = parseInt(f[0].replace(/^\?/, ''), 10);
        if (!(n >= 1 && n <= codeLines.length)) fail(where + ' [по шагам]', 'строка ' + f[0] + ' вне кода (в нём ' + codeLines.length + ' строк): ' + ln.slice(0, 80));
        const o = f.slice(3).join('|');
        if (o) out += o.replace(/\\n/g, '\n');
      }
      const code = codeLines.join('\n');
      if (/std::cin|getline|rand\(|<random>|mt19937|random_device|chrono|fstream|_getch/.test(code)) { note(where, 'шаги с вводом/случайностью — вывод не сверяю'); continue; }
      const ctx = loadContext(b.id);
      if (ctx && ctx.skip) { stats.ctxSkip++; note(where, 'пропуск: ' + ctx.skip); continue; }
      const r = build(wrap(code, ctx));
      if (r.error && ctx) { fail(where + ' [по шагам]', 'не собирается даже с контекстом test/context/' + b.id + '.cpp:\n' + r.error); continue; }
      if (r.error) { stats.noCtx++; note(where, 'шаги без контекста: ' + r.error.split('\n')[0]); continue; }
      stats.stepsRun++;
      const o = run(r);
      if (o.blocked) { blocked.push(where); continue; }
      if (o.error) continue;   // намеренное UB/падение в демонстрации — не наш случай для сверки
      if (/неопредел|UB\b/i.test(b.body.join('\n'))) continue;
      if (flat(o.out) !== flat(out)) fail(where + ' [по шагам]', 'вывод в шагах: ' + JSON.stringify(flat(out)) + '\n на деле:       ' + JSON.stringify(flat(o.out)));
    }
  }
}

try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* не критично */ }

const summary = 'предскажи вывод ' + stats.predict + ', собери код ' + stats.parsons + ', напиши и запусти ' + stats.run +
  ' (с эталоном ' + stats.runSolved + '), по шагам ' + stats.steps + ' (вывод сверен у ' + stats.stepsRun + ')' +
  (stats.repeat ? ', повтори за мной ' + stats.repeat : '') + (stats.checkpoint ? ', контрольных точек ' + stats.checkpoint : '') +
  (stats.noCtx ? ', без контекста ' + stats.noCtx : '') + (stats.ctxSkip ? ', не программа ' + stats.ctxSkip : '') + (stats.skipped ? ', docs:no-run ' + stats.skipped : '');
if (blocked.length) {
  console.warn('Внимание: антивирус не дал запустить собранную программу (' + [...new Set(blocked)].join(', ') +
    ') — эти проверки пропущены. Добавь временную папку в исключения антивируса.');
}
if (!failures.length) {
  console.log('Задания: ответы сходятся с настоящим выводом — ' + summary + '.');
  process.exit(0);
}
console.error('Задания: расхождений ' + failures.length + ' (' + summary + '):\n');
for (const f of failures) console.error('  ' + f + '\n');
process.exit(1);
