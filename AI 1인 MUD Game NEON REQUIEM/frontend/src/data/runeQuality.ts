/**
 * 룬 품질(quality) 및 직업 공명(resonance_bonus) 배율
 * WHY: 동일 룬이라도 인스턴스마다 효율이 달라지고, 직업과 맞을 때 추가 보정을 준다.
 */

import type { RuneId } from './runes';

/** 장착·계산 시 품질 기본값(구세이브·데이터 없음) */
export const DEFAULT_RUNE_QUALITY = 1;

/** 직업이 룬과 "공명"할 때 곱해지는 추가 배율 */
export const RUNE_RESONANCE_BONUS_MULT = 1.25;

/**
 * RuneId → 공명으로 인정할 직업명(게임 내 job 문자열과 동일해야 함).
 * WHY: 기획상 직업 컨셉과 맞는 룬만 resonance_bonus를 받는다.
 */
export const RUNE_RESONANCE_JOB: Partial<Record<RuneId, string>> = {
  berserker: '전사',
  paladin: '성직자',
  assassin: '도적',
  sage: '마법사',
  tracker: '로그',
  necromancer: '마법사',
  gladiator: '전사',
  guardian: '성직자',
  wind_sage: '마법사',
  alchemist: '마법사',
  gambler: '로그',
  soul_binder: '성직자',
  war_mage: '마법사',
  shield_preacher: '성직자',
  shadow_illusionist: '도적',
};

export function clampRuneQuality(q: number): number {
  if (!Number.isFinite(q)) return DEFAULT_RUNE_QUALITY;
  return Math.min(1.35, Math.max(0.65, q));
}

/** 드랍·지급 시 품질 롤 (0.75 ~ 1.2 부근) */
export function rollRuneQualityForDrop(): number {
  return clampRuneQuality(0.72 + Math.random() * 0.52);
}

export function hasRuneResonance(runeId: RuneId, jobName: string | null | undefined): boolean {
  const j = RUNE_RESONANCE_JOB[runeId];
  if (!j || !jobName) return false;
  return j === jobName;
}

/** 품질 × (공명 시 RUNE_RESONANCE_BONUS_MULT) */
export function getRuneEffectScale(
  runeId: RuneId,
  quality: number,
  jobName: string | null | undefined,
): number {
  const q = clampRuneQuality(quality);
  return hasRuneResonance(runeId, jobName) ? q * RUNE_RESONANCE_BONUS_MULT : q;
}

/**
 * 패시브 계산용: 해당 룬이 주/보조 중 어디에 장착됐는지에 맞는 품질로 배율을 고른다.
 */
export function getRuneScaleForPassive(
  targetRuneId: RuneId,
  primaryId: string | null | undefined,
  secondaryId: string | null | undefined,
  primaryQuality: number,
  secondaryQuality: number,
  jobName: string | null | undefined,
): number {
  if (primaryId === targetRuneId) return getRuneEffectScale(targetRuneId, primaryQuality, jobName);
  if (secondaryId === targetRuneId) return getRuneEffectScale(targetRuneId, secondaryQuality, jobName);
  return DEFAULT_RUNE_QUALITY;
}

export function formatRuneQualityShort(q: number): string {
  const v = Math.round(clampRuneQuality(q) * 100) / 100;
  return `품질×${v.toFixed(2)}`;
}

export function describeResonanceIfAny(runeId: RuneId, jobName: string | null | undefined): string {
  if (!hasRuneResonance(runeId, jobName)) return '';
  return ` · 공명(${RUNE_RESONANCE_BONUS_MULT}×)`;
}

/** 장착 로그 한 줄 보강용 */
export function formatRuneEquipMetaLine(
  runeId: RuneId,
  quality: number,
  jobName: string | null | undefined,
  passiveShort: string,
): string {
  return `· ${formatRuneQualityShort(quality)}${describeResonanceIfAny(runeId, jobName)} — ${passiveShort}`;
}
