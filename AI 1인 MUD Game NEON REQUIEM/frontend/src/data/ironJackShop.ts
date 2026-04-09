// 아이언 잭 상점 — 판매 목록·로그 문구 (거래 명령 / 선택 상점 공용)
import { getItemByName, getScaledShopBuyPrice, isShopExcludedGrade, type ItemData } from './items';
import { scaleCoinCost } from './economyBalance';
import { JOB_LIST, type ArmorAttribute } from './jobClasses';
import type { WeaponClass } from './weaponMastery';

/** 감정 스크롤 아이템명 — items.ts와 동일 문자열 유지 */
export const APPRAISAL_SCROLL_ITEM_NAME = '감정 스크롤';

/** 슬럼 상점가에서 아이언 잭에게 지불하는 유료 감정 비용 (COIN) — 스크롤보다 약간 비싸게 */
export const IRON_JACK_APPRAISAL_COST_COINS = scaleCoinCost(260);

/** 본거지 상점가 — 안내 문구·투숙 NPC 힌트 제외 판별용 */
export const IRON_JACK_SERVICE_ROOM_ID = 'slum_market';

/** 컨베이어·하수 미로 등, 본점 외에 잭이 지나며 장사·감정하는 구역 */
const IRON_JACK_WANDER_ROOM_IDS = new Set<string>([
  'conveyor_maze',
  'silent_maze',
  'silent_rest_area',
]);

/**
 * 유료 감정(잭과 대화 후)·이 방을 “잭 매입 가능 구역”으로 취급할 때 사용.
 * WHY: 심층 미로·야적장 미로(maze_*)에서도 상점가로 돌아가지 않게 하기 위함.
 */
export function isIronJackServiceRoom(roomId: string): boolean {
  if (roomId === IRON_JACK_SERVICE_ROOM_ID) return true;
  if (IRON_JACK_WANDER_ROOM_IDS.has(roomId)) return true;
  if (roomId.startsWith('maze_')) return true;
  return false;
}

