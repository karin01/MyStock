import React from 'react';
import {
  type BattlePosture,
  BATTLE_POSTURE_LABEL,
} from '../data/battlePosture';
import { scaleSkillMpCost as smp } from '../data/economyBalance';
import { getSkillTooltip } from '../data/skillTooltips';

/** 천벌 레벨별 MP (Lv1=10, Lv2=16, Lv3+=22) — 업그레이드 시 MP 소비 증가 */
function get천벌MP(level: number): number {
  const lv = Math.max(1, Math.min(3, level || 1));
  return ({ 1: 10, 2: 16, 3: 22 } as Record<number, number>)[lv] ?? 10;
}

/** 홀리 스마이트 레벨별 MP (Lv1=60, Lv2=90, Lv3=120) — 강화 시 MP 소비 증가 */
function get홀리스마이트MP(level: number): number {
  const lv = Math.max(1, Math.min(3, level || 1));
  return ({ 1: 60, 2: 90, 3: 120 } as Record<number, number>)[lv] ?? 60;
}

/** 전투 태세(스킬 아님) — ATK/DEF 비율만 조정, 턴 소모 없음 */
const POSTURE_DEFS: Record<
  BattlePosture,
  { icon: string; color: string; hint: string }
> = {
  attack: {
    icon: '⚔️',
    color: '#ff6644',
    hint: '공격 태세: 공격력↑·방어력↓·자동 방어(가드) 발동 확률↓',
  },
  balanced: {
    icon: '⚖️',
    color: '#0ddff2',
    hint: '공방 태세: ATK/DEF/자동방어 확률 기본 (균형)',
  },
  defense: {
    icon: '🛡️',
    color: '#66aaff',
    hint: '방어 태세: 공격력↓·방어력↑·자동 방어(가드) 발동 확률↑',
  },
};

const POSTURE_ORDER: BattlePosture[] = ['attack', 'balanced', 'defense'];

interface SkillBarProps {
  skills: string[];
  currentMp: number;
  isCombat: boolean;
  onSkillUse: (skillName: string) => void;
  /** 스킬 강화 레벨 (천벌 등 레벨별 MP/위력 표시용) */
  skillLevels?: Record<string, number>;
  /** 지속 태세 (공격/공방/방어) — 스킬과 별도 행, 전투와 무관·턴 소모 없음 */
  battlePosture?: BattlePosture;
  onBattlePostureChange?: (next: BattlePosture) => void;
  /** rail: 우측 세로 레일 — 태세·스킬을 세로 스크롤 영역에 배치 */
  layout?: 'default' | 'rail';
  /** postureOnly / skillsOnly: App에서 태세를 생존 바 위로 분리 배치할 때 사용 */
  sections?: 'all' | 'postureOnly' | 'skillsOnly';
  /** 마나 실드 등 토글 스킬 ON 여부 — 배지에 MP 대신 ON/OFF 표시 */
  skillToggleActive?: Record<string, boolean>;
  /**
   * 전투 중 턴 소모 기본 행동 — 텍스트 명령과 동일(방어/회피/패링).
   * WHY: 스킬 배열에 없어 스킬 그리드에 안 나오던 액션을 UI에 복구.
   */
  onCombatBasicCommand?: (cmd: string) => void;
}

