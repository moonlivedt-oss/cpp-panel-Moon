@echo off
rem ============================================================
rem  Общие кусочки для батников установщика «Документация C++».
rem  Вызов:  call "%~dp0tools\common.cmd" <команда> [аргументы]
rem
rem    init [аргументы батника]  UTF-8 в консоли + цвета (C_*); ключ /q — тихий режим (QUIET=1):
rem                              без пауз и вопросов (берётся ответ по умолчанию)
rem    header "подпись"     рамка-заголовок окна
rem    step "1/3" "текст"   шаг процесса
rem    ok / err / warn / info "текст"   строка с цветным значком
rem    findcode             ищет редактор: VS Code, VS Code Insiders, VSCodium (PATH, стандартные
rem                         папки, scoop). CODE — его code.cmd, CODEEXE — исполняемый файл,
rem                         EDITOR — название. Нет — errorlevel 1
rem    node <аргументы>     запустить tools\window.js редактором как Node (ELECTRON_RUN_AS_NODE);
rem                         возвращает код выхода скрипта
rem    running              errorlevel 0, если редактор сейчас открыт
rem    restart              закрыть редактор (как крестиком) и открыть снова; не закрылся — errorlevel 1
rem    ask "вопрос" 1|2     вопрос «1 — да, 2 — нет»; errorlevel 1 или 2 (в тихом режиме — умолчание)
rem    elevate "батник"     перезапустить батник от имени администратора (окно UAC);
rem                         errorlevel 1, если отказались или прав нет
rem    nowrite "батник"     нет прав на оболочку: окно во вкладке + по желанию перезапуск с правами
rem    finish [код]         подпись «закройте окно» + пауза; возвращает код выхода
rem
rem  Без setlocal: переменные (C_*, CODE, QUIET) должны остаться у вызвавшего батника.
rem  В текстах сообщений не используйте символы  < > | &  — cmd примет их за команды.
rem ============================================================
goto :%~1

:init
chcp 65001 >nul
set "QUIET="
for %%a in (%2 %3 %4 %5) do if /i "%%~a"=="/q" set "QUIET=1"
rem ESC-символ для цветов (ANSI). Windows 10/11 понимают их в обычной консоли.
for /f %%a in ('echo prompt $E^| cmd') do set "ESC=%%a"
set "C_0=%ESC%[0m"
set "C_B=%ESC%[1m"
set "C_DIM=%ESC%[90m"
set "C_OK=%ESC%[92m"
set "C_ERR=%ESC%[91m"
set "C_WARN=%ESC%[93m"
set "C_ACC=%ESC%[95m"
set "C_INFO=%ESC%[96m"
exit /b 0

:header
if not defined QUIET cls
echo.
echo   %C_ACC%╭──────────────────────────────────────────────────╮%C_0%
echo   %C_ACC%│%C_0%  %C_B%Документация C++%C_0%  %C_DIM%·%C_0%  %~2
echo   %C_ACC%╰──────────────────────────────────────────────────╯%C_0%
echo.
exit /b 0

:step
echo.
echo   %C_ACC%[%~2]%C_0% %C_B%%~3%C_0%
exit /b 0

:ok
echo         %C_OK%✔%C_0%  %~2
exit /b 0

:err
echo         %C_ERR%✖  %~2%C_0%
exit /b 0

:warn
echo         %C_WARN%!%C_0%  %~2
exit /b 0

:info
echo         %C_DIM%%~2%C_0%
exit /b 0

:findcode
set "CODE="
set "CODEEXE="
set "EDITOR="
rem 1) VS Code: команда code в PATH (галочка «Add to PATH»), стандартные папки, scoop.
rem    Кандидат годится, только если рядом есть Code.exe — так не подхватится чужой code.cmd
rem    (например, у Cursor он лежит в другом месте и Code.exe рядом нет).
for /f "delims=" %%p in ('where code.cmd 2^>nul') do if not defined CODE call :trycode "%%~p" "Code.exe" "VS Code"
for %%d in (
  "%LOCALAPPDATA%\Programs\Microsoft VS Code"
  "%ProgramFiles%\Microsoft VS Code"
  "%ProgramFiles(x86)%\Microsoft VS Code"
  "%USERPROFILE%\scoop\apps\vscode\current"
) do if not defined CODE call :trycode "%%~d\bin\code.cmd" "Code.exe" "VS Code"
rem 2) VS Code Insiders
for /f "delims=" %%p in ('where code-insiders.cmd 2^>nul') do if not defined CODE call :trycode "%%~p" "Code - Insiders.exe" "VS Code Insiders"
for %%d in (
  "%LOCALAPPDATA%\Programs\Microsoft VS Code Insiders"
  "%ProgramFiles%\Microsoft VS Code Insiders"
) do if not defined CODE call :trycode "%%~d\bin\code-insiders.cmd" "Code - Insiders.exe" "VS Code Insiders"
rem 3) VSCodium
for /f "delims=" %%p in ('where codium.cmd 2^>nul') do if not defined CODE call :trycode "%%~p" "VSCodium.exe" "VSCodium"
for %%d in (
  "%LOCALAPPDATA%\Programs\VSCodium"
  "%ProgramFiles%\VSCodium"
  "%USERPROFILE%\scoop\apps\vscodium\current"
) do if not defined CODE call :trycode "%%~d\bin\codium.cmd" "VSCodium.exe" "VSCodium"
if defined CODE exit /b 0
exit /b 1

