# -*- coding: utf-8 -*-
"""
주식 뉴스·배당 정보 모듈
- yfinance 기반 (API 키 불필요)
"""


def get_stock_news(ticker: str, limit: int = 5) -> list[dict]:
    """
    종목 관련 뉴스 목록 반환.
    [{ title, url, publisher, published_at }, ...]
    """
    try:
        # 기존 yfinance 뉴스 대신 구글 뉴스 RSS(한국어)를 사용합니다.
        import urllib.request
        import urllib.parse
        import xml.etree.ElementTree as ET
        from backend.stock_viewer import get_stock_info

        # 한글 종목명 조회를 시도 (티커만으로 검색하면 영문 뉴스가 나올 수 있음)
        import re
        info = get_stock_info(ticker)
        name_from_info = info.get("name") if info else None
        
        # 한국 주식인지 판별
        is_korean = ticker.endswith((".KS", ".KQ"))
        
        search_query = f"{ticker} 주식" # 기본값
        if is_korean:
            # pykrx를 통해 정확한 한글 종목명 조회 시도 (영문 구글 뉴스 회피)
            try:
                from pykrx import stock
                code = re.sub(r'[^0-9]', '', ticker) # 6자리 숫자만 추출
                korean_name = stock.get_market_ticker_name(code)
                if korean_name:
                    search_query = f"{korean_name} 주식"
                elif name_from_info:
                    search_query = f"{name_from_info} 주식"
                else:
                    search_query = f"{code} 주식"
            except Exception:
                search_query = f"{name_from_info or ticker} 주식"
        else:
            search_query = f"{name_from_info or ticker} 주식"

        query = urllib.parse.quote(search_query)
        url = f"https://news.google.com/rss/search?q={query}&hl=ko&gl=KR&ceid=KR:ko"
        
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(req)
        # 윈도우 한글 인코딩 방지를 위해 utf-8 명시적 디코딩
        xml_data = res.read().decode('utf-8')
        root = ET.fromstring(xml_data)
        
        결과 = []
        for item in root.findall('.//item')[:limit]:
            title = item.find('title')
            link = item.find('link')
            pub_date = item.find('pubDate')
            source = item.find('source')
            
            결과.append({
                "title": title.text if title is not None else "제목 없음",
                "url": link.text if link is not None else "",
                "publisher": source.text if source is not None else "Google News",
                "published_at": pub_date.text if pub_date is not None else "",
            })
        return 결과
    except Exception as e:
        print(f"Error fetching Korean news for {ticker}: {e}")
        return []


def get_dividend_info(ticker: str) -> dict | None:
    """
    배당 정보 반환. yfinance 기반.
    { dividend_yield, next_dividend_date, dividends_series, last_dividend }
    """
    try:
        import yfinance as yf

        t = yf.Ticker(ticker)
        info = t.info
        div_series = t.dividends
        dividend_yield = info.get("dividendYield") or info.get("yield")
        if dividend_yield and dividend_yield < 1:
            dividend_yield = dividend_yield * 100  # 0.02 → 2%

        # 최근 배당 이력
        last_dividend = None
        if div_series is not None and not div_series.empty:
            last = div_series.tail(1)
            if len(last) > 0:
                last_dividend = {"date": str(last.index[0])[:10], "amount": float(last.iloc[0])}

        return {
            "dividend_yield": dividend_yield,
            "next_dividend_date": info.get("exDividendDate") or info.get("dividendDate"),
            "dividends_series": div_series,
            "last_dividend": last_dividend,
            "payout_ratio": info.get("payoutRatio"),
        }
    except Exception:
        return None
