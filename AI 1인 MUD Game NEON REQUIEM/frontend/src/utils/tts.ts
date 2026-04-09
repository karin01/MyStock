// Web Speech API 기반 TTS 유틸리티
// WHY: 외부 API 없이 브라우저 내장 음성 합성으로 NPC 더빙을 구현한다.

export interface VoiceProfile {
  pitch: number;    // 0.5~2.0 (낮음~높음)
  rate: number;     // 0.5~2.0 (느림~빠름)
  volume: number;   // 0~1
}

// NPC별 개성 있는 목소리 프로필
// WHY: NPC마다 음색을 다르게 해서 누가 말하는지 구분되도록 한다.
export const NPC_VOICE_PROFILES: Record<string, VoiceProfile> = {
  oni:           { pitch: 0.6, rate: 0.85, volume: 1.0 },  // 거친 저음 (조직 보스)
  ghostQueen:    { pitch: 1.3, rate: 0.9,  volume: 0.9 },  // 신비로운 중음 (해커 여왕)
  mysterio:      { pitch: 0.8, rate: 1.1,  volume: 1.0 },  // 날카로운 상인
  karina:        { pitch: 1.14, rate: 1.06, volume: 0.95 }, // 여성 정보상 — 여유 있지만 날카롭게
  eden:          { pitch: 1.5, rate: 1.0,  volume: 0.85 }, // 차갑고 또렷한 AI
  lira:          { pitch: 1.2, rate: 0.95, volume: 0.9 },  // 따뜻한 의사
  zeros:         { pitch: 0.7, rate: 0.8,  volume: 1.0 },  // 격렬한 전사
  silverPhantom: { pitch: 0.9, rate: 1.2,  volume: 0.85 }, // 빠르고 냉정한 헌터
  neonFat:       { pitch: 1.1, rate: 1.15, volume: 1.0 },  // 명랑한 포장마차
  shadowRat:     { pitch: 0.75, rate: 0.9, volume: 0.8 },  // 음침한 정보상
  dreamweaver:   { pitch: 1.4, rate: 0.85, volume: 0.9 },  // 신령스러운 목소리
  ironJack:      { pitch: 0.55, rate: 0.8, volume: 1.0 },  // 가장 낮은 대장장이 목소리
  veilCrypt:     { pitch: 0.82, rate: 0.92, volume: 0.95 }, // 블라인드 상인 — 낮고 탐욕스럽게
  default:       { pitch: 1.0, rate: 1.0,  volume: 0.9 },  // 내레이터/기본값
};

let isMuted = false;

// 음소거 토글
export const toggleTTSMute = (): boolean => {
  isMuted = !isMuted;
  if (isMuted) window.speechSynthesis?.cancel();
  return isMuted;
};

export const isTTSMuted = (): boolean => isMuted;

// 텍스트에서 이모지/특수기호 제거 (TTS가 읽으면 어색)
const cleanForSpeech = (text: string): string =>
  text
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')  // 이모지 제거
    .replace(/[╔╗╚╝║═▶◀]/g, '')             // 박스 문자 제거
    .replace(/\[.*?\]/g, '')                  // [태그] 제거
    .replace(/\(.*?\)/g, '')                  // (괄호) 제거
    .replace(/[!]{2,}/g, '!')                 // 중복 느낌표 정리
    .replace(/\n+/g, ' ')                     // 개행 → 공백
    .trim();

/**
 * NPC 이름으로 TTS를 재생한다.
 * @param text 읽을 텍스트
 * @param npcId NPC의 ID (프로필 선택에 사용)
 */
export const speakDialogue = (text: string, npcId?: string): void => {
  if (isMuted || !window.speechSynthesis) return;

  const clean = cleanForSpeech(text);
  if (!clean || clean.length < 2) return;

  // 이전 발화 취소 후 새로 시작
  window.speechSynthesis.cancel();

  const profile = NPC_VOICE_PROFILES[npcId || 'default'] ?? NPC_VOICE_PROFILES['default'];
  const utterance = new SpeechSynthesisUtterance(clean);

  utterance.lang = 'ko-KR';
  utterance.pitch = profile.pitch;
  utterance.rate = profile.rate;
  utterance.volume = profile.volume;

  // 한국어 음성 우선 선택 (있으면)
  const voices = window.speechSynthesis.getVoices();
  const korVoice = voices.find(v => v.lang.startsWith('ko'));
  if (korVoice) utterance.voice = korVoice;

  window.speechSynthesis.speak(utterance);
};

/**
 * 전투/시스템 내레이션용 TTS (기본 프로필 사용)
 */
export const speakNarration = (text: string): void => {
  speakDialogue(text, 'default');
};
