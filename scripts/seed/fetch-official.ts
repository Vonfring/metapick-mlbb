/**
 * One-time pull of the official data into seed/official/*.json: heroes,
 * skills, relations and ranked statistics with matchups and synergies.
 *
 *   pnpm seed:fetch
 *
 * Requests run one at a time, about 2 seconds apart (see scripts/source).
 * Responses are cached in .cache/source for 20 hours, so a rerun on the same
 * day does not hit the source again. A statistics snapshot that fails to
 * load or fails the sanity checks is skipped with a warning.
 *
 * Items, emblems, talents and battle spells are not official data any more
 * (the MLBB Academy closed on 2026-06-30); `pnpm seed:catalog` imports them
 * from Liquipedia into seed/liquipedia/.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PairRow, StatSnapshotRecord } from "@/types/data";
import { MATCHUP_PERIOD } from "@/config/filters";
import { PERIODS, RANK_BRACKETS } from "@/types/domain";
import { createSourceClient, SourceBlockedError } from "../source/client";
import { contentHash } from "../source/normalize";
import { checkStatsSanity, type ParsedStats } from "../source/transform/stats";
import { fetchHeroCatalog, fetchRankedStats } from "../updater/official";

const OUT_DIR = path.resolve("seed", "official");

async function writeJson(name: string, data: unknown) {
  await writeFile(path.join(OUT_DIR, name), `${JSON.stringify(data, null, 1)}\n`);
  console.log(`wrote seed/official/${name}`);
}

async function main() {
  const warnings: string[] = [];
  const client = createSourceClient({
    cacheDir: path.resolve(".cache", "source"),
    log: (message) => console.log(`  ${message}`),
  });
  const fetchedAt = new Date().toISOString();
  const snapshotDate = fetchedAt.slice(0, 10);

  // Heroes: one record per hero holds the profile, skills and relations.
  console.log("heroes...");
  const { heroes, skills, relations, warnings: heroWarnings } = await fetchHeroCatalog(client);
  warnings.push(...heroWarnings);
  console.log(`  ${heroes.length} heroes, ${skills.length} skills, ${relations.length} relations`);
  if (heroes.length < 100) throw new Error(`Only ${heroes.length} heroes parsed; refusing to write a partial seed.`);

  // Ranked statistics: every rank and period; pairs for MATCHUP_PERIOD only.
  const snapshots: StatSnapshotRecord[] = [];
  for (const bracket of RANK_BRACKETS) {
    for (const period of PERIODS) {
      const label = `stats ${bracket}/${period}d`;
      let counters: ParsedStats;
      try {
        counters = await fetchRankedStats(client, bracket, period, "counters");
      } catch (error) {
        if (error instanceof SourceBlockedError) throw error;
        warnings.push(`${label} skipped: ${(error as Error).message}`);
        continue;
      }
      const sanity = checkStatsSanity(counters.stats, heroes.length);
      if (!sanity.ok) {
        warnings.push(`${label} skipped: ${sanity.problems.join("; ")}`);
        continue;
      }
      const snapshot: StatSnapshotRecord = {
        rank_bracket: bracket,
        period_days: period,
        snapshot_date: snapshotDate,
        fetched_at: fetchedAt,
        content_hash: "",
        stats: counters.stats,
      };
      if (period === MATCHUP_PERIOD) {
        snapshot.matchups = counters.pairs;
        let synergies: PairRow[] = [];
        try {
          synergies = (await fetchRankedStats(client, bracket, period, "teammates")).pairs;
        } catch (error) {
          if (error instanceof SourceBlockedError) throw error;
          warnings.push(`${label} synergies skipped: ${(error as Error).message}`);
        }
        snapshot.synergies = synergies;
      }
      snapshot.content_hash = contentHash({
        stats: snapshot.stats,
        matchups: snapshot.matchups,
        synergies: snapshot.synergies,
      });
      snapshots.push(snapshot);
      console.log(`  ${label}: ${snapshot.stats.length} heroes`);
    }
  }
  if (snapshots.length === 0) throw new Error("No statistics snapshot passed the checks; refusing to write.");

  await mkdir(OUT_DIR, { recursive: true });
  await writeJson("meta.json", {
    fetched_at: fetchedAt,
    source: "Official Mobile Legends: Bang Bang website data (api.gms.moontontech.com)",
    notes: warnings.length > 0 ? warnings.join("\n") : undefined,
  });
  await writeJson("heroes.json", heroes);
  await writeJson("skills.json", skills);
  await writeJson("relations.json", relations);
  await writeJson("stats.json", snapshots);

  console.log(`\ndone: ${client.stats.requests} requests, ${client.stats.retries} retries, ${client.stats.cacheHits} cache hits`);
  if (warnings.length > 0) {
    console.warn(`${warnings.length} warning(s):`);
    for (const warning of warnings) console.warn(`  - ${warning}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
