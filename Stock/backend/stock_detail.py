# -*- coding: utf-8 -*-
"""
종목 상세: 재무 상태, 시장 동향, 산업 전망
- yfinance 기반 (미국 주식 풍부, 한국 주식은 제한적)
- 산업 전망 요약(longBusinessSummary)은 가능하면 한국어로 번역해 반환
"""

from __future__ import annotations

import os
import re


def get_stock_detail(ticker: str) -> dict:
    """
    티커에 대한 재무 상태·시장 동향·산업 전망을 한 번에 반환.
    반환: {
        "financials": { ... },
        "market_trend": { ... },
        "industry_outlook": { ... },
        "ticker": str,
        "name": str,
    }
    """
    ticker = str(ticker).strip().upper()
    result = {
        "ticker": ticker,
        "name": ticker,
        "financials": _empty_financials(),
        "market_trend": _empty_market_trend(),
        "industry_outlook": _empty_industry_outlook(),
    }
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        info = t.info
        if not info:
            return result
        result["name"] = info.get("shortName") or info.get("longName") or ticker

        # 재무 상태
        result["financials"] = _build_financials(info, t)
        # 시장 동향 (애널리스트·목표가)
        result["market_trend"] = _build_market_trend(info, t)
        # 산업 전망 (섹터·업종·요약)
        result["industry_outlook"] = _build_industry_outlook(info)
    except Exception:
        pass
    return result


def _empty_financials() -> dict:
    return {
        "revenue": None,
        "revenue_growth": None,
        "net_income": None,
        "profit_margin": None,
        "operating_margin": None,
        "debt_to_equity": None,
        "current_ratio": None,
        "quick_ratio": None,
        "roe": None,
        "roa": None,
        "free_cash_flow": None,
        "total_debt": None,
        "currency": None,
        "note": "데이터: Yahoo Finance (참고용)",
    }


def _build_financials(info: dict, t) -> dict:
    out = _empty_financials()
    currency = info.get("currency") or "USD"
    out["currency"] = currency

    def _num(k):
        v = info.get(k)
        if v is None:
            return None
        try:
            return round(float(v), 4) if isinstance(v, (int, float)) else None
        except (TypeError, ValueError):
            return None

    out["revenue_growth"] = _pct(info.get("revenueGrowth"))
    out["profit_margin"] = _pct(info.get("profitMargins"))
    out["operating_margin"] = _pct(info.get("operatingMargins"))
    out["debt_to_equity"] = _num("debtToEquity")
    out["current_ratio"] = _num("currentRatio")
    out["quick_ratio"] = _num("quickRatio")
    out["roe"] = _pct(info.get("returnOnEquity"))
    out["roa"] = _pct(info.get("returnOnAssets"))
    out["free_cash_flow"] = _big_num(info.get("freeCashflow"))
    out["total_debt"] = _big_num(info.get("totalDebt"))

    try:
        fin = t.financials
        if fin is not None and not fin.empty:
            if "Total Revenue" in fin.columns:
                out["revenue"] = _big_num(fin["Total Revenue"].iloc[0])
            elif "Revenue" in fin.columns:
                out["revenue"] = _big_num(fin["Revenue"].iloc[0])
            if "Net Income" in fin.columns:
                out["net_income"] = _big_num(fin["Net Income"].iloc[0])
            elif "Net Income Common Stockholders" in fin.columns:
                out["net_income"] = _big_num(fin["Net Income Common Stockholders"].iloc[0])
    except Exception:
        pass
    if out["revenue"] is None:
        out["revenue"] = _big_num(info.get("totalRevenue"))
    if out["net_income"] is None:
        out["net_income"] = _big_num(info.get("netIncomeToCommon"))
    return out


def _pct(v):
    if v is None:
        return None
    try:
        x = float(v)
        return round(x * 100, 2) if abs(x) <= 10 else round(x, 2)
    except (TypeError, ValueError):
        return None


def _big_num(v):
    if v is None:
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _empty_market_trend() -> dict:
    return {
        "recommendation": None,
        "recommendation_key": None,
        "target_mean_price": None,
        "target_low": None,
        "target_high": None,
        "num_analysts": None,
        "note": "데이터: Yahoo Finance (참고용)",
    }


def _build_market_trend(info: dict, t) -> dict:
    out = _empty_market_trend()
    out["recommendation_key"] = info.get("recommendationKey")
    out["target_mean_price"] = _num_or_none(info.get("targetMeanPrice"))
    out["target_low"] = _num_or_none(info.get("targetLowPrice"))
    out["target_high"] = _num_or_none(info.get("targetHighPrice"))
    out["num_analysts"] = info.get("numberOfAnalystOpinions")
    key_to_label = {
        "strong_buy": "매수",
        "buy": "매수",
        "hold": "관망",
        "sell": "매도",
        "strong_sell": "매도",
    }
    rk = (info.get("recommendationKey") or "").lower().replace(" ", "_")
    out["recommendation"] = key_to_label.get(rk) or (info.get("recommendationKey") or "")
    return out


def _num_or_none(v):
    if v is None:
        return None
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None


def _empty_industry_outlook() -> dict:
    return {
        "sector": None,
        "industry": None,
        "summary": None,
        "note": "데이터: Yahoo Finance (참고용)",
    }


def _build_industry_outlook(info: dict) -> dict:
    out = _empty_industry_outlook()
    out["sector"] = info.get("sector")
    out["industry"] = info.get("industry")
    summary = info.get("longBusinessSummary")
    if summary:
        translated = _translate_summary_to_korean(summary)
        out["summary"] = translated
        if translated != summary:
            base_note = out.get("note") or ""
            extra = " 영문 사업 요약을 자동 번역한 내용입니다. (정확한 투자 판단은 원문 및 공시를 참고하세요.)"
            out["note"] = (base_note + " /" + extra) if base_note else extra
    else:
        out["summary"] = None
    return out


_KOREAN_RE = re.compile("[\uac00-\ud7a3]")


def _has_korean(text: str) -> bool:
    """문자열에 한글이 포함되어 있는지 간단히 검사"""
    if not text:
        return False
    return bool(_KOREAN_RE.search(text))


def _translate_summary_to_korean(text: str) -> str:
    """
    산업 요약(longBusinessSummary)이 영문인 경우 한국어로 번역을 시도.
    - OPENAI_API_KEY 없거나 오류 나면 원문을 그대로 반환.
    - 이미 한글이 섞여 있으면 번역하지 않고 원문 유지.
    """
    if not text:
        return text
    if _has_korean(text):
        return text

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return text

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        system_prompt = (
            "당신은 금융·증권 분야 전문 한국어 번역가입니다. "
            "입력으로 미국 증권사 리포트 스타일의 영어 회사 사업 요약이 들어옵니다. "
            "이를 자연스럽고 읽기 쉬운 한국어로 번역해 주세요. "
            "회사명·제품명·지표명(EBITDA, EPS 등)은 필요하면 괄호에 영문을 함께 써도 되지만, "
            "새로운 해석을 추가하지 말고 **의미만 정확하게** 전달하세요. "
            "답변은 번역된 한국어 문장만 출력하세요."
        )
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            temperature=0.2,
            max_tokens=1200,
        )
        translated = resp.choices[0].message.content or ""
        translated = translated.strip()
        return translated or text
    except Exception:
        # 번역 실패 시 원문 그대로 사용
        return text
