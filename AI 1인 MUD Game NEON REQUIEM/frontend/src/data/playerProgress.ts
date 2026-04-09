/**
 * 플레이어 레벨/경험치 진행 — 만렙 50 기준 밸런스
 * WHY: 기존 maxExp × 1.5 기하는 후반에 요구 경험치가 비현실적으로 커져
 *      '만렙 50' 설계와 맞지 않았음. 다항 곡선으로 완만히 증가시켜
 *      잡몹 보상(수십~수백 EXP)과 맞는 분량으로 조정한다.
 */

/** 유저 최대 레벨 (게임 설계 상한) */
export const PLAYER_MAX_LEVEL = 50;

/**
 * 현재 레벨 L에서 다음 레벨(L+1)까지 필요한 경험치.
 * L이 만렙이면 UI용 더미값(1) — 실제로는 레벨업하지 않음.
 */
export function expRequiredForNextLevel(currentLevel: number): number {
  const L = Math.floor(currentLevel);
  if (L >= PLAYER_MAX_LEVEL) return 1;
  if (L < 1) return expRequiredForNextLevel(1);
  // L=1일 때 약 170 전후 → 초반 체감 적당; L=49일 때 약 2만대 후반
  return Math.floor((100 + 40 * L + 6 * L * L + 0.05 * L * L * L) * 1.12);
}

export interface PlayerLevelSnapshot {
  level: number;
  exp: number;
  maxExp: number;
}

/**
 * 로드/마이그레이션용: 레벨 상한, 경험치 누적, maxExp 불일치를 한 번에 정리.
 * WHY: 구세이브는 기하급수 maxExp를 쓰고 있어, 현재 레벨 기준으로 요구치를 다시 맞춘다.
 */
export function normalizePlayerLevelProgress(
  level: number,
  exp: number,
  _legacyMaxExp: number
): PlayerLevelSnapshot {
  let L = Math.min(PLAYER_MAX_LEVEL, Math.max(1, Math.floor(level || 1)));
  let E = Math.max(0, Math.floor(exp || 0));
  let ME = expRequiredForNextLevel(L);

  while (L < PLAYER_MAX_LEVEL && E >= ME) {
    E -= ME;
    L += 1;
    if (L >= PLAYER_MAX_LEVEL) {
      return { level: PLAYER_MAX_LEVEL, exp: 0, maxExp: 1 };
    }
    ME = expRequiredForNextLevel(L);
  }

  if (L >= PLAYER_MAX_LEVEL) {
    return { level: PLAYER_MAX_LEVEL, exp: 0, maxExp: 1 };
  }

  return { level: L, exp: E, maxExp: ME };
}
