// WHY: rooms.ts와 roomsExpanded.ts에서 공유하기 위해 Room 타입을 분리한다.

export interface Room {
  id: string;
  name: string;
  description: string;
  exits: Partial<Record<'북' | '남' | '동' | '서', string>>;
  encounterChance: number;
  bgImage?: string;
  mapX: number;
  mapY: number;
  /** 고저: 0=지면, 1+=높은 지대(성벽·옥상 등). 원거리 사거리·근접 회피 보너스에 사용 */
  elevation?: number;
  isSafe?: boolean;
  lockedByBoss?: string;
  requiredKey?: string;
  /**
   * 방향별 출구가 퍼즐 클리어 전까지 막힘 (값 = roomPuzzles의 퍼즐 id).
   * WHY: 아이템 키 없이도 분위기에 맞는 간단 퍼즐로 관문을 연다.
   */
  puzzleGate?: Partial<Record<'북' | '남' | '동' | '서', string>>;
}
