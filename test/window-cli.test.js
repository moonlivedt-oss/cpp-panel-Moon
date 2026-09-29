"use strict";

// Окно из командной строки (extension/window-cli.js) и мостик установщика (installer/tools/window.js)
// на поддельной установке VS Code во временной папке: батники зовут ровно этот код.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CLI = require(path.join(ROOT, "extension", "window-cli.js"));
const TOOL = require(path.join(ROOT, "installer", "tools", "window.js"));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-cli-"));
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* не критично */ } });

const ORIG = "<html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; trusted-types amdLoader\"><!-- MOONX --></head><body></body></html>";

/** Поддельная установка: Code.exe, оболочка в подпапке с хэшем, product.json, данные окна. */
function fakeInstall(name, withData) {
  const base = path.join(TMP, name);
  const exeDir = path.join(base, "vs");
  const app = path.join(exeDir, "abc123", "resources", "app");
  const wbDir = path.join(app, "out", "vs", "code", "electron-sandbox", "workbench");
  fs.mkdirSync(wbDir, { recursive: true });
  fs.writeFileSync(path.join(exeDir, "Code.exe"), "");
  fs.writeFileSync(path.join(app, "product.json"), JSON.stringify({ nameShort: "Code", nameLong: "Visual Studio Code", dataFolderName: ".vscode" }));
  const wb = path.join(wbDir, "workbench.html");
  fs.writeFileSync(wb, ORIG);
  const storage = path.join(base, "appdata", "Code", "User", "globalStorage", "moonlivedt.cpp-docs-panel");
  fs.mkdirSync(storage, { recursive: true });
  if (withData) {
    fs.writeFileSync(path.join(storage, "cpp-docs-data.js"),
      "window.__CPPDOCS__ = " + JSON.stringify({ files: [{ rel: "a.md", title: "A", md: "ОЧЕНЬ-ДЛИННЫЙ-ТЕКСТ" }] }) + ";\n");
  }
  return { execPath: path.join(exeDir, "Code.exe"), wb, storage,
    env: { APPDATA: path.join(base, "appdata"), USERPROFILE: path.join(base, "home") } };
}
function run(cmd, f, extra) {
  const lines = [];
  const code = CLI.main([cmd], Object.assign({ execPath: f.execPath, env: f.env, say: (s) => lines.push(s) }, extra || {}));
  return { code, out: lines.join("\n") };
}

