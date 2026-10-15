"use client";

import type { MetaSnapshot } from "@/lib/data";
import { type StaticJsonState, useStaticJson } from "@/lib/use-static-json";
import type { PeriodDays, RankBracket } from "@/types/domain";

const url = (bracket: RankBracket, period: PeriodDays) =>
  `/data/v1/stats/${bracket}/${period}`;

/**
 * The statistics for a rank and period. The page carries the default one;
 * any other is fetched once from /data/v1/stats (static JSON) and kept.
 */
export function useMetaSnapshot(
  initial: MetaSnapshot,
  bracket: RankBracket,
  period: PeriodDays,
): StaticJsonState<MetaSnapshot> {
  return useStaticJson(
    initial,
    url(initial.bracket, initial.period),
    url(bracket, period),
  );
}
