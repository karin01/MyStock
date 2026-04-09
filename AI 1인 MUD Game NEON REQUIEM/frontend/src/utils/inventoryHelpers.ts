import type { ItemGrade } from '../data/items';
import type { RolledAffixLine } from '../data/appraisal';
import { getItemById, getMysteryCategoryLabel } from '../data/items';

/** 인벤 전체 슬롯 상한 (이 칸을 넘기면 추가 획득 불가) */
export const INVENTORY_MAX_SLOTS = 100;

export function isInventoryFull(inventory: InventoryRow[]): boolean {
  return inventory.length >= INVENTORY_MAX_SLOTS;
}

/** 101번째 추가 시도 등에 출력하는 공통 메시지 */
export function getInventoryFullMessage(): string {
  return `🎒 가방이 가득 찼습니다. (인벤 최대 ${INVENTORY_MAX_SLOTS}칸) 더 넣을 수 없습니다.`;
}

/**
 * 동일 이름 반지가 여러 인벤 행일 때 장착에 쓸 행을 고른다.
 * WHY: `find(name)`만 쓰면 항상 첫 행만 잡혀 ring1·ring2가 같은 id를 가리키고,
 *      둘째 인스턴스는 장착으로 안 잡혀 일괄 판매 등에 넘어갈 수 있다.
 */
export function pickInventoryRowForRingEquip(
  inventory: InventoryRow[],
  itemName: string,
  opts: { forceRingSlot: 1 | 2 | null; ring1: string | null; ring2: string | null }
): InventoryRow | undefined {
  const rows = inventory.filter((r) => r.name === itemName && r.identified !== false);
  if (rows.length === 0) return undefined;
  const { forceRingSlot, ring1, ring2 } = opts;
  if (forceRingSlot === 1) {
    if (ring1 && rows.some((r) => r.id === ring1)) return rows.find((r) => r.id === ring1);
    return rows.find((r) => r.id !== ring2) ?? rows[0];
  }
  if (forceRingSlot === 2) {
    if (ring2 && rows.some((r) => r.id === ring2)) return rows.find((r) => r.id === ring2);
    return rows.find((r) => r.id !== ring1) ?? rows[0];
  }
  if (!ring1) return rows.find((r) => r.id !== ring2) ?? rows[0];
  if (!ring2) return rows.find((r) => r.id !== ring1) ?? rows[0];
  return rows.find((r) => r.id !== ring2) ?? rows[0];
}

/**
 * 세이브·버그로 ring1과 ring2가 같은 인스턴스를 가리키는데, 같은 이름의 다른 행이 있으면 ring2를 고친다.
 */
export function reconcileDuplicateRingSlotIds(
  inventory: InventoryRow[],
  ring1: string | null,
  ring2: string | null
): { ring1: string | null; ring2: string | null } {
  if (!ring1 || !ring2 || ring1 !== ring2) return { ring1, ring2 };
  const row = inventory.find((r) => r.id === ring1);
  if (!row) return { ring1, ring2 };
  const alt = inventory.find((r) => r.name === row.name && r.id !== ring1);
  if (!alt) return { ring1, ring2 };
  return { ring1, ring2: alt.id };
}

/** 물약류만 인벤 한 칸에 수량 합산 (장비·미확인·각인 붙은 행은 제외) */
export const STACKABLE_POTION_ITEM_NAMES = new Set<string>([
  '빨간 포션',
  '작은 파란 포션',
  '파란 포션',
  '대형 파란 포션',
  '수상한 USB 포션',
  '풀 포션',
]);

/** 인벤 한 칸: 동일 이름 아이템도 서로 다른 강화·내구도를 가질 수 있도록 고유 id 부여 */
export type InventoryRow = {
  id: string;
  name: string;
  /** 물약 스택 수량(2 이상일 때 주로 저장; 없으면 1개로 간주) */
  qty?: number;
  /** false면 미확인 장비 — mysteryItemId가 실체 */
  identified?: boolean;
  mysteryItemId?: string;
  /** 감정으로 붙은 부가 옵션(표시 문구 + 수치) */
  rolledAffixes?: RolledAffixLine[];
  /** 감정 옵션 중 신속/파멸 계열 — 무기 특수 보정용 */
  rolledCombatTags?: ('swift' | 'destructive')[];
  /** 베일 크립트 블라인드 출처 — 감정 시 전용 각인 풀 */
  veilBlindSource?: boolean;
  /** 룬 각인 인스턴스 품질 — 장착 시 패시브 배율에 곱함 */
  runeQuality?: number;
  /** 장비 인스턴스 레벨 — 동일 이름이라도 획득 시 롤, 무기 피해·방어구 방어 등에 배율 */
  itemLevel?: number;
};

