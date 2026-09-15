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

var ROOT = path.join(__dirname, "..");
var EXT = path.join(ROOT, "extension");
var DIST = path.join(ROOT, "dist");

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
  '  <Default Extension="vsixmanifest" ContentType="text/xml" />\n' +
  '  <Default Extension="xml" ContentType="text/xml" />\n' +
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

function main() {
  var pkg = JSON.parse(fs.readFileSync(path.join(EXT, "package.json"), "utf8"));

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

  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  var outName = pkg.name + "-" + pkg.version + ".vsix";
  var outPath = path.join(DIST, outName);
  fs.writeFileSync(outPath, makeZip(entries));

  console.log("Собран пакет: dist/" + outName);
  entries.forEach(function (e) {
    console.log("   " + e.name + "  (" + e.data.length + " Б)");
  });

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
    console.log("Готово. Дальше: «Developer: Reload Window» (или полный перезапуск VS Code).");
  }
}

main();
