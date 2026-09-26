#!/usr/bin/env node
// Статический сервер папки build/ (превью окна) — для визуальных тестов Playwright.
// node scripts/serve-build.js [порт]   (по умолчанию 8767)
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");

const BUILD = path.join(__dirname, "..", "build");
const PORT = +process.argv[2] || 8767;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

http.createServer((req, res) => {
  const p = decodeURIComponent((req.url || "/").split("?")[0]);
  const file = path.resolve(BUILD, "." + (p === "/" ? "/preview-window.html" : p));
  if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log("build/ → http://127.0.0.1:" + PORT));
