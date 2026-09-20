@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0window-diagnose.ps1" > "%~dp0otchet.txt" 2>&1
type "%~dp0otchet.txt"
echo.
echo   ==========================================================
echo   Отчёт также сохранён в файл  otchet.txt  (рядом с этим .bat).
echo   Откройте его, скопируйте ВЕСЬ текст и пришлите.
echo   ==========================================================
echo.
pause
