# -*- coding: utf-8 -*-
"""
종목 스크리너 (차별화 기능)
- 배당주: 배당률 상위
- 저PER: PER 기준 저평가
- yfinance 기반 (미국주식 위주, 한국주식은 데이터 있을 때만)
"""

from backend.data_sources import get_stock_info


# 스크리닝 대상 티커 (인기·대형주 위주)
_SCREEN_TICKERS_KR = [
    "005930.KS", "000660.KS", "035420.KS", "035720.KS", "051910.KS",
    "006400.KS", "207940.KS", "005380.KS", "000270.KS", "005490.KS",
    "068270.KS", "012330.KS", "105560.KS", "055550.KS", "086790.KS",
]
_SCREEN_TICKERS_US = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "JPM", "V", "PG", "JNJ",
    "HD", "XOM", "KO", "PEP", "T", "VZ", "ABBV", "MRK", "AVGO", "CSCO",
]


def get_dividend_stocks(limit: int = 10) -> list[dict]:
    """
    배당률 상위 종목 (스크리닝 대상 중)
    """
    결과 = []
    for ticker in _SCREEN_TICKERS_KR + _SCREEN_TICKERS_US:
        info = get_stock_info(ticker)
        if not info:
            continue
        dy = info.get("dividendYield")
        if dy is None or dy <= 0:
            continue
        if dy < 1:
            dy = dy * 100  # 0.02 → 2%
        결과.append({
            "ticker": ticker,
            "name": info.get("name", ticker),
            "dividend_yield": round(float(dy), 2),
            "price": info.get("current_price"),
            "currency": info.get("currency_label", ""),
        })
    결과.sort(key=lambda x: -x["dividend_yield"])
    return 결과[:limit]


def get_low_per_stocks(limit: int = 10, max_per: float = 15) -> list[dict]:
    """
    저PER 종목 (PER이 max_per 이하, 0·음수 제외)
    """
    결과 = []
    for ticker in _SCREEN_TICKERS_KR + _SCREEN_TICKERS_US:
        info = get_stock_info(ticker)
        if not info:
            continue
        pe = info.get("pe_ratio") or info.get("trailingPE")
        if pe is None or pe <= 0 or pe > max_per:
            continue
        결과.append({
            "ticker": ticker,
            "name": info.get("name", ticker),
            "pe_ratio": round(float(pe), 2),
            "price": info.get("current_price"),
            "sector": info.get("sector", ""),
        })
    결과.sort(key=lambda x: x["pe_ratio"])
    return 결과[:limit]
