"""
아이템 모델(이름 출력/옵션 합산).

WHY: 아이템 이름 출력(한국어 어순)과 스탯 합산 로직은
     UI/드랍/거래 등 여러 곳에서 재사용되므로 중앙화합니다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional, TypedDict, Literal

from .korean import get_josa_for_text, JosaType

class ItemStats(TypedDict, total=False):
    # 기본 능력치
    str: int
    dex: int
    con: int
    int: int
    spr: int

    # 전투 보조 스탯
    defense: int
    bonus_accuracy: float  # 0.05 = 5%p
    bonus_crit_chance: float  # 0.05 = 5%p

    # 특수 효과
    life_steal_percent: float  # 0.10 = 10%
    poison_chance: float  # 0.25 = 25%


ItemGrade = Literal["일반", "매직", "에픽", "전설", "신화"]

"""
등급별 ANSI 색상 코드 (요청 사양)
- 일반: \033[0m (기본)
- 매직: \033[94m (밝은 파란색)
- 에픽: \033[95m (밝은 보라색)
- 전설: \033[93m (노란색/금색)
- 신화: \033[91m (밝은 빨간색)
"""
GRADE_COLORS: Dict[ItemGrade, str] = {
    "일반": "\033[0m",
    "매직": "\033[94m",
    "에픽": "\033[95m",
    "전설": "\033[93m",
    "신화": "\033[91m",
}

ANSI_RESET = "\033[0m"


@dataclass(frozen=True)
class GradeDef:
    label: ItemGrade
    ansi_color: str
    multiplier: float
    ansi_reset: str = ANSI_RESET


# 등급별 ANSI 색상 + 스탯 가중치
ITEM_GRADES: Dict[ItemGrade, GradeDef] = {
    "일반": GradeDef(label="일반", ansi_color=GRADE_COLORS["일반"], multiplier=1.0),
    "매직": GradeDef(label="매직", ansi_color=GRADE_COLORS["매직"], multiplier=1.15),
    "에픽": GradeDef(label="에픽", ansi_color=GRADE_COLORS["에픽"], multiplier=1.35),
    "전설": GradeDef(label="전설", ansi_color=GRADE_COLORS["전설"], multiplier=1.6),
    "신화": GradeDef(label="신화", ansi_color=GRADE_COLORS["신화"], multiplier=1.9),
}


@dataclass(frozen=True)
class Affix:
    """
    접두/접미 옵션.

    - name은 "[거인의]" 같은 표기 문자열을 그대로 넣습니다.
    - stats는 아이템에 더해질 변화량(또는 확률)을 담습니다.
    """

    name: str
    stats: ItemStats = field(default_factory=dict)


def _merge_stats(base: ItemStats, add: ItemStats) -> ItemStats:
    """
    스탯을 안전하게 합산한다.

    WHY: int/float가 섞이므로 키 단위로 타입에 맞게 더해준다.
    """

    out: ItemStats = dict(base)  # type: ignore[assignment]
    for k, v in add.items():
        if v is None:
            continue
        if k not in out:
            out[k] = v  # type: ignore[literal-required]
            continue

        cur = out[k]  # type: ignore[literal-required]
        # 숫자 합산 (int/float 모두 지원)
        if isinstance(cur, (int, float)) and isinstance(v, (int, float)):
            out[k] = cur + v  # type: ignore[literal-required]
        else:
            # 타입이 섞이는 경우는 데이터 정의 오류이므로 덮어쓰지 않고 그대로 유지
            out[k] = cur  # type: ignore[literal-required]
    return out


@dataclass
class Item:
    """
    아이템 객체.

    필수 속성:
    - name: 기본 이름(예: "롱소드")
    - grade: 등급(일반/매직/에픽/전설/신화)
    - prefix: 접두 옵션(Affix 또는 None)
    - suffix: 접미 옵션(Affix 또는 None)
    - base_stats: 기본 스탯
    """

    name: str
    grade: ItemGrade = "일반"
    prefix: Optional[Affix] = None
    suffix: Optional[Affix] = None
    base_stats: ItemStats = field(default_factory=dict)

    def __str__(self) -> str:
        """
        한국어 어순: '[접두사] [접미사] 아이템이름'
        예: [거인의] [신속한] 롱소드

        등급에 맞는 ANSI 색상이 이름 전체(접두/접미 포함)에 적용된다.
        """

        parts = []
        if self.prefix and self.prefix.name:
            parts.append(self.prefix.name.strip())
        if self.suffix and self.suffix.name:
            parts.append(self.suffix.name.strip())
        parts.append(self.name.strip())

        plain = " ".join([p for p in parts if p])
        # 등급에 맞는 ANSI 색을 이름 전체에 적용하고, 마지막에 반드시 리셋을 붙인다.
        color = GRADE_COLORS.get(self.grade, GRADE_COLORS["일반"])
        return f"{color}{plain}{ANSI_RESET}"

    def get_total_stats(self) -> ItemStats:
        """
        접두/접미 옵션이 합산된 최종 스탯을 반환한다.
        """

        total = dict(self.base_stats)  # type: ignore[assignment]
        if self.prefix:
            total = _merge_stats(total, self.prefix.stats)
        if self.suffix:
            total = _merge_stats(total, self.suffix.stats)
        return total

    def get_josa(self, josa_type: JosaType) -> str:
        """
        아이템 이름(기본 이름)에 자연스러운 조사를 붙이기 위한 헬퍼.

        예:
        - item.get_josa('을') -> '롱소드'면 '를', '단검'이면 '을'
        """

        return get_josa_for_text(self.name, josa_type)

