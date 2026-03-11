# -*- coding: utf-8 -*-
"""
텔레그램 봇: 주식 뷰어 연동
- /start, /help: 사용법
- /top50: 거래대금 순위 TOP50 (코스피 25 + 코스닥 25)
- /search 종목명 또는 티커: 해당 종목 현재가·시가총액 등 요약

실행: Stock 폴더에서 python telegram_bot.py
토큰: .env 파일에 TELEGRAM_BOT_TOKEN=봇토큰 설정 (또는 환경변수)
"""

import os
import sys
import time

# 프로젝트 루트를 path에 추가해 backend 모듈 import 가능하게
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

TELEGRAM_API = "https://api.telegram.org/bot"


def _get_token():
    return os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()


def _api(token: str, method: str, **params) -> dict:
    import requests
    url = f"{TELEGRAM_API}{token}/{method}"
    try:
        if params:
            r = requests.post(url, json=params, timeout=60)
        else:
            r = requests.get(url, timeout=30)
        return r.json() if r.ok else {}
    except Exception:
        return {}


def send_photo(token: str, chat_id: int, photo_bytes: bytes, filename: str = "chart.png", caption: str | None = None) -> bool:
    """차트 이미지 전송용 헬퍼"""
    import requests

    url = f"{TELEGRAM_API}{token}/sendPhoto"
    files = {"photo": (filename, photo_bytes, "image/png")}
    data: dict[str, str] = {"chat_id": str(chat_id)}
    if caption:
        data["caption"] = caption
    try:
        r = requests.post(url, data=data, files=files, timeout=60)
        return r.ok
    except Exception:
        return False


def send_message(token: str, chat_id: int, text: str) -> bool:
    # 텔레그램 메시지 최대 4096자 (숫자·기호 때문에 parse_mode 생략)
    if len(text) > 4000:
        parts = [text[i : i + 4000] for i in range(0, len(text), 4000)]
        for part in parts:
            _api(token, "sendMessage", chat_id=chat_id, text=part)
        return True
    return bool(_api(token, "sendMessage", chat_id=chat_id, text=text).get("ok"))


def cmd_help() -> str:
    return """📌 주식 뷰어 텔레그램 봇

• /top50 — 거래대금 순위 TOP50 (코스피 25 + 코스닥 25)
• /search 삼성전자 — 종목 검색 (현재가, 시가총액 등)
• /search 005930.KS — 티커로도 검색 가능
• /news 삼성전자 — 종목 관련 뉴스
• /chart 삼성전자 3mo — 차트 기술적 분석 (기본: 3mo)
• /portfolio 아이디 — 내 보유 종목 (웹에서 로그인할 때 쓰는 아이디)
• /help — 이 도움말"""


def cmd_top50() -> str:
    from backend.trading_overview import get_top_traded_stocks
    lines = ["📊 거래대금 순위 TOP50\n"]
    for market, label in [("KOSPI", "코스피"), ("KOSDAQ", "코스닥")]:
        data, 기준일 = get_top_traded_stocks(25, market)
        if 기준일:
            lines.append(f"기준일: {기준일}\n")
        lines.append(f"【{label} 상위 25】\n")
        for i, row in enumerate(data, 1):
            name = (row.get("종목명") or row.get("티커", ""))[:10]
            close = row.get("종가") or 0
            money = row.get("거래대금") or 0
            pct = row.get("등락률") or 0
            if money >= 1e8:
                money_str = f"{money/1e8:.1f}억"
            else:
                money_str = f"{money/1e4:.0f}만"
            lines.append(f"{i:2}. {name} {close:,.0f}원 {money_str} ({pct:+.1f}%)\n")
        lines.append("\n")
    return "".join(lines).strip() or "데이터를 불러오지 못했습니다."


