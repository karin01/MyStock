# -*- coding: utf-8 -*-
"""
목표가·알림 설정 모듈
- 사용자별로 티커 + 목표가 + 방향(이상/이하) 저장
- JSON 파일로 저장 (price_alerts.json)
- 앱 접속 시 목표가 도달 여부 표시
"""

import json
from pathlib import Path

_ALERTS_FILE = Path(__file__).parent / "price_alerts.json"


def _load_all() -> dict:
    """전체 데이터 로드. { user_id: [ {...}, ... ], ... }"""
    try:
        if _ALERTS_FILE.exists():
            with open(_ALERTS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        pass
    return {}


def _save_all(data: dict) -> None:
    """전체 데이터 저장"""
    try:
        with open(_ALERTS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError:
        raise RuntimeError("알림 설정 저장에 실패했습니다.")


def get_alerts(user_id: str) -> list[dict]:
    """
    사용자의 알림 목록 반환.
    [{ id, ticker, target_price, direction, memo }, ...]
    direction: "above" (목표가 이상 도달 시), "below" (이하 도달 시)
    """
    data = _load_all()
    return data.get(user_id, [])


def add_alert(
    user_id: str,
    ticker: str,
    target_price: float,
    direction: str = "above",
    memo: str = "",
) -> dict:
    """알림 추가. direction: 'above' 또는 'below'"""
    ticker = str(ticker).strip().upper()
    direction = "above" if str(direction).lower() in ("above", "이상", "up") else "below"
    data = _load_all()
    if user_id not in data:
        data[user_id] = []
    max_id = max((a.get("id", 0) for a in data[user_id]), default=0)
    항목 = {
        "id": max_id + 1,
        "ticker": ticker,
        "target_price": float(target_price),
        "direction": direction,
        "memo": str(memo).strip()[:50],
    }
    data[user_id].append(항목)
    _save_all(data)
    return 항목


def delete_alert(user_id: str, alert_id: int) -> bool:
    """알림 삭제"""
    data = _load_all()
    if user_id not in data:
        return False
    새목록 = [a for a in data[user_id] if a.get("id") != alert_id]
    if len(새목록) == len(data[user_id]):
        return False
    data[user_id] = 새목록
    _save_all(data)
    return True
