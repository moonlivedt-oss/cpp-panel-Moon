@echo off
setlocal enableextensions
set "T=%~dp0tools\common.cmd"
call "%T%" init
title Установка — Документация C++
call "%T%" header "Установка расширения"

set "EXTID=moonlivedt.cpp-docs-panel"
set "LOG=%TEMP%\cppdocs-install.log"

rem --- 1. Файл расширения: самый свежий cpp-docs-panel-*.vsix рядом с батником --------
call "%T%" step "1/3" "Ищу файл расширения"
set "VSIX="
for /f "delims=" %%F in ('dir /b /o:d "%~dp0cpp-docs-panel-*.vsix" 2^>nul') do set "VSIX=%~dp0%%F" & set "VER=%%~nF"
if not defined VSIX (
  call "%T%" err "Рядом нет файла cpp-docs-panel-*.vsix."
  call "%T%" info "Держите этот .bat в одной папке с файлом .vsix и запустите снова."
  goto :fail
)
set "VER=%VER:cpp-docs-panel-=%"
call "%T%" ok "Найден: cpp-docs-panel-%VER%.vsix"

rem --- 2. VS Code -------------------------------------------------------------------------
call "%T%" step "2/3" "Ищу VS Code"
call "%T%" findcode
if errorlevel 1 (
  call "%T%" err "VS Code не найден на этом компьютере."
  call "%T%" info "Установите VS Code: https://code.visualstudio.com"
  call "%T%" info "Или поставьте расширение вручную: VS Code - Extensions - ... - Install from VSIX"
  goto :fail
)
call "%T%" ok "VS Code найден."

rem --- 3. Установка + проверка, что расширение правда встало -----------------------------
call "%T%" step "3/3" "Устанавливаю расширение (несколько секунд)"
call "%CODE%" --install-extension "%VSIX%" --force >"%LOG%" 2>&1
rem errorlevel проверяем ВНЕ скобок: внутри блока %errorlevel% подставился бы заранее.
if errorlevel 1 goto :install_failed
set "GOT="
for /f "delims=" %%L in ('call "%CODE%" --list-extensions --show-versions 2^>nul ^| findstr /i /b "%EXTID%@"') do set "GOT=%%L"
if not defined GOT goto :install_failed
call "%T%" ok "Установлено: %GOT:*@=версия %"

echo.
echo   %C_OK%╭──────────────────────────────────────────────────╮%C_0%
echo   %C_OK%│%C_0%  %C_B%Готово!%C_0% Что дальше:
echo   %C_OK%│%C_0%   1. Откройте VS Code (если открыт — перезапустите).
echo   %C_OK%│%C_0%   2. Слева на панели — значок книги «Документация C++».
echo   %C_OK%│%C_0%  %C_DIM%Плавающее окно поверх кода — по желанию, см. Прочти-меня.txt%C_0%
echo   %C_OK%╰──────────────────────────────────────────────────╯%C_0%
call "%T%" finish 0
exit /b 0

:install_failed
call "%T%" err "VS Code не смог установить расширение. Его ответ:"
echo.
type "%LOG%"
echo.
call "%T%" info "Частая причина — VS Code открыт от администратора, а батник нет (или наоборот)."
call "%T%" info "Запасной путь: VS Code - Extensions - ... - Install from VSIX - выбрать .vsix из этой папки."

:fail
call "%T%" finish 1
exit /b 1
