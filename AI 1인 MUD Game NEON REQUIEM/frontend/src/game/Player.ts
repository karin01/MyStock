import {
  ALL_RUNE_SKILL_NAMES,
  RUNES_BY_ID,
  applyEquippedRuneSkillsToList,
  findRuneIdByQuery,
  type RuneId,
} from '../data/runes';

/**
 * 플레이어 룬 동기화 전용 클래스
 * WHY: 주/보조 2슬롯 + 시너지 빌드를 한 패턴으로 정리한다.
 */
export class Player {
  /** 보조 슬롯까지 포함해 스킬 목록을 룬 정의와 동기화 */
  static rebuildRuneSkills(skills: string[], primary: string | null, secondary: string | null): string[] {
    return applyEquippedRuneSkillsToList(skills, primary, secondary);
  }

  /**
   * 단일 슬롯 전용(구세이브·간이 해제 호환) — 보조 슬롯은 건드리지 않는다.
   */
  static equipRune(
    skills: string[],
    previousRuneId: string | null | undefined,
    queryOrId: string | null,
  ): { skills: string[]; equippedRuneId: string | null; logLines: string[] } {
    const logLines: string[] = [];
    let withoutRuneSkills = [...skills];
    for (const sk of ALL_RUNE_SKILL_NAMES) {
      withoutRuneSkills = withoutRuneSkills.filter((x) => x !== sk);
    }

    if (queryOrId === null || queryOrId === '' || queryOrId === '해제' || queryOrId === 'none') {
      if (previousRuneId && RUNES_BY_ID[previousRuneId as RuneId]) {
        logLines.push(`◆ [룬 해제] ${RUNES_BY_ID[previousRuneId as RuneId].displayName}`);
      }
      logLines.push('◇ 룬 전용 스킬이 인벤토리 목록에서 제거되었습니다. (패시브 해제)');
      return { skills: withoutRuneSkills, equippedRuneId: null, logLines };
    }

    const targetId = (RUNES_BY_ID[queryOrId as RuneId] ? queryOrId : findRuneIdByQuery(queryOrId)) as RuneId | null;
    if (!targetId || !RUNES_BY_ID[targetId]) {
      logLines.push(`⚠ 알 수 없는 룬입니다: "${queryOrId}"`);
      return { skills: [...skills], equippedRuneId: previousRuneId ?? null, logLines };
    }

    const def = RUNES_BY_ID[targetId];
    const nextSkills = withoutRuneSkills.includes(def.skillKo)
      ? [...withoutRuneSkills]
      : [...withoutRuneSkills, def.skillKo];

    if (previousRuneId && previousRuneId !== targetId && RUNES_BY_ID[previousRuneId as RuneId]) {
      logLines.push(`◆ 교체: ${RUNES_BY_ID[previousRuneId as RuneId].displayName} → ${def.displayName}`);
    }
    logLines.push(
      `╔════════════════════════════════════╗\n` +
        `║  RUNE SYNC — ${def.displayName.padEnd(8, ' ')}      ║\n` +
        `╚════════════════════════════════════╝\n` +
        `· 패시브: ${def.passiveShort}\n` +
        `· 스킬: 「${def.skillKo}」 (보유 목록에 동기화됨)`,
    );

    return { skills: nextSkills, equippedRuneId: targetId, logLines };
  }

  /** 주 슬롯 장착 — 보조와 동일 id 불가 */
  static equipPrimaryRune(
    skills: string[],
    prevPrimary: string | null | undefined,
    prevSecondary: string | null | undefined,
    queryOrId: string,
  ): {
    skills: string[];
    equippedRuneId: string | null;
    equippedRuneSecondaryId: string | null;
    logLines: string[];
  } {
    const logLines: string[] = [];
    const targetId = (RUNES_BY_ID[queryOrId as RuneId] ? queryOrId : findRuneIdByQuery(queryOrId)) as RuneId | null;
    if (!targetId || !RUNES_BY_ID[targetId]) {
      logLines.push(`⚠ 알 수 없는 룬입니다: "${queryOrId}"`);
      return {
        skills: [...skills],
        equippedRuneId: prevPrimary ?? null,
        equippedRuneSecondaryId: prevSecondary ?? null,
        logLines,
      };
    }
    if (prevSecondary === targetId) {
      logLines.push('⚠ 이미 보조 슬롯에 동일 룬이 장착되어 있습니다. 보조를 먼저 해제하세요.');
      return {
        skills: [...skills],
        equippedRuneId: prevPrimary ?? null,
        equippedRuneSecondaryId: prevSecondary ?? null,
        logLines,
      };
    }
    const def = RUNES_BY_ID[targetId];
    if (prevPrimary && prevPrimary !== targetId && RUNES_BY_ID[prevPrimary as RuneId]) {
      logLines.push(`◆ [주 슬롯] 교체: ${RUNES_BY_ID[prevPrimary as RuneId].displayName} → ${def.displayName}`);
    } else {
      logLines.push(`◆ [주 슬롯] 장착: ${def.displayName}`);
    }
    logLines.push(`· 패시브: ${def.passiveShort} · 스킬: 「${def.skillKo}」`);
    const nextSkills = Player.rebuildRuneSkills(skills, targetId, prevSecondary ?? null);
    return {
      skills: nextSkills,
      equippedRuneId: targetId,
      equippedRuneSecondaryId: prevSecondary ?? null,
      logLines,
    };
  }

