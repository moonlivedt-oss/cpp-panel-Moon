"use strict";

// Окно во вкладке VS Code (extension/lib/panel.js): HTML вкладки и приём записей от окна.
// Без VS Code: заглушка vscode, настоящие файлы во временной папке.

var fs = require("fs");
var os = require("os");
var path = require("path");
var Module = require("module");

const { check, finish } = require("./helpers");

var ROOT = path.join(__dirname, "..");
var TMP = fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-panel-"));
var orig = Module._resolveFilename;
Module._resolveFilename = function (r) { if (r === "vscode") return "vscode-stub-panel"; return orig.apply(this, arguments); };
require.cache["vscode-stub-panel"] = { id: "vscode-stub-panel", filename: "vscode-stub-panel", loaded: true, exports: {
  workspace: { workspaceFolders: [{ uri: { fsPath: ROOT } }], isTrusted: true,
    getConfiguration: function () { return { get: function () { return undefined; }, inspect: function () { return {}; } }; } },
  window: {}, commands: {}, languages: {}, env: {},
  Uri: { file: function (p) { return { fsPath: p }; }, parse: function (u) { return { toString: function () { return u; } }; } },
} };
var P = require(path.join(ROOT, "extension", "lib", "panel.js"));
Module._resolveFilename = orig;

var ctx = { extensionPath: path.join(ROOT, "extension"), globalStorageUri: { fsPath: TMP }, subscriptions: [] };
var web = { cspSource: "https://file+.vscode-resource.vscode-cdn.net", asWebviewUri: function (u) { return { toString: function () { return "https://file+.vscode-resource.vscode-cdn.net/x"; } }; } };

console.log("Окно во вкладке");
var html = P.buildHtml(ctx, web);
var nonce = (html.match(/script-src 'nonce-([A-Za-z0-9]+)'/) || [])[1];
check("CSP: скрипты только по nonce, без unsafe-inline/eval в script-src", !!nonce && !/script-src[^;]*unsafe/.test(html));
check("оба <script> несут этот nonce", (html.match(new RegExp('<script nonce="' + nonce + '">', "g")) || []).length === 2);
check("окно знает, что оно во вкладке", html.indexOf('window.__CPPDOCS_HOST__ = "webview"') !== -1);
check("рантайм и данные впечатаны", html.indexOf("__CPPDOCS_RUNTIME__") !== -1 && html.indexOf("window.__CPPDOCS__ = {") !== -1);
check("картинки — адресами webview", /"base":"https:\/\/file\+\.vscode-resource/.test(html) || html.indexOf("stickerImgs") === -1);

P.handleWrite(ctx, { type: "write", name: "cpp-docs-progress.json", text: "{\"id\":\"a\"}" });
check("зеркало прогресса — в хранилище", fs.readFileSync(path.join(TMP, "cpp-docs-progress.json"), "utf8") === "{\"id\":\"a\"}");
P.handleWrite(ctx, { type: "write", name: "cpp-docs-action.json", text: "{}" });
check("старый файловый канал действий — не пишется", !fs.existsSync(path.join(TMP, "cpp-docs-action.json")));
P.handleWrite(ctx, { type: "write", name: "settings.json", text: "{}" });
check("чужое имя — не пишется", !fs.existsSync(path.join(TMP, "settings.json")));
P.handleWrite(ctx, { type: "write", name: "cpp-docs-progress.json", text: "не json" });
check("не JSON — не пишется", fs.readFileSync(path.join(TMP, "cpp-docs-progress.json"), "utf8") !== "не json");
P.handleWrite(ctx, { type: "write", name: "../cpp-docs-action.json", text: "{}" });
check("путь с ../ — не пишется", !fs.existsSync(path.join(TMP, "..", "cpp-docs-action.json")));

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
finish("Окно во вкладке");
