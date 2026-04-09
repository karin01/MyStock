// 룸(방) 기반 맵 시스템
// WHY: 단순 방향 이동이 아닌 실제 이어진 맵으로 전략적 탐험 경험을 제공한다.

import type { Room } from './roomTypes';

export type { Room };

// ============================
// 네온 레퀴엠 2087 서울 맵 (좌표 전면 재설계 - 중복 완전 제거)
// 좌표 체계: mapX (서→동), mapY (북↑ 음수 / 남↓ 양수)
// ============================
const ROOMS_BASE: Room[] = [
  // ─────────────────────────────────────────
  // 구역 1: 시작 구역 (지하/빈민가 심층)
  // ─────────────────────────────────────────
  {
    id: 'slum_market',
    name: '지하 슬럼 상점가',
    description: '폐기된 안드로이드 부품들이 산더미처럼 쌓여있다. 희귀한 크롬을 찾는 러너들과 고물상 텐트들 사이로, 한구석에서 [아이언 잭]이 용광로 불꽃을 튀기며 무기를 손보고 있다.',
    exits: { '동': 'clinic', '서': 'rusty_alley', '남': 'slum_south_gate' },
    encounterChance: 0.1, mapX: 3, mapY: 6, isSafe: true,
  },
  {
    id: 'rusty_alley',
    name: '녹슨 뒷골목',
    description: '끝없이 비가 새는 버려진 판자촌 골목길. 시궁창 냄새가 진동한다.',
    exits: { '동': 'slum_market', '북': 'abandoned_factory_gate', '서': 'slum_west_corridor' },
    encounterChance: 0.4, mapX: 2, mapY: 6,
  },
  {
    id: 'abandoned_factory_gate',
    name: '폐공장 진입로',
    description: '거대한 셔터 문이 반쯤 열려있는 구시대 공업 지대 입구.',
    exits: { '남': 'rusty_alley', '북': 'conveyor_maze' },
    encounterChance: 0.6, mapX: 0, mapY: 5,
  },
  {
    id: 'conveyor_maze',
    name: '컨베이어 벨트 미로',
    description: '멈춰선 거대한 화물 기계들이 복잡하게 얽혀 길을 형성하고 있다.',
    exits: { '남': 'abandoned_factory_gate', '동': 'boiler_dead_end' },
    encounterChance: 0.7, mapX: 3, mapY: 5,
  },
  {
    id: 'clinic',
    name: '홍대 지하 클리닉',
    description: '불법 크롬 수술이 행해지는 어두컴컴한 지하 클리닉. 모닥불 곁에 의사 리라 웅크리고 있으며, 한쪽 구석에는 기술의 달인 마스터 진이 명상에 잠겨 있다. 안전지대(휴식 가능).',
    exits: { '북': 'corridor', '서': 'slum_market', '동': 'hidden_staircase' },
    encounterChance: 0, bgImage: '/images/backgrounds/bg_alley.svg', mapX: 4, mapY: 6, isSafe: true,
  },
  {
    id: 'hidden_staircase',
    name: '비밀 나선 계단',
    description: '축축한 이끼로 뒤덮인 나선형 계단. 깊은 지하로 통하는 것 같다.',
    exits: { '서': 'clinic', '남': 'deep_abyss' },
    encounterChance: 0.3, mapX: 5, mapY: 6,
  },
  {
    id: 'deep_abyss',
    name: '심연의 끝자락',
    description: '바닥을 알 수 없는 기계식 절벽. 끝없이 추락하는 환영이 뇌를 자극한다.',
    exits: { '북': 'hidden_staircase' },
    encounterChance: 0.9, mapX: 5, mapY: 7,
  },
  {
    id: 'corridor',
    name: '어두운 복도',
    description: '환풍구에서 칙칙한 스팀이 뿜어져 나오는 비좁은 복도. 곳곳에 핏자국이 말라붙어 있다.',
    exits: { '북': 'underground_plaza', '남': 'clinic', '동': 'boiler_dead_end' },
    encounterChance: 0.2, mapX: 4, mapY: 5,
  },
  {
    id: 'boiler_dead_end',
    name: '증기 보일러실',
    description: '거대한 보일러 기계가 굉음을 내며 돌아가고 있다. 열기가 숨을 턱 막히게 한다.',
    exits: { '서': 'corridor', '북': 'abandoned_subway', '남': 'conveyor_maze' },
    encounterChance: 0.4, mapX: 5, mapY: 5,
  },
  {
    id: 'underground_plaza',
    name: '버려진 지하 광장',
    description: '과거 거대한 환승 통로였던 넓은 광장. 천장 곳곳이 무너져 내려 기괴한 그림자를 만든다.',
    exits: { '북': 'neon_alley', '남': 'corridor', '서': 'black_market_entrance', '동': 'plaza_east_wing' },
    encounterChance: 0.2, mapX: 4, mapY: 4,
  },
  {
    id: 'black_market_entrance',
    name: '암시장 입구',
    description: '총기를 든 용병들이 입구를 지키고 있다. 붉은 홀로그램이 눈을 찌른다.',
    exits: { '동': 'underground_plaza', '서': 'underground_arena' },
    encounterChance: 0.5, mapX: 3, mapY: 4,
  },
  {
    id: 'underground_arena',
    name: '불법 지하 투기장',
    description: '피 냄새가 진동하는 거대한 모래 경기장. 함성 소리가 끊이질 않는다.',
    exits: { '동': 'black_market_entrance' },
    encounterChance: 0.8, mapX: 2, mapY: 4,
  },
  {
    id: 'abandoned_subway',
    name: '구형 지하철 선로',
    description: '버려진 전동차가 녹슬어 방치된 낡은 선로. 깊은 암흑 속에서 정체 모를 불빛이 일렁인다.',
    exits: { '남': 'boiler_dead_end', '동': 'deep_sewer' },
    encounterChance: 0.35, mapX: 5, mapY: 4,
  },

  // ─────────────────────────────────────────
  // 구역 2: 변이 생태계 (Cyber Jungle & Sewers)
  // ─────────────────────────────────────────
  {
    id: 'deep_sewer',
    name: '심층 하수도 삼거리',
    description: '유독성 폐수가 교차하는 넓은 하수도 구역. 발 밑이 질척인다.',
    exits: { '서': 'abandoned_subway', '동': 'mutant_lair', '북': 'toxic_swamp', '남': 'sewer_south_branch' },
    encounterChance: 0.5, mapX: 9, mapY: 5,
  },
  {
    id: 'mutant_lair',
    name: '변이의 요람',
    description: '오염된 고치들이 매달린 끔찍한 구역이다. 벽면이 고동치듯 꿈틀거린다.',
    exits: { '서': 'deep_sewer', '남': 'queen_chamber' },
    encounterChance: 0.85, mapX: 10, mapY: 5, lockedByBoss: 'mutant_king',
  },
  {
    id: 'queen_chamber',
    name: '군락의 심장',
    description: '오염 물질의 핵이 있는 곳. 지독한 방사능이 영혼까지 침식한다.',
    exits: { '북': 'mutant_lair' },
    encounterChance: 1.0, mapX: 11, mapY: 6,
  },
  {
    id: 'toxic_swamp',
    name: '거대 곰팡이 늪지',
    description: '푸른 형광빛을 내는 거대한 곰팡이 포자가 눈처럼 흩날리는 지하 습지.',
    exits: { '남': 'deep_sewer', '북': 'club_neon' },
    encounterChance: 0.7, mapX: 6, mapY: 4,
  },

  // ─────────────────────────────────────────
  // 구역 3: 네온 상권 및 갱 구역
  // ─────────────────────────────────────────
  {
    id: 'back_alley_lab',
    name: '피의 생체 실험실 (막힘)',
    description: '금지된 불법 약물 시술이 이뤄지는 피비린내 나는 불법 랩. 출입이 제한된다.',
    exits: { '동': 'neon_alley', '북': 'red_dragon_turf' },
    encounterChance: 0.6, mapX: 3, mapY: 3,
  },
  {
    id: 'neon_alley',
    name: '뒷골목 네온 거리',
    description: '싸구려 홀로그램 네온사인이 깨질 듯 깜빡이는 뒷골목. 거리의 부랑자와 용병들이 오간다.',
    exits: { '북': 'hongdae_station', '남': 'underground_plaza', '동': 'neon_fat_stall', '서': 'back_alley_lab' },
    encounterChance: 0.25, mapX: 4, mapY: 3,
  },
  {
    id: 'neon_fat_stall',
    name: '네온 팻의 포장마차',
    description: '따뜻한 온기를 내뿜는 포장마차. 김이 무럭무럭 난다. 안전지대(휴식 가능).',
    exits: { '서': 'neon_alley', '동': 'club_neon', '북': 'ramen_storage' },
    encounterChance: 0, mapX: 5, mapY: 3, isSafe: true,
  },
  {
    id: 'ramen_storage',
    name: '포장마차 식자재 창고',
    description: '합성 고기와 조미료 통이 겹겹이 쌓여있는 서늘한 창고 구역.',
    exits: { '남': 'neon_fat_stall' },
    encounterChance: 0.1, mapX: 5, mapY: 2,
  },
  {
    id: 'club_neon',
    name: '클럽 인페르노',
    description: '쿵쾅거리는 비트가 바닥을 울리는 거대한 언더그라운드 클럽. 향락의 냄새가 짙다.',
    exits: { '서': 'neon_fat_stall', '남': 'toxic_swamp' },
    encounterChance: 0.4, mapX: 6, mapY: 3,
  },

  // ─────────────────────────────────────────
  // 구역 4: 지상 허브 및 아르카디아
  // ─────────────────────────────────────────
  {
    id: 'ruined_alley_dead_end',
    name: '폐허 쓰레기장',
    description: '거대한 잔해와 쓰레기 산. 악취가 진동한다.',
    exits: { '동': 'zeros_hideout' },
    encounterChance: 0.45, mapX: 1, mapY: 2,
  },
  {
    id: 'zeros_hideout',
    name: '제로스의 아지트',
    description: '순수 인간들의 모임 바이오 퓨리의 거점. 안전지대(휴식 가능).',
    exits: { '동': 'red_dragon_turf', '서': 'ruined_alley_dead_end' },
    encounterChance: 0, mapX: 2, mapY: 2, isSafe: true,
  },
  {
    id: 'red_dragon_turf',
    name: '레드드래곤 집결지',
    description: '용 문신 사이보그들이 불타는 드럼통 주위로 경계를 서고 있다.',
    exits: { '동': 'hongdae_station', '서': 'zeros_hideout', '남': 'back_alley_lab', '북': 'smuggler_route' },
    encounterChance: 0.45, mapX: 3, mapY: 2,
  },
  {
    id: 'smuggler_route',
    name: '밀수꾼의 샛길',
    description: '비좁은 벽 사이로 이어진 숨겨진 도로. 삼엄한 감시망을 피해 다니는 길이다.',
    exits: { '남': 'red_dragon_turf', '북': 'hyper_bridge_entrance' },
    encounterChance: 0.5, mapX: 3, mapY: 1,
  },
  {
    id: 'hongdae_station',
    name: '홍대 지상 연결역',
    description: '거대한 교통 허브 사거리 한복판. 어디서 전투가 벌어질지 모르는 긴장감이 돈다.',
    exits: { '북': 'hyper_bridge_entrance', '남': 'neon_alley', '동': 'arcadia_watchtower', '서': 'red_dragon_turf' },
    encounterChance: 0.3, mapX: 4, mapY: 2,
  },
  {
    id: 'arcadia_watchtower',
    name: '아르카디아 외곽 초소',
    description: '거대한 검문 게이트. 무장 드론이 공중을 순찰 중이다.',
    exits: { '동': 'arcadia_central', '서': 'hongdae_station', '남': 'ramen_storage' },
    encounterChance: 0.55, mapX: 5, mapY: 1,
  },
  {
    id: 'arcadia_central',
    name: '아르카디아 센트럴',
    description: '황금빛 햇살(인공조명)이 눈부신 거대한 도시 구역. 네온 레퀴엠의 심장부다.',
    exits: { '서': 'arcadia_watchtower', '북': 'neon_sky_lounge', '동': 'corporate_lobby' },
    encounterChance: 0.2, mapX: 6, mapY: 1,
    requiredKey: 'A구역 보안 키',
    lockedByBoss: 'arcadia_gatekeeper',
  },
  {
    id: 'cyber_clinic',
    name: 'V.I.P 크롬 시술소',
    description: '최상위 계층을 위한 최고급 시술소. 휴식이 가능한 아르카디아의 오아시스.',
    exits: { '남': 'arcadia_central' },
    encounterChance: 0, mapX: 6, mapY: 0, isSafe: true,
  },
  {
    id: 'corporate_lobby',
    name: '메가코프 타워 1층',
    description: '압도적으로 거대한 스틸 로비. 경비가 삼엄하다.',
    exits: { '서': 'arcadia_central', '북': 'arcadia_roof', '동': 'data_center' },
    encounterChance: 0.75, mapX: 7, mapY: 1,
  },
  {
    id: 'arcadia_roof',
    name: '타워 공중 정원',
    description: '상공 5,000m의 스카이라운지. 끔찍하게 눈부신 뷰가 펼쳐진다.',
    exits: { '남': 'corporate_lobby', '북': 'skybridge' },
    encounterChance: 0.85, mapX: 7, mapY: 0,
    elevation: 1,
  },
  {
    id: 'skybridge',
    name: '전망대 스카이브릿지',
    description: '타워와 타워를 잇는 위험한 구름다리.',
    exits: { '남': 'arcadia_roof' },
    encounterChance: 0.9, mapX: 7, mapY: -1,
    elevation: 1,
  },
  {
    id: 'data_center',
    name: '양자 코어 메인프레임',
    description: '붉은 비상등이 깜빡거리는 중앙 데이터 저장소.',
    exits: { '서': 'corporate_lobby', '동': 'secret_catacomb' },
    encounterChance: 0.95, mapX: 8, mapY: 1,
  },
  {
    id: 'secret_catacomb',
    name: '기업의 비밀 묘지',
    description: '실패한 실험체들이 버려진 참혹한 지하 폐쇄 구역.',
    exits: { '서': 'data_center' },
    encounterChance: 1.0, mapX: 9, mapY: 1,
  },

  // ─────────────────────────────────────────
  // 구역 5: 하이퍼 브릿지 & 황무지
  // ─────────────────────────────────────────
  {
    id: 'hyper_bridge_entrance',
    name: '하이퍼 브릿지 진입로',
    description: '끊어진 고가도로의 입구. 차가운 강풍이 불어온다.',
    exits: { '남': 'hongdae_station', '북': 'hyper_bridge', '서': 'smuggler_route' },
    encounterChance: 0.4, mapX: 4, mapY: 1,
  },
  {
    id: 'hyper_bridge',
    name: '무너진 고가도로 센터',
    description: '허공에 뜬 끊어진 아스팔트 조각 위. 구시대 차량 코어가 나뒹군다.',
    exits: { '남': 'hyper_bridge_entrance', '동': 'shinchon_rad_zone' },
    encounterChance: 0.65, mapX: 4, mapY: 0,
    elevation: 1,
  },
  {
    id: 'shinchon_rad_zone',
    name: '신촌 붕괴 폭심지',
    description: '맹독성 노란 안개가 가득한 방사능 구역. 호흡기가 녹아내릴 것 같다.',
    exits: { '서': 'hyper_bridge', '북': 'wasteland_edge' },
    encounterChance: 0.75, mapX: 5, mapY: 0,
  },
  {
    id: 'wasteland_edge',
    name: '황무지 경계선',
    description: '거대한 돔 바깥을 구분 짓는 찢어진 홀로그램 장벽.',
    exits: { '남': 'shinchon_rad_zone', '북': 'wasteland_dunes', '동': 'crashed_ship' },
    encounterChance: 0.85, mapX: 5, mapY: -1,
  },
  {
    id: 'crashed_ship',
    name: '추락한 수송선',
    description: '어스 균열 사이에 반쯤 박혀있는 거대한 스텔스 수송기 잔해.',
    exits: { '서': 'wasteland_edge' },
    encounterChance: 0.9, mapX: 6, mapY: -1,
  },
  {
    id: 'wasteland_dunes',
    name: '검은 모래 언덕',
    description: '날카로운 규소가 섞인 모래바람이 불어치는 황무지 사막 한복판.',
    exits: { '남': 'wasteland_edge', '북': 'end_of_world' },
    encounterChance: 0.95, mapX: 5, mapY: -2,
  },
  {
    id: 'end_of_world',
    name: '세상의 끝 (봉인된 게이트)',
    description: '더 이상 나아갈 수 없는 거대한 절대 장벽. 허공이 아지랑이로 일렁인다.',
    exits: { '남': 'wasteland_dunes' },
    encounterChance: 1.0, mapX: 5, mapY: -3,
  },

  // ─────── 구역 6: 동부 산업 지대 ───────
  {
    id: 'east_gate',
    name: '동부 산업 입구',
    description: '낡은 철침 건물들이 지평선을 담은 동부 공업 지대 입구.',
    exits: { '서': 'abandoned_subway', '동': 'factory_floor_a', '북': 'toxic_pipe_junction' },
    encounterChance: 0.3, mapX: 6, mapY: 5,
  },
  {
    id: 'factory_floor_a',
    name: '제1 파이라인 (A동)',
    description: '멈춰선 컨베이어 벨트와 빈 공간에 버려진 낡은 기계.',
    exits: { '서': 'east_gate', '동': 'factory_floor_b', '남': 'heavy_storage' },
    encounterChance: 0.55, mapX: 7, mapY: 5,
  },
  {
    id: 'factory_floor_b',
    name: '제2 파이라인 (B동)',
    description: '공업용 로봇들이 넘쳐오거나 다니는 기계식 지옥.',
    exits: { '서': 'factory_floor_a', '동': 'mech_graveyard', '북': 'industrial_control' },
    encounterChance: 0.65, mapX: 8, mapY: 5,
  },
  {
    id: 'heavy_storage',
    name: '중화전 물류창고',
    description: '낡은 영구 저장 보구들이 쌓여있다. 무언가 다가온다.',
    exits: { '북': 'factory_floor_a', '동': 'reactor_core' },
    encounterChance: 0.7, mapX: 7, mapY: 6,
  },
  {
    id: 'mech_graveyard',
    name: '기계 무덤',
    description: '파괴된 전투 로봇의 시체들이 가득한 광경.',
    exits: { '서': 'factory_floor_b', '남': 'reactor_core' },
    encounterChance: 0.8, mapX: 10, mapY: 6,
  },
  {
    id: 'reactor_core',
    name: '고장난 리액터 코어',
    description: '빨간 비상등이 깜빡거리는 지하 에너지실. 방사능 위험.',
    exits: { '북': 'heavy_storage', '서': 'mech_graveyard', '동': 'electromagnetic_zone' },
    encounterChance: 0.85, mapX: 9, mapY: 7,
  },
  {
    id: 'electromagnetic_zone',
    name: '전자기파 방해 구역',
    description: '전자 장비가 모두 마비되는 전자기파(EMP) 지대. 남쪽 지열 배관 쪽으로 난 열기가 새어 나온다.',
    exits: { '서': 'reactor_core', '남': 'geo_seep_zone' },
    encounterChance: 0.8, mapX: 10, mapY: 7,
  },
  {
    id: 'toxic_pipe_junction',
    name: '독소 배관 교차지점',
    description: '산성 액체가 흐르는 대형 독소 배관 지대.',
    exits: { '남': 'east_gate', '북': 'bio_lab_ruins', '동': 'industrial_control' },
    encounterChance: 0.8, mapX: 7, mapY: 4,
  },
  {
    id: 'industrial_control',
    name: '중앙 제어실',
    description: '바닥과 벽에 가득한 콘솔과 모니터. 해킹된 랩 데이터가 주파수를 타고 흐른다.',
    exits: { '서': 'toxic_pipe_junction', '남': 'factory_floor_b' },
    encounterChance: 0.5, mapX: 8, mapY: 4,
  },
  {
    id: 'bio_lab_ruins',
    name: '비오 실험실 폐허',
    description: '파괴된 시험대와 스스로 진화한 생체들이 넘치는 곳.',
    exits: { '남': 'toxic_pipe_junction' },
    encounterChance: 0.9, mapX: 7, mapY: 3,
  },

  // ─────── 구역 7: 서부 황야지대 ───────
  {
    id: 'west_outpost',
    name: '서부 황야지 초소',
    description: '허물어져가는 철제 무인 전망대.',
    exits: { '동': 'underground_arena', '남': 'scorch_plain', '서': 'rust_canyon' },
    encounterChance: 0.35, mapX: 1, mapY: 4,
  },
  {
    id: 'scorch_plain',
    name: '불타는 철 평원',
    description: '각질 평원. 거대한 무언가가 바닥에 웅크리고 있다.',
    exits: { '북': 'west_outpost', '남': 'dead_river', '동': 'charcoal_forest' },
    encounterChance: 0.6, mapX: 1, mapY: 5,
  },
  {
    id: 'charcoal_forest',
    name: '숯가루 수풀',
    description: '탄화된 철제 나무들이 가득한 검은 숲. 북쪽으로 잿빛 연기가 피어 오른다.',
    exits: { '서': 'scorch_plain', '남': 'dead_river', '동': 'rusty_alley', '북': 'ash_vanguard_path' },
    encounterChance: 0.7, mapX: 2, mapY: 5,
  },
  {
    id: 'dead_river',
    name: '말라붙은 지하 수로',
    description: '오염된 액체가 바닥에 굳어 있는 막혀붙은 지하 수로.',
    exits: { '북': 'charcoal_forest', '서': 'rust_canyon' },
    encounterChance: 0.75, mapX: 1, mapY: 6,
  },
  {
    id: 'rust_canyon',
    name: '철 캐니언',
    description: '무너진 도시 잔해들이 쌓인 거대한 계곡.',
    exits: { '동': 'dead_river', '남': 'sulfur_cavern' },
    encounterChance: 0.8, mapX: 0, mapY: 6,
  },
  {
    id: 'sulfur_cavern',
    name: '황 동굴',
    description: '노란 황 수증기가 가득한 동굴.',
    exits: { '북': 'rust_canyon' },
    encounterChance: 0.95, mapX: 0, mapY: 7,
  },

  // ─────── 구역 8: 슬럼 심층부 & 지하 동굴 ───────
  {
    id: 'lower_slum_path',
    name: '하층 슬럼 도로',
    description: '폐인들이 가득한 지하 슬럼 부세도로.',
    exits: { '북': 'deep_abyss', '동': 'flooded_tunnel', '서': 'broken_pipe_alley' },
    encounterChance: 0.45, mapX: 4, mapY: 8,
  },
  {
    id: 'flooded_tunnel',
    name: '침수된 터널',
    description: '무릎까지 차오른 침수 터널. 다리에 얼음이 어른거린다.',
    exits: { '서': 'lower_slum_path', '동': 'crystal_cave' },
    encounterChance: 0.55, mapX: 5, mapY: 8,
  },
  {
    id: 'crystal_cave',
    name: '합성 수정 동굴',
    description: '형광빛 합성 수정이 동굴 벽을 덮은 소름 돋는 곳.',
    exits: { '서': 'flooded_tunnel', '동': 'sub_reactor', '남': 'ancient_bunker' },
    encounterChance: 0.65, mapX: 6, mapY: 8,
  },
  {
    id: 'sub_reactor',
    name: '소형 리액터',
    description: '지하 깊숙이 묻힌 소형 방사능 리액터.',
    exits: { '서': 'crystal_cave', '동': 'forbidden_lab' },
    encounterChance: 0.8, mapX: 7, mapY: 8,
  },
  {
    id: 'forbidden_lab',
    name: '[금지] 연구 실험실',
    description: '국제법으로 금지된 실험이 진행된 음침한 연구소.',
    exits: { '남': 'broken_reactor', '서': 'sub_reactor' },
    encounterChance: 0.45, mapX: 9, mapY: 8,
  },
  {
    id: 'ancient_bunker',
    name: '그 시절의 벙커',
    description: '2040년대 전쟁 당시 구축된 지하 벙커.',
    exits: { '북': 'crystal_cave' },
    encounterChance: 0.6, mapX: 6, mapY: 9, isSafe: true,
  },
  {
    id: 'broken_pipe_alley',
    name: '파열된 배수관 골목',
    description: '수증기가 얼굴을 덮는 끝없는 골목.',
    exits: { '동': 'lower_slum_path', '서': 'sewage_crossroads' },
    encounterChance: 0.4, mapX: 3, mapY: 8,
  },
  {
    id: 'sewage_crossroads',
    name: '하수 교차로',
    description: '다방향 오염수가 흐르는 교차로.',
    exits: { '동': 'broken_pipe_alley', '서': 'silent_maze', '남': 'drain_terminal' },
    encounterChance: 0.5, mapX: 2, mapY: 8,
  },
  {
    id: 'drain_terminal',
    name: '대형 연동 말단',
    description: '도시 연동 말단점.',
    exits: { '북': 'sewage_crossroads' },
    encounterChance: 0.7, mapX: 2, mapY: 9,
  },
  {
    id: 'silent_maze',
    name: '소리 없는 미로',
    description: '소리가 전혀 나지 않는 지하 미로.',
    exits: { '동': 'sewage_crossroads', '서': 'ghost_terminal', '남': 'silent_rest_area' },
    encounterChance: 0.75, mapX: 1, mapY: 8,
  },
  {
    id: 'silent_rest_area',
    name: '침묵의 휴식 구역',
    description: '미로 한켠이 무너지며 생긴 작은 안식처. 희미한 비상등 아래에서 잠시 숨을 고를 수 있다. 안전지대(휴식 가능).',
    exits: { '북': 'silent_maze' },
    encounterChance: 0, mapX: 1, mapY: 9, isSafe: true,
  },
  {
    id: 'ghost_terminal',
    name: '유령 단말기 터릿',
    description: '방치된 단말기들이 전원이 켜진 이상한 곳.',
    exits: { '동': 'silent_maze' },
    encounterChance: 0.9, mapX: 0, mapY: 8,
  },

  // ─────── 구역 9: 상층 아르카디아 & 메가코프 ───────
  {
    id: 'neon_sky_lounge',
    name: '네온 스카이 라운지',
    description: '아르카디아 여유 계층이 방문하는 아름다운 스카이 바.',
    exits: { '남': 'arcadia_central', '동': 'holo_market', '북': 'elite_corridor' },
    encounterChance: 0.15, mapX: 7, mapY: -3,
  },
  {
    id: 'holo_market',
    name: '홀로 거래소',
    description:
      '홀로그램으로 거래되는 상점가. 한켠에 스모그에 가려진 부스에서 [베일 크립트]가 "블라인드" 장비 뽑기를 부추긴다 — 확정 옵션은 구매 후에야 드러난다.',
    exits: { '서': 'neon_sky_lounge', '동': 'chrome_clinic_pro', '남': 'mega_plaza' },
    encounterChance: 0.2, mapX: 8, mapY: -1, isSafe: true,
  },
  {
    id: 'chrome_clinic_pro',
    name: '크롬 프리미엄 시술소',
    description: '세계 수준의 크롬 수술이 수행되는 컴플렉스.',
    exits: { '서': 'holo_market', '북': 'elite_corridor' },
    encounterChance: 0.0, mapX: 9, mapY: -1, isSafe: true,
  },
  {
    id: 'elite_corridor',
    name: '엘리트 보호 복도',
    description: '방탄 유리로 된 무장 연락소.',
    exits: { '남': 'neon_sky_lounge', '동': 'apex_tower_lobby' },
    encounterChance: 0.5, mapX: 7, mapY: -2,
  },
  {
    id: 'mega_plaza',
    name: '메가 광장',
    description: '홀로그람 조형물이 중앙을 지키는 광장.',
    exits: { '북': 'holo_market', '동': 'upper_arcadia', '남': 'arcadia_central' },
    encounterChance: 0.25, mapX: 8, mapY: 0,
  },
  {
    id: 'upper_arcadia',
    name: '상위 아르카디아 동',
    description: '에너지로 충만한 실내.',
    exits: { '서': 'mega_plaza', '동': 'executive_suite' },
    encounterChance: 0.4, mapX: 9, mapY: 0,
  },
  {
    id: 'executive_suite',
    name: '고위 임원실',
    description: '360도 유리제 전망소.',
    exits: { '서': 'upper_arcadia' },
    encounterChance: 0.8, mapX: 10, mapY: 0,
  },
  {
    id: 'apex_tower_lobby',
    name: '에이펙스 타워 로비',
    description: '가장 높은 타워 입구의 미래형 로비.',
    exits: { '서': 'elite_corridor', '북': 'server_dungeon', '동': 'quantum_bridge' },
    encounterChance: 0.6, mapX: 8, mapY: -2,
  },
  {
    id: 'server_dungeon',
    name: '서버 던전',
    description: '굉음을 내는 서버 랙이 가득한 도시의 두뇌.',
    exits: { '남': 'apex_tower_lobby', '동': 'lost_signals_room' },
    encounterChance: 0.7, mapX: 8, mapY: -3,
  },
  {
    id: 'lost_signals_room',
    name: '신호 단절 구역',
    description: '마지막 신호가 끊긴 말단 지점.',
    exits: { '서': 'server_dungeon' },
    encounterChance: 0.95, mapX: 9, mapY: -3,
  },
  {
    id: 'quantum_bridge',
    name: '양자 다리',
    description: '양자 컴퓨팅 기술로 유지되는 다리.',
    exits: { '서': 'apex_tower_lobby' },
    encounterChance: 0.85, mapX: 9, mapY: -2,
  },

  // ─────── 구역 10: 북부 선산 & 최전선 ───────
  {
    id: 'northern_checkpoint',
    name: '북부 선산 검문소',
    description: '도시 북측 끝에 자리한 검문소 입구.',
    exits: { '남': 'hyper_bridge', '동': 'northern_slum', '서': 'mountain_base' },
    encounterChance: 0.4, mapX: 3, mapY: -1,
  },
  {
    id: 'mountain_base',
    name: '산록 기지부',
    description: '산식물들이 얽힌 기지.',
    exits: { '동': 'northern_checkpoint', '남': 'outskirt_garrison', '서': 'frozen_ridge' },
    encounterChance: 0.5, mapX: 2, mapY: -1,
  },
  {
    id: 'frozen_ridge',
    name: '동결된 등성',
    description: '얼음 조각이 널려있는 등성.',
    exits: { '동': 'mountain_base', '서': 'blizzard_camp' },
    encounterChance: 0.65, mapX: 1, mapY: -1,
  },
  {
    id: 'blizzard_camp',
    name: '눈보라 속 비영지',
    description: '폭풍으로 텐트의 일부만 보인다.',
    exits: { '동': 'frozen_ridge' },
    encounterChance: 0.85, mapX: 0, mapY: -1,
  },
  {
    id: 'northern_slum',
    name: '파기된 북구 슬럼',
    description: '주거 기능이 없는 북구지역 슬럼.',
    exits: { '서': 'northern_checkpoint', '동': 'frozen_canal' },
    encounterChance: 0.5, mapX: 4, mapY: -1,
  },
  {
    id: 'frozen_canal',
    name: '얼어붙은 운하',
    description: '얼어붙은 운하의 일대.',
    exits: { '서': 'northern_slum' },
    encounterChance: 0.7, mapX: 4, mapY: -2,
  },
  {
    id: 'outskirt_garrison',
    name: '구식 주둔지',
    description: '접경 기능을 유지하는 구식 주둔지.',
    exits: { '북': 'mountain_base', '남': 'smuggler_route' },
    encounterChance: 0.45, mapX: 2, mapY: 0,
  },

  // ─────── 구역 11: 잿빛 항구 (성벽·마을) ───────
  {
    id: 'ash_vanguard_path',
    name: '잿빛 전초 보도',
    description: '숯 숲 북쪽으로 이어지는 산업 폐기물 도로. 멀리 녹슨 크레인 실루엣이 보인다.',
    exits: { '남': 'charcoal_forest', '동': 'ash_port_scrap_dunes' },
    encounterChance: 0.55, mapX: 2, mapY: 4,
  },
  {
    id: 'ash_port_scrap_dunes',
    name: '고철 듄 구역',
    description: '선박 골조와 컨테이너 잔해가 쌓인 회색 모래밭.',
    exits: { '서': 'ash_vanguard_path', '북': 'ash_port_wall_gate' },
    encounterChance: 0.62, mapX: 3, mapY: 4,
  },
  {
    id: 'ash_port_wall_gate',
    name: '잿빛 항구 성벽 관문',
    description:
      '합금 격자와 폐회로 카메라가 얹인 관문. 안쪽은 피난민 마을이다. 성벽이 서 있을 때 적대 세력은 이 문 너머로 들어가지 못한다. (플레이어는 통과 가능)',
    exits: { '남': 'ash_port_scrap_dunes', '북': 'ash_port_village' },
    encounterChance: 0.35, mapX: 3, mapY: 3,
    elevation: 1,
  },
  {
    id: 'ash_port_village',
    name: '잿빛 항구 마을',
    description: '낡은 방수포와 모듈 주택이 모인 작은 안식처. 휴식이 가능한 거점이다.',
    exits: { '남': 'ash_port_wall_gate' },
    encounterChance: 0, mapX: 3, mapY: 2, isSafe: true,
  },

  // ─────── 구역 12: 지열 파이프 마을 (성벽·마을) ───────
  {
    id: 'geo_seep_zone',
    name: '지열 스팀 슬릿',
    description: '지면에서 증기가 솟구치는 균열 지대. 배관 로스트앤드가 이어진다.',
    exits: { '북': 'electromagnetic_zone', '동': 'geo_pipe_break' },
    encounterChance: 0.72, mapX: 10, mapY: 8,
  },
  {
    id: 'geo_pipe_break',
    name: '파열 지열 배관',
    description: '녹슨 압력관이 터져 붉은 안개가 자욱하다.',
    exits: { '서': 'geo_seep_zone', '북': 'geo_wall_gate' },
    encounterChance: 0.68, mapX: 11, mapY: 8,
  },
  {
    id: 'geo_wall_gate',
    name: '지열 마을 성벽',
    description:
      '방열 합금으로 덮인 이중 관문. 너머는 지열 에너지를 쓰는 소규모 정착지다. 성벽이 버틸 동안 적대 세력은 마을로 진입할 수 없다.',
    exits: { '남': 'geo_pipe_break', '북': 'geo_village_safe' },
    encounterChance: 0.4, mapX: 11, mapY: 7,
    elevation: 1,
  },
  {
    id: 'geo_village_safe',
    name: '지열 파이프 마을',
    description: '스팀으로 난방되는 캡슐 주택가. 휴식이 가능한 거점이다.',
    exits: { '남': 'geo_wall_gate' },
    encounterChance: 0, mapX: 11, mapY: 6, isSafe: true,
  },
];

