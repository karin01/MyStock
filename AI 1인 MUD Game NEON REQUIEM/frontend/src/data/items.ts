import type { ElementType } from './elemental';
import type { RolledAffixLine } from './appraisal';
import { scaleCoinCost } from './economyBalance';

/** 아이템 등급: 커먼 → … → 에픽 → 레전드리(상점 비판매·드랍 전용 권장) */
export type ItemGrade = 'common' | 'normal' | 'magic' | 'rare' | 'epic' | 'legendary';

export const ITEM_GRADE_LABEL: Record<ItemGrade, string> = {
  common: '커먼',
  normal: '노멀',
  magic: '매직',
  rare: '레어',
  epic: '에픽',
  legendary: '레전드리',
};

/** 효과 등급 사다리 (강화 티어 승급 순서) */
export const ITEM_GRADE_LADDER: ItemGrade[] = ['common', 'normal', 'magic', 'rare', 'epic', 'legendary'];

/** 등급 순위 비교용 (베일 룰렛 상한·상점 필터 등) */
export function itemGradeRank(g: ItemGrade | undefined): number {
  const x = g ?? 'common';
  const i = ITEM_GRADE_LADDER.indexOf(x);
  return i >= 0 ? i : 0;
}

export function itemGradeLeq(itemGrade: ItemGrade | undefined, capGrade: ItemGrade): boolean {
  return itemGradeRank(itemGrade) <= itemGradeRank(capGrade);
}

/** 상점에서 절대 판매하지 않는 등급 — 드랍·전리품·퀘스트 등으로만 유통 */
export function isShopExcludedGrade(grade: ItemGrade | undefined): boolean {
  return grade === 'legendary';
}

/** 티어 내 최대 +값 (+0 ~ +5, +6에서 다음 티어 +0으로 승급) */
export const EQUIPMENT_PLUS_MAX = 5;

/** 한 번 강화당 필요한 동일 종류 재료 개수 */
export const MATERIAL_COUNT_PER_ENCHANT = 2;

/**
 * 강화 대상의 「현재 효과 티어」에 맞는 재료 정의 등급.
 * WHY: 노멀→커먼 2, 매직→노멀 2, 레어→매직 2, 에픽→에픽 2, 레전드리→에픽 2(희귀 재료)
 */
export function getMaterialGradeForEnchantTarget(currentEffectiveTier: ItemGrade): ItemGrade {
  switch (currentEffectiveTier) {
    case 'common':
      return 'common';
    case 'normal':
      return 'common';
    case 'magic':
      return 'normal';
    case 'rare':
      return 'magic';
    case 'epic':
      return 'epic';
    case 'legendary':
      return 'epic';
    default:
      return 'common';
  }
}

/** 다음 티어 (최종 등급이면 null) */
export function getNextTier(current: ItemGrade): ItemGrade | null {
  const i = ITEM_GRADE_LADDER.indexOf(current);
  if (i < 0 || i >= ITEM_GRADE_LADDER.length - 1) return null;
  return ITEM_GRADE_LADDER[i + 1] ?? null;
}

/**
 * 인스턴스별 현재 효과 티어 + 플러스 (+0~5).
 * WHY: 세이브의 equipmentEffectiveGrade(승급) + equipmentUpgradeLevels(플러스)로 표시/전투 보너스를 맞춘다.
 */
export function resolveEquipmentEnchant(
  equipmentInstanceId: string,
  itemDef: { grade?: ItemGrade } | null | undefined,
  equipmentEffectiveGrade: Record<string, ItemGrade> | undefined,
  equipmentUpgradeLevels: Record<string, number> | undefined
): { tier: ItemGrade; plus: number } {
  const base = itemDef?.grade ?? 'common';
  const tier = equipmentEffectiveGrade?.[equipmentInstanceId] ?? base;
  const rawPlus = equipmentUpgradeLevels?.[equipmentInstanceId] ?? 0;
  const plus = Math.min(EQUIPMENT_PLUS_MAX, Math.max(0, rawPlus));
  return { tier, plus };
}

/**
 * 구세이브: 예전 +21마다 티어 상승 규칙 → 새 티어 +0~5 규칙으로 근사 변환.
 */
export function migrateLegacyEnchantLevel(oldLevel: number, baseGrade: ItemGrade): { tier: ItemGrade; plus: number } {
  const ladder = ITEM_GRADE_LADDER;
  const bi = Math.max(0, ladder.indexOf(baseGrade));
  const tierSteps = Math.floor(Math.max(0, oldLevel) / 21);
  const rem = Math.max(0, oldLevel) % 21;
  const newTierIdx = Math.min(bi + tierSteps, ladder.length - 1);
  const plus = Math.min(EQUIPMENT_PLUS_MAX, rem);
  return { tier: ladder[newTierIdx], plus };
}

/**
 * 무기/방어구 강화 보너스 (무기 min/max·피격 시 방어 가산에 동일 적용)
 * WHY: 색깔 등급(티어)만으로 우열이 고정되면 안 됨 — **같은 규칙이 모든 등급에 통용**되도록
 *      플러스(+0~5) 비중을 티어보다 크게 둬서, 예) **레어+5 > 에픽+1** 같은 역전이 강화분에서 분명히 나오게 함.
 *      (최종 DPS/방어는 여전히 베이스 아이템 수치·옵션·인스턴스 레벨과 합산됨.)
 * 공식: plus×4 + tierIndex×2 (common=0 … legendary=5)
 */
export function getEnchantStatBonusFromTierPlus(tier: ItemGrade, plus: number): number {
  const ti = Math.max(0, ITEM_GRADE_LADDER.indexOf(tier));
  const p = Math.min(EQUIPMENT_PLUS_MAX, Math.max(0, Math.floor(plus)));
  return p * 4 + ti * 2;
}

/**
 * 내구도 보너스 — 스탯 보너스와 같은 철학(플러스 비중↑).
 * 공식: plus×6 + tierIndex×9
 */
export function getEnchantDurabilityBonusFromTierPlus(tier: ItemGrade, plus: number): number {
  const ti = Math.max(0, ITEM_GRADE_LADDER.indexOf(tier));
  const p = Math.min(EQUIPMENT_PLUS_MAX, Math.max(0, Math.floor(plus)));
  return p * 6 + ti * 9;
}

// ─────────────────────────────────────────
// 아이템 “등급/옵션” 표준 정의 (랜덤 드랍/제작용)
// WHY: 등급별 색/가중치와 접두·접미 옵션을 중앙화해, 아이템 생성 로직이 흩어지지 않게 한다.
//      기존 ITEM_LIST의 grade(common~epic)는 유지하되, 신규 시스템은 아래 정의를 사용한다.
// ─────────────────────────────────────────

/** 신규 등급(표기용): 일반 → 매직 → 에픽 → 전설 → 신화 */
export type ItemGradeKR = '일반' | '매직' | '에픽' | '전설' | '신화';

export type AnsiColorCode =
  | '\u001b[0m'
  | '\u001b[37m' // 흰색/회색 계열
  | '\u001b[34m' // 파랑
  | '\u001b[35m' // 자홍
  | '\u001b[33m' // 노랑
  | '\u001b[31m'; // 빨강

export interface ItemGradeDef {
  /** UI/로그 출력에 사용할 한국어 라벨 */
  label: ItemGradeKR;
  /** ANSI 색상 코드 (콘솔/로그 텍스트 컬러링용) */
  ansiColor: AnsiColorCode;
  /** ANSI 리셋 코드 (색상 적용 후 반드시 붙이기) */
  ansiReset: '\u001b[0m';
  /**
   * 스탯 가중치(배율)
   * - 랜덤 옵션 수치 산출(예: STR +floor(base * multiplier))
   * - 기본 성능(무기 데미지/방어력/특수옵션 강도) 보정에 공통 사용
   */
  multiplier: number;
}

/** 등급별 ANSI 색상/스탯 가중치 정의 */
export const ITEM_GRADES: Record<ItemGradeKR, ItemGradeDef> = {
  일반: { label: '일반', ansiColor: '\u001b[37m', ansiReset: '\u001b[0m', multiplier: 1.0 },
  매직: { label: '매직', ansiColor: '\u001b[34m', ansiReset: '\u001b[0m', multiplier: 1.15 },
  에픽: { label: '에픽', ansiColor: '\u001b[35m', ansiReset: '\u001b[0m', multiplier: 1.35 },
  전설: { label: '전설', ansiColor: '\u001b[33m', ansiReset: '\u001b[0m', multiplier: 1.6 },
  신화: { label: '신화', ansiColor: '\u001b[31m', ansiReset: '\u001b[0m', multiplier: 1.9 },
};

/** 랜덤 옵션 적용용 “변경치” (ItemData 필드와 1:1로 맞춘다) */
export type ItemOptionMods = Partial<Pick<
  ItemData,
  | 'bonusStr'
  | 'bonusDex'
  | 'bonusCon'
  | 'bonusInt'
  | 'bonusSpr'
  | 'bonusDefense'
  | 'lifeStealPercent'
  | 'poisonChance'
  | 'elementDamage'
  | 'elementResist'
  | 'bonusCritChance'
  | 'bonusAccuracy'
  | 'grantsManaShield'
>>;

export interface ItemOptionDef {
  /** 내부 식별자 */
  id: string;
  /** 표시명(요청: [거인의] 처럼 괄호 포함) */
  name: string;
  /** 롤/출현 가중치 (클수록 자주 등장) */
  weight: number;
  /** 실제 적용될 옵션 변화 */
  mods: ItemOptionMods;
}

/**
 * 접두 옵션: 능력치 위주
 * - 한국어 어순이 자연스럽도록 "거인의 검" 같은 형태를 만들기 위해 “…의” 꼴을 유지
 * - name에는 요청대로 대괄호를 포함한다. (예: [거인의])
 */
export const PREFIX_OPTIONS: readonly ItemOptionDef[] = [
  { id: 'prefix_giant',      name: '[거인의]',  weight: 10, mods: { bonusStr: 4 } },
  { id: 'prefix_hero',       name: '[용사의]',  weight: 8,  mods: { bonusStr: 2, bonusCon: 2 } },
  { id: 'prefix_sage',       name: '[현자의]',  weight: 8,  mods: { bonusInt: 3, bonusSpr: 2 } },
  { id: 'prefix_tiger',      name: '[호랑이의]', weight: 9, mods: { bonusDex: 4 } },
  { id: 'prefix_ox',         name: '[황소의]',  weight: 8,  mods: { bonusCon: 4 } },
  { id: 'prefix_owl',        name: '[올빼미의]', weight: 7, mods: { bonusInt: 4 } },
  { id: 'prefix_sphinx',     name: '[스핑크스의]', weight: 7, mods: { bonusSpr: 4 } },
  { id: 'prefix_stars',      name: '[별의]',    weight: 4,  mods: { bonusStr: 1, bonusDex: 1, bonusCon: 1, bonusInt: 1, bonusSpr: 1 } },
];

/**
 * 접미 옵션: 특수 효과 위주
 * - "신속한 단검", "흡혈의 활"처럼 이름 끝에 붙여도 어색하지 않은 형용사/명사형 중심
 * - 특수 효과는 현재 시스템에서 즉시 반영 가능한 필드들(흡혈/독/치명/명중/원소)을 사용한다.
 */
export const SUFFIX_OPTIONS: readonly ItemOptionDef[] = [
  { id: 'suffix_swift',      name: '[신속한]',    weight: 10, mods: { bonusDex: 2, bonusAccuracy: 0.04 } },
  { id: 'suffix_destructive',name: '[파괴적인]',  weight: 8,  mods: { bonusCritChance: 0.06 } },
  { id: 'suffix_vampiric',   name: '[흡혈의]',    weight: 6,  mods: { lifeStealPercent: 0.10 } },
  { id: 'suffix_venomous',   name: '[맹독의]',    weight: 7,  mods: { poisonChance: 0.25 } },
  { id: 'suffix_precise',    name: '[정밀한]',    weight: 8,  mods: { bonusAccuracy: 0.06 } },
  { id: 'suffix_ruthless',   name: '[냉혹한]',    weight: 7,  mods: { bonusCritChance: 0.08 } },
  { id: 'suffix_warding',    name: '[수호의]',    weight: 6,  mods: { elementResist: { '불': 0.05, '얼음': 0.05, '전기': 0.05, '독': 0.05 } } },
  { id: 'suffix_elemental',  name: '[원소 깃든]', weight: 6,  mods: { elementDamage: { '불': 3, '얼음': 3, '전기': 3, '독': 3 } } },
];

export interface ItemData {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'shield' | 'consumable' | 'skillbook' | 'accessory';
  /** 등급: 커먼~에픽·레전드리(상점 비판매·드랍 전용) */
  grade?: ItemGrade;
  weaponClass?: 'sword' | 'greatsword' | 'dagger' | 'staff' | 'mace' | 'bow'; // 무기 종류
  minDamage?: number;  // 최소 무기 공격력
  maxDamage?: number;  // 최대 무기 공격력
  defense?: number; // 방어구/방패/장신구 방어력 (Armor/Shield/Accessory DEF)
  bonusDefense?: number; // 갑옷/방패 전용: 랜덤 방어력 증가 옵션 (실제 방어력 = defense + bonusDefense)
  price?: number; // 상점 구매/판매 기본가 (판매가는 30%)
  description: string;
  // 스탯 보너스 (장비/장신구/무기 옵션)
  bonusStr?: number;
  bonusDex?: number;
  bonusCon?: number;
  bonusInt?: number;
  bonusSpr?: number;
  // 장신구 슬롯
  slot?: 'ring' | 'necklace';
  // 특수 옵션: 흡혈 (무기 전용, 0.1 = 10%)
  lifeStealPercent?: number;
  // 특수 옵션: 공격 시 확률로 독 부여 (0.25 = 25%, 3턴 DoT)
  poisonChance?: number;
  /** 해당 무기 계열 마스터리 N레벨 이상일 때만 착용 가능 */
  requiredMastery?: number;
  /** 악세사리/무기: 속성별 추가 데미지 (공격 시 합산) */
  elementDamage?: Partial<Record<ElementType, number>>;
  /** 악세사리: 속성별 DoT 감소율 (0.1 = 10%, 패시브 레지스트와 합산) */
  elementResist?: Partial<Record<ElementType, number>>;
  /** 악세사리/장비: 치명타 확률 증가 (0.05 = 5%p, 기본 10%에 합산) */
  bonusCritChance?: number;
  /** 무기/장비: 명중률 보정 (0.05 = 5%p, 회피 높은 적 상대 시 유리) */
  bonusAccuracy?: number;
  /** 악세·감정 옵션: 비전서 없이 [마나 실드] 토글 사용 가능 (스킬과 동일 규칙) */
  grantsManaShield?: boolean;
}

