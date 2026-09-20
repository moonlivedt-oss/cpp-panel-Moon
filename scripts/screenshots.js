#!/usr/bin/env node
// ============================================================
//  Генератор скриншотов для README (docs/screenshots/*.png).
//  Снимает три кадра из тех же превью, что собирают preview.js / preview-window.js:
//    • hero.png          — плавающее окно поверх «редактора», домашний экран
//    • window.png        — режим чтения: навигатор слева + читалка с подсветкой C++ и кнопкой «копировать»
//    • panel-sidebar.png — узкая боковая панель
//
//  Кадры снимаются в retina (deviceScaleFactor: 2) — PNG выходят чёткими. Превью отдаём
//  локальным http-сервером (не file://): так грузятся встроенные картинки-наклейки.
//
//  Playwright — dev-инструмент ТОЛЬКО для пересборки скриншотов; на рантайм расширения и на
//  тесты он не влияет (у пакета по-прежнему ноль зависимостей). Ставится разово:
//      npm i -D @playwright/test && npx playwright install chromium
//  Запуск (сам собирает превью):
//      npm run screenshots
//  либо вручную:
//      node scripts/preview-window.js docs && node scripts/preview.js docs && node scripts/screenshots.js
// ============================================================
"use strict";

var path = require("path");
var fs = require("fs");
var http = require("http");

var chromium;
try {
  chromium = require("@playwright/test").chromium;
} catch (e) {
  console.error(
    "Не найден Playwright — он нужен только для пересборки скриншотов.\n" +
      "Поставь разово и запусти снова:\n" +
      "  npm i -D @playwright/test && npx playwright install chromium\n" +
      "  npm run screenshots"
  );
  process.exit(1);
}

var ROOT = path.resolve(__dirname, "..");
var OUT = path.join(ROOT, "docs", "screenshots");
var TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".css": "text/css",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

// Минимальный статический сервер по корню репозитория (только чтение файлов внутри ROOT).
function startServer() {
  return new Promise(function (resolve) {
    var srv = http.createServer(function (req, res) {
      var p = decodeURIComponent((req.url || "/").split("?")[0]);
      var full = path.resolve(ROOT, "." + (p.charAt(0) === "/" ? p : "/" + p));
      if (full.indexOf(path.resolve(ROOT)) !== 0) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(full, function (err, buf) {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(full).toLowerCase()] || "application/octet-stream" });
        res.end(buf);
      });
    });
    srv.listen(0, "127.0.0.1", function () {
      resolve({ srv: srv, port: srv.address().port });
    });
  });
}

// Реалистичная «подложка редактора» за окном (только для hero): активити-бар + подкрашенный C++.
function editorBackdrop() {
  document.querySelectorAll(".hint").forEach(function (n) {
    n.remove();
  });
  var wb = document.querySelector(".monaco-workbench");
  if (!wb) return;
  var bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;left:0;top:0;bottom:0;width:48px;background:#181825;border-right:1px solid #11111b;z-index:0;display:flex;flex-direction:column;align-items:center;gap:18px;padding-top:14px;";
  bar.innerHTML = ["#89b4fa", "#6c7086", "#6c7086", "#6c7086"]
    .map(function (c, i) {
      return (
        '<div style="width:22px;height:22px;border-radius:5px;background:' +
        (i === 0 ? "rgba(137,180,250,.18)" : "transparent") +
        ';display:flex;align-items:center;justify-content:center"><div style="width:15px;height:15px;border-radius:3px;border:2px solid ' +
        c +
        '"></div></div>'
      );
    })
    .join("");
  wb.appendChild(bar);
  var fe = document.querySelector(".fake-edit");
  if (!fe) return;
  fe.style.paddingLeft = "80px";
  fe.style.opacity = ".55";
  var K = "#cba6f7",
    T = "#89b4fa",
    S = "#a6e3a1",
    F = "#89dceb",
    N = "#fab387",
    C = "#6c7086";
  var NL = String.fromCharCode(10);
  fe.innerHTML =
    '<span style="color:' + C + '">// game/Enemy.cpp</span>' + NL +
    '<span style="color:' + K + '">#include</span> <span style="color:' + S + '">"Enemy.h"</span>' + NL +
    '<span style="color:' + K + '">#include</span> <span style="color:' + S + '">&lt;vector&gt;</span>' + NL + NL +
    '<span style="color:' + T + '">void</span> <span style="color:' + F + '">Enemy</span>::<span style="color:' + F + '">update</span>(<span style="color:' + T + '">float</span> dt) {' + NL +
    '    <span style="color:' + K + '">for</span> (<span style="color:' + T + '">auto</span>&amp; p : patrol_) {' + NL +
    "        pos_ += p.dir * speed_ * dt;" + NL +
    '        <span style="color:' + K + '">if</span> (distance(pos_, target_) &lt; <span style="color:' + N + '">1.5f</span>)' + NL +
    '            state_ = <span style="color:' + F + '">State</span>::<span style="color:' + F + '">Chase</span>;' + NL +
    "    }" + NL +
    "}" + NL;
}

