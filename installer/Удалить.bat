@echo off
chcp 866 >nul
setlocal enableextensions
title Удаление: Документация C++

echo.
echo   ============================================
echo     Удаление расширения "Документация C++"
echo   ============================================
echo.

set "EXTID=moonlivedt.cpp-docs-panel"

where code >nul 2>nul
if %errorlevel%==0 (
  call code --uninstall-extension %EXTID%
  if %errorlevel%==0 goto :done
)

set "CODE1=%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd"
set "CODE2=%ProgramFiles%\Microsoft VS Code\bin\code.cmd"
set "CODE3=%ProgramFiles(x86)%\Microsoft VS Code\bin\code.cmd"

if exist "%CODE1%" ( call "%CODE1%" --uninstall-extension %EXTID% & goto :done )
if exist "%CODE2%" ( call "%CODE2%" --uninstall-extension %EXTID% & goto :done )
if exist "%CODE3%" ( call "%CODE3%" --uninstall-extension %EXTID% & goto :done )

echo   [ОШИБКА] Не удалось найти VS Code (команду code).
echo.
echo   Удалите расширение вручную:
echo   VS Code  -  Extensions (Ctrl+Shift+X)  -  найдите "Документация C++"  -  Uninstall
goto :end

:done
echo.
echo   ---------------------------------------------
echo   ГОТОВО. Расширение удалено.
echo   Перезапустите VS Code, чтобы изменения вступили в силу.
echo   ---------------------------------------------

:end
echo.
pause