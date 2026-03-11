# -*- coding: utf-8 -*-
"""
관심종목(워치리스트) 모듈
- 사용자별로 관심종목 저장
- JSON 파일로 저장 (watchlist.json)
"""

import json
from pathlib import Path

_WATCHLIST_FILE = Path(__file__).parent / "watchlist.json"


def _load_all() -> dict:
    """전체 데이터 로드. { user_id: [ticker, ...], ... }"""
    try:
        if _WATCHLIST_FILE.exists():
            with open(_WATCHLIST_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        pass
    return {}


def _save_all(data: dict) -> None:
    """전체 데이터 저장"""
    try:
        with open(_WATCHLIST_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError:
        raise RuntimeError("관심종목 저장에 실패했습니다.")


def get_watchlist(user_id: str) -> list[str]:
    """사용자의 관심종목 목록 반환 (티커 리스트)"""
    data = _load_all()
    return data.get(user_id, [])


def add_to_watchlist(user_id: str, ticker: str) -> bool:
    """관심종목 추가. 이미 있으면 False"""
    ticker = str(ticker).strip().upper()
    if not ticker:
        return False
    data = _load_all()
    if user_id not in data:
        data[user_id] = []
    if ticker in data[user_id]:
        return False
    data[user_id].append(ticker)
    _save_all(data)
    return True


def remove_from_watchlist(user_id: str, ticker: str) -> bool:
    """관심종목 삭제"""
    ticker = str(ticker).strip().upper()
    data = _load_all()
    if user_id not in data:
        return False
    if ticker not in data[user_id]:
        return False
    data[user_id] = [t for t in data[user_id] if t != ticker]
    _save_all(data)
    return True
