# -*- coding: utf-8 -*-
"""
포트폴리오 리스크·분산도 분석
- 집중도: 상위 종목 비중 (분산 지수)
- 단순 분산 점수
"""

from collections import defaultdict


def get_concentration_ratio(holdings_with_pl: list[dict], top_n: int = 3) -> float:
    """
    상위 N종목 집중도 (0~100%). 100%에 가까우면 특정 종목에 집중.
    """
    if not holdings_with_pl:
        return 0.0
    total = sum(h.get("market_value") or 0 for h in holdings_with_pl)
    if total <= 0:
        return 0.0
    sorted_by_value = sorted(
        holdings_with_pl,
        key=lambda x: x.get("market_value") or 0,
        reverse=True,
    )
    top_sum = sum((h.get("market_value") or 0) for h in sorted_by_value[:top_n])
    return round(100 * top_sum / total, 1)


def get_diversity_score(holdings_with_pl: list[dict]) -> dict:
    """
    분산 점수 및 요약.
    - diversity_score: 0~100 (높을수록 분산 양호)
    - concentration_top3: 상위 3종목 집중도
    - count: 보유 종목 수
    """
    if not holdings_with_pl:
        return {"diversity_score": 100, "concentration_top3": 0, "count": 0}

    count = len([h for h in holdings_with_pl if (h.get("market_value") or 0) > 0])
    if count == 0:
        return {"diversity_score": 100, "concentration_top3": 0, "count": 0}

    concentration = get_concentration_ratio(holdings_with_pl, top_n=3)
    # 집중도 높을수록 분산 점수 낮음. 1종목 100% → 0점, 10종목 균등 → 100점 근처
    diversity = max(0, 100 - concentration * 0.8)  # 100% 집중 → 20점
    if count >= 5:
        diversity = min(100, diversity + 15)  # 5종목 이상 보유 보너스
    if count >= 10:
        diversity = min(100, diversity + 10)

    return {
        "diversity_score": round(diversity, 0),
        "concentration_top3": concentration,
        "count": count,
    }


def get_rebalance_suggestions(
    holdings_with_pl: list[dict],
    target_weight: str = "equal",
) -> list[dict]:
    """
    리밸런싱 제안. target_weight: "equal"(균등) | "current"(현재 유지)
    현재 비중과 목표 비중 비교 → 매수/매도 제안
    """
    if not holdings_with_pl:
        return []
    total = sum(h.get("market_value") or 0 for h in holdings_with_pl)
    if total <= 0:
        return []
    n = len([h for h in holdings_with_pl if (h.get("market_value") or 0) > 0])
    if n == 0:
        return []

    목표비중 = 100 / n if target_weight == "equal" else None
    결과 = []
    for h in holdings_with_pl:
        mv = h.get("market_value") or 0
        if mv <= 0:
            continue
        현재비중 = 100 * mv / total
        if target_weight == "equal" and 목표비중 is not None:
            목표금액 = total * (목표비중 / 100)
            차이 = 목표금액 - mv
            if abs(차이) < total * 0.01:
                액션 = "유지"
            elif 차이 > 0:
                액션 = "매수"
            else:
                액션 = "매도"
        else:
            차이 = 0
            액션 = "유지"
        결과.append({
            "ticker": h["ticker"],
            "현재비중": round(현재비중, 1),
            "목표비중": round(목표비중, 1) if 목표비중 else 현재비중,
            "액션": 액션,
            "차이금액": round(차이, 0) if target_weight == "equal" else 0,
        })
    return 결과


def get_sector_breakdown(holdings_with_pl: list[dict], get_sector_func) -> dict:
    """
    섹터별 비중. get_sector_func(ticker) -> str | None
    """
    sector_value = defaultdict(float)
    total = 0.0
    for h in holdings_with_pl:
        mv = h.get("market_value") or 0
        if mv <= 0:
            continue
        sector = get_sector_func(h["ticker"]) or "기타"
        sector_value[sector] += mv
        total += mv

    if total <= 0:
        return {}
    return {s: round(100 * v / total, 1) for s, v in sorted(sector_value.items(), key=lambda x: -x[1])}