/** 아이언 잭이 파는 아이템 이름 목록 (순서 유지) */
export const IRON_JACK_SHOP_ITEM_NAMES: string[] = [
  '초보자용 도검', '강철 장검', '정예 기사의 양손검', '티타늄 장검',
  '초보자용 단검', '일반 단검', '암살 단검', '흡혈 단검', '흡혈의 낡은 단검', '흡혈의 일반 단검',
  '사냥용 활', '강화 사냥 활',
  '초보자 둔기', '축복받은 철퇴',
  '신속의 낡은 도검', '신속의 낡은 단검', '적출의 강철 장검', '적출의 암살 단검',
  '파멸의 강철 장검', '파괴의 축복받은 철퇴', '파멸의 정예 기사의 양손검',
  '정확의 티타늄 장검', '정확의 강화 사냥 활',
  '거인의 강철 장검', '거인의 정예 기사의 양손검', '거인의 초보자 둔기',
  '호랑이의 낡은 단검', '호랑이의 티타늄 장검', '호랑이의 사냥용 활',
  '황소의 축복받은 철퇴', '황소의 낡은 도검',
  '광휘의 낡은 지팡이', '광휘의 강화 마법 지팡이',
  '화염의 낡은 도검', '화염의 강철 장검', '화염의 강화 마법 지팡이',
  '냉기의 낡은 도검', '냉기의 낡은 단검', '냉기의 낡은 지팡이',
  '전격의 강철 장검', '전격의 암살 단검', '전격의 강화 마법 지팡이',
  '흡혈의 낡은 단검', '흡혈의 낡은 도검',
  '부패의 낡은 단검', '부패의 암살 단검', '부패의 강철 장검',
  '신속의 정확의 티타늄 장검', '적출의 부패의 암살 단검', '거인의 파멸의 양손검',
  '광휘의 화염의 강화 지팡이', '호랑이의 정확의 강화 사냥 활', '황소의 파괴의 철퇴',
  '화염의 흡혈의 장검', '신속의 적출의 단검', '냉기의 광휘의 지팡이', '정확의 파멸의 장검',
  '거인 살육자의 양손검', '언데드 살육자의 축복받은 철퇴', '벼락 발동의 강철 장검', '화염 발동의 강화 지팡이',
  '허름한 천 옷',
  '신비로운 로브',
  '성속의 로브',
  '화염 수호 로브', '빙결 수호 로브', '전격 수호 로브', '독액 수호 로브',
  '화염·지성 로브', '빙결·정신 체력 로브', '전격·지능 로브', '독액·체력 정신 로브',
  '원소 저항 로브',
  '화염·빙결 로브', '전격·독액 로브', '삼원소 로브',
  '캐스터의 이원 로브', '치명·마력 로브', '삼원소·캐스터 로브',
  '대현자의 로브', '대현자·치명 로브',
  '초보자 사슬 갑옷', '강화 사슬 갑옷', '전기 차폐 사슬', '역병 방어 사슬',
  '화염 차폐 사슬', '빙결 차폐 사슬', '화염·빙결 사슬', '삼속성 사슬', '파수꾼의 사슬',
  '힘·체력 사슬', '화염·힘 사슬', '빙결·체력 사슬', '화염·빙결·힘체 사슬', '파수꾼·정신 사슬',
  '녹슨 판금 갑옷', '화염 방호 판금', '빙결 방호 판금', '제국 기사의 판금갑옷', '성광의 판금갑옷',
  '전격 방호 판금', '역병 방호 판금', '화염·빙결 판금', '전격·역병 판금', '삼속성 방호 판금', '원소군주의 판금',
  '힘·체력 판금', '화염·힘 판금', '빙결·체력 판금', '화염·빙결·힘체 판금', '삼속성·힘체 판금', '성광·체력 판금',
  '가죽 자켓', '사냥꾼 가죽 자켓', '초보자용 가죽갑옷', '섀도우 가죽 갑옷', '회피 특화 가죽 자켓', '독사 사냥꾼 가죽 자켓',
  '화염가죽 자켓', '빙결가죽 자켓', '전격가죽 자켓', '화염·빙결 가죽 자켓', '삼원소 가죽 자켓', '추적자의 가죽 자켓',
  '민첩·체력 가죽 자켓', '화염·민첩 가죽 자켓', '전격·민첩 가죽 자켓', '독액·민첩 가죽 자켓', '화염·빙결·민체 가죽 자켓',
  '치명·민첩 가죽 자켓', '명중·민첩 가죽 자켓', '추적자·치명 가죽 자켓',
  '나무 소형 방패', '철제 원형 방패', '오크 문양 방패', '힘의 방패', '튼튼한 방패', '성기사의 방패', '신속의 방패', '강철 탑방패', '거인의 방패', '용의 비늘 방패', '마력 차폐 방패', '곰의 방패', '황소의 방패', '제국 기사 방패', '흑철 방패', '성검의 방패',
  '강철의 반지', '민첩의 반지', '마력의 목걸이', '곰의 목걸이', '호랑이의 목걸이', '소의 목걸이',
  '불의 반지', '얼음의 반지', '전기의 반지', '독의 반지',
  '화염 저항 반지', '빙결 저항 반지', '원소 저항 목걸이',
  '곰의 반지', '호랑이의 반지', '소의 반지', '올빼미의 반지', '스핑크스의 반지', '태양의 반지', '달의 반지',
  '거인의 반지', '신속의 반지', '운명의 반지', '행운의 반지', '거인의 목걸이', '신속의 목걸이', '운명의 목걸이', '행운의 목걸이', '초월의 목걸이', '광채의 목걸이', '별의 목걸이',
  '곰의 강철 반지', '호랑이의 민첩 반지', '소의 강철 반지', '곰의 강철 목걸이', '호랑이의 민첩 목걸이', '소의 강철 목걸이', '올빼미의 마력 목걸이', '스핑크스의 마력 목걸이', '태양의 화염 반지', '달의 빙결 반지',
  '거인의 강철 반지', '신속의 민첩 반지', '운명의 강철 반지', '행운의 민첩 반지', '거인의 강철 목걸이', '신속의 민첩 목걸이', '운명의 강철 목걸이', '행운의 민첩 목걸이', '초월의 마력 목걸이', '광채의 마력 목걸이', '별의 강철 반지',
  '곰의 거인 반지', '호랑이의 신속 반지', '소의 거인 반지', '곰의 거인 목걸이', '호랑이의 신속 목걸이', '소의 거인 목걸이', '태양의 행운 반지', '달의 운명 반지', '올빼미의 광채 목걸이', '스핑크스의 초월 목걸이', '별의 마력 목걸이',
  '불의 거인 반지', '얼음의 신속 반지', '전기의 올빼미 반지', '독의 호랑이 반지', '원소의 별 목걸이', '화염 저항 태양 반지', '빙결 저항 달 반지',
  '곰의 거인 강철 반지', '호랑이의 신속 민첩 반지', '올빼미의 광채 마력 목걸이', '스핑크스의 초월 마력 목걸이', '운명의 행운 반지', '운명의 행운 목걸이', '별의 원소 반지',
  '빨간 포션', '작은 파란 포션', '파란 포션', '대형 파란 포션',
  APPRAISAL_SCROLL_ITEM_NAME,
];

function jobIdFromCharacterJobName(jobName?: string | null): string | null {
  if (!jobName) return null;
  return JOB_LIST.find((j) => j.name === jobName)?.id ?? null;
}