const SKILL_DEFS: Record<string, { mp: number; icon: string; color: string; isCombatOnly: boolean }> = {
  // 기존 스킬
  '파워 스트라이크': { mp: 10, icon: '⚔️', color: '#ff9900', isCombatOnly: true },
  '회복의 빛':     { mp: 15, icon: '✨', color: '#39ff14', isCombatOnly: false },
  '힐':            { mp: 20, icon: '💚', color: '#39ff14', isCombatOnly: false },
  '패링':         { mp: 5,  icon: '🛡️', color: '#0ddff2', isCombatOnly: true },
  '음파 폭발':     { mp: 20, icon: '🔊', color: '#ff2a54', isCombatOnly: true },
  '사이버 클로':   { mp: 12, icon: '🐾', color: '#ff88ff', isCombatOnly: true },
  '의지의 방어막': { mp: 20, icon: '🛡️', color: '#0ddff2', isCombatOnly: true },
  '데이터 도둑':   { mp: 8,  icon: '💻', color: '#bb88ff', isCombatOnly: true },
  '매직 미사일':   { mp: 5,  icon: '✨', color: '#a020f0', isCombatOnly: true },
  /** 토글 — 전투 밖에서도 켜고 끔 가능. UI는 skillToggleActive로 ON 표시 */
  '마나 실드': { mp: 0, icon: '🔮', color: '#66ccff', isCombatOnly: false },
  '파이어볼':      { mp: 15, icon: '🔥', color: '#ff4500', isCombatOnly: true },
  '라이트닝 볼트': { mp: 25, icon: '⚡', color: '#ffff00', isCombatOnly: true },
  '체인 라이트닝': { mp: 30, icon: '🌩️', color: '#ffff00', isCombatOnly: true },
  
  // 마법사 신규 스킬
  '아이스 스피어':   { mp: 12, icon: '❄️', color: '#00ffff', isCombatOnly: true },
  '메테오 스트라이크': { mp: 35, icon: '☄️', color: '#ff3300', isCombatOnly: true },
  '블리자드':        { mp: 30, icon: '🌨️', color: '#00ccff', isCombatOnly: true },
  '펄스 노바':       { mp: 22, icon: '💠', color: '#a78bfa', isCombatOnly: true },
  '스타폴':          { mp: 30, icon: '✨', color: '#fde68a', isCombatOnly: true },
  '마력의 순환':     { mp: 0,  icon: '🌀', color: '#8800ff', isCombatOnly: true }, // 행동 소모, MP 회복용
  
  // 성직자 신규 스킬
  '신의 방패':       { mp: 0, icon: '🛡️', color: '#ffffff', isCombatOnly: true },
  '홀리 스마이트':   { mp: 60, icon: '✝️', color: '#ffff00', isCombatOnly: true },
  '징벌':            { mp: 25, icon: '⚖️', color: '#ffcc00', isCombatOnly: true },
  '구원의 손길':     { mp: 30, icon: '🤲', color: '#00ff00', isCombatOnly: false },
  '정화':            { mp: 12, icon: '💫', color: '#e6e6fa', isCombatOnly: true },
  '축복':            { mp: 10, icon: '🙏', color: '#ffd700', isCombatOnly: false },
  '회복 기도':       { mp: 8,  icon: '📿', color: '#98fb98', isCombatOnly: false },
  '천벌':            { mp: 22, icon: '☀️', color: '#ffaa00', isCombatOnly: true },
  '생명력 전환':    { mp: 0,  icon: '🩸', color: '#cc4466', isCombatOnly: false },

  // 전사 신규 스킬
  '휠윈드':          { mp: 25, icon: '🌪️', color: '#ff6600', isCombatOnly: true },
  '돌진':            { mp: 15, icon: '🏃', color: '#ff0000', isCombatOnly: true },
  '불굴의 의지':     { mp: 20, icon: '🩸', color: '#cc0000', isCombatOnly: false },
  '광폭화':          { mp: 15, icon: '💢', color: '#ff0000', isCombatOnly: true },
  '도발':            { mp: 12, icon: '😤', color: '#ffaa66', isCombatOnly: true },
  '반격 태세':       { mp: 15, icon: '🔄', color: '#66ccff', isCombatOnly: true },
  '철벽':            { mp: 20, icon: '🏰', color: '#8899aa', isCombatOnly: true },
  '갑옷 파쇄':       { mp: 18, icon: '🛡️', color: '#ff8844', isCombatOnly: true },
  '처형':            { mp: 25, icon: '☠️', color: '#aa2222', isCombatOnly: true },
  '표식 참격':       { mp: 12, icon: '🎯', color: '#ffcc00', isCombatOnly: true },
  '방패 강타':       { mp: 12, icon: '🔰', color: '#aaddff', isCombatOnly: true },
  '가시 갑옷':       { mp: 18, icon: '🦔', color: '#c4a574', isCombatOnly: true },
  '일격필살':        { mp: 20, icon: '⚡', color: '#fde047', isCombatOnly: true },

  // 도적 신규 스킬
  '섀도우 스텝':     { mp: 15, icon: '🌫️', color: '#666666', isCombatOnly: true },
  '거울 복도':       { mp: 12, icon: '🪞', color: '#a78bfa', isCombatOnly: true },
  '죽은 척 오스':    { mp: 8, icon: '💀', color: '#57534e', isCombatOnly: true },
  '은신':            { mp: 15, icon: '👤', color: '#444466', isCombatOnly: true },
  '스틸':            { mp: 10, icon: '🎭', color: '#8866aa', isCombatOnly: true },
  '독 폭탄':         { mp: 20, icon: '🧪', color: '#00ff00', isCombatOnly: true },
  '맹독 단검':       { mp: 12, icon: '🗡️', color: '#33cc33', isCombatOnly: true },
  '페인 딜러':       { mp: 16, icon: '🃏', color: '#f472b6', isCombatOnly: true },
  '지갑선 끊기':    { mp: 10, icon: '💳', color: '#fcd34d', isCombatOnly: true },
  '급소 찌르기':     { mp: 18, icon: '🎯', color: '#ff0033', isCombatOnly: true },
  '라스트 콜':       { mp: 22, icon: '🚋', color: '#ef4444', isCombatOnly: true },

  // 로그 신규 스킬
  '스나이프':        { mp: 25, icon: '🏹', color: '#ff9900', isCombatOnly: true },
  '헤드샷':          { mp: 35, icon: '💀', color: '#ff0000', isCombatOnly: true },
  '철수':            { mp: 10, icon: '💨', color: '#cccccc', isCombatOnly: true },
  '난사':            { mp: 30, icon: '🔫', color: '#ffcc00', isCombatOnly: true },
  '애기살':          { mp: 15, icon: '🏹', color: '#00ff88', isCombatOnly: true },
  '폭발 화살':      { mp: 25, icon: '💥', color: '#ff6600', isCombatOnly: true },
  '화염 화살':      { mp: 18, icon: '🔥', color: '#ff3300', isCombatOnly: true },
  '얼음 화살':      { mp: 20, icon: '❄️', color: '#00ccff', isCombatOnly: true },
  '와이어 트랩':    { mp: 20, icon: '🧵', color: '#888888', isCombatOnly: false },
  '도주 사격':      { mp: 15, icon: '💨', color: '#88aacc', isCombatOnly: true },
  '멀티샷':        { mp: 18, icon: '🏹', color: '#00cc88', isCombatOnly: true },
  '에로우 샤워':   { mp: 28, icon: '🌧️', color: '#ff9900', isCombatOnly: true },

  // 룬 전용 스킬 (data/runes.ts와 동기화)
  '프렌지': { mp: 12, icon: '🩸', color: '#ff0044', isCombatOnly: true },
  '심판': { mp: 22, icon: '✝️', color: '#ffe066', isCombatOnly: true },
  '암살': { mp: 18, icon: '🗡️', color: '#8844ff', isCombatOnly: true },
  '명상': { mp: 0, icon: '🧘', color: '#66aaff', isCombatOnly: false },
  '표식': { mp: 10, icon: '🎯', color: '#00ffcc', isCombatOnly: true },
  '해골 소환': { mp: 25, icon: '💀', color: '#889988', isCombatOnly: true },
  '룬 카운터': { mp: 15, icon: '⚔️', color: '#ffaa66', isCombatOnly: true },
  '수호의 외침': { mp: 12, icon: '🛡️', color: '#aaccff', isCombatOnly: true },
  '대시': { mp: 12, icon: '💨', color: '#88eeff', isCombatOnly: false },
  '독 도포': { mp: 15, icon: '☠️', color: '#33ff66', isCombatOnly: false },
  '올인': { mp: 18, icon: '🎲', color: '#ffcc00', isCombatOnly: false },
  '영혼 교체': { mp: 20, icon: '👻', color: '#cc99ff', isCombatOnly: true },
  '오버로드': { mp: 40, icon: '⚡', color: '#ff5500', isCombatOnly: true },
  '철의 요새': { mp: 25, icon: '🏰', color: '#8899aa', isCombatOnly: true },
  '미라지': { mp: 18, icon: '🌫️', color: '#666688', isCombatOnly: true },
};

