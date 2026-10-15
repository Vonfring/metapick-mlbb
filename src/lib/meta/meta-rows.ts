import { computeTiers } from "@/lib/scoring/tier";
import type { HeroStatRow } from "@/types/data";
import type { Tier } from "@/types/domain";

export type Rates = { winRate: number; pickRate: number; banRate: number };

/** One hero's numbers in a rank and period, with the same numbers one period earlier. */
export type MetaRow = Rates & {
  id: number;
  tier: Tier | null;
  /** Tier score, higher is stronger. Null without a tier. */
  score: number | null;
  previous: Rates | null;
};

const rates = (s: HeroStatRow): Rates => ({
  winRate: s.win_rate,
  pickRate: s.pick_rate,
  banRate: s.ban_rate,
});

/** Rows for every hero in `stats`, strongest first. */
export function buildMetaRows(
  stats: HeroStatRow[],
  previousStats: HeroStatRow[] | null,
): MetaRow[] {
  const tiers = computeTiers(stats);
  const before = new Map(previousStats?.map((s) => [s.hero_id, s]));
  return stats
    .map((s) => {
      const tier = tiers.get(s.hero_id);
      const prev = before.get(s.hero_id);
      return {
        id: s.hero_id,
        ...rates(s),
        tier: tier?.tier ?? null,
        score: tier?.tier ? tier.score : null,
        previous: prev ? rates(prev) : null,
      };
    })
    .sort(
      (a, b) =>
        (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
        b.winRate - a.winRate ||
        a.id - b.id,
    );
}

/** The date `days` before an ISO date (YYYY-MM-DD). */
export function daysBefore(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
