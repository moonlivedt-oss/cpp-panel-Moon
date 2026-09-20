@echo off
chcp 866 >nul
setlocal enableextensions
title Установка: Документация C++

echo.
echo   ============================================
echo     Установка расширения "Документация C++"
echo   ============================================
echo.

set "VSIX=%~dp0cpp-docs-panel-3.1.0.vsix"

if not exist "%VSIX%" (
  echo   [ОШИБКА] Не найден файл расширения:
  echo   %VSIX%
  echo.
  echo   Держите этот .bat в одной папке с файлом .vsix
  goto :end
)

where code >nul 2>nul
if %errorlevel%==0 (
  call code --install-extension "%VSIX%" --force
  if %errorlevel%==0 goto :done
)

set "CODE1=%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd"
set "CODE2=%ProgramFiles%\Microsoft VS Code\bin\code.cmd"
set "CODE3=%ProgramFiles(x86)%\Microsoft VS Code\bin\code.cmd"

if exist "%CODE1%" ( call "%CODE1%" --install-extension "%VSIX%" --force & goto :done )
if exist "%CODE2%" ( call "%CODE2%" --install-extension "%VSIX%" --force & goto :done )
if exist "%CODE3%" ( call "%CODE3%" --install-extension "%VSIX%" --force & goto :done )

echo   [ОШИБКА] Не удалось найти VS Code (команду code).
echo.
echo   Установите VS Code, либо поставьте расширение вручную:
echo   VS Code  -  Extensions (Ctrl+Shift+X)  -  "..."  -  Install from VSIX...
goto :end

:done
echo.
echo   ---------------------------------------------
echo   ГОТОВО. Расширение установлено.
echo.
echo   Откройте (или перезапустите) VS Code и нажмите
echo   иконку книги слева - "Документация C++".
echo   Все материалы уже внутри, настройка не нужна.
echo   ---------------------------------------------

:end
echo.
pause