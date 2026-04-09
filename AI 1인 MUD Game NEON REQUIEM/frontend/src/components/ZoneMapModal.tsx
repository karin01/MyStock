// 전체 구역 지도 — 미니맵과 달리 동일 world_zone(또는 벌크 한 줄)의 모든 방을 표시
import React, { useMemo, useEffect, useRef } from 'react';
import type { Room } from '../data/roomTypes';
import { OPPOSITE_DIR, getExitsInDisplayOrder } from '../data/rooms';

export interface ZoneMapModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  rooms: Room[];
  currentRoomId: string;
}

function rayToRectEdge(
  centerX: number,
  centerY: number,
  dirX: number,
  dirY: number,
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
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

const ZoneMapModal: React.FC<ZoneMapModalProps> = ({ open, onClose, title, rooms, currentRoomId }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { cellW, cellH, gap, roomsFiltered, minX, minY, totalW, totalH, overlapOffsets, idSet } = useMemo(() => {
    const n = rooms.length;
    const cellW = n > 100 ? 44 : n > 55 ? 52 : n > 30 ? 64 : 72;
    const cellH = n > 100 ? 22 : n > 55 ? 26 : n > 30 ? 30 : 34;
    const gap = n > 100 ? 8 : 12;
    const idSet = new Set(rooms.map((r) => r.id));
    const roomsFiltered = rooms.filter((r) => idSet.has(r.id));

    if (roomsFiltered.length === 0) {
      return {
        cellW,
        cellH,
        gap,
        roomsFiltered: [],
        minX: 0,
        minY: 0,
        totalW: 120,
        totalH: 120,
        overlapOffsets: new Map<string, { x: number; y: number }>(),
        idSet,
      };
    }

    const key = (r: Room) => `${r.mapX},${r.mapY}`;
    const byCell = new Map<string, Room[]>();
    roomsFiltered.forEach((r) => {
      const k = key(r);
      if (!byCell.has(k)) byCell.set(k, []);
      byCell.get(k)!.push(r);
    });
    const overlapOffsets = new Map<string, { x: number; y: number }>();
    const radius = Math.min(cellW, cellH) * 0.42;
    byCell.forEach((list) => {
      if (list.length <= 1) return;
      list.forEach((r, i) => {
        const angle = (i / list.length) * 2 * Math.PI - Math.PI / 2;
        overlapOffsets.set(r.id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
      });
    });

    const xs = roomsFiltered.map((r) => r.mapX);
    const ys = roomsFiltered.map((r) => r.mapY);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const totalW = cols * cellW + (cols - 1) * gap;
    const totalH = rows * cellH + (rows - 1) * gap;

    return { cellW, cellH, gap, roomsFiltered, minX, minY, totalW, totalH, overlapOffsets, idSet };
  }, [rooms]);

  const cellPos = (room: Room) => {
    const baseX = (room.mapX - minX) * (cellW + gap);
    const baseY = (room.mapY - minY) * (cellH + gap);
    const off = overlapOffsets.get(room.id);
    return { x: baseX + (off?.x ?? 0), y: baseY + (off?.y ?? 0) };
  };

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !scrollRef.current || roomsFiltered.length === 0) return;
    const current = roomsFiltered.find((r) => r.id === currentRoomId);
    if (!current) return;
    const container = scrollRef.current;
    const baseX = (current.mapX - minX) * (cellW + gap);
    const baseY = (current.mapY - minY) * (cellH + gap);
    const off = overlapOffsets.get(current.id);
    const x = baseX + (off?.x ?? 0);
    const y = baseY + (off?.y ?? 0);
    const cx = x + cellW / 2;
    const cy = y + cellH / 2;
    container.scrollTo({
      left: Math.max(0, cx - container.clientWidth / 2),
      top: Math.max(0, cy - container.clientHeight / 2),
      behavior: 'smooth',
    });
  }, [open, currentRoomId, roomsFiltered, minX, minY, cellW, cellH, gap, overlapOffsets]);

  if (!open) return null;

  const lines: React.ReactNode[] = [];
  const drawn = new Set<string>();
  for (const room of roomsFiltered) {
    for (const dir of getExitsInDisplayOrder(room.exits)) {
      const targetId = room.exits[dir as '북' | '남' | '동' | '서'];
      if (!targetId || !idSet.has(targetId)) continue;
      const edgeKey = room.id < targetId ? `${room.id}|${targetId}` : `${targetId}|${room.id}`;
      if (drawn.has(edgeKey)) continue;
      drawn.add(edgeKey);
      const target = roomsFiltered.find((r) => r.id === targetId);
      if (!target) continue;
      const oppositeDir = OPPOSITE_DIR[dir as keyof typeof OPPOSITE_DIR];
      if (oppositeDir && target.exits[oppositeDir as '북' | '남' | '동' | '서'] !== room.id) continue;

      const { x: cx, y: cy } = cellPos(room);
      const { x: tx, y: ty } = cellPos(target);
      const cxMid = cx + cellW / 2;
      const cyMid = cy + cellH / 2;
      const txMid = tx + cellW / 2;
      const tyMid = ty + cellH / 2;
      const dx = target.mapX - room.mapX;
      const dy = target.mapY - room.mapY;
      const goesMostlyRight = dx > 0 && Math.abs(dx) >= Math.abs(dy);
      const goesMostlyLeft = dx < 0 && Math.abs(dx) >= Math.abs(dy);
      if (goesMostlyRight && dir !== '동') continue;
      if (goesMostlyLeft && dir !== '서') continue;
      const dirX = txMid - cxMid;
      const dirY = tyMid - cyMid;
      const start = rayToRectEdge(cxMid, cyMid, dirX, dirY, cx, cy, cellW, cellH);
      const end = rayToRectEdge(txMid, tyMid, -dirX, -dirY, tx, ty, cellW, cellH);
      lines.push(
        <line
          key={edgeKey}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="rgba(13,223,242,0.35)"
          strokeWidth={1.25}
          strokeDasharray="3 2"
        />,
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="구역 지도"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl border border-[#0ddff2]/40 bg-[#060810] shadow-[0_0_40px_rgba(13,223,242,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#0ddff2]/25 px-4 py-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#0ddff2]/90">구역 지도</div>
            <div className="text-sm font-medium text-zinc-200">{title}</div>
            <div className="mt-0.5 text-[10px] text-zinc-500">
              방 {roomsFiltered.length}개 · ESC 또는 바깥 클릭으로 닫기 · 입력창에 포커스가 없을 때 <kbd className="rounded border border-zinc-600 px-1">M</kbd>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10"
          >
            닫기
          </button>
        </div>

        <div ref={scrollRef} className="min-h-[50vh] max-h-[min(78vh,720px)] flex-1 overflow-auto p-3">
          {roomsFiltered.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">표시할 방이 없습니다.</div>
          ) : (
            <div className="relative mx-auto" style={{ width: totalW, height: totalH, margin: '8px auto' }}>
              <svg
                className="absolute left-0 top-0"
                style={{ width: totalW, height: totalH, pointerEvents: 'none' }}
                viewBox={`0 0 ${totalW} ${totalH}`}
              >
                {lines}
              </svg>
              {roomsFiltered.map((room) => {
                const isCurrent = room.id === currentRoomId;
                const isSafe = room.isSafe;
                const { x, y } = cellPos(room);
                return (
                  <div
                    key={room.id}
                    title={room.name}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: y,
                      width: cellW,
                      height: cellH,
                    }}
                    className={`
                      flex items-center justify-center rounded border text-center leading-tight px-0.5
                      text-[8px] sm:text-[9px]
                      ${
                        isCurrent
                          ? 'z-10 border-2 border-[#0ddff2] bg-[#0ddff2]/20 text-[#0ddff2] shadow-[0_0_8px_rgba(13,223,242,0.5)]'
                          : isSafe
                            ? 'border border-green-400/40 bg-green-500/10 text-green-400/85'
                            : 'border border-white/12 bg-white/[0.06] text-white/45'
                      }
                    `}
                  >
                    {isCurrent && <span className="absolute left-0.5 top-0.5 text-[5px] text-[#39ff14]">●</span>}
                    <span className="line-clamp-2 break-words">{room.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 px-4 py-2 text-[9px] text-zinc-500">
          <span className="text-[#0ddff2]">●</span> 현재 ·<span className="ml-2 text-green-400/80">□</span> 안전지대 · 우측 패널 「미니맵」은 주변만 표시
        </div>
      </div>
    </div>
  );
};

export default ZoneMapModal;
