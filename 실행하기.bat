@echo off
chcp 65001 > nul
echo ===================================================
echo   초고속 주식 뷰어 (FastAPI + Web) 시작 스크립트
echo ===================================================
echo.

echo [1/2] 기존에 실행 중인 동일 포트 프로세스 정리 중...
:: 8000 (백엔드), 8765 (프론트엔드) 포트를 사용하는 프로세스를 찾아 강제 종료 (오류 방지)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul

echo.
echo [2/2] 서버 2개 동시 구동 시작...

:: 백엔드 실행 (새 창)
start "Stock Backend API (FastAPI) - 이 창을 닫지 마세요" cmd /c "title Stock Backend API && echo [백엔드 API 서버 가동 중...] && python backend\main.py"

:: 프론트엔드 실행 (새 창)
start "Stock Frontend UI (Web) - 이 창을 닫지 마세요" cmd /c "title Stock Frontend UI && echo [프론트엔드 웹 서버 가동 중...] && cd frontend && python -m http.server 8765"

echo.
echo 완벽합니다! 서버가 켜질 때까지 3초 대기 후 인터넷 창을 자동으로 엽니다.
timeout /t 3 /nobreak > nul

:: 브라우저 자동 실행
start http://127.0.0.1:8765

echo.
echo 브라우저가 열렸습니다. (만약 안 열리면 주소창에 http://127.0.0.1:8765 입력)
echo 사용이 끝나면 열려 있는 검은색 터미널 창 2개를 꺼주세요.
pause
