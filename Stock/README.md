# 주식 정보·차트 뷰어

주식 **티커 심볼**을 입력하면 Yahoo Finance 데이터로 **기본 정보**와 **가격 차트**를 보여주는 도구입니다.

## 데이터 출처

- **Yahoo Finance** (yfinance 라이브러리)
  - 무료, API 키 불필요
  - 미국/한국 등 다국가 주식 지원 (한국은 티러 뒤에 `.KS`/`.KQ` 사용)

## 설치

```bash
cd "G:\내 드라이브\KNOU\Somoim\Jungwon_Drive_Obsidian_Vault\Stock"
pip install -r requirements.txt
```

## 사용법

### 1) 명령줄에서 실행

```bash
python stock_viewer.py 삼성전자
python stock_viewer.py 네이버 1y
python stock_viewer.py AAPL
```

- **첫 번째 인자**: 회사명(한글) 또는 티커 (예: 삼성전자, 네이버, AAPL, 005930.KS)
- **두 번째 인자(선택)**: 기간 — `1d`, `5d`, `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y` (기본값: `1y`)

실행하면 터미널에 요약 정보가 출력되고, 같은 폴더에 `차트_티커.png` 차트 파일이 저장됩니다.

### 2) 웹 UI (Streamlit, 선택)

```bash
pip install streamlit
streamlit run app_streamlit.py
```

브라우저에서 티커를 입력하고 기간을 선택하면 정보와 차트를 볼 수 있습니다.

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
