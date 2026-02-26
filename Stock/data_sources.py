# -*- coding: utf-8 -*-
"""
다중 API 데이터 소스
- yfinance (Yahoo): 기본, API 키 불필요
- pykrx: 한국 주식/ETF (KRX), API 키 불필요
- FinanceDataReader: 한국 주식, API 키 불필요
- Alpha Vantage: 선택 (ALPHAVANTAGE_API_KEY 환경변수)
- Finnhub: 선택 (FINNHUB_API_KEY 환경변수)
"""

import os
from datetime import datetime, timedelta

import pandas as pd

# period 문자열 → 일수 매핑
PERIOD_TO_DAYS = {
    "1d": 1,
    "5d": 5,
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
}


def period_to_date_range(period: str) -> tuple[str, str]:
    """period → (시작일, 종료일) YYYYMMDD 형식"""
    days = PERIOD_TO_DAYS.get(period, 365)
    end = datetime.now()
    start = end - timedelta(days=days)
    return start.strftime("%Y%m%d"), end.strftime("%Y%m%d")


def to_korean_ticker(ticker: str) -> str:
    """005930.KS → 005930 (pykrx용 6자리)"""
    t = str(ticker).strip().upper()
    if t.endswith((".KS", ".KQ")):
        return t[:-3]
    return t


def is_korean_ticker(ticker: str) -> bool:
    """한국 종목 여부 (.KS, .KQ 또는 6자리 숫자)"""
    t = str(ticker).strip()
    return t.endswith((".KS", ".KQ")) or (len(t) == 6 and t.isdigit())


# --- yfinance ---
def _fetch_yfinance_info(ticker: str) -> dict | None:
    try:
        import yfinance as yf

        t = yf.Ticker(ticker)
        info = t.info
        if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
            return None
        currency_code = info.get("currency") or "USD"
        currency_label = "달러(USD)" if currency_code == "USD" else "원(KRW)" if currency_code == "KRW" else currency_code
        return {
            "ticker": ticker,
            "name": info.get("shortName") or info.get("longName") or ticker,
            "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "previous_close": info.get("previousClose"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "dividend_yield": info.get("dividendYield"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "currency": currency_code,
            "currency_label": currency_label,
        }
    except Exception:
        return None


def _fetch_yfinance_history(ticker: str, period: str) -> pd.DataFrame | None:
    try:
        import yfinance as yf

        df = yf.Ticker(ticker).history(period=period)
        if df is None or df.empty:
            return None
        return df
    except Exception:
        return None


# --- pykrx (한국) ---
def _fetch_pykrx_history(ticker: str, period: str) -> pd.DataFrame | None:
    try:
        from pykrx import stock

        kr_ticker = to_korean_ticker(ticker)
        from_date, to_date = period_to_date_range(period)
        df = stock.get_market_ohlcv(from_date, to_date, kr_ticker)
        if df is None or df.empty:
            df = stock.get_etf_ohlcv_by_date(from_date, to_date, kr_ticker)
        if df is None or df.empty:
            return None
        # pykrx 컬럼: 시가 고가 저가 종가 거래량 → Open High Low Close Volume
        df = df.rename(columns={"시가": "Open", "고가": "High", "저가": "Low", "종가": "Close", "거래량": "Volume"})
        if "Close" not in df.columns:
            return None
        for c in ["Open", "High", "Low", "Volume"]:
            if c not in df.columns:
                df[c] = df["Close"]
        df.index = pd.to_datetime(df.index)
        return df
    except Exception:
        return None


def _fetch_pykrx_info(ticker: str) -> dict | None:
    """pykrx로 기본 정보만 (현재가, 종목명)"""
    try:
        from pykrx import stock
        from datetime import datetime

        kr_ticker = to_korean_ticker(ticker)
        today = datetime.now().strftime("%Y%m%d")
        df = stock.get_market_ohlcv(today, today, kr_ticker)
        if df is None or df.empty:
            df = stock.get_etf_ohlcv_by_date(today, today, kr_ticker)
        if df is None or df.empty:
            # 최근 데이터로 재시도
            from datetime import timedelta
            yesterday = (datetime.now() - timedelta(days=5)).strftime("%Y%m%d")
            df = stock.get_market_ohlcv(yesterday, today, kr_ticker)
            if df is None or df.empty:
                df = stock.get_etf_ohlcv_by_date(yesterday, today, kr_ticker)
        if df is None or df.empty:
            return None
        name = None
        try:
            name = stock.get_market_ticker_name(kr_ticker)
        except Exception:
            pass
        if not name:
            try:
                name = stock.get_etf_ticker_name(kr_ticker)
            except Exception:
                name = ticker
        last_close = df["종가"].iloc[-1] if "종가" in df.columns else df["Close"].iloc[-1]
        return {
            "ticker": ticker,
            "name": name or ticker,
            "current_price": float(last_close),
            "previous_close": None,
            "market_cap": None,
            "pe_ratio": None,
            "forward_pe": None,
            "dividend_yield": None,
            "sector": None,
            "industry": None,
            "currency": "KRW",
            "currency_label": "원(KRW)",
        }
    except Exception:
        return None


