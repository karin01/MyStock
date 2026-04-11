# 주식 정보·차트 뷰어

주식 **티커 심볼**을 입력하면 Yahoo Finance 등 데이터로 **기본 정보**와 **가격 차트**를 보여주는 도구입니다.

## 데이터 출처

- **Yahoo Finance** (yfinance 라이브러리)
  - 무료, API 키 불필요
  - 미국/한국 등 다국가 주식 지원 (한국은 티커 뒤에 `.KS`/`.KQ` 사용)

## 설치

저장소를 원하는 위치에 받은 뒤, **그 폴더(프로젝트 루트)** 에서 패키지를 설치합니다.

```bash
git clone https://github.com/karin01/MyStock.git
cd MyStock
pip install -r requirements.txt
```

(이미 폴더만 있다면 `git clone` 대신 해당 폴더로 `cd` 하면 됩니다.)

## 사용법

### 1) 명령줄에서 실행

프로젝트 루트(`MyStock`)에서:

```bash
python backend/stock_viewer.py 삼성전자
python backend/stock_viewer.py 네이버 1y
python backend/stock_viewer.py AAPL
```

- **첫 번째 인자**: 회사명(한글) 또는 티커 (예: 삼성전자, 네이버, AAPL, 005930.KS)
- **두 번째 인자(선택)**: 기간 — `1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y` (기본값: `1y`)

실행하면 터미널에 요약 정보가 출력되고, 같은 폴더에 `차트_티커.png` 차트 파일이 저장됩니다.

### 2) 웹 UI (FastAPI + 프론트, 권장)

백엔드(API)와 정적 프론트를 각각 띄웁니다. Windows에서는 `실행하기.bat` 또는 `run_stock.ps1` 사용을 권장합니다.

```bash
# 터미널 1 — 프로젝트 루트에서
python backend/main.py

# 터미널 2 — frontend 폴더에서
cd frontend
python -m http.server 8765
```

브라우저에서 **http://127.0.0.1:8765** 로 접속합니다.

### 3) 웹 UI (Streamlit, 선택)

```bash
pip install streamlit
streamlit run frontend/app_streamlit.py
```

## 티커 예시

| 종목     | 티커        |
|----------|-------------|
| 애플     | AAPL        |
| 마이크로소프트 | MSFT   |
| 삼성전자 | 005930.KS   |
| 네이버   | 035420.KS   |
| SPY(ETF) | SPY         |

한국 주식은 Yahoo에서 보통 `숫자.KS`(코스피) 또는 `숫자.KQ`(코스닥) 형식입니다.

## 주의사항

- yfinance는 비공식 API이며, 과도한 요청 시 제한될 수 있습니다.
- 투자 판단용이 아닌 **참고·학습용**으로 사용하세요.
