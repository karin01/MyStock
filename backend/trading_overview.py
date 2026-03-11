# -*- coding: utf-8 -*-
"""
주식 거래 현황 모듈
- pykrx 기반 국내 시장 현황 (거래대금, 상승/하락, 등락률 상위)
- KRX(data.krx.co.kr) 연결 실패 시 None/빈 목록 반환 (앱 크래시 방지)
"""

from datetime import datetime, timedelta


# pykrx get_market_ohlcv_by_ticker 반환 컬럼: 시가, 고가, 저가, 종가, 거래량, 거래대금, 등락률, 시가총액
# 인덱스 fallback (컬럼명 인코딩 이슈 대비)
_COL_거래대금 = "거래대금"
_COL_등락률 = "등락률"
_COL_종가 = "종가"

# pykrx 실패 시 yfinance 폴백용 대표 유동 종목 (거래대금 상위에 자주 등장하는 티커)
_FALLBACK_KOSPI = [
    "005930", "000660", "035420", "051910", "006400", "068270", "207940", "005380",
    "000270", "012330", "066570", "003550", "034730", "051900", "018880", "000810",
    "009150", "017670", "009540", "010950", "096770", "000720", "042660", "010140",
    "329180", "003670", "011200", "004170", "008930", "009830", "032830", "000860",
    "105560", "024110", "009290", "161390", "033780", "018260", "034020", "086790",
]
_FALLBACK_KOSDAQ = [
    "035720", "247540", "086520", "036570", "068760", "263750", "207760", "041020",
    "066970", "067160", "058970", "214150", "036190", "091990", "293490", "039030",
    "086900", "054540", "064960", "068290", "950210", "034810", "053290", "038870",
    "214420", "089970", "033250", "052460", "067370", "058470", "036200", "263720",
    "054620", "065650", "043150", "214370", "054780", "290650",
]


def _최근_영업일(오프셋: int = 0) -> str:
    """최근 영업일 YYYYMMDD (0=오늘, 1=전일, ...)"""
    d = datetime.now() - timedelta(days=오프셋)
    return d.strftime("%Y%m%d")


def get_market_overview() -> dict | None:
    """
    시장 거래 현황 요약 반환.
    - yfinance 기반 코스피/코스닥 지수 및 등락률 조회
    - 네트워크/API 오류 시 None 반환
    """
    import yfinance as yf
    
    결과 = {"조회일": datetime.now().strftime("%Y-%m-%d"), "코스피": {}, "코스닥": {}, "환율": {}}

    try:
        for market, ticker_name in [("코스피", "^KS11"), ("코스닥", "^KQ11"), ("환율", "KRW=X")]:
            try:
                hist = yf.Ticker(ticker_name).history(period="2d")
                if hist is not None and not hist.empty and len(hist) >= 2:
                    prev = hist['Close'].iloc[-2]
                    curr = hist['Close'].iloc[-1]
                    pct = ((curr - prev) / prev) * 100
                    결과[market] = {
                        "현재가": round(float(curr), 2), 
                        "등락률": round(float(pct), 2)
                    }
            except Exception:
                continue
    except Exception:
        return None
        
    return 결과


def get_top_traded_stocks(limit: int = 10, market: str = "KOSPI") -> tuple[list[dict], str | None]:
    """
    거래대금 상위 종목 반환. 장 마감 후에도 최근 영업일 종가·거래대금 기준으로 표시.
    market: KOSPI, KOSDAQ
    반환: (목록, 기준일 YYYY-MM-DD 또는 None)
    - KRX 연결 실패 시 ([], None)
    - 최근 15일까지 역순으로 조회해 데이터 있는 첫 영업일 사용
    """
    try:
        from pykrx import stock
    except ImportError:
        return ([], None)

    def _col(df, name: str, idx: int):
        if name in df.columns:
            return df[name]
        if 0 <= idx < len(df.columns):
            return df.iloc[:, idx]
        return None

    def _safe_float(v):
        try:
            if v is None:
                return 0.0
            f = float(v)
            import math
            return 0.0 if math.isnan(f) else f
        except (TypeError, ValueError):
            return 0.0

    try:
        # 장 마감·휴일 포함해 최근 15일까지 시도 (연휴 대비)
        for d in range(0, 15):
            날짜 = _최근_영업일(d)
            try:
                df = stock.get_market_ohlcv_by_ticker(날짜, market=market)
            except Exception:
                continue
            if df is None or df.empty:
                continue
            col_거래대금 = _col(df, _COL_거래대금, 5)
            if col_거래대금 is None:
                continue
            df = df.copy()
            df["_거래대금"] = col_거래대금
            df = df.sort_values("_거래대금", ascending=False).head(limit)
            결과 = []
            for 티커 in df.index:
                try:
                    이름 = stock.get_market_ticker_name(티커)
                except Exception:
                    이름 = str(티커)
                row = df.loc[티커]
                거래대금 = _safe_float(row.get("_거래대금") or row.get(_COL_거래대금) or (row.iloc[5] if len(row) > 5 else 0))
                종가 = _safe_float(row.get(_COL_종가) or (row.iloc[3] if len(row) > 3 else 0))
                등락률 = _safe_float(row.get(_COL_등락률) or (row.iloc[6] if len(row) > 6 else 0))
                결과.append({
                    "티커": str(티커),
                    "종목명": 이름 or str(티커),
                    "종가": 종가,
                    "거래대금": 거래대금,
                    "등락률": 등락률,
                })
            # 기준일을 YYYY-MM-DD 형태로 반환 (장 마감 후에도 '최근 영업일 종가'임을 표시용)
            기준일 = f"{날짜[:4]}-{날짜[4:6]}-{날짜[6:8]}"
            return (결과, 기준일)
    except Exception:
        pass
    # pykrx 실패 시 yfinance로 대표 종목 거래대금 추정해 표시
    return _get_top_traded_yfinance_fallback(limit, market)


