@echo off
setlocal enableextensions
set "T=%~dp0tools\common.cmd"
call "%T%" init %*
title Диагностика — Документация C++
call "%T%" header "Диагностика плавающего окна"
call "%T%" info "Только читает и ничего не меняет на компьютере."
echo.

rem Отчёт — рядом с батником; если папка только для чтения (например, открыта прямо из архива) — во временную.
set "REPORT=%~dp0otchet.txt"
(echo.) >"%REPORT%" 2>nul || set "REPORT=%TEMP%\cppdocs-otchet.txt"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\window-diagnose.ps1" >"%REPORT%" 2>&1
rem Взгляд самого расширения (его код, та же логика, что у батников окна; видит и Insiders/VSCodium).
call "%T%" findcode
if errorlevel 1 goto :report
>>"%REPORT%" echo.
>>"%REPORT%" echo [6] Глазами расширения (%EDITOR%)
call "%T%" node status >>"%REPORT%" 2>&1
:report
>>"%REPORT%" echo.
>>"%REPORT%" echo ==================== КОНЕЦ ОТЧЁТА ====================
type "%REPORT%"

rem Копируем отчёт в буфер обмена (через PowerShell — он не портит кириллицу, в отличие от clip).
powershell -NoProfile -Command "Get-Content -Raw -Encoding UTF8 -LiteralPath $env:REPORT | Set-Clipboard" >nul 2>&1
set "CLIPPED=%errorlevel%"

echo.
echo   %C_ACC%╭──────────────────────────────────────────────────╮%C_0%
if "%CLIPPED%"=="0" echo   %C_ACC%│%C_0%  %C_OK%✔%C_0% Отчёт уже скопирован — просто вставьте его в сообщение.
echo   %C_ACC%│%C_0%  Файл отчёта: %C_DIM%%REPORT%%C_0%
echo   %C_ACC%╰──────────────────────────────────────────────────╯%C_0%
call "%T%" finish 0
exit /b 0
