// ============================================================
//  Подсказки по стилю в своём .cpp: правила курса прямо в редакторе.
//
//  Курс учит «правильным привычкам» (ноль using namespace std, значение при объявлении,
//  static_cast вместо C-приведения, <random> вместо rand(), умные указатели вместо new/delete…).
//  Здесь эти правила проверяются в открытом C++-файле ученика и показываются мягкими
//  подсказками (уровень «информация», синяя волна — не ошибка). У каждой — действие
//  «📘 Почему так» (открывает раздел справочника) и, где это безопасно, быстрое исправление.
//  Выключается настройкой cppDocs.styleHints.
//
//  findStyleIssues(text) — чистая функция без vscode: её гоняет test/style.js.
// ============================================================

const RULES = {
  'using-namespace': {
    msg: '`using namespace std;` втаскивает все имена стандартной библиотеки — своя `count` или `size` начнёт конфликтовать. Пиши `std::` перед именами.',
    rel: 'ref/09-spravka.md', hash: 'using-namespace-std--почему-в-этом-справочнике-его-нет',
  },
  'rand': {
    msg: '`rand()` — наследство C: плохое качество и перекос по модулю. В C++ — `std::mt19937` и `std::uniform_int_distribution` из `<random>`.',
    rel: 'ref/08-struct-fayly.md', hash: 'случайные-числа',
  },
  'endl-loop': {
    msg: '`std::endl` в цикле каждый раз сбрасывает буфер и тормозит. Для перевода строки хватит `"\\n"`.',
    rel: 'ref/02-vvod-vyvod.md', hash: 'базовый-вывод',
  },
  'uninit': {
    msg: 'Переменная без начального значения содержит мусор. Дай значение сразу: `int x = 0;`.',
    rel: 'ref/01-osnovy.md', hash: 'переменная-без-начального-значения-содержит-мусор',
  },
  'c-cast': {
    msg: 'C-приведение `(int)x` молча делает что угодно. `static_cast<int>(x)` виден в коде и проверяется компилятором.',
    rel: 'ref/09-spravka.md', hash: 'c-style-cast--почему-static_cast-длиннее-не-зря',
  },
  'new-delete': {
    msg: 'Ручные `new`/`delete` — путь к утечкам. Для массива — `std::vector`, для одного объекта — `std::make_unique`.',
    rel: 'ref/09-spravka.md', hash: 'new--delete--самая-опасная-привычка-из-старых-книг',
  },
  'bits': {
    msg: '`<bits/stdc++.h>` — нестандартный заголовок GCC: медленнее сборка и не соберётся в другом компиляторе. Подключай нужные заголовки.',
    rel: 'ref/09-spravka.md', hash: '23-заголовки--что-откуда',
  },
  'null': {
    msg: '`NULL` — это просто 0 и путается с числом. Для «пустого» указателя в C++ есть `nullptr`.',
    rel: 'ref/22-ukazateli.md', hash: 'nullptr--ни-на-что-не-указывает',
  },
  'printf': {
    msg: '`printf`/`scanf` не проверяют типы: `%d` для `double` — тихий мусор. Потоки `std::cout`/`std::cin` или `std::format` надёжнее.',
    rel: 'ref/09-spravka.md', hash: 'printf--почему-потоки-надёжнее',
  },
};

/** Комментарии, строки и символьные литералы → пробелы (переводы строк сохраняются): правила не
 *  срабатывают на `// using namespace std;` или "rand()" внутри строки. #include <...> не трогаем. */