// WHY: 맵 규모를 약 10배로 확장한 구역. 기존 구역에서 문으로 연결된다.
import { ROOMS_EXPANDED } from './roomsExpanded';
import { ROOMS_EXPANDED_BULK } from './roomsExpandedBulk';

export const ROOMS: Room[] = [...ROOMS_BASE, ...ROOMS_EXPANDED, ...ROOMS_EXPANDED_BULK];

// 방 ID로 방 데이터 찾기
export function getRoomById(id: string): Room | undefined {
  return ROOMS.find(r => r.id === id);
}

/** 방 고도 (미지정 시 0 = 지면) — 사거리·고저 전투 보정에 사용 */
export function getRoomElevation(roomId: string): number {
  const r = getRoomById(roomId);
  const e = r?.elevation;
  return typeof e === 'number' && e > 0 ? Math.floor(e) : 0;
}

/** 1파트(구역 1: 시작 구역) 방 ID — 여기선 속성 DoT가 낮게 적용됨 */
export const PART_1_ROOM_IDS: readonly string[] = [
  'slum_market', 'rusty_alley', 'abandoned_factory_gate', 'conveyor_maze', 'clinic',
  'hidden_staircase', 'deep_abyss', 'corridor', 'boiler_dead_end', 'underground_plaza',
  'black_market_entrance', 'underground_arena', 'abandoned_subway',
];

