import { type WeaponAttribute, type ArmorAttribute } from './attributes';
import type { ElementType } from './elemental';

/** 적이 받는 원소 피해 감소(양수)·취약(음수). 수면 속성은 피해저항에 쓰지 않음 */
export type EnemyElementResistKey = '불' | '얼음' | '전기' | '독';

/** 몬스터 난이도 티어 — 정의 데이터 기준 (스폰 시 ActiveEnemy에 부여) */
export type EnemyContentTier = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * 적 공격 방식 — 고저·회피 로그 연출용
 * WHY: 총·활·타워 저격·원거리 마법은 '근접'과 달리 플레이어 고지 회피 보너스를 적용하지 않는다.
 */
export type EnemyAttackPattern = 'melee' | 'ranged_ballistic' | 'ranged_magic' | 'tower_sniper';

/** 원거리 판정 (탄환·마법·고각 저격) */
export function isEnemyRangedStrike(pattern: EnemyAttackPattern | undefined): boolean {
  return (
    pattern === 'ranged_ballistic' || pattern === 'ranged_magic' || pattern === 'tower_sniper'
  );
}

/** 피격 로그에 붙는 타격 서술 */
export function describeEnemyStrike(
  enemy: { attackPattern?: EnemyAttackPattern; weaponAttr: WeaponAttribute },
  hitPart: string,
): string {
  switch (enemy.attackPattern) {
    case 'ranged_ballistic':
      return `장거리 사격(${hitPart} 명중)`;
    case 'tower_sniper':
      return `고가·원거리 저격(${hitPart} 관통)`;
    case 'ranged_magic':
      return `원거리 마법(${hitPart} 쪽 집중)`;
    default:
      return enemy.weaponAttr === '마법' ? `${hitPart} 마법 공격` : `${hitPart} 공격`;
  }
}

export interface EnemyData {
  id: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  str: number;      // 힘 (데미지 계산용)
  weaponDmg: number; // 무기 자체 데미지
  exp: number;
  imageKey: string | null;
  lootPool: string[];
  description: string;
  weaponAttr: WeaponAttribute;
  armorAttr: ArmorAttribute;
  isBoss?: boolean;
  /** 준보스 — 전투 개시 시 간헐적으로 리듬 QTE 연출 대상 */
  isMiniBoss?: boolean;
  /** 속성: 공격 시 화상/빙결/경직/중독 DoT 부여 */
  element?: ElementType;
  /** 받는 원소 피해 저항(0~0.75 권장). 미지정 시 element·갑옷으로 불 저항 등을 추론 */
  elementResist?: Partial<Record<EnemyElementResistKey, number>>;
  /** true면 공격 대신 아군 한 명에게 공격력 버프를 건다 */
  isBuffer?: boolean;
  /** 미지정 시 근접 취급 — 원거리 총/활/마법/타워 저격 연출·고저 규칙에 사용 */
  attackPattern?: EnemyAttackPattern;
}