:trycode
rem %1 — путь к code.cmd, %2 — имя exe уровнем выше, %3 — название редактора
if not exist "%~1" exit /b 0
if not exist "%~dp1..\%~2" exit /b 0
set "CODE=%~1"
for %%x in ("%~dp1..\%~2") do set "CODEEXE=%%~fx"
set "EDITOR=%~3"
exit /b 0

:node
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%CODEEXE%" "%~dp0window.js" %2 %3 %4
exit /b %errorlevel%

:running
for %%x in ("%CODEEXE%") do tasklist /fi "imagename eq %%~nxx" /nh 2>nul | find /i "%%~nxx" >nul
exit /b %errorlevel%

:restart
rem Закрыть редактор обычным способом (как крестиком: несохранённое VS Code держит сам) и
rem открыть снова. Ждём до 20 секунд; не закрылся (например, спросил про сохранение) — errorlevel 1.
for %%x in ("%CODEEXE%") do taskkill /im "%%~nxx" >nul 2>&1
set /a CPPDOCS_WAIT=0
:restart_wait
call :running
if errorlevel 1 goto :restart_start
set /a CPPDOCS_WAIT+=1
if %CPPDOCS_WAIT% geq 20 exit /b 1
ping -n 2 127.0.0.1 >nul
goto :restart_wait
:restart_start
start "" "%CODEEXE%"
exit /b 0

:ask
if defined QUIET exit /b %~3
echo.
echo         %C_B%%~2%C_0%
echo         %C_DIM%Нажмите 1 — да, 2 — нет.%C_0%
choice /c 12 /n >nul
exit /b %errorlevel%

:elevate
rem Путь к батнику передаём через переменную: кириллица и пробелы в аргументах PowerShell ломаются.
set "CPPDOCS_SELF=%~f2"
powershell -NoProfile -Command "try { Start-Process -FilePath $env:CPPDOCS_SELF -Verb RunAs -ErrorAction Stop; exit 0 } catch { if ($_.Exception.NativeErrorCode -eq 1223) { exit 1223 } else { exit 2 } }" >nul 2>&1
set "CPPDOCS_RC=%errorlevel%"
if "%CPPDOCS_RC%"=="0" exit /b 0
rem 1223 — нажали «Нет» в окне UAC: второй раз не спрашиваем.
if "%CPPDOCS_RC%"=="1223" exit /b 1
rem PowerShell запрещён политикой — просим права через Windows Script Host (ShellExecute «runas»).
set "CPPDOCS_JS=%TEMP%\cppdocs-runas.js"
>"%CPPDOCS_JS%" echo try { new ActiveXObject("Shell.Application").ShellExecute(WScript.Arguments(0), "", "", "runas", 1); } catch (e) { WScript.Quit(1); }
wscript //nologo //E:JScript "%CPPDOCS_JS%" "%CPPDOCS_SELF%" >nul 2>&1
set "CPPDOCS_RC=%errorlevel%"
del "%CPPDOCS_JS%" >nul 2>&1
exit /b %CPPDOCS_RC%

:nowrite
rem Нет прав на оболочку VS Code. Администратор нужен не всем и есть не у всех, поэтому главный
rem путь — окно во вкладке (оно оболочку не трогает); права администратора — только по желанию.
rem %2 — сам батник (для перезапуска с правами). errorlevel 0 — батник перезапущен с правами.
call "%T%" err "Нет прав на запись в VS Code: он установлен для всех пользователей."
call "%T%" info "Без прав администратора то же окно работает во вкладке VS Code:"
call "%T%" info "   F1 - «Документация C++: открыть окно во вкладке»."
call "%T%" info "Насовсем без администратора - переустановить VS Code вариантом User Installer"
call "%T%" info "(он ставится в папку пользователя; настройки и расширения останутся)."
net session >nul 2>&1
if not errorlevel 1 exit /b 1
call "%T%" ask "Если права администратора всё же есть - перезапустить батник с ними?" 2
if errorlevel 2 exit /b 1
call "%T%" elevate "%~2"
if errorlevel 1 goto :nowrite_no
call "%T%" info "Открылось отдельное окно с правами администратора - продолжение там."
exit /b 0
:nowrite_no
call "%T%" warn "Не вышло. Можно запустить этот батник правой кнопкой - Запуск от имени администратора, или пользоваться окном во вкладке."
exit /b 1

:finish
if defined QUIET exit /b %~2
echo.
echo   %C_DIM%Нажмите любую клавишу, чтобы закрыть это окно…%C_0%
pause >nul
exit /b %~2
