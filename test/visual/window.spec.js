/* global window, localStorage -- код внутри page.evaluate / addInitScript исполняется в браузере */
// Визуальная регрессия плавающего окна: главная, чтение темы, темы оформления, интерактивные блоки.
// Время заморожено (приветствие, тепловая карта, «задача дня» зависят от даты), анимации выключены,
// состояние окна задаётся заранее — снимки детерминированы.
"use strict";

const { test, expect } = require("@playwright/test");

const NOW = new Date("2026-09-26T10:00:00+03:00");

/** Открыть превью с заданным состоянием окна (localStorage) и открыть окно. */
async function openWindow(page, state) {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((st) => {
    localStorage.setItem("cppdocs.ui.v1", JSON.stringify(Object.assign({ v: 3, tourDone: true, _savedAt: 1 }, st)));
  }, state || {});
  await page.goto("/preview-window.html");
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await page.evaluate(() => window.__cppDocs.open());
  await page.waitForSelector("#cppdocs-window .cd-home, #cppdocs-window .cd-article", { state: "attached" });
  await page.waitForTimeout(300);
}
async function openTopic(page, titleRe) {
  await page.locator("#cppdocs-window .cd-item").filter({ hasText: titleRe }).first().click();
  await page.waitForSelector("#cppdocs-window .cd-article h1.cd-atitle");
  await page.waitForTimeout(200);
}
const win = (page) => page.locator("#cppdocs-window");

test("главная — тёмная тема", async ({ page }) => {
  await openWindow(page, { read: { "00-НАЧНИ-ОТСЮДА.md": true }, days: { "2026-09-25": 3, "2026-09-26": 1 } });
  await expect(win(page)).toHaveScreenshot("home-dark.png");
});

test("главная — светлая тема", async ({ page }) => {
  await openWindow(page, { theme: "light" });
  await expect(win(page)).toHaveScreenshot("home-light.png");
});

test("чтение темы — обложка, крошки, прогресс по разделам", async ({ page }) => {
  await openWindow(page, {});
  await openTopic(page, /Основы: сборка/);
  await expect(win(page)).toHaveScreenshot("topic-osnovy.png");
});

test("чтение темы — сепия", async ({ page }) => {
  await openWindow(page, { theme: "sepia" });
  await openTopic(page, /Основы: сборка/);
  await expect(win(page)).toHaveScreenshot("topic-sepia.png");
});

test("«Память по шагам» — третий шаг", async ({ page }) => {
  await openWindow(page, {});
  await openTopic(page, /Ссылки и указатели/);
  const mem = page.locator("#cppdocs-window .cd-mem").first();
  await mem.scrollIntoViewIfNeeded();
  for (let i = 0; i < 2; i++) await mem.locator('[data-mem="next"]').click();
  await expect(mem).toHaveScreenshot("memory-step3.png");
});

test("«Кадры» — первый кадр", async ({ page }) => {
  await openWindow(page, {});
  await openTopic(page, /Время и игровой цикл|Время/);
  const fr = page.locator("#cppdocs-window .cd-frames").first();
  await fr.scrollIntoViewIfNeeded();
  await expect(fr).toHaveScreenshot("frames-first.png");
});

test("меню настроек", async ({ page }) => {
  await openWindow(page, {});
  await openTopic(page, /Основы: сборка/);
  await page.locator("#cppdocs-window .cd-rbtn[title^=\"Настройки\"]").click();
  await expect(page.locator("#cppdocs-window .cd-viewmenu")).toHaveScreenshot("settings-menu.png");
});
