// ============================================================
//  «Напиши и запусти»: компиляция кода ученика и прогон по тестам.
//
//  Окно присылает запрос (код + тесты) мосту или вкладке и сразу получает ответ — без файлов.
//  Компиляция — здесь, в процессе расширения: команда компилятора приходит ТОЛЬКО из настройки
//  или автопоиска (не из запроса), всё под настройкой cppDocs.localRun (по умолчанию выключено).
//
//  Надёжность:
//    • очередь — одновременно собирается и работает одна программа (второе нажатие ждёт);
//    • кэш сборки по хэшу (компилятор + флаги + код): тот же код заново не компилируется;
//    • зависшая программа снимается ВМЕСТЕ с дочерними процессами (Windows: taskkill /T);
//    • вывод и stderr ограничены, таймауты жёсткие.
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const crypto = require('crypto');
const { log } = require('./log');
const { userSetting, localRunEnabled } = require('./storage');
const { MAX_CODE, MAX_TESTS, RUN_TIMEOUT_MS } = require('./protocol');

const COMPILE_TIMEOUT_MS = 20000;
const TEST_TIMEOUT_MS = 5000;
const MAX_OUT = 65536;          // символов stdout на тест
const MAX_ERR = 4096;           // символов stderr на тест (для «упало с ошибкой»)
const QUEUE_MAX = 3;            // ждущих запусков сверх текущего
// Общий бюджет одного «Запустить» (сборка + все тесты). Окно ждёт ответ RUN_TIMEOUT_MS — бюджет
// меньше него с запасом, чтобы ответ успел дойти, а не пропал вместе с занятой очередью.
const RUN_BUDGET_MS = Math.max(10000, RUN_TIMEOUT_MS - 8000);
const CACHE_KEEP = 20;          // собранных программ в кэше

// Компилятор ищем один раз: сначала настройка cppDocs.compiler, иначе автопоиск в PATH.
// undefined — ещё не искали; null — нет; {cmd,kind} — нашли. kind: 'msvc' (cl) или 'gcc' (g++/clang++).
let _compilerCache, _compilerWaiters = null;
function guessCompilerKind(cmd) { return /(^|[\\/])cl(\.exe)?$/i.test(String(cmd)) ? 'msvc' : 'gcc'; }
function resolveCompilerAsync(cb) {
  if (_compilerCache !== undefined) { cb(_compilerCache); return; }
  if (_compilerWaiters) { _compilerWaiters.push(cb); return; }   // поиск уже идёт — ждём его, а не запускаем второй
  let conf = '';
  try { conf = String(userSetting('compiler') || '').trim(); } catch (e) {}
  if (conf) { _compilerCache = { cmd: conf, kind: guessCompilerKind(conf), path: /[\\/]/.test(conf) ? conf : '' }; cb(_compilerCache); return; }
  _compilerWaiters = [cb];
  const done = (c) => { _compilerCache = c; const ws = _compilerWaiters; _compilerWaiters = null; ws.forEach((w) => { try { w(c); } catch (e) {} }); };
  const win = process.platform === 'win32';
  const names = win ? ['g++', 'clang++', 'cl'] : ['g++', 'clang++', 'c++'];
  const finder = win ? 'where' : 'which';
  let i = 0;
  const tryNext = () => {
    if (i >= names.length) { done(null); return; }
    const name = names[i++];
    try {
      cp.execFile(finder, [name], { timeout: 3000 }, (err, stdout) => {
        const found = !err && stdout ? String(stdout).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] : '';
        if (found) done({ cmd: name, kind: guessCompilerKind(name), path: found });
        else tryNext();
      });
    } catch (e) { tryNext(); }
  };
  tryNext();
}
/** Настройку cppDocs.compiler поменяли — при следующем запуске компилятор ищем заново. */
function resetCompilerCache() { _compilerCache = undefined; }

/** Снять процесс вместе с потомками. На Windows child.kill() убивает только сам процесс —
 *  программа ученика, запустившая свою (system("…")), осталась бы висеть. */
function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    try { cp.execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {}); return; } catch (e) { /* ниже — обычный kill */ }
  }
  try { child.kill('SIGKILL'); } catch (e) {}
}

