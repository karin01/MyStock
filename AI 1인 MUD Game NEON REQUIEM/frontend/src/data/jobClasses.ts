export type WeaponAttribute = '마법' | '피어싱' | '슬러시' | '크러시';
export type ArmorAttribute = '천' | '가죽' | '사슬' | '판금';

import type { WeaponClass } from './weaponMastery';

export interface JobData {
  id: string;
  name: string; // 마법사, 성직자, 전사, 도적, 로그
  description: string;
  baseWeaponAttr: WeaponAttribute;
  baseArmorAttr: ArmorAttribute;
  startWeapon: string;
  startArmor: string;
  startSkills: string[];
  /** 캐릭터 생성 시 주어지는 무기 계열별 마스터리 레벨 (예: 도적 = 단검 1) */
  startMastery?: Partial<Record<WeaponClass, number>>;
  baseHp: number;
  baseMp: number;
  baseAtk: number;
  baseDef: number;
  baseStr: number; // 힘 (데미지 계산에 영향)
  baseDex: number; // 민첩
  baseCon: number; // 체력
  baseInt: number; // 지능
  baseSpr: number; // 정신
}

export const JOB_LIST: JobData[] = [
  {
    id: 'wizard',
    name: '마법사',
    description: '주력 무기: 지팡이 | 속성: 마법 | 주로 천 옷 착용. 마법은 방어를 무시하며 강력합니다.',
    baseWeaponAttr: '마법',
    baseArmorAttr: '천',
    startWeapon: '초보자용 지팡이',
    startArmor: '허름한 천 옷',
    startSkills: ['매직 미사일'],
    baseHp: 80, baseMp: 100, baseAtk: 20, baseDef: 2,
    // Lv1 스탯 합계 45: 지능·정신 중심 (마법)
    baseStr: 4, baseDex: 4, baseCon: 4, baseInt: 20, baseSpr: 13
  },
  {
    id: 'cleric',
    name: '성직자',
    description: '주력 무기: 둔기 | 속성: 크러시 | 방어와 회복에 능합니다.',
    baseWeaponAttr: '크러시',
    baseArmorAttr: '사슬',
    startWeapon: '초보자용 둔기',
    startArmor: '초보자 사슬 갑옷',
    startSkills: ['회복의 빛', '패링'],
    baseHp: 110, baseMp: 80, baseAtk: 14, baseDef: 6,
    // Lv1 스탯 합계 45: 체력·정신 중심 (회복/방어)
    baseStr: 8, baseDex: 4, baseCon: 14, baseInt: 8, baseSpr: 11
  },
  {
    id: 'warrior',
    name: '전사',
    description: '주력 무기: 도검 | 속성: 슬러시 | 무거운 판금으로 몸을 보호합니다.',
    baseWeaponAttr: '슬러시',
    baseArmorAttr: '판금',
    startWeapon: '초보자용 도검',
    startArmor: '녹슨 판금 갑옷',
    startSkills: ['파워 스트라이크', '패링'],
    baseHp: 130, baseMp: 40, baseAtk: 18, baseDef: 10,
    // Lv1 스탯 합계 45: 힘·체력 중심 (근접 탱커)
    baseStr: 18, baseDex: 8, baseCon: 14, baseInt: 3, baseSpr: 2
  },
  {
    id: 'thief',
    name: '도적',
    description: '주력 무기: 단검 | 속성: 피어싱 | 가죽 갑옷을 입고 빠르게 공격합니다.',
    baseWeaponAttr: '피어싱',
    baseArmorAttr: '가죽',
    startWeapon: '암살 단검',
    startArmor: '가죽 자켓',
    startMastery: { dagger: 1 }, // 단검 마스터리 기본 보유 — 단검 사용 시 경험치 누적
    startSkills: ['사이버 클로'],
    baseHp: 90, baseMp: 50, baseAtk: 16, baseDef: 4,
    // Lv1 스탯 합계 45: 민첩 중심 (단검/회피)
    baseStr: 9, baseDex: 18, baseCon: 9, baseInt: 5, baseSpr: 4
  },
  {
    id: 'rogue',
    name: '로그',
    description: '주력 무기: 활 | 속성: 피어싱 | 원거리에서 정밀하게 타격합니다.',
    baseWeaponAttr: '피어싱',
    baseArmorAttr: '가죽',
    startWeapon: '초보자용 활',
    startArmor: '사냥꾼 가죽 자켓',
    startSkills: ['음파 폭발', '패링'],
    baseHp: 95, baseMp: 60, baseAtk: 15, baseDef: 5,
    // Lv1 스탯 합계 45: 민첩·체력 (원거리/생존)
    baseStr: 5, baseDex: 20, baseCon: 11, baseInt: 5, baseSpr: 4
  }
];

// 속성 상성 데미지 배율 계산
export function getDamageModifier(attackerWeapon: WeaponAttribute, defenderArmor: ArmorAttribute): number {
  if (attackerWeapon === '마법') {
    return 1.3; // 마법은 기본적으로 강함
  }
  
  switch (attackerWeapon) {
    case '피어싱':
      if (defenderArmor === '천') return 1.5;   // 천 옷: 피어싱 약함
      if (defenderArmor === '가죽') return 1.5; // 가죽 갑옷: 피어싱 약함
      if (defenderArmor === '사슬') return 1.0; // 사슬 갑옷: 보통
      if (defenderArmor === '판금') return 0.5; // 판금 갑옷: 피어싱 강함
      break;
    case '슬러시':
      if (defenderArmor === '천') return 1.5;   // 천 옷: 슬러시 약함
      if (defenderArmor === '가죽') return 1.0; // 가죽 갑옷: 슬러시 보통
      if (defenderArmor === '사슬') return 1.0; // 사슬 갑옷: 보통
      if (defenderArmor === '판금') return 1.0; // 판금 갑옷: 보통
      break;
    case '크러시':
      if (defenderArmor === '천') return 1.5;   // 천 옷: 크러시 약함
      if (defenderArmor === '가죽') return 0.5; // 가죽 갑옷: 크러시 강함 (받는 데미지 감소)
      if (defenderArmor === '사슬') return 1.0; // 사슬 갑옷: 보통
      if (defenderArmor === '판금') return 1.5; // 판금 갑옷: 크러시 약함
      break;
  }
  return 1.0;
}
