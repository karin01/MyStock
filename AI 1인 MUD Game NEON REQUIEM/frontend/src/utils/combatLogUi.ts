/**
 * 전투 기록창 카드 헤더 — Console.tsx와 동일한 줄바꿈 규약으로 묶음.
 * WHY: 이미지1 레퍼런스 — 「▶ 나의 공격」분홍 바, 「◀ 적의 공격」녹색 바.
 */

export const COMBAT_LOG_PLAYER_HEADER = '▶ 나의 공격' as const;
export const COMBAT_LOG_ENEMY_HEADER = '◀ 적의 공격' as const;

export function wrapCombatLogPlayerBody(body: string): string {
  return `${COMBAT_LOG_PLAYER_HEADER}\n${body.replace(/^\n+/, '').trimEnd()}`;
}

export function wrapCombatLogEnemyBody(body: string): string {
  return `${COMBAT_LOG_ENEMY_HEADER}\n${body.replace(/^\n+/, '').trimEnd()}`;
}

export function isCombatLogPlayerEntry(log: string): boolean {
  return log.startsWith(`${COMBAT_LOG_PLAYER_HEADER}\n`) || log.startsWith(`${COMBAT_LOG_PLAYER_HEADER}\r\n`);
}

export function isCombatLogEnemyEntry(log: string): boolean {
  return log.startsWith(`${COMBAT_LOG_ENEMY_HEADER}\n`) || log.startsWith(`${COMBAT_LOG_ENEMY_HEADER}\r\n`);
}

/**
 * WHY: 같은 적(턴) 안에서 줄마다 ◀ 적의 공격 카드를 새로 만들면 헤더가 불필요하게 반복된다.
 *      직전 로그가 이미 적 턴 카드면 본문만 줄바꿈으로 붙인다.
 * @param startNewEnemyCard 한 라운드에 복수 적이 있을 때, 두 번째 적부터 첫 줄은 새 카드로 시작
 */
export function appendEnemyCombatLog(
  prev: string[],
  bodyChunk: string,
  startNewEnemyCard?: boolean,
): string[] {
  const chunk = bodyChunk.replace(/^\n+/, '').trimEnd();
  if (!chunk) return prev;
  if (startNewEnemyCard) {
    return [...prev, wrapCombatLogEnemyBody(chunk)];
  }
  if (prev.length === 0) return [wrapCombatLogEnemyBody(chunk)];
  const last = prev[prev.length - 1];
  if (typeof last === 'string' && isCombatLogEnemyEntry(last)) {
    return [...prev.slice(0, -1), `${last}\n${chunk}`];
  }
  return [...prev, wrapCombatLogEnemyBody(chunk)];
}

/** Console에서 헤더 줄을 제외한 본문만 추출 */
export function stripCombatLogHeader(log: string): { variant: 'player' | 'enemy'; body: string } | null {
  const pl = `${COMBAT_LOG_PLAYER_HEADER}\n`;
  const plr = `${COMBAT_LOG_PLAYER_HEADER}\r\n`;
  const el = `${COMBAT_LOG_ENEMY_HEADER}\n`;
  const elr = `${COMBAT_LOG_ENEMY_HEADER}\r\n`;
  if (log.startsWith(pl)) return { variant: 'player', body: log.slice(pl.length) };
  if (log.startsWith(plr)) return { variant: 'player', body: log.slice(plr.length) };
  if (log.startsWith(el)) return { variant: 'enemy', body: log.slice(el.length) };
  if (log.startsWith(elr)) return { variant: 'enemy', body: log.slice(elr.length) };
  return null;
}