// Прогон одного собранного exe со stdin и жёстким таймаутом; вывод ограничен.
// env — окружение (с каталогом компилятора в PATH, чтобы exe нашёл рантайм-DLL, напр. у MSYS2).
function runOneExe(exe, input, timeoutMs, env, cb) {
  let child, out = '', err = '', done = false;
  const finish = (r) => { if (done) return; done = true; clearTimeout(timer); killTree(child); r.err = err; cb(r); };
  // cwd — отдельная папка запуска: ofstream("out.txt") ученика ляжет туда, а не в каталог VS Code.
  let cwd;
  try { cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cppdocs-cwd-')); } catch (e) { cwd = os.tmpdir(); }
  const cleanup = () => { if (cwd !== os.tmpdir()) { try { fs.rmSync(cwd, { recursive: true, force: true }); } catch (e) {} } };
  const timer = setTimeout(() => finish({ timeout: true, out: out }), timeoutMs);
  try { child = cp.spawn(exe, [], { windowsHide: true, cwd: cwd, env: env || process.env }); }
  catch (e) { clearTimeout(timer); cleanup(); cb({ error: String(e) }); return; }
  // Программа может выйти, не дочитав stdin: EPIPE приходит событием 'error' на потоке — без
  // обработчика он уронил бы хост расширений. stderr читаем (иначе переполненный канал подвесит
  // программу), но храним только начало.
  child.stdin.on('error', () => {});
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => { if (err.length < MAX_ERR) err += d.slice(0, MAX_ERR - err.length); });
  child.stdout.setEncoding('utf8');   // декодер держит разрезанные на границе куска UTF-8 символы
  child.stdout.on('data', (d) => { out += d; if (out.length > MAX_OUT) { out = out.slice(0, MAX_OUT); finish({ out: out, truncated: true }); } });
  child.on('error', (e) => { cleanup(); finish({ error: String(e && e.message || e) }); });
  child.on('close', (code, signal) => { cleanup(); finish({ out: out, code: code, signal: signal || null }); });
  try { if (input != null) child.stdin.write(String(input)); } catch (e) {}
  try { child.stdin.end(); } catch (e) {}
}
/** Почему программа упала — простыми словами (код выхода Windows или сигнал Linux/macOS). '' — не упала. */
const CRASH_CODES = {
  3: 'аварийное завершение (abort): необработанное исключение или сработавший assert',
  0xC0000005: 'обращение к чужой памяти (выход за границы массива, разыменование nullptr или висячего указателя)',
  0xC00000FD: 'переполнение стека (скорее всего, бесконечная рекурсия)',
  0xC0000094: 'целочисленное деление на ноль',
  0xC0000409: 'аварийная остановка (порча стека или необработанное исключение)',
};
const CRASH_SIGNALS = {
  SIGSEGV: CRASH_CODES[0xC0000005], SIGBUS: CRASH_CODES[0xC0000005],
  SIGABRT: CRASH_CODES[3], SIGFPE: 'арифметическая ошибка (например, деление на ноль)',
};
function crashReason(r) {
  if (!r || r.timeout || r.error) return '';
  if (r.signal) return CRASH_SIGNALS[r.signal] || 'программу остановил сигнал ' + r.signal;
  if (r.code == null || r.code === 0) return '';
  const code = r.code < 0 ? r.code >>> 0 : r.code;   // Windows отдаёт NTSTATUS и как отрицательное число
  return CRASH_CODES[code] || 'main вернула код ' + r.code + ' (ожидали 0)';
}

// Нормализация вывода для сравнения: построчно trim + схлопывание пробелов, хвостовые пустые строки долой.
function normRunOut(s) {
  return String(s == null ? '' : s).replace(/\r\n?/g, '\n').split('\n')
    .map((l) => l.replace(/\s+$/g, '').replace(/[ \t]+/g, ' ').replace(/^\s+/, '')).join('\n').replace(/\n+$/g, '');
}

