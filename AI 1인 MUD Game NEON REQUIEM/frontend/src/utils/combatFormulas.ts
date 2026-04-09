// 전투 시 플레이어 물리 공격용 유틸 — 갑옷 파쇄·전사 표식 등
import type { ActiveEnemy } from '../data/enemies';

/** 갑옷 파쇄가 걸린 동안 유효 방어력 (최소 1) */
export function effectiveEnemyDefForPhysical(e: ActiveEnemy): number {
  const sub = (e.sunderTurns ?? 0) > 0 ? (e.sunderDefFlat ?? 0) : 0;
  return Math.max(1, e.def - sub);
}

/** 전사 표식: 물리 피해에만 배율 적용 */
export function applyWarriorMarkPhysicalDamage(e: ActiveEnemy, dmg: number): number {
  if (!e.warriorMarkActive) return dmg;
  return Math.max(1, Math.round(dmg * 1.35));
}