export const ENEMY_LIST: EnemyData[] = [
  // ─────────────────────────────────────────
  // 티어 1: 잡몹 (exp 15~60)
  // ─────────────────────────────────────────
  {
    id: 'glitch_virus',
    name: '글리치 바이러스',
    hp: 30, atk: 8, def: 2, str: 5, weaponDmg: 2, exp: 35,
    imageKey: 'glitch_virus',
    lootPool: ['낡은 데이터 칩', '빨간 포션'],
    description: '디지털 기생충.',
    weaponAttr: '마법', armorAttr: '천',
    element: '독',
    elementResist: { 불: -0.12 },
  },
  {
    id: 'data_leech',
    name: '데이터 리치',
    hp: 22, atk: 6, def: 1, str: 3, weaponDmg: 1, exp: 22,
    imageKey: null,
    lootPool: ['낡은 데이터 칩'],
    description: '데이터를 빨아먹는 기생 바이러스.',
    weaponAttr: '마법', armorAttr: '천',
    element: '독',
    elementResist: { 불: -0.08 },
  },
  {
    id: 'slum_scavenger',
    name: '슬럼 약탈자',
    hp: 28, atk: 7, def: 2, str: 4, weaponDmg: 2, exp: 28,
    imageKey: null,
    lootPool: ['먹다 남은 비스킷'],
    description: '버려진 부품을 탐하는 슬럼의 야생아.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '불',
    elementResist: { 불: 0.4 },
  },
  {
    id: 'broken_drone',
    name: '고장난 수색 드론',
    hp: 38, atk: 9, def: 4, str: 5, weaponDmg: 3, exp: 42,
    imageKey: null,
    lootPool: ['구식 전자 장치', '전함 캡슐', '전기의 반지'],
    description: '필사적으로 날아다니는 무력한 드론.',
    weaponAttr: '피어싱', armorAttr: '판금',
    element: '전기',
    attackPattern: 'ranged_ballistic',
  },
  {
    id: 'rusted_bot',
    name: '녹슬어가는 저가형 봇',
    hp: 42, atk: 10, def: 6, str: 5, weaponDmg: 3, exp: 48,
    imageKey: null,
    lootPool: ['강체 단편', '쿼이솔', '빙결 저항 반지'],
    description: '누군가 창고에 버려진 구식 봇.',
    weaponAttr: '크러시', armorAttr: '판금',
    element: '얼음',
    elementResist: { 불: -0.35, 얼음: 0.25 },
  },
  {
    id: 'alley_punk',
    name: '뒷골목 펑크',
    hp: 30, atk: 8, def: 2, str: 4, weaponDmg: 2, exp: 30,
    imageKey: null,
    lootPool: ['빨간 포션'],
    description: '생계를 위해 주먹을 휘두르는 뒷골목 불량배.',
    weaponAttr: '크러시', armorAttr: '가죽',
    element: '불',
  },
  {
    id: 'sewer_rat_mutant',
    name: '하수구 돌연변이 쥐',
    hp: 25, atk: 7, def: 1, str: 3, weaponDmg: 1, exp: 25,
    imageKey: null,
    lootPool: ['독침', '독의 반지'],
    description: '하수구에서 변이한 거대한 쥐.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '독',
  },
  {
    id: 'wire_spider',
    name: '와이어 거미',
    hp: 20, atk: 9, def: 1, str: 3, weaponDmg: 3, exp: 30,
    imageKey: null,
    lootPool: ['전도체 조각'],
    description: '전선을 엮어 몸을 만든 기계 거미.',
    weaponAttr: '마법', armorAttr: '천',
    element: '전기',
  },

  // ─────────────────────────────────────────
  // 인간형: 도적·산적·무법자 (exp 낮은 순)
  // WHY: 사이버펑크 슬럼/황야에서 인간 적대 세력을 늘려 전투 다양성을 준다.
  // ─────────────────────────────────────────
  {
    id: 'slum_cutpurse',
    name: '슬럼 소매치기',
    hp: 24, atk: 7, def: 1, str: 3, weaponDmg: 2, exp: 26,
    imageKey: null,
    lootPool: ['낡은 데이터 칩', '도적 두건 천 옷'],
    description: '인간. 생계를 위해 지갑을 슬쩍하는 눈빛.',
    weaponAttr: '피어싱', armorAttr: '천',
    element: '독',
  },
  {
    id: 'tunnel_pickpocket',
    name: '터널 손버릇범',
    hp: 22, atk: 6, def: 2, str: 3, weaponDmg: 1, exp: 24,
    imageKey: null,
    lootPool: ['먹다 남은 비스킷', '길거리 철퇴'],
    description: '인간. 어둠 속에서 손이 먼저 나간다.',
    weaponAttr: '피어싱', armorAttr: '가죽',
  },
  {
    id: 'alley_street_thug',
    name: '골목 패거리',
    hp: 32, atk: 9, def: 3, str: 6, weaponDmg: 3, exp: 32,
    imageKey: null,
    lootPool: ['빨간 포션', '야쟁 고철 도끼'],
    description: '인간. 파이프와 못박힌 방망이로 위협한다.',
    weaponAttr: '크러시', armorAttr: '가죽',
    element: '불',
  },
  {
    id: 'scrap_fence',
    name: '고철 상인',
    hp: 28, atk: 8, def: 4, str: 5, weaponDmg: 2, exp: 34,
    imageKey: null,
    lootPool: ['구식 전자 장치', '밀수꾼 단검'],
    description: '인간. 불법 부품을 넘기며 싸움도 마다하지 않는다.',
    weaponAttr: '슬러시', armorAttr: '사슬',
  },
  {
    id: 'coyote_runner',
    name: '코요테 러너',
    hp: 30, atk: 10, def: 2, str: 5, weaponDmg: 3, exp: 38,
    imageKey: null,
    lootPool: ['에너지 셀', '밀수꾼 복합 활'],
    description: '인간. 밀수 루트를 지키는 질주자. 활을 쏜다.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '전기',
    attackPattern: 'ranged_ballistic',
  },
  {
    id: 'black_market_thug',
    name: '암시장 깡패',
    hp: 44, atk: 12, def: 5, str: 8, weaponDmg: 4, exp: 52,
    imageKey: null,
    lootPool: ['파란 포션', '조직원 채찍'],
    description: '인간. 암시장 출입구를 지키는 건장한 폭력배.',
    weaponAttr: '슬러시', armorAttr: '사슬',
    element: '독',
  },
  {
    id: 'riot_looter',
    name: '폭동 약탈자',
    hp: 36, atk: 11, def: 3, str: 7, weaponDmg: 3, exp: 48,
    imageKey: null,
    lootPool: ['빨간 포션', '광신도 철퇴'],
    description: '인간. 혼란을 틈타 창고를 턴다.',
    weaponAttr: '크러시', armorAttr: '천',
    element: '불',
  },
  {
    id: 'highway_bandit',
    name: '고속도로 산적',
    hp: 48, atk: 14, def: 6, str: 10, weaponDmg: 5, exp: 62,
    imageKey: null,
    lootPool: ['고속도로 산적 가죽 갑옷', '녹슨 철창'],
    description: '인간. 폐도로를 장악한 무장 강도단.',
    weaponAttr: '슬러시', armorAttr: '가죽',
  },
  {
    id: 'rail_bandido',
    name: '선로 산적',
    hp: 52, atk: 15, def: 7, str: 11, weaponDmg: 5, exp: 68,
    imageKey: null,
    lootPool: ['전도체 조각', '야간 파수 사슬 경갑'],
    description: '인간. 버려진 선로 위에서 화물을 노린다.',
    weaponAttr: '피어싱', armorAttr: '사슬',
    element: '얼음',
  },
  {
    id: 'wasteland_marauder',
    name: '황야 약탈단',
    hp: 58, atk: 16, def: 8, str: 12, weaponDmg: 6, exp: 78,
    imageKey: null,
    lootPool: ['쿼이솔', '용병 양손검'],
    description: '인간. 돔 밖 황무지를 떠도는 무장 약탈자.',
    weaponAttr: '슬러시', armorAttr: '사슬',
    element: '불',
  },
  {
    id: 'gang_enforcer',
    name: '갱 조직원',
    hp: 62, atk: 17, def: 9, str: 13, weaponDmg: 6, exp: 85,
    imageKey: null,
    lootPool: ['강체 단편', '현상금 사냥꾼 판금 조끼'],
    description: '인간. 문신과 합금 보철이 섞인 조직의 집행자.',
    weaponAttr: '크러시', armorAttr: '판금',
  },
  {
    id: 'chrome_samurai',
    name: '크롬 거리 무사',
    hp: 70, atk: 20, def: 10, str: 15, weaponDmg: 8, exp: 95,
    imageKey: null,
    lootPool: ['체인 도박사 검', '번개 망토 천 로브'],
    description: '인간. 전통 검술과 사이버 의체를 결합한 결투자.',
    weaponAttr: '슬러시', armorAttr: '판금',
    element: '전기',
  },
  {
    id: 'bounty_hunter_human',
    name: '인간 현상금 사냥꾼',
    hp: 85, atk: 22, def: 12, str: 16, weaponDmg: 9, exp: 115,
    imageKey: null,
    lootPool: ['저격용 복합 렌즈', '인간 사냥꾼 단검'],
    description: '인간. 머리에 현상금이 붙은 이를 쫓는 냉혹한 사냥꾼.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '독',
    attackPattern: 'ranged_ballistic',
  },
  {
    id: 'syndicate_assassin',
    name: '신디케이트 암살자',
    hp: 65, atk: 26, def: 8, str: 14, weaponDmg: 10, exp: 130,
    imageKey: null,
    lootPool: ['독 단검', '독침 활'],
    description: '인간. 그림자 계약으로 움직이는 프로 킬러.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '독',
    attackPattern: 'ranged_ballistic',
  },
  {
    id: 'corpo_blade_runner',
    name: '기업 처단대 요원',
    hp: 95, atk: 24, def: 16, str: 18, weaponDmg: 9, exp: 155,
    imageKey: 'corpo_blade_runner',
    lootPool: ['티타늄 장검', '제국 기사 방패'],
    description: '인간. 메가코프가 고용한 특수 제압 부대.',
    weaponAttr: '슬러시', armorAttr: '판금',
    element: '전기',
  },
  {
    id: 'cult_firebrand',
    name: '방화 광신도',
    hp: 55, atk: 18, def: 5, str: 12, weaponDmg: 5, exp: 88,
    imageKey: null,
    lootPool: ['빨간 포션', '냉염 이원 지팡이'],
    description: '인간. 홀로그램 성화를 들고 거리를 질주한다.',
    weaponAttr: '마법', armorAttr: '천',
    element: '불',
  },
  {
    id: 'smuggler_captain',
    name: '밀수 두목',
    hp: 110, atk: 28, def: 14, str: 20, weaponDmg: 11, exp: 195,
    imageKey: null,
    lootPool: ['비밀 네트워크 키', '밀수꾼 복합 활'],
    description: '인간. 루트와 총칼로 제국을 피해 다니는 보스급 밀수업자.',
    weaponAttr: '피어싱', armorAttr: '사슬',
    element: '독',
  },
  {
    id: 'warlord_lieutenant',
    name: '무법자 부대장',
    hp: 140, atk: 32, def: 18, str: 24, weaponDmg: 13, exp: 240,
    imageKey: null,
    lootPool: ['레어 크롬 코어', '원소 파수 방패'],
    description: '인간. 황무지 군벌의 오른팔. 판금과 중화기에 익숙하다.',
    weaponAttr: '크러시', armorAttr: '판금',
    element: '불',
  },

  // ─────────────────────────────────────────
  // 티어 2: 일반 (exp 60~180)
  // ─────────────────────────────────────────
  {
    id: 'support_drone',
    name: '지원 드론',
    hp: 40, atk: 6, def: 4, str: 3, weaponDmg: 2, exp: 55,
    imageKey: null,
    lootPool: ['에너지 셀', '파란 포션'],
    description: '아군 데이터를 강화하는 네트워크 지원 유닛. 직접 공격보다 버프에 특화.',
    weaponAttr: '마법', armorAttr: '천',
    isBuffer: true,
  },
  {
    id: 'wandering_hacker',
    name: '방황하는 해커',
    hp: 55, atk: 14, def: 5, str: 8, weaponDmg: 4, exp: 60,
    imageKey: 'wandering_hacker',
    lootPool: ['파란 포션', '해킹 툴'],
    description: '크롬 낙오자.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '전기',
  },
  {
    id: 'neon_gang_thug',
    name: '네온 갱 조직원',
    hp: 65, atk: 18, def: 7, str: 10, weaponDmg: 5, exp: 80,
    imageKey: null,
    lootPool: ['파란 포션', '범죄 조직 악장', '강철의 반지', '불의 반지'],
    description: '네온 조명 아래 숨어다니는 갱단들.',
    weaponAttr: '슬러시', armorAttr: '가죽',
    element: '불',
  },
  {
    id: 'tech_scavenger',
    name: '테크 스캐빈저',
    hp: 60, atk: 16, def: 6, str: 9, weaponDmg: 4, exp: 72,
    imageKey: null,
    lootPool: ['해킹 툴', '강화 합금 파편'],
    description: '고체를 해체해 부품을 훔치는 스캐빈저.',
    weaponAttr: '피어싱', armorAttr: '사슬',
    element: '얼음',
  },
  {
    id: 'rogue_android',
    name: '충격에 맞선 안드로이드',
    hp: 90, atk: 22, def: 12, str: 14, weaponDmg: 7, exp: 110,
    imageKey: 'rogue_android',
    lootPool: ['에너지 셀', '파란 포션'],
    description: '프로그래밍이 잘못된 팀 안드로이드.',
    weaponAttr: '크러시', armorAttr: '판금',
    element: '전기',
  },
  {
    id: 'gene_splicer',
    name: '유전자 스플라이서',
    hp: 75, atk: 19, def: 8, str: 11, weaponDmg: 5, exp: 95,
    imageKey: null,
    lootPool: ['독침', '돌연변이 세포', '화염 저항 반지'],
    description: '데이터망은 유전자 조작으로 자신을 강화한다.',
    weaponAttr: '마법', armorAttr: '천',
    element: '독',
  },
  {
    id: 'mutant_hound',
    name: '돌연변이 사냥개',
    hp: 80, atk: 20, def: 9, str: 12, weaponDmg: 6, exp: 100,
    imageKey: 'mutant_hound_a',
    lootPool: ['풀 포션', '돌연변이 이빨'],
    description: '창고에서 돌연변이된 거대한 사냥개.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '독',
  },
  {
    id: 'drone_hunter',
    name: '사냥기 드론',
    hp: 100, atk: 24, def: 14, str: 16, weaponDmg: 9, exp: 130,
    imageKey: null,
    lootPool: ['타격 센서', '에너지 셀'],
    description: '특정 타겟을 추적하도록 프로그래밍된 드론.',
    weaponAttr: '피어싱', armorAttr: '판금',
    element: '전기',
  },
  {
    id: 'toxic_walker',
    name: '독소 두루마기',
    hp: 70, atk: 17, def: 5, str: 9, weaponDmg: 5, exp: 85,
    imageKey: null,
    lootPool: ['독소 샘플', '방독 스프레이'],
    description: '방사능 구역에서 돌연변이한 생존자.',
    weaponAttr: '마법', armorAttr: '천',
    element: '독',
  },
  {
    id: 'electric_imp',
    name: '전자기 임프',
    hp: 55, atk: 21, def: 4, str: 8, weaponDmg: 8, exp: 90,
    imageKey: null,
    lootPool: ['전도체 조각', '이상하게 밝은 부품'],
    description: '공기 중 전자기로 떠다니는 돌연변이 조각체.',
    weaponAttr: '마법', armorAttr: '천',
    element: '전기',
    attackPattern: 'ranged_magic',
  },
  {
    id: 'chrome_thief',
    name: '크롬 도둑',
    hp: 70, atk: 18, def: 8, str: 10, weaponDmg: 5, exp: 85,
    imageKey: 'chrome_thief_a',
    lootPool: ['크롬 파편', '빨간 포션', '민첩의 반지'],
    description: '크롬 부품을 노리는 능숙한 도둑.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '얼음',
  },
  {
    id: 'gang_shooter',
    name: '조직 사수',
    hp: 75, atk: 22, def: 6, str: 11, weaponDmg: 8, exp: 100,
    imageKey: null,
    lootPool: ['파란 포션', '탄피'],
    description: '조직의 저격수 역할을 하는 갱단원.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '불',
    attackPattern: 'ranged_ballistic',
  },
  {
    id: 'neon_lane_gunner',
    name: '네온 레인 거너',
    hp: 54, atk: 16, def: 5, str: 9, weaponDmg: 6, exp: 72,
    imageKey: null,
    lootPool: ['탄피', '에너지 셀', '빨간 포션'],
    description: '복도·가판대 사이에서 카빈으로 압박 사격을 가하는 조직원.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '불',
    attackPattern: 'ranged_ballistic',
  },
  {
    id: 'ash_archer',
    name: '잿빛 활사수',
    hp: 40, atk: 12, def: 4, str: 8, weaponDmg: 5, exp: 58,
    imageKey: null,
    lootPool: ['밀수꾼 복합 활', '야간 파수 사슬 경갑'],
    description: '황무지 재초소에서 합성 활로 먼 표적을 노린다.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    attackPattern: 'ranged_ballistic',
  },
  {
    id: 'hexline_caster',
    name: '헥스라인 시전자',
    hp: 46, atk: 14, def: 3, str: 7, weaponDmg: 6, exp: 64,
    imageKey: null,
    lootPool: ['코드 파편', '마력의 목걸이'],
    description: '데이터 헥스를 원거리에서 던져 링크를 끊는 하급 마도 해커.',
    weaponAttr: '마법', armorAttr: '천',
    element: '전기',
    attackPattern: 'ranged_magic',
  },

  // ─────────────────────────────────────────
  // 티어 3: 기타 (exp 150~300)
  // ─────────────────────────────────────────
  {
    id: 'arcadia_guard',
    name: '아르카디아 경비봇',
    hp: 80, atk: 20, def: 15, str: 15, weaponDmg: 8, exp: 100,
    imageKey: 'arcadia_guard',
    lootPool: ['에너지 셀', '강화 합금 파편'],
    description: '전투 로봇. 팔뚝에서 박동총 열이 번져 나온다.',
    weaponAttr: '피어싱', armorAttr: '판금',
    element: '전기',
    attackPattern: 'ranged_ballistic',
  },
  {
    id: 'red_dragon_grunt',
    name: '레드 드래곤 조직원',
    hp: 100, atk: 25, def: 18, str: 18, weaponDmg: 10, exp: 150,
    imageKey: 'red_dragon_grunt',
    lootPool: ['크레딧 칩', '강철 단검'],
    description: '근접전의 달인.',
    weaponAttr: '슬러시', armorAttr: '사슬',
    element: '불',
  },
  {
    id: 'chrome_berserker',
    name: '크롬 버서커',
    hp: 150, atk: 35, def: 10, str: 25, weaponDmg: 15, exp: 200,
    imageKey: 'chrome_berserker',
    lootPool: ['파란 포션', '크롬 파편'],
    description: '광폭한 전사.',
    weaponAttr: '슬러시', armorAttr: '판금',
    element: '불',
  },
  {
    id: 'bio_fury_fanatic',
    name: '바이오 퓨리 광신도',
    hp: 70, atk: 22, def: 8, str: 12, weaponDmg: 6, exp: 90,
    imageKey: 'bio_fury_fanatic',
    lootPool: ['독침', '풀 포션', '지하 심층 구역 키'],
    description: '독과 분노. 지하 심층 구역으로 통하는 관문을 지키고 있다.',
    weaponAttr: '피어싱', armorAttr: '천',
    element: '독',
  },
  {
    id: 'chrome_enforcer',
    name: '크롬 집행자',
    hp: 130, atk: 30, def: 18, str: 22, weaponDmg: 12, exp: 180,
    imageKey: null,
    lootPool: ['크롬 파편', '크레딧 칩'],
    description: '전투력이 전형적으로 높은 크롬 보안 요원.',
    weaponAttr: '크러시', armorAttr: '판금',
    element: '얼음',
  },
  {
    id: 'psi_warrior',
    name: '사이킥 전사',
    hp: 110, atk: 28, def: 10, str: 18, weaponDmg: 10, exp: 160,
    imageKey: null,
    lootPool: ['심리 강화 장치', '정신력 강화 장치'],
    description: '심리 에너지로 변형된 변종체.',
    weaponAttr: '마법', armorAttr: '사슬',
    element: '전기',
    attackPattern: 'ranged_magic',
  },
  {
    id: 'spec_ops_grunt',
    name: '마레코프 특수부대',
    hp: 140, atk: 32, def: 20, str: 24, weaponDmg: 13, exp: 195,
    imageKey: 'marecorp_specops_a',
    lootPool: ['쿼이솔', '에너지 엠파크'],
    description: '상류층 수호 전담 마레코프 병사.',
    weaponAttr: '피어싱', armorAttr: '사슬',
    element: '독',
    attackPattern: 'ranged_ballistic',
  },
  {
    id: 'acid_mutant',
    name: '산성 돌연변이체',
    hp: 120, atk: 26, def: 12, str: 17, weaponDmg: 8, exp: 175,
    imageKey: null,
    lootPool: ['독소 샘플', '코어 비수'],
    description: '산성 환경에서 생존한 상위 돌연변이충.',
    weaponAttr: '마법', armorAttr: '가죽',
    element: '독',
    attackPattern: 'ranged_magic',
  },
  {
    id: 'turret_sentinel',
    name: '자동 터렛 센티넬',
    hp: 160, atk: 35, def: 25, str: 20, weaponDmg: 18, exp: 220,
    imageKey: 'auto_turret_a',
    lootPool: ['에너지 셀', '봇 코어'],
    description: '접근금지 구역 순찰 자동 방어 터렛.',
    weaponAttr: '피어싱', armorAttr: '판금',
    element: '전기',
    attackPattern: 'ranged_ballistic',
  },
  {
    id: 'holo_sentry',
    name: '홀로그램 경비대',
    hp: 105, atk: 29, def: 15, str: 19, weaponDmg: 11, exp: 170,
    imageKey: null,
    lootPool: ['홀로그램 조각', '예비 에너지 팩', '마력의 목걸이'],
    description: '확장현실 프로젝션으로 위장한 경보 시스템.',
    weaponAttr: '마법', armorAttr: '판금',
    element: '얼음',
    attackPattern: 'ranged_magic',
  },
  {
    id: 'spire_watch',
    name: '철탑 감시총수',
    hp: 88, atk: 24, def: 12, str: 14, weaponDmg: 10, exp: 142,
    imageKey: null,
    lootPool: ['저격용 복합 렌즈', '강화 합금 파편', '탄피', '에너지 셀'],
    description: '폐공장·선로 교량 등 고가 구조물에 매달려 장거리 라이플로 시야를 장악한 저격수.',
    weaponAttr: '피어싱', armorAttr: '사슬',
    element: '전기',
    attackPattern: 'tower_sniper',
  },
  {
    id: 'shadow_ninja',
    name: '디지털 닌자',
    hp: 95, atk: 33, def: 8, str: 20, weaponDmg: 14, exp: 200,
    imageKey: 'shadow_ninja',
    lootPool: ['암살 단검', '닌자 잠복 서류', '민첩의 반지', '호랑이의 민첩 반지'],
    description: '숨은 곳에서 돌진·돌입을 특화한 닌자.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '얼음',
  },

  // ─────────────────────────────────────────
  // 티어 4: 강력함 (exp 300~600)
  // ─────────────────────────────────────────
  {
    id: 'heavy_mech',
    name: '중화기 전투 메크',
    hp: 220, atk: 45, def: 35, str: 40, weaponDmg: 22, exp: 380,
    imageKey: null,
    lootPool: ['중화기 코어', '에너지 셀', '전기의 반지'],
    description: '복합식 무장을 빠른 속도로 제어하는 코어를 가진 메크.',
    weaponAttr: '크러시', armorAttr: '판금',
    element: '전기',
  },
  {
    id: 'neo_vampire',
    name: '네오 뱀파이어',
    hp: 190, atk: 40, def: 22, str: 35, weaponDmg: 20, exp: 350,
    imageKey: null,
    lootPool: ['노스페라투스 보석', '파란 포션'],
    description: '생체 에너지를 흡수해 수명 연장을 위해 진화한 사이보그.',
    weaponAttr: '마법', armorAttr: '가죽',
    element: '독',
  },
  {
    id: 'warlord_grunt',
    name: '전쟁 도법 권습자',
    hp: 200, atk: 42, def: 28, str: 38, weaponDmg: 19, exp: 360,
    imageKey: null,
    lootPool: ['사의 일은 기록', '에너지 셀'],
    description: '경쟁 조직의 요새를 지도하는 존재.',
    weaponAttr: '슬러시', armorAttr: '사슬',
    element: '불',
  },
  {
    id: 'data_wraith',
    name: '데이터스케이프 변종',
    hp: 170, atk: 43, def: 18, str: 33, weaponDmg: 21, exp: 370,
    imageKey: null,
    lootPool: ['코드 파편', '프로토콜 텔레스마', '마력의 목걸이'],
    description: '데이터망에서 탈출한 디지털 영혼.',
    weaponAttr: '마법', armorAttr: '천',
    element: '전기',
    attackPattern: 'ranged_magic',
    elementResist: { 불: -0.22, 전기: 0.18 },
  },
  {
    id: 'plasma_golem',
    name: '플라즈마 골렘',
    hp: 250, atk: 44, def: 30, str: 42, weaponDmg: 20, exp: 400,
    imageKey: null,
    lootPool: ['플라즈마 코어', '강화 합금 파편', '불의 반지', '태양의 화염 반지'],
    description: '고온의 플라즈마로 이루어진 인공 생명체.',
    weaponAttr: '마법', armorAttr: '판금',
    element: '불',
    elementResist: { 불: 0.58 },
  },
  {
    id: 'void_arcanist',
    name: '보이드 아르카네스트',
    hp: 155, atk: 38, def: 14, str: 28, weaponDmg: 18, exp: 310,
    imageKey: null,
    lootPool: ['프로토콜 텔레스마', '마력의 목걸이', '코드 파편'],
    description: '차원 균열의 여운으로 원거리에서 연속 주문을 퍼붓는 타락 시전자.',
    weaponAttr: '마법', armorAttr: '사슬',
    element: '얼음',
    attackPattern: 'ranged_magic',
  },
  {
    id: 'renegade_sniper',
    name: '배반자 저격수',
    hp: 160, atk: 50, def: 12, str: 36, weaponDmg: 28, exp: 420,
    imageKey: null,
    lootPool: ['저격용 복합 렌즈', '에너지 셀', '운명의 강철 반지'],
    description: '아군을 배신하고 현상금으로 돈을 버는 저격수.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    element: '전기',
    attackPattern: 'tower_sniper',
  },

  // ─────────────────────────────────────────
  // 티어 5: 미니보스 (exp 600~1000)
  // ─────────────────────────────────────────
  {
    id: 'mini_boss_cyborg',
    name: '⚠️ [미니 보스] 강화 사이보그',
    hp: 250, atk: 42, def: 30, str: 35, weaponDmg: 25, exp: 400,
    imageKey: null,
    lootPool: ['레어 크롬 코어', '원소 저항 목걸이', '별의 강철 반지', '공허 관통 활'],
    description: '엘리트 전투 기계.',
    weaponAttr: '마법', armorAttr: '판금',
    element: '전기',
    isMiniBoss: true,
  },
  {
    id: 'corrupt_commander',
    name: '⚠️ [미니 보스] 비리한 지휘관',
    hp: 300, atk: 48, def: 35, str: 45, weaponDmg: 27, exp: 600,
    imageKey: null,
    lootPool: ['지휘관의 인장', '비밀 네트워크 키', '얼음의 반지', '공허 관통 활'],
    description: '폭동과 배신으로 사령부를 잡은 전 마레코프 지휘관.',
    weaponAttr: '피어싱', armorAttr: '사슬', isBoss: true,
    element: '독',
    isMiniBoss: true,
  },
  {
    id: 'neo_leviathan',
    name: '⚠️ [미니 보스] 네오 리바이어던',
    hp: 320, atk: 52, def: 28, str: 58, weaponDmg: 35, exp: 750,
    imageKey: 'neo_leviathan',
    lootPool: ['리바이어던 코어', '증강제', '공허 코어 지팡이'],
    description: '변종된 생체 괴물, 지하 세계의 주인.',
    weaponAttr: '슬러시', armorAttr: '사슬', isBoss: true,
    element: '독',
    isMiniBoss: true,
  },

  // ─────────────────────────────────────────
  // 티어 6: 최종 보스 (exp 800+)
  // ─────────────────────────────────────────
  {
    id: 'arcadia_gatekeeper',
    name: '사이버 데몬 (관문 보스)',
    hp: 400, atk: 55, def: 40, str: 50, weaponDmg: 30, exp: 1000,
    imageKey: 'arcadia_guard',
    lootPool: ['티타늄 합금 장검', '전설의 크롬 코어', 'A구역 보안 키', '네온 레퀴엠의 양손검', '레퀴엠 판금'],
    description: '상류층 특구 진입을 막는 살육 머신.',
    weaponAttr: '크러시', armorAttr: '판금',
    isBoss: true,
    element: '불',
  },
  {
    id: 'mutant_king',
    name: '돌연변이 왕 (지하 보스)',
    hp: 350, atk: 50, def: 20, str: 60, weaponDmg: 20, exp: 800,
    imageKey: null,
    lootPool: ['맹독 산성검', '부패한 왕의 심장', '원소 저항 목걸이', '심연 심판 철퇴'],
    description: '방사능 오염 구역의 정점에 선 괴물.',
    weaponAttr: '슬러시', armorAttr: '가죽',
    isBoss: true,
    element: '독',
  },
  // 숨겨진 보스 — 심연의 끝자락 등에서 낮은 확률로 등장, 처치 시 칭호 획득
  {
    id: 'shadow_king',
    name: '그림자 군주',
    hp: 280, atk: 48, def: 28, str: 45, weaponDmg: 22, exp: 1200,
    imageKey: null,
    lootPool: ['암살 단검', '섀도우 가죽 갑옷', '풀 포션', '대형 파란 포션', '얼음의 반지', '호랑이의 신속 민첩 반지', '그림자 군주의 비수'],
    description: '그림자 속에 숨겨진 전설의 암살자. 만나면 도망치거나 쓰러뜨리거나.',
    weaponAttr: '피어싱', armorAttr: '가죽',
    isBoss: true,
    element: '얼음',
  },
];

