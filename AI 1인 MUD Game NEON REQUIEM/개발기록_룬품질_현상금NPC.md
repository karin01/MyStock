# NEON REQUIEM — 룬 품질·공명·현상금 NPC (2026-03-30)

## 요약

- 인벤의 룬 행에 `runeQuality`가 붙으며, 장착 시 주·보조 슬롯별로 인벤에서 **같은 이름 룬 중 최고 품질**을 읽어 `equippedRuneQuality` / `equippedRuneSecondaryQuality`에 반영한다.
- 스탯·저항·회피·포션 등 **수치 패시브**는 기본 보너스에 이 배율을 곱하고, `runeQuality.ts`의 `RUNE_RESONANCE_JOB`에 맞는 직업이면 추가로 `RUNE_RESONANCE_BONUS_MULT`(1.25)를 곱한다.
- 구역 1에서 `bountyNpc`가 랜덤 스폰·이동하며, 같은 방에 들어가면 COIN 보상 후 제거된다. `[추적자]` 룬 장착 시 `위치` 명령과 이동 직후 로그에 BFS 기반 방향 힌트가 붙는다.

## 주요 파일

| 파일 | 역할 |
|------|------|
| `frontend/src/data/runeQuality.ts` | 품질 클램프, 드랍 롤, 공명 직업표, `getRuneScaleForPassive` |
| `frontend/src/data/bountyNpc.ts` | 스폰·배회·추적 힌트·이동 후 `resolveBountyNpcAfterPlayerMove` |
| `frontend/src/utils/inventoryHelpers.ts` | `InventoryRow.runeQuality`, `newInventoryRow` 옵션 |
| `frontend/src/utils/saveSystem.ts` | 세이브 필드 확장 |
| `frontend/src/data/runes.ts` | `applyPaladinRuneResist`에 품질·직업 인자 |
| `frontend/src/App.tsx` | 장착/전투/이동/UI 연동 |

## 리스크·메모

- 추적 BFS는 **기본 `room.exits`만** 사용해 숨겨진 출구 스포일을 피한다.
- 광전사 ATK%는 `(1 + low * 0.4 * scale)`로 스케일 전체가 곱해져 극단 품질에서 상한에 가깝게 붙을 수 있다.

## 테스트 전용 명령 (2026-03-30)

- 입력: **`테스트 룬`** 또는 **`테스트룬`** (`App.tsx`, 도움말 분기 직후).
- 인벤에 **추적자**(품질 약 1.18)·**현자**(약 0.92) 룬 2개를 `addItemToInventory(..., { runeQuality })`로 지급한다.
- 인벤 가득 등 메시지는 `extraLogs`가 응답 본문에 합쳐진다. **배포 빌드에서는 제거 권장.**
