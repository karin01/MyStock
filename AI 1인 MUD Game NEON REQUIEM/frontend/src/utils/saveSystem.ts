// 캐릭터 저장/불러오기 시스템 (localStorage 기반)
// WHY: 게임 세션을 종료하고 나중에 이어서 플레이할 수 있도록 캐릭터 데이터를 로컬에 저장한다.

export interface SavedCharacter {
  name: string;
  passwordHash: string;   // 비밀번호 해시
  recoveryQuestion: string; // 비밀번호 찾기 질문
  recoveryAnswerHash: string; // 비밀번호 찾기 답변 해시
  job: string;            // 직업 (마법사, 전사 등)
  level: number;
  exp: number;
  maxExp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  str: number;            // 힘 (추가)
  dex: number;            // 민첩
  con: number;            // 체력
  int: number;            // 지능
  spr: number;            // 정신
  statPoints: number;     // 잔여 스탯 포인트
  /** 장착 무기 인스턴스 id (구세이브는 아이템 이름 문자열일 수 있음 → 로드 시 id로 변환) */
  weapon: string | null;
  offHand?: string | null; // 보조손: 단검(쌍단검) 또는 방패 (구세이브: offHandWeapon/shield도 읽음)
  armor: string | null;
  shield?: string | null; // 구세이브 호환용 (저장 시 사용 안 함)
  offHandWeapon?: string | null; // 구세이브 호환용 (저장 시 사용 안 함)
  credit: number;         // 보유 COIN 재화
  /** 인벤 슬롯: 구세이브는 string[] (이름만), 신규는 { id, name } 로 동일 이름도 구분 */
  inventory: string[] | import('./inventoryHelpers').InventoryRow[];
  skills: string[];
  currentRoomId: string;
  story: {
    chapter: number;
    karma: number;
    edenTrust: number;
    betrayalCount: number;
    chromeLevel: number;
    soloRun: boolean;
    joinedFaction: string | null;
    romancePartner: string | null;
    defeatedBosses: string[];
    /** 미로 3구역(maze_s4) 최초 진입 시 직업 룬 지급 완료 여부 */
    grantedMazeZone3FirstRune?: boolean;
    /** 특정 방에서 조사 룬 복구 1회 수령한 방 id (중복 방지) */
    runeRestoreUsedRoomIds?: string[];
  };
  npcs: Record<string, { reputation: number; relationship: string; metBefore: boolean }>;
  quests: {
    active: Record<string, number>; // questId -> progressCount
    completed: string[]; // List of completed quest IDs
  };
  title?: string | null; // 칭호 (숨겨진 보스 처치 등)
  savedAt: string;        // ISO 타임스탬프
  passiveSkills?: string[];
  /** 레지스트 패시브 레벨 (예: { burn_resist: 3 } = 불 레지스트 Lv.3, 15% 감소) */
  passiveLevels?: Record<string, number>;
  equipmentUpgradeLevels?: Record<string, number>;
  /** 강화로 승급된 효과 티어(정의 grade와 다를 수 있음). 없으면 items.ts 정의 등급만 사용 */
  equipmentEffectiveGrade?: Record<string, import('../data/items').ItemGrade>;
  skillLevels?: Record<string, number>;
  /** 무기 계열별 마스터리 레벨 (예: { dagger: 3 }) */
  weaponMasteryLevel?: Record<string, number>;
  /** 무기 계열별 마스터리 누적 경험치 */
  weaponMasteryExp?: Record<string, number>;
  /** 성장형 몬스터: 적 id → { exp, level }. 플레이어를 죽인 적이 경험치를 쌓아 레벨업함 */
  enemyGrowth?: Record<string, { exp: number; level: number }>;
  /** 조사 비석 버프 (턴·수치). 미저장 구세이브는 0으로 간주 */
  obeliskStrBonus?: number;
  obeliskStrTurns?: number;
  obeliskAtkBonus?: number;
  obeliskAtkTurns?: number;
  obeliskDefBonus?: number;
  obeliskDefTurns?: number;
  obeliskMaxHpBonus?: number;
  obeliskMaxHpTurns?: number;
  obeliskDexBonus?: number;
  obeliskDexTurns?: number;
  obeliskConBonus?: number;
  obeliskConTurns?: number;
  obeliskIntBonus?: number;
  obeliskIntTurns?: number;
  obeliskSprBonus?: number;
  obeliskSprTurns?: number;
  /** 마을 성벽 HP (wall id → 현재 HP). 미저장 시 게임에서 기본값으로 채움 */
  villageWallHp?: Record<string, number>;
  /** 성벽 붕괴 후 적이 마을에 진입하면 true — 휴식 불가 등 */
  villageOccupied?: Record<string, boolean>;
  /**
   * 오염도(원한): 미로/벌크 통로 등에서 몬스터를 많이 처치할수록 상승.
   * WHY: 안전거점(미로 휴식처 등) 습격 확률을 서서히 올려 긴장감을 만든다.
   */
  mazePollution?: number;
  /** 태세(공격/공방/방어) — ATK·DEF·자동방어 확률 보정. 미저장 시 게임에서 기본값 */
  battlePosture?: import('../data/battlePosture').BattlePosture;
  /** 장착 룬 id(data/runes.ts의 RuneId). 미저장 시 룬 없음 */
  equippedRuneId?: string | null;
  /** 보조 룬 슬롯(시너지·디시플린 빌드). 미저장 시 null */
  equippedRuneSecondaryId?: string | null;
  /** 주 슬롯 룬 품질 배율 — 미저장 시 인벤·기본값으로 재계산 */
  equippedRuneQuality?: number;
  equippedRuneSecondaryQuality?: number;
  /** 구역 1 배회 현상금 NPC — 미저장 시 null */
  bountyNpc?: import('../data/bountyNpc').BountyNpcState | null;
  /** 마법사 [마나 실드]: 켜 두면 맞을 때 MP로 피해 흡수(상시 토글). 미저장 시 false */
  manaShieldActive?: boolean;
  /** 방 퍼즐(철문 코드 등) 클리어한 id 목록. 미저장 시 빈 배열 */
  solvedPuzzleIds?: string[];
}

