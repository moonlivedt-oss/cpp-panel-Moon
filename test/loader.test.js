"use strict";

// Загрузчик окна (lib/wb-patch.js, lib/window.js, lib/data.js) и индекс поиска (lib/docs.js):
//   • в оболочку впечатывается только оглавление + <script src integrity>, тексты — отдельно;
//   • рантайм кладётся в хранилище под именем с хэшем, integrity совпадает с содержимым;
//   • CSP чистой оболочки впускает мост (connect-src) и политику Trusted Types «cppdocs»;
//   • поиск по индексу расширения находит то же, что прежний разбор markdown в окне.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const Module = require("module");

const ROOT = path.join(__dirname, "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-loader-"));
const orig = Module._resolveFilename;
Module._resolveFilename = function (r) { return r === "vscode" ? "vscode-stub-loader" : orig.apply(this, arguments); };
require.cache["vscode-stub-loader"] = { id: "vscode-stub-loader", filename: "vscode-stub-loader", loaded: true, exports: {
  workspace: { workspaceFolders: [{ uri: { fsPath: ROOT } }], isTrusted: true, getConfiguration: () => ({ get: () => undefined, inspect: () => ({}) }) },
  window: {}, env: {}, commands: {}, Uri: { file: (p) => ({ fsPath: p }) },
} };
const WB = require(path.join(ROOT, "extension", "lib", "wb-patch.js"));
const W = require(path.join(ROOT, "extension", "lib", "window.js"));
const D = require(path.join(ROOT, "extension", "lib", "data.js"));
const DOCS = require(path.join(ROOT, "extension", "lib", "docs.js"));
Module._resolveFilename = orig;
const { loadRuntime } = require(path.join(__dirname, "support", "runtime-env.js"));

const ctx = { extensionPath: path.join(ROOT, "extension"), globalStorageUri: { fsPath: TMP }, subscriptions: [], globalState: { get: () => undefined } };
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* не критично */ } });

test("Загрузчик: в оболочку — только оглавление", () => {
  const body = D.windowDataBody(ctx, "n0nce");
  const data = JSON.parse(body.replace(/^window\.__CPPDOCS__ = /, "").replace(/;\s*$/, "").replace(/\\u003c/g, "<"));
  assert.equal(data.lazy, true);
  assert.ok(data.files.length > 10);
  assert.ok(data.files.every((f) => f.md === "" && !f.sx), "тексты и индекс не впечатываются");
  assert.ok(typeof data.dataUrl === "string" && data.scriptNonce === "n0nce");
  assert.ok(body.length < 64 * 1024, "блок данных " + Math.round(body.length / 1024) + " КБ");
  const full = D.windowData(ctx);
  assert.ok(full.files.some((f) => f.md.length > 1000 && Array.isArray(f.sx) && f.sx.length), "полный файл — с текстами и индексом");
});