(function () {
  var winFile = path.join(ROOT, "build", "preview-window.html");
  var sideFile = path.join(ROOT, "build", "preview.html");
  if (!fs.existsSync(winFile) || !fs.existsSync(sideFile)) {
    console.error(
      "Нет build/preview-window.html или build/preview.html — сначала собери превью:\n" +
        "  node scripts/preview-window.js docs && node scripts/preview.js docs\n" +
        "(или просто: npm run screenshots)"
    );
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  startServer().then(function (s) {
    var srv = s.srv,
      port = s.port;
    var base = "http://127.0.0.1:" + port;
    chromium.launch().then(function (browser) {
      var done = function () {
        return browser.close().then(function () {
          srv.close();
        });
      };
      (async function () {
        // ---------- HERO: плавающее окно поверх «редактора», домашний экран ----------
        // Отдельный контекст: правки hero (спрятанная статья-подложка) не должны протечь в window.
        var ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1360, height: 850 }, colorScheme: "dark" });
        var page = await ctx.newPage();
        await page.goto(base + "/build/preview-window.html", { waitUntil: "networkidle" });
        await page.locator("#cppdocs-window").waitFor({ state: "visible", timeout: 10000 });
        await page.evaluate(editorBackdrop);
        await page.waitForTimeout(900);
        // Домашний экран — абсолютный оверлей поверх статьи-подложки. В headless она не успевает
        // догаснуть и просвечивает между карточками — прячем её и фиксируем home на opacity 1.
        await page.evaluate(function () {
          document.querySelectorAll("#cppdocs-window .cd-reader .cd-article").forEach(function (a) {
            a.style.display = "none";
          });
          var home = document.querySelector("#cppdocs-window .cd-home");
          if (home) {
            home.style.opacity = "1";
            home.style.animation = "none";
          }
        });
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(OUT, "hero.png") });
        console.log("saved docs/screenshots/hero.png");
        await ctx.close();

        // ---------- WINDOW: режим чтения темы с кодом (чистый контекст) ----------
        // Кнопку «копировать» (обычно видна только при наведении) показываем принудительно
        // через CSS — снимок получается детерминированным, без капризного hover.
        var ctxW = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1360, height: 850 }, colorScheme: "dark" });
        var pageW = await ctxW.newPage();
        await pageW.goto(base + "/build/preview-window.html", { waitUntil: "networkidle" });
        var winW = pageW.locator("#cppdocs-window");
        await winW.waitFor({ state: "visible", timeout: 10000 });
        await pageW.evaluate(function () {
          var st = document.createElement("style");
          st.textContent = "#cppdocs-window .copybtn{opacity:1 !important;}";
          document.head.appendChild(st);
        });
        await pageW.locator("#cppdocs-window .cd-item", { hasText: "Основы: сборка, типы, переменные" }).first().click();
        await pageW.waitForTimeout(800);
        await pageW.evaluate(function () {
          var cw = document.querySelector("#cppdocs-window .cd-reader .codewrap");
          if (cw) cw.scrollIntoView({ block: "center" });
        });
        await pageW.waitForTimeout(400);
        await winW.screenshot({ path: path.join(OUT, "window.png") });
        console.log("saved docs/screenshots/window.png");
        await ctxW.close();

        // ---------- DIAGRAM: рисованная схема-наклейка в контексте материала ----------
        var ctxD = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1360, height: 850 }, colorScheme: "dark" });
        var pageD = await ctxD.newPage();
        await pageD.goto(base + "/build/preview-window.html", { waitUntil: "networkidle" });
        var winD = pageD.locator("#cppdocs-window");
        await winD.waitFor({ state: "visible", timeout: 10000 });
        await pageD.locator("#cppdocs-window .cd-item", { hasText: "Основы: сборка, типы, переменные" }).first().click();
        await pageD.waitForTimeout(800);
        await pageD.evaluate(function () {
          var content = document.querySelector("#cppdocs-window .cd-content");
          var fig = document.querySelector("#cppdocs-window .cd-figure");   // первая фигура = рисованная схема int
          if (content && fig) {
            content.style.scrollBehavior = "auto";                          // мгновенно, без плавной прокрутки
            var cr = content.getBoundingClientRect(), fr = fig.getBoundingClientRect();
            content.scrollTop += (fr.top - cr.top) - 56;                    // фигуру к верху области чтения
          }
        });
        await pageD.waitForTimeout(500);
        await winD.screenshot({ path: path.join(OUT, "diagram.png") });
        console.log("saved docs/screenshots/diagram.png");
        await ctxD.close();

        // ---------- БОКОВАЯ ПАНЕЛЬ ----------
        var ctx2 = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 340, height: 820 }, colorScheme: "dark" });
        var page2 = await ctx2.newPage();
        await page2.goto(base + "/build/preview.html", { waitUntil: "networkidle" });
        await page2.waitForTimeout(500);
        await page2.screenshot({ path: path.join(OUT, "panel-sidebar.png") });
        console.log("saved docs/screenshots/panel-sidebar.png");
        await ctx2.close();

        console.log("\nГотово: hero.png, window.png, panel-sidebar.png в docs/screenshots/.");
      })()
        .then(done)
        .catch(function (e) {
          console.error(e);
          done().finally(function () {
            process.exit(1);
          });
        });
    });
  });
})();