/** 방 ID → 구역 번호 (1~10). 미등록 방은 1로 간주해 속성 데미지 낮춤 */
const ROOM_TO_ZONE: Record<string, number> = {
  // 구역 1
  slum_market: 1, rusty_alley: 1, abandoned_factory_gate: 1, conveyor_maze: 1, clinic: 1,
  hidden_staircase: 1, deep_abyss: 1, corridor: 1, boiler_dead_end: 1, underground_plaza: 1,
  black_market_entrance: 1, underground_arena: 1, abandoned_subway: 1,
  bulk_terminal_vault: 1, // 심층 벌크 최하단 — 슬럼·지하 연장과 동일 구역(구역 지도 묶음)
  // 구역 2
  deep_sewer: 2, mutant_lair: 2, queen_chamber: 2, toxic_swamp: 2,
  // 구역 3
  back_alley_lab: 3, neon_alley: 3, neon_fat_stall: 3, ramen_storage: 3, club_neon: 3,
  // 구역 4
  ruined_alley_dead_end: 4, zeros_hideout: 4, red_dragon_turf: 4, smuggler_route: 4, hongdae_station: 4,
  arcadia_watchtower: 4, arcadia_central: 4, cyber_clinic: 4, corporate_lobby: 4, arcadia_roof: 4,
  skybridge: 4, data_center: 4, secret_catacomb: 4,
  // 구역 5
  hyper_bridge_entrance: 5, hyper_bridge: 5, shinchon_rad_zone: 5, wasteland_edge: 5,
  crashed_ship: 5, wasteland_dunes: 5, end_of_world: 5,
  // 구역 6
  east_gate: 6, factory_floor_a: 6, factory_floor_b: 6, heavy_storage: 6, mech_graveyard: 6,
  reactor_core: 6, electromagnetic_zone: 6, toxic_pipe_junction: 6, industrial_control: 6, bio_lab_ruins: 6,
  // 구역 7
  west_outpost: 7, scorch_plain: 7, charcoal_forest: 7, dead_river: 7, rust_canyon: 7, sulfur_cavern: 7,
  // 구역 8
  lower_slum_path: 8, flooded_tunnel: 8, crystal_cave: 8, sub_reactor: 8, forbidden_lab: 8, ancient_bunker: 8,
  broken_pipe_alley: 8, sewage_crossroads: 8, drain_terminal: 8, silent_maze: 8, silent_rest_area: 8, ghost_terminal: 8,
  // 구역 9
  neon_sky_lounge: 9, holo_market: 9, chrome_clinic_pro: 9, elite_corridor: 9, mega_plaza: 9,
  upper_arcadia: 9, executive_suite: 9, apex_tower_lobby: 9, server_dungeon: 9, lost_signals_room: 9, quantum_bridge: 9,
  // 구역 10
  northern_checkpoint: 10, mountain_base: 10, frozen_ridge: 10, blizzard_camp: 10, northern_slum: 10, frozen_canal: 10, outskirt_garrison: 10,
  // 구역 11~12 (성벽·마을)
  ash_vanguard_path: 11, ash_port_scrap_dunes: 11, ash_port_wall_gate: 11, ash_port_village: 11,
  geo_seep_zone: 12, geo_pipe_break: 12, geo_wall_gate: 12, geo_village_safe: 12,
};

