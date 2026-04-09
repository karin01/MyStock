// 태세(공격/공방/방어) — 스킬이 아닌 지속 자세. 전투 여부와 무관하게 ATK·DEF·자동방어 확률에 반영, 턴 소모 없음.
// WHY: 공격 태세는 딜 교환, 방어 태세는 생존, 공방은 기본 플레이를 분리한다.

export type BattlePosture = 'attack' | 'balanced' | 'defense';

export const BATTLE_POSTURE_LABEL: Record<BattlePosture, string> = {
  attack: '공격',
  balanced: '공방',
  defense: '방어',
};

/** ATK 최종 배율 (공방 = 1) */
export const BATTLE_POSTURE_ATK_MULT: Record<BattlePosture, number> = {
  attack: 1.15,
  balanced: 1,
  defense: 0.85,
};

/** DEF 최종 배율 (공방 = 1) */
export const BATTLE_POSTURE_DEF_MULT: Record<BattlePosture, number> = {
  attack: 0.85,
  balanced: 1,
  defense: 1.15,
};

/**
 * 갑옷 기반 자동 방어(가드) 발동 확률 배율 (공방 = 1)
 * WHY: 공격 태세는 들이박는 자세라 가드가 덜 뜨고, 방어 태세는 막기에 집중한다.
 */
export const BATTLE_POSTURE_GUARD_CHANCE_MULT: Record<BattlePosture, number> = {
  attack: 0.75,
  balanced: 1,
  defense: 1.25,
};

/** 갑옷 자동방어 확률(0~1)에 전투 태세를 곱해 상한 95%로 자름 */
export function applyPostureToGuardChance(
  baseChance: number,
  posture: BattlePosture
): number {
  const m = BATTLE_POSTURE_GUARD_CHANCE_MULT[posture];
  return Math.min(0.95, Math.max(0, baseChance * m));
}

export function isBattlePosture(v: unknown): v is BattlePosture {
  return v === 'attack' || v === 'balanced' || v === 'defense';
}
