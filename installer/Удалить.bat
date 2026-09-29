@echo off
setlocal enableextensions
set "T=%~dp0tools\common.cmd"
call "%T%" init %*
title Удаление — Документация C++
call "%T%" header "Удаление расширения"

set "EXTID=moonlivedt.cpp-docs-panel"
set "MCID=moonlivedt.moon-core"
set "LOG=%TEMP%\cppdocs-uninstall.log"

call "%T%" step "1/3" "Ищу VS Code"
call "%T%" findcode
if errorlevel 1 (
  call "%T%" err "VS Code не найден — удалить через него не получится."
  call "%T%" info "Вручную: VS Code - Extensions - найти «Документация C++» - Uninstall."
  goto :fail
)
call "%T%" ok "Найден: %EDITOR%."

rem --- 2. Сначала окно: его снимает код расширения, поэтому — пока расширение на месте ---------
call "%T%" step "2/3" "Убираю плавающее окно из VS Code (если было)"
call "%T%" node remove
set "RC=%errorlevel%"
if "%RC%"=="5" set "RC=6"
if "%RC%"=="6" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\window-remove.ps1"
  call set "RC=%%errorlevel%%"
)
if "%RC%"=="3" (
  call "%T%" warn "Окно снять не вышло: нет прав на запись в VS Code."
  call "%T%" info "Ничего страшного - без расширения кнопка окна просто исчезнет сама."
)

rem --- 3. Само расширение --------------------------------------------------------------------
call "%T%" step "3/3" "Удаляю расширение"
set "HAD="
for /f "delims=" %%L in ('call "%CODE%" --list-extensions 2^>nul ^| findstr /i /x "%EXTID%"') do set "HAD=%%L"
if not defined HAD (
  call "%T%" ok "Расширение и так не установлено."
  goto :mooncore
)
call "%CODE%" --uninstall-extension %EXTID% >"%LOG%" 2>&1
set "LEFT="
for /f "delims=" %%L in ('call "%CODE%" --list-extensions 2^>nul ^| findstr /i /x "%EXTID%"') do set "LEFT=%%L"
if defined LEFT (
  call "%T%" err "Расширение всё ещё на месте. Ответ VS Code:"
  type "%LOG%"
  goto :fail
)
call "%T%" ok "Расширение удалено. Прогресс и заметки остаются - при повторной установке вернутся."

:mooncore
rem Moon Core ставится вместе с документацией, но может быть нужен и сам по себе — только по согласию.
set "MC="
for /f "delims=" %%L in ('call "%CODE%" --list-extensions 2^>nul ^| findstr /i /x "%MCID%"') do set "MC=%%L"
if not defined MC goto :done
call "%T%" ask "Удалить и Moon Core - оформление интерфейса VS Code?" 2
if errorlevel 2 goto :done
rem Его блок в оболочке снимает его же хук удаления — запускаем сразу, чтобы не ждать перезапуска.
call "%T%" node mooncore-remove
if errorlevel 1 call "%T%" warn "Блок Moon Core в VS Code снять не вышло - он снимется сам после перезапуска."
call "%CODE%" --uninstall-extension %MCID% >>"%LOG%" 2>&1
set "LEFT="
for /f "delims=" %%L in ('call "%CODE%" --list-extensions 2^>nul ^| findstr /i /x "%MCID%"') do set "LEFT=%%L"
if defined LEFT (
  call "%T%" warn "Moon Core удалить не вышло. Журнал: %LOG%"
) else (
  call "%T%" ok "Moon Core удалён."
)

:done
echo.
call "%T%" info "Перезапустите VS Code, чтобы значок пропал с панели."
call "%T%" finish 0
exit /b 0

:fail
call "%T%" finish 1
exit /b 1
