@echo off
chcp 866 >nul
setlocal enableextensions
title Проверка: Документация C++

echo.
echo   ============================================
echo     Проверка установки "Документация C++"
echo   ============================================
echo.

set "LIST=%TEMP%\cppdocs_check.txt"
if exist "%LIST%" del "%LIST%" >nul 2>nul

where code >nul 2>nul
if %errorlevel%==0 (
  call code --list-extensions --show-versions > "%LIST%" 2>nul
  goto :have
)
set "CODE1=%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd"
set "CODE2=%ProgramFiles%\Microsoft VS Code\bin\code.cmd"
set "CODE3=%ProgramFiles(x86)%\Microsoft VS Code\bin\code.cmd"
if exist "%CODE1%" ( call "%CODE1%" --list-extensions --show-versions > "%LIST%" 2>nul & goto :have )
if exist "%CODE2%" ( call "%CODE2%" --list-extensions --show-versions > "%LIST%" 2>nul & goto :have )
if exist "%CODE3%" ( call "%CODE3%" --list-extensions --show-versions > "%LIST%" 2>nul & goto :have )

echo   [ПРОВАЛ] VS Code не найден на этом ПК.
echo            Сначала установите VS Code, затем запустите Установить.bat
goto :end

:have
echo   [OK] VS Code найден.
findstr /i "moonlivedt.cpp-docs-panel" "%LIST%" >nul
if %errorlevel%==0 (
  echo   [OK] Расширение установлено:
  findstr /i "moonlivedt.cpp-docs-panel" "%LIST%"
  echo.
  echo   ИТОГ: всё готово. Откройте VS Code и нажмите иконку книги слева.
) else (
  echo   [ПРОВАЛ] Расширение НЕ установлено.
  echo            Запустите Установить.bat, затем повторите проверку.
)
if exist "%LIST%" del "%LIST%" >nul 2>nul

:end
echo.
pause
