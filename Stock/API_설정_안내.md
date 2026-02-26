# 다중 API 사용 안내

주식 뷰어는 **여러 데이터 소스**를 순차적으로 시도합니다. API 키 없이도 기본 기능이 동작합니다.

## 사용 중인 API (우선순위)

| 순서 | API | API 키 | 용도 |
|------|-----|--------|------|
| 1 | **yfinance** (Yahoo Finance) | 불필요 | 미국/한국 주식 기본 |
| 2 | **pykrx** (KRX) | 불필요 | 한국 주식/ETF |
| 3 | **FinanceDataReader** | 불필요 | 한국 주식 보조 |
| 4 | **Alpha Vantage** | 선택 | 미국 주식 (yfinance 실패 시) |
| 5 | **Finnhub** | 선택 | 미국 주식 정보 (yfinance 실패 시) |

## 선택 API 키 설정 (더 많은 데이터)

### Alpha Vantage
- 가입: https://www.alphavantage.co/support/#api-key
- 무료: 5 req/분, 500 req/일
```bash
set ALPHAVANTAGE_API_KEY=여기에키입력
```

### Finnhub
- 가입: https://finnhub.io/register
- 무료: 60 req/분
```bash
set FINNHUB_API_KEY=여기에키입력
```

## 설치

```bash
pip install -r requirements.txt
```

필수: yfinance, pandas, matplotlib, pykrx, finance-datareader
