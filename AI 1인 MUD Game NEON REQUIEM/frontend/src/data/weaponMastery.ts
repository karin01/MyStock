// 무기 마스터리 — 무기 계열별 경험치·레벨
// WHY: 해당 무기를 계속 사용하면 마스터리가 오르고, 상급 무기는 일정 마스터리 이상만 착용 가능.

export type WeaponClass = 'dagger' | 'sword' | 'greatsword' | 'staff' | 'mace' | 'bow';

/** 레벨별 필요 누적 경험치 (인덱스 0 = Lv1, 1 = Lv2 ...) */
export const MASTERY_EXP_TABLE: number[] = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];

/** 공격 1회당 획득 마스터리 경험치 */
export const MASTERY_EXP_PER_HIT = 8;

export const WEAPON_CLASS_LABEL: Record<WeaponClass, string> = {
  dagger: '단검',
  sword: '도검',
  greatsword: '양손검',
  staff: '지팡이',
  mace: '둔기',
  bow: '활',
};

/** 누적 경험치로 현재 레벨 계산 (1~10) */
export function expToLevel(exp: number): number {
  let level = 1;
  for (let i = MASTERY_EXP_TABLE.length - 1; i >= 0; i--) {
    if (exp >= MASTERY_EXP_TABLE[i]) {
      level = i + 1;
      break;
    }
  }
  return Math.min(10, level);
}

/** 다음 레벨까지 필요한 누적 경험치 (현재 레벨 기준) */
export function expToNextLevel(currentLevel: number): number {
  if (currentLevel >= 10) return MASTERY_EXP_TABLE[9];
  return MASTERY_EXP_TABLE[currentLevel];
}

/** 현재 레벨 구간에서 다음 레벨까지 남은 경험치 */
export function expRemainingToNext(currentExp: number, currentLevel: number): number {
  const nextThreshold = expToNextLevel(currentLevel);
  return Math.max(0, nextThreshold - currentExp);
}