# --- FinanceDataReader (한국) ---
def _fetch_fdr_history(ticker: str, period: str) -> pd.DataFrame | None:
    try:
        import FinanceDataReader as fdr

        kr_ticker = to_korean_ticker(ticker)
        from_date, to_date = period_to_date_range(period)
        # FDR은 YYYY-MM-DD 형식 사용
        from_str = f"{from_date[:4]}-{from_date[4:6]}-{from_date[6:8]}"
        to_str = f"{to_date[:4]}-{to_date[4:6]}-{to_date[6:8]}"
        df = fdr.DataReader(kr_ticker, from_str, to_str)
        if df is None or df.empty:
            return None
        # FDR 컬럼 통일 (Open, High, Low, Close, Volume)
        col_map = {"시가": "Open", "고가": "High", "저가": "Low", "종가": "Close", "거래량": "Volume"}
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
        if "Close" not in df.columns and len(df.columns) >= 4:
            df.columns = ["Open", "High", "Low", "Close"] + list(df.columns[4:])
        return df
    except Exception:
        return None


# --- Alpha Vantage (선택, API 키 필요) ---
def _fetch_av_history(ticker: str, period: str) -> pd.DataFrame | None:
    key = os.environ.get("ALPHAVANTAGE_API_KEY") or os.environ.get("ALPHA_VANTAGE_API_KEY")
    if not key:
        return None
    try:
        from alpha_vantage.timeseries import TimeSeries

        ts = TimeSeries(key=key, output_format="pandas")
        days = PERIOD_TO_DAYS.get(period, 365)
        if days <= 30:
            df, _ = ts.get_intraday(symbol=ticker, interval="60min", outputsize="compact")
        else:
            df, _ = ts.get_daily_adjusted(symbol=ticker, outputsize="full")
        if df is None or df.empty:
            return None
        df = df.tail(days)
        df.index = pd.to_datetime(df.index)
        # Alpha Vantage 컬럼: "1. open", "2. high", "3. low", "4. close", "5. adjusted close", "6. volume"
        close_col = None
        for c in ["5. adjusted close", "4. close", "Close"]:
            if c in df.columns:
                close_col = c
                break
        if close_col:
            df["Close"] = df[close_col]
        if "Close" not in df.columns:
            return None
        return df
    except Exception:
        return None


# --- Finnhub (선택, API 키 필요) ---
def _fetch_finnhub_info(ticker: str) -> dict | None:
    key = os.environ.get("FINNHUB_API_KEY")
    if not key:
        return None
    try:
        import requests

        # Finnhub는 .KS 제거한 심볼 사용
        sym = ticker.replace(".KS", "").replace(".KQ", "")
        r = requests.get(
            f"https://finnhub.io/api/v1/quote?symbol={sym}&token={key}",
            timeout=5,
        )
        if r.status_code != 200:
            return None
        d = r.json()
        if d.get("c") is None:
            return None
        currency = "USD"  # Finnhub 기본
        return {
            "ticker": ticker,
            "name": ticker,
            "current_price": d["c"],
            "previous_close": d.get("pc"),
            "market_cap": None,
            "pe_ratio": None,
            "forward_pe": None,
            "dividend_yield": None,
            "sector": None,
            "industry": None,
            "currency": currency,
            "currency_label": "달러(USD)" if currency == "USD" else currency,
        }
    except Exception:
        return None