export interface ActiveEnemy {
  id: string;
  name: string;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  str: number;
  weaponDmg: number;
  exp: number;
  imageKey: string | null;
  lootPool: string[];
  weaponAttr: WeaponAttribute;
  armorAttr: ArmorAttribute;
  isBoss?: boolean;
  isMiniBoss?: boolean;
  /** spawnRandomEnemy 조우 구간·난이도 표시용 (정의 데이터 기준, EXP 월드 배율과 무관) */
  contentTier?: EnemyContentTier;
  /** 보스 2페이즈 돌입 여부 (true면 강화 패턴 사용) */
  phase2?: boolean;
  /** 상태 이상: 독 — 매 턴 피해 */
  poisonTurns?: number;
  /** 상태 이상: 출혈 — 매 턴 피해 */
  bleedTurns?: number;
  /** 상태 이상: 화상(불) — 매 턴 피해 */
  burnTurns?: number;
  /** 상태 이상: 스턴(전기) — 해당 턴 행동 불가 */
  stunTurns?: number;
  /** 전사 [갑옷 파쇄]: 남은 턴 (적 턴 종료 시 1 감소) */
  sunderTurns?: number;
  /** 갑옷 파쇄 시 방어력에서 깎는 고정값 (턴 0이면 무시) */
  sunderDefFlat?: number;
  /** 전사 [표식 참격]: 다음 물리 피해 1회에 보너스 적용 후 해제 */
  warriorMarkActive?: boolean;
  /** 상태 이상: 빙결(얼음) — 해당 턴 행동 불가 + DoT */
  freezeTurns?: number;
  /** 상태 이상: 경직(전기) — 턴당 DoT 피해 */
  staggerTurns?: number;
  /** 상태 이상: 수면 — N턴 행동 불가, 피격 시 즉시 해제 */
  sleepTurns?: number;
  /** 이동/공격 속도 저하(연금 룬 연계 등) — 턴마다 감소 */
  slowTurns?: number;
  /** 적 속성 (공격 시 플레이어에게 상태 이상 부여) */
  element?: ElementType;
  /** 받는 원소 피해 저항(데이터 미지정 시 불 속성 등은 스폰 시 추론과 합쳐짐 아님 — 명시만 저장) */
  elementResist?: Partial<Record<EnemyElementResistKey, number>>;
  /** 버퍼형 적: 공격 대신 아군 강화 */
  isBuffer?: boolean;
  /** 버프로 받은 공격력 보너스 (남은 턴 수) */
  atkBuffTurns?: number;
  /** 버프로 받은 공격력 수치 (데미지 계산 시 atk에 더함) */
  atkBuffBonus?: number;
  /** 적 의도(예고 패턴) — 다음 턴에 강공격 등을 쓰기 위한 상태 저장 */
  intentKind?: 'HEAVY';
  /** 의도 예고 남은 턴 수 (1이면 예고 중, 0이면 실행 턴) */
  intentTurnsLeft?: number;
  /** 강공격 배율 (예: 1.6 = 60% 더 강함) */
  intentPower?: number;
  /** 원거리 공격/방 단위 적 시스템용: 적이 플레이어를 인지(경계) 중인지 */
  alerted?: boolean;
  /** EnemyData에서 복사 — 고저·로그 연출 */
  attackPattern?: EnemyAttackPattern;
}

