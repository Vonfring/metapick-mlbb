/**
 * Reads from the official data source, shared by the updater and the
 * one-off seed fetch.
 */
import type { HeroRelationRow, HeroRow, HeroSkillRow } from "@/types/data";
import type { PeriodDays, RankBracket } from "@/types/domain";
import type { SourceClient } from "../source/client";
import {
  HERO_SOURCE_IDS,
  MATCH_TYPE,
  RANK_CODES,
  SOURCE_BASE_URL,
  STATS_SOURCE_IDS,
} from "../source/config";
import { eq, sortBy } from "../source/query";
import { fetchAllRecords } from "../source/records";
import { parseHeroRecord } from "../source/transform/heroes";
import { parseStatsRecords, type ParsedStats } from "../source/transform/stats";

export type HeroCatalog = {
  heroes: HeroRow[];
  skills: HeroSkillRow[];
  relations: HeroRelationRow[];
  warnings: string[];
};

/** Every hero with its skills and official relations: one record per hero. */
export async function fetchHeroCatalog(
  client: SourceClient,
): Promise<HeroCatalog> {
  const records = await fetchAllRecords(
    client,
    SOURCE_BASE_URL,
    HERO_SOURCE_IDS.heroList,
    {
      sorts: [sortBy("hero_id", "asc")],
    },
  );
  const catalog: HeroCatalog = {
    heroes: [],
    skills: [],
    relations: [],
    warnings: [],
  };
  const slugs = new Set<string>();
  for (const raw of records) {
    try {
      const parsed = parseHeroRecord(raw);
      // Two heroes with the same name would share a slug; keep both reachable.
      if (slugs.has(parsed.hero.slug))
        parsed.hero.slug = `${parsed.hero.slug}-${parsed.hero.id}`;
      slugs.add(parsed.hero.slug);
      catalog.heroes.push(parsed.hero);
      catalog.skills.push(...parsed.skills);
      catalog.relations.push(...parsed.relations);
    } catch (error) {
      catalog.warnings.push(`hero record skipped: ${(error as Error).message}`);
    }
  }
  catalog.heroes.sort((a, b) => a.id - b.id);
  return catalog;
}

/**
 * Ranked statistics for one rank and period. "counters" also carries each
 * hero's matchups, "teammates" its teammate pairs.
 */
export async function fetchRankedStats(
  client: SourceClient,
  bracket: RankBracket,
  period: PeriodDays,
  pairs: keyof typeof MATCH_TYPE,
): Promise<ParsedStats> {
  const records = await fetchAllRecords(
    client,
    SOURCE_BASE_URL,
    STATS_SOURCE_IDS[period],
    {
      filters: [
        eq("bigrank", RANK_CODES[bracket]),
        eq("match_type", MATCH_TYPE[pairs]),
      ],
      sorts: [sortBy("main_heroid", "asc")],
    },
  );
  return parseStatsRecords(records);
}