  /** 보조 슬롯 장착 — 주와 동일 id 불가 */
  static equipSecondaryRune(
    skills: string[],
    prevPrimary: string | null | undefined,
    prevSecondary: string | null | undefined,
    queryOrId: string,
  ): {
    skills: string[];
    equippedRuneId: string | null;
    equippedRuneSecondaryId: string | null;
    logLines: string[];
  } {
    const logLines: string[] = [];
    const targetId = (RUNES_BY_ID[queryOrId as RuneId] ? queryOrId : findRuneIdByQuery(queryOrId)) as RuneId | null;
    if (!targetId || !RUNES_BY_ID[targetId]) {
      logLines.push(`⚠ 알 수 없는 룬입니다: "${queryOrId}"`);
      return {
        skills: [...skills],
        equippedRuneId: prevPrimary ?? null,
        equippedRuneSecondaryId: prevSecondary ?? null,
        logLines,
      };
    }
    if (prevPrimary === targetId) {
      logLines.push('⚠ 이미 주 슬롯에 동일 룬이 장착되어 있습니다. 주 슬롯을 먼저 바꾸세요.');
      return {
        skills: [...skills],
        equippedRuneId: prevPrimary ?? null,
        equippedRuneSecondaryId: prevSecondary ?? null,
        logLines,
      };
    }
    const def = RUNES_BY_ID[targetId];
    if (prevSecondary && prevSecondary !== targetId && RUNES_BY_ID[prevSecondary as RuneId]) {
      logLines.push(`◆ [보조 슬롯] 교체: ${RUNES_BY_ID[prevSecondary as RuneId].displayName} → ${def.displayName}`);
    } else {
      logLines.push(`◆ [보조 슬롯] 장착: ${def.displayName}`);
    }
    logLines.push(`· 패시브: ${def.passiveShort} · 스킬: 「${def.skillKo}」`);
    const nextSkills = Player.rebuildRuneSkills(skills, prevPrimary ?? null, targetId);
    return {
      skills: nextSkills,
      equippedRuneId: prevPrimary ?? null,
      equippedRuneSecondaryId: targetId,
      logLines,
    };
  }

  static clearPrimaryRune(
    skills: string[],
    prevPrimary: string | null | undefined,
    prevSecondary: string | null | undefined,
  ): { skills: string[]; equippedRuneId: string | null; equippedRuneSecondaryId: string | null; logLines: string[] } {
    const logLines: string[] = [];
    if (prevPrimary && RUNES_BY_ID[prevPrimary as RuneId]) {
      logLines.push(`◆ [주 슬롯 해제] ${RUNES_BY_ID[prevPrimary as RuneId].displayName}`);
    }
    const nextSkills = Player.rebuildRuneSkills(skills, null, prevSecondary ?? null);
    logLines.push('◇ 주 슬롯 룬 스킬 동기화 완료');
    return {
      skills: nextSkills,
      equippedRuneId: null,
      equippedRuneSecondaryId: prevSecondary ?? null,
      logLines,
    };
  }

  static clearSecondaryRune(
    skills: string[],
    prevPrimary: string | null | undefined,
    prevSecondary: string | null | undefined,
  ): { skills: string[]; equippedRuneId: string | null; equippedRuneSecondaryId: string | null; logLines: string[] } {
    const logLines: string[] = [];
    if (prevSecondary && RUNES_BY_ID[prevSecondary as RuneId]) {
      logLines.push(`◆ [보조 슬롯 해제] ${RUNES_BY_ID[prevSecondary as RuneId].displayName}`);
    }
    const nextSkills = Player.rebuildRuneSkills(skills, prevPrimary ?? null, null);
    logLines.push('◇ 보조 슬롯 룬 스킬 동기화 완료');
    return {
      skills: nextSkills,
      equippedRuneId: prevPrimary ?? null,
      equippedRuneSecondaryId: null,
      logLines,
    };
  }

  static clearAllRunes(skills: string[]): { skills: string[]; logLines: string[] } {
    const logLines: string[] = ['◆ [룬 전체 해제] 주·보조 슬롯 비움', '◇ 룬 전용 스킬 제거됨'];
    let withoutRuneSkills = [...skills];
    for (const sk of ALL_RUNE_SKILL_NAMES) {
      withoutRuneSkills = withoutRuneSkills.filter((x) => x !== sk);
    }
    return { skills: withoutRuneSkills, logLines };
  }
}
