/**
 * WHY: 10배 규모 맵을 위해 대량의 방을 코드로 생성한다.
 *      maze_s6 남쪽에서 시작해 14개 구역 × 50방 = 700방을 이어 붙인다.
 */
import type { Room } from './roomTypes';

const NAMES = [
  '터널', '복도', '골목', '창고', '배수로', '광장', '계단', '홀', '관문', '지하실',
  '동굴', '미로', '갱도', '선로', '플랫폼', '대합실', '통로', '교차로', '작업장', '격납고',
  '펌프실', '변전실', '덕트', '배관', '저장고', '격리구역', '차단문', '경계로', '회랑', '참호',
];
const DESCS = [
  '어둡고 습하다.', '벽에 낙서가 새겨져 있다.', '기계 잔해가 널려 있다.', '형광등이 깜빡인다.',
  '악취가 진동한다.', '바람이 차갑게 통한다.', '정체 모를 소리가 흐른다.', '천장에서 물이 떨어진다.',
  '곰팡이 냄새가 난다.', '철문이 반쯤 열려 있다.',
];

function room(
  id: string,
  name: string,
  description: string,
  exits: Partial<Record<'북' | '남' | '동' | '서', string>>,
  encounterChance: number,
  mapX: number,
  mapY: number
): Room {
  return { id, name, description, exits, encounterChance, mapX, mapY };
}

const BULK: Room[] = [];
const ZONES = 14;
const ROOMS_PER_ZONE = 50;

for (let z = 0; z < ZONES; z++) {
  const prefix = `bulk_${z}_`;
  // WHY: 미니맵에서 노드 겹침 방지. 구역은 동쪽으로 한 열씩, 방은 남쪽으로 한 칸씩 배치.
  const baseX = 10 + z * 3;
  const baseY = 20;

  for (let i = 0; i < ROOMS_PER_ZONE; i++) {
    const id = prefix + i;
    const exits: Partial<Record<'북' | '남' | '동' | '서', string>> = {};

    if (i > 0) exits['북'] = prefix + (i - 1);
    else if (z === 0) exits['북'] = 'maze_s6';
    // 마지막 구역 최하단 → 전용 격납고(캡스톤). 그 외 구역은 기존대로 남쪽으로만 이어짐.
    if (i < ROOMS_PER_ZONE - 1) exits['남'] = prefix + (i + 1);
    else if (z === ZONES - 1) exits['남'] = 'bulk_terminal_vault';

    // 구역 중간에서 다음 구역으로 동쪽 연결
    if (i === 24 && z < ZONES - 1) exits['동'] = `bulk_${z + 1}_0`;
    if (i === 10 && z > 0) exits['서'] = `bulk_${z - 1}_40`;
    if (i === 0 && z > 0) exits['서'] = `bulk_${z - 1}_24`;

    const nameIdx = (z * ROOMS_PER_ZONE + i) % NAMES.length;
    const descIdx = (z * 7 + i) % DESCS.length;
    const enc = 0.2 + ((z * 5 + i) % 8) * 0.08;
    // 방마다 고유 좌표: 구역(z)에 따라 X, 방 인덱스(i)에 따라 Y (남쪽으로 일렬)
    const mapX = baseX;
    const mapY = baseY + i;

    BULK.push(
      room(
        id,
        `확장 ${z + 1}구역 ${i + 1}`,
        `${NAMES[nameIdx]} 구간. ${DESCS[descIdx]}`,
        exits,
        Math.min(0.92, enc),
        mapX,
        mapY
      )
    );
  }
}

export const ROOMS_EXPANDED_BULK: Room[] = BULK;
