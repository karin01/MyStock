import React, { useEffect, useRef } from 'react';
import {
  COMBAT_LOG_ENEMY_HEADER,
  COMBAT_LOG_PLAYER_HEADER,
  stripCombatLogHeader,
} from '../utils/combatLogUi';

export interface ConsoleProps {
  logs: string[];
  /** 거래 목록에서 아이템 줄 호버 시 말풍선(툴팁) 내용. 없으면 호버 미적용 */
  getItemTooltip?: (itemName: string) => string;
}

// 로그 줄의 시각적 유형 파악
// WHY: 메시지 종류별로 색상을 다르게 하면 정보를 훨씬 빠르게 파악할 수 있다.
type LogType =
  | 'input'    // > 사용자 입력
  | 'event'    // [⚡ 이벤트] - 황금/노랑
  | 'battle'   // 전투/데미지  - 빨강
  | 'npc'      // [NPC이름]:  - 마젠타/분홍
  | 'system'   // SYSTEM INIT - 시안
  | 'loot'     // 아이템 획득  - 골드
  | 'level'    // 🎉 레벨 업   - 연두 + bold
  | 'warn'     // ⚠️ 위험     - 주황
  | 'skill'    // ⚡ 스킬 발동  - 보라
  | 'narrate'; // 일반 설명   - 연두 (기본)

function detectLogType(line: any): LogType {
  if (typeof line !== 'string') return 'narrate';
  if (line.startsWith('>')) return 'input';
  if (line.includes('[SYNERGY]')) return 'event';
  if (line.startsWith('===') || line.includes('SYSTEM INIT') || line.includes('[SYSTEM]')) return 'system';
  if (line.includes('🎉') || line.includes('레벨 업')) return 'level';
  if (line.includes('[희귀]') && line.includes('룬')) return 'event';
  if (line.includes('[⚡ 이벤트]') || line.startsWith('[⚡') || line.includes('이벤트]')) return 'event';
  if (line.includes('[✨') || line.includes('획득!') || line.includes('📖') || line.includes('📦')) return 'loot';
  if (line.includes('💥') || line.includes('⚔') || line.includes('🔊') || line.includes('🐾') || line.includes('💻') || line.includes('피격') || line.includes('피해') || line.includes('출현!')) return 'battle';
  if (line.includes('⚠️') || line.includes('도망에 실패')) return 'warn';
  if (line.includes('⚡ 파워') || line.includes('✨ 회복') || line.includes('🛡 의지') || line.includes('스킬 [')) return 'skill';
  if (/^\[.+\]:/.test(line)) return 'npc';
  return 'narrate';
}

// 유형별 인라인 스타일
const LOG_COLORS: Record<LogType, { color: string; fontWeight?: string; opacity?: string }> = {
  input:   { color: '#aaaaaa', opacity: '0.7' },
  system:  { color: '#0ddff2' },
  event:   { color: '#ffdd00', fontWeight: '600' },
  loot:    { color: '#ffd700', fontWeight: '600' },
  battle:  { color: '#ff4466', fontWeight: '500' },
  npc:     { color: '#ff88ff', fontWeight: '500' },
  level:   { color: '#39ff14', fontWeight: '700' },
  warn:    { color: '#ff9900' },
  skill:   { color: '#bb88ff', fontWeight: '600' },
  narrate: { color: '#c8ffc8' },
};

// 유형별 왼쪽 보더 배경 (강조 블록)
const LOG_BG: Partial<Record<LogType, { borderLeft: string; paddingLeft: string; background: string; borderRadius: string }>> = {
  event:  { borderLeft: '3px solid rgba(255,221,0,0.7)',  paddingLeft: '10px', background: 'rgba(255,221,0,0.04)',  borderRadius: '3px' },
  battle: { borderLeft: '3px solid rgba(255,68,102,0.7)', paddingLeft: '10px', background: 'rgba(255,68,102,0.04)', borderRadius: '3px' },
  loot:   { borderLeft: '3px solid rgba(255,215,0,0.7)',  paddingLeft: '10px', background: 'rgba(255,215,0,0.04)',  borderRadius: '3px' },
  level:  { borderLeft: '3px solid rgba(57,255,20,0.7)',  paddingLeft: '10px', background: 'rgba(57,255,20,0.04)',  borderRadius: '3px' },
  npc:    { borderLeft: '3px solid rgba(255,136,255,0.5)', paddingLeft: '10px', background: 'rgba(255,136,255,0.03)', borderRadius: '3px' },
  system: { borderLeft: '3px solid rgba(13,223,242,0.4)', paddingLeft: '10px', borderRadius: '3px', background: 'transparent' },
  skill:  { borderLeft: '3px solid rgba(187,136,255,0.6)', paddingLeft: '10px', background: 'rgba(187,136,255,0.04)', borderRadius: '3px' },
};

