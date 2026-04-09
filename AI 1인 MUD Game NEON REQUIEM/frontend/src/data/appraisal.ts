/**
 * 미확인 장비 감정 시 롤되는 부가 옵션 (디아블로식 다양한 한 줄 효과).
 * WHY: 수치는 ItemOptionMods로만 전투에 반영하고, labelKo는 플레이어가 읽는 맛(변동·치명 등)을 살린다.
 */
import type { ElementType } from './elemental';
import type { ItemData, ItemOptionMods } from './items';
// WHY: type-only import — 런타임 순환 참조(items ↔ appraisal) 방지

export type RolledAffixLine = { labelKo: string; mods: ItemOptionMods };

type EquipKind = 'weapon' | 'armor' | 'shield' | 'accessory';

type AppraisalKindDef = {
  id: string;
  weight: number;
  types: EquipKind[];
  /** 신속/파멸 계열: 이름 대신 태그로 전투 보정을 넘긴다 */
  tag?: 'swift' | 'destructive';
  roll: (rng: () => number) => RolledAffixLine;
};

function mergeResAll(valueEach: number): Partial<Record<ElementType, number>> {
  const v = Math.round(valueEach * 1000) / 1000;
  return { 불: v, 얼음: v, 전기: v, 독: v };
}

/** 타입별 출현 가능한 감정 옵션 풀 */
const APPRAISAL_KINDS: AppraisalKindDef[] = [
  {
    id: 'str_flat',
    weight: 11,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const v = 1 + Math.floor(rng() * 5);
      return { labelKo: `힘 +${v}`, mods: { bonusStr: v } };
    },
  },
  {
    id: 'dex_flat',
    weight: 11,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const v = 1 + Math.floor(rng() * 5);
      return { labelKo: `민첩 +${v}`, mods: { bonusDex: v } };
    },
  },
  {
    id: 'con_flat',
    weight: 10,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const v = 1 + Math.floor(rng() * 5);
      return { labelKo: `체력(CON) +${v}`, mods: { bonusCon: v } };
    },
  },
  {
    id: 'int_flat',
    weight: 9,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const v = 1 + Math.floor(rng() * 5);
      return { labelKo: `지능 +${v}`, mods: { bonusInt: v } };
    },
  },
  {
    id: 'spr_flat',
    weight: 9,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const v = 1 + Math.floor(rng() * 5);
      return { labelKo: `정신 +${v}`, mods: { bonusSpr: v } };
    },
  },
  {
    id: 'def_percent_style',
    weight: 10,
    types: ['armor', 'shield'],
    roll: (rng) => {
      const pct = 8 + Math.floor(rng() * 13);
      const flat = 1 + Math.floor(rng() * 4);
      return {
        labelKo: `방어력 +${pct}% (변동) — 실효 +${flat}`,
        mods: { bonusDefense: flat },
      };
    },
  },
  {
    id: 'crit_percent',
    weight: 8,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const p = 3 + Math.floor(rng() * 5);
      return {
        labelKo: `치명타 확률 +${p}%p`,
        mods: { bonusCritChance: p / 100 },
      };
    },
  },
  {
    id: 'accuracy_percent',
    weight: 8,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const p = 4 + Math.floor(rng() * 6);
      return {
        labelKo: `명중률 +${p}%p`,
        mods: { bonusAccuracy: p / 100 },
      };
    },
  },
  {
    id: 'life_steal',
    weight: 5,
    types: ['weapon'],
    roll: (rng) => {
      const p = 4 + Math.floor(rng() * 7);
      return {
        labelKo: `생명력 흡수 +${p}%`,
        mods: { lifeStealPercent: p / 100 },
      };
    },
  },
  {
    id: 'poison_chance',
    weight: 5,
    types: ['weapon'],
    roll: (rng) => {
      const p = 8 + Math.floor(rng() * 15);
      return {
        labelKo: `맹독 부여 확률 +${p}%`,
        mods: { poisonChance: p / 100 },
      };
    },
  },
  {
    id: 'elem_damage_fire',
    weight: 7,
    types: ['weapon', 'accessory'],
    roll: (rng) => {
      const lo = 2 + Math.floor(rng() * 4);
      const hi = lo + 3 + Math.floor(rng() * 6);
      const mid = Math.round((lo + hi) / 2);
      return {
        labelKo: `화염 피해 ${lo}–${hi} 추가 (평균 ${mid})`,
        mods: { elementDamage: { 불: mid } },
      };
    },
  },
  {
    id: 'elem_damage_ice',
    weight: 7,
    types: ['weapon', 'accessory'],
    roll: (rng) => {
      const lo = 2 + Math.floor(rng() * 4);
      const hi = lo + 2 + Math.floor(rng() * 5);
      const mid = Math.round((lo + hi) / 2);
      return {
        labelKo: `냉기 피해 ${lo}–${hi} 추가 (평균 ${mid})`,
        mods: { elementDamage: { 얼음: mid } },
      };
    },
  },
  {
    id: 'elem_damage_volt',
    weight: 7,
    types: ['weapon', 'accessory'],
    roll: (rng) => {
      const lo = 2 + Math.floor(rng() * 4);
      const hi = lo + 3 + Math.floor(rng() * 6);
      const mid = Math.round((lo + hi) / 2);
      return {
        labelKo: `전격 피해 ${lo}–${hi} 추가 (평균 ${mid})`,
        mods: { elementDamage: { 전기: mid } },
      };
    },
  },
  {
    id: 'elem_damage_poison',
    weight: 6,
    types: ['weapon', 'accessory'],
    roll: (rng) => {
      const lo = 2 + Math.floor(rng() * 4);
      const hi = lo + 3 + Math.floor(rng() * 5);
      const mid = Math.round((lo + hi) / 2);
      return {
        labelKo: `독 피해 ${lo}–${hi} 추가 (평균 ${mid})`,
        mods: { elementDamage: { 독: mid } },
      };
    },
  },
  {
    id: 'res_single_fire',
    weight: 8,
    types: ['armor', 'shield', 'accessory'],
    roll: (rng) => {
      const p = 6 + Math.floor(rng() * 10);
      return { labelKo: `화염 저항 +${p}%`, mods: { elementResist: { 불: p / 100 } } };
    },
  },
  {
    id: 'res_single_cold',
    weight: 8,
    types: ['armor', 'shield', 'accessory'],
    roll: (rng) => {
      const p = 6 + Math.floor(rng() * 10);
      return { labelKo: `냉기 저항 +${p}%`, mods: { elementResist: { 얼음: p / 100 } } };
    },
  },
  {
    id: 'res_single_volt',
    weight: 8,
    types: ['armor', 'shield', 'accessory'],
    roll: (rng) => {
      const p = 6 + Math.floor(rng() * 10);
      return { labelKo: `전격 저항 +${p}%`, mods: { elementResist: { 전기: p / 100 } } };
    },
  },
  {
    id: 'res_single_poison',
    weight: 8,
    types: ['armor', 'shield', 'accessory'],
    roll: (rng) => {
      const p = 6 + Math.floor(rng() * 10);
      return { labelKo: `독 저항 +${p}%`, mods: { elementResist: { 독: p / 100 } } };
    },
  },
  {
    id: 'res_all',
    weight: 5,
    types: ['armor', 'shield', 'accessory'],
    roll: (rng) => {
      const lo = 3 + Math.floor(rng() * 4);
      const hi = lo + 2 + Math.floor(rng() * 4);
      const v = lo + Math.floor(rng() * (hi - lo + 1));
      return {
        labelKo: `모든 저항 +${lo}~${hi}% (변동·${v})`,
        mods: { elementResist: mergeResAll(v / 100) },
      };
    },
  },
  {
    id: 'mana_shield_grant',
    weight: 3,
    types: ['accessory'],
    roll: () => ({
      labelKo: '마나의 막 — [마나 실드] 착용 시 사용 (비전서 불요)',
      mods: { grantsManaShield: true },
    }),
  },
  {
    id: 'swift_tag',
    weight: 6,
    types: ['weapon'],
    tag: 'swift',
    roll: (rng) => {
      const dex = 2 + Math.floor(rng() * 3);
      return {
        labelKo: `공격 속도 +${10 + Math.floor(rng() * 16)}% (민첩 +${dex})`,
        mods: { bonusDex: dex },
      };
    },
  },
  {
    id: 'destructive_tag',
    weight: 6,
    types: ['weapon'],
    tag: 'destructive',
    roll: (rng) => {
      const c = 4 + Math.floor(rng() * 5);
      return {
        labelKo: `파멸적 일격 (치명 +${c}%p)`,
        mods: { bonusCritChance: c / 100 },
      };
    },
  },
  {
    id: 'def_flat_small',
    weight: 9,
    types: ['armor', 'shield'],
    roll: (rng) => {
      const v = 1 + Math.floor(rng() * 4);
      return { labelKo: `방어력 +${v}`, mods: { bonusDefense: v } };
    },
  },

  // ── 복합 옵션 (한 줄에 여러 수치) — 무기/갑옷/방패 전부 조합 출현. WHY: 빌드 다양성·롤링 맛 강화
  {
    id: 'combo_str_dex',
    weight: 7,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const a = 1 + Math.floor(rng() * 3);
      const b = 1 + Math.floor(rng() * 3);
      return { labelKo: `힘 +${a}, 민첩 +${b}`, mods: { bonusStr: a, bonusDex: b } };
    },
  },
  {
    id: 'combo_str_con',
    weight: 7,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const a = 1 + Math.floor(rng() * 4);
      const b = 1 + Math.floor(rng() * 3);
      return { labelKo: `힘 +${a}, 체력(CON) +${b}`, mods: { bonusStr: a, bonusCon: b } };
    },
  },
  {
    id: 'combo_dex_con',
    weight: 7,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const a = 1 + Math.floor(rng() * 4);
      const b = 1 + Math.floor(rng() * 3);
      return { labelKo: `민첩 +${a}, 체력(CON) +${b}`, mods: { bonusDex: a, bonusCon: b } };
    },
  },
  {
    id: 'combo_int_spr',
    weight: 7,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const a = 1 + Math.floor(rng() * 3);
      const b = 1 + Math.floor(rng() * 3);
      return { labelKo: `지능 +${a}, 정신 +${b}`, mods: { bonusInt: a, bonusSpr: b } };
    },
  },
  {
    id: 'combo_str_crit_weapon',
    weight: 6,
    types: ['weapon'],
    roll: (rng) => {
      const s = 1 + Math.floor(rng() * 4);
      const c = 2 + Math.floor(rng() * 4);
      return { labelKo: `힘 +${s}, 치명 +${c}%p`, mods: { bonusStr: s, bonusCritChance: c / 100 } };
    },
  },
  {
    id: 'combo_dex_acc_weapon',
    weight: 6,
    types: ['weapon'],
    roll: (rng) => {
      const d = 1 + Math.floor(rng() * 4);
      const a = 3 + Math.floor(rng() * 6);
      return { labelKo: `민첩 +${d}, 명중 +${a}%p`, mods: { bonusDex: d, bonusAccuracy: a / 100 } };
    },
  },
  {
    id: 'combo_int_elem_fire',
    weight: 5,
    types: ['weapon', 'accessory'],
    roll: (rng) => {
      const i = 1 + Math.floor(rng() * 3);
      const e = 2 + Math.floor(rng() * 5);
      return { labelKo: `지능 +${i}, 화염 추가 피해 +${e}`, mods: { bonusInt: i, elementDamage: { 불: e } } };
    },
  },
  {
    id: 'combo_spr_elem_ice',
    weight: 5,
    types: ['weapon', 'accessory'],
    roll: (rng) => {
      const sp = 1 + Math.floor(rng() * 3);
      const e = 2 + Math.floor(rng() * 4);
      return { labelKo: `정신 +${sp}, 냉기 추가 피해 +${e}`, mods: { bonusSpr: sp, elementDamage: { 얼음: e } } };
    },
  },
  {
    id: 'combo_ls_poison',
    weight: 5,
    types: ['weapon'],
    roll: (rng) => {
      const ls = 3 + Math.floor(rng() * 5);
      const pq = 5 + Math.floor(rng() * 10);
      return {
        labelKo: `흡혈 +${ls}%, 맹독 확률 +${pq}%`,
        mods: { lifeStealPercent: ls / 100, poisonChance: pq / 100 },
      };
    },
  },
  {
    id: 'combo_crit_acc_weapon',
    weight: 6,
    types: ['weapon'],
    roll: (rng) => {
      const c = 2 + Math.floor(rng() * 4);
      const a = 3 + Math.floor(rng() * 5);
      return { labelKo: `치명 +${c}%p, 명중 +${a}%p`, mods: { bonusCritChance: c / 100, bonusAccuracy: a / 100 } };
    },
  },
  {
    id: 'combo_dual_elem_volt_poison',
    weight: 4,
    types: ['weapon', 'accessory'],
    roll: (rng) => {
      const v = 2 + Math.floor(rng() * 4);
      const p = 2 + Math.floor(rng() * 4);
      return {
        labelKo: `전격+${v} · 독+${p} 이중 속성 부여`,
        mods: { elementDamage: { 전기: v, 독: p } },
      };
    },
  },
  {
    id: 'combo_tri_elem_low',
    weight: 3,
    types: ['weapon', 'accessory'],
    roll: (rng) => {
      const x = 1 + Math.floor(rng() * 3);
      return {
        labelKo: `삼원소 각 +${x} (화·얼·번)`,
        mods: { elementDamage: { 불: x, 얼음: x, 전기: x } },
      };
    },
  },
  {
    id: 'combo_con_def_armor',
    weight: 8,
    types: ['armor', 'shield'],
    roll: (rng) => {
      const c = 1 + Math.floor(rng() * 4);
      const d = 1 + Math.floor(rng() * 5);
      return { labelKo: `체력(CON) +${c}, 방어력 +${d}`, mods: { bonusCon: c, bonusDefense: d } };
    },
  },
  {
    id: 'combo_str_def_armor',
    weight: 7,
    types: ['armor', 'shield'],
    roll: (rng) => {
      const s = 1 + Math.floor(rng() * 3);
      const d = 2 + Math.floor(rng() * 4);
      return { labelKo: `힘 +${s}, 방어력 +${d}`, mods: { bonusStr: s, bonusDefense: d } };
    },
  },
  {
    id: 'combo_spr_res_fire_armor',
    weight: 7,
    types: ['armor', 'shield'],
    roll: (rng) => {
      const sp = 1 + Math.floor(rng() * 3);
      const p = 5 + Math.floor(rng() * 8);
      return { labelKo: `정신 +${sp}, 화염 저항 +${p}%`, mods: { bonusSpr: sp, elementResist: { 불: p / 100 } } };
    },
  },
  {
    id: 'combo_dex_res_ice_armor',
    weight: 7,
    types: ['armor', 'shield'],
    roll: (rng) => {
      const d = 1 + Math.floor(rng() * 4);
      const p = 5 + Math.floor(rng() * 8);
      return { labelKo: `민첩 +${d}, 냉기 저항 +${p}%`, mods: { bonusDex: d, elementResist: { 얼음: p / 100 } } };
    },
  },
  {
    id: 'combo_def_res_dual',
    weight: 6,
    types: ['armor', 'shield'],
    roll: (rng) => {
      const d = 1 + Math.floor(rng() * 4);
      const a = 4 + Math.floor(rng() * 6);
      const b = 4 + Math.floor(rng() * 6);
      return {
        labelKo: `방어력 +${d}, 화염·전격 저항 +${a}% / +${b}%`,
        mods: { bonusDefense: d, elementResist: { 불: a / 100, 전기: b / 100 } },
      };
    },
  },
  {
    id: 'combo_def_percent_res',
    weight: 6,
    types: ['armor', 'shield'],
    roll: (rng) => {
      const pct = 6 + Math.floor(rng() * 10);
      const flat = 1 + Math.floor(rng() * 3);
      const r = 3 + Math.floor(rng() * 5);
      return {
        labelKo: `방어 +${pct}% (실효 +${flat}), 독 저항 +${r}%`,
        mods: { bonusDefense: flat, elementResist: { 독: r / 100 } },
      };
    },
  },
  {
    id: 'combo_crit_def_armor',
    weight: 5,
    types: ['armor', 'shield'],
    roll: (rng) => {
      const c = 2 + Math.floor(rng() * 4);
      const d = 1 + Math.floor(rng() * 4);
      return { labelKo: `치명 +${c}%p, 방어력 +${d}`, mods: { bonusCritChance: c / 100, bonusDefense: d } };
    },
  },
  {
    id: 'combo_acc_str_shield',
    weight: 5,
    types: ['shield'],
    roll: (rng) => {
      const a = 3 + Math.floor(rng() * 5);
      const s = 1 + Math.floor(rng() * 3);
      return { labelKo: `명중 +${a}%p, 힘 +${s}`, mods: { bonusAccuracy: a / 100, bonusStr: s } };
    },
  },
  {
    id: 'combo_spr_allres_shield',
    weight: 5,
    types: ['shield'],
    roll: (rng) => {
      const sp = 1 + Math.floor(rng() * 3);
      const v = 2 + Math.floor(rng() * 3);
      return {
        labelKo: `정신 +${sp}, 전속성 저항 +${v}%`,
        mods: { bonusSpr: sp, elementResist: mergeResAll(v / 100) },
      };
    },
  },
  {
    id: 'combo_str_acc_weapon',
    weight: 5,
    types: ['weapon'],
    roll: (rng) => {
      const s = 1 + Math.floor(rng() * 4);
      const a = 3 + Math.floor(rng() * 5);
      return { labelKo: `힘 +${s}, 명중 +${a}%p`, mods: { bonusStr: s, bonusAccuracy: a / 100 } };
    },
  },
  {
    id: 'combo_int_def_armor',
    weight: 6,
    types: ['armor', 'shield'],
    roll: (rng) => {
      const i = 1 + Math.floor(rng() * 3);
      const d = 1 + Math.floor(rng() * 4);
      return { labelKo: `지능 +${i}, 방어력 +${d}`, mods: { bonusInt: i, bonusDefense: d } };
    },
  },
  {
    id: 'combo_dex_spr',
    weight: 6,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const d = 1 + Math.floor(rng() * 3);
      const sp = 1 + Math.floor(rng() * 3);
      return { labelKo: `민첩 +${d}, 정신 +${sp}`, mods: { bonusDex: d, bonusSpr: sp } };
    },
  },
  {
    id: 'combo_elem_crit_weapon',
    weight: 4,
    types: ['weapon'],
    roll: (rng) => {
      const e = 2 + Math.floor(rng() * 4);
      const c = 2 + Math.floor(rng() * 3);
      return {
        labelKo: `독 추가 피해 +${e}, 치명 +${c}%p`,
        mods: { elementDamage: { 독: e }, bonusCritChance: c / 100 },
      };
    },
  },
];

