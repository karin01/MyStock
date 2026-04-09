"""
한글 받침/조사 유틸.

WHY: 아이템/로그/대사 등 문장 생성에서 '을/를' 같은 조사가 자연스럽게 붙어야
     몰입이 깨지지 않기 때문에 공용 유틸로 제공한다.
"""

from __future__ import annotations

from typing import Literal


def has_jongsung(text: str) -> bool:
    """
    문자열의 "마지막 한글 음절"에 받침(종성)이 있는지 판별한다.

    - 예: "롱소드" → False ("드"는 받침 없음)
    - 예: "단검" → True ("검"은 받침 ㅁ)
    """

    if not text:
        return False

    # 뒤에서부터 한글 음절(가~힣)을 찾는다.
    for ch in reversed(text.strip()):
        code = ord(ch)
        if 0xAC00 <= code <= 0xD7A3:
            return ((code - 0xAC00) % 28) != 0

    # 한글 음절이 없으면 받침 없음으로 간주
    return False


JosaType = Literal["을", "를", "이", "가", "은", "는", "과", "와"]


def get_josa_for_text(text: str, josa_type: JosaType) -> str:
    """
    주어진 text에 맞는 조사를 반환한다.

    사용 예:
    - get_josa_for_text("롱소드", "을") -> "를"
    - get_josa_for_text("단검", "을") -> "을"
    """

    jong = has_jongsung(text)

    if josa_type in ("을", "를"):
        return "을" if jong else "를"
    if josa_type in ("이", "가"):
        return "이" if jong else "가"
    if josa_type in ("은", "는"):
        return "은" if jong else "는"
    if josa_type in ("과", "와"):
        return "과" if jong else "와"

    # 기본값(방어)
    return josa_type

