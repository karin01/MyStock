import { useCallback, useEffect, useRef, useState } from 'react';

/** WASD 리듬 QTE — 준보스 전투 개시용 */
export type MiniBossQteKey = 'w' | 'a' | 's' | 'd';

type QteVariant = 'miniBoss' | 'heavyStrike';

type Props = {
  open: boolean;
  enemyName: string;
  sequence: MiniBossQteKey[];
  /** 준보스 개시 QTE vs 강공격 1타 대응 — 결과 문구만 다름 */
  variant?: QteVariant;
  /** 한 입력당 제한 시간(ms) — 박자(리듬) 주기와 동일 */
  stepMs?: number;
  /** 오픈 직후 이 시간(ms) 동안은 실패·입력 없이 설명만 표시 (너무 빨리 지나가는 문제 완화) */
  prepMs?: number;
  /**
   * 오버레이를 연 시각부터 최소 세션 길이(ms) — 너무 빨리 닫히는 것 방지
   * 부모 통지 지연 = max(minOutcomeHoldMs, minSessionMs - 경과시간)
   */
  minSessionMs?: number;
  /** 성공·실패 직후 결과 문구를 최소 표시 시간(ms) — 여기서 멈춘 듯 보이지 않게 짧게 유지 */
  minOutcomeHoldMs?: number;
  onSuccess: () => void;
  onFail: () => void;
};

