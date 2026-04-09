# 개발 기록 — 장면 이미지 플레이스홀더 (배경·적·NPC)

## 현상

우측 **장면** 패널에서 NPC뿐 아니라 **탐험 기본 배경**, **전투 중 적** 일러도 대부분 안 나옴.

## 원인

- `BG_ALLEY`, `ENEMY_IMAGES`, `NPC_IMAGES`가 모두 `/images/.../*.png`를 가리킴.
- `frontend/public`에 해당 PNG가 거의 없어 **404** → `backgroundImage`가 빈 화면.

## 조치 (2026-03-30)

- **배경**: `public/images/backgrounds/bg_alley.svg` 추가, `BG_ALLEY` 및 `rooms.ts`의 `clinic.bgImage`를 `.svg`로 통일.
- **적**: `public/images/enemies/*.svg` 추가(글리치·가드·광신도·포탑·메어콥·사냥개·도둑 등), `ENEMY_IMAGES`를 `.svg`로 변경.
- **NPC**: 기존 NPC용 SVG 유지 + `npc_generic.svg` 추가. `resolveNpcSceneImage(npcId)`로 **에덴·리라·진 등 일러 미등록 NPC**도 기본 실루엣 표시. `거래`(아이언 잭·베일·진) 시에도 장면 갱신.

## 보완 (BASE_URL·동기화)

- **`scenePublicUrl()`**: GitHub Pages 등 **서브경로** 배포 시 `/images/...`만 쓰면 루트로 요청되어 404 — `import.meta.env.BASE_URL` 접두사로 수정.
- **`useEffect(currentRoomId, isCombat)`**: 비전투일 때 매번 `sceneUrlFromRoomBg`로 배경 갱신 — **세이브 로드** 직후 장면 누락 방지.
- **DOT 사망 리스폰**: 상태 이상으로 쓰러질 때 `setSceneImage`가 없던 분기에 `sceneUrlFromRoomBg` 추가.

## 번들 자산 + `<img>` (장면이 계속 검은색일 때)

- **`src/assets/scene/images/`** 로 SVG 복사 후 **`import ... ?url`** 로 `sceneImageUrls.ts`에서보냄 — `public` 미서빙·경로 문제와 무관하게 빌드 산출물에 포함.
- 장면 패널은 **`background-image` 대신 `<img object-contain>`** — 로드 실패 시 **`SCENE_IMAGE_FALLBACK_DATA_URI`**(data SVG)로 대체.

## 나중에 할 일

- 최종 PNG 일러가 생기면 `public`에 두고 `App.tsx`의 경로만 PNG로 바꾸면 됨.
