/**
 * 구역 1을 배회하는 익명 현상금 NPC — 이동 후 랜덤 보상·추적자 룬 방향 힌트
 * WHY: 탐험 동기와 [추적자] 룬의 비전투 유틸을 연결한다.
 */

import { getRoomById, getZoneForRoom, ROOMS } from './rooms';

export type BountyNpcState = {
  id: string;
  displayName: string;
  roomId: string;
  creditReward: number;
};

const BOUNTY_DISPLAY_NAMES = [
  '익명 청부 에이전트',
  '데이터 헌터 "제로"',
  '네온 추격자',
  '회로 사냥꾼',
  '블랙마켓 바운티',
];

/** 구역 1에서 이동 가능한 방 id (출구가 있는 방만) */
export function getZone1WanderRoomIds(): string[] {
  const out: string[] = [];
  for (const r of ROOMS) {
    if (getZoneForRoom(r.id) !== 1) continue;
    if (!r.exits || Object.keys(r.exits).length === 0) continue;
    out.push(r.id);
  }
  return out;
}

export function rollNewBountyNpc(pool: string[]): BountyNpcState | null {
  if (pool.length === 0) return null;
  const roomId = pool[Math.floor(Math.random() * pool.length)]!;
  const creditReward = 70 + Math.floor(Math.random() * 160);
  return {
    id: `bounty_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
    displayName: BOUNTY_DISPLAY_NAMES[Math.floor(Math.random() * BOUNTY_DISPLAY_NAMES.length)]!,
    roomId,
    creditReward,
  };
}

/** 인접 방 중 풀에 속한 곳으로 1스텝 무작위 이동 */
export function wanderBountyNpcOneStep(
  state: BountyNpcState,
  validRoomIds: Set<string>,
): BountyNpcState {
  const room = getRoomById(state.roomId);
  if (!room?.exits) return state;
  const neighbors = Object.values(room.exits)
    .map(String)
    .filter((id) => validRoomIds.has(id));
  if (neighbors.length === 0) return state;
  const nextRoomId = neighbors[Math.floor(Math.random() * neighbors.length)]!;
  return { ...state, roomId: nextRoomId };
}

/**
 * 플레이어가 보는 출구(기본 맵 연결)만으로 BFS — 숨겨진 출구는 추적에 포함하지 않음.
 * WHY: 아직 발견하지 않은 비밀 통로를 "감지"하면 스포일이 된다.
 */
export function getShortestStepTowardRoomRaw(
  fromRoomId: string,
  targetRoomId: string,
  maxDepth: number,
): string | null {
  if (fromRoomId === targetRoomId) return null;
  const visited = new Set<string>([fromRoomId]);
  const queue: Array<{ roomId: string; firstStep: string; depth: number }> = [];
  const startRoom = getRoomById(fromRoomId);
  const startExits = startRoom?.exits || {};
  Object.values(startExits).forEach((nId) => {
    const next = String(nId);
    if (visited.has(next)) return;
    visited.add(next);
    queue.push({ roomId: next, firstStep: next, depth: 1 });
  });
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.roomId === targetRoomId) return node.firstStep;
    if (node.depth >= maxDepth) continue;
    const r = getRoomById(node.roomId);
    const exits = r?.exits || {};
    Object.values(exits).forEach((nId) => {
      const next = String(nId);
      if (visited.has(next)) return;
      visited.add(next);
      queue.push({ roomId: next, firstStep: node.firstStep, depth: node.depth + 1 });
    });
  }
  return null;
}

/** fromRoom에서 첫 스텝 방이 어느 방향(북남동서)인지 — 없으면 null */
export function getDirectionTowardAdjacentRoom(
  fromRoomId: string,
  adjacentRoomId: string,
): '북' | '남' | '동' | '서' | null {
  const room = getRoomById(fromRoomId);
  if (!room?.exits) return null;
  for (const [dir, rid] of Object.entries(room.exits)) {
    if (String(rid) === adjacentRoomId && ['북', '남', '동', '서'].includes(dir)) {
      return dir as '북' | '남' | '동' | '서';
    }
  }
  return null;
}

/** 추적자 룬용 한 줄 힌트 */
export function formatBountyTrackerHint(
  playerRoomId: string,
  bounty: BountyNpcState,
  maxDepth = 520,
): string {
  if (playerRoomId === bounty.roomId) {
    return '📡 [추적자 룬] 현상금 계약자의 신호가 이 구역에서 매우 강합니다. 바로 근처에 있습니다.';
  }
  const firstHop = getShortestStepTowardRoomRaw(playerRoomId, bounty.roomId, maxDepth);
  if (!firstHop) {
    return '📡 [추적자 룬] 현상금 목표의 신호가 너무 약하거나, 이 구역 밖에 있는 것 같습니다.';
  }
  const dir = getDirectionTowardAdjacentRoom(playerRoomId, firstHop);
  if (!dir) {
    return '📡 [추적자 룬] 신호는 잡히지만 방향 환각이 심합니다. 통로 구조가 비정상일 수 있습니다.';
  }
  return `📡 [추적자 룬] 익명 바운티의 잔향이 [${dir}]쪽 통로 쪽으로 희미하게 이어집니다.`;
}

/**
 * 이동 직후: 만남 처리 → 스폰 → 배회 순.
 * WHY: 같은 방에 들어오면 먼저 보상 후, NPC는 다음 위치로 옮긴다.
 */
export function resolveBountyNpcAfterPlayerMove(args: {
  prevBounty: BountyNpcState | null | undefined;
  enteredRoomId: string;
  prevCredit: number;
  wanderPool: string[];
}): { bountyNpc: BountyNpcState | null; credit: number; logs: string[] } {
  const logs: string[] = [];
  const poolSet = new Set(args.wanderPool);
  let bounty = args.prevBounty ?? null;
  let credit = args.prevCredit || 0;

  if (bounty && bounty.roomId === args.enteredRoomId) {
    credit += bounty.creditReward;
    logs.push(
      `💰 [현상금] [${bounty.displayName}]와(과) 엇갈리며 데이터 페넌트를 확보했다! (+${bounty.creditReward} COIN)`,
    );
    bounty = null;
  }

  if (!bounty && getZoneForRoom(args.enteredRoomId) === 1 && args.wanderPool.length > 0 && Math.random() < 0.042) {
    bounty = rollNewBountyNpc(args.wanderPool);
    if (bounty && bounty.roomId === args.enteredRoomId) {
      credit += bounty.creditReward;
      logs.push(
        `💰 [현상금] 방금 등록된 계약자 [${bounty.displayName}]를 그 자리에서 포착! (+${bounty.creditReward} COIN)`,
      );
      bounty = null;
    }
  }

  if (bounty && poolSet.size > 0) {
    bounty = wanderBountyNpcOneStep(bounty, poolSet);
  }

  return { bountyNpc: bounty, credit, logs };
}
