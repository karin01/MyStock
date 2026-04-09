import React from 'react';
import { VitalStatBar } from './StatusBar';
import { PLAYER_MAX_LEVEL } from '../data/playerProgress';

/** 피격 시 HP 옆에 잠깐 띄우는 팝업(App에서 key로 애니 재시작) */
export interface PlayerDamagePop {
  key: number;
  /** 원천 피해(방어·실드 반영 전 단계의 최종 일격 값) */
  finalDmg: number;
  hpLoss: number;
  mpLoss: number;
}

interface PlayerVitalsStripProps {
  level: number;
  exp: number;
  maxExp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  /** 전사 분노 (0~100) */
  rage?: number;
  jobName?: string | null;
  /** rail: 세로 스택(우측 액션 레일) — 하단 푸터 대신 좁은 폭으로 쌓음 */
  layout?: 'horizontal' | 'rail';
  damagePop?: PlayerDamagePop | null;
}

/**
 * WHY: HP/MP/경험치를 스크롤과 무관하게 항상 보이게 함.
 * rail 레이아웃은 하단 전체 폭을 쓰지 않고 **세로로만** 공간을 씀.
 */
const PlayerVitalsStrip: React.FC<PlayerVitalsStripProps> = ({
  level,
  exp,
  maxExp,
  hp,
  maxHp,
  mp,
  maxMp,
  rage = 0,
  jobName,
  layout = 'horizontal',
  damagePop = null,
}) => {
  const hpPct = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
  const hpColor = hpPct > 60 ? '#4ade80' : hpPct > 30 ? '#fb923c' : '#f87171';
  const isMaxLevel = level >= PLAYER_MAX_LEVEL;
  const showRage = jobName === '전사';
  const isRail = layout === 'rail';

  return (
    <div
      className={`shrink-0 bg-[#06080f] shadow-[inset_0_1px_0_rgba(13,223,242,0.08)] ${
        isRail
          ? 'relative flex w-full flex-col gap-2 border-b border-[#0ddff2]/25 px-2 py-2'
          : 'relative flex flex-wrap items-end gap-x-3 gap-y-2 border-t border-[#0ddff2]/35 px-3 py-2'
      }`}
      role="region"
      aria-label="레벨·경험치·HP·MP·분노"
    >
      <style>{`
        @keyframes neonDamagePop {
          0% { opacity: 0; transform: translateY(6px) scale(0.92); }
          12% { opacity: 1; transform: translateY(0) scale(1.06); }
          70% { opacity: 1; transform: translateY(-10px) scale(1); }
          100% { opacity: 0; transform: translateY(-22px) scale(0.96); }
        }
      `}</style>
      {damagePop && (
        <div
          key={damagePop.key}
          className="pointer-events-none absolute right-1 top-1 z-20 flex flex-col items-end gap-0.5 text-right sm:right-2"
          style={{ animation: 'neonDamagePop 1.1s ease-out forwards' }}
          aria-live="polite"
        >
          {damagePop.hpLoss > 0 && (
            <span className="text-lg font-black tabular-nums text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.85)] sm:text-xl">
              -{damagePop.hpLoss} HP
            </span>
          )}
          {damagePop.mpLoss > 0 && (
            <span className="text-xs font-bold tabular-nums text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]">
              MP -{damagePop.mpLoss}
            </span>
          )}
          {damagePop.finalDmg > 0 && (damagePop.hpLoss > 0 || damagePop.mpLoss > 0) && (
            <span className="max-w-[10rem] text-[9px] font-medium leading-tight text-zinc-500">
              총 피해 {damagePop.finalDmg}
            </span>
          )}
          {damagePop.finalDmg > 0 && damagePop.hpLoss <= 0 && damagePop.mpLoss <= 0 && (
            <span className="text-base font-black tabular-nums text-orange-300 drop-shadow-[0_0_8px_rgba(253,186,116,0.7)] sm:text-lg">
              {damagePop.finalDmg}
            </span>
          )}
        </div>
      )}
      {/* 레벨 + 경험치 바 */}
      <div
        className={`flex flex-col gap-0.5 ${isRail ? 'w-full' : 'min-w-[9.5rem] flex-[1.2]'}`}
      >
        <div className="flex items-baseline justify-between gap-2 text-[10px] tabular-nums">
          <span className="font-bold text-emerald-400">Lv.{level}</span>
          <span className="text-zinc-500 truncate">
            {isMaxLevel ? 'EXP MAX' : `${exp} / ${maxExp}`}
          </span>
        </div>
        <VitalStatBar
          value={isMaxLevel ? 1 : exp}
          max={isMaxLevel ? 1 : maxExp}
          color="#4ade80"
          height="h-1.5"
        />
      </div>

      {/* HP */}
      <div className={`flex flex-col gap-0.5 ${isRail ? 'w-full' : 'min-w-[7.5rem] flex-1'}`}>
        <div className="flex items-baseline justify-between text-[10px]" style={{ color: hpColor }}>
          <span className="font-bold">HP</span>
          <span className="tabular-nums font-semibold">
            {hp} / {maxHp}
          </span>
        </div>
        <VitalStatBar value={hp} max={Math.max(1, maxHp)} color={hpColor} height="h-2" pulseWhenLow />
      </div>

      {/* MP */}
      <div className={`flex flex-col gap-0.5 ${isRail ? 'w-full' : 'min-w-[7.5rem] flex-1'}`}>
        <div className="flex items-baseline justify-between text-[10px] text-violet-300">
          <span className="font-bold">MP</span>
          <span className="tabular-nums font-semibold">
            {mp} / {maxMp}
          </span>
        </div>
        <VitalStatBar value={mp} max={Math.max(1, maxMp)} color="#a78bfa" height="h-2" />
      </div>

      {/* RAGE — 전사만 */}
      {showRage && (
        <div className={`flex flex-col gap-0.5 ${isRail ? 'w-full' : 'min-w-[6rem] flex-1'}`}>
          <div className="flex items-baseline justify-between text-[10px] text-orange-400">
            <span className="font-bold">RAGE</span>
            <span className="tabular-nums font-semibold">{Math.round(rage)} / 100</span>
          </div>
          <VitalStatBar value={rage} max={100} color="#fb923c" height="h-2" />
        </div>
      )}
    </div>
  );
};

export default PlayerVitalsStrip;
