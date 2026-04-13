# -*- coding: utf-8 -*-
"""
로또 확률 기반 번호 생성기 — 웹 서버.
Flask로 API + 간단한 페이지 제공.
"""

from __future__ import annotations

import json
import re
import threading
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib import error as urlerror
from urllib import request as urlrequest
from xml.etree import ElementTree as ET

from flask import Flask, jsonify, make_response, render_template_string, request, send_file

from lotto_data import DEFAULT_CACHE_PATH, add_from_text, add_manual_draw, fetch_all_from_api, fetch_one_from_news_url, fetch_one_round_from_api, load_history, save_history
from lotto_probability import compute_frequency, frequency_to_probability, get_probability_map
from lotto_generator import generate_multiple
from analysis_engine import build_pattern_dashboard

app = Flask(__name__)
SAMPLE_PATH = Path(__file__).resolve().parent / "lotto_history_sample.json"
# server.py와 같은 폴더의 lotto_history.json 사용 (실행 위치와 무관)
CACHE_PATH = Path(__file__).resolve().parent / "lotto_history.json"
GEN_LOG_PATH = Path(__file__).resolve().parent / "generated_history.json"
WEEKLY_SUMMARY_PATH = Path(__file__).resolve().parent / "weekly_summary_cache.json"

# 자동 수집 상태 (백그라운드 스레드)
_auto_fetch_state = {"running": False, "message": ""}
AUTO_FETCH_START = 100  # 100회차부터 수집
BASE_DRAW_DATE = date(2002, 12, 7)  # 1회 추첨일


def _estimate_draw_date(drw_no: int) -> str:
    """회차 기준 추정 추첨일(주 1회 토요일)을 YYYY-MM-DD로 반환."""
    if drw_no < 1:
        return ""
    estimated = BASE_DRAW_DATE + timedelta(days=(drw_no - 1) * 7)
    return estimated.isoformat()


