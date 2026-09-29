"use strict";

// Интеграционные тесты: выполняются ВНУТРИ настоящего VS Code (хост расширений), запускает их
// test/vscode/run.js через @vscode/test-electron. Фаза — переменная CPPDOCS_E2E_PHASE:
//   basic  — активация, команды, вкладка, подсказки по стилю, мост, walkthrough;
//   inject — впечатать окно в оболочку ТЕСТОВОЙ копии VS Code (не твоей установки!);
//   window — после перезапуска: рантайм из оболочки загрузился, вышел на мост, ошибок нет.

const vscode = require("vscode");
const assert = require("assert");
const http = require("http");
const fs = require("fs");
const path = require("path");

const EXT_ID = "moonlivedt.cpp-docs-panel";
const tests = [];
function it(name, fn) { tests.push({ name, fn }); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms, what) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error("не дождался: " + what);
    await sleep(150);
  }
}
function post(port, pathName, body) {
  return new Promise((resolve) => {
    const r = http.request({ host: "127.0.0.1", port, method: "POST", path: pathName, headers: { origin: "vscode-file://vscode-app", "content-type": "text/plain" } }, (res) => {
      let d = ""; res.on("data", (c) => { d += c; }); res.on("end", () => resolve({ code: res.statusCode, body: d }));
    });
    r.on("error", (e) => resolve({ code: 0, body: String(e) }));
    r.end(JSON.stringify(body));
  });
}

let api = null;
async function activate() {
  const ext = vscode.extensions.getExtension(EXT_ID);
  assert.ok(ext, "расширение " + EXT_ID + " не найдено");
  api = await ext.activate();
  assert.ok(api && api._e2e, "activate() вернул API для тестов");
  return ext;
}

const PHASE = process.env.CPPDOCS_E2E_PHASE || "basic";

