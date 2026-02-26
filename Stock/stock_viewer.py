# -*- coding: utf-8 -*-
"""
주식 정보 및 차트 뷰어
- 다중 API: yfinance, pykrx, FinanceDataReader, Alpha Vantage, Finnhub
- 사용 예: python stock_viewer.py 삼성전자
"""

import sys
from pathlib import Path

# 에러 가능성 처리: 필수 패키지 없을 때 안내
try:
    import pandas as pd
    import matplotlib
    matplotlib.use("Agg")  # GUI 없이 이미지 저장용
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from data_sources import get_stock_info, fetch_history, get_etf_holdings
    from chart_analysis import analyze_chart
except ImportError as e:
    print("필요한 패키지가 없습니다. 다음 명령으로 설치해 주세요:")
    print("  pip install -r requirements.txt")
    print(f"오류: {e}")
    sys.exit(1)


# 한글 폰트 설정 (Windows 기본 맑은고딕)
plt.rcParams["font.family"] = "Malgun Gothic"
plt.rcParams["axes.unicode_minus"] = False


# 한글 회사명 → 티커 심볼 매핑 (코드를 모르는 사용자용)
COMPANY_NAME_TO_TICKER = {
    # 한국 주식 (코스피/코스닥)
    "삼성전자": "005930.KS",
    "삼성": "005930.KS",
    "네이버": "035420.KS",
    "카카오": "035720.KS",
    "sk하이닉스": "000660.KS",
    "에스케이하이닉스": "000660.KS",
    "하이닉스": "000660.KS",
    "현대차": "005380.KS",
    "현대자동차": "005380.KS",
    "lg전자": "066570.KS",
    "기아": "000270.KS",
    "기아자동차": "000270.KS",
    "포스코": "005490.KS",
    "posco": "005490.KS",
    "셀트리온": "068270.KS",
    "삼성바이오로직스": "207940.KS",
    "삼성sdi": "006400.KS",
    "삼성sds": "018260.KS",
    "lg에너지솔루션": "373220.KS",
    "한화에어로스페이스": "012450.KS",
    "한화에어로": "012450.KS",
    "lig넥스원": "079550.KS",
    "lig 넥스원": "079550.KS",
    "넥스원": "079550.KS",
    "kai": "047810.KS",
    "한국항공우주": "047810.KS",
    "한국항공우주산업": "047810.KS",
    "현대로템": "064350.KS",
    "삼성물산": "028260.KS",
    "현대모비스": "012330.KS",
    "kb금융": "105560.KS",
    "신한지주": "055550.KS",
    "하나금융지주": "086790.KS",
    "naver": "035420.KS",
    "kakao": "035720.KS",
    "펄어비스": "263750.KQ",
    "pearlabyss": "263750.KQ",
    "kg모빌리티": "003620.KS",
    "kg 모빌리티": "003620.KS",
    "sga솔루션즈": "184230.KQ",
    "sga 솔루션즈": "184230.KQ",
    # 한국 ETF (한글명)
    "1q200액티브": "451060.KS",
    "1q 200액티브": "451060.KS",
    "200액티브": "451060.KS",
    "코덱스200": "069500.KS",
    "kodex200": "069500.KS",
    "kodex 200": "069500.KS",
    "코덱스 200": "069500.KS",
    "코덱스2차전지": "305720.KS",
    "kodex2차전지": "305720.KS",
    "코덱스 반도체": "091160.KS",
    "타이거200": "102110.KS",
    "tiger200": "102110.KS",
    "tiger 200": "102110.KS",
    "타이거 200": "102110.KS",
    "tiger토담월드": "0060H0.KS",
    "tiger 토담월드": "0060H0.KS",
    "토담월드": "0060H0.KS",
    "tiger토탈월드": "0060H0.KS",
    "tiger 토탈월드": "0060H0.KS",
    "토탈월드스탁액티브": "0060H0.KS",
    "코덱스미국나스닥100": "379810.KS",
    "kodex미국나스닥100": "379810.KS",
    "kodex 미국나스닥100": "379810.KS",
    "미국나스닥100": "379810.KS",
    "kosdaq미국나스닥100": "379810.KS",
    "kosdaq 미국나스닥100": "379810.KS",
    "kosdak미국나스닥100": "379810.KS",
    "451060": "451060.KS",
    # 미국 ETF (한글명)
    "spy": "SPY",
    "에스피와이": "SPY",
    "s&p500": "SPY",
    "qqq": "QQQ",
    "큐큐큐": "QQQ",
    "나스닥100": "QQQ",
    "voo": "VOO",
    "아이샤": "VTI",
    "vti": "VTI",
    # 미국 주식 (한글)
    "애플": "AAPL",
    "apple": "AAPL",
    "마이크로소프트": "MSFT",
    "microsoft": "MSFT",
    "msft": "MSFT",
    "구글": "GOOGL",
    "알파벳": "GOOGL",
    "google": "GOOGL",
    "아마존": "AMZN",
    "amazon": "AMZN",
    "테슬라": "TSLA",
    "tesla": "TSLA",
    "엔비디아": "NVDA",
    "nvidia": "NVDA",
    "amd": "AMD",
    "디렉시온반도체3배etf": "SOXL",
    "디렉시온 반도체 3배 etf": "SOXL",
    "디렉시온 반도체 3배": "SOXL",
    "soxl": "SOXL",
    "메타": "META",
    "페이스북": "META",
    "meta": "META",
    "넷플릭스": "NFLX",
    "netflix": "NFLX",
    "랙스페이스": "RXT",
    "랙스페이스테크놀로지": "RXT",
    "랙스페이스 테크놀로지": "RXT",
    "렉스페이스": "RXT",
    "렉스페이스테크놀로지": "RXT",
    "렉스페이스 테크놀로지": "RXT",
    "rackspace": "RXT",
    "rackspace technology": "RXT",
    "rxt": "RXT",
    # 한국 지수 (한글명)
    "코스피": "^KS11",
    "kospi": "^KS11",
    "코스닥": "^KQ11",
    "kosdaq": "^KQ11",
    "코스피200": "^KS200",
    "kospi200": "^KS200",
}


