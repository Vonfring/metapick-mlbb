import { TIER_SCORING, type TierScoringConfig } from "@/config/tier-scoring";
import type { HeroStatRow } from "@/types/data";
import type { Tier } from "@/types/domain";

export type TierResult = {
  heroId: number;
  /** null when the hero is picked too rarely to rank. */
  tier: Tier | null;
  score: number;
  /** 0 (lowest score) to 100 (highest) among ranked heroes; null when unranked. */
  percentile: number | null;
  adjustedWinRate: number;
};

function zScores(values: number[]) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  return values.map((v) => (sd > 0 ? (v - mean) / sd : 0));
}

/** Tier for every hero in one stats snapshot (one rank and period). See src/config/tier-scoring.ts. */
export function computeTiers(
  stats: readonly HeroStatRow[],
  config: TierScoringConfig = TIER_SCORING,
): Map<number, TierResult> {
  const results = new Map<number, TierResult>();
  if (stats.length === 0) return results;

  const adjusted = stats.map(
    (s) =>
      (s.win_rate * s.pick_rate + 0.5 * config.shrinkage) /
      (s.pick_rate + config.shrinkage),
  );
  const zWin = zScores(adjusted);
  const zPick = zScores(stats.map((s) => s.pick_rate));
  const zBan = zScores(stats.map((s) => s.ban_rate));
  const { weights } = config;
  const scored = stats.map((s, i) => ({
    stat: s,
    adjustedWinRate: adjusted[i]!,
    score:
      weights.winRate * zWin[i]! +
      weights.pickRate * zPick[i]! +
      weights.banRate * zBan[i]!,
  }));

  const ranked = scored
    .filter(({ stat }) => stat.pick_rate >= config.minPickRate)
    .sort((a, b) => a.score - b.score || b.stat.hero_id - a.stat.hero_id);
  const last = ranked.length - 1;
  ranked.forEach((entry, index) => {
    const percentile = last > 0 ? (index / last) * 100 : 100;
    const tier =
      config.cutoffs.find(([, min]) => percentile >= min)?.[0] ?? "D";
    results.set(entry.stat.hero_id, {
      heroId: entry.stat.hero_id,
      tier,
      score: entry.score,
      percentile,
      adjustedWinRate: entry.adjustedWinRate,
    });
  });
  for (const entry of scored) {
    if (!results.has(entry.stat.hero_id)) {
      results.set(entry.stat.hero_id, {
        heroId: entry.stat.hero_id,
        tier: null,
        score: entry.score,
        percentile: null,
        adjustedWinRate: entry.adjustedWinRate,
      });
    }
  }
  return results;
}