// (GROUP_STARTERS removed)

function isBlankLine(line: any): boolean {
  if (typeof line !== 'string') return false;
  return line.trim() === '';
}

// ─────────────────────────────────────────
// ANSI 컬러 코드(일부) 렌더링 지원
// WHY: 전투 로그에서 치명타/등급 강조를 "문자열"로만 넣으면 UI에서 그대로 보이므로,
//      최소한의 ANSI 컬러 코드(91/93/94/95/0)를 <span>으로 해석해 시각적으로 표현한다.
// ─────────────────────────────────────────
const ANSI_COLOR_MAP: Record<string, string> = {
  '91': '#ff3b3b', // 밝은 빨강
  '93': '#ffd700', // 금색
  '94': '#4da3ff', // 밝은 파랑
  '95': '#d27bff', // 밝은 보라
  // 등급 표시용(ITEM_GRADES에서 사용하는 코드들)
  '31': '#ff4d4d', // 빨강
  '33': '#ffcc33', // 노랑/금색 계열
  '34': '#4da3ff', // 파랑
  '35': '#d27bff', // 자홍/보라
  '37': '#e6e6e6', // 흰색/회색 계열
};

function renderAnsiText(text: string): React.ReactNode {
  // ESC[xxm 패턴 — 색(91·93 등) + 굵게(1) 지원
  // 예: "\x1b[93m\x1b[1mRARE\x1b[0m"
  const ESC = '\u001b[';
  const parts: React.ReactNode[] = [];
  let buf = '';
  let color: string | undefined;
  let bold = false;

  const flush = () => {
    if (!buf) return;
    const style: React.CSSProperties = {};
    if (color) style.color = color;
    if (bold) style.fontWeight = 700;
    if (Object.keys(style).length > 0) parts.push(<span style={style}>{buf}</span>);
    else parts.push(buf);
    buf = '';
  };

  for (let i = 0; i < text.length; i++) {
    // ESC[
    if (text.startsWith(ESC, i)) {
      // flush current buffer
      flush();
      // parse until 'm'
      const mIdx = text.indexOf('m', i + ESC.length);
      if (mIdx === -1) {
        // malformed, treat literally
        buf += text[i];
        continue;
      }
      const code = text.slice(i + ESC.length, mIdx); // e.g. "91" or "1" or "0"
      if (code === '0') {
        color = undefined;
        bold = false;
      } else if (code === '1') bold = true;
      else if (ANSI_COLOR_MAP[code]) color = ANSI_COLOR_MAP[code];
      // advance index to end of code
      i = mIdx;
      continue;
    }
    buf += text[i];
  }
  flush();
  return parts.length === 1 ? parts[0] : <>{parts.map((p, idx) => <React.Fragment key={idx}>{p}</React.Fragment>)}</>;
}

