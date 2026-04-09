@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Stock Telegram Bot
set PYTHONIOENCODING=utf-8
set BOT_SCRIPT=%~dp0telegram_bot.py
if not exist "%BOT_SCRIPT%" (
    echo ERROR: telegram_bot.py not found: "%BOT_SCRIPT%"
    pause
    exit /b 1
)
python -u "%BOT_SCRIPT%"
if errorlevel 1 py -u "%BOT_SCRIPT%"
pause