/** 직업별 허용 무기 계열 — 마스터 진 스킬처럼 직업에 맞는 장비만 목록 표시 */
function allowedWeaponClassesForJob(jobId: string): WeaponClass[] | null {
  switch (jobId) {
    case 'wizard':
      return ['staff'];
    case 'cleric':
      return ['mace'];
    case 'warrior':
      return ['sword', 'greatsword'];
    case 'thief':
      return ['dagger'];
    case 'rogue':
      return ['bow'];
    default:
      return null;
  }
}

function armorNameMatchesJobLine(itemName: string, armorAttr: ArmorAttribute): boolean {
  switch (armorAttr) {
    case '천':
      return itemName.includes('로브') || itemName.includes('천 옷');
    case '사슬':
      return itemName.includes('사슬');
    case '판금':
      return itemName.includes('판금');
    case '가죽':
      return itemName.includes('가죽') || itemName.includes('자켓') || itemName.includes('재킷');
    default:
      return true;
  }
}

/**
 * 무기·갑옷만 직업 필터. 방패·장신구·포션 등은 전 직업 동일.
 * 마법사: 지팡이(staff) + 이름에 「완드」 / 로브·천 옷.
 */
export function isIronJackShopItemVisibleForJob(item: ItemData, jobName?: string | null): boolean {
  const jobId = jobIdFromCharacterJobName(jobName);
  if (!jobId) return true;
  const job = JOB_LIST.find((j) => j.id === jobId);
  if (!job) return true;

  if (item.type === 'weapon') {
    const allowed = allowedWeaponClassesForJob(jobId);
    if (!allowed) return true;
    if (jobId === 'wizard' && item.name.includes('완드')) return true;
    const wc = item.weaponClass;
    if (!wc) return false;
    return allowed.includes(wc);
  }
  if (item.type === 'armor') {
    return armorNameMatchesJobLine(item.name, job.baseArmorAttr);
  }
  return true;
}

export function getIronJackShopItemNamesForJob(jobName?: string | null): string[] {
  return IRON_JACK_SHOP_ITEM_NAMES.filter((name) => {
    const it = getItemByName(name);
    if (!it) return false;
    // WHY: 레전드리는 드랍 전용 — 목록에 실수로 넣어도 표시·구매 불가
    if (isShopExcludedGrade(it.grade)) return false;
    return isIronJackShopItemVisibleForJob(it, jobName);
  });
}

/** 구매 검증: 잭 정규 목록 + 직업 필터 */
export function isItemNameOfferedByIronJackForJob(itemName: string, jobName?: string | null): boolean {
  if (!IRON_JACK_SHOP_ITEM_NAMES.includes(itemName)) return false;
  const it = getItemByName(itemName);
  if (!it) return false;
  if (isShopExcludedGrade(it.grade)) return false;
  return isIronJackShopItemVisibleForJob(it, jobName);
}

/** 해당 이름의 아이템이 아이언 잭 정규 목록에 있는지 (블라인드 상점 전용 풀 구분용) */
export function isItemNameSoldByIronJack(itemName: string): boolean {
  return IRON_JACK_SHOP_ITEM_NAMES.includes(itemName);
}

/** 상점 목록 문자열 (플레이어 로그용) — jobName 있으면 무기·갑옷만 직업에 맞게 축소 */
export function getIronJackShopResponse(jobName?: string | null): string {
  const names = getIronJackShopItemNamesForJob(jobName);
  const shopList = names
    .map((name) => {
      const it = getItemByName(name);
      const buy = it ? getScaledShopBuyPrice(it) : undefined;
      return it && buy != null ? `- ${it.name} (${buy} C)` : '';
    })
    .filter(Boolean)
    .join('\n');

  const jobNote = jobName
    ? `\n\n※ 무기·갑옷은 [${jobName}]용만 표시. 방패·장신구·포션·감정 스크롤은 동일 목록.`
    : '';

  return (
    `[아이언 잭의 상점]\n"크레딧만 가져오면 뭐든 팔지."\n\n` +
    `※ [레전드리] 등급 장비는 어떤 상점에도 안 풀린다 — 전리품·드랍으로만 구할 수 있다.\n\n` +
    `[판매 목록]\n${shopList}\n\n` +
    `[부가 서비스] 미확인 장비 감정: 이 방에서 잭과 대화(거래 연출) 후 ` +
    `'감정 [미확인 이름]' 입력 시 ${IRON_JACK_APPRAISAL_COST_COINS} C. ` +
    `또는 [${APPRAISAL_SCROLL_ITEM_NAME}] 구매 후 어디서든 감정 가능(스크롤 1매 소모).\n\n` +
    `('구매 [아이템명]' / '판매 [아이템명]' — 잡동사니·무기·갑옷·반지·목걸이·물약·스킬북은 '판매 잡동사니', '판매 무기'… 처럼 일괄 판매 가능)` +
    jobNote
  );
}