const Console: React.FC<ConsoleProps> = ({ logs, getItemTooltip }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  /** 한 로그 블록을 줄 단위로 렌더. 상점 아이템 줄("- 이름 (N C)")이면 호버 시 툴팁 표시 */
  const renderLogContent = (log: string) => {
    const lines = log.split('\n');
    if (!getItemTooltip || lines.length === 0) {
      // ANSI 컬러가 포함된 문자열이라면 시각적으로 해석해 렌더
      return renderAnsiText(log);
    }
    return lines.map((line, i) => {
      const shopItemMatch = line.match(/^- (.+?) \((\d+) C\)$/);
      if (shopItemMatch) {
        const itemName = shopItemMatch[1].trim();
        const tooltip = getItemTooltip(itemName);
        if (tooltip) {
          return (
            <div
              key={i}
              title={tooltip}
              className="cursor-help rounded px-1 -mx-1 transition-colors duration-150 hover:bg-[#0ddff2]/15"
              style={{ display: 'block' }}
            >
              {line}
            </div>
          );
        }
      }
      return <div key={i}>{renderAnsiText(line)}</div>;
    });
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        background: '#05070f',
        fontFamily: "'Courier New', Consolas, monospace",
        fontSize: 15,          // ← 폰트 크기 키움
        lineHeight: 1.85,      // ← 줄 간격 넓힘
        position: 'relative',
      }}
    >
      {/* 스캔라인 오버레이 */}
      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute', // Fixed에서 Absolute로 변경
          inset: 0,
          zIndex: 0,
          opacity: 0.05,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(13,223,242,0.05) 2px, rgba(13,223,242,0.05) 4px)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 10 }}>
        {logs.map((log, index) => {
          // 빈 줄 → 여유있는 공백
          if (isBlankLine(log)) {
            return <div key={index} style={{ height: 12 }} />;
          }

          // 룬 획득/장착 네온 박스 (App에서 @@NEON_RUNE@@ 마커로 전달)
          if (typeof log === 'string' && log.startsWith('@@NEON_RUNE@@')) {
            const lines = log.split('\n');
            const border = (lines[1] || '#0ddff2').trim();
            const title = lines[2] || '';
            const body = lines.slice(3).join('\n');
            return (
              <div
                key={index}
                style={{
                  marginBottom: 14,
                  marginTop: 4,
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: `2px solid ${border}`,
                  boxShadow: `0 0 22px ${border}66, inset 0 0 28px ${border}18`,
                  background: 'linear-gradient(165deg, rgba(5,8,18,0.97) 0%, rgba(12,20,40,0.92) 100%)',
                  color: '#e8fff8',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 15,
                  lineHeight: 1.75,
                  letterSpacing: '0.02em',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.35em',
                    color: border,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                    opacity: 0.95,
                    textShadow: `0 0 12px ${border}`,
                  }}
                >
                  ◆ NEURAL RUNE MATRIX ◆
                </div>
                <div style={{ fontWeight: 800, fontSize: 17, color: border, textShadow: `0 0 14px ${border}99` }}>
                  {title}
                </div>
                <div style={{ marginTop: 10, color: '#c8f5ff', fontWeight: 500 }}>{body}</div>
              </div>
            );
          }

          // 전투 기록: 이미지1 — 분홍/녹색 헤더 바 + 본문 박스
          if (typeof log === 'string') {
            const stripped = stripCombatLogHeader(log);
            if (stripped) {
              const enemy = stripped.variant === 'enemy';
              const quake = stripped.body.includes('[SCREEN_SHAKE]');
              return (
                <div key={index} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: enemy ? '1px solid rgba(52, 211, 153, 0.45)' : '1px solid rgba(251, 113, 133, 0.45)',
                      boxShadow: enemy
                        ? 'inset 0 1px 0 rgba(52, 211, 153, 0.12)'
                        : 'inset 0 1px 0 rgba(251, 113, 133, 0.12)',
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 12px',
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: '0.03em',
                        background: enemy ? 'rgba(6, 50, 35, 0.88)' : 'rgba(50, 12, 24, 0.88)',
                        color: enemy ? '#a7f3d0' : '#fda4af',
                        borderBottom: enemy ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid rgba(251, 113, 133, 0.35)',
                      }}
                    >
                      {enemy ? COMBAT_LOG_ENEMY_HEADER : COMBAT_LOG_PLAYER_HEADER}
                    </div>
                    <div
                      className="transition-all duration-300"
                      style={{
                        padding: '10px 12px',
                        background: enemy ? 'rgba(6, 15, 12, 0.94)' : 'rgba(14, 8, 12, 0.94)',
                        color: '#fecaca',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 16,
                        lineHeight: 1.78,
                        letterSpacing: '-0.01em',
                        animation: quake ? 'nr-console-shake 0.48s ease-out' : undefined,
                      }}
                    >
                      {renderLogContent(stripped.body)}
                    </div>
                  </div>
                </div>
              );
            }
          }

          const type = detectLogType(log);
          const colorStyle = LOG_COLORS[type];
          const bgStyle = LOG_BG[type] ?? {};
          const quake = typeof log === 'string' && log.includes('[SCREEN_SHAKE]');

          // 입력 명령은 위에 구분선 추가
          const showDivider = type === 'input';

          return (
            <div key={index} style={{ marginBottom: 4 }}>
              {showDivider && index > 0 && (
                <div style={{ borderTop: '1px solid rgba(13,22,35,0.4)', borderBottom: '1px solid rgba(13,223,242,0.1)', margin: '16px 0 12px 0' }} />
              )}
              <div
                className="transition-all duration-300"
                style={{
                  ...colorStyle,
                  ...bgStyle,
                  padding: ('paddingLeft' in bgStyle) ? '8px 12px 8px 15px' : '4px 0',
                  whiteSpace: 'pre-wrap', // 줄바꿈 강제
                  wordBreak: 'break-word',
                  fontSize: type === 'narrate' ? 17 : 16, // 핵심 텍스트 크게
                  letterSpacing: '-0.01em',
                  animation: quake ? 'nr-console-shake 0.48s ease-out' : undefined,
                }}
              >
                {renderLogContent(log)}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default Console;