def resolve_to_ticker(user_input: str) -> str | None:
    """
    사용자 입력(한글 회사명 또는 티커)을 티커 심볼로 변환합니다.
    '삼성전자' → '005930.KS', 'AAPL' → 'AAPL'
    """
    if not user_input or not str(user_input).strip():
        return None
    입력값 = str(user_input).strip()
    # 한글/영문 회사명 매핑에서 찾기 (공백 제거, 소문자로 비교)
    검색키 = 입력값.replace(" ", "").lower()
    for 이름, 티커 in COMPANY_NAME_TO_TICKER.items():
        if 이름.replace(" ", "").lower() == 검색키:
            return 티커.upper() if 티커.endswith((".KS", ".KQ")) else 티커
    # 매핑에 없으면 티커로 간주하고 그대로 반환
    return 입력값.upper()


def draw_chart(
    ticker_symbol: str,
    period: str = "1y",
    save_path: str | Path | None = None,
    history_df: pd.DataFrame | None = None,
) -> bool:
    """
    주가 차트를 그려서 파일로 저장합니다.
    save_path가 없으면 '차트_티커.png' 로 저장.
    history_df를 넘기면 재조회 생략.
    """
    if history_df is None or history_df.empty:
        history_df = fetch_history(ticker_symbol, period=period)
    if history_df is None or history_df.empty:
        print("차트를 그릴 수 있는 데이터가 없습니다.")
        return False

    info = get_stock_info(ticker_symbol)
    title = (info.get("name") or ticker_symbol) if info else ticker_symbol
    currency_label = info.get("currency_label", "달러(USD)") if info else "달러(USD)"

    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(history_df.index, history_df["Close"], color="#2563eb", linewidth=2, label="종가")
    ax.fill_between(history_df.index, history_df["Close"], alpha=0.2, color="#2563eb")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=2))
    plt.xticks(rotation=45)
    ax.set_title(f"{title} ({ticker_symbol}) - 기간: {period}", fontsize=14)
    ax.set_ylabel(f"가격 ({currency_label})", fontsize=12)
    ax.legend(loc="upper left")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()

    if save_path is None:
        save_path = Path(__file__).parent / f"차트_{ticker_symbol}.png"
    else:
        save_path = Path(save_path)
    plt.savefig(save_path, dpi=120)
    plt.close()
    from datetime import datetime
    print(f"차트 저장: {save_path} (최신 반영: {datetime.now().strftime('%Y-%m-%d %H:%M')})")
    return True


