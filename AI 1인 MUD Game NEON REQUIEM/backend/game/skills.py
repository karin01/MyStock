# -*- coding: utf-8 -*-
"""
디시플린 룬·직업 스킬 연동 규칙 (NEON REQUIEM 빌드 시스템)
WHY: 프론트엔드(TypeScript)와 동일한 기획 상수·시너지를 파이썬으로도 검증·서버 확장 시 참조한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import FrozenSet, Optional, Tuple


class JobId(str, Enum):
    """직업 id — jobClasses.ts 와 동일 취지"""

    WARRIOR = "warrior"
    WIZARD = "wizard"
    ROGUE = "rogue"
    THIEF = "thief"
    CLERIC = "cleric"


# TS runes.ts 의 RuneId 문자열과 동기화
RUNE_IDS: Tuple[str, ...] = (
    "berserker",
    "paladin",
    "assassin",
    "sage",
    "tracker",
    "necromancer",
    "gladiator",
    "guardian",
    "wind_sage",
    "alchemist",
    "gambler",
    "soul_binder",
    "war_mage",
    "shield_preacher",
    "shadow_illusionist",
)


class SynergyId(str, Enum):
    SLAUGHTERER = "slaughterer"
    TACTICAL_NUKE = "tactical_nuke"
    MOVING_FORTRESS = "moving_fortress"
    GHOST_SNIPER = "ghost_sniper"


SYNERGY_RESONANCE_KO = (
    "[SYNERGY] 당신의 영혼에 새겨진 두 룬이 공명하며 숨겨진 힘이 깨어납니다!"
)


def has_rune_pair(
    primary: Optional[str],
    secondary: Optional[str],
    a: str,
    b: str,
) -> bool:
    슬롯 = {primary, secondary} - {None, ""}
    return a in 슬롯 and b in 슬롯


def active_synergies(primary: Optional[str], secondary: Optional[str]) -> FrozenSet[SynergyId]:
    out: set[SynergyId] = set()
    if has_rune_pair(primary, secondary, "berserker", "gladiator"):
        out.add(SynergyId.SLAUGHTERER)
    if has_rune_pair(primary, secondary, "war_mage", "tracker"):
        out.add(SynergyId.TACTICAL_NUKE)
    if has_rune_pair(primary, secondary, "shield_preacher", "guardian"):
        out.add(SynergyId.MOVING_FORTRESS)
    if has_rune_pair(primary, secondary, "assassin", "tracker"):
        out.add(SynergyId.GHOST_SNIPER)
    return frozenset(out)


def estimate_build_count(job_count: int = 5, rune_count: int = len(RUNE_IDS)) -> int:
    """이론상 주≠보조 룬 조합 수 × 직업 (기획 문구용)"""
    return job_count * rune_count * max(0, rune_count - 1)


@dataclass(frozen=True)
class ClassRuneSkillModifier:
    """직업별 룬 연계 요약 — 실제 수치는 TS App.tsx 가 단일 소스"""

    job: JobId
    rune_id: str
    effect_ko: str


CLASS_RUNE_HOOKS: Tuple[ClassRuneSkillModifier, ...] = (
    ClassRuneSkillModifier(JobId.THIEF, "shadow_illusionist", "은신 중 이동 시 외부 로그 차단·기동 페널티 없음"),
    ClassRuneSkillModifier(JobId.ROGUE, "alchemist", "shoot 시 중독·감속 부여"),
    ClassRuneSkillModifier(JobId.WARRIOR, "wind_sage", "방패 강타 후 적 턴 1회 지연(선제 리듬)"),
)


def build_signature_ko(job_name: str, primary: Optional[str], secondary: Optional[str]) -> str:
    parts = [job_name]
    if primary:
        parts.append(primary)
    if secondary:
        parts.append(secondary)
    syn = ", ".join(s.value for s in active_synergies(primary, secondary))
    base = " / ".join(parts)
    return f"빌드 서명: {base}" + (f" (시너지: {syn})" if syn else "")
