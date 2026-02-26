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


def _최근_영업일(오프셋: int = 0) -> str:
    """최근 영업일 YYYYMMDD (0=오늘, 1=전일, ...)"""
    d = datetime.now() - timedelta(days=오프셋)
    return d.strftime("%Y%m%d")


def get_market_overview() -> dict | None:
    """
    시장 거래 현황 요약 반환.
    - 코스피/코스닥 거래대금, 상승/하락 종목 수
    - KRX 연결 실패 시 None 반환 (DNS/네트워크 오류 대비)
    """
    try:
        from pykrx import stock
    except ImportError:
        return None

    결과 = {"조회일": None, "코스피": {}, "코스닥": {}, "환율": None}

    try:
        for 시장, 시장명 in [("KOSPI", "코스피"), ("KOSDAQ", "코스닥")]:
            for d in range(0, 5):
                날짜 = _최근_영업일(d)
                df = stock.get_market_ohlcv_by_ticker(날짜, market=시장)
                if df is not None and not df.empty:
                    결과["조회일"] = f"{날짜[:4]}-{날짜[4:6]}-{날짜[6:8]}"
                    # pykrx 컬럼: 시가(0), 고가(1), 저가(2), 종가(3), 거래량(4), 거래대금(5), 등락률(6)
                    try:
                        거래대금 = df[_COL_거래대금].sum() if _COL_거래대금 in df.columns else df.iloc[:, 5].sum()
                    except Exception:
                        거래대금 = 0
                    등락률_컬럼 = _COL_등락률 if _COL_등락률 in df.columns else (df.columns[6] if len(df.columns) > 6 else None)
                    상승 = 0
                    하락 = 0
                    보합 = 0
                    if 등락률_컬럼:
                        for v in df[등락률_컬럼]:
                            try:
                                val = float(v)
                                if val > 0:
                                    상승 += 1
                                elif val < 0:
                                    하락 += 1
                                else:
                                    보합 += 1
                            except (TypeError, ValueError):
                                pass
                    결과[시장명] = {
                        "거래대금": 거래대금,
                        "상승": 상승,
                        "하락": 하락,
                        "보합": 보합,
                        "종목수": len(df),
                    }
                    break
    except Exception:
        # ConnectionError, DNS 실패(data.krx.co.kr 해석 불가) 등 → None 반환
        return None
    return 결과


def get_top_traded_stocks(limit: int = 10, market: str = "KOSPI") -> list[dict]:
    """
    거래대금 상위 종목 반환.
    market: KOSPI, KOSDAQ
    - KRX 연결 실패 시 [] 반환
    """
    try:
        from pykrx import stock
    except ImportError:
        return []

    try:
        for d in range(0, 5):
            날짜 = _최근_영업일(d)
            df = stock.get_market_ohlcv_by_ticker(날짜, market=market)
            if df is not None and not df.empty and "거래대금" in df.columns:
                df = df.sort_values("거래대금", ascending=False).head(limit)
                결과 = []
                for 티커 in df.index:
                    try:
                        이름 = stock.get_market_ticker_name(티커)
                    except Exception:
                        이름 = str(티커)
                    row = df.loc[티커]
                    거래대금 = row.get("거래대금", 0) or 0
                    종가 = row.get("종가", 0) or 0
                    등락률 = row.get("등락률", 0) or 0
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
            df = stock.get_etf_ohlcv_by_ticker(날짜)
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
            df = stock.get_market_ohlcv_by_ticker(날짜, market=market)
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
