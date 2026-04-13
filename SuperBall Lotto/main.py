# -*- coding: utf-8 -*-
"""
로또 확률 기반 번호 생성기 — 진입점.
- 데이터 수집(API) 및 로컬 캐시
- 확률 통계 출력
- 확률 기반 6개 번호 생성
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from lotto_data import DEFAULT_CACHE_PATH, add_from_text, add_manual_draw, fetch_all_from_api, fetch_one_from_news_url, load_history, save_history
from lotto_probability import compute_frequency, frequency_to_probability, get_probability_map
from lotto_generator import generate_multiple

# 캐시 없을 때 사용할 샘플 데이터 경로
SAMPLE_PATH = Path(__file__).resolve().parent / "lotto_history_sample.json"


def _ensure_draws(cache_path: Path, try_api: bool) -> list[dict]:
    """캐시 또는 샘플로 당첨 기록 확보."""
    draws = load_history(cache_path)
    if draws:
        return draws
    if try_api:
        draws, _ = fetch_all_from_api(cache_path=str(cache_path), use_requests=True)
        if draws:
            return draws
    # API 실패 시 샘플 로드
    if SAMPLE_PATH.exists():
        try:
            with open(SAMPLE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            draws = data.get("draws", data) if isinstance(data, dict) else data
            if draws:
                save_history(draws, cache_path)
                return draws
        except (json.JSONDecodeError, OSError):
            pass
    return []


def cmd_fetch(cache_path: Path) -> None:
    """1회차부터 API로 당첨 기록 수집 후 저장."""
    print("동행복권 API에서 1회차부터 당첨 기록을 가져오는 중...")
    draws, newly_fetched = fetch_all_from_api(cache_path=str(cache_path), use_requests=True)
    if draws:
        print(f"저장 완료: 총 {len(draws)}회차 (이번에 {newly_fetched}회차 수집)")
        if newly_fetched == 0 and len(draws) <= 20:
            print("(동행복권 접속이 막혀 새로 수집하지 못했습니다. 위 회차는 기존 캐시/샘플입니다.)")
    else:
        print("수집된 데이터가 없습니다. 네트워크/접속 제한을 확인하거나, 나중에 다시 시도해 주세요.")


def cmd_stats(cache_path: Path, use_recent: int | None) -> None:
    """번호별 출현 횟수·확률 출력."""
    draws = _ensure_draws(cache_path, try_api=False)
    if not draws:
        print("당첨 기록이 없습니다. 먼저 'fetch'로 데이터를 수집하거나, lotto_history_sample.json 을 사용하세요.")
        return
    freq = compute_frequency(draws, include_bonus=False)
    prob = frequency_to_probability(freq)
    total_draws = len(draws)
    print(f"기준: 1회차~{total_draws}회차 (본당첨 6개 번호만)")
    if use_recent:
        prob_recent = get_probability_map(draws, use_recent_only=use_recent, include_bonus=False)
        print(f"가중 확률: 최근 {use_recent}회차 반영")
        prob = prob_recent
    print("\n번호별 출현 횟수 & 확률 (상위 15개)")
    sorted_by_count = sorted(freq.items(), key=lambda x: -x[1])
    for i, (num, count) in enumerate(sorted_by_count[:15], 1):
        p = prob.get(num, 0) * 100
        print(f"  {i:2}. 번호 {num:2}  출현 {count:4}회  확률 {p:.2f}%")


def cmd_generate(
    cache_path: Path,
    count: int,
    recent: int | None,
    seed: int | None,
    try_api: bool,
) -> None:
    """확률 기반으로 번호 세트 생성."""
    draws = _ensure_draws(cache_path, try_api=try_api)
    if not draws:
        print("당첨 기록이 없습니다. 'python main.py fetch' 로 데이터를 먼저 수집해 주세요.")
        return
    mode = f"최근 {recent}회 가중" if recent else "전체 회차"
    print(f"기준: {mode} (총 {len(draws)}회차)")
    sets = generate_multiple(draws, count=count, use_recent_only=recent, seed=seed)
    for i, one in enumerate(sets, 1):
        print(f"  {i}. {one}")


def cmd_add_url(cache_path: Path, url: str) -> None:
    """뉴스 기사 URL에서 당첨 회차 한 건 파싱 후 캐시에 추가."""
    if not url.strip():
        print("URL을 입력해 주세요. 예: python main.py add_url --url https://www.kado.net/news/...")
        return
    record, message = fetch_one_from_news_url(url, cache_path=cache_path)
    if record is None:
        print(f"실패: {message}")
        return
    print(message)


def cmd_add_manual(cache_path: Path, drw_no: int, numbers: list[int], bonus: int | None) -> None:
    """회차·당첨번호 6개·보너스(선택)를 직접 입력해 캐시에 추가."""
    record, message = add_manual_draw(drw_no, numbers, bonus=bonus, cache_path=cache_path)
    if record is None:
        print(f"실패: {message}")
        return
    print(message)


def cmd_add_text(cache_path: Path, text: str) -> None:
    """한 줄 문장에서 회차·당첨번호 파싱 후 캐시에 추가."""
    if not text.strip():
        print("문장을 입력해 주세요. 예: python main.py add_text --text \"1214회 로또... 당첨번호 '10, 15, 19, 27, 30, 33'\"")
        return
    record, message = add_from_text(text, cache_path=cache_path)
    if record is None:
        print(f"실패: {message}")
        return
    print(message)


def main() -> None:
    parser = argparse.ArgumentParser(description="로또 6/45 확률 기반 번호 생성기 (1회차~당첨 기록 기반)")
    parser.add_argument(
        "command",
        choices=["fetch", "stats", "generate", "add_url", "add_manual", "add_text"],
        help="fetch=당첨 기록 수집, stats=확률 통계, generate=번호 생성, add_url=뉴스 URL에서 회차 추가, add_manual=직접 입력, add_text=한 줄 문장에서 추가",
    )
    parser.add_argument("--cache", default=str(DEFAULT_CACHE_PATH), help="당첨 기록 JSON 경로")
    parser.add_argument("--url", default="", help="add_url 시 사용할 뉴스 기사 URL")
    parser.add_argument("--text", default="", help="add_text 시 사용할 한 줄 문장")
    parser.add_argument("--drw", type=int, default=None, help="add_manual 시 회차 (예: 1214)")
    parser.add_argument("--nums", default="", help="add_manual 시 당첨번호 6개 (쉼표/공백 구분, 예: 10,15,19,27,30,33)")
    parser.add_argument("--bonus", type=int, default=None, help="add_manual 시 보너스 번호 (선택)")
    parser.add_argument("--count", type=int, default=5, help="generate 시 생성할 세트 수 (기본 5)")
    parser.add_argument("--recent", type=int, default=None, help="최근 N회만 사용 (가중 확률). 미지정 시 전체 회차")
    parser.add_argument("--seed", type=int, default=None, help="난수 시드 (재현용)")
    parser.add_argument("--no-api", action="store_true", help="generate 시 API 수집 시도 안 함 (캐시만 사용)")
    args = parser.parse_args()
    cache_path = Path(args.cache)

    if args.command == "fetch":
        cmd_fetch(cache_path)
    elif args.command == "stats":
        cmd_stats(cache_path, args.recent)
    elif args.command == "generate":
        cmd_generate(cache_path, args.count, args.recent, args.seed, try_api=not args.no_api)
    elif args.command == "add_url":
        cmd_add_url(cache_path, args.url)
    elif args.command == "add_manual":
        if args.drw is None or not args.nums.strip():
            print("예: python main.py add_manual --drw 1214 --nums 10,15,19,27,30,33 [--bonus 14]")
            return
        parts = [int(x.strip()) for x in args.nums.replace(",", " ").split() if x.strip().isdigit()]
        if len(parts) != 6:
            print("당첨번호는 6개를 입력해 주세요. 예: --nums 10,15,19,27,30,33")
            return
        cmd_add_manual(cache_path, args.drw, parts, args.bonus)
    elif args.command == "add_text":
        cmd_add_text(cache_path, args.text)


if __name__ == "__main__":
    main()