def print_stock_info(info: dict) -> None:
    """딕셔너리 형태의 주식 정보를 읽기 쉽게 출력합니다."""
    if not info:
        print("표시할 정보가 없습니다.")
        return
    name = info.get("name") or info.get("ticker")
    currency_label = info.get("currency_label", "달러(USD)")
    print("\n" + "=" * 50)
    print(f"  {name} ({info.get('ticker', '')})  [{currency_label}]")
    print("=" * 50)
    if info.get("current_price") is not None:
        print(f"  현재가:        {info['current_price']:,.2f} {currency_label}")
    if info.get("previous_close") is not None:
        print(f"  전일 종가:     {info['previous_close']:,.2f} {currency_label}")
    if info.get("market_cap") is not None:
        cap = info["market_cap"]
        if cap >= 1e12:
            print(f"  시가총액:      {cap/1e12:.2f}T {currency_label}")
        elif cap >= 1e9:
            print(f"  시가총액:      {cap/1e9:.2f}B {currency_label}")
        elif cap >= 1e6:
            print(f"  시가총액:      {cap/1e6:.2f}M {currency_label}")
        else:
            print(f"  시가총액:      {cap:,.0f} {currency_label}")
    if info.get("pe_ratio") is not None:
        print(f"  PER(추이):     {info['pe_ratio']:.2f}")
    if info.get("forward_pe") is not None:
        print(f"  선행 PER:      {info['forward_pe']:.2f}")
    if info.get("dividend_yield") is not None and info["dividend_yield"]:
        print(f"  배당 수익률:   {info['dividend_yield']*100:.2f}%")
    if info.get("sector"):
        print(f"  섹터:         {info['sector']}")
    if info.get("industry"):
        print(f"  산업:         {info['industry']}")
    print("=" * 50 + "\n")


def main():
    """메인: 명령줄에서 티커를 받아 정보 출력 및 차트 저장."""
    if len(sys.argv) < 2:
        print("사용법: python stock_viewer.py <회사명 또는 티커> [기간]")
        print("  예: python stock_viewer.py 삼성전자")
        print("  예: python stock_viewer.py AAPL")
        print("  예: python stock_viewer.py ?        (인기 ETF 20개 소개)")
        print("  기간: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y (기본값: 1y)")
        sys.exit(0)

    사용자입력 = sys.argv[1]
    period = sys.argv[2] if len(sys.argv) > 2 else "1y"

    if 사용자입력.strip() in ("?", "/?", "??"):
        from list_etfs import get_recommended_etfs
        print("\n📋 매수 적합 ETF 추천 (기술적 분석 기준):\n")
        추천 = get_recommended_etfs(20)
        if 추천:
            for i, (티커, 이름) in enumerate(추천, 1):
                print(f"  {i:2}. {이름:<30} ({티커}.KS)")
        else:
            print("  매수 적합으로 판단된 ETF가 없습니다.")
        print("\n※ 조회 예: python stock_viewer.py \"KODEX 200\"\n")
        sys.exit(0)

    ticker = resolve_to_ticker(사용자입력) or 사용자입력

    info = get_stock_info(ticker)
    if info:
        print_stock_info(info)
    else:
        print(f"'{사용자입력}'에 대한 정보를 가져오지 못했습니다. 회사명 또는 티커를 확인해 주세요.")

    history_df = fetch_history(ticker, period=period)
    draw_chart(ticker, period=period, history_df=history_df)

    # 차트 분석 (매수 적합/보류/위험)
    if history_df is not None and not history_df.empty:
        분석 = analyze_chart(history_df)
        print("\n" + "=" * 50)
        print("  📊 차트 분석 (참고용, 투자 권유 아님)")
        print("=" * 50)
        print(f"  판단: {분석['판단']}  |  위험도: {분석['위험도']}")
        print("-" * 50)
        print("  💡 주린이용 쉬운 설명:")
        for 쉬운 in 분석.get("근거_쉬운설명", 분석["근거"]):
            print(f"  • {쉬운}")
        if 분석.get("지표"):
            지 = 분석["지표"]
            지표_설명 = 분석.get("지표_쉬운설명", {})
            print("  [지표]")
            for k, v in 지.items():
                if v is not None:
                    뜻 = 지표_설명.get(k, "")
                    print(f"    {k}={v}  ({뜻})" if 뜻 else f"    {k}={v}")
        print("=" * 50 + "\n")

    # ETF 구성종목 (ETF인 경우만)
    holdings = get_etf_holdings(ticker)
    if holdings:
        print("\n" + "=" * 50)
        print("  📋 ETF 구성종목 (비중 상위)")
        print("=" * 50)
        for i, h in enumerate(holdings[:15], 1):
            print(f"  {i:2}. {h['종목명']:<20} {h['비중']:>6}%")
        if len(holdings) > 15:
            print(f"  ... 외 {len(holdings) - 15}종")
        print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