test("window-cli: подключение, повтор без дублей, снятие байт в байт", () => {
  const f = fakeInstall("ok", true);
  const r = run("inject", f);
  assert.equal(r.code, CLI.EXIT.OK, r.out);
  const html = fs.readFileSync(f.wb, "utf8");
  assert.ok(html.indexOf("<!-- CPPDOCS-WINDOW-START -->") !== -1);
  assert.ok(html.indexOf("ОЧЕНЬ-ДЛИННЫЙ-ТЕКСТ") === -1, "тексты материалов в оболочку не идут");
  assert.ok(/"lazy":true/.test(html) && /"scriptNonce":"[A-Za-z0-9]+"/.test(html));
  const src = html.match(/<script nonce="[^"]+" src="(vscode-file:\/\/vscode-app\/[^"]+)" integrity="sha256-[^"]+"/);
  assert.ok(src, "рантайм подключён ссылкой с SRI");
  assert.ok(fs.readdirSync(f.storage).some((n) => /^cpp-docs-runtime-[0-9a-f]{12}\.js$/.test(n)), "рантайм разложен в хранилище");
  assert.ok(/script-src 'self' 'nonce-[A-Za-z0-9]+' file:/.test(html) && /trusted-types amdLoader cppdocs/.test(html));
  assert.ok(!/style-src[^;]*'nonce-/.test(html), "при 'unsafe-inline' nonce в style-src не ставится");

  assert.equal(run("inject", f).code, CLI.EXIT.OK);
  const again = fs.readFileSync(f.wb, "utf8");
  assert.equal(again.split("CPPDOCS-WINDOW-START").length - 1, 1, "один блок");
  assert.equal((again.match(/'nonce-[A-Za-z0-9]+' file:/g) || []).length, 1, "один свой nonce");

  assert.equal(run("status", f).code, CLI.EXIT.OK);
  assert.equal(run("remove", f).code, CLI.EXIT.OK);
  assert.equal(fs.readFileSync(f.wb, "utf8"), ORIG, "оболочка вернулась байт в байт");
});

test("window-cli: нет данных, Moon Core, нет прав, подменённый рантайм", () => {
  const nd = fakeInstall("nodata", false);
  assert.equal(run("inject", nd).code, CLI.EXIT.NO_DATA);
  assert.equal(fs.readFileSync(nd.wb, "utf8"), ORIG);

  const mc = fakeInstall("mc", true);
  fs.writeFileSync(mc.wb, ORIG.replace("<!-- MOONX -->", "<!-- MOONCORE-START --><!-- MOONCORE-END -->"));
  assert.equal(run("inject", mc).code, CLI.EXIT.MOONCORE);

  const bad = fakeInstall("bad", true);
  const extDir = path.join(TMP, "bad", "ext");
  fs.mkdirSync(extDir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, "extension", "extension.js"), path.join(extDir, "extension.js"));
  fs.writeFileSync(path.join(extDir, "cpp-docs-runtime.js"), fs.readFileSync(path.join(ROOT, "extension", "cpp-docs-runtime.js"), "utf8") + "\n// чужая правка");
  assert.equal(run("inject", bad, { extDir }).code, CLI.EXIT.FAIL);
  assert.equal(fs.readFileSync(bad.wb, "utf8"), ORIG, "подменённый рантайм не впечатывается");

  if (process.platform === "win32") {
    const ro = fakeInstall("ro", true);
    fs.chmodSync(ro.wb, 0o444);
    try {
      assert.equal(run("writable", ro).code, CLI.EXIT.DENIED);
      assert.equal(run("inject", ro).code, CLI.EXIT.DENIED);
    } finally { fs.chmodSync(ro.wb, 0o666); }
    assert.equal(run("writable", ro).code, CLI.EXIT.OK);
  }
});

test("window-cli: папка данных — портативный режим и имя редактора из product.json", () => {
  const f = fakeInstall("paths", true);
  assert.equal(CLI.userDataDir(f.execPath, { nameShort: "VSCodium" }, { APPDATA: "X" }), path.join("X", "VSCodium"));
  fs.mkdirSync(path.join(path.dirname(f.execPath), "data"));
  assert.equal(CLI.userDataDir(f.execPath, {}, { APPDATA: "X" }), path.join(path.dirname(f.execPath), "data", "user-data"));
});

test("tools/window.js: самая новая версия расширения, без устаревших", () => {
  const dir = path.join(TMP, "exts");
  const mk = (n) => { fs.mkdirSync(path.join(dir, n), { recursive: true }); fs.writeFileSync(path.join(dir, n, "package.json"), "{}"); };
  ["moonlivedt.cpp-docs-panel-3.9.0", "moonlivedt.cpp-docs-panel-3.10.0", "local.cpp-docs-panel-3.11.0", "moonlivedt.moon-core-0.1.0"].forEach(mk);
  fs.writeFileSync(path.join(dir, ".obsolete"), JSON.stringify({ "local.cpp-docs-panel-3.11.0": true }));
  // Без extensions.json — по именам папок: 3.10.0 новее 3.9.0 (не строкой), устаревшая 3.11.0 пропущена.
  assert.equal(TOOL.findExtension(dir, ["moonlivedt.cpp-docs-panel", "local.cpp-docs-panel"]), path.join(dir, "moonlivedt.cpp-docs-panel-3.10.0"));
  // С реестром VS Code — он главный.
  fs.writeFileSync(path.join(dir, "extensions.json"), JSON.stringify([
    { identifier: { id: "moonlivedt.cpp-docs-panel" }, version: "3.9.0", relativeLocation: "moonlivedt.cpp-docs-panel-3.9.0" },
  ]));
  assert.equal(TOOL.findExtension(dir, ["moonlivedt.cpp-docs-panel"]), path.join(dir, "moonlivedt.cpp-docs-panel-3.9.0"));
  assert.equal(TOOL.findExtension(dir, ["moonlivedt.moon-core"]), "");
  assert.equal(TOOL.extensionsDir("C:/x/Code.exe", { VSCODE_EXTENSIONS: dir }), dir);
  // Нет расширения — код 6, старое без window-cli.js — код 5.
  assert.equal(TOOL.main(["inject"], { execPath: "C:/nowhere/Code.exe", env: { VSCODE_EXTENSIONS: path.join(TMP, "empty") }, say: () => {} }), 6);
  assert.equal(TOOL.main(["inject"], { execPath: "C:/nowhere/Code.exe", env: { VSCODE_EXTENSIONS: dir }, say: () => {} }), 5);
});

test("модуль Moon Core объявляет политику Trusted Types, которую создаёт рантайм окна", () => {
  // Без неё Moon Core не впишет политику в CSP, и в VS Code 1.139+ окно не появится.
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "extension", "package.json"), "utf8"));
  const mod = pkg.moonCore.modules.find((m) => m.id === "cppdocs");
  const rt = fs.readFileSync(path.join(ROOT, "extension", "runtime", "01-utils-stickers.js"), "utf8");
  const name = (rt.match(/createPolicy\("([a-z0-9-]+)"/) || [])[1];
  assert.ok(name, "рантайм создаёт политику");
  assert.deepStrictEqual(mod.trustedTypes, [name]);
});