/**
 * 강공격 예고(intent) 해제 — 기절·빙결·수면 등으로 행동이 끊기면 시전도 함께 멈춤
 * WHY: 스턴 처리가 클로저의 옛 스냅샷을 쓰더라도, 상태에 남은 intent로 다음 로그가 어긋나지 않게 정리
 */
export function clearEnemyHeavyIntent(e: ActiveEnemy): ActiveEnemy {
  return {
    ...e,
    intentKind: undefined,
    intentTurnsLeft: 0,
    intentPower: undefined,
  };
}

/**
 * 적이 받는 불 속성 피해에 쓰는 저항 값(−0.5~0.75).
 * WHY: 테이블에 `elementResist.불`이 있으면 그만 쓰고, 없으면 본인 공격 속성·갑옷으로 추론한다.
 */
export function getEnemyFireResistForDamage(
  enemy: Pick<ActiveEnemy, 'element' | 'elementResist' | 'armorAttr'>,
): number {
  const explicit = enemy.elementResist?.불;
  if (explicit !== undefined && Number.isFinite(explicit)) {
    return Math.max(-0.5, Math.min(0.75, explicit));
  }
  let r = 0;
  switch (enemy.element) {
    case '불':
      r += 0.42;
      break;
    case '얼음':
      r -= 0.28;
      break;
    case '전기':
      r += 0.06;
      break;
    case '독':
      r -= 0.14;
      break;
    default:
      break;
  }
  switch (enemy.armorAttr) {
    case '판금':
      r += 0.07;
      break;
    case '천':
      r -= 0.1;
      break;
    case '가죽':
      r -= 0.05;
      break;
    default:
      break;
  }
  return Math.max(-0.5, Math.min(0.75, r));
}

