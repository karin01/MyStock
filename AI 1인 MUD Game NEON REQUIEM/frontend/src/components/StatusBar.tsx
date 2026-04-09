import React from "react";

/** 아이템명 앞에 붙는 내구도 — 최대 대비 20% 미만·파손이면 빨간색 (세로 공간 절약) */
function EquipmentDurPrefix({ label }: { label: string | null | undefined }) {
  if (!label) return null;
  const trimmed = label.trim();
  const parsed = /^(\d+)\/(\d+)$/.exec(trimmed);
  let isBroken = false;
  let isLowDurability = false;
  if (parsed) {
    const cur = parseInt(parsed[1], 10);
    const max = parseInt(parsed[2], 10);
    if (max > 0) {
      isBroken = cur <= 0;
      // WHY: 20% 미만이면 수리·교체 타이밍을 HUD에서 바로 알 수 있게 함 (경계: 20%는 제외)
      isLowDurability = cur / max < 0.2;
    }
  }
  return (
    <span
      className={`shrink-0 text-[10px] tabular-nums leading-tight mr-1 ${
        isLowDurability ? "text-red-400" : "text-gray-500"
      }${isBroken ? " font-bold" : ""}`}
      title="장비 내구도 (현재/최대). 최대 대비 20% 미만·파손 시 빨간색"
    >
      {label}
    </span>
  );
}

interface StatusBarProps {
  atk: number;
  def: number;
  str: number; // 추가
  weapon: string | null;
  offHand?: string | null; // 보조손: 단검(쌍단검) 또는 방패
  armor: string | null;
  ring1?: string | null;
  ring2?: string | null;
  necklace?: string | null;
  /** 슬롯별 내구도 표시 (예: "45/60") — 비어 있으면 미표시 */
  weaponDurability?: string | null;
  offHandDurability?: string | null;
  armorDurability?: string | null;
  ring1Durability?: string | null;
  ring2Durability?: string | null;
  necklaceDurability?: string | null;
  credit: number;
  title?: string | null; // 칭호 (숨겨진 보스 처치 등)
  /** 플레이어에게 걸린 상태 이상 턴 수 */
  burnTurns: number;
  freezeTurns: number;
  staggerTurns: number;
  poisonTurns: number;
  sleepTurns: number;
  /** 축복 등 공격력 버프 여부 */
  hasBlessBuff: boolean;
  /** 패시브 HP 회복 보유 여부 */
  hasHpRegen: boolean;
  /** 패시브 MP 회복 보유 여부 */
  hasMpRegen: boolean;
  /** true면 ATK/DEF/STR 칸 숨김 — App 하단 CombatStatsStrip으로만 표시 */
  hideCombatStats?: boolean;
  /** true면 장비·칭호 블록 숨김 — App에서 생존 바 아래 `CharacterEquipmentBlock`으로 따로 배치할 때 */
  hideEquipment?: boolean;
}

/** 캐릭터 카드: 생존 바(Lv/HP/MP) 아래에 두는 장비 HUD (StatusBar와 동일 표시) */
export interface CharacterEquipmentBlockProps {
  weapon: string | null;
  offHand?: string | null;
  armor: string | null;
  ring1?: string | null;
  ring2?: string | null;
  necklace?: string | null;
  weaponDurability?: string | null;
  offHandDurability?: string | null;
  armorDurability?: string | null;
  ring1Durability?: string | null;
  ring2Durability?: string | null;
  necklaceDurability?: string | null;
  title?: string | null;
  /** true: 버프 블록 아래에 붙일 때 위쪽 구분선·여백 추가 (StatusBar 내부에서는 false) */
  withTopSeparator?: boolean;
  /** true: 우측 액션 레일 폭 — 글자만 살짝 작게, 한 줄 + 말줄임으로 폭 유지 */
  narrowRail?: boolean;
}

function EquipmentRow({
  slotLabel,
  durability,
  value,
  valueClass,
  narrowRail,
}: {
  slotLabel: string;
  durability?: string | null;
  value: string | null | undefined;
  valueClass: string;
  narrowRail: boolean;
}) {
  // WHY: 레일·패널 공통으로 슬롯명 | 내구·이름 한 줄 (두 줄이면 세로가 과하게 늘어남)
  const size = narrowRail ? 'text-[10px]' : 'text-[11px]';
  return (
    <div
      className={`flex min-w-0 items-center justify-between gap-1.5 border-b border-white/5 py-1 last:border-b-0 ${size}`}
    >
      <span className="shrink-0 text-gray-600">{slotLabel}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end text-right">
        <EquipmentDurPrefix label={durability} />
        <span className={`min-w-0 truncate ${valueClass}`}>{value ?? '─'}</span>
      </div>
    </div>
  );
}