test("Загрузчик: рантайм в хранилище под хэшем, integrity сходится", () => {
  const js = "/* __CPPDOCS_RUNTIME__ */ var x = 1;" + "x".repeat(6000);
  const sha = crypto.createHash("sha256").update(js, "utf8").digest("hex");
  const st = W.stageRuntime(ctx, js, sha);
  assert.equal(path.basename(st.path), "cpp-docs-runtime-" + sha.slice(0, 12) + ".js");
  assert.equal(fs.readFileSync(st.path, "utf8"), js);
  assert.equal(st.integrity, "sha256-" + crypto.createHash("sha256").update(js, "utf8").digest("base64"));
  assert.match(st.src, /^vscode-file:\/\/vscode-app\//);
  // вторая версия: старая остаётся (текущий сеанс VS Code на ней), третья — самая старая уходит
  const js2 = js + "2", js3 = js + "3";
  W.stageRuntime(ctx, js2, crypto.createHash("sha256").update(js2).digest("hex"));
  W.stageRuntime(ctx, js3, crypto.createHash("sha256").update(js3).digest("hex"));
  const left = fs.readdirSync(TMP).filter((n) => /^cpp-docs-runtime-[0-9a-f]{12}\.js$/.test(n));
  assert.equal(left.length, 2, left.join());
});

test("Загрузчик: блок для оболочки — <script src integrity>, SHA читается обратно", () => {
  const sha = "a".repeat(64);
  const block = WB.buildWindowBlock("window.__CPPDOCS__ = {};", { src: "vscode-file://vscode-app/c:/x/cpp-docs-runtime-aaaaaaaaaaaa.js", integrity: "sha256-XYZ=", sha }, "N1");
  assert.match(block, /<script nonce="N1" src="vscode-file:\/\/vscode-app\/c:\/x\/cpp-docs-runtime-aaaaaaaaaaaa\.js" integrity="sha256-XYZ=" data-cppdocs-sha="a{64}"><\/script>/);
  assert.ok(block.indexOf("__CPPDOCS_RUNTIME__") === -1, "код рантайма не впечатан");
  const html = WB.applyWindowInjection("<html><head></head><body></body></html>", block);
  assert.equal(WB.injectedRuntimeSha(html), sha);
  assert.equal(WB.injectedRuntimeSha("<html></html>"), "");
  const q = WB.buildWindowBlock("x", { src: "vscode-file://a\"><script>b", integrity: "i", sha: "s" }, "");
  assert.ok(q.indexOf("\"><script>b") === -1, "кавычки в адресе экранированы");
});

test("CSP чистой оболочки: мост и Trusted Types впущены, при отключении — сняты", () => {
  const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\' \'unsafe-eval\' blob:; style-src \'self\' \'unsafe-inline\'; connect-src \'self\' https: ws:; require-trusted-types-for \'script\'; trusted-types amdLoader dompurify;">';
  const html = "<html><head>" + csp + "</head><body></body></html>";
  const armed = WB.armCspWithNonce(html, "N2");
  assert.match(armed, /connect-src 'self' https: ws: http:\/\/127\.0\.0\.1:\*/);
  assert.match(armed, /trusted-types amdLoader dompurify cppdocs/);
  assert.match(armed, /script-src [^;]*'nonce-N2' file:/);
  const again = WB.armCspWithNonce(armed, "N3");
  assert.equal((again.match(/127\.0\.0\.1/g) || []).length, 1, "повторное подключение не дублирует");
  assert.equal((again.match(/ cppdocs/g) || []).length, 1);
  assert.equal(WB.stripOurNonces(again.match(/<meta[^>]*>/)[0]), csp);
});

test("Индекс поиска: разделы, якоря как у окна, без кода", () => {
  const sx = DOCS.searchSections("# Файл\nвступление\n## Раздел `vector`\nтекст про push_back\n```cpp\nint secret;\n```\n### Под **раздел**\nещё\n");
  assert.deepEqual(sx.map((s) => s.s), ["", "раздел-vector", "под-раздел"]);
  assert.ok(sx[1].x.indexOf("push_back") !== -1 && sx.every((s) => s.x.indexOf("secret") === -1));
  const api = loadRuntime(null);
  ["Раздел `vector`", "Под **раздел**", "Что такое `std::map`?", "[ссылка](x.md) и текст"].forEach((h) => assert.equal(DOCS.slugify(h), api.slugify(h), h));
});

test("Индекс поиска: окно находит то же, что прежний разбор markdown", () => {
  const full = D.windowData(ctx);
  const api = loadRuntime(null);
  const QUERIES = ["vector", "push_back", "указатель", "цикл", "исключение", "шаблон", "итератор", "лямбда", "cmake", "ссылк"];
  let compared = 0;
  const diffs = [];
  full.files.forEach((f) => {
    QUERIES.forEach((q) => {
      const a = api.searchHit({ md: f.md, title: f.title, subtitle: f.subtitle, name: f.name }, q);
      const b = api.searchHit(f, q);
      compared++;
      if (!!a !== !!b || (a && b && a.slug !== b.slug)) diffs.push(f.rel + " «" + q + "»: " + (a && a.slug) + " ≠ " + (b && b.slug));
    });
  });
  assert.ok(compared > 500);
  assert.ok(diffs.length <= compared * 0.02, "расхождений " + diffs.length + ":\n" + diffs.slice(0, 10).join("\n"));
});