if (PHASE === "basic") {
  it("расширение активируется", async () => { await activate(); });

  it("все команды из package.json зарегистрированы", async () => {
    const ext = vscode.extensions.getExtension(EXT_ID);
    const declared = ext.packageJSON.contributes.commands.map((c) => c.command);
    const have = new Set(await vscode.commands.getCommands(true));
    const missing = declared.filter((c) => !have.has(c));
    assert.deepStrictEqual(missing, []);
  });

  it("walkthrough объявлен и его страницы на месте", () => {
    const ext = vscode.extensions.getExtension(EXT_ID);
    const w = ext.packageJSON.contributes.walkthroughs[0];
    assert.ok(w.steps.length >= 5);
    w.steps.forEach((s) => assert.ok(fs.existsSync(path.join(ext.extensionPath, s.media.markdown)), s.media.markdown));
  });

  it("окно во вкладке открывается (webview cppDocsWindow)", async () => {
    await vscode.commands.executeCommand("cppDocs.openWindowTab");
    await waitFor(() => vscode.window.tabGroups.all.some((g) => g.tabs.some((t) => t.input && /cppDocsWindow/.test(String(t.input.viewType || "")))),
      8000, "вкладка окна");
  });

  it("подсказки по стилю появляются в .cpp", async () => {
    const doc = await vscode.workspace.openTextDocument({ language: "cpp", content: "#include <cstdio>\nusing namespace std;\nint main() { int* p = NULL; return 0; }\n" });
    await vscode.window.showTextDocument(doc);
    const diags = await waitFor(() => {
      const d = vscode.languages.getDiagnostics(doc.uri).filter((x) => x.source === "Документация C++");
      return d.length >= 2 ? d : null;
    }, 8000, "диагностики стиля");
    assert.ok(diags.some((d) => d.code === "using-namespace") && diags.some((d) => d.code === "null"));
    const actions = await vscode.commands.executeCommand("vscode.executeCodeActionProvider", doc.uri, diags.find((d) => d.code === "null").range);
    assert.ok(actions.some((a) => /nullptr/.test(a.title)), "быстрое исправление NULL → nullptr");
  });

  it("мост отвечает: rpc action/run, чужой токен — 403", async () => {
    const st = await waitFor(() => { const s = api._e2e.status(); return s.bridge.running ? s : null; }, 5000, "мост");
    const file = path.join(st.storage, "cpp-docs-bridge.json");
    const info = JSON.parse(fs.readFileSync(file, "utf8"));
    const h = info.hosts.find((x) => x.port === st.bridge.port);
    assert.ok(h, "хост записан в cpp-docs-bridge.json");
    const r1 = await post(h.port, "/rpc/" + h.token + "/action", { id: "e1", kind: "bogus" });
    // Действие выполняет только хост окна в фокусе, остальные отвечают 409 «не я». На раннере
    // macOS окно тестового VS Code бывает не в фокусе — тогда 409 и есть правильный ответ.
    assert.ok(r1.code === 200 || r1.code === 409, "action: " + r1.code);
    if (r1.code === 200) assert.strictEqual(JSON.parse(r1.body).ok, false);
    const r2 = await post(h.port, "/rpc/" + h.token + "/run", { id: "e2", code: "int main(){}", tests: [] });
    assert.strictEqual(JSON.parse(r2.body).stage, "disabled", "без cppDocs.localRun запуск выключен");
    const r3 = await post(h.port, "/rpc/" + "0".repeat(48) + "/run", {});
    assert.strictEqual(r3.code, 403);
  });

  it("«Найти в справочнике» без плавающего окна открывает материал", async () => {
    const doc = await vscode.workspace.openTextDocument({ language: "cpp", content: "std::vector<int> v;\n" });
    const ed = await vscode.window.showTextDocument(doc);
    ed.selection = new vscode.Selection(0, 6, 0, 6);   // курсор на «vector»
    await vscode.commands.executeCommand("cppDocs.lookupInDocs");
    // Оболочка этой копии VS Code без окна — откроется .md; с окном (установка уже с окном) —
    // запрос уйдёт окну через контекст редактора.
    const editorFile = path.join(api._e2e.status().storage, "cpp-docs-editor.js");
    await waitFor(() => vscode.window.tabGroups.all.some((g) => g.tabs.some((t) => /\.md$|Preview|Просмотр/i.test(t.label))) ||
      (fs.existsSync(editorFile) && /"lookup":\{[^}]*"word":"vector"/.test(fs.readFileSync(editorFile, "utf8"))), 8000, "материал или запрос окну");
  });
}

if (PHASE === "inject") {
  it("окно впечатывается в оболочку тестовой копии VS Code", async () => {
    await activate();
    const r = api._e2e.inject();
    assert.ok(r.ok, "инъекция: " + JSON.stringify(r));
    const st = api._e2e.status();
    assert.strictEqual(st.injectedSha, st.anchor, "оболочка ссылается на текущий рантайм");
  });
}

if (PHASE === "window") {
  it("рантайм из оболочки загрузился и вышел на мост", async () => {
    await activate();
    const st = await waitFor(() => { const s = api._e2e.status(); return s.bridge.lastSeen > 0 ? s : null; }, 30000,
      "пинг окна по мосту (рантайм не загрузился: CSP / integrity / vscode-file?)");
    assert.strictEqual(st.errors, 0, "ошибок окна: " + st.errors + " — см. журнал «Документация C++»");
  });
  it("окно подключило поток событий (SSE) — без опроса файлов", async () => {
    await waitFor(() => api._e2e.status().bridge.streams >= 1, 20000, "поток событий окна");
  });
  it("окно снимается из оболочки", async () => {
    await api._e2e.disable();
    assert.strictEqual(api._e2e.status().injectedSha, "");
  });
}

async function run() {
  const failures = [];
  for (const t of tests) {
    try { await t.fn(); console.log("  ✔ [" + PHASE + "] " + t.name); }
    catch (e) { failures.push(t.name); console.log("  ✖ [" + PHASE + "] " + t.name + "\n      " + String(e && e.stack || e).split("\n").slice(0, 4).join("\n      ")); }
  }
  console.log("\n  фаза " + PHASE + ": " + (tests.length - failures.length) + " из " + tests.length);
  if (failures.length) throw new Error("провалено: " + failures.join("; "));
}

module.exports = { run };