const SAVE_KEY_PREFIX = 'neon_requiem_char_';

// 간단한 문자열 해시 함수
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// 캐릭터 이름으로 저장 키 생성
function getSaveKey(name: string): string {
  return SAVE_KEY_PREFIX + name.toLowerCase().replace(/\s/g, '_');
}

// 캐릭터 존재 여부 확인
export function characterExists(name: string): boolean {
  return !!localStorage.getItem(getSaveKey(name));
}

// 비밀번호 검증
export function verifyPassword(name: string, password: string): boolean {
  const save = loadCharacter(name);
  if (!save) return false;
  return save.passwordHash === simpleHash(password);
}

// 질문 답변 검증
export function verifyRecovery(name: string, answer: string): boolean {
  const save = loadCharacter(name);
  if (!save) return false;
  return save.recoveryAnswerHash === simpleHash(answer);
}

// 캐릭터 저장
export function saveCharacter(data: Omit<SavedCharacter, 'savedAt'>): void {
  const save: SavedCharacter = {
    ...data,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(getSaveKey(data.name), JSON.stringify(save));
}

// 캐릭터 불러오기
export function loadCharacter(name: string): SavedCharacter | null {
  const raw = localStorage.getItem(getSaveKey(name));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedCharacter;
  } catch {
    return null;
  }
}

import { type JobData } from '../data/jobClasses';
import { expRequiredForNextLevel } from '../data/playerProgress';
import { createInitialVillageWallHp } from '../data/villageDefense';
import { rollItemLevelForDrop } from '../data/items';
import { newInventoryRow } from './inventoryHelpers';

// 새 캐릭터 생성 (저장)
export function createNewCharacter(
  name: string, 
  password: string, 
  job: JobData, 
  recoveryQuestion: string, 
  recoveryAnswer: string
): SavedCharacter {
  const w = newInventoryRow(job.startWeapon, { itemLevel: rollItemLevelForDrop(1, Math.random) });
  const a = newInventoryRow(job.startArmor, { itemLevel: rollItemLevelForDrop(1, Math.random) });
  const p1 = newInventoryRow('빨간 포션');
  const p2 = newInventoryRow('파란 포션');
  const newChar: Omit<SavedCharacter, 'savedAt'> = {
    name,
    passwordHash: simpleHash(password),
    recoveryQuestion,
    recoveryAnswerHash: simpleHash(recoveryAnswer),
    job: job.name,
    level: 1,
    exp: 0,
    maxExp: expRequiredForNextLevel(1),
    hp: job.baseHp,
    maxHp: job.baseHp,
    mp: job.baseMp,
    maxMp: job.baseMp,
    atk: job.baseAtk,
    def: job.baseDef,
    str: job.baseStr,
    dex: job.baseDex,
    con: job.baseCon,
    int: job.baseInt,
    spr: job.baseSpr,
    statPoints: 0,
    weapon: w.id,
    armor: a.id,
    offHand: null,
    credit: 100,
    inventory: [w, a, p1, p2],
    skills: job.startSkills,
    currentRoomId: 'clinic',
    story: {
      chapter: 1,
      karma: 0,
      edenTrust: 0,
      betrayalCount: 0,
      chromeLevel: 100,
      soloRun: true,
      joinedFaction: null,
      romancePartner: null,
      defeatedBosses: [],
      grantedMazeZone3FirstRune: false,
      runeRestoreUsedRoomIds: [],
    },
    npcs: {},
    quests: {
      active: {},
      completed: [],
    },
    title: null,
    weaponMasteryLevel: (job.startMastery && Object.keys(job.startMastery).length > 0)
      ? { ...job.startMastery } as Record<string, number>
      : {},
    weaponMasteryExp: (job.startMastery && Object.keys(job.startMastery).length > 0)
      ? Object.fromEntries(Object.keys(job.startMastery).map(k => [k, 0]))
      : {},
    passiveLevels: {},
    enemyGrowth: {},
    villageWallHp: createInitialVillageWallHp(),
    villageOccupied: {},
    mazePollution: 0,
    equipmentEffectiveGrade: {},
  };
  saveCharacter(newChar);
  return { ...newChar, savedAt: new Date().toISOString() };
}

// 모든 저장된 캐릭터 이름 목록
export function getAllCharacterNames(): string[] {
  const names: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(SAVE_KEY_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const char = JSON.parse(raw) as SavedCharacter;
          names.push(char.name);
        }
      } catch { /* 무시 */ }
    }
  }
  return names;
}

export { simpleHash };
