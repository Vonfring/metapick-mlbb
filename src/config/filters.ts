import type { PeriodDays, RankBracket } from "@/types/domain";

/** Rank and period a page shows until the visitor picks others. */
export const DEFAULT_BRACKET: RankBracket = "mythic";
export const DEFAULT_PERIOD: PeriodDays = 7;

/** Matchups and synergies are stored for this period only (see the updater). */
export const MATCHUP_PERIOD: PeriodDays = 7;
