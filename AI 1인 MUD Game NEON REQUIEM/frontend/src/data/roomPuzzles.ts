/**
 * 방 터미널·철문 등 간단 퍼즐 정의 — App에서 이동 차단·`코드` 명령과 연동
 */

export interface RoomPuzzleDef {
  /** 정답 목록(숫자만 비교할 때는 아래 check에서 처리) */
  answers: string[];
  /** 이동 시도 시 짧은 안내 */
  blockedMoveHint: string;
  /** 정답 입력 직후 */
  solvedMessage: string;
  /** 오답 */
  wrongMessage: string;
}

export const ROOM_PUZZLES: Record<string, RoomPuzzleDef> = {
  /** 심층 미로 철문 — 광고 전단 힌트 (NEON REQUIEM · 2087) */
  neon_foundry_year: {
    answers: ['2087'],
    blockedMoveHint:
      '🔒 철문은 전자 잠금으로 굳게 닫혀 있다. 옆 패널에 네 자리 숫자를 넣어야 한다. (`코드` 뒤에 숫자만 이어서 입력 — 정답은 방 안 단서를 읽고 직접 짚어야 한다)',
    solvedMessage:
      '✅ 패널이 녹색으로 안정되며, 철문이 끼익 하는 소리와 함께 동쪽으로 천천히 열린다.',
    wrongMessage:
      '⚠️ 패널이 붉게 점멸하며 날카로운 경고음이 난다… 자물쇠는 그대로다. (바닥·벽의 남은 문구와 자릿수를 다시 맞춰 보라)',
  },
};

/** 플레이어 입력에서 숫자만 추출해 정답과 비교 */
export function matchesRoomPuzzleAnswer(puzzleId: string, raw: string): boolean {
  const def = ROOM_PUZZLES[puzzleId];
  if (!def) return false;
  const digits = raw.replace(/\D/g, '');
  const trimmed = raw.trim().toLowerCase();
  return def.answers.some((a) => a === digits || a === trimmed);
}
