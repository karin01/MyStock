// 로컬 미니맵 컴포넌트
// WHY: 87개 방 전부를 렌더링하면 노드가 빽빽하게 겹쳐보인다.
// BFS로 현재 방 주변 N칸 이내 방만 렌더링하고, 한 번 보인 방은 일정 거리까지 유지해 이동 시 미니맵이 갑자기 바뀌지 않게 한다.
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ROOMS, OPPOSITE_DIR, getExitsInDisplayOrder, type Room } from '../data/rooms';

interface MapPanelProps {
  currentRoomId: string;
  rooms?: Room[];
  /** 안전거점 함락 상태 표시용 */
  villageOccupied?: Record<string, boolean>;
  /**
   * compact: 좁은 사이드바·작은 뷰포트
   * comfortable: 우측 패널 등 — compact보다 셀·간격만 약간 크게 (과대 방지)
   */
  density?: 'compact' | 'comfortable';
}

// BFS로 현재 방에서 최대 depth 거리 이내의 방 ID 세트를 반환
function getVisibleRooms(startId: string, depth: number): Map<string, number> {
  const visited = new Map<string, number>(); // roomId → distance
  const queue: Array<{ id: string; d: number }> = [{ id: startId, d: 0 }];
  while (queue.length > 0) {
    const { id, d } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.set(id, d);
    if (d >= depth) continue;
    const room = ROOMS.find(r => r.id === id);
    if (!room) continue;
    Object.values(room.exits).forEach(nextId => {
      if (nextId && !visited.has(nextId)) {
        queue.push({ id: nextId, d: d + 1 });
      }
    });
  }
  return visited;
}

// 기본 셀 크기 — density에 따라 컴포넌트 내부에서 덮어씀
const CELL_W_DEFAULT = 90;
const CELL_H_DEFAULT = 40;
const GAP_DEFAULT = 20; // 노드 겹침 방지용 간격
// 탐색 반경: 현재 방 기준으로 이만큼까지 새로 추가
const VISIBLE_DEPTH = 3;
// 한 번 보인 방을 유지하는 거리 — 이 거리 밖이 되면 미니맵에서 제거 (이동해도 맵이 갑자기 안 바뀜)
const PERSISTENT_DEPTH = 6;

/** 노드 중심에서 방향(dirX, dirY)으로 나가는 반직선이 사각형 테두리와 만나는 점 반환 — 선이 글자 위를 지나지 않도록 */
function rayToRectEdge(
  centerX: number, centerY: number, dirX: number, dirY: number,
  rectX: number, rectY: number, rectW: number, rectH: number
): { x: number; y: number } {
  const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
  const ux = dirX / len;
  const uy = dirY / len;
  let tMin = Infinity;
  if (ux !== 0) {
    const tL = (rectX - centerX) / ux;
    if (tL > 0) {
      const py = centerY + tL * uy;
      if (py >= rectY && py <= rectY + rectH) tMin = Math.min(tMin, tL);
    }
    const tR = (rectX + rectW - centerX) / ux;
    if (tR > 0) {
      const py = centerY + tR * uy;
      if (py >= rectY && py <= rectY + rectH) tMin = Math.min(tMin, tR);
    }
  }
  if (uy !== 0) {
    const tT = (rectY - centerY) / uy;
    if (tT > 0) {
      const px = centerX + tT * ux;
      if (px >= rectX && px <= rectX + rectW) tMin = Math.min(tMin, tT);
    }
    const tB = (rectY + rectH - centerY) / uy;
    if (tB > 0) {
      const px = centerX + tB * ux;
      if (px >= rectX && px <= rectX + rectW) tMin = Math.min(tMin, tB);
    }
  }
  if (tMin === Infinity) return { x: centerX + ux * rectW, y: centerY + uy * rectH };
  return { x: centerX + tMin * ux, y: centerY + tMin * uy };
}

