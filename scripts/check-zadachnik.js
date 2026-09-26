#!/usr/bin/env node
'use strict';

// Задачник: КАЖДОЕ решение из «Решения с разбором» (основное и «Другой подход») собирается
// с -Wall -Wextra без предупреждений и проходит тесты своей задачи (```tests у задачи наверху).
// Запуск: npm run check:zadachnik (нужен g++). Выход 1 при любом расхождении.
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const D = path.join(__dirname, '..', 'docs', 'zadachnik') + path.sep;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zad3-'));
const norm = (s) => String(s).replace(/\r/g, '').split('\n').map((l) => l.trim().replace(/[ \t]+/g, ' ')).join('\n').replace(/^\n+|\n+$/g, '');
let programs = 0, pass = 0, fails = 0, notest = 0, n = 0;
for (const fn of fs.readdirSync(D).filter((f) => /^0[1-8]-/.test(f))) {
  const s = fs.readFileSync(D + fn, 'utf8').replace(/\r/g, '');
  const tests = {};
  for (const h of s.matchAll(/^## (\d+\.\d+)\. [\s\S]*?(?=^## \d|^# [А-ЯЁ])/gm)) {
    const t = h[0].match(/```tests\n([\s\S]*?)\n```/);
    if (t) tests[h[1]] = t[1].split('\n').filter((l) => l.trim() && l.trim()[0] !== '#' && l.includes('=>'))
      .map((l) => { const k = l.indexOf('=>'); return [l.slice(0, k).trim().replace(/\\n/g, '\n'), l.slice(k + 2).trim().replace(/\\n/g, '\n')]; });
  }
  for (const m of s.matchAll(/<summary>Полное решение (\d+\.\d+) — [^<]*<\/summary>([\s\S]*?)<\/details>/g)) {
    const codes = [...m[2].matchAll(/```(?:cpp|c\+\+)\n([\s\S]*?)\n```/g)].map((x) => x[1]).filter((x) => /int\s+main/.test(x));
    for (const code of codes) {
      programs++;
      const ts = tests[m[1]];
      const cf = path.join(tmp, 'p' + (++n) + '.cpp'), ex = cf.replace('.cpp', '.exe');
      fs.writeFileSync(cf, code);
      const c = spawnSync('g++', ['-std=c++20', '-Wall', '-Wextra', '-O2', '-s', cf, '-o', ex], { encoding: 'utf8' });
      if (c.status !== 0 || /warning:/.test(c.stderr)) { fails++; console.log('BUILD', fn, m[1], (c.stderr.match(/(warning|error):.*/) || [''])[0]); continue; }
      if (!ts) { notest++; continue; }
      let ok = true;
      for (const [inp, want] of ts) {
        let r = spawnSync(ex, [], { input: inp, encoding: 'utf8', timeout: 5000 });
        for (const flags of [['-O0'], ['-O1', '-g']]) {           // антивирус блокирует/держит свежий exe (EPERM/EACCES/EBUSY) — пересобираем иначе
          if (!(r.error && /EPERM|EACCES|EBUSY/.test(r.error.code))) break;
          const ex2 = ex.replace('.exe', flags.join('') + '.exe');
          spawnSync('g++', ['-std=c++20', ...flags, cf, '-o', ex2]);
          r = spawnSync(ex2, [], { input: inp, encoding: 'utf8', timeout: 5000 });
        }
        if (r.error) { ok = false; console.log('RUN', fn, m[1], String(r.error.code || r.error)); break; }
        const got = norm(r.stdout), w = norm(want);
        if (!(got === w || got.endsWith(w))) { ok = false; console.log('MISMATCH', fn, m[1], JSON.stringify(inp), 'want', JSON.stringify(w), 'got', JSON.stringify(got.slice(-80))); }
      }
      if (ok) pass++; else fails++;
    }
  }
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* не критично */ }
console.log('Задачник: решений ' + programs + ', прошли тесты ' + pass + ', только сборка (у задачи нет тестов) ' + notest + (fails ? ', ОШИБОК ' + fails : '') + '.');
process.exit(fails ? 1 : 0);