/** 방 ID로 구역 번호 반환 (1~12+). 확장 맵 등 미등록 방은 1 */
export function getZoneForRoom(roomId: string): number {
  return ROOM_TO_ZONE[roomId] ?? 1;
}

/** 구역 지도(전체 맵) 오버레이 헤더 — 플레이어가 위치 파악하기 쉬운 짧은 이름 */
export const ZONE_MAP_LABELS: Record<number, string> = {
  1: '1구역 — 슬럼·지하·연장',
  2: '2구역 — 하수도·변이',
  3: '3구역 — 네온 뒷골목',
  4: '4구역 — 아르카디아 외곽',
  5: '5구역 — 황무지·브릿지',
  6: '6구역 — 동부 산업',
  7: '7구역 — 서부 황야',
  8: '8구역 — 슬럼 심층',
  9: '9구역 — 상층 메가코프',
  10: '10구역 — 북부 전선',
  11: '11구역 — 잿빛 항구',
  12: '12구역 — 지열 마을',
};

/**
 * 현재 방 기준으로 「구역 지도」에 표시할 방 목록.
 * - 벌크 미로(bulk_N_*)는 해당 N 스트립만 표시(14줄×50방 중 한 줄).
 * - 그 외에는 world_zone 번호가 같은 비벌크 방 전부(미니맵과 달리 거리 제한 없음).
 */