/** 스택에 표시·계산할 개수 (미지정이면 1) */
export function getInventoryStackQty(row: InventoryRow): number {
  const q = row.qty;
  if (q == null || !Number.isFinite(Number(q))) return 1;
  return Math.max(1, Math.floor(Number(q)));
}

/** 한 칸에 물약 수량을 더 쌓을 수 있는지 */
export function isStackablePotionRow(row: InventoryRow): boolean {
  if (row.identified === false || row.mysteryItemId) return false;
  if (row.rolledAffixes && row.rolledAffixes.length > 0) return false;
  return STACKABLE_POTION_ITEM_NAMES.has(row.name);
}

/** 동일 물약 이름의 총 개수(모든 스택 행 합산) */
export function countStackablePotionQty(inv: InventoryRow[], itemName: string): number {
  return inv.reduce(
    (sum, r) => sum + (isStackablePotionRow(r) && r.name === itemName ? getInventoryStackQty(r) : 0),
    0,
  );
}

/**
 * 구세이브·버그로 나뉜 동일 물약 행을 한 칸으로 합친다.
 * WHY: 예전 코드는 행마다 newInventoryRow만 해서 같은 물약이 줄줄이 쌓였음.
 */
export function consolidateStackablePotionRows(inv: InventoryRow[]): InventoryRow[] {
  const out: InventoryRow[] = [];
  const potionNameToIdx = new Map<string, number>();

  for (const row of inv) {
    if (!isStackablePotionRow(row)) {
      out.push(row);
      continue;
    }
    const name = row.name;
    const q = getInventoryStackQty(row);
    const idx = potionNameToIdx.get(name);
    if (idx === undefined) {
      potionNameToIdx.set(name, out.length);
      if (q > 1) {
        out.push({ ...row, qty: q });
      } else {
        const { qty: _drop, ...rest } = row;
        out.push(rest as InventoryRow);
      }
    } else {
      const sum = getInventoryStackQty(out[idx]) + q;
      const prev = out[idx];
      const base: InventoryRow = { ...prev };
      delete (base as { qty?: number }).qty;
      out[idx] = sum > 1 ? { ...base, qty: sum } : base;
    }
  }
  return out;
}

/** 이름으로 첫 행을 찾아 1개만 제거(스택이면 qty 감소) */
export function removeOneFromInventoryByItemName(inv: InventoryRow[], itemName: string): InventoryRow[] {
  const idx = inv.findIndex((r) => r.name === itemName);
  if (idx < 0) return inv;
  const row = inv[idx];
  const q = getInventoryStackQty(row);
  if (q <= 1) return inv.filter((_, i) => i !== idx);
  const next = [...inv];
  const newQ = q - 1;
  if (newQ <= 1) {
    const { qty: _d, ...rest } = next[idx];
    next[idx] = rest as InventoryRow;
  } else {
    next[idx] = { ...row, qty: newQ };
  }
  return next;
}