# --- 통합 함수 ---
def get_stock_info(ticker: str) -> dict | None:
    """여러 API를 시도해 주식 정보 반환"""
    ticker = str(ticker).strip().upper()
    # 1) yfinance
    info = _fetch_yfinance_info(ticker)
    if info:
        return info
    # 2) 한국 종목: pykrx
    if is_korean_ticker(ticker):
        info = _fetch_pykrx_info(ticker)
        if info:
            return info
    # 3) Finnhub (API 키 있을 때)
    info = _fetch_finnhub_info(ticker)
    if info:
        return info
    return None


def fetch_history(ticker: str, period: str = "1y") -> pd.DataFrame | None:
    """여러 API를 시도해 가격 이력 반환"""
    ticker = str(ticker).strip().upper()
    # 1) yfinance
    df = _fetch_yfinance_history(ticker, period)
    if df is not None and not df.empty:
        return df
    # 2) 한국 종목: pykrx
    if is_korean_ticker(ticker):
        df = _fetch_pykrx_history(ticker, period)
        if df is not None and not df.empty:
            return df
        # 3) FinanceDataReader
        df = _fetch_fdr_history(ticker, period)
        if df is not None and not df.empty:
            return df
    # 4) Alpha Vantage (API 키 있을 때, 미국 주식용)
    if not is_korean_ticker(ticker):
        df = _fetch_av_history(ticker, period)
        if df is not None and not df.empty:
            return df
    return None


def get_etf_holdings(ticker: str) -> list[dict] | None:
    """
    ETF 구성종목 목록 반환. [{종목코드, 종목명, 비중}, ...]
    한국 ETF: pykrx, 미국 ETF: yfinance
    """
    ticker = str(ticker).strip().upper()
    if is_korean_ticker(ticker):
        return _get_etf_holdings_pykrx(ticker)
    return _get_etf_holdings_yfinance(ticker)


def _get_etf_holdings_pykrx(ticker: str) -> list[dict] | None:
    """한국 ETF 구성종목 (pykrx)"""
    try:
        from pykrx import stock

        kr_ticker = to_korean_ticker(ticker)
        df = stock.get_etf_portfolio_deposit_file(kr_ticker)
        if df is None or df.empty:
            return None
        # 비중 컬럼: 마지막 컬럼 사용 (pykrx가 비중을 마지막에 반환)
        if len(df.columns) == 0:
            return None
        weight_idx = len(df.columns) - 1
        result = []
        for idx, row in df.iterrows():
            try:
                w = float(row.iloc[weight_idx])
            except (TypeError, ValueError, IndexError):
                w = 0.0
            ticker_str = str(idx).zfill(6) if str(idx).isdigit() else str(idx)
            name = None
            if len(ticker_str) == 6 and ticker_str.isdigit():
                try:
                    name = stock.get_market_ticker_name(ticker_str)
                except Exception:
                    pass
            if name is None and len(row) > 0:
                try:
                    first_val = row.iloc[0]
                    if isinstance(first_val, str) and len(first_val) > 1:
                        name = first_val
                except Exception:
                    pass
            display_name = name if isinstance(name, str) else str(idx)
            result.append({"종목코드": ticker_str, "종목명": display_name, "비중": round(w, 2)})
        return sorted(result, key=lambda x: x["비중"], reverse=True)
    except Exception:
        return None


def _get_etf_holdings_yfinance(ticker: str) -> list[dict] | None:
    """미국 ETF 구성종목 (yfinance)"""
    try:
        import yfinance as yf

        t = yf.Ticker(ticker)
        funds = t.funds_data
        if funds is None:
            return None
        df = funds.top_holdings if hasattr(funds, "top_holdings") else getattr(funds, "equity_holdings", None)
        if df is None or (hasattr(df, "empty") and df.empty):
            return None
        if hasattr(df, "to_frame"):
            df = df.to_frame() if not isinstance(df, pd.DataFrame) else df
        결과 = []
        for idx, row in df.iterrows():
            종목명 = str(idx) if not isinstance(row, (dict, pd.Series)) else row.get("holding", idx)
            비중 = 0.0
            if isinstance(row, pd.Series):
                for c in ["weight", "Weight", "비중", "weightPercent", "holdingPercent"]:
                    if c in row.index and pd.notna(row.get(c)):
                        비중 = float(row[c])
                        break
            elif isinstance(row, dict):
                비중 = float(row.get("weight", row.get("Weight", 0)) or 0)
            결과.append({"종목코드": "-", "종목명": str(종목명), "비중": round(비중, 2)})
        return sorted(결과, key=lambda x: x["비중"], reverse=True)[:30]
    except Exception:
        return None
