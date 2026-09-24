@echo off
setlocal enableextensions
set "T=%~dp0tools\common.cmd"
call "%T%" init
title Плавающее окно — Документация C++
call "%T%" header "Плавающее окно: подключение"
call "%T%" info "Проще включить из самого VS Code: F1 - «Документация C++: подключить плавающее окно»."
call "%T%" info "Этот батник — запасной способ. Закройте VS Code перед запуском."
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\window-inject.ps1"
if errorlevel 1 (
  echo.
  call "%T%" err "Не получилось. Если написано про доступ на запись —"
  call "%T%" info "нажмите на батник правой кнопкой - «Запуск от имени администратора»."
  call "%T%" info "Если окно всё равно не появляется — запустите Диагностика.bat."
  call "%T%" finish 1
  exit /b 1
)
call "%T%" finish 0
exit /b 0
