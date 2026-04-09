import React, { useState, useRef, forwardRef, useCallback } from 'react';
import { NPC_LIST } from '../data/npcs';
import { QUICK_CMDS } from '../data/quickCommands';

interface InputPromptProps {
  onCommand: (cmd: string) => void;
  inventory?: string[];
  skills?: string[];
  isCombat?: boolean;
  /**
   * default: 구형 하단(퀵+입력) — 현재 App에서는 미사용 가능
   * rail: 우측 레일 좁은 폼만 (퀵 버튼 없음)
   * dock: 화면 하단 전체 너비 입력줄 (퀵은 QuickInteractionBar가 담당)
   */
  variant?: 'default' | 'rail' | 'dock';
}

const InputPrompt = forwardRef<HTMLInputElement, InputPromptProps>(function InputPrompt(
  { onCommand, inventory = [], skills = [], isCombat = false, variant = 'default' },
  ref
) {
  const isRail = variant === 'rail';
  const isDock = variant === 'dock';
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [history, setHistory] = useState<string[]>([]);
  const innerRef = useRef<HTMLInputElement>(null);

  const setInputRef = useCallback(
    (el: HTMLInputElement | null) => {
      innerRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onCommand(trimmed);
    setHistory((prev) => [trimmed, ...prev.slice(0, 19)]);
    setHistoryIndex(-1);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();

      const ALL_CMDS = [
        '이동 북',
        '이동 남',
        '이동 동',
        '이동 서',
        '공격',
        '도망',
        '선택 퀘스트수락',
        '선택 거절',
        '인벤토리',
        '스킬창',
        '도움말',
        '설정',
        '위치',
        '휴식',
        '퀘스트',
        '!퀘스트',
        '조사',
        'shoot 북',
        '사격 북',
        '저격 북',
        '경계',
        '장착 ',
        '사용 ',
        '버리기 ',
        '버리기 노멀',
        '버리기 커먼',
        '버리기 매직',
        '상점',
        '구매 ',
        '판매 ',
        '판매 잡동사니',
        '판매 무기',
        '판매 갑옷',
        '판매 반지',
        '판매 목걸이',
        '판매 물약',
        '판매 스킬북',
        '판매 커먼',
        '판매 노멀',
        '판매 매직',
        '로그아웃',
        '장비',
        '장비 확인',
        '상태',
        '스탯투자 ',
        '스탯 힘',
        '스탯 민첩',
        '스탯 체력',
        '스탯 지능',
        '스탯 정신',
      ];

      // WHY: 장착·사용·판매와 동일하게 인벤 표시명으로 TAB 자동완성 (버리기 <아이템명>)
      const itemCmds = inventory.flatMap((item) => [
        `장착 ${item}`,
        `사용 ${item}`,
        `판매 ${item}`,
        `버리기 ${item}`,
      ]);

      const npcCmds = NPC_LIST.flatMap((npc) => {
        if (npc.id === 'ironJack' || npc.id === 'jin' || npc.id === 'veilCrypt')
          return [`대화 ${npc.name}`, `거래 ${npc.name}`];
        return [`대화 ${npc.name}`];
      });

      const skillCmds = skills.includes('패링') ? ['패링'] : [];

      const validCmds = [...ALL_CMDS, ...itemCmds, ...npcCmds, ...skillCmds];

      if (input.trim() === '') return;
      const inputLower = input.toLowerCase();

      const exactMatchIdx = validCmds.findIndex((c) => c.toLowerCase() === inputLower);
      if (exactMatchIdx !== -1) {
        const firstWord = input.split(' ')[0].toLowerCase();
        const sharedPrefixCmds = validCmds.filter((c) => c.toLowerCase().startsWith(firstWord));
        if (sharedPrefixCmds.length > 1) {
          const idxInShared = sharedPrefixCmds.findIndex((c) => c.toLowerCase() === inputLower);
          const nextCmd = sharedPrefixCmds[(idxInShared + 1) % sharedPrefixCmds.length];
          setInput(nextCmd);
        }
        return;
      }

      const matches = validCmds.filter((cmd) => cmd.toLowerCase().startsWith(inputLower));
      if (matches.length > 0) {
        setInput(matches[0]);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIdx);
      if (history[newIdx]) setInput(history[newIdx]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIdx);
      setInput(newIdx === -1 ? '' : history[newIdx] ?? '');
    }
  };

  const handleQuickCmd = (cmd: string) => {
    onCommand(cmd);
    innerRef.current?.focus();
  };

  const showQuickRow = !isRail && !isDock;

  return (
    <div
      className={`shrink-0 bg-[#06080f] transition-colors duration-500 ${
        isDock || isRail
          ? `border-t ${isCombat ? 'border-red-500/45' : 'border-[#0ddff2]/35'}`
          : `border-t ${isCombat ? 'border-red-500/50' : 'border-[#0ddff2]/30'}`
      }`}
    >
      {showQuickRow && (
        <div className="hidden flex-wrap gap-2 bg-black/20 px-4 pb-2 pt-3 md:flex">
          {QUICK_CMDS.map(({ label, cmd }) => {
            const isCombatCmd = ['공격', '도망'].includes(cmd);
            return (
              <button
                key={cmd}
                type="button"
                onClick={() => handleQuickCmd(cmd)}
                className={`
                  rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-tighter transition-all duration-200
                  ${
                    isCombatCmd
                      ? 'border-red-500/30 text-red-400 hover:border-red-500 hover:bg-red-500/10'
                      : 'border-[#0ddff2]/30 text-[#0ddff2]/70 hover:border-[#0ddff2] hover:bg-[#0ddff2]/10'
                  }
                  ${isCombat && !isCombatCmd ? 'opacity-40 grayscale' : ''}
                `}
              >
                {label}
              </button>
            );
          })}
          <span className="ml-auto self-center text-[10px] italic text-gray-700">
            Tab: AUTO-COMPLETE · ↑↓: HISTORY
          </span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`transition-colors duration-500 ${isCombat ? 'bg-red-500/5' : 'bg-black/40'} ${
          isDock
            ? 'flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 sm:px-5'
            : isRail
              ? 'flex flex-col gap-2 px-2 py-2'
              : 'flex min-h-[64px] items-center gap-3 px-5 py-3'
        }`}
      >
        <div className={`flex min-w-0 items-center gap-2 ${isRail || isDock ? 'flex-1' : 'min-w-0 flex-1'}`}>
          <span
            className={`shrink-0 select-none font-black transition-colors ${isCombat ? 'text-red-500' : 'text-[#0ddff2]'} ${isRail ? 'text-lg' : 'text-2xl'}`}
          >
            ❯
          </span>
          <input
            ref={setInputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`min-w-0 flex-1 border-none bg-transparent font-mono outline-none caret-[#0ddff2] placeholder:text-gray-700 ${
              isRail ? 'text-sm' : isDock ? 'text-base sm:text-lg' : 'text-lg'
            } ${isCombat ? 'text-red-400' : 'text-[#39ff14]'}`}
            placeholder={
              isDock
                ? '명령 입력… (예: 이동 북, 인벤토리)'
                : isRail
                  ? '명령 입력…'
                  : isCombat
                    ? '전투 명령 대기 중...'
                    : '시스템 명령어 입력... (예: 이동 북, 인벤토리)'
            }
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button
          type="submit"
          className={`
            shrink-0 rounded border font-black transition-all
            ${isDock ? 'px-5 py-2 text-xs sm:px-8' : isRail ? 'w-full py-2 text-[10px]' : 'px-6 py-2 text-xs'}
            ${
              isCombat
                ? 'border-red-500/50 text-red-500 hover:bg-red-500/20'
                : 'border-[#0ddff2]/40 text-[#0ddff2] hover:bg-[#0ddff2]/20'
            }
          `}
        >
          실행
        </button>
      </form>
      {isDock && (
        <p className="border-t border-white/5 px-4 pb-1.5 pt-1 text-[9px] text-zinc-600 sm:hidden">
          Tab 완성 · ↑↓ 기록
        </p>
      )}
    </div>
  );
});

InputPrompt.displayName = 'InputPrompt';

export default InputPrompt;
