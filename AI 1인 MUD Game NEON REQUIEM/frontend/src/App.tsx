import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Console from './components/Console';
import { CharacterEquipmentBlock } from './components/StatusBar';
import InputPrompt from './components/InputPrompt';
import MapPanel from './components/MapPanel';
import ZoneMapModal from './components/ZoneMapModal';
import LoginScreen from './components/LoginScreen';
import SkillBar from './components/SkillBar'; // 추가
import PlayerVitalsStrip, { type PlayerDamagePop } from './components/PlayerVitalsStrip';
import CombatStatsStrip from './components/CombatStatsStrip';
import QuickInteractionBar from './components/QuickInteractionBar';
import CombatQteOverlay from './components/CombatQteOverlay';
import type { MiniBossQteKey } from './components/CombatQteOverlay';
import {
  BG_ALLEY,
  resolveEnemySceneImage,
  resolveNpcSceneImage,
  resolveRoomSceneImage,
  SCENE_IMAGE_FALLBACK_DATA_URI,
} from './assets/scene/sceneImageUrls';
import { initialNpcState, NPC_LIST } from './data/npcs';
import {
  spawnRandomEnemy,
  spawnEnemy,
  applyEnemyGrowth,
  getEnemyGrowthLevel,
  ENEMY_GROWTH_EXP_PER_KILL,
  clearEnemyHeavyIntent,
  isEnemyRangedStrike,
  describeEnemyStrike,
  getEnemyFireResistForDamage,
  getFireDamageFactorFromResist,
  type ActiveEnemy,
} from './data/enemies';
import {
  getRoomById,
  STARTING_ROOM_ID,
  getExitsInDisplayOrder,
  getZoneForRoom,
  getMinDistanceFromSafeZone,
  getRoomElevation,
  getRoomsForZoneMap,
  getZoneMapTitle,
} from './data/rooms';
import { ROOM_PUZZLES, matchesRoomPuzzleAnswer } from './data/roomPuzzles';
import { ELEMENT_TO_STATUS, STATUS_DOT_DAMAGE, getStatusDotMultiplierForZone, STATUS_DEFAULT_TURNS, ENEMY_INFLICT_STATUS_CHANCE } from './data/elemental';
import { PASSIVE_LIST, getPassiveById, getPassiveByName, getElementResistances, isResistPassive, isRegenPassive, MAX_RESIST_LEVEL, REGEN_MAX_LEVEL, REGEN_PER_LEVEL, getRegenUpgradePrice } from './data/passives';
import { MASTERY_EXP_PER_HIT, MASTERY_EXP_TABLE, expToLevel, WEAPON_CLASS_LABEL } from './data/weaponMastery';
import { saveCharacter } from './utils/saveSystem';
import {
  applyEquippedRuneSkillsToList,
  applyPaladinRuneResist,
  RUNE_DATA,
  RUNE_EQUIP_MIN_LEVEL,
  RUNE_GUARDIAN_DEF_FLAT,
  RUNE_WIND_DODGE_FLAT,
  RUNES_BY_ID,
  type RuneId,
} from './data/runes';
import {
  formatBountyTrackerHint,
  getZone1WanderRoomIds,
  resolveBountyNpcAfterPlayerMove,
} from './data/bountyNpc';
import { formatRuneEquipMetaLine, getRuneScaleForPassive, rollRuneQualityForDrop, clampRuneQuality } from './data/runeQuality';
import {
  BOSS_RUNE_DROP_RARE_LINE,
  RUNE_SEARCH_RESTORE_CHANCE,
  RUNE_SEARCH_RESTORE_ROOM_IDS,
  buildNeonRuneLog,
  checkFirstRune,
  getRuneInventoryItemName,
  pickBestInventoryRuneQualityForRuneId,
  rollRandomRuneId,
  RUNE_ITEM_NAME_PREFIX,
  RUNE_LOG_SPLIT,
} from './data/runeAcquisition';
import { Player } from './game/Player';
import {
  estimateStrategicBuildCount,
  formatBuildFlavorLog,
  getActiveSynergyIds,
  hasRunePair,
  isGuildTerritoryRoom,
  playerHasRune,
  shouldAnnounceSynergyResonance,
  SYNERGY_RESONANCE_LINE,
  wrapScreenShakeLines,
} from './game/buildSystem';
import { effectiveEnemyDefForPhysical, applyWarriorMarkPhysicalDamage } from './utils/combatFormulas';
import {
  COMBAT_LOG_PLAYER_HEADER,
  appendEnemyCombatLog,
  wrapCombatLogPlayerBody,
} from './utils/combatLogUi';
import { getDamageModifier, getArmorDodgeChance, getArmorGuardChance, getArmorSpeedText, type WeaponAttribute, type ArmorAttribute } from './data/attributes';
import { JOB_LIST } from './data/jobClasses';
import {
  getIronJackShopResponse,
  isItemNameOfferedByIronJackForJob,
  APPRAISAL_SCROLL_ITEM_NAME,
  IRON_JACK_APPRAISAL_COST_COINS,
  IRON_JACK_SERVICE_ROOM_ID,
  isIronJackServiceRoom,
} from './data/ironJackShop';
import {
  getGamblingMerchantShopResponse,
  findBlindBoxProduct,
  getBlindBoxPurchasePrice,
  rollBlindBoxItemId,
  getVeilJackpotFlavorLine,
  getVeilScrapPurchaseLine,
  isVeilScrapItemId,
  GAMBLING_MERCHANT_ROOM_ID,
} from './data/gamblingMerchant';
import { scaleCoinCost, scaleSkillMpCost as smp } from './data/economyBalance';
import { SKILL_TOOLTIPS } from './data/skillTooltips';
import {
  type BattlePosture,
  BATTLE_POSTURE_LABEL,
  BATTLE_POSTURE_ATK_MULT,
  BATTLE_POSTURE_DEF_MULT,
  BATTLE_POSTURE_GUARD_CHANCE_MULT,
  applyPostureToGuardChance,
  isBattlePosture,
} from './data/battlePosture';
import {
  getItemByName,
  getItemById,
  mergeItemDataWithAffixes,
  isEquippableForMystery,
  getMysteryCategoryLabel,
  ITEM_GRADE_LABEL,
  ITEM_GRADES,
  resolveEquipmentEnchant,
  getMaterialGradeForEnchantTarget,
  getNextTier,
  EQUIPMENT_PLUS_MAX,
  MATERIAL_COUNT_PER_ENCHANT,
  migrateLegacyEnchantLevel,
  getEnchantStatBonusFromTierPlus,
  getEnchantDurabilityBonusFromTierPlus,
  getScaledShopBuyPrice,
  applyItemInstanceLevelToMergedItem,
  rollItemLevelForDrop,
  itemSupportsInstanceLevel,
  type ItemData,
  type ItemGrade,
} from './data/items';
import { rollAppraisalAffixes } from './data/appraisal';
import { QUESTS } from './data/quests';
import { WORLDVIEW_ONE_LINE, WORLDVIEW_DETAIL, MAIN_GOAL_TEXT, BOSS_STORY_MESSAGES, LEVELUP_FLAVOR_TEXTS } from './data/story';
import { getGameSettingsManualText } from './data/gameSettingsManual';
import {
  PLAYER_MAX_LEVEL,
  expRequiredForNextLevel,
  normalizePlayerLevelProgress,
} from './data/playerProgress';
import {
  VILLAGE_WALLS,
  createInitialVillageWallHp,
  isHostileMoveBlockedByWall,
  isHostileMoveBlockedZone1Protection,
  canSiegeWallFromGate,
  getWallDefForGateRoom,
  getWallDefForVillageOrGate,
  repairWallCost,
  rebuildOccupiedVillageCost,
  rebuildOpenSafeVillageOccupiedCost,
  sanitizeVillageOccupiedForImmutableZone1,
  isSafeRoomSubjectToInvasion,
  ZONE_OFFICIAL_VILLAGE,
} from './data/villageDefense';
import {
  playSoundSlash, playSoundPierce, playSoundCrush, playSoundMagic,
  playSoundHit, playSoundParrySuccess, playSoundParryFail,
  playSoundBlock, playSoundDeath, playSoundLevelUp,
  playSoundFootstep,
} from './utils/soundEngine';
import { speakDialogue, speakNarration } from './utils/tts'; // 추가
import {
  invName,
  newInventoryRow,
  newMysteryInventoryRow,
  migrateInventoryFromStrings,
  migrateEquipmentMapsByFirstOccurrence,
  normalizeEquipSlot,
  findInstanceIdForItemName,
  INVENTORY_MAX_SLOTS,
  isInventoryFull,
  getInventoryFullMessage,
  pickInventoryRowForRingEquip,
  reconcileDuplicateRingSlotIds,
  consolidateStackablePotionRows,
  countStackablePotionQty,
  getInventoryStackQty,
  isStackablePotionRow,
  removeOneFromInventoryByItemName,
  STACKABLE_POTION_ITEM_NAMES,
  type InventoryRow,
} from './utils/inventoryHelpers';
import './index.css';

/** 슬롯 값(인스턴스 id 또는 구세이브 이름) → 아이템 정의 조회용 이름 */
function resolveSlotToItemName(slot: string | null | undefined, inventory: InventoryRow[]): string {
  if (!slot) return '';
  const byId = inventory.find((r) => r.id === slot);
  if (byId) return byId.name;
  const byName = inventory.find((r) => r.name === slot);
  if (byName) return byName.name;
  return slot;
}

/** 장착 슬롯(인스턴스 id 또는 구세이브 이름)에 해당하는 인벤 행 */
function getInventoryRowBySlot(slot: string | null | undefined, inv: InventoryRow[]): InventoryRow | undefined {
  if (!slot) return undefined;
  return inv.find((r) => r.id === slot) ?? inv.find((r) => r.name === slot);
}

/**
 * 인벤 인스턴스 + 감정 부가옵션을 반영한 최종 ItemData.
 * WHY: resolveSlotToItemName은 표시용 이름만 주므로, 전투·스탯은 여기서 합산 정의를 쓴다.
 */
function getMergedEquippedItem(slot: string | null | undefined, inv: InventoryRow[]): import('./data/items').ItemData | null {
  const row = getInventoryRowBySlot(slot, inv);
  if (row) {
    if (row.identified === false) return null;
    const base = getItemByName(row.name);
    if (!base) return null;
    const merged = mergeItemDataWithAffixes(base, row.rolledAffixes ?? []);
    return applyItemInstanceLevelToMergedItem(merged, row.itemLevel);
  }
  if (!slot) return null;
  return getItemByName(slot) ?? null;
}

function getWeaponCombatTagsFromSlot(slot: string | null | undefined, inv: InventoryRow[]): ('swift' | 'destructive')[] {
  return getInventoryRowBySlot(slot, inv)?.rolledCombatTags ?? [];
}

/** 강화·내구도 맵 키: 슬롯이 id면 그대로, 이름만 있으면 인벤에서 매칭 */
function resolveInstanceIdForSlot(slot: string | null | undefined, inventory: InventoryRow[]): string | null {
  if (!slot) return null;
  if (inventory.some((r) => r.id === slot)) return slot;
  const row = inventory.find((r) => r.name === slot);
  return row ? row.id : null;
}

function inventoryHasItemName(inventory: InventoryRow[], itemName: string): boolean {
  return inventory.some((r) => r.name === itemName);
}

/** 인벤 행 → 아이템 정의 ([인벤토리] 분류와 동일한 해석) */
function resolveInventoryRowItemDef(row: InventoryRow): ItemData | undefined {
  const itemName = invName(row);
  const displayItemName =
    itemName === '낙은 데이터 칩' ? '낡은 데이터 칩' : itemName === '먹다 남은 비스케수' ? '먹다 남은 비스킷' : itemName;
  let itemDef = getItemByName(itemName) ?? getItemByName(displayItemName);
  if (row.identified === false && row.mysteryItemId) {
    itemDef = getItemById(row.mysteryItemId);
  }
  return itemDef;
}

type BulkSellCategoryKey = 'weapon' | 'armor_shield' | 'ring' | 'necklace' | 'consumable' | 'skillbook';

/** '판매 무기' 등 일괄 판매 분류 — 인벤 UI의 [무기]·[갑옷]… 와 대응 */
function parseBulkSellCategory(arg: string): BulkSellCategoryKey | null {
  const t = arg.trim();
  const map: Record<string, BulkSellCategoryKey> = {
    무기: 'weapon',
    '무기 전부': 'weapon',
    갑옷: 'armor_shield',
    '갑옷 전부': 'armor_shield',
    방어구: 'armor_shield',
    '방어구 전부': 'armor_shield',
    반지: 'ring',
    '반지 전부': 'ring',
    목걸이: 'necklace',
    '목걸이 전부': 'necklace',
    물약: 'consumable',
    '물약 전부': 'consumable',
    포션: 'consumable',
    '포션 전부': 'consumable',
    스킬북: 'skillbook',
    '스킬북 전부': 'skillbook',
  };
  return map[t] ?? null;
}

/**
 * [판매 커먼] / [판매 노멀] 등 — 무기·갑옷·방패·반지·목걸이만, 현재 효과 티어가 일치하는 행 일괄 판매
 * WHY: 카테고리(무기만 등)가 아니라 등급 기준으로 한 번에 정리할 수 있게 함. '노말'은 노멀 오타 허용.
 */
function parseBulkSellEquipmentGrade(arg: string): ItemGrade | null {
  const trimmed = arg.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const aliases: [string, ItemGrade][] = [
    ['커먼', 'common'],
    ['common', 'common'],
    ['노멀', 'normal'],
    ['노말', 'normal'],
    ['normal', 'normal'],
    ['매직', 'magic'],
    ['magic', 'magic'],
    ['레어', 'rare'],
    ['rare', 'rare'],
    ['에픽', 'epic'],
    ['epic', 'epic'],
    ['레전드리', 'legendary'],
    ['레전더리', 'legendary'],
    ['legendary', 'legendary'],
  ];
  for (const [alias, grade] of aliases) {
    if (trimmed === alias || lower === alias.toLowerCase()) return grade;
  }
  return null;
}

/** 등급 일괄 판매 대상: 무기·방패·갑옷·반지·목걸이 (물약·스킬북·기타 악세·잡동사니 제외) */
function rowMatchesEquipmentQuartetForGradeSell(def: ItemData): boolean {
  if (def.type === 'weapon') return true;
  if (def.type === 'armor' || def.type === 'shield') return true;
  return def.type === 'accessory' && (def.slot === 'ring' || def.slot === 'necklace');
}

const BULK_SELL_CATEGORY_LABEL: Record<BulkSellCategoryKey, string> = {
  weapon: '무기',
  armor_shield: '갑옷·방패',
  ring: '반지',
  necklace: '목걸이',
  consumable: '물약',
  skillbook: '스킬북',
};

function rowMatchesBulkSellCategory(def: ItemData, cat: BulkSellCategoryKey): boolean {
  switch (cat) {
    case 'weapon':
      return def.type === 'weapon';
    case 'armor_shield':
      return def.type === 'armor' || def.type === 'shield';
    case 'ring':
      return def.type === 'accessory' && def.slot === 'ring';
    case 'necklace':
      return def.type === 'accessory' && def.slot === 'necklace';
    case 'consumable':
      return def.type === 'consumable';
    case 'skillbook':
      return def.type === 'skillbook';
    default:
      return false;
  }
}

/** 장착 중인 인벤 인스턴스 id — 일괄 판매 시 착용 분은 제외 */
function getEquippedInventoryInstanceIds(playerState: {
  weapon: string | null;
  armor: string | null;
  offHand: string | null;
  ring1?: string | null;
  ring2?: string | null;
  necklace?: string | null;
}): Set<string> {
  const ids = [
    playerState.weapon,
    playerState.armor,
    playerState.offHand,
    playerState.ring1,
    playerState.ring2,
    playerState.necklace,
  ].filter(Boolean) as string[];
  return new Set(ids);
}

/** [판매 커먼]/[판매 노멀]/[버리기 노멀] 공통 — 등급 일괄 판매 후보 행 (장착 제외 · 물약·스킬북·잡동사니는 정의상 제외) */
function collectInventoryRowsForBulkEquipmentGradeSell(
  playerState: {
    inventory: InventoryRow[];
    weapon: string | null;
    armor: string | null;
    offHand: string | null;
    ring1?: string | null;
    ring2?: string | null;
    necklace?: string | null;
    equipmentEffectiveGrade?: Record<string, ItemGrade>;
    equipmentUpgradeLevels?: Record<string, number>;
  },
  gradeTarget: ItemGrade,
): InventoryRow[] {
  const equippedIds = getEquippedInventoryInstanceIds({
    weapon: playerState.weapon,
    armor: playerState.armor,
    offHand: playerState.offHand,
    ring1: playerState.ring1,
    ring2: playerState.ring2,
    necklace: playerState.necklace,
  });
  const effG = playerState.equipmentEffectiveGrade;
  const effL = playerState.equipmentUpgradeLevels ?? {};
  return playerState.inventory.filter((row) => {
    const def = resolveInventoryRowItemDef(row);
    if (!def || !rowMatchesEquipmentQuartetForGradeSell(def)) return false;
    if (equippedIds.has(row.id)) return false;
    const { tier } = resolveEquipmentEnchant(row.id, def, effG, effL);
    return tier === gradeTarget;
  });
}

/**
 * 카테고리 일괄 판매(무기·물약 등)에서 레어·에픽 제외 판정용 현재 티어.
 * WHY: 장비는 강화 승급 반영 티어, 물약·스킬북은 아이템 정의의 grade(없으면 커먼).
 */
function getEffectiveTierForBulkSellRareEpicGuard(
  row: InventoryRow,
  def: ItemData,
  equipmentEffectiveGrade: Record<string, ItemGrade> | undefined,
  equipmentUpgradeLevels: Record<string, number> | undefined,
): ItemGrade {
  if (rowMatchesEquipmentQuartetForGradeSell(def)) {
    const { tier } = resolveEquipmentEnchant(row.id, def, equipmentEffectiveGrade, equipmentUpgradeLevels);
    return tier;
  }
  return def.grade ?? 'common';
}

/** WHY: 고티어는 실수로 일괄 처분되는 것을 막기 위해 어떤 일괄 판매에도 넣지 않는다(개별 판매는 가능). */
function isRareOrEpicExcludedFromAnyBulkSell(
  row: InventoryRow,
  def: ItemData,
  equipmentEffectiveGrade: Record<string, ItemGrade> | undefined,
  equipmentUpgradeLevels: Record<string, number> | undefined,
): boolean {
  const t = getEffectiveTierForBulkSellRareEpicGuard(row, def, equipmentEffectiveGrade, equipmentUpgradeLevels);
  return t === 'rare' || t === 'epic' || t === 'legendary';
}

const BULK_SELL_RARE_EPIC_NOT_ALLOWED_MSG =
  '레어·에픽·레전드리 등급 아이템은 일괄 판매할 수 없습니다. [판매 아이템명]으로 하나씩 판매하세요.';

/** 단일 인벤 행 판매가 (잡동사니·개별 판매와 동일 규칙) */
function getSellPriceForInventoryRow(row: InventoryRow, lootSellValues: Record<string, number>): number {
  const name = invName(row);
  const displayName =
    name === '낙은 데이터 칩' ? '낡은 데이터 칩' : name === '먹다 남은 비스케수' ? '먹다 남은 비스킷' : name;
  let item = getItemByName(name) ?? getItemByName(displayName);
  if (row.mysteryItemId) {
    item = getItemById(row.mysteryItemId) ?? item;
  }
  if (item && item.price) {
    // WHY: 구매가(×1.5)와 비율 맞춤 — 정가의 30% 판매도 동일 배율
    return Math.max(1, Math.round(item.price * 0.3 * 1.5));
  }
  return Math.max(1, scaleCoinCost(lootSellValues[name] ?? 10));
}

// 장면·적·NPC 일러스트 URL은 ./assets/scene/sceneImageUrls.ts — Vite 번들(?url)로 public 미배포·경로 오류에도 로드됨

// WHY: 일부 전리품(데이터 칩, 부품 등)은 장착/소비용 아이템이 아니라
//      판매 전용 루팅 아이템이므로, 개별적으로 판매가를 지정해 준다.
//      이 값은 "판매 시 바로 받는 금액"이며, 상점가가 따로 존재하지 않는다.
const LOOT_SELL_VALUES: Record<string, number> = {
  // 초반 저티어 쓰레기 루트 (거의 가치 없음)
  '낡은 데이터 칩': 8,
  '낙은 데이터 칩': 8, // 구 세이브 호환 (표기 오타)
  '먹다 남은 비스킷': 5,
  '먹다 남은 비스케수': 5, // 구 세이브 호환 (표기 오타)
  '강체 단편': 12,
  '전도체 조각': 18,

  // 중간 티어 재활용 부품
  '이상하게 밝은 부품': 35,
  '크롬 파편': 40,
  '독침': 30,
  '홀로그램 조각': 45,

  // 상위 티어 에너지/코어 계열
  '에너지 셀': 60,
  '에너지 엠파크': 80,
  '봇 코어': 90,
  '독소 샘플': 55,

  // 고급 재화/칩 계열
  '크레딧 칩': 120,
  '쿼이솔': 70,
  '전함 캡슐': 22,
  '범죄 조직 악장': 35,
  '타격 센서': 38,
  '사의 일은 기록': 50,
  '프로토콜 텔레스마': 65,
  '정신력 강화 장치': 55,
  '닌자 잠복 서류': 42,
  '예비 에너지 팩': 35,
  '예비 에너지 튜': 35, // 구 세이브 호환 (표기 수정)
  '곰팡이 핀 연구 자료': 40, // lira_q2 — 실수로 잡동사니 판매 시 가치
  '심층 격납 데이터 코어': 185, // bulk_terminal_vault 조사 1회 — 고가 연구 루트
};

// WHY: 아이템명 뒤 조사 표기 버그 방지. '을(를)'을 그대로 쓰면 일부 환경에서 괄호가 이름에 붙어 보일 수 있음.
//      한글 받침 유무에 따라 '을' 또는 '를'만 반환해 문장을 완성한다.
function getObjectParticle(name: string): '을' | '를' {
  if (!name || name.length === 0) return '를';
  const last = name.charCodeAt(name.length - 1);
  if (last >= 0xac00 && last <= 0xd7a3) {
    const jong = (last - 0xac00) % 28;
    return jong === 0 ? '를' : '을';
  }
  return '을';
}

// ─────────────────────────────────────────
// 전투 로그 연출 유틸
// WHY: 전투가 숫자만 오가는 느낌이 되지 않도록, 타격 부위/적 상태 수식어를 붙여 생동감을 준다.
// ─────────────────────────────────────────
const HIT_PARTS = ['머리', '가슴', '팔', '다리'] as const;
type HitPart = typeof HIT_PARTS[number];
const pickHitPart = (): HitPart => HIT_PARTS[Math.floor(Math.random() * HIT_PARTS.length)];

const getEnemyConditionPrefix = (currentHp: number, maxHp: number): string => {
  const ratio = maxHp > 0 ? currentHp / maxHp : 0;
  if (ratio >= 0.7) return '멀쩡한 ';
  if (ratio >= 0.3) return '부상당한 ';
  return '빈사한 ';
};

const formatEnemyName = (e: { name: string; currentHp: number; maxHp: number }): string => {
  return `${getEnemyConditionPrefix(e.currentHp, e.maxHp)}${e.name}`;
};

// 아이템 옵션(이름 기반) → 전투 반영용 효과
// WHY: [신속한]/[파괴적인] 같은 옵션이 실제 전투 체감으로 이어져야 “파밍 재미”가 생긴다.
const getWeaponOptionEffects = (
  weaponName: string | null | undefined,
  rolledCombatTags?: ('swift' | 'destructive')[]
) => {
  const name = (weaponName || '').trim();
  const hasSwift =
    (rolledCombatTags?.includes('swift') ?? false) || name.includes('신속') || name.includes('[신속한]');
  const hasDestructive =
    (rolledCombatTags?.includes('destructive') ?? false) ||
    name.includes('파괴') ||
    name.includes('파괴적인') ||
    name.includes('파멸');
  return {
    // 공격 속도/연타 보정
    swiftExtraHitChance: hasSwift ? 0.12 : 0,   // 활 2연사/단검 연타에 추가 확률
    // 피해 보정
    damageMult: hasDestructive ? 1.10 : 1.0,    // 파괴 옵션: 최종 피해 10% 증가
    // 치명타 보정
    critBonus: hasDestructive ? 0.03 : 0,       // 파괴 옵션: 치명타 확률 +3%p
  };
};

/** 거래 목록 호버 시 말풍선에 표시할 텍스트 (데미지, 방어력, 옵션 등) */
function getItemTooltip(
  name: string,
  equipmentUpgradeLevels?: Record<string, number>,
  equipmentEffectiveGrade?: Record<string, import('./data/items').ItemGrade>,
  inventory?: InventoryRow[]
): string {
  const it = getItemByName(name);
  if (!it) return '';
  const row = inventory?.find((r) => r.name === name && r.identified !== false);
  const statBase =
    row && row.identified !== false
      ? applyItemInstanceLevelToMergedItem(mergeItemDataWithAffixes(it, row.rolledAffixes ?? []), row.itemLevel)
      : it;
  const lines: string[] = [it.description];
  if (row?.itemLevel != null) lines.push(`인스턴스 레벨: Lv.${row.itemLevel} (무기·방어 수치에 반영)`);
  if (statBase.type === 'weapon' && statBase.minDamage != null && statBase.maxDamage != null) {
    lines.push(`데미지: ${statBase.minDamage}~${statBase.maxDamage}`);
  }
  if (
    (statBase.type === 'armor' || statBase.type === 'shield' || statBase.type === 'accessory') &&
    (statBase.defense != null || statBase.bonusDefense != null)
  ) {
    const def = (statBase.defense ?? 0) + (statBase.bonusDefense ?? 0);
    lines.push(`방어력: ${def}`);
  }
  const opts: string[] = [];
  if (statBase.bonusStr) opts.push(`힘 +${statBase.bonusStr}`);
  if (statBase.bonusDex) opts.push(`민첩 +${statBase.bonusDex}`);
  if (statBase.bonusCon) opts.push(`체력 +${statBase.bonusCon}`);
  if (statBase.bonusInt) opts.push(`지능 +${statBase.bonusInt}`);
  if (statBase.bonusSpr) opts.push(`정신 +${statBase.bonusSpr}`);
  if (statBase.lifeStealPercent) opts.push(`흡혈 ${Math.round(statBase.lifeStealPercent * 100)}%`);
  if (statBase.poisonChance) opts.push(`독 확률 ${Math.round(statBase.poisonChance * 100)}%`);
  if (statBase.requiredMastery) opts.push(`마스터리 Lv.${statBase.requiredMastery} 필요`);
  if (statBase.bonusCritChance) opts.push(`치명타 +${Math.round((statBase.bonusCritChance ?? 0) * 100)}%p`);
  if (statBase.bonusAccuracy) opts.push(`명중 +${Math.round((statBase.bonusAccuracy ?? 0) * 100)}%p`);
  // 속성 저항(화염/빙결/전기/독) — 아이템 이름에 속성이 있어도 툴팁에 반드시 표시
  if (statBase.elementResist) {
    Object.entries(statBase.elementResist).forEach(([el, val]) => {
      if (val != null && val > 0) opts.push(`${el} 저항 ${Math.round(val * 100)}%`);
    });
  }
  // WHY: 동일 이름 장비가 여러 개일 때 첫 인스턴스 기준으로 툴팁 표시 (호버는 이름만 알 때가 많음)
  const instanceId = inventory?.length
    ? findInstanceIdForItemName(inventory, name, [])
    : name;
  const { tier, plus } = resolveEquipmentEnchant(instanceId || name, it, equipmentEffectiveGrade, equipmentUpgradeLevels);
  lines.push(
    `효과 등급: ${ITEM_GRADE_LABEL[tier]} (+${plus}) (정의: ${ITEM_GRADE_LABEL[it.grade ?? 'common']})`
  );
  if (opts.length) lines.push('옵션: ' + opts.join(', '));
  return lines.join('\n');
}

/** 방 수색 등 — 가중치 기반 랜덤 (에픽급은 낮은 가중치로 드물게) */
function pickWeightedLootName(entries: { name: string; w: number }[], rng: () => number): string {
  const sum = entries.reduce((a, e) => a + e.w, 0);
  let t = rng() * sum;
  for (const e of entries) {
    t -= e.w;
    if (t <= 0) return e.name;
  }
  return entries[entries.length - 1]?.name ?? '';
}

// 등급별 ANSI 색상 적용: 로그 상에서 아이템 이름을 색으로 구분
function colorizeItemName(
  it: import('./data/items').ItemData | null | undefined,
  name: string,
  effectiveGrade?: import('./data/items').ItemGrade
): string {
  const grade = effectiveGrade ?? it?.grade;
  if (!it || !grade) return name;
  // 구 등급(common~epic)을 신규 등급KR로 간단 매핑
  let g: keyof typeof ITEM_GRADES | null = null;
  switch (grade) {
    case 'common': g = '일반'; break;
    case 'normal': g = '일반'; break;
    case 'magic': g = '매직'; break;
    case 'rare': g = '에픽'; break;
    case 'epic': g = '전설'; break;
    case 'legendary': g = '신화'; break;
    default: g = null;
  }
  if (!g) return name;
  const def = ITEM_GRADES[g];
  if (!def) return name;
  return `${def.ansiColor}${name}${def.ansiReset}`;
}

function colorizeItemGradeTag(
  it: import('./data/items').ItemData | null | undefined,
  effectiveGrade?: import('./data/items').ItemGrade
): string {
  const grade = effectiveGrade ?? it?.grade;
  if (!it || !grade) return '';
  const tagText = `[${ITEM_GRADE_LABEL[grade]}] `;
  // 구 등급(common~epic)을 신규 등급KR로 간단 매핑
  let g: keyof typeof ITEM_GRADES | null = null;
  switch (grade) {
    case 'common': g = '일반'; break;
    case 'normal': g = '일반'; break;
    case 'magic': g = '매직'; break;
    case 'rare': g = '에픽'; break;
    case 'epic': g = '전설'; break;
    case 'legendary': g = '신화'; break;
    default: g = null;
  }
  if (!g) return tagText;
  const def = ITEM_GRADES[g];
  if (!def) return tagText;
  return `${def.ansiColor}${tagText}${def.ansiReset}`;
}

/** 준보스 리듬 QTE: 로그를 볼 시간을 준 뒤 오버레이 오픈(ms) — 안내 문구와 창이 동시에 뜨는 문제 완화 */
const MINI_BOSS_QTE_OVERLAY_DELAY_MS = 2400;
/** 강공격이 실제로 나갈 때 간헐적 QTE — 성공 시 패시브 회피와 동일 처리 */
const HEAVY_ATTACK_QTE_CHANCE_BOSS = 0.36;
const HEAVY_ATTACK_QTE_CHANCE_NORMAL = 0.26;

const App: React.FC = () => {
  const [loggedInChar, setLoggedInChar] = useState<import('./utils/saveSystem').SavedCharacter | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string>(STARTING_ROOM_ID);
  const [logs, setLogs] = useState<string[]>([
    '> SYSTEM INIT...',
    '로그인 화면에서 캐릭터 이름을 입력해 시작하세요.',
  ]);
  const [playerState, setPlayerState] = useState({
    hp: 100, maxHp: 100,
    mp: 50, maxMp: 50,
    level: 1, exp: 0, maxExp: expRequiredForNextLevel(1),
    atk: 15, def: 5, str: 10,
    dex: 10, con: 10, int: 10, spr: 10,
    statPoints: 0,
    weapon: null as string | null,
    offHand: null as string | null, // 보조손(왼손): 단검(쌍단검) 또는 방패 중 하나
    armor: null as string | null,
    ring1: null as string | null,
    ring2: null as string | null,
    necklace: null as string | null,
    credit: 100,
    inventory: [] as InventoryRow[],
    skills: [] as string[],
    facing: '북',
    isCombat: false,
    /** 태세(공격/공방/방어) — 스킬과 별개, 전투 여부와 관계없이 ATK·DEF·자동방어 확률에 반영, 턴 소모 없음 */
    battlePosture: 'balanced' as BattlePosture,
    stealthTurnsLeft: 0, // 도적 은신: 남은 턴 수 (적 공격 시 100% 회피)
    /** 거울 복도: 남은 적 라운드 수 — 적 전체 명중률 페널티 */
    thiefMirrorCorridorTurns: 0,
    /** 죽은 척 오스: HP 피해 1회 무효 (남은 횟수) */
    thiefPlayDeadCharges: 0,
    // 상태 이상 DoT (적 속성 공격 시 부여) — 턴 시작 시 피해 적용. 수면은 피격 시 해제.
    burnTurns: 0, freezeTurns: 0, staggerTurns: 0, poisonTurns: 0, sleepTurns: 0,
    /** 축복 버프: 남은 턴 수 및 ATK 보너스 저장 */
    blessTurns: 0,
    blessAtkBonus: 0,
    /** 회복 기도 HoT: 남은 턴 수 (적 턴 종료 시 1틱씩 회복) */
    prayerHealTurns: 0,
    /** 회복 기도 턴당 회복량 */
    prayerHealPerTurn: 0,
    /** 신의 방패: 남은 턴 수. 맞을 때 HP 대신 MP가 까이고, MP 0이면 HP 감소. 0이면 비활성 */
    godShieldTurns: 0,
    /** 마법사 [마나 실드]: 토글 ON이면 신의 방패와 같이 MP로 피해 흡수. 턴 제한 없음 · MP 0이 되면 자동 해제 */
    manaShieldActive: false,
    /** 전사 [도발]: 적 턴 종료마다 1 감소. >0이면 적이 주는 피해 감소 */
    warriorTauntTurns: 0,
    /** 전사 [가시 갑옷]: 몸에 가시를 돋운 턴 수 — 근접(비마법) 명중 시 피해량 기반 반사 */
    warriorThornAuraTurns: 0,
    /** 전사 [철벽]: 방어 보너스 잔여 턴 */
    fortifyTurns: 0,
    /** 철벽으로 더해진 DEF (만료 시 제거) */
    fortifyDefBonus: 0,
    passiveSkills: [] as string[],
    passiveLevels: {} as Record<string, number>,
    equipmentUpgradeLevels: {} as Record<string, number>,
    /** 강화 승급으로 바뀐 효과 티어(없으면 items 정의 grade) */
    equipmentEffectiveGrade: {} as Record<string, import('./data/items').ItemGrade>,
    skillLevels: {} as Record<string, number>,
    weaponMasteryLevel: {} as Record<string, number>,
    weaponMasteryExp: {} as Record<string, number>,
    /** 장비 내구도: 인스턴스 id → 현재 내구도 (0이면 파손) */
    equipmentDurability: {} as Record<string, number>,
    /** 스킬 쿨타임(턴 기반): 스킬명 -> 남은 턴 */
    skillCooldowns: {} as Record<string, number>,
    /** 경계 상태(턴 기반): 0이면 비활성, 1+이면 접근하는 적에 선제 저격 가능 */
    watchTurnsLeft: 0,
    /** 방 문 퍼즐(코드 입력 등) 클리어한 definition id */
    solvedPuzzleIds: [] as string[],
    /** 조사로 발견한 고대 비석: 턴이 0이 되면 보너스 무효 (여러 종류 동시 적용 가능) */
    obeliskStrBonus: 0,
    obeliskStrTurns: 0,
    obeliskAtkBonus: 0,
    obeliskAtkTurns: 0,
    obeliskDefBonus: 0,
    obeliskDefTurns: 0,
    obeliskMaxHpBonus: 0,
    obeliskMaxHpTurns: 0,
    obeliskDexBonus: 0,
    obeliskDexTurns: 0,
    obeliskConBonus: 0,
    obeliskConTurns: 0,
    obeliskIntBonus: 0,
    obeliskIntTurns: 0,
    obeliskSprBonus: 0,
    obeliskSprTurns: 0,
    respawnRoomId: STARTING_ROOM_ID,
    npcs: initialNpcState,
    title: null as string | null, // 칭호 (숨겨진 보스 처치 등으로 획득)
    story: {
      chapter: 1, karma: 0, edenTrust: 0, betrayalCount: 0,
      chromeLevel: 100, soloRun: true,
      joinedFaction: null as string | null,
      romancePartner: null as string | null,
      defeatedBosses: [] as string[],
      grantedMazeZone3FirstRune: false,
      runeRestoreUsedRoomIds: [] as string[],
    },
    quests: {
      active: {} as Record<string, number>,
      completed: [] as string[],
    },
    /** 성장형 몬스터: 적 id → { exp, level }. 이 캐릭터에게 플레이어를 죽인 적이 경험치를 받아 레벨업 */
    enemyGrowth: {} as Record<string, { exp: number; level: number }>,
    /** 마을 성벽 HP (적대 이동 차단). wall id → 남은 HP */
    villageWallHp: createInitialVillageWallHp(),
    /** 성벽이 무너진 뒤 적이 마을 방에 들어오면 true — 휴식 불가 */
    villageOccupied: {} as Record<string, boolean>,
    /** 오염도(원한): 미로/벌크 통로에서 처치할수록 증가 → 휴식거점 습격 확률 증가 */
    mazePollution: 0,
    /** data/runes.ts RuneId — 패시브·룬 전용 스킬 동기화(주 슬롯) */
    equippedRuneId: null as string | null,
    /** 보조 룬 슬롯 — 시너지·디시플린 빌드 */
    equippedRuneSecondaryId: null as string | null,
    /** 인벤 룬 품질 기준 장착 배율(주/보조 각각) */
    equippedRuneQuality: 1,
    equippedRuneSecondaryQuality: 1,
    /** 구역 1 익명 현상금 NPC */
    bountyNpc: null as import('./data/bountyNpc').BountyNpcState | null,
    /** 추적자 [표식] 적 인스턴스 id */
    runeMarkTargetId: null as string | null,
    runeIronFortressTurns: 0,
    runePoisonWeaponTurns: 0,
    runeSkeletonAllyStrikes: 0,
    runeSoulSummonActive: false,
    runeWindDashDodgeTurns: 0,
    runeMirageTurns: 0,
    runeCounterStanceTurns: 0,
    /** 도박사 [올인] — 다음 피해 1회 배율 */
    runeNextDamageMult: null as number | null,
  });

  const [activeEnemies, setActiveEnemies] = useState<ActiveEnemy[]>([]);
  /** 연속 화력 턴(닥공 류) — 보스 강공격 예고 확률 보정에만 사용 */
  const aggressiveTurnStreakRef = useRef(0);
  const stealthTurnsRef = useRef(0); // 은신 남은 턴(setTimeout 클로저에서 최신 값 참조용)
  /** 전사+바람술사: 방패 강타 후 적 턴 1회 스킵 */
  const playerWindBashPriorityRef = useRef(0);
  /** 적 턴 종료 시 HP/MP 회복은 1회만 적용 (React Strict Mode 이중 호출 방지) */
  const roundEndRegenAppliedRef = useRef(false);
  /** 적 턴이 진행 중인지 표시 (중복 실행/중복 입력 가드용) */
  const enemyTurnInProgressRef = useRef(false);
  /** 전사 전용 분노 게이지 (0~100). 맞을수록, 때릴수록 증가. */
  const [rage, setRage] = useState<number>(0);
  /** 전투 종료 후 비전투 행동 횟수 (레이지 자연 감소용) */
  const nonCombatSinceCombatRef = useRef<number>(0);
  /** setTimeout 클로저에서 최신 적 상태를 참조하기 위한 ref (stale 방지) */
  const activeEnemiesRef = useRef<ActiveEnemy[]>([]);
  /** 적 처치 보상(경험치/코인/드랍)은 적 ID당 1회만 지급 (중복 보상 버그 방지) */
  const defeatRewardedEnemyIdsRef = useRef<Set<string>>(new Set());
  /** 적 턴 타이머 핸들 보관 → 턴/전투 전환 시 정리 */
  const enemyTurnTimeoutsRef = useRef<number[]>([]);
  /** 비전투 상태 이상 DoT 로그가 Strict Mode에서 2번씩 찍히는 것을 막기 위한 플래그 */
  const nonCombatDotAppliedRef = useRef(false);
  /** 비전투 HP/MP 회복 로그가 Strict Mode에서 2번씩 찍히는 것을 막기 위한 플래그 */
  const nonCombatRegenAppliedRef = useRef(false);
  /** React Strict Mode에서 handleCommand가 2번 호출될 때, 두 번째 호출을 무시하기 위한 가드 플래그 */
  const handlingCommandRef = useRef(false);
  /** 하단 퀵 버튼 클릭 후 명령 입력줄 포커스 */
  const commandInputRef = useRef<HTMLInputElement>(null);
  /** 특정 방에서 '조사'를 통해만 열리는 숨겨진 출구 발견 여부 */
  const [discoveredHiddenExits, setDiscoveredHiddenExits] = useState<Set<string>>(new Set());
  /** 축복 등 공격력 버프 표시용 플래그 */
  const [hasBlessBuff, setHasBlessBuff] = useState(false);
  const [sceneImage, setSceneImage] = useState<string | null>(BG_ALLEY);
  /** 장면 <img> 로드 실패 시 data URI로 대체 */
  const [scenePanelImgFailed, setScenePanelImgFailed] = useState(false);
  // 마지막으로 대화한 NPC ID를 추적 (선택 명령어에서 사용)
  const [lastTalkedNpc, setLastTalkedNpc] = useState<string | null>(null);
  const [showMap, setShowMap] = useState<boolean>(false);
  /** 전체 구역 지도(미니맵과 별개) — M 단축키 / 헤더 버튼 / '구역지도' 명령 */
  const [showZoneMap, setShowZoneMap] = useState<boolean>(false);
  // WHY: 사망 시 즉시 리스폰되면 인지가 어려우므로, 전용 오버레이를 2.5초 보여준 뒤 리스폰 처리.
  const [showDeathOverlay, setShowDeathOverlay] = useState<boolean>(false);
  // WHY: 보스룸 진입 시 사망 화면처럼 극적인 풀스크린 배너를 잠깐 보여준다.
  const [showBossRoomOverlay, setShowBossRoomOverlay] = useState<boolean>(false);
  /** 준보스 등장 시 간헐적 WASD 리듬 QTE */
  const [miniBossQte, setMiniBossQte] = useState<null | { enemyName: string; sequence: MiniBossQteKey[] }>(null);
  /** 강공격 1히트 직전 간단 QTE(보통 키 1회) — 미니보스 개시 QTE와 동시에는 거의 없음 */
  const [heavyStrikeQte, setHeavyStrikeQte] = useState<null | { enemyName: string; sequence: MiniBossQteKey[] }>(null);
  const heavyStrikeQteFailContinueRef = useRef<null | (() => void)>(null);
  const heavyStrikeQteEnemyIdRef = useRef<string | null>(null);
  const miniBossQteLockRef = useRef(false);
  /** 로그 출력 후 오버레이를 띄우기 전 지연 타이머 (전투 종료 시 반드시 해제) */
  const miniBossQteOpenTimerRef = useRef<number | null>(null);
  /** setTimeout 클로저에서 최신 전투 여부 확인 */
  const combatActiveForQteRef = useRef(false);
  /** 같은 전투 스냅샷에 QTE 시도 1회만 (HP 변동으로 effect 재실행 방지) */
  const miniBossQteConsumedFightKeyRef = useRef<string | null>(null);
  /** QTE 표시 중 `triggerEnemyTurn`이 호출되면, 같은 클로저의 실행기를 보관했다 QTE 종료 뒤 1회 재개 */
  const pendingEnemyTurnAfterQteRef = useRef<null | {
    currentEnemies: ActiveEnemy[];
    options?: {
      isDefending?: boolean;
      dodgeChance?: number;
      isParrying?: boolean;
      isRiposte?: boolean;
      basicDefend?: boolean;
      basicParry?: boolean;
    };
    combatRhythm?: 'neutral';
    run: (
      currentEnemies: ActiveEnemy[],
      options?: {
        isDefending?: boolean;
        dodgeChance?: number;
        isParrying?: boolean;
        isRiposte?: boolean;
        basicDefend?: boolean;
        basicParry?: boolean;
      },
      combatRhythm?: 'neutral'
    ) => void;
  }>(null);
  // WHY: 같은 방을 반복 조사해서 무한 아이템 획득을 방지.
  // 방 ID 별로 수색 완료 여부를 관리함. 이동하면 초기화되지 않음 (방 단위 쿨다운).
  const [searchedRooms, setSearchedRooms] = useState<Set<string>>(new Set());
  // 로그 전용: 방별 설치형 함정 (적이 등장할 때 1회 발동). wire = 와이어 트랩(피해+기절)
  const [roomTraps, setRoomTraps] = useState<Record<string, { type: 'spike' | 'wire'; power: number; stunTurns?: number }>>({});
  // 로그 전용: "다음에 이 방으로 들어오면 반드시 전투 발생" 플래그
  const [forcedAmbushRooms, setForcedAmbushRooms] = useState<Record<string, boolean>>({});
  /** 방 단위 적 저장소: roomId -> 적 목록 (현재 방이 아닌 곳에도 적이 “대기”할 수 있음) */
  const [roomEnemies, setRoomEnemies] = useState<Record<string, ActiveEnemy[]>>({});
  /** 방 적 유니크 ID 생성을 위한 시리얼 */
  const worldEnemySerialRef = useRef(0);
  /** 전투가 시작된 방 — 종료 시 roomEnemies 중복 제거·(승리 시) 함락 해제에 사용 */
  const combatHostRoomRef = useRef<string | null>(null);
  const prevIsCombatForRoomCleanupRef = useRef(false);
  /** 도주·은신 탈출 등: 전투 종료 후에도 방에 적을 남김 (BFS 추적 연속성) */
  const skipRoomEnemyClearAfterCombatRef = useRef(false);
  /** 사망으로 전투 종료: 방 적 목록은 비우되 마을 함락 상태는 유지 */
  const suppressInvadedSafeLiberationRef = useRef(false);

  useEffect(() => {
    activeEnemiesRef.current = activeEnemies;
    combatActiveForQteRef.current = playerState.isCombat;
  }, [activeEnemies, playerState.isCombat]);

  useEffect(() => {
    // WHY: 전투가 켜지고/꺼질 때는 "이전 전투의 타이머/보상 상태"를 반드시 초기화해야 한다.
    enemyTurnTimeoutsRef.current.forEach(id => clearTimeout(id));
    enemyTurnTimeoutsRef.current = [];
    defeatRewardedEnemyIdsRef.current.clear();
    if (playerState.isCombat) {
      nonCombatSinceCombatRef.current = 0;
      aggressiveTurnStreakRef.current = 0; // WHY: 새 전투마다 연속 닥공 카운트 초기화
    } else {
      setPlayerState((p) => {
        const m = p.thiefMirrorCorridorTurns ?? 0;
        const d = p.thiefPlayDeadCharges ?? 0;
        if (m === 0 && d === 0) return p;
        return { ...p, thiefMirrorCorridorTurns: 0, thiefPlayDeadCharges: 0 };
      });
    }
  }, [playerState.isCombat]);

  // WHY: 전투 중 activeEnemies와 roomEnemies에 같은 적이 이중 등록되면, 승리 후에도 월드 쪽 잔상이 남아
  //      재추적·함락 UI가 꼬인다. 승리 종료 시에만 방 적을 비우고, 2구역 이상 침공된 안전거점은 자동 탈환한다.
  useEffect(() => {
    const wasCombat = prevIsCombatForRoomCleanupRef.current;
    const nowCombat = playerState.isCombat;
    if (nowCombat && !wasCombat) {
      combatHostRoomRef.current = currentRoomId;
      skipRoomEnemyClearAfterCombatRef.current = false;
      suppressInvadedSafeLiberationRef.current = false;
    }
    if (!nowCombat && wasCombat) {
      const rid = combatHostRoomRef.current;
      combatHostRoomRef.current = null;
      const skippedFlee = skipRoomEnemyClearAfterCombatRef.current;
      const suppressLib = suppressInvadedSafeLiberationRef.current;
      skipRoomEnemyClearAfterCombatRef.current = false;
      suppressInvadedSafeLiberationRef.current = false;

      if (rid && !skippedFlee) {
        setRoomEnemies(prev => {
          if (!prev[rid]) return prev;
          const next = { ...prev };
          delete next[rid];
          return next;
        });
        if (!suppressLib) {
          setPlayerState(prevPlayer => {
            if (!prevPlayer.villageOccupied?.[rid]) return prevPlayer;
            const room = getRoomById(rid);
            // 초기 허브 제외 안전지대(미로 휴식처 등): 전투 승리 시 함락 해제 → 휴식 가능
            if (!room?.isSafe || !isSafeRoomSubjectToInvasion(rid)) return prevPlayer;
            return {
              ...prevPlayer,
              villageOccupied: { ...(prevPlayer.villageOccupied || {}), [rid]: false },
            };
          });
        }
      }
    }
    prevIsCombatForRoomCleanupRef.current = nowCombat;
  }, [playerState.isCombat, currentRoomId]);

  // WHY: 비전투일 때 현재 방 배경으로 장면 동기화 — 세이브 로드·일부 리스폰 경로에서 setSceneImage 누락 보완
  useEffect(() => {
    if (playerState.isCombat) return;
    const room = getRoomById(currentRoomId);
    setSceneImage(resolveRoomSceneImage(room));
  }, [currentRoomId, playerState.isCombat]);

  useEffect(() => {
    setScenePanelImgFailed(false);
  }, [sceneImage]);

  // ─── 로그인 콜백 ───────────────────────────────────────
  const handleLogin = (char: import('./utils/saveSystem').SavedCharacter, isNew: boolean) => {
    setLoggedInChar(char);
    const cAnyOuter = char as any;
    let invRowsMigrated = migrateInventoryFromStrings(cAnyOuter.inventory ?? []);
    // 동일 물약이 여러 행으로 쌓인 구세이브를 한 줄로 합침
    invRowsMigrated = consolidateStackablePotionRows(invRowsMigrated);
    const invDroppedOnLogin = Math.max(0, invRowsMigrated.length - INVENTORY_MAX_SLOTS);
    if (invDroppedOnLogin > 0) {
      invRowsMigrated = invRowsMigrated.slice(0, INVENTORY_MAX_SLOTS);
    }

    setPlayerState(prev => {
      const cAny = char as any;
      const invRows = invRowsMigrated;

      const legacyUpFromChar = (() => {
        if (typeof cAny.equipmentEffectiveGrade !== 'undefined') {
          return cAny.equipmentUpgradeLevels ?? prev.equipmentUpgradeLevels ?? {};
        }
        const oldLevels = cAny.equipmentUpgradeLevels || {};
        const newLevels: Record<string, number> = {};
        for (const [name, oldLv] of Object.entries(oldLevels)) {
          const def = getItemByName(name);
          if (!def || !['weapon', 'armor', 'shield'].includes(def.type)) continue;
          const { plus } = migrateLegacyEnchantLevel(Number(oldLv), (def.grade ?? 'common') as ItemGrade);
          newLevels[name] = plus;
        }
        return newLevels;
      })();

      const legacyEffFromChar = (() => {
        if (typeof cAny.equipmentEffectiveGrade !== 'undefined') {
          return cAny.equipmentEffectiveGrade ?? {};
        }
        const oldLevels = cAny.equipmentUpgradeLevels || {};
        const newEff: Record<string, ItemGrade> = {};
        for (const [name, oldLv] of Object.entries(oldLevels)) {
          const def = getItemByName(name);
          if (!def || !['weapon', 'armor', 'shield'].includes(def.type)) continue;
          const { tier } = migrateLegacyEnchantLevel(Number(oldLv), (def.grade ?? 'common') as ItemGrade);
          const base = (def.grade ?? 'common') as ItemGrade;
          if (tier !== base) newEff[name] = tier;
        }
        return newEff;
      })();

      let eqUp: Record<string, number> = legacyUpFromChar;
      let eqEff: Record<string, ItemGrade> = legacyEffFromChar;
      let eqDur: Record<string, number> = cAny.equipmentDurability ?? prev.equipmentDurability ?? {};

      const mapKeysLookLikeInstanceIds = (rec: Record<string, unknown> | undefined) =>
        !rec || Object.keys(rec).length === 0 || Object.keys(rec).every((k) => k.startsWith('inv_'));

      // WHY: 구세이브는 강화/내구도 키가 '아이템 이름' → 인벤 행 id로 분리 (동일 이름 다중 개별 강화)
      if (!mapKeysLookLikeInstanceIds(eqUp) || !mapKeysLookLikeInstanceIds(eqEff) || !mapKeysLookLikeInstanceIds(eqDur)) {
        const m = migrateEquipmentMapsByFirstOccurrence(invRows, eqUp, eqEff, eqDur);
        eqUp = m.equipmentUpgradeLevels;
        eqEff = m.equipmentEffectiveGrade;
        eqDur = m.equipmentDurability;
      }

      const normWeapon = normalizeEquipSlot(cAny.weapon, invRows);
      const normArmor = normalizeEquipSlot(cAny.armor, invRows);
      const normOff = normalizeEquipSlot(cAny.offHand ?? cAny.offHandWeapon ?? cAny.shield, invRows);
      let normR1 = normalizeEquipSlot(cAny.ring1, invRows);
      let normR2 = normalizeEquipSlot(cAny.ring2, invRows);
      const ringsFixed = reconcileDuplicateRingSlotIds(invRows, normR1, normR2);
      normR1 = ringsFixed.ring1;
      normR2 = ringsFixed.ring2;
      const normNk = normalizeEquipSlot(cAny.necklace, invRows);

      const next = {
        ...prev,
        ...char,
        inventory: invRows,
        weapon: normWeapon,
        armor: normArmor,
        offHand: normOff,
        ring1: normR1,
        ring2: normR2,
        necklace: normNk,
        npcs: { ...initialNpcState, ...char.npcs },
        story: {
          ...char.story,
          defeatedBosses: char.story.defeatedBosses || [],
          grantedMazeZone3FirstRune: char.story.grantedMazeZone3FirstRune === true,
          runeRestoreUsedRoomIds: Array.isArray((char.story as { runeRestoreUsedRoomIds?: string[] }).runeRestoreUsedRoomIds)
            ? [...(char.story as { runeRestoreUsedRoomIds: string[] }).runeRestoreUsedRoomIds]
            : [],
        },
        quests: {
          active: char.quests?.active || {},
          completed: char.quests?.completed || []
        },
        burnTurns: 0, freezeTurns: 0, staggerTurns: 0, poisonTurns: 0, sleepTurns: 0,
        blessTurns: 0, blessAtkBonus: 0,
        warriorTauntTurns: 0,
        warriorThornAuraTurns: 0,
        fortifyTurns: 0,
        fortifyDefBonus: 0,
        passiveSkills: (() => {
          const raw = (char as any).passiveSkills ?? prev.passiveSkills ?? [];
          return raw.filter((id: string) => !isResistPassive(id));
        })(),
        passiveLevels: (() => {
          const levels = { ...((char as any).passiveLevels ?? prev.passiveLevels ?? {}) };
          ((char as any).passiveSkills ?? prev.passiveSkills ?? []).forEach((id: string) => {
            if (isResistPassive(id)) levels[id] = (levels[id] ?? 0) + 1;
          });
          return levels;
        })(),
        equipmentUpgradeLevels: eqUp,
        equipmentEffectiveGrade: eqEff,
        equipmentDurability: eqDur,
        skillCooldowns: (char as any).skillCooldowns ?? prev.skillCooldowns ?? {},
        watchTurnsLeft: (char as any).watchTurnsLeft ?? prev.watchTurnsLeft ?? 0,
        solvedPuzzleIds: Array.isArray((char as any).solvedPuzzleIds)
          ? ([...(char as any).solvedPuzzleIds] as string[])
          : (prev.solvedPuzzleIds ?? []),
        skillLevels: (char as any).skillLevels ?? prev.skillLevels ?? {},
        weaponMasteryLevel: (char as any).weaponMasteryLevel ?? prev.weaponMasteryLevel ?? {},
        weaponMasteryExp: (char as any).weaponMasteryExp ?? prev.weaponMasteryExp ?? {},
        enemyGrowth: (char as any).enemyGrowth ?? prev.enemyGrowth ?? {},
        obeliskStrBonus: (char as any).obeliskStrBonus ?? prev.obeliskStrBonus ?? 0,
        obeliskStrTurns: (char as any).obeliskStrTurns ?? prev.obeliskStrTurns ?? 0,
        obeliskAtkBonus: (char as any).obeliskAtkBonus ?? prev.obeliskAtkBonus ?? 0,
        obeliskAtkTurns: (char as any).obeliskAtkTurns ?? prev.obeliskAtkTurns ?? 0,
        obeliskDefBonus: (char as any).obeliskDefBonus ?? prev.obeliskDefBonus ?? 0,
        obeliskDefTurns: (char as any).obeliskDefTurns ?? prev.obeliskDefTurns ?? 0,
        obeliskMaxHpBonus: (char as any).obeliskMaxHpBonus ?? prev.obeliskMaxHpBonus ?? 0,
        obeliskMaxHpTurns: (char as any).obeliskMaxHpTurns ?? prev.obeliskMaxHpTurns ?? 0,
        obeliskDexBonus: (char as any).obeliskDexBonus ?? prev.obeliskDexBonus ?? 0,
        obeliskDexTurns: (char as any).obeliskDexTurns ?? prev.obeliskDexTurns ?? 0,
        obeliskConBonus: (char as any).obeliskConBonus ?? prev.obeliskConBonus ?? 0,
        obeliskConTurns: (char as any).obeliskConTurns ?? prev.obeliskConTurns ?? 0,
        obeliskIntBonus: (char as any).obeliskIntBonus ?? prev.obeliskIntBonus ?? 0,
        obeliskIntTurns: (char as any).obeliskIntTurns ?? prev.obeliskIntTurns ?? 0,
        obeliskSprBonus: (char as any).obeliskSprBonus ?? prev.obeliskSprBonus ?? 0,
        obeliskSprTurns: (char as any).obeliskSprTurns ?? prev.obeliskSprTurns ?? 0,
        villageWallHp: (() => {
          const init = createInitialVillageWallHp();
          const saved = (char as any).villageWallHp as Record<string, number> | undefined;
          const out = { ...init };
          if (saved) {
            for (const k of Object.keys(out)) {
              if (typeof saved[k] === 'number') out[k] = Math.max(0, Math.floor(saved[k]));
            }
          }
          return out;
        })(),
        villageOccupied: sanitizeVillageOccupiedForImmutableZone1((char as any).villageOccupied),
        mazePollution: Math.max(0, Math.floor(Number((char as any).mazePollution ?? prev.mazePollution ?? 0) || 0)),
        battlePosture: isBattlePosture((char as any).battlePosture)
          ? (char as any).battlePosture
          : 'balanced',
        equippedRuneId: (cAny.equippedRuneId as string | null | undefined) ?? prev.equippedRuneId ?? null,
        equippedRuneSecondaryId:
          (cAny.equippedRuneSecondaryId as string | null | undefined) ?? prev.equippedRuneSecondaryId ?? null,
        bountyNpc: (() => {
          const b = cAny.bountyNpc;
          if (!b || typeof b !== 'object' || typeof (b as { roomId?: unknown }).roomId !== 'string') return null;
          const o = b as { id?: unknown; displayName?: unknown; roomId: string; creditReward?: unknown };
          return {
            id: typeof o.id === 'string' && o.id.length > 0 ? o.id : `bounty_${Math.random().toString(36).slice(2, 10)}`,
            displayName: typeof o.displayName === 'string' ? o.displayName : '익명 청부 에이전트',
            roomId: o.roomId,
            creditReward: Math.max(1, Math.floor(Number(o.creditReward) || 99)),
          };
        })(),
        manaShieldActive:
          typeof cAny.manaShieldActive === 'boolean' ? cAny.manaShieldActive : false,
        runeMarkTargetId: null,
        runeIronFortressTurns: 0,
        runePoisonWeaponTurns: 0,
        runeSkeletonAllyStrikes: 0,
        runeSoulSummonActive: false,
        runeWindDashDodgeTurns: 0,
        runeMirageTurns: 0,
        runeCounterStanceTurns: 0,
        runeNextDamageMult: null,
      };
      // WHY: 만렙 50·새 EXP 곡선에 맞게 구세이브 레벨/경험치를 정리한다.
      const lvNorm = normalizePlayerLevelProgress(next.level, next.exp, next.maxExp);
      next.level = lvNorm.level;
      next.exp = lvNorm.exp;
      next.maxExp = lvNorm.maxExp;
      const rid1 = next.equippedRuneId;
      const rid2 = next.equippedRuneSecondaryId ?? null;
      // WHY: 룬 장착은 Lv.21+ — 미만이면 주·보조 모두 해제 후 스킬만 정리
      if (next.level >= RUNE_EQUIP_MIN_LEVEL) {
        next.skills = applyEquippedRuneSkillsToList(next.skills, rid1, rid2);
        next.equippedRuneQuality = rid1
          ? pickBestInventoryRuneQualityForRuneId(next.inventory, rid1 as RuneId)
          : 1;
        next.equippedRuneSecondaryQuality = rid2
          ? pickBestInventoryRuneQualityForRuneId(next.inventory, rid2 as RuneId)
          : 1;
      } else {
        next.equippedRuneId = null;
        next.equippedRuneSecondaryId = null;
        next.equippedRuneQuality = 1;
        next.equippedRuneSecondaryQuality = 1;
        next.skills = applyEquippedRuneSkillsToList(next.skills, null, null);
      }
      const { maxHp, maxMp } = getEffectiveMaxHpMp(next, char.job);
      next.maxHp = maxHp;
      next.maxMp = maxMp;
      next.hp = Math.min(next.hp, maxHp);
      next.mp = Math.min(next.mp, maxMp);
      // WHY: 구버그(대검 선제공격 사망 등)로 HP 0이 저장된 캐릭터 복구
      if (next.hp <= 0) next.hp = Math.min(maxHp, 5);
      return next;
    });

    const savedRoomId = char.currentRoomId ?? STARTING_ROOM_ID;
    setCurrentRoomId(savedRoomId);
    const room = getRoomById(savedRoomId);
    setLogs([
      `[SYSTEM] 제로 러너 [${char.name}] 인증 완료.`,
      isNew
        ? `🌟 새 게임 시작 — 위치: ${room?.name ?? '홍대 지하 클리닉'}`
        : `📂 세이브 불러오기 — ${room?.name ?? '홍대 지하 클리닉'}에서 재시작.`,
      ...(invDroppedOnLogin > 0
        ? [
            '',
            `⚠️ 인벤은 최대 ${INVENTORY_MAX_SLOTS}칸입니다. 초과 ${invDroppedOnLogin}개는 제거되었습니다. (앞쪽 ${INVENTORY_MAX_SLOTS}칸만 유지) 착용 슬롯은 인벤에 남은 인스턴스 기준으로 다시 맞춰졌습니다.`,
          ]
        : []),
      '',
      '━━━━━━━━━━ [ 스토리 ] ━━━━━━━━━━',
      WORLDVIEW_ONE_LINE,
      '',
      `▶ [최종 목표] ${MAIN_GOAL_TEXT}`,
      '▶ 진행이 궁금하면 \'스토리\' 또는 \'목표\' 명령으로 다시 볼 수 있습니다.',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      room?.description ?? '어두운 장소다.',
      `이동 가능한 출구: ${getExitsInDisplayOrder(room?.exits ?? {}).join(', ') || '없음'}`,
      '',
      '\'이동 북/남/동/서\' 로 이동 · \'도움말\' 명령 · \'설정\' 게임 백과',
    ]);
  };

  // ─── 헬퍼 함수 ────────────────────────────────────────
  // ─────────────────────────────────────────
  // Room 사거리/원거리 사격 시스템
  // WHY: "방을 들어가기 전에 원거리로 견제"하는 선택지를 제공하면 전술이 생기고,
  //      로그(저격수) 판타지가 더 또렷해진다.
  // 규칙:
  // - shoot [방향] [대상]: 지면 최대 2칸, 고지(elevation≥1)에서는 사거리 +1칸
  // - 적이 아직 플레이어를 인지하기 전(=alerted=false) 첫 타에는 "무방비" 보너스 데미지
  // - 고지에 서 있으면 근접(비마법) 피격 시 회피·적 명중에 유리
  // ─────────────────────────────────────────
  const BASE_RANGED_REACH_TILES = 2;
  const getPlayerRangedReachTiles = (): number => {
    const elev = getRoomElevation(currentRoomId);
    let reach = BASE_RANGED_REACH_TILES + (elev >= 1 ? 1 : 0);
    if (playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'tracker')) reach += 1;
    return reach;
  };

  const getLineRooms = (fromRoomId: string, dir: '북' | '남' | '동' | '서', maxSteps: number): string[] => {
    const out: string[] = [];
    let cur = fromRoomId;
    for (let step = 0; step < maxSteps; step++) {
      const room = getRoomById(cur);
      const exits = getVisibleExits(room);
      const nextId = exits?.[dir] as string | undefined;
      if (!nextId) break;
      out.push(nextId);
      cur = nextId;
    }
    return out;
  };

  const hasTigerSwiftActive = (): boolean => {
    // "호랑이의 신속" 옵션이 장비 어딘가에 붙어있으면 원거리 스킬 쿨타임 감소
    const slots = [
      playerState.weapon,
      playerState.offHand,
      playerState.armor,
      (playerState as any).ring1,
      (playerState as any).ring2,
      (playerState as any).necklace,
    ].filter(Boolean) as string[];
    return slots.some((slot) => {
      const n = resolveSlotToItemName(slot, playerState.inventory);
      return n.includes('호랑이의 신속') || (n.includes('호랑이의') && n.includes('신속'));
    });
  };

  const isRangedWeaponEquipped = (): boolean => {
    const wName = resolveSlotToItemName(playerState.weapon, playerState.inventory);
    const w = getItemByName(wName || '');
    return w?.weaponClass === 'bow' || wName.includes('활') || wName.includes('석궁');
  };

  const isRangedSkill = (skillName: string): boolean => {
    const s = (skillName || '').trim();
    return (
      s.includes('화살') ||
      s.includes('샷') ||
      s.includes('샤워') ||
      s.includes('멀티샷') ||
      s.includes('난사') ||
      s.includes('스나이프') ||
      s.includes('도주 사격') ||
      s.includes('저격')
    );
  };

  /** 토글·비전투 전용 등 — 전역 쿨을 주지 않는 스킬 */
  const SKILL_EXEMPT_GLOBAL_COOLDOWN = new Set<string>(['마나 실드']);

  const getBaseSkillCooldownTurns = (skillName: string): number => {
    if (SKILL_EXEMPT_GLOBAL_COOLDOWN.has(skillName)) return 0;
    // 턴 단위 — 위력·범위가 클수록 길게. 미등록 스킬은 기본 2턴(남용 방지).
    const map: Record<string, number> = {
      // 마법사
      '매직 미사일': 1,
      '파이어볼': 3,
      '라이트닝 볼트': 2,
      '체인 라이트닝': 3,
      '아이스 스피어': 2,
      '메테오 스트라이크': 4,
      '블리자드': 4,
      '펄스 노바': 3,
      '스타폴': 4,
      '마력의 순환': 3,
      // 성직자
      '힐': 2,
      '회복의 빛': 2,
      '홀리 스마이트': 3,
      '신의 방패': 3,
      '불굴의 의지': 2,
      '광폭화': 3,
      '축복': 2,
      '구원의 손길': 2,
      '회복 기도': 2,
      '생명력 전환': 3,
      '정화': 2,
      '징벌': 2,
      '천벌': 2,
      // 전사·도적 공용 단일 타격 뭉치는 아래 별도 분기에서 개별값 유지
      '돌진': 2,
      '처형': 2,
      '급소 찌르기': 2,
      '맹독 단검': 2,
      '페인 딜러': 2,
      '라스트 콜': 3,
      '지갑선 끊기': 1,
      '스나이프': 4,
      '헤드샷': 5,
      '휠윈드': 3,
      '독 폭탄': 3,
      '난사': 4,
      '도발': 2,
      '반격 태세': 2,
      '철벽': 2,
      '갑옷 파쇄': 3,
      '표식 참격': 2,
      '방패 강타': 2,
      '가시 갑옷': 3,
      '일격필살': 3,
      // 도적
      '파워 스트라이크': 2,
      '음파 폭발': 3,
      '사이버 클로': 2,
      '의지의 방어막': 2,
      '데이터 도둑': 2,
      '섀도우 스텝': 2,
      '거울 복도': 3,
      '죽은 척 오스': 2,
      '은신': 3,
      '스틸': 4,
      '와이어 트랩': 3,
      '철수': 2,
      '패링': 1,
      // 로그(활)
      '애기살': 2,
      '멀티샷': 3,
      '에로우 샤워': 5,
      '얼음 화살': 2,
      '화염 화살': 2,
      '폭발 화살': 4,
      '도주 사격': 3,
      // 강령/룬/기타 전투 스킬
      '프렌지': 3,
      '심판': 3,
      '암살': 3,
      '표식': 2,
      '해골 소환': 4,
      '룬 카운터': 2,
      '수호의 외침': 3,
      '대시': 2,
      '독 도포': 2,
      '올인': 4,
      '영혼 교체': 5,
      '오버로드': 4,
      '철의 요새': 4,
      '미라지': 3,
      '명상': 2,
    };
    if (map[skillName] !== undefined) return map[skillName]!;
    return 2;
  };

  const getAdjustedSkillCooldownTurns = (skillName: string): number => {
    const base = getBaseSkillCooldownTurns(skillName);
    if (base <= 0) return 0;
    // 호랑이의 신속: 원거리 스킬 쿨타임 20% 감소
    if (hasTigerSwiftActive() && isRangedSkill(skillName)) {
      return Math.max(1, Math.ceil(base * 0.8));
    }
    return base;
  };

  /** 스킬 사용 성공 시 state에 병합할 쿨타임 조각 */
  const mergeSkillCooldown = (
    p: typeof playerState,
    skillName: string
  ): { skillCooldowns?: Record<string, number> } => {
    const turns = getAdjustedSkillCooldownTurns(skillName);
    if (turns <= 0) return {};
    return { skillCooldowns: { ...(p.skillCooldowns || {}), [skillName]: turns } };
  };

  const getShortestStepToward = (
    fromRoomId: string,
    targetRoomId: string,
    maxDepth: number,
    opts?: { forHostile?: boolean; wallHp?: Record<string, number> }
  ): string | null => {
    if (fromRoomId === targetRoomId) return null;
    const forHostile = opts?.forHostile ?? false;
    const wallHp = opts?.wallHp ?? {};
    // BFS (깊이 제한): maxDepth 내에서 한 칸씩 다가오기 위한 "다음 방"을 찾는다.
    const visited = new Set<string>([fromRoomId]);
    const queue: Array<{ roomId: string; firstStep: string; depth: number }> = [];
    const startRoom = getRoomById(fromRoomId);
    const startExits = getVisibleExits(startRoom);
    Object.values(startExits || {}).forEach(nId => {
      const next = String(nId);
      if (forHostile && isHostileMoveBlockedByWall(fromRoomId, next, wallHp)) return;
      // WHY: [홍대 지하 클리닉]·[지하 슬럼 상점가]만 적 진입 불가. 그 외 안전지대(심층 미로 휴식처 등)는 침공 가능.
      if (forHostile && isHostileMoveBlockedZone1Protection(fromRoomId, next)) return;
      visited.add(next);
      queue.push({ roomId: next, firstStep: next, depth: 1 });
    });
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node.roomId === targetRoomId) return node.firstStep;
      if (node.depth >= maxDepth) continue;
      const room = getRoomById(node.roomId);
      const exits = getVisibleExits(room);
      Object.values(exits || {}).forEach(nId => {
        const next = String(nId);
        if (visited.has(next)) return;
        if (forHostile && isHostileMoveBlockedByWall(node.roomId, next, wallHp)) return;
        if (forHostile && isHostileMoveBlockedZone1Protection(node.roomId, next)) return;
        visited.add(next);
        queue.push({ roomId: next, firstStep: node.firstStep, depth: node.depth + 1 });
      });
    }
    return null;
  };

  // 안전지대 2~3칸 이내에서는 몬스터를 완화 (HP/공격/방어 등 스탯 감소)
  const NEAR_SAFE_ZONE_MAX_STEPS = 3;
  const NEAR_SAFE_ZONE_STAT_FACTOR = 0.72;
  const scaleEnemyNearSafeZone = (e: ActiveEnemy): ActiveEnemy => {
    const hp = Math.max(1, Math.round(e.maxHp * NEAR_SAFE_ZONE_STAT_FACTOR));
    return {
      ...e,
      maxHp: hp,
      currentHp: Math.min(e.currentHp, hp),
      atk: Math.max(1, Math.round(e.atk * NEAR_SAFE_ZONE_STAT_FACTOR)),
      def: Math.max(0, Math.round(e.def * NEAR_SAFE_ZONE_STAT_FACTOR)),
      str: Math.max(1, Math.round((e.str ?? e.atk) * NEAR_SAFE_ZONE_STAT_FACTOR)),
      weaponDmg: Math.max(1, Math.round((e.weaponDmg ?? 1) * NEAR_SAFE_ZONE_STAT_FACTOR)),
    };
  };

  const ensureRoomEnemies = (roomId: string): ActiveEnemy[] => {
    const existing = roomEnemies[roomId];
    if (existing && existing.length > 0) return existing;
    const room = getRoomById(roomId);
    // WHY: 안전지대는 기본적으로 적 없음. 성벽이 무너져 함락된 마을만 예외적으로 스폰 허용.
    if (!room || (room.isSafe && !playerState.villageOccupied?.[room.id])) return [];
    // "방에 적이 존재할 가능성"을 유지하기 위해, 필요 시(정찰/사격 등) 처음 접촉 순간에만 스폰한다.
    const isForced = !!forcedAmbushRooms[roomId];
    const distFromSafe = getMinDistanceFromSafeZone(roomId);
    const applyNearSafeScale = distFromSafe <= NEAR_SAFE_ZONE_MAX_STEPS;
    let chance = isForced ? 1 : (room.encounterChance ?? 0.25);
    if (!isForced && applyNearSafeScale) chance *= 0.6;
    if (!isForced && Math.random() >= chance) return [];
    // 안전지대 인근(2~3칸)에서는 적 수를 줄여 난이도 완화 (최대 1마리)
    const count = applyNearSafeScale ? 1 : (Math.floor(Math.random() * 3) + 1);
    const spawned = Array.from({ length: count }).map((_, i) => {
      let e2: ActiveEnemy = spawnRandomEnemy(playerState.level);
      const lv = (playerState.enemyGrowth ?? {})[e2.id]?.level ?? 0;
      if (lv > 0) e2 = applyEnemyGrowth(e2, lv);
      if (applyNearSafeScale) e2 = scaleEnemyNearSafeZone(e2);
      const serial = (worldEnemySerialRef.current += 1);
      return {
        ...e2,
        alerted: false,
        id: `${e2.id}_r_${roomId}_${serial}`,
        name: `${e2.name} ${String.fromCharCode(65 + i)}`,
      };
    });
    setRoomEnemies(prev => ({ ...prev, [roomId]: spawned }));
    return spawned;
  };

  const removeRoomEnemyById = (roomId: string, enemyId: string) => {
    setRoomEnemies(prev => {
      const list = prev[roomId] || [];
      const next = list.filter(e => e.id !== enemyId);
      const out = { ...prev };
      if (next.length === 0) delete out[roomId];
      else out[roomId] = next;
      return out;
    });
  };

  const markRoomAlerted = (roomId: string) => {
    setRoomEnemies(prev => {
      const list = prev[roomId];
      if (!list || list.length === 0) return prev;
      return { ...prev, [roomId]: list.map(e => ({ ...e, alerted: true })) };
    });
  };

  const advanceAlertedEnemies = (): { startedCombat: boolean; preemptiveLog: string; moveLog: string } => {
    // 전투 중이 아니고, 현재 방으로 "접근해온 적"이 있으면 전투를 시작한다. (1~2칸 내의 적만 접근)
    if (playerState.isCombat || activeEnemiesRef.current.length > 0) return { startedCombat: false, preemptiveLog: '', moveLog: '' };
    const snapshot = roomEnemies;
    let incoming: ActiveEnemy[] | null = null;
    const nextState: typeof snapshot = { ...snapshot };

    // WHY: 성벽이 서 있으면 적 BFS가 마을 방으로 가는 간선을 쓰지 못한다. 관문에 도달하면 성벽만 공격한다.
    let nextWallHp: Record<string, number> = { ...createInitialVillageWallHp(), ...(playerState.villageWallHp || {}) };
    for (const w of VILLAGE_WALLS) {
      if (nextWallHp[w.id] === undefined) nextWallHp[w.id] = w.maxHp;
    }
    let nextOccupied: Record<string, boolean> = { ...(playerState.villageOccupied || {}) };
    const siegeExtraLogs: string[] = [];
    let invasionNote = '';
    const wallHpForBfs = nextWallHp;

    for (const [rid, enemies] of (Object.entries(snapshot) as Array<[string, ActiveEnemy[]]>)) {
      if (!enemies || enemies.length === 0) continue;
      if (rid === currentRoomId) continue;
      if (!enemies.some(e => e.alerted)) continue;
      const step = getShortestStepToward(rid, currentRoomId, 2, { forHostile: true, wallHp: wallHpForBfs });

      if (!step) {
        const siegeDef = canSiegeWallFromGate(rid, currentRoomId, wallHpForBfs);
        if (siegeDef) {
          const dmg = Math.max(8, Math.floor(enemies.reduce((s, e) => s + (e.atk || 0), 0) / 3));
          const cur = nextWallHp[siegeDef.id] ?? siegeDef.maxHp;
          const nh = Math.max(0, cur - dmg);
          nextWallHp[siegeDef.id] = nh;
          const gateName = getRoomById(siegeDef.gateRoomId)?.name ?? '관문';
          siegeExtraLogs.push(`🧱 [공성] ${gateName} — 적이 성벽을 타격합니다! (-${dmg}, 잔여 ${nh})`);
          if (nh <= 0) {
            siegeExtraLogs.push(
              `💥 [성벽 붕괴] ${getRoomById(siegeDef.villageRoomId)?.name ?? '마을'}(이)가 외부에 노출되었습니다!`
            );
          }
        }
        continue;
      }

      const moved: ActiveEnemy[] = enemies.map(e => ({ ...e, alerted: true }));
      delete nextState[rid];
      nextState[step] = [...(nextState[step] || []), ...moved];
      if (step === currentRoomId && !incoming) incoming = moved;

      // WHY: 초기 허브(클리닉·슬럼 상점가) 제외 안전거점만 함락. 성벽 마을은 벽 HP=0일 때만 진입.
      //      무성벽 안전거점(미로 휴식처·네온 팻 등)은 적이 방에 들어오는 순간 함락.
      const stepRoom = getRoomById(step);
      if (stepRoom && isSafeRoomSubjectToInvasion(step)) {
        const wallDef = VILLAGE_WALLS.find(w => w.villageRoomId === step);
        const wallDown = !wallDef || (nextWallHp[wallDef.id] ?? 0) <= 0;
        if (wallDown && !nextOccupied[step]) {
          nextOccupied[step] = true;
          const vname = stepRoom.name ?? '마을';
          invasionNote += `\u001b[31m⚠️ [함락] 적이 [${vname}]에 진입했습니다! 휴식 거점이 무력화되었습니다.\u001b[0m\n`;
        }
      }
      nextOccupied = sanitizeVillageOccupiedForImmutableZone1(nextOccupied);
    }

    const wallHpChanged = JSON.stringify(nextWallHp) !== JSON.stringify(playerState.villageWallHp || {});
    const occChanged = JSON.stringify(nextOccupied) !== JSON.stringify(playerState.villageOccupied || {});
    if (wallHpChanged || occChanged) {
      setPlayerState(p => ({
        ...p,
        villageWallHp: { ...nextWallHp },
        villageOccupied: { ...nextOccupied },
      }));
    }

    if (JSON.stringify(nextState) !== JSON.stringify(snapshot)) {
      setRoomEnemies(nextState);
    }

    const siegePrefix = siegeExtraLogs.length > 0 ? `${siegeExtraLogs.join('\n')}\n` : '';

    if (incoming != null && incoming.length > 0) {
      const incomingList: ActiveEnemy[] = incoming;
      let finalIncoming: ActiveEnemy[] = incomingList;
      let preemptiveLog = '';

      // Overwatch(경계): 적이 이 방으로 들어오는 순간, 접근 연출보다 먼저 선제 사격
      if ((playerState.watchTurnsLeft ?? 0) > 0 && isRangedWeaponEquipped() && !isBroken(playerState.weapon || '')) {
        const { effStr, effDex, effAtk, effCritChance, effPhysCritMult } = getEffectiveStats();
        const first = finalIncoming[0];
        const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
        const weapon = getMergedEquippedItem(playerState.weapon, playerState.inventory);
        const wNm = resolveInstanceIdForSlot(playerState.weapon, playerState.inventory) ?? playerState.weapon ?? '';
        const wEnchant = weapon
          ? resolveEquipmentEnchant(wNm, weapon, playerState.equipmentEffectiveGrade, playerState.equipmentUpgradeLevels)
          : { tier: 'common' as ItemGrade, plus: 0 };
        const wAtkBonus = getEnchantStatBonusFromTierPlus(wEnchant.tier, wEnchant.plus);
        const weaponAttr = getPlayerWeaponAttr();
        const attrModifier = getDamageModifier(weaponAttr, first.armorAttr);
        const wpPenalty = getWeaponPenalty();
        const minWeaponDmg = (weapon?.minDamage ?? 1) + wAtkBonus;
        const maxWeaponDmg = (weapon?.maxDamage ?? 3) + wAtkBonus;
        const roll = Math.floor(Math.random() * (Math.max(minWeaponDmg, maxWeaponDmg) - Math.min(minWeaponDmg, maxWeaponDmg) + 1)) + Math.min(minWeaponDmg, maxWeaponDmg);
        const penetrationStat = weaponAttr === '피어싱' ? (effDex || effStr) : effStr;
        const defFactor = (100 + penetrationStat) / (100 + first.def);
        const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
        const isCrit = Math.random() < critChance;
        const critMult = isCrit ? effPhysCritMult : 1.0;
        const randMult = 0.92 + Math.random() * 0.16;
        const basePart = (effAtk * randMult * critMult) + roll;
        const hitPart = pickHitPart();
        const owElevMult = getRoomElevation(currentRoomId) >= 1 ? 1.12 : 1.0;
        const dmg = Math.max(1, Math.round(basePart * defFactor * attrModifier * wpPenalty * 0.38 * optionFx.damageMult * owElevMult));
        const newHp = first.currentHp - dmg;
        const critTag = isCrit ? ' \u001b[91mCRIT!\u001b[0m' : '';
        const elevLine =
          owElevMult > 1
            ? '\n⛰️ 고각에서 탄도가 깎이지 않는다 — 아래를 향한 일점사가 먼저 적의 위협을 거둔다.'
            : '\n시야 끝에서 방아쇠가 먼저 떨어진다 — 침묵을 찢는 날카로운 파공.';
        preemptiveLog =
          `╔════════════════════════════════════════════════════════════╗\n` +
          `║     ◆◆◆  OVERWATCH 발동 — 경계 사격 (선제)  ◆◆◆     ║\n` +
          `╚════════════════════════════════════════════════════════════╝` +
          elevLine +
          `\n⚡ [${first.name}] → ${hitPart} 관통! 피해 \u001b[93m-${dmg}\u001b[0m${critTag}`;

        // 경계 턴 소모
        setPlayerState(p => ({ ...p, watchTurnsLeft: Math.max(0, (p.watchTurnsLeft ?? 0) - 1) }));

        if (newHp <= 0) {
          // 선제 사살: 첫 적 제거 후 전투 시작(남은 적이 있으면)
          finalIncoming = finalIncoming.slice(1);
          preemptiveLog += `\n💀 ⊹ ${first.name} ⊹ 한 발에 무너진다!`;
        } else {
          finalIncoming = [{ ...first, currentHp: newHp, alerted: true }, ...finalIncoming.slice(1).map(e => ({ ...e, alerted: true }))];
          preemptiveLog += `\n◇ 적은 비틀거리지만 아직 서 있다… (남은 HP ${newHp})`;
        }
      }

      if (finalIncoming.length === 0) {
        const tail = '…하지만 발소리는 끊겼다. (경계로 적을 저지했다)';
        const extra = (siegePrefix + invasionNote).trim();
        return { startedCombat: false, preemptiveLog, moveLog: extra ? `${extra}\n${tail}` : tail };
      }

      const listStr = finalIncoming.map(e => `[${e.name}] HP:${e.currentHp}`).join(', ');
      setActiveEnemies(finalIncoming);
      setPlayerState(p => ({ ...p, isCombat: true, prayerHealTurns: 0, prayerHealPerTurn: 0, godShieldTurns: 0 }));
      const msg = `👣 어둠 속 발소리가 가까워진다...\n⚠️ 접근한 적이 당신을 덮쳤다!\n${listStr}\n'공격' 또는 '스킬'로 대응하세요!`;
      const firstForImg = finalIncoming[0];
      setSceneImage(resolveEnemySceneImage(firstForImg.imageKey, firstForImg.id));
      return { startedCombat: true, preemptiveLog, moveLog: siegePrefix + invasionNote + msg };
    }
    const tailOnly = (siegePrefix + invasionNote).trim();
    return { startedCombat: false, preemptiveLog: '', moveLog: tailOnly };
  };

  // ─────────────────────────────────────────
  // 장비 내구도/수리 시스템
  // WHY: 장비가 파손될 수 있다면, 복구(수리) 루프가 반드시 있어야 진행이 막히지 않는다.
  // 규칙:
  // - 전투 중 조금씩 내구도 감소
  // - 내구도 0이면 파손(해당 장비의 공격/방어/보너스가 적용되지 않음)
  // - 안전지대에서 '수리' 명령으로 복구
  // ─────────────────────────────────────────
  const getMaxDurabilityForInstanceId = (instanceId: string): number => {
    const row = playerState.inventory.find((r) => r.id === instanceId);
    const itemName = row?.name ?? instanceId;
    const it = getItemByName(itemName);
    if (!it) return 50;
    const { tier, plus } = resolveEquipmentEnchant(instanceId, it, playerState.equipmentEffectiveGrade, playerState.equipmentUpgradeLevels);
    const upBonus = getEnchantDurabilityBonusFromTierPlus(tier, plus);
    if (it.type === 'weapon') return 45 + upBonus;
    if (it.type === 'armor') return 70 + upBonus;
    if (it.type === 'shield') return 60 + upBonus;
    if (it.type === 'accessory') return 80 + upBonus;
    return 50 + upBonus;
  };

  const getDurability = (instanceId: string): { cur: number; max: number } => {
    const max = getMaxDurabilityForInstanceId(instanceId);
    const cur = (playerState.equipmentDurability || {})[instanceId];
    // 내구도 값이 없으면 "신품"으로 간주
    return { cur: (cur == null ? max : Math.max(0, cur)), max };
  };

  const isBroken = (slot: string | null | undefined): boolean => {
    if (!slot) return false;
    const id = resolveInstanceIdForSlot(slot, playerState.inventory) ?? slot;
    const { cur } = getDurability(id);
    return cur <= 0;
  };

  /** 상단 EQUIPMENT HUD용: 내구도 추적 대상 장비만 "현재/최대" 문자열로 반환 */
  const formatHudSlotDurability = (slot: string | null | undefined): string | null => {
    if (!slot) return null;
    const id = resolveInstanceIdForSlot(slot, playerState.inventory) ?? slot;
    const displayName = resolveSlotToItemName(slot, playerState.inventory);
    const it = getItemByName(displayName);
    if (!it || !['weapon', 'armor', 'shield', 'accessory'].includes(it.type)) return null;
    const { cur, max } = getDurability(id);
    return `${cur}/${max}`;
  };

  const damageDurability = (slot: string | null | undefined, amount: number, reason: string) => {
    if (!slot || amount <= 0) return;
    const instanceId = resolveInstanceIdForSlot(slot, playerState.inventory) ?? slot;
    const displayName = resolveSlotToItemName(slot, playerState.inventory);
    const it = getItemByName(displayName);
    if (!it) return;
    if (!['weapon', 'armor', 'shield', 'accessory'].includes(it.type)) return;

    setPlayerState((prev: typeof playerState) => {
      const row = prev.inventory.find((r) => r.id === instanceId);
      const itemName = row?.name ?? displayName;
      const itemDef = getItemByName(itemName);
      if (!itemDef) return prev;
      const max = (() => {
        const { tier, plus } = resolveEquipmentEnchant(instanceId, itemDef, prev.equipmentEffectiveGrade, prev.equipmentUpgradeLevels);
        const upBonus = getEnchantDurabilityBonusFromTierPlus(tier, plus);
        if (itemDef.type === 'weapon') return 45 + upBonus;
        if (itemDef.type === 'armor') return 70 + upBonus;
        if (itemDef.type === 'shield') return 60 + upBonus;
        if (itemDef.type === 'accessory') return 80 + upBonus;
        return 50 + upBonus;
      })();
      const cur = (prev.equipmentDurability || {})[instanceId];
      const before = (cur == null ? max : Math.max(0, cur));
      const after = Math.max(0, before - amount);

      // 파손 발생 시 1회만 강하게 알려준다.
      if (before > 0 && after === 0) {
        setLogs((l: string[]) => [...l, `💥 장비 파손! [${itemName}]이(가) ${reason}로 완전히 망가졌습니다. (수리 필요)`]);
      }
      return {
        ...prev,
        equipmentDurability: { ...(prev.equipmentDurability || {}), [instanceId]: after },
      };
    });
  };

  const repairCostPerPoint = (itemName: string): number => {
    const it = getItemByName(itemName);
    const base =
      !it ? 3
      : it.type === 'weapon' ? 4
      : it.type === 'armor' ? 3
      : it.type === 'shield' ? 3
      : it.type === 'accessory' ? 2
      : 3;
    return scaleCoinCost(base);
  };

  const getPlayerWeaponAttr = (): WeaponAttribute => {
    if (!loggedInChar) return '피어싱';
    const job = JOB_LIST.find(j => j.name === loggedInChar.job);
    const w = resolveSlotToItemName(playerState.weapon, playerState.inventory);
    if (w.includes('지팡이') || job?.name === '마법사') return '마법';
    // WHY: 창·채찍은 규칙상 관통·할퀴기에 가깝게 피어싱/슬러시로 분류해 속성 상성을 살린다.
    if (w.includes('단검') || w.includes('활') || w.includes('창') || w.includes('미늘창')) return '피어싱';
    if (w.includes('검') || w.includes('도끼') || w.includes('채찍')) return '슬러시';
    if (w.includes('둔기') || w.includes('해머')) return '크러시';
    if (w.includes('철퇴') || w.includes('메이스')) return '크러시';
    return job?.baseWeaponAttr || '피어싱';
  };

  const getPlayerArmorAttr = (): ArmorAttribute => {
    if (!loggedInChar) return '천';
    const job = JOB_LIST.find(j => j.name === loggedInChar.job);
    const a = resolveSlotToItemName(playerState.armor, playerState.inventory);
    if (a.includes('천')) return '천';
    if (a.includes('가죽')) return '가죽';
    if (a.includes('사슬')) return '사슬';
    if (a.includes('판금')) return '판금';
    return job?.baseArmorAttr || '천';
  };

  /** 일반 공격(그냥 공격) 데미지 배율. 스킬보다 낮게 유지해 스킬 가치를 높임. */
  const NORMAL_ATTACK_DAMAGE_SCALE = 0.78;
  /** 피어싱(활·단검) 평타는 effAtk+방관 반영 후 수치가 크게 올라가므로, 최종만 살짝 줄여서 체감 밸런스 */
  const PIERCING_NORMAL_SCALE = 0.4;

  const getWeaponPenalty = (): number => {
    if (!loggedInChar) return 1.0;
    const w = resolveSlotToItemName(playerState.weapon, playerState.inventory);
    if (!w) return 1.0;
    switch (loggedInChar.job) {
      case '마법사': return w.includes('지팡이') ? 1.0 : 0.5;
      case '성직자': return (w.includes('둔기') || w.includes('해머') || w.includes('철퇴') || w.includes('메이스')) ? 1.0 : 0.5;
      case '전사':
        return (
          w.includes('검') || w.includes('도검') || w.includes('장검') || w.includes('양손검') || w.includes('도끼') || w.includes('채찍')
        )
          ? 1.0
          : 0.5;
      case '도적': return w.includes('단검') ? 1.0 : 0.5;
      case '로그': return (w.includes('활') || w.includes('석궁')) ? 1.0 : 0.5;
    }
    return 1.0;
  };

  /**
   * 마법사 전용 마법 스킬 시전 가능 여부
   * WHY: weapon 슬롯은 inv_ 인스턴스 id라 문자열에 '지팡이'가 없음 — 정의·이름으로 판별
   */
  const isMageStaffEquippedForCasting = (): boolean => {
    const merged = getMergedEquippedItem(playerState.weapon, playerState.inventory);
    const name = resolveSlotToItemName(playerState.weapon, playerState.inventory) || '';
    if (!merged || merged.type !== 'weapon') return false;
    if (merged.weaponClass === 'staff') return true;
    return name.includes('지팡이') || name.includes('완드');
  };

  // 장비/장신구까지 포함한 최종 스탯 계산
  const getEffectiveStats = () => {
    const jobName = loggedInChar?.job;
    const qPri = playerState.equippedRuneQuality ?? 1;
    const qSec = playerState.equippedRuneSecondaryQuality ?? 1;
    let bonusStr = 0;
    let bonusDex = 0;
    let bonusCon = 0;
    let bonusInt = 0;
    let bonusSpr = 0;
    let bonusCritChance = 0;
    let bonusAccuracy = 0;
    if (playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'assassin')) {
      bonusCritChance +=
        0.1 *
        getRuneScaleForPassive(
          'assassin',
          playerState.equippedRuneId,
          playerState.equippedRuneSecondaryId,
          qPri,
          qSec,
          jobName,
        );
    }

    const equipSlots = [
      playerState.weapon,
      playerState.offHand,
      playerState.armor,
      (playerState as any).ring1,
      (playerState as any).ring2,
      (playerState as any).necklace,
    ].filter(Boolean) as string[];

    equipSlots.forEach((slot) => {
      // 파손 장비는 효과가 적용되지 않는다.
      if (isBroken(slot)) return;
      const it = getMergedEquippedItem(slot, playerState.inventory);
      if (!it) return;
      if (it.bonusStr) bonusStr += it.bonusStr;
      if (it.bonusDex) bonusDex += it.bonusDex;
      if (it.bonusCon) bonusCon += it.bonusCon;
      if (it.bonusInt) bonusInt += it.bonusInt;
      if (it.bonusSpr) bonusSpr += it.bonusSpr;
      if (it.bonusCritChance) bonusCritChance += it.bonusCritChance;
      if (it.bonusAccuracy) bonusAccuracy += it.bonusAccuracy;
    });

    const obStr = (playerState.obeliskStrTurns ?? 0) > 0 ? (playerState.obeliskStrBonus ?? 0) : 0;
    const obDex = (playerState.obeliskDexTurns ?? 0) > 0 ? (playerState.obeliskDexBonus ?? 0) : 0;
    const obCon = (playerState.obeliskConTurns ?? 0) > 0 ? (playerState.obeliskConBonus ?? 0) : 0;
    const obInt = (playerState.obeliskIntTurns ?? 0) > 0 ? (playerState.obeliskIntBonus ?? 0) : 0;
    const obSpr = (playerState.obeliskSprTurns ?? 0) > 0 ? (playerState.obeliskSprBonus ?? 0) : 0;
    const effStr = playerState.str + bonusStr + obStr;
    const effDex = playerState.dex + bonusDex + obDex;
    const effCon = playerState.con + bonusCon + obCon;
    const effInt = playerState.int + bonusInt + obInt;
    const effSpr = playerState.spr + bonusSpr + obSpr;

    // 공격력: 기본 ATK + 스탯 보너스 + 장착 무기 공격력(평균). 도적 쌍단검 시 보조손 단검도 합산.
    const weaponBroken = isBroken(playerState.weapon || '');
    const weapon = weaponBroken ? null : getMergedEquippedItem(playerState.weapon, playerState.inventory);
    let weaponAtk = weapon?.type === 'weapon' && weapon.minDamage != null && weapon.maxDamage != null
      ? Math.round((weapon.minDamage + weapon.maxDamage) / 2)
      : 0;
    const offHandBroken = isBroken(playerState.offHand || '');
    const offHandItem = offHandBroken ? null : getMergedEquippedItem(playerState.offHand, playerState.inventory);
    // 보조손이 단검(쌍단검)이면 공격력 75% 반영
    if (offHandItem?.type === 'weapon' && offHandItem.weaponClass === 'dagger' && weapon?.weaponClass === 'dagger')
      weaponAtk += Math.round((((offHandItem.minDamage ?? 0) + (offHandItem.maxDamage ?? 0)) / 2) * 0.75);

    // 무기 마스터리 기반 공격력 보너스: 많이 쓸수록 같은 무기도 더 강해짐
    const weaponClass = weapon?.weaponClass as import('./data/weaponMastery').WeaponClass | undefined;
    const baseAtk = playerState.atk + Math.floor(effStr * 0.3) + Math.floor(effDex * 0.2) + weaponAtk;
    let effAtk = baseAtk;
    if (weaponClass) {
      const masteryLevel =
        (playerState.weaponMasteryLevel?.[weaponClass] ??
          expToLevel(playerState.weaponMasteryExp?.[weaponClass] ?? 0)) || 1;
      // Lv1 = 1.00배, Lv10 = 1.225배 (레벨당 +2.5%) — 체감은 되지만 과하지 않게
      const masteryMultiplier = 1 + (Math.max(1, masteryLevel) - 1) * 0.025;
      effAtk = Math.round(baseAtk * masteryMultiplier);
    }
    const obAtk = (playerState.obeliskAtkTurns ?? 0) > 0 ? (playerState.obeliskAtkBonus ?? 0) : 0;
    effAtk += obAtk;

    // 방어력: 기본 DEF + 갑옷 + (보조손이 방패일 때만) 방패 방어력
    const armorBroken = isBroken(playerState.armor || '');
    const playerArmor = armorBroken ? null : getMergedEquippedItem(playerState.armor, playerState.inventory);
    const playerShield = offHandItem?.type === 'shield' ? offHandItem : null;
    const armorDef = (playerArmor?.defense ?? 0) + (playerArmor?.bonusDefense ?? 0);
    const shieldDef = (playerShield?.defense ?? 0) + (playerShield?.bonusDefense ?? 0);
    const conDefBonus = Math.floor(effCon * 0.5);
    const obDef = (playerState.obeliskDefTurns ?? 0) > 0 ? (playerState.obeliskDefBonus ?? 0) : 0;
    let effDef = playerState.def + armorDef + shieldDef + conDefBonus + obDef;
    const baseCrit = 0.1;
    const effCritChance = Math.min(0.5, baseCrit + bonusCritChance);
    const effAccuracy = bonusAccuracy;

    // 태세: 공격(ATK↑ DEF↓ 자동방어↓) / 공방 / 방어(ATK↓ DEF↑ 자동방어↑) — 자동방어 확률은 triggerEnemyTurn에서 별도 적용
    {
      const posture = playerState.battlePosture ?? 'balanced';
      effAtk = Math.max(1, Math.round(effAtk * BATTLE_POSTURE_ATK_MULT[posture]));
      effDef = Math.max(0, Math.round(effDef * BATTLE_POSTURE_DEF_MULT[posture]));
    }

    // 광전사: 잃은 HP 비율에 비례해 ATK (최대 +40% × 품질·공명)
    if (playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'berserker')) {
      const cap = Math.max(1, playerState.maxHp || 1);
      const low = Math.max(0, 1 - playerState.hp / cap);
      const sc = getRuneScaleForPassive(
        'berserker',
        playerState.equippedRuneId,
        playerState.equippedRuneSecondaryId,
        qPri,
        qSec,
        jobName,
      );
      effAtk = Math.max(1, Math.round(effAtk * (1 + low * 0.4 * sc)));
    }
    // 수호자: 추가 DEF
    if (playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'guardian')) {
      effDef +=
        RUNE_GUARDIAN_DEF_FLAT *
        getRuneScaleForPassive(
          'guardian',
          playerState.equippedRuneId,
          playerState.equippedRuneSecondaryId,
          qPri,
          qSec,
          jobName,
        );
    }
    // 검투사: 근접(비마법) 보너스 — 무기 속성이 마법이 아닐 때만
    const wForMelee = weaponBroken ? null : weapon;
    if (
      playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'gladiator') &&
      wForMelee &&
      getPlayerWeaponAttr() !== '마법'
    ) {
      const sc = getRuneScaleForPassive(
        'gladiator',
        playerState.equippedRuneId,
        playerState.equippedRuneSecondaryId,
        qPri,
        qSec,
        jobName,
      );
      effAtk = Math.max(1, Math.round(effAtk * (1 + 0.12 * sc)));
    }

    const effPhysCritMult = playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'assassin')
      ? 3 +
        0.45 *
          getRuneScaleForPassive(
            'assassin',
            playerState.equippedRuneId,
            playerState.equippedRuneSecondaryId,
            qPri,
            qSec,
            jobName,
          )
      : 3.0;

    return {
      effStr,
      effDex,
      effCon,
      effInt,
      effSpr,
      effAtk,
      effDef,
      effCritChance,
      effAccuracy,
      effPhysCritMult,
    };
  };

  // ─────────────────────────────────────────
  // 장비 강화: 티어별 재료 2개 → +1 (같은 티어 내 +0~+5, +6에서 다음 티어 +0으로 승급)
  // ─────────────────────────────────────────
  // · 커먼/노멀: 커먼 2개 → +1 (노멀은 +5 후 +6에서 매직 +0)
  // · 매직: 노멀 2개 → +1 (같은 규칙으로 레어 +0)
  // · 레어: 매직 2개 → +1 → 에픽 +0
  // · 에픽: 에픽 2개 → +1, 최대 +5까지

  const getEffectiveItemGrade = (itemDef: import('./data/items').ItemData | null | undefined, instanceId: string): ItemGrade | null => {
    if (!itemDef) return null;
    return resolveEquipmentEnchant(instanceId, itemDef, playerState.equipmentEffectiveGrade, playerState.equipmentUpgradeLevels).tier;
  };

  /**
   * 상단 HUD·장비 확인·해제 안내: [효과등급] 이름 +강화
   * WHY: 착용 중 장비의 티어를 항상 같은 형식으로 보여 준다.
   */
  const formatEquipmentHudLine = (slot: string | null | undefined): string => {
    if (!slot) return '─';
    const name = resolveSlotToItemName(slot, playerState.inventory);
    const def = getItemByName(name);
    const inst = resolveInstanceIdForSlot(slot, playerState.inventory) ?? slot;
    const { tier, plus } = resolveEquipmentEnchant(inst, def, playerState.equipmentEffectiveGrade, playerState.equipmentUpgradeLevels);
    const plusStr = plus > 0 ? ` +${plus}` : '';
    return `[${ITEM_GRADE_LABEL[tier]}] ${name}${plusStr}`;
  };

  /** 악세 감정 [마나의 막] 등 — 착용 중 merged ItemData에 grantsManaShield */
  const playerHasManaShieldFromEquippedAccessories = (p: typeof playerState): boolean => {
    for (const slot of [p.ring1, p.ring2, p.necklace]) {
      if (!slot) continue;
      if (getMergedEquippedItem(slot, p.inventory)?.grantsManaShield) return true;
    }
    return false;
  };
  /** 비전서 스킬 또는 악세 옵션으로 마나 실드 토글 가능 여부 */
  const playerCanUseManaShield = (p: typeof playerState): boolean =>
    (p.skills || []).includes('마나 실드') || playerHasManaShieldFromEquippedAccessories(p);
  /** 토글 ON이며 실제로 막이 유효할 때만 true (능력 상실 시 피해 흡수·MP회복 억제 해제) */
  const isManaShieldEffectivelyActive = (p: typeof playerState): boolean =>
    !!(p.manaShieldActive && playerCanUseManaShield(p));
  /** 마나 실드가 실제로 켜져 있을 때만 MP 자연 회복 등 억제 */
  const isManaShieldRegenSuppressed = (p: typeof playerState) => isManaShieldEffectivelyActive(p);

  const skillsForSkillBar = useMemo(() => {
    const base = [...(playerState.skills || [])];
    if (playerCanUseManaShield(playerState) && !base.includes('마나 실드')) base.push('마나 실드');
    return base;
  }, [playerState.skills, playerState.inventory, playerState.ring1, playerState.ring2, playerState.necklace]);

  /** 전 직업 공통 HP/MP 회복 패시브 — Lv마다 REGEN_PER_LEVEL씩 (Lv.5=15). 비전투는 커맨드 1회당, 전투는 적 턴 종료 1회당 */
  const applyRegenPassive = (p: typeof playerState): { next: typeof playerState; logs: string[] } => {
    const levels = p.passiveLevels || {};
    const baseSkills = p.passiveSkills || [];
    // 레벨만 있거나 스킬 목록만 있는 예전 저장도 허용
    const hpLv = Math.max(levels['hp_regen'] ?? 0, baseSkills.includes('hp_regen') ? 1 : 0);
    const mpLv = Math.max(levels['mp_regen'] ?? 0, baseSkills.includes('mp_regen') ? 1 : 0);
    const hasHp = hpLv >= 1;
    const hasMp = mpLv >= 1;
    if (!hasHp && !hasMp) return { next: p, logs: [] };

    const maxHp = p.maxHp ?? p.hp;
    const maxMp = p.maxMp ?? p.mp;
    const needHp = hasHp && p.hp < maxHp;
    // WHY: 마나 실드 유지 중에는 MP 패시브 회복 금지(켠 상태가 곧 비용)
    const needMp = !isManaShieldRegenSuppressed(p) && hasMp && p.mp < maxMp;
    if (!needHp && !needMp) return { next: p, logs: [] };

    const hpAmt = needHp ? REGEN_PER_LEVEL * hpLv : 0;
    const mpAmt = needMp ? REGEN_PER_LEVEL * mpLv : 0;
    const next: typeof playerState = {
      ...p,
      ...(needHp && { hp: Math.min(maxHp, p.hp + hpAmt) }),
      ...(needMp && { mp: Math.min(maxMp, p.mp + mpAmt) }),
    };

    const logs: string[] = [];
    if (hpAmt > 0) logs.push(`💚 [HP 회복] (HP +${hpAmt})`);
    if (mpAmt > 0) logs.push(`💜 [MP 회복] (MP +${mpAmt})`);
    return { next, logs };
  };

  /** 전사 전용 분노 보너스: 분노 100 기준 +30% 공격 / -35% 피격 피해 */
  const getRageAttackMultiplier = () => {
    if (loggedInChar?.job !== '전사') return 1;
    if (rage <= 0) return 1;
    const bonus = Math.min(0.3, rage * 0.003); // 0~0.3
    return 1 + bonus;
  };

  const getRageDefenseMultiplier = () => {
    if (loggedInChar?.job !== '전사') return 1;
    if (rage <= 0) return 1;
    // 분노가 높을수록 받는 피해를 크게 감소 — 최대 35%까지
    const reduction = Math.min(0.35, rage * 0.0035); // 0~0.35
    return 1 - reduction;
  };

  const gainRage = (amount: number) => {
    if (loggedInChar?.job !== '전사' || amount <= 0) return;
    setRage(prev => Math.min(100, prev + amount));
  };

  // WHY: 장비/장신구로 올라간 CON·INT·SPR이 maxHp/maxMp에 반영되도록, 직업 기준 + 유효 스탯으로 계산
  //      고대 비석(체·지·정) 일시 버프도 동일하게 반영. 한계 HP 비석(생명의 비석) flat은 마지막에 가산.
  const getEffectiveMaxHpMp = (s: typeof playerState, jobName?: string) => {
    const job = JOB_LIST.find(j => j.name === (jobName ?? loggedInChar?.job));
    if (!job) return { maxHp: s.maxHp, maxMp: s.maxMp };
    const equipSlots = [s.weapon, s.offHand, s.armor, (s as any).ring1, (s as any).ring2, (s as any).necklace].filter(Boolean) as string[];
    let bonusCon = 0, bonusSpr = 0, bonusInt = 0;
    equipSlots.forEach((slot) => {
      const it = getMergedEquippedItem(slot, s.inventory as InventoryRow[]);
      if (!it) return;
      if (it.bonusCon) bonusCon += it.bonusCon;
      if (it.bonusSpr) bonusSpr += it.bonusSpr;
      if (it.bonusInt) bonusInt += it.bonusInt;
    });
    const obCon = (s.obeliskConTurns ?? 0) > 0 ? (s.obeliskConBonus ?? 0) : 0;
    const obSpr = (s.obeliskSprTurns ?? 0) > 0 ? (s.obeliskSprBonus ?? 0) : 0;
    const obInt = (s.obeliskIntTurns ?? 0) > 0 ? (s.obeliskIntBonus ?? 0) : 0;
    const effCon = s.con + bonusCon + obCon;
    const effSpr = s.spr + bonusSpr + obSpr;
    const effInt = s.int + bonusInt + obInt;
    let maxHp = Math.max(1, job.baseHp + 10 * (effCon - job.baseCon));
    let maxMp = Math.max(1, job.baseMp + 10 * (effSpr - job.baseSpr) + 5 * (effInt - job.baseInt));
    if (playerHasRune(s.equippedRuneId, s.equippedRuneSecondaryId, 'guardian')) {
      const qPri = s.equippedRuneQuality ?? 1;
      const qSec = s.equippedRuneSecondaryQuality ?? 1;
      const sc = getRuneScaleForPassive(
        'guardian',
        s.equippedRuneId,
        s.equippedRuneSecondaryId,
        qPri,
        qSec,
        jobName,
      );
      maxHp = Math.max(1, Math.round(maxHp * (1 + 0.2 * sc)));
    }
    if ((s.passiveSkills || []).includes('vitality')) maxHp += 15;
    if ((s.passiveSkills || []).includes('mana_flow')) maxMp += 10;
    if ((s.obeliskMaxHpTurns ?? 0) > 0 && (s.obeliskMaxHpBonus ?? 0) > 0) {
      maxHp += s.obeliskMaxHpBonus;
    }
    return { maxHp, maxMp };
  };

  // WHY: useCallback([])로 감싼 QTE 실패 핸들러가 오래된 getEffectiveMaxHpMp를 잡지 않도록 항상 최신 함수 참조
  const getEffectiveMaxHpMpRef = useRef(getEffectiveMaxHpMp);
  getEffectiveMaxHpMpRef.current = getEffectiveMaxHpMp;

  /** QTE가 끝난 뒤 대기 중이던 적 턴을 동일 클로저로 이어서 실행 */
  const flushPendingEnemyTurnAfterQte = useCallback(() => {
    const pending = pendingEnemyTurnAfterQteRef.current;
    if (!pending) return;
    pendingEnemyTurnAfterQteRef.current = null;
    queueMicrotask(() => {
      if (miniBossQteLockRef.current) return;
      const live = pending.currentEnemies.filter((e) => e.currentHp > 0);
      if (live.length === 0) return;
      pending.run(live, pending.options, pending.combatRhythm);
    });
  }, []);

  // 준보스(isMiniBoss) 전투 개시 시 ~40% 확률로 WASD QTE — 로그 먼저, 약간 뒤 오버레이(플래그는 즉시 잠금)
  useEffect(() => {
    const clearQteOpenTimer = () => {
      if (miniBossQteOpenTimerRef.current !== null) {
        window.clearTimeout(miniBossQteOpenTimerRef.current);
        miniBossQteOpenTimerRef.current = null;
      }
    };

    if (!playerState.isCombat) {
      clearQteOpenTimer();
      miniBossQteConsumedFightKeyRef.current = null;
      miniBossQteLockRef.current = false;
      pendingEnemyTurnAfterQteRef.current = null;
      setMiniBossQte(null);
      setHeavyStrikeQte(null);
      heavyStrikeQteFailContinueRef.current = null;
      heavyStrikeQteEnemyIdRef.current = null;
      return;
    }
    // WHY: 전투 직후 적 배열이 한 프레임 비는 경우 QTE가 즉시 꺼질 수 있음
    if (activeEnemies.length === 0) {
      if (miniBossQteLockRef.current) return;
      clearQteOpenTimer();
      miniBossQteConsumedFightKeyRef.current = null;
      miniBossQteLockRef.current = false;
      pendingEnemyTurnAfterQteRef.current = null;
      setMiniBossQte(null);
      setHeavyStrikeQte(null);
      heavyStrikeQteFailContinueRef.current = null;
      heavyStrikeQteEnemyIdRef.current = null;
      return;
    }
    const fightKey = [...activeEnemies.map((e) => e.id)].sort().join(',');
    if (miniBossQteConsumedFightKeyRef.current === fightKey) return;
    const mini = activeEnemies.find((e) => e.isMiniBoss);
    if (!mini) {
      miniBossQteConsumedFightKeyRef.current = fightKey;
      return;
    }
    miniBossQteConsumedFightKeyRef.current = fightKey;
    if (Math.random() > 0.42) return;
    const keys: MiniBossQteKey[] = ['w', 'a', 's', 'd'];
    const len = 4 + Math.floor(Math.random() * 2);
    const sequence = Array.from({ length: len }, () => keys[Math.floor(Math.random() * 4)] as MiniBossQteKey);
    clearQteOpenTimer();
    miniBossQteLockRef.current = true;
    const delaySec = (MINI_BOSS_QTE_OVERLAY_DELAY_MS / 1000).toFixed(1);
    setLogs((prev) => [
      ...prev,
      `🎮 [리듬 대응] ⚠ ${mini.name}의 압박! 약 ${delaySec}초 뒤 화면 중앙에 오버레이가 열립니다. 열리면 WASD 순서를 확인한 뒤 곧바로 박자·타이머가 시작됩니다.`,
    ]);
    miniBossQteOpenTimerRef.current = window.setTimeout(() => {
      miniBossQteOpenTimerRef.current = null;
      if (!combatActiveForQteRef.current) {
        miniBossQteLockRef.current = false;
        flushPendingEnemyTurnAfterQte();
        return;
      }
      const live = activeEnemiesRef.current;
      if (live.length === 0) {
        miniBossQteLockRef.current = false;
        flushPendingEnemyTurnAfterQte();
        return;
      }
      const stillMini = live.find((e) => e.isMiniBoss);
      if (!stillMini) {
        miniBossQteLockRef.current = false;
        flushPendingEnemyTurnAfterQte();
        return;
      }
      setMiniBossQte({ enemyName: stillMini.name, sequence });
    }, MINI_BOSS_QTE_OVERLAY_DELAY_MS);
  }, [playerState.isCombat, activeEnemies, flushPendingEnemyTurnAfterQte]);

  /** QTE 성공: 준보스에게 기절 턴 +1, 입력 잠금 해제 */
  const resolveMiniBossQteSuccess = useCallback(() => {
    const snap = miniBossQte;
    const hadPendingEnemyTurn = pendingEnemyTurnAfterQteRef.current != null;
    miniBossQteLockRef.current = false;
    setMiniBossQte(null);
    if (!snap) {
      flushPendingEnemyTurnAfterQte();
      if (!hadPendingEnemyTurn) {
        setLogs((prev) => [
          ...prev,
          '⏩ [리듬 대응 종료] 아직 적 턴이 예약되지 않은 상태였습니다. 멈춘 게 아니라 당신의 턴입니다 — 공격·스킬 등 명령을 입력하세요.',
        ]);
      }
      return;
    }
    setActiveEnemies((prev) =>
      prev.map((e) =>
        e.name === snap.enemyName && e.isMiniBoss
          ? clearEnemyHeavyIntent({ ...e, stunTurns: (e.stunTurns ?? 0) + 1 })
          : e
      )
    );
    setLogs((prev) => [...prev, `✅ [리듬 대응 성공] ${snap.enemyName}에게 1턴 기절을 겹쳐 적용했습니다.`]);
    flushPendingEnemyTurnAfterQte();
    if (!hadPendingEnemyTurn) {
      setLogs((prev) => [
        ...prev,
        '⏩ [리듬 대응 종료] 당신의 턴입니다. 공격·스킬·태세 등 명령을 입력하세요.',
      ]);
    }
  }, [miniBossQte, flushPendingEnemyTurnAfterQte]);

  /** QTE 실패: 최대 HP 비율로 소량 피해, 잠금 해제 */
  const resolveMiniBossQteFail = useCallback(() => {
    const hadPendingEnemyTurn = pendingEnemyTurnAfterQteRef.current != null;
    miniBossQteLockRef.current = false;
    setMiniBossQte(null);
    setPlayerState((prev) => {
      const { maxHp } = getEffectiveMaxHpMpRef.current(prev);
      const damage = Math.max(1, Math.floor(maxHp * 0.07));
      return { ...prev, hp: Math.max(1, prev.hp - damage) };
    });
    setLogs((prev) => [...prev, '💥 [리듬 대응 실패] 압박에 휘말려 HP가 크게 깎였습니다. (최대 HP 약 7%)']);
    flushPendingEnemyTurnAfterQte();
    if (!hadPendingEnemyTurn) {
      setLogs((prev) => [
        ...prev,
        '⏩ [리듬 대응 종료] 당신의 턴입니다. 공격·스킬·태세 등 명령을 입력하세요.',
      ]);
    }
  }, [flushPendingEnemyTurnAfterQte]);

  /** 강공격 QTE 성공: 회피와 동일 — 피해 없음, 해당 적 atkBuff 틱만 감소 */
  const resolveHeavyStrikeQteSuccess = useCallback(() => {
    miniBossQteLockRef.current = false;
    setHeavyStrikeQte(null);
    heavyStrikeQteFailContinueRef.current = null;
    const eid = heavyStrikeQteEnemyIdRef.current;
    heavyStrikeQteEnemyIdRef.current = null;
    if (eid) {
      setLogs((prev) => [
        ...prev,
        '✅ [강공 대응] 타이밍을 맞춰 강공격을 비켰습니다! (QTE 성공 = 회피 판정)',
      ]);
      setActiveEnemies((prev) =>
        prev.map((e) =>
          e.id === eid
            ? {
                ...e,
                atkBuffTurns: Math.max(0, (e.atkBuffTurns ?? 0) - 1),
                atkBuffBonus: (e.atkBuffTurns ?? 0) <= 1 ? 0 : (e.atkBuffBonus ?? 0),
              }
            : e,
        ),
      );
    }
  }, []);

  /** 강공격 QTE 실패: 패시브 회피 없이 명중·피해 계산만 이어감 */
  const resolveHeavyStrikeQteFail = useCallback(() => {
    setHeavyStrikeQte(null);
    heavyStrikeQteEnemyIdRef.current = null;
    const cont = heavyStrikeQteFailContinueRef.current;
    heavyStrikeQteFailContinueRef.current = null;
    if (cont) cont();
    else miniBossQteLockRef.current = false;
  }, []);

  /** 우측 HP 레일 — 맞을 때 튀어나가는 피해 숫자(DESIGN.md 흐름, 가벼운 CSS만) */
  const playerDamagePopKeyRef = useRef(0);
  const [playerDamagePop, setPlayerDamagePop] = useState<PlayerDamagePop | null>(null);
  const firePlayerDamagePop = useCallback((finalDmg: number, hpLoss: number, mpLoss: number) => {
    if (finalDmg <= 0 && hpLoss <= 0 && mpLoss <= 0) return;
    playerDamagePopKeyRef.current += 1;
    setPlayerDamagePop({
      key: playerDamagePopKeyRef.current,
      finalDmg,
      hpLoss,
      mpLoss,
    });
  }, []);

  useEffect(() => {
    if (!playerDamagePop) return;
    const t = window.setTimeout(() => setPlayerDamagePop(null), 1150);
    return () => window.clearTimeout(t);
  }, [playerDamagePop]);

  // ─── 커맨드 핸들러 ─────────────────────────────────────
  const handleCommand = (cmd: string) => {
    // React Strict Mode(dev)에서 같은 커맨드가 2번 호출되는 것을 막기 위한 가드
    if (handlingCommandRef.current) return;
    // 준보스 QTE: 지연 중(로그만) 또는 오버레이 열림 — 텍스트 명령 막음 (적 턴 pending과 동기)
    if (miniBossQteLockRef.current) {
      const waitMsg = miniBossQte
        ? '⚠ [리듬 QTE] WASD 또는 화면 버튼으로 순서를 먼저 맞추세요.'
        : heavyStrikeQte
          ? '⚠ [강공 대응] WASD 또는 화면 버튼으로 표시된 키를 맞추세요.'
          : `⚠ [리듬 대응] 약 ${(MINI_BOSS_QTE_OVERLAY_DELAY_MS / 1000).toFixed(1)}초 안에 화면 중앙 창이 열립니다. 열릴 때까지 잠시만 기다려 주세요.`;
      setLogs((prev) => [...prev, `> ${cmd}`, waitMsg]);
      return;
    }
    handlingCommandRef.current = true;

    setLogs(prev => [...prev, `> ${cmd}`]);

    setTimeout(() => {
      try {
        // React Strict Mode에서는 이 콜백이 개발 모드에서 2번 호출될 수 있으므로,
      // 비전투 DoT/회복 로그는 커맨드 1회당 1번만 찍히도록 플래그를 초기화한다.
      nonCombatDotAppliedRef.current = false;
      nonCombatRegenAppliedRef.current = false;
      // 이 커맨드 처리 중 "플레이어가 모든 적을 처치해 전투가 끝났는지"를 추적하는 플래그
      let combatEndedThisCommand = false;
      // 이 커맨드 처리 중 "전투가 시작됐는지"를 추적하는 플래그 (상태 업데이트 비동기로 인한 이중 전투 시작 방지)
      let combatStartedThisCommand = false;
      let response = '';
      const input = cmd.trim();
      const {
        effStr,
        effDex,
        effCon,
        effInt,
        effSpr,
        effAtk,
        effDef,
        effCritChance,
        effAccuracy,
        effPhysCritMult,
      } = getEffectiveStats();
      const magCritMult = (isCrit: boolean, base: number = 1.5) => {
        if (!isCrit) return 1;
        if (!playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'war_mage')) return base;
        const wmSc = getRuneScaleForPassive(
          'war_mage',
          playerState.equippedRuneId,
          playerState.equippedRuneSecondaryId,
          playerState.equippedRuneQuality ?? 1,
          playerState.equippedRuneSecondaryQuality ?? 1,
          loggedInChar?.job,
        );
        return base * (1 + 0.5 * wmSc);
      };

      // 턴 기반 쿨타임/상태 감소: "이번 커맨드 처리"가 시작될 때 1틱 줄인다.
      // WHY: 스킬 사용 직후(같은 커맨드) 바로 줄어드는 것처럼 보이는 문제를 피하기 위해,
      //      커맨드 시작 시점에 감소를 적용한다.
      setPlayerState(prev => {
        const cd = prev.skillCooldowns || {};
        const nextCd: Record<string, number> = {};
        Object.entries(cd).forEach(([k, v]) => {
          const nv = Math.max(0, (v || 0) - 1);
          if (nv > 0) nextCd[k] = nv;
        });
        const nextWatch = Math.max(0, (prev.watchTurnsLeft ?? 0) - 1);
        let next: typeof prev = { ...prev, skillCooldowns: nextCd, watchTurnsLeft: nextWatch };
        // 비석 버프: 커맨드 1회당 잔여 턴 1 감소 (0이면 보너스 제거). 체·지·정·한계 HP 비석 만료 시 maxHp/maxMp 재계산.
        const syncHpMpFromStats = (base: typeof next) => {
          const caps = getEffectiveMaxHpMp(base);
          return {
            ...base,
            maxHp: caps.maxHp,
            maxMp: caps.maxMp,
            hp: Math.min(base.hp, caps.maxHp),
            mp: Math.min(base.mp, caps.maxMp),
          };
        };
        if ((prev.obeliskStrTurns ?? 0) > 0) {
          const t = (prev.obeliskStrTurns ?? 1) - 1;
          next.obeliskStrTurns = t;
          if (t <= 0) next.obeliskStrBonus = 0;
        }
        if ((prev.obeliskDexTurns ?? 0) > 0) {
          const t = (prev.obeliskDexTurns ?? 1) - 1;
          next.obeliskDexTurns = t;
          if (t <= 0) next.obeliskDexBonus = 0;
        }
        if ((prev.obeliskAtkTurns ?? 0) > 0) {
          const t = (prev.obeliskAtkTurns ?? 1) - 1;
          next.obeliskAtkTurns = t;
          if (t <= 0) next.obeliskAtkBonus = 0;
        }
        if ((prev.obeliskDefTurns ?? 0) > 0) {
          const t = (prev.obeliskDefTurns ?? 1) - 1;
          next.obeliskDefTurns = t;
          if (t <= 0) next.obeliskDefBonus = 0;
        }
        if ((prev.obeliskConTurns ?? 0) > 0) {
          const t = (prev.obeliskConTurns ?? 1) - 1;
          next.obeliskConTurns = t;
          if (t <= 0) {
            next.obeliskConBonus = 0;
            next = syncHpMpFromStats(next);
          }
        }
        if ((prev.obeliskIntTurns ?? 0) > 0) {
          const t = (prev.obeliskIntTurns ?? 1) - 1;
          next.obeliskIntTurns = t;
          if (t <= 0) {
            next.obeliskIntBonus = 0;
            next = syncHpMpFromStats(next);
          }
        }
        if ((prev.obeliskSprTurns ?? 0) > 0) {
          const t = (prev.obeliskSprTurns ?? 1) - 1;
          next.obeliskSprTurns = t;
          if (t <= 0) {
            next.obeliskSprBonus = 0;
            next = syncHpMpFromStats(next);
          }
        }
        if ((prev.obeliskMaxHpTurns ?? 0) > 0) {
          const t = (prev.obeliskMaxHpTurns ?? 1) - 1;
          next.obeliskMaxHpTurns = t;
          if (t <= 0) {
            next.obeliskMaxHpBonus = 0;
            next = syncHpMpFromStats(next);
          }
        }
        const cdChanged = JSON.stringify(cd) !== JSON.stringify(nextCd);
        const watchChanged = (prev.watchTurnsLeft ?? 0) !== nextWatch;
        const obChanged =
          (prev.obeliskStrTurns ?? 0) !== (next.obeliskStrTurns ?? 0) ||
          (prev.obeliskStrBonus ?? 0) !== (next.obeliskStrBonus ?? 0) ||
          (prev.obeliskDexTurns ?? 0) !== (next.obeliskDexTurns ?? 0) ||
          (prev.obeliskDexBonus ?? 0) !== (next.obeliskDexBonus ?? 0) ||
          (prev.obeliskAtkTurns ?? 0) !== (next.obeliskAtkTurns ?? 0) ||
          (prev.obeliskAtkBonus ?? 0) !== (next.obeliskAtkBonus ?? 0) ||
          (prev.obeliskDefTurns ?? 0) !== (next.obeliskDefTurns ?? 0) ||
          (prev.obeliskDefBonus ?? 0) !== (next.obeliskDefBonus ?? 0) ||
          (prev.obeliskConTurns ?? 0) !== (next.obeliskConTurns ?? 0) ||
          (prev.obeliskConBonus ?? 0) !== (next.obeliskConBonus ?? 0) ||
          (prev.obeliskIntTurns ?? 0) !== (next.obeliskIntTurns ?? 0) ||
          (prev.obeliskIntBonus ?? 0) !== (next.obeliskIntBonus ?? 0) ||
          (prev.obeliskSprTurns ?? 0) !== (next.obeliskSprTurns ?? 0) ||
          (prev.obeliskSprBonus ?? 0) !== (next.obeliskSprBonus ?? 0) ||
          (prev.obeliskMaxHpTurns ?? 0) !== (next.obeliskMaxHpTurns ?? 0) ||
          (prev.obeliskMaxHpBonus ?? 0) !== (next.obeliskMaxHpBonus ?? 0) ||
          prev.maxHp !== next.maxHp ||
          prev.maxMp !== next.maxMp ||
          prev.hp !== next.hp ||
          prev.mp !== next.mp;
        if (!cdChanged && !watchChanged && !obChanged) return prev;
        return next;
      });

          // 레이지 자연 감소: 전투가 아닌 행동이 5회 이상 이어지면, 행동마다 분노가 서서히 식어감
          if (!playerState.isCombat) {
            nonCombatSinceCombatRef.current += 1;
            if (nonCombatSinceCombatRef.current >= 5 && rage > 0) {
              setRage(prev => Math.max(0, prev - 10)); // 행동 한 번당 10씩 감소
            }
          } else {
            nonCombatSinceCombatRef.current = 0;
          }

      const handleEnemiesDefeat = (defeatedEnemies: ActiveEnemy[], customPrefix?: string, isFromParry: boolean = false): string => {
        if (defeatedEnemies.length === 0) return '';

        // WHY: 적 턴 setTimeout 클로저가 stale 상태로 남아있으면,
        //      같은 적을 여러 번 "격파"로 처리(경험치/드랍 중복)하는 버그가 발생할 수 있다.
        //      따라서 적 ID 기준으로 보상은 1회만 지급한다.
        const uniqueDefeats = defeatedEnemies.filter(e => !defeatRewardedEnemyIdsRef.current.has(e.id));
        if (uniqueDefeats.length === 0) return '';
        uniqueDefeats.forEach(e => defeatRewardedEnemyIdsRef.current.add(e.id));

        let totalExp = 0;
        let earnedCoin = 0;
        const newBosses: string[] = [];
        type LootRow = { name: string; runeQuality?: number };
        const loots: LootRow[] = [];
        const questLogs: string[] = [];
        const updatedKills: Record<string, number> = {};

        // 오염도(원한): 미로/벌크 통로에서 처치할수록 상승 (휴식거점 습격 확률에 반영)
        const isMazePollutionAreaRoom = (roomId: string): boolean => {
          if (!roomId) return false;
          if (roomId.startsWith('maze_')) return true;
          if (roomId.startsWith('bulk_')) return true;
          return ['silent_maze', 'silent_rest_area', 'ghost_terminal'].includes(roomId);
        };
        const pollutionGained = isMazePollutionAreaRoom(currentRoomId) ? uniqueDefeats.length : 0;

        uniqueDefeats.forEach(enemy => {
           totalExp += enemy.exp;
           earnedCoin += Math.floor(enemy.exp * (1.0 + Math.random() * 0.5));
           loots.push({ name: enemy.lootPool[Math.floor(Math.random() * enemy.lootPool.length)] });
           // 관문 잠금 해제는 기본 보스 ID(mutant_king 등)로 검사하므로, 접미사(_0) 제거한 ID 저장
           if (enemy.isBoss) {
             const baseId = enemy.id.replace(/_\d+$/, '');
             if (!newBosses.includes(baseId)) newBosses.push(baseId);
           }

          // 퀘스트 진행도 체크 (kill 타입)
          // WHY: 전투 시 적 ID에는 _0, _1 같은 접미사가 붙으므로, 퀘스트 targetId(glitch_virus 등)와 비교할 때는
          // 기본 ID 부분만 떼어서 비교한다.
          const enemyBaseId = String(enemy.id).replace(/_\d+$/, '');
          Object.keys(playerState.quests.active).forEach(qId => {
            const qDef = QUESTS[qId];
            if (qDef && qDef.type === 'kill' && qDef.targetId === enemyBaseId) {
              const currAmount = playerState.quests.active[qId] + (updatedKills[qId] || 0);
              if (currAmount < qDef.requiredCount) {
                updatedKills[qId] = (updatedKills[qId] || 0) + 1;
                questLogs.push(`📜 퀘스트 [${qDef.title}] 진행: ${enemy.name} 처치 (${currAmount + 1}/${qDef.requiredCount})`);
              }
            }
          });
        });

        if (playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'gambler')) {
          const gbSc = getRuneScaleForPassive(
            'gambler',
            playerState.equippedRuneId,
            playerState.equippedRuneSecondaryId,
            playerState.equippedRuneQuality ?? 1,
            playerState.equippedRuneSecondaryQuality ?? 1,
            loggedInChar?.job,
          );
          earnedCoin = Math.floor(earnedCoin * (1 + 0.2 * gbSc));
          uniqueDefeats.forEach((enemy) => {
            if (Math.random() < 0.2 * Math.min(1.2, gbSc) && enemy.lootPool?.length) {
              loots.push({ name: enemy.lootPool[Math.floor(Math.random() * enemy.lootPool.length)] });
            }
          });
        }

        // 보스(isBoss) 처치 시 10%로 15종 룬 중 1개 인벤 지급
        const bossRuneDropIds: RuneId[] = [];
        uniqueDefeats.forEach((enemy) => {
          if (enemy.isBoss && Math.random() < 0.1) {
            const rid = rollRandomRuneId();
            bossRuneDropIds.push(rid);
            loots.push({ name: getRuneInventoryItemName(rid), runeQuality: rollRuneQualityForDrop() });
          }
        });

        const bossStoryLines = newBosses
          .map(id => BOSS_STORY_MESSAGES[id.replace(/_\d+$/, '')] || BOSS_STORY_MESSAGES[id])
          .filter(Boolean);
        const bossMsgs = newBosses.length > 0
          ? `\n[🔓 관문 개방] 보스 격파! 이제 다음 구역으로 나아갈 수 있습니다.${bossStoryLines.length > 0 ? '\n' + bossStoryLines.join('\n') : ''}`
          : '';
        const lootStr = loots.map((l) => l.name).join(', ');

        // 레벨업 횟수와 랜덤 스탯을 미리 계산 → 로그에 "어떤 스탯이 올랐는지" 정확히 표시
        const statNames: Array<{ key: 'str'|'dex'|'con'|'int'|'spr'; label: string }> = [
          { key: 'str', label: '힘' }, { key: 'dex', label: '민첩' }, { key: 'con', label: '체력' }, { key: 'int', label: '지능' }, { key: 'spr', label: '정신' }
        ];
        const job = loggedInChar?.job;
        const randomStatPool = statNames.filter(s => {
          if (!job) return true;
          if (['전사', '도적', '로그'].includes(job)) return s.key !== 'int';   // 지능 제외
          if (job === '마법사') return s.key !== 'str' && s.key !== 'dex';     // 힘·민첩 제외
          if (job === '성직자') return s.key !== 'dex' && s.key !== 'int';       // 민첩·지능 제외
          return true;
        });
        const statPool = randomStatPool.length > 0 ? randomStatPool : statNames;
        let localNextExp = playerState.exp + totalExp;
        let localNextMaxExp = playerState.maxExp;
        let localNextLevel = playerState.level;
        const levelUpRolls: Array<{ key: 'str'|'dex'|'con'|'int'|'spr'; label: string }> = [];
        // WHY: 이미 만렙이면 미리보기 루프를 돌리지 않는다.
        if (localNextLevel < PLAYER_MAX_LEVEL) {
          while (localNextLevel < PLAYER_MAX_LEVEL && localNextExp >= localNextMaxExp) {
            localNextExp -= localNextMaxExp;
            localNextLevel++;
            levelUpRolls.push(statPool[Math.floor(Math.random() * statPool.length)]);
            if (localNextLevel >= PLAYER_MAX_LEVEL) {
              localNextExp = 0;
              localNextMaxExp = 1;
              break;
            }
            localNextMaxExp = expRequiredForNextLevel(localNextLevel);
          }
        }

        // 전리품 로그는 setPlayerState 내부에서 채우고, 바깥에서 한 번에 출력한다.
        let inventoryLogs: string[] = [];
        setPlayerState(p => {
          let nextExp = p.exp + totalExp;
          let nextLevel = p.level;
          let nextMaxExp = p.maxExp;
          let nextStatPoints = p.statPoints || 0;
          let nextStr = p.str;
          let nextDex = p.dex;
          let nextCon = p.con;
          let nextInt = p.int;
          let nextSpr = p.spr;
          let levelUpMsg = '';
          let rollIndex = 0;

          while (nextLevel < PLAYER_MAX_LEVEL && nextExp >= nextMaxExp) {
            nextExp -= nextMaxExp;
            nextLevel++;
            nextStatPoints += 2;
            const roll = levelUpRolls[rollIndex++] ?? statPool[Math.floor(Math.random() * statPool.length)];
            if (roll.key === 'str') nextStr++;
            else if (roll.key === 'dex') nextDex++;
            else if (roll.key === 'con') nextCon++;
            else if (roll.key === 'int') nextInt++;
            else nextSpr++;
            levelUpMsg += `\n🎉 레벨 업! LV ${nextLevel} 달성! (스탯 포인트 +2 / 랜덤 스탯 +1: ${roll.label})\n  ▶ ${LEVELUP_FLAVOR_TEXTS[Math.floor(Math.random() * LEVELUP_FLAVOR_TEXTS.length)]}`;
            playSoundLevelUp();
            if (nextLevel >= PLAYER_MAX_LEVEL) {
              nextExp = 0;
              nextMaxExp = 1;
              break;
            }
            nextMaxExp = expRequiredForNextLevel(nextLevel);
          }
          // WHY: 만렙이면 EXP 바는 MAX 고정 — 획득 EXP를 수치에 쌓아두지 않는다.
          if (nextLevel >= PLAYER_MAX_LEVEL) {
            nextExp = 0;
            nextMaxExp = 1;
          }

          const uniqueBosses = Array.from(new Set([...p.story.defeatedBosses, ...newBosses]));
          const newActiveQuests = { ...p.quests.active };
          Object.keys(updatedKills).forEach(qId => {
              newActiveQuests[qId] += updatedKills[qId];
          });

          // 전리품 적용: 포션류는 종류별 최대 개수 제한
          inventoryLogs = [];
          let nextInventory = [...p.inventory];
          loots.forEach((entry) => {
            const res = addItemToInventory(nextInventory, entry.name, inventoryLogs, {
              fromCombatLoot: true,
              runeQuality: entry.runeQuality,
            });
            nextInventory = res.inventory;
            inventoryLogs = res.logs;
          });

          const next: any = {
            ...p,
            credit: (p.credit || 0) + earnedCoin,
            mazePollution: Math.min(999, Math.max(0, (p.mazePollution ?? 0) + pollutionGained)),
            level: nextLevel,
            exp: nextExp,
            maxExp: nextMaxExp,
            str: nextStr,
            dex: nextDex,
            con: nextCon,
            int: nextInt,
            spr: nextSpr,
            statPoints: nextStatPoints,
            story: { ...p.story, defeatedBosses: uniqueBosses },
            quests: { ...p.quests, active: newActiveQuests },
            inventory: nextInventory,
          };
          const { maxHp, maxMp } = getEffectiveMaxHpMp(next);
          next.maxHp = maxHp;
          next.maxMp = maxMp;
          next.hp = levelUpMsg ? maxHp : p.hp;
          next.mp = levelUpMsg ? maxMp : p.mp;
          if (playerHasRune(p.equippedRuneId, p.equippedRuneSecondaryId, 'necromancer') && uniqueDefeats.length > 0) {
            const necSc = getRuneScaleForPassive(
              'necromancer',
              p.equippedRuneId,
              p.equippedRuneSecondaryId,
              p.equippedRuneQuality ?? 1,
              p.equippedRuneSecondaryQuality ?? 1,
              loggedInChar?.job,
            );
            const drainHp = Math.round((10 + uniqueDefeats.length * 6 + Math.floor(p.level || 1)) * necSc);
            next.hp = Math.min(next.maxHp, next.hp + drainHp);
            next.mp = Math.min(next.maxMp, next.mp + Math.floor(drainHp * 0.35));
          }
          if (defeatedEnemies.some(e => String(e.id).startsWith('shadow_king'))) next.title = '그림자 사냥꾼';
          return next;
        });

        if (inventoryLogs.length > 0) {
          setLogs(prev => [...prev, ...inventoryLogs]);
        }

        if (bossRuneDropIds.length > 0) {
          const runeAnnounce: string[] = [];
          bossRuneDropIds.forEach((rid) => {
            runeAnnounce.push(BOSS_RUNE_DROP_RARE_LINE, buildNeonRuneLog(rid, 'gain'));
          });
          setLogs((prev) => [...prev, ...runeAnnounce]);
        }

        // 위에서 계산한 levelUpRolls로 로그 메시지 생성 — "랜덤 스탯 +1: 힘"처럼 실제 오른 스탯 표시
        const localLevelUpMsg = levelUpRolls
          .map((roll, i) => `\n🎉 레벨 업! LV ${playerState.level + 1 + i} 달성! (스탯 포인트 +2 / 랜덤 스탯 +1: ${roll.label})\n  ▶ ${LEVELUP_FLAVOR_TEXTS[Math.floor(Math.random() * LEVELUP_FLAVOR_TEXTS.length)]}`)
          .join('');

        const qMsgs = questLogs.length > 0 ? '\n' + questLogs.join('\n') : '';
        const winBanner = `\n╔═══════════════════════════╗\n║  ▶ SYSTEM: ENEMY DOWN ◀  ║\n║   << J A C K - I N ! >>   ║\n╚═══════════════════════════╝`;
        let necDrainLine = '';
        if (
          playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'necromancer') &&
          uniqueDefeats.length > 0
        ) {
          const necSc2 = getRuneScaleForPassive(
            'necromancer',
            playerState.equippedRuneId,
            playerState.equippedRuneSecondaryId,
            playerState.equippedRuneQuality ?? 1,
            playerState.equippedRuneSecondaryQuality ?? 1,
            loggedInChar?.job,
          );
          const d = Math.round((10 + uniqueDefeats.length * 6 + Math.floor(playerState.level || 1)) * necSc2);
          necDrainLine = `\n💀 [강령술사] 영혼 흡수 — HP +${d}, MP +${Math.floor(d * 0.35)}`;
        }
        const gamblerLine = playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'gambler')
          ? '\n🎲 [도박사] COIN·전리품 보너스 적용!'
          : '';
        const returnedLog = `${customPrefix || '적 격파!'}${winBanner}\n📦 [${lootStr}] 획득! 💰 ${earnedCoin} COIN 획득! EXP +${totalExp}${localLevelUpMsg}${bossMsgs}${qMsgs}${necDrainLine}${gamblerLine}`;

        if (isFromParry) {
          setLogs(prev => [...prev, returnedLog]);
        }

        return returnedLog;
      };

      // 전투가 아닐 때 플레이어에게 남아 있는 중독·경직·화상·빙결·축복 턴도 행동 1회당 1씩 줄여, 영구 상태가 되지 않도록 처리
      if (!playerState.isCombat) {
        const hasStatus =
          (playerState.burnTurns ?? 0) > 0 ||
          (playerState.freezeTurns ?? 0) > 0 ||
          (playerState.staggerTurns ?? 0) > 0 ||
          (playerState.poisonTurns ?? 0) > 0 ||
          (playerState.blessTurns ?? 0) > 0;
        if (hasStatus) {
          let nonCombatDotLog: string | null = null;
          // WHY: 전투가 끝난 뒤에도 중독·화상 등은 "계속 피가 닳는 옵션"으로 느껴져야 하므로,
          // 비전투 행동 시에도 소량의 DoT 피해를 적용한다. 단, 전투 중보다는 약하게(체감용) 유지.
          setPlayerState(p => {
            let nextHp = p.hp;
            const pBurn = p.burnTurns ?? 0;
            const pFreeze = p.freezeTurns ?? 0;
            const pStagger = p.staggerTurns ?? 0;
            const pPoison = p.poisonTurns ?? 0;

            // 패시브 + 장신구 속성 저항 계산 (전투 중 로직과 동일)
            const resistBase = getElementResistances(p.passiveSkills || [], p.passiveLevels);
            const accSlots = [(p as any).ring1, (p as any).ring2, (p as any).necklace].filter(Boolean) as string[];
            const resist: Record<'불'|'얼음'|'전기'|'독', number> = {
              ...applyPaladinRuneResist({ ...resistBase }, p.equippedRuneId, p.equippedRuneSecondaryId, {
                primaryQuality: p.equippedRuneQuality ?? 1,
                secondaryQuality: p.equippedRuneSecondaryQuality ?? 1,
                jobName: loggedInChar?.job,
              }),
            };
            accSlots.forEach((slot) => {
              const it = getMergedEquippedItem(slot, p.inventory as InventoryRow[]);
              if (it?.elementResist) {
                (['불', '얼음', '전기', '독'] as const).forEach(el => {
                  const v = it.elementResist![el];
                  if (v != null) resist[el] = Math.min(0.75, (resist[el] ?? 0) + v);
                });
              }
            });
            const zone = getZoneForRoom(currentRoomId);
            const zoneMult = getStatusDotMultiplierForZone(zone);
            // 화상·중독: 전투가 끝나도 남은 턴까지 전투와 동일한 데미지 유지
            const burnBase = pBurn ? (STATUS_DOT_DAMAGE['화상'] ?? 4) * zoneMult : 0;
            const freezeBase = pFreeze ? (STATUS_DOT_DAMAGE['빙결'] ?? 3) * zoneMult * 0.5 : 0;
            const staggerBase = pStagger ? (STATUS_DOT_DAMAGE['경직'] ?? 4) * zoneMult * 0.5 : 0;
            const poisonBase = pPoison ? (STATUS_DOT_DAMAGE['중독'] ?? 5) * zoneMult : 0;
            const burnDmg = Math.max(0, Math.round(burnBase * (1 - resist['불'])));
            const freezeDmg = Math.max(0, Math.round(freezeBase * (1 - resist['얼음'])));
            const staggerDmg = Math.max(0, Math.round(staggerBase * (1 - resist['전기'])));
            const poisonDmg = Math.max(0, Math.round(poisonBase * (1 - resist['독'])));
            const dotDmg = burnDmg + freezeDmg + staggerDmg + poisonDmg;
            if (dotDmg > 0) {
              nextHp = Math.max(1, nextHp - dotDmg); // 비전투에서는 HP 1 밑으로는 깎지 않아 "서서히 죽어가는 느낌"만 유지
              const msgs: string[] = [];
              if (burnDmg) msgs.push(`🔥 화상 (${burnDmg})`);
              if (freezeDmg) msgs.push(`❄️ 빙결 (${freezeDmg})`);
              if (staggerDmg) msgs.push(`⚡ 경직 (${staggerDmg})`);
              if (poisonDmg) msgs.push(`☠️ 중독 (${poisonDmg})`);
              nonCombatDotLog = `[지속 피해] ${msgs.join(', ')} — 합계 ${dotDmg} 피해 (비전투)`;
            }

            const base: any = {
              ...p,
              hp: nextHp,
              burnTurns: Math.max(0, (p.burnTurns ?? 0) - 1),
              freezeTurns: Math.max(0, (p.freezeTurns ?? 0) - 1),
              staggerTurns: Math.max(0, (p.staggerTurns ?? 0) - 1),
              poisonTurns: Math.max(0, (p.poisonTurns ?? 0) - 1),
            };
            // 축복도 비전투 행동 시 1턴씩 감소 (턴 카운트 유지 일관성)
            if ((p.blessTurns ?? 0) > 0) {
              const nextBless = (p.blessTurns ?? 0) - 1;
              const prevBonus = p.blessAtkBonus ?? 0;
              const baseAtk = p.atk - prevBonus;
              base.blessTurns = Math.max(0, nextBless);
              base.blessAtkBonus = nextBless > 0 ? prevBonus : 0;
              base.atk = nextBless > 0 ? baseAtk + prevBonus : baseAtk;
              if (nextBless <= 0) {
                // 비전투에서도 축복이 끝나면 HUD에서 아이콘 제거
                setHasBlessBuff(false);
              }
            }
            return base;
          });
          // 화상·중독은 남은 턴이 0이 될 때까지 전투와 무관하게 계속 데미지를 주므로, "지속 중" 안내만 남김
          setLogs(prev => [...prev, '💊 전투가 끝났어도 화상·중독은 남은 턴만큼 계속 피해를 줍니다.']);
          if (nonCombatDotLog && !nonCombatDotAppliedRef.current) {
            nonCombatDotAppliedRef.current = true;
            const dotLog = nonCombatDotLog;
            setLogs(prev => [...prev, dotLog]);
          }

          // 전투가 끝난 뒤 상태 이상이 서서히 풀리는 동안,
          // 위험 지역에서는 낮은 확률로 적이 다시 기습적으로 나타나도록 처리
          const room = getRoomById(currentRoomId);
          const distEvent = getMinDistanceFromSafeZone(currentRoomId);
          const eventRespawnChance = distEvent <= NEAR_SAFE_ZONE_MAX_STEPS ? 0.04 : 0.08;
          if (room && !room.isSafe && Math.random() < eventRespawnChance) {
            const applyNearSafeScale = distEvent <= NEAR_SAFE_ZONE_MAX_STEPS;
            // 안전지대 인근에서는 재등장 적 수 1마리로 제한
            const eventCount = applyNearSafeScale ? 1 : (Math.floor(Math.random() * 2) + 1);
            const newEnemies = Array.from({ length: eventCount }).map((_, i) => {
              let e2 = spawnRandomEnemy(playerState.level);
              const lv = (playerState.enemyGrowth ?? {})[e2.id]?.level ?? 0;
              if (lv > 0) e2 = applyEnemyGrowth(e2, lv);
              if (applyNearSafeScale) e2 = scaleEnemyNearSafeZone(e2);
              return { ...e2, id: `${e2.id}_${i}`, name: `${e2.name} ${String.fromCharCode(65 + i)}` };
            });
            if (newEnemies.length > 0) {
              let spawnedEnemies = newEnemies;
              // 로그 트랩: 이 방에 설치된 함정이 있으면 첫 등장 적에게 선 피해(와이어는 +기절) 후 1회성 제거
              const trap = roomTraps[currentRoomId];
              if (trap && (trap.type === 'spike' || trap.type === 'wire')) {
                const trapDmg = Math.max(1, Math.round((trap.power || 1) * 0.8));
                const stunTurns = trap.type === 'wire' ? (trap.stunTurns ?? 1) : 0;
                spawnedEnemies = newEnemies.map((e, idx) =>
                  idx === 0
                    ? { ...e, currentHp: Math.max(0, e.currentHp - trapDmg), ...(stunTurns > 0 ? { stunTurns } : {}) }
                    : e
                );
                setRoomTraps(prev => {
                  const next = { ...prev };
                  delete next[currentRoomId];
                  return next;
                });
                const first = spawnedEnemies[0];
                const trapMsg = trap.type === 'wire'
                  ? `🧨 [와이어 트랩 발동] 함정이 [${first.name}]에게 ${trapDmg} 피해 + ${stunTurns}턴 기절을 입혔습니다!`
                  : `🧨 [함정 발동] 이전에 설치해 둔 함정이 발동해 [${first.name}]에게 ${trapDmg}의 피해를 입혔습니다!`;
                setLogs(prev => [...prev, trapMsg]);
              }
              const live = spawnedEnemies.filter(e => e.currentHp > 0);
              if (live.length === 0) {
                setLogs(prev => [...prev, '🧨 함정에 걸린 적들이 모두 쓰러졌습니다. 전투는 시작조차 되지 않았습니다.']);
                return;
              }
              setActiveEnemies(live);
              setPlayerState(p => ({ ...p, isCombat: true, prayerHealTurns: 0, prayerHealPerTurn: 0, godShieldTurns: 0 }));
              const firstEnemy = live[0];
              setSceneImage(resolveEnemySceneImage(firstEnemy.imageKey, firstEnemy.id));
              const enemiesListStr = live.map(e => `[${e.name}] HP:${e.currentHp}`).join(', ');
              setLogs(prev => [
                ...prev,
                `⚠️ [기습!] 이동을 마치는 순간, 어둠 속에서 적이 불쑥 튀어나왔습니다!\n${enemiesListStr}\n'공격' 명령으로 다시 싸우세요!`,
              ]);
            }
          }
        }
      }

      const triggerEnemyTurn = (
        currentEnemies: ActiveEnemy[],
        options?: {
          isDefending?: boolean;
          dodgeChance?: number;
          isParrying?: boolean;
          isRiposte?: boolean;
          /** true면 [방어] 명령 — 대응 가드보다 피해 감소가 약함 */
          basicDefend?: boolean;
          /** true면 [패링] 명령 — 대응 패링보다 성공률·반격이 약함 */
          basicParry?: boolean;
        },
        /** 'neutral': 장착·회복 등 화력 턴이 아님 — 연속 닥공 카운트 유지 */
        combatRhythm?: 'neutral',
      ) => {
        if (!playerState.isCombat || currentEnemies.length === 0) return;

        // WHY: 준보스 QTE 오버레이 중에는 선제 적턴을 막고, 호출 시점의 `triggerEnemyTurn` 클로저를 보관해 QTE 종료 뒤 재개
        if (miniBossQteLockRef.current) {
          pendingEnemyTurnAfterQteRef.current = { currentEnemies, options, combatRhythm, run: triggerEnemyTurn };
          return;
        }

        // WHY: 바람술사 룬 + 방패 강타(전사) — 적의 이번 라운드 공격을 1회 건너뛴다.
        if (playerWindBashPriorityRef.current > 0) {
          playerWindBashPriorityRef.current -= 1;
          setLogs((prev) => [
            ...prev,
            '💨 [바람술사 연계] 방패 강타의 역풍이 적의 리듬을 한 박자 끊었습니다!',
          ]);
          enemyTurnInProgressRef.current = false;
          return;
        }

        // WHY: triggerEnemyTurn이 handleCommand와 같은 동기 구간에서 먼저 setLogs 하면
        //      「◀ 적의 공격」이 「▶ 나의 공격」보다 먼저 쌓이는 순서 버그가 난다.
        //      플레이어 턴 응답 로그를 끝까지 append한 뒤(다음 매크로태스크) 적 턴을 돌린다.
        window.setTimeout(() => {
        // WHY: 플레이어가 연속으로만 때리면 보스가 강공 예고를 조금 더 자주 쓰도록 스택을 쌓는다. 방어/회피/패링/반격 태세는 리셋.
        const o = options || {};
        const defensiveFromOptions = !!(
          o.isDefending ||
          o.isParrying ||
          o.isRiposte ||
          (typeof o.dodgeChance === 'number' && o.dodgeChance > 0)
        );
        if (defensiveFromOptions) {
          aggressiveTurnStreakRef.current = 0;
        } else if (combatRhythm === 'neutral') {
          /* 유지 */
        } else {
          aggressiveTurnStreakRef.current = Math.min(25, aggressiveTurnStreakRef.current + 1);
        }

        let {
          isDefending = false,
          dodgeChance = 0,
          isParrying = false,
          isRiposte = false,
          basicDefend = false,
          basicParry = false,
        } = options || {};

        // WHY: 이전 턴에 예약된 적 행동(setTimeout)이 남아있으면, 상태/보상이 중복 실행될 수 있다.
        enemyTurnTimeoutsRef.current.forEach(id => clearTimeout(id));
        enemyTurnTimeoutsRef.current = [];

        roundEndRegenAppliedRef.current = false; // 이번 적 턴에서 라운드 종료 회복은 1회만 적용
        enemyTurnInProgressRef.current = true;   // 적 턴 진행 플래그
        let playerDefeatedInThisTurn = false;

        // 플레이어에게 걸린 상태 이상(화상·빙결·경직·중독) DoT — 속성 레지스트 적용 후 적 턴 시작 시 선적용
        const pBurn = playerState.burnTurns ?? 0;
        const pFreeze = playerState.freezeTurns ?? 0;
        const pStagger = playerState.staggerTurns ?? 0;
        const pPoison = playerState.poisonTurns ?? 0;
        const resistBase = getElementResistances(playerState.passiveSkills || [], playerState.passiveLevels);
        const accSlots = [(playerState as any).ring1, (playerState as any).ring2, (playerState as any).necklace].filter(Boolean) as string[];
        const resist: Record<'불'|'얼음'|'전기'|'독', number> = {
          ...applyPaladinRuneResist({ ...resistBase }, playerState.equippedRuneId, playerState.equippedRuneSecondaryId, {
            primaryQuality: playerState.equippedRuneQuality ?? 1,
            secondaryQuality: playerState.equippedRuneSecondaryQuality ?? 1,
            jobName: loggedInChar?.job,
          }),
        };
        accSlots.forEach((slot) => {
          const it = getMergedEquippedItem(slot, playerState.inventory);
          if (it?.elementResist) {
            (['불', '얼음', '전기', '독'] as const).forEach(el => {
              const v = it.elementResist![el];
              if (v != null) resist[el] = Math.min(0.75, (resist[el] ?? 0) + v);
            });
          }
        });
        // 구역별 속성 DoT 배율: 구역 1 낮음 → 구역 올라갈수록 강해짐
        const zone = getZoneForRoom(currentRoomId);
        const zoneMult = getStatusDotMultiplierForZone(zone);
        const burnBase = pBurn ? (STATUS_DOT_DAMAGE['화상'] ?? 4) * zoneMult : 0;
        const freezeBase = pFreeze ? (STATUS_DOT_DAMAGE['빙결'] ?? 3) * zoneMult : 0;
        const staggerBase = pStagger ? (STATUS_DOT_DAMAGE['경직'] ?? 4) * zoneMult : 0;
        const poisonBase = pPoison ? (STATUS_DOT_DAMAGE['중독'] ?? 5) * zoneMult : 0;
        const burnDmg = Math.max(0, Math.round(burnBase * (1 - resist['불'])));
        const freezeDmg = Math.max(0, Math.round(freezeBase * (1 - resist['얼음'])));
        const staggerDmg = Math.max(0, Math.round(staggerBase * (1 - resist['전기'])));
        const poisonDmg = Math.max(0, Math.round(poisonBase * (1 - resist['독'])));
        const pDotDmg = burnDmg + freezeDmg + staggerDmg + poisonDmg;
        if (pDotDmg > 0) {
          const dotMsgs: string[] = [];
          if (burnDmg) dotMsgs.push(`🔥 화상 (${burnDmg})`);
          if (freezeDmg) dotMsgs.push(`❄️ 빙결 (${freezeDmg})`);
          if (staggerDmg) dotMsgs.push(`⚡ 경직 (${staggerDmg})`);
          if (poisonDmg) dotMsgs.push(`☠️ 중독 (${poisonDmg})`);
          setLogs((prev) =>
            appendEnemyCombatLog(prev, `[상태 이상] ${dotMsgs.join(', ')} — 합계 ${pDotDmg} 피해`),
          );
          setPlayerState(prev => {
            const nextHp = Math.max(0, prev.hp - pDotDmg);
            return {
              ...prev,
              hp: nextHp,
              // 화상·경직·중독은 적 턴마다 1턴씩 감소
              burnTurns: Math.max(0, (prev.burnTurns ?? 0) - 1),
              staggerTurns: Math.max(0, (prev.staggerTurns ?? 0) - 1),
              poisonTurns: Math.max(0, (prev.poisonTurns ?? 0) - 1),
              // 빙결(freezeTurns)은 "행동을 시도할 때"만 줄어들도록 유지 — 아래 handleCommand에서 처리
            };
          });
          if (playerState.hp - pDotDmg <= 0) {
            playerDefeatedInThisTurn = true;
            const respawnId = playerState.respawnRoomId || STARTING_ROOM_ID;
            setTimeout(() => {
              setLogs(l => [...l, '💀 상태 이상으로 쓰러졌습니다...']);
              setShowDeathOverlay(true);
            }, 100);
            setTimeout(() => {
              setShowDeathOverlay(false);
              stealthTurnsRef.current = 0;
              suppressInvadedSafeLiberationRef.current = true;
              setPlayerState(p => ({
                ...p, isCombat: false, stealthTurnsLeft: 0, hp: 5,
                exp: Math.max(0, p.exp - Math.floor(p.exp * 0.2)),
                credit: Math.max(0, (p.credit || 0) - Math.floor((p.credit || 0) * 0.1)),
                burnTurns: 0, freezeTurns: 0, staggerTurns: 0, poisonTurns: 0, sleepTurns: 0,
              }));
              setCurrentRoomId(respawnId);
              setActiveEnemies([]);
              setSceneImage(resolveRoomSceneImage(getRoomById(respawnId)));
              setRage(0); // 사망 시 분노 완전 초기화
            }, 2500);
            return;
          }
        }

        // WHY: 플레이어가 [방어]/[회피]/[패링]/[대응 …]으로 이번 턴 태세를 정하면 자동 태세 굴림을 생략한다.
        //      그 외(공격·스킬 등)에는 직업·스탯 기반 자동 방어/회피/패링을 굴린다.
        if (!options || (!options.isDefending && !options.isParrying && !options.dodgeChance && !options.isRiposte)) {
          const jobId = JOB_LIST.find(j => j.name === loggedInChar?.job)?.id ?? '';
          const hasParrySkill = playerState.skills.includes('패링');

          // 직업별: 로그=회피 특화, 도적=패링 특화, 전사/성기사=방어 특화
          let autoParryChance = 0;
          if (hasParrySkill) {
            if (jobId === 'thief') {
              autoParryChance = 0.40; // 도적: 패링 특성으로 자주 터짐
            } else if (['warrior', 'cleric'].includes(jobId)) {
              autoParryChance = 0.10; // 전사·성기사: 방어가 메인, 패링은 가끔
            }
            // 로그(rogue): 패링 구간 없음 → 회피 구간이 넓어짐
          }
          const playerArmorAttr = getPlayerArmorAttr();
          const postureForGuard = playerState.battlePosture ?? 'balanced';
          const autoGuardChance = applyPostureToGuardChance(
            getArmorGuardChance(playerArmorAttr),
            postureForGuard
          );

          // 민첩 기반 회피 + 로그는 회피 특화로 확률 대폭 상승
          const baseDodgeChance = Math.min(0.3, (effDex || 5) * 0.01);
          const rogueDodgeBonus = jobId === 'rogue' ? 0.38 : 0; // 로그: 회피률 특성
          const autoExtraDodgeChance = Math.min(0.55, baseDodgeChance + rogueDodgeBonus);
          const autoExtraDodgeBonus = jobId === 'rogue' ? 0.22 : 0.15; // 로그는 회피 성공 시 보너스도 더 높게

          const roll = Math.random();
          if (autoParryChance > 0 && roll < autoParryChance) {
            isParrying = true;
            setLogs(prev => [...prev, '⚔ 자동 패링 자세! 반격 기회를 노립니다.']);
          } else if (roll < autoParryChance + autoGuardChance) {
            isDefending = true;
            setLogs(prev => [...prev, '🛡 자동 방어! 피해를 줄이려고 자세를 낮춥니다.']);
          } else if (roll < autoParryChance + autoGuardChance + autoExtraDodgeChance) {
            dodgeChance += autoExtraDodgeBonus;
            setLogs(prev => [...prev, '💨 자동 회피 시도! 몸을 비틀어 공격을 피하려 합니다.']);
          }
        }

        currentEnemies.forEach((enemy, index) => {
           let isFirstEnemyLogChunk = true;
           const tId = window.setTimeout(() => {
              /** 같은 라운드·같은 적 줄은 한 카드에 이어 붙이고, 두 번째 적부터는 새 카드 */
              const pushEnemyCombatLine = (body: string) => {
                const startNew = index > 0 && isFirstEnemyLogChunk;
                isFirstEnemyLogChunk = false;
                setLogs((prev) => appendEnemyCombatLog(prev, body, startNew));
              };
              // 최신 상태에서 적을 다시 조회 (클로저 stale 방지)
              const enemyLive = activeEnemiesRef.current.find(e => e.id === enemy.id);
              if (!enemyLive || enemyLive.currentHp <= 0 || playerDefeatedInThisTurn) return;

              // 상태 이상: 중독·출혈·화상·빙결·경직 — 매 턴 DoT 피해 후 공격
              const poisonDmg = (enemyLive.poisonTurns || 0) > 0 ? (STATUS_DOT_DAMAGE['중독'] ?? 5) : 0;
              const bleedDmg = (enemyLive.bleedTurns || 0) > 0 ? 3 : 0;
              const burnDmg = (enemyLive.burnTurns || 0) > 0 ? (STATUS_DOT_DAMAGE['화상'] ?? 4) : 0;
              const freezeDmg = (enemyLive.freezeTurns || 0) > 0 ? (STATUS_DOT_DAMAGE['빙결'] ?? 3) : 0;
              const staggerDmg = (enemyLive.staggerTurns || 0) > 0 ? (STATUS_DOT_DAMAGE['경직'] ?? 4) : 0;
              const dotTotal = poisonDmg + bleedDmg + burnDmg + freezeDmg + staggerDmg;
              if (dotTotal > 0) {
                const newHp = enemyLive.currentHp - dotTotal;
                const msgs: string[] = [];
                if (poisonDmg) msgs.push(`☠️ [${enemyLive.name}] 중독 피해! (${poisonDmg})`);
                if (bleedDmg) msgs.push(`🩸 [${enemyLive.name}] 출혈 피해! (${bleedDmg})`);
                if (burnDmg) msgs.push(`🔥 [${enemyLive.name}] 화상 피해! (${burnDmg})`);
                if (freezeDmg) msgs.push(`❄️ [${enemyLive.name}] 빙결 피해! (${freezeDmg})`);
                if (staggerDmg) msgs.push(`⚡ [${enemyLive.name}] 경직 피해! (${staggerDmg})`);
                const defeatFromDot = newHp <= 0
                  ? handleEnemiesDefeat([{ ...enemyLive, currentHp: 0 }], `☠️ [${enemyLive.name}] 격파 (상태 이상)`)
                  : '';
                const dotBlockLines = [
                  ...msgs,
                  ...(newHp <= 0
                    ? [
                        `💀 [${enemyLive.name}] 상태 이상으로 쓰러졌다!`,
                        ...(defeatFromDot ? [defeatFromDot] : []),
                      ]
                    : []),
                ];
                pushEnemyCombatLine(dotBlockLines.join('\n'));
                setActiveEnemies(prev => prev.map(e => e.id === enemyLive.id
                  ? { ...e, currentHp: newHp, sleepTurns: 0, poisonTurns: Math.max(0, (e.poisonTurns || 0) - 1), bleedTurns: Math.max(0, (e.bleedTurns || 0) - 1), burnTurns: Math.max(0, (e.burnTurns || 0) - 1), freezeTurns: Math.max(0, (e.freezeTurns || 0) - 1), staggerTurns: Math.max(0, (e.staggerTurns || 0) - 1), slowTurns: Math.max(0, (e.slowTurns || 0) - 1) }
                  : e));
                if (newHp <= 0) {
                  // 보상 중복은 handleEnemiesDefeat 내부에서 적 ID 기준으로 자동 차단됨 (로그는 위 블록에 통합)
                  setActiveEnemies(prev => {
                    const remain = prev.filter(e => e.id !== enemyLive.id && e.currentHp > 0);
                    if (remain.length === 0) {
                      stealthTurnsRef.current = 0;
                      setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                      setSceneImage(BG_ALLEY);
                    }
                    return remain;
                  });
                  return;
                }
              }

              // 스턴/빙결/수면: 해당 턴 행동 불가 (턴만 소모). 수면은 피격 시 별도 해제됨.
              // WHY: forEach의 enemy는 클로저 스냅샷이라 방패 강타 직후 stun이 안 보일 수 있음 → 반드시 enemyLive 사용 + 강공격 예고 해제
              if (
                (enemyLive.stunTurns || 0) > 0 ||
                (enemyLive.freezeTurns || 0) > 0 ||
                (enemyLive.sleepTurns || 0) > 0
              ) {
                const stunMsg = (enemyLive.stunTurns || 0) > 0 ? `⚡ [${enemyLive.name}] 스턴으로 행동 불가!` : '';
                const freezeMsg = (enemyLive.freezeTurns || 0) > 0 ? `❄️ [${enemyLive.name}] 빙결로 행동 불가!` : '';
                const sleepMsg = (enemyLive.sleepTurns || 0) > 0 ? `💤 [${enemyLive.name}] 수면 중!` : '';
                const windupBreak =
                  enemyLive.intentKind === 'HEAVY'
                    ? ` 🔔 [${enemyLive.name}]의 강공격 준비가 끊겼습니다!`
                    : '';
                pushEnemyCombatLine([stunMsg, freezeMsg, sleepMsg].filter(Boolean).join(' ') + windupBreak);
                setActiveEnemies((prev) =>
                  prev.map((e) =>
                    e.id === enemyLive.id
                      ? clearEnemyHeavyIntent({
                          ...e,
                          stunTurns: Math.max(0, (e.stunTurns || 0) - 1),
                          freezeTurns: Math.max(0, (e.freezeTurns || 0) - 1),
                          sleepTurns: Math.max(0, (e.sleepTurns || 0) - 1),
                          atkBuffTurns: Math.max(0, (e.atkBuffTurns ?? 0) - 1),
                          atkBuffBonus: (e.atkBuffTurns ?? 0) <= 1 ? 0 : (e.atkBuffBonus ?? 0),
                        })
                      : e,
                  ),
                );
                return;
              }

              // 버퍼형 적: 공격 대신 아군 한 명에게 공격력 버프 부여
              if (enemyLive.isBuffer) {
                const allies = activeEnemiesRef.current.filter(e => e.id !== enemyLive.id && e.currentHp > 0);
                if (allies.length > 0) {
                  const target = allies[Math.floor(Math.random() * allies.length)];
                  setActiveEnemies(prev => prev.map(e => e.id === target.id ? { ...e, atkBuffTurns: 2, atkBuffBonus: 8 } : e));
                  pushEnemyCombatLine(
                    `📈 [${enemyLive.name}]이(가) [${target.name}]에게 공격력 강화 버프를 걸었다! (2턴)`,
                  );
                  return;
                }
              }

              // 보스 2페이즈 진입: HP 50% 이하에서 1회만 발동, 공격력 영구 강화 + 연출 로그
              if (enemyLive.isBoss && !enemyLive.phase2 && enemyLive.currentHp <= enemyLive.maxHp * 0.5) {
                setActiveEnemies(prev => prev.map(e =>
                  e.id === enemyLive.id
                    ? {
                        ...e,
                        phase2: true,
                        atkBuffTurns: Math.max(5, (e.atkBuffTurns ?? 0)),
                        atkBuffBonus: Math.max(e.atkBuffBonus ?? 0, Math.round(e.atk * 0.4)),
                      }
                    : e
                ));
                pushEnemyCombatLine(
                  `🔥 [${enemyLive.name}]이(가) 2페이즈에 돌입했다! 패턴이 난폭해지고 공격력이 크게 상승합니다.`,
                );
                return;
              }

              // 보스형 적: 일정 확률로 자기 강화 스킬 사용 (공격 대신 발동)
              if (enemyLive.isBoss && Math.random() < 0.3) {
                const buffTurns = Math.max(3, (enemyLive.atkBuffTurns ?? 0));
                const buffBonus = Math.max(enemyLive.atkBuffBonus ?? 0, Math.round(enemyLive.atk * 0.3));
                setActiveEnemies(prev => prev.map(e =>
                  e.id === enemyLive.id
                    ? { ...e, atkBuffTurns: buffTurns, atkBuffBonus: buffBonus }
                    : e
                ));
                pushEnemyCombatLine(
                  `💢 [${enemyLive.name}]이(가) 분노 프로토콜을 활성화했다! (공격력 대폭 상승, ${buffTurns}턴 지속)`,
                );
                return;
              }

              // 도적 은신: 남은 턴 동안 적 공격 100% 회피 (ref로 클로저에서도 최신 값 참조)
              if (stealthTurnsRef.current > 0) {
                stealthTurnsRef.current -= 1;
                setPlayerState(p => ({ ...p, stealthTurnsLeft: Math.max(0, (p.stealthTurnsLeft ?? 0) - 1) }));
                pushEnemyCombatLine(
                  `🌫️ [은신] [${enemy.name}]의 공격을 그림자로 피했습니다! (남은 은신 ${stealthTurnsRef.current}턴)`,
                );
                setActiveEnemies(prev => prev.map(e => e.id === enemy.id ? { ...e, atkBuffTurns: Math.max(0, (e.atkBuffTurns ?? 0) - 1), atkBuffBonus: (e.atkBuffTurns ?? 0) <= 1 ? 0 : (e.atkBuffBonus ?? 0) } : e));
                return;
              }

              // ─────────────────────────────────────────
              // 적 의도(예고 패턴): 강공격 예고 → 다음 턴 강공격 실행
              // WHY: 전투에 "읽기 + 대응" 선택을 넣어 재미(의사결정)를 만든다.
              // ─────────────────────────────────────────
              let heavyMult = 1.0;
              const intentKind = enemyLive.intentKind;
              const intentTurnsLeft = enemyLive.intentTurnsLeft ?? 0;
              if (intentKind === 'HEAVY') {
                if (intentTurnsLeft > 0) {
                  // 예고 턴: 공격하지 않고 준비만 한다.
                  pushEnemyCombatLine(
                    `⚠️ [${enemyLive.name}]이(가) 강공격을 준비하고 있습니다... (다음 턴 위험)`,
                  );
                  setActiveEnemies(prev => prev.map(e => {
                    if (e.id !== enemyLive.id) return e;
                    const nextTurns = Math.max(0, (e.intentTurnsLeft ?? 0) - 1);
                    const nextAtkBuffTurns = Math.max(0, (e.atkBuffTurns ?? 0) - 1);
                    return {
                      ...e,
                      intentTurnsLeft: nextTurns,
                      atkBuffTurns: nextAtkBuffTurns,
                      atkBuffBonus: (e.atkBuffTurns ?? 0) <= 1 ? 0 : (e.atkBuffBonus ?? 0),
                    };
                  }));
                  return;
                }
                // 실행 턴: 강공격 발동 (예고 상태는 즉시 제거)
                // WHY: 완전 보스는 위협 유지, 미니보스(엘리트)만 피크 딜 완화
                const defaultHeavyPower = enemyLive.isBoss
                  ? 1.75
                  : enemyLive.isMiniBoss
                    ? 1.3
                    : 1.6;
                heavyMult = Math.max(1.2, enemyLive.intentPower ?? defaultHeavyPower);
                pushEnemyCombatLine(`💢 [${enemyLive.name}]의 강공격!`);
                setActiveEnemies(prev => prev.map(e => {
                  if (e.id !== enemyLive.id) return e;
                  return { ...e, intentKind: undefined, intentTurnsLeft: 0, intentPower: 0 };
                }));
              } else {
                // 예고가 없는 상태라면, 일정 확률로 강공격을 "예약"한다. (이 턴은 준비로 소모)
                const streak = aggressiveTurnStreakRef.current;
                const streakBonusCap = enemyLive.isBoss ? 0.16 : 0.08;
                const streakBonus = Math.min(
                  streakBonusCap,
                  streak * (enemyLive.isBoss ? 0.03 : 0.014),
                );
                const baseHeavy = enemyLive.isBoss ? 0.22 : 0.12;
                const heavyChance = Math.min(
                  enemyLive.isBoss ? 0.5 : 0.28,
                  baseHeavy + streakBonus,
                );
                if (Math.random() < heavyChance) {
                  const power = enemyLive.isBoss
                    ? 1.75
                    : enemyLive.isMiniBoss
                      ? 1.3
                      : 1.6;
                  pushEnemyCombatLine(
                    `⚠️ [${enemyLive.name}]이(가) 수상한 동작을 취합니다... (강공격 예고)`,
                  );
                  setActiveEnemies(prev => prev.map(e => {
                    if (e.id !== enemyLive.id) return e;
                    const nextAtkBuffTurns = Math.max(0, (e.atkBuffTurns ?? 0) - 1);
                    return {
                      ...e,
                      intentKind: 'HEAVY',
                      intentTurnsLeft: 1,
                      intentPower: power,
                      atkBuffTurns: nextAtkBuffTurns,
                      atkBuffBonus: (e.atkBuffTurns ?? 0) <= 1 ? 0 : (e.atkBuffBonus ?? 0),
                    };
                  }));
                  return;
                }
              }

              const proceedWithEnemyStrike = (strikeOpts: { skipPassiveDodge: boolean }) => {
              const playerArmorAttr = getPlayerArmorAttr();
              const baseDodge = getArmorDodgeChance(playerArmorAttr);
              // WHY: 회피율은 DEX(민첩) 기반. 판금 갑옷 적은 공격이 느려 회피하기 쉬움.
              const dexDodgeBonus = (effDex || 5) * 0.008;
              const slowEnemyBonus = enemy.armorAttr === '판금' ? 0.18 : 0; // 판금 = 느림 → +18%p 회피
              // 고저: 높은 지대에서는 적 근접(비마법)이 잘 닿지 않음 — 탄환·원거리 마법·고각 저격은 제외
              const plElevCombat = getRoomElevation(currentRoomId);
              const elevMeleeDodge =
                plElevCombat >= 1 &&
                enemy.weaponAttr !== '마법' &&
                !isEnemyRangedStrike(enemy.attackPattern)
                  ? 0.14
                  : 0;
              let finalDodgeChance = dodgeChance > 0
                ? Math.min(0.90, baseDodge + dexDodgeBonus + dodgeChance + slowEnemyBonus + elevMeleeDodge)
                : Math.min(0.90, baseDodge + dexDodgeBonus + slowEnemyBonus + elevMeleeDodge);
              if (playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'wind_sage')) {
                const ws = getRuneScaleForPassive(
                  'wind_sage',
                  playerState.equippedRuneId,
                  playerState.equippedRuneSecondaryId,
                  playerState.equippedRuneQuality ?? 1,
                  playerState.equippedRuneSecondaryQuality ?? 1,
                  loggedInChar?.job,
                );
                finalDodgeChance = Math.min(0.9, finalDodgeChance + RUNE_WIND_DODGE_FLAT * ws);
              }
              if ((playerState.runeWindDashDodgeTurns ?? 0) > 0) {
                finalDodgeChance = Math.min(0.92, finalDodgeChance + 0.12);
              }

              // 플레이어가 빙결 상태일 때는 회피 불가능 — "얼어붙어 못 움직이는" 판타지 일관성 유지
              const canDodge = (playerState.freezeTurns ?? 0) <= 0;
              if (!strikeOpts.skipPassiveDodge && canDodge && Math.random() < finalDodgeChance) {
                const reason = enemy.armorAttr === '판금' ? ' (판금 갑옷의 느린 공격을 피함)' : '';
                const elevReason = elevMeleeDodge > 0 && !reason ? ' (고저 차이로 근접이 헛돈다)' : '';
                pushEnemyCombatLine(
                  `⚡ [${enemy.name}]의 공격을 재빠르게 회피했습니다! (회피율 ${Math.round(finalDodgeChance * 100)}%)${reason}${elevReason}`,
                );
                setActiveEnemies(prev => prev.map(e => e.id === enemy.id ? { ...e, atkBuffTurns: Math.max(0, (e.atkBuffTurns ?? 0) - 1), atkBuffBonus: (e.atkBuffTurns ?? 0) <= 1 ? 0 : (e.atkBuffBonus ?? 0) } : e));
                return;
              }

              // 기본 명중률: 적 ATK가 높을수록 약간 상승
              let hitChance = Math.min(0.95, 0.75 + (enemy.atk / 500));
              if (
                plElevCombat >= 1 &&
                enemy.weaponAttr !== '마법' &&
                !isEnemyRangedStrike(enemy.attackPattern)
              ) {
                hitChance *= 0.83; // 아래서 위를 노리는 근접은 빗나가기 쉬움
              }
              // 플레이어가 빙결 상태일 때는 사실상 움직이지 못하므로, 적 입장에선 맞추기 훨씬 쉬워야 한다.
              // 회피는 이미 막혀 있고, 여기서는 "완전한 빗나감" 확률만 줄여서 빙결 시 명중률 체감 강화.
              if ((playerState.freezeTurns ?? 0) > 0) {
                hitChance = Math.max(hitChance, 0.98); // 최소 98% 명중
              }
              if ((playerState.runeMirageTurns ?? 0) > 0) {
                hitChance *= 0.72;
              }
              if ((playerState.thiefMirrorCorridorTurns ?? 0) > 0) {
                hitChance *= 0.74; // 거울 복도: 홀로그램이 제3의 그림자로 적 시선을 돌린다
              }
              if (Math.random() > hitChance) {
                pushEnemyCombatLine(
                  `💨 [${enemy.name}]의 공격이 빗나갔습니다. (명중률: ${Math.round(hitChance * 100)}%)`,
                );
                setActiveEnemies(prev => prev.map(e => e.id === enemy.id ? { ...e, atkBuffTurns: Math.max(0, (e.atkBuffTurns ?? 0) - 1), atkBuffBonus: (e.atkBuffTurns ?? 0) <= 1 ? 0 : (e.atkBuffBonus ?? 0) } : e));
                return;
              }

              const playerArmor = isBroken(playerState.armor || '') ? null : getMergedEquippedItem(playerState.armor, playerState.inventory);
              const offHandForDef = isBroken(playerState.offHand || '') ? null : getMergedEquippedItem(playerState.offHand, playerState.inventory);
              const playerShield = offHandForDef?.type === 'shield' ? offHandForDef : null;
              const conDefBonus = Math.floor(effCon * 0.5);
              const arNm = resolveInstanceIdForSlot(playerState.armor, playerState.inventory) ?? playerState.armor ?? '';
              const ohNm = resolveInstanceIdForSlot(playerState.offHand, playerState.inventory) ?? playerState.offHand ?? '';
              const armorEnchant = playerArmor
                ? resolveEquipmentEnchant(arNm, playerArmor, playerState.equipmentEffectiveGrade, playerState.equipmentUpgradeLevels)
                : { tier: 'common' as ItemGrade, plus: 0 };
              const shieldEnchant = playerShield
                ? resolveEquipmentEnchant(ohNm, playerShield, playerState.equipmentEffectiveGrade, playerState.equipmentUpgradeLevels)
                : { tier: 'common' as ItemGrade, plus: 0 };
              const armorDef =
                (playerArmor?.defense ?? 0) +
                (playerArmor?.bonusDefense ?? 0) +
                getEnchantStatBonusFromTierPlus(armorEnchant.tier, armorEnchant.plus);
              const shieldDef =
                (playerShield?.defense ?? 0) +
                (playerShield?.bonusDefense ?? 0) +
                getEnchantStatBonusFromTierPlus(shieldEnchant.tier, shieldEnchant.plus);
              const totalPlayerDef = playerState.def + armorDef + shieldDef + conDefBonus;

              const rand = 0.9 + Math.random() * 0.2;
              const crit = Math.random() < 0.1;
              const effectiveAtkBuff = (enemyLive.atkBuffTurns ?? 0) > 0 ? (enemyLive.atkBuffBonus ?? 0) : 0;
              const baseDmg = ((enemyLive.atk + effectiveAtkBuff) * 0.8) + enemyLive.weaponDmg;
              const defFactor = (100 + enemyLive.str) / (100 + totalPlayerDef);

              const armorAttr = getPlayerArmorAttr();
              const attrModifier = getDamageModifier(enemy.weaponAttr, armorAttr);

              let rawDmg = baseDmg * defFactor * rand * (crit ? 1.5 : 1.0) * attrModifier;
              if ((enemyLive.slowTurns ?? 0) > 0) rawDmg *= 0.82;
              rawDmg *= heavyMult;
              // 고가 전장에서 타워형 저격수는 사격 각도·시야 이점이 있음
              if (
                enemyLive.attackPattern === 'tower_sniper' &&
                getRoomElevation(currentRoomId) >= 1
              ) {
                rawDmg *= 1.08;
              }
              if (enemyLive.phase2) rawDmg *= 1.2; // 2페이즈 보스는 평타도 20% 강해짐
              // 전사: 분노 게이지에 따라 피격 피해 감소
              rawDmg *= getRageDefenseMultiplier();
              // 전사 [도발]: 적이 주는 피해 감소
              if ((playerState.warriorTauntTurns ?? 0) > 0) rawDmg *= 0.72;
              if ((playerState.runeIronFortressTurns ?? 0) > 0) rawDmg *= 0.1;
              if (isDefending) rawDmg *= basicDefend ? 0.48 : 0.3;
              else if (isRiposte) rawDmg *= 0.38;
              else if (isParrying) rawDmg *= basicParry ? 0.56 : 0.5;

              let finalDmg = Math.max(1, Math.round(rawDmg));
              let runeCounterMsgExtra = '';
              if (
                (playerState.runeCounterStanceTurns ?? 0) > 0 &&
                finalDmg > 0 &&
                !isDefending &&
                !isRiposte &&
                !isParrying
              ) {
                finalDmg = Math.max(1, Math.round(finalDmg * 0.55));
                const cDmg = Math.max(1, Math.round(effAtk * 1.25));
                const liveC = activeEnemiesRef.current.find(e => e.id === enemy.id) || enemyLive;
                const nh = liveC.currentHp - cDmg;
                if (nh <= 0) {
                  setActiveEnemies(prev => {
                    const remain = prev
                      .map(e => (e.id === liveC.id ? { ...e, currentHp: 0 } : e))
                      .filter(e => e.currentHp > 0);
                    if (remain.length === 0) {
                      stealthTurnsRef.current = 0;
                      setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0, runeCounterStanceTurns: 0 }));
                      setSceneImage(BG_ALLEY);
                    }
                    return remain;
                  });
                  runeCounterMsgExtra = `\n${handleEnemiesDefeat([liveC], `⚔️ [룬 카운터] 반격으로 [${liveC.name}] 격파! (${cDmg})`, true)}`;
                } else {
                  setActiveEnemies(prev =>
                    prev.map(e =>
                      e.id === liveC.id ? { ...e, currentHp: nh, sleepTurns: 0 } : e,
                    ),
                  );
                  runeCounterMsgExtra = ` ⚔️ [룬 카운터] 반격 ${cDmg}!`;
                }
                setPlayerState(p => ({ ...p, runeCounterStanceTurns: 0 }));
              }

              // 피격 시 내구도 감소(완만): 방어구/방패가 파손되면 효율이 떨어지므로 수리 필요
              if (!isDefending && finalDmg > 0) {
                if (Math.random() < 0.20) damageDurability(playerState.armor, 1, '피격');
                if (Math.random() < 0.12) damageDurability(playerState.offHand, 1, '피격(방패)');
              }

              let customResponse = '';
              if (isRiposte) {
                const counterDmg = Math.max(1, Math.round(playerState.atk * 1.28));
                const newEhp = enemy.currentHp - counterDmg;
                playSoundParrySuccess();
                if (newEhp <= 0) {
                  setActiveEnemies(prev => {
                    const remain = prev.map(e => e.id === enemy.id ? { ...e, currentHp: 0 } : e).filter(e => e.currentHp > 0);
                    if (remain.length === 0) {
                      stealthTurnsRef.current = 0; setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                      setSceneImage(BG_ALLEY);
                    }
                    return remain;
                  });
                  customResponse = `\n${handleEnemiesDefeat([enemy], `🔄 [반격 태세] [${enemy.name}]에게 반격으로 결정타! (${counterDmg})`, true)}`;
                  return;
                }
                setActiveEnemies(prev => prev.map((e, i) => i === index ? { ...e, currentHp: newEhp } : e));
                customResponse = `\n🔄 [반격 태세] [${enemy.name}]에게 ${counterDmg} 반격 피해!`;
              } else if (isParrying) {
                // WHY: 패링은 "위험을 감수하는 고위험·고보상 선택"이어야 하므로
                //      성공 시 높은 크리티컬 확률과 강한 반격 데미지를 부여한다.
                const parrySuccessChance = basicParry ? 0.24 : 0.3;
                if (Math.random() < parrySuccessChance) {
                  const isParryCrit = Math.random() < 0.5; // 패링 반격 전용 크리티컬 확률 50%
                  const baseCounter = playerState.atk * (basicParry ? 1.5 : 1.8);
                  const counterMult = isParryCrit ? (basicParry ? 2.5 : 3.0) : (basicParry ? 1.55 : 1.8);
                  const counterDmg = Math.max(1, Math.round(baseCounter * counterMult));
                  const newEhp = enemy.currentHp - counterDmg;
                  if (newEhp <= 0) {
                     setActiveEnemies(prev => {
                        const remain = prev.map(e => e.id === enemy.id ? {...e, currentHp: 0} : e).filter(e => e.currentHp > 0);
                        if (remain.length === 0) {
                           stealthTurnsRef.current = 0; setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0}));
                           setSceneImage(BG_ALLEY);
                        }
                        return remain;
                     });
                     playSoundParrySuccess();
                     const title = isParryCrit ? `💥 패링 치명타! [${enemy.name}]에게 결정타를 날렸습니다! (${counterDmg} 피해)` : `✨ 패링 대성공! [${enemy.name}]에게 치명적인 반격! (${counterDmg} 피해)`;
                     customResponse = `\n${handleEnemiesDefeat([enemy], title, true)}`;
                     setActiveEnemies(prev => prev.map(e => e.id === enemy.id ? { ...e, atkBuffTurns: Math.max(0, (e.atkBuffTurns ?? 0) - 1), atkBuffBonus: (e.atkBuffTurns ?? 0) <= 1 ? 0 : (e.atkBuffBonus ?? 0) } : e));
                     return;
                  } else {
                    playSoundParrySuccess();
                    setActiveEnemies(prev => prev.map((e, i) => i === index ? { ...e, currentHp: newEhp } : e));
                    customResponse = isParryCrit
                      ? `\n💥 패링 치명타! [${enemy.name}]에게 ${counterDmg} 피해를 되돌려주었습니다.`
                      : `\n✨ 패링 반격! [${enemy.name}]에게 ${counterDmg} 피해를 되돌려주었습니다.`;
                  }
                } else {
                  // 패링 실패음은 아래 로그 타이밍에서 피격음 대신 재생하도록 처리
                }
              }

              // 전사 [가시 갑옷]: 근접(무기 속성이 마법이 아닌) 명중 시 받은 피해 비율 + 힘 기반으로 반사
              let thornReflectMsg = '';
              const thornAuraT = playerState.warriorThornAuraTurns ?? 0;
              if (
                loggedInChar?.job === '전사' &&
                thornAuraT > 0 &&
                enemy.weaponAttr !== '마법' &&
                finalDmg > 0
              ) {
                const liveForThorn = activeEnemiesRef.current.find(e => e.id === enemy.id) || enemyLive;
                const thornDmg = Math.max(
                  1,
                  Math.round(finalDmg * 0.30 + effStr * 0.55 + totalPlayerDef * 0.06),
                );
                const hpAfterThorn = liveForThorn.currentHp - thornDmg;
                if (hpAfterThorn <= 0) {
                  setActiveEnemies(prev => {
                    const remain = prev
                      .map(e => (e.id === liveForThorn.id ? { ...e, currentHp: 0 } : e))
                      .filter(e => e.currentHp > 0);
                    if (remain.length === 0) {
                      stealthTurnsRef.current = 0;
                      setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                      setSceneImage(BG_ALLEY);
                    }
                    return remain;
                  });
                  thornReflectMsg = `\n${handleEnemiesDefeat([liveForThorn], `🦔 [가시 갑옷] 가시가 ${thornDmg} 반사 피해로 [${liveForThorn.name}]을(를) 관통했다!`)}`;
                } else {
                  setActiveEnemies(prev =>
                    prev.map(e =>
                      e.id === liveForThorn.id
                        ? { ...e, currentHp: hpAfterThorn, sleepTurns: 0 }
                        : e,
                    ),
                  );
                  thornReflectMsg = ` 🦔 [가시 갑옷] 반사 ${thornDmg}! (${thornAuraT}턴 남음)`;
                }
              }

              let shieldRuneReflectMsg = '';
              const movingFortSynergy = getActiveSynergyIds(
                playerState.equippedRuneId,
                playerState.equippedRuneSecondaryId,
              ).includes('moving_fortress');
              if (
                playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'shield_preacher') &&
                playerShield &&
                enemy.weaponAttr !== '마법' &&
                finalDmg > 0
              ) {
                const liveS = activeEnemiesRef.current.find(e => e.id === enemy.id) || enemyLive;
                const spSc = getRuneScaleForPassive(
                  'shield_preacher',
                  playerState.equippedRuneId,
                  playerState.equippedRuneSecondaryId,
                  playerState.equippedRuneQuality ?? 1,
                  playerState.equippedRuneSecondaryQuality ?? 1,
                  loggedInChar?.job,
                );
                const refPct = Math.min(0.42, (movingFortSynergy ? 0.3 : 0.15) * spSc);
                const sDmg = Math.max(1, Math.round(finalDmg * refPct));
                const h2 = liveS.currentHp - sDmg;
                if (h2 <= 0) {
                  setActiveEnemies(prev => {
                    const remain = prev
                      .map(e => (e.id === liveS.id ? { ...e, currentHp: 0 } : e))
                      .filter(e => e.currentHp > 0);
                    if (remain.length === 0) {
                      stealthTurnsRef.current = 0;
                      setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                      setSceneImage(BG_ALLEY);
                    }
                    return remain;
                  });
                  shieldRuneReflectMsg = `\n${handleEnemiesDefeat([liveS], `🛡️ [철벽전도사] 방패 반사 ${sDmg}로 [${liveS.name}] 격파!`, true)}`;
                } else {
                  setActiveEnemies(prev =>
                    prev.map(e =>
                      e.id === liveS.id ? { ...e, currentHp: h2, sleepTurns: 0 } : e,
                    ),
                  );
                  shieldRuneReflectMsg = ` 🛡️ [철벽전도사] 방패 반사 ${sDmg}!`;
                }
              }

              let hasLogged = false;
              let thiefPlayDeadNegatedThisHit = false;
              const didInflictStatus = enemy.element && Math.random() < ENEMY_INFLICT_STATUS_CHANCE;
              /** 피격 로그용 — 마나 실드(토글) 우선, 아니면 신의 방패(턴 버프) */
              let shieldTagForThisHit = '신의 방패';
              setPlayerState(prev => {
                // 마나 실드(상시 토글) · 신의 방패(5턴): 맞을 때 HP 대신 MP 소모. MP 부족분은 HP로.
                const manaShieldOn = isManaShieldEffectivelyActive(prev);
                const godShieldOn = (prev.godShieldTurns ?? 0) > 0;
                let hpDamage = finalDmg;
                let mpConsumed = 0;
                if ((manaShieldOn || godShieldOn) && finalDmg > 0) {
                  shieldTagForThisHit = manaShieldOn ? '마나 실드' : '신의 방패';
                  if (prev.mp >= finalDmg) {
                    mpConsumed = finalDmg;
                    hpDamage = 0;
                  } else {
                    mpConsumed = prev.mp;
                    hpDamage = finalDmg - prev.mp;
                  }
                }
                // 죽은 척 오스: HP로 까이는 피해 1회를 연기로 무효
                if ((prev.thiefPlayDeadCharges ?? 0) > 0 && hpDamage > 0) {
                  thiefPlayDeadNegatedThisHit = true;
                  hpDamage = 0;
                }
                const nextHp = prev.hp - hpDamage;
                const nextMp = Math.max(0, (prev.mp ?? 0) - mpConsumed);
                let next: typeof prev = { ...prev, hp: Math.max(0, nextHp), mp: nextMp };
                // 마나 실드: MP가 0이 되면 자동 해제(다음 타격부터 HP 전량 피해)
                if (manaShieldOn && nextMp <= 0) {
                  next = { ...next, manaShieldActive: false };
                }
                if (thiefPlayDeadNegatedThisHit) {
                  next = {
                    ...next,
                    thiefPlayDeadCharges: Math.max(0, (prev.thiefPlayDeadCharges ?? 0) - 1),
                  };
                }
                // 피격 시 수면 즉시 해제
                if (hpDamage > 0 && (prev.sleepTurns ?? 0) > 0) next = { ...next, sleepTurns: 0 };
                const ccImmuneFort = getActiveSynergyIds(
                  prev.equippedRuneId,
                  prev.equippedRuneSecondaryId,
                ).includes('moving_fortress');
                if (didInflictStatus && enemy.element && nextHp > 0 && !ccImmuneFort && !thiefPlayDeadNegatedThisHit) {
                  const t = STATUS_DEFAULT_TURNS;
                  const MAX_STATUS_TURNS = 10;
                  const MAX_FREEZE_TURNS = 1; // 빙결은 항상 1턴만 행동 불가
                  if (enemy.element === '불') {
                    next = { ...next, burnTurns: Math.min(MAX_STATUS_TURNS, (prev.burnTurns ?? 0) + t) };
                  } else if (enemy.element === '얼음') {
                    const currentFreeze = prev.freezeTurns ?? 0;
                    if (currentFreeze <= 0) {
                      next = { ...next, freezeTurns: Math.min(MAX_FREEZE_TURNS, t) };
                    } else {
                      // 이미 빙결 중이면 (MAX가 1이라서) 연장은 사실상 일어나지 않는다.
                      if (Math.random() < 0.5) {
                        next = { ...next, freezeTurns: Math.min(MAX_FREEZE_TURNS, currentFreeze + 1) };
                      } // 나머지 50%는 추가 빙결 없음 (부분 저항)
                    }
                  } else if (enemy.element === '전기') {
                    next = { ...next, staggerTurns: Math.min(MAX_STATUS_TURNS, (prev.staggerTurns ?? 0) + t) };
                  } else if (enemy.element === '독') {
                    next = { ...next, poisonTurns: Math.min(MAX_STATUS_TURNS, (prev.poisonTurns ?? 0) + t) };
                  } else if (enemy.element === '수면') {
                    next = { ...next, sleepTurns: 5 }; // 수면 5턴, 피격 시 해제됨
                  }
                }

                if (!hasLogged) {
                  hasLogged = true;
                  if (nextHp <= 0 && prev.hp > 0) {
                     playerDefeatedInThisTurn = true;
                     playSoundDeath();
                     const coinLossPercent = 0.05 + Math.random() * 0.15; // 5% ~ 20%
                     const lostCoin = Math.floor((prev.credit || 0) * coinLossPercent);
                     const respawnRoomId = prev.respawnRoomId || STARTING_ROOM_ID;
                     const killerBaseId = enemy.id.replace(/_ambush$/, '').replace(/_?\d+$/, '');
                     const curGrowth = prev.enemyGrowth?.[killerBaseId] ?? { exp: 0, level: 0 };
                     const newExp = curGrowth.exp + ENEMY_GROWTH_EXP_PER_KILL;
                     const newLevel = getEnemyGrowthLevel(newExp);
                     const growthLog = newLevel > curGrowth.level ? `\n[${enemy.name}]이(가) 경험치를 흡수했다! (Lv.${newLevel}로 성장!)` : '';
                     // 1) 적 성장 반영 + 피격 상세(데미지 숫자) + 치명상 로그 + 전용 오버레이
                     setTimeout(() => {
                         const hitPartDeath = pickHitPart();
                         const strikeDescDeath = describeEnemyStrike(enemy, hitPartDeath);
                         let hitDetailDeath = isDefending
                           ? `🛡 방어 실패! [${enemy.name}]의 ${strikeDescDeath} (피해 ${finalDmg})`
                           : isRiposte
                             ? `🔄 [반격 태세] [${enemy.name}]의 ${strikeDescDeath} — 치명타 (피해 ${finalDmg})${customResponse || ''}`
                             : isParrying
                               ? `❌ 패링 실패! [${enemy.name}]의 ${strikeDescDeath} (피해 ${finalDmg})`
                               : thiefPlayDeadNegatedThisHit
                                 ? `🎭 [죽은 척] 마지막 타격 ${strikeDescDeath} — 이론상 ${finalDmg}${mpConsumed > 0 ? ` · ${shieldTagForThisHit} MP -${mpConsumed}` : ''}`
                                 : `💥 피격! [${enemy.name}]의 ${strikeDescDeath}에 맞아 ${finalDmg} 데미지를 입었습니다. — 쓰러짐` +
                                   (hpDamage > 0 && mpConsumed > 0
                                     ? ` (HP -${hpDamage}) 🛡️ [${shieldTagForThisHit}] MP로 흡수 (MP -${mpConsumed})`
                                     : hpDamage > 0
                                       ? ` (HP -${hpDamage})`
                                       : mpConsumed > 0
                                         ? ` 🛡️ [${shieldTagForThisHit}] MP로 흡수 (MP -${mpConsumed})`
                                         : '');
                         if (thornReflectMsg.trim()) hitDetailDeath += thornReflectMsg.startsWith('\n') ? thornReflectMsg : `\n${thornReflectMsg}`;
                         if (shieldRuneReflectMsg.trim()) {
                           hitDetailDeath += shieldRuneReflectMsg.startsWith('\n') ? shieldRuneReflectMsg : `\n${shieldRuneReflectMsg}`;
                         }
                         firePlayerDamagePop(finalDmg, hpDamage, mpConsumed);
                         setPlayerState(p => ({
                           ...p,
                           enemyGrowth: { ...(p.enemyGrowth ?? {}), [killerBaseId]: { exp: newExp, level: newLevel } },
                         }));
                         setLogs((logs) => {
                            const flatlineBanner = `\n╔══════════════════════════════════╗\n║  ☠  Y O U   A R E   D E A D  ☠  ║\n║     << F L A T L I N E D >>      ║\n╚══════════════════════════════════╝`;
                            return appendEnemyCombatLog(
                              logs,
                              `${hitDetailDeath}\n💥 치명상! [${enemy.name}]의 일격에 쓰러졌습니다...${flatlineBanner}${growthLog}`,
                            );
                         });
                         setShowDeathOverlay(true);
                     }, 150);
                     // 2) 2.5초 후 오버레이 제거 → 리스폰 처리 → 안전지대 메시지 로그
                     const deathOverlayMs = 2500;
                     setTimeout(() => {
                         setShowDeathOverlay(false);
                         stealthTurnsRef.current = 0;
                         suppressInvadedSafeLiberationRef.current = true;
                        let diedWithSoulBinder = false;
                        setPlayerState(p => {
                          diedWithSoulBinder = playerHasRune(p.equippedRuneId, p.equippedRuneSecondaryId, 'soul_binder');
                          const lostExp = diedWithSoulBinder ? 0 : Math.floor(p.exp * 0.2);
                          return {
                              ...p,
                              isCombat: false,
                              stealthTurnsLeft: 0,
                              hp: 5,
                              exp: Math.max(0, p.exp - lostExp),
                              credit: Math.max(0, (p.credit || 0) - lostCoin)
                          };
                         });
                         setCurrentRoomId(respawnRoomId);
                         setActiveEnemies([]);
                         setSceneImage(resolveRoomSceneImage(getRoomById(respawnRoomId)));
                         const safeRoom = getRoomById(respawnRoomId);
                         setLogs(logs => [
                           ...logs,
                           diedWithSoulBinder
                             ? `(안전지대 [${safeRoom?.name || '시작 지점'}]에서 눈을 떴습니다. 영혼결속 룬이 경험치를 지켜 주었습니다. ${lostCoin} COIN을 잃었습니다.)`
                             : `(안전지대 [${safeRoom?.name || '시작 지점'}]에서 눈을 떴습니다. 경험치 20%와 ${lostCoin} COIN을 잃었습니다.)`,
                         ]);
                         setRage(0); // 사망 리스폰 시 분노 초기화
                     }, 150 + deathOverlayMs);
                  } else if (nextHp > 0) {
                    // 전사: HP가 실제로 깎일 때만 분노 증가 (신의 방패·마나 실드로 MP만 깎인 경우 제외). 획득량 2배.
                    if (loggedInChar?.job === '전사' && hpDamage > 0) {
                      const baseRage = Math.max(3, Math.min(8, Math.round(hpDamage / 10)));
                      gainRage(baseRage * 2);
                    }
                    if (isDefending) playSoundBlock();
                    else if (isRiposte) playSoundBlock();
                    else if (isParrying && !customResponse) playSoundParryFail();
                    else if (isParrying && customResponse) { /* 이미 성공 사운드 재생됨 */ }
                    else if (!thiefPlayDeadNegatedThisHit) playSoundHit();

                    setTimeout(() => {
                      const hitPart = pickHitPart();
                      const strikeDesc = describeEnemyStrike(enemy, hitPart);
                      let msg = isDefending
                        ? `🛡 방어! [${enemy.name}]가 가한 ${strikeDesc}을(를) 막아냈습니다. (피해 ${finalDmg} HP)`
                        : isRiposte
                          ? `🔄 [반격 태세] [${enemy.name}]가 가한 ${strikeDesc}에 흘려 맞았습니다. (피해 ${finalDmg} HP)${customResponse || ''}`
                        : isParrying
                        ? customResponse
                          ? `⚔️ 패링! [${enemy.name}]의 ${strikeDesc}! (피해 ${finalDmg} HP)${customResponse}`
                          : `❌ 패링 실패! [${enemy.name}]의 ${strikeDesc}를 막지 못했습니다. (피해 ${finalDmg} HP)`
                        : thiefPlayDeadNegatedThisHit
                          ? `🎭 [죽은 척 오스] [${enemy.name}]의 ${strikeDesc}은(는) 빈 포탄처럼 빗나간다… 숨을 멈추고 무너지는 연기로 HP 피해를 흘렸다.${mpConsumed > 0 ? ` 🛡️ [${shieldTagForThisHit}] MP로 흡수 (MP -${mpConsumed})` : ''}`
                          : `💥 피격! [${enemy.name}]의 ${strikeDesc}에 맞아 ${finalDmg} 데미지를 입었습니다.` +
                          (hpDamage > 0 && mpConsumed > 0
                            ? ` (HP -${hpDamage}) 🛡️ [${shieldTagForThisHit}] MP로 흡수 (MP -${mpConsumed})`
                            : hpDamage > 0
                              ? ` (HP -${hpDamage})`
                              : mpConsumed > 0
                                ? ` 🛡️ [${shieldTagForThisHit}] MP로 흡수 (MP -${mpConsumed})`
                                : '');
                      if (thornReflectMsg.trim()) msg += thornReflectMsg.startsWith('\n') ? thornReflectMsg : `\n${thornReflectMsg}`;
                      if (shieldRuneReflectMsg.trim()) {
                        msg += shieldRuneReflectMsg.startsWith('\n') ? shieldRuneReflectMsg : `\n${shieldRuneReflectMsg}`;
                      }
                      if (runeCounterMsgExtra.trim()) {
                        msg += runeCounterMsgExtra.startsWith('\n') ? runeCounterMsgExtra : `\n${runeCounterMsgExtra}`;
                      }
                      if (didInflictStatus && enemy.element && !thiefPlayDeadNegatedThisHit) {
                        const st = ELEMENT_TO_STATUS[enemy.element];
                        const clarify =
                          enemy.element === '전기'
                            ? ' (턴당 피해·행동 제한 없음)'
                            : enemy.element === '얼음'
                              ? ' (행동 불가)'
                              : '';
                        msg += `\n⚠️ [${enemy.name}]의 공격으로 ${st}! (${STATUS_DEFAULT_TURNS}턴)${clarify}`;
                      }
                      firePlayerDamagePop(finalDmg, hpDamage, mpConsumed);
                      pushEnemyCombatLine(msg);
                    }, 50);
                  }
                }

                return next;
              });
              // 이번 적 턴 종료 시 버프 지속 턴 감소 (공격한 적만 해당)
              setActiveEnemies(prev => prev.map(e => e.id === enemy.id ? { ...e, atkBuffTurns: Math.max(0, (e.atkBuffTurns ?? 0) - 1), atkBuffBonus: (e.atkBuffTurns ?? 0) <= 1 ? 0 : (e.atkBuffBonus ?? 0) } : e));
              };

              const canHeavyQte =
                heavyMult > 1.05 &&
                (playerState.freezeTurns ?? 0) <= 0 &&
                Math.random() <
                  (enemyLive.isBoss ? HEAVY_ATTACK_QTE_CHANCE_BOSS : HEAVY_ATTACK_QTE_CHANCE_NORMAL);
              if (canHeavyQte) {
                const hk: MiniBossQteKey[] = ['w', 'a', 's', 'd'];
                const hSeq = [hk[Math.floor(Math.random() * 4)]!];
                miniBossQteLockRef.current = true;
                heavyStrikeQteEnemyIdRef.current = enemyLive.id;
                heavyStrikeQteFailContinueRef.current = () => {
                  heavyStrikeQteFailContinueRef.current = null;
                  proceedWithEnemyStrike({ skipPassiveDodge: true });
                  miniBossQteLockRef.current = false;
                };
                setHeavyStrikeQte({ enemyName: enemyLive.name, sequence: hSeq });
                setLogs((prev) => [
                  ...prev,
                  '⚡ [강공 대응] 간격이 좁아졌다! QTE로 회피를 시도하세요. (성공 시 회피, 실패 시 그대로 피해)',
                ]);
                return;
              }
              proceedWithEnemyStrike({ skipPassiveDodge: false });
           }, index * 400);
           enemyTurnTimeoutsRef.current.push(tId);
        });

        // 회복 기도 HoT + 신의 방패·축복 등 버프 지속 시간 감소: 적 턴이 모두 끝난 뒤 1틱 적용. 1행동당 1회만 (Strict Mode 이중 호출 방지)
        const roundEndDelay = currentEnemies.length * 400 + 150;
        setTimeout(() => {
          setPlayerState(p => {
            if (roundEndRegenAppliedRef.current) return p; // 이미 적용됐으면 스킵 (이중 적용·이중 로그 방지)
            roundEndRegenAppliedRef.current = true;

            let next = { ...p };
            const turns = p.prayerHealTurns ?? 0;
            const perTurn = p.prayerHealPerTurn ?? 0;
            if (turns > 0 && perTurn > 0) {
              const maxHp = p.maxHp ?? p.hp;
              const actualHeal = Math.min(perTurn, maxHp - p.hp);
              const newHp = Math.min(maxHp, p.hp + perTurn);
              if (actualHeal > 0) setLogs(prev => [...prev, `📿 [회복 기도] 기도의 은총 (HP +${actualHeal}) (${turns - 1}턴 남음)`]);
              next = { ...next, hp: newHp, prayerHealTurns: turns - 1 };
            }
            const shieldTurns = p.godShieldTurns ?? 0;
            if (shieldTurns > 0) {
              next = { ...next, godShieldTurns: shieldTurns - 1 };
              if (shieldTurns - 1 > 0) setLogs(prev => [...prev, `🛡️ [신의 방패] (${shieldTurns - 1}턴 남음)`]);
            }
            // 축복 버프 턴 감소 및 만료 처리 — Strict Mode 이중 호출을 고려해,
            // 상태 업데이트는 항상 수행하고, 로그만 1번 남기도록 한다.
            const blessTurns = p.blessTurns ?? 0;
            if (blessTurns > 0) {
              const nextBless = blessTurns - 1;
              const prevBonus = p.blessAtkBonus ?? 0;
              const baseAtk = next.atk - prevBonus;
              next = {
                ...next,
                blessTurns: nextBless,
                atk: nextBless > 0 ? baseAtk + prevBonus : baseAtk,
                blessAtkBonus: nextBless > 0 ? prevBonus : 0,
              };
              if (!roundEndRegenAppliedRef.current) {
                if (nextBless > 0) {
                  setLogs(prev => [...prev, `✨ [축복] 효과 지속 (${nextBless}턴 남음)`]);
                } else {
                  setHasBlessBuff(false);
                  setLogs(prev => [...prev, '✨ [축복] 효과가 사라졌습니다.']);
                }
              }
            }
            // 전사 [도발] 턴 감소
            const tauntT = p.warriorTauntTurns ?? 0;
            if (tauntT > 0) {
              const nt = tauntT - 1;
              next = { ...next, warriorTauntTurns: nt };
              if (nt > 0) setLogs(prev => [...prev, `😤 [도발] 적의 집중이 흐트러집니다. (${nt}턴 남음)`]);
              else setLogs(prev => [...prev, '😤 [도발] 적이 다시 기세를 되찾았습니다.']);
            }
            // 전사 [철벽] 만료 시 DEF 보너스 제거
            const fortT = p.fortifyTurns ?? 0;
            if (fortT > 0) {
              const nft = fortT - 1;
              const fBonus = p.fortifyDefBonus ?? 0;
              if (nft <= 0) {
                next = {
                  ...next,
                  fortifyTurns: 0,
                  fortifyDefBonus: 0,
                  def: Math.max(0, next.def - fBonus),
                };
                setLogs(prev => [...prev, '🏰 [철벽] 방어 자세가 풀렸습니다.']);
              } else {
                next = { ...next, fortifyTurns: nft };
                setLogs(prev => [...prev, `🏰 [철벽] (${nft}턴 남음)`]);
              }
            }
            // 전사 [가시 갑옷] 지속 턴 감소
            const thornT = p.warriorThornAuraTurns ?? 0;
            if (thornT > 0) {
              const nTh = thornT - 1;
              next = { ...next, warriorThornAuraTurns: nTh };
              if (nTh > 0) setLogs(prev => [...prev, `🦔 [가시 갑옷] 가시가 곤두선 채입니다. (${nTh}턴 남음)`]);
              else setLogs(prev => [...prev, '🦔 [가시 갑옷] 가시가 몸속으로 스며들었다.']);
            }
            const mirT = p.thiefMirrorCorridorTurns ?? 0;
            if (mirT > 0) {
              const nm = mirT - 1;
              next = { ...next, thiefMirrorCorridorTurns: nm };
              if (nm <= 0) setLogs(prev => [...prev, '🪞 [거울 복도] 환영이 걷히며 적이 다시 초점을 맞춘다.']);
            }
            if (
              p.isCombat &&
              playerHasRune(p.equippedRuneId, p.equippedRuneSecondaryId, 'sage') &&
              !isManaShieldRegenSuppressed(p)
            ) {
              const recMp = Math.max(4, Math.floor((p.maxMp ?? 0) * 0.08));
              next.mp = Math.min(p.maxMp ?? 0, next.mp + recMp);
              setLogs(prev => [...prev, `📖 [현자 룬] 교전 중 MP 재생 (+${recMp})`]);
            }
            const rIf = p.runeIronFortressTurns ?? 0;
            if (rIf > 0) {
              const nIf = rIf - 1;
              next.runeIronFortressTurns = nIf;
              if (nIf > 0) setLogs(prev => [...prev, `🏰 [철의 요새] (${nIf}턴 남음)`]);
              else setLogs(prev => [...prev, '🏰 [철의 요새] 해제. 이동이 가능합니다.']);
            }
            const rMg = p.runeMirageTurns ?? 0;
            if (rMg > 0) {
              const nMg = rMg - 1;
              next.runeMirageTurns = nMg;
              if (nMg > 0) setLogs(prev => [...prev, `🌫 [미라지] (${nMg}턴)`]);
            }
            const rPw = p.runePoisonWeaponTurns ?? 0;
            if (rPw > 0) {
              const nPw = rPw - 1;
              next.runePoisonWeaponTurns = nPw;
              if (nPw > 0) setLogs(prev => [...prev, `☠ [독 도포] 무기 (${nPw}턴)`]);
            }
            const rWd = p.runeWindDashDodgeTurns ?? 0;
            if (rWd > 0) {
              const nWd = rWd - 1;
              next.runeWindDashDodgeTurns = nWd;
              if (nWd > 0) setLogs(prev => [...prev, `💨 [대시 잔풍] 회피 보조 (${nWd}턴)`]);
            }
            // HP/MP 회복 패시브: 적 턴 종료 후 1회 (라운드당 1회 가드는 roundEndRegenAppliedRef)
            const regenAfterRound = applyRegenPassive(next);
            next = regenAfterRound.next;
            regenAfterRound.logs.forEach((line) => setLogs((prev) => [...prev, line]));
            // 갑옷 파쇄 틱: 라운드 종료 1회만 (위와 동일 가드)
            setActiveEnemies(prev =>
              prev.map(e => {
                const st = e.sunderTurns ?? 0;
                if (st <= 0) return { ...e, sunderDefFlat: 0 };
                const nst = st - 1;
                return { ...e, sunderTurns: nst, sunderDefFlat: nst <= 0 ? 0 : (e.sunderDefFlat ?? 0) };
              })
            );
            return next;
          });
        }, roundEndDelay);
        }, 0);
      };

      // 태세: 전투·턴·빙결·수면과 무관하게 즉시 전환 (턴 소모 없음)
      let postureHandled = false;
      if (/^태세\s+(공격|공방|방어)$/.test(input.trim())) {
        postureHandled = true;
        const sub = input.trim().split(/\s+/)[1] as '공격' | '공방' | '방어';
        const next: BattlePosture =
          sub === '공격' ? 'attack' : sub === '방어' ? 'defense' : 'balanced';
        setPlayerState((p) => ({ ...p, battlePosture: next }));
        const a = BATTLE_POSTURE_ATK_MULT[next];
        const d = BATTLE_POSTURE_DEF_MULT[next];
        const g = BATTLE_POSTURE_GUARD_CHANCE_MULT[next];
        response =
          `⚔ 태세를 【${BATTLE_POSTURE_LABEL[next]}】로 맞췄습니다. (ATK×${a} / DEF×${d} / 자동방어 확률×${g}, 턴 소모 없음)`;
      }

      // 빙결: 턴 소모만 하고 이동·공격·스킬·도망 등 행동 불가
      let freezeBlocked = false;
      if ((playerState.freezeTurns ?? 0) > 0) {
        const isMove = input.startsWith('이동 ');
        const isCombatAction = playerState.isCombat && (
          input.startsWith('스킬 ') ||
          /^(공격|어택)(\s*\d*)?$/.test(input) ||
          /^(방어|가드|회피|도지|패링|쳐내기)(\s*|$)/.test(input) ||
          ['도망', '후퇴'].includes(input) ||
          input.startsWith('사용 ')
        );
        if (isMove || isCombatAction) {
          freezeBlocked = true;
          const nextFreeze = Math.max(0, (playerState.freezeTurns ?? 0) - 1);
          setPlayerState(p => ({ ...p, freezeTurns: nextFreeze }));
          response = `❄️ 빙결로 행동 불가! (${nextFreeze}턴 남음)`;
          if (playerState.isCombat && activeEnemies.length > 0) triggerEnemyTurn(activeEnemies, undefined, 'neutral');
        }
      }

      // 수면: 5턴 행동 불가, 피격 시 즉시 해제 (해제는 적 턴에서 피해 적용 시 처리됨)
      let sleepBlocked = false;
      if (!freezeBlocked && (playerState.sleepTurns ?? 0) > 0) {
        const isMove = input.startsWith('이동 ');
        const isCombatAction = playerState.isCombat && (
          input.startsWith('스킬 ') ||
          /^(공격|어택)(\s*\d*)?$/.test(input) ||
          /^(방어|가드|회피|도지|패링|쳐내기)(\s*|$)/.test(input) ||
          ['도망', '후퇴'].includes(input) ||
          input.startsWith('사용 ')
        );
        if (isMove || isCombatAction) {
          sleepBlocked = true;
          const nextSleep = Math.max(0, (playerState.sleepTurns ?? 0) - 1);
          setPlayerState(p => ({ ...p, sleepTurns: nextSleep }));
          response = `💤 수면 중... 움직일 수 없습니다! (${nextSleep}턴 남음, 공격당하면 깨어남)`;
          if (playerState.isCombat && activeEnemies.length > 0) triggerEnemyTurn(activeEnemies, undefined, 'neutral');
        }
      }

      if (!postureHandled && !freezeBlocked && !sleepBlocked) {
      if (['상태','스테이터스'].includes(input)) {
        const armorAttr = getPlayerArmorAttr();
        const baseDodge = getArmorDodgeChance(armorAttr);
        const dexDodgeBonus = (effDex || 5) * 0.008;
        const dodgeRate = Math.min(90, Math.round((baseDodge + dexDodgeBonus) * 100));
        const baseGuardChance = getArmorGuardChance(armorAttr);
        const postureSt = playerState.battlePosture ?? 'balanced';
        const guardChance = Math.round(
          applyPostureToGuardChance(baseGuardChance, postureSt) * 100
        );
        const speed = getArmorSpeedText(armorAttr);
        const jobName = loggedInChar?.job || '백수';
        const weaponLine = playerState.weapon
          ? (() => {
              const w = getMergedEquippedItem(playerState.weapon, playerState.inventory);
              const oh = playerState.offHand ? getMergedEquippedItem(playerState.offHand, playerState.inventory) : null;
              if (w?.type !== 'weapon') return '';
              const wDisp = resolveSlotToItemName(playerState.weapon, playerState.inventory);
              const mainStr = `[${wDisp}] (${w.minDamage}~${w.maxDamage})`;
              if (oh?.type === 'weapon' && oh.weaponClass === 'dagger') {
                const ohDisp = resolveSlotToItemName(playerState.offHand, playerState.inventory);
                return `\n무기: ${mainStr} / [${ohDisp}] (${oh.minDamage}~${oh.maxDamage}) — 쌍단검`;
              }
              return `\n무기: ${mainStr}`;
            })()
          : '';
        const rageLine = loggedInChar?.job === '전사'
          ? ` RAGE:${Math.round(rage)}/100`
          : '';
        // WHY: 분노는 실제 평타 식에만 곱해져 와서 상태 창 ATK가 안 올라가 보였음 — 전사에게 보정 배율·환산 ATK를 같이 표시
        const rageAtkMult = loggedInChar?.job === '전사' && rage > 0 ? getRageAttackMultiplier() : 1;
        const rageDefMult = loggedInChar?.job === '전사' && rage > 0 ? getRageDefenseMultiplier() : 1;
        const effAtkRageDisplay =
          loggedInChar?.job === '전사' && rage > 0
            ? `${effAtk} → 분노 반영 ${Math.max(1, Math.round(effAtk * rageAtkMult))} (×${rageAtkMult.toFixed(2)})`
            : `${effAtk}`;
        const rageMitigationLine =
          loggedInChar?.job === '전사' && rage > 0
            ? `\n💢 [분노] 공격 위력 ×${rageAtkMult.toFixed(2)} · 실제 받는 피해 ×${rageDefMult.toFixed(2)} (방어력 수치와 별개로 피격 단계에서 적용)`
            : '';
        response =
          `[현재 상태] 직업:${jobName} LV:${playerState.level}${playerState.level >= PLAYER_MAX_LEVEL ? ' (만렙)' : ''}${rageLine} ` +
          `HP:${playerState.hp}/${playerState.maxHp} MP:${playerState.mp}/${playerState.maxMp}\n` +
          `기본스탯: STR:${playerState.str} DEX:${playerState.dex} CON:${playerState.con} INT:${playerState.int} SPR:${playerState.spr}\n` +
          `장비반영: STR:${effStr} DEX:${effDex} CON:${effCon} INT:${effInt} SPR:${effSpr}\n` +
          `전투스탯: ATK:${effAtkRageDisplay} DEF:${effDef} 💰 COIN:${playerState.credit || 0}${weaponLine}${rageMitigationLine}\n` +
          `태세: 【${BATTLE_POSTURE_LABEL[playerState.battlePosture ?? 'balanced']}】 (ATK×${BATTLE_POSTURE_ATK_MULT[playerState.battlePosture ?? 'balanced']} / DEF×${BATTLE_POSTURE_DEF_MULT[playerState.battlePosture ?? 'balanced']} / 자동방어×${BATTLE_POSTURE_GUARD_CHANCE_MULT[playerState.battlePosture ?? 'balanced']})\n` +
          `장착 방어구 특성: [속도 ${speed}] [회피 ${dodgeRate}%] [자동방어 ${guardChance}%]\n` +
          (playerState.title ? `칭호: ${playerState.title}\n` : '') +
          (Object.keys(playerState.weaponMasteryLevel || {}).length > 0
            ? `[무기 마스터리] ${Object.entries(playerState.weaponMasteryLevel || {}).map(([k, lv]) => `${(WEAPON_CLASS_LABEL as Record<string, string>)[k] ?? k} Lv.${lv}`).join(', ')}\n`
            : '') +
          `* 잔여 스탯 포인트: ${playerState.statPoints || 0} (\`스탯투자 힘\` 등 입력)`;
      } else if (input === '마스터리') {
        const levels = playerState.weaponMasteryLevel || {};
        const exps = playerState.weaponMasteryExp || {};
        if (Object.keys(levels).length === 0 && Object.keys(exps).length === 0) {
          response = '[무기 마스터리]\n아직 오른 마스터리가 없습니다. 무기를 장착하고 전투에서 사용하면 해당 무기 계열 마스터리가 올라갑니다.\n(도적은 생성 시 단검 마스터리 Lv.1부터 시작합니다.)';
        } else {
          const lines = Object.keys({ ...levels, ...exps }).map(wc => {
            const exp = exps[wc] ?? 0;
            const lv = levels[wc] ?? expToLevel(exp);
            const nextExp = MASTERY_EXP_TABLE[lv] ?? MASTERY_EXP_TABLE[9];
            const label = (WEAPON_CLASS_LABEL as Record<string, string>)[wc] ?? wc;
            return `- ${label} 마스터리: Lv.${lv} (경험치 ${exp} / 다음 레벨 ${nextExp})`;
          });
          response = '[무기 마스터리]\n' + lines.join('\n') + '\n\n상급 무기는 일정 마스터리 이상일 때만 착용할 수 있습니다.';
        }
      } else if (input === '패시브' || input.startsWith('패시브 ')) {
        const levels = playerState.passiveLevels || {};
        const learned = (playerState.passiveSkills || []).filter(id => !isResistPassive(id) && !isRegenPassive(id)).map(id => getPassiveById(id)).filter(Boolean);
        const learnedResist = PASSIVE_LIST.filter(p => isResistPassive(p.id) && (levels[p.id] ?? 0) > 0).map(p => ({ p, lv: levels[p.id] ?? 0 }));
        const learnedRegen = PASSIVE_LIST.filter(p => isRegenPassive(p.id) && ((levels[p.id] ?? 0) >= 1 || (playerState.passiveSkills || []).includes(p.id))).map(p => ({ p, lv: levels[p.id] ?? 1 }));
        const available = PASSIVE_LIST.filter(p => {
          if (isResistPassive(p.id)) return (levels[p.id] ?? 0) < MAX_RESIST_LEVEL;
          if (isRegenPassive(p.id)) return (levels[p.id] ?? (playerState.passiveSkills || []).includes(p.id) ? 1 : 0) < REGEN_MAX_LEVEL;
          return !(playerState.passiveSkills || []).includes(p.id);
        });
        if (input.trim() === '패시브') {
          let msg = '[패시브 스킬]\n';
          if (learned.length === 0 && learnedResist.length === 0 && learnedRegen.length === 0) msg += '습득한 패시브가 없습니다.\n';
          else {
            learned.forEach(p => msg += `- ${p!.name}: ${p!.effectSummary}\n  └ ${p!.description}\n`);
            learnedResist.forEach(({ p, lv }) => msg += `- ${p.name} Lv.${lv} (${lv * 5}% 감소)\n  └ ${p.description}\n`);
            learnedRegen.forEach(({ p, lv }) => msg += `- ${p.name} Lv.${lv} (칸당 +${REGEN_PER_LEVEL * lv} 회복)\n  └ ${p.description}\n`);
          }
          if (available.length > 0) {
            msg += '\n[구매 가능] 마스터 진에게 "거래" 후 "구매 [패시브 이름]"으로 구매.\n';
            available.forEach(p => {
              if (isResistPassive(p.id)) {
                const lv = levels[p.id] ?? 0;
                msg += `- ${p.name} (${scaleCoinCost(p.price)} C) — 현재 Lv.${lv}, 구매 시 Lv.${lv + 1}${lv + 1 >= MAX_RESIST_LEVEL ? ' (최대)' : ''}: ${p.description}\n`;
              } else if (isRegenPassive(p.id)) {
                const lv = levels[p.id] ?? (playerState.passiveSkills || []).includes(p.id) ? 1 : 0;
                const nextPrice = scaleCoinCost(getRegenUpgradePrice(lv));
                msg += `- ${p.name} (${nextPrice} C) — 현재 Lv.${lv}, 구매 시 Lv.${lv + 1} (칸당 +${REGEN_PER_LEVEL * (lv + 1)})${lv + 1 >= REGEN_MAX_LEVEL ? ' (최대)' : ''}\n`;
              } else msg += `- ${p.name} (${scaleCoinCost(p.price)} C): ${p.description}\n`;
            });
          } else msg += '\n[구매 가능] 더 이상 구매할 패시브가 없습니다.';
          response = msg;
        } else {
          const name = input.replace('패시브', '').trim();
          const passive = PASSIVE_LIST.find(p => p.name === name);
          if (!passive) {
            response = `[${name}] 패시브를 찾을 수 없습니다. '패시브' 로 목록 확인.`;
          } else if (isResistPassive(passive.id)) {
            const lv = levels[passive.id] ?? 0;
            if (lv >= MAX_RESIST_LEVEL) response = `[${passive.name}]은(는) 이미 최대 레벨(Lv.${MAX_RESIST_LEVEL})입니다.`;
            else response = `[${passive.name}] — ${passive.description}\n현재 Lv.${lv}. 구매 시 Lv.${lv + 1} (${(lv + 1) * 5}% 감소). 마스터 진에게 '구매 ${passive.name}' (${scaleCoinCost(passive.price)} C)`;
          } else if (isRegenPassive(passive.id)) {
            const lv = levels[passive.id] ?? (playerState.passiveSkills || []).includes(passive.id) ? 1 : 0;
            if (lv >= REGEN_MAX_LEVEL) response = `[${passive.name}]은(는) 이미 최대 레벨(Lv.${REGEN_MAX_LEVEL})입니다. (칸당 +${REGEN_PER_LEVEL * REGEN_MAX_LEVEL} 회복)`;
            else response = `[${passive.name}] — ${passive.description}\n현재 Lv.${lv} (칸당 +${REGEN_PER_LEVEL * lv}). 구매 시 Lv.${lv + 1} (칸당 +${REGEN_PER_LEVEL * (lv + 1)}). 마스터 진에게 '구매 ${passive.name}' (${scaleCoinCost(getRegenUpgradePrice(lv))} C)`;
          } else if ((playerState.passiveSkills || []).includes(passive.id)) {
            response = `이미 [${passive.name}]을(를) 보유 중입니다.`;
          } else {
            response = `[${passive.name}] — ${passive.description}\n구매하려면 마스터 진과 대화 후 '거래 마스터 진' → '구매 ${passive.name}' (${scaleCoinCost(passive.price)} C)`;
          }
        }
      } else if (input.startsWith('강화 ') || input === '강화') {
        // WHY: 재료 이름은 명령에 넣지 않고 인벤에서 자동 소모됨. 쉼표로 여러 개를 적으면 전체가 하나의 이름으로 오인됨 → 첫 번째만 대상으로 인식.
        const rawAfterGanghwa =
          input === '강화' ? '' : input.replace(/^강화\s*/, '').trim();
        const commaParts = rawAfterGanghwa
          .split(/[,，]/)
          .map(s => s.trim())
          .filter(Boolean);
        const itemName =
          input === '강화'
            ? (() => {
                const slot = playerState.weapon || playerState.armor || playerState.offHand;
                return slot ? resolveSlotToItemName(slot, playerState.inventory) : '';
              })()
            : commaParts[0] ?? '';
        const extraMaterialHint =
          commaParts.length > 1
            ? '\n\n💡 재료 아이템은 명령에 적지 않습니다. 인벤에 필요한 등급·종류(무기/갑옷/방패) 재료 2개가 있으면 자동 소모됩니다. (강화 대상 이름만: 예) 강화 초보자용 도검)'
            : '';
        if (!itemName) {
          response = '강화할 장비를 지정하세요. 예: 강화 초보자용 도검 (또는 장착 중인 무기/방어구는 "강화"만 입력)';
        } else {
          const inInv = inventoryHasItemName(playerState.inventory, itemName);
          const equippedSlots = [
            playerState.weapon,
            playerState.offHand,
            playerState.armor,
            playerState.ring1,
            playerState.ring2,
            playerState.necklace,
          ];
          const equipped = equippedSlots.some(
            (s) => s && resolveSlotToItemName(s, playerState.inventory) === itemName
          );
          const targetInstanceId =
            findInstanceIdForItemName(playerState.inventory, itemName, equippedSlots) || itemName;
          if (!inInv && !equipped) {
            response =
              `[${itemName}]을(를) 보유하거나 장착하고 있지 않습니다.` + extraMaterialHint;
          } else {
            const rowForEnchant =
              playerState.inventory.find((r) => r.id === targetInstanceId) ??
              playerState.inventory.find((r) => r.name === itemName);
            if (rowForEnchant?.identified === false) {
              response =
                `미확인 장비는 감정 후 강화할 수 있습니다. (예: 감정 ${rowForEnchant.name})` + extraMaterialHint;
            } else {
            const item = getItemByName(itemName);
            if (!item || (item.type !== 'weapon' && item.type !== 'armor' && item.type !== 'shield')) {
              response = '무기/방어구(갑옷, 방패)만 강화할 수 있습니다.' + extraMaterialHint;
            } else {
              const { tier, plus } = resolveEquipmentEnchant(
                targetInstanceId,
                item,
                playerState.equipmentEffectiveGrade,
                playerState.equipmentUpgradeLevels
              );
              const baseDefGrade = (item.grade ?? 'common') as ItemGrade;
              const promoteTier = getNextTier(tier);
              if (plus >= EQUIPMENT_PLUS_MAX && promoteTier == null) {
                response =
                  `✨ [${itemName}]은(는) 이미 최종 효과 티어(${ITEM_GRADE_LABEL[tier]}) 최대 강화(+${EQUIPMENT_PLUS_MAX})입니다.` +
                  extraMaterialHint;
              } else {
                const materialIntrinsicGrade = getMaterialGradeForEnchantTarget(tier);
                const kindLabel =
                  item.type === 'weapon' ? '무기' : item.type === 'armor' ? '방어구(갑옷)' : '방패';

                const materialTypes: Array<'weapon' | 'armor' | 'shield'> =
                  item.type === 'weapon'
                    ? ['weapon']
                    : item.type === 'armor'
                      ? ['armor']
                      : ['shield'];

                const inv = playerState.inventory;
                const removeIndices: number[] = [];
                let skippedTargetCopy = false;
                for (let i = 0; i < inv.length; i++) {
                  if (removeIndices.length >= MATERIAL_COUNT_PER_ENCHANT) break;
                  const row = inv[i];
                  const candName = invName(row);
                  if (inInv && !skippedTargetCopy && row.id === targetInstanceId) {
                    skippedTargetCopy = true;
                    continue;
                  }
                  const cand = getItemByName(candName);
                  if (!cand) continue;
                  if (!materialTypes.includes(cand.type as any)) continue;
                  const candBaseGrade = (cand.grade ?? 'common') as ItemGrade;
                  if (candBaseGrade !== materialIntrinsicGrade) continue;
                  removeIndices.push(i);
                }

                if (removeIndices.length < MATERIAL_COUNT_PER_ENCHANT) {
                  const matLabel = ITEM_GRADE_LABEL[materialIntrinsicGrade] ?? String(materialIntrinsicGrade);
                  const effLabel = ITEM_GRADE_LABEL[tier] ?? String(tier);
                  const ntHint = getNextTier(tier);
                  const nextStep =
                    plus < EQUIPMENT_PLUS_MAX
                      ? `같은 티어 +${plus + 1}`
                      : ntHint != null
                        ? `다음 티어 ${ITEM_GRADE_LABEL[ntHint]} +0`
                        : `더 이상 승급 없음`;
                  const matRuleLine =
                    `- 현재 효과 티어: ${effLabel}, +${plus}\n` +
                    `- 재료: ${matLabel} 등급 ${kindLabel} ${MATERIAL_COUNT_PER_ENCHANT}개\n` +
                    `- 성공 시: ${nextStep}`;
                  response =
                    `재료 부족! [${itemName}] 강화를 하려면\n` +
                    `${matRuleLine}\n` +
                    `\n현재: 조건에 맞는 재료를 ${MATERIAL_COUNT_PER_ENCHANT}개 찾지 못했습니다. (인벤토리를 확인하세요.)` +
                    extraMaterialHint;
                } else {
                  const cost = scaleCoinCost(200 * (plus + 1));
                  if ((playerState.credit || 0) < cost) {
                    response =
                      `강화 비용이 부족합니다. (필요: ${cost} C, 보유: ${playerState.credit || 0} C)` + extraMaterialHint;
                  } else {
                    const removeSet = new Set(removeIndices);
                    setPlayerState(p => {
                      const nextEff = { ...(p.equipmentEffectiveGrade || {}) };
                      const nextUp = { ...(p.equipmentUpgradeLevels || {}) };
                      const tid = targetInstanceId;
                      if (plus < EQUIPMENT_PLUS_MAX) {
                        nextUp[tid] = plus + 1;
                      } else {
                        const nextTier = getNextTier(tier);
                        if (!nextTier) return p;
                        nextUp[tid] = 0;
                        if (nextTier !== baseDefGrade) nextEff[tid] = nextTier;
                        else delete nextEff[tid];
                      }
                      return {
                        ...p,
                        credit: (p.credit || 0) - cost,
                        inventory: p.inventory.filter((_, idx) => !removeSet.has(idx)),
                        equipmentUpgradeLevels: nextUp,
                        equipmentEffectiveGrade: nextEff,
                      };
                    });
                    let resultLine = '';
                    if (plus < EQUIPMENT_PLUS_MAX) {
                      const ng = ITEM_GRADE_LABEL[tier];
                      resultLine = `✨ [${itemName}] 강화 +${plus + 1} 완료! (효과 티어 ${ng}, -${cost} C)`;
                    } else {
                      const nt = getNextTier(tier)!;
                      resultLine = `✨ [${itemName}] 티어 승급! ${ITEM_GRADE_LABEL[tier]} +${plus} → ${ITEM_GRADE_LABEL[nt]} +0 (${ITEM_GRADE_LABEL[materialIntrinsicGrade]} ${kindLabel} ${MATERIAL_COUNT_PER_ENCHANT}개, -${cost} C)`;
                    }
                    response =
                      `${resultLine}\n▶ '인벤' 또는 '장비 확인'으로 상태를 확인하세요.` + extraMaterialHint;
                  }
                }
              }
            }
            }
          }
        }
      } else if (input.startsWith('스킬강화 ') || input === '스킬강화') {
        const skillName = input.replace('스킬강화', '').trim();
        if (!skillName) {
          response = '강화할 스킬 이름을 입력하세요. 예: 스킬강화 매직 미사일';
        } else if (skillName === 'HP 회복' || skillName === 'MP 회복') {
          // HP/MP 회복은 실제로는 '패시브'이지만, UX를 위해 스킬강화에서도 인지하도록 처리
          const passiveId = skillName === 'HP 회복' ? 'hp_regen' : 'mp_regen';
          const levels = playerState.passiveLevels || {};
          const baseOwned = (playerState.passiveSkills || []).includes(passiveId);
          const currentLevel = levels[passiveId] ?? (baseOwned ? 1 : 0);
          if (!baseOwned && currentLevel === 0) {
            response = `[${skillName}]은(는) 패시브입니다. 먼저 마스터 진에게 '구매 ${skillName}'로 습득해야 강화할 수 있습니다.`;
          } else if (currentLevel >= REGEN_MAX_LEVEL) {
            response = `[${skillName}]은(는) 이미 최대 레벨(Lv.${REGEN_MAX_LEVEL})입니다. (칸당 +${REGEN_PER_LEVEL * REGEN_MAX_LEVEL} 회복)`;
          } else {
            const cost = scaleCoinCost(getRegenUpgradePrice(currentLevel));
            if ((playerState.credit || 0) < cost) {
              response = `패시브 강화 비용이 부족합니다. (필요: ${cost} C, 보유: ${playerState.credit || 0} C)`;
            } else {
              setPlayerState(p => ({
                ...p,
                credit: (p.credit || 0) - cost,
                passiveLevels: { ...(p.passiveLevels || {}), [passiveId]: currentLevel + 1 },
                passiveSkills: baseOwned ? (p.passiveSkills || []) : ([...(p.passiveSkills || []), passiveId]),
              }));
              response = `✨ [${skillName}] 패시브 Lv.${currentLevel + 1} 강화 완료! (-${cost} C)\n(전투/비전투마다 회복량이 증가합니다.)`;
            }
          }
        } else if (!playerState.skills.includes(skillName)) {
          response = `[${skillName}] 스킬을 습득하지 않았습니다.`;
        } else {
          const currentLevel = (playerState.skillLevels || {})[skillName] || 1;
          // 천벌·홀리 스마이트는 Lv.3이 최대
          if (skillName === '천벌' && currentLevel >= 3) {
            response = '[천벌]은(는) Lv.3이 최대입니다. 더 이상 강화할 수 없습니다.';
          } else if (skillName === '홀리 스마이트' && currentLevel >= 3) {
            response = '[홀리 스마이트]는(은) Lv.3이 최대입니다. 더 이상 강화할 수 없습니다.';
          } else {
          // WHY: 스킬 강화는 상위 컨텐츠이므로, 레벨당 3000 C로 고비용 설정 (Lv.1→2=3000, Lv.2→3=6000 ...)
          const cost = scaleCoinCost(3000 * currentLevel);
          if ((playerState.credit || 0) < cost) {
            response = `스킬 강화 비용이 부족합니다. (필요: ${cost} C, 보유: ${playerState.credit || 0} C)`;
          } else {
            setPlayerState(p => ({
              ...p,
              credit: (p.credit || 0) - cost,
              skillLevels: { ...(p.skillLevels || {}), [skillName]: currentLevel + 1 },
            }));
            response = `✨ [${skillName}] 스킬 Lv.${currentLevel + 1} 강화 완료! (-${cost} C)\n(스킬 위력이 소폭 상승합니다.)`;
          }
          }
        }
      } else if (['스토리', '목표', '세계관'].includes(input)) {
        const bosses = playerState.story.defeatedBosses || [];
        const hasKey = inventoryHasItemName(playerState.inventory, 'A구역 보안 키');
        const mainQuest = Object.values(QUESTS).find(q => q.targetId === 'A구역 보안 키');
        const mainProgress = mainQuest && playerState.quests.completed?.includes(mainQuest.id);
        let progressBlock = '\n■ [현재 진행]\n';
        progressBlock += `- 격파한 관문 보스: ${bosses.length > 0 ? bosses.join(', ') : '없음'}\n`;
        progressBlock += mainProgress
          ? '- 메인 퀘스트(강제 돌파): 완료. A구역 보안 키를 획득했다.\n'
          : hasKey
            ? '- A구역 보안 키를 보유 중이다. 아르카디아 심장부로 나아가라.\n'
            : '- 메인 퀘스트: 네온 팻에게서 "강제 돌파"를 수락해 사이버 데몬을 쓰러뜨리고 키를 탈취하라.\n';
        if (playerState.title) progressBlock += `- 칭호: ${playerState.title}\n`;
        response = `━━━━━━━━━━ [ 스토리 · 목표 ] ━━━━━━━━━━\n\n${WORLDVIEW_DETAIL}\n\n▶ [최종 목표]\n${MAIN_GOAL_TEXT}${progressBlock}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      } else if (['설정', '게임설정', '백과', '설정집'].includes(input)) {
        // WHY: 타인·검증자용 명세 요약(컨셉·수식·코드 맵) — 플레이어용 [도움말]과 역할 분리
        response = getGameSettingsManualText();
      } else if (input.startsWith('스탯투자')) {
        const statName = input.replace('스탯투자', '').trim();
        if ((playerState.statPoints || 0) <= 0) {
          response = '잔여 스탯 포인트가 없습니다.';
        } else if (['힘', '민첩', '체력', '지능', '정신'].includes(statName)) {
          setPlayerState(p => {
            const next = { ...p, statPoints: p.statPoints - 1 };
            if (statName === '힘') { next.str += 1; next.atk += 1; next.def += 1; }
            if (statName === '민첩') { next.dex += 1; }
            if (statName === '체력') { next.con += 1; next.def += 2; }
            if (statName === '지능') { next.int += 1; }
            if (statName === '정신') { next.spr += 1; }
            const { maxHp, maxMp } = getEffectiveMaxHpMp(next);
            next.maxHp = maxHp;
            next.maxMp = maxMp;
            if (statName === '체력') next.hp = Math.min(next.hp + 10, maxHp);
            if (statName === '정신') next.mp = Math.min(next.mp + 10, maxMp);
            return next;
          });
          response = `✨ [${statName}] 스탯이 상승했습니다! (잔여 포인트: ${(playerState.statPoints || 0) - 1})`;
        } else {
          response = '어떤 스탯에 투자할지 입력하세요. (예: 스탯투자 힘 / 민첩 / 체력 / 지능 / 정신)';
        }
      } else if (['스킬창','스킬목록','마법'].includes(input)) {
        // WHY: 스킬창에서 모든 보유 스킬에 대해 설명을 표시해, "설명 없음"이 나오지 않도록 함.
        // 스킬 설명은 `data/skillTooltips.ts`와 스킬바 호버가 공유
        const passiveLearned = (playerState.passiveSkills || [])
          .map(id => getPassiveById(id))
          .filter((p): p is NonNullable<typeof p> => p != null);
        const passiveLevels = playerState.passiveLevels || {};
        const resistLearned = PASSIVE_LIST.filter(p => isResistPassive(p.id) && (passiveLevels[p.id] ?? 0) > 0)
          .map(p => ({ p, lv: passiveLevels[p.id] ?? 0 }));

        const lines = [
          '═══ 스킬 목록 ═══',
          `현재 MP: ${playerState.mp}/${playerState.maxMp}`,
          '※ 스킬 MP는 월드 배율 1.5배 적용됨 — 아래 문구의 숫자와 실제 소모가 다를 수 있음',
          '',
          ...playerState.skills.map(s => {
            const desc = SKILL_TOOLTIPS[s] ?? '설명 없음';
            return `⚡ ${s}\n   └ ${desc}`;
          }),
          '',
          '— 패시브 —',
          ...(passiveLearned.length === 0 && resistLearned.length === 0
            ? ['습득한 패시브가 없습니다.']
            : [
                ...passiveLearned.map(p => `🛡 ${p.name}\n   └ ${p.description}`),
                ...resistLearned.map(({ p, lv }) => `🛡 ${p.name} Lv.${lv} (${lv * 5}% 감소)\n   └ ${p.description}`),
              ]),
          '',
          "※ 액티브 스킬만 '스킬 [이름]' 으로 발동",
          '※ HP/MP 회복 패시브는 전투 한 라운드 끝·비전투에서 행동 1회마다 자동 회복(레벨×3)',
          "'패시브' 로 구매 가능 패시브·상세 확인",
        ];
        response = lines.join('\n');
      } else if (['/?','도움말','헬프'].includes(input)) {
        response = `=== 명령어 목록 ===
[설정] / [게임설정] / [백과] — 외부 공유용 요약(컨셉·전투·경제 수식·소스 맵, 코드가 최종 기준)
[스토리] / [목표] / [세계관] - 게임 스토리, 최종 목표, 현재 진행 상황 확인
[이동 북/남/동/서] - 해당 방향으로 이동
[위치] - 현재 위치 확인 및 로그의 직감 발동 (로그 직업)
[미니맵] - 우측 패널 주변 미니맵 On/Off (반경 제한)
[구역지도] - 현재 구역 전체 방 맵 오버레이 (헤더 「구역」·입력창 비포커스 시 M)
[직업] - 직업별 특징 및 플레이 스타일 설명
[상태] - 캐릭터 상태 및 스탯 확인 (플레이어 최대 레벨: Lv.${PLAYER_MAX_LEVEL})
[스탯 <스탯명>] - 해당 스탯의 기능 설명 (예: 스탯 민첩 / 스탯 힘 / 스탯 체력 / 스탯 지능 / 스탯 정신)
[인벤토리] - 보유 중인 아이템 확인 (최대 ${INVENTORY_MAX_SLOTS}칸 — 가득 차면 추가 획득 불가)
[버리기 <아이템명>] - 아이템 1개: 상인 없이 인벤에서 제거 (크레딧 없음 · 장착 중만 남았으면 해제 후)
[버리기 노멀] 등 (커먼/매직 · 노말=노멀) - [판매 ○○]과 동일하게 아이언 잭 거래 중일 때만, 물약·스킬북·잡동사니·장착분 제외한 해당 티어 장비만 일괄 판매 (레어·에픽은 일괄 불가)
[장비 확인] - 장착 중인 무기/방어구/장신구의 옵션 및 스탯 보너스 확인
[감정] / [감정 <미확인 장비 전체 이름>] - 물음표(?) 미확인 장비의 실명·부가 옵션(각인) 공개
  · 예: 인벤에 보이는 그대로 — 감정 미확인 무기·abc12 / 이름만으로 여러 개 겹치면 더 길게 입력
  · [${APPRAISAL_SCROLL_ITEM_NAME}] 1매 보유 시, 어디서든 해당 명령으로 1회 감정(스크롤 소모)
  · 스크롤 없음: 아이언 잭이 서비스하는 구역(슬럼 상점가·컨베이어·하수 미로·심층 미로 등)에서 잭과 거래·대화 연출 후 ${IRON_JACK_APPRAISAL_COST_COINS} C 유료 감정
  · 미확인 상태에서는 [강화] 불가 — 감정 후 강화 가능 · 합산 스탯은 [장비 확인]·전투에 즉시 반영
  · [감정]만 치면 명령 형식·조건 요약이 다시 출력됨
[내구도] - 착용 중인 장비 내구도 확인 (0이면 파손)
[수리] / [수리 무기/방어구/방패/장신구/전체] - 안전지대에서 장비 내구도 복구 (COIN 소모)
[성벽] / [마을 방어] - 성벽·구역 거점 요약
[성벽 수리] - 성벽 관문 방에서 성벽 HP 회복 (COIN)
[마을 수복] - 함락된 마을을 관문·마을 방에서 탈환 (고비용 COIN)
[스킬창] - 보유 중인 스킬 목록 및 MP 소모량 확인
[장착 <아이템명>] - 무기/방패/갑옷/반지/목걸이 장착 (반지는 최대 2개, 목걸이는 1개)
[해제 <아이템명>] / [장비 해제 <아이템명>] - 착용 중인 장비 해제 (예: 해제 강철 장검)
[사용 <포션명>] - 포션 사용 (빨간 포션: HP 회복 / 작은·일반·대형 파란 포션: MP 20/40/80 회복)
[휴식] - 위치한 곳이 안전지대일 경우 HP/MP 회복·세이브 포인트 갱신 (비석·축복 등 임시 버프 해제, 전사는 RAGE도 초기화)
[조사] - 방을 수색. 가끔 고대 비석(힘·민·체·지·정 / 공격·방어 / 최대HP·즉시 HP·즉시 MP 등) 또는 아이템 발견
[코드 숫자] - 잠금 패널이 있는 방(예: 심층 미로 차단 철문)에서 정답 입력 시 통로 해제
[스탯투자 <스탯명>] - 레벨업 스탯 포인트 투자 (힘/민첩/체력/지능/정신)
[패시브] - 습득한 패시브 스킬 목록 및 마스터 진 구매 안내
[강화 <장비명>] / [강화] - 무기·갑옷·방패 강화 (장착 중이면 이름 생략 가능)
  · 비용: (현재 +값 + 1) × 200 COIN에 월드 배율 1.5배 (예: +0→약 300, +5→약 1800)
  · 재료: 인벤에 맞는 등급·종류 아이템 2개가 있으면 자동 소모 (명령에 재료 이름을 적지 않음)
  · 효과 티어별 필요 재료 등급: 커먼→커먼2 / 노멀→커먼2 / 매직→노멀2 / 레어→매직2 / 에픽→에픽2
  · 같은 티어에서 +0~+5까지 올린 뒤, 다음 강화 시 다음 티어 +0으로 승급 (에픽은 승급 없이 +5까지)
[스킬강화 <스킬명>] - 스킬 레벨 강화 (COIN 소모, 스킬 위력 상승)
[대화 <NPC이름>] - 주변에 있는 NPC와 대화 (예: 대화 마스터 진)
[거래 <NPC이름>] - 상인/스승과 거래 또는 스킬/아이템 상점 열기 (예: 거래 마스터 진, 홀로 거래소의 거래 베일 크립트)
[판매 잡동사니] - 아이언 잭과 거래 중일 때, 잡동사니 일괄 판매
[판매 무기] / [판매 갑옷] / [판매 반지] / [판매 목걸이] / [판매 물약] / [판매 스킬북] — 동일 조건에서 인벤의 해당 카테고리만 일괄 판매 (장착 중인 칸은 제외 · 레어·에픽은 제외)
[판매 커먼] / [판매 노멀] / [판매 매직] — 무기·갑옷·방패·반지·목걸이를 카테고리 구분 없이 해당 등급(강화 승급 후 현재 티어)만 일괄 판매 (장착 제외 · 노말=노멀 · 레어·에픽은 개별 판매만)
※ 홀로 거래소 [베일 크립트]: 미확인 장비만 파는 도박성 상인 — '거래 베일 크립트' 후 '구매 [상품명]' (실명·옵션은 구매 뒤 감정)

[전투 명령어]
[공격] / [공격 2] - 무기로 기본 공격 (숫자로 대상 지정: 공격 2 = 2번째 몬스터, 미지정 시 1번째)
[shoot 북/남/동/서 <대상>] / [사격 …] - 통로 따라 1~2칸(고지 방에선 +1칸) 인접 방 적 원거리 저격 (무방비 보너스, 활/석궁)
[저격 북/남/동/서] - (로그 전용) 같은 사거리로 가장 가까운 적 자동 저격
[경계] - (비전투·활/석궁) Overwatch: 적이 방에 들어오는 순간 선제 사격(고지·고각 연출)
※ [고저] 일부 방은 elevation이 높아 원거리 사거리 +1, 적 근접(비마법)은 명중·피해 적용이 불리 — [위치]에서 확인
[스킬 <스킬명>] - 스킬 사용
[태세 공격] / [태세 공방] / [태세 방어] - 전투 여부와 관계없이 즉시 전환, 턴 소모 없음 (공격: ATK↑·DEF↓·자동방어확률↓ / 공방: 기본 / 방어: ATK↓·DEF↑·자동방어확률↑). ※ [방어] 가드 명령과 다름
[방어]/[가드] - 턴 소모, 받는 피해 감소 (무료·중간 효과) | 강화: [대응 가드] MP 5
[회피]/[도지] - 턴 소모, 완전 회피 확률 상승 (무료) | 강화: [대응 회피] MP 5
[패링]/[쳐내기] - 패링 스킬 필요, 턴 소모·반격 시도 (무료·중간) | 강화: [대응 패링] MP 5
[대응 가드/회피/패링] - MP 5, 다음 적 공격에 강한 대비 (강공 예고 턴 대응에 유리)
※ 공격/스킬 턴에는 직업·스탯에 따라 방어·회피·패링이 자동으로 추가 굴림될 수 있음
※ 보스: 연속으로 공격 위주 턴만 쓰면 「강공격 예고」가 나올 확률이 조금씩 올라감 — 방어·회피·패링·반격 태세·회복 전용 턴은 스택이 오르지 않거나 리셋됨
※ 준보스(엘리트): 전투 개시 시 확률적으로 안내 로그가 먼저 뜬 뒤 잠시 후 화면 중앙 「엘리트 리듬 QTE」 오픈 — 그 다음 WASD 순서 확인·박자 입력. 끝나면 짧은 결과 안내 후 자동 종료·전투 이어짐 (지연·QTE 중 텍스트 명령 잠시 대기)`;
      } else if (input === '테스트 룬' || input === '테스트룬') {
        // WHY: 개발·QA용 — [추적자]·품질·다른 룬 패시브를 빠르게 확인 (배포 빌드에서는 제거 권장)
        const testPairs: Array<{ id: RuneId; q: number }> = [
          { id: 'tracker', q: clampRuneQuality(1.18) },
          { id: 'sage', q: clampRuneQuality(0.92) },
        ];
        let inv = [...playerState.inventory];
        const extraLogs: string[] = [];
        const feedback: string[] = [];
        for (const { id, q } of testPairs) {
          const name = getRuneInventoryItemName(id);
          const res = addItemToInventory(inv, name, extraLogs, { runeQuality: q });
          inv = res.inventory;
          feedback.push(`· [${name}] 품질×${q.toFixed(2)}`);
        }
        setPlayerState((p) => ({ ...p, inventory: inv }));
        response = [
          '🧪 [테스트 전용] 인벤에 룬 샘플 2개를 지급했습니다. (운영 서비스에서는 명령 제거 권장)',
          ...extraLogs,
          ...feedback,
          'Lv.21 이상: 「룬 장착 추적자」「룬2 장착 현자」 등으로 장착해 보세요.',
        ].join('\n');
        triggerEnemyTurn(activeEnemies, undefined, 'neutral');
      } else if (['직업','직업설명','직업 도움말'].includes(input)) {
        response =
`=== 직업 설명 ===

[마법사]
- 역할: 원거리 딜러 (폭딜/광역)
- 특징: 지팡이 + 천 옷, 마법 공격은 방어를 거의 무시하며 적의 방어 타입에 상관없이 안정적으로 높은 피해를 줍니다.
- 장점: 높은 MP와 강력한 마법 스킬, 속성 공격으로 상태 이상(화상/중독 등) 유발에 특화.
- 단점: HP와 방어력이 낮아 맞으면 크게 위험합니다. 위치 선택과 선제 공격이 중요합니다.

[성직자]
- 역할: 서포터/탱커 (힐 + 버티기)
- 특징: 둔기 + 사슬 갑옷, 회복 스킬과 방어적인 세팅에 특화되어 파티의 생존력을 책임지는 타입입니다.
- 장점: 강력한 힐과 보호 스킬, 크러시 속성으로 판금/사슬 적에게 추가 피해를 줄 수 있습니다.
- 단점: 순수 화력은 다른 직업보다 낮은 편이라, 오래 버티면서 싸우는 스타일에 가깝습니다.

[전사]
- 역할: 근접 딜탱 (앞라인)
- 특징: 도검/양손검 + 판금 갑옷, 분노(RAGE) 시스템 — 적에게 맞아 HP가 실제로 줄어들 때마다 상승합니다(MP만 깎이는 경우는 제외).
- 장점: 높은 HP/방어력, 분노가 쌓이면 공격력 보너스와 피해 감소 효과를 얻어 장기전에 강합니다. [일격필살]로 쌓인 분노를 한꺼번에 쏟아 붓거나, [가시 갑옷]으로 근접 빌드를 역이용할 수 있습니다. 양손검 마스터리 Lv.10 달성 시 양손검 + 방패 조합도 가능합니다.
- 단점: 이동/포지셔닝을 잘못하면 마법사처럼 재빠른 적에게 농락당할 수 있습니다.

[도적]
- 역할: 근접 암살자 (쌍단검)
- 특징: 단검 + 가죽 갑옷, 높은 민첩으로 치명타/회피에 강하며, 단검 두 자루(쌍단검)를 사용할 수 있습니다.
- 장점: 단일 대상에게 높은 폭딜, 회피와 민첩 기반으로 피하면서 때리는 플레이가 가능합니다.
- 단점: 방어력과 HP가 낮아 실수 한 번에 크게 맞을 수 있으므로, 리듬을 타는 플레이가 중요합니다.

[로그]
- 역할: 원거리 정찰/저격수
- 특징: 활 + 가죽 갑옷, 원거리 공격과 직감(위치 명령 시 추가 정보)으로 전장을 읽는 능력이 뛰어납니다.
- 장점: 적과 거리를 벌린 채 안전하게 공격 가능, 민첩과 체력을 함께 가져 안정적인 원거리 딜러 역할 수행.
- 단점: 근접전에 끌려들어가면 방어가 부족해 쉽게 흔들릴 수 있습니다.
- 전용 명령:
  · [저격 북/남/동/서] — 통로 따라 사거리 내(지면 2칸·고지 +1) 가장 가까운 적 자동 표적
  · [경계] — Overwatch: 3턴, 적이 이 방으로 들어오는 순간 선제 사격(화려한 로그)
  · [정찰 방향] — 다음 방 적 미리보기·함정 설치 (예: 정찰 북)
  · [shoot/사격 방향 대상] — 원거리 수동 사격 (예: shoot 북 A, 사격 동 B)
`;

      } else if (['구역지도', '월드맵', '전체지도'].includes(input)) {
        setShowZoneMap((prev) => !prev);
        response =
          '[시스템] 전체 구역 지도 창을 전환했습니다. (헤더 「구역」버튼 · 입력창 밖에서 M · ESC로 닫기) 우측 미니맵은 주변만 표시합니다.';
      } else if (['미니맵','지도','맵'].includes(input)) {
        setShowMap(prev => !prev);
        response = `[시스템] 미니맵 표시를 ${!showMap ? '활성화' : '비활성화'}합니다. (우측 패널 주변 탐색용 · 같은 구역 전체는 「구역지도」/헤더 「구역」/입력창 밖 M)`;
      } else if (['위치','방향','나침반','현재방향'].includes(input)) {
        const room = getRoomById(currentRoomId);
        let rogueSense = '';
        const visibleExits = getVisibleExits(room);
        if (loggedInChar?.job === '로그') {
           const dangerousExits: string[] = [];
           Object.entries(visibleExits).forEach(([dir, nextId]) => {
              const nextR = getRoomById(nextId as string);
              if (nextR && !nextR.isSafe && (nextR.encounterChance || 0.25) > 0) dangerousExits.push(dir);
           });
           if (dangerousExits.length > 0) rogueSense = `\n🗡️ [로그의 직감] ${dangerousExits.join(', ')}쪽 방에서 불길한 기운이 느껴집니다...`;
        }
        const safeHint = room?.isSafe ? "\n\n🔥 이곳은 안전지대입니다. '휴식' 명령으로 HP/MP를 전부 회복할 수 있습니다." : '';
        const bossHint = room?.lockedByBoss ? "\n⚠️ 이 구역은 관문 보스가 지키는 보스룸입니다. 전투를 준비하세요." : '';
        const mazeHint =
          room?.id === 'maze_s6'
            ? "\n\n⚠️ 복도는 여기서 끝나지만, 남쪽 철문 사이 틈으로 더 위험한 구역이 살짝 보인다. 남쪽으로 나아가면 새로운 구역에 진입할 수 있을 것 같다."
            : room?.id === 'maze_seal_vestibule' &&
                !(playerState.solvedPuzzleIds ?? []).includes('neon_foundry_year')
              ? "\n\n🔐 [차단 철문] 동쪽 문은 잠겨 있다. 벽 패널에 `코드`와 네 자리 숫자를 입력해야 한다. (힌트: 바닥 광고 전단)"
              : '';
        // WHY: 미로·컨베이어 구역에서도 잭/진이 “지나가는 행인”으로 대화·거래 가능하도록 세계관 힌트 제공
        const wanderShopNpcHint =
          room && isIronJackServiceRoom(room.id) && room.id !== IRON_JACK_SERVICE_ROOM_ID
            ? '\n\n👤 [이 구역] 통로를 아이언 잭이 짐·망치를 들고 오가고, 마스터 진도 호흡을 고르러 드물게 머무는 듯하다. (`대화 아이언 잭` / `거래 아이언 잭`, `대화 마스터 진` / `거래 마스터 진`)'
            : '';
        const holoBlindMerchantHint =
          room?.id === GAMBLING_MERCHANT_ROOM_ID
            ? '\n\n🎰 [홀로 부스] 번쩍이는 장막 뒤 [베일 크립트]가 블라인드 장비 뽑기를 권한다. (`대화 베일 크립트` / `거래 베일 크립트`)'
            : '';
        const karinaRustyAlleyHint =
          room?.id === 'rusty_alley'
            ? '\n\n🕷️ [녹슨 골목] 네온이 물웅덩이에 번지는 틈에 [카리나]가 서 있다. 손끝으로 시안빛 데이터 칩을 굴리며, 블랙 스파이더 냄새가 은은하게 난다. (`대화 카리나`)'
            : '';
        const elevN = getRoomElevation(currentRoomId);
        const elevHint =
          elevN >= 1
            ? `\n\n⛰️ [고저] 높은 지대(elevation ${elevN}) — 원거리 사거리 +1칸, 적 근접(비마법) 피격에 다소 유리합니다.`
            : '';
        let wallHint = '';
        const wDefLoc = getWallDefForVillageOrGate(currentRoomId);
        if (wDefLoc) {
          const hp = playerState.villageWallHp?.[wDefLoc.id] ?? wDefLoc.maxHp;
          const occ = playerState.villageOccupied?.[wDefLoc.villageRoomId];
          const vn = getRoomById(wDefLoc.villageRoomId)?.name ?? '';
          if (currentRoomId === wDefLoc.gateRoomId) {
            wallHint = `\n\n🧱 [성벽 관문] 보호 거점: [${vn}] — 성벽 HP ${hp}/${wDefLoc.maxHp}${occ ? ' (마을 함락)' : ''}\n· '성벽 수리'로 보수 · 마을 안에 플레이어가 있을 때 관문의 적이 성벽을 공성합니다.`;
          } else if (currentRoomId === wDefLoc.villageRoomId) {
            wallHint = `\n\n🧱 [마을 방어] 성벽 ${hp}/${wDefLoc.maxHp}${occ ? ' ⚠ 함락됨 — 휴식 불가. 관문·마을에서 \'마을 수복\'.' : ''}`;
          }
        }
        const bountyTrackHint =
          playerState.bountyNpc &&
          playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'tracker')
            ? `\n${formatBountyTrackerHint(currentRoomId, playerState.bountyNpc)}`
            : '';
        response = `📍 현재 위치: [${room?.name ?? currentRoomId}]\n${room?.description ?? ''}\n이동 가능한 출구: ${getExitsInDisplayOrder(visibleExits).join(', ') || '없음'}${rogueSense}${safeHint}${bossHint}${mazeHint}${wanderShopNpcHint}${holoBlindMerchantHint}${karinaRustyAlleyHint}${wallHint}${elevHint}${bountyTrackHint}`;
      } else if (input.startsWith('정찰 ')) {
        const dir = input.split(' ')[1] as '북'|'남'|'동'|'서';
        if (loggedInChar?.job !== '로그') {
          response = '정찰은 로그 직업만 사용할 수 있습니다.';
        } else {
          const room = getRoomById(currentRoomId);
          const visibleExits = getVisibleExits(room);
          if (!['북','남','동','서'].includes(dir)) {
            response = `'${dir}'은(는) 알 수 없는 방향입니다. [북, 남, 동, 서] 중 하나를 입력하세요.`;
          } else if (!visibleExits[dir]) {
            response = `[정찰 실패] [${dir}] 방향에는 연결된 통로가 없습니다.`;
          } else {
            const nextId = visibleExits[dir] as string;
            const nextRoom = getRoomById(nextId);
            if (!nextRoom || nextRoom.isSafe) {
              response = `🗡️ [정찰:${dir}] 이 방향에서는 위협적인 기척이 느껴지지 않습니다.`;
            } else {
              // 다음 방에서 예상되는 적들을 미리 시뮬레이션
              const enemyCount = Math.floor(Math.random() * 3) + 1;
              const previews = Array.from({ length: enemyCount }).map((_, i) => {
                const e = spawnRandomEnemy(playerState.level);
                return `${e.name}${enemyCount > 1 ? ' ' + String.fromCharCode(65 + i) : ''}`;
              });
              const names = previews.join(', ');
              const trapPre = roomTraps[nextId];
              const trackerScout = playerHasRune(
                playerState.equippedRuneId,
                playerState.equippedRuneSecondaryId,
                'tracker',
              );
              const netExtra = trackerScout
                ? `\n📡 [추적자 룬] 전술 망에 은닉 시그니처를 스캔했습니다 — 적대 위장·설치형 함정${trapPre ? '(이미 설치됨)' : ''}까지 포착 가능 구역입니다.`
                : '';
              // 로그는 다음 방 입구에 함정을 미리 설치 — 첫 적에게 선 피해/기절
              setRoomTraps(prev => ({
                ...prev,
                [nextId]: { type: 'wire', power: 1.0, stunTurns: 1 },
              }));
              setForcedAmbushRooms(prev => ({ ...prev, [nextId]: true }));
              response =
                `🗡️ [정찰:${dir}] 인접한 방에서 [${names}]의 기척을 감지했습니다.${netExtra}\n` +
                `🧨 [함정 설치] ${dir} 방향 출입구에 와이어 트랩을 미리 설치했습니다. 다음에 그 방으로 들어가면 먼저 함정이 발동합니다.`;
            }
          }
        }
      } else if (input === 'shoot' || input.startsWith('shoot ') || input === '사격' || input.startsWith('사격 ')) {
        if (playerState.isCombat && activeEnemies.length > 0) {
          response = '⚔️ 전투 중에는 원거리 사격으로 방 밖을 노릴 수 없습니다.';
        } else {
          const shootNorm =
            input === '사격' || input.startsWith('사격 ') ? `shoot${input.slice('사격'.length)}` : input;
          const parts = shootNorm.split(/\s+/).filter(Boolean);
          const dir = (parts[1] || '').trim() as '북'|'남'|'동'|'서';
          const targetRaw = parts.slice(2).join(' ').trim();
          const shootReach = getPlayerRangedReachTiles();
          if (!['북', '남', '동', '서'].includes(dir)) {
            response =
              "사용법: shoot [북/남/동/서] [대상] 또는 사격 [북/남/동/서] [대상]\n예: shoot 북 A / 사격 북 A";
          } else {
            const weapon = getMergedEquippedItem(playerState.weapon, playerState.inventory);
            const isRangedWeapon = weapon?.weaponClass === 'bow' || resolveSlotToItemName(playerState.weapon, playerState.inventory).includes('활') || resolveSlotToItemName(playerState.weapon, playerState.inventory).includes('석궁');
            if (!isRangedWeapon) {
              response = '원거리 사격은 활/석궁 계열 무기가 필요합니다.';
            } else if (isBroken(playerState.weapon || '')) {
              response = `💥 [${resolveSlotToItemName(playerState.weapon, playerState.inventory)}]이(가) 파손되어 사격할 수 없습니다. 안전지대에서 '수리 무기'를 사용하세요.`;
            } else {
              const rooms = getLineRooms(currentRoomId, dir, shootReach);
              if (rooms.length === 0) {
                response = `[${dir}] 방향으로는 사격할 수 있는 통로가 없습니다.`;
              } else {
                // 사격 시야: 지면 2칸·고지 +1칸 — 적 준비(없으면 스폰 시도)
                const candidates: Array<{ roomId: string; dist: number; enemy: ActiveEnemy }> = [];
                rooms.forEach((rid, idx) => {
                  const list = ensureRoomEnemies(rid);
                  list.forEach(e => candidates.push({ roomId: rid, dist: idx + 1, enemy: e }));
                });

                if (candidates.length === 0) {
                  response = `🔭 ${dir} 방향(최대 ${shootReach}칸)에서는 적의 기척이 느껴지지 않습니다.`;
                } else {
                  const pickByTarget = (): { roomId: string; dist: number; enemy: ActiveEnemy } | null => {
                    if (!targetRaw) return null;
                    // A/B/C 같은 알파벳, 혹은 숫자(전체 후보 기준)
                    const t = targetRaw.replace(/['"]/g, '').trim();
                    if (/^\d+$/.test(t)) {
                      const n = Number(t);
                      if (!Number.isFinite(n) || n < 1 || n > candidates.length) return null;
                      return candidates[n - 1];
                    }
                    if (/^[A-Z]$/i.test(t)) {
                      const up = t.toUpperCase();
                      const found = candidates.find(c => c.enemy.name.includes(` ${up}`) || c.enemy.name.endsWith(up));
                      if (found) return found;
                    }
                    const foundByName = candidates.find(c => c.enemy.name.includes(t) || t.includes(c.enemy.name));
                    return foundByName || null;
                  };

                  const target = pickByTarget();
                  if (!target) {
                    const byDist = (d: number) => candidates.filter(c => c.dist === d).map(c => `[${c.enemy.name}]`).join(', ');
                    const distLines = [
                      `- 1칸(${dir}): ${byDist(1) || '없음'}`,
                      `- 2칸(${dir}): ${byDist(2) || '없음'}`,
                      ...(shootReach >= 3 ? [`- 3칸(${dir}): ${byDist(3) || '없음'}`] : []),
                    ];
                    response =
                      `[사격 대상 지정 · 사거리 ${shootReach}칸]\n` +
                      `${distLines.join('\n')}\n\n` +
                      `사용법: shoot ${dir} [대상] 또는 사격 ${dir} [대상]\n` +
                      `- 대상은 이름 일부, 알파벳(A/B/C), 또는 번호(1~${candidates.length})로 지정합니다.`;
                  } else {
                    const { roomId: targetRoomId, dist, enemy } = target;
                    // 원격으로 해당 방의 적을 건드린 순간, 강제 기습 플래그를 소비한다.
                    // WHY: 나중에 이동했을 때 또 다른 적이 새로 스폰되어 "없다/있다"가 뒤섞이는 것을 방지.
                    setForcedAmbushRooms(prev => {
                      const next = { ...prev };
                      delete next[targetRoomId];
                      return next;
                    });
                    const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
                    const weaponAttr = getPlayerWeaponAttr();
                    const attrModifier = getDamageModifier(weaponAttr, enemy.armorAttr);
                    const wpPenalty = getWeaponPenalty();
                    const wNm = resolveInstanceIdForSlot(playerState.weapon, playerState.inventory) ?? playerState.weapon ?? '';
                    const wEnchant = weapon
                      ? resolveEquipmentEnchant(wNm, weapon, playerState.equipmentEffectiveGrade, playerState.equipmentUpgradeLevels)
                      : { tier: 'common' as ItemGrade, plus: 0 };
                    const wAtkBonus = getEnchantStatBonusFromTierPlus(wEnchant.tier, wEnchant.plus);

                    // 활/석궁 저격은 "한 발"로 큰 의미를 주되, 스킬보단 낮게
                    const minWeaponDmg = (weapon?.minDamage ?? 1) + wAtkBonus;
                    const maxWeaponDmg = (weapon?.maxDamage ?? 3) + wAtkBonus;
                    const roll = Math.floor(Math.random() * (Math.max(minWeaponDmg, maxWeaponDmg) - Math.min(minWeaponDmg, maxWeaponDmg) + 1)) + Math.min(minWeaponDmg, maxWeaponDmg);
                    const penetrationStat = weaponAttr === '피어싱' ? (effDex || effStr) : effStr;
                    const defFactor = (100 + penetrationStat) / (100 + enemy.def);
                    const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
                    const isCrit = Math.random() < critChance;
                    const critMult = isCrit ? 2.2 : 1.0;
                    const randMult = 0.92 + Math.random() * 0.16;
                    const basePart = (effAtk * randMult * critMult) + roll;

                    const isUnaware = !enemy.alerted;
                    const unawareMult = isUnaware ? 1.4 : 1.0;
                    const distMult = dist >= 3 ? 0.86 : dist === 2 ? 0.92 : 1.0;
                    const elevShootMult = getRoomElevation(currentRoomId) >= 1 ? 1.07 : 1.0;
                    let dmg = Math.max(
                      1,
                      Math.round(
                        basePart *
                          defFactor *
                          attrModifier *
                          wpPenalty *
                          0.42 *
                          optionFx.damageMult *
                          unawareMult *
                          distMult *
                          elevShootMult,
                      ),
                    );
                    const ghostSnipe2 =
                      (playerState.stealthTurnsLeft ?? 0) > 0 &&
                      hasRunePair(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'assassin', 'tracker');
                    if (ghostSnipe2) {
                      dmg = Math.max(1, Math.round(dmg * 5));
                    }
                    const rogueAlchPoison2 =
                      loggedInChar?.job === '로그' &&
                      playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'alchemist');

                    const hitPart = pickHitPart();
                    const critTag = isCrit ? ' \u001b[91mCRIT!\u001b[0m' : '';
                    const unawareTag = isUnaware ? ' 🎯 (무방비 저격)' : '';
                    const elevTag = elevShootMult > 1 ? ' ⛰️ (고각 사격)' : '';
                    const ghostTag2 = ghostSnipe2 ? ' 👻 (고스트 스나이퍼)' : '';

                    // 피해 적용
                    const newHp = enemy.currentHp - dmg;
                    if (newHp <= 0) {
                      removeRoomEnemyById(targetRoomId, enemy.id);
                      markRoomAlerted(targetRoomId);
                      const prefix = `🏹 shoot ${dir} (${dist}/${shootReach}칸) — ${hitPart} 관통!${unawareTag}${elevTag}${ghostTag2} (-${dmg})${critTag}${
                        ghostSnipe2 ? `\n${wrapScreenShakeLines('탄도가 은신막을 찢으며 실려 나갑니다.')}` : ''
                      }`;
                      response = handleEnemiesDefeat([{ ...enemy, currentHp: 0 }], `${prefix}\n[${formatEnemyName(enemy)}] 격파!`);
                    } else {
                      setRoomEnemies(prev => {
                        const list = prev[targetRoomId] || [];
                        return {
                          ...prev,
                          [targetRoomId]: list.map((e) => {
                            if (e.id !== enemy.id) return { ...e, alerted: true };
                            let u: ActiveEnemy = { ...e, currentHp: newHp, alerted: true };
                            if (rogueAlchPoison2) {
                              u = {
                                ...u,
                                poisonTurns: Math.max(u.poisonTurns ?? 0, 4),
                                slowTurns: Math.max(u.slowTurns ?? 0, 3),
                              };
                            }
                            return u;
                          }),
                        };
                      });
                      const shown = formatEnemyName({ ...enemy, currentHp: newHp });
                      const alch2 = rogueAlchPoison2 ? '\n☠️ [연금 룬] 화살에 말독이 번졌습니다! (중독·감속)' : '';
                      response =
                        `🏹 shoot ${dir} (${dist}/${shootReach}칸) — ${hitPart} 관통!${unawareTag}${elevTag}${ghostTag2} 피해 ${dmg}${critTag}${alch2}\n` +
                        `[${shown}] HP: ${newHp}/${enemy.maxHp}\n` +
                        `⚠️ 총성에 적이 당신을 인지했습니다. 곧 접근할 수 있습니다.`;
                    }
                  }
                }
              }
            }
          }
        }
      } else if (input === '경계' || input.startsWith('경계 ')) {
        if (playerState.isCombat && activeEnemies.length > 0) {
          response = '전투 중에는 경계 상태를 잡을 수 없습니다.';
        } else if (!isRangedWeaponEquipped()) {
          response = '경계(선제 저격)는 활/석궁 계열 무기가 필요합니다.';
        } else if (isBroken(playerState.weapon || '')) {
          response = `💥 [${resolveSlotToItemName(playerState.weapon, playerState.inventory)}]이(가) 파손되어 경계할 수 없습니다. 안전지대에서 '수리 무기'를 사용하세요.`;
        } else {
          // 기본 3턴 경계(Overwatch). 이미 경계 중이면 갱신(리셋)한다.
          setPlayerState(p => ({ ...p, watchTurnsLeft: 3 }));
          const owElev = getRoomElevation(currentRoomId) >= 1;
          response =
            `╔════════════════════════════════════════════════════════════╗\n` +
            `║  ◆ OVERWATCH / 경계 — 들어오는 그림자에 방아쇠가 먼저 반응한다 ◆  ║\n` +
            `╚════════════════════════════════════════════════════════════╝\n` +
            `👁️ 숨을 죽이고 투시 기준선을 맞춥니다. (3턴 · 적이 이 방으로 진입하는 순간 선제 사격)\n` +
            (owElev ? '⛰️ 고각: 시야·탄도가 유리해 선제 사격 위력이 조금 오릅니다.\n' : '');
        }
      } else if (input === '저격' || input.startsWith('저격 ')) {
        // 로그 전용: 미니맵(방) 기준 방향 1~2칸 내의 적을 자동 타격
        if (loggedInChar?.job !== '로그') {
          response = '저격은 로그 직업만 사용할 수 있습니다.';
        } else if (playerState.isCombat && activeEnemies.length > 0) {
          response = '⚔️ 전투 중에는 저격으로 방 밖을 노릴 수 없습니다.';
        } else {
          const parts = input.split(/\s+/).filter(Boolean);
          const dir = (parts[1] || '').trim() as '북'|'남'|'동'|'서';
          if (!['북', '남', '동', '서'].includes(dir)) {
            response = "사용법: 저격 [북/남/동/서]\n예: 저격 북";
          } else {
            // shoot 로직을 그대로 사용하되, 대상 미지정이면 가장 가까운 적을 자동 선택
            const weapon = getMergedEquippedItem(playerState.weapon, playerState.inventory);
            const isRangedWeapon = weapon?.weaponClass === 'bow' || resolveSlotToItemName(playerState.weapon, playerState.inventory).includes('활') || resolveSlotToItemName(playerState.weapon, playerState.inventory).includes('석궁');
            if (!isRangedWeapon) {
              response = '활/석궁을 장착해야 저격할 수 있습니다.';
            } else if (isBroken(playerState.weapon || '')) {
              response = `💥 [${resolveSlotToItemName(playerState.weapon, playerState.inventory)}]이(가) 파손되어 저격할 수 없습니다. 안전지대에서 '수리 무기'를 사용하세요.`;
            } else {
              const snipeReach = getPlayerRangedReachTiles();
              const rooms = getLineRooms(currentRoomId, dir, snipeReach);
              if (rooms.length === 0) {
                response = `[${dir}] 방향으로는 저격할 수 있는 통로가 없습니다.`;
              } else {
                const candidates: Array<{ roomId: string; dist: number; enemy: ActiveEnemy }> = [];
                rooms.forEach((rid, idx) => {
                  const list = ensureRoomEnemies(rid);
                  // 가까운 방 우선, 그리고 이름(A/B/C) 순서 유지
                  list.forEach(e => candidates.push({ roomId: rid, dist: idx + 1, enemy: e }));
                });
                if (candidates.length === 0) {
                  response = `🔭 [저격:${dir}] 사거리 ${snipeReach}칸 안에는 적이 없습니다.`;
                } else {
                  const target = candidates[0];
                  const { roomId: targetRoomId, dist, enemy } = target;
                  // 원격으로 해당 방의 적을 건드린 순간, 강제 기습 플래그를 소비한다.
                  // WHY: 이후 이동 시 또 다른 적이 새로 스폰되는 "없다/있다" 혼선을 줄인다.
                  setForcedAmbushRooms(prev => {
                    const next = { ...prev };
                    delete next[targetRoomId];
                    return next;
                  });
                  const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
                  const weaponAttr = getPlayerWeaponAttr();
                  const attrModifier = getDamageModifier(weaponAttr, enemy.armorAttr);
                  const wpPenalty = getWeaponPenalty();
                  const wNm2 = resolveInstanceIdForSlot(playerState.weapon, playerState.inventory) ?? playerState.weapon ?? '';
                  const wEnchant2 = weapon
                    ? resolveEquipmentEnchant(wNm2, weapon, playerState.equipmentEffectiveGrade, playerState.equipmentUpgradeLevels)
                    : { tier: 'common' as ItemGrade, plus: 0 };
                  const wAtkBonus2 = getEnchantStatBonusFromTierPlus(wEnchant2.tier, wEnchant2.plus);
                  const minWeaponDmg = (weapon?.minDamage ?? 1) + wAtkBonus2;
                  const maxWeaponDmg = (weapon?.maxDamage ?? 3) + wAtkBonus2;
                  const roll = Math.floor(Math.random() * (Math.max(minWeaponDmg, maxWeaponDmg) - Math.min(minWeaponDmg, maxWeaponDmg) + 1)) + Math.min(minWeaponDmg, maxWeaponDmg);
                  const penetrationStat = weaponAttr === '피어싱' ? (effDex || effStr) : effStr;
                  const defFactor = (100 + penetrationStat) / (100 + enemy.def);
                  const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
                  const isCrit = Math.random() < critChance;
                  const critMult = isCrit ? 2.2 : 1.0;
                  const randMult = 0.92 + Math.random() * 0.16;
                  const basePart = (effAtk * randMult * critMult) + roll;
                  const isUnaware = !enemy.alerted;
                  const unawareMult = isUnaware ? 1.4 : 1.0;
                  const distMult = dist >= 3 ? 0.86 : dist === 2 ? 0.92 : 1.0;
                  const elevShootMult2 = getRoomElevation(currentRoomId) >= 1 ? 1.07 : 1.0;
                  let dmg = Math.max(
                    1,
                    Math.round(
                      basePart *
                        defFactor *
                        attrModifier *
                        wpPenalty *
                        0.42 *
                        optionFx.damageMult *
                        unawareMult *
                        distMult *
                        elevShootMult2,
                    ),
                  );
                  const ghostSnipe =
                    (playerState.stealthTurnsLeft ?? 0) > 0 &&
                    hasRunePair(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'assassin', 'tracker');
                  if (ghostSnipe) {
                    dmg = Math.max(1, Math.round(dmg * 5));
                  }
                  const rogueAlchPoison =
                    loggedInChar?.job === '로그' &&
                    playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'alchemist');
                  const hitPart = pickHitPart();
                  const critTag = isCrit ? ' \u001b[91mCRIT!\u001b[0m' : '';
                  const unawareTag = isUnaware ? ' 🎯 (무방비 저격)' : '';
                  const elevTag2 = elevShootMult2 > 1 ? ' ⛰️ (고각)' : '';
                  const ghostTag = ghostSnipe ? ' 👻 (고스트 스나이퍼)' : '';
                  const newHp = enemy.currentHp - dmg;
                  if (newHp <= 0) {
                    removeRoomEnemyById(targetRoomId, enemy.id);
                    markRoomAlerted(targetRoomId);
                    const prefix = `🎯 [저격:${dir}] (${dist}/${snipeReach}칸) — ${hitPart} 관통!${unawareTag}${elevTag2}${ghostTag} (-${dmg})${critTag}${
                      ghostSnipe ? `\n${wrapScreenShakeLines('시야 전체가 충격파에 흔들리는 듯, 은신 탄도가 실체화됩니다.')}` : ''
                    }`;
                    response = handleEnemiesDefeat([{ ...enemy, currentHp: 0 }], `${prefix}\n[${formatEnemyName(enemy)}] 격파!`);
                  } else {
                    setRoomEnemies(prev => {
                      const list = prev[targetRoomId] || [];
                      return {
                        ...prev,
                        [targetRoomId]: list.map((e) => {
                          if (e.id !== enemy.id) return { ...e, alerted: true };
                          let u: ActiveEnemy = { ...e, currentHp: newHp, alerted: true };
                          if (rogueAlchPoison) {
                            u = {
                              ...u,
                              poisonTurns: Math.max(u.poisonTurns ?? 0, 4),
                              slowTurns: Math.max(u.slowTurns ?? 0, 3),
                            };
                          }
                          return u;
                        }),
                      };
                    });
                    const shown = formatEnemyName({ ...enemy, currentHp: newHp });
                    const alchLine = rogueAlchPoison ? '\n☠️ [연금 룬] 화살에 말독이 번졌습니다! (중독·감속)' : '';
                    response =
                      `🎯 [저격:${dir}] (${dist}/${snipeReach}칸) — ${hitPart} 관통!${unawareTag}${elevTag2}${ghostTag} 피해 ${dmg}${critTag}${alchLine}\n` +
                      `[${shown}] HP: ${newHp}/${enemy.maxHp}\n` +
                      `⚠️ 적이 당신을 인지했습니다. 곧 접근할 수 있습니다.`;
                  }
                }
              }
            }
          }
        }
      } else if (input.startsWith('코드 ')) {
        if (playerState.isCombat && activeEnemies.length > 0) {
          response = '🚨 전투 중에는 잠금 패널을 조작할 여유가 없다!';
        } else {
          const payload = input.slice('코드 '.length).trim();
          const rNow = getRoomById(currentRoomId);
          const gate = rNow?.puzzleGate;
          if (!payload) {
            response =
              '사용법: `코드` 뒤에 네 자리 숫자를 붙인다. (예: 코드 0000 — 실제 숫자는 방 안 단서에서 찾을 것)';
          } else if (!gate || Object.keys(gate).length === 0) {
            response = '이 방에는 입력할 수 있는 전자 잠금 패널이 없다.';
          } else {
            const ids = [...new Set(Object.values(gate))] as string[];
            const unsolved = ids.filter((id) => !(playerState.solvedPuzzleIds ?? []).includes(id));
            if (unsolved.length === 0) {
              response = '이 구역의 전자 잠금은 이미 모두 해제된 상태다.';
            } else {
              let hit: string | null = null;
              for (const pid of unsolved) {
                if (matchesRoomPuzzleAnswer(pid, payload)) {
                  hit = pid;
                  break;
                }
              }
              if (hit) {
                setPlayerState((p) => ({
                  ...p,
                  solvedPuzzleIds: [...new Set([...(p.solvedPuzzleIds ?? []), hit!])],
                }));
                response = ROOM_PUZZLES[hit]?.solvedMessage ?? '잠금이 해제되었다.';
              } else {
                const pid0 = unsolved[0];
                response = ROOM_PUZZLES[pid0]?.wrongMessage ?? '오답이다. 패널이 거부 응답만 낸다.';
              }
            }
          }
        }
      } else if (input.startsWith('이동 ')) {
        const dir = input.split(' ')[1] as '북'|'남'|'동'|'서';
        const room = getRoomById(currentRoomId);
        const visibleExits = getVisibleExits(room);
        if ((playerState.runeIronFortressTurns ?? 0) > 0) {
          response =
            '🏰 [철의 요새] 룬 효과로 발이 땅에 박혀 있습니다. 지속이 끝날 때까지 이동할 수 없습니다. (적 턴이 지나며 턴 감소)';
        } else if (
          playerState.isCombat &&
          activeEnemies.length > 0 &&
          getActiveSynergyIds(playerState.equippedRuneId, playerState.equippedRuneSecondaryId).includes('moving_fortress')
        ) {
          response =
            '🛡️ [움직이는 요새] 철벽전도사·수호자 룬 공명 — 전투 중 발이 땅에 박혀 이동할 수 없습니다. (상태 이상 면역·반사 강화는 유지)';
        } else if (playerState.isCombat && activeEnemies.length > 0) {
          response = '⚔️ 전투 중에는 그냥 이동할 수 없습니다! 적을 쓰러뜨리거나 \'도망\'쳐야 합니다.';
        } else if (!['북','남','동','서'].includes(dir)) {
          response = `'${dir}'은(는) 알 수 없는 방향입니다. [북, 남, 동, 서] 중 하나를 입력하세요.`;
        } else if (!visibleExits[dir]) {
          response = `[⛔ 막힌 길] [${dir}] 방향은 벽입니다.\n이동 가능한 출구: ${getExitsInDisplayOrder(visibleExits).join(', ') || '없음'}`;
        } else {
          const nextId = visibleExits[dir] as string;
          const nextRoom = getRoomById(nextId);
          const puzzleId = room?.puzzleGate?.[dir];
          if (
            puzzleId &&
            !(playerState.solvedPuzzleIds ?? []).includes(puzzleId)
          ) {
            const def = ROOM_PUZZLES[puzzleId];
            response =
              def?.blockedMoveHint ??
              '[⛔ 잠김] 이 통로는 아직 열리지 않았다. 방 안의 터미널에 맞는 `코드`를 입력해 보자.';
            setLogs((prev) => [...prev, response]);
            return;
          }

          if (nextRoom?.requiredKey && !inventoryHasItemName(playerState.inventory, nextRoom.requiredKey)) {
             response = `[⛔ 잠김] 이 구역에 진입하려면 [${nextRoom.requiredKey}] 아이템이 필요합니다!`;
             setLogs(prev => [...prev, response]);
             return;
          }

          // 격파 기록은 기본 ID(mutant_king)로 저장되며, 구세이브는 mutant_king_0 형태일 수 있음 — 둘 다 인정
          const hasDefeatedBoss = (bossId: string) =>
            playerState.story.defeatedBosses.some(b => b === bossId || b.replace(/_\d+$/, '') === bossId);
          if (nextRoom?.lockedByBoss && !hasDefeatedBoss(nextRoom.lockedByBoss)) {
            // 보스룸 진입 전 경고 및 확인창
            const ok = window.confirm(
              `💀 보스룸에 진입하려 합니다.\n\n[${nextRoom.name}] 안에는 관문 보스가 대기 중입니다.\n\n정말 입장하시겠습니까?`
            );
            if (!ok) {
              setLogs(prev => [...prev, '❕ 보스룸 입장을 취소했습니다. 준비를 더 하고 오자.']);
              return;
            }

            const boss = spawnEnemy(nextRoom.lockedByBoss);
            if (boss) {
              const growthLevel = (playerState.enemyGrowth ?? {})[boss.id]?.level ?? 0;
              const finalBoss = growthLevel > 0 ? applyEnemyGrowth(boss, growthLevel) : boss;
              setActiveEnemies([{ ...finalBoss, id: `${finalBoss.id}_0` }]);
              setPlayerState(p => ({ ...p, isCombat: true, prayerHealTurns: 0, prayerHealPerTurn: 0, godShieldTurns: 0 }));
              setSceneImage(resolveEnemySceneImage(finalBoss.imageKey, finalBoss.id));
              const bossBanner = '💀 [ B O S S   R O O M ! ] 💀';
              const bossMsg = `${bossBanner}\n\n[⛔ 지역 차단] ${nextRoom.name} 진입 불가!\n\n[⚠️ 관문 보스 출현!] 거대한 적이 앞길을 막아섭니다.\n[${finalBoss.name}] HP:${finalBoss.currentHp} ATK:${finalBoss.atk} DEF:${finalBoss.def}\n'공격' 또는 '스킬' 명령으로 돌파하세요!`;
              setLogs(prev => [...prev, bossMsg]);
              setShowBossRoomOverlay(true);
              setTimeout(() => setShowBossRoomOverlay(false), 2800);
              return;
            }
          }

          // 미로 3구역(maze_s4) 최초 진입 시 직업 기본 룬 1개 지급 — checkFirstRune (runeAcquisition.ts)
          const firstRuneGrant = checkFirstRune(nextId, playerState.story, loggedInChar?.job);
          let playerStateForSave = playerState;
          if (firstRuneGrant) {
            const invExtra: string[] = [];
            const invRes = addItemToInventory(playerState.inventory, firstRuneGrant.itemName, invExtra, {
              runeQuality: rollRuneQualityForDrop(),
            });
            playerStateForSave = {
              ...playerState,
              inventory: invRes.inventory,
              story: { ...playerState.story, grantedMazeZone3FirstRune: true },
            };
            if (invExtra.length > 0) setLogs((prev) => [...prev, ...invExtra]);
            setLogs((prev) => [...prev, firstRuneGrant.systemMessage, firstRuneGrant.neonLog]);
          }

          const bountyRes = resolveBountyNpcAfterPlayerMove({
            prevBounty: playerStateForSave.bountyNpc ?? null,
            enteredRoomId: nextId,
            prevCredit: playerStateForSave.credit || 0,
            wanderPool: zone1BountyWanderPool,
          });
          playerStateForSave = {
            ...playerStateForSave,
            bountyNpc: bountyRes.bountyNpc,
            credit: bountyRes.credit,
          };
          if (firstRuneGrant) {
            setPlayerState(playerStateForSave);
          } else {
            setPlayerState((p) => ({
              ...p,
              bountyNpc: bountyRes.bountyNpc,
              credit: bountyRes.credit,
            }));
          }
          if (bountyRes.logs.length > 0) {
            setLogs((prev) => [...prev, ...bountyRes.logs]);
          }

          const bountyTrackerLine =
            bountyRes.bountyNpc &&
            playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'tracker')
              ? `\n${formatBountyTrackerHint(nextId, bountyRes.bountyNpc)}`
              : '';

          setCurrentRoomId(nextId);
          setSceneImage(resolveRoomSceneImage(nextRoom));
          // WHY: 실제로 방 이동이 확정된 시점에만 발소리를 재생해 "뚜벅뚜벅" 피드백을 준다.
          playSoundFootstep();
          if (loggedInChar) {
            const charToSave = { ...loggedInChar, ...playerStateForSave, currentRoomId: nextId };
            saveCharacter(charToSave as Omit<import('./utils/saveSystem').SavedCharacter, 'savedAt'>);
          }
          const rand = Math.random();
          let rogueSense = '';
          if (loggedInChar?.job === '로그') {
             const dangerousExits: string[] = [];
             const dangerousRoomIds: string[] = [];
             Object.entries(nextRoom?.exits || {}).forEach(([d, nId]) => {
               const nR = getRoomById(nId as string);
               if (nR && !nR.isSafe && (nR.encounterChance || 0.25) > 0) {
                  dangerousExits.push(d);
                  dangerousRoomIds.push(nId as string);
               }
             });
             // WHY: 직감이 매 이동마다, 모든 방향에 대해 뜨면 피로도가 커진다.
             //      1) 실제 위험 방향이 있을 때만, 2) 그 중 최대 2개만, 3) 50% 확률로만 경고를 준다.
             if (dangerousExits.length > 0 && Math.random() < 0.5) {
               const limitedDirs = dangerousExits.slice(0, 2);
               rogueSense = `\n🗡️ [로그의 직감] 인접한 ${limitedDirs.join(', ')}쪽에서 불길한 발소리가 들립니다...`;
               // 해당 방향 방들은 다음에 들어가면 1회는 반드시 적과 조우
               setForcedAmbushRooms(prev => {
                 const next = { ...prev };
                 dangerousRoomIds.forEach(id => { next[id] = true; });
                 return next;
               });
             }
          }
          let nextVillageOccupied = !!(nextRoom?.isSafe && playerState.villageOccupied?.[nextId]);
          const safeZoneHint =
            nextRoom?.isSafe && !playerState.villageOccupied?.[nextId]
              ? "\n\n🔥 이곳은 안전지대입니다. '휴식' 명령으로 HP/MP를 전부 회복할 수 있습니다."
              : nextRoom?.isSafe && playerState.villageOccupied?.[nextId]
                ? '\n\n\u001b[31m⚠️ 이 거점은 함락된 상태입니다. 휴식은 불가하며, 적이 배회할 수 있습니다. (\'마을 수복\')\u001b[0m'
                : '';
          const bossRoomHint = nextRoom?.lockedByBoss ? "\n⚠️ 이 구역은 관문 보스가 지키는 보스룸입니다. 전투를 준비하세요." : '';
          const shadowFoldMove =
            (playerState.stealthTurnsLeft ?? 0) > 0 &&
            loggedInChar?.job === '도적' &&
            playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'shadow_illusionist');
          const moveCore = `[${dir}] → [${nextRoom?.name}]\n${nextRoom?.description ?? ''}\n출구: ${getExitsInDisplayOrder(nextRoom?.exits ?? {}).join(', ') || '없음'}${rogueSense}${safeZoneHint}${bossRoomHint}${bountyTrackerLine}`;
          const moveText = shadowFoldMove
            ? `🌫️ [그림자술사 룬] 은신 이동 — 외부 모니터링에 발자취가 남지 않습니다.\n${moveCore}`
            : moveCore;
         let eventMsg = '';
         if (Math.random() < 0.08) {
           const eventType = Math.floor(Math.random() * 3);
           if (eventType === 0) {
             const bonus = 50 + Math.floor(Math.random() * 51);
             setPlayerState(p => ({ ...p, credit: (p.credit || 0) + bonus }));
             eventMsg = `\n\n📦 [랜덤 이벤트] 길가에서 반짝이는 상자를 발견했다! (COIN +${bonus})`;
           } else if (eventType === 1) {
             setPlayerState(p => {
               let extraLogs: string[] = [];
               const res = addItemToInventory(p.inventory, '빨간 포션', extraLogs);
               if (extraLogs.length > 0) {
                 setLogs(prev => [...prev, ...extraLogs]);
               }
               return { ...p, inventory: res.inventory };
             });
             eventMsg = `\n\n🧙 [랜덤 이벤트] 의문의 상인이 지나가며 빨간 포션을 건넨다.`;
           } else {
             const isRogue = loggedInChar?.job === '로그' || loggedInChar?.job === '도적';
             if (isRogue) {
               // 로그/도적은 랜덤 함정을 거의 항상 피한다 — 직업 판타지 반영
               eventMsg = `\n\n🌀 [랜덤 이벤트] 발밑의 함정을 눈치채고 간발의 차이로 피해 갔다. (피해 없음)`;
             } else {
               const trapDmg = 5 + Math.floor(Math.random() * 11);
               setPlayerState(p => ({ ...p, hp: Math.max(1, (p.hp || p.maxHp) - trapDmg) }));
               eventMsg = `\n\n⚠️ [랜덤 이벤트] 함정을 밟았다! (HP -${trapDmg})`;
             }
           }
         }
          let moveTextWithEvent = moveText + eventMsg;

          // ─── 오염도(원한) 기반 "휴식처 습격" ───────────────────────────
          // WHY: 미로에서 몬스터를 많이 처치할수록 휴식거점(초기 허브 2곳 제외)이 습격당할 확률이 오른다.
          //      습격이 발생하면 즉시 함락 처리 + 그 방에서 전투가 시작된다.
          if (nextRoom?.isSafe && isSafeRoomSubjectToInvasion(nextId) && !nextVillageOccupied) {
            const pollution = Math.max(0, Number(playerState.mazePollution ?? 0) || 0);
            if (pollution > 0) {
              // 확률: 2% 기본 + 오염도에 비례 (상한 35%). 오염도 50이면 약 17% 정도.
              const base = 0.02;
              const scaled = pollution * 0.003;
              const assaultChance = Math.min(0.35, base + scaled);
              if (Math.random() < assaultChance) {
                nextVillageOccupied = true;

                // 즉시 함락 상태 반영 (로그/미니맵/휴식 차단)
                setPlayerState(p => ({
                  ...p,
                  villageOccupied: { ...(p.villageOccupied || {}), [nextId]: true },
                }));

                // 습격 적 생성 (휴식처에서는 1~2마리로 제한)
                const count = Math.random() < 0.75 ? 1 : 2;
                const spawned = Array.from({ length: count }).map((_, i) => {
                  let e2 = spawnRandomEnemy(playerState.level);
                  const lv = (playerState.enemyGrowth ?? {})[e2.id]?.level ?? 0;
                  if (lv > 0) e2 = applyEnemyGrowth(e2, lv);
                  return {
                    ...e2,
                    alerted: true,
                    id: `${e2.id}_restraid_${nextId}_${Date.now()}_${i}`,
                    name: `${e2.name} ${String.fromCharCode(65 + i)}`,
                  };
                });

                const liveEnemies = spawned.filter(e => e.currentHp > 0);
                const enemiesListStr = liveEnemies.map(e => `[${e.name}] HP:${e.currentHp}`).join(', ');
                const redAlert =
                  `\u001b[31m⚠️ [습격/함락] 원한이 폭주했다! [${nextRoom.name}]에 몬스터가 들이닥쳐 거점이 점령당했습니다.\u001b[0m`;

                if (liveEnemies.length > 0) {
                  setActiveEnemies(liveEnemies);
                  setPlayerState(p => ({ ...p, isCombat: true, prayerHealTurns: 0, prayerHealPerTurn: 0, godShieldTurns: 0 }));
                  combatStartedThisCommand = true;
                  const firstEnemy = liveEnemies[0];
                  if (firstEnemy) setSceneImage(resolveEnemySceneImage(firstEnemy.imageKey, firstEnemy.id));
                  response = `${moveTextWithEvent}\n\n${redAlert}\n[⚡ 이벤트] ⚠️ 적 출현! ${enemiesListStr}\n'공격' 명령으로 싸우세요!`;
                  return;
                } else {
                  response = `${moveTextWithEvent}\n\n${redAlert}\n(적이 소란만 남기고 사라졌습니다. 그러나 거점은 여전히 함락 상태입니다.)`;
                  return;
                }
              }
            }
          }

          // 방 단위로 이미 존재하던 적이 있으면(저격/사격으로 미리 건드린 적 포함),
          // "새 랜덤 조우"보다 먼저 그 적을 전투로 전환해 연속성을 유지한다.
          const existingInNextRoom = roomEnemies[nextId] || [];
          if ((!nextRoom?.isSafe || nextVillageOccupied) && existingInNextRoom.length > 0) {
            // 방 저장소에서 제거 → 현재 전투 적 목록으로 이동
            setRoomEnemies(prev => {
              const out = { ...prev };
              delete out[nextId];
              return out;
            });
            setActiveEnemies(existingInNextRoom);
            setPlayerState(p => ({ ...p, isCombat: true, prayerHealTurns: 0, prayerHealPerTurn: 0, godShieldTurns: 0 }));
            // 원격 공격/사격으로 이미 이 방의 적을 소환해두었다면, 강제 기습 플래그는 소비한다.
            setForcedAmbushRooms(prev => {
              const next = { ...prev };
              delete next[nextId];
              return next;
            });
            combatStartedThisCommand = true;
            const enemiesListStr = existingInNextRoom.map(e => `[${e.name}] HP:${e.currentHp}`).join(', ');
            response = `${moveTextWithEvent}\n\n[⚡ 이벤트] ⚠️ 적 출현! ${enemiesListStr}\n'공격' 명령으로 싸우세요!`;
            const firstEnemy = existingInNextRoom[0];
            if (firstEnemy) setSceneImage(resolveEnemySceneImage(firstEnemy.imageKey, firstEnemy.id));
            return;
          }

          const isForcedAmbush = !!forcedAmbushRooms[nextId];
          const baseEncounterChance = nextRoom?.encounterChance ?? 0.25;
          const distFromSafeMove = getMinDistanceFromSafeZone(nextId);
          const nearSafe = distFromSafeMove <= NEAR_SAFE_ZONE_MAX_STEPS;
          const effectiveChance = nearSafe ? baseEncounterChance * 0.6 : baseEncounterChance;
          if ((!nextRoom?.isSafe || nextVillageOccupied) && (isForcedAmbush || rand < effectiveChance)) {
            const spawnHiddenBoss = nextRoom?.id === 'deep_abyss' && Math.random() < 0.05;
            const applyNearSafeScale = nearSafe;
            // 안전지대 인근(2~3칸)에서는 등장 적 수를 1마리로 제한
            const moveCount = applyNearSafeScale ? 1 : (Math.floor(Math.random() * 3) + 1);
            const newEnemies = spawnHiddenBoss
              ? (() => {
                  const boss = spawnEnemy('shadow_king');
                  if (!boss) return [];
                  const lv = (playerState.enemyGrowth ?? {})[boss.id]?.level ?? 0;
                  const b = lv > 0 ? applyEnemyGrowth(boss, lv) : boss;
                  return [{ ...b, id: `${b.id}_0` }];
                })()
              : Array.from({ length: moveCount }).map((_, i) => {
                  let e2 = spawnRandomEnemy(playerState.level);
                  const lv = (playerState.enemyGrowth ?? {})[e2.id]?.level ?? 0;
                  if (lv > 0) e2 = applyEnemyGrowth(e2, lv);
                  if (applyNearSafeScale) e2 = scaleEnemyNearSafeZone(e2);
                  return { ...e2, id: `${e2.id}_${i}`, name: `${e2.name} ${String.fromCharCode(65 + i)}` };
                });
            if (newEnemies.length === 0) {
              setLogs(prev => [...prev, moveTextWithEvent]);
              return;
            }
            if (isForcedAmbush) {
              setForcedAmbushRooms(prev => {
                const next = { ...prev };
                delete next[nextId];
                return next;
              });
            }
            let spawnedEnemies = newEnemies;
            // 로그 트랩: 이 방에 설치된 함정이 있으면 첫 등장 적에게 선 피해(와이어는 +기절) 후 1회성 제거
            const trap = roomTraps[nextId];
            if (trap && (trap.type === 'spike' || trap.type === 'wire')) {
              const trapDmg = Math.max(1, Math.round((trap.power || 1) * 0.8));
              const stunTurns = trap.type === 'wire' ? (trap.stunTurns ?? 1) : 0;
              spawnedEnemies = newEnemies.map((e, idx) =>
                idx === 0
                  ? { ...e, currentHp: Math.max(0, e.currentHp - trapDmg), ...(stunTurns > 0 ? { stunTurns } : {}) }
                  : e
              );
              setRoomTraps(prev => {
                const next = { ...prev };
                delete next[nextId];
                return next;
              });
              const first = spawnedEnemies[0];
              moveTextWithEvent += trap.type === 'wire'
                ? `\n\n🧨 [와이어 트랩 발동] 함정이 [${first.name}]에게 ${trapDmg} 피해 + ${stunTurns}턴 기절을 입혔습니다!`
                : `\n\n🧨 [함정 발동] 이전에 설치해 둔 함정이 발동해 [${first.name}]에게 ${trapDmg}의 피해를 입혔습니다!`;
            }
            const liveEnemies = spawnedEnemies.filter(e => e.currentHp > 0);
            if (liveEnemies.length === 0) {
              setLogs(prev => [...prev, `${moveTextWithEvent}\n\n🧨 함정에 걸린 적들이 모두 쓰러졌습니다. 전투는 시작조차 되지 않았습니다.`]);
              return;
            }
            setActiveEnemies(liveEnemies);
            setPlayerState(p => ({ ...p, isCombat: true, prayerHealTurns: 0, prayerHealPerTurn: 0, godShieldTurns: 0 }));
            combatStartedThisCommand = true;
            const firstEnemy = liveEnemies[0];
            if (firstEnemy) setSceneImage(resolveEnemySceneImage(firstEnemy.imageKey, firstEnemy.id));
            const enemiesListStr = liveEnemies.map(e => `[${e.name}] HP:${e.currentHp}`).join(', ');

            // 20% 확률로 기습 공격: 적이 먼저 공격함
            if (!nextRoom?.isSafe && Math.random() < 0.2) {
              const ambushEnemy = newEnemies[0];
              if (!ambushEnemy) {
                response = `${moveTextWithEvent}\n\n⚠️ 적의 기척은 느껴졌지만, 정확한 위치를 포착하지 못했습니다.`;
                return;
              }
              const ambushDmg = Math.max(1, Math.round(ambushEnemy.atk * (0.5 + Math.random() * 0.5)));
              const isRogueJob = loggedInChar?.job === '로그';
              // 로그의 직감: 일정 확률로 "기습 준비 기척"을 먼저 감지해 회피 판정에 보너스 부여
              const sensedAmbush = isRogueJob && Math.random() < 0.6;
              const baseDodgeChance = effDex * 0.01;
              const dodgedAmbush = sensedAmbush || Math.random() < baseDodgeChance;
              if (dodgedAmbush) {
                // WHY: 이미 이동 로그에 [로그의 직감] (인접 위험 방향) 경고가 찍혔다면,
                //      여기서 추가로 직감 문구를 또 출력해 "기습이 2번 나온 것처럼" 보이는 문제를 줄인다.
                const shouldShowSenseLine = sensedAmbush && !rogueSense;
                const senseLine = shouldShowSenseLine
                  ? `\n🗡️ [로그의 직감] 숨어 있던 기척을 미리 눈치채 기습을 피했습니다.`
                  : '';
                response = `${moveTextWithEvent}\n\n⚠️ [기습!] [${ambushEnemy.name}]이(가) 그림자 속에서 뛰쳐나왔습니다!\n💨 그러나 빠른 반응으로 기습을 회피했습니다!${senseLine}\n[⚡ 이벤트] ⚠️ 적 출현! ${enemiesListStr}\n'공격' 명령으로 싸우세요!`;
              } else {
                setPlayerState(p => ({ ...p, hp: Math.max(1, p.hp - ambushDmg) }));
                response = `${moveTextWithEvent}\n\n💀 [기습!] [${ambushEnemy.name}]이(가) 어둠 속에서 달려들었습니다!\n💥 ${ambushDmg}의 기습 피해를 받았습니다. (HP -${ambushDmg})\n[⚡ 이벤트] ⚠️ 적 출현! ${enemiesListStr}\n'공격' 명령으로 반격하세요!`;
              }
            } else {
              response = `${moveTextWithEvent}\n\n[⚡ 이벤트] ⚠️ 적 출현! ${enemiesListStr}\n'공격' 명령으로 싸우세요!`;
            }
          } else if (rand < 0.6) {
            const npcId = Object.keys(playerState.npcs)[Math.floor(Math.random() * Object.keys(playerState.npcs).length)];
            const npc = NPC_LIST.find(n => n.id === npcId);
            response = npc
              ? `${moveTextWithEvent}\n\n[👤 이벤트] [${npc.name}]가 나타났다!\n'대화 ${npc.name}' 명령어로 접근.`
              : `${moveTextWithEvent}\n\n골목은 고요하다. ['조사' 명령으로 주변을 탐색할 수 있습니다]`;
          } else {
            response = `${moveTextWithEvent}\n\n아무 일도 없었다. ['조사' 명령으로 주변을 탐색해 보세요]`;
          }
        }
      } else if (['조사', '탐색', '살피다'].includes(input)) {
        // WHY: 아이템 자동 지급은 게임의 탐험 의미를 없앰.
        // 조사 명령어로 얻도록 하여 플레이어의 의지적 행동을 유도함.
        if (playerState.isCombat && activeEnemies.length > 0) {
          response = '전투 중에는 조사할 여유가 없습니다!';
        } else {
          const currentRoom = getRoomById(currentRoomId);
          const alreadySearched = searchedRooms.has(currentRoomId);

          // 안전 지역이 아닐 때만 확률로 잠복 적 출현. 안전지대 인근(2~3칸)에서는 10%, 그 외 25%
          const distSearch = getMinDistanceFromSafeZone(currentRoomId);
          const ambushChance = distSearch <= NEAR_SAFE_ZONE_MAX_STEPS ? 0.1 : 0.25;
          if (!currentRoom?.isSafe && Math.random() < ambushChance) {
            let e2 = spawnRandomEnemy(playerState.level);
            const lv = (playerState.enemyGrowth ?? {})[e2.id]?.level ?? 0;
            if (lv > 0) e2 = applyEnemyGrowth(e2, lv);
            if (distSearch <= NEAR_SAFE_ZONE_MAX_STEPS) e2 = scaleEnemyNearSafeZone(e2);
            let ambushEnemy: ActiveEnemy = { ...e2, id: `${e2.id}_ambush` };
            let trapMsg = '';
            const trap = roomTraps[currentRoomId];
            if (trap && (trap.type === 'spike' || trap.type === 'wire')) {
              const trapDmg = Math.max(1, Math.round((trap.power || 1) * 0.8));
              const stunTurns = trap.type === 'wire' ? (trap.stunTurns ?? 1) : 0;
              ambushEnemy = { ...ambushEnemy, currentHp: Math.max(0, ambushEnemy.currentHp - trapDmg), ...(stunTurns > 0 ? { stunTurns } : {}) };
              setRoomTraps(prev => { const next = { ...prev }; delete next[currentRoomId]; return next; });
              trapMsg = trap.type === 'wire'
                ? `\n\n🧨 [와이어 트랩 발동] 함정이 [${ambushEnemy.name}]에게 ${trapDmg} 피해 + ${stunTurns}턴 기절을 입혔습니다!`
                : `\n\n🧨 [함정 발동] 설치한 함정이 [${ambushEnemy.name}]에게 ${trapDmg} 피해를 입혔습니다!`;
            }
            setActiveEnemies(ambushEnemy.currentHp > 0 ? [ambushEnemy] : []);
            if (ambushEnemy.currentHp <= 0) {
              const defeatLog = handleEnemiesDefeat([{ ...ambushEnemy, currentHp: 0 }], `🧨 함정에 걸린 [${ambushEnemy.name}] 격파`);
              if (defeatLog) setLogs(prev => [...prev, `🔦 구석구석 살펴보는 도중...${trapMsg}\n\n${defeatLog}`]);
              response = `🔦 구석구석 살펴보는 도중...${trapMsg}\n\n🧨 함정에 걸린 [${ambushEnemy.name}]이(가) 쓰러졌습니다.`;
            } else {
              setPlayerState(p => ({ ...p, isCombat: true, prayerHealTurns: 0, prayerHealPerTurn: 0, godShieldTurns: 0 }));
              setSceneImage(resolveEnemySceneImage(ambushEnemy.imageKey, ambushEnemy.id));
              response = `🔦 구석구석 살펴보는 도중...${trapMsg}\n\n💀 [기습!] 숨어있던 [${ambushEnemy.name}]이(가) 뛰쳐나왔습니다!\n(HP:${ambushEnemy.currentHp} ATK:${ambushEnemy.atk})\n'공격' 명령으로 싸우세요!`;
            }
          } else if (
            RUNE_SEARCH_RESTORE_ROOM_IDS.has(currentRoomId) &&
            !(playerState.story.runeRestoreUsedRoomIds ?? []).includes(currentRoomId) &&
            Math.random() < RUNE_SEARCH_RESTORE_CHANCE
          ) {
            const rid = rollRandomRuneId();
            const itemName = getRuneInventoryItemName(rid);
            setPlayerState((p) => {
              const used = p.story.runeRestoreUsedRoomIds ?? [];
              if (used.includes(currentRoomId)) return p;
              const extraLogs: string[] = [];
              const res = addItemToInventory(p.inventory, itemName, extraLogs, {
                runeQuality: rollRuneQualityForDrop(),
              });
              if (extraLogs.length > 0) setLogs((prev) => [...prev, ...extraLogs]);
              return {
                ...p,
                inventory: res.inventory,
                story: { ...p.story, runeRestoreUsedRoomIds: [...used, currentRoomId] },
              };
            });
            setLogs((prev) => [
              ...prev,
              '🔦 깨진 데이터 매트릭스를 따라 잔향이 이어졌다…\n💠 훼손된 데이터 룬을 복구해 인벤토리에 옮겼습니다!',
              buildNeonRuneLog(rid, 'gain'),
            ]);
            response = `🔦 오래된 코어에서 룬 데이터가 재구성되었습니다.\n[${itemName}]을(를) 획득했습니다.`;
          } else if (alreadySearched) {
            // 이미 수색한 구역: 더 이상 얻을 게 없음
            const exhausted = [
              '이미 샅샅이 뒤진 자리다. 더 이상 찾을 것이 없다.',
              '쓸 만한 건 이미 챙겼다. 빈 컨테이너만 남아있다.',
              '여기서 더 뒤져봤자 먼지뿐이다.',
            ];
            response = `🔦 ${exhausted[Math.floor(Math.random() * exhausted.length)]}`;
          } else if (ROOM_SEARCH_ITEMS[currentRoomId]) {
            // 특정 장소 전용: 이 방에서만 조사로 얻을 수 있는 퀘스트용 아이템 (1회만)
            const found = ROOM_SEARCH_ITEMS[currentRoomId];
            setPlayerState(p => {
              const extraLogs: string[] = [];
              const res = addItemToInventory(p.inventory, found, extraLogs);
              if (extraLogs.length > 0) setLogs(prev => [...prev, ...extraLogs]);
              return { ...p, inventory: res.inventory };
            });
            setSearchedRooms(prev => new Set(prev).add(currentRoomId));
            response = `🔦 주변을 꼼꼼히 살펴보니...\n\n✨ ${currentRoom?.name ?? '이곳'}에서만 발견되는 [${found}]${getObjectParticle(found)} 발견했습니다!\n인벤토리에 추가되었습니다.`;
          } else if (currentRoom?.id === 'slum_s3e2s') {
            // 야적장 끝: 퍼즐형 숨겨진 출구 발견
            setDiscoveredHiddenExits(prev => {
              const next = new Set(prev);
              next.add('slum_s3e2s');
              return next;
            });
            setSearchedRooms(prev => new Set(prev).add(currentRoomId));
            response = '🔦 벽면을 두드려 보니, 남쪽 벽 뒤에서 빈 공간의 울림이 느껴진다.\n조심스럽게 패널을 밀어내자, 아래로 내려가는 좁은 통로가 드러났다. (이제 [남]쪽으로 이동할 수 있습니다)';
          } else if (!currentRoom?.isSafe && Math.random() < 0.18) {
            // WHY: 구역 탐험 중 조사로 가끔 고대 비석을 발견하면 탐험 보상감이 생긴다.
            const lv = playerState.level;
            // WHY: 12~15턴은 명령 입력이 잦을 때 체감상 너무 길어질 수 있어, 비석은 짧은 일시 버프로 통일한다.
            const OBE_TURNS = 8;
            type P = typeof playerState;
            const obeliskRolls: Array<{ name: string; desc: string; apply: (p: P) => P }> = [
              {
                name: '힘의 비석',
                desc: `힘 +${2 + Math.floor(lv / 3)} (${OBE_TURNS}턴)`,
                apply: p => ({ ...p, obeliskStrBonus: 2 + Math.floor(lv / 3), obeliskStrTurns: OBE_TURNS }),
              },
              {
                name: '민첩의 비석',
                desc: `민첩 +${2 + Math.floor(lv / 4)} (${OBE_TURNS}턴)`,
                apply: p => ({ ...p, obeliskDexBonus: 2 + Math.floor(lv / 4), obeliskDexTurns: OBE_TURNS }),
              },
              {
                name: '체력의 비석',
                desc: `체력(CON) +${2 + Math.floor(lv / 5)} — 최대 HP·방어에 반영 (${OBE_TURNS}턴)`,
                apply: p => {
                  const add = 2 + Math.floor(lv / 5);
                  const n = { ...p, obeliskConBonus: add, obeliskConTurns: OBE_TURNS };
                  const before = getEffectiveMaxHpMp(p);
                  const after = getEffectiveMaxHpMp(n);
                  const dHp = Math.max(0, after.maxHp - before.maxHp);
                  return { ...n, maxHp: after.maxHp, maxMp: after.maxMp, hp: Math.min(after.maxHp, p.hp + dHp), mp: Math.min(after.maxMp, p.mp) };
                },
              },
              {
                name: '지혜의 비석',
                desc: `지능 +${2 + Math.floor(lv / 5)} — 최대 MP에 반영 (${OBE_TURNS}턴)`,
                apply: p => {
                  const add = 2 + Math.floor(lv / 5);
                  const n = { ...p, obeliskIntBonus: add, obeliskIntTurns: OBE_TURNS };
                  const before = getEffectiveMaxHpMp(p);
                  const after = getEffectiveMaxHpMp(n);
                  const dMp = Math.max(0, after.maxMp - before.maxMp);
                  return { ...n, maxHp: after.maxHp, maxMp: after.maxMp, hp: Math.min(after.maxHp, p.hp), mp: Math.min(after.maxMp, p.mp + dMp) };
                },
              },
              {
                name: '정신의 비석',
                desc: `정신력 +${2 + Math.floor(lv / 5)} — 최대 MP에 반영 (${OBE_TURNS}턴)`,
                apply: p => {
                  const add = 2 + Math.floor(lv / 5);
                  const n = { ...p, obeliskSprBonus: add, obeliskSprTurns: OBE_TURNS };
                  const before = getEffectiveMaxHpMp(p);
                  const after = getEffectiveMaxHpMp(n);
                  const dMp = Math.max(0, after.maxMp - before.maxMp);
                  return { ...n, maxHp: after.maxHp, maxMp: after.maxMp, hp: Math.min(after.maxHp, p.hp), mp: Math.min(after.maxMp, p.mp + dMp) };
                },
              },
              {
                name: '파괴의 비석',
                desc: `공격력(ATK) +${4 + Math.floor(lv * 0.5)} (${OBE_TURNS}턴)`,
                apply: p => ({ ...p, obeliskAtkBonus: 4 + Math.floor(lv * 0.5), obeliskAtkTurns: OBE_TURNS }),
              },
              {
                name: '수호의 비석',
                desc: `방어력 +${2 + Math.floor(lv / 4)} (${OBE_TURNS}턴)`,
                apply: p => ({ ...p, obeliskDefBonus: 2 + Math.floor(lv / 4), obeliskDefTurns: OBE_TURNS }),
              },
              {
                name: '생명의 비석',
                desc: `최대 HP 한계 +${10 + lv * 2} 및 즉시 충전 (${OBE_TURNS}턴)`,
                apply: p => {
                  const add = 10 + lv * 2;
                  const baseP = { ...p, obeliskMaxHpBonus: 0, obeliskMaxHpTurns: 0 };
                  const before = getEffectiveMaxHpMp(baseP);
                  const n = { ...baseP, obeliskMaxHpBonus: add, obeliskMaxHpTurns: OBE_TURNS };
                  const after = getEffectiveMaxHpMp(n);
                  const heal = Math.max(0, after.maxHp - before.maxHp);
                  return { ...n, maxHp: after.maxHp, maxMp: after.maxMp, hp: Math.min(after.maxHp, p.hp + heal), mp: Math.min(after.maxMp, p.mp) };
                },
              },
              {
                name: '샘의 비석',
                desc: `생명력 즉시 회복 (최대 HP의 일부 + 고정치)`,
                apply: p => {
                  const heal = Math.round(p.maxHp * 0.35 + 12 + lv * 3);
                  return { ...p, hp: Math.min(p.maxHp, p.hp + heal) };
                },
              },
              {
                name: '마나샘의 비석',
                desc: `MP 즉시 회복 (최대 MP의 일부 + 고정치)`,
                apply: p => {
                  const mana = Math.round(p.maxMp * 0.35 + 8 + lv * 2);
                  return { ...p, mp: Math.min(p.maxMp, p.mp + mana) };
                },
              },
            ];
            const picked = obeliskRolls[Math.floor(Math.random() * obeliskRolls.length)];
            setPlayerState(p => picked.apply(p));
            setSearchedRooms(prevSet => new Set(prevSet).add(currentRoomId));
            response =
              `🔦 먼지 쌓인 틈새에서 낡은 비석이 드러난다...\n\n` +
              `🗿 [${picked.name}]에 손을 얹자 푸른 빛이 흐른다!\n` +
              `▶ ${picked.desc}\n` +
              `(잔여 턴은 명령을 입력할 때마다 1씩 줄어듭니다. 안전지대 '휴식' 시 비석 효과도 함께 사라집니다.)`;
          } else if (Math.random() < 0.5) {
            // 50%: 아이템 발견 (처음 수색 + 운이 좋을 때만) — 에픽 양손검 등은 가중치 낮춤
            const SEARCH_LOOT_WEIGHTED = [
              { name: '수상한 USB 포션', w: 18 },
              { name: '낡은 붕대', w: 18 },
              { name: '강철 장검', w: 15 },
              { name: '정예 기사의 양손검', w: 3 },
              { name: '오크 문양 방패', w: 14 },
              { name: '초보자용 가죽갑옷', w: 16 },
              { name: '제국 기사의 판금갑옷', w: 8 },
              { name: '홀로그램 조각', w: 12 },
            ];
            const found = pickWeightedLootName(SEARCH_LOOT_WEIGHTED, Math.random);
            setPlayerState(p => {
              let extraLogs: string[] = [];
              const res = addItemToInventory(p.inventory, found, extraLogs);
              if (extraLogs.length > 0) {
                setLogs(prev => [...prev, ...extraLogs]);
              }
              return { ...p, inventory: res.inventory };
            });
            // 아이템을 발견한 이후 해당 방을 수색 완료로 표시
            setSearchedRooms(prev => new Set(prev).add(currentRoomId));
            response = `🔦 주변을 꼼꼼히 살펴보니...\n\n✨ 먼지 쌓인 구석에서 [${found}]${getObjectParticle(found)} 발견했습니다!\n인벤토리에 추가되었습니다.`;
          } else {
            // 50%: 아무것도 없음 (처음엔 운이 없었을 뿐, 재시도 불가)
            const nothing = [
              '오래된 쓰레기뿐이다... 여기서 얻을 건 없어.',
              '벽에 오래된 기업 로고가 희미하게 남아있다. 수상한 건 없다.',
              '이미 누군가 훑고 간 자리인지, 빈 컨테이너만 가득하다.',
              '잡동사니들 사이를 뒤져봤지만 쓸 만한 건 없었다.',
            ];
            // 아무것도 없다면 그 방은 완전히 수색 완료로 표시
            setSearchedRooms(prev => new Set(prev).add(currentRoomId));
            response = `🔦 ${nothing[Math.floor(Math.random() * nothing.length)]}`;
          }
        }
      } else if (['인벤','인벤토리'].includes(input)) {
        if (playerState.inventory.length === 0) {
          response = '가방이 비어있습니다.';
        } else {
          const weapons: string[] = [];
          const armors: string[] = [];
          const rings: string[] = [];
          const necklaces: string[] = [];
          const potions: string[] = [];
          const skillbooks: string[] = [];
          const miscs: string[] = [];
          
          const equipSlotIds = new Set<string>();
          [
            playerState.weapon,
            playerState.armor,
            playerState.offHand,
            (playerState as any).ring1,
            (playerState as any).ring2,
            (playerState as any).necklace,
          ].forEach((eq) => {
            if (eq) equipSlotIds.add(eq);
          });

          playerState.inventory.forEach((row) => {
            const itemName = invName(row);
            const instanceId = row.id;
             const displayItemName = itemName === '낙은 데이터 칩' ? '낡은 데이터 칩'
               : itemName === '먹다 남은 비스케수' ? '먹다 남은 비스킷' : itemName;
             let prefix = '';
             if (equipSlotIds.has(instanceId)) {
                 prefix = '[E]';
                 equipSlotIds.delete(instanceId);
             }
            let itemDef = getItemByName(itemName) ?? getItemByName(displayItemName);
            if (row.identified === false && row.mysteryItemId) {
              itemDef = getItemById(row.mysteryItemId);
            }
            const itemUpLv = (playerState.equipmentUpgradeLevels || {})[instanceId] || 0;
            const effectiveGrade = itemDef ? getEffectiveItemGrade(itemDef, instanceId) : null;
            const coloredName =
              row.identified === false
                ? `\u001b[37m${displayItemName}\u001b[0m`
                : colorizeItemName(itemDef, displayItemName, effectiveGrade ?? undefined);
            const gradeTagColored =
              row.identified === false ? '' : colorizeItemGradeTag(itemDef, effectiveGrade ?? undefined);
            // 강화(+N)는 등급 태그·이름 뒤에 붙여 티어와 강화 수치를 함께 본다.
            const plusLabel = itemUpLv > 0 ? ` +${itemUpLv}` : '';
            const itemLevelLabel =
              row.itemLevel != null && row.identified !== false
                ? ` \u001b[36mLv.${row.itemLevel}\u001b[0m`
                : '';
            const stackSuffix =
              itemDef?.type === 'consumable' && getInventoryStackQty(row) > 1
                ? ` ×${getInventoryStackQty(row)}`
                : '';
            // 인벤토리에서는 prefix([E])가 우선 표시되도록 유지하고, 등급 태그도 ANSI로 색 처리
            const displayName = prefix
              ? `${prefix} ${gradeTagColored}${coloredName}${plusLabel}${itemLevelLabel}${stackSuffix}`
              : `${gradeTagColored}${coloredName}${plusLabel}${itemLevelLabel}${stackSuffix}`;
             
              if (!itemDef) {
              miscs.push(displayName);
            } else if (itemDef.type === 'weapon') {
              weapons.push(displayName);
            } else if (itemDef.type === 'armor' || itemDef.type === 'shield') {
              armors.push(displayName);
            } else if (itemDef.type === 'accessory') {
              if (itemDef.slot === 'ring') rings.push(displayName);
              else if (itemDef.slot === 'necklace') necklaces.push(displayName);
              else miscs.push(displayName);
            } else if (itemDef.type === 'consumable') {
              potions.push(displayName);
            } else if (itemDef.type === 'skillbook') {
              skillbooks.push(displayName);
            } else {
              miscs.push(displayName);
            }
          });
          
          // 분류 줄만 단독으로 두고, 아이템(+등급 태그)은 예전처럼 한 줄에 '|'로 묶어 세로 길이를 줄임
          const lines: string[] = [];
          const pushInventorySection = (sectionLabel: string, itemLines: string[]) => {
            if (itemLines.length === 0) return;
            lines.push(sectionLabel);
            lines.push(`  ${itemLines.join(' | ')}`);
          };
          pushInventorySection('[무기]', weapons);
          pushInventorySection('[갑옷]', armors);
          pushInventorySection('[반지]', rings);
          pushInventorySection('[목걸이]', necklaces);
          pushInventorySection('[물약]', potions);
          pushInventorySection('[스킬북]', skillbooks);
          pushInventorySection('[잡동사니]', miscs);
          
          response = `[인벤토리] (${playerState.inventory.length}/${INVENTORY_MAX_SLOTS}칸)\n${lines.join('\n')}`;
        }
      } else if (input === '성벽' || input === '성벽 상태' || input === '마을 방어') {
        const lines: string[] = [];
        for (const w of VILLAGE_WALLS) {
          const hp = playerState.villageWallHp?.[w.id] ?? w.maxHp;
          const occ = playerState.villageOccupied?.[w.villageRoomId];
          const vname = getRoomById(w.villageRoomId)?.name ?? w.villageRoomId;
          const gname = getRoomById(w.gateRoomId)?.name ?? w.gateRoomId;
          lines.push(`- [${vname}] 성벽 ${hp}/${w.maxHp} · 관문 [${gname}]${occ ? ' ⚠ 함락' : ''}`);
        }
        const zoneLines = ZONE_OFFICIAL_VILLAGE.map(z => `  · 구역 ${z.zone}: ${z.label} (\`${z.roomId}\`)`).join('\n');
        response =
          `🧱 [마을 방어 / 성벽]\n${lines.join('\n')}\n\n` +
          `[구역별 거점 예시]\n${zoneLines}\n\n` +
          `- [홍대 지하 클리닉]·[지하 슬럼 상점가]만 초기 스폰 허브로 적 침공·함락이 없습니다.\n` +
          `- 그 외 안전지대(예: 심층 미로 휴식처)는 적이 들어오면 함락·휴식 불가 — 전투로 몬스터를 물리치면 자동으로 휴식 가능 상태로 돌아옵니다.\n` +
          `- 구역 2 이상 성벽: 성벽 HP가 남아 있으면 성벽 마을로 적이 들어갈 수 없습니다.\n` +
          `- 무성벽 안전거점은 추적 중인 적이 방에 들어오면 함락될 수 있습니다.\n` +
          `- 관문에 적이 있고 플레이어가 마을 안에 있으면, 매 턴 성벽이 피해를 입습니다.\n` +
          `- 관문에서 \`성벽 수리\` / 함락 시 해당 방에서 \`마을 수복\` (성벽 거점은 고비용, 무성벽 거점은 별도 비용).`;
      } else if (input === '성벽 공격' || input === '공성') {
        const def = getWallDefForGateRoom(currentRoomId);
        if (!def) {
          response = '성벽이 있는 관문 방에서만 공성 타격을 가할 수 있습니다.';
        } else {
          const cur = playerState.villageWallHp?.[def.id] ?? def.maxHp;
          if (cur <= 0) {
            response = '이미 무너진 성벽입니다.';
          } else {
            const siegeRune =
              playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'berserker') ||
              playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'shield_preacher');
            let base = Math.max(12, Math.round((playerState.atk || 10) * 1.4 + playerState.level * 2));
            if (siegeRune) base *= 2;
            const nh = Math.max(0, cur - base);
            setPlayerState((p) => ({
              ...p,
              villageWallHp: { ...(p.villageWallHp || {}), [def.id]: nh },
            }));
            const vn = getRoomById(def.villageRoomId)?.name ?? '';
            response = `🧱 [공성 타격] 성벽에 결정타를 가했습니다! (-${base}${siegeRune ? ' · 광전사/철벽전도사 룬 2배 파괴력' : ''}, 잔여 ${nh}/${def.maxHp})\n[${vn}] 방어 거점`;
          }
        }
      } else if (input === '성벽 수리') {
        const def = getWallDefForGateRoom(currentRoomId);
        if (!def) {
          response = '성벽이 있는 관문 방에서만 수리할 수 있습니다. (\'성벽\' 명령으로 목록 확인)';
        } else {
          const cur = playerState.villageWallHp?.[def.id] ?? def.maxHp;
          if (cur >= def.maxHp) {
            response = '성벽이 이미 최대 내구도입니다.';
          } else {
            const cost = repairWallCost(def, cur);
            if ((playerState.credit || 0) < cost) {
              response = `COIN이 부족합니다. (필요: ${cost} / 보유: ${playerState.credit || 0})`;
            } else {
              setPlayerState(p => ({
                ...p,
                credit: (p.credit || 0) - cost,
                villageWallHp: { ...(p.villageWallHp || {}), [def.id]: def.maxHp },
              }));
              const vn = getRoomById(def.villageRoomId)?.name ?? '';
              response = `🛠 성벽을 보수했습니다! (-${cost} C) → [${vn}] 방어 ${def.maxHp}/${def.maxHp}`;
            }
          }
        }
      } else if (input === '마을 수복') {
        const def = getWallDefForVillageOrGate(currentRoomId);
        const openSafeId = currentRoomId;
        const openRoom = getRoomById(openSafeId);
        const openInvaded =
          !!openRoom?.isSafe &&
          isSafeRoomSubjectToInvasion(openSafeId) &&
          !!playerState.villageOccupied?.[openSafeId];

        if (def) {
          if (!playerState.villageOccupied?.[def.villageRoomId]) {
            response = '이 거점은 함락 상태가 아닙니다. (성벽만 손상된 경우 \'성벽 수리\')';
          } else {
            const cost = rebuildOccupiedVillageCost(def);
            if ((playerState.credit || 0) < cost) {
              response = `COIN이 부족합니다. (필요: ${cost} / 보유: ${playerState.credit || 0})`;
            } else {
              setPlayerState(p => ({
                ...p,
                credit: (p.credit || 0) - cost,
                villageWallHp: { ...(p.villageWallHp || {}), [def.id]: def.maxHp },
                villageOccupied: { ...(p.villageOccupied || {}), [def.villageRoomId]: false },
              }));
              setRoomEnemies(prev => {
                const out = { ...prev };
                delete out[def.villageRoomId];
                return out;
              });
              const vn = getRoomById(def.villageRoomId)?.name ?? '';
              response = `🏳️ [${vn}] 거점을 탈환·재건했습니다! (-${cost} C, 성벽 ${def.maxHp}, 함락 해제)`;
            }
          }
        } else if (openInvaded) {
          const cost = rebuildOpenSafeVillageOccupiedCost(openSafeId);
          if ((playerState.credit || 0) < cost) {
            response = `COIN이 부족합니다. (필요: ${cost} / 보유: ${playerState.credit || 0})`;
          } else {
            setPlayerState(p => ({
              ...p,
              credit: (p.credit || 0) - cost,
              villageOccupied: { ...(p.villageOccupied || {}), [openSafeId]: false },
            }));
            setRoomEnemies(prev => {
              const out = { ...prev };
              delete out[openSafeId];
              return out;
            });
            const vn = openRoom?.name ?? '';
            response = `🏳️ [${vn}] 무성벽 거점을 탈환했습니다! (-${cost} C, 함락 해제 · 잔적 청소)`;
          }
        } else {
          response =
            '\'마을 수복\'은 함락된 안전거점 방(또는 성벽 관문·해당 마을)에서만 사용할 수 있습니다. ([홍대 지하 클리닉]·[지하 슬럼 상점가]는 함락 없음)';
        }
      } else if (input === '내구도' || input === '장비 내구도') {
        const room = getRoomById(currentRoomId);
        const ring1 = (playerState as any).ring1 as string | null;
        const ring2 = (playerState as any).ring2 as string | null;
        const necklace = (playerState as any).necklace as string | null;
        const equipped = [
          { label: '무기', name: playerState.weapon },
          { label: '보조손', name: playerState.offHand },
          { label: '갑옷', name: playerState.armor },
          { label: '반지1', name: ring1 },
          { label: '반지2', name: ring2 },
          { label: '목걸이', name: necklace },
        ].filter(e => !!e.name) as Array<{ label: string; name: string }>;

        if (equipped.length === 0) {
          response = '착용 중인 장비가 없습니다.';
        } else {
          const lines = equipped.map(e => {
            const { cur, max } = getDurability(e.name);
            const brokenTag = cur <= 0 ? ' 💥(파손)' : '';
            const disp = resolveSlotToItemName(e.name, playerState.inventory);
            return `${e.label}: [${disp}] 내구도 ${cur}/${max}${brokenTag}`;
          });
          response =
            `[내구도]\n${lines.join('\n')}\n\n` +
            `- 전투 중 무기/방어구/방패 내구도가 조금씩 감소합니다.\n` +
            `- 내구도 0이면 해당 장비 효과가 적용되지 않습니다.\n` +
            `- ${room?.isSafe ? '현재 위치는 안전지대입니다. ' : '안전지대에서 '}\'수리\'로 복구할 수 있습니다. (예: 수리 무기 / 수리 방어구 / 수리 전체)`;
        }
      } else if (input === '수리' || input.startsWith('수리 ')) {
        const room = getRoomById(currentRoomId);
        if (!room?.isSafe) {
          response = `여긴 안전지대가 아닙니다. 수리는 안전지대에서만 가능합니다.`;
        } else {
          const arg = input === '수리' ? '전체' : input.substring(2).trim();
          const ring1 = (playerState as any).ring1 as string | null;
          const ring2 = (playerState as any).ring2 as string | null;
          const necklace = (playerState as any).necklace as string | null;
          const equipped = [
            playerState.weapon,
            playerState.offHand,
            playerState.armor,
            ring1,
            ring2,
            necklace,
          ].filter(Boolean) as string[];

          const pickTargets = (): string[] => {
            const inv = playerState.inventory;
            if (['전체', '올', 'all'].includes(arg)) return equipped;
            if (['무기', '검', '활', '단검', '지팡이'].some(k => arg.includes(k))) {
              return equipped.filter((slot) => getMergedEquippedItem(slot, inv)?.type === 'weapon');
            }
            if (['방어구', '갑옷'].some(k => arg.includes(k))) {
              return equipped.filter((slot) => getMergedEquippedItem(slot, inv)?.type === 'armor');
            }
            if (['방패', '보조손'].some(k => arg.includes(k))) {
              return equipped.filter((slot) => getMergedEquippedItem(slot, inv)?.type === 'shield');
            }
            if (['장신구', '반지', '목걸이'].some(k => arg.includes(k))) {
              return equipped.filter((slot) => getMergedEquippedItem(slot, inv)?.type === 'accessory');
            }
            // 아이템명을 직접 지정한 경우
            return equipped.filter((slot) => {
              const dn = resolveSlotToItemName(slot, inv);
              return dn.includes(arg) || arg.includes(dn);
            });
          };

          const targets = pickTargets();
          if (targets.length === 0) {
            response = `수리할 장비를 찾지 못했습니다. (예: 수리 무기 / 수리 방어구 / 수리 전체)`;
          } else {
            const uniqueTargets = Array.from(new Set(targets));
            let totalCost = 0;
            const plan = uniqueTargets.map((slotId) => {
              const dispName = resolveSlotToItemName(slotId, playerState.inventory);
              const { cur, max } = getDurability(slotId);
              const missing = Math.max(0, max - cur);
              const cost = missing * repairCostPerPoint(dispName);
              totalCost += cost;
              return { slotId, name: dispName, cur, max, missing, cost };
            }).filter(p => p.missing > 0);

            if (plan.length === 0) {
              response = '수리할 필요가 없습니다. (내구도가 모두 가득합니다)';
            } else if ((playerState.credit || 0) < totalCost) {
              response =
                `COIN이 부족합니다. (필요: ${totalCost} / 보유: ${playerState.credit || 0})\n` +
                plan.map(p => `- [${p.name}] ${p.cur}/${p.max} → ${p.max}/${p.max} (비용 ${p.cost})`).join('\n');
            } else {
              setPlayerState(p => {
                const nextDur = { ...(p.equipmentDurability || {}) };
                plan.forEach((pl) => { nextDur[pl.slotId] = pl.max; });
                return { ...p, credit: Math.max(0, (p.credit || 0) - totalCost), equipmentDurability: nextDur };
              });
              response =
                `🛠 수리 완료! (비용 ${totalCost} COIN)\n` +
                plan.map(p => `- [${p.name}] ${p.cur}/${p.max} → ${p.max}/${p.max}`).join('\n');
            }
          }
        }
      } else if (['장비 확인', '장비', '장비 스펙', '장비능력치', '장비확인'].includes(input)) {
        const ring1 = (playerState as any).ring1 as string | null;
        const ring2 = (playerState as any).ring2 as string | null;
        const necklace = (playerState as any).necklace as string | null;
        const equipSummary: string[] = [];
        if (playerState.weapon) equipSummary.push(`무기: ${formatEquipmentHudLine(playerState.weapon)}`);
        if (playerState.offHand) equipSummary.push(`보조손: ${formatEquipmentHudLine(playerState.offHand)}`);
        if (playerState.armor) equipSummary.push(`갑옷: ${formatEquipmentHudLine(playerState.armor)}`);
        if (ring1) equipSummary.push(`반지1: ${formatEquipmentHudLine(ring1)}`);
        if (ring2) equipSummary.push(`반지2: ${formatEquipmentHudLine(ring2)}`);
        if (necklace) equipSummary.push(`목걸이: ${formatEquipmentHudLine(necklace)}`);
        if (playerState.inventory.length === 0) {
          response = equipSummary.length > 0
            ? `[현재 착용]\n${equipSummary.join('\n')}\n\n가방이 비어있어 추가로 확인할 장비가 없습니다.`
            : '가방이 비어있고 착용 중인 장비도 없습니다.';
        } else {
          const equipLogs: string[] = [];
          if (equipSummary.length > 0) equipLogs.push('[현재 착용]\n' + equipSummary.join(' | ') + '\n');
          playerState.inventory.forEach((row) => {
            const instanceId = row.id;
            if (row.identified === false && row.mysteryItemId) {
              const ghost = getItemById(row.mysteryItemId);
              const hint = ghost ? getMysteryCategoryLabel(ghost) : '장비';
              equipLogs.push(`❓ ${row.name}: 미확인 (${hint}). 감정 후 부가 옵션이 공개됩니다.`);
              return;
            }
            const item = getMergedEquippedItem(row.id, playerState.inventory);
            const baseForGrade = getItemByName(row.name);
            if (!item || !baseForGrade) return;
            const effectiveGrade = getEffectiveItemGrade(baseForGrade, instanceId);
            const coloredName = colorizeItemName(baseForGrade, item.name, effectiveGrade ?? undefined);
            const gradeTagColored = colorizeItemGradeTag(baseForGrade, effectiveGrade ?? undefined);
            const affixSuffix =
              row.rolledAffixes && row.rolledAffixes.length > 0
                ? `\n    └ 부가 옵션: ${row.rolledAffixes.map((a) => a.labelKo).join(' · ')}`
                : '';
            // WHY: 동일 이름이라도 인스턴스별 강화·감정 부가옵션이 다를 수 있어 행마다 표시
            if (item.type === 'weapon') {
              equipLogs.push(`⚔ ${gradeTagColored}${coloredName}: 공격력 ${item.minDamage}~${item.maxDamage}${affixSuffix}`);
            } else if (item.type === 'shield') {
              const totalDef = (item.defense ?? 0) + (item.bonusDefense ?? 0);
              equipLogs.push(
                `🛡 ${gradeTagColored}${coloredName}: 방어력 +${totalDef}${
                  item.bonusDefense ? ` (기본 ${item.defense} + ${item.bonusDefense})` : ''
                }${affixSuffix}`
              );
            } else if (item.type === 'armor') {
              const attr = item.name.includes('천') ? '천' : item.name.includes('가죽') ? '가죽' : item.name.includes('사슬') ? '사슬' : '판금';
              const dodge = Math.round(getArmorDodgeChance(attr as ArmorAttribute) * 100);
              const guard = Math.round(getArmorGuardChance(attr as ArmorAttribute) * 100);
              const spd = getArmorSpeedText(attr as ArmorAttribute);
              const totalDef = (item.defense ?? 0) + (item.bonusDefense ?? 0);
              equipLogs.push(
                `🥋 ${gradeTagColored}${coloredName}: 방어력 +${totalDef}${
                  item.bonusDefense ? ` (기본 ${item.defense} + ${item.bonusDefense})` : ''
                } | 회피 ${dodge}% 자동방어 ${guard}% | 속도 ${spd}${affixSuffix}`
              );
            } else if (item.type === 'accessory') {
              const bonuses: string[] = [];
              if (item.bonusStr) bonuses.push(`STR +${item.bonusStr}`);
              if (item.bonusDex) bonuses.push(`DEX +${item.bonusDex}`);
              if (item.bonusCon) bonuses.push(`CON +${item.bonusCon}`);
              if (item.bonusInt) bonuses.push(`INT +${item.bonusInt}`);
              if (item.bonusSpr) bonuses.push(`SPR +${item.bonusSpr}`);
              if (item.elementDamage) {
                Object.entries(item.elementDamage).forEach(([el, val]) => {
                  if (val) bonuses.push(`${el} 데미지 +${val}`);
                });
              }
              if (item.elementResist) {
                Object.entries(item.elementResist).forEach(([el, val]) => {
                  if (val) bonuses.push(`${el} 레지스트 ${Math.round((val ?? 0) * 100)}%`);
                });
              }
              if (item.bonusCritChance) bonuses.push(`치명타 확률 +${Math.round(item.bonusCritChance * 100)}%p`);
              if (item.bonusAccuracy) bonuses.push(`명중률 +${Math.round((item.bonusAccuracy ?? 0) * 100)}%p`);
              const equippedTag =
                item.slot === 'ring' && ring1 && ring2 && ring1 === ring2 && instanceId === ring1
                  ? ' (장착중: 반지1·반지2 — 동일 인스턴스, 한쪽 해제 후 다시 장착 권장)'
                  : instanceId === ring1
                    ? ' (장착중: 반지1)'
                    : instanceId === ring2
                      ? ' (장착중: 반지2)'
                      : instanceId === necklace
                        ? ' (장착중: 목걸이)'
                        : '';
              const coloredAccName = colorizeItemName(baseForGrade, item.name, effectiveGrade ?? undefined);
              equipLogs.push(
                `💍 ${gradeTagColored}${coloredAccName}${equippedTag}: ${bonuses.join(', ') || '보너스 없음'}${affixSuffix}`
              );
            }
          });
          const footer =
            "\n('장착 [아이템명]'으로 장착 / '해제 [아이템명]'으로 해제 / 미확인은 '감정 [전체 이름]')";
          if (equipLogs.length === 1) {
            response = `[장비 확인]\n${equipLogs[0]}인벤토리에 장착 가능한 장비가 없습니다.${footer}`;
          } else {
            response = `[장비 확인]\n${equipLogs[0]}[보유 장비 능력치]\n${equipLogs.slice(1).join('\n')}${footer}`;
          }
        }
        } else if (['해제', '장비 해제'].includes(input) || input.startsWith('해제 ') || input.startsWith('장비 해제 ')) {
        // WHY: 장착한 장비를 벗을 수 있도록 해제 명령 지원. "해제 강철 장검" 또는 "장비 해제 강철 장검"
        const arg = (input === '해제' || input === '장비 해제')
          ? ''
          : input.startsWith('장비 해제 ')
            ? input.substring(8).trim()
            : input.startsWith('해제 ')
              ? input.substring(3).trim()
              : '';
        if (!arg) {
          const w = playerState.weapon; const o = playerState.offHand; const a = playerState.armor;
          const r1 = (playerState as any).ring1; const r2 = (playerState as any).ring2; const n = (playerState as any).necklace;
          const list: string[] = [];
          const ohDef = o ? getMergedEquippedItem(o, playerState.inventory) : null;
          if (w) list.push(`무기: ${formatEquipmentHudLine(w)}`);
          if (o) list.push(ohDef?.type === 'weapon' ? `보조손: ${formatEquipmentHudLine(o)} (쌍단검)` : `보조손: ${formatEquipmentHudLine(o)}`);
          if (a) list.push(`갑옷: ${formatEquipmentHudLine(a)}`);
          if (r1) list.push(`반지1: ${formatEquipmentHudLine(r1)}`);
          if (r2) list.push(`반지2: ${formatEquipmentHudLine(r2)}`);
          if (n) list.push(`목걸이: ${formatEquipmentHudLine(n)}`);
          response = list.length === 0
            ? '착용 중인 장비가 없습니다.'
            : `[착용 중]\n${list.join('\n')}\n\n해제할 장비명을 입력하세요. (예: 해제 ${w || '강철 장검'})`;
        } else {
          const name = arg;
          const inv = playerState.inventory;
          const slot =
            resolveSlotToItemName(playerState.weapon, inv) === name ? 'weapon' :
            resolveSlotToItemName(playerState.offHand, inv) === name ? 'offHand' :
            resolveSlotToItemName(playerState.armor, inv) === name ? 'armor' :
            resolveSlotToItemName((playerState as any).ring1, inv) === name ? 'ring1' :
            resolveSlotToItemName((playerState as any).ring2, inv) === name ? 'ring2' :
            resolveSlotToItemName((playerState as any).necklace, inv) === name ? 'necklace' : null;
          if (!slot) {
            response = `[${name}]은(는) 현재 착용 중인 장비가 아닙니다. (장비 확인으로 착용 목록 확인)`;
          } else {
            setPlayerState(p => {
              const next = { ...p } as any;
              next[slot] = null;
              const { maxHp, maxMp } = getEffectiveMaxHpMp(next);
              next.maxHp = maxHp;
              next.maxMp = maxMp;
              next.hp = Math.min(next.hp, maxHp);
              next.mp = Math.min(next.mp, maxMp);
              return next;
            });
            response = `✅ [${name}] 장비 해제했습니다.`;
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        }
      } else if (input.startsWith('감정 ') || input === '감정') {
        const arg = input === '감정' ? '' : input.slice(3).trim();
        if (!arg) {
          response =
            `감정할 미확인 장비의 전체 이름을 입력하세요. (예: 감정 미확인 무기·x7k2a)\n` +
            `조건: [${APPRAISAL_SCROLL_ITEM_NAME}] 1매 보유 시 어디서든 소모 감정, 또는 아이언 잭이 있는 곳(슬럼 상점가·컨베이어·하수 미로·심층 maze_* 등)에서 잭과 대화 후 ` +
            `${IRON_JACK_APPRAISAL_COST_COINS} C 유료 감정.`;
        } else {
          const candidates = playerState.inventory.filter(
            (r) =>
              r.identified === false &&
              r.mysteryItemId &&
              (r.name === arg || r.name.includes(arg) || r.id.endsWith(arg))
          );
          if (candidates.length === 0) {
            response = `미확인 장비를 찾지 못했습니다. (입력: "${arg}")`;
          } else if (candidates.length > 1) {
            response =
              `조건에 맞는 미확인 장비가 ${candidates.length}개입니다. 이름을 더 정확히 입력하세요.\n` +
              candidates.map((c) => `- ${c.name}`).join('\n');
          } else {
            const row = candidates[0];
            const base = row.mysteryItemId ? getItemById(row.mysteryItemId) : undefined;
            if (!base) {
              response = '데이터 오류: 베이스 장비를 찾을 수 없습니다.';
            } else {
              const hasScroll = playerState.inventory.some((r) => invName(r) === APPRAISAL_SCROLL_ITEM_NAME);
              const jackNpcOk =
                isIronJackServiceRoom(currentRoomId) && lastTalkedNpc === 'ironJack';
              const credit = playerState.credit || 0;
              if (!hasScroll && !jackNpcOk) {
                response =
                  `감정할 수 없습니다. [${APPRAISAL_SCROLL_ITEM_NAME}]을(를) 구비하거나, ` +
                  `아이언 잭이 지나는 구역(슬럼 상점가·미로 계열 등)에서 잭과 대화(거래)한 뒤 같은 명령으로 오세요. ` +
                  `(잭 수수료: ${IRON_JACK_APPRAISAL_COST_COINS} C / 스크롤은 잭 상점에서 구매)`;
              } else if (!hasScroll && jackNpcOk && credit < IRON_JACK_APPRAISAL_COST_COINS) {
                response =
                  `COIN이 부족합니다. (아이언 잭 감정: ${IRON_JACK_APPRAISAL_COST_COINS} C 필요, 보유 ${credit} C) ` +
                  `또는 [${APPRAISAL_SCROLL_ITEM_NAME}]을(를) 사용하세요.`;
              } else {
                const { lines, combatTags } = rollAppraisalAffixes(
                  base,
                  Math.random,
                  row.veilBlindSource ? { pool: 'veil' } : undefined
                );
                const usedScroll = hasScroll;
                const identifiedInstanceLevel = itemSupportsInstanceLevel(base)
                  ? rollItemLevelForDrop(playerState.level, Math.random)
                  : undefined;
                setPlayerState((p) => {
                  let nextInv = p.inventory.map((r) =>
                    r.id === row.id
                      ? {
                          ...r,
                          identified: true,
                          name: base.name,
                          mysteryItemId: undefined,
                          rolledAffixes: lines,
                          rolledCombatTags: combatTags.length ? combatTags : undefined,
                          veilBlindSource: undefined,
                          ...(identifiedInstanceLevel != null ? { itemLevel: identifiedInstanceLevel } : {}),
                        }
                      : r
                  );
                  let nextCredit = p.credit || 0;
                  if (usedScroll) {
                    const rm = nextInv.findIndex((r) => invName(r) === APPRAISAL_SCROLL_ITEM_NAME);
                    if (rm >= 0) nextInv = nextInv.filter((_, i) => i !== rm);
                  } else {
                    nextCredit -= IRON_JACK_APPRAISAL_COST_COINS;
                  }
                  return { ...p, inventory: nextInv, credit: nextCredit };
                });
                const linesStr = lines.map((l) => `  · ${l.labelKo}`).join('\n');
                const costLine = usedScroll
                  ? `${APPRAISAL_SCROLL_ITEM_NAME} 1매를 소모했습니다.`
                  : `아이언 잭에게 ${IRON_JACK_APPRAISAL_COST_COINS} C를 지불했습니다.`;
                const ilvLine =
                  identifiedInstanceLevel != null
                    ? `\n인스턴스 레벨: Lv.${identifiedInstanceLevel} (동일 이름 장비라도 피해·방어 수치가 달라질 수 있음)`
                    : '';
                response =
                  `🔍 감정 완료! (${costLine})\n실체: [${base.name}]${ilvLine}\n부가 옵션:\n${linesStr}\n(합산 스탯은 [장비 확인]·전투에 즉시 반영됩니다.)`;
                triggerEnemyTurn(activeEnemies, undefined, 'neutral');
              }
            }
          }
        }
      } else if (
        input === '룬' ||
        input === '룬 목록' ||
        input.startsWith('룬 ') ||
        input.startsWith('룬2 ') ||
        /^equip_rune2\s/i.test(input.trim()) ||
        /^equip_rune\s/i.test(input.trim())
      ) {
        const rawIn = input.trim();
        type RuneCmdMode = 'list' | 'off_pri' | 'off_sec' | 'off_all' | 'pri' | 'sec';
        let mode: RuneCmdMode = 'pri';
        let sub = '';

        if (rawIn === '룬' || rawIn === '룬 목록') {
          mode = 'list';
        } else if (rawIn === '룬 전체 해제' || rawIn === '룬 전부 해제') {
          mode = 'off_all';
        } else if (/^equip_rune2\s/i.test(rawIn)) {
          mode = 'sec';
          sub = rawIn.replace(/^equip_rune2\s*/i, '').trim();
        } else if (/^equip_rune\s/i.test(rawIn)) {
          mode = 'pri';
          sub = rawIn.replace(/^equip_rune\s*/i, '').trim();
        } else if (rawIn.startsWith('룬2 ')) {
          const rest = rawIn.slice(3).trim();
          if (rest === '해제') mode = 'off_sec';
          else if (rest.startsWith('장착')) {
            mode = 'sec';
            sub = rest.replace(/^장착\s*/, '').trim();
          }
        } else if (rawIn.startsWith('룬 ')) {
          const rest = rawIn.slice(2).trim();
          if (rest === '해제') mode = 'off_pri';
          else if (rest.startsWith('장착')) {
            mode = 'pri';
            sub = rest.replace(/^장착\s*/, '').trim();
          } else {
            mode = 'pri';
            sub = rest;
          }
        }

        const appendSynergy = (lines: string[], pId: string | null, sId: string | null) => {
          if (shouldAnnounceSynergyResonance(pId, sId)) lines.push(SYNERGY_RESONANCE_LINE);
          const flavor = formatBuildFlavorLog(loggedInChar?.job, pId, sId);
          if (flavor) lines.push(flavor);
        };

        if (mode === 'list') {
          const runeLvNote =
            playerState.level < RUNE_EQUIP_MIN_LEVEL
              ? `\n⚠ 룬 장착은 Lv.${RUNE_EQUIP_MIN_LEVEL} 이상부터 가능합니다. (해제는 언제나 가능)\n`
              : '';
          const buildN = estimateStrategicBuildCount(5, RUNE_DATA.length);
          const slotNote = `이론 빌드 조합(5직업×2슬롯·중복 제외 근사): ${buildN}가지+ — 시너지는 [룬 목록] 외 기획 문서(buildSystem.ts) 참고.`;
          response =
            '╔════════════ [ 룬 · NEURAL RUNE MATRIX ] ════════════╗\n' +
            RUNE_DATA.map((r) => `◇ ${r.displayName.padEnd(8, ' ')} │ ${r.passiveShort} │ 스킬:「${r.skillKo}」`).join('\n') +
            '\n╚════════════════════════════════════════════════════╝\n' +
            `[주: 룬 장착 ○○○ / equip_rune id] [보조: 룬2 장착 ○○○ / equip_rune2 id]\n` +
            `[룬 해제] 주만 · [룬2 해제] 보조만 · [룬 전체 해제]\n` +
            `${slotNote}${runeLvNote}`;
        } else if (mode === 'off_all') {
          const allOff = Player.clearAllRunes(playerState.skills);
          setPlayerState((p) => ({
            ...p,
            skills: allOff.skills,
            equippedRuneId: null,
            equippedRuneSecondaryId: null,
            equippedRuneQuality: 1,
            equippedRuneSecondaryQuality: 1,
            runeMarkTargetId: null,
          }));
          response = allOff.logLines.join('\n');
          triggerEnemyTurn(activeEnemies, undefined, 'neutral');
        } else if (mode === 'off_pri') {
          const rOff = Player.clearPrimaryRune(
            playerState.skills,
            playerState.equippedRuneId,
            playerState.equippedRuneSecondaryId ?? null,
          );
          setPlayerState((p) => ({
            ...p,
            skills: rOff.skills,
            equippedRuneId: rOff.equippedRuneId,
            equippedRuneSecondaryId: rOff.equippedRuneSecondaryId,
            equippedRuneQuality: 1,
            equippedRuneSecondaryQuality: rOff.equippedRuneSecondaryId
              ? pickBestInventoryRuneQualityForRuneId(p.inventory, rOff.equippedRuneSecondaryId as RuneId)
              : 1,
            runeMarkTargetId: null,
          }));
          response = rOff.logLines.join('\n');
          triggerEnemyTurn(activeEnemies, undefined, 'neutral');
        } else if (mode === 'off_sec') {
          const rOff = Player.clearSecondaryRune(
            playerState.skills,
            playerState.equippedRuneId,
            playerState.equippedRuneSecondaryId ?? null,
          );
          setPlayerState((p) => ({
            ...p,
            skills: rOff.skills,
            equippedRuneId: rOff.equippedRuneId,
            equippedRuneSecondaryId: rOff.equippedRuneSecondaryId,
            equippedRuneSecondaryQuality: 1,
            equippedRuneQuality: rOff.equippedRuneId
              ? pickBestInventoryRuneQualityForRuneId(p.inventory, rOff.equippedRuneId as RuneId)
              : 1,
          }));
          response = rOff.logLines.join('\n');
          triggerEnemyTurn(activeEnemies, undefined, 'neutral');
        } else if (mode === 'pri') {
          if (playerState.level < RUNE_EQUIP_MIN_LEVEL) {
            response = `⚠ 룬 장착은 Lv.${RUNE_EQUIP_MIN_LEVEL} 이상부터 가능합니다. (현재 Lv.${playerState.level})`;
          } else {
            const rEq = Player.equipPrimaryRune(
              playerState.skills,
              playerState.equippedRuneId,
              playerState.equippedRuneSecondaryId ?? null,
              sub,
            );
            if (rEq.logLines.some((l) => l.includes('알 수 없는 룬'))) {
              response = rEq.logLines.join('\n');
            } else {
              const lines = [...rEq.logLines];
              appendSynergy(lines, rEq.equippedRuneId, rEq.equippedRuneSecondaryId);
              const neon = rEq.equippedRuneId ? buildNeonRuneLog(rEq.equippedRuneId as RuneId, 'equip') : '';
              const qPri = rEq.equippedRuneId
                ? pickBestInventoryRuneQualityForRuneId(playerState.inventory, rEq.equippedRuneId as RuneId)
                : 1;
              const qSec = rEq.equippedRuneSecondaryId
                ? pickBestInventoryRuneQualityForRuneId(playerState.inventory, rEq.equippedRuneSecondaryId as RuneId)
                : 1;
              if (rEq.equippedRuneId) {
                const d0 = RUNES_BY_ID[rEq.equippedRuneId as RuneId];
                lines.push(
                  formatRuneEquipMetaLine(rEq.equippedRuneId as RuneId, qPri, loggedInChar?.job, d0.passiveShort),
                );
              }
              setPlayerState((p) => ({
                ...p,
                skills: rEq.skills,
                equippedRuneId: rEq.equippedRuneId,
                equippedRuneSecondaryId: rEq.equippedRuneSecondaryId,
                equippedRuneQuality: rEq.equippedRuneId ? qPri : 1,
                equippedRuneSecondaryQuality: rEq.equippedRuneSecondaryId ? qSec : 1,
              }));
              response = neon ? `${lines.join('\n')}${RUNE_LOG_SPLIT}${neon}` : lines.join('\n');
              triggerEnemyTurn(activeEnemies, undefined, 'neutral');
            }
          }
        } else if (mode === 'sec') {
          if (playerState.level < RUNE_EQUIP_MIN_LEVEL) {
            response = `⚠ 룬 장착은 Lv.${RUNE_EQUIP_MIN_LEVEL} 이상부터 가능합니다. (현재 Lv.${playerState.level})`;
          } else {
            const rEq = Player.equipSecondaryRune(
              playerState.skills,
              playerState.equippedRuneId,
              playerState.equippedRuneSecondaryId ?? null,
              sub,
            );
            if (rEq.logLines.some((l) => l.includes('알 수 없는 룬'))) {
              response = rEq.logLines.join('\n');
            } else {
              const lines = [...rEq.logLines];
              appendSynergy(lines, rEq.equippedRuneId, rEq.equippedRuneSecondaryId);
              const neon = rEq.equippedRuneSecondaryId
                ? buildNeonRuneLog(rEq.equippedRuneSecondaryId as RuneId, 'equip')
                : '';
              const qPri = rEq.equippedRuneId
                ? pickBestInventoryRuneQualityForRuneId(playerState.inventory, rEq.equippedRuneId as RuneId)
                : 1;
              const qSec = rEq.equippedRuneSecondaryId
                ? pickBestInventoryRuneQualityForRuneId(playerState.inventory, rEq.equippedRuneSecondaryId as RuneId)
                : 1;
              if (rEq.equippedRuneSecondaryId) {
                const d1 = RUNES_BY_ID[rEq.equippedRuneSecondaryId as RuneId];
                lines.push(
                  formatRuneEquipMetaLine(
                    rEq.equippedRuneSecondaryId as RuneId,
                    qSec,
                    loggedInChar?.job,
                    d1.passiveShort,
                  ),
                );
              }
              setPlayerState((p) => ({
                ...p,
                skills: rEq.skills,
                equippedRuneId: rEq.equippedRuneId,
                equippedRuneSecondaryId: rEq.equippedRuneSecondaryId,
                equippedRuneQuality: rEq.equippedRuneId ? qPri : 1,
                equippedRuneSecondaryQuality: rEq.equippedRuneSecondaryId ? qSec : 1,
              }));
              response = neon ? `${lines.join('\n')}${RUNE_LOG_SPLIT}${neon}` : lines.join('\n');
              triggerEnemyTurn(activeEnemies, undefined, 'neutral');
            }
          }
        }
      } else if (input.startsWith('장착 ')) {
        // 장착 명령: 기본 '장착 아이템명' + 확장 '장착 반지1/반지2 아이템명'
        const raw = input.substring(3).trim();
        let itemName = raw;
        let forceRingSlot: 1 | 2 | null = null;
        if (raw.startsWith('반지1 ')) {
          forceRingSlot = 1;
          itemName = raw.replace('반지1', '').trim();
        } else if (raw.startsWith('반지2 ')) {
          forceRingSlot = 2;
          itemName = raw.replace('반지2', '').trim();
        }
        let targetRow = playerState.inventory.find((r) => r.name === itemName);
        if (!targetRow || !inventoryHasItemName(playerState.inventory, itemName)) {
          response = `인벤토리에 [${itemName}]이(가) 없습니다.`;
        } else if (targetRow.identified === false) {
          response =
            `[${itemName}]은(는) 미확인 장비입니다. [${APPRAISAL_SCROLL_ITEM_NAME}] 또는 슬럼 상점가 아이언 잭(대화 후 유료)으로 감정하세요. (예: 감정 ${itemName})`;
        } else {
        const item = getItemByName(itemName);
        if (!item) {
          response = `[${itemName}]은(는) 장착 가능한 아이템이 아닙니다.`;
        } else {
          // 반지 행 미검출 시 여기서 return 하면 setTimeout 콜백이 끝나 로그 미반영 버그가 남
          let ringInventoryPickFailed = false;
          if (item.type === 'accessory' && item.slot === 'ring') {
            const rPicked = pickInventoryRowForRingEquip(playerState.inventory, itemName, {
              forceRingSlot,
              ring1: (playerState as { ring1?: string | null }).ring1 ?? null,
              ring2: (playerState as { ring2?: string | null }).ring2 ?? null,
            });
            if (!rPicked) {
              response = `인벤토리에 [${itemName}] 반지 행을 찾을 수 없습니다.`;
              ringInventoryPickFailed = true;
            } else {
              targetRow = rPicked;
            }
          }
          if (!ringInventoryPickFailed) {
          const instanceId = targetRow.id;
          if (item.type === 'weapon') {
          const reqMastery = item.requiredMastery ?? 0;
          const weaponClass = item.weaponClass;
          const currentLevel = weaponClass
            ? (playerState.weaponMasteryLevel?.[weaponClass] ?? expToLevel(playerState.weaponMasteryExp?.[weaponClass] ?? 0))
            : 0;
          if (reqMastery > 0 && currentLevel < reqMastery) {
            const label = weaponClass ? (WEAPON_CLASS_LABEL as Record<string, string>)[weaponClass] ?? weaponClass : '해당 무기';
            response = `[${item.name}]을(를) 착용하려면 ${label} 마스터리 Lv.${reqMastery} 이상이 필요합니다. (현재 Lv.${currentLevel})`;
          } else {
          const isThief = loggedInChar?.job === '도적';
          const isDagger = item.weaponClass === 'dagger';
          const currentWeapon = getMergedEquippedItem(playerState.weapon, playerState.inventory);
          const alreadyDagger = currentWeapon?.weaponClass === 'dagger';
          const isTwoHanded = item.weaponClass === 'greatsword';
          const greatswordMastery =
            playerState.weaponMasteryLevel?.['greatsword'] ??
            expToLevel(playerState.weaponMasteryExp?.['greatsword'] ?? 0);
          const shouldClearOffHandForTwoHanded = isTwoHanded && greatswordMastery < 10;

          if (isThief && isDagger && alreadyDagger && !isTwoHanded) {
            setPlayerState(p => {
              const upLv = (p.equipmentUpgradeLevels || {})[instanceId] || 0;
              const maxDur = 45 + upLv * 5;
              const nextDur = { ...(p.equipmentDurability || {}) };
              if (nextDur[instanceId] == null) nextDur[instanceId] = maxDur;
              const next = { ...p, offHand: instanceId };
              const { maxHp, maxMp } = getEffectiveMaxHpMp(next);
              next.maxHp = maxHp; next.maxMp = maxMp;
              next.hp = Math.min(next.hp, maxHp); next.mp = Math.min(next.mp, maxMp);
              return { ...next, equipmentDurability: nextDur };
            });
            response = `⚔⚔ [${itemName}] 보조손에 장착. (쌍단검 — 양손 단검)`;
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          } else if (isThief) {
            setPlayerState(p => {
              const upLv = (p.equipmentUpgradeLevels || {})[instanceId] || 0;
              const maxDur = 45 + upLv * 5;
              const nextDur = { ...(p.equipmentDurability || {}) };
              if (nextDur[instanceId] == null) nextDur[instanceId] = maxDur;
              const next = { ...p, weapon: instanceId, offHand: shouldClearOffHandForTwoHanded ? null : p.offHand };
              const { maxHp, maxMp } = getEffectiveMaxHpMp(next);
              next.maxHp = maxHp; next.maxMp = maxMp;
              next.hp = Math.min(next.hp, maxHp); next.mp = Math.min(next.mp, maxMp);
              return { ...next, equipmentDurability: nextDur };
            });
            response = isTwoHanded && shouldClearOffHandForTwoHanded
              ? `⚔ [${itemName}] 장착 완료. 양손이 모두 점유되어 보조손 장비가 해제됩니다. (양손검 마스터리 Lv.10 달성 시 방패를 함께 들 수 있습니다) (무기 공격력: ${item.minDamage}~${item.maxDamage})`
              : `⚔ [${itemName}] 장착 완료. (무기 공격력: ${item.minDamage}~${item.maxDamage})`;
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          } else {
            setPlayerState(p => {
              const upLv = (p.equipmentUpgradeLevels || {})[instanceId] || 0;
              const maxDur = 45 + upLv * 5;
              const nextDur = { ...(p.equipmentDurability || {}) };
              if (nextDur[instanceId] == null) nextDur[instanceId] = maxDur;
              const next = { ...p, weapon: instanceId, offHand: shouldClearOffHandForTwoHanded ? null : p.offHand };
              const { maxHp, maxMp } = getEffectiveMaxHpMp(next);
              next.maxHp = maxHp; next.maxMp = maxMp;
              next.hp = Math.min(next.hp, maxHp); next.mp = Math.min(next.mp, maxMp);
              return { ...next, equipmentDurability: nextDur };
            });
            response = isTwoHanded && shouldClearOffHandForTwoHanded
              ? `⚔ [${itemName}] 장착 완료. 양손이 모두 점유되어 보조손 장비가 해제됩니다. (양손검 마스터리 Lv.10 달성 시 방패를 함께 들 수 있습니다) (무기 공격력: ${item.minDamage}~${item.maxDamage})`
              : `⚔ [${itemName}] 장착 완료. (무기 공격력: ${item.minDamage}~${item.maxDamage})`;
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
          }
        } else if (item.type === 'shield') {
          const currentWeapon = getMergedEquippedItem(playerState.weapon, playerState.inventory);
          const greatswordMastery =
            playerState.weaponMasteryLevel?.['greatsword'] ??
            expToLevel(playerState.weaponMasteryExp?.['greatsword'] ?? 0);
          const canShieldWithGreatsword =
            currentWeapon?.weaponClass === 'greatsword' && greatswordMastery >= 10;

          if (currentWeapon?.weaponClass === 'greatsword' && !canShieldWithGreatsword) {
            response = '양손검을 착용한 상태에서는 (양손검 마스터리 Lv.10 미만 시) 보조손에 방패나 다른 장비를 들 수 없습니다.';
          } else {
            setPlayerState(p => {
              const upLv = (p.equipmentUpgradeLevels || {})[instanceId] || 0;
              const maxDur = 60 + upLv * 5;
              const nextDur = { ...(p.equipmentDurability || {}) };
              if (nextDur[instanceId] == null) nextDur[instanceId] = maxDur;
              const next = { ...p, offHand: instanceId };
              const { maxHp, maxMp } = getEffectiveMaxHpMp(next);
              next.maxHp = maxHp; next.maxMp = maxMp;
              next.hp = Math.min(next.hp, maxHp); next.mp = Math.min(next.mp, maxMp);
              return { ...next, equipmentDurability: nextDur };
            });
            response = `🛡 [${itemName}] 보조손에 장착. (방어력: ${(item.defense ?? 0) + (item.bonusDefense ?? 0)})`;
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (item.type === 'armor') {
          setPlayerState(p => {
            const upLv = (p.equipmentUpgradeLevels || {})[instanceId] || 0;
            const maxDur = 70 + upLv * 5;
            const nextDur = { ...(p.equipmentDurability || {}) };
            if (nextDur[instanceId] == null) nextDur[instanceId] = maxDur;
            const next = { ...p, armor: instanceId };
            const { maxHp, maxMp } = getEffectiveMaxHpMp(next);
            next.maxHp = maxHp; next.maxMp = maxMp;
            next.hp = Math.min(next.hp, maxHp); next.mp = Math.min(next.mp, maxMp);
            return { ...next, equipmentDurability: nextDur };
          });
          response = `🥋 [${itemName}] 착용 완료. (방어력: ${(item.defense ?? 0) + (item.bonusDefense ?? 0)})`;
          triggerEnemyTurn(activeEnemies, undefined, 'neutral');
        } else if (item.type === 'accessory') {
          if (item.slot === 'ring') {
            setPlayerState(p => {
              const upLv = (p.equipmentUpgradeLevels || {})[instanceId] || 0;
              const maxDur = 80 + upLv * 5;
              const nextDur = { ...(p.equipmentDurability || {}) };
              if (nextDur[instanceId] == null) nextDur[instanceId] = maxDur;
              const next = { ...p };
              // 명시 슬롯 장착(반지1/반지2)을 우선 처리
              if (forceRingSlot === 1) {
                next.ring1 = instanceId;
              } else if (forceRingSlot === 2) {
                next.ring2 = instanceId;
              } else {
                // 자동 장착: 비어 있는 슬롯 우선, 둘 다 차 있으면 반지1 교체
                if (!next.ring1) next.ring1 = instanceId;
                else if (!next.ring2) next.ring2 = instanceId;
                else next.ring1 = instanceId;
              }
              const { maxHp, maxMp } = getEffectiveMaxHpMp(next);
              next.maxHp = maxHp; next.maxMp = maxMp;
              next.hp = Math.min(next.hp, maxHp); next.mp = Math.min(next.mp, maxMp);
              return { ...next, equipmentDurability: nextDur };
            });
            if (forceRingSlot === 1) {
              response = `💍 [${itemName}] 반지1 슬롯에 장착했습니다.`;
            } else if (forceRingSlot === 2) {
              response = `💍 [${itemName}] 반지2 슬롯에 장착했습니다.`;
            } else {
              response = `💍 [${itemName}] 반지를 장착했습니다. (반지 슬롯 중 하나에 착용)`;
            }
              triggerEnemyTurn(activeEnemies, undefined, 'neutral');
            } else if (item.slot === 'necklace') {
              setPlayerState(p => {
                const upLv = (p.equipmentUpgradeLevels || {})[instanceId] || 0;
                const maxDur = 80 + upLv * 5;
                const nextDur = { ...(p.equipmentDurability || {}) };
                if (nextDur[instanceId] == null) nextDur[instanceId] = maxDur;
                const next = { ...p, necklace: instanceId, equipmentDurability: nextDur };
                const { maxHp, maxMp } = getEffectiveMaxHpMp(next);
                next.maxHp = maxHp; next.maxMp = maxMp;
                next.hp = Math.min(next.hp, maxHp); next.mp = Math.min(next.mp, maxMp);
                return next;
              });
              response = `📿 [${itemName}] 목걸이를 착용했습니다.`;
              triggerEnemyTurn(activeEnemies, undefined, 'neutral');
            } else {
              response = `[${itemName}]은(는) 장신구 타입이 올바르게 설정되어 있지 않습니다.`;
            }
        } else {
          response = `[${itemName}]은(는) 장착 불가입니다.`;
        }
          }
        }
        }
      } else if (input.startsWith('버리기 ')) {
        const dropName = input.slice('버리기 '.length).trim();
        if (!dropName) {
          response =
            '버릴 대상을 입력하세요.\n· 아이템 1개: 버리기 낡은 데이터 칩\n· 등급 일괄 판매(판매와 동일 · 아이언 잭 거래 중): 버리기 노멀 / 커먼 / 매직 (물약·스킬북·잡동사니·장착분 제외 · 레어·에픽 일괄 불가)';
        } else {
          const bulkDropGrade = parseBulkSellEquipmentGrade(dropName);
          if (bulkDropGrade !== null) {
            if (bulkDropGrade === 'rare' || bulkDropGrade === 'epic' || bulkDropGrade === 'legendary') {
              response = BULK_SELL_RARE_EPIC_NOT_ALLOWED_MSG;
            } else {
            const sellNpcInRoom =
              ROOM_SELL_NPC[currentRoomId] ?? (isIronJackServiceRoom(currentRoomId) ? 'ironJack' : undefined);
            const canSellWithIronJack = sellNpcInRoom === 'ironJack' || lastTalkedNpc === 'ironJack';
            if (!canSellWithIronJack) {
              if (lastTalkedNpc === 'jin') {
                response = `[마스터 진]\n"지식은 되팔 수 없는 법. 가치를 아는 다른 이를 찾아보아라."`;
              } else {
                response =
                  '등급 일괄 처리는 상인 거래와 같습니다. 아이언 잭이 있는 슬럼 상점가·미로 계열 방에서 대화 후 시도하세요. ([판매 노멀]과 동일 조건)';
              }
            } else {
              const toSell = collectInventoryRowsForBulkEquipmentGradeSell(
                {
                  inventory: playerState.inventory,
                  weapon: playerState.weapon,
                  armor: playerState.armor,
                  offHand: playerState.offHand,
                  ring1: (playerState as { ring1?: string | null }).ring1,
                  ring2: (playerState as { ring2?: string | null }).ring2,
                  necklace: (playerState as { necklace?: string | null }).necklace,
                  equipmentEffectiveGrade: playerState.equipmentEffectiveGrade,
                  equipmentUpgradeLevels: playerState.equipmentUpgradeLevels,
                },
                bulkDropGrade,
              );
              const gradeLabel = ITEM_GRADE_LABEL[bulkDropGrade];
              if (toSell.length === 0) {
                response = `[버리기 ${gradeLabel}] 일괄 판매 대상이 없습니다. (무기·갑옷·방패·반지·목걸이 중 「${gradeLabel}」만 · 강화 승급 반영된 현재 티어 · 장착 중 제외 · 물약·스킬북·잡동사니 제외)`;
              } else {
                const totalCredit = toSell.reduce((sum, row) => sum + getSellPriceForInventoryRow(row, LOOT_SELL_VALUES), 0);
                const sellIds = new Set(toSell.map((r) => r.id));
                setPlayerState((p) => ({
                  ...p,
                  credit: p.credit + totalCredit,
                  inventory: p.inventory.filter((row) => !sellIds.has(row.id)),
                }));
                response = `[버리기 ${gradeLabel} → 일괄 판매] ${toSell.length}개(무기·방어·악세) → ${totalCredit} 크레딧 (현재: ${playerState.credit + totalCredit} C)`;
              }
            }
            }
          } else if (!inventoryHasItemName(playerState.inventory, dropName)) {
            response = `인벤토리에 [${dropName}]이(가) 없습니다.`;
          } else {
            const equippedNames = [
              playerState.weapon,
              playerState.offHand,
              playerState.armor,
              (playerState as { ring1?: string | null }).ring1,
              (playerState as { ring2?: string | null }).ring2,
              (playerState as { necklace?: string | null }).necklace,
            ].filter(Boolean) as string[];
            const equippedCount = equippedNames.filter(
              (slot) => slot && resolveSlotToItemName(slot, playerState.inventory) === dropName
            ).length;
            const invCount = playerState.inventory.reduce(
              (s, row) => s + (invName(row) === dropName ? getInventoryStackQty(row) : 0),
              0,
            );
            if (equippedCount > 0 && invCount <= equippedCount) {
              response = `현재 [${dropName}]은(는) 장착 중인 것만 남아 있습니다. 먼저 해제한 뒤 버리세요.`;
            } else {
              setPlayerState((p) => ({
                ...p,
                inventory: removeOneFromInventoryByItemName(p.inventory, dropName),
              }));
              response = `🗑️ [${dropName}]을(를) 버렸습니다. (상점 판매 없음 · 크레딧 없음)`;
            }
          }
        }
      } else if (input.startsWith('사용 ')) {
        const item = input.substring(3).trim();
        if (!inventoryHasItemName(playerState.inventory, item)) {
          response = `인벤토리에 [${item}]이(가) 없습니다.`;
        } else if (item.includes('포션')||item.includes('붕대')||item.includes('라멘')) {
          let hpHeal = 0;
          let mpHeal = 0;

          // HP 회복류 (풀 포션 = 전부 회복, 그 외는 수치만)
          if (item.includes('풀 포션')) {
            hpHeal = 9999; // 전부 회복이므로 maxHp 상한으로 min 적용됨
          } else if (item.includes('빨간 포션')) {
            hpHeal = 30;
          } else if (item.includes('붕대')) {
            hpHeal = 20;
          } else if (item.includes('라멘')) {
            hpHeal = 15;
          }

          // MP 회복류 (파란 포션 계열)
          if (item.includes('파란 포션')) {
            if (item.includes('작은')) mpHeal = 20;
            else if (item.includes('대형')) mpHeal = 80;
            else mpHeal = 40; // 기본 파란 포션
          }

          const potMult = playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'alchemist')
            ? 1 +
              0.35 *
                getRuneScaleForPassive(
                  'alchemist',
                  playerState.equippedRuneId,
                  playerState.equippedRuneSecondaryId,
                  playerState.equippedRuneQuality ?? 1,
                  playerState.equippedRuneSecondaryQuality ?? 1,
                  loggedInChar?.job,
                )
            : 1;
          hpHeal = Math.round(hpHeal * potMult);
          mpHeal = Math.round(mpHeal * potMult);

          setPlayerState(p => ({
            ...p,
            hp: Math.min(p.maxHp, p.hp + hpHeal),
            mp: Math.min(p.maxMp, p.mp + mpHeal),
            inventory: removeOneFromInventoryByItemName(p.inventory, item),
          }));

          const effects: string[] = [];
          if (hpHeal > 0) effects.push(`HP +${hpHeal}`);
          if (mpHeal > 0) effects.push(`MP +${mpHeal}`);
          response = `💊 [${item}] 사용. ${effects.join(' / ') || '효과 없음'}`;
          triggerEnemyTurn(activeEnemies, undefined, 'neutral');
        } else if (item.includes('스킬북')) {
          const SKILLBOOK_MAP: Record<string, { skill: string; desc: string }> = {
            '파이어볼 스킬북':         { skill: '파이어볼',         desc: 'MP 15 | 광역 화염 피해' },
            '파워 스트라이크 스킬북':  { skill: '파워 스트라이크',  desc: 'MP 10 | ATK ×2 강타' },
            '회복의 빛 스킬북':        { skill: '회복의 빛',        desc: 'MP 15 | HP +40 회복' },
            '음파 폭발 스킬북':        { skill: '음파 폭발',        desc: 'MP 20 | 전체 적 ATK×1.5 대미지' },
            '사이버 클로 스킬북':      { skill: '사이버 클로',      desc: 'MP 12 | 3회 연속 타격 (ATK×0.7 ×3)' },
            '의지의 방어막 스킬북':    { skill: '의지의 방어막',    desc: 'MP 20 | 2턴간 피해 50% 감소' },
            '데이터 도둑 스킬북':      { skill: '데이터 도둑',      desc: 'MP 8 | 적 DEF 5 감소 + 소량 피해' },
          };
          const def = SKILLBOOK_MAP[item];
          if (!def) {
            response = `[${item}]은(는) 알 수 없는 스킬북입니다.`;
          } else if (playerState.skills.includes(def.skill)) {
            response = `이미 [${def.skill}] 스킬을 알고 있습니다.`;
          } else {
            setPlayerState(p => {
              const idx = p.inventory.findIndex((row) => invName(row) === item);
              return {
                ...p,
                skills: [...p.skills, def.skill],
                inventory: idx >= 0 ? p.inventory.filter((_, i) => i !== idx) : p.inventory,
              };
            });
            response = `✨ [${item}]${getObjectParticle(item)} 획득했습니다!\n⚡ 스킬 [${def.skill}] 해금됨!\n   └ ${def.desc}\n'스킬 ${def.skill}' 명령으로 발동!`;
          }
        } else if (item === APPRAISAL_SCROLL_ITEM_NAME) {
          response =
            `[${APPRAISAL_SCROLL_ITEM_NAME}]은(는) 여기서 직접 쓰는 물건이 아닙니다. ` +
            `미확인 장비를 골라 '감정 [미확인 장비 전체 이름]'을 입력하면 자동으로 1매가 소모됩니다.`;
        } else {
          response = `[${item}]은(는) 사용 불가입니다.`;
        }
      } else if (input === '스탯') {
        response = '[스탯 기능 안내]\n각 스탯이 전투·회피·HP/MP에 어떤 영향을 주는지 확인할 수 있습니다.\n입력 예: 스탯 힘 / 스탯 민첩 / 스탯 체력 / 스탯 지능 / 스탯 정신\n(영문: 스탯 STR, 스탯 DEX 등도 가능)';
      } else if (input.startsWith('스탯 ')) {
        const statName = input.substring(3).trim();
        if (statName === '힘' || statName.toUpperCase() === 'STR') {
          response = `[스탯: 힘(STR)]\n근력과 파괴력의 상징입니다.\n- 모든 무기의 최대 데미지가 상승합니다.\n- 단검 등 피어싱 무기류의 최소 데미지도 함께 상승합니다.\n- 전투 중 물리 관통력 및 피해 판정에 크게 기여합니다.\n- 강철의 반지처럼 STR을 올려주는 장신구를 착용하면 ATK/스킬 데미지가 함께 증가합니다.`;
        } else if (statName === '민첩' || statName.toUpperCase() === 'DEX') {
          response = `[스탯: 민첩(DEX)]\n반사신경과 정밀도를 나타냅니다.\n- 기본 회피율이 상승합니다.\n- 단검 등 피어싱 무기의 최대 데미지가 크게 상승합니다.\n- 도검, 둔기 등의 최소 데미지도 끌어올려 안정적인 타격을 돕습니다.\n- 민첩의 반지를 착용하면 회피율과 일부 물리 스킬(스나이프, 급소 찌르기 등)의 위력이 크게 오릅니다.`;
        } else if (statName === '체력' || statName.toUpperCase() === 'CON') {
          response = `[스탯: 체력(CON)]\n생명력과 맷집의 척도입니다.\n- 레벨 업 시, 최대 HP가 큰 폭으로 상승합니다.\n- 받는 물리 피해를 부가적으로 깎아주는 방어 보너스를 획득합니다.\n- 체력 보너스를 가진 갑옷/반지는 DEF와 실질 생존력을 함께 끌어올립니다.`;
        } else if (statName === '지능' || statName.toUpperCase() === 'INT') {
          response = `[스탯: 지능(INT)]\n연산 능력과 마법적 파괴력의 핵심입니다.\n- 파이어볼, 라이트닝 볼트 등 마법 스킬의 최대 피해량이 크게 상승합니다.\n- 최대 MP를 상승시켜 스킬 난사를 돕습니다.\n- 마력의 목걸이처럼 INT를 올려주는 장신구는 모든 마법 공격 스킬의 화력을 강화합니다.`;
        } else if (statName === '정신' || statName.toUpperCase() === 'SPR') {
          response = `[스탯: 정신(SPR)]\n의지력과 마나의 안정성, 그리고 이 세계관에서는 신앙심을 나타냅니다.\n- 마법 공격의 최소 피해량을 크게 높여줘 마법의 위력을 안정화시킵니다.\n- 최대 MP 상승 및 보호막, 치유·축복 등 신성 스킬에서 혜택을 줍니다.\n- SPR 보너스가 있는 장신구는 힐/보호막/보조 스킬의 안정성과 효율을 크게 높여줍니다.`;
        } else {
          response = `[${statName}]에 대한 스탯 정보가 존재하지 않습니다. (가능: 힘, 민첩, 체력, 지능, 정신)`;
        }
        } else if (/^(공격|어택)(\s*\d*)?$/.test(input.trim())) {
        if (!playerState.isCombat || activeEnemies.length === 0) {
          response = '현재 전투 중이 아닙니다.';
        } else {
          // "공격 2" / "공격2" → 2번째 몬스터(1-based), 미지정 시 1번째
          const numMatch = input.trim().match(/^(공격|어택)\s*(\d+)$/);
          const targetOneBased = numMatch ? parseInt(numMatch[2], 10) : 1;
          const targetIndex = targetOneBased - 1; // 0-based
          if (targetOneBased < 1 || targetOneBased > activeEnemies.length) {
            const list = activeEnemies.map((e, i) => `${i + 1}: [${e.name}] HP ${e.currentHp}/${e.maxHp}`).join('\n');
            response = `대상 번호가 올바르지 않습니다. (1~${activeEnemies.length} 중 선택)\n${list}\n예: 공격 2`;
          } else {
          const target = activeEnemies[targetIndex];
          const targetDisplayName = formatEnemyName(target);
          const hitChance = Math.min(0.95, 0.8 + (effAtk / 500) + (effAccuracy ?? 0));
          if (Math.random() > hitChance) {
            response = `💨 공격이 빗나갔습니다! (명중률: ${Math.round(hitChance*100)}%) [대상: ${targetDisplayName}]`;
            triggerEnemyTurn(activeEnemies);
          } else {
            // 파손 무기면 공격 불가(빈손 공격 방지) — 수리로 복구 유도
            if (isBroken(playerState.weapon || '')) {
              const w = resolveSlotToItemName(playerState.weapon, playerState.inventory) || '무기';
              response = `💥 [${w}]이(가) 파손되어 제대로 공격할 수 없습니다. 안전지대에서 '수리 무기'를 사용하세요.`;
              triggerEnemyTurn(activeEnemies);
            } else {
            // WHY: 이전에 여기서 `return`으로 setTimeout 콜백 전체를 빠져나가 맨 아래 setLogs가 실행되지 않아
            //      로그에 결과가 안 찍히고 입력만 쌓이는 버그가 있었다.
            let attackAbortedEarly = false;
            const weapon = getMergedEquippedItem(playerState.weapon, playerState.inventory);
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const minWeaponDmg = weapon?.minDamage ?? 1;
            const maxWeaponDmg = weapon?.maxDamage ?? 3;
            const weaponAttr = getPlayerWeaponAttr();
            const attrModifier = getDamageModifier(weaponAttr, target.armorAttr);
            const wpPenalty = getWeaponPenalty();

            // 힘(STR): 무기 최대 데미지 증가 (전체), 피어싱 무기류의 최소 데미지 증가
            // 민첩(DEX): 피어싱 무기류 최대 데미지 증가, 피어싱 외 무기류의 최소 데미지 증가
            let finalMin = minWeaponDmg;
            let finalMax = maxWeaponDmg;

            if (weaponAttr === '피어싱') {
              // 활·단검: 민첩이 최소/최대 데미지 모두 끌어올림 — DEX 투자 체감 확대
              finalMin += Math.floor((effStr || 10) * 0.25) + Math.floor((effDex || 10) * 0.25);
              finalMax += Math.floor((effDex || 10) * 0.65);
            } else if (weaponAttr === '마법') {
              finalMin += Math.floor((effSpr || 10) * 0.5);
              finalMax += Math.floor((effInt || 10) * 0.8);
            } else {
               // 슬러시/크러시 계열: STR이 최대, DEX가 최소 보정
              finalMin += Math.floor((effDex || 10) * 0.3);
              finalMax += Math.floor((effStr || 10) * 0.6);
            }

            // 장비 강화 보너스 (플러스·티어)
            const wNmAtk = resolveInstanceIdForSlot(playerState.weapon, playerState.inventory) ?? playerState.weapon ?? '';
            const wEnAtk = weapon
              ? resolveEquipmentEnchant(wNmAtk, weapon, playerState.equipmentEffectiveGrade, playerState.equipmentUpgradeLevels)
              : { tier: 'common' as ItemGrade, plus: 0 };
            const wAtkBonusAtk = getEnchantStatBonusFromTierPlus(wEnAtk.tier, wEnAtk.plus);
            finalMin += wAtkBonusAtk;
            finalMax += wAtkBonusAtk;

            // 데미지 폭 보정 (최소가 최대보다 커지지 않도록)
            if (finalMin > finalMax) finalMin = finalMax;

            // 방어력 관통: 피어싱(활·단검)은 DEX, 그 외는 STR로 관통 판정 — 민첩형이 방어 높은 적도 뚫도록
            const penetrationStat = weaponAttr === '피어싱' ? (effDex || effStr) : effStr;
            const defFactor = (100 + penetrationStat) / (100 + effectiveEnemyDefForPhysical(target));

            // 대검(greatsword): 30% 확률로 적에게 먼저 공격 허용 (공격 속도 느림)
            let initiativeLog = '';
            let currentEnemyHp = target.currentHp;

            if (weapon?.weaponClass === 'greatsword' && Math.random() < 0.3) {
              initiativeLog = `\n🐢 대검의 느린 공격 속도로 인해 [${target.name}]이(가) 먼저 반격합니다!`;
              const enemyBaseDmg = (target.atk * 0.8) + target.weaponDmg;
              const conDefBonus = Math.floor(effCon * 0.5);
              const playerArmor = isBroken(playerState.armor || '') ? null : getMergedEquippedItem(playerState.armor, playerState.inventory);
              const offHandForDef = isBroken(playerState.offHand || '') ? null : getMergedEquippedItem(playerState.offHand, playerState.inventory);
              const playerShield = offHandForDef?.type === 'shield' ? offHandForDef : null;
              const arNmGs = resolveInstanceIdForSlot(playerState.armor, playerState.inventory) ?? playerState.armor ?? '';
              const ohNmGs = resolveInstanceIdForSlot(playerState.offHand, playerState.inventory) ?? playerState.offHand ?? '';
              const armorEnGs = playerArmor
                ? resolveEquipmentEnchant(arNmGs, playerArmor, playerState.equipmentEffectiveGrade, playerState.equipmentUpgradeLevels)
                : { tier: 'common' as ItemGrade, plus: 0 };
              const shieldEnGs = playerShield
                ? resolveEquipmentEnchant(ohNmGs, playerShield, playerState.equipmentEffectiveGrade, playerState.equipmentUpgradeLevels)
                : { tier: 'common' as ItemGrade, plus: 0 };
              const armorDef =
                (playerArmor?.defense ?? 0) +
                (playerArmor?.bonusDefense ?? 0) +
                getEnchantStatBonusFromTierPlus(armorEnGs.tier, armorEnGs.plus);
              const shieldDef =
                (playerShield?.defense ?? 0) +
                (playerShield?.bonusDefense ?? 0) +
                getEnchantStatBonusFromTierPlus(shieldEnGs.tier, shieldEnGs.plus);
              const totalPlayerDef = playerState.def + armorDef + shieldDef + conDefBonus;
              const enemyDefFactor = (100 + target.str) / (100 + totalPlayerDef);
              const enemyModifier = getDamageModifier(target.weaponAttr, getPlayerArmorAttr());
            const enemyDmg = Math.max(1, Math.round(enemyBaseDmg * enemyDefFactor * enemyModifier * getRageDefenseMultiplier()));

              const newPlayerHp = playerState.hp - enemyDmg;
              if (newPlayerHp <= 0) {
                 initiativeLog += `\n💥 [${target.name}]의 치명적인 선제 공격! 피해: ${enemyDmg}`;
                 const killerBaseId = target.id.replace(/_ambush$/, '').replace(/_?\d+$/, '');
                 const curGrowth = playerState.enemyGrowth?.[killerBaseId] ?? { exp: 0, level: 0 };
                 const newExp = curGrowth.exp + ENEMY_GROWTH_EXP_PER_KILL;
                 const newLevel = getEnemyGrowthLevel(newExp);
                 const growthLog =
                   newLevel > curGrowth.level
                     ? `\n[${target.name}]이(가) 경험치를 흡수했다! (Lv.${newLevel}로 성장!)`
                     : '';
                 const coinLossPercent = 0.05 + Math.random() * 0.15;
                 const lostCoin = Math.floor((playerState.credit || 0) * coinLossPercent);
                 const respawnRoomId = playerState.respawnRoomId || STARTING_ROOM_ID;

                 // WHY: 기존 코드는 HP만 0·비전투로 두고 리스폰/오버레이를 건너뛰어 "유령 상태"가 됨.
                 //      적 턴 사망 처리와 동일한 오버레이 → 안전지대 부활 흐름을 맞춘다.
                 suppressInvadedSafeLiberationRef.current = true;
                 setPlayerState(p => ({ ...p, hp: 0 }));
                 playSoundDeath();
                 setTimeout(() => {
                   setPlayerState(p => ({
                     ...p,
                     enemyGrowth: { ...(p.enemyGrowth ?? {}), [killerBaseId]: { exp: newExp, level: newLevel } },
                   }));
                   setLogs(logs => {
                     const flatlineBanner = `\n╔══════════════════════════════════╗\n║  ☠  Y O U   A R E   D E A D  ☠  ║\n║     << F L A T L I N E D >>      ║\n╚══════════════════════════════════╝`;
                     return [
                       ...logs,
                       `💥 치명상! [${target.name}]의 선제 일격에 쓰러졌습니다...${flatlineBanner}${growthLog}`,
                     ];
                   });
                   setShowDeathOverlay(true);
                 }, 150);
                 const deathOverlayMs = 2500;
                 setTimeout(() => {
                   setShowDeathOverlay(false);
                   stealthTurnsRef.current = 0;
                   suppressInvadedSafeLiberationRef.current = true;
                   let diedWithSoulBinder2 = false;
                   setPlayerState(p => {
                     diedWithSoulBinder2 = playerHasRune(p.equippedRuneId, p.equippedRuneSecondaryId, 'soul_binder');
                     const lostExp = diedWithSoulBinder2 ? 0 : Math.floor(p.exp * 0.2);
                     return {
                       ...p,
                       isCombat: false,
                       stealthTurnsLeft: 0,
                       hp: 5,
                       exp: Math.max(0, p.exp - lostExp),
                       credit: Math.max(0, (p.credit || 0) - lostCoin),
                     };
                   });
                   setCurrentRoomId(respawnRoomId);
                   setActiveEnemies([]);
                   setSceneImage(resolveRoomSceneImage(getRoomById(respawnRoomId)));
                   const safeRoom = getRoomById(respawnRoomId);
                   setLogs(logs => [
                     ...logs,
                     diedWithSoulBinder2
                       ? `(안전지대 [${safeRoom?.name || '시작 지점'}]에서 눈을 떴습니다. 영혼결속 룬이 경험치를 지켜 주었습니다. ${lostCoin} COIN을 잃었습니다.)`
                       : `(안전지대 [${safeRoom?.name || '시작 지점'}]에서 눈을 떴습니다. 경험치 20%와 ${lostCoin} COIN을 잃었습니다.)`,
                   ]);
                   setRage(0);
                 }, 150 + deathOverlayMs);
                 response = `[선제공격 발생]${initiativeLog}\n💀 눈앞이 어두워집니다...`;
                 attackAbortedEarly = true;
              } else {
                 initiativeLog += `\n💥 [${target.name}]의 선제 공격! 피해: ${enemyDmg} (남은 HP: ${newPlayerHp})`;
                 setPlayerState(p => ({ ...p, hp: newPlayerHp }));
                 if (Math.random() < 0.22) damageDurability(playerState.armor, 1, '선제공격(피격)');
                 if (Math.random() < 0.12) damageDurability(playerState.offHand, 1, '선제공격(피격)');
              }
            }

            if (!attackAbortedEarly) {
            /** 지팡이 착용 마법사 평타 = 파이어 볼트(불) — 적 불 저항에 따라 최종 피해 배율 */
            const isMageFireBoltBasic =
              loggedInChar?.job === '마법사' && isMageStaffEquippedForCasting();
            let fireBoltFactorForLog: number | null = null;
            const slaughterSynergy = hasRunePair(
              playerState.equippedRuneId,
              playerState.equippedRuneSecondaryId,
              'berserker',
              'gladiator',
            );
            const bloodSlaughter =
              slaughterSynergy &&
              playerState.maxHp > 0 &&
              playerState.hp / playerState.maxHp <= 0.2;
            // 단검(dagger): 공격 속도가 빨라 30% 확률로 3타, 30% 확률로 2타, 40% 확률로 1타. 도적 쌍단검 시 보조손 1타 추가.
            let hits = 1;
            if (weapon?.weaponClass === 'dagger') {
               const r = Math.random();
               let swiftBoost = optionFx.swiftExtraHitChance;
               if (slaughterSynergy) swiftBoost *= 1.5;
               // 신속 옵션이 있으면 2~3타 확률이 약간 상승
               if (r < 0.3 + swiftBoost) hits = 3;
               else if (r < 0.6 + swiftBoost) hits = 2;
            } else if (weapon?.weaponClass === 'bow') {
              // 활: 민첩이 높을수록 가끔 2연사 — DEX 35부터 시작, 80 근처에서 약 50% 확률
              let dexExtra = optionFx.swiftExtraHitChance;
              if (slaughterSynergy) dexExtra *= 1.5;
              const dexDoubleChance = Math.min(0.5, Math.max(0, ((effDex || 0) - 35) / 90) + dexExtra);
              if (Math.random() < dexDoubleChance) hits = 2;
            }
            const offHandWeapon = getMergedEquippedItem(playerState.offHand, playerState.inventory);
            const isDualWieldDagger = loggedInChar?.job === '도적' && weapon?.weaponClass === 'dagger' && offHandWeapon?.type === 'weapon' && offHandWeapon?.weaponClass === 'dagger';
            if (isDualWieldDagger) hits += 1; // 보조손 단검 1타 추가

            let totalDmg = 0;
            const hitLogs: string[] = [];
            let isCritFinal = false;
            const hitParts: HitPart[] = [];
            const hadMarkAtStart = !!target.warriorMarkActive;
            let markConsumedThisAttack = false;

            for (let i = 0; i < hits; i++) {
              // 마지막 타가 쌍단검 보조손일 때는 보조 무기 데미지 사용
              const useOffHand = isDualWieldDagger && i === hits - 1;
              const wMin = useOffHand ? (offHandWeapon?.minDamage ?? 1) : finalMin;
              const wMax = useOffHand ? (offHandWeapon?.maxDamage ?? 3) : finalMax;
              const offHandAdjustedMin = useOffHand ? wMin + Math.floor((effStr || 10) * 0.25) + Math.floor((effDex || 10) * 0.25) : wMin;
              const offHandAdjustedMax = useOffHand ? wMax + Math.floor((effDex || 10) * 0.65) : wMax;
              const rollMin = useOffHand ? Math.min(offHandAdjustedMin, offHandAdjustedMax) : finalMin;
              const rollMax = useOffHand ? Math.max(offHandAdjustedMin, offHandAdjustedMax) : finalMax;

              const rolledWeaponDmg = Math.floor(Math.random() * (rollMax - rollMin + 1)) + rollMin;
              const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
              const hitCrit = bloodSlaughter || Math.random() < critChance;
              if (hitCrit) isCritFinal = true;

              const critMult = hitCrit ? effPhysCritMult : 1.0;
              const randMult = 0.9 + Math.random() * 0.2;
              // WHY: 표시 ATK(effAtk) = 기본+STR+DEX+무기+마스터리. 이걸 써야 민첩/힘 투자가 실제 데미지에 반영됨.
              const basePart = (effAtk * randMult * critMult) + rolledWeaponDmg;
              const normalScale = weaponAttr === '피어싱' ? NORMAL_ATTACK_DAMAGE_SCALE * PIERCING_NORMAL_SCALE : NORMAL_ATTACK_DAMAGE_SCALE;

              let singleDmg = Math.max(1, Math.round(basePart * defFactor * attrModifier * wpPenalty * normalScale * getRageAttackMultiplier() * optionFx.damageMult));
              if (isMageFireBoltBasic) {
                const fr = getEnemyFireResistForDamage(target);
                const ff = getFireDamageFactorFromResist(fr);
                fireBoltFactorForLog = ff;
                singleDmg = Math.max(1, Math.round(singleDmg * ff));
              }
              // 왼손(보조손)은 오른손보다 데미지 하향 — 75% 적용
              if (useOffHand) singleDmg = Math.max(1, Math.round(singleDmg * 0.75));
              if (playerState.runeMarkTargetId && target.id === playerState.runeMarkTargetId) {
                singleDmg = Math.max(1, Math.round(singleDmg * 1.15));
              }
              if (hadMarkAtStart && !markConsumedThisAttack) {
                singleDmg = applyWarriorMarkPhysicalDamage(target, singleDmg);
                markConsumedThisAttack = true;
              }
              totalDmg += singleDmg;
              const part = pickHitPart();
              hitParts.push(part);
              hitLogs.push(`${part}:${singleDmg}${hitCrit ? '!' : ''}${useOffHand ? '(보)' : ''}`);
            }
            const equipForElem = [
              weapon,
              offHandWeapon,
              getMergedEquippedItem((playerState as any).ring1, playerState.inventory),
              getMergedEquippedItem((playerState as any).ring2, playerState.inventory),
              getMergedEquippedItem((playerState as any).necklace, playerState.inventory),
            ].filter(Boolean) as import('./data/items').ItemData[];
            const flatElementDmg = equipForElem.reduce((sum, it) => {
              if (!it?.elementDamage) return sum;
              return sum + Object.values(it.elementDamage).reduce((a, b) => a + (b ?? 0), 0);
            }, 0);
            if (flatElementDmg > 0) totalDmg += flatElementDmg;

            if ((playerState.runeSkeletonAllyStrikes ?? 0) > 0 && totalDmg > 0) {
              let skelBonus = Math.max(5, Math.round(effAtk * 0.15));
              if (
                playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'necromancer') &&
                isGuildTerritoryRoom(currentRoomId)
              ) {
                skelBonus = Math.round(skelBonus * 1.5);
              }
              totalDmg += skelBonus;
            }
            if (playerState.runeNextDamageMult != null && playerState.runeNextDamageMult > 0 && totalDmg > 0) {
              totalDmg = Math.max(1, Math.round(totalDmg * playerState.runeNextDamageMult));
            }

            // 내구도 감소: 전투가 반복되면 장비 관리가 필요하도록 "완만하게"만 감소시킨다.
            if (Math.random() < 0.22) damageDurability(playerState.weapon, 1, '전투');
            if (isDualWieldDagger && Math.random() < 0.16) damageDurability(playerState.offHand, 1, '전투(쌍단검)');

            // 단검 흡혈 옵션: 메인/보조손 무기 lifeStealPercent가 있으면 가한 피해의 일부만큼 HP 회복
            let lifeStealLog = '';
            const lifeStealPct = (weapon?.lifeStealPercent ?? 0) + (offHandWeapon?.lifeStealPercent ?? 0);
            if (lifeStealPct > 0 && totalDmg > 0) {
              const healAmount = Math.max(1, Math.round(totalDmg * lifeStealPct));
              setPlayerState(p => ({
                ...p,
                hp: Math.min(p.maxHp, p.hp + healAmount),
              }));
              lifeStealLog = `\n🩸 흡혈 효과 발동! HP +${healAmount}`;
            }

            const skConsume = (playerState.runeSkeletonAllyStrikes ?? 0) > 0 && totalDmg > 0;
            const ndmClear = playerState.runeNextDamageMult != null && playerState.runeNextDamageMult > 0 && totalDmg > 0;
            if (skConsume || ndmClear) {
              setPlayerState(p => ({
                ...p,
                runeSkeletonAllyStrikes: skConsume
                  ? Math.max(0, (p.runeSkeletonAllyStrikes ?? 0) - 1)
                  : p.runeSkeletonAllyStrikes,
                runeNextDamageMult: ndmClear ? null : p.runeNextDamageMult,
              }));
            }

            currentEnemyHp -= totalDmg;

            // 무기 마스터리 경험치 (해당 무기 계열로 공격 시 증가)
            const wc = weapon?.weaponClass;
            if (wc) {
              const prevExp = playerState.weaponMasteryExp?.[wc] ?? 0;
              const prevLevel = playerState.weaponMasteryLevel?.[wc] ?? expToLevel(prevExp);
              const newExp = prevExp + MASTERY_EXP_PER_HIT;
              const newLevel = expToLevel(newExp);
              setPlayerState(p => ({
                ...p,
                weaponMasteryExp: { ...(p.weaponMasteryExp || {}), [wc]: newExp },
                weaponMasteryLevel: { ...(p.weaponMasteryLevel || {}), [wc]: newLevel },
              }));
              if (newLevel > prevLevel) {
                const label = (WEAPON_CLASS_LABEL as Record<string, string>)[wc] ?? wc;
                setLogs(prev => [...prev, `📈 [마스터리] ${label} 마스터리 Lv.${newLevel} 달성!`]);
              }
            }

            if (weaponAttr === '마법') playSoundMagic();
            else if (weaponAttr === '피어싱') playSoundPierce();
            else if (weaponAttr === '슬러시') playSoundSlash();
            else playSoundCrush();

              const mageBoltPrefix = isMageFireBoltBasic ? '🔥 [파이어 볼트] ' : '';
              const attackDesc = hits > 1
              ? (weapon?.weaponClass === 'bow'
                ? `🏹 활의 2연사! (${hitLogs.join(' + ')} = 《피해 ${totalDmg}》)`
                : `💨 단검의 연속 공격! (${hits}연타: ${hitLogs.join(' + ')} = 《피해 ${totalDmg}》)`)
              : `${isCritFinal ? '💥 크리티컬! ' : ''}${mageBoltPrefix}${isMageFireBoltBasic ? '' : '⚔ ' }▶ 《피해 ${totalDmg}》`;

            // 무기 독 옵션: 확률로 중독 부여 (3턴 DoT)
            const poisonChance = weapon?.poisonChance ?? 0;
            const poisonProc = currentEnemyHp > 0 && poisonChance > 0 && Math.random() < poisonChance;
            // 패시브 '원소의 손길': 5% 확률로 화상 2턴 부여
            const burnProc = currentEnemyHp > 0 && (playerState.passiveSkills || []).includes('elemental_touch') && Math.random() < 0.05;
            const fireBoltBurnProc =
              isMageFireBoltBasic && currentEnemyHp > 0 && !burnProc && Math.random() < 0.2;
            const fireBoltLogSuffix =
              isMageFireBoltBasic && fireBoltFactorForLog != null
                ? `, 불 피해 ×${fireBoltFactorForLog.toFixed(2)}`
                : '';

            if (currentEnemyHp <= 0) {
              const initText = initiativeLog ? initiativeLog + '\n' : '';
              const critFlavor = isCritFinal ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = handleEnemiesDefeat(
                [target],
                `${initText}${attackDesc}${lifeStealLog}${critFlavor} (${weaponAttr} vs ${target.armorAttr} x${attrModifier.toFixed(1)}${fireBoltLogSuffix}) [${formatEnemyName(target)}] 撃破!`,
              );
              // 죽었으므로 해당 대상만 제거 후 턴 발동
              const remain = activeEnemies.filter((_, i) => i !== targetIndex);
              setActiveEnemies(remain);
              if (remain.length > 0) {
                setTimeout(() => triggerEnemyTurn(remain), 300);
              } else {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
                combatEndedThisCommand = true;
              }
            } else {
              setActiveEnemies(prev => prev.map((e, index) => {
                if (index !== targetIndex) return e;
                const next: ActiveEnemy = { ...e, currentHp: currentEnemyHp };
                if (hadMarkAtStart && markConsumedThisAttack) next.warriorMarkActive = false;
                if (poisonProc) next.poisonTurns = Math.max(3, e.poisonTurns || 0);
                if ((playerState.runePoisonWeaponTurns ?? 0) > 0 && totalDmg > 0) {
                  next.poisonTurns = Math.max(4, e.poisonTurns || 0, next.poisonTurns || 0);
                }
                if (burnProc || fireBoltBurnProc) {
                  next.burnTurns = Math.max(2, e.burnTurns || 0);
                }
                return next;
              }));
              const critFlavor = isCritFinal ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = `${initiativeLog ? initiativeLog + '\n' : ''}${attackDesc}${lifeStealLog}${critFlavor} (${weaponAttr} vs ${target.armorAttr} x${attrModifier.toFixed(1)}${fireBoltLogSuffix}) [${formatEnemyName({ ...target, currentHp: currentEnemyHp })}] HP: ${currentEnemyHp}/${target.maxHp}`;
              if (poisonProc) response += `\n☠️ [${target.name}] 독에 중독! (3턴 간 턴당 5 피해)`;
              if (burnProc) response += `\n🔥 [원소의 손길] [${target.name}] 화상! (2턴)`;
              if (fireBoltBurnProc) response += `\n🔥 [파이어 볼트] [${target.name}] 화상! (2턴)`;
              triggerEnemyTurn(activeEnemies);
            }
            }
            }
          }
          }
        }
      } else if (['방어', '가드'].includes(input)) {
        // WHY: 턴을 소모해 가드 태세 → 적 턴. MP 없이 쓸 수 있으나 [대응 가드]보다 피해 감소가 약함.
        if (!playerState.isCombat || activeEnemies.length === 0) {
          response = '전투 중이 아닙니다.';
        } else {
          response =
            '🛡 가드 태세를 취했습니다. 이번 적 공격에서 받는 피해가 줄어듭니다.\n' +
            '(더 강한 가드는 MP 5 — \'대응 가드\')';
          triggerEnemyTurn(activeEnemies, { isDefending: true, basicDefend: true });
        }
      } else if (input.startsWith('대응')) {
        // WHY: 적의 "강공격 예고" 같은 패턴을 보고, 플레이어가 의식적으로 대비할 수 있는 선택지를 제공한다.
        // 사용법: 대응 가드 | 대응 회피 | 대응 패링
        const parts = input.split(/\s+/).filter(Boolean);
        const stance = (parts[1] || '').trim();
        if (!playerState.isCombat || activeEnemies.length === 0) {
          response = '전투 중이 아닙니다.';
        } else if (playerState.mp < smp(5)) {
          response = `MP 부족 (${smp(5)} MP 필요)`;
        } else if (!stance) {
          response = "사용법: '대응 가드' 또는 '대응 회피' 또는 '대응 패링'";
        } else if (['가드', '방어'].includes(stance)) {
          setPlayerState(p => ({ ...p, mp: p.mp - smp(5) }));
          response = `🛡 [대응: 가드] 다음 적 공격 피해를 크게 줄입니다. (MP -${smp(5)})`;
          triggerEnemyTurn(activeEnemies, { isDefending: true });
        } else if (['회피', '도지'].includes(stance)) {
          setPlayerState(p => ({ ...p, mp: p.mp - smp(5) }));
          response = `💨 [대응: 회피] 다음 적 공격을 피할 확률을 높입니다. (MP -${smp(5)})`;
          triggerEnemyTurn(activeEnemies, { dodgeChance: 0.35 });
        } else if (['패링', '쳐내기'].includes(stance)) {
          if (!playerState.skills.includes('패링')) {
            response = '⚠️ 패링 스킬을 아직 배우지 않았습니다. (패링 습득 필요)';
          } else {
            setPlayerState(p => ({ ...p, mp: p.mp - smp(5) }));
            response = `⚔ [대응: 패링] 다음 적 공격을 막고 반격을 노립니다. (MP -${smp(5)})`;
            triggerEnemyTurn(activeEnemies, { isParrying: true });
          }
        } else {
          response = "알 수 없는 대응 방식입니다. 사용법: '대응 가드' | '대응 회피' | '대응 패링'";
        }
      } else if (['회피', '도지'].includes(input)) {
        // WHY: 턴 소모 + 회피 보너스. 자동 회피(민첩·갑옷)와 합산된다. MP 강화는 \'대응 회피\'.
        if (!playerState.isCombat || activeEnemies.length === 0) {
          response = '전투 중이 아닙니다.';
        } else {
          response =
            '💨 회피에 집중합니다. 이번 적 공격을 완전히 피할 확률이 올라갑니다.\n' +
            '(더 높은 회피율은 MP 5 — \'대응 회피\')';
          triggerEnemyTurn(activeEnemies, { dodgeChance: 0.2 });
        }
      } else if (['패링', '쳐내기'].includes(input)) {
        // WHY: 패링 스킬 보유 시 턴을 소모해 반격 태세. 자동 패링과 별개로 \'의도적\' 선택이 가능해진다.
        if (!playerState.isCombat || activeEnemies.length === 0) {
          response = '전투 중이 아닙니다.';
        } else if (!playerState.skills.includes('패링')) {
          response = '⚠️ 패링 스킬을 아직 배우지 않았습니다. (일부 직업 전용)';
        } else {
          response =
            '⚔ 패링 태세! 적의 공격을 틈으로 반격을 노립니다.\n' +
            '(성공률·반격이 더 강하면 MP 5 — \'대응 패링\')';
          triggerEnemyTurn(activeEnemies, { isParrying: true, basicParry: true });
        }
      } else if (['도망', '후퇴'].includes(input)) {
        if (!playerState.isCombat) { response = '전투 중이 아닙니다.'; }
        else if (Math.random() < 0.4) {
          stealthTurnsRef.current = 0;
          skipRoomEnemyClearAfterCombatRef.current = true;
          setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
          setActiveEnemies([]);
          setSceneImage(resolveRoomSceneImage(getRoomById(currentRoomId)));
          response = '🏃💨 무사히 도망쳤습니다!';
        } else { response = '도망 실패! 적이 앞길을 막아섰습니다.'; triggerEnemyTurn(activeEnemies, undefined, 'neutral'); }
      } else if (input.startsWith('대화 ')) {
        const targetName = input.substring(3).trim();
        const npc = NPC_LIST.find(n => n.name === targetName || n.name.includes(targetName));
        if (!npc) {
          response = `주변에 [${targetName}]은(는) 없습니다.`;
        } else {
          const state = playerState.npcs[npc.id];
          setSceneImage(resolveNpcSceneImage(npc.id));

          let questResponse = '';
          const npcQuests = Object.values(QUESTS).filter(q => q.npcId === npc.id);
          for (const qDef of npcQuests) {
             if (playerState.quests.completed.includes(qDef.id)) continue;

             if (playerState.quests.active[qDef.id] !== undefined) {
                 const progress = playerState.quests.active[qDef.id];
                 let isComplete = false;
                 if (qDef.type === 'kill' && progress >= qDef.requiredCount) isComplete = true;
                 else if (qDef.type === 'fetch' && inventoryHasItemName(playerState.inventory, qDef.targetId)) isComplete = true;

                 if (isComplete) {
                     const skippedQuestRewardItems: string[] = [];
                     questResponse = `[${npc.name}]: "${qDef.dialogue.complete}"\n`;
                     speakDialogue(qDef.dialogue.complete, npc.id);
                     questResponse += `✨ 퀘스트 [${qDef.title}] 완료! (보상: ${qDef.reward.exp || 0} EXP, ${qDef.reward.credit || 0} COIN${qDef.reward.items ? ', ' + qDef.reward.items.join(', ') : ''})`;

                     setPlayerState(p => {
                         const newCompleted = [...p.quests.completed, qDef.id];
                         const newActive = { ...p.quests.active };
                         delete newActive[qDef.id];

                         let updatedInventory = [...p.inventory];
                         if (qDef.type === 'fetch') {
                           updatedInventory = removeOneFromInventoryByItemName(
                             updatedInventory,
                             qDef.targetId,
                           );
                         }
                         if (qDef.reward.items) {
                           for (const n of qDef.reward.items) {
                             const qLogs: string[] = [];
                             const res = addItemToInventory(updatedInventory, n, qLogs);
                             updatedInventory = res.inventory;
                             if (qLogs.length > 0) skippedQuestRewardItems.push(n);
                           }
                         }

                         let nextExp = p.exp + (qDef.reward.exp || 0);
                         let nextLevel = p.level;
                         let nextMaxExp = p.maxExp;
                         let nextStatPoints = p.statPoints;
                         let nextStr = p.str, nextDex = p.dex, nextCon = p.con, nextInt = p.int, nextSpr = p.spr;
                         let levelUpMsgLocal = '';
                         const statRolls: Array<{ key: 'str'|'dex'|'con'|'int'|'spr'; label: string }> = [
                           { key: 'str', label: '힘' }, { key: 'dex', label: '민첩' }, { key: 'con', label: '체력' }, { key: 'int', label: '지능' }, { key: 'spr', label: '정신' }
                         ];
                        const jobForRoll = (loggedInChar?.job ?? (p as any).job) as string | undefined;
                         const questStatPool = statRolls.filter(s => {
                           if (!jobForRoll) return true;
                           if (['전사', '도적', '로그'].includes(jobForRoll)) return s.key !== 'int';
                           if (jobForRoll === '마법사') return s.key !== 'str' && s.key !== 'dex';
                           if (jobForRoll === '성직자') return s.key !== 'dex' && s.key !== 'int';
                           return true;
                         });
                         const poolForRoll = questStatPool.length > 0 ? questStatPool : statRolls;
                         while (nextLevel < PLAYER_MAX_LEVEL && nextExp >= nextMaxExp) {
                            nextExp -= nextMaxExp;
                            nextLevel++;
                            nextStatPoints += 2;
                            const roll = poolForRoll[Math.floor(Math.random() * poolForRoll.length)];
                            if (roll.key === 'str') nextStr++; else if (roll.key === 'dex') nextDex++; else if (roll.key === 'con') nextCon++; else if (roll.key === 'int') nextInt++; else nextSpr++;
                            levelUpMsgLocal += `\n🎉 레벨 업! LV ${nextLevel} 달성! (스탯 포인트 +2 / 랜덤 스탯 +1: ${roll.label})`;
                            if (nextLevel >= PLAYER_MAX_LEVEL) {
                              nextExp = 0;
                              nextMaxExp = 1;
                              break;
                            }
                            nextMaxExp = expRequiredForNextLevel(nextLevel);
                         }
                         if (nextLevel >= PLAYER_MAX_LEVEL) {
                           nextExp = 0;
                           nextMaxExp = 1;
                         }

                         if (levelUpMsgLocal) {
                            questResponse += levelUpMsgLocal;
                         }

                         const next: any = {
                             ...p,
                             exp: nextExp,
                             level: nextLevel,
                             maxExp: nextMaxExp,
                             str: nextStr, dex: nextDex, con: nextCon, int: nextInt, spr: nextSpr,
                             statPoints: nextStatPoints,
                             credit: p.credit + (qDef.reward.credit || 0),
                             quests: { active: newActive, completed: newCompleted },
                             inventory: updatedInventory,
                         };
                         const { maxHp, maxMp } = getEffectiveMaxHpMp(next);
                         next.maxHp = maxHp;
                         next.maxMp = maxMp;
                         next.hp = nextLevel > p.level ? maxHp : p.hp;
                         next.mp = nextLevel > p.level ? maxMp : p.mp;
                         return next;
                     });
                     if (skippedQuestRewardItems.length > 0) {
                       questResponse +=
                         `\n${getInventoryFullMessage()}\n※ 인벤이 가득 차 다음 보상 아이템을 받지 못했습니다: ${skippedQuestRewardItems.join(', ')}`;
                     }
                 } else {
                     questResponse = `[${npc.name}]: "${qDef.dialogue.progress}"\n📜 퀘스트 [${qDef.title}] 진행 중 (${qDef.type === 'kill' ? progress : (inventoryHasItemName(playerState.inventory, qDef.targetId) ? 1 : 0)}/${qDef.requiredCount})`;
                     speakDialogue(qDef.dialogue.progress, npc.id);
                 }
                 break;
             } else {
                 questResponse = `[${npc.name}]: "${qDef.dialogue.start}"\n('선택 퀘스트수락' 로 수락 가능)`;
                 speakDialogue(qDef.dialogue.start, npc.id);
                 break;
             }
          }

          if (questResponse) {
             response = questResponse;
          } else {
             if (npc.id === 'oni') {
               const line = state.metBefore ? `또 왔나. 제로 코드는 가져왔겠지?` : `이 몸이 쿠로사키 오니다. 제로 코드 냄새가 나는군.`;
               response = `[쿠로사키 오니]: "${line}" ('선택 코드주기' / '선택 가입')`;
               speakDialogue(line, 'oni');
             } else if (npc.id === 'ghostQueen') {
               const hasFireball = playerState.skills.includes('파이어볼');
               const line = state.metBefore ? `기다리고 있었어... 데이터의 강은 영원해.` : `데이터의 자유를 맛보게 해줄게. 나와 함께할래?`;
               response = `[고스트 퀸]: "${line}" ${hasFireball ? '' : "('선택 마법전수')"}`;
               speakDialogue(line, 'ghostQueen');
             } else if (npc.id === 'neonFat') {
               const line = state.metBefore ? `또 왔군! 라멘 한 그릇 하고 가라고!` : `야, 러너! 라멘 100크레딧에 정보 드림!`;
               response = `[네온 팻]: "${line}" ('선택 구매')`;
               speakDialogue(line, 'neonFat');
              } else if (npc.id === 'lira') {
                const line = state.metBefore ? `또 온 거 보니 아직 숨통은 붙어있군.` : `여기선 선불이야. 누울 거면 누워.`;
                response = `[리라]: "${line}" ('선택 치료')`;
                speakDialogue(line, 'lira');
              } else if (npc.id === 'ironJack') {
            const lines = ["이 망할 고철덩어리들은 언제 쓸만해지려나.", "무기가 필요해? 크레딧은 넉넉하게 가져왔겠지?", "슬럼가에선 내 망치 소리만큼 믿을 수 있는 게 없어."];
            const line = lines[Math.floor(Math.random() * lines.length)];
            response = `[아이언 잭]: "${line}"\n(상점 이용: '선택 상점' 또는 '거래 아이언 잭' 명령어로 거래)`;
            speakDialogue(line, 'ironJack');
          } else if (npc.id === 'veilCrypt') {
            if (currentRoomId !== GAMBLING_MERCHANT_ROOM_ID) {
              response =
                `[베일 크립트]의 소문은 들리지만, 이 근처에 부스를 펼치진 않은 모양이다. (상층 [홀로 거래소]에서 만날 수 있음)`;
            } else {
              const line = npc.dialogues[Math.floor(Math.random() * npc.dialogues.length)];
              response = `[베일 크립트]: "${line}"\n\n('거래 베일 크립트' — 구매 전에는 옵션·실명 비공개 블라인드 상품 목록)`;
              speakDialogue(line, npc.id);
            }
          } else {
            const line = npc.dialogues[Math.floor(Math.random() * npc.dialogues.length)];
            response = `[${npc.name}]: "${line}" (세력: ${npc.faction} / 관계: ${state.relationship})`;
            // 거래 가능 NPC(마스터 진 등) 대화 시 거래 명령어 안내 — 사용자가 까먹지 않도록
            if (npc.id === 'jin') {
              response += `\n\n'거래 ${npc.name}' 명령어로 거래할 수 있습니다.`;
            }
            speakDialogue(line, npc.id);
          }
        }
          setLastTalkedNpc(npc.id);
          setPlayerState(p => ({
            ...p,
            npcs: { ...p.npcs, [npc.id]: { ...p.npcs[npc.id], metBefore: true } },
          }));
        }
      } else if (input.startsWith('거래')) {
        const targetName = input.substring(2).trim();
        const npc = targetName ? NPC_LIST.find(n => n.name === targetName || n.name.includes(targetName)) : NPC_LIST.find(n => n.id === lastTalkedNpc);
        
        if (!npc || (npc.id !== 'ironJack' && npc.id !== 'jin' && npc.id !== 'veilCrypt')) {
          response = targetName ? `[${targetName}]은(는) 거래가 가능한 상인이 아닙니다.` : `거래 가능한 상인과 대화 중이 아닙니다.`;
        } else if (npc.id === 'ironJack') {
          response = getIronJackShopResponse(loggedInChar?.job);
          if (targetName) setLastTalkedNpc(npc.id);
          // WHY: 대화 없이 곧바로 '거래 아이언 잭'만 해도 장면 패널에 잭 일러 표시
          setSceneImage(resolveNpcSceneImage('ironJack'));
        } else if (npc.id === 'veilCrypt') {
          if (currentRoomId !== GAMBLING_MERCHANT_ROOM_ID) {
            response = '홀로 거래소가 아니면 베일 크립트의 블라인드 부스는 열리지 않는다.';
          } else {
            response = getGamblingMerchantShopResponse();
            if (targetName) setLastTalkedNpc(npc.id);
            setSceneImage(resolveNpcSceneImage('veilCrypt'));
          }
        } else if (npc.id === 'jin') {
          setSceneImage(resolveNpcSceneImage('jin'));
          // WHY: 마스터 진의 스킬은 중후반 성장 동력이라, 초반에 한 번에 다 사지 못하도록 가격을 10배 상향(1000~3000C).
          const skillsForJob: Record<string, {name: string, price: number, desc: string}[]> = {
            '마법사': [
              {name: '마나 실드', price: 1000, desc: '0MP | 토글 — 켜 두는 동안 피해를 MP로 흡수 · MP 자연회복 중단 · MP 0이면 해제'},
              {name: '아이스 스피어', price: 1000, desc: '12MP | 차가운 얼음 창 단일 피해'},
              {name: '메테오 스트라이크', price: 3000, desc: '35MP | 거대한 화염 광역 피해'},
              {name: '블리자드', price: 2000, desc: '30MP | 가혹한 눈보라 광역 피해'},
              {name: '펄스 노바', price: 2200, desc: '22MP | 광역 폭발 + 전격 파동(경직)'},
              {name: '스타폴', price: 2800, desc: '30MP | 별똥별 광역 + 잔열(화상)'},
              {name: '마력의 순환', price: 1500, desc: '0MP | 턴을 소모하여 MP 대폭 회복'}
            ],
            '성직자': [
              {name: '신의 방패', price: 1000, desc: '0MP | 맞을 때 HP 대신 MP 소모(MP 0이면 HP 감소), 5턴'},
              {name: '홀리 스마이트', price: 3500, desc: 'MP 60~120(강화 시) | Lv1=데미지 1/2, Lv3=4/3·MP 2배'},
              {name: '징벌', price: 2000, desc: '25MP | 신앙심(정신력) 기반 큰 단일 피해'},
              {name: '구원의 손길', price: 2500, desc: '30MP | 신앙심(정신력)에 따른 HP 대량 회복'},
              {name: '정화', price: 900, desc: '12MP | 신앙심(정신력) 기반 신성 단일 피해'},
              {name: '축복', price: 800, desc: '10MP | 신앙심(정신력)에 따른 공격력 상승'},
              {name: '회복 기도', price: 600, desc: '8MP | 신앙심(정신력)에 따른 4턴 도트 힐'},
              {name: '천벌', price: 1800, desc: 'MP 10~22(강화 시 증가) | 기본 1/3 데미지, 강화 시 풀 위력'},
              {name: '생명력 전환', price: 1200, desc: '0MP | HP 소모하여 MP 회복 (신앙심 영향)'}
            ],
            '전사': [
              {name: '휠윈드', price: 1500, desc: '25MP | 무기를 휘둘러 광역 피해'},
              {name: '돌진', price: 1000, desc: '15MP | 빠르고 묵직한 단일 피해'},
              {name: '불굴의 의지', price: 1500, desc: '20MP | 전투 중 HP 50 회복'},
              {name: '광폭화', price: 2000, desc: '15MP | 방어력을 깎고 공격력 대폭 상승'},
              {name: '도발', price: 900, desc: '12MP | 3턴간 적이 주는 피해 감소'},
              {name: '반격 태세', price: 1200, desc: '15MP | 다음 적 공격 피해 대폭 감소 + 확정 반격'},
              {name: '철벽', price: 1400, desc: '20MP | DEF +20, 3턴 (만료 시 보너스 제거)'},
              {name: '갑옷 파쇄', price: 1600, desc: '18MP | 피해 + 적 방어 4턴간 약화'},
              {name: '처형', price: 2200, desc: '25MP | 단일 피해 — HP 35% 이하일 때 추가 보너스'},
              {name: '표식 참격', price: 1000, desc: '12MP | 약공 + 다음 물리 1타 35% 추가 피해'},
              {name: '방패 강타', price: 1100, desc: '12MP | 방패 필수 — 피해 + 스턴(보스 일부 저항)'},
              {name: '가시 갑옷', price: 1300, desc: '18MP | 4턴 — 근접(비마법) 피격 시 피해 비례 반사'},
              {name: '일격필살', price: 2400, desc: '20MP | RAGE 전부 소모 · 분노비례 단일 폭딜 (쿨 3턴)'}
            ],
            '도적': [
              {name: '패링', price: 500, desc: '5MP | 피해 감소 반격 (적 공격 시 자동 발동)'},
              {name: '섀도우 스텝', price: 1500, desc: '15MP | 그림자 은신 — 방어 +20, 다음 적 턴 회피율 +50%p'},
              {name: '거울 복도', price: 1100, desc: '12MP | 이번 적 라운드 동안 적 명중이 잘 빗나감 (홀로그램 그림자)'},
              {name: '죽은 척 오스', price: 900, desc: '8MP | 다음 HP 피해 1회를 연기로 무효'},
              {name: '은신', price: 800, desc: '15MP | 3턴 간 적 공격 100% 회피. 스틸 전에 사용 권장'},
              {name: '스틸', price: 1200, desc: '10MP | 적 아이템 훔치기 후 도망. 은신 중 성공률 90%'},
              {name: '독 폭탄', price: 1500, desc: '20MP | 광역 방어력 저하 피해'},
              {name: '맹독 단검', price: 1000, desc: '12MP | 방어력을 무시하는 치명적 찌르기'},
              {name: '페인 딜러', price: 1400, desc: '16MP | 방무 피해 + 독·출혈 동시 부여'},
              {name: '지갑선 끊기', price: 850, desc: '10MP | 피해 + 적 주머니에서 코인 보너스'},
              {name: '급소 찌르기', price: 2000, desc: '18MP | 단일 대상 큰 피해'},
              {name: '라스트 콜', price: 2600, desc: '22MP | 막차 폭딜 — 대상 HP 35% 이하일 때만 시전'},
            ],
            '로그': [
              {name: '스나이프',   price: 2000, desc: '25MP | 단일 적에게 정밀 극딜'},
              {name: '헤드샷',    price: 3000, desc: '35MP | 단일 대상 치명적 피해'},
              {name: '철수',      price: 1000, desc: '10MP | 높은 확률로 전투 강제 이탈'},
              {name: '난사',      price: 2500, desc: '30MP | 무작위 적 다중 타격'},
              {name: '애기살',    price: 1800, desc: '15MP | 방어·회피 무시 3연속 약공격'},
              {name: '폭발 화살', price: 2600, desc: '25MP | 단일 + 주변 적 폭발 피해'},
              {name: '화염 화살', price: 2200, desc: '18MP | 단일 적 화상 특화 화살'},
            {name: '얼음 화살', price: 2200, desc: '20MP | 단일 적 빙결/둔화 화살'},
            {name: '와이어 트랩', price: 2400, desc: '20MP | 현재 방에 설치형 함정 — 다음 등장 적 1명 선 피해 + 1턴 기절'},
            {name: '도주 사격',  price: 2000, desc: '15MP | 단일 공격 후 50% 확률 전투 이탈 시도 (철수보다 성공률 낮음)'},
            {name: '멀티샷',    price: 2100, desc: '18MP | 한 대상에게 3발 연속 화살 (민첩 반영)'},
            {name: '에로우 샤워', price: 2800, desc: '28MP | 광역 화살 비 — 모든 적에게 피어싱 피해'}
            ]
          };
          const currentJob = loggedInChar?.job || '';
          const targetList = skillsForJob[currentJob] || [];
          if (targetList.length === 0) {
             response = `[마스터 진]\n"흠... 네 직업(${currentJob})에 당장 어울리는 비전서는 없구나."\n\n[힌트] 이후에도 '거래 마스터 진' 명령으로 언제든 비전서 상점을 다시 열 수 있습니다.`;
          } else {
             const listStr = targetList
               .map((s) => `- 깨달음의 서: ${s.name} (${scaleCoinCost(s.price)} C) : ${s.desc}`)
               .join('\n');
             const pl = playerState.passiveLevels || {};
             const passiveListStr = PASSIVE_LIST.map(p => {
               if (isResistPassive(p.id)) {
                 const lv = pl[p.id] ?? 0;
                 return `- ${p.name} (${scaleCoinCost(p.price)} C) [Lv.${lv}/${MAX_RESIST_LEVEL}] — ${p.description}`;
               }
               if (isRegenPassive(p.id)) {
                 const lv = pl[p.id] ?? (playerState.passiveSkills || []).includes(p.id) ? 1 : 0;
                const nextPrice = scaleCoinCost(getRegenUpgradePrice(lv));
                return `- ${p.name} (${nextPrice} C) [Lv.${lv}/${REGEN_MAX_LEVEL}] — ${p.description}${lv >= REGEN_MAX_LEVEL ? ' (최대)' : ''}`;
               }
               return `- ${p.name} (${scaleCoinCost(p.price)} C): ${p.description}`;
             }).join('\n');
             response = `[마스터 진의 비전서 상점]\n"과거의 지혜가 담긴 비전서들이 여기 있다. 눈길이 가는 게 있나?"\n\n[비전서]\n${listStr}\n\n[패시브 스킬]\n${passiveListStr}\n\n('구매 [스킬명]' 또는 '구매 [패시브 이름]'으로 구매)\n\n[힌트] 대화를 마친 뒤에도 '거래 마스터 진'이라고 입력하면 이 상점을 다시 불러올 수 있습니다.`;
          }
          if (targetName) setLastTalkedNpc(npc.id);
        }
      } else if (input.startsWith('구매 ')) {
        const itemName = input.substring(3).trim();
        if (lastTalkedNpc !== 'ironJack' && lastTalkedNpc !== 'jin' && lastTalkedNpc !== 'veilCrypt') {
          response =
            '거래 가능한 상인과 먼저 대화하거나 거래를 시도하세요. (예: 거래 아이언 잭, 홀로 거래소에서 거래 베일 크립트)';
        } else if (lastTalkedNpc === 'veilCrypt') {
          if (currentRoomId !== GAMBLING_MERCHANT_ROOM_ID) {
            response = '[베일 크립트] 부스는 홀로 거래소에만 있다. 다른 곳에선 구매할 수 없다.';
          } else {
            const blind = findBlindBoxProduct(itemName);
            if (!blind) {
              response = `[${itemName}] — 블라인드 목록에 없는 상품이다. '거래 베일 크립트'로 정확한 이름을 확인해라.`;
            } else if (blind.minLevel != null && playerState.level < blind.minLevel) {
              response = `[베일 크립트] "아직 이 테이블은 네 급이 아니야. Lv.${blind.minLevel} 이상이나 오라고." (현재 Lv.${playerState.level})`;
            } else if ((playerState.credit || 0) < getBlindBoxPurchasePrice(blind)) {
              response = `크레딧이 부족하다. (보유: ${playerState.credit ?? 0} C / 필요: ${getBlindBoxPurchasePrice(blind)} C)`;
            } else if (isInventoryFull(playerState.inventory)) {
              response = `${getInventoryFullMessage()} 베일 크립트 상품을 들고 갈 수 없다.`;
            } else {
              const blindCost = getBlindBoxPurchasePrice(blind);
              const rolledId = rollBlindBoxItemId(blind.purchaseName, playerState.level);
              const mysteryRow = newMysteryInventoryRow(rolledId, { veilBlindSource: true });
              setPlayerState((p) => ({
                ...p,
                credit: (p.credit || 0) - blindCost,
                inventory: [...p.inventory, mysteryRow],
              }));
              const left = (playerState.credit || 0) - blindCost;
              const scrapLine = isVeilScrapItemId(rolledId) ? getVeilScrapPurchaseLine() : null;
              const jackpotLine =
                blind.purchaseName === '홀로 잭팟' && !isVeilScrapItemId(rolledId)
                  ? getVeilJackpotFlavorLine(rolledId)
                  : null;
              response =
                `🎰 [베일 크립트] "${blind.purchaseName}" 거래 완료! (-${blindCost} C, 남은 COIN: ${left} C)\n` +
                (scrapLine ? `${scrapLine}\n` : '') +
                (jackpotLine ? `${jackpotLine}\n` : '') +
                `📦 인벤에 미확인 장비가 들어왔다: [${mysteryRow.name}] — 부가 옵션·실명은 ` +
                `'감정 ${mysteryRow.name}' 또는 [${APPRAISAL_SCROLL_ITEM_NAME}] / 아이언 잭 유료 감정으로 연다.`;
            }
          }
        } else if (lastTalkedNpc === 'ironJack') {
          const item = getItemByName(itemName);
          const buyPrice = item ? getScaledShopBuyPrice(item) : undefined;
          if (!item) {
            response = `[${itemName}]은(는) 취급하지 않는 물건입니다.`;
          } else if (item.grade === 'legendary') {
            response =
              `[${itemName}]은(는) [레전드리] 등급이다. 아이언 잭도 입수 경로를 모른다 — 전리품·몬스터 드랍으로만 손에 넣을 수 있다.`;
          } else if (buyPrice == null) {
            response = `[${itemName}]은(는) 취급하지 않는 물건입니다.`;
          } else if (!isItemNameOfferedByIronJackForJob(itemName, loggedInChar?.job)) {
            response = `[${itemName}]은(는) 잭이 당신 직업용 목록에 없다. '거래 아이언 잭'으로 표시된 무기·갑옷만 살 수 있다.`;
          } else if (playerState.credit < buyPrice) {
             response = `크레딧이 부족합니다. (보유: ${playerState.credit} C / 필요: ${buyPrice} C)`;
          } else {
            const buyLogs: string[] = [];
            const res = addItemToInventory(playerState.inventory, item.name, buyLogs);
            if (buyLogs.length > 0) {
              response = buyLogs[buyLogs.length - 1];
            } else {
              setPlayerState((p) => ({
                ...p,
                credit: p.credit - buyPrice,
                inventory: res.inventory,
              }));
              response = `[${item.name}]${getObjectParticle(item.name)} ${buyPrice} 크레딧에 구매했습니다. (남은 크레딧: ${playerState.credit - buyPrice} C)`;
            }
          }
        } else if (lastTalkedNpc === 'jin') {
          // WHY: 상점 표기와 동일하게 마스터 진 스킬 전체 가격을 10배로 통일해, 한 번에 풀셋 구매가 어렵도록 난이도 조정.
          const allSkills = [
              {name: '마나 실드', price: 1000},
              {name: '아이스 스피어', price: 1000}, {name: '메테오 스트라이크', price: 3000}, {name: '블리자드', price: 2000},
              {name: '펄스 노바', price: 2200}, {name: '스타폴', price: 2800}, {name: '마력의 순환', price: 1500},
              {name: '신의 방패', price: 1000}, {name: '홀리 스마이트', price: 3500}, {name: '징벌', price: 2000}, {name: '구원의 손길', price: 2500},
              {name: '정화', price: 900}, {name: '축복', price: 800}, {name: '회복 기도', price: 600}, {name: '천벌', price: 1800}, {name: '생명력 전환', price: 1200},
              {name: '휠윈드', price: 1500}, {name: '돌진', price: 1000}, {name: '불굴의 의지', price: 1500}, {name: '광폭화', price: 2000},
              {name: '도발', price: 900}, {name: '반격 태세', price: 1200}, {name: '철벽', price: 1400}, {name: '갑옷 파쇄', price: 1600},
              {name: '처형', price: 2200}, {name: '표식 참격', price: 1000}, {name: '방패 강타', price: 1100},
              {name: '가시 갑옷', price: 1300}, {name: '일격필살', price: 2400},
              {name: '패링', price: 500}, {name: '섀도우 스텝', price: 1500}, {name: '거울 복도', price: 1100}, {name: '죽은 척 오스', price: 900}, {name: '은신', price: 800}, {name: '스틸', price: 1200}, {name: '독 폭탄', price: 1500}, {name: '맹독 단검', price: 1000}, {name: '페인 딜러', price: 1400}, {name: '지갑선 끊기', price: 850}, {name: '급소 찌르기', price: 2000}, {name: '라스트 콜', price: 2600},
              {name: '스나이프', price: 2000}, {name: '헤드샷', price: 3000}, {name: '철수', price: 1000}, {name: '난사', price: 2500},
              {name: '애기살', price: 1800}, {name: '폭발 화살', price: 2600}, {name: '화염 화살', price: 2200}, {name: '얼음 화살', price: 2200},
              {name: '와이어 트랩', price: 2400}, {name: '도주 사격', price: 2000}, {name: '멀티샷', price: 2100}, {name: '에로우 샤워', price: 2800}
          ];
          let skillName = itemName;
          if (itemName.startsWith('깨달음의 서: ')) skillName = itemName.replace('깨달음의 서: ', '').trim();
          
          const skillDef = allSkills.find(s => s.name === skillName);
          const passiveDef = getPassiveByName(skillName) || getPassiveByName(itemName);
          if (!skillDef && !passiveDef) {
             response = `[${skillName}]에 해당하는 비전서/패시브는 취급하지 않는다. ("거래"로 목록 확인)`;
          } else if (passiveDef) {
             const isResist = isResistPassive(passiveDef.id);
             const isRegen = isRegenPassive(passiveDef.id);
             const currentLevel = (playerState.passiveLevels || {})[passiveDef.id] ?? 0;
             const regenCurrentLevel = isRegen ? (currentLevel >= 1 ? currentLevel : (playerState.passiveSkills || []).includes(passiveDef.id) ? 1 : 0) : 0;
             const regenPrice = isRegen ? scaleCoinCost(getRegenUpgradePrice(regenCurrentLevel)) : 0;
             const resistOrPassiveBuy = scaleCoinCost(passiveDef.price);
             if (isResist && currentLevel >= MAX_RESIST_LEVEL) {
               response = `[${passiveDef.name}]은(는) 이미 최대 레벨(Lv.${MAX_RESIST_LEVEL})이다.`;
             } else if (isRegen && regenCurrentLevel >= REGEN_MAX_LEVEL) {
               response = `[${passiveDef.name}]은(는) 이미 최대 레벨(Lv.${REGEN_MAX_LEVEL})이다. (칸당 +${REGEN_PER_LEVEL * REGEN_MAX_LEVEL} 회복)`;
             } else if (!isResist && !isRegen && (playerState.passiveSkills || []).includes(passiveDef.id)) {
               response = `이미 [${passiveDef.name}]을(를) 보유하고 있다.`;
             } else if (isRegen && (playerState.credit || 0) < regenPrice) {
               response = `크레딧이 부족하다. (필요: ${regenPrice} C / 보유: ${playerState.credit} C)`;
             } else if (!isRegen && (playerState.credit || 0) < resistOrPassiveBuy) {
               response = `크레딧이 부족하다. (필요: ${resistOrPassiveBuy} C / 보유: ${playerState.credit} C)`;
             } else {
               if (isResist) {
                 const nextLevel = currentLevel + 1;
                 setPlayerState(p => ({
                   ...p,
                   credit: (p.credit || 0) - resistOrPassiveBuy,
                   passiveLevels: { ...(p.passiveLevels || {}), [passiveDef.id]: nextLevel },
                 }));
                 response = `[마스터 진]\n"저항이 한 단계 깊어진다."\n\n✨ [${passiveDef.name}] Lv.${nextLevel} 업그레이드! (-${resistOrPassiveBuy} C)\n해당 속성 DoT 데미지 ${nextLevel * 5}% 감소.`;
               } else if (isRegen) {
                 const nextLevel = regenCurrentLevel + 1;
                 const price = regenPrice;
                 setPlayerState(p => ({
                   ...p,
                   credit: (p.credit || 0) - price,
                   passiveSkills: nextLevel >= 1 && !(p.passiveSkills || []).includes(passiveDef.id) ? [...(p.passiveSkills || []), passiveDef.id] : (p.passiveSkills || []),
                   passiveLevels: { ...(p.passiveLevels || {}), [passiveDef.id]: nextLevel },
                 }));
                 const remainingCredit = playerState.credit - price;
                 response = `[마스터 진]\n"생명의 숨결이 한 단계 깊어진다."\n\n✨ [${passiveDef.name}] Lv.${nextLevel} 업그레이드! (-${price} C)  남은 COIN: ${remainingCredit} C\n칸당 ${REGEN_PER_LEVEL * nextLevel} 회복.`;
               } else {
                 setPlayerState(p => ({ ...p, credit: (p.credit || 0) - resistOrPassiveBuy, passiveSkills: [...(p.passiveSkills || []), passiveDef.id] }));
                 response = `[마스터 진]\n"영원히 네 몸에 새겨지는 지식이다."\n\n✨ [${passiveDef.name}] 패시브 습득! (-${resistOrPassiveBuy} C)\n${passiveDef.description}`;
               }
             }
         } else if (!skillDef) {
            response = `스킬 정보를 찾을 수 없습니다. (스킬명: ${skillName})`;
         } else if (playerState.skills.includes(skillName)) {
             response = `이미 [${skillName}]의 깨달음을 얻었거늘, 또 읽을 작정인가?\n(업그레이드는 '스킬강화 ${skillName}' 명령으로 스킬 레벨을 올리세요.)`;
          } else if (playerState.credit < scaleCoinCost(skillDef.price)) {
             response = `크레딧이 부족하다. (필요: ${scaleCoinCost(skillDef.price)} C / 보유: ${playerState.credit} C)`;
          } else {
             const skillBuy = scaleCoinCost(skillDef.price);
             setPlayerState(p => ({
               ...p,
               credit: p.credit - skillBuy,
               skills: [...p.skills, skillName]
             }));
             const remainingCredit = playerState.credit - skillBuy;
             response = `[마스터 진]\n"비전서의 지식이 네 머릿속으로 흘러들어간다..."\n\n✨ [${skillName}] 습득 완료! (-${skillBuy} C)  남은 COIN: ${remainingCredit} C\n스킬이 UI에 등록되며 '스킬 ${skillName}' 명령으로 발동할 수 있습니다.`;
          }
        }
      } else if (input.startsWith('판매 ')) {
        const itemName = input.substring(3).trim();
        const bulkSellCategory = parseBulkSellCategory(itemName);
        const bulkEquipmentGrade = parseBulkSellEquipmentGrade(itemName);
        // WHY: 현재 방에 있는 상인만 판매를 받도록 함. 지하 슬럼 상점가 = 아이언 잭, 그 외 방에서 마스터 진만 대화 중이면 진이 거절 메시지.
        const sellNpcInRoom =
          ROOM_SELL_NPC[currentRoomId] ?? (isIronJackServiceRoom(currentRoomId) ? 'ironJack' : undefined);
        const canSellWithIronJack = sellNpcInRoom === 'ironJack' || lastTalkedNpc === 'ironJack';
        if (!canSellWithIronJack) {
          if (lastTalkedNpc === 'jin') {
             response = `[마스터 진]\n"지식은 되팔 수 없는 법. 가치를 아는 다른 이를 찾아보아라."`;
          } else {
             response =
               '거래 가능한 상인과 대화 중이 아닙니다. (아이언 잭이 있는 슬럼 상점가·미로 계열 방에서 판매 가능)';
          }
        } else if (itemName === '잡동사니' || itemName === '잡동사니 전부') {
          // WHY: 잡동사니 = 정의 없음 또는 무기/방어구/물약/스킬북/악세사리(반지·목걸이)가 아닌 것만. 반지·목걸이는 일괄 판매 제외.
          const isMisc = (row: InventoryRow) => {
            // 미확인 장비는 이름이 "미확인 무기·xxxx" 식이라 getItemByName이 항상 실패함 → 예전에는 전부 잡동사니로 판매되어 사라졌음
            if (row.mysteryItemId) return false;
            if (row.identified === false) return false;
            const name = invName(row);
            if (name.startsWith('미확인')) return false;
            const def = getItemByName(name);
            if (!def) return true;
            return def.type !== 'weapon' && def.type !== 'armor' && def.type !== 'shield' && def.type !== 'consumable' && def.type !== 'skillbook' && def.type !== 'accessory';
          };
          const getSellPrice = (name: string) => {
            const item = getItemByName(name);
            if (item && item.price) return Math.max(1, Math.round(item.price * 0.3 * 1.5));
            return Math.max(1, scaleCoinCost(LOOT_SELL_VALUES[name] ?? 10));
          };
          const miscNames = playerState.inventory.filter((row) => {
            if (!isMisc(row)) return false;
            const def = resolveInventoryRowItemDef(row);
            if (!def) return true;
            return !isRareOrEpicExcludedFromAnyBulkSell(
              row,
              def,
              playerState.equipmentEffectiveGrade,
              playerState.equipmentUpgradeLevels,
            );
          });
          if (miscNames.length === 0) {
            response =
              '잡동사니가 없습니다. (해당 항목이 없거나, 레어·에픽 등급은 일괄 판매에서 제외됩니다.)';
          } else {
            const sellMiscIds = new Set(miscNames.map((r) => r.id));
            const totalCredit = miscNames.reduce((sum, row) => sum + getSellPrice(invName(row)), 0);
            setPlayerState(p => ({
              ...p,
              credit: p.credit + totalCredit,
              inventory: p.inventory.filter((row) => !sellMiscIds.has(row.id)),
            }));
            response = `[잡동사니 일괄 판매] ${miscNames.length}개 판매하여 ${totalCredit} 크레딧을 얻었습니다. (현재 크레딧: ${playerState.credit + totalCredit} C)`;
          }
        } else if (bulkSellCategory !== null) {
          const bulkCat = bulkSellCategory;
          const equippedIds = getEquippedInventoryInstanceIds({
            weapon: playerState.weapon,
            armor: playerState.armor,
            offHand: playerState.offHand,
            ring1: (playerState as { ring1?: string | null }).ring1,
            ring2: (playerState as { ring2?: string | null }).ring2,
            necklace: (playerState as { necklace?: string | null }).necklace,
          });
          const toSell = playerState.inventory.filter((row) => {
            const def = resolveInventoryRowItemDef(row);
            if (!def || !rowMatchesBulkSellCategory(def, bulkCat)) return false;
            if (equippedIds.has(row.id)) return false;
            if (
              isRareOrEpicExcludedFromAnyBulkSell(
                row,
                def,
                playerState.equipmentEffectiveGrade,
                playerState.equipmentUpgradeLevels,
              )
            ) {
              return false;
            }
            return true;
          });
          const catLabel = BULK_SELL_CATEGORY_LABEL[bulkCat];
          if (toSell.length === 0) {
            response = `[${catLabel}] 일괄 판매할 아이템이 없습니다. (해당 종류가 없거나 모두 장착 중이거나, 레어·에픽은 일괄 판매에서 제외됩니다.)`;
          } else {
            const totalCredit = toSell.reduce((sum, row) => sum + getSellPriceForInventoryRow(row, LOOT_SELL_VALUES), 0);
            const sellIds = new Set(toSell.map((r) => r.id));
            setPlayerState((p) => ({
              ...p,
              credit: p.credit + totalCredit,
              inventory: p.inventory.filter((row) => !sellIds.has(row.id)),
            }));
            response = `[${catLabel} 일괄 판매] ${toSell.length}개 판매하여 ${totalCredit} 크레딧을 얻었습니다. (현재 크레딧: ${playerState.credit + totalCredit} C)`;
          }
        } else if (bulkEquipmentGrade !== null) {
          const gradeTarget = bulkEquipmentGrade;
          if (gradeTarget === 'rare' || gradeTarget === 'epic' || gradeTarget === 'legendary') {
            response = BULK_SELL_RARE_EPIC_NOT_ALLOWED_MSG;
          } else {
            const toSell = collectInventoryRowsForBulkEquipmentGradeSell(
              {
                inventory: playerState.inventory,
                weapon: playerState.weapon,
                armor: playerState.armor,
                offHand: playerState.offHand,
                ring1: (playerState as { ring1?: string | null }).ring1,
                ring2: (playerState as { ring2?: string | null }).ring2,
                necklace: (playerState as { necklace?: string | null }).necklace,
                equipmentEffectiveGrade: playerState.equipmentEffectiveGrade,
                equipmentUpgradeLevels: playerState.equipmentUpgradeLevels,
              },
              gradeTarget,
            );
            const gradeLabel = ITEM_GRADE_LABEL[gradeTarget];
            if (toSell.length === 0) {
              response = `[${gradeLabel} 등급 장비 일괄 판매] 대상이 없습니다. (무기·갑옷·방패·반지·목걸이 중 「${gradeLabel}」티어만 · 강화·승급 반영 · 장착 중인 것은 제외)`;
            } else {
              const totalCredit = toSell.reduce((sum, row) => sum + getSellPriceForInventoryRow(row, LOOT_SELL_VALUES), 0);
              const sellIds = new Set(toSell.map((r) => r.id));
              setPlayerState((p) => ({
                ...p,
                credit: p.credit + totalCredit,
                inventory: p.inventory.filter((row) => !sellIds.has(row.id)),
              }));
              response = `[${gradeLabel} 등급 장비 일괄 판매] ${toSell.length}개(무기·방어·악세 통합) → ${totalCredit} 크레딧 (현재: ${playerState.credit + totalCredit} C)`;
            }
          }
        } else if (!inventoryHasItemName(playerState.inventory, itemName)) {
          response = `인벤토리에 [${itemName}]이(가) 없습니다.`;
        } else {
          // 착용 중인 장비/장신구 보호:
          // 같은 이름의 아이템이 여러 개 있을 수 있으므로,
          // "장착 중인 개수 >= 인벤토리 내 전체 개수" 인 경우에만 판매를 막는다.
          const equippedNames = [
            playerState.weapon,
            playerState.offHand,
            playerState.armor,
            (playerState as any).ring1,
            (playerState as any).ring2,
            (playerState as any).necklace,
          ].filter(Boolean) as string[];
          const equippedCount = equippedNames.filter((slot) => slot && resolveSlotToItemName(slot, playerState.inventory) === itemName).length;
          const invCount = playerState.inventory.reduce(
            (s, row) => s + (invName(row) === itemName ? getInventoryStackQty(row) : 0),
            0,
          );

          if (equippedCount > 0 && invCount <= equippedCount) {
            // 이 이름의 아이템이 전부 장착에 쓰이고 있어, 여분이 없으므로 판매 불가
            response = `현재 [${itemName}]은(는) 장착 중인 장비만 남아 있습니다. 먼저 장비를 해제한 뒤 판매하세요.`;
          } else {
            const item = getItemByName(itemName);
            // WHY: 장비/포션 등은 정가의 30%에 판매하고,
            //      전리품 전용 루팅 아이템은 LOOT_SELL_VALUES를 사용해 희귀도에 따라 차등 보상.
            const baseSell = (item && item.price)
              ? Math.round(item.price * 0.3 * 1.5)
              : scaleCoinCost(LOOT_SELL_VALUES[itemName] ?? 10);
            const sellPrice = Math.max(1, baseSell);
            setPlayerState(p => ({
              ...p,
              credit: p.credit + sellPrice,
              inventory: removeOneFromInventoryByItemName(p.inventory, itemName),
            }));
            response = `[${itemName}]${getObjectParticle(itemName)} 판매하여 ${sellPrice} 크레딧을 얻었습니다. (현재 크레딧: ${playerState.credit + sellPrice} C)`;
          }
        }
      } else if (input.startsWith('스킬 ')) {
        const skillName = input.substring(3).trim();
        const isMagicSpell = [
          '매직 미사일',
          '파이어볼',
          '라이트닝 볼트',
          '체인 라이트닝',
          '힐',
          '회복의 빛',
          '펄스 노바',
          '스타폴',
        ].includes(skillName);
        const currentCd = (playerState.skillCooldowns || {})[skillName] || 0;
        
        if (currentCd > 0) {
          response = `⏳ [${skillName}] 쿨타임 ${currentCd}턴 남음.`;
        } else if (!playerState.skills.includes(skillName)) {
           response = `스킬 [${skillName}] 없음. 보유 스킬: ${playerState.skills.join(', ')}`;
        } else if (isMagicSpell && loggedInChar?.job === '마법사' && !isMageStaffEquippedForCasting()) {
           response = '⚠️ [시전 실패] 마법사는 지팡이를 장착해야만 마법을 사용할 수 있습니다.';
        } else if (skillName === '매직 미사일') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(5)) { response = `MP 부족 (${smp(5)} MP 필요)`; }
          else {
            const target = activeEnemies[0];
            const weaponAttr = getPlayerWeaponAttr();
            const attrModifier = getDamageModifier(weaponAttr, target.armorAttr);
            const wpPenalty = getWeaponPenalty();
            // 마법 데미지는 INT(최대 데미지)와 SPR(최소 데미지 보정)의 영향을 받음. 스킬 강화 레벨당 10% 증폭
            const magicBaseDmgBase = (effAtk * 1.8) + (effInt * 2.4) + (effSpr * 0.6);
            const magicRand = 0.85 + Math.random() * 0.3;
            const skillLv = (playerState.skillLevels || {})['매직 미사일'] || 1;
            const dmg = Math.max(1, Math.round(magicBaseDmgBase * magicRand * ((100 + effStr) / (100 + target.def)) * attrModifier * wpPenalty * (1 + (skillLv - 1) * 0.1)));
            const newHp = target.currentHp - dmg;
            setPlayerState(p => ({ ...p, mp: p.mp - smp(5), ...mergeSkillCooldown(p, '매직 미사일') }));
            playSoundMagic();
            if (newHp <= 0) {
              response = handleEnemiesDefeat([target], `✨ [매직 미사일] 적중! [${target.name}] 撃破! (-${dmg})`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) {
                setTimeout(() => triggerEnemyTurn(remain), 300);
              } else {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0}));
                setSceneImage(BG_ALLEY);
                combatEndedThisCommand = true;
              }
            } else {
              setActiveEnemies(prev => prev.map((e, index) => index===0 ? {...e, currentHp: newHp, sleepTurns: 0} : e));
              response = `✨ [매직 미사일] [${target.name}]에게 ${dmg} 마법 데미지! (HP: ${newHp}/${target.maxHp})`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '파이어볼') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(15)) { response = `MP 부족 (${smp(15)} MP 필요)`; }
          else {
            setPlayerState(p => ({ ...p, mp: p.mp - smp(15), ...mergeSkillCooldown(p, '파이어볼') }));
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const weaponAttr = getPlayerWeaponAttr();
            const wpPenalty = getWeaponPenalty();
            const magicBaseDmgBase = (effAtk * 3.0) + (effInt * 3.5) + (effSpr * 1.2);
            const dmgResults = activeEnemies.map(e => {
               const part = pickHitPart();
               const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
               const isCrit = Math.random() < critChance;
               const critMult = magCritMult(isCrit);
               const rawDmg = Math.max(1, Math.round(magicBaseDmgBase * ((100 + effStr) / (100 + e.def)) * getDamageModifier(weaponAttr, e.armorAttr) * wpPenalty * critMult * optionFx.damageMult));
               return { e, rawDmg, isCrit, part };
            });
            playSoundMagic();
            let fireLog = '🔥 [파이어볼] 거대한 화염 폭발!!';
            const deadEnemies: ActiveEnemy[] = [];
            let anyCrit = false;
            
            const fireUpdated: ActiveEnemy[] = [];
            dmgResults.forEach(({e, rawDmg, isCrit, part}) => {
               const newHp = e.currentHp - rawDmg;
               if (isCrit) anyCrit = true;
               if (newHp <= 0) {
                 fireLog += `\n[${formatEnemyName(e)}] ${part}에 폭염! 撃破! (-${rawDmg})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
                 deadEnemies.push(e);
               } else {
                 fireUpdated.push({ ...e, currentHp: newHp, sleepTurns: 0, burnTurns: 2 }); // 화상 2턴 DoT (턴당 4 피해)
                 fireLog += `\n[${formatEnemyName({ ...e, currentHp: newHp })}] ${part}에 폭염! ${rawDmg} 데미지! 화상! (HP: ${newHp}/${e.maxHp}, 2턴 간 턴당 4 피해)${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
               }
            });
            if (anyCrit) fireLog += `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m`;
            const fireSurvivors = activeEnemies.filter(pe => !deadEnemies.some(d => d.id === pe.id)).map(pe => fireUpdated.find(u => u.id === pe.id) || pe);
            setActiveEnemies(fireSurvivors);
            if (deadEnemies.length > 0) fireLog += '\n' + handleEnemiesDefeat(deadEnemies, '🔥 다중 목표 격파!');
            if (fireSurvivors.length === 0) {
              stealthTurnsRef.current = 0;
              setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0}));
              setSceneImage(BG_ALLEY);
              combatEndedThisCommand = true;
            }
            response = fireLog;
            if (fireSurvivors.length > 0) setTimeout(() => triggerEnemyTurn(fireSurvivors), 300);
          }
        } else if (skillName === '파워 스트라이크') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(10)) { response = `MP 부족 (${smp(10)} MP 필요)`; }
          else {
            setPlayerState(p => ({ ...p, mp: p.mp - smp(10), ...mergeSkillCooldown(p, '파워 스트라이크') }));
            const target = activeEnemies[0];
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const part = pickHitPart();
            const weapon = getMergedEquippedItem(playerState.weapon, playerState.inventory);
            const minWp = weapon?.minDamage ?? 1;
            const maxWp = weapon?.maxDamage ?? 3;
            const finalMin = minWp + Math.floor((effStr || 10) * 0.3) + Math.floor((effDex || 10) * 0.3);
            const finalMax = maxWp + Math.floor((effStr || 10) * 0.6) + Math.floor((effDex || 10) * 0.5);
            const rolledWp = Math.floor(Math.random() * (finalMax - finalMin + 1)) + finalMin;
            const weaponAttr = getPlayerWeaponAttr();
            const attrModifier = getDamageModifier(weaponAttr, target.armorAttr);
            const wpPenalty = getWeaponPenalty();
            const statBonus = weaponAttr === '피어싱' ? effDex : effStr;
            const basePart = (playerState.atk * 2.4) + (rolledWp * 1.2) + statBonus;
            const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
            const isCrit = Math.random() < critChance;
            const critMult = magCritMult(isCrit);
            let dmg = Math.max(1, Math.round(basePart * ((100 + effStr) / (100 + effectiveEnemyDefForPhysical(target))) * attrModifier * wpPenalty * critMult * optionFx.damageMult));
            if (target.warriorMarkActive) dmg = applyWarriorMarkPhysicalDamage(target, dmg);
            const newHp = target.currentHp - dmg;
            playSoundSlash();
            if (newHp <= 0) {
              const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = handleEnemiesDefeat([target], `💥 [파워 스트라이크] ${part} 강타! (${weaponAttr} vs ${target.armorAttr} x${attrModifier}) ${dmg} 피해!${critFlavor} [${formatEnemyName(target)}] 撃破!`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) {
                setTimeout(() => triggerEnemyTurn(remain), 300);
              } else {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0}));
                setSceneImage(BG_ALLEY);
                combatEndedThisCommand = true;
              }
            } else {
              setActiveEnemies(prev => prev.map((e, index) => {
                if (index !== 0) return e;
                const u: ActiveEnemy = { ...e, currentHp: newHp, sleepTurns: 0 };
                if (target.warriorMarkActive) u.warriorMarkActive = false;
                return u;
              }));
              const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = `💥 [파워 스트라이크] ${part} 강타! (${weaponAttr} vs ${target.armorAttr} x${attrModifier}) ${dmg} 피해!${critFlavor}\n[대상: ${formatEnemyName({ ...target, currentHp: newHp })}] HP: ${newHp}/${target.maxHp}`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '회복의 빛') {
          if (playerState.mp < smp(15)) { response = `MP 부족 (${smp(15)} MP 필요)`; }
          else {
            playSoundMagic();
            setPlayerState(p => ({
              ...p,
              hp: Math.min(p.maxHp, p.hp + 40),
              mp: p.mp - smp(15),
              ...mergeSkillCooldown(p, '회복의 빛'),
            }));
            response = '✨ 회복의 빛! HP +40';
            triggerEnemyTurn(activeEnemies, undefined, 'neutral'); // 턴 소모 (회복·버프류 — 닥공 스택 유지)
          }
        } else if (skillName === '음파 폭발') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(20)) { response = `MP 부족 (${smp(20)} MP 필요)`; }
          else {
            setPlayerState(p => ({ ...p, mp: p.mp - smp(20), ...mergeSkillCooldown(p, '음파 폭발') }));
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const weapon = getMergedEquippedItem(playerState.weapon, playerState.inventory);
            const minWp = weapon?.minDamage ?? 1;
            const maxWp = weapon?.maxDamage ?? 3;
            // 마법 데미지는 지능(INT)과 정신(SPR)에 큰 영향을 받습니다.
            const finalMin = minWp + Math.floor((effSpr || 10) * 0.5);
            const finalMax = maxWp + Math.floor((effInt || 10) * 0.8);
            const rolledWp = Math.floor(Math.random() * (finalMax - finalMin + 1)) + finalMin;

            const weaponAttr = getPlayerWeaponAttr();
            const wpPenalty = getWeaponPenalty();
            const magicBaseDmgBase = (effAtk * 1.9) + (effInt * 1.9) + (effSpr * 0.6) + rolledWp;
            const dmgResults = activeEnemies.map(e => {
               const attrModifier = getDamageModifier(weaponAttr, e.armorAttr);
               const part = pickHitPart();
               const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
               const isCrit = Math.random() < critChance;
               const critMult = magCritMult(isCrit);
               const dmg = Math.max(1, Math.round(magicBaseDmgBase * ((100 + effStr) / (100 + e.def)) * attrModifier * wpPenalty * critMult * optionFx.damageMult));
               return { e, dmg, isCrit, part };
            });
            let logStr = '🔊 [음파 폭발] 광역 타격!';
            let liveEnemies = [...activeEnemies];
            const deadEnemies: ActiveEnemy[] = [];
            let anyCrit = false;
            dmgResults.forEach(({e, dmg, isCrit, part}) => {
              const newHp = e.currentHp - dmg;
              if (isCrit) anyCrit = true;
              if (newHp <= 0) {
                 logStr += `\n[${formatEnemyName(e)}] ${part}에 충격파! 撃破! (-${dmg})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
                 deadEnemies.push(e);
                 liveEnemies = liveEnemies.filter(le => le.id !== e.id);
              } else {
                 setActiveEnemies(prev => prev.map(pe => pe.id === e.id ? {...pe, currentHp: newHp, sleepTurns: 0} : pe));
                 logStr += `\n[${formatEnemyName({ ...e, currentHp: newHp })}] ${part}에 충격파! ${dmg} 데미지! (HP: ${newHp}/${e.maxHp})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
              }
            });
            if (anyCrit) logStr += `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m`;
            if (deadEnemies.length > 0) {
               logStr += '\n' + handleEnemiesDefeat(deadEnemies, '🔊 다중 목표 격파!');
               setActiveEnemies(liveEnemies);
               if (liveEnemies.length === 0) {
                 stealthTurnsRef.current = 0;
                 setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0}));
                 setSceneImage(BG_ALLEY);
                 combatEndedThisCommand = true;
               }
            }
            response = logStr;
            if (liveEnemies.length > 0) setTimeout(() => triggerEnemyTurn(liveEnemies), 300);
          }
        } else if (skillName === '사이버 클로') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(12)) { response = `MP 부족 (${smp(12)} MP 필요)`; }
          else {
            setPlayerState(p => ({ ...p, mp: p.mp - smp(12), ...mergeSkillCooldown(p, '사이버 클로') }));
            const target = activeEnemies[0];
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const weapon = getMergedEquippedItem(playerState.weapon, playerState.inventory);
            const weaponAttr = getPlayerWeaponAttr();
            const minWp = weapon?.minDamage ?? 1;
            const maxWp = weapon?.maxDamage ?? 3;
            const finalMin = minWp + Math.floor((effDex || 10) * 0.3);
            const finalMax = maxWp + Math.floor((effStr || 10) * 0.6);
            const attrModifier = getDamageModifier(weaponAttr, target.armorAttr);
            const defFactorVal = (100 + effStr) / (100 + target.def);
            const statBonus = weaponAttr === '피어싱' ? effDex : effStr;
            const wpPenalty = getWeaponPenalty();
            const rolledWp = Math.floor(Math.random() * (finalMax - finalMin + 1)) + finalMin;
            
            const multiHitBase = (effAtk * 1.0) + (rolledWp * 0.75) + (statBonus * 0.45);
            const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
            const parts: HitPart[] = [pickHitPart(), pickHitPart(), pickHitPart()];
            const c1 = Math.random() < critChance;
            const c2 = Math.random() < critChance;
            const c3 = Math.random() < critChance;
            const hit1 = Math.max(1, Math.round(multiHitBase * defFactorVal * attrModifier * wpPenalty * (c1 ? 1.5 : 1.0) * optionFx.damageMult));
            const hit2 = Math.max(1, Math.round(multiHitBase * defFactorVal * attrModifier * wpPenalty * (c2 ? 1.5 : 1.0) * optionFx.damageMult));
            const hit3 = Math.max(1, Math.round(multiHitBase * defFactorVal * attrModifier * wpPenalty * (c3 ? 1.5 : 1.0) * optionFx.damageMult));
            const totalDmg = hit1 + hit2 + hit3;
            const newHp = target.currentHp - totalDmg;
            if (newHp <= 0) {
              const anyCrit = c1 || c2 || c3;
              const critFlavor = anyCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = handleEnemiesDefeat([target], `🐾 [사이버 클로] 3연타! (${parts[0]}:${hit1}${c1 ? '!' : ''} + ${parts[1]}:${hit2}${c2 ? '!' : ''} + ${parts[2]}:${hit3}${c3 ? '!' : ''} = ${totalDmg})${critFlavor}\n(${weaponAttr} vs ${target.armorAttr} x${attrModifier}) [${formatEnemyName(target)}] 撃破!`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) {
                setTimeout(() => triggerEnemyTurn(remain), 300);
              } else {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0}));
                setSceneImage(BG_ALLEY);
                combatEndedThisCommand = true;
              }
            } else {
              setActiveEnemies(prev => prev.map((e, index) => index === 0 ? {...e, currentHp: newHp, sleepTurns: 0} : e));
              const anyCrit = c1 || c2 || c3;
              const critFlavor = anyCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = `🐾 [사이버 클로] 3연타! (${parts[0]}:${hit1}${c1 ? '!' : ''} + ${parts[1]}:${hit2}${c2 ? '!' : ''} + ${parts[2]}:${hit3}${c3 ? '!' : ''} = ${totalDmg})${critFlavor}\n[대상: ${formatEnemyName({ ...target, currentHp: newHp })}] HP: ${newHp}/${target.maxHp}`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '애기살') {
          if (!playerState.isCombat || activeEnemies.length === 0) {
            response = '전투 중이 아닙니다.';
          } else if (playerState.mp < smp(15)) {
            response = `MP 부족 (${smp(15)} MP 필요)`;
          } else {
            // WHY: 애기살은 설정상 회피·방어를 완전히 무시하는 연속 사격 스킬이다.
            //      명중 판정과 방어력을 모두 무시하고, 치명타와 능력치만 반영해 3연타를 고정으로 날린다.
            setPlayerState(p => ({ ...p, mp: p.mp - smp(15), ...mergeSkillCooldown(p, '애기살') }));
            const target = activeEnemies[0];
            const hits: number[] = [];
            const parts: HitPart[] = [];
            let totalDmg = 0;
            let anyCrit = false;
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            for (let i = 0; i < 3; i++) {
              let dmgBase = (effAtk * 0.6) + (effDex * 0.4);
              const rand = 0.9 + Math.random() * 0.2;
              const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
              const isCrit = Math.random() < critChance;
              if (isCrit) {
                dmgBase *= 1.5;
                anyCrit = true;
              }
              const hitDmg = Math.max(1, Math.round(dmgBase * rand * optionFx.damageMult));
              hits.push(hitDmg);
              parts.push(pickHitPart());
              totalDmg += hitDmg;
            }
            const newHp = target.currentHp - totalDmg;
            if (newHp <= 0) {
              const critFlavor = anyCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = handleEnemiesDefeat(
                [target],
                `🏹 [애기살] 방어·회피를 무시한 3연속 사격! (${parts[0]}:${hits[0]}${anyCrit ? '!' : ''} + ${parts[1]}:${hits[1]} + ${parts[2]}:${hits[2]}) = ${totalDmg} 피해!${critFlavor} [${formatEnemyName(target)}] 撃破!`
              );
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) {
                setTimeout(() => triggerEnemyTurn(remain), 300);
              } else {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
                combatEndedThisCommand = true;
              }
            } else {
              setActiveEnemies(prev =>
                prev.map((e, index) => (index === 0 ? { ...e, currentHp: newHp, sleepTurns: 0 } : e))
              );
              const critFlavor = anyCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = `🏹 [애기살] 방어·회피를 무시한 3연속 사격! (${parts[0]}:${hits[0]} + ${parts[1]}:${hits[1]} + ${parts[2]}:${hits[2]}) = ${totalDmg} 피해!${critFlavor}\n[대상: ${formatEnemyName({ ...target, currentHp: newHp })}] HP: ${newHp}/${target.maxHp}`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '멀티샷') {
          const bowForMultishot = getMergedEquippedItem(playerState.weapon, playerState.inventory);
          const bowName = resolveSlotToItemName(playerState.weapon, playerState.inventory) || '';
          if (bowForMultishot?.weaponClass !== 'bow' && !bowName.includes('활') && !bowName.includes('석궁')) {
            response = '활을 장착해야 [멀티샷]을 사용할 수 있습니다.';
          } else if (!playerState.isCombat || activeEnemies.length === 0) {
            response = '전투 중이 아닙니다.';
          } else if (playerState.mp < smp(18)) {
            response = `MP 부족 (${smp(18)} MP 필요)`;
          } else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(18),
              ...mergeSkillCooldown(p, '멀티샷'),
            }));
            const target = activeEnemies[0];
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const weaponAttr = getPlayerWeaponAttr();
            const attrModifier = getDamageModifier(weaponAttr, target.armorAttr);
            const wpPenalty = getWeaponPenalty();
            const penetrationStat = weaponAttr === '피어싱' ? (effDex || effStr) : effStr;
            const defFactor = (100 + penetrationStat) / (100 + target.def);
            const hits: number[] = [];
            const parts: HitPart[] = [];
            let anyCrit = false;
            let totalDmg = 0;
            for (let i = 0; i < 3; i++) {
              const dmgBase = (effAtk * 0.5) + (effDex * 0.5);
              const rand = 0.9 + Math.random() * 0.2;
              const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
              const isCrit = Math.random() < critChance;
              const critMult = magCritMult(isCrit);
              if (isCrit) anyCrit = true;
              const hitDmg = Math.max(1, Math.round(dmgBase * rand * critMult * defFactor * attrModifier * wpPenalty * optionFx.damageMult));
              hits.push(hitDmg);
              parts.push(pickHitPart());
              totalDmg += hitDmg;
            }
            const newHp = target.currentHp - totalDmg;
            if (newHp <= 0) {
              const critFlavor = anyCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = handleEnemiesDefeat(
                [target],
                `🏹 [멀티샷] 3발 연사! (${parts[0]}:${hits[0]} + ${parts[1]}:${hits[1]} + ${parts[2]}:${hits[2]}) = ${totalDmg} 피해!${critFlavor} [${formatEnemyName(target)}] 撃破!`
              );
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) {
                setTimeout(() => triggerEnemyTurn(remain), 300);
              } else {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
                combatEndedThisCommand = true;
              }
            } else {
              setActiveEnemies(prev =>
                prev.map((e, index) => (index === 0 ? { ...e, currentHp: newHp, sleepTurns: 0 } : e))
              );
              const critFlavor = anyCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = `🏹 [멀티샷] 3발 연사! (${parts[0]}:${hits[0]} + ${parts[1]}:${hits[1]} + ${parts[2]}:${hits[2]}) = ${totalDmg} 피해!${critFlavor}\n[대상: ${formatEnemyName({ ...target, currentHp: newHp })}] HP: ${newHp}/${target.maxHp}`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '에로우 샤워') {
          const bowForShower = getMergedEquippedItem(playerState.weapon, playerState.inventory);
          const bowNameShower = resolveSlotToItemName(playerState.weapon, playerState.inventory) || '';
          if (bowForShower?.weaponClass !== 'bow' && !bowNameShower.includes('활') && !bowNameShower.includes('석궁')) {
            response = '활을 장착해야 [에로우 샤워]를 사용할 수 있습니다.';
          } else if (!playerState.isCombat || activeEnemies.length === 0) {
            response = '전투 중이 아닙니다.';
          } else if (playerState.mp < smp(28)) {
            response = `MP 부족 (${smp(28)} MP 필요)`;
          } else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(28),
              ...mergeSkillCooldown(p, '에로우 샤워'),
            }));
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const weaponAttr = getPlayerWeaponAttr();
            const wpPenalty = getWeaponPenalty();
            const AOE_MULT = 0.75; // 광역이라 적당히 감쇠
            const dmgBase = (effAtk * 0.9) + (effDex * 0.7);
            const penetrationStat = weaponAttr === '피어싱' ? (effDex || effStr) : effStr;
            const dmgResults = activeEnemies.map(e => {
              const defFactor = (100 + penetrationStat) / (100 + e.def);
              const attrModifier = getDamageModifier(weaponAttr, e.armorAttr);
              const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
              const isCrit = Math.random() < critChance;
              const critMult = magCritMult(isCrit);
              const dmg = Math.max(1, Math.round(dmgBase * defFactor * attrModifier * wpPenalty * AOE_MULT * critMult * optionFx.damageMult));
              return { e, dmg, isCrit, part: pickHitPart() };
            });
            let logStr = '🌧️ [에로우 샤워] 화살비가 적군을 덮칩니다!';
            const deadEnemies: ActiveEnemy[] = [];
            const liveEnemies: ActiveEnemy[] = [];
            let anyCrit = false;
            dmgResults.forEach(({ e, dmg, isCrit, part }) => {
              const newHp = e.currentHp - dmg;
              if (isCrit) anyCrit = true;
              if (newHp <= 0) {
                logStr += `\n[${formatEnemyName(e)}] ${part} 적중! 撃破! (-${dmg})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
                deadEnemies.push(e);
              } else {
                liveEnemies.push({ ...e, currentHp: newHp, sleepTurns: 0 });
                logStr += `\n[${formatEnemyName({ ...e, currentHp: newHp })}] ${part} 적중! ${dmg} 데미지! (HP: ${newHp}/${e.maxHp})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
              }
            });
            if (anyCrit) logStr += `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m`;
            setActiveEnemies(liveEnemies);
            if (deadEnemies.length > 0) {
              logStr += '\n' + handleEnemiesDefeat(deadEnemies, '🌧️ 에로우 샤워 격파!');
              if (liveEnemies.length === 0) {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
                combatEndedThisCommand = true;
              }
            }
            response = logStr;
            if (liveEnemies.length > 0) setTimeout(() => triggerEnemyTurn(liveEnemies), 300);
          }
        } else if (skillName === '의지의 방어막') {
          if (playerState.mp < smp(20)) { response = `MP 부족 (${smp(20)} MP 필요)`; }
          else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(20),
              def: p.def + 15,
              ...mergeSkillCooldown(p, '의지의 방어막'),
            }));
            response = '🛡 의지의 방어막 발동! DEF +15 (영구 상승/수정필요)';
            triggerEnemyTurn(activeEnemies, undefined, 'neutral'); // 턴 소모 (회복·버프류 — 닥공 스택 유지)
          }
        } else if (skillName === '데이터 도둑') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(8)) { response = `MP 부족 (${smp(8)} MP 필요)`; }
          else {
            setPlayerState(p => ({ ...p, mp: p.mp - smp(8), ...mergeSkillCooldown(p, '데이터 도둑') }));
            const target = activeEnemies[0];
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const part = pickHitPart();
            const weapon = getMergedEquippedItem(playerState.weapon, playerState.inventory);
            const minWp = weapon?.minDamage ?? 1;
            const maxWp = weapon?.maxDamage ?? 3;
            // 도적계 스킬 데이터 도둑은 민첩 보정이 높음
            const finalMin = minWp + Math.floor((playerState.dex || 10) * 0.4);
            const finalMax = maxWp + Math.floor((playerState.dex || 10) * 0.6);
            const rolledWp = Math.floor(Math.random() * (finalMax - finalMin + 1)) + finalMin;

            const weaponAttr = getPlayerWeaponAttr();
            const attrModifier = getDamageModifier(weaponAttr, target.armorAttr);
            const wpPenalty = getWeaponPenalty();
            const statBonus = weaponAttr === '피어싱' ? playerState.dex : playerState.str;
            const basePart = (playerState.atk * 0.5) + rolledWp + (statBonus * 0.4);
            const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
            const isCrit = Math.random() < critChance;
            const critMult = magCritMult(isCrit);
            const dmg = Math.max(1, Math.round(basePart * ((100 + playerState.str) / (100 + target.def)) * attrModifier * wpPenalty * critMult * optionFx.damageMult));
            const newHp = target.currentHp - dmg;
            if (newHp <= 0) {
              const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = handleEnemiesDefeat([target], `📡 [데이터 도둑] ${part}에서 데이터를 뜯어냈다! (-${dmg})${critFlavor}\n[${formatEnemyName(target)}] 撃破!`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) setTimeout(() => triggerEnemyTurn(remain), 300);
              else { stealthTurnsRef.current = 0; setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0})); setSceneImage(BG_ALLEY); }
            } else {
              setActiveEnemies(prev => prev.map((e, index) => index === 0 ? { ...e, def: Math.max(0, (e.def ?? 0) - 5), currentHp: newHp, sleepTurns: 0 } : e));
              const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = `💻 [데이터 도둑] ${part} 침투! 적 DEF -5 & (${weaponAttr} vs ${target.armorAttr} x${attrModifier}) ${dmg} 피해!${critFlavor}\n[대상: ${formatEnemyName({ ...target, currentHp: newHp })}] HP: ${newHp}/${target.maxHp}`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '라이트닝 볼트') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(25)) { response = `MP 부족 (${smp(25)} MP 필요)`; }
          else {
            setPlayerState(p => ({ ...p, mp: p.mp - smp(25), ...mergeSkillCooldown(p, '라이트닝 볼트') }));
            const target = activeEnemies[0];
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const part = pickHitPart();
            const weaponAttr = getPlayerWeaponAttr();
            const wpPenalty = getWeaponPenalty();
            const magicBaseDmgBase = (effAtk * 3.5) + (effInt * 4) + (effSpr * 1);
            const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
            const isCrit = Math.random() < critChance;
            const critMult = magCritMult(isCrit);
            const dmg = Math.max(1, Math.round(magicBaseDmgBase * ((100 + effStr) / (100 + target.def)) * getDamageModifier(weaponAttr, target.armorAttr) * wpPenalty * critMult * optionFx.damageMult));
            const newHp = target.currentHp - dmg;
            if (newHp <= 0) {
              const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = handleEnemiesDefeat([target], `⚡ [라이트닝 볼트] ${part} 관통! (-${dmg})${critFlavor}\n[${formatEnemyName(target)}] 撃破!`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) setTimeout(() => triggerEnemyTurn(remain), 300);
              else { stealthTurnsRef.current = 0; setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0})); setSceneImage(BG_ALLEY); }
            } else {
              setActiveEnemies(prev =>
                prev.map((e, index) =>
                  index === 0
                    ? clearEnemyHeavyIntent({ ...e, currentHp: newHp, sleepTurns: 0, stunTurns: 1 })
                    : e,
                ),
              ); // 전기 스턴 1턴 → 강공격 예고 해제
              const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = `⚡ [라이트닝 볼트] ${part} 관통! ${dmg} 데미지! 스턴!${critFlavor}\n[대상: ${formatEnemyName({ ...target, currentHp: newHp })}] (HP: ${newHp}/${target.maxHp}, 다음 턴 행동 불가)`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '체인 라이트닝') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(30)) { response = `MP 부족 (${smp(30)} MP 필요)`; }
          else {
            setPlayerState(p => ({ ...p, mp: p.mp - smp(30), ...mergeSkillCooldown(p, '체인 라이트닝') }));
            let chainLog = '🌩️ [체인 라이트닝] 전격이 적들 사이를 튕겨다닙니다!';
            const multipliers = [1.0, 0.7, 0.5]; // 100% -> 70% -> 50%
            const weaponAttr = getPlayerWeaponAttr();
            const chainUpdated: ActiveEnemy[] = [];
            const deadEnemies: ActiveEnemy[] = [];
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            let anyCrit = false;
            const magicBaseDmgBase = (effAtk * 2.5) + (effInt * 3) + (effSpr * 1);
            
            activeEnemies.forEach((e, idx) => {
               if (idx >= multipliers.length) return; // 3명까지만 연쇄
               const m = multipliers[idx];
               const wpPenalty = getWeaponPenalty();
               const part = pickHitPart();
               const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
               const isCrit = Math.random() < critChance;
               if (isCrit) anyCrit = true;
               const critMult = magCritMult(isCrit);
               const rawDmg = Math.max(1, Math.round((magicBaseDmgBase * m) * ((100 + effStr) / (100 + e.def)) * getDamageModifier(weaponAttr, e.armorAttr) * wpPenalty * critMult * optionFx.damageMult));
               const newHp = e.currentHp - rawDmg;
               if (newHp <= 0) {
                 chainLog += `\n⚡ [${idx+1}연쇄] [${formatEnemyName(e)}] ${part} 감전! 撃破! (-${rawDmg})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
                 deadEnemies.push(e);
               } else {
                 chainUpdated.push(clearEnemyHeavyIntent({ ...e, currentHp: newHp, sleepTurns: 0, stunTurns: 1 }));
                 chainLog += `\n⚡ [${idx+1}연쇄] [${formatEnemyName({ ...e, currentHp: newHp })}] ${part} 감전! ${rawDmg} 데미지! 스턴! (HP: ${newHp}/${e.maxHp})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
               }
            });
            if (anyCrit) chainLog += `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m`;
            const chainSurvivors = activeEnemies.filter(pe => !deadEnemies.some(d => d.id === pe.id)).map(pe => chainUpdated.find(u => u.id === pe.id) || pe);
            setActiveEnemies(chainSurvivors);
            if (deadEnemies.length > 0) {
               chainLog += '\n' + handleEnemiesDefeat(deadEnemies, '⚡ 연쇄 감전 격파!');
               if (chainSurvivors.length === 0) { stealthTurnsRef.current = 0; setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0})); setSceneImage(BG_ALLEY); }
            }
            response = chainLog;
            if (chainSurvivors.length > 0) setTimeout(() => triggerEnemyTurn(chainSurvivors), 300);
          }
        } else if (skillName === '힐') {
          if (playerState.mp < smp(20)) { response = `MP 부족 (${smp(20)} MP 필요)`; }
          else {
             const healAmt = Math.floor(playerState.maxHp * 0.7);
             setPlayerState(p => ({
               ...p,
               mp: p.mp - smp(20),
               hp: Math.min(p.maxHp, p.hp + healAmt),
               ...mergeSkillCooldown(p, '힐'),
             }));
             response = `💚 [힐] 성스러운 빛이 몸을 감싸 안습니다! (HP +${healAmt} 회복)`;
             triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '아이스 스피어') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(12)) { response = `MP 부족 (${smp(12)} MP 필요)`; }
          else {
            const target = activeEnemies[0];
            const dmg = Math.max(1, Math.round(((effAtk * 1.5) + (effInt * 2.5)) * ((100 + effStr) / (100 + target.def))));
            const newHp = target.currentHp - dmg;
            setPlayerState(p => ({ ...p, mp: p.mp - smp(12), ...mergeSkillCooldown(p, '아이스 스피어') }));
            playSoundMagic();
            if (newHp <= 0) {
              response = handleEnemiesDefeat([target], `❄️ [아이스 스피어] 얼음 창이 관통했습니다! [${target.name}] 撃破! (-${dmg})`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) setTimeout(() => triggerEnemyTurn(remain), 300);
              else { stealthTurnsRef.current = 0; setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0})); setSceneImage(BG_ALLEY); }
            } else {
              setActiveEnemies(prev => prev.map((e, index) => {
                if (index !== 0) return e;
                const currentFreeze = e.freezeTurns || 0;
                const MAX_FREEZE_TURNS = 1;
                let nextFreeze = currentFreeze;
                if (currentFreeze <= 0) {
                  nextFreeze = 1;
                } else if (Math.random() < 0.5) {
                  nextFreeze = Math.min(MAX_FREEZE_TURNS, currentFreeze + 1);
                }
                return { ...e, currentHp: newHp, sleepTurns: 0, freezeTurns: nextFreeze };
              })); // 빙결 1턴 (연장 없음)
              response = `❄️ [아이스 스피어] 빙결 타격! ${dmg} 데미지! (HP: ${newHp}/${target.maxHp})`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '메테오 스트라이크' || skillName === '블리자드') {
          const mpReq = smp(skillName === '블리자드' ? 30 : 35);
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < mpReq) { response = `MP 부족 (${mpReq} MP 필요)`; }
          else {
            setPlayerState(p => ({ ...p, mp: p.mp - mpReq, ...mergeSkillCooldown(p, skillName) }));
            const dmgBase = skillName === '블리자드'
              ? (effAtk * 1.5) + (effInt * 2)
              : (effAtk * 2.0) + (effInt * 3);
            let logStr = skillName === '블리자드' ? '🌨️ [블리자드] 가혹한 눈보라!!' : '☄️ [메테오 스트라이크] 거대한 운석 충돌!!';
            playSoundMagic();
            const deadEnemies: ActiveEnemy[] = [];
            const meteorBlizzUpdated: ActiveEnemy[] = [];
            activeEnemies.forEach(e => {
               const rawDmg = Math.max(1, Math.round(dmgBase * ((100 + effStr) / (100 + e.def))));
               const newHp = e.currentHp - rawDmg;
               if (newHp <= 0) {
                 logStr += `\n[${e.name}] 撃破! (-${rawDmg})`;
                 deadEnemies.push(e);
               } else {
                 if (skillName === '메테오 스트라이크') {
                   meteorBlizzUpdated.push({ ...e, currentHp: newHp, sleepTurns: 0, burnTurns: 3 });
                   logStr += `\n[${e.name}]에게 ${rawDmg} 데미지! 화상 3턴! (HP: ${newHp}/${e.maxHp})`;
                 } else {
                   const currentFreeze = e.freezeTurns || 0;
                   const MAX_FREEZE_TURNS = 1;
                   let nextFreeze = currentFreeze;
                   if (currentFreeze <= 0) {
                     nextFreeze = 1;
                   } else if (Math.random() < 0.5) {
                     nextFreeze = Math.min(MAX_FREEZE_TURNS, currentFreeze + 1);
                   }
                   meteorBlizzUpdated.push({ ...e, currentHp: newHp, sleepTurns: 0, freezeTurns: nextFreeze });
                   logStr += `\n[${e.name}]에게 ${rawDmg} 데미지! 빙결! (HP: ${newHp}/${e.maxHp})`;
                 }
               }
            });
            const mbSurvivors = activeEnemies.filter(pe => !deadEnemies.some(d => d.id === pe.id)).map(pe => meteorBlizzUpdated.find(u => u.id === pe.id) || pe);
            setActiveEnemies(mbSurvivors);
            if (deadEnemies.length > 0) {
              logStr += '\n' + handleEnemiesDefeat(deadEnemies, '💥 다중 목표 격파!');
              if (mbSurvivors.length === 0) { stealthTurnsRef.current = 0; setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0})); setSceneImage(BG_ALLEY); }
            }
            response = logStr;
            if (mbSurvivors.length > 0) setTimeout(() => triggerEnemyTurn(mbSurvivors), 300);
          }
        } else if (skillName === '펄스 노바') {
          const mpReq = smp(22);
          if (!playerState.isCombat || activeEnemies.length === 0) {
            response = '전투 중이 아닙니다.';
          } else if (playerState.mp < mpReq) {
            response = `MP 부족 (${mpReq} MP 필요)`;
          } else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - mpReq,
              ...mergeSkillCooldown(p, '펄스 노바'),
            }));
            playSoundMagic();
            const dmgBase = effAtk * 1.12 + effInt * 2.05 + effSpr * 0.4;
            let logStr = '💠 [펄스 노바] 마력의 고리가 터지며 주변을 강타합니다!';
            const deadEnemies: ActiveEnemy[] = [];
            const pulseUpdated: ActiveEnemy[] = [];
            activeEnemies.forEach((e) => {
              const rawDmg = Math.max(1, Math.round(dmgBase * ((100 + effStr) / (100 + e.def))));
              const newHp = e.currentHp - rawDmg;
              if (newHp <= 0) {
                logStr += `\n[${e.name}] 撃破! (-${rawDmg})`;
                deadEnemies.push(e);
              } else {
                pulseUpdated.push(
                  clearEnemyHeavyIntent({
                    ...e,
                    currentHp: newHp,
                    sleepTurns: 0,
                    staggerTurns: Math.min(10, (e.staggerTurns ?? 0) + 2),
                  }),
                );
                logStr += `\n[${e.name}] ${rawDmg} 데미지! 전격 파동! (HP: ${newHp}/${e.maxHp})`;
              }
            });
            const pulseSurvivors = activeEnemies
              .filter((pe) => !deadEnemies.some((d) => d.id === pe.id))
              .map((pe) => pulseUpdated.find((u) => u.id === pe.id) || pe);
            setActiveEnemies(pulseSurvivors);
            if (deadEnemies.length > 0) {
              logStr += '\n' + handleEnemiesDefeat(deadEnemies, '💠 펄스 파동으로 적이 쓰러졌다!');
              if (pulseSurvivors.length === 0) {
                stealthTurnsRef.current = 0;
                setPlayerState((p) => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
              }
            }
            response = logStr;
            if (pulseSurvivors.length > 0) setTimeout(() => triggerEnemyTurn(pulseSurvivors), 300);
          }
        } else if (skillName === '스타폴') {
          const mpReq = smp(30);
          if (!playerState.isCombat || activeEnemies.length === 0) {
            response = '전투 중이 아닙니다.';
          } else if (playerState.mp < mpReq) {
            response = `MP 부족 (${mpReq} MP 필요)`;
          } else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - mpReq,
              ...mergeSkillCooldown(p, '스타폴'),
            }));
            playSoundMagic();
            const dmgBase = effAtk * 1.45 + effInt * 2.35;
            let logStr = '✨ [스타폴] 밤하늘의 별이 일제히 떨어집니다!';
            const deadEnemies: ActiveEnemy[] = [];
            const starUpdated: ActiveEnemy[] = [];
            activeEnemies.forEach((e) => {
              const rawDmg = Math.max(1, Math.round(dmgBase * ((100 + effStr) / (100 + e.def))));
              const newHp = e.currentHp - rawDmg;
              if (newHp <= 0) {
                logStr += `\n[${e.name}] 撃破! (-${rawDmg})`;
                deadEnemies.push(e);
              } else {
                starUpdated.push(
                  clearEnemyHeavyIntent({
                    ...e,
                    currentHp: newHp,
                    sleepTurns: 0,
                    burnTurns: Math.max(2, e.burnTurns ?? 0),
                  }),
                );
                logStr += `\n[${e.name}] ${rawDmg} 데미지! 잔열이 남습니다. (HP: ${newHp}/${e.maxHp})`;
              }
            });
            const starSurvivors = activeEnemies
              .filter((pe) => !deadEnemies.some((d) => d.id === pe.id))
              .map((pe) => starUpdated.find((u) => u.id === pe.id) || pe);
            setActiveEnemies(starSurvivors);
            if (deadEnemies.length > 0) {
              logStr += '\n' + handleEnemiesDefeat(deadEnemies, '✨ 유성비에 적이 녹아내렸다!');
              if (starSurvivors.length === 0) {
                stealthTurnsRef.current = 0;
                setPlayerState((p) => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
              }
            }
            response = logStr;
            if (starSurvivors.length > 0) setTimeout(() => triggerEnemyTurn(starSurvivors), 300);
          }
        } else if (skillName === '마력의 순환') {
          if (!playerState.isCombat) { response = '전투 중이 아닙니다.'; }
          else if (isManaShieldRegenSuppressed(playerState)) {
            response =
              '🔮 [마나 실드]가 펼쳐진 동안에는 마력의 순환으로 MP를 모을 수 없습니다. (실드 해제 후 사용)';
          } else {
            const healMp = Math.floor(playerState.maxMp * 0.4);
            setPlayerState(p => ({
              ...p,
              mp: Math.min(p.maxMp, p.mp + healMp),
              ...mergeSkillCooldown(p, '마력의 순환'),
            }));
            response = `🌀 [마력의 순환] 자연의 기운을 흡수합니다! (MP +${healMp})`;
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '마나 실드') {
          if (!playerCanUseManaShield(playerState)) {
            response =
              '[마나 실드] 비전서를 배우거나, 악세서리 감정 옵션 「마나의 막」이 붙은 장비를 착용해야 합니다.';
          } else if (playerState.manaShieldActive) {
            setPlayerState(p => ({ ...p, manaShieldActive: false }));
            response = '🔮 [마나 실드] 방어막을 거뒀습니다. MP 회복 제한이 풀립니다.';
            if (playerState.isCombat) triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          } else if ((playerState.mp ?? 0) <= 0) {
            response = 'MP가 없어 마나 실드를 펼칠 수 없습니다. (최소 1 이상)';
          } else {
            setPlayerState(p => ({ ...p, manaShieldActive: true }));
            response =
              '🔮 [마나 실드] 마나의 막이 깔렸습니다. 맞을 때 HP 대신 MP가 소모되며, 켜 둔 동안 MP 자연 회복이 멈춥니다. (다시 쓰면 해제 · MP 0이면 자동 해제)';
            if (playerState.isCombat) triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '신의 방패' || skillName === '불굴의 의지' || skillName === '광폭화' || skillName === '축복') {
          if (skillName === '불굴의 의지') {
            if (playerState.mp < smp(20)) { response = `MP 부족 (${smp(20)} MP 필요)`; }
            else {
              setPlayerState(p => ({
                ...p,
                mp: p.mp - smp(20),
                hp: Math.min(p.maxHp, p.hp + 50),
                ...mergeSkillCooldown(p, '불굴의 의지'),
              }));
              response = '🩸 [불굴의 의지] 체력을 회복합니다! (HP +50)';
              if (playerState.isCombat) triggerEnemyTurn(activeEnemies, undefined, 'neutral');
            }
          } else if (skillName === '축복') {
            if (playerState.mp < smp(10)) { response = `MP 부족 (${smp(10)} MP 필요)`; }
            else {
              const atkBonus = 6 + Math.floor((effSpr ?? 0) * 0.3);
              setPlayerState(p => {
                const prevBonus = p.blessAtkBonus ?? 0;
                const baseAtk = p.atk - prevBonus;
                return {
                  ...p,
                  mp: p.mp - smp(10),
                  atk: baseAtk + atkBonus,
                  blessTurns: 10,
                  blessAtkBonus: atkBonus,
                  ...mergeSkillCooldown(p, '축복'),
                };
              });
              setHasBlessBuff(true);
              response = `🙏 [축복] 신앙심(정신력)이 담긴 축복으로 공격력이 10턴 동안 상승합니다! (ATK +${atkBonus})`;
              if (playerState.isCombat) triggerEnemyTurn(activeEnemies, undefined, 'neutral');
            }
          } else {
            if (!playerState.isCombat) { response = '전투 중이 아닙니다.'; }
            else if (skillName !== '신의 방패' && playerState.mp < smp(15)) { response = `MP 부족`; }
            else {
               if (skillName === '신의 방패') {
                 // 맞을 때 HP 대신 MP 소모. MP 0이면 HP 감소. 5턴 유지.
                 const defBonus = 20 + Math.floor((effSpr ?? 0) * 0.8);
                 setPlayerState(p => ({
                   ...p,
                   def: p.def + defBonus,
                   godShieldTurns: 5,
                   ...mergeSkillCooldown(p, '신의 방패'),
                 }));
                 response = `🛡️ [신의 방패] 신앙심(정신력)이 담긴 성스러운 방어막이 펼쳐집니다! (방어력 +${defBonus}) — 5턴 간 맞을 때 HP 대신 MP 소모, MP 0이면 HP 감소`;
                 triggerEnemyTurn(activeEnemies, undefined, 'neutral');
               } else {
                 setPlayerState(p => ({
                   ...p,
                   mp: p.mp - smp(15),
                   atk: p.atk + 20,
                   def: Math.max(0, p.def - 10),
                   ...mergeSkillCooldown(p, '광폭화'),
                 }));
                 response = '💢 [광폭화] 이성을 잃고 공격력이 대폭 상승합니다! (방어력 감소)';
                 triggerEnemyTurn(activeEnemies);
               }
            }
          }
        } else if (skillName === '구원의 손길') {
           if (playerState.mp < smp(30)) { response = `MP 부족 (${smp(30)} MP 필요)`; }
           else {
             const healAmount = 80 + (effSpr ?? 0) * 2;
             setPlayerState(p => ({
               ...p,
               mp: p.mp - smp(30),
               hp: Math.min(p.maxHp, p.hp + healAmount),
               ...mergeSkillCooldown(p, '구원의 손길'),
             }));
             response = `🤲 [구원의 손길] 신앙심(정신력)이 담긴 기적이 일어났습니다! (HP +${healAmount})`;
             if (playerState.isCombat) triggerEnemyTurn(activeEnemies, undefined, 'neutral');
           }
        } else if (skillName === '회복 기도') {
           if (playerState.mp < smp(8)) { response = `MP 부족 (${smp(8)} MP 필요)`; }
           else {
             const perTurn = 5 + Math.floor((effSpr ?? 0) * 0.25);
             setPlayerState(p => ({
               ...p,
               mp: p.mp - smp(8),
               prayerHealTurns: 4,
               prayerHealPerTurn: perTurn,
               ...mergeSkillCooldown(p, '회복 기도'),
             }));
             response = `📿 [회복 기도] 신앙심(정신력)이 담긴 기도의 은총이 4턴 동안 HP를 회복합니다. (턴당 ${perTurn} HP)`;
             if (playerState.isCombat) triggerEnemyTurn(activeEnemies, undefined, 'neutral');
           }
        } else if (skillName === '생명력 전환') {
           // HP를 소모해 MP 회복. 최소 HP 1 유지. 신앙심(정신력)에 따라 회복량 증가
           const hpCost = Math.max(10, Math.floor((playerState.maxHp ?? 100) * 0.2));
           const minHpToUse = hpCost + 1;
           if (playerState.hp < minHpToUse) {
             response = `HP가 부족합니다. (현재 ${playerState.hp}/${playerState.maxHp}, 최소 ${minHpToUse} 필요)`;
           } else {
             const mpGain = 15 + Math.floor((effSpr ?? 0) * 1.2);
             setPlayerState(p => ({
               ...p,
               hp: Math.max(1, p.hp - hpCost),
               mp: Math.min(p.maxMp, p.mp + mpGain),
               ...mergeSkillCooldown(p, '생명력 전환'),
             }));
             response = `🩸 [생명력 전환] 생명력을 바쳐 정신력을 회복했습니다. (HP -${hpCost}, MP +${mpGain})`;
             if (playerState.isCombat) triggerEnemyTurn(activeEnemies, undefined, 'neutral');
           }
        } else if (skillName === '정화') {
           if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
           else if (playerState.mp < smp(12)) { response = `MP 부족 (${smp(12)} MP 필요)`; }
           else {
             setPlayerState(p => ({ ...p, mp: p.mp - smp(12), ...mergeSkillCooldown(p, '정화') }));
             const target = activeEnemies[0];
             const wpPenalty = getWeaponPenalty();
             // 신앙심(정신력) 기반 — INT 대신 SPR만 사용
             const magicBase = (effAtk * 1.2) + (effSpr * 2.2);
             const undeadBonus = (target.name.includes('언데드') || target.id.includes('undead')) ? 1.5 : 1.0;
             const dmg = Math.max(1, Math.round(magicBase * ((100 + effStr) / (100 + target.def)) * getDamageModifier('마법', target.armorAttr) * wpPenalty * undeadBonus));
             const newHp = target.currentHp - dmg;
             playSoundMagic();
             if (newHp <= 0) {
               response = handleEnemiesDefeat([target], `💫 [정화] 신성한 빛! [${target.name}] 撃破! (-${dmg})`);
               const remain = activeEnemies.filter((_, i) => i !== 0);
               setActiveEnemies(remain);
               if (remain.length === 0) { stealthTurnsRef.current = 0; setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0})); setSceneImage(BG_ALLEY); }
               else setTimeout(() => triggerEnemyTurn(remain), 300);
             } else {
               setActiveEnemies(prev => prev.map((e, i) => i === 0 ? { ...e, currentHp: newHp, sleepTurns: 0 } : e));
               response = `💫 [정화] 신성한 빛이 적을 내리칩니다! ${dmg} 데미지! (HP: ${newHp}/${target.maxHp})${undeadBonus > 1 ? ' (언데드에게 추가 피해!)' : ''}`;
               triggerEnemyTurn(activeEnemies);
             }
           }
        } else if (skillName === '홀리 스마이트') {
           // Lv1=데미지 1/2·MP 60, Lv2=중간·MP 90, Lv3=데미지 4/3·MP 120 (강화 시 위력·MP 동시 상승)
           const 홀리스마이트레벨 = Math.max(1, Math.min(3, (playerState.skillLevels || {})['홀리 스마이트'] || 1));
           const 홀리스마이트MP맵: Record<number, number> = { 1: 60, 2: 90, 3: 120 };
           const reqMp = smp(홀리스마이트MP맵[홀리스마이트레벨]);
           const 홀리스마이트데미지배율 = 홀리스마이트레벨 === 1 ? 0.5 : 홀리스마이트레벨 === 2 ? (0.5 + 4/3) / 2 : 4/3; // Lv1=1/2, Lv2=11/12, Lv3=4/3
           if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
           else if (playerState.mp < reqMp) { response = `MP 부족 (${reqMp} MP 필요)`; }
           else {
             setPlayerState(p => ({ ...p, mp: p.mp - reqMp, ...mergeSkillCooldown(p, '홀리 스마이트') }));
             const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
             // 신앙심(정신력) 기반 — INT 대신 SPR만 사용. 최대 MP 25% 보너스. 광역이라 데미지 50%로 감쇠
             const baseMulti = 1.5;
             const dmgBase = effAtk * baseMulti + (effStr ?? 0) * (baseMulti * 0.5) + (effSpr ?? 0) * 2.2;
             const bonusFromMp = Math.floor(playerState.maxMp * 0.25);
             const wpPenalty = getWeaponPenalty();
             const holySmiteScale = 0.5; // 광역이라 절반만 적용
             playSoundMagic();
             let logStr = '✝️ [홀리 스마이트] 성스러운 빛이 모든 적을 내리칩니다!';
             const deadEnemies: ActiveEnemy[] = [];
             const updatedEnemies: ActiveEnemy[] = [];
             let anyCrit = false;
             activeEnemies.forEach(e => {
               const part = pickHitPart();
               const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
               const isCrit = Math.random() < critChance;
               if (isCrit) anyCrit = true;
               const critMult = magCritMult(isCrit);
               const defFactor = (100 + (effStr ?? 0)) / (100 + e.def);
               const attrMod = getDamageModifier('마법', e.armorAttr);
               let rawDmg = Math.max(1, Math.round((dmgBase + bonusFromMp) * defFactor * attrMod * wpPenalty * holySmiteScale * critMult * optionFx.damageMult));
               rawDmg = Math.max(1, Math.round(rawDmg * 홀리스마이트데미지배율));
               const newHp = e.currentHp - rawDmg;
               if (newHp <= 0) {
                 logStr += `\n[${formatEnemyName(e)}] ${part}에 성광! 撃破! (-${rawDmg})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
                 deadEnemies.push(e);
               } else {
                 updatedEnemies.push({ ...e, currentHp: newHp, sleepTurns: 0 });
                 logStr += `\n[${formatEnemyName({ ...e, currentHp: newHp })}] ${part}에 성광! ${rawDmg} 피해! (HP: ${newHp}/${e.maxHp})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
               }
             });
             if (anyCrit) logStr += `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m`;
             setActiveEnemies(updatedEnemies);
             if (deadEnemies.length > 0) {
               logStr += '\n' + handleEnemiesDefeat(deadEnemies, '✝️ 다중 목표 격파!');
               if (updatedEnemies.length === 0) { stealthTurnsRef.current = 0; setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0})); setSceneImage(BG_ALLEY); }
             }
             response = logStr;
             if (updatedEnemies.length > 0) setTimeout(() => triggerEnemyTurn(updatedEnemies), 300);
           }
        } else if (skillName === '징벌' || skillName === '천벌' || skillName === '돌진' || skillName === '처형' || skillName === '급소 찌르기' || skillName === '스나이프' || skillName === '헤드샷' || skillName === '맹독 단검' || skillName === '페인 딜러' || skillName === '라스트 콜' || skillName === '지갑선 끊기') {
           // 천벌: Lv1=데미지 1/3·MP 10, Lv2=2/3·MP 16, Lv3+=풀 데미지·MP 22 (업그레이드 시 위력·MP 동시 상승)
           const 천벌레벨 = Math.max(1, Math.min(3, (playerState.skillLevels || {})['천벌'] || 1));
           const 천벌MP맵: Record<number, number> = { 1: 10, 2: 16, 3: 22 };
           const mpMap: Record<string, number> = {
             징벌: 25,
             천벌: skillName === '천벌' ? 천벌MP맵[천벌레벨] : 22,
             돌진: 15,
             처형: 25,
             '급소 찌르기': 18,
             스나이프: 25,
             헤드샷: 35,
             '맹독 단검': 12,
             '페인 딜러': 16,
             '라스트 콜': 22,
             '지갑선 끊기': 10,
           };
           const reqMp = smp(mpMap[skillName]!);
           const lastCallTarget = activeEnemies[0];
           if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
           else if (playerState.mp < reqMp) { response = `MP 부족 (${reqMp} MP 필요)`; }
           else if (
             (skillName === '페인 딜러' || skillName === '라스트 콜' || skillName === '지갑선 끊기') &&
             loggedInChar?.job !== '도적'
           ) {
             response = '도적만 사용할 수 있습니다.';
           }
           else if (
             skillName === '라스트 콜' &&
             (lastCallTarget.maxHp <= 0 || lastCallTarget.currentHp / lastCallTarget.maxHp > 0.35)
           ) {
             response =
               '🚋 [라스트 콜] 아직 막차 시간이 아니다… (대상 HP가 35% 이하일 때만 막차에 탈 수 있다)';
           }
          else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - reqMp,
              ...mergeSkillCooldown(p, skillName),
            }));
             const target = activeEnemies[0];
             const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
             const part = pickHitPart();
             let baseMulti = 1.5;
             if (skillName === '징벌') baseMulti = 2.5;
             else if (skillName === '천벌') baseMulti = 2.0;
             else if (skillName === '돌진') baseMulti = 1.8;
             else if (skillName === '처형') baseMulti = 1.65;
             else if (skillName === '급소 찌르기') baseMulti = 2.2;
             else if (skillName === '스나이프') baseMulti = 3.0; // 방관 극딜
             else if (skillName === '헤드샷') baseMulti = 4.0;
             else if (skillName === '맹독 단검') baseMulti = 1.2;
             else if (skillName === '페인 딜러') baseMulti = 1.42;
             else if (skillName === '라스트 콜') baseMulti = 2.75;
             else if (skillName === '지갑선 끊기') baseMulti = 1.05;
             
            let dmgBase = effAtk * baseMulti + (effStr) * (baseMulti * 0.5);
            if (skillName === '스나이프' || skillName === '급소 찌르기' || skillName === '페인 딜러' || skillName === '라스트 콜' || skillName === '지갑선 끊기') dmgBase += effDex * 2;
            // 징벌·천벌: 신앙심(정신력) 기반 — INT 대신 SPR만 사용
            if (skillName === '징벌') dmgBase += (effSpr ?? 0) * 2.2;
            if (skillName === '천벌') dmgBase += (effSpr ?? 0) * 1.8;
            
            let defFactor = (100 + effStr) / (100 + effectiveEnemyDefForPhysical(target));
             if (skillName === '스나이프' || skillName === '맹독 단검' || skillName === '페인 딜러' || skillName === '라스트 콜') defFactor = 1.0; // 방어 무시!
             
             const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
             const isCrit = Math.random() < critChance;
             const critMult = magCritMult(isCrit);
             let dmg = Math.max(1, Math.round(dmgBase * defFactor * critMult * optionFx.damageMult));
             // 천벌: 기본 1/3 데미지, Lv2=2/3, Lv3=풀 데미지
             if (skillName === '천벌') {
               const 천벌배율 = 천벌레벨 === 1 ? 1/3 : 천벌레벨 === 2 ? 2/3 : 1;
               dmg = Math.max(1, Math.round(dmg * 천벌배율));
             }
             if (skillName === '처형' && target.maxHp > 0 && target.currentHp / target.maxHp <= 0.35) {
               dmg = Math.max(1, Math.round(dmg * 1.75));
             }
             if (skillName === '라스트 콜') {
               dmg = Math.max(1, Math.round(dmg * 1.12));
             }
             if (target.warriorMarkActive && (skillName === '돌진' || skillName === '처형')) {
               dmg = applyWarriorMarkPhysicalDamage(target, dmg);
             }
             const newHp = target.currentHp - dmg;
             if (skillName.includes('징벌') || skillName === '천벌') playSoundMagic();
             else playSoundPierce();

             if (newHp <= 0) {
               const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
               if (skillName === '지갑선 끊기') {
                 const purseKill = Math.max(18, Math.floor(scaleCoinCost(40 + effDex * 2 + Math.random() * 55)));
                 setPlayerState((p) => ({ ...p, credit: (p.credit || 0) + purseKill }));
               }
               const purseKillLine =
                 skillName === '지갑선 끊기'
                   ? `\n💳 [지갑선 끊기] 마지막 순간 지갑에서 코인이 쏟아져 나왔다! (보너스 획득)`
                   : '';
               response = handleEnemiesDefeat(
                 [target],
                 `✨ [${skillName}] ${part} 적중! (-${dmg})${critFlavor}${purseKillLine}\n[${formatEnemyName(target)}] 撃破!`,
               );
               const remain = activeEnemies.filter((_, i) => i !== 0);
               setActiveEnemies(remain);
               if (remain.length > 0) setTimeout(() => triggerEnemyTurn(remain), 300);
               else { stealthTurnsRef.current = 0; setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0})); setSceneImage(BG_ALLEY); }
             } else {
               setActiveEnemies(prev => prev.map((e, i) => {
                 if (i !== 0) return e;
                 const next: ActiveEnemy = { ...e, currentHp: newHp, sleepTurns: 0 };
                 if (skillName === '맹독 단검') { next.def = Math.max(0, e.def - 5); next.poisonTurns = 3; }
                 if (skillName === '페인 딜러') {
                   next.def = Math.max(0, e.def - 4);
                   next.poisonTurns = 3;
                   next.bleedTurns = 3;
                 }
                 if (skillName === '급소 찌르기') next.bleedTurns = 3;
                 if (target.warriorMarkActive && (skillName === '돌진' || skillName === '처형')) next.warriorMarkActive = false;
                 return next;
               }));
               const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
               const execNote = skillName === '처형' && target.maxHp > 0 && (target.currentHp / target.maxHp <= 0.35) ? ' (처형 보너스!)' : '';
               const lastCallNote = skillName === '라스트 콜' ? ' 🚋 막차 탄 도적!' : '';
               response = `✨ [${skillName}] ${part} 강렬한 일격! ${dmg} 데미지!${execNote}${lastCallNote}${critFlavor}\n[대상: ${formatEnemyName({ ...target, currentHp: newHp })}] HP: ${newHp}/${target.maxHp}`;
               if (skillName === '맹독 단검') response += `\n[${target.name}] 독 중독! (3턴 간 턴당 5 피해)`;
               if (skillName === '페인 딜러') {
                 response += `\n🃏 [페인 딜러] 한 손엔 독, 한 손엔 출혈 — [${target.name}] 양쪽 다 걸렸다! (독·출혈 3턴)`;
               }
               if (skillName === '급소 찌르기') response += `\n[${target.name}] 출혈! (3턴 간 턴당 3 피해)`;
               if (skillName === '지갑선 끊기') {
                 const purseGain = Math.max(12, Math.floor(scaleCoinCost(28 + effDex * 2 + Math.random() * 40)));
                 setPlayerState((p) => ({ ...p, credit: (p.credit || 0) + purseGain }));
                 response += `\n💳 [지갑선 끊기] 전리 전에 주머니에서 ${purseGain} C가 바닥에 떨어졌다! (자동 획득)`;
               }
               triggerEnemyTurn(activeEnemies);
             }
           }
        } else if (skillName === '휠윈드' || skillName === '독 폭탄' || skillName === '난사') {
          const mpMap: Record<string, number> = {'휠윈드': 25, '독 폭탄': 20, '난사': 30};
          const reqMp = smp(mpMap[skillName]!);
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < reqMp) { response = `MP 부족 (${reqMp} MP 필요)`; }
          else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - reqMp,
              ...mergeSkillCooldown(p, skillName),
            }));
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            let dmgBase = playerState.atk * 1.5;
            if (skillName === '난사') dmgBase = playerState.atk * 2.0 + playerState.dex;
            if (skillName === '독 폭탄') dmgBase = playerState.atk * 1.0 + playerState.dex * 0.5;

            let logStr = `[${skillName}] 광역 공격!!`;
            playSoundSlash();
            const deadEnemies: ActiveEnemy[] = [];
            const updatedEnemies: ActiveEnemy[] = [];
            let anyCrit = false;
            activeEnemies.forEach(e => {
               const part = pickHitPart();
               const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
               const isCrit = Math.random() < critChance;
               if (isCrit) anyCrit = true;
               const critMult = magCritMult(isCrit);
               let rawDmg = Math.max(1, Math.round(dmgBase * ((100 + playerState.str) / (100 + effectiveEnemyDefForPhysical(e))) * critMult * optionFx.damageMult));
               if (skillName === '휠윈드' && e.warriorMarkActive) rawDmg = applyWarriorMarkPhysicalDamage(e, rawDmg);
               const newHp = e.currentHp - rawDmg;
               if (newHp <= 0) {
                 logStr += `\n[${formatEnemyName(e)}] ${part} 타격! 撃破! (-${rawDmg})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
                 deadEnemies.push(e);
               } else {
                 const updated: ActiveEnemy = { ...e, currentHp: newHp, sleepTurns: 0 };
                 if (skillName === '휠윈드' && e.warriorMarkActive) updated.warriorMarkActive = false;
                 if (skillName === '독 폭탄') {
                   updated.atk = Math.max(1, e.atk - 5);
                   updated.poisonTurns = 3;
                 }
                 updatedEnemies.push(updated);
                 logStr += `\n[${formatEnemyName({ ...e, currentHp: newHp })}] ${part} 타격! ${rawDmg} 피해!${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`;
                 if (skillName === '독 폭탄') logStr += ' (공격력 저하 + 독 3턴)';
               }
            });
            if (anyCrit) logStr += `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m`;
            setActiveEnemies(updatedEnemies);
            if (deadEnemies.length > 0) {
              logStr += '\n' + handleEnemiesDefeat(deadEnemies, '다중 목표 격파!');
              if (updatedEnemies.length === 0) { stealthTurnsRef.current = 0; setPlayerState(p => ({...p, isCombat: false, stealthTurnsLeft: 0})); setSceneImage(BG_ALLEY); }
            }
            response = logStr;
            if (updatedEnemies.length > 0) setTimeout(() => triggerEnemyTurn(updatedEnemies), 300);
          }
        } else if (skillName === '도발') {
          if (loggedInChar?.job !== '전사') { response = '전사만 사용할 수 있습니다.'; }
          else if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(12)) { response = `MP 부족 (${smp(12)} MP 필요)`; }
          else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(12),
              warriorTauntTurns: 3,
              ...mergeSkillCooldown(p, '도발'),
            }));
            response = '😤 [도발] 적의 집중을 흐트러뜨립니다! (3턴간 적이 주는 피해 감소)';
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '반격 태세') {
          if (loggedInChar?.job !== '전사') { response = '전사만 사용할 수 있습니다.'; }
          else if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(15)) { response = `MP 부족 (${smp(15)} MP 필요)`; }
          else {
            setPlayerState(p => ({ ...p, mp: p.mp - smp(15), ...mergeSkillCooldown(p, '반격 태세') }));
            response = '🔄 [반격 태세] 받아넘기기. 다음 적 공격 피해를 크게 줄이고 반격합니다.';
            triggerEnemyTurn(activeEnemies, { isRiposte: true });
          }
        } else if (skillName === '철벽') {
          if (loggedInChar?.job !== '전사') { response = '전사만 사용할 수 있습니다.'; }
          else if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(20)) { response = `MP 부족 (${smp(20)} MP 필요)`; }
          else {
            setPlayerState(p => {
              const prevBonus = p.fortifyDefBonus ?? 0;
              const baseDef = p.def - prevBonus;
              return {
                ...p,
                mp: p.mp - smp(20),
                def: baseDef + 20,
                fortifyTurns: 3,
                fortifyDefBonus: 20,
                ...mergeSkillCooldown(p, '철벽'),
              };
            });
            response = '🏰 [철벽] 방어 자세! (DEF +20, 3턴 유지 후 해제)';
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '갑옷 파쇄') {
          if (loggedInChar?.job !== '전사') { response = '전사만 사용할 수 있습니다.'; }
          else if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(18)) { response = `MP 부족 (${smp(18)} MP 필요)`; }
          else {
            setPlayerState(p => ({ ...p, mp: p.mp - smp(18), ...mergeSkillCooldown(p, '갑옷 파쇄') }));
            const target = activeEnemies[0];
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const wpPenalty = getWeaponPenalty();
            const weaponAttr = getPlayerWeaponAttr();
            const attrMod = getDamageModifier(weaponAttr, target.armorAttr);
            const sunderFlat = Math.min(18, Math.max(8, Math.floor(target.def * 0.22)));
            let dmg = Math.max(1, Math.round((effAtk * 1.15 + effStr * 1.1) * ((100 + effStr) / (100 + effectiveEnemyDefForPhysical(target))) * attrMod * wpPenalty * optionFx.damageMult));
            const newHp = target.currentHp - dmg;
            playSoundSlash();
            if (newHp <= 0) {
              response = handleEnemiesDefeat([target], `🛡💥 [갑옷 파쇄] [${target.name}] 撃파! (-${dmg})`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) setTimeout(() => triggerEnemyTurn(remain), 300);
              else {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
                combatEndedThisCommand = true;
              }
            } else {
              setActiveEnemies(prev => prev.map((e, i) =>
                i === 0 ? { ...e, currentHp: newHp, sleepTurns: 0, sunderTurns: 4, sunderDefFlat: sunderFlat } : e
              ));
              response = `🛡💥 [갑옷 파쇄] ${dmg} 피해! [${target.name}]의 방어가 4턴간 ${sunderFlat}만큼 약화됩니다.\nHP: ${newHp}/${target.maxHp}`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '표식 참격') {
          if (loggedInChar?.job !== '전사') { response = '전사만 사용할 수 있습니다.'; }
          else if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(12)) { response = `MP 부족 (${smp(12)} MP 필요)`; }
          else {
            setPlayerState(p => ({ ...p, mp: p.mp - smp(12), ...mergeSkillCooldown(p, '표식 참격') }));
            const target = activeEnemies[0];
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const wpPenalty = getWeaponPenalty();
            const weaponAttr = getPlayerWeaponAttr();
            const attrMod = getDamageModifier(weaponAttr, target.armorAttr);
            let dmg = Math.max(1, Math.round((effAtk * 1.05 + effStr * 1.25) * ((100 + effStr) / (100 + effectiveEnemyDefForPhysical(target))) * attrMod * wpPenalty * optionFx.damageMult));
            if (target.warriorMarkActive) dmg = applyWarriorMarkPhysicalDamage(target, dmg);
            const newHp = target.currentHp - dmg;
            playSoundSlash();
            if (newHp <= 0) {
              response = handleEnemiesDefeat([target], `🎯 [표식 참격] [${target.name}] 撃破! (-${dmg})`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) setTimeout(() => triggerEnemyTurn(remain), 300);
              else {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
                combatEndedThisCommand = true;
              }
            } else {
              setActiveEnemies(prev => prev.map((e, i) =>
                i === 0 ? { ...e, currentHp: newHp, sleepTurns: 0, warriorMarkActive: true } : e
              ));
              response = `🎯 [표식 참격] ${dmg} 피해! 다음 물리 1타(평타·파워·돌진·처형·휠윈드 등)가 35% 추가 피해를 줍니다.\nHP: ${newHp}/${target.maxHp}`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '방패 강타') {
          if (loggedInChar?.job !== '전사') { response = '전사만 사용할 수 있습니다.'; }
          else if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(12)) { response = `MP 부족 (${smp(12)} MP 필요)`; }
          else {
            const ohName = resolveSlotToItemName(playerState.offHand, playerState.inventory);
            const shieldIt = getItemByName(ohName || '');
            if (shieldIt?.type !== 'shield') {
              response = '방패 강타는 보조 슬롯에 방패를 장착한 상태에서만 사용할 수 있습니다.';
            } else {
              setPlayerState(p => ({ ...p, mp: p.mp - smp(12), ...mergeSkillCooldown(p, '방패 강타') }));
              const target = activeEnemies[0];
              const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
              const wpPenalty = getWeaponPenalty();
              const weaponAttr = getPlayerWeaponAttr();
              const attrMod = getDamageModifier(weaponAttr, target.armorAttr);
              let dmg = Math.max(1, Math.round((effAtk * 0.85 + effStr + (shieldIt.defense ?? 4) * 0.5) * ((100 + effStr) / (100 + effectiveEnemyDefForPhysical(target))) * attrMod * wpPenalty * optionFx.damageMult));
              if (target.warriorMarkActive) dmg = applyWarriorMarkPhysicalDamage(target, dmg);
              const newHp = target.currentHp - dmg;
              const bossResist = !!target.isBoss && Math.random() < 0.45;
              const stunApply = bossResist ? 0 : 1;
              playSoundCrush();
              if (newHp <= 0) {
                if (playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'wind_sage')) {
                  playerWindBashPriorityRef.current = 1;
                }
                response = handleEnemiesDefeat([target], `🛡⚡ [방패 강타] [${target.name}] 撃破! (-${dmg})`);
                const remain = activeEnemies.filter((_, i) => i !== 0);
                setActiveEnemies(remain);
                if (remain.length > 0) setTimeout(() => triggerEnemyTurn(remain), 300);
                else {
                  stealthTurnsRef.current = 0;
                  setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                  setSceneImage(BG_ALLEY);
                  combatEndedThisCommand = true;
                }
              } else {
                setActiveEnemies(prev => prev.map((e, i) => {
                  if (i !== 0) return e;
                  let u: ActiveEnemy = { ...e, currentHp: newHp, sleepTurns: 0, stunTurns: stunApply };
                  if (target.warriorMarkActive) u.warriorMarkActive = false;
                  if (stunApply > 0) u = clearEnemyHeavyIntent(u);
                  return u;
                }));
                const windBash =
                  playerHasRune(playerState.equippedRuneId, playerState.equippedRuneSecondaryId, 'wind_sage');
                if (windBash) {
                  playerWindBashPriorityRef.current = 1;
                }
                response =
                  stunApply > 0
                    ? `🛡⚡ [방패 강타] ${dmg} 피해! [${target.name}] 밀려났고 당신이 전열을 점거했습니다.${windBash ? ' 💨 [바람술사] 역풍이 적 턴을 한 박자 늦춥니다!' : ''}\n${stunApply > 0 ? `[${target.name}] 기절! (다음 턴 행동 불가)\n` : ''}HP: ${newHp}/${target.maxHp}`
                    : `🛡⚡ [방패 강타] ${dmg} 피해! [${target.name}]이(가) 스턴을 저항했습니다.${windBash ? ' 💨 [바람술사] 그래도 역풍으로 리듬을 끊었습니다.' : ''}\nHP: ${newHp}/${target.maxHp}`;
                triggerEnemyTurn(activeEnemies);
              }
            }
          }
        } else if (skillName === '가시 갑옷') {
          if (loggedInChar?.job !== '전사') {
            response = '전사만 사용할 수 있습니다.';
          } else if (!playerState.isCombat || activeEnemies.length === 0) {
            response = '전투 중이 아닙니다.';
          } else if (playerState.mp < smp(18)) {
            response = `MP 부족 (${smp(18)} MP 필요)`;
          } else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(18),
              warriorThornAuraTurns: 4,
              ...mergeSkillCooldown(p, '가시 갑옷'),
            }));
            response =
              '🦔 [가시 갑옷] 팔다리와 등줄기에 냉기 어린 가시가 돋아 나옵니다! (4턴)\n' +
              '근접으로 명중당할 때마다(마법 속성 적 제외) 받은 피해에 비례해 적에게 반사 피해를 줍니다.';
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '일격필살') {
          if (loggedInChar?.job !== '전사') {
            response = '전사만 사용할 수 있습니다.';
          } else if (!playerState.isCombat || activeEnemies.length === 0) {
            response = '전투 중이 아닙니다.';
          } else if (playerState.mp < smp(20)) {
            response = `MP 부족 (${smp(20)} MP 필요)`;
          } else if (rage < 1) {
            response = '⚡ [일격필살] 쌓인 분노(RAGE)가 부족합니다. (최소 1 이상 필요)';
          } else {
            const spentRage = Math.min(100, Math.floor(rage));
            setRage(0);
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(20),
              ...mergeSkillCooldown(p, '일격필살'),
            }));
            const target = activeEnemies[0];
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const wpPenalty = getWeaponPenalty();
            const weaponAttr = getPlayerWeaponAttr();
            const attrMod = getDamageModifier(weaponAttr, target.armorAttr);
            const rageFactor = 1 + (spentRage / 100) * 2.75;
            const baseMulti = 1.28;
            let dmgBase =
              (effAtk * baseMulti + effStr * (baseMulti * 0.65) + spentRage * 0.38) * rageFactor;
            const defFactor = (100 + effStr) / (100 + effectiveEnemyDefForPhysical(target));
            const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus + spentRage * 0.001);
            const isCrit = Math.random() < critChance;
            const critMult = magCritMult(isCrit, 1.55);
            let dmg = Math.max(
              1,
              Math.round(dmgBase * defFactor * attrMod * wpPenalty * critMult * optionFx.damageMult),
            );
            if (target.warriorMarkActive) dmg = applyWarriorMarkPhysicalDamage(target, dmg);
            const newHp = target.currentHp - dmg;
            const part = pickHitPart();
            playSoundSlash();
            if (newHp <= 0) {
              response = handleEnemiesDefeat(
                [target],
                `⚡💥 [일격필살] 쌓아 둔 분노 ${spentRage}을(를) 한 번에 몰아넣었다! ${part} 적중 (-${dmg})`,
              );
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) setTimeout(() => triggerEnemyTurn(remain), 300);
              else {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
              }
            } else {
              setActiveEnemies(prev =>
                prev.map((e, i) =>
                  i === 0
                    ? {
                        ...e,
                        currentHp: newHp,
                        sleepTurns: 0,
                        ...(target.warriorMarkActive ? { warriorMarkActive: false } : {}),
                      }
                    : e,
                ),
              );
              const critNote = isCrit ? ' 치명타!' : '';
              response =
                `⚡💥 [일격필살] RAGE ${spentRage} 소모! ${part}에 결의의 일격! ${dmg} 피해!${critNote}\n` +
                `[대상: ${formatEnemyName({ ...target, currentHp: newHp })}] HP: ${newHp}/${target.maxHp}`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '섀도우 스텝') {
          if (!playerState.isCombat) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(15)) { response = `MP 부족 (${smp(15)} MP 필요)`; }
          else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(15),
              def: p.def + 20,
              ...mergeSkillCooldown(p, '섀도우 스텝'),
            }));
            response = '🌫️ [섀도우 스텝] 그림자에 숨어듭니다! (방어력 +20, 다음 적 턴 회피율 대폭 상승)';
            triggerEnemyTurn(activeEnemies, { dodgeChance: 0.5 });
          }
        } else if (skillName === '거울 복도') {
          if (loggedInChar?.job !== '도적') { response = '도적만 사용할 수 있습니다.'; }
          else if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(12)) { response = `MP 부족 (${smp(12)} MP 필요)`; }
          else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(12),
              thiefMirrorCorridorTurns: 1,
              ...mergeSkillCooldown(p, '거울 복도'),
            }));
            response =
              '🪞 [거울 복도] 네 얼굴을 한 그림자가 홀로그램 너머로 웃는다… 이번 적 라운드 동안 그들의 공격이 헛돌기 쉬워진다!';
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '죽은 척 오스') {
          if (loggedInChar?.job !== '도적') { response = '도적만 사용할 수 있습니다.'; }
          else if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(8)) { response = `MP 부족 (${smp(8)} MP 필요)`; }
          else if ((playerState.thiefPlayDeadCharges ?? 0) > 0) {
            response = '이미 죽은 척 연기를 염두에 둔 상태다. (중첩 불가)';
          } else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(8),
              thiefPlayDeadCharges: 1,
              ...mergeSkillCooldown(p, '죽은 척 오스'),
            }));
            response =
              '💀 [죽은 척 오스] 숨을 멈추고 무너질 준비를 했다. 다음 HP 피해 1회를 연기로 완전히 흘린다. (신의 방패 MP 흡수 후 남는 HP 피해에만 적용)';
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '은신') {
          if (loggedInChar?.job !== '도적') { response = '도적만 사용할 수 있습니다.'; }
          else if (!playerState.isCombat) { response = '전투 중에만 사용 가능합니다.'; }
          else if (playerState.mp < smp(15)) { response = `MP 부족 (${smp(15)} MP 필요)`; }
          else {
            const shadowR2 = playerHasRune(
              playerState.equippedRuneId,
              playerState.equippedRuneSecondaryId,
              'shadow_illusionist',
            );
            const stealthDur = shadowR2 ? 4 : 3;
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(15),
              stealthTurnsLeft: stealthDur,
              ...mergeSkillCooldown(p, '은신'),
            }));
            stealthTurnsRef.current = stealthDur;
            response = `🌫️ [은신] 그림자에 몸을 숨깁니다! (${stealthDur}턴 간 적 공격 100% 회피${shadowR2 ? ' · 그림자술사 룬 연장' : ''})`;
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '스틸') {
          if (loggedInChar?.job !== '도적') { response = '도적만 사용할 수 있습니다.'; }
          else if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중에만 사용 가능합니다.'; }
          else if (playerState.mp < smp(10)) { response = `MP 부족 (${smp(10)} MP 필요)`; }
          else {
            const target = activeEnemies[0];
            if (!target.lootPool || target.lootPool.length === 0) {
              response = `[${target.name}]에게는 훔칠 것이 없습니다.`;
              triggerEnemyTurn(activeEnemies, undefined, 'neutral');
            } else {
              const isStealthed = (playerState.stealthTurnsLeft ?? 0) > 0;
              const successRate = isStealthed ? 0.9 : 0.4;
              if (Math.random() < successRate) {
                const stolen = target.lootPool[Math.floor(Math.random() * target.lootPool.length)];
                const stealLogs: string[] = [];
                const stealRes = addItemToInventory(playerState.inventory, stolen, stealLogs);
                if (stealLogs.length > 0) {
                  setPlayerState((p) => ({
                    ...p,
                    mp: p.mp - smp(10),
                    ...mergeSkillCooldown(p, '스틸'),
                  }));
                  response = `${stealLogs[stealLogs.length - 1]} (MP -${smp(10)})`;
                  triggerEnemyTurn(activeEnemies, undefined, 'neutral');
                } else {
                  skipRoomEnemyClearAfterCombatRef.current = true;
                  setPlayerState((p) => ({
                    ...p,
                    mp: p.mp - smp(10),
                    inventory: stealRes.inventory,
                    isCombat: false,
                    stealthTurnsLeft: 0,
                    ...mergeSkillCooldown(p, '스틸'),
                  }));
                  stealthTurnsRef.current = 0;
                  setActiveEnemies([]);
                  setSceneImage(resolveRoomSceneImage(getRoomById(currentRoomId)));
                  response = `🎭 [스틸] 성공! [${target.name}]에게서 [${stolen}]을(를) 훔쳤습니다!\n🏃💨 그대로 도망쳐 전투에서 벗어났습니다.`;
                }
              } else {
                setPlayerState(p => ({
                  ...p,
                  mp: p.mp - smp(10),
                  ...mergeSkillCooldown(p, '스틸'),
                }));
                response = `🎭 [스틸] 실패! [${target.name}]이(가) 눈치챘습니다.`;
                triggerEnemyTurn(activeEnemies, undefined, 'neutral');
              }
            }
          }
        } else if (skillName === '와이어 트랩') {
          if (playerState.mp < smp(20)) {
            response = `MP 부족 (${smp(20)} MP 필요)`;
          } else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(20),
              ...mergeSkillCooldown(p, '와이어 트랩'),
            }));
            const trapPower = Math.max(8, Math.round(effAtk * 0.5) + 10);
            setRoomTraps(prev => ({ ...prev, [currentRoomId]: { type: 'wire', power: trapPower, stunTurns: 1 } }));
            const roomName = getRoomById(currentRoomId)?.name ?? '이곳';
            response = `🧵 [와이어 트랩] ${roomName}에 와이어 함정을 설치했습니다. 다음에 이 방에서 적이 등장하면 선 피해와 1턴 기절이 적용됩니다.`;
          }
        } else if (skillName === '철수') {
          if (!playerState.isCombat) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(10)) { response = `MP 부족 (${smp(10)} MP 필요)`; }
          else {
            if (Math.random() < 0.8) {
               stealthTurnsRef.current = 0;
               skipRoomEnemyClearAfterCombatRef.current = true;
               setPlayerState(p => ({
                 ...p,
                 mp: p.mp - smp(10),
                 isCombat: false,
                 stealthTurnsLeft: 0,
                 ...mergeSkillCooldown(p, '철수'),
               }));
               setActiveEnemies([]);
               setSceneImage(resolveRoomSceneImage(getRoomById(currentRoomId)));
               response = '💨 [철수] 전장에서 연막을 치고 성공적으로 빠져나왔습니다!';
            } else {
               setPlayerState(p => ({
                 ...p,
                 mp: p.mp - smp(10),
                 ...mergeSkillCooldown(p, '철수'),
               }));
               response = '💨 [철수] 도주에 실패했습니다! 적이 길을 막았습니다.';
               triggerEnemyTurn(activeEnemies, undefined, 'neutral');
            }
          }
        } else if (skillName === '패링') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(5)) { response = `MP 부족 (${smp(5)} MP 필요)`; }
          else { 
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(5),
              ...mergeSkillCooldown(p, '패링'),
            }));
            response = `⚔ 패링 자세! 다음 적 공격 피해를 줄이고 반격합니다. (MP -${smp(5)})`; 
            triggerEnemyTurn(activeEnemies, { isParrying: true }); 
          }
        } else if (skillName === '얼음 화살') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(20)) { response = `MP 부족 (${smp(20)} MP 필요)`; }
          else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(20),
              ...mergeSkillCooldown(p, '얼음 화살'),
            }));
            const target = activeEnemies[0];
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const part = pickHitPart();
            const dmgBase = (effAtk * 1.2) + (effDex * 1.5);
            const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
            const isCrit = Math.random() < critChance;
            const critMult = magCritMult(isCrit);
            const dmg = Math.max(1, Math.round(dmgBase * ((100 + effStr) / (100 + target.def)) * critMult * optionFx.damageMult));
            const newHp = target.currentHp - dmg;
            if (newHp <= 0) {
              const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = handleEnemiesDefeat([target], `❄️ [얼음 화살] ${part} 적중! [${formatEnemyName(target)}]에게 빙결의 화살! ${dmg} 피해!${critFlavor} 撃破!`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) {
                setTimeout(() => triggerEnemyTurn(remain), 300);
              } else {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
                combatEndedThisCommand = true;
              }
            } else {
              setActiveEnemies(prev =>
                prev.map((e, i) =>
                  i === 0
                    ? clearEnemyHeavyIntent({ ...e, currentHp: newHp, sleepTurns: 0, freezeTurns: 1 })
                    : e,
                ),
              );
              const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = `❄️ [얼음 화살] ${part} 적중! [${formatEnemyName({ ...target, currentHp: newHp })}]에게 ${dmg} 피해 + 1턴 빙결!${critFlavor}\n(HP: ${newHp}/${target.maxHp})`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '화염 화살') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(18)) { response = `MP 부족 (${smp(18)} MP 필요)`; }
          else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(18),
              ...mergeSkillCooldown(p, '화염 화살'),
            }));
            const target = activeEnemies[0];
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const part = pickHitPart();
            const dmgBase = (effAtk * 1.4) + (effDex * 1.0);
            const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
            const isCrit = Math.random() < critChance;
            const critMult = magCritMult(isCrit);
            const dmg = Math.max(1, Math.round(dmgBase * ((100 + effStr) / (100 + target.def)) * critMult * optionFx.damageMult));
            const newHp = target.currentHp - dmg;
            if (newHp <= 0) {
              const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = handleEnemiesDefeat([target], `🔥 [화염 화살] ${part} 적중! [${formatEnemyName(target)}]에게 불꽃 화살! ${dmg} 피해!${critFlavor} 撃破!`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) {
                setTimeout(() => triggerEnemyTurn(remain), 300);
              } else {
                stealthTurnsRef.current = 0;
                setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
                combatEndedThisCommand = true;
              }
            } else {
              setActiveEnemies(prev => prev.map((e, i) => i === 0 ? { ...e, currentHp: newHp, sleepTurns: 0, burnTurns: 2 } : e));
              const critFlavor = isCrit ? `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m` : '';
              response = `🔥 [화염 화살] ${part} 적중! [${formatEnemyName({ ...target, currentHp: newHp })}]에게 ${dmg} 피해 + 화상 2턴!${critFlavor}\n(HP: ${newHp}/${target.maxHp})`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '폭발 화살') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(25)) { response = `MP 부족 (${smp(25)} MP 필요)`; }
          else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(25),
              ...mergeSkillCooldown(p, '폭발 화살'),
            }));
            const optionFx = getWeaponOptionEffects(
          resolveSlotToItemName(playerState.weapon, playerState.inventory),
          getWeaponCombatTagsFromSlot(playerState.weapon, playerState.inventory)
        );
            const dmgBasePrimary = (effAtk * 1.8) + (effDex * 1.2); // 1번 적 풀피해, 나머지 50% 스플래시
            const splashRatio = 0.5; // 주변 적은 50% 피해
            const deadList: ActiveEnemy[] = [];
            const updated: ActiveEnemy[] = [];
            let logStr = '💥 [폭발 화살] 폭발성 화살!';
            let anyCrit = false;
            activeEnemies.forEach((e, i) => {
              const isPrimary = i === 0;
              const part = pickHitPart();
              const critChance = Math.min(0.6, (effCritChance ?? 0.1) + optionFx.critBonus);
              const isCrit = Math.random() < critChance;
              if (isCrit) anyCrit = true;
              const critMult = magCritMult(isCrit);
              const rawDmg = Math.max(1, Math.round((isPrimary ? dmgBasePrimary : dmgBasePrimary * splashRatio) * ((100 + effStr) / (100 + e.def)) * critMult * optionFx.damageMult));
              const newHp = e.currentHp - rawDmg;
              if (newHp <= 0) { deadList.push(e); logStr += `\n[${formatEnemyName(e)}] ${part}에 폭발! 撃破! (-${rawDmg})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`; }
              else { updated.push({ ...e, currentHp: newHp, sleepTurns: 0 }); logStr += `\n[${formatEnemyName({ ...e, currentHp: newHp })}] ${part}에 폭발! ${rawDmg} 피해 (HP: ${newHp}/${e.maxHp})${isCrit ? ' \u001b[91mCRIT!\u001b[0m' : ''}`; }
            });
            if (anyCrit) logStr += `\n\u001b[91m💥 적의 심장을 꿰뚫는 치명적인 일격!\u001b[0m`;
            if (deadList.length > 0) {
              response = handleEnemiesDefeat(deadList, logStr);
              setActiveEnemies(updated);
              if (updated.length > 0) setTimeout(() => triggerEnemyTurn(updated), 300);
              else { stealthTurnsRef.current = 0; setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 })); setSceneImage(BG_ALLEY); }
            } else {
              setActiveEnemies(updated);
              const hpLine = updated.map(e => `[${e.name}] HP:${e.currentHp}`).join(', ');
              response = `${logStr}\n${hpLine}`;
              triggerEnemyTurn(updated);
            }
          }
        } else if (skillName === '도주 사격') {
          if (!playerState.isCombat || activeEnemies.length === 0) { response = '전투 중이 아닙니다.'; }
          else if (playerState.mp < smp(15)) { response = `MP 부족 (${smp(15)} MP 필요)`; }
          else {
            setPlayerState(p => ({
              ...p,
              mp: p.mp - smp(15),
              ...mergeSkillCooldown(p, '도주 사격'),
            }));
            const target = activeEnemies[0];
            const dmgBase = (effAtk * 0.9) + (effDex * 0.8);
            const dmg = Math.max(1, Math.round(dmgBase * ((100 + effStr) / (100 + target.def))));
            const newHp = target.currentHp - dmg;
            if (newHp <= 0) {
              response = handleEnemiesDefeat([target], `💨 [도주 사격] [${target.name}]에게 한 발 쏘고 후퇴! ${dmg} 피해! 撃破!`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length > 0) setTimeout(() => triggerEnemyTurn(remain), 300);
              else { stealthTurnsRef.current = 0; setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 })); setSceneImage(BG_ALLEY); }
            } else {
              setActiveEnemies(prev => prev.map((e, i) => i === 0 ? { ...e, currentHp: newHp, sleepTurns: 0 } : e));
              const escaped = Math.random() < 0.5;
              if (escaped) {
                stealthTurnsRef.current = 0;
                skipRoomEnemyClearAfterCombatRef.current = true;
                setPlayerState(p => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setActiveEnemies([]);
                setSceneImage(resolveRoomSceneImage(getRoomById(currentRoomId)));
                response = `💨 [도주 사격] [${target.name}]에게 ${dmg} 피해를 주고 연막을 치며 전장에서 빠져나왔다! (HP: ${newHp}/${target.maxHp})`;
              } else {
                response = `💨 [도주 사격] [${target.name}]에게 ${dmg} 피해! 하지만 적이 길을 막아 도주 실패! (HP: ${newHp}/${target.maxHp})`;
                triggerEnemyTurn(activeEnemies);
              }
            }
          }
        } else if (skillName === '프렌지') {
          if (!playerState.isCombat || activeEnemies.length === 0) response = '전투 중이 아닙니다.';
          else if (playerState.mp < smp(12)) response = `MP 부족 (${smp(12)} 필요)`;
          else {
            const self = Math.max(1, Math.round(playerState.hp * 0.08));
            const tg = activeEnemies[0];
            const dmg = Math.max(1, Math.round(effAtk * 2.1));
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(12),
              hp: Math.max(1, p.hp - self),
              ...mergeSkillCooldown(p, '프렌지'),
            }));
            const nh = tg.currentHp - dmg;
            if (nh <= 0) {
              response = handleEnemiesDefeat([tg], `🩸 [프렌지] 자해 ${self} — 광폭한 일격 ${dmg}!`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length === 0) {
                stealthTurnsRef.current = 0;
                setPlayerState((p) => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
              } else setTimeout(() => triggerEnemyTurn(remain), 300);
            } else {
              setActiveEnemies((prev) => prev.map((e, i) => (i === 0 ? { ...e, currentHp: nh } : e)));
              response = `🩸 [프렌지] HP ${self} 소모 — ${tg.name}에게 ${dmg} 피해! (HP ${nh}/${tg.maxHp})`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '심판') {
          if (!playerState.isCombat || activeEnemies.length === 0) response = '전투 중이 아닙니다.';
          else if (playerState.mp < smp(22)) response = `MP 부족 (${smp(22)} 필요)`;
          else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(22),
              ...mergeSkillCooldown(p, '심판'),
            }));
            const tg = activeEnemies[0];
            const dmg = Math.max(1, Math.round((effInt * 2.2 + effSpr + effAtk * 0.5) * ((100 + effStr) / (100 + tg.def))));
            const nh = tg.currentHp - dmg;
            playSoundMagic();
            if (nh <= 0) {
              response = handleEnemiesDefeat([tg], `✝️ [심판] 신성 타격! ${dmg}`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length === 0) {
                stealthTurnsRef.current = 0;
                setPlayerState((p) => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
              } else setTimeout(() => triggerEnemyTurn(remain), 300);
            } else {
              setActiveEnemies((prev) => prev.map((e, i) => (i === 0 ? { ...e, currentHp: nh } : e)));
              response = `✝️ [심판] ${tg.name}에게 ${dmg} 신성 피해!`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '암살') {
          if (!playerState.isCombat || activeEnemies.length === 0) response = '전투 중이 아닙니다.';
          else if (playerState.mp < smp(18)) response = `MP 부족 (${smp(18)} 필요)`;
          else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(18),
              ...mergeSkillCooldown(p, '암살'),
            }));
            const tg = activeEnemies[0];
            const dmg = Math.max(1, Math.round(effAtk * 1.65 + effDex * 0.8));
            const nh = tg.currentHp - dmg;
            if (nh <= 0) {
              response = handleEnemiesDefeat([tg], `🗡 [암살] 급소! ${dmg}`);
              const remain = activeEnemies.filter((_, i) => i !== 0);
              setActiveEnemies(remain);
              if (remain.length === 0) {
                stealthTurnsRef.current = 0;
                setPlayerState((p) => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
                setSceneImage(BG_ALLEY);
              } else setTimeout(() => triggerEnemyTurn(remain), 300);
            } else {
              setActiveEnemies((prev) =>
                prev.map((e, i) => (i === 0 ? { ...e, currentHp: nh, bleedTurns: Math.max(3, e.bleedTurns || 0) } : e)),
              );
              response = `🗡 [암살] ${dmg} + 출혈! (${tg.name} HP ${nh})`;
              triggerEnemyTurn(activeEnemies);
            }
          }
        } else if (skillName === '명상') {
          if (playerState.mp < smp(0)) response = 'MP 오류';
          else {
            const gain = Math.max(5, Math.floor((playerState.maxMp || 50) * 0.3));
            setPlayerState((p) => ({
              ...p,
              mp: Math.min(p.maxMp, p.mp + gain),
              ...mergeSkillCooldown(p, '명상'),
            }));
            response = `🧘 [명상] MP +${gain} 회복`;
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '표식') {
          if (!playerState.isCombat || activeEnemies.length === 0) response = '전투 중이 아닙니다.';
          else if (playerState.mp < smp(10)) response = `MP 부족 (${smp(10)} 필요)`;
          else {
            const tg = activeEnemies[0];
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(10),
              runeMarkTargetId: tg.id,
              ...mergeSkillCooldown(p, '표식'),
            }));
            response = `🎯 [표식] ${tg.name}에게 표식 — 다음 타격 명중·피해 보너스!`;
            triggerEnemyTurn(activeEnemies);
          }
        } else if (skillName === '해골 소환') {
          if (!playerState.isCombat) response = '전투 중이 아닙니다.';
          else if (playerState.mp < smp(25)) response = `MP 부족 (${smp(25)} 필요)`;
          else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(25),
              runeSkeletonAllyStrikes: 4,
              runeSoulSummonActive: true,
              ...mergeSkillCooldown(p, '해골 소환'),
            }));
            response = '💀 [해골 소환] 해골이 당신의 옆을 지킵니다! (다음 4회 공격에 추가 피해 · 영혼 교체 가능)';
            triggerEnemyTurn(activeEnemies);
          }
        } else if (skillName === '룬 카운터') {
          if (!playerState.isCombat) response = '전투 중이 아닙니다.';
          else if (playerState.mp < smp(15)) response = `MP 부족 (${smp(15)} 필요)`;
          else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(15),
              runeCounterStanceTurns: 2,
              ...mergeSkillCooldown(p, '룬 카운터'),
            }));
            response = '⚔️ [룬 카운터] 다음 적 타격을 흘려내고 반격합니다.';
            triggerEnemyTurn(activeEnemies);
          }
        } else if (skillName === '수호의 외침') {
          if (!playerState.isCombat) response = '전투 중이 아닙니다.';
          else if (playerState.mp < smp(12)) response = `MP 부족 (${smp(12)} 필요)`;
          else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(12),
              warriorTauntTurns: Math.max(p.warriorTauntTurns || 0, 3),
              ...mergeSkillCooldown(p, '수호의 외침'),
            }));
            response = '🛡 [수호의 외침] 적의 집중을 끕니다! (도발 턴 갱신)';
            triggerEnemyTurn(activeEnemies);
          }
        } else if (skillName === '대시') {
          if (playerState.mp < smp(12)) response = `MP 부족 (${smp(12)} 필요)`;
          else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(12),
              runeWindDashDodgeTurns: 2,
              ...mergeSkillCooldown(p, '대시'),
            }));
            response = '💨 [대시] 바람을 타고 몸을 비웁니다! (다음 적 턴 회피 보조)';
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '독 도포') {
          if (playerState.mp < smp(15)) response = `MP 부족 (${smp(15)} 필요)`;
          else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(15),
              runePoisonWeaponTurns: 5,
              ...mergeSkillCooldown(p, '독 도포'),
            }));
            response = '☠️ [독 도포] 무기에 독을 발랐습니다! (5턴간 평타에 중독 부여)';
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '올인') {
          if (playerState.mp < smp(18)) {
            response = `MP 부족 (${smp(18)} 필요)`;
          } else {
            const mult = Math.round((0.1 + Math.random() * 4.9) * 100) / 100;
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(18),
              runeNextDamageMult: mult,
              ...mergeSkillCooldown(p, '올인'),
            }));
            response = `🎲 [올인] 다음 1타 피해 배율 ×${mult.toFixed(2)}! (MP -${smp(18)})`;
            triggerEnemyTurn(activeEnemies, undefined, 'neutral');
          }
        } else if (skillName === '영혼 교체') {
          if (!playerState.isCombat || activeEnemies.length === 0) response = '전투 중이 아닙니다.';
          else if (!playerState.runeSoulSummonActive) response = '[해골 소환]으로 영혼을 불러낸 뒤에 쓸 수 있습니다.';
          else if (playerState.mp < smp(20)) response = `MP 부족 (${smp(20)} 필요)`;
          else {
            const tg0 = activeEnemies[0];
            const confuse = Math.max(1, Math.round(effAtk * 0.6));
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(20),
              runeSoulSummonActive: false,
              hp: Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.08)),
              ...mergeSkillCooldown(p, '영혼 교체'),
            }));
            setActiveEnemies((prev) =>
              prev.map((e, i) => (i === 0 ? { ...e, currentHp: Math.max(1, e.currentHp - confuse) } : e)),
            );
            response = `👻 [영혼 교체] 해골이 [${tg0.name}] 앞을 막아 ${confuse} 피해! HP 소량 회복.`;
            triggerEnemyTurn(activeEnemies);
          }
        } else if (skillName === '오버로드') {
          if (!playerState.isCombat || activeEnemies.length === 0) response = '전투 중이 아닙니다.';
          else if (playerState.mp < smp(40)) response = `MP 부족 (${smp(40)} 필요)`;
          else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(40),
              ...mergeSkillCooldown(p, '오버로드'),
            }));
            const magicBase = effAtk * 1.2 + effInt * 2.8 + effSpr * 0.8;
            const tacticalNuke = hasRunePair(
              playerState.equippedRuneId,
              playerState.equippedRuneSecondaryId,
              'war_mage',
              'tracker',
            );
            const applyWave = (list: ActiveEnemy[], mult: number) => {
              const deadL: ActiveEnemy[] = [];
              const aliveL: ActiveEnemy[] = [];
              list.forEach((e) => {
                const raw = Math.max(
                  1,
                  Math.round(
                    magicBase * (0.85 + Math.random() * 0.25) * mult * ((100 + effStr) / (100 + e.def)),
                  ),
                );
                const nh = e.currentHp - raw;
                if (nh <= 0) deadL.push({ ...e, currentHp: 0 });
                else aliveL.push({ ...e, currentHp: nh, sleepTurns: 0 });
              });
              return { dead: deadL, alive: aliveL };
            };
            let { dead, alive } = applyWave(activeEnemies, 1);
            if (tacticalNuke && alive.length > 0) {
              const w2 = applyWave(alive, 0.55);
              dead = [...dead, ...w2.dead];
              alive = w2.alive;
            }
            playSoundMagic();
            let overLog = '';
            const bigBang =
              tacticalNuke && dead.length > 0
                ? wrapScreenShakeLines(`☢️ [전술 핵] 2중 충격파! 광역 폭발로 ${dead.length}체 추가 전술 타격!`)
                : '⚡ [오버로드] 광역 폭발!';
            if (dead.length > 0) overLog = handleEnemiesDefeat(dead, bigBang);
            setActiveEnemies(alive);
            if (dead.length > 0) {
              response = `${overLog}\n${alive.map((e) => `[${e.name}] HP:${e.currentHp}`).join(', ')}`;
            } else {
              response =
                `${tacticalNuke ? '☢️ [전술 핵] 연쇄 파동!\n' : ''}⚡ [오버로드] 광역 폭발!\n${alive.map((e) => `[${e.name}] HP:${e.currentHp}`).join(', ')}`;
            }
            if (alive.length > 0) setTimeout(() => triggerEnemyTurn(alive), 300);
            else {
              stealthTurnsRef.current = 0;
              setPlayerState((p) => ({ ...p, isCombat: false, stealthTurnsLeft: 0 }));
              setSceneImage(BG_ALLEY);
            }
          }
        } else if (skillName === '철의 요새') {
          if (!playerState.isCombat) response = '전투 중이 아닙니다.';
          else if (playerState.mp < smp(25)) response = `MP 부족 (${smp(25)} 필요)`;
          else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(25),
              runeIronFortressTurns: 3,
              ...mergeSkillCooldown(p, '철의 요새'),
            }));
            response = '🏰 [철의 요새] 3턴간 이동 불가 · 받는 피해 90% 감소!';
            triggerEnemyTurn(activeEnemies);
          }
        } else if (skillName === '미라지') {
          if (!playerState.isCombat) response = '전투 중이 아닙니다.';
          else if (playerState.mp < smp(18)) response = `MP 부족 (${smp(18)} 필요)`;
          else {
            setPlayerState((p) => ({
              ...p,
              mp: p.mp - smp(18),
              runeMirageTurns: 3,
              ...mergeSkillCooldown(p, '미라지'),
            }));
            response = '🌫 [미라지] 분신이 적의 눈을 현혹합니다! (적 명중률 감소)';
            triggerEnemyTurn(activeEnemies);
          }
        } else if (input === '스킬') {
          response = `현재 보유 중인 스킬: ${playerState.skills.join(', ')}`;
        } else {
          response = `스킬 [${skillName}] 구현 중입니다.`;
        }
      } else if (input === '대화') {
        if (!lastTalkedNpc) {
          response = '대화할 NPC가 없습니다. (예: 대화 오니)';
        } else {
          const npc = NPC_LIST.find(n => n.id === lastTalkedNpc);
          if (npc) {
            // 이미지창에 NPC 이미지 표시 (미스테리오 등)
            setSceneImage(resolveNpcSceneImage(npc.id));
            // Check for quest dialogue first
            const applicableQuest = Object.values(QUESTS).find(q =>
              q.npcId === npc.id &&
              !playerState.quests.active[q.id] &&
              !playerState.quests.completed.includes(q.id)
            );

            if (applicableQuest) {
              response = `[${npc.name}]: "${applicableQuest.dialogue.start}"\n('선택 퀘스트수락' / '선택 거절')`;
              speakDialogue(applicableQuest.dialogue.start, npc.id);
            } else {
              // Fallback to standard NPC dialogue
              response = `[${npc.name}]: "무슨 일이지?"`;
              speakDialogue("무슨 일이지?", npc.id);
            }
          } else {
            response = 'NPC 정보를 찾을 수 없습니다.';
          }
        }
      } else if (input.startsWith('선택 ')) {
        const choice = input.substring(3).trim();
        const npcId = lastTalkedNpc;
        // 선택지 화면에서도 대화 중인 NPC 이미지가 이미지창에 보이도록
        if (npcId) setSceneImage(resolveNpcSceneImage(npcId));

        if (choice === '퀘스트수락') {
            if (!npcId) {
                response = '대화 중인 NPC가 없습니다. 먼저 대화를 시도하세요.';
            } else {
                const applicableQuest = Object.values(QUESTS).find(q =>
                    q.npcId === npcId &&
                    !playerState.quests.active[q.id] &&
                    !playerState.quests.completed.includes(q.id)
                );
                
                if (applicableQuest) {
                    setPlayerState(p => ({
                        ...p,
                        quests: { ...p.quests, active: { ...p.quests.active, [applicableQuest.id]: 0 } }
                    }));
                    response = `📜 퀘스트 [${applicableQuest.title}] 수락 완료!\n- 목표: ${applicableQuest.description}`;
                    speakNarration("퀘스트를 수락했습니다.");
                } else {
                    response = '수락할 수 있는 퀘스트가 없거나 이미 진행 중/완료되었습니다.';
                    speakNarration("수락할 퀘스트가 없습니다.");
                }
            }
        } else if (!npcId) {
          response = '지금은 대화 중인 NPC가 없습니다.';
        } else if (!choice || choice === '') {
          if (npcId === 'oni') response = "[오니 선택지]: '선택 코드주기' / '선택 가입'";
          else if (npcId === 'ghostQueen') response = "[퀸 선택지]: '선택 가입' / '선택 로맨스' / '선택 마법전수_파이어볼' / '선택 마법전수_라이트닝볼트' / '선택 마법전수_체인라이트닝' / '선택 마법전수_힐'";
          else if (npcId === 'neonFat') response = "[네온 팻 분기]: '선택 구매' / '선택 공짜' / '선택 퀘스트'";
          else if (npcId === 'lira') response = "[리라 선택지]: '선택 치료' (회복)";
          else if (npcId === 'ironJack') response = "[아이언 잭] '선택 상점' 또는 '거래 아이언 잭'";
          else response = `[${npcId}]에게는 제시된 선택지가 없습니다.`;
        } else if (npcId === 'oni') {
          if (choice === '코드주기') { setPlayerState(p => ({ ...p, story: { ...p.story, karma: p.story.karma - 10, joinedFaction: '레드 드래곤' } })); response = `[쿠로사키 오니]: "흐음... 현명한 선택이다." 🔴 세력 가입!`; }
          else if (choice === '가입') { setPlayerState(p => ({ ...p, story: { ...p.story, joinedFaction: '레드 드래곤' } })); response = `[쿠로사키 오니]: "좋아. 레드 드래곤이 널 지켜주지."`; }
          else { response = "[오니 선택지]: '선택 코드주기' / '선택 가입'"; }
        } else if (npcId === 'ghostQueen') {
          if (choice === '가입') { setPlayerState(p => ({ ...p, story: { ...p.story, joinedFaction: '프리덤 네트워크' } })); response = `[고스트 퀸]: "환영해..."`; }
          else if (choice === '로맨스') { response = `[고스트 퀸]: "나랑 데이트하고 싶어? 그 전에 실력을 증명해." (호감도 70 필요)`; }
          else if (choice === '마법전수_파이어볼') {
            const cost = 3000;
            if (playerState.skills.includes('파이어볼')) { response = `[고스트 퀸]: "넌 이미 그 뜨거운 코드를 품고 있잖아."`; }
            else if (playerState.credit < cost) { response = `[고스트 퀸]: "전송 비용이 부족해. ${cost} COIN이 필요해."`; }
            else {
              setPlayerState(p => ({ ...p, credit: p.credit - cost, skills: [...p.skills, '파이어볼'] }));
              response = `[고스트 퀸]: "이 코드가 모든 걸 태워버릴 거야."\n(${cost} COIN 지불 / 신규 스킬 [파이어볼🔥] 광역기 습득!)`;
            }
          }
          else if (choice === '마법전수_라이트닝볼트') {
            const cost = 2400;
            if (playerState.skills.includes('라이트닝 볼트')) { response = `[고스트 퀸]: "가장 완벽한 타격점은 이미 네 머리 속에 있어."`; }
            else if (playerState.credit < cost) { response = `[고스트 퀸]: "데이터 파편이 모자라. ${cost} COIN 가져와."`; }
            else {
              setPlayerState(p => ({ ...p, credit: p.credit - cost, skills: [...p.skills, '라이트닝 볼트'] }));
              response = `[고스트 퀸]: "번개의 창을 내려주지."\n(${cost} COIN 지불 / 신규 스킬 [라이트닝 볼트⚡] 강력한 단일기 습득!)`;
            }
          }
          else if (choice === '마법전수_체인라이트닝') {
            const cost = 4500;
            if (playerState.skills.includes('체인 라이트닝')) { response = `[고스트 퀸]: "이미 연쇄 폭파 코드가 내장되어 있잖아."`; }
            else if (playerState.credit < cost) { response = `[고스트 퀸]: "이건 고급 연산이야. ${cost} COIN이 필요해."`; }
            else {
              setPlayerState(p => ({ ...p, credit: p.credit - cost, skills: [...p.skills, '체인 라이트닝'] }));
              response = `[고스트 퀸]: "여러 마리의 벌레를 한 번에 태우기에 딱 좋지."\n(${cost} COIN 지불 / 신규 스킬 [체인 라이트닝🌩️] 다중 연쇄기 습득!)`;
            }
          }
          else if (choice === '마법전수_힐') {
            const cost = 4500;
            if (playerState.skills.includes('힐')) { response = `[고스트 퀸]: "스스로를 복구하는 프로토콜은 이미 있잖아."`; }
            else if (playerState.credit < cost) { response = `[고스트 퀸]: "회복 모듈은 비싸. ${cost} COIN짜리야."`; }
            else {
              setPlayerState(p => ({ ...p, credit: p.credit - cost, skills: [...p.skills, '힐'] }));
              response = `[고스트 퀸]: "이 따뜻한 에너지가 널 보호하길."\n(${cost} COIN 지불 / 신규 스킬 [힐💚] 강력한 자기 치유기 습득!)`;
            }
          }
          else { response = "[퀸 선택지]: '선택 가입' / '선택 로맨스' / '선택 마법전수_파이어볼' / '선택 마법전수_라이트닝볼트' / '선택 마법전수_체인라이트닝' / '선택 마법전수_힐'"; }
        } else if (npcId === 'neonFat') {
          if (choice === '구매') {
            if (playerState.credit < 50) {
              response = `[네온 팻]: "어이 러너, 여긴 외상 안 돼. 크레딧 모아와!" (COIN 부족: 50 필요)`;
            } else if (isInventoryFull(playerState.inventory)) {
              response = `[네온 팻]: "가방이 꽉 찼잖아. 치울 때까지 테이크아웃은 무리다." ${getInventoryFullMessage()}`;
            } else {
              setPlayerState(p => ({
                ...p,
                credit: p.credit - 50,
                hp: Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.5)),
                inventory: [...p.inventory, newInventoryRow('뉴-라멘')]
              }));
              response = `[네온 팻]: "여기 뜨끈한 영양 만점 라멘 한 그릇!" 🍜\n(50 COIN 지불 / HP가 50% 회복되었습니다)`;
            }
          }
          else { response = "[네온 팻 분기]: '선택 구매' / '선택 공짜' / '선택 퀘스트'"; }
        } else if (npcId === 'lira') {
          if (choice === '치료') {
             setPlayerState(p => ({ ...p, hp: p.maxHp }));
             response = `[리라]: "치료 끝. 다시 흉한 꼴로 오지 마라." (HP가 가득 회복되었습니다)`;
          } else { response = "[리라 선택지]: '선택 치료' (회복) 중에서 고르세요."; }
        } else if (npcId === 'ironJack') {
          // WHY: 대화 힌트('선택 상점')와 동작 일치 — '거래 아이언 잭'과 같은 상점 목록
          if (choice === '상점') {
            setSceneImage(resolveNpcSceneImage('ironJack'));
            response = getIronJackShopResponse(loggedInChar?.job);
          } else {
            response = "[아이언 잭] 상점은 '선택 상점' 또는 '거래 아이언 잭'으로 열 수 있습니다.";
          }
        } else {
          response = `[${npcId}]에게는 해당하는 선택지가 없습니다.`;
        }
      } else if (['휴식', '세이브', '캠프파이어'].includes(input)) {
        if (playerState.isCombat) {
          response = '전투 중에는 휴식할 수 없습니다!';
        } else {
          const room = getRoomById(currentRoomId);
          if (room && room.isSafe && playerState.villageOccupied?.[currentRoomId]) {
            response =
              `\u001b[31m⚠️ 몬스터의 악취와 소음 때문에 쉴 수 없습니다.\u001b[0m\n` +
              `이 휴식처는 적에게 점령당한 상태입니다. (함락)\n` +
              `몬스터를 몰아내거나, 해당 방에서 '마을 수복'으로 거점을 되찾으세요.`;
          } else if (room && room.isSafe) {
             setPlayerState(p => {
               // 휴식 시에는 디버프뿐 아니라 축복·비석 버프도 모두 제거해,
               // "모든 상태 이상이 사라졌다"는 문구와 실제 상태를 일치시킨다.
               const prevBlessBonus = p.blessAtkBonus ?? 0;
               const baseAtk = p.atk - prevBlessBonus;
               const cleaned = {
                 ...p,
                 blessTurns: 0,
                 blessAtkBonus: 0,
                 atk: baseAtk,
                 obeliskStrBonus: 0,
                 obeliskStrTurns: 0,
                 obeliskDexBonus: 0,
                 obeliskDexTurns: 0,
                 obeliskAtkBonus: 0,
                 obeliskAtkTurns: 0,
                 obeliskDefBonus: 0,
                 obeliskDefTurns: 0,
                 obeliskConBonus: 0,
                 obeliskConTurns: 0,
                 obeliskIntBonus: 0,
                 obeliskIntTurns: 0,
                 obeliskSprBonus: 0,
                 obeliskSprTurns: 0,
                 obeliskMaxHpBonus: 0,
                 obeliskMaxHpTurns: 0,
               };
               const caps = getEffectiveMaxHpMp(cleaned);
               const nextState = {
                 ...cleaned,
                 maxHp: caps.maxHp,
                 maxMp: caps.maxMp,
                 hp: caps.maxHp,
                 mp: caps.maxMp,
                 respawnRoomId: currentRoomId,
                 burnTurns: 0,
                 freezeTurns: 0,
                 staggerTurns: 0,
                 poisonTurns: 0,
                 sleepTurns: 0,
                 warriorThornAuraTurns: 0,
                 manaShieldActive: false,
               };
               if (loggedInChar) {
                 const charToSave = {
                   ...loggedInChar,
                   ...nextState,
                   hp: caps.maxHp,
                   mp: caps.maxMp,
                   respawnRoomId: currentRoomId,
                   currentRoomId,
                 };
                 saveCharacter(charToSave as Omit<import('./utils/saveSystem').SavedCharacter, 'savedAt'>);
               }
               return nextState;
             });
             // HUD 상에서도 즉시 축복 아이콘을 제거
             setHasBlessBuff(false);
             // WHY: 휴식 = 긴 호흡·정비이므로 전사 RAGE도 사망/리스폰과 같이 0으로 돌려 전투 테마와 일치시킨다.
             setRage(0);
             const rageRestNote =
               loggedInChar?.job === '전사' ? ' 분노(RAGE)도 가라앉았습니다.' : '';
             response = `🔥 [${room.name}] 안전지대에서 휴식을 취합니다.\n✨ 피로가 풀리며 (HP/MP)가 전부 회복되고, 모든 상태 이상이 사라졌습니다.${rageRestNote}\n(사망 시 이곳에서 부활합니다. 시스템 저장 완료.)`;
          } else {
             response = '이곳은 안전지대가 아닙니다. 적으로부터 방해받을 수 있어 휴식할 수 없습니다.';
          }
        }
      } else if (['퀘스트', '!퀘스트'].includes(input)) {
        let questLog = '📜 [퀘스트 일지]\n';
        const activeIds = Object.keys(playerState.quests.active);
        const completedIds = playerState.quests.completed;

        if (activeIds.length === 0 && completedIds.length === 0) {
           questLog += '아직 받은 퀘스트가 없습니다.';
        } else {
           if (activeIds.length > 0) {
             questLog += '=== 진행 중인 퀘스트 ===\n';
             activeIds.forEach(qId => {
                const qDef = QUESTS[qId];
                if (qDef) {
                   const progress = playerState.quests.active[qId];
                   const max = qDef.requiredCount;
                   const val = qDef.type === 'kill' ? progress : (inventoryHasItemName(playerState.inventory, qDef.targetId) ? 1 : 0);
                   questLog += `- ${qDef.title} (${val}/${max})\n  ${qDef.description}\n`;
                }
             });
           }
           if (completedIds.length > 0) {
             if (activeIds.length > 0) questLog += '\n';
             questLog += '=== 완료된 퀘스트 ===\n';
             completedIds.forEach(qId => {
                const qDef = QUESTS[qId];
                if (qDef) {
                   questLog += `- [완료] ${qDef.title}\n`;
                }
             });
           }
        }
        response = questLog.trim();
      } else {
        response = `'${cmd}' — 명령어를 이해하지 못했습니다.`;
      }
      }

      // WHY: 전투 중 공격/방어 관련 커맨드일 때는 응답 앞에
      //      "플레이어 턴" 헤더를 붙여 적 턴 로그와 명확히 구분한다.
      const combatCommandPrefixes = ['공격', '어택', '방어', '가드', '회피', '도지', '패링', '쳐내기'];
      if (
        playerState.isCombat &&
        activeEnemies.length > 0 &&
        response &&
        !freezeBlocked &&
        combatCommandPrefixes.some((prefix) => input.startsWith(prefix))
      ) {
        response = response.startsWith(`${COMBAT_LOG_PLAYER_HEADER}\n`) || response.startsWith(`${COMBAT_LOG_PLAYER_HEADER}\r\n`)
          ? response
          : wrapCombatLogPlayerBody(response);
      }

      // 방 바깥에 있던 "인지된 적"이 한 칸씩 접근한다. (접근 후 현재 방에 도달하면 전투 시작)
      // 단, 이 커맨드에서 이미 전투를 시작했다면(이동 이벤트/조우 등) 같은 커맨드에서 중복 시작하지 않도록 스킵한다.
      if (!freezeBlocked && !combatStartedThisCommand) {
        const adv = advanceAlertedEnemies();
        if (adv.preemptiveLog) {
          response = (response ? response + '\n' : '') + adv.preemptiveLog;
        }
        if (adv.moveLog) {
          response = (response ? response + '\n' : '') + adv.moveLog;
        }
      }

      // 전 직업 패시브 [HP/MP 회복]: 비전투에서 행동 1회당 회복량 = 레벨×3 (최대 15). 전투 중에는 적 턴 종료 시 applyRegenPassive. 빙결 등은 턴 소모만 하면 회복 없음. 태세 전환은 회복 스킵.
      if (!postureHandled && !freezeBlocked && !playerState.isCombat && !nonCombatRegenAppliedRef.current) {
        nonCombatRegenAppliedRef.current = true;
        setPlayerState(prev => {
          const { next, logs: regenLogs } = applyRegenPassive(prev);
          if (regenLogs.length) {
            // 같은 커맨드 안에서는 로그를 한번만 추가
            regenLogs.forEach(line => {
              response = (response ? response + '\n' : '') + line;
            });
          }
          return next;
        });
      }

      // 이 커맨드 처리 도중 "적을 모두 처치해서 전투가 끝난 경우"에만 공통 안내 문구를 추가한다.
      if (combatEndedThisCommand) {
        response = response
          ? `${response}\n✅ 모든 적을 처치했습니다. 전투가 종료되었습니다.`
          : '✅ 모든 적을 처치했습니다. 전투가 종료되었습니다.';
      }

      if (typeof response === 'string' && response.includes(RUNE_LOG_SPLIT)) {
        const [a, b] = response.split(RUNE_LOG_SPLIT);
        setLogs((prev) => [...prev, a, b]);
      } else {
        setLogs((prev) => [...prev, response]);
      }
      } catch (err) {
        // WHY: 저격/사격 같이 상태를 여러 번 건드리는 커맨드에서 런타임 에러가 나면
        //      `handlingCommandRef.current = false`가 실행되지 않아 게임이 "멈춘 것처럼" 보일 수 있다.
        //      그래서 항상 finally에서 플래그를 풀어 입력 잠김을 방지한다.
        console.error(err);
        const errMsg = (err instanceof Error ? err.message : String(err)).slice(0, 120);
        const errLine = `⚠️ [오류] 명령 처리 중 문제가 발생했습니다. (${errMsg})`;
        setLogs(prev => [...prev, errLine]);
      } finally {
        handlingCommandRef.current = false;
      }
    }, 50);
  };

  // WHY: React 훅은 조건 없이 매 렌더마다 같은 순서로 호출해야 함. 로그인 화면 early return 뒤에 두면
  //      로그인 전에는 훅이 줄어들어 "Rendered more hooks than during the previous render" 가 발생한다.
  const zoneMapRooms = useMemo(() => getRoomsForZoneMap(currentRoomId), [currentRoomId]);
  const zoneMapTitle = useMemo(() => getZoneMapTitle(currentRoomId), [currentRoomId]);
  const zone1BountyWanderPool = useMemo(() => getZone1WanderRoomIds(), []);

  // 로그인 후에만 M 단축키 등록 (로그인 화면에서 맵이 켜지는 일 방지)
  useEffect(() => {
    if (!loggedInChar) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'm' && e.key !== 'M') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      setShowZoneMap((v) => !v);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loggedInChar]);

  if (!loggedInChar) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const currentRoom = getRoomById(currentRoomId);

  // 퍼즐형 숨겨진 출구 정의: 기본 방 데이터에는 없고, 조사로만 열리는 출구
  const HIDDEN_EXITS: Record<string, Partial<Record<'북'|'남'|'동'|'서', string>>> = {
    slum_s3e2s: { '남': 'maze_s1' }, // 야적장 끝 → 심층 미로 입구
  };

  // 특정 장소에서만 조사로 얻을 수 있는 아이템 (방 id → 아이템명). 퀘스트용 fetch 아이템 보장용.
  const ROOM_SEARCH_ITEMS: Record<string, string> = {
    heavy_storage: '손상된 백도어 칩',       // 중화전 물류창고 — main_q_trace
    data_center: '오래된 서버 로그 칩',     // 양자 코어 메인프레임 — mysterio_q1
    slum_w3n2w: '곰팡이 핀 연구 자료',      // 지하실 깊은 곳 — lira_q2
    bulk_terminal_vault: '심층 격납 데이터 코어', // 벌크 14구역 최하단 격납고
  };

  // WHY: 방별로 "이 방에서 아이템/잡동사니 판매를 받는 NPC"를 고정해, 같은 방에 있는 상인만 응답하게 함.
  const ROOM_SELL_NPC: Record<string, string> = {
    slum_market: 'ironJack',  // 지하 슬럼 상점가 — 아이언 잭
  };

  const getVisibleExits = (room: ReturnType<typeof getRoomById> | undefined) => {
    if (!room) return {};
    const base = room.exits || {};
    const hidden = HIDDEN_EXITS[room.id] || {};
    const discovered = discoveredHiddenExits.has(room.id);
    return discovered ? { ...base, ...hidden } : base;
  };

  // 인벤토리 아이템 추가 — 물약은 qty 스택, 종류당 최대 5(전사 6)
  const POTION_LIMIT_PER_TYPE_BASE = 5;
  const POTION_NAMES = STACKABLE_POTION_ITEM_NAMES;

  const addItemToInventory = (
    prevInv: InventoryRow[],
    itemName: string,
    extraLogs: string[],
    opts?: { fromCombatLoot?: boolean; runeQuality?: number }
  ): { inventory: InventoryRow[]; logs: string[] } => {
    if (POTION_NAMES.has(itemName)) {
      const totalQty = countStackablePotionQty(prevInv, itemName);
      const limit =
        loggedInChar?.job === '전사'
          ? POTION_LIMIT_PER_TYPE_BASE + 1
          : POTION_LIMIT_PER_TYPE_BASE;
      if (totalQty >= limit) {
        return {
          inventory: prevInv,
          logs: [
            ...extraLogs,
            `🎒 [인벤토리] [${itemName}]은(는) 이미 최대 ${limit}개까지 보유 중입니다. 더 이상 가지고 다닐 공간이 없습니다.`,
          ],
        };
      }
      const mergeIdx = prevInv.findIndex((r) => isStackablePotionRow(r) && r.name === itemName);
      if (mergeIdx >= 0) {
        const row = prevInv[mergeIdx];
        const q = getInventoryStackQty(row);
        const next = [...prevInv];
        next[mergeIdx] = { ...row, qty: q + 1 };
        return { inventory: next, logs: extraLogs };
      }
    }

    const needsNewSlot = !(POTION_NAMES.has(itemName) && prevInv.some((r) => isStackablePotionRow(r) && r.name === itemName));
    if (needsNewSlot && isInventoryFull(prevInv)) {
      return {
        inventory: prevInv,
        logs: [...extraLogs, getInventoryFullMessage()],
      };
    }
    if (opts?.fromCombatLoot) {
      const def = getItemByName(itemName);
      if (def && isEquippableForMystery(def) && Math.random() < 0.4) {
        const mysteryRow = newMysteryInventoryRow(def.id);
        return {
          inventory: [...prevInv, mysteryRow],
          logs: [
            ...extraLogs,
            `📦 [?] ${mysteryRow.name} 획득 — 미확인. [${APPRAISAL_SCROLL_ITEM_NAME}] 또는 아이언 잭(슬럼·미로 등, 대화 후 ${IRON_JACK_APPRAISAL_COST_COINS} C)으로 감정. (예: 감정 ${mysteryRow.name})`,
          ],
        };
      }
    }
    if (
      itemName.startsWith(RUNE_ITEM_NAME_PREFIX) &&
      opts?.runeQuality != null &&
      Number.isFinite(opts.runeQuality)
    ) {
      const rq = clampRuneQuality(opts.runeQuality);
      return {
        inventory: [...prevInv, newInventoryRow(itemName, { runeQuality: rq })],
        logs: extraLogs,
      };
    }
    const plainDef = getItemByName(itemName);
    const rowOpts =
      itemSupportsInstanceLevel(plainDef) && plainDef
        ? { itemLevel: rollItemLevelForDrop(playerState.level ?? 1, Math.random) }
        : undefined;
    return {
      inventory: [...prevInv, newInventoryRow(itemName, rowOpts)],
      logs: extraLogs,
    };
  };

  // 전투 HUD에 표시할 실제 전투 스탯(장비·스탯·마스터리 반영 값)
  const { effAtk, effDef, effStr } = getEffectiveStats();
  const hasObeliskBuff =
    (playerState.obeliskStrTurns ?? 0) > 0 ||
    (playerState.obeliskDexTurns ?? 0) > 0 ||
    (playerState.obeliskAtkTurns ?? 0) > 0 ||
    (playerState.obeliskDefTurns ?? 0) > 0 ||
    (playerState.obeliskConTurns ?? 0) > 0 ||
    (playerState.obeliskIntTurns ?? 0) > 0 ||
    (playerState.obeliskSprTurns ?? 0) > 0 ||
    (playerState.obeliskMaxHpTurns ?? 0) > 0;

  return (
    <div
      className={`h-screen w-screen flex flex-col bg-[#08090f] text-zinc-200 relative overflow-hidden transition-colors duration-300 ${
        playerState.isCombat ? 'ring-1 ring-inset ring-red-500/25' : ''
      }`}
    >
      {/* 헤더: 과한 트래킹·글로우 제거, 한 줄로 읽기 쉽게 */}
      <header
        className={`h-12 px-4 sm:px-5 border-b flex justify-between items-center z-50 shrink-0 bg-zinc-900/80 backdrop-blur-md ${
          playerState.isCombat ? 'border-red-500/20' : 'border-white/10'
        }`}
      >
        <h1 className="text-sm font-semibold tracking-tight flex items-center gap-2 text-zinc-100">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${playerState.isCombat ? 'bg-red-500' : 'bg-emerald-500'}`}
            aria-hidden
          />
          <span>NEON REQUIEM</span>
          <span className="text-[10px] text-zinc-500 font-normal">v1.6.2</span>
        </h1>
        {/* HP/MP는 우측 세로 레일(PlayerVitalsStrip)에만 표시 — 헤더 중복 제거 */}
        <div className="flex max-w-[18rem] items-center gap-2 truncate text-xs text-zinc-400 sm:max-w-xs">
          <button
            type="button"
            title="전체 구역 지도 (입력창에 포커스 없을 때 M)"
            onClick={() => setShowZoneMap((v) => !v)}
            className="shrink-0 rounded-md border border-[#0ddff2]/35 bg-[#0ddff2]/10 px-2 py-1 text-[10px] font-semibold tracking-wide text-[#7eefff] hover:bg-[#0ddff2]/20"
          >
            구역
          </button>
          <span className="truncate font-medium text-amber-200/90">{loggedInChar.name}</span>
          {loggedInChar?.job && (
            <span className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {loggedInChar.job}
            </span>
          )}
        </div>
      </header>

      {/* 본문+레일 위 / 전체 너비 하단에 ATK·DEF·STR 한 줄 */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
      <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* WHY: 50/50보다 기록 영역을 넓혀 가독성 — 대략 58 : 42 */}
        <section className="min-w-0 flex-[29] basis-0 flex flex-col border-r border-white/10 bg-[#06070c]">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-zinc-900/50 text-[11px] text-zinc-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shrink-0" aria-hidden />
            <span className="font-medium text-zinc-300">기록</span>
            <span className="text-zinc-600 truncate">텍스트 로그</span>
          </div>
          <Console
            logs={logs}
            getItemTooltip={(itemName) =>
              getItemTooltip(itemName, playerState.equipmentUpgradeLevels, playerState.equipmentEffectiveGrade, playerState.inventory)
            }
          />
        </section>

        {/* 우측 패널: 씬 → 지도 → 캐릭터 안내 (폭은 flex 비율로 메인보다 좁게) */}
        <aside className="flex min-h-0 min-w-0 flex-[21] basis-0 flex-col border-l border-white/10 bg-[#0a0b10]">
          <div className="flex flex-col flex-1 min-h-0 p-3 gap-3">
            <div className="shrink-0 rounded-xl border border-white/10 bg-zinc-950/80 overflow-hidden shadow-sm">
              <div className="px-2.5 py-1.5 border-b border-white/10 text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
                장면
              </div>
              <div className="relative aspect-[16/10] max-h-[min(32vh,280px)] min-h-[140px] w-full bg-zinc-950">
                <img
                  key={sceneImage ?? 'default'}
                  src={
                    scenePanelImgFailed
                      ? SCENE_IMAGE_FALLBACK_DATA_URI
                      : (sceneImage?.trim() || BG_ALLEY)
                  }
                  alt=""
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-contain object-center transition-opacity duration-500 select-none"
                  onLoad={() => setScenePanelImgFailed(false)}
                  onError={() => {
                    // WHY: 로드 실패(경로/캐시/배포 루트 문제) 시 즉시 data URI로 강제 폴백해 "검정 화면" 체감 제거
                    setScenePanelImgFailed(true);
                    setSceneImage(SCENE_IMAGE_FALLBACK_DATA_URI);
                  }}
                />
                {/* 하단만 살짝 어둡게 — 전체를 덮으면 어두운 배경 일러가 ‘빈 프레임’처럼 보일 수 있음 */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b10]/75 via-transparent to-transparent pointer-events-none" />
                {activeEnemies.length > 0 ? (
                  <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1.5">
                    {activeEnemies.map((enemy) => {
                      const poison = enemy.poisonTurns ?? 0;
                      const burn = enemy.burnTurns ?? 0;
                      const freeze = enemy.freezeTurns ?? 0;
                      const stun = enemy.stunTurns ?? 0;
                      const sleep = enemy.sleepTurns ?? 0;
                      const bleed = enemy.bleedTurns ?? 0;
                      const stagger = enemy.staggerTurns ?? 0;
                      const atkBuff = (enemy.atkBuffTurns ?? 0) > 0 ? (enemy.atkBuffTurns ?? 0) : 0;
                      const statusBadges: string[] = [];
                      if (poison > 0) statusBadges.push(`☠️${poison}`);
                      if (burn > 0) statusBadges.push(`🔥${burn}`);
                      if (freeze > 0) statusBadges.push(`❄️${freeze}`);
                      if (stun > 0) statusBadges.push(`⚡${stun}`);
                      if (sleep > 0) statusBadges.push(`💤${sleep}`);
                      if (bleed > 0) statusBadges.push(`🩸${bleed}`);
                      if (stagger > 0) statusBadges.push(`⚡경${stagger}`);
                      if ((enemy.sunderTurns ?? 0) > 0) statusBadges.push(`🛡−${enemy.sunderTurns}`);
                      if (enemy.warriorMarkActive) statusBadges.push('🎯표식');
                      if (atkBuff > 0) statusBadges.push(`📈${atkBuff}`);
                      // 살아 있으면 반올림 0%가 되지 않게 최소 1% 표기 — 실제 HP는 1 이상일 수 있음
                      const enemyHpBarPct =
                        enemy.maxHp > 0 && enemy.currentHp > 0
                          ? Math.max(1, Math.min(100, Math.round((enemy.currentHp / enemy.maxHp) * 100)))
                          : 0;
                      return (
                        <div key={enemy.id} className="animate-pulse-slow">
                          <div className="flex justify-between items-end mb-0.5 flex-wrap gap-1">
                            <span className="text-red-400 font-semibold text-xs">
                              {enemy.name}
                              {statusBadges.length > 0 && (
                                <span className="ml-1 text-[9px] font-normal opacity-90" title="상태 이상">
                                  {statusBadges.join(' ')}
                                </span>
                              )}
                            </span>
                            <span className="text-red-400/90 text-[10px] font-mono tabular-nums">
                              {enemyHpBarPct}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-red-950/50 border border-red-500/30 rounded overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                              style={{ width: `${enemyHpBarPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <div className="bg-black/60 px-2 py-1 border border-white/15 rounded text-[11px] inline-flex items-center gap-1.5 max-w-fit">
                      <span className="text-emerald-400">📍</span>
                      <span className="text-zinc-200 font-medium">{currentRoom?.name ?? '탐색 중...'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {showMap && (
              <div className="flex max-h-[min(40vh,380px)] min-h-[176px] flex-1 flex-col rounded-xl border border-white/10 bg-zinc-950/80 overflow-hidden shadow-sm">
                <div className="px-3 py-2 border-b border-white/10 shrink-0">
                  <span className="text-[11px] font-semibold text-zinc-300">지도</span>
                  <span className="text-[10px] text-zinc-500 ml-2">주변 방향 탐색</span>
                </div>
                <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-2">
                  <MapPanel
                    currentRoomId={currentRoomId}
                    rooms={[]}
                    density="comfortable"
                    villageOccupied={playerState.villageOccupied}
                  />
                </div>
              </div>
            )}
            {/* 이름·직업은 상단 헤더 오른쪽에만 표시 — 중복 카드 제거 */}
          </div>
        </aside>
      </main>

      <aside
        className="z-40 flex w-[15rem] shrink-0 flex-col border-l border-[#0ddff2]/30 bg-zinc-950/98 min-h-0 xl:w-[17rem]"
        aria-label="버프·자원·장비·태세·스킬"
      >
        <div className="shrink-0 border-b border-white/10 bg-zinc-950/80 px-2 py-1.5">
          <div className="mb-1 text-[9px] font-medium text-zinc-500">버프·디버프</div>
          <div className="custom-scrollbar flex max-h-28 flex-wrap content-start gap-1 overflow-y-auto text-[9px] leading-snug">
            {(() => {
              const pl = playerState.passiveLevels || {};
              const hasHp = Boolean(pl['hp_regen'] ?? ((playerState.passiveSkills || []).includes('hp_regen') ? 1 : 0));
              const hasMp = Boolean(pl['mp_regen'] ?? ((playerState.passiveSkills || []).includes('mp_regen') ? 1 : 0));
              const noBuff =
                !hasBlessBuff &&
                !hasHp &&
                !hasMp &&
                !hasObeliskBuff &&
                !playerState.burnTurns &&
                !playerState.freezeTurns &&
                !playerState.staggerTurns &&
                !playerState.poisonTurns &&
                !playerState.sleepTurns &&
                !playerState.prayerHealTurns;
              return (
                <>
                  {noBuff && <span className="text-zinc-600">없음</span>}
                  {hasBlessBuff && (
                    <span className="rounded border border-[#facc15]/50 bg-[#facc15]/15 px-1 py-0.5 font-semibold text-[#facc15]">
                      ✨축복
                    </span>
                  )}
                  {hasHp && (
                    <span className="rounded border border-emerald-500/40 bg-emerald-950/40 px-1 py-0.5 text-emerald-200">
                      💚HP재생
                    </span>
                  )}
                  {hasMp && (
                    <span className="rounded border border-violet-500/40 bg-violet-950/30 px-1 py-0.5 text-violet-200">
                      💜MP재생
                    </span>
                  )}
                  {hasObeliskBuff && (
                    <span
                      className="rounded border border-cyan-500/40 bg-cyan-950/40 px-1 py-0.5 text-cyan-100"
                      title="비석 버프"
                    >
                      🗿비석
                      {(playerState.obeliskStrTurns ?? 0) > 0 && `힘${playerState.obeliskStrTurns}`}
                      {(playerState.obeliskDexTurns ?? 0) > 0 && `민${playerState.obeliskDexTurns}`}
                      {(playerState.obeliskAtkTurns ?? 0) > 0 && `공${playerState.obeliskAtkTurns}`}
                      {(playerState.obeliskDefTurns ?? 0) > 0 && `방${playerState.obeliskDefTurns}`}
                      {(playerState.obeliskConTurns ?? 0) > 0 && `체${playerState.obeliskConTurns}`}
                      {(playerState.obeliskIntTurns ?? 0) > 0 && `지${playerState.obeliskIntTurns}`}
                      {(playerState.obeliskSprTurns ?? 0) > 0 && `정${playerState.obeliskSprTurns}`}
                      {(playerState.obeliskMaxHpTurns ?? 0) > 0 && `한${playerState.obeliskMaxHpTurns}`}
                    </span>
                  )}
                  {playerState.burnTurns > 0 && (
                    <span className="rounded border border-red-500/50 bg-red-950/40 px-1 py-0.5 text-red-200">
                      🔥{playerState.burnTurns}
                    </span>
                  )}
                  {playerState.freezeTurns > 0 && (
                    <span className="rounded border border-cyan-400/50 bg-cyan-950/40 px-1 py-0.5 text-cyan-100">
                      ❄{playerState.freezeTurns}
                    </span>
                  )}
                  {playerState.staggerTurns > 0 && (
                    <span className="rounded border border-yellow-500/50 bg-yellow-950/40 px-1 py-0.5 text-yellow-100">
                      ⚡{playerState.staggerTurns}
                    </span>
                  )}
                  {playerState.poisonTurns > 0 && (
                    <span className="rounded border border-green-500/50 bg-green-950/40 px-1 py-0.5 text-green-100">
                      ☠{playerState.poisonTurns}
                    </span>
                  )}
                  {playerState.sleepTurns > 0 && (
                    <span className="rounded border border-indigo-500/50 bg-indigo-950/40 px-1 py-0.5 text-indigo-100">
                      💤{playerState.sleepTurns}
                    </span>
                  )}
                  {playerState.prayerHealTurns > 0 && (
                    <span className="rounded border border-emerald-500/50 bg-emerald-950/40 px-1 py-0.5 text-emerald-100">
                      📿{playerState.prayerHealTurns}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <PlayerVitalsStrip
          layout="rail"
          level={playerState.level}
          exp={playerState.exp}
          maxExp={playerState.maxExp}
          hp={playerState.hp}
          maxHp={playerState.maxHp}
          mp={playerState.mp}
          maxMp={playerState.maxMp}
          rage={rage}
          jobName={loggedInChar?.job ?? null}
          damagePop={playerDamagePop}
        />

        <div className="shrink-0 border-b border-white/10 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="text-zinc-500 tracking-wide">크레딧</span>
            <span className="text-amber-200/90 font-semibold tabular-nums shrink-0" title="보유 크레딧">
              💰 {playerState.credit}
            </span>
          </div>
        </div>

        <div className="custom-scrollbar max-h-[min(42vh,320px)] shrink-0 overflow-y-auto overflow-x-hidden border-b border-white/10 px-2 py-1.5">
          <CharacterEquipmentBlock
            narrowRail
            withTopSeparator={false}
            weapon={formatEquipmentHudLine(playerState.weapon)}
            offHand={formatEquipmentHudLine(playerState.offHand)}
            armor={formatEquipmentHudLine(playerState.armor)}
            ring1={formatEquipmentHudLine((playerState as any).ring1)}
            ring2={formatEquipmentHudLine((playerState as any).ring2)}
            necklace={formatEquipmentHudLine((playerState as any).necklace)}
            weaponDurability={formatHudSlotDurability(playerState.weapon)}
            offHandDurability={formatHudSlotDurability(playerState.offHand)}
            armorDurability={formatHudSlotDurability(playerState.armor)}
            ring1Durability={formatHudSlotDurability((playerState as any).ring1)}
            ring2Durability={formatHudSlotDurability((playerState as any).ring2)}
            necklaceDurability={formatHudSlotDurability((playerState as any).necklace)}
            title={(playerState as any).title}
          />
        </div>

        <SkillBar
          sections="postureOnly"
          layout="rail"
          skills={skillsForSkillBar}
          currentMp={playerState.mp}
          isCombat={playerState.isCombat}
          onSkillUse={(name) => handleCommand(`스킬 ${name}`)}
          skillLevels={playerState.skillLevels}
          battlePosture={playerState.battlePosture ?? 'balanced'}
          onBattlePostureChange={(next) => {
            const prev = playerState.battlePosture ?? 'balanced';
            if (prev === next) return;
            setPlayerState((p) => ({ ...p, battlePosture: next }));
            setLogs((lg) => [
              ...lg,
              `⚔ 태세: 【${BATTLE_POSTURE_LABEL[next]}】 (ATK×${BATTLE_POSTURE_ATK_MULT[next]} / DEF×${BATTLE_POSTURE_DEF_MULT[next]} / 자동방어×${BATTLE_POSTURE_GUARD_CHANCE_MULT[next]}, 턴 소모 없음)`,
            ]);
          }}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-white/10">
          <SkillBar
            sections="skillsOnly"
            layout="rail"
            skills={skillsForSkillBar}
            currentMp={playerState.mp}
            isCombat={playerState.isCombat}
            skillToggleActive={{
              '마나 실드': isManaShieldEffectivelyActive(playerState),
            }}
            onCombatBasicCommand={(cmd) => handleCommand(cmd)}
            onSkillUse={(name) => handleCommand(`스킬 ${name}`)}
            skillLevels={playerState.skillLevels}
            battlePosture={playerState.battlePosture ?? 'balanced'}
            onBattlePostureChange={(next) => {
              const prev = playerState.battlePosture ?? 'balanced';
              if (prev === next) return;
              setPlayerState((p) => ({ ...p, battlePosture: next }));
              setLogs((lg) => [
                ...lg,
                `⚔ 태세: 【${BATTLE_POSTURE_LABEL[next]}】 (ATK×${BATTLE_POSTURE_ATK_MULT[next]} / DEF×${BATTLE_POSTURE_DEF_MULT[next]} / 자동방어×${BATTLE_POSTURE_GUARD_CHANCE_MULT[next]}, 턴 소모 없음)`,
              ]);
            }}
          />
        </div>
      </aside>
      </div>

      <CombatStatsStrip atk={effAtk} def={effDef} str={effStr} />
      <QuickInteractionBar
        onCommand={handleCommand}
        isCombat={playerState.isCombat}
        onAfterCommand={() => commandInputRef.current?.focus()}
      />
      <InputPrompt
        ref={commandInputRef}
        variant="dock"
        onCommand={handleCommand}
        isCombat={playerState.isCombat}
        inventory={playerState.inventory.map((r) => invName(r))}
        skills={skillsForSkillBar}
      />
      </div>

      {/* 사망 전용 풀스크린 오버레이: 2.5초 동안 화면 전환으로 죽음을 명확히 인지시킴 */}
      {showDeathOverlay && (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 animate-fade-in"
          style={{ backgroundColor: 'rgba(80,0,0,0.92)' }}
          aria-live="assertive"
        >
          <div className="text-center text-red-500 font-black tracking-[0.4em] text-4xl sm:text-5xl md:text-6xl uppercase drop-shadow-[0_0_20px_rgba(255,0,0,0.6)] animate-pulse">
            ☠ Y O U &nbsp; A R E &nbsp; D E A D ☠
          </div>
          <div className="mt-6 text-red-400/90 font-bold tracking-[0.5em] text-xl sm:text-2xl uppercase">
            &lt;&lt; F L A T L I N E D &gt;&gt;
          </div>
        </div>
      )}

      {/* 보스룸 진입 전용 풀스크린 오버레이: 사망 화면처럼 크고 극적으로 표시 후 2.8초 뒤 자동 해제 */}
      {showBossRoomOverlay && (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center animate-fade-in"
          style={{ backgroundColor: 'rgba(40,0,20,0.95)' }}
          aria-live="assertive"
        >
          <div className="text-center text-red-500 font-black tracking-[0.35em] text-3xl sm:text-4xl md:text-5xl lg:text-6xl uppercase drop-shadow-[0_0_24px_rgba(255,50,80,0.8)] animate-pulse">
            💀 &nbsp; B O S S &nbsp; R O O M ! &nbsp; 💀
          </div>
          <div className="mt-6 text-red-400/80 font-bold tracking-[0.4em] text-lg sm:text-xl md:text-2xl uppercase">
            &lt;&lt; 관 문 보 스 출 현 &gt;&gt;
          </div>
        </div>
      )}

      <ZoneMapModal
        open={showZoneMap}
        onClose={() => setShowZoneMap(false)}
        title={zoneMapTitle}
        rooms={zoneMapRooms}
        currentRoomId={currentRoomId}
      />

      {(miniBossQte || heavyStrikeQte) && (
        <CombatQteOverlay
          open={!!(miniBossQte || heavyStrikeQte)}
          variant={miniBossQte ? 'miniBoss' : 'heavyStrike'}
          enemyName={(miniBossQte ?? heavyStrikeQte)!.enemyName}
          sequence={(miniBossQte ?? heavyStrikeQte)!.sequence}
          stepMs={miniBossQte ? 1100 : 820}
          prepMs={miniBossQte ? 1600 : 720}
          minSessionMs={miniBossQte ? 4500 : 2000}
          minOutcomeHoldMs={miniBossQte ? 2200 : 900}
          onSuccess={miniBossQte ? resolveMiniBossQteSuccess : resolveHeavyStrikeQteSuccess}
          onFail={miniBossQte ? resolveMiniBossQteFail : resolveHeavyStrikeQteFail}
              />
      )}
    </div>
  );
};

export default App;
