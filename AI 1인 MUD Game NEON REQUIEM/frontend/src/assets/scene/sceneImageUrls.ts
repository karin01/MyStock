/**
 * 장면 이미지 — `images/{backgrounds,enemies,npcs}/` 아래 PNG·WebP·JPG를 자동 스캔(?url 번들).
 * WHY: SVG는 환경에 따라 렌더/로드가 불안정할 수 있어, 프로젝트 정책상 PNG만 사용한다.
 */
import type { Room } from '../../data/roomTypes';
import { ENEMY_LIST } from '../../data/enemies';

// ─── 주요 배경 PNG 정적 번들 (glob 누락·Drive 동기화 지연 대비) ───
// WHY: 일부 환경에서 import.meta.glob 결과가 비어 pickAsset이 실패하면 <img> 404 → 어두운 data URI 폴백만 보이는 현상이 난다.
import bgAlleyUrl from './images/backgrounds/bg_alley.png?url';
import bgStairsUrl from './images/backgrounds/bg_stairs.png?url';
import bgMazeUrl from './images/backgrounds/bg_maze.png?url';
import bgMazeRestUrl from './images/backgrounds/bg_maze_rest.png?url';
import bgExtendedMazeUrl from './images/backgrounds/bg_extended_maze.png?url';
import bgIndustrialMazeUrl from './images/backgrounds/bg_industrial_maze.png?url';

/** 확장자 우선순위 — PNG 원화가 최우선 */
const EXT_RANK: Record<string, number> = { png: 0, webp: 1, jpg: 2, jpeg: 2 };

type Folder = 'backgrounds' | 'enemies' | 'npcs';