export default function CombatQteOverlay({
  open,
  enemyName,
  sequence,
  variant = 'miniBoss',
  stepMs = 1100,
  prepMs = 1600,
  minSessionMs = 4500,
  minOutcomeHoldMs = 2200,
  onSuccess,
  onFail,
}: Props) {
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  /** true면 타이머·입력 비활성 — 순서 읽는 시간만 부여 */
  const [prepActive, setPrepActive] = useState(true);
  /** 게임 진행 통지 전까지 결과 문구 표시 */
  const [outcome, setOutcome] = useState<'idle' | 'success' | 'fail'>('idle');
  const deadlineRef = useRef(0);
  const settledRef = useRef(false);
  const openedAtRef = useRef(0);
  const parentNotifyTimerRef = useRef<number | null>(null);

  const scheduleParentNotify = useCallback(
    (fn: () => void) => {
      if (parentNotifyTimerRef.current !== null) {
        window.clearTimeout(parentNotifyTimerRef.current);
        parentNotifyTimerRef.current = null;
      }
      const elapsed = Date.now() - openedAtRef.current;
      // WHY: 예전에는「오픈 후 10초」고정이라 성공 직후에도 남은 초만큼 가만히 있는 것처럼 보였음 → 세션 최소 + 결과 짧은 홀드로 조정
      const delay = Math.max(minOutcomeHoldMs, minSessionMs - elapsed);
      parentNotifyTimerRef.current = window.setTimeout(() => {
        parentNotifyTimerRef.current = null;
        fn();
      }, delay);
    },
    [minSessionMs, minOutcomeHoldMs]
  );

  const finishFail = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    setOutcome('fail');
    scheduleParentNotify(onFail);
  }, [onFail, scheduleParentNotify]);

  const finishOk = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    setOutcome('success');
    scheduleParentNotify(onSuccess);
  }, [onSuccess, scheduleParentNotify]);

  useEffect(() => {
    if (!open || sequence.length === 0) {
      if (parentNotifyTimerRef.current !== null) {
        window.clearTimeout(parentNotifyTimerRef.current);
        parentNotifyTimerRef.current = null;
      }
      settledRef.current = false;
      setIndex(0);
      setPrepActive(true);
      setOutcome('idle');
      return;
    }
    if (parentNotifyTimerRef.current !== null) {
      window.clearTimeout(parentNotifyTimerRef.current);
      parentNotifyTimerRef.current = null;
    }
    openedAtRef.current = Date.now();
    settledRef.current = false;
    setIndex(0);
    setPrepActive(true);
    setOutcome('idle');
    // 준비 중에는 데드라인을 멀리 두어 interval이 실패시키지 않게 함
    deadlineRef.current = Date.now() + 9e9;
  }, [open, sequence, stepMs, prepMs]);

  useEffect(() => {
    return () => {
      if (parentNotifyTimerRef.current !== null) {
        window.clearTimeout(parentNotifyTimerRef.current);
        parentNotifyTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open || sequence.length === 0 || !prepActive) return;
    const tid = window.setTimeout(() => {
      setPrepActive(false);
      deadlineRef.current = Date.now() + stepMs;
    }, prepMs);
    return () => window.clearTimeout(tid);
  }, [open, sequence, prepMs, stepMs, prepActive]);

  useEffect(() => {
    if (!open || sequence.length === 0 || settledRef.current) return;
    const t = window.setInterval(() => {
      setTick((n) => n + 1);
      if (settledRef.current) return;
      if (prepActive) return;
      if (Date.now() > deadlineRef.current) finishFail();
    }, 100);
    return () => window.clearInterval(t);
  }, [open, sequence, stepMs, index, finishFail, prepActive]);

  const tryKey = useCallback(
    (k: string) => {
      if (!open || settledRef.current || sequence.length === 0 || prepActive) return;
      const expected = sequence[index];
      if (k !== expected) {
        finishFail();
        return;
      }
      const next = index + 1;
      if (next >= sequence.length) {
        finishOk();
        return;
      }
      setIndex(next);
      deadlineRef.current = Date.now() + stepMs;
    },
    [open, sequence, index, stepMs, prepActive, finishFail, finishOk]
  );

  useEffect(() => {
    if (!open) return;
    /** 물리 자판 배치 기준 — 한글 IME여도 KeyW 등으로 동일하게 인식 */
    const CODE_TO_QTE: Partial<Record<string, MiniBossQteKey>> = {
      KeyW: 'w',
      KeyA: 'a',
      KeyS: 's',
      KeyD: 'd',
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const fromCode = CODE_TO_QTE[e.code];
      const lk = e.key.toLowerCase();
      const fromKey = ['w', 'a', 's', 'd'].includes(lk) ? (lk as MiniBossQteKey) : null;
      const k = fromCode ?? fromKey;
      if (!k) return;
      e.preventDefault();
      e.stopPropagation();
      tryKey(k);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, tryKey]);

  if (!open || sequence.length === 0) return null;

  const remain = Math.max(0, deadlineRef.current - Date.now());
  const frac = prepActive ? 1 : stepMs > 0 ? Math.min(1, remain / stepMs) : 0;
  void tick;

  const keyButtonClass =
    'touch-manipulation select-none min-h-[3.25rem] sm:min-h-[2.75rem] min-w-[3.25rem] sm:min-w-[2.5rem] rounded-xl border-2 border-[#0ddff2]/50 bg-zinc-900/95 py-2 font-mono text-xl font-bold text-[#0ddff2] shadow-[0_0_12px_rgba(13,223,242,0.15)] active:scale-95 transition-transform hover:bg-[#0ddff2]/10';

  return (
    <>
      <style>{`
        @keyframes neonQteCurrent {
          0%, 100% { box-shadow: 0 0 10px rgba(13,223,242,0.35); transform: scale(1); }
          50% { box-shadow: 0 0 22px rgba(13,223,242,0.85); transform: scale(1.06); }
        }
        @keyframes neonQteBeatBar {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-[2px] px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
        role="dialog"
        aria-modal="true"
        aria-label={variant === 'heavyStrike' ? '강공격 대응 QTE' : '엘리트 리듬 대응'}
      >
        <div className="mx-auto w-full max-w-md rounded-xl border-2 border-[#0ddff2]/55 bg-[#06080f] p-4 shadow-[0_0_48px_rgba(13,223,242,0.2)] sm:p-6">
          <h2 className="mb-1 text-center text-lg font-bold tracking-wide text-[#0ddff2]">
            {variant === 'heavyStrike' ? '💢 강공격 대응' : '⚡ 엘리트 리듬 QTE'}
          </h2>
          <p className="mb-1 text-center text-sm text-zinc-300">
            {variant === 'heavyStrike'
              ? `[${enemyName}]의 강공 타이밍 — 표시된 키를 제한 시간 안에 입력하세요. (성공 시 회피와 동일)`
              : `[${enemyName}] — 박자 맞춰 순서대로 입력 (키보드 WASD 물리키·화면 버튼; 한글 입력 중이어도 WASD 자리 키 인식).`}
          </p>
          {outcome === 'success' ? (
            <p className="mb-3 rounded-lg border border-emerald-500/50 bg-emerald-950/50 px-3 py-3 text-center text-base font-semibold text-emerald-200">
              {variant === 'heavyStrike'
                ? '✅ 대응 성공! 강공격을 비껴냅니다. 잠시 후 로그에 반영됩니다.'
                : '✅ 리듬 대응 성공! 잠시 후 기절 효과가 적용되고 전투가 이어집니다.'}
            </p>
          ) : outcome === 'fail' ? (
            <p className="mb-3 rounded-lg border border-rose-500/50 bg-rose-950/40 px-3 py-3 text-center text-base font-semibold text-rose-100">
              {variant === 'heavyStrike'
                ? '💥 입력 실패 — 피해 판정이 이어집니다. 잠시 후 로그를 확인하세요.'
                : '💥 리듬 대응 실패 — 최대 HP의 일부가 깎입니다. 잠시 후 로그에 반영됩니다.'}
            </p>
          ) : prepActive ? (
            <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-center text-sm font-medium text-amber-100">
              준비… 위 WASD 순서를 먼저 확인하세요. 약 {(prepMs / 1000).toFixed(1)}초 뒤 박자가 시작되며, 그때부터 입력·타이머가
              적용됩니다.
            </p>
          ) : (
            <p className="mb-3 flex items-center justify-center gap-2 text-center text-xs text-zinc-500">
              <span
                className="inline-block h-2 w-2 rounded-full bg-[#0ddff2]"
                style={{
                  animationName: 'neonQteBeatBar',
                  animationDuration: `${stepMs}ms`,
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                }}
              />
              한 박당 약 {(60000 / stepMs).toFixed(1)} BPM 느낌 · 타임바가 끝나기 전에 누르세요
            </p>
          )}
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {sequence.map((key, i) => (
              <span
                key={`${i}-${key}-${sequence.length}`}
                className={`min-w-[2.5rem] rounded-lg px-3 py-2 text-center font-mono text-lg font-bold transition-colors ${
                  outcome !== 'idle'
                    ? 'bg-zinc-800/60 text-zinc-500 opacity-60'
                    : i < index
                    ? 'bg-emerald-900/50 text-emerald-200 opacity-50'
                    : i === index
                      ? 'bg-[#0ddff2]/25 text-[#0ddff2] ring-2 ring-[#0ddff2]'
                      : 'bg-zinc-800/90 text-zinc-500'
                }`}
                style={
                  outcome === 'idle' && i === index
                    ? {
                        animation: `neonQteCurrent ${stepMs}ms ease-in-out infinite`,
                      }
                    : undefined
                }
              >
                {key.toUpperCase()}
              </span>
            ))}
          </div>
          <div className="relative mb-4 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-[#0ddff2] to-cyan-600 transition-[width] duration-100 ease-linear"
              style={{ width: outcome !== 'idle' ? '0%' : `${frac * 100}%` }}
            />
          </div>
          {/* WHY: 십자 배치 + 큰 히트존으로 모바일 엄지 조작에 유리 */}
          <div
            className={`mx-auto grid max-w-[280px] grid-cols-3 grid-rows-3 gap-x-2 gap-y-2 touch-manipulation sm:max-w-none ${outcome !== 'idle' ? 'pointer-events-none opacity-40' : ''}`}
          >
            <div />
            <button type="button" className={`${keyButtonClass} col-start-2 row-start-1`} onClick={() => tryKey('w')}>
              W
            </button>
            <div />
            <button type="button" className={`${keyButtonClass} col-start-1 row-start-2`} onClick={() => tryKey('a')}>
              A
            </button>
            <div className="col-start-2 row-start-2 flex items-center justify-center text-xs font-bold text-zinc-600">
              ♪
            </div>
            <button type="button" className={`${keyButtonClass} col-start-3 row-start-2`} onClick={() => tryKey('d')}>
              D
            </button>
            <div />
            <button type="button" className={`${keyButtonClass} col-start-2 row-start-3`} onClick={() => tryKey('s')}>
              S
            </button>
            <div />
          </div>
          <p className="mt-3 text-center text-xs text-zinc-500">
            {outcome !== 'idle'
              ? `잠시 후 자동으로 닫힙니다. (결과 표시 최소 약 ${(minOutcomeHoldMs / 1000).toFixed(1)}초 · 연출 전체 최소 약 ${(minSessionMs / 1000).toFixed(1)}초)`
              : prepActive
                ? '준비 시간에는 키/버튼 입력이 막혀 있습니다.'
                : variant === 'heavyStrike'
                  ? `입력당 약 ${Math.round(stepMs / 100) / 10}초 · 오타·시간 초과 시 실패 · 성공 시 이 한 방은 회피`
                  : `입력당 약 ${Math.round(stepMs / 100) / 10}초 · 오타 시 실패 · 성공 시 준보스 기절 턴 +1`}
          </p>
        </div>
      </div>
    </>
  );
}
