# -*- coding: utf-8 -*-
"""
패턴 분석 엔진.
당첨 기록(draws)에서 읽기 쉬운 통계 요약 데이터를 만든다.
"""

from __future__ import annotations

from collections import Counter
from statistics import mean


def _main_numbers(draw: dict) -> list[int]:
    """회차 레코드에서 본번호 6개를 추출한다."""
    numbers: list[int] = []
    for i in range(1, 7):
        value = draw.get(f"drwtNo{i}")
        if isinstance(value, int):
            numbers.append(value)
    return numbers


def _zone_label(num: int) -> str:
    """번호 구간 라벨 반환."""
    if 1 <= num <= 10:
        return "1~10"
    if 11 <= num <= 20:
        return "11~20"
    if 21 <= num <= 30:
        return "21~30"
    if 31 <= num <= 40:
        return "31~40"
    return "41~45"


def _consecutive_pairs(numbers: list[int]) -> int:
    """연속번호 쌍 개수."""
    sorted_nums = sorted(numbers)
    count = 0
    for left, right in zip(sorted_nums, sorted_nums[1:]):
        if right - left == 1:
            count += 1
    return count


def _recent_draw_rows(draws: list[dict], limit: int = 5) -> list[dict]:
    """최근 회차 케이스 표용 데이터."""
    rows: list[dict] = []
    for draw in draws[-limit:][::-1]:
        numbers = _main_numbers(draw)
        odd_count = sum(1 for n in numbers if n % 2 == 1)
        even_count = len(numbers) - odd_count
        low_count = sum(1 for n in numbers if n <= 22)
        high_count = len(numbers) - low_count
        rows.append(
            {
                "drwNo": draw.get("drwNo"),
                "date": draw.get("drwNoDate") or "직접입력",
                "numbers": sorted(numbers),
                "sum": sum(numbers),
                "oddEven": f"{odd_count}:{even_count}",
                "lowHigh": f"{low_count}:{high_count}",
                "consecutivePairs": _consecutive_pairs(numbers),
            }
        )
    return rows


def build_pattern_dashboard(draws: list[dict], recent_n: int = 50) -> dict:
    """패턴 분석 대시보드 데이터 생성."""
    if not draws:
        return {
            "info": "당첨 기록이 없습니다.",
            "summaryCards": [],
            "zoneStats": [],
            "insights": [],
            "recentCases": [],
            "latestDraw": None,
        }

    valid_draws = [d for d in draws if len(_main_numbers(d)) == 6]
    if not valid_draws:
        return {
            "info": "유효한 당첨번호 데이터가 없습니다.",
            "summaryCards": [],
            "zoneStats": [],
            "insights": [],
            "recentCases": [],
            "latestDraw": None,
        }

    recent = valid_draws[-recent_n:] if recent_n > 0 else valid_draws
    all_numbers = [n for d in valid_draws for n in _main_numbers(d)]
    recent_numbers = [n for d in recent for n in _main_numbers(d)]

    # 구간 비중
    zone_counter = Counter(_zone_label(n) for n in all_numbers)
    total_pick = len(all_numbers)
    zone_stats = []
    for label in ["1~10", "11~20", "21~30", "31~40", "41~45"]:
        count = zone_counter.get(label, 0)
        ratio = (count / total_pick * 100.0) if total_pick else 0.0
        zone_stats.append({"label": label, "count": count, "ratio": f"{ratio:.2f}"})

    # 최근 vs 전체 핫/콜드 번호
    all_counter = Counter(all_numbers)
    recent_counter = Counter(recent_numbers)
    all_total = len(all_numbers)
    recent_total = len(recent_numbers)
    score_diff: list[tuple[int, float]] = []
    for num in range(1, 46):
        all_ratio = (all_counter.get(num, 0) / all_total) if all_total else 0.0
        recent_ratio = (recent_counter.get(num, 0) / recent_total) if recent_total else 0.0
        score_diff.append((num, recent_ratio - all_ratio))
    hot = sorted(score_diff, key=lambda x: x[1], reverse=True)[:3]
    cold = sorted(score_diff, key=lambda x: x[1])[:3]

    # 요약 수치
    sums = [sum(_main_numbers(d)) for d in valid_draws]
    recent_consecutive = [_consecutive_pairs(_main_numbers(d)) for d in recent]
    consecutive_ratio = (
        sum(1 for c in recent_consecutive if c > 0) / len(recent_consecutive) * 100.0
        if recent_consecutive
        else 0.0
    )
    odd_total = sum(1 for n in recent_numbers if n % 2 == 1)
    even_total = len(recent_numbers) - odd_total

    latest = valid_draws[-1]
    latest_numbers = sorted(_main_numbers(latest))

    insights = [
        f"최근 {len(recent)}회 기준 연속번호가 한 쌍 이상 나온 회차 비율은 {consecutive_ratio:.1f}%입니다.",
        f"최근 {len(recent)}회 홀짝 합계는 홀수 {odd_total}개 / 짝수 {even_total}개입니다.",
        f"합계 평균은 {mean(sums):.1f}이며, 최솟값 {min(sums)}, 최댓값 {max(sums)} 구간에 분포합니다.",
        "최근 강세 번호: " + ", ".join(f"{n}(+{d*100:.2f}%p)" for n, d in hot),
        "최근 약세 번호: " + ", ".join(f"{n}({d*100:.2f}%p)" for n, d in cold),
    ]

    summary_cards = [
        {"title": "총 분석 회차", "value": f"{len(valid_draws)}회", "sub": "본번호 6개 기준"},
        {"title": "최근 분석 구간", "value": f"{len(recent)}회", "sub": f"최근 {recent_n}회 설정"},
        {"title": "합계 평균", "value": f"{mean(sums):.1f}", "sub": f"최솟값 {min(sums)} / 최댓값 {max(sums)}"},
        {"title": "연속번호 등장률", "value": f"{consecutive_ratio:.1f}%", "sub": "최근 구간 기준"},
    ]

    return {
        "info": f"당첨 기록 {len(valid_draws)}회차를 기반으로 패턴을 계산했습니다.",
        "summaryCards": summary_cards,
        "zoneStats": zone_stats,
        "insights": insights,
        "recentCases": _recent_draw_rows(valid_draws, limit=5),
        "latestDraw": {
            "drwNo": latest.get("drwNo"),
            "date": latest.get("drwNoDate") or "직접입력",
            "numbers": latest_numbers,
            "bonus": latest.get("bnusNo"),
        },
    }
