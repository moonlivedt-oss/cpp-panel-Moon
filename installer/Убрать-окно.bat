@echo off
setlocal enableextensions
set "T=%~dp0tools\common.cmd"
call "%T%" init %*
title Убрать окно — Документация C++
call "%T%" header "Плавающее окно: отключение"
call "%T%" info "Само расширение (боковая панель и окно во вкладке) останется."

call "%T%" step "1/2" "Ищу VS Code"
call "%T%" findcode
if errorlevel 1 (
  call "%T%" warn "VS Code не найден - попробую снять окно по стандартным путям."
  goto :fallback
)
call "%T%" ok "Найден: %EDITOR%."

call "%T%" step "2/2" "Убираю окно"
call "%T%" node remove
set "RC=%errorlevel%"
if "%RC%"=="0" goto :ok
if "%RC%"=="3" goto :denied
if "%RC%"=="5" goto :fallback
if "%RC%"=="6" goto :fallback
goto :fail

:fallback
rem Расширения уже нет (или оно старое) — его кодом не воспользоваться. Запасной путь на
rem PowerShell: вырезает наш блок между маркерами и свои добавки в CSP, чужое не трогает.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\window-remove.ps1"
set "RC=%errorlevel%"
if "%RC%"=="0" goto :ok
if "%RC%"=="3" goto :denied
goto :fail

:ok
call "%T%" running
if errorlevel 1 goto :end
call "%T%" warn "VS Code открыт: окно пропадёт после полного перезапуска."
call "%T%" ask "Перезапустить VS Code сейчас? Несохранённое он сохранит сам, как при закрытии." 2
if errorlevel 2 goto :end
call "%T%" restart
if errorlevel 1 call "%T%" warn "VS Code не закрылся - закройте его сами и откройте снова."
goto :end

:denied
call "%T%" nowrite "%~f0"
call "%T%" info "Пока окно не снято, оно просто остаётся - работе VS Code это не мешает."
goto :fail

:end
call "%T%" finish 0
exit /b 0

:fail
call "%T%" finish 1
exit /b 1
