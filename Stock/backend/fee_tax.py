# -*- coding: utf-8 -*-
"""
수수료·세금 대략 계산 모듈
- 국내 주식: 증권거래세, 투자자보호기금, 증권사 수수료
- 양도소득세: 참고용 (일반 투자자 비과세 한도 등)
※ 실제 세율·수수료는 증권사·연도에 따라 다를 수 있음
"""

# 2025년 기준 근사치 (참고용)
BROKERAGE_RATE = 0.0002  # 증권사 수수료 0.02% (온라인 일반)
TAX_KOSPI = 0.0020       # 증권거래세 코스피 0.20%
TAX_KOSDAQ = 0.0018      # 증권거래세 코스닥 0.18%
INVESTOR_PROTECTION = 0.0015  # 투자자보호기금 0.15% (매수·매도 각각)
CAPITAL_GAINS_EXEMPT = 25_000_000  # 양도소득 비과세 한도 (연 2.5천만원)
CAPITAL_GAINS_RATE = 0.22  # 양도소득세율 22% (3억 이하)


def estimate_sell_cost_krw(
    sell_amount_krw: float,
    market: str = "KOSPI",
    brokerage_rate: float | None = None,
) -> dict:
    """
    매도 시 예상 수수료·세금 (원화, 국내주식)
    sell_amount_krw: 매도 예상 금액 (원)
    market: "KOSPI" | "KOSDAQ"
    brokerage_rate: 증권사 수수료율 (없으면 기본 0.02%)
    """
    if sell_amount_krw <= 0:
        return {"brokerage": 0, "tax": 0, "protection": 0, "total": 0}
    br = brokerage_rate if brokerage_rate is not None else BROKERAGE_RATE
    tax_rate = TAX_KOSPI if market.upper() == "KOSPI" else TAX_KOSDAQ
    brokerage = sell_amount_krw * br
    tax = sell_amount_krw * tax_rate
    protection = sell_amount_krw * INVESTOR_PROTECTION
    total = brokerage + tax + protection
    return {
        "brokerage": round(brokerage),
        "tax": round(tax),
        "protection": round(protection),
        "total": round(total),
    }


def estimate_buy_cost_krw(buy_amount_krw: float, brokerage_rate: float | None = None) -> dict:
    """매수 시 예상 수수료 (원화) — 증권사 수수료 + 투자자보호기금"""
    if buy_amount_krw <= 0:
        return {"brokerage": 0, "protection": 0, "total": 0}
    br = brokerage_rate if brokerage_rate is not None else BROKERAGE_RATE
    brokerage = buy_amount_krw * br
    protection = buy_amount_krw * INVESTOR_PROTECTION
    total = brokerage + protection
    return {
        "brokerage": round(brokerage),
        "protection": round(protection),
        "total": round(total),
    }


def estimate_capital_gains_tax_krw(
    profit_krw: float,
    annual_other_gains: float = 0,
) -> dict:
    """
    양도소득세 대략 추정 (참고용)
    - 연간 양도차익 2.5천만원 이하: 비과세
    - 초과분: 22% (3억 이하), 27.5% (3억 초과)
    profit_krw: 이번 매도 예상 양도차익
    annual_other_gains: 당해연도 이미 발생한 양도차익
    """
    if profit_krw <= 0:
        return {"taxable": 0, "tax": 0, "note": "양도차익 없음"}
    remaining_exempt = max(0, CAPITAL_GAINS_EXEMPT - annual_other_gains)
    taxable = max(0, profit_krw - remaining_exempt)
    if taxable <= 0:
        return {"taxable": 0, "tax": 0, "note": "비과세 한도 이내"}
    # 3억 이하 22%, 초과 27.5% (단순화)
    rate = CAPITAL_GAINS_RATE if taxable <= 300_000_000 else 0.275
    tax = round(taxable * rate)
    return {
        "taxable": round(taxable),
        "tax": tax,
        "note": "일반투자자: 연 2.5천만원 비과세, 대주주 등 별도 적용",
    }


def _is_korean_ticker(ticker: str) -> bool:
    """한국 종목 여부"""
    t = str(ticker).strip()
    return t.endswith((".KS", ".KQ")) or (len(t) == 6 and t.isdigit())


def _get_market(ticker: str) -> str:
    """티커로 시장 구분 (.KQ → 코스닥, .KS → 코스피)"""
    t = str(ticker).strip().upper()
    if t.endswith(".KQ"):
        return "KOSDAQ"
    return "KOSPI"


def simulate_sell(
    quantity: float,
    avg_cost_krw: float,
    sell_price_per_share: float,
    is_krw: bool = True,
    usd_to_krw: float | None = None,
) -> dict:
    """
    매도 시뮬레이션: 주어진 매도가에 팔 때 손익·수수료·세금
    - 매수금액은 원화, 매도금액은 통화별
    - is_krw=True면 sell_price가 원화, False면 달러(환율 적용)
    """
    매수금액 = quantity * avg_cost_krw
    if is_krw:
        매도금액_원화 = quantity * sell_price_per_share
    else:
        if not usd_to_krw or usd_to_krw <= 0:
            return {"error": "환율 필요"}
        매도금액_원화 = quantity * sell_price_per_share * usd_to_krw

    손익 = 매도금액_원화 - 매수금액
    cost_sell = estimate_sell_cost_krw(매도금액_원화)
    cap = estimate_capital_gains_tax_krw(max(0, 손익))
    순손익 = 손익 - cost_sell["total"] - cap["tax"]
    return {
        "매수금액": round(매수금액),
        "매도금액_원화": round(매도금액_원화),
        "손익_세전": round(손익),
        "매도수수료": cost_sell["total"],
        "양도세": cap["tax"],
        "순손익": round(순손익),
    }


def estimate_holdings_sell_summary(
    holdings_with_pl: list[dict],
    get_usd_krw_rate: float | None = None,
) -> dict:
    """
    보유 종목 전체 매도 시 예상 수수료·세금 요약
    holdings_with_pl: get_holdings_with_profit_loss 결과
    get_usd_krw_rate: 1달러당 원화 (미국주식 평가금액 환산용)
    """
    total_sell_krw = 0.0
    total_profit_krw = 0.0
    sell_cost_total = 0

    for h in holdings_with_pl:
        mv = h.get("market_value")
        if mv is None:
            continue
        currency = (h.get("currency_label") or "").upper()
        if "원" in currency or "KRW" in currency:
            sell_krw = mv
        elif get_usd_krw_rate and get_usd_krw_rate > 0:
            sell_krw = mv * get_usd_krw_rate
        else:
            continue

        total_sell_krw += sell_krw
        if h.get("profit_loss") is not None:
            total_profit_krw += h["profit_loss"]

        ticker = h.get("ticker", "")
        if _is_korean_ticker(ticker):
            cost = estimate_sell_cost_krw(sell_krw, _get_market(ticker))
            sell_cost_total += cost["total"]

    cap_gains = estimate_capital_gains_tax_krw(total_profit_krw)

    return {
        "total_sell_amount_krw": round(total_sell_krw),
        "total_profit_krw": round(total_profit_krw),
        "sell_fee_tax_krw": sell_cost_total,
        "capital_gains_tax_krw": cap_gains["tax"],
        "capital_gains_note": cap_gains["note"],
    }