function blankNonCode(text) {
  const s = String(text);
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') {
      out += '  '; i += 2;
      while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) { out += s[i] === '\n' ? '\n' : ' '; i++; }
      if (i < s.length) { out += '  '; i += 2; }
      continue;
    }
    if (c === 'R' && n === '"' && !/[A-Za-z0-9_]/.test(s[i - 1] || '')) {       // сырая строка R"(...)"
      const open = s.indexOf('(', i + 2);
      const delim = open >= 0 ? ')' + s.slice(i + 2, open) + '"' : null;
      const end = delim ? s.indexOf(delim, open) : -1;
      const stop = end >= 0 ? end + delim.length : s.length;
      for (; i < stop; i++) out += s[i] === '\n' ? '\n' : ' ';
      continue;
    }
    if (c === '"' || c === '\'') {
      out += c; i++;
      while (i < s.length && s[i] !== c && s[i] !== '\n') {
        if (s[i] === '\\' && i + 1 < s.length) { out += '  '; i += 2; continue; }
        out += ' '; i++;
      }
      if (i < s.length && s[i] === c) { out += c; i++; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

// Безопасные автозамены: найденный кусок целиком меняется на это.
const FIXES = { 'endl-loop': '"\\n"', 'null': 'nullptr' };

const TYPES = '(?:unsigned\\s+|signed\\s+|long\\s+|short\\s+|const\\s+)*(?:int|double|float|char|bool|long|short|unsigned|std::size_t|size_t)';
const RE = {
  using: /\busing\s+namespace\s+std\s*;/g,
  rand: /(?<![\w:.>])(?:std::)?s?rand\s*\(/g,
  endl: /(?:std::)?\bendl\b/g,
  uninit: new RegExp('^(\\s*)' + TYPES + '\\s+([A-Za-z_]\\w*(?:\\s*,\\s*[A-Za-z_]\\w*)*)\\s*;'),
  cast: /(?<![\w\])>]\s*)\((?:unsigned\s+|long\s+|const\s+)*(?:int|double|float|char|long|short|bool|unsigned|std::size_t|size_t)\)\s*(?!const\b|override\b|noexcept\b|[;{,)])(?=[\w(])/g,
  newE: /(?<![\w:])new\s+[A-Za-z_]/g,
  del: /(?<![\w:=]\s*)\bdelete\s*(?:\[\s*\])?\s*[A-Za-z_(*]/g,
  bits: /#\s*include\s*<bits\/stdc\+\+\.h>/g,
  nul: /\bNULL\b/g,
  printf: /(?<![\w.:>])(?:std::)?(?:printf|scanf)\s*\(/g,
};

/**
 * Найти нарушения правил курса.
 * @returns {{rule:string, line:number, col:number, len:number, msg:string, rel:string, hash:string, fix?:string}[]}
 *          line/col — с нуля; fix — на что заменить найденный кусок (если это безопасно).
 */
function findStyleIssues(text) {
  const code = blankNonCode(text);
  const lines = code.split('\n');
  const out = [];
  const add = (rule, line, col, len, fix) => {
    const r = RULES[rule];
    out.push({ rule, line, col, len, msg: r.msg, rel: r.rel, hash: r.hash, fix });
  };
  const scan = (re, line, idx, rule, fix) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line))) {
      add(rule, idx, m.index, m[0].length, typeof fix === 'function' ? fix(m) : fix);
      if (!re.global) break;
    }
  };

  // Для «endl в цикле»: стек глубин скобок, на которых открыто тело цикла, и «ждём тело без скобок».
  let depth = 0;
  const loopDepths = [];
  let pendingLoop = false;       // «for (...)» без скобки: тело — на следующей строке
  // Для «переменная без значения»: какие скобки открыты — тело класса/структуры или обычный блок.
  // Поле класса без значения — не ошибка: его часто задаёт конструктор (A() : hp(10) {}).
  const scopes = [];
  let pendingClass = false;      // «struct P» — скобка на следующей строке

  lines.forEach((line, idx) => {
    const t = line.trim();
    const inClass = scopes[scopes.length - 1] === 'class';
    scan(RE.using, line, idx, 'using-namespace');
    scan(RE.rand, line, idx, 'rand');
    scan(RE.bits, line, idx, 'bits');
    scan(RE.nul, line, idx, 'null', FIXES.null);
    scan(RE.printf, line, idx, 'printf');
    scan(RE.cast, line, idx, 'c-cast');
    scan(RE.newE, line, idx, 'new-delete');
    scan(RE.del, line, idx, 'new-delete');
    const mu = line.match(RE.uninit);
    if (mu && !inClass && !/^\s*(return|extern|typedef)\b/.test(line)) add('uninit', idx, mu[1].length, line.trimEnd().length - mu[1].length);

    // do { … } while (…); — тоже цикл: заголовок «do», а хвост «} while (…);» — не заголовок
    const isLoopHeader = ((/(^|[^\w])(for|while)\s*\(/.test(t) && !/^\}?\s*while\s*\(.*\)\s*;\s*$/.test(t)) ||
      /^\}?\s*do\b\s*(\{|$)/.test(t));
    const inLoop = loopDepths.length > 0 || (isLoopHeader && /\)\s*[^{\s]/.test(t));   // тело в {…} или на той же строке
    if (inLoop) scan(RE.endl, line, idx, 'endl-loop', FIXES['endl-loop']);

    // обновляем состояние после строки
    const opens = (line.match(/\{/g) || []).length, closes = (line.match(/\}/g) || []).length;
    // Стек видов скобок: первая «{» после заголовка struct/class/union — тело класса.
    const classHeader = /^(template\s*<.*>\s*)?(struct|class|union)\b[^;()=]*$/.test(t.replace(/\{.*$/, ''));
    let firstIsClass = (classHeader && opens > 0) || (pendingClass && t.startsWith('{'));
    if (classHeader && !opens) pendingClass = true; else if (t) pendingClass = false;
    for (const ch of line) {
      if (ch === '{') { scopes.push(firstIsClass ? 'class' : 'block'); firstIsClass = false; }
      else if (ch === '}') scopes.pop();
    }
    if (isLoopHeader) {
      if (opens > closes) loopDepths.push(depth + 1);     // «for (...) {» — тело до парной скобки
      else if (/\)\s*$|^do$/.test(t)) pendingLoop = true; // «for (...)» / «do» и тело на следующей строке
    } else if (pendingLoop && t) {
      pendingLoop = false;
      if (t.startsWith('{')) loopDepths.push(depth + 1);   // «{» на отдельной строке; тело без скобок — в bareBodies
    }
    depth += opens - closes;
    while (loopDepths.length && depth < loopDepths[loopDepths.length - 1]) loopDepths.pop();
  });
  // тело цикла без скобок на следующей строке — отдельным проходом
  return out.concat(bareBodies(lines)).sort((a, b) => a.line - b.line || a.col - b.col)
    .filter((x, i, arr) => !i || x.line !== arr[i - 1].line || x.col !== arr[i - 1].col || x.rule !== arr[i - 1].rule);
}

