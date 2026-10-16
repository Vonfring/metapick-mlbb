import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { MATCHUP_PERIOD } from "@/config/filters";
import { buildMetaRows, daysBefore, type MetaRow } from "@/lib/meta/meta-rows";
import type {
  HeroNoteLists,
  HeroTagLevels,
  PairTuple,
} from "@/lib/scoring/hero-index";
import { computeTiers } from "@/lib/scoring/tier";
import type {
  BattleSpellRow,
  HeroRow,
  HeroStatRow,
  ItemRow,
  PairRow,
} from "@/types/data";
import type { PeriodDays, RankBracket, Tier } from "@/types/domain";
import { GAME_DATA_TAG, getDataSourceKind } from "./config";
import type {
  EmblemCatalog,
  GameDataProvider,
  HeroDetails,
  PairsSnapshot,
  SnapshotInfo,
  StatsSnapshot,
} from "./provider";
import { createSeedProvider } from "./seed-provider";
import { createSupabaseProvider } from "./supabase-provider";

export type {
  EmblemCatalog,
  HeroDetails,
  PairsSnapshot,
  SnapshotInfo,
  StatsSnapshot,
} from "./provider";

function provider(): GameDataProvider {
  return getDataSourceKind() === "supabase"
    ? createSupabaseProvider()
    : createSeedProvider();
}

// Every read is cached with the "gameData" profile (see next.config.ts) and
// tagged, so pages stay static until the updater asks for revalidation.

export async function getHeroes(): Promise<HeroRow[]> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().listHeroes();
}

/**
 * `generateStaticParams` for everything built per hero: the hero pages and
 * their Open Graph images. Cache Components needs at least one path, so
 * before any hero data exists a placeholder renders as not found.
 */
export async function getHeroSlugParams(): Promise<{ slug: string }[]> {
  const heroes = await getHeroes();
  if (heroes.length === 0) return [{ slug: "no-heroes-yet" }];
  return heroes.map((hero) => ({ slug: hero.slug }));
}

export async function getHeroDetails(
  slug: string,
): Promise<HeroDetails | null> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getHeroDetails(slug);
}

export async function getStatsSnapshot(
  bracket: RankBracket,
  period: PeriodDays,
): Promise<StatsSnapshot | null> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getStats(bracket, period);
}

/** The newest snapshot dated on or before `onOrBefore` (YYYY-MM-DD). */
export async function getStatsSnapshotOnOrBefore(
  bracket: RankBracket,
  period: PeriodDays,
  onOrBefore: string,
): Promise<StatsSnapshot | null> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getStats(bracket, period, onOrBefore);
}

export async function getPairsSnapshot(
  bracket: RankBracket,
  period: PeriodDays,
): Promise<PairsSnapshot | null> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getPairs(bracket, period);
}

export async function getItems(): Promise<ItemRow[]> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().listItems();
}

export async function getEmblemCatalog(): Promise<EmblemCatalog> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getEmblemCatalog();
}

export async function getSpells(): Promise<BattleSpellRow[]> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().listSpells();
}

export async function getLastUpdate(): Promise<string | null> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getLastUpdate();
}

/** What lists and pickers need to show a hero. */
export type HeroSummary = Pick<
  HeroRow,
  "id" | "slug" | "name" | "roles" | "lanes" | "head_image_url"
>;

export const toHeroSummary = ({
  id,
  slug,
  name,
  roles,
  lanes,
  head_image_url,
}: HeroRow): HeroSummary => ({ id, slug, name, roles, lanes, head_image_url });

/** A hero with its rates and tier in one rank and period. Rates are null when the snapshot lacks the hero. */
export type RankedHero = HeroSummary & {
  winRate: number | null;
  pickRate: number | null;
  banRate: number | null;
  tier: Tier | null;
  /** Tier score (higher is stronger), for sorting. Null when the hero has no tier. */
  score: number | null;
};

export type RankedHeroes = {
  heroes: RankedHero[];
  snapshot: SnapshotInfo | null;
};

export async function getRankedHeroes(
  bracket: RankBracket,
  period: PeriodDays,
): Promise<RankedHeroes> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  const [heroes, snapshot] = await Promise.all([
    getHeroes(),
    getStatsSnapshot(bracket, period),
  ]);
  const statsByHero = new Map(snapshot?.stats.map((s) => [s.hero_id, s]));
  const tiers = computeTiers(snapshot?.stats ?? []);
  return {
    heroes: heroes.map((hero) => {
      const stats = statsByHero.get(hero.id);
      const tier = tiers.get(hero.id);
      return {
        id: hero.id,
        slug: hero.slug,
        name: hero.name,
        roles: hero.roles,
        lanes: hero.lanes,
        head_image_url: hero.head_image_url,
        winRate: stats?.win_rate ?? null,
        pickRate: stats?.pick_rate ?? null,
        banRate: stats?.ban_rate ?? null,
        tier: tier?.tier ?? null,
        // Rarely picked heroes get no tier, so they sort after every tiered hero.
        score: tier?.tier ? tier.score : null,
      };
    }),
    snapshot: snapshot
      ? {
          rank_bracket: snapshot.rank_bracket,
          period_days: snapshot.period_days,
          snapshot_date: snapshot.snapshot_date,
          fetched_at: snapshot.fetched_at,
        }
      : null,
  };
}

