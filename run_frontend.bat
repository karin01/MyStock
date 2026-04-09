@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Stock Frontend UI
cd frontend
python -m http.server 8765
if errorlevel 1 py -m http.server 8765
pause
