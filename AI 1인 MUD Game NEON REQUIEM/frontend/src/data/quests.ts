export interface QuestDefinition {
  id: string;
  npcId: string;
  title: string;
  description: string;
  type: 'kill' | 'fetch';
  targetId: string; // enemy id or item name
  requiredCount: number;
  reward: { exp?: number; credit?: number; items?: string[] };
  dialogue: {
    start: string;
    progress: string;
    complete: string;
  };
}

// 퀘스트 데이터 (NPC 퀘스트 목록)
export const QUESTS: Record<string, QuestDefinition> = {
  'oni_q1': {
    id: 'oni_q1',
    npcId: 'oni',
    title: '뒷골목 청소',
    description: '쿠로사키 오니가 글리치 바이러스 3마리를 처치해 달라고 부탁했습니다.',
    type: 'kill',
    targetId: 'glitch_virus',
    requiredCount: 3,
    reward: { exp: 50, credit: 150, items: ['독의 반지'] },
    dialogue: {
      start: '요즘 글리치 바이러스 녀석들이 뒷골목에 너무 많아졌어. 3마리만 청소해주면 보수를 섭섭지 않게 주지.',
      progress: '아직 멀었나? 글리치 바이러스를 더 잡아와.',
      complete: '수고했어. 역시 솜씨가 좋군. 약속한 보상이다.',
    }
  },
  'queen_q1': {
    id: 'queen_q1',
    npcId: 'ghostQueen',
    title: '가면의 조각 수집',
    description: '고스트 퀸이 아케이드 구역의 홀로그램 조각을 수집해 달라고 합니다.',
    type: 'fetch',
    targetId: '홀로그램 조각',
    requiredCount: 1,
    reward: { exp: 100, credit: 0, items: ['파이어볼 스킬북', '불의 반지'] },
    dialogue: {
      start: '저 너머의 방에 떨어진 홀로그램 조각을 가져다준다면, 내 마법의 일부를 전수해주지.',
      progress: '파편은 아직 못 구했나?',
      complete: '훌륭해. 이 조각은 데이터의 바다를 안정시킬 거야. 자, 약속한 마법 지식이다.',
    }
  },
  'main_q_boss1': {
    id: 'main_q_boss1',
    npcId: 'neonFat',
    title: '강제 돌파',
    description: '네온 팻이 말하길, 다음 구역으로 가려면 사이버 데몬을 쓰러뜨리고 키 카드를 빼앗아야 한다고 합니다.',
    type: 'fetch',
    targetId: 'A구역 보안 키',
    requiredCount: 1,
    reward: { exp: 200, credit: 300, items: ['회복의 빛 스킬북', '원소 저항 목걸이'] },
    dialogue: {
      start: '너, 그곳으로 가려는 거야? 사이버 데몬이라는 무식한 놈이 길을 막고 있어. 그놈이 가진 [A구역 보안 키]를 빼앗아와!',
      progress: '키 카드는 어디 있어? 설마 쫄아서 도망친 건 아니지?',
      complete: '오! 그놈을 정말 쓰러뜨렸군! 이거, 내가 아끼는 스킬북 하나 주지.',
    }
  },

  // ─── 메인 스토리 퀘스트 라인 (아르카디아 침투) ─────────────────────────────
  'main_q_intro': {
    id: 'main_q_intro',
    npcId: 'eden',
    title: '감시망의 틈',
    description: '에덴이 아르카디아 감시망의 일시적인 허점을 알려주며, 특정 구역의 글리치 신호를 추적해 오라고 한다.',
    type: 'kill',
    targetId: 'glitch_virus',
    requiredCount: 5,
    reward: { exp: 120, credit: 100 },
    dialogue: {
      start: '비인가 신호가 슬럼 구역에서 감지되었습니다. "글리치 바이러스" 개체 5기를 제거하고, 그 데이터 로그를 회수해 오십시오.',
      progress: '아직 감염 개체가 남아있습니다. 네트워크의 안정성을 위해 빠르게 처리해야 합니다.',
      complete: '로그 수신 완료. 예측보다 뛰어난 전투 데이터를 보여주는군요. 이 성과는 상부에 보고될 것입니다.',
    }
  },
  'main_q_trace': {
    id: 'main_q_trace',
    npcId: 'ghostQueen',
    title: '백도어 흔적',
    description: '고스트 퀸이 에덴이 모은 로그 속에서 백도어 흔적을 발견했다. 아르카디아 쪽 [중화전 물류창고]에 가서 반드시 조사해 [손상된 백도어 칩]을 가져와야 한다.',
    type: 'fetch',
    targetId: '손상된 백도어 칩',
    requiredCount: 1,
    reward: { exp: 160, credit: 150, items: ['라이트닝 볼트 스킬북'] },
    dialogue: {
      start: '에덴이 준 로그, 그 안에 흥미로운 백도어 흔적이 있어. 아르카디아 구역의 [중화전 물류창고]에 가서 그 방에서만 [조사]를 해봐. 거기에 [손상된 백도어 칩]이 있어.',
      progress: '백도어 칩은 중화전 물류창고에서 조사해야만 나와. 다른 데선 못 구해.',
      complete: '좋아, 바로 이 신호야. 이 칩 덕분에 아르카디아 방화벽에 작은 구멍을 낼 수 있겠어.',
    }
  },
  'main_q_gateprep': {
    id: 'main_q_gateprep',
    npcId: 'ironJack',
    title: '관문 돌파 준비',
    description: '아이언 잭이 아르카디아 관문을 뚫기 위한 장비를 주문하며, 특정 적을 처리하고 파츠를 가져오라고 한다.',
    type: 'kill',
    targetId: 'arcadia_guard',
    requiredCount: 4,
    reward: { exp: 220, credit: 400, items: ['강철의 반지'] },
    dialogue: {
      start: '관문을 부수고 싶다면 화력이 필요하지. 아르카디아 경비 드론들 몇 기를 해체해서 파츠를 가져와. 실전 데이터도 같이 모으자고.',
      progress: '경비 드론은 생각보다 질겨. 넷 정도면 내 계산에 충분한 데이터가 쌓일 거야.',
      complete: '이 정도 파츠면 포문을 열 장치를 뽑아낼 수 있겠군. 네가 길을 열고, 난 폭발을 책임지지.',
    }
  },

  // ─── 단발성 일일/서브 퀘스트 ────────────────────────────────────────────────
  'oni_q2': {
    id: 'oni_q2',
    npcId: 'oni',
    title: '빚진 놈의 사이버 팔',
    description: '쿠로사키 오니가 빚지고 도망친 용병에게서 사이버 팔을 회수해 달라고 한다.',
    type: 'kill',
    targetId: 'marecorp_specops_a',
    requiredCount: 1,
    reward: { exp: 80, credit: 200 },
    dialogue: {
      start: '레드 드래곤에 손 댔다가 줄행랑친 놈이 있어. "마레콥 특수부대" 출신이지. 그놈을 쓰러뜨리고, 하얀 사이버 팔만 잘 챙겨와.',
      progress: '쫓기는 놈은 언제나 더 잔인해지지. 주저하다간 네가 먼저 잘릴 거다.',
      complete: '팔은 멀쩡하군. 이제 이식만 하면 되겠어. 너도 한 번 생각 있나? 농담이다, 보상이나 챙겨.',
    }
  },
  'lira_q1': {
    id: 'lira_q1',
    npcId: 'lira',
    title: '마취약은 언제나 부족하다',
    description: '리라가 수술용 마취약 대신 쓸 수 있는 약품을 구해 달라고 한다.',
    type: 'fetch',
    targetId: '수상한 진통제',
    requiredCount: 1,
    reward: { exp: 60, credit: 120, items: ['작은 파란 포션'] },
    dialogue: {
      start: '마취약 재고가 바닥났어. 대신 쓸 수 있는 [수상한 진통제]를 구해와. 슬럼 약국 애들이 몰래 빼돌린 게 있을 거야.',
      progress: '아직도 빈 주사기만 들고 온 건 아니지? 진통제 없이는 환자들이 기절하거나 날뛰거나 둘 중 하나야.',
      complete: '좋아, 이 정도면 오늘은 비명 소리를 덜 듣겠군. 수고비로 포션 하나 얹어줄게.',
    }
  },
  'lira_q2': {
    id: 'lira_q2',
    npcId: 'lira',
    title: '잊힌 지하실의 기록',
    description:
      '리라가 슬럼 서쪽 [잊힌 지하실] 안쪽, [지하실 깊은 곳]에서만 조사로 얻을 수 있는 [곰팡이 핀 연구 자료]를 가져다 달라고 한다.',
    type: 'fetch',
    targetId: '곰팡이 핀 연구 자료',
    requiredCount: 1,
    reward: { exp: 72, credit: 135, items: ['빨간 포션', '작은 파란 포션'] },
    dialogue: {
      start:
        '옛 의료 코퍼 구역에 봉인해 둔 [잊힌 지하실] 알지? 더 들어가면 [지하실 깊은 곳]까지 있어. 거기 바닥 근처에 자료 더미가 묻혀 있다더라. [조사]로만 나오는 [곰팡이 핀 연구 자료] 한 꾸러미만 가져와. 바이오 임플란트 부작용 추적에 필요해.',
      progress:
        '[잊힌 지하실] → [지하실 깊은 곳]. 그 방에서만 [조사]하면 나와. 다른 상자나 쓰레기통에서 난 게 아니라, 반드시 그 깊은 곳이야.',
      complete:
        '군더더기 데이터도 많지만… 이 혈청 배치 번호만으로도 오늘 밤 지옥을 조금 덜 볼 수 있겠어. 약속한 보상이야, 거친 일 해줘서 고마워.',
    },
  },
  'shadowRat_q1': {
    id: 'shadowRat_q1',
    npcId: 'shadowRat',
    title: '고철 더미의 보물',
    description: '쉐도우 래트가 고철 더미 속 값나가는 부품 하나만 찾아오면 반값으로 거래해 주겠다고 한다.',
    type: 'fetch',
    targetId: '희귀 기판 조각',
    requiredCount: 1,
    reward: { exp: 70, credit: 180 },
    dialogue: {
      start: '고철 더미에 박혀 있는 [희귀 기판 조각]이란 게 있어. 그거 하나만 건져오면 오늘 거래는 반값으로 봐주지.',
      progress: '고철 냄새 좀 맡았나? 찾기만 하면 대박이야.',
      complete: '이거지! 이런 기판은 코퍼들만 만지던 거라고. 약속대로 크레딧 챙겨가.',
    }
  },
  'dreamweaver_q1': {
    id: 'dreamweaver_q1',
    npcId: 'dreamweaver',
    title: '깨진 꿈의 샘플',
    description: '드림웨이버가 불량 뇌파 칩을 회수해 달라고 한다.',
    type: 'fetch',
    targetId: '불량 뇌파 칩',
    requiredCount: 1,
    reward: { exp: 90, credit: 150 },
    dialogue: {
      start: '내 네트워크를 흉내 내는 싸구려 칩들이 돌아다니는 모양이야. [불량 뇌파 칩] 하나만 가져와. 어떻게 망가졌는지 보고 싶거든.',
      progress: '그 칩을 쓰고 나서 눈을 못 뜬 애들이 몇 있다더라. 조심해서 다뤄.',
      complete: '역시 싸구려군. 덕분에 보정값은 좀 더 정확해지겠어. 이건 실험 협력비라고 생각해.',
    }
  },

  // ─── 특정 장소 조사 전용 퀘스트 (해당 방에서 '조사'로만 획득 가능) ─────────────────
  'mysterio_q1': {
    id: 'mysterio_q1',
    npcId: 'mysterio',
    title: '서버 로그 회수',
    description: '미스테리오가 아르카디아 데이터 센터(양자 코어 메인프레임)에 가서 조사해 [오래된 서버 로그 칩]을 가져오라고 한다.',
    type: 'fetch',
    targetId: '오래된 서버 로그 칩',
    requiredCount: 1,
    reward: { exp: 110, credit: 200, items: ['암흑의 반지'] },
    dialogue: {
      start: '아르카디아 쪽 "양자 코어 메인프레임"이란 데이터 센터 알아? 그 방에 가서 반드시 [조사]를 해봐. 거기에 [오래된 서버 로그 칩]이 남아 있을 거야. 그걸 가져다주면 보상은 톡톡히 해주지.',
      progress: '데이터 센터, 양자 코어 메인프레임. 그 방에서만 조사하면 나오는 칩이야. 다른 데선 못 구해.',
      complete: '이거지. 이 로그면 블랙 스파이더 쪽 거래 몇 개는 정리할 수 있겠어. 약속한 보상이다.',
    }
  },
};