/** MP 배지 대신 ON/OFF를 쓰는 스킬(상시 토글류) */
const TOGGLE_SKILL_NAMES = new Set<string>(['마나 실드']);

const SkillBar: React.FC<SkillBarProps> = ({
  skills,
  currentMp,
  isCombat,
  onSkillUse,
  skillLevels,
  battlePosture = 'balanced',
  onBattlePostureChange,
  layout = 'default',
  sections = 'all',
  onCombatBasicCommand,
  skillToggleActive = {},
}) => {
  const isRail = layout === 'rail';
  const postureOnly = sections === 'postureOnly';
  const skillsOnly = sections === 'skillsOnly';
  const showPosture = sections !== 'skillsOnly' && onBattlePostureChange;
  const showSkills = sections !== 'postureOnly';

  return (
    <div
      className={`flex flex-col bg-zinc-900/70 backdrop-blur-sm ${
        isRail
          ? postureOnly
            ? 'shrink-0 gap-1.5 border-0 border-b border-white/10 px-1.5 py-2'
            : skillsOnly
              ? 'min-h-0 flex-1 gap-1.5 border-0 px-1.5 py-1.5'
              : 'min-h-0 h-full flex-1 gap-1.5 border-0 px-1.5 py-1.5'
          : 'min-h-0 gap-2 border-t border-white/10 px-2 py-2'
      }`}
    >
      {/* WHY: 스킬과 구분 — 태세는 턴·전투와 무관하게 ATK/DEF/자동방어 확률만 조정 */}
      {showPosture && (
        <div
          className={`shrink-0 border-white/10 pb-1.5 ${
            isRail
              ? `flex flex-col gap-1 ${postureOnly ? '' : 'border-b'}`
              : 'flex flex-wrap items-center gap-1.5 border-b'
          }`}
        >
          <span className="text-[9px] font-medium text-zinc-500 shrink-0 px-0.5">태세</span>
          <div className={isRail ? 'flex flex-col gap-1' : 'flex flex-wrap gap-1.5'}>
            {POSTURE_ORDER.map((key) => {
              const st = POSTURE_DEFS[key];
              const selected = battlePosture === key;
              return (
                <button
                  key={key}
                  type="button"
                  title={st.hint}
                  onClick={() => onBattlePostureChange(key)}
                  className={`
                    relative group rounded-lg border transition-colors duration-200
                    ${
                      isRail
                        ? `flex w-full flex-row items-center gap-2 px-2 py-1.5 text-left ${
                            selected
                              ? 'border-emerald-400/60 bg-emerald-500/15 text-zinc-100'
                              : 'border-white/10 bg-zinc-800/50 hover:bg-zinc-800 hover:border-white/20 text-zinc-300'
                          }`
                        : `flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 ${
                            selected
                              ? 'border-emerald-400/60 bg-emerald-500/15 text-zinc-100'
                              : 'border-white/10 bg-zinc-800/50 hover:bg-zinc-800 hover:border-white/20 text-zinc-300'
                          }`
                    }
                  `}
                >
                  <span className={`leading-none ${isRail ? 'text-lg' : 'mb-0.5 text-base sm:text-lg'}`}>
                    {st.icon}
                  </span>
                  <span
                    className={`font-semibold text-zinc-400 ${
                      isRail ? 'text-[10px]' : 'w-full truncate px-0.5 text-center text-[7px] sm:text-[8px] leading-tight'
                    }`}
                  >
                    {BATTLE_POSTURE_LABEL[key]}
                  </span>
                  {!isRail && (
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-zinc-950 text-[10px] p-2 rounded-lg border border-white/15 z-50 max-w-[240px] whitespace-normal text-left text-zinc-200 shadow-lg">
                      {st.hint}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showSkills && (
      <div
        className={
          isRail
            ? 'grid min-h-0 flex-1 grid-cols-2 gap-1.5 overflow-y-auto overflow-x-hidden px-0.5 pb-1 custom-scrollbar'
            : 'flex flex-wrap gap-2'
        }
      >
      {isCombat && onCombatBasicCommand && (
        <div
          className={
            isRail
              ? 'col-span-2 mb-0.5 grid grid-cols-3 gap-1 border-b border-white/10 pb-1.5'
              : 'mb-1 flex w-full flex-wrap gap-1.5 border-b border-white/10 pb-2'
          }
        >
          {(
            [
              { cmd: '방어', icon: '🛡', label: '방어', hint: '턴 소모 · 받는 피해 감소 (무료)' },
              { cmd: '회피', icon: '💨', label: '회피', hint: '턴 소모 · 완전 회피 확률 상승 (무료)' },
              {
                cmd: '패링',
                icon: '⚔',
                label: '패링',
                hint: '패링 스킬 보유 시 · 턴 소모 · 반격 시도 (무료 MP 없음)',
                needSkill: true,
              },
            ] as const
          ).map((row) => {
            const hasParry = skills.includes('패링');
            const disabled = 'needSkill' in row && row.needSkill && !hasParry;
            return (
              <button
                key={row.cmd}
                type="button"
                disabled={disabled}
                title={row.hint + (disabled ? ' — 패링 스킬 미습득' : '')}
                onClick={() => onCombatBasicCommand(row.cmd)}
                className={`
                  flex flex-col items-center justify-center rounded-md border px-0.5 py-1 transition-colors
                  ${isRail ? 'min-h-[2.65rem]' : 'h-14 min-w-[3.5rem] flex-1'}
                  ${
                    disabled
                      ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/50 opacity-40'
                      : 'border-emerald-500/35 bg-emerald-950/25 hover:border-emerald-400/50 hover:bg-emerald-900/30'
                  }
                `}
              >
                <span className={isRail ? 'text-sm' : 'text-lg'}>{row.icon}</span>
                <span className={`font-semibold text-emerald-200/90 ${isRail ? 'text-[7px] leading-tight' : 'text-[9px]'}`}>
                  {row.label}
                </span>
                <span className="text-[6px] text-zinc-500">턴</span>
              </button>
            );
          })}
        </div>
      )}
      {skills.length === 0 && !isCombat && (
        <span className={`text-[10px] italic text-gray-600 ${isRail ? 'col-span-2 px-1' : ''}`}>
          배운 스킬이 없습니다...
        </span>
      )}
      {skills.length === 0 && isCombat && (
        <span className={`text-[10px] italic text-gray-600 ${isRail ? 'col-span-2 px-1' : ''}`}>
          배운 스킬 없음 — 태세·공격·도움말을 활용하세요
        </span>
      )}
      {skills.map(skill => {
        let def = SKILL_DEFS[skill] || { mp: 0, icon: '⚡', color: '#ccc', isCombatOnly: true };
        if (skill === '천벌' && skillLevels) def = { ...def, mp: get천벌MP(skillLevels['천벌'] || 1) };
        if (skill === '홀리 스마이트' && skillLevels) def = { ...def, mp: get홀리스마이트MP(skillLevels['홀리 스마이트'] || 1) };
        // WHY: App.tsx와 동일 — economyBalance 배율(1.5)로 실제 소모 MP와 UI 표시·버튼 활성 조건 일치
        const mpCost = smp(def.mp);
        const isToggleSkill = TOGGLE_SKILL_NAMES.has(skill);
        const toggleOn = !!skillToggleActive[skill];
        const hasEnoughMp = currentMp >= mpCost;
        const canUse = isToggleSkill
          ? (toggleOn || currentMp > 0) && (!def.isCombatOnly || isCombat)
          : hasEnoughMp && (!def.isCombatOnly || isCombat);

        const effectHint = getSkillTooltip(skill);
        const titleHint =
          skill === '패링'
            ? `${effectHint}\n※ 상단 버튼: MP 없이 턴 소모 패링 · 이 칸: MP 소비 스킬 패링`
            : effectHint;

        return (
          <button
            key={skill}
            type="button"
            disabled={!canUse}
            title={titleHint}
            onClick={() => onSkillUse(skill)}
            className={`
              relative group flex flex-col items-center justify-center rounded-lg border transition-colors duration-200
              ${isRail ? 'h-[3.35rem] w-full' : 'h-16 w-16'}
              ${isToggleSkill && toggleOn ? 'ring-2 ring-cyan-400/55 shadow-[0_0_12px_rgba(34,211,238,0.25)]' : ''}
              ${canUse 
                ? 'border-white/15 bg-zinc-800/60 hover:bg-zinc-700/80 hover:border-white/25' 
                : 'border-zinc-800 bg-zinc-900/40 cursor-not-allowed opacity-45'}
            `}
          >
            <span className={`mb-0.5 ${isRail ? 'text-base' : 'mb-1 text-xl'}`}>{def.icon}</span>
            <span className={`font-bold truncate w-full px-0.5 text-center ${isRail ? 'text-[7px] leading-tight' : 'px-1 text-[9px]'}`}>
              {skill}
            </span>
            
            {/* MP 비용 또는 토글 스킬 ON/OFF — 마나 실드는 상시라 숫자 0이 아니라 상태 표시 */}
            <div
              className={`
              absolute -top-2 -right-1 px-1.5 py-0.5 rounded text-[8px] font-black
              ${
                isToggleSkill
                  ? toggleOn
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-zinc-600 text-zinc-200'
                  : canUse
                    ? 'bg-[#7b5df9] text-white shadow-lg'
                    : 'bg-gray-700 text-gray-400'
              }
            `}
            >
              {isToggleSkill ? (toggleOn ? 'ON' : 'OFF') : mpCost}
            </div>

            {/* 호버 툴팁 — rail 폭에서는 잘리므로 title + 기본 모드만 큰 툴팁 */}
            {!isRail && (
              <div
                className="absolute bottom-full left-1/2 z-[60] mb-2 hidden w-[min(288px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-white/15 bg-zinc-950 p-2.5 text-left text-[10px] shadow-xl pointer-events-none group-hover:block"
                role="tooltip"
              >
                <div className="mb-1 truncate font-semibold text-emerald-300/95" title={skill}>
                  {skill}
                </div>
                <p className="whitespace-normal leading-snug text-zinc-200">{effectHint}</p>
                <p className="mt-2 border-t border-white/10 pt-1.5 text-[9px] text-zinc-500">
                  {isToggleSkill
                    ? toggleOn
                      ? '클릭하여 실드 해제'
                      : currentMp > 0
                        ? '클릭하여 실드 펼치기 (상시)'
                        : 'MP 1 이상 필요'
                    : canUse
                      ? '클릭하여 발동'
                      : !hasEnoughMp
                        ? `MP 부족 (필요 ${mpCost})`
                        : '전투 중에만 사용 가능'}
                </p>
              </div>
            )}
          </button>
        );
      })}
      </div>
      )}
    </div>
  );
};

export default SkillBar;