export const ITEM_LIST: ItemData[] = [
  // 마법사 무기
  { id: 'staff_old', name: '초보자용 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 2, maxDamage: 3, price: 150, description: '마법 입문자를 위한 기본 지팡이.', bonusInt: 1, grade: 'common' },
  { id: 'staff_enhanced', name: '강화 마법 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 8, maxDamage: 14, price: 500, description: '마법 공격력을 크게 높여주는 강화 지팡이.', bonusInt: 2, grade: 'normal' },
  // 성직자 무기 (둔기 라인업 강화) — 둔기는 최저/최대 데미지 갭을 크게 두어 한 방 한 방의 편차를 키운다.
  { id: 'mace_newbie', name: '초보자용 둔기', type: 'weapon', weaponClass: 'mace', minDamage: 5, maxDamage: 12, price: 250, description: '성직자 훈련생을 위한 기본 둔기.', bonusStr: 2, grade: 'common' },
  { id: 'mace_rusted', name: '녹슨 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 6, maxDamage: 16, price: 120, description: '녹이 슨 저가형 둔기. 막 모험을 시작한 성직자가 쓰기 좋다.', bonusStr: 1, grade: 'common' },
  { id: 'mace_sturdy', name: '튼튼한 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 13, maxDamage: 27, price: 480, description: '균형 잡힌 중급 둔기. 초보자용 둔기에서 갈아타기 좋다.', bonusStr: 2, bonusCon: 1, grade: 'normal' },
  { id: 'mace_blessed', name: '축복받은 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 15, maxDamage: 29, price: 650, description: '축복의 문양이 새겨진 철퇴. 언데드 계열에게 특히 강합니다.', bonusStr: 3, grade: 'normal' },
  { id: 'mace_priest', name: '성직자의 메이스', type: 'weapon', weaponClass: 'mace', minDamage: 17, maxDamage: 31, price: 780, description: '신앙심이 깃든 메이스. 정신(SPR)에 따라 추가 피해를 준다.', bonusStr: 2, bonusSpr: 2, grade: 'magic' },
  { id: 'mace_holy_light', name: '성광의 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 19, maxDamage: 35, price: 980, description: '성스러운 빛이 맺혀 언데드에게 막대한 피해를 준다.', bonusStr: 3, bonusSpr: 3, elementDamage: { '불': 4 }, grade: 'magic' },
  { id: 'mace_vampiric', name: '흡혈 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 20, maxDamage: 38, price: 1250, description: '타격 시 일부 피해를 HP로 흡수하는 위험한 철퇴.', bonusStr: 2, lifeStealPercent: 0.12, grade: 'rare' },
  { id: 'mace_archbishop', name: '대주교의 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 24, maxDamage: 44, price: 1800, description: '고위 성직자만이 사용할 수 있는 상급 둔기. STR·SPR이 크게 오른다.', bonusStr: 4, bonusSpr: 4, requiredMastery: 4, grade: 'epic' },
  // 전사 무기 — 초보자 도검은 평균은 비슷하게, 편차는 둔기보다 작게
  { id: 'sword_old', name: '초보자용 도검', type: 'weapon', weaponClass: 'sword', minDamage: 8, maxDamage: 11, price: 200, description: '훈련용으로 널리 쓰이는 표준 도검.', bonusStr: 1, grade: 'common' },
  { id: 'sword_long', name: '강철 장검', type: 'weapon', weaponClass: 'sword', minDamage: 17, maxDamage: 24, price: 620, description: '잘 벼려진 강철 장검.', bonusStr: 2, grade: 'normal' },
  { id: 'sword_great', name: '정예 기사의 양손검', type: 'weapon', weaponClass: 'greatsword', minDamage: 28, maxDamage: 42, price: 1500, description: '엄청난 무게와 파괴력을 가진 양손검.', bonusStr: 4, grade: 'epic' },
  { id: 'sword_titanium', name: '티타늄 장검', type: 'weapon', weaponClass: 'sword', minDamage: 24, maxDamage: 35, price: 1100, description: '티타늄 합금으로 제작된 고성능 장검.', bonusDex: 2, grade: 'rare' },
  // 도적 무기
  { id: 'dagger_old', name: '초보자용 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 3, maxDamage: 5, price: 100, description: '초보 도적이 쓰는 가벼운 단검.', bonusDex: 1, grade: 'common' },
  { id: 'dagger_poison', name: '독 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 8, maxDamage: 14, price: 520, description: '독이 발려 있어 맞은 적이 확률적으로 중독된다. (3턴 간 턴당 5 피해)', bonusDex: 2, poisonChance: 0.35, grade: 'normal' },
  { id: 'dagger_standard', name: '일반 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 5, maxDamage: 9, price: 180, description: '흔히 쓰이는 표준 단검. 낡은 단검과 암살 단검 사이급.', bonusDex: 2, grade: 'normal' },
  { id: 'dagger_assassin', name: '암살 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 10, maxDamage: 16, price: 220, description: '치명적인 독이 발려있을 것 같은 예리한 단검. 공격 시 확률로 중독. (도적 시작 무기)', bonusDex: 3, poisonChance: 0.25, grade: 'normal' },
  { id: 'dagger_vampiric', name: '흡혈 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 16, maxDamage: 24, price: 1050, description: '적의 피를 빨아 사용자의 체력을 회복시키는 금지된 단검. (흡혈의 암살 단검급)', lifeStealPercent: 0.15, bonusDex: 2, grade: 'rare' },
  { id: 'dagger_vampirism_standard', name: '흡혈의 일반 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 6, maxDamage: 10, price: 380, description: '일반 단검에 흡혈이 깃든 것. 공격 시 적의 체력을 흡수한다.', bonusDex: 2, lifeStealPercent: 0.10, grade: 'magic' },
  { id: 'dagger_shadow', name: '그림자 송곳', type: 'weapon', weaponClass: 'dagger', minDamage: 20, maxDamage: 30, price: 1400, description: '어둠에 녹아드는 날카로운 송곳. 단검 마스터리 4 필요.', bonusDex: 4, requiredMastery: 4, grade: 'rare' },
  { id: 'dagger_legend', name: '전설의 암살검', type: 'weapon', weaponClass: 'dagger', minDamage: 26, maxDamage: 38, price: 2200, description: '전설의 암살자가 남긴 한 쌍의 단검. 단검 마스터리 6 필요.', bonusDex: 5, poisonChance: 0.2, requiredMastery: 6, grade: 'epic' },
  // 전사/기타 상급 무기
  { id: 'sword_flame', name: '불꽃 검', type: 'weapon', weaponClass: 'sword', minDamage: 28, maxDamage: 40, price: 1800, description: '불의 정수가 깃든 검. 도검 마스터리 4 필요.', bonusStr: 3, requiredMastery: 4, grade: 'epic' },
  { id: 'staff_archmage', name: '대현자의 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 12, maxDamage: 22, price: 1600, description: '고위 마법사의 상징. 지팡이 마스터리 4 필요.', bonusInt: 4, bonusSpr: 2, requiredMastery: 4, grade: 'epic' },
  { id: 'bow_storm', name: '폭풍의 활', type: 'weapon', weaponClass: 'bow', minDamage: 22, maxDamage: 34, price: 1700, description: '바람을 타는 화살. 활 마스터리 4 필요.', bonusDex: 5, requiredMastery: 4, grade: 'epic' },

  // ─── 레전드리 (상점·베일 블라인드 비판매 — 전리품·드랍으로만) ───
  {
    id: 'gs_neon_requiem',
    name: '네온 레퀴엠의 양손검',
    type: 'weapon',
    weaponClass: 'greatsword',
    minDamage: 36,
    maxDamage: 54,
    price: 0,
    description: '아카디아 관문을 지키던 데몬이 간직한 프로토타입. 어떤 상점에도 출고되지 않는다.',
    bonusStr: 5,
    bonusCritChance: 0.07,
    requiredMastery: 5,
    grade: 'legendary',
  },
  {
    id: 'staff_void_core',
    name: '공허 코어 지팡이',
    type: 'weapon',
    weaponClass: 'staff',
    minDamage: 18,
    maxDamage: 32,
    price: 0,
    description: '네오 리바이어던 심층에서만 안정화되는 코어를 박제한 금기의 지팡이.',
    bonusInt: 6,
    bonusSpr: 3,
    requiredMastery: 5,
    grade: 'legendary',
  },
  {
    id: 'bow_void_pierce',
    name: '공허 관통 활',
    type: 'weapon',
    weaponClass: 'bow',
    minDamage: 28,
    maxDamage: 42,
    price: 0,
    description: '홀로그램 장막을 관통하는 화살을 쏘도록 설계된 실험 병기.',
    bonusDex: 6,
    bonusAccuracy: 0.09,
    requiredMastery: 5,
    grade: 'legendary',
  },
  {
    id: 'dagger_shadow_sovereign',
    name: '그림자 군주의 비수',
    type: 'weapon',
    weaponClass: 'dagger',
    minDamage: 32,
    maxDamage: 46,
    price: 0,
    description: '그림자 군주를 쓰러뜨린 자만이 거둘 수 있는 잔향이 밴 단검.',
    bonusDex: 6,
    poisonChance: 0.3,
    requiredMastery: 6,
    grade: 'legendary',
  },
  {
    id: 'mace_abyss_judge',
    name: '심연 심판 철퇴',
    type: 'weapon',
    weaponClass: 'mace',
    minDamage: 26,
    maxDamage: 48,
    price: 0,
    description: '돌연변이 왕의 심장을 봉인한 듯 무거운 심판의 철퇴.',
    bonusStr: 5,
    bonusSpr: 4,
    lifeStealPercent: 0.08,
    requiredMastery: 5,
    grade: 'legendary',
  },
  {
    id: 'plate_requiem',
    name: '레퀴엠 판금',
    type: 'armor',
    defense: 36,
    bonusDefense: 6,
    price: 0,
    description: '관문 보스의 장갑을 재련한 듯한 데이터 잔향이 흐르는 판금.',
    bonusCon: 4,
    bonusStr: 2,
    grade: 'legendary',
  },

  // 로그 무기
  { id: 'bow_hunter', name: '초보자용 활', type: 'weapon', weaponClass: 'bow', minDamage: 5, maxDamage: 10, price: 380, description: '사냥 초보를 위한 기본 활.', bonusDex: 2, grade: 'normal' },
  { id: 'bow_sniper', name: '강화 사냥 활', type: 'weapon', weaponClass: 'bow', minDamage: 16, maxDamage: 26, price: 800, description: '원거리에서 높은 관통력을 자랑하는 강화 활.', bonusDex: 4, grade: 'rare' },

  // ─── 접두/접미 조합 무기 (등급: 낡은=매직, 강철/암살=매직~레어, 복합=레어, 인챈트=에픽) ───
  { id: 'sword_celerity', name: '신속의 낡은 도검', type: 'weapon', weaponClass: 'sword', minDamage: 10, maxDamage: 15, price: 320, description: '공격 속도를 끌어올리는 기운이 서린 철검.', bonusDex: 3, grade: 'magic' },
  { id: 'dagger_celerity', name: '신속의 낡은 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 2, maxDamage: 3, price: 220, description: '휘두르는 속도가 빨라지는 녹슨 단검.', bonusDex: 3, grade: 'magic' },
  { id: 'sword_evisceration', name: '적출의 강철 장검', type: 'weapon', weaponClass: 'sword', minDamage: 17, maxDamage: 24, price: 920, description: '치명타 확률을 높여 순간 폭딜을 노리기 좋은 장검.', bonusStr: 2, bonusCritChance: 0.08, grade: 'magic' },
  { id: 'dagger_evisceration', name: '적출의 암살 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 10, maxDamage: 16, price: 1280, description: '급소를 노리는 치명타가 잘 터지는 예리한 단검.', bonusDex: 3, bonusCritChance: 0.12, grade: 'rare' },
  { id: 'sword_ruin', name: '파멸의 강철 장검', type: 'weapon', weaponClass: 'sword', minDamage: 24, maxDamage: 34, price: 980, description: '기본 물리 데미지가 대폭 상승한 파괴적인 장검.', bonusStr: 2, grade: 'magic' },
  { id: 'mace_destruction', name: '파괴의 축복받은 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 22, maxDamage: 40, price: 950, description: '타격 데미지가 극대화된 묵직한 철퇴.', bonusStr: 3, grade: 'magic' },
  { id: 'greatsword_ruin', name: '파멸의 정예 기사의 양손검', type: 'weapon', weaponClass: 'greatsword', minDamage: 38, maxDamage: 54, price: 2100, description: '한 방 한 방이 파멸을 부르는 양손검.', bonusStr: 4, grade: 'epic' },
  { id: 'sword_accuracy', name: '정확의 티타늄 장검', type: 'weapon', weaponClass: 'sword', minDamage: 24, maxDamage: 35, price: 1350, description: '명중률이 보정되어 회피가 높은 적을 상대하기 좋다.', bonusDex: 2, bonusAccuracy: 0.06, grade: 'rare' },
  { id: 'bow_accuracy', name: '정확의 강화 사냥 활', type: 'weapon', weaponClass: 'bow', minDamage: 16, maxDamage: 26, price: 1000, description: '화살이 적중하기 쉬운 강화 활.', bonusDex: 4, bonusAccuracy: 0.05, grade: 'magic' },
  { id: 'sword_giants', name: '거인의 강철 장검', type: 'weapon', weaponClass: 'sword', minDamage: 19, maxDamage: 28, price: 880, description: '힘을 대폭 끌어올려 무거운 갑옷과 데미지에 유리하다.', bonusStr: 5, grade: 'magic' },
  { id: 'greatsword_giants', name: '거인의 정예 기사의 양손검', type: 'weapon', weaponClass: 'greatsword', minDamage: 30, maxDamage: 46, price: 1900, description: '거인의 힘이 깃든 양손검.', bonusStr: 6, grade: 'epic' },
  { id: 'mace_giants', name: '거인의 초보자 둔기', type: 'weapon', weaponClass: 'mace', minDamage: 11, maxDamage: 25, price: 420, description: '힘이 보강된 철퇴.', bonusStr: 4, grade: 'magic' },
  { id: 'dagger_tiger', name: '호랑이의 낡은 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 3, maxDamage: 5, price: 280, description: '민첩을 올려 회피와 공격 속도에 기여한다.', bonusDex: 4, grade: 'magic' },
  { id: 'sword_tiger', name: '호랑이의 티타늄 장검', type: 'weapon', weaponClass: 'sword', minDamage: 24, maxDamage: 35, price: 1250, description: '민첩이 깃든 경량 장검.', bonusDex: 4, grade: 'rare' },
  { id: 'bow_tiger', name: '호랑이의 사냥용 활', type: 'weapon', weaponClass: 'bow', minDamage: 10, maxDamage: 18, price: 520, description: '민첩을 높여주는 사냥용 활.', bonusDex: 4, grade: 'magic' },
  { id: 'mace_ox', name: '황소의 축복받은 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 15, maxDamage: 29, price: 820, description: '건강(CON)을 올려 체력을 보충하는 철퇴.', bonusStr: 3, bonusCon: 3, grade: 'magic' },
  { id: 'sword_ox', name: '황소의 낡은 도검', type: 'weapon', weaponClass: 'sword', minDamage: 10, maxDamage: 15, price: 350, description: '체력 보정이 붙은 철검.', bonusStr: 1, bonusCon: 3, grade: 'magic' },
  { id: 'staff_brilliance', name: '광휘의 낡은 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 3, maxDamage: 6, price: 280, description: '지능을 올려 마법사의 주문 위력을 높인다.', bonusInt: 4, grade: 'magic' },
  { id: 'staff_brilliance_enhanced', name: '광휘의 강화 마법 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 8, maxDamage: 14, price: 720, description: '지능이 크게 깃든 강화 지팡이.', bonusInt: 5, grade: 'magic' },
  { id: 'sword_flaming', name: '화염의 낡은 도검', type: 'weapon', weaponClass: 'sword', minDamage: 10, maxDamage: 15, price: 380, description: '화염 데미지를 추가하는 불꽃이 서린 검.', bonusStr: 1, elementDamage: { '불': 6 }, grade: 'magic' },
  { id: 'sword_flaming_long', name: '화염의 강철 장검', type: 'weapon', weaponClass: 'sword', minDamage: 17, maxDamage: 24, price: 900, description: '불의 정기가 깃든 장검.', bonusStr: 2, elementDamage: { '불': 8 }, grade: 'magic' },
  { id: 'staff_flaming', name: '화염의 강화 마법 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 8, maxDamage: 14, price: 680, description: '화염 마법 위력을 보조하는 지팡이.', bonusInt: 2, elementDamage: { '불': 10 }, grade: 'magic' },
  { id: 'sword_freezing', name: '냉기의 낡은 도검', type: 'weapon', weaponClass: 'sword', minDamage: 10, maxDamage: 15, price: 380, description: '냉기 데미지를 추가하는 서리가 내린 검.', bonusStr: 1, elementDamage: { '얼음': 6 }, grade: 'magic' },
  { id: 'dagger_freezing', name: '냉기의 낡은 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 2, maxDamage: 3, price: 260, description: '얼음 기운이 서린 단검.', bonusDex: 1, elementDamage: { '얼음': 5 }, grade: 'magic' },
  { id: 'staff_freezing', name: '냉기의 낡은 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 3, maxDamage: 6, price: 280, description: '빙결 마법을 보조하는 지팡이.', bonusInt: 1, elementDamage: { '얼음': 8 }, grade: 'magic' },
  { id: 'sword_shocking', name: '전격의 강철 장검', type: 'weapon', weaponClass: 'sword', minDamage: 17, maxDamage: 24, price: 880, description: '전격 데미지를 추가하는 번개가 감도는 장검.', bonusStr: 2, elementDamage: { '전기': 7 }, grade: 'magic' },
  { id: 'dagger_shocking', name: '전격의 암살 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 10, maxDamage: 16, price: 1100, description: '공격 시 전격이 섞여 나가는 단검.', bonusDex: 3, elementDamage: { '전기': 6 }, grade: 'rare' },
  { id: 'staff_shocking', name: '전격의 강화 마법 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 8, maxDamage: 14, price: 660, description: '번개 마법을 보조하는 지팡이.', bonusInt: 2, elementDamage: { '전기': 9 }, grade: 'magic' },
  { id: 'dagger_vampirism', name: '흡혈의 낡은 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 3, maxDamage: 5, price: 320, description: '낡은 단검에 흡혈이 깃든 것. 공격 시 일정 확률로 적의 체력을 흡수한다.', bonusDex: 1, lifeStealPercent: 0.12, grade: 'magic' },
  { id: 'sword_vampirism', name: '흡혈의 낡은 도검', type: 'weapon', weaponClass: 'sword', minDamage: 10, maxDamage: 15, price: 400, description: '피를 빨아들이는 저주받은 검.', bonusStr: 1, lifeStealPercent: 0.10, grade: 'magic' },
  { id: 'dagger_blight', name: '부패의 낡은 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 2, maxDamage: 4, price: 240, description: '독과 부패 데미지로 지속 피해를 입힌다.', bonusDex: 1, poisonChance: 0.30, grade: 'magic' },
  { id: 'dagger_blight_assassin', name: '부패의 암살 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 10, maxDamage: 16, price: 1020, description: '치명적인 부패가 발린 단검.', bonusDex: 3, poisonChance: 0.35, grade: 'rare' },
  { id: 'sword_blight', name: '부패의 강철 장검', type: 'weapon', weaponClass: 'sword', minDamage: 17, maxDamage: 24, price: 780, description: '적중 시 부패·독 데미지를 주는 장검.', bonusStr: 2, poisonChance: 0.20, grade: 'magic' },
  { id: 'sword_celerity_accuracy', name: '신속의 정확의 티타늄 장검', type: 'weapon', weaponClass: 'sword', minDamage: 24, maxDamage: 35, price: 1580, description: '공격 속도와 명중을 모두 보정한 경량 장검.', bonusDex: 4, bonusAccuracy: 0.05, grade: 'rare' },
  { id: 'dagger_evisceration_blight', name: '적출의 부패의 암살 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 10, maxDamage: 16, price: 1480, description: '치명타와 독을 동시에 노리는 암살용 단검.', bonusDex: 3, bonusCritChance: 0.10, poisonChance: 0.28, grade: 'rare' },
  { id: 'greatsword_giants_ruin', name: '거인의 파멸의 양손검', type: 'weapon', weaponClass: 'greatsword', minDamage: 40, maxDamage: 58, price: 2500, description: '힘과 파괴력이 결합된 최상급 양손검.', bonusStr: 6, grade: 'epic' },
  { id: 'staff_brilliance_flaming', name: '광휘의 화염의 강화 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 8, maxDamage: 14, price: 920, description: '지능과 화염 데미지를 모두 높이는 지팡이.', bonusInt: 5, elementDamage: { '불': 9 }, grade: 'rare' },
  { id: 'bow_tiger_accuracy', name: '호랑이의 정확의 강화 사냥 활', type: 'weapon', weaponClass: 'bow', minDamage: 16, maxDamage: 26, price: 1180, description: '민첩과 명중을 살린 원거리용 활.', bonusDex: 5, bonusAccuracy: 0.05, grade: 'rare' },
  { id: 'mace_ox_destruction', name: '황소의 파괴의 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 18, maxDamage: 36, price: 1100, description: '체력과 타격력을 함께 올리는 둔기.', bonusStr: 3, bonusCon: 3, grade: 'rare' },
  { id: 'sword_flaming_vampirism', name: '화염의 흡혈의 장검', type: 'weapon', weaponClass: 'sword', minDamage: 20, maxDamage: 30, price: 1400, description: '화염 추가 데미지와 흡혈을 겸비한 검.', bonusStr: 2, elementDamage: { '불': 5 }, lifeStealPercent: 0.08, grade: 'rare' },
  { id: 'dagger_celerity_evisceration', name: '신속의 적출의 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 12, maxDamage: 18, price: 950, description: '공격 속도와 치명타를 모두 노리는 도적용 단검.', bonusDex: 5, bonusCritChance: 0.10, grade: 'rare' },
  { id: 'staff_freezing_brilliance', name: '냉기의 광휘의 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 10, maxDamage: 18, price: 850, description: '지능과 냉기 데미지를 동시에 올리는 지팡이.', bonusInt: 4, elementDamage: { '얼음': 7 }, grade: 'rare' },
  { id: 'sword_accuracy_ruin', name: '정확의 파멸의 장검', type: 'weapon', weaponClass: 'sword', minDamage: 26, maxDamage: 36, price: 1650, description: '명중과 물리 데미지를 모두 끌어올린 장검.', bonusStr: 2, bonusAccuracy: 0.06, grade: 'rare' },
  { id: 'greatsword_giant_slayer', name: '거인 살육자의 양손검', type: 'weapon', weaponClass: 'greatsword', minDamage: 32, maxDamage: 48, price: 2200, description: '거인 종족에게 추가 데미지를 주는 인챈트가 새겨진 양손검.', bonusStr: 4, grade: 'epic' },
  { id: 'mace_undead_slayer', name: '언데드 살육자의 축복받은 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 20, maxDamage: 30, price: 980, description: '언데드에게 추가 데미지를 주는 성스러운 인챈트가 담긴 철퇴.', bonusStr: 3, grade: 'epic' },
  { id: 'sword_lightning_proc', name: '벼락 발동의 강철 장검', type: 'weapon', weaponClass: 'sword', minDamage: 17, maxDamage: 24, price: 950, description: '휘두를 때 일정 확률로 벼락이 나가는 마법이 깃든 장검.', bonusStr: 2, elementDamage: { '전기': 12 }, grade: 'epic' },
  { id: 'staff_flame_proc', name: '화염 발동의 강화 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 8, maxDamage: 14, price: 780, description: '공격 시 확률로 화염이 발동하는 지팡이.', bonusInt: 2, elementDamage: { '불': 14 }, grade: 'epic' },

  // 방어구 (기본 + 속성/옵션 조합)
  { id: 'cloth_old', name: '허름한 천 옷', type: 'armor', defense: 2, bonusDefense: 1, price: 50, description: '방어보다는 가리는 용도에 가까운 옷.', grade: 'common' },
  { id: 'robe_mystic', name: '신비로운 로브', type: 'armor', defense: 4, bonusDefense: 2, price: 350, description: '마법 저항을 높여주는 마법사 전용 로브.', bonusInt: 2, bonusSpr: 2, grade: 'normal' },
  { id: 'robe_holy', name: '성속의 로브', type: 'armor', defense: 5, bonusDefense: 3, price: 520, description: '성직자를 위한 로브. 정신(SPR)과 불/얼음 저항이 오른다.', bonusSpr: 3, elementResist: { '불': 0.05, '얼음': 0.05 }, grade: 'magic' },
  { id: 'robe_element', name: '원소 저항 로브', type: 'armor', defense: 6, bonusDefense: 3, price: 780, description: '네 가지 원소에 대한 저항이 깃든 로브.', elementResist: { '불': 0.05, '얼음': 0.05, '전기': 0.05, '독': 0.05 }, grade: 'rare' },

  { id: 'chain_newbie', name: '초보자 사슬 갑옷', type: 'armor', defense: 6, bonusDefense: 1, price: 300, description: '촘촘하게 엮인 철 고리 갑옷.', grade: 'common' },
  { id: 'chain_enhanced', name: '강화 사슬 갑옷', type: 'armor', defense: 10, bonusDefense: 3, price: 650, description: '기본 방어력이 상승된 강화 사슬 갑옷.', bonusCon: 2, grade: 'normal' },
  { id: 'chain_shock_resist', name: '전기 차폐 사슬', type: 'armor', defense: 9, bonusDefense: 3, price: 720, description: '전기 충격을 흡수하는 사슬 갑옷. 경직(전기) 저항이 오른다.', elementResist: { '전기': 0.12 }, grade: 'magic' },
  { id: 'chain_plague_resist', name: '역병 방어 사슬', type: 'armor', defense: 9, bonusDefense: 3, price: 720, description: '독성 환경에서 생존하기 위해 제작된 사슬 갑옷.', elementResist: { '독': 0.12 }, grade: 'magic' },

  { id: 'plate_rusty', name: '녹슨 판금 갑옷', type: 'armor', defense: 10, bonusDefense: 2, price: 450, description: '관리가 소홀했지만 여전히 단단한 판금.', grade: 'normal' },
  { id: 'plate_knight', name: '제국 기사의 판금갑옷', type: 'armor', defense: 30, bonusDefense: 4, price: 2100, description: '전신을 완벽하게 보호하는 판금 갑옷.', grade: 'epic' },
  { id: 'plate_flame_guard', name: '화염 방호 판금', type: 'armor', defense: 18, bonusDefense: 3, price: 980, description: '불길 속에서도 버틸 수 있게 만든 판금 갑옷. 화상 저항이 크게 오른다.', elementResist: { '불': 0.15 }, grade: 'rare' },
  { id: 'plate_frost_guard', name: '빙결 방호 판금', type: 'armor', defense: 18, bonusDefense: 3, price: 980, description: '극저온 환경을 견디도록 제작된 판금 갑옷. 빙결 저항이 크게 오른다.', elementResist: { '얼음': 0.15 }, grade: 'rare' },
  { id: 'plate_radiant', name: '성광의 판금갑옷', type: 'armor', defense: 22, bonusDefense: 4, price: 1650, description: '성스러운 빛이 흐르는 판금갑옷. STR·SPR이 함께 상승한다.', bonusStr: 3, bonusSpr: 3, grade: 'epic' },

  { id: 'leather_jacket', name: '가죽 자켓', type: 'armor', defense: 4, bonusDefense: 1, price: 180, description: '충격을 어느 정도 흡수해주는 가죽 자켓.', grade: 'common' },
  { id: 'leather_hunter', name: '사냥꾼 가죽 자켓', type: 'armor', defense: 5, bonusDefense: 2, price: 320, description: '활동성이 뛰어나고 내구도가 좋은 가죽 자켓.', grade: 'normal' },
  { id: 'leather_newbie', name: '초보자용 가죽갑옷', type: 'armor', defense: 5, bonusDefense: 1, price: 250, description: '막 모험을 시작한 이들을 위한 갑옷.', grade: 'common' },
  { id: 'leather_shadow', name: '섀도우 가죽 갑옷', type: 'armor', defense: 7, bonusDefense: 2, price: 550, description: '민첩한 움직임을 돕는 경량 가죽 갑옷.', bonusDex: 3, grade: 'rare' },
  { id: 'leather_evasive', name: '회피 특화 가죽 자켓', type: 'armor', defense: 6, bonusDefense: 2, price: 520, description: '얇지만 특수 처리된 가죽으로 만들어져 회피에 유리하다.', bonusDex: 3, elementResist: { '전기': 0.05, '독': 0.05 }, grade: 'magic' },
  { id: 'leather_toxic_hunter', name: '독사 사냥꾼 가죽 자켓', type: 'armor', defense: 7, bonusDefense: 2, price: 640, description: '독성 짐승을 사냥하는 이들을 위한 가죽. 독 저항이 크다.', elementResist: { '독': 0.15 }, grade: 'rare' },

  // 로브 계열 추가 — 속성·스탯 조합
  { id: 'robe_flame_ward', name: '화염 수호 로브', type: 'armor', defense: 5, bonusDefense: 2, price: 480, description: '불꽃을 막아주는 인챈트가 새겨진 로브. 화상 저항이 오른다.', elementResist: { '불': 0.12 }, bonusInt: 1, grade: 'magic' },
  { id: 'robe_frost_ward', name: '빙결 수호 로브', type: 'armor', defense: 5, bonusDefense: 2, price: 480, description: '냉기를 차단하는 마법이 깃든 로브. 빙결 저항이 오른다.', elementResist: { '얼음': 0.12 }, bonusSpr: 1, grade: 'magic' },
  { id: 'robe_volt_ward', name: '전격 수호 로브', type: 'armor', defense: 5, bonusDefense: 2, price: 480, description: '전기를 흩어내는 로브. 경직(전기) 저항이 오른다.', elementResist: { '전기': 0.12 }, bonusInt: 1, grade: 'magic' },
  { id: 'robe_venom_ward', name: '독액 수호 로브', type: 'armor', defense: 5, bonusDefense: 2, price: 480, description: '독을 걸러내는 필터가 내장된 로브. 중독 저항이 오른다.', elementResist: { '독': 0.12 }, bonusCon: 1, grade: 'magic' },
  { id: 'robe_flame_frost', name: '화염·빙결 로브', type: 'armor', defense: 6, bonusDefense: 2, price: 680, description: '불과 얼음 양쪽에 대한 저항이 깃든 로브.', elementResist: { '불': 0.08, '얼음': 0.08 }, bonusInt: 1, bonusSpr: 1, grade: 'rare' },
  { id: 'robe_volt_venom', name: '전격·독액 로브', type: 'armor', defense: 6, bonusDefense: 2, price: 680, description: '전기와 독에 대한 저항이 깃든 로브.', elementResist: { '전기': 0.08, '독': 0.08 }, bonusCon: 2, grade: 'rare' },
  { id: 'robe_tri_element', name: '삼원소 로브', type: 'armor', defense: 6, bonusDefense: 3, price: 880, description: '불·얼음·전기 저항이 골고루 깃든 로브.', elementResist: { '불': 0.06, '얼음': 0.06, '전기': 0.06 }, bonusInt: 2, bonusSpr: 1, grade: 'rare' },
  { id: 'robe_archmage', name: '대현자의 로브', type: 'armor', defense: 7, bonusDefense: 3, price: 1200, description: '고위 마법사의 상징. 네 원소 저항과 지능·정신이 올라간다.', elementResist: { '불': 0.06, '얼음': 0.06, '전기': 0.06, '독': 0.06 }, bonusInt: 3, bonusSpr: 2, grade: 'epic' },

  // 사슬 계열 추가 — 속성·스탯 조합
  { id: 'chain_flame_resist', name: '화염 차폐 사슬', type: 'armor', defense: 9, bonusDefense: 3, price: 720, description: '열을 흩어내는 특수 코팅이 된 사슬 갑옷. 화상 저항.', elementResist: { '불': 0.12 }, grade: 'magic' },
  { id: 'chain_frost_resist', name: '빙결 차폐 사슬', type: 'armor', defense: 9, bonusDefense: 3, price: 720, description: '냉기를 막는 절연층이 들어간 사슬 갑옷. 빙결 저항.', elementResist: { '얼음': 0.12 }, grade: 'magic' },
  { id: 'chain_flame_frost', name: '화염·빙결 사슬', type: 'armor', defense: 10, bonusDefense: 3, price: 920, description: '불과 얼음 양쪽에 강한 사슬 갑옷.', elementResist: { '불': 0.10, '얼음': 0.10 }, bonusCon: 1, grade: 'rare' },
  { id: 'chain_tri_resist', name: '삼속성 사슬', type: 'armor', defense: 11, bonusDefense: 3, price: 1100, description: '불·얼음·전기 저항이 깃든 중급 사슬.', elementResist: { '불': 0.07, '얼음': 0.07, '전기': 0.07 }, bonusCon: 2, grade: 'rare' },
  { id: 'chain_sentinel', name: '파수꾼의 사슬', type: 'armor', defense: 12, bonusDefense: 4, price: 1350, description: '원소와 타격을 견디는 파수꾼용 사슬. 전 속성 소폭 저항.', elementResist: { '불': 0.05, '얼음': 0.05, '전기': 0.05, '독': 0.05 }, bonusCon: 3, grade: 'epic' },

  // 판금 계열 추가 — 속성·스탯 조합
  { id: 'plate_shock_guard', name: '전격 방호 판금', type: 'armor', defense: 18, bonusDefense: 3, price: 980, description: '전기 충격을 차단하는 판금. 경직(전기) 저항이 크다.', elementResist: { '전기': 0.15 }, grade: 'rare' },
  { id: 'plate_plague_guard', name: '역병 방호 판금', type: 'armor', defense: 18, bonusDefense: 3, price: 980, description: '독성 환경을 견디는 판금. 중독 저항이 크다.', elementResist: { '독': 0.15 }, grade: 'rare' },
  { id: 'plate_flame_frost', name: '화염·빙결 판금', type: 'armor', defense: 19, bonusDefense: 3, price: 1180, description: '불과 얼음을 동시에 막아내는 판금.', elementResist: { '불': 0.10, '얼음': 0.10 }, bonusStr: 1, grade: 'rare' },
  { id: 'plate_volt_plague', name: '전격·역병 판금', type: 'armor', defense: 19, bonusDefense: 3, price: 1180, description: '전기와 독에 강한 판금.', elementResist: { '전기': 0.10, '독': 0.10 }, bonusCon: 2, grade: 'rare' },
  { id: 'plate_tri_guard', name: '삼속성 방호 판금', type: 'armor', defense: 20, bonusDefense: 4, price: 1450, description: '불·얼음·전기 저항이 깃든 상급 판금.', elementResist: { '불': 0.08, '얼음': 0.08, '전기': 0.08 }, bonusStr: 2, bonusCon: 1, grade: 'epic' },
  { id: 'plate_elemental_lord', name: '원소군주의 판금', type: 'armor', defense: 24, bonusDefense: 4, price: 1850, description: '네 가지 원소에 대한 저항과 힘·체력이 올라가는 최상급 판금.', elementResist: { '불': 0.06, '얼음': 0.06, '전기': 0.06, '독': 0.06 }, bonusStr: 3, bonusCon: 2, grade: 'epic' },

  // 가죽 계열 추가 — 속성·스탯 조합
  { id: 'leather_flame_skin', name: '화염가죽 자켓', type: 'armor', defense: 6, bonusDefense: 2, price: 560, description: '불에 강한 처리된 가죽. 화상 저항과 민첩.', elementResist: { '불': 0.10 }, bonusDex: 2, grade: 'magic' },
  { id: 'leather_frost_skin', name: '빙결가죽 자켓', type: 'armor', defense: 6, bonusDefense: 2, price: 560, description: '냉기에 강한 가죽. 빙결 저항과 민첩.', elementResist: { '얼음': 0.10 }, bonusDex: 2, grade: 'magic' },
  { id: 'leather_volt_skin', name: '전격가죽 자켓', type: 'armor', defense: 6, bonusDefense: 2, price: 560, description: '전기를 흩어내는 가죽. 경직 저항과 민첩.', elementResist: { '전기': 0.10 }, bonusDex: 2, grade: 'magic' },
  { id: 'leather_flame_frost', name: '화염·빙결 가죽 자켓', type: 'armor', defense: 7, bonusDefense: 2, price: 760, description: '불과 얼음에 강한 가죽. 도적·로그용.', elementResist: { '불': 0.08, '얼음': 0.08 }, bonusDex: 3, grade: 'rare' },
  { id: 'leather_tri_skin', name: '삼원소 가죽 자켓', type: 'armor', defense: 8, bonusDefense: 2, price: 940, description: '불·얼음·독 저항이 깃든 가죽. 생존과 민첩.', elementResist: { '불': 0.06, '얼음': 0.06, '독': 0.06 }, bonusDex: 3, bonusCon: 1, grade: 'rare' },
  { id: 'leather_stalker', name: '추적자의 가죽 자켓', type: 'armor', defense: 9, bonusDefense: 3, price: 1150, description: '네 원소에 대한 소폭 저항과 민첩이 크게 오른다. 로그/도적 상급.', elementResist: { '불': 0.05, '얼음': 0.05, '전기': 0.05, '독': 0.05 }, bonusDex: 4, grade: 'epic' },

  // 옵션 조합 갑옷 — 속성 + 스탯 + 치명/명중
  { id: 'robe_flame_int_spr', name: '화염·지성 로브', type: 'armor', defense: 5, bonusDefense: 2, price: 580, description: '화염 저항과 지능·정신이 함께 오른 로브.', elementResist: { '불': 0.10 }, bonusInt: 2, bonusSpr: 1, grade: 'magic' },
  { id: 'robe_frost_spr_con', name: '빙결·정신 체력 로브', type: 'armor', defense: 5, bonusDefense: 2, price: 580, description: '빙결 저항과 정신·체력이 함께 오른 로브.', elementResist: { '얼음': 0.10 }, bonusSpr: 2, bonusCon: 1, grade: 'magic' },
  { id: 'robe_volt_int', name: '전격·지능 로브', type: 'armor', defense: 5, bonusDefense: 2, price: 560, description: '전기 저항과 지능이 오른 로브.', elementResist: { '전기': 0.10 }, bonusInt: 2, grade: 'magic' },
  { id: 'robe_venom_con_spr', name: '독액·체력 정신 로브', type: 'armor', defense: 5, bonusDefense: 2, price: 590, description: '독 저항과 체력·정신이 오른 로브.', elementResist: { '독': 0.10 }, bonusCon: 1, bonusSpr: 2, grade: 'magic' },
  { id: 'robe_dual_caster', name: '캐스터의 이원 로브', type: 'armor', defense: 6, bonusDefense: 3, price: 820, description: '불·얼음 저항과 지능·정신이 함께 오른다.', elementResist: { '불': 0.07, '얼음': 0.07 }, bonusInt: 2, bonusSpr: 2, grade: 'rare' },
  { id: 'robe_crit_mind', name: '치명·마력 로브', type: 'armor', defense: 6, bonusDefense: 2, price: 780, description: '치명타 확률과 지능·정신이 오른 로브.', bonusCritChance: 0.04, bonusInt: 1, bonusSpr: 1, grade: 'rare' },
  { id: 'robe_tri_caster', name: '삼원소·캐스터 로브', type: 'armor', defense: 6, bonusDefense: 3, price: 980, description: '불·얼음·전기 저항과 INT·SPR이 올라간다.', elementResist: { '불': 0.06, '얼음': 0.06, '전기': 0.06 }, bonusInt: 2, bonusSpr: 2, grade: 'rare' },
  { id: 'robe_archmage_crit', name: '대현자·치명 로브', type: 'armor', defense: 7, bonusDefense: 3, price: 1380, description: '네 원소 저항 + 지능·정신 + 치명타. 마법사 최상급.', elementResist: { '불': 0.05, '얼음': 0.05, '전기': 0.05, '독': 0.05 }, bonusInt: 3, bonusSpr: 2, bonusCritChance: 0.05, grade: 'epic' },

  { id: 'chain_str_con', name: '힘·체력 사슬', type: 'armor', defense: 10, bonusDefense: 3, price: 750, description: '힘과 체력이 함께 오른 사슬 갑옷.', bonusStr: 2, bonusCon: 2, grade: 'magic' },
  { id: 'chain_flame_str', name: '화염·힘 사슬', type: 'armor', defense: 9, bonusDefense: 3, price: 800, description: '화염 저항과 힘이 오른 사슬.', elementResist: { '불': 0.10 }, bonusStr: 2, grade: 'magic' },
  { id: 'chain_frost_con', name: '빙결·체력 사슬', type: 'armor', defense: 9, bonusDefense: 3, price: 800, description: '빙결 저항과 체력이 오른 사슬.', elementResist: { '얼음': 0.10 }, bonusCon: 2, grade: 'magic' },
  { id: 'chain_dual_str_con', name: '화염·빙결·힘체 사슬', type: 'armor', defense: 11, bonusDefense: 3, price: 1050, description: '불·얼음 저항과 힘·체력이 함께 오른다.', elementResist: { '불': 0.08, '얼음': 0.08 }, bonusStr: 2, bonusCon: 2, grade: 'rare' },
  { id: 'chain_sentinel_spr', name: '파수꾼·정신 사슬', type: 'armor', defense: 12, bonusDefense: 4, price: 1480, description: '전 속성 저항 + 체력·정신. 성직자 탱커용.', elementResist: { '불': 0.05, '얼음': 0.05, '전기': 0.05, '독': 0.05 }, bonusCon: 3, bonusSpr: 2, grade: 'epic' },

  { id: 'plate_str_con', name: '힘·체력 판금', type: 'armor', defense: 17, bonusDefense: 3, price: 920, description: '힘과 체력이 함께 오른 판금.', bonusStr: 3, bonusCon: 2, grade: 'rare' },
  { id: 'plate_flame_str', name: '화염·힘 판금', type: 'armor', defense: 18, bonusDefense: 3, price: 1050, description: '화염 저항과 힘이 크게 오른 판금.', elementResist: { '불': 0.12 }, bonusStr: 2, grade: 'rare' },
  { id: 'plate_frost_con', name: '빙결·체력 판금', type: 'armor', defense: 18, bonusDefense: 3, price: 1050, description: '빙결 저항과 체력이 오른 판금.', elementResist: { '얼음': 0.12 }, bonusCon: 3, grade: 'rare' },
  { id: 'plate_dual_str_con', name: '화염·빙결·힘체 판금', type: 'armor', defense: 20, bonusDefense: 4, price: 1320, description: '불·얼음 저항과 힘·체력이 함께 오른다.', elementResist: { '불': 0.09, '얼음': 0.09 }, bonusStr: 2, bonusCon: 2, grade: 'epic' },
  { id: 'plate_tri_str_con', name: '삼속성·힘체 판금', type: 'armor', defense: 21, bonusDefense: 4, price: 1580, description: '불·얼음·전기 저항과 힘·체력이 올라간다.', elementResist: { '불': 0.07, '얼음': 0.07, '전기': 0.07 }, bonusStr: 3, bonusCon: 2, grade: 'epic' },
  { id: 'plate_radiant_con', name: '성광·체력 판금', type: 'armor', defense: 23, bonusDefense: 4, price: 1780, description: '성광의 판금에 체력까지 더한 성기사용.', bonusStr: 3, bonusSpr: 2, bonusCon: 2, grade: 'epic' },

  { id: 'leather_dex_con', name: '민첩·체력 가죽 자켓', type: 'armor', defense: 6, bonusDefense: 2, price: 540, description: '민첩과 체력이 함께 오른 가죽.', bonusDex: 2, bonusCon: 2, grade: 'magic' },
  { id: 'leather_flame_dex', name: '화염·민첩 가죽 자켓', type: 'armor', defense: 6, bonusDefense: 2, price: 620, description: '화염 저항과 민첩이 오른 가죽.', elementResist: { '불': 0.08 }, bonusDex: 3, grade: 'magic' },
  { id: 'leather_volt_dex', name: '전격·민첩 가죽 자켓', type: 'armor', defense: 6, bonusDefense: 2, price: 620, description: '전기 저항과 민첩이 오른 가죽.', elementResist: { '전기': 0.08 }, bonusDex: 3, grade: 'magic' },
  { id: 'leather_venom_dex', name: '독액·민첩 가죽 자켓', type: 'armor', defense: 6, bonusDefense: 2, price: 630, description: '독 저항과 민첩이 오른 가죽.', elementResist: { '독': 0.08 }, bonusDex: 3, grade: 'magic' },
  { id: 'leather_dual_dex_con', name: '화염·빙결·민체 가죽 자켓', type: 'armor', defense: 7, bonusDefense: 2, price: 860, description: '불·얼음 저항과 민첩·체력이 함께 오른다.', elementResist: { '불': 0.07, '얼음': 0.07 }, bonusDex: 3, bonusCon: 1, grade: 'rare' },
  { id: 'leather_crit_dex', name: '치명·민첩 가죽 자켓', type: 'armor', defense: 7, bonusDefense: 2, price: 820, description: '치명타와 민첩이 오른 가죽. 로그/도적용.', bonusCritChance: 0.05, bonusDex: 2, grade: 'rare' },
  { id: 'leather_accuracy_dex', name: '명중·민첩 가죽 자켓', type: 'armor', defense: 7, bonusDefense: 2, price: 800, description: '명중률과 민첩이 오른 가죽. 원거리 특화.', bonusAccuracy: 0.05, bonusDex: 3, grade: 'rare' },
  { id: 'leather_stalker_crit', name: '추적자·치명 가죽 자켓', type: 'armor', defense: 9, bonusDefense: 3, price: 1280, description: '전 속성 저항 + 민첩 + 치명타. 로그/도적 최상급.', elementResist: { '불': 0.05, '얼음': 0.05, '전기': 0.05, '독': 0.05 }, bonusDex: 4, bonusCritChance: 0.05, grade: 'epic' },

  // 방패 — 방어력 + 스탯 옵션 다양화
  { id: 'shield_wood', name: '나무 소형 방패', type: 'shield', defense: 6, bonusDefense: 1, price: 200, description: '가벼운 나무 방패. 초반 방어용.', grade: 'common' },
  { id: 'shield_orc', name: '오크 문양 방패', type: 'shield', defense: 12, bonusDefense: 3, price: 500, description: '거친 문양이 새겨진 나무 방패.', grade: 'normal' },
  { id: 'shield_iron_round', name: '철제 원형 방패', type: 'shield', defense: 10, bonusDefense: 2, price: 350, description: '단단한 철로 만든 원형 방패.', grade: 'normal' },
  { id: 'shield_strength', name: '힘의 방패', type: 'shield', defense: 10, bonusDefense: 2, price: 480, description: '힘이 깃든 방패. 힘(STR)이 소폭 상승한다.', bonusStr: 2, grade: 'magic' },
  { id: 'shield_sturdy', name: '튼튼한 방패', type: 'shield', defense: 14, bonusDefense: 2, price: 520, description: '두꺼운 강철 방패. 체력(CON)이 소폭 상승한다.', bonusCon: 2, grade: 'magic' },
  { id: 'shield_paladin', name: '성기사의 방패', type: 'shield', defense: 14, bonusDefense: 2, price: 550, description: '성스러운 문양이 새겨진 방패. 정신(SPR)이 소폭 상승한다.', bonusSpr: 2, grade: 'magic' },
  { id: 'shield_swift', name: '신속의 방패', type: 'shield', defense: 12, bonusDefense: 1, price: 580, description: '가벼워 움직임이 빠른 방패. 민첩(DEX)이 소폭 상승한다.', bonusDex: 3, grade: 'magic' },
  { id: 'shield_tower', name: '강철 탑방패', type: 'shield', defense: 16, bonusDefense: 2, price: 680, description: '몸을 크게 가리는 탑형 방패. 방어력이 뛰어나다.', grade: 'rare' },
  { id: 'shield_giant', name: '거인의 방패', type: 'shield', defense: 14, bonusDefense: 2, price: 750, description: '거인의 힘이 깃든 방패. 힘(STR)이 크게 상승한다.', bonusStr: 4, grade: 'rare' },
  { id: 'shield_dragon_scale', name: '용의 비늘 방패', type: 'shield', defense: 18, bonusDefense: 2, price: 820, description: '용의 비늘이 박힌 방패. 방어력과 체력(CON)이 상승한다.', bonusCon: 3, grade: 'rare' },
  { id: 'shield_ward_magic', name: '마력 차폐 방패', type: 'shield', defense: 10, bonusDefense: 1, price: 620, description: '마법 공격을 막아주는 방패. 지능·정신이 소폭 상승한다.', bonusInt: 2, bonusSpr: 2, grade: 'rare' },
  { id: 'shield_imperial', name: '제국 기사 방패', type: 'shield', defense: 22, bonusDefense: 4, price: 1100, description: '제국 기사단의 상징. 최상급 방어력을 자랑한다.', grade: 'epic' },
  { id: 'shield_dark_iron', name: '흑철 방패', type: 'shield', defense: 20, bonusDefense: 3, price: 950, description: '흑철로 단조한 방패. 힘과 체력이 상승한다.', bonusStr: 2, bonusCon: 2, grade: 'epic' },
  { id: 'shield_holy', name: '성검의 방패', type: 'shield', defense: 18, bonusDefense: 3, price: 980, description: '성스러운 빛이 담긴 방패. 정신(SPR)이 크게 상승한다. 성직자용.', bonusSpr: 3, grade: 'epic' },
  { id: 'shield_bear', name: '곰의 방패', type: 'shield', defense: 14, bonusDefense: 2, price: 720, description: '곰의 힘이 깃든 방패. STR이 소폭, 방어력이 뛰어나다.', bonusStr: 3, grade: 'rare' },
  { id: 'shield_ox', name: '황소의 방패', type: 'shield', defense: 16, bonusDefense: 2, price: 740, description: '황소의 건강함이 담긴 방패. CON이 소폭 상승한다.', bonusCon: 3, grade: 'rare' },

  // ─── 인간형 몬스터 드랍·상점용: 무기 (속성/스탯 조합 확장) ───
  { id: 'dagger_smuggler_item', name: '밀수꾼 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 7, maxDamage: 13, price: 340, description: '밀수로베 숨겨 들고 다니기 좋은 쇠목 단검.', bonusDex: 2, grade: 'normal' },
  { id: 'bow_smuggler_hybrid', name: '밀수꾼 복합 활', type: 'weapon', weaponClass: 'bow', minDamage: 14, maxDamage: 22, price: 720, description: '접이식 보조날이 달린 복합 활. 원거리 관통에 특화.', bonusDex: 3, bonusAccuracy: 0.03, grade: 'magic' },
  { id: 'mace_street', name: '길거리 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 8, maxDamage: 18, price: 260, description: '슬럼에서 흔히 보이는 파이프 철퇴.', bonusStr: 2, grade: 'common' },
  { id: 'mace_fanatic_cult', name: '광신도 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 12, maxDamage: 22, price: 520, description: '불꽃 도장이 박힌 의식용 철퇴.', bonusStr: 2, elementDamage: { '불': 5 }, grade: 'magic' },
  { id: 'mace_bandit_boss', name: '산적의 철퇴', type: 'weapon', weaponClass: 'mace', minDamage: 14, maxDamage: 26, price: 640, description: '고속도로 산적이 애용하는 난형 철퇴.', bonusStr: 3, bonusCon: 1, grade: 'magic' },
  { id: 'axe_scrap_brigand', name: '야쟁 고철 도끼', type: 'weapon', weaponClass: 'greatsword', minDamage: 18, maxDamage: 28, price: 480, description: '고철을 모아 만든 무거운 도끼. (도끼 = 슬러시 상성)', bonusStr: 3, grade: 'normal' },
  { id: 'sword_chain_gambler', name: '체인 도박사 검', type: 'weapon', weaponClass: 'sword', minDamage: 16, maxDamage: 24, price: 780, description: '손목에 사슬이 달린 변칙 검. 치명타에 복불복 기운.', bonusStr: 2, bonusCritChance: 0.07, grade: 'magic' },
  { id: 'spear_rusty_pike', name: '녹슨 철창', type: 'weapon', weaponClass: 'sword', minDamage: 12, maxDamage: 20, price: 420, description: '날카로운 철창. 창류는 관통(피어싱)으로 처리된다.', bonusStr: 2, bonusDex: 1, grade: 'normal' },
  { id: 'whip_syndicate', name: '조직원 채찍', type: 'weapon', weaponClass: 'sword', minDamage: 10, maxDamage: 18, price: 560, description: '합금 클로가 달린 채찍. 할퀴기(슬러시) 판정.', bonusDex: 3, poisonChance: 0.15, grade: 'magic' },
  { id: 'greatsword_mercenary', name: '용병 양손검', type: 'weapon', weaponClass: 'greatsword', minDamage: 26, maxDamage: 38, price: 1180, description: '계약 용병이 들고 다니는 실전형 양손검.', bonusStr: 3, grade: 'rare' },
  { id: 'dagger_human_hunter', name: '인간 사냥꾼 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 14, maxDamage: 22, price: 920, description: '현상금 대상을 끝내기 위한 차가운 단검.', bonusDex: 3, bonusCritChance: 0.08, grade: 'rare' },
  { id: 'bow_poison_needle', name: '독침 활', type: 'weapon', weaponClass: 'bow', minDamage: 15, maxDamage: 24, price: 860, description: '화살 끝에 독침이 박힌 활.', bonusDex: 3, poisonChance: 0.22, grade: 'rare' },
  { id: 'staff_fire_ice_twin', name: '냉염 이원 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 9, maxDamage: 16, price: 880, description: '불과 얼음 마력을 동시에 실을 수 있는 실험 지팡이.', bonusInt: 3, elementDamage: { '불': 6, '얼음': 6 }, grade: 'rare' },
  { id: 'staff_volt_venom', name: '전격·맹독의 낡은 지팡이', type: 'weapon', weaponClass: 'staff', minDamage: 5, maxDamage: 10, price: 620, description: '번개와 독 증기가 얽인 저주받은 지팡이.', bonusInt: 2, elementDamage: { '전기': 5, '독': 5 }, grade: 'magic' },
  { id: 'sword_ash_wasteland', name: '재와 모래의 장검', type: 'weapon', weaponClass: 'sword', minDamage: 19, maxDamage: 28, price: 890, description: '황야풍 홈이 파인 장검. 화염·독 저항이 붙은 가죽과 상성 싸움에.', bonusStr: 2, elementDamage: { '불': 4 }, grade: 'magic' },
  { id: 'mace_syndicate', name: '신디케이트 둔기', type: 'weapon', weaponClass: 'mace', minDamage: 16, maxDamage: 30, price: 740, description: '갱 문양이 새겨진 중량 둔기.', bonusStr: 3, bonusCritChance: 0.04, grade: 'rare' },
  { id: 'bow_tri_element_arrow', name: '삼원 화살통 활', type: 'weapon', weaponClass: 'bow', minDamage: 18, maxDamage: 28, price: 1120, description: '화살 끝에 원소 탄이 장착 가능한 군용 활.', bonusDex: 4, elementDamage: { '불': 3, '얼음': 3, '전기': 3 }, grade: 'rare' },
  { id: 'dagger_riot_shank', name: '폭동용 쇠파이프 단검', type: 'weapon', weaponClass: 'dagger', minDamage: 6, maxDamage: 11, price: 200, description: '파이프를 깎아 만든 즉흥 단검.', bonusStr: 1, bonusDex: 1, grade: 'common' },
  { id: 'greatsword_corpo', name: '기업 처단대 양손검', type: 'weapon', weaponClass: 'greatsword', minDamage: 30, maxDamage: 44, price: 1680, description: '메가코프 특수부대 제식 양손검.', bonusStr: 4, bonusAccuracy: 0.04, grade: 'epic' },

  // ─── 방어구: 인간형 테마 + 속성 조합 추가 ───
  { id: 'cloth_hood_thief_drop', name: '도적 두건 천 옷', type: 'armor', defense: 3, bonusDefense: 1, price: 120, description: '얼굴을 가리는 두건이 달린 허름한 천 튜닉.', bonusDex: 2, grade: 'common' },
  { id: 'cloth_lightning_cape', name: '번개 망토 천 로브', type: 'armor', defense: 4, bonusDefense: 2, price: 560, description: '도체 실이 짜인 망토. 전격 저항.', bonusInt: 1, elementResist: { '전기': 0.11 }, grade: 'magic' },
  { id: 'cloth_refugee_patch', name: '피난민 누더기 천 옷', type: 'armor', defense: 2, bonusDefense: 1, price: 80, description: '천 조각을 덧댄 옷. 체력보다 생존.', bonusCon: 1, grade: 'common' },
  { id: 'leather_highway_bandit', name: '고속도로 산적 가죽 갑옷', type: 'armor', defense: 8, bonusDefense: 2, price: 680, description: '도로 표식이 각인된 두꺼운 가죽.', bonusStr: 1, bonusDex: 2, elementResist: { '불': 0.06 }, grade: 'magic' },
  { id: 'leather_smuggler_run', name: '밀수꾼 경량 가죽 자켓', type: 'armor', defense: 7, bonusDefense: 2, price: 620, description: '짐을 지고 달리기 좋게 만든 가죽 재킷.', bonusDex: 3, bonusAccuracy: 0.04, grade: 'magic' },
  { id: 'leather_syndicate', name: '신디케이트 가죽 코트', type: 'armor', defense: 9, bonusDefense: 3, price: 980, description: '조직원이 즐겨 입는 검은 코트. 독·전기 소폭 저항.', elementResist: { '독': 0.08, '전기': 0.06 }, bonusDex: 3, grade: 'rare' },
  { id: 'chain_night_watch', name: '야간 파수 사슬 경갑', type: 'armor', defense: 11, bonusDefense: 3, price: 820, description: '야간 순찰대용 경량 사슬. 얼음·독 저항.', elementResist: { '얼음': 0.08, '독': 0.07 }, bonusCon: 2, grade: 'rare' },
  { id: 'chain_wasteland_raider', name: '황야 약탈단 사슬', type: 'armor', defense: 12, bonusDefense: 3, price: 950, description: '사막풍 스파이크가 박힌 사슬 갑옷.', bonusStr: 2, elementResist: { '불': 0.09, '전기': 0.05 }, grade: 'rare' },
  { id: 'chain_corpo_riot', name: '기업 진압 사슬', type: 'armor', defense: 13, bonusDefense: 4, price: 1180, description: '진압용 사슬·판금 복합. 전기·독에 강조.', elementResist: { '전기': 0.10, '독': 0.08 }, bonusCon: 2, bonusStr: 1, grade: 'epic' },
  { id: 'plate_bounty_vest', name: '현상금 사냥꾼 판금 조끼', type: 'armor', defense: 20, bonusDefense: 3, price: 1280, description: '가슴과 등에 방탄판이 박힌 조끼형 판금.', bonusDex: 2, bonusCon: 2, elementResist: { '독': 0.10 }, grade: 'rare' },
  { id: 'plate_warlord', name: '무법자 부대장 판금', type: 'armor', defense: 24, bonusDefense: 4, price: 1680, description: '군벌 장교가 찾던 중판금. 불·얼음 저항.', bonusStr: 3, bonusCon: 2, elementResist: { '불': 0.08, '얼음': 0.08 }, grade: 'epic' },
  { id: 'plate_syndicate_heavy', name: '갱 중판금', type: 'armor', defense: 22, bonusDefense: 3, price: 1420, description: '조직 로고가 음각된 무거운 판금.', bonusStr: 2, elementResist: { '불': 0.07, '전기': 0.07, '독': 0.06 }, grade: 'epic' },
  { id: 'robe_smoke_cloth', name: '연막 천 로브', type: 'armor', defense: 4, bonusDefense: 2, price: 440, description: '연막 속 시야를 돕는 얇은 천. 독 저항.', bonusInt: 1, elementResist: { '독': 0.10 }, grade: 'magic' },
  { id: 'robe_blood_oath', name: '혈맹 천 의복', type: 'armor', defense: 5, bonusDefense: 2, price: 600, description: '의식용 붉은 천. 화염·독 저항.', bonusSpr: 2, elementResist: { '불': 0.07, '독': 0.07 }, grade: 'magic' },

  // ─── 방패: 속성 저항 × 스탯 조합 추가 ───
  { id: 'shield_element_sentinel', name: '원소 파수 방패', type: 'shield', defense: 15, bonusDefense: 3, price: 1020, description: '네 원소를 고르게 흩는 방패.', elementResist: { '불': 0.06, '얼음': 0.06, '전기': 0.06, '독': 0.06 }, bonusCon: 2, grade: 'rare' },
  { id: 'shield_flame_volt_plate', name: '화염·전격 복합 방패', type: 'shield', defense: 14, bonusDefense: 2, price: 920, description: '이중 코팅이 된 중방패.', elementResist: { '불': 0.10, '전기': 0.10 }, bonusStr: 2, grade: 'rare' },
  { id: 'shield_frost_venom', name: '빙결·독액 방패', type: 'shield', defense: 14, bonusDefense: 2, price: 910, description: '역병 지대용 실험 방패.', elementResist: { '얼음': 0.10, '독': 0.10 }, bonusSpr: 2, grade: 'rare' },
  { id: 'shield_tri_war', name: '삼속 방패', type: 'shield', defense: 16, bonusDefense: 3, price: 1150, description: '불·얼음·전기를 동시에 완화.', elementResist: { '불': 0.08, '얼음': 0.08, '전기': 0.08 }, bonusCon: 2, bonusStr: 1, grade: 'epic' },
  { id: 'shield_caster_buckler', name: '캐스터 버클러', type: 'shield', defense: 9, bonusDefense: 1, price: 680, description: '작지만 마력 반사 코팅. INT·SPR.', bonusInt: 2, bonusSpr: 2, elementResist: { '전기': 0.08 }, grade: 'magic' },
  { id: 'shield_rogue_targe', name: '도적 타지', type: 'shield', defense: 11, bonusDefense: 2, price: 720, description: '경량 원방패. 민첩과 명중.', bonusDex: 3, bonusAccuracy: 0.04, grade: 'magic' },
  { id: 'shield_bandit_scrap', name: '산적 고철 방패', type: 'shield', defense: 12, bonusDefense: 2, price: 480, description: '고철판을 이어붙인 방패.', bonusStr: 2, grade: 'normal' },
  { id: 'shield_smuggler_hide', name: '밀수꾼 가죽 방패', type: 'shield', defense: 10, bonusDefense: 2, price: 560, description: '가죽과 합금 경첩. 독 저항.', bonusDex: 2, elementResist: { '독': 0.09 }, grade: 'magic' },

  // 장신구
  { id: 'ring_steel', name: '강철의 반지', type: 'accessory', slot: 'ring', defense: 1, price: 380, description: '힘과 체력을 소폭 증가시키는 반지.', bonusStr: 2, bonusCon: 2, grade: 'normal' },
  { id: 'ring_agility', name: '민첩의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 380, description: '민첩을 크게 끌어올리는 반지.', bonusDex: 4, grade: 'normal' },
  { id: 'neck_mind', name: '마력의 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 550, description: '지능과 정신력을 강화하는 목걸이.', bonusInt: 3, bonusSpr: 3, grade: 'normal' },
  { id: 'ring_flame', name: '불의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 520, description: '불의 정기가 깃든 반지. 공격 시 화염 데미지가 추가된다.', elementDamage: { '불': 4 }, grade: 'magic' },
  { id: 'ring_frost', name: '얼음의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 520, description: '차가운 기운이 서린 반지. 공격 시 빙결 데미지가 추가된다.', elementDamage: { '얼음': 3 }, grade: 'magic' },
  { id: 'ring_volt', name: '전기의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 520, description: '번개가 잠든 반지. 공격 시 전기 데미지가 추가된다.', elementDamage: { '전기': 4 }, grade: 'magic' },
  { id: 'ring_venom', name: '독의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 520, description: '맹독이 스민 반지. 공격 시 독 데미지가 추가된다.', elementDamage: { '독': 4 }, grade: 'magic' },
  { id: 'ring_dark', name: '암흑의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 540, description: '어둠의 기운이 담긴 반지. 지능과 정신력이 소폭 상승한다.', bonusInt: 2, bonusSpr: 2, grade: 'magic' },
  { id: 'ring_burn_res', name: '화염 저항 반지', type: 'accessory', slot: 'ring', defense: 0, price: 480, description: '화상 데미지를 줄여주는 반지.', elementResist: { '불': 0.1 }, grade: 'magic' },
  { id: 'ring_freeze_res', name: '빙결 저항 반지', type: 'accessory', slot: 'ring', defense: 0, price: 480, description: '빙결 데미지를 줄여주는 반지.', elementResist: { '얼음': 0.1 }, grade: 'magic' },
  { id: 'neck_element_res', name: '원소 저항 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 720, description: '모든 속성 DoT 데미지를 소폭 줄여준다.', elementResist: { '불': 0.05, '얼음': 0.05, '전기': 0.05, '독': 0.05 }, grade: 'rare' },
  // 목걸이 — 물리·민첩·체력·치명 라인 (반지와 동등한 빌드 다양성). WHY: 상점 목록이 INT/SPR 편향이면 전사·도적이 목 슬롯 활용이 제한된다.
  { id: 'neck_bear', name: '곰의 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 420, description: '곰의 힘이 깃든 목걸이. 힘(STR)이 소폭 증가한다.', bonusStr: 3, grade: 'magic' },
  { id: 'neck_tiger', name: '호랑이의 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 420, description: '호랑이의 날쌤이 깃든 목걸이. 민첩(DEX)이 소폭 증가한다.', bonusDex: 3, grade: 'magic' },
  { id: 'neck_ox', name: '소의 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 420, description: '소의 건강함이 깃든 목걸이. 체력(CON)이 소폭 증가한다.', bonusCon: 3, grade: 'magic' },

  { id: 'ring_bear', name: '곰의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 420, description: '곰의 힘이 깃든 반지. 힘(STR)이 소폭 증가한다.', bonusStr: 3, grade: 'magic' },
  { id: 'ring_tiger', name: '호랑이의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 420, description: '호랑이의 날쌤이 깃든 반지. 민첩(DEX)이 소폭 증가한다.', bonusDex: 3, grade: 'magic' },
  { id: 'ring_ox', name: '소의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 420, description: '소의 건강함이 깃든 반지. 체력(CON)이 소폭 증가한다.', bonusCon: 3, grade: 'magic' },
  { id: 'ring_owl', name: '올빼미의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 420, description: '올빼미의 지혜가 깃든 반지. 지능(INT)이 소폭 증가한다.', bonusInt: 3, grade: 'magic' },
  { id: 'ring_sphinx', name: '스핑크스의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 420, description: '스핑크스의 신비가 깃든 반지. 정신(SPR)이 소폭 증가한다.', bonusSpr: 3, grade: 'magic' },
  { id: 'ring_sun', name: '태양의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 500, description: '태양의 열기가 막아준다. 화염(화상) 저항이 올라간다.', elementResist: { '불': 0.1 }, grade: 'magic' },
  { id: 'ring_moon', name: '달의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 500, description: '달의 차가움이 막아준다. 냉기(빙결) 저항이 올라간다.', elementResist: { '얼음': 0.1 }, grade: 'magic' },
  { id: 'ring_giants', name: '거인의 반지', type: 'accessory', slot: 'ring', defense: 1, price: 680, description: '거인의 힘이 깃든 반지. 힘(STR)을 대폭 올려준다. 전사 계열 필수.', bonusStr: 5, grade: 'rare' },
  { id: 'ring_celerity', name: '신속의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 720, description: '희귀한 신속의 힘. 민첩과 회피에 유리하다.', bonusDex: 5, grade: 'rare' },
  { id: 'ring_fate', name: '운명의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 600, description: '운명이 내려앉은 반지. 치명타 확률이 올라간다.', bonusCritChance: 0.05, grade: 'magic' },
  { id: 'ring_luck', name: '행운의 반지', type: 'accessory', slot: 'ring', defense: 0, price: 600, description: '행운이 깃든 반지. 치명타 확률이 올라간다.', bonusCritChance: 0.05, grade: 'magic' },
  { id: 'neck_giants', name: '거인의 목걸이', type: 'accessory', slot: 'necklace', defense: 1, price: 680, description: '거인의 힘이 깃든 목걸이. 힘(STR)을 대폭 올려준다. 전사 계열에 유리하다.', bonusStr: 5, grade: 'rare' },
  { id: 'neck_celerity', name: '신속의 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 720, description: '신속의 기운이 맺힌 목걸이. 민첩(DEX)을 크게 올린다.', bonusDex: 5, grade: 'rare' },
  { id: 'neck_fate', name: '운명의 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 600, description: '운명이 걸린 목걸이. 치명타 확률이 올라간다.', bonusCritChance: 0.05, grade: 'magic' },
  { id: 'neck_luck', name: '행운의 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 600, description: '행운이 깃든 목걸이. 치명타 확률이 올라간다.', bonusCritChance: 0.05, grade: 'magic' },
  { id: 'neck_transcendence', name: '초월의 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 640, description: '정신이 초월한 목걸이. 정신력(SPR)을 크게 올린다. 힐/캐스터용.', bonusSpr: 5, grade: 'rare' },
  { id: 'neck_brilliance', name: '광채의 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 640, description: '지능의 광채가 담긴 목걸이. 지능(INT)을 크게 올린다.', bonusInt: 5, grade: 'rare' },
  { id: 'neck_stars', name: '별의 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 880, description: '별의 축복. 모든 능력치가 골고루 소폭 상승하는 고급 옵션.', bonusStr: 2, bonusDex: 2, bonusCon: 2, bonusInt: 2, bonusSpr: 2, grade: 'epic' },

  { id: 'ring_bear_steel', name: '곰의 강철 반지', type: 'accessory', slot: 'ring', defense: 1, price: 520, description: '곰의 힘과 강철이 결합한 반지. STR·CON이 올라간다.', bonusStr: 4, bonusCon: 2, grade: 'rare' },
  { id: 'ring_tiger_agility', name: '호랑이의 민첩 반지', type: 'accessory', slot: 'ring', defense: 0, price: 540, description: '호랑이의 날쌤과 민첩이 겹친 반지.', bonusDex: 5, grade: 'rare' },
  { id: 'ring_ox_steel', name: '소의 강철 반지', type: 'accessory', slot: 'ring', defense: 1, price: 520, description: '소의 건강과 강철이 결합한 반지. CON·STR이 올라간다.', bonusCon: 4, bonusStr: 2, grade: 'rare' },
  { id: 'neck_bear_steel', name: '곰의 강철 목걸이', type: 'accessory', slot: 'necklace', defense: 1, price: 520, description: '곰의 힘과 강철이 결합한 목걸이. STR·CON이 올라간다.', bonusStr: 4, bonusCon: 2, grade: 'rare' },
  { id: 'neck_tiger_agility', name: '호랑이의 민첩 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 540, description: '호랑이의 날쌤이 민첩과 겹친 목걸이.', bonusDex: 5, grade: 'rare' },
  { id: 'neck_ox_steel', name: '소의 강철 목걸이', type: 'accessory', slot: 'necklace', defense: 1, price: 520, description: '소의 건강과 강철이 결합한 목걸이. CON·STR이 올라간다.', bonusCon: 4, bonusStr: 2, grade: 'rare' },
  { id: 'neck_owl_mind', name: '올빼미의 마력 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 620, description: '올빼미의 지혜와 마력이 담긴 목걸이. INT·SPR 상승.', bonusInt: 4, bonusSpr: 2, grade: 'rare' },
  { id: 'neck_sphinx_mind', name: '스핑크스의 마력 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 620, description: '스핑크스의 신비와 마력이 담긴 목걸이. SPR·INT 상승.', bonusSpr: 4, bonusInt: 2, grade: 'rare' },
  { id: 'ring_sun_flame', name: '태양의 화염 반지', type: 'accessory', slot: 'ring', defense: 0, price: 580, description: '태양과 화염이 겹친 반지. 화염 저항과 화염 데미지 보너스.', elementResist: { '불': 0.08 }, elementDamage: { '불': 2 }, grade: 'rare' },
  { id: 'ring_moon_frost', name: '달의 빙결 반지', type: 'accessory', slot: 'ring', defense: 0, price: 580, description: '달과 냉기가 겹친 반지. 빙결 저항과 냉기 데미지 보너스.', elementResist: { '얼음': 0.08 }, elementDamage: { '얼음': 2 }, grade: 'rare' },
  { id: 'ring_giants_steel', name: '거인의 강철 반지', type: 'accessory', slot: 'ring', defense: 2, price: 780, description: '거인의 힘과 강철이 결합한 반지. 전사용 최상급 STR.', bonusStr: 6, bonusCon: 1, grade: 'rare' },
  { id: 'ring_celerity_agility', name: '신속의 민첩 반지', type: 'accessory', slot: 'ring', defense: 0, price: 800, description: '신속과 민첩이 겹친 희귀 반지. DEX 대폭 상승.', bonusDex: 6, grade: 'rare' },
  { id: 'ring_fate_steel', name: '운명의 강철 반지', type: 'accessory', slot: 'ring', defense: 1, price: 680, description: '운명이 강철에 새겨진 반지. 치명타와 힘·체력 보너스.', bonusCritChance: 0.05, bonusStr: 2, bonusCon: 1, grade: 'rare' },
  { id: 'ring_luck_agility', name: '행운의 민첩 반지', type: 'accessory', slot: 'ring', defense: 0, price: 680, description: '행운이 민첩과 겹친 반지. 치명타와 DEX 보너스.', bonusCritChance: 0.05, bonusDex: 3, grade: 'rare' },
  { id: 'neck_giants_steel', name: '거인의 강철 목걸이', type: 'accessory', slot: 'necklace', defense: 2, price: 780, description: '거인의 힘과 강철이 결합한 목걸이. STR을 크게 올린다.', bonusStr: 6, bonusCon: 1, grade: 'rare' },
  { id: 'neck_celerity_agility', name: '신속의 민첩 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 800, description: '신속과 민첩이 겹친 희귀 목걸이. DEX가 크게 상승한다.', bonusDex: 6, grade: 'rare' },
  { id: 'neck_fate_steel', name: '운명의 강철 목걸이', type: 'accessory', slot: 'necklace', defense: 1, price: 680, description: '운명이 강철 고리에 새겨진 목걸이. 치명타와 STR·CON 보너스.', bonusCritChance: 0.05, bonusStr: 2, bonusCon: 1, grade: 'rare' },
  { id: 'neck_luck_agility', name: '행운의 민첩 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 680, description: '행운이 민첩과 겹친 목걸이. 치명타와 DEX 보너스.', bonusCritChance: 0.05, bonusDex: 3, grade: 'rare' },
  { id: 'neck_transcendence_mind', name: '초월의 마력 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 760, description: '초월과 마력이 담긴 목걸이. SPR·INT 모두 상승. 힐/캐스터 최상급.', bonusSpr: 5, bonusInt: 2, grade: 'rare' },
  { id: 'neck_brilliance_mind', name: '광채의 마력 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 760, description: '광채와 마력이 담긴 목걸이. INT·SPR 모두 상승.', bonusInt: 5, bonusSpr: 2, grade: 'rare' },
  { id: 'ring_stars_steel', name: '별의 강철 반지', type: 'accessory', slot: 'ring', defense: 1, price: 720, description: '별의 축복이 강철에 깃든 반지. 전능력 소폭 상승.', bonusStr: 2, bonusDex: 2, bonusCon: 2, bonusInt: 1, bonusSpr: 1, grade: 'rare' },
  { id: 'ring_bear_giants', name: '곰의 거인 반지', type: 'accessory', slot: 'ring', defense: 2, price: 920, description: '곰과 거인의 힘이 겹친 반지. STR이 크게 상승한다. 전사 필수.', bonusStr: 8, grade: 'epic' },
  { id: 'ring_tiger_celerity', name: '호랑이의 신속 반지', type: 'accessory', slot: 'ring', defense: 0, price: 940, description: '호랑이와 신속이 겹친 반지. DEX가 크게 상승한다. 도적/로그용.', bonusDex: 8, grade: 'epic' },
  { id: 'ring_ox_giants', name: '소의 거인 반지', type: 'accessory', slot: 'ring', defense: 2, price: 900, description: '소와 거인의 힘이 겹친 반지. CON·STR이 크게 상승.', bonusCon: 5, bonusStr: 4, grade: 'epic' },
  { id: 'neck_bear_giants', name: '곰의 거인 목걸이', type: 'accessory', slot: 'necklace', defense: 2, price: 920, description: '곰과 거인의 힘이 겹친 목걸이. STR이 크게 상승한다.', bonusStr: 8, grade: 'epic' },
  { id: 'neck_tiger_celerity', name: '호랑이의 신속 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 940, description: '호랑이와 신속이 겹친 목걸이. DEX가 크게 상승한다.', bonusDex: 8, grade: 'epic' },
  { id: 'neck_ox_giants', name: '소의 거인 목걸이', type: 'accessory', slot: 'necklace', defense: 2, price: 900, description: '소와 거인의 힘이 겹친 목걸이. CON·STR이 크게 상승.', bonusCon: 5, bonusStr: 4, grade: 'epic' },
  { id: 'ring_sun_luck', name: '태양의 행운 반지', type: 'accessory', slot: 'ring', defense: 0, price: 820, description: '태양과 행운이 겹친 반지. 화염 저항과 치명타 확률 상승.', elementResist: { '불': 0.1 }, bonusCritChance: 0.05, grade: 'rare' },
  { id: 'ring_moon_fate', name: '달의 운명 반지', type: 'accessory', slot: 'ring', defense: 0, price: 820, description: '달과 운명이 겹친 반지. 빙결 저항과 치명타 확률 상승.', elementResist: { '얼음': 0.1 }, bonusCritChance: 0.05, grade: 'rare' },
  { id: 'neck_fate_luck', name: '운명의 행운 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 880, description: '운명과 행운이 겹친 목걸이. 치명타 확률이 크게 상승한다.', bonusCritChance: 0.12, grade: 'epic' },
  { id: 'neck_owl_brilliance', name: '올빼미의 광채 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 860, description: '올빼미와 광채가 담긴 목걸이. INT가 크게 상승한다. 마법사용.', bonusInt: 7, grade: 'epic' },
  { id: 'neck_sphinx_transcendence', name: '스핑크스의 초월 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 860, description: '스핑크스와 초월이 담긴 목걸이. SPR이 크게 상승한다. 성직자/힐러용.', bonusSpr: 7, grade: 'epic' },
  { id: 'neck_stars_mind', name: '별의 마력 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 980, description: '별과 마력이 담긴 고급 목걸이. 전능력과 지능·정신이 골고루 상승.', bonusStr: 2, bonusDex: 2, bonusCon: 2, bonusInt: 4, bonusSpr: 4, grade: 'epic' },
  { id: 'ring_flame_giants', name: '불의 거인 반지', type: 'accessory', slot: 'ring', defense: 0, price: 850, description: '불의 정기와 거인의 힘이 겹친 반지. 화염 추가 데미지와 STR.', elementDamage: { '불': 3 }, bonusStr: 4, grade: 'rare' },
  { id: 'ring_frost_celerity', name: '얼음의 신속 반지', type: 'accessory', slot: 'ring', defense: 0, price: 850, description: '얼음과 신속이 겹친 반지. 냉기 추가 데미지와 DEX.', elementDamage: { '얼음': 2 }, bonusDex: 4, grade: 'rare' },
  { id: 'ring_volt_owl', name: '전기의 올빼미 반지', type: 'accessory', slot: 'ring', defense: 0, price: 780, description: '전기와 올빼미의 지혜가 겹친 반지. 전기 데미지와 INT.', elementDamage: { '전기': 3 }, bonusInt: 3, grade: 'rare' },
  { id: 'ring_venom_tiger', name: '독의 호랑이 반지', type: 'accessory', slot: 'ring', defense: 0, price: 780, description: '독과 호랑이의 날쌤이 겹친 반지. 독 데미지와 DEX.', elementDamage: { '독': 3 }, bonusDex: 3, grade: 'rare' },
  { id: 'neck_element_stars', name: '원소의 별 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 950, description: '원소 저항과 별의 축복이 담긴 목걸이. 전속성 레지스트와 전능력.', elementResist: { '불': 0.06, '얼음': 0.06, '전기': 0.06, '독': 0.06 }, bonusStr: 1, bonusDex: 1, bonusCon: 1, bonusInt: 2, bonusSpr: 2, grade: 'epic' },
  { id: 'ring_burn_sun', name: '화염 저항 태양 반지', type: 'accessory', slot: 'ring', defense: 0, price: 620, description: '화염 저항과 태양의 힘이 겹친 반지. 화상 데미지 대폭 감소.', elementResist: { '불': 0.15 }, grade: 'rare' },
  { id: 'ring_freeze_moon', name: '빙결 저항 달 반지', type: 'accessory', slot: 'ring', defense: 0, price: 620, description: '빙결 저항과 달의 힘이 겹친 반지. 빙결 데미지 대폭 감소.', elementResist: { '얼음': 0.15 }, grade: 'rare' },
  { id: 'ring_steel_bear_giants', name: '곰의 거인 강철 반지', type: 'accessory', slot: 'ring', defense: 3, price: 1100, description: '곰·거인·강철이 하나로 겹친 희귀 반지. STR과 방어력이 크게 상승.', bonusStr: 9, bonusCon: 2, grade: 'epic' },
  { id: 'ring_agility_tiger_celerity', name: '호랑이의 신속 민첩 반지', type: 'accessory', slot: 'ring', defense: 0, price: 1120, description: '호랑이·신속·민첩이 겹친 희귀 반지. DEX가 극대화된다.', bonusDex: 10, grade: 'epic' },
  { id: 'neck_mind_owl_brilliance', name: '올빼미의 광채 마력 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 1050, description: '올빼미·광채·마력이 담긴 희귀 목걸이. INT와 SPR이 크게 상승.', bonusInt: 6, bonusSpr: 4, grade: 'epic' },
  { id: 'neck_mind_sphinx_transcendence', name: '스핑크스의 초월 마력 목걸이', type: 'accessory', slot: 'necklace', defense: 0, price: 1050, description: '스핑크스·초월·마력이 담긴 희귀 목걸이. SPR과 INT가 크게 상승.', bonusSpr: 6, bonusInt: 4, grade: 'epic' },
  { id: 'ring_fate_luck', name: '운명의 행운 반지', type: 'accessory', slot: 'ring', defense: 0, price: 880, description: '운명과 행운이 겹친 반지. 치명타 확률이 크게 상승한다.', bonusCritChance: 0.12, grade: 'epic' },
  { id: 'ring_stars_element', name: '별의 원소 반지', type: 'accessory', slot: 'ring', defense: 0, price: 920, description: '별의 축복과 원소 저항이 겹친 반지. 전능력 소폭 + 전속성 레지스트.', bonusStr: 1, bonusDex: 1, bonusCon: 1, bonusInt: 1, bonusSpr: 1, elementResist: { '불': 0.05, '얼음': 0.05, '전기': 0.05, '독': 0.05 }, grade: 'epic' },

  // ─── 베일 크립트 전용 쓰레기 베이스 — 아이언 잭 상점 비매품, 스탯 거의 없음 ───
  {
    id: 'veil_scrap_wired_club',
    name: '엉킨 와이어 곤봉',
    type: 'weapon',
    weaponClass: 'mace',
    minDamage: 1,
    maxDamage: 2,
    price: 12,
    description: '쓰레기 더미에서 건진 전선 다발. 베일 크립트 부스에서 나오는 대표적인 본전도 안 나오는 덩어리다.',
    grade: 'common',
  },
  {
    id: 'veil_scrap_cardboard',
    name: '구겨진 골판지 갑옷',
    type: 'armor',
    defense: 1,
    bonusDefense: 0,
    price: 10,
    description: '비 오면 녹는 갑옷인 척하는 골판지. 잭은 이런 건 애초에 취급하지 않는다.',
    grade: 'common',
  },
  {
    id: 'veil_scrap_lid',
    name: '깨진 쟁반 방패',
    type: 'shield',
    defense: 1,
    bonusDefense: 0,
    price: 8,
    description: '식당 쟁반이 방패인 척 홀로그램 테이프로 붙어 있다. 공격 한 번이면 더 구부러진다.',
    grade: 'common',
  },
  {
    id: 'veil_scrap_ring_blank',
    name: '각인 빈 링',
    type: 'accessory',
    slot: 'ring',
    defense: 0,
    price: 15,
    description: '아무 문양도 없는 링. 착용해도 기분만 난다.',
    grade: 'common',
  },
  {
    id: 'veil_scrap_neck_broken',
    name: '단선 네크레스',
    type: 'accessory',
    slot: 'necklace',
    defense: 0,
    price: 14,
    description: '줄이 끊겨 한쪽만 들쭉날쭉한 목걸이. 잭의 목록에 있는 목걸이들과는 차원이 다르다.',
    grade: 'common',
  },

  // 소비 아이템 (등급 없음 또는 노멀)
  { id: 'potion_red', name: '빨간 포션', type: 'consumable', price: 80, description: '체력을 30 회복합니다.', grade: 'normal' },
  { id: 'potion_blue_small', name: '작은 파란 포션', type: 'consumable', price: 100, description: '내력을 20 회복합니다.', grade: 'normal' },
  { id: 'potion_blue', name: '파란 포션', type: 'consumable', price: 180, description: '내력을 40 회복합니다.', grade: 'normal' },
  { id: 'potion_blue_large', name: '대형 파란 포션', type: 'consumable', price: 300, description: '내력을 80 회복합니다.', grade: 'normal' },
  { id: 'bandage_old', name: '낡은 붕대', type: 'consumable', price: 40, description: '지혈 부위에 감아 피를 멈춥니다.', grade: 'common' },
  { id: 'potion_usb', name: '수상한 USB 포션', type: 'consumable', price: 60, description: 'USB에 담긴 액체. 마시면 HP가 20 회복된다.', grade: 'common' },
  { id: 'potion_full', name: '풀 포션', type: 'consumable', price: 380, description: 'HP를 전부 회복하는 고급 물약.', grade: 'rare' },
  {
    id: 'scroll_appraisal',
    name: '감정 스크롤',
    type: 'consumable',
    price: 320,
    description:
      '미확인 장비 하나의 실명과 부가 옵션을 읽어내는 일회용 칩. 인벤에서 \'감정 [미확인 장비 전체 이름]\' 명령 시 1매 소모된다.',
    grade: 'normal',
  },

  // 퀘스트/관문용 키 아이템
  { id: 'key_deep_sector', name: '지하 심층 구역 키', type: 'consumable', price: 0, description: '지하 4층 끝에 있는 녹슨 철문을 여는 전자 키카드. 관문을 통과할 때만 사용된다.', grade: 'normal' },

  // 스킬북 (노멀)
  { id: 'skillbook_fireball', name: '파이어볼 스킬북', type: 'skillbook', price: 200, description: '광역 화염 마법을 익힌다.', grade: 'normal' },
  { id: 'skillbook_power', name: '파워 스트라이크 스킬북', type: 'skillbook', price: 120, description: '강타 스킬을 익힌다.', grade: 'normal' },
  { id: 'skillbook_heal_light', name: '회복의 빛 스킬북', type: 'skillbook', price: 120, description: '회복 스킬을 익힌다.', grade: 'normal' },
  { id: 'skillbook_sonic', name: '음파 폭발 스킬북', type: 'skillbook', price: 150, description: '광역 음파 스킬을 익힌다.', grade: 'normal' },
  { id: 'skillbook_cyber', name: '사이버 클로 스킬북', type: 'skillbook', price: 150, description: '3연타 스킬을 익힌다.', grade: 'normal' },
  { id: 'skillbook_shield', name: '의지의 방어막 스킬북', type: 'skillbook', price: 150, description: '방어막 스킬을 익힌다.', grade: 'normal' },
  { id: 'skillbook_datathief', name: '데이터 도둑 스킬북', type: 'skillbook', price: 120, description: 'DEF 감소 스킬을 익힌다.', grade: 'normal' },
];

/** 베일 크립트 블라인드 전용 쓰레기 베이스 id (아이언 잭 비매품) */
export const VEIL_SCRAP_ITEM_IDS: readonly string[] = [
  'veil_scrap_wired_club',
  'veil_scrap_cardboard',
  'veil_scrap_lid',
  'veil_scrap_ring_blank',
  'veil_scrap_neck_broken',
];

export function getItemByName(name: string): ItemData | undefined {
  return ITEM_LIST.find(item => item.name === name);
}

export function getItemById(id: string): ItemData | undefined {
  return ITEM_LIST.find((item) => item.id === id);
}

/** 상점 구매가 (테이블 price × 월드 경제 배율) */
export function getScaledShopBuyPrice(item: Pick<ItemData, 'price'>): number | undefined {
  if (item.price == null || item.price <= 0) return undefined;
  return scaleCoinCost(item.price);
}

/** 전투 드랍 등에서 「미확인」으로 바꿀 수 있는 장비인지 */
export function isEquippableForMystery(def: ItemData): boolean {
  return def.type === 'weapon' || def.type === 'armor' || def.type === 'shield' || def.type === 'accessory';
}

/** 미확인 아이템 표시명의 접두 카테고리 (무기/갑옷/…) */
export function getMysteryCategoryLabel(def: ItemData): string {
  switch (def.type) {
    case 'weapon':
      return '미확인 무기';
    case 'armor':
      return '미확인 갑옷';
    case 'shield':
      return '미확인 방패';
    case 'accessory':
      return def.slot === 'necklace' ? '미확인 목걸이' : '미확인 반지';
    default:
      return '미확인 장비';
  }
}

function mergeElementPartials(
  a: Partial<Record<ElementType, number>> | undefined,
  b: Partial<Record<ElementType, number>> | undefined
): Partial<Record<ElementType, number>> | undefined {
  if (!a && !b) return undefined;
  const out: Partial<Record<ElementType, number>> = { ...(a || {}) };
  if (b) {
    for (const [k, v] of Object.entries(b)) {
      if (v == null || Number.isNaN(v)) continue;
      const key = k as ElementType;
      out[key] = (out[key] ?? 0) + v;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** 베이스 장비 + 감정으로 붙은 부가 옵션을 하나의 ItemData로 합산 (전투·UI 공통) */
export function mergeItemDataWithAffixes(base: ItemData, affixLines: RolledAffixLine[]): ItemData {
  let merged: ItemData = { ...base };
  for (const line of affixLines) {
    const m = line.mods;
    if (m.bonusStr) merged.bonusStr = (merged.bonusStr ?? 0) + m.bonusStr;
    if (m.bonusDex) merged.bonusDex = (merged.bonusDex ?? 0) + m.bonusDex;
    if (m.bonusCon) merged.bonusCon = (merged.bonusCon ?? 0) + m.bonusCon;
    if (m.bonusInt) merged.bonusInt = (merged.bonusInt ?? 0) + m.bonusInt;
    if (m.bonusSpr) merged.bonusSpr = (merged.bonusSpr ?? 0) + m.bonusSpr;
    if (m.bonusDefense) merged.bonusDefense = (merged.bonusDefense ?? 0) + m.bonusDefense;
    if (m.lifeStealPercent) merged.lifeStealPercent = (merged.lifeStealPercent ?? 0) + m.lifeStealPercent;
    if (m.poisonChance) merged.poisonChance = (merged.poisonChance ?? 0) + m.poisonChance;
    if (m.bonusCritChance) merged.bonusCritChance = (merged.bonusCritChance ?? 0) + m.bonusCritChance;
    if (m.bonusAccuracy) merged.bonusAccuracy = (merged.bonusAccuracy ?? 0) + m.bonusAccuracy;
    const ed = mergeElementPartials(merged.elementDamage, m.elementDamage);
    if (ed) merged.elementDamage = ed;
    const er = mergeElementPartials(merged.elementResist, m.elementResist);
    if (er) merged.elementResist = er;
    if (m.grantsManaShield) merged.grantsManaShield = true;
  }
  return merged;
}

// ── 장비 인스턴스 레벨 (동일 이름이라도 획득 시 롤 → 무기 피해·방어구 방어 등 배율) ──

/** 인스턴스 레벨 상한 — 과도한 수치 폭주 방지 */
export const ITEM_INSTANCE_LEVEL_MIN = 1;
export const ITEM_INSTANCE_LEVEL_MAX = 55;

export function clampItemInstanceLevel(n: number): number {
  if (!Number.isFinite(n)) return ITEM_INSTANCE_LEVEL_MIN;
  return Math.max(ITEM_INSTANCE_LEVEL_MIN, Math.min(ITEM_INSTANCE_LEVEL_MAX, Math.floor(n)));
}

/**
 * 드랍·구매 시 인스턴스 레벨 롤.
 * WHY: 플레이어 레벨 근처에서 좁은 구간을 쓰면 구간 밖 아이템과 체감 차이가 난다.
 */
export function rollItemLevelForDrop(playerLevel: number, rng: () => number): number {
  const pl = clampItemInstanceLevel(Math.max(1, Math.floor(playerLevel)));
  const span = 3 + Math.floor(pl / 10);
  const minLv = Math.max(ITEM_INSTANCE_LEVEL_MIN, pl - span);
  const maxLv = Math.min(ITEM_INSTANCE_LEVEL_MAX, pl + 2 + Math.floor(span / 2));
  return minLv + Math.floor(rng() * (maxLv - minLv + 1));
}

/** 미지정(구세이브)은 배율 1.0 유지 */
export function getItemInstanceLevelMultiplier(level: number | undefined): number {
  if (level == null || !Number.isFinite(level)) return 1;
  const lv = clampItemInstanceLevel(level);
  return 1 + (lv - 1) * 0.02;
}

/** 무기·방어구·방패(및 방어 수치가 있는 악세)에만 인스턴스 레벨 부여 */
export function itemSupportsInstanceLevel(def: ItemData | null | undefined): boolean {
  if (!def) return false;
  if (def.type === 'weapon' || def.type === 'armor' || def.type === 'shield') return true;
  if (def.type === 'accessory' && (def.slot === 'ring' || def.slot === 'necklace')) return true;
  return false;
}

/**
 * 감정 합산 직후 결과에 인스턴스 레벨 배율 적용 (강화 플러스는 별도 — 여기서는 베이스+각인만 스케일).
 */
export function applyItemInstanceLevelToMergedItem(data: ItemData, level: number | undefined): ItemData {
  const m = getItemInstanceLevelMultiplier(level);
  if (m === 1) return data;
  const out: ItemData = { ...data };
  if (out.type === 'weapon' && out.minDamage != null && out.maxDamage != null) {
    const mn = Math.max(1, Math.round(out.minDamage * m));
    const mx = Math.max(mn, Math.round(out.maxDamage * m));
    out.minDamage = mn;
    out.maxDamage = mx;
  }
  if (out.type === 'armor' || out.type === 'shield') {
    if (out.defense != null) out.defense = Math.max(0, Math.round(out.defense * m));
    if (out.bonusDefense != null) out.bonusDefense = Math.round(out.bonusDefense * m);
  }
  if (out.type === 'accessory' && (out.slot === 'ring' || out.slot === 'necklace')) {
    if (out.defense != null && out.defense > 0) out.defense = Math.max(0, Math.round(out.defense * m));
    if (out.bonusDefense != null && out.bonusDefense > 0) {
      out.bonusDefense = Math.max(0, Math.round(out.bonusDefense * m));
    }
  }
  return out;
}
