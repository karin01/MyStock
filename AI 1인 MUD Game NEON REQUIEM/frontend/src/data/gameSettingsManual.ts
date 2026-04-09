/**
 * [설정] 명령 출력 — 외부 공유·기획 검증용 텍스트 명세
 * WHY: 플레이어 안내([도움말])와 달리, 타인이 컨셉·수식·구조를 한 번에 파악하도록 정리
 *
 * 주의: 최종 동작은 항상 소스 코드(App.tsx 등)가 기준이며, 본 문서는 요약·입문용이다.
 */
import { ECONOMY_COST_WORLD_MULT } from './economyBalance';
import { INVENTORY_MAX_SLOTS } from '../utils/inventoryHelpers';
import { PLAYER_MAX_LEVEL } from './playerProgress';
import { MAIN_GOAL_TEXT, WORLDVIEW_DETAIL, WORLDVIEW_ONE_LINE } from './story';
import { RUNE_DATA, RUNE_EQUIP_MIN_LEVEL } from './runes';

export function getGameSettingsManualText(): string {
  const mult = ECONOMY_COST_WORLD_MULT;
  const runeLines = RUNE_DATA.map(
    (r) =>
      `    · ${r.displayName} (id: ${r.id}) — 패시브: ${r.passiveShort} / 스킬:「${r.skillKo}」`,
  ).join('\n');
  return `
※ 이 게임은 2000년 초반 울프팩 스튜디오의 「쉐도우 베인」이라는 게임을 기반으로 만들어졌습니다.

================================================================
  NEÓN REQUIEM — 외부 공유용 설정·시스템 명세 (요약본)
================================================================

[1. 문서 목적 · 독자]
  · 목적: 이 게임이 무엇인지, 규칙·계산이 대략 어떻게 돌아가는지 타인(검증자·협업자·플레이어
    소개용)이 텍스트만으로 이해할 수 있게 한 곳에 모은다.
  · 플레이 중 명령 목록·예시는 [도움말]이, 진행 상황·세부 서사는 [스토리]/[목표]가 담당한다.
  · 수치·분기는 버전에 따라 코드가 바뀔 수 있으므로, 불일치 시 코드(아래 [10])를 우선한다.

[2. 작품 컨셉 · 형식]
  · 한 줄 요약: ${WORLDVIEW_ONE_LINE}
  · 장르: 사이버펑크 톤의 텍스트 중심 MUD + 브라우저 UI(로그, 맵, 전투 스킬 바, 일부 QTE).
  · 세계관(인게임 서사 원문):
${WORLDVIEW_DETAIL.split('\n').map((line) => `    ${line}`).join('\n')}
  · 설계된 최종 목표(스토리 텍스트): ${MAIN_GOAL_TEXT}

[3. 플레이어 진행 · 성장 상수]
  · 최대 레벨: Lv.${PLAYER_MAX_LEVEL} (data/playerProgress.ts — PLAYER_MAX_LEVEL).
  · 레벨 L에서 다음 레벨까지 필요 경험치(이론식, L < 만렙):
      max(1, floor((100 + 40·L + 6·L² + 0.05·L³) × 1.12))
    만렙이면 요구치는 UI용 더미(1)로 두고 실제 레벨업은 없음.
  · 스탯: 힘·민첩·체력·지능·정신. 레벨업 포인트는 명령으로 배분(게임 내 [스탯투자]).
  · 직업(5종): 마법사·성직자·전사·도적·로그 — 시작 장비·스킬 풀·일부 전용 명령이 분리됨.

[3-A. 직업별 특징 (data/jobClasses.ts · App.tsx)]
  · 공통 정의: 각 행은 JOB_LIST 한 줄(이름·base 스탯·시작 장비·시작 스킬)과 동일한 출처다.
  · 레벨업 시 “자동으로 오르는” 랜덤 스탯(App.tsx): 전사·도적·로그는 INT 제외,
    마법사는 STR·DEX 제외, 성직자는 DEX·INT 제외. (수동 [스탯투자]는 직업 제한 없음.)
  · 직업 적합 무기·평타 페널티·자동 패링/회피 비율은 [6] 전투 수식과 연동된다.
  · 추가 스킬은 안전지대 NPC 「마스터 진」 비전서 상거래로 구매 — 아래는 직업별 판매 스킬 이름만 요약
    (MP·가격·상세는 인게임 거래 목록·scaleSkillMpCost·scaleCoinCost 기준).

  --- 마법사 (id: wizard) ---
  · 컨셉: 지팡이 + 천, 원거리 마법 딜. HP/방어는 낮고 MP·INT가 높다.
  · 시작: 무기 「초보자용 지팡이」, 갑옷 「허름한 천 옷」, 스킬 「매직 미사일」.
  · Lv1 스탯(합 45): STR4 DEX4 CON4 INT20 SPR13 | HP80 MP100 ATK20 DEF2 | 속성 마법/천.
  · 필수 규칙: 마법 스킬 시전 시 무기 슬롯 이름에 「지팡이」가 포함되어야 함 — 아니면 시전 실패.
  · 마스터 진(예시): 아이스 스피어, 메테오 스트라이크, 블리자드, 마력의 순환 등.

  --- 성직자 (id: cleric) ---
  · 컨셉: 둔기 + 사슬, 힐·버프·신성 딜. 크러시 상성으로 판금 등에 유리한 전개 가능.
  · 시작: 「초보자용 둔기」, 「초보자 사슬 갑옷」, 「회복의 빛」, 「패링」.
  · Lv1: STR8 DEX4 CON14 INT8 SPR11 | HP110 MP80 ATK14 DEF6 | 크러시/사슬.
  · 자동 전투: 패링 스킬 보유 시 자동 패링 구간 확률 10%(전사와 동일 대역).
  · 마스터 진(예시): 신의 방패, 홀리 스마이트, 징벌, 구원의 손길, 정화, 축복, 회복 기도, 천벌, 생명력 전환 등.

  --- 전사 (id: warrior) ---
  · 컨셉: 검/도끼류 + 판금, 근접 딜탱. 분노(RAGE)로 장기전에 강해진다.
  · 시작: 「초보자용 도검」, 「녹슨 판금 갑옷」, 「파워 스트라이크」, 「패링」.
  · Lv1: STR18 DEX8 CON14 INT3 SPR2 | HP130 MP40 ATK18 DEF10 | 슬러시/판금.
  · 분노(0~100): HP가 실제로 깎일 때만 축적(신의 방패로 MP만 깎인 경우 제외)·획득량 보정 있음.
    평타 공격 배율·피격 피해 감소 배율에 반영. 휴식·사망 리스폰 시 0.
  · 인벤: 포션 종류별 최대 보유 — 전사만 타 직업보다 1개 더 담을 수 있음(App.tsx POTION_LIMIT).
  · 양손검(greatsword): 마스터리 Lv10 미만이면 보조손 장비 불가 Lv10 이상이면 방패 동시 착용 가능.
    평타 시 약 30% 확률로 적이 먼저 반격하는 느린 일격 연출.
  · 전용 스킬(다른 직업 사용 불가): 도발, 반격 태세, 철벽, 갑옷 파쇄, 표식 참격, 방패 강타(보조 방패 필요),
    가시 갑옷, 일격필살(분노 소모·쿨다운) 등.
  · 마스터 진(예시): 휠윈드, 돌진, 불굴의 의지, 광폭화 + 위 전용기들.

  --- 도적 (id: thief) ---
  · 컨셉: 단검 + 가죽, 민첩·암살. 쌍단검·연타·은신으로 리듬 플레이.
  · 시작: 「암살 단검」, 「가죽 자켓」, 「사이버 클로」, 무기 마스터리 「단검 Lv1」부터(startMastery).
  · Lv1: STR9 DEX18 CON9 INT5 SPR4 | HP90 MP50 ATK16 DEF4 | 피어싱/가죽.
  · 쌍단검: 직업이 도적이고 주·보조 무기가 모두 dagger일 때 평타 보조손 1히트 추가·보조 무기 평균 데미지 75% 반영.
  · 단검 평타: 확률적으로 1~3연타(코드 비율 40%/30%/30%대).
  · 전용: 「은신」(3턴 적 물리 100% 회피), 「스틸」(은신 중 성공률 높음·성공 시 도주).
  · 패링 스킬 보유 시 자동 패링 확률 40%(도적 특화).
  · 마스터 진(예시): 패링, 섀도우 스텝, 거울 복도, 죽은 척 오스, 은신, 스틸, 독 폭탄, 맹독 단검, 페인 딜러, 지갑선 끊기, 급소 찌르기, 라스트 콜.

  --- 로그 (id: rogue) ---
  · 컨셉: 활 + 가죽, 원거리·정찰·함정. 직감·회피 쪽 판타지.
  · 시작: 「초보자용 활」, 「사냥꾼 가죽 자켓」, 「음파 폭발」, 「패링」.
  · Lv1: STR5 DEX20 CON11 INT5 SPR4 | HP95 MP60 ATK15 DEF5 | 피어싱/가죽.
  · 자동 전투: 패링 자동 구간 없음 → 대신 자동 「회피 시도」 구간이 넓고(민첩+직업 보정),
    성공 시 회피율 가산치도 타 직업보다 큼([6-7] 참고).
  · 전용 명령: 「저격 북/남/동/서」(통로 따라 최대 2칸·고지 방에선 +1칸까지 가장 가까운 적 저격),
    「경계 / Overwatch」(비전투·활/석궁, 3턴 — 적이 방에 들어오는 순간 선제 사격·화려한 로그),
    「정찰 [방향]」(다음 방 정보·함정 설치), 「shoot」또는「사격 [방향] [대상]」수동 사격.
  · 사거리·고저: 일부 방은 Room.elevation≥1(성벽·옥상 등). 고지에서 원거리 사거리 +1칸·고각 사격 보정,
    적의 근접(비마법)은 회피·빗나감에 불리 — 「위치」명령에 힌트.
  · 「위치」 명령 시 조우 위험이 큰 출구 방향에 대한 직감 문구(로그만).
  · 함정: 「와이어 트랩」 등으로 현재 방에 설치 — 다음에 그 방에서 적이 뜰 때 선제 피해·기절.
    로그·도적은 바닥 랜덤 함정을 거의 항상 피하는 연출이 있다.
  · 마스터 진(예시): 스나이프, 헤드샷, 철수, 난사, 애기살, 폭발/화염/얼음 화살, 와이어 트랩, 도주 사격, 멀티샷, 에로우 샤워.

[4. 경제 · 가격 배율 (중앙 정의)]
  · 월드 비용 배율: ${mult} (data/economyBalance.ts — ECONOMY_COST_WORLD_MULT).
  · COIN 지출 base>0: scaleCoinCost(base) = max(1, round(base × ${mult})).
  · 스킬 MP 기본값 N>0: scaleSkillMpCost(N) = max(1, round(N × ${mult})); N≤0 은 그대로.
  · 장비 강화 1회 비용(인게임): scaleCoinCost(200 × (현재 플러스 + 1)) — 재료 규칙은 별도.
  · 판매(상인 조건 충족 시): 아이템 정의에 price 있으면
      max(1, round(price × 0.3 × ${mult}))
    없으면 루팅 전용 고정 판매가 테이블 값에 scaleCoinCost 적용(코드: LOOT_SELL_VALUES 등).

[5. 인벤토리 · 장비 강화 보너스]
  · 인벤 슬롯 상한: ${INVENTORY_MAX_SLOTS} (utils/inventoryHelpers.ts).
  · 강화로 오르는 “무기/방어 스탯 보너스”에 쓰이는 함수(items.ts):
      getEnchantStatBonusFromTierPlus(tier, plus) = plus×4 + tierIndex×2
    tierIndex는 common=0 … legendary=5. 의도: **플러스가 티어보다 크게 기여** — 예) 레어+5의 강화분이 에픽+1보다 높을 수 있음(모든 등급 쌍에 동일 원리).

[5-A. 룬(각인) 시스템 — NEURAL RUNE MATRIX]
  · 목적: 직업과 별개로 패시브 1종 + 전용 스킬 1개를 “한 줄”에 장착·동기화한다.
  · 장착 조건: Lv.${RUNE_EQUIP_MIN_LEVEL} 이상 — 미만이면 [룬 장착]/[equip_rune]은 거부되고, 세이브에 룬만 남아 있어도 불러올 때 자동 해제(runes.ts RUNE_EQUIP_MIN_LEVEL). [룬 해제]는 레벨과 무관.
  · 데이터 단일 출처: frontend/src/data/runes.ts — RUNE_DATA(한글 노출명·id·aliases·skillKo·passiveShort).
  · 장착/해제 로직: frontend/src/game/Player.ts — Player.equipRune(보유 스킬 배열, 이전 룬 id, 쿼리 문자열).
    - 장착 시 RUNE_DATA에 정의된 룬 전용 스킬명 전부를 스킬 목록에서 제거한 뒤, 새 룬의 skillKo만 추가.
  · 저장 필드: equippedRuneId (string | null) — frontend/src/utils/saveSystem.ts SavedCharacter.
  · 인게임 명령(로그창 동일 출력):
      [룬] 또는 [룬 목록] — 14종 목록·도움말
      [룬 장착 ○○○] — 한글 별칭 또는 영문 id(예: berserker, 광전사)
      [equip_rune berserker] — 공백 뒤에 id/별칭
      [룬 해제] — 패시브·룬 스킬 제거(구 스킬은 목록에서만 정리)
  · 스킬 바: frontend/src/components/SkillBar.tsx — 룬 스킬별 MP 소모·아이콘 정의(실제 MP는 economyBalance 배율 적용).
  · 전투·성장 연동(요약, 세부는 App.tsx 분기):
      - 패시브 예: 저HP ATK(광전사), 속성 저항(성기사), 치명(암살), 교전 MP재생(현자), 원거리 사거리+1(추적자),
        처치 흡혈(강령술사), 근접 딜 보정(검투사), maxHP·DEF(수호자), 회피(바람술사), 포션 배율(연금술사),
        전리·COIN 보너스(도박사), 사망 시 EXP 손실 면제(영혼결속자), 마법 치명 배율(파괴법사),
        방패 착용 시 반사(철벽전도사), 은신 지연 등(그림자술사), 철의 요새·미라지·표식 등 버프는 전용 스킬과 연계.
  · 룬 14종(아래는 runes.ts와 자동 동기화된 목록):
${runeLines}

[6. 전투 — 루프 개요]
  · 사거리(Range): shoot/저격은 현재 방이 아닌 통로 직선 상 인접 방의 적을 노린다. 지면 기본 2칸,
    elevation≥1인 방에 서 있으면 +1칸(총 3칸). 거리에 따라 피해 감쇠.
  · 고저: 플레이어 방 elevation≥1이면 적 근접(weaponAttr≠마법) 회피율 +14%p·명중률 약 83% 배.
  · Overwatch(경계): 비전투에서 활/석궁으로 3턴 — 추적 적이 이 방으로 진입할 때 선제 사격(로그 박스 연출).
  · 턴: 플레이어 명령 후 생존 적마다 순차 적 턴(타이머 예약).
  · CC(기절·빙결·수면 등): 해당 턴 행동 스킵. 상태는 activeEnemiesRef 최신값 기준(스냅샷만 쓰면 버그).
  · 기절 등으로 행동이 끊기면 강공격 intent 제거(data/enemies.ts — clearEnemyHeavyIntent).
  · 아래 [6-1]~[6-10]은 App.tsx·combatFormulas.ts·attributes.ts·battlePosture.ts와 동일한 취지의 수식 요약.

[6-1. 유효 스탯(eff*)·최대 HP/MP]
  · effStr~effSpr = 기본 스탯 + 장비 bonusStr~bonusSpr(파손 슬롯 제외) + 고대 비석 일시 버프.
  · 최대 HP = max(1, 직업 baseHp + 10×(effCon − 직업 baseCon)) + 패시브 vitality +15(보유 시)
    + 생명의 비석 flat(obeliskMaxHp, 턴 유지 시).
  · 최대 MP = max(1, 직업 baseMp + 10×(effSpr − 직업 baseSpr) + 5×(effInt − 직업 baseInt))
    + 패시브 mana_flow +10(보유 시).

[6-2. 표시 공격력 effAtk·방어력 effDef·치명·명중]
  · 무기 평균 공격력 weaponAtk = round((minDamage+maxDamage)/2). 쌍단검(주·보조 모두 dagger)이면
    보조손 평균의 75%를 weaponAtk에 가산.
  · baseAtk = player.atk + floor(effStr×0.3) + floor(effDex×0.2) + weaponAtk.
  · 무기 마스터리(해당 weaponClass 있을 때): effAtk = round(baseAtk × (1 + (max(1,Lv)−1)×0.025))
    후 비석 ATK flat 가산. Lv1 = 1.00배, 레벨당 +2.5%.
  · 태세 반영 전 마지막에 effAtk·effDef에 [6-4] 배율 적용(반올림, 최소 1/0 클램프).
  · effDef = player.def + 갑옷(defense+bonusDefense) + 방패(보조손이 shield일 때 동일) + floor(effCon×0.5)
    + 비석 DEF flat. (유효 방어력 표시에는 강화 플러스 방어력이 합산되지 않음 — 적이 때릴 때만 플러스 반영.)
  · effCritChance = min(0.5, 0.10 + 장비 bonusCritChance 합). effAccuracy = 장비 bonusAccuracy 합(0~1 비율).

[6-3. 무기 속성(WeaponAttribute)·직업별 무기 페널티]
  · 속성 결정(App.tsx getPlayerWeaponAttr): 마법사 또는 무기명에 ‘지팡이’ → 마법.
    단검·활·창·미늘창 → 피어싱; 검·도끼·채찍 → 슬러시; 둔기·해머·철퇴·메이스 → 크러시; 그 외는 직업 baseWeaponAttr.
  · 직업-무기 불일치 시 getWeaponPenalty = 0.5, 적합 무기 1.0
    (마법사 지팡이 / 성직자 둔기계열 / 전사 검·도검·장검·양손검·도끼·채찍 / 도적 단검 / 로그 활·석궁).

[6-4. 전투 태세(battlePosture — data/battlePosture.ts)]
  · 공격/공방/방어에 따른 배율:
    - ATK: 1.15 / 1 / 0.85
    - DEF: 0.85 / 1 / 1.15
  · 갑옷 자동 가드 확률: 기본 getArmorGuardChance에 태세 배율(공격 0.75 / 공방 1 / 방어 1.25) 곱한 뒤 상한 95%.

[6-5. 플레이어 평타([공격]) — 명중·무기 롤·피해]
  · 명중률 = min(0.95, 0.8 + effAtk/500 + effAccuracy). 난수 미스 시 빗나감 후 적 턴.
  · 무기 min/max는 속성별 스탯 가산 후 강화 보너스 getEnchantStatBonusFromTierPlus를 min·max 동일 가산:
    - 피어싱: min += floor(STR×0.25)+floor(DEX×0.25), max += floor(DEX×0.65)
    - 마법: min += floor(SPR×0.5), max += floor(INT×0.8)
    - 슬러시·크러시: min += floor(DEX×0.3), max += floor(STR×0.6)
  · 관통(방어 계수): penetrationStat = (피어싱이면 (effDex || effStr), 아니면 effStr),
    defFactor = (100 + penetrationStat) / (100 + effectiveEnemyDefForPhysical(적)).
    effectiveEnemyDef = max(1, 적.def − (갑옷 파쇄 시 sunderDefFlat)).
  · 한 타당: rolledWeaponDmg ∈ [finalMin, finalMax] 균등 정수,
    critChance = min(0.6, effCritChance + 무기옵션 critBonus), 크리 시 배율 3.0,
    randMult ∈ [0.9, 1.1] 균등,
    basePart = effAtk × randMult × critMult + rolledWeaponDmg,
    normalScale = (무기 속성이 피어싱이면 0.78×0.4 아니면 0.78),
    단일타 피해 = max(1, round(basePart × defFactor × attrModifier × wpPenalty × normalScale × 분노공격배율 × 옵션 damageMult)).
    쌍단검 마지막 타(보조손)는 위 결과에 0.75 추가 곱. 원소: 착용 무기·반지·목걸이 elementDamage 합을 총합에 가산.
  · 전사 분노 공격: 분노>0일 때 1 + min(0.3, 분노×0.003). 전사 표식은 물리 피해에만 ×1.35(첫 소모 1회).

[6-6. 적이 플레이어에게 평타(triggerEnemyTurn)]
  · 회피 확률(빙결 시 불가): baseDodge = getArmorDodgeChance(플레이어 갑옷 속성)
    + effDex×0.008 + (적 갑옷이 판금이면 +0.18) + dodgeChance(태세·자동회피 등 옵션 합).
    dodgeChance>0이면 합에 포함, 상한 min(0.90, …).
  · 적 명중: hitChance = min(0.95, 0.75 + 적.atk/500). 플레이어 빙결 시 hitChance = max(원값, 0.98).
  · 플레이어 총 방어(피격 시): def + 갑옷(defense+bonusDefense) + 갑옷 강화방어(getEnchantStatBonusFromTierPlus)
    + 방패 동일 + floor(effCon×0.5).
  · baseDmg = (적.atk + atk버프)×0.8 + 적.weaponDmg, defFactor = (100 + 적.str) / (100 + totalPlayerDef),
    rand ∈ [0.9,1.1], 적 크리 10% 시 ×1.5, attrModifier = getDamageModifier(적 무기 속성, 플레이어 갑옷 속성).
  · rawDmg = baseDmg × defFactor × rand × crit배율 × attrModifier × heavyMult(강공격) × (2페이즈 보스면 ×1.2)
    × 분노피감배율(전사: 1 − min(0.35, 분노×0.0035)) × (도발이면 ×0.72)
    × 방어태세: 기본방어 0.48 / 방어 0.3 / 반격태세 0.38 / 기본패링 0.56 / 패링 0.5.
  · finalDmg = max(1, round(rawDmg)).

[6-7. 적 턴 전 자동 방어·패링·회피(플레이어가 이번 턴 방어/회피/패링/반격 태세를 쓰지 않았을 때만)]
  · 패링 스킬 보유 시: 도적 autoParry 40%, 전사·성직자 10%(로그는 패링 구간 없음).
  · 자동 가드 확률 = applyPostureToGuardChance(getArmorGuardChance(갑옷), 태세).
  · 자동 회피 시도 구간 확률 = min(0.55, min(0.3, effDex×0.01) + (로그면 +0.38)). 성공 시 이후 회피 식에
    dodgeChance += (로그 0.22, 그 외 0.15).

[6-8. 상성 배율(data/attributes.ts — getDamageModifier)]
  · 마법 → 임의 갑옷에 대해 1.3.
  · 피어싱: 천·가죽 1.1, 사슬 1.0, 판금 0.8.
  · 슬러시: 천 1.1, 가죽·사슬·판금 1.0.
  · 크러시: 천 1.2, 가죽 0.8, 사슬 1.0, 판금 1.5.

[6-9. 갑옷별 기본 회피·자동 가드(표시용·[6-6] baseDodge / [6-7] 가드 기반)]
  · 회피 기본: 천 5%, 가죽 12%, 사슬 2%, 판금 0%.
  · 가드 기본: 천 15%, 가죽 8%, 사슬 22%, 판금 35%.

[6-10. 스킬·기타 물리/마법 피해]
  · 스킬마다 basePart·defFactor(관통/무시)·배율이 분기마다 다름(스나이프·맹독 단검은 defFactor=1 고정 등).
  · 정확한 식은 frontend/src/App.tsx 해당 스킬 분기 및 frontend/src/utils/combatFormulas.ts를 우선한다.

[7. 엘리트(준보스) 리듬 QTE]
  · 전투 개시 시 준보스에 한해 확률적으로 발동. 안내 로그 후 짧은 지연 뒤 WASD 순서 입력 UI.
  · 성공: 기절 턴 부가 등 / 실패: 최대 HP 비율 피해 등(구체 수치는 App.tsx·CombatQteOverlay).

[8. 맵 · 거점 · 거래 구조(요약)]
  · 방 단위 이동·조우·상점·NPC 대화·퀘스트. 안전지대·성벽·마을 함락/수복 등 거점 이벤트 존재.
  · 상인별로 판매 가능 여부가 갈림(예: 아이언 잭 vs 마스터 진). 미확인 장비·감정·도박 상인 등
    별도 규칙은 [도움말] 참고.

[9. UI · 접근성]
  · 명령 입력 + Tab 자동완성 + 스킬 바 + 미니맵 토글. 세이브는 캐릭터 단위(로그인 플로우).

[10. 소스 코드 맵 (참고용)]
  · 직업 정의·시작 스탯·시작 장비·스킬·단검 초기 마스터리: frontend/src/data/jobClasses.ts (JOB_LIST).
  · 전투 루프·적 턴·플레이어 공격·스킬 분기: frontend/src/App.tsx (대형 단일 모듈).
  · 적 개체 필드·강공격 intent·기절 등: frontend/src/data/enemies.ts (ActiveEnemy, clearEnemyHeavyIntent).
  · 경제 배율: frontend/src/data/economyBalance.ts.
  · 레벨·경험치 곡선: frontend/src/data/playerProgress.ts.
  · 강화 보너스·등급 사다리: frontend/src/data/items.ts.
  · 물리 방어 보정·갑옷파쇄·표식 배율: frontend/src/utils/combatFormulas.ts.
  · 무기·갑옷 속성 상성·기본 회피/가드: frontend/src/data/attributes.ts.
  · 전투 태세(ATK/DEF/가드 배율): frontend/src/data/battlePosture.ts.
  · 스토리 원문 상수: frontend/src/data/story.ts.
  · 룬 정의·저항 보조: frontend/src/data/runes.ts (applyPaladinRuneResist 등).

----------------------------------------------------------------
  본 문서는 소개·검토용 요약이다. 밸런스 패치 시 코드를 먼저 확인할 것.
----------------------------------------------------------------
`.trimStart();
}
