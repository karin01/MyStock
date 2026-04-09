export type WeaponAttribute = '마법' | '피어싱' | '슬러시' | '크러시';
export type ArmorAttribute = '천' | '가죽' | '사슬' | '판금';


export function getDamageModifier(attackerWeapon: WeaponAttribute, defenderArmor: ArmorAttribute): number {
  if (attackerWeapon === '마법') return 1.3;

  switch (attackerWeapon) {
    case '피어싱': // 단검, 화살 등
      if (defenderArmor === '천') return 1.1; // 약함
      if (defenderArmor === '가죽') return 1.1; // 약함
      if (defenderArmor === '사슬') return 1.0; // 보통
      if (defenderArmor === '판금') return 0.8; // 강함 (데미지 상쇄)
      break;
    case '슬러시': // 검, 도끼 등
      if (defenderArmor === '천') return 1.1; // 약함
      if (defenderArmor === '가죽') return 1.0; // 보통
      if (defenderArmor === '사슬') return 1.0; // 보통
      if (defenderArmor === '판금') return 1.0; // 보통
      break;
    case '크러시': // 둔기, 해머 등 — 판금에 강함 (둔격으로 관통)
      if (defenderArmor === '천') return 1.2;   // 천: 약함
      if (defenderArmor === '가죽') return 0.8; // 가죽: 판금만큼은 아니지만 둔기에 유리
      if (defenderArmor === '사슬') return 1.0; // 사슬: 보통
      if (defenderArmor === '판금') return 1.5; // 판금: 크러시에 약함 (데미지 1.5배)
      break;
  }
  return 1.0;
}

/** 갑옷별 기본 회피 보정. 가죽은 기동성으로 회피 상승, 판금은 무거워서 회피 감소 */
export function getArmorDodgeChance(armor: ArmorAttribute): number {
  switch (armor) {
    case '천': return 0.05;   // 천: +5% (가벼움)
    case '가죽': return 0.12; // 가죽: +12% (회피력 업 — 가벼워서 회피 특화)
    case '사슬': return 0.02; // 사슬: +2% (중간)
    case '판금': return 0.00; // 판금: +0% (무거워서 회피력 낮음)
  }
  return 0.0;
}

/** 갑옷별 자동 방어(가드) 발동 확률. 판금은 방어 확률 높고, 가죽은 방어 확률 낮음 */
export function getArmorGuardChance(armor: ArmorAttribute): number {
  switch (armor) {
    case '천': return 0.15;   // 천: 15%
    case '가죽': return 0.08; // 가죽: 8% (방어보다 회피 특화)
    case '사슬': return 0.22; // 사슬: 22%
    case '판금': return 0.35; // 판금: 35% (방어스킬 확률 높음)
  }
  return 0.2;
}

export function getArmorSpeedText(armor: ArmorAttribute): string {
  switch (armor) {
    case '천': return '빠름';
    case '가죽': return '빠름';
    case '사슬': return '보통';
    case '판금': return '느림';
  }
  return '보통';
}
