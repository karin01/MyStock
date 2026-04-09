/**
 * 홀로 거래소 전용 블라인드(도박) 상인 — 구매 시점에만 실제 부위·등급·베이스가 정해지고,
 * 감정은 베일 전용 각인 풀(appraisal.ts pool: veil)로 처리한다.
 * 베이스는 (1) 아이언 잭 정규 목록에 없는 장비 우선 (2) 일정 확률로 전용 쓰레기 베이스.
 */
import { isItemNameSoldByIronJack } from './ironJackShop';
import { scaleCoinCost } from './economyBalance';
import {
  ITEM_LIST,
  isEquippableForMystery,
  getItemById,
  VEIL_SCRAP_ITEM_IDS,
  itemGradeLeq,
  type ItemData,
  type ItemGrade,
} from './items';

/** NPC id — npcs.ts 의 id 와 일치 */
export const GAMBLING_MERCHANT_NPC_ID = 'veilCrypt';

/** 이 방에서만 대화·거래·구매 허용 */
export const GAMBLING_MERCHANT_ROOM_ID = 'holo_market';

export type BlindBoxProduct = {
  purchaseName: string;
  price: number;
  minLevel?: number;
};

export const BLIND_BOX_PRODUCTS: BlindBoxProduct[] = [
  { purchaseName: '스크랩 룰렛', price: 220 },
  { purchaseName: '블러드 룰렛 · 무기', price: 420 },
  { purchaseName: '블러드 룰렛 · 갑옷', price: 420 },
  { purchaseName: '블러드 룰렛 · 방패', price: 380 },
  { purchaseName: '블러드 룰렛 · 장신구', price: 480 },
  { purchaseName: '미러볼 · 방어구', price: 680 },
  { purchaseName: '네온 럭키박스', price: 920 },
  { purchaseName: '크롬 하이롤러', price: 1180, minLevel: 14 },
  { purchaseName: '홀로 잭팟', price: 1650 },
];

export function maxGradeForPlayerLevel(playerLevel: number): ItemGrade {
  if (playerLevel <= 4) return 'common';
  if (playerLevel <= 9) return 'normal';
  if (playerLevel <= 13) return 'magic';
  if (playerLevel <= 22) return 'rare';
  return 'epic';
}

function isVeilScrapId(id: string): boolean {
  return (VEIL_SCRAP_ITEM_IDS as readonly string[]).includes(id);
}

/** 쓰레기 전용 id는 일반 풀에서 제외 */
function poolIds(pred: (it: ItemData) => boolean): string[] {
  return ITEM_LIST.filter(
    (it) => isEquippableForMystery(it) && pred(it) && !isVeilScrapId(it.id)
  ).map((it) => it.id);
}

function pickRandomId(ids: string[]): string {
  if (ids.length === 0) return 'potion_red';
  return ids[Math.floor(Math.random() * ids.length)]!;
}

function filterNonJackShopIds(ids: string[]): string[] {
  return ids.filter((id) => {
    const it = getItemById(id);
    return it && !isItemNameSoldByIronJack(it.name);
  });
}

function safePickWithCap(pred: (it: ItemData) => boolean, cap: ItemGrade): string {
  const ids = poolIds((it) => pred(it) && itemGradeLeq(it.grade, cap));
  if (ids.length > 0) return pickRandomId(ids);
  const fallback = poolIds((it) => itemGradeLeq(it.grade, cap));
  if (fallback.length > 0) return pickRandomId(fallback);
  return 'potion_red';
}

/**
 * 아이언 잭이 이름으로 파는 베이스는 제외하고 롤. 비면 잭 풀 포함 폴백.
 */
function safePickVeil(pred: (it: ItemData) => boolean, cap: ItemGrade): string {
  const ids = ITEM_LIST.filter(
    (it) =>
      isEquippableForMystery(it) &&
      pred(it) &&
      itemGradeLeq(it.grade, cap) &&
      !isItemNameSoldByIronJack(it.name) &&
      !isVeilScrapId(it.id)
  ).map((it) => it.id);
  if (ids.length > 0) return pickRandomId(ids);
  return safePickWithCap(pred, cap);
}

