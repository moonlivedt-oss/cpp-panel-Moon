"use strict";

// Подсказки по стилю (extension/lib/style.js): правила курса в открытом .cpp.
// Чистая функция findStyleIssues — без VS Code. Плюс: у каждого правила есть живой раздел-цель.

var fs = require("fs");
var path = require("path");
var S = require(path.join(__dirname, "..", "extension", "lib", "style.js"));

const { check, group, finish } = require("./helpers");
function rules(code) { return S.findStyleIssues(code).map(function (x) { return x.rule; }); }
function has(code, rule) { return rules(code).indexOf(rule) !== -1; }

console.log("Стиль: срабатывает");
check("using namespace std;", has("using namespace std;\nint main() {}", "using-namespace"));
check("rand() и srand()", rules("int main() {\n  srand(time(0));\n  int d = rand() % 6;\n}").filter(function (r) { return r === "rand"; }).length === 2);
check("std::endl в теле for { }", has("for (int i = 0; i < 3; ++i) {\n  std::cout << i << std::endl;\n}", "endl-loop"));
check("endl в while { } (using namespace std)", has("while (x > 0) {\n  cout << x << endl;\n  --x;\n}", "endl-loop"));
check("endl в теле без скобок на следующей строке", has("for (int i = 0; i < 3; ++i)\n  std::cout << i << std::endl;", "endl-loop"));
check("endl в теле на той же строке", has("for (int i = 0; i < 3; ++i) std::cout << i << std::endl;", "endl-loop"));
check("int x; без значения", has("int main() {\n  int x;\n  std::cin >> x;\n}", "uninit"));
check("int a, b; без значения", has("void f() {\n  int a, b;\n}", "uninit"));
check("глобальная и в namespace — не ошибка (обнуляются сами)", !has("int counter;\nnamespace game {\n  int score;\n}\nint main() {}", "uninit"));
check("C-приведение (double)sum", has("double avg = (double)sum / n;", "c-cast"));
check("C-приведение (unsigned char)c", has("unsigned char u = (unsigned char)c;", "c-cast"));
check("new и delete[]", rules("int *a = new int[5];\ndelete[] a;").filter(function (r) { return r === "new-delete"; }).length === 2);
check("<bits/stdc++.h>", has("#include <bits/stdc++.h>", "bits"));
check("NULL", has("int *p = NULL;", "null"));
check("printf / scanf", rules('scanf("%d", &n);\nprintf("%d", n);').filter(function (r) { return r === "printf"; }).length === 2);

group("Стиль: не срабатывает (ложные тревоги)");
check("в комментарии // using namespace std;", !has("// using namespace std;\nint main() {}", "using-namespace"));
check("в /* комментарии */ rand()", !has("/* rand() */ int x = 0;", "rand"));
check("в строке \"new Node\" и \"NULL\"", rules('std::cout << "new Node NULL printf(";').length === 0, rules('std::cout << "new Node NULL printf(";'));
check("в сырой строке R\"(delete x)\"", !has('auto s = R"(delete x)";', "new-delete"));
check("std::endl вне цикла", !has('int main() {\n  std::cout << "hi" << std::endl;\n}', "endl-loop"));
check("endl после цикла", !has("for (int i = 0; i < 3; ++i) {\n  sum += i;\n}\nstd::cout << sum << std::endl;", "endl-loop"));
check("int x = 0; и int y{};", !has("int x = 0;\nint y{};", "uninit"));
check("параметры функции int f(int a, int b);", !has("int f(int a, int b);", "uninit"));
check("поля struct/class без значения — не ошибка", !has("struct P {\n  int x;\n  double y;\n};", "uninit") &&
  !has("class A\n{\n  int hp;\npublic:\n  A() : hp(10) {}\n};", "uninit"));
check("…но переменная в методе класса — ловится", has("struct A {\n  void f() {\n    int x;\n  }\n};", "uninit"));
check("endl внутри do { } while — ловится", has("do {\n  std::cout << 1 << std::endl;\n} while (x);", "endl-loop"));
check("endl после do-while — нет", !has("do {\n  x++;\n} while (x < 3);\nstd::cout << std::endl;", "endl-loop"));
check("static_cast<double>(sum)", !has("double a = static_cast<double>(sum) / n;", "c-cast"));
check("прототип f(int) и метод g(int) const", !has("void f(int);\nint g(int) const;", "c-cast"));
check("sizeof(int)", !has("std::size_t n = sizeof(int) * 4;", "c-cast"));
check("= delete (удалённая функция)", !has("A(const A &) = delete;", "new-delete"));
check("std::make_unique и «renew»", !has("auto p = std::make_unique<Node>();\nint renew = 1;", "new-delete"));
check("nullptr", !has("int *p = nullptr;", "null"));
check("std::format / snprintf-подобные имена", !has('auto s = std::format("{}", x);\nmy_printf_like(x);', "printf"));
check("mt19937 и uniform_int_distribution", !has("std::mt19937 rng(42);\nstd::uniform_int_distribution<int> d(1, 6);", "rand"));
check("do { } while (…); — не заголовок цикла", !has("do {\n  --x;\n} while (x > 0);\nstd::cout << std::endl;", "endl-loop"));

