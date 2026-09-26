"use strict";

// Общий помощник тестов поверх встроенного node:test (без зависимостей).
//
// Тесты проекта исторически написаны как «проверки подряд»: check(имя, условие, подробности).
// Здесь каждая такая проверка становится отдельным тестом node:test — со стандартным отчётом,
// фильтром по имени (--test-name-pattern), параллельным запуском файлов и покрытием
// (--experimental-test-coverage). В конце файла — finish("Название группы").
//
// Запуск всех:  npm test    Один файл:  node --test test/style.test.js

const { test } = require("node:test");
const assert = require("node:assert");

const results = [];
let section = "";

/** Раздел — префикс имён следующих проверок (как заголовки в прежнем выводе). */
function group(name) { section = String(name || ""); }

function show(v) {
  try { return typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return String(v); }
}

/** Проверка: имя, условие, необязательные подробности (покажутся при провале). */
function check(name, cond, extra) {
  results.push({ name: (section ? section + " › " : "") + name, ok: !!cond, extra: extra });
  return !!cond;
}

/** Зарегистрировать все собранные проверки группой тестов. Звать один раз, в конце файла
 *  (или в конце асинхронного сценария). skipReason — вся группа пропущена (нет компилятора и т.п.). */
function finish(title, skipReason) {
  const list = results.splice(0);
  test(title, { skip: skipReason || false }, async (t) => {
    for (const r of list) {
      await t.test(r.name, () => {
        if (!r.ok) assert.fail(r.extra === undefined ? "условие не выполнено" : "подробности: " + show(r.extra).slice(0, 800));
      });
    }
  });
}

module.exports = { check, group, finish };