export function getRoomsForZoneMap(currentRoomId: string): Room[] {
  const bulk = /^bulk_(\d+)_/.exec(currentRoomId);
  if (bulk) {
    const zi = bulk[1]!;
    return ROOMS.filter((r) => r.id.startsWith(`bulk_${zi}_`));
  }
  const z = getZoneForRoom(currentRoomId);
  return ROOMS.filter((r) => !r.id.startsWith('bulk_') && getZoneForRoom(r.id) === z);
}

/** 구역 지도 창 제목 */
export function getZoneMapTitle(currentRoomId: string): string {
  const bulk = /^bulk_(\d+)_/.exec(currentRoomId);
  if (bulk) {
    const zi = parseInt(bulk[1]!, 10);
    return `심층 벌크 통로 ${zi + 1}/14`;
  }
  const z = getZoneForRoom(currentRoomId);
  return ZONE_MAP_LABELS[z] ?? `구역 ${z}`;
}

// 초기 시작 방
export const STARTING_ROOM_ID = 'clinic';

// 방향 반대 방향
export const OPPOSITE_DIR: Record<string, string> = {
  '북': '남', '남': '북', '동': '서', '서': '동'
};

/** 이동 로그·미니맵에서 출구를 항상 같은 순서로 표시하기 위한 순서 (북→남→동→서) */
export const EXIT_DISPLAY_ORDER: readonly ('북'|'남'|'동'|'서')[] = ['북', '남', '동', '서'];