export const CharacterEquipmentBlock: React.FC<CharacterEquipmentBlockProps> = ({
  weapon,
  offHand,
  armor,
  ring1,
  ring2,
  necklace,
  weaponDurability,
  offHandDurability,
  armorDurability,
  ring1Durability,
  ring2Durability,
  necklaceDurability,
  title,
  withTopSeparator = false,
  narrowRail = false,
}) => (
  <div className={withTopSeparator ? 'mt-2 border-t border-white/10 pt-2' : ''}>
    <div className="text-[10px] text-zinc-500 tracking-wide mb-1.5">장비</div>
    <div className={`flex flex-col ${narrowRail ? 'gap-0' : 'gap-1'}`}>
      <EquipmentRow
        narrowRail={narrowRail}
        slotLabel="⚔ 무기"
        durability={weaponDurability}
        value={weapon}
        valueClass={weapon ? 'text-[#ff9900]' : 'text-gray-700'}
      />
      <EquipmentRow
        narrowRail={narrowRail}
        slotLabel="⚔ 보조손"
        durability={offHandDurability}
        value={offHand}
        valueClass={offHand ? 'text-[#ff9900]' : 'text-gray-700'}
      />
      <EquipmentRow
        narrowRail={narrowRail}
        slotLabel="🥋 방어구"
        durability={armorDurability}
        value={armor}
        valueClass={armor ? 'text-sky-300' : 'text-zinc-600'}
      />
      <EquipmentRow
        narrowRail={narrowRail}
        slotLabel="💍 반지1"
        durability={ring1Durability}
        value={ring1}
        valueClass={ring1 ? 'text-[#facc15]' : 'text-gray-700'}
      />
      <EquipmentRow
        narrowRail={narrowRail}
        slotLabel="💍 반지2"
        durability={ring2Durability}
        value={ring2}
        valueClass={ring2 ? 'text-[#facc15]' : 'text-gray-700'}
      />
      <EquipmentRow
        narrowRail={narrowRail}
        slotLabel="📿 목걸이"
        durability={necklaceDurability}
        value={necklace}
        valueClass={necklace ? 'text-[#f97316]' : 'text-gray-700'}
      />
      {title && (
        <div
          className={`flex min-w-0 items-center justify-between gap-2 border-t border-white/10 pt-1 ${narrowRail ? 'text-[10px]' : 'text-[11px]'}`}
        >
          <span className="shrink-0 text-gray-600">🏷 칭호</span>
          <span className="min-w-0 truncate text-right font-bold text-[#7b5df9]">{title}</span>
        </div>
      )}
    </div>
  </div>
);

