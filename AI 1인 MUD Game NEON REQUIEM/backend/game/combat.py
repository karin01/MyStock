# -*- coding: utf-8 -*-
"""
전투 로직 보조 — 시너지·상태 배율 (프론트 combat과 대응하는 개념 모형)
WHY: 서버 측 시뮬·밸런스 스크립트에서 동일 규칙을 재사용할 수 있게 한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .skills import SynergyId, active_synergies


@dataclass
class CombatSnapshot:
    """플레이어·룬 상태 스냅샷 (검증·단위테스트용)"""

    hp: int
    max_hp: int
    primary_rune: Optional[str]
    secondary_rune: Optional[str]


def slaughter_attack_speed_multiplier(snap: CombatSnapshot) -> float:
    if SynergyId.SLAUGHTERER in active_synergies(snap.primary_rune, snap.secondary_rune):
        return 1.5
    return 1.0


def slaughter_force_crit(snap: CombatSnapshot) -> bool:
    if snap.max_hp <= 0:
        return False
    if SynergyId.SLAUGHTERER not in active_synergies(snap.primary_rune, snap.secondary_rune):
        return False
    return snap.hp / snap.max_hp <= 0.2


def overload_second_wave_multiplier(snap: CombatSnapshot) -> float:
    """전술 핵: 두 번째 파동 배율"""
    if SynergyId.TACTICAL_NUKE in active_synergies(snap.primary_rune, snap.secondary_rune):
        return 0.55
    return 0.0


def shield_reflect_ratio(snap: CombatSnapshot) -> float:
    """철벽전도사 방패 반사 — 움직이는 요새 시 강화"""
    ids = {snap.primary_rune, snap.secondary_rune} - {None, ""}
    if "shield_preacher" not in ids:
        return 0.0
    if SynergyId.MOVING_FORTRESS in active_synergies(snap.primary_rune, snap.secondary_rune):
        return 0.30
    return 0.15


def ghost_sniper_out_of_combat_multiplier(
    stealth_turns_left: int,
    snap: CombatSnapshot,
) -> float:
    if stealth_turns_left <= 0:
        return 1.0
    if SynergyId.GHOST_SNIPER in active_synergies(snap.primary_rune, snap.secondary_rune):
        return 5.0
    return 1.0


def wall_siege_damage_multiplier(snap: CombatSnapshot) -> float:
    ids = {snap.primary_rune, snap.secondary_rune} - {None, ""}
    if "berserker" in ids or "shield_preacher" in ids:
        return 2.0
    return 1.0
