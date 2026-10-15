import { z } from "zod";
import type { HeroStatRow, PairRow } from "@/types/data";
import { toDelta, toInt, toRate } from "../normalize";

const pairSchema = z.looseObject({
  heroid: z.union([z.number(), z.string()]),
  increase_win_rate: z.union([z.number(), z.string()]),
});

const statRecordSchema = z.looseObject({
  main_heroid: z.union([z.number(), z.string()]),
  main_hero_win_rate: z.union([z.number(), z.string()]),
  main_hero_appearance_rate: z.union([z.number(), z.string()]),
  main_hero_ban_rate: z.union([z.number(), z.string()]),
  sub_hero: z.array(pairSchema).nullish(),
  sub_hero_last: z.array(pairSchema).nullish(),
});

export type ParsedStats = {
  stats: HeroStatRow[];
  pairs: PairRow[];
  skipped: number;
};

/**
 * Turn ranked-statistics records into hero rows and pair rows.
 *
 * Each record is one hero (the "main hero"). `sub_hero` lists the five other
 * heroes with the largest positive `increase_win_rate` and `sub_hero_last`
 * the five with the most negative one. The value is the change in the main
 * hero's win rate when facing (match_type 0) or teaming up with (match_type 1)
 * that hero: the per-duration win rates in each entry sit around the main
 * hero's own win rate plus this delta. So a positive delta means the main
 * hero is favored, which is exactly how hero_matchups stores it.
 */
export function parseStatsRecords(raws: unknown[]): ParsedStats {
  const stats: HeroStatRow[] = [];
  const pairs = new Map<string, PairRow>();
  let skipped = 0;

  for (const raw of raws) {
    const parsed = statRecordSchema.safeParse(raw);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const r = parsed.data;
    const heroId = toInt(r.main_heroid);
    const winRate = toRate(r.main_hero_win_rate);
    const pickRate = toRate(r.main_hero_appearance_rate);
    const banRate = toRate(r.main_hero_ban_rate);
    if (
      heroId === null ||
      heroId <= 0 ||
      winRate === null ||
      pickRate === null ||
      banRate === null
    ) {
      skipped += 1;
      continue;
    }
    stats.push({
      hero_id: heroId,
      win_rate: winRate,
      pick_rate: pickRate,
      ban_rate: banRate,
    });

    for (const entry of [...(r.sub_hero ?? []), ...(r.sub_hero_last ?? [])]) {
      const otherId = toInt(entry.heroid);
      const delta = toDelta(entry.increase_win_rate);
      if (
        otherId === null ||
        otherId <= 0 ||
        otherId === heroId ||
        delta === null
      )
        continue;
      pairs.set(`${heroId}:${otherId}`, {
        hero_id: heroId,
        other_id: otherId,
        win_rate_delta: delta,
      });
    }
  }

  stats.sort((a, b) => a.hero_id - b.hero_id);
  return {
    stats,
    pairs: [...pairs.values()].sort(
      (a, b) => a.hero_id - b.hero_id || a.other_id - b.other_id,
    ),
    skipped,
  };
}

export type StatsSanity = { ok: boolean; problems: string[] };

/** Reject snapshots that look broken before they can reach the database. */
export function checkStatsSanity(
  stats: HeroStatRow[],
  expectedHeroes: number,
): StatsSanity {
  const problems: string[] = [];
  if (stats.length < Math.max(1, Math.floor(expectedHeroes * 0.8))) {
    problems.push(`only ${stats.length} of about ${expectedHeroes} heroes`);
  }
  const pickSum = stats.reduce((sum, s) => sum + s.pick_rate, 0);
  if (pickSum < 0.8 || pickSum > 1.2)
    problems.push(`pick rates sum to ${pickSum.toFixed(3)} instead of about 1`);
  const meanWin =
    stats.reduce((sum, s) => sum + s.win_rate, 0) / (stats.length || 1);
  if (meanWin < 0.45 || meanWin > 0.55)
    problems.push(`mean win rate ${meanWin.toFixed(3)} is far from 0.5`);
  return { ok: problems.length === 0, problems };
}
