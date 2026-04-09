/**
 * 디시플린 룬 빌드·시너지 계산 (NEURAL RUNE MATRIX 확장)
 * WHY: 5직업 × 2룬 슬롯 조합을 일관되게 평가하고, 히든 시너지만 중앙에서 판별한다.
 */
import type { RuneId } from '../data/runes';
import { RUNES_BY_ID } from '../data/runes';
import { getWallDefForVillageOrGate, ZONE_OFFICIAL_VILLAGE } from '../data/villageDefense';

/** ANSI 93m — Console.tsx에서 금색으로 렌더 */
export const SYNERGY_RESONANCE_LINE =
  '\u001b[93m[SYNERGY] 당신의 영혼에 새겨진 두 룬이 공명하며 숨겨진 힘이 깨어납니다!\u001b[0m';

/** 치명적 광역 연출용 마커 — Console에서 화면 흔들림 CSS 트리거 */
export const SCREEN_SHAKE_MARKER = '[SCREEN_SHAKE]';

export function playerHasRune(
  equippedRuneId: string | null | undefined,
  equippedRuneSecondaryId: string | null | undefined,
  id: RuneId,
): boolean {
  return equippedRuneId === id || equippedRuneSecondaryId === id;
}

/** 직업 id(jobClasses) × 룬 14종 × 2슬롯(순서 구분) 이론 조합 수의 하한 (기획 문구용) */
export function estimateStrategicBuildCount(jobCount = 5, runeCount = 14): number {
  // 슬롯 A≠B: n*(n-1), 직업 배수
  return jobCount * runeCount * Math.max(0, runeCount - 1);
}

export function hasRunePair(
  equippedRuneId: string | null | undefined,
  equippedRuneSecondaryId: string | null | undefined,
  a: RuneId,
  b: RuneId,
): boolean {
  const s = new Set([equippedRuneId, equippedRuneSecondaryId].filter(Boolean) as string[]);
  return s.has(a) && s.has(b);
}

export type SynergyId = 'slaughterer' | 'tactical_nuke' | 'moving_fortress' | 'ghost_sniper';

export function getActiveSynergyIds(
  equippedRuneId: string | null | undefined,
  equippedRuneSecondaryId: string | null | undefined,
): SynergyId[] {
  const out: SynergyId[] = [];
  if (hasRunePair(equippedRuneId, equippedRuneSecondaryId, 'berserker', 'gladiator')) out.push('slaughterer');
  if (hasRunePair(equippedRuneId, equippedRuneSecondaryId, 'war_mage', 'tracker')) out.push('tactical_nuke');
  if (hasRunePair(equippedRuneId, equippedRuneSecondaryId, 'shield_preacher', 'guardian')) out.push('moving_fortress');
  if (hasRunePair(equippedRuneId, equippedRuneSecondaryId, 'assassin', 'tracker')) out.push('ghost_sniper');
  return out;
}

export function synergyDisplayLabel(id: SynergyId): string {
  switch (id) {
    case 'slaughterer':
      return '슬로터(Slaughterer)';
    case 'tactical_nuke':
      return '전술 핵(Tactical Nuke)';
    case 'moving_fortress':
      return '움직이는 요새';
    case 'ghost_sniper':
      return '고스트 스나이퍼';
    default:
      return id;
  }
}

/** 장착 직후 시너지가 생기면 true — 로그 1줄 출력용 */
export function shouldAnnounceSynergyResonance(
  primary: string | null | undefined,
  secondary: string | null | undefined,
): boolean {
  return getActiveSynergyIds(primary, secondary).length > 0;
}

/** 길드 영지 근사: 공성벽이 있는 마을 거점 또는 공식 마을 방 ID 안 */
export function isGuildTerritoryRoom(roomId: string | undefined | null): boolean {
  if (!roomId) return false;
  if (getWallDefForVillageOrGate(roomId)) return true;
  return ZONE_OFFICIAL_VILLAGE.some((z) => z.roomId === roomId);
}

export function formatBuildFlavorLog(
  jobName: string | undefined,
  primary: string | null | undefined,
  secondary: string | null | undefined,
): string | undefined {
  if (!jobName || (!primary && !secondary)) return undefined;
  const names: string[] = [];
  if (primary && RUNES_BY_ID[primary as RuneId]) names.push(RUNES_BY_ID[primary as RuneId].displayName);
  if (secondary && RUNES_BY_ID[secondary as RuneId]) names.push(RUNES_BY_ID[secondary as RuneId].displayName);
  if (names.length === 0) return undefined;
  const syn = getActiveSynergyIds(primary, secondary);
  const synBit =
    syn.length > 0
      ? ` · 시너지: ${syn.map(synergyDisplayLabel).join(', ')}`
      : '';
  return `◇ [빌드 서명] ${jobName} + ${names.join(' / ')}${synBit}`;
}

export function wrapScreenShakeLines(lines: string): string {
  return `${SCREEN_SHAKE_MARKER}\n${lines}`;
}
