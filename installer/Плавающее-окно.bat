@echo off
setlocal enableextensions
set "T=%~dp0tools\common.cmd"
call "%T%" init %*
title Плавающее окно — Документация C++
call "%T%" header "Плавающее окно: подключение"
call "%T%" info "Проще включить из самого VS Code: F1 - «Документация C++: подключить плавающее окно»."
call "%T%" info "Этот батник делает то же самое снаружи - тем же кодом расширения."

call "%T%" step "1/2" "Ищу VS Code"
call "%T%" findcode
if errorlevel 1 (
  call "%T%" err "VS Code не найден. Сначала установите VS Code, потом Установить.bat."
  goto :fail
)
call "%T%" ok "Найден: %EDITOR%."

call "%T%" step "2/2" "Подключаю окно"
call "%T%" node inject
set "RC=%errorlevel%"
if "%RC%"=="0" goto :ok
if "%RC%"=="2" goto :nodata
if "%RC%"=="3" goto :denied
if "%RC%"=="4" goto :mooncore
if "%RC%"=="5" goto :noext
if "%RC%"=="6" goto :noext
call "%T%" info "Если окно всё равно не появляется - запустите Диагностика.bat."
goto :fail

:ok
echo.
call "%T%" info "Баннер «...installation appears to be corrupt» можно закрыть крестиком - это ожидаемо."
call "%T%" running
if errorlevel 1 (
  call "%T%" ok "Откройте VS Code и нажмите пилюлю «C++» справа внизу редактора."
  goto :end
)
call "%T%" warn "VS Code открыт: окно появится после ПОЛНОГО перезапуска (закрыть все окна VS Code)."
call "%T%" ask "Перезапустить VS Code сейчас? Несохранённое он сохранит сам, как при закрытии." 2
if errorlevel 2 goto :end
call "%T%" restart
if errorlevel 1 call "%T%" warn "VS Code не закрылся - закройте его сами и откройте снова."
goto :end

:nodata
call "%T%" info "Расширение создаёт данные окна при первом запуске VS Code."
call "%T%" running
if errorlevel 1 goto :nodata_open
call "%T%" info "VS Code открыт - перезапустите его, затем запустите этот батник снова."
goto :fail
:nodata_open
call "%T%" ask "Открыть VS Code сейчас? Потом закройте его и запустите этот батник ещё раз." 2
if errorlevel 2 goto :fail
start "" "%CODEEXE%"
goto :fail

:denied
call "%T%" nowrite "%~f0"
goto :fail

:mooncore
call "%T%" info "Moon Core сам встраивает окно документации - этот батник не нужен."
goto :end

:noext
call "%T%" info "Сначала запустите Установить.bat."
goto :fail

:end
call "%T%" finish 0
exit /b 0

:fail
call "%T%" finish 1
exit /b 1