def _fetch_lotto_raw(drw_no: int) -> dict | None:
    """동행복권 원본 API에서 단일 회차 원시 데이터 조회."""
    url = f"https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={drw_no}"
    try:
        with urlrequest.urlopen(url, timeout=8) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except (urlerror.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    if not isinstance(raw, dict):
        return None
    if raw.get("returnValue") != "success":
        return None
    return raw


def _guess_current_draw_no() -> int:
    """오늘 날짜 기준 예상 최신 회차 계산 (근사값)."""
    today = datetime.now().date()
    if today < BASE_DRAW_DATE:
        return 1
    weeks = (today - BASE_DRAW_DATE).days // 7
    return max(1, weeks + 1)


def _get_weekly_summary(draw_no: int | None = None) -> dict | None:
    """주간 당첨 요약(번호/보너스/1등 인원/1등 당첨금/총판매액)."""
    cache = _load_weekly_summary_cache()
    if draw_no is not None:
        key = str(draw_no)
        if key in cache and isinstance(cache[key], dict):
            cached = dict(cache[key])
            cached["dataSource"] = "manual_cache"
            return cached

    candidates: list[int]
    if draw_no is not None:
        candidates = [draw_no]
    else:
        guess = _guess_current_draw_no()
        # 최신 회차 자동 탐색: 근사값 주변에서 높은 회차부터 확인
        candidates = [n for n in range(guess + 2, max(0, guess - 10), -1)]

    for no in candidates:
        raw = _fetch_lotto_raw(no)
        if not raw:
            continue
        nums = [raw.get(f"drwtNo{i}") for i in range(1, 7)]
        if not all(isinstance(n, int) for n in nums):
            continue
        first_winner = raw.get("firstPrzwnerCo")
        first_amount = raw.get("firstWinamnt")
        total_sales = raw.get("totSellamnt")
        result = {
            "drwNo": raw.get("drwNo"),
            "drwNoDate": raw.get("drwNoDate") or _estimate_draw_date(no),
            "numbers": nums,
            "bonus": raw.get("bnusNo"),
            "firstPrizeWinnerCount": int(first_winner) if isinstance(first_winner, (int, float)) else 0,
            "firstPrizeAmount": int(first_amount) if isinstance(first_amount, (int, float)) else 0,
            "totalSalesAmount": int(total_sales) if isinstance(total_sales, (int, float)) else 0,
            "dataSource": "official_api",
        }
        cache[str(result["drwNo"])] = {k: v for k, v in result.items() if k != "dataSource"}
        try:
            _save_weekly_summary_cache(cache)
        except OSError:
            pass
        return result
    # 뉴스 RSS에서 1등 인원/당첨금 추출 시도
    news_meta = _fetch_weekly_summary_from_news(draw_no if draw_no is not None else None)

    # 공식 API 실패 시 로컬 캐시 폴백 (번호/추첨일은 표시 가능)
    draws = _ensure_draws()
    valid = [d for d in draws if isinstance(d, dict) and d.get("drwNo") is not None]
    if not valid:
        return None
    latest = sorted(valid, key=lambda x: int(x.get("drwNo", 0)))[-1]
    nums = [latest.get(f"drwtNo{i}") for i in range(1, 7)]
    if not all(isinstance(n, int) for n in nums):
        return None
    result = {
        "drwNo": latest.get("drwNo"),
        "drwNoDate": latest.get("drwNoDate") or _estimate_draw_date(int(latest.get("drwNo", 1))),
        "numbers": nums,
        "bonus": latest.get("bnusNo"),
        "firstPrizeWinnerCount": None,
        "firstPrizeAmount": None,
        "totalSalesAmount": None,
        "dataSource": "local_cache",
    }
    if news_meta:
        # 뉴스 기반 값은 참고용으로만 사용
        result["firstPrizeWinnerCount"] = news_meta.get("firstPrizeWinnerCount")
        result["firstPrizeAmount"] = news_meta.get("firstPrizeAmount")
        result["dataSource"] = "news_rss"
        result["newsHeadline"] = news_meta.get("headline")
        result["newsHeadlines"] = news_meta.get("headlines", [])
        result["newsConfidence"] = news_meta.get("confidence", "medium")
    cache[str(result["drwNo"])] = {k: v for k, v in result.items() if k not in ("dataSource", "newsHeadline", "newsHeadlines", "newsConfidence")}
    try:
        _save_weekly_summary_cache(cache)
    except OSError:
        pass
    return result


def _fetch_weekly_summary_from_news(draw_no: int | None) -> dict | None:
    """Google News RSS 제목에서 1등 인원/당첨금 추출(추정치)."""
    target = draw_no
    if target is None:
        draws = _ensure_draws()
        if not draws:
            return None
        target = max((d.get("drwNo", 0) for d in draws), default=0)
    if not target:
        return None
    query = f"{target}회 로또 1등 당첨번호"
    url = (
        "https://news.google.com/rss/search?q="
        + urlrequest.quote(query)
        + "&hl=ko&gl=KR&ceid=KR:ko"
    )
    try:
        with urlrequest.urlopen(url, timeout=8) as resp:
            xml_text = resp.read().decode("utf-8", errors="ignore")
    except (urlerror.URLError, TimeoutError, OSError):
        return None
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None
    items = root.findall(".//item")
    if not items:
        return None
    # 상위 여러 개 헤드라인에서 숫자 패턴 추출
    extracted: list[dict] = []
    for item in items[:12]:
        title = (item.findtext("title") or "").strip()
        text = re.sub(r"\s+", " ", title)
        # 1등 인원 추출: "1등 12명"
        m_count = re.search(r"1등\s*([0-9]{1,3})\s*명", text)
        # 1등 금액 추출: "25억" / "25억씩"
        m_amount = re.search(r"([0-9]{1,3}(?:\.[0-9])?)\s*억", text)
        if not m_count and not m_amount:
            continue
        extracted.append({
            "winnerCount": int(m_count.group(1)) if m_count else None,
            "firstPrizeAmount": int(float(m_amount.group(1)) * 100000000) if m_amount else None,
            "headline": text,
        })

    if not extracted:
        return None

    # 인원: 최빈값(다수결), 동률 시 더 큰 빈도 우선
    count_values = [e["winnerCount"] for e in extracted if e["winnerCount"] is not None]
    winner_count = None
    if count_values:
        winner_count = Counter(count_values).most_common(1)[0][0]

    # 금액: 최빈값, 없으면 중앙값 근사
    amount_values = [e["firstPrizeAmount"] for e in extracted if e["firstPrizeAmount"] is not None]
    first_amount = None
    if amount_values:
        counter = Counter(amount_values).most_common()
        if counter and counter[0][1] >= 2:
            first_amount = counter[0][0]
        else:
            sorted_amount = sorted(amount_values)
            first_amount = sorted_amount[len(sorted_amount) // 2]

    source_headlines = [e["headline"] for e in extracted[:3]]
    confidence = "high" if (len(count_values) >= 3 or len(amount_values) >= 3) else "medium"
    return {
        "firstPrizeWinnerCount": winner_count,
        "firstPrizeAmount": first_amount,
        "headline": source_headlines[0] if source_headlines else "",
        "headlines": source_headlines,
        "confidence": confidence,
    }


def _ensure_draws() -> list[dict]:
    """캐시 또는 샘플로 당첨 기록 확보 (API 호출 없음). server.py와 같은 폴더의 lotto_history.json 사용."""
    if not CACHE_PATH.exists():
        if SAMPLE_PATH.exists():
            try:
                with open(SAMPLE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                draws = data.get("draws", data) if isinstance(data, dict) else data
                if draws:
                    save_history(draws, CACHE_PATH)
                    return draws
            except (json.JSONDecodeError, OSError):
                pass
        return []
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    if isinstance(data, list):
        draws = data
    elif isinstance(data, dict) and "draws" in data:
        draws = data["draws"]
    else:
        return []

    # 직접입력 데이터의 빈 추첨일을 회차 기반으로 자동 보정해 저장
    changed = False
    for row in draws:
        if not isinstance(row, dict):
            continue
        drw_no = row.get("drwNo")
        drw_date = row.get("drwNoDate")
        if isinstance(drw_no, int) and (drw_date is None or str(drw_date).strip() == ""):
            row["drwNoDate"] = _estimate_draw_date(drw_no)
            changed = True
    if changed:
        try:
            save_history(draws, CACHE_PATH)
        except OSError:
            pass
    return draws


def _run_auto_fetch() -> None:
    """백그라운드에서 100회차~ 수집."""
    global _auto_fetch_state
    if _auto_fetch_state["running"]:
        return
    _auto_fetch_state["running"] = True
    _auto_fetch_state["message"] = "100회차부터 수집 중..."
    try:
        draws, newly = fetch_all_from_api(
            start_no=AUTO_FETCH_START,
            max_attempts=1500,
            cache_path=str(CACHE_PATH),
            use_requests=True,
        )
        _auto_fetch_state["message"] = f"완료: 총 {len(draws)}회차 보유 (이번에 {newly}회차 수집)" if draws else "수집 실패 (접속 제한 등)"
    except Exception as e:
        _auto_fetch_state["message"] = f"오류: {e!s}"
    finally:
        _auto_fetch_state["running"] = False


def _load_generated_logs() -> list[dict]:
    """생성 번호 히스토리 로드."""
    if not GEN_LOG_PATH.exists():
        return []
    try:
        with open(GEN_LOG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "logs" in data and isinstance(data["logs"], list):
        return data["logs"]
    return []


def _save_generated_logs(logs: list[dict]) -> None:
    """생성 번호 히스토리 저장."""
    payload = {"logs": logs}
    with open(GEN_LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def _load_weekly_summary_cache() -> dict:
    """주간 요약 캐시 로드."""
    if not WEEKLY_SUMMARY_PATH.exists():
        return {}
    try:
        with open(WEEKLY_SUMMARY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}
    return data if isinstance(data, dict) else {}


def _save_weekly_summary_cache(cache: dict) -> None:
    """주간 요약 캐시 저장."""
    with open(WEEKLY_SUMMARY_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def _parse_iso_datetime(value: str | None) -> datetime | None:
    """ISO 문자열을 UTC 기준 datetime으로 파싱."""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _normalize_numbers_set(numbers: list[int]) -> list[int]:
    """번호 세트를 정렬/정수화해 비교 가능한 형태로 정규화."""
    try:
        return sorted(int(n) for n in numbers)
    except (TypeError, ValueError):
        return []


def _calc_rank(match_count: int, bonus_match: bool) -> str:
    """로또 등수 문자열 계산."""
    if match_count == 6:
        return "1등"
    if match_count == 5 and bonus_match:
        return "2등"
    if match_count == 5:
        return "3등"
    if match_count == 4:
        return "4등"
    if match_count == 3:
        return "5등"
    return "미당첨"


def _rank_weight(rank: str) -> int:
    """등수 정렬 가중치 (작을수록 좋음)."""
    table = {"1등": 1, "2등": 2, "3등": 3, "4등": 4, "5등": 5, "미당첨": 9}
    return table.get(rank, 9)


def _evaluate_single_set(numbers: list[int], draw: dict) -> dict:
    """한 세트와 실제 당첨번호 비교."""
    main = {
        draw.get("drwtNo1"),
        draw.get("drwtNo2"),
        draw.get("drwtNo3"),
        draw.get("drwtNo4"),
        draw.get("drwtNo5"),
        draw.get("drwtNo6"),
    }
    my = set(numbers)
    match_count = len(my.intersection(main))
    bonus = draw.get("bnusNo")
    bonus_match = bonus in my
    rank = _calc_rank(match_count, bonus_match)
    return {
        "matchCount": match_count,
        "bonusMatch": bool(bonus_match),
        "rank": rank,
    }


def _settle_logs_for_draw(draw_no: int) -> dict:
    """지정 회차의 대기 로그를 확정 처리하고 요약 반환."""
    draws = _ensure_draws()
    draw_map = {d.get("drwNo"): d for d in draws if d.get("drwNo") is not None}
    draw = draw_map.get(draw_no)
    if not draw:
        return {
            "settledLogs": 0,
            "settledSets": 0,
            "wins45": 0,
            "bestRankCount": {"1등": 0, "2등": 0, "3등": 0, "4등": 0, "5등": 0},
            "message": f"제{draw_no}회 당첨 데이터가 없어 확정할 로그가 없습니다.",
        }

    logs = _load_generated_logs()
    settled_logs = 0
    settled_sets = 0
    wins_45 = 0
    best_rank_count = {"1등": 0, "2등": 0, "3등": 0, "4등": 0, "5등": 0}
    now_iso = datetime.now(timezone.utc).isoformat()
    changed = False

    for log in logs:
        if log.get("targetDrawNo") != draw_no:
            continue
        if log.get("settledAt"):
            continue
        sets = [s for s in log.get("numbers", []) if isinstance(s, list) and len(s) == 6]
        if not sets:
            continue
        evaluations = [_evaluate_single_set(s, draw) for s in sets]
        best = sorted(evaluations, key=lambda e: (_rank_weight(e["rank"]), -e["matchCount"]))[0]
        wins = sum(1 for e in evaluations if e["rank"] in ("4등", "5등"))
        settled_logs += 1
        settled_sets += len(sets)
        wins_45 += wins
        if best["rank"] in best_rank_count:
            best_rank_count[best["rank"]] += 1

        log["settledAt"] = now_iso
        log["settledDrawNo"] = draw_no
        log["bestRank"] = best["rank"]
        log["bestMatch"] = best["matchCount"]
        log["wins45"] = wins
        changed = True

    if changed:
        try:
            _save_generated_logs(logs)
        except OSError:
            pass

    return {
        "settledLogs": settled_logs,
        "settledSets": settled_sets,
        "wins45": wins_45,
        "bestRankCount": best_rank_count,
        "message": f"제{draw_no}회 채점 완료: 로그 {settled_logs}건, 세트 {settled_sets}건 확정.",
    }


@app.route("/")
def index():
    """웹 페이지 — 번호 생성, 확률 통계, 당첨 기록. 페이지 로드 시 lotto_history.json을 HTML에 넣어 표는 곧바로 그림."""
    draws = _ensure_draws()
    html = """
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>SuperBall Lotto — 확률 번호 생성기</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #eae6e1;
            --card: #ffffff;
            --text: #1a1a1a;
            --text-muted: #5c5c5c;
            --accent: #c41e3a;
            --accent-hover: #9e1830;
            --border: #e0dcd6;
            --line: #d4cfc8;
        }
        * { box-sizing: border-box; }
        html, body { overflow-x: hidden; }
        body {
            font-family: 'DM Sans', 'Malgun Gothic', sans-serif;
            margin: 0;
            padding: 18px 14px 30px;
            background: var(--bg);
            color: var(--text);
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }
        .app-shell {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
        }
        .dashboard-grid {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .site-header {
            text-align: center;
            margin: 0 auto 14px;
            padding-bottom: 24px;
            border-bottom: 2px solid var(--line);
            position: relative;
            width: 100%;
            max-width: 1200px;
        }
        .site-header::after {
            content: '';
            display: block;
            width: 48px;
            height: 3px;
            background: var(--accent);
            margin: 20px auto 0;
        }
        .site-title {
            font-family: 'Outfit', sans-serif;
            font-size: 1.75rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--text);
            margin: 0 0 6px 0;
        }
        .site-tagline {
            font-size: 0.9rem;
            color: var(--text-muted);
            margin: 0;
            font-weight: 500;
        }
        .flow-nav {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto 10px;
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
        }
        .flow-step {
            background: #f4f1eb;
            border: 1px solid var(--border);
            border-radius: 2px;
            padding: 10px 12px;
            font-size: 0.84rem;
            color: var(--text-muted);
            transition: border-color .2s ease, box-shadow .2s ease, background .2s ease;
            text-align: left;
            cursor: pointer;
            width: 100%;
        }
        .flow-step strong {
            display: block;
            color: var(--text);
            margin-bottom: 2px;
            font-family: 'Outfit', sans-serif;
            font-size: 0.95rem;
        }
        .flow-step.active {
            background: #fff;
            border-color: var(--accent);
            box-shadow: inset 0 0 0 1px rgba(196, 30, 58, 0.1);
        }
        .flow-step.active strong { color: var(--accent); }
        .card {
            background: var(--card);
            border-radius: 2px;
            padding: 22px 22px;
            margin: 0 auto 14px;
            box-shadow: 0 1px 0 rgba(0,0,0,.06);
            border: 1px solid var(--border);
            width: 100%;
            max-width: 1200px;
        }
        .card h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 1rem;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--text);
            margin: 0 0 18px 0;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--line);
        }
        label { display: block; margin-bottom: 6px; font-weight: 700; color: var(--text); font-size: 0.93rem; }
        input, select {
            width: 100%; max-width: 300px;
            padding: 10px 12px; margin-bottom: 12px;
            border: 1px solid var(--border);
            border-radius: 2px;
            background: var(--card);
            color: var(--text);
            font-family: inherit; font-size: 1rem;
        }
        input:focus, select:focus { outline: none; border-color: var(--accent); }
        button {
            font-family: 'Outfit', sans-serif;
            font-weight: 600;
            letter-spacing: 0.04em;
            border: none;
            padding: 12px 22px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 0.9rem;
            margin-right: 8px; margin-bottom: 8px;
            transition: background .2s, color .2s;
        }
        button.primary, #btnGenerate { background: var(--accent); color: #fff; }
        button.primary:hover, #btnGenerate:hover { background: var(--accent-hover); }
        button.secondary { background: var(--text); color: #fff; }
        button.secondary:hover { background: #333; }
        #statusLine {
            font-size: 0.9rem;
            color: var(--text-muted);
            margin: 0 auto 14px;
            font-weight: 600;
            width: 100%;
            max-width: 1200px;
        }
        #result { margin-top: 20px; }
        .number-rows { list-style: none; margin: 14px 0; padding: 0; }
        .number-rows li {
            display: flex; align-items: center; flex-wrap: nowrap;
            margin-bottom: 12px; padding: 14px 16px;
            background: var(--bg);
            border-radius: 2px;
            border-left: 4px solid var(--accent);
            width: 100%; min-height: 52px;
            white-space: nowrap; overflow-x: auto;
        }
        .number-rows li .row-label { font-weight: 600; margin-right: 14px; color: var(--text); flex-shrink: 0; font-size: 0.9rem; }
        .number-rows li .balls { display: flex; flex-wrap: nowrap; gap: 8px; align-items: center; flex-shrink: 0; }
        .ball {
            width: 40px; height: 40px; min-width: 40px;
            border-radius: 50%;
            background: #999;
            color: #fff;
            border: none;
            display: inline-flex; align-items: center; justify-content: center;
            font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1rem;
            flex-shrink: 0;
        }
        /* 로또 공 번호대별 색상 */
        .ball.c-yellow, .ball-small.c-yellow, .draws-table .ball-small.c-yellow { background: #f6c945 !important; color: #222 !important; }
        .ball.c-blue, .ball-small.c-blue, .draws-table .ball-small.c-blue { background: #4d7fe6 !important; color: #fff !important; }
        .ball.c-gray, .ball-small.c-gray, .draws-table .ball-small.c-gray { background: #8d8f97 !important; color: #fff !important; }
        .ball.c-red, .ball-small.c-red, .draws-table .ball-small.c-red { background: #d94a44 !important; color: #fff !important; }
        .ball.c-green, .ball-small.c-green, .draws-table .ball-small.c-green { background: #5aa06a !important; color: #fff !important; }
        .ball.bonus { background: var(--accent); }
        .info { font-size: 0.94rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.62; }
        .notice { font-size: 0.88rem; color: #8b6914; background: #faf6eb; padding: 12px 14px; border-radius: 2px; margin-bottom: 12px; border-left: 4px solid #c9a227; }
        .success { color: #2d5a2d; background: #eef5ee; padding: 12px 14px; border-radius: 2px; margin-bottom: 12px; border-left: 4px solid #4a7c4a; }
        .error { color: var(--accent); font-weight: 500; }
        code { background: var(--bg); padding: 2px 6px; border-radius: 2px; font-size: 0.85em; color: var(--text); border: 1px solid var(--border); }
        #statsResult ul { margin: 0; padding-left: 22px; }
        #statsResult li { margin-bottom: 8px; font-size: 0.9rem; }
        .draws-table { width: 100%; border-collapse: collapse; font-size: 0.94rem; }
        .draws-table th, .draws-table td { border: 1px solid var(--border); padding: 10px 8px; text-align: center; }
        .draws-table th { background: var(--bg); font-weight: 600; color: var(--text); }
        .draws-table .ball-small {
            display: inline-block; width: 26px; height: 26px; line-height: 26px;
            border-radius: 50%; background: #999; color: #fff;
            margin: 0 2px; font-size: 0.8rem; font-weight: 700;
            font-family: 'Outfit', sans-serif;
        }
        .ball-small {
            display: inline-flex;
            width: 26px;
            height: 26px;
            line-height: 26px;
            border-radius: 50%;
            background: #999;
            color: #fff;
            margin: 0 2px;
            font-size: 0.8rem;
            font-weight: 700;
            font-family: 'Outfit', sans-serif;
            align-items: center;
            justify-content: center;
            vertical-align: middle;
        }
        .draws-table .bonus { color: var(--accent); font-weight: 700; }
        .manual-section { margin-bottom: 20px; }
        .manual-section label { font-size: 0.9rem; }
        .manual-round-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
        .manual-round-row input[type="number"] { max-width: 90px; }
        .ball-slots { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .ball-slot {
            width: 42px; height: 42px; border-radius: 50%;
            border: 2px solid var(--border);
            background: var(--card);
            display: inline-flex; align-items: center; justify-content: center;
            font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1rem; color: var(--text);
        }
        .ball-slot.bonus-slot { border-color: var(--accent); background: #fff5f7; color: var(--accent); }
        .ball-slot input { width: 100%; height: 100%; border: none; background: transparent; text-align: center; font-weight: 700; font-size: 1rem; border-radius: 50%; padding: 0; font-family: inherit; }
        .ball-slot input::-webkit-outer-spin-button, .ball-slot input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .ball-slot input[type="number"] { -moz-appearance: textfield; }
        .ball-grid { display: grid; grid-template-columns: repeat(9, 1fr); gap: 6px; max-width: 320px; margin-bottom: 14px; }
        .ball-pick {
            width: 34px; height: 34px; border-radius: 50%;
            border: 1px solid var(--border);
            background: var(--bg);
            display: flex; align-items: center; justify-content: center;
            font-size: 0.88rem; font-weight: 600; cursor: pointer; user-select: none;
            font-family: 'Outfit', sans-serif;
        }
        .ball-pick:hover { background: #ddd9d3; border-color: var(--text-muted); }
        .ball-pick.selected { background: var(--text); color: #fff; border-color: var(--text); }
        .ball-pick.bonus-picked { background: var(--accent); color: #fff; border-color: var(--accent); }
        .inline-round-input { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
        .inline-round-input input[type="number"] { padding: 8px 6px; text-align: center; }
        .divider { height: 1px; background: var(--line); margin: 20px 0; border: none; }
        .result-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .search-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0 12px; }
        .toolbar-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
        .generate-form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(320px, 1fr));
            gap: 14px 22px;
            margin-bottom: 10px;
        }
        .stats-toolbar {
            display: grid;
            grid-template-columns: auto minmax(180px, 1fr) auto minmax(140px, 1fr);
            gap: 8px 10px;
            align-items: center;
            margin-bottom: 10px;
            max-width: 760px;
        }
        .stats-toolbar label {
            margin: 0;
            font-size: 0.9rem;
            white-space: nowrap;
        }
        #cardStats .stats-toolbar select {
            max-width: 100%;
            margin-bottom: 0;
        }
        #cardStats textarea {
            width: 100%;
            max-width: 100%;
            min-height: 110px;
            font-size: 0.95rem;
            padding: 10px 12px;
            border: 1px solid var(--border);
            border-radius: 2px;
            background: var(--card);
            color: var(--text);
            font-family: inherit;
            line-height: 1.5;
        }
        .generate-field label { margin-bottom: 5px; }
        #cardGenerate .generate-field input,
        #cardGenerate .generate-field select {
            max-width: 100%;
            margin-bottom: 0;
        }
        #cardGenerate .search-row {
            margin: 0;
            width: 100%;
        }
        #cardGenerate { order: 1; }
        #cardWeeklyGenStats { order: 2; }
        #cardWeeklySummary { order: 3; }
        #cardWeeklySummary {
            border: 3px solid var(--accent);
            box-shadow: 0 8px 26px rgba(196, 30, 58, 0.20);
            background: linear-gradient(180deg, #fff8f8 0%, #fff 100%);
        }
        #cardWeeklySummary h2 {
            font-size: 1.22rem;
            text-align: center;
            color: var(--accent);
            border-bottom: 2px solid rgba(196, 30, 58, 0.35);
            margin-bottom: 14px;
        }
        #cardWeeklySummary #weeklySummaryResult {
            border: 2px solid rgba(196, 30, 58, 0.35);
            background: #fff;
            padding: 16px 14px;
            text-align: center;
        }
        #cardWeeklySummary .weekly-spotlight > .info {
            font-size: 1.14rem;
            font-weight: 700;
            margin-bottom: 10px;
        }
        #cardWeeklySummary .weekly-spotlight .ball {
            transform: scale(1.08);
            margin-right: 6px;
        }
        #cardWeeklySummary .weekly-spotlight .bonus {
            font-size: 1.08rem;
            font-weight: 700;
        }
        #cardWeeklySummary .weekly-spotlight .pattern-box .k {
            font-size: 0.92rem;
            text-align: center;
        }
        #cardWeeklySummary .weekly-spotlight .pattern-box .v {
            font-size: 1.75rem;
            text-align: center;
        }
        #cardDrawsTable { order: 4; }
        #cardStats { order: 5; }
        #cardPattern { order: 6; }
        #cardHits { order: 7; }
        #cardLogs { order: 8; }
        #cardGuide { order: 9; }
        #cardCaution { order: 10; }
        #drawOneResult .ball { margin-right: 4px; }
        #drawOneResult .info { margin-bottom: 8px; }
        #drawOneResult .bonus { color: var(--accent); font-weight: 700; margin-left: 8px; }
        .pattern-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }
        .pattern-box { border: 1px solid var(--border); background: #f8f6f2; padding: 12px; border-radius: 2px; }
        .pattern-box .k { color: var(--text-muted); font-size: 0.82rem; }
        .pattern-box .v { font-family: 'Outfit', sans-serif; font-size: 1.35rem; font-weight: 700; margin-top: 4px; }
        .pattern-title { font-weight: 700; margin-bottom: 8px; font-size: 0.95rem; }
        .zone-list { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 12px; padding: 0; list-style: none; }
        .zone-list li { background: #f0ede8; border: 1px solid var(--border); border-radius: 999px; padding: 5px 10px; font-size: 0.82rem; }
        .pattern-cases-wrap { width: 100%; overflow-x: auto; }
        .pattern-cases {
            width: 100%;
            min-width: 780px;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 0.85rem;
            table-layout: auto;
        }
        .pattern-cases th, .pattern-cases td { border: 1px solid var(--border); padding: 8px; text-align: center; }
        .pattern-cases th { background: #f4f1eb; }
        .pattern-cases th, .pattern-cases td { white-space: nowrap; word-break: keep-all; }
        .pattern-cases .nums { text-align: left; min-width: 220px; }
        .pattern-cases .ball-small { margin-bottom: 2px; }
        .rank-badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; }
        .rank-1, .rank-2, .rank-3 { background: #ffe7a3; color: #7a4e00; }
        .rank-4 { background: #e6eefc; color: #1d4ea3; }
        .rank-5 { background: #e9f7e8; color: #256b2a; }
        .status-badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:0.76rem; font-weight:700; }
        .status-pending { background:#f5ead5; color:#8a5a00; }
        .status-resolved { background:#e8f4e7; color:#2a6e2d; }
        .log-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
        .log-item { border: 1px solid var(--border); background: #f8f6f2; border-radius: 2px; padding: 10px 12px; }
        .log-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.84rem; margin-bottom: 6px; }
        .log-meta { color: var(--text-muted); font-size: 0.8rem; }
        .analysis-log { margin-top: 10px; border: 1px solid var(--border); background: #f8f6f2; padding: 10px 12px; border-radius: 2px; }
        .analysis-log summary { cursor: pointer; font-weight: 700; margin-bottom: 8px; }
        .analysis-log ul { margin: 8px 0; padding-left: 18px; }
        .analysis-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; }
        .analysis-chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; margin-left: 6px; background: #e8edf8; color: #2a4f8f; }
        .analysis-chip.aggressive { background: #fde8e8; color: #9b1c1c; }
        .analysis-chip.balanced { background: #e8edf8; color: #2a4f8f; }
        .analysis-chip.distributed { background: #e6f5ea; color: #1f6a3b; }
        .analysis-item { margin-bottom: 6px; font-size: 0.86rem; }
        .analysis-rank { color: #7a4e00; font-weight: 700; }
        .log-sets { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
        .log-set-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .log-set-label { font-size: 0.76rem; color: var(--text-muted); min-width: 28px; }
        .toast-stack {
            position: fixed;
            left: 50%;
            bottom: 18px;
            z-index: 9999;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: min(420px, calc(100vw - 16px));
        }
        .toast {
            min-width: 260px;
            padding: 12px 14px;
            border-radius: 4px;
            color: #fff;
            font-size: 0.9rem;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
            opacity: 0;
            pointer-events: none;
            transform: translateY(10px);
            transition: opacity .22s ease, transform .22s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .toast.show { opacity: 1; pointer-events: auto; transform: translateY(0); }
        .toast.success { background: #2d7a3d; }
        .toast.error { background: #b63b3b; }
        .toast.info { background: #2e5f93; }
        .toast-icon { font-size: 1rem; line-height: 1; }
        .toast-text { flex: 1; }
        .site-footer {
            width: 100%;
            max-width: 1200px;
            margin: 12px auto 0;
            padding: 14px 16px;
            border: 1px solid var(--border);
            border-left: 4px solid var(--accent);
            background: #f6f2ec;
            color: var(--text-muted);
            font-size: 0.86rem;
            line-height: 1.6;
        }
        .site-footer strong {
            color: var(--text);
            font-family: 'Outfit', sans-serif;
            letter-spacing: 0.03em;
        }
        .site-footer ul {
            margin: 8px 0 0;
            padding-left: 18px;
        }
        @media (min-width: 900px) {
            .dashboard-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 14px;
                width: min(1200px, 100%);
                margin: 0 auto;
            }
            .dashboard-grid .card { width: 100%; margin: 0; }
            .dashboard-grid .card.full { grid-column: 1 / -1; }
        }
        @media (max-width: 700px) {
            body { padding: 10px 8px 20px; }
            .card { padding: 14px 12px; }
            .site-title { font-size: 1.22rem; }
            .pattern-grid { grid-template-columns: 1fr; }
            #cardWeeklySummary h2 { font-size: 1.06rem; }
            #cardWeeklySummary .weekly-spotlight > .info { font-size: 1rem; }
            #cardWeeklySummary .weekly-spotlight .pattern-box .v { font-size: 1.35rem; }
            #btnGenerate, .result-actions button, .search-row button {
                width: 100%;
                margin-right: 0;
            }
            .search-row input { max-width: 100% !important; width: 100%; }
            .generate-form-grid { grid-template-columns: 1fr; }
            .stats-toolbar {
                grid-template-columns: 1fr;
                align-items: stretch;
            }
            .stats-toolbar label {
                margin-top: 2px;
            }
            .flow-nav { grid-template-columns: 1fr; gap: 6px; }
            .draws-table { font-size: 0.82rem; }
            .draws-table th, .draws-table td { padding: 7px 4px; }
            .ball { width: 34px; height: 34px; min-width: 34px; font-size: 0.92rem; }
            .ball-small { width: 23px; height: 23px; font-size: 0.72rem; }
            .analysis-grid { grid-template-columns: 1fr; }
            .site-footer { font-size: 0.82rem; padding: 12px; }
        }
    </style>
</head>
<body>
    <header class="site-header">
        <h1 class="site-title">SuperBall Lotto</h1>
        <p class="site-tagline">당첨 기록 기반 확률 번호 생성기</p>
    </header>
    <section class="flow-nav">
        <button type="button" class="flow-step" id="flowGroup1" data-target="cardGenerate"><strong>1~2단계: 생성/등록</strong>번호 생성 후 실제 당첨 회차를 등록합니다.</button>
        <button type="button" class="flow-step" id="flowGroup2" data-target="cardStats"><strong>3~4단계: 통계/분석</strong>확률 통계와 패턴 분석으로 흐름을 확인합니다.</button>
        <button type="button" class="flow-step" id="flowGroup3" data-target="cardHits"><strong>5~6단계: 기록/검색</strong>명예의 전당, 히스토리, 내 번호 검색으로 추적합니다.</button>
        <button type="button" class="flow-step" id="flowGroup4" data-target="cardGuide"><strong>7~8단계: 수령/주의</strong>당첨금 확인 방법과 최근 사례 기반 주의점을 확인합니다.</button>
    </section>

    <p id="statusLine" class="info">보유 회차: 불러오는 중...</p>

    <main class="app-shell dashboard-grid">
    <div class="card full" id="cardWeeklySummary">
        <h2>이번 주 당첨 요약</h2>
        <div class="toolbar-row" style="margin-bottom:8px;">
            <button type="button" id="btnWeeklySummary" class="secondary">이번 주 자동 불러오기</button>
            <button type="button" id="btnWeeklyScript" class="secondary">동행복권 추출 스크립트 보기</button>
        </div>
        <p class="info">자동 수집이 안 되면, 동행복권 결과 페이지(F12 콘솔)에서 추출한 JSON을 아래에 붙여넣어 반영할 수 있습니다.</p>
        <textarea id="weeklyManualJson" rows="3" placeholder='{"drwNo":1219,"drwNoDate":"2026-04-11","numbers":[1,2,15,28,39,45],"bonus":31,"firstPrizeWinnerCount":12,"firstPrizeAmount":2141604938,"totalSalesAmount":105407618000}' style="width:100%; max-width:100%;"></textarea>
        <div class="toolbar-row" style="margin-bottom:8px;">
            <button type="button" id="btnWeeklyManualSave" class="primary">붙여넣기 반영</button>
        </div>
        <div id="weeklySummaryResult"><p class="info">당첨 요약을 불러오는 중...</p></div>
    </div>
    <div class="card full" id="cardDrawsTable">
        <h2>2단계) 당첨 기록 확인 · 회차 등록</h2>
        <p class="info"><strong>기존 1등 당첨 기록은 직접 입력합니다.</strong> 회차와 본번호 6개·보너스 1개(총 7개)를 입력한 뒤 «이 번호로 추가»를 누르면 아래 목록에 반영됩니다. <span style="color:#666;">(저장: 서버 폴더의 lotto_history.json)</span></p>
        <label>회차 + 당첨번호 7개 입력</label>
        <div class="inline-round-input">
            <span>회차</span>
            <input type="number" id="topDrwNo" min="1" max="2000" placeholder="115" style="width:70px;">
            <span>회</span>
            <span style="margin-left:12px;">본번호 6개</span>
            <input type="number" id="topN1" min="1" max="45" placeholder="1" style="width:42px;" title="본번호 1">
            <input type="number" id="topN2" min="1" max="45" placeholder="2" style="width:42px;" title="본번호 2">
            <input type="number" id="topN3" min="1" max="45" placeholder="3" style="width:42px;" title="본번호 3">
            <input type="number" id="topN4" min="1" max="45" placeholder="4" style="width:42px;" title="본번호 4">
            <input type="number" id="topN5" min="1" max="45" placeholder="5" style="width:42px;" title="본번호 5">
            <input type="number" id="topN6" min="1" max="45" placeholder="6" style="width:42px;" title="본번호 6">
            <span style="margin-left:8px;">보너스</span>
            <input type="number" id="topBonus" min="1" max="45" placeholder="+" style="width:42px;" title="보너스">
            <button type="button" id="btnTopAdd" class="secondary" style="margin-left:12px;">이 번호로 추가</button>
        </div>
        <div id="topAddResult" style="margin-top:8px;"></div>
        <hr class="divider">
        <label>보유 회차 선택해서 보기</label>
        <input type="number" id="drawNoInput" min="1" max="2000" placeholder="회차 직접 입력 (예: 1214)" style="max-width:140px; margin-bottom:8px;">
        <span class="info" style="margin-left:6px;">회</span>
        <div id="drawOneResult" style="margin-top:12px;"></div>
        <hr class="divider">
        <p class="info">아래는 보유 중인 최근 회차 목록입니다.</p>
        <button type="button" id="btnRefreshDraws" class="secondary" style="margin-bottom:8px;">목록 새로고침</button>
        <div id="drawsTableWrap"><p class="info">당첨 기록이 없습니다. 위에서 회차와 번호 7개를 입력해 추가해 주세요.</p></div>
    </div>

    <div class="card full" id="cardGenerate">
        <h2>1단계) 번호 생성</h2>
        <div class="generate-form-grid">
            <div class="generate-field">
                <label>생성 세트 수</label>
                <input type="number" id="count" value="1" min="1" max="5">
            </div>
            <div class="generate-field">
                <label>확률 기준</label>
                <select id="recent">
                    <option value="">전체 회차</option>
                    <option value="50">최근 50회</option>
                    <option value="100">최근 100회</option>
                    <option value="200">최근 200회</option>
                </select>
            </div>
            <div class="generate-field">
                <label>닉네임 (선택)</label>
                <input type="text" id="nicknameInput" placeholder="없으면 익명으로 저장" maxlength="20">
            </div>
            <div class="generate-field">
                <label>내 번호 검색 (닉네임)</label>
                <div class="search-row">
                    <input type="text" id="nicknameSearchInput" placeholder="닉네임 입력" maxlength="20" style="max-width:none; margin:0;">
                    <button type="button" id="btnNicknameSearch" class="secondary" style="margin:0;">내 번호 검색</button>
                    <button type="button" id="btnNicknameSearchReset" class="secondary" style="margin:0;">검색 초기화</button>
                </div>
            </div>
        </div>
        <div class="toolbar-row">
            <button type="button" id="btnGenerate" class="primary">번호 생성</button>
        </div>
        <div class="result-actions toolbar-row">
            <button type="button" id="btnDownloadResult" class="secondary">결과 다운로드</button>
            <button type="button" id="btnCopyResult" class="secondary">결과 복사</button>
        </div>
        <div id="result"></div>
    </div>

    <div class="card full" id="cardWeeklyGenStats">
        <h2>이번 주 생성 번호 통계</h2>
        <div class="toolbar-row" style="margin-bottom:8px;">
            <button type="button" id="btnWeeklyGenStats" class="secondary">이번 주 통계 새로고침</button>
        </div>
        <div id="weeklyGenStatsResult"><p class="info">이번 주 생성 통계를 불러오는 중...</p></div>
    </div>

    <div class="card full" id="cardStats">
        <h2>3단계) 확률 통계 보기</h2>
        <div class="stats-toolbar">
            <button type="button" id="btnStats">확률 통계 보기</button>
            <label>기준</label>
            <select id="statsSource">
                <option value="generated">상단 번호 생성에서 나온 번호 기준</option>
                <option value="draws">당첨 기록 기준</option>
            </select>
            <label>분류</label>
            <select id="statsFilter">
                <option value="">전체</option>
                <option value="5">5회 이상 나온 번호</option>
                <option value="10">10회 이상 나온 번호</option>
                <option value="15">15회 이상 나온 번호</option>
                <option value="20">20회 이상 나온 번호</option>
            </select>
        </div>
        <label style="margin-top:8px;">직접 입력 (선택)</label>
        <p class="info" style="margin-bottom:6px;">기준이 «상단 번호 생성»일 때, 여기에 번호를 넣으면 생성 결과 대신 이걸로 통계를 냅니다. 한 줄에 6개씩, 쉼표·공백 구분. 여러 줄 가능.</p>
        <textarea id="statsManualInput" rows="4" placeholder="예: 7, 10, 15, 27, 28, 33&#10;4, 13, 16, 19, 33, 44&#10;..."></textarea>
        <div id="statsResult"></div>
    </div>

    <div class="card full" id="cardPattern">
        <h2>4단계) 패턴 분석 대시보드</h2>
        <p class="info">최근 회차와 전체 회차를 비교해 번호 분포, 연속번호, 합계 구간, 강세/약세 번호를 요약합니다.</p>
        <button type="button" id="btnPattern" class="secondary">패턴 분석 새로고침</button>
        <div id="patternResult"><p class="info">패턴 분석을 불러오는 중...</p></div>
    </div>

    <div class="card full" id="cardHits">
        <h2>5단계) 명예의 전당 · 당첨 히스토리</h2>
        <p class="info">생성한 번호를 실제 당첨 회차와 비교해 4등/5등 이상 사례를 기록합니다.</p>
        <div class="toolbar-row" style="margin-bottom:8px;">
            <button type="button" id="btnSettleLatest" class="primary">토요일 마감하기</button>
            <input type="number" id="settleDrawNoInput" min="1" max="3000" placeholder="회차 지정(선택)" style="max-width:160px; margin:0;">
        </div>
        <div id="settleResult" class="info" style="margin-bottom:8px;"></div>
        <button type="button" id="btnHitDashboard" class="secondary">히스토리 새로고침</button>
        <div id="hitDashboardResult"><p class="info">히스토리를 불러오는 중...</p></div>
    </div>

    <div class="card full" id="cardLogs">
        <h2>6단계) 실시간 번호 생성 로그</h2>
        <p class="info">닉네임, 생성 시각, 대상 회차, 현재 상태(대기중/확정)를 확인할 수 있습니다.</p>
        <button type="button" id="btnGenerationLogs" class="secondary">로그 새로고침</button>
        <div id="generationLogsResult"><p class="info">로그를 불러오는 중...</p></div>
    </div>

    <div class="card full" id="cardGuide">
        <h2>7단계) 당첨금 찾는 방법</h2>
        <ol class="info" style="padding-left:18px;">
            <li><strong>당첨 여부 1차 확인:</strong> 동행복권 공식 결과 페이지에서 회차/번호를 먼저 대조합니다.</li>
            <li><strong>등수별 수령처:</strong> 1등은 NH농협은행 본점(영업점 아님), 2~3등은 NH농협은행 전국 지점, 4~5등은 로또 판매점에서 수령합니다.</li>
            <li><strong>지급 기한:</strong> 지급개시일로부터 1년 이내 수령해야 하며, 기한 초과 시 당첨금 수령이 불가합니다.</li>
            <li><strong>준비물:</strong> 실물 복권(훼손 금지), 신분증, 필요 시 통장 정보를 준비하고, 고액 당첨은 은행 창구 안내 절차를 따르세요.</li>
            <li><strong>최종 확인:</strong> 이 사이트 결과는 보조 확인용이며, 최종 기준은 동행복권 공지/약관/지급 안내입니다.</li>
        </ol>
        <div class="toolbar-row">
            <a href="https://www.dhlottery.co.kr/lt645/result" target="_blank" rel="noopener noreferrer"><button type="button" class="secondary">공식 당첨결과 열기</button></a>
            <a href="https://www.dhlottery.co.kr/guide/wnrGuide" target="_blank" rel="noopener noreferrer"><button type="button" class="secondary">공식 지급안내 열기</button></a>
        </div>
    </div>

    <div class="card full" id="cardCaution">
        <h2>8단계) 최근 사례 기반 주의점</h2>
        <ul class="info" style="padding-left:18px;">
            <li><strong>당첨금 선입금 요구는 100% 사기:</strong> 수수료/세금 선입금 요구 메시지(문자/DM/메신저)는 즉시 차단하세요.</li>
            <li><strong>복권 사진 공유 금지:</strong> 바코드·QR·일련번호가 노출되면 도용 위험이 있어, 당첨 확인 전후 모두 촬영/공유를 피하세요.</li>
            <li><strong>분실/훼손 리스크:</strong> 고액 당첨일수록 실물 복권 보관이 중요합니다. 훼손 시 지급이 거절될 수 있습니다.</li>
            <li><strong>수령 정보는 공식 경로만:</strong> 은행/동행복권 공식 사이트 외 비공식 카페·SNS 안내는 반드시 교차검증하세요.</li>
            <li><strong>세금 인지:</strong> 고액 당첨은 세후 실수령액이 달라집니다. 예상 금액을 과신하지 말고 은행 안내를 따르세요.</li>
        </ul>
        <div class="toolbar-row">
            <a href="https://ecrm.police.go.kr/minwon/main" target="_blank" rel="noopener noreferrer"><button type="button" class="secondary">경찰청 신고/상담</button></a>
            <a href="https://www.fss.or.kr/fss/main/main.do" target="_blank" rel="noopener noreferrer"><button type="button" class="secondary">금융감독원 민원/신고</button></a>
            <a href="https://www.police.go.kr/www/security/cyber.jsp" target="_blank" rel="noopener noreferrer"><button type="button" class="secondary">사이버범죄 안내</button></a>
        </div>
        <p class="info" style="margin-top:8px;">피해가 의심되면 대화/송금/계좌 정보 캡처 후 즉시 신고하세요.</p>
    </div>

    </main>
    <footer class="site-footer" aria-label="서비스 이용상 주의사항">
        <strong>서비스 이용상 주의사항</strong>
        <ul>
            <li>본 페이지의 생성 결과와 요약 정보는 참고용 보조 도구이며, 최종 당첨 여부 및 지급 기준은 동행복권 공식 공지/안내를 따릅니다.</li>
            <li>공식 API 제한 시 일부 값은 뉴스 교차검증 기반 추정치가 포함될 수 있으므로, 고액 당첨금·당첨 인원은 반드시 공식 페이지에서 재확인해 주세요.</li>
            <li>복권 사진(바코드/QR/일련번호) 공유, 선입금 요구 메시지, 비공식 링크 안내는 사기 위험이 있으니 즉시 차단하고 신고하세요.</li>
            <li>당첨 복권은 분실/훼손되지 않도록 보관하고, 지급기한(지급개시일로부터 1년) 내 수령해 주세요.</li>
        </ul>
    </footer>
    <div id="toastStack" class="toast-stack" role="status" aria-live="polite"></div>
    <script>
        var OPENED_AS_FILE = (function() {
            if (window.location.protocol === 'file:') {
                var wrap = document.getElementById('drawsTableWrap');
                var statusLine = document.getElementById('statusLine');
                var msg = '이 페이지는 <strong>파일이 아닌, 서버 주소</strong>로 열어야 합니다. run_server.bat 실행 후 브라우저 주소창에 <code>http://127.0.0.1:5000/</code> 를 입력해 주세요.';
                if (wrap) wrap.innerHTML = '<p class="error" style="padding:16px;">' + msg + '</p>';
                if (statusLine) statusLine.textContent = '보유 회차: (서버 주소로 열어 주세요)';
                return true;
            }
            return false;
        })();
        window.__INITIAL_DRAWS__ = {{ draws | tojson }};
        const resultEl = document.getElementById('result');
        const statsEl = document.getElementById('statsResult');
        const patternEl = document.getElementById('patternResult');
        const hitEl = document.getElementById('hitDashboardResult');
        const generationLogsEl = document.getElementById('generationLogsResult');
        const settleResultEl = document.getElementById('settleResult');
        const weeklySummaryEl = document.getElementById('weeklySummaryResult');
        const weeklyGenStatsEl = document.getElementById('weeklyGenStatsResult');
        const toastStackEl = document.getElementById('toastStack');
        const flowGroup1 = document.getElementById('flowGroup1');
        const flowGroup2 = document.getElementById('flowGroup2');
        const flowGroup3 = document.getElementById('flowGroup3');
        const flowGroup4 = document.getElementById('flowGroup4');
        var nicknameFilter = '';
        var toastQueue = [];
        var activeToasts = [];
        var isToastRendering = false;

        function showToast(message, type) {
            if (!toastStackEl) return;
            toastQueue.push({ message: message, type: type || 'info' });
            if (!isToastRendering) processToastQueue();
        }
        function normalizeNullInputValue(id, placeholderValue) {
            var el = document.getElementById(id);
            if (!el) return;
            var v = (el.value || '').trim().toLowerCase();
            if (v === 'null' || v === 'none' || v === 'undefined') {
                el.value = placeholderValue || '';
            }
        }
        function sanitizeInitialInputs() {
            normalizeNullInputValue('nicknameInput', '');
            normalizeNullInputValue('nicknameSearchInput', '');
            normalizeNullInputValue('statsManualInput', '');
            normalizeNullInputValue('settleDrawNoInput', '');
        }
        function formatMoney(num) {
            var n = Number(num || 0);
            return n.toLocaleString('ko-KR');
        }
        function getStyleTagClass(styleTag) {
            var text = (styleTag || '');
            if (text.indexOf('공격형') === 0) return 'aggressive';
            if (text.indexOf('분산형') === 0) return 'distributed';
            return 'balanced';
        }
        function formatMoneyOrDash(num) {
            if (num === null || num === undefined) return '-';
            return formatMoney(num) + '원';
        }
        function processToastQueue() {
            isToastRendering = true;
            while (toastQueue.length > 0 && activeToasts.length < 3) {
                var item = toastQueue.shift();
                createToast(item.message, item.type);
            }
            isToastRendering = false;
        }
        function setActiveFlowGroup(groupNo) {
            if (!flowGroup1 || !flowGroup2 || !flowGroup3 || !flowGroup4) return;
            flowGroup1.classList.remove('active');
            flowGroup2.classList.remove('active');
            flowGroup3.classList.remove('active');
            flowGroup4.classList.remove('active');
            if (groupNo === 1) flowGroup1.classList.add('active');
            else if (groupNo === 2) flowGroup2.classList.add('active');
            else if (groupNo === 3) flowGroup3.classList.add('active');
            else flowGroup4.classList.add('active');
        }
        function bindFlowButtons() {
            [flowGroup1, flowGroup2, flowGroup3, flowGroup4].forEach(function(btn) {
                if (!btn) return;
                btn.addEventListener('click', function() {
                    var targetId = btn.getAttribute('data-target');
                    if (!targetId) return;
                    var target = document.getElementById(targetId);
                    if (!target) return;
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            });
        }
        function refreshFlowStepByScroll() {
            const cards = [
                { id: 'cardGenerate', step: 1 },
                { id: 'cardWeeklyGenStats', step: 2 },
                { id: 'cardWeeklySummary', step: 2 },
                { id: 'cardDrawsTable', step: 2 },
                { id: 'cardStats', step: 3 },
                { id: 'cardPattern', step: 4 },
                { id: 'cardHits', step: 5 },
                { id: 'cardLogs', step: 6 },
                { id: 'cardGuide', step: 7 },
                { id: 'cardCaution', step: 8 },
            ];
            var viewportRef = window.innerHeight * 0.28;
            var currentStep = 1;
            cards.forEach(function(item) {
                var el = document.getElementById(item.id);
                if (!el) return;
                var rect = el.getBoundingClientRect();
                if (rect.top <= viewportRef) currentStep = item.step;
            });
            if (currentStep <= 2) setActiveFlowGroup(1);
            else if (currentStep <= 4) setActiveFlowGroup(2);
            else if (currentStep <= 6) setActiveFlowGroup(3);
            else setActiveFlowGroup(4);
        }
        function renderWeeklySummary(data) {
            if (!data || data.error) {
                weeklySummaryEl.innerHTML = '<p class="error">' + ((data && data.error) || '당첨 요약을 가져오지 못했습니다.') + '</p>';
                return;
            }
            var nums = data.numbers || [];
            var html = '<div class="weekly-spotlight">';
            html += '<p class="info"><strong>제' + data.drwNo + '회</strong> (' + (data.drwNoDate || '-') + ')</p><p>';
            nums.forEach(function(n) { html += '<span class="ball ' + getBallColorClass(n) + '">' + n + '</span>'; });
            html += '<span class="bonus"> + 보너스 ' + (data.bonus != null ? data.bonus : '-') + '</span></p>';
            if (data.dataSource === 'local_cache') {
                html += '<p class="notice">공식 API 응답 제한으로 1등 인원/당첨금은 가져오지 못했습니다. 번호/추첨일은 로컬 기록 기준으로 표시했습니다.</p>';
            } else if (data.dataSource === 'news_rss') {
                html += '<p class="notice">공식 API가 제한되어 뉴스 헤드라인 교차검증으로 추정한 값입니다. 정확한 금액/인원은 공식 발표를 확인해 주세요. (신뢰도: ' + (data.newsConfidence || 'medium') + ')</p>';
                if (data.newsHeadlines && data.newsHeadlines.length > 0) {
                    html += '<ul>';
                    data.newsHeadlines.forEach(function(h) { html += '<li class="info">' + h + '</li>'; });
                    html += '</ul>';
                } else if (data.newsHeadline) {
                    html += '<p class="info">참고 뉴스: ' + data.newsHeadline + '</p>';
                }
            }
            html += '<div class="pattern-grid">';
            html += '<div class="pattern-box"><div class="k">1등 당첨 인원</div><div class="v">' + (data.firstPrizeWinnerCount == null ? '-' : (data.firstPrizeWinnerCount + '명')) + '</div></div>';
            html += '<div class="pattern-box"><div class="k">1등 1인당 당첨금</div><div class="v">' + formatMoneyOrDash(data.firstPrizeAmount) + '</div></div>';
            html += '<div class="pattern-box"><div class="k">총 판매금액</div><div class="v">' + formatMoneyOrDash(data.totalSalesAmount) + '</div></div>';
            var sourceName = '로컬 기록';
            if (data.dataSource === 'official_api') sourceName = '동행복권 API';
            else if (data.dataSource === 'news_rss') sourceName = '뉴스 RSS(추정)';
            html += '<div class="pattern-box"><div class="k">데이터 출처</div><div class="v">' + sourceName + '</div></div>';
            html += '</div>';
            html += '</div>';
            weeklySummaryEl.innerHTML = html;
        }
        async function loadWeeklySummary() {
            if (OPENED_AS_FILE) return;
            weeklySummaryEl.innerHTML = '<p class="info">당첨 요약을 불러오는 중...</p>';
            try {
                var r = await fetch('/api/weekly_summary');
                var d = await r.json();
                renderWeeklySummary(d);
            } catch (e) {
                weeklySummaryEl.innerHTML = '<p class="error">요청 실패: ' + e.message + '</p>';
            }
        }
        function getWeeklyExtractScript() {
            return "(function(){\\n"
              + "  const text=document.body.innerText;\\n"
              + "  const drw=(text.match(/([0-9]{3,4})\\uD68C\\s*\\uCD94\\uCCA8/)||[])[1];\\n"
              + "  const date=(text.match(/([0-9]{4}\\.[0-9]{2}\\.[0-9]{2})\\s*\\uCD94\\uCCA8/)||[])[1];\\n"
              + "  const balls=[...document.querySelectorAll('span.ball_645')].map(e=>parseInt(e.textContent,10)).filter(n=>!isNaN(n));\\n"
              + "  const nums=balls.slice(0,6); const bonus=balls[6]||null;\\n"
              + "  const oneCnt=(text.match(/1\\uB4F1\\s*\\uB2F9\\uCCA8\\uAC8C\\uC784\\s*\\uC218\\s*([0-9,]+)/)||[])[1];\\n"
              + "  const oneAmt=(text.match(/1\\uAC8C\\uC784\\uB2F9\\s*\\uB2F9\\uCCA8\\uAE08\\s*([0-9,]+)/)||[])[1];\\n"
              + "  const sell=(text.match(/\\uCD1D\\uD310\\uB9E4\\uAE08\\uC561\\s*:?\\s*([0-9,]+)/)||[])[1];\\n"
              + "  const out={drwNo:drw?parseInt(drw,10):null,drwNoDate:date?date.replace(/\\./g,'-'):null,numbers:nums,bonus:bonus,firstPrizeWinnerCount:oneCnt?parseInt(oneCnt.replace(/,/g,''),10):null,firstPrizeAmount:oneAmt?parseInt(oneAmt.replace(/,/g,''),10):null,totalSalesAmount:sell?parseInt(sell.replace(/,/g,''),10):null};\\n"
              + "  console.log(JSON.stringify(out));\\n"
              + "  return out;\\n"
              + "})();";
        }
        async function saveWeeklyManualJson() {
            const raw = (document.getElementById('weeklyManualJson').value || '').trim();
            if (!raw) {
                showToast('붙여넣을 JSON이 비어 있습니다.', 'error');
                return;
            }
            let obj;
            try {
                obj = JSON.parse(raw);
            } catch (e) {
                showToast('JSON 형식이 올바르지 않습니다.', 'error');
                return;
            }
            try {
                const r = await fetch('/api/weekly_summary_manual', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(obj),
                });
                const d = await r.json();
                if (d.error) {
                    showToast('반영 실패: ' + d.error, 'error');
                    return;
                }
                showToast(d.message, 'success');
                loadWeeklySummary();
            } catch (e) {
                showToast('반영 요청 실패: ' + e.message, 'error');
            }
        }
        function createToast(message, type) {
            var icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
            var el = document.createElement('div');
            el.className = 'toast ' + type;
            el.innerHTML = '<span class="toast-icon">' + icon + '</span><span class="toast-text">' + message + '</span>';
            toastStackEl.appendChild(el);
            activeToasts.push(el);
            requestAnimationFrame(function() { el.classList.add('show'); });
            var remove = function() {
                el.classList.remove('show');
                setTimeout(function() {
                    if (el.parentNode) el.parentNode.removeChild(el);
                    activeToasts = activeToasts.filter(function(t) { return t !== el; });
                    processToastQueue();
                }, 220);
            };
            var timer = setTimeout(remove, 3600);
            el.addEventListener('click', function() {
                clearTimeout(timer);
                remove();
            });
        }

        async function refreshStatus() {
            try {
                const r = await fetch('/api/status');
                const d = await r.json();
                document.getElementById('statusLine').textContent = '보유 회차: ' + (d.total_draws || 0) + '회차';
                return d;
            } catch (e) { document.getElementById('statusLine').textContent = '보유 회차: 확인 실패'; return {}; }
        }
        function getBallColorClass(num) {
            var n = Number(num);
            if (n >= 1 && n <= 10) return 'c-yellow';
            if (n >= 11 && n <= 20) return 'c-blue';
            if (n >= 21 && n <= 30) return 'c-red';
            if (n >= 31 && n <= 40) return 'c-gray';
            if (n >= 41 && n <= 45) return 'c-green';
            return '';
        }
        function fillDrawsTableFromData(rows) {
            const wrap = document.getElementById('drawsTableWrap');
            if (!wrap) return;
            if (!rows || rows.length === 0) { wrap.innerHTML = '<p class="info">당첨 기록이 없습니다. 위에서 회차와 번호 7개를 입력해 추가해 주세요.</p>'; return; }
            var selectedNo = document.getElementById('drawNoInput').value ? parseInt(document.getElementById('drawNoInput').value, 10) : null;
            if (isNaN(selectedNo)) selectedNo = null;
            // 목록 순서가 loadDrawsList(최신순) / refreshDrawsTable(오래된순)에 따라 달라지므로, 회차 기준 오름차순으로 통일 후 인덱스 계산
            var sorted = rows.slice().sort(function(a, b) { return Number(a.drwNo) - Number(b.drwNo); });
            var show = [];
            var notFoundMsg = '';
            if (selectedNo != null) {
                var num = Number(selectedNo);
                var idx = sorted.findIndex(function(row) { return Number(row.drwNo) === num; });
                if (idx === 0) { show = sorted.slice(0, 3); } else if (idx >= 0) { var start = Math.max(0, idx - 2); show = sorted.slice(start, start + 5);                 } else {
                    notFoundMsg = '선택한 ' + selectedNo + '회는 현재 목록에 없습니다. 목록을 다시 불러오는 중…';
                    show = sorted.slice(-5);
                    if (typeof refreshDrawsTable === 'function') refreshDrawsTable();
                }
            } else { show = sorted.slice(-5); }
            // 표에는 최신 회차가 위로 오도록 역순으로 표시
            show = show.slice().reverse();
            var html = '';
            if (notFoundMsg) html += '<p class="info" style="margin-bottom:8px;">' + notFoundMsg + '</p>';
            html += '<table class="draws-table"><thead><tr><th>회차</th><th>추첨일</th><th>당첨번호</th><th>보너스</th></tr></thead><tbody>';
            show.forEach(function(row) {
                var nums = [row.drwtNo1, row.drwtNo2, row.drwtNo3, row.drwtNo4, row.drwtNo5, row.drwtNo6].filter(function(x){ return x != null; });
                html += '<tr><td>' + (row.drwNo || '') + '</td><td>' + (row.drwNoDate && row.drwNoDate.trim && row.drwNoDate.trim() ? row.drwNoDate : '직접입력') + '</td><td>';
                nums.forEach(function(n){ html += '<span class="ball-small ' + getBallColorClass(n) + '">' + n + '</span>'; });
                html += '</td><td class="bonus">' + (row.bnusNo != null ? row.bnusNo : '-') + '</td></tr>';
            });
            html += '</tbody></table>';
            wrap.innerHTML = html;
        }
        async function refreshDrawsTable() {
            const wrap = document.getElementById('drawsTableWrap');
            if (!wrap || OPENED_AS_FILE) return;
            var url = (window.location.origin || '') + '/api/draws?limit=200';
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(function() { controller.abort(); }, 10000);
                const r = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                const d = await r.json();
                if (d.error) { wrap.innerHTML = '<p class="error">' + d.error + '</p>'; return; }
                var rows = (d.draws || []).slice();
                window.__CURRENT_DRAWS__ = rows.slice().reverse();
                fillDrawsTableFromData(window.__CURRENT_DRAWS__);
            } catch (e) {
                var msg = e.name === 'AbortError' ? '시간 초과. 서버가 실행 중인지 확인해 주세요. (run_server.bat)' : (e.message || '네트워크 오류');
                wrap.innerHTML = '<p class="error">불러오기 실패: ' + msg + '</p>';
            }
        }
        function renderDrawOne(draw) {
            if (!draw) return '';
            const nums = [draw.drwtNo1, draw.drwtNo2, draw.drwtNo3, draw.drwtNo4, draw.drwtNo5, draw.drwtNo6].filter(function(x){ return x != null; });
            let h = '<p class="info"><strong>제' + draw.drwNo + '회</strong> ' + (draw.drwNoDate || '') + '</p><p>';
            nums.forEach(function(n){ h += '<span class="ball ' + getBallColorClass(n) + '">' + n + '</span>'; });
            h += ' <span class="bonus" style="margin-left:8px;">+ 보너스 ' + (draw.bnusNo != null ? draw.bnusNo : '-') + '</span></p>';
            return h;
        }
        function applyDrawNoView() {
            const no = document.getElementById('drawNoInput').value.trim();
            const res = document.getElementById('drawOneResult');
            if (!no) {
                res.innerHTML = '';
                if (window.__CURRENT_DRAWS__ && window.__CURRENT_DRAWS__.length > 0) fillDrawsTableFromData(window.__CURRENT_DRAWS__);
                else refreshDrawsTable();
                return;
            }
            // 목록은 이미 갖고 있으면 그대로 사용해 표만 갱신 (회차 입력만 바꿀 때 1135·1134 등이 정상 표시되도록)
            if (window.__CURRENT_DRAWS__ && window.__CURRENT_DRAWS__.length > 0) fillDrawsTableFromData(window.__CURRENT_DRAWS__);
            res.innerHTML = '불러오는 중...';
            fetch('/api/draw_by_no?drwNo=' + no).then(function(r) { return r.json(); }).then(function(d) {
                if (d.draw) { res.innerHTML = renderDrawOne(d.draw); return; }
                res.innerHTML = '<p class="info">캐시에 없습니다. 위에서 회차와 번호 7개를 입력해 «이 번호로 추가»해 보세요.</p>';
            }).catch(function() { res.innerHTML = '<span class="error">요청 실패</span>'; });
        }
        document.getElementById('drawNoInput').onchange = applyDrawNoView;
        document.getElementById('drawNoInput').oninput = function() {
            if (window.__CURRENT_DRAWS__ && window.__CURRENT_DRAWS__.length > 0) fillDrawsTableFromData(window.__CURRENT_DRAWS__);
        };
        document.getElementById('drawNoInput').onkeydown = function(e) {
            if (e.key === 'Enter') { e.preventDefault(); applyDrawNoView(); }
        };
        var btnRefreshDraws = document.getElementById('btnRefreshDraws');
        if (btnRefreshDraws) btnRefreshDraws.onclick = function() { document.getElementById('drawsTableWrap').innerHTML = '<p>불러오는 중...</p>'; refreshDrawsTable(); };
        document.getElementById('btnTopAdd').onclick = async () => {
            const res = document.getElementById('topAddResult');
            const drwNo = document.getElementById('topDrwNo').value.trim();
            const n1 = document.getElementById('topN1').value.trim();
            const n2 = document.getElementById('topN2').value.trim();
            const n3 = document.getElementById('topN3').value.trim();
            const n4 = document.getElementById('topN4').value.trim();
            const n5 = document.getElementById('topN5').value.trim();
            const n6 = document.getElementById('topN6').value.trim();
            const bonus = document.getElementById('topBonus').value.trim();
            if (!drwNo) { res.innerHTML = '<span class="error">회차를 입력해 주세요.</span>'; return; }
            const numbers = [n1,n2,n3,n4,n5,n6].filter(Boolean).map(Number);
            if (numbers.length !== 6) { res.innerHTML = '<span class="error">본번호 6개를 모두 입력해 주세요.</span>'; return; }
            res.innerHTML = '추가 중...';
            try {
                const body = { drwNo: parseInt(drwNo, 10), numbers: numbers };
                var b = parseInt(bonus, 10);
                if (bonus !== '' && !isNaN(b) && b >= 1 && b <= 45) body.bonus = b;
                const r = await fetch('/api/add_manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const d = await r.json();
                if (d.error) { res.innerHTML = '<span class="error">' + d.error + '</span>'; return; }
                res.innerHTML = '<span class="success">' + d.message + '</span>';
                await refreshStatus();
                refreshDrawsTable();
                document.getElementById('drawNoInput').value = drwNo;
                applyDrawNoView();
                try {
                    const settleResp = await fetch('/api/settle', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ drawNo: parseInt(drwNo, 10) })
                    });
                    const settleData = await settleResp.json();
                    if (!settleData.error) {
                        settleResultEl.textContent = settleData.message + ' (4/5등 ' + (settleData.wins45 || 0) + '건)';
                        showToast('회차 등록 후 자동 채점 완료', 'success');
                    }
                } catch (e) {}
                loadHitDashboard();
            } catch (e) { res.innerHTML = '<span class="error">요청 실패: ' + e.message + '</span>'; }
        };

        if (!OPENED_AS_FILE) refreshStatus().then(function() {});
        if (!OPENED_AS_FILE) {
            function showDraws(rows) {
                if (!rows || rows.length === 0) return;
                var list = rows.slice().reverse();
                window.__CURRENT_DRAWS__ = list;
                fillDrawsTableFromData(list);
                var sl = document.getElementById('statusLine');
                if (sl) sl.textContent = '보유 회차: ' + rows.length + '회차';
            }
            function loadDrawsList() {
                var url = (window.location.origin || '') + '/api/draws?limit=200';
                fetch(url).then(function(r) { return r.json(); }).then(function(d) {
                    var rows = (d && d.draws) ? d.draws : [];
                    if (rows.length === 0 && window.__INITIAL_DRAWS__ && window.__INITIAL_DRAWS__.length > 0) rows = window.__INITIAL_DRAWS__;
                    if (rows.length > 0) {
                        window.__CURRENT_DRAWS__ = rows.slice().reverse();
                        fillDrawsTableFromData(window.__CURRENT_DRAWS__);
                        var sl = document.getElementById('statusLine');
                        if (sl) sl.textContent = '보유 회차: ' + (d.total != null ? d.total : rows.length) + '회차';
                    }
                }).catch(function() {
                    if (window.__INITIAL_DRAWS__ && window.__INITIAL_DRAWS__.length > 0) showDraws(window.__INITIAL_DRAWS__);
                    else refreshDrawsTable();
                });
            }
            if (window.__INITIAL_DRAWS__ && window.__INITIAL_DRAWS__.length > 0) {
                showDraws(window.__INITIAL_DRAWS__);
            }
            loadDrawsList();
        }
        setTimeout(function() {
            if (OPENED_AS_FILE) return;
            var w = document.getElementById('drawsTableWrap');
            if (w && w.innerHTML.indexOf('불러오는 중') !== -1) refreshDrawsTable();
        }, 2500);
        setInterval(function() { if (!OPENED_AS_FILE) refreshStatus(); }, 8000);

        document.getElementById('btnGenerate').onclick = async () => {
            const count = document.getElementById('count').value || 1;
            const recent = document.getElementById('recent').value || '';
            const nickname = (document.getElementById('nicknameInput').value || '').trim();
            resultEl.innerHTML = '생성 중...';
            try {
                const url = '/api/generate?count=' + count + (recent ? '&recent=' + recent : '') + (nickname ? '&nickname=' + encodeURIComponent(nickname) : '');
                const r = await fetch(url);
                const data = await r.json();
                if (data.error) { resultEl.innerHTML = '<span class="error">' + data.error + '</span>'; return; }
                window._lastGeneratedNumbers = data.numbers;
                window._lastGeneratedInfo = data.info || '';
                window._lastGeneratedNickname = data.nickname || '익명';
                let html = '<p class="info">' + data.info + '</p><ol class="number-rows">';
                data.numbers.forEach((set, i) => {
                    html += '<li><span class="row-label">' + (i+1) + '.</span><span class="balls">';
                    set.forEach(n => { html += '<span class="ball ' + getBallColorClass(n) + '">' + n + '</span>'; });
                    html += '</span></li>';
                });
                html += '</ol>';
                if (data.analysisLog) {
                    html += '<details class="analysis-log"><summary>번호가 이렇게 나온 이유 보기 (분석 로그)</summary>';
                    html += '<p class="info">기준: ' + (data.analysisLog.mode || '-') + '</p>';
                    if (data.analysisLog.topNumbers && data.analysisLog.topNumbers.length > 0) {
                        html += '<p class="info">확률 상위 번호 Top 10</p><ul>';
                        data.analysisLog.topNumbers.forEach(function(item) {
                            html += '<li>번호 ' + item.num + ' · 출현 확률 ' + item.prob + '%</li>';
                        });
                        html += '</ul>';
                    }
                    if (data.analysisLog.setLogs && data.analysisLog.setLogs.length > 0) {
                        html += '<div class="analysis-grid">';
                        data.analysisLog.setLogs.forEach(function(log) {
                            var chipClass = getStyleTagClass(log.styleTag);
                            html += '<div class="pattern-box"><div class="k">' + log.setIndex + '세트 평균 확률 <span class="analysis-chip ' + chipClass + '">' + (log.styleTag || '균형형') + '</span></div><div class="v">' + log.avgProb + '%</div><div class="k">';
                            (log.entries || []).forEach(function(e) {
                                html += '<div class="analysis-item">번호 ' + e.num + ' · ' + e.prob + '% <span class="analysis-rank">(상위 ' + e.rank + '위)</span></div>';
                            });
                            html += '</div></div>';
                        });
                        html += '</div>';
                    }
                    html += '</details>';
                }
                resultEl.innerHTML = html;
                loadWeeklyGenerationStats();
                loadHitDashboard();
                loadGenerationLogs();
            } catch (e) {
                resultEl.innerHTML = '<span class="error">요청 실패: ' + e.message + '</span>';
            }
        };
        function getGeneratedResultText() {
            var sets = window._lastGeneratedNumbers || [];
            if (!sets || sets.length === 0) return '';
            var lines = [];
            var now = new Date();
            var timestamp = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            lines.push('SuperBall Lotto 번호 생성 결과');
            lines.push('생성시각: ' + timestamp);
            lines.push('닉네임: ' + (window._lastGeneratedNickname || '익명'));
            lines.push('기준: ' + (window._lastGeneratedInfo || '-'));
            lines.push('');
            sets.forEach(function(set, i) {
                lines.push((i + 1) + '세트: ' + set.join(', '));
            });
            return lines.join('\\n');
        }
        document.getElementById('btnDownloadResult').onclick = function() {
            var text = getGeneratedResultText();
            if (!text) {
                resultEl.innerHTML = '<span class="error">먼저 번호를 생성해 주세요.</span>';
                return;
            }
            var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            var now = new Date();
            var filename = 'lotto_generated_' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '_' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + '.txt';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
        document.getElementById('btnCopyResult').onclick = async function() {
            var text = getGeneratedResultText();
            if (!text) {
                resultEl.innerHTML = '<span class="error">먼저 번호를 생성해 주세요.</span>';
                return;
            }
            try {
                await navigator.clipboard.writeText(text);
                resultEl.innerHTML = '<span class="success">번호 생성 결과를 클립보드에 복사했습니다.</span>' + resultEl.innerHTML;
            } catch (e) {
                resultEl.innerHTML = '<span class="error">복사 실패: 브라우저 권한을 확인해 주세요.</span>' + resultEl.innerHTML;
            }
        };

        document.getElementById('btnStats').onclick = async () => {
            var source = document.getElementById('statsSource').value;
            statsEl.innerHTML = '불러오는 중...';
            if (source === 'generated') {
                var manualText = (document.getElementById('statsManualInput').value || '').trim();
                var sets = [];
                if (manualText) {
                    var lines = manualText.split(new RegExp('\\\\r?\\\\n'));
                    lines.forEach(function(line) {
                        var part = line.replace(/,/g, ' ').split(new RegExp('\\\\s+')).filter(Boolean).map(function(x) { return parseInt(x, 10); }).filter(function(n) { return n >= 1 && n <= 45; });
                        if (part.length > 0) sets.push(part.length === 6 ? part : part.slice(0, 6));
                    });
                }
                if (sets.length === 0 && window._lastGeneratedNumbers && window._lastGeneratedNumbers.length > 0) {
                    sets = window._lastGeneratedNumbers;
                }
                if (sets.length > 0) {
                    var flat = [];
                    sets.forEach(function(s) { s.forEach(function(n) { flat.push(n); }); });
                    var generatedSet = {};
                    flat.forEach(function(n) { generatedSet[n] = true; });
                    try {
                        var r = await fetch('/api/stats');
                        var drawData = await r.json();
                        if (drawData.error || !drawData.top_numbers) {
                            statsEl.innerHTML = '<span class="error">당첨 기록을 불러올 수 없습니다.</span>';
                            return;
                        }
                        var top_numbers = (drawData.top_numbers || []).filter(function(item) { return generatedSet[item.num]; });
                        var data = {
                            info: '표시 번호: ' + (manualText ? '직접 입력' : '상단 번호 생성') + '에 나온 번호만. 출현·확률: 당첨 기록(전체 회차) 기준 — ' + (drawData.info || ''),
                            notice: drawData.notice || null,
                            top_numbers: top_numbers
                        };
                        window._lastStatsData = data;
                        renderStatsResult(data);
                    } catch (e) {
                        statsEl.innerHTML = '<span class="error">당첨 기록 조회 실패: ' + e.message + '</span>';
                    }
                    return;
                }
                if (sets.length === 0) {
                    statsEl.innerHTML = '<p class="info">상단 «번호 생성»을 실행하거나, 위 직접 입력란에 번호를 넣은 뒤 확률 통계 보기를 눌러 주세요.</p>';
                    return;
                }
            }
            try {
                const r = await fetch('/api/stats');
                const data = await r.json();
                if (data.error) { statsEl.innerHTML = '<span class="error">' + data.error + '</span>'; return; }
                window._lastStatsData = data;
                renderStatsResult(data);
            } catch (e) {
                statsEl.innerHTML = '<span class="error">요청 실패: ' + e.message + '</span>';
            }
        };
        function renderStatsResult(data) {
            var minCount = document.getElementById('statsFilter').value ? parseInt(document.getElementById('statsFilter').value, 10) : 0;
            var list = (data.top_numbers || []).filter(function(item) { return item.count >= minCount; });
            var html = '<p class="info">' + data.info + '</p>';
            if (data.notice) { html += '<p class="notice">' + data.notice + '</p>'; }
            if (list.length === 0) {
                html += '<p class="info">해당 조건에 맞는 번호가 없습니다.</p>';
            } else {
                if (minCount) html += '<p class="info">' + minCount + '회 이상 나온 번호 ' + list.length + '개</p>';
                html += '<ul>';
                list.forEach(function(item) {
                    html += '<li>번호 ' + item.num + ' — 출현 ' + item.count + '회, 확률 ' + item.prob + '%</li>';
                });
                html += '</ul>';
            }
            statsEl.innerHTML = html;
        }
        function renderPatternDashboard(data) {
            if (!data || data.error) {
                patternEl.innerHTML = '<p class="error">' + ((data && data.error) || '패턴 분석 데이터를 불러오지 못했습니다.') + '</p>';
                return;
            }
            var html = '<p class="info">' + (data.info || '') + '</p>';
            if (data.latestDraw && data.latestDraw.numbers) {
                html += '<div class="pattern-title">최신 회차: 제' + data.latestDraw.drwNo + '회 (' + data.latestDraw.date + ')</div><p>';
                data.latestDraw.numbers.forEach(function(n) {
                    html += '<span class="ball ' + getBallColorClass(n) + '">' + n + '</span>';
                });
                html += '<span class="bonus"> + 보너스 ' + (data.latestDraw.bonus != null ? data.latestDraw.bonus : '-') + '</span></p>';
            }
            var cards = data.summaryCards || [];
            if (cards.length > 0) {
                html += '<div class="pattern-grid">';
                cards.forEach(function(c) {
                    html += '<div class="pattern-box"><div class="k">' + c.title + '</div><div class="v">' + c.value + '</div><div class="k">' + c.sub + '</div></div>';
                });
                html += '</div>';
            }
            var zones = data.zoneStats || [];
            if (zones.length > 0) {
                html += '<div class="pattern-title">번호 구간 분포</div><ul class="zone-list">';
                zones.forEach(function(z) {
                    html += '<li>' + z.label + ' · ' + z.count + '회 (' + z.ratio + '%)</li>';
                });
                html += '</ul>';
            }
            var insights = data.insights || [];
            if (insights.length > 0) {
                html += '<div class="pattern-title">핵심 인사이트</div><ul>';
                insights.forEach(function(text) { html += '<li>' + text + '</li>'; });
                html += '</ul>';
            }
            var cases = data.recentCases || [];
            if (cases.length > 0) {
                html += '<div class="pattern-title">최근 당첨 사례 (5회)</div>';
                html += '<div class="pattern-cases-wrap"><table class="pattern-cases"><thead><tr><th>회차</th><th>합계</th><th>홀:짝</th><th>저:고</th><th>연속쌍</th><th class="nums">번호</th></tr></thead><tbody>';
                cases.forEach(function(row) {
                    html += '<tr><td>' + row.drwNo + '</td><td>' + row.sum + '</td><td>' + row.oddEven + '</td><td>' + row.lowHigh + '</td><td>' + row.consecutivePairs + '</td><td class="nums">';
                    (row.numbers || []).forEach(function(n) { html += '<span class="ball-small ' + getBallColorClass(n) + '">' + n + '</span>'; });
                    html += '</td></tr>';
                });
                html += '</tbody></table></div>';
            }
            patternEl.innerHTML = html;
        }
        async function loadPatternDashboard() {
            if (OPENED_AS_FILE) return;
            patternEl.innerHTML = '<p class="info">패턴 분석을 불러오는 중...</p>';
            try {
                var r = await fetch('/api/patterns?recent=50');
                var d = await r.json();
                renderPatternDashboard(d);
            } catch (e) {
                patternEl.innerHTML = '<p class="error">패턴 분석 요청 실패: ' + e.message + '</p>';
            }
        }
        function renderWeeklyGenerationStats(data) {
            if (!data || data.error) {
                weeklyGenStatsEl.innerHTML = '<p class="error">' + ((data && data.error) || '이번 주 생성 통계를 불러오지 못했습니다.') + '</p>';
                return;
            }
            var html = '<p class="info"><strong>제' + data.targetDrawNo + '회 추첨 대상</strong> · 최근 ' + data.days + '일 · 생성 로그 ' + data.logCount + '건 집계</p>';
            html += '<div class="pattern-grid">';
            html += '<div class="pattern-box"><div class="k">이번 주 생성 세트</div><div class="v">' + (data.generatedSetCount || 0) + '</div><div class="k">전체 사용자 합산</div></div>';
            html += '<div class="pattern-box"><div class="k">참여 닉네임 수</div><div class="v">' + (data.uniqueNicknameCount || 0) + '</div><div class="k">익명 포함 고유 참여자</div></div>';
            html += '<div class="pattern-box"><div class="k">미선택 번호</div><div class="v">' + (data.unselectedCount || 0) + '</div><div class="k">이번 주 한 번도 안 뽑힌 번호</div></div>';
            html += '<div class="pattern-box"><div class="k">총 선택 횟수</div><div class="v">' + (data.totalNumberPicks || 0) + '</div><div class="k">세트 내 번호 선택 누적</div></div>';
            html += '</div>';
            html += '<div class="pattern-grid">';
            html += '<div class="pattern-box"><div class="pattern-title">이번 주 인기 번호 TOP 5</div>';
            if (!data.top5 || data.top5.length === 0) {
                html += '<p class="info">아직 집계할 생성 로그가 없습니다.</p>';
            } else {
                html += '<p>';
                data.top5.forEach(function(item) { html += '<span class="ball ' + getBallColorClass(item.num) + '">' + item.num + '</span>'; });
                html += '</p><p class="info">';
                data.top5.forEach(function(item) { html += '<span style="display:inline-block; margin-right:8px;">' + item.num + '번(' + item.count + '회)</span>'; });
                html += '</p>';
            }
            html += '</div>';
            html += '<div class="pattern-box"><div class="pattern-title">이번 주 저빈도 번호 TOP 5</div>';
            if (!data.cold5 || data.cold5.length === 0) {
                html += '<p class="info">아직 집계할 생성 로그가 없습니다.</p>';
            } else {
                html += '<p>';
                data.cold5.forEach(function(item) { html += '<span class="ball ' + getBallColorClass(item.num) + '">' + item.num + '</span>'; });
                html += '</p><p class="info">';
                data.cold5.forEach(function(item) { html += '<span style="display:inline-block; margin-right:8px;">' + item.num + '번(' + item.count + '회)</span>'; });
                html += '</p>';
            }
            html += '</div></div>';
            weeklyGenStatsEl.innerHTML = html;
        }
        async function loadWeeklyGenerationStats() {
            if (OPENED_AS_FILE) return;
            weeklyGenStatsEl.innerHTML = '<p class="info">이번 주 생성 통계를 불러오는 중...</p>';
            try {
                var r = await fetch('/api/weekly_generation_stats');
                var d = await r.json();
                renderWeeklyGenerationStats(d);
            } catch (e) {
                weeklyGenStatsEl.innerHTML = '<p class="error">통계 요청 실패: ' + e.message + '</p>';
            }
        }
        function rankClass(rank) {
            if (rank === '1등') return 'rank-1';
            if (rank === '2등') return 'rank-2';
            if (rank === '3등') return 'rank-3';
            if (rank === '4등') return 'rank-4';
            if (rank === '5등') return 'rank-5';
            return '';
        }
        function renderHitDashboard(data) {
            if (!data || data.error) {
                hitEl.innerHTML = '<p class="error">' + ((data && data.error) || '히스토리 데이터를 불러오지 못했습니다.') + '</p>';
                return;
            }
            var weekly = data.weeklyReport || {};
            var html = '<p class="info">' + (data.info || '') + '</p>';
            html += '<div class="pattern-grid">';
            html += '<div class="pattern-box"><div class="k">최근 7일 생성 세트</div><div class="v">' + (weekly.generatedSets || 0) + '</div><div class="k">전체 생성 기준</div></div>';
            html += '<div class="pattern-box"><div class="k">최근 7일 확정 세트</div><div class="v">' + (weekly.resolvedSets || 0) + '</div><div class="k">당첨회차 확정된 세트</div></div>';
            html += '<div class="pattern-box"><div class="k">최근 7일 4/5등</div><div class="v">' + (weekly.wins45 || 0) + '</div><div class="k">4등 + 5등 누적</div></div>';
            html += '<div class="pattern-box"><div class="k">최근 7일 4/5등 비율</div><div class="v">' + (weekly.hitRate45 || '0.00') + '%</div><div class="k">확정 세트 대비</div></div>';
            html += '</div>';

            var hall = data.hallOfFame || [];
            html += '<div class="pattern-title">명예의 전당 (4등 이상 상위 10건)</div>';
            if (hall.length === 0) {
                html += '<p class="info">아직 명예의 전당 기록이 없습니다. 번호를 생성하고 회차 데이터가 업데이트되면 자동으로 누적됩니다.</p>';
            } else {
                html += '<div class="pattern-cases-wrap"><table class="pattern-cases"><thead><tr><th>등수</th><th>회차</th><th>일자</th><th>일치</th><th>번호</th></tr></thead><tbody>';
                hall.forEach(function(row) {
                    html += '<tr><td><span class="rank-badge ' + rankClass(row.rank) + '">' + row.rank + '</span></td><td>' + row.targetDrawNo + '회</td><td>' + row.targetDate + '</td><td>' + row.matchCount + '개' + (row.bonusMatch ? ' + 보너스' : '') + '</td><td class="nums">';
                    (row.numbers || []).forEach(function(n) { html += '<span class="ball-small ' + getBallColorClass(n) + '">' + n + '</span>'; });
                    html += ' <span class="log-meta">(' + (row.nickname || '익명') + ')</span></td></tr>';
                });
                html += '</tbody></table></div>';
            }

            var recentHits = data.recentHits || [];
            html += '<div class="pattern-title" style="margin-top:14px;">최근 4등/5등 사례</div>';
            if (recentHits.length === 0) {
                html += '<p class="info">최근 4등/5등 사례가 아직 없습니다.</p>';
            } else {
                html += '<div class="pattern-cases-wrap"><table class="pattern-cases"><thead><tr><th>등수</th><th>회차</th><th>일치</th><th>번호</th></tr></thead><tbody>';
                recentHits.forEach(function(row) {
                    html += '<tr><td><span class="rank-badge ' + rankClass(row.rank) + '">' + row.rank + '</span></td><td>' + row.targetDrawNo + '회</td><td>' + row.matchCount + '개' + (row.bonusMatch ? ' + 보너스' : '') + '</td><td class="nums">';
                    (row.numbers || []).forEach(function(n) { html += '<span class="ball-small ' + getBallColorClass(n) + '">' + n + '</span>'; });
                    html += ' <span class="log-meta">(' + (row.nickname || '익명') + ')</span></td></tr>';
                });
                html += '</tbody></table></div>';
            }
            var pending = data.pendingLogs || [];
            html += '<div class="pattern-title" style="margin-top:14px;">발표 대기중 로그</div>';
            if (pending.length === 0) {
                html += '<p class="info"><span class="status-badge status-resolved">확정 완료</span> 현재 대기중인 로그가 없습니다.</p>';
            } else {
                html += '<p class="info"><span class="status-badge status-pending">대기중</span> 발표 전 회차 로그 ' + pending.length + '건</p>';
                html += '<div class="pattern-cases-wrap"><table class="pattern-cases"><thead><tr><th>상태</th><th>닉네임</th><th>대상 회차</th><th>생성 세트</th><th>생성 시각(UTC)</th><th>모드</th></tr></thead><tbody>';
                pending.forEach(function(row) {
                    html += '<tr><td><span class="status-badge status-pending">대기중</span></td><td>' + (row.nickname || '익명') + '</td><td>' + row.targetDrawNo + '회</td><td>' + row.setCount + '세트</td><td>' + (row.generatedAt || '-') + '</td><td>' + (row.mode || '-') + '</td></tr>';
                });
                html += '</tbody></table></div>';
            }
            hitEl.innerHTML = html;
        }
        async function loadHitDashboard() {
            if (OPENED_AS_FILE) return;
            hitEl.innerHTML = '<p class="info">히스토리를 불러오는 중...</p>';
            try {
                var url = '/api/hits_dashboard' + (nicknameFilter ? ('?nickname=' + encodeURIComponent(nicknameFilter)) : '');
                var r = await fetch(url);
                var d = await r.json();
                renderHitDashboard(d);
            } catch (e) {
                hitEl.innerHTML = '<p class="error">히스토리 요청 실패: ' + e.message + '</p>';
            }
        }
        async function settleLatestDraw() {
            if (OPENED_AS_FILE) return;
            const drawNoValue = (document.getElementById('settleDrawNoInput').value || '').trim();
            settleResultEl.textContent = '채점 처리 중...';
            try {
                const body = {};
                if (drawNoValue) body.drawNo = parseInt(drawNoValue, 10);
                const r = await fetch('/api/settle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const d = await r.json();
                if (d.error) {
                    settleResultEl.innerHTML = '<span class="error">' + d.error + '</span>';
                    showToast('마감 처리 실패: ' + d.error, 'error');
                    return;
                }
                settleResultEl.textContent = d.message + ' (4/5등 ' + (d.wins45 || 0) + '건)';
                showToast('토요일 마감 처리 완료', 'success');
                loadHitDashboard();
                loadGenerationLogs();
            } catch (e) {
                settleResultEl.innerHTML = '<span class="error">채점 요청 실패: ' + e.message + '</span>';
                showToast('마감 요청 실패: ' + e.message, 'error');
            }
        }
        function renderGenerationLogs(data) {
            if (!data || data.error) {
                generationLogsEl.innerHTML = '<p class="error">' + ((data && data.error) || '로그를 불러오지 못했습니다.') + '</p>';
                return;
            }
            var items = data.items || [];
            var html = '<p class="info">' + (data.info || '') + '</p>';
            if (items.length === 0) {
                html += '<p class="info">아직 생성 로그가 없습니다.</p>';
                generationLogsEl.innerHTML = html;
                return;
            }
            html += '<div class="log-list">';
            items.forEach(function(item) {
                var statusClass = item.status === '확정' ? 'status-resolved' : 'status-pending';
                html += '<div class="log-item">';
                html += '<div class="log-top"><div><strong>[' + (item.nickname || '익명') + ']</strong> ' + (item.setCount || 0) + '세트 · 세트당 ' + (item.numbersPerSet || 6) + '개 · 대상 ' + (item.targetDrawNo || '-') + '회</div><span class="status-badge ' + statusClass + '">' + item.status + '</span></div>';
                html += '<div class="log-meta">' + (item.generatedAt || '-') + ' · ' + (item.mode || '-') + (item.status === '확정' ? (' · 최고 ' + (item.bestRank || '-') + ' (' + (item.bestMatch || 0) + '개 일치)') : '') + '</div>';
                html += '<div class="log-sets">';
                (item.setsPreview || []).forEach(function(oneSet, idx) {
                    html += '<div class="log-set-line"><span class="log-set-label">' + (idx + 1) + '세트</span>';
                    oneSet.forEach(function(n) { html += '<span class="ball-small ' + getBallColorClass(n) + '">' + n + '</span>'; });
                    html += '</div>';
                });
                if ((item.setCount || 0) > (item.setsPreview || []).length) {
                    html += '<div class="log-meta">나머지 ' + ((item.setCount || 0) - (item.setsPreview || []).length) + '세트는 생략 표시됨</div>';
                }
                html += '</div></div>';
            });
            html += '</div>';
            generationLogsEl.innerHTML = html;
        }
        async function loadGenerationLogs() {
            if (OPENED_AS_FILE) return;
            generationLogsEl.innerHTML = '<p class="info">로그를 불러오는 중...</p>';
            try {
                var url = '/api/generation_logs' + (nicknameFilter ? ('?nickname=' + encodeURIComponent(nicknameFilter)) : '');
                var r = await fetch(url);
                var d = await r.json();
                renderGenerationLogs(d);
            } catch (e) {
                generationLogsEl.innerHTML = '<p class="error">로그 요청 실패: ' + e.message + '</p>';
            }
        }
        document.getElementById('statsFilter').onchange = function() {
            if (window._lastStatsData) renderStatsResult(window._lastStatsData);
        };
        document.getElementById('statsSource').onchange = function() {
            if (window._lastStatsData) document.getElementById('btnStats').click();
        };
        document.getElementById('btnPattern').onclick = function() { loadPatternDashboard(); };
        document.getElementById('btnHitDashboard').onclick = function() { loadHitDashboard(); };
        document.getElementById('btnGenerationLogs').onclick = function() { loadGenerationLogs(); };
        document.getElementById('btnSettleLatest').onclick = function() { settleLatestDraw(); };
        document.getElementById('btnWeeklySummary').onclick = function() { loadWeeklySummary(); };
        document.getElementById('btnWeeklyGenStats').onclick = function() { loadWeeklyGenerationStats(); };
        document.getElementById('btnWeeklyManualSave').onclick = function() { saveWeeklyManualJson(); };
        document.getElementById('btnWeeklyScript').onclick = async function() {
            const script = getWeeklyExtractScript();
            try {
                await navigator.clipboard.writeText(script);
                showToast('추출 스크립트를 복사했습니다. 동행복권 페이지 F12 콘솔에 붙여넣으세요.', 'info');
            } catch (e) {
                showToast('스크립트 복사 실패. 수동으로 복사해 주세요.', 'error');
            }
        };
        sanitizeInitialInputs();
        document.getElementById('btnNicknameSearch').onclick = function() {
            nicknameFilter = (document.getElementById('nicknameSearchInput').value || '').trim();
            loadHitDashboard();
            loadGenerationLogs();
        };
        document.getElementById('btnNicknameSearchReset').onclick = function() {
            nicknameFilter = '';
            document.getElementById('nicknameSearchInput').value = '';
            loadHitDashboard();
            loadGenerationLogs();
        };
        loadWeeklySummary();
        loadWeeklyGenerationStats();
        loadPatternDashboard();
        loadHitDashboard();
        loadGenerationLogs();
        refreshFlowStepByScroll();
        bindFlowButtons();
        window.addEventListener('scroll', refreshFlowStepByScroll, { passive: true });
    </script>
</body>
</html>
"""
    resp = make_response(render_template_string(html, draws=draws))
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


@app.route("/data/lotto_history.json")
def serve_lotto_json():
    """로컬 lotto_history.json 파일을 그대로 내려줌. 클라이언트가 여기서 불러와 표에 채움."""
    if not CACHE_PATH.exists():
        return jsonify({"draws": [], "total": 0}), 404
    resp = send_file(str(CACHE_PATH), mimetype="application/json", as_attachment=False)
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route("/api/status")
def api_status():
    """보유 회차 수·자동 수집 진행 여부."""
    draws = _ensure_draws()
    return jsonify({
        "total_draws": len(draws),
        "fetching": _auto_fetch_state["running"],
        "message": _auto_fetch_state["message"],
    })


@app.route("/api/auto_fetch", methods=["GET", "POST"])
def api_auto_fetch():
    """백그라운드에서 100회차~ 수집 시작. 즉시 응답."""
    if _auto_fetch_state["running"]:
        return jsonify({"message": "이미 수집 중입니다."})
    t = threading.Thread(target=_run_auto_fetch, daemon=True)
    t.start()
    return jsonify({"message": "100회차부터 수집을 시작했습니다. 1~2분 후 당첨 기록이 갱신됩니다."})


@app.route("/api/draws")
def api_draws():
    """당첨 기록 목록 (최신순, limit 기본 80)."""
    draws = _ensure_draws()
    if not draws:
        resp = jsonify({"error": "당첨 기록이 없습니다.", "draws": []})
        resp.headers["Cache-Control"] = "no-store"
        return resp
    limit = min(int(request.args.get("limit", 80)), 200)
    subset = list(reversed(draws))[:limit]
    resp = jsonify({"draws": subset, "total": len(draws)})
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route("/api/draw_by_no")
def api_draw_by_no():
    """지정 회차 한 건 조회. cache에 있으면 반환, fetch=1이면 API로 가져와서 추가 후 반환."""
    try:
        drw_no = int(request.args.get("drwNo", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "drwNo(회차)를 숫자로 넣어 주세요."})
    if drw_no < 1 or drw_no > 2000:
        return jsonify({"error": "회차는 1~2000 사이로 지정해 주세요."})
    draws = _ensure_draws()
    by_no = {d["drwNo"]: d for d in draws}
    force_fetch = request.args.get("fetch", "").lower() in ("1", "true", "yes")
    if drw_no in by_no and not force_fetch:
        return jsonify({"draw": by_no[drw_no], "from_cache": True})
    if force_fetch:
        record, err = fetch_one_round_from_api(drw_no, cache_path=CACHE_PATH)
        if record is None:
            direct_url = f"https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={drw_no}"
            return jsonify({
                "error": err,
                "direct_url": direct_url,
                "hint": "브라우저에서 위 주소가 열리면 접속 제한일 수 있습니다. 위에서 회차와 번호 7개를 직접 입력해 추가해 보세요.",
            })
        return jsonify({"draw": record, "from_cache": False})
    return jsonify({
        "error": "해당 회차가 캐시에 없습니다. 위에서 회차와 번호 7개를 입력해 추가해 보세요.",
        "direct_url": f"https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={drw_no}",
        "draw": None,
    })


@app.route("/api/fetch", methods=["GET", "POST"])
def api_fetch():
    """1회차부터 당첨 기록 수집 후 캐시 저장. (동행복권 API 호출 — 1~2분 소요 가능)"""
    try:
        draws, newly_fetched = fetch_all_from_api(cache_path=str(CACHE_PATH), use_requests=True)
        if not draws:
            return jsonify({"error": "수집된 데이터가 없습니다. 동행복권 접속이 제한되었을 수 있습니다. 터미널에서 python main.py fetch 를 실행해 보세요."})
        # API에서 새로 한 건도 못 가져왔고, 기존 캐시가 5회차(샘플) 수준이면 → 수집 실패로 안내
        if newly_fetched == 0 and len(draws) <= 20:
            return jsonify({
                "error": "동행복권에서 접속이 막혀 새로 수집하지 못했습니다. 지금 보이는 " + str(len(draws)) + "회차는 예전에 저장된 샘플입니다. 전체 회차를 쓰려면 CMD에서 프로젝트 폴더로 이동한 뒤 python main.py fetch 를 실행해 보세요.",
                "total": len(draws),
            })
        msg = f"저장 완료: 총 {len(draws)}회차"
        if newly_fetched > 0:
            msg += f" (이번에 {newly_fetched}회차 추가 수집)"
        msg += ". 아래 '확률 통계 보기'를 다시 눌러 보세요."
        return jsonify({"total": len(draws), "message": msg})
    except Exception as e:
        return jsonify({"error": f"수집 중 오류: {e!s}"})


@app.route("/api/fetch_from_url")
def api_fetch_from_url():
    """뉴스 기사 URL에서 당첨번호 파싱 후 캐시에 추가."""
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "url 파라미터가 없습니다."})
    if not url.startswith("http://") and not url.startswith("https://"):
        return jsonify({"error": "http 또는 https URL을 입력해 주세요."})
    record, message = fetch_one_from_news_url(url, cache_path=CACHE_PATH)
    if record is None:
        return jsonify({"error": message})
    return jsonify({"message": message, "drwNo": record["drwNo"]})


@app.route("/api/add_manual", methods=["POST"])
def api_add_manual():
    """회차·당첨번호 6개·보너스(선택)를 직접 입력해 캐시에 추가."""
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {}
    drw_no = data.get("drwNo") or data.get("drw_no")
    numbers = data.get("numbers")
    bonus = data.get("bonus") or data.get("bnusNo")
    if drw_no is None:
        return jsonify({"error": "회차(drwNo)를 입력해 주세요."})
    try:
        drw_no = int(drw_no)
    except (TypeError, ValueError):
        return jsonify({"error": "회차는 숫자로 입력해 주세요."})
    if not numbers:
        return jsonify({"error": "당첨번호 6개(numbers)를 입력해 주세요. 예: [10, 15, 19, 27, 30, 33]"})
    if isinstance(numbers, str):
        numbers = [int(x.strip()) for x in numbers.replace(",", " ").replace("·", " ").split() if x.strip().isdigit()]
    record, message = add_manual_draw(drw_no, numbers, bonus=bonus, cache_path=CACHE_PATH)
    if record is None:
        return jsonify({"error": message})
    return jsonify({"message": message, "drwNo": record["drwNo"]})


@app.route("/api/add_from_text", methods=["POST"])
def api_add_from_text():
    """한 줄 문장에서 회차·당첨번호를 파싱해 캐시에 추가. 예: 1214회 로또 … 당첨번호 '10, 15, 19, 27, 30, 33'"""
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {}
    text = (data.get("text") or request.form.get("text") or "").strip()
    if not text:
        return jsonify({"error": "문장(text)을 입력해 주세요."})
    record, message = add_from_text(text, cache_path=CACHE_PATH)
    if record is None:
        return jsonify({"error": message})
    return jsonify({"message": message, "drwNo": record["drwNo"]})


@app.route("/api/generate")
def api_generate():
    """확률 기반 번호 생성 API."""
    draws = _ensure_draws()
    if not draws:
        return jsonify({"error": "당첨 기록이 없습니다. 위에서 회차와 번호 7개를 입력해 추가한 뒤 다시 시도해 주세요."})
    count = min(max(int(request.args.get("count", 1)), 1), 5)
    recent = request.args.get("recent", type=int)
    nickname = (request.args.get("nickname", "") or "").strip()
    if not nickname:
        nickname = "익명"
    if len(nickname) > 20:
        nickname = nickname[:20]
    sets = generate_multiple(draws, count=count, use_recent_only=recent)
    prob_map = get_probability_map(draws, use_recent_only=recent, include_bonus=False)
    sorted_prob = sorted(prob_map.items(), key=lambda x: x[1], reverse=True)
    top10 = [{"num": n, "prob": round(p * 100, 3)} for n, p in sorted_prob[:10]]
    rank_map = {n: idx + 1 for idx, (n, _) in enumerate(sorted_prob)}
    set_logs = []
    for idx, one_set in enumerate(sets, start=1):
        entries = []
        for n in one_set:
            p = prob_map.get(n, 0.0) * 100
            entries.append({"num": n, "prob": round(p, 3), "rank": rank_map.get(n, 45)})
        avg_prob = (sum(e["prob"] for e in entries) / len(entries)) if entries else 0.0
        spread = max(one_set) - min(one_set) if one_set else 0
        high_prob_count = sum(1 for e in entries if e["rank"] <= 15)
        if high_prob_count >= 4:
            style_tag = "공격형(상위확률 집중)"
        elif spread >= 28:
            style_tag = "분산형(구간 분산)"
        else:
            style_tag = "균형형(중간 분포)"
        set_logs.append({
            "setIndex": idx,
            "numbers": one_set,
            "entries": entries,
            "avgProb": round(avg_prob, 3),
            "styleTag": style_tag,
        })
    mode = f"최근 {recent}회 가중" if recent else "전체 회차"
    latest_draw_no = max((d.get("drwNo", 0) for d in draws), default=0)
    target_draw_no = latest_draw_no + 1
    try:
        logs = _load_generated_logs()
        new_entry = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "mode": mode,
            "nickname": nickname,
            "targetDrawNo": target_draw_no,
            "numbers": sets,
        }
        # 같은 회차/모드/번호 세트가 연속 저장되지 않도록 중복 완화
        append_ok = True
        if logs:
            last = logs[-1]
            if (
                last.get("targetDrawNo") == new_entry["targetDrawNo"]
                and last.get("mode") == new_entry["mode"]
            ):
                last_sets = [_normalize_numbers_set(s) for s in last.get("numbers", []) if isinstance(s, list)]
                new_sets = [_normalize_numbers_set(s) for s in new_entry["numbers"] if isinstance(s, list)]
                if last_sets == new_sets:
                    append_ok = False
        if append_ok:
            logs.append(new_entry)
        # 파일 크기 관리: 최근 500건만 보관
        if len(logs) > 500:
            logs = logs[-500:]
        _save_generated_logs(logs)
    except OSError:
        pass
    return jsonify({
        "info": f"기준: {mode} (총 {len(draws)}회차)",
        "numbers": sets,
        "targetDrawNo": target_draw_no,
        "nickname": nickname,
        "analysisLog": {
            "mode": mode,
            "topNumbers": top10,
            "setLogs": set_logs,
        },
    })


@app.route("/api/stats")
def api_stats():
    """번호별 출현 통계 API."""
    draws = _ensure_draws()
    if not draws:
        return jsonify({"error": "당첨 기록이 없습니다. 위에서 회차와 번호 7개를 입력해 추가한 뒤 다시 시도해 주세요."})
    freq = compute_frequency(draws, include_bonus=False)
    prob = frequency_to_probability(freq)
    # 1~45 번호 전체 (분류 조건 적용을 위해)
    sorted_items = sorted([(n, freq.get(n, 0)) for n in range(1, 46)], key=lambda x: x[0])
    total_draws = len(draws)
    # 데이터가 적을 때 확률이 비슷하게 나오는 이유 안내 (예: 5회차면 5×6=30번 뽑힘 → 한 번씩만 나오면 각 1/30≈3.33%)
    notice = None
    if total_draws <= 30:
        total_picks = total_draws * 6
        notice = (
            f"현재 데이터가 {total_draws}회차뿐이라, 많은 번호가 비슷한 확률(약 {100/total_picks:.1f}%)로 나올 수 있습니다. "
            "위 1등 당첨 기록 직접 입력에서 회차와 번호 7개를 더 추가하면 통계가 풍부해집니다."
        )
    return jsonify({
        "info": f"1회차~{total_draws}회차 (본당첨 6개 번호 기준)",
        "notice": notice,
        "top_numbers": [
            {"num": num, "count": cnt, "prob": f"{prob.get(num, 0) * 100:.2f}"}
            for num, cnt in sorted_items
        ],
    })


@app.route("/api/patterns")
def api_patterns():
    """패턴 분석 대시보드 API."""
    draws = _ensure_draws()
    if not draws:
        return jsonify({"error": "당첨 기록이 없습니다. 먼저 회차 데이터를 추가해 주세요."})
    recent = request.args.get("recent", default=50, type=int)
    if recent is None or recent <= 0:
        recent = 50
    recent = min(recent, 300)
    dashboard = build_pattern_dashboard(draws, recent_n=recent)
    return jsonify(dashboard)


@app.route("/api/hits_dashboard")
def api_hits_dashboard():
    """생성 번호의 명예의 전당/당첨 사례/주간 리포트."""
    draws = _ensure_draws()
    if not draws:
        return jsonify({"error": "당첨 기록이 없습니다."})
    logs = _load_generated_logs()
    nickname_filter = (request.args.get("nickname", "") or "").strip().lower()
    if not logs:
        return jsonify({
            "info": "아직 생성 번호 기록이 없습니다. 먼저 번호를 생성해 주세요.",
            "hallOfFame": [],
            "recentHits": [],
            "weeklyReport": {
                "generatedSets": 0,
                "resolvedSets": 0,
                "wins45": 0,
                "hitRate45": "0.00",
            },
        })

    draw_map = {d.get("drwNo"): d for d in draws if d.get("drwNo") is not None}
    evaluated: list[dict] = []
    pending_logs: list[dict] = []
    for log in logs:
        target_no = log.get("targetDrawNo")
        nickname = (log.get("nickname") or "익명").strip() or "익명"
        if nickname_filter and nickname_filter not in nickname.lower():
            continue
        draw = draw_map.get(target_no)
        if not draw:
            pending_logs.append({
                "generatedAt": log.get("generatedAt"),
                "nickname": nickname,
                "mode": log.get("mode"),
                "targetDrawNo": target_no,
                "setCount": len([s for s in log.get("numbers", []) if isinstance(s, list) and len(s) == 6]),
            })
            continue
        for one_set in log.get("numbers", []):
            if not isinstance(one_set, list) or len(one_set) != 6:
                continue
            eval_one = _evaluate_single_set(one_set, draw)
            evaluated.append({
                "generatedAt": log.get("generatedAt"),
                "nickname": nickname,
                "mode": log.get("mode"),
                "targetDrawNo": target_no,
                "targetDate": draw.get("drwNoDate") or "직접입력",
                "numbers": sorted(one_set),
                "rank": eval_one["rank"],
                "matchCount": eval_one["matchCount"],
                "bonusMatch": eval_one["bonusMatch"],
            })

    # 고등수 우선 정렬
    evaluated_sorted = sorted(
        evaluated,
        key=lambda x: (_rank_weight(x["rank"]), -(x["matchCount"]), x.get("generatedAt") or ""),
    )
    hall = [e for e in evaluated_sorted if e["rank"] != "미당첨"][:10]
    recent_hits = [e for e in sorted(evaluated, key=lambda x: x.get("generatedAt") or "", reverse=True) if e["rank"] in ("4등", "5등")][:12]

    # 최근 7일 리포트
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    generated_sets = 0
    resolved_sets = 0
    wins_45 = 0
    for log in logs:
        gen_at_raw = log.get("generatedAt")
        if not isinstance(gen_at_raw, str):
            continue
        try:
            gen_at = datetime.fromisoformat(gen_at_raw.replace("Z", "+00:00"))
        except ValueError:
            continue
        if gen_at < week_ago:
            continue
        sets = [s for s in log.get("numbers", []) if isinstance(s, list) and len(s) == 6]
        generated_sets += len(sets)
        draw = draw_map.get(log.get("targetDrawNo"))
        if not draw:
            continue
        for one_set in sets:
            resolved_sets += 1
            one = _evaluate_single_set(one_set, draw)
            if one["rank"] in ("4등", "5등"):
                wins_45 += 1
    hit_rate_45 = (wins_45 / resolved_sets * 100.0) if resolved_sets else 0.0

    return jsonify({
        "info": ("닉네임 필터: " + nickname_filter + " · " if nickname_filter else "") + "생성 번호 히스토리를 실제 당첨 회차와 비교한 결과입니다.",
        "hallOfFame": hall,
        "recentHits": recent_hits,
        "pendingLogs": sorted(
            pending_logs,
            key=lambda x: x.get("generatedAt") or "",
            reverse=True,
        )[:12],
        "weeklyReport": {
            "generatedSets": generated_sets,
            "resolvedSets": resolved_sets,
            "wins45": wins_45,
            "hitRate45": f"{hit_rate_45:.2f}",
        },
    })


@app.route("/api/generation_logs")
def api_generation_logs():
    """최근 번호 생성 로그 (닉네임/상태 포함)."""
    draws = _ensure_draws()
    draw_map = {d.get("drwNo"): d for d in draws if d.get("drwNo") is not None}
    logs = _load_generated_logs()
    nickname_filter = (request.args.get("nickname", "") or "").strip().lower()
    if not logs:
        return jsonify({"info": "생성 로그가 없습니다.", "items": []})

    items: list[dict] = []
    for log in reversed(logs):
        sets = [s for s in log.get("numbers", []) if isinstance(s, list) and len(s) == 6]
        if not sets:
            continue
        nickname = (log.get("nickname") or "익명").strip() or "익명"
        if nickname_filter and nickname_filter not in nickname.lower():
            continue
        target_no = log.get("targetDrawNo")
        draw = draw_map.get(target_no)
        if draw:
            evaluations = [_evaluate_single_set(s, draw) for s in sets]
            best = sorted(evaluations, key=lambda e: (_rank_weight(e["rank"]), -e["matchCount"]))[0]
            status = "확정"
            best_rank = best["rank"]
            best_match = best["matchCount"]
        else:
            status = "대기중"
            best_rank = "-"
            best_match = 0
        items.append({
            "generatedAt": log.get("generatedAt"),
            "nickname": nickname,
            "mode": log.get("mode") or "-",
            "targetDrawNo": target_no,
            "setCount": len(sets),
            "numbersPerSet": 6,
            "status": status,
            "bestRank": best_rank,
            "bestMatch": best_match,
            "setsPreview": [sorted(s) for s in sets[:10]],
        })
        if len(items) >= 30:
            break

    return jsonify({
        "info": ("닉네임 필터: " + nickname_filter + " · " if nickname_filter else "") + "최근 생성 로그 30건입니다.",
        "items": items,
    })


@app.route("/api/weekly_summary")
def api_weekly_summary():
    """최신(또는 지정) 회차 당첨 요약."""
    draw_no = request.args.get("drawNo", type=int)
    data = _get_weekly_summary(draw_no=draw_no)
    if not data:
        return jsonify({"error": "이번 주 당첨 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요."})
    return jsonify(data)


@app.route("/api/weekly_generation_stats")
def api_weekly_generation_stats():
    """최근 N일 생성 로그 기준 주간 생성 통계."""
    draws = _ensure_draws()
    latest_draw_no = max((d.get("drwNo", 0) for d in draws), default=0)
    target_draw_no = request.args.get("targetDrawNo", type=int) or (latest_draw_no + 1)
    days = min(max(request.args.get("days", default=7, type=int) or 7, 1), 30)
    now_utc = datetime.now(timezone.utc)
    cutoff = now_utc - timedelta(days=days)

    logs = _load_generated_logs()
    number_counter: Counter[int] = Counter()
    nickname_set: set[str] = set()
    generated_set_count = 0
    log_count = 0

    for log in logs:
        if log.get("targetDrawNo") != target_draw_no:
            continue
        gen_at = _parse_iso_datetime(log.get("generatedAt"))
        if not gen_at or gen_at < cutoff:
            continue
        sets = [s for s in log.get("numbers", []) if isinstance(s, list) and len(s) == 6]
        if not sets:
            continue
        log_count += 1
        nickname = (log.get("nickname") or "익명").strip() or "익명"
        nickname_set.add(nickname)
        for one_set in sets:
            generated_set_count += 1
            for n in one_set:
                try:
                    num = int(n)
                except (TypeError, ValueError):
                    continue
                if 1 <= num <= 45:
                    number_counter[num] += 1

    top5 = [{"num": n, "count": c} for n, c in number_counter.most_common(5)]
    cold_pool = sorted([(n, number_counter.get(n, 0)) for n in range(1, 46)], key=lambda x: (x[1], x[0]))
    cold5 = [{"num": n, "count": c} for n, c in cold_pool[:5]]
    unselected_count = sum(1 for n in range(1, 46) if number_counter.get(n, 0) == 0)

    return jsonify({
        "targetDrawNo": target_draw_no,
        "days": days,
        "logCount": log_count,
        "generatedSetCount": generated_set_count,
        "uniqueNicknameCount": len(nickname_set),
        "unselectedCount": unselected_count,
        "totalNumberPicks": sum(number_counter.values()),
        "top5": top5,
        "cold5": cold5,
    })


@app.route("/api/weekly_summary_manual", methods=["POST"])
def api_weekly_summary_manual():
    """동행복권 페이지에서 수동 추출한 주간 요약 저장."""
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {}
    try:
        drw_no = int(data.get("drwNo"))
    except (TypeError, ValueError):
        return jsonify({"error": "drwNo(회차)가 필요합니다."})
    numbers = data.get("numbers")
    if not isinstance(numbers, list) or len(numbers) != 6:
        return jsonify({"error": "numbers는 6개 숫자 배열이어야 합니다."})
    try:
        numbers = [int(n) for n in numbers]
    except (TypeError, ValueError):
        return jsonify({"error": "numbers는 숫자만 포함해야 합니다."})
    bonus = data.get("bonus")
    try:
        bonus = int(bonus) if bonus is not None else None
    except (TypeError, ValueError):
        bonus = None
    payload = {
        "drwNo": drw_no,
        "drwNoDate": (data.get("drwNoDate") or _estimate_draw_date(drw_no)),
        "numbers": numbers,
        "bonus": bonus,
        "firstPrizeWinnerCount": int(data.get("firstPrizeWinnerCount")) if data.get("firstPrizeWinnerCount") is not None else None,
        "firstPrizeAmount": int(data.get("firstPrizeAmount")) if data.get("firstPrizeAmount") is not None else None,
        "totalSalesAmount": int(data.get("totalSalesAmount")) if data.get("totalSalesAmount") is not None else None,
    }
    cache = _load_weekly_summary_cache()
    cache[str(drw_no)] = payload
    try:
        _save_weekly_summary_cache(cache)
    except OSError:
        return jsonify({"error": "요약 캐시 파일 저장에 실패했습니다."})
    return jsonify({"message": f"제{drw_no}회 주간 요약을 저장했습니다.", "drwNo": drw_no})


@app.route("/api/settle", methods=["POST"])
def api_settle():
    """이번 회차(또는 지정 회차) 대기 로그 채점/확정 처리."""
    draws = _ensure_draws()
    if not draws:
        return jsonify({"error": "당첨 기록이 없어 채점을 진행할 수 없습니다."})
    latest_draw_no = max((d.get("drwNo", 0) for d in draws), default=0)
    try:
        data = request.get_json(silent=True) or {}
    except Exception:
        data = {}
    draw_no = data.get("drawNo") if isinstance(data, dict) else None
    if draw_no is None:
        draw_no = request.args.get("drawNo", type=int)
    if draw_no is None:
        draw_no = latest_draw_no
    try:
        draw_no = int(draw_no)
    except (TypeError, ValueError):
        return jsonify({"error": "회차(drawNo)는 숫자로 입력해 주세요."})
    if draw_no < 1:
        return jsonify({"error": "회차(drawNo)는 1 이상이어야 합니다."})

    settled = _settle_logs_for_draw(draw_no)
    settled["drawNo"] = draw_no
    return jsonify(settled)


def run_server(host: str = "0.0.0.0", port: int = 5000, debug: bool = False):
    """서버 실행."""
    app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    run_server(port=5000)