group("Стиль: позиции и исправления");
var e = S.findStyleIssues("for (;;) {\n  std::cout << 1 << std::endl;\n}")[0];
check("endl: строка и столбец указаны точно", e && e.line === 1 && e.col === 20 && e.len === 9, e);
check("endl: быстрое исправление — \"\\n\"", e && e.fix === '"\\n"');
var nl = S.findStyleIssues("int *p = NULL;")[0];
check("NULL: быстрое исправление — nullptr", nl && nl.fix === "nullptr");
check("пустой и огромный текст не падают", S.findStyleIssues("").length === 0 && Array.isArray(S.findStyleIssues("int x = 0;\n".repeat(20000))));

group("Стиль: разделы-цели существуют");
var rt = fs.readFileSync(path.join(__dirname, "..", "extension", "cpp-docs-runtime.js"), "utf8");
var slugify = (0, eval)("(" + rt.match(/function slugify[\s\S]*?\n  }/)[0] + ")");
Object.keys(S.RULES).forEach(function (k) {
  var r = S.RULES[k], file = path.join(__dirname, "..", "docs", r.rel), slugs = {};
  var md = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  md.split(/\r?\n/).forEach(function (l) { var m = l.match(/^#{1,6}\s+(.*)$/); if (m) slugs[slugify(m[1])] = 1; });
  check("правило «" + k + "» → " + r.rel + "#" + r.hash, !!slugs[r.hash]);
});

group("Стиль: регистрация в VS Code (заглушка)");
(function () {
  var Module = require("module");
  var sets = {}, provider = null, cmds = {}, listeners = {}, cfg = { styleHints: true };
  function Range(a, b, c, d) { this.start = { line: a, character: b }; this.end = { line: c, character: d }; }
  function Diagnostic(range, msg, sev) { this.range = range; this.message = msg; this.severity = sev; }
  function CodeAction(title, kind) { this.title = title; this.kind = kind; }
  function WorkspaceEdit() { this.edits = []; }
  WorkspaceEdit.prototype.replace = function (uri, range, text) { this.edits.push({ range: range, text: text }); };
  var on = function (name) { return function (fn) { listeners[name] = fn; return { dispose: function () {} }; }; };
  var doc = {
    languageId: "cpp", uri: { scheme: "file", toString: function () { return "file:///a.cpp"; } },
    getText: function () { return "int main() {\n  for (int i = 0; i < 3; ++i) std::cout << i << std::endl;\n  int *p = NULL;\n}"; },
  };
  var stub = {
    Range: Range, Diagnostic: Diagnostic, CodeAction: CodeAction, WorkspaceEdit: WorkspaceEdit,
    DiagnosticSeverity: { Information: 2 }, CodeActionKind: { QuickFix: "quickfix" },
    languages: {
      createDiagnosticCollection: function () {
        return { set: function (u, d) { sets[u.toString()] = d; }, delete: function (u) { delete sets[u.toString()]; }, dispose: function () {} };
      },
      registerCodeActionsProvider: function (sel, p) { provider = p; return { dispose: function () {} }; },
    },
    workspace: {
      textDocuments: [doc], getConfiguration: function () { return { get: function (k) { return cfg[k]; } }; },
      onDidOpenTextDocument: on("open"), onDidChangeTextDocument: on("change"), onDidCloseTextDocument: on("close"), onDidChangeConfiguration: on("config"),
    },
    commands: { registerCommand: function (id, fn) { cmds[id] = fn; return { dispose: function () {} }; } },
  };
  var orig = Module._resolveFilename;
  Module._resolveFilename = function (r) { if (r === "vscode") return "vscode-stub-style"; return orig.apply(this, arguments); };
  require.cache["vscode-stub-style"] = { id: "vscode-stub-style", filename: "vscode-stub-style", loaded: true, exports: stub };
  var opened = null, ctx = { subscriptions: [] };
  try { S.registerStyleHints(ctx, function (rel, hash) { opened = rel + "#" + hash; }); } finally { Module._resolveFilename = orig; }
  var d = sets["file:///a.cpp"] || [];
  check("открытый .cpp получил подсказки (endl в цикле и NULL)", d.length === 2 && d.every(function (x) { return x.severity === 2 && x.source === "Документация C++"; }), d.map(function (x) { return x.code; }));
  var rebuilt = d.map(function (x) { return { range: x.range, message: x.message, severity: x.severity, source: x.source, code: x.code }; });
  var acts = provider ? provider.provideCodeActions(doc, null, { diagnostics: rebuilt }) : [];
  var fixes = acts.filter(function (a) { return a.edit; }).map(function (a) { return a.edit.edits[0].text; });
  check("быстрые исправления: \"\\n\" и nullptr", fixes.indexOf('"\\n"') !== -1 && fixes.indexOf("nullptr") !== -1, fixes);
  var why = acts.filter(function (a) { return a.command && a.command.command === "cppDocs.openStyleDoc"; });
  check("у каждой подсказки есть «📘 Почему так»", why.length === d.length);
  if (why[0] && cmds["cppDocs.openStyleDoc"]) cmds["cppDocs.openStyleDoc"].apply(null, why[0].command.arguments);
  check("«Почему так» открывает раздел справочника", /^ref\/02-vvod-vyvod\.md#базовый-вывод$/.test(opened || ""), opened);
  cfg.styleHints = false;
  if (listeners.config) listeners.config({ affectsConfiguration: function () { return true; } });
  check("cppDocs.styleHints = false — подсказки убраны", !sets["file:///a.cpp"]);
})();

finish("Подсказки по стилю");