function junkMatchesProduct(purchaseName: string, d: ItemData): boolean {
  switch (purchaseName) {
    case '블러드 룰렛 · 무기':
      return d.type === 'weapon';
    case '블러드 룰렛 · 갑옷':
      return d.type === 'armor';
    case '블러드 룰렛 · 방패':
      return d.type === 'shield';
    case '블러드 룰렛 · 장신구':
      return d.type === 'accessory';
    case '미러볼 · 방어구':
      return d.type === 'shield' || d.type === 'accessory';
    case '네온 럭키박스':
    case '크롬 하이롤러':
      return d.type === 'weapon' || d.type === 'armor';
    default:
      return true;
  }
}

/** 약 23% — 상품 부위에 맞는 전용 쓰레기 베이스 */
function tryVeilJunkRoll(purchaseName: string): string | null {
  if (Math.random() >= 0.23) return null;
  const defs = VEIL_SCRAP_ITEM_IDS.map((id) => getItemById(id)).filter(
    (d): d is ItemData => !!d && junkMatchesProduct(purchaseName, d)
  );
  if (defs.length === 0) return null;
  return defs[Math.floor(Math.random() * defs.length)]!.id;
}

/** 블라인드 상품 실구매가 (테이블 price × 월드 배율) */
export function getBlindBoxPurchasePrice(product: BlindBoxProduct): number {
  return scaleCoinCost(product.price);
}

export function findBlindBoxProduct(raw: string): BlindBoxProduct | undefined {
  const n = raw.trim().replace(/\s+/g, ' ');
  const exact = BLIND_BOX_PRODUCTS.find((p) => p.purchaseName === n);
  if (exact) return exact;
  const compact = n.replace(/\s/g, '');
  return BLIND_BOX_PRODUCTS.find((p) => p.purchaseName.replace(/\s/g, '') === compact);
}

export function getGamblingMerchantShopResponse(): string {
  const lines = BLIND_BOX_PRODUCTS.map((p) => {
    let line = `- ${p.purchaseName} (${getBlindBoxPurchasePrice(p)} C) — 미확인 장비 1개 (실명·옵션은 구매 후 감정으로 공개)`;
    if (p.minLevel != null) line += ` · 구매 Lv.${p.minLevel} 이상`;
    return line;
  }).join('\n');

  return (
    `[베일 크립트의 블라인드 로테리]\n` +
    `"...홀로그램 장막 뒤의 번호를 고르면, 크레딧은 사라지고 대신 '뭔가'가 네 주머니에 떨어지지. ` +
    `그게 금인지 쇳덩이인지는, 사고 본 뒤에 감정하면 알게 돼."\n\n` +
    `[블라인드 상품]\n${lines}\n\n` +
    `[규칙]\n` +
    `· 환불 없음.\n` +
    `· 베이스는 원칙적으로 아이언 잭이 이름으로 파는 물건과 겹치지 않게 뽑힌다. 풀이 비면 예외적으로 잭 풀로 넘어간다.\n` +
    `· 확률적으로 '쓰레기 전용 베이스'가 나온다 — 텅 빈 링, 골판지 갑옷 같은 것.\n` +
    `· 감정 시 붙는 각인은 잭 직매품에는 없는, 블라인드 전용 옵션 풀이다.\n` +
    `· 레벨에 맞춰 베이스 등급 상한이 걸린다. (레전드리 등급은 블라인드 풀에 없음 — 드랍 전용)\n` +
    `· '구매 [상품명]' — 공백·중점(·) 포함 그대로 입력.`
  );
}

function rollJackpot(playerLevel: number): string {
  const cap = maxGradeForPlayerLevel(playerLevel);
  let ep = filterNonJackShopIds(
    poolIds((it) => (it.grade ?? 'common') === 'epic' && itemGradeLeq(it.grade, cap))
  );
  let ra = filterNonJackShopIds(
    poolIds((it) => (it.grade ?? 'common') === 'rare' && itemGradeLeq(it.grade, cap))
  );
  let ma = filterNonJackShopIds(
    poolIds((it) => (it.grade ?? 'common') === 'magic' && itemGradeLeq(it.grade, cap))
  );

  type Bucket = { w: number; ids: string[] };
  const buckets: Bucket[] = [];
  if (ep.length) {
    const w =
      playerLevel >= 23 ? 0.42 : playerLevel >= 18 ? 0.34 : playerLevel >= 12 ? 0.22 : ep.length ? 0.12 : 0;
    if (w > 0) buckets.push({ w, ids: ep });
  }
  if (ra.length) buckets.push({ w: 0.36, ids: ra });
  if (ma.length) buckets.push({ w: 0.32, ids: ma });

  if (buckets.length === 0) return safePickVeil(() => true, cap);

  const tw = buckets.reduce((s, b) => s + b.w, 0);
  let r = Math.random() * tw;
  for (const b of buckets) {
    r -= b.w;
    if (r <= 0) return pickRandomId(b.ids);
  }
  return pickRandomId(buckets[buckets.length - 1]!.ids);
}

