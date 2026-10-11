// ============================================================
//  Умные быстрые слова в .cpp: смотрят в файл перед вставкой.
//
//  - недостающие #include дописываются к остальным, уже подключённые не повторяются;
//  - readint и другие функции ввода: внутри функции вставляется вызов, а определение
//    кладётся над текущей функцией — только если его ещё нет;
//  - слова, которым нужны функции ввода (readvec, menu…), добавляют их сами;
//  - main/maininput не предлагаются, если main уже есть.
//  Выключается настройкой cppDocs.smartSnippets.
//
//  planInsert(text, cursor, snippet) — чистая функция без vscode: её гоняет test/smart-snippets.test.js.
// ============================================================

const { SNIPPETS, FUNCS, WINDOWS, WINDOWS_BLOCK, plainBody } = require('./snippets-data');
const { blankNonCode } = require('./style');

const FUNC_SIG = /\b(?:int|double|bool|std::string)\s+(readLine|readInt|readDouble|readYesNo)\s*\(/g;
const MAIN_SIG = /\bint\s+main\s*\(/;
const INCLUDE_RE = /^\s*#\s*include\s*<([^>]+)>/;

/** Глубина фигурных скобок и стек открывающих (смещения) в точке offset — по коду без комментариев/строк. */
function braceStack(blank, offset) {
  const stack = [];
  for (let i = 0; i < offset && i < blank.length; i++) {
    if (blank[i] === '{') stack.push(i);
    else if (blank[i] === '}') stack.pop();
  }
  return stack;
}

/** Открывает ли скобка в pos тело функции: перед ней «)» (возможно, с const/noexcept/override/-> тип). */
function isFunctionBrace(blank, pos) {
  const before = blank.slice(Math.max(0, pos - 300), pos);
  return /\)\s*(?:(?:const|noexcept|override|final|mutable)\s*|->\s*[\w:<>,\s*&]+)*$/.test(before);
}

/** Разбор файла: подключённые заголовки, уже определённые функции ввода, есть ли main. */
function analyze(text) {
  const raw = String(text);                                            // CRLF не трогаем: смещения должны совпадать с документом
  const blank = blankNonCode(raw);
  const rawLines = raw.split('\n');
  const blankLines = blank.split('\n');
  const includes = new Set();
  let lastInclude = -1;
  blankLines.forEach((l, i) => {
    if (!/^\s*#\s*include\b/.test(l)) return;
    const m = INCLUDE_RE.exec(rawLines[i]);
    if (m) includes.add(m[1].trim());
    lastInclude = i;
  });
  const defined = new Set();
  let m;
  FUNC_SIG.lastIndex = 0;
  while ((m = FUNC_SIG.exec(blank))) {
    if (braceStack(blank, m.index).length === 0) defined.add(m[1]);
  }
  return {
    raw, blank, rawLines, blankLines, includes, lastInclude, defined,
    bits: includes.has('bits/stdc++.h'),
    hasMain: MAIN_SIG.test(blank),
  };
}

/** Строка, куда дописывать #include: после последнего #include; если их нет — после
 *  шапки из комментариев, #pragma и #define в начале файла. */
function includeLine(a) {
  if (a.lastInclude >= 0) return a.lastInclude + 1;
  let i = 0;
  while (i < a.rawLines.length) {
    const r = a.rawLines[i].trim(), b = a.blankLines[i].trim();
    if (r && !b) { i++; continue; }                                   // комментарий
    if (/^#\s*(pragma|define)\b/.test(b)) { i++; continue; }
    break;
  }
  return i;
}

/** Начало объявления верхнего уровня, внутри которого стоит скобка pos (строка сигнатуры
 *  вместе с template<…> и комментарием над ней). */
function declStartLine(a, pos) {
  let line = a.blank.slice(0, pos).split('\n').length - 1;
  while (line > 0) {
    const prevB = a.blankLines[line - 1].trim(), prevR = a.rawLines[line - 1].trim();
    if (prevR && !prevB) { line--; continue; }                        // комментарий над функцией
    if (!prevB || /[;{}]$/.test(prevB) || prevB.startsWith('#')) break;
    line--;
  }
  return line;
}

/** Курсор внутри тела функции? Тогда же — строка, над которой класть определения. */
function cursorScope(a, offset) {
  const stack = braceStack(a.blank, offset);
  const inFunc = stack.some((p) => isFunctionBrace(a.blank, p));
  return { inFunc, topLine: stack.length ? declStartLine(a, stack[0]) : -1 };
}

const indentWith = (lines, unit) => lines.map((l) => l.replace(/^\t+/, (t) => unit.repeat(t.length)));
const escapeSnippet = (s) => s.replace(/[\\$}]/g, '\\$&');

/**
 * План вставки слова. cursor = { line, col, offset }: начало набранного слова.
 * Возвращает null (слово здесь не к месту) или
 * { text: тело сниппета, edits: [{ line, text }], adds: { includes, funcs } }.
 * @param {ReturnType<typeof analyze>} a
 */
function planInsert(a, cursor, sn, opts) {
  const unit = (opts && opts.indent) || '\t';
  const scope = cursorScope(a, cursor.offset);
  if (sn.kind === 'main' && (a.hasMain || scope.inFunc)) return null;

  let body = sn.body.slice();
  const funcs = (sn.needs || []).slice();
  if (sn.kind === 'func') {
    if (!scope.inFunc) {
      if (a.defined.has(sn.func)) return null;                        // уже есть — второй раз не нужна
      body = [];                                                       // вне функции слово = само определение
    }
    funcs.unshift(sn.func);
  }
  const newFuncs = funcs.filter((f, i) => funcs.indexOf(f) === i && !a.defined.has(f));

  const want = (sn.includes || []).slice();
  newFuncs.forEach((f) => want.push(...FUNCS[f].includes));
  const newIncludes = want.filter((h, i) => want.indexOf(h) === i && !a.includes.has(h) && (h === WINDOWS || !a.bits));
  newIncludes.sort((x, y) => (x === WINDOWS ? -1 : y === WINDOWS ? 1 : x < y ? -1 : x > y ? 1 : 0));

  const incText = [];
  newIncludes.forEach((h) => { if (h === WINDOWS) incText.push(...WINDOWS_BLOCK); else incText.push('#include <' + h + '>'); });
  const funcText = [];
  newFuncs.forEach((f) => funcText.push(...indentWith(FUNCS[f].code, unit), ''));

  const edits = [];
  let prefix = '';
  const incLine = includeLine(a);
  if (incText.length) {
    const block = incText.join('\n') + '\n' + (a.lastInclude < 0 ? '\n' : '');
    if (incLine === cursor.line && cursor.col === 0) prefix += escapeSnippet(block);   // правка не может совпасть с местом вставки
    else edits.push({ line: incLine, text: block });
  }
  if (funcText.length) {
    const defs = funcText.join('\n');                                  // каждое определение + пустая строка после
    if (scope.inFunc) edits.push({ line: scope.topLine, text: defs + '\n' });
    else {
      const above = cursor.line > 0 ? a.blankLines[cursor.line - 1].trim() + a.rawLines[cursor.line - 1].trim() : '';
      const lead = (prefix ? !prefix.endsWith('\n\n') : above && cursor.col === 0) ? '\n' : '';   // отбить от #include/кода выше
      const onlyDefs = !body.join('').replace(/\$0/g, '').trim();
      // Только определения и сразу за курсором код (например, main) — оставить между ними пустую строку.
      const rest = (a.rawLines[cursor.line] || '').slice(cursor.col).replace(/^[A-Za-z_]\w*/, '').trim();
      const next = (a.rawLines[cursor.line + 1] || '').trim();
      const gap = onlyDefs && !rest && next ? '\n' : '';
      prefix += escapeSnippet(lead + (onlyDefs ? defs.replace(/\n$/, '') + gap : defs + '\n'));
    }
  }
  return {
    text: prefix + body.join('\n'),
    edits: mergeEdits(edits),
    adds: { includes: newIncludes, funcs: newFuncs },
  };
}

function mergeEdits(edits) {
  const out = [];
  edits.forEach((e) => {
    const same = out.find((x) => x.line === e.line);
    if (same) same.text += e.text; else out.push({ line: e.line, text: e.text });
  });
  return out;
}

/** Курсор в комментарии или строке — слова не предлагаем. */
function inCommentOrString(a, wordStart, offset) {
  const from = wordStart < offset ? wordStart : Math.max(0, offset - 1);   // пустое слово (Ctrl+Space) — смотрим символ слева
  for (let i = from; i < offset; i++) if (a.raw[i] !== a.blank[i] && /\s/.test(a.blank[i])) return true;
  return false;
}

/** Подпись «что ещё добавится» для подсказки. */
function describeAdds(adds) {
  const parts = [];
  if (adds.includes.length) parts.push(adds.includes.map((h) => '`<' + h + '>`').join(', '));
  if (adds.funcs.length) parts.push(adds.funcs.map((f) => '`' + f + '()`').join(', '));
  return parts.length ? 'Добавит: ' + parts.join(' | ') : 'Всё нужное уже подключено';
}

function registerSmartSnippets(context) {
  const vscode = require('vscode');
  const enabled = () => vscode.workspace.getConfiguration('cppDocs').get('smartSnippets') !== false;
  const provider = {
    provideCompletionItems(doc, position) {
      if (!enabled()) return [];
      const text = doc.getText();
      if (text.length > 300000) return [];
      const range = doc.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
      const start = range ? range.start : position;
      const offset = doc.offsetAt(position);
      const a = analyze(text);
      if (inCommentOrString(a, doc.offsetAt(start), offset)) return [];
      const ed = vscode.window.activeTextEditor;
      const opt = ed && ed.document === doc ? ed.options : {};
      const indent = opt.insertSpaces === false ? '\t' : ' '.repeat(Number(opt.tabSize) || 4);
      const cursor = { line: start.line, col: start.character, offset: doc.offsetAt(start) };
      const items = [];
      SNIPPETS.forEach((sn) => {
        const plan = planInsert(a, cursor, sn, { indent });
        if (!plan) return;
        const item = new vscode.CompletionItem({ label: sn.prefix, description: sn.title }, vscode.CompletionItemKind.Snippet);
        item.insertText = new vscode.SnippetString(plan.text);
        item.filterText = sn.prefix;
        item.sortText = '0' + sn.prefix;
        if (range) item.range = range;
        item.additionalTextEdits = plan.edits.map((e) => vscode.TextEdit.insert(new vscode.Position(e.line, 0), e.text));
        item.detail = sn.title;
        const md = new vscode.MarkdownString();
        md.appendMarkdown(sn.desc.replace(/</g, '&lt;') + '\n\n' + describeAdds(plan.adds) + '\n');
        const preview = plainBody(sn.kind === 'func' && !cursorScope(a, cursor.offset).inFunc
          ? escapeSnippet(FUNCS[sn.func].code.join('\n')) : sn.body.join('\n'));
        if (preview.trim()) md.appendCodeblock(preview.replace(/\t/g, '    '), 'cpp');
        item.documentation = md;
        items.push(item);
      });
      return items;
    },
  };
  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: 'cpp' }, provider));
}

module.exports = { analyze, planInsert, cursorScope, includeLine, describeAdds, registerSmartSnippets };