def cmd_search(query: str) -> str:
    query = (query or "").strip()
    if not query:
        return "사용법: /search 삼성전자 또는 /search 005930.KS"
    from backend.stock_viewer import resolve_to_ticker
    from backend.data_sources import get_stock_info
    ticker = resolve_to_ticker(query) or query.upper()
    info = get_stock_info(ticker)
    if not info:
        return f"'{query}'에 해당하는 종목 정보를 찾지 못했습니다."
    name = info.get("name") or ticker
    price = info.get("current_price")
    prev = info.get("previous_close")
    cap = info.get("market_cap")
    sector = info.get("sector") or "-"
    industry = info.get("industry") or "-"
    cur_label = info.get("currency_label") or "KRW"
    if price is not None and prev is not None and prev != 0:
        chg_pct = ((price - prev) / prev) * 100
        chg_str = f" ({chg_pct:+.2f}%)"
    else:
        chg_str = ""
    price_str = f"{price:,.2f}" if price is not None else "-"
    if cap is not None:
        if cap >= 1e12:
            cap_str = f"{cap/1e12:.2f}조"
        elif cap >= 1e8:
            cap_str = f"{cap/1e8:.2f}억"
        else:
            cap_str = f"{cap:,.0f}"
    else:
        cap_str = "-"
    return f"""🔍 {name} ({ticker})
• 현재가: {price_str} {cur_label}{chg_str}
• 시가총액: {cap_str}
• 섹터: {sector} / {industry}"""


def cmd_news(query: str) -> str:
    """종목 뉴스 요약 (Google News RSS, 한국어 위주)"""
    query = (query or "").strip()
    if not query:
        return "사용법: /news 삼성전자 또는 /news 005930.KS"
    from backend.stock_viewer import resolve_to_ticker
    from backend.stock_news import get_stock_news

    ticker = resolve_to_ticker(query) or query.upper()
    news_list = get_stock_news(ticker, limit=5)
    if not news_list:
        return f"'{query}' 관련 최근 뉴스가 없습니다."
    lines = [f"📰 {query} 뉴스 요약\n"]
    for i, n in enumerate(news_list, 1):
        title = n.get("title") or "제목 없음"
        pub = n.get("publisher") or ""
        url = n.get("url") or ""
        lines.append(f"{i}. {title}")
        if pub:
            lines.append(f"   - {pub}")
        if url:
            lines.append(f"   {url}")
        lines.append("")
    return "\n".join(lines).strip()


def cmd_chart(query: str) -> dict:
    """차트 기술적 분석 요약 + 이미지용 정보 (/chart 종목 [기간])
    반환: {"text": str, "ticker": str|None, "period": str|None}
    """
    text = (query or "").strip()
    if not text:
        return {"text": "사용법: /chart 삼성전자 3mo  (기간: 1mo,3mo,6mo,1y,2y,5y)", "ticker": None, "period": None}
    parts = text.split()
    if len(parts) == 1:
        name_part = parts[0]
        period = "3mo"
    else:
        name_part = " ".join(parts[:-1])
        maybe_period = parts[-1]
        if maybe_period in {"1mo", "3mo", "6mo", "1y", "2y", "5y"}:
            period = maybe_period
        else:
            name_part = text
            period = "3mo"

    from backend.stock_viewer import resolve_to_ticker
    from backend.data_sources import fetch_history
    from backend.chart_analysis import analyze_chart

    ticker = resolve_to_ticker(name_part) or name_part.upper()
    df = fetch_history(ticker, period=period)
    if df is None or df.empty:
        return {"text": f"'{name_part}' ({ticker}) 차트 데이터를 가져오지 못했습니다.", "ticker": None, "period": None}
    분석 = analyze_chart(df)
    판단 = 분석.get("판단") or "분석불가"
    위험도 = 분석.get("위험도") or "-"
    신뢰도 = 분석.get("신뢰도") or "-"
    전망 = 분석.get("전망") or []
    지표 = 분석.get("지표") or {}
    쉬운 = 분석.get("근거_쉬운설명") or 분석.get("근거") or []

    lines = [f"📈 {name_part} ({ticker}) 차트 분석 ({period})\n"]
    lines.append(f"- 판단: {판단} (위험도: {위험도}, 신뢰도: {신뢰도})")
    if 전망:
        lines.append(f"- 전망: {' | '.join(전망[:2])}")
    # 핵심 지표 몇 개만 노출
    rsi = 지표.get("RSI")
    ma20 = 지표.get("MA20")
    chg5 = 지표.get("5일변화율(%)")
    chg20 = 지표.get("20일변화율(%)")
    if rsi is not None:
        lines.append(f"- RSI: {rsi:.1f}")
    if ma20 is not None:
        lines.append(f"- 20일선: {ma20:.2f}")
    if chg5 is not None or chg20 is not None:
        lines.append(f"- 최근 5일/20일 변동: {chg5 if chg5 is not None else '-'}% / {chg20 if chg20 is not None else '-'}%")
    if 쉬운:
        lines.append("\n주요 근거:")
        for s in 쉬운[:3]:
            lines.append(f"• {s}")
    lines.append("\n※ 참고용이며, 실제 투자 판단은 직접 검토가 필요합니다.")
    return {"text": "\n".join(lines).strip(), "ticker": ticker, "period": period}


