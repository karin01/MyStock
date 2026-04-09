/**
 * 전역 경제·스킬 비용 배율
 * WHY: 아이템 가격·COIN 지출·스킬 MP를 한 곳에서 동일 비율로 조정
 */
export const ECONOMY_COST_WORLD_MULT = 1.5;

/** COIN 지출(구매·강화·수리·패시브 등) — 0 이하는 그대로 */
export function scaleCoinCost(base: number): number {
  if (!Number.isFinite(base) || base <= 0) return Math.max(0, Math.round(base));
  return Math.max(1, Math.round(base * ECONOMY_COST_WORLD_MULT));
}

/** 스킬·대응기(대응 가드 등) MP — 0은 유지 */
export function scaleSkillMpCost(base: number): number {
  if (!Number.isFinite(base) || base <= 0) return base <= 0 ? base : 0;
  return Math.max(1, Math.round(base * ECONOMY_COST_WORLD_MULT));
}
