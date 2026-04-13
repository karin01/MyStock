# -*- coding: utf-8 -*-
"""
로또 6/45 확률 기반 번호 생성기.
당첨 기록에서 계산한 확률로 6개 번호를 무중복 추출합니다.
"""

from __future__ import annotations

import random
from typing import Optional

from lotto_probability import get_probability_map

MIN_NUM = 1
MAX_NUM = 45
NUM_COUNT = 6


def generate_one(
    draws: list[dict],
    use_recent_only: Optional[int] = None,
    include_bonus_in_prob: bool = False,
    rng: Optional[random.Random] = None,
) -> list[int]:
    """
    확률 분포에 따라 6개 번호를 한 세트 생성 (중복 없음, 오름차순).
    use_recent_only: None=전체 회차 확률, N=최근 N회 가중 확률.
    """
    if rng is None:
        rng = random.Random()

    prob_map = get_probability_map(
        draws,
        use_recent_only=use_recent_only,
        include_bonus=include_bonus_in_prob,
    )
    # 확률에 따른 비복원 추출: 가중 랜덤 6개
    numbers = list(prob_map.keys())
    weights = [max(prob_map[n], 1e-9) for n in numbers]
    chosen = rng.choices(numbers, weights=weights, k=NUM_COUNT)
    # 중복 제거 후 6개가 되도록 반복 (드물게 중복 시)
    seen: set[int] = set()
    result: list[int] = []
    for n in chosen:
        if n not in seen:
            seen.add(n)
            result.append(n)
        if len(result) == NUM_COUNT:
            break
    while len(result) < NUM_COUNT:
        for n in numbers:
            if n not in seen:
                seen.add(n)
                result.append(n)
                if len(result) == NUM_COUNT:
                    break
        if len(result) == NUM_COUNT:
            break
        # 이론적으로만 가능 (숫자 개수 < 6)
        for i in range(MIN_NUM, MAX_NUM + 1):
            if i not in seen:
                seen.add(i)
                result.append(i)
                if len(result) == NUM_COUNT:
                    break
    result.sort()
    return result


def generate_multiple(
    draws: list[dict],
    count: int = 5,
    use_recent_only: Optional[int] = None,
    include_bonus_in_prob: bool = False,
    seed: Optional[int] = None,
) -> list[list[int]]:
    """count 세트의 번호 생성."""
    rng = random.Random(seed)
    return [
        generate_one(draws, use_recent_only, include_bonus_in_prob, rng)
        for _ in range(count)
    ]
