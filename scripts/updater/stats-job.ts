/**
 * Daily statistics job: one snapshot per rank and period, written only when
 * its numbers changed, then pruning. See docs/activity-updater.md.
 */
import { MATCHUP_PERIOD } from "@/config/filters";
import { daysBefore } from "@/lib/meta/meta-rows";
import type { PairRow } from "@/types/data";
import {
  PERIODS,
  RANK_BRACKETS,
  type PeriodDays,
  type RankBracket,
} from "@/types/domain";
import { SourceBlockedError } from "../source/client";
import { contentHash } from "../source/normalize";
import { checkStatsSanity, type ParsedStats } from "../source/transform/stats";
import { errorText, type JobReport } from "./report";
import { snapshotKey, type UpdaterStore } from "./store";

/** Statistics history kept in the database. */
export const KEEP_DAYS = 120;

export type StatsDeps = {
  store: UpdaterStore;
  report: JobReport;
  fetchedAt: string;
  runId: number | null;
  fetchStats: (
    bracket: RankBracket,
    period: PeriodDays,
    pairs: "counters" | "teammates",
  ) => Promise<ParsedStats>;
  /** Refreshes the hero catalog and returns every hero ID the database knows. */
  refreshHeroes: () => Promise<Set<number>>;
};

export async function runStatsJob(deps: StatsDeps): Promise<void> {
  const { store, report, fetchedAt, runId } = deps;
  const today = fetchedAt.slice(0, 10);
  let known = await store.knownHeroIds();
  let heroesRefreshed = false;
  const latest = await store.latestSnapshotHashes(daysBefore(today, 30));

  for (const bracket of RANK_BRACKETS) {
    for (const period of PERIODS) {
      const key = snapshotKey(bracket, period);
      if (report.blocked) {
        report.entries.push({
          key,
          outcome: "skipped",
          reason: "not requested: the source firewall stopped the run",
        });
        continue;
      }
      try {
        const counters = await deps.fetchStats(bracket, period, "counters");
        if (counters.skipped > 0)
          report.warnings.push(
            `${key}: ${counters.skipped} records did not parse`,
          );
        const sanity = checkStatsSanity(counters.stats, known.size);
        if (!sanity.ok) {
          report.entries.push({
            key,
            outcome: "skipped",
            reason: sanity.problems.join("; "),
          });
          continue;
        }

        let matchups: PairRow[] | undefined;
        let synergies: PairRow[] | undefined;
        if (period === MATCHUP_PERIOD) {
          matchups = counters.pairs;
          // Without teammate pairs the whole snapshot waits for the next run:
          // writing it would let pruning drop the older snapshot's pairs.
          synergies = (await deps.fetchStats(bracket, period, "teammates"))
            .pairs;
        }

        // A hero the database does not know yet: refresh the hero list once.
        const mentioned = new Set([
          ...counters.stats.map((s) => s.hero_id),
          ...[...(matchups ?? []), ...(synergies ?? [])].flatMap((p) => [
            p.hero_id,
            p.other_id,
          ]),
        ]);
        if (!heroesRefreshed && [...mentioned].some((id) => !known.has(id))) {
          heroesRefreshed = true;
          try {
            known = await deps.refreshHeroes();
          } catch (error) {
            if (error instanceof SourceBlockedError) throw error;
            report.warnings.push(
              `Refreshing the hero list failed: ${errorText(error)}`,
            );
          }
        }
        const unknown = [...mentioned].filter((id) => !known.has(id));
        if (unknown.length > 0) {
          report.warnings.push(
            `${key}: left out unknown hero IDs ${unknown.join(", ")}`,
          );
        }
        const isKnown = (p: PairRow) =>
          known.has(p.hero_id) && known.has(p.other_id);
        const stats = counters.stats.filter((s) => known.has(s.hero_id));
        matchups = matchups?.filter(isKnown);
        synergies = synergies?.filter(isKnown);

        // Same hash formula as the seed, so seeded snapshots compare equal.
        const hash = contentHash({ stats, matchups, synergies });
        if (latest.get(key) === hash) {
          report.entries.push({ key, outcome: "unchanged" });
          continue;
        }
        await store.writeSnapshot({
          rank_bracket: bracket,
          period_days: period,
          snapshot_date: today,
          fetched_at: fetchedAt,
          content_hash: hash,
          run_id: runId,
          stats,
          matchups: matchups ?? [],
          synergies: synergies ?? [],
        });
        latest.set(key, hash);
        report.entries.push({
          key,
          outcome: "written",
          rows:
            1 +
            stats.length +
            (matchups?.length ?? 0) +
            (synergies?.length ?? 0),
        });
      } catch (error) {
        if (error instanceof SourceBlockedError) {
          report.blocked = true;
          report.entries.push({
            key,
            outcome: "skipped",
            reason: errorText(error),
          });
          continue;
        }
        report.entries.push({
          key,
          outcome: "skipped",
          reason: errorText(error),
        });
      }
    }
  }

  try {
    const pruned = await store.pruneStats(KEEP_DAYS);
    if (Object.keys(pruned).length > 0) report.pruned = pruned;
  } catch (error) {
    report.warnings.push(
      `Pruning failed, old data stays until the next run: ${errorText(error)}`,
    );
  }
}
