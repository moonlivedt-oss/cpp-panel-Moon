#!/usr/bin/env node
// ============================================================
//  Режим разработки окна: npm run dev
//
//  Следит за частями рантайма (extension/runtime/), протоколом (extension/lib/protocol.js) и
//  документацией (docs/). На каждое сохранение: собирает рантайм + якорь SHA-256, пересобирает
//  превью build/preview-window.html — и открытая страница превью перезагружается сама.
//
//  Открыть: http://localhost:8766/preview-window.html   (порт: DEV_PORT=…)
// ============================================================
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const cp = require("child_process");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, "build");
const PORT = +process.env.DEV_PORT || 8766;
const clients = new Set();

// Клиент живой перезагрузки: вставляется в отдаваемые HTML-страницы (на диск не пишется).
const RELOAD = '<script>(function(){var es=new EventSource("/__reload");es.onmessage=function(){location.reload();};' +
  'es.addEventListener("error-build",function(e){console.error("[dev] сборка упала:\\n"+e.data);});})();</script>';
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

function send(event, data) {
  const msg = (event ? "event: " + event + "\n" : "") + "data: " + String(data).replace(/\n/g, "\ndata: ") + "\n\n";
  for (const r of clients) { try { r.write(msg); } catch (e) { clients.delete(r); } }
}

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url === "/__reload") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    res.write("retry: 1000\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  const file = path.join(BUILD, url === "/" ? "preview-window.html" : url);
  if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("нет такого файла"); return; }
  const ext = path.extname(file);
  let body = fs.readFileSync(file);
  if (ext === ".html") body = Buffer.from(body.toString("utf8").replace(/<\/body>/i, RELOAD + "</body>"), "utf8");
  res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(body);
}).listen(PORT, "127.0.0.1", () => console.log("[dev] превью: http://localhost:" + PORT + "/preview-window.html"));

function run(args) {
  const r = cp.spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "").trim() || args.join(" ") + " — код " + r.status);
  return r.stdout;
}
let timer = null, busy = false, again = false;
function rebuild(why) {
  if (busy) { again = true; return; }
  busy = true;
  const t0 = Date.now();
  try {
    run(["scripts/build-runtime.js"]);
    run(["scripts/hash-runtime.js"]);
    run(["--check", "extension/cpp-docs-runtime.js"]);
    run(["scripts/preview-window.js", "docs"]);
    console.log("[dev] " + why + " → собрано за " + (Date.now() - t0) + " мс, перезагружаю превью");
    send("", "reload");
  } catch (e) {
    console.error("[dev] ✗ " + why + ": " + e.message);
    send("error-build", e.message);
  }
  busy = false;
  if (again) { again = false; rebuild("изменения во время сборки"); }
}
function schedule(why) { clearTimeout(timer); timer = setTimeout(() => rebuild(why), 150); }

function watch(dir, opts, filter) {
  try {
    fs.watch(path.join(ROOT, dir), opts, (evt, name) => { if (name && filter(String(name))) schedule(dir + "/" + name); });
  } catch (e) { console.warn("[dev] не слежу за " + dir + ": " + e.message); }
}
watch("extension/runtime", {}, (n) => /\.js$/.test(n));
watch("extension/lib", {}, (n) => n === "protocol.js");
watch("docs", { recursive: true }, (n) => /\.md$/.test(n));
rebuild("старт");
