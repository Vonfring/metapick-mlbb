/**
 * One-time pull of the official data into seed/official/*.json.
 *
 *   pnpm seed:fetch
 *
 * Requests run one at a time, about 2 seconds apart (see scripts/source).
 * Responses are cached in .cache/source for 20 hours, so a rerun on the same
 * day does not hit the source again. Snapshots that fail the sanity checks
 * are skipped rather than written.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BattleSpellRow,
  EmblemRow,
  EmblemTalentRow,
  HeroRelationRow,
  HeroRow,
  HeroSkillRow,
  ItemRow,
  RecommendedBuildRecord,
  StatSnapshotRecord,
} from "@/types/data";
import { PERIODS, RANK_BRACKETS } from "@/types/domain";
import { createSourceClient } from "../source/client";
import {
  ACADEMY_BASE_URL,
  HERO_SOURCE_IDS,
  MATCH_TYPE,
  RANK_CODES,
  SOURCE_BASE_URL,
  STATS_SOURCE_IDS,
} from "../source/config";
import { contentHash } from "../source/normalize";
import { eq, sortBy } from "../source/query";
import { fetchAllRecords } from "../source/records";
import { parseHeroRecord } from "../source/transform/heroes";
import { checkStatsSanity, parseStatsRecords } from "../source/transform/stats";
import { fetchAcademy } from "./fetch-academy";

/** Matchups and synergies are stored for this period only (all ranks). */
export const MATCHUP_PERIOD = 7;

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
  const heroRecords = await fetchAllRecords(client, SOURCE_BASE_URL, HERO_SOURCE_IDS.heroList, {
    sorts: [sortBy("hero_id", "asc")],
  });
  const heroes: HeroRow[] = [];
  const skills: HeroSkillRow[] = [];
  const relations: HeroRelationRow[] = [];
  const slugs = new Set<string>();
  for (const raw of heroRecords) {
    try {
      const parsed = parseHeroRecord(raw);
      if (slugs.has(parsed.hero.slug)) parsed.hero.slug = `${parsed.hero.slug}-${parsed.hero.id}`;
      slugs.add(parsed.hero.slug);
      heroes.push(parsed.hero);
      skills.push(...parsed.skills);
      relations.push(...parsed.relations);
    } catch (error) {
      warnings.push(`hero record skipped: ${(error as Error).message}`);
    }
  }
  heroes.sort((a, b) => a.id - b.id);
  console.log(`  ${heroes.length} heroes, ${skills.length} skills, ${relations.length} relations`);
  if (heroes.length < 100) throw new Error(`Only ${heroes.length} heroes parsed; refusing to write a partial seed.`);

  // Ranked statistics: every rank and period; pairs for MATCHUP_PERIOD only.
  const snapshots: StatSnapshotRecord[] = [];
  for (const bracket of RANK_BRACKETS) {
    for (const period of PERIODS) {
      const filters = (matchType: string) => ({
        filters: [eq("bigrank", RANK_CODES[bracket]), eq("match_type", matchType)],
        sorts: [sortBy("main_heroid", "asc")],
      });
      const counters = parseStatsRecords(
        await fetchAllRecords(client, SOURCE_BASE_URL, STATS_SOURCE_IDS[period], filters(MATCH_TYPE.counters)),
      );
      const sanity = checkStatsSanity(counters.stats, heroes.length);
      if (!sanity.ok) {
        warnings.push(`stats ${bracket}/${period}d skipped: ${sanity.problems.join("; ")}`);
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
        const teammates = parseStatsRecords(
          await fetchAllRecords(client, SOURCE_BASE_URL, STATS_SOURCE_IDS[period], filters(MATCH_TYPE.teammates)),
        );
        snapshot.synergies = teammates.pairs;
      }
      snapshot.content_hash = contentHash({
        stats: snapshot.stats,
        matchups: snapshot.matchups,
        synergies: snapshot.synergies,
      });
      snapshots.push(snapshot);
      console.log(`  stats ${bracket}/${period}d: ${snapshot.stats.length} heroes`);
    }
  }

  // Items, emblems, talents, spells and builds come from the Academy endpoints.
  let academy: {
    items: ItemRow[];
    emblems: EmblemRow[];
    talents: EmblemTalentRow[];
    spells: BattleSpellRow[];
    builds: RecommendedBuildRecord[];
  } = { items: [], emblems: [], talents: [], spells: [], builds: [] };
  if (ACADEMY_BASE_URL) {
    academy = await fetchAcademy(client, ACADEMY_BASE_URL, heroes, warnings);
  } else {
    warnings.push("MLBB_ACADEMY_BASE_URL is not set: items, emblems, spells and builds were not fetched");
  }

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
  await writeJson("items.json", academy.items);
  await writeJson("emblems.json", academy.emblems);
  await writeJson("talents.json", academy.talents);
  await writeJson("spells.json", academy.spells);
  await writeJson("builds.json", academy.builds);

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