/** 불 저항 r에 따른 최종 피해 배율 (취약 상한 1.55, 내화 하한 0.38) */
export function getFireDamageFactorFromResist(fireResist: number): number {
  return Math.max(0.38, Math.min(1.55, 1 - fireResist));
}

/** 성장형 몬스터: 플레이어를 쓰러뜨리면 경험치를 얻고 레벨업한다. (적 id → exp, level) */
export interface EnemyGrowthState {
  exp: number;
  level: number;
}

/** 플레이어를 죽였을 때 적이 받는 경험치 */
export const ENEMY_GROWTH_EXP_PER_KILL = 35;
/** 레벨 1업당 필요한 경험치 (누적). 레벨 = floor(exp / 이 값) */
export const ENEMY_GROWTH_EXP_PER_LEVEL = 50;
/** 레벨당 스탯 증가 배율 (1레벨 = +12%) */
export const ENEMY_GROWTH_STAT_FACTOR_PER_LEVEL = 0.12;

export function getEnemyGrowthLevel(exp: number): number {
  return Math.floor(exp / ENEMY_GROWTH_EXP_PER_LEVEL);
}

/** 이미 스폰된 적에게 성장 레벨을 적용해 HP/공격력/방어력 등을 올린다. 이름에 [Lv.N] 붙음. */
export function applyEnemyGrowth(enemy: ActiveEnemy, level: number): ActiveEnemy {
  if (level <= 0) return enemy;
  const factor = 1 + level * ENEMY_GROWTH_STAT_FACTOR_PER_LEVEL;
  const hp = Math.max(1, Math.round(enemy.maxHp * factor));
  return {
    ...enemy,
    name: `[Lv.${level}] ${enemy.name}`,
    currentHp: hp,
    maxHp: hp,
    atk: Math.max(1, Math.round(enemy.atk * factor)),
    def: Math.max(0, Math.round(enemy.def * factor)),
    str: Math.max(1, Math.round(enemy.str * factor)),
    weaponDmg: Math.max(1, Math.round(enemy.weaponDmg * factor)),
  };
}

