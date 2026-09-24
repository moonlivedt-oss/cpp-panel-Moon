@echo off
rem ============================================================
rem  Общие кусочки для батников установщика «Документация C++».
rem  Вызов:  call "%~dp0tools\common.cmd" <команда> [аргументы]
rem
rem    init                 UTF-8 в консоли + цвета (переменные C_*)
rem    header "подпись"     рамка-заголовок окна
rem    step "1/3" "текст"   шаг процесса
rem    ok / err / warn / info "текст"   строка с цветным значком
rem    findcode             ищет VS Code; путь к code.cmd кладёт в CODE (нет — errorlevel 1)
rem    finish [код]         подпись «закройте окно» + пауза; возвращает код выхода
rem
rem  Без setlocal: переменные (C_*, CODE) должны остаться у вызвавшего батника.
rem  В текстах сообщений не используйте символы  < > | &  — cmd примет их за команды.
rem ============================================================
goto :%~1

:init
chcp 65001 >nul
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
cls
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
rem 1) code в PATH (ставится галочкой «Add to PATH» при установке VS Code)
for /f "delims=" %%p in ('where code.cmd 2^>nul') do if not defined CODE set "CODE=%%p"
if defined CODE exit /b 0
rem 2) стандартные папки установки: для одного пользователя и для всех
for %%p in (
  "%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd"
  "%ProgramFiles%\Microsoft VS Code\bin\code.cmd"
  "%ProgramFiles(x86)%\Microsoft VS Code\bin\code.cmd"
) do if not defined CODE if exist "%%~p" set "CODE=%%~p"
if defined CODE exit /b 0
exit /b 1

:finish
echo.
echo   %C_DIM%Нажмите любую клавишу, чтобы закрыть это окно…%C_0%
pause >nul
exit /b %~2