let _idSeq = 0;
export function generateInventoryItemId(): string {
  _idSeq += 1;
  return `inv_${Date.now().toString(36)}_${_idSeq}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newInventoryRow(
  itemName: string,
  optsOrQty?: number | { qty?: number; runeQuality?: number; itemLevel?: number },
): InventoryRow {
  const id = generateInventoryItemId();
  let qty: number | undefined;
  let runeQuality: number | undefined;
  let itemLevel: number | undefined;
  if (typeof optsOrQty === 'number') {
    if (optsOrQty > 1) qty = Math.floor(optsOrQty);
  } else if (optsOrQty && typeof optsOrQty === 'object') {
    if (optsOrQty.qty != null && optsOrQty.qty > 1) qty = Math.floor(optsOrQty.qty);
    if (optsOrQty.runeQuality != null && Number.isFinite(optsOrQty.runeQuality)) {
      runeQuality = optsOrQty.runeQuality;
    }
    if (optsOrQty.itemLevel != null && Number.isFinite(optsOrQty.itemLevel)) {
      itemLevel = Math.floor(optsOrQty.itemLevel);
    }
  }
  const row: InventoryRow = { id, name: itemName };
  if (qty != null) row.qty = qty;
  if (runeQuality != null) row.runeQuality = runeQuality;
  if (itemLevel != null) row.itemLevel = itemLevel;
  return row;
}

/**
 * 전리품용: 베이스 id만 알고 이름은 가린 채 인스턴스 생성 (이름 끝에 id 일부를 붙여 명령으로 구별)
 */
export function newMysteryInventoryRow(
  mysteryItemId: string,
  opts?: { veilBlindSource?: boolean }
): InventoryRow {
  const id = generateInventoryItemId();
  const def = getItemById(mysteryItemId);
  const cat = def ? getMysteryCategoryLabel(def) : '미확인 장비';
  return {
    id,
    name: `${cat}·${id.slice(-5)}`,
    identified: false,
    mysteryItemId,
    ...(opts?.veilBlindSource ? { veilBlindSource: true as const } : {}),
  };
}

/** 구세이브 string | 신규 InventoryRow 모두 처리 */
export function invName(row: string | InventoryRow): string {
  return typeof row === 'string' ? row : row.name;
}

export function invId(row: string | InventoryRow): string {
  return typeof row === 'string' ? row : row.id;
}

/** 로드 시 string[] → InventoryRow[] (이름이 같아도 각각 다른 id) */
export function migrateInventoryFromStrings(raw: unknown): InventoryRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((cell) => {
    if (typeof cell === 'string') return newInventoryRow(cell);
    if (cell && typeof cell === 'object' && typeof (cell as InventoryRow).name === 'string') {
      const o = cell as InventoryRow;
      const rq =
        typeof o.runeQuality === 'number' && Number.isFinite(o.runeQuality) ? { runeQuality: o.runeQuality } : {};
      const il =
        typeof o.itemLevel === 'number' && Number.isFinite(o.itemLevel) ? { itemLevel: Math.floor(o.itemLevel) } : {};
      const base =
        typeof o.id === 'string' && o.id.length > 0
          ? o
          : { ...newInventoryRow(o.name), id: generateInventoryItemId(), ...rq, ...il };
      // 구세이브: identified 없으면 일반 아이템으로 간주
      if (base.identified === undefined && !base.mysteryItemId) {
        return { ...base, identified: true };
      }
      return base;
    }
    return newInventoryRow(String(cell));
  });
}

/**
 * 구세이브: equipmentUpgradeLevels / EffectiveGrade / Durability 가 itemName 키였음 →
 * 인벤 순서대로 첫 번째 동일 이름에만 이전 값 이관, 나머지는 0/없음.
 */
export function migrateEquipmentMapsByFirstOccurrence(
  inventory: InventoryRow[],
  oldUp: Record<string, number> | undefined,
  oldEff: Record<string, ItemGrade> | undefined,
  oldDur: Record<string, number> | undefined
): {
  equipmentUpgradeLevels: Record<string, number>;
  equipmentEffectiveGrade: Record<string, ItemGrade>;
  equipmentDurability: Record<string, number>;
} {
  const seen = new Set<string>();
  const equipmentUpgradeLevels: Record<string, number> = {};
  const equipmentEffectiveGrade: Record<string, ItemGrade> = {};
  const equipmentDurability: Record<string, number> = {};

  for (const row of inventory) {
    const name = row.name;
    const id = row.id;
    if (!seen.has(name)) {
      seen.add(name);
      if (oldUp && oldUp[name] !== undefined) equipmentUpgradeLevels[id] = oldUp[name];
      if (oldEff && oldEff[name] !== undefined) equipmentEffectiveGrade[id] = oldEff[name];
      if (oldDur && oldDur[name] !== undefined) equipmentDurability[id] = oldDur[name];
    } else {
      if (oldUp && oldUp[name] !== undefined) equipmentUpgradeLevels[id] = 0;
    }
  }
  return { equipmentUpgradeLevels, equipmentEffectiveGrade, equipmentDurability };
}

/**
 * 장착 슬롯: 이미 id면 유지, 아니면 이름으로 인벤에서 매칭.
 * WHY: 구세이브는 이름만 저장됨 → 첫 번째 일치하는 인스턴스 id로 연결.
 */
export function normalizeEquipSlot(slot: string | null | undefined, inventory: InventoryRow[]): string | null {
  if (!slot) return null;
  if (inventory.some((r) => r.id === slot)) return slot;
  const row = inventory.find((r) => r.name === slot);
  return row ? row.id : null;
}

/** 인벤에서 이름으로 인스턴스 id 찾기 — 강화/장착 우선순위용 */
export function findInstanceIdForItemName(
  inventory: InventoryRow[],
  itemName: string,
  equippedIds: Array<string | null | undefined>
): string | null {
  const eqSet = new Set(equippedIds.filter(Boolean) as string[]);
  const equipped = inventory.find((r) => r.name === itemName && eqSet.has(r.id));
  if (equipped) return equipped.id;
  const first = inventory.find((r) => r.name === itemName);
  return first ? first.id : null;
}