/** endl в теле цикла без фигурных скобок, записанном на следующей строке после заголовка. */
function bareBodies(lines) {
  const out = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    const t = lines[i].trim();
    if (!/(^|[^\w])(for|while)\s*\(.*\)\s*$/.test(t)) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length || lines[j].trim().startsWith('{')) continue;
    RE.endl.lastIndex = 0;
    let m;
    while ((m = RE.endl.exec(lines[j]))) {
      const r = RULES['endl-loop'];
      out.push({ rule: 'endl-loop', line: j, col: m.index, len: m[0].length, msg: r.msg, rel: r.rel, hash: r.hash, fix: FIXES['endl-loop'] });
    }
  }
  return out;
}

// ---------------- VS Code: диагностики, действия, настройка ----------------
function registerStyleHints(context, openDocTarget) {
  const vscode = require('vscode');
  const coll = vscode.languages.createDiagnosticCollection('cppDocsStyle');
  context.subscriptions.push(coll);
  const enabled = () => vscode.workspace.getConfiguration('cppDocs').get('styleHints') !== false;
  const isCpp = (doc) => doc && doc.languageId === 'cpp' && doc.uri && doc.uri.scheme !== 'output';
  const timers = new Map();

  function lint(doc) {
    if (!isCpp(doc)) return;
    if (!enabled()) { coll.delete(doc.uri); return; }
    const text = doc.getText();
    if (text.length > 300000) { coll.delete(doc.uri); return; }      // огромные файлы не трогаем
    const diags = findStyleIssues(text).map((x) => {
      const range = new vscode.Range(x.line, x.col, x.line, x.col + x.len);
      const d = new vscode.Diagnostic(range, x.msg, vscode.DiagnosticSeverity.Information);
      d.source = 'Документация C++';
      d.code = x.rule;          // по имени правила действия восстановят раздел и исправление
      return d;
    });
    coll.set(doc.uri, diags);
  }
  function schedule(doc) {
    if (!isCpp(doc)) return;
    const key = doc.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => { timers.delete(key); lint(doc); }, 400));
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(lint),
    vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => coll.delete(doc.uri)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cppDocs.styleHints')) vscode.workspace.textDocuments.forEach(lint);
    }),
    vscode.commands.registerCommand('cppDocs.openStyleDoc', (rel, hash) => openDocTarget(String(rel || ''), String(hash || ''))),
    vscode.languages.registerCodeActionsProvider({ language: 'cpp' }, {
      provideCodeActions(doc, range, ctx) {
        const acts = [];
        // Диагностики сюда приходят пересобранными VS Code — своё поле на них не доживёт; берём имя правила.
        (ctx.diagnostics || []).filter((d) => d.source === 'Документация C++' && RULES[d.code]).forEach((d) => {
          const x = RULES[d.code], fixText = FIXES[d.code];
          if (fixText) {
            const fix = new vscode.CodeAction('Заменить на ' + fixText, vscode.CodeActionKind.QuickFix);
            fix.edit = new vscode.WorkspaceEdit();
            fix.edit.replace(doc.uri, d.range, fixText);
            fix.diagnostics = [d];
            fix.isPreferred = true;
            acts.push(fix);
          }
          const why = new vscode.CodeAction('📘 Почему так — открыть раздел справочника', vscode.CodeActionKind.QuickFix);
          why.command = { command: 'cppDocs.openStyleDoc', title: 'Открыть раздел', arguments: [x.rel, x.hash] };
          why.diagnostics = [d];
          acts.push(why);
        });
        return acts;
      },
    }, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] })
  );
  vscode.workspace.textDocuments.forEach(lint);
}

module.exports = { RULES, findStyleIssues, registerStyleHints };
