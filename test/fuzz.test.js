"use strict";

// Fuzz-тест разметки окна: тысячи случайных и «злых» документов через настоящий renderMarkdown.
// Самописный парсер на регэкспах — ровно то место, куда ручные тесты не доходят. Проверяем:
//   • не падает и не зависает (катастрофический возврат в регэкспах);
//   • на выходе нет исполняемого: <script>, обработчиков on*=, javascript:-адресов;
//   • второй рубеж (setHTML → scrubHTML) вычищает то же самое из сырого злого HTML.
// Генератор детерминирован (сид): упавший случай воспроизводится. FUZZ_N=20000 — прогон подольше.

const { test } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { loadRuntime } = require(path.join(__dirname, "support", "runtime-env.js"));

const api = loadRuntime(null);
const N = +process.env.FUZZ_N || 2500;

function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const EVIL = [
  "<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "<svg onload=alert(1)>", "<a href=\"javascript:alert(1)\">x</a>",
  "[клик](javascript:alert(1))", "[клик](\u0001javascript:alert(1))", "[к](JaVaScRiPt:alert(1))", "![i](javascript:alert(1))",
  "![i](data:text/html,<script>alert(1)</script>)", "<iframe src=//evil>", "\"><script>x</script>", "'onmouseover='alert(1)",
  "<details open ontoggle=alert(1)>", "<math><mi xlink:href=\"javascript:alert(1)\">x</mi></math>", "<noscript><p title=\"</noscript><img src=x onerror=alert(1)>\">",
  "`<script>`", "**<b onclick=x>жирный</b>**", "<sub onclick=alert(1)>x</sub>", "&lt;script&gt;", "<SCRIPT SRC=//x></SCRIPT>",
];
const PIECES = [
  "# Заголовок", "## Раздел", "### Подраздел", "текст", "обычный абзац про `vector`", "**жирно**", "*курсив*", "~~зачёркнуто~~",
  "- пункт", "1. пункт", "> цитата", "> **Важно.** пример", "| a | b |", "|---|---|", "| `x` | [л](ref/01.md) |", "---",
  "[ссылка](ref/01-osnovy.md#раздел)", "[внешняя](https://example.com)", "<details><summary>Разбор</summary>", "</details>",
  "🟢 🔥 🔗", "[[пропуск]]", "\\`", "``", "`", "[", "](", "![", "<", ">", "&", " ", "\u0000", "\t", "ё Ё",
];
const FENCES = ["cpp", "bash", "quiz", "cards", "steps", "memory", "frames", "challenge", "diagram", "svg", "live", "tests", "hints", "boss", "checklist", "findbug", "fillcode", "badgood", "console", "snippets", "unknown"];

function genDoc(r) {
  const lines = [];
  const n = 1 + Math.floor(r() * 40);
  for (let i = 0; i < n; i++) {
    const p = r();
    if (p < 0.12) {
      const lang = FENCES[Math.floor(r() * FENCES.length)];
      const body = [];
      const m = 1 + Math.floor(r() * 8);
      for (let j = 0; j < m; j++) body.push(r() < 0.3 ? EVIL[Math.floor(r() * EVIL.length)] : r() < 0.15 ? "---" : PIECES[Math.floor(r() * PIECES.length)]);
      lines.push("```" + lang, ...body);
      if (r() < 0.9) lines.push("```");               // иногда — незакрытый блок
    } else if (p < 0.4) {
      lines.push(EVIL[Math.floor(r() * EVIL.length)]);
    } else {
      let ln = "";
      const k = 1 + Math.floor(r() * 4);
      for (let j = 0; j < k; j++) ln += (j ? " " : "") + PIECES[Math.floor(r() * PIECES.length)];
      if (r() < 0.1) ln = ln.repeat(50);               // длинные строки — проверка на зависание
      lines.push(ln);
    }
  }
  return lines.join("\n");
}

