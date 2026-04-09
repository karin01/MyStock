import React from 'react';

interface CombatStatsStripProps {
  atk: number;
  def: number;
  str: number;
}

/**
 * WHY: 우측 「캐릭터」칸 안의 ATK/DEF/STR은 폭이 좁아 숫자가 작고 한쪽으로 몰려 보임.
 *      화면 **전체 너비** 하단 한 줄로 두면 항상 크고 읽기 쉬움.
 */
const CombatStatsStrip: React.FC<CombatStatsStripProps> = ({ atk, def, str }) => {
  return (
    <div
      className="flex w-full shrink-0 items-center justify-center gap-4 border-t border-[#0ddff2]/35 bg-[#070910] px-3 py-2.5 sm:gap-8 sm:px-6 md:gap-14"
      role="region"
      aria-label="전투 스탯 ATK DEF STR"
    >
      <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
        <span className="shrink-0 text-sm font-bold tracking-wide text-orange-400 sm:text-base">ATK</span>
        <span className="truncate text-xl font-bold tabular-nums text-orange-200 sm:text-2xl">{atk}</span>
      </div>
      <div className="h-8 w-px shrink-0 bg-white/15" aria-hidden />
      <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
        <span className="shrink-0 text-sm font-bold tracking-wide text-sky-400 sm:text-base">DEF</span>
        <span className="truncate text-xl font-bold tabular-nums text-sky-200 sm:text-2xl">{def}</span>
      </div>
      <div className="h-8 w-px shrink-0 bg-white/15" aria-hidden />
      <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
        <span className="shrink-0 text-sm font-bold tracking-wide text-violet-400 sm:text-base">STR</span>
        <span className="truncate text-xl font-bold tabular-nums text-violet-200 sm:text-2xl">{str}</span>
      </div>
    </div>
  );
};

export default CombatStatsStrip;
