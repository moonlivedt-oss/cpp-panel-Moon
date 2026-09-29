#!/usr/bin/env node
// ============================================================
//  Интеграционные тесты в настоящем VS Code (@vscode/test-electron).
//
//  npm run test:vscode            — фаза basic: активация, команды, вкладка, подсказки, мост.
//                                   VS Code: $VSCODE_EXE → скачанный stable (на CI) → установленный.
//  npm run test:vscode -- --window — ещё и настоящее окно: впечатать в оболочку, перезапустить,
//                                   дождаться, что рантайм загрузился и вышел на мост. Только на
//                                   ОДНОРАЗОВОЙ копии VS Code: скачанной (--download, на CI) или
//                                   песочнице из установленной (--sandbox, Windows: жёсткие ссылки
//                                   + чистая копия папки оболочки). Твою установку тест не трогает.
// ============================================================
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { runTests, downloadAndUnzipVSCode } = require("@vscode/test-electron");

const ROOT = path.join(__dirname, "..", "..");
const args = process.argv.slice(2);
const WANT_WINDOW = args.includes("--window");
const WANT_SANDBOX = args.includes("--sandbox");
const WANT_DOWNLOAD = args.includes("--download") || !!process.env.CI;

function installedVSCode() {
  const c = [];
  if (process.platform === "win32") {
    c.push(path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "Code.exe"));
    c.push(path.join(process.env.ProgramFiles || "C:\\Program Files", "Microsoft VS Code", "Code.exe"));
  } else if (process.platform === "darwin") c.push("/Applications/Visual Studio Code.app/Contents/MacOS/Electron");
  else c.push("/usr/share/code/code", "/usr/bin/code");
  return c.find((p) => p && fs.existsSync(p)) || null;
}

/** Песочница из установленного VS Code (Windows): жёсткие ссылки на всё, кроме папки оболочки —
 *  её копируем по-настоящему и кладём ЧИСТЫЙ workbench.html (без чужих и наших вставок). */
function sandboxFrom(exe) {
  const src = path.dirname(exe);
  const dst = path.join(os.tmpdir(), "cppdocs-vscode-sandbox");
  fs.rmSync(dst, { recursive: true, force: true });
  (function walk(from, to) {
    fs.mkdirSync(to, { recursive: true });
    const isShell = /[\\/]electron-browser[\\/]workbench$/.test(from);
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const a = path.join(from, e.name), b = path.join(to, e.name);
      if (e.isDirectory()) walk(a, b);
      else if (isShell) fs.copyFileSync(a, b);
      else { try { fs.linkSync(a, b); } catch (err) { fs.copyFileSync(a, b); } }
    }
  })(src, dst);
  // чистая оболочка: самый маленький бэкап чужих загрузчиков, где есть workbench.js, иначе — наш бэкап
  const WB = require(path.join(ROOT, "extension", "lib", "wb-patch.js"));
  for (const wb of WB.findWorkbenchIn(path.join(dst), 9).filter((f) => /[\\/]workbench[\\/]workbench\.html$/.test(f))) {
    const dir = path.dirname(wb);
    const clean = fs.readdirSync(dir).filter((n) => /\.bak-custom-css$|\.cppdocs-backup$/.test(n))
      .map((n) => path.join(dir, n)).filter((p) => /workbench\.js/.test(fs.readFileSync(p, "utf8")) && !/CPPDOCS-WINDOW|VSCODE-CUSTOM-CSS-START/.test(fs.readFileSync(p, "utf8")))
      .sort((x, y) => fs.statSync(x).size - fs.statSync(y).size)[0];
    fs.unlinkSync(wb);
    if (clean) fs.copyFileSync(clean, wb);
    else fs.writeFileSync(wb, WB.stripWindowInjection(fs.readFileSync(path.join(src, path.relative(dst, wb)), "utf8")));
  }
  return path.join(dst, path.basename(exe));
}

async function main() {
  let exe = process.env.VSCODE_EXE || null;
  if (!exe && (WANT_DOWNLOAD || (WANT_WINDOW && !WANT_SANDBOX))) exe = await downloadAndUnzipVSCode("stable");
  // macOS: в новых сборках VS Code бинарник в .app называется Code, а test-electron 2.x ждёт Electron.
  if (exe && !fs.existsSync(exe) && path.basename(exe) === "Electron" && fs.existsSync(path.join(path.dirname(exe), "Code")))
    exe = path.join(path.dirname(exe), "Code");
  if (!exe) exe = installedVSCode();
  if (!exe) throw new Error("VS Code не найден: задайте VSCODE_EXE или запустите с --download");
  if (WANT_WINDOW && WANT_SANDBOX) {
    if (process.platform !== "win32") throw new Error("--sandbox — только Windows; на других ОС: --download");
    exe = sandboxFrom(exe);
  }
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-e2e-ud-"));
  const extDir = fs.mkdtempSync(path.join(os.tmpdir(), "cppdocs-e2e-ext-"));
  const base = {
    vscodeExecutablePath: exe,
    extensionDevelopmentPath: path.join(ROOT, "extension"),
    extensionTestsPath: path.join(__dirname, "suite.js"),
    launchArgs: [ROOT, "--user-data-dir", userData, "--extensions-dir", extDir, "--disable-workspace-trust",
      "--skip-welcome", "--skip-release-notes", "--disable-gpu"],
  };
  console.log("VS Code: " + exe);
  const phases = WANT_WINDOW ? ["basic", "inject", "window"] : ["basic"];
  for (const phase of phases) {
    console.log("\n=== фаза " + phase + " ===");
    await runTests(Object.assign({}, base, { extensionTestsEnv: { CPPDOCS_E2E_PHASE: phase } }));
  }
  for (const d of [userData, extDir]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* VS Code мог ещё держать файлы */ } }
}

main().catch((e) => { console.error("\n✖ интеграционные тесты: " + (e && e.message || e)); process.exit(1); });
