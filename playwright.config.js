// Визуальная регрессия окна (npm run test:visual): Playwright снимает превью окна в разных
// состояниях и сравнивает с эталонами test/visual/__screenshots__/. Эталоны — отдельно на каждую ОС
// (шрифты рисуются по-разному), коммитятся для Windows. Обновить после осознанной правки вида:
//   npm run test:visual -- --update-snapshots
"use strict";

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "test/visual",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}-{platform}{ext}",
  timeout: 30000,
  retries: 0,
  reporter: [["list"]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" } },
  use: {
    baseURL: "http://127.0.0.1:8767",
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "reduce",
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
  },
  webServer: {
    command: "node scripts/preview-window.js docs && node scripts/serve-build.js 8767",
    url: "http://127.0.0.1:8767/preview-window.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
