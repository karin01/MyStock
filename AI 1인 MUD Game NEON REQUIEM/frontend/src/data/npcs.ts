export interface NpcState {
  reputation: number;
  relationship: string;
  metBefore: boolean;
}

export const initialNpcState: Record<string, NpcState> = {
  oni: { reputation: 0, relationship: 'Neutral', metBefore: false },
  ghostQueen: { reputation: 0, relationship: 'Curious', metBefore: false },
  mysterio: { reputation: 0, relationship: 'Merchant', metBefore: false },
  eden: { reputation: 0, relationship: 'Voice', metBefore: false },
  lira: { reputation: 0, relationship: 'Doctor', metBefore: false },
  zeros: { reputation: 0, relationship: 'Zealot', metBefore: false },
  silverPhantom: { reputation: 0, relationship: 'Hunter', metBefore: false },
  neonFat: { reputation: 0, relationship: 'Customer', metBefore: false },
  shadowRat: { reputation: 0, relationship: 'Neutral', metBefore: false },
  dreamweaver: { reputation: 0, relationship: 'Guardian', metBefore: false },
  ironJack: { reputation: 0, relationship: 'Merchant', metBefore: false },
  /** 홀로 거래소 블라인드 상인 — 실명·옵션은 구매 후 감정 */
  veilCrypt: { reputation: 0, relationship: 'Gambler', metBefore: false },
  jin: { reputation: 0, relationship: 'Master', metBefore: false },
  hana: { reputation: 0, relationship: 'Fixer', metBefore: false },
  /** 블랙 스파이더 정보 중개 — 미스테리오 라인과 맞닿은 네트워크 */
  karina: { reputation: 0, relationship: 'Broker', metBefore: false },
};

