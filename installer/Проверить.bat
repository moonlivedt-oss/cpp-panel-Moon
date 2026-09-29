@echo off
setlocal enableextensions
set "T=%~dp0tools\common.cmd"
call "%T%" init %*
title Проверка — Документация C++
call "%T%" header "Проверка установки"

set "EXTID=moonlivedt.cpp-docs-panel"
set "MCID=moonlivedt.moon-core"

call "%T%" step "1/4" "VS Code"
call "%T%" findcode
if errorlevel 1 (
  call "%T%" err "VS Code не найден. Сначала установите VS Code, потом Установить.bat."
  goto :fail
)
set "CODEVER="
for /f "delims=" %%V in ('call "%CODE%" --version 2^>nul') do if not defined CODEVER set "CODEVER=%%V"
call "%T%" ok "%EDITOR% найден, версия %CODEVER%."

call "%T%" step "2/4" "Расширение «Документация C++»"
set "GOT="
for /f "delims=" %%L in ('call "%CODE%" --list-extensions --show-versions 2^>nul ^| findstr /i /b "%EXTID%@"') do set "GOT=%%L"
if not defined GOT (
  call "%T%" err "Расширение не установлено. Запустите Установить.bat."
  goto :fail
)
set "INST=%GOT:*@=%"
call "%T%" ok "Установлено, версия %INST%."

rem Совпадает ли установленная версия с той, что лежит в папке?
rem Суффикс «-bez-reshenij» — вариант сборки, а не версия: VS Code его не показывает.
set "NEW="
for /f "delims=" %%F in ('dir /b /o:d "%~dp0cpp-docs-panel-*.vsix" 2^>nul') do set "NEW=%%~nF"
if defined NEW set "NEW=%NEW:cpp-docs-panel-=%"
if defined NEW set "NEW=%NEW:-bez-reshenij=%"
if defined NEW if not "%NEW%"=="%INST%" call "%T%" warn "В этой папке версия %NEW%, а установлена %INST% — запустите Установить.bat."

call "%T%" step "3/4" "Moon Core"
set "MC="
for /f "delims=" %%L in ('call "%CODE%" --list-extensions --show-versions 2^>nul ^| findstr /i /b "%MCID%@"') do set "MC=%%L"
if defined MC (
  call "%T%" ok "Установлен, версия %MC:*@=%. Плавающее окно встраивает он."
) else (
  call "%T%" info "Не установлен - это необязательно."
)

call "%T%" step "4/4" "Плавающее окно"
call "%T%" node status

echo.
echo   %C_OK%Всё готово.%C_0% Откройте VS Code и нажмите значок книги слева.
call "%T%" finish 0
exit /b 0

:fail
call "%T%" finish 1
exit /b 1