/** 적 HP 배율 (기본 데이터 대비). 전투 지속 시간을 늘리기 위해 1.0보다 크게 설정 */
const ENEMY_HP_SCALE = 1.45;
/** 적 방어력 배율. 데미지 감소로 전투가 더 오래 가도록 */
const ENEMY_DEF_SCALE = 1.5;
/** 보스·준보스: 기본 스케일 적용 후 HP/ATK/DEF/STR/무기뎀 추가 배율 */
const BOSS_MINIBOSS_STAT_MULT = 2;
/** 전역 몬스터 처치 EXP 배율 (테이블 정의값에 곱함) */
const ENEMY_EXP_WORLD_MULT = 1.3;
/**
 * 콘텐츠 티어별 전투 능력치 계단 — 티어 1은 ×1, 이후 티어로 갈수록 인접 구간마다 1.3배 누적
 * WHY: EXP가 아니라 스폰 시 HP/ATK/DEF/STR/무기뎀에 적용 (1→2, 2→3, 3→4 동일 비율)
 */
const TIER_STAT_STAIR_STEP = 1.3;

/** 스폰 전투 스탯에 곱하는 티어 배수 (디버그·밸런스 참고용) */
export function getTierStatStairMultiplier(tier: EnemyContentTier): number {
  return Math.pow(TIER_STAT_STAIR_STEP, Math.max(0, tier - 1));
}