/**
 * 베일 크립트 블라인드 → 감정 전용 옵션 풀.
 * WHY: 아이언 잭 직매품은 감정 옵션이 아예 없고, 일반 드랍 감정과 문구·조합을 달리해 “도박 상인만의 각인” 체감을 준다.
 */
const VEIL_EXCLUSIVE_KINDS: AppraisalKindDef[] = [
  {
    id: 'veil_all_one',
    weight: 9,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: () => ({
      labelKo: `베일의 잔향 — 힘·민·체·지·정 +1 (잭 목록 각인과는 다른 조합)`,
      mods: { bonusStr: 1, bonusDex: 1, bonusCon: 1, bonusInt: 1, bonusSpr: 1 },
    }),
  },
  {
    id: 'veil_glitch_hit',
    weight: 8,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const a = 5 + Math.floor(rng() * 5);
      const c = 2 + Math.floor(rng() * 3);
      return {
        labelKo: `홀로 글리치: 명중 +${a}%p, 치명 +${c}%p`,
        mods: { bonusAccuracy: a / 100, bonusCritChance: c / 100 },
      };
    },
  },
  {
    id: 'veil_noise_fire',
    weight: 7,
    types: ['weapon'],
    roll: (rng) => {
      const v = 2 + Math.floor(rng() * 4);
      return { labelKo: `노이즈 화상 — 불 추가 피해 +${v} (상점각인 아님)`, mods: { elementDamage: { 불: v } } };
    },
  },
  {
    id: 'veil_noise_ice',
    weight: 7,
    types: ['weapon'],
    roll: (rng) => {
      const v = 2 + Math.floor(rng() * 4);
      return { labelKo: `노이즈 서리 — 얼음 추가 피해 +${v}`, mods: { elementDamage: { 얼음: v } } };
    },
  },
  {
    id: 'veil_mini_vamp',
    weight: 6,
    types: ['weapon'],
    roll: (rng) => {
      const p = 5 + Math.floor(rng() * 4);
      return {
        labelKo: `가짜 흡혈 칩 — 생명력 흡수 +${p}% (잭이 파는 흡혈 접미와는 별계)`,
        mods: { lifeStealPercent: p / 100 },
      };
    },
  },
  {
    id: 'veil_paper_def',
    weight: 8,
    types: ['armor', 'shield'],
    roll: (rng) => {
      const d = 1 + Math.floor(rng() * 3);
      return {
        labelKo: `종이 방어 코팅 — 방어력 +${d} (체력탱용 잭템과 옵션 테이블 분리)`,
        mods: { bonusDefense: d },
      };
    },
  },
  {
    id: 'veil_ohm_res',
    weight: 7,
    types: ['armor', 'shield', 'accessory'],
    roll: (rng) => {
      const v = 4 + Math.floor(rng() * 4);
      return {
        labelKo: `오류난 옴니저항 — 전속성 저항 +${v}%`,
        mods: { elementResist: mergeResAll(v / 100) },
      };
    },
  },
  {
    id: 'veil_luck_ring',
    weight: 8,
    types: ['accessory'],
    roll: (rng) => {
      const c = 4 + Math.floor(rng() * 5);
      const a = 3 + Math.floor(rng() * 4);
      return {
        labelKo: `도박장 각인: 치명 +${c}%p, 명중 +${a}%p`,
        mods: { bonusCritChance: c / 100, bonusAccuracy: a / 100 },
      };
    },
  },
  {
    id: 'veil_stray_poison',
    weight: 6,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const p = 8 + Math.floor(rng() * 10);
      return {
        labelKo: `베일 누출: 중독 확률 +${p}%p`,
        mods: { poisonChance: p / 100 },
      };
    },
  },
  {
    id: 'veil_dex_spr_chip',
    weight: 8,
    types: ['weapon', 'armor', 'shield', 'accessory'],
    roll: (rng) => {
      const d = 2 + Math.floor(rng() * 3);
      const s = 2 + Math.floor(rng() * 3);
      return {
        labelKo: `납땜된 칩 — 민첩 +${d}, 정신 +${s}`,
        mods: { bonusDex: d, bonusSpr: s },
      };
    },
  },
];

