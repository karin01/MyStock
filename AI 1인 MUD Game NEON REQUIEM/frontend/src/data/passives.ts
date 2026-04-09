// 패시브 스킬 정의
// WHY: 구매/퀘스트로 습득 후 항상 적용되는 수동 발동 없는 효과.
// 레지스트는 구매할 때마다 레벨 업그레이드 방식 (레벨당 5%p, 최대 25%).

import type { ElementType } from './elemental';

/** 레지스트 패시브: 구매 시 1레벨씩 증가, 레벨당 이 수치만큼 데미지 감소 (0.05 = 5%p) */
export const RESIST_PER_LEVEL = 0.05;
/** 레지스트 최대 레벨 (최대 25% 감소) */
export const MAX_RESIST_LEVEL = 5;

/** HP/MP 회복 패시브 최대 레벨 (Lv.5 = +15 회복) */
export const REGEN_MAX_LEVEL = 5;
/** HP/MP 회복 패시브 1레벨당 회복량 (Lv.1=+3, Lv.5=+15) */
export const REGEN_PER_LEVEL = 3;
/** HP/MP 회복 패시브 기본 구매 가격 (Lv.1 습득) */
export const REGEN_BASE_PRICE = 3500;
/** HP/MP 회복 패시브 업그레이드당 추가 가격 */
export const REGEN_PRICE_PER_LEVEL = 500;

export const RESIST_PASSIVE_IDS = ['burn_resist', 'freeze_resist', 'stagger_resist', 'poison_resist'] as const;
export const REGEN_PASSIVE_IDS = ['hp_regen', 'mp_regen'] as const;

export function isResistPassive(id: string): boolean {
  return (RESIST_PASSIVE_IDS as readonly string[]).includes(id);
}

export function isRegenPassive(id: string): boolean {
  return (REGEN_PASSIVE_IDS as readonly string[]).includes(id);
}

/** HP/MP 회복 패시브의 다음 업그레이드 가격 (레벨 0 = 첫 구매 3500, 레벨 1 = 4000, ...) */
export function getRegenUpgradePrice(currentLevel: number): number {
  return currentLevel === 0 ? REGEN_BASE_PRICE : REGEN_BASE_PRICE + REGEN_PRICE_PER_LEVEL * currentLevel;
}

export interface PassiveData {
  id: string;
  name: string;
  description: string;
  /** 효과 요약 (예: '공격 시 5% 확률로 화상') */
  effectSummary: string;
  /** 구매/획득 가격 (0이면 퀘스트 등) */
  price: number;
  /** 속성 레지스트용: 해당 속성 (레벨당 감소율은 RESIST_PER_LEVEL 사용) */
  elementResist?: ElementType;
  /** 레지스트 1레벨당 감소율 (0.05 = 5%p). 레벨은 passiveLevels로 관리 */
  resistValue?: number;
}

export const PASSIVE_LIST: PassiveData[] = [
  { id: 'elemental_touch', name: '원소의 손길', description: '공격 시 5% 확률로 적에게 화상(2턴) 부여.', effectSummary: '5% 화상', price: 800 },
  { id: 'thick_skin', name: '두꺼운 가죽', description: '받는 상태 이상 지속 턴 1 감소.', effectSummary: '상태이상 -1턴', price: 600 },
  { id: 'vitality', name: '생명력 강화', description: '최대 HP +15.', effectSummary: 'HP +15', price: 1000 },
  { id: 'mana_flow', name: '마나 흐름', description: '최대 MP +10.', effectSummary: 'MP +10', price: 1000 },
  { id: 'critical_eye', name: '치명의 눈', description: '크리티컬 확률 +5%p.', effectSummary: '치명 +5%p', price: 1200 },
  // 속성 레지스트 — 구매할 때마다 1레벨 업, 레벨당 5%p 감소, 최대 Lv.5(25%)
  { id: 'burn_resist', name: '불 레지스트', description: '구매 시 5%p 감소 추가, 최대 25% (Lv.5). 화상 DoT 감소.', effectSummary: '화상 데미지 -5%p/레벨', price: 700, elementResist: '불', resistValue: 0.05 },
  { id: 'freeze_resist', name: '얼음 레지스트', description: '구매 시 5%p 감소 추가, 최대 25% (Lv.5). 빙결 DoT 감소.', effectSummary: '빙결 데미지 -5%p/레벨', price: 700, elementResist: '얼음', resistValue: 0.05 },
  { id: 'stagger_resist', name: '전기 레지스트', description: '구매 시 5%p 감소 추가, 최대 25% (Lv.5). 경직 DoT 감소.', effectSummary: '경직 데미지 -5%p/레벨', price: 700, elementResist: '전기', resistValue: 0.05 },
  { id: 'poison_resist', name: '독 레지스트', description: '구매 시 5%p 감소 추가, 최대 25% (Lv.5). 중독 DoT 감소.', effectSummary: '중독 데미지 -5%p/레벨', price: 700, elementResist: '독', resistValue: 0.05 },
  // 전 직업 공통: 상시 HP/MP 회복 (Lv.1~5 업그레이드, 최대 +15)
  { id: 'hp_regen', name: 'HP 회복', description: 'Lv.1~5 업그레이드. 전투 턴 종료·비전투 칸당 HP 회복 (Lv.1=+3, Lv.5=+15).', effectSummary: 'HP +3~+15 회복(칸당)', price: 3500 },
  { id: 'mp_regen', name: 'MP 회복', description: 'Lv.1~5 업그레이드. 전투 턴 종료·비전투 칸당 MP 회복 (Lv.1=+3, Lv.5=+15).', effectSummary: 'MP +3~+15 회복(칸당)', price: 3500 },
];

export function getPassiveById(id: string): PassiveData | undefined {
  return PASSIVE_LIST.find(p => p.id === id);
}

export function getPassiveByName(name: string): PassiveData | undefined {
  return PASSIVE_LIST.find(p => p.name === name);
}

/** passiveLevels 기준으로 속성별 레지스트 합산 (레벨당 5%p, 최대 25% per element) */
export function getElementResistances(
  _passiveIds: string[],
  passiveLevels?: Record<string, number>
): Record<ElementType, number> {
  const out: Record<ElementType, number> = { '불': 0, '얼음': 0, '전기': 0, '독': 0, '수면': 0 };
  const levels = passiveLevels ?? {};
  PASSIVE_LIST.forEach(p => {
    if (p.elementResist == null || p.resistValue == null || !isResistPassive(p.id)) return;
    const level = Math.min(MAX_RESIST_LEVEL, levels[p.id] ?? 0);
    if (level > 0) {
      const value = level * RESIST_PER_LEVEL;
      out[p.elementResist] = Math.min(0.25, (out[p.elementResist] ?? 0) + value);
    }
  });
  return out;
}