/**
 * 준보스 전용 티어 — 테이블 `exp`만으로 구간을 나눈다.
 * WHY: 예전에는 모든 준보스를 티어 5로 고정해 `1.3^4` 계단·준보스 2배가 항상 겹쳤고,
 * 강공격·치명까지 붙으면 1구역 조우에서도 단일 타격 1000+ 같은 피크 딜이 나왔다.
 */
function getMiniBossContentTierFromExp(exp: number): EnemyContentTier {
  if (exp <= 280) return 3;
  if (exp <= 450) return 4;
  return 5;
}

/**
 * 몬스터 난이도 티어 — 아이템처럼 별도 등급 필드는 없고, 플래그·정의 exp로 구간을 나눈다.
 * WHY: 주석의 “티어 1~6”·spawnRandomEnemy 조우 구간과 맞춘 단일 기준.
 * - 6: 관문/숨겨진 보스 (isBoss 단독)
 * - 3~5: 미니 보스 — `exp` 구간별 (`getMiniBossContentTierFromExp`)
 * - 1~4: 일반 — 정의 exp 상한으로 구간 (60 / 130 / 220 / 그 이상)
 */
export function getEnemyContentTier(data: EnemyData): EnemyContentTier {
  if (data.isBoss && !data.isMiniBoss) return 6;
  if (data.isMiniBoss) return getMiniBossContentTierFromExp(data.exp);
  const x = data.exp;
  if (x <= 60) return 1;
  if (x <= 130) return 2;
  if (x <= 220) return 3;
  return 4;
}

