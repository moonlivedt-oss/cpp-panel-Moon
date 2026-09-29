// ============================================================
//  Общий прогресс «изучено» для боковой панели и плавающего окна.
//
//  Окно хранит прогресс в localStorage оболочки и зеркалит его в cpp-docs-progress.json
//  (lib/progress.js). Боковая панель раньше вела свой список в globalState — и цифры «изучено»
//  в панели и в окне расходились. Теперь панель читает отметки окна из зеркала и пишет туда свои
//  ручные отметки; окно узнаёт об этом событием «progress» (метка savedAt новее — перечитать).
// ============================================================

const fs = require('fs');
const path = require('path');
const { progressFilePath } = require('./progress');

const FORMAT = 'cppdocs-progress';
const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
let _cache = { key: '', read: null };

function readMirror(context) {
  const file = progressFilePath(context);
  let st;
  try { st = fs.statSync(file); } catch (e) { return null; }
  let o;
  try { o = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
  if (!o || typeof o !== 'object' || o.format !== FORMAT || !o.state || typeof o.state !== 'object' || Array.isArray(o.state)) return null;
  if (BAD_KEYS.some((k) => Object.prototype.hasOwnProperty.call(o.state, k))) return null;
  return { file, st, doc: o };
}

/** rel-пути, отмеченные «изучено» в окне. Кэш по размеру и времени файла. */
function windowRead(context) {
  const m = readMirror(context);
  if (!m) return [];
  const key = m.st.size + ':' + m.st.mtimeMs;
  if (_cache.key === key && _cache.read) return _cache.read;
  const read = m.doc.state.read && typeof m.doc.state.read === 'object' ? m.doc.state.read : {};
  const out = Object.keys(read).filter((rel) => read[rel] && /\.md$/i.test(rel) && rel.split('/').indexOf('..') === -1);
  _cache = { key, read: out };
  return out;
}

/** Поставить/снять отметку «изучено» в зеркале окна. Метка savedAt растёт монотонно — окно
 *  с более старым прогрессом возьмёт его, а свежие правки окна не затрутся (их метка новее). */
function setWindowRead(context, rel, on) {
  if (!/\.md$/i.test(String(rel)) || String(rel).split('/').indexOf('..') !== -1) return false;
  return mutateRead(context, (read) => {
    if (!!read[rel] === !!on) return false;
    if (on) read[rel] = true; else delete read[rel];
    return true;
  });
}
function mutateRead(context, fn) {
  const m = readMirror(context);
  const doc = m ? m.doc : { format: FORMAT, version: 1, savedAt: 0, state: {} };
  const st = doc.state;
  if (!st.read || typeof st.read !== 'object' || Array.isArray(st.read)) st.read = {};
  if (!fn(st.read)) return false;
  const now = Math.max(Date.now(), (typeof doc.savedAt === 'number' ? doc.savedAt : 0) + 1, (typeof st._savedAt === 'number' ? st._savedAt : 0) + 1);
  st._savedAt = now; doc.savedAt = now;
  const file = progressFilePath(context);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.side.tmp';
  fs.writeFileSync(tmp, JSON.stringify(doc), 'utf8');
  fs.renameSync(tmp, file);
  _cache = { key: '', read: null };
  return true;
}

/** Снять все отметки «изучено» окна (кнопка «Сбросить прогресс» в панели). */
function clearWindowRead(context) {
  return mutateRead(context, (read) => {
    const keys = Object.keys(read);
    keys.forEach((k) => { delete read[k]; });
    return keys.length > 0;
  });
}

module.exports = { windowRead, setWindowRead, clearWindowRead };
