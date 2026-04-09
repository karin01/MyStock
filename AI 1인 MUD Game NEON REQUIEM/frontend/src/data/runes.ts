/**
 * 룬(각인) 데이터 — 패시브 + 전용 스킬 1개 동기화용
 * WHY: 룬 규칙을 한곳에 모아 UI/저장/전투 로직에서 같은 정의를 참조한다.
 */

import { getRuneEffectScale } from './runeQuality';

export type RuneId =
  | 'berserker'
  | 'paladin'
  | 'assassin'
  | 'sage'
  | 'tracker'
  | 'necromancer'
  | 'gladiator'
  | 'guardian'
  | 'wind_sage'
  | 'alchemist'
  | 'gambler'
  | 'soul_binder'
  | 'war_mage'
  | 'shield_preacher'
  | 'shadow_illusionist';

/** 스킬창·명령에 쓰이는 한글 스킬명(직업 스킬과 겹치지 않게 유지) */
export type RuneSkillKo =
  | '프렌지'
  | '심판'
  | '암살'
  | '명상'
  | '표식'
  | '해골 소환'
  | '룬 카운터'
  | '수호의 외침'
  | '대시'
  | '독 도포'
  | '올인'
  | '영혼 교체'
  | '오버로드'
  | '철의 요새'
  | '미라지';

export interface RuneDefinition {
  id: RuneId;
  /** HUD·로그용 */
  displayName: string;
  /** equip 매칭용 별칭 */
  aliases: string[];
  skillKo: RuneSkillKo;
  passiveShort: string;
}

/** 룬 장착 가능 최소 레벨 — 미만이면 장착 명령 거부, 로드 시 equippedRuneId는 해제 */
export const RUNE_EQUIP_MIN_LEVEL = 21;

export const RUNE_DATA: RuneDefinition[] = [
  {
    id: 'berserker',
    displayName: '광전사',
    aliases: ['광전사', '버서커', 'berserker'],
    skillKo: '프렌지',
    passiveShort: '체력이 낮을수록 ATK 증가',
  },
  {
    id: 'paladin',
    displayName: '성기사',
    aliases: ['성기사', '팔라딘', 'paladin'],
    skillKo: '심판',
    passiveShort: '모든 속성 저항 상승',
  },
  {
    id: 'assassin',
    displayName: '암살자',
    aliases: ['암살자', '어쌔신', 'assassin'],
    skillKo: '암살',
    passiveShort: '치명타 확률·피해 증가',
  },
  {
    id: 'sage',
    displayName: '현자',
    aliases: ['현자', '세이지', 'sage'],
    skillKo: '명상',
    passiveShort: '전투 중 MP 재생 강화',
  },
  {
    id: 'tracker',
    displayName: '추적자',
    aliases: ['추적자', '트래커', 'tracker'],
    skillKo: '표식',
    passiveShort: '원거리 사거리 +1칸',
  },
  {
    id: 'necromancer',
    displayName: '강령술사',
    aliases: ['강령술사', '너크로맨서', 'necromancer'],
    skillKo: '해골 소환',
    passiveShort: '적 처치 시 HP/MP 흡수',
  },
  {
    id: 'gladiator',
    displayName: '검투사',
    aliases: ['검투사', '글래디에이터', 'gladiator'],
    skillKo: '룬 카운터',
    passiveShort: '근접(비마법) 피해량 증가',
  },
  {
    id: 'guardian',
    displayName: '수호자',
    aliases: ['수호자', '가디언', 'guardian'],
    skillKo: '수호의 외침',
    passiveShort: '최대 HP +20%, DEF 보정',
  },
  {
    id: 'wind_sage',
    displayName: '바람술사',
    aliases: ['바람술사', '윈드', 'wind', 'wind_sage'],
    skillKo: '대시',
    passiveShort: '회피율 증가',
  },
  {
    id: 'alchemist',
    displayName: '연금술사',
    aliases: ['연금술사', '알케미스트', 'alchemist'],
    skillKo: '독 도포',
    passiveShort: '포션 회복량 증가',
  },
  {
    id: 'gambler',
    displayName: '도박사',
    aliases: ['도박사', '겜블러', 'gambler'],
    skillKo: '올인',
    passiveShort: '드랍·COIN +20%',
  },
  {
    id: 'soul_binder',
    displayName: '영혼결속자',
    aliases: ['영혼결속자', '소울바인더', 'soul', 'soul_binder'],
    skillKo: '영혼 교체',
    passiveShort: '사망 시 경험치 손실 면제',
  },
  {
    id: 'war_mage',
    displayName: '파괴법사',
    aliases: ['파괴법사', '워메이지', 'war_mage'],
    skillKo: '오버로드',
    passiveShort: '마법 치명타 피해 +50%',
  },
  {
    id: 'shield_preacher',
    displayName: '철벽전도사',
    aliases: ['철벽전도사', '쉴드', 'shield_preacher'],
    skillKo: '철의 요새',
    passiveShort: '방패 착용 시 피해 반사 15%',
  },
  {
    id: 'shadow_illusionist',
    displayName: '그림자술사',
    aliases: ['그림자술사', '섀도우', 'shadow', 'shadow_illusionist'],
    skillKo: '미라지',
    passiveShort: '은신 지속 증가·분신으로 적 명중 저하',
  },
];

