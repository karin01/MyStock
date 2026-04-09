/**
 * 접두사·접미사 한글 정의 (쉐도우베인 스타일)
 * WHY: 아이템 옵션의 네이밍과 효과 체계를 통일해, 악세사리/장비에 붙일 수 있게 함.
 */

// ─── 접두사 (Prefix): 기초 능력치·속성 저항 ───
export const PREFIX_NAMES = {
  ofTheBear: '곰의',       // 힘(Strength) 증가
  ofTheTiger: '호랑이의',  // 민첩(Dexterity) 증가
  ofTheOx: '소의',         // 건강(Constitution) 증가
  ofTheOwl: '올빼미의',    // 지능(Intelligence) 증가
  ofTheSphinx: '스핑크스의', // 정신력(Spirit) 증가
  ofTheSun: '태양의',      // 화염 저항
  ofTheMoon: '달의',       // 냉기(얼음) 저항
} as const;

// ─── 접미사 (Suffix): 매직 아이템의 핵심, 고급 옵션 ───
export const SUFFIX_NAMES = {
  ofTheGiants: '거인의',     // 힘 대폭 — 전사 계열 필수
  ofCelerity: '신속의',      // 공격/이동 속도·회피 관련, 희귀
  ofFate: '운명의',          // 운·치명타
  ofLuck: '행운의',          // 운·치명타 (ofFate와 유사)
  ofTranscendence: '초월의', // 정신력 — 힐/캐스터
  ofBrilliance: '광채의',    // 지능
  ofTheStars: '별의',       // 전능력 골고루 — 고급
} as const;

// ─── 무기 전용 접두/접미 (쉐도우베인 스타일, 한글) ───
/** 물리·속도 (전사/도적): 공격속도, 치명타, 물리데미지, 명중률 */
export const WEAPON_PREFIX_PHYSICAL = {
  ofCelerity: '신속의',         // 공격 속도·DEX
  ofEvisceration: '적출의',     // 치명타 확률
  ofRuin: '파멸의',             // 물리 데미지 대폭
  ofDestruction: '파괴의',     // 물리 데미지 대폭 (ofRuin과 유사)
  ofAccuracy: '정확의',        // 명중률(Attack Rating)
} as const;
/** 능력치 보정: STR, DEX, CON, INT */
export const WEAPON_PREFIX_STAT = {
  ofTheGiants: '거인의',        // 힘(STR) 대폭
  ofTheTiger: '호랑이의',      // 민첩(DEX)
  ofTheOx: '황소의',           // 건강(CON)
  ofBrilliance: '광휘의',      // 지능(INT) — 마법사
} as const;
/** 마법·속성 데미지 및 효과 */
export const WEAPON_PREFIX_ELEMENT = {
  ofFlaming: '화염의',
  ofFreezing: '냉기의',
  ofShocking: '전격의',
  ofVampirism: '흡혈의',
  ofBlight: '부패의',          // 독·지속피해
} as const;
/** 무기 인챈트: 특정 종족 추가 데미지, Proc 발동 */
export const WEAPON_SUFFIX_ENCHANT = {
  giantSlayer: '거인 살육자',
  undeadSlayer: '언데드 살육자',
  ofLightningProc: '벼락 발동의',  // 확률로 전격 Proc
  ofFlameProc: '화염 발동의',
} as const;
