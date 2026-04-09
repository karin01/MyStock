// 속성 및 상태 이상(DoT) 상수
// WHY: 불/얼음/전기/독 속성별 화상·빙결·경직·중독을 도트 데미지로 통일해 적용한다.

export type ElementType = '불' | '얼음' | '전기' | '독' | '수면';

/** 속성 → 상태 이상 이름 */
export const ELEMENT_TO_STATUS: Record<ElementType, string> = {
  '불': '화상',
  '얼음': '빙결',
  '전기': '경직',
  '독': '중독',
  '수면': '수면',
};

/** 상태 이상별 턴당 DoT 피해량 (적/플레이어 공통) */
export const STATUS_DOT_DAMAGE: Record<string, number> = {
  '화상': 4,
  '빙결': 3,
  '경직': 4,
  '중독': 5,
};

/** 1파트(시작 구역)에서 플레이어가 받는 속성 DoT 배율 — 1파트는 데미지 낮춤 */
export const STATUS_DOT_DAMAGE_PART1_MULTIPLIER = 0.5;

/** 구역별 플레이어가 받는 속성 DoT 배율. 구역이 올라갈수록 적의 속성 데미지가 강해짐 */
export function getStatusDotMultiplierForZone(zone: number): number {
  const table: Record<number, number> = {
    1: 0.5, 2: 0.75, 3: 1.0, 4: 1.25, 5: 1.5, 6: 1.75, 7: 2.0, 8: 2.0, 9: 2.0, 10: 2.0,
  };
  return table[zone] ?? (zone >= 7 ? 2.0 : Math.min(2.0, 0.5 + (zone - 1) * 0.25));
}

/** 상태 이상 기본 지속 턴 수 (적이 플레이어에게 부여할 때) */
export const STATUS_DEFAULT_TURNS = 3;

/** 적이 플레이어에게 상태 이상을 거는 확률 (0~1) */
export const ENEMY_INFLICT_STATUS_CHANCE = 0.28;
