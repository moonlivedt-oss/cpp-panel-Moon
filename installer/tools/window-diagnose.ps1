# Диагностика плавающего окна «Документация C++». Только ЧТЕНИЕ, ничего не меняет.
# Выводит подробный отчёт — скопируйте его целиком и пришлите.
$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
function L($t) { Write-Host $t }
function Cnt($s, $sub) { if (-not $s) { return 0 }; return ([regex]::Matches($s, [regex]::Escape($sub))).Count }

$START = "<!-- CPPDOCS-WINDOW-START -->"
$END   = "<!-- CPPDOCS-WINDOW-END -->"

L "==================== ДИАГНОСТИКА ПЛАВАЮЩЕГО ОКНА ===================="
L ("Дата: " + (Get-Date))
L ("Пользователь: " + $env:USERNAME)
L ("PowerShell: " + $PSVersionTable.PSVersion.ToString())
L ""

# --- 1. VS Code ---
L "[1] VS Code"
$root = $null
$src = (Get-Command code -ErrorAction SilentlyContinue).Source
L ("  команда code: " + $(if ($src) { $src } else { "НЕ найдена в PATH" }))
if ($src -and $src.ToLower().EndsWith(".cmd")) {
  $cand = Split-Path -Parent (Split-Path -Parent $src)
  if (Test-Path (Join-Path $cand "Code.exe")) { $root = $cand }
}
if (-not $root) {
  foreach ($c in @(
    (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code"),
    (Join-Path $env:ProgramFiles "Microsoft VS Code"),
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft VS Code"))) {
    if ($c -and (Test-Path (Join-Path $c "Code.exe"))) { $root = $c; break }
  }
}
L ("  папка установки: " + $(if ($root) { $root } else { "НЕ НАЙДЕНА" }))
$ver = "?"
if ($root) {
  $prod = Get-ChildItem -Path $root -Recurse -Filter "product.json" -ErrorAction SilentlyContinue |
          Where-Object { $_.FullName -like "*resources\app\product.json" } | Select-Object -First 1
  if ($prod) {
    try { $pj = Get-Content -LiteralPath $prod.FullName -Raw | ConvertFrom-Json; $ver = $pj.version } catch {}
  }
}
L ("  версия VS Code: " + $ver)
L ""

# --- 2. Расширение ---
L "[2] Расширение cpp-docs-panel"
$extBase = Join-Path $env:USERPROFILE ".vscode\extensions"
$extDirs = @(Get-ChildItem -Path $extBase -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "*cpp-docs-panel*" })
if (-not $extDirs.Count) { L "  НЕ установлено (ни moonlivedt.*, ни local.*)" }
foreach ($d in $extDirs) {
  $rt = Join-Path $d.FullName "cpp-docs-runtime.js"
  $rtInfo = "рантайм НЕТ"
  if (Test-Path $rt) { $rtInfo = "рантайм " + [math]::Round((Get-Item $rt).Length/1KB) + " КБ" }
  L ("  " + $d.Name + "  | " + $rtInfo)
}
L ""

# --- 3. Файл данных окна ---
L "[3] Файл данных окна (globalStorage)"
$gs = Join-Path $env:APPDATA "Code\User\globalStorage"
$foundData = $false
foreach ($id in @("moonlivedt.cpp-docs-panel", "local.cpp-docs-panel")) {
  $p = Join-Path $gs (Join-Path $id "cpp-docs-data.js")
  if (Test-Path $p) {
    $foundData = $true
    $it = Get-Item $p
    $head = ""
    try { $head = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) } catch {}
    $filesCnt = "?"
    $m = [regex]::Match($head, '"files"\s*:\s*\[')
    if ($m.Success) {
      $mm = [regex]::Match($head, '"files":\[(\{)?')
      if ($head -match '"files":\[\]') { $filesCnt = "0 (ПУСТО!)" } else { $filesCnt = "есть материалы" }
    }
    L ("  " + $id + "  | " + [math]::Round($it.Length/1KB) + " КБ | изменён " + $it.LastWriteTime)
    L ("     начинается с window.__CPPDOCS__: " + ($head.StartsWith("window.__CPPDOCS__")))
    L ("     files: " + $filesCnt)
    L ("     сырой </script> внутри данных: " + (Cnt $head "</script>") + " (должно быть 0)")
  }
}
if (-not $foundData) { L "  cpp-docs-data.js НЕ найден. Откройте VS Code один раз, чтобы расширение его создало." }
L ""

# --- 4. Загрузчики (сторонние) ---
L "[4] Сторонние загрузчики (для справки)"
$be5 = @(Get-ChildItem -Path $extBase -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "be5invis.vscode-custom-css-*" })
$cus = @(Get-ChildItem -Path $extBase -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "subframe7536.custom-ui-style-*" })
L ("  Custom CSS and JS (be5invis): " + $(if ($be5.Count) { "установлен" } else { "нет" }))
L ("  Custom UI Style: " + $(if ($cus.Count) { "установлен" } else { "нет" }))
L ""

# --- 5. workbench.html ---
L "[5] Оболочка (workbench.html)"
if (-not $root) { L "  пропущено: не найдена установка VS Code" }
else {
  $wbFiles = @(Get-ChildItem -Path $root -Recurse -Filter "workbench.html" -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
  L ("  найдено файлов: " + $wbFiles.Count)
  foreach ($wb in $wbFiles) {
    $txt = ""
    try { $txt = [System.IO.File]::ReadAllText($wb, [System.Text.Encoding]::UTF8) } catch {}
    L ("  ---- " + $wb)
    L ("     наши маркеры START/END: " + (Cnt $txt $START) + " / " + (Cnt $txt $END))
    L ("     CSP-мета присутствует: " + ($txt -match '<meta\s+[^>]*Content-Security-Policy') + "  (если True И есть наш блок -> инлайн заблокирован!)")
    L ("     window.__CPPDOCS__ впечатан: " + ($txt.IndexOf("window.__CPPDOCS__") -ge 0))
    L ("     files:[] (пустые данные): " + ($txt.IndexOf('"files":[]') -ge 0))
    L ("     рантайм впечатан (__CPPDOCS_RUNTIME__): " + ($txt.IndexOf("__CPPDOCS_RUNTIME__") -ge 0))
    L ("     id пилюли (cppdocs-launch): " + ($txt.IndexOf("cppdocs-launch") -ge 0))
    if ($txt.IndexOf($START) -ge 0 -and $txt.IndexOf($END) -ge 0) {
      $blk = $txt.Substring($txt.IndexOf($START), $txt.IndexOf($END) - $txt.IndexOf($START))
      L ("     в нашем блоке закрывающих </script>: " + (Cnt $blk "</script>") + " (должно быть 2)")
    }
    L ("     маркеры загрузчиков (VSCODE-CUSTOM-CSS): " + (Cnt $txt "VSCODE-CUSTOM-CSS"))
    L ("     бэкап .cppdocs-backup рядом: " + (Test-Path ("$wb.cppdocs-backup")))
    # проверка доступа на запись
    $canWrite = $false
    try { $fsx = [System.IO.File]::Open($wb, 'Open', 'ReadWrite'); $fsx.Close(); $canWrite = $true } catch {}
    L ("     доступ на запись: " + $canWrite)
  }
}
L ""
L "==================== КОНЕЦ ОТЧЁТА ===================="