export type MetaSnapshot = {
  bracket: RankBracket;
  period: PeriodDays;
  /** When the updater last checked the source, even if nothing changed. */
  checkedAt: string | null;
  snapshot: SnapshotInfo | null;
  /** The snapshot one period earlier that the changes compare with. */
  previous: SnapshotInfo | null;
  rows: MetaRow[];
};

const info = (s: StatsSnapshot): SnapshotInfo => ({
  rank_bracket: s.rank_bracket,
  period_days: s.period_days,
  snapshot_date: s.snapshot_date,
  fetched_at: s.fetched_at,
});

/**
 * Every hero's rates and tier in one rank and period, plus the rates one
 * period earlier (the 7-day numbers from a week before, and so on). Served
 * to the Statistics and Tier list pages.
 */
export async function getMetaSnapshot(
  bracket: RankBracket,
  period: PeriodDays,
): Promise<MetaSnapshot> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  const [current, checkedAt] = await Promise.all([
    getStatsSnapshot(bracket, period),
    getLastUpdate(),
  ]);
  if (!current) {
    return {
      bracket,
      period,
      checkedAt,
      snapshot: null,
      previous: null,
      rows: [],
    };
  }
  const previous = await getStatsSnapshotOnOrBefore(
    bracket,
    period,
    daysBefore(current.snapshot_date, period),
  );
  return {
    bracket,
    period,
    checkedAt,
    snapshot: info(current),
    previous: previous ? info(previous) : null,
    rows: buildMetaRows(current.stats, previous?.stats ?? null),
  };
}

/** What Counter pick and Matchup need for one rank: the 7-day rates and pairs. */
export type MatchupSnapshot = {
  bracket: RankBracket;
  period: PeriodDays;
  /** When the updater last checked the source, even if nothing changed. */
  checkedAt: string | null;
  snapshot: SnapshotInfo | null;
  stats: HeroStatRow[];
  matchups: PairTuple[];
  synergies: PairTuple[];
};

/** Five decimals is a thousandth of a percentage point, plenty for display and scoring. */
const toTuple = (row: PairRow): PairTuple => [
  row.hero_id,
  row.other_id,
  Math.round(row.win_rate_delta * 1e5) / 1e5,
];

/**
 * The newest 7-day snapshot of one rank with its matchups and synergies,
 * compact enough to send to the browser. Served to Counter pick and Matchup.
 */
export async function getMatchupSnapshot(
  bracket: RankBracket,
): Promise<MatchupSnapshot> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  const [stats, pairs, checkedAt] = await Promise.all([
    getStatsSnapshot(bracket, MATCHUP_PERIOD),
    getPairsSnapshot(bracket, MATCHUP_PERIOD),
    getLastUpdate(),
  ]);
  return {
    bracket,
    period: MATCHUP_PERIOD,
    checkedAt,
    snapshot: stats ? info(stats) : null,
    stats: stats?.stats ?? [],
    // Both reads take the newest 7-day snapshot, which always stores its
    // pairs; only a revalidation between the two reads could split them.
    matchups: pairs?.matchups.map(toTuple) ?? [],
    synergies: pairs?.synergies.map(toTuple) ?? [],
  };
}

/** Curated tags and official notes: what the tools know about heroes besides the numbers. */
export type HeroKnowledge = {
  tags: HeroTagLevels[];
  notes: HeroNoteLists[];
};

export async function getHeroKnowledge(): Promise<HeroKnowledge> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  const [tags, relations] = await Promise.all([
    provider().listHeroTags(),
    provider().listRelations(),
  ]);
  const key = {
    strong_against: "strong",
    weak_against: "weak",
    best_teammate: "teammates",
  } as const;
  const lists = new Map<
    number,
    { heroId: number; strong: number[]; weak: number[]; teammates: number[] }
  >();
  for (const r of relations) {
    let entry = lists.get(r.hero_id);
    if (!entry) {
      entry = { heroId: r.hero_id, strong: [], weak: [], teammates: [] };
      lists.set(r.hero_id, entry);
    }
    entry[key[r.relation]].push(r.target_hero_id);
  }
  return {
    // The editing fields stay out of the browser.
    tags: tags.map(({ needs_review: _, notes: __, ...levels }) => levels),
    notes: [...lists.values()],
  };
}

/** The official explanation for each kind of note a hero has, keyed "heroId:relation". */
export async function getNoteTexts(): Promise<Record<string, string>> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  const texts: Record<string, string> = {};
  for (const r of await provider().listRelations()) {
    if (r.description) texts[`${r.hero_id}:${r.relation}`] = r.description;
  }
  return texts;
}
