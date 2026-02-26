# -*- coding: utf-8 -*-
"""
국내 코스피 ETF 목록 조회
- pykrx(KRX)에서 ETF 리스트 가져오기
- 실행: python list_etfs.py [필터키워드]
- 예: python list_etfs.py        (전체)
- 예: python list_etfs.py 200    (코스피200 관련만)
- 예: python list_etfs.py KODEX  (KODEX만)
"""

import re
import sys
from datetime import datetime


def get_etf_list(날짜: str | None = None) -> list[tuple[str, str]]:
    """
    KRX 상장 ETF 목록 반환: [(티커, 종목명), ...]
    """
    try:
        from pykrx import stock
    except ImportError:
        print("pykrx가 필요합니다. pip install pykrx")
        return []

    날짜 = 날짜 or datetime.now().strftime("%Y%m%d")
    티커목록 = stock.get_etf_ticker_list(날짜)
    if not 티커목록:
        # 최근 영업일로 재시도
        from datetime import timedelta
        for d in range(1, 10):
            이전일 = (datetime.now() - timedelta(days=d)).strftime("%Y%m%d")
            티커목록 = stock.get_etf_ticker_list(이전일)
            if 티커목록:
                break
    결과 = []
    for 티커 in 티커목록:
        try:
            이름 = stock.get_etf_ticker_name(티커)
            결과.append((티커, 이름 or ""))
        except Exception:
            결과.append((티커, ""))
    return 결과


def get_top_etfs_by_volume(limit: int = 20) -> list[tuple[str, str]]:
    """
    거래대금 기준 상위 ETF 목록 반환: [(티커, 종목명), ...]
    """
    try:
        from pykrx import stock
        from datetime import datetime, timedelta
    except ImportError:
        return []

    for d in range(0, 10):
        날짜 = (datetime.now() - timedelta(days=d)).strftime("%Y%m%d")
        df = stock.get_etf_ohlcv_by_ticker(날짜)
        if df is not None and not df.empty and "거래대금" in df.columns:
            df = df.sort_values("거래대금", ascending=False).head(limit)
            결과 = []
            for 티커 in df.index:
                try:
                    이름 = stock.get_etf_ticker_name(티커)
                except Exception:
                    이름 = str(티커)
                결과.append((str(티커), 이름 or str(티커)))
            return 결과
    # 거래대금 없으면 전체 목록에서 상위 20개
    전체 = get_etf_list()
    return 전체[:limit] if 전체 else []


def get_similar_etfs(검색어: str, limit: int = 10) -> list[tuple[str, str]]:
    """
    검색어와 유사한 ETF 목록 반환 (이름에 키워드가 포함된 것).
    'tiger 토담월드' → TIGER, 토담, 월드 등으로 검색.
    """
    if not 검색어 or not str(검색어).strip():
        return []
    검색어 = str(검색어).strip()
    # 공백/특수문자로 분리해 키워드 추출 (2글자 이상)
    키워드들 = [w for w in re.split(r"[\s,]+", 검색어) if len(w) >= 2]
    if not 키워드들:
        return []
    try:
        전체 = get_etf_list()
        if not 전체:
            return []
        매칭 = []
        for 티커, 이름 in 전체:
            if not 이름:
                continue
            이름_정규화 = 이름.lower()
            점수 = 0
            for 키워드 in 키워드들:
                if 키워드.lower() in 이름_정규화 or 키워드 in str(티커):
                    점수 += 1
            if 점수 > 0:
                매칭.append((점수, 티커, 이름))
        # 점수 높은 순, 그다음 이름순
        매칭.sort(key=lambda x: (-x[0], x[2]))
        return [(t, n) for _, t, n in 매칭[:limit]]
    except Exception:
        return []


def get_recommended_etfs(limit: int = 20) -> list[tuple[str, str]]:
    """
    거래대금 상위 ETF 중 '매수 적합'으로 판단된 것만 반환: [(티커, 종목명), ...]
    """
    try:
        from data_sources import fetch_history
        from chart_analysis import analyze_chart
    except ImportError:
        return []

    후보 = get_top_etfs_by_volume(limit=50)
    if not 후보:
        return []

    추천 = []
    for 티커, 이름 in 후보:
        ticker_ks = f"{티커}.KS"
        history_df = fetch_history(ticker_ks, period="1mo")
        if history_df is None or history_df.empty:
            continue
        분석 = analyze_chart(history_df)
        if 분석.get("판단") == "매수 적합":
            추천.append((티커, 이름))
            if len(추천) >= limit:
                break
    return 추천


def main():
    필터 = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    etf_list = get_etf_list()
    if not etf_list:
        print("ETF 목록을 가져오지 못했습니다.")
        return

    # 필터 적용 (키워드가 이름에 포함된 것만)
    if 필터:
        etf_list = [(t, n) for t, n in etf_list if 필터.lower() in (n or "").lower() or 필터 in t]
        if not etf_list:
            print(f"'{필터}'에 해당하는 ETF가 없습니다.")
            return

    print(f"\n{'='*60}")
    print(f"  국내 코스피 ETF 목록 ({len(etf_list)}종)" + (f" — '{필터}' 필터" if 필터 else ""))
    print(f"{'='*60}")
    print(f"  {'티커':<10} {'종목명'}")
    print(f"{'-'*60}")
    for 티커, 이름 in etf_list:
        # Yahoo용 티커 형식 (005930.KS)
        yahoo_티커 = f"{티커}.KS"
        print(f"  {yahoo_티커:<12} {이름}")
    print(f"{'='*60}")
    if etf_list:
        print(f"\n※ 조회 예: python stock_viewer.py \"{etf_list[0][1]}\"")
        print(f"※ 티커 예: python stock_viewer.py {etf_list[0][0]}.KS")
    print()


if __name__ == "__main__":
    main()