/** 베일 쓰레기 베이스 여부 — 구매 연출·힌트용 */
export function isVeilScrapItemId(rolledItemId: string): boolean {
  return isVeilScrapId(rolledItemId);
}

export function getVeilScrapPurchaseLine(): string {
  return '🗑️ [쓰레기 페이스] 무대 조명만 화려했다. 손에 쥔 건 누가 봐도 싸구려다… (감정 시에는 블라인드 전용 각인이 붙을 수 있다)';
}

export function getVeilJackpotFlavorLine(rolledItemId: string): string | null {
  const def = getItemById(rolledItemId);
  if (!def) return null;
  const g = def.grade ?? 'common';
  if (g === 'legendary') {
    return '💀 [금기의 파동] 공기가 일그러지며 상점가 스피커가 잠깐 침묵했다… 이건 홀로그램 장난감이 아닐지도 모른다. (실명은 감정 후)';
  }
  if (g === 'epic') {
    return '🌟 [잭팟!!!] 홀로그램이 폭죽처럼 터지며 눈이 멀 뻔했다. 손안 장비가 심상치 않은 온기를 내뿜는다… (실명은 감정 후)';
  }
  if (g === 'rare') {
    return '💠 [대박 궤적] 주변 부스의 스크린이 잠깐 당신에게 동기화되는 듯했다. 꽤 희귀한 줄기만이 느껴진다.';
  }
  if (g === 'magic') {
    return '✨ [무난한 승리?] 은은한 무늬가 홀로 스쳐 지나갔다. 쓸만한지는 감정이 말해 줄 것이다.';
  }
  return '📦 [찝찝한 침묵] 본전일지 손해인지는 감정 후에나 알겠군…';
}

export function rollBlindBoxItemId(purchaseName: string, playerLevel: number): string {
  const junk = tryVeilJunkRoll(purchaseName);
  if (junk) return junk;

  const cap = maxGradeForPlayerLevel(playerLevel);

  switch (purchaseName) {
    case '스크랩 룰렛':
      return safePickVeil((it) => (it.grade ?? 'common') === 'common', cap);
    case '블러드 룰렛 · 무기':
      return safePickVeil((it) => it.type === 'weapon' && itemGradeLeq(it.grade, 'normal'), cap);
    case '블러드 룰렛 · 갑옷':
      return safePickVeil((it) => it.type === 'armor' && itemGradeLeq(it.grade, 'normal'), cap);
    case '블러드 룰렛 · 방패':
      return safePickVeil((it) => it.type === 'shield' && itemGradeLeq(it.grade, 'normal'), cap);
    case '블러드 룰렛 · 장신구':
      return safePickVeil((it) => it.type === 'accessory' && itemGradeLeq(it.grade, 'magic'), cap);
    case '미러볼 · 방어구':
      return safePickVeil(
        (it) =>
          (it.type === 'shield' || it.type === 'accessory') && itemGradeLeq(it.grade, 'magic'),
        cap
      );
    case '네온 럭키박스':
      return safePickVeil(
        (it) =>
          (it.type === 'weapon' || it.type === 'armor') &&
          ((it.grade ?? 'common') === 'magic' || (it.grade ?? 'common') === 'rare'),
        cap
      );
    case '크롬 하이롤러':
      return safePickVeil(
        (it) =>
          (it.type === 'weapon' || it.type === 'armor') &&
          ((it.grade ?? 'common') === 'rare' || (it.grade ?? 'common') === 'epic'),
        cap
      );
    case '홀로 잭팟':
      return rollJackpot(playerLevel);
    default:
      return safePickVeil(() => true, cap);
  }
}
