@echo off
setlocal enableextensions
set "T=%~dp0tools\common.cmd"
call "%T%" init %*
title Установка — Документация C++
call "%T%" header "Установка расширения"

set "EXTID=moonlivedt.cpp-docs-panel"
set "MCID=moonlivedt.moon-core"
set "LOG=%TEMP%\cppdocs-install.log"

rem --- 1. Файл расширения: самый свежий cpp-docs-panel-*.vsix рядом с батником --------
call "%T%" step "1/4" "Ищу файл расширения"
set "VSIX="
for /f "delims=" %%F in ('dir /b /o:d "%~dp0cpp-docs-panel-*.vsix" 2^>nul') do set "VSIX=%~dp0%%F" & set "VER=%%~nF"
if not defined VSIX (
  call "%T%" err "Рядом нет файла cpp-docs-panel-*.vsix."
  call "%T%" info "Держите этот .bat в одной папке с файлом .vsix и запустите снова."
  goto :fail
)
set "VER=%VER:cpp-docs-panel-=%"
call "%T%" ok "Найден: cpp-docs-panel-%VER%.vsix"

rem --- 2. Редактор ----------------------------------------------------------------------
call "%T%" step "2/4" "Ищу VS Code"
call "%T%" findcode
if errorlevel 1 (
  call "%T%" err "VS Code не найден на этом компьютере."
  call "%T%" info "Установите VS Code: https://code.visualstudio.com - вариант User Installer, он не просит прав администратора."
  call "%T%" info "Или поставьте расширение вручную: VS Code - Extensions - ... - Install from VSIX"
  goto :fail
)
call "%T%" ok "Найден: %EDITOR%."

rem --- 3. Установка + проверка, что расширение правда встало -----------------------------
call "%T%" step "3/4" "Устанавливаю расширение (несколько секунд)"
call "%CODE%" --install-extension "%VSIX%" --force >"%LOG%" 2>&1
rem errorlevel проверяем ВНЕ скобок: внутри блока %errorlevel% подставился бы заранее.
if errorlevel 1 goto :install_failed
set "GOT="
for /f "delims=" %%L in ('call "%CODE%" --list-extensions --show-versions 2^>nul ^| findstr /i /b "%EXTID%@"') do set "GOT=%%L"
if not defined GOT goto :install_failed
call "%T%" ok "Установлено: %GOT:*@=версия %"

rem Можно ли без администратора менять оболочку VS Code (нужно плавающему окну и Moon Core)?
set "SHELLRW=1"
call "%T%" node writable >nul 2>&1
if errorlevel 3 if not errorlevel 4 set "SHELLRW="

rem --- 4. Moon Core (если лежит рядом) ----------------------------------------------------
call "%T%" step "4/4" "Moon Core"
set "MCVSIX="
for /f "delims=" %%F in ('dir /b /o:d "%~dp0moon-core-*.vsix" 2^>nul') do set "MCVSIX=%~dp0%%F"
if not defined MCVSIX (
  call "%T%" info "В этой папке его нет - пропускаю."
  goto :done
)
call "%T%" info "Moon Core - оформление и настройка интерфейса VS Code мышкой."
call "%T%" info "С ним плавающее окно документации включается само, без отдельных шагов."
if defined SHELLRW (
  call "%T%" ask "Установить Moon Core?" 1
) else (
  call "%T%" warn "VS Code установлен для всех пользователей: без прав администратора Moon Core"
  call "%T%" info "не сможет встроиться в оболочку. Ставить его здесь смысла мало."
  call "%T%" ask "Всё равно установить Moon Core?" 2
)
if errorlevel 2 (
  call "%T%" info "Пропускаю. Поставить позже - запустите этот батник снова."
  goto :done
)
call "%CODE%" --install-extension "%MCVSIX%" --force >>"%LOG%" 2>&1
set "MCGOT="
for /f "delims=" %%L in ('call "%CODE%" --list-extensions --show-versions 2^>nul ^| findstr /i /b "%MCID%@"') do set "MCGOT=%%L"
if defined MCGOT (
  call "%T%" ok "Moon Core установлен: %MCGOT:*@=версия %"
) else (
  call "%T%" warn "Moon Core поставить не вышло - документация работает и без него. Журнал: %LOG%"
)

:done
echo.
echo   %C_OK%╭──────────────────────────────────────────────────╮%C_0%
echo   %C_OK%│%C_0%  %C_B%Готово!%C_0% Что дальше:
echo   %C_OK%│%C_0%   1. Откройте VS Code (если открыт — перезапустите).
echo   %C_OK%│%C_0%   2. Слева на панели — значок книги «Документация C++».
if defined SHELLRW (
  echo   %C_OK%│%C_0%  %C_DIM%Плавающее окно поверх кода VS Code предложит сам при первом запуске.%C_0%
) else (
  echo   %C_OK%│%C_0%  %C_DIM%Окно поверх кода здесь недоступно без администратора — открывайте%C_0%
  echo   %C_OK%│%C_0%  %C_DIM%его во вкладке: F1 - «Документация C++: открыть окно во вкладке».%C_0%
)
echo   %C_OK%╰──────────────────────────────────────────────────╯%C_0%

call "%T%" running
if not errorlevel 1 (
  call "%T%" warn "VS Code сейчас открыт - перезапустите его, чтобы всё подхватилось."
  goto :end
)
rem Первый запуск создаёт данные окна — после него работает и Плавающее-окно.bat.
call "%T%" ask "Открыть VS Code сейчас?" 2
if errorlevel 2 goto :end
start "" "%CODEEXE%"

:end
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
