@echo off
setlocal enableextensions
set "T=%~dp0tools\common.cmd"
call "%T%" init
title Убрать окно — Документация C++
call "%T%" header "Плавающее окно: отключение"
call "%T%" info "Закройте VS Code перед запуском. Само расширение (боковая панель) останется."
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\window-remove.ps1"
if errorlevel 1 (
  echo.
  call "%T%" err "Не получилось. Если написано про доступ на запись —"
  call "%T%" info "нажмите на батник правой кнопкой - «Запуск от имени администратора»."
  call "%T%" finish 1
  exit /b 1
)
call "%T%" finish 0
exit /b 0
