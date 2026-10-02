"use strict";

// Умные быстрые слова (extension/lib/smart-snippets.js): план вставки без VS Code
// и сквозной сценарий — слова одно за другим в пустом файле, результат компилируется g++.

var path = require("path");
var fs = require("fs");
var os = require("os");
var cp = require("child_process");
var SS = require(path.join(__dirname, "..", "extension", "lib", "smart-snippets.js"));
var D = require(path.join(__dirname, "..", "extension", "lib", "snippets-data.js"));

const { check, group, finish } = require("./helpers");

var MARK = "‸";   // ‸ — место курсора в исходнике теста (| не годится: в коде есть ||)

function snip(prefix) { return D.SNIPPETS.find(function (s) { return s.prefix === prefix; }); }

/** Набрать слово prefix на месте ‸ в src и применить план так же, как VS Code. → {text, plan} */
function type(src, prefix) {
  var at = src.indexOf(MARK);
  var text = src.slice(0, at) + src.slice(at + 1);
  var before = text.slice(0, at);
  var cursor = { line: before.split("\n").length - 1, col: at - before.lastIndexOf("\n") - 1, offset: at };
  var plan = SS.planInsert(SS.analyze(text), cursor, snip(prefix), { indent: "    " });
  if (!plan) return { text: null, plan: null };
  var out = text.slice(0, at) + D.plainBody(plan.text).replace(/\t/g, "    ") + text.slice(at);
  var lines = out.split("\n");
  plan.edits.slice().sort(function (a, b) { return b.line - a.line; }).forEach(function (e) {
    lines.splice(e.line, 0, e.text.replace(/\n$/, ""));
  });
  return { text: lines.join("\n"), plan: plan };
}
function count(text, needle) { return text.split(needle).length - 1; }
var M = MARK;

