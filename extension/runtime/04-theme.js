  // ==== runtime/04-theme.js — тема и акцентный цвет ====
  // ---------------------------------------------------------------------------
  //  Тема: светлая/тёмная берётся из класса воркбенча VS Code.
  // ---------------------------------------------------------------------------
  function isLight() {
    if (state.theme === "light" || state.theme === "sepia") return true;  // ручной выбор (сепия — светлая по токенам)
    if (state.theme === "dark") return false;
    try {
      var bc = document.body && document.body.classList;
      if (bc && (bc.contains("vscode-light") || bc.contains("vscode-high-contrast-light"))) return true;
      if (bc && (bc.contains("vscode-dark") || bc.contains("vscode-high-contrast"))) return false;
      var wb = document.querySelector(".monaco-workbench");
      if (wb && wb.classList) {
        if (wb.classList.contains("vs") && !wb.classList.contains("vs-dark") && !wb.classList.contains("hc-black")) return true;
        if (wb.classList.contains("vs-dark") || wb.classList.contains("hc-black")) return false;
      }
      return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
    } catch (e) { return false; }
  }

  // ---------------------------------------------------------------------------
  //  Акцентный цвет — под тему пользователя.
  //  Берём его из живых CSS-переменных оболочки VS Code (окно живёт в её DOM, а не в
  //  песочнице webview, поэтому переменные доступны). Приоритет:
  //    1) --mlbg-accent(-rgb) от MoonLight custom-bg — это акцент, которым он красит весь
  //       редактор (обычно вычислен из обоев); так окно совпадает с остальным интерфейсом
  //       и само меняется вслед за сменой обоев/слайд-шоу;
  //    2) --vscode-focusBorder / кнопки / ссылки — сам акцент активной темы;
  //    3) запасной Catppuccin-синий, если ничего не нашли.
  //  Значение (r,g,b) выставляем в --cppdocs-ac / --cppdocs-ac-rgb / --cppdocs-ac2 на :root,
  //  откуда его наследуют и окно, и кнопка-запуск. Обновляется в heal (тема/обои сменились).
  function readCssVar(name) {
    var els = [document.documentElement, document.body, document.querySelector(".monaco-workbench")];
    for (var i = 0; i < els.length; i++) {
      if (!els[i]) continue;
      try { var v = getComputedStyle(els[i]).getPropertyValue(name).trim(); if (v) return v; } catch (e) {}
    }
    return "";
  }
  function toRgb(str) {
    str = String(str || "").trim();
    if (!str) return null;
    var m;
    if ((m = str.match(/^#([0-9a-fA-F]{3})$/))) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
    if ((m = str.match(/^#([0-9a-fA-F]{6,8})$/))) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    if ((m = str.match(/rgba?\(([^)]+)\)/i))) {
      var p = m[1].split(",").map(function (x) { return parseFloat(x); });
      if (p.length >= 3 && p.slice(0, 3).every(function (n) { return isFinite(n); })) return [p[0] | 0, p[1] | 0, p[2] | 0];
    }
    // строка вида "137, 180, 250" (формат --mlbg-accent-rgb)
    if (/^\d[\d.\s,]*$/.test(str)) {
      var q = str.split(",").map(function (x) { return parseFloat(x); });
      if (q.length >= 3 && q.slice(0, 3).every(function (n) { return isFinite(n); })) return [q[0] | 0, q[1] | 0, q[2] | 0];
    }
    return null;
  }
  function resolveAccentRgb() {
    var rgb = toRgb(readCssVar("--mlbg-accent-rgb")) || toRgb(readCssVar("--mlbg-accent"));
    if (!rgb) {
      var cands = ["--vscode-focusBorder", "--vscode-button-background", "--vscode-textLink-foreground", "--vscode-progressBar-background"];
      for (var i = 0; i < cands.length && !rgb; i++) rgb = toRgb(readCssVar(cands[i]));
    }
    if (!rgb) rgb = isLight() ? [30, 102, 245] : [137, 180, 250];
    return rgb;
  }
  function mix(rgb, amt) { // amt 0..1 в сторону белого
    return [Math.round(rgb[0] + (255 - rgb[0]) * amt), Math.round(rgb[1] + (255 - rgb[1]) * amt), Math.round(rgb[2] + (255 - rgb[2]) * amt)];
  }
  // Контраст по WCAG: относительная яркость и отношение двух цветов.
  function lum(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  // Светлая тема/сепия поверх тёмного VS Code: акцент темы редактора светлый (сиреневый Mocha)
  // и на светлом фоне не читается. Затемняем его, сохраняя оттенок, до контраста ≥ 4.5:1.
  function darkenFor(rgb, bg) {
    var out = rgb.slice();
    for (var i = 0; i < 40 && contrast(out, bg) < 4.5; i++) out = out.map(function (v) { return Math.round(v * 0.92); });
    return out;
  }
  var _lastAccent = "", _accentSig = "";
  function applyAccent() {
    try {
      // Дешёвая сигнатура «могло ли что-то поменяться»: тема-класс оболочки + ручная тема +
      // текущий mlbg-акцент (один readCssVar). Пока не изменилась — не зовём resolveAccentRgb
      // (тот делает до ~18 getComputedStyle). Так heal на тикере почти не стоит стилевого пересчёта.
      var wb = document.querySelector(".monaco-workbench");
      var sig = (wb ? wb.className : "") + "|" + state.theme + "|" + state.palette + "|" + readCssVar("--mlbg-accent-rgb");
      if (sig === _accentSig) return;
      _accentSig = sig;
      var pal = activePalette();
      var rgb = pal ? toRgb(pal.ac) : resolveAccentRgb();   // своя палитра — свой акцент, иначе из редактора
      if (isLight()) rgb = darkenFor(rgb, state.theme === "sepia" ? [244, 236, 220] : [250, 250, 252]);
      var key = rgb.join(",") + "/" + (isLight() ? "l" : "d");
      if (key === _lastAccent) return;      // ничего не изменилось — не трогаем стиль
      _lastAccent = key;
      var ac2 = isLight() ? rgb : mix(rgb, 0.32); // на тёмной — светлее, для заголовков
      var s = document.documentElement.style;
      s.setProperty("--cppdocs-ac", "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")");
      s.setProperty("--cppdocs-ac-rgb", rgb[0] + "," + rgb[1] + "," + rgb[2]);
      s.setProperty("--cppdocs-ac2", "rgb(" + ac2[0] + "," + ac2[1] + "," + ac2[2] + ")");
    } catch (e) {}
  }

