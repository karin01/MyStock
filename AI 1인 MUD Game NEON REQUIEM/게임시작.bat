@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0게임시작.ps1"
if errorlevel 1 exit /b 1
exit /b 0
