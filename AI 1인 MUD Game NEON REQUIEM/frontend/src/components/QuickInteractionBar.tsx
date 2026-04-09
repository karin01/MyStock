import React from 'react';
import { QUICK_CMDS } from '../data/quickCommands';

interface QuickInteractionBarProps {
  onCommand: (cmd: string) => void;
  isCombat: boolean;
  /** 버튼 클릭 후 입력창 포커스 (선택) */
  onAfterCommand?: () => void;
}

/**
 * WHY: 우측 레일 안에 두면 폭이 좁아 버튼이 작고 잘림 → **화면 전체 너비 하단**에 배치.
 */
const QuickInteractionBar: React.FC<QuickInteractionBarProps> = ({
  onCommand,
  isCombat,
  onAfterCommand,
}) => {
  return (
    <div
      className="w-full shrink-0 border-t border-[#0ddff2]/35 bg-black/35 px-3 py-2 sm:px-4"
      role="toolbar"
      aria-label="빠른 명령"
    >
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center gap-2">
        {QUICK_CMDS.map(({ label, cmd }) => {
          const isCombatCmd = cmd === '공격' || cmd === '도망';
          return (
            <button
              key={cmd}
              type="button"
              onClick={() => {
                onCommand(cmd);
                onAfterCommand?.();
              }}
              className={`
                rounded-md border px-2.5 py-1.5 font-mono text-[10px] transition-all duration-200 sm:px-3 sm:text-[11px]
                ${
                  isCombatCmd
                    ? 'border-red-500/40 text-red-400 hover:border-red-500 hover:bg-red-500/10'
                    : 'border-[#0ddff2]/35 text-[#0ddff2]/85 hover:border-[#0ddff2] hover:bg-[#0ddff2]/10'
                }
                ${isCombat && !isCombatCmd ? 'opacity-45 grayscale' : ''}
              `}
            >
              {label}
            </button>
          );
        })}
        <span className="ml-auto hidden text-[10px] italic text-zinc-600 sm:inline">
          Tab 완성 · ↑↓ 기록
        </span>
      </div>
    </div>
  );
};

export default QuickInteractionBar;