// ---- кэш сборки ----
function cacheDir() { return path.join(os.tmpdir(), 'cppdocs-build-cache'); }
function exeName() { return process.platform === 'win32' ? 'main.exe' : 'main'; }
function compileArgs(comp, src, exe) {
  // Стандарт — C++20, как во всём курсе: в заготовках есть std::format, <ranges>, starts_with.
  return comp.kind === 'msvc' ? ['/nologo', '/EHsc', '/utf-8', '/std:c++20', src, '/Fe:' + exe] : ['-std=c++20', '-O0', src, '-o', exe];
}
function pruneCache() {
  try {
    const dir = cacheDir();
    const items = fs.readdirSync(dir).map((n) => { const p = path.join(dir, n); let t = 0; try { t = fs.statSync(p).mtimeMs; } catch (e) {} return { p, t }; })
      .sort((a, b) => b.t - a.t);
    items.slice(CACHE_KEEP).forEach((x) => { try { fs.rmSync(x.p, { recursive: true, force: true }); } catch (e) {} });
  } catch (e) {}
}
/** Собрать код (или взять из кэша). cb({exe, env} | {error, stage}). */
/** Отпечаток компилятора: путь + размер + время изменения exe. Обновили g++ по тому же пути —
 *  отпечаток другой, и кэш не отдаст программу, собранную старой версией. */
function compilerStamp(comp) {
  const p = comp.path || (/[\\/]/.test(comp.cmd) ? comp.cmd : '');
  if (!p) return comp.cmd;
  try { const st = fs.statSync(p); return p + '|' + st.size + '|' + Math.round(st.mtimeMs); } catch (e) { return p; }
}
function compileCached(comp, code, cb, timeoutMs) {
  const key = crypto.createHash('sha256').update(compilerStamp(comp) + '\0' + compileArgs(comp, 'x', 'y').join(' ') + '\0' + code).digest('hex').slice(0, 24);
  const dir = path.join(cacheDir(), key);
  const exe = path.join(dir, exeName());
  const binDir = /[\\/]/.test(comp.cmd) ? path.dirname(comp.cmd) : '';
  // Каталог компилятора — в PATH: собранный exe (и сама сборка) найдут рантайм-DLL (MSYS2/UCRT64 и т.п.).
  const env = binDir ? Object.assign({}, process.env, { PATH: binDir + path.delimiter + (process.env.PATH || '') }) : process.env;
  if (fs.existsSync(exe)) {
    try { const now = new Date(); fs.utimesSync(dir, now, now); } catch (e) {}
    cb({ exe, env, cached: true }); return;
  }
  const work = dir + '.tmp-' + process.pid + '-' + Date.now();
  try { fs.mkdirSync(work, { recursive: true }); fs.writeFileSync(path.join(work, 'main.cpp'), code, 'utf8'); }
  catch (e) { cb({ stage: 'io', error: 'нет доступа к временной папке' }); return; }
  const wexe = path.join(work, exeName());
  const drop = () => { try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) {} };
  try {
    cp.execFile(comp.cmd, compileArgs(comp, path.join(work, 'main.cpp'), wexe),
      { timeout: Math.max(1000, Math.min(COMPILE_TIMEOUT_MS, timeoutMs || COMPILE_TIMEOUT_MS)), cwd: work, windowsHide: true, maxBuffer: 1 << 20, env },
      (err, stdout, stderr) => {
        if (err || !fs.existsSync(wexe)) {
          drop();
          cb({ stage: 'compile', compileError: String(stderr || stdout || (err && err.message) || 'сборка не удалась').slice(0, 4000) });
          return;
        }
        try { fs.renameSync(work, dir); } catch (e) {
          // параллельная сборка того же кода уже положила результат — берём её
          if (fs.existsSync(exe)) { drop(); } else { drop(); cb({ stage: 'io', error: String(e) }); return; }
        }
        pruneCache();
        cb({ exe, env, cached: false });
      });
  } catch (e) { drop(); cb({ stage: 'compile', compileError: String(e) }); }
}

/** Скомпилировать код и прогнать тесты. cb(результат для окна). */
/** Совпал ли вывод с ожидаемым. mode 'contains' — каждая ожидаемая строка встречается в выводе
 *  (по порядку, как часть строки): для «Повтори за мной», где подсказки ввода у ученика свои. */
function outputMatches(got, expected, mode) {
  if (mode !== 'contains') return normRunOut(got) === normRunOut(expected);
  const want = normRunOut(expected).split('\n').filter((l) => l.trim());
  const have = normRunOut(got).split('\n');
  let j = 0;
  for (const w of want) {
    const lw = w.toLowerCase();
    while (j < have.length && have[j].toLowerCase().indexOf(lw) === -1) j++;
    if (j >= have.length) return false;
    j++;
  }
  return true;
}