/** HP·DEF 스케일 + 티어 계단 + (보스|준보스)면 전투 스탯 2배 */
function computeSpawnCombatStats(
  data: EnemyData,
  contentTier: EnemyContentTier
): Pick<ActiveEnemy, 'currentHp' | 'maxHp' | 'atk' | 'def' | 'str' | 'weaponDmg'> {
  const tierMult = getTierStatStairMultiplier(contentTier);
  let hp = Math.max(1, Math.round(data.hp * ENEMY_HP_SCALE * tierMult));
  let def = Math.max(0, Math.round(data.def * ENEMY_DEF_SCALE * tierMult));
  let atk = Math.max(1, Math.round(data.atk * tierMult));
  let str = Math.max(1, Math.round(data.str * tierMult));
  let weaponDmg = Math.max(1, Math.round(data.weaponDmg * tierMult));
  if (data.isBoss || data.isMiniBoss) {
    hp = Math.max(1, Math.round(hp * BOSS_MINIBOSS_STAT_MULT));
    def = Math.max(0, Math.round(def * BOSS_MINIBOSS_STAT_MULT));
    atk = Math.max(1, Math.round(atk * BOSS_MINIBOSS_STAT_MULT));
    str = Math.max(1, Math.round(str * BOSS_MINIBOSS_STAT_MULT));
    weaponDmg = Math.max(1, Math.round(weaponDmg * BOSS_MINIBOSS_STAT_MULT));
  }
  return { currentHp: hp, maxHp: hp, atk, def, str, weaponDmg };
}

function computeSpawnOverrides(data: EnemyData): Pick<
  ActiveEnemy,
  'currentHp' | 'maxHp' | 'atk' | 'def' | 'str' | 'weaponDmg' | 'exp' | 'contentTier'
> {
  const contentTier = getEnemyContentTier(data);
  const combat = computeSpawnCombatStats(data, contentTier);
  const exp = Math.max(1, Math.round(data.exp * ENEMY_EXP_WORLD_MULT));
  return { ...combat, exp, contentTier };
}

export function spawnEnemy(enemyId: string): ActiveEnemy | null {
  const data = ENEMY_LIST.find(e => e.id === enemyId);
  if (!data) return null;
  const ov = computeSpawnOverrides(data);
  return {
    ...data,
    ...ov,
    lootPool: [...data.lootPool],
  };
}

export function spawnRandomEnemy(playerLevel: number): ActiveEnemy {
  let pool: EnemyData[];
  const normalEnemies = ENEMY_LIST.filter(e => !e.isBoss);
  const lv = Math.max(1, Math.min(50, playerLevel));
  // WHY: 플레이어 만렙 50에 맞춰 구간을 촘촘히 나눠, 초반은 약하고 후반은 고EXP 풀만 사용
  if (lv <= 2) {
    pool = normalEnemies.filter(e => e.exp <= 60);
  } else if (lv <= 5) {
    pool = normalEnemies.filter(e => e.exp <= 130);
  } else if (lv <= 10) {
    pool = normalEnemies.filter(e => e.exp <= 220);
  } else if (lv <= 15) {
    pool = normalEnemies.filter(e => e.exp <= 400);
  } else if (lv <= 22) {
    pool = normalEnemies.filter(e => e.exp <= 600);
  } else if (lv <= 30) {
    pool = normalEnemies.filter(e => e.exp <= 750);
  } else if (lv <= 38) {
    pool = normalEnemies.filter(e => e.exp <= 1000);
  } else if (lv <= 45) {
    pool = normalEnemies.filter(e => e.exp <= 1200);
  } else {
    pool = normalEnemies;
  }
  if (pool.length === 0) pool = normalEnemies;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const ov = computeSpawnOverrides(chosen);
  return {
    ...chosen,
    ...ov,
    lootPool: [...chosen.lootPool],
  };
}