// Исполняемое в готовой разметке. Разбираем теги и атрибуты как браузер (значения в кавычках —
// это текст: экранированный «onerror=» внутри data-code опасности не несёт).
const BAD_TAGS = /^(script|iframe|object|embed|frame|frameset|base)$/i;
function decodeEnt(s) { return String(s).replace(/&#x([0-9a-f]+);?/gi, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);?/g, (m, d) => String.fromCharCode(+d)).replace(/&colon;/gi, ":").replace(/&amp;/g, "&"); }
const WS = /[\s\/]/;
// Простой линейный разбор тегов (без регэкспов с возвратами): имя тега, атрибуты, значения в кавычках.
function dangerIn(html) {
  const s = String(html), n = s.length;
  let i = 0;
  while ((i = s.indexOf("<", i)) !== -1) {
    const start = i++;
    if (!/[a-zA-Z]/.test(s[i] || "")) continue;
    let j = i;
    while (j < n && /[\w:-]/.test(s[j])) j++;
    const tag = s.slice(i, j), where = () => " … " + s.slice(Math.max(0, start - 40), start + 120);
    if (BAD_TAGS.test(tag)) return "тег <" + tag + ">" + where();
    i = j;
    for (;;) {                                   // атрибуты до «>»
      while (i < n && WS.test(s[i])) i++;
      if (i >= n || s[i] === ">") break;
      let k = i;
      while (k < n && !/[\s\/>=]/.test(s[k])) k++;
      const name = s.slice(i, k).toLowerCase();
      i = k;
      while (i < n && /\s/.test(s[i])) i++;
      let val = "";
      if (s[i] === "=") {
        i++;
        while (i < n && /\s/.test(s[i])) i++;
        if (s[i] === '"' || s[i] === "'") { const q = s[i]; const e = s.indexOf(q, i + 1); val = s.slice(i + 1, e < 0 ? n : e); i = e < 0 ? n : e + 1; }
        else { let e = i; while (e < n && !/[\s>]/.test(s[e])) e++; val = s.slice(i, e); i = e; }
      }
      if (!name) { i++; continue; }
      if (/^on/.test(name)) return "обработчик " + name + where();
      if (/^(href|src|xlink:href|action|formaction)$/.test(name) && /^[\u0000- ]*(javascript|vbscript)\s*:/i.test(decodeEnt(val))) return "javascript:-адрес" + where();
    }
  }
  return null;
}

test("Fuzz: renderMarkdown", async (t) => {
  const r = rng(20260926);
  let worst = 0, worstDoc = "";
  const failures = [];
  for (let i = 0; i < N; i++) {
    const doc = genDoc(r);
    const t0 = process.hrtime.bigint();
    let html;
    try { html = api.render(doc); } catch (e) { failures.push({ i, kind: "исключение: " + (e && e.message), doc }); continue; }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ms > worst) { worst = ms; worstDoc = doc; }
    const bad = dangerIn(String(html));
    if (bad) failures.push({ i, kind: bad, doc });
    if (failures.length >= 5) break;
  }
  await t.test("не падает и ничего не исполняет (" + N + " документов)", () => {
    if (failures.length) assert.fail(failures.map((f) => "#" + f.i + " " + f.kind + "\n--- документ ---\n" + f.doc.slice(0, 600)).join("\n\n"));
  });
  await t.test("не зависает: худший документ < 250 мс", () => {
    assert.ok(worst < 250, "худший: " + Math.round(worst) + " мс\n" + worstDoc.slice(0, 400));
  });
});

test("Fuzz: второй рубеж — scrubHTML в setHTML", async (t) => {
  const scrub = api._scrubHTML;
  await t.test("scrubHTML доступен", () => assert.equal(typeof scrub, "function"));
  const r = rng(7);
  for (let i = 0; i < 2000; i++) {
    let s = "";
    const k = 1 + Math.floor(r() * 6);
    for (let j = 0; j < k; j++) s += EVIL[Math.floor(r() * EVIL.length)] + (r() < 0.5 ? " текст " : "");
    // вложенные попытки обойти чистку: <scr<script>ipt>
    if (r() < 0.2) s = s.replace(/<script>/i, "<scr<script>ipt>");
    const out = scrub(s);
    const bad = dangerIn(out);
    if (bad) { await t.test("чистка #" + i, () => assert.fail(bad + "\nвход: " + s)); return; }
  }
  await t.test("2000 злых строк вычищены", () => assert.ok(true));
});