/** 방의 출구 방향 목록을 이동 로그/미니맵과 동일한 순서로 반환 */
export function getExitsInDisplayOrder(exits: Room['exits']): string[] {
  if (!exits) return [];
  return EXIT_DISPLAY_ORDER.filter(d => exits[d]).filter(Boolean);
}

/** 안전지대까지의 최소 이동 칸 수 (BFS). 해당 방이 안전지대면 0, 인접 1, 그다음 2… 최대 15칸까지 탐색, 못 찾으면 99 */
export function getMinDistanceFromSafeZone(roomId: string): number {
  const room = getRoomById(roomId);
  if (!room) return 99;
  if (room.isSafe) return 0;
  const visited = new Set<string>([roomId]);
  const queue: { id: string; steps: number }[] = [{ id: roomId, steps: 0 }];
  const maxSteps = 15;
  while (queue.length > 0) {
    const { id, steps } = queue.shift()!;
    const r = getRoomById(id);
    if (!r?.exits) continue;
    const nextSteps = steps + 1;
    if (nextSteps > maxSteps) continue;
    for (const dir of EXIT_DISPLAY_ORDER) {
      const nextId = r.exits[dir];
      if (!nextId || visited.has(nextId)) continue;
      visited.add(nextId);
      const nextRoom = getRoomById(nextId);
      if (nextRoom?.isSafe) return nextSteps;
      queue.push({ id: nextId, steps: nextSteps });
    }
  }
  return 99;
}