function pickWeightedIndex(weights: number[], rng: () => number): number {
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = rng() * sum;
  for (let i = 0; i < weights.length; i++) {
    t -= weights[i];
    if (t <= 0) return i;
  }
  return weights.length - 1;
}

/**
 * 장비 정의에 맞춰 3~5개의 부가 옵션을 롤한다 (타입별 풀에서 중복 제외).
 * @param opts.pool `'veil'` — 베일 크립트 블라인드 전용 각인 풀 (일반 감정·드랍과 다른 문구·조합)
 */
export function rollAppraisalAffixes(
  itemDef: ItemData,
  rng: () => number,
  opts?: { pool?: 'default' | 'veil' }
): { lines: RolledAffixLine[]; combatTags: ('swift' | 'destructive')[] } {
  const kind = itemDef.type as EquipKind;
  const sourceKinds = opts?.pool === 'veil' ? VEIL_EXCLUSIVE_KINDS : APPRAISAL_KINDS;
  let pool = sourceKinds.filter((k) => k.types.includes(kind));
  if (pool.length === 0) pool = APPRAISAL_KINDS.filter((k) => k.types.includes(kind));
  // 한 장비당 부가 줄 수: 3~5 (풀이 커졌으므로 중복 없이 더 많이 붙일 수 있음)
  const count = Math.min(pool.length, 3 + Math.floor(rng() * 3));
  const lines: RolledAffixLine[] = [];
  const combatTags: ('swift' | 'destructive')[] = [];
  const used = new Set<string>();
  const weights = pool.map((p) => p.weight);

  for (let n = 0; n < count; n++) {
    const availIdx = pool
      .map((p, i) => (used.has(p.id) ? -1 : i))
      .filter((i) => i >= 0) as number[];
    if (availIdx.length === 0) break;
    const subW = availIdx.map((i) => weights[i]);
    const j = availIdx[pickWeightedIndex(subW, rng)];
    const def = pool[j];
    used.add(def.id);
    lines.push(def.roll(rng));
    if (def.tag === 'swift' && !combatTags.includes('swift')) combatTags.push('swift');
    if (def.tag === 'destructive' && !combatTags.includes('destructive')) combatTags.push('destructive');
  }

  return { lines, combatTags };
}
