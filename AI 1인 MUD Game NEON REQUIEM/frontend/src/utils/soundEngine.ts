// ─────────────────────────────────────────────────────────────
// soundEngine.ts
// WHY: 별도 음원 파일 없이 Web Audio API로 전투 효과음을 합성(synthesize)한다.
//      외부 리소스 의존 없이 다양한 소리를 코드로 만들 수 있음.
// ─────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

/** AudioContext를 지연 초기화한다 (브라우저 자동재생 정책 준수) */
function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** 노이즈 버퍼 생성 헬퍼 */
function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(rate * duration), rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** 사인파 오실레이터를 만들어 재생하는 헬퍼 */
function playOsc(
  ctx: AudioContext,
  type: OscillatorType,
  freq: number,
  gainVal: number,
  start: number,
  end: number,
  freqEnd?: number
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) osc.frequency.linearRampToValueAtTime(freqEnd, end);
  g.gain.setValueAtTime(gainVal, start);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(start);
  osc.stop(end);
}

// ─────────────── 소리 종류 ───────────────

/** 슬러시 (검, 도끼 - 베는 소리) */
export function playSoundSlash() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // 날카로운 노이즈 스위프
  const buf = createNoiseBuffer(ctx, 0.18);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(3000, t);
  filter.frequency.linearRampToValueAtTime(500, t + 0.18);
  filter.Q.value = 1.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.6, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  source.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.18);
}

/** 피어싱 (단검, 화살 - 찌르는 소리) */
export function playSoundPierce() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // 짧고 날카로운 고주파 펍
  playOsc(ctx, 'sawtooth', 1800, 0.3, t, t + 0.08, 600);
  // 작은 금속 틱
  const buf = createNoiseBuffer(ctx, 0.07);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 5000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  source.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.07);
}

/** 크러시 (둔기, 해머 - 충격/쿵 소리) */
export function playSoundCrush() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // 저음 펀치
  playOsc(ctx, 'sine', 120, 0.8, t, t + 0.25, 40);
  // 충격 노이즈
  const buf = createNoiseBuffer(ctx, 0.15);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  source.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.15);
}

/** 마법 공격 (스파클 소리) */
export function playSoundMagic() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // 고주파 라이징 스위프
  playOsc(ctx, 'sine', 400, 0.25, t, t + 0.3, 2000);
  playOsc(ctx, 'triangle', 600, 0.15, t + 0.05, t + 0.35, 2500);
  // 스파클 노이즈
  const buf = createNoiseBuffer(ctx, 0.3);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 6000;
  filter.Q.value = 5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  source.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.3);
}

/** 패링 성공 (금속 챙 소리) */
export function playSoundParrySuccess() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // 금속 챙! 고주파 링잉
  playOsc(ctx, 'triangle', 2200, 0.5, t, t + 0.4, 1800);
  playOsc(ctx, 'sine', 3000, 0.2, t, t + 0.35, 2400);
  // 짧은 충격 노이즈
  const buf = createNoiseBuffer(ctx, 0.05);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  source.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.05);
}

/** 패링 실패 (탁한 충격음) */
export function playSoundParryFail() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  playOsc(ctx, 'sawtooth', 200, 0.4, t, t + 0.2, 80);
  const buf = createNoiseBuffer(ctx, 0.2);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  source.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.2);
}

/** 방어 성공 (둔탁한 가드 소리) */
export function playSoundBlock() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  playOsc(ctx, 'square', 150, 0.3, t, t + 0.2, 100);
  const buf = createNoiseBuffer(ctx, 0.12);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 600;
  filter.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  source.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.12);
}

/** 피격 (플레이어가 맞는 소리) */
export function playSoundHit() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  playOsc(ctx, 'sawtooth', 300, 0.4, t, t + 0.15, 100);
  const buf = createNoiseBuffer(ctx, 0.15);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  source.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.15);
}

/** 레벨업 (승리음) */
export function playSoundLevelUp() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  [523, 659, 784, 1047].forEach((freq, i) => {
    playOsc(ctx, 'triangle', freq, 0.3, t + i * 0.12, t + (i + 1) * 0.12);
  });
}

/** 사망 (낮고 무거운 드럼) */
export function playSoundDeath() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  playOsc(ctx, 'sine', 80, 0.8, t, t + 0.6, 20);
  const buf = createNoiseBuffer(ctx, 0.5);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.6, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  source.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.5);
}

// ─────────────── 이동/발소리 ───────────────

/** 
 * WHY: 동서남북 이동 시 짧은 발걸음 느낌을 주기 위한 합성 발소리.
 *      저음 "쿵" + 살짝 높은 "틱"을 섞어서 걸어가는 느낌을 만든다.
 */
export function playSoundFootstep() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // 낮은 쿵 소리 (저음 짧은 드럼 느낌)
  playOsc(ctx, 'sine', 90, 0.4, t, t + 0.16, 60);

  // 살짝 높은 힐/구두 같은 틱 소리
  playOsc(ctx, 'triangle', 800, 0.15, t + 0.02, t + 0.12, 400);

  // 아주 약한 발걸음 마찰 노이즈
  const buf = createNoiseBuffer(ctx, 0.12);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 600;
  filter.Q.value = 1.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  source.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  source.start(t);
  source.stop(t + 0.12);
}