function runUserCode(req, cb) {
  // Срок ответа: от прихода запроса (время в очереди тоже считается), иначе окно не дождётся.
  const deadline = (req._t0 || Date.now()) + RUN_BUDGET_MS;
  const left = () => deadline - Date.now();
  resolveCompilerAsync((comp) => {
    if (!comp) { cb({ id: req.id, ok: false, stage: 'nocompiler' }); return; }
    if (left() < 1500) { cb({ id: req.id, ok: false, stage: 'busy' }); return; }
    compileCached(comp, String(req.code || ''), (b) => {
      if (!b.exe) { cb(Object.assign({ id: req.id, ok: false }, b)); return; }
      const tests = Array.isArray(req.tests) ? req.tests.slice(0, MAX_TESTS) : [];
      const mode = req.mode === 'contains' ? 'contains' : 'exact';
      const results = [];
      let i = 0, stopped = '';
      const next = () => {
        if (i >= tests.length || stopped) {
          // Не дошедшие тесты — «не запускался»: зависшая программа не держит ответ минуту.
          for (; i < tests.length; i++) {
            const t = tests[i];
            results.push({ in: t && t.in, expected: t && t.out, got: '', pass: false, skipped: stopped || 'time' });
          }
          const okAll = results.length > 0 && results.every((r) => r.pass);
          const out = { id: req.id, ok: okAll, stage: 'run', tests: results, cached: !!b.cached };
          if (stopped) out.stopped = stopped;
          cb(out);
          return;
        }
        const budget = Math.min(TEST_TIMEOUT_MS, left() - 500);
        if (budget < 300) { stopped = 'time'; next(); return; }
        const t = tests[i++];
        runOneExe(b.exe, t && t.in != null ? String(t.in) : '', budget, b.env, (r) => {
          // EPERM/EACCES/EBUSY при запуске свежего .exe — почти всегда антивирус (ложное срабатывание на MinGW-сборку).
          const blockedRun = r.error && /EPERM|EACCES|EBUSY/.test(r.error);
          // Упавшая программа не засчитывается, даже если успела напечатать верный ответ: UB/исключение
          // после вывода — тоже ошибка, и ученик должен её увидеть.
          const crash = crashReason(r);
          const got = r.timeout ? '⏱ превышено время (' + Math.round(budget / 100) / 10 + ' c)'
            : blockedRun ? '⛔ запуск заблокирован — похоже, антивирус. Добавь временную папку ' + os.tmpdir() + ' в исключения'
              : (r.error ? 'ошибка запуска' : String(r.out || '').slice(0, 2000));
          const pass = !r.timeout && !r.error && !crash && outputMatches(r.out, t && t.out, mode);
          const row = { in: t && t.in, expected: t && t.out, got: got.slice(0, 500), pass: pass };
          if (crash) { row.exit = r.signal || r.code; row.crash = crash; }
          if (!pass && r.err) row.stderr = String(r.err).slice(0, 500);
          results.push(row);
          // Программа зависла (бесконечный цикл) — остальные тесты почти наверняка тоже зависнут.
          if (r.timeout) stopped = 'hang';
          next();
        });
      };
      next();
    }, left() - 1000);
  });
}

// ---- очередь: одна сборка/прогон одновременно ----
let _busy = false;
const _queue = [];
/** Точка входа для моста и вкладки: проверки + очередь. Возвращает Promise с результатом. */
function handleRun(req) {
  return new Promise((resolve) => {
    if (!localRunEnabled()) { resolve({ id: req && req.id, ok: false, stage: 'disabled' }); return; }
    if (!req || typeof req.id !== 'string' || typeof req.code !== 'string' || req.code.length > MAX_CODE) {
      resolve({ id: req && req.id, ok: false, stage: 'io', error: 'неверный запрос' }); return;
    }
    if (_queue.length >= QUEUE_MAX) { resolve({ id: req.id, ok: false, stage: 'busy' }); return; }
    req._t0 = Date.now();
    _queue.push({ req, resolve });
    pump();
  });
}
function pump() {
  if (_busy || !_queue.length) return;
  _busy = true;
  const { req, resolve } = _queue.shift();
  let finished = false;
  const done = (res) => { if (finished) return; finished = true; _busy = false; resolve(res); pump(); };
  try { runUserCode(req, done); }
  catch (e) { log('запуск кода пользователя', e); done({ id: req.id, ok: false, stage: 'io', error: String(e) }); }
}

module.exports = { runUserCode, handleRun, resolveCompilerAsync, normRunOut, outputMatches, resetCompilerCache, crashReason, compilerStamp, RUN_BUDGET_MS };