export const NPC_LIST = [
  { 
    id: 'oni', name: '쿠로사키 오니', faction: '레드 드래곤',
    dialogues: [
      "최근 아르카디아 놈들의 감시망이 짜증나게 촘촘해졌군.",
      "레드 드래곤의 구역에서 사고 치지 마라. 피값으로 갚게 될 테니.",
      "쓸 만한 무기가 있다면 챙겨둬라. 슬럼가에선 그것만이 유일한 법이니까.",
      "크롬 이식에 중독된 놈들을 조심해라. 뇌가 타버려 앞뒤 안 가리는 짐승이니까."
    ]
  },
  { 
    id: 'ghostQueen', name: '고스트 퀸', faction: '프리덤 네트워크',
    dialogues: [
      "내 시선은 네트워크의 모든 회로를 타고 흐르지.",
      "물리적인 몸은 제약일 뿐이야. 진정한 힘은 코드 안에 있어.",
      "아르카디아 센트럴의 메인프레임... 그 안에는 모든 해커들의 꿈이 잠들어 있지.",
      "데이터 무단 복제? 우리는 그걸 '정보의 해방'이라고 부르는 걸."
    ]
  },
  { 
    id: 'mysterio', name: '미스테리오', faction: '블랙 스파이더',
    dialogues: [
      "블랙 스파이더의 장부엔 기록되지 않는 거래가 없지.",
      "원하는 게 있나? 크레딧만 충분하다면 코퍼레이트 임원의 약점도 팔 수 있다.",
      "세상에 비밀은 없어. 오직 가격표만 있을 뿐.",
      "최근 뒷골목에 질이 나쁜 용병들이 흘러들어오고 있군. 장사하긴 좋지만..."
    ]
  },
  { 
    id: 'eden', name: '에덴', faction: '아르카디아',
    dialogues: [
      "아르카디아의 질서 아래 시민들은 평화를 누립니다.",
      "모든 불법 개조 시술소는 즉시 신고하여 주십시오.",
      "데이터 스크레이핑 시도는 아르카디아 보안 규정 위반입니다.",
      "인증되지 않은 구역에 진입하는 것은 매우 위험합니다. 권한을 업그레이드하세요."
    ]
  },
  { 
    id: 'lira', name: '리라', faction: '중립',
    dialogues: [
      "싸구려 임플란트는 결국 터지게 되어 있어. 그러니까 나한테 왔겠지?",
      "다친 곳을 잘라내고 강철을 붙이는 게 더 나을 수도 있는데. 어때?",
      "마취약이 떨어졌어. 이 악물고 참아보라고.",
      "레드 드래곤이나 아르카디아나... 다친 놈은 구별 없이 치료할 뿐이야. 돈만 내면."
    ]
  },
  { 
    id: 'zeros', name: '제로스', faction: '바이오 퓨리',
    dialogues: [
      "강철은 부식되고 녹슬 뿐! 진정한 진화는 유전자에 있다!!",
      "고통은 몸이 약함을 부정하는 과정일 뿐. 더 주입해!!",
      "너의 그 빈약한 육신을 보라! 우리와 함께 진정한 포식자가 되어보지 않겠나?",
      "아르카디아의 억압적인 체제는 곧 붕괴할 것이다! 돌연변이의 군단이 쓸어버릴 테니!"
    ]
  },
  { 
    id: 'silverPhantom', name: '실버 팬텀', faction: '아르카디아',
    dialogues: [
      "질서를 벗어난 자는 그림자 속에서 제거된다.",
      "내 블레이드가 지나간 자리는 노이즈만 남을 뿐이지.",
      "목표 확인. 불필요한 교전은 회피한다.",
      "슬럼가의 쥐새끼들이 너무 시끄럽군."
    ]
  },
  { 
    id: 'neonFat', name: '네온 팻', faction: '중립',
    dialogues: [
      "요즘은 오가닉 고기를 구하기가 힘들어. 다 합성 단백질 덩어리뿐이지.",
      "정보? 난 그냥 라멘을 팔 뿐이라고. (윙크)",
      "저기 길 모퉁이에 있는 쓰레기통 말이야... 밤마다 이상한 소리가 들린다니까.",
      "배고프면 언제든 들러. 크레딧만 있다면 특제 사이버 라멘을 대접하지."
    ]
  },
  { 
    id: 'shadowRat', name: '쉐도우 래트', faction: '레드 드래곤',
    dialogues: [
      "형씨, 뒤를 항상 조심하는 게 좋을 거야.",
      "버려진 구역엔 쓸만한 고철이 많단 말이지. 경쟁자가 문제지만.",
      "오늘도 재수 없는 날이군. 크레딧도 없고, 무기도 낡아빠졌어.",
      "아르카디아 놈들이 또 순찰을 강화했어. 우리 같은 쥐구멍 인생들은 살기 힘들군."
    ]
  },
  { 
    id: 'dreamweaver', name: '드림웨이버', faction: '프리덤 네트워크',
    dialogues: [
      "현실은 너무 차갑고 잔혹하지. 내가 보여주는 가상현실 뇌파 자극은 네 오감을 황홀하게 해줄 거야.",
      "고통을 잊고 싶은가? 뒷골목에서 파는 구형 칩보다는 내 네트워크가 더 선명해.",
      "모두가 네온 불빛 아래에서 길을 잃었지만, 난 그 빛으로 문을 만들지.",
      "네 머릿속 칩에 접속하게 해준다면, 평생 꾼 적 없는 환상을 보여주겠어... 물론 돈은 준비해둬."
    ]
  },
  { 
    id: 'ironJack', name: '아이언 잭', faction: '중립',
    dialogues: [
      "크레딧만 넉넉하다면 아르카디아 총독의 머리통을 날릴 무기도 구해다 주지.",
      "내 물건은 싸구려 배터리와 달라. 확실하게 목숨을 앗아가거든.",
      "쓸 만한 고철이라도 있으면 가져와 봐. 헐값이라도 지불할 테니.",
      "이 바닥에서 믿을 건 두툼한 장갑과 확실한 화력뿐이야. '거래'를 원하면 언제든 말해."
    ]
  },
  {
    id: 'veilCrypt',
    name: '베일 크립트',
    faction: '중립',
    dialogues: [
      '베일 뒤의 번호를 고르게. 크레딧은 홀로그램처럼 증발하고, 주머니엔 "뭔가"만 남지.',
      '후회는 무료가 아니야. 아니, 후회는 항상 네 몫이고, 환불은 없어.',
      '아이언 잭이 망치로 검을 깎아 준다면, 난 불확실성을 팔지. 확실한 건 싫증 난 손님만 찾아오거든.',
      '실명을 알고 싶으면 감정을 또 돈 내고 부르든가. 여기선 "살 때"의 스릴만 팔아.',
    ],
  },
  { 
    id: 'jin', name: '마스터 진', faction: '중립',
    dialogues: [
      "과거의 지혜가 담긴 비전서들이 여기 있다. 눈길이 가는 게 있나?",
      "지식은 썩지 않지. 다만 주인을 잃었을 뿐. 내가 수집한 비전서들이다.",
      "크레딧만 충분하다면, 전설적인 기술의 정수를 네게 넘겨주마.",
      "무작정 강해질 순 없는 법. 먼저 옛 가르침을 사보는 건 어때? ('거래'를 원하면 말해라)"
    ]
  },
  {
    id: 'hana',
    name: '하나',
    faction: '중립',
    dialogues: [
      '여긴 쉬어도 돼. 하지만 네온은 거짓말을 잘하지.',
      '미로에서 너무 오래 있으면, 네 발자국 냄새가 남아. 그게 놈들을 부른다.',
      '원한다면 흔적을 지워줄 수 있어. 단, 공짜는 아니야.',
      '아르카디아? 레드 드래곤? 결국 다 같은 소리를 하지. “우리 편이 돼라.”',
    ],
  },
  {
    id: 'karina',
    name: '카리나',
    faction: '블랙 스파이더',
    dialogues: [
      '미스테리오는 장부를 들고 나는 실시간 갱신을 들고 있지. 같은 거미줄이야, 다만 손가락이 다를 뿐.',
      '원한다면 이 칩을 열어줄게. 대신 네 로그에 내 지문은 남기지 마. 알지?',
      '분홍빛 네온 아래에선 누구나 예쁘게 보여. 시안빛 아래에선 뼈가 드러나고.',
      '정보는 무기야. 총알보다 빨리 망가지지만, 제값만 받으면 제일 정확해.',
    ],
  },
];
