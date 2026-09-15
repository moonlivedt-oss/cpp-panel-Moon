#!/usr/bin/env node
// ============================================================
//  Сборка .vsix — установочного пакета расширения.
//
//  Зачем свой упаковщик. Обычно .vsix собирают через @vscode/vsce, но это тянет
//  npm-зависимости ради одной операции: .vsix — это обычный ZIP с двумя служебными
//  файлами в корне. Здесь ZIP пишется вручную поверх встроенного zlib, поэтому
//  у проекта ноль зависимостей и сборка работает сразу после клонирования.
//
//  Что кладётся в пакет:
//    extension.vsixmanifest   — метаданные для установщика VS Code
//    [Content_Types].xml      — обязательная часть формата OPC (иначе установка молча падает)
//    extension/…              — сам код расширения
//
//  Запуск:  npm run package            собрать dist/cpp-docs-panel-<версия>.vsix
//           npm run package -- --install   собрать и сразу поставить в VS Code
// ============================================================
"use strict";

var fs = require("fs");
var path = require("path");
var zlib = require("zlib");
var os = require("os");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var EXT = path.join(ROOT, "extension");
var DIST = path.join(ROOT, "dist");
var INDEX_FILE_NAME = "00-НАЧНИ-ОТСЮДА.md"; // индексный файл документации (для вшивания/проверки)

// ------------------------------------------------------------
//  Минимальный ZIP-writer.
//  Пишем только то, что нужно формату: локальный заголовок на каждый файл,
//  центральный каталог и хвост. Без шифрования, Zip64 и прочего — файлы тут
//  маленькие, а меньше кода означает меньше мест, где можно ошибиться.
// ------------------------------------------------------------

