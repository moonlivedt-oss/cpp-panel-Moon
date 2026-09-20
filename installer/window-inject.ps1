# Плавающее окно «Документация C++» — прямой инъектор в оболочку VS Code.
# Без сторонних загрузчиков: сам впечатывает данные + рантайм в workbench.html,
# вооружает CSP-мету одноразовым nonce (НЕ снимает её целиком — иначе ослабла бы защита
# всей оболочки), как это делает extension.js (armCspWithNonce), и патчит ВСЕ найденные
# workbench.html (в новых VS Code их бывает два: electron-browser и electron-sandbox).
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$START = "<!-- CPPDOCS-WINDOW-START -->"
$END   = "<!-- CPPDOCS-WINDOW-END -->"
function Line($t) { Write-Host $t }

Line ""
Line "  ============================================"
Line "    Плавающее окно: подключение"
Line "  ============================================"
Line ""

# 1) Папка установки VS Code (по Code.exe) и ВСЕ workbench.html
$root = $null
try {
  $src = (Get-Command code -ErrorAction SilentlyContinue).Source
  if ($src -and $src.ToLower().EndsWith(".cmd")) {
    $cand = Split-Path -Parent (Split-Path -Parent $src)
    if (Test-Path (Join-Path $cand "Code.exe")) { $root = $cand }
  }
} catch {}
if (-not $root) {
  foreach ($c in @(
    (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code"),
    (Join-Path $env:ProgramFiles "Microsoft VS Code"),
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft VS Code"))) {
    if ($c -and (Test-Path (Join-Path $c "Code.exe"))) { $root = $c; break }
  }
}
if (-not $root) { Line "  [ПРОВАЛ] Не найдена установка VS Code."; exit 1 }
$wbFiles = @(Get-ChildItem -Path $root -Recurse -Filter "workbench.html" -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
if (-not $wbFiles.Count) { Line "  [ПРОВАЛ] Не найден workbench.html в установке VS Code."; exit 1 }
Line ("  [OK] VS Code найден. workbench.html: " + $wbFiles.Count + " шт.")

# 2) Данные окна (создаёт расширение при запуске VS Code)
$gs = Join-Path $env:APPDATA "Code\User\globalStorage"
$data = $null; $stamp = $null
foreach ($id in @("moonlivedt.cpp-docs-panel", "local.cpp-docs-panel")) {
  $p = Join-Path $gs (Join-Path $id "cpp-docs-data.js")
  if (Test-Path $p) { $data = $p; $stamp = Join-Path $gs (Join-Path $id "cpp-docs-stamp.js"); break }
}
if (-not $data) {
  Line "  [ПРОВАЛ] Файл данных ещё не создан."
  Line "           Откройте VS Code ОДИН раз (расширение создаст данные), закройте и запустите снова."
  exit 1
}
Line "  [OK] Данные найдены."

# 3) Рантайм (в папке установленного расширения)
$extDir = Get-ChildItem -Path (Join-Path $env:USERPROFILE ".vscode\extensions") -Directory -ErrorAction SilentlyContinue |
          Where-Object { $_.Name -like "moonlivedt.cpp-docs-panel-*" -or $_.Name -like "local.cpp-docs-panel-*" } |
          Sort-Object Name -Descending | Select-Object -First 1
if (-not $extDir) { Line "  [ПРОВАЛ] Расширение не установлено. Сначала запустите Установить.bat"; exit 1 }
$runtime = Join-Path $extDir.FullName "cpp-docs-runtime.js"
if (-not (Test-Path $runtime)) { Line "  [ПРОВАЛ] Не найден cpp-docs-runtime.js в папке расширения."; exit 1 }
Line "  [OK] Рантайм найден."

# 4) Собрать блок — как в расширении (extension.js buildWindowBlock): данные и рантайм ИНЛАЙНОМ.
#    Внешний <script src=file://> не годится: VS Code грузит workbench.html по схеме vscode-file://
#    и блокирует file://-скрипты. Экранируем </script в содержимом (иначе тег закроется раньше).
$nonce = -join ((1..24) | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })
$dataJs    = [System.IO.File]::ReadAllText($data, [System.Text.Encoding]::UTF8).Replace("</script", "<\/script")
$runtimeJs = [System.IO.File]::ReadAllText($runtime, [System.Text.Encoding]::UTF8).Replace("</script", "<\/script")
$nl = [Environment]::NewLine
$block = $START + $nl +
         "<script nonce=`"$nonce`">" + $nl + $dataJs + $nl + "</script>" + $nl +
         "<script nonce=`"$nonce`">" + $nl + $runtimeJs + $nl + "</script>" + $nl +
         $END + $nl
$reBlock = [regex]::Escape($START) + "[\s\S]*?" + [regex]::Escape($END)

# 5) Пропатчить каждый workbench.html
$utf8 = New-Object System.Text.UTF8Encoding($false)
$done = 0; $denied = $false
foreach ($wb in $wbFiles) {
  # Пишем только в настоящий workbench.html оболочки, не в случайный файл.
  if ($wb -notmatch '(?i)\\workbench\\workbench\.html$') { continue }
  try {
    $bak = "$wb.cppdocs-backup"
    $html = [System.IO.File]::ReadAllText($wb, [System.Text.Encoding]::UTF8)
    # Бэкап держим равным ОРИГИНАЛУ: если файл ещё не наш (нет маркера) — это чистая
    # оболочка (в т.ч. после обновления VS Code), обновляем бэкап под неё.
    if ($html.IndexOf($START) -lt 0) { Copy-Item -LiteralPath $wb -Destination $bak -Force }
    elseif (-not (Test-Path $bak)) { Copy-Item -LiteralPath $wb -Destination $bak -Force }
    # #2 Вооружить CSP-мету нашим nonce, а НЕ снимать её целиком (прежнее поведение ослабляло
    #    защиту всей оболочки от инъекции чужих скриптов). Зеркалит extension.js armCspWithNonce:
    #    есть script-src -> дописываем 'nonce-…' file:; нет script-src -> вставляем минимальную
    #    директиву в начало content=…; в style-src (если есть) — тот же nonce. Нет CSP-меты
    #    (свежие сборки VS Code) -> ничего не навязываем, инлайн-скрипты и так пройдут.
    $ic = [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    $mCsp = [regex]::Match($html, '<meta\s+[^>]*Content-Security-Policy[^>]*>', $ic)
    if ($mCsp.Success) {
      $meta = $mCsp.Value
      if ([regex]::IsMatch($meta, 'script-src', $ic)) {
        $meta = [regex]::Replace($meta, '(script-src)([^;>"'']*)', ('$1$2 ''nonce-' + $nonce + ''' file:'), $ic)
      } else {
        $meta = [regex]::Replace($meta, '(content\s*=\s*)(["''])', ('$1$2script-src ''nonce-' + $nonce + ''' file:; '), $ic)
      }
      if ([regex]::IsMatch($meta, 'style-src', $ic)) {
        $meta = [regex]::Replace($meta, '(style-src)([^;>"'']*)', ('$1$2 ''nonce-' + $nonce + ''''), $ic)
      }
      $html = $html.Substring(0, $mCsp.Index) + $meta + $html.Substring($mCsp.Index + $mCsp.Length)
    }
    # убрать прежний наш блок (идемпотентность)
    $html = [regex]::Replace($html, $reBlock, "")
    $idx = $html.IndexOf("</head>")
    if ($idx -lt 0) { $idx = $html.IndexOf("</HEAD>") }
    if ($idx -lt 0) { continue }
    $html = $html.Substring(0, $idx) + $block + $html.Substring($idx)
    # Атомарная запись: временный файл + Move, чтобы обрыв не оставил оболочку недописанной
    # (иначе VS Code не запустится).
    $tmp = "$wb.cppdocs-tmp"
    [System.IO.File]::WriteAllText($tmp, $html, $utf8)
    Move-Item -LiteralPath $tmp -Destination $wb -Force
    $done++
  } catch {
    if ($_.Exception -is [System.UnauthorizedAccessException]) { $denied = $true }
    try { if (Test-Path "$wb.cppdocs-tmp") { Remove-Item -LiteralPath "$wb.cppdocs-tmp" -Force } } catch {}
  }
}

if ($done -lt 1) {
  if ($denied) {
    Line "  [ПРОВАЛ] Нет доступа на запись к workbench.html."
    Line "           Кликните правой кнопкой -> «Запуск от имени администратора»."
  } else { Line "  [ПРОВАЛ] Не удалось впечатать окно (не найден </head>)." }
  exit 1
}

Line ""
Line "  --------------------------------------------"
Line ("  ГОТОВО. Окно впечатано (файлов: " + $done + ").")
Line ""
Line "  1. Полностью закройте ВСЕ окна VS Code."
Line "  2. Откройте VS Code заново."
Line "  3. Нажмите пилюлю «C++» справа внизу редактора."
Line ""
Line "  Баннер «...installation appears to be corrupt» можно"
Line "  закрыть крестиком — это ожидаемо при патче."
Line "  --------------------------------------------"
