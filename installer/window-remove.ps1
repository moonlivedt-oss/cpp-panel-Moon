# Плавающее окно «Документация C++» — снять инъекцию из ВСЕХ workbench.html.
# Если рядом есть бэкап (.cppdocs-backup) — восстанавливаем оболочку целиком
# (вернётся и CSP-мета); иначе просто вырезаем наш блок между маркерами.
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$START = "<!-- CPPDOCS-WINDOW-START -->"
$END   = "<!-- CPPDOCS-WINDOW-END -->"
function Line($t) { Write-Host $t }

Line ""
Line "  ============================================"
Line "    Плавающее окно: отключение"
Line "  ============================================"
Line ""

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

$reBlock = [regex]::Escape($START) + "[\s\S]*?" + [regex]::Escape($END)
$utf8 = New-Object System.Text.UTF8Encoding($false)
$done = 0; $denied = $false
foreach ($wb in $wbFiles) {
  if ($wb -notmatch '(?i)\\workbench\\workbench\.html$') { continue }
  try {
    $html = [System.IO.File]::ReadAllText($wb, [System.Text.Encoding]::UTF8)
    if ($html.IndexOf($START) -lt 0) { continue }
    $bak = "$wb.cppdocs-backup"
    if (Test-Path $bak) {
      Copy-Item -LiteralPath $bak -Destination $wb -Force   # полный оригинал (вернётся и CSP)
    } else {
      # Атомарная запись при вырезании блока — обрыв не должен оставить оболочку битой.
      $tmp = "$wb.cppdocs-tmp"
      [System.IO.File]::WriteAllText($tmp, [regex]::Replace($html, $reBlock, ""), $utf8)
      Move-Item -LiteralPath $tmp -Destination $wb -Force
    }
    $done++
  } catch {
    if ($_.Exception -is [System.UnauthorizedAccessException]) { $denied = $true }
    try { if (Test-Path "$wb.cppdocs-tmp") { Remove-Item -LiteralPath "$wb.cppdocs-tmp" -Force } } catch {}
  }
}

if ($done -lt 1) {
  if ($denied) { Line "  [ПРОВАЛ] Нет доступа на запись (нужен администратор)." }
  else { Line "  Инъекция не найдена — оболочка уже чистая." }
} else {
  Line ("  ГОТОВО. Окно убрано (файлов: " + $done + ").")
  Line "  Полностью закройте и откройте VS Code заново."
}
