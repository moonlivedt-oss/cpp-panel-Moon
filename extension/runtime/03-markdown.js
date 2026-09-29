  // ==== runtime/03-markdown.js — рендер Markdown → HTML ====
  function renderMarkdown(md, headings) {
    // U+2028/U+2029 — невидимые «разделители строк»: регэкспы с «.» на них спотыкаются (fuzz-тест
    // нашёл так бесконечный цикл в списке). В тексте они ничем не отличаются от пробела.
    var lines = String(md).replace(/\r\n?/g, "\n").replace(/[\u2028\u2029]/g, " ").split("\n");
    var out = [];
    var i = 0;
    var sawTitle = false;

    function listBlock(startIndent) {
      // Рекурсивный разбор списка по отступам. Возвращает HTML одного уровня.
      var html = "";
      var type = null; // "ul" | "ol"
      var items = [];
      while (i < lines.length) {
        var line = lines[i];
        if (!line.trim()) { // пустая строка — заглянем: продолжается ли список
          var j = i + 1;
          if (j < lines.length && /^(\s*)([-*+]|\d+[.)])\s+/.test(lines[j])) { i++; continue; }
          break;
        }
        var m = line.match(/^(\s*)([-*+]|\d+[.)])\s+([\s\S]*)$/);
        if (!m) break;
        var indent = m[1].length;
        if (indent < startIndent) break;
        if (indent > startIndent) { // вложенный список — соберём в последний пункт
          var sub = listBlock(indent);
          if (items.length) items[items.length - 1].sub += sub;
          continue;
        }
        var thisType = /\d/.test(m[2]) ? "ol" : "ul";
        if (!type) type = thisType;
        i++;
        items.push({ text: m[3], sub: "" });
      }
      // Есть ли среди пунктов чек-бокс «- [ ] …» — тогда весь список рисуем как список задач.
      var hasTask = items.some(function (it) { return /^\[[ xX]\]\s+/.test(it.text); });
      html += "<" + (type || "ul") + (hasTask ? ' class="cd-tasklist"' : "") + ">";
      items.forEach(function (it) {
        var tm = it.text.match(/^\[([ xX])\]\s+([\s\S]*)$/);
        if (tm) {
          // Состояние берём только из localStorage (как у ```checklist), чтобы отметки жили
          // между перезапусками; исходное [x] служит лишь визуальной подсказкой автора.
          var id = cdHash(tm[2]), on = !!state.checks[id];
          html += '<li class="cd-tl"><button class="cd-tl-box' + (on ? " on" : "") +
            '" type="button" data-id="' + id + '" role="checkbox" aria-checked="' + (on ? "true" : "false") +
            '" aria-label="Отметить пункт"></button><span class="cd-tl-txt' + (on ? " done" : "") + '">' +
            inline(tm[2]) + "</span>" + it.sub + "</li>";
        } else {
          html += "<li>" + inline(it.text) + it.sub + "</li>";
        }
      });
      html += "</" + (type || "ul") + ">";
      return html;
    }

    var lastI = -1, stuck = 0;
    while (i < lines.length) {
      var line = lines[i];
      // Страховка от зависания: если ни один разбор блока не сдвинул позицию (странная строка,
      // которую узнал один регэксп и не узнал другой), выводим её абзацем и идём дальше.
      if (i === lastI) { if (++stuck > 2) { out.push("<p>" + inline(line) + "</p>"); i++; stuck = 0; continue; } }
      else { stuck = 0; lastI = i; }

      if (!line.trim()) { i++; continue; } // пустые строки между блоками
      // Служебные метки для проверок и сборки (<!-- docs:no-compile -->, <!-- docs:solutions:start -->)
      // — HTML-комментарий на отдельной строке ученику не показываем (раньше печатался текстом).
      if (/^\s*<!--[\s\S]*?-->\s*$/.test(line)) { i++; continue; }

      // Код в ограждении ```lang … ``` (после языка можно указать подсветку строк: ```cpp {3,5-7})
      var fence = line.match(/^\s*```+\s*([\w+#-]*)\s*(\{[\d,\s-]*\})?\s*$/);
      if (fence) {
        var lang = fence[1] || "";
        var hlSet = parseHlLines(fence[2]);
        i++;
        var buf = [];
        while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++; // закрывающая ```
        var code = buf.join("\n");
        var lc = (lang || "").toLowerCase();
        if (lc === "quiz") { out.push(renderQuiz(code)); continue; }       // интерактивный опросник
        if (lc === "findbug") { out.push(renderFindbug(code)); continue; } // «найди ошибку» + ответ
        if (lc === "cards") { out.push(renderCards(code)); continue; }      // флеш-карточки
        if (lc === "fillcode") { out.push(renderFillcode(code)); continue; } // заполни пропуск
        if (lc === "tests") { out.push(renderTests(code)); continue; }      // тесты к задаче
        if (lc === "hints") { out.push(renderHintsLadder(code)); continue; } // лесенка подсказок задачника
        if (lc === "badgood") { out.push(renderBadgood(code)); continue; }  // было/стало в две колонки
        if (lc === "console") { out.push(renderConsole(code)); continue; }  // транскрипт консоли
        if (lc === "diagram" || lc === "svg") { out.push(renderDiagram(code)); continue; } // схема
        if (lc === "checklist") { out.push(renderChecklist(code)); continue; } // чек-лист «усвоено»
        if (lc === "snippets") { out.push(renderSnippets(code)); continue; }   // таблица «Быстрые слова»: клик по строке — код
        if (lc === "boss") { out.push(renderBoss(code)); continue; }        // босс темы: итоговый мини-проект
        if (lc === "quests") { out.push(renderQuestMap()); continue; }      // «Путь героя»: квесты «Подземелья» с прогрессом
        if (lc === "lootsim") { var ls = renderLootSim(code); if (ls) { out.push(ls); continue; } }  // симулятор сундуков
        if (lc === "bfsgrid") { var bg = renderBfsGrid(code); if (bg) { out.push(bg); continue; } }  // волна поиска пути на сетке
        if (lc === "steps") { var sp = renderSteps(code); if (sp) { out.push(sp); continue; } }  // пошаговый проигрыватель
        if (lc === "frames") { var fv = renderFrames(code); if (fv) { out.push(fv); continue; } }  // кадры: ASCII-анимация
        if (lc === "memory") { var mv = renderMemory(code); if (mv) { out.push(mv); continue; } }  // память по шагам: стек/куча/указатели
        if (lc === "live") { var lv = renderLive(code); if (lv) { out.push(lv); continue; } }  // живой пример: параметры-слайдеры
        if (lc === "challenge") { var ch = renderChallenge(code); if (ch) { out.push(ch); continue; } }  // ката: собери код / предскажи вывод
        if (lc === "checkpoint") { var cpt = renderCheckpoint(code); if (cpt) { out.push(cpt); continue; } }  // эталон главы + сравнение с моим кодом
        if (lc === "repeat") { out.push(renderRepeat(code)); continue; }      // «Повтори за мной»: код примера спрятан, видно поведение
        var LANG_LABEL = { cpp: "C++", "c++": "C++", cc: "C++", cxx: "C++", c: "C", bash: "Bash", sh: "Bash", shell: "Bash", txt: "текст", text: "текст", py: "Python" };
        var langLabel = escapeHtml(LANG_LABEL[(lang || "").toLowerCase()] || lang || "код");
        var codeHtml;
        if (hlSet) {                                    // построчная подсветка нужных строк
          codeHtml = code.split("\n").map(function (ln, idx) {
            return '<span class="cd-ln' + (hlSet[idx + 1] ? " cd-hl" : "") + '">' +
              (highlight(ln, lang) || "​") + "</span>";
          }).join("");
        } else {
          codeHtml = highlight(code, lang);
        }
        // Другие применения того же приёма: следом идут блоки «```cpp alt: Подпись» — они не печатаются
        // отдельно, а становятся слайдами этого примера (стрелки справа). Страница не растёт.
        var alts = [], j = i;
        for (;;) {
          var k = j;
          while (k < lines.length && !lines[k].trim()) k++;
          var am = k < lines.length ? lines[k].match(/^\s*```+\s*([\w+#-]*)\s+alt:?\s*(.*?)\s*$/) : null;
          if (!am) break;
          var ab = [];
          for (k++; k < lines.length && !/^\s*```+\s*$/.test(lines[k]); k++) ab.push(lines[k]);
          alts.push({ lang: am[1] || lang, label: am[2] || "Ещё применение", code: ab.join("\n") });
          j = k + 1;
        }
        if (alts.length) {
          i = j;
          out.push(renderCodeAlts({ lang: lang, code: code, html: codeHtml, lined: !!hlSet }, alts, langLabel, lc));
          continue;
        }
        out.push(
          '<div class="codewrap">' +
          '<div class="codehead"><span class="codelang">' + langLabel + "</span>" +
          '<span class="cd-codebtns">' + (TOED_LANGS[lc] ? toEditorBtn(code) : "") +
          '<button class="cd-wrapbtn" type="button" title="Переносить длинные строки (для всех блоков кода)">↩ перенос</button>' +
          '<button class="copybtn" type="button" title="Копировать код" data-code="' + escapeHtml(code) + '"><span class="cb-ic">⧉</span> копировать</button></span></div>' +
          '<pre class="code' + (hlSet ? " cd-lined" : "") + '"><code>' + codeHtml + "</code></pre></div>"
        );
        continue;
      }

      // Спойлер <details>…</details> (подсказки задачника). Рендерер экранирует сырой HTML,
      // поэтому разбираем блок сами: <summary> → заголовок, остальное → markdown рекурсивно.
      // Нативный <details> сам сворачивается по клику — JS не нужен.
      if (/^\s*<details\b/i.test(line)) {
        i++;                                   // строка <details ...>
        var dbuf = [], depth = 1;
        while (i < lines.length) {
          if (/^\s*<details\b/i.test(lines[i])) depth++;
          if (/^\s*<\/details>/i.test(lines[i])) { depth--; if (depth === 0) { i++; break; } }
          dbuf.push(lines[i]); i++;
        }
        var dinner = dbuf.join("\n");
        var dsummary = "Показать";
        dinner = dinner.replace(/<summary>([\s\S]*?)<\/summary>/i, function (_, s) { dsummary = s.trim(); return ""; });
        out.push('<details class="cd-spoiler"><summary>' + inline(dsummary) + "</summary>" +
          '<div class="cd-spoiler-body">' + renderMarkdown(dinner, null) + "</div></details>");
        continue;
      }

      // Заголовок
      var h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (h) {
        var level = h[1].length;
        var htext = h[2];
        var slug = slugify(htext);
        if (level === 1 && !sawTitle) { sawTitle = true; i++; continue; } // первый # — это имя файла, оно в шапке читалки
        if (headings && level >= 2 && level <= 3) headings.push({ level: level, text: htext.replace(/`/g, ""), slug: slug });
        else if (headings && level === 1) headings.push({ level: 2, major: true, text: htext.replace(/`/g, ""), slug: slug });   // большой раздел: «Решения с разбором»
        // data-title держит «чистый» текст заголовка (без кнопки «#»), чтобы хлебные крошки
        // и активный раздел читались из него, а не из textContent, куда попадает «#».
        var hclean = escapeHtml(htext.replace(/`/g, ""));
        out.push("<h" + level + ' id="' + slug + '" data-title="' + hclean + '">' + inline(htext) +
          '<button class="cd-hmark" type="button" tabindex="-1" title="Добавить раздел в закладки"' +
          ' aria-label="Добавить в закладки" aria-pressed="false" data-slug="' + slug + '">☆</button>' +
          '<button class="cd-hlink" type="button" tabindex="-1" title="Копировать ссылку на раздел"' +
          ' aria-label="Копировать ссылку на раздел" data-slug="' + slug + '">#</button>' +
          "</h" + level + ">");
        i++;
        continue;
      }

      // Горизонтальная линия
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

      // Цитата/врезка (может быть многострочной). Цвет врезки — по ведущему значку.
      if (/^\s*>/.test(line)) {
        var q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          q.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        var qtext = q.join("\n");
        var lead = qtext.replace(/^[\s>*_]+/, "");   // снять пробелы и разметку перед значком
        var nc = "", nbg = "";
        if (lead.indexOf("⚠") === 0) { nc = "#f9b47a"; nbg = "rgba(250,179,135,.12)"; }
        else if (lead.indexOf("✅") === 0) { nc = "#a6e3a1"; nbg = "rgba(166,227,161,.12)"; }
        else if (lead.indexOf("❌") === 0) { nc = "#f38ba8"; nbg = "rgba(243,139,168,.12)"; }
        else if (lead.indexOf("💡") === 0) { nc = "#f9e2af"; nbg = "rgba(249,226,175,.12)"; }
        else if (lead.indexOf("📖") === 0) { nc = "#89b4fa"; nbg = "rgba(137,180,250,.12)"; }   // определение
        var nic = "";
        if (!nc) {                                    // без эмодзи: цвет + иконка по полужирной метке в начале врезки
          var lm = qtext.match(/^\s*\*\*\s*([^*]+?)\s*\*\*/);
          if (lm) { var cc = calloutColorByLabel(lm[1]); if (cc) { nc = cc[0]; nbg = cc[1]; nic = cc[2] || ""; } }
        }
        var hasIc = nic && typeof CD_ICONS !== "undefined" && CD_ICONS[nic];
        var attrs = nc ? ' class="note' + (hasIc ? " has-ic" : "") + '" style="--nc:' + nc + ';--nbg:' + nbg + '"' : "";
        var icImg = hasIc ? '<img class="cd-note-ic" alt="" aria-hidden="true" src="' + CD_ICONS[nic] + '">' : "";
        out.push("<blockquote" + attrs + ">" + icImg + renderMarkdown(qtext, null) + "</blockquote>");
        continue;
      }

      // Таблица
      if (line.indexOf("|") >= 0 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        var header = tableCells(line);
        // Выравнивание колонок из строки-разделителя: :--- слева, :--: по центру, ---: справа.
        var aligns = tableCells(lines[i + 1]).map(function (s) {
          var t = s.trim(), l = t.charAt(0) === ":", r = t.charAt(t.length - 1) === ":";
          return r && l ? "center" : r ? "right" : l ? "left" : "";
        });
        var alignAttr = function (idx) { return aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : ""; };
        i += 2; // шапка + разделитель
        var rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].indexOf("|") >= 0) {
          rows.push(tableCells(lines[i])); i++;
        }
        var thtml = '<div class="tablewrap"><table><thead><tr>';
        header.forEach(function (c, ci) { thtml += "<th" + alignAttr(ci) + ">" + inline(c) + "</th>"; });
        thtml += "</tr></thead><tbody>";
        rows.forEach(function (r) {
          thtml += "<tr>";
          for (var c = 0; c < header.length; c++) thtml += "<td" + alignAttr(c) + ">" + inline(r[c] || "") + "</td>";
          thtml += "</tr>";
        });
        thtml += "</tbody></table></div>";
        out.push(thtml);
        continue;
      }

      // Список
      if (/^(\s*)([-*+]|\d+[.)])\s+/.test(line)) { out.push(listBlock(line.match(/^\s*/)[0].length)); continue; }

      // Абзац: копим строки до пустой или до начала другого блока
      var para = [];
      while (i < lines.length && lines[i].trim() &&
             !/^\s*```/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) &&
             !/^\s*>/.test(lines[i]) && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i]) &&
             !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i]) &&
             !(lines[i].indexOf("|") >= 0 && i + 1 < lines.length && isTableSep(lines[i + 1]))) {
        para.push(lines[i]); i++;
      }
      if (para.length) out.push("<p>" + inline(para.join(" ")) + "</p>");
    }
    return out.join("\n");
  }

