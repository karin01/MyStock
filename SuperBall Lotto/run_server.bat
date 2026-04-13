@echo off
chcp 65001 >nul
title 로또 확률 번호 생성기 서버

cd /d "%~dp0"

echo.
echo [로또 확률 번호 생성기] 서버를 시작합니다.
echo 잠시 후 브라우저가 자동으로 열립니다: http://127.0.0.1:5000
echo 종료하려면 이 창에서 Ctrl+C 를 누르거나 창을 닫으세요.
echo.

start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5000'"
python server.py

if errorlevel 1 (
    echo.
    echo 오류가 발생했거나 서버가 종료되었습니다.
    pause
)