var CRC_TABLE = (function () {
  var table = new Int32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  var c = -1;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Дата/время в формате MS-DOS — так их хранит ZIP. */
function dosDateTime(date) {
  var time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() / 2)) & 0xffff;
  var day =
    (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { time: time, date: day };
}

function makeZip(entries) {
  var chunks = [];
  var central = [];
  var offset = 0;
  var stamp = dosDateTime(new Date());

  entries.forEach(function (entry) {
    var nameBuf = Buffer.from(entry.name, "utf8");
    var raw = entry.data;
    var deflated = zlib.deflateRawSync(raw, { level: 9 });
    // Если сжатие не помогло — кладём как есть (метод 0), так делает любой архиватор.
    var useStore = deflated.length >= raw.length;
    var body = useStore ? raw : deflated;
    var method = useStore ? 0 : 8;
    var crc = crc32(raw);

    var local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // сигнатура локального заголовка
    local.writeUInt16LE(20, 4); // нужна версия 2.0
    local.writeUInt16LE(0x0800, 6); // флаг: имена в UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBuf, body);

    var dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); // сигнатура записи каталога
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(stamp.time, 12);
    dir.writeUInt16LE(stamp.date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt16LE(0, 30);
    dir.writeUInt16LE(0, 32);
    dir.writeUInt16LE(0, 34);
    dir.writeUInt16LE(0, 36);
    dir.writeUInt32LE(0, 38);
    dir.writeUInt32LE(offset, 42);

    central.push(dir, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  });

  var centralBuf = Buffer.concat(central);
  var end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // сигнатура хвоста
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([Buffer.concat(chunks), centralBuf, end]);
}

// ------------------------------------------------------------
//  Служебные файлы пакета
// ------------------------------------------------------------

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildManifest(pkg) {
  return (
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">\n' +
    "  <Metadata>\n" +
    '    <Identity Language="en-US" Id="' +
    xmlEscape(pkg.name) +
    '" Version="' +
    xmlEscape(pkg.version) +
    '" Publisher="' +
    xmlEscape(pkg.publisher) +
    '" />\n' +
    "    <DisplayName>" +
    xmlEscape(pkg.displayName) +
    "</DisplayName>\n" +
    '    <Description xml:space="preserve">' +
    xmlEscape(pkg.description) +
    "</Description>\n" +
    "    <Tags>cpp,docs,panel</Tags>\n" +
    "    <Categories>Other</Categories>\n" +
    "    <GalleryFlags>Public</GalleryFlags>\n" +
    "    <Properties>\n" +
    '      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="' +
    xmlEscape(pkg.engines.vscode) +
    '" />\n' +
    '      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />\n' +
    '      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />\n' +
    '      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="ui,workspace" />\n' +
    "    </Properties>\n" +
    "  </Metadata>\n" +
    "  <Installation>\n" +
    '    <InstallationTarget Id="Microsoft.VisualStudio.Code" />\n' +
    "  </Installation>\n" +
    "  <Dependencies />\n" +
    "  <Assets>\n" +
    '    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />\n' +
    '    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />\n' +
    '    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE" Addressable="true" />\n' +
    '    <Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true" />\n' +
    "  </Assets>\n" +
    "</PackageManifest>\n"
  );
}

var CONTENT_TYPES =
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
  '  <Default Extension="json" ContentType="application/json" />\n' +
  '  <Default Extension="js" ContentType="application/javascript" />\n' +
  '  <Default Extension="svg" ContentType="image/svg+xml" />\n' +
  '  <Default Extension="md" ContentType="text/markdown" />\n' +
  '  <Default Extension="png" ContentType="image/png" />\n' +
  '  <Default Extension="cpp" ContentType="text/plain" />\n' +
  '  <Default Extension="txt" ContentType="text/plain" />\n' +
  '  <Default Extension="vsixmanifest" ContentType="text/xml" />\n' +
  '  <Default Extension="xml" ContentType="text/xml" />\n' +
  // LICENSE без расширения: в OPC у каждой части должен быть резолвимый content-type, а
  // Default работает только по расширению. Без явного Override парсер Marketplace не видит
  // часть и отклоняет ассет License («not found in the package»). Так же поступает vsce.
  '  <Override PartName="/extension/LICENSE" ContentType="text/plain" />\n' +
  "</Types>\n";

// ------------------------------------------------------------
//  Сборка
// ------------------------------------------------------------

/**
 * Папка сайдлоад-установки, из которой загрузчик (be5invis/custom-ui-style) читает
 * рантайм и куда прописана инъекция. ПЛОСКАЯ раскладка (файлы в корне), publisher='local'
 * — чтобы id расширения (=> globalStorage с данными) и путь импорта совпадали с тем,
 * что уже прописано в settings.json. Стандартный `code --install-extension` кладёт в
 * <publisher>.<name>-<ver> (moonlivedt.*), которую загрузчик НЕ читает.
 */
function devInstallDir(pkg) {
  return path.join(os.homedir(), ".vscode", "extensions", "local.cpp-docs-panel-" + pkg.version);
}

function fail(msg) {
  console.error("\n  ✗ Сборка остановлена: " + msg + "\n");
  process.exit(1);
}

/**
 * Предполётная проверка перед сборкой .vsix. Раньше упаковщик молча клал в архив что
 * угодно: пропал рантайм или иконка — получался пакет, который VS Code ставит, но
 * расширение не работает. Здесь ловим это заранее и с понятным сообщением, а не после
 * установки. Ничего не собираем, пока проверка не пройдена.
 */
function preflight(pkg) {
  // 1. Обязательные поля манифеста
  ["name", "version", "publisher", "main", "engines"].forEach(function (k) {
    if (!pkg[k]) fail("в extension/package.json нет поля «" + k + "»");
  });

  // 2. Обязательные файлы на диске (вход, рантайм, README из манифеста, иконки)
  var required = [pkg.main.replace(/^\.\//, ""), "cpp-docs-runtime.js", "README.md", pkg.icon];
  var ab = ((pkg.contributes || {}).viewsContainers || {}).activitybar;
  if (ab && ab[0] && ab[0].icon) required.push(ab[0].icon);
  required.forEach(function (rel) {
    if (rel && !fs.existsSync(path.join(EXT, rel))) fail("нет обязательного файла extension/" + rel);
  });

  // 3. Синтаксис JS (node --check) — не пакуем заведомо сломанный код
  ["extension.js", "cpp-docs-runtime.js"].forEach(function (name) {
    var full = path.join(EXT, name);
    if (!fs.existsSync(full)) return;
    try {
      cp.execFileSync(process.execPath, ["--check", full], { stdio: "pipe" });
    } catch (e) {
      fail("ошибка синтаксиса в extension/" + name + ":\n" + (e.stderr ? e.stderr.toString() : e.message));
    }
  });

  // 4. Версия расширения совпала с версией проекта (частая рассинхронизация — только предупреждаем)
  try {
    var rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    if (rootPkg.version && rootPkg.version !== pkg.version) {
      console.warn("  ! Версии разошлись: проект " + rootPkg.version + ", расширение " + pkg.version +
                   " — проверь, что обновил обе.");
    }
  } catch (e) { /* корневого package.json может не быть — не критично */ }

  // 5. Случайный файл данных окна (генерируется в globalStorage, в пакете ему не место)
  if (fs.existsSync(path.join(EXT, "cpp-docs-data.js"))) {
    console.warn("  ! В extension/ лежит cpp-docs-data.js — он генерируется автоматически, в пакет не нужен.");
  }

  // 6. Документация для вшивания на месте — иначе окно будет пустым у поставивших с Marketplace
  if (!fs.existsSync(path.join(ROOT, "docs", INDEX_FILE_NAME))) {
    fail("нет docs/" + INDEX_FILE_NAME + " — нечего вшивать в пакет (окно будет пустым)");
  }

  console.log("  ✓ Предполётная проверка пройдена");
}

/**
 * Файлы документации для вшивания в пакет (в `extension/docs`). Пропускаем dot-папки
 * (.git, .ruff_cache…), кэш Python, сам проверочный скрипт и `screenshots/` — в рантайме они
 * не нужны. Скриншоты нужны только README/витрине (~1.5 МБ), в .vsix им делать нечего.
 * Благодаря этому расширение показывает контент «из коробки», не таща лишний вес в установку.
 */
function bundledDocsFiles() {
  var docsRoot = path.join(ROOT, "docs");
  var out = [];
  if (!fs.existsSync(docsRoot)) return out;
  (function walk(dir) {
    fs.readdirSync(dir).forEach(function (name) {
      if (name[0] === "." || name === "__pycache__" || name === "proverka.py" || name === "screenshots") return;
      var full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else out.push({ full: full, rel: path.relative(docsRoot, full).replace(/\\/g, "/") });
    });
  })(docsRoot);
  return out;
}

function main() {
  var pkg = JSON.parse(fs.readFileSync(path.join(EXT, "package.json"), "utf8"));
  preflight(pkg);

  var entries = [
    { name: "extension.vsixmanifest", data: Buffer.from(buildManifest(pkg), "utf8") },
    { name: "[Content_Types].xml", data: Buffer.from(CONTENT_TYPES, "utf8") },
  ];

  fs.readdirSync(EXT)
    .filter(function (name) {
      return name !== ".vscodeignore";
    })
    .sort()
    .forEach(function (name) {
      var full = path.join(EXT, name);
      if (fs.statSync(full).isFile()) {
        entries.push({ name: "extension/" + name, data: fs.readFileSync(full) });
      }
    });

  // Вшиваем документацию в пакет (extension/docs) — расширение работает без своей папки docs.
  var docsFiles = bundledDocsFiles();
  docsFiles.forEach(function (d) {
    entries.push({ name: "extension/docs/" + d.rel, data: fs.readFileSync(d.full) });
  });

  // CHANGELOG из корня → в пакет (Marketplace показывает вкладку «Changelog»).
  var chLog = path.join(ROOT, "CHANGELOG.md");
  if (fs.existsSync(chLog)) entries.push({ name: "extension/CHANGELOG.md", data: fs.readFileSync(chLog) });

  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  var outName = pkg.name + "-" + pkg.version + ".vsix";
  var outPath = path.join(DIST, outName);
  fs.writeFileSync(outPath, makeZip(entries));

  console.log("Собран пакет: dist/" + outName);
  var docsBytes = 0;
  entries.forEach(function (e) {
    if (e.name.indexOf("extension/docs/") === 0) { docsBytes += e.data.length; return; }
    console.log("   " + e.name + "  (" + e.data.length + " Б)");
  });
  if (docsFiles.length) console.log("   extension/docs/  (" + docsFiles.length + " файлов, " + Math.round(docsBytes / 1024) + " КБ)");
  console.log("   ИТОГО: " + entries.length + " файлов, vsix " + Math.round(fs.statSync(outPath).size / 1024) + " КБ");

  if (process.argv.indexOf("--install") !== -1) {
    // Ставим НЕ через `code --install-extension` (он кладёт в moonlivedt.*, которую загрузчик
    // не читает), а плоской копией в папку сайдлоада local.cpp-docs-panel-<версия> — ту, что
    // прописана в инъекции settings.json. Так правки рантайма/расширения реально применяются.
    var dest = devInstallDir(pkg);
    console.log("\nСтавлю в: " + dest);
    fs.mkdirSync(dest, { recursive: true });
    // package.json с publisher='local' (id => globalStorage с данными), остальное из манифеста
    var localPkg = Object.assign({}, pkg, { publisher: "local" });
    fs.writeFileSync(path.join(dest, "package.json"), JSON.stringify(localPkg, null, 2) + "\n", "utf8");
    // остальные файлы расширения — плоско (рантайм и пр. должны лежать в КОРНЕ папки)
    fs.readdirSync(EXT)
      .filter(function (name) { return name !== "package.json" && name !== ".vscodeignore"; })
      .forEach(function (name) {
        var full = path.join(EXT, name);
        if (fs.statSync(full).isFile()) fs.copyFileSync(full, path.join(dest, name));
      });
    // и вшитую документацию (dest/docs) — тем же фильтром
    bundledDocsFiles().forEach(function (d) {
      var target = path.join(dest, "docs", d.rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(d.full, target);
    });
    console.log("\nГотово. ВАЖНО: одного «Reload Window» мало — загрузчик вшивает рантайм в");
    console.log("оболочку и держит старую копию. Переприменить загрузчик:");
    console.log("  • Custom CSS and JS (be5invis): команда «Reload Custom CSS and JS» → перезапуск;");
    console.log("  • Custom UI Style: команда «Custom UI Style: Reload».");
    console.log("Либо: «Документация C++: подключить плавающее окно» и подтвердить применение.");
  }
}

main();
