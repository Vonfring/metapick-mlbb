"use client";

import { useMemo } from "react";
import type { HeroKnowledge, HeroSummary, MatchupSnapshot } from "@/lib/data";
import { compareNames } from "@/lib/format";
import { buildHeroIndex } from "@/lib/scoring/hero-index";
import { useStaticJson } from "@/lib/use-static-json";
import type { RankBracket } from "@/types/domain";

const url = (bracket: RankBracket) => `/data/v1/matchups/${bracket}`;

/**
 * Everything Counter pick and Matchup score with, for the chosen rank. The
 * page carries the default rank; others load from /data/v1/matchups.
 */
export function useToolData(
  heroes: HeroSummary[],
  knowledge: HeroKnowledge,
  initial: MatchupSnapshot,
  bracket: RankBracket,
) {
  const { data, loading, error } = useStaticJson(
    initial,
    url(initial.bracket),
    url(bracket),
  );
  const index = useMemo(
    () =>
      buildHeroIndex({
        heroes,
        stats: data.stats,
        matchups: data.matchups,
        synergies: data.synergies,
        tags: knowledge.tags,
        notes: knowledge.notes,
      }),
    [heroes, knowledge, data],
  );
  // Most picked first, so the likely picks sit at the top of the picker.
  const popular = useMemo(
    () =>
      [...heroes].sort(
        (a, b) =>
          (index.meta.get(b.id)?.pickRate ?? -1) -
            (index.meta.get(a.id)?.pickRate ?? -1) ||
          compareNames(a.name, b.name),
      ),
    [heroes, index],
  );
  return { snapshot: data, index, popular, loading, error };
}
