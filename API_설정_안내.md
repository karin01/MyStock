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

### Firebase (ID/PW Firestore 저장)
- Firebase Console에서 프로젝트 생성 → Firestore 활성화
- 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
- 생성된 JSON 파일 경로를 설정:
```bash
set FIREBASE_CREDENTIALS_PATH=경로/서비스계정키.json
```
- 또는 `.streamlit/secrets.toml`에 `firebase_credentials_path = "경로"` 추가
- Firestore `users` 컬렉션에 사용자 정보 저장됨
- Firebase 미설정 시 로컬 `users.json` 사용

## 설치

```bash
pip install -r requirements.txt
```

필수: yfinance, pandas, matplotlib, pykrx, finance-datareader
