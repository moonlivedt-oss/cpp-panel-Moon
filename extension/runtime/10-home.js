  // ==== runtime/10-home.js — главный экран, руководство ====
  // ------- главный экран (приветствие / возвращение) -------
  function greeting() {
    var h = new Date().getHours();
    if (h < 6) return "Доброй ночи";
    if (h < 12) return "Доброе утро";
    if (h < 18) return "Добрый день";
    return "Добрый вечер";
  }
  function findFile(re) {
    var d = DATA(); if (!d) return null;
    for (var i = 0; i < d.files.length; i++) if (re.test(d.files[i].rel)) return d.files[i];
    return null;
  }
  function lookupFile(rel) {   // устойчиво к регистру
    var map = fileMap();
    return map[rel] || map[String(rel).toLowerCase()] || null;
  }
  function metaOf(f) {
    var parts = [];
    if (f.minutes) parts.push("~" + f.minutes + " мин");
    if (f.sections) parts.push(f.sections + " " + plural(f.sections, ["раздел", "раздела", "разделов"]));
    return parts.join(" · ");
  }
  // #17 Есть ли откуда грузить материалы (data/stamp-файл). Если да, но файлов ещё нет —
  // показываем скелет-заглушку («грузится»), а не пугающее «не найдено / проверь путь».
  function hasDataSource() {
    try {
      var d = DATA();
      return !!((d && (d.dataUrl || d.stampUrl)) || bootVal("dataUrl") || bootVal("stampUrl"));
    } catch (e) { return false; }
  }
  function skelHomeHtml() {
    return '<div class="cd-home-inner">' +
      '<div class="cd-skel-b cd-skel-hero"></div>' +
      '<div class="cd-skel-tiles"><div class="cd-skel-b cd-skel-tile"></div><div class="cd-skel-b cd-skel-tile"></div><div class="cd-skel-b cd-skel-tile"></div></div>' +
      '<div class="cd-skel-b cd-skel-line w40"></div>' +
      '<div class="cd-skel-b cd-skel-line w80"></div>' +
      '<div class="cd-skel-b cd-skel-line w60"></div>' +
      '<div class="cd-skel-note">Загружаю материалы…</div></div>';
  }
  function skelNavHtml() {
    var rows = "";
    for (var i = 0; i < 6; i++) rows += '<div class="cd-skel-b"></div>';
    return '<div class="cd-skel-nav">' + rows + "</div>";
  }

  function buildHome() {
    if (!homeEl) return;
    var d = DATA();
    // Данные не загрузились (нет файла данных / пустой список) — дружелюбная заглушка
    // с наклейкой вместо пустого экрана.
    if (!d || !d.files.length || d.lazy) {
      // Источник данных есть, но материалы ещё не пришли (или пришло только оглавление, а тексты
      // читаются асинхронно) — скелет вместо «не найдено».
      if (hasDataSource()) { setHTML(homeEl, skelHomeHtml()); return; }
      setHTML(homeEl, '<div class="cd-home-inner"><div class="cd-empty cd-empty-home">' +
        '<div class="cd-empty-art">' + stickerMarkup("mascot-sleep", 118) + '</div>' +
        '<div class="cd-empty-t">Материалы не загрузились</div>' +
        '<div class="cd-empty-s">Нажми «Обновить» ⟳ вверху окна или проверь путь к docs в настройке cppDocs.path.</div>' +
        '</div></div>');
      return;
    }
    var total = d.files.length, done = 0;
    d.files.forEach(function (f) { if (state.read[f.rel]) done++; });
    var allDone = done >= total && total > 0;   // весь справочник пройден — время поздравить
    var hi = done > 0 ? "С возвращением!" : "Привет!";   // неразрывный пробел: «С» не повисает отдельной строкой
    var sub = greeting() + (done > 0 ? " · продолжаем учить C++" : " · документация C++ у тебя под рукой");

    var ts = taskStats(), streak = streakDays(), cc = cardCounts();
    var pct = total ? Math.round((done / total) * 100) : 0;
    // Новые наклейки (mascot-win) могут быть ещё не сгенерированы —
    // аккуратно падаем на уже существующие, чтобы экран не показывал заглушку.
    var winMood = (typeof STICKERS !== "undefined" && STICKERS && STICKERS["mascot-win"]) ? "mascot-win" : "mascot-done";
    // #8 маскот меняет настроение: победа (всё пройдено / длинная серия) → думает → машет
    var mood = (allDone || streak >= 7) ? winMood : (done > 0 ? "mascot-think" : "mascot-hi");

    // #8 кольцо прогресса вокруг маскота (SVG). C = длина окружности радиуса 46.
    var C = 289, off = Math.round(C * (1 - pct / 100));
    var ring = '<svg class="cd-ring" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="cd-ring-bg" cx="50" cy="50" r="46"/>' +
      '<circle class="cd-ring-fg" cx="50" cy="50" r="46" style="stroke-dasharray:' + C + ';stroke-dashoffset:' + off + '"/></svg>';

    // Плитки статистики теперь живут в самой шапке справа (dashTile определён ниже — поднимается
    // хойстингом). Это заполняет пустое место героя на широком окне и укорачивает экран.
    var sts = stepsTotals();
    var statsHtml =
      dashTile(emo("ui-read", "📘"), "read", done + " / " + total, "изучено", total ? done / total : 0) +
      dashTile(emo("ui-solve", "✅"), "solve", ts.done + " / " + ts.total, "решено", ts.total ? ts.done / ts.total : 0) +
      dashTile(emo("ui-streak", "🔥"), "streak", String(streak), plural(streak, ["день", "дня", "дней"]) + " подряд", null) +
      (sts.total ? dashTile(emo("ui-steps", "👣"), "steps", sts.done + " / " + sts.total, "разборов по шагам", sts.done / sts.total) : "");

    var html = '<div class="cd-home-inner">';
    html += '<div class="cd-home-hero">' +
      '<div class="cd-hero-lead">' +
      '<div class="cd-home-mascot cd-has-ring">' + ring + '<span class="cd-ring-in">' + stickerMarkup(mood, 76) + '</span></div>' +
      '<div class="cd-home-htxt"><div class="cd-home-hi">' + escapeHtml(hi) + '</div>' +
      '<div class="cd-home-sub">' + escapeHtml(sub) + '</div>' +
      heroWeek() +
      (cc.due > 0 ? '<div class="cd-home-status">' + emo("ui-cards", "🎴") + " к повторению " + cc.due + " " + plural(cc.due, ["карточка", "карточки", "карточек"]) + "</div>" : "") +
      "</div></div>" +
      '<div class="cd-hero-stats' + (sts.total ? " cd-hs4" : "") + '">' + statsHtml + "</div></div>";

    // Порядок главной: приветствие → главное действие (+ план на сегодня, дорожка курса) →
    // повторение одной карточкой → поиск → остальное. Поэтому блоки ниже копим в переменные.
    var heroEnd = html.length;   // всё после героя раскладываем по колонкам в конце (см. homeWide)
    var searchHtml = "", newsHtml = "", qaHtml = "", quickHtml = "", recentHtml = "", marksHtml = "", pinsHtml = "";
    // #2 Поиск по всем материалам прямо на главной
    searchHtml = '<div class="cd-home-search"><span class="cd-hs-ic" aria-hidden="true">⌕</span>' +
      '<input class="cd-hs-in" type="text" placeholder="Поиск по всем материалам…" aria-label="Поиск по материалам" autocomplete="off">' +
      '<div class="cd-hs-res" hidden></div></div>';

    // #10 «Что нового» — разовый баннер о свежих возможностях
    if (state.whatsnew !== WHATSNEW) {
      newsHtml = '<div class="cd-whatsnew"><div class="cd-wn-h">' + emo("ui-news", "✨") + ' Что нового</div>' +
        '<ul class="cd-wn-list">' +
        '<li><b>🏞️ Пейзажи</b> — у каждой палитры своя картинка на главной и в повторении карточек</li>' +
        '<li><b>⚙ Новые настройки</b> — кнопка всегда в шапке; вкладки, палитры с картинками, образец текста прямо в окне</li>' +
        '<li><b>🔤 Шрифты в комплекте</b> — Inter, PT Sans и Golos работают сразу, устанавливать не нужно</li>' +
        '<li><b>🎴 Повторение карточек</b> — «сначала вспомни», «↶ Назад», «не помню» возвращается в конце сессии, итог с разбором</li>' +
        '<li><b>▶ Запустить</b> — упавшая программа больше не засчитывается; причина падения — простыми словами</li>' +
        '</ul><button class="cd-wn-ok" type="button">Понятно</button></div>';
    }

    // Плитка статистики (используется в шапке героя). frac=null — без мини-полоски.
    function dashTile(ic, kind, value, label, frac) {
      var bar = (frac != null)
        ? '<div class="cd-dt-bar"><i style="width:' + Math.max(0, Math.min(100, Math.round(frac * 100))) + '%"></i></div>' : '';
      return '<div class="cd-dtile cd-dt-' + kind + '"><div class="cd-dt-ic">' + ic + '</div>' +
        '<div class="cd-dt-v">' + escapeHtml(value) + '</div>' +
        '<div class="cd-dt-l">' + escapeHtml(label) + '</div>' + bar + '</div>';
    }

    // #9 Панель быстрых действий — запуск в один тап
    var qab = "";   // «▶ Продолжить» здесь убран: главное действие — большая карточка «Следующий шаг» выше
    if (ts.total) qab += '<button class="cd-qa cd-qa-rand" type="button">' + emo("ui-dice", "🎲") + " Случайная задача</button>";
    if (cc.due + cc.neu > 0) qab += '<button class="cd-qa cd-qa-rev" type="button">' + emo("ui-cards", "🎴") + " Повторить" + (cc.due ? " · " + cc.due : "") + "</button>";
    qab += '<button class="cd-qa cd-qa-find" type="button">⌕ Найти</button>';
    qab += '<button class="cd-qa cd-qa-prog" type="button">' + emo("icon-route", "") + " Прогресс</button>";
    qab += '<button class="cd-qa cd-qa-guide" type="button">' + emo("ui-guide", "📖") + " Обучение</button>";
    qaHtml = '<div class="cd-qabar">' + qab + "</div>";

    // Повторение — одна карточка: «Разминка дня» (5 карточек, ~2 мин) + сколько всего ждёт,
    // и маленькая кнопка «повторить все». Новые карточки дозируются лимитом в день (NEW_PER_DAY).
    var cardsHtml = "";
    if (cc.total > 0) {
      var restTxt = cc.due + cc.neu > 0
        ? "всего к повторению " + cc.due + (cc.neu ? " + " + cc.neu + " " + plural(cc.neu, ["новая", "новые", "новых"]) + " на сегодня" : "")
        : "всё повторено — интервалы назначены";
      var allBtn = cc.due + cc.neu > 0 ? '<span class="cd-hw-all" role="button" tabindex="0" title="Повторить всё, что ждёт сегодня">повторить все →</span>' : "";
      if (warmupDoneToday()) {
        cardsHtml += '<div class="cd-home-warm done"><span class="cd-hw-ic">✓</span>' +
          '<div class="cd-hc-main"><div class="cd-hc-lbl">Разминка дня · сделана</div>' +
          '<div class="cd-hc-meta">' + escapeHtml(restTxt) + "</div></div>" + allBtn + "</div>";
      } else {
        var wn = Math.min(WARMUP_N, cc.total);
        cardsHtml += '<div class="cd-home-warm" role="button" tabindex="0"><span class="cd-hw-ic">' + emo("ui-warm", "🌅") + '</span>' +
          '<div class="cd-hc-main"><div class="cd-hc-lbl">Разминка дня</div>' +
          '<div class="cd-hc-title">' + wn + " " + plural(wn, ["карточка", "карточки", "карточек"]) + " · около 2 минут</div>" +
          '<div class="cd-hc-meta">' + escapeHtml(restTxt) + "</div></div>" + allBtn +
          '<div class="cd-hc-arrow">→</div></div>';
      }
    }
    cardsHtml += dailyCardHtml();
    try { cardsHtml += weeklyHomeHtml() + weakHomeHtml(); } catch (e) { reportError("главная: прогресс", e); }
    var planHtml = "", trackHtml = courseTrack();

    if (allDone) {
      // Весь справочник пройден — вместо «Продолжить» поздравляем наклейкой.
      html += '<div class="cd-home-done">' +
        '<div class="cd-done-art">' + stickerMarkup(winMood, 62) + '</div>' +
        '<div class="cd-hc-main"><div class="cd-hc-lbl">Готово</div>' +
        '<div class="cd-hc-title">Всё изучено — ' + total + ' ' + plural(total, ["материал", "материала", "материалов"]) + '!</div>' +
        '<div class="cd-hc-meta">Можно перечитывать любой материал или сбросить прогресс и пройти заново.</div></div></div>';
    } else {
      // #1 Умный «Следующий шаг»: незакрытая последняя тема → продолжить; иначе первая
      // неизученная по порядку курса; в самом начале — «Начать здесь».
      var lastF = state.last ? lookupFile(state.last) : null;
      var nF = nextUnread();
      var primary, lbl, reason;
      if (lastF && !state.read[lastF.rel]) { primary = lastF; lbl = "▶ Продолжить чтение"; reason = "вернуться к последней теме"; }
      else if (nF) { primary = nF; lbl = "▶ Следующий шаг"; reason = "следующая неизученная тема"; }
      else { primary = lastF || findFile(/00-нач|начни/i) || d.files[0]; lbl = "▶ Начать здесь"; reason = ""; }
      if (primary) {
        var meta = [reason, metaOf(primary)].filter(function (x) { return x; }).join(" · ");
        html += '<button class="cd-home-cont" data-rel="' + escapeHtml(primary.rel) + '">' +
          '<div class="cd-hc-main"><div class="cd-hc-lbl">' + lbl + '</div>' +
          '<div class="cd-hc-title">' + escapeHtml(primary.title || primary.name) + '</div>' +
          (meta ? '<div class="cd-hc-meta">' + escapeHtml(meta) + '</div>' : '') +
          '</div><div class="cd-hc-arrow">→</div></button>';
        // «Вы остановились» — начатый, но не законченный разбор по шагам или открытый босс
        var sp = state.spot, spF = sp ? lookupFile(sp.rel) : null;
        if (spF) {
          var spPct = sp.kind === "steps" && sp.n ? Math.round((sp.i + 1) / sp.n * 100) : 0;
          html += '<button class="cd-home-spot" type="button">' +
            '<span class="cd-spot-ic">' + (sp.kind === "boss" ? "♛" : "↩") + "</span>" +
            '<span class="cd-spot-main"><span class="cd-spot-lbl">Вы остановились · ' + (sp.kind === "boss" ? "босс темы" : "разбор по шагам") + "</span>" +
            '<span class="cd-spot-t">' + escapeHtml(sp.title || "без названия") + "</span>" +
            '<span class="cd-spot-f">' + escapeHtml(spF.title || spF.name) +
            (sp.kind === "steps" && sp.n ? " · шаг " + (sp.i + 1) + " из " + sp.n : "") + "</span>" +
            (spPct ? '<span class="cd-spot-bar"><i style="width:' + spPct + '%"></i></span>' : "") +
            '</span><span class="cd-spot-go">→</span></button>';
        }
        // Подсказка «дальше по курсу», если следующий неизученный отличается от primary
        if (nF && nF.rel !== primary.rel) {
          html += '<button class="cd-home-next" data-rel="' + escapeHtml(nF.rel) + '">Дальше по курсу: <b>' +
            escapeHtml(nF.title || nF.name) + "</b> →</button>";
        }
        planHtml = todayPlan(primary, cc);
      }
    }
    var mainTop = html.slice(heroEnd); html = html.slice(0, heroEnd);

    // Быстрый доступ — ключевые точки, цвет карточки = цвет группы файла
    var quick = [
      { re: /00-нач|начни/i, t: "Начни отсюда", s: "карта: что где лежит и с чего начать", icon: "icon-start" },
      { re: /marshrut|маршрут/i, t: "Маршрут изучения", s: "этапы по порядку с чекпоинтами", icon: "icon-route" },
      { re: /shpargalka|шпаргал/i, t: "Шпаргалка", s: "самое частое на один экран", icon: "icon-cheat" },
      { re: /^ref\//i, t: "Справочник по темам", s: "подробно по каждой теме", icon: "icon-ref" },
      { re: /zadachnik|задачник/i, t: "Задачник", s: "задачи для практики — реши сам", icon: "icon-tasks" },
      { re: /^examples\//i, t: "Примеры программ", s: "готовый код — собран и запущен", icon: "icon-examples" }
    ];
    // Единый заголовок секции: цветная точка + подпись + счётчик — общий ритм для всех блоков.
    function secHead(label, count, color) {
      return '<div class="cd-home-sec"' + (color ? ' style="--sc:' + color + '"' : "") + ">" +
        '<span class="cd-sec-dot"></span><span class="cd-sec-lbl">' + escapeHtml(label) + "</span>" +
        (count != null ? '<span class="cd-sec-count">' + count + "</span>" : "") + "</div>";
    }
    var cards = "", quickN = 0;
    quick.forEach(function (q) {
      var f = findFile(q.re); if (!f) return;
      quickN++;
      var ic = (q.icon && STICKERS && STICKERS[q.icon]) ? '<span class="cd-hcard-ic">' + stickerMarkup(q.icon, 32) + "</span>" : "";
      cards += '<button class="cd-home-card" data-rel="' + escapeHtml(f.rel) + '" style="--gcolor:' + escapeHtml(f.groupColor || "var(--ac)") + '">' +
        '<div class="cd-hcard-head">' + ic + '<div class="cd-hcard-t">' + escapeHtml(q.t) + "</div></div>" +
        '<div class="cd-hcard-s">' + escapeHtml(f.subtitle || q.s) + "</div>" +
        '<span class="cd-hcard-go">→</span></button>';
    });
    if (cards) quickHtml = secHead("Быстрый доступ", quickN, "var(--ac)") + '<div class="cd-home-grid">' + cards + "</div>";

    // Недавнее (кроме файла из «Продолжить», чтобы не дублировать)
    var recentRels = (state.recent || []).filter(function (r) {
      return lookupFile(r) && String(r).toLowerCase() !== String(state.last || "").toLowerCase();
    });
    if (recentRels.length) {
      var rchips = "";
      recentRels.slice(0, 8).forEach(function (r) {
        var rf = lookupFile(r);
        rchips += '<button class="cd-home-chip" data-rel="' + escapeHtml(rf.rel) + '" style="--gcolor:' +
          escapeHtml(rf.groupColor || "var(--ac)") + '">' + escapeHtml(rf.title || rf.name) + "</button>";
      });
      recentHtml = secHead("Недавнее", recentRels.length, "#f9e2af") + '<div class="cd-home-chips">' + rchips + "</div>";
    }

    // Закладки на разделы (если есть) — клик ведёт прямо к разделу
    var markKeys = Object.keys(state.marks || {}).filter(function (k) {
      return lookupFile(String(k).split("#")[0]);
    });
    if (markKeys.length) {
      var mchips = "";
      markKeys.slice(0, 16).forEach(function (k) {
        var parts = String(k).split("#"), rel = parts[0], slug = parts.slice(1).join("#");
        var mf = lookupFile(rel);
        var label = state.marks[k] || (mf && (mf.title || mf.name)) || rel;
        mchips += '<button class="cd-home-chip cd-home-mark" data-rel="' + escapeHtml(mf.rel) +
          '" data-hash="#' + escapeHtml(slug) + '" style="--gcolor:' + escapeHtml(mf.groupColor || "var(--ac)") +
          '" title="' + escapeHtml((mf.title || mf.name) + " · раздел") + '">★ ' + escapeHtml(label) + "</button>";
      });
      marksHtml = secHead("Закладки", markKeys.length, "#cba6f7") + '<div class="cd-home-chips">' + mchips + "</div>";
    }

    // Закреплённое (если есть)
    var pinRels = Object.keys(state.pins || {}).filter(function (r) { return state.pins[r] && lookupFile(r); });
    if (pinRels.length) {
      var chips = "";
      pinRels.slice(0, 12).forEach(function (r) {
        var f = lookupFile(r);
        chips += '<button class="cd-home-chip" data-rel="' + escapeHtml(f.rel) + '" style="--gcolor:' + escapeHtml(f.groupColor || "var(--ac)") + '">' + escapeHtml(f.title || f.name) + '</button>';
      });
      pinsHtml = secHead("Закреплённое", pinRels.length, "#f38ba8") + '<div class="cd-home-chips">' + chips + "</div>";
    }
    // Широкое окно — две колонки: слева путь (следующий шаг, план, курс, быстрый доступ),
    // справа ежедневное (разминка, поиск, действия, недавнее, «Что нового»). Узкое — одна лента.
    var wide = homeWide(); homeWideLast = wide;
    if (wide) {
      html += '<div class="cd-home-cols"><div class="cd-home-main">' + mainTop + planHtml + trackHtml + quickHtml + "</div>" +
        '<div class="cd-home-side">' + cardsHtml + searchHtml + qaHtml + recentHtml + marksHtml + pinsHtml + newsHtml + "</div></div>";
    } else {
      html += mainTop + planHtml + trackHtml + cardsHtml + searchHtml + newsHtml + qaHtml + quickHtml + recentHtml + marksHtml + pinsHtml;
    }
    html += "</div>";
    homeEl.classList.toggle("wide2", wide);
    setHTML(homeEl, html);
    buildSky();
    homeCountUp();   // #8 цифры героя «набегают», кольцо заполняется

    // Анимация мини-полосок дашборда: от нуля к целевой ширине.
    homeEl.querySelectorAll(".cd-dt-bar i").forEach(function (bar) {
      var w = bar.style.width; bar.style.width = "0";
      requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = w; }); });
    });

    homeEl.querySelectorAll("[data-rel]").forEach(function (b) {
      b.addEventListener("click", function () { openFile(b.getAttribute("data-rel"), b.getAttribute("data-hash") || undefined); });
    });

    var spotBtn = homeEl.querySelector(".cd-home-spot");
    if (spotBtn) spotBtn.addEventListener("click", function () {
      var sp = state.spot; if (!sp) return;
      openFile(sp.rel, "#" + (sp.kind === "boss" ? "boss-" : "st-") + sp.id);
      var box = articleEl && articleEl.querySelector('[data-id="' + cssEscape(sp.id) + '"]');
      if (box && sp.kind === "steps") stepsShow(box, sp.i);
      if (box && sp.kind === "boss") { box.__peek = 1; refreshBoss(); }
    });

    // #9 быстрые действия
    var cont = homeEl.querySelector(".cd-home-cont");
    var qaCont = homeEl.querySelector(".cd-qa-cont");
    if (qaCont) qaCont.addEventListener("click", function () {
      if (cont) { cont.click(); return; }
      var lf = state.last ? lookupFile(state.last) : null, f = lf || (d.files[0]);
      if (f) openFile(f.rel);
    });
    var qaRand = homeEl.querySelector(".cd-qa-rand");
    if (qaRand) qaRand.addEventListener("click", openRandomTask);
    var qaRev = homeEl.querySelector(".cd-qa-rev");
    if (qaRev) qaRev.addEventListener("click", startReview);

    // #3 карточка повторения
    var revCard = homeEl.querySelector(".cd-home-review");
    if (revCard) revCard.addEventListener("click", startReview);
    var warmBtn = homeEl.querySelector(".cd-home-warm:not(.done):not(.cd-daily)");
    var allRev = homeEl.querySelector(".cd-hw-all");
    if (allRev) {
      allRev.addEventListener("click", function (e) { e.stopPropagation(); startReview(); });
      allRev.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); startReview(); } });
    }
    var dailyBtn = homeEl.querySelector(".cd-daily:not(.done)");
    if (dailyBtn) {
      dailyBtn.addEventListener("click", function (e) { e.stopPropagation(); openDaily(); });
      dailyBtn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDaily(); } });
    }
    if (warmBtn) {
      warmBtn.addEventListener("click", startWarmup);
      warmBtn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startWarmup(); } });
    }
    homeEl.querySelectorAll(".cd-plan-step[data-act]").forEach(function (b) {
      b.addEventListener("click", function () { if (b.getAttribute("data-act") === "warm") startWarmup(); });
    });

    // #10 «Что нового» — закрыть и запомнить
    var wnOk = homeEl.querySelector(".cd-wn-ok");
    if (wnOk) wnOk.addEventListener("click", function () { state.whatsnew = WHATSNEW; saveState(); buildHome(); });

    // #2 живой поиск по всем материалам
    var hsIn = homeEl.querySelector(".cd-hs-in");
    var hsRes = homeEl.querySelector(".cd-hs-res");
    function hsRender() {
      var q = norm(hsIn.value.trim());
      if (!q) { hsRes.hidden = true; setHTML(hsRes, ""); return; }
      var all = (DATA() || { files: [] }).files, out = [], i;
      for (i = 0; i < all.length && out.length < 12; i++) {
        var hit = searchHit(all[i], q);         // теперь ищем и в теле, со сниппетом и разделом
        if (hit) out.push({ f: all[i], hit: hit });
      }
      hsRes.hidden = false;
      setHTML(hsRes, out.length
        ? out.map(function (o) {
            var f = o.f, h = o.hit;
            return '<button class="cd-hs-item" data-rel="' + escapeHtml(f.rel) + '"><b>' + escapeHtml(f.title || f.name) + "</b>" +
              (h.sec ? '<span class="cd-hs-sec">' + escapeHtml(h.sec) + "</span>" : "") +
              '<span class="cd-hs-snip">' + h.snippet + "</span></button>";
          }).join("")
        : '<div class="cd-hs-empty">Ничего не нашлось</div>');
    }
    var qaFind = homeEl.querySelector(".cd-qa-find");
    if (qaFind && hsIn) qaFind.addEventListener("click", function () { hsIn.focus(); hsIn.select(); });
    var qaProg = homeEl.querySelector(".cd-qa-prog");
    if (qaProg) qaProg.addEventListener("click", function () { showProgress("map"); });
    var wkBtn = homeEl.querySelector(".cd-weekly");
    if (wkBtn) {
      wkBtn.addEventListener("click", function () { showProgress("weekly"); });
      wkBtn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showProgress("weekly"); } });
    }
    homeEl.querySelectorAll(".cd-weak-go").forEach(function (b) {
      b.addEventListener("click", function () { runWeakAction(b.getAttribute("data-wrel"), b.getAttribute("data-wk"), b.getAttribute("data-wx")); });
    });
    var qaGuide = homeEl.querySelector(".cd-qa-guide");
    if (qaGuide) qaGuide.addEventListener("click", function () { showGuide(); });
    if (hsIn && hsRes) {
      hsIn.addEventListener("input", hsRender);
      hsIn.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { var first = hsRes.querySelector(".cd-hs-item"); if (first) { searchJumpTerm = hsIn.value.trim(); openFile(first.getAttribute("data-rel")); } }
        else if (e.key === "Escape") { hsIn.value = ""; hsRender(); }
      });
      hsRes.addEventListener("click", function (e) {
        var it = e.target.closest && e.target.closest(".cd-hs-item");
        if (it) { searchJumpTerm = hsIn.value.trim(); openFile(it.getAttribute("data-rel")); }
      });
    }
  }
  // Главная в две колонки — когда области чтения хватает ширины (считаем по родителю: сама
  // главная при сборке может быть ещё скрыта).
  var homeWideLast = null;
  var homeBgEl = null;
  // Детерминированный «случайный» генератор от строки: звезда темы всегда на своём месте.
  function seededRand(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5; var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // #1 Звёздное небо прогресса: каждая тема — звезда. Изученные горят цветом раздела,
  // соседние изученные в разделе соединены линией-созвездием; следующая тема пульсирует.
  // Разделы — скопления у краёв (центр занят карточками), небо — за стеклянными карточками.
  var SKY_SPOTS = [[90, 110], [910, 110], [110, 330], [890, 320], [95, 520], [905, 520], [500, 40], [500, 565], [300, 80], [700, 560]];
  // Статичный пейзаж под палитру: файл extension/bg-<палитра>.webp (или bg-default.webp для
  // «Как в редакторе» и палитр без своей картинки). Читается с диска один раз на палитру;
  // в рантайм не встраивается — картинки по сотне-другой КБ.
  var _bgCache = {};
  function homeBgImage() {
    var d = DATA(), dir = (d && d.extDirUrl) || bootVal("extDirUrl");
    if (!dir) return null;
    var key = state.palette && PALETTES[state.palette] ? state.palette : "default";
    if (_bgCache[key] !== undefined) return _bgCache[key];
    var base = String(dir).replace(/\/+$/, "") + "/";
    var have = (d && Array.isArray(d.bgImages)) ? d.bgImages : [];   // какие bg-*.webp есть в расширении
    var name = have.indexOf("bg-" + key + ".webp") !== -1 ? "bg-" + key + ".webp" : (have.indexOf("bg-default.webp") !== -1 ? "bg-default.webp" : "");
    _bgCache[key] = name ? resUrl(base + name) : null;
    return _bgCache[key];
  }
  function buildSky() {
    if (!homeBgEl) return;
    var mode = state.homeBg === "none" || state.homeBg === "stars" ? state.homeBg : "image";
    var img = mode === "image" ? homeBgImage() : null;
    homeBgEl.classList.toggle("has-img", !!img);
    if (mode === "none" || img) {                   // пейзаж — без звёзд и пятен, чтобы не спорили
      setHTML(homeBgEl, img ? '<div class="cd-homebg-img" style="background-image:url(' + img + ')"></div><div class="cd-homebg-veil"></div>' : "");
      return;
    }
    var html = '<div class="cd-aur a1"></div><div class="cd-aur a2"></div><div class="cd-aur a3"></div>';
    var d = DATA();
    if (d && d.files.length) {
      var nxt = nextUnread(), lines = "", stars = "";
      groupsFromData().forEach(function (g, gi) {
        var c = SKY_SPOTS[gi % SKY_SPOTS.length], rnd = seededRand(g.label), prev = null;
        var col = g.color || "var(--ac)", n = g.items.length;
        g.items.forEach(function (f, i) {
          var r2 = seededRand(f.rel);
          var ang = i / Math.max(1, n) * Math.PI * 2 + rnd() * 0.8, rad = 18 + r2() * (40 + n * 3.2);
          var x = Math.round(c[0] + Math.cos(ang) * rad * 1.25), y = Math.round(c[1] + Math.sin(ang) * rad * 0.9);
          var on = !!state.read[f.rel], isNext = nxt && nxt.rel === f.rel;
          if (on && prev) lines += '<line class="cd-st-line" x1="' + prev[0] + '" y1="' + prev[1] + '" x2="' + x + '" y2="' + y + '" style="stroke:' + col + '"/>';
          prev = on ? [x, y] : null;
          if (on) {
            stars += '<circle class="cd-st-glow" cx="' + x + '" cy="' + y + '" r="7" style="fill:' + col + '"/>' +
              '<circle class="cd-st on" cx="' + x + '" cy="' + y + '" r="2.3" style="fill:' + col + ";animation-delay:-" + (r2() * 5).toFixed(2) + 's"/>';
          } else if (isNext) {
            stars += '<circle class="cd-st-ring" cx="' + x + '" cy="' + y + '" r="5"/><circle class="cd-st next" cx="' + x + '" cy="' + y + '" r="2.4"/>';
          } else {
            stars += '<circle class="cd-st" cx="' + x + '" cy="' + y + '" r="1.5"/>';
          }
        });
      });
      // немного фоновой «пыли», чтобы небо не было пустым между скоплениями
      var dust = "", rd = seededRand("sky");
      for (var k = 0; k < 60; k++) dust += '<circle class="cd-st dust" cx="' + Math.round(rd() * 1000) + '" cy="' + Math.round(rd() * 600) + '" r="' + (0.6 + rd() * 0.8).toFixed(1) + '"/>';
      html += '<svg class="cd-sky" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">' + dust + lines + stars + "</svg>";
    }
    setHTML(homeBgEl, html);
  }
  function homeWide() {
    var host = homeEl && homeEl.parentNode;
    return !!(host && host.clientWidth >= 1180);
  }
  // #8 Живые цифры: при смене значений числа на плитках героя набегают от нуля, кольцо маскота
  // и полоски заполняются. Один раз на набор значений — повторный заход на главную не мельтешит.
  var homeCountKey = "";
  function homeCountUp() {
    if (!homeEl) return;
    var vals = homeEl.querySelectorAll(".cd-hero-stats .cd-dt-v"), key = "";
    vals.forEach(function (v) { key += v.textContent + "|"; });
    var ringFg = homeEl.querySelector(".cd-ring-fg");
    if (key === homeCountKey || state.noAnim || prefersReducedMotion()) { homeCountKey = key; return; }
    homeCountKey = key;
    if (ringFg) {
      var off = ringFg.style.strokeDashoffset; ringFg.style.strokeDashoffset = "289";
      requestAnimationFrame(function () { requestAnimationFrame(function () { ringFg.style.strokeDashoffset = off; }); });
    }
    vals.forEach(function (v) {
      var tpl = v.textContent, nums = tpl.match(/\d+/g); if (!nums) return;
      var t0 = null, dur = 750;
      function frame(ts) {
        if (!v.isConnected) return;
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3), i = 0;
        v.textContent = tpl.replace(/\d+/g, function () { return String(Math.round(+nums[i++] * e)); });
        if (k < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      // страховка: если кадры не шли (окно скрыто, вкладка в фоне) — итоговое значение всё равно встанет
      setTimeout(function () { if (v.isConnected) v.textContent = tpl; }, dur + 250);
    });
  }
  function showHome() {
    if (!homeEl || !winEl) return;
    if (reviewEl) reviewEl.hidden = true;   // выходим из режима повторения, если был
    winEl.classList.remove("reviewing");
    buildHome();
    homeEl.hidden = false;
    winEl.classList.add("home");
    if (secProgEl) secProgEl.hidden = true;
    winEl.classList.toggle("navhidden", navHiddenNow());
    homeEl.classList.remove("cd-in-anim"); void homeEl.offsetWidth; homeEl.classList.add("cd-in-anim");
    if (state.rolled) applyRoll();
    syncHead();
    syncReviewBell();
    homeEl.scrollTop = 0;
  }
  function hideHome() {
    if (!homeEl || !winEl) return;
    homeEl.hidden = true;
    if (reviewEl) reviewEl.hidden = true;
    winEl.classList.remove("home", "reviewing");
    winEl.classList.toggle("navhidden", navHiddenNow());
    applyResponsive();
  }
  // Список материалов: на главной по умолчанию виден, при чтении — скрыт (съедает место под текст).
  function navHiddenNow() {
    var home = winEl ? winEl.classList.contains("home") : false;
    return home ? !!state.navHiddenHome : !!state.navHidden;
  }

  // =================== Шапка окна: крошки, цвет раздела, «Дальше», карточки, редактор ===================
  // Клик по кнопке/крошке/меню в шапке — не перетаскивание и не «свернуть» двойным кликом.
  function headInteractive(t) {
    return !!(t && t.closest && t.closest("button, input, select, textarea, [role=button], .cd-viewmenu, .cd-edpop, .cd-rname, .cd-crumb"));
  }
  // Крошка «раздел»: показать список слева и раскрыть в нём этот раздел (остальные свернуть).
  function revealGroup(label) {
    if (!winEl || !label) return;
    if (navHiddenNow()) {
      if (winEl.classList.contains("home")) state.navHiddenHome = false; else state.navHidden = false;
      winEl.classList.remove("navhidden");
    }
    groupsFromData().forEach(function (g) { state.collapsed[g.label] = g.label !== label; });
    saveState();
    renderNav();
    applyResponsive();
    var sec = navListEl && navListEl.querySelector('.cd-group[data-group="' + cssEscape(label) + '"]');
    if (sec) { sec.scrollIntoView({ block: "start", behavior: "smooth" }); pulse(sec.querySelector(".cd-ghead") || sec); }
  }
  // Крошки + цвет шапки по разделу (#10) + кнопка «Дальше». Зовётся при смене экрана/темы.
  function syncHead() {
    if (!winEl || !titleEl) return;
    var reading = !!current && !winEl.classList.contains("home");
    var reviewing = winEl.classList.contains("reviewing");
    if (reading && current.group) {
      var gb = groupBadge(current.group);
      setHTML(groupCrumbEl, (gb ? '<img class="cd-cg-ic" src="' + gb + '" alt="" draggable="false">' : '<i class="cd-cg-dot"></i>') +
        '<span class="cd-cg-t">' + escapeHtml(current.group) + "</span>");
      groupCrumbEl.title = "Раздел «" + current.group + "» — показать в списке слева";
      groupCrumbEl.hidden = false;
    } else groupCrumbEl.hidden = true;
    if (!reading) {
      rnameEl.textContent = reviewing ? "Повторение карточек" : "Главная";
      rnameEl.removeAttribute("title");
      if (crumbEl.textContent) crumbEl.textContent = "";
      if (secProgEl) secProgEl.hidden = true;   // «0/8 ●●●» прошлого материала не должен висеть на главной и в повторении
    }
    // Цвет раздела: кромка и лёгкий тон шапки. На главной — обычный акцент.
    var col = reading && current.groupColor;
    if (col) { winEl.style.setProperty("--hcol", col); titleEl.style.setProperty("--gcolor", col); }
    else { winEl.style.removeProperty("--hcol"); titleEl.style.removeProperty("--gcolor"); }
    syncNextBtn();
    fitHead();
  }
  // Кольцо вокруг логотипа — общий прогресс «изучено» (#3).
  function syncLogoRing(done, total) {
    if (!logoEl) return;
    var pct = total ? Math.round((done / total) * 100) : 0;
    logoEl.style.setProperty("--lp", String(pct));
    logoEl.title = "Изучено " + done + " из " + total + " (" + pct + "%) · на главную";
    logoEl.setAttribute("aria-label", logoEl.title);
  }
  // «🎴 N» — карточки к повторению (#5). Клик: «Разминка дня», а если она сделана — всё, что ждёт.
  function syncReviewBell() {
    if (!revBellEl) return;
    var cc;
    try { cc = cardCounts(); } catch (e) { return; }
    var warm = !warmupDoneToday() && cc.total > 0;
    if (!cc.due && !cc.neu && !warm) { revBellEl.hidden = true; return; }
    revBellEl.hidden = false;
    var n = cc.due || (warm ? 0 : cc.neu);
    setHTML(revBellEl, '<span class="cd-hrev-ic" aria-hidden="true">' + emo("ui-cards", "🎴") + "</span>" +
      (n ? '<b class="cd-hrev-n">' + n + "</b>" : "") + (warm ? '<i class="cd-hrev-dot" aria-hidden="true"></i>' : ""));
    revBellEl.classList.toggle("due", cc.due > 0);
    var tip = warm ? "Разминка дня: " + Math.min(WARMUP_N, cc.total) + " карточек, около 2 минут" : "Повторить карточки";
    if (cc.due || cc.neu) tip += "\nК повторению: " + cc.due + (cc.neu ? " + " + cc.neu + " " + plural(cc.neu, ["новая", "новые", "новых"]) : "");
    revBellEl.title = tip;
    revBellEl.setAttribute("aria-label", tip.replace("\n", ". "));
  }
  // Раздел ## (режим «по разделам»), в котором лежит узел статьи; -1 — вне разделов.
  function secOf(node) {
    while (node && node.parentElement && node.parentElement !== articleEl) node = node.parentElement;
    return node && node.hasAttribute && node.hasAttribute("data-sec") ? +node.getAttribute("data-sec") : -1;
  }
  // Куда ведёт «Дальше» (#6): на главной — продолжить/следующий шаг; в задачнике — следующая
  // нерешённая задача ниже по тексту; иначе — следующая тема курса.
  function headNextTarget() {
    if (!winEl || winEl.classList.contains("reviewing")) return null;
    var d = DATA(); if (!d || !d.files.length) return null;
    if (winEl.classList.contains("home")) return null;   // на главной главное действие — карточка «Следующий шаг»
    if (!current) {
      var lastF = state.last ? lookupFile(state.last) : null;
      if (lastF && !state.read[lastF.rel]) return { f: lastF, label: "Продолжить", tip: "Продолжить чтение: " + (lastF.title || lastF.name) };
      var nF = nextUnread();
      if (nF) return { f: nF, label: "Следующий шаг", tip: "Следующая неизученная тема: " + (nF.title || nF.name) };
      return null;
    }
    if (articleEl && contentEl) {
      var tasks = articleEl.querySelectorAll("h2.cd-task:not(.cd-task-done)");
      if (tasks.length) {
        var cTop = contentEl.getBoundingClientRect().top, pick = null;
        for (var i = 0; i < tasks.length && !pick; i++) {
          var h = tasks[i];
          if (h.offsetParent) { if (h.getBoundingClientRect().top - cTop > 60) pick = h; }
          else if (secMode && secOf(h) > secIdx) pick = h;          // в следующем разделе (скрыт)
        }
        pick = pick || tasks[0];                                     // ниже нет — по кругу к первой
        var num = (pick.textContent.match(/^\s*(\d+(?:\.\d+)*)/) || [])[1];
        return { task: pick, label: num ? "Задача " + num : "Следующая задача", tip: "К следующей нерешённой задаче" };
      }
    }
    var idx = fileIndex(current.rel);
    var next = idx >= 0 && idx < d.files.length - 1 ? d.files[idx + 1] : null;
    return next ? { f: next, label: "Дальше", tip: "Следующая тема: " + (next.title || next.name) } : null;
  }
  function syncNextBtn() {
    if (!nextBtnEl) return;
    var t = headNextTarget();
    var was = nextBtnEl.hidden;
    if (!t) { nextBtnEl.hidden = true; if (!was) fitHead(); return; }
    nextBtnEl.hidden = false;
    var lab = nextBtnEl.querySelector(".cd-hnext-t");
    if (lab.textContent !== t.label) { lab.textContent = t.label; if (!was) fitHead(); }
    nextBtnEl.title = t.tip; nextBtnEl.setAttribute("aria-label", t.tip);
    if (was) fitHead();
  }
  function goHeadNext() {
    var t = headNextTarget(); if (!t) return;
    if (t.task) { unfoldContaining(t.task); t.task.scrollIntoView({ block: "start", behavior: "smooth" }); flashHeading(t.task); return; }
    if (t.f) openFile(t.f.rel);
  }

  // Связь с редактором (#9): какой C/C++-файл открыт, есть ли в нём ошибки, найден ли компилятор.
  // Данные приходят тем же файловым мостом, что и слово под курсором (payload.file / .cc / .off).
  function applyEditorEnv(p) {
    if (!edBtnEl) return;
    edEnv = p || {};
    var f = edEnv.file, off = !!edEnv.off;
    var st = off ? "off" : !f ? "none" : f.errs ? "err" : "ok";
    var sig = st + "|" + (f ? f.name + "|" + f.errs : "") + "|" + JSON.stringify(edEnv.cc === undefined ? "?" : edEnv.cc);
    if (edBtnEl.getAttribute("data-sig") === sig && !edBtnEl.hidden) return;   // опрос раз в секунду — без лишних перерисовок
    edBtnEl.setAttribute("data-sig", sig);
    edBtnEl.hidden = false;
    edBtnEl.className = "cd-hpill cd-hed " + st;
    edBtnEl.querySelector(".cd-hed-n").textContent = f ? f.name : (off ? "редактор" : "нет .cpp");
    edBtnEl.querySelector(".cd-hed-e").textContent = f && f.errs ? String(f.errs) : "";
    var tip = off ? "Связь с редактором выключена" : !f ? "C/C++-файл в редакторе не открыт" :
      f.name + (f.errs ? " — " + f.errs + " " + plural(f.errs, ["ошибка", "ошибки", "ошибок"]) : " — ошибок нет");
    edBtnEl.title = tip + " · подробнее"; edBtnEl.setAttribute("aria-label", tip);
    if (edPopEl && !edPopEl.hidden) renderEdPop();
    fitHead();
  }
  function renderEdPop() {
    if (!edPopEl) return;
    var p = edEnv || {}, f = p.file, d = DATA(), runOn = !!(d && d.run && d.run.enabled);
    var rows = [];
    function row(ic, cls, html) { rows.push('<div class="cd-ep-row ' + cls + '"><span class="cd-ep-ic">' + ic + "</span><div>" + html + "</div></div>"); }
    if (p.off) row("⏸", "muted", "Связь с редактором выключена. Включи настройку <code>cppDocs.editorBridge</code> — окно будет подсказывать по слову под курсором и объяснять ошибки.");
    else if (!f) row("📄", "muted", "Открой <b>.cpp</b>-файл в редакторе — окно подскажет по слову под курсором и объяснит ошибки простым языком.");
    else {
      row("📄", "", "<b>" + escapeHtml(f.name) + "</b>" + (f.lang ? ' <span class="cd-ep-sub">' + escapeHtml(f.lang) + "</span>" : ""));
      if (f.errs) row("⚠", "bad", f.errs + " " + plural(f.errs, ["ошибка", "ошибки", "ошибок"]) + (f.first && f.first.line ? " · первая — строка " + f.first.line : "") +
        (f.first ? '<button class="cd-ep-go" type="button" data-act="err">Разобрать ошибку</button>' : ""));
      else row("✓", "good", "Ошибок нет");
    }
    if (p.cc === undefined) row("⚙", "muted", "Ищу компилятор…");
    else if (p.cc) row("⚙", "good", "Компилятор: <b>" + escapeHtml(p.cc.name) + "</b>");
    else row("⚙", "bad", "Компилятор не найден — поставь g++ (MSYS2) или укажи путь в настройке <code>cppDocs.compiler</code>.");
    row("▶", runOn ? "good" : "muted", runOn ? "Запуск задач прямо в окне включён" : "Запуск задач в окне выключен (настройка <code>cppDocs.localRun</code>)");
    setHTML(edPopEl, '<div class="cd-ep-h">Связь с редактором</div>' + rows.join(""));
  }
  var edPopDocBound = false;
  function toggleEdPop(force) {
    if (!winEl || !edBtnEl) return;
    var open = force !== undefined ? force : !(edPopEl && !edPopEl.hidden);
    if (!open) { if (edPopEl) edPopEl.hidden = true; return; }
    if (!edPopEl || !winEl.contains(edPopEl)) {   // окно могли закрыть и собрать заново
      edPopEl = el("div", null); edPopEl.className = "cd-edpop"; edPopEl.hidden = true;
      edPopEl.setAttribute("role", "dialog"); edPopEl.setAttribute("aria-label", "Связь с редактором");
      edPopEl.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest(".cd-ep-go"); if (!b) return;
        e.stopPropagation();
        var diag = edEnv && edEnv.file && edEnv.file.first; if (!diag) return;
        toggleEdPop(false);
        var ex = explainCompileError(diag.msg), t = errorDocTarget(ex.h);
        if (t) openFile(t.rel, t.hash); else hideHome();
        showBridgeError(diag);
        bridgePin = lastEditorKey;   // не прятать плашку при следующем опросе, пока курсор не сдвинется
      });
      if (!edPopDocBound) {   // один слушатель на документ — не плодим при пересборке окна
        edPopDocBound = true;
        document.addEventListener("mousedown", function (e) {
          if (edPopEl && !edPopEl.hidden && !edPopEl.contains(e.target) && !(edBtnEl && edBtnEl.contains(e.target))) edPopEl.hidden = true;
        }, true);
      }
      winEl.querySelector(".cd-head").appendChild(edPopEl);
    }
    renderEdPop();
    edPopEl.hidden = false;
    // Под кнопкой, но не за правым краем окна.
    var hr = edPopEl.parentNode.getBoundingClientRect(), br = edBtnEl.getBoundingClientRect();
    edPopEl.style.left = Math.max(8, Math.min(br.left - hr.left, hr.width - edPopEl.offsetWidth - 8)) + "px";
  }

  // Шапка не должна наезжать сама на себя: если крошкам остаётся мало места, по шагам
  // прячем подписи (кнопки остаются — с подсказками при наведении).
  function fitHead() {
    if (!winEl || !titleEl || winEl.classList.contains("rolled")) return;
    var title = titleEl.parentNode;
    winEl.classList.remove("hc1", "hc2", "hc3", "hc4");
    // Порог шире для темы (раздел › тема › подраздел), чем для главной (одно слово).
    var need = current && !winEl.classList.contains("home") ? 280 : 160;
    for (var lvl = 1; lvl <= 3 && title.clientWidth < need; lvl++) winEl.classList.add("hc" + lvl);
    // Совсем узко и всё равно не влезает — прячем «🎴» и «редактор» (они есть и на главной),
    // чтобы кнопки окна (✕ в первую очередь) никогда не уезжали за край.
    var head = title.parentNode;
    if (head.scrollWidth > head.clientWidth + 1) winEl.classList.add("hc4");
  }

  // ------- «Обучение»: руководство по интерфейсу (официальный стиль) -------
  var guideEl = null;
  var GUIDE_TABS = [["s0", "Обзор"], ["s1", "Окно"], ["s2", "Список"], ["s3", "Чтение"], ["s4", "Настройки"], ["s5", "Интерактив"], ["s6", "Ещё"]];
  // Живые демо строим настоящим рендером — их можно трогать прямо в гайде (без записи в прогресс).
  function guidePage(sec, inner) { return '<div class="cd-guide-page" data-sec="' + sec + '"' + (sec === "s0" ? "" : " hidden") + '>' + inner + "</div>"; }
  function buildGuidePanel() {
    var demoLive = renderMarkdown("```live\n@N = 3 [1..10]\n---\nfor (int i = 1; i <= {N}; ++i)\n    std::cout << i * i << \" \";\n---\n{for i=1..N} {i*i}\n```", []);
    var demoSteps = renderMarkdown("```steps\nint x = 2;\nx = x * 3;\nx += 1;\n---\n1 | x=2 | Создали `x`.\n2 | x=6 | Сначала считается правая часть: 2 * 3, потом результат кладётся в `x`.\n3 | x=7 | `x += 1` — то же, что `x = x + 1`.\n```", []);
    var demoQuiz = renderMarkdown("```quiz\nВ: Что выведет `std::cout << 7 / 2;` ?\n+ 3\n- 3.5\n- 2\n= Оба операнда целые — дробная часть отбрасывается (целочисленное деление).\n```", []);
    var demoFill = renderMarkdown("```fillcode\nint sum = 0;\nfor (int i = 1; i [[<=]] n; ++i)\n    sum [[+=]] i;\n```", []);
    var chips = GUIDE_TABS.map(function (t, i) {
      return '<button class="cd-guide-chip' + (i === 0 ? " on" : "") + '" type="button" data-sec="' + t[0] + '">' + t[1] + "</button>";
    }).join("");
    var pages =
      guidePage("s0",
        "<p>Это интерактивное руководство. Листайте вкладки сверху и <b>пробуйте примеры прямо здесь</b>. Материалы открываются в плавающем окне поверх редактора и работают автономно, без подключения к сети.</p>" +
        '<div class="cd-guide-try-row">' +
        '<button class="cd-guide-try" data-act="sepia" type="button">🎨 Попробовать сепию</button>' +
        '<button class="cd-guide-try" data-act="settings" type="button">⚙ Открыть настройки</button>' +
        '<button class="cd-guide-try" data-act="search" type="button">⌕ Перейти к поиску</button>' +
        '<button class="cd-guide-try" data-act="tour" type="button">👋 Показать знакомство снова</button></div>' +
        '<p class="cd-guide-note">«Попробовать сепию» переключит тему прямо сейчас — руководство тоже сменит цвет. Нажмите ещё раз, чтобы вернуть.</p>') +
      guidePage("s1",
        "<h3>Плавающее окно</h3><ul>" +
        "<li><b>Перемещение</b> — удерживая левую кнопку мыши на заголовке окна.</li>" +
        "<li><b>Изменение размера</b> — за края и углы окна.</li>" +
        "<li><b>Половина экрана</b> и <b>во весь экран</b> — кнопки в шапке окна.</li>" +
        "<li><b>Разделение</b> — открыть второй материал рядом с текущим.</li>" +
        "<li><b>Закрытие</b> — кнопка «✕» или клавиша Esc. Положение и размер окна сохраняются между сеансами.</li></ul>") +
      guidePage("s2",
        "<h3>Список материалов (слева)</h3><ul>" +
        "<li><b>Поиск</b> вверху фильтрует материалы по названию и содержимому.</li>" +
        "<li><b>Фильтры</b>: «Всё», «Не изучено», «Закреплённое», «С заметками».</li>" +
        "<li>Разделы сворачиваются; у раздела показан прогресс изучения.</li>" +
        "<li>У пункта — кружок прогресса (○ / изучено) и звёздочка закрепления (★).</li>" +
        "<li><b>Правый клик</b> по пункту открывает меню: вкладка, разделение, закрепление, отметка об изучении.</li></ul>" +
        '<div class="cd-guide-try-row"><button class="cd-guide-try" data-act="search" type="button">⌕ Перейти к поиску</button></div>') +
      guidePage("s3",
        "<h3>Чтение материала</h3><ul>" +
        "<li><b>«Разделы»</b> — боковое оглавление следит за прокруткой; строка сверху показывает текущий раздел.</li>" +
        "<li><b>Кольцо прогресса</b> отражает долю прочитанного; <b>«Отметить изученным»</b> фиксирует материал как пройденный.</li>" +
        "<li><b>★</b> у заголовка добавляет раздел в закладки; <b>#</b> копирует ссылку на раздел.</li>" +
        "<li><b>«Найти» (⌕)</b> ищет по тексту материала; отдельная кнопка копирует материал целиком.</li>" +
        "<li>Стрелки <b>«назад/вперёд»</b> перемещают по истории; переход к предыдущему и следующему материалу — по кнопкам маршрута.</li></ul>") +
      guidePage("s4",
        "<h3>Настройки (⚙)</h3><ul>" +
        "<li>Размер шрифта, ширина колонки, межстрочный интервал.</li>" +
        "<li><b>Режим фокуса</b> скрывает список и оглавление, оставляя только текст.</li>" +
        "<li><b>Тема</b>: авто, светлая, тёмная, сепия.</li>" +
        "<li><b>«Разборы»</b> — режим «только основное» сворачивает пояснения под кодом.</li>" +
        "<li>Подсказки-термины, анимации, шрифт чтения.</li></ul>" +
        '<div class="cd-guide-try-row">' +
        '<button class="cd-guide-try" data-act="sepia" type="button">🎨 Попробовать сепию</button>' +
        '<button class="cd-guide-try" data-act="settings" type="button">⚙ Открыть настройки</button></div>') +
      guidePage("s5",
        "<h3>Интерактивные материалы</h3><p>Материалы содержат блоки, с которыми можно работать. Попробуйте прямо здесь:</p>" +
        '<p class="cd-guide-hint">Двигайте ползунок — код и вывод пересчитаются:</p><div class="cd-guide-demo cd-article">' + demoLive + "</div>" +
        '<p class="cd-guide-hint">Нажимайте «Шаг ▶» — стрелка пройдёт по программе, справа видны переменные:</p><div class="cd-guide-demo cd-article">' + demoSteps + "</div>" +
        '<p class="cd-guide-hint">Выберите ответ:</p><div class="cd-guide-demo cd-article">' + demoQuiz + "</div>" +
        '<p class="cd-guide-hint">Впишите пропущенное и нажмите «Проверить»:</p><div class="cd-guide-demo cd-article">' + demoFill + "</div>" +
        "<p>Ещё есть <b>карточки</b> с интервальным повторением, <b>ката</b> («собери код», «предскажи вывод», «напиши и запусти» — компиляция и проверка по тестам при включённой <code>cppDocs.localRun</code>) и блок <b>«Смотри также»</b> в конце материала.</p>" +
        '<div class="cd-guide-try-row">' +
        '<button class="cd-guide-try" data-act="live" type="button">▶ Открыть живой пример</button>' +
        '<button class="cd-guide-try" data-act="kata" type="button">🧩 Открыть ката</button>' +
        '<button class="cd-guide-try" data-act="steps" type="button">👣 Пройти код по шагам</button></div>') +
      guidePage("s6",
        "<h3>Связь с редактором</h3><p>При установке курсора на слово в файле C/C++ окно показывает краткую подсказку по этому слову и кнопку перехода к справочнику. Отключается настройкой <code>cppDocs.editorBridge</code>.</p>" +
        "<h3>Главный экран</h3><p>«Продолжить» открывает следующий неизученный материал; блок повторения предлагает карточки, готовые к повтору; «Быстрый доступ» и поиск ускоряют переход.</p>" +
        "<h3>Клавиатура</h3><p>Клавиша Esc последовательно закрывает: это руководство, затем поиск по материалу, затем окно.</p>");
    return '<div class="cd-guide-panel"><div class="cd-guide-top">' +
      '<div class="cd-guide-title">Обучение — как пользоваться</div>' +
      '<button class="cd-guide-close" type="button" title="Закрыть" aria-label="Закрыть">✕</button></div>' +
      '<div class="cd-guide-tabs">' + chips + "</div>" +
      '<div class="cd-guide-scroll">' + pages + "</div></div>";
  }
  function guideShowSection(sec) {
    if (!guideEl) return;
    guideEl.querySelectorAll(".cd-guide-chip").forEach(function (c) { c.classList.toggle("on", c.getAttribute("data-sec") === sec); });
    guideEl.querySelectorAll(".cd-guide-page").forEach(function (p) { p.hidden = p.getAttribute("data-sec") !== sec; });
    var sc = guideEl.querySelector(".cd-guide-scroll"); if (sc) sc.scrollTop = 0;
  }
  function guideAction(act) {
    if (act === "sepia") { state.theme = (state.theme === "sepia" ? "auto" : "sepia"); saveState(); applyThemeClasses(); applyAccent(); }
    else if (act === "settings") { hideGuide(); openSettings(); }
    else if (act === "tour") { hideGuide(); showHome(); setTimeout(startTour, 300); }
    else if (act === "search") { hideGuide(); if (searchInput) { try { searchInput.focus(); searchInput.select(); } catch (e) {} } }
    else if (act === "live" || act === "kata" || act === "steps") {
      var needle = act === "live" ? "```live" : act === "steps" ? "```steps" : "```challenge";
      var d = DATA();
      if (d && d.files) for (var i = 0; i < d.files.length; i++) {
        if ((d.files[i].md || "").indexOf(needle) >= 0) { hideGuide(); openFile(d.files[i].rel); return; }
      }
      hideGuide();
    }
  }
  function onGuideClick(e) {
    var t = e.target; if (!t) return;
    if (t === guideEl) { hideGuide(); return; }               // клик по затемнённому фону
    if (t.closest) {
      if (t.closest(".cd-guide-close")) { hideGuide(); return; }
      var chip = t.closest(".cd-guide-chip"); if (chip) { e.preventDefault(); guideShowSection(chip.getAttribute("data-sec")); return; }
      var tb = t.closest(".cd-guide-try"); if (tb) { e.preventDefault(); guideAction(tb.getAttribute("data-act")); return; }
      var te = t.closest(".cd-toed"); if (te) { sendToEditor(te); return; }
      var cp = t.closest(".copybtn"); if (cp) { doCopy(cp); return; }
    }
    quizClick(e);   // встроенные демо: квиз, «заполни пропуск» и т. п.
  }
  function showGuide() {
    if (!winEl) return;
    if (!guideEl) {
      guideEl = el("div", null); guideEl.className = "cd-guide"; guideEl.hidden = true;
      guideEl.setAttribute("role", "dialog"); guideEl.setAttribute("aria-label", "Обучение — как пользоваться");
      guideEl.addEventListener("click", onGuideClick);
      guideEl.addEventListener("input", onArticleInput);   // ползунки живых примеров внутри гайда
      winEl.appendChild(guideEl);
    }
    setHTML(guideEl, buildGuidePanel());   // пересобираем при каждом открытии — демо свежие, без следов
    guideShowSection("s0");
    guideEl.hidden = false;
  }
  function hideGuide() { if (guideEl) guideEl.hidden = true; }

