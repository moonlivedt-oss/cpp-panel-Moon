# Плавающее окно «Документация C++» — снять инъекцию из ВСЕХ workbench.html.
# Вырезаем наш блок между маркерами и снимаем из CSP только СВОИ добавки (как wb-patch.js
# unpatchFile). Бэкап целиком НЕ возвращаем: он затёр бы то, что с тех пор дописали другие
# (Moon Core, обновление VS Code); из бэкапа берётся только CSP-мета, если её сняли целиком.
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$START = "<!-- CPPDOCS-WINDOW-START -->"
$END   = "<!-- CPPDOCS-WINDOW-END -->"
$IC = [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
$CSP_RE = '<meta\s+[^>]*Content-Security-Policy[^>]*>'
function Line($t) { Write-Host $t }

# Заголовок окна рисует батник (tools/common.cmd), здесь — только шаги.

# --- CSP: те же правила, что в wb-patch.js -------------------------------------------------
# Директива по имени целиком («script-src» не находится внутри «script-src-elem»):
# группа 1 — разделитель перед ней, 2 — имя, 3 — значение.
function DirectiveRe($name) { return '(^|[;"''\s])(' + $name + ')(?=[\s;"]|$)([^;>"]*)' }
function Splice($s, $m, $repl) { return $s.Substring(0, $m.Index) + $repl + $s.Substring($m.Index + $m.Length) }
# Дописать $add в конец значения директивы (перед хвостовыми пробелами).
function AppendToDirective($meta, $m, $add) {
  $v = $m.Groups[3].Value; $t = $v.TrimEnd()
  return Splice $meta $m ($m.Groups[1].Value + $m.Groups[2].Value + $t + $add + $v.Substring($t.Length))
}
# Снять наши прошлые добавки: «'nonce-…' file:» (и тот же nonce в style-src), мост, политику
# cppdocs и script-src, которую мы дописали сами. Чужие nonce (Moon Core, VS Code) не трогаем.
function StripOurNonces($meta) {
  $ids = @([regex]::Matches($meta, "'nonce-([A-Za-z0-9]+)' file:") | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
  foreach ($id in $ids) { $meta = $meta.Replace(" 'nonce-$id' file:", "").Replace(" 'nonce-$id'", "") }
  $meta = $meta.Replace(" http://127.0.0.1:*", "")
  $meta = [regex]::Replace($meta, ' cppdocs(?=[\s;"''])', '')
  $m = [regex]::Match($meta, '(content\s*=\s*)(["''])script-src([^;"]*);\s*', $IC)
  $dm = [regex]::Match($meta, (DirectiveRe 'default-src'), $IC)
  if ($m.Success) {
    $v = $m.Groups[3].Value.Trim()
    if (-not $v -or ($dm.Success -and $v -eq $dm.Groups[3].Value.Trim())) { $meta = Splice $meta $m ($m.Groups[1].Value + $m.Groups[2].Value) }
  }
  return $meta
}
function ArmCspWithNonce($html, $nonce) {
  $mm = [regex]::Match($html, $CSP_RE, $IC)
  if (-not $mm.Success) { return $html }          # нет CSP (свежие сборки) — ничего не навязываем
  $meta = StripOurNonces $mm.Value
  $add = " 'nonce-$nonce' file:"
  $sm = [regex]::Match($meta, (DirectiveRe 'script-src'), $IC)
  if ($sm.Success) { $meta = AppendToDirective $meta $sm $add }
  else {
    # Нет script-src — скрипты ограничивает default-src: новая script-src = его копия + наш nonce
    # (одиночный nonce отрезал бы скрипты самого VS Code). Нет и default-src — не ограничены.
    $dm = [regex]::Match($meta, (DirectiveRe 'default-src'), $IC)
    if ($dm.Success) {
      $cm = [regex]::Match($meta, '(content\s*=\s*)(["''])', $IC)
      if ($cm.Success) {
        $d = $dm.Groups[3].Value.Trim(); if ($d) { $d = " " + $d }
        $meta = Splice $meta $cm ($cm.Groups[1].Value + $cm.Groups[2].Value + "script-src" + $d + $add + "; ")
      }
    }
  }
  # style-src: где уже есть 'unsafe-inline', nonce НЕ ставим — он выключил бы 'unsafe-inline'
  # (CSP2+), и VS Code потерял бы свои инлайн-стили.
  $st = [regex]::Match($meta, (DirectiveRe 'style-src'), $IC)
  if ($st.Success -and $st.Groups[3].Value -notmatch "'unsafe-inline'") { $meta = AppendToDirective $meta $st " 'nonce-$nonce'" }
  # Мост на 127.0.0.1 и политика Trusted Types «cppdocs» (вся разметка окна идёт через неё).
  $cc = [regex]::Match($meta, '(connect-src)([^;>"]*)', $IC)
  if ($cc.Success) { $meta = Splice $meta $cc ($cc.Groups[1].Value + $cc.Groups[2].Value + " http://127.0.0.1:*") }
  $tt = [regex]::Match($meta, '((?:^|[\s;"''])trusted-types)(?=\s)([^;>"]*)', $IC)
  if ($tt.Success) { $meta = Splice $meta $tt ($tt.Groups[1].Value + $tt.Groups[2].Value + " cppdocs") }
  return Splice $html $mm $meta
}
# Вернуть CSP к виду без наших добавок. Мету из бэкапа целиком НЕ подставляем (в ней нет того,
# что с тех пор дописали другие, например Moon Core); бэкап нужен, только если CSP сняли целиком.
function RestoreCsp($html, $bak) {
  $mm = [regex]::Match($html, $CSP_RE, $IC)
  if ($mm.Success) { return Splice $html $mm (StripOurNonces $mm.Value) }
  if (-not (Test-Path -LiteralPath $bak)) { return $html }
  $orig = ""; try { $orig = [System.IO.File]::ReadAllText($bak, [System.Text.Encoding]::UTF8) } catch {}
  $om = [regex]::Match($orig, $CSP_RE, $IC)
  $idx = $html.IndexOf("</head>")
  if (-not $om.Success -or $idx -lt 0) { return $html }
  return $html.Substring(0, $idx) + $om.Value + "`n" + $html.Substring($idx)
}

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
# Пишем только в настоящий workbench.html оболочки (как extension.js), не в случайный файл.
$wbFiles = @(Get-ChildItem -Path $root -Recurse -Filter "workbench.html" -ErrorAction SilentlyContinue |
  ForEach-Object { $_.FullName } | Where-Object { $_ -match '(?i)\\electron-(browser|sandbox)\\workbench\\workbench\.html$' })
if (-not $wbFiles.Count) { Line "  [ПРОВАЛ] Не найден workbench.html в установке VS Code."; exit 1 }
Line ("  [OK] VS Code найден. workbench.html: " + $wbFiles.Count + " шт.")

$reBlock = [regex]::Escape($START) + "[\s\S]*?" + [regex]::Escape($END) + "\r?\n?"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$done = 0; $denied = $false
foreach ($wb in $wbFiles) {
  try {
    $html = [System.IO.File]::ReadAllText($wb, [System.Text.Encoding]::UTF8)
    if ($html.IndexOf($START) -lt 0) { continue }
    $next = RestoreCsp ([regex]::Replace($html, $reBlock, "")) "$wb.cppdocs-backup"
    # Атомарная запись — обрыв не должен оставить оболочку битой.
    $tmp = "$wb.cppdocs-tmp"
    [System.IO.File]::WriteAllText($tmp, $next, $utf8)
    Move-Item -LiteralPath $tmp -Destination $wb -Force
    $done++
  } catch {
    $e = $_.Exception
    while ($e) { if ($e -is [System.UnauthorizedAccessException]) { $denied = $true }; $e = $e.InnerException }
    try { if (Test-Path "$wb.cppdocs-tmp") { Remove-Item -LiteralPath "$wb.cppdocs-tmp" -Force } } catch {}
    if (-not $denied) { Line ("  [!] " + $wb + ": " + $_.Exception.Message) }
  }
}

if ($done -lt 1) {
  if ($denied) { Line "  [ПРОВАЛ] Нет доступа на запись в VS Code."; exit 3 }
  Line "  Инъекция не найдена — оболочка уже чистая."
} else {
  Line ("  ГОТОВО. Окно убрано (файлов: " + $done + ").")
  Line "  Полностью закройте и откройте VS Code заново."
}
exit 0
