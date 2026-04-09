/**
 * 마을 성벽 / 적대 이동 차단 / 함락·수복
 * WHY: 안전지대(마을) 앞에 물리적 성벽을 두어 적(적대 세력)은 성벽이 무너지기 전엔
 *      마을 방으로 침입할 수 없게 한다. 플레이어(비적대)는 항상 통과 가능.
 */

import { getRoomById, getZoneForRoom } from './rooms';
import { scaleCoinCost } from './economyBalance';

export interface VillageWallDef {
  /** 세이브·상태 맵 키 */
  id: string;
  /** 보호받는 마을(휴식 거점) 방 ID */
  villageRoomId: string;
  /** 성벽이 있는 관문 방 (적이 머물며 공성) */
  gateRoomId: string;
  maxHp: number;
  /** 적대 유닛(몬스터)만 막는 방향성 간선: from → to */
  blockedFrom: string;
  blockedTo: string;
}

/** 배치된 성벽 정의 (룸 ID는 rooms.ts와 일치해야 함) */
export const VILLAGE_WALLS: readonly VillageWallDef[] = [
  {
    id: 'wall_ash_port',
    villageRoomId: 'ash_port_village',
    gateRoomId: 'ash_port_wall_gate',
    maxHp: 520,
    blockedFrom: 'ash_port_wall_gate',
    blockedTo: 'ash_port_village',
  },
  {
    id: 'wall_geo',
    villageRoomId: 'geo_village_safe',
    gateRoomId: 'geo_wall_gate',
    maxHp: 580,
    blockedFrom: 'geo_wall_gate',
    blockedTo: 'geo_village_safe',
  },
] as const;

/** 구역 번호 → 공식 마을(휴식 거점) — UI·도움말용 (성벽이 없어도 기존 안전지대를 표기) */
export const ZONE_OFFICIAL_VILLAGE: ReadonlyArray<{ zone: number; roomId: string; label: string }> = [
  { zone: 1, roomId: 'clinic', label: '홍대 지하 클리닉' },
  { zone: 1, roomId: 'slum_market', label: '지하 슬럼 상점가' },
  { zone: 2, roomId: 'deep_sewer', label: '(전초) 심층 하수도 삼거리' },
  { zone: 3, roomId: 'neon_fat_stall', label: '네온 팻의 포장마차' },
  { zone: 4, roomId: 'zeros_hideout', label: '제로스의 아지트' },
  { zone: 4, roomId: 'cyber_clinic', label: 'V.I.P 크롬 시술소' },
  { zone: 5, roomId: 'hyper_bridge_entrance', label: '(거점) 하이퍼 브릿지 진입로' },
  { zone: 6, roomId: 'east_gate', label: '(전초) 동부 산업 입구' },
  { zone: 7, roomId: 'west_outpost', label: '(전초) 서부 황야지 초소' },
  { zone: 8, roomId: 'ancient_bunker', label: '그 시절의 벙커' },
  { zone: 8, roomId: 'silent_rest_area', label: '침묵의 휴식 구역' },
  { zone: 9, roomId: 'holo_market', label: '홀로 거래소' },
  { zone: 10, roomId: 'outskirt_garrison', label: '(전초) 구식 주둔지' },
  { zone: 11, roomId: 'ash_port_village', label: '잿빛 항구 마을' },
  { zone: 12, roomId: 'geo_village_safe', label: '지열 파이프 마을' },
];

export function createInitialVillageWallHp(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const w of VILLAGE_WALLS) o[w.id] = w.maxHp;
  return o;
}

export function getWallDefById(id: string): VillageWallDef | undefined {
  return VILLAGE_WALLS.find(w => w.id === id);
}

export function getWallDefForGateRoom(gateRoomId: string): VillageWallDef | undefined {
  return VILLAGE_WALLS.find(w => w.gateRoomId === gateRoomId);
}

/** 관문 또는 해당 마을 방에 있을 때 성벽 정의 조회 */
export function getWallDefForVillageOrGate(roomId: string): VillageWallDef | undefined {
  return VILLAGE_WALLS.find(w => w.gateRoomId === roomId || w.villageRoomId === roomId);
}

