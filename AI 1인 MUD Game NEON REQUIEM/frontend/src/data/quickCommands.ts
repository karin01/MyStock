/** 퀵 상호작용 버튼 — 이동·전투·UI 단축 (InputPrompt·하단 바에서 공유) */
export interface QuickCmdItem {
  label: string;
  cmd: string;
}

export const QUICK_CMDS: QuickCmdItem[] = [
  { label: '상태', cmd: '상태' },
  { label: '위치', cmd: '위치' },
  { label: '↑북', cmd: '이동 북' },
  { label: '↓남', cmd: '이동 남' },
  { label: '←서', cmd: '이동 서' },
  { label: '→동', cmd: '이동 동' },
  { label: '⚔공격', cmd: '공격' },
  { label: '🏃도망', cmd: '도망' },
  { label: '🗺미니맵', cmd: '미니맵' },
  { label: '🌐구역', cmd: '구역지도' },
  { label: '🔎조사', cmd: '조사' },
  { label: '🎒인벤', cmd: '인벤토리' },
  { label: '✨스킬창', cmd: '스킬창' },
  { label: '?도움말', cmd: '도움말' },
];
