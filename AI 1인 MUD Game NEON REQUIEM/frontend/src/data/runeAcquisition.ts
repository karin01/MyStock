/**
 * 룬 인벤 지급·미로 3구역 최초 보상·보스 드랍·조사 복구 등 획득 경로 정리
 * WHY: runes.ts는 정의만 담고, 획득/연출 문자열은 여기서 한곳에 모은다.
 */

import { RUNE_DATA, RUNES_BY_ID, type RuneId } from './runes';
import { clampRuneQuality, DEFAULT_RUNE_QUALITY } from './runeQuality';
import type { InventoryRow } from '../utils/inventoryHelpers';

/** 인벤에 쌓이는 룬 아이템 표기 (장착 명령은 별칭으로도 매칭 가능) */
export const RUNE_ITEM_NAME_PREFIX = '룬 각인 — ';

export function getRuneInventoryItemName(runeId: RuneId): string {
  return `${RUNE_ITEM_NAME_PREFIX}${RUNES_BY_ID[runeId].displayName}`;
}

/** 인벤 행 이름 → RuneId (룬 각인 아이템만) */
export function parseRuneInventoryItemName(name: string): RuneId | null {
  if (!name.startsWith(RUNE_ITEM_NAME_PREFIX)) return null;
  const tail = name.slice(RUNE_ITEM_NAME_PREFIX.length).trim();
  for (const r of RUNE_DATA) {
    if (r.displayName === tail) return r.id;
  }
  return null;
}

export const ALL_RUNE_IDS: RuneId[] = RUNE_DATA.map((r) => r.id);

export function rollRandomRuneId(): RuneId {
  return ALL_RUNE_IDS[Math.floor(Math.random() * ALL_RUNE_IDS.length)]!;
}

/**
 * 직업별 추천 1룬 — 미로 3구역 최초 돌파 기본 지급용
 * WHY: 빌드 입문을 돕기 위해 직업 컨셉과 맞는 룬을 고정 매핑한다.
 */
export function getDefaultRuneIdForJob(jobName: string): RuneId {
  switch (jobName) {
    case '전사':
      return 'berserker';
    case '성직자':
      return 'paladin';
    case '마법사':
      return 'war_mage';
    case '도적':
      return 'assassin';
    case '로그':
      return 'tracker';
    default:
      return 'sage';
  }
}

/** 심층 미로에서 이름이 붙은 「미로 3구역」 방 ID */
export const MAZE_ZONE3_ROOM_ID = 'maze_s4';

export type FirstRuneCheckResult = {
  runeId: RuneId;
  itemName: string;
  systemMessage: string;
  neonLog: string;
};

/**
 * 플레이어가 처음으로 미로 3구역(maze_s4)에 들어왔을 때 지급할 룬 정보.
 * 이미 지급됐으면 null. (상태 갱신은 호출부 setPlayerState에서 처리)
 */
export function checkFirstRune(
  nextRoomId: string,
  story: { grantedMazeZone3FirstRune?: boolean },
  jobName: string | undefined,
): FirstRuneCheckResult | null {
  if (nextRoomId !== MAZE_ZONE3_ROOM_ID) return null;
  if (story.grantedMazeZone3FirstRune) return null;
  const runeId = getDefaultRuneIdForJob(jobName ?? '');
  const itemName = getRuneInventoryItemName(runeId);
  const def = RUNES_BY_ID[runeId];
  const systemMessage = `[SYSTEM] 미로 3구역(심층) 최초 돌파 — 신경망에 직업 동기화 룬이 할당되었습니다. 인벤토리: [${itemName}] (Lv.${21} 이상 시 「룬 장착 ${def.displayName}」)`;
  return {
    runeId,
    itemName,
    systemMessage,
    neonLog: buildNeonRuneLog(runeId, 'gain'),
  };
}

/** 네온 박스 로그 마커 — Console.tsx에서 전용 렌더 */
export const NEON_RUNE_LOG_MARKER = '@@NEON_RUNE@@';

/** App.tsx 최종 setLogs에서 본문과 네온 박스를 둘 다 넣기 위한 구분자 */
export const RUNE_LOG_SPLIT = '__SPLIT_RUNE_NEON__';

/** 룬별 테두리 색(네온) + 획득/장착 멘트 */
export const RUNE_NEON_META: Record<
  RuneId,
  { border: string; gainLine: string; equipLine: string }