def _달러당_원화_환율() -> float | None:
    """1달러당 원화 (봇용)"""
    from backend.data_sources import get_stock_info, fetch_history
    info = get_stock_info("KRW=X")
    if info and info.get("current_price") is not None:
        return float(info["current_price"])
    df = fetch_history("KRW=X", "5d")
    if df is not None and not df.empty and "Close" in df.columns:
        return float(df["Close"].iloc[-1])
    return None


def _현재가_및_통화_조회(ticker: str):
    """(현재가, 통화표시, 종목명) 봇용"""
    from backend.stock_viewer import resolve_to_ticker
    from backend.data_sources import get_stock_info, fetch_history
    조회용_티커 = resolve_to_ticker(ticker) or ticker
    조회용_티커 = str(조회용_티커).strip().upper()
    info = get_stock_info(조회용_티커)
    이름 = ticker
    if info:
        if info.get("name"):
            이름 = info["name"]
        if info.get("current_price") is not None:
            통화 = info.get("currency_label", "달러(USD)")
            if not (조회용_티커.endswith((".KS", ".KQ")) or (len(조회용_티커) == 6 and 조회용_티커.isdigit())):
                통화 = "달러(USD)"
            return (info["current_price"], 통화, 이름)
    df = fetch_history(조회용_티커, "5d")
    if df is not None and not df.empty and "Close" in df.columns:
        가격 = float(df["Close"].iloc[-1])
        통화 = "원(KRW)" if 조회용_티커.endswith((".KS", ".KQ")) else "달러(USD)"
        return (가격, 통화, 이름)
    return (None, "—", 이름)


def cmd_portfolio(user_id: str) -> str:
    """내 보유 종목 요약 (user_id = 웹 로그인 아이디)"""
    user_id = (user_id or "").strip().lower()
    if not user_id:
        return "사용법: /portfolio 웹에서_로그인할_때_쓰는_아이디"
    from backend.portfolio import get_holdings_with_profit_loss
    try:
        rows = get_holdings_with_profit_loss(user_id, _현재가_및_통화_조회, _달러당_원화_환율)
    except Exception as e:
        return f"보유 종목 조회 중 오류: {e}"
    if not rows:
        return f"'{user_id}' 계정에 등록된 보유 종목이 없습니다."
    total_cost = sum((h.get("total_cost") or 0) for h in rows)
    total_value = 0.0
    total_pl = 0.0
    for h in rows:
        mv = h.get("market_value")
        if mv is not None:
            cur_label = h.get("currency_label") or ""
            if "원" in cur_label or "KRW" in cur_label.upper():
                total_value += mv
            else:
                rate = _달러당_원화_환율()
                if rate and rate > 0:
                    total_value += mv * rate
        pl = h.get("profit_loss")
        if pl is not None:
            total_pl += pl
    lines = ["💰 내 보유 종목\n"]
    if total_cost and total_cost > 0:
        pct = (total_pl / total_cost) * 100
        lines.append(f"총 평가: {total_value:,.0f}원 | 원금: {total_cost:,.0f}원 | 손익: {total_pl:+,.0f}원 ({pct:+.2f}%)\n\n")
    else:
        lines.append(f"총 평가: {total_value:,.0f}원 | 원금: {total_cost:,.0f}원\n\n")
    for h in rows:
        name = (h.get("name") or h.get("ticker", ""))[:14]
        qty = h.get("quantity") or 0
        avg = h.get("avg_purchase_price") or 0
        cur = h.get("current_price")
        cur_label = h.get("currency_label") or ""
        pl = h.get("profit_loss")
        pl_pct = h.get("profit_loss_pct")
        cur_str = f"{cur:,.0f}{cur_label}" if cur is not None else "-"
        if pl is not None and pl_pct is not None:
            pl_str = f"{pl:+,.0f}원 ({pl_pct:+.2f}%)"
        else:
            pl_str = "-"
        lines.append(f"• {name} | {qty}주 | 매수가 {avg:,.0f}원 | 현재 {cur_str} | {pl_str}\n")
    return "".join(lines).strip()