group("Заголовки");
var r = type(M, "main");
check("пустой файл, main: правок нет — всё в самой вставке", r.plan.edits.length === 0, r.plan);
check("main: windows-блок первым, затем <iostream>, <string>", /^#define NOMINMAX\n#define WIN32_LEAN_AND_MEAN\n#include <windows.h>\n#include <iostream>\n#include <string>\n\nint main\(\) \{/.test(r.text), r.text);

r = type("#include <iostream>\n#include <vector>\n\nint main() {\n    " + M + "\n}\n", "vec");
check("vec при подключённом <vector>: ничего не добавляет", r.plan.edits.length === 0 && r.plan.adds.includes.length === 0, r.plan);
r = type("#include <iostream>\n\nint main() {\n    " + M + "\n}\n", "sort");
check("sort: <algorithm> и <functional> — сразу после последнего #include",
  r.text.indexOf("#include <iostream>\n#include <algorithm>\n#include <functional>\n\nint main") === 0, r.text);
r = type("#include <bits/stdc++.h>\n\nint main() {\n    " + M + "\n}\n", "sort");
check("<bits/stdc++.h> — стандартные заголовки не добавляются", r.plan.adds.includes.length === 0, r.plan.adds);
r = type("// #include <vector>\n/* #include <map> */\n#include <iostream>\nint main() {\n    " + M + "\n}\n", "vec");
check("#include в комментарии не считается", r.plan.adds.includes.join() === "vector", r.plan.adds);
r = type("// Лабораторная 1\n// Иванов\n\nint main() {\n    " + M + "\n}\n", "vec");
check("без #include: после шапки из комментариев, с пустой строкой", r.text.indexOf("// Лабораторная 1\n// Иванов\n#include <vector>\n\n") === 0, r.text);

group("Функции ввода");
r = type("#include <iostream>\n\n// Главная\nint main() {\n    " + M + "\n}\n", "readint");
check("readint в main: вставка — вызов", /int n = readInt\("Введите число: "\);/.test(r.text), r.text);
check("readint в main: определение над main и над её комментарием", /\}\n\n\/\/ Главная\nint main/.test(r.text) && r.text.indexOf("int readInt(") < r.text.indexOf("// Главная"), r.text);
check("readint: нужные заголовки, <iostream> не повторён", count(r.text, "#include <iostream>") === 1 && /#include <sstream>/.test(r.text) && /#include <limits>/.test(r.text), r.text);
var withInt = r.text.replace(/int n = readInt\("Введите число: "\);/, M);
r = type(withInt, "readint");
check("второй readint: определение не повторяется", count(r.text, "int readInt(") === 1 && r.plan.edits.length === 0, r.plan);
check("readint вне функций, когда readInt уже есть, — не предлагается",
  type(withInt.replace(M, "").replace("int main() {", M + "\nint main() {"), "readint").plan === null);
r = type("#include <string>\n" + M + "\nint main() {}\n", "readline");
check("readline вне функций — заголовки, пустая строка, определение, одна пустая строка до main",
  r.text === "#include <string>\n#include <cstdlib>\n#include <iostream>\n\n" + D.FUNCS.readLine.code.join("\n").replace(/\t/g, "    ") + "\n\nint main() {}\n", r.text);
check("прототип считается: int readInt(const std::string &, int, int);",
  SS.analyze("int readInt(const std::string &p, int lo, int hi);\nint main() {}").defined.has("readInt"));
check("readInt в комментарии не считается", !SS.analyze("// int readInt(x)\nint main() {}").defined.has("readInt"));
r = type("#include <iostream>\nint main() {\n    " + M + "\n}\n", "menu");
check("menu добавляет readInt сам", r.plan.adds.funcs.join() === "readInt", r.plan.adds);
r = type("int main() {\n    " + M + "\n}\n", "readvecd");
check("readvecd добавляет readInt и readDouble", r.plan.adds.funcs.join() === "readInt,readDouble", r.plan.adds);

group("Где предлагать");
check("main не предлагается, если main уже есть", type("int main() {}\n" + M, "main").plan === null);
check("main не предлагается внутри функции", type("void f() {\n    " + M + "\n}\n", "main").plan === null);
check("тело struct — не функция", !SS.cursorScope(SS.analyze("struct A {\n  \n};"), 13).inFunc);
check("тело namespace — не функция", !SS.cursorScope(SS.analyze("namespace a {\n  \n}"), 16).inFunc);
check("метод внутри struct — функция", SS.cursorScope(SS.analyze("struct A {\n  void f() const {\n    \n  }\n};"), 33).inFunc);
check("лямбда в main — функция", SS.cursorScope(SS.analyze("int main() {\n  auto f = [] {\n    \n  };\n}"), 30).inFunc);
r = type("namespace app {\nint run() {\n    " + M + "\n}\n}\nint main() {}\n", "readline");
check("функция в namespace: определение над namespace", r.text.indexOf("std::string readLine(") < r.text.indexOf("namespace app"), r.text);
r = type("#include <iostream>\r\n\r\nint main() {\r\n    " + M + "\r\n}\r\n", "readint");
check("CRLF: строки правок считаются верно", r.plan.edits.some(function (e) { return e.line === 1; }) && r.plan.edits.some(function (e) { return e.line === 2; }), r.plan.edits);

group("Каталог");
var prefixes = D.SNIPPETS.map(function (s) { return s.prefix; });
check("префиксы не повторяются", prefixes.length === new Set(prefixes).size);
check("в коде вставок нет комментариев //", D.SNIPPETS.every(function (s) { return D.plainBody(s.body.join("\n")).indexOf("//") === -1; }) &&
  Object.keys(D.FUNCS).every(function (f) { return D.FUNCS[f].code.join("\n").indexOf("//") === -1; }));
check("needs и func ссылаются на существующие функции", D.SNIPPETS.every(function (s) {
  return (s.needs || []).concat(s.func ? [s.func] : []).every(function (f) { return !!D.FUNCS[f]; });
}));

// ─── Сквозной сценарий: каждое слово — в своём блоке { } в конце main,
//     чтобы имена переменных из разных слов не сталкивались.
var gxx = process.env.CXX || "g++";
var hasGxx = cp.spawnSync(gxx, ["--version"], { shell: process.platform === "win32" }).status === 0;
group("Сквозной сценарий (g++)");
if (hasGxx) {
  var src = type(M, "maininput").text;
  ["readvec", "readvecd", "menu", "readyesno", "readline", "readdouble", "inputkit", "readint",
    "sort", "sumv", "maxv", "split", "fmtf", "rnd", "vec", "countmap", "strcase", "dbleq"].forEach(function (p) {
    var at = src.lastIndexOf("\n    return 0;");
    var res = type(src.slice(0, at) + "\n    {\n        " + M + "\n    }" + src.slice(at), p);
    if (!res.text) { check("слово " + p + " вставилось", false); return; }
    src = res.text;
  });
  ["readLine", "readInt", "readDouble", "readYesNo"].forEach(function (f) {
    check("функция " + f + " определена ровно один раз", count(src, " " + f + "(const std::string &prompt") === 1, src);
  });
  var incs = src.match(/#include <[^>]+>/g) || [];
  check("ни один #include не повторён", incs.length === new Set(incs).size, incs);
  // Заглушки для имён, которые в словах — места для заполнения (v, line, text, value, a, b, items).
  var stubs = "\n#include <map>\nstatic std::vector<int> v{1, 2};\nstatic std::string line = \"a b\", text = \"Ab\";\n" +
    "static double value = 1.5, a = 1.0, b = 1.0;\nstatic std::vector<std::string> items{\"x\"};\n";
  var program = src.replace("\nint main() {", stubs + "\nint main() {");
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-snip-"));
  var file = path.join(dir, "main.cpp");
  fs.writeFileSync(file, program);
  var cc = cp.spawnSync(gxx, ["-std=c++20", "-Wall", "-Wextra", "-fsyntax-only", file], { encoding: "utf8", shell: process.platform === "win32" });
  check("итоговая программа компилируется", cc.status === 0, (cc.stderr || "").slice(0, 800) + "\n---\n" + program);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* временная папка */ }
}

finish("Умные быстрые слова");
