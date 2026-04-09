@echo off
cd /d "%~dp0"
title Stock Backend API
if not "%SKIP_TELEGRAM_RESTART%"=="1" (
    echo [run_backend] Telegram Bot also restarting...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$p = Get-CimInstance Win32_Process | Where-Object { ($_.Name -match 'python(\\.exe)?|py(\\.exe)?') -and $_.CommandLine -and ($_.CommandLine -like '*telegram_bot.py*') }; $p | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} }; $c = Get-NetTCPConnection -LocalPort 59777 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach($pid in $c){ try { Stop-Process -Id $pid -Force } catch {} }" >nul 2>nul
    start "Stock Telegram Bot" cmd /k run_telegram.bat
    timeout /t 1 /nobreak >nul
)
python backend\main.py
if errorlevel 1 py backend\main.py
pause