def _get_top_traded_yfinance_fallback(limit: int, market: str) -> tuple[list[dict], str | None]:
    """
    pykrx 실패 시 yfinance로 대표 종목의 거래대금(종가×거래량) 추정 후 상위 반환.
    반환: (목록, 기준일 YYYY-MM-DD 또는 None)
    """
    import yfinance as yf
    from datetime import datetime

    tickers_raw = _FALLBACK_KOSPI if market == "KOSPI" else _FALLBACK_KOSDAQ
    suffix = ".KS" if market == "KOSPI" else ".KQ"
    tickers = [t + suffix for t in tickers_raw[: 40]]
    result_list = []
    기준일 = None
    try:
        for t in tickers:
            t_clean = t.replace(suffix, "")
            try:
                hist = yf.Ticker(t).history(period="5d")
                if hist is None or hist.empty or "Close" not in hist.columns:
                    continue
                last_c = float(hist["Close"].iloc[-1])
                last_v = float(hist["Volume"].iloc[-1]) if "Volume" in hist.columns else 0.0
                money = last_c * last_v
                if 기준일 is None and len(hist.index) > 0:
                    last_date = hist.index[-1]
                    기준일 = last_date.strftime("%Y-%m-%d") if hasattr(last_date, "strftime") else datetime.now().strftime("%Y-%m-%d")
            except Exception:
                continue
            try:
                info = yf.Ticker(t).info
                name = info.get("shortName") or info.get("longName") or t_clean
            except Exception:
                name = t_clean
            result_list.append({
                "티커": t_clean,
                "종목명": name,
                "종가": last_c,
                "거래대금": money,
                "등락률": 0.0,
            })
        result_list.sort(key=lambda x: x["거래대금"], reverse=True)
        if not 기준일:
            기준일 = datetime.now().strftime("%Y-%m-%d")
        return (result_list[:limit], 기준일)
    except Exception:
        return ([], None)


def get_top_traded_etfs(limit: int = 10) -> list[dict]:
    """
    ETF 거래대금 상위 종목 반환.
    - KRX 연결 실패 시 [] 반환
    """
    try:
        from pykrx import stock
    except ImportError:
        return []

    try:
        for d in range(0, 5):
            날짜 = _최근_영업일(d)
            try:
                df = stock.get_etf_ohlcv_by_ticker(날짜)
            except Exception:
                continue
            if df is not None and not df.empty and "거래대금" in df.columns:
                df = df.sort_values("거래대금", ascending=False).head(limit)
                결과 = []
                for 티커 in df.index:
                    try:
                        이름 = stock.get_etf_ticker_name(티커)
                    except Exception:
                        이름 = str(티커)
                    row = df.loc[티커]
                    거래대금 = row.get("거래대금", 0) or 0
                    종가 = row.get("종가", 0) or 0
                    등락률 = row.get("등락률", 0) or 0  # ETF는 등락률 없을 수 있음
                    결과.append({
                        "티커": str(티커),
                        "종목명": 이름 or str(티커),
                        "종가": float(종가),
                        "거래대금": float(거래대금),
                        "등락률": float(등락률),
                    })
                return 결과
    except Exception:
        return []
    return []


def get_top_gainers_losers(limit: int = 5, market: str = "KOSPI") -> dict:
    """
    등락률 상위/하위 종목 반환.
    - KRX 연결 실패 시 {"상승": [], "하락": []} 반환
    """
    try:
        from pykrx import stock
    except ImportError:
        return {"상승": [], "하락": []}

    try:
        for d in range(0, 5):
            날짜 = _최근_영업일(d)
            try:
                df = stock.get_market_ohlcv_by_ticker(날짜, market=market)
            except Exception:
                continue
            if df is not None and not df.empty and "등락률" in df.columns:
                df = df[df["등락률"].notna()]
                df_상승 = df[df["등락률"] > 0].sort_values("등락률", ascending=False).head(limit)
                df_하락 = df[df["등락률"] < 0].sort_values("등락률", ascending=True).head(limit)
                상승목록 = []
                하락목록 = []
                for 티커 in df_상승.index:
                    try:
                        이름 = stock.get_market_ticker_name(티커)
                    except Exception:
                        이름 = str(티커)
                    row = df_상승.loc[티커]
                    상승목록.append({
                        "티커": str(티커),
                        "종목명": 이름 or str(티커),
                        "종가": float(row.get("종가", 0) or 0),
                        "등락률": float(row.get("등락률", 0) or 0),
                    })
                for 티커 in df_하락.index:
                    try:
                        이름 = stock.get_market_ticker_name(티커)
                    except Exception:
                        이름 = str(티커)
                    row = df_하락.loc[티커]
                    하락목록.append({
                        "티커": str(티커),
                        "종목명": 이름 or str(티커),
                        "종가": float(row.get("종가", 0) or 0),
                        "등락률": float(row.get("등락률", 0) or 0),
                    })
                return {"상승": 상승목록, "하락": 하락목록}
    except Exception:
        pass
    return {"상승": [], "하락": []}
