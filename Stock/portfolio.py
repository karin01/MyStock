# -*- coding: utf-8 -*-
"""
보유 종목 및 손익 추적 모듈
- 구매 내역 JSON 저장 (사용자별 분리)
- 현재가 조회 후 손익 계산
"""

import json
from datetime import datetime
from pathlib import Path

# 보유 내역 저장 파일 (Stock 폴더 내)
# 형식: { "user_id": [ {...}, {...} ], ... }
_PORTFOLIO_FILE = Path(__file__).parent / "portfolio_holdings.json"


def _load_all() -> dict:
    """전체 데이터 로드. { user_id: [holdings...], ... }"""
    try:
        if _PORTFOLIO_FILE.exists():
            with open(_PORTFOLIO_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                # 구 형식(배열) 마이그레이션: 기존 데이터를 "default" 사용자로 이전 후 저장
                if isinstance(data, list):
                    migrated = {"default": data}
                    with open(_PORTFOLIO_FILE, "w", encoding="utf-8") as wf:
                        json.dump(migrated, wf, ensure_ascii=False, indent=2)
                    return migrated
                return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        pass
    return {}


def _load_raw(user_id: str) -> list[dict]:
    """특정 사용자의 보유 내역만 로드"""
    all_data = _load_all()
    return all_data.get(user_id, [])


def _save_raw(user_id: str, holdings: list[dict]) -> None:
    """특정 사용자의 보유 내역 저장"""
    all_data = _load_all()
    all_data[user_id] = holdings
    try:
        with open(_PORTFOLIO_FILE, "w", encoding="utf-8") as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
    except OSError:
        raise RuntimeError("보유 내역 저장에 실패했습니다.")


def add_purchase(
    user_id: str,
    ticker: str,
    quantity: float,
    purchase_price: float,
    purchase_date: str | None = None,
    memo: str = "",
) -> dict:
    """
    구매 내역 추가.
    user_id: 로그인한 사용자 ID
    purchase_date: YYYY-MM-DD (없으면 오늘)
    """
    if quantity <= 0 or purchase_price <= 0:
        raise ValueError("수량과 매수가는 0보다 커야 합니다.")
    holdings = _load_raw(user_id)
    일자 = purchase_date or datetime.now().strftime("%Y-%m-%d")
    항목 = {
        "id": max((h.get("id", 0) for h in holdings), default=0) + 1,
        "ticker": str(ticker).strip().upper(),
        "quantity": float(quantity),
        "purchase_price": float(purchase_price),
        "purchase_date": 일자,
        "memo": str(memo).strip()[:100],
    }
    holdings.append(항목)
    _save_raw(user_id, holdings)
    return 항목


def delete_purchase(user_id: str, record_id: int) -> bool:
    """구매 내역 삭제 (id 기준)"""
    holdings = _load_raw(user_id)
    새목록 = [h for h in holdings if h.get("id") != record_id]
    if len(새목록) == len(holdings):
        return False
    _save_raw(user_id, 새목록)
    return True


def get_holdings(user_id: str) -> list[dict]:
    """특정 사용자의 전체 구매 내역 반환 (티커별로 합산하지 않음, 원본 그대로)"""
    return _load_raw(user_id)


def get_holdings_with_profit_loss(
    user_id: str,
    get_price_and_currency_func,
    get_usd_krw_rate_func=None,
) -> list[dict]:
    """
    보유 내역 + 현재가·손익 계산.
    user_id: 로그인한 사용자 ID
    get_price_and_currency_func(ticker) -> (float|None, str)
    get_usd_krw_rate_func() -> float|None  # 1달러당 원화 (예: 1400)
    """
    holdings = _load_raw(user_id)
    if not holdings:
        return []

    환율 = None
    if get_usd_krw_rate_func:
        try:
            환율 = get_usd_krw_rate_func()
        except Exception:
            pass

    # 티커별로 수량·매수금액 합산
    티커별 = {}
    for h in holdings:
        t = h["ticker"]
        if t not in 티커별:
            티커별[t] = {
                "ticker": t,
                "quantity": 0.0,
                "total_cost": 0.0,
                "ids": [],
            }
        q = float(h.get("quantity", 0))
        p = float(h.get("purchase_price", 0))
        티커별[t]["quantity"] += q
        티커별[t]["total_cost"] += q * p
        티커별[t]["ids"].append(h.get("id"))

    결과 = []
    for t, agg in 티커별.items():
        현재가 = None
        통화표시 = "—"
        try:
            현재가, 통화표시 = get_price_and_currency_func(t)
        except Exception:
            pass
        매수평균 = agg["total_cost"] / agg["quantity"] if agg["quantity"] else 0
        평가금액 = (현재가 * agg["quantity"]) if 현재가 is not None else None

        # 손익: 매수금액은 항상 원화 → 평가금액도 원화로 환산 후 비교
        손익 = None
        손익률 = None
        if 평가금액 is not None and agg["total_cost"]:
            if "원" in 통화표시 or "KRW" in 통화표시.upper():
                # 한국 주식: 둘 다 원화
                손익 = 평가금액 - agg["total_cost"]
            elif 환율 and 환율 > 0:
                # 미국 주식: 평가금액(달러) → 원화 환산 후 비교
                평가금액_원화 = 평가금액 * 환율
                손익 = 평가금액_원화 - agg["total_cost"]
        if 손익 is not None and agg["total_cost"]:
            손익률 = (손익 / agg["total_cost"]) * 100

        결과.append({
            "ticker": t,
            "quantity": agg["quantity"],
            "avg_purchase_price": 매수평균,
            "total_cost": agg["total_cost"],
            "current_price": 현재가,
            "market_value": 평가금액,
            "profit_loss": 손익,
            "profit_loss_pct": 손익률,
            "currency_label": 통화표시,
            "ids": agg["ids"],
        })
    return 결과