def _build_chart_image_bytes(ticker: str, period: str) -> bytes | None:
    """yfinance/데이터 소스를 이용해 단순 종가 라인 차트 이미지를 PNG 바이트로 생성"""
    from backend.data_sources import fetch_history
    import matplotlib

    matplotlib.use("Agg")  # GUI 백엔드 사용 안 함
    import matplotlib.pyplot as plt
    from io import BytesIO

    df = fetch_history(ticker, period=period)
    if df is None or df.empty or "Close" not in df.columns:
        return None
    fig, ax = plt.subplots(figsize=(6, 3))
    try:
        ax.plot(df.index, df["Close"], color="#3b82f6", linewidth=1.5)
        ax.set_title(f"{ticker} ({period})", fontsize=10)
        ax.grid(True, alpha=0.3)
        ax.tick_params(axis="x", labelrotation=30, labelsize=7)
        ax.tick_params(axis="y", labelsize=8)
        fig.tight_layout()
        buf = BytesIO()
        fig.savefig(buf, format="png", dpi=120)
        buf.seek(0)
        return buf.getvalue()
    finally:
        plt.close(fig)


def run_bot():
    token = _get_token()
    if not token:
        print("TELEGRAM_BOT_TOKEN이 없습니다. .env 파일에 넣거나 환경변수로 설정하세요.")
        print("예: .env.example 을 .env 로 복사한 뒤 TELEGRAM_BOT_TOKEN=봇토큰 입력")
        return
    print("텔레그램 봇 대기 중... (종료하려면 Ctrl+C)")
    last_update_id = 0
    while True:
        try:
            resp = _api(token, "getUpdates", offset=last_update_id + 1, timeout=30)
            if not resp.get("ok"):
                time.sleep(2)
                continue
            for upd in resp.get("result", []):
                last_update_id = upd.get("update_id", 0)
                msg = upd.get("message") or {}
                chat_id = msg.get("chat", {}).get("id")
                text = (msg.get("text") or "").strip()
                if not chat_id or not text:
                    continue
                if text.startswith("/start") or text == "/help":
                    send_message(token, chat_id, cmd_help())
                elif text == "/top50":
                    send_message(token, chat_id, "잠시만 기다려 주세요...")
                    send_message(token, chat_id, cmd_top50())
                elif text.startswith("/news"):
                    q = text[5:].strip()
                    send_message(token, chat_id, cmd_news(q))
                elif text.startswith("/chart"):
                    q = text[6:].strip()
                    result = cmd_chart(q)
                    send_message(token, chat_id, result.get("text", ""))
                    t = result.get("ticker")
                    p = result.get("period")
                    if t and p:
                        img = _build_chart_image_bytes(t, p)
                        if img:
                            send_photo(token, chat_id, img, filename=f"{t}_{p}.png")
                elif text.startswith("/search"):
                    q = text[7:].strip()
                    send_message(token, chat_id, cmd_search(q))
                elif text.startswith("/portfolio"):
                    rest = text[len("/portfolio"):].strip()
                    # /portfolio@BotName default → "default" 만 추출
                    if rest.startswith("@"):
                        parts = rest.split(None, 1)
                        rest = parts[1] if len(parts) > 1 else ""
                    user_id = rest.strip()
                    if not user_id:
                        send_message(token, chat_id, "사용법: /portfolio 웹에서_로그인할_때_쓰는_아이디")
                    else:
                        send_message(token, chat_id, "잠시만 기다려 주세요...")
                        send_message(token, chat_id, cmd_portfolio(user_id))
                else:
                    send_message(token, chat_id, "알 수 없는 명령입니다. /help 로 사용법을 확인하세요.")
        except KeyboardInterrupt:
            print("\n봇을 종료합니다.")
            break
        except Exception as e:
            print("오류:", e)
            time.sleep(5)


if __name__ == "__main__":
    run_bot()