/** 적대 이동: 성벽 HP가 남아 있으면 관문→마을 침입 불가 */
export function isHostileMoveBlockedByWall(
  fromRoomId: string,
  toRoomId: string,
  wallHp: Record<string, number> | undefined
): boolean {
  if (!wallHp) return false;
  for (const w of VILLAGE_WALLS) {
    const hp = wallHp[w.id] ?? 0;
    if (hp <= 0) continue;
    if (w.blockedFrom === fromRoomId && w.blockedTo === toRoomId) return true;
  }
  return false;
}

/** 관문에서 마을 쪽으로 공성 가능한지 (플레이어가 마을에 있을 때만 벽을 두드림) */
export function canSiegeWallFromGate(
  gateRoomId: string,
  playerRoomId: string,
  wallHp: Record<string, number> | undefined
): VillageWallDef | null {
  const def = getWallDefForGateRoom(gateRoomId);
  if (!def) return null;
  const hp = wallHp?.[def.id] ?? 0;
  if (hp <= 0) return null;
  if (playerRoomId !== def.villageRoomId) return null;
  return def;
}

export function repairWallCost(def: VillageWallDef, currentHp: number): number {
  const missing = Math.max(0, def.maxHp - currentHp);
  return scaleCoinCost(Math.max(50, Math.floor(missing * 3)));
}

export function rebuildOccupiedVillageCost(def: VillageWallDef): number {
  return scaleCoinCost(800 + def.maxHp * 2);
}

// ─────────────────────────────────────────
// 초기 생성 허브만 절대 안전 / 그 외 안전지대는 침공·함락 가능
// WHY: [홍대 지하 클리닉]·[지하 슬럼 상점가]만 스폰 허브로 완전 비침공.
//      미로 휴식처 등 나머지 isSafe 방은 적이 들어오면 함락되고, 물리치면 휴식 가능 상태로 복구.
// ─────────────────────────────────────────

/** 세이브·BFS·함락 처리에서 동일 기준으로 사용 */
export const IMMUTABLE_SAFE_HUB_ROOM_IDS = new Set<string>(['clinic', 'slum_market']);

export function isImmutableSafeHubRoom(roomId: string): boolean {
  return IMMUTABLE_SAFE_HUB_ROOM_IDS.has(roomId);
}

/** 안전지대이면서 적 함락·침공 규칙의 대상이 되는 방 (초기 허브 2곳 제외) */
export function isSafeRoomSubjectToInvasion(roomId: string): boolean {
  const r = getRoomById(roomId);
  return !!(r?.isSafe && !IMMUTABLE_SAFE_HUB_ROOM_IDS.has(roomId));
}

/**
 * 적대 유닛 이동: 초기 허브 방으로는 절대 진입 불가
 * (과거: 구역 1 전체·구역1 내 모든 안전지대 차단 → 미로 휴식처 등이 사실상 침공 불가였음)
 */
export function isHostileMoveBlockedZone1Protection(_fromRoomId: string, toRoomId: string): boolean {
  return IMMUTABLE_SAFE_HUB_ROOM_IDS.has(toRoomId);
}

/** 성벽 없는 안전거점 탈환 비용 (구역이 높을수록 약간 비쌈) */
export function rebuildOpenSafeVillageOccupiedCost(roomId: string): number {
  const z = getZoneForRoom(roomId);
  return scaleCoinCost(480 + z * 90);
}

/** 세이브 호환: 초기 허브 2곳은 절대 함락 상태로 남기지 않음 */
export function sanitizeVillageOccupiedForImmutableZone1(
  occ: Record<string, boolean> | undefined
): Record<string, boolean> {
  const out: Record<string, boolean> = { ...(occ || {}) };
  for (const hubId of IMMUTABLE_SAFE_HUB_ROOM_IDS) {
    if (out[hubId]) delete out[hubId];
  }
  return out;
}
