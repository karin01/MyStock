# -*- coding: utf-8 -*-
"""
일별 시세 및 투자자별(외국인/기관/개인) 매매 데이터
- 한국 종목: pykrx로 일별 OHLC + 투자자별 순매수
- 해외 종목: 시세만 (전일대비·등락률·거래량)
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def period_to_date_range(period: str) -> tuple[str, str]:
    """period → (시작일, 종료일) YYYYMMDD"""
    from backend.data_sources import PERIOD_TO_DAYS
    days = PERIOD_TO_DAYS.get(period, 90)
    end = datetime.now()
    start = end - timedelta(days=days)
    return start.strftime("%Y%m%d"), end.strftime("%Y%m%d")


def _fetch_investor_volume_by_day(kr: str, day: str):
    """
    pykrx 한글 키 인코딩 이슈(KeyError '거래량') 우회:
    먼저 stock.get_market_trading_volume_by_investor 시도,
    실패 시 krx wrap 직접 호출 후 컬럼 인덱스로 거래량(순매수) 추출.
    반환: (df, net_col) 또는 (None, None)
    """
    from pykrx import stock
    try:
        df = stock.get_market_trading_volume_by_investor(day, day, kr)
        if df is not None and not df.empty:
            net_col = None
            for c in df.columns:
                if "순매수" in str(c):
                    net_col = c
                    break
            if net_col is None and len(df.columns) >= 3:
                net_col = df.columns[2]
            if net_col is not None:
                return df, net_col
    except (KeyError, Exception):
        pass
    try:
        from pykrx.website.krx.market import wrap as krx_market_wrap
        df_full = krx_market_wrap.get_market_trading_value_and_volume_on_ticker_by_investor(day, day, kr)
        if df_full is None or df_full.empty:
            return None, None
        if len(df_full.columns) >= 6:
            df = df_full.iloc[:, :3].copy()
            df.columns = ["매도", "매수", "순매수"]
            return df, "순매수"
    except Exception:
        pass
    return None, None


def _fetch_investor_daily_via_by_date(kr: str, from_date: str, to_date: str) -> list[dict]:
    """
    일별 추이 API(기관/개인/외국인)를 숫자 인자만으로 호출해 한글 키 인코딩 이슈 우회.
    실패 시 동일 API를 requests로 직접 호출(전체 User-Agent) 시도.
    """
    out = _fetch_investor_daily_via_pykrx(kr, from_date, to_date)
    if out:
        return out
    return _fetch_investor_daily_direct_http(kr, from_date, to_date)


def _fetch_investor_daily_via_pykrx(kr: str, from_date: str, to_date: str) -> list[dict]:
    """pykrx core 일별 추이 API 호출."""
    try:
        from pykrx.website.krx.market.ticker import get_stock_ticker_isin
        from pykrx.website.krx.market.core import 투자자별_거래실적_개별종목_일별추이_일반
        isin = get_stock_ticker_isin(kr)
        if not isin:
            return []
        raw = 투자자별_거래실적_개별종목_일별추이_일반().fetch(from_date, to_date, isin, 1, 3)
        if raw is None or raw.empty or len(raw.columns) < 5:
            return []
        return _parse_investor_daily_df(raw)
    except Exception as e:
        logger.warning("일별 추이 API 실패 ticker=%s: %s", kr, e)
        return []


def _get_isin_for_ticker(kr: str) -> str | None:
    """6자리 티커의 ISIN 조회. pykrx 실패 시 KRX finder API 직접 호출."""
    try:
        from pykrx.website.krx.market.ticker import get_stock_ticker_isin
        s = get_stock_ticker_isin(kr)
        if isinstance(s, str) and len(s) > 5:
            return s
    except Exception:
        pass
    try:
        import requests
        url = "https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://data.krx.co.kr/contents/MDC/MDI/outerLoader/index.cmd",
        }
        data = {"bld": "dbms/comm/finder/finder_stkisu", "locale": "ko_KR", "mktsel": "ALL", "searchText": kr, "typeNo": 0}
        resp = requests.post(url, headers=headers, data=data, timeout=10)
        resp.raise_for_status()
        j = resp.json()
        block = j.get("block1") or j.get("output") or []
        if not block:
            return None
        for row in (block if isinstance(block, list) else [block]):
            code = str(row.get("short_code") or row.get("shortCode") or "").strip()
            full = str(row.get("full_code") or row.get("fullCode") or "").strip()
            if code == kr and full.startswith("KR") and len(full) >= 12:
                return full
        if isinstance(block, list) and len(block) > 0:
            first = block[0]
            full = str(first.get("full_code") or first.get("fullCode") or "").strip()
            if full.startswith("KR"):
                return full
    except Exception as e:
        logger.debug("KRX finder ISIN 조회 실패 ticker=%s: %s", kr, e)
    return None


def _fetch_investor_daily_direct_http(kr: str, from_date: str, to_date: str) -> list[dict]:
    """KRX API를 requests로 직접 호출 (User-Agent 등으로 차단 우회)."""
    import requests
    import pandas as pd
    isin = _get_isin_for_ticker(kr)
    # ISIN이 없으면 6자리 티커로 시도 (일부 KRX API는 둘 다 허용)
    isu_candidates = [isin] if isin else []
    if len(kr) == 6 and kr.isdigit():
        isu_candidates.append(kr)
    url = "https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://data.krx.co.kr/contents/MDC/MDI/outerLoader/index.cmd",
    }
    for isu_cd in isu_candidates:
        try:
            data = {
                "bld": "dbms/MDC/STAT/standard/MDCSTAT02302",
                "strtDd": from_date,
                "endDd": to_date,
                "isuCd": isu_cd,
                "inqTpCd": 2,
                "trdVolVal": 1,
                "askBid": 3,
            }
            resp = requests.post(url, headers=headers, data=data, timeout=15)
            if resp.status_code != 200 or not resp.text.strip().startswith("{"):
                if resp.status_code == 400 and (resp.text or "").strip() == "LOGOUT":
                    logger.info("KRX 세션 차단(LOGOUT) ticker=%s - 브라우저에서 data.krx.co.kr 접속 후 재시도하거나 다른 네트워크에서 시도해 보세요.", kr)
                continue
            text = resp.text.strip()
            if not text or not text.startswith("{"):
                continue
            j = resp.json()
            if not j or "output" not in j or not j["output"]:
                continue
            raw = pd.DataFrame(j["output"])
            if raw.empty or len(raw.columns) < 5:
                continue
            return _parse_investor_daily_df(raw)
        except Exception as e:
            logger.debug("KRX 직접 HTTP isuCd=%s: %s", isu_cd, e)
            continue
    logger.warning("KRX 직접 HTTP 실패 ticker=%s (모든 isuCd 시도 후)", kr)
    return []


def _parse_investor_daily_df(raw) -> list[dict]:
    """일별 추이 DataFrame → [ { date, 외국인_순매수, 기관_순매수, 개인_순매수 } ]
    컬럼: TRD_DD(날짜), TRDVAL1(기관), TRDVAL2(기타법인), TRDVAL3(개인), TRDVAL4(외국인) 또는 iloc 0,1,3,4.
    """
    rows = []
    cols = raw.columns.tolist()
    def col_idx(name_candidates, default):
        for n in name_candidates:
            if n in cols:
                return cols.index(n)
        return default if default < len(cols) else None
    i_date = col_idx(["TRD_DD", "trdDd"], 0)
    i_기관 = col_idx(["TRDVAL1", "trdVal1"], 1)
    i_개인 = col_idx(["TRDVAL3", "trdVal3"], 3)
    i_외국인 = col_idx(["TRDVAL4", "trdVal4"], 4)
    if i_date is None:
        return []
    for _, row in raw.iterrows():
        date_str = _raw_date_to_yyyymmdd(row.iloc[i_date])
        if not date_str:
            continue
        try:
            기관 = int(float(str(row.iloc[i_기관]).replace(",", ""))) if i_기관 is not None else None
            개인 = int(float(str(row.iloc[i_개인]).replace(",", ""))) if i_개인 is not None else None
            외국인 = int(float(str(row.iloc[i_외국인]).replace(",", ""))) if i_외국인 is not None else None
        except (TypeError, ValueError, IndexError):
            기관 = 개인 = 외국인 = None
        rows.append({
            "date": date_str,
            "외국인_순매수": 외국인,
            "기관_순매수": 기관,
            "개인_순매수": 개인,
            "외국인_보유주수": None,
            "외국인_보유율": None,
        })
    return sorted(rows, key=lambda x: x["date"], reverse=True)


def _raw_date_to_yyyymmdd(val) -> str | None:
    """TRD_DD 값(예: 2021/01/20, 2021-01-20)을 YYYY-MM-DD로."""
    if val is None:
        return None
    s = str(val).strip()
    if "/" in s:
        parts = s.split("/")
        if len(parts) >= 3 and len(parts[0]) == 4 and parts[0].isdigit():
            return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
    if "-" in s and len(s) >= 10:
        parts = s.split("-")
        if len(parts) >= 3 and len(parts[0]) == 4 and parts[0].isdigit():
            return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
    if len(s) >= 8 and s[:4].isdigit() and s[4:6].isdigit() and s[6:8].isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    return None


def get_daily_series(ticker: str, period: str = "3mo") -> list[dict]:
    """
    일별 시세: 날짜, 종가, 전일대비, 등락률, 거래량
    fetch_history 기반으로 계산.
    """
    from backend.data_sources import fetch_history, is_korean_ticker
    ticker = str(ticker).strip().upper()
    df = fetch_history(ticker, period)
    if df is None or df.empty or "Close" not in df.columns:
        return []
    df = df.sort_index()
    rows = []
    prev_close = None
    for idx, row in df.iterrows():
        date_str = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)[:10]
        close = float(row["Close"]) if "Close" in row else None
        if close is None:
            continue
        vol_val = row.get("Volume", 0)
        try:
            volume = int(float(vol_val)) if (vol_val is not None and vol_val == vol_val) else 0
        except (TypeError, ValueError):
            volume = 0
        change = None
        change_pct = None
        if prev_close is not None and prev_close != 0:
            change = round(close - prev_close, 2)
            change_pct = round((close - prev_close) / prev_close * 100, 2)
        prev_close = close
        rows.append({
            "date": date_str,
            "종가": int(close) if is_korean_ticker(ticker) else round(close, 2),
            "전일대비": change,
            "등락률": change_pct,
            "거래량": volume,
        })
    # 최근일이 위로 오도록 역순
    rows.reverse()
    return rows


def get_investor_daily(ticker: str, from_date: str, to_date: str) -> list[dict]:
    """
    한국 종목만: 일별 투자자별 순매수(주수) + 외국인 보유주수·보유율.
    pykrx get_market_trading_volume_by_investor + get_exhaustion_rates_of_foreign_investment.
    """
    from backend.data_sources import to_korean_ticker, is_korean_ticker
    ticker = str(ticker).strip().upper()
    if not is_korean_ticker(ticker):
        return []
    kr = to_korean_ticker(ticker)
    try:
        from pykrx import stock
        from_dt = datetime.strptime(from_date, "%Y%m%d")
        to_dt = datetime.strptime(to_date, "%Y%m%d")

        # 1) 일별 추이 API로 한 번에 조회 (한글 키 인코딩 이슈 없음)
        result_by_date_list = _fetch_investor_daily_via_by_date(kr, from_date, to_date)
        if result_by_date_list:
            result_by_date = {r["date"]: r for r in result_by_date_list}
        else:
            result_by_date = {}
            dates_to_call = []
            d = to_dt
            while d >= from_dt and len(dates_to_call) < 90:
                dates_to_call.append(d.strftime("%Y%m%d"))
                d -= timedelta(days=1)
            for day in dates_to_call:
                try:
                    time.sleep(0.12)
                    df, net_col = _fetch_investor_volume_by_day(kr, day)
                    if df is None or net_col is None:
                        continue
                    entry = {
                        "date": f"{day[:4]}-{day[4:6]}-{day[6:8]}",
                        "외국인_순매수": None,
                        "기관_순매수": None,
                        "개인_순매수": None,
                        "외국인_보유주수": None,
                        "외국인_보유율": None,
                    }
                    for inv in df.index:
                        inv_str = str(inv).strip()
                        try:
                            v = int(float(df.loc[inv, net_col]))
                        except (TypeError, ValueError):
                            v = None
                        if "외국인" in inv_str:
                            entry["외국인_순매수"] = v
                        elif "기관합계" in inv_str or inv_str == "기관":
                            entry["기관_순매수"] = v
                        elif "개인" in inv_str:
                            entry["개인_순매수"] = v
                    result_by_date[entry["date"]] = entry
                except Exception as e:
                    logger.warning("pykrx 투자자별 거래량 조회 실패 ticker=%s day=%s: %s", kr, day, e)
                    continue

        # 외국인 보유주수·보유율
        try:
            df_exh = stock.get_exhaustion_rates_of_foreign_investment(from_date, to_date, kr)
            if df_exh is not None and not df_exh.empty:
                for idx, row in df_exh.iterrows():
                    date_str = _col_to_date(idx)
                    if not date_str or date_str not in result_by_date:
                        continue
                    보유수량 = None
                    지분율 = None
                    for col in df_exh.columns:
                        if "보유수량" in str(col):
                            try:
                                보유수량 = int(float(row[col]))
                            except (TypeError, ValueError):
                                pass
                            break
                    for col in df_exh.columns:
                        if "지분율" in str(col):
                            try:
                                지분율 = round(float(row[col]), 2)
                            except (TypeError, ValueError):
                                pass
                            break
                    result_by_date[date_str]["외국인_보유주수"] = 보유수량
                    result_by_date[date_str]["외국인_보유율"] = 지분율
        except Exception:
            pass

        dates_sorted = sorted(result_by_date.keys(), reverse=True)
        return [result_by_date[d] for d in dates_sorted]
    except Exception as e:
        logger.warning("get_investor_daily 실패 ticker=%s: %s", ticker, e)
        return []


def _col_to_date(col) -> str | None:
    """DataFrame 인덱스/컬럼을 YYYY-MM-DD 문자열로."""
    if col is None:
        return None
    if hasattr(col, "strftime"):
        return col.strftime("%Y-%m-%d")
    s = str(col)
    if len(s) >= 8 and s[:4].isdigit() and s[4:6].isdigit() and s[6:8].isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    return None


def get_daily_with_investor(ticker: str, period: str = "3mo") -> dict:
    """
    일별 시세 + (한국 종목이면) 투자자별 순매수 병합.
    반환: {
      "daily": [ { date, 종가, 전일대비, 등락률, 거래량, 외국인_순매수 } ],
      "investor": [ { date, 외국인_순매수, 기관_순매수, 개인_순매수 } ]
    }
    """
    daily = get_daily_series(ticker, period)
    from_d, to_d = period_to_date_range(period)
    investor = get_investor_daily(ticker, from_d, to_d)
    inv_by_date = {x["date"]: x for x in investor}
    for row in daily:
        row["외국인_순매수"] = None
        if row["date"] in inv_by_date:
            row["외국인_순매수"] = inv_by_date[row["date"]].get("외국인_순매수")
    return {"daily": daily, "investor": investor}
