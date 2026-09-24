@echo off
setlocal enableextensions
set "T=%~dp0tools\common.cmd"
call "%T%" init
title Удаление — Документация C++
call "%T%" header "Удаление расширения"

set "EXTID=moonlivedt.cpp-docs-panel"
set "LOG=%TEMP%\cppdocs-uninstall.log"

call "%T%" step "1/2" "Ищу VS Code"
call "%T%" findcode
if errorlevel 1 (
  call "%T%" err "VS Code не найден — удалить через него не получится."
  call "%T%" info "Вручную: VS Code - Extensions - найти «Документация C++» - Uninstall."
  goto :fail
)
call "%T%" ok "VS Code найден."

call "%T%" step "2/2" "Удаляю расширение"
call "%CODE%" --uninstall-extension %EXTID% >"%LOG%" 2>&1
set "LEFT="
for /f "delims=" %%L in ('call "%CODE%" --list-extensions 2^>nul ^| findstr /i /x "%EXTID%"') do set "LEFT=%%L"
if defined LEFT (
  call "%T%" err "Расширение всё ещё на месте. Ответ VS Code:"
  type "%LOG%"
  goto :fail
)
call "%T%" ok "Расширение удалено."
call "%T%" info "Перезапустите VS Code, чтобы значок пропал с панели."
call "%T%" info "Если включали плавающее окно — сначала запустите Убрать-окно.bat."
call "%T%" finish 0
exit /b 0

:fail
call "%T%" finish 1
exit /b 1