// 하단 고정 스트립·패널 공용 진행 바 (export — PlayerVitalsStrip에서 재사용)
export const VitalStatBar: React.FC<{
  value: number;
  max: number;
  color: string;
  height?: string;
  /** true일 때만 30% 이하에서 깜빡임 (HP 전용) */
  pulseWhenLow?: boolean;
}> = ({ value, max, color, height = 'h-2', pulseWhenLow = false }) => {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  const isLow = pulseWhenLow && pct <= 30;
  return (
    // WHY: 네온 글로우는 작은 패널에서 번짐 → 진행률만 선명하게
    <div className={`w-full bg-zinc-800/90 rounded-full ${height} overflow-hidden ring-1 ring-inset ring-white/5`}>
      <div
        className={`${height} rounded-full transition-all duration-500 ${isLow ? 'animate-pulse' : ''}`}
        style={{
          width: `${pct}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
};

const StatusBar: React.FC<StatusBarProps> = (props) => {
  const {
    atk,
    def,
    str,
    weapon,
    offHand,
    armor,
    ring1,
    ring2,
    necklace,
    weaponDurability,
    offHandDurability,
    armorDurability,
    ring1Durability,
    ring2Durability,
    necklaceDurability,
    credit,
    title,
    burnTurns,
    freezeTurns,
    staggerTurns,
    poisonTurns,
    sleepTurns,
    hasBlessBuff,
    hasHpRegen,
    hasMpRegen,
    hideCombatStats = false,
    hideEquipment = false,
  } = props;
  return (
    // WHY: App 우측 「캐릭터」카드가 이미 테두리를 가지므로 이중 테두리·네온 박스 제거 → 가독성 우선
    // HP/MP/레벨/경험/Rage는 캐릭터 카드 상단 PlayerVitalsStrip 또는 우측 레일에서 표시
    <div className="bg-transparent border-0 rounded-none p-0 font-mono flex flex-col gap-3 text-zinc-200">

      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-zinc-500 tracking-wide">버프·디버프</span>
        <span className="text-amber-200/90 font-semibold tabular-nums shrink-0" title="보유 크레딧">
          💰 {credit}
        </span>
      </div>

      {/* 버프 / 디버프 아이콘 — 상단에 크게 노출 */}
      <div className="flex flex-wrap gap-1 text-[10px] mb-1 min-h-[22px]">
        {hasBlessBuff && (
          <span
            className="px-1.5 py-0.5 rounded-full bg-[#facc15]/10 border border-[#facc15]/40 text-[#facc15]"
            title="축복: 신앙심 기반 공격력 상승 버프"
          >
            ✨ 축복
          </span>
        )}
        {hasHpRegen && (
          <span
            className="px-1.5 py-0.5 rounded-full bg-emerald-900/10 border border-emerald-400/40 text-emerald-200"
            title="HP 회복 패시브: 행동/턴마다 HP 회복"
          >
            💚 HP 회복
          </span>
        )}
        {hasMpRegen && (
          <span
            className="px-1.5 py-0.5 rounded-full bg-[#7b5df9]/10 border border-[#7b5df9]/40 text-[#7b5df9]"
            title="MP 회복 패시브: 행동/턴마다 MP 회복"
          >
            💜 MP 회복
          </span>
        )}
        {burnTurns > 0 && (
          <span
            className="px-1 py-0.5 rounded-full bg-red-900/30 border border-red-500/50 text-red-300"
            title="화상 상태: 매 턴 HP 감소"
          >
            🔥 화상 {burnTurns}
          </span>
        )}
        {freezeTurns > 0 && (
          <span
            className="px-1 py-0.5 rounded-full bg-cyan-900/40 border border-cyan-400/60 text-cyan-100"
            title="빙결 상태: 행동 불가 + DoT"
          >
            ❄️ 빙결 {freezeTurns}
          </span>
        )}
        {staggerTurns > 0 && (
          <span
            className="px-1 py-0.5 rounded-full bg-yellow-900/30 border border-yellow-400/60 text-yellow-100"
            title="경직 상태: 전기 충격 DoT"
          >
            ⚡ 경직 {staggerTurns}
          </span>
        )}
        {poisonTurns > 0 && (
          <span
            className="px-1 py-0.5 rounded-full bg-green-900/40 border border-green-500/60 text-green-100"
            title="중독 상태: 독 데미지 DoT"
          >
            ☠️ 중독 {poisonTurns}
          </span>
        )}
        {sleepTurns > 0 && (
          <span
            className="px-1 py-0.5 rounded-full bg-indigo-900/40 border border-indigo-400/60 text-indigo-100"
            title="수면: 행동 불가, 공격당하면 깨어남"
          >
            💤 수면 {sleepTurns}
          </span>
        )}
        {/* 회복 기도(HP HoT) */}
        {/** prayerHealTurns는 App에서 직접 넘겨주지 않지만, HUD 하단 줄이 더 눈에 띄므로
             상단 StatusBar에는 굳이 중복 표시하지 않아도 된다. 필요하면 여기서도 표시 가능. */}
      </div>

      {/* 구분선 */}
      <div className="border-t border-white/10" />

      {!hideCombatStats && (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-md border border-orange-500/25 bg-orange-500/10 p-1.5 text-center">
              <div className="text-[9px] tracking-wide text-zinc-500">ATK</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums leading-none text-orange-300">{atk}</div>
            </div>
            <div className="rounded-md border border-sky-500/25 bg-sky-500/10 p-1.5 text-center">
              <div className="text-[9px] tracking-wide text-zinc-500">DEF</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums leading-none text-sky-300">{def}</div>
            </div>
            <div className="rounded-md border border-violet-500/25 bg-violet-500/10 p-1.5 text-center">
              <div className="text-[9px] tracking-wide text-zinc-500">STR</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums leading-none text-violet-300">{str}</div>
            </div>
          </div>
          <div className="border-t border-white/10" />
        </>
      )}

      {!hideEquipment && (
        <CharacterEquipmentBlock
          weapon={weapon}
          offHand={offHand}
          armor={armor}
          ring1={ring1}
          ring2={ring2}
          necklace={necklace}
          weaponDurability={weaponDurability}
          offHandDurability={offHandDurability}
          armorDurability={armorDurability}
          ring1Durability={ring1Durability}
          ring2Durability={ring2Durability}
          necklaceDurability={necklaceDurability}
          title={title}
          withTopSeparator={false}
        />
      )}
    </div>
  );
};

export default StatusBar;