> = {
  berserker: {
    border: '#ff3355',
    gainLine: '당신의 영혼에 피의 굶주림이 각인됩니다.',
    equipLine: '신경 가속기가 분노의 주파수에 동조합니다.',
  },
  paladin: {
    border: '#ffd54a',
    gainLine: '정제된 빛이 회로막을 따라 흐릅니다.',
    equipLine: '심판 프로토콜이 가동 대기 상태로 올라섰습니다.',
  },
  assassin: {
    border: '#b388ff',
    gainLine: '그림자 각인이 맥박 사이에 숨습니다.',
    equipLine: '치명각이 시야 가장자리에 겹쳐집니다.',
  },
  sage: {
    border: '#4fc3f7',
    gainLine: '고요한 데이터의 숨결이 MP 흐름에 스며듭니다.',
    equipLine: '현자의 루프가 마나 재생을 증폭합니다.',
  },
  tracker: {
    border: '#69f0ae',
    gainLine: '표적 서명이 망막 HUD에 오버레이됩니다.',
    equipLine: '추적자 안테나가 사거리 한 칸을 확장합니다.',
  },
  necromancer: {
    border: '#9e9e9e',
    gainLine: '죽은 자의 잔향이 손끝에 맴돕니다.',
    equipLine: '영혼 파이프라인이 교전 모드로 연결되었습니다.',
  },
  gladiator: {
    border: '#ff8a65',
    gainLine: '투기장의 함성이 근접 타격에 스며듭니다.',
    equipLine: '검투사의 리듬이 룬 카운터와 합주합니다.',
  },
  guardian: {
    border: '#90caf9',
    gainLine: '무거운 방벽이 척추를 따라 내려앉습니다.',
    equipLine: '수호 매트릭스가 최대 HP와 방어를 봉인합니다.',
  },
  wind_sage: {
    border: '#18ffff',
    gainLine: '바람의 홀로그램이 발밑에 깔립니다.',
    equipLine: '대시 노드가 회피율을 끌어올립니다.',
  },
  alchemist: {
    border: '#ceff6a',
    gainLine: '독소 합성식이 혈관에 스캔됩니다.',
    equipLine: '연금 룬이 화살과 포션에 말독을 번집니다.',
  },
  gambler: {
    border: '#ffeb3b',
    gainLine: '확률의 주사위가 동전 뒤에서 굴러갑니다.',
    equipLine: '도박사의 룬이 전리품과 COIN을 도박합니다.',
  },
  soul_binder: {
    border: '#e1bee7',
    gainLine: '영혼 결속이 경험치 손실을 거부합니다.',
    equipLine: '소울 링크가 사망 페널티를 흡수합니다.',
  },
  war_mage: {
    border: '#7c4dff',
    gainLine: '폭발하는 마나가 시냅스를 태웁니다.',
    equipLine: '오버로드 채널이 마법 치명을 증폭합니다.',
  },
  shield_preacher: {
    border: '#5c6bc0',
    gainLine: '철의 설교가 방패에 반사 회로를 새깁니다.',
    equipLine: '철벽전도사의 룬이 반사 피해를 준비합니다.',
  },
  shadow_illusionist: {
    border: '#9575cd',
    gainLine: '허상의 겹이 은신 지속을 늘립니다.',
    equipLine: '그림자술사의 미라지가 적의 명중을 흐립니다.',
  },
};

export type NeonRuneMode = 'gain' | 'equip';

export function buildNeonRuneLog(runeId: RuneId, mode: NeonRuneMode): string {
  const def = RUNES_BY_ID[runeId];
  const meta = RUNE_NEON_META[runeId];
  const flavor = mode === 'gain' ? meta.gainLine : meta.equipLine;
  const head = mode === 'gain' ? '룬 획득' : '룬 장착 동기화';
  return [
    NEON_RUNE_LOG_MARKER,
    meta.border,
    `「${def.displayName}」 ${head}`,
    flavor,
    `· 패시브: ${def.passiveShort}`,
    `· 전용 스킬: 「${def.skillKo}」`,
  ].join('\n');
}

/** 보스 처치 시 룬 드랍 안내(로그 한 줄) — ANSI 강조 */
export const BOSS_RUNE_DROP_RARE_LINE =
  '\u001b[93m\u001b[1m[희귀] 바닥에서 신비롭게 빛나는 룬 조각을 발견했습니다!\u001b[0m';

/** 조사로 훼손 룬 복구 시도 가능한 방 (아주 낮은 확률) */
export const RUNE_SEARCH_RESTORE_ROOM_IDS = new Set<string>([
  'data_center',
  'heavy_storage',
  'ghost_terminal',
  'maze_seal_vestibule',
  'bulk_terminal_vault',
]);

/** 조사 시 훼손 데이터 룬 복구 확률 */
export const RUNE_SEARCH_RESTORE_CHANCE = 0.018;

/** 인벤에 같은 룬이 여러 개면 가장 높은 품질로 장착 효율을 맞춘다. */
export function pickBestInventoryRuneQualityForRuneId(inv: InventoryRow[], runeId: RuneId): number {
  const name = getRuneInventoryItemName(runeId);
  let best = DEFAULT_RUNE_QUALITY;
  for (const r of inv) {
    if (r.name !== name) continue;
    if (r.runeQuality != null && Number.isFinite(Number(r.runeQuality))) {
      best = Math.max(best, clampRuneQuality(Number(r.runeQuality)));
    }
  }
  return best;
}