const sceneImageUrlModules = import.meta.glob<string>('./images/**/*.{png,jpeg,jpg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** `enemies/chrome_thief` → 최적 URL */
const bestUrlByFolderStem = new Map<string, { url: string; r: number }>();

for (const [path, url] of Object.entries(sceneImageUrlModules)) {
  const m = path.replace(/\\/g, '/').match(/\.\/images\/(backgrounds|enemies|npcs)\/(.+)\.([^.]+)$/i);
  if (!m) continue;
  const folder = m[1] as Folder;
  const stem = m[2].toLowerCase();
  const ext = m[3].toLowerCase();
  const r = EXT_RANK[ext] ?? 9;
  const key = `${folder}/${stem}`;
  const cur = bestUrlByFolderStem.get(key);
  if (!cur || r < cur.r) bestUrlByFolderStem.set(key, { url, r });
}

const BUNDLED_FALLBACK_BACKGROUNDS: Record<string, string> = {
  'backgrounds/bg_alley': bgAlleyUrl,
  'backgrounds/bg_stairs': bgStairsUrl,
  'backgrounds/bg_maze': bgMazeUrl,
  'backgrounds/bg_maze_rest': bgMazeRestUrl,
  'backgrounds/bg_extended_maze': bgExtendedMazeUrl,
  'backgrounds/bg_industrial_maze': bgIndustrialMazeUrl,
};
for (const [key, url] of Object.entries(BUNDLED_FALLBACK_BACKGROUNDS)) {
  if (!bestUrlByFolderStem.has(key)) {
    bestUrlByFolderStem.set(key, { url, r: EXT_RANK['png'] ?? 0 });
  }
}

/**
 * 폴더 내 파일 stem 매칭 — `chrome_thief.png` 또는 `chrome_thief_123.png` 모두 후보 `chrome_thief`에 매칭.
 */
function pickAsset(folder: Folder, stem: string): string | undefined {
  const p = stem.toLowerCase();
  const folderPrefix = `${folder}/`;
  const exactKey = `${folder}/${p}`;
  const exact = bestUrlByFolderStem.get(exactKey);
  if (exact) return exact.url;

  let best: { url: string; r: number; stemLen: number } | undefined;
  for (const [key, v] of bestUrlByFolderStem) {
    if (!key.startsWith(folderPrefix)) continue;
    const fileStem = key.slice(folderPrefix.length);
    if (!fileStem.startsWith(`${p}_`)) continue;
    const sl = fileStem.length;
    if (!best || v.r < best.r || (v.r === best.r && sl < best.stemLen)) {
      best = { url: v.url, r: v.r, stemLen: sl };
    }
  }
  return best?.url;
}

/** 여러 후보 stem 중 첫 매칭 */
function pickFirst(folder: Folder, stems: string[]): string | undefined {
  for (const s of stems) {
    const u = pickAsset(folder, s);
    if (u) return u;
  }
  return undefined;
}

export function scenePublicUrl(pathFromRoot: string): string {
  const p = pathFromRoot.startsWith('/') ? pathFromRoot.slice(1) : pathFromRoot;
  const base = import.meta.env.BASE_URL;
  return base.endsWith('/') ? `${base}${p}` : `${base}/${p}`;
}

/**
 * 최종 폴백(정말 아무 배경도 없을 때) — PNG data URI
 * WHY: SVG 폴백을 금지(일부 환경에서 렌더/로드 이슈).
 */
export const SCENE_IMAGE_FALLBACK_DATA_URI =
  // 400×240 네온 프레임 PNG (base64) — SVG 사용 금지 정책 준수
  'data:image/png;base64,' +
  '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';

export const BG_ALLEY = pickAsset('backgrounds', 'bg_alley') ?? SCENE_IMAGE_FALLBACK_DATA_URI;

function resolveTemplateIdFromInstanceId(instanceId: string): string | null {
  if (ENEMY_LIST.some((e) => e.id === instanceId)) return instanceId;
  const parts = instanceId.split('_');
  for (let len = parts.length - 1; len >= 1; len--) {
    const candidate = parts.slice(0, len).join('_');
    if (ENEMY_LIST.some((e) => e.id === candidate)) return candidate;
  }
  return null;
}

function enemyArtCandidates(imageKey: string | null | undefined, templateId: string | null): string[] {
  const out: string[] = [];
  if (imageKey) {
    out.push(imageKey);
    out.push(imageKey.replace(/_[abc]$/i, ''));
  }
  if (templateId) {
    out.push(templateId);
    out.push(templateId.replace(/_\d+$/i, ''));
  }
  return [...new Set(out.filter(Boolean))];
}

export function resolveEnemySceneImage(
  imageKey: string | null | undefined,
  instanceId: string | undefined,
): string {
  const tid = instanceId ? resolveTemplateIdFromInstanceId(instanceId) : null;
  for (const stem of enemyArtCandidates(imageKey, tid)) {
    const u = pickAsset('enemies', stem);
    if (u) return u;
  }
  if (tid === 'shadow_ninja') {
    const u = pickFirst('enemies', ['shadow_ninja', 'shadow_ninja_line', 'enemy_shadow_ninja', 'digital_ninja']);
    if (u) return u;
    return pickAsset('enemies', 'enemy_shadow_ninja') ?? SCENE_IMAGE_FALLBACK_DATA_URI;
  }
  const sil = tid ? ENEMY_TEMPLATE_SILHOUETTE_STEMS[tid] : undefined;
  if (sil) {
    const u = pickFirst('enemies', sil);
    if (u) return u;
  }
  return pickAsset('enemies', 'enemy_generic') ?? SCENE_IMAGE_FALLBACK_DATA_URI;
}

/** imageKey 없을 때 파일명 힌트(여러 후보 시도) */
const ENEMY_TEMPLATE_SILHOUETTE_STEMS: Record<string, string[]> = {
  data_leech: ['data_leech', 'glitch_virus'],
  sewer_rat_mutant: ['sewer_rat_mutant', 'mutant_hound'],
  slum_scavenger: ['slum_scavenger', 'chrome_thief', 'alley_brawler'],
  alley_punk: ['alley_punk', 'chrome_thief', 'alley_brawler'],
  broken_drone: ['broken_drone', 'auto_turret_a', 'support_drone'],
  support_drone: ['support_drone', 'patrol_drone_pack', 'patrol_drone', 'auto_turret_a', 'broken_drone'],
  drone_hunter: ['drone_hunter', 'auto_turret_a'],
  rusted_bot: ['rusted_bot', 'auto_turret_a'],
  warlord_grunt: ['warlord_grunt', 'bio_fury_fanatic', 'marecorp_spec_ops'],
  neo_vampire: ['neo_vampire', 'chrome_thief'],
  data_wraith: ['data_wraith', 'glitch_virus'],
  heavy_mech: ['heavy_mech', 'auto_turret_a'],
  plasma_golem: ['plasma_golem', 'bio_fury_fanatic'],
  void_arcanist: ['void_arcanist', 'arcadia_guard'],
  spire_watch: ['spire_watch', 'marecorp_spec_ops'],
  holo_sentry: ['holo_sentry', 'arcadia_guard'],
};

export const ENEMY_IMAGES: Record<string, string> = (() => {
  const keys = [
    'glitch_virus',
    'arcadia_guard',
    'bio_fury_fanatic',
    'auto_turret_a',
    'auto_turret_b',
    'auto_turret_c',
    'marecorp_specops_a',
    'marecorp_specops_b',
    'marecorp_specops_c',
    'mutant_hound_a',
    'mutant_hound_b',
    'mutant_hound_c',
    'chrome_thief_a',
    'chrome_thief_b',
    'chrome_thief_c',
  ];
  const o: Record<string, string> = {};
  for (const k of keys) {
    const u = pickFirst('enemies', enemyArtCandidates(k, null));
    if (u) o[k] = u;
  }
  return o;
})();

/** 장면 배경 추론 — PNG stem(bg_maze, bg_maze_rest, bg_extended_maze 등)과 매칭 */
type ScenePreset = 'alley' | 'stairs' | 'sewer' | 'maze' | 'maze_rest' | 'extended';

function inferScenePreset(room: Pick<Room, 'id' | 'name'>): ScenePreset {
  const { id, name } = room;
  const blob = `${id} ${name}`;
  const nameTrim = name.trim();

  // WHY: 벌크 14×50 확장 통로(bulk_*)·최하단 격납고 — 전용 원화(bg_extended_maze)
  if (id.startsWith('bulk_') || id === 'bulk_terminal_vault' || /^확장 \d+구역 \d+$/.test(nameTrim)) {
    return 'extended';
  }

  // WHY: 심층 미로 휴식처·소리 없는 미로의 침묵 휴식 구역 — 따뜻한 비상등 느낌(bg_maze_rest)
  if (id === 'maze_s4_rest' || id === 'silent_rest_area') {
    return 'maze_rest';
  }

  if (
    /계단|꺽임|참|나선/.test(name) ||
    /연결로/.test(name) ||
    /hidden_staircase|deep_abyss|plaza_e1s/i.test(id) ||
    /_hook\d*$/i.test(id) ||
    /maze_s4e2$/i.test(id) ||
    /^maze_s5|^maze_s6/i.test(id)
  ) {
    return 'stairs';
  }
  if (/하수|배수|독소|슬라임|sewer|toxic|drain|mutant_lair|deep_sewer|swamp|slime/i.test(blob)) {
    return 'sewer';
  }
  if (/미로|maze_|silent_maze|labyrinth/i.test(blob)) {
    return 'maze';
  }
  return 'alley';
}

function resolveBackgroundFromStems(stems: string[], svgFallback: string): string {
  return pickFirst('backgrounds', stems) ?? svgFallback;
}

export function resolveRoomSceneImage(room: Pick<Room, 'id' | 'name' | 'bgImage'> | null | undefined): string {
  if (!room) return resolveBackgroundFromStems(['bg_alley'], BG_ALLEY);
  const custom = room.bgImage?.trim();
  if (custom) {
    if (custom.includes('bg_alley')) {
      return resolveBackgroundFromStems(['bg_alley'], BG_ALLEY);
    }
    const file = custom.split('/').pop()?.replace(/\.(png|jpe?g|webp)$/i, '') ?? '';
    if (file) {
      const u = pickAsset('backgrounds', file.toLowerCase());
      if (u) return u;
    }
    return scenePublicUrl(custom);
  }
  switch (inferScenePreset(room)) {
    case 'stairs':
      return resolveBackgroundFromStems(['bg_stairs', 'bg_industrial', 'bg_stair'], BG_ALLEY);
    case 'sewer':
      return resolveBackgroundFromStems(['bg_sewer', 'bg_toxic'], BG_ALLEY);
    case 'maze_rest':
      return (
        pickFirst('backgrounds', ['bg_maze_rest', 'bg_silent_rest', 'bg_maze', 'bg_industrial_maze']) ??
        bgMazeRestUrl ??
        BG_ALLEY
      );
    case 'extended':
      return resolveBackgroundFromStems(
        ['bg_extended_maze', 'bg_bulk_maze', 'bg_zone_extended', 'bg_maze', 'bg_industrial_maze'],
        BG_ALLEY,
      );
    case 'maze':
      return resolveBackgroundFromStems(
        ['bg_maze', 'bg_industrial_maze', 'bg_sewer_maze'],
        BG_ALLEY,
      );
    default:
      return resolveBackgroundFromStems(['bg_alley', 'bg_street', 'bg_city'], BG_ALLEY);
  }
}

export const NPC_IMAGE_FALLBACK =
  pickAsset('npcs', 'npc_generic') ??
  pickAsset('npcs', 'generic') ??
  pickAsset('enemies', 'enemy_generic') ??
  SCENE_IMAGE_FALLBACK_DATA_URI;

export const NPC_IMAGES: Record<string, string> = (() => {
  const ids = ['oni', 'ghostQueen', 'mysterio', 'ironJack', 'jin', 'eden', 'lira', 'zeros', 'neonFat', 'shadowRat', 'dreamweaver', 'silverPhantom', 'veilCrypt', 'hana', 'karina'] as const;
  const o: Record<string, string> = {};
  const extraStems: Record<string, string[]> = {
    ghostQueen: ['ghost_queen', 'ghostqueen', 'npc_ghost_queen'],
    ironJack: ['iron_jack', 'ironjack', 'npc_iron_jack'],
    neonFat: ['neon_fat', 'neonfat', 'npc_neon_fat'],
    shadowRat: ['shadow_rat', 'shadowrat', 'npc_shadow_rat'],
    dreamweaver: ['dreamweaver', 'dream_weaver', 'npc_dreamweaver'],
    silverPhantom: ['silver_phantom', 'silverphantom', 'npc_silver_phantom'],
    veilCrypt: ['veil_crypt', 'veilcrypt', 'npc_veil_crypt'],
    eden: ['eden', 'npc_eden', 'arcadia_eden'],
    lira: ['lira', 'npc_lira', 'clinic_lira'],
    zeros: ['zeros', 'npc_zeros', 'bio_zeros'],
    jin: ['jin', 'npc_jin', 'master_jin', 'jin_art'],
    hana: ['hana', 'npc_hana', 'hana_art'],
    karina: ['karina', 'npc_karina', 'karina_art'],
  };
  for (const id of ids) {
    const stems = extraStems[id] ?? [`${id}`, `npc_${id}`];
    const u = pickFirst('npcs', stems);
    if (u) o[id] = u;
  }
  if (!o.veilCrypt) {
    o.veilCrypt =
      pickFirst('npcs', ['veil_crypt', 'veilcrypt', 'npc_veil_crypt']) ??
      o.mysterio ??
      pickFirst('npcs', ['mysterio', 'npc_mysterio']) ??
      NPC_IMAGE_FALLBACK;
  }
  return o;
})();

export function resolveNpcSceneImage(npcId: string): string {
  return NPC_IMAGES[npcId] ?? NPC_IMAGE_FALLBACK;
}

/** @deprecated */
export function sceneUrlFromRoomBg(stored: string | undefined): string {
  if (!stored || stored.includes('bg_alley')) return resolveBackgroundFromStems(['bg_alley'], BG_ALLEY);
  return scenePublicUrl(stored);
}