const MapPanel: React.FC<MapPanelProps> = ({ currentRoomId, villageOccupied, density = 'compact' }) => {
  // comfortable: 넓은 패널용이나 과하게 크면 스크롤·여백만 커짐 → compact보다만 살짝 크게 유지
  const cellW = density === 'comfortable' ? 96 : CELL_W_DEFAULT;
  const cellH = density === 'comfortable' ? 44 : CELL_H_DEFAULT;
  const gap = density === 'comfortable' ? 18 : GAP_DEFAULT;
  const nodeTextClass = 'text-[9px]';

  // 한 번 보인 방을 PERSISTENT_DEPTH 안에 있는 동안 유지 → 한 칸 이동해도 미니맵이 갑자기 바뀌지 않음
  const [persistentIds, setPersistentIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const near = getVisibleRooms(currentRoomId, VISIBLE_DEPTH);
    const keepRange = getVisibleRooms(currentRoomId, PERSISTENT_DEPTH);
    const keepSet = new Set(keepRange.keys());
    setPersistentIds(prev => {
      const next = new Set<string>([...prev].filter(id => keepSet.has(id)));
      near.forEach((_, id) => next.add(id));
      return next;
    });
  }, [currentRoomId]);

  const { visibleSet, rooms, minX, minY, totalW, totalH, overlapOffsets } = useMemo(() => {
    // 1. 보여줄 방 목록 = 유지 세트 (거리는 PERSISTENT_DEPTH 기준으로 계산해 투명도에 사용)
    const distMap = getVisibleRooms(currentRoomId, PERSISTENT_DEPTH);
    const visibleSet = new Map<string, number>();
    persistentIds.forEach(id => visibleSet.set(id, distMap.get(id) ?? PERSISTENT_DEPTH));
    const rooms = ROOMS.filter(r => persistentIds.has(r.id));

    if (rooms.length === 0) return { visibleSet, rooms, minX: 0, minY: 0, totalW: 100, totalH: 100, overlapOffsets: new Map<string, { x: number; y: number }>() };

    // 2. 같은 (mapX, mapY)에 여러 방이 있으면 겹치므로, 셀별로 인덱스 부여 후 원형으로 오프셋
    const key = (r: Room) => `${r.mapX},${r.mapY}`;
    const byCell = new Map<string, Room[]>();
    rooms.forEach(r => {
      const k = key(r);
      if (!byCell.has(k)) byCell.set(k, []);
      byCell.get(k)!.push(r);
    });
    const overlapOffsets = new Map<string, { x: number; y: number }>();
    const radius = Math.min(cellW, cellH) * 0.45;
    byCell.forEach((list) => {
      if (list.length <= 1) return;
      list.forEach((r, i) => {
        const angle = (i / list.length) * 2 * Math.PI - Math.PI / 2;
        overlapOffsets.set(r.id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
      });
    });

    // 3. 좌표 범위 계산 (오프셋 반영해 여유 확보)
    const xs = rooms.map(r => r.mapX);
    const ys = rooms.map(r => r.mapY);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const totalW = cols * cellW + (cols - 1) * gap;
    const totalH = rows * cellH + (rows - 1) * gap;

    return { visibleSet, rooms, minX, minY, totalW, totalH, overlapOffsets };
  }, [currentRoomId, persistentIds, cellW, cellH, gap]);

  // 현재 방을 미니맵 스크롤 영역 중앙 근처에 오도록 자동 스크롤
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || rooms.length === 0) return;
    const current = rooms.find(r => r.id === currentRoomId);
    if (!current) return;

    const baseX = (current.mapX - minX) * (cellW + gap);
    const baseY = (current.mapY - minY) * (cellH + gap);
    const off = overlapOffsets.get(current.id);
    const x = baseX + (off?.x ?? 0);
    const y = baseY + (off?.y ?? 0);
    const centerX = x + cellW / 2;
    const centerY = y + cellH / 2;

    const targetScrollLeft = Math.max(0, centerX - container.clientWidth / 2);
    const targetScrollTop = Math.max(0, centerY - container.clientHeight / 2);

    container.scrollTo({
      left: targetScrollLeft,
      top: targetScrollTop,
      behavior: 'smooth',
    });
  }, [currentRoomId, rooms, minX, minY, overlapOffsets, cellW, cellH, gap]);

  // 방의 캔버스 상 픽셀 위치 계산 (같은 셀 겹침 시 오프셋 적용)
  const cellPos = (room: Room) => {
    const baseX = (room.mapX - minX) * (cellW + gap);
    const baseY = (room.mapY - minY) * (cellH + gap);
    const off = overlapOffsets.get(room.id);
    return {
      x: baseX + (off?.x ?? 0),
      y: baseY + (off?.y ?? 0),
    };
  };

  // comfortable: 부모 카드가 높이를 제한하므로 여기서는 flex로 채움만 (이중 max-h로 잘리지 않게)
  const scrollMaxHClass =
    density === 'comfortable' ? 'min-h-[168px]' : 'max-h-[min(200px,26vh)]';

  return (
    <div
      className={`bg-[#070a14] border border-[#0ddff2]/25 rounded-lg font-mono ${
        density === 'comfortable' ? 'flex flex-col min-h-0 h-full p-2' : 'p-2'
      }`}
    >
      {/* 헤더 — comfortable에서는 라벨을 명시해 빈 시안 바로 오해되지 않게 */}
      <div
        className={`text-[#0ddff2] tracking-widest mb-1.5 pb-1 border-b border-[#0ddff2]/20 flex justify-between items-center shrink-0 ${
          density === 'comfortable' ? 'text-[11px]' : 'text-[10px]'
        }`}
      >
        <span>
          {density === 'comfortable' ? '주변 지도' : 'MINI-MAP'}{' '}
          <span className="opacity-50 text-[8px] font-normal">(반경 {VISIBLE_DEPTH}칸)</span>
        </span>
        <span className="opacity-50 text-[8px]">탐색</span>
      </div>

      {/* 맵 영역 — comfortable: 반쪽 화면용으로 스크롤 높이·셀 크기 확대 */}
      <div
        ref={scrollRef}
        className={`relative overflow-auto ${scrollMaxHClass} ${
          density === 'comfortable' ? 'flex-1 min-h-0' : ''
        }`}
      >
        <div style={{ position: 'relative', width: totalW, height: totalH, margin: '4px auto' }}>

          {/* 연결선 SVG 레이어 */}
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: totalW, height: totalH, pointerEvents: 'none' }}
            viewBox={`0 0 ${totalW} ${totalH}`}
          >
            {rooms.map(room => {
              // 현재 방에서 나가는 출구만 선으로 표시 — 다른 방→현재 방 연결은 그리지 않아 출구 목록과 미니맵이 항상 일치
              if (room.id !== currentRoomId) return null;
              const { x: cx, y: cy } = cellPos(room);
              const cxMid = cx + cellW / 2;
              const cyMid = cy + cellH / 2;
              return getExitsInDisplayOrder(room.exits).map(dir => {
                const targetId = room.exits[dir as '북'|'남'|'동'|'서'];
                if (!targetId || !visibleSet.has(targetId)) return null;
                const target = ROOMS.find(r => r.id === targetId);
                if (!target) return null;
                const oppositeDir = OPPOSITE_DIR[dir as keyof typeof OPPOSITE_DIR];
                if (oppositeDir && target.exits[oppositeDir as '북'|'남'|'동'|'서'] !== room.id) return null;
                // 격자상 "동쪽/서쪽"으로만 뻗는 선은, 실제로 그 방향 출구가 있을 때만 그림 — "남·북"만 있으면 동쪽으로 가는 선만 숨김
                const dx = target.mapX - room.mapX;
                const dy = target.mapY - room.mapY;
                const goesMostlyRight = dx > 0 && Math.abs(dx) >= Math.abs(dy);
                const goesMostlyLeft = dx < 0 && Math.abs(dx) >= Math.abs(dy);
                if (goesMostlyRight && dir !== '동') return null;
                if (goesMostlyLeft && dir !== '서') return null;
                const { x: tx, y: ty } = cellPos(target);
                const txMid = tx + cellW / 2;
                const tyMid = ty + cellH / 2;
                // 선을 노드 가장자리에서 시작·끝나게 해 글자와 겹치지 않도록
                const dirX = txMid - cxMid;
                const dirY = tyMid - cyMid;
                const start = rayToRectEdge(cxMid, cyMid, dirX, dirY, cx, cy, cellW, cellH);
                const end = rayToRectEdge(txMid, tyMid, -dirX, -dirY, tx, ty, cellW, cellH);
                return (
                  <line
                    key={`${room.id}-${dir}`}
                    x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                    stroke="rgba(13,223,242,0.4)"
                    strokeWidth={density === 'comfortable' ? 1.5 : 2}
                    strokeDasharray="4 2"
                  />
                );
              });
            })}
          </svg>

          {/* 방 노드 */}
          {rooms.map(room => {
            const isCurrent = room.id === currentRoomId;
            const dist = visibleSet.get(room.id) ?? 0;
            const isSafe = room.isSafe;
            const isOccupiedSafe = !!(isSafe && villageOccupied?.[room.id]);
            const { x, y } = cellPos(room);

            // 거리에 따라 불투명도 조정 (멀수록 희미하게)
            const opacity = isCurrent ? 1 : Math.max(0.35, 1 - dist * 0.2);

            return (
              <div
                key={room.id}
                title={`${room.name} (거리: ${dist})`}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: cellW,
                  height: cellH,
                  opacity,
                }}
                className={`
                  flex items-center justify-center rounded font-bold text-center leading-tight
                  transition-all duration-300 px-1
                  ${nodeTextClass}
                  ${isCurrent
                    ? 'bg-[#0ddff2]/20 border-2 border-[#0ddff2] text-[#0ddff2] shadow-[0_0_10px_rgba(13,223,242,0.7)] z-10'
                    : isOccupiedSafe
                    ? 'bg-red-600/15 border border-red-500/60 text-red-300/90 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                    : isSafe
                    ? 'bg-green-500/10 border border-green-400/40 text-green-400/80'
                    : 'bg-white/5 border border-white/15 text-white/50'}
                `}
              >
                {isCurrent && <span className="absolute top-1 left-1 text-[#39ff14] text-[6px] animate-pulse">●</span>}
                <span className="line-clamp-2">
                  {['slum_market', 'holo_market', 'neon_fat_stall', 'clinic', 'chrome_clinic_pro'].includes(room.id) && <span className="text-[#f2a50d]">💰 </span>}
                  {room.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 범례 */}
      <div
        className={`flex flex-wrap gap-2 sm:gap-3 mt-1.5 pt-1.5 border-t border-white/10 font-bold shrink-0 ${
          density === 'comfortable' ? 'text-[9px] tracking-wide' : 'text-[8px] uppercase tracking-tighter'
        }`}
      >
        <span className="text-[#0ddff2]">● 현재</span>
        <span className="text-green-400/80">□ 안전</span>
        <span className="text-red-300/90">□ 함락</span>
        <span className="text-white/50">□ 위험</span>
        <span className="text-zinc-500 ml-auto">{VISIBLE_DEPTH}-hop 이내</span>
      </div>
    </div>
  );
};

export default MapPanel;
