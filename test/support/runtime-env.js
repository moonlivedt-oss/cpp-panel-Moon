"use strict";

// Поднять рантайм окна в Node под минимальным DOM-стабом (для замеров и тестов логики).
// document.readyState = "loading" — boot() откладывается, а window.__cppDocs уже готов.

const fs = require("fs");
const path = require("path");

function makeEl() {
  return {
    style: {}, dataset: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    appendChild(c) { this.children.push(c); return c; }, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    insertBefore(c) { this.children.push(c); return c; },
    innerHTML: "", textContent: "", id: "",
  };
}

/** Загрузить рантайм. data — window.__CPPDOCS__ (можно null). Возвращает window.__cppDocs. */
function loadRuntime(data) {
  global.document = {
    readyState: "loading", head: makeEl(), body: makeEl(), documentElement: makeEl(),
    createElement: makeEl, createTextNode: (t) => ({ textContent: t }),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  };
  global.window = {
    __CPPDOCS__: data || null, __CPPDOCS_BOOT__: null,
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }), navigator: { userAgent: "node" },
  };
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.getComputedStyle = () => ({ getPropertyValue: () => "" });
  global.MutationObserver = function () { return { observe() {}, disconnect() {} }; };
  const code = fs.readFileSync(path.join(__dirname, "..", "..", "extension", "cpp-docs-runtime.js"), "utf8");
  (0, eval)(code);
  return global.window.__cppDocs;
}

module.exports = { loadRuntime, makeEl };
