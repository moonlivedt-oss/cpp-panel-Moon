  // ==== runtime/05-css.js — стили окна и палитры ====
  // ---------------------------------------------------------------------------
  //  Стиль окна (один <style> на документ).
  // ---------------------------------------------------------------------------
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = applyNonce(el("style")); st.id = STYLE_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
    ensureFonts();
  }
  // Встроенные шрифты чтения (extension/fonts/). Браузер качает файл, только когда шрифт реально
  // выбран, и только нужный диапазон (кириллица/латиница). Папку берём из data.extDirUrl — она
  // приходит с файлом данных, поэтому зовём и после его загрузки.
  var FONT_RANGES = {
    cyrillic: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116",
    latin: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  };
  var FONT_FILES = [   // [имя семейства, файл без -<диапазон>.woff2, насыщенность]
    ["CppDocs Inter", "inter", "400 700"], ["CppDocs Golos", "golos-text", "400 700"],
    ["CppDocs PT Sans", "pt-sans-400", "400"], ["CppDocs PT Sans", "pt-sans-700", "700"],
  ];
  function ensureFonts() {
    if (document.getElementById(STYLE_ID + "-fonts")) return;
    var d = DATA(), dir = (d && d.extDirUrl) || bootVal("extDirUrl");
    var base = dir ? resUrl(String(dir).replace(/\/+$/, "") + "/fonts") : null;
    if (!base) return;
    var css = "";
    FONT_FILES.forEach(function (f) {
      Object.keys(FONT_RANGES).forEach(function (r) {
        css += "@font-face{font-family:'" + f[0] + "';font-style:normal;font-weight:" + f[2] + ";font-display:swap;" +
          "src:url(" + base + "/" + f[1] + "-" + r + ".woff2) format('woff2');unicode-range:" + FONT_RANGES[r] + ";}\n";
      });
    });
    var st = applyNonce(el("style")); st.id = STYLE_ID + "-fonts"; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---------------------------------------------------------------------------
  //  Палитры окна (Настройки → Палитра). «Как в редакторе» (auto) — прежнее поведение:
  //  акцент из custom-bg / темы VS Code, фон Catppuccin. Остальные — готовые наборы для тех,
  //  у кого нет обоев custom-bg: свой фон с мягким свечением, свой акцент и цвета подсветки кода.
  //  В светлой теме и сепии палитра меняет только акцент (его затемняет darkenFor под контраст).
  // ---------------------------------------------------------------------------
  var PALETTES = {
    mocha:    { name: "Catppuccin",  bg: "#181825", panel: "#1e1e2e", code: "#11111b", fg: "#cdd6f4", muted: "#a6adc8", faint: "#7f849c", ac: "#cba6f7", glow: "#89b4fa", tc: "#6c7086", ts: "#a6e3a1", tp: "#f38ba8", tn: "#fab387", tk: "#cba6f7", ty: "#f9e2af", tf: "#89b4fa" },
    tokyo:    { name: "Tokyo Night", bg: "#1a1b26", panel: "#1f2335", code: "#16161e", fg: "#c0caf5", muted: "#a9b1d6", faint: "#737aa2", ac: "#7aa2f7", glow: "#bb9af7", tc: "#565f89", ts: "#9ece6a", tp: "#f7768e", tn: "#ff9e64", tk: "#bb9af7", ty: "#e0af68", tf: "#7dcfff" },
    dracula:  { name: "Dracula",     bg: "#21222c", panel: "#282a36", code: "#191a21", fg: "#f8f8f2", muted: "#bfc3d9", faint: "#7f87b3", ac: "#bd93f9", glow: "#ff79c6", tc: "#6272a4", ts: "#50fa7b", tp: "#ff5555", tn: "#ffb86c", tk: "#ff79c6", ty: "#f1fa8c", tf: "#8be9fd" },
    nord:     { name: "Nord",        bg: "#2e3440", panel: "#353c4a", code: "#272c36", fg: "#eceff4", muted: "#d8dee9", faint: "#8f9ab0", ac: "#88c0d0", glow: "#81a1c1", tc: "#7b88a1", ts: "#a3be8c", tp: "#bf616a", tn: "#d08770", tk: "#b48ead", ty: "#ebcb8b", tf: "#81a1c1" },
    gruvbox:  { name: "Gruvbox",     bg: "#1d2021", panel: "#282828", code: "#171a1b", fg: "#ebdbb2", muted: "#d5c4a1", faint: "#a89984", ac: "#fe8019", glow: "#fabd2f", tc: "#928374", ts: "#b8bb26", tp: "#fb4934", tn: "#fe8019", tk: "#d3869b", ty: "#fabd2f", tf: "#83a598" },
    rosepine: { name: "Rosé Pine",   bg: "#191724", panel: "#1f1d2e", code: "#14121e", fg: "#e0def4", muted: "#aaa6c8", faint: "#817d9e", ac: "#ebbcba", glow: "#c4a7e7", tc: "#6e6a86", ts: "#9ccfd8", tp: "#eb6f92", tn: "#f6c177", tk: "#c4a7e7", ty: "#f6c177", tf: "#9ccfd8" },
    onedark:  { name: "One Dark",    bg: "#21252b", panel: "#282c34", code: "#1b1f24", fg: "#d7dae0", muted: "#abb2bf", faint: "#7f848e", ac: "#61afef", glow: "#c678dd", tc: "#7f848e", ts: "#98c379", tp: "#e06c75", tn: "#d19a66", tk: "#c678dd", ty: "#e5c07b", tf: "#61afef" },
    forest:   { name: "Лес",         bg: "#141d18", panel: "#1a2620", code: "#0f1612", fg: "#dde9e0", muted: "#a9c2b1", faint: "#76917f", ac: "#7fd4a0", glow: "#d8c97a", tc: "#6b8574", ts: "#9fdc8c", tp: "#e8828a", tn: "#e3a46f", tk: "#b8a4e0", ty: "#e6d27f", tf: "#7cc7d6" },
    sunset:   { name: "Закат",       bg: "#1f1520", panel: "#281b29", code: "#170f18", fg: "#f3e3e6", muted: "#cfb3bb", faint: "#96788a", ac: "#ff9e7a", glow: "#e879b9", tc: "#8a6a7c", ts: "#b5dd8c", tp: "#ff6f91", tn: "#ffb86b", tk: "#d9a6ff", ty: "#ffd479", tf: "#7fc8f8" },
  };
  function activePalette() { return state.palette && PALETTES[state.palette] ? PALETTES[state.palette] : null; }
  // CSS наборов: токены тёмной темы + фон окна с двумя мягкими пятнами света (вместо обоев).
  function paletteCss() {
    return Object.keys(PALETTES).map(function (k) {
      var P = PALETTES[k], rgb = function (h) { return toRgb(h).join(","); };
      return "#" + WIN_ID + ".pal-" + k + ":not(.light):not(.sepia){" +
        "--bg:rgba(" + rgb(P.bg) + ",.985);--panel:" + P.panel + ";--nav:rgba(" + rgb(P.code) + ",.55);--code:" + P.code + ";" +
        "--fg:" + P.fg + ";--muted:" + P.muted + ";--faint:" + P.faint + ";--bd:rgba(" + rgb(P.fg) + ",.13);--bd2:rgba(" + rgb(P.fg) + ",.07);" +
        "--tc:" + P.tc + ";--ts:" + P.ts + ";--tp:" + P.tp + ";--tn:" + P.tn + ";--tk:" + P.tk + ";--ty:" + P.ty + ";--tf:" + P.tf + ";" +
        "background:radial-gradient(900px 520px at -5% -12%,rgba(" + rgb(P.ac) + ",.17),transparent 62%)," +
        "radial-gradient(820px 560px at 108% 112%,rgba(" + rgb(P.glow) + ",.13),transparent 60%),var(--bg);}";
    }).join("");
  }

  var CSS =
  // ---- Дизайн-токены (2026-09-26): скругления, длительности, тени — одна шкала вместо «на глаз» ----
  // Префикс --cd- — чтобы не пересечься с переменными VS Code. Меняешь шкалу здесь — меняется всё окно.
  ":root{--cd-r-xs:4px;--cd-r-sm:6px;--cd-r-md:8px;--cd-r-lg:10px;--cd-r-xl:12px;--cd-r-2xl:16px;--cd-r-pill:999px;" +
    "--cd-t-fast:.12s;--cd-t-slow:.25s;" +
    "--cd-sh-1:0 1px 2px rgba(0,0,0,.10);--cd-sh-2:0 8px 24px rgba(0,0,0,.32);--cd-sh-3:0 12px 40px rgba(0,0,0,.45);" +
    "--cd-sp-1:4px;--cd-sp-2:8px;--cd-sp-3:12px;--cd-sp-4:16px;--cd-sp-5:24px;}" +
  // Акцент приходит из :root (--cppdocs-ac* ставит applyAccent под тему/обои); хекс-значения —
  // запасные, если JS ещё не отработал или переменных нет. --ac-rgb нужен для полупрозрачных
  // оттенков rgba(var(--ac-rgb), .N). --tf оставлен фиксированным — это цвет кода, не UI-акцент.
  "#" + WIN_ID + "{--ac:var(--cppdocs-ac,#89b4fa);--ac2:var(--cppdocs-ac2,#b4befe);--ac-rgb:var(--cppdocs-ac-rgb,137,180,250);" +
  "--bg:rgba(24,24,37,.98);--panel:#1e1e2e;--nav:rgba(17,17,27,.6);" +
  "--fg:#cdd6f4;--muted:#a6adc8;--faint:#7f849c;--bd:rgba(205,214,244,.14);--bd2:rgba(205,214,244,.08);--code:#11111b;" +
  "--tc:#6c7086;--ts:#a6e3a1;--tp:#f38ba8;--tn:#fab387;--tk:#cba6f7;--ty:#f9e2af;--tf:#89b4fa;--hl:rgba(var(--ac-rgb),.14);}" +
  "#" + WIN_ID + ".light{--bg:rgba(250,250,252,.99);--panel:#eff1f5;--nav:rgba(230,233,239,.6);" +
  "--fg:#1e1e2e;--muted:#5c5f77;--faint:#8c8fa1;--bd:rgba(30,30,46,.14);--bd2:rgba(30,30,46,.07);--code:#eff1f5;" +
  "--tc:#8c8fa1;--ts:#40a02b;--tp:#d20f39;--tn:#fe640b;--tk:#8839ef;--ty:#df8e1d;--tf:#1e66f5;--hl:rgba(var(--ac-rgb),.10);}" +
  // Сепия — тёплый «бумажный» фон, мягче для глаз (токены кода светлые, но приглушённо-тёплые)
  "#" + WIN_ID + ".sepia{--bg:rgba(244,236,220,.99);--panel:#efe6d3;--nav:rgba(233,223,203,.62);" +
  "--fg:#453a2a;--muted:#7a6a52;--faint:#a4977c;--bd:rgba(69,58,42,.16);--bd2:rgba(69,58,42,.08);--code:#ece2cd;" +
  "--tc:#a4977c;--ts:#5c8a3a;--tp:#b04a2f;--tn:#b0742f;--tk:#7d5aa0;--ty:#8a6a1a;--tf:#3a6a9a;--hl:rgba(var(--ac-rgb),.12);}" +
  // Межстрочный интервал (Настройки → Интервал)
  "#" + WIN_ID + " .cd-article.cd-lh-tight p,#" + WIN_ID + " .cd-article.cd-lh-tight li{line-height:1.45;}" +
  "#" + WIN_ID + " .cd-article.cd-lh-roomy p,#" + WIN_ID + " .cd-article.cd-lh-roomy li{line-height:1.95;}" +
  // Режим фокуса: скрыть список слева и оглавление справа, дать тексту удобную ширину по центру
  "#" + WIN_ID + ".focus .cd-nav{display:none;}" +
  "#" + WIN_ID + ".focus .cd-outline{display:none;}" +
  "#" + WIN_ID + ".focus .cd-article{max-width:760px;margin-left:auto;margin-right:auto;}" +
  // Прозрачность, пока курсор не на окне (Настройки → Прозрачность): не мешает писать код, наведёшь — чёткое
  "#" + WIN_ID + ".ghost-soft,#" + WIN_ID + ".ghost-strong{transition:opacity .18s ease;}" +
  "#" + WIN_ID + ".ghost-soft{opacity:.66;}" +
  "#" + WIN_ID + ".ghost-strong{opacity:.32;}" +
  "#" + WIN_ID + ".ghost-soft:hover,#" + WIN_ID + ".ghost-strong:hover,#" + WIN_ID + ".ghost-soft:focus-within,#" + WIN_ID + ".ghost-strong:focus-within{opacity:1;}" +
  // Мини-режим: свёрнуто в полоску-заголовок (кнопка ⎯ или двойной клик по шапке)
  "#" + WIN_ID + ".rolled{height:auto!important;min-height:0!important;}" +
  "#" + WIN_ID + ".rolled .cd-body{display:none;}" +
  // свёрнутая полоска — по содержимому, а не на всю ширину редактора
  "#" + WIN_ID + ".rolled{width:var(--roll-w,720px)!important;max-width:calc(100vw - 16px);}" +
  "#" + WIN_ID + ".rolled .cd-title{flex:0 1 auto;}" +
  "#" + WIN_ID + ".rolled .cd-title>b{display:none;}" +
  "#" + WIN_ID + " .cd-rollinfo{display:none;}" +
  "#" + WIN_ID + ".rolled .cd-rollinfo{display:block;min-width:0;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--bd);background:var(--panel);color:var(--fg);border-radius:var(--cd-r-md);padding:3px 10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;}" +
  "#" + WIN_ID + ".rolled .cd-rollinfo:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + ".rolled .cd-rz-s,#" + WIN_ID + ".rolled .cd-rz-se{display:none;}" +
  // Маркер по тексту: выделение (клик — убрать) + всплывающая кнопка «Выделить» (она вне #WIN)
  "#" + WIN_ID + " .cd-article .cd-hlu{border-radius:3px;padding:0 1px;cursor:pointer;transition:filter var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-hlu:hover{filter:brightness(1.18);}" +
  "#" + WIN_ID + " .cd-article .cd-hlu-y{background:rgba(249,226,175,.36);}" +
  "#" + WIN_ID + " .cd-article .cd-hlu-p{background:rgba(243,139,168,.34);}" +
  "#" + WIN_ID + " .cd-article .cd-hlu-g{background:rgba(166,227,161,.34);}" +
  "#" + WIN_ID + ".light .cd-article .cd-hlu-y,#" + WIN_ID + ".sepia .cd-article .cd-hlu-y{background:rgba(223,142,29,.30);}" +
  "#" + WIN_ID + ".light .cd-article .cd-hlu-p,#" + WIN_ID + ".sepia .cd-article .cd-hlu-p{background:rgba(210,15,57,.20);}" +
  "#" + WIN_ID + ".light .cd-article .cd-hlu-g,#" + WIN_ID + ".sepia .cd-article .cd-hlu-g{background:rgba(64,160,43,.24);}" +
  ".cd-hlpop{position:fixed;z-index:2147483001;display:flex;align-items:center;gap:7px;padding:6px 9px;background:#1e1e2e;border:1px solid rgba(205,214,244,.18);border-radius:var(--cd-r-lg);box-shadow:0 6px 20px rgba(0,0,0,.45);}" +
  ".cd-hlpop .cd-hlpop-ic{font-size:13px;line-height:1;opacity:.85;}" +
  ".cd-hlpop .cd-hlpop-c{width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,.25);cursor:pointer;padding:0;transition:transform .1s;}" +
  ".cd-hlpop .cd-hlpop-c:hover{transform:scale(1.15);}" +
  ".cd-hlpop .cd-hlpop-note{margin-left:3px;padding:3px 9px;border-radius:var(--cd-r-md);border:1px solid rgba(205,214,244,.25);background:transparent;color:#cdd6f4;font:600 11.5px system-ui,sans-serif;cursor:pointer;white-space:nowrap;}" +
  ".cd-hlpop .cd-hlpop-note:hover{border-color:#89b4fa;background:rgba(137,180,250,.14);}" +
  ".cd-toast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:2147483002;max-width:min(460px,90vw);padding:9px 16px;border-radius:var(--cd-r-lg);background:#1e1e2e;color:#cdd6f4;border:1px solid #a6e3a1;box-shadow:var(--cd-sh-3);font:600 12.5px system-ui,sans-serif;pointer-events:none;}" +
  ".cd-toast.bad{border-color:#f38ba8;}" +
  ".cd-hlpop .cd-hlpop-y{background:#f9e2af;}" +
  ".cd-hlpop .cd-hlpop-p{background:#f38ba8;}" +
  ".cd-hlpop .cd-hlpop-g{background:#a6e3a1;}" +

  "#" + WIN_ID + "{position:fixed;z-index:2147483000;display:flex;flex-direction:column;" +
  "background:var(--bg);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:var(--fg);" +
  "border:1px solid rgba(var(--ac-rgb),.28);border-radius:var(--cd-r-2xl);box-shadow:0 18px 60px rgba(0,0,0,.55);" +
  "font-family:var(--vscode-font-family,'Segoe UI',system-ui,sans-serif);font-size:13px;overflow:hidden;}" +
  "#" + WIN_ID + " *{box-sizing:border-box;}" +
  // Атрибут hidden должен реально прятать элемент. У .cd-split и .cd-tabs задан display:flex,
  // который перебивает браузерное [hidden]{display:none} (равная специфичность, автор позже) —
  // поэтому скрытый сплит/вкладки оставались во flex-потоке пустой колонкой. Форсим скрытие.
  "#" + WIN_ID + " [hidden]{display:none!important;}" +
  "@media (prefers-reduced-motion: reduce){#" + WIN_ID + ",#" + WIN_ID + " *,#" + BTN_ID + "{transition:none!important;animation:none!important;}}" +

  // Шапка = ручка перетаскивания
  "#" + WIN_ID + " .cd-head{display:flex;align-items:center;gap:9px;padding:10px 12px;cursor:move;user-select:none;" +
  "border-bottom:1px solid var(--bd);background:linear-gradient(180deg,rgba(var(--ac-rgb),.10),transparent);}" +
  "#" + WIN_ID + " .cd-title{display:flex;align-items:center;gap:9px;font-weight:700;font-size:13px;letter-spacing:.2px;flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-title b{color:var(--ac2);font-weight:700;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-logo{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:var(--cd-r-md);overflow:hidden;font-size:13px;cursor:pointer;" +
  "background:rgba(var(--ac-rgb),.16);box-shadow:inset 0 0 0 1px rgba(var(--ac-rgb),.30);}" +
  "#" + WIN_ID + " .cd-logo img{width:100%;height:100%;display:block;}" +
  "#" + WIN_ID + " .cd-hbtn{flex:0 0 auto;width:26px;height:24px;line-height:1;border:none;border-radius:var(--cd-r-md);cursor:pointer;" +
  "background:transparent;color:var(--muted);font-size:14px;display:inline-flex;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-hbtn:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-hbtn:disabled{opacity:.28;cursor:default;background:transparent;}" +

  // Навигация по маршруту (пред./след. файл) внизу статьи
  "#" + WIN_ID + " .cd-routenav{display:flex;gap:12px;justify-content:space-between;margin:36px 0 6px;padding-top:18px;border-top:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-rn{flex:1 1 0;min-width:0;border:1px solid var(--bd);background:var(--panel);border-radius:var(--cd-r-lg);padding:9px 14px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:2px;transition:border-color var(--cd-t-fast),background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-rn-next{text-align:right;align-items:flex-end;}" +
  "#" + WIN_ID + " .cd-article .cd-winhide{display:none!important;}" +
  "#" + WIN_ID + " .cd-article .cd-secoff{display:none!important;}" +
  "#" + WIN_ID + " .cd-article .cd-secbar{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:7px 8px;border:1px solid var(--bd);border-radius:var(--cd-r-lg);background:var(--panel);font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-sect{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;}" +
  "#" + WIN_ID + " .cd-article .cd-secp{flex:0 0 90px;height:5px;border-radius:3px;background:var(--bd2);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-article .cd-secp i{display:block;height:100%;background:var(--ac);border-radius:3px;transition:width .2s;}" +
  "#" + WIN_ID + " .cd-article .cd-secb{border:1px solid var(--bd);background:var(--bg);color:var(--fg);border-radius:var(--cd-r-md);width:28px;height:24px;cursor:pointer;font:inherit;font-size:15px;line-height:1;}" +
  "#" + WIN_ID + " .cd-article .cd-secb:disabled{opacity:.35;cursor:default;}" +
  "#" + WIN_ID + " .cd-article .cd-secnext{display:block;width:100%;margin:26px 0 0;padding:11px 16px;border:1px solid rgba(var(--ac-rgb),.5);border-radius:var(--cd-r-xl);background:rgba(var(--ac-rgb),.10);color:var(--fg);font:inherit;font-size:13px;font-weight:700;cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-article .cd-secnext:hover{background:rgba(var(--ac-rgb),.2);}" +
  "#" + WIN_ID + " .cd-article .cd-secnext[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-article blockquote.cd-lead{border-left:0;background:none;padding:0;margin:-4px 0 8px;color:var(--muted);font-size:13px;}" +
  "#" + WIN_ID + " .cd-article blockquote.cd-lead p{margin:0;}" +
  "#" + WIN_ID + " .cd-article a.cd-dictchip{display:inline-block;margin:0 0 14px;padding:3px 11px;border:1px solid var(--bd);border-radius:var(--cd-r-pill);font-size:11.5px;text-decoration:none;color:var(--muted);background:var(--panel);}" +
  "#" + WIN_ID + " .cd-article a.cd-dictchip:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rn-done{display:flex;flex-direction:column;align-items:center;gap:2px;width:100%;margin:36px 0 -18px;padding:12px 16px;border:1px solid rgba(var(--ac-rgb),.55);border-radius:var(--cd-r-xl);background:rgba(var(--ac-rgb),.12);color:var(--fg);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;transition:background var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-rn-done:hover{background:rgba(var(--ac-rgb),.22);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-rn-done-s{font-size:11.5px;font-weight:500;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-rn-done + .cd-routenav{margin-top:30px;}" +
  "#" + WIN_ID + " .cd-rn:hover{border-color:var(--ac);background:var(--hl);}" +
  "#" + WIN_ID + " .cd-rn-dir{font-size:10.5px;color:var(--faint);font-weight:700;}" +
  "#" + WIN_ID + " .cd-rn-t{font-size:12.5px;color:var(--ac);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;}" +

  // Тело: навигатор + читалка
  "#" + WIN_ID + " .cd-body{flex:1 1 auto;display:flex;min-height:0;}" +
  "#" + WIN_ID + " .cd-nav{flex:0 0 auto;width:300px;min-width:0;display:flex;flex-direction:column;background:var(--nav);border-right:1px solid var(--bd);min-height:0;}" +
  "#" + WIN_ID + ".navhidden .cd-nav{display:none;}" +
  "#" + WIN_ID + " .cd-search{position:relative;padding:10px 10px 6px;}" +
  "#" + WIN_ID + " .cd-search input{width:100%;padding:8px 28px 8px 30px;border-radius:var(--cd-r-md);border:1px solid var(--bd);" +
  "background:var(--panel);color:var(--fg);font-family:inherit;font-size:12.5px;outline:none;}" +
  "#" + WIN_ID + " .cd-search input:focus{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-search .cd-si{position:absolute;left:20px;top:50%;transform:translateY(-40%);opacity:.5;font-size:13px;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-search .cd-sx{position:absolute;right:16px;top:50%;transform:translateY(-45%);border:none;background:none;color:var(--faint);cursor:pointer;font-size:13px;display:none;}" +
  "#" + WIN_ID + " .cd-search .cd-sx:hover{color:var(--fg);}" +

  // Прогресс
  "#" + WIN_ID + " .cd-prog{display:flex;align-items:center;gap:8px;padding:2px 12px 8px;}" +
  "#" + WIN_ID + " .cd-continue{flex:0 0 auto;border:none;cursor:pointer;padding:4px 10px;border-radius:var(--cd-r-pill);font-family:inherit;font-size:11px;font-weight:700;" +
  "background:rgba(var(--ac-rgb),.16);color:var(--ac);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-continue:hover{background:var(--ac);color:#fff;}" +
  "#" + WIN_ID + " .cd-continue[disabled]{opacity:.4;cursor:default;}" +
  "#" + WIN_ID + " .cd-bar{flex:1 1 auto;height:5px;border-radius:var(--cd-r-pill);background:var(--bd);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-fill{height:100%;width:0;background:var(--ac);transition:width var(--cd-t-slow);}" +
  "#" + WIN_ID + " .cd-ptext{flex:0 0 auto;font-size:10.5px;color:var(--faint);font-variant-numeric:tabular-nums;white-space:nowrap;}" +

  // Список файлов
  "#" + WIN_ID + " .cd-list{flex:1 1 auto;overflow-y:auto;padding:2px 8px 12px;min-height:0;}" +
  "#" + WIN_ID + " .cd-group{margin-top:13px;}" +
  "#" + WIN_ID + " .cd-group:first-child{margin-top:3px;}" +
  "#" + WIN_ID + " .cd-ghead{display:flex;align-items:center;gap:7px;width:100%;padding:6px 6px;background:none;border:none;cursor:pointer;color:var(--faint);font-family:inherit;text-align:left;}" +
  "#" + WIN_ID + " .cd-ghead .cd-gl{flex:1 1 auto;display:inline-flex;align-items:center;gap:7px;text-transform:uppercase;font-size:10px;font-weight:800;letter-spacing:.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted);color:color-mix(in srgb,var(--gcolor,var(--ac)) 72%,var(--fg));}" +
  "#" + WIN_ID + " .cd-ghead .cd-gl::before{content:'';flex:0 0 auto;width:6px;height:6px;border-radius:2px;background:var(--gcolor,var(--ac));}" +
  "#" + WIN_ID + " .cd-ghead .cd-gc{font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:var(--cd-r-md);background:var(--bd);background:color-mix(in srgb,var(--gcolor,var(--ac)) 18%,transparent);color:var(--muted);color:color-mix(in srgb,var(--gcolor,var(--ac)) 78%,var(--fg));}" +
  "#" + WIN_ID + " .cd-gdot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--gcolor,var(--ac));box-shadow:0 0 0 3px color-mix(in srgb,var(--gcolor,var(--ac)) 20%,transparent);}" +
  "#" + WIN_ID + " .cd-chev{width:9px;font-size:9px;transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-group.collapsed .cd-chev{transform:rotate(-90deg);}" +
  // Чипы-фильтр навигатора (Всё/Не изучено/Закреплённое/С заметками)
  "#" + WIN_ID + " .cd-filterbar{display:flex;flex-wrap:wrap;gap:5px;padding:2px 10px 8px;}" +
  "#" + WIN_ID + " .cd-fchip{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:var(--cd-r-pill);border:1px solid var(--bd);background:none;color:var(--muted);cursor:pointer;transition:background var(--cd-t-fast),color var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-fchip:hover{color:var(--fg);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-fchip.on{background:color-mix(in srgb,var(--ac) 20%,transparent);color:var(--ac2);border-color:color-mix(in srgb,var(--ac) 45%,var(--bd));}" +
  // Тонкий прогресс на группе (изучено N из M)
  "#" + WIN_ID + " .cd-gprog{display:flex;align-items:center;gap:7px;padding:0 8px 6px 22px;}" +
  "#" + WIN_ID + " .cd-gprog-track{flex:1 1 auto;height:3px;border-radius:3px;background:color-mix(in srgb,var(--gcolor,var(--ac)) 20%,transparent);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-gprog-fill{height:100%;width:0;border-radius:3px;background:var(--gcolor,var(--ac));transition:width var(--cd-t-slow);}" +
  "#" + WIN_ID + " .cd-gprog-lab{font-size:9px;font-weight:700;color:var(--muted);white-space:nowrap;}" +
  // При активном фильтре группы не сворачиваются
  "#" + WIN_ID + " .cd-list.filtering .cd-chev{visibility:hidden;}" +
  "#" + WIN_ID + " .cd-list.filtering .cd-ghead{cursor:default;}" +
  // Контекстное меню пункта (правый клик)
  ".cd-ctxmenu{position:fixed;z-index:2147483400;min-width:190px;padding:4px;border-radius:var(--cd-r-lg);border:1px solid rgba(205,214,244,.16);background:#1e1e2e;box-shadow:0 12px 32px rgba(0,0,0,.5);font-family:var(--vscode-font-family,'Segoe UI',system-ui,sans-serif);}" +
  ".cd-ctxmenu .cd-ctxitem{display:block;width:100%;text-align:left;border:none;background:none;color:#cdd6f4;font-family:inherit;font-size:12.5px;padding:7px 10px;border-radius:var(--cd-r-md);cursor:pointer;}" +
  ".cd-ctxmenu .cd-ctxitem:hover{background:rgba(137,180,250,.16);}" +
  "#" + WIN_ID + " .cd-group.collapsed .cd-items{display:none;}" +
  "#" + WIN_ID + " .cd-item{position:relative;margin:1px 0;padding:8px 10px 9px 15px;border-radius:var(--cd-r-md);cursor:pointer;}" +
  "#" + WIN_ID + " .cd-item::before{content:'';position:absolute;left:6px;top:9px;bottom:9px;width:3px;border-radius:3px;background:var(--gcolor,var(--ac));opacity:.45;transition:opacity .13s,top .13s,bottom .13s;}" +
  "#" + WIN_ID + " .cd-item:hover{background:var(--hl);background:color-mix(in srgb,var(--gcolor,var(--ac)) 9%,transparent);}" +
  "#" + WIN_ID + " .cd-item:hover::before{opacity:.9;top:7px;bottom:7px;}" +
  "#" + WIN_ID + " .cd-item.active{background:var(--hl);background:color-mix(in srgb,var(--gcolor,var(--ac)) 15%,transparent);}" +
  "#" + WIN_ID + " .cd-item.active::before{opacity:1;top:6px;bottom:6px;}" +
  "#" + WIN_ID + " .cd-item.active .cd-it-title{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-it-title{font-weight:600;font-size:12.5px;line-height:1.3;padding-right:38px;}" +
  "#" + WIN_ID + " .cd-item.read .cd-it-title::before{content:'✓ ';color:var(--ts);font-weight:800;}" +
  "#" + WIN_ID + " .cd-it-sub{color:var(--muted);font-size:11px;margin-top:3px;line-height:1.45;padding-right:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
  "#" + WIN_ID + " .cd-it-meta{color:var(--faint);font-size:10px;margin-top:3px;font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-it-act{position:absolute;top:6px;right:6px;display:flex;gap:2px;}" +
  "#" + WIN_ID + " .cd-it-act button{border:none;background:none;cursor:pointer;color:var(--muted);font-size:13.5px;padding:2px 4px;border-radius:var(--cd-r-sm);opacity:0;transition:opacity var(--cd-t-fast),background var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-it-act .cd-a-read{opacity:.5;}" +   // кружок прогресса виден всегда (главный индикатор)
  "#" + WIN_ID + " .cd-item:hover .cd-it-act button,#" + WIN_ID + " .cd-item.active .cd-it-act button{opacity:.92;}" +
  "#" + WIN_ID + " .cd-it-act button:hover{opacity:1;background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-it-act .on-pin{opacity:1;color:var(--ty);}" +
  "#" + WIN_ID + " .cd-it-act .on-read{opacity:1;color:var(--ts);}" +
  "#" + WIN_ID + " .cd-empty{padding:20px 14px;text-align:center;color:var(--faint);font-size:12px;}" +

  // Читалка
  "#" + WIN_ID + " .cd-reader{flex:1 1 auto;display:flex;flex-direction:column;min-width:0;min-height:0;}" +
  "#" + WIN_ID + " .cd-tocwrap{position:relative;flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-rbtn{border:1px solid var(--bd);background:var(--panel);color:var(--muted);cursor:pointer;font-family:inherit;font-size:11.5px;padding:5px 10px;border-radius:var(--cd-r-md);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-rbtn:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-rbtn.on{color:var(--ts);border-color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rmain{position:relative;flex:1 1 auto;display:flex;min-height:0;min-width:0;}" +

  // --- Главный экран (приветствие / возвращение) — оверлей поверх области чтения ---
  "#" + WIN_ID + " .cd-home{position:absolute;inset:0;z-index:7;overflow-y:auto;" +
  "background:radial-gradient(120% 68% at 50% -12%,rgba(var(--ac-rgb),.15),transparent 60%),radial-gradient(85% 55% at 108% 112%,rgba(var(--ac-rgb),.08),transparent 55%),var(--bg);}" +
  "#" + WIN_ID + " .cd-home-inner{max-width:880px;margin:0 auto;padding:32px 30px 64px;}" +
  // Герой — градиентная панель с мягким свечением
  "#" + WIN_ID + " .cd-home-hero{position:relative;display:flex;align-items:center;justify-content:space-between;gap:20px 24px;margin-bottom:18px;padding:18px 24px;border-radius:var(--cd-r-2xl);overflow:hidden;flex-wrap:wrap;" +
  "background:linear-gradient(135deg,color-mix(in srgb,var(--ac) 15%,var(--panel)),var(--panel));border:1px solid color-mix(in srgb,var(--ac) 24%,var(--bd));}" +
  "#" + WIN_ID + " .cd-home-hero::before{content:'';position:absolute;top:-45%;right:-8%;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(var(--ac-rgb),.20),transparent 70%);pointer-events:none;}" +
  "#" + WIN_ID + " .cd-home-hero::after{content:'';position:absolute;left:-6%;bottom:-60%;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(var(--ac-rgb),.10),transparent 70%);pointer-events:none;}" +
  "#" + WIN_ID + " .cd-home-hero{box-shadow:inset 0 1px 0 rgba(255,255,255,.05);}" +
  // Лид героя (маскот + приветствие) слева, статистика — справа; на узком окне статистика переносится вниз.
  "#" + WIN_ID + " .cd-hero-lead{position:relative;z-index:1;display:flex;align-items:center;gap:18px;flex:1 1 260px;min-width:0;}" +
  "#" + WIN_ID + " .cd-hero-stats{position:relative;z-index:1;flex:1 1 300px;display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dtile{padding:9px 11px;border-radius:var(--cd-r-xl);gap:2px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dtile:hover{transform:none;box-shadow:none;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-ic{width:24px;height:24px;font-size:12px;border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-v{font-size:15px;margin-top:3px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-l{font-size:10px;line-height:1.25;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-bar{margin-top:7px;height:4px;}" +
  // маскот героя — наклейка-настроение на мягком радиальном свечении
  "#" + WIN_ID + " .cd-home-mascot{position:relative;flex:0 0 auto;width:96px;height:96px;display:flex;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-home-mascot::before{content:'';position:absolute;inset:-4px;border-radius:50%;background:radial-gradient(circle,rgba(var(--ac-rgb),.28),transparent 66%);z-index:0;}" +
  "#" + WIN_ID + " .cd-home-mascot .cd-sticker,#" + WIN_ID + " .cd-home-mascot img{position:relative;z-index:1;}" +
  "#" + WIN_ID + " .cd-home-mascot .cd-sticker{filter:drop-shadow(0 8px 18px rgba(0,0,0,.38));transform:rotate(-5deg);transition:transform var(--cd-t-slow) cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-home-mascot:hover .cd-sticker{transform:rotate(0) scale(1.05);}" +
  "#" + WIN_ID + " .cd-home-htxt{flex:1 1 200px;min-width:0;}" +
  "#" + WIN_ID + " .cd-home-hi{font-size:25px;font-weight:800;letter-spacing:-.015em;color:var(--fg);line-height:1.12;}" +
  "#" + WIN_ID + " .cd-home-sub{font-size:13px;color:var(--muted);margin-top:5px;}" +
  // Кольцо общего прогресса
  "#" + WIN_ID + " .cd-ring{flex:0 0 auto;position:relative;width:74px;height:74px;}" +
  "#" + WIN_ID + " .cd-ring svg{width:100%;height:100%;transform:rotate(-90deg);}" +
  "#" + WIN_ID + " .cd-ring-bg{fill:none;stroke:var(--bd);stroke-width:5;}" +
  "#" + WIN_ID + " .cd-ring-fg{fill:none;stroke:var(--ac);stroke-width:5;stroke-linecap:round;transition:stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-home-cont{display:flex;align-items:center;gap:14px;width:100%;text-align:left;font-family:inherit;cursor:pointer;border:1px solid rgba(var(--ac-rgb),.30);" +
  "background:linear-gradient(135deg,rgba(var(--ac-rgb),.17),rgba(var(--ac-rgb),.05));border-radius:var(--cd-r-2xl);padding:16px 20px;margin-bottom:14px;transition:transform var(--cd-t-fast),box-shadow var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-cont:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.28);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-hc-main{flex:1 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-hc-arrow{flex:0 0 auto;font-size:22px;color:var(--ac);opacity:.7;transition:transform .16s,opacity .16s;}" +
  "#" + WIN_ID + " .cd-home-cont:hover .cd-hc-arrow{transform:translateX(4px);opacity:1;}" +
  "#" + WIN_ID + " .cd-hc-lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--ac);}" +
  "#" + WIN_ID + " .cd-hc-title{font-size:17px;font-weight:700;color:var(--fg);margin:5px 0 2px;}" +
  "#" + WIN_ID + " .cd-hc-meta{font-size:11.5px;color:var(--faint);}" +
  // Дашборд-плитки (#1)
  "#" + WIN_ID + " .cd-dtile{border:1px solid var(--bd);border-radius:var(--cd-r-2xl);background:var(--panel);padding:13px 15px;display:flex;flex-direction:column;gap:3px;transition:transform .13s,box-shadow .13s,border-color .13s;}" +
  "#" + WIN_ID + " .cd-dtile:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.16);border-color:color-mix(in srgb,var(--ac) 35%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dt-ic{width:30px;height:30px;border-radius:var(--cd-r-md);display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;}" +
  "#" + WIN_ID + " .cd-dt-read .cd-dt-ic{background:rgba(137,180,250,.16);}" +
  "#" + WIN_ID + " .cd-dt-solve .cd-dt-ic{background:rgba(166,227,161,.16);}" +
  "#" + WIN_ID + " .cd-dt-streak .cd-dt-ic{background:rgba(250,179,135,.16);}" +
  "#" + WIN_ID + " .cd-dt-v{font-size:19px;font-weight:800;color:var(--fg);font-variant-numeric:tabular-nums;margin-top:5px;}" +
  "#" + WIN_ID + " .cd-dt-l{font-size:11px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-dt-bar{height:5px;border-radius:var(--cd-r-pill);background:var(--bd);overflow:hidden;margin-top:9px;}" +
  "#" + WIN_ID + " .cd-dt-bar i{display:block;height:100%;border-radius:var(--cd-r-pill);transition:width .6s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-dt-read .cd-dt-bar i{background:linear-gradient(90deg,#89b4fa,#b4befe);}" +
  "#" + WIN_ID + " .cd-dt-solve .cd-dt-bar i{background:linear-gradient(90deg,#a6e3a1,#94e2d5);}" +
  "#" + WIN_ID + " .cd-home-sec{display:flex;align-items:center;gap:9px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.9px;color:var(--muted);margin:26px 0 13px;padding-bottom:8px;border-bottom:1px solid var(--bd2);}" +
  "#" + WIN_ID + " .cd-sec-dot{width:7px;height:7px;border-radius:2px;flex:0 0 auto;background:var(--sc,var(--ac));box-shadow:0 0 8px color-mix(in srgb,var(--sc,var(--ac)) 55%,transparent);}" +
  "#" + WIN_ID + " .cd-sec-count{margin-left:auto;font-size:10px;letter-spacing:0;color:var(--faint);opacity:.85;padding:1px 8px;border-radius:var(--cd-r-md);background:var(--hl);}" +
  "#" + WIN_ID + " .cd-hcard-go{position:absolute;right:12px;bottom:11px;font-size:15px;color:var(--gcolor,var(--ac));opacity:0;transform:translateX(-4px);transition:opacity var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-card:hover .cd-hcard-go{opacity:.9;transform:none;}" +
  "#" + WIN_ID + " .cd-home-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-home-card{position:relative;text-align:left;font-family:inherit;cursor:pointer;border:1px solid var(--bd);background:linear-gradient(180deg,color-mix(in srgb,var(--fg) 2%,var(--panel)),var(--panel));border-radius:var(--cd-r-2xl);padding:14px 32px 14px 18px;overflow:hidden;transition:transform var(--cd-t-fast),box-shadow var(--cd-t-fast),border-color var(--cd-t-fast),background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--gcolor,var(--ac));opacity:.85;}" +
  "#" + WIN_ID + " .cd-home-card:hover{transform:translateY(-2px);box-shadow:var(--cd-sh-2);border-color:color-mix(in srgb,var(--gcolor,var(--ac)) 45%,var(--bd));background:color-mix(in srgb,var(--gcolor,var(--ac)) 7%,var(--panel));}" +
  "#" + WIN_ID + " .cd-hcard-head{display:flex;align-items:center;gap:9px;}" +
  "#" + WIN_ID + " .cd-hcard-ic{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;padding:3px;border-radius:var(--cd-r-md);background:color-mix(in srgb,var(--gcolor,var(--ac)) 13%,transparent);}" +
  "#" + WIN_ID + " .cd-hcard-ic .cd-sticker{transition:transform .16s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-home-card:hover .cd-hcard-ic .cd-sticker{transform:scale(1.12) rotate(-4deg);}" +
  "#" + WIN_ID + " .cd-hcard-t{font-size:13.5px;font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-hcard-s{font-size:11.5px;color:var(--muted);margin-top:3px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}" +
  "#" + WIN_ID + " .cd-home-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-home-chip{font-family:inherit;cursor:pointer;font-size:12px;color:var(--fg);border:1px solid var(--bd);background:var(--panel);border-radius:var(--cd-r-pill);padding:6px 13px;display:inline-flex;align-items:center;gap:7px;transition:border-color var(--cd-t-fast),background var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-chip::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--gcolor,var(--ac));flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-home-chip:hover{border-color:var(--gcolor,var(--ac));background:color-mix(in srgb,var(--gcolor,var(--ac)) 9%,var(--panel));transform:translateY(-1px);}" +
  "#" + WIN_ID + ".home .cd-file-only{display:none;}" +
  "#" + WIN_ID + ".home .cd-rprog{visibility:hidden;}" +
  "@keyframes cd-home-in{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + " .cd-home.cd-in-anim{animation:cd-home-in .2s ease-out;}" +
  "#" + WIN_ID + " .cd-content{flex:1 1 auto;overflow-y:auto;padding:22px 30px 60px;min-height:0;min-width:0;line-height:1.62;scroll-behavior:smooth;}" +
  "#" + WIN_ID + " .cd-article{max-width:820px;margin:0 auto;font-family:var(--cd-rfont,inherit);}" +

  // Боковое оглавление-рейка
  "#" + WIN_ID + " .cd-outline{flex:0 0 auto;width:198px;overflow-y:auto;padding:14px 6px 44px;border-left:1px solid var(--bd);background:var(--nav);}" +
  "#" + WIN_ID + ".no-outline .cd-outline,#" + WIN_ID + ".narrow .cd-outline{display:none;}" +
  "#" + WIN_ID + ".narrow.ol-peek .cd-outline{display:block;position:absolute;right:0;top:0;bottom:0;z-index:6;width:240px;background:var(--panel);box-shadow:var(--sh3,0 18px 46px rgba(0,0,0,.4));}" +
  "#" + WIN_ID + " .cd-ol{display:block;width:100%;text-align:left;border:none;background:none;color:var(--muted);cursor:pointer;" +
  "font-family:inherit;font-size:11.5px;line-height:1.35;padding:5px 10px;border-radius:0 6px 6px 0;border-left:2px solid transparent;}" +
  "#" + WIN_ID + " .cd-ol.lvl3{padding-left:20px;font-size:11px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-ol:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-ol.active{color:var(--ac);border-left-color:var(--ac);background:var(--hl);font-weight:600;}" +
  "#" + WIN_ID + " .cd-rbtn.act{color:var(--ac);border-color:var(--ac);}" +

  // Полоса вкладок
  "#" + WIN_ID + " .cd-tabs{display:flex;gap:4px;align-items:flex-end;padding:6px 8px 0;overflow-x:auto;flex:0 0 auto;background:var(--nav);border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-tab{display:inline-flex;align-items:center;gap:6px;max-width:190px;flex:0 0 auto;padding:6px 6px 6px 11px;border:1px solid var(--bd);border-bottom:none;border-radius:8px 8px 0 0;background:var(--panel);color:var(--muted);cursor:pointer;font-size:11.5px;white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-tab.active{background:var(--bg);color:var(--fg);border-color:var(--ac);box-shadow:inset 0 2px 0 0 var(--ac);}" +
  "#" + WIN_ID + " .cd-tab-l{overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-tab-x{border:none;background:none;color:var(--faint);cursor:pointer;font-size:11px;line-height:1;padding:2px 3px;border-radius:var(--cd-r-xs);}" +
  "#" + WIN_ID + " .cd-tab-x:hover{background:var(--hl);color:var(--fg);}" +

  // Второй документ рядом (сплит)
  "#" + WIN_ID + " .cd-split{flex:1 1 0;min-width:0;display:flex;flex-direction:column;border-left:1px solid var(--bd);background:var(--bg);}" +
  "#" + WIN_ID + ".split .cd-content{flex:1 1 0;}" +
  "#" + WIN_ID + ".split .cd-outline{display:none;}" +
  "#" + WIN_ID + " .cd-split-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--bd);background:linear-gradient(180deg,var(--hl),transparent);}" +
  "#" + WIN_ID + " .cd-split-title{flex:1 1 auto;font-weight:700;font-size:12.5px;color:var(--ac2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-split-x{flex:0 0 auto;border:none;background:none;color:var(--muted);cursor:pointer;font-size:13px;padding:2px 7px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-split-x:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-split-content{flex:1 1 auto;overflow-y:auto;padding:18px 24px 50px;min-height:0;line-height:1.62;scroll-behavior:smooth;}" +

  // Типографика статьи
  "#" + WIN_ID + " .cd-article h2{position:relative;font-size:20px;margin:30px 0 12px;padding-bottom:7px;border-bottom:1px solid var(--bd);color:var(--ac2);scroll-margin-top:10px;}" +
  "#" + WIN_ID + " .cd-article h2::before{content:'';position:absolute;left:-16px;top:4px;height:19px;width:4px;border-radius:3px;background:linear-gradient(180deg,var(--ac),var(--ac2));}" +
  "#" + WIN_ID + " .cd-article h3{font-size:16px;margin:22px 0 8px;color:var(--fg);scroll-margin-top:10px;}" +
  "#" + WIN_ID + " .cd-article h4{font-size:14px;margin:16px 0 6px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article p{margin:9px 0;}" +
  "#" + WIN_ID + " .cd-article a{color:var(--ac);text-decoration:none;border-bottom:1px solid transparent;}" +
  "#" + WIN_ID + " .cd-article a:hover{border-bottom-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article ul,#" + WIN_ID + " .cd-article ol{margin:8px 0;padding-left:24px;}" +
  "#" + WIN_ID + " .cd-article li{margin:4px 0;}" +
  "#" + WIN_ID + " .cd-article code{background:var(--code);border:1px solid var(--bd2);border-radius:var(--cd-r-sm);padding:1px 5px;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12px;}" +
  "#" + WIN_ID + " .cd-article strong{color:var(--fg);font-weight:700;}" +
  "#" + WIN_ID + " .cd-article hr{border:none;border-top:1px solid var(--bd);margin:20px 0;}" +
  "#" + WIN_ID + " .cd-article blockquote{margin:12px 0;padding:10px 14px;border-left:3px solid var(--ac);border-radius:0 8px 8px 0;background:var(--hl);}" +
  "#" + WIN_ID + " .cd-article blockquote p{margin:5px 0;}" +
  // Спойлеры-подсказки задачника (<details class="cd-spoiler">)
  "#" + WIN_ID + " .cd-article details.cd-spoiler{margin:10px 0;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--panel);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary{cursor:pointer;padding:9px 13px;font-weight:600;font-size:13px;color:var(--ac2);list-style:none;user-select:none;background:var(--hl);}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary::-webkit-details-marker{display:none;}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary::before{content:'▸';display:inline-block;width:1em;color:var(--ac);transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler[open]>summary::before{transform:rotate(90deg);}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler>summary:hover{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler .cd-spoiler-body{padding:2px 14px 8px;}" +
  "#" + WIN_ID + " .cd-article details.cd-spoiler .cd-spoiler-body>:first-child{margin-top:6px;}" +
  // Подсказки-термины: слово из словаря с пунктирным подчёркиванием, при наведении — определение.
  "#" + WIN_ID + " .cd-article abbr.cd-term{border-bottom:1px dotted var(--faint,#8a8a9a);cursor:help;text-decoration:none;-webkit-text-decoration:none;}" +
  "#" + WIN_ID + " .cd-article abbr.cd-term:hover{border-bottom-color:var(--ac);}" +
  // Меню настроек: заголовок
  // Таблица сниппетов «Быстрые слова»: клик по строке раскрывает подсвеченный код
  "#" + WIN_ID + " .cd-article table.cd-snip-table{width:100%;}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip{cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip:hover>td{background:color-mix(in srgb,var(--ac) 10%,transparent);}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip .cd-snip-key{white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip .cd-snip-caret{display:inline-block;width:.9em;color:var(--ac);transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip.cd-open .cd-snip-caret{transform:rotate(90deg);}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip .cd-snip-ch{color:var(--muted);font-weight:700;}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip-code>td{padding:0 0 10px;border:none;background:none;}" +
  "#" + WIN_ID + " .cd-article tr.cd-snip-code .codewrap{margin:2px 0 0;}" +
  // Таблица «Задачи темы» задачника: строка кликабельна, при наведении — чип «Перейти к заданию →»
  "#" + WIN_ID + " .cd-article table.cd-tasktable tr.cd-taskrow{cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article table.cd-tasktable tr.cd-taskrow>td:last-child{position:relative;}" +
  "#" + WIN_ID + " .cd-article table.cd-tasktable tr.cd-taskrow:hover>td{background:color-mix(in srgb,var(--ac) 12%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-taskrow-go{position:absolute;right:6px;top:50%;transform:translateY(-50%) translateX(6px);opacity:0;pointer-events:none;white-space:nowrap;font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:var(--cd-r-pill);background:var(--ac);color:#11111b;box-shadow:0 2px 10px rgba(0,0,0,.35);transition:opacity .13s,transform .13s;}" +
  "#" + WIN_ID + " .cd-article table.cd-tasktable tr.cd-taskrow:hover .cd-taskrow-go{opacity:1;transform:translateY(-50%) translateX(0);}" +
  // Выключение анимаций (настройка «Анимации: Выкл»)
  "#" + WIN_ID + ".no-anim *,#" + WIN_ID + ".no-anim{animation:none!important;transition:none!important;}" +
  // Мелкая подпись-легенда (<sub> из задачника → <small class="cd-cap">)
  "#" + WIN_ID + " .cd-article .cd-cap{font-size:.85em;color:var(--faint);}" +
  // Чипы сложности (#3): цветной кружок с мягким кольцом
  "#" + WIN_ID + " .cd-diff{display:inline-block;width:11px;height:11px;border-radius:50%;vertical-align:middle;margin:0 1px;}" +
  "#" + WIN_ID + " .cd-diff.d-e{background:#40c057;box-shadow:0 0 0 3px rgba(64,192,87,.18);}" +
  "#" + WIN_ID + " .cd-diff.d-m{background:#f2b705;box-shadow:0 0 0 3px rgba(242,183,5,.18);}" +
  "#" + WIN_ID + " .cd-diff.d-h{background:#fa5252;box-shadow:0 0 0 3px rgba(250,82,82,.18);}" +
  "#" + WIN_ID + " .cd-article h2.cd-task .cd-diff{margin-left:4px;}" +
  // 🔥 челлендж и 🔗 звено цепочки — те же «пилюли», что и сложность, но со значком
  "#" + WIN_ID + " .cd-diff.d-x{width:auto;height:auto;border-radius:var(--cd-r-lg);padding:0 6px;font-size:.8em;line-height:1.5;background:rgba(250,82,82,.14);box-shadow:0 0 0 1px rgba(250,82,82,.35);}" +
  "#" + WIN_ID + " .cd-chain{display:inline-block;border-radius:var(--cd-r-lg);padding:0 6px;font-size:.8em;line-height:1.5;vertical-align:middle;margin:0 2px;background:color-mix(in srgb,var(--ac) 14%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--ac) 40%,transparent);}" +
  // Оглавление: большой раздел (# …) — отдельной строкой с разделителем
  "#" + WIN_ID + " .cd-ol.major{margin-top:6px;padding-top:7px;border-top:1px solid var(--bd);font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-ol.major::before{content:'◆';color:var(--ac);margin-right:6px;font-size:9px;vertical-align:1px;}" +
  // Решения задачника
  "#" + WIN_ID + " .cd-article details.cd-soldet>summary{display:flex;align-items:center;gap:8px;}" +
  "#" + WIN_ID + " .cd-article details.cd-soldet.cd-sol-solved>summary::after{content:'✓ решено';margin-left:auto;font-size:11px;font-weight:700;color:var(--ts);}" +
  "#" + WIN_ID + " .cd-article details.cd-soldet.cd-sol-flash{animation:cdSolFlash 1.2s ease-out;}" +
  "@keyframes cdSolFlash{0%{box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 55%,transparent);}100%{box-shadow:0 0 0 0 transparent;}}" +
  "#" + WIN_ID + ".no-anim .cd-article details.cd-soldet.cd-sol-flash{animation:none;}" +
  "#" + WIN_ID + " .cd-article .cd-sol-back{font:inherit;font-size:11.5px;float:right;margin:0 0 6px 10px;padding:3px 9px;border-radius:var(--cd-r-md);cursor:pointer;border:1px solid var(--bd);background:var(--bg);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-sol-back:hover{color:var(--ac);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-alt{margin:16px 0 4px;padding:10px 12px 4px;border-radius:var(--cd-r-xl);border:1px solid color-mix(in srgb,var(--ts) 35%,var(--bd));background:color-mix(in srgb,var(--ts) 6%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-alt-h{margin:0 0 8px;}" +
  "#" + WIN_ID + " .cd-article .cd-alt-h strong{display:inline-block;font-size:12.5px;padding:2px 9px;border-radius:var(--cd-r-md);background:color-mix(in srgb,var(--ts) 18%,transparent);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-alt-cmp{border-left-color:var(--ts);}" +
  // Таблица «Задачи темы»: решённые — с галочкой
  "#" + WIN_ID + " .cd-article tr.cd-taskrow-done td:first-child::before{content:'✓ ';color:var(--ts);font-weight:800;}" +
  "#" + WIN_ID + " .cd-article tr.cd-taskrow-done td{opacity:.72;}" +
  // Лесенка подсказок задачника (```hints)
  "#" + WIN_ID + " .cd-article .cd-ladder{margin:14px 0;padding:12px 14px;border-radius:var(--cd-r-xl);border:1px solid color-mix(in srgb,var(--ac) 28%,var(--bd));background:color-mix(in srgb,var(--ac) 6%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px;}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-t{font-weight:700;color:var(--ac2);font-size:13.5px;}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-sub{font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-dots{margin-left:auto;display:flex;gap:5px;}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-dots i{width:8px;height:8px;border-radius:50%;background:var(--bd);transition:background var(--cd-t-slow),transform var(--cd-t-slow);}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-dots i.on{background:var(--ac);transform:scale(1.15);}" +
  "#" + WIN_ID + " .cd-article .cd-lstep{display:flex;gap:10px;align-items:flex-start;margin:8px 0;padding:9px 11px;border-radius:var(--cd-r-md);background:var(--bg);border:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-article .cd-lstep.cd-lstep-in{animation:cdLadderIn .28s ease-out;}" +
  "@keyframes cdLadderIn{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + ".no-anim .cd-article .cd-lstep.cd-lstep-in{animation:none;}" +
  "#" + WIN_ID + " .cd-article .cd-lstep-ic{font-size:17px;line-height:1.4;}" +
  "#" + WIN_ID + " .cd-article .cd-lstep-b{flex:1;min-width:0;}" +
  "#" + WIN_ID + " .cd-article .cd-lstep-l{display:block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ac2);margin-bottom:2px;}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-next{font:inherit;font-size:13px;margin-top:4px;padding:6px 12px;border-radius:var(--cd-r-md);cursor:pointer;border:1px solid color-mix(in srgb,var(--ac) 45%,transparent);background:color-mix(in srgb,var(--ac) 14%,transparent);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-ladder-next:hover{background:color-mix(in srgb,var(--ac) 24%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-ladder.done{border-style:dashed;}" +
  // Прогресс по задачнику: счётчик темы + отметка «решено» у задач
  "#" + WIN_ID + " .cd-article .cd-taskbar{margin:2px 0 16px;padding:8px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--hl);font-size:13px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar b{color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-article h2.cd-task{display:flex;align-items:center;flex-wrap:wrap;gap:10px;}" +
  "#" + WIN_ID + " .cd-article h2.cd-task.cd-task-done{opacity:.72;}" +
  "#" + WIN_ID + " .cd-article .cd-taskstub{cursor:pointer;font:inherit;font-size:11px;font-weight:600;line-height:1;padding:5px 10px;margin-left:6px;border-radius:var(--cd-r-pill);border:1px dashed var(--bd);background:none;color:var(--muted);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-article .cd-taskstub:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-solve{cursor:pointer;font:inherit;font-size:11px;font-weight:600;line-height:1;padding:5px 10px;border-radius:var(--cd-r-pill);border:1px solid var(--bd);background:var(--panel);color:var(--muted);white-space:nowrap;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-solve:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-solve.on{background:var(--ac);border-color:var(--ac);color:#11111b;}" +
  "#" + WIN_ID + " .cd-article h2.cd-task.cd-task-done>a.cd-anchor,#" + WIN_ID + " .cd-article h2.cd-task.cd-task-done{text-decoration:none;}" +
  // #3 Карточка задачи: каждая ## N.M. со своим условием — в аккуратной карточке
  "#" + WIN_ID + " .cd-article .cd-taskcard{margin:18px 0;padding:4px 18px 16px;border:1px solid color-mix(in srgb,var(--fg) 16%,transparent);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 6.5%,var(--panel));box-shadow:0 3px 10px rgba(0,0,0,.22);}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task{border-bottom-color:color-mix(in srgb,var(--fg) 10%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task{margin-top:14px;}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task::before{display:none;}" +
  "#" + WIN_ID + " .cd-article .cd-taskcard>h2.cd-task+p em{color:var(--muted);}" +
  // #4 Сегментированный прогресс темы (в .cd-taskbar)
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-top{margin-bottom:8px;}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-track{display:flex;gap:4px;}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-cell{flex:1 1 0;height:7px;border-radius:var(--cd-r-xs);background:var(--bd);transition:background .18s;}" +
  "#" + WIN_ID + " .cd-article .cd-taskbar .cd-tb-cell.on{background:linear-gradient(90deg,var(--ac),var(--ac2));}" +
  // Личные заметки к материалу (внизу читалки)
  "#" + WIN_ID + " .cd-article .cd-notes{margin:34px 0 6px;padding-top:18px;border-top:1px dashed var(--bd);}" +
  "#" + WIN_ID + " .cd-article .cd-notes-h{font-size:13px;font-weight:700;color:var(--ac2);margin-bottom:8px;}" +
  "#" + WIN_ID + " .cd-article .cd-notes-ta{width:100%;min-height:70px;resize:vertical;padding:10px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--nav);color:var(--fg);font:inherit;font-size:13.5px;line-height:1.5;outline:none;transition:border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-notes-ta:focus{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-notes-ta::placeholder{color:var(--faint);}" +
  "#" + WIN_ID + " .cd-item.has-note .cd-it-title::after{content:'📝';margin-left:6px;font-size:.85em;opacity:.75;}" +
  "#" + WIN_ID + " .cd-article img{max-width:100%;border-radius:var(--cd-r-md);}" +

  // Таблицы
  "#" + WIN_ID + " .tablewrap{overflow-x:auto;margin:12px 0;border:1px solid var(--bd);border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-article table{border-collapse:collapse;width:100%;font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-article th,#" + WIN_ID + " .cd-article td{padding:7px 11px;text-align:left;border-bottom:1px solid var(--bd);vertical-align:top;}" +
  "#" + WIN_ID + " .cd-article th{background:var(--hl);font-weight:700;color:var(--ac2);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-article tbody tr:last-child td{border-bottom:none;}" +
  "#" + WIN_ID + " .cd-article tbody tr:hover{background:var(--bd2);}" +

  // Блоки кода — с верхней шапкой (язык + копировать)
  "#" + WIN_ID + " .codewrap{position:relative;margin:14px 0;border:1px solid var(--bd);border-radius:var(--cd-r-lg);overflow:hidden;box-shadow:var(--cd-sh-1);}" +
  "#" + WIN_ID + " .codehead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 8px 5px 12px;background:color-mix(in srgb,var(--ac) 10%,var(--code));border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .codelang{font-size:10px;text-transform:uppercase;letter-spacing:.7px;font-weight:800;color:var(--ac);}" +
  "#" + WIN_ID + " .copybtn{border:1px solid var(--bd);background:var(--bg);color:var(--muted);cursor:pointer;" +
  "font-family:inherit;font-size:10.5px;padding:3px 9px;border-radius:var(--cd-r-md);opacity:.75;transition:opacity var(--cd-t-fast),border-color var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .copybtn .cb-ic{font-size:11px;}" +
  "#" + WIN_ID + " .codewrap:hover .copybtn{opacity:1;}" +
  "#" + WIN_ID + " .copybtn:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .copybtn.done{color:var(--ts);border-color:var(--ts);}" +
  "#" + WIN_ID + " .cd-codebtns{display:inline-flex;gap:6px;align-items:center;}" +
  "#" + WIN_ID + " .cd-toed:disabled{opacity:.5;cursor:progress;}" +
  "#" + WIN_ID + " .cd-explain{margin:0 0 10px;padding:11px 14px;border-radius:var(--cd-r-lg);border:1px solid color-mix(in srgb,#f9e2af 45%,var(--bd));border-left:4px solid #f9e2af;background:color-mix(in srgb,#f9e2af 8%,var(--bg));line-height:1.5;}" +
  "#" + WIN_ID + " .cd-explain.generic{border-left-color:var(--muted);}" +
  "#" + WIN_ID + " .cd-ex-t{font-weight:800;font-size:13.5px;color:var(--fg);margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-ex-line{font-weight:600;font-size:11px;color:var(--muted);border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:1px 8px;margin-left:6px;}" +
  "#" + WIN_ID + " .cd-ex-why{font-size:12.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-ex-fix{font-size:12.5px;color:var(--fg);margin-top:5px;}" +
  "#" + WIN_ID + " .cd-ex-more{margin-top:8px;font:inherit;font-size:11.5px;font-weight:700;color:var(--ac);background:none;border:1px solid var(--ac);border-radius:var(--cd-r-pill);padding:4px 12px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-ex-more:hover{background:color-mix(in srgb,var(--ac) 14%,transparent);}" +
  "#" + WIN_ID + " .cd-bridge.err{border-color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-bridge.err .cd-bridge-ic,#" + WIN_ID + " .cd-bridge.err .cd-bridge-word{color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-bridge.err .cd-bridge-open{background:#f38ba8;}" +
  "#" + WIN_ID + " .cd-home-warm{width:100%;text-align:left;display:flex;align-items:center;gap:14px;margin:0 0 14px;padding:13px 18px;border:1px solid color-mix(in srgb,#f9e2af 50%,var(--bd));border-radius:var(--cd-r-2xl);background:linear-gradient(135deg,color-mix(in srgb,#f9e2af 14%,transparent),transparent);color:var(--fg);font:inherit;cursor:pointer;transition:transform var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " button.cd-home-warm:hover{border-color:#f9e2af;transform:translateY(-2px);}" +
  "#" + WIN_ID + " .cd-home-warm.cd-daily{border-color:color-mix(in srgb,#f38ba8 45%,var(--bd));background:linear-gradient(135deg,color-mix(in srgb,#f38ba8 12%,transparent),transparent);}" +
  "#" + WIN_ID + " .cd-home-warm.cd-daily[role=button]:hover{border-color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-daily-hl{box-shadow:0 0 0 3px #f38ba8;transition:box-shadow .3s;}" +
  "#" + WIN_ID + " .cd-home-warm.done{cursor:default;opacity:.75;padding:10px 18px;}" +
  "#" + WIN_ID + " .cd-hw-ic{font-size:24px;flex:0 0 auto;}" +
  "#" + WIN_ID + " pre.code{margin:0;padding:14px 16px;overflow-x:auto;background:var(--code);border:none;border-radius:0;" +
  "font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:var(--cd-codefs,12.5px);line-height:1.55;}" +
  // Код шире колонки: тень у правого края, пока справа есть скрытое (гаснет, когда доскроллил до конца).
  "#" + WIN_ID + " .cd-article pre.code{background:linear-gradient(to left,var(--code) 40%,rgba(0,0,0,0)) right center/34px 100% no-repeat local,linear-gradient(to left,rgba(0,0,0,.38),rgba(0,0,0,0)) right center/14px 100% no-repeat scroll,var(--code);}" +
  "#" + WIN_ID + ".light .cd-article pre.code,#" + WIN_ID + ".sepia .cd-article pre.code{background:linear-gradient(to left,var(--code) 40%,rgba(0,0,0,0)) right center/34px 100% no-repeat local,linear-gradient(to left,rgba(0,0,0,.14),rgba(0,0,0,0)) right center/14px 100% no-repeat scroll,var(--code);}" +
  "#" + WIN_ID + ".codewrap-on pre.code{white-space:pre-wrap;overflow-wrap:anywhere;}" +
  "#" + WIN_ID + " .cd-wrapbtn{border:1px solid var(--bd);background:var(--bg);color:var(--muted);cursor:pointer;border-radius:var(--cd-r-sm);padding:2px 8px;font:inherit;font-size:11px;opacity:0;transition:opacity var(--cd-t-fast);}" +
  "#" + WIN_ID + " .codewrap:hover .cd-wrapbtn{opacity:1;}" +
  "#" + WIN_ID + ".codewrap-on .cd-wrapbtn{opacity:1;color:var(--ac);border-color:rgba(var(--ac-rgb),.5);}" +
  "#" + WIN_ID + " pre.code code{background:none;border:none;padding:0;font-size:inherit;}" +
  "#" + WIN_ID + " pre.code .tc{color:var(--tc);font-style:italic;}" +
  "#" + WIN_ID + " pre.code .ts{color:var(--ts);}" +
  "#" + WIN_ID + " pre.code .tp{color:var(--tp);}" +
  "#" + WIN_ID + " pre.code .tn{color:var(--tn);}" +
  "#" + WIN_ID + " pre.code .tk{color:var(--tk);}" +
  "#" + WIN_ID + " pre.code .ty{color:var(--ty);}" +
  "#" + WIN_ID + " pre.code .tf{color:var(--tf);}" +

  // Скроллбары внутри окна
  "#" + WIN_ID + " ::-webkit-scrollbar{width:10px;height:10px;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-thumb{background:var(--bd);border-radius:var(--cd-r-sm);border:2px solid transparent;background-clip:padding-box;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-thumb:hover{background:var(--faint);background-clip:padding-box;}" +

  // Ручки изменения размера
  "#" + WIN_ID + " .cd-rz{position:absolute;z-index:6;}" +
  "#" + WIN_ID + " .cd-rz-e{top:0;right:0;width:6px;height:100%;cursor:ew-resize;}" +
  "#" + WIN_ID + " .cd-rz-s{left:0;bottom:0;height:6px;width:100%;cursor:ns-resize;}" +
  "#" + WIN_ID + " .cd-rz-se{right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;}" +
  "#" + WIN_ID + " .cd-rz-w{top:0;left:0;width:6px;height:100%;cursor:ew-resize;}" +

  // Прогресс чтения файла — тонкая полоса под шапкой читалки
  "#" + WIN_ID + " .cd-rprog{height:3px;flex:0 0 auto;background:transparent;}" +
  "#" + WIN_ID + " .cd-rprog i{display:block;height:100%;width:0;background:var(--ac);opacity:.85;transition:width .1s linear;}" +

  // Хлебные крошки: текущий раздел рядом с именем файла
  "#" + WIN_ID + " .cd-rname{overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;}" +
  "#" + WIN_ID + " .cd-crumb{color:var(--faint);font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-crumb::before{content:'›';margin:0 6px;opacity:.6;}" +
  "#" + WIN_ID + " .cd-crumb:empty{display:none;}" +
  // Название темы важнее раздела: сжимается позже крошки и видно целиком при наведении.
  "#" + WIN_ID + " .cd-rname{flex-shrink:.25;min-width:min(55%,max-content);cursor:pointer;}" +
  "#" + WIN_ID + " .cd-crumb{flex-shrink:4;cursor:pointer;}" +
  "html.cd-in-panel-doc,html.cd-in-panel-doc body{margin:0;padding:0;overflow:hidden;background:transparent;}" +
  "#" + WIN_ID + ".in-panel{left:0!important;top:0!important;width:100vw!important;height:100vh!important;border-radius:0;border:none;box-shadow:none;}" +
  "#" + WIN_ID + ".in-panel .cd-winctl,#" + WIN_ID + ".in-panel .cd-rz{display:none!important;}" +
  // знакомство в 3 шага
  "#" + WIN_ID + " .cd-tour{position:absolute;inset:0;z-index:60;}" +
  "#" + WIN_ID + " .cd-tour-hole{position:absolute;border-radius:var(--cd-r-xl);box-shadow:0 0 0 9999px rgba(0,0,0,.55),0 0 0 2px var(--ac);transition:all var(--cd-t-slow) ease;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-tour-tip{position:absolute;box-sizing:border-box;padding:14px 16px 12px;border-radius:var(--cd-r-2xl);background:var(--bg2,#1e1e2e);color:var(--fg);box-shadow:var(--cd-sh-3),inset 0 0 0 1px var(--bd);}" +
  "#" + WIN_ID + " .cd-tour-t{font-weight:800;font-size:14px;margin-bottom:6px;}" +
  "#" + WIN_ID + " .cd-tour-x{font-size:12.5px;line-height:1.55;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-tour-nav{display:flex;align-items:center;gap:8px;margin-top:12px;}" +
  "#" + WIN_ID + " .cd-tour-n{flex:1;font-size:11px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-tour-nav button{font:inherit;font-size:12px;padding:5px 12px;border-radius:var(--cd-r-md);border:none;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-tour-skip{background:transparent;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-tour-next{background:var(--ac);color:var(--ac-fg,#11111b);font-weight:700;}" +
  "#" + WIN_ID + ".docked{border-radius:0;border-top:none;border-right:none;border-bottom:none;}" +
  "#" + WIN_ID + " .cd-hbtn.on{color:var(--ac);background:rgba(var(--ac-rgb),.14);}" +
  "#" + WIN_ID + " .cd-secprog{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;margin-left:8px;font-size:11px;color:var(--faint);white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-secprog b{font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-sp-dots{display:inline-flex;gap:3px;}" +
  "#" + WIN_ID + " .cd-sp-dots i{width:6px;height:6px;border-radius:50%;background:color-mix(in srgb,var(--fg) 16%,transparent);}" +
  "#" + WIN_ID + " .cd-sp-dots i.r{background:var(--gcolor,var(--ac));}" +
  "#" + WIN_ID + " .cd-sp-dots i.cur{box-shadow:0 0 0 2px color-mix(in srgb,var(--gcolor,var(--ac)) 55%,transparent);}" +
  "#" + WIN_ID + " .cd-sp-bar{display:inline-block;width:46px;height:4px;border-radius:3px;background:color-mix(in srgb,var(--fg) 14%,transparent);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-sp-bar i{display:block;height:100%;background:var(--gcolor,var(--ac));}" +
  "#" + WIN_ID + " .cd-rname:hover,#" + WIN_ID + " .cd-crumb:hover{color:var(--ac);}" +
  "#" + WIN_ID + ".home .cd-rname{cursor:default;}" +
  "#" + WIN_ID + ".home .cd-rname:hover{color:inherit;}" +
  "#" + WIN_ID + " .cd-ol.seen::after{content:'✓';margin-left:5px;color:var(--ts);font-size:10px;font-weight:800;}" +

  // Меню вида: размер шрифта / ширина колонки / плотность списка
  "#" + WIN_ID + " .cd-vm-sec{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--ac2);margin:13px 4px 5px;}" +
  "#" + WIN_ID + " .cd-vm-sec:first-of-type{margin-top:4px;}" +
  "#" + WIN_ID + " .cd-vm-row{display:flex;align-items:center;gap:10px;padding:6px;border-radius:var(--cd-r-md);font-size:12px;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-vm-row:hover{background:color-mix(in srgb,var(--fg) 5%,transparent);}" +
  "#" + WIN_ID + " .cd-vm-row .cd-vm-lbl{flex:1 1 auto;min-width:0;font-weight:500;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  // строки с 3+ кнопками — вертикально: подпись сверху, сегмент-контрол на всю ширину
  "#" + WIN_ID + " .cd-vm-row.stack{flex-direction:column;align-items:stretch;gap:7px;}" +
  "#" + WIN_ID + " .cd-vm-row.stack .cd-vm-lbl{flex:none;}" +
  "#" + WIN_ID + " .cd-vm-row.stack .cd-seg{width:100%;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-vm-row.stack .cd-seg button{flex:1 1 auto;text-align:center;min-width:0;}" +
  "#" + WIN_ID + " .cd-seg{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--panel);flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-seg button{border:none;background:none;color:var(--muted);cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:600;padding:5px 10px;min-width:26px;border-radius:var(--cd-r-md);white-space:nowrap;transition:background var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-seg button.on{background:var(--ac);color:#11111b;box-shadow:0 1px 3px rgba(0,0,0,.18);}" +
  "#" + WIN_ID + " .cd-seg button:not(.on):hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-seg button:disabled{background:none;color:var(--fg);font-weight:700;cursor:default;}" +

  // Врезки-callouts: цвет по ведущему значку (класс .note + инлайновые --nc/--nbg)
  "#" + WIN_ID + " .cd-article blockquote.note{border-left-color:var(--nc,var(--ac));background:var(--nbg,var(--hl));}" +
  // Рисованная иконка-наклейка в начале врезки (роль callout'а)
  "#" + WIN_ID + " .cd-article blockquote.note.has-ic{position:relative;padding-left:46px;}" +
  "#" + WIN_ID + " .cd-article blockquote.note .cd-note-ic{position:absolute;left:12px;top:9px;width:24px;height:24px;object-fit:contain;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.18));}" +
  // Опросник (```quiz) и «найди ошибку» (```findbug)
  "#" + WIN_ID + " .cd-article .cd-quiz-head,#" + WIN_ID + " .cd-article .cd-fb-head{font-weight:700;color:var(--ac2);font-size:13.5px;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-exam{border:1px solid rgba(var(--ac-rgb),.45);border-radius:var(--cd-r-2xl);padding:14px 14px 4px;}" +
  "#" + WIN_ID + " .cd-article .cd-exam-badge{margin-left:8px;font-size:11px;font-weight:700;color:#1e1e2e;background:var(--ts);border-radius:var(--cd-r-pill);padding:2px 9px;}" +
  "#" + WIN_ID + " .cd-article .cd-exam-rule{font-size:12px;color:var(--muted);margin:-4px 0 12px;}" +
  "#" + WIN_ID + " .cd-article .cd-exam-res{margin:4px 0 12px;padding:11px 14px;border-radius:var(--cd-r-xl);font-size:13px;line-height:1.5;}" +
  "#" + WIN_ID + " .cd-article .cd-exam-res.ok{background:color-mix(in srgb,var(--ts) 16%,transparent);border:1px solid var(--ts);}" +
  "#" + WIN_ID + " .cd-article .cd-exam-res.no{background:color-mix(in srgb,var(--tn) 14%,transparent);border:1px solid var(--tn);}" +
  "#" + WIN_ID + " .cd-article .cd-exam-again{margin-left:6px;border:1px solid var(--bd);background:var(--bg);color:var(--fg);border-radius:var(--cd-r-md);padding:3px 10px;font:inherit;font-size:12px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article .cd-exam-again:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-q{margin:0 0 12px;padding:12px 14px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-qt{font-weight:600;margin-bottom:9px;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-n{color:var(--ac2);margin-right:2px;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opts{display:flex;flex-direction:column;gap:6px;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt{display:flex;align-items:center;gap:10px;text-align:left;font:inherit;font-size:13px;color:var(--fg);cursor:pointer;padding:8px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--bg);transition:border-color var(--cd-t-fast),background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-mark{flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:16px;height:16px;border:2px solid var(--faint);border-radius:50%;font-size:11px;line-height:1;color:#11111b;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.right{border-color:#a6e3a1;background:rgba(166,227,161,.13);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.right .cd-quiz-mark{border-color:#a6e3a1;background:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.right .cd-quiz-mark::after{content:'\\2713';}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.wrong{border-color:#f38ba8;background:rgba(243,139,168,.13);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.wrong .cd-quiz-mark{border-color:#f38ba8;background:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-opt.wrong.picked .cd-quiz-mark::after{content:'\\2715';}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-expl{margin-top:10px;padding:9px 12px;border-left:3px solid var(--ac);border-radius:0 8px 8px 0;background:var(--hl);font-size:12.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-reveal,#" + WIN_ID + " .cd-article .cd-fb-reveal{margin-top:10px;font:inherit;font-size:11.5px;font-weight:600;color:var(--muted);background:none;border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 12px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-quiz-reveal:hover,#" + WIN_ID + " .cd-article .cd-fb-reveal:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-fb{margin:14px 0;padding:12px 14px 14px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-fb-code{margin:0;border:1px solid var(--bd);border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-article .cd-fb-ans{margin-top:10px;padding:2px 13px;border-left:3px solid #f9b47a;border-radius:0 8px 8px 0;background:rgba(249,180,122,.11);}" +
  "#" + WIN_ID + " .cd-article .cd-fb-ans>:first-child{margin-top:8px;}" +
  // Флеш-карточки / «заполни пропуск» / тесты к задаче
  "#" + WIN_ID + " .cd-article .cd-fc-head,#" + WIN_ID + " .cd-article .cd-tests-head{font-weight:700;color:var(--ac2);font-size:13.5px;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-fc,#" + WIN_ID + " .cd-article .cd-tests{margin:14px 0;}" +
  "#" + WIN_ID + " .cd-article .cd-fc-check,#" + WIN_ID + " .cd-article .cd-fc-reveal{font:inherit;font-size:11.5px;font-weight:600;color:var(--muted);background:none;border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 12px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-check:hover,#" + WIN_ID + " .cd-article .cd-fc-reveal:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-code{margin:0 0 10px;border:1px solid var(--bd);border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-in{font-family:inherit;font-size:inherit;background:var(--bg);border:1px solid var(--ac);border-radius:var(--cd-r-sm);color:var(--fg);padding:0 4px;margin:0 1px;}" +
  "#" + WIN_ID + " .cd-article .cd-fc-in.right{border-color:#a6e3a1;background:rgba(166,227,161,.15);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-in.wrong{border-color:#f38ba8;background:rgba(243,139,168,.15);}" +
  "#" + WIN_ID + " .cd-article .cd-fc-ctl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-fc-msg,#" + WIN_ID + " .cd-article .cd-tests-note{font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-tests-note{margin-top:8px;}" +
  "#" + WIN_ID + " .cd-article .cd-tests-copy{font:inherit;font-size:10px;padding:2px 7px;border-radius:var(--cd-r-sm);border:1px solid var(--bd);background:var(--bg);color:var(--muted);cursor:pointer;margin-left:6px;}" +
  "#" + WIN_ID + " .cd-article .cd-tests-copy:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-tests-copy.done{color:var(--ts);border-color:var(--ts);}" +

  // «Живой пример» (```live): слайдеры + пересчёт кода и вывода
  "#" + WIN_ID + " .cd-article .cd-live{margin:14px 0;padding:13px 15px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-live-head{font-weight:700;color:var(--ac2);font-size:13.5px;margin:0 0 11px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-ctl{display:flex;flex-direction:column;gap:9px;margin:0 0 12px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-p{display:flex;align-items:center;gap:11px;font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-nm{flex:0 0 auto;min-width:34px;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-weight:600;color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-live-sl{flex:1 1 auto;max-width:260px;accent-color:var(--ac);cursor:pointer;height:4px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-num{flex:0 0 auto;min-width:34px;text-align:right;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-live-code{margin:0 0 11px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-outlab{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 5px;}" +
  "#" + WIN_ID + " .cd-article .cd-live-out{margin:0;padding:10px 13px;border-radius:var(--cd-r-md);background:var(--bg);border:1px solid var(--bd);overflow-x:auto;}" +
  "#" + WIN_ID + " .cd-article .cd-live-out code{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;white-space:pre;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-live-val{color:var(--ac2);font-weight:700;background:var(--hl);border-radius:var(--cd-r-xs);padding:0 3px;}" +

  // Пошаговый проигрыватель (```steps)
  // кадры
  "#" + WIN_ID + " .cd-article .cd-frames{margin:14px 0;padding:13px 15px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-fr-badge{background:color-mix(in srgb,#fab387 22%,transparent);color:#fab387;}" +
  "#" + WIN_ID + " .cd-article .cd-fr-screen{margin:8px 0;padding:12px 14px;border-radius:var(--cd-r-lg);background:#11111b;color:#a6e3a1;font-size:13px;line-height:1.25;min-height:5em;overflow:auto;box-shadow:inset 0 0 0 1px var(--bd),inset 0 0 24px rgba(166,227,161,.06);}" +
  "#" + WIN_ID + ".light .cd-article .cd-fr-screen{background:#1e1e2e;}" +
  "#" + WIN_ID + " .cd-article .cd-fr-cap:empty{display:none;}" +
  // память по шагам
  "#" + WIN_ID + " .cd-article .cd-mem{container-type:inline-size;margin:14px 0;padding:13px 15px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-mem-badge{background:color-mix(in srgb,#89b4fa 22%,transparent);color:#89b4fa;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-body{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;align-items:start;}" +
  "@container (max-width:560px){#" + WIN_ID + " .cd-article .cd-mem-body{grid-template-columns:1fr;}}" +
  "#" + WIN_ID + " .cd-article .cd-mem-code{margin:0;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-ln.cur{background:rgba(var(--ac-rgb),.18);box-shadow:inset 3px 0 0 var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-frame{border:1px solid var(--bd);border-radius:var(--cd-r-lg);padding:6px 8px;margin-bottom:6px;background:color-mix(in srgb,var(--fg) 3%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-frame.top{border-color:color-mix(in srgb,var(--ac) 55%,var(--bd));}" +
  "#" + WIN_ID + " .cd-article .cd-mem-fname{font-size:10.5px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-var,#" + WIN_ID + " .cd-article .cd-mem-blk{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:3px 5px;border-radius:var(--cd-r-md);font-size:12px;transition:background .2s,box-shadow .2s;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-vn{font-family:var(--mono,monospace);font-weight:700;min-width:1.5em;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-var.changed{background:rgba(var(--ac-rgb),.14);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-blk{border:1px dashed var(--bd);margin-bottom:6px;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-blk.dead{opacity:.55;text-decoration:line-through;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-bid{font-weight:800;color:#fab387;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-bt{color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-ptr{display:inline-block;padding:1px 7px;border-radius:var(--cd-r-pill);font-size:11.5px;font-weight:700;color:var(--ac);background:rgba(var(--ac-rgb),.14);cursor:default;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-ptr.null{color:var(--faint);background:color-mix(in srgb,var(--fg) 8%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-ptr.dead{color:#f38ba8;background:rgba(243,139,168,.14);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-hit{box-shadow:0 0 0 2px var(--ac);background:rgba(var(--ac-rgb),.16);}" +
  "#" + WIN_ID + " .cd-article .cd-mem-empty{font-size:11.5px;color:var(--faint);font-style:italic;padding:4px;}" +
  "#" + WIN_ID + " .cd-article .cd-mem-note:empty{display:none;}" +
  "#" + WIN_ID + " .cd-article .cd-steps{container-type:inline-size;margin:14px 0;padding:13px 15px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-st-head{display:flex;align-items:center;gap:10px;margin:0 0 10px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-st-badge{font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent);border-radius:var(--cd-r-pill);padding:3px 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-title{font-weight:700;color:var(--ac2);font-size:13.5px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-body{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(150px,1fr);gap:12px;align-items:start;}" +
  "#" + WIN_ID + " .cd-article .cd-st-code{margin:0;max-height:340px;overflow:auto;position:relative;}" +
  "#" + WIN_ID + " .cd-article .cd-st-ln{display:block;padding-right:8px;border-left:3px solid transparent;transition:background .18s,border-color .18s;}" +
  "#" + WIN_ID + " .cd-article .cd-st-no{display:inline-block;width:2.2em;margin-right:8px;text-align:right;color:var(--muted);opacity:.6;user-select:none;}" +
  "#" + WIN_ID + " .cd-article .cd-st-ln.cd-st-cur{background:color-mix(in srgb,var(--ac) 18%,transparent);border-left-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-st-ln.cd-st-cur .cd-st-no{color:var(--ac);opacity:1;font-weight:700;}" +
  "#" + WIN_ID + " .cd-article .cd-st-lab{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 5px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-vars{display:flex;flex-direction:column;gap:4px;margin:0 0 12px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-var{display:flex;justify-content:space-between;gap:10px;padding:4px 9px;border-radius:var(--cd-r-md);border:1px solid var(--bd);background:var(--bg);font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;transition:background var(--cd-t-slow),border-color var(--cd-t-slow);}" +
  "#" + WIN_ID + " .cd-article .cd-st-var.chg{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,var(--bg));}" +
  "#" + WIN_ID + " .cd-article .cd-st-k{color:var(--ac);font-weight:600;}" +
  "#" + WIN_ID + " .cd-article .cd-st-v{color:var(--fg);font-weight:700;overflow-wrap:anywhere;text-align:right;}" +
  "#" + WIN_ID + " .cd-article .cd-st-empty{font-size:12px;color:var(--muted);font-style:italic;}" +
  "#" + WIN_ID + " .cd-article .cd-st-out{margin:0;padding:8px 11px;border-radius:var(--cd-r-md);background:var(--bg);border:1px solid var(--bd);min-height:1.6em;max-height:140px;overflow:auto;}" +
  "#" + WIN_ID + " .cd-article .cd-st-out code{background:none;padding:0;border:0;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;white-space:pre;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-st-note{margin:11px 0 0;padding:8px 12px;border-radius:var(--cd-r-md);background:color-mix(in srgb,var(--ac2) 10%,transparent);font-size:13px;line-height:1.5;min-height:1.5em;}" +
  "#" + WIN_ID + " .cd-article .cd-st-ctl{display:flex;align-items:center;gap:7px;margin:11px 0 0;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-st-btn{font:inherit;font-size:12px;font-weight:600;color:var(--fg);background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 12px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-st-btn:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-st-main{background:var(--ac);border-color:var(--ac);color:var(--bg);}" +
  "#" + WIN_ID + " .cd-article .cd-st-main:hover{color:var(--bg);filter:brightness(1.1);}" +
  "#" + WIN_ID + " .cd-article .cd-st-end .cd-st-main{opacity:.45;}" +
  "#" + WIN_ID + " .cd-article .cd-st-pos{flex:1 1 auto;text-align:center;font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-st-track{height:3px;border-radius:2px;background:var(--bd);margin:10px 0 0;overflow:hidden;}" +
  "#" + WIN_ID + " .cd-article .cd-st-fill{height:100%;width:0;background:var(--ac);transition:width var(--cd-t-slow);}" +
  "@container (max-width:540px){#" + WIN_ID + " .cd-article .cd-st-body{grid-template-columns:1fr;}}" +

  "#" + WIN_ID + " .cd-article .cd-st-chk{display:none;border-color:var(--ac2);color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-article .cd-st-asking .cd-st-chk{display:inline-block;}" +
  "#" + WIN_ID + " .cd-article .cd-st-var.ask{border-style:dashed;border-color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-run-nl{opacity:.55;margin:0 .15em;}" +
  "#" + WIN_ID + " .cd-hints{margin-top:10px;}" +
  "#" + WIN_ID + " .cd-hint{margin:6px 0;padding:7px 10px;border-radius:var(--cd-r-md);background:color-mix(in srgb,var(--ac) 10%,transparent);border-left:3px solid var(--ac);font-size:.95em;}" +
  "#" + WIN_ID + " .cd-hints-ctl{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px;}" +
  "#" + WIN_ID + " .cd-hints-ctl button{font:inherit;font-size:.9em;padding:4px 10px;border-radius:var(--cd-r-md);border:1px solid var(--line,rgba(127,127,127,.35));background:transparent;color:var(--fg);cursor:pointer;}" +
  "#" + WIN_ID + " .cd-hints-ctl button:disabled{opacity:.45;cursor:default;}" +
  "#" + WIN_ID + " .cd-sol-why{font-size:.85em;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-sol{margin-top:8px;}" +
  "#" + WIN_ID + " .cd-sol-lab{font-size:.9em;color:var(--muted);margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-in{width:5.5em;font:inherit;font-weight:700;text-align:right;color:var(--fg);background:transparent;border:0;border-bottom:1px dashed var(--muted);outline:none;padding:0 2px;}" +
  "#" + WIN_ID + " .cd-article .cd-st-in:focus{border-bottom-color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-article .cd-st-in.bad{color:#f38ba8;border-bottom-color:#f38ba8;animation:cdStShake .3s;}" +
  "#" + WIN_ID + " .cd-article .cd-st-in.good{color:#a6e3a1;border-bottom-color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-st-yes{color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-boss{margin:22px 0 14px;padding:15px 17px;border-radius:var(--cd-r-2xl);border:1px solid color-mix(in srgb,#f9e2af 40%,var(--bd));background:linear-gradient(135deg,color-mix(in srgb,#f9e2af 10%,var(--panel)),color-mix(in srgb,var(--ac) 8%,var(--panel)));}" +
  "#" + WIN_ID + " .cd-article .cd-boss-head{display:flex;align-items:center;gap:12px;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-crown{font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.25));}" +
  "#" + WIN_ID + " .cd-article .cd-boss-kick{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#f9e2af;font-weight:700;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-title{font-size:15px;font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-boss-lock{margin:11px 0 0;font-size:13px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-boss-peek{font:inherit;font-size:12px;color:var(--ac);background:none;border:0;padding:0;margin-left:4px;text-decoration:underline dotted;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-body{display:none;margin:12px 0 0;}" +
  "#" + WIN_ID + " .cd-article .cd-boss.open .cd-boss-lock{display:none;}" +
  "#" + WIN_ID + " .cd-article .cd-boss.open .cd-boss-body{display:block;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-done{margin-top:6px;font:inherit;font-size:12.5px;font-weight:700;color:#1e1e2e;background:#f9e2af;border:0;border-radius:var(--cd-r-pill);padding:6px 14px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article .cd-boss.won{border-color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-boss.won .cd-boss-done{background:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-next{margin:12px 0 0;padding:10px 12px;border-radius:var(--cd-r-lg);background:color-mix(in srgb,var(--fg) 5%,transparent);font-size:13px;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-tasks{display:flex;flex-direction:column;gap:5px;margin:7px 0 0;}" +
  "#" + WIN_ID + " .cd-article .cd-boss-tasks a{display:block;padding:6px 10px;border-radius:var(--cd-r-md);border:1px solid var(--bd);text-decoration:none;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-boss-tasks a:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-home-spot .cd-spot-f{color:var(--muted);font-weight:400;}" +
  // светлая тема и сепия: пастельные акценты тёмной темы на белом бледнеют — берём насыщенные
  "#" + WIN_ID + ".light .cd-article .cd-st-in.bad,#" + WIN_ID + ".sepia .cd-article .cd-st-in.bad{color:#d20f39;border-bottom-color:#d20f39;}" +
  "#" + WIN_ID + ".light .cd-article .cd-st-in.good,#" + WIN_ID + ".sepia .cd-article .cd-st-in.good{color:#40a02b;border-bottom-color:#40a02b;}" +
  "#" + WIN_ID + ".light .cd-article .cd-st-yes,#" + WIN_ID + ".sepia .cd-article .cd-st-yes{color:#40a02b;}" +
  "#" + WIN_ID + ".light .cd-article .cd-boss-kick,#" + WIN_ID + ".sepia .cd-article .cd-boss-kick{color:#b7791f;}" +
  "#" + WIN_ID + ".light .cd-article .cd-boss,#" + WIN_ID + ".sepia .cd-article .cd-boss{border-color:color-mix(in srgb,#df8e1d 45%,var(--bd));background:linear-gradient(135deg,color-mix(in srgb,#df8e1d 9%,var(--panel)),color-mix(in srgb,var(--ac) 6%,var(--panel)));}" +
  "#" + WIN_ID + ".light .cd-article .cd-boss-done,#" + WIN_ID + ".sepia .cd-article .cd-boss-done{background:#df8e1d;color:#fff;}" +
  "#" + WIN_ID + ".light .cd-article .cd-boss.won .cd-boss-done,#" + WIN_ID + ".sepia .cd-article .cd-boss.won .cd-boss-done{background:#40a02b;color:#fff;}" +
  "#" + WIN_ID + ".light .cd-article .cd-boss.won,#" + WIN_ID + ".sepia .cd-article .cd-boss.won{border-color:#40a02b;}" +
  "#" + WIN_ID + ".light .cd-dt-steps .cd-dt-v,#" + WIN_ID + ".sepia .cd-dt-steps .cd-dt-v{color:#1e8fa6;}" +
  "#" + WIN_ID + " .cd-ghead .cd-gl::before{display:none;}" +
  "#" + WIN_ID + " .cd-hero-stats.cd-hs4{grid-template-columns:repeat(2,minmax(0,1fr));}" +
  "#" + WIN_ID + " .cd-home-spot{display:flex;align-items:center;gap:12px;width:100%;margin:10px 0 0;padding:11px 14px;border-radius:var(--cd-r-2xl);border:1px solid var(--bd);border-left:3px solid var(--ac2);background:color-mix(in srgb,var(--ac2) 7%,var(--panel));font:inherit;color:var(--fg);text-align:left;cursor:pointer;transition:transform var(--cd-t-fast),box-shadow var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-spot:hover{transform:translateY(-1px);box-shadow:var(--sh2,0 4px 14px rgba(0,0,0,.2));border-color:color-mix(in srgb,var(--ac2) 50%,var(--bd));}" +
  "#" + WIN_ID + " .cd-spot-ic{flex:0 0 auto;width:32px;height:32px;border-radius:var(--cd-r-lg);display:grid;place-items:center;font-size:16px;color:var(--ac2);background:color-mix(in srgb,var(--ac2) 16%,transparent);}" +
  "#" + WIN_ID + " .cd-spot-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;}" +
  "#" + WIN_ID + " .cd-spot-lbl{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-spot-t{font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-spot-f{font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-spot-bar{display:block;height:3px;margin-top:5px;border-radius:2px;background:var(--bd);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-spot-bar i{display:block;height:100%;background:var(--ac2);border-radius:2px;}" +
  "#" + WIN_ID + " .cd-spot-go{flex:0 0 auto;font-size:15px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-home-spot:hover .cd-spot-go{color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-kicker{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 12px;font-size:11px;}" +
  "#" + WIN_ID + " .cd-kicker span{padding:2px 9px;border-radius:var(--cd-r-pill);border:1px solid var(--bd);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-kicker .cd-kk-g{font-weight:800;letter-spacing:.05em;text-transform:uppercase;font-size:10px;color:color-mix(in srgb,var(--gcolor) 75%,var(--fg));border-color:color-mix(in srgb,var(--gcolor) 40%,var(--bd));background:color-mix(in srgb,var(--gcolor) 12%,transparent);}" +
  "#" + WIN_ID + " .cd-kicker .cd-kk-ok{color:#a6e3a1;border-color:color-mix(in srgb,#a6e3a1 40%,var(--bd));}" +
  "#" + WIN_ID + " .cd-article .codewrap.cd-copied{animation:cdCopied .7s ease-out;}" +
  "@keyframes cdCopied{0%{box-shadow:0 0 0 2px var(--ac);}100%{box-shadow:0 0 0 2px transparent;}}" +
  "#" + WIN_ID + ".light .cd-kicker .cd-kk-ok,#" + WIN_ID + ".sepia .cd-kicker .cd-kk-ok{color:#40a02b;}" +
  "#" + WIN_ID + ".no-anim .cd-article .codewrap.cd-copied,#" + WIN_ID + ".no-anim .cd-home-spot{animation:none;transition:none;}" +
  "@keyframes cdStShake{0%,100%{transform:none}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}" +
  "#" + WIN_ID + " .cd-dt-steps .cd-dt-ic{background:rgba(137,220,235,.16);}" +
  "#" + WIN_ID + " .cd-dt-steps .cd-dt-v{color:#89dceb;}" +

  // «Ката» (```challenge): собери код (parsons) + предскажи вывод (predict)
  "#" + WIN_ID + " .cd-article .cd-ch{margin:14px 0;padding:13px 15px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-ch.done{border-color:color-mix(in srgb,#a6e3a1 45%,var(--bd));}" +
  "#" + WIN_ID + " .cd-article .cd-ch-head{font-weight:600;color:var(--fg);font-size:13.5px;margin:0 0 11px;line-height:1.5;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-badge{display:inline-block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#11111b;background:var(--ac2);border-radius:var(--cd-r-sm);padding:2px 7px;margin-right:8px;vertical-align:1px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch.done .cd-ch-badge::after{content:' ✓';}" +
  "#" + WIN_ID + " .cd-article .cd-ch-lab{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:9px 0 5px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-bank,#" + WIN_ID + " .cd-article .cd-ch-sol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-sol{min-height:42px;padding:7px;border:1px dashed var(--bd);border-radius:var(--cd-r-md);background:var(--bg);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-sol:empty::before{content:attr(data-empty);color:var(--muted);font-size:12px;font-style:italic;display:block;padding:4px 5px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-item{display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 10px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--bg);transition:border-color var(--cd-t-fast),background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-item:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-item code{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;white-space:pre;background:none;padding:0;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-grip{flex:0 0 auto;color:var(--faint);font-size:11px;letter-spacing:-2px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-item.right{border-color:#a6e3a1;background:rgba(166,227,161,.12);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-item.wrong{border-color:#f38ba8;background:rgba(243,139,168,.12);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-ctl,#" + WIN_ID + " .cd-article .cd-pr-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:11px;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-check,#" + WIN_ID + " .cd-article .cd-pr-check{font:inherit;font-size:12px;font-weight:600;color:#11111b;background:var(--ac);border:1px solid var(--ac);border-radius:var(--cd-r-pill);padding:6px 15px;cursor:pointer;transition:filter var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-check:hover,#" + WIN_ID + " .cd-article .cd-pr-check:hover{filter:brightness(1.08);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-reset,#" + WIN_ID + " .cd-article .cd-pr-reveal{font:inherit;font-size:11.5px;font-weight:600;color:var(--muted);background:none;border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 12px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-ch-reset:hover,#" + WIN_ID + " .cd-article .cd-pr-reveal:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-pr-in{flex:1 1 180px;min-width:120px;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:13px;background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-md);color:var(--fg);padding:7px 11px;}" +
  "#" + WIN_ID + " .cd-article .cd-pr-in:focus{outline:none;border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-pr-in.right{border-color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-pr-in.wrong{border-color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-msg{font-size:12px;color:var(--muted);flex-basis:100%;}" +
  "#" + WIN_ID + " .cd-article .cd-mood{flex:0 0 auto;width:40px;height:40px;margin-right:-4px;}" +
  "#" + WIN_ID + " .cd-article .cd-mood img{width:40px;height:40px;object-fit:contain;display:block;}" +
  "#" + WIN_ID + " .cd-article .cd-mood.m-think img{animation:cd-mood-bob 1.2s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-article .cd-mood.m-win img{animation:cd-mood-pop .5s cubic-bezier(.3,1.6,.5,1);}" +
  "#" + WIN_ID + " .cd-article .cd-mood.m-oops img{animation:cd-mood-shake .45s ease;}" +
  "#" + WIN_ID + " .cd-article .cd-mood + .cd-ch-msg{flex-basis:calc(100% - 48px);align-self:center;}" +
  "@keyframes cd-mood-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}" +
  "@keyframes cd-mood-pop{0%{transform:scale(.6)}100%{transform:scale(1)}}" +
  "@keyframes cd-mood-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}" +
  "#" + WIN_ID + ".no-anim .cd-mood img{animation:none!important;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-msg.ok{color:#a6e3a1;font-weight:600;}" +
  "#" + WIN_ID + " .cd-article .cd-ch-msg.err{color:#f38ba8;}" +
  // «Напиши и запусти» (```challenge @type run)
  "#" + WIN_ID + " .cd-article .cd-run-code{display:block;width:100%;box-sizing:border-box;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;line-height:1.5;tab-size:4;color:var(--fg);background:var(--code);border:1px solid var(--bd);border-radius:var(--cd-r-md);padding:10px 12px;resize:vertical;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-run-code:focus{outline:none;border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article .cd-run-go{font:inherit;font-size:12px;font-weight:700;color:#11111b;background:var(--ac);border:1px solid var(--ac);border-radius:var(--cd-r-pill);padding:6px 16px;cursor:pointer;transition:filter var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-run-go:hover{filter:brightness(1.08);}" +
  "#" + WIN_ID + " .cd-article .cd-run-go:disabled{opacity:.6;cursor:progress;}" +
  "#" + WIN_ID + " .cd-article .cd-run-tinfo{font-size:11.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-run-out{margin-top:11px;display:flex;flex-direction:column;gap:5px;}" +
  "#" + WIN_ID + " .cd-article .cd-run-t{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;font-size:12.5px;padding:6px 10px;border:1px solid var(--bd);border-radius:var(--cd-r-md);background:var(--bg);}" +
  "#" + WIN_ID + " .cd-article .cd-run-t.ok{border-color:color-mix(in srgb,#a6e3a1 45%,var(--bd));}" +
  "#" + WIN_ID + " .cd-article .cd-run-t.bad{border-color:color-mix(in srgb,#f38ba8 45%,var(--bd));}" +
  "#" + WIN_ID + " .cd-article .cd-run-t.skip{opacity:.6;border-style:dashed;}" +
  // Пример с другими применениями: вкладки-подписи над кодом, стрелки и точки справа по центру
  "#" + WIN_ID + " .cd-alts .codehead{border-bottom:0;}" +
  "#" + WIN_ID + " .cd-alt-count{margin-left:10px;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ac);opacity:.85;}" +
  "#" + WIN_ID + " .cd-alt-tabs{display:flex;gap:6px;padding:2px 12px 10px;overflow-x:auto;scrollbar-width:none;scroll-behavior:smooth;" +
    "-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 12px,#000 calc(100% - 18px),transparent);mask-image:linear-gradient(90deg,transparent 0,#000 12px,#000 calc(100% - 18px),transparent);}" +
  "#" + WIN_ID + " .cd-alt-tabs::-webkit-scrollbar{display:none;}" +
  "#" + WIN_ID + " .cd-alt-tab{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12px;font-weight:600;color:var(--muted);" +
    "background:color-mix(in srgb,var(--fg) 4%,transparent);border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:4px 12px 4px 5px;cursor:pointer;white-space:nowrap;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-alt-tab i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;border-radius:50%;font-size:10.5px;" +
    "background:color-mix(in srgb,var(--fg) 10%,transparent);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-alt-tab:hover{color:var(--fg);border-color:color-mix(in srgb,var(--ac) 60%,var(--bd));}" +
  "#" + WIN_ID + " .cd-alt-tab.on{color:var(--fg);border-color:var(--ac);background:color-mix(in srgb,var(--ac) 16%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 12%,transparent);}" +
  "#" + WIN_ID + " .cd-alt-tab.on i{background:var(--ac);color:#11111b;}" +
  "#" + WIN_ID + " .cd-alt-tab:focus-visible,#" + WIN_ID + " .cd-alt-go:focus-visible{outline:2px solid var(--ac);outline-offset:2px;}" +
  // все слайды — в одной ячейке сетки: высота = самый высокий, страница при листании не прыгает
  "#" + WIN_ID + " .cd-alt-body{position:relative;display:grid;border-top:1px solid color-mix(in srgb,var(--bd) 70%,transparent);}" +
  "#" + WIN_ID + " .cd-alt-pane{grid-area:1/1;min-width:0;visibility:hidden;opacity:0;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-alt-pane.on{visibility:visible;opacity:1;pointer-events:auto;}" +
  "#" + WIN_ID + " .cd-alt-pane.in-r{animation:cdAltInR .28s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-alt-pane.in-l{animation:cdAltInL .28s cubic-bezier(.2,.8,.2,1);}" +
  "@keyframes cdAltInR{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}" +
  "@keyframes cdAltInL{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:none}}" +
  "#" + WIN_ID + ".no-anim .cd-alt-pane{animation:none!important;}" +
  "#" + WIN_ID + " .cd-alt-body pre.code{padding-right:64px;margin:0;}" +
  "#" + WIN_ID + " .cd-alt-nav{position:absolute;right:12px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;z-index:2;}" +
  "#" + WIN_ID + " .cd-alt-go{font:inherit;font-size:22px;line-height:1;width:38px;height:38px;border-radius:50%;cursor:pointer;color:var(--fg);" +
    "background:color-mix(in srgb,var(--panel) 72%,transparent);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);" +
    "border:1px solid color-mix(in srgb,var(--ac) 55%,var(--bd));box-shadow:0 4px 14px rgba(0,0,0,.28);transition:transform var(--cd-t-fast),background var(--cd-t-fast),color var(--cd-t-fast),opacity var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-alt-go:hover:not([disabled]){background:var(--ac);color:#11111b;transform:scale(1.08);}" +
  "#" + WIN_ID + " .cd-alt-go:active:not([disabled]){transform:scale(.95);}" +
  "#" + WIN_ID + " .cd-alt-go[disabled]{opacity:.28;cursor:default;box-shadow:none;}" +
  // пока ни разу не листали — стрелка «дальше» мягко зовёт
  "#" + WIN_ID + " .cd-alts:not(.used) .cd-alt-go.next{animation:cdAltCall 2.4s ease-in-out 1s 3;}" +
  "@keyframes cdAltCall{0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.28)}50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--ac) 25%,transparent),0 4px 14px rgba(0,0,0,.28)}}" +
  "#" + WIN_ID + ".no-anim .cd-alt-go.next{animation:none!important;}" +
  "#" + WIN_ID + " .cd-alt-dots{display:flex;flex-direction:column;gap:4px;}" +
  "#" + WIN_ID + " .cd-alt-dots i{width:5px;height:5px;border-radius:50%;background:color-mix(in srgb,var(--fg) 25%,transparent);transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-alt-dots i.on{background:var(--ac);height:12px;border-radius:3px;}" +
  // «Забегаем вперёд» под кодом
  "#" + WIN_ID + " .cd-article .cd-ahead{margin:0;padding:9px 14px 10px;border-top:1px dashed color-mix(in srgb,#89b4fa 40%,var(--bd));" +
    "background:color-mix(in srgb,#89b4fa 6%,transparent);font-size:12px;line-height:1.55;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-ahead-h{display:flex;align-items:center;gap:7px;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#89b4fa;margin-bottom:3px;}" +
  "#" + WIN_ID + " .cd-article .cd-ahead-ic{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:color-mix(in srgb,#89b4fa 22%,transparent);font-size:12px;}" +
  "#" + WIN_ID + " .cd-article .cd-ahead ul{margin:0;padding-left:18px;}" +
  "#" + WIN_ID + " .cd-article .cd-ahead li{margin:2px 0;}" +
  "#" + WIN_ID + " .cd-article .cd-ahead code{font-size:11.5px;}" +
  "#" + WIN_ID + " .cd-article .cd-run-tmark{flex:0 0 auto;font-weight:700;}" +
  "#" + WIN_ID + " .cd-article .cd-run-t.ok .cd-run-tmark{color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-run-t.bad .cd-run-tmark{color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-run-tgot{color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-run-tcrash{flex-basis:100%;color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-run-tcrash code{display:block;margin-top:4px;white-space:pre-wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-run-t code{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12px;}" +
  "#" + WIN_ID + " .cd-article .cd-run-err{margin:0;padding:10px 12px;border-radius:var(--cd-r-md);background:var(--code);border:1px solid color-mix(in srgb,#f38ba8 40%,var(--bd));overflow-x:auto;}" +
  "#" + WIN_ID + " .cd-article .cd-run-err code{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12px;color:#f38ba8;white-space:pre;}" +
  "#" + WIN_ID + " .cd-article .cd-run-hint{margin-top:10px;font-size:12px;color:var(--muted);padding:9px 12px;border-left:3px solid var(--ac);border-radius:0 8px 8px 0;background:var(--hl);}" +

  // «Смотри также» — связанные материалы в конце статьи
  "#" + WIN_ID + " .cd-article .cd-seealso{margin:34px 0 6px;padding-top:18px;border-top:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-article .cd-seealso-h{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:0 0 11px;}" +
  "#" + WIN_ID + " .cd-article .cd-seealso-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:9px;}" +
  "#" + WIN_ID + " .cd-article .cd-see{display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left;font:inherit;cursor:pointer;padding:10px 13px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--panel);transition:border-color var(--cd-t-fast),transform var(--cd-t-fast),background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-see:hover{border-color:var(--ac);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-article .cd-see-t{font-size:13px;font-weight:600;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-see-s{font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-article .cd-see-g{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-top:3px;}" +

  // «Обучение» — руководство по интерфейсу (модальный оверлей поверх окна)
  "#" + WIN_ID + " .cd-guide{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);padding:22px;}" +
  "#" + WIN_ID + " .cd-guide-panel{display:flex;flex-direction:column;width:min(680px,100%);max-height:100%;background:var(--panel);border:1px solid var(--bd);border-radius:var(--cd-r-2xl);box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-guide-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 20px;border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-guide-title{font-size:15px;font-weight:700;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-guide-close{flex:0 0 auto;font:inherit;font-size:14px;color:var(--muted);background:none;border:1px solid var(--bd);border-radius:var(--cd-r-md);width:30px;height:30px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-guide-close:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-guide-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:11px 20px 4px;border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-guide-chip{font:inherit;font-size:12px;font-weight:600;color:var(--muted);background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 13px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-guide-chip:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-guide-chip.on{background:var(--ac);color:#11111b;border-color:transparent;}" +
  "#" + WIN_ID + " .cd-guide-scroll{overflow-y:auto;padding:14px 22px 20px;}" +
  "#" + WIN_ID + " .cd-guide-page h3{font-size:12px;font-weight:700;color:var(--ac2);margin:2px 0 9px;text-transform:uppercase;letter-spacing:.05em;}" +
  "#" + WIN_ID + " .cd-guide-page h3:not(:first-child){margin-top:20px;}" +
  "#" + WIN_ID + " .cd-guide-page p{margin:0 0 10px;font-size:13px;line-height:1.62;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-guide-page ul{margin:0 0 10px;padding-left:18px;}" +
  "#" + WIN_ID + " .cd-guide-page li{font-size:13px;line-height:1.62;color:var(--fg);margin:5px 0;}" +
  "#" + WIN_ID + " .cd-guide-page code{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12px;background:var(--code);padding:1px 5px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-guide-page b{color:var(--fg);font-weight:700;}" +
  "#" + WIN_ID + " .cd-guide-try-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px;}" +
  "#" + WIN_ID + " .cd-guide-try{font:inherit;font-size:12px;font-weight:600;color:var(--fg);background:var(--bg);border:1px solid var(--ac);border-radius:var(--cd-r-md);padding:8px 14px;cursor:pointer;transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-guide-try:hover{background:var(--hl);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-guide-note{font-size:12px;color:var(--muted);font-style:italic;}" +
  "#" + WIN_ID + " .cd-guide-hint{font-size:12px;color:var(--muted);margin:14px 0 6px;}" +
  "#" + WIN_ID + " .cd-guide-demo{border:1px dashed var(--bd);border-radius:var(--cd-r-xl);padding:2px 14px;background:color-mix(in srgb,var(--fg) 3%,var(--panel));}" +
  "#" + WIN_ID + " .cd-guide .cd-article{padding:0;margin:0;background:none;max-width:none;font-size:13px;}" +

  // Окно «Прогресс»: карта знаний, экзамен недели, достижения, рекорды (12-progress-map.js, 12-rewards.js)
  "#" + WIN_ID + " .cd-pg-panel{width:min(900px,100%);}" +
  "#" + WIN_ID + " .cd-pg .cd-guide-top{gap:10px;}" +
  "#" + WIN_ID + " .cd-pg .cd-guide-title{flex:1;}" +
  "#" + WIN_ID + " .cd-pg-anki{font:inherit;font-size:12px;color:var(--fg);background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-md);padding:5px 11px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-pg-anki:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-pg-empty{color:var(--muted);font-size:13px;}" +
  "#" + WIN_ID + " .cd-mbar{display:inline-block;vertical-align:middle;width:90px;height:6px;border-radius:3px;background:color-mix(in srgb,var(--fg) 12%,transparent);overflow:hidden;margin:0 8px;}" +
  "#" + WIN_ID + " .cd-mbar.sm{width:70px;height:5px;}" +
  "#" + WIN_ID + " .cd-mbar i{display:block;height:100%;background:var(--ac);border-radius:inherit;}" +
  "#" + WIN_ID + " .cd-mbar.m1 i{background:#f38ba8;}#" + WIN_ID + " .cd-mbar.m2 i{background:#fab387;}#" + WIN_ID + " .cd-mbar.m3 i{background:#f9e2af;}#" + WIN_ID + " .cd-mbar.m4 i{background:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-km-sum{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;font-size:13px;margin-bottom:10px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-km-sum b{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-km-next,#" + WIN_ID + " .cd-weak-go,#" + WIN_ID + " .cd-kd-open,#" + WIN_ID + " .cd-wk-start,#" + WIN_ID + " .cd-wk-next,#" + WIN_ID + " .cd-wk-again,#" + WIN_ID + " .cd-pg-tab-go,#" + WIN_ID + " .cd-wk-quit{font:inherit;font-size:12px;font-weight:600;color:var(--fg);background:var(--bg);border:1px solid var(--ac);border-radius:var(--cd-r-md);padding:6px 12px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-km-next:hover,#" + WIN_ID + " .cd-weak-go:hover,#" + WIN_ID + " .cd-kd-open:hover,#" + WIN_ID + " .cd-wk-start:hover,#" + WIN_ID + " .cd-wk-next:hover,#" + WIN_ID + " .cd-wk-again:hover,#" + WIN_ID + " .cd-pg-tab-go:hover{background:var(--hl);}" +
  "#" + WIN_ID + " .cd-wk-quit{border-color:var(--bd);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-km-wrap{overflow-x:auto;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 3%,var(--panel));padding:6px;}" +
  "#" + WIN_ID + " .cd-km{display:block;margin:0 auto;}" +
  "#" + WIN_ID + " .cd-km-e{fill:none;stroke:color-mix(in srgb,var(--fg) 22%,transparent);stroke-width:1.4;}" +
  "#" + WIN_ID + " .cd-km-e.on{stroke:color-mix(in srgb,var(--ac) 70%,transparent);}" +
  "#" + WIN_ID + " .cd-km-n{cursor:pointer;outline:none;}" +
  "#" + WIN_ID + " .cd-km-bg{fill:var(--panel);stroke:color-mix(in srgb,var(--fg) 18%,transparent);stroke-width:4;}" +
  "#" + WIN_ID + " .cd-km-fg{fill:none;stroke:var(--ac);stroke-width:4;stroke-linecap:round;}" +
  "#" + WIN_ID + " .cd-km-n.m1 .cd-km-fg{stroke:#f38ba8;}#" + WIN_ID + " .cd-km-n.m2 .cd-km-fg{stroke:#fab387;}#" + WIN_ID + " .cd-km-n.m3 .cd-km-fg{stroke:#f9e2af;}#" + WIN_ID + " .cd-km-n.m4 .cd-km-fg{stroke:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-km-n.m4 .cd-km-bg{fill:color-mix(in srgb,#a6e3a1 18%,var(--panel));}" +
  "#" + WIN_ID + " .cd-km-num{fill:var(--fg);font-size:11px;font-weight:700;text-anchor:middle;}" +
  "#" + WIN_ID + " .cd-km-t{fill:var(--muted);font-size:10px;text-anchor:middle;}" +
  "#" + WIN_ID + " .cd-km-n.lock{opacity:.4;}" +
  "#" + WIN_ID + " .cd-km-n.lock .cd-km-bg{stroke-dasharray:3 3;}" +
  "#" + WIN_ID + " .cd-km-n.next .cd-km-bg{stroke:var(--ac);animation:cdKmPulse 1.8s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-km-n:hover .cd-km-t,#" + WIN_ID + " .cd-km-n.sel .cd-km-t,#" + WIN_ID + " .cd-km-n:focus .cd-km-t{fill:var(--fg);font-weight:700;}" +
  "#" + WIN_ID + " .cd-km-n.sel .cd-km-bg{stroke:var(--fg);}" +
  "@keyframes cdKmPulse{0%,100%{stroke-opacity:1}50%{stroke-opacity:.35}}" +
  "#" + WIN_ID + ".no-anim .cd-km-n.next .cd-km-bg{animation:none;}" +
  "#" + WIN_ID + " .cd-km-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px;color:var(--muted);margin:8px 2px;}" +
  "#" + WIN_ID + " .cd-km-legend span::before{content:'';display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:-1px;background:color-mix(in srgb,var(--fg) 20%,transparent);}" +
  "#" + WIN_ID + " .cd-km-legend .m1::before{background:#f38ba8;}#" + WIN_ID + " .cd-km-legend .m2::before{background:#fab387;}#" + WIN_ID + " .cd-km-legend .m3::before{background:#f9e2af;}#" + WIN_ID + " .cd-km-legend .m4::before{background:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-km-legend .lock::before{background:none;border:1px dashed var(--muted);}" +
  "#" + WIN_ID + " .cd-km-detail{margin-top:10px;padding:12px 14px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--bg);}" +
  "#" + WIN_ID + " .cd-kd-h{display:flex;align-items:center;flex-wrap:wrap;font-size:13px;}" +
  "#" + WIN_ID + " .cd-kd-h em,#" + WIN_ID + " .cd-kd-parts em,#" + WIN_ID + " .cd-weak-main em{font-style:normal;font-weight:700;font-size:12px;}" +
  "#" + WIN_ID + " .cd-kd-parts{list-style:none;margin:8px 0;padding:0;font-size:12px;}" +
  "#" + WIN_ID + " .cd-kd-parts li{display:flex;align-items:center;gap:4px;margin:3px 0;}" +
  "#" + WIN_ID + " .cd-kd-parts li span:first-child{flex:0 0 190px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-kd-parts li.bad span:first-child{color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-kd-deps{font-size:12px;color:var(--muted);margin:6px 0;}" +
  "#" + WIN_ID + " .cd-kd-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}" +
  // Слабые места на главной
  "#" + WIN_ID + " .cd-weak{border:1px solid var(--bd);border-radius:var(--cd-r-xl);padding:10px 12px;margin:10px 0;background:color-mix(in srgb,var(--panel) 80%,transparent);}" +
  "#" + WIN_ID + " .cd-weak-h{font-size:12px;font-weight:700;margin-bottom:6px;}" +
  "#" + WIN_ID + " .cd-weak-h span{font-weight:400;color:var(--muted);margin-left:8px;}" +
  "#" + WIN_ID + " .cd-weak-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-top:1px solid color-mix(in srgb,var(--bd) 60%,transparent);}" +
  "#" + WIN_ID + " .cd-weak-row:first-of-type{border-top:0;}" +
  "#" + WIN_ID + " .cd-weak-main{flex:1 1 200px;font-size:12px;}" +
  "#" + WIN_ID + " .cd-weak-main small{display:block;color:var(--muted);font-size:11px;margin-top:2px;}" +
  "#" + WIN_ID + " .cd-home-warm.cd-weekly{border-color:color-mix(in srgb,#89b4fa 45%,var(--bd));}" +
  // Экзамен недели
  "#" + WIN_ID + " .cd-wk-intro p{font-size:13px;line-height:1.6;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-wk-hist{margin-top:16px;font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-wk-hist ul,#" + WIN_ID + " .cd-wk-by,#" + WIN_ID + " .cd-rec-last ul{list-style:none;padding:0;margin:6px 0;}" +
  "#" + WIN_ID + " .cd-wk-hist li,#" + WIN_ID + " .cd-wk-by li,#" + WIN_ID + " .cd-rec-last li{display:flex;gap:10px;align-items:center;padding:3px 0;font-size:12px;}" +
  "#" + WIN_ID + " .cd-wk-hist li span:first-child,#" + WIN_ID + " .cd-wk-by li span:first-child{flex:0 0 180px;}" +
  "#" + WIN_ID + " .cd-wk-top{display:flex;gap:14px;align-items:center;font-size:12px;color:var(--muted);margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-wk-timer{margin-left:auto;font-weight:700;color:var(--fg);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-wk-q{font-size:14px;line-height:1.55;margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-wk-from{font-size:11px;color:var(--muted);margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-wk-opts{display:flex;flex-direction:column;gap:6px;}" +
  "#" + WIN_ID + " .cd-wk-opt{text-align:left;font:inherit;font-size:13px;color:var(--fg);background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-md);padding:8px 12px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-wk-opt:hover:not([disabled]){border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-wk-opt.right{border-color:#a6e3a1;background:color-mix(in srgb,#a6e3a1 14%,var(--bg));}" +
  "#" + WIN_ID + " .cd-wk-opt.wrong{border-color:#f38ba8;background:color-mix(in srgb,#f38ba8 14%,var(--bg));}" +
  "#" + WIN_ID + " .cd-wk-expl{font-size:12px;color:var(--muted);margin-top:8px;}" +
  "#" + WIN_ID + " .cd-wk-ctl{display:flex;gap:8px;margin-top:12px;}" +
  "#" + WIN_ID + " .cd-wk-res{text-align:center;font-size:13px;}" +
  "#" + WIN_ID + " .cd-wk-big{font-size:38px;font-weight:800;margin:6px 0;}" +
  "#" + WIN_ID + " .cd-wk-res .cd-wk-by{max-width:420px;margin:12px auto;text-align:left;}" +
  "#" + WIN_ID + " .cd-wk-res .cd-wk-ctl{justify-content:center;}" +
  // Достижения и рекорды
  "#" + WIN_ID + " .cd-ach-sum,#" + WIN_ID + " .cd-rec-sum{font-size:13px;color:var(--muted);margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-ach-sum b,#" + WIN_ID + " .cd-rec-sum b{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-ach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;}" +
  "#" + WIN_ID + " .cd-ach{display:grid;grid-template-columns:36px 1fr;grid-template-rows:auto auto auto;column-gap:10px;padding:9px 10px;border:1px solid var(--bd);border-radius:var(--cd-r-lg);background:var(--bg);opacity:.55;filter:grayscale(1);}" +
  "#" + WIN_ID + " .cd-ach.got{opacity:1;filter:none;border-color:color-mix(in srgb,#f9e2af 50%,var(--bd));}" +
  "#" + WIN_ID + " .cd-ach-ic{grid-row:1/4;display:flex;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-ach-ic .cd-emo{width:32px;height:32px;}" +
  "#" + WIN_ID + " .cd-ach-mono{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--ac);color:#11111b;font-weight:800;}" +
  "#" + WIN_ID + " .cd-ach-t{font-size:12px;font-weight:700;}" +
  "#" + WIN_ID + " .cd-ach-d{font-size:11px;color:var(--muted);line-height:1.4;}" +
  "#" + WIN_ID + " .cd-ach-when{font-size:10px;color:var(--muted);margin-top:2px;}" +
  "#" + WIN_ID + " .cd-rec-t{font-size:12px;}" +
  "#" + WIN_ID + " .cd-rec-last{margin-top:12px;font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-rec-last li span:first-child{flex:0 0 90px;}" +
  "#" + WIN_ID + " .cd-rec-last li b{flex:0 0 50px;color:var(--fg);}" +
  // Контрольная точка и «Повтори за мной»: сравнение кода
  "#" + WIN_ID + " .cd-article .cd-cp{border:1px solid color-mix(in srgb,#89b4fa 45%,var(--bd));border-radius:var(--cd-r-xl);padding:12px 14px;margin:16px 0;background:color-mix(in srgb,#89b4fa 6%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-cp-head{display:flex;gap:10px;align-items:center;margin-bottom:6px;}" +
  "#" + WIN_ID + " .cd-article .cd-cp-stat{font-size:13px;margin:10px 0 4px;}" +
  "#" + WIN_ID + " .cd-article .cd-cp-miss{font-size:12px;color:#fab387;margin:4px 0;}" +
  "#" + WIN_ID + " .cd-article .cd-cp-note{font-size:12px;color:var(--muted);margin:4px 0 8px;}" +
  "#" + WIN_ID + " .cd-article .cd-df{border:1px solid var(--bd);border-radius:var(--cd-r-md);padding:6px 0;max-height:420px;overflow:auto;background:var(--code);font-family:'Cascadia Code',Consolas,monospace;font-size:12px;}" +
  "#" + WIN_ID + " .cd-article .cd-df-leg{display:flex;gap:14px;padding:0 10px 6px;font-family:inherit;font-size:11px;}" +
  "#" + WIN_ID + " .cd-article .cd-df-leg .del,#" + WIN_ID + " .cd-article .cd-df-l.del i{color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-df-leg .add,#" + WIN_ID + " .cd-article .cd-df-l.add i{color:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-df-l{display:flex;gap:8px;padding:0 10px;white-space:pre;}" +
  "#" + WIN_ID + " .cd-article .cd-df-l i{font-style:normal;flex:0 0 10px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-article .cd-df-l code{background:none;padding:0;}" +
  "#" + WIN_ID + " .cd-article .cd-df-l.del{background:color-mix(in srgb,#f38ba8 12%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-df-l.add{background:color-mix(in srgb,#a6e3a1 12%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-df-gap{padding:2px 28px;color:var(--muted);font-style:italic;font-family:inherit;}" +
  "#" + WIN_ID + " .cd-article .cd-rep-hide{display:block;font-size:12px;color:var(--muted);margin:6px 0;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-article:has(.cd-rep.hidecode:not(.done)) pre:not(.peek){filter:blur(5px);cursor:pointer;user-select:none;}" +
  "#" + WIN_ID + " .cd-article:has(.cd-rep.hidecode:not(.done)) .cd-rep pre{filter:none;cursor:auto;user-select:auto;}" +

  // Плашка-мост доки↔редактор: всплывает снизу читалки по слову под курсором
  "#" + WIN_ID + " .cd-bridge{position:sticky;bottom:12px;z-index:6;margin:14px 14px 6px;display:flex;align-items:center;gap:11px;padding:10px 13px;border:1px solid var(--ac);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--panel) 92%,var(--ac));box-shadow:var(--cd-sh-2);}" +
  "#" + WIN_ID + " .cd-bridge-ic{flex:0 0 auto;font-size:15px;color:var(--ac);}" +
  "#" + WIN_ID + " .cd-bridge-body{flex:1 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-bridge-word{font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-weight:700;font-size:13px;color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-bridge-def{font-size:12px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-bridge-open{flex:0 0 auto;font:inherit;font-size:11.5px;font-weight:700;color:#11111b;background:var(--ac);border:none;border-radius:var(--cd-r-pill);padding:6px 14px;cursor:pointer;transition:filter var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-bridge-open:hover{filter:brightness(1.1);}" +
  "#" + WIN_ID + " .cd-bridge-ex{flex:0 0 auto;font:inherit;font-size:11.5px;font-weight:700;color:var(--fg);background:none;border:1px solid var(--bd);border-radius:var(--cd-r-pill);padding:5px 12px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-bridge-ex:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-bridge-ex[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-bridge-x{flex:0 0 auto;font:inherit;font-size:12px;color:var(--muted);background:none;border:none;cursor:pointer;padding:2px 4px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-bridge-x:hover{color:var(--fg);background:var(--hl);}" +

  // Подсветка отдельных строк кода (```cpp {3,5-7})
  "#" + WIN_ID + " pre.code.cd-lined code{display:block;}" +
  "#" + WIN_ID + " pre.code.cd-lined .cd-ln{display:block;}" +
  "#" + WIN_ID + " pre.code.cd-lined .cd-hl{background:rgba(var(--ac-rgb),.14);border-left:2px solid var(--ac);margin:0 -16px;padding:0 16px 0 14px;}" +

  // Диаграмма/схема (```diagram, ```svg)
  "#" + WIN_ID + " .cd-article .cd-figure{margin:16px 0;padding:16px 14px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 3%,var(--panel));text-align:center;}" +
  "#" + WIN_ID + " .cd-article .cd-figure-art{overflow-x:auto;}" +
  "#" + WIN_ID + " .cd-article .cd-figure svg{max-width:100%;height:auto;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-article .cd-figure img{max-width:100%;height:auto;border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-article .cd-figure figcaption{margin-top:10px;font-size:12px;color:var(--muted);}" +

  // Было/стало в две колонки (```badgood)
  "#" + WIN_ID + " .cd-article .cd-badgood{display:flex;gap:12px;margin:14px 0;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col{flex:1 1 260px;min-width:0;border:1px solid var(--bd);border-radius:var(--cd-r-lg);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-article .cd-bg-lab{font-size:12px;font-weight:700;padding:6px 12px;border-bottom:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col.bad .cd-bg-lab{color:#f38ba8;background:rgba(243,139,168,.12);}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col.good .cd-bg-lab{color:#a6e3a1;background:rgba(166,227,161,.12);}" +
  "#" + WIN_ID + " .cd-article .cd-bg-col pre.code{border-radius:0;}" +

  // Транскрипт консоли (```console)
  "#" + WIN_ID + " .cd-article .cd-console{margin:14px 0;border:1px solid var(--bd);border-radius:var(--cd-r-lg);overflow:hidden;box-shadow:var(--cd-sh-1);}" +
  "#" + WIN_ID + " .cd-article .cd-console-bar{display:flex;align-items:center;gap:6px;padding:7px 12px;background:#1e1e2e;border-bottom:1px solid rgba(255,255,255,.08);}" +
  "#" + WIN_ID + " .cd-article .cd-console-dot{width:9px;height:9px;border-radius:50%;background:#585b70;}" +
  "#" + WIN_ID + " .cd-article .cd-console-dot:nth-child(1){background:#f38ba8;}" +
  "#" + WIN_ID + " .cd-article .cd-console-dot:nth-child(2){background:#f9e2af;}" +
  "#" + WIN_ID + " .cd-article .cd-console-dot:nth-child(3){background:#a6e3a1;}" +
  "#" + WIN_ID + " .cd-article .cd-console-ttl{margin-left:6px;font-size:11px;color:#a6adc8;}" +
  "#" + WIN_ID + " .cd-article .cd-console-body{margin:0;padding:12px 16px;background:#11111b;color:#cdd6f4;overflow-x:auto;font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:12.5px;line-height:1.55;}" +
  "#" + WIN_ID + " .cd-article .cd-con-line{display:block;white-space:pre-wrap;}" +
  "#" + WIN_ID + " .cd-article .cd-con-in{color:#a6e3a1;font-weight:700;}" +

  // Чек-лист «усвоено» (```checklist)
  "#" + WIN_ID + " .cd-article .cd-check{margin:16px 0;padding:14px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:color-mix(in srgb,var(--fg) 4%,var(--panel));}" +
  "#" + WIN_ID + " .cd-article .cd-check-head{font-weight:700;color:var(--ac2);font-size:13.5px;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-article .cd-check-item{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;font:inherit;font-size:13px;color:var(--fg);cursor:pointer;padding:8px 10px;border:1px solid transparent;border-radius:var(--cd-r-md);background:none;transition:background var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-check-item:hover{background:var(--hl);}" +
  "#" + WIN_ID + " .cd-article .cd-check-box{flex:0 0 auto;width:17px;height:17px;margin-top:1px;border:2px solid var(--faint);border-radius:var(--cd-r-sm);transition:all var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article .cd-check-item.on .cd-check-box{border-color:#a6e3a1;background:#a6e3a1;position:relative;}" +
  "#" + WIN_ID + " .cd-article .cd-check-item.on .cd-check-box::after{content:'\\2713';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#11111b;}" +
  "#" + WIN_ID + " .cd-article .cd-check-item.on .cd-check-txt{color:var(--muted);text-decoration:line-through;}" +

  // Вспышка при переходе к разделу (по ссылке/оглавлению)
  "@keyframes cd-flash{0%{background:rgba(var(--ac-rgb),.32);}100%{background:transparent;}}" +
  "#" + WIN_ID + " .cd-flash{animation:cd-flash 1.1s ease-out;border-radius:var(--cd-r-sm);}" +

  // Мягкое проявление статьи при открытии + плавный ховер пунктов
  "@keyframes cd-fade{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + " .cd-article.fade{animation:cd-fade .18s ease-out;}" +
  "#" + WIN_ID + " .cd-item{transition:background var(--cd-t-fast);}" +

  // Доступность: видимая обводка при навигации с клавиатуры
  "#" + WIN_ID + " button:focus-visible,#" + WIN_ID + " input:focus-visible,#" + WIN_ID + " [tabindex]:focus-visible{outline:2px solid var(--ac);outline-offset:1px;border-radius:var(--cd-r-sm);}" +

  // Ширина колонки чтения (широкий режим)
  "#" + WIN_ID + ".wide .cd-article{max-width:1180px;}" +

  // Плотный список файлов (компактный режим)
  "#" + WIN_ID + ".dense .cd-item{padding:5px 8px 5px 12px;}" +
  "#" + WIN_ID + ".dense .cd-it-sub{display:none;}" +
  "#" + WIN_ID + ".dense .cd-it-meta{margin-top:1px;}" +
  "#" + WIN_ID + ".dense .cd-it-title{font-size:12px;padding-right:34px;}" +
  // невысокое окно (ноутбук): описание пункта в одну строку, чтобы в списке помещалось больше
  "#" + WIN_ID + ".short:not(.dense) .cd-it-sub{-webkit-line-clamp:1;line-clamp:1;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;}" +
  "#" + WIN_ID + ".short:not(.dense) .cd-item{padding-top:6px;padding-bottom:6px;}" +

  // «Ничего не найдено» по поиску
  "#" + WIN_ID + " .cd-noresult{padding:18px 14px;text-align:center;color:var(--faint);font-size:12px;line-height:1.5;display:none;}" +
  "#" + WIN_ID + " .cd-noresult b{color:var(--muted);}" +

  // Наклейки-иллюстрации: пустые состояния, приветствие, «всё изучено»
  "#" + WIN_ID + " .cd-sticker{display:inline-block;vertical-align:middle;filter:drop-shadow(0 3px 6px rgba(0,0,0,.28));}" +
  "#" + WIN_ID + " .cd-sticker-svg{display:inline-flex;line-height:0;}" +
  "#" + WIN_ID + " .cd-sticker-svg svg{width:100%;height:100%;display:block;overflow:visible;}" +
  "#" + WIN_ID + " .cd-empty-art{margin:0 auto 14px;display:flex;justify-content:center;transform:rotate(-4deg);}" +
  "#" + WIN_ID + " .cd-empty-t{font-size:14px;font-weight:700;color:var(--fg);margin-bottom:5px;}" +
  "#" + WIN_ID + " .cd-empty-s{font-size:11.5px;color:var(--faint);line-height:1.5;max-width:270px;margin:0 auto;}" +
  "#" + WIN_ID + " .cd-empty-home{max-width:360px;margin:40px auto 0;}" +
  // карточка «всё изучено!» на главном экране (золотой акцент вместо синего)
  "#" + WIN_ID + " .cd-home-done{display:flex;align-items:center;gap:16px;width:100%;text-align:left;border:1px solid rgba(234,179,8,.34);" +
  "background:linear-gradient(135deg,rgba(234,179,8,.16),rgba(234,179,8,.04));border-radius:var(--cd-r-2xl);padding:15px 18px;margin-bottom:26px;}" +
  "#" + WIN_ID + " .cd-done-art{flex:0 0 auto;transform:rotate(-6deg);}" +
  "#" + WIN_ID + " .cd-home-done .cd-hc-lbl{color:#eab308;}" +

  // --- Анимации (все отключаются под prefers-reduced-motion правилом выше) ---
  // Появление окна и кнопки-запуска
  "@keyframes cd-win-in{from{opacity:0;transform:translateY(10px) scale(.985);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + ".cd-in{animation:cd-win-in .22s cubic-bezier(.2,.8,.2,1);}" +
  "@keyframes cd-pop{from{opacity:0;transform:translateY(10px) scale(.9);}to{opacity:1;transform:none;}}" +
  "#" + BTN_ID + "{animation:cd-pop .26s cubic-bezier(.2,.8,.2,1);}" +
  // Появление меню вида и второго документа
  "@keyframes cd-menu-in{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:none;}}" +
  "@keyframes cd-split-in{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + " .cd-split{animation:cd-split-in .2s ease-out;}" +
  // Плавные ховеры и тактильный отклик на нажатие
  "#" + WIN_ID + " .cd-rbtn,#" + WIN_ID + " .cd-hbtn,#" + WIN_ID + " .cd-tab,#" + WIN_ID + " .cd-ol,#" + WIN_ID + " .cd-continue{transition:background .13s ease,color .13s ease,border-color .13s ease,transform var(--cd-t-fast) ease;}" +
  "#" + WIN_ID + " .cd-rn{transition:background .13s ease,border-color .13s ease,transform var(--cd-t-fast) ease,box-shadow var(--cd-t-fast) ease;}" +
  "#" + WIN_ID + " .cd-rn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.18);}" +
  "#" + WIN_ID + " .cd-continue:hover{transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-hbtn:active,#" + WIN_ID + " .cd-rbtn:active,#" + WIN_ID + " .cd-continue:active{transform:scale(.93);}" +
  "#" + WIN_ID + " .cd-item{transition:background .13s ease,box-shadow .13s ease;}" +
  "#" + WIN_ID + " .cd-item:hover{box-shadow:inset 0 0 0 1px var(--bd2);}" +
  "#" + WIN_ID + " .cd-item.active{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gcolor,var(--ac)) 26%,transparent);}" +

  // Кнопка-запуск (плавающая пилюля)
  "#" + BTN_ID + "{position:fixed;z-index:2147482000;right:18px;bottom:30px;display:inline-flex;align-items:center;gap:7px;" +
  "padding:9px 15px;border-radius:var(--cd-r-pill);border:1px solid rgba(var(--cppdocs-ac-rgb,137,180,250),.45);cursor:pointer;user-select:none;" +
  "background:rgba(24,24,37,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#cdd6f4;" +
  "font-family:var(--vscode-font-family,'Segoe UI',system-ui,sans-serif);font-size:12.5px;font-weight:700;" +
  "box-shadow:var(--cd-sh-2);transition:transform var(--cd-t-fast),box-shadow var(--cd-t-fast);}" +
  "#" + BTN_ID + ":hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,.5);}" +
  "#" + BTN_ID + " .cd-btn-face{display:inline-flex;align-items:center;line-height:0;}" +
  "#" + BTN_ID + " .cd-btn-face .cd-sticker{filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));}" +
  "#" + BTN_ID + " .cd-badge.err{background:#f38ba8;color:#1e1e2e;}" +
  "#" + BTN_ID + " .cd-badge{font-size:10px;font-weight:800;padding:1px 7px;border-radius:var(--cd-r-pill);background:rgba(var(--cppdocs-ac-rgb,137,180,250),.28);color:var(--cppdocs-ac2,#b4befe);}" +

  // --- Полировка (#5): тематические скроллбары, фокус-обводки, поднятие карточек ---
  "#" + WIN_ID + " ::-webkit-scrollbar{width:10px;height:10px;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-track{background:transparent;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-thumb{background:var(--bd);border-radius:var(--cd-r-md);border:2px solid transparent;background-clip:content-box;}" +
  "#" + WIN_ID + " ::-webkit-scrollbar-thumb:hover{background:var(--faint);}" +
  "#" + WIN_ID + " *{scrollbar-width:thin;scrollbar-color:var(--bd) transparent;}" +
  "#" + WIN_ID + " button:focus-visible,#" + WIN_ID + " a:focus-visible,#" + WIN_ID + " textarea:focus-visible,#" + WIN_ID + " input:focus-visible{outline:2px solid var(--ac);outline-offset:2px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-home-chip:hover{transform:translateY(-1px);border-color:var(--ac);}" +

  // --- Новое: список задач «- [ ] …», якоря заголовков, кнопки «наверх»/«копировать», практика ---
  // Интерактивные чек-боксы в обычных списках
  "#" + WIN_ID + " .cd-article ul.cd-tasklist{list-style:none;padding-left:2px;}" +
  "#" + WIN_ID + " .cd-article li.cd-tl{display:flex;align-items:flex-start;gap:9px;margin:5px 0;}" +
  "#" + WIN_ID + " .cd-tl-box{flex:0 0 auto;margin-top:2px;width:17px;height:17px;padding:0;cursor:pointer;border:1.6px solid var(--faint);border-radius:var(--cd-r-sm);background:transparent;transition:background var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-tl-box:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-tl-box.on{border-color:var(--ts);background:var(--ts);position:relative;}" +
  "#" + WIN_ID + " .cd-tl-box.on::after{content:'\\2713';position:absolute;left:1px;top:-2px;font-size:12px;font-weight:700;color:var(--panel);}" +
  "#" + WIN_ID + " .cd-tl-txt.done{opacity:.6;text-decoration:line-through;}" +
  // Якорь «#» у заголовка — виден при наведении на заголовок
  "#" + WIN_ID + " .cd-article h2,#" + WIN_ID + " .cd-article h3{position:relative;}" +
  "#" + WIN_ID + " .cd-hlink{border:none;background:none;cursor:pointer;color:var(--faint);font:inherit;font-weight:700;opacity:0;padding:0 4px;margin-left:4px;transition:opacity var(--cd-t-fast),color var(--cd-t-fast);vertical-align:middle;}" +
  "#" + WIN_ID + " .cd-article h2:hover .cd-hlink,#" + WIN_ID + " .cd-article h3:hover .cd-hlink{opacity:.55;}" +
  "#" + WIN_ID + " .cd-hlink:hover{opacity:1 !important;color:var(--ac);}" +
  "#" + WIN_ID + " .cd-hlink.copied{opacity:1 !important;color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rbtn.copied{color:var(--ts);border-color:var(--ts);}" +
  // Плавающая кнопка «наверх»
  "#" + WIN_ID + " .cd-totop{position:absolute;right:18px;bottom:18px;z-index:8;width:34px;height:34px;border-radius:50%;cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-size:16px;line-height:1;box-shadow:0 4px 14px rgba(0,0,0,.4);}" +
  "#" + WIN_ID + " .cd-totop:hover{border-color:var(--ac);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-totop[hidden]{display:none;}" +
  // Зачёркнутый текст
  "#" + WIN_ID + " .cd-article del{opacity:.7;}" +

  // --- #19 закладки-звёздочки у заголовков ---
  "#" + WIN_ID + " .cd-hmark{border:none;background:none;cursor:pointer;color:var(--faint);font:inherit;opacity:0;padding:0 3px;margin-left:6px;transition:opacity var(--cd-t-fast),color var(--cd-t-fast);vertical-align:middle;}" +
  "#" + WIN_ID + " .cd-article h2:hover .cd-hmark,#" + WIN_ID + " .cd-article h3:hover .cd-hmark{opacity:.55;}" +
  "#" + WIN_ID + " .cd-hmark:hover{opacity:1 !important;color:var(--ty);}" +
  "#" + WIN_ID + " .cd-hmark.on{opacity:1 !important;color:var(--ty);}" +
  "#" + WIN_ID + " .cd-home-mark{text-align:left;}" +

  // --- #11 поиск по тексту материала ---
  "#" + WIN_ID + " .cd-find{position:absolute;top:10px;right:16px;z-index:9;display:flex;align-items:center;gap:4px;padding:5px 6px;" +
  "background:var(--bg);border:1px solid var(--bd);border-radius:var(--cd-r-lg);box-shadow:var(--cd-sh-2);}" +
  "#" + WIN_ID + " .cd-find[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-find-in{border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-family:inherit;font-size:12.5px;padding:5px 8px;border-radius:var(--cd-r-md);width:190px;outline:none;}" +
  "#" + WIN_ID + " .cd-find-in:focus{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-find-n{min-width:34px;text-align:center;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-find-n.cd-find-none{color:var(--tp);}" +
  "#" + WIN_ID + " .cd-find-b{border:1px solid transparent;background:none;color:var(--muted);cursor:pointer;font-size:13px;line-height:1;padding:4px 7px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-find-b:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " mark.cd-find-hit{background:var(--ty);color:#1e1e2e;border-radius:2px;padding:0 1px;}" +
  "#" + WIN_ID + " mark.cd-find-hit.cur{background:var(--tn);outline:2px solid var(--tn);}" +

  // --- #8 кольцо прогресса вокруг маскота ---
  "#" + WIN_ID + " .cd-home-mascot.cd-has-ring{position:relative;width:104px;height:104px;flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-ring{position:absolute;inset:0;width:104px;height:104px;transform:rotate(-90deg);}" +
  "#" + WIN_ID + " .cd-ring-bg{fill:none;stroke:var(--bd);stroke-width:6;}" +
  "#" + WIN_ID + " .cd-ring-fg{fill:none;stroke:var(--ac);stroke-width:6;stroke-linecap:round;filter:drop-shadow(0 0 4px rgba(var(--ac-rgb),.55));transition:stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1);}" +
  "#" + WIN_ID + " .cd-ring-in{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}" +
  "#" + WIN_ID + " .cd-home-status{margin-top:6px;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;}" +

  // --- #2 поиск на главной ---
  "#" + WIN_ID + " .cd-home-search{position:relative;margin:2px 0 16px;}" +
  "#" + WIN_ID + " .cd-hs-ic{position:absolute;left:12px;top:11px;font-size:15px;opacity:.4;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-hs-in{width:100%;padding:10px 12px 10px 34px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--panel);color:var(--fg);font-family:inherit;font-size:13.5px;outline:none;}" +
  "#" + WIN_ID + " .cd-hs-in:focus{border-color:var(--ac);box-shadow:0 0 0 3px rgba(var(--ac-rgb),.16);}" +
  "#" + WIN_ID + " .cd-hs-res{margin-top:6px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--bg);overflow:hidden;box-shadow:var(--cd-sh-2);}" +
  "#" + WIN_ID + " .cd-hs-res[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-hs-item{display:block;width:100%;text-align:left;border:none;border-bottom:1px solid var(--bd2);background:none;color:var(--fg);cursor:pointer;font-family:inherit;padding:8px 12px;}" +
  "#" + WIN_ID + " .cd-hs-item:hover{background:var(--hl);}" +
  "#" + WIN_ID + " .cd-hs-item b{font-size:13px;font-weight:600;}" +
  "#" + WIN_ID + " .cd-hs-item span{display:block;font-size:11px;opacity:.6;margin-top:2px;}" +
  "#" + WIN_ID + " .cd-hs-item .cd-hs-sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--ac2);opacity:.9;margin-top:3px;}" +
  "#" + WIN_ID + " .cd-hs-item .cd-hs-snip{font-size:11.5px;line-height:1.45;color:var(--muted);opacity:1;margin-top:3px;}" +
  "#" + WIN_ID + " .cd-hs-item .cd-hs-snip mark{background:rgba(var(--ac-rgb),.28);color:var(--fg);border-radius:3px;padding:0 2px;}" +
  "#" + WIN_ID + " .cd-hs-empty{padding:10px 12px;font-size:12px;opacity:.6;}" +

  // --- #10 «Что нового» ---
  "#" + WIN_ID + " .cd-whatsnew{margin:0 0 16px;padding:14px 16px;border:1px solid rgba(var(--ac-rgb),.35);border-radius:var(--cd-r-xl);background:linear-gradient(180deg,rgba(var(--ac-rgb),.12),transparent);}" +
  "#" + WIN_ID + " .cd-wn-h{font-weight:700;font-size:13px;margin-bottom:6px;}" +
  "#" + WIN_ID + " .cd-wn-list{margin:0 0 10px;padding-left:18px;font-size:12.5px;line-height:1.7;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-wn-list b{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-wn-ok{cursor:pointer;border:none;background:var(--ac);color:#1e1e2e;font-family:inherit;font-size:12px;font-weight:700;padding:7px 16px;border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-wn-ok:hover{filter:brightness(1.08);}" +

  // --- #9 панель быстрых действий ---
  "#" + WIN_ID + " .cd-qabar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px;}" +
  "#" + WIN_ID + " .cd-qa{cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-family:inherit;font-size:12.5px;font-weight:600;padding:9px 14px;border-radius:var(--cd-r-lg);transition:border-color var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-qa:hover{border-color:var(--ac);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-qa-rev{border-color:rgba(var(--ac-rgb),.5);}" +
  // «Продолжить» — главное действие, акцентная заливка; остальные пилюли — призрачные
  "#" + WIN_ID + " .cd-qa-cont{background:var(--ac);color:#1e1e2e;border-color:transparent;box-shadow:0 4px 14px rgba(var(--ac-rgb),.28);}" +
  "#" + WIN_ID + " .cd-qa-cont:hover{border-color:transparent;filter:brightness(1.07);transform:translateY(-1px);}" +

  // --- #3 карточка повторения + «дальше по курсу» ---
  "#" + WIN_ID + " .cd-home-review,#" + WIN_ID + " .cd-home-cont{width:100%;text-align:left;}" +
  "#" + WIN_ID + " .cd-home-review{display:flex;align-items:center;gap:14px;margin:0 0 14px;padding:15px 18px;border:1px solid rgba(var(--ac-rgb),.4);border-radius:var(--cd-r-2xl);background:linear-gradient(135deg,rgba(var(--ac-rgb),.14),rgba(var(--ac-rgb),.03));cursor:pointer;color:var(--fg);transition:transform var(--cd-t-fast),box-shadow var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-home-review:hover{border-color:var(--ac);transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.26);}" +
  "#" + WIN_ID + " .cd-home-review:hover .cd-hc-arrow{transform:translateX(4px);opacity:1;}" +
  "#" + WIN_ID + " .cd-home-next{display:block;width:100%;text-align:left;margin:-6px 0 14px;padding:8px 12px;border:none;background:none;color:var(--muted);cursor:pointer;font-family:inherit;font-size:12px;border-radius:var(--cd-r-md);}" +
  "#" + WIN_ID + " .cd-home-next:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-home-next b{color:var(--fg);}" +

  // --- #3 оверлей режима повторения ---
  "#" + WIN_ID + " .cd-review{position:absolute;inset:0;z-index:8;overflow-y:auto;background:radial-gradient(120% 68% at 50% -12%,rgba(var(--ac-rgb),.15),transparent 60%),var(--bg);}" +
  "#" + WIN_ID + " .cd-review[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-rv-inner{max-width:640px;margin:0 auto;padding:22px 26px 60px;}" +
  "#" + WIN_ID + " .cd-rv-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}" +
  "#" + WIN_ID + " .cd-rv-count{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-rv-close,#" + WIN_ID + " .cd-rv-close2{cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--fg);font-family:inherit;border-radius:var(--cd-r-md);padding:5px 10px;}" +
  "#" + WIN_ID + " .cd-rv-close:hover,#" + WIN_ID + " .cd-rv-close2:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-card{border:1px solid var(--bd);border-radius:var(--cd-r-2xl);background:var(--panel);padding:26px 22px;box-shadow:0 10px 30px rgba(0,0,0,.3);}" +
  "#" + WIN_ID + " .cd-rv-q{font-size:17px;font-weight:600;line-height:1.5;}" +
  "#" + WIN_ID + " .cd-rv-a{margin-top:16px;padding-top:16px;border-top:1px solid var(--bd);font-size:15px;line-height:1.6;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-rv-ctl{margin-top:20px;display:flex;flex-wrap:wrap;gap:8px;}" +
  "#" + WIN_ID + " .cd-rv-show{cursor:pointer;border:none;background:var(--ac);color:#1e1e2e;font-family:inherit;font-size:13px;font-weight:700;padding:10px 20px;border-radius:var(--cd-r-lg);}" +
  "#" + WIN_ID + " .cd-rv-rate{display:flex;gap:8px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-rv-grade{cursor:pointer;border:1px solid var(--bd);background:var(--bg);color:var(--fg);font-family:inherit;font-size:12.5px;padding:10px 16px;border-radius:var(--cd-r-lg);}" +
  "#" + WIN_ID + " .cd-rv-grade[data-g='0']:hover{border-color:var(--tp);color:var(--tp);}" +
  "#" + WIN_ID + " .cd-rv-grade[data-g='1']:hover{border-color:var(--tn);color:var(--tn);}" +
  "#" + WIN_ID + " .cd-rv-grade[data-g='2']:hover{border-color:var(--ts);color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rv-done{text-align:center;padding:40px 20px;}" +
  // режим повторения: список материалов прячем, карточка крупнее, полоска прогресса сессии
  "#" + WIN_ID + ".reviewing .cd-nav{display:none;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-inner{max-width:760px;padding-top:34px;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-card{min-height:260px;padding:34px 34px 28px;display:flex;flex-direction:column;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-q{font-size:20px;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-a{font-size:16px;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-ctl{margin-top:auto;padding-top:22px;}" +
  "#" + WIN_ID + " .cd-rv-top{gap:12px;}" +
  "#" + WIN_ID + " .cd-rv-prog{flex:1 1 auto;height:6px;border-radius:3px;background:var(--bd2);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-rv-prog i{display:block;height:100%;background:var(--ac);border-radius:3px;transition:width var(--cd-t-slow);}" +
  "#" + WIN_ID + " .cd-rv-from{font-size:11.5px;color:var(--faint);margin:-8px 0 12px;}" +
  "#" + WIN_ID + " .cd-rv-grade{display:inline-flex;flex-direction:column;align-items:center;gap:1px;line-height:1.25;}" +
  "#" + WIN_ID + " .cd-rv-grade small{font-size:10.5px;color:var(--faint);font-weight:500;}" +
  "#" + WIN_ID + " .cd-rv-open{margin-left:auto;cursor:pointer;border:0;background:none;color:var(--muted);font:inherit;font-size:12px;text-decoration:underline;text-underline-offset:3px;}" +
  "#" + WIN_ID + " .cd-rv-open:hover{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-hint{margin-top:12px;font-size:11.5px;color:var(--faint);text-align:center;}" +
  // главная: план на сегодня, дорожка курса, «повторить все», один поиск
  "#" + WIN_ID + " .cd-plan{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:-4px 0 14px;font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-plan-l{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);margin-right:4px;}" +
  "#" + WIN_ID + " .cd-plan-step{border:1px solid var(--bd);background:var(--panel);color:var(--fg);border-radius:var(--cd-r-pill);padding:4px 11px;font:inherit;font-size:12.5px;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-plan-step:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-plan-step i{font-style:normal;color:var(--faint);margin-left:3px;}" +
  "#" + WIN_ID + " .cd-plan-arr{color:var(--faint);}" +
  "#" + WIN_ID + " .cd-track{margin:0 0 16px;padding:12px 14px 10px;border:1px solid var(--bd);border-radius:var(--cd-r-2xl);background:var(--panel);}" +
  "#" + WIN_ID + " .cd-track-h{display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-track-h b{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-track ol{list-style:none;margin:0;padding:0;display:flex;}" +
  "#" + WIN_ID + " .cd-track li{flex:1 1 0;min-width:0;position:relative;}" +
  "#" + WIN_ID + " .cd-track li+li::before{content:'';position:absolute;top:13px;right:calc(50% + 15px);left:calc(-50% + 15px);height:2px;background:var(--bd);}" +
  "#" + WIN_ID + " .cd-track li.done+li::before{background:var(--ts);}" +
  "#" + WIN_ID + " .cd-track button{display:flex;flex-direction:column;align-items:center;gap:5px;width:100%;border:0;background:none;color:var(--muted);font:inherit;cursor:pointer;padding:0 2px;}" +
  "#" + WIN_ID + " .cd-tr-dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid var(--bd);background:var(--bg);font-size:11.5px;font-weight:800;color:var(--muted);transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-track button:hover .cd-tr-dot{transform:scale(1.1);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-track li.done .cd-tr-dot{background:var(--ts);border-color:var(--ts);color:#1e1e2e;}" +
  "#" + WIN_ID + " .cd-track li.here .cd-tr-dot{border-color:var(--ac);color:var(--ac);box-shadow:0 0 0 4px rgba(var(--ac-rgb),.18);}" +
  "#" + WIN_ID + " .cd-tr-n{font-size:10.5px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-track li.here .cd-tr-n{color:var(--fg);font-weight:700;}" +
  "#" + WIN_ID + " .cd-track li.exam .cd-tr-dot{position:relative;box-shadow:0 0 0 3px color-mix(in srgb,#f9e2af 70%,transparent);}" +
  "#" + WIN_ID + " .cd-track li.exam .cd-tr-dot::after{content:'★';position:absolute;top:-7px;right:-8px;font-size:11px;color:#f9e2af;}" +
  "#" + WIN_ID + " .cd-track-exam{display:block;margin:10px auto 0;border:0;background:none;color:var(--muted);font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;}" +
  "#" + WIN_ID + " .cd-track-exam:hover{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-home-warm[role=button]{cursor:pointer;}" +
  "#" + WIN_ID + " .cd-home-warm[role=button]:hover{border-color:#f9e2af;transform:translateY(-2px);}" +
  "#" + WIN_ID + " .cd-hw-all{flex:0 0 auto;font-size:12px;color:var(--muted);text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:4px 6px;border-radius:var(--cd-r-sm);}" +
  "#" + WIN_ID + " .cd-hw-all:hover{color:var(--ac);}" +
  "#" + WIN_ID + ".home .cd-search{display:none;}" +
  "#" + WIN_ID + " .cd-rv-done-t{font-size:18px;font-weight:700;margin-top:12px;}" +
  "#" + WIN_ID + " .cd-rv-done-s{font-size:13px;color:var(--muted);margin:8px 0 20px;}" +

  // =====================================================================
  //  ДИЗАЙН-ПОЛИРОВКА (аккуратная, 2026-09-20). Идёт в конце строки CSS,
  //  поэтому при равной специфичности перебивает более ранние правила.
  // =====================================================================

  // --- #14 Система теней: 3 уровня (var --sh1/2/3). Светлая тема — мягче. ---
  "#" + WIN_ID + "{--sh1:0 1px 2px rgba(0,0,0,.18),0 2px 6px rgba(0,0,0,.20);--sh2:0 6px 18px rgba(0,0,0,.30);--sh3:0 18px 50px rgba(0,0,0,.50);}" +
  "#" + WIN_ID + ".light{--sh1:0 1px 2px rgba(30,30,46,.06),0 2px 6px rgba(30,30,46,.08);--sh2:0 6px 18px rgba(30,30,46,.13);--sh3:0 18px 46px rgba(30,30,46,.20);}" +
  "#" + WIN_ID + "{box-shadow:var(--sh3);}" +
  "#" + WIN_ID + " .cd-hs-res,#" + WIN_ID + " .cd-find{box-shadow:var(--sh2);}" +
  "#" + WIN_ID + " .cd-taskcard{box-shadow:var(--sh1);}" +
  "#" + WIN_ID + " .cd-totop{box-shadow:var(--sh2);}" +
  "#" + WIN_ID + " .cd-home-card:hover,#" + WIN_ID + " .cd-home-cont:hover,#" + WIN_ID + " .cd-home-review:hover,#" + WIN_ID + " .cd-dtile:hover{box-shadow:var(--sh2);}" +

  // --- #1 Чтение: чуть крупнее проза + больше воздуха между абзацами ---
  "#" + WIN_ID + " .cd-article{font-size:13.5px;}" +
  "#" + WIN_ID + " .cd-article p{margin:11px 0;}" +
  "#" + WIN_ID + " .cd-article li{margin:5px 0;}" +
  "#" + WIN_ID + " .cd-article code{font-size:12.5px;padding:1.5px 6px;}" +

  // --- #16 Светлая тема (Latte): усилить контраст вторичного текста и границ ---
  "#" + WIN_ID + ".light{--faint:#6c6f85;--bd:rgba(30,30,46,.18);--bd2:rgba(30,30,46,.10);}" +

  // --- #5 Главная: плотнее вертикальный ритм, меньше пустот сверху ---
  "#" + WIN_ID + " .cd-home-inner{padding-top:24px;}" +
  "#" + WIN_ID + " .cd-home-hero{margin-bottom:14px;padding:16px 22px;}" +
  "#" + WIN_ID + " .cd-home-search{margin:0 0 13px;}" +
  "#" + WIN_ID + " .cd-whatsnew{margin:0 0 13px;}" +
  "#" + WIN_ID + " .cd-qabar{margin:0 0 13px;}" +
  "#" + WIN_ID + " .cd-home-review{margin:0 0 12px;}" +

  // --- #6 Плитки статистики: тёплая подсветка под тип + рамка в цвет ---
  "#" + WIN_ID + " .cd-dt-read{background:color-mix(in srgb,#89b4fa 8%,var(--panel));border-color:color-mix(in srgb,#89b4fa 24%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dt-solve{background:color-mix(in srgb,#a6e3a1 8%,var(--panel));border-color:color-mix(in srgb,#a6e3a1 24%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dt-streak{background:color-mix(in srgb,#fab387 9%,var(--panel));border-color:color-mix(in srgb,#fab387 26%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dt-streak .cd-dt-v{color:#fab387;}" +
  "#" + WIN_ID + ".light .cd-dt-streak .cd-dt-v{color:#e8590c;}" +

  // --- #7 Живой маскот: мягкое «дыхание» (глушится общим reduced-motion правилом) ---
  "@keyframes cd-bob{0%,100%{transform:rotate(-5deg) translateY(0);}50%{transform:rotate(-5deg) translateY(-4px);}}" +
  "#" + WIN_ID + " .cd-home-mascot .cd-sticker{animation:cd-bob 3.6s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-home-mascot:hover .cd-sticker{animation:none;transform:rotate(0) scale(1.05);}" +

  // --- #13 Единый язык кнопок: общий фокус-ринг + тактильное нажатие для шапки и читалки ---
  "#" + WIN_ID + " .cd-hbtn,#" + WIN_ID + " .cd-rbtn{transition:background var(--cd-t-fast),border-color var(--cd-t-fast),color var(--cd-t-fast),box-shadow var(--cd-t-fast),transform .08s;}" +
  "#" + WIN_ID + " .cd-hbtn:active,#" + WIN_ID + " .cd-rbtn:active{transform:translateY(1px) scale(.97);}" +
  "#" + WIN_ID + " .cd-hbtn:focus-visible,#" + WIN_ID + " .cd-rbtn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bg),0 0 0 4px rgba(var(--ac-rgb),.55);}" +

  // --- #10 Микро-праздник: искры + пульс кнопки при «изучено/решено» ---
  "@keyframes cd-spark-fly{0%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(0);}" +
  "100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.35) rotate(var(--dr));}}" +
  ".cd-spark{position:fixed;z-index:2147483600;width:7px;height:7px;border-radius:2px;pointer-events:none;" +
  "transform:translate(-50%,-50%);animation:cd-spark-fly .68s cubic-bezier(.2,.7,.3,1) forwards;}" +
  "@keyframes cd-pulse{0%{transform:scale(1);}45%{transform:scale(1.16);}100%{transform:scale(1);}}" +
  "#" + WIN_ID + " .cd-pulse{animation:cd-pulse .42s ease;}" +

  // --- #17 Скелет-загрузка (когда источник данных есть, но материалы ещё не пришли) ---
  "@keyframes cd-shine{0%{background-position:-320px 0;}100%{background-position:320px 0;}}" +
  "#" + WIN_ID + " .cd-skel-b{background:linear-gradient(90deg,var(--bd2) 25%,var(--hl) 50%,var(--bd2) 75%);background-size:320px 100%;animation:cd-shine 1.2s linear infinite;border-radius:var(--cd-r-lg);}" +
  "#" + WIN_ID + " .cd-skel-hero{height:92px;margin-bottom:16px;border-radius:var(--cd-r-2xl);}" +
  "#" + WIN_ID + " .cd-skel-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;}" +
  "#" + WIN_ID + " .cd-skel-tile{height:74px;border-radius:var(--cd-r-xl);}" +
  "#" + WIN_ID + " .cd-skel-line{height:14px;margin:10px 0;}" +
  "#" + WIN_ID + " .cd-skel-line.w40{width:40%;}#" + WIN_ID + " .cd-skel-line.w60{width:60%;}#" + WIN_ID + " .cd-skel-line.w80{width:80%;}" +
  "#" + WIN_ID + " .cd-skel-note{margin-top:16px;text-align:center;font-size:12px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-skel-nav{padding:6px 8px;}#" + WIN_ID + " .cd-skel-nav .cd-skel-b{height:34px;margin:8px 0;border-radius:var(--cd-r-md);}" +

  // --- #20 Бренд-росчерк: рисованная подчёркивающая линия у заголовков секций ---
  "#" + WIN_ID + " .cd-home-sec{border-bottom-color:transparent;}" +
  "#" + WIN_ID + " .cd-home-sec .cd-sec-lbl{position:relative;}" +
  "#" + WIN_ID + " .cd-home-sec .cd-sec-lbl::after{content:'';position:absolute;left:0;bottom:-7px;width:1.7em;height:3px;border-radius:3px;" +
  "background:linear-gradient(90deg,var(--sc,var(--ac)),color-mix(in srgb,var(--sc,var(--ac)) 40%,transparent));transform:rotate(-.7deg);}" +
  "#" + WIN_ID + " .cd-home-sec .cd-sec-dot{box-shadow:0 0 0 4px color-mix(in srgb,var(--sc,var(--ac)) 16%,transparent);}" +

  // =====================================================================
  //  ДИЗАЙН-ПОЛИРОВКА, часть 2 (2026-09-20): #3, #4, #8, #9, #12.
  // =====================================================================

  // --- #3 Ссылки в статье: заметнее (лёгкое подчёркивание в покое) + чистый ховер ---
  "#" + WIN_ID + " .cd-article a{border-bottom:1px solid color-mix(in srgb,var(--ac) 22%,transparent);transition:color var(--cd-t-fast),border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article a:hover{border-bottom-color:var(--ac);color:var(--ac2);}" +

  // --- #4 Таблицы: рамка со скруглением, зебра, чёткий ховер строки ---
  "#" + WIN_ID + " .cd-article table{border:1px solid var(--bd);border-radius:var(--cd-r-lg);overflow:hidden;box-shadow:var(--sh1);}" +
  "#" + WIN_ID + " .cd-article tbody tr:nth-child(even){background:color-mix(in srgb,var(--fg) 3.5%,transparent);}" +
  "#" + WIN_ID + " .cd-article tbody tr:hover{background:color-mix(in srgb,var(--ac) 10%,transparent);}" +
  "#" + WIN_ID + " .cd-article th{border-bottom:1px solid var(--bd);}" +

  // --- #8 Карточка «Продолжить/Следующий шаг» — главный акцент экрана ---
  "#" + WIN_ID + " .cd-home-cont{padding:18px 22px;border-color:rgba(var(--ac-rgb),.48);" +
  "background:linear-gradient(135deg,rgba(var(--ac-rgb),.24),rgba(var(--ac-rgb),.06));box-shadow:var(--sh1);}" +
  "#" + WIN_ID + " .cd-home-cont .cd-hc-title{font-size:19px;}" +
  "#" + WIN_ID + " .cd-home-cont .cd-hc-arrow{width:36px;height:36px;font-size:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(var(--ac-rgb),.18);opacity:1;}" +
  "#" + WIN_ID + " .cd-home-cont:hover .cd-hc-arrow{background:var(--ac);color:#11111b;transform:translateX(3px);}" +

  // --- #9 Единый ритм секций: счётчик красится в цвет секции (как точка и росчерк) ---
  "#" + WIN_ID + " .cd-home-sec .cd-sec-count{opacity:1;font-weight:700;background:color-mix(in srgb,var(--sc,var(--ac)) 16%,transparent);color:color-mix(in srgb,var(--sc,var(--ac)) 70%,var(--fg));}" +

  // --- #12 Активный пункт рейки «На странице»: мягкое свечение + акцентная планка ---
  "#" + WIN_ID + " .cd-ol{transition:background var(--cd-t-fast),color var(--cd-t-fast),border-color var(--cd-t-fast),box-shadow var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-ol.active{border-left-width:3px;background:color-mix(in srgb,var(--ac) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac) 16%,transparent);}" +

  // --- Сворачивание разделов (## ) прямо в читалке ---
  "#" + WIN_ID + " .cd-article h2.cd-foldable{cursor:pointer;}" +
  "#" + WIN_ID + " .cd-fold-caret{display:inline-block;font-size:.58em;color:var(--faint);margin-right:.5em;transform:translateY(-2px);transition:transform var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article h2.cd-foldable:hover .cd-fold-caret{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-article h2.cd-sec-folded .cd-fold-caret{transform:rotate(-90deg);}" +
  "#" + WIN_ID + " .cd-article h2.cd-sec-folded{border-bottom-style:dashed;}" +
  "#" + WIN_ID + " .cd-fold-hidden{display:none!important;}" +
  // ПОЛИРОВКА 3 (2026-09-24, аудит 3.8): чёткая шкала заголовков и экономнее акцент.
  // Шкала 21 → 16.5 → 13.5 (h4 — капсом, чтобы не сливаться с прозой 13.5 px).
  "#" + WIN_ID + " .cd-article h2{font-size:21px;font-weight:750;line-height:1.3;letter-spacing:-.01em;}" +
  "#" + WIN_ID + " .cd-article h3{font-size:16.5px;font-weight:700;line-height:1.35;}" +
  "#" + WIN_ID + " .cd-article h4{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:18px 0 6px;}" +
  // Рамки-заметки: нейтральный фон панели вместо сиреневой заливки — акцент остаётся только полоской
  // слева, поэтому по-настоящему важное (кнопки, активные пункты) снова выделяется.
  "#" + WIN_ID + " .cd-article blockquote{background:var(--panel);border-left-color:rgba(var(--ac-rgb),.7);}" +
  "#" + WIN_ID + " .cd-article blockquote.cd-lead{background:none;}" +
  // ---- Шапка и панель читалки: капсулы кнопок, кромка, цвет группы (2026-09-25) ----
  "#" + WIN_ID + " .cd-head{position:relative;}" +
  "#" + WIN_ID + " .cd-head::before{content:'';position:absolute;left:14px;right:14px;top:0;height:2px;border-radius:0 0 3px 3px;background:linear-gradient(90deg,transparent,var(--ac) 25%,var(--ac2) 75%,transparent);opacity:.75;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-title b{background:linear-gradient(90deg,var(--ac2),var(--ac));-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:.3px;}" +
  "#" + WIN_ID + " .cd-logo{box-shadow:0 0 0 1px color-mix(in srgb,var(--ac) 35%,transparent),0 2px 10px rgba(var(--ac-rgb),.28);}" +
  "#" + WIN_ID + " .cd-hgrp{flex:0 0 auto;display:flex;align-items:center;gap:1px;padding:2px;border-radius:var(--cd-r-lg);background:color-mix(in srgb,var(--fg) 4%,transparent);border:1px solid color-mix(in srgb,var(--fg) 7%,transparent);}" +
  "#" + WIN_ID + " .cd-hgrp .cd-hbtn{width:27px;height:24px;display:grid;place-items:center;}" +
  "#" + WIN_ID + " .cd-hsep{display:block;width:1px;height:14px;margin:0 3px;background:color-mix(in srgb,var(--fg) 12%,transparent);}" +
  "#" + WIN_ID + " .cd-hbtn.cd-close:hover{background:color-mix(in srgb,#f38ba8 22%,transparent);color:#f38ba8;}" +
  "#" + WIN_ID + " .cd-uiic{width:16px;height:16px;display:block;object-fit:contain;pointer-events:none;}" +
  "#" + WIN_ID + " .cd-rbtn .cd-uiic{display:inline-block;vertical-align:-3px;width:15px;height:15px;}" +
  "#" + WIN_ID + " .cd-rbtn .cd-ic{display:inline-block;min-width:1em;text-align:center;}" +
  "#" + WIN_ID + " .cd-rbtn{display:inline-flex;align-items:center;gap:5px;border-radius:var(--cd-r-md);padding:5px 11px;background:color-mix(in srgb,var(--fg) 3%,var(--panel));}" +
  "#" + WIN_ID + " .cd-rbtn:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.18);}" +
  "#" + WIN_ID + " .cd-rgrp{display:flex;align-items:center;border:1px solid var(--bd);border-radius:var(--cd-r-lg);background:color-mix(in srgb,var(--fg) 3%,var(--panel));overflow:visible;}" +
  "#" + WIN_ID + " .cd-rgrp .cd-rbtn,.cd-rgrp .cd-tocwrap>.cd-rbtn{border:none;background:transparent;border-radius:0;padding:5px 10px;box-shadow:none;}" +
  "#" + WIN_ID + " .cd-rgrp .cd-rbtn:hover{transform:none;box-shadow:none;background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-rgrp>*+*{border-left:1px solid var(--bd);}" +
  "#" + WIN_ID + " .cd-rgrp>:first-child .cd-rbtn,.cd-rgrp>.cd-rbtn:first-child{border-radius:9px 0 0 9px;}" +
  "#" + WIN_ID + " .cd-rgrp>.cd-rbtn:last-child{border-radius:0 9px 9px 0;}" +
  "#" + WIN_ID + " .cd-readbtn{border-color:color-mix(in srgb,var(--ac) 45%,var(--bd));color:var(--fg);}" +
  "#" + WIN_ID + " .cd-readbtn.on{background:color-mix(in srgb,var(--ts) 14%,var(--panel));border-color:var(--ts);color:var(--ts);font-weight:700;}" +
  "#" + WIN_ID + ".home .cd-rgrp{display:none;}" +
  "#" + WIN_ID + ".no-anim .cd-rbtn:hover{transform:none;}" +
  "#" + WIN_ID + " .cd-head>*{position:relative;z-index:1;}" +
  "#" + WIN_ID + " .cd-peek{align-self:flex-end;height:34px;width:auto;margin:0 2px -8px auto;flex:0 0 auto;pointer-events:none;filter:drop-shadow(0 -1px 2px rgba(0,0,0,.25));transform-origin:50% 100%;animation:cdPeek 5s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-learned{position:absolute;z-index:40;width:120px;height:auto;pointer-events:none;animation:cdLearned 2.2s cubic-bezier(.2,1.4,.4,1) forwards;filter:drop-shadow(0 6px 14px rgba(0,0,0,.35));}" +
  "@keyframes cdPeek{0%,70%,100%{transform:translateY(0)}78%{transform:translateY(3px)}86%{transform:translateY(-2px) rotate(-3deg)}}" +
  "@keyframes cdLearned{0%{opacity:0;transform:scale(.3) translateY(-10px)}18%{opacity:1;transform:scale(1.08)}30%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}" +
  "#" + WIN_ID + ".no-anim .cd-peek{animation:none;}" +
  "#" + WIN_ID + ".tightbar .cd-peek,#" + WIN_ID + ".narrow .cd-peek,#" + WIN_ID + ".home .cd-peek,#" + WIN_ID + ".rolled .cd-peek{display:none;}" +
  "#" + WIN_ID + " .cd-gbadge{width:18px;height:18px;flex:0 0 auto;display:block;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));}" +
  "#" + WIN_ID + " .cd-ghead:hover .cd-gbadge{transform:rotate(-8deg) scale(1.08);transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-kicker .cd-kk-g{display:inline-flex;align-items:center;gap:5px;}" +
  "#" + WIN_ID + " .cd-kk-ic{width:15px;height:15px;display:block;margin-left:-3px;}" +
  "#" + WIN_ID + ".no-anim .cd-ghead:hover .cd-gbadge{transform:none;}" +
  "#" + WIN_ID + " .cd-title b{font-size:14px;font-weight:800;letter-spacing:.2px;}" +
  "#" + WIN_ID + ".rolled .cd-title{flex:1 1 auto;}" +
  "#" + WIN_ID + ".rolled .cd-rollinfo{position:relative;flex:0 1 auto;max-width:380px;min-width:0;display:flex!important;align-items:center;gap:8px;padding:5px 12px 7px;border-radius:var(--cd-r-lg);overflow:hidden;background:color-mix(in srgb,var(--fg) 4%,var(--panel));border:1px solid var(--bd);text-align:left;font:inherit;font-size:12px;color:var(--fg);cursor:pointer;}" +
  "#" + WIN_ID + ".rolled .cd-rollinfo:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-ri-ic{width:18px;height:18px;flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-ri-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--ac);}" +
  "#" + WIN_ID + " .cd-ri-t{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-ri-s{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-ri-s::before{content:\"›\";margin-right:6px;color:var(--faint,var(--muted));}" +
  "#" + WIN_ID + " .cd-ri-p{margin-left:4px;flex:0 0 auto;font-size:10.5px;font-weight:700;color:var(--ac2);}" +
  "#" + WIN_ID + " .cd-ri-bar{position:absolute;left:0;bottom:0;height:2px;background:linear-gradient(90deg,var(--ac),var(--ac2));border-radius:0 2px 2px 0;}" +
  "#" + WIN_ID + ".rolled .cd-rz-e,#" + WIN_ID + ".rolled .cd-rz-w{width:8px;}" +

  // ===== Шапка одной полосой (2026-09-25): крошки, кольцо прогресса, «Дальше», карточки, редактор =====
  // z-index — чтобы меню из шапки (⚙, «редактор») ложились поверх главной и статьи.
  "#" + WIN_ID + " .cd-head{z-index:12;gap:8px;padding:8px 10px;background:linear-gradient(180deg,color-mix(in srgb,var(--hcol,var(--ac)) 11%,transparent),transparent);}" +
  // Кромка сверху — цветом раздела, который сейчас читаешь (на главной — акцент).
  "#" + WIN_ID + " .cd-head::before{background:linear-gradient(90deg,transparent,var(--hcol,var(--ac)) 25%,color-mix(in srgb,var(--hcol,var(--ac)) 55%,var(--ac2)) 75%,transparent);}" +
  "#" + WIN_ID + " .cd-title{gap:8px;font-weight:600;}" +
  // Логотип в кольце общего прогресса «изучено».
  "#" + WIN_ID + " .cd-logo{width:30px;height:30px;padding:3px;border-radius:50%;overflow:visible;box-shadow:none;background:conic-gradient(var(--ac) calc(var(--lp,0) * 1%),color-mix(in srgb,var(--fg) 13%,transparent) 0);transition:transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-logo:hover{transform:scale(1.06);}" +
  "#" + WIN_ID + " .cd-logo-in{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--panel);font-size:13px;}" +
  "#" + WIN_ID + " .cd-logo-in img{width:100%;height:100%;display:block;}" +
  // Крошки: [значок Раздел] › Тема › подраздел
  "#" + WIN_ID + " .cd-crumbs{display:flex;align-items:center;min-width:0;flex:1 1 auto;overflow:hidden;white-space:nowrap;font-size:13px;}" +
  "#" + WIN_ID + " .cd-cg{flex:0 3 auto;min-width:30px;display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px 0 5px;border:1px solid transparent;border-radius:var(--cd-r-md);overflow:hidden;cursor:pointer;" +
  "background:color-mix(in srgb,var(--gcolor,var(--ac)) 13%,transparent);color:var(--gcolor,var(--ac));font:inherit;font-size:12px;font-weight:700;}" +
  "#" + WIN_ID + " .cd-cg:hover{border-color:color-mix(in srgb,var(--gcolor,var(--ac)) 55%,transparent);}" +
  "#" + WIN_ID + " .cd-cg-ic{width:18px;height:18px;flex:0 0 auto;display:block;}" +
  "#" + WIN_ID + " .cd-cg-dot{width:8px;height:8px;margin-left:4px;border-radius:50%;flex:0 0 auto;background:currentColor;}" +
  "#" + WIN_ID + " .cd-cg-t{min-width:0;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-cg:not([hidden])+.cd-rname::before{content:'›';margin:0 7px;color:var(--faint);font-weight:600;}" +
  "#" + WIN_ID + " .cd-crumbs .cd-rname{font-weight:700;color:var(--fg);}" +
  // Середина: пилюли «🎴 N», «редактор» и главная кнопка «Дальше»
  "#" + WIN_ID + " .cd-hx{flex:0 0 auto;display:flex;align-items:center;gap:6px;}" +
  "#" + WIN_ID + " .cd-hpill{position:relative;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--bd);border-radius:var(--cd-r-pill);cursor:pointer;white-space:nowrap;" +
  "background:color-mix(in srgb,var(--fg) 3%,var(--panel));color:var(--muted);font:inherit;font-size:12px;font-weight:600;transition:border-color var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-hpill:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-hrev{padding:0 10px 0 9px;}" +
  "#" + WIN_ID + " .cd-hrev-ic{font-size:13px;line-height:1;}" +
  "#" + WIN_ID + " .cd-hrev-n{color:var(--fg);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-hrev.due{border-color:color-mix(in srgb,var(--ty) 50%,var(--bd));}" +
  "#" + WIN_ID + " .cd-hrev-dot{position:absolute;top:2px;right:3px;width:7px;height:7px;border-radius:50%;background:var(--ty);box-shadow:0 0 0 2px var(--panel);}" +
  "#" + WIN_ID + " .cd-hed{max-width:200px;}" +
  "#" + WIN_ID + " .cd-hed-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--faint);}" +
  "#" + WIN_ID + " .cd-hed.ok .cd-hed-dot{background:var(--ts);box-shadow:0 0 0 3px color-mix(in srgb,var(--ts) 22%,transparent);}" +
  "#" + WIN_ID + " .cd-hed.err .cd-hed-dot{background:var(--tp);box-shadow:0 0 0 3px color-mix(in srgb,var(--tp) 22%,transparent);}" +
  "#" + WIN_ID + " .cd-hed.err{border-color:color-mix(in srgb,var(--tp) 45%,var(--bd));}" +
  "#" + WIN_ID + " .cd-hed-n{min-width:0;overflow:hidden;text-overflow:ellipsis;font-family:'Cascadia Code',Consolas,monospace;font-size:11.5px;}" +
  "#" + WIN_ID + " .cd-hed.none .cd-hed-n,#" + WIN_ID + " .cd-hed.off .cd-hed-n{font-family:inherit;font-size:12px;}" +
  "#" + WIN_ID + " .cd-hed-e{color:var(--tp);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-hed-e:empty{display:none;}" +
  "#" + WIN_ID + " .cd-hnext{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px 0 14px;border:none;border-radius:var(--cd-r-pill);cursor:pointer;white-space:nowrap;" +
  "background:linear-gradient(135deg,var(--ac),color-mix(in srgb,var(--ac) 55%,var(--ac2)));color:var(--panel);font:inherit;font-size:12px;font-weight:800;" +
  "box-shadow:0 2px 10px rgba(var(--ac-rgb),.3);transition:transform var(--cd-t-fast),filter var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-hnext:hover{filter:brightness(1.08);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-hnext:focus-visible,#" + WIN_ID + " .cd-hpill:focus-visible,#" + WIN_ID + " .cd-cg:focus-visible{outline:none;box-shadow:0 0 0 2px var(--bg),0 0 0 4px rgba(var(--ac-rgb),.55);}" +
  "#" + WIN_ID + " .cd-hnext-a{font-size:16px;line-height:1;margin-top:-2px;}" +
  "#" + WIN_ID + ".no-anim .cd-hnext:hover{transform:none;}" +
  // Инструменты чтения (бывшая вторая полоса) — справа в шапке
  "#" + WIN_ID + " .cd-hrt{flex:0 0 auto;display:flex;align-items:center;gap:6px;}" +
  "#" + WIN_ID + " .cd-hrt>.cd-rbtn{height:28px;padding:0 10px;}" +
  "#" + WIN_ID + " .cd-hrt .cd-rgrp .cd-rbtn{height:26px;}" +
  "#" + WIN_ID + " .cd-head .cd-peek{height:30px;margin:0 0 -9px;}" +
  // Всплывашка «Связь с редактором»
  "#" + WIN_ID + " .cd-edpop{position:absolute;top:calc(100% + 6px);z-index:30;width:320px;max-width:calc(100% - 16px);padding:10px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);" +
  "background:var(--bg);box-shadow:var(--sh2);cursor:auto;user-select:text;white-space:normal;font-size:12.5px;font-weight:400;color:var(--fg);animation:cd-menu-in .14s ease-out;}" +
  "#" + WIN_ID + " .cd-ep-h{margin:0 0 4px;font-size:10.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-ep-row{display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-top:1px solid var(--bd);line-height:1.45;}" +
  "#" + WIN_ID + " .cd-ep-h+.cd-ep-row{border-top:none;}" +
  "#" + WIN_ID + " .cd-ep-ic{flex:0 0 18px;text-align:center;}" +
  "#" + WIN_ID + " .cd-ep-row.good .cd-ep-ic{color:var(--ts);}" +
  "#" + WIN_ID + " .cd-ep-row.bad .cd-ep-ic{color:var(--tp);}" +
  "#" + WIN_ID + " .cd-ep-row.muted{color:var(--muted);}" +
  "#" + WIN_ID + " .cd-ep-sub{color:var(--faint);font-size:11px;}" +
  "#" + WIN_ID + " .cd-ep-row code{font-size:11.5px;padding:1px 5px;border-radius:var(--cd-r-sm);background:var(--hl);}" +
  "#" + WIN_ID + " .cd-ep-go{display:block;margin-top:7px;padding:5px 12px;border:none;border-radius:var(--cd-r-pill);background:var(--tp);color:var(--panel);font:inherit;font-size:12px;font-weight:700;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-ep-go:hover{filter:brightness(1.08);}" +
  // Свёрнутая полоска — только «тема › раздел» (rollinfo) и кнопки окна
  "#" + WIN_ID + ".rolled .cd-crumbs,#" + WIN_ID + ".rolled .cd-hx,#" + WIN_ID + ".rolled .cd-hrt,#" + WIN_ID + ".rolled .cd-edpop{display:none!important;}" +
  // Узкое окно: по шагам прячем подписи (кнопки остаются, с подсказками при наведении)
  // (1) название раздела → только значок; (2) подписи кнопок чтения и имя файла; (3) подпись «Дальше» и «Главная».
  "#" + WIN_ID + ".hc1 .cd-cg-t,#" + WIN_ID + ".hc1 .cd-head .cd-peek{display:none;}" +
  "#" + WIN_ID + ".hc1 .cd-cg{padding:0 5px;}" +
  "#" + WIN_ID + ".hc2 .cd-hrt .cd-bt,#" + WIN_ID + ".hc2 .cd-hed-n{display:none;}" +
  "#" + WIN_ID + ".hc3 .cd-hnext-t,#" + WIN_ID + ".hc3 .cd-hb-home{display:none;}" +
  "#" + WIN_ID + ".hc3 .cd-hnext{padding:0 12px;}" +
  "#" + WIN_ID + ".hc4 .cd-hx .cd-hpill{display:none;}" +

  // ===== Читалка, полировка (2026-09-25) =====
  // (1) Без лигатур в коде: шрифт склеивает != в ≠, -> в стрелку — новичок перепечатает значок и получит ошибку.
  "#" + WIN_ID + " pre,#" + WIN_ID + " code,#" + WIN_ID + " textarea,#" + WIN_ID + " kbd,#" + WIN_ID + " .cd-hed-n{font-variant-ligatures:none;font-feature-settings:'liga' 0,'calt' 0;}" +
  // (2) Крупное название темы
  // обложка темы
  "#" + WIN_ID + " .cd-article .cd-cover{position:relative;overflow:hidden;margin:0 0 18px;padding:16px 20px 14px;border-radius:var(--cd-r-2xl);" +
    "background:linear-gradient(115deg,color-mix(in srgb,var(--gcolor) 26%,transparent),color-mix(in srgb,var(--gcolor) 7%,transparent) 62%,transparent)," +
    "radial-gradient(circle at 92% 20%,color-mix(in srgb,var(--gcolor) 22%,transparent),transparent 45%);" +
    "box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--gcolor) 30%,transparent);}" +
  "#" + WIN_ID + " .cd-article .cd-cover.has-art{background:linear-gradient(90deg,color-mix(in srgb,var(--gcolor) 20%,var(--cd-cover-bg,rgba(20,20,30,.72))) 38%,transparent 78%),var(--cover-img) center/cover no-repeat;}" +
  "#" + WIN_ID + " .cd-article .cd-cover .cd-kicker{margin:0 0 6px;}" +
  "#" + WIN_ID + " .cd-article .cd-cover h1.cd-atitle{margin:0;max-width:calc(100% - 96px);position:relative;}" +
  "#" + WIN_ID + " .cd-article .cd-cover-badge{position:absolute;right:14px;top:50%;width:84px;height:84px;object-fit:contain;transform:translateY(-50%) rotate(-7deg);opacity:.95;filter:drop-shadow(0 6px 14px rgba(0,0,0,.25));pointer-events:none;}" +
  "#" + WIN_ID + ".light .cd-article .cd-cover.has-art{--cd-cover-bg:rgba(255,255,255,.78);}" +
  "#" + WIN_ID + " .cd-article h1.cd-atitle{margin:4px 0 10px;padding:0;border:none;font-size:28px;font-weight:800;line-height:1.2;letter-spacing:-.015em;color:var(--fg);text-wrap:balance;}" +
  "#" + WIN_ID + " .cd-article .cd-kicker{margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-article h1.cd-atitle+blockquote.cd-lead{margin-top:0;font-size:13.5px;}" +
  // (6) Заголовок раздела: текст по линии абзацев, черта вплотную слева, стрелка сворачивания — левее, при наведении
  "#" + WIN_ID + " .cd-article h2::before{left:-13px;top:.3em;height:.95em;}" +
  "#" + WIN_ID + " .cd-article h2.cd-foldable .cd-fold-caret{position:absolute;left:-32px;top:.42em;margin:0;font-size:12px;opacity:0;transform:none;transition:opacity var(--cd-t-fast),transform var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-article h2.cd-foldable:hover .cd-fold-caret{opacity:1;}" +
  "#" + WIN_ID + " .cd-article h2.cd-sec-folded .cd-fold-caret{opacity:.8;transform:rotate(-90deg);}" +
  "#" + WIN_ID + ".narrow .cd-article h2.cd-foldable .cd-fold-caret{position:static;opacity:.6;margin-right:.45em;}" +
  // (7) «За 30 секунд» — карточка-выжимка в цвете раздела
  "#" + WIN_ID + " .cd-article .cd-tldr{margin:16px 0 24px;padding:14px 18px 8px;border:1px solid color-mix(in srgb,var(--hcol,var(--ac)) 34%,var(--bd));border-radius:var(--cd-r-2xl);" +
  "background:linear-gradient(135deg,color-mix(in srgb,var(--hcol,var(--ac)) 10%,var(--panel)),color-mix(in srgb,var(--hcol,var(--ac)) 3%,var(--panel)));box-shadow:var(--sh1);}" +
  "#" + WIN_ID + " .cd-article .cd-tldr>h3:first-child{display:flex;align-items:center;gap:7px;margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:color-mix(in srgb,var(--hcol,var(--ac)) 80%,var(--fg));}" +
  "#" + WIN_ID + " .cd-article .cd-tldr>h3:first-child::before{content:'⚡';font-size:14px;letter-spacing:0;}" +
  "#" + WIN_ID + " .cd-article .cd-tldr ul{margin:4px 0 8px;}" +
  "#" + WIN_ID + " .cd-article .cd-tldr .codewrap{margin:10px 0 8px;}" +
  // (9) Инлайн-код не раздувает строку: высота строки 1, отступы поменьше, рамка тише
  "#" + WIN_ID + " .cd-article p code,#" + WIN_ID + " .cd-article li code,#" + WIN_ID + " .cd-article td code,#" + WIN_ID + " .cd-article blockquote code,#" + WIN_ID + " .cd-article h2 code,#" + WIN_ID + " .cd-article h3 code{" +
  "padding:.12em .38em;border-radius:var(--cd-r-xs);line-height:1;font-size:.9em;border-color:color-mix(in srgb,var(--fg) 9%,transparent);-webkit-box-decoration-break:clone;box-decoration-break:clone;}" +
  // (10) Значки инструментов в шапке (⚙ ⌕ ⧉ и т. п.) — крупнее и контрастнее
  "#" + WIN_ID + " .cd-hrt .cd-rbtn .cd-ic{font-size:15px;line-height:1;}" +
  "#" + WIN_ID + " .cd-hrt .cd-rgrp .cd-rbtn{color:color-mix(in srgb,var(--fg) 82%,transparent);padding:0 11px;}" +
  "#" + WIN_ID + " .cd-hrt .cd-rgrp .cd-rbtn:hover{color:var(--ac);}" +

  // ===== Карточки: колода (2026-09-25) =====
  "#" + WIN_ID + " .cd-article .cd-deck{margin:18px 0;padding:14px 16px 16px;border:1px solid var(--bd);border-radius:var(--cd-r-2xl);" +
  "background:linear-gradient(180deg,color-mix(in srgb,var(--hcol,var(--ac)) 7%,var(--panel)),var(--panel));}" +
  "#" + WIN_ID + " .cd-dk-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-dk-t{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-dk-ic{font-size:17px;}" +
  "#" + WIN_ID + " .cd-dk-cnt{padding:1px 8px;border-radius:var(--cd-r-pill);background:var(--hl);color:var(--ac);font-size:11px;font-weight:800;}" +
  "#" + WIN_ID + " .cd-dk-meta{display:flex;gap:6px;flex:1 1 auto;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-dk-meta span{padding:2px 9px;border-radius:var(--cd-r-pill);font-size:11px;font-weight:700;}" +
  "#" + WIN_ID + " .cd-dk-meta .due{background:color-mix(in srgb,var(--tn) 20%,transparent);color:var(--tn);}" +
  "#" + WIN_ID + " .cd-dk-meta .neu{background:var(--hl);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-deck button{font:inherit;cursor:pointer;}" +
  "#" + WIN_ID + " .cd-dk-shuffle,#" + WIN_ID + " .cd-dk-prev,#" + WIN_ID + " .cd-dk-next,#" + WIN_ID + " .cd-dc-hintbtn,#" + WIN_ID + " .cd-dc-unflip,#" + WIN_ID + " .cd-dk-restart{" +
  "padding:6px 13px;border:1px solid var(--bd);border-radius:var(--cd-r-pill);background:var(--bg);color:var(--muted);font-size:12px;font-weight:600;transition:border-color var(--cd-t-fast),color var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-dk-shuffle:hover,#" + WIN_ID + " .cd-dk-prev:hover:not(:disabled),#" + WIN_ID + " .cd-dk-next:hover:not(:disabled),#" + WIN_ID + " .cd-dc-hintbtn:hover,#" + WIN_ID + " .cd-dc-unflip:hover,#" + WIN_ID + " .cd-dk-restart:hover{border-color:var(--ac);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-deck button:disabled{opacity:.35;cursor:default;}" +
  "#" + WIN_ID + " .cd-dc-unflip{padding:3px 10px;font-size:11px;}" +
  // точки-прогресс: серые — не тронуты, обводка — пора повторить, цвет — оценка
  "#" + WIN_ID + " .cd-dk-dots{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 12px;padding:0 2px;}" +
  "#" + WIN_ID + " .cd-dk-dot{width:10px;height:10px;padding:0;border:none;border-radius:50%;background:color-mix(in srgb,var(--fg) 16%,transparent);transition:transform var(--cd-t-fast),background .2s;}" +
  "#" + WIN_ID + " .cd-dk-dot.st-due{background:transparent;box-shadow:inset 0 0 0 2px var(--tn);}" +
  "#" + WIN_ID + " .cd-dk-dot.g0{background:var(--tp);box-shadow:none;}" +
  "#" + WIN_ID + " .cd-dk-dot.g1{background:var(--ty);box-shadow:none;}" +
  "#" + WIN_ID + " .cd-dk-dot.g2{background:var(--ts);box-shadow:none;}" +
  "#" + WIN_ID + " .cd-dk-dot.cur{transform:scale(1.35);outline:2px solid var(--ac);outline-offset:2px;}" +
  "#" + WIN_ID + " .cd-dk-dot.skip{opacity:.22;}" +
  // карточка: две стороны в одной ячейке сетки (высота — по большей), переворот по Y
  "#" + WIN_ID + " .cd-dcard{display:none;perspective:1400px;}" +
  "#" + WIN_ID + " .cd-dcard.cur{display:block;animation:cd-dk-in .28s ease-out;}" +
  "@keyframes cd-dk-in{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:none;}}" +
  "#" + WIN_ID + " .cd-dc-in{display:grid;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.3,.9,.3,1);}" +
  "#" + WIN_ID + " .cd-dcard.flipped .cd-dc-in{transform:rotateY(180deg);}" +
  "#" + WIN_ID + " .cd-dc-face{grid-area:1/1;display:flex;flex-direction:column;gap:12px;min-height:200px;padding:16px 20px 18px;border:1px solid var(--bd);border-radius:var(--cd-r-2xl);" +
  "-webkit-backface-visibility:hidden;backface-visibility:hidden;}" +
  "#" + WIN_ID + " .cd-dc-front{cursor:pointer;box-shadow:var(--sh1);" +
  "background:radial-gradient(120% 90% at 100% 0%,rgba(var(--ac-rgb),.17),transparent 60%),radial-gradient(90% 80% at 0% 100%,color-mix(in srgb,var(--hcol,var(--ac)) 12%,transparent),transparent 60%),color-mix(in srgb,var(--fg) 3%,var(--bg));}" +
  "#" + WIN_ID + " .cd-dc-front:hover{border-color:color-mix(in srgb,var(--ac) 45%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dc-back{transform:rotateY(180deg);background:linear-gradient(180deg,color-mix(in srgb,var(--ts) 10%,var(--bg)),var(--bg) 70%);border-color:color-mix(in srgb,var(--ts) 35%,var(--bd));}" +
  "#" + WIN_ID + " .cd-dc-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}" +
  "#" + WIN_ID + " .cd-dc-num{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-dc-due{padding:2px 9px;border-radius:var(--cd-r-pill);font-size:10.5px;font-weight:700;}" +
  "#" + WIN_ID + " .cd-dc-due.due{background:var(--tn);color:var(--panel);}" +
  "#" + WIN_ID + " .cd-dc-due.neu{background:var(--hl);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-dc-due.lat{border:1px solid var(--bd);color:var(--faint);}" +
  "#" + WIN_ID + " .cd-dc-q{flex:1 1 auto;display:flex;align-items:center;justify-content:center;padding:6px 12px;text-align:center;text-wrap:balance;font-size:17.5px;font-weight:700;line-height:1.45;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-dc-hint{align-self:center;max-width:92%;padding:8px 13px;border-radius:var(--cd-r-lg);background:color-mix(in srgb,var(--ty) 13%,transparent);color:var(--fg);font-size:13px;text-align:center;}" +
  "#" + WIN_ID + " .cd-dc-ctl{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-dc-flip{padding:8px 18px;border:none;border-radius:var(--cd-r-pill);background:var(--ac);color:var(--panel);font-size:12.5px;font-weight:800;box-shadow:0 3px 12px rgba(var(--ac-rgb),.3);transition:filter var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-dc-flip:hover{filter:brightness(1.08);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-dc-qs{font-size:12.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-dc-a{flex:1 1 auto;font-size:14.5px;line-height:1.6;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-dc-rlbl{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-dc-rate{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}" +
  "#" + WIN_ID + " .cd-dk-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 6px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--panel);color:var(--fg);transition:border-color var(--cd-t-fast),background var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-dk-btn b{font-size:13px;}" +
  "#" + WIN_ID + " .cd-dk-btn small{font-size:10.5px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-dk-btn:hover{transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-dk-btn.g0:hover{border-color:var(--tp);background:color-mix(in srgb,var(--tp) 13%,var(--panel));}" +
  "#" + WIN_ID + " .cd-dk-btn.g1:hover{border-color:var(--ty);background:color-mix(in srgb,var(--ty) 13%,var(--panel));}" +
  "#" + WIN_ID + " .cd-dk-btn.g2:hover{border-color:var(--ts);background:color-mix(in srgb,var(--ts) 13%,var(--panel));}" +
  "#" + WIN_ID + " .cd-dk-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;}" +
  "#" + WIN_ID + " .cd-dk-pos{font-size:12px;color:var(--faint);font-variant-numeric:tabular-nums;}" +
  // итог колоды
  "#" + WIN_ID + " .cd-dk-sum{padding:16px 10px 6px;text-align:center;animation:cd-dk-in .28s ease-out;}" +
  "#" + WIN_ID + " .cd-dk-sum-t{margin:0 0 12px;font-size:18px;font-weight:800;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-dk-sum-row{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:0 0 10px;}" +
  "#" + WIN_ID + " .cd-dk-sum-row span{display:flex;flex-direction:column;min-width:88px;padding:10px 12px;border:1px solid var(--bd);border-radius:var(--cd-r-xl);background:var(--bg);font-size:11.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-dk-sum-row b{font-size:22px;font-weight:800;}" +
  "#" + WIN_ID + " .cd-dk-sum-row .g2 b{color:var(--ts);}" +
  "#" + WIN_ID + " .cd-dk-sum-row .g1 b{color:var(--ty);}" +
  "#" + WIN_ID + " .cd-dk-sum-row .g0 b{color:var(--tp);}" +
  "#" + WIN_ID + " .cd-dk-sum-s{margin:0 0 12px;font-size:12px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-dk-sum-ctl{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-dk-again{padding:7px 16px;border:none;border-radius:var(--cd-r-pill);background:var(--ac);color:var(--panel);font-size:12.5px;font-weight:800;}" +
  "#" + WIN_ID + ".no-anim .cd-dc-in{transition:none;}" +
  "#" + WIN_ID + ".no-anim .cd-dcard.cur,#" + WIN_ID + ".no-anim .cd-dk-sum{animation:none;}" +
  "#" + WIN_ID + ".narrow .cd-dc-rate{grid-template-columns:1fr;}" +
  // Палитры: сетка образцов в настройках
  "#" + WIN_ID + " .cd-pal-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;width:100%;}" +
  "#" + WIN_ID + " .cd-pal{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--bd);border-radius:var(--cd-r-lg);background:var(--panel);color:var(--fg);font:inherit;font-size:12px;font-weight:600;cursor:pointer;text-align:left;}" +
  "#" + WIN_ID + " .cd-pal:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-pal.on{border-color:var(--ac);background:var(--hl);box-shadow:inset 0 0 0 1px var(--ac);}" +
  "#" + WIN_ID + " .cd-pal-sw{flex:0 0 auto;width:22px;height:22px;border-radius:var(--cd-r-md);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);}" +
  "#" + WIN_ID + " .cd-pal-note{margin:6px 0 0;font-size:11px;color:var(--faint);}" +
  // ===== Графика, заход 3 (2026-09-25) =====
  // #1 наклейки-значки на месте эмодзи
  "#" + WIN_ID + " .cd-emo{display:inline-block;width:1.3em;height:1.3em;vertical-align:-.28em;object-fit:contain;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.25));}" +
  "#" + WIN_ID + " .cd-dt-ic .cd-emo{width:20px;height:20px;vertical-align:0;}" +
  "#" + WIN_ID + " .cd-hw-ic .cd-emo{width:34px;height:34px;vertical-align:0;}" +
  "#" + WIN_ID + " .cd-dk-ic .cd-emo{width:22px;height:22px;}" +
  // #4 главная в две колонки
  "#" + WIN_ID + " .cd-home.wide2 .cd-home-inner{max-width:1280px;}" +
  "#" + WIN_ID + " .cd-home-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,380px);gap:0 20px;align-items:start;}" +
  "#" + WIN_ID + " .cd-home-main,#" + WIN_ID + " .cd-home-side{min-width:0;}" +
  "#" + WIN_ID + " .cd-home-side .cd-qabar{display:grid;grid-template-columns:1fr 1fr;}" +
  "#" + WIN_ID + " .cd-home-side .cd-qa{text-align:left;}" +
  "#" + WIN_ID + " .cd-home-side .cd-home-warm{flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-home.wide2 .cd-home-grid{grid-template-columns:repeat(3,minmax(0,1fr));}" +
  // #5 «Продолжить» в списке слева — спокойная, не спорит с главной карточкой
  "#" + WIN_ID + " .cd-continue{background:transparent;color:var(--muted);box-shadow:inset 0 0 0 1px var(--bd);}" +
  "#" + WIN_ID + " .cd-continue:hover{background:var(--hl);color:var(--fg);box-shadow:inset 0 0 0 1px var(--ac);}" +
  // #6 «План на сегодня» — отдельная карточка-лента с шагами
  "#" + WIN_ID + " .cd-plan{display:block;margin:0 0 16px;padding:12px 16px 14px;border:1px solid var(--bd);border-radius:var(--cd-r-2xl);background:color-mix(in srgb,var(--fg) 2%,var(--panel));font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-plan-l{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-plan-c{padding:1px 8px;border-radius:var(--cd-r-pill);background:var(--hl);color:var(--ac);letter-spacing:0;text-transform:none;}" +
  "#" + WIN_ID + " .cd-plan-row{display:flex;align-items:center;gap:0;flex-wrap:wrap;row-gap:8px;}" +
  "#" + WIN_ID + " .cd-plan-step{display:inline-flex;align-items:center;gap:8px;min-width:0;padding:6px 12px 6px 6px;border:1px solid var(--bd);border-radius:var(--cd-r-pill);background:var(--bg);color:var(--fg);font:inherit;font-size:12.5px;cursor:pointer;text-align:left;transition:border-color var(--cd-t-fast),transform var(--cd-t-fast);}" +
  "#" + WIN_ID + " .cd-plan-step:hover{border-color:var(--ac);transform:translateY(-1px);}" +
  "#" + WIN_ID + " .cd-plan-n{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--hl);color:var(--ac);font-size:11px;font-weight:800;}" +
  "#" + WIN_ID + " .cd-plan-t{min-width:0;font-weight:600;}" +
  "#" + WIN_ID + " .cd-plan-sub{font-weight:400;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-plan-step i{font-style:normal;color:var(--faint);font-size:11.5px;white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-plan-step.done{border-color:color-mix(in srgb,var(--ts) 40%,var(--bd));background:color-mix(in srgb,var(--ts) 8%,var(--bg));}" +
  "#" + WIN_ID + " .cd-plan-step.done .cd-plan-n{background:var(--ts);color:var(--panel);}" +
  "#" + WIN_ID + " .cd-plan-step.done .cd-plan-t{text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--fg) 45%,transparent);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-plan-line{flex:0 0 18px;height:2px;margin:0 4px;border-radius:2px;background:var(--bd);}" +
  "#" + WIN_ID + " .cd-plan-arr{display:none;}" +
  // #8 наклон лицевой стороны карточки
  "#" + WIN_ID + " .cd-dc-front{transform:rotateX(var(--tx,0deg)) rotateY(var(--ty,0deg));transition:transform .18s ease-out,border-color var(--cd-t-fast);}" +
  "#" + WIN_ID + ".no-anim .cd-dc-front{transform:none;}" +
  // #10 точки колоды по центру, с воздухом; полоска прогресса под ними
  "#" + WIN_ID + " .cd-dk-dots{justify-content:center;gap:10px;margin:2px 0 8px;padding:4px 0;}" +
  "#" + WIN_ID + " .cd-dk-dot{width:9px;height:9px;}" +
  "#" + WIN_ID + " .cd-dk-dot.cur{transform:scale(1.25);outline:2px solid var(--ac);outline-offset:2px;}" +
  "#" + WIN_ID + " .cd-dk-prog{height:3px;margin:0 auto 12px;max-width:260px;border-radius:3px;background:var(--bd);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-dk-prog i{display:block;height:100%;width:0;border-radius:3px;background:linear-gradient(90deg,var(--ac),var(--ts));transition:width .35s ease;}" +
  // ===== Фон (2026-09-25): небо прогресса, сияние, зерно, тон раздела, стекло =====
  // Главная прозрачная — под ней слой .cd-homebg (цвет окна + сияние + звёзды).
  "#" + WIN_ID + " .cd-home{background:transparent;}" +
  "#" + WIN_ID + " .cd-homebg{position:absolute;inset:0;z-index:6;display:none;overflow:hidden;pointer-events:none;" +
  "background:radial-gradient(120% 68% at 50% -12%,rgba(var(--ac-rgb),.12),transparent 60%),var(--bg);}" +
  "#" + WIN_ID + ".home .cd-homebg{display:block;}" +
  // Главная прозрачная, а фон окна бывает полупрозрачным (custom-bg, «призрак») — статья, открытая до
  // главной, просвечивала снизу бледным текстом. Пока открыта главная/повторение — статью прячем
  // (visibility, а не display: позиция прокрутки и разметка сохраняются для возврата).
  "#" + WIN_ID + ".home .cd-rmain>.cd-content,#" + WIN_ID + ".home .cd-rmain>.cd-outline,#" + WIN_ID + ".home .cd-rmain>.cd-split," +
  "#" + WIN_ID + ".reviewing .cd-rmain>.cd-content,#" + WIN_ID + ".reviewing .cd-rmain>.cd-outline,#" + WIN_ID + ".reviewing .cd-rmain>.cd-split{visibility:hidden;}" +
  // #3 сияние: три мягких пятна медленно плывут (только transform — дёшево для GPU)
  "#" + WIN_ID + " .cd-aur{position:absolute;width:62%;height:72%;border-radius:50%;will-change:transform;animation:cd-aur1 48s ease-in-out infinite alternate;}" +
  "#" + WIN_ID + " .cd-aur.a1{left:-12%;top:-22%;background:radial-gradient(closest-side,rgba(var(--ac-rgb),.20),transparent);}" +
  "#" + WIN_ID + " .cd-aur.a2{right:-14%;bottom:-26%;background:radial-gradient(closest-side,color-mix(in srgb,var(--tk) 20%,transparent),transparent);animation-name:cd-aur2;animation-duration:62s;}" +
  "#" + WIN_ID + " .cd-aur.a3{left:28%;top:34%;width:46%;height:52%;background:radial-gradient(closest-side,color-mix(in srgb,var(--tf) 11%,transparent),transparent);animation-name:cd-aur3;animation-duration:77s;}" +
  "@keyframes cd-aur1{to{transform:translate(9%,7%) scale(1.15);}}" +
  "@keyframes cd-aur2{to{transform:translate(-11%,-6%) scale(1.12);}}" +
  "@keyframes cd-aur3{to{transform:translate(-14%,9%) scale(.88);}}" +
  // #1 звёзды
  "#" + WIN_ID + " .cd-sky{position:absolute;inset:0;width:100%;height:100%;}" +
  "#" + WIN_ID + " .cd-st{fill:var(--fg);opacity:.2;}" +
  "#" + WIN_ID + " .cd-st.dust{opacity:.1;}" +
  "#" + WIN_ID + " .cd-st.on{opacity:1;animation:cd-tw 4.5s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-st-glow{opacity:.16;}" +
  "#" + WIN_ID + " .cd-st-line{fill:none;stroke-width:1;stroke-linecap:round;opacity:.3;}" +
  "#" + WIN_ID + " .cd-st.next{fill:var(--ac);opacity:.95;}" +
  "#" + WIN_ID + " .cd-st-ring{fill:none;stroke:var(--ac);stroke-width:1.2;transform-box:fill-box;transform-origin:center;animation:cd-ring 2.6s ease-out infinite;}" +
  "@keyframes cd-tw{0%,100%{opacity:1;}50%{opacity:.5;}}" +
  "@keyframes cd-ring{0%{transform:scale(.5);opacity:.8;}100%{transform:scale(2.4);opacity:0;}}" +
  "#" + WIN_ID + ".no-anim .cd-aur,#" + WIN_ID + ".no-anim .cd-st,#" + WIN_ID + ".no-anim .cd-st-ring{animation:none;}" +
  // #4 зерно
  "#" + WIN_ID + " .cd-grain{position:absolute;inset:0;z-index:11;pointer-events:none;opacity:.045;background-image:url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxODAnIGhlaWdodD0nMTgwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nLjknIG51bU9jdGF2ZXM9JzMnIHN0aXRjaFRpbGVzPSdzdGl0Y2gnLz48ZmVDb2xvck1hdHJpeCB0eXBlPSdzYXR1cmF0ZScgdmFsdWVzPScwJy8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9JzEwMCUnIGhlaWdodD0nMTAwJScgZmlsdGVyPSd1cmwoI24pJy8+PC9zdmc+);background-size:180px 180px;}" +
  "#" + WIN_ID + ".light .cd-grain,#" + WIN_ID + ".sepia .cd-grain{opacity:.06;}" +
  // #6 тон раздела над статьёй: мягкий отсвет цвета раздела сверху, уезжает вместе с текстом
  "#" + WIN_ID + " .cd-content{background:radial-gradient(60% 300px at 0% 0%,color-mix(in srgb,var(--hcol,transparent) 14%,transparent),transparent 72%)," +
  "linear-gradient(180deg,color-mix(in srgb,var(--hcol,transparent) 7%,transparent),transparent 380px);background-repeat:no-repeat;background-attachment:local;}" +
  // #7 стеклянные карточки главной: полупрозрачные, с размытием того, что под ними
  "#" + WIN_ID + " .cd-home{--glass:color-mix(in srgb,var(--panel) 60%,transparent);}" +
  "#" + WIN_ID + " .cd-home .cd-home-hero,#" + WIN_ID + " .cd-home .cd-home-cont,#" + WIN_ID + " .cd-home .cd-home-spot,#" + WIN_ID + " .cd-home .cd-plan," +
  "#" + WIN_ID + " .cd-home .cd-track,#" + WIN_ID + " .cd-home .cd-home-warm,#" + WIN_ID + " .cd-home .cd-whatsnew,#" + WIN_ID + " .cd-home .cd-home-card," +
  "#" + WIN_ID + " .cd-home .cd-hs-in,#" + WIN_ID + " .cd-home .cd-qa,#" + WIN_ID + " .cd-home .cd-home-chip,#" + WIN_ID + " .cd-home .cd-home-done{" +
  "-webkit-backdrop-filter:blur(12px) saturate(1.25);backdrop-filter:blur(12px) saturate(1.25);}" +
  "#" + WIN_ID + " .cd-home .cd-home-hero{background:linear-gradient(135deg,color-mix(in srgb,var(--ac) 15%,var(--glass)),var(--glass));box-shadow:inset 0 1px 0 rgba(255,255,255,.07),var(--sh1);}" +
  "#" + WIN_ID + " .cd-home .cd-plan,#" + WIN_ID + " .cd-home .cd-track,#" + WIN_ID + " .cd-home .cd-home-card,#" + WIN_ID + " .cd-home .cd-hs-in," +
  "#" + WIN_ID + " .cd-home .cd-qa,#" + WIN_ID + " .cd-home .cd-home-chip{background:var(--glass);}" +
  "#" + WIN_ID + " .cd-home .cd-home-spot{background:linear-gradient(90deg,color-mix(in srgb,var(--ac2) 10%,var(--glass)),var(--glass));}" +
  "#" + WIN_ID + " .cd-home .cd-plan,#" + WIN_ID + " .cd-home .cd-track,#" + WIN_ID + " .cd-home .cd-home-card,#" + WIN_ID + " .cd-home .cd-home-cont," +
  "#" + WIN_ID + " .cd-home .cd-home-warm,#" + WIN_ID + " .cd-home .cd-whatsnew{box-shadow:inset 0 1px 0 rgba(255,255,255,.06);}" +
  "#" + WIN_ID + " .cd-home .cd-dtile{background-color:color-mix(in srgb,var(--panel) 50%,transparent);}" +
  "#" + WIN_ID + ".light .cd-home,#" + WIN_ID + ".sepia .cd-home{--glass:color-mix(in srgb,var(--panel) 72%,transparent);}" +
  // ===== Статичный фон и крупные значки (2026-09-25) =====
  // Пейзаж: картинка под палитрой, приглушена вуалью цвета окна — текст и карточки читаются.
  "#" + WIN_ID + " .cd-homebg-img{position:absolute;inset:-6px;background-position:center 70%;background-size:cover;background-repeat:no-repeat;opacity:.62;filter:saturate(.92);}" +
  "#" + WIN_ID + " .cd-homebg-veil{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,var(--bg) 55%,transparent) 0%,color-mix(in srgb,var(--bg) 25%,transparent) 45%,color-mix(in srgb,var(--bg) 60%,transparent) 100%);}" +
  "#" + WIN_ID + ".light .cd-homebg-img,#" + WIN_ID + ".sepia .cd-homebg-img{opacity:.38;}" +
  // Фон неподвижный: сияние, мерцание звёзд и пульс следующей темы — без анимации
  "#" + WIN_ID + " .cd-aur,#" + WIN_ID + " .cd-st.on,#" + WIN_ID + " .cd-st-ring{animation:none!important;}" +
  "#" + WIN_ID + " .cd-st-ring{transform:scale(1.5);opacity:.55;}" +
  // Значки-наклейки крупнее: на плитках, в кнопках, в разминке и колоде их должно быть видно
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-ic{width:36px;height:36px;font-size:20px;border-radius:var(--cd-r-lg);background:none!important;}" +
  "#" + WIN_ID + " .cd-dt-ic .cd-emo{width:34px;height:34px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-v{margin-top:4px;}" +
  "#" + WIN_ID + " .cd-qa .cd-emo{width:24px;height:24px;vertical-align:-7px;margin-right:4px;}" +
  "#" + WIN_ID + " .cd-home-status .cd-emo{width:20px;height:20px;vertical-align:-5px;}" +
  "#" + WIN_ID + " .cd-hw-ic .cd-emo{width:48px;height:48px;}" +
  "#" + WIN_ID + " .cd-hrev-ic .cd-emo{width:20px;height:20px;vertical-align:-5px;}" +
  "#" + WIN_ID + " .cd-dk-ic .cd-emo{width:30px;height:30px;vertical-align:-8px;}" +
  "#" + WIN_ID + " .cd-dc-hintbtn .cd-emo,#" + WIN_ID + " .cd-dk-shuffle .cd-emo,#" + WIN_ID + " .cd-dc-hint .cd-emo{width:20px;height:20px;vertical-align:-5px;}" +
  "#" + WIN_ID + " .cd-wn-h .cd-emo{width:22px;height:22px;vertical-align:-6px;}" +
  // ===== Герой плотнее (2026-09-25): плитки «значок слева», в широком окне — в один ряд; неделя под приветствием =====
  "#" + WIN_ID + " .cd-hero-stats .cd-dtile{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:'ic v' 'ic l' 'bar bar';column-gap:10px;row-gap:0;align-items:center;padding:10px 12px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-ic{grid-area:ic;align-self:center;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-v{grid-area:v;margin:0;align-self:end;font-size:16px;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-l{grid-area:l;align-self:start;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
  "#" + WIN_ID + " .cd-hero-stats .cd-dt-bar{grid-area:bar;margin-top:8px;}" +
  // плитки сами встают в ряд, когда им хватает места (и в широком окне, и когда герой перенёсся на две строки)
  "#" + WIN_ID + " .cd-hero-stats,#" + WIN_ID + " .cd-hero-stats.cd-hs4{grid-template-columns:repeat(auto-fit,minmax(118px,1fr));}" +
  "#" + WIN_ID + " .cd-home.wide2 .cd-hero-lead{flex:1 1 380px;}" +
  "#" + WIN_ID + " .cd-home.wide2 .cd-hero-stats,#" + WIN_ID + " .cd-home.wide2 .cd-hero-stats.cd-hs4{flex:2 1 600px;grid-template-columns:repeat(4,minmax(0,1fr));}" +
  "#" + WIN_ID + " .cd-home-week{display:flex;align-items:flex-end;gap:6px;margin-top:10px;}" +
  "#" + WIN_ID + " .cd-wk-d{display:flex;flex-direction:column;align-items:center;gap:3px;}" +
  "#" + WIN_ID + " .cd-wk-d i{display:block;width:18px;height:18px;border-radius:var(--cd-r-sm);background:color-mix(in srgb,var(--fg) 9%,transparent);box-shadow:inset 0 0 0 1px var(--bd);}" +
  "#" + WIN_ID + " .cd-wk-d.on i{background:linear-gradient(135deg,var(--ac),color-mix(in srgb,var(--ac) 55%,var(--tn)));box-shadow:0 0 10px rgba(var(--ac-rgb),.35);}" +
  "#" + WIN_ID + " .cd-wk-d.today i{outline:2px solid color-mix(in srgb,var(--ac) 70%,transparent);outline-offset:2px;}" +
  "#" + WIN_ID + " .cd-wk-d b{font-size:9.5px;font-weight:600;color:var(--faint);text-transform:uppercase;letter-spacing:.03em;}" +
  "#" + WIN_ID + " .cd-wk-d.today b{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-wk-n{margin-left:6px;margin-bottom:17px;font-size:11px;color:var(--muted);white-space:nowrap;}" +
  // тепловая карта 12 недель
  "#" + WIN_ID + " .cd-heat{display:block;margin-top:10px;}" +
  "#" + WIN_ID + " .cd-hm-heads,#" + WIN_ID + " .cd-hm-grid{display:flex;gap:3px;}" +
  "#" + WIN_ID + " .cd-hm-m{width:11px;font-size:9px;line-height:12px;color:var(--faint);white-space:nowrap;overflow:visible;}" +
  "#" + WIN_ID + " .cd-hm-w{display:flex;flex-direction:column;gap:3px;}" +
  "#" + WIN_ID + " .cd-hm-c{display:inline-block;width:11px;height:11px;border-radius:3px;background:color-mix(in srgb,var(--fg) 8%,transparent);box-shadow:inset 0 0 0 1px var(--bd);}" +
  "#" + WIN_ID + " .cd-hm-c.l1{background:color-mix(in srgb,var(--ac) 30%,transparent);}" +
  "#" + WIN_ID + " .cd-hm-c.l2{background:color-mix(in srgb,var(--ac) 55%,transparent);}" +
  "#" + WIN_ID + " .cd-hm-c.l3{background:color-mix(in srgb,var(--ac) 80%,transparent);}" +
  "#" + WIN_ID + " .cd-hm-c.l4{background:var(--ac);box-shadow:0 0 6px rgba(var(--ac-rgb),.45);}" +
  "#" + WIN_ID + " .cd-hm-c.fut{opacity:.25;}" +
  "#" + WIN_ID + " .cd-hm-c.today{outline:1.5px solid color-mix(in srgb,var(--ac) 80%,transparent);outline-offset:1px;}" +
  "#" + WIN_ID + " .cd-hm-foot{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:6px;}" +
  "#" + WIN_ID + " .cd-hm-foot .cd-wk-n{margin:0;}" +
  "#" + WIN_ID + " .cd-hm-leg{display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-hm-leg .cd-hm-c{width:9px;height:9px;}" +
  // ---- Настройки: окно с вкладками, карточки палитр с пейзажами и шрифтов ----
  "#" + WIN_ID + " .cd-viewmenu.cd-set{position:absolute;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,8,14,.46);backdrop-filter:blur(6px);animation:cd-set-fade .16s ease-out;}" +
  "#" + WIN_ID + " .cd-viewmenu.cd-set[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-set-card{position:relative;display:flex;flex-direction:column;width:min(780px,100%);max-height:min(88%,720px);background:color-mix(in srgb,var(--bg) 94%,transparent);border:1px solid var(--bd);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.45),0 0 0 1px rgba(var(--ac-rgb),.10);overflow:hidden;animation:cd-set-pop .2s cubic-bezier(.2,.9,.3,1.2);cursor:auto;user-select:text;font-weight:400;}" +
  "#" + WIN_ID + " .cd-set-card::before{content:\"\";position:absolute;inset:0 0 auto 0;height:120px;background:radial-gradient(120% 100% at 0% 0%,rgba(var(--ac-rgb),.22),transparent 70%);pointer-events:none;}" +
  "#" + WIN_ID + " .cd-set-head{position:relative;display:flex;align-items:center;gap:12px;padding:16px 18px 14px;border-bottom:1px solid var(--bd2);}" +
  "#" + WIN_ID + " .cd-set-ic{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:12px;background:rgba(var(--ac-rgb),.16);font-size:20px;flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-set-ic img,#" + WIN_ID + " .cd-set-ic .cd-uiic{width:26px;height:26px;}" +
  "#" + WIN_ID + " .cd-set-ht{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto;}" +
  "#" + WIN_ID + " .cd-set-ht b{font-size:16px;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-set-ht span{font-size:11.5px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-set-x{flex:0 0 auto;width:32px;height:32px;border-radius:10px;border:1px solid var(--bd);background:var(--panel);color:var(--muted);cursor:pointer;font:inherit;font-size:14px;}" +
  "#" + WIN_ID + " .cd-set-x:hover{color:var(--fg);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-set-body{display:grid;grid-template-columns:170px 1fr;min-height:0;flex:1 1 auto;}" +
  "#" + WIN_ID + " .cd-set-tabs{display:flex;flex-direction:column;gap:3px;padding:12px 10px;border-right:1px solid var(--bd2);background:color-mix(in srgb,var(--fg) 2.5%,transparent);overflow-y:auto;}" +
  "#" + WIN_ID + " .cd-set-tab{display:flex;align-items:center;gap:10px;padding:9px 11px;border:0;border-radius:11px;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer;text-align:left;transition:background .12s,color .12s,transform .12s;}" +
  "#" + WIN_ID + " .cd-set-tab:hover{background:var(--hl);color:var(--fg);}" +
  "#" + WIN_ID + " .cd-set-tab.on{background:rgba(var(--ac-rgb),.18);color:var(--fg);box-shadow:inset 3px 0 0 var(--ac);}" +
  "#" + WIN_ID + " .cd-set-tic{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:color-mix(in srgb,var(--fg) 6%,transparent);font-size:14px;flex:0 0 auto;}" +
  "#" + WIN_ID + " .cd-set-tab.on .cd-set-tic{background:rgba(var(--ac-rgb),.28);}" +
  "#" + WIN_ID + " .cd-set-pages{overflow-y:auto;padding:16px 20px 22px;min-width:0;}" +
  "#" + WIN_ID + " .cd-set-page{display:flex;flex-direction:column;gap:6px;animation:cd-set-fade .18s ease-out;}" +
  "#" + WIN_ID + " .cd-set-page[hidden]{display:none;}" +
  "#" + WIN_ID + " .cd-set-ph{display:flex;flex-direction:column;gap:2px;margin:0 0 8px;}" +
  "#" + WIN_ID + " .cd-set-ph b{font-size:15px;color:var(--fg);}" +
  "#" + WIN_ID + " .cd-set-ph span{font-size:12px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-set .cd-vm-row{padding:9px 10px;border-radius:12px;background:color-mix(in srgb,var(--fg) 3%,transparent);font-size:12.5px;}" +
  "#" + WIN_ID + " .cd-set .cd-vm-row:hover{background:color-mix(in srgb,var(--fg) 5%,transparent);}" +
  "#" + WIN_ID + " .cd-set .cd-vm-row.stack:not(.cards){flex-direction:row;align-items:center;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-set .cd-vm-row.stack:not(.cards) .cd-seg{width:auto;flex:0 1 auto;margin-left:auto;}" +
  "#" + WIN_ID + " .cd-set .cd-seg button{padding:6px 12px;}" +
  "#" + WIN_ID + " .cd-set .cd-pal-note{flex-basis:100%;}" +
  "#" + WIN_ID + " .cd-th-btn{display:inline-flex !important;flex-direction:column;align-items:center;gap:5px;padding:8px 10px !important;}" +
  "#" + WIN_ID + " .cd-th-mini{display:flex;flex-direction:column;gap:3px;width:46px;height:30px;padding:5px;border-radius:7px;box-sizing:border-box;box-shadow:inset 0 0 0 1px rgba(128,128,128,.35);}" +
  "#" + WIN_ID + " .cd-th-mini i{display:block;height:3px;border-radius:2px;background:currentColor;opacity:.55;}" +
  "#" + WIN_ID + " .cd-th-mini i:first-child{width:60%;opacity:.9;}" +
  "#" + WIN_ID + " .cd-th-mini i:last-child{width:80%;}" +
  "#" + WIN_ID + " .cd-th-mini.th-dark{background:#1e1e2e;color:#cdd6f4;}" +
  "#" + WIN_ID + " .cd-th-mini.th-light{background:#f5f5f7;color:#4c4f69;}" +
  "#" + WIN_ID + " .cd-th-mini.th-sepia{background:#f1e7d0;color:#5b4636;}" +
  "#" + WIN_ID + " .cd-th-mini.th-auto{background:linear-gradient(135deg,#f5f5f7 50%,#1e1e2e 50%);color:#888;}" +
  "#" + WIN_ID + " .cd-pal-grid{grid-template-columns:repeat(auto-fill,minmax(128px,1fr)) !important;gap:9px !important;}" +
  "#" + WIN_ID + " .cd-pal{flex-direction:column;align-items:stretch !important;gap:0 !important;padding:0 !important;overflow:hidden;border-radius:13px !important;transition:transform .14s,box-shadow .14s,border-color .14s;}" +
  "#" + WIN_ID + " .cd-pal:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.28);}" +
  "#" + WIN_ID + " .cd-pal.on{box-shadow:0 0 0 2px var(--ac),0 8px 20px rgba(0,0,0,.3) !important;}" +
  "#" + WIN_ID + " .cd-pal-th{position:relative;display:block;height:62px;background-size:cover;background-position:center;}" +
  "#" + WIN_ID + " .cd-pal-th::after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(0,0,0,.45));}" +
  "#" + WIN_ID + " .cd-pal-dots{position:absolute;left:7px;bottom:6px;z-index:1;display:flex;gap:4px;}" +
  "#" + WIN_ID + " .cd-pal-dots i{width:10px;height:10px;border-radius:50%;box-shadow:0 0 0 1.5px rgba(255,255,255,.7);}" +
  "#" + WIN_ID + " .cd-pal-nm{padding:7px 9px 8px;font-size:12px;font-weight:600;}" +
  "#" + WIN_ID + " .cd-pal.on .cd-pal-nm::after{content:\" ✓\";color:var(--ac);}" +
  "#" + WIN_ID + " .cd-font-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px;}" +
  "#" + WIN_ID + " .cd-font{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 6px 9px;border:1px solid var(--bd);border-radius:13px;background:var(--panel);color:var(--fg);cursor:pointer;font:inherit;transition:transform .14s,border-color .14s,box-shadow .14s;}" +
  "#" + WIN_ID + " .cd-font:hover{transform:translateY(-2px);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-font.on{border-color:var(--ac);background:rgba(var(--ac-rgb),.12);box-shadow:0 0 0 1px var(--ac);}" +
  "#" + WIN_ID + " .cd-font-aa{font-size:26px;line-height:1.1;font-weight:600;}" +
  "#" + WIN_ID + " .cd-font-nm{font-size:11.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-font-tag{position:absolute;top:5px;right:6px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ac);opacity:.85;}" +
  "#" + WIN_ID + " .cd-set-sample{margin:0 0 6px;padding:14px 16px;border-radius:14px;border:1px dashed rgba(var(--ac-rgb),.45);background:color-mix(in srgb,var(--panel) 80%,transparent);color:var(--fg);font-size:14px;line-height:1.6;}" +
  "#" + WIN_ID + " .cd-set-sample.cd-lh-tight{line-height:1.4;}" +
  "#" + WIN_ID + " .cd-set-sample.cd-lh-roomy{line-height:1.85;}" +
  "#" + WIN_ID + " .cd-set-sample .cd-ss-h{font-size:16px;font-weight:700;margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-set-sample p{margin:0 0 8px;}" +
  "#" + WIN_ID + " .cd-set-sample code{font-family:'Cascadia Code',Consolas,monospace;font-size:.9em;padding:1px 5px;border-radius:5px;background:var(--code);}" +
  "#" + WIN_ID + " .cd-set-sample pre{margin:0;padding:9px 12px;border-radius:10px;background:var(--code);white-space:pre;overflow:auto;line-height:1.5;}" +
  "#" + WIN_ID + " .cd-set-sample pre code{padding:0;background:none;font-size:inherit;}" +
  "#" + WIN_ID + " .cd-setbtn .cd-ic,#" + WIN_ID + " .cd-setbtn .cd-uiic{transition:transform .3s ease;}" +
  "#" + WIN_ID + " .cd-setbtn:hover .cd-ic,#" + WIN_ID + " .cd-setbtn:hover .cd-uiic{transform:rotate(60deg);}" +
  "#" + WIN_ID + ".no-anim .cd-set-card,#" + WIN_ID + ".no-anim .cd-viewmenu.cd-set,#" + WIN_ID + ".no-anim .cd-set-page{animation:none !important;}" +
  // окно узкое (класс tiny ставит applyResponsive) — вкладки строкой сверху
  "#" + WIN_ID + ".tiny .cd-set-body{grid-template-columns:1fr;}#" + WIN_ID + ".tiny .cd-set-tabs{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--bd2);padding:8px;}#" + WIN_ID + ".tiny .cd-set-tab{flex:0 0 auto;padding:7px 10px;}" +
  "@keyframes cd-set-fade{from{opacity:0}to{opacity:1}}@keyframes cd-set-pop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}" +
  // ---- Повторение карточек: дорожка оценок, цветные кнопки, «сначала вспомни», итог сессии ----
  "#" + WIN_ID + " .cd-review.has-bg::before{content:\"\";position:fixed;inset:0;pointer-events:none;background:var(--rv-bg) center/cover no-repeat;opacity:.22;filter:blur(2px) saturate(1.1);}" +
  "#" + WIN_ID + " .cd-review.has-bg::after{content:\"\";position:fixed;inset:0;pointer-events:none;background:radial-gradient(90% 70% at 50% 35%,transparent,var(--bg) 92%);}" +
  "#" + WIN_ID + " .cd-review .cd-rv-inner{position:relative;z-index:1;}" +
  "#" + WIN_ID + ".reviewing .cd-rv-inner{max-width:780px;padding-top:6vh;}" +
  "#" + WIN_ID + " .cd-rv-top{gap:10px;}" +
  "#" + WIN_ID + " .cd-rv-count{flex:0 0 auto;font-weight:600;}" +
  "#" + WIN_ID + " .cd-rv-track{flex:1 1 auto;display:flex;gap:4px;align-items:center;min-width:0;}" +
  "#" + WIN_ID + " .cd-rv-track i{flex:1 1 0;max-width:34px;height:7px;border-radius:4px;background:var(--bd);transition:background .25s,transform .25s;}" +
  "#" + WIN_ID + " .cd-rv-track i.cur{background:rgba(var(--ac-rgb),.55);transform:scaleY(1.35);animation:cd-rv-pulse 1.4s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-rv-track i.g0{background:var(--tp);}" +
  "#" + WIN_ID + " .cd-rv-track i.g1{background:var(--tn);}" +
  "#" + WIN_ID + " .cd-rv-track i.g2{background:var(--ts);}" +
  "#" + WIN_ID + " .cd-rv-track i.again{outline:1px dashed rgba(var(--ac-rgb),.6);outline-offset:1px;}" +
  "#" + WIN_ID + " .cd-rv-undo{flex:0 0 auto;cursor:pointer;border:1px solid var(--bd);background:var(--panel);color:var(--muted);font:inherit;font-size:12px;border-radius:var(--cd-r-md);padding:5px 10px;}" +
  "#" + WIN_ID + " .cd-rv-undo:hover{color:var(--fg);border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-card{position:relative;overflow:hidden;border-top:3px solid var(--rvg,var(--ac));background:color-mix(in srgb,var(--panel) 92%,transparent);backdrop-filter:blur(8px);}" +
  "#" + WIN_ID + " .cd-rv-card.flipped{animation:cd-rv-flip .32s cubic-bezier(.2,.8,.3,1);}" +
  "#" + WIN_ID + " .cd-rv-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:-6px 0 14px;}" +
  "#" + WIN_ID + " .cd-rv-meta .cd-rv-from{margin:0;padding:3px 9px;border-radius:999px;background:color-mix(in srgb,var(--rvg,var(--ac)) 14%,transparent);color:var(--muted);}" +
  "#" + WIN_ID + " .cd-rv-badge{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;padding:3px 8px;border-radius:999px;background:rgba(var(--ac-rgb),.18);color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-badge.new{background:color-mix(in srgb,var(--ts) 18%,transparent);color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rv-streak{margin-left:auto;font-size:12px;font-weight:700;color:var(--tn);}" +
  "#" + WIN_ID + " .cd-rv-recall{margin-top:14px;}" +
  "#" + WIN_ID + " .cd-rv-own summary{cursor:pointer;font-size:12px;color:var(--faint);list-style:none;}" +
  "#" + WIN_ID + " .cd-rv-own summary::-webkit-details-marker{display:none;}" +
  "#" + WIN_ID + " .cd-rv-own summary:hover{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-in{display:block;width:100%;box-sizing:border-box;margin-top:8px;padding:10px 12px;border:1px solid var(--bd);border-radius:12px;background:var(--bg);color:var(--fg);font:inherit;font-size:14px;line-height:1.5;resize:vertical;}" +
  "#" + WIN_ID + " .cd-rv-in:focus{outline:none;border-color:var(--ac);box-shadow:0 0 0 3px rgba(var(--ac-rgb),.18);}" +
  "#" + WIN_ID + " .cd-rv-mine{margin-bottom:12px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--fg) 4%,transparent);border-left:3px solid var(--faint);}" +
  "#" + WIN_ID + " .cd-rv-mine span{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--faint);margin-bottom:3px;}" +
  "#" + WIN_ID + " .cd-rv-mt{white-space:pre-wrap;color:var(--fg);font-size:14px;}" +
  "#" + WIN_ID + " .cd-rv-al{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ts);margin-bottom:4px;}" +
  "#" + WIN_ID + " .cd-rv-a{color:var(--fg);}" +
  "#" + WIN_ID + " .cd-rv-show{padding:11px 26px;font-size:14px;box-shadow:0 6px 18px rgba(var(--ac-rgb),.28);transition:transform .12s,box-shadow .12s;}" +
  "#" + WIN_ID + " .cd-rv-show:hover{transform:translateY(-1px);box-shadow:0 9px 22px rgba(var(--ac-rgb),.36);}" +
  "#" + WIN_ID + " .cd-rv-rate{gap:10px;}" +
  "#" + WIN_ID + " .cd-rv-grade{flex-direction:row !important;align-items:center !important;gap:9px !important;padding:9px 16px 9px 10px !important;border-width:1.5px !important;transition:transform .12s,background .12s,border-color .12s;}" +
  "#" + WIN_ID + " .cd-rv-grade:hover{transform:translateY(-2px);}" +
  "#" + WIN_ID + " .cd-rv-gi{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;font-weight:800;font-size:14px;color:#11111b;}" +
  "#" + WIN_ID + " .cd-rv-gt{display:flex;flex-direction:column;align-items:flex-start;line-height:1.2;font-weight:600;}" +
  "#" + WIN_ID + " .cd-rv-grade.g0{border-color:color-mix(in srgb,var(--tp) 45%,transparent) !important;}" +
  "#" + WIN_ID + " .cd-rv-grade.g0 .cd-rv-gi{background:var(--tp);}" +
  "#" + WIN_ID + " .cd-rv-grade.g0:hover{background:color-mix(in srgb,var(--tp) 12%,var(--bg)) !important;}" +
  "#" + WIN_ID + " .cd-rv-grade.g1{border-color:color-mix(in srgb,var(--tn) 45%,transparent) !important;}" +
  "#" + WIN_ID + " .cd-rv-grade.g1 .cd-rv-gi{background:var(--tn);}" +
  "#" + WIN_ID + " .cd-rv-grade.g1:hover{background:color-mix(in srgb,var(--tn) 12%,var(--bg)) !important;}" +
  "#" + WIN_ID + " .cd-rv-grade.g2{border-color:color-mix(in srgb,var(--ts) 45%,transparent) !important;}" +
  "#" + WIN_ID + " .cd-rv-grade.g2 .cd-rv-gi{background:var(--ts);}" +
  "#" + WIN_ID + " .cd-rv-grade.g2:hover{background:color-mix(in srgb,var(--ts) 12%,var(--bg)) !important;}" +
  "#" + WIN_ID + " .cd-rv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-width:520px;margin:4px auto 16px;}" +
  "#" + WIN_ID + " .cd-rv-st{display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 6px;border-radius:14px;border:1px solid var(--bd);background:color-mix(in srgb,var(--panel) 90%,transparent);}" +
  "#" + WIN_ID + " .cd-rv-st b{font-size:22px;line-height:1.1;}" +
  "#" + WIN_ID + " .cd-rv-st span{font-size:11px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-rv-st.g2 b{color:var(--ts);}" +
  "#" + WIN_ID + " .cd-rv-st.g1 b{color:var(--tn);}" +
  "#" + WIN_ID + " .cd-rv-st.g0 b{color:var(--tp);}" +
  "#" + WIN_ID + " .cd-rv-st.acc b{color:var(--ac);}" +
  "#" + WIN_ID + " .cd-rv-ret{font-size:12.5px;color:var(--muted);margin-bottom:14px;}" +
  "#" + WIN_ID + " .cd-rv-weak{max-width:560px;margin:0 auto 18px;text-align:left;}" +
  "#" + WIN_ID + " .cd-rv-wh{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--faint);margin:0 0 6px 2px;}" +
  "#" + WIN_ID + " .cd-rv-wi{display:flex;align-items:center;gap:10px;padding:9px 12px;margin-bottom:6px;border-radius:12px;background:color-mix(in srgb,var(--panel) 90%,transparent);border-left:3px solid var(--tn);font-size:13px;}" +
  "#" + WIN_ID + " .cd-rv-wi.g0{border-left-color:var(--tp);}" +
  "#" + WIN_ID + " .cd-rv-wq{flex:1 1 auto;min-width:0;}" +
  "#" + WIN_ID + " .cd-rv-wi .cd-rv-open{flex:0 0 auto;margin-left:0;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
  "#" + WIN_ID + " .cd-rv-done-btns{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-rv-more{cursor:pointer;border:none;background:var(--ac);color:#11111b;font:inherit;font-weight:700;border-radius:var(--cd-r-md);padding:6px 14px;}" +
  "#" + WIN_ID + ".no-anim .cd-rv-card.flipped,#" + WIN_ID + ".no-anim .cd-rv-track i.cur{animation:none;}" +
  "@keyframes cd-rv-flip{0%{transform:perspective(900px) rotateX(8deg);opacity:.6}100%{transform:none;opacity:1}}@keyframes cd-rv-pulse{0%,100%{opacity:1}50%{opacity:.45}}" +
  "#" + WIN_ID + " .cd-set-tic img.cd-emo{width:22px;height:22px;object-fit:contain;}#" + WIN_ID + " .cd-rv-streak img.cd-emo,#" + WIN_ID + " .cd-rv-ret img.cd-emo,#" + WIN_ID + " .cd-rv-own img.cd-emo{width:18px;height:18px;vertical-align:-4px;}" +
  // ---- Игровые блоки: «Путь героя» (```quests), сундуки (```lootsim), волна поиска пути (```bfsgrid) ----
  "#" + WIN_ID + " .cd-qmap{margin:18px 0;padding:18px 18px 14px;border:1px solid var(--bd);border-radius:18px;background:radial-gradient(120% 90% at 100% 0%,color-mix(in srgb,#eab308 14%,transparent),transparent 60%),var(--panel);}" +
  "#" + WIN_ID + " .cd-qmap-empty{color:var(--faint);font-size:13px;}" +
  "#" + WIN_ID + " .cd-qm-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-qm-ttl{font-size:17px;font-weight:800;}" +
  "#" + WIN_ID + " .cd-qm-sum{font-size:12.5px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-qm-sum b{color:#eab308;font-size:15px;}" +
  "#" + WIN_ID + " .cd-qm-bar{height:8px;border-radius:5px;background:var(--bd2);overflow:hidden;margin:9px 0 14px;}" +
  "#" + WIN_ID + " .cd-qm-bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#eab308,#f97316);transition:width .4s;}" +
  "#" + WIN_ID + " .cd-qm-ch{margin:0 0 12px;}" +
  "#" + WIN_ID + " .cd-qm-chn{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:7px;}" +
  "#" + WIN_ID + " .cd-qm-chc{margin-left:auto;font-size:11px;color:var(--faint);font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-qm-path{position:relative;display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px;}" +
  "#" + WIN_ID + " .cd-qm-node{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:12px;border:1px solid var(--bd);background:var(--bg);color:var(--fg) !important;text-decoration:none !important;font-size:12px;line-height:1.25;transition:transform .12s,border-color .12s;}" +
  "#" + WIN_ID + " .cd-qm-node:hover{transform:translateY(-2px);border-color:#eab308;}" +
  "#" + WIN_ID + " .cd-qm-dot{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;font-weight:800;font-size:12px;background:conic-gradient(#eab308 calc(var(--qp)*1%),var(--bd2) 0);color:var(--fg);box-shadow:inset 0 0 0 3px var(--bg);}" +
  "#" + WIN_ID + " .cd-qm-nm{min-width:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}" +
  "#" + WIN_ID + " .cd-qm-node.done{border-color:color-mix(in srgb,var(--ts) 45%,transparent);background:color-mix(in srgb,var(--ts) 9%,var(--bg));}" +
  "#" + WIN_ID + " .cd-qm-node.done .cd-qm-dot{background:var(--ts);color:#11111b;box-shadow:none;}" +
  "#" + WIN_ID + " .cd-qm-node.next{border-color:#eab308;box-shadow:0 0 0 1px #eab308,0 6px 18px color-mix(in srgb,#eab308 22%,transparent);}" +
  "#" + WIN_ID + " .cd-qm-node.next .cd-qm-dot{animation:cd-qm-pulse 1.6s ease-in-out infinite;}" +
  "#" + WIN_ID + " .cd-qm-node.todo:not(.next){opacity:.72;}" +
  "#" + WIN_ID + " .cd-qm-next{display:block;margin-top:6px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,#eab308 12%,transparent);color:var(--fg) !important;text-decoration:none !important;font-size:13px;}" +
  "#" + WIN_ID + " .cd-qm-next:hover{background:color-mix(in srgb,#eab308 20%,transparent);}" +
  "#" + WIN_ID + " .cd-qm-note{margin-top:8px;font-size:11px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-lootsim,#" + WIN_ID + " .cd-bfs{margin:16px 0;padding:14px 16px;border:1px solid var(--bd);border-radius:16px;background:var(--panel);}" +
  "#" + WIN_ID + " .cd-ls-head,#" + WIN_ID + " .cd-bfs-head{font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:10px;}" +
  "#" + WIN_ID + " .cd-ls-row{display:grid;grid-template-columns:minmax(90px,1.1fr) 70px minmax(90px,2fr) minmax(76px,auto);align-items:center;gap:10px;padding:5px 0;font-size:13px;}" +
  "#" + WIN_ID + " .cd-ls-nm{font-weight:700;}" +
  "#" + WIN_ID + " .cd-ls-want{font-size:11.5px;color:var(--faint);}" +
  "#" + WIN_ID + " .cd-ls-bar{position:relative;height:12px;border-radius:7px;background:var(--bd2);overflow:hidden;}" +
  "#" + WIN_ID + " .cd-ls-bar b{display:block;height:100%;border-radius:7px;background:var(--lc);transition:width .35s;}" +
  "#" + WIN_ID + " .cd-ls-exp{position:absolute;top:-2px;bottom:-2px;width:2px;margin-left:-1px;background:var(--fg);opacity:.55;z-index:1;}" +
  "#" + WIN_ID + " .cd-ls-got{font-size:12px;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums;}" +
  "#" + WIN_ID + " .cd-ls-row.r0,#" + WIN_ID + " .cd-ls-trail i.r0{--lc:#9ca3af;}" +
  "#" + WIN_ID + " .cd-ls-row.r1,#" + WIN_ID + " .cd-ls-trail i.r1{--lc:#60a5fa;}" +
  "#" + WIN_ID + " .cd-ls-row.r2,#" + WIN_ID + " .cd-ls-trail i.r2{--lc:#c084fc;}" +
  "#" + WIN_ID + " .cd-ls-row.r3,#" + WIN_ID + " .cd-ls-trail i.r3{--lc:#fbbf24;}" +
  "#" + WIN_ID + " .cd-ls-row.r4,#" + WIN_ID + " .cd-ls-trail i.r4{--lc:#f87171;}" +
  "#" + WIN_ID + " .cd-ls-row.r5,#" + WIN_ID + " .cd-ls-trail i.r5{--lc:#34d399;}" +
  "#" + WIN_ID + " .cd-ls-trail{display:flex;gap:4px;min-height:14px;margin:10px 0 4px;flex-wrap:wrap;}" +
  "#" + WIN_ID + " .cd-ls-trail i{width:14px;height:14px;border-radius:4px;background:var(--lc);box-shadow:inset 0 -2px 0 rgba(0,0,0,.25);}" +
  "#" + WIN_ID + " .cd-ls-ctl,#" + WIN_ID + " .cd-bfs-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;}" +
  "#" + WIN_ID + " .cd-ls-ctl button,#" + WIN_ID + " .cd-bfs-ctl button{cursor:pointer;border:1px solid var(--bd);background:var(--bg);color:var(--fg);font:inherit;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:10px;}" +
  "#" + WIN_ID + " .cd-ls-ctl button:hover,#" + WIN_ID + " .cd-bfs-ctl button:hover{border-color:var(--ac);}" +
  "#" + WIN_ID + " .cd-ls-open[data-n='1'],#" + WIN_ID + " .cd-bfs-play{background:var(--ac) !important;color:#11111b !important;border-color:transparent !important;}" +
  "#" + WIN_ID + " .cd-ls-pityl{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer;}" +
  "#" + WIN_ID + " .cd-ls-reset,#" + WIN_ID + " .cd-bfs-reset{margin-left:auto;}" +
  "#" + WIN_ID + " .cd-ls-stat,#" + WIN_ID + " .cd-bfs-st{margin-top:8px;font-size:12px;color:var(--muted);}" +
  "#" + WIN_ID + " .cd-bfs-grid{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,34px));gap:3px;justify-content:start;overflow-x:auto;}" +
  "#" + WIN_ID + " .cd-bfs-c{aspect-ratio:1;min-width:0;padding:0;border:0;border-radius:6px;cursor:pointer;font:inherit;font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--fg);background:color-mix(in srgb,var(--fg) 5%,transparent);transition:background .18s,transform .1s;}" +
  "#" + WIN_ID + " .cd-bfs-c:hover{transform:scale(1.08);}" +
  "#" + WIN_ID + " .cd-bfs-c.wall{background:color-mix(in srgb,var(--fg) 26%,var(--bg));box-shadow:inset 0 -3px 0 rgba(0,0,0,.25);}" +
  "#" + WIN_ID + " .cd-bfs-c.floor.on{background:color-mix(in srgb,var(--ac) calc(62% - var(--t)*0.5%),transparent);}" +
  "#" + WIN_ID + " .cd-bfs-c.path{background:color-mix(in srgb,#f97316 70%,transparent) !important;color:#11111b;}" +
  "#" + WIN_ID + " .cd-bfs-c.start{background:var(--ts);color:#11111b;cursor:default;}" +
  "#" + WIN_ID + " .cd-bfs-c.enemy{background:var(--tp);color:#11111b;cursor:default;}" +
  "#" + WIN_ID + ".no-anim .cd-qm-node.next .cd-qm-dot{animation:none;}" +
  "@keyframes cd-qm-pulse{0%,100%{box-shadow:inset 0 0 0 3px var(--bg),0 0 0 0 rgba(234,179,8,.5)}50%{box-shadow:inset 0 0 0 3px var(--bg),0 0 0 6px rgba(234,179,8,0)}}" +
  paletteCss();

