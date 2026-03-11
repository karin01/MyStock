@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ===================================================
echo   주식 뷰어 텔레그램 봇
echo ===================================================
echo.
echo .env 에서 TELEGRAM_BOT_TOKEN 을 읽어 봇을 실행합니다.
echo 봇이 켜진 동안 텔레그램에서 /top50, /search 삼성전자 등으로 조회하세요.
echo 종료: Ctrl+C
echo.

python telegram_bot.py
pause
