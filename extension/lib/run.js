// ============================================================
//  «Напиши и запусти» (Фаза 4): обратный файловый канал окно→хост.
//  Окно пишет запрос (код + тесты) в cpp-docs-run-req.json; хост его компилирует ЛОКАЛЬНЫМ
//  компилятором и прогоняет по тестам, результат кладёт в cpp-docs-run-res.json. Компиляция —
//  здесь, в процессе расширения (а не во впечатанном рантайме): команда компилятора приходит
//  ТОЛЬКО из настройки/автопоиска (не из запроса), запуск — с жёсткими таймаутами. Всё под
//  настройкой cppDocs.localRun (по умолчанию выключено).
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const { log } = require('./log');
const { runResFilePath, runReqFilePath, userSetting, localRunEnabled } = require('./storage');

// Компилятор ищем один раз: сначала настройка cppDocs.compiler, иначе автопоиск в PATH.
// undefined — ещё не искали; null — нет; {cmd,kind} — нашли. kind: 'msvc' (cl) или 'gcc' (g++/clang++).
let _compilerCache, _compilerWaiters = null;
function guessCompilerKind(cmd) { return /(^|[\\/])cl(\.exe)?$/i.test(String(cmd)) ? 'msvc' : 'gcc'; }
function resolveCompilerAsync(cb) {
  if (_compilerCache !== undefined) { cb(_compilerCache); return; }
  if (_compilerWaiters) { _compilerWaiters.push(cb); return; }   // поиск уже идёт — ждём его, а не запускаем второй
  let conf = '';
  try { conf = String(userSetting('compiler') || '').trim(); } catch (e) {}
  if (conf) { _compilerCache = { cmd: conf, kind: guessCompilerKind(conf) }; cb(_compilerCache); return; }
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
        if (!err && stdout && String(stdout).trim()) done({ cmd: name, kind: guessCompilerKind(name) });
        else tryNext();
      });
    } catch (e) { tryNext(); }
  };
  tryNext();
}
function writeRunResult(context, res) {
  try { fs.writeFileSync(runResFilePath(context), JSON.stringify(res), 'utf8'); } catch (e) { log('запись результата запуска', e); }
}
// Прогон одного собранного exe со stdin и жёстким таймаутом; вывод ограничен.
// env — окружение (с каталогом компилятора в PATH, чтобы exe нашёл рантайм-DLL, напр. у MSYS2).
function runOneExe(exe, input, timeoutMs, env, cb) {
  let child, out = '', done = false;
  const finish = (r) => { if (done) return; done = true; try { child && child.kill(); } catch (e) {} cb(r); };
  // cwd — временная папка сборки: ofstream("out.txt") ученика ляжет туда и сотрётся вместе с ней,
  // а не в рабочую папку хоста расширений (часто это каталог установки VS Code).
  try { child = cp.spawn(exe, [], { windowsHide: true, cwd: path.dirname(exe), env: env || process.env }); } catch (e) { cb({ error: String(e) }); return; }
  const timer = setTimeout(() => finish({ timeout: true, out: out }), timeoutMs);
  // Программа может выйти, не дочитав stdin: EPIPE/EOF приходит событием 'error' на потоке —
  // без обработчика он уронил бы хост расширений. stderr вычитываем в никуда: иначе переполненный
  // канал подвесит программу, которая пишет в cerr, и она «превысит время».
  child.stdin.on('error', () => {});
  child.stderr.on('data', () => {});
  child.stdout.setEncoding('utf8');   // декодер держит разрезанные на границе куска UTF-8 символы
  child.stdout.on('data', (d) => { out += d; if (out.length > 65536) { out = out.slice(0, 65536); finish({ out: out, truncated: true }); } });
  child.on('error', (e) => { clearTimeout(timer); finish({ error: String(e && e.message || e) }); });
  child.on('close', () => { clearTimeout(timer); if (!done) { done = true; cb({ out: out }); } });
  try { if (input != null) child.stdin.write(String(input)); } catch (e) {}
  try { child.stdin.end(); } catch (e) {}
}
// Нормализация вывода для сравнения: построчно trim + схлопывание пробелов, хвостовые пустые строки долой.
function normRunOut(s) {
  return String(s == null ? '' : s).replace(/\r\n?/g, '\n').split('\n')
    .map((l) => l.replace(/\s+$/g, '').replace(/[ \t]+/g, ' ').replace(/^\s+/, '')).join('\n').replace(/\n+$/g, '');
}
// Скомпилировать код запроса и прогнать тесты; результат — в res-файл.
function runUserCode(context, req) {
  resolveCompilerAsync((comp) => {
    if (!comp) { writeRunResult(context, { id: req.id, ok: false, stage: 'nocompiler', ts: Date.now() }); return; }
    let dir;
    try { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cppdocs-run-')); } catch (e) { writeRunResult(context, { id: req.id, ok: false, stage: 'io', error: 'нет доступа к временной папке', ts: Date.now() }); return; }
    const src = path.join(dir, 'main.cpp');
    const exe = path.join(dir, process.platform === 'win32' ? 'main.exe' : 'main');
    const cleanup = () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} };
    try { fs.writeFileSync(src, String(req.code || ''), 'utf8'); } catch (e) { writeRunResult(context, { id: req.id, ok: false, stage: 'io', error: String(e), ts: Date.now() }); cleanup(); return; }
    const args = comp.kind === 'msvc' ? ['/nologo', '/EHsc', '/std:c++17', src, '/Fe:' + exe] : ['-std=c++17', '-O0', src, '-o', exe];
    // Каталог компилятора — в PATH: собранный exe (и сама сборка) найдут рантайм-DLL (MSYS2/UCRT64 и т.п.).
    const binDir = /[\\/]/.test(comp.cmd) ? path.dirname(comp.cmd) : '';
    const childEnv = binDir ? Object.assign({}, process.env, { PATH: binDir + path.delimiter + (process.env.PATH || '') }) : process.env;
    let execErr = null;
    try {
      cp.execFile(comp.cmd, args, { timeout: 12000, cwd: dir, windowsHide: true, maxBuffer: 1 << 20, env: childEnv }, (err, stdout, stderr) => {
        if (err || !fs.existsSync(exe)) {
          writeRunResult(context, { id: req.id, ok: false, stage: 'compile', compileError: String(stderr || (err && err.message) || 'сборка не удалась').slice(0, 4000), ts: Date.now() });
          cleanup(); return;
        }
        const tests = Array.isArray(req.tests) ? req.tests.slice(0, 20) : [];
        const results = [];
        let i = 0;
        const next = () => {
          if (i >= tests.length) {
            const okAll = results.length > 0 && results.every((r) => r.pass);
            writeRunResult(context, { id: req.id, ok: okAll, stage: 'run', tests: results, ts: Date.now() });
            cleanup(); return;
          }
          const t = tests[i++];
          runOneExe(exe, t && t.in != null ? String(t.in) : '', 5000, childEnv, (r) => {
            const got = r.timeout ? '⏱ превышено время (5 c)' : (r.error ? 'ошибка запуска' : String(r.out || '').slice(0, 2000));
            const pass = !r.timeout && !r.error && normRunOut(r.out) === normRunOut(t && t.out);
            results.push({ in: t && t.in, expected: t && t.out, got: got.slice(0, 500), pass: pass });
            next();
          });
        };
        next();
      });
    } catch (e) { execErr = e; }
    if (execErr) { writeRunResult(context, { id: req.id, ok: false, stage: 'compile', compileError: String(execErr), ts: Date.now() }); cleanup(); }
  });
}
// Обработать запрос из req-файла, если он новый и localRun включён.
let _lastRunId = null, _runProcessTimer = null;
function processRunReq(context) {
  clearTimeout(_runProcessTimer);
  _runProcessTimer = setTimeout(() => {
    if (!localRunEnabled()) return;                 // выключили — не запускаем
    let req;
    try { req = JSON.parse(fs.readFileSync(runReqFilePath(context), 'utf8')); } catch (e) { return; }
    if (!req || typeof req.id !== 'string' || req.id === _lastRunId) return;
    // Запрос одноразовый: забираем файл, чтобы он не выполнился снова при следующем старте. Старше
    // 30 с (окно ждёт 25) — остался с прошлой сессии, не запускаем.
    try { fs.unlinkSync(runReqFilePath(context)); } catch (e) {}
    if (typeof req.ts !== 'number' || Math.abs(Date.now() - req.ts) > 30000) return;
    if (typeof req.code !== 'string' || req.code.length > 200000) return;   // санити
    _lastRunId = req.id;
    try { runUserCode(context, req); } catch (e) { log('запуск кода пользователя', e); writeRunResult(context, { id: req.id, ok: false, stage: 'io', error: String(e), ts: Date.now() }); }
  }, 60);
}
/** Настройку cppDocs.compiler поменяли — при следующем запуске компилятор ищем заново. */
function resetCompilerCache() { _compilerCache = undefined; }

module.exports = { runUserCode, processRunReq, resolveCompilerAsync, normRunOut, resetCompilerCache };