export const RUNES_BY_ID: Record<RuneId, RuneDefinition> = RUNE_DATA.reduce(
  (acc, r) => {
    acc[r.id] = r;
    return acc;
  },
  {} as Record<RuneId, RuneDefinition>,
);

/** 장착 해제 시 스킬 배열에서 뺄 이름 목록 */
export const ALL_RUNE_SKILL_NAMES: string[] = RUNE_DATA.map((r) => r.skillKo);

/** 성기사 룬: 속성 저항 각 +8%p (상한은 기존 로직 0.75) */
export const RUNE_PALADIN_RESIST_FLAT = 0.08;

/** 바람술사 룬: 회피 확률 +12%p */
export const RUNE_WIND_DODGE_FLAT = 0.12;

/** 수호자 룬: 추가 flat DEF */
export const RUNE_GUARDIAN_DEF_FLAT = 10;

export function getRuneSkillName(id: RuneId): RuneSkillKo {
  return RUNES_BY_ID[id].skillKo;
}

export function findRuneIdByQuery(q: string): RuneId | null {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  for (const r of RUNE_DATA) {
    if (r.id === s) return r.id;
    if (r.displayName.toLowerCase() === s) return r.id;
    if (r.aliases.some((a) => a.toLowerCase() === s)) return r.id;
  }
  return null;
}

/** 룬 스킬만 제거한 뒤 장착 중인 룬(최대 2)의 전용 스킬명을 다시 붙인다. */
export function applyEquippedRuneSkillsToList(
  skills: string[],
  primary: string | null | undefined,
  secondary: string | null | undefined,
): string[] {
  let next = [...skills];
  for (const sk of ALL_RUNE_SKILL_NAMES) {
    next = next.filter((x) => x !== sk);
  }
  const seenSkill = new Set<string>();
  for (const rid of [primary, secondary]) {
    if (!rid || !RUNES_BY_ID[rid as RuneId]) continue;
    const sk = RUNES_BY_ID[rid as RuneId].skillKo;
    if (seenSkill.has(sk)) continue;
    seenSkill.add(sk);
    if (!next.includes(sk)) next.push(sk);
  }
  return next;
}

/** 패시브 저항 보정(성기사) — 주/보조 슬롯 어느 쪽이든 성기사면 적용(품질·공명 반영) */
export function applyPaladinRuneResist<T extends Record<'불' | '얼음' | '전기' | '독', number>>(
  resist: T,
  equippedRuneId: string | null | undefined,
  equippedRuneSecondaryId?: string | null | undefined,
  opts?: {
    primaryQuality?: number;
    secondaryQuality?: number;
    jobName?: string | null;
  },
): T {
  const palPrimary = equippedRuneId === 'paladin';
  const palSecondary = equippedRuneSecondaryId === 'paladin';
  if (!palPrimary && !palSecondary) return resist;

  const qPri = opts?.primaryQuality ?? 1;
  const qSec = opts?.secondaryQuality ?? 1;
  const job = opts?.jobName;
  let addFlat = 0;
  if (palPrimary) addFlat += RUNE_PALADIN_RESIST_FLAT * getRuneEffectScale('paladin', qPri, job);
  if (palSecondary) addFlat += RUNE_PALADIN_RESIST_FLAT * getRuneEffectScale('paladin', qSec, job);

  const out = { ...resist };
  (['불', '얼음', '전기', '독'] as const).forEach((el) => {
    out[el] = Math.min(0.75, (out[el] ?? 0) + addFlat);
  });
  return out;
}
