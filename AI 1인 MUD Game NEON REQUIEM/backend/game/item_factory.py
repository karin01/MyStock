"""
랜덤 아이템 생성기(ItemFactory).

요구사항:
- 등급 결정 확률: 일반 75%, 매직 18%, 에픽 5%, 전설 1.5%, 신화 0.5%
- 일반 등급은 옵션 없음
- 매직 이상부터 등급이 높을수록 접두/접미가 붙을 확률이 높아짐
- 등급이 높을수록 옵션 수치 롤 범위가 더 높아짐

WHY:
아이템 생성 규칙(확률/롤/이름 조합)은 밸런스의 핵심이므로 한곳에 모아
테스트/튜닝/확장이 쉽도록 한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from random import Random
from typing import Dict, List, Optional, Tuple

from .item import Affix, Item, ItemGrade, ItemStats


@dataclass(frozen=True)
class RollRange:
    """옵션 1개에 대한 기본 롤 범위(매직 기준)."""

    min_value: float
    max_value: float


@dataclass(frozen=True)
class AffixTemplate:
    """
    접두/접미 옵션 템플릿.

    - name: "[거인의]"처럼 출력용 문자열
    - weight: 뽑기 가중치
    - rolls: 스탯 키 -> (매직 기준) 롤 범위
    """

    name: str
    weight: int
    rolls: Dict[str, RollRange]


def _weighted_choice(rng: Random, items: List[Tuple[object, int]]):
    total = sum(w for _, w in items)
    if total <= 0:
        return items[0][0]
    r = rng.uniform(0.0, float(total))
    acc = 0.0
    for obj, w in items:
        acc += float(w)
        if r <= acc:
            return obj
    return items[-1][0]


class ItemFactory:
    """
    랜덤 아이템 생성기.
    """

    # 등급 확률(요청값 그대로)
    GRADE_WEIGHTS: List[Tuple[ItemGrade, int]] = [
        ("일반", 750),
        ("매직", 180),
        ("에픽", 50),
        ("전설", 15),
        ("신화", 5),
    ]

    # 등급별 접두/접미 부여 확률 (등급이 높을수록 상승)
    AFFIX_CHANCE: Dict[ItemGrade, Dict[str, float]] = {
        "일반": {"prefix": 0.0, "suffix": 0.0},
        "매직": {"prefix": 0.55, "suffix": 0.45},
        "에픽": {"prefix": 0.75, "suffix": 0.65},
        "전설": {"prefix": 0.90, "suffix": 0.85},
        "신화": {"prefix": 1.00, "suffix": 1.00},
    }

    # 등급별 “롤 배율” (매직=1.0 기준)
    # WHY: 단순 multiplier(1.0~1.9)는 예시(전설 +20~30)를 만들기에 부족하므로,
    #      옵션 롤에만 별도의 성장 곡선을 적용한다.
    ROLL_SCALE: Dict[ItemGrade, float] = {
        "일반": 0.0,   # 옵션 없음
        "매직": 1.0,   # 기준
        "에픽": 1.8,
        "전설": 4.6,   # 예: 매직 +5 → 전설 약 +23대
        "신화": 6.2,   # 예: 매직 +5 → 신화 약 +31대
    }

    # ─────────────────────────────────────────
    # 접두(능력치 위주) / 접미(특수효과 위주) 템플릿
    # - rolls는 “매직 등급 기준” 범위이며, 등급에 따라 ROLL_SCALE로 확대된다.
    # ─────────────────────────────────────────
    PREFIX_TEMPLATES: List[AffixTemplate] = [
        AffixTemplate("[거인의]", 10, {"str": RollRange(5, 7)}),
        AffixTemplate("[용사의]", 8, {"str": RollRange(3, 5), "con": RollRange(3, 5)}),
        AffixTemplate("[현자의]", 8, {"int": RollRange(4, 6), "spr": RollRange(2, 4)}),
        AffixTemplate("[호랑이의]", 9, {"dex": RollRange(5, 7)}),
        AffixTemplate("[황소의]", 8, {"con": RollRange(5, 7)}),
        AffixTemplate("[올빼미의]", 7, {"int": RollRange(5, 7)}),
        AffixTemplate("[스핑크스의]", 7, {"spr": RollRange(5, 7)}),
        AffixTemplate("[별의]", 4, {"str": RollRange(1, 2), "dex": RollRange(1, 2), "con": RollRange(1, 2), "int": RollRange(1, 2), "spr": RollRange(1, 2)}),
    ]

    SUFFIX_TEMPLATES: List[AffixTemplate] = [
        AffixTemplate("[신속한]", 10, {"dex": RollRange(2, 4), "bonus_accuracy": RollRange(0.03, 0.06)}),
        AffixTemplate("[파괴적인]", 8, {"bonus_crit_chance": RollRange(0.04, 0.08)}),
        AffixTemplate("[흡혈의]", 6, {"life_steal_percent": RollRange(0.08, 0.14)}),
        AffixTemplate("[맹독의]", 7, {"poison_chance": RollRange(0.18, 0.32)}),
        AffixTemplate("[정밀한]", 8, {"bonus_accuracy": RollRange(0.05, 0.09)}),
        AffixTemplate("[냉혹한]", 7, {"bonus_crit_chance": RollRange(0.06, 0.10)}),
    ]

    def __init__(self, rng: Optional[Random] = None):
        self.rng = rng or Random()

    def roll_grade(self) -> ItemGrade:
        return _weighted_choice(self.rng, self.GRADE_WEIGHTS)  # type: ignore[return-value]

    def _roll_affix(self, templates: List[AffixTemplate], grade: ItemGrade) -> Affix:
        tpl: AffixTemplate = _weighted_choice(self.rng, [(t, t.weight) for t in templates])
        scale = self.ROLL_SCALE.get(grade, 1.0)

        stats: ItemStats = {}
        for key, rr in tpl.rolls.items():
            # 등급이 높을수록 롤 범위를 확장
            is_percent = key in ("bonus_accuracy", "bonus_crit_chance", "life_steal_percent", "poison_chance")
            # WHY: 확률/퍼센트 옵션은 선형으로 키우면 금방 캡에 닿아 “항상 최대치”가 되어 재미가 떨어진다.
            #      그래서 확률형 옵션은 스케일을 완만하게 적용한다.
            percent_scale = 1.0 + (max(1.0, scale) - 1.0) * 0.35
            applied = percent_scale if is_percent else scale
            lo = rr.min_value * applied
            hi = rr.max_value * applied
            if key in ("bonus_accuracy", "bonus_crit_chance", "life_steal_percent", "poison_chance"):
                # 확률/퍼센트 계열은 float
                val = self.rng.uniform(lo, hi)
                # 지나치게 과해지지 않도록 상한선(밸런스 안전장치)
                if key == "life_steal_percent":
                    val = min(val, 0.35)
                if key == "poison_chance":
                    val = min(val, 0.75)
                if key in ("bonus_accuracy", "bonus_crit_chance"):
                    val = min(val, 0.25)
                stats[key] = round(val, 4)  # type: ignore[literal-required]
            else:
                # 능력치/방어력 계열은 int
                val = int(self.rng.randint(int(lo), max(int(lo), int(hi))))
                stats[key] = val  # type: ignore[literal-required]

        return Affix(name=tpl.name, stats=stats)

    def create_item(
        self,
        *,
        base_name: str,
        base_stats: Optional[ItemStats] = None,
        force_grade: Optional[ItemGrade] = None,
    ) -> Item:
        """
        주어진 기본 이름/기본 스탯을 바탕으로 랜덤 아이템을 생성한다.
        """

        grade = force_grade or self.roll_grade()
        base_stats = base_stats or {}

        if grade == "일반":
            return Item(name=base_name, grade=grade, prefix=None, suffix=None, base_stats=base_stats)

        chances = self.AFFIX_CHANCE.get(grade, {"prefix": 0.6, "suffix": 0.5})

        prefix = None
        suffix = None

        if self.rng.random() < chances["prefix"]:
            prefix = self._roll_affix(self.PREFIX_TEMPLATES, grade)
        if self.rng.random() < chances["suffix"]:
            suffix = self._roll_affix(self.SUFFIX_TEMPLATES, grade)

        # 매직 이상인데 둘 다 안 붙으면 “최소 1개”는 붙게 해서 재미/차별화 확보
        if prefix is None and suffix is None:
            if self.rng.random() < 0.5:
                prefix = self._roll_affix(self.PREFIX_TEMPLATES, grade)
            else:
                suffix = self._roll_affix(self.SUFFIX_TEMPLATES, grade)

        return Item(
            name=base_name,
            grade=grade,
            prefix=prefix,
            suffix=suffix,
            base_stats=base_stats,
        )

